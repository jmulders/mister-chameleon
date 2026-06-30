/**
 * Lead Base — returning-visitor context injection (close the personalization loop).
 *
 * Turns the stored profile of a visitor we already know into live context
 * variables (isReturningVisitor, leadScore, isHotLead, isKnownLead, …) on
 * `ctx.enrichment`, so the existing rules / segments / AI can adapt the site for
 * them. MUST run BEFORE evaluateAudienceSegments() so segments can target these.
 * See docs/lead-base-design.md.
 */

import "server-only";

import type { EnrichmentOutput }          from "@/enrichment/types";
import { leadScore }                      from "./lead-scoring";
import type { ReturningProfileSignals }   from "./visitor-profiles-store";

const DEFAULT_HOT_THRESHOLD = 60;

type Injectable = { enrichment: Partial<EnrichmentOutput> };

/**
 * Write returning-visitor signals into `ctx.enrichment`. `signals` is the prior
 * profile (or null on a first visit). `hotThreshold` gates `isHotLead`.
 */
export function injectReturningVisitorContext(
  ctx:          Injectable,
  signals:      ReturningProfileSignals | null,
  hotThreshold: number = DEFAULT_HOT_THRESHOLD,
): void {
  if (!signals) {
    // First-ever visit: be explicit so rules can test for it.
    ctx.enrichment = { ...ctx.enrichment, isReturningVisitor: false };
    return;
  }

  // Score "as of now" — they're actively visiting, so recency is current.
  const score = leadScore({
    identityLevel: signals.identityLevel,
    intentScore:   signals.intentScore,
    lastSeenAt:    new Date().toISOString(),
    visitCount:    signals.visitCount,
  });

  const isCustomer = signals.identityLevel === "customer";
  const isKnown    = isCustomer || signals.identityLevel === "known";
  const daysSince  = signals.lastSeenAt
    ? Math.max(0, Math.floor((Date.now() - Date.parse(signals.lastSeenAt)) / 86_400_000))
    : null;

  ctx.enrichment = {
    ...ctx.enrichment,
    isReturningVisitor:  true,
    returningLeadLevel:  signals.identityLevel,
    returningLeadStatus: signals.status,
    leadScore:           score,
    isHotLead:           score >= hotThreshold,
    isKnownLead:         isKnown,
    isCustomer,
    priorVisitCount:     signals.visitCount,
    daysSinceLastVisit:  daysSince,
  };
}
