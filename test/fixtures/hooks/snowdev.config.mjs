// `dev` is deliberately a background compose-service so `afterDependenciesReady`
// fires (an attached foreground profile has no separate dependency phase).
export default {
  id: "fixture-hooks",
  compose: { file: "docker/compose.yml", projectName: "fixture-hooks" },
  profiles: {
    dev: { kind: "compose-service", services: ["app"], foreground: false },
  },
  hooks: {
    async beforeRun({ key, profile, log }) {
      log(`hook beforeRun key=${key} kind=${profile?.kind}`);
    },
    async afterDependenciesReady({ key, log, exec }) {
      const { exitCode } = await exec("node", ["-e", "process.exit(0)"]);
      log(`hook afterDependenciesReady key=${key} exec=${exitCode}`);
    },
    async beforeDown({ key, log }) {
      log(`hook beforeDown key=${key}`);
    },
    task: {
      async codegen({ key, log, exec }) {
        await exec("node", ["--eval", "0"]);
        log(`hook codegen key=${key}`);
      },
    },
  },
};
