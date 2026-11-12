import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Stack } from "@/components/primitives/Stack";
import { Grid } from "@/components/primitives/Grid";
import { Text } from "@/components/primitives/Text";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { BLOCK_TEXTS } from "@/lib/site-texts/blocks";
import type { SiteLocale } from "@/lib/site-texts/locale";

/**
 * SolutionBlock
 *
 * The "how it works" section. Follows social proof and explains the
 * mechanism that makes Mister Chameleon work. Each feature card maps
 * to a core product pillar. Adaptive use: re-order or highlight
 * different steps based on the visitor's role or source.
 */

interface FeatureCard {
  step: number;
  icon: string;
  title: string;
  description: string;
}

export interface SolutionBlockProps {
  label?: string;
  headline?: string;
  subheadline?: string;
  features?: FeatureCard[];
  /** Language of the built-in copy. Defaults to English. */
  locale?: SiteLocale;
}

const STEP_ICONS = ["🔌", "🎨", "🦎"] as const;

/** The built-in copy, in the given language. Props override it per field. */
function defaultsFor(locale: SiteLocale): Required<Omit<SolutionBlockProps, "locale">> {
  const d = BLOCK_TEXTS[locale].solutionDefaults;
  return {
    label:       d.label,
    headline:    d.headline,
    subheadline: d.subheadline,
    features:    d.features.map((f, i) => ({
      step:        i + 1,
      icon:        STEP_ICONS[i],
      title:       f.title,
      description: f.description,
    })),
  };
}

export function SolutionBlock({ locale = "en", ...props }: SolutionBlockProps) {
  const { label, headline, subheadline, features } = { ...defaultsFor(locale), ...props };

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

            {subheadline && (
              <Text variant="body" color="muted" align="center" className="max-w-xl mx-auto text-lg">
                {subheadline}
              </Text>
            )}
          </Stack>

          {/* Feature cards */}
          {features && features.length > 0 && (
            <Grid cols={3} gap="lg">
              {features.map((feature) => (
                <Card key={feature.step} hover className="relative">
                  {/* Step number */}
                  <span className="mb-4 flex size-8 items-center justify-center rounded-full text-sm font-bold" style={{ background: "var(--primary-subtle)", color: "var(--text-brand)" }}>
                    {feature.step}
                  </span>

                  <Text variant="h4" className="mb-2">
                    <span className="mr-2">{feature.icon}</span>
                    {feature.title}
                  </Text>

                  <Text variant="body-sm" color="muted">
                    {feature.description}
                  </Text>
                </Card>
              ))}
            </Grid>
          )}
        </Stack>
      </Container>
    </Section>
  );
}
