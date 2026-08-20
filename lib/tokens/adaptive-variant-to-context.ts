/**
 * adaptiveVariantToContextEntry
 *
 * Converts a single AdaptiveVariantContent (as edited in the block drawer) into
 * the one-slot ContextSlotData entry that the real page renderer consumes. This
 * lets an admin preview render a block through the IDENTICAL production path
 * (TemplateRenderer → HeroBlock/ProofBlock/CTABlock/FeatureGridBlock) rather
 * than the simplified snippet HTML, so layout variants, media, and carousels
 * appear exactly as visitors would see them.
 *
 * Hero reuses the production adapter (adaptiveVariantToHeroBlockData). Proof and
 * feature reuse the SHARED per-item mappers (adaptiveItemToProofItem /
 * adaptiveItemToFeatureItem) that the Statamic provider uses, so spotlight media,
 * attribution, price/CTA and mediaSide render identically here and on the live
 * site. CTA maps its own fields. The block's own tokenRef (tokenSet / inline
 * tokens) is carried through so the per-block design override applies in the
 * preview too.
 *
 * Conversion and notification are overlays with a different data contract and
 * are not previewed here — callers get `null` and should show a placeholder.
 */

import type { AdaptiveVariantContent } from "@/cms/types";
import type { ContextSlotData } from "@/page-config";
import type { BlockTokenRef } from "@/design-system/theme/block-token-set";
import { adaptiveVariantToHeroBlockData } from "./resolve-adaptive-variant";
import { adaptiveItemToProofItem, adaptiveItemToFeatureItem, adaptiveCtasToButtons } from "@/lib/blocks/adaptive-item-to-block";
import { heroBannerMediaToBlockMedia } from "@/lib/media/hero-banner-to-block-media";

/** Build a BlockTokenRef from a variant's token fields, or undefined when none. */
function tokenRefFromVariant(content: AdaptiveVariantContent): BlockTokenRef | undefined {
  const hasTokens = !!content.tokens && Object.keys(content.tokens).length > 0;
  if (!content.tokenSet && !hasTokens) return undefined;
  return {
    ...(content.tokenSet ? { tokenSet: content.tokenSet } : {}),
    ...(hasTokens ? { tokens: content.tokens } : {}),
  };
}

/**
 * Map an AdaptiveVariantContent to a one-key ContextSlotData for `slotId`.
 * Returns null for slot types without a full-fidelity preview path.
 */
export function adaptiveVariantToContextEntry(
  slotId: string,
  content: AdaptiveVariantContent,
  blockKey: string,
): Partial<ContextSlotData> | null {
  const tokenRef = tokenRefFromVariant(content);
  const withRef = tokenRef ? { tokenRef } : {};

  switch (slotId) {
    case "hero":
      return { hero: { ...adaptiveVariantToHeroBlockData(content, blockKey), ...withRef } };

    case "proof":
      return {
        proof: {
          id:    blockKey,
          title: content.title ?? "",
          items: (content.items ?? []).map(adaptiveItemToProofItem),
          ...(content.layoutVariant ? { layoutVariant: content.layoutVariant } : {}),
          ...withRef,
        },
      };

    case "cta": {
      const buttons = adaptiveCtasToButtons(content.ctas);
      const media   = heroBannerMediaToBlockMedia(content.media);
      return {
        cta: {
          id:    blockKey,
          title: content.title ?? "",
          text:  content.subtitle ?? "",
          cta:   { label: content.ctas?.[0]?.label ?? "", href: content.ctas?.[0]?.href ?? "#" },
          ...(buttons.length ? { ctas: buttons } : {}),
          ...(media          ? { media }         : {}),
          ...(content.mediaSide ? { mediaSide: content.mediaSide } : {}),
          ...(content.formKey ? { formKey: content.formKey } : {}),
          ...(content.layoutVariant ? { layoutVariant: content.layoutVariant } : {}),
          ...withRef,
        },
      };
    }

    case "feature":
      return {
        feature: {
          id:    blockKey,
          title: content.title ?? "",
          items: (content.items ?? []).map(adaptiveItemToFeatureItem),
          ...(content.layoutVariant ? { layoutVariant: content.layoutVariant } : {}),
          ...withRef,
        },
      };

    default:
      // conversion / notification — overlay contract, no live preview here.
      return null;
  }
}
