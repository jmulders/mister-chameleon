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

import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Stack } from "@/components/primitives/Stack";
import { Text } from "@/components/primitives/Text";
import { resolveBlockVariant } from "@/page-config/block-variants";
import type { FaqSectionVariant } from "@/page-config/block-variants";
import type { FaqSectionBlockData, FaqItem } from "@/page-config";

interface FaqSectionBlockProps {
  data:     FaqSectionBlockData;
  variant?: string;
}

// ── Shared accordion item ──────────────────────────────────────────────────────

function FaqItem({ faq, index }: { faq: FaqItem; index: number }) {
  return (
    <details
      key={`${faq.question}-${index}`}
      className="group border"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--card-border)",
        borderRadius: "var(--card-radius)",
      }}
    >
      {/*
       * summary hover/focus: text-brand and ring come from CSS vars
       * so they adapt to enterprise-clean (indigo accent) and
       * bold-brand (vivid indigo) without any code change here.
       */}
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 focus-visible:outline-none focus-visible:ring-2"
        style={{
          fontWeight: "var(--font-subheading-weight)",
          color: "var(--text)",
        }}
      >
        <span className="group-hover:text-[var(--text-brand)] transition-colors">
          {faq.question}
        </span>
        {/* Chevron — rotates on open via group-open */}
        <svg
          className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
          style={{ color: "var(--text-subtle)" }}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </summary>

      <div className="px-5 pb-5">
        <Text variant="body" color="muted" className="leading-relaxed">
          {faq.answer}
        </Text>
      </div>
    </details>
  );
}

// ── Block component ────────────────────────────────────────────────────────────

export function FaqSectionBlock({ data, variant: rawVariant }: FaqSectionBlockProps) {
  const variant = resolveBlockVariant("faqSection", rawVariant) as FaqSectionVariant;
  const { heading, items } = data;
  const faqs = items ?? [];

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
          background: "var(--section-subtle-bg)",
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
                <Stack gap={2}>
                  {left.map((faq, index) => (
                    <FaqItem key={`${faq.question}-${index}`} faq={faq} index={index} />
                  ))}
                </Stack>
                <Stack gap={2}>
                  {right.map((faq, index) => (
                    <FaqItem key={`${faq.question}-${index + mid}`} faq={faq} index={index + mid} />
                  ))}
                </Stack>
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
        background: "var(--section-subtle-bg)",
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
            <Stack gap={2}>
              {faqs.map((faq, index) => (
                <FaqItem key={`${faq.question}-${index}`} faq={faq} index={index} />
              ))}
            </Stack>
          )}
        </Stack>
      </Container>
    </Section>
  );
}
