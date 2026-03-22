/**
 * Proof Variant — Storyblok content type and slug builder
 *
 * Defines:
 *   StoryblokProofItemContent  — the content shape of a single proof item block
 *   StoryblokProofContent      — the content field shape of a proofVariant story
 *   proofVariantSlug()         — builds the full slug for a proof variant story
 *
 * ─── Storyblok component: proof_variant ──────────────────────────────────────
 *
 *   The `proof_variant` Storyblok component must be configured with these fields:
 *
 *   Field name    Type        Notes
 *   ──────────    ──────      ──────────────────────────────────────────────────
 *   key           Text        Variant identifier — e.g. "proof_cases"
 *   title         Text        Section heading displayed above the proof items
 *   items         Blocks      Array of proof_item blocks (typically 3)
 *   is_active     Boolean     Soft-disable without unpublishing
 *
 * ─── Storyblok component: proof_item (nested block) ──────────────────────────
 *
 *   Used inside the `items` Blocks field of proof_variant:
 *
 *   Field name    Type        Notes
 *   ──────────    ──────      ──────────────────────────────────────────────────
 *   title         Text        Short bold label — metric, quote anchor, capability
 *   text          Textarea    One-to-two sentence supporting copy
 *
 * ─── Story slug convention ───────────────────────────────────────────────────
 *
 *   Stories must be created inside a folder named "proof-variants" in Storyblok.
 *   Each story's slug must match its variant key exactly:
 *
 *     Storyblok space
 *       └── proof-variants/
 *             ├── proof_cases     ← slug = "proof_cases"
 *             ├── proof_vision    ← slug = "proof_vision"
 *             └── proof_platform  ← slug = "proof_platform"
 *
 * ─── Field name mapping ──────────────────────────────────────────────────────
 *
 *   StoryblokProofContent        →  ProofBlockData
 *   ───────────────────────         ──────────────────────
 *   key                         →  id
 *   title                       →  title
 *   items[].title               →  items[].title
 *   items[].text                →  items[].text
 */

// ── Storyblok folder slug ─────────────────────────────────────────────────────

/**
 * Storyblok folder slug that contains all proof variant stories.
 * Must match the folder created in your Storyblok space exactly.
 */
export const PROOF_VARIANTS_FOLDER = "proof-variants" as const;

// ── Content types ─────────────────────────────────────────────────────────────

/**
 * Content fields of a single proof item block (component: proof_item).
 *
 * Storyblok automatically injects `_uid` and `component` into every block —
 * these are included here because they are always present and `_uid` can
 * be used as a React list key if needed.
 */
export interface StoryblokProofItemContent {
  /** Storyblok-generated unique block identifier — useful as a React key */
  _uid: string;
  /** Block component type name — always "proof_item" */
  component: string;
  /** Short bold label, e.g. "3.2× more leads" */
  title: string;
  /** One-to-two sentence supporting copy */
  text: string;
}

/**
 * Content fields of a Storyblok `proof_variant` story.
 *
 * `items` is typed as optional to match Storyblok's behaviour when the
 * Blocks field is empty — the CDN may return null or omit the field.
 * The mapper (mapStoryblokProof) handles this with a `?? []` fallback.
 */
export interface StoryblokProofContent {
  /** Variant identifier — matches the story slug and the ProofVariantKey */
  key: string;
  /** Section heading displayed above the proof items */
  title: string;
  /** Array of proof item blocks. May be absent when the Blocks field is empty. */
  items?: StoryblokProofItemContent[];
  /**
   * Soft-disable flag.
   * Published stories with is_active=false are treated as not found.
   */
  is_active: boolean;
}

// ── Slug builder ──────────────────────────────────────────────────────────────

/**
 * Builds the full Storyblok story slug for a proof variant.
 *
 * @param key  The variant key, e.g. "proof_cases"
 * @returns    The full story slug, e.g. "proof-variants/proof_cases"
 *
 * @example
 *   const slug = proofVariantSlug("proof_cases");
 *   // → "proof-variants/proof_cases"
 */
export function proofVariantSlug(key: string): string {
  return `${PROOF_VARIANTS_FOLDER}/${key}`;
}
