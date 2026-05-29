/**
 * lib/sanity-image.ts
 *
 * Sanity CDN image URL optimizer.
 *
 * Sanity's CDN (`cdn.sanity.io`) supports URL-based image transformation
 * parameters.  Appending `?w=<width>&auto=format&fit=max` to any image URL:
 *
 *   - `auto=format`  — Returns WebP in browsers that support it (Chrome, Firefox,
 *                      Safari 14+), falling back to the original format elsewhere.
 *                      Typical savings: 25–35 % vs JPEG, 50–80 % vs PNG.
 *   - `w=<width>`    — Resizes to the requested width; height scales proportionally.
 *                      Prevents serving a 2400 × 1800 hero image to a 400 px column.
 *   - `fit=max`      — Only downscales; never upscales a small source image.
 *   - `q=<quality>`  — JPEG/WebP quality (default 75).  80 is a good balance for
 *                      hero images; 70 for thumbnails.
 *
 * ─── Why this matters ─────────────────────────────────────────────────────────
 *
 *   Raw Sanity CDN URLs served without transformation parameters deliver the
 *   original upload at full resolution.  A typical site logo upload is 150–400 kB;
 *   a hero image 1–5 MB.  With format conversion + width constraints:
 *
 *     Logo (128 px wide):   ~150 kB PNG  →  ~4–8 kB WebP   (-95 %)
 *     Hero (1200 px wide):  ~2 MB JPEG   →  ~120 kB WebP   (-94 %)
 *     Thumbnail (400 px):   ~500 kB PNG  →  ~20 kB WebP    (-96 %)
 *
 *   This is the single highest-impact bandwidth reduction available — most Sanity
 *   bandwidth consumption comes from unoptimized asset delivery.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { sanityImageUrl } from "@/lib/sanity-image";
 *
 *   // Logo: 128 px wide, auto format, quality 85
 *   <img src={sanityImageUrl(logoUrl, { w: 128, q: 85 })} alt={logoAlt} />
 *
 *   // Hero: 1200 px wide, auto format, quality 80
 *   <img src={sanityImageUrl(heroUrl, { w: 1200 })} />
 *
 *   // Thumbnail: 400 × 300, cropped to fit
 *   <img src={sanityImageUrl(thumbUrl, { w: 400, h: 300, fit: "crop" })} />
 *
 * ─── GROQ usage ───────────────────────────────────────────────────────────────
 *
 *   Sanity CDN parameters can also be appended inside GROQ queries using
 *   string concatenation:
 *
 *     "logoUrl": asset->url + "?w=128&auto=format&fit=max"
 *
 *   This bakes the optimization into the API response so no runtime processing
 *   is needed.  Use this approach for image fields fetched in GROQ projections.
 *
 * ─── Non-Sanity URLs ──────────────────────────────────────────────────────────
 *
 *   `sanityImageUrl` is a no-op for non-Sanity URLs (does not start with
 *   "https://cdn.sanity.io").  Pass any URL safely — external images are
 *   returned unchanged.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SanityImageParams {
  /** Width in pixels.  Height scales proportionally unless `h` is also set. */
  w?: number;
  /** Height in pixels.  Width scales proportionally unless `w` is also set. */
  h?: number;
  /**
   * How the image is fitted to the bounding box when both w and h are set.
   *   "max"  — preserves aspect ratio, no cropping (default)
   *   "crop" — centre-crops to exact dimensions
   *   "fill" — letterboxes with bg colour
   *   "clip" — clips without padding
   */
  fit?: "max" | "crop" | "fill" | "clip";
  /**
   * Output quality (1–100).
   * Default: 80.  Use 85–90 for hero images, 70–75 for thumbnails.
   */
  q?: number;
  /**
   * Whether to auto-select the best output format (WebP where supported).
   * Default: true.  Set false to force the original format.
   */
  autoFormat?: boolean;
}

// ── Preset dimensions ─────────────────────────────────────────────────────────

/**
 * Opinionated width presets for common use cases.
 *
 * These are the `w` values recommended for each slot.  Pass them to
 * `sanityImageUrl()` or reference them in GROQ string concat.
 */
export const SANITY_IMAGE_WIDTHS = {
  /** Site logo in the header — never needs to be wider than 160 px */
  logo: 160,
  /** Hero section background / feature image — 1200 px covers most breakpoints */
  hero: 1200,
  /** Card thumbnail / listing image */
  thumbnail: 480,
  /** Team member avatar / testimonial photo */
  avatar: 96,
  /** Open Graph / social share image */
  og: 1200,
  /** Mega menu media item */
  megaMenuMedia: 320,
} as const;

// ── Core helper ───────────────────────────────────────────────────────────────

/**
 * Append Sanity CDN image transformation parameters to a URL.
 *
 * Returns the original URL unchanged when:
 *   - `url` is null / undefined / empty
 *   - `url` does not start with `https://cdn.sanity.io`
 *   - No params are specified (returns original URL — safe no-op)
 *
 * Does not append duplicate parameters — if the URL already contains a query
 * string the new params are appended with `&`.
 *
 * @param url    Raw Sanity CDN URL (from `asset->url` in GROQ or mapper output)
 * @param params Transformation parameters to apply
 * @returns      Optimized URL string, or the original if not a Sanity CDN URL
 */
export function sanityImageUrl(
  url:    string | null | undefined,
  params: SanityImageParams = {},
): string {
  if (!url) return "";
  if (!url.startsWith("https://cdn.sanity.io")) return url;

  const {
    w,
    h,
    fit          = "max",
    q            = 80,
    autoFormat   = true,
  } = params;

  const parts: string[] = [];

  if (w !== undefined) parts.push(`w=${w}`);
  if (h !== undefined) parts.push(`h=${h}`);
  if (w !== undefined || h !== undefined) parts.push(`fit=${fit}`);
  if (q !== 100) parts.push(`q=${q}`);
  if (autoFormat) parts.push("auto=format");

  if (parts.length === 0) return url;

  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${parts.join("&")}`;
}

// ── Preset shortcuts ──────────────────────────────────────────────────────────

/** Optimized logo URL — 160 px wide, quality 85, auto format. */
export function sanityLogoUrl(url: string | null | undefined): string {
  return sanityImageUrl(url, { w: SANITY_IMAGE_WIDTHS.logo, q: 85 });
}

/** Optimized hero image URL — 1200 px wide, quality 80, auto format. */
export function sanityHeroUrl(url: string | null | undefined): string {
  return sanityImageUrl(url, { w: SANITY_IMAGE_WIDTHS.hero, q: 80 });
}

/** Optimized thumbnail URL — 480 px wide, quality 75, auto format. */
export function sanityThumbnailUrl(url: string | null | undefined): string {
  return sanityImageUrl(url, { w: SANITY_IMAGE_WIDTHS.thumbnail, q: 75 });
}

/** Optimized avatar URL — 96 × 96 px, cropped to square, quality 80. */
export function sanityAvatarUrl(url: string | null | undefined): string {
  return sanityImageUrl(url, {
    w:   SANITY_IMAGE_WIDTHS.avatar,
    h:   SANITY_IMAGE_WIDTHS.avatar,
    fit: "crop",
    q:   80,
  });
}

// ── GROQ fragment helpers ─────────────────────────────────────────────────────

/**
 * GROQ string-concat suffix for common image presets.
 *
 * Use these inside GROQ projections to bake image optimization into the
 * Sanity API response — no runtime URL manipulation needed.
 *
 * @example
 *   // In a GROQ projection:
 *   "logoUrl": logo.asset->url + GROQ_IMAGE_SUFFIX.logo,
 *   "heroUrl": hero.asset->url + GROQ_IMAGE_SUFFIX.hero,
 */
export const GROQ_IMAGE_SUFFIX = {
  /** 160 × auto, WebP, quality 85 */
  logo:          `?w=160&fit=max&q=85&auto=format`,
  /** 1200 × auto, WebP, quality 80 */
  hero:          `?w=1200&fit=max&q=80&auto=format`,
  /** 480 × auto, WebP, quality 75 */
  thumbnail:     `?w=480&fit=max&q=75&auto=format`,
  /** 96 × 96, centre-crop, WebP, quality 80 */
  avatar:        `?w=96&h=96&fit=crop&q=80&auto=format`,
  /** 320 × auto, WebP, quality 75 — mega menu media items */
  megaMenuMedia: `?w=320&fit=max&q=75&auto=format`,
} as const;
