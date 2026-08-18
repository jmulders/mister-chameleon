/**
 * FeatureSpotlightCard
 *
 * One highlighted offer: media (photo or video) alongside a title, copy
 * (description), and — each independently optional — a price line and a CTA.
 * The layout stays tidy in all four combinations (with/without price ×
 * with/without CTA): missing pieces simply render nothing, no empty space.
 *
 * Shared by the single-offer render (FeatureGridBlock) and the multi-offer
 * slider (FeatureSpotlightSlider). Server-compatible; BlockMediaView is the only
 * client child. Media side: per-item `mediaSide` wins ("left" -> order -1,
 * "right" -> order 1); when absent it inherits the tenant token
 * --feature-spotlight-media-side (default 1 = media on the right). Mobile always
 * stacks media on top.
 */

import { Stack } from "@/components/primitives/Stack";
import { Text } from "@/components/primitives/Text";
import { Button } from "@/components/ui/Button";
import type { FeatureItem } from "@/page-config";
import { BlockMediaView } from "@/components/blocks/media/BlockMediaView";
import { isRenderableMedia } from "@/lib/media/block-media";

export function FeatureSpotlightCard({ item, isActive = true }: { item: FeatureItem; isActive?: boolean }) {
  const hasCta = !!(item.ctaLabel && item.ctaHref);

  // Per-item side wins; empty inherits the tenant token (fallback unchanged).
  const mediaOrder: number | string =
    item.mediaSide === "left" ? -1
    : item.mediaSide === "right" ? 1
    : "var(--feature-spotlight-media-side, 1)";

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-12">
      {isRenderableMedia(item.media) && (
        <div className="w-full lg:w-1/2" style={{ order: mediaOrder as unknown as number }}>
          <BlockMediaView media={item.media} isActive={isActive} />
        </div>
      )}

      <Stack gap={4} className="w-full lg:flex-1">
        <Text variant="h3" style={{ fontWeight: "var(--font-subheading-weight)" }}>
          {item.title}
        </Text>

        {item.description && (
          <Text variant="body" color="muted" className="leading-relaxed">
            {item.description}
          </Text>
        )}

        {item.price && (
          <Text variant="h4" color="default" style={{ fontWeight: "var(--font-subheading-weight)" }}>
            {item.price}
          </Text>
        )}

        {hasCta && (
          <div className="pt-1">
            <Button as="a" href={item.ctaHref} variant="primary" size="lg">
              {item.ctaLabel}
            </Button>
          </div>
        )}
      </Stack>
    </div>
  );
}
