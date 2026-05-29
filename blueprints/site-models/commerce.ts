/**
 * Commerce / Transactional Site Model
 *
 * The site model for transactional sites where the conversion is a purchase,
 * booking, or subscription.  Includes product detail, cart, and checkout pages.
 *
 * ─── Page structure ───────────────────────────────────────────────────────────
 *
 *   /                homepage  — Hero → featured products → categories → trust → CTA
 *   /products        overview  — Product catalogue with filter/sort
 *   /products/[slug] detail    — Product detail with specs, gallery, add-to-cart
 *   /checkout        form      — Checkout form with trust signals
 *   /over-ons        process   — Brand story, how-it-works, returns/shipping
 *
 * ─── Behavioral logic ────────────────────────────────────────────────────────
 *
 *   Rule 1 (priority 10): Cart / checkout page visitor   → urgency CTA
 *   Rule 2 (priority 20): Returning + product viewed     → personalised CTA
 *   Rule 3 (priority 30): High-engagement product browse → curated CTA
 *   Rule 4 (priority 40): New visitor                    → onboarding / offer CTA
 *
 * ─── Scoring rules ────────────────────────────────────────────────────────────
 *   checkout_view   +50  (added to cart or at checkout — strongest signal)
 *   product_view    +20  (viewed specific product)
 *   catalogue_view  +10  (browsed the catalogue)
 *   cta_click       +20
 *   form_start      +30  (started checkout)
 *
 * ─── Compatible theme families ───────────────────────────────────────────────
 *   Bold Conversion, Editorial Authority, Corporate Trust
 */

import type { SiteModel } from "./types";

export const COMMERCE_MODEL: SiteModel = {
  key:         "commerce",
  label:       "Commerce / Shop",
  description: "Transactional sites — shops, subscription services, bookings — driven by product browsing and checkout.",
  longDescription:
    "Designed for e-commerce shops, subscription boxes, booking platforms, and any site " +
    "where the primary conversion is a purchase or reservation. " +
    "Checkout-page signals are weighted highest; behavioral rules escalate urgency " +
    "and social proof as visitors approach the conversion step.",
  icon:        "🛍️",
  industries:  ["ecommerce"],

  suggestedThemeFamilies: ["Bold Conversion", "Editorial Authority", "Corporate Trust"],

  // ── Pages ──────────────────────────────────────────────────────────────────

  pages: [
    {
      pageTypeKey: "homepage",
      slug:        "/",
      title:       "Homepage",
      noteOverrides: {
        hero:               "Shop hero: 'Nieuw binnen — [collectie/seizoen]'. Primary CTA: 'Shop nu' of 'Bekijk de collectie'. Optional countdown for limited offer.",
        logoStrip:          "Trustbadges: veilig betalen, gratis retour, snelle levering, keurmerken.",
        stats:              "Shopstatistieken: tevreden klanten · jaren actief · producten · gemiddelde beoordeling.",
        featureGrid:        "Productcategorieën of trending items: 4–6 kaarten met thumbnail, naam en prijs.",
        testimonialSection: "Klantreviews: sterrenbeoordeling, naam en review over product + bezorging.",
        ctaSection:         "Mis het niet — limited offer CTA of nieuwsbriefinschrijving.",
      },
    },
    {
      pageTypeKey: "overview",
      slug:        "/producten",
      title:       "Producten",
      noteOverrides: {
        textSection: "Productoverzicht-header: categorienaam of collectienaam + aantal items. Filter op prijs, maat, kleur, beschikbaarheid.",
        cardGrid:    "Productkaarten: thumbnail · naam · prijs · sterrenbeoordeling · 'Toevoegen'-CTA. Uitverkocht-badge indien van toepassing.",
        ctaSection:  "Niet gevonden? Laat je e-mail achter voor restockmelding.",
      },
    },
    {
      pageTypeKey: "detail",
      slug:        "/producten/[slug]",
      title:       "Product Detail",
      noteOverrides: {
        textSection:  "Productdetailheader: productnaam, prijs, sterrenbeoordeling met reviewcount, beschikbaarheid (op voorraad / bijna uitverkocht).",
        richText:     "Uitgebreide productomschrijving: materiaal, herkomst, gebruiksaanwijzing, onderhoud.",
        mediaSection: "Productfoto-galerij: 4–8 beelden vanuit verschillende hoeken + lifestyleshot.",
        featureList:  "Productspecificaties: maat, gewicht, materiaal, kleurvarianten, land van herkomst.",
        relatedGrid:  "Vergelijkbare producten: 3–4 suggesties ('Anderen kochten ook').",
        ctaSection:   "Toevoegen aan winkelwagen — primaire CTA. In wishlist opslaan — secundaire CTA.",
      },
      extraBlocks: [
        {
          type: "reviewSection",
          note: "Klantreviews: gemiddelde beoordeling, sterrenverdeling, meest recente reviews met foto's.",
        },
      ],
    },
    {
      pageTypeKey: "form",
      slug:        "/afrekenen",
      title:       "Afrekenen",
      noteOverrides: {
        textSection:    "Checkout-header: 'Bijna klaar — vul je gegevens in'. Toon orderoverzicht naast het formulier.",
        contactSection: "Checkout-formulier: naam, e-mail, leveringsadres, bezorgoptie, betaalmethode. Geen onnodige velden.",
        logoStrip:      "Veilige betaling-badges: iDEAL, Visa, Mastercard, Klarna, SSL-certificaat.",
      },
    },
    {
      pageTypeKey: "process",
      slug:        "/over-ons",
      title:       "Over Ons",
      noteOverrides: {
        textSection:  "Merkverhaal: waarom dit merk opgericht is, wat het uniek maakt, duurzaamheid of herkomst.",
        stepsSection: "Bestellen in 3 stappen: 1. Kies je product · 2. Vul je gegevens in · 3. Ontvang thuis.",
        faqSection:   "Veelgestelde vragen: retourbeleid, levertijd, maatadvies, betaling, garantie.",
        ctaSection:   "Ga naar de shop — CTA terug naar het productoverzicht.",
      },
    },
  ],

  // ── Behavioral rules ──────────────────────────────────────────────────────

  rules: [
    {
      priority: 10,
      label:    "Checkout Page Visitor → Urgency CTA",
      reason:   "Bezoeker is bij de checkout-pagina aangekomen — hoogste koopintentie. Verwijder obstakels, toon trustsignalen.",
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
      label:    "Returning + Product Viewed → Personalised CTA",
      reason:   "Terugkerende bezoeker die al producten bekeek. Herinner aan eerder bekeken items.",
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
      priority: 30,
      label:    "High-Engagement Browse → Curated Picks CTA",
      reason:   "Bezoeker heeft veel producten bekeken — actieve kooporiëntatie. Toon curated suggesties.",
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
      priority: 40,
      label:    "New Visitor → Welcome / Intro Offer CTA",
      reason:   "Eerste bezoek. Verwelkom de nieuwe bezoeker met een introductiekorting of uitgelichte collectie.",
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
      key:           "checkout_view",
      label:          "Checkout Pagina Bekeken",
      description:   "Bezoeker bereikte de checkout-pagina — sterkste koopintentiesignaal.",
      event_type:    "page_view",
      page_category: "contact",
      score:    50,
      decay_profile: "fast",
      priority:      5,
    },
    {
      key:           "form_start_score",
      label:          "Checkout Gestart",
      description:   "Bezoeker begon het afrekenen — hoge intentie.",
      event_type:    "form_start",
      score:    30,
      decay_profile: "fast",
      priority:      10,
    },
    {
      key:           "product_view",
      label:          "Productdetailpagina Bekeken",
      description:   "Bezoeker bekeek een specifiek product.",
      event_type:    "page_view",
      page_category: "about",
      score:    20,
      decay_profile: "standard",
      priority:      20,
    },
    {
      key:           "catalogue_view",
      label:          "Productoverzicht Bekeken",
      description:   "Bezoeker bladerde door het productoverzicht.",
      event_type:    "page_view",
      page_category: "cases",
      score:    10,
      decay_profile: "standard",
      priority:      30,
    },
    {
      key:           "cta_click_score",
      label:          "CTA Klik",
      description:   "Bezoeker klikte een call-to-action.",
      event_type:    "cta_click",
      score:    20,
      decay_profile: "standard",
      priority:      40,
    },
  ],

  // ── Sequence patterns ─────────────────────────────────────────────────────

  sequencePatterns: [
    {
      slug:            "product_to_checkout",
      label:           "Product Detail → Afrekenen",
      sequence: [
        { event_type: "page_view", page_category: "about" },
        { event_type: "page_view", page_category: "contact" },
      ],
      max_gap_minutes: 20,
      score:           45,
    },
    {
      slug:            "catalogue_to_checkout",
      label:           "Productoverzicht → Afrekenen",
      sequence: [
        { event_type: "page_view", page_category: "cases" },
        { event_type: "page_view", page_category: "contact" },
      ],
      max_gap_minutes: 30,
      score:           35,
    },
    {
      slug:            "full_purchase_journey",
      label:           "Overzicht → Product → Afrekenen",
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
      label:           "CTA Klik → Checkout Start",
      sequence: [
        { event_type: "cta_click" },
        { event_type: "form_start" },
      ],
      max_gap_minutes: 10,
      score:           30,
    },
  ],
};
