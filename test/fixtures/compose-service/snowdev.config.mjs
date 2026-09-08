export default {
  id: "fixture-compose",
  compose: { file: "docker/compose.yml", projectName: "fixture-compose" },
  profiles: { dev: { kind: "compose-service", services: ["app"], foreground: true } },
};
