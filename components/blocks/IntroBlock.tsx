import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Stack } from "@/components/primitives/Stack";
import { Grid } from "@/components/primitives/Grid";
import { Text } from "@/components/primitives/Text";
import { Badge } from "@/components/ui/Badge";

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
}

const defaults: Required<IntroBlockProps> = {
  label: "The problem",
  headline: "One website can't speak to everyone.",
  body: "Marketing teams spend weeks crafting the perfect message — then serve it identically to every visitor, regardless of where they came from, what device they're using, or what they actually need.",
  points: [
    { icon: "📡", text: "Traffic from 10+ sources lands on one generic page" },
    { icon: "💸", text: "Your best leads leave before they see your real value" },
    { icon: "🛠", text: "True personalisation takes months of engineering" },
  ],
};

export function IntroBlock(props: IntroBlockProps) {
  const { label, headline, body, points } = { ...defaults, ...props };

  return (
    <Section spacing="lg" className="bg-white">
      <Container size="lg">
        <Stack gap={12}>
          {/* Header */}
          <Stack gap={4} align="center" className="text-center">
            {label && <Badge variant="default">{label}</Badge>}

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
                <Stack key={i} gap={3} className="rounded-xl border border-neutral-200 bg-neutral-50 p-6">
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
