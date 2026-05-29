-- ============================================================================
-- Migration 073: Interest Profiles — canonical catalog (underscore keys)
--
-- Problem:
--   Migration 061 seeded profiles with hyphen-based short keys (e.g. "pricing",
--   "use-case", "commerce-product").  The platform requires underscore-style
--   descriptive keys that produce clearer context variables:
--
--     pricing_focused  →  interestPricingFocusedScore
--     use_case_focused →  interestUseCaseFocusedScore
--
--   Additionally, migration 061 may not have run on all environments because it
--   was previously blocked by migration 028.  This migration is idempotent and
--   standalone: it can run even if 061 was skipped.
--
-- What this migration does:
--   1. Ensures infrastructure from 061 (tenant_id column, partial indexes) exists.
--   2. Deletes all platform-wide profiles (tenant_id IS NULL) — cleans both the
--      old dummy set and the 061 hyphen-key set in one step.
--   3. Seeds 15 production-ready profiles across four domains with underscore keys:
--        B2B / SaaS   — 5 profiles (all active)
--        Careers      — 4 profiles (all active)
--        Commerce     — 3 profiles (all active)
--        Real Estate  — 3 profiles (all active)
--
-- Key → context variable mapping (toPascalCase handles both - and _):
--   pricing_focused         →  interestPricingFocusedScore
--   product_focused         →  interestProductFocusedScore
--   use_case_focused        →  interestUseCaseFocusedScore
--   trust_focused           →  interestTrustFocusedScore
--   technical_focused       →  interestTechnicalFocusedScore
--   candidate_explorer      →  interestCandidateExplorerScore
--   job_specific_candidate  →  interestJobSpecificCandidateScore
--   high_intent_applicant   →  interestHighIntentApplicantScore
--   employer_brand_interest →  interestEmployerBrandInterestScore
--   product_explorer        →  interestProductExplorerScore
--   deal_sensitive          →  interestDealSensitiveScore
--   high_purchase_intent    →  interestHighPurchaseIntentScore
--   property_explorer       →  interestPropertyExplorerScore
--   buyer_intent            →  interestBuyerIntentScore
--   viewing_ready           →  interestViewingReadyScore
--
-- Idempotency:
--   ADD COLUMN IF NOT EXISTS, CREATE UNIQUE INDEX IF NOT EXISTS — safe to re-run.
--   DELETE + INSERT is deterministic.
-- ============================================================================

-- ── Step 1: Ensure infrastructure from migration 061 (in case 061 was skipped) ─

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

-- ── Step 2: Remove all platform-wide profiles ─────────────────────────────────
--
-- Removes old dummy profiles (Bakken, Fruit, Gezondheid), any 061 hyphen-key
-- profiles, and any other platform-wide entries so the canonical set below is
-- the sole source of truth.  Tenant-scoped profiles are left untouched.

DELETE FROM public.interest_profiles WHERE tenant_id IS NULL;

-- ── Step 3: Seed canonical interest profile catalog ───────────────────────────
--
-- ─── B2B / SaaS ───────────────────────────────────────────────────────────────

INSERT INTO public.interest_profiles (key, name, description, tags, is_active, tenant_id) VALUES

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
 true, NULL),

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
 true, NULL),

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
 true, NULL),

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
 true, NULL),

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
 true, NULL),

-- ─── Careers ──────────────────────────────────────────────────────────────────

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
 true, NULL),

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
 true, NULL),

-- high_intent_applicant → interestHighIntentApplicantScore
('high_intent_applicant', 'High-intent Applicant',
 'Visitor shows strong apply-intent signals — viewed a specific role and engaged with application flow.',
 '[
   {"keyword": "solliciteren",     "weight": 2.5},
   {"keyword": "apply",            "weight": 2.5},
   {"keyword": "sollicitatie",     "weight": 2.5},
   {"keyword": "application",     "weight": 2.0},
   {"keyword": "cv",               "weight": 2.0},
   {"keyword": "resume",           "weight": 2.0},
   {"keyword": "cover letter",     "weight": 1.5},
   {"keyword": "motivatiebrief",   "weight": 1.5},
   {"keyword": "direct sollicit",  "weight": 2.5},
   {"keyword": "now hiring",       "weight": 2.0}
 ]'::jsonb,
 true, NULL),

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
 true, NULL),

-- ─── Commerce ─────────────────────────────────────────────────────────────────

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
 true, NULL),

-- deal_sensitive → interestDealSensitiveScore
('deal_sensitive', 'Deal-sensitive',
 'Visitor is actively looking for discounts, deals, or promotional offers.',
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
 true, NULL),

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
 true, NULL),

-- ─── Real Estate ──────────────────────────────────────────────────────────────

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
 true, NULL),

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
 true, NULL),

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
 true, NULL);

-- ── Summary ───────────────────────────────────────────────────────────────────
--
-- 15 active platform-wide profiles:
--
--   B2B / SaaS (5):
--     pricing_focused, product_focused, use_case_focused,
--     trust_focused, technical_focused
--
--   Careers (4):
--     candidate_explorer, job_specific_candidate,
--     high_intent_applicant, employer_brand_interest
--
--   Commerce (3):
--     product_explorer, deal_sensitive, high_purchase_intent
--
--   Real Estate (3):
--     property_explorer, buyer_intent, viewing_ready
