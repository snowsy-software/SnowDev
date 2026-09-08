import type { Hook, HookContext, ProfileConfig, SnowDevConfig } from "../types/config.js";
import { SnowDevError } from "./errors.js";
import { logCommand } from "./log.js";
import { runProcess, type ProcessRunner } from "./process.js";

/** Everything {@link runHook} needs to build a {@link HookContext} and run a hook. */
export interface HookRunOptions {
  config: SnowDevConfig;
  cwd: string;
  /** The profile or task key that triggered the hook. */
  key: string;
  /** Present when a profile triggered the hook. */
  profile?: ProfileConfig;
  /** Environment merged with SnowDev's fixed precedence for the active profile. */
  env: NodeJS.ProcessEnv;
  runner?: ProcessRunner;
  log?: (line: string) => void;
}

/**
 * Runs one custom lifecycle hook with a controlled context.
 *
 * A missing hook is a no-op. The hook's `exec` helper always uses an explicit
 * argument array and never a shell. Any thrown value is wrapped as a
 * `SnowDevError` with code `E_HOOK_FAILED` so callers abort with a stable code.
 */
export async function runHook(
  name: string,
  hook: Hook | undefined,
  options: HookRunOptions,
): Promise<void> {
  if (!hook) return;
  const log = options.log ?? console.error;
  const runner = options.runner ?? runProcess;
  const context: HookContext = {
    key: options.key,
    profile: options.profile,
    config: options.config,
    cwd: options.cwd,
    env: options.env,
    log,
    exec: async (command, args = [], execOptions = {}) => {
      const spec = { command, args: [...args] };
      logCommand(spec, log);
      const result = await runner(spec, {
        cwd: execOptions.cwd ?? options.cwd,
        env: execOptions.env ?? options.env,
        stdio: "inherit",
      });
      return { exitCode: result.exitCode };
    },
  };
  log(`▶ hook ${name}`);
  try {
    await hook(context);
  } catch (error) {
    throw new SnowDevError(
      "E_HOOK_FAILED",
      `hook "${name}" failed: ${error instanceof Error ? error.message : "unknown error"}`,
      error,
    );
  }
}
