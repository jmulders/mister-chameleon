import Link   from "next/link";
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
 *  link      → plain text with hover underline ← inline link treatment
 *
 * Sizes:
 *  sm  → compact (forms, toolbars)
 *  md  → default
 *  lg  → prominent CTAs in heroes / blocks
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *  primary   --btn-bg, --btn-text, --btn-hover-bg, --btn-active-bg
 *  secondary --btn-secondary-bg, --btn-secondary-text, --btn-secondary-hover-bg
 *  outline   --btn-outline-bg, --btn-outline-text, --btn-outline-border (+ hover)
 *  ghost     --btn-ghost-text, --btn-ghost-hover-bg, --btn-ghost-hover-text
 *  focus     --ring
 *
 *  Resolved from tenant TenantTheme preset; falls back to theme.css :root
 *  defaults (brand-indigo palette) when no override is in effect.
 */

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "link";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  loading?: boolean;
  /** Render as a different element (pass className/onClick via standard props) */
  as?: React.ElementType;
  /**
   * Forwarded to the rendered element when `as="a"` (or any anchor-like element).
   * Not used when rendering as the default `<button>`.
   */
  href?: string;
}

// ── Variant classes ────────────────────────────────────────────────────────────
//
// All variants use Tailwind's CSS-variable arbitrary-value syntax
// (`bg-[var(--token)]`) so the button palette responds to the tenant's saved
// Visual Token Editor preset without any component-level knowledge of which
// theme is active. outline / ghost consume the --btn-outline-* / --btn-ghost-*
// token groups (emitted concretely per preset) with neutral hex fallbacks for
// contexts rendered outside a [data-site] theme.

const variantClasses: Record<ButtonVariant, string> = {
  primary: [
    // Background and text colours driven by --btn-* token group (from TenantTheme).
    // Falls back to --primary / --primary-text if the button tokens are absent.
    "bg-[var(--btn-bg,var(--primary))]",
    "text-[var(--btn-text,var(--primary-text,#fff))]",
    "hover:bg-[var(--btn-hover-bg,var(--primary-hover))]",
    "active:bg-[var(--btn-active-bg,var(--primary-active))]",
    "shadow-xs hover:shadow-sm",
  ].join(" "),

  secondary: [
    // Dedicated --btn-secondary-* tokens so secondary button surface can diverge
    // from badge/link accent colour when a preset needs it.  Emitted as concrete
    // hex by tenantThemeToCSS() — never falls through to the :root purple chain.
    // Fallbacks ensure the button renders visibly even when a tenant hasn't set
    // these tokens yet (light slate background, brand colour text).
    "bg-[var(--btn-secondary-bg,var(--muted,#f1f5f9))]",
    "text-[var(--btn-secondary-text,var(--primary,#4338ca))]",
    "hover:bg-[var(--btn-secondary-hover-bg,var(--muted-hover,#e2e8f0))] hover:opacity-90",
    "active:opacity-80",
  ].join(" "),

  outline: [
    // Context-adaptive via --btn-outline-* — text and border default to
    // currentColor (the surrounding section's text colour) so the button reads
    // correctly on a light page and a dark hero/cta alike, and follows the preset
    // (which sets --text) on the page body. A tenant may pin fixed colours.
    "border bg-[var(--btn-outline-bg,transparent)] text-[var(--btn-outline-text,currentColor)]",
    "border-[var(--btn-outline-border,currentColor)]",
    "hover:bg-[var(--btn-outline-hover-bg,color-mix(in_srgb,currentColor_10%,transparent))]",
    "hover:border-[var(--btn-outline-hover-border,currentColor)]",
    "active:opacity-90",
  ].join(" "),

  ghost: [
    // Context-adaptive via --btn-ghost-* — text defaults to currentColor; the
    // hover wash is a translucent tint of the current text colour, visible on
    // any surface.
    "bg-transparent text-[var(--btn-ghost-text,currentColor)]",
    "hover:bg-[var(--btn-ghost-hover-bg,color-mix(in_srgb,currentColor_10%,transparent))]",
    "hover:text-[var(--btn-ghost-hover-text,currentColor)]",
    "active:opacity-90",
  ].join(" "),

  link: [
    // Pure text-link treatment — no background, no border, no padding.
    // sizeClasses are intentionally skipped for this variant (see className below).
    "bg-transparent",
    "text-[var(--btn-link-text,var(--primary))]",
    "underline-offset-4 hover:underline",
  ].join(" "),
};

// ── Size classes ───────────────────────────────────────────────────────────────
//
// rounded-[var(--btn-radius,...)] lets the active family config (or tenant
// override) drive button corner rounding without a component change.
//   editorial-classic  → 0px   (sharp corners)
//   corporate-clean    → 0.375rem
//   bold-marketing     → 9999px (fully pill-shaped)
//   premium-luxury     → 0.125rem (barely rounded)
// Falls back to 0.375rem (≈ rounded-md) when no family var is in scope.

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm gap-1.5 rounded-[var(--btn-radius,0.375rem)]",
  md: "h-10 px-4 text-sm gap-2 rounded-[var(--btn-radius,0.375rem)]",
  lg: "h-12 px-6 text-base gap-2.5 rounded-[var(--btn-radius,0.375rem)]",
};

export function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  as: Tag = "button",
  href,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  // When used as a link (`as="a"`) with an internal path (starts with "/"),
  // render a Next.js <Link> for client-side navigation so the in-memory
  // window.__journey event store is NOT reset on every click.
  // External URLs (http/https) and anchors (#) are left as plain <a> elements.
  const ResolvedTag: React.ElementType =
    Tag === "a" && typeof href === "string" && href.startsWith("/")
      ? Link
      : Tag;

  return (
    <ResolvedTag
      href={href}
      disabled={ResolvedTag === "button" ? isDisabled : undefined}
      aria-disabled={isDisabled}
      className={cn(
        // Base layout
        "inline-flex items-center justify-center",
        // ── font-weight / text-transform via Tailwind arbitrary class utilities ──
        //
        // Using CSS classes instead of inline `style` props avoids the React
        // hydration mismatch that arises when CSS custom-property strings like
        // "var(--btn-font-weight, 600)" are serialised differently by the server
        // renderer and the client reconciler (browsers normalise whitespace in
        // inline style values during HTML parsing, causing React to see a
        // different string during hydration).
        //
        // The class names are stable compile-time strings — identical on server
        // and client — so hydration never mismatches.  The CSS custom properties
        // are resolved by the browser's CSS engine, not by React.
        //
        // Fallback (600) matches the --btn-font-weight default in theme.css.
        "[font-weight:var(--btn-font-weight,600)]",
        // Font family: the global base rule only targets <button>, so a Button
        // rendered as an <a> (every CTA / hero / tracked button) would fall back
        // to the document default instead of the tenant/preset UI font. Pin it to
        // --font-ui here so all buttons follow the preset regardless of `as`.
        "[font-family:var(--font-ui)]",
        "[text-transform:var(--btn-text-transform,none)]",
        // Letter-spacing from the button token group (default: normal — no change).
        "[letter-spacing:var(--btn-tracking,normal)]",
        "transition-[color,background-color,box-shadow,transform] duration-150 cursor-pointer",
        // Hover lift from the motion token group (default: 0px — no movement).
        "hover:[transform:translateY(var(--motion-hover-lift,0px))]",
        // Focus ring — width + colour from the focus token group; fall back to the
        // previous behaviour (2px, --ring) when those tokens are not set.
        "focus-visible:outline-[length:var(--focus-ring-width,2px)] focus-visible:outline-[color:var(--focus-ring-color,var(--ring))] focus-visible:outline-offset-2",
        "select-none whitespace-nowrap",
        // Variant + size
        // "link" variant is a plain text link — no fixed height, padding, or radius.
        variantClasses[variant],
        variant !== "link" && sizeClasses[size],
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
    </ResolvedTag>
  );
}
