import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { composeCommand } from "../src/core/compose.js";
import { loadEnvironment, parseEnv, redactEnvironment } from "../src/core/env.js";
import { validateConfig } from "../src/schema/config.js";
import { runDoctor } from "../src/commands/doctor.js";
import { loadConfig } from "../src/core/config.js";
import { formatCommand } from "../src/core/log.js";
import { needsWindowsShell } from "../src/core/spawnCompat.js";

const fixtures = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("Compose command construction", () => {
  it.each(["compose-service", "hybrid-host-service", "container-cli"])(
    "builds portable arguments for %s",
    async (fixture) => {
      const { config } = await loadConfig(resolve(fixtures, fixture));
      const command = composeCommand(config.compose, "dev", ["up", "--build", "app service"]);
      expect(command).toEqual({
        command: "docker",
        args: [
          "compose",
          "--project-name",
          config.compose.projectName,
          "-f",
          "docker/compose.yml",
          "--profile",
          "dev",
          "up",
          "--build",
          "app service",
        ],
      });
      expect(command.args.join(" ")).not.toContain("powershell");
    },
  );
});

describe("configuration schema", () => {
  it("accepts all Phase 1 workflow kinds", () => {
    for (const kind of [
      "compose-service",
      "host-app-with-compose-deps",
      "container-cli",
    ] as const) {
      expect(
        validateConfig({
          id: "example",
          compose: { file: "docker/compose.yml", projectName: "example" },
          profiles: {
            dev: {
              kind,
              services: ["app"],
              ...(kind === "host-app-with-compose-deps" ? { host: { command: "node" } } : {}),
            },
          },
        }).profiles.dev.kind,
      ).toBe(kind);
    }
  });
  it("rejects an unknown workflow kind", () => {
    expect(() =>
      validateConfig({
        id: "example",
        compose: { file: "docker/compose.yml", projectName: "example" },
        profiles: { dev: { kind: "unknown", services: ["app"] } },
      }),
    ).toThrow(/supported workflow kind/);
  });
});

describe("environment loading", () => {
  it("uses the documented precedence and redacts secret values", async () => {
    const cwd = await mkdtemp(resolve(tmpdir(), "snowdev-env-"));
    try {
      await Promise.all([
        writeFile(resolve(cwd, ".env"), "VALUE=base\n"),
        writeFile(resolve(cwd, ".env.dev"), "VALUE=profile\n"),
        writeFile(resolve(cwd, ".env.local"), "VALUE=local\n"),
        writeFile(
          resolve(cwd, ".env.dev.local"),
          "VALUE=profile-local\nPROFILE_LOCAL=profile-local\n",
        ),
      ]);
      const env = await loadEnvironment(
        cwd,
        "dev",
        { VALUE: "default" },
        { VALUE: "process", PROCESS_ONLY: "yes" },
      );
      expect(env.VALUE).toBe("process");
      expect(env.PROFILE_LOCAL).toBe("profile-local");
      expect(parseEnv("export NAME=value # note\nQUOTED='hello world'\n")).toEqual({
        NAME: "value",
        QUOTED: "hello world",
      });
      expect(redactEnvironment({ API_TOKEN: "secret", NAME: "visible" })).toEqual({
        API_TOKEN: "[REDACTED]",
        NAME: "visible",
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

describe("command logging", () => {
  it("redacts secret values while retaining safe arguments", () => {
    expect(
      formatCommand({
        command: "tool",
        args: ["--token", "hidden", "API_KEY=also-hidden", "Authorization: Bearer hidden", "safe"],
      }),
    ).toBe('tool --token [REDACTED] API_KEY=[REDACTED] "Authorization: [REDACTED]" safe');
  });
});

describe("Windows shell compatibility", () => {
  const onWindows = process.platform === "win32";

  it("routes .cmd and .bat commands through a shell only on Windows", () => {
    expect(needsWindowsShell("mvnw.cmd")).toBe(onWindows);
    expect(needsWindowsShell("gradlew.BAT")).toBe(onWindows);
  });

  it("never shells out for real executables or extension-less commands", () => {
    expect(needsWindowsShell("mvn")).toBe(false);
    expect(needsWindowsShell("node")).toBe(false);
    expect(needsWindowsShell("docker.exe")).toBe(false);
    expect(needsWindowsShell("./scripts/build.sh")).toBe(false);
  });
});

describe("doctor", () => {
  it("checks a fixture without invoking a shell", async () => {
    const calls: string[] = [];
    const result = await runDoctor(
      resolve(fixtures, "compose-service"),
      async (spec) => {
        calls.push(`${spec.command}:${spec.args.join("|")}`);
        return { exitCode: 0 };
      },
      "v20.19.0",
    );
    expect(result.ok).toBe(true);
    expect(calls).toEqual([
      "docker:--version",
      "docker:compose|--project-name|fixture-compose-dev|-f|docker/compose.yml|--profile|dev|version",
    ]);
  });
});
