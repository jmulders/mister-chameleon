/**
 * B2B SaaS Blueprint
 *
 * A complete starting configuration for B2B Software-as-a-Service products.
 *
 * ─── Included pages ───────────────────────────────────────────────────────────
 *   / (homepage)     hero → proof → features → CTA
 *   /pricing          pricing tiers → FAQ → CTA
 *   /about            mission + team
 *   /contact          contact form
 *
 * ─── Behavioral rules ─────────────────────────────────────────────────────────
 *   Rule 1: Pricing page visitor → demo CTA (high intent signal)
 *   Rule 2: Awareness visitor    → guide/resource CTA (nurture)
 *   Rule 3: Returning visitor    → case study proof + direct CTA
 *
 * ─── Scoring rules ────────────────────────────────────────────────────────────
 *   pricing_view     +40  (strong buying signal)
 *   case_view        +20  (consideration signal)
 *   contact_view     +30  (high intent)
 *   feature_page_view+10  (research signal)
 *   cta_click        +15  (engagement signal)
 *   form_start       +10  (commitment signal)
 *
 * ─── Theme recommendation ─────────────────────────────────────────────────────
 *   corporate-blue  — clean, professional, trust-building
 */

import type { Blueprint } from "../blueprint-types";

export const b2bSaasBlueprint: Blueprint = {
  key:              "b2b_saas",
  name:             "B2B SaaS",
  description:      "High-converting setup for B2B software products — demos, trials, enterprise leads.",
  longDescription:  "Optimized for SaaS businesses targeting enterprise or SMB buyers. Includes " +
                    "a proof-first homepage, pricing-intent detection, and progressive CTAs that " +
                    "escalate from awareness (guide) → consideration (case study) → intent (demo).",
  industry:         "b2b_saas",
  siteModels:       ["product-saas"],
  tags:             ["saas", "b2b", "lead-gen", "demos", "enterprise"],

  recommendedThemePreset: "corporate-blue",
  recommendedThemeFamily: "corporate-clean",

  // ── Pages ────────────────────────────────────────────────────────────────

  pages: [
    {
      slug:  "/",
      title: "Homepage",
      blocks: [
        { type: "hero",             note: "Problem → Solution hero with primary CTA" },
        { type: "logoStrip",        note: "Social proof: recognizable customer logos" },
        { type: "featureGrid",      note: "3–4 key product capabilities" },
        { type: "testimonialSection", note: "2–3 customer quotes with titles/companies" },
        { type: "stats",            note: "Key metrics: customers, uptime, NPS" },
        { type: "ctaSection",       note: "Bottom-of-page demo/trial CTA" },
      ],
    },
    {
      slug:  "/pricing",
      title: "Pricing",
      blocks: [
        { type: "textSection",      note: "Pricing header: simple headline + subheadline" },
        { type: "featureGrid",      note: "Pricing tier comparison (Starter / Growth / Pro)" },
        { type: "faqSection",       note: "Common pricing objections answered" },
        { type: "testimonialSection", note: "1 enterprise testimonial near bottom" },
        { type: "ctaSection",       note: "Talk to sales CTA" },
      ],
    },
    {
      slug:  "/about",
      title: "About",
      blocks: [
        { type: "textSection",      note: "Mission and founding story" },
        { type: "stats",            note: "Company milestones and team size" },
        { type: "teamSection",      note: "Leadership team photos + bios" },
        { type: "ctaSection",       note: "Join us / careers CTA" },
      ],
    },
    {
      slug:  "/contact",
      title: "Contact",
      blocks: [
        { type: "textSection",      note: "Contact header: 'Let\'s talk'" },
        { type: "contactSection",   note: "Contact form with name, email, company, message" },
      ],
    },
  ],

  // ── Behavioral rules ──────────────────────────────────────────────────────

  rules: [
    {
      priority: 10,
      label:    "Pricing Visitor → Demo CTA",
      reason:   "Visitor has viewed the pricing page — high purchase intent. Show demo CTA to convert.",
      condition: {
        type:     "field",
        field:    "journey.hasVisitedPricing",
        operator: "equals",
        value:    true,
      },
      plan: {
        heroKey:  "hero_direct_brand",
        proofKey: "proof_cases",
        ctaKey:   "cta_meeting",
      },
    },
    {
      priority: 20,
      label:    "High-Engagement Visitor → Cases Proof + Meeting CTA",
      reason:   "Highly-engaged visitor (3+ page views). Reinforce with case studies and direct CTA.",
      condition: {
        type: "named",
        name: "high_engagement",
      },
      plan: {
        heroKey:  "hero_direct_brand",
        proofKey: "proof_cases",
        ctaKey:   "cta_meeting",
      },
    },
    {
      priority: 30,
      label:    "Returning + Previously Clicked CTA → Platform Demo",
      reason:   "Returning visitor who already clicked a CTA. Push toward demo/platform.",
      condition: {
        type: "named",
        name: "returning_cta_clicked",
      },
      plan: {
        heroKey:  "hero_linkedin_vision",
        proofKey: "proof_platform",
        ctaKey:   "cta_platform",
      },
    },
    {
      priority: 40,
      label:    "Awareness (New Visitor) → Resource CTA",
      reason:   "First-time visitor. Offer a guide/resource to nurture and capture email.",
      condition: {
        type:     "field",
        field:    "visitType",
        operator: "equals",
        value:    "new",
      },
      plan: {
        heroKey:  "hero_google_problem",
        proofKey: "proof_vision",
        ctaKey:   "cta_guide",
      },
    },
  ],

  // ── Scoring rules ─────────────────────────────────────────────────────────

  scoringRules: [
    {
      key:           "pricing_view",
      label:          "Pricing Page View",
      description:   "Visitor viewed the pricing page — strong buying signal.",
      event_type:    "page_view",
      page_category: "pricing",
      score:    40,
      decay_profile: "standard",
      priority:      10,
    },
    {
      key:           "contact_view",
      label:          "Contact Page View",
      description:   "Visitor viewed the contact page — high intent.",
      event_type:    "page_view",
      page_category: "contact",
      score:    30,
      decay_profile: "standard",
      priority:      15,
    },
    {
      key:           "case_view",
      label:          "Case Study / Portfolio View",
      description:   "Visitor browsed customer cases — consideration stage signal.",
      event_type:    "page_view",
      page_category: "cases",
      score:    20,
      decay_profile: "standard",
      priority:      20,
    },
    {
      key:           "feature_page_view",
      label:          "Feature / Product Page View",
      description:   "Visitor browsed a feature or product detail page — research signal.",
      event_type:    "page_view",
      page_category: "features",
      score:    10,
      decay_profile: "standard",
      priority:      30,
    },
    {
      key:           "cta_click_score",
      label:          "CTA Click",
      description:   "Visitor clicked a call-to-action button.",
      event_type:    "cta_click",
      score:    15,
      decay_profile: "standard",
      priority:      40,
    },
    {
      key:           "form_start_score",
      label:          "Form Started",
      description:   "Visitor started filling in a form — commitment signal.",
      event_type:    "form_start",
      score:    10,
      decay_profile: "standard",
      priority:      50,
    },
  ],

  // ── Sequence patterns ─────────────────────────────────────────────────────

  sequencePatterns: [
    {
      slug:            "b2b_research_to_intent",
      label:           "Research → Pricing → Contact",
      sequence: [
        { event_type: "page_view", page_category: "features" },
        { event_type: "page_view", page_category: "pricing" },
        { event_type: "page_view", page_category: "contact" },
      ],
      max_gap_minutes: 60,
      score:           50,
    },
    {
      slug:            "b2b_cta_to_form",
      label:           "CTA Click → Form Start",
      sequence: [
        { event_type: "cta_click" },
        { event_type: "form_start" },
      ],
      max_gap_minutes: 10,
      score:           30,
    },
  ],
};
