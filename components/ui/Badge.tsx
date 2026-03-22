import { cn } from "@/lib/utils";

/**
 * Badge
 *
 * A small inline label for statuses, categories, and counts.
 *
 * Variants:
 *  default  → neutral/slate
 *  primary  → brand tint
 *  success  → green
 *  warning  → amber
 *  error    → red
 *  outline  → border only, no fill
 *
 * Sizes:
 *  sm → text-xs, compact padding   ← default
 *  md → text-sm, slightly more room
 */

type BadgeVariant = "default" | "primary" | "success" | "warning" | "error" | "outline";
type BadgeSize = "sm" | "md";

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Renders a coloured dot before the label */
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-neutral-100 text-neutral-600",
  primary: "bg-brand-50 text-brand-700",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  error: "bg-error-50 text-error-700",
  outline: "border border-neutral-300 text-neutral-600 bg-transparent",
};

const dotVariantClasses: Record<BadgeVariant, string> = {
  default: "bg-neutral-400",
  primary: "bg-brand-500",
  success: "bg-success-500",
  warning: "bg-warning-500",
  error: "bg-error-500",
  outline: "bg-neutral-400",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "text-xs px-2 py-0.5 gap-1",
  md: "text-sm px-2.5 py-1 gap-1.5",
};

export function Badge({
  children,
  className,
  variant = "default",
  size = "sm",
  dot = false,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {dot && (
        <span className={cn("size-1.5 shrink-0 rounded-full", dotVariantClasses[variant])} />
      )}
      {children}
    </span>
  );
}
