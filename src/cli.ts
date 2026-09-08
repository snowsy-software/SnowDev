#!/usr/bin/env node

const packageName = "@snowdev/cli";

function printUsage(): void {
  console.log(`${packageName} ${process.env.npm_package_version ?? "0.0.0"}`);
  console.log("\nSnowDev is not configured yet. Run snowdev --help for command information.");
}

if (process.argv.includes("--version") || process.argv.includes("-v")) {
  console.log(process.env.npm_package_version ?? "0.0.0");
} else {
  printUsage();
}
