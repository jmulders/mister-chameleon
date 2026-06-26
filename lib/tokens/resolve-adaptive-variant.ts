/**
 * resolve-adaptive-variant
 *
 * Core resolution utility for the Content Matrix / Adaptive Blocks system.
 *
 * Converts an AdaptiveBlockData (all variants) into a single, ready-to-render
 * AdaptiveVariantContent by:
 *
 *   1. Selecting the best matching variant for the current visitor
 *   2. Applying token replacement to title, subtitle, and tag
 *
 * ─── Variant selection order ──────────────────────────────────────────────────
 *
 *   1. isBot === true  → always return defaultVariant (no token replacement)
 *   2. variantKey provided → look for matching adaptiveVariant entry
 *   3. No match found  → fall back to defaultVariant
 *
 * ─── Token replacement ────────────────────────────────────────────────────────
 *
 *   Token replacement is applied only to adaptiveVariants, never to the
 *   defaultVariant.  This guarantees that:
 *     • Search engine bots always receive canonical, clean copy.
 *     • The defaultVariant SSR output is stable across visitors.
 *     • Tokens in adaptiveVariants resolve to Dutch fallbacks when the
 *       visitor context is partially available (e.g. no company name).
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   // No-engine path (CMS pages, always default):
 *   const content = resolveAdaptiveVariant(block);
 *
 *   // Engine path (homepage, visitor-aware):
 *   const content = resolveAdaptiveVariant(block, {
 *     variantKey:   experience.heroVariantKey,
 *     tokenContext: buildTokenContext(experience),
 *     isBot:        false,
 *   });
 *
 * ─── Mapping to HeroBlockData ─────────────────────────────────────────────────
 *
 *   Use `adaptiveVariantToHeroBlockData()` to convert the resolved content into
 *   a HeroBlockData so it can be passed directly to <HeroBlock>.  The mapping
 *   passes through `layoutVariant`, `contentAlign`, `media`, `ctas`, `tag`,
 *   `title`, and `subtitle`.  The deprecated `imageUrl` / `imageAlt` fields are
 *   supported as a legacy fallback for CMS documents predating task #99.
 *
 * ─── isDefault flag ───────────────────────────────────────────────────────────
 *
 *   The returned object carries an `isDefault` flag that callers can use for:
 *     • Analytics attribution ("did this visitor see a personalised variant?")
 *     • data-variant attributes on the rendered element
 *     • Conditional rendering of personalisation badges in preview mode
 */

import { parseTokens, type TokenContext } from "./parse-tokens";
import type { AdaptiveBlockData, AdaptiveVariantContent, HeroCTAItem, HeroBlockData } from "@/cms/types";

// ── Resolution options ─────────────────────────────────────────────────────────

export interface ResolveAdaptiveVariantOptions {
  /**
   * The variant key selected by the decision engine for this visitor.
   * When absent or null, the defaultVariant is used.
   */
  variantKey?: string | null;
  /**
   * Visitor token context built by buildTokenContext() from the experience plan.
   * When absent, tokens in adaptive variants resolve to their Dutch fallback values.
   */
  tokenContext?: TokenContext;
  /**
   * Set to true when the request comes from a crawler / bot (e.g. Googlebot).
   * Forces the defaultVariant without any token replacement — SEO-safe output.
   */
  isBot?: boolean;
}

// ── Resolution result ──────────────────────────────────────────────────────────

export interface ResolvedAdaptiveVariant {
  /** The resolved, ready-to-render variant content */
  content: AdaptiveVariantContent;
  /**
   * True when the content was taken from `block.defaultVariant` rather than
   * from one of the adaptive variants.
   *
   * Use this for analytics attribution and data-variant attributes.
   */
  isDefault: boolean;
  /**
   * The variant key that was matched, or null when no variant matched and the
   * default was used.  Matches `options.variantKey` when a match was found.
   */
  matchedVariantKey: string | null;
}

// ── Main resolution function ───────────────────────────────────────────────────

/**
 * Resolves a single AdaptiveVariantContent from an AdaptiveBlockData.
 *
 * @param block    The full AdaptiveBlockData fetched from CMS / Supabase.
 * @param options  Optional visitor context for variant selection and tokens.
 * @returns        Resolved content with `isDefault` and `matchedVariantKey` flags.
 */
export function resolveAdaptiveVariant(
  block: AdaptiveBlockData,
  options: ResolveAdaptiveVariantOptions = {},
): ResolvedAdaptiveVariant {
  const { variantKey, tokenContext, isBot = false } = options;

  // ── 1. Bot / no variant key → always defaultVariant, no token replacement ────
  if (isBot || !variantKey || !block.adaptiveVariants?.length) {
    return {
      content:           block.defaultVariant,
      isDefault:         true,
      matchedVariantKey: null,
    };
  }

  // ── 2. Look for a matching adaptive variant ───────────────────────────────────
  const match = block.adaptiveVariants.find((v) => v.variantKey === variantKey);

  if (!match) {
    // Variant key provided but not found — fall back to default without tokens.
    return {
      content:           block.defaultVariant,
      isDefault:         true,
      matchedVariantKey: null,
    };
  }

  // ── 3. Apply tokens to the matched variant ────────────────────────────────────
  const raw     = match.content;
  const content = applyTokensToVariant(raw, tokenContext);

  return {
    content,
    isDefault:         false,
    matchedVariantKey: variantKey,
  };
}

// ── Token application ─────────────────────────────────────────────────────────

/**
 * Applies parseTokens() to the text fields of a variant content object.
 * The defaultVariant is never passed here — only adaptive variants.
 *
 * CTA labels and hrefs are intentionally excluded from token replacement:
 *   - CTA hrefs are URLs, not copy — tokens in URLs create routing bugs
 *   - CTA labels are typically short action words ("Vraag demo aan") that
 *     don't need personalisation
 */
function applyTokensToVariant(
  content: AdaptiveVariantContent,
  ctx: TokenContext | undefined,
): AdaptiveVariantContent {
  if (!ctx) return content;

  return {
    ...content,
    title:    parseTokens(content.title,    ctx),
    subtitle: parseTokens(content.subtitle, ctx),
    tag:      content.tag ? parseTokens(content.tag, ctx) : content.tag,
  };
}

// ── Mapping: AdaptiveVariantContent → HeroBlockData ───────────────────────────

/**
 * Maps a resolved AdaptiveVariantContent to HeroBlockData so it can be passed
 * directly to <HeroBlock> or used in the existing hero slot pipeline.
 *
 * Mapping notes:
 *   - `id` is set to `blockKey` for analytics attribution.
 *   - `layoutVariant` and `contentAlign` pass through from the adaptive variant;
 *     HeroBlock falls back to "hero_default" when absent.
 *   - `media` prefers the new HeroBannerMedia union field; falls back to the
 *     deprecated `imageUrl` / `imageAlt` pair for old CMS documents that
 *     predate the media enrichment (task #99).
 *   - `ctas` passes through unchanged; both types share the HeroCTAItem shape.
 */
export function adaptiveVariantToHeroBlockData(
  content:  AdaptiveVariantContent,
  blockKey: string,
): HeroBlockData {
  // Prefer new media union; fall back to deprecated imageUrl for legacy documents.
  const media: HeroBlockData["media"] =
    content.media ??
    (content.imageUrl
      ? { kind: "image", url: content.imageUrl, alt: content.imageAlt ?? "" }
      : undefined);

  return {
    id:            blockKey,
    title:         content.title,
    subtitle:      content.subtitle,
    tag:           content.tag,
    ctas:          (content.ctas ?? []) as readonly HeroCTAItem[],
    layoutVariant: content.layoutVariant,
    contentAlign:  content.contentAlign,
    media,
    // Carousel slides — only meaningful for layoutVariant === "hero_carousel";
    // HeroBlock ignores them for every other layout.
    ...(content.slides?.length ? { slides: content.slides } : {}),
    // Carousel autoplay toggle (boolean — pass through even when false).
    ...(content.carouselAutoplay !== undefined ? { carouselAutoplay: content.carouselAutoplay } : {}),
  };
}
