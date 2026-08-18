/**
 * ProofSpotlightCard
 *
 * One spotlight case: media (photo or video) alongside a quote/story, with a
 * relationship eyebrow (kind) and split attribution (name / role / organisation).
 * Shared by the single-case render (ProofBlock) and the multi-case slider
 * (ProofSpotlightSlider), so the card markup lives in one place.
 *
 * Server-compatible (no client hooks); BlockMediaView is the only client child.
 * `isActive` is forwarded to the media so off-active videos pause in the slider.
 * Media side is tenant-controlled via --proof-spotlight-media-side (a CSS `order`:
 * 1 = media after the text on the right/below, default; -1 = before, on the left).
 */

import { Stack } from "@/components/primitives/Stack";
import { Text } from "@/components/primitives/Text";
import type { ProofItem } from "@/cms/types";
import { BlockMediaView } from "@/components/blocks/media/BlockMediaView";
import { isRenderableMedia } from "@/lib/media/block-media";

export function ProofSpotlightCard({ item, isActive = true }: { item: ProofItem; isActive?: boolean }) {
  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-12">
      {isRenderableMedia(item.media) && (
        <div className="w-full lg:w-1/2" style={{ order: "var(--proof-spotlight-media-side, 1)" as unknown as number }}>
          <BlockMediaView media={item.media} isActive={isActive} />
        </div>
      )}

      <Stack gap={4} className="w-full lg:flex-1">
        {item.kind && (
          <Text variant="caption" color="subtle" className="tracking-wider uppercase">
            {item.kind}
          </Text>
        )}

        <span
          className="text-4xl leading-none select-none"
          style={{ color: "var(--proof-quote-color, var(--primary))" }}
          aria-hidden="true"
        >
          &ldquo;
        </span>

        <Text variant="h3" color="default" className="italic leading-relaxed" style={{ fontWeight: "normal" }}>
          {item.text}
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
