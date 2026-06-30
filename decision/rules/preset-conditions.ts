/**
 * Preset Conditions
 *
 * Pre-built condition sets for the Rules Editor "Use preset" selector.
 * Each entry maps one scenario preset to a curated set of FieldConditions
 * that capture the most discriminating signals for that visitor archetype.
 *
 * ─── Design intent ────────────────────────────────────────────────────────────
 *
 *   • Conditions are MINIMAL — just enough to identify the archetype without
 *     being so specific that only an exact replica of the scenario fires the rule.
 *   • All field keys come from FIELD_REGISTRY.  Only "field" condition type is
 *     used here (no "named" or "context") — simpler, no external dependencies.
 *   • Values match the allowedValues / kind defined in FIELD_REGISTRY exactly:
 *       categorical → string  (e.g. "new", "google", "customer")
 *       boolean     → boolean (true / false)
 *       number      → number  (e.g. 50, 65)
 *
 * ─── Usage (RulesEditor.tsx) ──────────────────────────────────────────────────
 *
 *   When the user picks a preset from the "Use preset" select, the editor
 *   replaces the current condition group with the preset leaves and logic.
 *   The user can then freely edit the conditions that were auto-filled.
 */

import type { FieldCondition } from "./stored-rule";
import type { RuleFieldKey }   from "./field-registry";

// ── Type ───────────────────────────────────────────────────────────────────────

/** A shorthand builder so entries below stay readable. */
function eq(field: RuleFieldKey, value: FieldCondition["value"]): FieldCondition {
  return { type: "field", field, operator: "equals", value };
}
function neq(field: RuleFieldKey, value: FieldCondition["value"]): FieldCondition {
  return { type: "field", field, operator: "not_equals", value };
}
function gte(field: RuleFieldKey, value: number): FieldCondition {
  return { type: "field", field, operator: "greater_than_or_equal", value };
}
function lte(field: RuleFieldKey, value: number): FieldCondition {
  return { type: "field", field, operator: "less_than_or_equal", value };
}
function gt(field: RuleFieldKey, value: number): FieldCondition {
  return { type: "field", field, operator: "greater_than", value };
}
function exists(field: RuleFieldKey): FieldCondition {
  return { type: "field", field, operator: "exists", value: undefined };
}

export interface PresetConditionDef {
  /** Preset key — matches SCENARIO_PRESETS key. */
  key:         string;
  /** Human-readable label shown in the select. */
  label:       string;
  /** Emoji icon for visual scanning. */
  icon:        string;
  /** Group for <optgroup> organisation. */
  group:       "generic" | "careers" | "interest";
  /** AND/OR logic for the condition group. */
  logic:       "and" | "or";
  /** The pre-filled field conditions. */
  leaves:      FieldCondition[];
}

// ── Preset condition catalogue ─────────────────────────────────────────────────

export const PRESET_CONDITIONS: PresetConditionDef[] = [
  // ── Generic / B2B SaaS ────────────────────────────────────────────────────

  {
    key:   "new_visitor",
    label: "New Visitor",
    icon:  "👋",
    group: "generic",
    logic: "and",
    leaves: [
      eq("visitType", "new"),
    ],
  },

  {
    key:   "consideration",
    label: "Considering",
    icon:  "🔍",
    group: "generic",
    logic: "and",
    leaves: [
      eq("visitType", "returning"),
      eq("journey.funnelStage", "consideration"),
    ],
  },

  {
    key:   "trial_ready",
    label: "Trial Ready",
    icon:  "🚀",
    group: "generic",
    logic: "and",
    leaves: [
      eq("journey.hasVisitedPricing", true),
      gte("journey.intentScore", 50),
      neq("crm.isCustomer", true),
    ],
  },

  {
    key:   "high_intent",
    label: "High Intent",
    icon:  "🔥",
    group: "generic",
    logic: "and",
    leaves: [
      eq("journey.funnelStage", "high_intent"),
      gte("journey.intentScore", 65),
    ],
  },

  {
    key:   "returning_visitor",
    label: "Returning Visitor",
    icon:  "🔄",
    group: "generic",
    logic: "and",
    leaves: [
      eq("visitType", "returning"),
    ],
  },

  {
    key:   "google_campaign",
    label: "Google Campaign",
    icon:  "🔎",
    group: "generic",
    logic: "and",
    leaves: [
      eq("source", "google"),
      eq("utmSource", "google"),
    ],
  },

  {
    key:   "linkedin_traffic",
    label: "LinkedIn Traffic",
    icon:  "💼",
    group: "generic",
    logic: "and",
    leaves: [
      eq("source", "linkedin"),
    ],
  },

  {
    key:   "enterprise_prospect",
    label: "Enterprise Prospect",
    icon:  "🏢",
    group: "generic",
    logic: "and",
    leaves: [
      eq("source", "linkedin"),
      eq("journey.funnelStage", "consideration"),
    ],
  },

  {
    key:   "form_dropoff",
    label: "Form Drop-off",
    icon:  "📝",
    group: "generic",
    logic: "and",
    leaves: [
      eq("journey.hasStartedForm", true),
      eq("journey.hasSubmittedForm", false),
    ],
  },

  {
    key:   "customer_onboarding",
    label: "Customer — Onboarding",
    icon:  "🎉",
    group: "generic",
    logic: "and",
    leaves: [
      eq("crm.isCustomer", true),
      eq("journey.funnelStage", "customer"),
    ],
  },

  {
    key:   "customer_expansion",
    label: "Customer — Expansion",
    icon:  "📈",
    group: "generic",
    logic: "and",
    leaves: [
      eq("crm.isCustomer", true),
      eq("journey.hasVisitedPricing", true),
    ],
  },

  {
    key:   "post_conversion",
    label: "Post-Conversion",
    icon:  "✅",
    group: "generic",
    logic: "and",
    leaves: [
      eq("journey.hasSubmittedForm", true),
    ],
  },

  {
    key:   "high_friction",
    label: "High Friction",
    icon:  "⚠️",
    group: "generic",
    logic: "and",
    leaves: [
      gte("journey.frictionScore", 50),
    ],
  },

  {
    key:   "churn_risk",
    label: "Churn Risk",
    icon:  "📉",
    group: "generic",
    logic: "and",
    leaves: [
      eq("crm.isCustomer", true),
      lte("journey.intentScore", 20),
    ],
  },

  // ── Careers / Werken-bij ──────────────────────────────────────────────────

  {
    key:   "careers_new_visitor",
    label: "Careers — Nieuw bezoek",
    icon:  "👋",
    group: "careers",
    logic: "and",
    leaves: [
      eq("visitType", "new"),
      eq("journey.hasVisitedCases", false),
    ],
  },

  {
    key:   "careers_explorer",
    label: "Careers — Vacature-verkenner",
    icon:  "🔍",
    group: "careers",
    logic: "and",
    leaves: [
      eq("journey.hasVisitedCases", true),
      eq("journey.hasVisitedAbout", false),
    ],
  },

  {
    key:   "careers_job_interest",
    label: "Careers — Functie-interesse",
    icon:  "💼",
    group: "careers",
    logic: "and",
    leaves: [
      eq("journey.hasVisitedAbout", true),
      eq("hasClickedCta", false),
    ],
  },

  {
    key:   "careers_high_intent",
    label: "Careers — Hoge sollicitatie-intentie",
    icon:  "🔥",
    group: "careers",
    logic: "and",
    leaves: [
      eq("journey.hasVisitedAbout", true),
      eq("hasClickedCta", true),
    ],
  },

  {
    key:   "careers_drop_off",
    label: "Careers — Formulier drop-off",
    icon:  "📝",
    group: "careers",
    logic: "and",
    leaves: [
      eq("journey.hasStartedForm", true),
      eq("journey.hasSubmittedForm", false),
      gte("journey.frictionScore", 30),
    ],
  },

  {
    key:   "careers_submitted",
    label: "Careers — Sollicitatie ingediend",
    icon:  "✅",
    group: "careers",
    logic: "and",
    leaves: [
      eq("journey.hasSubmittedForm", true),
    ],
  },

  // ── Interest / Behavioural Personalisation ────────────────────────────────
  //
  //   These presets fire when the visitor's in-session behavioural signals
  //   indicate a clear topic affinity.  They combine an `interestPrimary`
  //   equality check with a confidence guard so only genuinely-scored visitors
  //   are matched — low-signal cold visits fall through to journey presets.
  //
  //   Confidence thresholds:
  //     0.15 — weak signal (1–2 matching page views)
  //     0.30 — moderate signal (good for most personalisation)
  //     0.50 — strong signal (use for high-commitment CTAs)
  //
  //   Per-profile score thresholds (0–1):
  //     0.20 — some engagement with that topic
  //     0.40 — meaningful engagement, safe to personalise
  //     0.60 — very high engagement, reserved for aggressive nudges

  {
    key:   "interest_pricing",
    label: "Interest — Pricing Research",
    icon:  "💰",
    group: "interest",
    logic: "and",
    leaves: [
      eq("interestPrimary", "pricing_focused"),
      gte("interestConfidence", 0.3),
    ],
  },

  {
    key:   "interest_pricing_strong",
    label: "Interest — Pricing (Strong Signal)",
    icon:  "💳",
    group: "interest",
    logic: "and",
    leaves: [
      gte("interestPricingScore", 0.5),
      neq("crm.isCustomer", true),
    ],
  },

  {
    key:   "interest_product",
    label: "Interest — Product Features",
    icon:  "⚙️",
    group: "interest",
    logic: "and",
    leaves: [
      eq("interestPrimary", "product_focused"),
      gte("interestConfidence", 0.3),
    ],
  },

  {
    key:   "interest_use_case",
    label: "Interest — Use Cases / Case Studies",
    icon:  "📋",
    group: "interest",
    logic: "and",
    leaves: [
      eq("interestPrimary", "use_case_focused"),
      gte("interestUseCaseScore", 0.3),
    ],
  },

  {
    key:   "interest_technical",
    label: "Interest — Technical / Developer",
    icon:  "🛠️",
    group: "interest",
    logic: "and",
    leaves: [
      eq("interestPrimary", "technical_focused"),
      gte("interestTechnicalScore", 0.3),
    ],
  },

  {
    key:   "interest_trust",
    label: "Interest — Trust / Security / Compliance",
    icon:  "🔒",
    group: "interest",
    logic: "and",
    leaves: [
      eq("interestPrimary", "trust_focused"),
      gte("interestTrustScore", 0.3),
    ],
  },

  {
    key:   "interest_roi",
    label: "Interest — ROI / Business Case",
    icon:  "📊",
    group: "interest",
    logic: "and",
    leaves: [
      eq("interestPrimary", "roi_focused"),
      gte("interestConfidence", 0.25),
    ],
  },

  {
    key:   "interest_comparison",
    label: "Interest — Comparing Competitors",
    icon:  "⚖️",
    group: "interest",
    logic: "and",
    leaves: [
      eq("interestPrimary", "comparison_focused"),
      gte("interestConfidence", 0.25),
    ],
  },

  {
    key:   "interest_high_confidence",
    label: "Interest — Any Strong Primary Interest",
    icon:  "🎯",
    group: "interest",
    logic: "and",
    leaves: [
      exists("interestPrimary"),
      gte("interestConfidence", 0.5),
    ],
  },

  {
    key:   "interest_pricing_technical",
    label: "Interest — Pricing + Technical (Evaluator)",
    icon:  "🔬",
    group: "interest",
    logic: "and",
    leaves: [
      gte("interestPricingScore", 0.3),
      gte("interestTechnicalScore", 0.3),
      neq("crm.isCustomer", true),
    ],
  },

  {
    key:   "interest_candidate",
    label: "Interest — Careers / Job Candidate",
    icon:  "🎓",
    group: "interest",
    logic: "and",
    leaves: [
      eq("interestPrimary", "candidate_explorer"),
      gte("interestCandidateScore", 0.3),
    ],
  },

  {
    key:   "interest_candidate_high_intent",
    label: "Interest — Candidate High Intent",
    icon:  "🏆",
    group: "interest",
    logic: "and",
    leaves: [
      gte("interestCandidateScore", 0.5),
      eq("journey.hasVisitedAbout", true),
    ],
  },

  {
    key:   "interest_commerce_product",
    label: "Interest — Product / Shop Intent",
    icon:  "🛍️",
    group: "interest",
    logic: "and",
    leaves: [
      gte("interestCommerceProductScore", 0.4),
    ],
  },

  {
    key:   "interest_property",
    label: "Interest — Property / Real Estate",
    icon:  "🏠",
    group: "interest",
    logic: "and",
    leaves: [
      gte("interestPropertyScore", 0.4),
    ],
  },
];
