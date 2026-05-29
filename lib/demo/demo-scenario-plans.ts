/**
 * Demo Scenario Plans  —  lib/demo/demo-scenario-plans.ts
 *
 * Maps scenario/preset keys to a concrete ExperiencePlan that the homepage
 * pipeline can use directly, bypassing the rule engine.
 *
 * ─── Purpose ─────────────────────────────────────────────────────────────────
 *
 *   When the Scenario Control Panel activates a preset it stores `_scenarioKey`
 *   in the mc_scenario cookie.  The server-side homepage pipeline reads this key
 *   and, when a matching plan exists here, bypasses the rule engine entirely
 *   and uses the hardcoded variant keys below.
 *
 *   This makes scenario switching work for tenants with no rules configured —
 *   which is the expected state for all demo / sales tenants.
 *
 * ─── Keys covered ─────────────────────────────────────────────────────────────
 *
 *   Canonical 6 demo scenarios:
 *     awareness, consideration, high_intent, form_dropout, customer, expansion
 *
 *   ScenarioControlPanel preset key aliases (mapped to the 6 above):
 *     new_visitor, google_campaign, enterprise_prospect, returning_visitor,
 *     trial_ready, form_dropoff, customer_onboarding, customer_expansion,
 *     post_conversion, high_friction, churn_risk
 */

import type { ExperiencePlan } from "@/decision/types";

// ── Canonical plan definitions ────────────────────────────────────────────────

const AWARENESS_PLAN: ExperiencePlan = {
  heroKey:        "hero_default",
  proofKey:       "proof_vision",
  ctaKey:         "cta_default",
  featureKey:     "feature_highlights",
  conversionKey:  "conversion_contact",
  pageBannerKey:  "hero_page_banner_awareness",
  reason:         "demo-scenario:awareness",
};

const CONSIDERATION_PLAN: ExperiencePlan = {
  heroKey:        "hero_consideration",
  proofKey:       "proof_cases",
  ctaKey:         "cta_demo",
  featureKey:     "feature_grid_primary",
  conversionKey:  "conversion_signup",
  pageBannerKey:  "hero_page_banner_consideration",
  reason:         "demo-scenario:consideration",
};

const HIGH_INTENT_PLAN: ExperiencePlan = {
  heroKey:          "hero_intent_direct",
  proofKey:         "proof_stats",
  ctaKey:           "cta_meeting",
  featureKey:       "feature_comparison",
  conversionKey:    "conversion_demo",
  notificationKey:  "notification_urgency",
  pageBannerKey:    "hero_page_banner_high_intent",
  reason:           "demo-scenario:high_intent",
};

const FORM_DROPOUT_PLAN: ExperiencePlan = {
  heroKey:          "hero_consideration",
  proofKey:         "proof_reassurance",
  ctaKey:           "cta_demo",
  featureKey:       "feature_comparison",
  conversionKey:    "conversion_demo",
  notificationKey:  "notification_returning",
  pageBannerKey:    "hero_page_banner_friction",
  reason:           "demo-scenario:form_dropout",
};

const CUSTOMER_PLAN: ExperiencePlan = {
  heroKey:        "hero_customer_onboarding",
  proofKey:       "proof_default",
  ctaKey:         "cta_onboarding",
  featureKey:     "feature_highlights",
  conversionKey:  "conversion_contact",
  pageBannerKey:  "hero_page_banner_returning",
  reason:         "demo-scenario:customer",
};

const EXPANSION_PLAN: ExperiencePlan = {
  heroKey:        "hero_customer_onboarding",
  proofKey:       "proof_stats",
  ctaKey:         "cta_expansion",
  featureKey:     "feature_grid_primary",
  conversionKey:  "conversion_demo",
  pageBannerKey:  "hero_page_banner_enterprise",
  reason:         "demo-scenario:expansion",
};

// ── Full lookup table ─────────────────────────────────────────────────────────
//
// Includes both the canonical 6-scenario keys AND ScenarioControlPanel preset
// key aliases so any preset produces visible variant changes.

export const DEMO_SCENARIO_PLANS: Record<string, ExperiencePlan> = {
  // Canonical 6 demo scenario keys
  awareness:     AWARENESS_PLAN,
  consideration: CONSIDERATION_PLAN,
  high_intent:   HIGH_INTENT_PLAN,
  form_dropout:  FORM_DROPOUT_PLAN,
  customer:      CUSTOMER_PLAN,
  expansion:     EXPANSION_PLAN,

  // ScenarioControlPanel preset key aliases
  new_visitor:          AWARENESS_PLAN,
  google_campaign:      AWARENESS_PLAN,
  enterprise_prospect:  CONSIDERATION_PLAN,
  returning_visitor:    CONSIDERATION_PLAN,
  trial_ready:          CONSIDERATION_PLAN,
  form_dropoff:         FORM_DROPOUT_PLAN,
  customer_onboarding:  CUSTOMER_PLAN,
  customer_expansion:   EXPANSION_PLAN,
  post_conversion:      CUSTOMER_PLAN,
  high_friction:        AWARENESS_PLAN,
  churn_risk:           EXPANSION_PLAN,
};

/**
 * Returns the ExperiencePlan for a given scenario/preset key, or null when
 * the key has no matching plan.
 */
export function getDemoScenarioPlan(key: string | null | undefined): ExperiencePlan | null {
  if (!key) return null;
  return DEMO_SCENARIO_PLANS[key] ?? null;
}

// ── Segment demo plans ────────────────────────────────────────────────────────
//
// Maps audience segment keys to concrete ExperiencePlans.
//
// These are used by the homepage pipeline (and cms-page-decision) to bypass
// the rules engine when the Scenario Control Panel has overridden
// `audienceSegmentIds`.  Without this bypass, segment overrides would only
// produce visible changes when the tenant also has matching segment-based
// rules saved in their `rules_config` DB row — which is never guaranteed in
// demo / sales environments.
//
// Variant choices mirror the segment rules in runtime-rules.json so that
// real tenant rules (when present) and the demo bypass produce consistent
// results.

const SEGMENT_TARGET_ACCOUNT: ExperiencePlan = {
  heroKey:         "hero_direct_brand",
  proofKey:        "proof_cases",
  ctaKey:          "cta_meeting",
  featureKey:      "feature_comparison",
  conversionKey:   "conversion_demo",
  notificationKey: "notification_offer",
  pageBannerKey:   "hero_page_banner_enterprise",
  reason:          "demo-segment:target-account",
};

const SEGMENT_CRM_KNOWN: ExperiencePlan = {
  heroKey:         "hero_consideration",
  proofKey:        "proof_vision",
  ctaKey:          "cta_meeting",
  featureKey:      "feature_highlights",
  conversionKey:   "conversion_contact",
  notificationKey: "notification_returning",
  pageBannerKey:   "hero_page_banner_returning",
  reason:          "demo-segment:crm-known",
};

const SEGMENT_READY_TO_CONVERT: ExperiencePlan = {
  heroKey:         "hero_intent_direct",
  proofKey:        "proof_cases",
  ctaKey:          "cta_meeting",
  featureKey:      "feature_comparison",
  conversionKey:   "conversion_demo",
  notificationKey: "notification_urgency",
  pageBannerKey:   "hero_page_banner_high_intent",
  reason:          "demo-segment:ready-to-convert",
};

const SEGMENT_HIGH_INTENT: ExperiencePlan = {
  heroKey:         "hero_intent_direct",
  proofKey:        "proof_cases",
  ctaKey:          "cta_meeting",
  featureKey:      "feature_comparison",
  conversionKey:   "conversion_demo",
  notificationKey: "notification_offer",
  pageBannerKey:   "hero_page_banner_high_intent",
  reason:          "demo-segment:high-intent",
};

const SEGMENT_ENTERPRISE_PROSPECT: ExperiencePlan = {
  heroKey:        "hero_linkedin_vision",
  proofKey:       "proof_cases",
  ctaKey:         "cta_meeting",
  featureKey:     "feature_comparison",
  conversionKey:  "conversion_demo",
  pageBannerKey:  "hero_page_banner_enterprise",
  reason:         "demo-segment:enterprise-prospect",
};

const SEGMENT_PRICING_RESEARCHER: ExperiencePlan = {
  heroKey:         "hero_intent_direct",
  proofKey:        "proof_stats",
  ctaKey:          "cta_platform",
  featureKey:      "feature_comparison",
  conversionKey:   "conversion_demo",
  notificationKey: "notification_urgency",
  pageBannerKey:   "hero_page_banner_high_intent",
  reason:          "demo-segment:pricing-researcher",
};

const SEGMENT_RETURNING_ENGAGER: ExperiencePlan = {
  heroKey:         "hero_consideration",
  proofKey:        "proof_vision",
  ctaKey:          "cta_meeting",
  featureKey:      "feature_comparison",
  conversionKey:   "conversion_demo",
  notificationKey: "notification_returning",
  pageBannerKey:   "hero_page_banner_returning",
  reason:          "demo-segment:returning-engager",
};

const SEGMENT_LINKEDIN_TRAFFIC: ExperiencePlan = {
  heroKey:        "hero_linkedin_vision",
  proofKey:       "proof_vision",
  ctaKey:         "cta_platform",
  featureKey:     "feature_highlights",
  conversionKey:  "conversion_contact",
  pageBannerKey:  "hero_page_banner_consideration",
  reason:         "demo-segment:linkedin-traffic",
};

const SEGMENT_PAID_ACQUISITION: ExperiencePlan = {
  heroKey:        "hero_google_problem",
  proofKey:       "proof_cases",
  ctaKey:         "cta_guide",
  featureKey:     "feature_grid_primary",
  conversionKey:  "conversion_signup",
  pageBannerKey:  "hero_page_banner_consideration",
  reason:         "demo-segment:paid-acquisition",
};

const SEGMENT_SMB_STARTUP: ExperiencePlan = {
  heroKey:        "hero_direct_brand",
  proofKey:       "proof_platform",
  ctaKey:         "cta_guide",
  featureKey:     "feature_grid_primary",
  conversionKey:  "conversion_signup",
  pageBannerKey:  "hero_page_banner_awareness",
  reason:         "demo-segment:smb-startup",
};

/**
 * Segment key → ExperiencePlan lookup.
 * Priority order matters: the first segment key that matches wins.
 */
export const SEGMENT_DEMO_PLANS: Record<string, ExperiencePlan> = {
  "target-account":      SEGMENT_TARGET_ACCOUNT,
  "crm-known":           SEGMENT_CRM_KNOWN,
  "ready-to-convert":    SEGMENT_READY_TO_CONVERT,
  "high-intent":         SEGMENT_HIGH_INTENT,
  "enterprise-prospect": SEGMENT_ENTERPRISE_PROSPECT,
  "pricing-researcher":  SEGMENT_PRICING_RESEARCHER,
  "returning-engager":   SEGMENT_RETURNING_ENGAGER,
  "linkedin-traffic":    SEGMENT_LINKEDIN_TRAFFIC,
  "paid-acquisition":    SEGMENT_PAID_ACQUISITION,
  "smb-startup":         SEGMENT_SMB_STARTUP,
};

/**
 * Returns the highest-priority ExperiencePlan for a comma-joined
 * `audienceSegmentIds` string (e.g. "high-intent,enterprise-prospect").
 *
 * Evaluates in SEGMENT_DEMO_PLANS key order (insertion order = priority)
 * so the most specific/highest-value segment wins when multiple are active.
 *
 * Returns null when:
 *   - `ids` is null / undefined / empty
 *   - None of the segment keys in `ids` have a matching plan
 */
export function getSegmentDemoPlan(ids: string | null | undefined): ExperiencePlan | null {
  if (!ids) return null;
  const active = new Set(ids.split(",").map((s) => s.trim()).filter(Boolean));
  for (const key of Object.keys(SEGMENT_DEMO_PLANS)) {
    if (active.has(key)) return SEGMENT_DEMO_PLANS[key] ?? null;
  }
  return null;
}
