/**
 * Careers / Werken-bij Blueprint — Mister Chameleon Demo
 *
 * Models a CANDIDATE journey instead of a sales funnel.
 * Use this blueprint to demonstrate adaptive personalization on a
 * recruitment or werken-bij website.
 *
 * ── What this file contains ───────────────────────────────────────────────────
 *
 *   Variant seeds    4 hero + 3 proof + 4 CTA variants with Dutch copy
 *   Canonical rules  6 behavioral rules modeling the candidate journey
 *   Scenario map     6 named candidate presets for Scenario Control
 *   Page definitions 8 pages: homepage, vacatures, job detail, teams, cultuur,
 *                    solliciteren, open sollicitatie, over ons
 *   Sequences        4 named candidate journey sequences
 *
 * ── Journey field mapping ─────────────────────────────────────────────────────
 *
 *   The careers journey reuses existing platform fields, remapped to
 *   candidate-specific semantics:
 *
 *   Platform field              Candidate meaning
 *   ──────────────────────────  ──────────────────────────────────────
 *   journey.hasVisitedCases     Visited the job listing page (/vacatures)
 *   journey.hasVisitedAbout     Viewed a specific job detail page
 *   journey.hasVisitedContact   Visited the application form or contact
 *   journey.hasStartedForm      Started an application form
 *   journey.hasSubmittedForm    Submitted an application
 *   journey.intentScore         Application intent score (0–100)
 *   journey.frictionScore       Application friction / hesitation signal
 *   journey.hasClickedCta       Clicked a primary apply or browse CTA
 *   journey.funnelStage         Candidate journey stage (see rules below)
 *
 * ── Scenario → rule → variant map ────────────────────────────────────────────
 *
 *   Scenario            Rule                             Hero                        Proof                      CTA
 *   ──────────────────  ───────────────────────────────  ──────────────────────────  ─────────────────────────  ──────────────────────
 *   Nieuw bezoek        rule_careers_awareness           hero_careers_default        proof_careers_default      cta_careers_browse
 *   Vacature-verkenner  rule_careers_explorer            hero_careers_job_match      proof_careers_team         cta_careers_browse
 *   Functie-interesse   rule_careers_job_interest        hero_careers_job_match      proof_careers_team         cta_careers_apply
 *   Hoge sollicitatie-  rule_careers_high_intent         hero_careers_high_intent    proof_careers_team         cta_careers_apply
 *   intent
 *   Formulier drop-off  rule_careers_drop_off            hero_careers_reassurance    proof_careers_reassurance  cta_careers_open
 *   Sollicitatie        rule_careers_submitted           hero_careers_high_intent    proof_careers_default      cta_careers_contact
 *   ingediend
 *
 * ── Priority order ────────────────────────────────────────────────────────────
 *
 *    5  rule_careers_submitted      (application confirmed)
 *   10  rule_careers_drop_off       (started form, abandoned)
 *   20  rule_careers_high_intent    (strong apply signals)
 *   30  rule_careers_job_interest   (viewed job detail)
 *   40  rule_careers_explorer       (browsing job list)
 *   50  rule_careers_awareness      (new / low-signal visitor)
 */

import type { Blueprint } from "@/lib/blueprint/types";

export const CAREERS_PLATFORM_BLUEPRINT: Blueprint = {
  id:             "careers-platform",
  version:        "1.0.0",
  name:           "Careers / Werken-bij Platform",
  description:    "Adaptieve werken-bij website die reageert op de kandidaatreis — "
                + "van eerste bezoek tot sollicitatie. Inclusief gedragsregels, "
                + "sollicitatieflow en candidate journey presets.",
  industry:       "recruitment",
  defaultThemeId: "editorial-classic",

  // ── Hero variants ──────────────────────────────────────────────────────────
  //
  // Meanings:
  //   default       — brand intro, welcoming new visitors; showcase culture
  //   job_match     — vacature-explorer / functie-interesse; role-led messaging
  //   high_intent   — ready-to-apply; urgency + direct apply CTA
  //   reassurance   — drop-off recovery; removes friction, builds trust

  heroVariants: [
    {
      key:    "hero_careers_default",
      source: "blueprint",
      label:  "Careers — Welkom & merkintroductie",
      content: {
        eyebrow:      "Werken bij [Bedrijfsnaam]",
        headline:     "Bouw mee aan iets dat er toe doet.",
        text:         "We zoeken nieuwsgierige mensen die uitdagingen omzetten in oplossingen. "
                    + "Geen politiek, geen bureaucratie — wel eigenaarschap, vrijheid en ruimte "
                    + "om te groeien. Ontdek onze open rollen.",
        primaryCta:   "Bekijk vacatures",
        secondaryCta: "Leer ons team kennen",
      },
    },
    {
      key:    "hero_careers_job_match",
      source: "blueprint",
      label:  "Careers — Vacature-verkenner / functie-interesse",
      content: {
        eyebrow:      "Jouw volgende stap begint hier",
        headline:     "We hebben een rol die bij jou past.",
        text:         "Je hebt rondgekeken — goed idee. We hebben rollen in engineering, "
                    + "product, design en commercie. Elk team werkt autonoom en heeft "
                    + "directe impact op onze richting.",
        primaryCta:   "Bekijk alle vacatures",
        secondaryCta: "Bekijk onze teams",
      },
    },
    {
      key:    "hero_careers_high_intent",
      source: "blueprint",
      label:  "Careers — Hoge sollicitatie-intentie",
      content: {
        eyebrow:      "Klaar om de volgende stap te zetten?",
        headline:     "Solliciteer vandaag. We reageren binnen 3 werkdagen.",
        text:         "Je hebt de functie bekeken en weet wat je wilt. Onze selectieprocedure "
                    + "is transparant: één screening, één gesprek, één technische sessie. "
                    + "Geen ellenlange trajecten.",
        primaryCta:   "Solliciteer nu",
        secondaryCta: "Lees over onze selectieprocedure",
      },
    },
    {
      key:    "hero_careers_reassurance",
      source: "blueprint",
      label:  "Careers — Geruststelling (drop-off recovery)",
      content: {
        eyebrow:      "Twijfels? Dat begrijpen we.",
        headline:     "Een sollicitatie hoeft niet perfect te zijn.",
        text:         "Wij selecteren op potentieel en houding, niet op een vlekkeloze cv. "
                    + "Stuur gerust een open sollicitatie als je nog niet zeker bent — "
                    + "we denken graag met je mee over de beste fit.",
        primaryCta:   "Stuur open sollicitatie",
        secondaryCta: "Stel een vraag",
      },
    },
  ],

  // ── Proof variants ─────────────────────────────────────────────────────────
  //
  // Meanings:
  //   default       — company culture, values, general credibility
  //   team          — team spotlights and specific department proof
  //   reassurance   — friction removal: transparency, no-pressure process

  proofVariants: [
    {
      key:    "proof_careers_default",
      source: "blueprint",
      label:  "Careers — Cultuur & waarden",
      content: {
        headline: "Waarom mensen bij ons blijven",
        text:     "We bouwen een omgeving waar slimme mensen hun beste werk doen. "
                + "Dat betekent: autonomie, eerlijkheid, snelle beslissingen en "
                + "een cultuur die groei beloont in plaats van uren.",
        stats: [
          { stat: "4.6/5",  label: "gemiddelde medewerkerstevredenheid" },
          { stat: "87 %",   label: "zou [Bedrijfsnaam] aanbevelen als werkgever" },
          { stat: "< 6 wkn", label: "gemiddelde doorlooptijd selectieprocedure" },
        ],
      },
    },
    {
      key:    "proof_careers_team",
      source: "blueprint",
      label:  "Careers — Team spotlights",
      content: {
        headline: "Leer de mensen kennen achter het werk",
        teams: [
          {
            name:  "Engineering",
            size:  "28 engineers",
            quote: "We bouwen dingen die werken — en daarna maken we ze mooier.",
            member: "Roos, Senior Backend Engineer",
          },
          {
            name:  "Product & Design",
            size:  "12 mensen",
            quote: "Elke beslissing begint bij de gebruiker. Echt.",
            member: "Daan, Product Lead",
          },
          {
            name:  "Commercie",
            size:  "9 mensen",
            quote: "We verkopen alleen wat we zelf zouden kopen.",
            member: "Farah, Account Executive",
          },
        ],
      },
    },
    {
      key:    "proof_careers_reassurance",
      source: "blueprint",
      label:  "Careers — Transparantie & geruststelling",
      content: {
        headline: "Onze selectieprocedure is eerlijk en menselijk",
        text:     "Geen puzzeltjes, geen trick questions. We willen weten wie je bent "
                + "en hoe je denkt — niet of je onze vragen kunt googelen.",
        points: [
          "Reactie binnen 3 werkdagen na ontvangst",
          "Maximaal 3 gespreksmomenten, nooit meer",
          "Altijd inhoudelijke feedback, ook bij afwijzing",
          "Open sollicitaties worden serieus behandeld",
          "Geen verplicht assessmentcentrum voor technische rollen",
        ],
      },
    },
  ],

  // ── CTA variants ───────────────────────────────────────────────────────────

  ctaVariants: [
    {
      key:    "cta_careers_browse",
      source: "blueprint",
      label:  "Careers — Bekijk vacatures (verkenner)",
      content: {
        label:   "Bekijk alle vacatures",
        href:    "/vacatures",
        variant: "primary",
        subtext: "20+ open rollen in engineering, product & commercie",
      },
    },
    {
      key:    "cta_careers_apply",
      source: "blueprint",
      label:  "Careers — Solliciteer nu (hoge intentie)",
      content: {
        label:   "Solliciteer nu",
        href:    "/solliciteren",
        variant: "primary",
        subtext: "Reactie binnen 3 werkdagen · Geen assessment verplicht",
      },
    },
    {
      key:    "cta_careers_open",
      source: "blueprint",
      label:  "Careers — Open sollicitatie (drop-off recovery)",
      content: {
        label:   "Stuur open sollicitatie",
        href:    "/open-sollicitatie",
        variant: "secondary",
        subtext: "Geen specifieke rol? We denken graag mee.",
      },
    },
    {
      key:    "cta_careers_contact",
      source: "blueprint",
      label:  "Careers — Stel een vraag (post-sollicitatie)",
      content: {
        label:   "Stel een vraag",
        href:    "/contact",
        variant: "secondary",
        subtext: "Ons recruitersteam reageert binnen 1 werkdag",
      },
    },
  ],

  // ── Canonical candidate journey rules ─────────────────────────────────────
  //
  // Rules are scoped to the careers homepage (/) and power the adaptive hero,
  // proof, and CTA blocks. Field names map to existing journey fields —
  // see "Journey field mapping" in the file header for the semantic mapping.

  rules: [
    // Priority 5 — Application submitted ─────────────────────────────────────
    {
      id:       "rule_careers_submitted",
      source:   "blueprint",
      priority: 5,
      label:    "Sollicitatie ingediend — bedank & volgende stap",
      condition: {
        type:  "field",
        field: "journey.hasSubmittedForm",
        operator: "equals",
        value: true,
      },
      plan: {
        heroKey:  "hero_careers_high_intent",
        proofKey: "proof_careers_default",
        ctaKey:   "cta_careers_contact",
        themeKey: "corporate-trust",
      },
      reason: "Kandidaat heeft een sollicitatie ingediend — bevestig ontvangst, "
            + "stel gerust over het vervolg en bied een contactmogelijkheid.",
    },

    // Priority 10 — Form drop-off recovery ───────────────────────────────────
    {
      id:       "rule_careers_drop_off",
      source:   "blueprint",
      priority: 10,
      label:    "Sollicitatieformulier afgebroken — geruststelling",
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
        heroKey:  "hero_careers_reassurance",
        proofKey: "proof_careers_reassurance",
        ctaKey:   "cta_careers_open",
        themeKey: "minimal-neutral",
      },
      reason: "Kandidaat begon een sollicitatieformulier maar haakte af met wrijving — "
            + "geruststelling over de procedure, open sollicitatie als zachte uitweg.",
    },

    // Priority 20 — High application intent ──────────────────────────────────
    {
      id:       "rule_careers_high_intent",
      source:   "blueprint",
      priority: 20,
      label:    "Hoge sollicitatie-intentie — klaar om te solliciteren",
      condition: {
        type:  "group",
        logic: "or",
        conditions: [
          {
            type:  "group",
            logic: "and",
            conditions: [
              { type: "field", field: "journey.hasVisitedAbout", operator: "equals", value: true },
              { type: "field", field: "journey.hasClickedCta",   operator: "equals", value: true },
            ],
          },
          { type: "field", field: "journey.intentScore", operator: "greater_than_or_equal", value: 60 },
          { type: "field", field: "journey.funnelStage", operator: "equals", value: "high_intent" },
          {
            type:  "group",
            logic: "and",
            conditions: [
              { type: "field", field: "journey.hasVisitedAbout",   operator: "equals", value: true },
              { type: "field", field: "journey.hasVisitedContact", operator: "equals", value: true },
            ],
          },
        ],
      },
      plan: {
        heroKey:  "hero_careers_high_intent",
        proofKey: "proof_careers_team",
        ctaKey:   "cta_careers_apply",
        themeKey: "modern-saas",
      },
      reason: "Kandidaat toont sterke sollicitatie-intentie (functiepagina bekeken, "
            + "CTA geklikt of hoge intentiescore) — directe apply-hero, team-bewijs, "
            + "laagdrempelige solliciteer-CTA.",
    },

    // Priority 30 — Job / role interest ──────────────────────────────────────
    {
      id:       "rule_careers_job_interest",
      source:   "blueprint",
      priority: 30,
      label:    "Functie-interesse — specifieke rol bekeken",
      condition: {
        type:  "group",
        logic: "or",
        conditions: [
          { type: "field", field: "journey.hasVisitedAbout",   operator: "equals", value: true },
          { type: "field", field: "journey.funnelStage",       operator: "equals", value: "intent" },
          {
            type:  "group",
            logic: "and",
            conditions: [
              { type: "field", field: "journey.hasVisitedCases", operator: "equals", value: true },
              { type: "field", field: "journey.intentScore",     operator: "greater_than_or_equal", value: 30 },
            ],
          },
          { type: "field", field: "journey.matchedSequences", operator: "contains", value: "vacatures_to_detail" },
        ],
      },
      plan: {
        heroKey:  "hero_careers_job_match",
        proofKey: "proof_careers_team",
        ctaKey:   "cta_careers_apply",
        themeKey: "tech-clarity",
      },
      reason: "Kandidaat heeft een specifieke functie bekeken of toont gerichte interesse — "
            + "functiematch-hero, team-spotlight, directe apply-CTA.",
    },

    // Priority 40 — Vacature explorer ────────────────────────────────────────
    {
      id:       "rule_careers_explorer",
      source:   "blueprint",
      priority: 40,
      label:    "Vacature-verkenner — oriënterend bezoek",
      condition: {
        type:  "group",
        logic: "or",
        conditions: [
          { type: "field", field: "journey.hasVisitedCases",  operator: "equals", value: true },
          { type: "field", field: "journey.funnelStage",      operator: "equals", value: "consideration" },
          { type: "field", field: "visitType",                 operator: "equals", value: "returning" },
          { type: "field", field: "journey.matchedSequences", operator: "contains", value: "homepage_to_vacatures" },
        ],
      },
      plan: {
        heroKey:  "hero_careers_job_match",
        proofKey: "proof_careers_team",
        ctaKey:   "cta_careers_browse",
        themeKey: "editorial-classic",
      },
      reason: "Oriënterende kandidaat die vacatures bekijkt of terugkeert — "
            + "functiematch-hero met team-bewijs, verken-CTA.",
    },

    // Priority 50 — Awareness / new visitor ──────────────────────────────────
    {
      id:       "rule_careers_awareness",
      source:   "blueprint",
      priority: 50,
      label:    "Bewustzijnsfase — nieuw of onbekend bezoek",
      condition: {
        type:     "field",
        field:    "journey.funnelStage",
        operator: "equals",
        value:    "awareness",
      },
      plan: {
        heroKey:  "hero_careers_default",
        proofKey: "proof_careers_default",
        ctaKey:   "cta_careers_browse",
        themeKey: "editorial-classic",
      },
      reason: "Nieuwe of laag-signaal bezoeker — merkintroductie, cultuur-bewijs, "
            + "zachte vacature-CTA.",
    },
  ],

  // ── Default plan ───────────────────────────────────────────────────────────

  defaultPlan: {
    heroKey:  "hero_careers_default",
    proofKey: "proof_careers_default",
    ctaKey:   "cta_careers_browse",
    reason:   "Geen kandidaatregel matcht — nieuwe of directe bezoeker krijgt de "
            + "standaard werken-bij merkervaring.",
  },

  // ── Scenario presets ───────────────────────────────────────────────────────
  //
  // 6 named candidate journey stages for Scenario Control, tests, and
  // admin debug documentation.

  scenarios: [
    {
      name:   "Nieuw bezoek",
      ruleId: "rule_careers_awareness",
      journeyOverrides: {
        funnelStage: "awareness",
      },
      plan: {
        heroKey:  "hero_careers_default",
        proofKey: "proof_careers_default",
        ctaKey:   "cta_careers_browse",
        themeKey: "editorial-classic",
      },
      expectedBand: "low",
    },
    {
      name:   "Vacature-verkenner",
      ruleId: "rule_careers_explorer",
      journeyOverrides: {
        funnelStage:      "consideration",
        hasVisitedCases:  true,
        intentScore:      18,
        pageViewCount:    2,
        matchedSequences: ["homepage_to_vacatures"],
      },
      plan: {
        heroKey:  "hero_careers_job_match",
        proofKey: "proof_careers_team",
        ctaKey:   "cta_careers_browse",
        themeKey: "editorial-classic",
      },
      expectedBand: "medium",
    },
    {
      name:   "Functie-interesse",
      ruleId: "rule_careers_job_interest",
      journeyOverrides: {
        funnelStage:          "intent",
        hasVisitedCases:      true,
        hasVisitedAbout:      true,
        intentScore:          38,
        engagementScore:      45,
        pageViewCount:        4,
        matchedSequences:     ["homepage_to_vacatures", "vacatures_to_detail"],
      },
      plan: {
        heroKey:  "hero_careers_job_match",
        proofKey: "proof_careers_team",
        ctaKey:   "cta_careers_apply",
        themeKey: "tech-clarity",
      },
      expectedBand: "medium",
    },
    {
      name:   "Hoge sollicitatie-intentie",
      ruleId: "rule_careers_high_intent",
      journeyOverrides: {
        funnelStage:          "high_intent",
        hasVisitedCases:      true,
        hasVisitedAbout:      true,
        hasVisitedContact:    true,
        hasClickedCta:        true,
        intentScore:          72,
        engagementScore:      65,
        pageViewCount:        6,
        matchedSequences:     ["homepage_to_vacatures", "vacatures_to_detail"],
      },
      plan: {
        heroKey:  "hero_careers_high_intent",
        proofKey: "proof_careers_team",
        ctaKey:   "cta_careers_apply",
        themeKey: "modern-saas",
      },
      expectedBand: "high",
    },
    {
      name:   "Formulier drop-off",
      ruleId: "rule_careers_drop_off",
      journeyOverrides: {
        funnelStage:      "high_intent",
        hasVisitedCases:  true,
        hasVisitedAbout:  true,
        hasClickedCta:    true,
        hasStartedForm:   true,
        hasSubmittedForm: false,
        intentScore:      65,
        frictionScore:    22,
        formStartCount:   1,
        pageViewCount:    7,
      },
      plan: {
        heroKey:  "hero_careers_reassurance",
        proofKey: "proof_careers_reassurance",
        ctaKey:   "cta_careers_open",
        themeKey: "minimal-neutral",
      },
      expectedBand: "high",
    },
    {
      name:   "Sollicitatie ingediend",
      ruleId: "rule_careers_submitted",
      journeyOverrides: {
        funnelStage:      "customer",
        hasVisitedCases:  true,
        hasVisitedAbout:  true,
        hasClickedCta:    true,
        hasStartedForm:   true,
        hasSubmittedForm: true,
        intentScore:      95,
        pageViewCount:    8,
        formStartCount:   1,
      },
      plan: {
        heroKey:  "hero_careers_high_intent",
        proofKey: "proof_careers_default",
        ctaKey:   "cta_careers_contact",
        themeKey: "corporate-trust",
      },
      expectedBand: "very_high",
    },
  ],

  // ── Named candidate journey sequences ─────────────────────────────────────

  sequences: [
    {
      key:   "homepage_to_vacatures",
      label: "Homepage → Vacatureoverzicht",
      steps: ["/", "/vacatures"],
    },
    {
      key:   "vacatures_to_detail",
      label: "Vacatureoverzicht → Vacaturedetail",
      steps: ["/vacatures", "/vacatures/:slug"],
    },
    {
      key:   "detail_to_apply",
      label: "Vacaturedetail → Sollicitatieformulier",
      steps: ["/vacatures/:slug", "/solliciteren"],
    },
    {
      key:   "homepage_to_apply",
      label: "Homepage → Direct solliciteren",
      steps: ["/", "/solliciteren"],
    },
  ],

  // ── Page definitions ───────────────────────────────────────────────────────
  //
  // 8 pages seeded into CMS when blueprint is applied.
  // Adaptive blocks use slotKey; other blocks are static.

  pages: [
    // ── 1. Careers homepage ──────────────────────────────────────────────────
    {
      slug:        "/",
      title:       "Werken bij [Bedrijfsnaam] — Bouw mee aan iets dat er toe doet",
      description: "Ontdek onze open rollen, leer ons team kennen en solliciteer vandaag.",
      blocks: [
        {
          type:    "hero",
          slotKey: "hero",
          content: {
            fallbackHeadline: "Bouw mee aan iets dat er toe doet.",
          },
        },
        {
          type:    "highlights",
          content: {
            headline: "Waarom mensen bij ons komen — en blijven",
            items: [
              { icon: "home",        title: "Hybride werken",       text: "Zelf kiezen wanneer je op kantoor bent. Geen verplichting, wel een fijne plek." },
              { icon: "trending-up", title: "Groeikansen",          text: "Budget voor opleiding, conferenties en persoonlijke ontwikkeling. Jaarlijks." },
              { icon: "users",       title: "Kleine, sterke teams", text: "Geen grote corporate structuren. Kleine teams met veel verantwoordelijkheid." },
              { icon: "heart",       title: "Echte impact",         text: "Jouw werk komt direct terecht bij klanten. Geen jarenlange roadmaps." },
            ],
          },
        },
        {
          type:    "proof",
          slotKey: "proof",
          content: {
            fallbackHeadline: "Waarom mensen bij ons blijven.",
          },
        },
        {
          type:    "open-roles-preview",
          content: {
            headline: "Recente vacatures",
            limit:    4,
            linkText: "Bekijk alle vacatures",
            linkHref: "/vacatures",
          },
        },
        {
          type:    "cta-banner",
          slotKey: "cta",
          content: {
            fallbackLabel: "Bekijk vacatures",
            fallbackHref:  "/vacatures",
          },
        },
      ],
    },

    // ── 2. Vacatureoverzicht ─────────────────────────────────────────────────
    {
      slug:        "/vacatures",
      title:       "Vacatures — Werken bij [Bedrijfsnaam]",
      description: "Bekijk alle open rollen bij [Bedrijfsnaam]. Filter op team, locatie en contractvorm.",
      blocks: [
        {
          type:    "page-header",
          content: {
            headline:    "Open rollen",
            subheadline: "Filter op team of locatie en vind de functie die bij je past.",
          },
        },
        {
          type:    "job-list",
          content: {
            filters:     ["team", "locatie", "contractvorm"],
            emptyState:  "Op dit moment zijn er geen openstaande vacatures in deze categorie.",
            showCount:   true,
          },
        },
        {
          type:    "open-application-cta",
          content: {
            headline: "Geen passende vacature?",
            text:     "Stuur een open sollicitatie en we houden je op de hoogte van nieuwe rollen.",
            ctaLabel: "Open sollicitatie sturen",
            ctaHref:  "/open-sollicitatie",
          },
        },
      ],
    },

    // ── 3. Vacaturedetail ────────────────────────────────────────────────────
    {
      slug:        "/vacatures/:slug",
      title:       "[Functietitel] — Werken bij [Bedrijfsnaam]",
      description: "Lees alles over de rol, het team en de selectieprocedure.",
      blocks: [
        {
          type:    "job-detail-header",
          content: {
            showTeam:      true,
            showLocation:  true,
            showContract:  true,
          },
        },
        {
          type:    "job-detail-body",
          content: {
            sections: ["over-de-rol", "wat-je-gaat-doen", "wat-we-zoeken", "wat-we-bieden"],
          },
        },
        {
          type:    "apply-sidebar",
          content: {
            ctaLabel:    "Solliciteer op deze functie",
            ctaHref:     "/solliciteren",
            shareLabel:  "Deel deze vacature",
          },
        },
        {
          type:    "team-spotlight",
          content: {
            headline: "Wie worden je collega's?",
          },
        },
        {
          type:    "process-steps",
          content: {
            headline: "Onze selectieprocedure",
            steps: [
              { step: 1, title: "Screening",          duration: "30 min",    text: "Kennismaking met een recruiter." },
              { step: 2, title: "Eerste gesprek",     duration: "60 min",    text: "Inhoudelijk gesprek met de hiring manager." },
              { step: 3, title: "Technische sessie",  duration: "90 min",    text: "Praktijkgericht — geen puzzels, wel echte cases." },
              { step: 4, title: "Aanbod",             duration: "< 3 dagen", text: "We laten je snel weten waar je aan toe bent." },
            ],
          },
        },
      ],
    },

    // ── 4. Teams & afdelingen ────────────────────────────────────────────────
    {
      slug:        "/teams",
      title:       "Onze teams — Werken bij [Bedrijfsnaam]",
      description: "Leer de mensen kennen die [Bedrijfsnaam] bouwen. Kleine teams, grote impact.",
      blocks: [
        {
          type:    "page-header",
          content: {
            headline:    "Kleine teams, grote verantwoordelijkheid",
            subheadline: "We werken in autonome teams. Elk team heeft directe impact op het product.",
          },
        },
        {
          type:    "team-grid",
          content: {
            teams: [
              { key: "engineering", label: "Engineering",     icon: "code",        description: "Backend, frontend en platform engineers." },
              { key: "product",     label: "Product & Design", icon: "layers",      description: "Product managers en UX designers." },
              { key: "data",        label: "Data & Analytics", icon: "bar-chart",   description: "Data engineers en analisten." },
              { key: "sales",       label: "Sales & Commercie", icon: "trending-up", description: "Account executives en business developers." },
              { key: "marketing",   label: "Marketing",         icon: "megaphone",  description: "Brand, content en growth marketeers." },
              { key: "operations",  label: "Operations",        icon: "settings",   description: "HR, finance en office management." },
            ],
          },
        },
        {
          type:    "vacancies-by-team",
          content: {
            headline: "Openstaande rollen per team",
          },
        },
      ],
    },

    // ── 5. Cultuur ───────────────────────────────────────────────────────────
    {
      slug:        "/cultuur",
      title:       "Onze cultuur — Werken bij [Bedrijfsnaam]",
      description: "Hoe we samenwerken, beslissingen nemen en groeien.",
      blocks: [
        {
          type:    "page-header",
          content: {
            headline:    "Cultuur is wat je doet als niemand kijkt",
            subheadline: "Onze waarden zijn geen poster op de muur.",
          },
        },
        {
          type:    "values",
          content: {
            values: [
              { title: "Eigenaarschap",    icon: "key",        text: "Je neemt verantwoordelijkheid voor het resultaat, niet alleen voor de taak." },
              { title: "Eerlijkheid",      icon: "message",    text: "We zeggen wat we denken, ook als dat ongemakkelijk is." },
              { title: "Leergierigheid",   icon: "book-open",  text: "We vragen altijd eerst 'waarom' en stellen aannames ter discussie." },
              { title: "Samenwerken",      icon: "users",      text: "Sterke individuele bijdragen, maar nooit ten koste van het team." },
            ],
          },
        },
        {
          type:    "employee-quotes",
          content: {
            headline: "In hun eigen woorden",
          },
        },
        {
          type:    "benefits",
          content: {
            headline: "Wat we bieden",
            items: [
              "Marktconform salaris met jaarlijkse evaluatie",
              "25 vakantiedagen + 1 vrijwilligersdag",
              "€ 1.500 jaarlijks opleidingsbudget",
              "Hybride werken — kantoor in Amsterdam, remote mogelijk",
              "Pensioenregeling en collectieve zorgverzekering",
              "Laptop en thuiswerkvergoeding",
            ],
          },
        },
      ],
    },

    // ── 6. Sollicitatieformulier ─────────────────────────────────────────────
    {
      slug:        "/solliciteren",
      title:       "Solliciteer — Werken bij [Bedrijfsnaam]",
      description: "Stuur je sollicitatie in. We reageren binnen 3 werkdagen.",
      blocks: [
        {
          type:    "page-header",
          content: {
            headline:    "Leuk dat je solliciteert",
            subheadline: "Vul het formulier in. We reageren binnen 3 werkdagen.",
          },
        },
        {
          type:    "application-form",
          content: {
            fields: [
              { name: "naam",         label: "Naam",                    type: "text",     required: true },
              { name: "email",        label: "E-mailadres",             type: "email",    required: true },
              { name: "telefoon",     label: "Telefoonnummer",          type: "tel",      required: false },
              { name: "functie",      label: "Functie waarop je solliciteert", type: "select", required: true },
              { name: "motivatie",    label: "Waarom wil je bij ons werken?",  type: "textarea", required: true },
              { name: "cv",          label: "CV (PDF)",                type: "file",     required: true },
              { name: "linkedin",     label: "LinkedIn (optioneel)",    type: "url",      required: false },
            ],
            submitLabel: "Verstuur sollicitatie",
            privacyNote: "We verwerken je gegevens conform onze privacyverklaring en bewaren CV's maximaal 4 weken na afwijzing.",
          },
        },
        {
          type:    "process-summary",
          content: {
            headline: "Wat gebeurt er na je sollicitatie?",
            steps: [
              "We bevestigen ontvangst per e-mail",
              "Een recruiter neemt binnen 3 werkdagen contact op",
              "Je ontvangt altijd feedback, ook bij afwijzing",
            ],
          },
        },
      ],
    },

    // ── 7. Open sollicitatie ─────────────────────────────────────────────────
    {
      slug:        "/open-sollicitatie",
      title:       "Open sollicitatie — Werken bij [Bedrijfsnaam]",
      description: "Geen passende vacature gevonden? Stuur een open sollicitatie.",
      blocks: [
        {
          type:    "page-header",
          content: {
            headline:    "Geen passende vacature? Toch solliciteren.",
            subheadline: "We houden je profiel bij en nemen contact op zodra er een match is.",
          },
        },
        {
          type:    "open-application-form",
          content: {
            fields: [
              { name: "naam",       label: "Naam",                       type: "text",     required: true },
              { name: "email",      label: "E-mailadres",                type: "email",    required: true },
              { name: "interesse",  label: "In welk team heb je interesse?", type: "select", required: true },
              { name: "intro",      label: "Vertel kort wie je bent",    type: "textarea", required: true },
              { name: "cv",        label: "CV (optioneel)",             type: "file",     required: false },
              { name: "linkedin",   label: "LinkedIn (optioneel)",       type: "url",      required: false },
            ],
            submitLabel: "Stuur open sollicitatie",
          },
        },
      ],
    },

    // ── 8. Over ons (voor kandidaten) ────────────────────────────────────────
    {
      slug:        "/over-ons",
      title:       "Over [Bedrijfsnaam] — Wie we zijn en wat we bouwen",
      description: "Lees over onze missie, ons product en de mensen achter het bedrijf.",
      blocks: [
        {
          type:    "page-header",
          content: {
            headline:    "Wie we zijn",
            subheadline: "We bouwen [product] voor [doelgroep]. Al [X] jaar, met een team van [N] mensen.",
          },
        },
        {
          type:    "mission",
          content: {
            headline: "Onze missie",
            text:     "[Missie van het bedrijf — placeholder voor tenant-invulling]",
          },
        },
        {
          type:    "company-facts",
          content: {
            facts: [
              { stat: "[N]+",     label: "medewerkers" },
              { stat: "[N]+",     label: "klanten" },
              { stat: "[Stad]",   label: "hoofdkantoor" },
              { stat: "[Jaar]",   label: "opgericht" },
            ],
          },
        },
        {
          type:    "leadership",
          content: {
            headline: "Het team achter het bedrijf",
          },
        },
        {
          type:    "cta-banner",
          content: {
            headline: "Wil je deel uitmaken van dit team?",
            ctaLabel: "Bekijk onze vacatures",
            ctaHref:  "/vacatures",
          },
        },
      ],
    },
  ],
};
