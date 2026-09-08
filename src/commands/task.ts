import { loadConfig } from "../core/config.js";
import { loadEnvironment } from "../core/env.js";
import { SnowDevError } from "../core/errors.js";
import { runHook } from "../core/hooks.js";
import { taskPlan } from "../core/lifecycle.js";
import { logCommand } from "../core/log.js";
import { runProcess, type ProcessRunner } from "../core/process.js";

/** Inputs for the `task` command. */
export interface TaskOptions {
  cwd: string;
  name: string;
  runner?: ProcessRunner;
  log?: (line: string) => void;
}

/**
 * Runs a declared task and always tears its environment down afterwards.
 *
 * Isolated tasks use a Compose project name distinct from every profile, so their
 * `finally` cleanup — which removes volumes — can never affect `dev` or `prod` data.
 */
export async function task(options: TaskOptions): Promise<number> {
  const log = options.log ?? console.error;
  const runner = options.runner ?? runProcess;
  const { config } = await loadConfig(options.cwd);
  const declared = config.tasks?.[options.name];
  if (!declared) {
    const hook = config.hooks?.task?.[options.name];
    if (!hook)
      throw new SnowDevError("E_TASK_NOT_FOUND", `No task "${options.name}" in configuration.`);
    const env = await loadEnvironment(options.cwd, options.name, config.env);
    await runHook(`task:${options.name}`, hook, {
      config,
      cwd: options.cwd,
      key: options.name,
      env,
      runner,
      log,
    });
    return 0;
  }
  const plan = taskPlan(config, options.name, declared);
  const env = await loadEnvironment(options.cwd, declared.profile, config.env);
  log(
    `task ${options.name}: Compose project "${plan.projectName}"${plan.isolated ? " (isolated)" : ""}`,
  );

  logCommand(plan.up, log);
  const started = await runner(plan.up, { cwd: options.cwd, env, stdio: "inherit" });
  if (started.exitCode !== 0) {
    await teardown();
    return started.exitCode;
  }
  try {
    logCommand(plan.run, log);
    const result = await runner(plan.run, { cwd: options.cwd, env, stdio: "inherit" });
    return result.exitCode;
  } finally {
    await teardown();
  }

  async function teardown(): Promise<void> {
    logCommand(plan.cleanup, log);
    const result = await runner(plan.cleanup, { cwd: options.cwd, env, stdio: "inherit" });
    if (result.exitCode !== 0)
      log(
        `task ${options.name}: cleanup exited with ${result.exitCode}; check "${plan.projectName}".`,
      );
  }
}
