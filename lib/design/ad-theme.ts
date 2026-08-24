/**
 * Ad-account theme selection helpers.
 *
 * The ad account's base look is the tenant's design theme. It can be a curated
 * theme key OR a gallery preset (encoded as `gallery:<presetId>`) applied as a
 * COMPLETE look — byte-identical to applying the preset in the design tab
 * (buildCompleteLookDesign). Pure (no server imports) so the mapping is
 * unit-tested once and the ads server action stays a thin wrapper.
 */

import type { TenantDesignSettings } from "@/tenant/types";
import { getDesignPreset } from "@/tenant/design-presets-gallery";
import { buildCompleteLookDesign } from "@/lib/design/complete-look";
import { EXAMPLE_SITE_DESIGN_TOKENS } from "@/design-system/theme/block-token-set-examples";

/** Prefix marking a theme value as a gallery preset id (vs a curated theme key). */
export const AD_GALLERY_VALUE_PREFIX = "gallery:";

export function isAdGalleryValue(value: string): boolean {
  return value.startsWith(AD_GALLERY_VALUE_PREFIX);
}

export function adGalleryPresetId(value: string): string {
  return value.slice(AD_GALLERY_VALUE_PREFIX.length);
}

/**
 * Build the complete-look design for a gallery preset id, merged onto the
 * tenant's current design — identical to applyDesignPresetAction (the design
 * tab), including the aurora-purple-gold hand-tuned example and the inherit-host
 * style flag. Returns null for an unknown preset id.
 */
export function buildAdGalleryDesign(
  currentDesign: TenantDesignSettings,
  presetId: string,
): TenantDesignSettings | null {
  const preset = getDesignPreset(presetId);
  if (!preset) return null;
  return {
    ...buildCompleteLookDesign(
      currentDesign,
      preset.tokenOverrides,
      preset.baseTheme,
      presetId === "aurora-purple-gold" ? EXAMPLE_SITE_DESIGN_TOKENS : undefined,
    ),
    // On for "Inherit host style", cleared otherwise — same rule as the design
    // tab, so the #233 inherit-host mode behaves identically.
    inheritHostStyle: preset.inheritHostStyle ?? false,
  };
}
