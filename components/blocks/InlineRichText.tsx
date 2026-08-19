/**
 * InlineRichText
 *
 * Renders a descriptive copy field (hero subtitle, proof text, feature body, cta
 * text) that may carry the inline rich-copy Markdown subset. Compiles with the
 * shared, dependency-free renderInlineMarkup (escape-first, allowlist-only), so
 * it is safe to run in both server and client components. Typography (size,
 * weight, colour) is inherited from the surrounding block; this only adds
 * paragraph/list spacing and inline marks.
 *
 * Renders an inline container (default <span>): the compiled HTML is inline-safe
 * (only strong/em/a/br), so it drops into any existing text element without
 * invalid nesting. Pass `source` where you previously interpolated the raw string.
 */

import type { CSSProperties, ElementType } from "react";
import { renderInlineMarkup } from "@/lib/blocks/inline-markup";
import styles from "./InlineRichText.module.css";

export function InlineRichText({
  source,
  as: As = "span",
  className,
  style,
}: {
  source:     string | null | undefined;
  as?:        ElementType;
  className?: string;
  style?:     CSSProperties;
}) {
  const html = renderInlineMarkup(source);
  if (!html) return null;
  return (
    <As
      className={[styles.rich, className].filter(Boolean).join(" ")}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
