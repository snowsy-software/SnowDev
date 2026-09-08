import type { ComposeConfig } from "../types/config.js";
import { SnowDevError } from "./errors.js";

/** A command represented as an executable and already-separated arguments. */
export interface CommandSpec {
  command: string;
  args: string[];
}
/** Optional overrides for a single Compose invocation. */
export interface ComposeCommandOptions {
  /**
   * Replaces `compose.projectName` for this call only.
   *
   * Used by isolated tasks so their teardown can never touch dev or prod state.
   */
  projectName?: string;
}
function argument(value: string, name: string): string {
  if (value.trim().length === 0 || value.includes("\0"))
    throw new SnowDevError("E_COMPOSE_ARGUMENT", `${name} must be a non-empty safe string.`);
  return value;
}
/** Builds a shell-free `docker compose` invocation with explicit isolation arguments. */
export function composeCommand(
  compose: ComposeConfig,
  profile: string,
  command: readonly string[],
  options: ComposeCommandOptions = {},
): CommandSpec {
  return {
    command: "docker",
    args: [
      "compose",
      "--project-name",
      argument(options.projectName ?? compose.projectName, "compose.projectName"),
      "-f",
      argument(compose.file, "compose.file"),
      "--profile",
      argument(profile, "profile"),
      ...command,
    ],
  };
}
