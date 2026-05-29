/**
 * Dark AI SaaS Blueprint
 *
 * A complete starting configuration for AI-first and premium dark-mode SaaS products.
 * Inspired by zerodrift.ai — near-black surface, indigo-violet accent, bold display
 * headings, no structural dividers, subtle glow.
 *
 * ─── Personalization philosophy ──────────────────────────────────────────────────
 *
 *   Dark AI is a "depth signal" theme: it rewards visitors who already know what
 *   they want (high-intent, returning, technical).  Default rules reinforce this:
 *
 *   Rule 1: Pricing-page visitor       → demo CTA (converting intent to action)
 *   Rule 2: Returning visitor          → platform deep-dive CTA (assumes prior awareness)
 *   Rule 3: LinkedIn / developer source→ technical proof + feature-depth CTA
 *   Rule 4: New visitor (fallback)     → clean, welcoming guide CTA (less pressure)
 *
 * ─── Theme recommendation ──────────────────────────────────────────────────────
 *   dark-ai  — near-black, indigo-violet, Manrope headings
 *
 * ─── Contextual theming ────────────────────────────────────────────────────────
 *   Works with contextual theme overrides:
 *   - Night-time traffic → switch INTO dark-ai (already dark; no change needed)
 *   - Morning / first-visit → switch to clean-corporate (lighter, welcoming)
 *   - Returning + high-intent → stay in dark-ai; escalate to demo CTA variant
 *
 * ─── Pages ──────────────────────────────────────────────────────────────────────
 *   /              hero_minimal_dark → features (dark) → logos → CTA (glow)
 *   /platform      product-depth: features + stats + testimonials + CTA
 *   /pricing       tiers + FAQ + CTA
 *   /company       mission + team + CTA
 *   /contact       form + CTA
 */

import type { Blueprint } from "../blueprint-types";

export const darkAiSaasBlueprint: Blueprint = {
  key:             "dark_ai_saas",
  name:            "Dark AI / Premium SaaS",
  description:     "Near-black, AI-forward setup for premium SaaS and developer tools. High-intent CTAs, technical proof, and depth-first personalization.",
  longDescription:
    "Built for AI tools, developer APIs, and premium dark-mode-first SaaS products. " +
    "Near-black surfaces, indigo-violet accents, bold display headings, and a no-divider " +
    "layout create a sophisticated 'depth' aesthetic that rewards technical visitors. " +
    "Personalization escalates from awareness → consideration → demo as intent signals accumulate.",
  industry:    "b2b_saas",
  tags:        ["ai", "dark-mode", "saas", "developer", "premium", "b2b", "demo"],

  recommendedThemePreset: "dark-ai",
  recommendedThemeFamily: "dark-ai",

  // ── Pages ──────────────────────────────────────────────────────────────────

  pages: [
    {
      slug:  "/",
      title: "Homepage",
      blocks: [
        { type: "logoStrip",          note: "Social proof: recognizable logos at reduced opacity (muted variant)" },
        { type: "featureGrid",        note: "Core capabilities — 3-col dark grid (feature_grid_dark variant)" },
        { type: "stats",              note: "Key metrics: users, uptime, API calls per second" },
        { type: "testimonialSection", note: "1–2 technical / engineering testimonials" },
        { type: "ctaSection",         note: "Dark glow CTA — book a demo or start free (cta_glow variant)" },
      ],
    },
    {
      slug:  "/platform",
      title: "Platform",
      blocks: [
        { type: "textSection",        note: "Platform overview headline — what it is and why it matters" },
        { type: "featureGrid",        note: "Detailed feature breakdown — icons + short copy" },
        { type: "stats",              note: "Performance benchmarks and scale metrics" },
        { type: "testimonialSection", note: "Customer engineering testimonials" },
        { type: "ctaSection",         note: "Book a demo / see docs CTA" },
      ],
    },
    {
      slug:  "/pricing",
      title: "Pricing",
      blocks: [
        { type: "textSection",        note: "Pricing headline: transparent, usage-based" },
        { type: "pricingSection",     note: "Starter / Growth / Enterprise tier cards" },
        { type: "faqSection",         note: "Billing, limits, enterprise pricing FAQs" },
        { type: "testimonialSection", note: "One ROI-focused testimonial" },
        { type: "ctaSection",         note: "Talk to sales / start free CTA" },
      ],
    },
    {
      slug:  "/company",
      title: "Company",
      blocks: [
        { type: "textSection",        note: "Mission: what we're building and why" },
        { type: "stats",              note: "Company milestones: team size, funding, years" },
        { type: "teamSection",        note: "Core team photos + bios" },
        { type: "ctaSection",         note: "We're hiring CTA" },
      ],
    },
    {
      slug:  "/contact",
      title: "Contact",
      blocks: [
        { type: "textSection",        note: "Contact headline + brief copy" },
        { type: "formSection",        note: "Contact / demo request form (form_split variant)" },
        { type: "ctaSection",         note: "Secondary CTA: book a call" },
      ],
    },
  ],

  // ── Behavioral rules ────────────────────────────────────────────────────────

  rules: [
    {
      label:           "Returning CTA-clicked visitor → Platform-forward hero + direct demo",
      priority:        10,
      source:          "blueprint",
      precedenceLevel: "high_intent",
      condition: { type: "context", contextId: "ctx_returning_cta_clicked" },
      plan: {
        heroKey:  "hero_intent_direct",
        proofKey: "proof_platform",
        ctaKey:   "cta_demo",
        themeKey: "dark-ai",
      },
      reason: "Returning visitor who previously clicked CTA — escalated to intent-ready platform hero with direct demo push.",
    },
    {
      label:           "LinkedIn/professional traffic → Vision positioning",
      priority:        20,
      source:          "blueprint",
      precedenceLevel: "medium_segmentation",
      condition: { type: "context", contextId: "ctx_linkedin_traffic" },
      plan: {
        heroKey:  "hero_linkedin_vision",
        proofKey: "proof_vision",
        ctaKey:   "cta_platform",
        themeKey: "dark-ai",
      },
      reason: "LinkedIn source signals a professional evaluator — thought-leadership positioning with platform CTA.",
    },
    {
      label:           "High-engagement visitor → Intent-ready demo push",
      priority:        30,
      source:          "blueprint",
      precedenceLevel: "medium_segmentation",
      condition: { type: "context", contextId: "ctx_high_engagement" },
      plan: {
        heroKey:  "hero_saas_intent",
        proofKey: "proof_stats",
        ctaKey:   "cta_demo",
        themeKey: "dark-ai",
      },
      reason: "High-engagement visitor (3+ page views) — intent-ready; show performance stats and push to demo.",
    },
  ],

  // ── Scoring rules ────────────────────────────────────────────────────────────

  scoringRules: [
    {
      key:           "dark_ai_pricing_view",
      label:          "Pricing page view",
      event_type:    "page_view",
      event_value:   "/pricing",
      score:    45,
      decay_profile: "slow",
      priority:      1,
    },
    {
      key:           "dark_ai_platform_view",
      label:          "Platform page view",
      event_type:    "page_view",
      event_value:   "/platform",
      score:    20,
      decay_profile: "slow",
      priority:      2,
    },
    {
      key:           "dark_ai_demo_cta_click",
      label:          "Demo CTA click",
      event_type:    "cta_click",
      event_value:   "demo",
      score:    30,
      decay_profile: "slow",
      priority:      3,
    },
    {
      key:           "dark_ai_contact_view",
      label:          "Contact page view",
      event_type:    "page_view",
      event_value:   "/contact",
      score:    25,
      decay_profile: "slow",
      priority:      4,
    },
    {
      key:           "dark_ai_form_start",
      label:          "Form start",
      event_type:    "form_start",
      score:    15,
      decay_profile: "medium",
      priority:      5,
    },
  ],

  // ── Sequence patterns ────────────────────────────────────────────────────────

  sequencePatterns: [
    {
      slug:            "dark_ai_pricing_to_contact",
      label:           "Pricing → Contact (high intent)",
      sequence: [
        { event_type: "page_view", event_value: "/pricing" },
        { event_type: "page_view", event_value: "/contact" },
      ],
      max_gap_minutes: 20,
      score:           60,
    },
    {
      slug:            "dark_ai_platform_to_pricing",
      label:           "Platform → Pricing (consideration)",
      sequence: [
        { event_type: "page_view", event_value: "/platform" },
        { event_type: "page_view", event_value: "/pricing" },
      ],
      max_gap_minutes: 30,
      score:           35,
    },
  ],
};
