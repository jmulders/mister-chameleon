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
 *
 * ─── Auth ─────────────────────────────────────────────────────────────────────
 *
 *   Admin session with access to the tenant. Only the fields listed above are
 *   written; see billing/wallet-settings-input.ts.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
import { updateWalletAutoReload }    from "@/billing/wallet";
import { pickAutoReloadSettings }    from "@/billing/wallet-settings-input";
import { guardTenantRoute }          from "@/lib/admin-auth/route-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function serviceRoleClient() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("Supabase service-role env vars missing");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tenantId = (body as { tenantId?: unknown } | null)?.tenantId;

  // Auth before anything else: this route changes when and how much a tenant's
  // saved card is charged.
  const guard = await guardTenantRoute(tenantId);
  if (!guard.ok) return guard.response;
  if (typeof tenantId !== "string") {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  // Named fields only. The body is never passed on as it came in.
  const picked = pickAutoReloadSettings(body);
  if (!picked.ok) {
    return NextResponse.json({ error: picked.error }, { status: 400 });
  }
  const settings = picked.value;

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
