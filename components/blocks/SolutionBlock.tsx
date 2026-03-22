import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Stack } from "@/components/primitives/Stack";
import { Grid } from "@/components/primitives/Grid";
import { Text } from "@/components/primitives/Text";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

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
}

const defaults: Required<SolutionBlockProps> = {
  label: "How it works",
  headline: "Three steps to adaptive.",
  subheadline:
    "No code changes, no data science team. Just connect, configure, and let Chameleon decide.",
  features: [
    {
      step: 1,
      icon: "🔌",
      title: "Connect your sources",
      description:
        "Install the snippet or connect via API. Chameleon starts collecting visitor signals — UTM params, referrers, geo, device, and more — immediately.",
    },
    {
      step: 2,
      icon: "🎨",
      title: "Define your experiences",
      description:
        "Use the visual editor to create content variants. Each experience is a complete page configuration — headline, copy, CTA, even layout.",
    },
    {
      step: 3,
      icon: "🦎",
      title: "Let Chameleon decide",
      description:
        "The rule engine evaluates every visitor in real time and serves the best-match experience. You see the results in the analytics dashboard.",
    },
  ],
};

export function SolutionBlock(props: SolutionBlockProps) {
  const { label, headline, subheadline, features } = { ...defaults, ...props };

  return (
    <Section spacing="lg" className="bg-white">
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
                  <span className="mb-4 flex size-8 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-600">
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
