import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Stack } from "@/components/primitives/Stack";
import { Grid } from "@/components/primitives/Grid";
import { Text } from "@/components/primitives/Text";

/**
 * ProofBlock
 *
 * Social proof section — a heading and an array of proof points.
 * Each proof point has a bold title (metric, quote anchor, or capability
 * statement) and a supporting line of copy.
 *
 * Prop names align with CMS field names (ProofBlockData) so that experience
 * data can be spread directly onto this component without a mapper step:
 *
 *   <ProofBlock {...experience.proof} />
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   title    Required  Section heading ("Conversion lifts that speak for themselves")
 *   items    Required  Array of { title, text } proof points (typically 3)
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --section-subtle-bg      Section background (default: --bg-subtle)
 *   --section-subtle-border  Section border colour (default: --border)
 *   --text-brand             Proof metric numbers / bold labels
 *   --border                 Internal divider line
 */

export interface ProofItem {
  /** Bold label — a metric, quote anchor, or capability statement */
  title: string;
  /** One-to-two sentence supporting copy */
  text: string;
}

export interface ProofBlockProps {
  /** Section heading displayed above the proof items */
  title: string;
  /** Ordered array of proof points */
  items: ProofItem[];
}

export function ProofBlock({ title, items }: ProofBlockProps) {
  return (
    /*
     * --section-subtle-bg replaces bg-neutral-50.
     * --section-subtle-border replaces border-neutral-200.
     * bold-brand maps these to brand-50 and brand-100 for a tinted look.
     */
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
        <Stack gap={12}>
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
                  <Text
                    variant="h3"
                    color="brand"
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
