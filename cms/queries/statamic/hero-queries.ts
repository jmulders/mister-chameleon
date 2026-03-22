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
 *   ──────────────────        ──────────────────────
 *   key                   →  id
 *   title                 →  title
 *   subtitle              →  subtitle
 *   cta_label             →  cta.label
 *   cta_href              →  cta.href
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
   * Published entries with is_active=false are treated as not found
   * by StatamicProvider — the fallback plan fires instead.
   */
  is_active: boolean;
}
