import { spawn, type SpawnOptions } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { HostProcessConfig } from "../types/config.js";
import { SnowDevError } from "./errors.js";

/** Directory under a consuming project that holds SnowDev runtime state. */
export const stateDir = ".snowdev";

/** Persisted record describing a background host process. */
export interface HostProcessRecord {
  pid: number;
  command: string;
  args: string[];
  startedAt: string;
}
/** Result of inspecting a stored host process record. */
export interface HostProcessStatus {
  running: boolean;
  record?: HostProcessRecord;
}
/** Injectable OS hooks so lifecycle logic can be unit tested without real processes. */
export interface HostProcessDeps {
  spawn: typeof spawn;
  /** Returns true when a signal (including the `0` probe) was delivered. */
  kill: (pid: number, signal: NodeJS.Signals | 0) => boolean;
  sleep: (ms: number) => Promise<void>;
}
const defaultDeps: HostProcessDeps = {
  spawn,
  kill: (pid, signal) => {
    try {
      process.kill(pid, signal === 0 ? 0 : signal);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
      if ((error as NodeJS.ErrnoException).code === "EPERM") return true;
      throw error;
    }
  },
  sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
};

function recordPath(cwd: string, key: string): string {
  return resolve(cwd, stateDir, `${key}.host.json`);
}
async function readRecord(cwd: string, key: string): Promise<HostProcessRecord | undefined> {
  try {
    return JSON.parse(await readFile(recordPath(cwd, key), "utf8")) as HostProcessRecord;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new SnowDevError(
      "E_HOST_STATE",
      `Could not read host process state for "${key}".`,
      error,
    );
  }
}

/**
 * Launches the configured host process in the foreground and resolves with its exit code.
 *
 * The child stays attached to the terminal; its lifetime matches the CLI invocation,
 * so no PID file is written.
 */
export async function runHostForeground(
  host: HostProcessConfig,
  options: { cwd: string; env?: NodeJS.ProcessEnv; deps?: Partial<HostProcessDeps> },
): Promise<{ exitCode: number }> {
  const deps = { ...defaultDeps, ...options.deps };
  const spawnOptions: SpawnOptions = {
    cwd: options.cwd,
    env: options.env,
    shell: false,
    stdio: "inherit",
    windowsHide: true,
  };
  return new Promise((resolvePromise, reject) => {
    const child = deps.spawn(host.command, host.args ?? [], spawnOptions);
    child.once("error", reject);
    child.once("close", (exitCode) => resolvePromise({ exitCode: exitCode ?? 1 }));
  });
}

/**
 * Starts the configured host process detached and records its PID for later status/stop.
 *
 * Refuses to start a second copy while a recorded process is still alive.
 */
export async function startHostBackground(
  host: HostProcessConfig,
  options: { cwd: string; key: string; env?: NodeJS.ProcessEnv; deps?: Partial<HostProcessDeps> },
): Promise<HostProcessRecord> {
  const deps = { ...defaultDeps, ...options.deps };
  const existing = await readRecord(options.cwd, options.key);
  if (existing && deps.kill(existing.pid, 0))
    throw new SnowDevError(
      "E_HOST_ALREADY_RUNNING",
      `A host process for "${options.key}" is already running (pid ${existing.pid}).`,
    );
  const child = deps.spawn(host.command, host.args ?? [], {
    cwd: options.cwd,
    env: options.env,
    shell: false,
    stdio: "ignore",
    detached: true,
    windowsHide: true,
  });
  child.unref();
  if (typeof child.pid !== "number")
    throw new SnowDevError("E_HOST_SPAWN", `Host process for "${options.key}" did not start.`);
  const record: HostProcessRecord = {
    pid: child.pid,
    command: host.command,
    args: host.args ?? [],
    startedAt: new Date().toISOString(),
  };
  await mkdir(resolve(options.cwd, stateDir), { recursive: true });
  await writeFile(recordPath(options.cwd, options.key), `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

/** Reports whether the recorded host process for a key is still alive. */
export async function hostStatus(options: {
  cwd: string;
  key: string;
  deps?: Partial<HostProcessDeps>;
}): Promise<HostProcessStatus> {
  const deps = { ...defaultDeps, ...options.deps };
  const record = await readRecord(options.cwd, options.key);
  if (!record) return { running: false };
  return { running: deps.kill(record.pid, 0), record };
}

/**
 * Stops the recorded host process: SIGTERM, wait for the grace period, then SIGKILL.
 *
 * Always removes the PID file afterwards so status reflects the stopped state.
 */
export async function stopHostBackground(options: {
  cwd: string;
  key: string;
  graceSeconds?: number;
  deps?: Partial<HostProcessDeps>;
}): Promise<{ stopped: boolean }> {
  const deps = { ...defaultDeps, ...options.deps };
  const record = await readRecord(options.cwd, options.key);
  if (!record) return { stopped: false };
  const graceMs = (options.graceSeconds ?? 10) * 1_000;
  const step = 200;
  try {
    if (deps.kill(record.pid, 0)) {
      deps.kill(record.pid, "SIGTERM");
      for (let waited = 0; waited < graceMs && deps.kill(record.pid, 0); waited += step)
        await deps.sleep(step);
      if (deps.kill(record.pid, 0)) deps.kill(record.pid, "SIGKILL");
    }
  } finally {
    await rm(recordPath(options.cwd, options.key), { force: true });
  }
  return { stopped: true };
}
