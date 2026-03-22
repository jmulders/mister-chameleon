/**
 * StatsBlock
 *
 * Renders a `stats` page section — an optional heading followed by a row of
 * key metrics. Each stat shows a value (optionally prefixed / suffixed) and
 * a supporting label.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      StatsBlockData  { heading?, items[] }
 *   variant   StatsVariant    see below
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   default — row of large metric cards on a subtle-bg section; full spacing
 *   compact — tight inline row; lower vertical footprint for mid-page embeds
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --section-subtle-bg      Section background
 *   --section-subtle-border  Section border colour
 *   --text-brand             Metric value colour
 *   --font-heading           Metric value font family
 *   --font-heading-weight    Metric value font weight
 */

import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Stack } from "@/components/primitives/Stack";
import { Text } from "@/components/primitives/Text";
import { resolveBlockVariant } from "@/page-config/block-variants";
import type { StatsVariant } from "@/page-config/block-variants";
import type { StatsBlockData, StatItem } from "@/page-config";

interface StatsBlockProps {
  data:     StatsBlockData;
  variant?: string;
}

// ── Shared stat cell ───────────────────────────────────────────────────────────

function StatCell({ item, compact }: { item: StatItem; compact: boolean }) {
  const value = `${item.prefix ?? ""}${item.value}${item.suffix ?? ""}`;

  if (compact) {
    return (
      <div className="flex flex-col items-center gap-1 px-6">
        <span
          className="text-3xl font-bold leading-none"
          style={{
            color:      "var(--text-brand)",
            fontFamily: "var(--font-heading)",
            fontWeight: "var(--font-heading-weight)",
          }}
        >
          {value}
        </span>
        <Text variant="body-sm" color="muted" align="center">
          {item.label}
        </Text>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center gap-2 rounded-lg border p-8"
      style={{
        backgroundColor: "var(--card-bg, white)",
        borderColor:     "var(--card-border)",
        borderRadius:    "var(--card-radius)",
      }}
    >
      <span
        className="text-5xl font-bold leading-none tracking-tight"
        style={{
          color:      "var(--text-brand)",
          fontFamily: "var(--font-heading)",
          fontWeight: "var(--font-heading-weight)",
        }}
      >
        {value}
      </span>
      <Text variant="body-sm" color="muted" align="center">
        {item.label}
      </Text>
    </div>
  );
}

// ── Block component ────────────────────────────────────────────────────────────

export function StatsBlock({ data, variant: rawVariant }: StatsBlockProps) {
  const variant = resolveBlockVariant("stats", rawVariant) as StatsVariant;
  const { heading, items } = data;
  const stats = items ?? [];

  // ── compact variant ─────────────────────────────────────────────────────────
  //
  // Tight inline row with separator lines; no card backgrounds.
  // Lower vertical footprint — good for mid-page context.

  if (variant === "compact") {
    return (
      <Section spacing="md">
        <Container size="lg">
          <Stack gap={6}>
            {heading && (
              <Text variant="h3" align="center">
                {heading}
              </Text>
            )}

            {stats.length > 0 && (
              <div className="flex flex-wrap items-center justify-center divide-x divide-neutral-200">
                {stats.map((stat) => (
                  <StatCell key={stat.label} item={stat} compact />
                ))}
              </div>
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── default variant ─────────────────────────────────────────────────────────
  //
  // Row of large metric cards on a subtle-bg section; full spacing.

  return (
    <Section
      spacing="lg"
      style={{
        background:      "var(--section-subtle-bg)",
        borderTopColor:  "var(--section-subtle-border)",
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

          {stats.length > 0 && (
            <div
              className="grid gap-6"
              style={{
                gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, minmax(0, 1fr))`,
              }}
            >
              {stats.map((stat) => (
                <StatCell key={stat.label} item={stat} compact={false} />
              ))}
            </div>
          )}
        </Stack>
      </Container>
    </Section>
  );
}
