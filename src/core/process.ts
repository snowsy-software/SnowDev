import { spawn } from "node:child_process";
import type { CommandSpec } from "./compose.js";
export interface ProcessResult {
  exitCode: number;
}
export type ProcessRunner = (
  spec: CommandSpec,
  options?: { cwd?: string; env?: NodeJS.ProcessEnv; stdio?: "inherit" | "ignore" },
) => Promise<ProcessResult>;
export const runProcess: ProcessRunner = (spec, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(spec.command, spec.args, {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      stdio: options.stdio ?? "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("close", (exitCode) => resolve({ exitCode: exitCode ?? 1 }));
  });
