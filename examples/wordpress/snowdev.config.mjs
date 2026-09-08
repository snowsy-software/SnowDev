import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";

// WordPress plus MariaDB, both as Compose services.
export default {
  id: "wordpress-site",
  compose: {
    file: "docker/compose.yml",
    projectName: "wordpress-site",
  },
  profiles: {
    dev: { kind: "compose-service", services: ["wordpress", "db"], foreground: true },
    stag: { kind: "compose-service", services: ["wordpress", "db"], foreground: false },
    prod: { kind: "compose-service", services: ["wordpress", "db"], foreground: false },
  },
  hooks: {
    // Context-only hook: generate a local salts file with node:crypto if it is
    // missing. No shell, no `exec`.
    async beforeRun({ cwd, log }) {
      const file = resolve(cwd, "config/wp-secrets.php");
      if (existsSync(file)) return;
      const keys = [
        "AUTH_KEY",
        "SECURE_AUTH_KEY",
        "LOGGED_IN_KEY",
        "NONCE_KEY",
        "AUTH_SALT",
        "SECURE_AUTH_SALT",
        "LOGGED_IN_SALT",
        "NONCE_SALT",
      ];
      const body = keys
        .map((key) => `define('${key}', '${randomBytes(32).toString("base64")}');`)
        .join("\n");
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, `<?php\n${body}\n`);
      log("beforeRun: generated config/wp-secrets.php");
    },
  },
};
