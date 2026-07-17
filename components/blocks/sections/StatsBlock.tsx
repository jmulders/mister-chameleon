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
 *   dark    — near-black section background with bright/vivid metric values;
 *             no card borders — colour contrast carries the visual weight.
 *             Dark AI / enterprise family variant.
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --section-subtle-bg      Section background
 *   --section-subtle-border  Section border colour
 *   --text-brand             Metric value colour
 *   --font-heading           Metric value font family
 *   --font-heading-weight    Metric value font weight
 *   --stats-dark-bg          Dark variant section background (default: #0a0a0f)
 *   --stats-dark-value-color Dark variant metric value colour (default: #f8fafc)
 *   --stats-dark-label-color Dark variant label colour (default: #94a3b8)
 */

import type { CSSProperties } from "react";

import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Stack } from "@/components/primitives/Stack";
import { Text } from "@/components/primitives/Text";
import { resolveBlockVariant } from "@/page-config/block-variants";
import type { StatsVariant } from "@/page-config/block-variants";
import type { StatsBlockData, StatItem } from "@/page-config";
import { resolveSurface, type BlockSurface } from "@/lib/surface";

interface StatsBlockProps {
  data:     StatsBlockData;
  variant?: string;
  surface?: BlockSurface;
}

// ── Shared stat cell ───────────────────────────────────────────────────────────

function StatCell({ item, compact }: { item: StatItem; compact: boolean }) {
  const value = `${item.prefix ?? ""}${item.value}${item.suffix ?? ""}`;

  if (compact) {
    return (
      <div className="flex flex-col items-center gap-1 px-3 sm:px-6">
        <span
          className="text-2xl font-bold leading-none sm:text-3xl"
          style={{
            color:      "var(--text)",
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
      className="flex flex-col items-center gap-2 rounded-lg border p-4 sm:p-6 lg:p-8"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor:     "var(--card-border)",
        borderRadius:    "var(--card-radius)",
      }}
    >
      <span
        className="text-3xl font-bold leading-none tracking-tight sm:text-4xl lg:text-5xl"
        style={{
          color:      "var(--text)",
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

export function StatsBlock({ data, variant: rawVariant, surface }: StatsBlockProps) {
  const variant = resolveBlockVariant("stats", rawVariant) as StatsVariant;
  const { heading, items } = data;
  const stats = items ?? [];

  // ── compact variant ─────────────────────────────────────────────────────────
  //
  // Tight inline row with separator lines; no card backgrounds.
  // Lower vertical footprint — good for mid-page context.

  if (variant === "compact") {
    return (
      <Section spacing="md" style={{ background: resolveSurface(surface) ?? "var(--bg)" }}>
        <Container size="lg">
          <Stack gap={6}>
            {heading && (
              <Text variant="h3" align="center">
                {heading}
              </Text>
            )}

            {stats.length > 0 && (
              <div className="grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-0 sm:divide-x sm:divide-[var(--border)]">
                {stats.map((stat, i) => (
                  <StatCell key={i} item={stat} compact />
                ))}
              </div>
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── dark variant ─────────────────────────────────────────────────────────────
  //
  // Near-black section background with large, bright metric values.
  // No card borders — colour contrast does the separation work.
  // Uses var(--stats-dark-bg) for the section and var(--primary) to tint
  // the metric values for brand presence.

  if (variant === "dark") {
    return (
      <Section
        spacing="lg"
        style={{ background: resolveSurface(surface) ?? "var(--stats-dark-bg, #0a0a0f)" }}
        className="relative overflow-hidden"
      >
        {/* Subtle wide glow behind the content */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div
            className="h-64 w-full max-w-2xl rounded-full blur-3xl"
            style={{
              background: "var(--hero-glow-color, var(--primary))",
              opacity:    0.06,
            }}
          />
        </div>

        <Container size="lg" className="relative z-10">
          <Stack gap={10}>
            {heading && (
              <Text
                variant="h2"
                align="center"
                style={{ color: "var(--stats-dark-value-color, #f8fafc)" }}
              >
                {heading}
              </Text>
            )}

            {stats.length > 0 && (
              <div
                className="grid grid-cols-2 gap-8 md:[grid-template-columns:repeat(var(--stats-cols),minmax(0,1fr))]"
                style={{ "--stats-cols": String(Math.min(stats.length, 4)) } as CSSProperties}
              >
                {stats.map((stat, i) => {
                  const value = `${stat.prefix ?? ""}${stat.value}${stat.suffix ?? ""}`;
                  return (
                    <div key={i} className="flex flex-col items-center gap-2 text-center">
                      <span
                        className="text-4xl font-bold leading-none tracking-tight sm:text-5xl lg:text-6xl"
                        style={{
                          color:      "var(--primary)",
                          fontFamily: "var(--font-heading)",
                          fontWeight: "var(--font-heading-weight)",
                        }}
                      >
                        {value}
                      </span>
                      <span
                        className="text-sm"
                        style={{ color: "var(--stats-dark-label-color, #94a3b8)" }}
                      >
                        {stat.label}
                      </span>
                    </div>
                  );
                })}
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
        background:      resolveSurface(surface) ?? "var(--section-subtle-bg)",
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
              className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-6 md:[grid-template-columns:repeat(var(--stats-cols),minmax(0,1fr))]"
              style={{ "--stats-cols": String(Math.min(stats.length, 4)) } as CSSProperties}
            >
              {stats.map((stat, i) => (
                <StatCell key={i} item={stat} compact={false} />
              ))}
            </div>
          )}
        </Stack>
      </Container>
    </Section>
  );
}
