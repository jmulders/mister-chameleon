/**
 * QuickLinksBlock
 *
 * Renders a `quickLinks` page section — a compact grid or list of linkable
 * cards for navigation hubs, service overviews, or resource directories.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      QuickLinksBlockData  { heading?, description?, links[] }
 *   variant   QuickLinksVariant    see below
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   quicklinks_grid    — icon + label card grid with optional description (default)
 *   quicklinks_list    — single-column list rows with description
 *   quicklinks_compact — dense grid, label only, minimal padding
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --section-subtle-bg     Section background
 *   --card-bg               Card background
 *   --card-border           Card border colour
 *   --card-radius           Card border-radius
 *   --card-shadow           Card box-shadow
 *   --primary               Icon accent colour
 *   --font-heading          Heading font family
 *   --font-heading-weight   Heading font weight
 */

import { Container }          from "@/components/primitives/Container";
import { Section }            from "@/components/primitives/Section";
import { Stack }              from "@/components/primitives/Stack";
import { Text }               from "@/components/primitives/Text";
import { resolveBlockVariant } from "@/page-config/block-variants";
import type { QuickLinksVariant } from "@/page-config/block-variants";
import type { QuickLinksBlockData, QuickLinkItem } from "@/page-config";
import { resolveSurface, type BlockSurface } from "@/lib/surface";

interface QuickLinksBlockProps {
  data:     QuickLinksBlockData;
  variant?: string;
  surface?: BlockSurface;
}

// ── Grid card ─────────────────────────────────────────────────────────────────

function GridCard({ link }: { link: QuickLinkItem }) {
  return (
    <a
      href={link.href}
      className="group flex flex-col gap-3 rounded-xl border p-5 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        backgroundColor: "var(--card-bg, white)",
        borderColor:     "var(--card-border)",
        borderRadius:    "var(--card-radius)",
        boxShadow:       "var(--card-shadow)",
      }}
    >
      {link.icon && (
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
          style={{ backgroundColor: "var(--section-subtle-bg)", color: "var(--primary)" }}
          aria-hidden="true"
        >
          {link.icon}
        </div>
      )}
      <div>
        <Text
          variant="body"
          className="font-semibold group-hover:underline"
        >
          {link.label}
        </Text>
        {link.description && (
          <Text variant="body-sm" color="muted" className="mt-0.5">
            {link.description}
          </Text>
        )}
      </div>
    </a>
  );
}

// ── List row ──────────────────────────────────────────────────────────────────

function ListRow({ link }: { link: QuickLinkItem }) {
  return (
    <a
      href={link.href}
      className="group flex items-center gap-4 rounded-lg border px-5 py-4 transition-colors hover:border-current focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        backgroundColor: "var(--card-bg, white)",
        borderColor:     "var(--card-border)",
        borderRadius:    "var(--card-radius)",
      }}
    >
      {link.icon && (
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
          style={{ backgroundColor: "var(--section-subtle-bg)", color: "var(--primary)" }}
          aria-hidden="true"
        >
          {link.icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <Text variant="body" className="font-medium group-hover:underline truncate">
          {link.label}
        </Text>
        {link.description && (
          <Text variant="body-sm" color="muted" className="truncate">
            {link.description}
          </Text>
        )}
      </div>
      {/* Chevron */}
      <svg
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </a>
  );
}

// ── Compact tile ──────────────────────────────────────────────────────────────

function CompactTile({ link }: { link: QuickLinkItem }) {
  return (
    <a
      href={link.href}
      className="group flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors hover:border-current focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        backgroundColor: "var(--card-bg, white)",
        borderColor:     "var(--card-border)",
        borderRadius:    "var(--card-radius)",
      }}
    >
      {link.icon && (
        <span
          className="shrink-0"
          style={{ color: "var(--primary)" }}
          aria-hidden="true"
        >
          {link.icon}
        </span>
      )}
      <span className="group-hover:underline">{link.label}</span>
    </a>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function QuickLinksBlock({ data, variant: rawVariant, surface }: QuickLinksBlockProps) {
  const variant = resolveBlockVariant("quickLinks", rawVariant) as QuickLinksVariant;
  const { heading, description, links } = data;

  const header = (heading || description) ? (
    <Stack gap={3}>
      {heading && (
        <Text
          variant="h2"
          balance
          style={{ fontFamily: "var(--font-heading)", fontWeight: "var(--font-heading-weight)" }}
        >
          {heading}
        </Text>
      )}
      {description && (
        <Text variant="body" color="muted" className="max-w-xl">
          {description}
        </Text>
      )}
    </Stack>
  ) : null;

  // ── quicklinks_list ──────────────────────────────────────────────────────────
  if (variant === "quicklinks_list") {
    return (
      <Section spacing="lg" style={{ background: resolveSurface(surface) ?? "var(--bg)" }}>
        <Container size="md">
          <Stack gap={8}>
            {header}
            <Stack gap={3}>
              {links.map((link) => (
                <ListRow key={link.id} link={link} />
              ))}
            </Stack>
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── quicklinks_compact ───────────────────────────────────────────────────────
  if (variant === "quicklinks_compact") {
    return (
      <Section spacing="md" style={{ background: resolveSurface(surface) ?? "var(--bg)" }}>
        <Container size="lg">
          <Stack gap={6}>
            {header}
            <div className="flex flex-wrap gap-3">
              {links.map((link) => (
                <CompactTile key={link.id} link={link} />
              ))}
            </div>
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── quicklinks_grid (default) ────────────────────────────────────────────────
  return (
    <Section spacing="xl" style={{ background: resolveSurface(surface) ?? "var(--bg)" }}>
      <Container size="lg">
        <Stack gap={10}>
          {header}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {links.map((link) => (
              <GridCard key={link.id} link={link} />
            ))}
          </div>
        </Stack>
      </Container>
    </Section>
  );
}
