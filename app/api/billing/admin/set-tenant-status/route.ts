/**
 * POST /api/billing/admin/set-tenant-status
 *
 * Super-admin endpoint to manually activate or deactivate a tenant,
 * overriding the automatic subscription-based access gating.
 *
 * ─── Request body ─────────────────────────────────────────────────────────────
 *
 *   {
 *     tenantId:   string;
 *     isActive:   boolean | null;
 *       // true  = force active (bypass payment check)
 *       // false = force disabled
 *       // null  = reset to auto (subscription-driven)
 *   }
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   Super-admin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@supabase/supabase-js";
import { getRequiredAdminSession, isSuperAdmin } from "@/lib/admin-auth/authorization";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Auth check — super-admin only ──────────────────────────────────────────
  let session;
  try {
    session = await getRequiredAdminSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSuperAdmin(session)) {
    return NextResponse.json(
      { error: "This action requires super-admin privileges." },
      { status: 403 },
    );
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: { tenantId?: string; isActive?: boolean | null };
  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tenantId, isActive } = body;

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  if (isActive !== true && isActive !== false && isActive !== null) {
    return NextResponse.json(
      { error: "isActive must be true, false, or null" },
      { status: 400 },
    );
  }

  // ── Update DB ──────────────────────────────────────────────────────────────
  const supabaseUrl  = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const supabaseSrvc = process.env["SUPABASE_SERVICE_ROLE_KEY"];

  if (!supabaseUrl || !supabaseSrvc) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const client = createClient(supabaseUrl, supabaseSrvc, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Call the RPC function instead of a direct ORM update.
  // This bypasses PostgREST's schema cache — the .update() path fails with
  // PGRST204 ("column not found in schema cache") whenever the cache is stale
  // after a migration adds a new column.  Functions are resolved at call time
  // and are immune to the cache staleness.
  const { error } = await client.rpc("set_tenant_active_override", {
    p_tenant_id: tenantId,
    p_value:     isActive ?? null,
  });

  if (error) {
    console.error("[billing/admin/set-tenant-status] DB error", error);
    return NextResponse.json(
      { error: `Database error: ${error.message}` },
      { status: 500 },
    );
  }

  const action =
    isActive === true  ? "force_active" :
    isActive === false ? "force_disabled" :
    "reset_auto";

  console.info(`[billing/admin/set-tenant-status] ${action} for tenant "${tenantId}" by admin "${session.email} (${session.sub})"`);

  return NextResponse.json({ ok: true, action, tenantId, isActive });
}
