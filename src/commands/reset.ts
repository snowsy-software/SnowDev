import { loadConfig } from "../core/config.js";
import { resetCommand } from "../core/lifecycle.js";
import { logCommand } from "../core/log.js";
import { runProcess, type ProcessRunner } from "../core/process.js";
import { assertResettableProfile, confirmDestructive } from "../core/safety.js";

/** Inputs for the `reset` command. */
export interface ResetOptions {
  cwd: string;
  /** Profile to reset. Only `dev` is permitted. Defaults to `dev`. */
  profileKey?: string;
  /** Required acknowledgement; without it the command fails before doing anything. */
  yes: boolean;
  runner?: ProcessRunner;
  log?: (line: string) => void;
}

/**
 * Deletes the development environment's containers and volumes.
 *
 * Refuses any profile other than `dev` and refuses to run at all without `--yes`.
 */
export async function reset(options: ResetOptions): Promise<number> {
  const log = options.log ?? console.error;
  const profileKey = options.profileKey ?? "dev";
  assertResettableProfile(profileKey);
  const { config } = await loadConfig(options.cwd);
  const spec = resetCommand(config, profileKey);
  confirmDestructive(
    `reset ${profileKey}`,
    [
      `stop and remove containers for Compose project "${config.compose.projectName}"`,
      `delete named volumes for the "${profileKey}" profile (local data will be lost)`,
      "remove orphaned containers from earlier configurations",
    ],
    options.yes,
    log,
  );
  const runner = options.runner ?? runProcess;
  logCommand(spec, log);
  const { exitCode } = await runner(spec, { cwd: options.cwd, stdio: "inherit" });
  return exitCode;
}
