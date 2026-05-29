/**
 * Hero Variant — Statamic content type
 *
 * Defines:
 *   StatamicHeroEntry  — the entry shape of a hero_variants collection entry
 *
 * ─── Statamic collection: hero_variants ───────────────────────────────────
 *
 *   The `hero_variants` collection must be configured with these fields:
 *
 *   Field handle     Type      Notes
 *   ────────────     ──────    ──────────────────────────────────────────────
 *   key              Text      Variant identifier — e.g. "hero_google_problem"
 *                              Should match the entry slug.
 *   title            Text      Primary display headline
 *   subtitle         Text      Supporting paragraph beneath the headline
 *   cta_label        Text      CTA button label
 *   cta_href         Text      CTA button destination URL (relative or absolute)
 *   tag              Text      Optional eyebrow badge above the headline
 *   is_active        Toggle    Soft-disable without hiding the entry.
 *                              Published but is_active=false → null returned.
 *
 * ─── Entry slug convention ─────────────────────────────────────────────────
 *
 *   Entry slugs in the hero_variants collection should match their variant key:
 *
 *     hero_variants collection
 *       ├── hero_google_problem   ← key = "hero_google_problem"
 *       ├── hero_linkedin_vision  ← key = "hero_linkedin_vision"
 *       └── hero_direct_brand     ← key = "hero_direct_brand"
 *
 * ─── Field name mapping ───────────────────────────────────────────────────
 *
 *   StatamicHeroEntry     →  HeroBlockData
 *   ──────────────────        ──────────────────────────
 *   key                   →  id
 *   layout_variant        →  layoutVariant
 *   content_align         →  contentAlign
 *   title                 →  title
 *   subtitle              →  subtitle
 *   ctas[].label          →  ctas[].label   (preferred)
 *   ctas[].href           →  ctas[].href
 *   ctas[].variant        →  ctas[].variant
 *   cta_label             →  cta.label      (legacy fallback)
 *   cta_href              →  cta.href       (legacy fallback)
 *   tag                   →  tag
 */

// ── Collection handle ──────────────────────────────────────────────────────

/**
 * Statamic collection handle for hero variant entries.
 * Must match the collection created in your Statamic installation exactly.
 */
export const HERO_VARIANTS_COLLECTION = "hero_variants" as const;

// ── Content type ───────────────────────────────────────────────────────────

/**
 * A single CTA item within a Statamic `ctas` Replicator / Grid field.
 */
export interface StatamicHeroCTAItem {
  /** Button label text */
  label: string;
  /** Destination URL — relative ("#demo") or absolute */
  href: string;
  /** Visual style override. Omit to use position-based default. */
  variant?: "primary" | "secondary" | "outline" | "ghost";
}

/**
 * Media attachment within a Statamic hero_variants entry.
 *
 * Field names use Statamic's snake_case convention.
 * The mapper (mapStatamicHero) converts this into a HeroBannerMedia union.
 *
 * Blueprint setup:
 *   - media_type     Select: none / image / video
 *   - media_image    Assets (image) — resolves to a URL string
 *   - media_alt      Text — alt text for the image
 *   - video_source   Select: upload / youtube / vimeo
 *   - video_file     Assets (video) — resolves to a URL string
 *   - video_poster   Assets (image) — optional poster URL
 *   - video_autoplay Toggle
 *   - video_muted    Toggle
 *   - video_loop     Toggle
 *   - video_controls Toggle
 *   - video_id       Text — YouTube or Vimeo video ID
 */
export interface StatamicHeroMedia {
  media_type?:     "none" | "image" | "video";
  /** URL of the image asset (resolved by Statamic's Assets fieldtype) */
  media_image?:    string | null;
  media_alt?:      string | null;
  video_source?:   "upload" | "youtube" | "vimeo";
  /** URL of the uploaded video file */
  video_file?:     string | null;
  /** URL of the poster image */
  video_poster?:   string | null;
  video_autoplay?: boolean;
  video_muted?:    boolean;
  video_loop?:     boolean;
  video_controls?: boolean;
  /** YouTube or Vimeo video ID */
  video_id?:       string | null;
}

/**
 * Content fields of a Statamic hero_variants collection entry.
 *
 * Field names use Statamic's snake_case convention at the API level.
 * The mapper (mapStatamicHero) translates these to HeroBlockData.
 *
 * Note: Statamic automatically adds `id` and `slug` to every entry — they
 * are included here as part of the entry envelope.
 */
export interface StatamicHeroEntry {
  /** Statamic-generated entry UUID */
  id: string;
  /** Entry slug — typically matches the variant key */
  slug: string;
  /** Variant identifier — e.g. "hero_google_problem" */
  key: string;
  /**
   * Structural layout of the hero block.
   * Add a Select field named `layout_variant` to the `hero_variants` blueprint
   * with options: hero_default | hero_split | hero_proof | hero_background.
   */
  layout_variant?: string;
  /**
   * Horizontal alignment of the hero content (headline, subtitle, CTAs).
   * Only meaningful when layout_variant === "hero_background".
   * Add a Select field named `content_align` with options: left | center | right.
   */
  content_align?: "left" | "center" | "right";
  /** Primary display headline */
  title: string;
  /** Supporting paragraph beneath the headline */
  subtitle: string;
  /**
   * Flexible CTA array — preferred over the legacy flat fields.
   * Add a Replicator field named `ctas` in the `hero_variants` blueprint,
   * with a set containing label / href / variant text fields.
   */
  ctas?: StatamicHeroCTAItem[];
  /**
   * @deprecated Use `ctas`.
   * Present on entries authored before the ctas array was introduced.
   */
  cta_label?: string;
  /**
   * @deprecated Use `ctas`.
   * Present on entries authored before the ctas array was introduced.
   */
  cta_href?: string;
  /** Optional eyebrow badge above the headline */
  tag?: string;
  /**
   * Optional media attachment.
   * Absent on entries created before this field was added — treated as no media.
   */
  media?: StatamicHeroMedia | null;
  /**
   * Soft-disable flag.
   * Published entries with is_active=false are treated as not found
   * by StatamicProvider — the fallback plan fires instead.
   */
  is_active: boolean;
}
