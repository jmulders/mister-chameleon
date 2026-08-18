"use client";

/**
 * FeatureSpotlightSlider
 *
 * Multiple highlighted offers in the shared MediaSlider (prev/next + dots, one
 * visible), with pauseInactive so a video only plays on the active slide. Client
 * component because MediaSlider's render callbacks (carrying isActive) cannot
 * cross the server/client boundary.
 */

import { MediaSlider } from "@/components/blocks/listing/MediaSlider";
import { FeatureSpotlightCard } from "./FeatureSpotlightCard";
import type { FeatureItem } from "@/page-config";

export function FeatureSpotlightSlider({ items }: { items: FeatureItem[] }) {
  return (
    <MediaSlider
      pauseInactive
      items={items.map((item, i) => ({
        key:    String(i),
        render: (isActive: boolean) => <FeatureSpotlightCard item={item} isActive={isActive} />,
      }))}
    />
  );
}
