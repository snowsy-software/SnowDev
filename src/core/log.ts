import type { CommandSpec } from "./compose.js";

const secretArgument = /^(--?)(token|password|passwd|secret|api[-_]?key|authorization)(=)(.*)$/i;
const secretAssignment = /^(token|password|passwd|secret|api[-_]?key|authorization)(\s*=\s*)(.*)$/i;
const secretFlag = /^--?(token|password|passwd|secret|api[-_]?key|authorization)$/i;

/** Removes common secret values from an argument before it reaches command logs. */
function redactArgument(value: string, previous?: string): string {
  if (secretFlag.test(previous ?? "")) return "[REDACTED]";
  if (secretArgument.test(value)) return value.replace(secretArgument, "$1$2$3[REDACTED]");
  if (secretAssignment.test(value)) return value.replace(secretAssignment, "$1$2[REDACTED]");
  return value.replace(/^(Authorization:\s*)(.+)$/i, "$1[REDACTED]");
}

/** Quotes an argument for display only when it contains whitespace. */
function quote(value: string): string {
  return /\s/.test(value) ? JSON.stringify(value) : value;
}

/** Renders a command spec as a single copy-pasteable line. */
export function formatCommand(spec: CommandSpec): string {
  return [
    spec.command,
    ...spec.args.map((argument, index) => redactArgument(argument, spec.args[index - 1])),
  ]
    .map(quote)
    .join(" ");
}

/** Prints a command spec to stderr before it runs, so logs stay reproducible. */
export function logCommand(spec: CommandSpec, log: (line: string) => void = console.error): void {
  log(`$ ${formatCommand(spec)}`);
}
