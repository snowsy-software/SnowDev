// Starter configuration for a project whose container is a one-off CLI rather
// than a long-running service. Types ship with a future @snowdev/core package;
// this object is validated against SnowDev's schema at runtime.
export default {
  id: "example-container-cli",
  compose: {
    file: "docker/compose.yml",
    projectName: "example-container-cli",
  },
  profiles: {
    dev: { kind: "container-cli", services: ["tool"] },
  },
  hooks: {
    task: {
      // `snowdev task lint` runs this when no Compose `tasks.lint` is declared.
      // Throw, or exit non-zero via `exec`, to fail the task.
      async lint({ log }) {
        log("lint: wire your linter here.");
        // const { exitCode } = await exec("npm", ["run", "lint"]);
        // if (exitCode !== 0) throw new Error("lint failed");
      },
    },
  },
};
