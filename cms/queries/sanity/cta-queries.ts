/**
 * CTA Variant — Sanity GROQ query and raw response type
 *
 * Defines:
 *   CTA_BY_KEY_QUERY  — fetch a single ctaVariant document by its `key` field
 *   SanityCTARaw      — TypeScript shape of the GROQ projection result
 *
 * ─── Sanity document type: ctaVariant ────────────────────────────────────────
 *
 *   key           string   Unique variant identifier (e.g. "cta_guide")
 *   layoutVariant string?  Layout variant for the block renderer
 *   title         string   Large display headline
 *   text          string   Supporting paragraph beneath the headline
 *   ctas          array    Preferred. 1–2 CTA objects { label, href, variant? }
 *   ctaLabel      string   Deprecated. Legacy single CTA label.
 *   ctaHref       string   Deprecated. Legacy single CTA href.
 *   isActive      boolean  Only active documents are returned by this query
 *
 * ─── Omitted fields ──────────────────────────────────────────────────────────
 *
 *   sourceTags — informational taxonomy tags. Not consumed downstream.
 *   Re-add to the projection if an analytics use case requires them.
 */

import { buildVariantQuery } from "./query-builder";

// ── CTA item ──────────────────────────────────────────────────────────────────

/**
 * A single CTA item as projected from a Sanity `ctas[]` array field.
 */
export interface SanityCTAItemRaw {
  _key?:    string;
  label:    string;
  href:     string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
}

// ── Raw response type ─────────────────────────────────────────────────────────

/**
 * Shape of the data returned by CTA_BY_KEY_QUERY.
 *
 * Field names match the Sanity schema field names exactly.
 * The mapper (mapSanityCTA) translates these to CTABlockData.
 *
 * Both the new `ctas[]` array and the legacy flat `ctaLabel`/`ctaHref`
 * fields are projected so the mapper can normalise old documents forward.
 */
export interface SanityCTARaw {
  _id:            string;
  tenantId?:      string;
  key:            string;
  /** Layout variant for the CTA block (e.g. "cta_split"). */
  layoutVariant?: string;
  title:          string;
  text:           string;
  /** Preferred CTA array — 1–2 items. */
  ctas?:          SanityCTAItemRaw[];
  /** @deprecated Use `ctas`. Present on documents not yet migrated. */
  ctaLabel?:      string;
  /** @deprecated Use `ctas`. Present on documents not yet migrated. */
  ctaHref?:       string;
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
    key,
    layoutVariant,
    title,
    text,
    ctas[]{ _key, label, href, variant },
    ctaLabel,
    ctaHref
  `,
);
