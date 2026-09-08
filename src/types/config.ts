/** Supported execution models for a configured profile. */
export type WorkflowKind = "compose-service" | "host-app-with-compose-deps" | "container-cli";
/** Project-owned Docker Compose location and isolation name. */
export interface ComposeConfig {
  /** Path to the Compose file, relative to the configuration file's directory. */
  file: string;
  /** Base Compose project name; SnowDev appends the active profile for isolation. */
  projectName: string;
}
/** HTTP readiness probe used to gate a profile or task before it is considered up. */
export interface HttpHealthCheck {
  /** Absolute URL polled until it answers with a non-5xx status. */
  url: string;
  /** Total time to keep polling before failing. Defaults to 60000ms. */
  timeoutMs?: number;
  /** Delay between attempts. Defaults to 1000ms. */
  intervalMs?: number;
}
/**
 * Host-process definition for `host-app-with-compose-deps` profiles.
 *
 * The application runs on the host while Compose only starts its dependencies.
 */
export interface HostProcessConfig {
  /** Executable to launch on the host. Never interpreted by a shell. */
  command: string;
  /** Literal arguments passed to the executable. */
  args?: string[];
  /** Seconds to wait for a graceful stop before sending SIGKILL. Defaults to 10. */
  stopGraceSeconds?: number;
}
/** Settings for one named environment, such as `dev` or `prod`. */
export interface ProfileConfig {
  /** The execution model used by this profile. */
  kind: WorkflowKind;
  /** Compose services participating in this profile. */
  services: string[];
  /** Whether long-running services should remain attached to the terminal. */
  foreground?: boolean;
  /** Optional HTTP readiness gate applied after the profile's containers start. */
  health?: HttpHealthCheck;
  /** Host process definition. Required for `host-app-with-compose-deps`. */
  host?: HostProcessConfig;
}
/** A declared one-off task, such as test or lint. */
export interface TaskConfig {
  /** Profile to pass to Docker Compose for this task. */
  profile: string;
  /** Compose services that execute the task. */
  services: string[];
  /** Tasks always use their own disposable Compose project. */
  isolated: true;
}
/** Options accepted by a hook's controlled command runner. */
export interface HookExecOptions {
  /** Working directory for the child process. Defaults to the project directory. */
  cwd?: string;
  /** Environment for the child process. Defaults to the profile's merged environment. */
  env?: NodeJS.ProcessEnv;
}
/** Result of a hook's controlled command invocation. */
export interface HookExecResult {
  /** Exit code reported by the child process. */
  exitCode: number;
}
/**
 * The controlled surface passed to every custom hook.
 *
 * Hooks receive resolved configuration, the merged environment, a logger, and a
 * shell-free command runner. There is deliberately no way to run an arbitrary
 * shell string: {@link HookContext.exec} always takes an explicit argument array.
 */
export interface HookContext {
  /** The profile or task key that triggered this hook. */
  key: string;
  /** Resolved profile configuration, present when a profile triggered the hook. */
  profile?: ProfileConfig;
  /** The full, validated configuration. */
  config: SnowDevConfig;
  /** Absolute path to the consuming project directory. */
  cwd: string;
  /** Environment merged with SnowDev's fixed precedence for the active profile. */
  env: NodeJS.ProcessEnv;
  /** Writes a line to SnowDev's diagnostic stream (stderr). */
  log: (line: string) => void;
  /** Runs an executable with an explicit argument array; never uses a shell. */
  exec: (command: string, args?: string[], options?: HookExecOptions) => Promise<HookExecResult>;
}
/** A custom lifecycle callback declared in `snowdev.config.mjs`. */
export type Hook = (context: HookContext) => void | Promise<void>;
/** The named, restricted lifecycle hooks a project may declare. */
export interface LifecycleHooks {
  /** Runs before any container or host process for a `run` starts. */
  beforeRun?: Hook;
  /**
   * Runs after Compose dependencies report healthy.
   *
   * Fires for background `compose-service` profiles and for
   * `host-app-with-compose-deps` (before the host process starts). It does not
   * fire for an attached foreground `compose-service`, which has no separate
   * dependency phase.
   */
  afterDependenciesReady?: Hook;
  /** Runs before `down` stops the host process or any container. */
  beforeDown?: Hook;
  /**
   * Pure-JavaScript named tasks.
   *
   * `snowdev task <name>` runs the matching entry when no Compose `tasks.<name>`
   * is declared. A name may not appear in both `tasks` and `hooks.task`.
   */
  task?: Record<string, Hook>;
}
/** Complete, validated shape of `snowdev.config.mjs`. */
export interface SnowDevConfig {
  /** Stable identifier for the consuming project. */
  id: string;
  /** Docker Compose settings shared by all profiles. */
  compose: ComposeConfig;
  /** Named runtime profiles. At least one profile is required. */
  profiles: Record<string, ProfileConfig>;
  /** Optional named one-off tasks. */
  tasks?: Record<string, TaskConfig>;
  /** Lowest-priority environment defaults for child processes. */
  env?: Record<string, string>;
  /** Optional custom lifecycle hooks. */
  hooks?: LifecycleHooks;
}
