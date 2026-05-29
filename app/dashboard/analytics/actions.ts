"use server";

/**
 * app/dashboard/analytics/actions.ts
 *
 * Server actions for the analytics dashboard.
 * Calls the Postgres functions installed by migration 099.
 */

import { createClient } from "@supabase/supabase-js";

function makeClient() {
  return createClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false } },
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FunnelStage {
  stage:         string;
  session_count: number;
  pct_of_top:    number;
}

export interface DailyDataPoint {
  day:          string;
  sessions:     number;
  cta_clicks:   number;
  form_submits: number;
}

export interface VariantRow {
  variant_key:  string;
  impressions:  number;
  cta_clicks:   number;
  form_submits: number;
  ctr:          number;
}

// ── getAnalyticsFunnel ─────────────────────────────────────────────────────────

export async function getAnalyticsFunnel(
  tenantId: string,
  days = 30,
): Promise<{ ok: true; data: FunnelStage[] } | { ok: false; error: string }> {
  const db = makeClient();
  try {
    const { data, error } = await db.rpc("get_analytics_funnel", {
      p_tenant_id: tenantId,
      p_days:      days,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as FunnelStage[] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ── getAnalyticsDaily ──────────────────────────────────────────────────────────

export async function getAnalyticsDaily(
  tenantId: string,
  days = 30,
): Promise<{ ok: true; data: DailyDataPoint[] } | { ok: false; error: string }> {
  const db = makeClient();
  try {
    const { data, error } = await db.rpc("get_analytics_daily", {
      p_tenant_id: tenantId,
      p_days:      days,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as DailyDataPoint[] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// ── getAnalyticsVariants ───────────────────────────────────────────────────────

export async function getAnalyticsVariants(
  tenantId: string,
  days = 30,
): Promise<{ ok: true; data: VariantRow[] } | { ok: false; error: string }> {
  const db = makeClient();
  try {
    const { data, error } = await db.rpc("get_analytics_variants", {
      p_tenant_id: tenantId,
      p_days:      days,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data ?? []) as VariantRow[] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}
