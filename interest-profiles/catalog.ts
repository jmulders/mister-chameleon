/**
 * Interest Profiles — Canonical Platform Catalog
 *
 * Source-of-truth TypeScript definition of the 20 canonical platform interest
 * profiles.  This catalog is used by:
 *
 *   - `upsertPlatformCatalog()` in repository.ts — seeds the DB idempotently
 *   - `seedPlatformCatalogAction()` in actions.ts — admin UI trigger
 *   - The admin page banner — detects a catalog count mismatch
 *   - Migration 078 — performs the same upsert at deploy time via SQL
 *
 * ─── Catalog composition ──────────────────────────────────────────────────────
 *
 *   ACTIVE (18) — is_active = true, evaluated at runtime:
 *     B2B / SaaS (5): pricing_focused, product_focused, use_case_focused,
 *                     trust_focused, technical_focused
 *     Careers    (3): candidate_explorer, job_specific_candidate, high_intent_applicant
 *     Commerce   (3): product_explorer, deal_sensitive, high_purchase_intent
 *     Real Estate(1): property_explorer
 *     MC-specific(6): personalization_seeker, conversion_optimizer, demo_intent,
 *                     marketing_decision_maker, agency_partner_interest, saas_audience
 *
 *   SUGGESTED (8) — is_active = false, operator activates per-tenant:
 *     B2B / SaaS (2): comparison_focused, roi_focused
 *     Careers    (1): employer_brand_interest
 *     Commerce   (2): cart_ready, repeat_product_interest
 *     Real Estate(3): buyer_intent, viewing_ready, investor_style_interest
 *
 * ─── Adding a new profile ─────────────────────────────────────────────────────
 *
 *   1. Add the CatalogProfile entry below.
 *   2. Run `seedPlatformCatalogAction()` from the admin UI to push it to the DB,
 *      or write a new migration that calls the upsert SQL pattern.
 *
 * Note: The catalog constant is imported server-side only (repository.ts uses
 * "server-only").  This file itself carries no server-only directive so that
 * the admin page can read CATALOG_SIZE for the mismatch banner without a build
 * error.
 */

import type { InterestProfileFamily, InterestProfileDefaultStatus, InterestTag } from "./types";

// ── Catalog profile type ───────────────────────────────────────────────────────

export interface CatalogProfile {
  readonly key:                   string;
  readonly name:                  string;
  readonly description:           string;
  readonly tags:                  readonly InterestTag[];
  readonly isActive:              boolean;
  readonly family:                InterestProfileFamily;
  readonly recommendedSiteModels: readonly string[];
  readonly defaultStatus:         InterestProfileDefaultStatus;
}

// ── Canonical catalog ─────────────────────────────────────────────────────────

export const INTEREST_PROFILE_CATALOG: readonly CatalogProfile[] = [

  // ── B2B / SaaS — ACTIVE ───────────────────────────────────────────────────

  {
    key:         "pricing_focused",
    name:        "Pricing-focused",
    description: "Visitor is actively exploring pricing, packages, and cost comparisons.",
    tags: [
      { keyword: "pricing",    weight: 2.0 },
      { keyword: "tarieven",   weight: 2.0 },
      { keyword: "kosten",     weight: 1.5 },
      { keyword: "abonnement", weight: 1.5 },
      { keyword: "plan",       weight: 1.0 },
      { keyword: "offerte",    weight: 2.0 },
      { keyword: "prijs",      weight: 1.5 },
      { keyword: "budget",     weight: 1.0 },
      { keyword: "price",      weight: 2.0 },
      { keyword: "cost",       weight: 1.5 },
    ],
    isActive:              true,
    family:                "b2b_saas",
    recommendedSiteModels: ["b2b_saas", "saas_product", "agency"],
    defaultStatus:         "active",
  },

  {
    key:         "product_focused",
    name:        "Product-focused",
    description: "Visitor is exploring product features, capabilities, and how-it-works content.",
    tags: [
      { keyword: "product",           weight: 1.5 },
      { keyword: "features",          weight: 2.0 },
      { keyword: "functionaliteiten", weight: 2.0 },
      { keyword: "integraties",       weight: 1.5 },
      { keyword: "platform",          weight: 1.0 },
      { keyword: "functie",           weight: 1.0 },
      { keyword: "mogelijkheden",     weight: 1.5 },
      { keyword: "capabilities",      weight: 1.5 },
      { keyword: "integrations",      weight: 1.5 },
    ],
    isActive:              true,
    family:                "b2b_saas",
    recommendedSiteModels: ["b2b_saas", "saas_product"],
    defaultStatus:         "active",
  },

  {
    key:         "use_case_focused",
    name:        "Use-case-focused",
    description: "Visitor is exploring specific use cases, industries, or application scenarios.",
    tags: [
      { keyword: "use-case",   weight: 2.0 },
      { keyword: "use case",   weight: 2.0 },
      { keyword: "sector",     weight: 1.5 },
      { keyword: "oplossing",  weight: 1.5 },
      { keyword: "toepassing", weight: 1.5 },
      { keyword: "scenario",   weight: 1.0 },
      { keyword: "industrie",  weight: 1.0 },
      { keyword: "branche",    weight: 1.0 },
      { keyword: "solution",   weight: 1.5 },
      { keyword: "industry",   weight: 1.0 },
    ],
    isActive:              true,
    family:                "b2b_saas",
    recommendedSiteModels: ["b2b_saas", "saas_product", "agency"],
    defaultStatus:         "active",
  },

  {
    key:         "trust_focused",
    name:        "Trust-focused",
    description: "Visitor is exploring social proof, case studies, reviews, and security content.",
    tags: [
      { keyword: "cases",         weight: 2.0 },
      { keyword: "case study",    weight: 2.0 },
      { keyword: "testimonials",  weight: 2.0 },
      { keyword: "reviews",       weight: 2.0 },
      { keyword: "klanten",       weight: 1.5 },
      { keyword: "certificering", weight: 1.5 },
      { keyword: "security",      weight: 1.5 },
      { keyword: "beveiliging",   weight: 1.5 },
      { keyword: "privacy",       weight: 1.0 },
      { keyword: "gdpr",          weight: 1.0 },
      { keyword: "compliance",    weight: 1.0 },
      { keyword: "trust",         weight: 1.5 },
    ],
    isActive:              true,
    family:                "b2b_saas",
    recommendedSiteModels: ["b2b_saas", "saas_product", "agency", "real_estate"],
    defaultStatus:         "active",
  },

  {
    key:         "technical_focused",
    name:        "Technical-focused",
    description: "Visitor is exploring API documentation, developer resources, or technical architecture.",
    tags: [
      { keyword: "api",          weight: 2.0 },
      { keyword: "docs",         weight: 1.5 },
      { keyword: "documentatie", weight: 1.5 },
      { keyword: "integratie",   weight: 1.5 },
      { keyword: "developer",    weight: 2.0 },
      { keyword: "architecture", weight: 1.5 },
      { keyword: "sdk",          weight: 1.5 },
      { keyword: "webhook",      weight: 1.0 },
      { keyword: "technical",    weight: 1.5 },
      { keyword: "technisch",    weight: 1.5 },
      { keyword: "rest api",     weight: 2.0 },
    ],
    isActive:              true,
    family:                "b2b_saas",
    recommendedSiteModels: ["b2b_saas", "saas_product"],
    defaultStatus:         "active",
  },

  // ── Careers — ACTIVE ──────────────────────────────────────────────────────

  {
    key:         "candidate_explorer",
    name:        "Candidate Explorer",
    description: "Visitor is browsing job opportunities, team culture, or general career content.",
    tags: [
      { keyword: "vacatures",  weight: 2.0 },
      { keyword: "vacature",   weight: 2.0 },
      { keyword: "werken-bij", weight: 2.0 },
      { keyword: "werken bij", weight: 2.0 },
      { keyword: "jobs",       weight: 2.0 },
      { keyword: "job",        weight: 1.5 },
      { keyword: "team",       weight: 1.0 },
      { keyword: "cultuur",    weight: 1.5 },
      { keyword: "culture",    weight: 1.5 },
      { keyword: "loopbaan",   weight: 1.5 },
      { keyword: "careers",    weight: 2.0 },
      { keyword: "career",     weight: 1.5 },
    ],
    isActive:              true,
    family:                "careers",
    recommendedSiteModels: ["careers", "employer_brand"],
    defaultStatus:         "active",
  },

  {
    key:         "job_specific_candidate",
    name:        "Job-specific Candidate",
    description: "Visitor is viewing a specific job listing or role-focused content.",
    tags: [
      { keyword: "functie",               weight: 2.0 },
      { keyword: "rol",                   weight: 1.5 },
      { keyword: "vacature",              weight: 1.5 },
      { keyword: "verantwoordelijkheden", weight: 1.5 },
      { keyword: "vereisten",             weight: 1.5 },
      { keyword: "salaris",               weight: 1.0 },
      { keyword: "fulltime",              weight: 1.0 },
      { keyword: "parttime",              weight: 1.0 },
      { keyword: "remote",                weight: 1.0 },
      { keyword: "apply",                 weight: 1.5 },
      { keyword: "solliciteren",          weight: 2.0 },
    ],
    isActive:              true,
    family:                "careers",
    recommendedSiteModels: ["careers"],
    defaultStatus:         "active",
  },

  {
    key:         "high_intent_applicant",
    name:        "High-intent Applicant",
    description: "Visitor shows strong apply-intent signals — engaged with a specific role and application flow.",
    tags: [
      { keyword: "solliciteren",   weight: 2.5 },
      { keyword: "apply",          weight: 2.5 },
      { keyword: "sollicitatie",   weight: 2.5 },
      { keyword: "application",    weight: 2.0 },
      { keyword: "cv",             weight: 2.0 },
      { keyword: "resume",         weight: 2.0 },
      { keyword: "cover letter",   weight: 1.5 },
      { keyword: "motivatiebrief", weight: 1.5 },
      { keyword: "now hiring",     weight: 2.0 },
    ],
    isActive:              true,
    family:                "careers",
    recommendedSiteModels: ["careers"],
    defaultStatus:         "active",
  },

  // ── Commerce — ACTIVE ─────────────────────────────────────────────────────

  {
    key:         "product_explorer",
    name:        "Product Explorer",
    description: "Visitor is browsing and evaluating products in an e-commerce context.",
    tags: [
      { keyword: "product",       weight: 1.5 },
      { keyword: "categorie",     weight: 1.0 },
      { keyword: "assortiment",   weight: 1.5 },
      { keyword: "specificaties", weight: 1.5 },
      { keyword: "vergelijken",   weight: 2.0 },
      { keyword: "reviews",       weight: 1.5 },
      { keyword: "collections",   weight: 1.0 },
      { keyword: "catalog",       weight: 1.0 },
      { keyword: "shop",          weight: 1.0 },
    ],
    isActive:              true,
    family:                "commerce",
    recommendedSiteModels: ["ecommerce", "retail"],
    defaultStatus:         "active",
  },

  {
    key:         "deal_sensitive",
    name:        "Deal-sensitive",
    description: "Visitor is actively seeking discounts, deals, or promotional offers.",
    tags: [
      { keyword: "korting",    weight: 2.0 },
      { keyword: "aanbieding", weight: 2.0 },
      { keyword: "deal",       weight: 2.0 },
      { keyword: "actie",      weight: 1.5 },
      { keyword: "uitverkoop", weight: 1.5 },
      { keyword: "gratis",     weight: 1.5 },
      { keyword: "discount",   weight: 2.0 },
      { keyword: "sale",       weight: 2.0 },
      { keyword: "promo",      weight: 1.5 },
    ],
    isActive:              true,
    family:                "commerce",
    recommendedSiteModels: ["ecommerce", "retail"],
    defaultStatus:         "active",
  },

  {
    key:         "high_purchase_intent",
    name:        "High Purchase Intent",
    description: "Visitor shows strong signals of intent to purchase or convert.",
    tags: [
      { keyword: "bestellen",       weight: 2.0 },
      { keyword: "kopen",           weight: 2.0 },
      { keyword: "winkelwagen",     weight: 1.5 },
      { keyword: "afrekenen",       weight: 2.0 },
      { keyword: "bestelformulier", weight: 1.5 },
      { keyword: "checkout",        weight: 2.0 },
      { keyword: "buy",             weight: 2.0 },
      { keyword: "order",           weight: 1.5 },
      { keyword: "add to cart",     weight: 2.0 },
    ],
    isActive:              true,
    family:                "commerce",
    recommendedSiteModels: ["ecommerce", "retail"],
    defaultStatus:         "active",
  },

  // ── Real Estate — ACTIVE ──────────────────────────────────────────────────

  {
    key:         "property_explorer",
    name:        "Property Explorer",
    description: "Visitor is browsing and evaluating properties in a real estate context.",
    tags: [
      { keyword: "woning",      weight: 2.0 },
      { keyword: "pand",        weight: 1.5 },
      { keyword: "object",      weight: 1.0 },
      { keyword: "huren",       weight: 1.5 },
      { keyword: "kopen",       weight: 1.5 },
      { keyword: "appartement", weight: 1.5 },
      { keyword: "huis",        weight: 1.5 },
      { keyword: "property",    weight: 1.5 },
      { keyword: "real estate", weight: 1.5 },
      { keyword: "vastgoed",    weight: 1.5 },
    ],
    isActive:              true,
    family:                "real_estate",
    recommendedSiteModels: ["real_estate"],
    defaultStatus:         "active",
  },

  // ── Mister Chameleon — ACTIVE ─────────────────────────────────────────────
  //
  // Site-specific profiles that directly reflect Mister Chameleon's target
  // audiences and content structure.  Activated by default so the Live State
  // panel shows meaningful interest data from day one for MC tenants.

  {
    key:         "personalization_seeker",
    name:        "Personalization Seeker",
    description: "Visitor is actively researching website personalization, adaptive content, and contextual marketing technology.",
    tags: [
      { keyword: "personalization",          weight: 2.5 },
      { keyword: "personalisatie",           weight: 2.5 },
      { keyword: "adaptive",                 weight: 2.0 },
      { keyword: "contextual",               weight: 2.0 },
      { keyword: "personalised",             weight: 2.0 },
      { keyword: "gepersonaliseerd",         weight: 2.0 },
      { keyword: "how-it-works",             weight: 1.5 },
      { keyword: "decision engine",          weight: 2.0 },
      { keyword: "website personalization",  weight: 2.5 },
      { keyword: "dynamic content",          weight: 1.5 },
      { keyword: "dynamische content",       weight: 1.5 },
    ],
    isActive:              true,
    family:                "b2b_saas",
    recommendedSiteModels: ["b2b_saas", "agency", "saas_product"],
    defaultStatus:         "active",
  },

  {
    key:         "conversion_optimizer",
    name:        "Conversion Optimizer",
    description: "Visitor is focused on improving conversion rates, A/B testing, and growth metrics — core MC value proposition.",
    tags: [
      { keyword: "conversion",        weight: 2.5 },
      { keyword: "conversie",         weight: 2.5 },
      { keyword: "optimalisatie",     weight: 2.0 },
      { keyword: "optimization",      weight: 2.0 },
      { keyword: "cro",               weight: 2.5 },
      { keyword: "a/b",               weight: 2.0 },
      { keyword: "a/b testing",       weight: 2.0 },
      { keyword: "growth",            weight: 1.5 },
      { keyword: "groei",             weight: 1.5 },
      { keyword: "roi",               weight: 2.0 },
      { keyword: "lift",              weight: 1.5 },
      { keyword: "results",           weight: 1.5 },
      { keyword: "resultaten",        weight: 1.5 },
    ],
    isActive:              true,
    family:                "b2b_saas",
    recommendedSiteModels: ["b2b_saas", "agency", "saas_product"],
    defaultStatus:         "active",
  },

  {
    key:         "demo_intent",
    name:        "Demo Intent",
    description: "Visitor shows strong signals of wanting to book a demo or see the product in action — has reached contact or pricing after exploring product content.",
    tags: [
      { keyword: "demo",         weight: 2.5 },
      { keyword: "book",         weight: 2.0 },
      { keyword: "boeken",       weight: 2.0 },
      { keyword: "schedule",     weight: 2.0 },
      { keyword: "inplannen",    weight: 2.0 },
      { keyword: "meeting",      weight: 2.0 },
      { keyword: "afspraak",     weight: 2.0 },
      { keyword: "gesprek",      weight: 1.5 },
      { keyword: "see it live",  weight: 2.5 },
      { keyword: "live demo",    weight: 2.5 },
      { keyword: "in actie",     weight: 2.0 },
      { keyword: "contact",      weight: 1.0 },
    ],
    isActive:              true,
    family:                "b2b_saas",
    recommendedSiteModels: ["b2b_saas", "agency", "saas_product"],
    defaultStatus:         "active",
  },

  {
    key:         "marketing_decision_maker",
    name:        "Marketing Decision Maker",
    description: "Senior marketing stakeholder (CMO, Head of Marketing, Growth Lead) evaluating MC as a strategic platform investment — cross-visits pricing, cases, and about.",
    tags: [
      { keyword: "cmo",              weight: 2.0 },
      { keyword: "marketing leader", weight: 2.0 },
      { keyword: "head of marketing", weight: 2.0 },
      { keyword: "strategy",         weight: 1.5 },
      { keyword: "strategie",        weight: 1.5 },
      { keyword: "enterprise",       weight: 2.0 },
      { keyword: "team",             weight: 1.0 },
      { keyword: "groeistrategie",   weight: 1.5 },
      { keyword: "growth strategy",  weight: 1.5 },
      { keyword: "marketing team",   weight: 1.5 },
      { keyword: "leadership",       weight: 1.0 },
    ],
    isActive:              true,
    family:                "b2b_saas",
    recommendedSiteModels: ["b2b_saas", "agency"],
    defaultStatus:         "active",
  },

  {
    key:         "agency_partner_interest",
    name:        "Agency Partner Interest",
    description: "Marketing or digital agency exploring Mister Chameleon as a tool or white-label platform for their client portfolio.",
    tags: [
      { keyword: "agency",          weight: 2.5 },
      { keyword: "bureau",          weight: 2.5 },
      { keyword: "partner",         weight: 2.0 },
      { keyword: "white-label",     weight: 2.5 },
      { keyword: "white label",     weight: 2.5 },
      { keyword: "reseller",        weight: 2.0 },
      { keyword: "voor bureaus",    weight: 2.5 },
      { keyword: "for agencies",    weight: 2.5 },
      { keyword: "klanten",         weight: 1.0 },
      { keyword: "clients",         weight: 1.0 },
      { keyword: "digitaal bureau", weight: 2.5 },
    ],
    isActive:              true,
    family:                "b2b_saas",
    recommendedSiteModels: ["b2b_saas", "agency"],
    defaultStatus:         "active",
  },

  {
    key:         "saas_audience",
    name:        "SaaS Audience",
    description: "SaaS company or scale-up exploring Mister Chameleon to personalise their own marketing site and improve trial-to-paid conversion.",
    tags: [
      { keyword: "saas",            weight: 2.5 },
      { keyword: "software",        weight: 1.5 },
      { keyword: "scale-up",        weight: 2.0 },
      { keyword: "startup",         weight: 1.5 },
      { keyword: "product-led",     weight: 2.5 },
      { keyword: "plg",             weight: 2.5 },
      { keyword: "trial",           weight: 2.0 },
      { keyword: "free trial",      weight: 2.0 },
      { keyword: "gratis proberen", weight: 2.0 },
      { keyword: "sign up",         weight: 1.5 },
      { keyword: "onboarding",      weight: 1.5 },
    ],
    isActive:              true,
    family:                "b2b_saas",
    recommendedSiteModels: ["b2b_saas", "saas_product"],
    defaultStatus:         "active",
  },

  // ── B2B / SaaS — SUGGESTED ────────────────────────────────────────────────

  {
    key:         "comparison_focused",
    name:        "Comparison-focused",
    description: "Visitor is comparing vendors, reading alternative reviews, or evaluating competitors.",
    tags: [
      { keyword: "vergelijken",   weight: 2.0 },
      { keyword: "compare",       weight: 2.0 },
      { keyword: "alternatieven", weight: 2.0 },
      { keyword: "versus",        weight: 2.0 },
      { keyword: "alternatives",  weight: 2.0 },
      { keyword: "vs",            weight: 1.5 },
      { keyword: "vergelijking",  weight: 2.0 },
      { keyword: "benchmark",     weight: 1.5 },
      { keyword: "review",        weight: 1.5 },
      { keyword: "competitors",   weight: 1.5 },
    ],
    isActive:              false,
    family:                "b2b_saas",
    recommendedSiteModels: ["b2b_saas", "saas_product"],
    defaultStatus:         "suggested",
  },

  {
    key:         "roi_focused",
    name:        "ROI-focused",
    description: "Visitor is exploring ROI, business case, or financial value justification content.",
    tags: [
      { keyword: "roi",           weight: 2.5 },
      { keyword: "return",        weight: 1.5 },
      { keyword: "rendement",     weight: 2.0 },
      { keyword: "business case", weight: 2.5 },
      { keyword: "businesscase",  weight: 2.5 },
      { keyword: "besparing",     weight: 2.0 },
      { keyword: "savings",       weight: 2.0 },
      { keyword: "payback",       weight: 2.0 },
      { keyword: "waarde",        weight: 1.5 },
      { keyword: "value",         weight: 1.5 },
      { keyword: "impact",        weight: 1.0 },
    ],
    isActive:              false,
    family:                "b2b_saas",
    recommendedSiteModels: ["b2b_saas", "saas_product", "agency"],
    defaultStatus:         "suggested",
  },

  // ── Careers — SUGGESTED ───────────────────────────────────────────────────

  {
    key:         "employer_brand_interest",
    name:        "Employer Brand Interest",
    description: "Visitor is exploring employer brand content aimed at talent attraction and retention.",
    tags: [
      { keyword: "employer",       weight: 1.5 },
      { keyword: "werkgever",      weight: 1.5 },
      { keyword: "talent",         weight: 1.5 },
      { keyword: "cultuur",        weight: 1.5 },
      { keyword: "benefits",       weight: 1.5 },
      { keyword: "arbeidsmarkt",   weight: 1.0 },
      { keyword: "employer brand", weight: 2.0 },
      { keyword: "onboarding",     weight: 1.0 },
      { keyword: "merk",           weight: 1.0 },
      { keyword: "people",         weight: 1.0 },
    ],
    isActive:              false,
    family:                "careers",
    recommendedSiteModels: ["careers", "employer_brand"],
    defaultStatus:         "suggested",
  },

  // ── Commerce — SUGGESTED ──────────────────────────────────────────────────

  {
    key:         "cart_ready",
    name:        "Cart-ready",
    description: "Visitor has shown strong cart-addition or checkout-approach signals.",
    tags: [
      { keyword: "winkelwagen", weight: 2.5 },
      { keyword: "cart",        weight: 2.5 },
      { keyword: "in de wagen", weight: 2.0 },
      { keyword: "toevoegen",   weight: 2.0 },
      { keyword: "add to cart", weight: 2.5 },
      { keyword: "winkelmand",  weight: 2.5 },
      { keyword: "bestel",      weight: 2.0 },
      { keyword: "checkout",    weight: 2.0 },
      { keyword: "kassa",       weight: 2.0 },
    ],
    isActive:              false,
    family:                "commerce",
    recommendedSiteModels: ["ecommerce", "retail"],
    defaultStatus:         "suggested",
  },

  {
    key:         "repeat_product_interest",
    name:        "Repeat Product Interest",
    description: "Returning visitor showing renewed interest in products previously browsed.",
    tags: [
      { keyword: "opnieuw",         weight: 2.0 },
      { keyword: "nogmaals",        weight: 2.0 },
      { keyword: "terug",           weight: 1.5 },
      { keyword: "product",         weight: 1.0 },
      { keyword: "recently viewed", weight: 2.5 },
      { keyword: "wishlist",        weight: 2.0 },
      { keyword: "verlanglijst",    weight: 2.0 },
      { keyword: "bekeken",         weight: 1.5 },
      { keyword: "saved",           weight: 1.5 },
    ],
    isActive:              false,
    family:                "commerce",
    recommendedSiteModels: ["ecommerce", "retail"],
    defaultStatus:         "suggested",
  },

  // ── Real Estate — SUGGESTED ───────────────────────────────────────────────

  {
    key:         "buyer_intent",
    name:        "Buyer Intent",
    description: "Visitor shows strong signals of intent to purchase or acquire a property.",
    tags: [
      { keyword: "kopen",        weight: 2.5 },
      { keyword: "aankoop",      weight: 2.5 },
      { keyword: "bod",          weight: 2.0 },
      { keyword: "financiering", weight: 2.0 },
      { keyword: "hypotheek",    weight: 2.0 },
      { keyword: "buy",          weight: 2.5 },
      { keyword: "purchase",     weight: 2.0 },
      { keyword: "offer",        weight: 2.0 },
      { keyword: "mortgage",     weight: 2.0 },
      { keyword: "make offer",   weight: 2.5 },
    ],
    isActive:              false,
    family:                "real_estate",
    recommendedSiteModels: ["real_estate"],
    defaultStatus:         "suggested",
  },

  {
    key:         "viewing_ready",
    name:        "Viewing-ready",
    description: "Visitor is showing high intent to schedule a property viewing.",
    tags: [
      { keyword: "bezichtiging", weight: 2.0 },
      { keyword: "afspraak",     weight: 2.0 },
      { keyword: "plannen",      weight: 1.5 },
      { keyword: "beschikbaar",  weight: 1.0 },
      { keyword: "inplannen",    weight: 2.0 },
      { keyword: "contact",      weight: 1.0 },
      { keyword: "viewing",      weight: 2.0 },
      { keyword: "book",         weight: 1.5 },
      { keyword: "schedule",     weight: 1.5 },
    ],
    isActive:              false,
    family:                "real_estate",
    recommendedSiteModels: ["real_estate"],
    defaultStatus:         "suggested",
  },

  {
    key:         "investor_style_interest",
    name:        "Investor-style Interest",
    description: "Visitor is exploring investment opportunities, rental yields, or financial return content.",
    tags: [
      { keyword: "investeren", weight: 2.0 },
      { keyword: "rendement",  weight: 2.0 },
      { keyword: "belegging",  weight: 2.0 },
      { keyword: "verhuur",    weight: 1.5 },
      { keyword: "roi",        weight: 1.5 },
      { keyword: "vastgoed",   weight: 1.5 },
      { keyword: "portfolio",  weight: 1.0 },
      { keyword: "investor",   weight: 2.0 },
      { keyword: "return",     weight: 1.5 },
      { keyword: "yield",      weight: 1.5 },
    ],
    isActive:              false,
    family:                "real_estate",
    recommendedSiteModels: ["real_estate"],
    defaultStatus:         "suggested",
  },

];

// ── Derived constants ─────────────────────────────────────────────────────────

/**
 * Total number of canonical platform profiles.
 * Active (18): 5 B2B/SaaS + 3 Careers + 3 Commerce + 1 Real Estate + 6 MC-specific
 * Suggested (8): 2 B2B/SaaS + 1 Careers + 2 Commerce + 3 Real Estate
 */
export const CATALOG_SIZE = INTEREST_PROFILE_CATALOG.length;

/** Canonical active count (is_active = true). */
export const CATALOG_ACTIVE_COUNT = INTEREST_PROFILE_CATALOG.filter((p) => p.isActive).length;

/** Canonical suggested count (is_active = false). */
export const CATALOG_SUGGESTED_COUNT = INTEREST_PROFILE_CATALOG.filter((p) => !p.isActive).length;
