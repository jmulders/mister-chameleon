import { CtaSectionBlock } from "@/components/blocks/sections/CtaSectionBlock";
import { resolveContextBlockVariant } from "@/page-config/block-variants";
import type { CtaLayoutVariant } from "@/page-config/block-variants";
import type { CtaSectionBlockData, BlockCTA } from "@/page-config";
import type { BlockMedia } from "@/lib/media/block-media";

/**
 * CTABlock
 *
 * Bottom-of-page conversion section for the ADAPTIVE cta slot. It is a thin
 * adapter: it maps the adaptive CTA data (title / text / cta) onto the shared
 * CtaSectionBlockData shape and delegates rendering to CtaSectionBlock, so the
 * adaptive slot gets the exact same variant set as the content `ctaSection`
 * block and the two rendering paths cannot diverge.
 *
 * The primary CTA carries `ctaKey`, so CtaSectionBlock/CTAGroup render it with
 * click attribution (a `cta_click` tracking event), preserving the behaviour the
 * old hand-rolled CTABlock had.
 *
 * Structural variants come from `layoutVariant`, validated against the adaptive
 * cta variant set via resolveContextBlockVariant("cta", …). See
 * page-config/block-variants.ts (CtaLayoutVariant) for the full list; note that
 * `cta_newsletter` is intentionally excluded from the adaptive set.
 */

export interface CTABlockProps {
  /** Large display headline */
  title: string;
  /** Supporting paragraph beneath the headline (inline rich copy supported) */
  text: string;
  /** Primary call-to-action button */
  cta: { label: string; href: string };
  /**
   * Variant key from the decision layer (e.g. "cta_meeting").
   * Forwarded so the rendered button attributes its clicks.
   */
  ctaKey?: string;
  /**
   * Structural layout variant for this CTA block.
   * Defaults to "cta_banner" when absent or unrecognised.
   */
  layoutVariant?: string;
  /** Up to 2 styled buttons (primary + secondary). Supersedes the single `cta`. */
  ctas?: BlockCTA[];
  /** Media for cta_media_split / cta_media_first (image or video). */
  media?: BlockMedia;
  /** Media side for cta_media_split: "left" | "right". Empty inherits the token. */
  mediaSide?: "left" | "right";
  /** Registered tenant form key for the cta_newsletter variant. */
  formKey?: string;
}

export function CTABlock({ title, text, cta, ctaKey, layoutVariant: rawLayout, ctas, media, mediaSide, formKey }: CTABlockProps) {
  const layout = resolveContextBlockVariant("cta", rawLayout) as CtaLayoutVariant;

  // Prefer the explicit buttons list; fall back to the single primary cta. The
  // plan's ctaKey attributes the PRIMARY button in either case.
  const hasCta = !!(cta?.label && cta?.href);
  const rawButtons: BlockCTA[] = ctas?.length ? ctas : (hasCta ? [{ label: cta.label, href: cta.href }] : []);
  const buttons = rawButtons.slice(0, 2).map((b, i) => (i === 0 && ctaKey ? { ...b, ctaKey } : b));

  const data: CtaSectionBlockData = {
    title,
    description: text,
    ...(buttons[0] ? { primaryCta:   buttons[0] } : {}),
    ...(buttons[1] ? { secondaryCta: buttons[1] } : {}),
    ...(media      ? { media }                    : {}),
    ...(mediaSide  ? { mediaSide }                : {}),
    ...(formKey    ? { formKey }                  : {}),
  };

  return <CtaSectionBlock data={data} variant={layout} />;
}
