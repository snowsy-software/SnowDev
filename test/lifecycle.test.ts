import { describe, expect, it, vi } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import type { CommandSpec } from "../src/core/compose.js";
import type { ProcessResult } from "../src/core/process.js";
import {
  downCommand,
  logsCommand,
  psCommand,
  resetCommand,
  profileProjectName,
  startCommands,
  taskProjectName,
} from "../src/core/lifecycle.js";
import { loadConfig } from "../src/core/config.js";
import { validateConfig } from "../src/schema/config.js";
import { assertResettableProfile, confirmDestructive } from "../src/core/safety.js";
import { parseComposePs, waitForComposeHealthy, waitForHttp } from "../src/core/health.js";
import { hostStatus, startHostBackground, stopHostBackground } from "../src/core/hostProcess.js";
import { run } from "../src/commands/run.js";
import { down } from "../src/commands/down.js";
import { init } from "../src/commands/init.js";
import { reset } from "../src/commands/reset.js";
import { task } from "../src/commands/task.js";

const fixtures = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures");
const composeService = resolve(fixtures, "compose-service");
const containerCli = resolve(fixtures, "container-cli");
const hybrid = resolve(fixtures, "hybrid-host-service");

/** Records every command a runner is asked to execute. */
function recordingRunner(exitCodes: Record<string, number> = {}) {
  const calls: CommandSpec[] = [];
  const runner = vi.fn(
    async (spec: CommandSpec, options?: { capture?: boolean }): Promise<ProcessResult> => {
      calls.push(spec);
      const key = spec.args.find((arg) => ["up", "down", "run", "logs", "ps"].includes(arg)) ?? "";
      if (options?.capture)
        return {
          exitCode: 0,
          stdout:
            '[{"Service":"app","State":"running"},{"Service":"db","State":"running","Health":"healthy"},{"Service":"database","State":"running","Health":"healthy"}]',
        };
      return { exitCode: exitCodes[key] ?? 0 };
    },
  );
  return { calls, runner };
}

describe("start commands never tear an environment down", () => {
  it("gives every profile a distinct Compose project", async () => {
    const { config } = await loadConfig(composeService);
    expect(profileProjectName(config, "dev")).toBe("fixture-compose-dev");
    expect(profileProjectName(config, "stag")).toBe("fixture-compose-stag");
  });

  it("runs dev in the foreground with a plain up and explicit isolation args", async () => {
    const { config } = await loadConfig(composeService);
    const [spec, ...others] = startCommands(config, "dev");
    expect(others).toHaveLength(0);
    expect(spec.args).toEqual([
      "compose",
      "--project-name",
      "fixture-compose-dev",
      "-f",
      "docker/compose.yml",
      "--profile",
      "dev",
      "up",
      "app",
    ]);
  });

  it("builds and detaches stag/prod without ever emitting down", async () => {
    const { config } = await loadConfig(composeService);
    const [spec] = startCommands(config, "stag");
    expect(spec.args).toContain("-d");
    expect(spec.args).toContain("--build");
    expect(spec.args).not.toContain("down");
  });

  it("run stag/prod issues no down command at the command layer", async () => {
    const { calls, runner } = recordingRunner();
    await run({ cwd: composeService, profileKey: "stag", runner, log: () => {} });
    expect(calls.flatMap((spec) => spec.args)).not.toContain("down");
  });
});

describe("down and reset volume policy", () => {
  it("down never passes --volumes", async () => {
    const { config } = await loadConfig(composeService);
    expect(downCommand(config, "dev").args).toEqual([
      "compose",
      "--project-name",
      "fixture-compose-dev",
      "-f",
      "docker/compose.yml",
      "--profile",
      "dev",
      "down",
      "--remove-orphans",
    ]);
  });

  it("reset only builds a --volumes teardown for dev", async () => {
    const { config } = await loadConfig(composeService);
    expect(resetCommand(config, "dev").args).toContain("--volumes");
    expect(() => assertResettableProfile("stag")).toThrow(/E_RESET_PROFILE_FORBIDDEN|refusing/);
    expect(() => assertResettableProfile("prod")).toThrow();
  });

  it("reset without --yes fails before running anything", async () => {
    const { calls, runner } = recordingRunner();
    await expect(
      reset({ cwd: composeService, profileKey: "dev", yes: false, runner, log: () => {} }),
    ).rejects.toMatchObject({ code: "E_CONFIRMATION_REQUIRED" });
    expect(calls).toHaveLength(0);
  });

  it("reset with --yes runs the volume-deleting teardown for dev", async () => {
    const { calls, runner } = recordingRunner();
    const code = await reset({
      cwd: composeService,
      profileKey: "dev",
      yes: true,
      runner,
      log: () => {},
    });
    expect(code).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toContain("--volumes");
  });

  it("reset refuses a non-dev profile even with --yes", async () => {
    await expect(
      reset({ cwd: composeService, profileKey: "stag", yes: true, log: () => {} }),
    ).rejects.toMatchObject({ code: "E_RESET_PROFILE_FORBIDDEN" });
  });
});

describe("logs and ps", () => {
  it("logs follows by default and stops following on request", async () => {
    const { config } = await loadConfig(composeService);
    const followed = logsCommand(config, "dev").args;
    expect(followed.slice(followed.indexOf("logs"))).toEqual(["logs", "-f", "app"]);
    const once = logsCommand(config, "dev", false).args;
    expect(once.slice(once.indexOf("logs"))).toEqual(["logs", "app"]);
  });
  it("ps targets the profile services", async () => {
    const { config } = await loadConfig(composeService);
    expect(psCommand(config, "dev").args.slice(-2)).toEqual(["ps", "app"]);
  });
});

describe("isolated task lifecycle", () => {
  it("rejects non-isolated Compose tasks before they can share a runtime project", () => {
    expect(() =>
      validateConfig({
        id: "unsafe-task",
        compose: { file: "docker/compose.yml", projectName: "unsafe-task" },
        profiles: { dev: { kind: "compose-service", services: ["app"] } },
        tasks: { test: { profile: "test", services: ["app-test"], isolated: false } },
      }),
    ).toThrow(/isolated must be true/);
  });

  it("uses a project name distinct from every profile", async () => {
    const { config } = await loadConfig(composeService);
    expect(taskProjectName(config, "test")).toBe("fixture-compose-task-test");
    expect(taskProjectName(config, "test")).not.toBe(config.compose.projectName);
  });

  it("tears the isolated project down even when the task fails", async () => {
    const { calls, runner } = recordingRunner({ run: 2 });
    const code = await task({ cwd: composeService, name: "test", runner, log: () => {} });
    expect(code).toBe(2);
    const projectNames = calls.map((spec) => spec.args[spec.args.indexOf("--project-name") + 1]);
    expect(new Set(projectNames)).toEqual(new Set(["fixture-compose-task-test"]));
    const cleanup = calls.at(-1)!;
    expect(cleanup.args).toContain("down");
    expect(cleanup.args).toContain("--volumes");
  });

  it("skips the run step but still cleans up when bring-up fails", async () => {
    const { calls, runner } = recordingRunner({ up: 1 });
    const code = await task({ cwd: composeService, name: "test", runner, log: () => {} });
    expect(code).toBe(1);
    expect(calls.map((c) => c.args.find((a) => ["up", "run", "down"].includes(a)))).toEqual([
      "up",
      "down",
    ]);
  });
});

describe("health waiting", () => {
  it("resolves once the endpoint answers below 500", async () => {
    const probe = vi
      .fn()
      .mockResolvedValueOnce({ status: 503 })
      .mockResolvedValueOnce({ status: 200 });
    await expect(
      waitForHttp(
        { url: "http://localhost:1/health", timeoutMs: 10_000, intervalMs: 1 },
        { probe, sleep: async () => {}, now: () => 0 },
      ),
    ).resolves.toBeUndefined();
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it("times out with a diagnostic naming the last failure", async () => {
    let clock = 0;
    const probe = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(
      waitForHttp(
        { url: "http://localhost:1/health", timeoutMs: 5, intervalMs: 1 },
        { probe, sleep: async () => {}, now: () => (clock += 10) },
      ),
    ).rejects.toMatchObject({
      code: "E_HEALTH_TIMEOUT",
      message: expect.stringContaining("ECONNREFUSED"),
    });
  });

  it("parses both JSON-array and newline-delimited compose ps output", () => {
    expect(parseComposePs('[{"Service":"app","State":"running","Health":"healthy"}]')).toEqual([
      { name: "app", state: "running", health: "healthy" },
    ]);
    expect(parseComposePs('{"Name":"db","State":"running","Health":""}\n')).toEqual([
      { name: "db", state: "running", health: undefined },
    ]);
  });

  it("waits until every requested compose service is running/healthy", async () => {
    const { config } = await loadConfig(composeService);
    const responses = [
      '[{"Service":"app","State":"starting"}]',
      '[{"Service":"app","State":"running","Health":"starting"}]',
      '[{"Service":"app","State":"running","Health":"healthy"}]',
    ];
    let call = 0;
    const runner = vi.fn(async () => ({ exitCode: 0, stdout: responses[call++] }));
    await expect(
      waitForComposeHealthy(config.compose, "dev", ["app"], {
        runner,
        sleep: async () => {},
        now: () => 0,
        timeoutMs: 10_000,
      }),
    ).resolves.toBeUndefined();
    expect(runner).toHaveBeenCalledTimes(3);
  });
});

describe("host process lifecycle", () => {
  it("records a PID, reports status, and stops the process", async () => {
    const dir = await mkdtemp(resolve(tmpdir(), "snowdev-host-"));
    try {
      const alive = new Set<number>([4242]);
      const deps = {
        spawn: (() => ({ pid: 4242, unref() {} })) as never,
        kill: (pid: number, signal: NodeJS.Signals | 0) => {
          if (signal === "SIGTERM" || signal === "SIGKILL") alive.delete(pid);
          return alive.has(pid);
        },
        sleep: async () => {},
      };
      const record = await startHostBackground(
        { command: "node", args: ["server.js"] },
        { cwd: dir, key: "svc-dev", deps },
      );
      expect(record.pid).toBe(4242);
      await expect(readFile(resolve(dir, ".snowdev/svc-dev.host.json"), "utf8")).resolves.toContain(
        "4242",
      );

      const before = await hostStatus({ cwd: dir, key: "svc-dev", deps });
      expect(before.running).toBe(true);

      const stopped = await stopHostBackground({ cwd: dir, key: "svc-dev", deps });
      expect(stopped.stopped).toBe(true);
      const after = await hostStatus({ cwd: dir, key: "svc-dev", deps });
      expect(after.running).toBe(false);
      expect(after.record).toBeUndefined();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("refuses to start a second host process while one is alive", async () => {
    const dir = await mkdtemp(resolve(tmpdir(), "snowdev-host-"));
    try {
      await writeFile(
        resolve(dir, "seed.json"),
        JSON.stringify({ pid: 10, command: "node", args: [], startedAt: "now" }),
      );
      const deps = {
        spawn: (() => ({ pid: 11, unref() {} })) as never,
        kill: () => true,
        sleep: async () => {},
      };
      // Pre-create the record the guard reads.
      const { mkdir } = await import("node:fs/promises");
      await mkdir(resolve(dir, ".snowdev"), { recursive: true });
      await writeFile(
        resolve(dir, ".snowdev/svc-dev.host.json"),
        JSON.stringify({ pid: 10, command: "node", args: [], startedAt: "now" }),
      );
      await expect(
        startHostBackground({ command: "node" }, { cwd: dir, key: "svc-dev", deps }),
      ).rejects.toMatchObject({ code: "E_HOST_ALREADY_RUNNING" });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("hybrid host profile via commands", () => {
  async function hybridProject(): Promise<string> {
    const dir = await mkdtemp(resolve(tmpdir(), "snowdev-hybrid-"));
    await writeFile(
      resolve(dir, "snowdev.config.mjs"),
      await readFile(resolve(hybrid, "snowdev.config.mjs")),
    );
    return dir;
  }

  it("starts deps detached then launches the host process in the background", async () => {
    const dir = await hybridProject();
    try {
      const { calls, runner } = recordingRunner();
      const deps = {
        spawn: (() => ({ pid: 777, unref() {} })) as never,
        kill: () => false,
        sleep: async () => {},
      };
      const code = await run({
        cwd: dir,
        profileKey: "stag",
        runner,
        hostDeps: deps,
        log: () => {},
      });
      expect(code).toBe(0);
      expect(calls[0].args).toContain("up");
      expect(calls[0].args).toContain("-d");
      expect(calls.flatMap((c) => c.args)).not.toContain("down");
      await expect(
        readFile(resolve(dir, ".snowdev/fixture-hybrid-stag.host.json"), "utf8"),
      ).resolves.toContain("777");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runs the host process in the foreground for dev and returns its exit code", async () => {
    const dir = await hybridProject();
    try {
      const { runner } = recordingRunner();
      const deps = {
        spawn: (() => {
          const listeners: Record<string, (arg: number) => void> = {};
          return {
            pid: 1,
            unref() {},
            once(event: string, cb: (arg: number) => void) {
              listeners[event] = cb;
              if (event === "close") queueMicrotask(() => cb(3));
            },
          };
        }) as never,
        kill: () => false,
        sleep: async () => {},
      };
      const code = await run({
        cwd: dir,
        profileKey: "dev",
        runner,
        hostDeps: deps,
        log: () => {},
      });
      expect(code).toBe(3);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("down stops the recorded host process before compose down", async () => {
    const dir = await hybridProject();
    try {
      const { mkdir } = await import("node:fs/promises");
      await mkdir(resolve(dir, ".snowdev"), { recursive: true });
      await writeFile(
        resolve(dir, ".snowdev/fixture-hybrid-stag.host.json"),
        JSON.stringify({ pid: 999, command: "node", args: [], startedAt: "now" }),
      );
      const killed: string[] = [];
      let terminated = false;
      const deps = {
        spawn: (() => ({ pid: 0, unref() {} })) as never,
        kill: (_pid: number, signal: NodeJS.Signals | 0) => {
          if (signal === 0) return !terminated;
          killed.push(signal);
          terminated = true;
          return true;
        },
        sleep: async () => {},
      };
      const { calls, runner } = recordingRunner();
      await down({ cwd: dir, profileKey: "stag", runner, hostDeps: deps, log: () => {} });
      expect(killed).toContain("SIGTERM");
      expect(calls.at(-1)!.args).toContain("down");
      expect(calls.at(-1)!.args).not.toContain("--volumes");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("run by workflow kind", () => {
  it("stays attached for a foreground compose-service and returns the up exit code", async () => {
    const calls: CommandSpec[] = [];
    const runner = vi.fn(async (spec: CommandSpec, opts?: { stdio?: string }) => {
      calls.push(spec);
      return { exitCode: opts?.stdio === "inherit" ? 7 : 0 };
    });
    const code = await run({ cwd: composeService, profileKey: "dev", runner, log: () => {} });
    expect(code).toBe(7);
    expect(calls).toHaveLength(1);
    expect(calls[0].args.slice(-2)).toEqual(["up", "app"]);
  });

  it("runs one `run --rm` per service for container-cli and stops at a failure", async () => {
    const { calls, runner } = recordingRunner({ run: 4 });
    const code = await run({ cwd: containerCli, profileKey: "dev", runner, log: () => {} });
    expect(code).toBe(4);
    expect(calls).toHaveLength(1);
    expect(calls[0].args.slice(-3)).toEqual(["run", "--rm", "tool"]);
  });
});

describe("init", () => {
  it("requires --yes and never runs a destructive teardown", async () => {
    const { calls, runner } = recordingRunner();
    await expect(
      init({ cwd: composeService, profileKey: "dev", yes: false, runner, log: () => {} }),
    ).rejects.toMatchObject({ code: "E_CONFIRMATION_REQUIRED" });
    expect(calls).toHaveLength(0);
  });

  it("builds and starts the profile services when acknowledged", async () => {
    const dir = await mkdtemp(resolve(tmpdir(), "snowdev-init-"));
    try {
      await writeFile(
        resolve(dir, "snowdev.config.mjs"),
        await readFile(resolve(composeService, "snowdev.config.mjs")),
      );
      const { calls, runner } = recordingRunner();
      const code = await init({ cwd: dir, profileKey: "dev", yes: true, runner, log: () => {} });
      expect(code).toBe(0);
      expect(calls[0].args).toContain("--build");
      expect(calls.flatMap((c) => c.args)).not.toContain("down");
      await expect(readFile(resolve(dir, ".snowdev"), "utf8").catch(() => "dir")).resolves.toBe(
        "dir",
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("confirmDestructive", () => {
  it("prints impact then throws without --yes and returns with --yes", () => {
    const lines: string[] = [];
    expect(() =>
      confirmDestructive("reset dev", ["drop volumes"], false, (l) => lines.push(l)),
    ).toThrow(/E_CONFIRMATION_REQUIRED|--yes/);
    expect(lines.join("\n")).toContain("drop volumes");
    lines.length = 0;
    expect(() =>
      confirmDestructive("reset dev", ["drop volumes"], true, (l) => lines.push(l)),
    ).not.toThrow();
  });
});
