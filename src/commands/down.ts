import { loadConfig } from "../core/config.js";
import { loadEnvironment } from "../core/env.js";
import { SnowDevError } from "../core/errors.js";
import { runHook } from "../core/hooks.js";
import { stopHostBackground, type HostProcessDeps } from "../core/hostProcess.js";
import { downCommand } from "../core/lifecycle.js";
import { logCommand } from "../core/log.js";
import { runProcess, type ProcessRunner } from "../core/process.js";

/** Inputs for the `down` command. */
export interface DownOptions {
  cwd: string;
  profileKey: string;
  runner?: ProcessRunner;
  hostDeps?: Partial<HostProcessDeps>;
  log?: (line: string) => void;
}

/**
 * Explicitly stops a profile: first any recorded host process, then its containers.
 *
 * Never removes volumes — that is reserved for `reset dev --yes`.
 */
export async function down(options: DownOptions): Promise<number> {
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
  await runHook("beforeDown", config.hooks?.beforeDown, {
    config,
    cwd: options.cwd,
    key: options.profileKey,
    profile,
    env,
    runner,
    log,
  });
  if (profile.kind === "host-app-with-compose-deps") {
    const key = `${config.compose.projectName}-${options.profileKey}`;
    const result = await stopHostBackground({
      cwd: options.cwd,
      key,
      graceSeconds: profile.host?.stopGraceSeconds,
      deps: options.hostDeps,
    });
    if (result.stopped) log(`Stopped host process for ${key}.`);
  }
  const spec = downCommand(config, options.profileKey);
  logCommand(spec, log);
  const { exitCode } = await runner(spec, { cwd: options.cwd, stdio: "inherit" });
  return exitCode;
}
