/**
 * FaqSectionBlock
 *
 * Renders a `faqSection` page section — an optional heading followed by an
 * accordion-style list of question/answer pairs. Each item is a native
 * `<details>/<summary>` element for zero-JS progressive disclosure.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      FaqSectionBlockData  { heading?, items[] }
 *   variant   FaqSectionVariant    see below
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   default — single-column accordion on a subtle-bg section
 *   two-col — two-column accordion grid; efficient for dense FAQ sets
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --section-subtle-bg      Section background
 *   --section-subtle-border  Section border colour
 *   --card-bg                FAQ item background
 *   --card-border            FAQ item border colour
 *   --card-radius            FAQ item border-radius
 *   --text                   FAQ question default text colour
 *   --text-brand             FAQ question hover colour
 *   --text-subtle            Chevron icon colour
 *   --ring                   Focus ring colour
 *   --font-subheading-weight FAQ question font weight
 */

import { Container }                from "@/components/primitives/Container";
import { Section }                  from "@/components/primitives/Section";
import { Stack }                    from "@/components/primitives/Stack";
import { Text }                     from "@/components/primitives/Text";
import { Accordion, AccordionItem } from "@/components/molecules";
import { resolveBlockVariant }      from "@/page-config/block-variants";
import type { FaqSectionVariant }   from "@/page-config/block-variants";
import type { FaqSectionBlockData, FaqItem } from "@/page-config";
import { resolveSurface, type BlockSurface } from "@/lib/surface";

interface FaqSectionBlockProps {
  data:     FaqSectionBlockData;
  variant?: string;
  surface?: BlockSurface;
}

// ── Block component ────────────────────────────────────────────────────────────

export function FaqSectionBlock({ data, variant: rawVariant, surface }: FaqSectionBlockProps) {
  const resolved = resolveBlockVariant("faqSection", rawVariant) as FaqSectionVariant;
  const { heading, items } = data;
  const faqs = items ?? [];

  // Normalise canonical spec names → implementation keys.
  // faq_default → default (single-column accordion)
  // faq_split   → two-col (two-column accordion grid)
  const variant: FaqSectionVariant = (
    resolved === "faq_default" ? "default" :
    resolved === "faq_split"   ? "two-col" :
    resolved
  ) as FaqSectionVariant;

  // ── two-col variant ─────────────────────────────────────────────────────────
  //
  // Two-column accordion grid. Splits the FAQ list evenly across two columns.
  // Efficient for dense sets (8+ questions) where a single column would scroll far.

  if (variant === "two-col") {
    const mid   = Math.ceil(faqs.length / 2);
    const left  = faqs.slice(0, mid);
    const right = faqs.slice(mid);

    return (
      <Section
        spacing="lg"
        style={{
          background: resolveSurface(surface) ?? "var(--section-subtle-bg)",
          borderTopColor: "var(--section-subtle-border)",
          borderBottomColor: "var(--section-subtle-border)",
        }}
        className="border-y"
      >
        <Container size="lg">
          <Stack gap={10}>
            {heading && (
              <Text variant="h2" align="center">
                {heading}
              </Text>
            )}

            {faqs.length > 0 && (
              <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                <Accordion gap={2}>
                  {left.map((faq, index) => (
                    <AccordionItem key={`${faq.question}-${index}`} title={faq.question}>
                      <p className="leading-relaxed text-neutral-700">{faq.answer}</p>
                    </AccordionItem>
                  ))}
                </Accordion>
                <Accordion gap={2}>
                  {right.map((faq, index) => (
                    <AccordionItem key={`${faq.question}-${index + mid}`} title={faq.question}>
                      <p className="leading-relaxed text-neutral-700">{faq.answer}</p>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── default variant ─────────────────────────────────────────────────────────
  //
  // Single-column accordion on a subtle-bg section.

  return (
    <Section
      spacing="lg"
      style={{
        background: resolveSurface(surface) ?? "var(--section-subtle-bg)",
        borderTopColor: "var(--section-subtle-border)",
        borderBottomColor: "var(--section-subtle-border)",
      }}
      className="border-y"
    >
      <Container size="md">
        <Stack gap={10}>
          {heading && (
            <Text variant="h2" align="center">
              {heading}
            </Text>
          )}

          {faqs.length > 0 && (
            <Accordion gap={2}>
              {faqs.map((faq, index) => (
                <AccordionItem key={`${faq.question}-${index}`} title={faq.question}>
                  <p className="leading-relaxed text-neutral-700">{faq.answer}</p>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </Stack>
      </Container>
    </Section>
  );
}
