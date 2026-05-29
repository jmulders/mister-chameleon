/**
 * Structured SaaS Blueprint
 *
 * A complete starting configuration for editorial-product B2B SaaS brands.
 * Inspired by the Aelen Sanity template / Lexington Themes viewport —
 * warm stone surface, amber-orange accent, hairline borders, Plus Jakarta Sans.
 * Content hierarchy over conversion energy; structured confidence over loud marketing.
 *
 * ─── Design philosophy ────────────────────────────────────────────────────────
 *
 *   Structured SaaS is a "depth-confidence" theme: it rewards visitors who are
 *   in evaluation mode — comparing options, reading documentation, scanning
 *   feature lists.  The editorial product aesthetic signals that the brand has
 *   substance, not just a landing page.
 *
 *   Rule 1: Pricing-page visitor       → direct comparison CTA (soft, structured)
 *   Rule 2: Blog / content referral    → content-index browsing CTA (deepen engagement)
 *   Rule 3: LinkedIn / direct source   → structured feature overview + demo CTA
 *   Rule 4: New visitor (fallback)     → split-hero welcome; features + social proof
 *
 * ─── Theme recommendation ──────────────────────────────────────────────────────
 *   structured-saas — warm stone, amber-orange, Plus Jakarta Sans, hairline borders
 *
 * ─── Pages ──────────────────────────────────────────────────────────────────────
 *   /              split-hero → features (bordered) → integrations → logos → CTA
 *   /features      product feature breakdown: 3-col grid + detail + proof
 *   /pricing       structured pricing tiers + FAQ + comparison table + CTA
 *   /integrations  integration grid + logos + CTA
 *   /blog          editorial content index (changelog-style listing)
 *   /contact       structured form + CTA
 */

import type { Blueprint } from "../blueprint-types";

export const structuredSaasBlueprint: Blueprint = {
  key:             "structured_saas",
  name:            "Structured SaaS / Editorial Product",
  description:     "Editorial product aesthetic for B2B SaaS — content hierarchy, bordered cards, amber-orange accent, structured confidence.",
  longDescription:
    "Built for B2B SaaS and editorial-product brands that lead with content depth. " +
    "Warm stone surfaces, amber-orange accent, hairline borders, and Plus Jakarta Sans typography " +
    "create a structured, confident aesthetic. " +
    "The site architecture prioritises feature depth, integrations, and editorial content — " +
    "personalization escalates from discovery to evaluation to demo as intent signals accumulate.",
  industry:    "b2b_saas",
  tags:        ["saas", "editorial", "product", "b2b", "structured", "content-first", "features"],

  recommendedThemePreset: "structured-saas",
  recommendedThemeFamily: "structured-saas",

  // ── Pages ──────────────────────────────────────────────────────────────────

  pages: [
    {
      slug:  "/",
      title: "Homepage",
      blocks: [
        { type: "logoStrip",          note: "Muted logos — editorial restraint; ghosted at 0.65 opacity" },
        { type: "featureGrid",        note: "Core capabilities — 3-col bordered grid; icon + headline + copy" },
        { type: "stats",              note: "Key product metrics: users, integrations, uptime SLA" },
        { type: "testimonialSection", note: "2–3 structured quote cards; customer + role" },
        { type: "ctaSection",         note: "Soft split-layout CTA — structured amber button; no glow" },
      ],
    },
    {
      slug:  "/features",
      title: "Features",
      blocks: [
        { type: "textSection",        note: "Feature overview — headline + 2-line summary" },
        { type: "featureGrid",        note: "Detailed feature breakdown — 3-col bordered; detailed copy" },
        { type: "stats",              note: "Usage and performance metrics" },
        { type: "testimonialSection", note: "Feature-specific social proof" },
        { type: "ctaSection",         note: "Get started / book demo CTA — structured amber" },
      ],
    },
    {
      slug:  "/pricing",
      title: "Pricing",
      blocks: [
        { type: "textSection",        note: "Pricing headline + 1-line positioning" },
        { type: "featureGrid",        note: "3-tier pricing cards — bordered, sharp radius; feature matrix" },
        { type: "faqSection",         note: "Pricing FAQ — accordion; common billing and trial questions" },
        { type: "testimonialSection", note: "1–2 proof quotes: why customers chose the product" },
        { type: "ctaSection",         note: "Start trial / talk to sales CTA" },
      ],
    },
    {
      slug:  "/integrations",
      title: "Integrations",
      blocks: [
        { type: "textSection",        note: "Integrations headline — 'Connect everything you already use'" },
        { type: "logoStrip",          note: "Integration logos — full-opacity grid; tool names visible" },
        { type: "featureGrid",        note: "Integration categories — 3-col bordered; by workflow area" },
        { type: "ctaSection",         note: "Request integration / see API docs CTA" },
      ],
    },
    {
      slug:  "/blog",
      title: "Blog",
      blocks: [
        { type: "textSection",        note: "Blog / insights page header — editorial positioning" },
        { type: "newsList",           note: "Editorial article listing — structured card grid; date + author + tag" },
        { type: "ctaSection",         note: "Newsletter subscribe CTA — structured amber" },
      ],
    },
    {
      slug:  "/contact",
      title: "Contact",
      blocks: [
        { type: "textSection",        note: "Contact page header — 'Talk to the team'" },
        { type: "about",              note: "Company location + contact details sidebar" },
        { type: "ctaSection",         note: "Book a demo CTA — primary structured amber" },
      ],
    },
  ],

  // ── Behavioral rules ────────────────────────────────────────────────────────

  rules: [
    {
      label:           "Pricing-page visitor → intent-ready demo push",
      priority:        10,
      source:          "blueprint",
      precedenceLevel: "high_intent",
      condition: { type: "context", contextId: "ctx_pricing_visitor" },
      plan: {
        heroKey:  "hero_intent_direct",
        proofKey: "proof_stats",
        ctaKey:   "cta_demo",
        themeKey: "structured-saas",
      },
      reason: "Visitor has viewed the pricing page — direct CTA to book a demo or compare plans.",
    },
    {
      label:           "Content / blog referral → editorial engagement CTA",
      priority:        20,
      source:          "blueprint",
      precedenceLevel: "medium_segmentation",
      condition: { type: "context", contextId: "ctx_content_referral" },
      plan: {
        heroKey:  "hero_consideration",
        proofKey: "proof_vision",
        ctaKey:   "cta_guide",
        themeKey: "structured-saas",
      },
      reason: "Visitor arrives via a content/blog referral — invite deeper browsing; lower-pressure CTA.",
    },
    {
      label:           "LinkedIn / professional source → vision positioning + demo CTA",
      priority:        30,
      source:          "blueprint",
      precedenceLevel: "medium_segmentation",
      condition: { type: "context", contextId: "ctx_linkedin_traffic" },
      plan: {
        heroKey:  "hero_linkedin_vision",
        proofKey: "proof_platform",
        ctaKey:   "cta_demo",
        themeKey: "structured-saas",
      },
      reason: "LinkedIn source signals a professional evaluator — thought-leadership positioning with demo CTA.",
    },
  ],

  // ── Scoring rules ────────────────────────────────────────────────────────────

  scoringRules: [
    {
      key:           "structured_saas_pricing_view",
      label:          "Pricing page view",
      description:   "Pricing visits are the strongest intent signal — visitor is evaluating cost/value.",
      event_type:    "page_view",
      event_value:   "/pricing",
      score:    40,
      decay_profile: "slow",
      priority:      1,
    },
    {
      key:           "structured_saas_features_view",
      label:          "Features page view",
      description:   "Feature-depth browsing signals evaluation; visitor is comparing capabilities.",
      event_type:    "page_view",
      event_value:   "/features",
      score:    25,
      decay_profile: "slow",
      priority:      2,
    },
    {
      key:           "structured_saas_integrations_view",
      label:          "Integrations page view",
      description:   "Integration research signals a buyer mapping the product to their stack.",
      event_type:    "page_view",
      event_value:   "/integrations",
      score:    20,
      decay_profile: "slow",
      priority:      3,
    },
    {
      key:           "structured_saas_blog_view",
      label:          "Blog page view",
      description:   "Content reading signals early-stage interest; editorial depth builds trust.",
      event_type:    "page_view",
      event_value:   "/blog",
      score:    10,
      decay_profile: "medium",
      priority:      4,
    },
    {
      key:           "structured_saas_return_visit",
      label:          "Return visit",
      description:   "Return visitors are in consideration; treat them as warm.",
      event_type:    "session_start",
      event_value:   "return",
      score:    15,
      decay_profile: "slow",
      priority:      5,
    },
  ],

  // ── Sequence patterns ────────────────────────────────────────────────────────

  sequencePatterns: [
    {
      slug:            "structured_saas_editorial_to_evaluation",
      label:           "Editorial → Evaluation (warm lead)",
      sequence: [
        { event_type: "page_view", event_value: "/blog" },
        { event_type: "page_view", event_value: "/features" },
        { event_type: "page_view", event_value: "/pricing" },
      ],
      max_gap_minutes: 30,
      score:           55,
    },
    {
      slug:            "structured_saas_direct_evaluation",
      label:           "Direct Evaluation → Sales",
      sequence: [
        { event_type: "page_view", event_value: "/pricing" },
        { event_type: "page_view", event_value: "/features" },
      ],
      max_gap_minutes: 20,
      score:           45,
    },
  ],
};
