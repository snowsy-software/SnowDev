import type { ProfileConfig, SnowDevConfig, TaskConfig } from "../types/config.js";
import { composeCommand, type CommandSpec } from "./compose.js";
import { SnowDevError } from "./errors.js";
import { assertNoImplicitDown } from "./safety.js";

/** Whether a profile keeps its long-running services attached to the terminal. */
export function isForeground(profileKey: string, profile: ProfileConfig): boolean {
  return profile.foreground ?? profileKey === "dev";
}

/** Builds the Compose project name reserved for one runtime profile. */
export function profileProjectName(config: SnowDevConfig, profileKey: string): string {
  return `${config.compose.projectName}-${profileKey}`;
}

function profileCompose(
  config: SnowDevConfig,
  profileKey: string,
  command: readonly string[],
): CommandSpec {
  return composeCommand(config.compose, profileKey, command, {
    projectName: profileProjectName(config, profileKey),
  });
}

/**
 * Builds the Compose command(s) that start a profile.
 *
 * `compose-service` foreground profiles attach with a plain `up`; background
 * profiles build and detach. `host-app-with-compose-deps` only starts the
 * dependency services detached (the app itself runs on the host). `container-cli`
 * profiles issue one `run --rm` per service. None of these ever emit `down`.
 */
export function startCommands(config: SnowDevConfig, profileKey: string): CommandSpec[] {
  const profile = config.profiles[profileKey];
  if (!profile)
    throw new SnowDevError("E_PROFILE_NOT_FOUND", `No profile "${profileKey}" in configuration.`);
  const build = (args: string[]): CommandSpec => {
    const spec = profileCompose(config, profileKey, args);
    assertNoImplicitDown(profileKey, spec.args);
    return spec;
  };
  if (profile.kind === "container-cli")
    return profile.services.map((service) => build(["run", "--rm", service]));
  if (profile.kind === "host-app-with-compose-deps")
    return [build(["up", "-d", ...profile.services])];
  if (isForeground(profileKey, profile)) return [build(["up", ...profile.services])];
  return [build(["up", "-d", "--build", ...profile.services])];
}

/** Builds the explicit `down` command for a profile. Never deletes volumes. */
export function downCommand(config: SnowDevConfig, profileKey: string): CommandSpec {
  if (!config.profiles[profileKey])
    throw new SnowDevError("E_PROFILE_NOT_FOUND", `No profile "${profileKey}" in configuration.`);
  return profileCompose(config, profileKey, ["down", "--remove-orphans"]);
}

/** Builds the `logs` command, following output by default. */
export function logsCommand(config: SnowDevConfig, profileKey: string, follow = true): CommandSpec {
  const profile = config.profiles[profileKey];
  if (!profile)
    throw new SnowDevError("E_PROFILE_NOT_FOUND", `No profile "${profileKey}" in configuration.`);
  return profileCompose(config, profileKey, [
    "logs",
    ...(follow ? ["-f"] : []),
    ...profile.services,
  ]);
}

/**
 * Builds the volume-deleting teardown for `reset`.
 *
 * This is the only place SnowDev passes `--volumes` to a runtime profile project,
 * and callers must have already checked {@link assertResettableProfile}.
 */
export function resetCommand(config: SnowDevConfig, profileKey: string): CommandSpec {
  if (!config.profiles[profileKey])
    throw new SnowDevError("E_PROFILE_NOT_FOUND", `No profile "${profileKey}" in configuration.`);
  return profileCompose(config, profileKey, ["down", "--volumes", "--remove-orphans"]);
}

/** Builds the `ps` command for a profile. */
export function psCommand(config: SnowDevConfig, profileKey: string): CommandSpec {
  const profile = config.profiles[profileKey];
  if (!profile)
    throw new SnowDevError("E_PROFILE_NOT_FOUND", `No profile "${profileKey}" in configuration.`);
  return profileCompose(config, profileKey, ["ps", ...profile.services]);
}

/**
 * Builds the isolated Compose project name for a task.
 *
 * Isolated tasks never share a project name with `dev` (or any profile), so their
 * teardown — including volume removal — cannot touch development or production data.
 */
export function taskProjectName(config: SnowDevConfig, taskName: string): string {
  return `${config.compose.projectName}-task-${taskName}`;
}

/** Commands that run and then tear down a task, in order. */
export interface TaskPlan {
  /** Compose project name used for every command below. */
  projectName: string;
  /** Whether this plan runs against an isolated Compose project. */
  isolated: boolean;
  /** Brings the task services up with a fresh build. */
  up: CommandSpec;
  /** Runs the task's first service one-off and reports its exit code. */
  run: CommandSpec;
  /**
   * Teardown that must run in a `finally`.
   *
   * Task plans always remove volumes because their project is disposable.
   */
  cleanup: CommandSpec;
}
/** Builds the full lifecycle plan for a declared task. */
export function taskPlan(config: SnowDevConfig, taskName: string, task: TaskConfig): TaskPlan {
  const projectName = taskProjectName(config, taskName);
  const overrides = { projectName };
  const cleanupArgs = ["down", "--volumes", "--remove-orphans"];
  return {
    projectName,
    isolated: true,
    up: composeCommand(
      config.compose,
      task.profile,
      ["up", "-d", "--build", ...task.services],
      overrides,
    ),
    run: composeCommand(config.compose, task.profile, ["run", "--rm", task.services[0]], overrides),
    cleanup: composeCommand(config.compose, task.profile, cleanupArgs, overrides),
  };
}
