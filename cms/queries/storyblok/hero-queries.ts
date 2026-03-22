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
 *   ──────────────────────     ──────────────────────
 *   key                    →  id
 *   title                  →  title
 *   subtitle               →  subtitle
 *   cta_label              →  cta.label
 *   cta_href               →  cta.href
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
  /** Primary display headline */
  title: string;
  /** Supporting paragraph beneath the headline */
  subtitle: string;
  /** CTA button label */
  cta_label: string;
  /** CTA button destination URL — relative ("#how-it-works") or absolute */
  cta_href: string;
  /** Optional eyebrow badge above the headline */
  tag?: string;
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
