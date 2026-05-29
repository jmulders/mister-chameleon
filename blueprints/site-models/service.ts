/**
 * Service Site Model
 *
 * The site model for service-oriented businesses: marketing agencies,
 * consulting firms, IT services, accounting and law practices, and any
 * B2B company whose primary conversion is an inquiry or discovery call.
 *
 * ─── Page structure ───────────────────────────────────────────────────────────
 *
 *   /              homepage   — Hero → stats → service grid → testimonials → CTA
 *   /diensten      overview   — Service catalogue with card-per-service layout
 *   /cases         overview   — Client case study grid
 *   /over-ons      process    — Agency/firm story, team, how-we-work
 *   /contact       form       — Discovery call / project enquiry form
 *
 * ─── Behavioral logic ────────────────────────────────────────────────────────
 *
 *   Rule 1 (priority 10): Contact page visitor     → direct discovery CTA
 *   Rule 2 (priority 20): High-engagement (3+ pg)  → direct pitch CTA
 *   Rule 3 (priority 30): Cases visitor + returning → proof-forward CTA
 *   Rule 4 (priority 40): New visitor               → results resource CTA
 *
 * ─── Scoring rules ────────────────────────────────────────────────────────────
 *   contact_view   +35  (high-intent signal for service sites)
 *   cases_view     +25  (evaluating results → consideration)
 *   services_view  +20  (exploring the offering)
 *   about_view     +10  (credentials check)
 *   cta_click      +20
 *   form_start     +15
 *
 * ─── Compatible theme families ───────────────────────────────────────────────
 *   Corporate Trust, Editorial Authority, Bold Conversion
 */

import type { SiteModel } from "./types";

export const SERVICE_MODEL: SiteModel = {
  key:         "service",
  label:       "Service Site",
  description: "Agency, consulting, and professional-services sites whose conversion is an inquiry or discovery call.",
  longDescription:
    "Best for marketing agencies, IT consultancies, accounting firms, law practices, and any B2B " +
    "service business where leads convert via discovery calls or project enquiries. " +
    "Includes a service catalogue, client cases, and a contact page — all wired with lead-qualification " +
    "behavioral rules and engagement-based scoring.",
  icon:        "🏢",
  industries:  ["lead_gen", "professional_services", "b2b_saas"],

  suggestedThemeFamilies: ["Corporate Trust", "Editorial Authority", "Bold Conversion"],

  // ── Pages ──────────────────────────────────────────────────────────────────

  pages: [
    {
      pageTypeKey: "homepage",
      slug:        "/",
      title:       "Homepage",
      noteOverrides: {
        hero:               "Bold headline stating core value proposition. Primary CTA: 'Plan een kennismakingsgesprek' or 'Bekijk onze diensten'.",
        logoStrip:          "Klantlogo's: bekende merken uit jouw sector (zorg, tech, retail, MKB).",
        stats:              "Impact-cijfers: klanten bediend · projecten gedraaid · jaar(en) actief.",
        featureGrid:        "Diensten-overzicht: 4–6 kaarten per dienstcluster met korte omschrijving.",
        testimonialSection: "2–3 klantquotes met naam, functie, bedrijf en concreet resultaat.",
        ctaSection:         "Klaar om te starten? Plan een gratis kennismakingsgesprek — conversion CTA.",
      },
    },
    {
      pageTypeKey: "overview",
      slug:        "/diensten",
      title:       "Diensten",
      noteOverrides: {
        textSection: "Dienstenpagina-header: 'Van strategie tot resultaat — alles onder één dak'. Introductie van het dienstenaanbod.",
        cardGrid:    "Uitgebreide dienstenkaarten: één kaart per dienstcluster met icon, titel, omschrijving en 'Meer info'-link.",
        ctaSection:  "Benieuwd wat wij voor jou kunnen betekenen? Neem contact op.",
      },
    },
    {
      pageTypeKey: "overview",
      slug:        "/cases",
      title:       "Cases",
      noteOverrides: {
        textSection: "Cases-header: 'Onze resultaten spreken voor zich'. Nadruk op aantoonbare, meetbare resultaten.",
        cardGrid:    "4–6 casekaarten: klant · uitdaging · aanpak · resultaat (meetbaar: +X% conversie, -Y% kosten).",
        ctaSection:  "Wil jij zulke resultaten? Plan een groeigesprek.",
      },
    },
    {
      pageTypeKey: "process",
      slug:        "/over-ons",
      title:       "Over Ons",
      noteOverrides: {
        textSection:  "Bureau- of kantoorverhaal: oprichting, missie, aanpak en wat jullie onderscheidt.",
        stepsSection: "Werkwijze in 3–4 stappen: intake → analyse → uitvoering → resultaat.",
        faqSection:   "Veelgestelde vragen over samenwerking, tarieven, doorlooptijd.",
        ctaSection:   "Kom kennis maken — friendly CTA voor nieuw contact.",
      },
      extraBlocks: [
        {
          type: "teamSection",
          note: "Teamprofielen: foto, naam, expertise, en een persoonlijke noot per persoon.",
        },
      ],
    },
    {
      pageTypeKey: "form",
      slug:        "/contact",
      title:       "Contact",
      noteOverrides: {
        textSection:    "Contact-header: 'Vertel ons over jouw vraagstuk'. Geef aan wat er na het versturen van het formulier gebeurt.",
        contactSection: "Formulier: naam, bedrijf, e-mail, telefoon, type vraag (dropdown), bericht + kantoorgegevens / kaart.",
        logoStrip:      "Klantlogo's of certificeringen onder het formulier als vertrouwenssignaal.",
      },
    },
  ],

  // ── Behavioral rules ──────────────────────────────────────────────────────

  rules: [
    {
      priority: 10,
      label:    "Contact Page Visitor → Discovery CTA",
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
      label:    "Returning + Cases Visited → Proof-Forward CTA",
      reason:   "Terugkerende bezoeker die cases bekeek. Versterk met proof en directe CTA.",
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
      reason:   "Eerste bezoek. Bied een gratis resource aan om te nurture.",
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
      slug:            "full_evaluation",
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
