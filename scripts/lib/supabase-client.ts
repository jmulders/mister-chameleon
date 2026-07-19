/**
 * scripts/lib/supabase-client.ts
 *
 * Supabase service-role client for backup/restore scripts.
 *
 * Uses the service role key so all rows across all tenants are accessible.
 * Never import this in Next.js application code — scripts only.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "./env.ts";

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url     = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const svcRole = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  _client = createClient(url, svcRole, {
    auth: { persistSession: false, autoRefreshToken: false },
    db:   { schema: "public" },
  });

  return _client;
}

/**
 * All tables that should be included in data backups, FK-ordered for restore.
 *
 * This used to be a second, hand-maintained list here — and it had drifted badly:
 * it named `tenants` (the table is `tenant_settings`), `scoring_rules` (it is
 * `behavior_scoring_rules`) and `visitor_journey`, none of which exist, and it
 * covered 24 tables where the real set is 53. A backup that quietly skips a third
 * of the config is worse than no backup. So there is now ONE source of truth —
 * lib/backup/backup-tables.ts, the same list the in-app backup/restore routes use.
 */
export { BACKUP_TABLES } from "../../lib/backup/backup-tables.ts";

/**
 * Fetch all rows from a table.
 * Returns rows as plain JSON-serialisable objects.
 */
export async function fetchTableData(
  client: SupabaseClient,
  table: string,
): Promise<Record<string, unknown>[]> {
  const { data, error } = await client.from(table).select("*");
  if (error) {
    // Table may not exist in all environments — warn but don't crash.
    if (error.code === "42P01") return []; // relation does not exist
    throw new Error(`Failed to fetch ${table}: ${error.message}`);
  }
  return (data ?? []) as Record<string, unknown>[];
}

/**
 * Insert rows into a table.
 * Uses upsert so the script is idempotent on re-runs.
 * `conflictColumn` should be the primary key column (usually "id").
 */
export async function upsertTableData(
  client: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  conflictColumn = "id",
): Promise<void> {
  if (rows.length === 0) return;

  // Batch in chunks of 500 to avoid request size limits.
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await client
      .from(table)
      .upsert(chunk as never[], { onConflict: conflictColumn, ignoreDuplicates: false });

    if (error) {
      throw new Error(`Failed to upsert into ${table}: ${error.message}`);
    }
  }
}
