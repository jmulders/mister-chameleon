#!/usr/bin/env node
/**
 * scripts/bootstrap.ts
 *
 * Bootstrap a fresh Mister Chameleon environment on a new machine.
 *
 * ─── What this does ───────────────────────────────────────────────────────────
 *
 *   1. Checks Node.js and npm versions
 *   2. Verifies required env vars are present in .env.local
 *   3. Installs npm dependencies (root + Sanity Studio)
 *   4. Applies Supabase migrations (schema)
 *   5. Seeds minimal required data:
 *      - Default platform_settings row
 *      - Prompts to create the first admin user
 *   6. Runs validation to confirm the setup is working
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   # Full bootstrap (recommended for new machines):
 *   cp .env.example .env.local
 *   # Edit .env.local with your Supabase/Sanity credentials
 *   node --experimental-strip-types scripts/bootstrap.ts
 *
 *   Options:
 *     --skip-install     Skip npm install (useful when deps are already installed)
 *     --skip-migrations  Skip DB migration apply
 *     --skip-seed        Skip seeding default data
 *     --skip-validate    Skip final validation step
 *
 * ─── Minimum required env vars ───────────────────────────────────────────────
 *
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ADMIN_SESSION_SECRET
 */

import fs   from "node:fs";
import path from "node:path";

import { loadEnv, requireEnv, hasEnv, PROJECT_ROOT } from "./lib/env.ts";
import { log }                                        from "./lib/logger.ts";
import { run, commandExists }                         from "./lib/exec.ts";
import { getSupabaseClient }                          from "./lib/supabase-client.ts";

// ── CLI args ───────────────────────────────────────────────────────────────────

const args           = process.argv.slice(2);
const skipInstall    = args.includes("--skip-install");
const skipMigrations = args.includes("--skip-migrations");
const skipSeed       = args.includes("--skip-seed");
const skipValidate   = args.includes("--skip-validate");

// ── Minimum required vars ──────────────────────────────────────────────────────

const REQUIRED_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ADMIN_SESSION_SECRET",
];

// ── Default platform settings ──────────────────────────────────────────────────

const DEFAULT_PLATFORM_SETTINGS = {
  id:          "platform",
  maintenance: false,
  created_at:  new Date().toISOString(),
  updated_at:  new Date().toISOString(),
};

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log.section("Mister Chameleon — Environment Bootstrap");

  // ── Step 1: Check Node.js version ─────────────────────────────────────────

  log.step("Checking runtime versions");
  const nodeVer = process.version;
  const major   = parseInt(nodeVer.slice(1).split(".")[0]!, 10);
  if (major < 20) {
    log.error(`Node.js ≥ 20 required. Found: ${nodeVer}`);
    process.exit(1);
  }
  log.success(`Node.js ${nodeVer}  (≥ 20 ✓)`);

  if (commandExists("npm")) {
    log.success("npm found");
  } else {
    log.error("npm not found — install Node.js from https://nodejs.org");
    process.exit(1);
  }

  // ── Step 2: Verify .env.local ─────────────────────────────────────────────

  log.step("Loading environment");
  const envFile = path.join(PROJECT_ROOT, ".env.local");
  if (!fs.existsSync(envFile)) {
    log.error(`.env.local not found at ${envFile}`);
    log.info("Create it with:  cp .env.example .env.local");
    log.info("Then fill in your Supabase and Sanity credentials.");
    process.exit(1);
  }
  loadEnv(envFile);
  log.success(".env.local loaded");

  const missing = REQUIRED_VARS.filter((k) => !hasEnv(k));
  if (missing.length > 0) {
    log.error(`Missing required env vars in .env.local:`);
    for (const k of missing) log.error(`  • ${k}`);
    process.exit(1);
  }
  log.success(`All ${REQUIRED_VARS.length} required env vars are present`);

  // ── Step 3: npm install ───────────────────────────────────────────────────

  if (!skipInstall) {
    log.step("Installing dependencies (root)");
    run("npm install --prefer-offline", { cwd: PROJECT_ROOT });
    log.success("Root dependencies installed");

    const studioDir = path.join(PROJECT_ROOT, "apps", "studio");
    if (fs.existsSync(studioDir)) {
      log.step("Installing dependencies (Sanity Studio)");
      run("npm install --prefer-offline", { cwd: studioDir });
      log.success("Sanity Studio dependencies installed");
    }
  } else {
    log.warn("--skip-install: npm install skipped");
  }

  // ── Step 4: Apply DB migrations ───────────────────────────────────────────

  if (!skipMigrations) {
    log.step("Applying database migrations");

    if (commandExists("supabase")) {
      try {
        run("supabase db push", { cwd: PROJECT_ROOT });
        log.success("Migrations applied via supabase db push");
      } catch (err) {
        log.warn("supabase db push failed. Trying manual migration...");
        await applyMigrationsManually();
      }
    } else {
      log.warn("supabase CLI not found — applying migrations via Supabase JS client");
      await applyMigrationsManually();
    }
  } else {
    log.warn("--skip-migrations: migration step skipped");
  }

  // ── Step 5: Seed minimal data ────────────────────────────────────────────

  if (!skipSeed) {
    log.step("Seeding default platform data");
    const client = getSupabaseClient();

    // platform_settings — upsert default row.
    try {
      const { error } = await client
        .from("platform_settings")
        .upsert(DEFAULT_PLATFORM_SETTINGS as never, { onConflict: "id" });
      if (error && error.code !== "23505") throw error;
      log.success("platform_settings: default row ensured");
    } catch (err) {
      log.warn("platform_settings seed skipped", (err as Error).message);
    }

    // Seed Sanity platform variant documents (optional — requires SANITY_API_TOKEN).
    // SANITY_API_TOKEN lives in apps/studio/.env.local (not root .env.local).
    // Load it explicitly so the seed step can find it when run from the project root.
    const studioEnvFile = path.join(PROJECT_ROOT, "apps", "studio", ".env.local");
    if (fs.existsSync(studioEnvFile)) {
      const { parseEnvFile } = await import("./lib/env.js");
      const studioEnv = parseEnvFile(studioEnvFile);
      for (const [k, v] of Object.entries(studioEnv)) {
        if (!(k in process.env)) process.env[k] = v;
      }
    }

    const sanityToken     = process.env["SANITY_API_TOKEN"];
    const sanityProjectId = process.env["SANITY_PROJECT_ID"] ?? process.env["NEXT_PUBLIC_SANITY_PROJECT_ID"];

    if (sanityProjectId && sanityToken) {
      log.step("Seeding Sanity platform variant documents");
      try {
        const { seedPlatform } = await import("../cms/seed/platform-seed.js") as
          { seedPlatform: (dryRun?: boolean) => Promise<void> };
        await seedPlatform(false);
        log.success("Sanity platform variants seeded");
      } catch (err) {
        log.warn("Sanity seed skipped", (err as Error).message);
      }
    } else if (sanityProjectId && !sanityToken) {
      log.warn(
        "Sanity is configured but SANITY_API_TOKEN is not set — skipping variant seed.\n" +
        "   To seed later: npx tsx cms/seed/platform-seed.ts",
      );
    } else {
      log.info("Sanity not configured — skipping platform variant seed.");
    }

    // Check if any admin users exist.
    try {
      const { data: admins } = await client.from("admin_users").select("id").limit(1);
      if (!admins || admins.length === 0) {
        log.warn("No admin users found. Create one with:");
        log.info("  node --experimental-strip-types scripts/create-admin-user.ts");
      } else {
        log.success(`Admin users: ${admins.length} found`);
      }
    } catch {
      log.warn("Could not check admin_users (table may not exist yet)");
    }
  }

  // ── Step 6: Validate ────────────────────────────────────────────────────────

  if (!skipValidate) {
    log.step("Running validation");
    try {
      run("node --experimental-strip-types scripts/validate.ts", { cwd: PROJECT_ROOT });
    } catch {
      log.warn("Validation found issues — see output above");
    }
  }

  // ── Done ──────────────────────────────────────────────────────────────────────

  log.section("Bootstrap Complete");
  log.success("Environment is ready. Start the dev server with:");
  log.info("  npm run dev");
  log.info("");
  log.info("Admin panel:   http://localhost:3000/admin");
  log.info("Sanity Studio: cd apps/studio && npm run dev");
  log.info("Storybook:     npm run storybook");
}

// ── Manual migration helper ────────────────────────────────────────────────────

async function applyMigrationsManually(): Promise<void> {
  const migrationsDir = path.join(PROJECT_ROOT, "supabase", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  log.info(`Applying ${files.length} migrations via Supabase JS client`);

  // The Supabase JS client doesn't natively support raw SQL execution outside of
  // the rpc() mechanism. For a clean bootstrap, operators should use the Supabase
  // dashboard SQL editor to apply migrations, or install the CLI.
  log.warn("Manual SQL migration requires the Supabase CLI or Dashboard SQL editor.");
  log.warn("Run each file in supabase/migrations/ in order via the SQL editor at:");
  log.warn("  https://supabase.com/dashboard/project/<your-project>/sql");
  log.info("");
  for (const f of files) {
    log.info(`  supabase/migrations/${f}`);
  }
}

main().catch((err) => {
  log.error("Bootstrap failed", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
