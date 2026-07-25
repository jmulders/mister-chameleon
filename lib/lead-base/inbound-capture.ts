/**
 * Lead Base — inbound form capture.
 *
 * Turns a form submission (voluntary first-party contact) into a named lead:
 *   • extracts email + name/company/phone from the submitted field values,
 *   • upserts an `abm_leads` row (deduped by email), which is where the Lead Base
 *     keeps PII and what the retargeting segment + outbound follow-up read,
 *   • links the visitor's profile to that lead and upgrades it to "known".
 *
 * A submitted email is an explicit, voluntary contact — a lawful basis in itself —
 * so this is NOT gated on cookie consent (unlike passive behavioural tracking).
 * Fail-open: never throws, never blocks the form response.
 *
 * See docs/lead-base-design.md.
 */

import "server-only";

import { createHash } from "node:crypto";
import { upsertAbmLead, type AbmLeadProfile } from "@/lib/abm/abm-store";
import { linkProfileToAbmLead } from "./visitor-profiles-store";
import { getTenantById } from "@/tenant/server";
import { sendAdaptiveEmail } from "@/lib/email/send-adaptive-email";
import type { EmailTemplateKey } from "@/lib/email/adaptive-email";
import { logger } from "@/lib/logger";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** First value whose key matches `keyRe`, else undefined. */
function pick(values: Record<string, string>, keyRe: RegExp): string | undefined {
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === "string" && v.trim() && keyRe.test(k)) return v.trim();
  }
  return undefined;
}

/** Extract a submitted email: prefer an email-named field, else any email-shaped value. */
export function extractSubmittedEmail(values: Record<string, string>): string | null {
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === "string" && /e-?mail/i.test(k) && EMAIL_RE.test(v.trim())) {
      return v.trim().toLowerCase();
    }
  }
  for (const v of Object.values(values)) {
    if (typeof v === "string" && EMAIL_RE.test(v.trim())) return v.trim().toLowerCase();
  }
  return null;
}

/**
 * Capture a form submission as a named lead. No-op when there is no email.
 */
export async function captureInboundLead(args: {
  tenantId:   string;
  visitorKey: string | null;
  values:     Record<string, string>;
  targetPath: string;
}): Promise<void> {
  try {
    const email = extractSubmittedEmail(args.values);
    if (!email) return;   // no matchable identifier — nothing to capture

    const firstNameRaw = pick(args.values, /first.?name|voornaam/i);
    const lastName     = pick(args.values, /last.?name|achternaam|surname/i);
    const fullNameRaw  = pick(args.values, /^name$|^naam$|full.?name|volledige.?naam/i);
    const company      = pick(args.values, /company|bedrijf|organisation|organisatie/i);
    const phone        = pick(args.values, /phone|tel|telefoon|mobile|mobiel/i);

    const firstName = firstNameRaw ?? (fullNameRaw ? fullNameRaw.split(/\s+/)[0] : undefined);
    const joinedName = [firstNameRaw, lastName].filter(Boolean).join(" ");
    const fullName  = fullNameRaw ?? (joinedName || undefined);

    const profile: AbmLeadProfile = {
      email,
      ...(firstName ? { firstName } : {}),
      ...(fullName  ? { name: fullName } : {}),
      ...(company   ? { company } : {}),
      ...(phone     ? { phone } : {}),
    };

    // Deterministic identifier from email → repeat submissions upsert one lead.
    const identifier = `form_${createHash("sha256").update(`${args.tenantId}:${email}`).digest("hex").slice(0, 16)}`;

    const lead = await upsertAbmLead({
      tenantId:   args.tenantId,
      identifier,
      targetPath: args.targetPath || "/",
      profile,
      status:     "active",
    });
    if (!lead) return;

    if (args.visitorKey) {
      await linkProfileToAbmLead(args.tenantId, args.visitorKey, lead.id);
    }

    // Adaptive email follow-up — opt-in per tenant (settings.adaptiveEmail.onFormSubmit),
    // default off. Fire-and-forget; deduped per lead so a repeat submitter isn't
    // re-mailed. Never blocks the form response.
    try {
      const tenant = await getTenantById(args.tenantId);
      const trigger = (tenant as { adaptiveEmail?: { onFormSubmit?: { enabled?: boolean; templateKey?: string } } } | null)
        ?.adaptiveEmail?.onFormSubmit;
      if (trigger?.enabled && trigger.templateKey) {
        void sendAdaptiveEmail({
          tenantId:    args.tenantId,
          recipient:   { email, leadId: lead.id },
          templateKey: trigger.templateKey as EmailTemplateKey,
          dedupeKey:   lead.id,
        });
      }
    } catch { /* trigger is best-effort */ }
  } catch (err) {
    logger.warn("[lead-base] captureInboundLead failed", {
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
