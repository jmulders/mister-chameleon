import { cn } from "@/lib/utils";

/**
 * Button
 *
 * Interactive call-to-action element. Supports four visual variants
 * and three sizes. Renders as a <button> by default; use the `asChild`
 * pattern by wrapping a Link when navigation is needed.
 *
 * Variants:
 *  primary   → filled brand background        ← most prominent CTA
 *  secondary → light brand tint background    ← secondary action
 *  outline   → border only, transparent fill  ← tertiary / ghost-ish
 *  ghost     → no background or border        ← low-emphasis actions
 *
 * Sizes:
 *  sm  → compact (forms, toolbars)
 *  md  → default
 *  lg  → prominent CTAs in heroes / blocks
 */

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  loading?: boolean;
  /** Render as a different element (pass className/onClick via standard props) */
  as?: React.ElementType;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: [
    "bg-brand-500 text-white",
    "hover:bg-brand-600 active:bg-brand-700",
    "shadow-xs hover:shadow-sm",
  ].join(" "),

  secondary: [
    "bg-brand-50 text-brand-700",
    "hover:bg-brand-100 active:bg-brand-200",
  ].join(" "),

  outline: [
    "border border-neutral-300 bg-white text-neutral-700",
    "hover:bg-neutral-50 hover:border-neutral-400",
    "active:bg-neutral-100",
  ].join(" "),

  ghost: [
    "bg-transparent text-neutral-600",
    "hover:bg-neutral-100 hover:text-neutral-900",
    "active:bg-neutral-200",
  ].join(" "),
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm gap-1.5 rounded-md",
  md: "h-10 px-4 text-sm gap-2 rounded-md",
  lg: "h-12 px-6 text-base gap-2.5 rounded-lg",
};

export function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  as: Tag = "button",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Tag
      disabled={Tag === "button" ? isDisabled : undefined}
      aria-disabled={isDisabled}
      className={cn(
        // Base
        "inline-flex items-center justify-center font-medium",
        "transition-colors duration-150 cursor-pointer",
        "focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2",
        "select-none whitespace-nowrap",
        // Variant + size
        variantClasses[variant],
        sizeClasses[size],
        // States
        isDisabled && "opacity-50 cursor-not-allowed pointer-events-none",
        className,
      )}
      {...props}
    >
      {loading && (
        <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </Tag>
  );
}
