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
 * See docs/lead-base-design.md.
 */

import "server-only";

import { captureInboundLead, extractSubmittedEmail } from "./inbound-capture";
import { markProfileConverted } from "./visitor-profiles-store";
import { sendConversion } from "@/lib/ad-sync/conversion-engine";
import { logger } from "@/lib/logger";

export async function reportInboundConversion(args: {
  tenantId:    string;
  values:      Record<string, string>;
  sessionId?:  string | null;
  targetPath?: string;
  /** Label for the conversion event (Meta/LinkedIn + our log). Defaults to "Lead". */
  eventName?:  string;
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
      await sendConversion(args.tenantId, { email, eventName }, "conversion");
    }
  } catch (err) {
    logger.warn("[lead-base] reportInboundConversion failed", {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
