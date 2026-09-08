import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig } from "../core/config.js";
import { profileProjectName } from "../core/lifecycle.js";
import { composeCommand } from "../core/compose.js";
import { runProcess, type ProcessRunner } from "../core/process.js";
/** One diagnostic emitted by the `snowdev doctor` command. */
export interface DoctorCheck {
  name: string;
  ok: boolean;
  message: string;
}
/** Aggregated diagnostic status returned by `snowdev doctor`. */
export interface DoctorResult {
  ok: boolean;
  checks: DoctorCheck[];
}
function nodeSupported(version: string): boolean {
  const [major, minor] = version.replace(/^v/, "").split(".").map(Number);
  return major > 20 || (major === 20 && minor >= 19);
}
/** Checks the local toolchain and the configuration required to run a project. */
export async function runDoctor(
  cwd: string,
  runner: ProcessRunner = runProcess,
  nodeVersion = process.version,
): Promise<DoctorResult> {
  const checks: DoctorCheck[] = [
    {
      name: "Node.js",
      ok: nodeSupported(nodeVersion),
      message: `${nodeVersion} (requires >=20.19.0)`,
    },
  ];
  try {
    const docker = await runner(
      { command: "docker", args: ["--version"] },
      { cwd, stdio: "ignore" },
    );
    checks.push({
      name: "Docker",
      ok: docker.exitCode === 0,
      message:
        docker.exitCode === 0 ? "docker is available" : `docker exited with ${docker.exitCode}`,
    });
  } catch (error) {
    checks.push({
      name: "Docker",
      ok: false,
      message: error instanceof Error ? error.message : "docker could not be started",
    });
  }
  try {
    const loaded = await loadConfig(cwd);
    checks.push({ name: "configuration", ok: true, message: loaded.path });
    const composeFile = resolve(cwd, loaded.config.compose.file);
    try {
      await access(composeFile);
      checks.push({ name: "Compose file", ok: true, message: composeFile });
    } catch {
      checks.push({ name: "Compose file", ok: false, message: `Missing ${composeFile}` });
    }
    const profileKey = Object.keys(loaded.config.profiles)[0];
    const probe = composeCommand(loaded.config.compose, profileKey, ["version"], {
      projectName: profileProjectName(loaded.config, profileKey),
    });
    const result = await runner(probe, { cwd, stdio: "ignore" });
    checks.push({
      name: "Docker Compose",
      ok: result.exitCode === 0,
      message:
        result.exitCode === 0
          ? "docker compose is available"
          : `docker compose exited with ${result.exitCode}`,
    });
  } catch (error) {
    checks.push({
      name: "configuration",
      ok: false,
      message: error instanceof Error ? error.message : "Could not validate configuration",
    });
  }
  return { ok: checks.every((check) => check.ok), checks };
}
