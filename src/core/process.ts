import { spawn } from "node:child_process";
import type { CommandSpec } from "./compose.js";
import { needsWindowsShell } from "./spawnCompat.js";
/** Result reported after a child process exits. */
export interface ProcessResult {
  exitCode: number;
  /** Captured standard output. Only populated when `capture` is requested. */
  stdout?: string;
}
/** Options accepted by a process runner. */
export interface ProcessOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  stdio?: "inherit" | "ignore";
  /** When true, capture stdout instead of forwarding it, and return it on the result. */
  capture?: boolean;
}
/** Executes a command specification, optionally allowing callers to replace it in tests. */
export type ProcessRunner = (spec: CommandSpec, options?: ProcessOptions) => Promise<ProcessResult>;
/**
 * Runs a command, preserving argument boundaries on every platform.
 *
 * Stays shell-free except for Windows `.cmd`/`.bat` commands, which the OS can only
 * launch through `cmd.exe`; see {@link needsWindowsShell}.
 */
export const runProcess: ProcessRunner = (spec, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(spec.command, spec.args, {
      cwd: options.cwd,
      env: options.env,
      shell: needsWindowsShell(spec.command),
      stdio: options.capture ? ["ignore", "pipe", "inherit"] : (options.stdio ?? "inherit"),
      windowsHide: true,
    });
    let stdout = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.once("error", reject);
    child.once("close", (exitCode) =>
      resolve(options.capture ? { exitCode: exitCode ?? 1, stdout } : { exitCode: exitCode ?? 1 }),
    );
  });
