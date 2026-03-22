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

const variantClasses: Record<LinkVariant, string> = {
  default: "text-inherit hover:text-brand-600 transition-colors duration-150",
  primary: "text-brand-600 hover:text-brand-700 transition-colors duration-150",
  muted: "text-neutral-500 hover:text-neutral-700 transition-colors duration-150",
  underline:
    "text-brand-600 underline underline-offset-2 hover:text-brand-700 transition-colors duration-150",
  nav: "text-neutral-700 hover:text-neutral-900 transition-colors duration-150",
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
