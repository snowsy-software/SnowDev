import { existsSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";

// A Vite dev server that runs entirely inside Docker Compose.
export default {
  id: "vite-service",
  compose: {
    file: "docker/compose.yml",
    projectName: "vite-service",
  },
  profiles: {
    dev: { kind: "compose-service", services: ["web"], foreground: true },
    stag: { kind: "compose-service", services: ["web"], foreground: false },
    prod: { kind: "compose-service", services: ["web"], foreground: false },
  },
  tasks: {
    test: { profile: "test", services: ["web-test"], isolated: true },
  },
  hooks: {
    // Context-only hook: no shell, no `exec`. Ensure a local .env exists so the
    // container has something to read on the first run.
    async beforeRun({ cwd, log }) {
      const env = resolve(cwd, ".env");
      if (!existsSync(env)) {
        copyFileSync(resolve(cwd, ".env.example"), env);
        log("beforeRun: created .env from .env.example");
      }
    },
  },
};
