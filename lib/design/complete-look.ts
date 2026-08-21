/**
 * Complete-look design helpers
 *
 * Shared derivation used by both the design-preset gallery apply and the design
 * token-set library apply, so both paths produce the SAME complete look: the
 * grouped token overrides PLUS the site-wide block tokens (design.defaultTokens)
 * that every content block and adaptive slot renders from, typography overrides
 * enabled, and any curated Style family cleared.
 *
 * Pure functions (no server imports) so they can be unit-tested.
 */

import { blockTokensFromOverrides } from "@/design-system/theme/preset-to-block-tokens";
import type { TenantDesignSettings, TenantTokenOverrides } from "@/tenant/types";
import type { CuratedBlockTokens } from "@/design-system/theme/block-token-set";
import type { DesignTokenUploadInput } from "@/tenant/design-token-validator";

/**
 * Merge a validated token upload's grouped fields into a base overrides object.
 *
 * Pass an empty base to REPLACE (a complete look built from the upload alone),
 * or the tenant's current overrides to MERGE (a partial token upload). Grouped
 * objects shallow-merge so existing keys in a group survive a partial upload.
 * Note: `theme` / `primaryColor` / `primaryFont` are design-level fields, not
 * overrides, so they are intentionally not handled here.
 */
export function mergeUploadTokensIntoOverrides(
  base: TenantTokenOverrides,
  tokens: DesignTokenUploadInput,
): TenantTokenOverrides {
  const {
    radiusInteractive, radiusCard, radiusPopover,
    color, typography, radius, spacing, border, shadow, motion, component,
    layout, grid, responsive, elevation, focus, button,
  } = tokens;

  return {
    ...base,
    // Legacy flat radius fields
    ...(radiusInteractive !== undefined ? { radiusInteractive } : {}),
    ...(radiusCard        !== undefined ? { radiusCard }        : {}),
    ...(radiusPopover     !== undefined ? { radiusPopover }     : {}),
    // Grouped token objects: shallow-merge so existing group keys survive
    ...(color      ? { color:      { ...base.color,      ...color      } } : {}),
    ...(typography ? { typography: { ...base.typography, ...typography } } : {}),
    ...(radius     ? { radius:     { ...base.radius,     ...radius     } } : {}),
    ...(spacing    ? { spacing:    { ...base.spacing,    ...spacing    } } : {}),
    ...(border     ? { border:     { ...base.border,     ...border     } } : {}),
    ...(shadow     ? { shadow:     { ...base.shadow,     ...shadow     } } : {}),
    ...(motion     ? { motion:     { ...base.motion,     ...motion     } } : {}),
    ...(component  ? { component:  { ...base.component,  ...component  } } : {}),
    ...(layout     ? { layout:     { ...base.layout,     ...layout     } } : {}),
    ...(grid       ? { grid:       { ...base.grid,       ...grid       } } : {}),
    ...(responsive ? { responsive: { ...base.responsive, ...responsive } } : {}),
    ...(elevation  ? { elevation:  { ...base.elevation,  ...elevation  } } : {}),
    ...(focus      ? { focus:      { ...base.focus,      ...focus      } } : {}),
    ...(button     ? { button:     { ...base.button,     ...button     } } : {}),
  };
}

/**
 * Build the complete-look TenantDesignSettings for a set of token overrides.
 *
 * Derives the site-wide block tokens (design.defaultTokens) from the overrides
 * via blockTokensFromOverrides so the adaptive blocks inherit the look, sets the
 * theme + tokenOverrides, enables typography overrides, and clears any curated
 * Style family. Pass `derivedTokensOverride` to use hand-tuned block tokens
 * instead of the generic derivation (e.g. the Aurora example preset).
 */
export function buildCompleteLookDesign(
  currentDesign: TenantDesignSettings,
  overrides: TenantTokenOverrides,
  theme: TenantDesignSettings["theme"],
  derivedTokensOverride?: CuratedBlockTokens,
): TenantDesignSettings {
  const derived = derivedTokensOverride ?? blockTokensFromOverrides(overrides);

  return {
    ...currentDesign,
    theme,
    tokenOverrides: overrides,
    // Typography overrides only render when this flag is on (resolve-theme.ts).
    typographyOverrideEnabled: true,
    // Clear any curated Style family so the applied look is the single source of
    // truth, not mixed with a lingering family personality.
    selectedStyleFamily: undefined,
    // Site-wide block tokens derived from the overrides (the complete look).
    defaultTokens: Object.keys(derived).length > 0 ? derived : undefined,
  };
}
