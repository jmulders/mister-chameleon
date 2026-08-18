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
 * client child. Media side is tenant-controlled via --feature-spotlight-media-side
 * (a CSS `order`: 1 = media after the text on the right/below, default; -1 = left).
 */

import { Stack } from "@/components/primitives/Stack";
import { Text } from "@/components/primitives/Text";
import { Button } from "@/components/ui/Button";
import type { FeatureItem } from "@/page-config";
import { BlockMediaView } from "@/components/blocks/media/BlockMediaView";
import { isRenderableMedia } from "@/lib/media/block-media";

export function FeatureSpotlightCard({ item, isActive = true }: { item: FeatureItem; isActive?: boolean }) {
  const hasCta = !!(item.ctaLabel && item.ctaHref);

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-12">
      {isRenderableMedia(item.media) && (
        <div className="w-full lg:w-1/2" style={{ order: "var(--feature-spotlight-media-side, 1)" as unknown as number }}>
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
