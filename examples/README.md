# SnowDev examples

Standalone, redacted projects that show each supported workflow. They use only
public images and conventional ports, and reference no private infrastructure.
They are not part of the published npm package.

| Directory                          | Workflow                     | Shows                                                                                            |
| ---------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| [`vite-service/`](vite-service/)   | `compose-service`            | App + test runner as Compose services; a context-only `beforeRun` hook                           |
| [`spring-hybrid/`](spring-hybrid/) | `host-app-with-compose-deps` | App on the host, DB in Compose; an `afterDependenciesReady` hook that runs migrations via `exec` |
| [`wordpress/`](wordpress/)         | `compose-service`            | WordPress + MariaDB; a `beforeRun` hook that generates local salts with `node:crypto`            |
| [`container-cli/`](container-cli/) | `container-cli`              | One-off container; a pure-JavaScript `hooks.task.lint` task                                      |

To try one, copy the directory out of this repo, run `npm install -D @snowdev/cli`,
add the scripts from its README to `package.json`, then `npm run dev`.
