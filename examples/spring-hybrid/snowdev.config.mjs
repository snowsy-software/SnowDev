// A Spring Boot service that runs on the host while Compose provides PostgreSQL.
const host = { command: "./mvnw", args: ["spring-boot:run"], stopGraceSeconds: 15 };

export default {
  id: "spring-hybrid",
  compose: {
    file: "docker/compose.yml",
    projectName: "spring-hybrid",
  },
  profiles: {
    dev: { kind: "host-app-with-compose-deps", services: ["db"], host },
    stag: { kind: "host-app-with-compose-deps", services: ["db"], foreground: false, host },
    prod: { kind: "host-app-with-compose-deps", services: ["db"], foreground: false, host },
  },
  hooks: {
    // Controlled `exec`: runs Flyway with an explicit argument array after the
    // database is healthy and before the host process starts.
    async afterDependenciesReady({ exec, log }) {
      log("afterDependenciesReady: applying database migrations");
      const { exitCode } = await exec("./mvnw", ["-q", "flyway:migrate"]);
      if (exitCode !== 0) throw new Error(`flyway:migrate exited with ${exitCode}`);
    },
  },
};
