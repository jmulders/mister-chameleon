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
 *   defaultVariant     object   Content met alle adaptive block velden
 *
 * ─── Relationship to other variant types ────────────────────────────────────
 *
 *   Unlike heroVariant / proofVariant / etc. which are simple flat documents,
 *   adaptiveHero is the "Content Matrix" approach: one document per block key.
 *   Token replacement ({{company_name}} etc.) happens at render time.
 *   Block selection is managed by de decision engine via aparte block keys.
 *
 * ─── Query differences from buildVariantQuery ────────────────────────────────
 *
 *   1. Uses `is_active` (snake_case) rather than `isActive`.
 *   2. `key` is a Sanity slug type → filter uses `key.current == $key`.
 *   3. Returns the full defaultVariant including layout, media, and CTA fields.
 *   4. No tenant-scoped ordering needed here — the document contains all
 *      content internally (or one per tenant via tenantId scope).
 */

// ── CTA link shape ────────────────────────────────────────────────────────────

export interface SanityAdaptiveCtaLink {
  label:    string;
  href:     string;
  variant?: "primary" | "secondary" | "ghost";
}

// ── Shared Sanity asset shape ─────────────────────────────────────────────────

interface SanityAsset {
  url?: string;
}

// ── Variant content shape ─────────────────────────────────────────────────────

/**
 * Content velden van één adaptive variant in Sanity.
 *
 * Komt overeen met de Statamic blueprint en Storyblok component voor
 * adaptive_block: dezelfde inhoudsvelden, layout, media, en CTA's.
 *
 * Media-architectuur:
 *   media_type === "image"  → gebruik het `image` veld (Sanity asset referentie)
 *   media_type === "video"  → gebruik video_source + bijbehorende velden:
 *     video_source === "upload"  → video_file asset + optioneel video_poster
 *     video_source === "youtube" → video_id (YouTube video ID)
 *     video_source === "vimeo"   → video_id (Vimeo video ID)
 *   media_type === "none" of undefined → tekst-only block
 */
export interface SanityAdaptiveVariantContent {
  /** Primaire headline */
  title:    string;
  /** Ondersteunende alinea onder de headline */
  subtitle: string;
  /** Eyebrow label boven de headline */
  tag?:     string;
  /** 0–2 CTA-knoppen */
  ctas?:    SanityAdaptiveCtaLink[];
  /** Layout-variant sleutel, bijv. "hero_split", "hero_background" */
  layout_variant?: string;
  /** Horizontale uitlijning van tekst + CTA's */
  content_align?:  "left" | "center" | "right";

  // ── Media ─────────────────────────────────────────────────────────────────

  /** Media-type discriminator */
  media_type?: "none" | "image" | "video";

  /** Afbeelding (Sanity asset referentie) — actief bij media_type === "image" */
  image?: {
    asset:    SanityAsset;
    alt:      string;
    hotspot?: { x: number; y: number };
  } | null;

  /** Video-brontype — actief bij media_type === "video" */
  video_source?: "upload" | "youtube" | "vimeo";

  /**
   * YouTube of Vimeo video-ID.
   * Actief bij video_source === "youtube" of "vimeo".
   */
  video_id?: string;

  /** Geüpload videobestand (Sanity asset referentie) — actief bij video_source === "upload" */
  video_file?: { asset: SanityAsset } | null;

  /** Poster-afbeelding voor geüploade video (Sanity asset referentie) */
  video_poster?: { asset: SanityAsset } | null;

  video_autoplay?: boolean;
  video_muted?:    boolean;
  video_loop?:     boolean;
  video_controls?: boolean;
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
      layout_variant,
      content_align,
      media_type,
      image { asset { url }, alt, hotspot },
      video_source,
      video_id,
      video_file { asset { url } },
      video_poster { asset { url } },
      video_autoplay,
      video_muted,
      video_loop,
      video_controls
    }
  }`
);
