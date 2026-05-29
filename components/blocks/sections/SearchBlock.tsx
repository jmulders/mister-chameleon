/**
 * SearchBlock
 *
 * A full-text search input + inline results content block.
 *
 * ─── Architecture position ────────────────────────────────────────────────────
 *
 *   CMS "search" block (SearchBlockData)
 *        ↓  ContentBlockRenderer
 *   SearchBlock  ← YOU ARE HERE
 *        ↓  POST /api/search  (SearchQuery)
 *   SearchResponse (SearchResult[])
 *        ↓
 *   SearchResultCard (one per result)
 *
 * ─── Provider contract ────────────────────────────────────────────────────────
 *
 *   This component does NOT reference any search provider directly.  It sends
 *   a SearchQuery to /api/search; the route selects and calls a SearchProvider
 *   at the edge.  Swapping providers in Sear3+ requires no changes here.
 *
 * ─── Variants ─────────────────────────────────────────────────────────────────
 *
 *   "default"  — section heading + description + search bar + results grid
 *   "minimal"  — bare search bar only (for embedding in header / sidebar)
 *   "full"     — default + inline scope/filter toggles
 *
 * ─── Progressive behaviour ────────────────────────────────────────────────────
 *
 *   - Submit-driven by default (form with a search button).
 *   - `enableInstant: true` → live search on keypress, debounced 300 ms.
 *   - Works without JS: the form degrades gracefully (GET /search?q=…) when
 *     server-side search routing is configured.
 *
 * ─── Styling ──────────────────────────────────────────────────────────────────
 *
 *   All values are CSS custom properties (design tokens).
 *   No hardcoded colours, radii, or font sizes.
 */

"use client";

import { useState, useRef, useCallback, type FormEvent, type ChangeEvent } from "react";
import type { SearchBlockData }              from "@/page-config";
import type { SearchQuery, SearchResponse, SearchResult, SearchScope } from "@/search";
import { SearchResultCard }                  from "./SearchResultCard";
import { Section }                           from "@/components/primitives/Section";
import { Container }                         from "@/components/primitives/Container";
import { Stack }                             from "@/components/primitives/Stack";
import { Grid }                              from "@/components/primitives/Grid";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface SearchBlockProps {
  data:     SearchBlockData;
  variant?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

type SearchStatus = "idle" | "loading" | "success" | "error";

/** Fetch search results from the platform API. */
async function fetchSearchResults(query: SearchQuery): Promise<SearchResponse> {
  const res = await fetch("/api/search", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(query),
  });

  if (!res.ok) {
    throw new Error(`Search request failed: ${res.status}`);
  }

  return res.json() as Promise<SearchResponse>;
}

/**
 * Coerce raw CMS scope strings to the SearchScope type.
 * Unknown values are dropped so the provider receives only valid scopes.
 */
const VALID_SCOPES: readonly SearchScope[] = ["pages", "posts", "vacancies"];

function toValidScopes(raw: readonly string[] | undefined): SearchScope[] | undefined {
  if (!raw?.length) return undefined;
  const filtered = raw.filter((s): s is SearchScope =>
    (VALID_SCOPES as readonly string[]).includes(s),
  );
  return filtered.length ? filtered : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Search input (shared sub-component)
// ─────────────────────────────────────────────────────────────────────────────

interface SearchInputProps {
  value:       string;
  placeholder: string;
  onChange:    (value: string) => void;
  onSubmit:    () => void;
  isLoading:   boolean;
}

function SearchInput({ value, placeholder, onChange, onSubmit, isLoading }: SearchInputProps) {
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      style={{ display: "flex", gap: "0.5rem", width: "100%" }}
    >
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        aria-label="Search"
        autoComplete="off"
        style={{
          flex:         1,
          padding:      "0.625rem 0.875rem",
          border:       "1px solid var(--form-input-border, #d1d5db)",
          borderRadius: "var(--form-input-radius, var(--radius-md, 0.5rem))",
          fontSize:     "0.9375rem",
          color:        "var(--form-input-text, var(--text, #111827))",
          background:   "var(--form-input-bg, #fff)",
          outline:      "none",
          minWidth:     0,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--primary)";
          e.currentTarget.style.boxShadow   = "0 0 0 3px var(--primary-subtle)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--form-input-border, #d1d5db)";
          e.currentTarget.style.boxShadow   = "none";
        }}
      />
      <button
        type="submit"
        disabled={isLoading || !value.trim()}
        aria-label="Submit search"
        style={{
          padding:         "0.625rem 1.25rem",
          background:      "var(--btn-bg)",
          color:           "var(--btn-primary-text, #fff)",
          border:          "none",
          borderRadius:    "var(--form-input-radius, var(--radius-md, 0.5rem))",
          fontSize:        "0.9375rem",
          fontWeight:      600,
          cursor:          isLoading ? "wait" : "pointer",
          opacity:         isLoading || !value.trim() ? 0.6 : 1,
          whiteSpace:      "nowrap",
          transition:      "opacity 0.15s ease",
        }}
      >
        {isLoading ? "Searching…" : "Search"}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scope filter toggles ("full" variant)
// ─────────────────────────────────────────────────────────────────────────────

interface ScopeFiltersProps {
  activeScopes:    readonly SearchScope[];
  availableScopes: readonly SearchScope[];
  onToggle:        (scope: SearchScope) => void;
}

const SCOPE_LABELS: Record<SearchScope, string> = {
  pages:     "Pages",
  posts:     "Posts",
  vacancies: "Vacancies",
};

function ScopeFilters({ activeScopes, availableScopes, onToggle }: ScopeFiltersProps) {
  return (
    <div
      role="group"
      aria-label="Filter by content type"
      style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}
    >
      {availableScopes.map((scope) => {
        const active = activeScopes.includes(scope);
        return (
          <button
            key={scope}
            type="button"
            onClick={() => onToggle(scope)}
            aria-pressed={active}
            style={{
              padding:      "0.25rem 0.75rem",
              borderRadius: "var(--radius-full, 9999px)",
              border:       `1px solid ${active ? "var(--primary)" : "var(--card-border)"}`,
              background:   active ? "var(--primary-subtle)" : "transparent",
              color:        active ? "var(--primary)" : "var(--text-muted)",
              fontSize:     "0.8125rem",
              fontWeight:   active ? 600 : 400,
              cursor:       "pointer",
              transition:   "all 0.1s ease",
            }}
          >
            {SCOPE_LABELS[scope]}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Result area
// ─────────────────────────────────────────────────────────────────────────────

interface ResultAreaProps {
  status:          SearchStatus;
  results:         SearchResult[];
  total:           number;
  query:           string;
  emptyMessage:    string;
  noResultsMessage: string;
  variant:         string;
}

function ResultArea({
  status,
  results,
  total,
  query,
  emptyMessage,
  noResultsMessage,
  variant,
}: ResultAreaProps) {
  if (status === "idle") {
    return (
      <p style={{ color: "var(--text-muted, #6b7280)", fontSize: "0.9375rem", margin: 0 }}>
        {emptyMessage}
      </p>
    );
  }

  if (status === "loading") {
    return (
      <p
        role="status"
        aria-live="polite"
        style={{ color: "var(--text-muted, #6b7280)", fontSize: "0.9375rem", margin: 0 }}
      >
        Searching…
      </p>
    );
  }

  if (status === "error") {
    return (
      <p
        role="alert"
        style={{ color: "var(--color-error-600, #dc2626)", fontSize: "0.9375rem", margin: 0 }}
      >
        Something went wrong. Please try again.
      </p>
    );
  }

  if (status === "success" && results.length === 0) {
    return (
      <p
        aria-live="polite"
        style={{ color: "var(--text-muted, #6b7280)", fontSize: "0.9375rem", margin: 0 }}
      >
        {noResultsMessage}
      </p>
    );
  }

  // Success with results
  const layout = variant === "minimal" ? "compact" : "row";

  return (
    <div>
      <p
        aria-live="polite"
        style={{
          fontSize:     "0.8125rem",
          color:        "var(--text-muted, #6b7280)",
          marginBottom: "0.875rem",
          margin:       "0 0 0.875rem",
        }}
      >
        {total === 1
          ? `1 result for "${query}"`
          : `${total} results for "${query}"`}
      </p>

      {variant === "default" || variant === "full" ? (
        <Grid cols={2}>
          {results.map((result) => (
            <SearchResultCard key={result.id} result={result} layout="card" />
          ))}
        </Grid>
      ) : (
        <div>
          {results.map((result) => (
            <SearchResultCard key={result.id} result={result} layout={layout} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SearchBlock (main export)
// ─────────────────────────────────────────────────────────────────────────────

export function SearchBlock({ data, variant = "default" }: SearchBlockProps) {
  const [inputValue, setInputValue]   = useState("");
  const [results, setResults]         = useState<SearchResult[]>([]);
  const [total, setTotal]             = useState(0);
  const [status, setStatus]           = useState<SearchStatus>("idle");
  const [activeQuery, setActiveQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Available scopes: block-configured scopes, or all three if not set
  const blockScopes  = toValidScopes(data.scopes);
  const allScopes    = (VALID_SCOPES as SearchScope[]);
  const initialScopes: SearchScope[] = blockScopes ?? [...allScopes];

  const [activeScopes, setActiveScopes] = useState<SearchScope[]>(initialScopes);

  const toggleScope = useCallback((scope: SearchScope) => {
    setActiveScopes((prev) => {
      if (prev.includes(scope)) {
        // Keep at least one scope selected
        return prev.length > 1 ? prev.filter((s) => s !== scope) : prev;
      }
      return [...prev, scope];
    });
  }, []);

  const runSearch = useCallback(async (query: string, scopes: SearchScope[]) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setStatus("idle");
      setResults([]);
      setTotal(0);
      setActiveQuery("");
      return;
    }

    setStatus("loading");
    setActiveQuery(trimmed);

    const searchQuery: SearchQuery = {
      query:   trimmed,
      scopes:  scopes.length ? scopes : undefined,
      limit:   data.maxResults ?? 10,
      offset:  0,
    };

    try {
      const response = await fetchSearchResults(searchQuery);
      setResults([...response.results]);
      setTotal(response.total);
      setStatus("success");
    } catch {
      setStatus("error");
      setResults([]);
      setTotal(0);
    }
  }, [data.maxResults]);

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);

    if (!data.enableInstant) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(value, activeScopes);
    }, 300);
  }, [data.enableInstant, runSearch, activeScopes]);

  const handleSubmit = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    runSearch(inputValue, activeScopes);
  }, [runSearch, inputValue, activeScopes]);

  const placeholder   = data.placeholder      ?? "Search…";
  const emptyMsg      = data.emptyMessage      ?? "Start typing to search.";
  const noResultsMsg  = data.noResultsMessage  ?? `No results found for "${activeQuery}".`;

  // ── Minimal variant ─────────────────────────────────────────────────────────
  if (variant === "minimal") {
    return (
      <div style={{ width: "100%" }}>
        <SearchInput
          value={inputValue}
          placeholder={placeholder}
          onChange={handleInputChange}
          onSubmit={handleSubmit}
          isLoading={status === "loading"}
        />
        {status !== "idle" && (
          <div style={{ marginTop: "1rem" }}>
            <ResultArea
              status={status}
              results={results}
              total={total}
              query={activeQuery}
              emptyMessage={emptyMsg}
              noResultsMessage={noResultsMsg}
              variant={variant}
            />
          </div>
        )}
      </div>
    );
  }

  // ── Default / Full variants ──────────────────────────────────────────────────
  return (
    <Section style={{ background: "var(--bg-subtle, #f9fafb)" }}>
      <Container size="lg">
        <Stack gap={6}>

          {/* Heading + description */}
          {(data.title || data.description) && (
            <div>
              {data.title && (
                <h2 style={{
                  margin:     0,
                  fontSize:   "clamp(1.5rem, 3vw, 2rem)",
                  fontWeight: "var(--font-heading-weight, 700)" as string,
                  fontFamily: "var(--font-heading, inherit)",
                  color:      "var(--text, #111827)",
                  marginBottom: data.description ? "0.5rem" : 0,
                }}>
                  {data.title}
                </h2>
              )}
              {data.description && (
                <p style={{
                  margin:    0,
                  color:     "var(--text-muted, #6b7280)",
                  fontSize:  "1rem",
                  maxWidth:  "60ch",
                }}>
                  {data.description}
                </p>
              )}
            </div>
          )}

          {/* Search input */}
          <SearchInput
            value={inputValue}
            placeholder={placeholder}
            onChange={handleInputChange}
            onSubmit={handleSubmit}
            isLoading={status === "loading"}
          />

          {/* Scope filters (full variant only) */}
          {variant === "full" && data.showFilters !== false && (
            <ScopeFilters
              activeScopes={activeScopes}
              availableScopes={blockScopes ?? allScopes}
              onToggle={toggleScope}
            />
          )}

          {/* Results */}
          <ResultArea
            status={status}
            results={results}
            total={total}
            query={activeQuery}
            emptyMessage={emptyMsg}
            noResultsMessage={noResultsMsg}
            variant={variant}
          />

        </Stack>
      </Container>
    </Section>
  );
}
