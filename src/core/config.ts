import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { validateConfig } from "../schema/config.js";
import type { SnowDevConfig } from "../types/config.js";
import { SnowDevError } from "./errors.js";

/** Finds the mandatory `snowdev.config.mjs` in a project's working directory. */
export async function findConfig(cwd: string): Promise<string> {
  const file = resolve(cwd, "snowdev.config.mjs");
  try {
    await access(file);
  } catch {
    throw new SnowDevError("E_CONFIG_NOT_FOUND", `No snowdev.config.mjs found in ${cwd}.`);
  }
  return file;
}

/** Loads, validates, and returns a project's MJS configuration and resolved path. */
export async function loadConfig(cwd: string): Promise<{ path: string; config: SnowDevConfig }> {
  const path = await findConfig(cwd);
  let loaded: { default?: unknown };
  try {
    loaded = await import(pathToFileURL(path).href);
  } catch (error) {
    throw new SnowDevError("E_CONFIG_LOAD", `Could not load ${path}.`, error);
  }
  if (loaded.default === undefined)
    throw new SnowDevError("E_CONFIG_INVALID", `${path} must have a default export.`);
  return { path, config: validateConfig(loaded.default) };
}
