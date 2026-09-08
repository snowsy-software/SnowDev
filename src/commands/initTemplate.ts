import { access, copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SnowDevError } from "../core/errors.js";

/** Workflow templates that `snowdev init template` can scaffold. */
export const templateKinds = ["compose-service", "hybrid-host-service", "container-cli"] as const;
type TemplateKind = (typeof templateKinds)[number];

/** Package-relative `templates/` directory, resolved from this module's location. */
const templateRoot = fileURLToPath(new URL("../../templates/", import.meta.url));

/** Inputs for the `init template` command. */
export interface InitTemplateOptions {
  cwd: string;
  /** Template to scaffold. Defaults to `compose-service`. */
  kind?: string;
  log?: (line: string) => void;
}

/** One template file and where it lands in the consuming project. */
interface Placement {
  /** Path inside `templates/<kind>/`. */
  from: string;
  /** Destination path relative to the project directory. */
  to: string;
}
const placements: readonly Placement[] = [
  { from: "snowdev.config.mjs", to: "snowdev.config.mjs" },
  { from: "compose.yml", to: "docker/compose.yml" },
  { from: "env.example", to: ".env.example" },
];

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const suggestedScripts = [
  '  "dev": "snowdev run dev",',
  '  "stag": "snowdev run stag",',
  '  "prod": "snowdev run prod",',
  '  "down": "snowdev down",',
  '  "logs": "snowdev logs",',
  '  "test": "snowdev task test",',
  '  "doctor": "snowdev doctor"',
];

/**
 * Scaffolds a redacted starter configuration for one workflow kind.
 *
 * Writes `snowdev.config.mjs`, `docker/compose.yml`, and `.env.example` from the
 * packaged templates. Existing files are never overwritten — each is reported and
 * skipped — and `package.json` is left for the maintainer to edit by hand.
 */
export async function initTemplate(options: InitTemplateOptions): Promise<number> {
  const log = options.log ?? console.error;
  const kind = (options.kind ?? "compose-service") as TemplateKind;
  if (!templateKinds.includes(kind))
    throw new SnowDevError(
      "E_INVALID_ARGUMENT",
      `Unknown template "${options.kind}". Choose one of: ${templateKinds.join(", ")}.`,
    );

  const created: string[] = [];
  const skipped: string[] = [];
  for (const placement of placements) {
    const target = resolve(options.cwd, placement.to);
    if (await exists(target)) {
      skipped.push(placement.to);
      log(`skip ${placement.to} (exists)`);
      continue;
    }
    await mkdir(dirname(target), { recursive: true });
    await copyFile(resolve(templateRoot, kind, placement.from), target);
    created.push(placement.to);
    log(`create ${placement.to}`);
  }

  log("");
  log(
    created.length > 0
      ? `Scaffolded the ${kind} template: ${created.join(", ")}.`
      : "Nothing to create; every target file already exists.",
  );
  if (skipped.length > 0) log(`Left untouched: ${skipped.join(", ")}.`);
  log("");
  log("Add these scripts to package.json (SnowDev never edits it for you):");
  for (const line of suggestedScripts) log(line);
  return 0;
}
