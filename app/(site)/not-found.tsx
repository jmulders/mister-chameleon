/**
 * 404 Not Found
 *
 * Rendered by Next.js when notFound() is called in a route or when no
 * matching route exists. Matches the site's visual style — dark background,
 * brand accent, consistent typography — so the error feels intentional
 * rather than broken.
 */

import Link from "next/link";
import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Stack } from "@/components/primitives/Stack";
import { Text } from "@/components/primitives/Text";
import { getSiteLocale } from "@/lib/site-texts/server";
import { PAGE_TEXTS } from "@/lib/site-texts/pages";

export default async function NotFound() {
  const t = PAGE_TEXTS[await getSiteLocale()].notFound;

  return (
    <main>
      <Section
        spacing="xl"
        className="relative overflow-hidden bg-neutral-950"
      >
        {/* Subtle radial glow — mirrors HeroBlock */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div className="h-[500px] w-[500px] rounded-full bg-brand-600/20 blur-3xl" />
        </div>

        <Container size="sm" className="relative z-10">
          <Stack gap={6} align="center" className="text-center">
            {/* Status code */}
            <Text
              variant="display"
              color="brand"
              align="center"
              className="text-8xl font-black tabular-nums"
            >
              404
            </Text>

            {/* Headline */}
            <Text
              variant="h2"
              color="inverse"
              align="center"
              balance
            >
              {t.title}
            </Text>

            {/* Supporting copy */}
            <Text
              variant="body"
              color="muted"
              align="center"
              className="max-w-sm text-neutral-400"
            >
              {t.body}
            </Text>

            {/* Return home CTA */}
            <Link
              href="/"
              className="mt-2 inline-flex items-center justify-center rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
            >
              {t.cta}
            </Link>
          </Stack>
        </Container>
      </Section>
    </main>
  );
}
