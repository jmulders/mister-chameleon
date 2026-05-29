-- ============================================================================
-- Migration 061: Interest Profiles — replace irrelevant seed data
--
-- Problem:
--   The live interest_profiles table contains nonsense platform-wide profiles
--   that are unrelated to the platform's actual use cases, for example:
--     • Bakken
--     • Fruit
--     • Gezondheid
--   These appear in the scoring engine output, polluting interestPrimary /
--   interestSecondary context variables with irrelevant values.
--
-- What this migration does:
--   1. Ensures tenant_id column exists (added since migration 026 if not present).
--   2. Updates the unique constraint to be platform-scoped so tenant overrides
--      can use the same key as a platform profile.
--   3. Deletes all existing platform-wide profiles (tenant_id IS NULL).
--   4. Seeds 15 production-ready interest profiles across four domains:
--        B2B / SaaS / Services  — 6 profiles (4 active, 2 draft)
--        Careers                — 3 profiles (1 active, 2 draft)
--        Commerce               — 3 profiles (1 active, 2 draft)
--        Real Estate            — 3 profiles (1 active, 2 draft)
--   5. Active starter set: 8 profiles.
--      Draft set:          7 profiles (inactive, not evaluated at runtime).
--
-- Idempotency:
--   ALTER TABLE … ADD COLUMN IF NOT EXISTS is safe to re-run.
--   DROP CONSTRAINT IF EXISTS / CREATE UNIQUE INDEX IF NOT EXISTS are safe.
--   DELETE + INSERT is deterministic.  Re-running after a partial apply is safe
--   because the DELETE removes any partially-inserted rows before re-inserting.
--
-- Score variable naming convention (derived from key by toPascalCase):
--   key              → context variable
--   pricing          → interestPricingScore
--   product          → interestProductScore
--   use-case         → interestUseCaseScore
--   trust            → interestTrustScore
--   technical        → interestTechnicalScore
--   services         → interestServicesScore
--   candidate        → interestCandidateScore
--   employer-brand   → interestEmployerBrandScore
--   job-specific     → interestJobSpecificScore
--   commerce-product → interestCommerceProductScore
--   deal             → interestDealScore
--   purchase         → interestPurchaseScore
--   property         → interestPropertyScore
--   viewing          → interestViewingScore
--   investor         → interestInvestorScore
-- ============================================================================

-- ── Step 1: Ensure tenant_id column exists ────────────────────────────────────
--
-- Migration 026 omitted tenant_id; the scoring engine and repository expect it.
-- ADD COLUMN IF NOT EXISTS is a no-op when the column already exists.

ALTER TABLE public.interest_profiles
  ADD COLUMN IF NOT EXISTS tenant_id text;

-- ── Step 2: Replace unique constraint with platform-scoped partial index ───────
--
-- The old constraint interest_profiles_key_uniq enforces uniqueness on (key)
-- globally, preventing tenant-scoped profiles from using the same key as a
-- platform profile.  Replace it with two partial indexes:
--   • Platform-wide profiles: UNIQUE (key) WHERE tenant_id IS NULL
--   • Tenant-scoped profiles:  UNIQUE (tenant_id, key) WHERE tenant_id IS NOT NULL

ALTER TABLE public.interest_profiles
  DROP CONSTRAINT IF EXISTS interest_profiles_key_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS interest_profiles_platform_key_uniq
  ON public.interest_profiles (key)
  WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS interest_profiles_tenant_key_uniq
  ON public.interest_profiles (tenant_id, key)
  WHERE tenant_id IS NOT NULL;

-- ── Step 3: Remove all old platform-wide profiles ─────────────────────────────
--
-- Deletes Bakken, Fruit, Gezondheid, and any other irrelevant profiles that
-- were seeded or created as platform-wide entries (tenant_id IS NULL).
-- Tenant-scoped profiles (tenant_id IS NOT NULL) are left untouched.

DELETE FROM public.interest_profiles WHERE tenant_id IS NULL;

-- ── Step 4: Seed production-ready interest profiles ───────────────────────────
--
-- ─── B2B / SaaS / Services ───────────────────────────────────────────────────

INSERT INTO public.interest_profiles (key, name, description, tags, is_active, tenant_id) VALUES

-- ACTIVE: Pricing-focused
-- interestPricingScore
('pricing', 'Pricing-focused',
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

-- ACTIVE: Product-focused
-- interestProductScore
('product', 'Product-focused',
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

-- ACTIVE: Use-case-focused
-- interestUseCaseScore
('use-case', 'Use-case-focused',
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

-- ACTIVE: Trust-focused
-- interestTrustScore
('trust', 'Trust-focused',
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

-- ACTIVE: Technical-focused
-- interestTechnicalScore
('technical', 'Technical-focused',
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

-- DRAFT: Services-focused
-- interestServicesScore
('services', 'Services-focused',
 'Visitor is exploring professional services, implementation, or support offerings.',
 '[
   {"keyword": "diensten",      "weight": 1.5},
   {"keyword": "services",      "weight": 1.5},
   {"keyword": "implementatie", "weight": 1.5},
   {"keyword": "onboarding",    "weight": 1.5},
   {"keyword": "support",       "weight": 1.0},
   {"keyword": "consultancy",   "weight": 1.5},
   {"keyword": "training",      "weight": 1.0},
   {"keyword": "partnership",   "weight": 1.0},
   {"keyword": "managed",       "weight": 1.0}
 ]'::jsonb,
 false, NULL),

-- ─── Careers ──────────────────────────────────────────────────────────────────

-- ACTIVE: Candidate Explorer
-- interestCandidateScore
('candidate', 'Candidate Explorer',
 'Visitor is exploring job opportunities, team culture, or career content.',
 '[
   {"keyword": "vacatures",   "weight": 2.0},
   {"keyword": "vacature",    "weight": 2.0},
   {"keyword": "werken-bij",  "weight": 2.0},
   {"keyword": "werken bij",  "weight": 2.0},
   {"keyword": "jobs",        "weight": 2.0},
   {"keyword": "job",         "weight": 1.5},
   {"keyword": "solliciteren","weight": 1.5},
   {"keyword": "team",        "weight": 1.0},
   {"keyword": "cultuur",     "weight": 1.5},
   {"keyword": "culture",     "weight": 1.5},
   {"keyword": "loopbaan",    "weight": 1.5},
   {"keyword": "careers",     "weight": 2.0}
 ]'::jsonb,
 true, NULL),

-- DRAFT: Employer Brand
-- interestEmployerBrandScore
('employer-brand', 'Employer Brand',
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
   {"keyword": "merk",            "weight": 1.0}
 ]'::jsonb,
 false, NULL),

-- DRAFT: Job-specific
-- interestJobSpecificScore
('job-specific', 'Job-specific',
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
   {"keyword": "apply",                  "weight": 1.5}
 ]'::jsonb,
 false, NULL),

-- ─── Commerce ─────────────────────────────────────────────────────────────────

-- ACTIVE: Product Explorer (Commerce)
-- interestCommerceProductScore
('commerce-product', 'Product Explorer',
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

-- DRAFT: Deal-sensitive
-- interestDealScore
('deal', 'Deal-sensitive',
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
   {"keyword": "promo",       "weight": 1.5},
   {"keyword": "aanbieding",  "weight": 2.0}
 ]'::jsonb,
 false, NULL),

-- DRAFT: Purchase Intent
-- interestPurchaseScore
('purchase', 'Purchase Intent',
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
 false, NULL),

-- ─── Real Estate ──────────────────────────────────────────────────────────────

-- ACTIVE: Property Explorer
-- interestPropertyScore
('property', 'Property Explorer',
 'Visitor is browsing and evaluating properties in a real estate context.',
 '[
   {"keyword": "woning",        "weight": 2.0},
   {"keyword": "pand",          "weight": 1.5},
   {"keyword": "object",        "weight": 1.0},
   {"keyword": "bezichtiging",  "weight": 2.0},
   {"keyword": "huren",         "weight": 1.5},
   {"keyword": "kopen",         "weight": 1.5},
   {"keyword": "appartement",   "weight": 1.5},
   {"keyword": "huis",          "weight": 1.5},
   {"keyword": "property",      "weight": 1.5},
   {"keyword": "real estate",   "weight": 1.5},
   {"keyword": "vastgoed",      "weight": 1.5}
 ]'::jsonb,
 true, NULL),

-- DRAFT: Viewing Intent
-- interestViewingScore
('viewing', 'Viewing Intent',
 'Visitor is showing high intent to schedule a property viewing.',
 '[
   {"keyword": "bezichtiging",  "weight": 2.0},
   {"keyword": "afspraak",      "weight": 2.0},
   {"keyword": "plannen",       "weight": 1.5},
   {"keyword": "beschikbaar",   "weight": 1.0},
   {"keyword": "inplannen",     "weight": 2.0},
   {"keyword": "contact",       "weight": 1.0},
   {"keyword": "viewing",       "weight": 2.0},
   {"keyword": "book",          "weight": 1.5}
 ]'::jsonb,
 false, NULL),

-- DRAFT: Investor Intent
-- interestInvestorScore
('investor', 'Investor Intent',
 'Visitor is exploring investment opportunities or financial return content.',
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
 false, NULL);

-- ── Index on tenant_id for runtime lookups ────────────────────────────────────

CREATE INDEX IF NOT EXISTS interest_profiles_tenant_id_idx
  ON public.interest_profiles (tenant_id);

-- ── Summary ───────────────────────────────────────────────────────────────────
--
-- Active starter set (8 profiles — evaluated at runtime):
--   pricing, product, use-case, trust, technical   (B2B / SaaS)
--   candidate                                       (Careers)
--   commerce-product                               (Commerce)
--   property                                        (Real Estate)
--
-- Draft set (7 profiles — inactive, visible in admin but skipped by scoring):
--   services                                        (B2B / SaaS)
--   employer-brand, job-specific                    (Careers)
--   deal, purchase                                  (Commerce)
--   viewing, investor                               (Real Estate)
