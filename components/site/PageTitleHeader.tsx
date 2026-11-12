/**
 * The title of a CMS page as its h1, for a page that has no hero.
 * See lib/page-title.ts for when it is shown.
 */

import { Container } from "@/components/primitives/Container";
import { Text }      from "@/components/primitives/Text";

export function PageTitleHeader({ title }: { title: string }) {
  return (
    <header style={{ paddingTop: "clamp(2.5rem, 6vw, 4.5rem)", paddingBottom: "0.5rem" }}>
      <Container size="lg">
        <Text
          variant="h1"
          align="center"
          balance
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: "var(--font-heading-weight)",
          }}
        >
          {title}
        </Text>
      </Container>
    </header>
  );
}
