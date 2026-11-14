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
 * The tenant's stored design decides: it is the look the operator applied in
 * the admin. The stored flag only counts while that design is still a preset
 * look (theme "custom"). An operator who switches to a curated theme has
 * chosen another look, and that switch does not pass through the preset code
 * that clears the flag.
 *
 * `contextualCard` is the gallery preset a rule or a session lock selected for
 * this request. It can add its own layer, but it never takes the tenant's
 * away. A site that changes colour by time of day or audience keeps its house
 * shapes through every one of those colours. The first version let the
 * contextual preset decide alone, and on 14 Nov 2026 the live site lost its
 * circles for as long as a rule had picked a colour preset.
 */
export function brandLayerFor(
  design: Pick<TenantDesignSettings, "theme" | "brandLayer"> | null | undefined,
  contextualCard?: { readonly brandLayer?: string } | null,
): BrandLayer | null {
  const fromRule = knownLayer(contextualCard?.brandLayer);
  if (fromRule) return fromRule;
  if (!design || design.theme !== "custom") return null;
  return knownLayer(design.brandLayer);
}
