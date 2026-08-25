/**
 * Lead Base — unified inbound-conversion reporter.
 *
 * One helper for every public form-submit endpoint (contact, registered forms,
 * trial signup, demo booking, …). It:
 *   • captures the submission as a named lead (deduped by email) in the Lead Base,
 *   • marks the visitor's profile as converted (when a session id is known),
 *   • reports the conversion to every configured ad platform (Google/Meta/LinkedIn)
 *     so bidding optimises on real leads.
 *
 * Fail-open: never throws, never blocks the caller's response. The submitted
 * email is a voluntary first-party contact, so capture is not consent-gated.
 *
 * Ad click identifiers (gclid/fbclid) are a separate matter: forwarding them to
 * a third-party conversion API is only done under explicit advertising/marketing
 * consent (resolved from the visitor's cookie). Without that basis the
 * conversion is still reported, but with no ad identifier attached.
 *
 * See docs/lead-base-design.md and docs/design/advertising-consent-capi.md.
 */

import "server-only";

import { captureInboundLead, extractSubmittedEmail } from "./inbound-capture";
import { getProfileClickIds, markProfileConverted } from "./visitor-profiles-store";
import { sendConversion } from "@/lib/ad-sync/conversion-engine";
import { resolveConsent } from "@/lib/consent/server-consent";
import type { TenantPrivacySettings } from "@/tenant/types";
import { logger } from "@/lib/logger";

export async function reportInboundConversion(args: {
  tenantId:    string;
  values:      Record<string, string>;
  sessionId?:  string | null;
  targetPath?: string;
  /** Label for the conversion event (Meta/LinkedIn + our log). Defaults to "Lead". */
  eventName?:  string;
  /** Optional monetary value of the conversion (e.g. a purchase amount). */
  value?:      number;
  /** ISO currency for `value` (e.g. "EUR"). */
  currency?:   string;
  /**
   * The visitor's raw Cookie header (`request.headers.get("cookie")`). Used to
   * resolve advertising/marketing consent, which gates whether the first-touch
   * gclid/fbclid are forwarded to the ad platforms. Server-to-server callers
   * that have no visitor cookie (e.g. the Stripe webhook) simply omit it, and no
   * ad identifier is ever forwarded. See docs/design/advertising-consent-capi.md.
   */
  cookieHeader?:   string | null;
  /** Tenant privacy ceiling, applied on top of the cookie when available. */
  tenantPrivacy?:  TenantPrivacySettings | null;
}): Promise<void> {
  const sessionId  = args.sessionId ?? null;
  const targetPath = args.targetPath ?? "/";
  const eventName  = args.eventName ?? "Lead";

  try {
    await captureInboundLead({
      tenantId:   args.tenantId,
      visitorKey: sessionId,
      values:     args.values,
      targetPath,
    });

    if (sessionId) await markProfileConverted(args.tenantId, sessionId);

    const email = extractSubmittedEmail(args.values);
    if (email) {
      // Advertising/marketing consent gate: only with an explicit advertising
      // basis may the stored gclid/fbclid be forwarded to a third-party CAPI.
      // No cookie header (server-to-server) => no advertising consent => no ids.
      const advertisingConsent =
        args.cookieHeader !== undefined
          ? resolveConsent(args.cookieHeader ?? null, args.tenantPrivacy ?? null).advertising
          : false;
      const clickIds = (advertisingConsent && sessionId)
        ? await getProfileClickIds(args.tenantId, sessionId)
        : { gclid: null, fbclid: null };
      await sendConversion(
        args.tenantId,
        {
          email,
          eventName,
          ...(clickIds.gclid  ? { gclid:  clickIds.gclid }  : {}),
          ...(clickIds.fbclid ? { fbclid: clickIds.fbclid } : {}),
          ...(typeof args.value === "number" && args.value > 0 ? { value: args.value } : {}),
          ...(args.currency ? { currency: args.currency } : {}),
        },
        "conversion",
      );
    }
  } catch (err) {
    logger.warn("[lead-base] reportInboundConversion failed", {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
