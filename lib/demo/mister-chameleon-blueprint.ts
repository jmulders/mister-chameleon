/**
 * Mister Chameleon — Canonical Demo Blueprint
 *
 * The flagship adaptive experience pack for the Mister Chameleon homepage.
 * This blueprint defines the full set of variant content (in Dutch), the
 * six canonical homepage rules, and the scenario → rule → variant mapping
 * used by:
 *
 *   • The runtime rule engine (via runtime-rules.json)
 *   • The Scenario Control Panel (journeyOverrides presets)
 *   • Storybook stories (plan fixtures)
 *   • Integration tests (_fixtures.ts scenario helpers)
 *   • Admin "Why this experience?" debug panel
 *
 * ── Scenario map (summary) ───────────────────────────────────────────────────
 *
 *   Scenario            Rule fired                     Hero               Proof             CTA
 *   ──────────────────  ─────────────────────────────  ─────────────────  ────────────────  ─────────────────
 *   New Visitor         rule_home_default_awareness    hero_default       proof_vision      cta_default
 *   Considering         rule_home_consideration        hero_consideration proof_cases       cta_demo
 *   High Intent         rule_home_intent               hero_intent_direct proof_stats       cta_meeting
 *   Form Drop-off       rule_home_form_dropoff         hero_consideration proof_reassurance cta_demo
 *   Post-Conversion     rule_home_customer_onboarding  hero_customer_*    proof_default     cta_onboarding
 *   Customer Expansion  rule_home_customer_expansion   hero_customer_*    proof_stats       cta_expansion
 *
 * ── What lives here vs CMS ───────────────────────────────────────────────────
 *
 *   CODE (this file)
 *     - Rule conditions, priorities, plans, reasons
 *     - Scenario presets (journeyOverrides)
 *     - Content copy for seeding (apply-blueprint loads these into the DB)
 *
 *   CMS / ADMIN (Sanity / DB — seeded by apply-blueprint)
 *     - Rendered hero/proof/CTA content documents
 *     - Per-tenant overrides of copy, images, links
 *
 * ── Blueprint version bump policy ────────────────────────────────────────────
 *   Bump patch  — copy changes only (no structural change).
 *   Bump minor  — new variant or rule added.
 *   Bump major  — breaking schema change or rule ID rename.
 */

import type { Blueprint } from "@/lib/blueprint/types";

export const MISTER_CHAMELEON_BLUEPRINT: Blueprint = {
  id:          "mister-chameleon-demo",
  version:     "1.0.0",
  name:        "Mister Chameleon — Flagship Demo",
  description: "Kanonieke adaptieve homepagina-ervaring voor Mister Chameleon, "
             + "met zes gedragsgestuurde regels en Nederlandstalige variant-copy.",

  // ── Hero variants ──────────────────────────────────────────────────────────

  heroVariants: [
    {
      key:    "hero_default",
      source: "blueprint",
      label:  "Standaard merkervaring",
      content: {
        headline:    "Personaliseer elke bezoeker op schaal",
        subheadline: "Mister Chameleon past je website aan op elk individu — "
                   + "automatisch, zonder code.",
        badge:       null,
      },
    },
    {
      key:    "hero_consideration",
      source: "blueprint",
      label:  "Overweging / onderzoeksfase",
      content: {
        headline:    "Waarom kiezen groeiende teams voor Mister Chameleon?",
        subheadline: "Ontdek hoe B2B-teams hun conversie verhogen met slimme, "
                   + "automatische personalisatie — zonder handmatig werk.",
        badge:       "Vertrouwd door 200+ teams",
      },
    },
    {
      key:    "hero_intent_direct",
      source: "blueprint",
      label:  "Directe pitch — hoge koopintentie",
      content: {
        headline:    "Klaar om je conversie te verdubbelen?",
        subheadline: "Boek een demo en zie in 20 minuten hoe Mister Chameleon "
                   + "jouw homepagina transformeert voor elke bezoeker.",
        badge:       "Gem. +34 % conversie na 30 dagen",
      },
    },
    {
      key:    "hero_customer_onboarding",
      source: "blueprint",
      label:  "Welkom terug — onboarding klant",
      content: {
        headline:    "Welkom bij Mister Chameleon",
        subheadline: "Je bent er bijna. Zet je eerste personalisatie live "
                   + "in minder dan een dag — we helpen je stap voor stap.",
        badge:       "Onboarding",
      },
    },
    // Source-traffic variants (existing platform defaults, kept for completeness)
    {
      key:    "hero_google_problem",
      source: "system",
      label:  "Zoekverkeer — probleembewust",
      content: {
        headline:    "Elke bezoeker is anders. Je website nog niet.",
        subheadline: "Stop met één-maat-past-iedereen. Mister Chameleon toont "
                   + "elke bezoeker automatisch de meest relevante ervaring.",
        badge:       null,
      },
    },
    {
      key:    "hero_linkedin_vision",
      source: "system",
      label:  "LinkedIn — thought leadership",
      content: {
        headline:    "De toekomst van B2B-groei is hyper-personalisatie",
        subheadline: "Leer hoe toonaangevende teams real-time gedragsintelligentie "
                   + "inzetten om meer deals te sluiten.",
        badge:       null,
      },
    },
    {
      key:    "hero_direct_brand",
      source: "system",
      label:  "Direct verkeer — merkfocus",
      content: {
        headline:    "Meer conversie. Minder ruis. Mister Chameleon.",
        subheadline: "Slimme personalisatie die zichzelf aanpast op het gedrag "
                   + "van elke bezoeker — dag en nacht, zonder handmatig werk.",
        badge:       null,
      },
    },
  ],

  // ── Proof variants ─────────────────────────────────────────────────────────

  proofVariants: [
    {
      key:    "proof_default",
      source: "blueprint",
      label:  "Standaard vertrouwensopbouw",
      content: {
        headline: "Vertrouwd door groeiende B2B-teams",
        items: [
          { stat: "200+",  label: "teams gebruiken Mister Chameleon" },
          { stat: "4,8/5", label: "gemiddelde klantscore" },
          { stat: "GDPR",  label: "volledig privacyconform" },
        ],
      },
    },
    {
      key:    "proof_cases",
      source: "blueprint",
      label:  "Klantverhalen & ROI",
      content: {
        headline: "Bewezen resultaten bij teams zoals het jouwe",
        cases: [
          {
            company: "Fintech Scale-up",
            result:  "+41 % demo-aanvragen in 6 weken",
            quote:   "Binnen een week zagen we al verschil in onze conversieratio.",
          },
          {
            company: "B2B SaaS — Enterprise",
            result:  "Terugverdientijd < 60 dagen",
            quote:   "Mister Chameleon doet wat ons CRO-team niet handmatig bij kon houden.",
          },
        ],
      },
    },
    {
      key:    "proof_stats",
      source: "blueprint",
      label:  "Platform-prestaties & schaal",
      content: {
        headline: "Resultaten die spreken voor zich",
        items: [
          { stat: "+34 %",  label: "gemiddelde conversiestijging" },
          { stat: "< 50 ms", label: "beslissingslatentie per bezoeker" },
          { stat: "99,9 %",  label: "platform-uptime (SLA)" },
          { stat: "10 M+",   label: "beslissingen verwerkt per maand" },
        ],
      },
    },
    {
      key:    "proof_reassurance",
      source: "blueprint",
      label:  "Geruststelling — no-pressure",
      content: {
        headline: "Geen verplichtingen. Altijd opzegbaar.",
        points: [
          "Gratis proefperiode van 14 dagen — geen creditcard vereist",
          "GDPR-conform en privacyproof by design",
          "Persoonlijke onboarding inbegrepen",
          "Maandelijks opzegbaar, geen langetermijncontract",
        ],
      },
    },
    {
      key:    "proof_vision",
      source: "system",
      label:  "Visie & thought leadership",
      content: {
        headline: "Erkend als innovator in B2B-personalisatie",
        quotes: [
          {
            text:   "Mister Chameleon zet de standaard voor real-time adaptieve ervaringen.",
            author: "B2B Marketing Analyst, Forrester",
          },
        ],
      },
    },
    {
      key:    "proof_platform",
      source: "system",
      label:  "Platform schaal & betrouwbaarheid",
      content: {
        headline: "Enterprise-grade. Startup-snelheid.",
        items: [
          { stat: "99,9 %", label: "uptime SLA" },
          { stat: "SOC 2",  label: "Type II gecertificeerd" },
          { stat: "GDPR",   label: "volledig compliant" },
        ],
      },
    },
  ],

  // ── CTA variants ───────────────────────────────────────────────────────────

  ctaVariants: [
    {
      key:    "cta_default",
      source: "blueprint",
      label:  "Standaard — laagdrempelig",
      content: {
        label:   "Ontdek hoe het werkt",
        href:    "/over-ons",
        variant: "secondary",
      },
    },
    {
      key:    "cta_demo",
      source: "blueprint",
      label:  "Demo aanvragen — middenfunnel",
      content: {
        label:   "Bekijk een gratis demo",
        href:    "/demo",
        variant: "primary",
        subtext: "Geen verplichtingen — 20 minuten",
      },
    },
    {
      key:    "cta_meeting",
      source: "blueprint",
      label:  "Kennismaking plannen — sales",
      content: {
        label:   "Plan een kennismaking",
        href:    "/kennismaking",
        variant: "primary",
        subtext: "20 min · Gratis · Direct inplannen",
      },
    },
    {
      key:    "cta_onboarding",
      source: "blueprint",
      label:  "Onboarding starten — post-conversie",
      content: {
        label:   "Start je onboarding",
        href:    "/onboarding",
        variant: "primary",
        subtext: "Eerste personalisatie live in < 1 dag",
      },
    },
    {
      key:    "cta_expansion",
      source: "blueprint",
      label:  "Uitbreiding bekijken — bestaande klant",
      content: {
        label:   "Bekijk uitbreidingsopties",
        href:    "/uitbreiding",
        variant: "secondary",
        subtext: "Exclusief voor bestaande klanten",
      },
    },
    {
      key:    "cta_guide",
      source: "system",
      label:  "Gratis gids — educatief",
      content: {
        label:   "Download de gratis gids",
        href:    "/gids",
        variant: "secondary",
      },
    },
    {
      key:    "cta_platform",
      source: "system",
      label:  "Platform proberen — product-led",
      content: {
        label:   "Probeer gratis",
        href:    "/registreren",
        variant: "primary",
      },
    },
  ],

  // ── Canonical homepage rules ───────────────────────────────────────────────
  //
  // Priority ordering (lower = fires first):
  //   1   homepage.linkedin         (existing — unchanged)
  //   5   homepage.google           (existing — unchanged)
  //   7   homepage.returning_cta_clicked  (existing — unchanged)
  //   10  homepage.high_engagement  (existing — unchanged)
  //   12  rule_home_customer_expansion
  //   15  rule_home_customer_onboarding
  //   20  rule_home_form_dropoff
  //   25  rule_home_intent
  //   35  rule_home_consideration
  //   50  rule_home_default_awareness

  rules: [
    // ── Customer expansion (priority 12) ─────────────────────────────────────
    {
      id:       "rule_home_customer_expansion",
      source:   "blueprint",
      priority: 12,
      label:    "Klantuitbreiding — bestaande klant bezoekt pricing opnieuw",
      condition: {
        type:  "group",
        logic: "and",
        conditions: [
          {
            type:     "field",
            field:    "journey.hasSubmittedForm",
            operator: "equals",
            value:    true,
          },
          {
            type:     "field",
            field:    "journey.hasVisitedPricing",
            operator: "equals",
            value:    true,
          },
        ],
      },
      plan: {
        heroKey:  "hero_customer_onboarding",
        proofKey: "proof_stats",
        ctaKey:   "cta_expansion",
        themeKey: "modern-saas",
      },
      reason: "Bestaande klant (formulier ingevuld) die opnieuw de pricing-pagina bezoekt "
            + "— expansie-signaal: toon platform-prestaties en uitbreidingsCTA.",
    },

    // ── Customer onboarding (priority 15) ────────────────────────────────────
    {
      id:       "rule_home_customer_onboarding",
      source:   "blueprint",
      priority: 15,
      label:    "Klant onboarding — post-conversie of klantfase",
      condition: {
        type:  "group",
        logic: "or",
        conditions: [
          {
            type:     "field",
            field:    "journey.funnelStage",
            operator: "equals",
            value:    "customer",
          },
          {
            type:     "field",
            field:    "journey.hasSubmittedForm",
            operator: "equals",
            value:    true,
          },
        ],
      },
      plan: {
        heroKey:  "hero_customer_onboarding",
        proofKey: "proof_default",
        ctaKey:   "cta_onboarding",
        themeKey: "corporate-trust",
      },
      reason: "Bezoeker in klantfase of heeft het formulier ingevuld "
            + "— verwelkom terug, focus op onboarding-volgende stap.",
    },

    // ── Form drop-off recovery (priority 20) ─────────────────────────────────
    {
      id:       "rule_home_form_dropoff",
      source:   "blueprint",
      priority: 20,
      label:    "Formulier dropout-herstel — gestart maar niet ingevuld",
      condition: {
        type:  "group",
        logic: "and",
        conditions: [
          {
            type:     "field",
            field:    "journey.hasStartedForm",
            operator: "equals",
            value:    true,
          },
          {
            type:     "field",
            field:    "journey.hasSubmittedForm",
            operator: "equals",
            value:    false,
          },
          {
            type:     "field",
            field:    "journey.frictionScore",
            operator: "greater_than_or_equal",
            value:    10,
          },
        ],
      },
      plan: {
        heroKey:  "hero_consideration",
        proofKey: "proof_reassurance",
        ctaKey:   "cta_demo",
        themeKey: "minimal-neutral",
      },
      reason: "Bezoeker startte een formulier maar haakte af en toont wrijving "
            + "— geruststelling boven upsell, laagdrempelige demo-CTA.",
    },

    // ── Commercial intent (priority 25) ──────────────────────────────────────
    {
      id:       "rule_home_intent",
      source:   "blueprint",
      priority: 25,
      label:    "Commerciële intentie — klaar om te kopen",
      condition: {
        type:  "group",
        logic: "or",
        conditions: [
          {
            type:     "field",
            field:    "journey.funnelStage",
            operator: "equals",
            value:    "intent",
          },
          {
            type:     "field",
            field:    "journey.funnelStage",
            operator: "equals",
            value:    "high_intent",
          },
          {
            type:     "field",
            field:    "journey.hasVisitedPricing",
            operator: "equals",
            value:    true,
          },
          {
            type:     "field",
            field:    "journey.matchedSequences",
            operator: "contains",
            value:    "homepage_product_pricing",
          },
        ],
      },
      plan: {
        heroKey:  "hero_intent_direct",
        proofKey: "proof_stats",
        ctaKey:   "cta_meeting",
        themeKey: "modern-saas",
      },
      reason: "Bezoeker toont koopintentie (pricing bezocht, intent-fase of koopsequentie) "
            + "— directe pitch, platform-prestaties als bewijs, kennismaking als CTA.",
    },

    // ── Consideration / research (priority 35) ───────────────────────────────
    {
      id:       "rule_home_consideration",
      source:   "blueprint",
      priority: 35,
      label:    "Overweging — onderzoeks- en evaluatiemodus",
      condition: {
        type:  "group",
        logic: "or",
        conditions: [
          {
            type:     "field",
            field:    "journey.funnelStage",
            operator: "equals",
            value:    "consideration",
          },
          {
            type:     "field",
            field:    "journey.hasVisitedCases",
            operator: "equals",
            value:    true,
          },
        ],
      },
      plan: {
        heroKey:  "hero_consideration",
        proofKey: "proof_cases",
        ctaKey:   "cta_demo",
        themeKey: "corporate-trust",
      },
      reason: "Bezoeker evalueert opties (overwegingsfase of cases bekeken) "
            + "— waardepropositie + klantverhalen + demo-CTA.",
    },

    // ── Awareness / new visitor (priority 50) ────────────────────────────────
    {
      id:       "rule_home_default_awareness",
      source:   "blueprint",
      priority: 50,
      label:    "Bewustzijnsfase — nieuw of laag-signaal bezoek",
      condition: {
        type:     "field",
        field:    "journey.funnelStage",
        operator: "equals",
        value:    "awareness",
      },
      plan: {
        heroKey:  "hero_default",
        proofKey: "proof_vision",
        ctaKey:   "cta_default",
        themeKey: "editorial-classic",
      },
      reason: "Nieuwe of laag-signaal bezoeker in bewustzijnsfase "
            + "— merkervaring, visie-bewijs, laagdrempelige CTA.",
    },
  ],

  // ── Default plan ───────────────────────────────────────────────────────────

  defaultPlan: {
    heroKey:  "hero_default",
    proofKey: "proof_default",
    ctaKey:   "cta_default",
    reason:   "Geen regel matcht — directe of onbekende bezoekers krijgen "
            + "de kanonieke merkervaring zonder aanpassingen.",
  },

  // ── Scenario → rule → variant mapping ─────────────────────────────────────

  scenarios: [
    {
      name:   "Nieuw bezoek",
      ruleId: "rule_home_default_awareness",
      journeyOverrides: {
        funnelStage: "awareness",
      },
      plan: {
        heroKey:  "hero_default",
        proofKey: "proof_vision",
        ctaKey:   "cta_default",
        themeKey: "editorial-classic",
      },
      expectedBand: "low",
    },
    {
      name:   "Overweging",
      ruleId: "rule_home_consideration",
      journeyOverrides: {
        funnelStage:      "consideration",
        intentScore:      22,
        hasVisitedCases:  true,
        pageViewCount:    3,
        matchedSequences: ["services_to_case"],
      },
      plan: {
        heroKey:  "hero_consideration",
        proofKey: "proof_cases",
        ctaKey:   "cta_demo",
        themeKey: "corporate-trust",
      },
      expectedBand: "medium",
    },
    {
      name:   "Hoge intentie",
      ruleId: "rule_home_intent",
      journeyOverrides: {
        funnelStage:           "high_intent",
        intentScore:           80,
        shortTermIntentScore:  60,
        hasVisitedPricing:     true,
        hasClickedCta:         true,
        pageViewCount:         5,
        signalDiversityScore:  0.5,
        uniqueSignalCount:     5,
        funnelStageConfidence: 0.85,
        matchedSequences:      ["services_to_contact"],
      },
      plan: {
        heroKey:  "hero_intent_direct",
        proofKey: "proof_stats",
        ctaKey:   "cta_meeting",
        themeKey: "modern-saas",
      },
      expectedBand: "high",
    },
    {
      name:   "Formulier dropout",
      ruleId: "rule_home_form_dropoff",
      journeyOverrides: {
        funnelStage:     "consideration",
        hasStartedForm:  true,
        hasSubmittedForm: false,
        frictionScore:   25,
        intentScore:     30,
        pageViewCount:   2,
      },
      plan: {
        heroKey:  "hero_consideration",
        proofKey: "proof_reassurance",
        ctaKey:   "cta_demo",
        themeKey: "minimal-neutral",
      },
      expectedBand: "low",
    },
    {
      name:   "Post-conversie",
      ruleId: "rule_home_customer_onboarding",
      journeyOverrides: {
        funnelStage:      "customer",
        hasSubmittedForm: true,
        intentScore:      100,
        pageViewCount:    5,
        ctaClickCount:    1,
        formStartCount:   1,
      },
      plan: {
        heroKey:  "hero_customer_onboarding",
        proofKey: "proof_default",
        ctaKey:   "cta_onboarding",
        themeKey: "corporate-trust",
      },
      expectedBand: "very_high",
    },
    {
      name:   "Klantuitbreiding",
      ruleId: "rule_home_customer_expansion",
      journeyOverrides: {
        funnelStage:      "customer",
        hasSubmittedForm: true,
        hasVisitedPricing: true,
        intentScore:      55,
        pageViewCount:    6,
        ctaClickCount:    1,
        formStartCount:   1,
      },
      plan: {
        heroKey:  "hero_customer_onboarding",
        proofKey: "proof_stats",
        ctaKey:   "cta_expansion",
        themeKey: "modern-saas",
      },
      expectedBand: "very_high",
    },
  ],
};
