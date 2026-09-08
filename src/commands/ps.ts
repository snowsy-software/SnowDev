import { loadConfig } from "../core/config.js";
import { hostStatus, type HostProcessDeps } from "../core/hostProcess.js";
import { psCommand } from "../core/lifecycle.js";
import { logCommand } from "../core/log.js";
import { runProcess, type ProcessRunner } from "../core/process.js";

/** Inputs for the `ps` command. */
export interface PsOptions {
  cwd: string;
  profileKey: string;
  runner?: ProcessRunner;
  hostDeps?: Partial<HostProcessDeps>;
  log?: (line: string) => void;
}

/** Shows container status for a profile, plus any recorded host process. */
export async function ps(options: PsOptions): Promise<number> {
  const runner = options.runner ?? runProcess;
  const log = options.log ?? console.error;
  const { config } = await loadConfig(options.cwd);
  const profile = config.profiles[options.profileKey];
  const spec = psCommand(config, options.profileKey);
  logCommand(spec, log);
  const { exitCode } = await runner(spec, { cwd: options.cwd, stdio: "inherit" });
  if (profile?.kind === "host-app-with-compose-deps") {
    const key = `${config.compose.projectName}-${options.profileKey}`;
    const status = await hostStatus({ cwd: options.cwd, key, deps: options.hostDeps });
    log(
      status.record
        ? `host process ${key}: ${status.running ? "running" : "stopped"} (pid ${status.record.pid})`
        : `host process ${key}: not started`,
    );
  }
  return exitCode;
}
