/**
 * Proof Variant — Sanity GROQ query and raw response types
 *
 * Defines:
 *   PROOF_BY_KEY_QUERY  — fetch a single proofVariant document by its `key` field
 *   SanityProofRaw      — TypeScript shape of the GROQ projection result
 *   SanityProofItemRaw  — TypeScript shape of a single proof item
 *
 * ─── Sanity document type: proofVariant ──────────────────────────────────────
 *
 *   key        string         Unique variant identifier (e.g. "proof_cases")
 *   title      string         Section heading displayed above the proof items
 *   items      ProofItem[]    Array of proof points (typically 3)
 *     ↳ title  string         Bold label — metric, quote anchor, or capability
 *     ↳ text   string         One-to-two sentence supporting copy
 *   isActive   boolean        Only active documents are returned by this query
 *
 * ─── Omitted fields ──────────────────────────────────────────────────────────
 *
 *   sourceTags — informational taxonomy tags. Not consumed downstream.
 *   Re-add to the projection if an analytics use case requires them.
 */

import { buildVariantQuery } from "./query-builder";

// ── Raw response types ────────────────────────────────────────────────────────

/**
 * Shape of a single proof item as returned by Sanity.
 */
export interface SanityProofItemRaw {
  title: string;
  text: string;
}

/**
 * Shape of the data returned by PROOF_BY_KEY_QUERY.
 *
 * `items` is marked optional because Sanity may return null/undefined for an
 * empty array field. The mapper (mapSanityProof) handles this with a `?? []`
 * fallback so callers always receive a fully-formed ProofBlockData.
 */
export interface SanityProofRaw {
  _id:       string;
  tenantId?: string;
  key:       string;
  title:     string;
  items?:    SanityProofItemRaw[];
}

// ── GROQ query ────────────────────────────────────────────────────────────────

/**
 * Fetch a single proofVariant document by its `key` field.
 *
 * Parameters:
 *   $key  string  The variant key, e.g. "proof_cases"
 *
 * Returns: SanityProofRaw | null
 *
 * Projection notes:
 *   - `items[]` expands the array inline with a sub-projection per element
 *   - `_key` is intentionally excluded from the item projection (not needed)
 *
 * @example
 *   const result = await client.fetch<SanityProofRaw | null>(
 *     PROOF_BY_KEY_QUERY,
 *     { key: "proof_cases" },
 *   );
 */
export const PROOF_BY_KEY_QUERY = buildVariantQuery(
  "proofVariant",
  `
    _id,
    tenantId,
    "key": key.current,
    title,
    "items": items[] {
      title,
      text
    }
  `,
);
