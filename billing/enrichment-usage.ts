/**
 * billing/enrichment-usage.ts
 *
 * Enrichment usage query helpers — reads from usage_events (canonical table).
 *
 * ─── Server only ──────────────────────────────────────────────────────────────
 *
 *   Do NOT import in client components.
 *
 * ─── Migration history ────────────────────────────────────────────────────────
 *
 *   enrichment_usage (migrations 043–050) does not exist in the live database.
 *   All writes now go to usage_events (migration 039 + 068) via trackUsageEvent.
 *   All reads below aggregate from usage_events and return the same
 *   EnrichmentUsageSummaryRow / EnrichmentUsageRecord shapes so existing
 *   consumers (billing dashboard, admin debug page) work without changes.
 *
 *   Column mapping from the old enrichment_usage schema to usage_events:
 *     enrichment_type   → event_type  (usage_event_type ENUM)
 *     total_price_cents → credits_used (NUMERIC, migration 068)
 *     unit_price_cents  → stored in metadata.unitPriceCents
 *     wallet_blocked    → error_code contains block reason
 *     request_id        → session_id
 *     billable          → billable (BOOLEAN, migration 068)
 *
 * ─── recordEnrichmentUsage removed ───────────────────────────────────────────
 *
 *   The write function has been removed.  All writes go through trackUsageEvent
 *   in billing/usage-events.ts.  This file is now read-only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { EnrichmentUsageRecord, EnrichmentUsageSummaryRow } from "./types";
import { isSchemaMissingCode } from "./usage";

export type { EnrichmentUsageRecord, EnrichmentUsageSummaryRow };

// ── Read: per-type summary ────────────────────────────────────────────────────

/**
 * Fetch an aggregated usage summary per enrichment type for a tenant.
 *
 * Reads from usage_events (replaces the retired enrichment_usage table).
 * Returns one row per event_type with call counts and total spend.
 * Ordered by total_price_cents descending.
 */
export async function getEnrichmentUsageSummary(
  client:   SupabaseClient,
  tenantId: string,
  from:     string,
  to:       string,
): Promise<EnrichmentUsageSummaryRow[]> {
  const { data, error } = await client
    .from("usage_events")
    .select("event_type, quantity, credits_cost, credits_used, cache_hit, success, error_code, billable")
    .eq("tenant_id", tenantId)
    .gte("created_at", from)
    .lte("created_at", to)
    .eq("simulated", false);

  if (error) {
    if (isSchemaMissingCode(error.code)) {
      console.warn(
        `[billing/enrichment-usage] getEnrichmentUsageSummary: schema missing` +
        ` | table=usage_events | code=${error.code} | msg=${error.message} | tenant=${tenantId}`,
      );
      return [];
    }
    throw new Error(
      `[billing/enrichment-usage] getEnrichmentUsageSummary failed for tenant "${tenantId}": ${error.message} (code: ${error.code})`,
    );
  }

  const rows = (data ?? []) as {
    event_type:    string;
    quantity:      number;
    credits_cost:  number;
    credits_used?: number;
    cache_hit:     boolean;
    success:       boolean;
    error_code:    string | null;
    billable?:     boolean;
  }[];

  const byType: Record<string, EnrichmentUsageSummaryRow> = {};

  for (const row of rows) {
    const key = row.event_type;
    if (!byType[key]) {
      byType[key] = {
        enrichment_type:   key,
        call_count:        0,
        success_count:     0,
        failure_count:     0,
        cache_hit_count:   0,
        fresh_call_count:  0,
        blocked_count:     0,
        total_price_cents: 0,
      };
    }
    const agg   = byType[key]!;
    // Use credits_used (NUMERIC, migration 068) when present; fall back to credits_cost.
    const spend = row.credits_used ?? row.credits_cost;

    agg.call_count        += row.quantity;
    agg.total_price_cents += spend;
    if (row.success)   agg.success_count   += row.quantity;
    else               agg.failure_count   += row.quantity;
    if (row.cache_hit) agg.cache_hit_count  += row.quantity;
    else               agg.fresh_call_count += row.quantity;

    // Blocked = non-null error_code that indicates a pre-flight wallet block.
    const blocked = row.error_code != null && (
      row.error_code.includes("balance")  ||
      row.error_code.includes("blocked")  ||
      row.error_code.includes("suspended")||
      row.error_code.includes("frozen")   ||
      row.error_code === "debit_failed"
    );
    if (blocked) agg.blocked_count += row.quantity;
  }

  return Object.values(byType).sort((a, b) => b.total_price_cents - a.total_price_cents);
}

// ── Read: wallet breakdown ────────────────────────────────────────────────────

/**
 * Fetch aggregated enrichment usage for a tenant for a billing month.
 *
 * Previously delegated to the `get_wallet_breakdown` Postgres RPC (migration 056)
 * which read from enrichment_usage.  Since enrichment_usage is retired, this
 * function now aggregates directly from usage_events — same return type.
 *
 * @param client     Supabase service-role client.
 * @param tenantId   Tenant to query.
 * @param periodKey  Billing month in YYYY-MM format (e.g. "2026-04").
 *                   Defaults to the current UTC calendar month when omitted.
 */
export async function getWalletBreakdown(
  client:    SupabaseClient,
  tenantId:  string,
  periodKey?: string,
): Promise<EnrichmentUsageSummaryRow[]> {
  const key = periodKey ?? new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const [yearStr, monthStr] = key.split("-") as [string, string];
  const year  = parseInt(yearStr,  10);
  const month = parseInt(monthStr, 10); // 1-based

  const from = `${key}-01T00:00:00.000Z`;
  // First moment of next month (exclusive upper bound).
  const nextYear  = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const to = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00.000Z`;

  return getEnrichmentUsageSummary(client, tenantId, from, to);
}

// ── Read: recent records ──────────────────────────────────────────────────────

/**
 * Fetch raw usage_events rows for a tenant, most recent first.
 *
 * Returned as EnrichmentUsageRecord for backward compat — columns are mapped
 * from usage_events to the old enrichment_usage shape.
 */
export async function getEnrichmentUsageRecords(
  client:   SupabaseClient,
  tenantId: string,
  limit     = 50,
  from?:    string,
  to?:      string,
): Promise<EnrichmentUsageRecord[]> {
  let query = client
    .from("usage_events")
    .select("id, tenant_id, event_type, quantity, credits_cost, credits_used, cache_hit, billable, success, error_code, session_id, idempotency_key, metadata, created_at")
    .eq("tenant_id", tenantId)
    .eq("simulated", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (from) query = query.gte("created_at", from);
  if (to)   query = query.lte("created_at", to);

  const { data, error } = await query;

  if (error) {
    if (isSchemaMissingCode(error.code)) {
      console.warn(
        `[billing/enrichment-usage] getEnrichmentUsageRecords: schema missing` +
        ` | table=usage_events | code=${error.code} | tenant=${tenantId}`,
      );
      return [];
    }
    throw new Error(
      `[billing/enrichment-usage] getEnrichmentUsageRecords failed for tenant "${tenantId}": ${error.message} (code: ${error.code})`,
    );
  }

  // Map usage_events columns → EnrichmentUsageRecord shape for backward compat.
  return ((data ?? []) as {
    id:              string;
    tenant_id:       string;
    event_type:      string;
    quantity:        number;
    credits_cost:    number;
    credits_used?:   number;
    cache_hit:       boolean;
    billable?:       boolean;
    success:         boolean;
    error_code:      string | null;
    session_id:      string | null;
    idempotency_key: string | null;
    metadata:        Record<string, unknown>;
    created_at:      string;
  }[]).map((row): EnrichmentUsageRecord => {
    const meta            = row.metadata ?? {};
    const unitPriceCents  = (meta["unitPriceCents"] as number) ?? row.credits_cost;
    const totalPriceCents = row.credits_used ?? row.credits_cost;
    return {
      id:                row.id,
      tenant_id:         row.tenant_id,
      enrichment_type:   row.event_type,
      quantity:          row.quantity,
      unit_price_cents:  unitPriceCents,
      total_price_cents: totalPriceCents,
      cache_hit:         row.cache_hit,
      billable:          row.billable ?? true,
      wallet_blocked:    false, // retired column; use error_code for block detection
      success:           row.success,
      error_code:        row.error_code,
      request_id:        row.session_id,
      idempotency_key:   row.idempotency_key,
      metadata:          meta,
      created_at:        row.created_at,
    };
  });
}

// ── Read: total spend ─────────────────────────────────────────────────────────

/**
 * Sum credits_used (or credits_cost) for a tenant in a time window.
 * Returns 0 when no records exist or the table is missing.
 */
export async function getTotalEnrichmentSpend(
  client:   SupabaseClient,
  tenantId: string,
  from:     string,
  to:       string,
): Promise<number> {
  const { data, error } = await client
    .from("usage_events")
    .select("credits_cost, credits_used")
    .eq("tenant_id", tenantId)
    .eq("simulated", false)
    .gte("created_at", from)
    .lte("created_at", to);

  if (error) {
    if (isSchemaMissingCode(error.code)) {
      console.warn(
        `[billing/enrichment-usage] getTotalEnrichmentSpend: schema missing` +
        ` | table=usage_events | code=${error.code} | tenant=${tenantId}`,
      );
      return 0;
    }
    throw new Error(
      `[billing/enrichment-usage] getTotalEnrichmentSpend failed for tenant "${tenantId}": ${error.message} (code: ${error.code})`,
    );
  }

  return ((data ?? []) as { credits_cost: number; credits_used?: number }[]).reduce(
    (sum, row) => sum + (row.credits_used ?? row.credits_cost ?? 0),
    0,
  );
}
