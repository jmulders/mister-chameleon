/**
 * Clean Corporate SaaS Blueprint
 *
 * A complete starting configuration for modern B2B SaaS and professional-services
 * products where the first impression must be clean, trustworthy, and focused.
 * Inspired by yeldra.com — pure white, sky-blue accent, DM Sans, balanced radius.
 *
 * ─── Personalization philosophy ──────────────────────────────────────────────────
 *
 *   Clean Corporate is a "trust-on-first-meeting" theme: it performs best for
 *   broad default traffic and first-time visitors who need to quickly understand
 *   what the product does and whether it's credible.  Rules gently escalate:
 *
 *   Rule 1: Services/cases visitor     → case study proof (social proof escalation)
 *   Rule 2: Pricing visitor            → talk-to-sales CTA (meeting intent signal)
 *   Rule 3: Corporate / LinkedIn source→ enterprise features + trust proof
 *   Rule 4: New visitor (fallback)     → clean hero + gentle guide CTA
 *
 * ─── Theme recommendation ──────────────────────────────────────────────────────
 *   clean-corporate  — pure white, sky-600, DM Sans, balanced radius
 *
 * ─── Contextual theming ────────────────────────────────────────────────────────
 *   Works cleanly as the default theme for broad traffic.
 *   Pair with dark-ai as a high-intent contextual override:
 *   - First visit / awareness → clean-corporate (default)
 *   - Returning + pricing intent → dark-ai (escalate urgency)
 *
 * ─── Pages ──────────────────────────────────────────────────────────────────────
 *   /              hero_split_clean → logos → features (spacious) → testimonials → CTA (soft)
 *   /services      service overview: features + case highlights + testimonials + CTA
 *   /cases         case study listing + testimonials + CTA
 *   /pricing       tiers + FAQ + CTA
 *   /contact       form + details + CTA
 */

import type { Blueprint } from "../blueprint-types";

export const cleanCorporateSaasBlueprint: Blueprint = {
  key:             "clean_corporate_saas",
  name:            "Clean Corporate / Modern SaaS",
  description:     "White, structured, trust-first setup for B2B SaaS and professional services. Awareness-stage optimised with gentle personalization escalation.",
  longDescription:
    "Built for modern B2B SaaS, consulting, and professional-services brands. " +
    "Pure white surfaces, sky-blue accent, clean DM Sans typography, and very subtle " +
    "card shadows create an authoritative-yet-approachable first impression. " +
    "Personalization starts soft (guide CTA for new visitors) and escalates as " +
    "intent signals accumulate (meeting / demo CTA for high-intent visitors).",
  industry:    "b2b_saas",
  tags:        ["saas", "corporate", "professional-services", "b2b", "trust", "clean"],

  recommendedThemePreset: "clean-corporate",
  recommendedThemeFamily: "clean-corporate",

  // ── Pages ──────────────────────────────────────────────────────────────────

  pages: [
    {
      slug:  "/",
      title: "Homepage",
      blocks: [
        { type: "logoStrip",          note: "Client logos — logo_wall_light variant (full colour on white)" },
        { type: "featureGrid",        note: "Key capabilities — 3-col spacious grid (feature_grid_spacious variant)" },
        { type: "stats",              note: "Key metrics: clients served, uptime, NPS" },
        { type: "testimonialSection", note: "2–3 customer testimonials — clean card grid" },
        { type: "ctaSection",         note: "Soft, copy-led CTA — book a call or try free (cta_soft variant)" },
      ],
    },
    {
      slug:  "/services",
      title: "Services",
      blocks: [
        { type: "textSection",        note: "Services overview headline + intro paragraph" },
        { type: "featureGrid",        note: "Individual service areas: icons + short descriptions" },
        { type: "about",              note: "How we work — split-media methodology section" },
        { type: "testimonialSection", note: "Client testimonials relevant to services" },
        { type: "ctaSection",         note: "Start a conversation / schedule a call CTA" },
      ],
    },
    {
      slug:  "/cases",
      title: "Cases",
      blocks: [
        { type: "textSection",        note: "Cases intro — outcomes we deliver" },
        { type: "listing",            note: "Case study card listing (listing_cards variant)" },
        { type: "testimonialSection", note: "Short testimonials referencing outcomes" },
        { type: "ctaSection",         note: "Talk to us about your situation CTA" },
      ],
    },
    {
      slug:  "/pricing",
      title: "Pricing",
      blocks: [
        { type: "textSection",        note: "Pricing headline — transparent, value-focused" },
        { type: "pricingSection",     note: "Starter / Professional / Enterprise tiers" },
        { type: "faqSection",         note: "Pricing and billing FAQs" },
        { type: "testimonialSection", note: "One value/ROI testimonial" },
        { type: "ctaSection",         note: "Book a demo / talk to sales CTA" },
      ],
    },
    {
      slug:  "/contact",
      title: "Contact",
      blocks: [
        { type: "textSection",        note: "Contact headline + copy" },
        { type: "formSection",        note: "Contact form — form_split variant (details left, form right)" },
        { type: "contactSection",     note: "Office locations + contact details" },
        { type: "ctaSection",         note: "Book a call CTA" },
      ],
    },
  ],

  // ── Behavioral rules ────────────────────────────────────────────────────────

  rules: [
    {
      label:           "LinkedIn / professional source → Corporate authority proof",
      priority:        10,
      source:          "blueprint",
      precedenceLevel: "high_intent",
      condition: { type: "context", contextId: "ctx_linkedin_traffic" },
      plan: {
        heroKey:  "hero_direct_brand",
        proofKey: "proof_stats",
        ctaKey:   "cta_meeting",
        themeKey: "clean-corporate",
      },
      reason: "LinkedIn source signals a corporate professional — authority positioning with stats proof and meeting CTA.",
    },
    {
      label:           "Returning CTA-clicked visitor → Escalate to meeting",
      priority:        20,
      source:          "blueprint",
      precedenceLevel: "medium_segmentation",
      condition: { type: "context", contextId: "ctx_returning_cta_clicked" },
      plan: {
        heroKey:  "hero_consideration",
        proofKey: "proof_cases",
        ctaKey:   "cta_meeting",
        themeKey: "clean-corporate",
      },
      reason: "Returning visitor who previously engaged — escalate to direct meeting CTA with case-study credibility.",
    },
    {
      label:           "High-engagement visitor → Mid-funnel case proof + demo",
      priority:        30,
      source:          "blueprint",
      precedenceLevel: "medium_segmentation",
      condition: { type: "context", contextId: "ctx_high_engagement" },
      plan: {
        heroKey:  "hero_consideration",
        proofKey: "proof_cases",
        ctaKey:   "cta_demo",
        themeKey: "clean-corporate",
      },
      reason: "High-engagement visitor (3+ page views) — mid-funnel positioning with ROI proof and demo CTA.",
    },
  ],

  // ── Scoring rules ────────────────────────────────────────────────────────────

  scoringRules: [
    {
      key:           "cc_pricing_view",
      label:          "Pricing page view",
      event_type:    "page_view",
      event_value:   "/pricing",
      score:    40,
      decay_profile: "slow",
      priority:      1,
    },
    {
      key:           "cc_cases_view",
      label:          "Cases page view",
      event_type:    "page_view",
      event_value:   "/cases",
      score:    20,
      decay_profile: "slow",
      priority:      2,
    },
    {
      key:           "cc_contact_view",
      label:          "Contact page view",
      event_type:    "page_view",
      event_value:   "/contact",
      score:    30,
      decay_profile: "slow",
      priority:      3,
    },
    {
      key:           "cc_services_view",
      label:          "Services page view",
      event_type:    "page_view",
      event_value:   "/services",
      score:    15,
      decay_profile: "medium",
      priority:      4,
    },
    {
      key:           "cc_form_start",
      label:          "Form start",
      event_type:    "form_start",
      score:    15,
      decay_profile: "medium",
      priority:      5,
    },
    {
      key:           "cc_cta_click",
      label:          "CTA click",
      event_type:    "cta_click",
      score:    20,
      decay_profile: "slow",
      priority:      6,
    },
  ],

  // ── Sequence patterns ────────────────────────────────────────────────────────

  sequencePatterns: [
    {
      slug:            "cc_services_to_contact",
      label:           "Services → Contact (qualified lead)",
      sequence: [
        { event_type: "page_view", event_value: "/services" },
        { event_type: "page_view", event_value: "/contact" },
      ],
      max_gap_minutes: 30,
      score:           50,
    },
    {
      slug:            "cc_pricing_to_contact",
      label:           "Pricing → Contact (high intent)",
      sequence: [
        { event_type: "page_view", event_value: "/pricing" },
        { event_type: "page_view", event_value: "/contact" },
      ],
      max_gap_minutes: 20,
      score:           65,
    },
    {
      slug:            "cc_cases_to_pricing",
      label:           "Cases → Pricing (consideration)",
      sequence: [
        { event_type: "page_view", event_value: "/cases" },
        { event_type: "page_view", event_value: "/pricing" },
      ],
      max_gap_minutes: 30,
      score:           35,
    },
  ],
};
