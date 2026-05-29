/**
 * scripts/lib/env.ts
 *
 * Environment variable loader for scripts.
 * Reads .env.local (or a --env=<file> override) before the script logic runs.
 *
 * Usage:
 *   import { loadEnv, requireEnv, getEnv } from "./lib/env";
 *   loadEnv();  // call once at the top of each script
 */

import fs            from "node:fs";
import path          from "node:path";
import { fileURLToPath } from "node:url";

// __dirname is available in CJS (tsx default); import.meta.dirname in ESM.
// Support both so the file works regardless of how tsx loads it.
const _dirname: string =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(_dirname, "../..");

/**
 * Parse a .env file into a key→value map.
 * Supports:
 *   KEY=value
 *   KEY="quoted value"
 *   # comments
 *   export KEY=value
 */
export function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  const result: Record<string, string> = {};

  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const withoutExport = line.replace(/^export\s+/, "");
    const eqIdx = withoutExport.indexOf("=");
    if (eqIdx === -1) continue;

    const key = withoutExport.slice(0, eqIdx).trim();
    let val   = withoutExport.slice(eqIdx + 1).trim();

    // Strip surrounding quotes.
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // Strip inline comments (# ...) — only outside quotes.
    const commentIdx = val.indexOf(" #");
    if (commentIdx !== -1) val = val.slice(0, commentIdx).trim();

    result[key] = val;
  }

  return result;
}

/**
 * Load environment variables from a .env file into process.env.
 * Priority: existing process.env > .env file (never overwrite real env vars).
 */
export function loadEnv(envFile?: string): void {
  // Allow --env=path override via CLI args.
  const argEnv = process.argv.find((a) => a.startsWith("--env="))?.slice(6);
  const file   = envFile ?? argEnv ?? path.join(PROJECT_ROOT, ".env.local");

  const parsed = parseEnvFile(file);
  for (const [k, v] of Object.entries(parsed)) {
    if (process.env[k] === undefined) {
      process.env[k] = v;
    }
  }
}

/** Return an env var or throw if missing. */
export function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Required env var ${key} is not set. Check your .env.local.`);
  return val;
}

/** Return an env var or a default. */
export function getEnv(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

/** Returns true if the key is set and non-empty. */
export function hasEnv(key: string): boolean {
  const v = process.env[key];
  return typeof v === "string" && v.length > 0;
}
