/**
 * Platform Seed Content — Shared Variant Documents
 *
 * Shared Sanity documents that belong to NO specific tenant.
 * Any Sanity-backed tenant can use these as fallback content when no
 * tenant-specific document exists for the requested variant key.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   The script automatically loads .env and .env.local from the project root,
 *   so no manual `export` step is required.
 *
 *   The only variable you must add to .env.local is the write token:
 *     SANITY_API_TOKEN=your_write_token   (Editor role or higher)
 *
 *   Project ID and dataset are read automatically from the frontend variables
 *   already in your .env.local:
 *     NEXT_PUBLIC_SANITY_PROJECT_ID=your_project_id   ← already present
 *     NEXT_PUBLIC_SANITY_DATASET=production            ← already present
 *
 *   You can also override them with server-only equivalents (no NEXT_PUBLIC_):
 *     SANITY_PROJECT_ID=your_project_id
 *     SANITY_DATASET=production
 *
 *   Then run from the project root:
 *     npx tsx cms/seed/platform-seed.ts
 *
 *   Preview without writing (token not required):
 *     npx tsx cms/seed/platform-seed.ts --dry-run
 *
 * ─── What is seeded ───────────────────────────────────────────────────────────
 *
 *   Currently empty — no truly shared (tenant-agnostic) variant documents exist.
 *
 *   All variant content previously in this file has been moved to tenant-specific
 *   seeds because it referenced Mister Chameleon branding and was never intended
 *   to be shared across tenants:
 *
 *     cms/seed/marketing-site-variants.ts  — all MC variants (tenantId: "mister-chameleon")
 *
 *   When a new tenant is added that needs truly shared fallback content (i.e.
 *   generic, brand-neutral variants that work for any tenant), add those documents
 *   here without a tenantId field.
 *
 * ─── Resolution order ─────────────────────────────────────────────────────────
 *
 *   The Sanity GROQ query resolves variants in this order:
 *     1. Tenant-specific document (tenantId == $tenantId)  — highest priority
 *     2. Shared/platform document (!defined(tenantId))     — this seed
 *
 * ─── Notes ────────────────────────────────────────────────────────────────────
 *
 *   - All documents use `createOrReplace` so re-running the script is safe.
 *   - The `key` field is a plain string (NOT a Sanity slug object).
 *     The variant schemas define `key` as `type: "string"` so that per-tenant
 *     uniqueness can be enforced with a custom Rule.custom() validation rather
 *     than Sanity's built-in slug uniqueness (which is dataset-wide and would
 *     prevent two tenants from sharing the same key).
 *   - No `tenantId` field is set — documents here are genuinely shared across all tenants.
 *   - Proof `items[]` must include `_key` fields (Sanity array item requirement).
 *   - CTA hrefs must use real anchor paths that pass the placeholder-href check.
 */

import { readFileSync } from "fs";
import { resolve }      from "path";

import { parse as parseDotenv } from "dotenv";
import { createClient }         from "@sanity/client";

// ── Env file loading ────────────────────────────────────────────────────────────
//
// tsx does not auto-load .env / .env.local — that's a Next.js-only behaviour.
// We replicate the same file-priority order Next.js uses, without overriding
// values that were already set in the shell or a CI environment.
//
// Load order (later file wins on duplicate keys):
//   1. .env          — committed base defaults
//   2. .env.local    — developer-local overrides (gitignored)
//
// Shell / CI variables are never overwritten, so explicit exports always win.
//
// Collected metadata is emitted by logConfig() so all env info appears in one
// coherent block rather than scattered across startup.

interface EnvLoadResult {
  files:   string[];   // files that were found and parsed (in load order)
  applied: number;     // vars written to process.env (shell vars not counted)
}

const _envLoad: EnvLoadResult = (function loadEnvFiles(): EnvLoadResult {
  const root    = process.cwd();
  const files   = [".env", ".env.local"] as const;
  const merged: Record<string, string> = {};
  const found:  string[] = [];

  for (const file of files) {
    try {
      const raw = readFileSync(resolve(root, file), "utf8");
      Object.assign(merged, parseDotenv(raw)); // later file wins
      found.push(file);
    } catch {
      // file does not exist — skip silently
    }
  }

  let applied = 0;
  for (const [key, value] of Object.entries(merged)) {
    // Never overwrite a value that was already in the environment.
    // This preserves shell exports and CI-injected secrets.
    if (!(key in process.env)) {
      process.env[key] = value;
      applied++;
    }
  }

  return { files: found, applied };
})();

// ── Env variable resolution ─────────────────────────────────────────────────────
//
// Priority for each variable (highest → lowest):
//
//   projectId   SANITY_PROJECT_ID  →  NEXT_PUBLIC_SANITY_PROJECT_ID
//   dataset     SANITY_DATASET     →  NEXT_PUBLIC_SANITY_DATASET  →  "production"
//   token       SANITY_API_TOKEN   (no fallback — must be set explicitly)
//
// The NEXT_PUBLIC_* fallbacks let the seed work out of the box in projects
// that only have the frontend env variables configured.  The token has no
// NEXT_PUBLIC_ equivalent and must always be a server-only secret.

interface ResolvedSeedConfig {
  projectId: string;
  dataset:   string;
  token:     string;
}

/**
 * Resolves and validates the Sanity configuration for a write operation.
 *
 * Always call this before creating a client.  Throws with an actionable
 * message if any required value is missing, so the developer knows exactly
 * what to add to .env.local before re-running.
 */
function resolveConfig(): ResolvedSeedConfig {
  const projectId =
    process.env.SANITY_PROJECT_ID ??
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;

  const dataset =
    process.env.SANITY_DATASET ??
    process.env.NEXT_PUBLIC_SANITY_DATASET ??
    "production";

  const token = process.env.SANITY_API_TOKEN;

  if (!projectId) {
    throw new Error(
      "\n  ❌  SANITY_PROJECT_ID is not set.\n" +
      "\n" +
      "  Add one of the following to .env.local:\n" +
      "    SANITY_PROJECT_ID=your_project_id\n" +
      "    NEXT_PUBLIC_SANITY_PROJECT_ID=your_project_id   ← already used by the frontend\n" +
      "\n" +
      "  Find your project ID at https://www.sanity.io/manage → your project → Settings.\n",
    );
  }

  if (!token) {
    throw new Error(
      "\n  ❌  SANITY_API_TOKEN is not set.\n" +
      "\n" +
      "  The seed script needs a Sanity write token to create documents.\n" +
      "\n" +
      "  Steps:\n" +
      "    1. Open https://www.sanity.io/manage → your project → API → Tokens\n" +
      "    2. Click \"Add API token\"\n" +
      "    3. Give it a name (e.g. \"Seed script\") and the Editor role\n" +
      "    4. Copy the token and add it to .env.local:\n" +
      "         SANITY_API_TOKEN=your_token_here\n" +
      "\n" +
      "  ⚠  Do not use a NEXT_PUBLIC_ prefix — this token must stay server-only.\n",
    );
  }

  return { projectId, dataset, token };
}

/**
 * Logs the resolved config so developers can confirm they are writing to the
 * right project and dataset.  Never prints the token value.
 */
function logConfig(config: ResolvedSeedConfig, dryRun: boolean): void {
  // ── Env files ────────────────────────────────────────────────────────────
  if (_envLoad.files.length > 0) {
    console.log(
      `   Env files  : ${_envLoad.files.join(", ")}` +
      `  (${_envLoad.applied} var${_envLoad.applied !== 1 ? "s" : ""} applied)`,
    );
  } else {
    console.log("   Env files  : none found (.env / .env.local not present — using shell/CI vars only)");
  }

  // ── Resolved values ──────────────────────────────────────────────────────
  const projectSource =
    process.env.SANITY_PROJECT_ID
      ? "SANITY_PROJECT_ID"
      : "NEXT_PUBLIC_SANITY_PROJECT_ID";

  const datasetSource =
    process.env.SANITY_DATASET
      ? "SANITY_DATASET"
      : process.env.NEXT_PUBLIC_SANITY_DATASET
        ? "NEXT_PUBLIC_SANITY_DATASET"
        : "default";

  console.log(`   Project ID : ${config.projectId}  (from ${projectSource})`);
  console.log(`   Dataset    : ${config.dataset}  (from ${datasetSource})`);
  console.log(`   Token      : present  (SANITY_API_TOKEN)`);

  if (!dryRun && config.dataset === "production") {
    console.log();
    console.log("   ⚠️   Writing to the PRODUCTION dataset. Ctrl-C within 3 s to abort.");
  }

  console.log();
}

function createWriteClient(config: ResolvedSeedConfig) {
  return createClient({
    projectId:  config.projectId,
    dataset:    config.dataset,
    token:      config.token,
    apiVersion: process.env.SANITY_API_VERSION ?? "2024-01-01",
    useCdn:     false,
  });
}

// ── Seed documents ────────────────────────────────────────────────────────────

/**
 * Shared platform variant documents.
 * No `tenantId` field — these serve every tenant as a shared fallback.
 *
 * Currently empty. Add brand-neutral, tenant-agnostic variants here when needed.
 * Tenant-specific content lives in the relevant tenant seed file, e.g.:
 *   cms/seed/marketing-site-variants.ts   — mister-chameleon tenant
 *   cms/seed/workengine-seed.ts           — workengine tenant
 */
export const platformDocuments: Array<{ _id: string; _type: string; [key: string]: unknown }> = [

  // Add shared (no tenantId) variant documents here when needed.
  // Example structure:
  //
  // {
  //   _id:      "hero_generic_brand",
  //   _type:    "heroVariant",
  //   // no tenantId — shared platform document
  //   key:      "hero_generic_brand",
  //   isActive: true,
  //   title:    "Welcome to the platform",
  //   subtitle: "...",
  //   ctas: [],
  // },

] as const;

// ── Seed runner ────────────────────────────────────────────────────────────────

/**
 * Uploads all shared platform documents to Sanity using `createOrReplace`.
 * Safe to run multiple times — existing documents are overwritten cleanly.
 *
 * Run this once per Sanity project, before any tenant-specific seeds.
 * Tenant seeds (e.g. workengine-seed.ts) can be run independently.
 *
 * Config is resolved from environment variables and logged before any writes
 * so the developer can confirm the correct project and dataset are targeted.
 *
 * @param dryRun  When true, prints documents and config without writing to Sanity.
 *                The write token is not required in dry-run mode.
 */
export async function seedPlatform(dryRun = false): Promise<void> {
  console.log(`\n🌱  Platform seed (shared variants) — ${dryRun ? "DRY RUN" : "LIVE"}\n`);

  // ── Resolve env vars ───────────────────────────────────────────────────────
  //
  // In dry-run mode we still resolve projectId/dataset so the log is accurate,
  // but we skip token validation since no writes happen.

  const projectId =
    process.env.SANITY_PROJECT_ID ??
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;

  const dataset =
    process.env.SANITY_DATASET ??
    process.env.NEXT_PUBLIC_SANITY_DATASET ??
    "production";

  // ── Log config (always, before any early returns) ──────────────────────────

  const projectSource =
    process.env.SANITY_PROJECT_ID
      ? "SANITY_PROJECT_ID"
      : process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
        ? "NEXT_PUBLIC_SANITY_PROJECT_ID"
        : "not set";

  const datasetSource =
    process.env.SANITY_DATASET
      ? "SANITY_DATASET"
      : process.env.NEXT_PUBLIC_SANITY_DATASET
        ? "NEXT_PUBLIC_SANITY_DATASET"
        : "default (production)";

  const tokenPresent = Boolean(process.env.SANITY_API_TOKEN);

  if (_envLoad.files.length > 0) {
    console.log(
      `   Env files  : ${_envLoad.files.join(", ")}` +
      `  (${_envLoad.applied} var${_envLoad.applied !== 1 ? "s" : ""} applied)`,
    );
  } else {
    console.log("   Env files  : none found (.env / .env.local not present — using shell/CI vars only)");
  }
  console.log(`   Project ID : ${projectId ?? "(not set)"}  (from ${projectSource})`);
  console.log(`   Dataset    : ${dataset}  (from ${datasetSource})`);
  console.log(`   Token      : ${tokenPresent ? "present  (SANITY_API_TOKEN)" : "(not set — required for live run)"}`);
  console.log();

  // ── Production safety warning ──────────────────────────────────────────────

  if (!dryRun && dataset === "production") {
    console.warn("   ⚠️   Writing to the PRODUCTION dataset. Ctrl-C within 3 s to abort.");
    console.log();
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  // ── Dry-run path ───────────────────────────────────────────────────────────

  if (dryRun) {
    console.log(`   Would create/replace ${platformDocuments.length} documents:\n`);
    for (const doc of platformDocuments) {
      console.log(`     ${doc._id}  (${doc._type})`);
    }
    console.log("\n✅  Dry run complete — no changes written.\n");
    return;
  }

  // ── Validate required vars for live run ────────────────────────────────────

  if (!projectId) {
    throw new Error(
      "\n  ❌  SANITY_PROJECT_ID is not set.\n" +
      "\n" +
      "  Add one of the following to .env.local:\n" +
      "    SANITY_PROJECT_ID=your_project_id\n" +
      "    NEXT_PUBLIC_SANITY_PROJECT_ID=your_project_id   ← already used by the frontend\n" +
      "\n" +
      "  Find your project ID at https://www.sanity.io/manage → your project → Settings.\n",
    );
  }

  if (!tokenPresent) {
    throw new Error(
      "\n  ❌  SANITY_API_TOKEN is not set.\n" +
      "\n" +
      "  The seed script needs a Sanity write token to create documents.\n" +
      "\n" +
      "  Steps:\n" +
      "    1. Open https://www.sanity.io/manage → your project → API → Tokens\n" +
      "    2. Click \"Add API token\"\n" +
      "    3. Give it a name (e.g. \"Seed script\") and the Editor role\n" +
      "    4. Copy the token and add it to .env.local:\n" +
      "         SANITY_API_TOKEN=your_token_here\n" +
      "\n" +
      "  ⚠  Do not use a NEXT_PUBLIC_ prefix — this token must stay server-only.\n",
    );
  }

  // ── Write documents ────────────────────────────────────────────────────────

  const config: ResolvedSeedConfig = {
    projectId,
    dataset,
    token: process.env.SANITY_API_TOKEN!,
  };

  const client = createWriteClient(config);

  let successCount = 0;
  let errorCount   = 0;

  for (const doc of platformDocuments) {
    try {
      await client.createOrReplace(doc as Parameters<typeof client.createOrReplace>[0]);
      console.log(`   ✅  ${doc._id}`);
      successCount++;
    } catch (err) {
      console.error(`   ❌  ${doc._id} — ${err instanceof Error ? err.message : String(err)}`);
      errorCount++;
    }
  }

  console.log(
    `\n🌱  Seed complete: ${successCount} created/replaced, ${errorCount} error${errorCount !== 1 ? "s" : ""}.\n`,
  );

  if (errorCount > 0) {
    process.exit(1);
  }
}

// ── CLI entry-point ────────────────────────────────────────────────────────────

// Run when invoked directly: npx tsx cms/seed/platform-seed.ts [--dry-run]
const isDirect =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith("platform-seed.ts") || process.argv[1].endsWith("platform-seed.js"));

if (isDirect) {
  const dryRun = process.argv.includes("--dry-run");
  seedPlatform(dryRun).catch((err) => {
    // Print the message directly (not the Error object) so the actionable
    // instructions are displayed without the stack trace noise.
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
