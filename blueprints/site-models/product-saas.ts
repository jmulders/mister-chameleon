/**
 * Product / SaaS Site Model
 *
 * The site model for software products and B2B SaaS businesses where
 * the primary conversions are free-trial sign-ups or demo requests.
 *
 * ─── Page structure ───────────────────────────────────────────────────────────
 *
 *   /          homepage   — Hero → social proof → features → pricing teaser → CTA
 *   /features  overview   — Full feature catalogue with use-case cards
 *   /pricing   form       — Pricing tiers + FAQ + CTA per tier
 *   /about     process    — Company story, team, mission
 *   /contact   form       — Demo request / sales contact form
 *
 * ─── Behavioral logic ────────────────────────────────────────────────────────
 *
 *   Rule 1 (priority 10): Pricing page visitor        → demo / trial CTA
 *   Rule 2 (priority 20): Contact page visitor         → direct sales CTA
 *   Rule 3 (priority 30): Feature page + returning     → product-deep CTA
 *   Rule 4 (priority 40): New visitor                  → awareness/trial CTA
 *
 * ─── Scoring rules ────────────────────────────────────────────────────────────
 *   pricing_view   +40  (strongest signal for SaaS — evaluating cost/value)
 *   contact_view   +30
 *   feature_view   +15
 *   about_view     +10
 *   cta_click      +20
 *   form_start     +15
 *
 * ─── Compatible theme families ───────────────────────────────────────────────
 *   Tech Clarity, Bold Conversion, Corporate Trust
 */

import type { SiteModel } from "./types";

export const PRODUCT_SAAS_MODEL: SiteModel = {
  key:         "product-saas",
  label:       "Product / SaaS",
  description: "Software product and B2B SaaS sites converting visitors to free-trial or demo.",
  longDescription:
    "Designed for cloud products, developer tools, and B2B SaaS platforms. " +
    "Pricing page signals are weighted highest — visitors who check pricing are " +
    "closest to a buying decision. Supports both self-serve (free trial) and " +
    "sales-assisted (demo request) conversion paths.",
  icon:        "💡",
  industries:  ["b2b_saas"],

  suggestedThemeFamilies: ["Tech Clarity", "Bold Conversion", "Corporate Trust"],

  // ── Pages ──────────────────────────────────────────────────────────────────

  pages: [
    {
      pageTypeKey: "homepage",
      slug:        "/",
      title:       "Homepage",
      noteOverrides: {
        hero:               "Product headline: clear value statement + primary CTA ('Start gratis' or 'Plan een demo'). Sub-headline describes the key outcome.",
        logoStrip:          "Klantlogo's: herkenbare bedrijven die het product gebruiken.",
        stats:              "Product-metrics: gebruikers · integraties · uptime · tijd tot eerste waarde.",
        featureGrid:        "Kernfunctionaliteiten: 4–6 kaarten met icon, functienaam en één-zin voordeel.",
        testimonialSection: "Klantquotes: naam, rol, bedrijf. Focus op concrete uitkomst ('50% minder handmatig werk').",
        ctaSection:         "Probeer gratis of plan een demo — dual CTA (primary: trial, secondary: demo).",
      },
    },
    {
      pageTypeKey: "overview",
      slug:        "/features",
      title:       "Features",
      noteOverrides: {
        textSection: "Features-header: 'Alles wat je nodig hebt — niets wat je niet nodig hebt.' Korte positionering.",
        cardGrid:    "Feature-kaarten per use case: titel, korte omschrijving, screenshot/icon, en 'Meer info'-link.",
        ctaSection:  "Klaar om te starten? Probeer 14 dagen gratis.",
      },
    },
    {
      pageTypeKey: "form",
      slug:        "/pricing",
      title:       "Prijzen",
      noteOverrides: {
        textSection:    "Pricing-header: 'Transparante prijzen — geen verborgen kosten.' Positioneer de waarde vóór de prijs.",
        contactSection: "Pricing tiers: 2–3 plannen (Starter / Pro / Enterprise) met feature-vergelijking en CTA per tier.",
        logoStrip:      "Klantlogo's of testimonial onder pricing als twijfel-breaker.",
      },
      extraBlocks: [
        {
          type: "faqSection",
          note: "Pricing FAQ: 4–6 vragen over contracten, opzeggen, migratie, support.",
        },
      ],
    },
    {
      pageTypeKey: "process",
      slug:        "/about",
      title:       "Over Ons",
      noteOverrides: {
        textSection:  "Bedrijfsverhaal: waarom dit product gebouwd is, welk probleem het oplost.",
        stepsSection: "Product-roadmap of bouwproces: hoe we van idee naar product zijn gegaan.",
        faqSection:   "Veelgestelde vragen over het bedrijf, de stack, security, privacy.",
        ctaSection:   "Kom in contact — friendly CTA voor kandidaten, partners en pers.",
      },
      extraBlocks: [
        {
          type: "teamSection",
          note: "Founding team: foto, naam, achtergrond, LinkedIn.",
        },
      ],
    },
    {
      pageTypeKey: "form",
      slug:        "/contact",
      title:       "Demo Aanvragen",
      noteOverrides: {
        textSection:    "Demo-header: 'Zien hoe het werkt? Plan een persoonlijke demo.' Geef aan wat er na aanmelding gebeurt (reactietijd, agenda-link).",
        contactSection: "Demo-formulier: naam, e-mail, bedrijf, teamgrootte (dropdown), gebruiksscenario, gewenste datum.",
        logoStrip:      "Klantlogo's of 'Vertrouwd door X+ bedrijven' onder het formulier.",
      },
    },
  ],

  // ── Behavioral rules ──────────────────────────────────────────────────────

  rules: [
    {
      priority: 10,
      label:    "Pricing Page Visitor → Demo / Trial CTA",
      reason:   "Bezoeker bekeek de prijzenpagina — evaluatiefase, hoge koopbereidheid. Toon directe demo/trial CTA.",
      condition: {
        type:     "field",
        field:    "journey.hasVisitedContact",
        operator: "equals",
        value:    true,
      },
      plan: {
        heroKey:  "hero_saas_intent",
        proofKey: "proof_saas_default",
        ctaKey:   "cta_saas_trial",
      },
    },
    {
      priority: 20,
      label:    "Contact / Demo Page Visitor → Direct Sales CTA",
      reason:   "Bezoeker bezocht de demo-aanvraagpagina. Versterk met directe sales messaging.",
      condition: {
        type: "named",
        name: "high_engagement",
      },
      plan: {
        heroKey:  "hero_saas_intent",
        proofKey: "proof_saas_intent",
        ctaKey:   "cta_saas_demo",
      },
    },
    {
      priority: 30,
      label:    "Returning Feature Visitor → Product Deep-Dive CTA",
      reason:   "Terugkerende bezoeker die features onderzocht. Bied diepere productkennis of ROI-berekening aan.",
      condition: {
        type: "named",
        name: "returning_cta_clicked",
      },
      plan: {
        heroKey:  "hero_saas_consideration",
        proofKey: "proof_saas_intent",
        ctaKey:   "cta_saas_demo",
      },
    },
    {
      priority: 40,
      label:    "New Visitor → Awareness / Free Trial CTA",
      reason:   "Eerste bezoek. Introduceer het product en verlaag de drempel met een gratis proefperiode.",
      condition: {
        type:     "field",
        field:    "visitType",
        operator: "equals",
        value:    "new",
      },
      plan: {
        heroKey:  "hero_saas_default",
        proofKey: "proof_saas_default",
        ctaKey:   "cta_saas_trial",
      },
    },
  ],

  // ── Scoring rules ─────────────────────────────────────────────────────────

  scoringRules: [
    {
      key:           "pricing_view",
      label:          "Pricing Page View",
      description:   "Bezoeker bekijkt de prijzenpagina — sterkste koopintentie-signaal voor SaaS.",
      event_type:    "page_view",
      page_category: "pricing",
      score:    40,
      decay_profile: "standard",
      priority:      10,
    },
    {
      key:           "contact_view",
      label:          "Demo / Contact Page View",
      description:   "Bezoeker bekijkt de demo-aanvraag- of contactpagina.",
      event_type:    "page_view",
      page_category: "contact",
      score:    30,
      decay_profile: "standard",
      priority:      15,
    },
    {
      key:           "feature_page_view",
      label:          "Features Page View",
      description:   "Bezoeker onderzoekt functionaliteiten — actieve productevaluatie.",
      event_type:    "page_view",
      page_category: "features",
      score:    15,
      decay_profile: "standard",
      priority:      20,
    },
    {
      key:           "about_view",
      label:          "About / Company View",
      description:   "Bezoeker bekijkt het bedrijf — vertrouwen en credentialscheck.",
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
      label:          "Demo-formulier Gestart",
      description:   "Bezoeker begon het demo- of contactformulier — hoge commitment.",
      event_type:    "form_start",
      score:    15,
      decay_profile: "standard",
      priority:      50,
    },
  ],

  // ── Sequence patterns ─────────────────────────────────────────────────────

  sequencePatterns: [
    {
      slug:            "pricing_to_demo",
      label:           "Pricing → Demo",
      sequence: [
        { event_type: "page_view", page_category: "pricing" },
        { event_type: "page_view", page_category: "contact" },
      ],
      max_gap_minutes: 30,
      score:           50,
    },
    {
      slug:            "features_to_pricing",
      label:           "Features → Pricing",
      sequence: [
        { event_type: "page_view", page_category: "features" },
        { event_type: "page_view", page_category: "pricing" },
      ],
      max_gap_minutes: 30,
      score:           35,
    },
    {
      slug:            "full_saas_evaluation",
      label:           "Features → Pricing → Demo",
      sequence: [
        { event_type: "page_view", page_category: "features" },
        { event_type: "page_view", page_category: "pricing" },
        { event_type: "page_view", page_category: "contact" },
      ],
      max_gap_minutes: 60,
      score:           60,
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
