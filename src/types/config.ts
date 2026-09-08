export type WorkflowKind = "compose-service" | "host-app-with-compose-deps" | "container-cli";
export interface ComposeConfig {
  file: string;
  projectName: string;
}
export interface ProfileConfig {
  kind: WorkflowKind;
  services: string[];
  foreground?: boolean;
}
export interface TaskConfig {
  profile: string;
  services: string[];
  isolated: boolean;
}
export interface SnowDevConfig {
  id: string;
  compose: ComposeConfig;
  profiles: Record<string, ProfileConfig>;
  tasks?: Record<string, TaskConfig>;
  env?: Record<string, string>;
}
