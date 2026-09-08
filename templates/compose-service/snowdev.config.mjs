// Starter configuration for a project whose app and dependencies all run as
// Docker Compose services. Types ship with a future @snowdev/core package; this
// object is validated against SnowDev's schema at runtime.
export default {
  id: "example-compose-service",
  compose: {
    file: "docker/compose.yml",
    projectName: "example-compose-service",
  },
  profiles: {
    dev: { kind: "compose-service", services: ["app"], foreground: true },
    stag: { kind: "compose-service", services: ["app"], foreground: false },
    prod: { kind: "compose-service", services: ["app"], foreground: false },
  },
  tasks: {
    test: { profile: "test", services: ["app-test"], isolated: true },
  },
  hooks: {
    // Runs before any container starts. Keep it fast and idempotent. The context
    // is { key, profile, config, cwd, env, log, exec }; `exec(cmd, args[])` runs
    // an executable with an argument array and never through a shell.
    async beforeRun({ log }) {
      log("beforeRun: add project-specific preparation here.");
      // await exec("node", ["scripts/generate-config.mjs"]);
    },
  },
};
