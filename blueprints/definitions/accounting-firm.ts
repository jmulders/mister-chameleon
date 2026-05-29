/**
 * Accounting Firm Blueprint
 *
 * A complete starting configuration for accountants, auditors, tax advisors,
 * and financial consultancies.
 *
 * ─── Included pages ───────────────────────────────────────────────────────────
 *   / (homepage)       trust-first hero → services → social proof → CTA
 *   /diensten          service overview (tax, audit, payroll, advisory)
 *   /over-ons          firm story + team credentials
 *   /cases             client success stories / case studies
 *   /contact           contact form + office details
 *
 * ─── Behavioral logic ────────────────────────────────────────────────────────
 *   Rule 1: Contact or services page visitor        → appointment CTA
 *   Rule 2: Cases visitor + returning               → specific service CTA
 *   Rule 3: New visitor (awareness)                 → trust-building resource
 *
 * ─── Scoring rules ────────────────────────────────────────────────────────────
 *   contact_view    +35  (high intent — appointment seeking)
 *   services_view   +25  (research — evaluating firm)
 *   cases_view      +20  (consideration — building trust)
 *   about_view      +10  (mild interest — credential check)
 *   cta_click       +20  (strong engagement signal)
 *   form_start      +15  (commitment signal)
 *
 * ─── Theme recommendation ─────────────────────────────────────────────────────
 *   corporate-trust — authoritative navy, crisp white, trust-first typography
 */

import type { Blueprint } from "../blueprint-types";

export const accountingFirmBlueprint: Blueprint = {
  key:             "accounting_firm",
  name:            "Accounting Firm",
  description:     "Trust-first setup for accountants, tax advisors and financial consultancies.",
  longDescription: "Designed for professional service firms where trust and credentials sell. " +
                   "Leads visitors from credibility → proven results → appointment booking. " +
                   "Behaviorally adapts: new visitors get a nurture resource, warm leads get a " +
                   "direct call-to-action, returning contacts see service-specific CTAs.",
  industry:        "professional_services",
  siteModels:      ["service"],
  tags:            ["accounting", "tax", "audit", "professional-services", "b2b", "finance"],

  recommendedThemePreset: "corporate-trust",
  recommendedThemeFamily: "Corporate Trust",

  // ── Pages ────────────────────────────────────────────────────────────────

  pages: [
    {
      slug:  "/",
      title: "Homepage",
      blocks: [
        { type: "hero",               note: "Headline: credibility + clear value proposition" },
        { type: "logoStrip",          note: "Client logos or association memberships (NBA, RB, etc.)" },
        { type: "featureGrid",        note: "Core services: Belastingadvies, Jaarrekening, Loonadministratie, Advies" },
        { type: "testimonialSection", note: "2–3 client testimonials with industry / company type" },
        { type: "stats",              note: "X jaar ervaring · X klanten · X% tevredenheid" },
        { type: "ctaSection",         note: "Maak een afspraak — appointment booking CTA" },
      ],
    },
    {
      slug:  "/diensten",
      title: "Diensten",
      blocks: [
        { type: "textSection",        note: "Services overview header" },
        { type: "featureGrid",        note: "Detailed breakdown: Tax, Audit, Payroll, Advisory, Incorporation" },
        { type: "testimonialSection", note: "Short trust testimonial per service cluster" },
        { type: "ctaSection",         note: "Vraag een kennismakingsgesprek aan" },
      ],
    },
    {
      slug:  "/over-ons",
      title: "Over Ons",
      blocks: [
        { type: "textSection",        note: "Firm story: founding year, mission, values" },
        { type: "teamSection",        note: "Partner / advisor profiles with credentials (RA, AA, RB)" },
        { type: "stats",              note: "Key firm stats: years active, client count, team size" },
        { type: "ctaSection",         note: "Kom kennismaken CTA" },
      ],
    },
    {
      slug:  "/cases",
      title: "Klantcases",
      blocks: [
        { type: "textSection",        note: "Header: how we help clients achieve their goals" },
        { type: "caseGrid",           note: "3–6 case study cards by sector (MKB, ZZP, Scale-up)" },
        { type: "ctaSection",         note: "Herken je dit? Neem contact op" },
      ],
    },
    {
      slug:  "/contact",
      title: "Contact",
      blocks: [
        { type: "textSection",        note: "Contact header: 'Maak een afspraak'" },
        { type: "contactSection",     note: "Form: naam, e-mail, telefoonnummer, bericht + kantoorgegevens" },
      ],
    },
  ],

  // ── Behavioral rules ──────────────────────────────────────────────────────

  rules: [
    {
      priority: 10,
      label:    "Contact Page Visitor → Appointment CTA",
      reason:   "Visitor reached the contact page — strong appointment intent. Show direct booking CTA.",
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
      label:    "Services Page Visitor → Appointment CTA",
      reason:   "Visitor is evaluating your services. Surface a direct appointment CTA to convert research intent.",
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
      label:    "Returning Visitor → Cases Proof + Direct CTA",
      reason:   "Returning visitor — reinforce trust with case studies before the direct CTA.",
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
      label:    "New Visitor (Awareness) → Trust Resource",
      reason:   "First-time visitor. Offer a guide or checklist to nurture before pushing for an appointment.",
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
      description:   "Visitor reached the contact page — appointment intent.",
      event_type:    "page_view",
      page_category: "contact",
      score:    35,
      decay_profile: "standard",
      priority:      10,
    },
    {
      key:           "services_view",
      label:          "Services Page View",
      description:   "Visitor evaluated the services page — active research.",
      event_type:    "page_view",
      page_category: "services",
      score:    25,
      decay_profile: "standard",
      priority:      20,
    },
    {
      key:           "cases_view",
      label:          "Case Study View",
      description:   "Visitor browsed client cases — trust-building phase.",
      event_type:    "page_view",
      page_category: "cases",
      score:    20,
      decay_profile: "standard",
      priority:      25,
    },
    {
      key:           "about_view",
      label:          "About / Over Ons View",
      description:   "Visitor checked credentials and team — mild interest signal.",
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
      label:          "Contact Form Started",
      description:   "Visitor began filling in the contact form — high commitment.",
      event_type:    "form_start",
      score:    15,
      decay_profile: "standard",
      priority:      50,
    },
  ],

  // ── Sequence patterns ─────────────────────────────────────────────────────

  sequencePatterns: [
    {
      slug:            "services_to_contact",
      label:           "Services → Contact",
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
      slug:            "research_journey",
      label:           "Services → Cases → Contact",
      sequence: [
        { event_type: "page_view", page_category: "services" },
        { event_type: "page_view", page_category: "cases" },
        { event_type: "page_view", page_category: "contact" },
      ],
      max_gap_minutes: 60,
      score:           55,
    },
    {
      slug:            "cta_to_form",
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
