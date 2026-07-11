/**
 * POST /api/webhooks/inbound-form?tenant=<tenantId>
 *
 * Bridge for externally-rendered forms (e.g. a Statamic-served tenant site whose
 * contact form posts to the CMS, not to the platform's /api/forms route). A small
 * listener in the CMS app forwards each submission here so the closed loop still
 * runs: inbound-lead capture + ad-platform conversion feedback + profile→converted.
 *
 * Auth: shared secret in the `x-mc-secret` header, matched against the
 * LEAD_INBOUND_SECRET env var. Fails closed (503) when unset, 401 on mismatch.
 *
 * Body (JSON or form-encoded):
 *   {
 *     values:     { [fieldKey]: string },   // the submitted field map (preferred)
 *     path?:      string,                    // page the form was submitted from
 *     session_id?: string,                   // visitor's mc_session_id, when known
 *     form?:      string                     // form handle (diagnostics only)
 *   }
 * When `values` is absent the whole payload (minus the reserved keys above) is
 * treated as the field map, so a flat `{ email, name, company }` body also works.
 */

import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { captureInboundLead, extractSubmittedEmail } from "@/lib/lead-base/inbound-capture";
import { markProfileConverted } from "@/lib/lead-base/visitor-profiles-store";
import { sendConversion } from "@/lib/ad-sync/conversion-engine";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RESERVED = new Set(["values", "path", "session_id", "sessionId", "form", "tenant"]);

/** Coerce an unknown value into a flat string→string field map. */
function toStringMap(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== "object") return out;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string") out[k] = val;
    else if (typeof val === "number" || typeof val === "boolean") out[k] = String(val);
  }
  return out;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const expected = process.env["LEAD_INBOUND_SECRET"]?.trim();
  if (!expected) {
    return NextResponse.json({ ok: false, error: "Inbound-form webhook not configured" }, { status: 503 });
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

  // The field map: prefer an explicit `values` object, else the flat payload.
  let values: Record<string, string>;
  if (payload["values"] && typeof payload["values"] === "object") {
    values = toStringMap(payload["values"]);
  } else {
    const flat: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (!RESERVED.has(k)) flat[k] = v;
    }
    values = toStringMap(flat);
  }

  const email = extractSubmittedEmail(values);
  if (!email) {
    return NextResponse.json({ ok: false, error: "No email in submission" }, { status: 422 });
  }

  const rawSession = payload["session_id"] ?? payload["sessionId"];
  const sessionId = typeof rawSession === "string" && rawSession.trim() ? rawSession.trim() : null;

  let targetPath = "/";
  const rawPath = payload["path"];
  if (typeof rawPath === "string" && rawPath.trim()) {
    try { targetPath = new URL(rawPath).pathname || "/"; }
    catch { targetPath = rawPath.startsWith("/") ? rawPath : "/"; }
  }

  try {
    // Capture the named lead (deduped by email); links to the visitor profile
    // when a session id came through. Fail-open inside.
    await captureInboundLead({ tenantId, visitorKey: sessionId, values, targetPath });

    // Mark the visitor profile converted (best-effort, needs a session id).
    if (sessionId) await markProfileConverted(tenantId, sessionId);

    // Report the conversion back to the configured ad platforms. No-op unless
    // conversion feedback is enabled + configured for the tenant.
    await sendConversion(tenantId, { email, eventName: "Lead" }, "conversion");

    logger.info("[inbound-form] captured", { tenantId, hasSession: Boolean(sessionId) });
    return NextResponse.json({ ok: true, captured: true });
  } catch (err) {
    logger.error("[inbound-form] failed", { tenantId, error: String(err) });
    return NextResponse.json({ ok: false, error: "Capture failed" }, { status: 500 });
  }
}
