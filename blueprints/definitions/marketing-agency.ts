/**
 * Marketing Agency Blueprint — Flagship Demo
 *
 * A complete starting configuration for marketing agencies, creative studios,
 * growth consultancies, and digital agencies.
 *
 * This blueprint is the FLAGSHIP DEMO for Mister Chameleon's own website.
 * It uses real Dutch copy structured for a conversion-focused marketing agency
 * and ships with 5 scenario presets to demonstrate behavioral adaptation live.
 *
 * ─── Included pages ───────────────────────────────────────────────────────────
 *   / (homepage)       bold hero → results proof → services → cases → CTA
 *   /diensten          service breakdown: strategy, campaigns, content, performance
 *   /cases             client case studies with measurable outcomes
 *   /over-ons          agency story + team + culture
 *   /contact           discovery session request form
 *
 * ─── Behavioral logic ────────────────────────────────────────────────────────
 *   Rule 1: Pricing / contact page visitor          → direct discovery CTA
 *   Rule 2: Cases visitor + returning               → outcome-proof + CTA
 *   Rule 3: High-engagement (3+ pages)              → direct pitch CTA
 *   Rule 4: New visitor                             → results resource / guide
 *
 * ─── Scoring rules ────────────────────────────────────────────────────────────
 *   contact_view    +35
 *   cases_view      +25  (strong for agencies — clients evaluate results)
 *   services_view   +20
 *   about_view      +10
 *   cta_click       +20
 *   form_start      +15
 *
 * ─── Theme recommendation ─────────────────────────────────────────────────────
 *   bold-marketing — vivid pink/coral accent, confident type, conversion-forward
 *
 * ─── Scenario presets ────────────────────────────────────────────────────────
 *   new_visitor         — First touch, sees default awareness experience
 *   warm_lead           — Visited cases + services, considering agency
 *   hot_lead            — Visited contact, CTA clicked, form started
 *   returning_client    — Existing client returning for expansion
 *   high_friction       — Bounce-prone, noise-heavy session
 */

import type { Blueprint } from "../blueprint-types";

export const marketingAgencyBlueprint: Blueprint = {
  key:             "marketing_agency",
  name:            "Marketing Agency",
  description:     "Resultaatgericht startpunt voor marketing- en groeibureaus. Flagship demo met echte Nederlandse copy.",
  longDescription: "Ontworpen voor bureaus waarbij resultaten de belangrijkste overtuigingsfactor zijn. " +
                   "Bezoekers vergelijken bureaus zorgvuldig — de experience begeleidt ze van eerste indruk " +
                   "naar bewijs van resultaten naar een concreet kennismakingsgesprek. " +
                   "Gedragsadaptatie: nieuwe bezoekers zien eerst resultaten, warme leads een directe CTA.",
  industry:        "lead_gen",
  siteModels:      ["service"],
  tags:            ["marketing", "agency", "creative", "growth", "performance", "lead-gen", "b2b"],

  recommendedThemePreset: "bold-marketing",
  recommendedThemeFamily: "Bold Conversion",

  // ── Pages ────────────────────────────────────────────────────────────────

  pages: [
    {
      slug:  "/",
      title: "Homepage",
      blocks: [
        {
          type: "hero",
          note: "Bold headline: 'Marketing die werkt. Aantoonbaar.' — primary CTA: Plan een groeigesprek",
        },
        {
          type: "logoStrip",
          note: "Klantlogo's: bekende merken of sectornamen (zorg, tech, retail, MKB)",
        },
        {
          type: "stats",
          note: "Impactcijfers: +247% organisch verkeer · €2.4M gegenereerde omzet · 38 actieve klanten",
        },
        {
          type: "featureGrid",
          note: "Diensten: Strategie & Positionering · Campagnes · Content & SEO · Performance Marketing",
        },
        {
          type: "testimonialSection",
          note: "2–3 klantquotes met naam, functie, bedrijf en concreet resultaat",
        },
        {
          type: "ctaSection",
          note: "Klaar om te groeien? Plan een groeigesprek — bold conversion CTA",
        },
      ],
    },
    {
      slug:  "/diensten",
      title: "Diensten",
      blocks: [
        {
          type: "textSection",
          note: "Dienstenpagina header: 'Van strategie tot resultaat — alles onder één dak'",
        },
        {
          type: "featureGrid",
          note: "Uitgebreide dienstenkaarten: Merkstrategie · SEA/SEO · Social Media · E-mail · Contentmarketing · Analytics",
        },
        {
          type: "testimonialSection",
          note: "Klantquote per dienstcluster",
        },
        {
          type: "ctaSection",
          note: "Benieuwd wat wij voor jou kunnen betekenen? Neem contact op",
        },
      ],
    },
    {
      slug:  "/cases",
      title: "Cases",
      blocks: [
        {
          type: "textSection",
          note: "Cases header: 'Onze resultaten spreken voor zich' — aantoonbaar, concreet",
        },
        {
          type: "caseGrid",
          note: "4–6 casekaarten: klant · uitdaging · aanpak · resultaat (meetbaar: +X% conversie, -Y% kosten)",
        },
        {
          type: "ctaSection",
          note: "Wil jij zulke resultaten? Plan een groeigesprek",
        },
      ],
    },
    {
      slug:  "/over-ons",
      title: "Over Ons",
      blocks: [
        {
          type: "textSection",
          note: "Bureau-verhaal: oprichting, missie ('marketing zonder bullshit'), aanpak",
        },
        {
          type: "teamSection",
          note: "Teamprofielen: foto, naam, expertise, persoonlijke noot",
        },
        {
          type: "stats",
          note: "Jaren actief · campagnes gedraaid · klanten bediend",
        },
        {
          type: "ctaSection",
          note: "Kom kennis maken — friendly CTA",
        },
      ],
    },
    {
      slug:  "/contact",
      title: "Contact",
      blocks: [
        {
          type: "textSection",
          note: "Contact header: 'Vertel ons over jouw groeivraagstuk'",
        },
        {
          type: "contactSection",
          note: "Formulier: naam, bedrijf, e-mail, telefoon, maandelijks marketingbudget (dropdown), groeivraag + kantoorgegevens",
        },
      ],
    },
  ],

  // ── Behavioral rules ──────────────────────────────────────────────────────

  rules: [
    {
      priority: 10,
      label:    "Contact Page Visitor → Discovery Session CTA",
      reason:   "Bezoeker heeft de contactpagina bekeken — sterke intentie. Toon directe CTA voor kennismakingsgesprek.",
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
      label:    "High-Engagement Visitor → Direct Pitch CTA",
      reason:   "Bezoeker heeft meerdere pagina's bekeken — actieve evaluatie. Toon directe pitch CTA.",
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
      label:    "Returning + CTA Clicked → Platform/Agency Demo CTA",
      reason:   "Terugkerende bezoeker die al een CTA klikte — hoge aankoopgereedheid. Toon agency-demo CTA.",
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
      label:    "New Visitor → Results Resource CTA",
      reason:   "Eerste bezoek. Bied een gratis resource aan (bijv. groeiscan of whitepaper) om te nurture.",
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
      label:          "Contact / Discovery Page View",
      description:   "Bezoeker bekijkt de contactpagina — hoge intentie voor kennismakingsgesprek.",
      event_type:    "page_view",
      page_category: "contact",
      score:    35,
      decay_profile: "standard",
      priority:      10,
    },
    {
      key:           "cases_view",
      label:          "Cases Page View",
      description:   "Bezoeker bekijkt klantcases — resultaten vergelijken, sterke overweginsgfase.",
      event_type:    "page_view",
      page_category: "cases",
      score:    25,
      decay_profile: "standard",
      priority:      15,
    },
    {
      key:           "services_view",
      label:          "Diensten Page View",
      description:   "Bezoeker evalueert het dienstenaanbod — actief onderzoek.",
      event_type:    "page_view",
      page_category: "services",
      score:    20,
      decay_profile: "standard",
      priority:      20,
    },
    {
      key:           "about_view",
      label:          "Over Ons / Team View",
      description:   "Bezoeker bekijkt het bureau en team — mild interesse, credentialscheck.",
      event_type:    "page_view",
      page_category: "about",
      score:    10,
      decay_profile: "standard",
      priority:      30,
    },
    {
      key:           "cta_click_score",
      label:          "CTA Klik",
      description:   "Bezoeker klikte een call-to-action — sterke betrokkenheid.",
      event_type:    "cta_click",
      score:    20,
      decay_profile: "standard",
      priority:      40,
    },
    {
      key:           "form_start_score",
      label:          "Contactformulier Gestart",
      description:   "Bezoeker begon het contactformulier in te vullen — hoge commitment.",
      event_type:    "form_start",
      score:    15,
      decay_profile: "standard",
      priority:      50,
    },
  ],

  // ── Sequence patterns ─────────────────────────────────────────────────────

  sequencePatterns: [
    {
      slug:            "cases_to_contact",
      label:           "Cases → Contact",
      sequence: [
        { event_type: "page_view", page_category: "cases" },
        { event_type: "page_view", page_category: "contact" },
      ],
      max_gap_minutes: 30,
      score:           40,
    },
    {
      slug:            "services_to_contact",
      label:           "Diensten → Contact",
      sequence: [
        { event_type: "page_view", page_category: "services" },
        { event_type: "page_view", page_category: "contact" },
      ],
      max_gap_minutes: 30,
      score:           35,
    },
    {
      slug:            "full_agency_evaluation",
      label:           "Cases → Diensten → Contact",
      sequence: [
        { event_type: "page_view", page_category: "cases" },
        { event_type: "page_view", page_category: "services" },
        { event_type: "page_view", page_category: "contact" },
      ],
      max_gap_minutes: 60,
      score:           55,
    },
    {
      slug:            "cta_to_form",
      label:           "CTA Klik → Formulier Start",
      sequence: [
        { event_type: "cta_click" },
        { event_type: "form_start" },
      ],
      max_gap_minutes: 10,
      score:           30,
    },
  ],
};
