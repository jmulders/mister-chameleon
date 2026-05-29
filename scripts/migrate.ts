/**
 * scripts/migrate.ts
 *
 * Applies all pending Supabase migrations in order.
 *
 * Usage:
 *   npm run db:migrate
 *
 * How it works:
 *   1. Creates a _migrations table in Supabase if it doesn't exist.
 *   2. Reads all .sql files from supabase/migrations/ in alphabetical order.
 *   3. Skips files that are already recorded in _migrations.
 *   4. Applies each pending file and records it.
 *
 * Requirements:
 *   NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set
 *   in .env.local (loaded automatically by tsx via dotenv).
 *
 *   SUPABASE_ACCESS_TOKEN must also be set to enable automatic migration
 *   application and _migrations tracking. Get it from:
 *   https://supabase.com/dashboard/account/tokens
 */

import * as fs    from "fs";
import * as path  from "path";
import * as dotenv from "dotenv";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const SUPABASE_URL      = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const SUPABASE_SRVC_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const SUPABASE_ACCESS_TOKEN = process.env["SUPABASE_ACCESS_TOKEN"];

if (!SUPABASE_URL || !SUPABASE_SRVC_KEY) {
  console.error("❌  NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}

if (!SUPABASE_ACCESS_TOKEN) {
  console.error("❌  SUPABASE_ACCESS_TOKEN must be set in .env.local");
  console.error("   Get it from: https://supabase.com/dashboard/account/tokens");
  process.exit(1);
}

const PROJECT_REF = SUPABASE_URL.replace("https://", "").split(".")[0];
const MGMT_BASE   = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database`;
const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");

// ── Management API: run arbitrary SQL ────────────────────────────────────────

async function runSQL(
  sql: string,
): Promise<{ ok: true; rows: Record<string, unknown>[] } | { ok: false; error: string }> {
  const res = await fetch(`${MGMT_BASE}/query`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${SUPABASE_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: `${res.status}: ${body.slice(0, 300)}` };
  }

  let rows: Record<string, unknown>[] = [];
  try {
    rows = (await res.json()) as Record<string, unknown>[];
  } catch {
    // Non-SELECT statements return empty body — that's fine
  }
  return { ok: true, rows };
}

// ── Bootstrap: create migration tracking table ────────────────────────────────

async function ensureMigrationsTable(): Promise<void> {
  const result = await runSQL(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename   TEXT        PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  if (!result.ok) {
    throw new Error(`Could not create _migrations table: ${result.error}`);
  }
}

// ── Query applied migrations ──────────────────────────────────────────────────

async function getApplied(): Promise<Set<string>> {
  const result = await runSQL(`SELECT filename FROM _migrations ORDER BY applied_at;`);
  if (!result.ok) {
    // Table might not exist yet (rare: ensureMigrationsTable should have run first)
    return new Set();
  }
  return new Set(result.rows.map((r) => r["filename"] as string));
}

// ── Record a successfully applied migration ───────────────────────────────────

async function recordMigration(filename: string): Promise<void> {
  // Use Management API directly — avoids PostgREST schema-cache staleness
  // (PostgREST may not see a brand-new _migrations table until it reloads).
  const escaped = filename.replace(/'/g, "''");
  await runSQL(
    `INSERT INTO _migrations (filename) VALUES ('${escaped}') ON CONFLICT (filename) DO NOTHING;`,
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔄  Mister Chameleon — DB migration runner\n");

  // 1. Ensure the tracking table exists
  process.stdout.write("  Ensuring _migrations table exists… ");
  try {
    await ensureMigrationsTable();
    console.log("✅");
  } catch (err) {
    console.log(`❌  ${(err as Error).message}`);
    process.exit(1);
  }

  // 2. Load already-applied migrations
  const applied = await getApplied();
  console.log(`  Already applied: ${applied.size} migration(s)\n`);

  // 3. Read migration files (alphabetical = chronological by naming convention)
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const pending = files.filter((f) => !applied.has(f));

  if (pending.length === 0) {
    console.log("✅  All migrations are up to date.");
    return;
  }

  console.log(`  Pending: ${pending.length} migration(s)\n`);

  let succeeded = 0;
  let failed    = 0;

  for (const filename of pending) {
    const filepath = path.join(MIGRATIONS_DIR, filename);
    const sql      = fs.readFileSync(filepath, "utf-8");

    process.stdout.write(`  ⏳  ${filename} … `);

    const result = await runSQL(sql);

    if (!result.ok) {
      console.log(`❌  ${result.error.slice(0, 200)}`);
      failed++;
    } else {
      await recordMigration(filename);
      console.log("✅");
      succeeded++;
    }
  }

  console.log(`\n  Done: ${succeeded} applied, ${failed} skipped/failed.`);

  if (failed > 0) {
    console.log(`
ℹ️  ${failed} migration(s) failed. Fix the SQL errors above and re-run:

    npm run db:migrate

Already-applied migrations will be skipped automatically.
    `);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Migration runner crashed:", err);
  process.exit(1);
});
