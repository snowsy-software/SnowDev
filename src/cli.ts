#!/usr/bin/env node

import { runDoctor } from "./commands/doctor.js";
import { down } from "./commands/down.js";
import { init } from "./commands/init.js";
import { initTemplate } from "./commands/initTemplate.js";
import { logs } from "./commands/logs.js";
import { ps } from "./commands/ps.js";
import { reset } from "./commands/reset.js";
import { run } from "./commands/run.js";
import { task } from "./commands/task.js";
import { SnowDevError, formatError } from "./core/errors.js";

const packageName = "@snowdev/cli";
const version = process.env.npm_package_version ?? "0.0.0";

/** Prints the command help shown when no command is supplied. */
function printUsage(): void {
  console.log(`${packageName} ${version}`);
  console.log("\nUsage: snowdev <command> [profile] [options]");
  console.log(
    [
      "",
      "Commands:",
      "  run <profile>       Start a profile (foreground for long-running dev services)",
      "  down [profile]      Explicitly stop a profile (default: dev); never removes volumes",
      "  logs [profile]      Follow Compose logs (default: dev); pass --no-follow to print once",
      "  ps [profile]        Show container and host-process status (default: dev)",
      "  task <name>         Run a declared task in an isolated environment with cleanup",
      "  init [profile]      First-time setup for a profile (default: dev); requires --yes",
      "  init template [kind]  Scaffold snowdev.config.mjs + sample compose (never overwrites)",
      "  reset [profile]     Delete dev containers and volumes (dev only); requires --yes",
      "  doctor             Check Node, Docker, Compose, and project configuration",
    ].join("\n"),
  );
}

/** Splits raw args into positionals and the boolean flags SnowDev understands. */
function parse(args: readonly string[]): { positionals: string[]; yes: boolean; follow: boolean } {
  const positionals: string[] = [];
  let yes = false;
  let follow = true;
  for (const arg of args) {
    if (arg === "--yes" || arg === "-y") yes = true;
    else if (arg === "--no-follow") follow = false;
    else if (arg.startsWith("-"))
      throw new SnowDevError("E_INVALID_ARGUMENT", `Unknown option "${arg}".`);
    else positionals.push(arg);
  }
  return { positionals, yes, follow };
}

function requireProfile(positionals: readonly string[], command: string): string {
  if (positionals.length !== 1)
    throw new SnowDevError(
      "E_INVALID_ARGUMENT",
      `snowdev ${command} requires exactly one <profile>.`,
    );
  return positionals[0];
}

/** Parses top-level CLI arguments and dispatches the requested command. */
async function main(argv: readonly string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (command === undefined || command === "--help" || command === "-h") {
    printUsage();
    return 0;
  }
  if (command === "--version" || command === "-v") {
    console.log(version);
    return 0;
  }
  const { positionals, yes, follow } = parse(rest);
  const cwd = process.cwd();

  switch (command) {
    case "run":
      return run({ cwd, profileKey: requireProfile(positionals, "run") });
    case "down":
      return down({ cwd, profileKey: positionals[0] ?? "dev" });
    case "logs":
      return logs({ cwd, profileKey: positionals[0] ?? "dev", follow });
    case "ps":
      return ps({ cwd, profileKey: positionals[0] ?? "dev" });
    case "task":
      return task({ cwd, name: requireProfile(positionals, "task") });
    case "init":
      if (positionals[0] === "template") return initTemplate({ cwd, kind: positionals[1] });
      return init({ cwd, profileKey: positionals[0] ?? "dev", yes });
    case "reset":
      return reset({ cwd, profileKey: positionals[0] ?? "dev", yes });
    case "doctor": {
      if (positionals.length > 0)
        throw new SnowDevError("E_INVALID_ARGUMENT", "snowdev doctor does not accept arguments.");
      const result = await runDoctor(cwd);
      for (const check of result.checks)
        console.log(`${(check.ok ? "OK" : "FAIL").padEnd(4)} ${check.name}: ${check.message}`);
      return result.ok ? 0 : 1;
    }
    default:
      throw new SnowDevError(
        "E_COMMAND_UNAVAILABLE",
        `Command "${command}" is not available in this version.`,
      );
  }
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(formatError(error));
    process.exitCode = 1;
  });
