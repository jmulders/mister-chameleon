import { cn } from "@/lib/utils";

/**
 * Grid
 *
 * A CSS-grid container with responsive column presets.
 * Columns collapse to 1 on mobile by default.
 *
 * cols: target column count at md+ breakpoint.
 *  1  → always single column
 *  2  → 1 col mobile → 2 cols md+
 *  3  → 1 col mobile → 2 cols sm → 3 cols lg
 *  4  → 1 col mobile → 2 cols sm → 4 cols lg
 *
 * gap: space between cells
 *  sm → gap-4  (16px)
 *  md → gap-6  (24px)  ← default
 *  lg → gap-8  (32px)
 *  xl → gap-12 (48px)
 */

interface GridProps {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
  cols?: 1 | 2 | 3 | 4;
  gap?: "sm" | "md" | "lg" | "xl";
}

const colsMap: Record<NonNullable<GridProps["cols"]>, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

const gapMap: Record<NonNullable<GridProps["gap"]>, string> = {
  sm: "gap-4",
  md: "gap-6",
  lg: "gap-8",
  xl: "gap-12",
};

export function Grid({ children, className, as: Tag = "div", cols = 3, gap = "md" }: GridProps) {
  return (
    <Tag className={cn("grid", colsMap[cols], gapMap[gap], className)}>{children}</Tag>
  );
}
