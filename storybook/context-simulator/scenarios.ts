/**
 * Predefined Context Simulator Scenarios
 *
 * Each scenario represents a distinct behavioral/visitor archetype.
 * Used by the Storybook Context Simulator toolbar to let marketers
 * preview components under realistic conditions.
 *
 * ─── Scenario keys (stable identifiers) ──────────────────────────────────────
 *
 *   cold_visitor            — First visit, no behavioral data, no enrichment
 *   google_high_intent      — Came from Google, visited pricing, high intent
 *   enterprise_returning    — Returning B2B visitor, company matched, high engagement
 *   sustainability_interest — Visitor interested in sustainability topics
 *   form_submitted          — Visitor has submitted a form (converted)
 */

import type { SimulatorScenario } from "./types";

export const PREDEFINED_SCENARIOS: readonly SimulatorScenario[] = [
  // ── Cold visitor ────────────────────────────────────────────────────────────

  {
    key:             "cold_visitor",
    label:           "Cold Visitor",
    description:     "First-time visitor, no behavioral signals, came from direct or unknown source.",
    visitorType:     "new",
    source:          "direct",
    funnelStage:     "awareness",
    intentScore:     0,
    engagementScore: 5,
    confidenceBand:  "low",
    company:         null,
    interest:        null,
    decision: {
      heroKey:     "hero_google_problem",
      proofKey:    "proof_vision",
      ctaKey:      "cta_guide",
      ruleLabel:   "Default — awareness",
      ruleReason:  "No behavioral signals. Show default awareness experience.",
    },
  },

  // ── Google high-intent ──────────────────────────────────────────────────────

  {
    key:             "google_high_intent",
    label:           "Google / High Intent",
    description:     "Came from a Google search, visited the pricing page — high purchase intent.",
    visitorType:     "returning",
    source:          "google",
    utmSource:       "google",
    utmMedium:       "cpc",
    funnelStage:     "intent",
    intentScore:     72,
    engagementScore: 45,
    confidenceBand:  "high",
    hasVisitedPricing: true,
    company:         null,
    interest:        null,
    decision: {
      heroKey:     "hero_direct_brand",
      proofKey:    "proof_cases",
      ctaKey:      "cta_meeting",
      ruleLabel:   "Pricing Visitor → Demo CTA",
      ruleReason:  "Visitor has viewed the pricing page — high purchase intent.",
    },
  },

  // ── Enterprise returning visitor ────────────────────────────────────────────

  {
    key:             "enterprise_returning",
    label:           "Enterprise Returning",
    description:     "Returning B2B visitor, company matched via IP enrichment, high engagement.",
    visitorType:     "high_intent",
    source:          "linkedin",
    utmSource:       "linkedin",
    utmMedium:       "social",
    funnelStage:     "high_intent",
    intentScore:     85,
    engagementScore: 70,
    confidenceBand:  "very_high",
    hasVisitedPricing: true,
    hasClickedCta:   true,
    company: {
      name:            "Philips",
      industry:        "healthcare_tech",
      employeeCount:   80000,
    },
    interest:         "enterprise_software",
    decision: {
      heroKey:     "hero_linkedin_vision",
      proofKey:    "proof_platform",
      ctaKey:      "cta_platform",
      ruleLabel:   "Returning + Previously Clicked CTA",
      ruleReason:  "Enterprise visitor who already engaged. Push toward demo/platform.",
    },
  },

  // ── Sustainability interest ─────────────────────────────────────────────────

  {
    key:             "sustainability_interest",
    label:           "Sustainability Interest",
    description:     "Visitor browsed sustainability content — interest-matched experience.",
    visitorType:     "returning",
    source:          "organic",
    funnelStage:     "consideration",
    intentScore:     40,
    engagementScore: 35,
    confidenceBand:  "medium",
    company:         null,
    interest:        "sustainability",
    decision: {
      heroKey:     "hero_google_problem",
      proofKey:    "proof_vision",
      ctaKey:      "cta_guide",
      ruleLabel:   "Interest: Sustainability",
      ruleReason:  "Visitor has shown sustainability interest. Show value-aligned content.",
    },
  },

  // ── Form submitted (converted) ──────────────────────────────────────────────

  {
    key:             "form_submitted",
    label:           "Converted — Form Submitted",
    description:     "Visitor has submitted a contact or demo request form.",
    visitorType:     "high_intent",
    source:          "direct",
    funnelStage:     "customer",
    intentScore:     95,
    engagementScore: 90,
    confidenceBand:  "very_high",
    hasVisitedPricing: true,
    hasVisitedContact: true,
    hasClickedCta:     true,
    hasSubmittedForm:  true,
    company:         null,
    interest:        null,
    decision: {
      heroKey:     "hero_direct_brand",
      proofKey:    "proof_cases",
      ctaKey:      "cta_meeting",
      ruleLabel:   "Converted visitor",
      ruleReason:  "Visitor has submitted a form. Show confirmation-style experience.",
    },
  },
] as const;

/** Quick lookup by scenario key. */
export function findScenario(key: string): SimulatorScenario | undefined {
  return PREDEFINED_SCENARIOS.find((s) => s.key === key);
}
