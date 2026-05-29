/**
 * SearchResultsBlock
 *
 * Renders a `searchResults` content block — a filterable result set typically
 * paired with a FilterBarBlock on the same page.
 *
 * ─── Communication pattern ────────────────────────────────────────────────────
 *
 *   FilterBarBlock  → writes URL params (q, category, tag, sort)
 *   SearchResultsBlock ← reads URL params on every render
 *
 *   On each URL param change, `FilterBarBlock.router.replace()` triggers a
 *   re-render of the page.  `SearchResultsBlock` re-reads the params and
 *   re-filters `data.items` — no additional state management needed.
 *
 * ─── Progressive enhancement ─────────────────────────────────────────────────
 *
 *   The Suspense fallback renders all server-provided items unfiltered.
 *   This means:
 *     1. The page renders correctly on initial load and without JavaScript.
 *     2. After hydration, the inner component takes over and applies filters.
 *
 * ─── Item filtering ───────────────────────────────────────────────────────────
 *
 *   Filtering runs client-side over the `data.items` array.  All items are
 *   provided by the CMS in the initial page payload.  This approach suits
 *   small-to-medium listing pages (< ~500 items).  Server-side filtering
 *   (API fetch on param change) can be layered on later without changing
 *   the component contract.
 *
 *   Active URL params:
 *     q         — text search against item.title and item.excerpt
 *     category  — exact match against item.category
 *     tag       — membership check against item.tags[]
 *     sort      — "date-asc" | "date-desc" | "title-asc" | "title-desc"
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      SearchResultsBlockData  { heading?, emptyMessage?, itemsPerPage?,
 *                                       items?, enableSearch?, enableFilter? }
 *   variant   SearchResultsVariant    "grid" | "list"
 *
 * ─── Design tokens consumed ───────────────────────────────────────────────────
 *
 *   --text / --text-muted
 *   --bg-subtle
 *   --primary
 *   --font-heading / --font-heading-weight
 *   (card tokens delegated to ResultCard)
 */

"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams }   from "next/navigation";
import { Container }           from "@/components/primitives/Container";
import { Section }             from "@/components/primitives/Section";
import { Grid }                from "@/components/primitives/Grid";
import { Stack }               from "@/components/primitives/Stack";
import { Text }                from "@/components/primitives/Text";
import { Pagination }          from "@/components/molecules";
import { resolveBlockVariant } from "@/page-config/block-variants";
import type { SearchResultsVariant } from "@/page-config/block-variants";
import type { SearchResultsBlockData, ListingItem } from "@/page-config";
import { ResultCard } from "@/components/blocks/listing/ResultCard";

// ── Props ─────────────────────────────────────────────────────────────────────

interface SearchResultsBlockProps {
  data:     SearchResultsBlockData;
  variant?: string;
}

// ── Filtering ─────────────────────────────────────────────────────────────────

/**
 * Applies the active URL-param filters to the item array.
 *
 * All filtering runs on the client over the server-provided items.
 * Unknown sort keys leave the order unchanged (stable sort).
 */
function applyFilters(
  items:    readonly ListingItem[],
  query:    string,
  category: string,
  tag:      string,
  sort:     string,
): ListingItem[] {
  let result = [...items];

  // ── Text search ─────────────────────────────────────────────────────────────
  if (query.trim()) {
    const q = query.toLowerCase().trim();
    result = result.filter((item) => {
      const inTitle   = item.title.toLowerCase().includes(q);
      const inExcerpt = item.excerpt?.toLowerCase().includes(q) ?? false;
      const inMeta    = item.meta?.some(
        (m) => m.value.toLowerCase().includes(q) || m.label.toLowerCase().includes(q)
      ) ?? false;
      return inTitle || inExcerpt || inMeta;
    });
  }

  // ── Category filter ─────────────────────────────────────────────────────────
  if (category) {
    result = result.filter((item) => item.category === category);
  }

  // ── Tag filter ──────────────────────────────────────────────────────────────
  if (tag) {
    result = result.filter((item) => item.tags?.includes(tag) ?? false);
  }

  // ── Sort ────────────────────────────────────────────────────────────────────
  switch (sort) {
    case "date-asc":
      result.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
      break;
    case "date-desc":
      result.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
      break;
    case "title-asc":
      result.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "title-desc":
      result.sort((a, b) => b.title.localeCompare(a.title));
      break;
    // Unknown or empty sort key → leave original order
  }

  return result;
}

// ── Fallback (SSR / pre-hydration) ────────────────────────────────────────────

function SearchResultsFallback({
  data,
  variant,
}: {
  data: SearchResultsBlockData;
  variant: SearchResultsVariant;
}) {
  const items = data.items ?? [];
  return (
    <ResultsLayout
      heading={data.heading}
      items={items}
      totalCount={items.length}
      variant={variant}
      emptyMessage={data.emptyMessage}
      isFiltered={false}
      paginate={false}
    />
  );
}

// ── Inner (interactive, reads searchParams) ───────────────────────────────────

function SearchResultsInner({
  data,
  variant,
}: {
  data: SearchResultsBlockData;
  variant: SearchResultsVariant;
}) {
  const searchParams = useSearchParams();

  const query    = searchParams.get("q")        ?? "";
  const category = searchParams.get("category") ?? "";
  const tag      = searchParams.get("tag")      ?? "";
  const sort     = searchParams.get("sort")     ?? "";
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const allItems    = data.items ?? [];
  const perPage     = data.itemsPerPage ?? 0; // 0 = no pagination

  const isFiltered = Boolean(
    data.enableSearch && query ||
    data.enableFilter && (category || tag || sort),
  );

  // Only apply filters when the block opts in via enableSearch / enableFilter
  const filtered = useMemo(() => {
    if (!isFiltered) return allItems;
    return applyFilters(
      allItems,
      data.enableSearch ? query    : "",
      data.enableFilter ? category : "",
      data.enableFilter ? tag      : "",
      data.enableFilter ? sort     : "",
    );
  }, [allItems, isFiltered, query, category, tag, sort, data.enableSearch, data.enableFilter]);

  // Pagination — only applied when itemsPerPage > 0
  const totalPages  = perPage > 0 ? Math.ceil(filtered.length / perPage) : 1;
  const currentPage = Math.min(page, Math.max(1, totalPages));
  const paged       = perPage > 0
    ? filtered.slice((currentPage - 1) * perPage, currentPage * perPage)
    : filtered;

  return (
    <ResultsLayout
      heading={data.heading}
      items={paged}
      totalCount={allItems.length}
      filteredCount={filtered.length}
      variant={variant}
      emptyMessage={data.emptyMessage}
      isFiltered={isFiltered}
      totalPages={totalPages}
      paginate={totalPages > 1}
    />
  );
}

// ── ResultsLayout ─────────────────────────────────────────────────────────────

interface ResultsLayoutProps {
  heading?:       string;
  items:          readonly ListingItem[] | ListingItem[];
  totalCount:     number;
  filteredCount?: number;
  variant:        SearchResultsVariant;
  emptyMessage?:  string;
  isFiltered:     boolean;
  totalPages?:    number;
  /**
   * When true, renders the Pagination molecule at the bottom.
   * Must NOT be set to true in the SSR fallback since Pagination calls
   * useSearchParams() which requires a Suspense boundary.
   */
  paginate?:      boolean;
}

function ResultsLayout({
  heading,
  items,
  totalCount,
  filteredCount,
  variant,
  emptyMessage = "No results found. Try adjusting your search or filters.",
  isFiltered,
  totalPages = 1,
  paginate = false,
}: ResultsLayoutProps) {
  const displayCount = filteredCount ?? items.length;

  return (
    <Section spacing="lg" style={{ background: "var(--bg)" }}>
      <Container size="xl">
        <Stack gap={8}>

          {/* Heading + result count */}
          {(heading || isFiltered) && (
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              {heading && (
                <Text
                  variant="h2"
                  style={{
                    color:      "var(--text)",
                    fontFamily: "var(--font-heading)",
                    fontWeight: "var(--font-heading-weight)",
                  }}
                >
                  {heading}
                </Text>
              )}
              {isFiltered && (
                <p
                  aria-live="polite"
                  aria-atomic="true"
                  style={{ fontSize: "0.875rem", color: "var(--text-muted)", margin: 0 }}
                >
                  {displayCount === totalCount
                    ? `${totalCount} ${totalCount === 1 ? "result" : "results"}`
                    : `${displayCount} of ${totalCount} ${totalCount === 1 ? "result" : "results"}`}
                </p>
              )}
            </div>
          )}

          {/* Empty state */}
          {items.length === 0 ? (
            <div
              style={{
                textAlign:       "center",
                padding:         "4rem 1rem",
                color:           "var(--text-muted)",
                backgroundColor: "var(--bg-subtle)",
                borderRadius:    "var(--card-radius)",
                border:          "1px dashed var(--card-border)",
              }}
              aria-live="polite"
            >
              <p style={{ margin: 0, fontSize: "0.9375rem" }}>{emptyMessage}</p>
            </div>
          ) : variant === "grid" ? (
            <Grid cols={3} gap="lg">
              {(items as ListingItem[]).map((item) => (
                <ResultCard key={item.id} item={item} layout="card" headingLevel={3} />
              ))}
            </Grid>
          ) : (
            <Stack gap={4}>
              {(items as ListingItem[]).map((item) => (
                <ResultCard key={item.id} item={item} layout="row" headingLevel={3} />
              ))}
            </Stack>
          )}

          {/* Pagination — only in the interactive inner (not the SSR fallback) */}
          {paginate && totalPages > 1 && (
            <Pagination totalPages={totalPages} />
          )}

        </Stack>
      </Container>
    </Section>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export function SearchResultsBlock({ data, variant: rawVariant }: SearchResultsBlockProps) {
  const variant = resolveBlockVariant("searchResults", rawVariant) as SearchResultsVariant;

  return (
    <Suspense fallback={<SearchResultsFallback data={data} variant={variant} />}>
      <SearchResultsInner data={data} variant={variant} />
    </Suspense>
  );
}
