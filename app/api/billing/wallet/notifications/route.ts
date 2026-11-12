/**
 * POST /api/billing/wallet/notifications
 *
 * Save wallet notification preferences for a tenant.
 *
 * ─── Request body ─────────────────────────────────────────────────────────────
 *
 *   {
 *     tenantId:                     string;
 *     notify_email?:                boolean;
 *     notify_sms?:                  boolean;
 *     notification_email?:          string | null;
 *     notification_phone?:          string | null;
 *     low_balance_threshold_cents?: number;
 *   }
 *
 * ─── Response ─────────────────────────────────────────────────────────────────
 *
 *   { success: true }  on success.
 *   { error: string }  on failure.
 *
 * ─── Auth ─────────────────────────────────────────────────────────────────────
 *
 *   Admin session with access to the tenant. Only the fields listed above are
 *   written; see billing/wallet-settings-input.ts.
 */

import { NextRequest, NextResponse }    from "next/server";
import { createClient }                 from "@supabase/supabase-js";
import { updateWalletNotifications }    from "@/billing/wallet";
import { pickNotificationPrefs }        from "@/billing/wallet-settings-input";
import { guardTenantRoute }             from "@/lib/admin-auth/route-guard";

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

  const guard = await guardTenantRoute(tenantId);
  if (!guard.ok) return guard.response;
  if (typeof tenantId !== "string") {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  // Named fields only. The body is never passed on as it came in.
  const picked = pickNotificationPrefs(body);
  if (!picked.ok) {
    return NextResponse.json({ error: picked.error }, { status: 400 });
  }
  const prefs = picked.value;

  // ── Persist ───────────────────────────────────────────────────────────────

  try {
    const client = serviceRoleClient();
    await updateWalletNotifications(client, tenantId, prefs);

    console.info("[wallet/notifications] prefs saved", { tenantId, fields: Object.keys(prefs) });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[wallet/notifications] error:", err);
    return NextResponse.json(
      { error: (err as Error).message ?? "Failed to save notification preferences" },
      { status: 500 },
    );
  }
}
