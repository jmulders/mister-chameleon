/**
 * Variant Candidates — Sanity GROQ queries
 *
 * Fetches ALL active variants for each slot (hero / proof / cta) for a given
 * tenant, including only the minimal fields needed by the AI variant candidate
 * resolver: key, isActive, and the embedded decisionMeta object.
 *
 * ─── Purpose ──────────────────────────────────────────────────────────────────
 *
 *   Unlike the per-key variant queries (hero-queries.ts, proof-queries.ts,
 *   cta-queries.ts) which fetch a single document by key, these queries return
 *   ALL active variants for a slot. The AI decision engine uses them to
 *   build the pool of candidates from which it will choose one.
 *
 * ─── Tenant resolution ────────────────────────────────────────────────────────
 *
 *   Each query returns documents that are either:
 *     a) Tenant-specific   (tenantId == $tenantId)
 *     b) Platform/shared   (!defined(tenantId))
 *
 *   When a tenant variant and a platform variant share the same key, BOTH are
 *   returned here. The resolver (ai/resolve-variant-candidates.ts) handles the
 *   merge: tenant meta takes precedence over platform meta for shared keys.
 *
 * ─── decisionMeta projection ──────────────────────────────────────────────────
 *
 *   All fields of the variantDecisionMeta object are projected explicitly.
 *   GROQ returns null for any field not yet populated in the Studio.
 *   The resolver normalises null/undefined to empty arrays where needed.
 *
 * ─── Params ───────────────────────────────────────────────────────────────────
 *
 *   $tenantId   string | null
 *     When provided: returns tenant-specific + platform variants.
 *     When null:     returns platform-only variants (no tenant filter).
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   const client = getSanityClient();
 *
 *   const [heroVariants, proofVariants, ctaVariants] = await Promise.all([
 *     client.fetch<SanityVariantCandidateRaw[]>(HERO_CANDIDATES_QUERY, { tenantId }),
 *     client.fetch<SanityVariantCandidateRaw[]>(PROOF_CANDIDATES_QUERY, { tenantId }),
 *     client.fetch<SanityVariantCandidateRaw[]>(CTA_CANDIDATES_QUERY, { tenantId }),
 *   ]);
 *
 *   const candidates = resolveVariantCandidates({
 *     heroVariants,
 *     proofVariants,
 *     ctaVariants,
 *   });
 */

// ── Raw response type ─────────────────────────────────────────────────────────

/**
 * Raw decisionMeta object as projected from Sanity.
 * All fields may be null when not yet populated in the Studio.
 */
export interface SanityDecisionMetaRaw {
  decisionLabel:               string | null;
  decisionSummary:             string | null;
  whatThisVariantCommunicates: string | null;
  intendedAudience:            string | null;
  intentLevel:                 string | null;
  funnelStages:                string[] | null;
  bestForSources:              string[] | null;
  tone:                        string | null;
  primaryGoal:                 string | null;
  supportingGoals:             string[] | null;
  exclusions:                  string[] | null;
}

/**
 * Shape returned by all three candidate queries.
 *
 * Compatible with CmsVariantRaw from ai/resolve-variant-candidates.ts.
 * The resolver accepts this directly after the null-aware array coercion.
 */
export interface SanityVariantCandidateRaw {
  key:          string;
  isActive:     boolean;
  tenantId:     string | null;
  decisionMeta: SanityDecisionMetaRaw | null;
}

// ── Shared projection ─────────────────────────────────────────────────────────

/**
 * GROQ projection for the decisionMeta embedded object.
 * All fields listed explicitly to avoid pulling unrequested data.
 */
const DECISION_META_PROJECTION = `
  decisionMeta {
    decisionLabel,
    decisionSummary,
    whatThisVariantCommunicates,
    intendedAudience,
    intentLevel,
    funnelStages,
    bestForSources,
    tone,
    primaryGoal,
    supportingGoals,
    exclusions
  }
`.trim();

/** GROQ projection shared across all three candidate queries. */
const CANDIDATE_PROJECTION = `{
  key,
  isActive,
  tenantId,
  ${DECISION_META_PROJECTION}
}`;

// ── Tenant + platform filter ──────────────────────────────────────────────────

/**
 * Predicate that returns documents visible to a given tenant:
 *   - Tenant-specific documents (tenantId == $tenantId)
 *   - Platform/shared documents (!defined(tenantId))
 *
 * When $tenantId is null, only platform/shared documents are returned.
 */
const TENANT_FILTER = `($tenantId == null || tenantId == $tenantId || !defined(tenantId))`;

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Fetch all active hero variant candidates for a tenant.
 *
 * Returns both tenant-specific and platform/shared hero documents.
 * Results are sorted: tenant-specific documents first, then platform.
 */
export const HERO_CANDIDATES_QUERY = `
  *[
    _type == "heroVariant" &&
    isActive == true &&
    ${TENANT_FILTER}
  ]
  | order(
    select(
      $tenantId != null && defined(tenantId) && tenantId == $tenantId => 0,
      1
    ) asc
  )
  ${CANDIDATE_PROJECTION}
`.trim();

/**
 * Fetch all active proof variant candidates for a tenant.
 */
export const PROOF_CANDIDATES_QUERY = `
  *[
    _type == "proofVariant" &&
    isActive == true &&
    ${TENANT_FILTER}
  ]
  | order(
    select(
      $tenantId != null && defined(tenantId) && tenantId == $tenantId => 0,
      1
    ) asc
  )
  ${CANDIDATE_PROJECTION}
`.trim();

/**
 * Fetch all active CTA variant candidates for a tenant.
 */
export const CTA_CANDIDATES_QUERY = `
  *[
    _type == "ctaVariant" &&
    isActive == true &&
    ${TENANT_FILTER}
  ]
  | order(
    select(
      $tenantId != null && defined(tenantId) && tenantId == $tenantId => 0,
      1
    ) asc
  )
  ${CANDIDATE_PROJECTION}
`.trim();

// ── Param type ────────────────────────────────────────────────────────────────

/** Params accepted by all three candidate queries. */
export interface VariantCandidateQueryParams {
  /** Tenant ID to fetch candidates for, or null for platform-only variants. */
  tenantId: string | null;
}
