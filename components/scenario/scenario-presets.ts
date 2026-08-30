/**
 * Scenario Presets
 *
 * Pre-built behavioral snapshots for quick testing and demoing.
 * Each preset maps a human-readable label to a complete set of ScenarioOverrides,
 * covering ALL context groups: session, request/UTM, enrichment, interest,
 * behavioral, and lifecycle.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { SCENARIO_PRESETS } from "@/components/scenario/scenario-presets";
 *   activateScenario(SCENARIO_PRESETS.high_intent.overrides, "high_intent", "High Intent");
 *
 * ─── Design intent ────────────────────────────────────────────────────────────
 *
 *   Presets represent distinct, realistic visitor archetypes:
 *
 *   new_visitor          — First touch, zero behavioral data.
 *   consideration        — Explored content, not yet committed.
 *   trial_ready          — Visited pricing with intent ≥50. Sees free-trial CTA.
 *   high_intent          — Strong buying signals, ready to convert.
 *   returning_visitor    — Established affinity, multi-session.
 *   google_campaign      — Arrived via paid Google search (utm override).
 *   enterprise_prospect  — Company-enriched, high interest confidence.
 *   form_dropoff         — Started form but abandoned it.
 *   customer_onboarding  — Converted, in onboarding flow.
 *   customer_expansion   — Active customer, expansion opportunity.
 *   post_conversion      — Form submitted, conversion confirmed.
 *   high_friction        — Repetitive behavior, noise/confusion signals.
 *   churn_risk           — Customer showing disengagement patterns.
 */

import type { ScenarioOverrides } from "./scenario-store";

// ── Preset definition ─────────────────────────────────────────────────────────

export interface ScenarioPreset {
  key:         string;
  label:       string;
  description: string;
  /** Emoji for quick visual scanning in the UI. */
  icon:        string;
  /** Color family for the preset badge. */
  color:       "neutral" | "blue" | "green" | "orange" | "red" | "purple" | "amber";
  overrides:   ScenarioOverrides;
  /** True for a per-tenant custom preset (persona), so the panel can mark it (★). */
  custom?:     boolean;
}

/** The badge colour families a preset may use. */
export type ScenarioPresetColor = ScenarioPreset["color"];

// ── Presets ───────────────────────────────────────────────────────────────────

export const SCENARIO_PRESETS: Record<string, ScenarioPreset> = {

  new_visitor: {
    key:         "new_visitor",
    label:       "New Visitor",
    description: "First-time visitor with zero behavioral history. Sees default experience.",
    icon:        "👋",
    color:       "neutral",
    overrides: {
      // Context
      visitType:            "new",
      source:               "direct",
      pageViewCount:        1,
      // Behavior
      funnelStage:          "awareness",
      intentScore:          0,
      engagementScore:      0,
      confidenceBand:       "low",
      overallConfidence:    0.10,
      frictionScore:        0,
      hasVisitedPricing:    false,
      hasVisitedAbout:      false,
      hasVisitedCases:      false,
      hasVisitedContact:    false,
      hasClickedCta:        false,
      hasStartedForm:       false,
      hasSubmittedForm:     false,
      matchedSequences:     [],
      shortTermIntentScore: 0,
      longTermAffinityScore:0,
    },
  },

  consideration: {
    key:         "consideration",
    label:       "Considering",
    description: "Has explored the site, visited About + Cases. Shows interest but no strong intent.",
    icon:        "🔍",
    color:       "blue",
    overrides: {
      // Context
      visitType:            "returning",
      source:               "direct",
      pageViewCount:        3,
      // Behavior
      funnelStage:          "consideration",
      intentScore:          22,
      engagementScore:      35,
      confidenceBand:       "medium",
      overallConfidence:    0.42,
      frictionScore:        0,
      hasVisitedAbout:      true,
      hasVisitedCases:      true,
      hasVisitedPricing:    false,
      hasVisitedContact:    false,
      hasClickedCta:        false,
      hasStartedForm:       false,
      hasSubmittedForm:     false,
      matchedSequences:     [],
      shortTermIntentScore: 18,
      longTermAffinityScore:5,
    },
  },

  trial_ready: {
    key:         "trial_ready",
    label:       "Trial Ready",
    description: "Visited pricing with intent score ≥50. Not a customer. Triggers free-trial CTA with emphasized pricing.",
    icon:        "🚀",
    color:       "blue",
    overrides: {
      // Context
      visitType:             "returning",
      source:                "direct",
      pageViewCount:         4,
      // Behavior
      funnelStage:           "intent",
      intentScore:           55,
      engagementScore:       50,
      confidenceBand:        "high",
      overallConfidence:     0.65,
      frictionScore:         0,
      hasVisitedPricing:     true,
      hasVisitedAbout:       true,
      hasVisitedCases:       false,
      hasVisitedContact:     false,
      hasClickedCta:         false,
      hasStartedForm:        false,
      hasSubmittedForm:      false,
      isCustomer:            false,
      matchedSequences:      [],
      shortTermIntentScore:  40,
      longTermAffinityScore: 15,
    },
  },

  high_intent: {
    key:         "high_intent",
    label:       "High Intent",
    description: "Visited pricing, clicked CTA, started form. Strongest buying signals active.",
    icon:        "🔥",
    color:       "orange",
    overrides: {
      // Context
      visitType:            "returning",
      source:               "direct",
      pageViewCount:        6,
      // Behavior
      funnelStage:          "high_intent",
      intentScore:          78,
      engagementScore:      65,
      confidenceBand:       "high",
      overallConfidence:    0.72,
      frictionScore:        0,
      hasVisitedPricing:    true,
      hasVisitedAbout:      true,
      hasVisitedCases:      true,
      hasVisitedContact:    true,
      hasClickedCta:        true,
      hasStartedForm:       false,
      hasSubmittedForm:     false,
      matchedSequences:     ["services_to_contact", "case_to_pricing"],
      sequenceScore:        65,
      shortTermIntentScore: 60,
      longTermAffinityScore:20,
    },
  },

  returning_visitor: {
    key:         "returning_visitor",
    label:       "Returning Visitor",
    description: "Multi-session visitor with established interest. Long-term affinity is high.",
    icon:        "🔄",
    color:       "purple",
    overrides: {
      // Context
      visitType:             "returning",
      source:                "direct",
      pageViewCount:         4,
      // Interest (populated for returning visitors who've browsed content)
      interestPrimary:       "logistics",
      interestConfidence:    0.55,
      // Behavior
      funnelStage:           "consideration",
      intentScore:           45,
      engagementScore:       55,
      confidenceBand:        "medium",
      overallConfidence:     0.58,
      frictionScore:         0,
      hasVisitedPricing:     true,
      hasVisitedAbout:       true,
      hasVisitedCases:       true,
      hasVisitedContact:     false,
      hasClickedCta:         false,
      hasStartedForm:        false,
      hasSubmittedForm:      false,
      matchedSequences:      ["services_to_case"],
      shortTermIntentScore:  25,
      longTermAffinityScore: 40,
      // Scenario theme — applied directly in layout.tsx without requiring
      // a matching theme rule in the tenant DB.
      themeKey:              "valentine-pink",
    },
  },

  google_campaign: {
    key:         "google_campaign",
    label:       "Google Campaign",
    description: "Arrived via paid Google brand-search campaign. Source + UTM overrides active.",
    icon:        "🔎",
    color:       "blue",
    overrides: {
      // Context
      visitType:            "new",
      source:               "google",
      pageViewCount:        1,
      // UTM
      utmSource:            "google",
      utmMedium:            "cpc",
      utmCampaign:          "brand-search",
      // Behavior (fresh arrival, moderate intent from ad click)
      funnelStage:          "awareness",
      intentScore:          15,
      engagementScore:      10,
      confidenceBand:       "low",
      overallConfidence:    0.20,
      frictionScore:        0,
      hasVisitedPricing:    false,
      hasVisitedAbout:      false,
      hasVisitedCases:      false,
      hasClickedCta:        false,
      hasStartedForm:       false,
      hasSubmittedForm:     false,
      matchedSequences:     [],
      shortTermIntentScore: 12,
      longTermAffinityScore:0,
    },
  },

  enterprise_prospect: {
    key:         "enterprise_prospect",
    label:       "Enterprise Prospect",
    description: "Company-enriched visitor with high interest confidence. Ideal B2B prospect.",
    icon:        "🏢",
    color:       "purple",
    overrides: {
      // Context
      visitType:             "returning",
      source:                "linkedin",
      utmSource:             "linkedin",
      pageViewCount:         3,
      // Enrichment
      companyName:           "Acme BV",
      city:                  "Amsterdam",
      latitude:              52.37,
      longitude:             4.89,
      // Interest
      interestPrimary:       "enterprise_personalization",
      interestSecondary:     "b2b_saas",
      interestConfidence:    0.78,
      // Behavior
      funnelStage:           "consideration",
      intentScore:           35,
      engagementScore:       45,
      confidenceBand:        "medium",
      overallConfidence:     0.50,
      frictionScore:         0,
      hasVisitedAbout:       true,
      hasVisitedCases:       true,
      hasVisitedPricing:     false,
      hasVisitedContact:     false,
      hasClickedCta:         false,
      hasStartedForm:        false,
      hasSubmittedForm:      false,
      matchedSequences:      [],
      shortTermIntentScore:  28,
      longTermAffinityScore: 10,
    },
  },

  form_dropoff: {
    key:         "form_dropoff",
    label:       "Form Drop-off",
    description: "Started the contact/demo form but didn't submit. Objection or friction point. Triggers reassurance + soft demo CTA.",
    icon:        "📝",
    color:       "amber",
    overrides: {
      // Context
      visitType:            "returning",
      pageViewCount:        6,
      // Behavior
      funnelStage:          "high_intent",
      intentScore:          70,
      engagementScore:      60,
      confidenceBand:       "high",
      overallConfidence:    0.68,
      frictionScore:        15,
      hasVisitedPricing:    true,
      hasVisitedContact:    true,
      hasClickedCta:        true,
      hasStartedForm:       true,   // required to trigger rule_saas_form_dropoff
      hasSubmittedForm:     false,
      matchedSequences:     ["services_to_contact"],
      shortTermIntentScore: 55,
    },
  },

  customer_onboarding: {
    key:         "customer_onboarding",
    label:       "Customer: Onboarding",
    description: "Just converted. Now in the onboarding flow. Needs activation support.",
    icon:        "🎉",
    color:       "green",
    overrides: {
      // Context
      visitType:            "returning",
      pageViewCount:        8,
      // Lifecycle
      isCustomer:           true,
      planTier:             "starter",
      // Behavior
      funnelStage:          "customer",
      intentScore:          90,
      confidenceBand:       "very_high",
      overallConfidence:    1.0,
      hasSubmittedForm:     true,
      matchedSequences:     ["services_to_contact", "pricing_journey"],
    },
  },

  customer_expansion: {
    key:         "customer_expansion",
    label:       "Customer: Expansion",
    description: "Active Growth customer showing expansion signals. Revisiting pricing for upgrade.",
    icon:        "📈",
    color:       "green",
    overrides: {
      // Context
      visitType:            "returning",
      pageViewCount:        10,
      // Lifecycle
      isCustomer:           true,
      planTier:             "growth",
      // Behavior
      funnelStage:          "customer",
      intentScore:          95,
      confidenceBand:       "very_high",
      overallConfidence:    1.0,
      hasSubmittedForm:     true,
      hasVisitedPricing:    true,
      matchedSequences:     ["pricing_journey"],
    },
  },

  post_conversion: {
    key:         "post_conversion",
    label:       "Post-Conversion",
    description: "Form submitted: conversion confirmed. Maximum confidence. Onboarding mode.",
    icon:        "✅",
    color:       "green",
    overrides: {
      // Context
      visitType:            "returning",
      pageViewCount:        4,
      // Lifecycle
      isCustomer:           true,
      // Behavior
      funnelStage:          "customer",
      intentScore:          100,
      confidenceBand:       "very_high",
      overallConfidence:    1.0,
      hasSubmittedForm:     true,
      matchedSequences:     ["services_to_contact", "pricing_journey"],
    },
  },

  high_friction: {
    key:         "high_friction",
    label:       "High Friction",
    description: "Repetitive pricing visits with low signal diversity. Noise suppresses confidence.",
    icon:        "⚠️",
    color:       "red",
    overrides: {
      // Context
      visitType:            "returning",
      pageViewCount:        8,
      // Behavior
      funnelStage:          "consideration",
      intentScore:          40,
      engagementScore:      30,
      confidenceBand:       "low",
      overallConfidence:    0.22,
      frictionScore:        75,
      hasVisitedPricing:    true,
      hasVisitedAbout:      false,
      hasVisitedCases:      false,
      hasVisitedContact:    false,
      hasClickedCta:        false,
      hasStartedForm:       false,
      hasSubmittedForm:     false,
      matchedSequences:     [],
      shortTermIntentScore: 35,
      longTermAffinityScore:0,
    },
  },

  churn_risk: {
    key:         "churn_risk",
    label:       "Churn Risk",
    description: "Existing customer with declining engagement and re-engagement patterns.",
    icon:        "📉",
    color:       "red",
    overrides: {
      // Context
      visitType:            "returning",
      pageViewCount:        3,
      // Lifecycle
      isCustomer:           true,
      planTier:             "starter",
      // Behavior
      funnelStage:          "consideration",
      intentScore:          15,
      engagementScore:      10,
      confidenceBand:       "low",
      overallConfidence:    0.18,
      frictionScore:        30,
      hasVisitedPricing:    true,
      hasVisitedAbout:      false,
      hasVisitedCases:      false,
      hasVisitedContact:    false,
      hasClickedCta:        false,
      hasStartedForm:       false,
      hasSubmittedForm:     false,
      matchedSequences:     [],
      shortTermIntentScore: 5,
      longTermAffinityScore:60,
    },
  },

  // ── Careers / Werken-bij presets ──────────────────────────────────────────
  //
  // These presets mirror the 6 behavioral rules in the careers_platform blueprint.
  // They use the same journey field remapping:
  //   hasVisitedCases  → visited job listing (/vacatures)
  //   hasVisitedAbout  → viewed a job detail page
  //   hasStartedForm   → started application form
  //   hasSubmittedForm → submitted application
  //   hasClickedCta    → clicked a primary apply/browse CTA
  //
  // Activate one to preview which rule fires and which variant trio is served.

  careers_new_visitor: {
    key:         "careers_new_visitor",
    label:       "Careers: Nieuw bezoek",
    description: "Eerste bezoek aan de werken-bij site. Geen gedragsdata. Toont merkintroductie + vacatures-CTA.",
    icon:        "👋",
    color:       "neutral",
    overrides: {
      // Context
      visitType:            "new",
      source:               "direct",
      pageViewCount:        1,
      // Behavior — lowest possible signals, triggers careers_platform_rule_1
      funnelStage:          "awareness",
      intentScore:          0,
      engagementScore:      0,
      confidenceBand:       "low",
      overallConfidence:    0.10,
      frictionScore:        0,
      hasVisitedPricing:    false,
      hasVisitedAbout:      false,
      hasVisitedCases:      false,
      hasVisitedContact:    false,
      hasClickedCta:        false,
      hasStartedForm:       false,
      hasSubmittedForm:     false,
      matchedSequences:     [],
      shortTermIntentScore: 0,
      longTermAffinityScore:0,
    },
  },

  careers_explorer: {
    key:         "careers_explorer",
    label:       "Careers: Vacature-verkenner",
    description: "Heeft de vacaturelijst bekeken maar nog geen specifieke rol geopend. Triggers job-match hero + browse CTA.",
    icon:        "🔍",
    color:       "blue",
    overrides: {
      // Context
      visitType:            "returning",
      source:               "direct",
      pageViewCount:        2,
      // Behavior — visited listing (/vacatures) triggers careers_platform_rule_2
      funnelStage:          "consideration",
      intentScore:          15,
      engagementScore:      20,
      confidenceBand:       "low",
      overallConfidence:    0.25,
      frictionScore:        0,
      hasVisitedPricing:    false,
      hasVisitedAbout:      false,
      hasVisitedCases:      true,    // ← visited job listing page
      hasVisitedContact:    false,
      hasClickedCta:        false,
      hasStartedForm:       false,
      hasSubmittedForm:     false,
      matchedSequences:     [],
      shortTermIntentScore: 12,
      longTermAffinityScore:0,
    },
  },

  careers_job_interest: {
    key:         "careers_job_interest",
    label:       "Careers: Functie-interesse",
    description: "Heeft een specifieke vacature bekeken maar nog niet geklikt. Triggers rol-gerichte hero + apply CTA.",
    icon:        "💼",
    color:       "blue",
    overrides: {
      // Context
      visitType:            "returning",
      source:               "direct",
      pageViewCount:        3,
      // Behavior — viewed job detail triggers careers_platform_rule_3
      funnelStage:          "consideration",
      intentScore:          30,
      engagementScore:      35,
      confidenceBand:       "medium",
      overallConfidence:    0.40,
      frictionScore:        0,
      hasVisitedPricing:    false,
      hasVisitedAbout:      true,    // ← viewed job detail page
      hasVisitedCases:      true,
      hasVisitedContact:    false,
      hasClickedCta:        false,   // ← not yet clicked CTA (rule_4 requires both)
      hasStartedForm:       false,
      hasSubmittedForm:     false,
      matchedSequences:     [],
      shortTermIntentScore: 25,
      longTermAffinityScore:5,
    },
  },

  careers_high_intent: {
    key:         "careers_high_intent",
    label:       "Careers: Hoge sollicitatie-intentie",
    description: "Vacature bekeken én op apply CTA geklikt. Sterkste intentiesignalen. Triggers directe sollicitatie-ervaring.",
    icon:        "🔥",
    color:       "orange",
    overrides: {
      // Context
      visitType:            "returning",
      source:               "direct",
      pageViewCount:        4,
      // Behavior — viewed detail + clicked CTA triggers careers_platform_rule_4
      funnelStage:          "intent",
      intentScore:          65,
      engagementScore:      55,
      confidenceBand:       "high",
      overallConfidence:    0.70,
      frictionScore:        0,
      hasVisitedPricing:    false,
      hasVisitedAbout:      true,    // ← viewed job detail
      hasVisitedCases:      true,
      hasVisitedContact:    false,
      hasClickedCta:        true,    // ← clicked apply/browse CTA
      hasStartedForm:       false,
      hasSubmittedForm:     false,
      matchedSequences:     [],
      shortTermIntentScore: 50,
      longTermAffinityScore:10,
    },
  },

  careers_drop_off: {
    key:         "careers_drop_off",
    label:       "Careers: Formulier drop-off",
    description: "Begonnen met het sollicitatieformulier maar gestopt. Triggers geruststelling + open sollicitatie CTA.",
    icon:        "📝",
    color:       "amber",
    overrides: {
      // Context
      visitType:            "returning",
      source:               "direct",
      pageViewCount:        6,
      // Behavior — started form but NOT submitted triggers careers_platform_rule_5
      funnelStage:          "high_intent",
      intentScore:          55,
      engagementScore:      50,
      confidenceBand:       "high",
      overallConfidence:    0.62,
      frictionScore:        40,      // ← elevated friction signal
      hasVisitedPricing:    false,
      hasVisitedAbout:      true,
      hasVisitedCases:      true,
      hasVisitedContact:    true,
      hasClickedCta:        true,
      hasStartedForm:       true,    // ← started application
      hasSubmittedForm:     false,   // ← did NOT submit (drop-off condition)
      matchedSequences:     [],
      shortTermIntentScore: 45,
      longTermAffinityScore:8,
    },
  },

  careers_submitted: {
    key:         "careers_submitted",
    label:       "Careers: Sollicitatie ingediend",
    description: "Sollicitatie succesvol ingediend. Geen conversiedruk meer, focus op wat er daarna gebeurt.",
    icon:        "✅",
    color:       "green",
    overrides: {
      // Context
      visitType:            "returning",
      source:               "direct",
      pageViewCount:        6,
      // Behavior — hasSubmittedForm: true triggers careers_platform_rule_6 (priority 5)
      funnelStage:          "customer",
      intentScore:          100,
      engagementScore:      80,
      confidenceBand:       "very_high",
      overallConfidence:    1.0,
      frictionScore:        0,
      hasVisitedPricing:    false,
      hasVisitedAbout:      true,
      hasVisitedCases:      true,
      hasVisitedContact:    true,
      hasClickedCta:        true,
      hasStartedForm:       true,
      hasSubmittedForm:     true,    // ← application submitted
      matchedSequences:     [],
      shortTermIntentScore: 100,
      longTermAffinityScore:20,
    },
  },

  // ── Demo-rollen (misterchameleon.nl / platform-demo) ────────────────────────
  // Elke rol zet alleen `audienceSegmentIds`, waarop de gelijknamige regel
  // (demo.role_*) matcht en een andere hero + cta geeft — de rest van de pagina
  // blijft staan. Draait op het echte regel-pad (geen bypass). Geef de schakelaar
  // uit handen en laat de prospect zelf van rol wisselen.
  demo_role_marketeer: {
    key:         "demo_role_marketeer",
    label:       "Rol: Marketeer (eindklant)",
    description: "Marketeer bij een eindklant. Hero + cta gericht op de marketeer.",
    icon:        "📣",
    color:       "purple",
    overrides: {
      audienceSegmentIds: "demo-role-marketeer",
      interestPrimary:    "conversion",
      // Confidence/intent hoog genoeg zetten zodat de slot-gating de wissel niet
      // terugdraait naar default (anders lijkt de demo "kaal" / onveranderd).
      funnelStage:        "consideration",
      intentScore:        55,
      engagementScore:    45,
      confidenceBand:     "high",
      overallConfidence:  0.8,
      interestConfidence: 0.8,
    },
  },

  demo_role_bureau: {
    key:         "demo_role_bureau",
    label:       "Rol: Bureau-eigenaar",
    description: "Eigenaar van een bureau. Hero + cta gericht op de bureau-eigenaar.",
    icon:        "🏢",
    color:       "blue",
    overrides: {
      audienceSegmentIds: "demo-role-bureau",
      interestPrimary:    "partnership",
      funnelStage:        "consideration",
      intentScore:        55,
      engagementScore:    45,
      confidenceBand:     "high",
      overallConfidence:  0.8,
      interestConfidence: 0.8,
    },
  },

  demo_role_technisch: {
    key:         "demo_role_technisch",
    label:       "Rol: Technisch verantwoordelijke",
    description: "Technisch verantwoordelijke. Hero + cta gericht op de techneut.",
    icon:        "🛠️",
    color:       "green",
    overrides: {
      audienceSegmentIds: "demo-role-technisch",
      interestPrimary:    "integration",
      funnelStage:        "consideration",
      intentScore:        55,
      engagementScore:    45,
      confidenceBand:     "high",
      overallConfidence:  0.8,
      interestConfidence: 0.8,
    },
  },
};

// ── Ordered list for UI display ───────────────────────────────────────────────

export const SCENARIO_PRESET_LIST: ScenarioPreset[] = [
  // ── Generic / B2B SaaS ────────────────────────────────────────────────────
  SCENARIO_PRESETS.new_visitor,
  SCENARIO_PRESETS.consideration,
  SCENARIO_PRESETS.trial_ready,
  SCENARIO_PRESETS.high_intent,
  SCENARIO_PRESETS.returning_visitor,
  SCENARIO_PRESETS.google_campaign,
  SCENARIO_PRESETS.enterprise_prospect,
  SCENARIO_PRESETS.form_dropoff,
  SCENARIO_PRESETS.customer_onboarding,
  SCENARIO_PRESETS.customer_expansion,
  SCENARIO_PRESETS.post_conversion,
  SCENARIO_PRESETS.high_friction,
  SCENARIO_PRESETS.churn_risk,

  // ── Careers / Werken-bij ──────────────────────────────────────────────────
  SCENARIO_PRESETS.careers_new_visitor,
  SCENARIO_PRESETS.careers_explorer,
  SCENARIO_PRESETS.careers_job_interest,
  SCENARIO_PRESETS.careers_high_intent,
  SCENARIO_PRESETS.careers_drop_off,
  SCENARIO_PRESETS.careers_submitted,
];
