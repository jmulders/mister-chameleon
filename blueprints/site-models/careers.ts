/**
 * Careers / Werken-bij Site Model
 *
 * The site model for recruitment sites, werken-bij pages, and employer-brand
 * platforms that adapt to the candidate journey.
 *
 * ─── Candidate journey model ─────────────────────────────────────────────────
 *
 *   This model maps the platform's generic journey fields to recruitment semantics:
 *
 *   Platform field                Candidate meaning
 *   ──────────────────────────    ───────────────────────────────────────────
 *   journey.hasVisitedCases       Visited job listing page (/vacatures)
 *   journey.hasVisitedAbout       Viewed a specific job detail page
 *   journey.hasVisitedContact     Visited the application form
 *   journey.hasStartedForm        Started an application form
 *   journey.hasSubmittedForm      Completed and submitted an application
 *   hasClickedCta                 Clicked a primary apply or browse CTA
 *   intentScore                   Application intent score (0–100)
 *   frictionScore                 Application friction / hesitation signal
 *   funnelStage                   Candidate stage
 *   visitType                     New vs returning candidate visitor
 *
 * ─── Page structure ───────────────────────────────────────────────────────────
 *
 *   /                    homepage  — Careers hero → why-us → open roles → teams → CTA
 *   /vacatures           overview  — Job listing with filter by role/location/type
 *   /vacatures/[slug]    detail    — Job detail: role, requirements, team, apply CTA
 *   /solliciteren        form      — Direct application form
 *   /open-sollicitatie   form      — Open / unsolicited application form
 *   /cultuur             process   — Culture, values, team, and how-we-work
 *
 * ─── Behavioral logic ────────────────────────────────────────────────────────
 *
 *    Priority  Rule                                     Variant set
 *    ────────  ──────────────────────────────────────   ───────────────────────────────────────────
 *    5         Application submitted                →   thank-you / next step
 *    10        Form drop-off                        →   reassurance / re-engagement
 *    20        High intent (job view + CTA click)   →   direct apply CTA
 *    30        Job detail viewed                    →   role-led messaging
 *    40        Job listing explored                 →   discovery CTA
 *    50        New visitor                          →   brand intro
 *
 * ─── Scoring rules ────────────────────────────────────────────────────────────
 *   application_submit  +100  (conversion event)
 *   form_start          +40   (started application)
 *   job_detail_view     +30   (viewed specific job)
 *   cta_click           +25   (clicked apply or browse CTA)
 *   vacatures_view      +15   (browsed job listing)
 *   culture_view        +10   (checked culture page)
 *
 * ─── Compatible theme families ───────────────────────────────────────────────
 *   Careers Human, Soft Care, Bold Conversion
 */

import type { SiteModel } from "./types";

export const CAREERS_MODEL: SiteModel = {
  key:         "careers",
  label:       "Careers / Werken-bij",
  description: "Employer-brand and recruitment sites that adapt to the candidate journey from first visit to submitted application.",
  longDescription:
    "Designed for werken-bij pages and recruitment platforms where candidates are in different stages " +
    "of their application journey. The system detects whether someone is exploring, seriously considering, " +
    "or has already applied — and adjusts hero, social proof, and CTA accordingly. " +
    "Includes drop-off recovery, open-application flow, and a culture page.",
  icon:        "🤝",
  industries:  ["recruitment"],

  suggestedThemeFamilies: ["Careers Human", "Soft Care", "Bold Conversion"],

  // ── Pages ──────────────────────────────────────────────────────────────────

  pages: [
    {
      pageTypeKey: "homepage",
      slug:        "/",
      title:       "Werken Bij",
      noteOverrides: {
        hero:               "Careers hero: 'Word onderdeel van ons team' of '[Bedrijfsnaam] zoekt jou'. Primary CTA: 'Bekijk vacatures' of 'Solliciteer direct'.",
        logoStrip:          "Keurmerken, awards en certificeringen (bijv. Best Employer, Great Place to Work).",
        stats:              "Employer-brand-cijfers: medewerkers · NPS-score · doorgroei-percentage · openstaande vacatures.",
        featureGrid:        "Waarom bij ons werken: 4–6 kaarten (cultuur, groei, salaris, flexibiliteit, impact, team).",
        testimonialSection: "Medewerkerverhalen: foto, naam, functie en persoonlijke quote over de werkervaring.",
        ctaSection:         "Geen vacature die past? Stuur een open sollicitatie.",
      },
    },
    {
      pageTypeKey: "overview",
      slug:        "/vacatures",
      title:       "Vacatures",
      noteOverrides: {
        textSection: "Vacatures-header: 'Vind jouw volgende uitdaging'. Filter op functie, locatie en contracttype.",
        cardGrid:    "Vacaturekaarten: functietitel · locatie · contracttype · team · korte beschrijving · 'Bekijk vacature'-CTA.",
        ctaSection:  "Geen vacature die past? Stuur een open sollicitatie — link naar /open-sollicitatie.",
      },
    },
    {
      pageTypeKey: "detail",
      slug:        "/vacatures/[slug]",
      title:       "Vacature Detail",
      noteOverrides: {
        textSection:  "Functieheader: jobtitel, team, locatie, contracttype, publicatiedatum.",
        richText:     "Functieomschrijving: wie we zoeken, wat je gaat doen, vereisten, gewenste ervaring.",
        mediaSection: "Teamfoto of werkplekfoto die de omgeving en cultuur laat zien.",
        featureList:  "Wat bieden we: salaris, pensioen, thuiswerken, opleidingsbudget, secundaire arbeidsvoorwaarden.",
        relatedGrid:  "Vergelijkbare vacatures: 3 andere openstaande functies in hetzelfde team of niveau.",
        ctaSection:   "Solliciteer nu — primaire CTA. Stel een vraag — secundaire CTA.",
      },
    },
    {
      pageTypeKey: "form",
      slug:        "/solliciteren",
      title:       "Solliciteren",
      noteOverrides: {
        textSection:    "Sollicitatie-header: 'Bijna zover — vul je gegevens in'. Beschrijf het sollicitatieproces (stappen, doorlooptijd).",
        contactSection: "Sollicitatieformulier: naam, e-mail, telefoon, linkedin/portfolio, motivatiebrief (optioneel), CV-upload, vacaturetitel.",
        logoStrip:      "Vertrouwenssignalen: 'Jouw gegevens zijn veilig bij ons' + privacy-badge.",
      },
    },
    {
      pageTypeKey: "form",
      slug:        "/open-sollicitatie",
      title:       "Open Sollicitatie",
      noteOverrides: {
        textSection:    "Open sollicitatie-header: 'Geen vacature die past? We horen graag van je.' Leg uit hoe open sollicitaties worden behandeld.",
        contactSection: "Open sollicitatieformulier: naam, e-mail, gewenste functie/afdeling, motivatie, CV-upload.",
        logoStrip:      "Quote van een medewerker die via open sollicitatie is aangenomen.",
      },
    },
    {
      pageTypeKey: "process",
      slug:        "/cultuur",
      title:       "Cultuur & Waarden",
      noteOverrides: {
        textSection:  "Cultuurpagina-intro: wat ons als werkgever uniek maakt. Missie, visie, waarden.",
        stepsSection: "Onze sollicitatieproces in 4–5 stappen: CV → gesprek → case/kennismaking → aanbod → onboarding.",
        faqSection:   "Veelgestelde vragen over werken bij ons: thuiswerken, doorgroei, proeftijd, diversiteit.",
        ctaSection:   "Klaar voor jouw volgende stap? Bekijk onze vacatures.",
      },
      extraBlocks: [
        {
          type: "teamSection",
          note: "Teamfoto's en medewerkerverhalen: afdeling, naam, rol en één persoonlijke zin.",
        },
        {
          type: "stats",
          note: "Cultuurcijfers: gemiddelde dienstverband · intern doorgegroeid % · tevredenheidscore.",
        },
      ],
    },
  ],

  // ── Behavioral rules ──────────────────────────────────────────────────────

  rules: [
    {
      priority: 5,
      label:    "Application Submitted → Thank-You / Next Step",
      reason:   "Kandidaat heeft gesolliciteerd. Bevestig de stap, schets het vervolgproces.",
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
    {
      priority: 10,
      label:    "Form Drop-off → Reassurance CTA",
      reason:   "Kandidaat startte het formulier maar verliet het. Herstel het vertrouwen en verlaag de drempel.",
      condition: {
        type:  "group",
        logic: "and",
        conditions: [
          { type: "field", field: "journey.hasStartedForm",  operator: "equals", value: true },
          { type: "field", field: "journey.hasSubmittedForm", operator: "equals", value: false },
        ],
      },
      plan: {
        heroKey:  "hero_careers_reassurance",
        proofKey: "proof_careers_reassurance",
        ctaKey:   "cta_careers_open",
      },
    },
    {
      priority: 20,
      label:    "High Intent (job viewed + CTA clicked) → Direct Apply CTA",
      reason:   "Kandidaat bekeek een specifieke vacature én klikte een CTA — sterke sollicitatieintentie.",
      condition: {
        type:  "group",
        logic: "and",
        conditions: [
          { type: "field", field: "journey.hasVisitedAbout", operator: "equals", value: true },
          { type: "field", field: "hasClickedCta",           operator: "equals", value: true },
        ],
      },
      plan: {
        heroKey:  "hero_careers_high_intent",
        proofKey: "proof_careers_team",
        ctaKey:   "cta_careers_apply",
      },
    },
    {
      priority: 30,
      label:    "Job Detail Viewed → Role-Led Messaging",
      reason:   "Kandidaat bekeek een functiedetailpagina — gerichte interesse. Versterk met team-proof en directe apply CTA.",
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
    {
      priority: 40,
      label:    "Job Listing Explored → Discovery CTA",
      reason:   "Kandidaat bekeek de vacaturelijst — oriëntatiefase. Moedig verder verkennen aan.",
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
    {
      priority: 50,
      label:    "New Visitor → Brand Intro CTA",
      reason:   "Eerste bezoek. Introduceer het employer brand en toon openstaande vacatures.",
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

  // ── Scoring rules ─────────────────────────────────────────────────────────

  scoringRules: [
    {
      key:           "application_submit",
      label:          "Sollicitatie Ingediend",
      description:   "Kandidaat voltooide en verstuurde het sollicitatieformulier — conversie.",
      event_type:    "form_submit",
      score:    100,
      decay_profile: "slow",
      priority:      5,
    },
    {
      key:           "form_start_score",
      label:          "Sollicitatieformulier Gestart",
      description:   "Kandidaat begon het sollicitatieformulier — sterke intentie.",
      event_type:    "form_start",
      score:    40,
      decay_profile: "standard",
      priority:      10,
    },
    {
      key:           "job_detail_view",
      label:          "Vacature Detailpagina Bekeken",
      description:   "Kandidaat bekeek een specifieke vacaturepagina — gerichte interesse.",
      event_type:    "page_view",
      page_category: "about",
      score:    30,
      decay_profile: "standard",
      priority:      15,
    },
    {
      key:           "cta_click_score",
      label:          "Solliciteer / Bekijk CTA Klik",
      description:   "Kandidaat klikte een primary CTA — duidelijke intentie.",
      event_type:    "cta_click",
      score:    25,
      decay_profile: "standard",
      priority:      20,
    },
    {
      key:           "vacatures_view",
      label:          "Vacaturelijst Bekeken",
      description:   "Kandidaat bekeek de vacaturelijst — oriënterende interesse.",
      event_type:    "page_view",
      page_category: "cases",
      score:    15,
      decay_profile: "standard",
      priority:      25,
    },
    {
      key:           "culture_view",
      label:          "Cultuurpagina Bekeken",
      description:   "Kandidaat bekeek de cultuurpagina — werkgevermerk-interesse.",
      event_type:    "page_view",
      page_category: "about",
      score:    10,
      decay_profile: "standard",
      priority:      30,
    },
  ],

  // ── Sequence patterns ─────────────────────────────────────────────────────

  sequencePatterns: [
    {
      slug:            "vacature_to_apply",
      label:           "Vacature Detail → Solliciteren",
      sequence: [
        { event_type: "page_view", page_category: "about" },
        { event_type: "page_view", page_category: "contact" },
      ],
      max_gap_minutes: 30,
      score:           50,
    },
    {
      slug:            "listing_to_detail",
      label:           "Vacaturelijst → Detail",
      sequence: [
        { event_type: "page_view", page_category: "cases" },
        { event_type: "page_view", page_category: "about" },
      ],
      max_gap_minutes: 15,
      score:           25,
    },
    {
      slug:            "full_candidate_journey",
      label:           "Vacaturelijst → Detail → Solliciteren",
      sequence: [
        { event_type: "page_view", page_category: "cases" },
        { event_type: "page_view", page_category: "about" },
        { event_type: "page_view", page_category: "contact" },
      ],
      max_gap_minutes: 60,
      score:           65,
    },
    {
      slug:            "cta_to_form",
      label:           "CTA Klik → Formulier Start",
      sequence: [
        { event_type: "cta_click" },
        { event_type: "form_start" },
      ],
      max_gap_minutes: 10,
      score:           35,
    },
  ],
};
