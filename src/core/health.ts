import type { ComposeConfig, HttpHealthCheck } from "../types/config.js";
import { composeCommand, type ComposeCommandOptions } from "./compose.js";
import { SnowDevError } from "./errors.js";
import { runProcess, type ProcessRunner } from "./process.js";

/** Minimal fetch surface needed to probe an HTTP endpoint. */
export type HttpProbe = (url: string, init: { signal: AbortSignal }) => Promise<{ status: number }>;
/** Pluggable delay, overridden in tests to avoid real waiting. */
export type Sleep = (ms: number) => Promise<void>;

const defaultSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Polls an HTTP endpoint until it answers with a non-5xx status or the timeout elapses.
 *
 * On timeout the thrown error names the last observed status or transport error so
 * callers can surface an actionable diagnostic instead of a bare "not ready".
 */
export async function waitForHttp(
  check: HttpHealthCheck,
  options: { probe?: HttpProbe; sleep?: Sleep; now?: () => number } = {},
): Promise<void> {
  const probe = options.probe ?? ((url, init) => fetch(url, init));
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const timeoutMs = check.timeoutMs ?? 60_000;
  const intervalMs = check.intervalMs ?? 1_000;
  const deadline = now() + timeoutMs;
  let lastReason = "no attempt completed";
  for (let attempt = 1; ; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), intervalMs);
    try {
      const response = await probe(check.url, { signal: controller.signal });
      if (response.status < 500) return;
      lastReason = `HTTP ${response.status}`;
    } catch (error) {
      lastReason = error instanceof Error ? error.message : "request failed";
    } finally {
      clearTimeout(timer);
    }
    if (now() >= deadline)
      throw new SnowDevError(
        "E_HEALTH_TIMEOUT",
        `${check.url} did not become healthy within ${timeoutMs}ms (last: ${lastReason}, ${attempt} attempt(s)).`,
      );
    await sleep(intervalMs);
  }
}

/** Health state of a single Compose service, as reported by `docker compose ps`. */
export interface ServiceHealth {
  name: string;
  state: string;
  health?: string;
}

/** Parses `docker compose ps --format json` (JSON array or newline-delimited objects). */
export function parseComposePs(stdout: string): ServiceHealth[] {
  const text = stdout.trim();
  if (text.length === 0) return [];
  const rows: unknown[] = text.startsWith("[")
    ? (JSON.parse(text) as unknown[])
    : text
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as unknown);
  return rows.map((row) => {
    const entry = row as Record<string, unknown>;
    return {
      name: String(entry.Service ?? entry.Name ?? "unknown"),
      state: String(entry.State ?? "unknown"),
      health: entry.Health === undefined || entry.Health === "" ? undefined : String(entry.Health),
    };
  });
}

/**
 * Waits until every requested service reports a running, non-unhealthy state.
 *
 * A service with no declared Docker healthcheck only needs to be `running`; one
 * with a healthcheck must additionally report `healthy`.
 */
export async function waitForComposeHealthy(
  compose: ComposeConfig,
  profile: string,
  services: readonly string[],
  options: {
    runner?: ProcessRunner;
    cwd?: string;
    timeoutMs?: number;
    intervalMs?: number;
    sleep?: Sleep;
    now?: () => number;
    compose?: ComposeCommandOptions;
  } = {},
): Promise<void> {
  const runner = options.runner ?? runProcess;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const intervalMs = options.intervalMs ?? 1_000;
  const deadline = now() + timeoutMs;
  const spec = composeCommand(compose, profile, ["ps", "--format", "json"], options.compose);
  let lastReport = "no status yet";
  for (;;) {
    const result = await runner(spec, { cwd: options.cwd, capture: true });
    if (result.exitCode === 0) {
      const statuses = parseComposePs(result.stdout ?? "");
      const pending = services.filter((service) => {
        const status = statuses.find((entry) => entry.name === service);
        if (!status) return true;
        if (status.state !== "running") return true;
        return status.health !== undefined && status.health !== "healthy";
      });
      if (pending.length === 0) return;
      lastReport = services
        .map((service) => {
          const status = statuses.find((entry) => entry.name === service);
          return `${service}=${status ? (status.health ?? status.state) : "absent"}`;
        })
        .join(", ");
    } else {
      lastReport = `docker compose ps exited with ${result.exitCode}`;
    }
    if (now() >= deadline)
      throw new SnowDevError(
        "E_HEALTH_TIMEOUT",
        `Compose services did not become healthy within ${timeoutMs}ms (${lastReport}).`,
      );
    await sleep(intervalMs);
  }
}
