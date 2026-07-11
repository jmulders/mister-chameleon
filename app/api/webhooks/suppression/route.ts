/**
 * POST /api/webhooks/suppression?tenant=<tenantId>
 *
 * Inbound unsubscribe / opt-out / consent-withdrawal. Suppresses an email so it
 * is excluded from retargeting audiences and immediately removed from the ad
 * platforms. Point your ESP's unsubscribe webhook (Mailchimp, ActiveCampaign, …)
 * or a Zapier/Make step here.
 *
 * Auth: shared secret in the `x-mc-secret` header, matched against the
 * LEAD_SUPPRESSION_SECRET env var. Fails closed (503) when unset, 401 on mismatch.
 *
 * Body: JSON `{ email, reason?, source? }` or form-encoded ESP payloads
 * (e.g. Mailchimp `data[email]`). The email is extracted from common shapes.
 */

import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { addSuppression }            from "@/lib/lead-base/suppression-store";
import { removeLeadsFromAudiences }  from "@/lib/ad-sync/sync-engine";
import { logger }                    from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function extractEmail(v: unknown): string | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Record<string, unknown>;
  const data = b["data"] as Record<string, unknown> | undefined;
  const candidates = [
    b["email"], b["email_address"], b["data[email]"],
    data?.["email"], data?.["email_address"],
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.includes("@")) return c.trim().toLowerCase();
  }
  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const expected = process.env["LEAD_SUPPRESSION_SECRET"]?.trim();
  if (!expected) {
    return NextResponse.json({ ok: false, error: "Suppression webhook not configured" }, { status: 503 });
  }
  if ((request.headers.get("x-mc-secret") ?? "") !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = request.nextUrl.searchParams.get("tenant")?.trim();
  if (!tenantId) {
    return NextResponse.json({ ok: false, error: "Missing tenant" }, { status: 400 });
  }

  // Parse JSON or form-encoded.
  let payload: Record<string, unknown> = {};
  const ct = request.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) {
      payload = (await request.json()) as Record<string, unknown>;
    } else {
      const form = await request.formData();
      form.forEach((val, key) => { payload[key] = typeof val === "string" ? val : ""; });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const email = extractEmail(payload);
  if (!email) {
    return NextResponse.json({ ok: false, error: "No email in payload" }, { status: 422 });
  }

  const reason = typeof payload["reason"] === "string" ? (payload["reason"] as string) : "unsubscribe";
  const source = typeof payload["source"] === "string" ? (payload["source"] as string) : "webhook";

  try {
    await addSuppression(tenantId, email, reason, source);
    // Immediately pull them from every configured ad-platform audience.
    await removeLeadsFromAudiences(tenantId, [email]);
    logger.info("[suppression] suppressed", { tenantId, source });
    return NextResponse.json({ ok: true, suppressed: true });
  } catch (err) {
    logger.error("[suppression] failed", { tenantId, error: String(err) });
    return NextResponse.json({ ok: false, error: "Suppression failed" }, { status: 500 });
  }
}
