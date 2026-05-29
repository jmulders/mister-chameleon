/**
 * Hero Variant — Sanity GROQ query and raw response type
 *
 * Defines:
 *   HERO_BY_KEY_QUERY  — fetch a single heroVariant document by its `key` field
 *   SanityHeroRaw      — TypeScript shape of the GROQ projection result
 *
 * ─── Sanity document type: heroVariant ───────────────────────────────────────
 *
 *   tenantId   string?  Tenant that owns this variant (absent = shared)
 *   key        string   Unique variant identifier (e.g. "hero_google_problem")
 *   title      string   Primary display headline
 *   subtitle   string   Supporting paragraph beneath the headline
 *   ctaLabel   string   CTA button text
 *   ctaHref    string   CTA button destination URL
 *   tag        string?  Optional eyebrow badge above the headline
 *   isActive   boolean  Only active documents are returned by this query
 *
 * ─── Omitted fields ──────────────────────────────────────────────────────────
 *
 *   sourceTags / stageTags — informational taxonomy tags stored in Sanity for
 *   editorial use (filtering, search). They are not consumed by the decision
 *   engine (which derives source from the request context, not content fields)
 *   and are not needed by any component. Re-add to the projection if an
 *   analytics or content-audit use case requires them.
 */

import { buildVariantQuery } from "./query-builder";

// ── Raw response type ─────────────────────────────────────────────────────────

/**
 * A single CTA item as projected from a Sanity `ctas[]` array field.
 */
export interface SanityHeroCTARaw {
  _key?:    string;
  label:    string;
  href:     string;
  variant?: "primary" | "secondary" | "outline" | "ghost";
}

/**
 * Raw media object as projected from the `media` field in heroVariant.
 *
 * All sub-fields are projected flat so the mapper can read them without
 * deep dereferences.  Asset URLs are resolved at query time via `asset->url`.
 * Absent sub-fields arrive as null (GROQ behaviour); the mapper converts
 * null → undefined where needed.
 */
export interface SanityHeroMediaRaw {
  /** Discriminant: "none" | "image" | "video" */
  mediaType?: "none" | "image" | "video" | null;
  /** Resolved CDN URL of the image asset (mediaType === "image") */
  imageUrl?:       string | null;
  /** Alt text for the image (mediaType === "image") */
  imageAlt?:       string | null;
  /** Video source discriminant (mediaType === "video") */
  videoSource?:    "upload" | "youtube" | "vimeo" | null;
  /** Resolved CDN URL of the uploaded video file (videoSource === "upload") */
  videoFileUrl?:   string | null;
  /** Resolved CDN URL of the poster image (videoSource === "upload") */
  videoPosterUrl?: string | null;
  videoAutoplay?:  boolean | null;
  videoMuted?:     boolean | null;
  videoLoop?:      boolean | null;
  videoControls?:  boolean | null;
  /** YouTube or Vimeo video ID (videoSource === "youtube" | "vimeo") */
  videoId?:        string | null;
}

/**
 * A single proof bar item as projected from a Sanity `proofItems[]` array field.
 */
export interface SanityHeroProofItemRaw {
  _key?:   string;
  metric:  string;
  label:   string;
}

/**
 * Shape of the data returned by HERO_BY_KEY_QUERY.
 *
 * Field names match the Sanity schema field names exactly.
 * The mapper (mapSanityHero) translates these to HeroBlockData.
 *
 * Both the new `ctas[]` array and the legacy flat `ctaLabel`/`ctaHref`
 * fields are projected so the mapper can normalise old documents forward.
 */
export interface SanityHeroRaw {
  _id:            string;
  tenantId?:      string;
  key:            string;
  /** Layout variant for the hero block (e.g. "hero_split", "hero_background"). */
  layoutVariant?: string;
  /**
   * Horizontal alignment of hero content (headline, subtitle, CTAs).
   * Only meaningful when layoutVariant === "hero_background".
   * Null on older documents that pre-date this field; the component defaults to "center".
   */
  contentAlign?:  "left" | "center" | "right" | null;
  title:          string;
  subtitle:       string;
  /** New flexible CTA array — preferred over the legacy flat fields. */
  ctas?:          SanityHeroCTARaw[];
  /** @deprecated Use `ctas`. Present on documents not yet migrated. */
  ctaLabel?:      string;
  /** @deprecated Use `ctas`. Present on documents not yet migrated. */
  ctaHref?:       string;
  tag?:           string;
  /**
   * Customisable trust metric items for the hero_proof compact bar.
   * Only populated when layoutVariant === "hero_proof".
   * Absent on documents that use other layouts or that pre-date this field.
   * The component falls back to built-in defaults when absent/empty.
   */
  proofItems?:    SanityHeroProofItemRaw[] | null;
  /**
   * Optional media attachment.
   * Null when the field has never been set on a document (backward compat).
   * The mapper converts null → undefined → absent media on HeroBlockData.
   */
  media?:         SanityHeroMediaRaw | null;
}

// ── GROQ query ────────────────────────────────────────────────────────────────

/**
 * Fetch a single heroVariant document by its `key` field.
 *
 * Parameters:
 *   $key      string        The variant key, e.g. "hero_google_problem"
 *   $tenantId string | null Tenant scope. null = all tenants (backward-compat).
 *
 * Returns: SanityHeroRaw | null
 *
 * Projection notes:
 *   - `isActive == true` guard is part of the shared filter in buildVariantQuery
 *   - `[0]` returns the first match as an object; null if nothing matched
 *   - ctaLabel / ctaHref are flat strings — the mapper constructs CTAData
 *
 * @example
 *   const result = await client.fetch<SanityHeroRaw | null>(
 *     HERO_BY_KEY_QUERY,
 *     { key: "hero_google_problem" },
 *   );
 */
export const HERO_BY_KEY_QUERY = buildVariantQuery(
  "heroVariant",
  `
    _id,
    tenantId,
    key,
    layoutVariant,
    contentAlign,
    title,
    subtitle,
    ctas[]{ _key, label, href, variant },
    ctaLabel,
    ctaHref,
    tag,
    proofItems[]{ _key, metric, label },
    media {
      mediaType,
      // Hero images are displayed at full viewport width — 1200 px covers all
      // common breakpoints (up to 2x retina on 600 px mobile: 1200 px).
      // auto=format converts to WebP where supported (saves ~80% vs PNG).
      "imageUrl":       image.asset->url + "?w=1200&fit=max&q=80&auto=format",
      "imageAlt":       image.alt,
      videoSource,
      "videoFileUrl":   videoFile.asset->url,
      // Video poster: treated as an image — same width budget as the hero.
      "videoPosterUrl": videoPoster.asset->url + "?w=1200&fit=max&q=80&auto=format",
      videoAutoplay,
      videoMuted,
      videoLoop,
      videoControls,
      videoId
    }
  `,
);
