/**
 * ProcessStepsBlock
 *
 * Renders a `processSteps` page section — an optional heading followed by an
 * ordered list of application/hiring process steps.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      ProcessStepsBlockData  { heading?, steps[] }
 *   variant   ProcessStepsVariant    see below
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   default   — vertical numbered list with dividers
 *   accordion — each step is a collapsible <details>/<summary> element
 *   compact   — tight inline numbered list; lower vertical footprint
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --section-subtle-bg      Section background
 *   --section-subtle-border  Section border colour
 *   --card-bg                Step card background
 *   --card-border            Step card border colour
 *   --card-radius            Step card border-radius
 *   --text                   Body text colour
 *   --text-brand             Step number accent colour
 *   --text-muted             Secondary text colour
 *   --text-subtle            Duration badge text colour
 *   --font-subheading-weight Step title font weight
 */

import { Container }          from "@/components/primitives/Container";
import { Section }            from "@/components/primitives/Section";
import { Stack }              from "@/components/primitives/Stack";
import { Text }               from "@/components/primitives/Text";
import { resolveBlockVariant } from "@/page-config/block-variants";
import type { ProcessStepsVariant } from "@/page-config/block-variants";
import type { ProcessStepsBlockData, ProcessStep } from "@/page-config";

interface ProcessStepsBlockProps {
  data:     ProcessStepsBlockData;
  variant?: string;
}

// ── Step subcomponent ─────────────────────────────────────────────────────────

function StepNumber({ n }: { n: number }) {
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
      style={{
        background: "color-mix(in srgb, var(--text-brand) 12%, transparent)",
        color:      "var(--text-brand)",
      }}
    >
      {n}
    </span>
  );
}

// ── Block component ────────────────────────────────────────────────────────────

export function ProcessStepsBlock({ data, variant: rawVariant }: ProcessStepsBlockProps) {
  const variant = resolveBlockVariant("processSteps", rawVariant) as ProcessStepsVariant;
  const { heading, steps } = data;
  const items = steps ?? [];

  // ── accordion variant ────────────────────────────────────────────────────────
  //
  // Each step is a <details>/<summary> collapsible panel.
  // Zero-JS progressive disclosure — no client components needed.

  if (variant === "accordion") {
    return (
      <Section
        spacing="lg"
        style={{
          background:          "var(--section-subtle-bg)",
          borderTopColor:    "var(--section-subtle-border)",
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

            {items.length > 0 && (
              <Stack gap={2}>
                {items.map((step, index) => (
                  <details
                    key={index}
                    className="group border"
                    style={{
                      backgroundColor: "var(--card-bg)",
                      borderColor:     "var(--card-border)",
                      borderRadius:    "var(--card-radius)",
                    }}
                  >
                    <summary
                      className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 focus-visible:outline-none focus-visible:ring-2"
                      style={{ fontWeight: "var(--font-subheading-weight)" }}
                    >
                      <StepNumber n={index + 1} />
                      <span style={{ color: "var(--text)" }}>{step.title}</span>
                      {step.duration && (
                        <span
                          className="ml-auto text-xs"
                          style={{ color: "var(--text-subtle)" }}
                        >
                          {step.duration}
                        </span>
                      )}
                      {/* Chevron */}
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
                    {step.description && (
                      <div className="px-5 pb-5 pt-1">
                        <Text variant="body" color="muted" className="leading-relaxed">
                          {step.description}
                        </Text>
                      </div>
                    )}
                  </details>
                ))}
              </Stack>
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── compact variant ──────────────────────────────────────────────────────────
  //
  // Tight inline numbered list with a lower vertical footprint.
  // Good for embedding mid-page or in sidebars.

  if (variant === "compact") {
    return (
      <Section spacing="md">
        <Container size="md">
          <Stack gap={6}>
            {heading && <Text variant="h3">{heading}</Text>}

            {items.length > 0 && (
              <ol className="space-y-3">
                {items.map((step, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <StepNumber n={index + 1} />
                    <div className="flex flex-col gap-0.5">
                      <span
                        className="text-sm"
                        style={{
                          fontWeight: "var(--font-subheading-weight)",
                          color:      "var(--text)",
                        }}
                      >
                        {step.title}
                      </span>
                      {step.description && (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {step.description}
                        </span>
                      )}
                      {step.duration && (
                        <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
                          {step.duration}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── default variant ──────────────────────────────────────────────────────────
  //
  // Vertical numbered list with dividers on a subtle-bg section.

  return (
    <Section
      spacing="lg"
      style={{
        background:          "var(--section-subtle-bg)",
        borderTopColor:    "var(--section-subtle-border)",
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

          {items.length > 0 && (
            <ol className="space-y-0">
              {items.map((step, index) => (
                <li
                  key={index}
                  className={`flex items-start gap-5 py-6 ${
                    index < items.length - 1
                      ? "border-b"
                      : ""
                  }`}
                  style={{ borderColor: "var(--section-subtle-border)" }}
                >
                  <StepNumber n={index + 1} />
                  <div className="flex flex-1 flex-col gap-1">
                    <span
                      className="text-base"
                      style={{
                        fontWeight: "var(--font-subheading-weight)",
                        color:      "var(--text)",
                      }}
                    >
                      {step.title}
                    </span>
                    {step.description && (
                      <Text variant="body" color="muted" className="leading-relaxed">
                        {step.description}
                      </Text>
                    )}
                  </div>
                  {step.duration && (
                    <span
                      className="shrink-0 text-sm"
                      style={{ color: "var(--text-subtle)" }}
                    >
                      {step.duration}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Stack>
      </Container>
    </Section>
  );
}
