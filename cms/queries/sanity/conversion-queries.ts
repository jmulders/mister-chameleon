/**
 * Conversion Variant — Sanity GROQ query and raw response type
 *
 * Defines:
 *   CONVERSION_BY_KEY_QUERY  — fetch a single conversionVariant document by its `key` field
 *   SanityConversionRaw      — TypeScript shape of the GROQ projection result
 *
 * ─── Sanity document type: conversionVariant ─────────────────────────────────
 *
 *   key           string   Unique variant identifier (e.g. "conversion_signup")
 *   layoutVariant string?  Layout variant for the block renderer
 *   title         string   Display headline
 *   text          string   Supporting paragraph beneath the headline
 *   ctas          array    1–2 CTA objects { label, href, variant? }
 *   formKey       string?  Optional key referencing an embedded form definition
 *   urgencyLabel  string?  Optional urgency/social-proof label (e.g. "Join 2,000+ teams")
 *   isActive      boolean  Only active documents are returned by this query
 *
 * ─── Omitted fields ──────────────────────────────────────────────────────────
 *
 *   sourceTags — informational taxonomy tags. Not consumed downstream.
 */

import { buildVariantQuery } from "./query-builder";

// ── Conversion CTA item ───────────────────────────────────────────────────────

/**
 * A single CTA item as projected from a Sanity conversion `ctas[]` array field.
 * Reuses the same shape as SanityCTAItemRaw for consistency.
 */
export interface SanityConversionCTAItemRaw {
  _key?:    string;
  label:    string;
  href:     string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
}

// ── Raw response type ─────────────────────────────────────────────────────────

/**
 * Shape of the data returned by CONVERSION_BY_KEY_QUERY.
 *
 * Field names match the Sanity schema field names exactly.
 * The mapper (mapSanityConversion) translates these to ConversionBlockData.
 */
export interface SanityConversionRaw {
  _id:            string;
  tenantId?:      string;
  key:            string;
  /** Layout variant for the conversion block (e.g. "conversion_modal"). */
  layoutVariant?: string;
  title:          string;
  text:           string;
  ctas?:          SanityConversionCTAItemRaw[];
  formKey?:       string;
  urgencyLabel?:  string;
}

// ── GROQ query ────────────────────────────────────────────────────────────────

/**
 * Fetch a single conversionVariant document by its `key` field.
 *
 * Parameters:
 *   $key  string  The variant key, e.g. "conversion_signup"
 *
 * Returns: SanityConversionRaw | null
 *
 * @example
 *   const result = await client.fetch<SanityConversionRaw | null>(
 *     CONVERSION_BY_KEY_QUERY,
 *     { key: "conversion_signup" },
 *   );
 */
export const CONVERSION_BY_KEY_QUERY = buildVariantQuery(
  "conversionVariant",
  `
    _id,
    tenantId,
    key,
    layoutVariant,
    title,
    text,
    ctas[]{ _key, label, href, variant },
    formKey,
    urgencyLabel
  `,
);
