/**
 * Customer Mode Derivation
 *
 * Determines the current customer experience mode from a combination of:
 *   - CRM data (lifecycleStage, customerSince, planTier, lastActivityAt)
 *   - Behavioral signals (recencyScore, frictionScore, pageViewCount, etc.)
 *
 * ─── Mode definitions ─────────────────────────────────────────────────────────
 *
 *   onboarding_mode    New customer (< 30 days since customerSince, or first
 *                      few sessions).  Experience: setup guide, tutorials,
 *                      "get started" hero.
 *
 *   active_usage_mode  Established customer with healthy activity and low
 *                      friction.  Experience: continue-where-you-left-off,
 *                      feature discovery.
 *
 *   expansion_mode     High-engagement customer whose behavior signals
 *                      interest in features outside their current plan.
 *                      Experience: upgrade CTA, advanced use-case proof.
 *
 *   churn_risk_mode    Customer showing declining engagement, high friction,
 *                      or support-heavy behavior.  Experience: retention hero,
 *                      success stories, support CTA.
 *
 *   acquisition_mode   Visitor is NOT a customer (pre-conversion).
 *                      Standard conversion funnel experience.
 *
 * ─── Priority order ───────────────────────────────────────────────────────────
 *
 *   churn_risk > expansion > onboarding > active_usage
 *
 *   Churn risk always overrides expansion because retention is more urgent
 *   than upsell for at-risk accounts.
 */

import type { CustomerMode, CrmProfile } from "./types";
import type { JourneyState } from "@/lib/journey/types";

// ── Thresholds ────────────────────────────────────────────────────────────────

/** Customers less than this many days old are in onboarding mode. */
const ONBOARDING_DAYS_THRESHOLD = 30;

/** Recency score below this threshold contributes to churn risk detection. */
const CHURN_RECENCY_THRESHOLD = 20;

/** Friction score above this threshold contributes to churn risk detection. */
const CHURN_FRICTION_THRESHOLD = 50;

/** Intent score required to indicate active engagement. */
const ACTIVE_INTENT_THRESHOLD = 25;

/**
 * Minimum pageViewCount to indicate the customer is actively using the product.
 * Below this, they're either new or disengaged.
 */
const ACTIVE_PAGE_VIEW_THRESHOLD = 5;

/** Signal diversity threshold that suggests expansion interest. */
const EXPANSION_DIVERSITY_THRESHOLD = 0.5;

/** Intent score that suggests the customer is interested in more features. */
const EXPANSION_INTENT_THRESHOLD = 40;

// ── computeCustomerMode ───────────────────────────────────────────────────────

/**
 * Derives the current customer experience mode from CRM + behavioral signals.
 *
 * @param crm      Resolved CRM profile (may be empty/unmatched).
 * @param journey  Current journey/behavioral state.
 * @returns        The appropriate CustomerMode for this visitor.
 */
export function computeCustomerMode(
  crm:     CrmProfile,
  journey: JourneyState,
): CustomerMode {
  // Pre-conversion: acquisition mode (handled by main funnel)
  const isCustomer = crm.isCustomer || journey.funnelStage === "customer";
  if (!isCustomer) return "acquisition_mode";

  // ── Churn risk detection ─────────────────────────────────────────────────
  //
  // Churn risk overrides all other modes — retention is more urgent than upsell.
  //
  // Signals:
  //   - Very low recency (haven't been active recently)
  //   - High friction (confused / struggling)
  //   - No meaningful engagement in this session
  const lowRecency   = journey.recencyScore     < CHURN_RECENCY_THRESHOLD;
  const highFriction = journey.frictionScore    > CHURN_FRICTION_THRESHOLD;
  const noEngagement = journey.pageViewCount    < 2 && journey.intentScore < 10;

  // Also treat CRM last activity as a churn signal
  const crmInactive = crm.lastActivityAt
    ? daysSince(crm.lastActivityAt) > 60
    : false;

  if ((lowRecency && noEngagement) || (highFriction && lowRecency) || crmInactive) {
    return "churn_risk_mode";
  }

  // ── Onboarding detection ─────────────────────────────────────────────────
  //
  // Signals:
  //   - New customer (CRM customerSince < 30 days)
  //   - OR very few page views (first-time user pattern)
  const isNewCustomer = crm.customerSince
    ? daysSince(crm.customerSince) < ONBOARDING_DAYS_THRESHOLD
    : false;

  const isFirstSessions = journey.pageViewCount < ACTIVE_PAGE_VIEW_THRESHOLD
    && journey.repeatSessionBonus < 0.3;

  if (isNewCustomer || isFirstSessions) {
    return "onboarding_mode";
  }

  // ── Expansion detection ──────────────────────────────────────────────────
  //
  // Signals:
  //   - High signal diversity (interested in many features)
  //   - High intent score (actively researching/exploring)
  //   - OR visiting integration/feature pages on a lower plan
  const highDiversity    = journey.signalDiversityScore >= EXPANSION_DIVERSITY_THRESHOLD;
  const highIntent       = journey.intentScore          >= EXPANSION_INTENT_THRESHOLD;
  const matchedSequences = journey.matchedSequences.length > 0;

  // Plan tier mismatch: on a lower tier but showing high-value feature interest
  const isLowerTier = crm.planTier === "basic" || crm.planTier === "starter" || crm.planTier === "free";
  const showsHighInterest = highDiversity && highIntent;

  if (showsHighInterest || (isLowerTier && matchedSequences && highIntent)) {
    return "expansion_mode";
  }

  // ── Active usage mode (default for healthy, established customers) ─────────
  return "active_usage_mode";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the number of whole days between the given ISO timestamp and now.
 * Returns 0 on any parsing error (safe default).
 */
function daysSince(iso: string): number {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    return Math.max(0, Math.floor(ms / 86_400_000));
  } catch {
    return 0;
  }
}
