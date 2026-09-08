import { SnowDevError } from "./errors.js";

/**
 * Profile names that must never be the target of a data-destroying command.
 *
 * Matched case-insensitively so `Prod`, `STAGING`, etc. are covered too.
 */
const protectedProfiles = new Set(["stag", "staging", "prod", "production", "preprod", "release"]);

/** Returns whether a profile name is protected from volume deletion and resets. */
export function isProtectedProfile(profile: string): boolean {
  return protectedProfiles.has(profile.trim().toLowerCase());
}

/**
 * Rejects any attempt to reset a non-dev profile.
 *
 * Volume deletion is only ever allowed for `reset dev --yes`; staging and
 * production data must be recreated through their own deploy pipelines.
 */
export function assertResettableProfile(profile: string): void {
  if (profile !== "dev")
    throw new SnowDevError(
      "E_RESET_PROFILE_FORBIDDEN",
      `reset only operates on the "dev" profile; refusing to reset "${profile}".`,
    );
}

/**
 * Fails fast when a lifecycle command tries to emit an implicit teardown.
 *
 * `run stag` and `run prod` must never run `docker compose down`; only the
 * explicit `down` and `reset` commands may stop or delete an environment.
 */
export function assertNoImplicitDown(profile: string, args: readonly string[]): void {
  if (args.includes("down"))
    throw new SnowDevError(
      "E_IMPLICIT_DOWN",
      `run "${profile}" attempted an implicit "docker compose down", which is forbidden.`,
    );
}

/** Prints the impact of a destructive command and requires explicit confirmation. */
export function confirmDestructive(
  action: string,
  impact: readonly string[],
  yes: boolean,
  log: (line: string) => void = console.error,
): void {
  log(`${action} will:`);
  for (const line of impact) log(`  - ${line}`);
  if (!yes)
    throw new SnowDevError(
      "E_CONFIRMATION_REQUIRED",
      `${action} is destructive; re-run with --yes to proceed.`,
    );
  log(`${action}: proceeding because --yes was passed.`);
}
