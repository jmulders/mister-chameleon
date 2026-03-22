import { cn } from "@/lib/utils";

/**
 * Stack
 *
 * A one-dimensional flex container — column by default, or row.
 * Equivalent to a flexbox utility component.
 *
 * Props:
 *  direction  → "col" (default) | "row"
 *  gap        → Tailwind gap-* value as a number (uses gap-{n} class) or "px"
 *  align      → cross-axis alignment
 *  justify    → main-axis alignment
 *  wrap       → flex-wrap | flex-nowrap
 */

type AlignValue = "start" | "center" | "end" | "stretch" | "baseline";
type JustifyValue = "start" | "center" | "end" | "between" | "around" | "evenly";

interface StackProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Inline styles — primarily for CSS variable-based token overrides such as
   * backgroundColor, borderColor, borderRadius, and boxShadow on card surfaces.
   * Example: `style={{ backgroundColor: 'var(--card-bg)', borderRadius: 'var(--card-radius)' }}`
   */
  style?: React.CSSProperties;
  as?: React.ElementType;
  direction?: "col" | "row";
  gap?: number | "px";
  align?: AlignValue;
  justify?: JustifyValue;
  wrap?: boolean;
}

const alignMap: Record<AlignValue, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
};

const justifyMap: Record<JustifyValue, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
  evenly: "justify-evenly",
};

export function Stack({
  children,
  className,
  style,
  as: Tag = "div",
  direction = "col",
  gap = 4,
  align,
  justify,
  wrap = false,
}: StackProps) {
  return (
    <Tag
      style={style}
      className={cn(
        "flex",
        direction === "col" ? "flex-col" : "flex-row",
        gap === "px" ? "gap-px" : `gap-${gap}`,
        align && alignMap[align],
        justify && justifyMap[justify],
        wrap && "flex-wrap",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
