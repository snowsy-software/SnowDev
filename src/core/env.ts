import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { SnowDevError } from "./errors.js";

/** Parses a restricted dotenv file without interpolation or shell evaluation. */
export function parseEnv(contents: string, source = ".env"): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [index, raw] of contents
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .entries()) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match)
      throw new SnowDevError(
        "E_ENV_INVALID",
        `${source}:${index + 1} is not a valid environment assignment.`,
      );
    const [, key, rawValue] = match;
    const quoted = rawValue.match(/^(?:"([\s\S]*)"|'([\s\S]*)')$/);
    values[key] = quoted ? (quoted[1] ?? quoted[2] ?? "") : rawValue.replace(/\s+#.*$/, "").trim();
  }
  return values;
}
async function optionalEnv(path: string): Promise<Record<string, string>> {
  try {
    return parseEnv(await readFile(path, "utf8"), path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}
/**
 * Merges environment files using SnowDev's fixed precedence.
 *
 * Process variables override profile-local, local, profile, base, and configured defaults.
 */
export async function loadEnvironment(
  cwd: string,
  profile: string,
  defaults: Record<string, string> = {},
  processEnv: NodeJS.ProcessEnv = process.env,
): Promise<NodeJS.ProcessEnv> {
  const loaded = await Promise.all(
    [".env", `.env.${profile}`, ".env.local", `.env.${profile}.local`].map((name) =>
      optionalEnv(resolve(cwd, name)),
    ),
  );
  return { ...defaults, ...loaded[0], ...loaded[1], ...loaded[2], ...loaded[3], ...processEnv };
}
const secretKey = /(token|password|passwd|secret|api[-_]?key|authorization)/i;
/** Returns an environment object safe to include in command logs. */
export function redactEnvironment(
  values: Record<string, string | undefined>,
): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, secretKey.test(key) ? "[REDACTED]" : value]),
  );
}
