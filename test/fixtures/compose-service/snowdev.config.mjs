export default {
  id: "fixture-compose",
  compose: { file: "docker/compose.yml", projectName: "fixture-compose" },
  profiles: {
    dev: { kind: "compose-service", services: ["app"], foreground: true },
    stag: { kind: "compose-service", services: ["app"], foreground: false },
  },
  tasks: {
    test: { profile: "test", services: ["app-test"], isolated: true },
  },
};
