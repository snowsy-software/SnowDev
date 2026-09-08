import { SnowDevError } from "../core/errors.js";
import type {
  Hook,
  HostProcessConfig,
  HttpHealthCheck,
  LifecycleHooks,
  ProfileConfig,
  SnowDevConfig,
  TaskConfig,
  WorkflowKind,
} from "../types/config.js";

const workflowKinds = new Set<WorkflowKind>([
  "compose-service",
  "host-app-with-compose-deps",
  "container-cli",
]);
function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new SnowDevError("E_CONFIG_INVALID", `${path} must be an object.`);
  return value as Record<string, unknown>;
}
function string(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0)
    throw new SnowDevError("E_CONFIG_INVALID", `${path} must be a non-empty string.`);
  return value;
}
function strings(value: unknown, path: string): string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== "string" || item.length === 0)
  )
    throw new SnowDevError("E_CONFIG_INVALID", `${path} must be a non-empty array of strings.`);
  return [...value] as string[];
}
function positiveInteger(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0)
    throw new SnowDevError("E_CONFIG_INVALID", `${path} must be a positive integer.`);
  return value;
}
function health(value: unknown, path: string): HttpHealthCheck {
  const input = record(value, path);
  return {
    url: string(input.url, `${path}.url`),
    timeoutMs:
      input.timeoutMs === undefined
        ? undefined
        : positiveInteger(input.timeoutMs, `${path}.timeoutMs`),
    intervalMs:
      input.intervalMs === undefined
        ? undefined
        : positiveInteger(input.intervalMs, `${path}.intervalMs`),
  };
}
function host(value: unknown, path: string): HostProcessConfig {
  const input = record(value, path);
  return {
    command: string(input.command, `${path}.command`),
    args: input.args === undefined ? undefined : strings(input.args, `${path}.args`),
    stopGraceSeconds:
      input.stopGraceSeconds === undefined
        ? undefined
        : positiveInteger(input.stopGraceSeconds, `${path}.stopGraceSeconds`),
  };
}
function profile(value: unknown, path: string): ProfileConfig {
  const input = record(value, path);
  const kind = string(input.kind, `${path}.kind`) as WorkflowKind;
  if (!workflowKinds.has(kind))
    throw new SnowDevError("E_CONFIG_INVALID", `${path}.kind is not a supported workflow kind.`);
  if (input.foreground !== undefined && typeof input.foreground !== "boolean")
    throw new SnowDevError("E_CONFIG_INVALID", `${path}.foreground must be a boolean.`);
  if (kind === "host-app-with-compose-deps" && input.host === undefined)
    throw new SnowDevError(
      "E_CONFIG_INVALID",
      `${path}.host is required for host-app-with-compose-deps profiles.`,
    );
  return {
    kind,
    services: strings(input.services, `${path}.services`),
    foreground: input.foreground as boolean | undefined,
    health: input.health === undefined ? undefined : health(input.health, `${path}.health`),
    host: input.host === undefined ? undefined : host(input.host, `${path}.host`),
  };
}
function func(value: unknown, path: string): Hook {
  if (typeof value !== "function")
    throw new SnowDevError("E_CONFIG_INVALID", `${path} must be a function.`);
  return value as Hook;
}
const lifecycleHookKeys = ["beforeRun", "afterDependenciesReady", "beforeDown"] as const;
function hooks(value: unknown, path: string): LifecycleHooks {
  const input = record(value, path);
  const known = new Set<string>([...lifecycleHookKeys, "task"]);
  for (const key of Object.keys(input))
    if (!known.has(key))
      throw new SnowDevError("E_CONFIG_INVALID", `${path}.${key} is not a supported hook.`);
  const result: LifecycleHooks = {};
  for (const key of lifecycleHookKeys)
    if (input[key] !== undefined) result[key] = func(input[key], `${path}.${key}`);
  if (input.task !== undefined)
    result.task = Object.fromEntries(
      Object.entries(record(input.task, `${path}.task`)).map(([name, item]) => [
        string(name, "task hook name"),
        func(item, `${path}.task.${name}`),
      ]),
    );
  return result;
}
function task(value: unknown, path: string): TaskConfig {
  const input = record(value, path);
  if (input.isolated !== true)
    throw new SnowDevError(
      "E_CONFIG_INVALID",
      `${path}.isolated must be true; Compose tasks always run in an isolated project.`,
    );
  return {
    profile: string(input.profile, `${path}.profile`),
    services: strings(input.services, `${path}.services`),
    isolated: true,
  };
}
/** Validates an untyped MJS default export and returns the typed configuration. */
export function validateConfig(value: unknown): SnowDevConfig {
  const input = record(value, "config");
  const compose = record(input.compose, "config.compose");
  const profilesInput = record(input.profiles, "config.profiles");
  const profiles = Object.fromEntries(
    Object.entries(profilesInput).map(([name, item]) => [
      string(name, "profile name"),
      profile(item, `config.profiles.${name}`),
    ]),
  );
  if (Object.keys(profiles).length === 0)
    throw new SnowDevError("E_CONFIG_INVALID", "config.profiles must define at least one profile.");
  const tasks =
    input.tasks === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(record(input.tasks, "config.tasks")).map(([name, item]) => [
            string(name, "task name"),
            task(item, `config.tasks.${name}`),
          ]),
        );
  const env =
    input.env === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(record(input.env, "config.env")).map(([key, item]) => [
            string(key, "environment variable name"),
            string(item, `config.env.${key}`),
          ]),
        );
  const configuredHooks =
    input.hooks === undefined ? undefined : hooks(input.hooks, "config.hooks");
  for (const name of Object.keys(configuredHooks?.task ?? {}))
    if (tasks && name in tasks)
      throw new SnowDevError(
        "E_CONFIG_INVALID",
        `config.hooks.task.${name} collides with config.tasks.${name}.`,
      );
  return {
    id: string(input.id, "config.id"),
    compose: {
      file: string(compose.file, "config.compose.file"),
      projectName: string(compose.projectName, "config.compose.projectName"),
    },
    profiles,
    tasks,
    env,
    hooks: configuredHooks,
  };
}
