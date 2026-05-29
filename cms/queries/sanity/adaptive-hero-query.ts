/**
 * Adaptive Hero — Sanity GROQ query and raw response type
 *
 * Defines:
 *   ADAPTIVE_HERO_BY_KEY_QUERY  — fetch a single adaptiveHero document by its `key` slug
 *   SanityAdaptiveHeroRaw       — TypeScript shape of the GROQ projection result
 *
 * ─── Sanity document type: adaptiveHero ──────────────────────────────────────
 *
 *   key                slug     Unique routing key (e.g. "hero_matrix_homepage")
 *   tenantId           string?  Optional tenant scope
 *   is_active          boolean  When false: block renders nothing
 *   defaultVariant     object   SEO-safe fallback (never contains tokens)
 *   adaptiveVariants   array    Personalized variants keyed by rule-engine key
 *
 * ─── Relationship to other variant types ────────────────────────────────────
 *
 *   Unlike heroVariant / proofVariant / etc. which are simple flat documents,
 *   adaptiveHero is the "Content Matrix" approach: one document holds ALL
 *   variants so editors don't create hundreds of separate CMS documents.
 *   The variant selection and token replacement happen at render time in
 *   ChameleonHero (server component), not in the GROQ query.
 *
 * ─── Query differences from buildVariantQuery ────────────────────────────────
 *
 *   1. Uses `is_active` (snake_case) rather than `isActive`.
 *   2. `key` is a Sanity slug type → filter uses `key.current == $key`.
 *   3. Returns the full defaultVariant + adaptiveVariants tree.
 *   4. No tenant-scoped ordering needed here — the document contains all
 *      tenant variants internally (or one per tenant via tenantId scope).
 */

// ── CTA link shape ────────────────────────────────────────────────────────────

export interface SanityAdaptiveCtaLink {
  label:    string;
  href:     string;
  variant?: "primary" | "secondary" | "ghost";
}

// ── Variant content shape (shared for default and adaptive variants) ───────────

export interface SanityAdaptiveVariantContent {
  title:    string;
  subtitle: string;
  tag?:     string;
  ctas?:    SanityAdaptiveCtaLink[];
  image?:   {
    asset:   { url?: string };
    alt:     string;
    hotspot?: { x: number; y: number };
  } | null;
}

// ── Raw response type ─────────────────────────────────────────────────────────

/**
 * Shape of the data returned by ADAPTIVE_HERO_BY_KEY_QUERY.
 * Field names match the Sanity schema exactly.
 * The mapper (mapSanityAdaptiveHero) translates this to AdaptiveBlockData.
 */
export interface SanityAdaptiveHeroRaw {
  _id:            string;
  tenantId?:      string;
  /** key is a Sanity slug object — use `.current` for the string value. */
  key:            { current: string };
  is_active:      boolean;
  defaultVariant: SanityAdaptiveVariantContent;
  adaptiveVariants: Array<{
    variantKey:  string;
    label?:      string;
    content:     SanityAdaptiveVariantContent;
  }>;
}

// ── GROQ query ────────────────────────────────────────────────────────────────

/**
 * Fetch a single adaptiveHero document by its routing key.
 *
 * Parameters:
 *   $key       string        The block key, e.g. "hero_matrix_homepage"
 *   $tenantId  string | null Optional tenant scope
 *
 * Returns: SanityAdaptiveHeroRaw | null
 *
 * @example
 *   const result = await client.fetch<SanityAdaptiveHeroRaw | null>(
 *     ADAPTIVE_HERO_BY_KEY_QUERY,
 *     { key: "hero_matrix_homepage", tenantId: "workengine" },
 *   );
 */
export const ADAPTIVE_HERO_BY_KEY_QUERY = (
  `*[_type == "adaptiveHero"` +
  // Slug-type key: match via key.current
  ` && key.current == $key` +
  ` && is_active == true` +
  ` && ($tenantId == null || tenantId == $tenantId || !defined(tenantId))]` +
  // Prefer tenant-specific document over shared when both exist.
  ` | order(select($tenantId != null && tenantId == $tenantId => 1, 0) desc)` +
  `[0]` +
  ` {
    _id,
    tenantId,
    "key": key,
    is_active,
    defaultVariant {
      title,
      subtitle,
      tag,
      ctas[] { label, href, variant },
      image { asset { url }, alt, hotspot }
    },
    adaptiveVariants[] {
      variantKey,
      label,
      content {
        title,
        subtitle,
        tag,
        ctas[] { label, href, variant },
        image { asset { url }, alt, hotspot }
      }
    }
  }`
);
