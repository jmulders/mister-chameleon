/**
 * ProofSpotlightCard
 *
 * One spotlight case: media (photo or video) alongside a quote/story, with split
 * attribution (name / role / organisation).
 * Shared by the single-case render (ProofBlock) and the multi-case slider
 * (ProofSpotlightSlider), so the card markup lives in one place.
 *
 * Server-compatible (no client hooks); BlockMediaView is the only client child.
 * `isActive` is forwarded to the media so off-active videos pause in the slider.
 * Media side: per-item `mediaSide` wins ("left" -> order -1, "right" -> order 1);
 * when absent it inherits the tenant token --proof-spotlight-media-side (default 1
 * = media after the text on the right). Mobile always stacks media on top.
 */

import { Stack } from "@/components/primitives/Stack";
import { Text } from "@/components/primitives/Text";
import type { ProofItem } from "@/cms/types";
import { BlockMediaView } from "@/components/blocks/media/BlockMediaView";
import { InlineRichText } from "@/components/blocks/InlineRichText";
import { isRenderableMedia } from "@/lib/media/block-media";

export function ProofSpotlightCard({ item, isActive = true }: { item: ProofItem; isActive?: boolean }) {
  // Per-item side wins; empty inherits the tenant token (fallback unchanged).
  const mediaOrder: number | string =
    item.mediaSide === "left" ? -1
    : item.mediaSide === "right" ? 1
    : "var(--proof-spotlight-media-side, 1)";

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-12">
      {isRenderableMedia(item.media) && (
        <div className="w-full lg:w-1/2" style={{ order: mediaOrder as unknown as number }}>
          <BlockMediaView media={item.media} isActive={isActive} />
        </div>
      )}

      <Stack gap={4} className="w-full lg:flex-1">
        <Text variant="h3" color="default" className="leading-relaxed" style={{ fontWeight: "normal" }}>
          <InlineRichText source={item.text} />
        </Text>

        {(item.name || item.role || item.organisation) && (
          <Stack gap={0}>
            {item.name && (
              <Text variant="body" style={{ fontWeight: "var(--font-subheading-weight)" }}>
                {item.name}
              </Text>
            )}
            {(item.role || item.organisation) && (
              <Text variant="body-sm" color="subtle">
                {[item.role, item.organisation].filter(Boolean).join(" · ")}
              </Text>
            )}
          </Stack>
        )}
      </Stack>
    </div>
  );
}
