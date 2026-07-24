/**
 * Ad-serving orchestrator for the decide endpoints.
 *
 * When an *advertiser* tenant is resolved, this replaces the normal CMS-variant
 * pipeline: for each requested block it picks an eligible ad (targeting + budget
 * + flight), records an impression (deduped), and renders the creative as a
 * self-contained block whose CTA points at the /api/ad/click redirect.
 *
 * Gates, in order: publisher approved → wallet has balance → per-slot ad exists.
 * Any miss yields no slot for that block (the publisher's own default shows).
 * Never throws: ad-serving must never break a page.
 */

import { renderBlockHtml }        from "@/lib/snippet/render-block-html";
import { matchesTargeting, parseAdTargeting, isUntargeted } from "./targeting";
import type { AdAudience }        from "./targeting";
import type { SlotMap, BlockSlot } from "@/lib/snippet/decide-response";
import { logger }                 from "@/lib/logger";
import { selectAd }               from "./select-ad";
import {
  fetchAdsForSlot,
  isPublisherApproved,
  isWalletServable,
  recordAdEvent,
  recordProfilingCharge,
  hostFromOrigin,
}                                 from "./serve";
import type { Ad } from "./types";

/** Point an ad creative's primary CTA at the click-tracking redirect. */
function injectClickTracking(slotType: string, creative: Record<string, unknown>, trackUrl: string): Record<string, unknown> {
  const c = { ...creative };
  const setCtaArray = () => {
    const arr = Array.isArray(c.ctas) ? [...(c.ctas as Record<string, unknown>[])] : [];
    if (arr[0]) arr[0] = { ...arr[0], href: trackUrl };
    else arr[0] = { label: "Learn more", href: trackUrl };
    c.ctas = arr;
  };
  switch (slotType) {
    case "hero":
    case "conversion":
      setCtaArray();
      break;
    case "cta": {
      const cta = (c.cta as Record<string, unknown>) ?? {};
      c.cta = { ...cta, href: trackUrl };
      break;
    }
    case "notification":
      c.ctaHref = trackUrl;
      break;
    default:
      break; // proof / feature: no CTA to rewrite
  }
  return c;
}

/** Build the deterministic dedup key for one impression (per visitor+ad+minute). */
function impressionKey(adId: string, sessionId: string | null, minuteBucket: number): string {
  return `imp:${adId}:${sessionId ?? "anon"}:${minuteBucket}`;
}

export interface ServeAdsArgs {
  tenantId:     string;
  blockKeys:    string[];       // requested data-mc-block keys (= slot types)
  originHost:   string | null;  // publisher host (from Origin/Referer)
  platformBase: string;         // absolute base for the click redirect
  sessionId:    string | null;  // visitor mc_vid
  /** Behavioural profile for targeting (null = no profile → targeted ads skip). */
  audience?:    AdAudience | null;
  tokens?:      Record<string, string>;
}

/**
 * Returns a SlotMap of ad block slots for the requested blocks, or an empty map
 * when nothing can be served (not approved / no balance / no ads / no match).
 */
export async function serveAds(args: ServeAdsArgs): Promise<SlotMap> {
  const slots: SlotMap = {};
  try {
    const host = args.originHost;
    // Gate 1: the request must come from an approved publisher domain.
    if (!(await isPublisherApproved(args.tenantId, host))) return slots;
    // Gate 2: the advertiser must have wallet balance (billing lags; this stops
    // serving once the money runs out).
    if (!(await isWalletServable(args.tenantId))) return slots;

    const minuteBucket = Math.floor(Date.now() / 60_000);
    const now = new Date();

    // Behavioural targeting: an ad's spec is matched against the visitor's
    // profile. Untargeted ads serve to everyone. When we evaluate a targeted ad
    // against a real audience we "profile" the visitor — billed once per
    // visitor/day (recorded below).
    let profiledVisitor = false;
    const matchTargeting = (ad: Ad): boolean => {
      const targeting = parseAdTargeting(ad.targeting);
      if (!isUntargeted(targeting) && args.audience) profiledVisitor = true;
      return matchesTargeting(targeting, args.audience ?? null);
    };

    for (const slotType of args.blockKeys) {
      const ads = await fetchAdsForSlot(args.tenantId, slotType);
      if (ads.length === 0) continue;

      const ad = selectAd(ads, { now, matchTargeting });
      if (!ad) continue;

      // Impression (deduped across the per-page slot burst).
      void recordAdEvent({
        tenantId:        args.tenantId,
        adId:            ad.id,
        publisherDomain: host,
        eventType:       "impression",
        sessionId:       args.sessionId,
        eventKey:        impressionKey(ad.id, args.sessionId, minuteBucket),
        metadata:        { slot: slotType },
      });

      // Render the creative with a click-tracking CTA.
      const trackUrl = `${args.platformBase}/api/ad/click?ad=${encodeURIComponent(ad.id)}` +
        (host ? `&pub=${encodeURIComponent(host)}` : "") +
        (args.sessionId ? `&sid=${encodeURIComponent(args.sessionId)}` : "");
      const creative = injectClickTracking(slotType, ad.creative ?? {}, trackUrl);
      const html = renderBlockHtml(slotType, creative);
      if (!html) continue;

      const slot: BlockSlot = args.tokens && Object.keys(args.tokens).length > 0
        ? { mode: "block", html, tokens: args.tokens }
        : { mode: "block", html };
      slots[slotType] = slot;
    }

    // Profiling fee: if we evaluated a targeted ad against a real audience, the
    // visitor was profiled. Record it once per visitor/day (idempotent); the
    // billing rollup debits the advertiser wallet for new charges.
    if (profiledVisitor && args.sessionId) {
      void recordProfilingCharge(args.tenantId, args.sessionId, host);
    }
  } catch (err) {
    logger.warn("[ads] serveAds failed", { tenantId: args.tenantId, error: String(err) });
  }
  return slots;
}

export { hostFromOrigin };
