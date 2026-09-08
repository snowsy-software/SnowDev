export default {
  id: "fixture-cli",
  compose: { file: "docker/compose.yml", projectName: "fixture-cli" },
  profiles: { dev: { kind: "container-cli", services: ["tool"] } },
};
