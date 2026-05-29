/**
 * Decision Layer — CachingDecisionProvider Decorator
 *
 * Wraps any DecisionProvider and caches the resolved ExperiencePlan per
 * (sessionId, contextHash) pair.  On cache hit, the inner provider is never
 * called — the plan is returned directly from memory.  On cache miss, the
 * inner provider is called and its result is stored for subsequent requests.
 *
 * ─── When the cache is used ───────────────────────────────────────────────────
 *
 *   The decorator caches when a non-null `sessionId` is provided.  Requests
 *   without a sessionId (e.g. SSR for bots, preview mode) are always passed
 *   straight through to the inner provider — their plans should not pollute
 *   the session-keyed cache.
 *
 * ─── Context hash ────────────────────────────────────────────────────────────
 *
 *   The plan is invalidated when the visitor's context changes.  The hash is
 *   computed from the decision-relevant subset of DecisionInput fields:
 *   source, device, geo country, industry, UTM params, visit-type,
 *   page-view bucket, and CTA click status.
 *
 *   Fields that do NOT influence the decision (e.g. raw IP, requestId, all
 *   enrichment debug info) are excluded from the hash so they don't trigger
 *   spurious re-evaluations.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   The decorator is applied inside `composeHomepageExperience` when a
 *   `sessionId` option is provided.  Callers do not need to import or
 *   instantiate this class directly:
 *
 *   @example
 *   const { experience, meta } = await composeHomepageExperience(
 *     input,
 *     decisionProvider,
 *     cmsProvider,
 *     cmsFallbackKeys,
 *     { sessionId, tenantId },
 *   );
 */

import type { DecisionProvider }           from "./decision-provider";
import type { DecisionInput, ExperiencePlan } from "@/decision/types";
import {
  getDecisionPlan,
  setDecisionPlan,
  hashDecisionContext,
} from "@/cache/decision-cache";
import { logger } from "@/lib/logger";

// ── Decorator ─────────────────────────────────────────────────────────────────

export class CachingDecisionProvider implements DecisionProvider {
  constructor(
    private readonly inner:     DecisionProvider,
    private readonly sessionId: string,
    private readonly tenantId:  string | null | undefined,
  ) {}

  async getHomepagePlan(input: DecisionInput): Promise<ExperiencePlan> {
    const contextHash = hashDecisionContext(input as unknown as Record<string, unknown>);

    // ── Cache hit ──────────────────────────────────────────────────────────
    const cached = getDecisionPlan(this.sessionId, contextHash);
    if (cached) {
      logger.debug("[DecisionCache] Hit — returning cached plan.", {
        sessionId:   this.sessionId,
        contextHash,
        heroKey:     cached.heroKey,
        proofKey:    cached.proofKey,
        ctaKey:      cached.ctaKey,
        reason:      cached.reason,
      });
      return cached;
    }

    // ── Cache miss — evaluate and store ───────────────────────────────────
    logger.debug("[DecisionCache] Miss — evaluating inner provider.", {
      sessionId:   this.sessionId,
      contextHash,
    });

    const plan = await this.inner.getHomepagePlan(input);

    setDecisionPlan(this.sessionId, contextHash, plan, this.tenantId);

    logger.debug("[DecisionCache] Plan cached.", {
      sessionId:   this.sessionId,
      contextHash,
      heroKey:     plan.heroKey,
      proofKey:    plan.proofKey,
      ctaKey:      plan.ctaKey,
    });

    return plan;
  }
}
