/**
 * CTA Variant — Sanity GROQ query and raw response type
 *
 * Defines:
 *   CTA_BY_KEY_QUERY  — fetch a single ctaVariant document by its `key` field
 *   SanityCTARaw      — TypeScript shape of the GROQ projection result
 *
 * ─── Sanity document type: ctaVariant ────────────────────────────────────────
 *
 *   key        string   Unique variant identifier (e.g. "cta_guide")
 *   title      string   Large display headline
 *   text       string   Supporting paragraph beneath the headline
 *   ctaLabel   string   CTA button text
 *   ctaHref    string   CTA button destination URL
 *   isActive   boolean  Only active documents are returned by this query
 *
 * ─── Omitted fields ──────────────────────────────────────────────────────────
 *
 *   sourceTags — informational taxonomy tags. Not consumed downstream.
 *   Re-add to the projection if an analytics use case requires them.
 */

import { buildVariantQuery } from "./query-builder";

// ── Raw response type ─────────────────────────────────────────────────────────

/**
 * Shape of the data returned by CTA_BY_KEY_QUERY.
 *
 * Field names match the Sanity schema field names exactly.
 * The mapper (mapSanityCTA) translates these to CTABlockData.
 */
export interface SanityCTARaw {
  _id:       string;
  tenantId?: string;
  key:       string;
  title:     string;
  text:      string;
  ctaLabel:  string;
  ctaHref:   string;
}

// ── GROQ query ────────────────────────────────────────────────────────────────

/**
 * Fetch a single ctaVariant document by its `key` field.
 *
 * Parameters:
 *   $key  string  The variant key, e.g. "cta_guide"
 *
 * Returns: SanityCTARaw | null
 *
 * @example
 *   const result = await client.fetch<SanityCTARaw | null>(
 *     CTA_BY_KEY_QUERY,
 *     { key: "cta_guide" },
 *   );
 */
export const CTA_BY_KEY_QUERY = buildVariantQuery(
  "ctaVariant",
  `
    _id,
    tenantId,
    "key": key.current,
    title,
    text,
    ctaLabel,
    ctaHref
  `,
);
