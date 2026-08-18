import type React from "react";
import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Stack } from "@/components/primitives/Stack";
import { Grid } from "@/components/primitives/Grid";
import { Text } from "@/components/primitives/Text";
import { resolveContextBlockVariant } from "@/page-config/block-variants";
import type { ProofLayoutVariant } from "@/page-config/block-variants";
import type { ProofItem } from "@/cms/types";
import { BlockMediaView } from "@/components/blocks/media/BlockMediaView";
import { isRenderableMedia } from "@/lib/media/block-media";

/**
 * ProofBlock
 *
 * Social proof section — a heading and an array of proof points.
 *
 * ─── Layout variants ─────────────────────────────────────────────────────────
 *
 *   proof_stats   — headline metric row (e.g. "10M+ users") — default
 *   proof_logos   — client / partner / integration logo strip (text badges)
 *   proof_quotes  — grid of short testimonial quote cards
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   title          Required  Section heading
 *   items          Required  Array of { title, text } proof points (typically 3)
 *   layoutVariant  Optional  Structural layout key (default: "proof_stats")
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --section-subtle-bg      Section background (default: --bg-subtle)
 *   --section-subtle-border  Section border colour (default: --border)
 *   --text                   Proof metric numbers (neutral foreground, not brand)
 *   --text-muted             Supporting copy
 *   --border                 Internal divider line
 *   --primary                Pull-quote mark accent (proof_quotes variant)
 *   --proof-card-bg          Card background (proof_quotes variant)
 *   --proof-card-border      Card border colour (proof_quotes variant)
 *   --proof-card-radius      Card border-radius (proof_quotes variant)
 *   --proof-quote-color      Pull-quote mark colour override (proof_quotes variant)
 */

export type { ProofItem };

export interface ProofBlockProps {
  /** Section heading displayed above the proof items */
  title: string;
  /** Ordered array of proof points */
  items: ProofItem[];
  /**
   * Structural layout variant for this proof block.
   * Defaults to "proof_stats" when absent or unrecognised.
   */
  layoutVariant?: string;
}

export function ProofBlock({ title, items, layoutVariant: rawLayout }: ProofBlockProps) {
  const layout = resolveContextBlockVariant("proof", rawLayout) as ProofLayoutVariant;

  // ── proof_logos ─────────────────────────────────────────────────────────────
  //
  // A horizontal strip of partner / client / integration logos rendered as
  // text badge pills.  Items use .title as the logo/brand name.  The strip
  // scrolls horizontally on narrow viewports.

  if (layout === "proof_logos") {
    return (
      <Section
        spacing="lg"
        style={{
          background:        "var(--section-subtle-bg)",
          borderTopWidth:    "var(--block-divider-width)",
          borderBottomWidth: "var(--block-divider-width)",
          borderTopColor:    "var(--block-divider-color)",
          borderBottomColor: "var(--block-divider-color)",
          borderTopStyle:    "solid",
          borderBottomStyle: "solid",
        }}
      >
        <Container size="lg">
          <Stack gap={8} align="center" style={{ gap: "var(--block-content-gap)" }}>
            {/* Heading */}
            <Text
              variant="caption"
              color="subtle"
              align="center"
              className="tracking-wider uppercase"
            >
              {title}
            </Text>

            {/* Logo strip */}
            {items.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
                {items.map((item) => (
                  <div
                    key={item.title}
                    className="flex items-center justify-center px-5 py-2.5 border"
                    style={{
                      borderColor:     "var(--section-subtle-border)",
                      borderRadius:    "var(--card-radius, 0.5rem)",
                      backgroundColor: "var(--card-bg)",
                    }}
                    title={item.text || undefined}
                  >
                    <span
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: "var(--text-muted, var(--text-subtle))" }}
                    >
                      {item.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── proof_quotes ─────────────────────────────────────────────────────────────
  //
  // Grid of short testimonial-style quote cards.  Items use .title as the
  // quote text and .text as the attribution (name / company).

  if (layout === "proof_quotes") {
    return (
      <Section
        spacing="lg"
        style={{
          background:        "var(--section-subtle-bg)",
          borderTopWidth:    "var(--block-divider-width)",
          borderBottomWidth: "var(--block-divider-width)",
          borderTopColor:    "var(--block-divider-color)",
          borderBottomColor: "var(--block-divider-color)",
          borderTopStyle:    "solid",
          borderBottomStyle: "solid",
        }}
      >
        <Container size="lg">
          <Stack gap={10} style={{ gap: "var(--block-content-gap)" }}>
            {/* Heading */}
            <Text
              variant="caption"
              color="subtle"
              align="center"
              className="tracking-wider uppercase"
            >
              {title}
            </Text>

            {items.length > 0 && (
              <Grid cols={3} gap="lg">
                {items.map((item) => (
                  <Stack
                    key={item.title}
                    gap={3}
                    className="border"
                    style={{
                      padding:         "var(--block-card-padding)",
                      backgroundColor: "var(--proof-card-bg, var(--card-bg))",
                      borderColor:     "var(--proof-card-border, var(--card-border))",
                      borderRadius:    "var(--proof-card-radius, var(--card-radius))",
                    }}
                  >
                    {/* Opening quote mark — intentional accent; uses --primary so it
                        follows the active theme preset (orange, pink, etc.) rather
                        than falling back to --text-brand which chains to --primary
                        anyway but obscures intent.  --proof-quote-color is the
                        per-tenant override escape hatch. */}
                    <span
                      className="text-2xl leading-none select-none"
                      style={{ color: "var(--proof-quote-color, var(--primary))" }}
                      aria-hidden="true"
                    >
                      &ldquo;
                    </span>
                    <Text
                      variant="body-sm"
                      color="muted"
                      className="italic leading-relaxed flex-1"
                    >
                      {item.title}
                    </Text>
                    <Text
                      variant="caption"
                      color="subtle"
                      style={{ fontWeight: "var(--font-subheading-weight)" }}
                    >
                      {item.text}
                    </Text>
                  </Stack>
                ))}
              </Grid>
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── proof_spotlight ──────────────────────────────────────────────────────────
  //
  // One case in the spotlight: media (photo or video) alongside a quote/story,
  // with a relationship eyebrow (kind) and split attribution (name / role /
  // organisation). Uses the shared media core. This branch renders the first item
  // as a single spotlight; the multi-item slider is added in a later step.
  //
  // Media side is tenant-controlled via --proof-spotlight-media-side (a CSS
  // `order`: 1 = media after the text on the right/below, default; -1 = before,
  // on the left/above).

  if (layout === "proof_spotlight") {
    const item = items[0];
    return (
      <Section spacing="lg" style={{ background: "var(--section-subtle-bg)" }}>
        <Container size="lg">
          <Stack gap={10} style={{ gap: "var(--block-content-gap)" }}>
            {title && (
              <Text variant="caption" color="subtle" align="center" className="tracking-wider uppercase">
                {title}
              </Text>
            )}

            {item && (
              <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-12">
                {isRenderableMedia(item.media) && (
                  <div className="w-full lg:w-1/2" style={{ order: "var(--proof-spotlight-media-side, 1)" as unknown as number }}>
                    <BlockMediaView media={item.media} />
                  </div>
                )}

                <Stack gap={4} className="w-full lg:flex-1">
                  {item.kind && (
                    <Text variant="caption" color="subtle" className="tracking-wider uppercase">
                      {item.kind}
                    </Text>
                  )}

                  <span
                    className="text-4xl leading-none select-none"
                    style={{ color: "var(--proof-quote-color, var(--primary))" }}
                    aria-hidden="true"
                  >
                    &ldquo;
                  </span>

                  <Text variant="h3" color="default" className="italic leading-relaxed" style={{ fontWeight: "normal" }}>
                    {item.text}
                  </Text>

                  {(item.name || item.role || item.organisation) && (
                    <Stack gap={0}>
                      {item.name && (
                        <Text variant="body" style={{ fontWeight: "var(--font-subheading-weight)" }}>
                          {item.name}
                        </Text>
                      )}
                      {(item.role || item.organisation) && (
                        <Text variant="body-sm" color="subtle">
                          {[item.role, item.organisation].filter(Boolean).join(" · ")}
                        </Text>
                      )}
                    </Stack>
                  )}
                </Stack>
              </div>
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── proof_stats (default) ────────────────────────────────────────────────────
  //
  // Headline metric row: bold title (number/stat) + supporting copy.
  // Items use .title as the metric value and .text as the description.

  return (
    /*
     * --section-subtle-bg replaces bg-neutral-50.
     * --section-subtle-border replaces border-neutral-200.
     * bold-brand maps these to brand-50 and brand-100 for a tinted look.
     */
    <Section
      spacing="lg"
      style={{
        background:        "var(--section-subtle-bg)",
        borderTopWidth:    "var(--block-divider-width)",
        borderBottomWidth: "var(--block-divider-width)",
        borderTopColor:    "var(--block-divider-color)",
        borderBottomColor: "var(--block-divider-color)",
        borderTopStyle:    "solid",
        borderBottomStyle: "solid",
      }}
    >
      <Container size="lg">
        <Stack gap={12} style={{ gap: "var(--block-content-gap)" }}>
          {/* Section heading */}
          <Text
            variant="caption"
            color="subtle"
            align="center"
            className="tracking-wider uppercase"
          >
            {title}
          </Text>

          {/* Divider — uses --border */}
          <div style={{ borderTopColor: "var(--border)" }} className="border-t" />

          {/* Proof point grid */}
          {items.length > 0 && (
            <Grid cols={3} gap="lg">
              {items.map((item) => (
                <Stack key={item.title} gap={3} align="center" className="text-center">
                  {/* Stat metric value (e.g. "10M+ users", "99.9% uptime").
                      Uses color="default" (--text) — these are neutral display
                      numbers, not brand-accented callouts.  Matching the fix
                      applied to StatsBlock.tsx where the same pattern was
                      incorrectly using --text-brand / --primary. */}
                  <Text
                    variant="h3"
                    color="default"
                    align="center"
                    className="tabular-nums"
                  >
                    {item.title}
                  </Text>
                  <Text variant="body-sm" color="muted" align="center">
                    {item.text}
                  </Text>
                </Stack>
              ))}
            </Grid>
          )}
        </Stack>
      </Container>
    </Section>
  );
}
