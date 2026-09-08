// Starter configuration for a project whose application runs on the host while
// Docker Compose only starts its dependencies (database, object storage, ...).
// Types ship with a future @snowdev/core package; this object is validated
// against SnowDev's schema at runtime.
const host = { command: "npm", args: ["run", "start:server"], stopGraceSeconds: 10 };

export default {
  id: "example-hybrid-service",
  compose: {
    file: "docker/compose.yml",
    projectName: "example-hybrid-service",
  },
  profiles: {
    dev: { kind: "host-app-with-compose-deps", services: ["db"], host },
    stag: { kind: "host-app-with-compose-deps", services: ["db"], foreground: false, host },
    prod: { kind: "host-app-with-compose-deps", services: ["db"], foreground: false, host },
  },
  hooks: {
    // Runs after the Compose dependencies report healthy and before the host
    // process starts. A good place to apply database migrations.
    async afterDependenciesReady({ log }) {
      log("afterDependenciesReady: run database migrations here.");
      // const { exitCode } = await exec("npm", ["run", "db:migrate"]);
      // if (exitCode !== 0) throw new Error("migration failed");
    },
  },
};
