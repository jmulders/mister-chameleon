/**
 * RichTextBlock
 *
 * General-purpose Portable Text body drop-in.  Renders rich content authored
 * in the CMS using the platform's PortableTextRenderer — headings, paragraphs,
 * blockquotes, and inline marks (bold, italic, code).
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   default — standard content-column width
 *   narrow  — ~65ch reading-width column (long-form article / docs body)
 *   wide    — full container width
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      RichTextBlockData  { body?, maxWidth? }
 *   variant   string             "narrow" | "default" | "wide"
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --section-bg   Section background
 */

import { Container }           from "@/components/primitives/Container";
import { Section }             from "@/components/primitives/Section";
import { PortableTextRenderer } from "./PortableTextRenderer";
import type { RichTextBlockData } from "@/page-config";
import type { PortableTextBlock }  from "@/cms/types";

interface RichTextBlockProps {
  data:     RichTextBlockData;
  variant?: string;
}

export function RichTextBlock({ data, variant: rawVariant }: RichTextBlockProps) {
  const { body, maxWidth } = data;

  // Resolve variant: the block's own maxWidth field takes priority over the
  // variant prop, letting CMS authors set width per-instance rather than relying
  // on the block-level variant.
  const resolvedWidth: "narrow" | "default" | "wide" =
    maxWidth ??
    (rawVariant === "narrow" ? "narrow" : rawVariant === "wide" ? "wide" : "default");

  // Map resolved width to container size.
  const containerSize: "sm" | "md" | "lg" =
    resolvedWidth === "narrow" ? "sm" :
    resolvedWidth === "wide"   ? "lg" :
    "md";

  if (!body || body.length === 0) return null;

  return (
    <Section spacing="md">
      <Container size={containerSize}>
        <PortableTextRenderer
          blocks={body as PortableTextBlock[]}
          className="prose prose-neutral max-w-none"
        />
      </Container>
    </Section>
  );
}
