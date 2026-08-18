"use client";

/**
 * ProofSpotlightSlider
 *
 * Renders multiple proof spotlight cases in the shared MediaSlider (prev/next +
 * dots, one visible), with pauseInactive so a video only plays on the active
 * slide. This is a client component because MediaSlider's render callbacks (which
 * carry the per-slide isActive) cannot cross the server/client boundary.
 */

import { MediaSlider } from "@/components/blocks/listing/MediaSlider";
import { ProofSpotlightCard } from "./ProofSpotlightCard";
import type { ProofItem } from "@/cms/types";

export function ProofSpotlightSlider({ items }: { items: ProofItem[] }) {
  return (
    <MediaSlider
      pauseInactive
      items={items.map((item, i) => ({
        key:    String(i),
        render: (isActive: boolean) => <ProofSpotlightCard item={item} isActive={isActive} />,
      }))}
    />
  );
}
