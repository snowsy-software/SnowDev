/** Supported execution models for a configured profile. */
export type WorkflowKind = "compose-service" | "host-app-with-compose-deps" | "container-cli";
/** Project-owned Docker Compose location and isolation name. */
export interface ComposeConfig {
  /** Path to the Compose file, relative to the configuration file's directory. */
  file: string;
  /** Explicit Compose project name that prevents collisions between projects. */
  projectName: string;
}
/** Settings for one named environment, such as `dev` or `prod`. */
export interface ProfileConfig {
  /** The execution model used by this profile. */
  kind: WorkflowKind;
  /** Compose services participating in this profile. */
  services: string[];
  /** Whether long-running services should remain attached to the terminal. */
  foreground?: boolean;
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
