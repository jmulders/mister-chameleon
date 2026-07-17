/**
 * /api/admin/backup
 *
 * POST — Create a new platform backup (snapshot of all config tables).
 * GET  — List existing backups (metadata only, no data payload).
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   Both methods require a valid admin session.
 *   The backup data (JSONB) is stored in platform_backups and is never
 *   returned in the GET list response — only metadata.
 *
 * ─── What is backed up ────────────────────────────────────────────────────────
 *
 *   Configuration tables only.  Analytics/event tables (sessions, events,
 *   served_variants, visitor_journey, ai_decision_logs) are intentionally
 *   excluded — they are large, append-only, and not meaningful to restore.
 *
 * ─── Retention ────────────────────────────────────────────────────────────────
 *
 *   After inserting a new backup, any backups beyond the newest MAX_BACKUPS
 *   are deleted (oldest first).  This prevents unbounded table growth.
 */

import { NextRequest, NextResponse } from "next/server";
import { getRequiredAdminSession }   from "@/lib/admin-auth/authorization";
import { getDb }                     from "@/data/db";

// ── Constants ─────────────────────────────────────────────────────────────────

/** How many backup rows to keep.  Oldest are pruned when this limit is exceeded. */
const MAX_BACKUPS = 20;

/**
 * Tables included in a platform backup.
 * Ordered so FK constraints are satisfied on restore.
 * Analytics / event tables are intentionally excluded.
 */
// ─── Wat hier NIET in staat ──────────────────────────────────────────────────
//
// Dit dekt 13 van de 105 tabellen. Twee namen die er wél in stonden bestaan niet
// in de database: "tenants" en "scoring_rules". Regel ~112 hieronder slaat
// ontbrekende tabellen stil over ("Skip tables that don't exist in this
// environment"), dus die twee deden al niets — alleen zei niemand het.
//
// "scoring_rules" was vermoedelijk bedoeld als `behavior_scoring_rules`. Die
// heeft 74 rijen. Ze zitten niet in je backup. Net zomin als:
//
//   behavior_scoring_rules    74     tenant_interest_profiles  34
//   adaptive_blocks           59     interest_profiles         26
//   audience_segments         21     site_navigation           10
//   tenant_pipeline_stages     9     tenant_wallets             2
//
// Dat is de hele tenant-configuratie plus de creditsaldi van klanten.
//
// Bewust NIET uitgebreid op 17 juli 2026: welke tabellen in een backup horen is
// een beslissing over wat je bij verlies terug wilt kunnen zetten, en in welke
// volgorde (FK's). Dat is werk, geen opruiming. De twee spoken zijn hier alleen
// verwijderd omdat ze niets deden en de typecheck blokkeerden.
const BACKUP_TABLES = [
  // Platform / global
  "admin_users",
  "platform_settings",
  // Per-tenant config
  "tenant_settings",
  "tenant_domains",
  "tenant_email_transport",
  "tenant_form_settings",
  "tenant_form_overrides",
  "context_variable_metadata",
  "rules_config",
  "pages",
  // Billing config
  "billing_plans",
  "subscriptions",
  "credit_balance",
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BackupMeta {
  id:                   string;
  created_at:           string;
  created_by:           string;
  label:                string | null;
  version:              number;
  status:               "pending" | "complete" | "failed";
  error:                string | null;
  tables:               string[];
  row_count:            number;
  restored_from_version: number | null;
}

// ── POST — create backup ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getRequiredAdminSession();
  const db      = getDb();

  // Optional label from request body
  let label: string | undefined;
  try {
    const body = await req.json() as { label?: string };
    label = typeof body.label === "string" ? body.label.trim() : undefined;
  } catch {
    // No body / invalid JSON — that's fine, label is optional
  }

  // ── Determine next version number ─────────────────────────────────────────
  const { data: latest, error: verErr } = await db
    .from("platform_backups")
    .select("version")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (verErr) {
    return NextResponse.json({ error: `DB error: ${verErr.message}` }, { status: 500 });
  }

  const nextVersion = ((latest as { version: number } | null)?.version ?? 0) + 1;

  // ── Snapshot all config tables ────────────────────────────────────────────
  const data: Record<string, unknown[]> = {};
  let totalRows = 0;
  const includedTables: string[] = [];

  for (const table of BACKUP_TABLES) {
    const { data: rows, error } = await db.from(table).select("*");
    if (error) {
      // Skip tables that don't exist in this environment.
      //   42P01    — PostgreSQL "undefined_table"
      //   PGRST200 — PostgREST "table not in schema cache" (Supabase returns this
      //              when the table is absent or PostgREST hasn't seen it yet)
      const isTableMissing =
        error.code === "42P01" ||
        error.code === "PGRST200" ||
        error.message?.includes("schema cache") ||
        error.message?.includes("Could not find the table");
      if (isTableMissing) continue;
      return NextResponse.json(
        { error: `Failed to read ${table}: ${error.message}` },
        { status: 500 },
      );
    }
    if (rows && rows.length > 0) {
      data[table]  = rows;
      totalRows   += rows.length;
      includedTables.push(table);
    }
  }

  // ── Insert the backup row ─────────────────────────────────────────────────
  // (db as any) — zoals de 24 andere plekken in deze codebase.
  //
  // data/types.ts bevat een HANDGESCHREVEN Database-type. Dat mist per tabel de
  // door @supabase/postgrest-js vereiste `Relationships`-sleutel, plus Views /
  // Functions / Enums / CompositeTypes op schemaniveau. Daardoor faalt het type
  // zijn GenericSchema-constraint en resolvet supabase-js ELKE tabel naar `never`
  // — niet alleen platform_backups. De getypte client heeft dus nooit iets getypt,
  // en deze cast verliest geen enkele veiligheid die er was.
  //
  // De echte oplossing is genereren i.p.v. handschrijven:
  //   npx supabase gen types typescript --linked > data/database.types.ts
  // Daarna kunnen deze 24 casts weg. Zie docs/testing.md.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error: insErr } = await (db as any)
    .from("platform_backups")
    .insert({
      created_by: session.email ?? "admin",
      label:      label ?? null,
      version:    nextVersion,
      status:     "complete",
      tables:     includedTables,
      row_count:  totalRows,
      data,
    })
    .select("id, created_at, created_by, label, version, status, tables, row_count, restored_from_version")
    .single();

  if (insErr || !inserted) {
    return NextResponse.json(
      { error: `Failed to save backup: ${insErr?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  // ── Prune old backups ─────────────────────────────────────────────────────
  // Keep MAX_BACKUPS newest; delete anything older.
  const { data: allVersions } = await db
    .from("platform_backups")
    .select("id, version")
    .order("version", { ascending: false });

  if (allVersions && allVersions.length > MAX_BACKUPS) {
    const toDelete = (allVersions as { id: string; version: number }[])
      .slice(MAX_BACKUPS)
      .map((r) => r.id);

    if (toDelete.length > 0) {
      await db.from("platform_backups").delete().in("id", toDelete);
    }
  }

  return NextResponse.json({ ok: true, backup: inserted as BackupMeta });
}

// ── GET — list backups ────────────────────────────────────────────────────────

export async function GET() {
  await getRequiredAdminSession();
  const db = getDb();

  const { data, error } = await db
    .from("platform_backups")
    .select("id, created_at, created_by, label, version, status, error, tables, row_count, restored_from_version")
    .order("version", { ascending: false })
    .limit(MAX_BACKUPS);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ backups: (data ?? []) as BackupMeta[] });
}
