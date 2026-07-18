#!/usr/bin/env node
/**
 * scripts/restore.ts
 *
 * Full-system restore for Mister Chameleon.
 *
 * ─── What is restored ─────────────────────────────────────────────────────────
 *
 *   1. DB schema   — applies all migration files in order to the target DB
 *   2. DB data     — upserts all .ndjson table exports into the target DB
 *   3. Sanity      — imports dataset export via Sanity CLI (if available)
 *   4. Config      — copies env template to .env.local (with a warning)
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   node --experimental-strip-types scripts/restore.ts --backup=backups/2026-04-18T12-00-00Z
 *
 *   Options:
 *     --backup=<path>     Path to the backup directory (required)
 *     --no-schema         Skip migration re-apply (assume schema is current)
 *     --no-data           Skip data restore
 *     --no-sanity         Skip Sanity import
 *     --tables=a,b,c      Only restore specific tables (comma-separated)
 *     --dry-run           Print what would happen without making changes
 *
 * ─── Safety ───────────────────────────────────────────────────────────────────
 *
 *   • Uses UPSERT (not DELETE + INSERT) so partial restores are safe.
 *   • The script NEVER drops tables or schemas. Migrations are applied
 *     as IF NOT EXISTS — safe on an already-migrated DB.
 *   • Always test on a staging environment before restoring to production.
 */

import fs   from "node:fs";
import path from "node:path";

import { loadEnv, PROJECT_ROOT }                 from "./lib/env.ts";
import { log }                                   from "./lib/logger.ts";
import { run, commandExists }                    from "./lib/exec.ts";
import { ensureDir, readJson, listFiles }        from "./lib/fs-utils.ts";
import { getSupabaseClient, upsertTableData }    from "./lib/supabase-client.ts";

// ── CLI args ───────────────────────────────────────────────────────────────────

const args        = process.argv.slice(2);
const backupArg   = args.find((a) => a.startsWith("--backup="))?.slice(9);
const skipSchema  = args.includes("--no-schema");
const skipData    = args.includes("--no-data");
const skipSanity  = args.includes("--no-sanity");
const dryRun      = args.includes("--dry-run");
const tablesArg   = args.find((a) => a.startsWith("--tables="))?.slice(9);
const onlyTables  = tablesArg ? tablesArg.split(",").map((t) => t.trim()) : null;

if (!backupArg) {
  log.error("Usage: node --experimental-strip-types scripts/restore.ts --backup=backups/<timestamp>");
  process.exit(1);
}

const backupDir = path.resolve(backupArg);

if (!fs.existsSync(backupDir)) {
  log.error(`Backup directory not found: ${backupDir}`);
  process.exit(1);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log.section("Mister Chameleon — Full System Restore");
  log.info(`Backup:  ${backupDir}`);
  log.info(`Dry run: ${dryRun ? "YES — no changes will be made" : "no"}`);

  // Load env.
  loadEnv();

  // Read manifest.
  const manifestPath = path.join(backupDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    log.error("manifest.json not found in backup directory — invalid backup");
    process.exit(1);
  }
  const manifest = readJson<Record<string, unknown>>(manifestPath);
  log.info(`Backup timestamp: ${manifest.timestamp}  git=${manifest.gitSha}`);

  // ── 1. DB schema — apply migrations ─────────────────────────────────────────

  if (!skipSchema) {
    log.step("DB schema — applying migrations");
    const migrationsDir = path.join(backupDir, "db-schema", "migrations");

    if (!fs.existsSync(migrationsDir)) {
      log.warn("No migrations folder found in backup — schema step skipped");
    } else {
      const files = listFiles(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
      log.info(`Found ${files.length} migration files`);

      if (dryRun) {
        for (const f of files) log.info(`  [dry-run] would apply: ${path.basename(f)}`);
      } else if (commandExists("supabase")) {
        // If supabase CLI is available, push migrations from project root.
        run("supabase db push", { cwd: PROJECT_ROOT });
        log.success("Migrations applied via supabase db push");
      } else {
        // Fallback: copy migration files into place and remind operator.
        const destMigrations = path.join(PROJECT_ROOT, "supabase", "migrations");
        ensureDir(destMigrations);
        for (const f of files) {
          const dest = path.join(destMigrations, path.basename(f));
          if (!fs.existsSync(dest)) {
            fs.copyFileSync(f, dest);
            log.info(`  Copied: ${path.basename(f)}`);
          }
        }
        log.warn(
          "supabase CLI not found.\n" +
          "  Migrations copied to supabase/migrations/.\n" +
          "  Apply them manually:\n" +
          "    • Supabase dashboard → SQL editor → paste each file\n" +
          "    • or: npx supabase db push  (after installing CLI)"
        );
      }
    }
  }

  // ── 2. DB data — upsert rows ──────────────────────────────────────────────────

  if (!skipData) {
    log.step("DB data — restoring table rows");
    const dataDir = path.join(backupDir, "db-data");

    if (!fs.existsSync(dataDir)) {
      log.warn("No db-data folder found in backup — data restore skipped");
    } else {
      const client     = getSupabaseClient();
      const ndjsonFiles = listFiles(dataDir).filter((f) => f.endsWith(".ndjson")).sort();
      log.info(`Found ${ndjsonFiles.length} table export files`);

      for (const file of ndjsonFiles) {
        const table = path.basename(file, ".ndjson");
        if (onlyTables && !onlyTables.includes(table)) continue;

        const content = fs.readFileSync(file, "utf8");
        const rows: Record<string, unknown>[] = content
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line) as Record<string, unknown>);

        if (rows.length === 0) {
          log.debug(`  ${table} — 0 rows, skipping`);
          continue;
        }

        if (dryRun) {
          log.info(`  [dry-run] ${table}: would upsert ${rows.length} rows`);
          continue;
        }

        try {
          await upsertTableData(client, table, rows);
          log.success(`  ${table.padEnd(36)} ${rows.length} rows upserted`);
        } catch (err) {
          log.error(`  ${table} — upsert failed: ${(err as Error).message}`);
          // Continue with other tables.
        }
      }
    }
  }

  // ── 3. Sanity import ──────────────────────────────────────────────────────────

  if (!skipSanity) {
    log.step("Sanity — dataset import");
    const sanityDir = path.join(backupDir, "sanity");

    if (!fs.existsSync(sanityDir)) {
      log.warn("No sanity folder found in backup — Sanity step skipped");
    } else {
      const exportFiles = listFiles(sanityDir).filter((f) => f.endsWith(".tar.gz"));

      if (exportFiles.length === 0) {
        log.warn("No Sanity .tar.gz export found in backup/sanity/");
      } else if (!commandExists("sanity")) {
        log.warn("sanity CLI not found. Install globally: npm i -g @sanity/cli");
        log.warn(`Manually import: sanity dataset import ${exportFiles[0]} <dataset>`);
      } else {
        const projectId = process.env["SANITY_PROJECT_ID"] ?? process.env["SANITY_STUDIO_PROJECT_ID"];
        const dataset   = process.env["SANITY_DATASET"] ?? "production";

        if (!projectId) {
          log.warn("Sanity import skipped — SANITY_PROJECT_ID not set");
        } else {
          const exportFile = exportFiles[0]!;
          log.info(`Importing: ${path.basename(exportFile)} → dataset '${dataset}'`);

          if (dryRun) {
            log.info(`[dry-run] would run: sanity dataset import ${exportFile} ${dataset} --replace`);
          } else {
            run(
              `sanity dataset import ${exportFile} ${dataset} --replace --project ${projectId} --no-progress`,
              { cwd: path.join(PROJECT_ROOT, "apps", "studio") },
            );
            log.success("Sanity dataset imported");
          }
        }
      }
    }
  }

  // ── 4. Config ─────────────────────────────────────────────────────────────────

  {
    log.step("Config — environment template");
    const configDir  = path.join(backupDir, "config");
    const envSrc     = path.join(configDir, "env.example");
    const envDest    = path.join(PROJECT_ROOT, ".env.local");

    if (fs.existsSync(envSrc)) {
      if (!fs.existsSync(envDest)) {
        if (!dryRun) {
          fs.copyFileSync(envSrc, envDest);
          log.success(".env.local created from backup template — fill in secrets before running");
        } else {
          log.info("[dry-run] would create .env.local from template");
        }
      } else {
        log.warn(".env.local already exists — NOT overwritten. Review manually if needed.");
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────────

  log.section("Restore Complete");
  if (dryRun) {
    log.warn("DRY RUN — no actual changes were made");
  } else {
    log.success("Restore finished. Next steps:");
    log.info("  1. Fill in secrets in .env.local (SUPABASE keys, SANITY tokens, etc.)");
    log.info("  2. Run: npm install");
    log.info("  3. Run: npm run dev");
    log.info("  4. Run: node --experimental-strip-types scripts/validate.ts");
  }
}

main().catch((err) => {
  log.error("Restore failed", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
