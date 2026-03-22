/**
 * FilterBarBlock
 *
 * Renders a `filterBar` content block — an interactive search and filter bar
 * for listing pages.  Publishes filter state to URL search params so that any
 * SearchResultsBlock on the same page can read and react to changes without
 * a shared React context or prop-drilling.
 *
 * ─── Communication pattern ────────────────────────────────────────────────────
 *
 *   FilterBarBlock  → writes URL params (q, category, tag, sort)
 *   SearchResultsBlock ← reads URL params on every render
 *
 *   URL params are the shared contract.  This keeps both blocks independent —
 *   they can appear in any order in the block array and require no wiring.
 *   Filter state is also shareable (bookmarkable, shareable URLs).
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   data      FilterBarBlockData    { placeholder?, categories?, tags?,
 *                                     sortOptions?, showSearch?, showCategoryFilter?,
 *                                     showTagFilter? }
 *   variant   FilterBarVariant      see below
 *
 * ─── Variants ────────────────────────────────────────────────────────────────
 *
 *   default   — Full-width bar with labelled search input and dropdown filters.
 *   compact   — Condensed bar; labels hidden, placeholder text only.
 *   expanded  — Same as default; extended for future explicit expand state.
 *
 * ─── Progressive enhancement ─────────────────────────────────────────────────
 *
 *   The Suspense fallback renders a static (non-interactive) version of the
 *   bar during SSR and before hydration.  Filtering requires JavaScript.
 *
 * ─── Design tokens consumed ───────────────────────────────────────────────────
 *
 *   --form-input-bg / --form-input-border / --form-input-text
 *   --form-input-radius / --form-input-focus-ring / --form-input-placeholder
 *   --bg / --bg-subtle
 *   --card-border
 *   --text / --text-muted
 *   --btn-bg / --btn-text / --btn-hover-bg / --btn-radius
 *   --transition-base
 */

"use client";

import { Suspense, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Container }           from "@/components/primitives/Container";
import { resolveBlockVariant } from "@/page-config/block-variants";
import type { FilterBarVariant } from "@/page-config/block-variants";
import type { FilterBarBlockData } from "@/page-config";

// ── Props ─────────────────────────────────────────────────────────────────────

interface FilterBarBlockProps {
  data:     FilterBarBlockData;
  variant?: string;
}

// ── Fallback (SSR / pre-hydration) ────────────────────────────────────────────

function FilterBarFallback({
  data,
  variant,
}: {
  data: FilterBarBlockData;
  variant: FilterBarVariant;
}) {
  const showSearch   = data.showSearch !== false;
  const showCategory = data.showCategoryFilter !== false && (data.categories?.length ?? 0) > 0;
  const showTag      = data.showTagFilter      !== false && (data.tags?.length ?? 0) > 0;
  const showSort     = (data.sortOptions?.length ?? 0) > 0;
  const isCompact    = variant === "compact";

  return (
    <div style={barWrapStyle}>
      <Container size="xl">
        <div style={controlsRowStyle}>
          {showSearch && (
            <input
              type="search"
              placeholder={data.placeholder ?? "Search…"}
              disabled
              style={{ ...inputStyle(false), flexGrow: 1, minWidth: isCompact ? "8rem" : "12rem" }}
              aria-label="Search"
            />
          )}
          {showCategory && (
            <select disabled style={selectStyle(false)}>
              <option>All categories</option>
            </select>
          )}
          {showTag && (
            <select disabled style={selectStyle(false)}>
              <option>All tags</option>
            </select>
          )}
          {showSort && (
            <select disabled style={selectStyle(false)}>
              <option>{data.sortOptions![0]?.label ?? "Sort"}</option>
            </select>
          )}
        </div>
      </Container>
    </div>
  );
}

// ── Inner (interactive, needs searchParams) ───────────────────────────────────

function FilterBarInner({
  data,
  variant,
}: {
  data: FilterBarBlockData;
  variant: FilterBarVariant;
}) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  // URL param values — the source of truth for filter state
  const urlQuery    = searchParams.get("q") ?? "";
  const urlCategory = searchParams.get("category") ?? "";
  const urlTag      = searchParams.get("tag") ?? "";
  const urlSort     = searchParams.get("sort") ?? "";

  // Local controlled value for the search input (updated immediately for
  // responsiveness; URL param update is debounced to avoid navigation spam)
  const [searchValue, setSearchValue] = useState(urlQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSearch   = data.showSearch !== false;
  const showCategory = data.showCategoryFilter !== false && (data.categories?.length ?? 0) > 0;
  const showTag      = data.showTagFilter      !== false && (data.tags?.length ?? 0) > 0;
  const showSort     = (data.sortOptions?.length ?? 0) > 0;
  const isCompact    = variant === "compact";

  // ── URL param helpers ────────────────────────────────────────────────────────

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset to first page on filter change
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setParam("q", value), 320);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setParam("q", searchValue);
  }

  function handleClearAll() {
    setSearchValue("");
    router.replace(pathname, { scroll: false });
  }

  const hasActiveFilters =
    Boolean(urlQuery) || Boolean(urlCategory) || Boolean(urlTag) || Boolean(urlSort);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={barWrapStyle}>
      <Container size="xl">
        <form
          onSubmit={handleSearchSubmit}
          style={controlsRowStyle}
          role="search"
          aria-label="Filter results"
        >
          {/* Search input */}
          {showSearch && (
            <div style={{ position: "relative", flexGrow: 1, minWidth: isCompact ? "8rem" : "12rem" }}>
              {/* Search icon */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left:     "0.625rem",
                  top:      "50%",
                  transform: "translateY(-50%)",
                  color:    "var(--text-muted)",
                  pointerEvents: "none",
                }}
              >
                <circle cx="6.5" cy="6.5" r="4.5" />
                <path d="M11 11l3 3" />
              </svg>

              <input
                type="search"
                value={searchValue}
                onChange={handleSearchChange}
                placeholder={data.placeholder ?? "Search…"}
                aria-label="Search"
                style={{
                  ...inputStyle(false),
                  paddingLeft: "2rem",
                  width: "100%",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--form-input-focus-ring)";
                  e.currentTarget.style.boxShadow   =
                    "0 0 0 3px color-mix(in srgb, var(--form-input-focus-ring) 20%, transparent)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--form-input-border)";
                  e.currentTarget.style.boxShadow   = "none";
                }}
              />
            </div>
          )}

          {/* Category filter */}
          {showCategory && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              {!isCompact && (
                <label style={labelStyle}>Category</label>
              )}
              <select
                value={urlCategory}
                onChange={(e) => setParam("category", e.target.value)}
                aria-label="Filter by category"
                style={selectStyle(false)}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--form-input-focus-ring)"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--form-input-border)";     }}
              >
                <option value="">All categories</option>
                {data.categories!.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                    {cat.count !== undefined ? ` (${cat.count})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tag filter */}
          {showTag && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              {!isCompact && (
                <label style={labelStyle}>Tag</label>
              )}
              <select
                value={urlTag}
                onChange={(e) => setParam("tag", e.target.value)}
                aria-label="Filter by tag"
                style={selectStyle(false)}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--form-input-focus-ring)"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--form-input-border)";     }}
              >
                <option value="">All tags</option>
                {data.tags!.map((tag) => (
                  <option key={tag.value} value={tag.value}>
                    {tag.label}
                    {tag.count !== undefined ? ` (${tag.count})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sort */}
          {showSort && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              {!isCompact && (
                <label style={labelStyle}>Sort by</label>
              )}
              <select
                value={urlSort}
                onChange={(e) => setParam("sort", e.target.value)}
                aria-label="Sort results"
                style={selectStyle(false)}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--form-input-focus-ring)"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "var(--form-input-border)";     }}
              >
                {!urlSort && <option value="">Sort by</option>}
                {data.sortOptions!.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Clear all — only shown when filters are active */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearAll}
              style={{
                display:         "inline-flex",
                alignItems:      "center",
                gap:             "0.25rem",
                fontSize:        "0.8125rem",
                fontWeight:      500,
                color:           "var(--text-muted)",
                background:      "transparent",
                border:          "1px solid var(--card-border)",
                borderRadius:    "var(--btn-radius)",
                padding:         "0.4375rem 0.75rem",
                cursor:          "pointer",
                whiteSpace:      "nowrap",
                transition:      `color var(--transition-base), border-color var(--transition-base)`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--text-muted)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--card-border)";
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M2 2l8 8M10 2L2 10" />
              </svg>
              Clear
            </button>
          )}
        </form>
      </Container>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export function FilterBarBlock({ data, variant: rawVariant }: FilterBarBlockProps) {
  const variant = resolveBlockVariant("filterBar", rawVariant) as FilterBarVariant;

  return (
    <Suspense fallback={<FilterBarFallback data={data} variant={variant} />}>
      <FilterBarInner data={data} variant={variant} />
    </Suspense>
  );
}

// ── Shared style helpers ──────────────────────────────────────────────────────

const barWrapStyle: React.CSSProperties = {
  paddingTop:    "1rem",
  paddingBottom: "1rem",
  borderBottom:  "1px solid var(--card-border)",
  background:    "var(--bg)",
};

const controlsRowStyle: React.CSSProperties = {
  display:    "flex",
  alignItems: "flex-end",
  flexWrap:   "wrap",
  gap:        "0.75rem",
};

function inputStyle(_focused: boolean): React.CSSProperties {
  return {
    appearance:      "none",
    display:         "block",
    padding:         "0.4375rem 0.75rem",
    backgroundColor: "var(--form-input-bg)",
    border:          "1px solid var(--form-input-border)",
    borderRadius:    "var(--form-input-radius)",
    color:           "var(--form-input-text)",
    fontSize:        "0.875rem",
    lineHeight:      "1.5",
    outline:         "none",
    transition:      "border-color var(--transition-base), box-shadow var(--transition-base)",
  };
}

function selectStyle(_focused: boolean): React.CSSProperties {
  return {
    ...inputStyle(_focused),
    paddingRight: "2rem",
    // Minimal native select arrow via background image
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none' stroke='%23999' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1 1l4 4 4-4'/%3E%3C/svg%3E")`,
    backgroundRepeat:   "no-repeat",
    backgroundPosition: "right 0.6rem center",
    backgroundSize:     "10px",
    cursor:             "pointer",
    minWidth:           "9rem",
  };
}

const labelStyle: React.CSSProperties = {
  fontSize:   "0.75rem",
  fontWeight: 500,
  color:      "var(--text-muted)",
  lineHeight: 1,
};
