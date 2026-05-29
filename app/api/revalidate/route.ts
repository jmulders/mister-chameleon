/**
 * CMS Webhook — ISR Revalidation Handler
 *
 * POST /api/revalidate
 *
 * Accepts a signed webhook payload from a CMS (e.g. Sanity) and:
 *
 *   1. Validates the HMAC-SHA256 signature to ensure the request is genuine.
 *   2. Calls `revalidateTag("sanity")` to purge the Next.js ISR render cache
 *      for all pages tagged with the Sanity revalidation tag.
 *   3. Flushes the in-process CMS variant cache for the affected tenant so
 *      the next server render fetches fresh content from the CMS API.
 *
 * ─── Environment variables ────────────────────────────────────────────────────
 *
 *   REVALIDATE_SECRET   — HMAC-SHA256 shared secret between the CMS and this
 *                         handler.  Set it in Sanity's webhook configuration
 *                         and in your Vercel / `.env.local` settings.
 *
 *   When REVALIDATE_SECRET is not set, the endpoint accepts unsigned requests
 *   (useful for local dev) but logs a warning.
 *
 * ─── Webhook configuration (Sanity example) ──────────────────────────────────
 *
 *   URL:     https://your-domain.com/api/revalidate
 *   Trigger: On create / update / delete  (documentTypes: all or specific types)
 *   Secret:  <same value as REVALIDATE_SECRET>
 *   HTTP method: POST
 *
 *   Sanity signs the webhook body with HMAC-SHA256 and sends the signature
 *   in the `sanity-webhook-signature` header.
 *
 * ─── Request body shape (Sanity webhook) ──────────────────────────────────────
 *
 *   {
 *     _type:    string,         // Sanity document type that triggered the event
 *     _id:      string,         // Sanity document ID
 *     tenantId: string | null,  // Optional: tenant scoping from a custom field
 *   }
 *
 *   All other body fields are ignored.  `tenantId` is an optional custom field
 *   on Sanity documents — when present, only that tenant's in-process cache is
 *   flushed; otherwise the entire CMS variant cache is cleared.
 *
 * ─── Response ─────────────────────────────────────────────────────────────────
 *
 *   200 { revalidated: true, tag: "sanity", tenantId: string | null }
 *   400 { revalidated: false, message: "…" }
 *   401 { revalidated: false, message: "…" }
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag }             from "next/cache";
import { handleInvalidation }        from "@/cache/invalidation";
import { logger }                    from "@/lib/logger";

const SANITY_TAG = "sanity";

// ── Signature verification ────────────────────────────────────────────────────

async function verifySignature(
  body:      string,
  signature: string | null,
  secret:    string,
): Promise<boolean> {
  try {
    const enc     = new TextEncoder();
    const keyData = enc.encode(secret);
    const msgData = enc.encode(body);

    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    // Sanity sends the signature as a hex string prefixed with "v1=".
    const hexSig   = signature?.replace(/^v1=/, "") ?? "";
    const sigBytes = hexToUint8Array(hexSig);

    return crypto.subtle.verify("HMAC", key, sigBytes.buffer as ArrayBuffer, msgData);
  } catch {
    return false;
  }
}

function hexToUint8Array(hex: string): Uint8Array {
  const length = hex.length / 2;
  const arr    = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.REVALIDATE_SECRET;

  // Read raw body text for signature verification (must happen before json parse).
  const bodyText = await request.text();

  // ── Signature check ────────────────────────────────────────────────────────
  if (secret) {
    const signature = request.headers.get("sanity-webhook-signature");
    const valid     = await verifySignature(bodyText, signature, secret);

    if (!valid) {
      logger.warn("[Revalidate] Webhook signature verification failed.");
      return NextResponse.json(
        { revalidated: false, message: "Invalid webhook signature." },
        { status: 401 },
      );
    }
  } else {
    logger.warn(
      "[Revalidate] REVALIDATE_SECRET is not set — accepting unsigned webhook. " +
      "Set REVALIDATE_SECRET in production to prevent unauthorized cache invalidation.",
    );
  }

  // ── Parse payload ──────────────────────────────────────────────────────────
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return NextResponse.json(
      { revalidated: false, message: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const tenantId = typeof payload.tenantId === "string" ? payload.tenantId : null;
  const docType  = typeof payload._type    === "string" ? payload._type    : "unknown";
  const docId    = typeof payload._id      === "string" ? payload._id      : "unknown";

  logger.info("[Revalidate] CMS webhook received.", { docType, docId, tenantId });

  // ── Trigger ISR revalidation ───────────────────────────────────────────────
  // The second argument is the cache profile; `{}` uses the default settings.
  revalidateTag(SANITY_TAG, {});
  logger.info("[Revalidate] ISR tag revalidated.", { tag: SANITY_TAG });

  // ── Flush in-process CMS cache ────────────────────────────────────────────
  //
  // The InvalidationBus handles both ISR revalidation and in-process cache
  // flushing.  We pass `skipIsr: true` (conceptually) since we already called
  // `revalidateTag` above — but the bus's ISR call is a no-op if called twice
  // in the same request, so it's safe to let it run again.
  await handleInvalidation({
    type:     "cms-content-updated",
    tenantId: tenantId,
  });

  return NextResponse.json(
    { revalidated: true, tag: SANITY_TAG, tenantId },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
