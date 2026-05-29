/**
 * Catalog / Listing Site Model
 *
 * The site model for listing-heavy sites: directories, property portals,
 * event platforms, job boards, and any site where browsing and filtering
 * a large collection of items is the primary user behavior.
 *
 * ─── Page structure ───────────────────────────────────────────────────────────
 *
 *   /              homepage  — Hero → featured items → categories → CTA
 *   /listing       overview  — Full catalog with filter/sort
 *   /listing/[id]  detail    — Item detail with specs, gallery, related items
 *   /categories    overview  — Category / collection browser
 *   /contact       form      — Enquiry or listing submission form
 *
 * ─── Behavioral logic ────────────────────────────────────────────────────────
 *
 *   Rule 1 (priority 10): Item detail view + return visit → direct enquiry CTA
 *   Rule 2 (priority 20): Multiple item views (high engagement) → saved/compare CTA
 *   Rule 3 (priority 30): Returning browser → personalised recommendations CTA
 *   Rule 4 (priority 40): New visitor → onboarding / category discovery
 *
 * ─── Scoring rules ────────────────────────────────────────────────────────────
 *   contact_view    +35  (item enquiry page — high intent)
 *   detail_view     +25  (viewed specific item)
 *   listing_view    +15  (browsed the catalog)
 *   category_view   +10  (browsed category)
 *   cta_click       +20
 *   form_start      +15
 *
 * ─── Compatible theme families ───────────────────────────────────────────────
 *   Corporate Trust, Editorial Authority, Tech Clarity
 */

import type { SiteModel } from "./types";

export const CATALOG_MODEL: SiteModel = {
  key:         "catalog",
  label:       "Catalog / Directory",
  description: "Listing-heavy sites — directories, property portals, event platforms — driven by browse and filter behavior.",
  longDescription:
    "Best for property portals, event directories, product catalogues, and any site where " +
    "visitors primarily browse a large filtered collection rather than reading long-form content. " +
    "Behavioral rules reward depth of browsing (multiple item views) and escalate to enquiry " +
    "CTAs as engagement increases.",
  icon:        "🗂️",
  industries:  ["marketplace", "lead_gen"],

  suggestedThemeFamilies: ["Corporate Trust", "Editorial Authority", "Tech Clarity"],

  // ── Pages ──────────────────────────────────────────────────────────────────

  pages: [
    {
      pageTypeKey: "homepage",
      slug:        "/",
      title:       "Homepage",
      noteOverrides: {
        hero:               "Catalog hero: 'Vind wat jij zoekt' — primary CTA: zoekbalk of 'Bekijk het aanbod'. Secondary: 'Meld je item aan'.",
        logoStrip:          "Partnerbadges, keurmerken, of 'Betrouwbaar door X kopers / verhuurders / bezoekers'.",
        stats:              "Cataloguscijfers: actieve items · gebruikers · transacties/maand · categorieën.",
        featureGrid:        "Populaire categorieën of uitgelichte collecties met thumbnail en itemcount.",
        testimonialSection: "Gebruikersquotes: koper/huurder én verkoper/aanbieder om beide kanten te vertegenwoordigen.",
        ctaSection:         "Jouw item toevoegen? Meld het gratis aan.",
      },
    },
    {
      pageTypeKey: "overview",
      slug:        "/aanbod",
      title:       "Aanbod",
      noteOverrides: {
        textSection: "Catalogusheader: 'Alle [items] op een rij'. Filter op categorie, locatie, prijs, beschikbaarheid, populariteit.",
        cardGrid:    "Itemkaarten: thumbnail · titel · kernattributen (prijs, locatie, datum) · statusbadge · 'Bekijk detail'-CTA.",
        ctaSection:  "Niet gevonden wat je zoekt? Stuur een zoekopdracht of vraag aan.",
      },
    },
    {
      pageTypeKey: "detail",
      slug:        "/aanbod/[slug]",
      title:       "Item Detail",
      noteOverrides: {
        textSection:  "Itemheader: titel, categorie, locatie, prijs/tarief, beschikbaarheid, publicatiedatum.",
        richText:     "Uitgebreide omschrijving: alle specs, details, voorwaarden, en bijzonderheden.",
        mediaSection: "Fotogalerij of video: meerdere afbeeldingen vanuit verschillende hoeken / contexten.",
        featureList:  "Kernspecificaties: 4–8 bullets met de meest gezochte attributen (oppervlakte, capaciteit, prijs, etc.).",
        relatedGrid:  "Vergelijkbaar aanbod: 3 soortgelijke items op basis van categorie of locatie.",
        ctaSection:   "Interesse? Stuur een bericht — enquiry CTA. Opslaan voor later — secondary CTA.",
      },
    },
    {
      pageTypeKey: "overview",
      slug:        "/categorieën",
      title:       "Categorieën",
      noteOverrides: {
        textSection: "Categorieën-header: 'Blader per categorie' — overzicht van alle beschikbare categorieën.",
        cardGrid:    "Categoriekaarten: thumbnail, categorienaam, itemcount en 'Bekijk aanbod'-link.",
        ctaSection:  "Een categorie missen? Laat het ons weten.",
      },
    },
    {
      pageTypeKey: "form",
      slug:        "/contact",
      title:       "Contact / Aanmelden",
      noteOverrides: {
        textSection:    "Contact- of aanmeldheader: 'Jouw item aanmelden of een vraag stellen'. Geef aan wat er na het insturen volgt.",
        contactSection: "Contactformulier: naam, e-mail, telefoon, type vraag (interesse / aanmelden / overig), bericht.",
        logoStrip:      "Keurmerken of trustbadges onder het formulier.",
      },
    },
  ],

  // ── Behavioral rules ──────────────────────────────────────────────────────

  rules: [
    {
      priority: 10,
      label:    "Item Detail + Return Visit → Direct Enquiry CTA",
      reason:   "Bezoeker bekeek specifieke items en keert terug — ernstige overweging. Toon directe enquiry CTA.",
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
      label:    "High Engagement (multiple views) → Save / Compare CTA",
      reason:   "Bezoeker bekeek veel items — actieve vergelijking. Bied opslaan/vergelijken aan.",
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
      label:    "Returning Browser → Personalised Recommendations CTA",
      reason:   "Terugkerende bezoeker — laat relevante items zien op basis van eerdere interesse.",
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
      label:    "New Visitor → Category Discovery CTA",
      reason:   "Eerste bezoek. Begeleid nieuwe bezoeker naar de juiste categorie.",
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
      label:          "Aanvraag / Enquiry Pagina Bekeken",
      description:   "Bezoeker bekijkt de aanvraag- of contactpagina — hoge koopintentie.",
      event_type:    "page_view",
      page_category: "contact",
      score:    35,
      decay_profile: "standard",
      priority:      10,
    },
    {
      key:           "detail_view",
      label:          "Item Detailpagina Bekeken",
      description:   "Bezoeker bekeek een specifiek item — actieve evaluatie.",
      event_type:    "page_view",
      page_category: "about",
      score:    25,
      decay_profile: "standard",
      priority:      15,
    },
    {
      key:           "listing_view",
      label:          "Catalogusoverzicht Bekeken",
      description:   "Bezoeker bekeek het catalogusoverzicht — oriënterende interesse.",
      event_type:    "page_view",
      page_category: "cases",
      score:    15,
      decay_profile: "standard",
      priority:      20,
    },
    {
      key:           "category_view",
      label:          "Categorie Bekeken",
      description:   "Bezoeker bekeek een specifieke categorie.",
      event_type:    "page_view",
      page_category: "services",
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
      label:          "Aanvraagformulier Gestart",
      description:   "Bezoeker begon een aanvraagformulier — hoge commitment.",
      event_type:    "form_start",
      score:    15,
      decay_profile: "standard",
      priority:      50,
    },
  ],

  // ── Sequence patterns ─────────────────────────────────────────────────────

  sequencePatterns: [
    {
      slug:            "detail_to_enquiry",
      label:           "Item Detail → Aanvraag",
      sequence: [
        { event_type: "page_view", page_category: "about" },
        { event_type: "page_view", page_category: "contact" },
      ],
      max_gap_minutes: 20,
      score:           45,
    },
    {
      slug:            "listing_to_detail",
      label:           "Overzicht → Item Detail",
      sequence: [
        { event_type: "page_view", page_category: "cases" },
        { event_type: "page_view", page_category: "about" },
      ],
      max_gap_minutes: 10,
      score:           20,
    },
    {
      slug:            "full_browse_to_enquiry",
      label:           "Bladeren → Detail → Aanvraag",
      sequence: [
        { event_type: "page_view", page_category: "cases" },
        { event_type: "page_view", page_category: "about" },
        { event_type: "page_view", page_category: "contact" },
      ],
      max_gap_minutes: 40,
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
