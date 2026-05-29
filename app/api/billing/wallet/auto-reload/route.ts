/**
 * POST /api/billing/wallet/auto-reload
 *
 * Save auto-reload settings for a tenant wallet.
 *
 * ─── Request body ─────────────────────────────────────────────────────────────
 *
 *   {
 *     tenantId:                      string;
 *     auto_reload_enabled:           boolean;
 *     auto_reload_trigger_cents:     number;   // e.g. 300 (€3.00)
 *     auto_reload_amount_cents:      number;   // e.g. 2000 (€20.00)
 *     auto_reload_monthly_limit_cents: number; // e.g. 10000 (€100.00)
 *   }
 *
 * ─── Response ─────────────────────────────────────────────────────────────────
 *
 *   { success: true }  on success.
 *   { error: string }  on failure.
 *
 * ─── Safety ───────────────────────────────────────────────────────────────────
 *
 *   Saving settings does NOT immediately trigger a reload — the reload is
 *   only triggered when the next debit brings the balance below the threshold.
 *
 *   If auto_reload_enabled is set to true without a saved payment method, the
 *   trigger will log a warning and skip the reload — no error is returned here.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
import { updateWalletAutoReload }    from "@/billing/wallet";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function serviceRoleClient() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("Supabase service-role env vars missing");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: {
    tenantId?:                        string;
    auto_reload_enabled?:             boolean;
    auto_reload_trigger_cents?:       number;
    auto_reload_amount_cents?:        number;
    auto_reload_monthly_limit_cents?: number;
  };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tenantId, ...settings } = body;

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  // ── Validate numeric settings ─────────────────────────────────────────────

  if (settings.auto_reload_trigger_cents !== undefined && settings.auto_reload_trigger_cents < 0) {
    return NextResponse.json({ error: "auto_reload_trigger_cents must be ≥ 0" }, { status: 400 });
  }
  if (settings.auto_reload_amount_cents !== undefined && settings.auto_reload_amount_cents < 100) {
    return NextResponse.json(
      { error: "auto_reload_amount_cents must be ≥ 100 (€1.00 minimum)" },
      { status: 400 },
    );
  }
  if (
    settings.auto_reload_monthly_limit_cents !== undefined &&
    settings.auto_reload_amount_cents !== undefined &&
    settings.auto_reload_monthly_limit_cents < settings.auto_reload_amount_cents
  ) {
    return NextResponse.json(
      { error: "auto_reload_monthly_limit_cents must be ≥ auto_reload_amount_cents" },
      { status: 400 },
    );
  }

  // ── Persist ───────────────────────────────────────────────────────────────

  try {
    const client = serviceRoleClient();
    await updateWalletAutoReload(client, tenantId, settings);

    console.info("[wallet/auto-reload] settings saved", { tenantId, settings });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[wallet/auto-reload] error:", err);
    return NextResponse.json(
      { error: (err as Error).message ?? "Failed to save settings" },
      { status: 500 },
    );
  }
}
