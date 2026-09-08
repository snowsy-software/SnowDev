#!/usr/bin/env node

import { runDoctor } from "./commands/doctor.js";
import { SnowDevError, formatError } from "./core/errors.js";

const packageName = "@snowdev/cli";
const version = process.env.npm_package_version ?? "0.0.0";

function printUsage(): void {
  console.log(`${packageName} ${version}`);
  console.log("\nUsage: snowdev <command>");
  console.log("\nCommands:\n  doctor  Check Node, Docker, Compose, and project configuration");
}

async function main(argv: readonly string[]): Promise<void> {
  const [command, ...args] = argv;
  if (command === undefined || command === "--help" || command === "-h") return printUsage();
  if (command === "--version" || command === "-v") return console.log(version);
  if (command !== "doctor")
    throw new SnowDevError(
      "E_COMMAND_UNAVAILABLE",
      `Command "${command}" is not available in this version.`,
    );
  if (args.length > 0)
    throw new SnowDevError("E_INVALID_ARGUMENT", "snowdev doctor does not accept arguments.");
  const result = await runDoctor(process.cwd());
  for (const check of result.checks)
    console.log(`${(check.ok ? "OK" : "FAIL").padEnd(4)} ${check.name}: ${check.message}`);
  if (!result.ok) process.exitCode = 1;
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
