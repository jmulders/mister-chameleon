import { cn } from "@/lib/utils";

/**
 * Section
 *
 * A semantic `<section>` (or any block element) with standardised
 * vertical padding. Pair with Container for a full layout unit.
 *
 * Spacing presets:
 *  sm  → py-10  ( 40px) — tight utility sections
 *  md  → py-16  ( 64px) — standard sections   ← default
 *  lg  → py-24  ( 96px) — spacious sections
 *  xl  → py-32  (128px) — hero-scale sections
 *  none → no padding    — when Section is used as a semantic wrapper only
 */

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Inline styles — primarily for CSS variable-based background and border
   * overrides that follow the design token model.  Example:
   *   style={{ background: 'var(--section-hero-bg)' }}
   */
  style?: React.CSSProperties;
  as?: React.ElementType;
  spacing?: "none" | "sm" | "md" | "lg" | "xl";
  id?: string;
}

const spacingMap: Record<NonNullable<SectionProps["spacing"]>, string> = {
  none: "",
  sm: "py-10",
  md: "py-16",
  lg: "py-24",
  xl: "py-32",
};

export function Section({
  children,
  className,
  style,
  as: Tag = "section",
  spacing = "md",
  id,
}: SectionProps) {
  return (
    <Tag id={id} style={style} className={cn(spacingMap[spacing], className)}>
      {children}
    </Tag>
  );
}
