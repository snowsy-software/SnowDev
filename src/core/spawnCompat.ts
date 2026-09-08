import { platform } from "node:os";

/**
 * Windows cannot launch a `.cmd` or `.bat` file directly through `child_process.spawn`:
 * the OS only knows how to run them via `cmd.exe`. Since the fix for CVE-2024-27980
 * (Node 18.20.2 / 20.12.2 / 21.7.3) Node rejects such a call with `spawn EINVAL` unless
 * `shell` is enabled, so it can no longer paper over the difference silently.
 *
 * Build wrappers ship as batch files on Windows (`mvnw.cmd`, `gradlew.bat`, `npm.cmd`),
 * so host processes and hooks hit this constantly. Returning `true` tells the caller to
 * spawn that command through a shell; every other command still runs shell-free.
 */
export function needsWindowsShell(command: string): boolean {
  return platform() === "win32" && /\.(cmd|bat)$/i.test(command.trim());
}
