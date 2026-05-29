/**
 * CRM + Behavior Lifecycle Merge
 *
 * Combines CRM data with behavioral signals to produce the final
 * `CrmMergedState` used by the rules engine and adaptive decision pipeline.
 *
 * ─── Override hierarchy ───────────────────────────────────────────────────────
 *
 *   Priority 1: CRM (when matched and confident)
 *     - CRM says "customer" → override behavioral "high_intent" or "intent"
 *     - CRM says "opportunity" → can boost behavioral "consideration" to "intent"
 *     - CRM says "churned" → override to churn_risk (even if behavior says customer)
 *
 *   Priority 2: Behavioral signals
 *     - Used when CRM is unavailable, unmatched, or stage is "unknown"
 *     - Maps funnelStage → CrmLifecycleStage
 *
 *   Priority 3: Fallback
 *     - lifecycleStage = "unknown" when both are absent
 *
 * ─── Double-counting prevention ──────────────────────────────────────────────
 *
 *   CRM provides STATE — what the visitor definitively is.
 *   Behavior provides SIGNAL — what the visitor currently does.
 *
 *   These are NEVER summed or averaged.  CRM overrides behavioral inference
 *   when available.  Behavioral signals are only used to fill gaps.
 *
 * ─── Fail-safe ────────────────────────────────────────────────────────────────
 *
 *   If the CRM is unavailable or unmatched, mergeCrmWithBehavior() always
 *   falls back to behavioral signals gracefully.  It never throws.
 */

import type { CrmProfile, CrmLifecycleStage, CrmMergedState } from "./types";
import { emptyCrmProfile } from "./types";
import { computeCustomerMode } from "./derive-customer-mode";
import type { JourneyState, JourneyFunnelStage } from "@/lib/journey/types";

// ── Behavioral fallback mapping ───────────────────────────────────────────────

/**
 * Maps a behavioral funnelStage to the closest CrmLifecycleStage.
 * Used when CRM is unavailable or unmatched.
 */
function funnelStageToCrmLifecycle(stage: JourneyFunnelStage): CrmLifecycleStage {
  switch (stage) {
    case "customer":     return "customer";
    case "high_intent":  return "opportunity";
    case "intent":       return "opportunity";
    case "consideration":return "lead";
    case "awareness":    return "lead";
    default:             return "unknown";
  }
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Merges CRM profile data with behavioral journey state into the final
 * `CrmMergedState` consumed by the rules engine and decision pipeline.
 *
 * @param crm     Resolved CRM profile (use emptyCrmProfile() when not available).
 * @param journey Current journey/behavioral state for this visitor.
 * @returns       Merged lifecycle state — never throws.
 */
export function mergeCrmWithBehavior(
  crm:     CrmProfile,
  journey: JourneyState,
): CrmMergedState {
  const reasons: string[] = [];

  let lifecycleStage:  CrmLifecycleStage;
  let lifecycleSource: CrmMergedState["lifecycleSource"];
  let crmOverrodeStage = false;

  // ── Step 1: determine the behavioral lifecycle stage (baseline) ────────────

  const behavioralLifecycle = funnelStageToCrmLifecycle(journey.funnelStage);

  // ── Step 2: apply CRM override (when matched and confidence is high) ────────

  if (crm.matched && crm.lifecycleStage !== "unknown") {
    lifecycleStage  = crm.lifecycleStage;
    lifecycleSource = "crm";

    if (lifecycleStage !== behavioralLifecycle) {
      crmOverrodeStage = true;
      reasons.push(
        `CRM provides lifecycle stage "${lifecycleStage}" — overrides behavioral inference "${behavioralLifecycle}".`,
      );
    } else {
      reasons.push(
        `CRM confirms behavioral stage: both indicate "${lifecycleStage}".`,
      );
    }

    // Special case: CRM says churned → this is always a strong override
    if (lifecycleStage === "churned") {
      reasons.push("CRM reports churned — churn risk mode activated.");
    }
  } else {
    // ── Step 3: fall back to behavioral signals ────────────────────────────

    if (!crm.matched) {
      reasons.push("No CRM match — using behavioral funnel stage as lifecycle.");
    } else if (crm.lifecycleStage === "unknown") {
      reasons.push("CRM matched but lifecycle stage is unknown — using behavioral stage.");
    }

    lifecycleStage  = behavioralLifecycle;
    lifecycleSource = journey.fromDatabase ? "behavior" : "fallback";

    if (!journey.fromDatabase) {
      reasons.push("No behavioral data yet — lifecycle is unknown.");
    }
  }

  // ── Step 4: determine isCustomer ──────────────────────────────────────────

  const isCustomer =
    crm.isCustomer ||
    lifecycleStage === "customer" ||
    journey.funnelStage === "customer";

  if (isCustomer && !crm.isCustomer && !crm.matched) {
    reasons.push("Visitor is a customer based on form submission (behavioral signal).");
  } else if (isCustomer && crm.isCustomer) {
    reasons.push("CRM confirms visitor is a paying customer.");
  }

  // ── Step 5: compute customer age ──────────────────────────────────────────

  let customerAgeDays: number | null = null;
  if (crm.customerSince) {
    try {
      const ms = Date.now() - new Date(crm.customerSince).getTime();
      customerAgeDays = Math.max(0, Math.floor(ms / 86_400_000));
      reasons.push(`Customer for ${customerAgeDays} day${customerAgeDays === 1 ? "" : "s"}.`);
    } catch {
      // swallow parse error
    }
  }

  // ── Step 6: compute customer mode ─────────────────────────────────────────

  const customerMode = computeCustomerMode(crm, journey);

  if (isCustomer) {
    reasons.push(`Customer mode: ${customerMode.replace(/_/g, " ")}.`);
  }

  // ── Step 7: confidence note ────────────────────────────────────────────────

  if (journey.confidence.band === "low" && !crm.matched) {
    reasons.push("Low confidence — more signals needed before strong personalization.");
  }

  return {
    lifecycleStage,
    lifecycleSource,
    isCustomer,
    customerMode,
    crm,
    customerAgeDays,
    crmOverrodeStage,
    reasons,
  };
}

// ── normalizeCrmProfile ───────────────────────────────────────────────────────

/**
 * Converts the raw CRM enrichment output (from the enrichment pipeline) into
 * a normalized CrmProfile.
 *
 * Import from "@/enrichment/types" to access EnrichmentOutput fields.
 */
export function normalizeCrmProfile(
  enrichment: {
    crmMatched?:        boolean | null;
    crmLifecycleStage?: string  | null;
    crmIsCustomer?:     boolean | null;
    crmSegment?:        string  | null;
    crmCompanyId?:      string  | null;
    crmCompanyName?:    string  | null;
    crmCompanyDomain?:  string  | null;
    crmIndustry?:       string  | null;
    crmPlanTier?:       string  | null;
    crmDealStage?:      string  | null;
    crmContractValue?:  number  | null;
    crmCustomerSince?:  string  | null;
    crmLastActivityAt?: string  | null;
    crmContactId?:      string  | null;
    crmAccountId?:      string  | null;
  } | null | undefined,
): CrmProfile {
  if (!enrichment?.crmMatched) return emptyCrmProfile();

  const rawStage = enrichment.crmLifecycleStage ?? null;

  // Import inline to avoid circular dependency — types.ts has no project imports
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { normalizeCrmLifecycleStage } = require("./types") as typeof import("./types");
  const normalized = normalizeCrmLifecycleStage(rawStage);

  return {
    matched:           true,
    contactId:         enrichment.crmContactId       ?? null,
    email:             null,  // never from enrichment — only from form submit
    accountId:         enrichment.crmAccountId       ?? enrichment.crmCompanyId ?? null,
    lifecycleStage:    normalized,
    rawLifecycleStage: rawStage,
    isCustomer:        enrichment.crmIsCustomer       ?? normalized === "customer",
    dealStage:         enrichment.crmDealStage        ?? null,
    planTier:          enrichment.crmPlanTier         ?? null,
    contractValue:     enrichment.crmContractValue    ?? null,
    customerSince:     enrichment.crmCustomerSince    ?? null,
    lastActivityAt:    enrichment.crmLastActivityAt   ?? null,
    companyName:       enrichment.crmCompanyName      ?? null,
    companyDomain:     enrichment.crmCompanyDomain    ?? null,
    industry:          enrichment.crmIndustry         ?? null,
    segment:           enrichment.crmSegment          ?? null,
  };
}
