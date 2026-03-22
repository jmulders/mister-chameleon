/**
 * Proof Variant — Statamic content type
 *
 * Defines:
 *   StatamicProofItem   — the shape of a single proof item (Grid field row)
 *   StatamicProofEntry  — the entry shape of a proof_variants collection entry
 *
 * ─── Statamic collection: proof_variants ──────────────────────────────────
 *
 *   The `proof_variants` collection must be configured with these fields:
 *
 *   Field handle     Type      Notes
 *   ────────────     ──────    ──────────────────────────────────────────────
 *   key              Text      Variant identifier — e.g. "proof_cases"
 *   title            Text      Section heading displayed above the proof items
 *   items            Grid      Array of proof items (rows with title + text cols)
 *   is_active        Toggle    Soft-disable without hiding the entry
 *
 * ─── Grid field: items ────────────────────────────────────────────────────
 *
 *   The `items` field is a Statamic Grid with two columns:
 *
 *   Column handle    Type      Notes
 *   ──────────────   ──────    ──────────────────────────────────────────────
 *   title            Text      Short bold label — metric, quote anchor, capability
 *   text             Text      One-to-two sentence supporting copy
 *
 *   Unlike Storyblok Blocks, Grid field rows have no _uid or component fields.
 *   The API returns them as plain objects with only the configured columns.
 *
 * ─── Field name mapping ───────────────────────────────────────────────────
 *
 *   StatamicProofEntry       →  ProofBlockData
 *   ─────────────────────        ──────────────────────
 *   key                      →  id
 *   title                    →  title
 *   (items??[]).map(...)     →  items (see StatamicProofItem mapping below)
 *
 *   StatamicProofItem        →  ProofBlockData.items[n]
 *   ──────────────────           ────────────────────────
 *   title                    →  title
 *   text                     →  text
 */

// ── Collection handle ──────────────────────────────────────────────────────

/**
 * Statamic collection handle for proof variant entries.
 * Must match the collection created in your Statamic installation exactly.
 */
export const PROOF_VARIANTS_COLLECTION = "proof_variants" as const;

// ── Content types ──────────────────────────────────────────────────────────

/**
 * Content shape of a single row in the `items` Grid field.
 *
 * Statamic Grid fields return plain objects with only the configured columns.
 * Unlike Storyblok Blocks, there is no _uid or component metadata.
 */
export interface StatamicProofItem {
  /** Short bold label, e.g. "3.2× more leads" */
  title: string;
  /** One-to-two sentence supporting copy */
  text: string;
}

/**
 * Content fields of a Statamic proof_variants collection entry.
 *
 * Field names use Statamic's snake_case convention.
 * The mapper (mapStatamicProof) translates these to ProofBlockData.
 *
 * Note: `items` is typed as optional because a Grid field may be empty,
 * in which case Statamic may omit the field or return null.
 * The mapper handles this with a `?? []` fallback.
 */
export interface StatamicProofEntry {
  /** Statamic-generated entry UUID */
  id: string;
  /** Entry slug — typically matches the variant key */
  slug: string;
  /** Variant identifier — e.g. "proof_cases" */
  key: string;
  /** Section heading displayed above the proof items */
  title: string;
  /** Array of proof item Grid rows. May be absent when the Grid is empty. */
  items?: StatamicProofItem[];
  /**
   * Soft-disable flag.
   * Published entries with is_active=false are treated as not found.
   */
  is_active: boolean;
}
