import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig } from "../core/config.js";
import { loadEnvironment } from "../core/env.js";
import { SnowDevError } from "../core/errors.js";
import { composeCommand } from "../core/compose.js";
import { stateDir } from "../core/hostProcess.js";
import { logCommand } from "../core/log.js";
import { runProcess, type ProcessRunner } from "../core/process.js";
import { confirmDestructive } from "../core/safety.js";

/** Inputs for the `init` command. */
export interface InitOptions {
  cwd: string;
  /** Profile to initialise. Defaults to `dev`. */
  profileKey?: string;
  /** Required acknowledgement for the first-time setup actions. */
  yes: boolean;
  runner?: ProcessRunner;
  log?: (line: string) => void;
}

/**
 * Performs explicit first-time setup for a profile.
 *
 * Creates the `.snowdev/` state directory and builds/starts the profile's services
 * once. It never seeds data implicitly and requires `--yes` so it cannot run
 * unattended without acknowledgement.
 */
export async function init(options: InitOptions): Promise<number> {
  const log = options.log ?? console.error;
  const profileKey = options.profileKey ?? "dev";
  const { config } = await loadConfig(options.cwd);
  const profile = config.profiles[profileKey];
  if (!profile)
    throw new SnowDevError("E_PROFILE_NOT_FOUND", `No profile "${profileKey}" in configuration.`);
  confirmDestructive(
    `init ${profileKey}`,
    [
      `create the ${stateDir}/ directory in ${options.cwd}`,
      `build and start Compose services: ${profile.services.join(", ")}`,
    ],
    options.yes,
    log,
  );
  await mkdir(resolve(options.cwd, stateDir), { recursive: true });
  const env = await loadEnvironment(options.cwd, profileKey, config.env);
  const spec = composeCommand(config.compose, profileKey, [
    "up",
    "-d",
    "--build",
    ...profile.services,
  ]);
  const runner = options.runner ?? runProcess;
  logCommand(spec, log);
  const { exitCode } = await runner(spec, { cwd: options.cwd, env, stdio: "inherit" });
  return exitCode;
}
