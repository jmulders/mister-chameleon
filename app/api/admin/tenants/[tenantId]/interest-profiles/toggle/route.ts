/**
 * POST /api/admin/tenants/[tenantId]/interest-profiles/toggle
 *
 * Enable or disable a platform-wide interest profile for a specific tenant.
 * Upserts a row in `tenant_interest_profiles`.
 *
 * ─── Request body ─────────────────────────────────────────────────────────────
 *
 *   { "profileKey": "b2b_decision_maker", "enabled": false }
 *
 * ─── Success response (200) ───────────────────────────────────────────────────
 *
 *   { "ok": true }
 *
 * ─── Error responses ──────────────────────────────────────────────────────────
 *
 *   401 — not authenticated
 *   400 — missing / invalid body fields
 *   200 { ok: false, error: "…" } — DB write failed
 *
 * ─── DB mutation ──────────────────────────────────────────────────────────────
 *
 *   INSERT INTO tenant_interest_profiles (tenant_id, profile_key, enabled, updated_at)
 *   VALUES ($1, $2, $3, now())
 *   ON CONFLICT (tenant_id, profile_key) DO UPDATE SET enabled = $3, updated_at = now();
 *
 *   (Executed via setTenantProfileOverride in interest-profiles/repository.ts)
 */

import { NextRequest, NextResponse }        from "next/server";
import { cookies }                           from "next/headers";
import { verifySession, ADMIN_TOKEN_COOKIE } from "@/lib/admin-auth";
import { setTenantProfileOverride }          from "@/interest-profiles/repository";

// ── Auth guard ─────────────────────────────────────────────────────────────────

async function requireAdminSession(): Promise<
  | { ok: true }
  | { ok: false; status: 401 | 403; message: string }
> {
  const cookieStore = await cookies();
  const token       = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value ?? null;

  if (!token) return { ok: false, status: 401, message: "Not authenticated." };

  const session = await verifySession(token);
  if (!session)  return { ok: false, status: 401, message: "Invalid or expired session." };

  if (session.twoFaEnabled && !session.twoFaVerified) {
    return { ok: false, status: 403, message: "2FA verification required." };
  }

  return { ok: true };
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  // 1. Auth.
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const { tenantId } = await params;
  if (!tenantId) {
    return NextResponse.json({ ok: false, message: "Tenant ID is required." }, { status: 400 });
  }

  // 2. Parse body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Request body must be valid JSON." }, { status: 400 });
  }

  const { profileKey, enabled } = (body ?? {}) as Record<string, unknown>;

  if (typeof profileKey !== "string" || profileKey.trim().length === 0) {
    return NextResponse.json({ ok: false, message: "profileKey is required and must be a non-empty string." }, { status: 400 });
  }

  if (typeof enabled !== "boolean") {
    return NextResponse.json({ ok: false, message: "enabled is required and must be a boolean." }, { status: 400 });
  }

  // 3. Upsert the override row.
  const result = await setTenantProfileOverride(tenantId, profileKey.trim(), enabled);

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
