/**
 * Statamic pages collection entry type
 *
 * Maps to content/collections/pages/{slug}.md in the Statamic CMS.
 * Used by StatamicProvider.getPageBySlug() and variant lookups.
 *
 * ─── Replicator content blocks ─────────────────────────────────────────────
 *
 *   The `content` field on each page entry is a Statamic Replicator.
 *   Each set in the Replicator maps to a block type:
 *
 *     type: hero_variant   →  StatamicHeroReplicatorSet
 *     type: proof_variant  →  StatamicProofReplicatorSet
 *     type: cta_variant    →  StatamicCTAReplicatorSet
 *
 *   Statamic adds `type` automatically to each Replicator set when returning
 *   the API response. The set key matches the Replicator set handle.
 *
 * ─── Variant lookup via Replicator ─────────────────────────────────────────
 *
 *   StatamicProvider.getHeroVariant(key) searches the home page `content`
 *   array for a hero_variant block with matching `key`. This replaces the
 *   older pattern of fetching from a separate `hero_variants` collection.
 *
 *   The separate collections remain as a fallback for backward compatibility.
 */

export const PAGES_COLLECTION = "pages" as const;

// ── Replicator block types ─────────────────────────────────────────────────

/** Base shape shared by all Replicator set objects. */
interface StatamicReplicatorBase {
  /** Set handle added by Statamic to every Replicator block */
  type:       string;
  /**
   * Platform-level soft-disable flag set by the mister-chameleon decision
   * engine.  When false the variant is treated as inactive.
   */
  is_active?: boolean;
  /**
   * Statamic's own Replicator set toggle — appears as an on/off switch in
   * the CP beside each block row.  When the editor toggles a block off,
   * Statamic writes `enabled: false` to the YAML/draft data.
   * Both this and `is_active` must be checked when filtering blocks.
   */
  enabled?: boolean;
}

/** A single CTA button within a hero_variant Replicator set. */
export interface StatamicHeroReplicatorCTA {
  label:    string;
  href:     string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
}

/** A hero_variant block embedded in a page's `content` Replicator field. */
export interface StatamicHeroReplicatorSet extends StatamicReplicatorBase {
  type:            "hero_variant";
  /** Variant identifier — must match the key used by the personalisation engine */
  key:             string;
  is_active?:      boolean;
  layout_variant?: string;
  content_align?:  "left" | "center" | "right";
  tag?:            string;
  title?:          string;
  subtitle?:       string;
  ctas?:           StatamicHeroReplicatorCTA[];
  /** Flat legacy CTA — present on blocks authored before the `ctas` array was added */
  cta_label?:      string;
  cta_href?:       string;
  media?: {
    media_type?:  "none" | "image" | "video";
    media_image?: string | null;
    media_alt?:   string | null;
    video_source?: "upload" | "youtube" | "vimeo";
    video_file?:  string | null;
    video_poster?: string | null;
    video_autoplay?: boolean;
    video_muted?: boolean;
    video_loop?: boolean;
    video_controls?: boolean;
    video_id?: string | null;
  } | null;
}

/** A proof_variant block embedded in a page's `content` Replicator field. */
export interface StatamicProofReplicatorSet extends StatamicReplicatorBase {
  type:       "proof_variant";
  key:        string;
  is_active?: boolean;
  title?:     string;
  items?:     Array<{ title: string; text: string }>;
}

/** A cta_variant block embedded in a page's `content` Replicator field. */
export interface StatamicCTAReplicatorSet extends StatamicReplicatorBase {
  type:             "cta_variant";
  key:              string;
  is_active?:       boolean;
  title?:           string;
  text?:            string;
  subtext?:         string;
  cta_label?:       string;
  cta_href?:        string;
  secondary_label?: string;
  secondary_href?:  string;
}

/** A single CTA button within a feature_variant or conversion_variant Replicator set. */
export interface StatamicReplicatorCTA {
  label:    string;
  href:     string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
}

/** A single item within a feature_variant Replicator set. */
export interface StatamicFeatureReplicatorItem {
  title: string;
  body:  string;
  icon?: string;
}

/** A feature_variant block embedded in a page's `content` Replicator field. */
export interface StatamicFeatureReplicatorSet extends StatamicReplicatorBase {
  type:            "feature_variant";
  /** Variant identifier — must match the key used by the personalisation engine */
  key:             string;
  is_active?:      boolean;
  layout_variant?: "feature_grid" | "feature_highlights" | "feature_comparison";
  /** Section heading above the feature items */
  title?:          string;
  /** Optional introductory sentence */
  subtitle?:       string;
  /** Feature / benefit items (typically 3–6) */
  items?:          StatamicFeatureReplicatorItem[];
}

/** A conversion_variant block embedded in a page's `content` Replicator field. */
export interface StatamicConversionReplicatorSet extends StatamicReplicatorBase {
  type:            "conversion_variant";
  /** Variant identifier — must match the key used by the personalisation engine */
  key:             string;
  is_active?:      boolean;
  layout_variant?: "default" | "signup" | "demo" | "contact";
  /** Large display headline */
  title?:          string;
  /** Supporting paragraph */
  text?:           string;
  /** 1–2 CTA buttons */
  ctas?:           StatamicReplicatorCTA[];
  /**
   * Key of a platform-registered form embed (e.g. "signup-form", "hubspot-demo").
   * When absent the block renders as a standard headline + CTA section.
   */
  form_key?:       string;
  /**
   * Short urgency / reassurance label shown near the CTA
   * (e.g. "No credit card required", "Free for 14 days").
   */
  urgency_label?:  string;
}

/** Discriminated union of all supported Replicator set types. */
export type StatamicPageReplicatorBlock =
  | StatamicHeroReplicatorSet
  | StatamicProofReplicatorSet
  | StatamicCTAReplicatorSet
  | StatamicFeatureReplicatorSet
  | StatamicConversionReplicatorSet;

// ── Unified page_blocks Replicator block types ────────────────────────────────

/**
 * A context_slot block within the unified page_blocks Replicator.
 *
 * Context slots are adaptive anchor points in the page that mark where a
 * personalisation slot renders.  Position is determined by the block's position
 * within the `page_blocks` array — editors can freely reorder them relative to
 * content blocks.  Editors can change the default variant key (shown when no
 * personalisation rule matches) and toggle the slot on/off.
 */
export interface StatamicContextSlotBlock {
  id?:          string;
  type:         "context_slot";
  /** Which adaptive slot this anchor represents. */
  slot_type:    "hero" | "proof" | "cta" | "feature" | "conversion" | "notification" | string;
  /** Default variant key shown when no rule matches (e.g. "hero_default"). */
  variant_key?: string;
  /** When false the slot is skipped — visitors see nothing in this position. */
  is_active?:   boolean;
  /** Statamic's own replicator toggle. */
  enabled?:     boolean;
}

/** Union of context_slot items + content-block items in the page_blocks field. */
export type StatamicPageBlock =
  | StatamicContextSlotBlock
  | StatamicPageReplicatorBlock
  | ({ type: string } & Record<string, unknown>);

// ── Page entry ──────────────────────────────────────────────────────────────

/** Adaptive slot defaults — which variant key to show by default for each slot. */
export interface StatamicAdaptiveSlots {
  hero_key?:       string;
  proof_key?:      string;
  cta_key?:        string;
  feature_key?:    string;
  conversion_key?: string;
}

export interface StatamicPageEntry {
  /** The page title — used in <title> and as H1 fallback */
  title:            string;
  /** SEO meta description */
  seo_description?: string;
  /** Comma-separated or array of intent keywords for interest scoring */
  meta_keywords?:   string | string[];
  /** Template hint: "home" | "marketing-page" | "article-page" */
  template?:        string;
  /** Blueprint name — for context, not used in mapping */
  blueprint?:       string;

  /**
   * Adaptive slot defaults (new architecture).
   * Specifies which variant key is shown by default for each adaptive slot.
   * The platform decision engine may override these at render time.
   */
  adaptive_slots?: StatamicAdaptiveSlots;

  /**
   * Typed variant catalogues (new architecture).
   * Each page stores its variants in separate typed top-level arrays instead
   * of one mixed `content` Replicator. StatamicProvider flattens these into
   * a single `_homePageContent` array for backward-compatible variant lookup.
   */
  hero_variants?:       StatamicHeroReplicatorSet[];
  proof_variants?:      StatamicProofReplicatorSet[];
  cta_variants?:        StatamicCTAReplicatorSet[];
  feature_variants?:    StatamicFeatureReplicatorSet[];
  conversion_variants?: StatamicConversionReplicatorSet[];

  /**
   * Free content zone (non-adaptive blocks).
   * Editor-controlled content that is NOT managed by the personalisation engine.
   * Rendered below the adaptive slots in the page template.
   *
   * Also used as a legacy fallback: old page entries that predate the typed
   * variant arrays may store all blocks here in the original mixed format.
   */
  content?: StatamicPageReplicatorBlock[];

  /**
   * Unified page blocks Replicator.
   *
   * Single Replicator containing both context_slot blocks and free content
   * blocks (text_section, rich_text, image, etc.) as siblings.  Position in the
   * array determines render order — editors can freely interleave context slots
   * with content blocks.
   *
   * Each context_slot block maps to a `ContextSlotSectionData` entry in the
   * platform's sections[] array, while content blocks map to their respective
   * section types.
   */
  page_blocks?: StatamicPageBlock[];
}
