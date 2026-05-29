/**
 * billing/request-debug-store.ts
 *
 * Read / write helpers for the billing_request_debug_events table.
 *
 * ─── What this is ─────────────────────────────────────────────────────────────
 *
 *   A lightweight persistence layer for BillingRequestDebug snapshots.
 *
 *   `saveRequestDebugEvent()` is called by `trackEnrichmentUsage()` after every
 *   pipeline run (fire-and-forget, errors are swallowed).
 *
 *   `getRequestDebugEvents()` is called by the admin billing/debug page to load
 *   persisted snapshots — faster and richer than reconstructing from usage_events.
 *
 * ─── Schema ───────────────────────────────────────────────────────────────────
 *
 *   See migration 079: billing_request_debug_events
 *
 *   key columns:
 *     tenant_id, request_id, route, billing_mode, demo_mode,
 *     wallet_before, wallet_after, total_credits_used, total_price,
 *     result, entries (JSONB), anomalies (JSONB), anomaly_count, created_at
 *
 * ─── Server only ──────────────────────────────────────────────────────────────
 *
 *   All functions accept a SupabaseClient (service-role recommended for writes).
 *   Do NOT import in client components.
 */

import type { SupabaseClient }    from "@supabase/supabase-js";
import type { BillingRequestDebug } from "./request-debug";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RequestDebugRow {
  id:                  string;
  tenant_id:           string;
  request_id:          string;
  route:               string | null;
  billing_mode:        "live" | "simulated" | "disabled";
  demo_mode:           boolean;
  wallet_before:       number | null;
  wallet_after:        number | null;
  total_credits_used:  number;
  total_price:         number;
  result:              "charged" | "cached" | "skipped" | "failed" | "empty";
  entries:             unknown[];
  anomalies:           string[];
  anomaly_count:       number;
  created_at:          string;
}

// ── Result derivation ──────────────────────────────────────────────────────────

function deriveResult(
  debug: BillingRequestDebug,
): RequestDebugRow["result"] {
  const { stages, billingMode } = debug;
  if (billingMode === "disabled")  return "skipped";
  if (billingMode === "simulated") return "skipped";

  const hasFailed   = stages.some((s) => s.result === "failed");
  const hasCharged  = stages.some((s) => s.result === "charged");
  const hasAllCached = stages
    .filter((s) => s.billable)
    .every((s) => s.result === "cached");

  if (hasFailed)  return "failed";
  if (hasCharged) return "charged";
  if (hasAllCached && stages.some((s) => s.billable)) return "cached";
  return "empty";
}

// ── Write ──────────────────────────────────────────────────────────────────────

export interface SaveDebugEventOptions {
  /** The request URL path, e.g. "/" or "/api/enrichment/leadinfo". */
  route?: string;
}

/**
 * Persist a BillingRequestDebug snapshot into billing_request_debug_events.
 *
 * Fire-and-forget: all errors are swallowed so billing failures never
 * break the enrichment response to the visitor.
 *
 * Skips the insert when the table is missing (migration 079 not applied yet).
 *
 * @param client  Service-role Supabase client.
 * @param debug   Full BillingRequestDebug from trackEnrichmentUsage().
 * @param options Optional route / context metadata.
 */
export async function saveRequestDebugEvent(
  client:  SupabaseClient,
  debug:   BillingRequestDebug,
  options: SaveDebugEventOptions = {},
): Promise<void> {
  try {
    const result = deriveResult(debug);

    const payload = {
      tenant_id:          debug.tenantId,
      request_id:         debug.requestId,
      route:              options.route ?? null,
      billing_mode:       debug.billingMode,
      demo_mode:          debug.demoMode,
      wallet_before:      debug.walletBeforeCents,
      wallet_after:       debug.walletAfterCents,
      total_credits_used: debug.totalCreditsUsed,
      total_price:        debug.totalChargedCents / 100,   // EUR
      result,
      entries:            debug.stages,
      anomalies:          debug.anomalies,
      anomaly_count:      debug.anomalies.length,
    };

    const { error } = await client
      .from("billing_request_debug_events")
      .insert(payload);

    if (error) {
      // Migration 079 not yet applied — silent skip.
      if (
        error.code === "42P01"      || // table missing
        error.code === "42703"      || // column missing
        error.code === "PGRST200"
      ) {
        // Not a hard error — migration pending.
        return;
      }
      // Duplicate request_id — idempotent, ignore.
      if (error.code === "23505") return;

      console.warn(
        `[billing/request-debug-store] saveRequestDebugEvent: insert failed` +
        ` | tenant=${debug.tenantId} | request=${debug.requestId}` +
        ` | code=${error.code} | msg=${error.message}`,
      );
    }
  } catch (err) {
    // Never throw — debug persistence must never block the main request.
    console.warn(
      `[billing/request-debug-store] saveRequestDebugEvent: unexpected error` +
      ` | tenant=${debug.tenantId} | ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ── Read ───────────────────────────────────────────────────────────────────────

export interface GetDebugEventsOptions {
  limit?:       number;
  /** Filter: only rows where result matches. */
  result?:      RequestDebugRow["result"];
  /** Filter: only rows with at least one anomaly. */
  anomaliesOnly?: boolean;
  /** Filter: only rows where billing_mode = 'live'. */
  liveOnly?:    boolean;
  /** Filter: route prefix (e.g. "/api/enrichment"). */
  route?:       string;
}

/**
 * Fetch recent billing_request_debug_events for a tenant.
 *
 * Falls back to an empty array when the table is missing.
 *
 * @param client   Service-role Supabase client.
 * @param tenantId Tenant to query.
 * @param options  Optional filters and limit.
 */
export async function getRequestDebugEvents(
  client:   SupabaseClient,
  tenantId: string,
  options:  GetDebugEventsOptions = {},
): Promise<RequestDebugRow[]> {
  const {
    limit         = 100,
    result,
    anomaliesOnly = false,
    liveOnly      = false,
    route,
  } = options;

  try {
    let query = client
      .from("billing_request_debug_events")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (result)       query = query.eq("result", result);
    if (anomaliesOnly) query = query.gt("anomaly_count", 0);
    if (liveOnly)     query = query.eq("billing_mode", "live");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (route)        query = (query as any).ilike("route", `${route}%`);

    const { data, error } = await query;

    if (error) {
      if (error.code === "42P01" || error.code === "PGRST200") {
        // Table missing — migration 079 not applied.
        return [];
      }
      console.error(
        `[billing/request-debug-store] getRequestDebugEvents error` +
        ` | tenant=${tenantId} | code=${error.code} | msg=${error.message}`,
      );
      return [];
    }

    return (data ?? []) as RequestDebugRow[];
  } catch (err) {
    console.error(
      `[billing/request-debug-store] getRequestDebugEvents unexpected error` +
      ` | tenant=${tenantId} | ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
}

/**
 * Fetch aggregate stats for billing_request_debug_events for a tenant.
 *
 * Returns null when the table is missing (migration 079 not applied).
 */
export interface RequestDebugStats {
  total:        number;
  charged:      number;
  failed:       number;
  cached:       number;
  withAnomalies: number;
  totalCredits: number;
  totalPriceEur: number;
}

export async function getRequestDebugStats(
  client:   SupabaseClient,
  tenantId: string,
  sinceIso?: string,
): Promise<RequestDebugStats | null> {
  try {
    let query = client
      .from("billing_request_debug_events")
      .select("result, total_credits_used, total_price, anomaly_count")
      .eq("tenant_id", tenantId);

    if (sinceIso) query = query.gte("created_at", sinceIso);

    const { data, error } = await query;

    if (error) {
      if (error.code === "42P01" || error.code === "PGRST200") return null;
      return null;
    }

    const rows = (data ?? []) as {
      result:              string;
      total_credits_used:  number;
      total_price:         number;
      anomaly_count:       number;
    }[];

    return {
      total:         rows.length,
      charged:       rows.filter((r) => r.result === "charged").length,
      failed:        rows.filter((r) => r.result === "failed").length,
      cached:        rows.filter((r) => r.result === "cached").length,
      withAnomalies: rows.filter((r) => r.anomaly_count > 0).length,
      totalCredits:  rows.reduce((sum, r) => sum + (r.total_credits_used ?? 0), 0),
      totalPriceEur: rows.reduce((sum, r) => sum + (r.total_price ?? 0), 0),
    };
  } catch {
    return null;
  }
}
