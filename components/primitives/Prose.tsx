import { cn } from "@/lib/utils";

/**
 * Prose
 *
 * A typography container for rich / long-form text content.
 * Applies Tailwind Typography plugin classes to style headings, paragraphs,
 * lists, blockquotes, and inline marks (bold, italic, code) consistently.
 *
 * ─── Usage ────────────────────────────────────────────────────────────────────
 *
 *   // React children (component-composed rich text):
 *   <Prose>
 *     <h2>Why it matters</h2>
 *     <p>Lorem ipsum…</p>
 *   </Prose>
 *
 *   // CMS-rendered HTML string (always sanitise before passing!):
 *   <Prose html={sanitize(article.bodyHtml)} size="lg" />
 *
 * ─── Sizing ───────────────────────────────────────────────────────────────────
 *
 *   sm   → prose-sm   (13–14px base, compact tables and code)
 *   base → prose      (16px base — standard article body)  ← default
 *   lg   → prose-lg   (18px base — comfortable long reads)
 *
 * ─── max-width ────────────────────────────────────────────────────────────────
 *
 *   Prose overrides Tailwind Typography's default max-width (max-w-none) so the
 *   caller controls line length via a parent Container. Wrap in
 *   <Container size="md"> for optimal reading line length.
 *
 * ─── Design tokens ────────────────────────────────────────────────────────────
 *
 *   The prose colour palette (headings, body, links, code background) can be
 *   overridden at the tenant theme level via the `prose-*` colour modifiers or
 *   by targeting the CSS custom properties Tailwind Typography exposes.
 *   No design-token inline styles are applied here — prose colour follows the
 *   tenant's base colour scale via the Tailwind Typography `prose-neutral`
 *   modifier.
 */

type ProseSize = "sm" | "base" | "lg";

export interface ProseProps {
  /** React children — component-composed rich text */
  children?: React.ReactNode;
  /**
   * Raw HTML string to render.  MUST be sanitised before passing.
   * When provided, `children` is ignored.
   */
  html?: string;
  /** Visual prose size. Defaults to "base". */
  size?: ProseSize;
  /** Additional CSS class names applied to the wrapper element. */
  className?: string;
  /** Rendered element. Defaults to "div". */
  as?: React.ElementType;
}

const sizeClasses: Record<ProseSize, string> = {
  sm:   "prose-sm",
  base: "",           // "prose" base is the default; no extra modifier needed
  lg:   "prose-lg",
};

export function Prose({
  children,
  html,
  size = "base",
  className,
  as: Tag = "div",
}: ProseProps) {
  const classes = cn(
    "prose prose-neutral max-w-none",
    sizeClasses[size],
    className,
  );

  if (html !== undefined) {
    return (
      // eslint-disable-next-line react/no-danger
      <Tag className={classes} dangerouslySetInnerHTML={{ __html: html }} />
    );
  }

  return <Tag className={classes}>{children}</Tag>;
}
