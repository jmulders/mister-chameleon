/**
 * ABM known-lead context injection (shared).
 *
 * When a visitor arrived via a personalized URL (the /go/{token} handler set the
 * `mc_lead` cookie), this folds the lead into the decision context in two ordered
 * phases that straddle the audience-segment evaluation:
 *
 *   PHASE 1 — injectKnownLeadContext()  (BEFORE evaluateAudienceSegments):
 *     • the lead's firmographics (company / industry / company size) are written
 *       into the `enrichment` layer — the SAME context variables (companyName,
 *       companyIndustry, companySize, targetAccountMatched) that reverse-IP / CRM
 *       enrichment would populate. Because these are present before the segment
 *       evaluator runs, audience segments defined on firmographics AUTO-MATCH the
 *       known account, and decision RULES can condition on them so content adapts.
 *       The lead is an exact identity, so it overrides any lower-confidence
 *       enrichment guess for those fields;
 *     • a `knownLead` block is attached for the AI prompt + named greeting.
 *
 *   PHASE 2 — forceKnownLeadSegment()  (AFTER evaluateAudienceSegments):
 *     • the lead's explicit `segment_hint` is added to `audienceSegmentIds`.
 *       This runs last because applyAudienceSegments() REPLACES the id set, so an
 *       explicitly-linked segment must be folded in on top of the auto-matched
 *       result rather than before it (where it would be wiped).
 *
 * `applyKnownLead()` remains as an order-agnostic convenience (resolve + both
 * phases in one call) for callers that don't separately evaluate segments.
 *
 * Note: there is no firmographic rule field for the lead's *role* (job title),
 * so that value is carried only in `knownLead` (AI + greeting), not enrichment.
 *
 * Where the data lives: nothing is persisted to the session row. The lead record
 * (Supabase `abm_leads`) is the source of truth; it is re-resolved from the
 * `mc_lead` cookie on every request and injected into the per-request
 * DecisionContext here.
 *
 * Called wherever a DecisionContext is built (homepage pipeline + [slug]
 * decision). Fail-open: no cookie / unknown / inactive lead → no-op.
 */

import "server-only";

import { getAbmLeadById }        from "@/lib/abm/abm-store";
import type { AbmLead }          from "@/lib/abm/abm-store";
import type { KnownLeadContext } from "@/decision/decision-context";
import type { EnrichmentOutput } from "@/enrichment/types";

type Injectable = {
  audienceSegmentIds: string | null;
  enrichment:         Partial<EnrichmentOutput>;
  knownLead?:         KnownLeadContext;
};

/**
 * Resolve the active lead referenced by the `mc_lead` cookie, or null.
 * Single fetch — pass the result to both phases to avoid a double lookup.
 */
export async function resolveActiveKnownLead(
  cookieValue: string | undefined,
): Promise<AbmLead | null> {
  if (!cookieValue) return null;
  const lead = await getAbmLeadById(cookieValue);
  return lead && lead.status === "active" ? lead : null;
}

/**
 * PHASE 1 — load the lead's firmographics into the enrichment context and attach
 * the exact identity. MUST run BEFORE evaluateAudienceSegments() so firmographic
 * segments auto-match the known account.
 */
export function injectKnownLeadContext(ctx: Injectable, lead: AbmLead): void {
  const firmographics: Partial<EnrichmentOutput> = {
    ...(lead.profile.company     ? { companyName:     lead.profile.company }     : {}),
    ...(lead.profile.industry    ? { companyIndustry: lead.profile.industry }    : {}),
    ...(lead.profile.companySize ? { companySize:     lead.profile.companySize } : {}),
    // A lead arriving via a personalized URL IS a matched target account.
    targetAccountMatched:   true,
    companyMatchSource:     "abm-known-lead",
    companyMatchConfidence: 1,
  };
  ctx.enrichment = { ...ctx.enrichment, ...firmographics };

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

/**
 * PHASE 2 — force the lead's explicitly-linked segment into audienceSegmentIds.
 * MUST run AFTER evaluateAudienceSegments() (which replaces the id set).
 */
export function forceKnownLeadSegment(ctx: Injectable, lead: AbmLead): void {
  if (!lead.segmentHint) return;
  const ids = (ctx.audienceSegmentIds ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  if (!ids.includes(lead.segmentHint)) ids.push(lead.segmentHint);
  ctx.audienceSegmentIds = ids.join(",") || null;
}

/**
 * Order-agnostic convenience: resolve + inject context + force segment in one
 * call. Use the split phases when the caller evaluates audience segments between
 * them (so firmographic segments auto-match). Fail-open: no cookie / unknown /
 * inactive lead → no-op.
 */
export async function applyKnownLead(
  ctx:         Injectable,
  cookieValue: string | undefined,
): Promise<void> {
  const lead = await resolveActiveKnownLead(cookieValue);
  if (!lead) return;
  injectKnownLeadContext(ctx, lead);
  forceKnownLeadSegment(ctx, lead);
}
