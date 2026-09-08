import { SnowDevError } from "../core/errors.js";
import type { ProfileConfig, SnowDevConfig, TaskConfig, WorkflowKind } from "../types/config.js";

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
function profile(value: unknown, path: string): ProfileConfig {
  const input = record(value, path);
  const kind = string(input.kind, `${path}.kind`) as WorkflowKind;
  if (!workflowKinds.has(kind))
    throw new SnowDevError("E_CONFIG_INVALID", `${path}.kind is not a supported workflow kind.`);
  if (input.foreground !== undefined && typeof input.foreground !== "boolean")
    throw new SnowDevError("E_CONFIG_INVALID", `${path}.foreground must be a boolean.`);
  return {
    kind,
    services: strings(input.services, `${path}.services`),
    foreground: input.foreground as boolean | undefined,
  };
}
function task(value: unknown, path: string): TaskConfig {
  const input = record(value, path);
  if (typeof input.isolated !== "boolean")
    throw new SnowDevError("E_CONFIG_INVALID", `${path}.isolated must be a boolean.`);
  return {
    profile: string(input.profile, `${path}.profile`),
    services: strings(input.services, `${path}.services`),
    isolated: input.isolated,
  };
}
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
  return {
    id: string(input.id, "config.id"),
    compose: {
      file: string(compose.file, "config.compose.file"),
      projectName: string(compose.projectName, "config.compose.projectName"),
    },
    profiles,
    tasks,
    env,
  };
}
