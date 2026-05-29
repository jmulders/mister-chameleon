/**
 * Feature Variant — Sanity GROQ query and raw response type
 *
 * Defines:
 *   FEATURE_BY_KEY_QUERY  — fetch a single featureVariant document by its `key` field
 *   SanityFeatureRaw      — TypeScript shape of the GROQ projection result
 *
 * ─── Sanity document type: featureVariant ────────────────────────────────────
 *
 *   key           string   Unique variant identifier (e.g. "feature_grid_primary")
 *   layoutVariant string?  Layout variant for the block renderer
 *   title         string   Section heading
 *   subtitle      string?  Optional subheading beneath the section heading
 *   items         array    Feature items — icon, title, body per item
 *   isActive      boolean  Only active documents are returned by this query
 *
 * ─── Omitted fields ──────────────────────────────────────────────────────────
 *
 *   sourceTags — informational taxonomy tags. Not consumed downstream.
 */

import { buildVariantQuery } from "./query-builder";

// ── Feature item ──────────────────────────────────────────────────────────────

/**
 * A single feature item as projected from a Sanity `items[]` array field.
 */
export interface SanityFeatureItemRaw {
  _key?:  string;
  title:  string;
  body:   string;
  icon?:  string;
}

// ── Raw response type ─────────────────────────────────────────────────────────

/**
 * Shape of the data returned by FEATURE_BY_KEY_QUERY.
 *
 * Field names match the Sanity schema field names exactly.
 * The mapper (mapSanityFeature) translates these to FeatureBlockData.
 */
export interface SanityFeatureRaw {
  _id:            string;
  tenantId?:      string;
  key:            string;
  /** Layout variant for the feature block (e.g. "feature_highlights"). */
  layoutVariant?: string;
  title:          string;
  subtitle?:      string;
  items:          SanityFeatureItemRaw[];
}

// ── GROQ query ────────────────────────────────────────────────────────────────

/**
 * Fetch a single featureVariant document by its `key` field.
 *
 * Parameters:
 *   $key  string  The variant key, e.g. "feature_grid_primary"
 *
 * Returns: SanityFeatureRaw | null
 *
 * @example
 *   const result = await client.fetch<SanityFeatureRaw | null>(
 *     FEATURE_BY_KEY_QUERY,
 *     { key: "feature_grid_primary" },
 *   );
 */
export const FEATURE_BY_KEY_QUERY = buildVariantQuery(
  "featureVariant",
  `
    _id,
    tenantId,
    key,
    layoutVariant,
    title,
    subtitle,
    items[]{ _key, title, body, icon }
  `,
);
