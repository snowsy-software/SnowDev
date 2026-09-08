import { describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { initTemplate, templateKinds } from "../src/commands/initTemplate.js";
import { validateConfig } from "../src/schema/config.js";

function tempDir(): Promise<string> {
  return mkdtemp(resolve(tmpdir(), "snowdev-scaffold-"));
}

describe("init template scaffold", () => {
  it.each(templateKinds)("writes a schema-valid %s config into an empty project", async (kind) => {
    const dir = await tempDir();
    try {
      const lines: string[] = [];
      const code = await initTemplate({ cwd: dir, kind, log: (line) => lines.push(line) });
      expect(code).toBe(0);
      expect(lines).toEqual(
        expect.arrayContaining([
          "create snowdev.config.mjs",
          "create docker/compose.yml",
          "create .env.example",
        ]),
      );
      const module = await import(pathToFileURL(resolve(dir, "snowdev.config.mjs")).href);
      expect(() => validateConfig(module.default)).not.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("never overwrites files that already exist", async () => {
    const dir = await tempDir();
    try {
      await writeFile(resolve(dir, "snowdev.config.mjs"), "// mine\n");
      await mkdir(resolve(dir, "docker"), { recursive: true });
      await writeFile(resolve(dir, "docker/compose.yml"), "# mine\n");
      await writeFile(resolve(dir, ".env.example"), "MINE=1\n");
      const lines: string[] = [];
      const code = await initTemplate({
        cwd: dir,
        kind: "compose-service",
        log: (line) => lines.push(line),
      });
      expect(code).toBe(0);
      expect(lines.filter((line) => line.includes("(exists)"))).toHaveLength(3);
      expect(await readFile(resolve(dir, "snowdev.config.mjs"), "utf8")).toBe("// mine\n");
      expect(await readFile(resolve(dir, "docker/compose.yml"), "utf8")).toBe("# mine\n");
      expect(await readFile(resolve(dir, ".env.example"), "utf8")).toBe("MINE=1\n");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects an unknown template kind", async () => {
    const dir = await tempDir();
    try {
      await expect(initTemplate({ cwd: dir, kind: "nope", log: () => {} })).rejects.toMatchObject({
        code: "E_INVALID_ARGUMENT",
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("defaults to the compose-service template", async () => {
    const dir = await tempDir();
    try {
      const code = await initTemplate({ cwd: dir, log: () => {} });
      expect(code).toBe(0);
      expect(await readFile(resolve(dir, "snowdev.config.mjs"), "utf8")).toContain(
        "compose-service",
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
