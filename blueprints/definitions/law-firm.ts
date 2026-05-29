/**
 * Law Firm Blueprint
 *
 * A complete starting configuration for law firms, legal advisors, and
 * specialized legal practices (family law, employment, corporate, etc.).
 *
 * ─── Included pages ───────────────────────────────────────────────────────────
 *   / (homepage)       authority hero → practice areas → credentials → CTA
 *   /praktijkgebieden  practice area overview with specializations
 *   /over-ons          firm story + lawyer profiles with bar membership
 *   /cases             anonymized case outcomes + track record
 *   /contact           consultation request form + office details
 *
 * ─── Behavioral logic ────────────────────────────────────────────────────────
 *   Rule 1: Contact or high-intent visitor         → consult CTA (urgency)
 *   Rule 2: Returning visitor who clicked CTA      → specific practice area CTA
 *   Rule 3: New visitor browsing practice areas    → credential proof + soft CTA
 *   Rule 4: Awareness visitor                      → guide download (legal checklist)
 *
 * ─── Scoring rules ────────────────────────────────────────────────────────────
 *   contact_view          +35  (consultation intent)
 *   practice_areas_view   +25  (evaluating fit — active research)
 *   cases_view            +20  (trust-building)
 *   about_view            +10  (credential check)
 *   cta_click             +20
 *   form_start            +15
 *
 * ─── Theme recommendation ─────────────────────────────────────────────────────
 *   corporate-trust — authoritative navy, disciplined grid, trust-forward
 */

import type { Blueprint } from "../blueprint-types";

export const lawFirmBlueprint: Blueprint = {
  key:             "law_firm",
  name:            "Law Firm",
  description:     "Authority-first setup for law firms and legal advisors — from consultation request to case win.",
  longDescription: "Built for legal practices where trust and expertise are the primary conversion drivers. " +
                   "Visitors arrive with a problem (often urgent); the experience guides them from " +
                   "credibility → proven results → consultation booking. Behavioral gating escalates " +
                   "from soft resource downloads for new visitors to direct consultation CTAs for warm leads.",
  industry:        "professional_services",
  siteModels:      ["service"],
  tags:            ["law", "legal", "advocatenkantoor", "professional-services", "b2b", "b2c"],

  recommendedThemePreset: "corporate-trust",
  recommendedThemeFamily: "Corporate Trust",

  // ── Pages ────────────────────────────────────────────────────────────────

  pages: [
    {
      slug:  "/",
      title: "Homepage",
      blocks: [
        { type: "hero",               note: "Headline: specific outcome (not 'wij zijn advocaten'). E.g. 'Uw recht, onze zaak.'" },
        { type: "logoStrip",          note: "Notable case wins, accreditations, or associations (NOvA, etc.)" },
        { type: "featureGrid",        note: "Practice areas: Familierecht, Arbeidsrecht, Ondernemingsrecht, etc." },
        { type: "testimonialSection", note: "2–3 client testimonials (outcome-focused, anonymized)" },
        { type: "stats",              note: "X jaar ervaring · X zaken gewonnen · X advocaten" },
        { type: "ctaSection",         note: "Vraag een intakegesprek aan — primary CTA" },
      ],
    },
    {
      slug:  "/praktijkgebieden",
      title: "Praktijkgebieden",
      blocks: [
        { type: "textSection",        note: "Overview header: 'Wij staan u bij in elk rechtsgebied'" },
        { type: "featureGrid",        note: "Expanded practice area cards with short case type descriptions" },
        { type: "testimonialSection", note: "One relevant quote per practice area cluster" },
        { type: "ctaSection",         note: "Neem contact op voor uw situatie" },
      ],
    },
    {
      slug:  "/over-ons",
      title: "Over Ons",
      blocks: [
        { type: "textSection",        note: "Firm story: founding year, specialization, values" },
        { type: "teamSection",        note: "Advocate profiles: specialization, bar membership, cases handled" },
        { type: "stats",              note: "Practice longevity, cases handled, win rate" },
        { type: "ctaSection",         note: "Maak kennis met ons team" },
      ],
    },
    {
      slug:  "/zaken",
      title: "Onze Zaken",
      blocks: [
        { type: "textSection",        note: "Track record header: proven expertise, anonymized case summaries" },
        { type: "caseGrid",           note: "3–6 case cards: situation → approach → outcome (fully anonymized)" },
        { type: "ctaSection",         note: "Staat uw situatie er niet bij? Neem toch contact op" },
      ],
    },
    {
      slug:  "/contact",
      title: "Contact",
      blocks: [
        { type: "textSection",        note: "Contact header: 'Vertel ons over uw situatie'" },
        { type: "contactSection",     note: "Form: naam, e-mail, telefoon, rechtsgebied (dropdown), bericht + kantoorinfo" },
      ],
    },
  ],

  // ── Behavioral rules ──────────────────────────────────────────────────────

  rules: [
    {
      priority: 10,
      label:    "Contact Page Visitor → Consultation CTA",
      reason:   "Visitor reached the contact page — strong intent to request a consultation. Surface urgent booking CTA.",
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
      label:    "High-Engagement Visitor → Direct Consultation CTA",
      reason:   "Visitor has viewed multiple pages (practice areas + about/cases). Warm lead — push for consultation.",
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
      label:    "Returning Visitor → Practice Area + CTA",
      reason:   "Returning visitor who has already explored the firm. Reinforce expertise and push direct consultation.",
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
      priority: 40,
      label:    "New Visitor → Legal Guide CTA",
      reason:   "First-time visitor exploring their options. Offer a free legal guide to nurture and capture contact.",
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
      label:          "Contact Page View",
      description:   "Visitor reached the contact/intake page — consultation intent.",
      event_type:    "page_view",
      page_category: "contact",
      score:    35,
      decay_profile: "standard",
      priority:      10,
    },
    {
      key:           "practice_areas_view",
      label:          "Practice Areas Page View",
      description:   "Visitor evaluated practice areas — evaluating fit, active research.",
      event_type:    "page_view",
      page_category: "services",
      score:    25,
      decay_profile: "standard",
      priority:      20,
    },
    {
      key:           "cases_view",
      label:          "Case Overview View",
      description:   "Visitor browsed case outcomes — trust-building, consideration stage.",
      event_type:    "page_view",
      page_category: "cases",
      score:    20,
      decay_profile: "standard",
      priority:      25,
    },
    {
      key:           "about_view",
      label:          "About / Team View",
      description:   "Visitor checked lawyer credentials and firm story.",
      event_type:    "page_view",
      page_category: "about",
      score:    10,
      decay_profile: "standard",
      priority:      30,
    },
    {
      key:           "cta_click_score",
      label:          "CTA Click",
      description:   "Visitor clicked a call-to-action — strong engagement.",
      event_type:    "cta_click",
      score:    20,
      decay_profile: "standard",
      priority:      40,
    },
    {
      key:           "form_start_score",
      label:          "Intake Form Started",
      description:   "Visitor started the intake / contact form — high commitment signal.",
      event_type:    "form_start",
      score:    15,
      decay_profile: "standard",
      priority:      50,
    },
  ],

  // ── Sequence patterns ─────────────────────────────────────────────────────

  sequencePatterns: [
    {
      slug:            "practice_to_contact",
      label:           "Practice Areas → Contact",
      sequence: [
        { event_type: "page_view", page_category: "services" },
        { event_type: "page_view", page_category: "contact" },
      ],
      max_gap_minutes: 30,
      score:           40,
    },
    {
      slug:            "cases_to_contact",
      label:           "Cases → Contact",
      sequence: [
        { event_type: "page_view", page_category: "cases" },
        { event_type: "page_view", page_category: "contact" },
      ],
      max_gap_minutes: 45,
      score:           35,
    },
    {
      slug:            "full_legal_research_journey",
      label:           "Practice → Cases → Contact",
      sequence: [
        { event_type: "page_view", page_category: "services" },
        { event_type: "page_view", page_category: "cases" },
        { event_type: "page_view", page_category: "contact" },
      ],
      max_gap_minutes: 60,
      score:           55,
    },
    {
      slug:            "cta_to_intake",
      label:           "CTA Click → Intake Form Start",
      sequence: [
        { event_type: "cta_click" },
        { event_type: "form_start" },
      ],
      max_gap_minutes: 10,
      score:           30,
    },
  ],
};
