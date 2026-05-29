/**
 * Hero Variant — Storyblok content type and slug builder
 *
 * Defines:
 *   StoryblokHeroContent  — the content field shape of a heroVariant story
 *   heroVariantSlug()     — builds the full slug for a hero variant story
 *
 * ─── Storyblok component: hero_variant ───────────────────────────────────────
 *
 *   The `hero_variant` Storyblok component must be configured with these fields:
 *
 *   Field name    Type      Notes
 *   ──────────    ──────    ──────────────────────────────────────────────────
 *   key           Text      Variant identifier — e.g. "hero_google_problem"
 *                           Should match the Storyblok story slug suffix.
 *   title         Text      Primary display headline
 *   subtitle      Textarea  Supporting paragraph beneath the headline
 *   cta_label     Text      CTA button label
 *   cta_href      Text      CTA button destination URL (relative or absolute)
 *   tag           Text      Optional eyebrow badge above the headline
 *   is_active     Boolean   Soft-disable without unpublishing.
 *                           Published but is_active=false → null returned.
 *
 * ─── Story slug convention ───────────────────────────────────────────────────
 *
 *   Stories must be created inside a folder named "hero-variants" in Storyblok.
 *   Each story's slug must match its variant key exactly:
 *
 *     Storyblok space
 *       └── hero-variants/
 *             ├── hero_google_problem   ← slug = "hero_google_problem"
 *             ├── hero_linkedin_vision  ← slug = "hero_linkedin_vision"
 *             └── hero_direct_brand    ← slug = "hero_direct_brand"
 *
 *   The heroVariantSlug() function produces the full slug:
 *     heroVariantSlug("hero_google_problem") → "hero-variants/hero_google_problem"
 *
 * ─── Field name mapping ──────────────────────────────────────────────────────
 *
 *   StoryblokHeroContent    →  HeroBlockData
 *   ──────────────────────     ──────────────────────────
 *   key                    →  id
 *   layout_variant         →  layoutVariant
 *   content_align          →  contentAlign
 *   title                  →  title
 *   subtitle               →  subtitle
 *   ctas[].label           →  ctas[].label   (preferred)
 *   ctas[].href            →  ctas[].href
 *   ctas[].variant         →  ctas[].variant
 *   cta_label              →  cta.label      (legacy fallback)
 *   cta_href               →  cta.href       (legacy fallback)
 *   tag                    →  tag
 */

// ── Storyblok folder slug ─────────────────────────────────────────────────────

/**
 * Storyblok folder slug that contains all hero variant stories.
 * Must match the folder created in your Storyblok space exactly.
 */
export const HERO_VARIANTS_FOLDER = "hero-variants" as const;

// ── Content type ──────────────────────────────────────────────────────────────

/**
 * A single CTA item within the Storyblok `ctas` Blocks array field.
 *
 * Storyblok uses its standard component + _uid envelope; `_uid` is omitted
 * here since the mapper does not use it.
 */
export interface StoryblokHeroCTAItem {
  _uid?: string;
  /** Button label text */
  label: string;
  /** Destination URL — relative ("#demo") or absolute */
  href: string;
  /** Visual style override. Omit to use position-based default. */
  variant?: "primary" | "secondary" | "outline" | "ghost";
}

/**
 * Media attachment within a Storyblok `hero_variant` story.
 *
 * Storyblok field names use snake_case.  The mapper (mapStoryblokHero)
 * converts this flat object into the HeroBannerMedia discriminated union.
 *
 * Storyblok component setup:
 *   - media_type       → Single-option select: none / image / video
 *   - media_image      → Asset field (image) with a nested "alt" text field
 *   - video_source     → Single-option select: upload / youtube / vimeo
 *   - video_file       → Asset field (video file) — used when video_source = upload
 *   - video_poster     → Asset field (image) — optional poster for upload video
 *   - video_autoplay   → Boolean
 *   - video_muted      → Boolean
 *   - video_loop       → Boolean
 *   - video_controls   → Boolean
 *   - video_id         → Text — YouTube or Vimeo video ID
 */
export interface StoryblokHeroMedia {
  media_type?:     "none" | "image" | "video";
  /** Storyblok asset object for the image */
  media_image?:    { filename?: string; alt?: string } | null;
  video_source?:   "upload" | "youtube" | "vimeo";
  /** Storyblok asset object for the video file */
  video_file?:     { filename?: string } | null;
  /** Storyblok asset object for the poster image */
  video_poster?:   { filename?: string } | null;
  video_autoplay?: boolean;
  video_muted?:    boolean;
  video_loop?:     boolean;
  video_controls?: boolean;
  /** YouTube or Vimeo video ID */
  video_id?:       string;
}

/**
 * Content fields of a Storyblok `hero_variant` story.
 *
 * Field names use Storyblok's snake_case convention.
 * The mapper (mapStoryblokHero) translates these to HeroBlockData.
 *
 * Note: Storyblok automatically adds `_uid` and `component` to every
 * content object — they are omitted here since the mapper does not use them.
 */
export interface StoryblokHeroContent {
  /** Variant identifier — matches the story slug and the HeroVariantKey */
  key: string;
  /**
   * Structural layout of the hero block.
   * Add a Single-option select field named `layout_variant` to the
   * `hero_variant` component with values: hero_default | hero_split |
   * hero_proof | hero_background.
   * Absent stories use the component's default (hero_default).
   */
  layout_variant?: string;
  /**
   * Horizontal alignment of the hero content (headline, subtitle, CTAs).
   * Only meaningful when layout_variant === "hero_background".
   * Add a Single-option select field named `content_align` with values:
   * left | center | right.
   */
  content_align?: "left" | "center" | "right";
  /** Primary display headline */
  title: string;
  /** Supporting paragraph beneath the headline */
  subtitle: string;
  /**
   * Flexible CTA array — preferred over the legacy flat fields.
   * Add a Blocks field named `ctas` in the `hero_variant` component,
   * with a nested `hero_cta` component containing label / href / variant.
   */
  ctas?: StoryblokHeroCTAItem[];
  /**
   * @deprecated Use `ctas`.
   * Present on stories authored before the ctas array was introduced.
   */
  cta_label?: string;
  /**
   * @deprecated Use `ctas`.
   * Present on stories authored before the ctas array was introduced.
   */
  cta_href?: string;
  /** Optional eyebrow badge above the headline */
  tag?: string;
  /**
   * Optional media attachment.
   * Absent on stories created before this field was added — treated as no media.
   */
  media?: StoryblokHeroMedia | null;
  /**
   * Soft-disable flag.
   * Published stories with is_active=false are treated as not found
   * by StoryblokProvider — the fallback plan fires instead.
   */
  is_active: boolean;
}

// ── Slug builder ──────────────────────────────────────────────────────────────

/**
 * Builds the full Storyblok story slug for a hero variant.
 *
 * The returned slug is passed to StoryblokClient.fetchStory<StoryblokHeroContent>().
 *
 * @param key  The variant key, e.g. "hero_google_problem"
 * @returns    The full story slug, e.g. "hero-variants/hero_google_problem"
 *
 * @example
 *   const slug = heroVariantSlug("hero_google_problem");
 *   // → "hero-variants/hero_google_problem"
 */
export function heroVariantSlug(key: string): string {
  return `${HERO_VARIANTS_FOLDER}/${key}`;
}
