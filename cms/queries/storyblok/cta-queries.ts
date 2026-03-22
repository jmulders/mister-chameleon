/**
 * CTA Variant — Storyblok content type and slug builder
 *
 * Defines:
 *   StoryblokCTAContent  — the content field shape of a ctaVariant story
 *   ctaVariantSlug()     — builds the full slug for a CTA variant story
 *
 * ─── Storyblok component: cta_variant ────────────────────────────────────────
 *
 *   The `cta_variant` Storyblok component must be configured with these fields:
 *
 *   Field name    Type      Notes
 *   ──────────    ──────    ──────────────────────────────────────────────────
 *   key           Text      Variant identifier — e.g. "cta_guide"
 *   title         Text      Large display headline
 *   text          Textarea  Supporting paragraph beneath the headline
 *   cta_label     Text      CTA button label
 *   cta_href      Text      CTA button destination URL (relative or absolute)
 *   is_active     Boolean   Soft-disable without unpublishing
 *
 * ─── Story slug convention ───────────────────────────────────────────────────
 *
 *   Stories must be created inside a folder named "cta-variants" in Storyblok.
 *   Each story's slug must match its variant key exactly:
 *
 *     Storyblok space
 *       └── cta-variants/
 *             ├── cta_guide    ← slug = "cta_guide"
 *             ├── cta_platform ← slug = "cta_platform"
 *             └── cta_meeting  ← slug = "cta_meeting"
 *
 * ─── Field name mapping ──────────────────────────────────────────────────────
 *
 *   StoryblokCTAContent     →  CTABlockData
 *   ─────────────────────      ──────────────────────
 *   key                    →  id
 *   title                  →  title
 *   text                   →  text
 *   cta_label              →  cta.label
 *   cta_href               →  cta.href
 */

// ── Storyblok folder slug ─────────────────────────────────────────────────────

/**
 * Storyblok folder slug that contains all CTA variant stories.
 * Must match the folder created in your Storyblok space exactly.
 */
export const CTA_VARIANTS_FOLDER = "cta-variants" as const;

// ── Content type ──────────────────────────────────────────────────────────────

/**
 * Content fields of a Storyblok `cta_variant` story.
 *
 * Field names use Storyblok's snake_case convention.
 * The mapper (mapStoryblokCTA) translates these to CTABlockData.
 */
export interface StoryblokCTAContent {
  /** Variant identifier — matches the story slug and the CTAVariantKey */
  key: string;
  /** Large display headline */
  title: string;
  /** Supporting paragraph beneath the headline */
  text: string;
  /** CTA button label */
  cta_label: string;
  /** CTA button destination URL — relative ("#signup") or absolute */
  cta_href: string;
  /**
   * Soft-disable flag.
   * Published stories with is_active=false are treated as not found
   * by StoryblokProvider — the fallback plan fires instead.
   */
  is_active: boolean;
}

// ── Slug builder ──────────────────────────────────────────────────────────────

/**
 * Builds the full Storyblok story slug for a CTA variant.
 *
 * @param key  The variant key, e.g. "cta_guide"
 * @returns    The full story slug, e.g. "cta-variants/cta_guide"
 *
 * @example
 *   const slug = ctaVariantSlug("cta_guide");
 *   // → "cta-variants/cta_guide"
 */
export function ctaVariantSlug(key: string): string {
  return `${CTA_VARIANTS_FOLDER}/${key}`;
}
