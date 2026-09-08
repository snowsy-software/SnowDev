import type { CommandSpec } from "./compose.js";

/** Quotes an argument for display only when it contains whitespace. */
function quote(value: string): string {
  return /\s/.test(value) ? JSON.stringify(value) : value;
}

/** Renders a command spec as a single copy-pasteable line. */
export function formatCommand(spec: CommandSpec): string {
  return [spec.command, ...spec.args].map(quote).join(" ");
}

/** Prints a command spec to stderr before it runs, so logs stay reproducible. */
export function logCommand(spec: CommandSpec, log: (line: string) => void = console.error): void {
  log(`$ ${formatCommand(spec)}`);
}
