import { CtaSectionBlock } from "@/components/blocks/sections/CtaSectionBlock";
import { resolveContextBlockVariant } from "@/page-config/block-variants";
import type { CtaLayoutVariant } from "@/page-config/block-variants";
import type { CtaSectionBlockData } from "@/page-config";

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
}

export function CTABlock({ title, text, cta, ctaKey, layoutVariant: rawLayout }: CTABlockProps) {
  const layout = resolveContextBlockVariant("cta", rawLayout) as CtaLayoutVariant;

  const hasCta = !!(cta?.label && cta?.href);
  const data: CtaSectionBlockData = {
    title,
    description: text,
    ...(hasCta
      ? { primaryCta: { label: cta.label, href: cta.href, ...(ctaKey ? { ctaKey } : {}) } }
      : {}),
  };

  return <CtaSectionBlock data={data} variant={layout} />;
}
