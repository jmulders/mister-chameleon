/**
 * Interest Profile Types
 *
 * Platform-managed interest profiles that score visitor engagement based on
 * the keywords associated with pages they have visited.
 *
 * ─── Architecture position ────────────────────────────────────────────────────
 *
 *   CMS page (metaKeywords[])
 *        ↓  visitor browses pages
 *   Visitor keyword cloud          (accumulated in session / local store)
 *        ↓  scoreInterests()
 *   InterestScore per profile      (frequency × per-tag weight, normalized 0–1)
 *        ↓  buildInterestContextVars()
 *   Context variables:
 *     interestPrimary    — key of the top-scoring profile
 *     interestSecondary  — key of the second-highest scoring profile
 *     interestConfidence — 0–1 confidence score for interestPrimary
 *     interest<PascalKey>Score — raw score per profile
 *                                (e.g. interestPricingFocusedScore)
 *
 * ─── Interest profile storage ──────────────────────────────────────────────────
 *
 *   Profiles are stored in the `interest_profiles` Supabase table and loaded
 *   at runtime by the platform.  Operators manage profiles through the admin UI
 *   at /admin/interest-profiles.
 *
 * ─── Keyword matching ─────────────────────────────────────────────────────────
 *
 *   Matching is case-insensitive and exact (no stemming).
 *   Operators should use the same keyword strings in both:
 *     - page metaKeywords (CMS)
 *     - interest profile tag.keyword values (DB)
 */

// ── Interest profile family ───────────────────────────────────────────────────

/**
 * Groups related interest profiles into a business domain.
 *
 *   b2b_saas      B2B / SaaS products and service platforms
 *   careers       Recruitment, job boards, career sites
 *   commerce      E-commerce and retail
 *   real_estate   Property portals and estate agencies
 */
export type InterestProfileFamily =
  | "b2b_saas"
  | "careers"
  | "commerce"
  | "real_estate";

// ── Interest profile default status ──────────────────────────────────────────

/**
 * Platform-seeding intent for a profile.
 *
 *   active     Profile is on by default — is_active = true in the DB seed.
 *              Evaluated at runtime immediately after db push.
 *
 *   suggested  Profile is seeded but inactive (is_active = false).
 *              Shown to operators in the admin UI as a recommended addition.
 *              Activated per-tenant when appropriate.
 */
export type InterestProfileDefaultStatus = "active" | "suggested";

// ── Interest profile tag ──────────────────────────────────────────────────────

/**
 * A single keyword + weight pair within an interest profile.
 *
 * `keyword`  — the exact string matched against page metaKeywords (case-insensitive)
 * `weight`   — multiplier applied when this keyword appears in the visitor's cloud.
 *              Range: 0.1 – 10.0. Defaults to 1.0 if not set.
 *              Use higher weights for high-signal keywords (e.g. product-specific terms)
 *              and lower weights for generic ones (e.g. "logistics").
 */
export interface InterestTag {
  readonly keyword: string;
  readonly weight:  number;
}

// ── Interest profile ──────────────────────────────────────────────────────────

/**
 * A named interest profile grouping related keywords and weights.
 *
 * Profiles are stored in the `interest_profiles` table and managed by operators
 * through the admin UI.  Each profile corresponds to one dimension of visitor
 * interest (e.g. "pricing_focused", "candidate_explorer").
 *
 * ─── Key conventions ──────────────────────────────────────────────────────────
 *
 *   `key` must be URL-safe: lowercase, alphanumeric, hyphens and underscores.
 *   It becomes the suffix of the per-profile context variable (toPascalCase):
 *     key = "pricing_focused" → context variable: interestPricingFocusedScore
 *     key = "use_case_focused" → context variable: interestUseCaseFocusedScore
 *
 * ─── Tenant scoping ───────────────────────────────────────────────────────────
 *
 *   Profiles are either tenant-scoped (tenantId set) or platform-wide
 *   (tenantId absent / null).  The scoring engine loads both the tenant's own
 *   profiles and the platform-wide profiles for each request.
 *
 *   Admin UI:
 *     /admin/interest-profiles               — platform-wide profiles
 *     /admin/tenants/[id]/interest-profiles  — tenant-scoped + inherited view
 *
 * ─── DB schema ────────────────────────────────────────────────────────────────
 *
 *   interest_profiles (
 *     id                      uuid   PRIMARY KEY
 *     tenant_id               text   REFERENCES tenants(id) ON DELETE CASCADE  — NULL = platform
 *     key                     text   NOT NULL         — slug identifier (unique within scope)
 *     name                    text   NOT NULL         — human-readable label
 *     description             text                    — optional operator notes
 *     tags                    jsonb  NOT NULL DEFAULT '[]'  — InterestTag[]
 *     is_active               bool   NOT NULL DEFAULT true
 *     family                  text                    — b2b_saas | careers | commerce | real_estate
 *     recommended_site_models text[] NOT NULL DEFAULT '{}'
 *     default_status          text   NOT NULL DEFAULT 'active'  — 'active' | 'suggested'
 *     created_at              timestamptz
 *     updated_at              timestamptz
 *     UNIQUE (key) WHERE tenant_id IS NULL
 *     UNIQUE (tenant_id, key) WHERE tenant_id IS NOT NULL
 *   )
 */
export interface InterestProfile {
  readonly id:                     string;
  readonly key:                    string;
  /** Human-readable label shown in admin UI and debug views. */
  readonly name:                   string;
  readonly description?:           string;
  readonly tags:                   readonly InterestTag[];
  readonly isActive:               boolean;
  /** Business domain grouping. Absent for tenant-created profiles that skip the field. */
  readonly family?:                InterestProfileFamily;
  /** Site model keys this profile is designed for (informational; not enforced at runtime). */
  readonly recommendedSiteModels:  readonly string[];
  /**
   * Platform seeding intent.
   * - 'active'    — on by default; is_active = true in the canonical seed.
   * - 'suggested' — seeded inactive; operator activates per-tenant.
   * Absent for tenant-scoped profiles (they control is_active directly).
   */
  readonly defaultStatus?:         InterestProfileDefaultStatus;
  /** Set when this profile is scoped to a specific tenant; absent for platform-wide profiles. */
  readonly tenantId?:              string;
}

// ── Visitor keyword cloud ─────────────────────────────────────────────────────

/**
 * A frequency map of keywords accumulated from pages visited in this session
 * (or across sessions when a persistent profile is available).
 *
 * Keys are lowercase keywords; values are occurrence counts.
 *
 * Example:
 *   { "pricing": 3, "features": 1, "api": 2 }
 */
export type VisitorKeywordCloud = Record<string, number>;

// ── Interest scores ───────────────────────────────────────────────────────────

/**
 * Per-profile interest score for a single visitor.
 *
 * `profileKey`   — the profile's `key` field
 * `rawScore`     — sum of (keyword frequency × tag weight) for matched keywords
 * `normalizedScore` — rawScore normalized to 0–1 across all profiles (divides by
 *                     the max rawScore across all evaluated profiles)
 */
export interface InterestScore {
  readonly profileKey:       string;
  readonly rawScore:         number;
  readonly normalizedScore:  number;
}

// ── Context variables ─────────────────────────────────────────────────────────

/**
 * The interest-derived context variables exposed to the decision engine,
 * rules, and AI providers.
 *
 *   interestPrimary    — key of the highest-scoring profile (empty string if no signal)
 *   interestSecondary  — key of the second-highest scoring profile
 *   interestConfidence — normalizedScore of the primary profile (0–1, rounded to 2 dp)
 *   perProfile         — per-profile normalized score map
 *                        (e.g. { pricing_focused: 0.8, product_focused: 0.2 })
 */
export interface InterestContextVars {
  readonly interestPrimary:    string;
  readonly interestSecondary:  string;
  readonly interestConfidence: number;
  readonly perProfile:         Record<string, number>;
}

// ── DB row types ──────────────────────────────────────────────────────────────

/** Row shape for the `interest_profiles` table (migration 074 schema). */
export interface InterestProfileRow {
  id:                      string;
  tenant_id:               string | null;
  key:                     string;
  name:                    string;
  description:             string | null;
  tags:                    InterestTag[];
  is_active:               boolean;
  family:                  string | null;
  recommended_site_models: string[];
  default_status:          string;
  created_at:              string;
  updated_at:              string;
}

/** Insert shape for the `interest_profiles` table. */
export interface InterestProfileInsert {
  id?:                      string;
  tenant_id?:               string | null;
  key:                      string;
  name:                     string;
  description?:             string | null;
  tags:                     InterestTag[];
  is_active?:               boolean;
  family?:                  string | null;
  recommended_site_models?: string[];
  default_status?:          string;
  created_at?:              string;
  updated_at?:              string;
}
