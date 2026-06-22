import { cn } from "@/lib/utils";

/**
 * Section
 *
 * A semantic `<section>` (or any block element) with standardised
 * vertical padding. Pair with Container for a full layout unit.
 *
 * Spacing presets (mobile-first — scales up at sm/lg breakpoints):
 *  sm  → py-6  sm:py-8  lg:py-10  ( 24→32→40px) — tight utility sections
 *  md  → py-8  sm:py-12 lg:py-16  ( 32→48→64px) — standard sections   ← default
 *  lg  → py-10 sm:py-16 lg:py-24  ( 40→64→96px) — spacious sections
 *  xl  → py-12 sm:py-20 lg:py-32  ( 48→80→128px) — hero-scale sections
 *  none → no padding               — when Section is used as a semantic wrapper only
 */

export interface SectionProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Inline styles — primarily for CSS variable-based background and border
   * overrides that follow the design token model.  Example:
   *   style={{ background: 'var(--section-hero-bg)' }}
   */
  style?: React.CSSProperties;
  as?: React.ElementType;
  spacing?: "none" | "sm" | "md" | "lg" | "xl";
  id?: string;
}

// Token-driven vertical rhythm.
//
// `padding-block` is sourced from the tenant's `--section-py` design token (set
// by spacing.sectionPadding in the design-preset Builder). When the token is
// unset, each spacing level falls back to a clamp() that closely reproduces the
// previous discrete breakpoints (mobile → tablet → desktop), so the default look
// is unchanged. A CSS var cannot conditionally override a Tailwind utility class
// (inline/specificity always wins, collapsing to 0 when the var is unset), so
// the wrapper owns its padding directly with a faithful fallback instead.
//
//   sm  24→32→40px   md  32→48→64px   lg  40→64→96px   xl  48→80→128px
const SECTION_PY_FALLBACK: Record<NonNullable<SectionProps["spacing"]>, string | undefined> = {
  none: undefined,
  sm:   "clamp(24px, 3.4vw, 40px)",
  md:   "clamp(32px, 5vw, 64px)",
  lg:   "clamp(40px, 7vw, 96px)",
  xl:   "clamp(48px, 10vw, 128px)",
};

export function Section({
  children,
  className,
  style,
  as: Tag = "section",
  spacing = "md",
  id,
}: SectionProps) {
  const fallback = SECTION_PY_FALLBACK[spacing];
  const paddingStyle: React.CSSProperties =
    fallback ? { paddingBlock: `var(--section-py, ${fallback})` } : {};

  return (
    <Tag id={id} style={{ ...paddingStyle, ...style }} className={cn(className)}>
      {children}
    </Tag>
  );
}
