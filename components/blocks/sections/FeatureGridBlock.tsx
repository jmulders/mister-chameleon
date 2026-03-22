/**
 * FeatureGridBlock
 *
 * Renders a `featureGrid` page section — an optional heading followed by a
 * responsive grid of feature items. Supports four visual layouts via the
 * `variant` prop.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      FeatureGridBlockData  { heading?, features[] }
 *   variant   FeatureGridVariant    see below
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   default    — 3-col bordered card grid on a subtle-bg section
 *   cards      — elevated card grid on white; no section border
 *   compact    — 2-col dense grid; tighter padding for long feature lists
 *   icons-left — horizontal icon + text rows; scans like a checklist
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --feature-grid-bg           Section background (default / compact variants)
 *   --feature-grid-border       Section border colour (default / compact variants)
 *   --feature-grid-card-bg      Card background
 *   --feature-grid-card-border  Card border colour
 *   --feature-grid-card-radius  Card border-radius
 *   --feature-grid-card-shadow  Card box-shadow (cards variant only)
 *   --feature-grid-icon-bg      Icon container background (default / icons-left)
 *   --font-subheading-weight    Feature title font weight
 */

import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Grid } from "@/components/primitives/Grid";
import { Stack } from "@/components/primitives/Stack";
import { Text } from "@/components/primitives/Text";
import { resolveBlockVariant } from "@/page-config/block-variants";
import type { FeatureGridVariant } from "@/page-config/block-variants";
import type { FeatureGridBlockData } from "@/page-config";

interface FeatureGridBlockProps {
  data:     FeatureGridBlockData;
  variant?: string;
}

export function FeatureGridBlock({ data, variant: rawVariant }: FeatureGridBlockProps) {
  const variant = resolveBlockVariant("featureGrid", rawVariant) as FeatureGridVariant;
  const { heading, features } = data;
  const items = features ?? [];

  // ── icons-left variant ──────────────────────────────────────────────────────
  //
  // Horizontal rows: icon on the left, title + description on the right.
  // No card backgrounds — a clean checklist-style layout.

  if (variant === "icons-left") {
    return (
      <Section spacing="lg">
        <Container size="lg">
          <Stack gap={12}>
            {heading && (
              <Text variant="h2" align="center">
                {heading}
              </Text>
            )}

            {items.length > 0 && (
              <Stack gap={4}>
                {items.map((feature) => (
                  <div
                    key={feature.title}
                    className="flex items-start gap-4 py-3"
                  >
                    {feature.icon ? (
                      <span
                        className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl"
                        style={{
                          backgroundColor: "var(--feature-grid-icon-bg)",
                          borderRadius: "var(--feature-grid-card-radius)",
                        }}
                        role="img"
                        aria-hidden="true"
                      >
                        {feature.icon}
                      </span>
                    ) : (
                      <div
                        className="mt-0.5 h-10 w-10 shrink-0 rounded-lg"
                        style={{
                          backgroundColor: "var(--feature-grid-icon-bg)",
                          borderRadius: "var(--feature-grid-card-radius)",
                        }}
                        aria-hidden="true"
                      />
                    )}

                    <Stack gap={1} className="min-w-0">
                      <Text
                        variant="h4"
                        style={{ fontWeight: "var(--font-subheading-weight)" }}
                      >
                        {feature.title}
                      </Text>
                      <Text variant="body-sm" color="muted">
                        {feature.description}
                      </Text>
                    </Stack>
                  </div>
                ))}
              </Stack>
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── compact variant ─────────────────────────────────────────────────────────
  //
  // 2-col dense card grid; tighter padding. Efficient for long feature lists.

  if (variant === "compact") {
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

            {items.length > 0 && (
              <Grid cols={2} gap="md">
                {items.map((feature) => (
                  <Stack
                    key={feature.title}
                    gap={2}
                    className="border p-4"
                    style={{
                      backgroundColor: "var(--feature-grid-card-bg)",
                      borderColor: "var(--feature-grid-card-border)",
                      borderRadius: "var(--feature-grid-card-radius)",
                    }}
                  >
                    {feature.icon && (
                      <span
                        className="text-xl"
                        role="img"
                        aria-hidden="true"
                      >
                        {feature.icon}
                      </span>
                    )}
                    <Text
                      variant="h4"
                      style={{ fontWeight: "var(--font-subheading-weight)" }}
                    >
                      {feature.title}
                    </Text>
                    <Text variant="body-sm" color="muted">
                      {feature.description}
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

  // ── cards variant ───────────────────────────────────────────────────────────
  //
  // Elevated card grid on white; no section background or border.
  // Cards carry a box-shadow to lift them off the page.

  if (variant === "cards") {
    return (
      <Section spacing="lg">
        <Container size="lg">
          <Stack gap={12}>
            {heading && (
              <Text variant="h2" align="center">
                {heading}
              </Text>
            )}

            {items.length > 0 && (
              <Grid cols={3} gap="lg">
                {items.map((feature) => (
                  <Stack
                    key={feature.title}
                    gap={3}
                    className="border p-6"
                    style={{
                      backgroundColor: "var(--feature-grid-card-bg)",
                      borderColor: "var(--feature-grid-card-border)",
                      borderRadius: "var(--feature-grid-card-radius)",
                      boxShadow: "var(--feature-grid-card-shadow)",
                    }}
                  >
                    {feature.icon && (
                      <span
                        className="text-2xl"
                        role="img"
                        aria-hidden="true"
                      >
                        {feature.icon}
                      </span>
                    )}
                    <Text
                      variant="h4"
                      style={{ fontWeight: "var(--font-subheading-weight)" }}
                    >
                      {feature.title}
                    </Text>
                    <Text variant="body-sm" color="muted">
                      {feature.description}
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

  // ── default variant ─────────────────────────────────────────────────────────
  //
  // 3-col bordered card grid on a subtle-bg section with top/bottom border.

  return (
    <Section
      spacing="lg"
      style={{
        background: "var(--feature-grid-bg)",
        borderTopColor: "var(--feature-grid-border)",
        borderBottomColor: "var(--feature-grid-border)",
      }}
      className="border-y"
    >
      <Container size="lg">
        <Stack gap={12}>
          {heading && (
            <Text variant="h2" align="center">
              {heading}
            </Text>
          )}

          {items.length > 0 && (
            <Grid cols={3} gap="lg">
              {items.map((feature) => (
                <Stack
                  key={feature.title}
                  gap={3}
                  className="border p-6"
                  style={{
                    backgroundColor: "var(--card-bg)",
                    borderColor: "var(--card-border)",
                    borderRadius: "var(--card-radius)",
                    boxShadow: "var(--feature-grid-card-shadow)",
                  }}
                >
                  {feature.icon && (
                    <span
                      className="text-2xl"
                      role="img"
                      aria-hidden="true"
                    >
                      {feature.icon}
                    </span>
                  )}
                  <Text
                    variant="h4"
                    style={{ fontWeight: "var(--font-subheading-weight)" }}
                  >
                    {feature.title}
                  </Text>
                  <Text variant="body-sm" color="muted">
                    {feature.description}
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
