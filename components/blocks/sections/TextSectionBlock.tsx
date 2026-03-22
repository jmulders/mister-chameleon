/**
 * TextSectionBlock
 *
 * Renders a `textSection` page section — an optional heading followed by
 * Portable Text body copy. Suitable for "About" paragraphs, policy text,
 * long-form editorial content, and any rich text block on a CMS page.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      TextSectionBlockData  { heading?, body? }
 *   variant   "default" | "centered"
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   default  — left-aligned text, standard container width
 *   centered — center-aligned heading and body; reduced max-width
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   (none — uses default section/text tokens inherited from the layout)
 */

import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Stack } from "@/components/primitives/Stack";
import { Text } from "@/components/primitives/Text";
import { resolveBlockVariant } from "@/page-config/block-variants";
import type { TextSectionVariant } from "@/page-config/block-variants";
import type { TextSectionBlockData } from "@/page-config";
import { PortableTextRenderer } from "./PortableTextRenderer";
import type { PortableTextBlock } from "@/cms/types";

interface TextSectionBlockProps {
  data:     TextSectionBlockData;
  variant?: string;
}

export function TextSectionBlock({ data, variant: rawVariant }: TextSectionBlockProps) {
  const variant = resolveBlockVariant("textSection", rawVariant) as TextSectionVariant;
  const { heading, body } = data;

  const isCentered = variant === "centered";

  return (
    <Section spacing="lg">
      <Container size="md">
        <Stack gap={6}>
          {heading && (
            <Text
              variant="h2"
              align={isCentered ? "center" : undefined}
              balance={isCentered}
            >
              {heading}
            </Text>
          )}

          {body && body.length > 0 && (
            <div className={isCentered ? "text-center" : undefined}>
              <PortableTextRenderer
                // Cast: readonly PortableTextBlock[] → PortableTextBlock[]
                // Safe — PortableTextRenderer only reads the array.
                blocks={body as PortableTextBlock[]}
                className={isCentered ? "prose-neutral mx-auto" : "prose-neutral max-w-none"}
              />
            </div>
          )}
        </Stack>
      </Container>
    </Section>
  );
}
