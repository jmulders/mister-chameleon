import { cn } from "@/lib/utils";

/**
 * Badge
 *
 * A small inline label for statuses, categories, and counts.
 *
 * Variants:
 *  default  → neutral/slate
 *  primary  → brand tint  ← responds to tenant preset
 *  success  → green
 *  warning  → amber
 *  error    → red
 *  outline  → border only, no fill
 *
 * Sizes:
 *  sm → text-xs, compact padding   ← default
 *  md → text-sm, slightly more room
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *  primary variant  →  --badge-primary-bg (bg), --badge-primary-text (text), --primary (dot)
 *
 *  These vars are resolved from the tenant TenantTheme preset, so the primary
 *  badge automatically reflects the active Visual Token Editor selection.
 *  Semantic variants (success, warning, error) use the fixed palette — they
 *  communicate intent and should not change with the brand preset.
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

// ── Variant classes ────────────────────────────────────────────────────────────
//
// "primary" uses CSS-var arbitrary values so it adapts to the tenant preset.
// Semantic variants stay on the static palette (they represent status, not brand).
const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-neutral-100 text-neutral-600",
  // Dedicated badge tokens so badge surface can diverge from link/button accent
  // without a component change.  Emitted as concrete hex — never falls through
  // to the :root purple chain.
  primary: "bg-[var(--badge-primary-bg)] text-[var(--badge-primary-text)]",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  error:   "bg-error-50 text-error-700",
  outline: "border border-neutral-300 text-neutral-600 bg-transparent",
};

const dotVariantClasses: Record<BadgeVariant, string> = {
  default: "bg-neutral-400",
  primary: "bg-[var(--primary)]",          // ← responds to tenant preset
  success: "bg-success-500",
  warning: "bg-warning-500",
  error:   "bg-error-500",
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
