// A one-off containerised tool plus a pure-JavaScript task hook.
export default {
  id: "container-cli",
  compose: {
    file: "docker/compose.yml",
    projectName: "container-cli",
  },
  profiles: {
    dev: { kind: "container-cli", services: ["tool"] },
  },
  hooks: {
    task: {
      // `snowdev task lint` runs this. `exec` uses an explicit argument array.
      async lint({ exec }) {
        const { exitCode } = await exec("node", ["--check", "scripts/tool.mjs"]);
        if (exitCode !== 0) throw new Error(`syntax check failed (${exitCode})`);
      },
    },
  },
};
