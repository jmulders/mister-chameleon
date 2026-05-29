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
 */

import { NextRequest, NextResponse }    from "next/server";
import { createClient }                 from "@supabase/supabase-js";
import { updateWalletNotifications }    from "@/billing/wallet";

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
    tenantId?:                     string;
    notify_email?:                 boolean;
    notify_sms?:                   boolean;
    notification_email?:           string | null;
    notification_phone?:           string | null;
    low_balance_threshold_cents?:  number;
  };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tenantId, ...prefs } = body;

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  // ── Basic email format check ──────────────────────────────────────────────

  if (prefs.notification_email && !prefs.notification_email.includes("@")) {
    return NextResponse.json({ error: "notification_email is not a valid email address" }, { status: 400 });
  }

  if (
    prefs.low_balance_threshold_cents !== undefined &&
    (typeof prefs.low_balance_threshold_cents !== "number" || prefs.low_balance_threshold_cents < 0)
  ) {
    return NextResponse.json({ error: "low_balance_threshold_cents must be ≥ 0" }, { status: 400 });
  }

  // ── Persist ───────────────────────────────────────────────────────────────

  try {
    const client = serviceRoleClient();
    await updateWalletNotifications(client, tenantId, prefs);

    console.info("[wallet/notifications] prefs saved", { tenantId, prefs });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[wallet/notifications] error:", err);
    return NextResponse.json(
      { error: (err as Error).message ?? "Failed to save notification preferences" },
      { status: 500 },
    );
  }
}
