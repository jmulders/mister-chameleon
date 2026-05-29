import { Text } from "./Text";

/**
 * Heading
 *
 * A semantic heading primitive that decouples visual size from document level.
 *
 * Use `level` to set the rendered HTML element (h1–h6) for a correct document
 * outline and accessible page structure. Use `size` to control the visual
 * scale independently — e.g. an h2 that looks like an h3, or an h3 that
 * should render at display scale.
 *
 * When `size` is omitted it defaults to the matching visual scale for the
 * semantic level (level 1 → "h1", level 2 → "h2", etc.).
 *
 * @example
 * // Page hero: h1 in the outline, display-scale type
 * <Heading level={1} size="display" balance>Welcome to Acme</Heading>
 *
 * // Section heading that is h2 in the outline but visually smaller
 * <Heading level={2} size="h3">Related articles</Heading>
 *
 * // Centred sub-section heading with muted colour
 * <Heading level={3} align="center" color="muted">FAQ</Heading>
 *
 * ─── Why not just use <Text variant="h2">? ───────────────────────────────────
 *
 *   Text's `variant` prop conflates visual scale and semantic element. Heading
 *   makes the semantic intent explicit and lets the caller vary scale without
 *   changing the DOM element. This matters for:
 *     - Page-outline / SEO (correct h1–h6 nesting)
 *     - Accessibility (screen readers announce heading levels)
 *     - Design flexibility (a sidebar h3 can render at body scale)
 */

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type HeadingSize  = "display" | "h1" | "h2" | "h3" | "h4";

// Reuse the prop types from Text via ComponentProps
type TextProps = React.ComponentProps<typeof Text>;

export interface HeadingProps extends Omit<TextProps, "variant" | "as"> {
  /**
   * Semantic HTML heading level — controls the rendered element and
   * document outline. Defaults to 2 (h2).
   */
  level?: HeadingLevel;
  /**
   * Visual scale, independent of the semantic level.
   * Defaults to the matching scale for the level (h1→"h1", h2→"h2", etc.;
   * h5 and h6 fall back to "h4" since there is no dedicated size below h4).
   */
  size?: HeadingSize;
}

/** Default visual size for each heading level */
const levelSizeMap: Record<HeadingLevel, HeadingSize> = {
  1: "h1",
  2: "h2",
  3: "h3",
  4: "h4",
  5: "h4", // no visual size below h4; falls back
  6: "h4",
};

export function Heading({ level = 2, size, ...rest }: HeadingProps) {
  const variant = size ?? levelSizeMap[level];
  return <Text as={`h${level}` as React.ElementType} variant={variant} {...rest} />;
}
