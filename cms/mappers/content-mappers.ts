/**
 * Content Mappers
 *
 * Pure functions that translate CMS data types (*BlockData) into the prop
 * shapes expected by React block components (*BlockProps).
 *
 * Current state (MVP):
 *  Block component prop names now align with CMS field names, so these
 *  mappers are thin pass-throughs that strip the `id` field and assert
 *  the correct type. They remain in place because:
 *
 *  1. They form an explicit boundary — any future schema divergence
 *     between CMS and components is handled here, not scattered in pages.
 *  2. They are the correct place to add field coercions, default injection,
 *     or rich-text serialisation as the project grows.
 *  3. The homepage currently spreads experience data directly onto block
 *     components (which is valid since the shapes match). These mappers
 *     are available for use in other contexts (e.g. preview routes,
 *     storybook fixtures) where explicit mapping is preferred.
 *
 * All mappers are pure functions — no side effects, fully testable,
 * and safe to call in any rendering environment.
 */

import type { HeroBlockData, ProofBlockData, CTABlockData } from "../types";
import type { HeroBlockProps } from "@/components/blocks/HeroBlock";
import type { ProofBlockProps } from "@/components/blocks/ProofBlock";
import type { CTABlockProps } from "@/components/blocks/CTABlock";

// ── Hero mapper ───────────────────────────────────────────────────────────────

/**
 * Map a HeroBlockData (CMS shape) to HeroBlockProps (component shape).
 *
 * CMS field names match component prop names in the MVP, so this is a
 * structural subset — `id` is dropped, all other fields pass through.
 *
 * CMS field    →  HeroBlockProps prop
 * ──────────       ──────────────────────────
 * tag          →  tag          (eyebrow badge above headline)
 * title        →  title        (primary display headline)
 * subtitle     →  subtitle     (supporting paragraph)
 * ctas         →  ctas         (0–2 CTA buttons)
 * proofItems   →  proofItems   (optional trust metrics for hero_proof bar)
 * contentAlign →  contentAlign (alignment for hero_background)
 * media        →  media        (optional image/video attachment)
 *
 * Backward compat:
 *   When `data.ctas` is empty and the legacy `data.cta` field is present,
 *   this mapper normalises it to a single-entry `ctas` array so the
 *   component never needs to handle the legacy shape.
 */
export function mapHeroBlockData(data: HeroBlockData): HeroBlockProps {
  // Normalise: prefer ctas; fall back to legacy cta field.
  const ctas: HeroBlockProps["ctas"] =
    data.ctas && data.ctas.length > 0
      ? data.ctas.map((c): HeroBlockProps["ctas"][number] => ({
          label: c.label,
          href:  c.href,
          // The CMS allows a "link" style the hero component doesn't render; map it
          // to the closest supported variant ("ghost").
          ...(c.variant ? { variant: c.variant === "link" ? "ghost" : c.variant } : {}),
        }))
      : data.cta
        ? [{ label: data.cta.label, href: data.cta.href }]
        : [];

  return {
    tag:          data.tag,
    title:        data.title,
    subtitle:     data.subtitle,
    ctas,
    layoutVariant: data.layoutVariant,
    // Pass contentAlign through; absent on non-background layouts.
    ...(data.contentAlign !== undefined ? { contentAlign: data.contentAlign } : {}),
    // Pass proofItems through; absent on non-proof layouts.
    ...(data.proofItems   !== undefined ? { proofItems:   data.proofItems   } : {}),
    // Pass media through unchanged — the component handles all rendering.
    ...(data.media        !== undefined ? { media:        data.media        } : {}),
    // Pass carousel slides through — required for layoutVariant "hero_carousel".
    ...(data.slides       !== undefined ? { slides:       data.slides       } : {}),
    // Pass the carousel autoplay toggle through (boolean — keep even when false).
    ...(data.carouselAutoplay !== undefined ? { carouselAutoplay: data.carouselAutoplay } : {}),
  };
}

// ── Proof mapper ──────────────────────────────────────────────────────────────

/**
 * Map a ProofBlockData (CMS shape) to ProofBlockProps (component shape).
 *
 * CMS field names match component prop names in the MVP, so this is a
 * structural subset — `id` is dropped, all other fields pass through.
 *
 * CMS field  →  ProofBlockProps prop
 * ──────────    ──────────────────────────
 * title      →  title  (section heading)
 * items      →  items  (array of { title, text } proof points)
 */
export function mapProofBlockData(data: ProofBlockData): ProofBlockProps {
  return {
    title: data.title,
    items: data.items.map((item) => ({
      title: item.title,
      text: item.text,
    })),
  };
}

// ── CTA mapper ────────────────────────────────────────────────────────────────

/**
 * Map a CTABlockData (CMS shape) to CTABlockProps (component shape).
 *
 * CMS field names match component prop names in the MVP, so this is a
 * structural subset — `id` is dropped, all other fields pass through.
 *
 * CMS field  →  CTABlockProps prop
 * ──────────    ──────────────────────────
 * title      →  title  (large display headline)
 * text       →  text   (supporting paragraph)
 * cta        →  cta    (primary CTA button)
 */
export function mapCTABlockData(data: CTABlockData): CTABlockProps {
  return {
    title: data.title,
    text: data.text,
    cta: {
      label: data.cta.label,
      href: data.cta.href,
    },
  };
}
