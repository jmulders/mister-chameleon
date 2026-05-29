import { cn } from "@/lib/utils";

/**
 * Card
 *
 * A surface container with a border, optional shadow, and padding.
 * Composed of three sub-components for structured layouts:
 *
 *   <Card>
 *     <CardHeader> … </CardHeader>
 *     <CardContent> … </CardContent>
 *     <CardFooter> … </CardFooter>
 *   </Card>
 *
 * Or use <Card> alone with children for simpler cases.
 */

interface CardProps {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
  padding?: "none" | "sm" | "md" | "lg";
  shadow?: "none" | "sm" | "md";
  hover?: boolean;
}

const paddingMap: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

const shadowMap: Record<NonNullable<CardProps["shadow"]>, string> = {
  none: "",
  sm: "shadow-sm",
  md: "shadow-md",
};

export function Card({
  children,
  className,
  as: Tag = "div",
  padding = "md",
  shadow = "sm",
  hover = false,
}: CardProps) {
  return (
    <Tag
      className={cn(
        // rounded-[var(--card-radius,...)] lets the active family config drive
        // card corner rounding:  editorial-classic/portfolio → 0px (sharp),
        // corporate-clean → 0.5rem, bold-marketing → 1rem.
        // Falls back to 0.75rem (≈ rounded-xl) when no family var is in scope.
        "rounded-[var(--card-radius,0.75rem)] border border-[var(--border,#e5e7eb)] bg-[var(--card-bg,#ffffff)]",
        paddingMap[padding],
        shadowMap[shadow],
        hover && "transition-shadow duration-200 hover:shadow-md cursor-pointer",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

interface CardSectionProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardSectionProps) {
  return (
    <div className={cn("flex flex-col gap-1.5 pb-4", className)}>
      {children}
    </div>
  );
}

export function CardContent({ children, className }: CardSectionProps) {
  return <div className={cn("", className)}>{children}</div>;
}

export function CardFooter({ children, className }: CardSectionProps) {
  return (
    <div className={cn("flex items-center pt-4", className)}>
      {children}
    </div>
  );
}
