export default {
  id: "fixture-hybrid",
  compose: { file: "docker/compose.yml", projectName: "fixture-hybrid" },
  profiles: { dev: { kind: "host-app-with-compose-deps", services: ["database"] } },
};
