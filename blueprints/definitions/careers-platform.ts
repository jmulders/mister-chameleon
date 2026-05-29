/**
 * Careers / Werken-bij Blueprint
 *
 * A complete starting configuration for recruitment sites, werken-bij pages,
 * and employer-brand platforms that use adaptive personalization to guide
 * candidates through their application journey.
 *
 * ─── Candidate journey model ─────────────────────────────────────────────────
 *
 *   Unlike a B2B sales funnel this blueprint models a CANDIDATE journey.
 *   Existing platform journey fields are remapped to recruitment semantics:
 *
 *   Platform field                   Candidate meaning
 *   ─────────────────────────────    ──────────────────────────────────────────
 *   journey.hasVisitedCases          Visited the job listing page (/vacatures)
 *   journey.hasVisitedAbout          Viewed a specific job detail page
 *   journey.hasVisitedContact        Visited the application form or contact page
 *   journey.hasStartedForm           Started an application form
 *   journey.hasSubmittedForm         Completed and submitted an application
 *   journey.hasClickedCta            Clicked a primary apply or browse CTA
 *   journey.intentScore              Application intent score (0–100)
 *   journey.frictionScore            Application friction / hesitation signal
 *   journey.funnelStage              Candidate stage (awareness→explorer→intent→converted)
 *   visitType                        New vs returning candidate visitor
 *
 * ─── Scenario → rule → variant mapping ────────────────────────────────────────
 *
 *   Scenario           Rule ID                         Hero                       Proof                      CTA
 *   ────────────────   ──────────────────────────────  ─────────────────────────  ─────────────────────────  ──────────────────────
 *   Nieuw bezoek       careers_platform_rule_1         hero_careers_default       proof_careers_default      cta_careers_browse
 *   Vacature-verkenner careers_platform_rule_2         hero_careers_job_match     proof_careers_team         cta_careers_browse
 *   Functie-interesse  careers_platform_rule_3         hero_careers_job_match     proof_careers_team         cta_careers_apply
 *   Hoge intentie      careers_platform_rule_4         hero_careers_high_intent   proof_careers_team         cta_careers_apply
 *   Formulier drop-off careers_platform_rule_5         hero_careers_reassurance   proof_careers_reassurance  cta_careers_open
 *   Sollicitatie ingediend careers_platform_rule_6     hero_careers_high_intent   proof_careers_default      cta_careers_contact
 *
 * ─── Priority order (lower = higher priority) ─────────────────────────────────
 *
 *    5  careers_platform_rule_6  application submitted → thank-you / next step
 *   10  careers_platform_rule_5  form started but abandoned → re-engagement
 *   20  careers_platform_rule_4  high-intent signals → direct apply
 *   30  careers_platform_rule_3  job detail viewed → role-led messaging
 *   40  careers_platform_rule_2  job listing explored → discovery CTA
 *   50  careers_platform_rule_1  new / low-signal visitor → brand intro
 *
 * ─── Theme recommendation ─────────────────────────────────────────────────────
 *   careers-human — warm teal, DM Sans 500, airy spacing, light hero; candidate-first
 *
 * ─── Included pages ───────────────────────────────────────────────────────────
 *   /                    Careers homepage (hero + why-us + jobs + teams + CTA)
 *   /vacatures           Job listing overview
 *   /vacatures/[slug]    Job detail / role page
 *   /solliciteren        Direct application form
 *   /open-sollicitatie   Open / unsolicited application
 *   /cultuur             Culture, values & team page
 */

import type { Blueprint } from "../blueprint-types";

export const careersPlatformBlueprint: Blueprint = {
  key:             "careers_platform",
  name:            "Careers / Werken-bij",
  description:     "Adaptieve werken-bij website die reageert op de kandidaatreis — van eerste bezoek tot ingediende sollicitatie.",
  longDescription: "Gebouwd voor recruitmentwebsites en employer-brand platforms waar candidates "
                 + "in verschillende fasen van hun sollicitatiereis zitten. "
                 + "Het systeem detecteert automatisch of iemand verkent, serieus overweegt of al "
                 + "heeft gesolliciteerd — en past de hero, social proof en CTA direct aan. "
                 + "Inclusief drop-off recovery, open sollicitatieflow en cultuurpagina.",
  industry:        "recruitment",
  siteModels:      ["careers"],
  tags:            ["recruitment", "careers", "werken-bij", "employer-brand", "hr", "jobs", "vacatures"],

  recommendedThemePreset: "careers-human",
  recommendedThemeFamily: "Careers Human",

  // ── Pages ───────────────────────────────────────────────────────────────────
  //
  // Block order mirrors the candidate journey: attention → credibility →
  // specific roles → team proof → culture → process → testimonials → CTA.
  // All Dutch-market copy; operators replace placeholder text with actual content.

  pages: [
    {
      slug:  "/",
      title: "Careers Homepage",
      blocks: [
        {
          type: "hero",
          note: "Adaptief hero-blok. Varieert op basis van kandidaatgedrag: "
              + "merkintroductie (nieuw) → vacature-match (verkenner) → "
              + "direct solliciteren (hoge intentie) → geruststelling (drop-off).",
        },
        {
          type: "featureGrid",
          note: "Waarom hier werken? 6 redenen: eigenaarschap, leerklimaat, teamcultuur, "
              + "arbeidsvoorwaarden, impact, diversiteit. Gebruik concrete feiten.",
        },
        {
          type: "listing",
          note: "Highlight 3–4 actuele vacatures met functietitel, team, locatie/remote en CTA-knop. "
              + "Koppelen aan /vacatures voor de volledige lijst.",
        },
        {
          type: "teamSection",
          note: "Team spotlights per afdeling: foto, naam, rol, één zin over hun werk. "
              + "Minimaal Engineering, Product, Commercie.",
        },
        {
          type: "textSection",
          note: "Cultuurblok: kernwaarden in 3–4 zinnen + optionele foto van kantoor/team. "
              + "Aansluiten op de /cultuur pagina.",
        },
        {
          type: "stats",
          note: "Sleutelfiguren: medewerkersscore, % dat bedrijf aanbeveelt, "
              + "gemiddelde selectiedoorlooptijd, teamgrootte.",
        },
        {
          type: "testimonialSection",
          note: "2–3 citaten van medewerkers over hun ervaring. Vermijd marketing-speak. "
              + "Gebruik echte namen en functies.",
        },
        {
          type: "ctaSection",
          note: "Adaptief CTA-blok. Varieert: 'Bekijk vacatures' (nieuw/verkenner) → "
              + "'Solliciteer nu' (hoge intentie) → 'Stuur open sollicitatie' (drop-off) → "
              + "'Stel een vraag' (post-sollicitatie).",
        },
      ],
    },

    {
      slug:  "/vacatures",
      title: "Vacatureoverzicht",
      blocks: [
        {
          type: "textSection",
          note: "Pagina-intro: 'Vind jouw volgende uitdaging'. "
              + "Optioneel zoekfilter op functiegroep, locatie en dienstverband.",
        },
        {
          type: "listing",
          note: "Volledige vacaturelijst. Elke kaart: functietitel, team/afdeling, "
              + "locatie/remote, uren, sluitingsdatum (optioneel). "
              + "Koppelt door naar /vacatures/[slug].",
        },
        {
          type: "ctaSection",
          note: "Geen passende vacature gevonden? Verwijzing naar open sollicitatie (/open-sollicitatie).",
        },
      ],
    },

    {
      slug:  "/vacatures/[slug]",
      title: "Vacaturedetail",
      blocks: [
        {
          type: "hero",
          note: "Functietitel als headline. Subheadline: team + locatie + dienstverband. "
              + "Primaire CTA: 'Solliciteer nu' → /solliciteren.",
        },
        {
          type: "richText",
          note: "Vacaturetekst: over de rol, verantwoordelijkheden, "
              + "wat wij zoeken (must-have vs. nice-to-have), wat wij bieden.",
        },
        {
          type: "teamSection",
          note: "Je toekomstige team: 2–3 teamleden met foto, naam, rol en één zin. "
              + "Optioneel: hiring manager quote.",
        },
        {
          type: "textSection",
          note: "Selectieprocedure stap-voor-stap: screening → gesprek → technische sessie → aanbieding. "
              + "Tijdsindicatie per stap.",
        },
        {
          type: "ctaSection",
          note: "Afsluitende CTA: 'Solliciteer nu' + 'Stel een vraag aan [naam hiring manager]'.",
        },
      ],
    },

    {
      slug:  "/solliciteren",
      title: "Sollicitatieformulier",
      blocks: [
        {
          type: "textSection",
          note: "Formulierheader: 'Jouw sollicitatie — we reageren binnen 3 werkdagen'. "
              + "Korte uitleg over wat er na indiening gebeurt.",
        },
        {
          type: "contactSection",
          note: "Sollicitatieformulier: naam, e-mailadres, telefoonnummer (optioneel), "
              + "functie waarvoor men solliciteert (dropdown), motivatie (textarea), "
              + "cv-upload (PDF/Word, max 5 MB). "
              + "Privacyverklaring checkbox verplicht.",
        },
      ],
    },

    {
      slug:  "/open-sollicitatie",
      title: "Open Sollicitatie",
      blocks: [
        {
          type: "textSection",
          note: "Pagina-intro: 'Geen passende vacature? Stuur toch een open sollicitatie.' "
              + "Benadruk dat open sollicitaties serieus worden behandeld.",
        },
        {
          type: "contactSection",
          note: "Open sollicitatieformulier: naam, e-mailadres, "
              + "in welk vakgebied/team interesse (dropdown of vrij tekstveld), "
              + "korte motivatie (textarea), optionele cv-upload.",
        },
        {
          type: "textSection",
          note: "Wat er daarna gebeurt: reactie binnen X werkdagen, opnemen in talentpool, "
              + "wat wij zoeken in kandidaten zonder actieve vacature.",
        },
      ],
    },

    {
      slug:  "/cultuur",
      title: "Cultuur & Waarden",
      blocks: [
        {
          type: "hero",
          note: "Culturele merkintroductie. Headline: de kernboodschap van jullie employer brand. "
              + "Geen vacaturedruk — dit is het verhaal achter het bedrijf.",
        },
        {
          type: "textSection",
          note: "Kernwaarden: 4–6 waarden, elk met concrete illustratie uit de werkpraktijk. "
              + "Vermijd vage termen als 'passie' en 'innovatie' zonder context.",
        },
        {
          type: "teamSection",
          note: "Uitgebreide team spotlights: 6–8 medewerkers uit verschillende afdelingen. "
              + "Quote, achtergrond, wat hen bij het bedrijf hield.",
        },
        {
          type: "stats",
          note: "Concrete werkgeverscijfers: medewerkerstevredenheid, verloop, promoties vanuit intern, "
              + "L&D budget per medewerker, thuiswerk-percentage.",
        },
        {
          type: "testimonialSection",
          note: "Langere medewerkersverhalen: groeipaden, leertrajecten, "
              + "hoe het er in de praktijk uitziet om hier te werken.",
        },
        {
          type: "ctaSection",
          note: "Laagdrempelige CTA: 'Bekijk onze openstaande vacatures' of "
              + "'Stuur een open sollicitatie — geen vacature vereist'.",
        },
      ],
    },
  ],

  // ── Behavioral rules ────────────────────────────────────────────────────────
  //
  // Rules are evaluated top-to-bottom by priority (lower = higher priority).
  // The first matching rule wins and its plan (hero/proof/cta keys) is applied.
  //
  // Field naming: journey.* fields resolve from ctx.history.journey.
  // visitType resolves from the session context.

  rules: [

    // ── Rule 6: Application submitted → thank-you / next-step experience ──────
    //
    // Priority 5: highest — application confirmed; pivot to relationship mode.
    // Candidate has completed the journey; no more conversion pressure needed.
    {
      priority: 5,
      label:    "Sollicitatie ingediend → bedanktervaring",
      reason:   "Kandidaat heeft een sollicitatie ingediend. Geen conversiedruk meer nodig — "
              + "focus op waardering en wat er daarna gebeurt.",
      condition: {
        type:     "field",
        field:    "journey.hasSubmittedForm",
        operator: "equals",
        value:    true,
      },
      plan: {
        heroKey:  "hero_careers_high_intent",
        proofKey: "proof_careers_default",
        ctaKey:   "cta_careers_contact",
      },
    },

    // ── Rule 5: Form drop-off → re-engagement with reassurance ───────────────
    //
    // Priority 10: candidate started but abandoned the form.
    // Reduce friction, build trust, offer open-application as softer alternative.
    {
      priority: 10,
      label:    "Formulier drop-off → geruststelling en open sollicitatie",
      reason:   "Kandidaat is begonnen met solliciteren maar heeft het formulier niet afgemaakt. "
              + "Verlaag de drempel door geruststelling en een open sollicitatie als alternatief.",
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
        ],
      },
      plan: {
        heroKey:  "hero_careers_reassurance",
        proofKey: "proof_careers_reassurance",
        ctaKey:   "cta_careers_open",
      },
    },

    // ── Rule 4: High intent → direct apply experience ─────────────────────────
    //
    // Priority 20: candidate has clicked a CTA AND viewed a job detail.
    // Strong apply signals — push for immediate application.
    {
      priority: 20,
      label:    "Hoge sollicitatie-intentie → direct solliciteren",
      reason:   "Kandidaat heeft een vacature bekeken en op een CTA geklikt. "
              + "Sterke intentiesignalen — surface directe sollicitatie-CTA.",
      condition: {
        type:  "group",
        logic: "and",
        conditions: [
          {
            type:     "field",
            field:    "journey.hasVisitedAbout",
            operator: "equals",
            value:    true,
          },
          {
            type:     "field",
            field:    "hasClickedCta",
            operator: "equals",
            value:    true,
          },
        ],
      },
      plan: {
        heroKey:  "hero_careers_high_intent",
        proofKey: "proof_careers_team",
        ctaKey:   "cta_careers_apply",
      },
    },

    // ── Rule 3: Job interest → role-led messaging ─────────────────────────────
    //
    // Priority 30: candidate viewed a specific job detail page.
    // Surface role-specific proof and an apply CTA.
    {
      priority: 30,
      label:    "Vacature bekeken → functiegericht aanbod",
      reason:   "Kandidaat heeft een specifieke vacaturepagina bekeken. "
              + "Toon teamspotlights en een directe sollicitatie-CTA.",
      condition: {
        type:     "field",
        field:    "journey.hasVisitedAbout",
        operator: "equals",
        value:    true,
      },
      plan: {
        heroKey:  "hero_careers_job_match",
        proofKey: "proof_careers_team",
        ctaKey:   "cta_careers_apply",
      },
    },

    // ── Rule 2: Explorer → discovery with browse CTA ──────────────────────────
    //
    // Priority 40: candidate browsed the job listing page.
    // Still exploring — show role-matching hero and a browse CTA.
    {
      priority: 40,
      label:    "Vacaturelijst verkenner → ontdekkende ervaring",
      reason:   "Kandidaat heeft de vacaturelijst bezocht maar nog geen specifieke rol bekeken. "
              + "Toon een vacature-match hero en een zachte browse-CTA.",
      condition: {
        type:     "field",
        field:    "journey.hasVisitedCases",
        operator: "equals",
        value:    true,
      },
      plan: {
        heroKey:  "hero_careers_job_match",
        proofKey: "proof_careers_team",
        ctaKey:   "cta_careers_browse",
      },
    },

    // ── Rule 1: Awareness → brand intro for new visitors ─────────────────────
    //
    // Priority 50: lowest — catches all new/unknown visitors.
    // Surface employer brand, culture proof, and a low-friction browse CTA.
    {
      priority: 50,
      label:    "Eerste bezoek → werkgeversmerk introductie",
      reason:   "Nieuw of onbekend bezoek zonder gedragssignalen. "
              + "Introduceer het werkgeversmerk, toon cultuurproof en een zachte CTA.",
      condition: {
        type:     "field",
        field:    "visitType",
        operator: "equals",
        value:    "new",
      },
      plan: {
        heroKey:  "hero_careers_default",
        proofKey: "proof_careers_default",
        ctaKey:   "cta_careers_browse",
      },
    },

  ],

  // ── Scoring rules ───────────────────────────────────────────────────────────

  scoringRules: [
    {
      key:           "careers_job_detail_view",
      label:          "Vacaturedetailpagina bekeken",
      description:   "Kandidaat heeft een specifieke vacature gelezen — hoge intentie-indicator.",
      event_type:    "page_view",
      page_category: "about",
      score:    35,
      decay_profile: "standard",
      priority:      10,
    },
    {
      key:           "careers_job_listing_view",
      label:          "Vacaturelijst bezocht",
      description:   "Kandidaat verkent actief het aanbod — oriëntatiefase.",
      event_type:    "page_view",
      page_category: "cases",
      score:    20,
      decay_profile: "standard",
      priority:      20,
    },
    {
      key:           "careers_culture_view",
      label:          "Cultuurpagina bezocht",
      description:   "Kandidaat onderzoekt de bedrijfscultuur — fit-oriëntatie.",
      event_type:    "page_view",
      page_category: "about",
      score:    15,
      decay_profile: "standard",
      priority:      25,
    },
    {
      key:           "careers_apply_form_view",
      label:          "Sollicitatieformulier geopend",
      description:   "Kandidaat heeft de sollicitatiepagina bezocht — sterke intentie.",
      event_type:    "page_view",
      page_category: "contact",
      score:    30,
      decay_profile: "standard",
      priority:      30,
    },
    {
      key:           "careers_cta_click",
      label:          "Apply / Browse CTA geklikt",
      description:   "Kandidaat klikte op een primaire actieknop — hoge betrokkenheid.",
      event_type:    "cta_click",
      score:    25,
      decay_profile: "standard",
      priority:      40,
    },
    {
      key:           "careers_form_start",
      label:          "Sollicitatie gestart",
      description:   "Kandidaat is begonnen met het invullen van het sollicitatieformulier.",
      event_type:    "form_start",
      score:    40,
      decay_profile: "standard",
      priority:      50,
    },
    {
      key:           "careers_form_submit",
      label:          "Sollicitatie ingediend",
      description:   "Kandidaat heeft de sollicitatie volledig ingediend — maximale conversie.",
      event_type:    "form_submit",
      score:    100,
      decay_profile: "none",
      priority:      60,
    },
  ],

  // ── Sequence patterns ───────────────────────────────────────────────────────

  sequencePatterns: [
    {
      slug:            "careers_browse_to_apply",
      label:           "Vacaturelijst → Sollicitatieformulier",
      sequence: [
        { event_type: "page_view", page_category: "cases" },
        { event_type: "page_view", page_category: "contact" },
      ],
      max_gap_minutes: 45,
      score:           45,
    },
    {
      slug:            "careers_detail_to_apply",
      label:           "Vacaturedetail → Sollicitatieformulier",
      sequence: [
        { event_type: "page_view", page_category: "about" },
        { event_type: "page_view", page_category: "contact" },
      ],
      max_gap_minutes: 30,
      score:           55,
    },
    {
      slug:            "careers_full_journey",
      label:           "Volledig kandidaattraject: lijst → detail → sollicitatie",
      sequence: [
        { event_type: "page_view", page_category: "cases" },
        { event_type: "page_view", page_category: "about" },
        { event_type: "page_view", page_category: "contact" },
      ],
      max_gap_minutes: 60,
      score:           70,
    },
    {
      slug:            "careers_cta_to_form",
      label:           "CTA-klik → Formulierstart",
      sequence: [
        { event_type: "cta_click" },
        { event_type: "form_start" },
      ],
      max_gap_minutes: 10,
      score:           35,
    },
  ],
};
