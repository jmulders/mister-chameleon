/**
 * lib/brand/brand-layer.ts
 *
 * Which brand layer a page carries.
 *
 * A gallery preset sets a tenant's colours, type and spacing. A house style can
 * carry one thing more that tokens cannot express: shapes. The "Mister
 * Chameleon" preset comes with the flat circles of its leaflets. They live in
 * app/brand/mister-chameleon.css, scoped to `html[data-brand]`.
 *
 * The layer belongs to the preset, not to a tenant. The operator chooses the
 * preset in the admin (Design → Presets) and the circles come with it. Any
 * other look takes them away again.
 */

import type { TenantDesignSettings } from "@/tenant/types";

export type BrandLayer = NonNullable<TenantDesignSettings["brandLayer"]>;

const KNOWN_LAYERS: readonly BrandLayer[] = ["mister-chameleon"];

function knownLayer(value: unknown): BrandLayer | null {
  return KNOWN_LAYERS.includes(value as BrandLayer) ? (value as BrandLayer) : null;
}

/**
 * The brand layer for a page, or null for none.
 *
 * `contextualCard` is the gallery preset a rule or a session lock selected for
 * this request. Such a preset is a complete look, so it decides: its own layer
 * or none at all, whatever the tenant has stored.
 *
 * Without one, the tenant's stored design decides. The stored flag only counts
 * while the design is still a preset look (theme "custom"). An operator who
 * switches to a curated theme has chosen another look, and that switch does
 * not pass through the preset code that clears the flag.
 */
export function brandLayerFor(
  design: Pick<TenantDesignSettings, "theme" | "brandLayer"> | null | undefined,
  contextualCard?: { readonly brandLayer?: string } | null,
): BrandLayer | null {
  if (contextualCard) return knownLayer(contextualCard.brandLayer);
  if (!design || design.theme !== "custom") return null;
  return knownLayer(design.brandLayer);
}
