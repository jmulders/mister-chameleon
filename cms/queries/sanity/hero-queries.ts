/**
 * Hero Variant — Sanity GROQ query and raw response type
 *
 * Defines:
 *   HERO_BY_KEY_QUERY  — fetch a single heroVariant document by its `key` field
 *   SanityHeroRaw      — TypeScript shape of the GROQ projection result
 *
 * ─── Sanity document type: heroVariant ───────────────────────────────────────
 *
 *   tenantId   string?  Tenant that owns this variant (absent = shared)
 *   key        string   Unique variant identifier (e.g. "hero_google_problem")
 *   title      string   Primary display headline
 *   subtitle   string   Supporting paragraph beneath the headline
 *   ctaLabel   string   CTA button text
 *   ctaHref    string   CTA button destination URL
 *   tag        string?  Optional eyebrow badge above the headline
 *   isActive   boolean  Only active documents are returned by this query
 *
 * ─── Omitted fields ──────────────────────────────────────────────────────────
 *
 *   sourceTags / stageTags — informational taxonomy tags stored in Sanity for
 *   editorial use (filtering, search). They are not consumed by the decision
 *   engine (which derives source from the request context, not content fields)
 *   and are not needed by any component. Re-add to the projection if an
 *   analytics or content-audit use case requires them.
 */

import { buildVariantQuery } from "./query-builder";

// ── Raw response type ─────────────────────────────────────────────────────────

/**
 * Shape of the data returned by HERO_BY_KEY_QUERY.
 *
 * Field names match the Sanity schema field names exactly.
 * The mapper (mapSanityHero) translates these to HeroBlockData.
 */
export interface SanityHeroRaw {
  _id:       string;
  tenantId?: string;
  key:       string;
  title:     string;
  subtitle:  string;
  ctaLabel:  string;
  ctaHref:   string;
  tag?:      string;
}

// ── GROQ query ────────────────────────────────────────────────────────────────

/**
 * Fetch a single heroVariant document by its `key` field.
 *
 * Parameters:
 *   $key      string        The variant key, e.g. "hero_google_problem"
 *   $tenantId string | null Tenant scope. null = all tenants (backward-compat).
 *
 * Returns: SanityHeroRaw | null
 *
 * Projection notes:
 *   - `isActive == true` guard is part of the shared filter in buildVariantQuery
 *   - `[0]` returns the first match as an object; null if nothing matched
 *   - ctaLabel / ctaHref are flat strings — the mapper constructs CTAData
 *
 * @example
 *   const result = await client.fetch<SanityHeroRaw | null>(
 *     HERO_BY_KEY_QUERY,
 *     { key: "hero_google_problem" },
 *   );
 */
export const HERO_BY_KEY_QUERY = buildVariantQuery(
  "heroVariant",
  `
    _id,
    tenantId,
    "key": key.current,
    title,
    subtitle,
    ctaLabel,
    ctaHref,
    tag
  `,
);
