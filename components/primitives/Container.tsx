import { cn } from "@/lib/utils";

/**
 * Container
 *
 * Constrains content to a readable max-width and adds symmetric
 * horizontal padding. Use as the top-level wrapper inside any Section.
 *
 * Sizes:
 *  sm   → max-w-2xl   (640px)  — forms, focused content
 *  md   → max-w-4xl   (896px)  — blog, prose
 *  lg   → max-w-6xl  (1152px)  — standard page layout  ← default
 *  xl   → max-w-7xl  (1280px)  — wide dashboards
 *  full → no max-width
 */

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

const sizeMap: Record<NonNullable<ContainerProps["size"]>, string> = {
  sm: "max-w-2xl",
  md: "max-w-4xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
  full: "max-w-none",
};

export function Container({
  children,
  className,
  as: Tag = "div",
  size = "lg",
}: ContainerProps) {
  return (
    <Tag className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", sizeMap[size], className)}>
      {children}
    </Tag>
  );
}
