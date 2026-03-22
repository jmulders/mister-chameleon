/**
 * CTA Variant — Statamic content type
 *
 * Defines:
 *   StatamicCTAEntry  — the entry shape of a cta_variants collection entry
 *
 * ─── Statamic collection: cta_variants ────────────────────────────────────
 *
 *   The `cta_variants` collection must be configured with these fields:
 *
 *   Field handle     Type      Notes
 *   ────────────     ──────    ──────────────────────────────────────────────
 *   key              Text      Variant identifier — e.g. "cta_guide"
 *   title            Text      Large display headline
 *   text             Textarea  Supporting paragraph beneath the headline
 *   cta_label        Text      CTA button label
 *   cta_href         Text      CTA button destination URL (relative or absolute)
 *   is_active        Toggle    Soft-disable without hiding the entry
 *
 * ─── Entry slug convention ─────────────────────────────────────────────────
 *
 *   Entry slugs in the cta_variants collection should match their variant key:
 *
 *     cta_variants collection
 *       ├── cta_guide     ← key = "cta_guide"
 *       ├── cta_platform  ← key = "cta_platform"
 *       └── cta_meeting   ← key = "cta_meeting"
 *
 * ─── Field name mapping ───────────────────────────────────────────────────
 *
 *   StatamicCTAEntry     →  CTABlockData
 *   ──────────────────      ──────────────────────
 *   key                  →  id
 *   title                →  title
 *   text                 →  text
 *   cta_label            →  cta.label
 *   cta_href             →  cta.href
 */

// ── Collection handle ──────────────────────────────────────────────────────

/**
 * Statamic collection handle for CTA variant entries.
 * Must match the collection created in your Statamic installation exactly.
 */
export const CTA_VARIANTS_COLLECTION = "cta_variants" as const;

// ── Content type ───────────────────────────────────────────────────────────

/**
 * Content fields of a Statamic cta_variants collection entry.
 *
 * Field names use Statamic's snake_case convention at the API level.
 * The mapper (mapStatamicCTA) translates these to CTABlockData.
 *
 * Note: Statamic automatically adds `id` and `slug` to every entry — they
 * are included here as part of the entry envelope.
 */
export interface StatamicCTAEntry {
  /** Statamic-generated entry UUID */
  id: string;
  /** Entry slug — typically matches the variant key */
  slug: string;
  /** Variant identifier — e.g. "cta_guide" */
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
   * Published entries with is_active=false are treated as not found
   * by StatamicProvider — the fallback plan fires instead.
   */
  is_active: boolean;
}
