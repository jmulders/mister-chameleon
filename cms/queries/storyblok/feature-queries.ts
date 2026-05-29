/**
 * Feature Variant — Storyblok content type and slug builder
 *
 * Defines:
 *   StoryblokFeatureContent  — the content field shape of a feature_variant story
 *   StoryblokFeatureItem     — a single feature item inside the items bloks array
 *   featureVariantSlug()     — builds the full slug for a feature variant story
 *
 * ─── Storyblok component: feature_variant ─────────────────────────────────────
 *
 *   Stories are stored in the "feature-variants" folder:
 *     feature-variants/feature_grid_primary
 *     feature-variants/feature_highlights
 *     feature-variants/feature_comparison
 *
 * ─── Field name mapping ────────────────────────────────────────────────────────
 *
 *   StoryblokFeatureContent  →  FeatureBlockData
 *   ──────────────────────      ──────────────────────
 *   key                     →  id
 *   title                   →  title
 *   subtitle                →  subtitle
 *   layout_variant          →  layoutVariant
 *   items[].title           →  items[].title
 *   items[].body            →  items[].body
 *   items[].icon            →  items[].icon
 */

// ── Storyblok folder slug ─────────────────────────────────────────────────────

export const FEATURE_VARIANTS_FOLDER = "feature-variants" as const;

// ── Content types ─────────────────────────────────────────────────────────────

/** A single feature item inside a feature_variant.items bloks array. */
export interface StoryblokFeatureItem {
  _uid?:       string;
  component?:  string;
  /** Short bold title, e.g. "Embedded delivery model" */
  title:       string;
  /** One-to-three sentence supporting copy */
  body:        string;
  /** Optional icon identifier — slug-style string, e.g. "lightning" */
  icon?:       string;
}

/**
 * Content fields of a Storyblok `feature_variant` story.
 *
 * Field names use Storyblok's snake_case convention.
 * The mapper (mapStoryblokFeature) translates these to FeatureBlockData.
 */
export interface StoryblokFeatureContent {
  /** Variant identifier — matches the story slug and the FeatureVariantKey */
  key:              string;
  /** Soft-disable flag — false means the slot returns null */
  is_active:        boolean;
  /** Section heading above the feature items */
  title:            string;
  /** Optional section subheading / intro sentence */
  subtitle?:        string;
  /**
   * Layout variant for the feature block.
   *   feature_grid        — compact icon + title grid (default)
   *   feature_highlights  — larger alternating left/right rows
   *   feature_comparison  — side-by-side comparison table
   */
  layout_variant?:  string;
  /** Ordered list of feature / benefit items (typically 3–6) */
  items?:           StoryblokFeatureItem[];
}

// ── Slug builder ──────────────────────────────────────────────────────────────

/**
 * Builds the full Storyblok story slug for a feature variant.
 *
 * @param key  The variant key, e.g. "feature_grid_primary"
 * @returns    The full story slug, e.g. "feature-variants/feature_grid_primary"
 */
export function featureVariantSlug(key: string): string {
  return `${FEATURE_VARIANTS_FOLDER}/${key}`;
}
