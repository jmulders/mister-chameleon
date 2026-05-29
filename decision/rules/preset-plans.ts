/**
 * Preset Plans
 *
 * Canonical 5-slot experience plans for every scenario preset archetype.
 * Maps each preset key (from SCENARIO_PRESETS) to a complete StoredPlan that
 * specifies hero, proof, CTA, feature, and conversion block variants together
 * with pricing emphasis and CTA mode.
 *
 * ─── Design intent ────────────────────────────────────────────────────────────
 *
 *   Each plan is the "ideal default" for its archetype — the experience a first-
 *   time operator would want without any manual tuning.  Rules can override any
 *   subset of these fields; the preset plan fills in the rest.
 *
 *   Slot logic per archetype:
 *
 *   hero        — The dominant above-fold message and imagery.
 *   proof       — Social proof section tone (cases, stats, vision, reassurance …).
 *   cta         — Primary call-to-action block at the bottom of the page.
 *   featureKey  — Feature grid / highlights / comparison (optional extended slot).
 *   conversionKey — Deeper conversion section: form, booking, or contact embed.
 *   pricingEmphasis — How prominently pricing is displayed.
 *   pricingCtaMode  — Which CTA flavour appears in pricing-sensitive sections.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   • Rules editor — pre-fill the plan fields when a user creates a rule from
 *     a scenario preset ("Use preset" → auto-populate plan dropdowns).
 *   • Seed rules — generate a complete StoredRule for every preset with one call
 *     to generateSeedRulesFromPresets().
 *   • Debug panel — show the "expected" experience alongside the "actual" one.
 *
 * ─── Careers re-mapping note ──────────────────────────────────────────────────
 *
 *   Careers presets re-purpose generic journey flags for the hiring context:
 *     hasVisitedCases  → visited /vacatures (job listing)
 *     hasVisitedAbout  → viewed a job detail page
 *     hasClickedCta    → clicked primary apply/browse CTA
 *     hasStartedForm   → started application form
 *     hasSubmittedForm → submitted application
 */

import type { StoredPlan } from "./stored-rule";
import type { NotificationVariantKey } from "../types";

// ── Type ───────────────────────────────────────────────────────────────────────

/**
 * A complete 5-slot experience plan for a scenario preset.
 * Extends StoredPlan with the two optional extended slots so a single object
 * can express the full page experience for a given archetype.
 */
export type PresetPlan = Required<Pick<StoredPlan, "heroKey" | "proofKey" | "ctaKey">>
  & Pick<StoredPlan, "featureKey" | "conversionKey" | "pricingEmphasis" | "pricingCtaMode" | "notificationKey">;

// ── Preset plan catalogue ──────────────────────────────────────────────────────

/**
 * Complete experience plans for all 19 scenario preset archetypes.
 *
 * Keys match SCENARIO_PRESETS and PRESET_CONDITIONS exactly so callers can
 * look up any preset plan by key without format conversion.
 */
export const PRESET_PLANS: Record<string, PresetPlan> = {

  // ── Generic / B2B SaaS ──────────────────────────────────────────────────────

  /**
   * First-time visitor — no behavioural signal.
   * Brand intro hero, generic social proof, soft guide CTA.
   * Full feature grid to give maximum orientation. Demo form as conversion.
   */
  new_visitor: {
    heroKey:          "hero_direct_brand",
    proofKey:         "proof_default",
    ctaKey:           "cta_guide",
    featureKey:       "feature_grid_primary",
    conversionKey:    "conversion_demo",
    pricingEmphasis:  "teaser",
    pricingCtaMode:   "demo",
    notificationKey:  "notification_default" as NotificationVariantKey,
  },

  /**
   * Returning visitor in consideration stage.
   * Value-focused hero, case studies proof, demo CTA.
   * Feature highlights to reinforce differentiators.
   */
  consideration: {
    heroKey:          "hero_consideration",
    proofKey:         "proof_cases",
    ctaKey:           "cta_demo",
    featureKey:       "feature_highlights",
    conversionKey:    "conversion_demo",
    pricingEmphasis:  "standard",
    pricingCtaMode:   "demo",
    notificationKey:  "notification_returning" as NotificationVariantKey,
  },

  /**
   * Pricing visitor with intent ≥50, not yet a customer.
   * Direct intent hero, quantified stats proof, trial CTA.
   * Comparison table to push final decision; signup form to convert.
   */
  trial_ready: {
    heroKey:          "hero_intent_direct",
    proofKey:         "proof_stats",
    ctaKey:           "cta_guide",
    featureKey:       "feature_comparison",
    conversionKey:    "conversion_signup",
    pricingEmphasis:  "emphasized",
    pricingCtaMode:   "trial",
    notificationKey:  "notification_offer" as NotificationVariantKey,
  },

  /**
   * Strongest buying signals — visited pricing, clicked CTA, has intent ≥65.
   * Urgency hero, stats proof, meeting CTA.
   * Comparison table + demo booking form.
   */
  high_intent: {
    heroKey:          "hero_intent_direct",
    proofKey:         "proof_stats",
    ctaKey:           "cta_meeting",
    featureKey:       "feature_comparison",
    conversionKey:    "conversion_demo",
    pricingEmphasis:  "emphasized",
    pricingCtaMode:   "demo",
    notificationKey:  "notification_urgency" as NotificationVariantKey,
  },

  /**
   * Multi-session visitor with established affinity.
   * Consideration hero to re-engage, cases proof, platform CTA.
   * Feature highlights surface the value they keep returning for.
   */
  returning_visitor: {
    heroKey:          "hero_consideration",
    proofKey:         "proof_cases",
    ctaKey:           "cta_platform",
    featureKey:       "feature_highlights",
    conversionKey:    "conversion_demo",
    pricingEmphasis:  "standard",
    pricingCtaMode:   "demo",
    notificationKey:  "notification_returning" as NotificationVariantKey,
  },

  /**
   * Arrived via LinkedIn (organic feed, DM link, or paid campaign).
   * Vision hero for thought-leadership framing, analyst-quote proof, platform CTA.
   * Feature highlights surface enterprise differentiators; demo form to capture.
   */
  linkedin_traffic: {
    heroKey:          "hero_linkedin_vision",
    proofKey:         "proof_vision",
    ctaKey:           "cta_platform",
    featureKey:       "feature_highlights",
    conversionKey:    "conversion_demo",
    pricingEmphasis:  "standard",
    pricingCtaMode:   "demo",
    notificationKey:  "notification_default" as NotificationVariantKey,
  },

  /**
   * Arrived via paid Google brand-search campaign.
   * Problem-aware hero matches the ad intent, cases proof, guide CTA.
   * Full feature grid for orientation; demo form to capture.
   */
  google_campaign: {
    heroKey:          "hero_google_problem",
    proofKey:         "proof_cases",
    ctaKey:           "cta_guide",
    featureKey:       "feature_grid_primary",
    conversionKey:    "conversion_demo",
    pricingEmphasis:  "teaser",
    pricingCtaMode:   "demo",
    notificationKey:  "notification_default" as NotificationVariantKey,
  },

  /**
   * Company-enriched LinkedIn visitor with high interest confidence.
   * Vision-level hero for strategic positioning, vision proof, meeting CTA.
   * Feature highlights surface enterprise differentiators.
   */
  enterprise_prospect: {
    heroKey:          "hero_linkedin_vision",
    proofKey:         "proof_vision",
    ctaKey:           "cta_meeting",
    featureKey:       "feature_highlights",
    conversionKey:    "conversion_demo",
    pricingEmphasis:  "standard",
    pricingCtaMode:   "demo",
    notificationKey:  "notification_urgency" as NotificationVariantKey,
  },

  /**
   * Started the form but abandoned it — friction / objection point.
   * Direct hero to re-engage, reassurance proof, soft demo CTA.
   * Comparison removes doubt; demo booking lowers the commitment barrier.
   */
  form_dropoff: {
    heroKey:          "hero_intent_direct",
    proofKey:         "proof_reassurance",
    ctaKey:           "cta_demo",
    featureKey:       "feature_comparison",
    conversionKey:    "conversion_demo",
    pricingEmphasis:  "standard",
    pricingCtaMode:   "demo",
    notificationKey:  "notification_offer" as NotificationVariantKey,
  },

  /**
   * Just converted — now in onboarding flow.
   * Onboarding hero, platform proof, onboarding CTA.
   * Feature highlights show what they now have access to.
   * Pricing hidden; contact form for support queries.
   */
  customer_onboarding: {
    heroKey:          "hero_customer_onboarding",
    proofKey:         "proof_platform",
    ctaKey:           "cta_onboarding",
    featureKey:       "feature_highlights",
    conversionKey:    "conversion_contact",
    pricingEmphasis:  "hidden",
    pricingCtaMode:   "onboarding",
  },

  /**
   * Active customer revisiting pricing — expansion signal.
   * Onboarding hero reframes as upgrade journey, platform proof, expansion CTA.
   * Comparison table shows plan differences; demo for upgrade conversation.
   */
  customer_expansion: {
    heroKey:          "hero_customer_onboarding",
    proofKey:         "proof_platform",
    ctaKey:           "cta_expansion",
    featureKey:       "feature_comparison",
    conversionKey:    "conversion_demo",
    pricingEmphasis:  "emphasized",
    pricingCtaMode:   "expansion",
  },

  /**
   * Form submitted — conversion confirmed.
   * Onboarding hero celebrates the conversion, platform proof, onboarding CTA.
   * Full feature grid shows the platform they just joined. No acquisition pressure.
   */
  post_conversion: {
    heroKey:          "hero_customer_onboarding",
    proofKey:         "proof_platform",
    ctaKey:           "cta_onboarding",
    featureKey:       "feature_grid_primary",
    conversionKey:    "conversion_contact",
    pricingEmphasis:  "hidden",
    pricingCtaMode:   "none",
  },

  /**
   * Repetitive pricing visits, low signal diversity — noise / friction.
   * Softer consideration hero to reduce overwhelm, reassurance proof, guide CTA.
   * Highlights (not comparison) to simplify the decision.
   */
  high_friction: {
    heroKey:          "hero_consideration",
    proofKey:         "proof_reassurance",
    ctaKey:           "cta_guide",
    featureKey:       "feature_highlights",
    conversionKey:    "conversion_contact",
    pricingEmphasis:  "teaser",
    pricingCtaMode:   "demo",
    notificationKey:  "notification_offer" as NotificationVariantKey,
  },

  /**
   * Existing customer showing disengagement patterns — churn risk.
   * Re-engagement hero, reassurance proof, platform CTA to reconnect.
   * Highlights (not comparison — no upsell pressure).
   * Contact form for support; no pricing CTA (retention focus).
   */
  churn_risk: {
    heroKey:          "hero_consideration",
    proofKey:         "proof_reassurance",
    ctaKey:           "cta_platform",
    featureKey:       "feature_highlights",
    conversionKey:    "conversion_contact",
    pricingEmphasis:  "standard",
    pricingCtaMode:   "none",
  },

  // ── Careers / Werken-bij ────────────────────────────────────────────────────
  //
  // All careers presets use the careers-specific variant families.
  // Feature and conversion slots default to generic equivalents since the
  // careers blueprint does not yet define career-specific feature variants.

  /**
   * First visit to the werken-bij site — zero behavioural signal.
   * Brand introduction hero, default employer brand proof, browse CTA.
   * Full feature grid surfaces all job types; contact form for open questions.
   */
  careers_new_visitor: {
    heroKey:          "hero_careers_default",
    proofKey:         "proof_careers_default",
    ctaKey:           "cta_careers_browse",
    featureKey:       "feature_grid_primary",
    conversionKey:    "conversion_contact",
    pricingEmphasis:  "hidden",
    pricingCtaMode:   "none",
  },

  /**
   * Visited the job listing but not a specific role yet.
   * Job-match hero, employer brand proof, browse CTA.
   * Feature highlights surface role categories and perks.
   */
  careers_explorer: {
    heroKey:          "hero_careers_job_match",
    proofKey:         "proof_careers_default",
    ctaKey:           "cta_careers_browse",
    featureKey:       "feature_highlights",
    conversionKey:    "conversion_contact",
    pricingEmphasis:  "hidden",
    pricingCtaMode:   "none",
  },

  /**
   * Viewed a specific job detail page — role interest confirmed.
   * Job-match hero reinforces the role, team proof builds trust, apply CTA.
   * Feature highlights show benefits and growth; contact form for questions.
   */
  careers_job_interest: {
    heroKey:          "hero_careers_job_match",
    proofKey:         "proof_careers_team",
    ctaKey:           "cta_careers_apply",
    featureKey:       "feature_highlights",
    conversionKey:    "conversion_contact",
    pricingEmphasis:  "hidden",
    pricingCtaMode:   "none",
  },

  /**
   * Viewed job detail AND clicked an apply/browse CTA — high application intent.
   * High-intent careers hero, team proof, direct apply CTA.
   * Feature highlights maintain momentum; contact form as safety valve.
   */
  careers_high_intent: {
    heroKey:          "hero_careers_high_intent",
    proofKey:         "proof_careers_team",
    ctaKey:           "cta_careers_apply",
    featureKey:       "feature_highlights",
    conversionKey:    "conversion_contact",
    pricingEmphasis:  "hidden",
    pricingCtaMode:   "none",
  },

  /**
   * Started application form but abandoned it — friction / hesitation.
   * Reassurance hero removes doubt, reassurance proof shows safety, open
   * application CTA lowers the barrier. Contact form for direct questions.
   */
  careers_drop_off: {
    heroKey:          "hero_careers_reassurance",
    proofKey:         "proof_careers_reassurance",
    ctaKey:           "cta_careers_open",
    featureKey:       "feature_highlights",
    conversionKey:    "conversion_contact",
    pricingEmphasis:  "hidden",
    pricingCtaMode:   "none",
  },

  /**
   * Application successfully submitted — post-conversion state.
   * Reassurance hero confirms next steps, team proof sets expectations.
   * Contact CTA for follow-up questions; contact form for any open queries.
   * No further conversion pressure.
   */
  careers_submitted: {
    heroKey:          "hero_careers_reassurance",
    proofKey:         "proof_careers_team",
    ctaKey:           "cta_careers_contact",
    featureKey:       "feature_highlights",
    conversionKey:    "conversion_contact",
    pricingEmphasis:  "hidden",
    pricingCtaMode:   "none",
  },

  // ── Interest / Behavioural Personalisation ──────────────────────────────────
  //
  //   These plans are triggered when in-session behavioural scoring has built up
  //   a clear topic affinity.  They are CONTENT-TOPICAL: the variant choice is
  //   driven by what the visitor has read, not by where they came from or their
  //   funnel stage.  Combine freely with journey conditions for tighter targeting.

  /**
   * Visitor actively researching pricing (moderate signal, ≥ 0.30 confidence).
   * Intent hero signals we know what they're looking for; stats proof validates
   * the ROI claim; guide CTA is a soft next step; comparison table + signup form
   * close the loop.  Pricing made prominent.
   */
  interest_pricing: {
    heroKey:          "hero_intent_direct",
    proofKey:         "proof_stats",
    ctaKey:           "cta_guide",
    featureKey:       "feature_comparison",
    conversionKey:    "conversion_signup",
    pricingEmphasis:  "emphasized",
    pricingCtaMode:   "trial",
    notificationKey:  "notification_offer" as NotificationVariantKey,
  },

  /**
   * Strong pricing signal (score ≥ 0.50) — visitor is deep in price evaluation.
   * Same intent hero but escalate to meeting CTA to capture this high-value lead
   * before they make a decision elsewhere.  Not shown to existing customers.
   */
  interest_pricing_strong: {
    heroKey:          "hero_intent_direct",
    proofKey:         "proof_stats",
    ctaKey:           "cta_meeting",
    featureKey:       "feature_comparison",
    conversionKey:    "conversion_demo",
    pricingEmphasis:  "emphasized",
    pricingCtaMode:   "demo",
    notificationKey:  "notification_urgency" as NotificationVariantKey,
  },

  /**
   * Visitor exploring product features (product_focused profile).
   * Consideration hero frames the value; cases proof shows real usage;
   * demo CTA lets them see it in action.  Full feature grid for depth.
   */
  interest_product: {
    heroKey:          "hero_consideration",
    proofKey:         "proof_cases",
    ctaKey:           "cta_demo",
    featureKey:       "feature_grid_primary",
    conversionKey:    "conversion_demo",
    pricingEmphasis:  "teaser",
    pricingCtaMode:   "demo",
    notificationKey:  "notification_default" as NotificationVariantKey,
  },

  /**
   * Visitor consuming use-cases and case studies (use_case_focused profile).
   * Consideration hero + cases proof reinforce the story-led experience;
   * demo CTA gives the logical next step; highlights surface adjacent use-cases.
   */
  interest_use_case: {
    heroKey:          "hero_consideration",
    proofKey:         "proof_cases",
    ctaKey:           "cta_demo",
    featureKey:       "feature_highlights",
    conversionKey:    "conversion_demo",
    pricingEmphasis:  "standard",
    pricingCtaMode:   "demo",
    notificationKey:  "notification_default" as NotificationVariantKey,
  },

  /**
   * Developer or technical evaluator (technical_focused profile).
   * Brand hero establishes credibility; platform proof shows integrations;
   * guide CTA (docs/quickstart) matches the self-serve technical journey.
   * Feature grid surfaces technical capabilities.  Pricing as teaser only.
   */
  interest_technical: {
    heroKey:          "hero_direct_brand",
    proofKey:         "proof_platform",
    ctaKey:           "cta_guide",
    featureKey:       "feature_grid_primary",
    conversionKey:    "conversion_demo",
    pricingEmphasis:  "teaser",
    pricingCtaMode:   "demo",
    notificationKey:  "notification_default" as NotificationVariantKey,
  },

  /**
   * Security, compliance, or social-proof focused visitor (trust_focused).
   * Consideration hero; reassurance proof (certifications, logos, testimonials);
   * guide CTA is low-pressure.  Highlights surface trust signals.
   */
  interest_trust: {
    heroKey:          "hero_consideration",
    proofKey:         "proof_reassurance",
    ctaKey:           "cta_guide",
    featureKey:       "feature_highlights",
    conversionKey:    "conversion_contact",
    pricingEmphasis:  "standard",
    pricingCtaMode:   "demo",
    notificationKey:  "notification_offer" as NotificationVariantKey,
  },

  /**
   * ROI / business-case researcher (roi_focused profile).
   * Intent hero leads with outcomes; stats proof backs up the numbers;
   * demo CTA lets them validate the claim.  Comparison table for the business case.
   * Pricing prominent — ROI visitors need the numbers.
   */
  interest_roi: {
    heroKey:          "hero_intent_direct",
    proofKey:         "proof_stats",
    ctaKey:           "cta_demo",
    featureKey:       "feature_comparison",
    conversionKey:    "conversion_demo",
    pricingEmphasis:  "emphasized",
    pricingCtaMode:   "demo",
    notificationKey:  "notification_offer" as NotificationVariantKey,
  },

  /**
   * Competitor-comparing visitor (comparison_focused profile).
   * Intent hero; stats proof counters competitor claims with data;
   * meeting CTA captures the moment before they choose a competitor.
   * Comparison table is the centrepiece.
   */
  interest_comparison: {
    heroKey:          "hero_intent_direct",
    proofKey:         "proof_stats",
    ctaKey:           "cta_meeting",
    featureKey:       "feature_comparison",
    conversionKey:    "conversion_demo",
    pricingEmphasis:  "emphasized",
    pricingCtaMode:   "demo",
    notificationKey:  "notification_urgency" as NotificationVariantKey,
  },

  /**
   * Any strong primary interest (confidence ≥ 0.50) — catch-all for highly
   * engaged visitors regardless of topic.  Consideration hero + cases proof
   * cover the broadest set of affinities; demo CTA is universally relevant.
   * Feature highlights leave room for any topic focus.
   */
  interest_high_confidence: {
    heroKey:          "hero_consideration",
    proofKey:         "proof_cases",
    ctaKey:           "cta_demo",
    featureKey:       "feature_highlights",
    conversionKey:    "conversion_demo",
    pricingEmphasis:  "standard",
    pricingCtaMode:   "demo",
    notificationKey:  "notification_returning" as NotificationVariantKey,
  },

  /**
   * Technical evaluator also researching pricing — the "evaluator" profile.
   * Most likely a developer with budget authority or a pre-sales technician.
   * Platform proof; meeting CTA for the technical discovery call.
   * Comparison table + demo form close both angles.
   */
  interest_pricing_technical: {
    heroKey:          "hero_intent_direct",
    proofKey:         "proof_platform",
    ctaKey:           "cta_meeting",
    featureKey:       "feature_comparison",
    conversionKey:    "conversion_demo",
    pricingEmphasis:  "emphasized",
    pricingCtaMode:   "demo",
    notificationKey:  "notification_urgency" as NotificationVariantKey,
  },

  /**
   * Visitor browsing careers content (candidate_explorer profile).
   * Job-match hero; employer brand proof; browse CTA lets them explore.
   * Feature highlights surface role categories and perks.
   */
  interest_candidate: {
    heroKey:          "hero_careers_job_match",
    proofKey:         "proof_careers_default",
    ctaKey:           "cta_careers_browse",
    featureKey:       "feature_highlights",
    conversionKey:    "conversion_contact",
    pricingEmphasis:  "hidden",
    pricingCtaMode:   "none",
  },

  /**
   * High-intent candidate (score ≥ 0.50 + visited about/jobs page).
   * High-intent careers hero; team proof builds personal connection;
   * direct apply CTA captures the moment.  Feature highlights reinforce
   * culture and growth.
   */
  interest_candidate_high_intent: {
    heroKey:          "hero_careers_high_intent",
    proofKey:         "proof_careers_team",
    ctaKey:           "cta_careers_apply",
    featureKey:       "feature_highlights",
    conversionKey:    "conversion_contact",
    pricingEmphasis:  "hidden",
    pricingCtaMode:   "none",
  },

  /**
   * Product / e-commerce interest (commerce-product profile).
   * Consideration hero; cases proof with product social validation;
   * guide CTA for lower-friction next step.  Highlights surface key products.
   */
  interest_commerce_product: {
    heroKey:          "hero_consideration",
    proofKey:         "proof_cases",
    ctaKey:           "cta_guide",
    featureKey:       "feature_highlights",
    conversionKey:    "conversion_demo",
    pricingEmphasis:  "teaser",
    pricingCtaMode:   "demo",
    notificationKey:  "notification_default" as NotificationVariantKey,
  },

  /**
   * Property / real estate interest (property profile).
   * Consideration hero; cases proof (property examples); guide CTA.
   * Highlights surface property types and services.
   */
  interest_property: {
    heroKey:          "hero_consideration",
    proofKey:         "proof_cases",
    ctaKey:           "cta_guide",
    featureKey:       "feature_highlights",
    conversionKey:    "conversion_contact",
    pricingEmphasis:  "standard",
    pricingCtaMode:   "demo",
    notificationKey:  "notification_default" as NotificationVariantKey,
  },
};

// ── Ordered list for UI iteration ─────────────────────────────────────────────

/** All preset plan entries in display order, paired with their key. */
export interface PresetPlanEntry {
  key:  string;
  plan: PresetPlan;
}

export const PRESET_PLAN_LIST: PresetPlanEntry[] = [
  // Generic / B2B SaaS
  { key: "new_visitor",         plan: PRESET_PLANS.new_visitor         },
  { key: "consideration",       plan: PRESET_PLANS.consideration       },
  { key: "trial_ready",         plan: PRESET_PLANS.trial_ready         },
  { key: "high_intent",         plan: PRESET_PLANS.high_intent         },
  { key: "returning_visitor",   plan: PRESET_PLANS.returning_visitor   },
  { key: "google_campaign",     plan: PRESET_PLANS.google_campaign     },
  { key: "enterprise_prospect", plan: PRESET_PLANS.enterprise_prospect },
  { key: "form_dropoff",        plan: PRESET_PLANS.form_dropoff        },
  { key: "customer_onboarding", plan: PRESET_PLANS.customer_onboarding },
  { key: "customer_expansion",  plan: PRESET_PLANS.customer_expansion  },
  { key: "post_conversion",     plan: PRESET_PLANS.post_conversion     },
  { key: "high_friction",       plan: PRESET_PLANS.high_friction       },
  { key: "churn_risk",          plan: PRESET_PLANS.churn_risk          },
  // Careers / Werken-bij
  { key: "careers_new_visitor",   plan: PRESET_PLANS.careers_new_visitor   },
  { key: "careers_explorer",      plan: PRESET_PLANS.careers_explorer      },
  { key: "careers_job_interest",  plan: PRESET_PLANS.careers_job_interest  },
  { key: "careers_high_intent",   plan: PRESET_PLANS.careers_high_intent   },
  { key: "careers_drop_off",      plan: PRESET_PLANS.careers_drop_off      },
  { key: "careers_submitted",     plan: PRESET_PLANS.careers_submitted      },
  // Interest / Behavioural Personalisation
  { key: "interest_pricing",               plan: PRESET_PLANS.interest_pricing               },
  { key: "interest_pricing_strong",        plan: PRESET_PLANS.interest_pricing_strong        },
  { key: "interest_product",               plan: PRESET_PLANS.interest_product               },
  { key: "interest_use_case",              plan: PRESET_PLANS.interest_use_case              },
  { key: "interest_technical",             plan: PRESET_PLANS.interest_technical             },
  { key: "interest_trust",                 plan: PRESET_PLANS.interest_trust                 },
  { key: "interest_roi",                   plan: PRESET_PLANS.interest_roi                   },
  { key: "interest_comparison",            plan: PRESET_PLANS.interest_comparison            },
  { key: "interest_high_confidence",       plan: PRESET_PLANS.interest_high_confidence       },
  { key: "interest_pricing_technical",     plan: PRESET_PLANS.interest_pricing_technical     },
  { key: "interest_candidate",             plan: PRESET_PLANS.interest_candidate             },
  { key: "interest_candidate_high_intent", plan: PRESET_PLANS.interest_candidate_high_intent },
  { key: "interest_commerce_product",      plan: PRESET_PLANS.interest_commerce_product      },
  { key: "interest_property",              plan: PRESET_PLANS.interest_property              },
];

/**
 * Look up the canonical preset plan for a given preset key.
 * Returns undefined when the key doesn't map to a known preset.
 */
export function getPresetPlan(presetKey: string): PresetPlan | undefined {
  return PRESET_PLANS[presetKey];
}

/**
 * Convert a PresetPlan to a StoredPlan by dropping any undefined optional
 * fields.  Safe to spread directly into a new StoredRule.
 */
export function presetPlanToStoredPlan(plan: PresetPlan): StoredPlan {
  const stored: StoredPlan = {
    heroKey:  plan.heroKey,
    proofKey: plan.proofKey,
    ctaKey:   plan.ctaKey,
  };
  if (plan.featureKey)      stored.featureKey      = plan.featureKey;
  if (plan.conversionKey)   stored.conversionKey   = plan.conversionKey;
  if (plan.pricingEmphasis) stored.pricingEmphasis = plan.pricingEmphasis;
  if (plan.pricingCtaMode)  stored.pricingCtaMode  = plan.pricingCtaMode;
  if (plan.notificationKey) stored.notificationKey = plan.notificationKey;
  return stored;
}
