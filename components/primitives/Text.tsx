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
  display: "text-5xl sm:text-6xl lg:text-7xl font-bold leading-none tracking-tight",
  h1: "text-4xl sm:text-5xl font-bold leading-tight tracking-tight",
  h2: "text-3xl sm:text-4xl font-bold leading-tight tracking-tight",
  h3: "text-2xl sm:text-3xl font-semibold leading-snug",
  h4: "text-xl sm:text-2xl font-semibold leading-snug",
  body: "text-base leading-relaxed",
  "body-sm": "text-sm leading-relaxed",
  caption: "text-xs leading-normal",
  label: "text-sm font-medium leading-none",
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

const colorClasses: Record<TextColor, string> = {
  default: "text-neutral-900",
  muted: "text-neutral-500",
  subtle: "text-neutral-400",
  brand: "text-brand-600",
  inverse: "text-neutral-0",
  inherit: "text-inherit",
};

const alignClasses: Record<TextAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const weightClasses: Record<TextWeight, string> = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
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

  return (
    <Tag
      style={style}
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
