#!/usr/bin/env node
/**
 * scripts/backup.ts
 *
 * Full-system backup for Mister Chameleon.
 *
 * ─── What is captured ─────────────────────────────────────────────────────────
 *
 *   /code          — git archive of the current HEAD
 *   /db-schema     — Supabase migration SQL files + optional pg_dump schema
 *   /db-data       — All table rows exported as newline-delimited JSON
 *   /sanity        — Sanity dataset export via CLI (when available)
 *   /config        — .env.example, platform_settings rows, sanitized env vars
 *   /assets        — public/ uploads, storybook build artefacts
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   node --experimental-strip-types scripts/backup.ts
 *   node --experimental-strip-types scripts/backup.ts --output=./my-backups
 *   node --experimental-strip-types scripts/backup.ts --no-code    # skip git archive
 *   node --experimental-strip-types scripts/backup.ts --no-sanity  # skip Sanity export
 *
 * ─── Backup directory layout ─────────────────────────────────────────────────
 *
 *   backups/
 *     2026-04-18T12-00-00Z/
 *       manifest.json          — metadata, table counts, git SHA
 *       code/
 *         repo.tar.gz          — git archive (HEAD)
 *       db-schema/
 *         migrations/          — copy of supabase/migrations/*.sql
 *         schema.sql           — pg_dump --schema-only (if pg_dump available)
 *       db-data/
 *         <table>.ndjson       — newline-delimited JSON per table
 *       sanity/
 *         <dataset>.tar.gz     — sanity dataset export (if CLI available)
 *         schemas/             — compiled JSON schemas from cms/schemas
 *       config/
 *         env.example          — sanitized .env.example
 *         platform-settings.json
 *       assets/
 *         public/              — public/ directory (minus node_modules, etc.)
 */

import fs   from "node:fs";
import path from "node:path";

import { loadEnv, requireEnv, hasEnv, PROJECT_ROOT } from "./lib/env.ts";
import { log }                                        from "./lib/logger.ts";
import { run, capture, commandExists }                from "./lib/exec.ts";
import { ensureDir, writeJson, copyDir, copyIfExists, formatBytes, fileSize } from "./lib/fs-utils.ts";
import { getSupabaseClient, BACKUP_TABLES, fetchTableData } from "./lib/supabase-client.ts";

// ── CLI args ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const outputBase = args.find((a) => a.startsWith("--output="))?.slice(9)
  ?? path.join(PROJECT_ROOT, "backups");
const skipCode   = args.includes("--no-code");
const skipSanity = args.includes("--no-sanity");
const skipData   = args.includes("--no-data");

// ── Timestamps ─────────────────────────────────────────────────────────────────

const now         = new Date();
const timestamp   = now.toISOString().replace(/[:.]/g, "-").slice(0, 19) + "Z";
const backupDir   = path.join(outputBase, timestamp);

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log.section(`Mister Chameleon — Full System Backup`);
  log.info(`Timestamp:   ${timestamp}`);
  log.info(`Output:      ${backupDir}`);
  log.info(`Project:     ${PROJECT_ROOT}`);

  // Load env vars from .env.local.
  loadEnv();

  // Create the backup root.
  ensureDir(backupDir);

  // ── 1. Manifest skeleton ────────────────────────────────────────────────────

  const manifest: Record<string, unknown> = {
    version:    "1",
    timestamp,
    createdAt:  now.toISOString(),
    gitSha:     "",
    gitBranch:  "",
    sections:   {} as Record<string, { ok: boolean; detail?: string }>,
    tableRows:  {} as Record<string, number>,
  };

  // ── 2. Code snapshot ────────────────────────────────────────────────────────

  if (!skipCode) {
    log.step("Code — git archive");
    const codeDir = path.join(backupDir, "code");
    ensureDir(codeDir);
    try {
      const sha    = capture("git rev-parse HEAD",    { cwd: PROJECT_ROOT, verbose: false });
      const branch = capture("git rev-parse --abbrev-ref HEAD", { cwd: PROJECT_ROOT, verbose: false });
      manifest.gitSha    = sha;
      manifest.gitBranch = branch;

      const archivePath = path.join(codeDir, "repo.tar.gz");
      run(`git archive --format=tar.gz HEAD -o ${archivePath}`, { cwd: PROJECT_ROOT });
      log.success(`Code archived  (${formatBytes(fileSize(archivePath))})  sha=${sha.slice(0, 8)}`);
      (manifest.sections as Record<string, unknown>).code = { ok: true, detail: `sha=${sha.slice(0,8)} branch=${branch}` };
    } catch (err) {
      log.warn("Code archive skipped — git not available or not a git repo", (err as Error).message);
      (manifest.sections as Record<string, unknown>).code = { ok: false, detail: String(err) };
    }
  }

  // ── 3. DB schema ────────────────────────────────────────────────────────────

  {
    log.step("DB schema — migrations");
    const schemaDir = path.join(backupDir, "db-schema");
    const migrationsDir = path.join(schemaDir, "migrations");
    ensureDir(migrationsDir);

    const srcMigrations = path.join(PROJECT_ROOT, "supabase", "migrations");
    copyDir(srcMigrations, migrationsDir);
    const count = fs.readdirSync(migrationsDir).length;
    log.success(`Migrations copied: ${count} files`);

    // Optional: pg_dump --schema-only (requires DB_URL or supabase CLI).
    if (commandExists("supabase") && hasEnv("NEXT_PUBLIC_SUPABASE_URL")) {
      try {
        const schemaSql = path.join(schemaDir, "schema.sql");
        run(`supabase db dump --file ${schemaSql}`, { cwd: PROJECT_ROOT, ignoreErrors: true });
        if (fs.existsSync(schemaSql)) {
          log.success(`pg_dump schema: ${formatBytes(fileSize(schemaSql))}`);
        }
      } catch {
        log.warn("supabase db dump skipped (CLI error — migrations folder is sufficient)");
      }
    }
    (manifest.sections as Record<string, unknown>).dbSchema = { ok: true, detail: `${count} migrations` };
  }

  // ── 4. DB data ───────────────────────────────────────────────────────────────

  if (!skipData) {
    log.step("DB data — table export");
    const dataDir = path.join(backupDir, "db-data");
    ensureDir(dataDir);

    const client = getSupabaseClient();
    const tableRows: Record<string, number> = {};

    for (const table of BACKUP_TABLES) {
      try {
        const rows = await fetchTableData(client, table);
        const ndjsonPath = path.join(dataDir, `${table}.ndjson`);
        fs.writeFileSync(ndjsonPath, rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : ""), "utf8");
        tableRows[table] = rows.length;
        log.info(`  ${table.padEnd(36)} ${rows.length} rows`);
      } catch (err) {
        log.warn(`  ${table} — skipped: ${(err as Error).message}`);
        tableRows[table] = -1;
      }
    }

    manifest.tableRows = tableRows;
    const totalRows = Object.values(tableRows).filter((n) => n >= 0).reduce((a, b) => a + b, 0);
    log.success(`DB data exported: ${BACKUP_TABLES.length} tables, ${totalRows} total rows`);
    (manifest.sections as Record<string, unknown>).dbData = { ok: true, detail: `${totalRows} rows across ${BACKUP_TABLES.length} tables` };
  }

  // ── 5. Sanity export ─────────────────────────────────────────────────────────

  if (!skipSanity) {
    log.step("Sanity — dataset export");
    const sanityDir = path.join(backupDir, "sanity");
    ensureDir(sanityDir);

    const projectId = process.env["SANITY_PROJECT_ID"] ?? process.env["SANITY_STUDIO_PROJECT_ID"];
    const dataset   = process.env["SANITY_DATASET"] ?? "production";

    if (!projectId) {
      log.warn("Sanity skipped — SANITY_PROJECT_ID not set");
      (manifest.sections as Record<string, unknown>).sanity = { ok: false, detail: "SANITY_PROJECT_ID not set" };
    } else if (!commandExists("sanity")) {
      log.warn("Sanity skipped — 'sanity' CLI not found. Install: npm i -g @sanity/cli");
      (manifest.sections as Record<string, unknown>).sanity = { ok: false, detail: "sanity CLI not found" };
    } else {
      try {
        const exportPath = path.join(sanityDir, `${dataset}.tar.gz`);
        run(
          `sanity dataset export ${dataset} ${exportPath} --project-id ${projectId} --overwrite`,
          { cwd: path.join(PROJECT_ROOT, "apps", "studio"), ignoreErrors: true },
        );
        if (fs.existsSync(exportPath)) {
          log.success(`Sanity export: ${formatBytes(fileSize(exportPath))}`);
          (manifest.sections as Record<string, unknown>).sanity = { ok: true, detail: `${dataset} dataset` };
        } else {
          log.warn("Sanity export file not created — check CLI output above");
          (manifest.sections as Record<string, unknown>).sanity = { ok: false, detail: "export file not created" };
        }
      } catch (err) {
        log.warn("Sanity export failed", (err as Error).message);
        (manifest.sections as Record<string, unknown>).sanity = { ok: false, detail: String(err) };
      }
    }

    // Always copy the schema source files (no auth required).
    const schemasDir = path.join(sanityDir, "schemas");
    copyDir(path.join(PROJECT_ROOT, "cms", "schemas"), schemasDir);
    const schemaCount = fs.existsSync(schemasDir)
      ? fs.readdirSync(schemasDir, { recursive: true }).length
      : 0;
    log.info(`Sanity schema files: ${schemaCount}`);
  }

  // ── 6. Config ─────────────────────────────────────────────────────────────────

  {
    log.step("Config — environment + platform settings");
    const configDir = path.join(backupDir, "config");
    ensureDir(configDir);

    // .env.example (never contains secrets — safe to include)
    copyIfExists(
      path.join(PROJECT_ROOT, ".env.example"),
      path.join(configDir, "env.example"),
    );

    // apps/studio/.env.local.example (Sanity Studio env template — includes SANITY_API_TOKEN docs)
    copyIfExists(
      path.join(PROJECT_ROOT, "apps", "studio", ".env.local.example"),
      path.join(configDir, "sanity-studio-env.example"),
    );

    // Record whether the studio write token is present (key presence only — never the value).
    // This token lives in apps/studio/.env.local, not root .env.local.
    const studioEnvFile = path.join(PROJECT_ROOT, "apps", "studio", ".env.local");
    if (fs.existsSync(studioEnvFile)) {
      const { parseEnvFile } = await import("./lib/env.js");
      const studioEnv = parseEnvFile(studioEnvFile);
      const studioKeys = Object.keys(studioEnv);
      writeJson(path.join(configDir, "studio-env-keys.json"), {
        note: "Key names only — values are never exported. File: apps/studio/.env.local",
        keys: studioKeys,
        hasWriteToken: studioKeys.includes("SANITY_API_TOKEN"),
      });
      log.info(`Studio env keys: ${studioKeys.length} documented (hasWriteToken=${studioKeys.includes("SANITY_API_TOKEN")})`);
    }

    // Export platform_settings from DB.
    if (!skipData) {
      try {
        const client   = getSupabaseClient();
        const settings = await fetchTableData(client, "platform_settings");
        writeJson(path.join(configDir, "platform-settings.json"), settings);
        log.info(`Platform settings: ${settings.length} rows`);
      } catch (err) {
        log.warn("platform_settings export skipped", (err as Error).message);
      }
    }

    // Write a sanitized manifest of required env vars (keys only, no values).
    const envExample    = path.join(PROJECT_ROOT, ".env.example");
    const { parseEnvFile } = await import("./lib/env.js");
    const exampleKeys   = Object.keys(parseEnvFile(envExample));
    writeJson(path.join(configDir, "required-env-keys.json"), exampleKeys);
    log.success(`Config saved: ${exampleKeys.length} env var keys documented`);
    (manifest.sections as Record<string, unknown>).config = { ok: true };
  }

  // ── 7. Assets ─────────────────────────────────────────────────────────────────

  {
    log.step("Assets — public directory");
    const assetsDir = path.join(backupDir, "assets");
    ensureDir(assetsDir);

    // Copy public/ (exclude node_modules if symlinked somehow)
    const publicSrc = path.join(PROJECT_ROOT, "public");
    if (fs.existsSync(publicSrc)) {
      copyDir(publicSrc, path.join(assetsDir, "public"));
      log.success("public/ copied");
    }

    // Storybook build (if present)
    const storybookBuild = path.join(PROJECT_ROOT, "storybook-static");
    if (fs.existsSync(storybookBuild)) {
      copyDir(storybookBuild, path.join(assetsDir, "storybook-static"));
      log.success("storybook-static/ copied");
    }
    (manifest.sections as Record<string, unknown>).assets = { ok: true };
  }

  // ── 8. Write final manifest ──────────────────────────────────────────────────

  writeJson(path.join(backupDir, "manifest.json"), manifest);
  log.success(`manifest.json written`);

  // ── Summary ───────────────────────────────────────────────────────────────────

  log.section("Backup Complete");
  log.success(`Backup stored at: ${backupDir}`);

  const sections = manifest.sections as Record<string, { ok: boolean; detail?: string }>;
  for (const [name, result] of Object.entries(sections)) {
    const icon = result.ok ? "✓" : "⚠";
    log.info(`  ${icon} ${name.padEnd(16)} ${result.detail ?? ""}`);
  }
}

main().catch((err) => {
  log.error("Backup failed", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
