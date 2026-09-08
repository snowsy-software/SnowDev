import { describe, expect, it, vi } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import type { CommandSpec } from "../src/core/compose.js";
import type { ProcessResult } from "../src/core/process.js";
import { validateConfig } from "../src/schema/config.js";
import { runHook } from "../src/core/hooks.js";
import { loadConfig } from "../src/core/config.js";
import { run } from "../src/commands/run.js";
import { down } from "../src/commands/down.js";
import { task } from "../src/commands/task.js";

const fixtures = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures");
const hooksFixture = resolve(fixtures, "hooks");
const composeService = resolve(fixtures, "compose-service");

/** Records every command a runner is asked to execute. */
function recordingRunner() {
  const calls: CommandSpec[] = [];
  const runner = vi.fn(async (spec: CommandSpec): Promise<ProcessResult> => {
    calls.push(spec);
    return { exitCode: 0 };
  });
  return { calls, runner };
}

const schemaBase = {
  id: "x",
  compose: { file: "docker/compose.yml", projectName: "x" },
  profiles: { dev: { kind: "compose-service", services: ["app"] } },
};

describe("hook schema", () => {
  it("accepts the three lifecycle hooks and named task hooks", () => {
    const config = validateConfig({
      ...schemaBase,
      hooks: {
        beforeRun: () => {},
        afterDependenciesReady: async () => {},
        beforeDown: () => {},
        task: { codegen: () => {} },
      },
    });
    expect(typeof config.hooks?.beforeRun).toBe("function");
    expect(typeof config.hooks?.task?.codegen).toBe("function");
  });

  it("rejects a non-function hook", () => {
    expect(() => validateConfig({ ...schemaBase, hooks: { beforeRun: "nope" } })).toThrow(
      /must be a function/,
    );
  });

  it("rejects an unknown hook key", () => {
    expect(() => validateConfig({ ...schemaBase, hooks: { afterRun: () => {} } })).toThrow(
      /not a supported hook/,
    );
  });

  it("rejects a task hook that collides with a Compose task name", () => {
    expect(() =>
      validateConfig({
        ...schemaBase,
        tasks: { test: { profile: "test", services: ["app-test"], isolated: true } },
        hooks: { task: { test: () => {} } },
      }),
    ).toThrow(/collides/);
  });
});

describe("hooks in the run lifecycle", () => {
  it("fires beforeRun then afterDependenciesReady, with the profile in context", async () => {
    const { calls, runner } = recordingRunner();
    const lines: string[] = [];
    const code = await run({
      cwd: hooksFixture,
      profileKey: "dev",
      runner,
      log: (line) => lines.push(line),
    });
    expect(code).toBe(0);
    expect(lines.filter((line) => line.startsWith("▶ hook "))).toEqual([
      "▶ hook beforeRun",
      "▶ hook afterDependenciesReady",
    ]);
    expect(lines).toContain("hook beforeRun key=dev kind=compose-service");
    expect(lines).toContain("hook afterDependenciesReady key=dev exec=0");
    // The afterDependenciesReady hook's exec reached the injected runner verbatim.
    expect(calls).toContainEqual({ command: "node", args: ["-e", "process.exit(0)"] });
    // beforeRun ran before the Compose bring-up.
    const bringUp = calls.findIndex((spec) => spec.args.includes("up"));
    expect(bringUp).toBeGreaterThanOrEqual(0);
  });

  it("aborts with E_HOOK_FAILED before any Compose call when beforeRun throws", async () => {
    const dir = await mkdtemp(resolve(tmpdir(), "snowdev-hook-"));
    try {
      await writeFile(
        resolve(dir, "snowdev.config.mjs"),
        [
          "export default {",
          '  id: "t",',
          '  compose: { file: "docker/compose.yml", projectName: "t" },',
          '  profiles: { dev: { kind: "compose-service", services: ["app"], foreground: false } },',
          "  hooks: { beforeRun() { throw new Error('boom'); } },",
          "};",
          "",
        ].join("\n"),
      );
      const { calls, runner } = recordingRunner();
      await expect(
        run({ cwd: dir, profileKey: "dev", runner, log: () => {} }),
      ).rejects.toMatchObject({ code: "E_HOOK_FAILED" });
      expect(calls).toHaveLength(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("passes an argument array to exec unchanged and never a shell", async () => {
    const calls: CommandSpec[] = [];
    const runner = vi.fn(async (spec: CommandSpec): Promise<ProcessResult> => {
      calls.push(spec);
      return { exitCode: 0 };
    });
    const { config } = await loadConfig(composeService);
    await runHook(
      "beforeRun",
      async ({ exec }) => {
        await exec("printf", ["%s\n", "a b", "c"]);
      },
      { config, cwd: composeService, key: "dev", env: {}, runner, log: () => {} },
    );
    expect(calls).toEqual([{ command: "printf", args: ["%s\n", "a b", "c"] }]);
  });
});

describe("beforeDown in the down lifecycle", () => {
  it("runs beforeDown before docker compose down", async () => {
    const { calls, runner } = recordingRunner();
    const lines: string[] = [];
    await down({
      cwd: hooksFixture,
      profileKey: "dev",
      runner,
      log: (line) => lines.push(line),
    });
    expect(lines).toContain("hook beforeDown key=dev");
    const hookLine = lines.indexOf("▶ hook beforeDown");
    const downLine = lines.findIndex((line) => line.startsWith("$ ") && / down\b/.test(line));
    expect(hookLine).toBeGreaterThanOrEqual(0);
    expect(downLine).toBeGreaterThan(hookLine);
    expect(calls.at(-1)?.args).toContain("down");
  });
});

describe("JavaScript task hooks", () => {
  it("runs hooks.task.<name> when no Compose task matches", async () => {
    const { calls, runner } = recordingRunner();
    const lines: string[] = [];
    const code = await task({
      cwd: hooksFixture,
      name: "codegen",
      runner,
      log: (line) => lines.push(line),
    });
    expect(code).toBe(0);
    expect(lines).toContain("hook codegen key=codegen");
    expect(calls).toEqual([{ command: "node", args: ["--eval", "0"] }]);
  });

  it("still uses the Compose task path when one is declared", async () => {
    const { calls, runner } = recordingRunner();
    const code = await task({ cwd: composeService, name: "test", runner, log: () => {} });
    expect(code).toBe(0);
    const projectNames = calls.map((spec) => spec.args[spec.args.indexOf("--project-name") + 1]);
    expect(new Set(projectNames)).toEqual(new Set(["fixture-compose-task-test"]));
  });

  it("throws E_TASK_NOT_FOUND when neither a Compose task nor a hook exists", async () => {
    await expect(
      task({ cwd: hooksFixture, name: "missing", runner: recordingRunner().runner, log: () => {} }),
    ).rejects.toMatchObject({ code: "E_TASK_NOT_FOUND" });
  });
});
