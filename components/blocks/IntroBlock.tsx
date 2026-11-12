import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Stack } from "@/components/primitives/Stack";
import { Grid } from "@/components/primitives/Grid";
import { Text } from "@/components/primitives/Text";
import { Badge } from "@/components/ui/Badge";
import { BLOCK_TEXTS } from "@/lib/site-texts/blocks";
import type { SiteLocale } from "@/lib/site-texts/locale";

/**
 * IntroBlock
 *
 * The "problem statement" section. Follows the hero and establishes
 * empathy with the visitor by naming the pain they experience.
 * Copy here is highly adaptive — different segments see different problems.
 */

interface ProblemPoint {
  icon: string;
  text: string;
}

export interface IntroBlockProps {
  label?: string;
  headline?: string;
  body?: string;
  points?: ProblemPoint[];
  /** Language of the built-in copy. Defaults to English. */
  locale?: SiteLocale;
}

const POINT_ICONS = ["📡", "💸", "🛠"] as const;

/** The built-in copy, in the given language. Props override it per field. */
function defaultsFor(locale: SiteLocale): Required<Omit<IntroBlockProps, "locale">> {
  const d = BLOCK_TEXTS[locale].introDefaults;
  return {
    label:    d.label,
    headline: d.headline,
    body:     d.body,
    points:   d.points.map((text, i) => ({ icon: POINT_ICONS[i], text })),
  };
}

export function IntroBlock({ locale = "en", ...props }: IntroBlockProps) {
  const { label, headline, body, points } = { ...defaultsFor(locale), ...props };

  return (
    <Section spacing="lg" style={{ background: "var(--section-subtle-bg)" }}>
      <Container size="lg">
        <Stack gap={12}>
          {/* Header */}
          <Stack gap={4} align="center" className="text-center">
            {label && <Badge variant="primary">{label}</Badge>}

            <Text variant="h2" balance className="max-w-2xl mx-auto">
              {headline}
            </Text>

            {body && (
              <Text variant="body" color="muted" align="center" className="max-w-2xl mx-auto text-lg">
                {body}
              </Text>
            )}
          </Stack>

          {/* Problem points */}
          {points && points.length > 0 && (
            <Grid cols={3} gap="lg">
              {points.map((point, i) => (
                <Stack key={i} gap={3} className="rounded-xl p-6" style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
                  <span className="text-3xl">{point.icon}</span>
                  <Text variant="body" color="muted">
                    {point.text}
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
