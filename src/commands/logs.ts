import { loadConfig } from "../core/config.js";
import { logsCommand } from "../core/lifecycle.js";
import { logCommand } from "../core/log.js";
import { runProcess, type ProcessRunner } from "../core/process.js";

/** Inputs for the `logs` command. */
export interface LogsOptions {
  cwd: string;
  profileKey: string;
  follow?: boolean;
  runner?: ProcessRunner;
  log?: (line: string) => void;
}

/** Streams (and by default follows) the Compose logs for a profile's services. */
export async function logs(options: LogsOptions): Promise<number> {
  const runner = options.runner ?? runProcess;
  const { config } = await loadConfig(options.cwd);
  const spec = logsCommand(config, options.profileKey, options.follow ?? true);
  logCommand(spec, options.log ?? console.error);
  const { exitCode } = await runner(spec, { cwd: options.cwd, stdio: "inherit" });
  return exitCode;
}
