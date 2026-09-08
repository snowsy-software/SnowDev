/** Supported execution models for a configured profile. */
export type WorkflowKind = "compose-service" | "host-app-with-compose-deps" | "container-cli";
/** Project-owned Docker Compose location and isolation name. */
export interface ComposeConfig {
  /** Path to the Compose file, relative to the configuration file's directory. */
  file: string;
  /** Explicit Compose project name that prevents collisions between projects. */
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
  /** Whether the task must use an isolated Compose project. */
  isolated: boolean;
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
}
