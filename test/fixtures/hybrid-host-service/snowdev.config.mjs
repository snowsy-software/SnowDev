export default {
  id: "fixture-hybrid",
  compose: { file: "docker/compose.yml", projectName: "fixture-hybrid" },
  profiles: {
    dev: {
      kind: "host-app-with-compose-deps",
      services: ["database"],
      host: { command: "node", args: ["server.js"], stopGraceSeconds: 5 },
    },
    stag: {
      kind: "host-app-with-compose-deps",
      services: ["database"],
      foreground: false,
      host: { command: "node", args: ["server.js"], stopGraceSeconds: 5 },
    },
  },
};
