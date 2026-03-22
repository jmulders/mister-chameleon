/**
 * NewsListBlock
 *
 * Renders a `newsList` page section — a grid or list of news/blog article
 * teasers with headline, date, category, excerpt, and optional image.
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      NewsListBlockData  { heading?, items[], maxItems? }
 *   variant   NewsListVariant    see below
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   default  — 3-col card grid; standard blog overview layout
 *   grid     — explicit alias for the card-grid layout
 *   list     — single-column row list; more article meta visible per row
 *   featured — first item rendered as a wide hero card; rest in a smaller grid
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --card-bg           Article card background
 *   --card-border       Article card border colour
 *   --card-radius       Article card border-radius
 *   --text-brand        Category pill accent colour
 *   --section-subtle-bg Image placeholder background
 */

import { Container } from "@/components/primitives/Container";
import { Section }   from "@/components/primitives/Section";
import { Stack }     from "@/components/primitives/Stack";
import { Text }      from "@/components/primitives/Text";
import { resolveBlockVariant } from "@/page-config/block-variants";
import type { NewsListVariant }  from "@/page-config/block-variants";
import type { NewsListBlockData, NewsItem } from "@/page-config";

interface NewsListBlockProps {
  data:     NewsListBlockData;
  variant?: string;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function formatDate(iso?: string): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day:   "numeric",
      month: "short",
      year:  "numeric",
    });
  } catch {
    return iso;
  }
}

// ── Card layouts ──────────────────────────────────────────────────────────────

function NewsCardGrid({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.url}
      className="group flex flex-col overflow-hidden rounded-xl border no-underline transition-shadow hover:shadow-md"
      style={{
        backgroundColor: "var(--card-bg, white)",
        borderColor:     "var(--card-border)",
        borderRadius:    "var(--card-radius)",
      }}
    >
      {/* Image */}
      <div
        className="aspect-video w-full overflow-hidden"
        style={{ background: "var(--section-subtle-bg)" }}
      >
        {item.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-5">
        {(item.category || item.date) && (
          <div className="flex items-center gap-3">
            {item.category && (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: "var(--section-subtle-bg)", color: "var(--text-brand)" }}
              >
                {item.category}
              </span>
            )}
            {item.date && (
              <Text variant="body-sm" color="muted">{formatDate(item.date)}</Text>
            )}
          </div>
        )}
        <Text variant="body" weight="semibold" className="group-hover:underline">
          {item.title}
        </Text>
        {item.excerpt && (
          <Text variant="body-sm" color="muted" className="line-clamp-3 flex-1">
            {item.excerpt}
          </Text>
        )}
      </div>
    </a>
  );
}

function NewsRowList({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.url}
      className="group flex gap-5 rounded-xl border p-4 no-underline transition-shadow hover:shadow-sm"
      style={{
        backgroundColor: "var(--card-bg, white)",
        borderColor:     "var(--card-border)",
        borderRadius:    "var(--card-radius)",
      }}
    >
      {/* Thumbnail */}
      {item.imageUrl && (
        <div
          className="h-20 w-28 flex-shrink-0 overflow-hidden rounded-lg"
          style={{ background: "var(--section-subtle-bg)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl}
            alt={item.title}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 flex-col gap-1">
        {(item.category || item.date) && (
          <div className="flex items-center gap-3">
            {item.category && (
              <Text variant="body-sm" style={{ color: "var(--text-brand)", fontWeight: 600 }}>
                {item.category}
              </Text>
            )}
            {item.date && (
              <Text variant="body-sm" color="muted">{formatDate(item.date)}</Text>
            )}
          </div>
        )}
        <Text variant="body" weight="semibold" className="group-hover:underline">
          {item.title}
        </Text>
        {item.excerpt && (
          <Text variant="body-sm" color="muted" className="line-clamp-2">
            {item.excerpt}
          </Text>
        )}
      </div>
    </a>
  );
}

// ── Block component ────────────────────────────────────────────────────────────

export function NewsListBlock({ data, variant: rawVariant }: NewsListBlockProps) {
  const variant = resolveBlockVariant("newsList", rawVariant) as NewsListVariant;
  const { heading, items, maxItems } = data;

  const allItems = items ?? [];
  const capped   = maxItems ? allItems.slice(0, maxItems) : allItems;

  // ── list variant ───────────────────────────────────────────────────────────

  if (variant === "list") {
    return (
      <Section spacing="lg">
        <Container size="lg">
          <Stack gap={10}>
            {heading && <Text variant="h2">{heading}</Text>}
            {capped.length > 0 && (
              <Stack gap={4}>
                {capped.map((item) => (
                  <NewsRowList key={item.url} item={item} />
                ))}
              </Stack>
            )}
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── featured variant ───────────────────────────────────────────────────────
  //
  // First item rendered wide (2/3 width) with larger image; rest in a
  // 2-col grid to the right (or below on mobile).

  if (variant === "featured" && capped.length > 0) {
    const [first, ...rest] = capped;
    return (
      <Section spacing="lg">
        <Container size="lg">
          <Stack gap={10}>
            {heading && <Text variant="h2">{heading}</Text>}
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              {/* Featured (first) item */}
              <div className="lg:w-2/3">
                <NewsCardGrid item={first} />
              </div>
              {/* Secondary items */}
              {rest.length > 0 && (
                <div className="grid gap-4 lg:w-1/3 lg:grid-cols-1">
                  {rest.map((item) => (
                    <NewsRowList key={item.url} item={item} />
                  ))}
                </div>
              )}
            </div>
          </Stack>
        </Container>
      </Section>
    );
  }

  // ── default / grid variant ─────────────────────────────────────────────────

  return (
    <Section spacing="lg">
      <Container size="lg">
        <Stack gap={10}>
          {heading && <Text variant="h2">{heading}</Text>}
          {capped.length > 0 && (
            <div
              className="grid gap-6"
              style={{
                gridTemplateColumns: `repeat(${Math.min(capped.length, 3)}, minmax(0, 1fr))`,
              }}
            >
              {capped.map((item) => (
                <NewsCardGrid key={item.url} item={item} />
              ))}
            </div>
          )}
        </Stack>
      </Container>
    </Section>
  );
}
