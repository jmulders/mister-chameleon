import { cn } from "@/lib/utils";

/**
 * Text
 *
 * A polymorphic typography primitive. Controls sizing, weight,
 * colour, and alignment via a small set of named variants.
 * Falls back to a sensible default element for each variant.
 *
 * Variant → default element mapping:
 *  display → h1
 *  h1      → h1
 *  h2      → h2
 *  h3      → h3
 *  h4      → h4
 *  body    → p
 *  body-sm → p
 *  caption → span
 *  label   → span
 *
 * Override the rendered element with the `as` prop when semantics
 * require a different tag (e.g. <Text variant="h2" as="h3">).
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *  color="default" →  --text          (page text; e.g. #fafafa on Dark Contrast)
 *  color="muted"   →  --text-muted    (secondary / descriptive)
 *  color="subtle"  →  --text-subtle   (placeholder, disabled)
 *  color="brand"   →  --text-brand    (brand-accented inline text)
 *  color="inverse" →  --text-inverse  (text on dark / coloured surface)
 *
 *  All roles use CSS-var arbitrary-value Tailwind classes so they resolve to
 *  the active tenant preset at runtime — no static palette values remain.
 */

type TextVariant =
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "body"
  | "body-sm"
  | "caption"
  | "label";

type TextColor = "default" | "muted" | "subtle" | "brand" | "inverse" | "inherit";
type TextAlign = "left" | "center" | "right";
type TextWeight = "normal" | "medium" | "semibold" | "bold";

interface TextProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Inline styles — primarily for CSS variable-based token overrides such as
   * fontFamily, fontWeight, or color when the variant/color prop combinations
   * don't cover a specific token reference.
   * Example: `style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-heading)' }}`
   */
  style?: React.CSSProperties;
  as?: React.ElementType;
  variant?: TextVariant;
  color?: TextColor;
  align?: TextAlign;
  weight?: TextWeight;
  balance?: boolean;
}

const variantClasses: Record<TextVariant, string> = {
  // Mobile-first: start conservative, scale up at sm/lg breakpoints.
  display:  "text-4xl sm:text-5xl lg:text-7xl font-bold leading-none tracking-tight",
  h1:       "text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight",
  h2:       "text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight tracking-tight",
  h3:       "text-xl sm:text-2xl lg:text-3xl font-semibold leading-snug",
  h4:       "text-lg sm:text-xl lg:text-2xl font-semibold leading-snug",
  body:     "text-base leading-relaxed",
  "body-sm":"text-sm leading-relaxed",
  caption:  "text-xs leading-normal",
  label:    "text-sm font-medium leading-none",
};

const variantElements: Record<TextVariant, React.ElementType> = {
  display: "h1",
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  body: "p",
  "body-sm": "p",
  caption: "span",
  label: "span",
};

// ── Heading profile CSS vars ───────────────────────────────────────────────────
//
// Applied to all heading variants so block style profile changes to
// --block-heading-tracking and --block-heading-transform automatically
// propagate to every heading across every block.
//
// These inline styles override Tailwind's compiled tracking-* classes, which
// is intentional — the profile var provides the authoritative heading character
// for the active theme (e.g. -0.04em ultra-tight for Dark Contrast).

const HEADING_VARIANTS = new Set<TextVariant>(["display", "h1", "h2", "h3", "h4"]);

const HEADING_PROFILE_STYLE: React.CSSProperties = {
  letterSpacing: "var(--block-heading-tracking)",
  // textTransform cast: CSS var values are valid but TypeScript's union type
  // doesn't accept arbitrary strings — cast is safe because the var always
  // resolves to a valid text-transform value ("none" | "uppercase").
  textTransform: "var(--block-heading-transform)" as React.CSSProperties["textTransform"],
};

// ── Color classes ──────────────────────────────────────────────────────────────
//
// All roles use the CSS-var arbitrary-value syntax so every color slot responds
// to the active tenant preset at runtime.  This is what makes blocks theme-aware
// end-to-end — "muted" on Dark Contrast resolves to #a3a3a3, not neutral-500.
//
//   --text         default body text (e.g. #fafafa on Dark Contrast)
//   --text-muted   secondary/descriptive text
//   --text-subtle  placeholder, disabled, timestamps
//   --text-brand   brand-accented text (links, callouts) — already correct
//   --text-inverse text on inverse/dark surface
//
const colorClasses: Record<TextColor, string> = {
  default: "text-[var(--text)]",          // was text-neutral-900 (hardcoded)
  muted:   "text-[var(--text-muted)]",    // was text-neutral-500 (hardcoded)
  subtle:  "text-[var(--text-subtle)]",   // was text-neutral-400 (hardcoded)
  brand:   "text-[var(--text-brand)]",    // ← already correct
  inverse: "text-[var(--text-inverse)]",  // was text-neutral-0  (hardcoded)
  inherit: "text-inherit",
};

const alignClasses: Record<TextAlign, string> = {
  left:   "text-left",
  center: "text-center",
  right:  "text-right",
};

const weightClasses: Record<TextWeight, string> = {
  normal:   "font-normal",
  medium:   "font-medium",
  semibold: "font-semibold",
  bold:     "font-bold",
};

export function Text({
  children,
  className,
  style,
  as,
  variant = "body",
  color = "default",
  align,
  weight,
  balance = false,
}: TextProps) {
  const Tag = as ?? variantElements[variant];

  // Merge heading profile styles (tracking, transform) with any per-call style.
  // Per-call style wins via spread order — allows individual overrides when needed.
  const resolvedStyle: React.CSSProperties | undefined = HEADING_VARIANTS.has(variant)
    ? { ...HEADING_PROFILE_STYLE, ...style }
    : style;

  return (
    <Tag
      style={resolvedStyle}
      className={cn(
        variantClasses[variant],
        colorClasses[color],
        align && alignClasses[align],
        weight && weightClasses[weight],
        balance && "text-balance",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
