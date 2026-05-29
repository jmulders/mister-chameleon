/**
 * B2B SaaS Platform Blueprint — Mister Chameleon Flagship Demo
 *
 * This is both:
 *   1. The actual Mister Chameleon website blueprint (practice what you preach)
 *   2. The flagship demo showing the platform's adaptive capabilities
 *   3. A reusable starter blueprint for B2B SaaS companies
 *
 * ── What this file contains ───────────────────────────────────────────────────
 *
 *   Variant seeds    5 hero + 4 proof + 5 CTA variants with full Dutch copy
 *   Canonical rules  7 behavioral homepage rules (rule_saas_*)
 *   Scenario map     6 named presets for Scenario Control / Storybook / tests
 *   Page definitions 7 pages with block-level content (seeded into CMS)
 *   Sequences        4 named visitor journey sequences for rule conditions
 *
 * ── Scenario → rule → variant map ────────────────────────────────────────────
 *
 *   Scenario          Rule                          Hero                       Proof                    CTA
 *   ────────────────  ────────────────────────────  ─────────────────────────  ───────────────────────  ─────────────────
 *   Nieuw bezoek      rule_saas_home_awareness       hero_saas_default          proof_saas_default       cta_saas_default
 *   Product explorer  rule_saas_home_consideration   hero_saas_consideration    proof_saas_consideration cta_saas_demo
 *   High intent       rule_saas_home_intent          hero_saas_intent           proof_saas_intent        cta_saas_demo
 *   Trial ready       rule_saas_home_trial_ready     hero_saas_trial            proof_saas_intent        cta_saas_trial
 *   Signup completed  rule_saas_customer_onboarding  hero_saas_customer_onboard proof_saas_default       cta_saas_onboarding
 *   Customer expan.   rule_saas_customer_expansion   hero_saas_customer_onboard proof_saas_intent        cta_saas_expansion
 *
 * ── Priority order ────────────────────────────────────────────────────────────
 *
 *    1  homepage.linkedin              (system — unchanged)
 *    5  homepage.google               (system — unchanged)
 *    7  homepage.returning_cta_clicked (system — unchanged)
 *   10  homepage.high_engagement      (system — unchanged)
 *   12  rule_saas_customer_expansion
 *   15  rule_saas_customer_onboarding
 *   20  rule_saas_form_dropoff
 *   22  rule_saas_home_trial_ready
 *   25  rule_saas_home_intent
 *   35  rule_saas_home_consideration
 *   50  rule_saas_home_awareness
 *
 * ── What is seeded in code vs CMS ────────────────────────────────────────────
 *
 *   CODE (this file)
 *     - Rule conditions, priorities, plans, reasons
 *     - Scenario presets (journeyOverrides for Scenario Control)
 *     - Variant copy for CMS seeding via apply-blueprint.ts
 *     - Page block structure and static content
 *     - Sequence definitions
 *
 *   CMS / ADMIN (seeded by apply-blueprint, then editable per tenant)
 *     - heroVariant, proofVariant, ctaVariant Sanity documents
 *     - Page documents and block content
 *     - Pricing plan documents
 */

import type { Blueprint } from "@/lib/blueprint/types";

export const B2B_SAAS_BLUEPRINT: Blueprint = {
  id:            "b2b-saas-platform",
  version:       "1.0.0",
  name:          "B2B SaaS Platform",
  description:   "Volledig adaptieve website voor B2B SaaS-bedrijven. "
               + "Includes behavioral rules, lifecycle logic, trial & expansion CTAs.",
  industry:      "saas",
  defaultThemeId: "tech-clarity",

  // ── Hero variants ──────────────────────────────────────────────────────────
  //
  // Meanings:
  //   default             — general educational; shows what the platform does
  //   consideration       — product-led, comparison-friendly; shows fit
  //   intent              — direct conversion-focused; strong value prop
  //   trial               — strong free-trial / start-now emphasis
  //   customer_onboarding — post-conversion onboarding mode

  heroVariants: [
    {
      key:    "hero_saas_default",
      source: "blueprint",
      label:  "SaaS — Standaard merkervaring",
      content: {
        eyebrow:     "Adaptive websites for growth teams",
        headline:    "Je website die zich aanpast aan gedrag en meer converteert.",
        text:        "Geen statische pagina's meer, maar een website die begrijpt waar je "
                   + "bezoeker zit in de funnel en daar realtime op reageert met de juiste "
                   + "content, CTA en ervaring.",
        primaryCta:  "Bekijk demo",
        secondaryCta: "Hoe het werkt",
      },
    },
    {
      key:    "hero_saas_consideration",
      source: "blueprint",
      label:  "SaaS — Overweging / productvergelijking",
      content: {
        eyebrow:     "Waarom kiezen groeiende B2B-teams voor Mister Chameleon?",
        headline:    "Eén platform voor gedrag, content en personalisatie.",
        text:        "Vergelijk je opties? Mister Chameleon combineert behavioral tracking, "
                   + "funnel-stage-detectie en adaptive blocks in één systeem — zonder losse tools.",
        primaryCta:  "Bekijk demo",
        secondaryCta: "Bekijk use cases",
      },
    },
    {
      key:    "hero_saas_intent",
      source: "blueprint",
      label:  "SaaS — Directe pitch, hoge koopintentie",
      content: {
        eyebrow:     "Klaar om je website als revenue engine in te zetten?",
        headline:    "Minder handmatig testen. Meer relevante conversie.",
        text:        "Mister Chameleon detecteert koopintentie en past je homepage realtime aan. "
                   + "Gemiddeld +34 % meer relevante CTA-kliks binnen 30 dagen.",
        primaryCta:  "Bekijk demo",
        secondaryCta: "Bekijk pricing",
      },
    },
    {
      key:    "hero_saas_trial",
      source: "blueprint",
      label:  "SaaS — Free trial / direct starten",
      content: {
        eyebrow:     "Probeer Mister Chameleon 14 dagen gratis",
        headline:    "Start vandaag. Geen creditcard. Geen verplichtingen.",
        text:        "Zet je eerste adaptive flow live in minder dan een dag. "
                   + "Met persoonlijke onboarding en direct inzicht in je bezoekers.",
        primaryCta:  "Start gratis",
        secondaryCta: "Bekijk demo",
      },
    },
    {
      key:    "hero_saas_customer_onboarding",
      source: "blueprint",
      label:  "SaaS — Post-conversie onboarding",
      content: {
        eyebrow:     "Welkom bij Mister Chameleon",
        headline:    "Je adaptive website staat klaar. Laten we starten.",
        text:        "Je eerste personalisatie live in minder dan een dag. "
                   + "We begeleiden je stap voor stap door je eerste flow, regel en variant.",
        primaryCta:  "Start je onboarding",
        secondaryCta: "Bekijk de docs",
      },
    },
  ],

  // ── Proof variants ─────────────────────────────────────────────────────────
  //
  // Meanings:
  //   default       — platform value, explainability, credibility
  //   consideration — use cases and fit for evaluating buyers
  //   intent        — ROI / conversion impact proof
  //   reassurance   — safe fallback; no-dumb-personalization message

  proofVariants: [
    {
      key:    "proof_saas_default",
      source: "blueprint",
      label:  "SaaS — Platform waarde & uitlegbaarheid",
      content: {
        headline: "Geen black box. Wel slimme beslissingen.",
        text:     "Mister Chameleon reageert niet op losse clicks, maar op gedrag dat "
                + "betekenis heeft. Zo voorkom je domme personalisatie en laat je de site "
                + "alleen opschalen als er genoeg vertrouwen is.",
        stats: [
          { stat: "200+",  label: "teams gebruiken Mister Chameleon" },
          { stat: "< 50ms", label: "beslissingslatentie per bezoeker" },
          { stat: "GDPR",  label: "volledig privacyconform" },
        ],
      },
    },
    {
      key:    "proof_saas_consideration",
      source: "blueprint",
      label:  "SaaS — Use cases & fit",
      content: {
        headline: "Gebouwd voor teams die verder willen dan een statische site",
        useCases: [
          { title: "B2B SaaS",                icon: "layers",   text: "Adaptive funnel per fases awareness → trial → upsell" },
          { title: "Marketing agencies",      icon: "globe",    text: "Toon de juiste cases en resultaten per bezoekerstype" },
          { title: "ICT dienstverleners",     icon: "server",   text: "Gedragsgestuurde content voor complexe B2B-buyers" },
          { title: "Customer onboarding",     icon: "check",    text: "Post-conversie modus met onboarding-flow en CTAs" },
          { title: "Expansion & upsell",      icon: "trending-up", text: "Herken expansion-kandidaten en pas de homepage aan" },
        ],
      },
    },
    {
      key:    "proof_saas_intent",
      source: "blueprint",
      label:  "SaaS — ROI & conversiebewijs",
      content: {
        headline: "Van brochure naar revenue engine",
        stats: [
          { stat: "+34 %",  label: "meer relevante CTA-kliks per funnel stage" },
          { stat: "–60 %",  label: "minder handmatig testen en segmenteren" },
          { stat: "1 dag",  label: "eerste adaptive flow live" },
          { stat: "10 M+",  label: "beslissingen verwerkt per maand" },
        ],
        cases: [
          {
            company: "SaaS scale-up",
            result:  "+41 % demo-aanvragen in 6 weken",
            quote:   "Binnen een week zagen we al verschil in onze conversieratio.",
          },
          {
            company: "B2B dienstverlener",
            result:  "Terugverdientijd < 60 dagen",
            quote:   "Mister Chameleon doet wat ons CRO-team niet handmatig bij kon houden.",
          },
        ],
      },
    },
    {
      key:    "proof_saas_reassurance",
      source: "blueprint",
      label:  "SaaS — Geruststelling (friction recovery)",
      content: {
        headline: "Geen domme personalisatie. Wel relevante ervaringen.",
        text:     "Mister Chameleon schaalt pas op als er genoeg vertrouwen is in het "
                + "bezoekersgedrag. Bij twijfel valt het systeem terug op een veilige, "
                + "neutrale ervaring — nooit op een gok.",
        points: [
          "Gratis proefperiode van 14 dagen — geen creditcard vereist",
          "GDPR-conform en privacyproof by design",
          "Persoonlijke onboarding inbegrepen",
          "Maandelijks opzegbaar, geen langetermijncontract",
        ],
      },
    },
  ],

  // ── CTA variants ───────────────────────────────────────────────────────────

  ctaVariants: [
    {
      key:    "cta_saas_default",
      source: "blueprint",
      label:  "SaaS — Standaard (educatief, laagdrempelig)",
      content: {
        label:   "Hoe het werkt",
        href:    "/product",
        variant: "secondary",
      },
    },
    {
      key:    "cta_saas_demo",
      source: "blueprint",
      label:  "SaaS — Demo aanvragen",
      content: {
        label:   "Bekijk demo",
        href:    "/demo",
        variant: "primary",
        subtext: "20 min · Gratis · Geen verplichtingen",
      },
    },
    {
      key:    "cta_saas_trial",
      source: "blueprint",
      label:  "SaaS — Gratis starten",
      content: {
        label:   "Start gratis",
        href:    "/registreren",
        variant: "primary",
        subtext: "14 dagen gratis · Geen creditcard",
      },
    },
    {
      key:    "cta_saas_onboarding",
      source: "blueprint",
      label:  "SaaS — Onboarding starten",
      content: {
        label:   "Start je onboarding",
        href:    "/onboarding",
        variant: "primary",
        subtext: "Eerste flow live in < 1 dag",
      },
    },
    {
      key:    "cta_saas_expansion",
      source: "blueprint",
      label:  "SaaS — Uitbreiden",
      content: {
        label:   "Bekijk uitbreidingsopties",
        href:    "/pricing",
        variant: "secondary",
        subtext: "Exclusief voor bestaande klanten",
      },
    },
  ],

  // ── Canonical homepage rules ───────────────────────────────────────────────
  //
  // These rules are scoped to the homepage (/) and power the adaptive hero,
  // proof and CTA blocks. Traffic-source rules (linkedin, google, named
  // conditions) remain as system rules and fire at priorities 1–10.

  rules: [
    // Priority 12 — Customer expansion ───────────────────────────────────────
    {
      id:       "rule_saas_customer_expansion",
      source:   "blueprint",
      priority: 12,
      label:    "Klantuitbreiding — pricing revisit na conversie",
      condition: {
        type:  "group",
        logic: "and",
        conditions: [
          { type: "field", field: "journey.hasSubmittedForm",  operator: "equals", value: true },
          { type: "field", field: "journey.hasVisitedPricing", operator: "equals", value: true },
        ],
      },
      plan: {
        heroKey:         "hero_saas_customer_onboarding",
        proofKey:        "proof_saas_intent",
        ctaKey:          "cta_saas_expansion",
        themeKey:        "modern-saas",
        pricingEmphasis: "standard",
        pricingCtaMode:  "expansion",
      },
      reason: "Bestaande klant (formulier ingevuld) die pricing opnieuw bezoekt — "
            + "expansie-signaal: toon ROI-bewijs en uitbreidings-CTA.",
    },

    // Priority 15 — Customer onboarding ──────────────────────────────────────
    {
      id:       "rule_saas_customer_onboarding",
      source:   "blueprint",
      priority: 15,
      label:    "Post-conversie — onboarding modus",
      condition: {
        type:  "group",
        logic: "or",
        conditions: [
          { type: "field", field: "journey.funnelStage",      operator: "equals", value: "customer" },
          { type: "field", field: "journey.hasSubmittedForm", operator: "equals", value: true },
        ],
      },
      plan: {
        heroKey:         "hero_saas_customer_onboarding",
        proofKey:        "proof_saas_default",
        ctaKey:          "cta_saas_onboarding",
        themeKey:        "corporate-trust",
        pricingEmphasis: "hidden",
        pricingCtaMode:  "onboarding",
      },
      reason: "Bezoeker in klantfase of heeft formulier ingevuld — "
            + "verwelkom terug en focus op onboarding-volgende stap.",
    },

    // Priority 20 — Form drop-off recovery ───────────────────────────────────
    {
      id:       "rule_saas_form_dropoff",
      source:   "blueprint",
      priority: 20,
      label:    "Formulier dropout-herstel",
      condition: {
        type:  "group",
        logic: "and",
        conditions: [
          { type: "field", field: "journey.hasStartedForm",   operator: "equals",              value: true  },
          { type: "field", field: "journey.hasSubmittedForm", operator: "equals",              value: false },
          { type: "field", field: "journey.frictionScore",    operator: "greater_than_or_equal", value: 10  },
        ],
      },
      plan: {
        heroKey:         "hero_saas_consideration",
        proofKey:        "proof_saas_reassurance",
        ctaKey:          "cta_saas_demo",
        themeKey:        "minimal-neutral",
        pricingEmphasis: "teaser",
        pricingCtaMode:  "demo",
      },
      reason: "Bezoeker startte formulier maar haakte af met wrijving — "
            + "geruststelling + zachte demo-CTA, geen harde upsell.",
    },

    // Priority 22 — Trial ready ───────────────────────────────────────────────
    {
      id:       "rule_saas_home_trial_ready",
      source:   "blueprint",
      priority: 22,
      label:    "Trial-ready — pricing + herhaalbezoek + hoge intentie",
      condition: {
        type:  "group",
        logic: "and",
        conditions: [
          { type: "field", field: "journey.hasVisitedPricing", operator: "equals",              value: true       },
          { type: "field", field: "journey.funnelStage",       operator: "not_equals",          value: "customer" },
          { type: "field", field: "journey.funnelStage",       operator: "not_equals",          value: "high_intent" },
          { type: "field", field: "journey.intentScore",       operator: "greater_than_or_equal", value: 50       },
        ],
      },
      plan: {
        heroKey:         "hero_saas_trial",
        proofKey:        "proof_saas_intent",
        ctaKey:          "cta_saas_trial",
        themeKey:        "modern-saas",
        pricingEmphasis: "emphasized",
        pricingCtaMode:  "trial",
      },
      reason: "Bezoeker heeft pricing bekeken, toont sterke intentie en is nog geen klant — "
            + "trial-ready: bied gratis start aan met ROI-bewijs.",
    },

    // Priority 25 — Commercial intent ────────────────────────────────────────
    {
      id:       "rule_saas_home_intent",
      source:   "blueprint",
      priority: 25,
      label:    "Commerciële intentie — klaar om te converteren",
      condition: {
        type:  "group",
        logic: "or",
        conditions: [
          { type: "field", field: "journey.funnelStage",       operator: "equals",   value: "intent"     },
          { type: "field", field: "journey.funnelStage",       operator: "equals",   value: "high_intent" },
          { type: "field", field: "journey.hasVisitedPricing", operator: "equals",   value: true },
          { type: "field", field: "journey.matchedSequences",  operator: "contains", value: "homepage_product_pricing" },
          { type: "field", field: "journey.intentScore",       operator: "greater_than_or_equal", value: 60 },
        ],
      },
      plan: {
        heroKey:         "hero_saas_intent",
        proofKey:        "proof_saas_intent",
        ctaKey:          "cta_saas_demo",
        themeKey:        "modern-saas",
        pricingEmphasis: "emphasized",
        pricingCtaMode:  "demo",
      },
      reason: "Bezoeker toont koopintentie (pricing, intent-fase of hoge intentiescore) — "
            + "directe pitch met conversiebewijs en demo-CTA.",
    },

    // Priority 35 — Consideration / research ─────────────────────────────────
    {
      id:       "rule_saas_home_consideration",
      source:   "blueprint",
      priority: 35,
      label:    "Overweging — evaluatiemodus en productverkenning",
      condition: {
        type:  "group",
        logic: "or",
        conditions: [
          { type: "field", field: "journey.funnelStage",      operator: "equals", value: "consideration" },
          { type: "field", field: "journey.hasVisitedCases",  operator: "equals", value: true },
          { type: "field", field: "journey.hasVisitedAbout",  operator: "equals", value: true },
          { type: "field", field: "journey.matchedSequences", operator: "contains", value: "homepage_to_product" },
        ],
      },
      plan: {
        heroKey:         "hero_saas_consideration",
        proofKey:        "proof_saas_consideration",
        ctaKey:          "cta_saas_demo",
        themeKey:        "tech-clarity",
        pricingEmphasis: "teaser",
        pricingCtaMode:  "demo",
      },
      reason: "Bezoeker in evaluatiemodus (cases/about bekeken of product verkend) — "
            + "product-led hero, use-case bewijs, demo-CTA.",
    },

    // Priority 50 — Awareness / new visitor ──────────────────────────────────
    {
      id:       "rule_saas_home_awareness",
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
        heroKey:         "hero_saas_default",
        proofKey:        "proof_saas_default",
        ctaKey:          "cta_saas_default",
        themeKey:        "editorial-classic",
        pricingEmphasis: "teaser",
        pricingCtaMode:  "demo",
      },
      reason: "Nieuwe of laag-signaal bezoeker in bewustzijnsfase — "
            + "educatieve merkervaring, platform-uitleg, zachte CTA.",
    },
  ],

  // ── Default plan ───────────────────────────────────────────────────────────

  defaultPlan: {
    heroKey:         "hero_saas_default",
    proofKey:        "proof_saas_default",
    ctaKey:          "cta_saas_default",
    pricingEmphasis: "teaser",
    pricingCtaMode:  "demo",
    reason:          "Geen regel matcht — directe of onbekende bezoekers krijgen de "
                   + "kanonieke B2B SaaS merkervaring.",
  },

  // ── Scenario presets ───────────────────────────────────────────────────────
  //
  // Used by:
  //   - Scenario Control Panel (journeyOverrides presets)
  //   - Storybook stories (plan fixtures)
  //   - Integration tests (_fixtures.ts helpers)
  //   - Admin "Why this experience?" debug panel

  scenarios: [
    {
      name:   "Nieuw bezoek",
      ruleId: "rule_saas_home_awareness",
      journeyOverrides: {
        funnelStage: "awareness",
      },
      plan: {
        heroKey:  "hero_saas_default",
        proofKey: "proof_saas_default",
        ctaKey:   "cta_saas_default",
        themeKey: "editorial-classic",
      },
      expectedBand: "low",
    },
    {
      name:   "Product explorer",
      ruleId: "rule_saas_home_consideration",
      journeyOverrides: {
        funnelStage:      "consideration",
        hasVisitedCases:  true,
        hasVisitedAbout:  true,
        intentScore:      22,
        pageViewCount:    3,
        matchedSequences: ["services_to_case"],
      },
      plan: {
        heroKey:  "hero_saas_consideration",
        proofKey: "proof_saas_consideration",
        ctaKey:   "cta_saas_demo",
        themeKey: "tech-clarity",
      },
      expectedBand: "medium",
    },
    {
      name:   "High intent pricing",
      ruleId: "rule_saas_home_intent",
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
        matchedSequences:      ["homepage_product_pricing"],
      },
      plan: {
        heroKey:  "hero_saas_intent",
        proofKey: "proof_saas_intent",
        ctaKey:   "cta_saas_demo",
        themeKey: "modern-saas",
      },
      expectedBand: "high",
    },
    {
      name:   "Trial ready",
      ruleId: "rule_saas_home_trial_ready",
      journeyOverrides: {
        funnelStage:           "intent",
        intentScore:           65,
        shortTermIntentScore:  50,
        hasVisitedPricing:     true,
        pageViewCount:         3,
        signalDiversityScore:  0.4,
        uniqueSignalCount:     4,
        funnelStageConfidence: 0.75,
        matchedSequences:      ["homepage_product_pricing"],
      },
      plan: {
        heroKey:  "hero_saas_trial",
        proofKey: "proof_saas_intent",
        ctaKey:   "cta_saas_trial",
        themeKey: "modern-saas",
      },
      expectedBand: "high",
    },
    {
      name:   "Signup completed",
      ruleId: "rule_saas_customer_onboarding",
      journeyOverrides: {
        funnelStage:      "customer",
        hasSubmittedForm: true,
        intentScore:      100,
        pageViewCount:    5,
        ctaClickCount:    1,
        formStartCount:   1,
      },
      plan: {
        heroKey:  "hero_saas_customer_onboarding",
        proofKey: "proof_saas_default",
        ctaKey:   "cta_saas_onboarding",
        themeKey: "corporate-trust",
      },
      expectedBand: "very_high",
    },
    {
      name:   "Customer expansion",
      ruleId: "rule_saas_customer_expansion",
      journeyOverrides: {
        funnelStage:       "customer",
        hasSubmittedForm:  true,
        hasVisitedPricing: true,
        intentScore:       55,
        pageViewCount:     6,
        ctaClickCount:     1,
        formStartCount:    1,
      },
      plan: {
        heroKey:  "hero_saas_customer_onboarding",
        proofKey: "proof_saas_intent",
        ctaKey:   "cta_saas_expansion",
        themeKey: "modern-saas",
      },
      expectedBand: "very_high",
    },
  ],

  // ── Named visitor journey sequences ────────────────────────────────────────
  //
  // These sequence keys are referenced in rule conditions via:
  //   journey.matchedSequences contains "<key>"

  sequences: [
    {
      key:   "homepage_to_product",
      label: "Homepage → Product",
      steps: ["/", "/product"],
    },
    {
      key:   "homepage_product_pricing",
      label: "Homepage → Product → Pricing",
      steps: ["/", "/product", "/pricing"],
    },
    {
      key:   "use_case_to_pricing",
      label: "Use Case → Pricing",
      steps: ["/use-cases", "/pricing"],
    },
    {
      key:   "pricing_to_demo",
      label: "Pricing → Demo aanvraag",
      steps: ["/pricing", "/demo"],
    },
    {
      key:   "pricing_to_trial",
      label: "Pricing → Start trial",
      steps: ["/pricing", "/registreren"],
    },
  ],

  // ── Page definitions ───────────────────────────────────────────────────────
  //
  // 7 pages seeded into CMS when blueprint is applied.
  // Blocks use the blueprint's adaptive variant slot system where marked
  // with slotKey; other blocks are static and content-managed.

  pages: [
    // ── 1. Homepage ──────────────────────────────────────────────────────────
    {
      slug:        "/",
      title:       "Mister Chameleon — Adaptive website platform",
      description: "Geen statische pagina's meer. Een website die reageert op gedrag.",
      blocks: [
        {
          type:    "hero",
          slotKey: "hero",
          content: {
            // Content comes from hero variant — seeded via heroVariants above
            // Fallback shown when confidence is below threshold
            fallbackHeadline: "Je website die zich aanpast aan gedrag en meer converteert.",
          },
        },
        {
          type:    "problem",
          content: {
            headline: "De meeste websites laten geld liggen",
            text:     "Iedere bezoeker ziet dezelfde ervaring, terwijl intent, context en "
                    + "klantstatus compleet verschillen. Daardoor blijven kansen liggen in "
                    + "acquisitie, onboarding, upsell en retentie.",
          },
        },
        {
          type:    "how-it-works",
          content: {
            headline: "Zo werkt Mister Chameleon",
            steps: [
              { number: 1, title: "Gedrag herkennen",   text: "We meten signals die er toe doen: paginadiepte, kliksequenties, funnel-fase en wrijving." },
              { number: 2, title: "Context begrijpen",  text: "Op basis van gedrag bepalen we waar de bezoeker zit en hoe zeker we daar van zijn." },
              { number: 3, title: "Site aanpassen",     text: "Met voldoende vertrouwen passen we hero, proof en CTA aan — anders valt de site veilig terug." },
            ],
          },
        },
        {
          type:    "features",
          content: {
            headline: "Alles wat je nodig hebt om je website slimmer te maken",
            items: [
              { title: "Behavioral tracking",       icon: "activity",    text: "Meet signals die er werkelijk toe doen." },
              { title: "Sequence detection",        icon: "git-branch",  text: "Herken gedragspatronen over meerdere pagina's." },
              { title: "Funnel stage detection",    icon: "filter",      text: "Weet automatisch waar elke bezoeker zit." },
              { title: "Lifecycle logic",           icon: "refresh-cw",  text: "Van awareness tot expansion in één systeem." },
              { title: "Adaptive hero / proof / CTA", icon: "layout",   text: "Pas de juiste blocks aan op het juiste moment." },
              { title: "Explainable decisions",     icon: "eye",         text: "Zie altijd welke regel en reden actief zijn." },
              { title: "Scenario simulator",        icon: "play-circle", text: "Test elke bezoekerspersona in realtime preview." },
              { title: "CRM-ready customer logic",  icon: "database",    text: "Herken klanten en activeer lifecycle-regels." },
            ],
          },
        },
        {
          type:    "behavior-explanation",
          content: {
            headline: "Geen black box. Wel slimme beslissingen.",
            text:     "Mister Chameleon reageert niet op losse clicks, maar op gedrag dat "
                    + "betekenis heeft. Zo voorkom je domme personalisatie en laat je de site "
                    + "alleen opschalen als er genoeg vertrouwen is.",
            callout:  "Bij lage confidence valt het systeem veilig terug — nooit op een gok.",
          },
        },
        {
          type:    "proof",
          slotKey: "proof",
          content: {
            fallbackHeadline: "Van brochure naar revenue engine",
          },
        },
        {
          type:    "use-cases",
          content: {
            headline: "Gebouwd voor teams die verder willen dan een statische site",
            items: [
              { title: "B2B SaaS",                 text: "Adaptive funnel van awareness naar trial en upsell." },
              { title: "Marketing agencies",       text: "Toon de juiste cases en resultaten per bezoekerstype." },
              { title: "ICT dienstverleners",      text: "Gedragsgestuurde content voor complexe B2B-buyers." },
              { title: "Zakelijke dienstverlening",text: "Expertise en vertrouwen per doelgroepsegment." },
              { title: "Customer onboarding",      text: "Post-conversie modus met onboarding-flow." },
              { title: "Expansion & upsell",       text: "Herken expansion-kandidaten en pas de homepage aan." },
            ],
          },
        },
        {
          type:    "pricing-teaser",
          content: {
            headline: "Schaal mee als je groeit",
            text:     "Start eenvoudig en activeer extra gedrag, regels en enrichments "
                    + "wanneer je daar klaar voor bent.",
            cta:      "Bekijk pricing",
            ctaHref:  "/pricing",
          },
        },
        {
          type:    "cta-block",
          slotKey: "cta",
          content: {
            headline:     "Klaar om je website slimmer te laten converteren?",
            text:         "Bekijk een live demo of start direct met je eerste adaptive setup.",
            primaryCta:   "Bekijk demo",
            secondaryCta: "Start gratis",
            primaryHref:  "/demo",
            secondaryHref: "/registreren",
          },
        },
        {
          type:    "faq",
          content: {
            headline: "Veelgestelde vragen",
            items: [
              {
                question: "Voor wie is Mister Chameleon geschikt?",
                answer:   "Voor B2B-teams die hun website actief inzetten als conversie- of revenue-kanaal. Denk aan SaaS, agencies, ICT en zakelijke dienstverleners.",
              },
              {
                question: "Heb ik developers nodig?",
                answer:   "Voor de basis-setup niet. Je kunt regels, varianten en scenario's instellen via het dashboard. Integratie met je CMS of CRM vereist eenmalig technisch werk.",
              },
              {
                question: "Hoe werkt pricing?",
                answer:   "Je betaalt een vast maandbedrag voor het platform. Extra enrichments (zoals bedrijfsherkenning of CRM-matching) werken op basis van credits — apart aan te schaffen.",
              },
              {
                question: "Kan ik dit combineren met mijn CMS en CRM?",
                answer:   "Ja. Mister Chameleon werkt naast je bestaande CMS en kan data uit je CRM gebruiken voor lifecycle-regels en klantherkenning.",
              },
              {
                question: "Hoe snel staat mijn eerste adaptive flow live?",
                answer:   "De meeste teams hebben hun eerste flow live binnen één werkdag, inclusief onboarding. De scenario-simulator maakt het makkelijk om het effect te testen vóór launch.",
              },
            ],
          },
        },
      ],
    },

    // ── 2. Product ───────────────────────────────────────────────────────────
    {
      slug:        "/product",
      title:       "Product — Mister Chameleon",
      description: "Hoe Mister Chameleon behavioral signals omzet in adaptive website-ervaringen.",
      blocks: [
        {
          type:    "hero",
          content: {
            headline: "Zo werkt het platform",
            text:     "Van behavioral signals naar realtime adaptive content — uitgelegd per laag.",
          },
        },
        {
          type:    "product-deep-dive",
          content: {
            sections: [
              { title: "Behavioral engine",     text: "Detecteert signals, sequences en funnel stages." },
              { title: "Confidence model",       text: "Bepaalt wanneer aanpassen veilig en relevant is." },
              { title: "Adaptive blocks",        text: "Hero, proof en CTA worden realtime aangepast." },
              { title: "Explainability layer",   text: "Elke beslissing is inzichtelijk via het debug-panel." },
              { title: "Scenario simulator",     text: "Test elk bezoekersprofiel zonder echte bezoekers." },
            ],
          },
        },
        {
          type:    "cta-block",
          content: {
            headline:    "Klaar om het in actie te zien?",
            primaryCta:  "Bekijk demo",
            primaryHref: "/demo",
          },
        },
      ],
    },

    // ── 3. Use Cases ─────────────────────────────────────────────────────────
    {
      slug:        "/use-cases",
      title:       "Use Cases — Mister Chameleon",
      description: "Hoe verschillende B2B-teams Mister Chameleon inzetten voor meer conversie.",
      blocks: [
        {
          type:    "hero",
          content: {
            headline: "Gebouwd voor teams die verder willen dan een statische site",
            text:     "Van SaaS naar agencies, van onboarding naar expansion — zie hoe Mister Chameleon werkt voor jouw context.",
          },
        },
        {
          type:    "use-case-grid",
          content: {
            items: [
              {
                title:    "B2B SaaS",
                text:     "Pas de homepage aan per funnel-fase: awareness → consideration → trial → customer. Geen handmatig segmenteren.",
                icon:     "layers",
                cta:      "Bekijk voorbeeld",
                ctaHref:  "/demo",
              },
              {
                title:    "Marketing agencies",
                text:     "Toon automatisch de meest relevante cases en resultaten op basis van bezoekersgedrag.",
                icon:     "globe",
                cta:      "Bekijk voorbeeld",
                ctaHref:  "/demo",
              },
              {
                title:    "ICT dienstverleners",
                text:     "Gedragsgestuurde content voor complexe B2B-koopprocessen met lange doorlooptijden.",
                icon:     "server",
                cta:      "Bekijk voorbeeld",
                ctaHref:  "/demo",
              },
              {
                title:    "Zakelijke dienstverlening",
                text:     "Expertise en vertrouwen tonen aan het juiste doelgroepsegment op het juiste moment.",
                icon:     "briefcase",
                cta:      "Bekijk voorbeeld",
                ctaHref:  "/demo",
              },
              {
                title:    "Customer onboarding",
                text:     "Na conversie schakelt de homepage automatisch over naar onboarding-modus.",
                icon:     "check-circle",
                cta:      "Bekijk voorbeeld",
                ctaHref:  "/demo",
              },
              {
                title:    "Expansion & upsell",
                text:     "Herken expansion-kandidaten en pas hero, proof en CTA aan voor een upgrade-flow.",
                icon:     "trending-up",
                cta:      "Bekijk voorbeeld",
                ctaHref:  "/demo",
              },
            ],
          },
        },
        {
          type:    "cta-block",
          content: {
            headline:    "Welke use case past bij jou?",
            text:        "Bekijk een live demo en zie hoe het werkt voor jouw sector en funnel.",
            primaryCta:  "Bekijk demo",
            primaryHref: "/demo",
          },
        },
      ],
    },

    // ── 4. Pricing ───────────────────────────────────────────────────────────
    {
      slug:        "/pricing",
      title:       "Pricing — Mister Chameleon",
      description: "Eenvoudige pricing. Slimmer naarmate je groeit.",
      blocks: [
        {
          type:    "pricing-header",
          content: {
            headline: "Eenvoudige pricing. Slimmer naarmate je groeit.",
            subtext:  "Je betaalt voor het platform. Extra enrichments gebruik je alleen als je die nodig hebt.",
          },
        },
        {
          type:    "pricing-plans",
          content: {
            plans: [
              {
                id:           "starter",
                name:         "Starter",
                priceMonthly: 79,
                priceYearly:  760,
                target:       "Voor teams die willen starten met adaptive experiences.",
                cta:          "Start gratis",
                ctaHref:      "/registreren",
                ctaVariant:   "secondary",
                features: [
                  "1 website",
                  "Basis personalisatie",
                  "Simpele rules",
                  "Standaard block variants",
                  "Basis analytics",
                  "Scenario preview light",
                ],
                notIncluded: [
                  "Advanced sequences",
                  "Lifecycle logic",
                  "Enrichment workflows",
                ],
              },
              {
                id:           "growth",
                name:         "Growth",
                priceMonthly: 249,
                priceYearly:  2390,
                target:       "Voor teams die serieus willen optimaliseren.",
                cta:          "Plan demo",
                ctaHref:      "/demo",
                ctaVariant:   "primary",
                highlighted:  true,
                features: [
                  "Alles in Starter",
                  "Volledige behavior engine",
                  "Sequence detection",
                  "Funnel stages",
                  "Confidence model",
                  "Scenario control",
                  "Post-conversion logic",
                  "Expanded rules",
                ],
              },
              {
                id:           "pro",
                name:         "Pro",
                priceMonthly: 599,
                priceYearly:  5750,
                target:       "Voor teams die hun website als revenue engine inzetten.",
                cta:          "Plan demo",
                ctaHref:      "/demo",
                ctaVariant:   "secondary",
                features: [
                  "Alles in Growth",
                  "Multi-site / multi-team",
                  "Advanced lifecycle logic",
                  "Expansion / retention modes",
                  "CRM-ready integration layer",
                  "Priority support",
                  "AI-ready architecture",
                ],
              },
            ],
          },
        },
        {
          type:    "enrichment-credits",
          content: {
            headline: "Gebruik extra data als je die nodig hebt",
            text:     "Enrichments zoals bedrijfsherkenning, geolocatie of CRM-matching werken op basis van credits. "
                    + "Je site blijft altijd werken, ook zonder credits.",
            bundles: [
              { credits: 1000,  priceEur: 10  },
              { credits: 5000,  priceEur: 40  },
              { credits: 20000, priceEur: 120 },
            ],
            examples: [
              { action: "IP bedrijfsherkenning", credits: 1 },
              { action: "CRM match",             credits: 2 },
              { action: "AI verrijking",         credits: 3 },
            ],
          },
        },
        {
          type:    "pricing-cta",
          content: {
            headline:    "Niet zeker welk plan past?",
            text:        "Plan een demo en we laten zien welke setup past bij jouw funnel, team en groeifase.",
            primaryCta:  "Plan een demo",
            primaryHref: "/demo",
          },
        },
      ],
    },

    // ── 5. Demo / Contact ────────────────────────────────────────────────────
    {
      slug:        "/demo",
      title:       "Demo aanvragen — Mister Chameleon",
      description: "Plan een gratis demo van 20 minuten en zie hoe Mister Chameleon werkt voor jouw funnel.",
      blocks: [
        {
          type:    "demo-hero",
          content: {
            headline:  "Bekijk Mister Chameleon in actie",
            text:      "20 minuten. Gratis. Geen verplichtingen. We laten je live zien hoe de adaptive engine werkt voor jouw funnel en sector.",
            formTitle: "Plan je demo",
          },
        },
        {
          type:    "contact-form",
          content: {
            fields: ["name", "email", "company", "message"],
            submitLabel: "Demo plannen",
          },
        },
        {
          type:    "demo-proof",
          content: {
            points: [
              "Live demo op jouw website of een testomgeving",
              "Scenario-simulator: zie elke bezoekersbeleving",
              "Uitleg van rules, confidence en beslissingslogica",
              "Concrete aanbeveling voor jouw funnel en team",
            ],
          },
        },
      ],
    },

    // ── 6. About ─────────────────────────────────────────────────────────────
    {
      slug:        "/over-ons",
      title:       "Over ons — Mister Chameleon",
      description: "Wie we zijn, waarom we Mister Chameleon hebben gebouwd en wat ons drijft.",
      blocks: [
        {
          type:    "hero",
          content: {
            headline: "Wij geloven dat elke bezoeker een unieke ervaring verdient",
            text:     "Mister Chameleon is gebouwd vanuit frustratie met statische websites en handmatig testen. "
                    + "We maken adaptieve ervaringen toegankelijk voor elk B2B-team.",
          },
        },
        {
          type:    "mission",
          content: {
            headline: "Onze missie",
            text:     "Personalisatie democratiseren voor groeiende B2B-teams — zonder complexe toolstacks, "
                    + "handmatige segmentatie of black-box algoritmen.",
          },
        },
        {
          type:    "cta-block",
          content: {
            headline:    "Meer weten?",
            primaryCta:  "Bekijk demo",
            primaryHref: "/demo",
          },
        },
      ],
    },

    // ── 7. Login / Onboarding placeholder ────────────────────────────────────
    {
      slug:        "/registreren",
      title:       "Start gratis — Mister Chameleon",
      description: "Maak een gratis account aan en zet je eerste adaptive flow live.",
      blocks: [
        {
          type:    "signup-hero",
          content: {
            headline: "Start gratis. Geen creditcard.",
            text:     "14 dagen gratis, daarna kies je zelf je plan. Je eerste adaptive flow staat live binnen een dag.",
          },
        },
        {
          type:    "signup-form",
          content: {
            fields:      ["name", "email", "company", "password"],
            submitLabel: "Account aanmaken",
            loginHref:   "/inloggen",
          },
        },
      ],
    },
  ],
};
