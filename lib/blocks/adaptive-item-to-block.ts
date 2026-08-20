/**
 * Shared per-item mappers: AdaptiveVariantItem -> ProofItem / FeatureItem.
 *
 * These are the single source of truth for turning an authored adaptive-variant
 * item into the block-component item shape, used by BOTH render paths:
 *
 *   - production: adaptiveToProof / adaptiveToFeature (Statamic provider)
 *   - admin preview: adaptiveVariantToContextEntry (block drawer + preview modal)
 *
 * Keeping one mapper means the live site and the preview render identical
 * spotlight content (media, attribution, price/CTA, mediaSide) and cannot drift
 * apart again, which is exactly what happened before: the preview mapper dropped
 * every spotlight field.
 *
 * Leaf module (types + one leaf helper) so both callers can import it without a
 * cycle.
 */

import type { AdaptiveVariantItem, ProofItem, FeatureItem, HeroCTAItem } from "@/cms/types";
import type { BlockCTA } from "@/page-config/types";
import { heroBannerMediaToBlockMedia } from "@/lib/media/hero-banner-to-block-media";

/**
 * Adaptive CTA items -> BlockCTA[] for the CTA slot (max 2 styled buttons).
 * Carries the per-button style and variant; attaches the plan's ctaKey to the
 * primary button for click attribution. Shared by adaptiveToCTA (live provider)
 * and adaptiveVariantToContextEntry (preview) so both stay identical.
 */
export function adaptiveCtasToButtons(
  ctas: readonly HeroCTAItem[] | undefined,
  primaryCtaKey?: string,
): BlockCTA[] {
  return (ctas ?? [])
    .filter((c) => c.label && c.href)
    .slice(0, 2)
    .map((c, i) => ({
      label: c.label,
      href:  c.href,
      ...(c.style   ? { style:   c.style }   : {}),
      ...(c.variant ? { variant: c.variant } : {}),
      ...(i === 0 && primaryCtaKey ? { ctaKey: primaryCtaKey } : {}),
    }));
}

/** AdaptiveVariantItem -> ProofItem (proof_spotlight carries media + attribution). */
export function adaptiveItemToProofItem(item: AdaptiveVariantItem): ProofItem {
  const media = heroBannerMediaToBlockMedia(item.media);
  return {
    title: item.title ?? "",
    text:  item.text ?? item.body ?? "",
    // Spotlight fields — carried through so proof_spotlight can render them.
    ...(media             ? { media }                          : {}),
    ...(item.name         ? { name:         item.name }         : {}),
    ...(item.role         ? { role:         item.role }         : {}),
    ...(item.organisation ? { organisation: item.organisation } : {}),
    ...(item.mediaSide    ? { mediaSide:    item.mediaSide }    : {}),
  };
}

/** AdaptiveVariantItem -> FeatureItem (feature_spotlight carries media + offer). */
export function adaptiveItemToFeatureItem(item: AdaptiveVariantItem): FeatureItem {
  const media = heroBannerMediaToBlockMedia(item.media);
  // Reuse the base CTA field (cta) when the spotlight-specific ctaLabel is
  // absent, so one CTA input serves both.
  const ctaLabel = item.ctaLabel ?? item.cta;
  return {
    title: item.title ?? "",
    body:  item.body ?? item.text ?? "",
    icon:  undefined,
    // Spotlight fields — carried through so feature_spotlight can render them.
    ...(media          ? { media }                : {}),
    ...(item.price     ? { price: item.price }    : {}),
    ...(ctaLabel       ? { ctaLabel }             : {}),
    ...(item.ctaHref   ? { ctaHref: item.ctaHref } : {}),
    ...(item.mediaSide ? { mediaSide: item.mediaSide } : {}),
  };
}
