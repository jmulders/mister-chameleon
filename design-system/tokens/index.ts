/**
 * Design tokens — barrel export
 *
 * Import individual token files for tree-shaking, or use this
 * barrel for convenience:
 *   import { brand, semantic, space, fontSize, radii, shadows } from "@/design-system/tokens";
 */

export { brand, neutral, success, warning, error, semantic } from "./colors";
export type { BrandShade, NeutralShade } from "./colors";

export { space, sectionSpacing, containerGutter } from "./spacing";
export type { SpaceKey, SectionSpacingKey } from "./spacing";

export { fontFamily, fontSize, fontWeight, lineHeight, letterSpacing } from "./typography";
export type { FontSizeKey, FontWeightKey } from "./typography";

export { radii } from "./radii";
export type { RadiusKey } from "./radii";

export { shadows } from "./shadow";
export type { ShadowKey } from "./shadow";

export { borderWidth } from "./border";
export type { BorderWidthKey } from "./border";

export { transitionDuration, easing } from "./motion";
export type { TransitionDurationKey, EasingKey } from "./motion";
