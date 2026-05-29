-- ============================================================================
-- Migration 074: Interest Profiles v2 — canonical catalog with family,
--                recommended_site_models, and default_status
--
-- What this migration does:
--   1. Adds three new columns to interest_profiles:
--        family                  — grouping key: b2b_saas | careers | commerce | real_estate
--        recommended_site_models — text[] of site model keys this profile suits
--        default_status          — 'active' | 'suggested' (platform seeding intent)
--   2. Ensures 061/073 infrastructure (tenant_id, partial indexes) is present.
--   3. Deletes all existing platform-wide profiles (tenant_id IS NULL).
--   4. Seeds the canonical 20-profile catalog:
--        ACTIVE (12)    — is_active = true,  default_status = 'active'
--        SUGGESTED (8)  — is_active = false, default_status = 'suggested'
--
-- Family values:
--   b2b_saas      B2B / SaaS products and service platforms
--   careers       Recruitment, job boards, career sites
--   commerce      E-commerce and retail
--   real_estate   Property portals and estate agencies
--
-- default_status values:
--   active     Profile is on by default — evaluated at runtime immediately.
--   suggested  Profile is seeded but inactive — shown to operators as a
--              recommended addition; they activate it per-tenant if relevant.
--
-- Idempotency:
--   ADD COLUMN IF NOT EXISTS, CREATE UNIQUE INDEX IF NOT EXISTS — safe to re-run.
--   DELETE + INSERT is deterministic; re-running after a partial apply is safe.
-- ============================================================================

-- ── Step 1: Ensure columns from migration 061 (idempotent) ───────────────────

ALTER TABLE public.interest_profiles
  ADD COLUMN IF NOT EXISTS tenant_id text;

ALTER TABLE public.interest_profiles
  DROP CONSTRAINT IF EXISTS interest_profiles_key_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS interest_profiles_platform_key_uniq
  ON public.interest_profiles (key)
  WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS interest_profiles_tenant_key_uniq
  ON public.interest_profiles (tenant_id, key)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS interest_profiles_tenant_id_idx
  ON public.interest_profiles (tenant_id);

-- ── Step 2: Add new catalog columns ──────────────────────────────────────────

ALTER TABLE public.interest_profiles
  ADD COLUMN IF NOT EXISTS family                  text,
  ADD COLUMN IF NOT EXISTS recommended_site_models text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS default_status          text    NOT NULL DEFAULT 'active';

-- ── Step 3: Remove all platform-wide profiles ────────────────────────────────
--
-- Clears old dummy profiles (Bakken, Fruit, Gezondheid), the hyphen-key set from
-- migration 061, and the underscore-key set from migration 073.
-- Tenant-scoped profiles (tenant_id IS NOT NULL) are left untouched.

DELETE FROM public.interest_profiles WHERE tenant_id IS NULL;

-- ── Step 4: Seed canonical catalog ───────────────────────────────────────────
--
-- ─── B2B / SaaS — ACTIVE ─────────────────────────────────────────────────────

INSERT INTO public.interest_profiles
  (key, name, description, tags, is_active, tenant_id, family, recommended_site_models, default_status)
VALUES

-- pricing_focused → interestPricingFocusedScore
('pricing_focused', 'Pricing-focused',
 'Visitor is actively exploring pricing, packages, and cost comparisons.',
 '[
   {"keyword": "pricing",     "weight": 2.0},
   {"keyword": "tarieven",    "weight": 2.0},
   {"keyword": "kosten",      "weight": 1.5},
   {"keyword": "abonnement",  "weight": 1.5},
   {"keyword": "plan",        "weight": 1.0},
   {"keyword": "offerte",     "weight": 2.0},
   {"keyword": "prijs",       "weight": 1.5},
   {"keyword": "budget",      "weight": 1.0},
   {"keyword": "price",       "weight": 2.0},
   {"keyword": "cost",        "weight": 1.5}
 ]'::jsonb,
 true, NULL, 'b2b_saas', ARRAY['b2b_saas', 'saas_product', 'agency'], 'active'),

-- product_focused → interestProductFocusedScore
('product_focused', 'Product-focused',
 'Visitor is exploring product features, capabilities, and how-it-works content.',
 '[
   {"keyword": "product",            "weight": 1.5},
   {"keyword": "features",           "weight": 2.0},
   {"keyword": "functionaliteiten",  "weight": 2.0},
   {"keyword": "integraties",        "weight": 1.5},
   {"keyword": "platform",           "weight": 1.0},
   {"keyword": "functie",            "weight": 1.0},
   {"keyword": "mogelijkheden",      "weight": 1.5},
   {"keyword": "capabilities",       "weight": 1.5},
   {"keyword": "integrations",       "weight": 1.5}
 ]'::jsonb,
 true, NULL, 'b2b_saas', ARRAY['b2b_saas', 'saas_product'], 'active'),

-- use_case_focused → interestUseCaseFocusedScore
('use_case_focused', 'Use-case-focused',
 'Visitor is exploring specific use cases, industries, or application scenarios.',
 '[
   {"keyword": "use-case",     "weight": 2.0},
   {"keyword": "use case",     "weight": 2.0},
   {"keyword": "sector",       "weight": 1.5},
   {"keyword": "oplossing",    "weight": 1.5},
   {"keyword": "toepassing",   "weight": 1.5},
   {"keyword": "scenario",     "weight": 1.0},
   {"keyword": "industrie",    "weight": 1.0},
   {"keyword": "branche",      "weight": 1.0},
   {"keyword": "solution",     "weight": 1.5},
   {"keyword": "industry",     "weight": 1.0}
 ]'::jsonb,
 true, NULL, 'b2b_saas', ARRAY['b2b_saas', 'saas_product', 'agency'], 'active'),

-- trust_focused → interestTrustFocusedScore
('trust_focused', 'Trust-focused',
 'Visitor is exploring social proof, case studies, reviews, and security content.',
 '[
   {"keyword": "cases",         "weight": 2.0},
   {"keyword": "case study",    "weight": 2.0},
   {"keyword": "testimonials",  "weight": 2.0},
   {"keyword": "reviews",       "weight": 2.0},
   {"keyword": "klanten",       "weight": 1.5},
   {"keyword": "certificering", "weight": 1.5},
   {"keyword": "security",      "weight": 1.5},
   {"keyword": "beveiliging",   "weight": 1.5},
   {"keyword": "privacy",       "weight": 1.0},
   {"keyword": "gdpr",          "weight": 1.0},
   {"keyword": "compliance",    "weight": 1.0},
   {"keyword": "trust",         "weight": 1.5}
 ]'::jsonb,
 true, NULL, 'b2b_saas', ARRAY['b2b_saas', 'saas_product', 'agency', 'real_estate'], 'active'),

-- technical_focused → interestTechnicalFocusedScore
('technical_focused', 'Technical-focused',
 'Visitor is exploring API documentation, developer resources, or technical architecture.',
 '[
   {"keyword": "api",           "weight": 2.0},
   {"keyword": "docs",          "weight": 1.5},
   {"keyword": "documentatie",  "weight": 1.5},
   {"keyword": "integratie",    "weight": 1.5},
   {"keyword": "developer",     "weight": 2.0},
   {"keyword": "architecture",  "weight": 1.5},
   {"keyword": "sdk",           "weight": 1.5},
   {"keyword": "webhook",       "weight": 1.0},
   {"keyword": "technical",     "weight": 1.5},
   {"keyword": "technisch",     "weight": 1.5},
   {"keyword": "rest api",      "weight": 2.0}
 ]'::jsonb,
 true, NULL, 'b2b_saas', ARRAY['b2b_saas', 'saas_product'], 'active'),

-- ─── Careers — ACTIVE ─────────────────────────────────────────────────────────

-- candidate_explorer → interestCandidateExplorerScore
('candidate_explorer', 'Candidate Explorer',
 'Visitor is browsing job opportunities, team culture, or general career content.',
 '[
   {"keyword": "vacatures",    "weight": 2.0},
   {"keyword": "vacature",     "weight": 2.0},
   {"keyword": "werken-bij",   "weight": 2.0},
   {"keyword": "werken bij",   "weight": 2.0},
   {"keyword": "jobs",         "weight": 2.0},
   {"keyword": "job",          "weight": 1.5},
   {"keyword": "team",         "weight": 1.0},
   {"keyword": "cultuur",      "weight": 1.5},
   {"keyword": "culture",      "weight": 1.5},
   {"keyword": "loopbaan",     "weight": 1.5},
   {"keyword": "careers",      "weight": 2.0},
   {"keyword": "career",       "weight": 1.5}
 ]'::jsonb,
 true, NULL, 'careers', ARRAY['careers', 'employer_brand'], 'active'),

-- job_specific_candidate → interestJobSpecificCandidateScore
('job_specific_candidate', 'Job-specific Candidate',
 'Visitor is viewing a specific job listing or role-focused content.',
 '[
   {"keyword": "functie",                "weight": 2.0},
   {"keyword": "rol",                    "weight": 1.5},
   {"keyword": "vacature",               "weight": 1.5},
   {"keyword": "verantwoordelijkheden",  "weight": 1.5},
   {"keyword": "vereisten",              "weight": 1.5},
   {"keyword": "salaris",                "weight": 1.0},
   {"keyword": "fulltime",               "weight": 1.0},
   {"keyword": "parttime",               "weight": 1.0},
   {"keyword": "remote",                 "weight": 1.0},
   {"keyword": "apply",                  "weight": 1.5},
   {"keyword": "solliciteren",           "weight": 2.0}
 ]'::jsonb,
 true, NULL, 'careers', ARRAY['careers'], 'active'),

-- high_intent_applicant → interestHighIntentApplicantScore
('high_intent_applicant', 'High-intent Applicant',
 'Visitor shows strong apply-intent signals — engaged with a specific role and application flow.',
 '[
   {"keyword": "solliciteren",     "weight": 2.5},
   {"keyword": "apply",            "weight": 2.5},
   {"keyword": "sollicitatie",     "weight": 2.5},
   {"keyword": "application",      "weight": 2.0},
   {"keyword": "cv",               "weight": 2.0},
   {"keyword": "resume",           "weight": 2.0},
   {"keyword": "cover letter",     "weight": 1.5},
   {"keyword": "motivatiebrief",   "weight": 1.5},
   {"keyword": "now hiring",       "weight": 2.0}
 ]'::jsonb,
 true, NULL, 'careers', ARRAY['careers'], 'active'),

-- ─── Commerce — ACTIVE ────────────────────────────────────────────────────────

-- product_explorer → interestProductExplorerScore
('product_explorer', 'Product Explorer',
 'Visitor is browsing and evaluating products in an e-commerce context.',
 '[
   {"keyword": "product",       "weight": 1.5},
   {"keyword": "categorie",     "weight": 1.0},
   {"keyword": "assortiment",   "weight": 1.5},
   {"keyword": "specificaties", "weight": 1.5},
   {"keyword": "vergelijken",   "weight": 2.0},
   {"keyword": "reviews",       "weight": 1.5},
   {"keyword": "collections",   "weight": 1.0},
   {"keyword": "catalog",       "weight": 1.0},
   {"keyword": "shop",          "weight": 1.0}
 ]'::jsonb,
 true, NULL, 'commerce', ARRAY['ecommerce', 'retail'], 'active'),

-- deal_sensitive → interestDealSensitiveScore
('deal_sensitive', 'Deal-sensitive',
 'Visitor is actively seeking discounts, deals, or promotional offers.',
 '[
   {"keyword": "korting",     "weight": 2.0},
   {"keyword": "aanbieding",  "weight": 2.0},
   {"keyword": "deal",        "weight": 2.0},
   {"keyword": "actie",       "weight": 1.5},
   {"keyword": "uitverkoop",  "weight": 1.5},
   {"keyword": "gratis",      "weight": 1.5},
   {"keyword": "discount",    "weight": 2.0},
   {"keyword": "sale",        "weight": 2.0},
   {"keyword": "promo",       "weight": 1.5}
 ]'::jsonb,
 true, NULL, 'commerce', ARRAY['ecommerce', 'retail'], 'active'),

-- high_purchase_intent → interestHighPurchaseIntentScore
('high_purchase_intent', 'High Purchase Intent',
 'Visitor shows strong signals of intent to purchase or convert.',
 '[
   {"keyword": "bestellen",       "weight": 2.0},
   {"keyword": "kopen",           "weight": 2.0},
   {"keyword": "winkelwagen",     "weight": 1.5},
   {"keyword": "afrekenen",       "weight": 2.0},
   {"keyword": "bestelformulier", "weight": 1.5},
   {"keyword": "checkout",        "weight": 2.0},
   {"keyword": "buy",             "weight": 2.0},
   {"keyword": "order",           "weight": 1.5},
   {"keyword": "add to cart",     "weight": 2.0}
 ]'::jsonb,
 true, NULL, 'commerce', ARRAY['ecommerce', 'retail'], 'active'),

-- ─── Real Estate — ACTIVE ─────────────────────────────────────────────────────

-- property_explorer → interestPropertyExplorerScore
('property_explorer', 'Property Explorer',
 'Visitor is browsing and evaluating properties in a real estate context.',
 '[
   {"keyword": "woning",        "weight": 2.0},
   {"keyword": "pand",          "weight": 1.5},
   {"keyword": "object",        "weight": 1.0},
   {"keyword": "huren",         "weight": 1.5},
   {"keyword": "kopen",         "weight": 1.5},
   {"keyword": "appartement",   "weight": 1.5},
   {"keyword": "huis",          "weight": 1.5},
   {"keyword": "property",      "weight": 1.5},
   {"keyword": "real estate",   "weight": 1.5},
   {"keyword": "vastgoed",      "weight": 1.5}
 ]'::jsonb,
 true, NULL, 'real_estate', ARRAY['real_estate'], 'active'),

-- ─── B2B / SaaS — SUGGESTED ──────────────────────────────────────────────────

-- comparison_focused → interestComparisonFocusedScore
('comparison_focused', 'Comparison-focused',
 'Visitor is comparing vendors, reading alternative reviews, or evaluating competitors.',
 '[
   {"keyword": "vergelijken",   "weight": 2.0},
   {"keyword": "compare",       "weight": 2.0},
   {"keyword": "alternatieven", "weight": 2.0},
   {"keyword": "versus",        "weight": 2.0},
   {"keyword": "alternatives",  "weight": 2.0},
   {"keyword": "vs",            "weight": 1.5},
   {"keyword": "vergelijking",  "weight": 2.0},
   {"keyword": "benchmark",     "weight": 1.5},
   {"keyword": "review",        "weight": 1.5},
   {"keyword": "competitors",   "weight": 1.5}
 ]'::jsonb,
 false, NULL, 'b2b_saas', ARRAY['b2b_saas', 'saas_product'], 'suggested'),

-- roi_focused → interestRoiFocusedScore
('roi_focused', 'ROI-focused',
 'Visitor is exploring ROI, business case, or financial value justification content.',
 '[
   {"keyword": "roi",               "weight": 2.5},
   {"keyword": "return",            "weight": 1.5},
   {"keyword": "rendement",         "weight": 2.0},
   {"keyword": "business case",     "weight": 2.5},
   {"keyword": "businesscase",      "weight": 2.5},
   {"keyword": "besparing",         "weight": 2.0},
   {"keyword": "savings",           "weight": 2.0},
   {"keyword": "payback",           "weight": 2.0},
   {"keyword": "waarde",            "weight": 1.5},
   {"keyword": "value",             "weight": 1.5},
   {"keyword": "impact",            "weight": 1.0}
 ]'::jsonb,
 false, NULL, 'b2b_saas', ARRAY['b2b_saas', 'saas_product', 'agency'], 'suggested'),

-- ─── Careers — SUGGESTED ─────────────────────────────────────────────────────

-- employer_brand_interest → interestEmployerBrandInterestScore
('employer_brand_interest', 'Employer Brand Interest',
 'Visitor is exploring employer brand content aimed at talent attraction and retention.',
 '[
   {"keyword": "employer",        "weight": 1.5},
   {"keyword": "werkgever",       "weight": 1.5},
   {"keyword": "talent",          "weight": 1.5},
   {"keyword": "cultuur",         "weight": 1.5},
   {"keyword": "benefits",        "weight": 1.5},
   {"keyword": "arbeidsmarkt",    "weight": 1.0},
   {"keyword": "employer brand",  "weight": 2.0},
   {"keyword": "onboarding",      "weight": 1.0},
   {"keyword": "merk",            "weight": 1.0},
   {"keyword": "people",          "weight": 1.0}
 ]'::jsonb,
 false, NULL, 'careers', ARRAY['careers', 'employer_brand'], 'suggested'),

-- ─── Commerce — SUGGESTED ─────────────────────────────────────────────────────

-- cart_ready → interestCartReadyScore
('cart_ready', 'Cart-ready',
 'Visitor has shown strong cart-addition or checkout-approach signals.',
 '[
   {"keyword": "winkelwagen",   "weight": 2.5},
   {"keyword": "cart",          "weight": 2.5},
   {"keyword": "in de wagen",   "weight": 2.0},
   {"keyword": "toevoegen",     "weight": 2.0},
   {"keyword": "add to cart",   "weight": 2.5},
   {"keyword": "winkelmand",    "weight": 2.5},
   {"keyword": "bestel",        "weight": 2.0},
   {"keyword": "checkout",      "weight": 2.0},
   {"keyword": "kassa",         "weight": 2.0}
 ]'::jsonb,
 false, NULL, 'commerce', ARRAY['ecommerce', 'retail'], 'suggested'),

-- repeat_product_interest → interestRepeatProductInterestScore
('repeat_product_interest', 'Repeat Product Interest',
 'Returning visitor showing renewed interest in products previously browsed.',
 '[
   {"keyword": "opnieuw",         "weight": 2.0},
   {"keyword": "nogmaals",        "weight": 2.0},
   {"keyword": "terug",           "weight": 1.5},
   {"keyword": "product",         "weight": 1.0},
   {"keyword": "recently viewed", "weight": 2.5},
   {"keyword": "wishlist",        "weight": 2.0},
   {"keyword": "verlanglijst",    "weight": 2.0},
   {"keyword": "bekeken",         "weight": 1.5},
   {"keyword": "saved",           "weight": 1.5}
 ]'::jsonb,
 false, NULL, 'commerce', ARRAY['ecommerce', 'retail'], 'suggested'),

-- ─── Real Estate — SUGGESTED ─────────────────────────────────────────────────

-- buyer_intent → interestBuyerIntentScore
('buyer_intent', 'Buyer Intent',
 'Visitor shows strong signals of intent to purchase or acquire a property.',
 '[
   {"keyword": "kopen",          "weight": 2.5},
   {"keyword": "aankoop",        "weight": 2.5},
   {"keyword": "bod",            "weight": 2.0},
   {"keyword": "financiering",   "weight": 2.0},
   {"keyword": "hypotheek",      "weight": 2.0},
   {"keyword": "buy",            "weight": 2.5},
   {"keyword": "purchase",       "weight": 2.0},
   {"keyword": "offer",          "weight": 2.0},
   {"keyword": "mortgage",       "weight": 2.0},
   {"keyword": "make offer",     "weight": 2.5}
 ]'::jsonb,
 false, NULL, 'real_estate', ARRAY['real_estate'], 'suggested'),

-- viewing_ready → interestViewingReadyScore
('viewing_ready', 'Viewing-ready',
 'Visitor is showing high intent to schedule a property viewing.',
 '[
   {"keyword": "bezichtiging",  "weight": 2.0},
   {"keyword": "afspraak",      "weight": 2.0},
   {"keyword": "plannen",       "weight": 1.5},
   {"keyword": "beschikbaar",   "weight": 1.0},
   {"keyword": "inplannen",     "weight": 2.0},
   {"keyword": "contact",       "weight": 1.0},
   {"keyword": "viewing",       "weight": 2.0},
   {"keyword": "book",          "weight": 1.5},
   {"keyword": "schedule",      "weight": 1.5}
 ]'::jsonb,
 false, NULL, 'real_estate', ARRAY['real_estate'], 'suggested'),

-- investor_style_interest → interestInvestorStyleInterestScore
('investor_style_interest', 'Investor-style Interest',
 'Visitor is exploring investment opportunities, rental yields, or financial return content.',
 '[
   {"keyword": "investeren",    "weight": 2.0},
   {"keyword": "rendement",     "weight": 2.0},
   {"keyword": "belegging",     "weight": 2.0},
   {"keyword": "verhuur",       "weight": 1.5},
   {"keyword": "roi",           "weight": 1.5},
   {"keyword": "vastgoed",      "weight": 1.5},
   {"keyword": "portfolio",     "weight": 1.0},
   {"keyword": "investor",      "weight": 2.0},
   {"keyword": "return",        "weight": 1.5},
   {"keyword": "yield",         "weight": 1.5}
 ]'::jsonb,
 false, NULL, 'real_estate', ARRAY['real_estate'], 'suggested');

-- ── Summary ───────────────────────────────────────────────────────────────────
--
-- ACTIVE (12 profiles — is_active = true, evaluated at runtime):
--   B2B / SaaS (5): pricing_focused, product_focused, use_case_focused,
--                   trust_focused, technical_focused
--   Careers    (3): candidate_explorer, job_specific_candidate, high_intent_applicant
--   Commerce   (3): product_explorer, deal_sensitive, high_purchase_intent
--   Real Estate(1): property_explorer
--
-- SUGGESTED (8 profiles — is_active = false, operator activates per tenant):
--   B2B / SaaS (2): comparison_focused, roi_focused
--   Careers    (1): employer_brand_interest
--   Commerce   (2): cart_ready, repeat_product_interest
--   Real Estate(3): buyer_intent, viewing_ready, investor_style_interest
