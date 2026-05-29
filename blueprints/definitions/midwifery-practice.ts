/**
 * Midwifery Practice Blueprint
 *
 * A complete starting configuration for verloskunde practices, geboortezorg
 * providers, and related perinatal healthcare providers in the Netherlands.
 *
 * ─── Included pages ───────────────────────────────────────────────────────────
 *   / (homepage)       warm hero → care philosophy → services → team → CTA
 *   /zorg              care services: prenataal, bevalling, postnataal, echo
 *   /team              midwife profiles + specializations
 *   /praktijk          practical info: location, parking, verzekeringen, intake
 *   /contact           intake request form
 *
 * ─── Behavioral logic ────────────────────────────────────────────────────────
 *   Rule 1: Practical/contact page visitor         → intake registration CTA
 *   Rule 2: Care services visitor + returning      → warm service-specific CTA
 *   Rule 3: New visitor                            → care philosophy + gentle CTA
 *
 * ─── Scoring rules ────────────────────────────────────────────────────────────
 *   contact_view    +40  (registration intent)
 *   services_view   +20  (exploring care types)
 *   about_view      +15  (team/trust check)
 *   cta_click       +20
 *   form_start      +20  (very strong — registration started)
 *
 * ─── Theme recommendation ─────────────────────────────────────────────────────
 *   healthcare-calm — soft sage, warm whites, gentle typography
 */

import type { Blueprint } from "../blueprint-types";

export const midwiferyPracticeBlueprint: Blueprint = {
  key:             "midwifery_practice",
  name:            "Verloskunde Praktijk",
  description:     "Warm, trust-first setup for verloskunde practices and geboortezorg providers.",
  longDescription: "Designed for midwifery practices where emotional trust and clear information " +
                   "are the primary conversion factors. Expectant parents research care providers " +
                   "carefully; the experience guides them from first impression → care understanding " +
                   "→ intake registration. Behavioral gating is gentle: new visitors see the care " +
                   "philosophy first; warmer visitors see a direct intake CTA.",
  industry:        "healthcare",
  siteModels:      ["service"],
  tags:            ["midwifery", "healthcare", "verloskunde", "geboortezorg", "b2c", "zorg"],

  recommendedThemePreset: "healthcare-calm",
  recommendedThemeFamily: "Soft Care",

  // ── Pages ────────────────────────────────────────────────────────────────

  pages: [
    {
      slug:  "/",
      title: "Homepage",
      blocks: [
        { type: "hero",               note: "Warm, reassuring headline. E.g. 'Jouw zwangerschap, onze zorg.'" },
        { type: "featureGrid",        note: "Core care pillars: Prenatale zorg · Bevalling · Postnatale zorg · Echo" },
        { type: "testimonialSection", note: "2–3 parent testimonials (first-person, warm, outcome-focused)" },
        { type: "teamSection",        note: "Brief midwife introductions (photo + first name + specialization)" },
        { type: "textSection",        note: "Care philosophy: approach to personal, continuous care" },
        { type: "ctaSection",         note: "Meld je aan — intake registration CTA" },
      ],
    },
    {
      slug:  "/zorg",
      title: "Onze Zorg",
      blocks: [
        { type: "textSection",        note: "Care overview header: 'Begeleiding van begin tot eind'" },
        { type: "featureGrid",        note: "Detailed service pages: Prenataal · Bevalling thuis · Bevalling ziekenhuis · Postnataal · Echoscopie" },
        { type: "testimonialSection", note: "One parent quote relevant to each care moment" },
        { type: "ctaSection",         note: "Wil je meer weten? Neem contact op" },
      ],
    },
    {
      slug:  "/team",
      title: "Ons Team",
      blocks: [
        { type: "textSection",        note: "Team intro: continuous care model, who you'll meet" },
        { type: "teamSection",        note: "Full midwife profiles: photo, name, BIG-registratie, specialization" },
        { type: "ctaSection",         note: "Kom kennis maken — meet the team CTA" },
      ],
    },
    {
      slug:  "/praktijk",
      title: "Praktijkinfo",
      blocks: [
        { type: "textSection",        note: "Practical information: praktijkgebied (rayonkaart), verzekering, intake process" },
        { type: "featureGrid",        note: "Practical cards: bereikbaarheid · parkeren · bereikbaarheid buiten uren · verwijzingen" },
        { type: "ctaSection",         note: "Aanmelden voor de praktijk" },
      ],
    },
    {
      slug:  "/contact",
      title: "Contact & Aanmelding",
      blocks: [
        { type: "textSection",        note: "Contact header: 'Aanmelden of een vraag stellen'" },
        { type: "contactSection",     note: "Form: naam, e-mail, telefoon, uitgerekende datum, bericht + contactgegevens praktijk" },
      ],
    },
  ],

  // ── Behavioral rules ──────────────────────────────────────────────────────

  rules: [
    {
      priority: 10,
      label:    "Contact / Practical Info Visitor → Intake Registration CTA",
      reason:   "Visitor viewed practical info or contact page — registration intent. Surface intake CTA.",
      condition: {
        type:     "field",
        field:    "journey.hasVisitedContact",
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
      label:    "Returning Visitor → Warm Service CTA",
      reason:   "Returning visitor who has explored care services. Show direct intake CTA with warm proof.",
      condition: {
        type: "named",
        name: "returning_cta_clicked",
      },
      plan: {
        heroKey:  "hero_direct_brand",
        proofKey: "proof_cases",
        ctaKey:   "cta_meeting",
      },
    },
    {
      priority: 30,
      label:    "High-Engagement Visitor → Care + Intake CTA",
      reason:   "Visitor has read multiple care pages — genuine research. Surface registration CTA.",
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
      priority: 40,
      label:    "New Visitor → Care Philosophy First",
      reason:   "First-time visitor. Lead with care philosophy and team trust before any CTA.",
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
      key:           "contact_view",
      label:          "Contact / Aanmelding Page View",
      description:   "Visitor reached the contact or intake page — registration intent.",
      event_type:    "page_view",
      page_category: "contact",
      score:    40,
      decay_profile: "standard",
      priority:      10,
    },
    {
      key:           "services_view",
      label:          "Zorg / Services Page View",
      description:   "Visitor explored care services — active research into care options.",
      event_type:    "page_view",
      page_category: "services",
      score:    20,
      decay_profile: "standard",
      priority:      20,
    },
    {
      key:           "about_view",
      label:          "Team / Practical Info View",
      description:   "Visitor checked the team or practical info page — trust-building.",
      event_type:    "page_view",
      page_category: "about",
      score:    15,
      decay_profile: "standard",
      priority:      30,
    },
    {
      key:           "cta_click_score",
      label:          "CTA Click",
      description:   "Visitor clicked a call-to-action — engagement signal.",
      event_type:    "cta_click",
      score:    20,
      decay_profile: "standard",
      priority:      40,
    },
    {
      key:           "form_start_score",
      label:          "Intake Form Started",
      description:   "Visitor started the intake registration form — very strong signal.",
      event_type:    "form_start",
      score:    20,
      decay_profile: "standard",
      priority:      50,
    },
  ],

  // ── Sequence patterns ─────────────────────────────────────────────────────

  sequencePatterns: [
    {
      slug:            "zorg_to_contact",
      label:           "Zorg → Aanmelding",
      sequence: [
        { event_type: "page_view", page_category: "services" },
        { event_type: "page_view", page_category: "contact" },
      ],
      max_gap_minutes: 30,
      score:           40,
    },
    {
      slug:            "team_to_contact",
      label:           "Team → Aanmelding",
      sequence: [
        { event_type: "page_view", page_category: "about" },
        { event_type: "page_view", page_category: "contact" },
      ],
      max_gap_minutes: 30,
      score:           35,
    },
    {
      slug:            "full_care_journey",
      label:           "Zorg → Team → Aanmelding",
      sequence: [
        { event_type: "page_view", page_category: "services" },
        { event_type: "page_view", page_category: "about" },
        { event_type: "page_view", page_category: "contact" },
      ],
      max_gap_minutes: 60,
      score:           55,
    },
    {
      slug:            "cta_to_registration",
      label:           "CTA Click → Registration Form Start",
      sequence: [
        { event_type: "cta_click" },
        { event_type: "form_start" },
      ],
      max_gap_minutes: 10,
      score:           30,
    },
  ],
};
