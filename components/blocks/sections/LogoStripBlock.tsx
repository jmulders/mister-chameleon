/**
 * LogoStripBlock
 *
 * Renders a `logoStrip` page section — an optional heading followed by a
 * horizontal row of client / partner logos. Classic "trusted by" placement.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      LogoStripBlockData  { heading?, logos[] }
 *   variant   LogoStripVariant    see below
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   default — logos at full contrast
 *   muted   — logos at reduced opacity; the classic "trusted by" treatment
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --section-subtle-bg      Section background
 *   --section-subtle-border  Section border colour
 *   --text-subtle            Label text colour (heading)
 */

import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Stack } from "@/components/primitives/Stack";
import { Text } from "@/components/primitives/Text";
import { resolveBlockVariant } from "@/page-config/block-variants";
import type { LogoStripVariant } from "@/page-config/block-variants";
import type { LogoStripBlockData, LogoItem } from "@/page-config";

interface LogoStripBlockProps {
  data:     LogoStripBlockData;
  variant?: string;
}

// ── Shared logo cell ───────────────────────────────────────────────────────────

function LogoCell({ logo, muted }: { logo: LogoItem; muted: boolean }) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo.src}
      alt={logo.name}
      className="h-8 w-auto object-contain"
      style={{ opacity: muted ? 0.45 : 1, filter: muted ? "grayscale(1)" : undefined }}
    />
  );

  if (logo.url) {
    return (
      <a
        href={logo.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center transition-opacity hover:opacity-100"
        aria-label={logo.name}
      >
        {img}
      </a>
    );
  }

  return <div className="flex items-center">{img}</div>;
}

// ── Block component ────────────────────────────────────────────────────────────

export function LogoStripBlock({ data, variant: rawVariant }: LogoStripBlockProps) {
  const variant = resolveBlockVariant("logoStrip", rawVariant) as LogoStripVariant;
  const { heading, logos } = data;
  const items = logos ?? [];
  const muted = variant === "muted";

  return (
    <Section
      spacing="md"
      style={{
        background:        "var(--section-subtle-bg)",
        borderTopColor:    "var(--section-subtle-border)",
        borderBottomColor: "var(--section-subtle-border)",
      }}
      className="border-y"
    >
      <Container size="lg">
        <Stack gap={6} align="center">
          {heading && (
            <Text
              variant="body-sm"
              align="center"
              style={{ color: "var(--text-subtle)", textTransform: "uppercase", letterSpacing: "0.08em" }}
            >
              {heading}
            </Text>
          )}

          {items.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
              {items.map((logo) => (
                <LogoCell key={logo.name} logo={logo} muted={muted} />
              ))}
            </div>
          )}
        </Stack>
      </Container>
    </Section>
  );
}
