/**
 * ABM known-lead context injection (shared).
 *
 * When a visitor arrived via a personalized URL (the /go/{token} handler set the
 * `mc_lead` cookie), this folds the lead into the decision context:
 *   • its `segment_hint` is added to `audienceSegmentIds` so the existing
 *     segment→variant path personalizes for the known account;
 *   • a `knownLead` block is attached for the AI prompt + named greeting.
 *
 * Called wherever a DecisionContext is built (homepage pipeline + [slug]
 * decision). Fail-open: no cookie / unknown / inactive lead → no-op.
 */

import "server-only";

import { getAbmLeadById }        from "@/lib/abm/abm-store";
import type { KnownLeadContext } from "@/decision/decision-context";

type Injectable = {
  audienceSegmentIds: string | null;
  knownLead?:         KnownLeadContext;
};

export async function applyKnownLead(
  ctx:         Injectable,
  cookieValue: string | undefined,
): Promise<void> {
  if (!cookieValue) return;

  const lead = await getAbmLeadById(cookieValue);
  if (!lead || lead.status !== "active") return;

  if (lead.segmentHint) {
    const ids = (ctx.audienceSegmentIds ?? "")
      .split(",").map((s) => s.trim()).filter(Boolean);
    if (!ids.includes(lead.segmentHint)) ids.push(lead.segmentHint);
    ctx.audienceSegmentIds = ids.join(",") || null;
  }

  ctx.knownLead = {
    ...(lead.profile.firstName   ? { firstName:   lead.profile.firstName }   : {}),
    ...(lead.profile.name        ? { name:        lead.profile.name }        : {}),
    ...(lead.profile.company     ? { company:     lead.profile.company }     : {}),
    ...(lead.profile.role        ? { role:        lead.profile.role }        : {}),
    ...(lead.profile.industry    ? { industry:    lead.profile.industry }    : {}),
    ...(lead.profile.companySize ? { companySize: lead.profile.companySize } : {}),
    confidence: "exact",
  };
}
