/**
 * GET /api/ad/click?ad=<id>&pub=<host>&sid=<mc_vid>
 *
 * Records an ad click and 302-redirects to the advertiser's landing page.
 *
 * ─── Safety ──────────────────────────────────────────────────────────────────
 *   The redirect destination is read from the ad row in OUR database
 *   (ads.click_url) — never from the URL — so this endpoint cannot be turned
 *   into an open redirect. Only http(s) destinations are allowed.
 *
 * Works without JavaScript (a plain <a href>), so click tracking is robust even
 * when the ad is a static server-rendered block.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdById, recordAdEvent, recentImpressionExists } from "@/lib/ads/serve";
import { logger } from "@/lib/logger";

/** Only follow http/https destinations. */
function safeDestination(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return (u.protocol === "http:" || u.protocol === "https:") ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const adId = searchParams.get("ad") ?? "";
  const pub  = searchParams.get("pub");
  const sid  = searchParams.get("sid");

  if (!adId) {
    return NextResponse.json({ error: "Missing ad id." }, { status: 400 });
  }

  const ad = await getAdById(adId);
  const dest = safeDestination(ad?.click_url ?? null);

  // Record the click — but only when this visitor actually saw the ad recently
  // (click integrity: a click without a prior impression is not billed, so the
  // click URL can't be hammered to drain a CPC budget). Deduped per
  // visitor+ad+minute. Fire-and-forget; the redirect happens regardless.
  if (ad && (await recentImpressionExists(ad.id, sid))) {
    const minuteBucket = Math.floor(Date.now() / 60_000);
    void recordAdEvent({
      tenantId:        ad.ad_tenant_id,
      adId:            ad.id,
      publisherDomain: pub,
      eventType:       "click",
      sessionId:       sid,
      eventKey:        `clk:${ad.id}:${sid ?? "anon"}:${minuteBucket}`,
      metadata:        { pub },
    });
  }

  if (!dest) {
    logger.debug("[ads] click with no valid destination", { adId });
    // Nothing safe to send them to — avoid an open redirect; return a 404.
    return NextResponse.json({ error: "Unknown or invalid ad." }, { status: 404 });
  }

  return NextResponse.redirect(dest, { status: 302 });
}
