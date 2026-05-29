import NextLink from "next/link";
import { cn } from "@/lib/utils";

/**
 * Link
 *
 * A styled anchor wrapping Next.js Link for internal navigation,
 * and a plain <a> for external URLs.
 *
 * Variants:
 *  default    → inherits current text color, subtle hover
 *  primary    → brand color, subtle hover
 *  muted      → muted/grey, slightly darkens on hover
 *  underline  → always underlined (useful in prose)
 *  nav        → no decoration, inherits weight/color (for navbars)
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *  primary / underline / default hover  →  --text-brand
 *
 *  Resolved from the tenant TenantTheme preset; falls back to the theme.css
 *  :root default (brand-indigo #4f46e5) when no override is active.
 */

type LinkVariant = "default" | "primary" | "muted" | "underline" | "nav";

interface LinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  children: React.ReactNode;
  className?: string;
  variant?: LinkVariant;
  /** Automatically adds rel="noopener noreferrer" and target="_blank" */
  external?: boolean;
}

// Use Tailwind's CSS-var arbitrary-value syntax for brand-coloured variants so
// they respond to the active tenant preset.  Neutral variants (muted, nav) stay
// on the static palette — they don't carry brand identity.
const variantClasses: Record<LinkVariant, string> = {
  default:   "text-inherit hover:text-[var(--text-brand)] transition-colors duration-150",
  primary:   "text-[var(--text-brand)] hover:text-[var(--text-brand)] hover:opacity-80 transition-colors duration-150",
  muted:     "text-neutral-500 hover:text-neutral-700 transition-colors duration-150",
  underline: "text-[var(--text-brand)] underline underline-offset-2 hover:opacity-80 transition-opacity duration-150",
  nav:       "text-neutral-700 hover:text-neutral-900 transition-colors duration-150",
};

export function Link({
  href,
  children,
  className,
  variant = "default",
  external = false,
  ...props
}: LinkProps) {
  const classes = cn(variantClasses[variant], "cursor-pointer", className);
  const externalProps = external
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};

  // Use native <a> for external links; Next/Link for internal
  if (external || href.startsWith("http") || href.startsWith("mailto:")) {
    return (
      <a href={href} className={classes} {...externalProps} {...props}>
        {children}
      </a>
    );
  }

  return (
    <NextLink href={href} className={classes} {...props}>
      {children}
    </NextLink>
  );
}
