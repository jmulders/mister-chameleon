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
// ─── Wat hier wel en niet in hoort ───────────────────────────────────────────
//
// Eén vraag bepaalt de lijst: **wat moet je met de hand terugbouwen als het weg
// is?** Configuratie dus, geen geschiedenis. `served_variants` (76.920 rijen) en
// `ai_decision_logs` (60.691) zijn waardevol maar reconstrueerbaar noch
// herbouwbaar — dat is telemetrie, en het zou deze JSON-blob onbruikbaar groot
// maken. Wil je die bewaren, gebruik dan een echte pg_dump.
//
// Deze lijst dekte tot 17 juli 2026 dertien tabellen, waarvan er twee niet
// bestonden: "tenants" en "scoring_rules". De lus hieronder slaat ontbrekende
// tabellen stil over, dus die twee deden al niets — en niemand zei het.
// "scoring_rules" was vrijwel zeker `behavior_scoring_rules` bedoeld: 74 rijen
// scoringsregels die niemand in een backup had.
//
// De volgorde is bewust: de restore werkt hem van boven naar beneden af, dus
// verwijzingen komen na waar ze naar wijzen.
export const BACKUP_TABLES = [
  // ── Platform ───────────────────────────────────────────────────────────────
  "platform_settings",
  "admin_users",
  "admin_user_tenants",       // wie bij welke tenant mag — stond er niet in
  "billing_defaults",
  "billing_plans",
  "credit_pricing",
  "enrichment_pricing",
  "enrichment_price_cards",
  "decay_profiles",
  "interest_profiles",        // de catalogus
  "interest_profile_tags",
  "behavior_scoring_rules",   // 74 rijen — de "scoring_rules"-spook
  "behavior_sequence_patterns",
  "site_types",
  "theme_presets",
  "page_templates",
  "site_blueprints",
  "context_variable_metadata",
  "platform_cms_content",
  "agency_branding",
  "agency_memberships",

  // ── Tenant-configuratie ────────────────────────────────────────────────────
  "tenant_settings",
  "tenant_sites",
  "tenant_site_setup",
  "tenant_domains",
  "tenant_email_transport",
  "tenant_form_settings",
  "tenant_form_overrides",
  "tenant_search_settings",
  "tenant_dunning_settings",
  "tenant_pipeline_stages",
  "tenant_interest_profiles",
  "tenant_assets",            // metadata; de bestanden zelf staan in Storage — zie hieronder
  "audience_segments",
  "adaptive_blocks",          // 59 blokken, met de hand geschreven
  "rules_config",
  "runtime_rules",
  "pages",
  "navigation",
  "site_navigation",
  "abm_settings",
  "ad_sync_settings",
  "demo_instances",

  // ── Geld ───────────────────────────────────────────────────────────────────
  //
  // Saldi zonder hun ledger zijn een getal zonder verantwoording. Beide, of geen
  // van beide. wallet_ledger is 3.717 rijen — groot voor deze lijst, maar het is
  // de enige plek waar staat waarom een saldo is wat het is.
  "subscriptions",
  "tenant_wallets",
  "wallet_ledger",
  "credit_balance",
  "credit_transactions",
  "session_credit_balances",
  "session_credit_ledger",
  "wallet_webhook_events",    // idempotentie: voorkomt dubbel verwerken van Stripe-events

  // ── Wat je juridisch niet kwijt mag ────────────────────────────────────────
  //
  // lead_suppressions zijn opt-outs. Die kwijtraken betekent mensen mailen die
  // gezegd hebben dat niet te willen. Dat is geen ongemak maar een AVG-probleem,
  // en het staat hier bovenaan de "waarom" ook al is de tabel nu leeg.
  "lead_suppressions",
  "abm_leads",                // eigen outreach-lijst, met de hand opgebouwd
  "form_submissions",         // binnengekomen leads

  // ── Experimenten ───────────────────────────────────────────────────────────
  //
  // De definities wel, de toewijzingen niet: plan_experiment_assignments (201) en
  // experiment_assignments (19) zijn afgeleid van een sessie-hash en groeien
  // ongelimiteerd.
  "experiments",
  "plan_experiments",
] as const;

// ─── Wat er bewust NIET in zit ───────────────────────────────────────────────
//
//   Telemetrie / geschiedenis — reconstrueert zichzelf niet, maar is ook geen
//   configuratie, en samen goed voor ~200.000 rijen:
//     served_variants 76.920 · ai_decision_logs 60.691 · usage_events 12.703
//     visitor_journey_events 10.767 · events 6.977 · sessions 1.711
//     personalization_sessions 1.514 · visitor_events 930 · abm_lead_visits 11
//     ad_conversion_events 9 · ad_sync_runs 2
//
//   Afgeleide staat — herberekent zichzelf uit het bovenstaande:
//     visitor_behavior_state 1.357 · visitor_profiles 517 · visitor_history
//     ad_sync_audience_members · enrichment_usage
//
//   Caches en debug — weggooien is de bedoeling:
//     rate_limit_counters 41.564 · billing_request_debug_events 6.672
//     statamic_drafts 1.012 · tenant_site_settings_cache
//     tenant_host_resolution_cache · webhook_deliveries · wallet_reload_attempts
//
//   Meta — hoort niet in zijn eigen backup:
//     _migrations · platform_backups · pending_trial_signups (verlopen vanzelf)
//
// ─── Twee dingen die deze backup NIET dekt ───────────────────────────────────
//
//   1. tenant_assets bevat metadata; de bestanden staan in Supabase Storage
//      (bucket tenant-assets, 200 MB limiet). Een restore geeft je de rijen
//      terug en dode links naar de bestanden.
//   2. Je Statamic-content staat in een aparte repo, niet in Postgres. Deze
//      backup dekt het platform, niet de sites.


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
