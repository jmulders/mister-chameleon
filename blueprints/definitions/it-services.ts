/**
 * IT Services / Managed Services Provider Blueprint
 *
 * A complete starting configuration for IT service providers, MSPs, cloud
 * integrators, and digital transformation consultancies.
 *
 * ─── Included pages ───────────────────────────────────────────────────────────
 *   / (homepage)       problem-first hero → solutions → proof → CTA
 *   /diensten          service catalog: managed IT, cloud, security, helpdesk
 *   /over-ons          team + certifications + partnership badges
 *   /cases             client case studies by sector
 *   /contact           discovery call request form
 *
 * ─── Behavioral logic ────────────────────────────────────────────────────────
 *   Rule 1: Contact or high-intent visitor         → discovery call CTA
 *   Rule 2: Returning + CTA clicked                → specific service CTA
 *   Rule 3: Cases visitor                          → proof + direct CTA
 *   Rule 4: New visitor                            → resource/guide CTA
 *
 * ─── Scoring rules ────────────────────────────────────────────────────────────
 *   contact_view    +35  (discovery call intent)
 *   services_view   +25  (solution evaluation)
 *   cases_view      +20  (trust-building)
 *   about_view      +10  (credential check)
 *   cta_click       +20
 *   form_start      +15
 *
 * ─── Theme recommendation ─────────────────────────────────────────────────────
 *   tech-indigo — deep indigo, crisp grid, tech authority
 */

import type { Blueprint } from "../blueprint-types";

export const itServicesBlueprint: Blueprint = {
  key:             "it_services",
  name:            "IT Services / MSP",
  description:     "Lead-gen setup for IT service providers, MSPs, and digital transformation consultancies.",
  longDescription: "Optimized for IT service companies where the buying cycle is long and trust " +
                   "comes from demonstrated expertise. Visitors typically have a specific problem " +
                   "(slow systems, security concern, cloud migration need); the experience guides them " +
                   "from problem recognition → solution credibility → discovery call booking.",
  industry:        "lead_gen",
  siteModels:      ["service"],
  tags:            ["it", "msp", "managed-services", "cloud", "security", "b2b", "tech"],

  recommendedThemePreset: "tech-indigo",
  recommendedThemeFamily: "Tech Clarity",

  // ── Pages ────────────────────────────────────────────────────────────────

  pages: [
    {
      slug:  "/",
      title: "Homepage",
      blocks: [
        { type: "hero",               note: "Problem-first headline. E.g. 'IT-problemen kosten je productiviteit. Wij lossen ze op.'" },
        { type: "logoStrip",          note: "Vendor partnerships: Microsoft Partner, Google Cloud Partner, etc." },
        { type: "featureGrid",        note: "Core solutions: Managed IT · Cloud · Cybersecurity · Helpdesk · Netwerk" },
        { type: "testimonialSection", note: "2–3 B2B client testimonials with company size/sector" },
        { type: "stats",              note: "Uptime SLA · avg response time · clients served · years active" },
        { type: "ctaSection",         note: "Plan een vrijblijvende IT-scan — discovery CTA" },
      ],
    },
    {
      slug:  "/diensten",
      title: "Diensten",
      blocks: [
        { type: "textSection",        note: "Services overview: 'Van helpdesk tot cloud-strategie'" },
        { type: "featureGrid",        note: "Detailed service cards with scope, SLA, and technology stack" },
        { type: "testimonialSection", note: "One relevant client quote per service cluster" },
        { type: "ctaSection",         note: "Vraag een IT-scan aan" },
      ],
    },
    {
      slug:  "/over-ons",
      title: "Over Ons",
      blocks: [
        { type: "textSection",        note: "Company story: years active, mission, no-nonsense approach" },
        { type: "teamSection",        note: "Specialist profiles with certifications (Azure, AWS, CompTIA, etc.)" },
        { type: "logoStrip",          note: "Certification badges and partner logos (trust signals)" },
        { type: "ctaSection",         note: "Kom kennismaken" },
      ],
    },
    {
      slug:  "/cases",
      title: "Klantcases",
      blocks: [
        { type: "textSection",        note: "Cases header: 'Van probleem naar oplossing'" },
        { type: "caseGrid",           note: "4–6 case cards: sector · challenge · solution · outcome (measurable)" },
        { type: "ctaSection",         note: "Herken je dit probleem? Neem contact op" },
      ],
    },
    {
      slug:  "/contact",
      title: "Contact",
      blocks: [
        { type: "textSection",        note: "Contact header: 'Plan een vrijblijvend kennismakingsgesprek'" },
        { type: "contactSection",     note: "Form: bedrijfsnaam, naam, e-mail, telefoon, omvang bedrijf, IT-uitdaging + kantoorgegevens" },
      ],
    },
  ],

  // ── Behavioral rules ──────────────────────────────────────────────────────

  rules: [
    {
      priority: 10,
      label:    "Contact Page Visitor → Discovery Call CTA",
      reason:   "Visitor reached the contact page — strong intent to book a discovery call. Surface direct CTA.",
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
      label:    "High-Engagement Visitor → Direct Discovery CTA",
      reason:   "Visitor has viewed 3+ pages — active evaluation. Surface discovery call CTA.",
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
      label:    "Returning + CTA Clicked → IT Assessment CTA",
      reason:   "Returning visitor who already clicked a CTA — high purchase readiness. Push for IT assessment.",
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
      label:    "New Visitor → IT Guide / Resource CTA",
      reason:   "First-time visitor. Offer a practical guide (e.g. IT-security checklist) to nurture.",
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
      description:   "Visitor reached the contact page — discovery call intent.",
      event_type:    "page_view",
      page_category: "contact",
      score:    35,
      decay_profile: "standard",
      priority:      10,
    },
    {
      key:           "services_view",
      label:          "Services / Diensten Page View",
      description:   "Visitor evaluated the service catalog — solution research.",
      event_type:    "page_view",
      page_category: "services",
      score:    25,
      decay_profile: "standard",
      priority:      20,
    },
    {
      key:           "cases_view",
      label:          "Case Studies View",
      description:   "Visitor browsed case studies — trust-building, sector fit evaluation.",
      event_type:    "page_view",
      page_category: "cases",
      score:    20,
      decay_profile: "standard",
      priority:      25,
    },
    {
      key:           "about_view",
      label:          "About / Team / Certifications View",
      description:   "Visitor checked credentials, certifications, or partner badges.",
      event_type:    "page_view",
      page_category: "about",
      score:    10,
      decay_profile: "standard",
      priority:      30,
    },
    {
      key:           "cta_click_score",
      label:          "CTA Click",
      description:   "Visitor clicked a call-to-action — active engagement.",
      event_type:    "cta_click",
      score:    20,
      decay_profile: "standard",
      priority:      40,
    },
    {
      key:           "form_start_score",
      label:          "Discovery Form Started",
      description:   "Visitor started the contact/discovery form — high commitment.",
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
      label:           "Diensten → Contact",
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
      slug:            "full_it_evaluation",
      label:           "Diensten → Cases → Contact",
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
