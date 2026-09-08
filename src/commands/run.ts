import { loadConfig } from "../core/config.js";
import { loadEnvironment } from "../core/env.js";
import { SnowDevError } from "../core/errors.js";
import { waitForHttp, type HttpProbe, type Sleep } from "../core/health.js";
import {
  runHostForeground,
  startHostBackground,
  type HostProcessDeps,
} from "../core/hostProcess.js";
import { isForeground, startCommands } from "../core/lifecycle.js";
import { logCommand } from "../core/log.js";
import { runProcess, type ProcessRunner } from "../core/process.js";

/** Inputs for the `run` command. All I/O boundaries are injectable for tests. */
export interface RunOptions {
  cwd: string;
  profileKey: string;
  runner?: ProcessRunner;
  httpProbe?: HttpProbe;
  sleep?: Sleep;
  hostDeps?: Partial<HostProcessDeps>;
  log?: (line: string) => void;
}

/**
 * Starts a profile according to its workflow kind and returns the process exit code.
 *
 * Foreground profiles block until their attached service exits; background profiles
 * return once the containers (and any host process) are started and healthy. This
 * command never issues `docker compose down`.
 */
export async function run(options: RunOptions): Promise<number> {
  const runner = options.runner ?? runProcess;
  const log = options.log ?? console.error;
  const { config } = await loadConfig(options.cwd);
  const profile = config.profiles[options.profileKey];
  if (!profile)
    throw new SnowDevError(
      "E_PROFILE_NOT_FOUND",
      `No profile "${options.profileKey}" in configuration.`,
    );
  const env = await loadEnvironment(options.cwd, options.profileKey, config.env);
  const foreground = isForeground(options.profileKey, profile);
  const specs = startCommands(config, options.profileKey);

  // container-cli: run each one-off service attached; stop at the first failure.
  if (profile.kind === "container-cli") {
    for (const spec of specs) {
      logCommand(spec, log);
      const result = await runner(spec, { cwd: options.cwd, env, stdio: "inherit" });
      if (result.exitCode !== 0) return result.exitCode;
    }
    return 0;
  }

  // compose-service / host-app deps: exactly one bring-up command. Foreground
  // compose services stay attached and their exit code is the command's result;
  // every other case brings containers up quietly and continues to health/host.
  const [bringUp] = specs;
  const attach = foreground && profile.kind === "compose-service";
  logCommand(bringUp, log);
  const brought = await runner(bringUp, {
    cwd: options.cwd,
    env,
    stdio: attach ? "inherit" : "ignore",
  });
  if (attach || brought.exitCode !== 0) return brought.exitCode;

  if (profile.health) {
    log(`Waiting for ${profile.health.url} ...`);
    await waitForHttp(profile.health, { probe: options.httpProbe, sleep: options.sleep });
  }

  if (profile.kind === "host-app-with-compose-deps") {
    if (!profile.host)
      throw new SnowDevError(
        "E_CONFIG_INVALID",
        `Profile "${options.profileKey}" is missing a host process definition.`,
      );
    const key = `${config.compose.projectName}-${options.profileKey}`;
    if (foreground) {
      log(`$ ${[profile.host.command, ...(profile.host.args ?? [])].join(" ")}`);
      const hostResult = await runHostForeground(profile.host, {
        cwd: options.cwd,
        env,
        deps: options.hostDeps,
      });
      return hostResult.exitCode;
    }
    const record = await startHostBackground(profile.host, {
      cwd: options.cwd,
      key,
      env,
      deps: options.hostDeps,
    });
    log(`Host process started (pid ${record.pid}); state in .snowdev/${key}.host.json`);
  }

  return 0;
}
