/**
 * Generate Preset Rules
 *
 * Builds a complete StoredRulesConfig from all 33 scenario preset archetypes.
 * Called during site initialisation (initializeSite) to seed every tenant with
 * a useful rule set out of the box, without requiring any manual rule authoring.
 *
 * ─── What this produces ───────────────────────────────────────────────────────
 *
 *   One StoredRule per PRESET_CONDITIONS entry (33 total), each paired with its
 *   canonical PRESET_PLANS plan.  Rules are assigned:
 *
 *     • A stable, predictable ID:  "preset.<key>"
 *     • A unique priority that reflects semantic importance (see table below).
 *     • source: "blueprint" — safe to overwrite on subsequent blueprint applies
 *       but never trampled by "system" updates.  Tenant edits upgrade to "tenant".
 *     • A packId grouping the rule by its primary signal type.
 *
 * ─── Priority assignment ──────────────────────────────────────────────────────
 *
 *   Tier                  Priority  Preset key(s)
 *   ─────────────────────────────────────────────────────────────────────────
 *   hard_state   (1–9)    1         customer_onboarding
 *                         2         post_conversion
 *                         3         churn_risk
 *                         4         customer_expansion
 *                         5         careers_submitted
 *
 *   high_intent  (10–19)  10        high_intent
 *                         11        trial_ready
 *                         12        form_dropoff
 *                         13        careers_high_intent
 *                         14        careers_drop_off
 *
 *   medium_seg.  (20–49)  20        google_campaign
 *                         21        enterprise_prospect
 *                         29        linkedin_traffic
 *                         30        consideration
 *                         31        returning_visitor
 *                         35        high_friction
 *                         40        careers_job_interest
 *                         41        careers_explorer
 *
 *   decorative   (50–99)  50        new_visitor
 *                         51        careers_new_visitor
 *
 * ─── Idempotency ──────────────────────────────────────────────────────────────
 *
 *   generatePresetRulesConfig() always returns a fresh config.  The caller
 *   (initializeSite) is responsible for the upsert strategy:
 *
 *   • If no rules_config row exists → insert this config directly.
 *   • If a row already exists → merge: preserve rules with source="tenant",
 *     replace blueprint-sourced rules with the freshly generated ones.
 *
 * ─── Server-only ──────────────────────────────────────────────────────────────
 *
 *   This file only imports types and pure data — it is safe to import from any
 *   server module.  Do NOT import in client components.
 */

import { PRESET_CONDITIONS }   from "./preset-conditions";
import { PRESET_PLANS, presetPlanToStoredPlan } from "./preset-plans";
import type { StoredRule, StoredRulesConfig, RuleCondition } from "./stored-rule";
import type { PrecedenceLevel } from "./rule-packs";

// ── Priority + pack metadata per preset key ───────────────────────────────────

interface PresetMeta {
  priority:        number;
  precedenceLevel: PrecedenceLevel;
  packId:          string;
}

const PRESET_META: Record<string, PresetMeta> = {
  // ── hard_state (1–9) — deterministic lifecycle states ──────────────────────
  customer_onboarding: { priority: 1,  precedenceLevel: "hard_state",          packId: "pack_funnel_stage" },
  post_conversion:     { priority: 2,  precedenceLevel: "hard_state",          packId: "pack_funnel_stage" },
  churn_risk:          { priority: 3,  precedenceLevel: "hard_state",          packId: "pack_funnel_stage" },
  customer_expansion:  { priority: 4,  precedenceLevel: "hard_state",          packId: "pack_funnel_stage" },
  careers_submitted:   { priority: 5,  precedenceLevel: "hard_state",          packId: "pack_funnel_stage" },

  // ── high_intent (10–19) — strong intent / friction signals ─────────────────
  high_intent:         { priority: 10, precedenceLevel: "high_intent",         packId: "pack_funnel_stage" },
  trial_ready:         { priority: 11, precedenceLevel: "high_intent",         packId: "pack_funnel_stage" },
  form_dropoff:        { priority: 12, precedenceLevel: "high_intent",         packId: "pack_behaviour"   },
  careers_high_intent: { priority: 13, precedenceLevel: "high_intent",         packId: "pack_funnel_stage" },
  careers_drop_off:    { priority: 14, precedenceLevel: "high_intent",         packId: "pack_behaviour"   },

  // ── medium_segmentation (20–49) — traffic source & funnel stage ────────────
  google_campaign:     { priority: 20, precedenceLevel: "medium_segmentation", packId: "pack_campaigns"    },
  enterprise_prospect: { priority: 21, precedenceLevel: "medium_segmentation", packId: "pack_traffic_source" },
  linkedin_traffic:    { priority: 29, precedenceLevel: "medium_segmentation", packId: "pack_traffic_source" },
  consideration:       { priority: 30, precedenceLevel: "medium_segmentation", packId: "pack_funnel_stage" },
  returning_visitor:   { priority: 31, precedenceLevel: "medium_segmentation", packId: "pack_funnel_stage" },
  high_friction:       { priority: 35, precedenceLevel: "medium_segmentation", packId: "pack_behaviour"   },
  careers_job_interest:{ priority: 40, precedenceLevel: "medium_segmentation", packId: "pack_funnel_stage" },
  careers_explorer:    { priority: 41, precedenceLevel: "medium_segmentation", packId: "pack_funnel_stage" },

  // ── decorative (50–99) — first-touch / low-signal ──────────────────────────
  new_visitor:         { priority: 50, precedenceLevel: "decorative",          packId: "pack_funnel_stage" },
  careers_new_visitor: { priority: 51, precedenceLevel: "decorative",          packId: "pack_funnel_stage" },

  // ── interest / behavioural personalisation (15–18 + 22–29 + 42–44) ─────────
  //
  //   High-confidence interest signals (15–18) sit inside the high_intent tier —
  //   a visitor who has clearly and repeatedly engaged with a specific topic is
  //   as strong a signal as funnel-stage intent.
  //
  //   Moderate interest signals (22–29) sit above campaign/source presets (20–21)
  //   because topic affinity is a richer, session-built signal than entry source.
  //
  //   Domain-specific interest presets (42–44) sit alongside the corresponding
  //   careers funnel presets and fire only for their vertical.

  // High-confidence (inside high_intent tier)
  interest_high_confidence:       { priority: 15, precedenceLevel: "high_intent",         packId: "pack_interest" },
  interest_pricing_strong:        { priority: 16, precedenceLevel: "high_intent",         packId: "pack_interest" },
  interest_pricing_technical:     { priority: 17, precedenceLevel: "high_intent",         packId: "pack_interest" },
  interest_candidate_high_intent: { priority: 18, precedenceLevel: "high_intent",         packId: "pack_interest" },

  // Moderate interest (above campaign/source, inside medium_segmentation)
  interest_pricing:               { priority: 22, precedenceLevel: "medium_segmentation", packId: "pack_interest" },
  interest_comparison:            { priority: 23, precedenceLevel: "medium_segmentation", packId: "pack_interest" },
  interest_roi:                   { priority: 24, precedenceLevel: "medium_segmentation", packId: "pack_interest" },
  interest_product:               { priority: 25, precedenceLevel: "medium_segmentation", packId: "pack_interest" },
  interest_technical:             { priority: 26, precedenceLevel: "medium_segmentation", packId: "pack_interest" },
  interest_use_case:              { priority: 27, precedenceLevel: "medium_segmentation", packId: "pack_interest" },
  interest_trust:                 { priority: 28, precedenceLevel: "medium_segmentation", packId: "pack_interest" },

  // Domain-specific (alongside careers funnel presets)
  interest_candidate:             { priority: 42, precedenceLevel: "medium_segmentation", packId: "pack_interest" },
  interest_commerce_product:      { priority: 43, precedenceLevel: "medium_segmentation", packId: "pack_interest" },
  interest_property:              { priority: 44, precedenceLevel: "medium_segmentation", packId: "pack_interest" },
};

// ── Condition builder ─────────────────────────────────────────────────────────

/**
 * Convert a PresetConditionDef's leaves into a RuleCondition.
 * Single-leaf presets emit the FieldCondition directly (no wrapping group).
 * Multi-leaf presets emit a GroupCondition with the preset's AND/OR logic.
 */
function buildCondition(
  leaves: import("./preset-conditions").PresetConditionDef["leaves"],
  logic:  "and" | "or",
): RuleCondition {
  if (leaves.length === 1) {
    // Single leaf — no need to wrap in a group.
    return leaves[0];
  }
  return {
    type:       "group",
    logic,
    conditions: leaves,
  };
}

// ── Reason copy per preset key ────────────────────────────────────────────────

const PRESET_REASONS: Record<string, string> = {
  new_visitor:          "First visit, no behavioural signal. Brand intro experience.",
  returning_visitor:    "Returning visitor with established intent stage.",
  consideration:        "Returning visitor in active consideration stage.",
  trial_ready:          "Has visited pricing and shows intent ≥ 50, trial experience.",
  high_intent:          "Strongest buying signals: high-intent stage + score ≥ 65.",
  google_campaign:      "Arrived via Google, problem-aware hero matches search intent.",
  enterprise_prospect:  "LinkedIn visit in consideration stage, vision-led experience.",
  linkedin_traffic:     "Arrived via LinkedIn, vision hero for thought-leadership and social intent.",
  form_dropoff:         "Started the form but abandoned, re-engage with reassurance.",
  customer_onboarding:  "Existing customer in onboarding, lifecycle experience.",
  customer_expansion:   "Customer revisiting pricing, expansion opportunity.",
  post_conversion:      "Form just submitted, post-conversion celebration & onboarding.",
  high_friction:        "High friction score, simplify the decision path.",
  churn_risk:           "Customer showing disengagement, re-engagement focus.",
  // Careers
  careers_new_visitor:  "First visit to careers site, employer brand introduction.",
  careers_explorer:     "Visited job listings but not a specific role yet.",
  careers_job_interest: "Viewed a specific job detail page, role interest confirmed.",
  careers_high_intent:  "Viewed job detail and clicked apply/browse CTA, high intent.",
  careers_drop_off:     "Started application form but abandoned, reduce friction.",
  careers_submitted:    "Application submitted, post-conversion confirmation.",
  // Interest / Behavioural Personalisation
  interest_pricing:               "Behavioural scoring: primary interest = pricing_focused with moderate confidence. Visitor is actively comparing plans.",
  interest_pricing_strong:        "Behavioural scoring: pricing score ≥ 0.50, deep price evaluation. Capture before they choose a competitor.",
  interest_product:               "Behavioural scoring: primary interest = product_focused. Show features in depth and offer a demo.",
  interest_use_case:              "Behavioural scoring: primary interest = use_case_focused. Reinforce with case studies and relevant use-case content.",
  interest_technical:             "Behavioural scoring: primary interest = technical_focused. Developer or technical evaluator, guide CTA to docs/quickstart.",
  interest_trust:                 "Behavioural scoring: primary interest = trust_focused. Security or compliance buyer, lead with reassurance proof.",
  interest_roi:                   "Behavioural scoring: primary interest = roi_focused. Business-case researcher, stats proof + comparison table.",
  interest_comparison:            "Behavioural scoring: primary interest = comparison_focused. Visitor is comparing competitors, stats proof + meeting CTA.",
  interest_high_confidence:       "Behavioural scoring: any primary interest with confidence ≥ 0.50, highly engaged visitor regardless of topic.",
  interest_pricing_technical:     "Behavioural scoring: pricing + technical scores both ≥ 0.30, technical evaluator with budget authority.",
  interest_candidate:             "Behavioural scoring: candidate_explorer profile. Browsing employer brand, job-match hero + browse CTA.",
  interest_candidate_high_intent: "Behavioural scoring: candidate score ≥ 0.50 + visited about/jobs, high-intent applicant, direct apply CTA.",
  interest_commerce_product:      "Behavioural scoring: commerce-product profile. Product/shop interest, consideration hero + guide CTA.",
  interest_property:              "Behavioural scoring: property profile. Real estate interest, consideration hero + cases proof.",
};

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate a complete StoredRulesConfig seeded with all 19 preset rules.
 *
 * @param tenantId  Used only for logging/tracing — does not affect the config.
 * @returns A valid StoredRulesConfig ready to write to `rules_config`.
 *
 * ─── Priority table — interest presets (additions to original 19) ─────────────
 *
 *   Tier                  Priority  Preset key
 *   ─────────────────────────────────────────────────────────────────────────
 *   high_intent  (15–18)  15        interest_high_confidence
 *                         16        interest_pricing_strong
 *                         17        interest_pricing_technical
 *                         18        interest_candidate_high_intent
 *
 *   medium_seg.  (22–29)  22        interest_pricing
 *                         23        interest_comparison
 *                         24        interest_roi
 *                         25        interest_product
 *                         26        interest_technical
 *                         27        interest_use_case
 *                         28        interest_trust
 *
 *   medium_seg.  (42–44)  42        interest_candidate
 *                         43        interest_commerce_product
 *                         44        interest_property
 */
export function generatePresetRulesConfig(_tenantId: string): StoredRulesConfig {
  const rules: StoredRule[] = [];

  for (const preset of PRESET_CONDITIONS) {
    const plan = PRESET_PLANS[preset.key];
    const meta = PRESET_META[preset.key];

    if (!plan || !meta) {
      // Guard against future preset keys added without corresponding metadata.
      continue;
    }

    const rule: StoredRule = {
      id:              `preset.${preset.key}`,
      priority:        meta.priority,
      precedenceLevel: meta.precedenceLevel,
      packId:          meta.packId,
      label:           preset.label,
      condition:       buildCondition(preset.leaves, preset.logic),
      plan:            presetPlanToStoredPlan(plan),
      reason:          PRESET_REASONS[preset.key] ?? preset.label,
      enabled:         true,
      source:          "blueprint",
    };

    rules.push(rule);
  }

  // Sort by priority ascending so the stored JSON is human-readable.
  rules.sort((a, b) => a.priority - b.priority);

  return {
    schemaVersion: 1,
    updatedAt:     new Date().toISOString(),
    rules,
    defaultPlan: {
      heroKey:  "hero_direct_brand",
      proofKey: "proof_default",
      ctaKey:   "cta_guide",
      reason:   "Default/direct traffic, brand-led experience.",
    },
    rulesEnabled: true,
  };
}

// ── Merge helper ──────────────────────────────────────────────────────────────

/**
 * Merge freshly generated preset rules into an existing config.
 *
 * Strategy:
 *   • Rules with source="tenant" are always preserved as-is.
 *   • Rules with source="system" are preserved as-is (system rules are not
 *     replaced by preset generation).
 *   • Rules with source="blueprint" (or absent) that share an ID with a newly
 *     generated preset rule are replaced.
 *   • New preset rules that do not exist in the current config are appended.
 *
 * This ensures tenant customisations survive re-initialisation and blueprint
 * upgrades while the preset rules themselves stay up to date.
 *
 * @param existing  The current StoredRulesConfig from the DB.
 * @param generated The output of generatePresetRulesConfig().
 * @returns A merged StoredRulesConfig with updated timestamp.
 */
export function mergePresetRules(
  existing:  StoredRulesConfig,
  generated: StoredRulesConfig,
): StoredRulesConfig {
  const generatedById = new Map(generated.rules.map((r) => [r.id, r]));

  // Keep all tenant-authored and system rules unchanged.
  const preserved = existing.rules.filter(
    (r) => r.source === "tenant" || r.source === "system",
  );

  // For blueprint rules not customised by the tenant: use the generated version.
  // If a preset ID doesn't appear in the existing config, add it fresh.
  const merged: StoredRule[] = [...preserved];

  for (const gen of generated.rules) {
    const alreadyPreserved = preserved.some((r) => r.id === gen.id);
    if (!alreadyPreserved) {
      merged.push(gen);
    }
  }

  // Sort by priority ascending.
  merged.sort((a, b) => a.priority - b.priority);

  return {
    ...existing,
    rules:     merged,
    updatedAt: new Date().toISOString(),
  };
}
