"use client";

/**
 * /search  — Site-wide search results page
 *
 * URL contract:
 *   ?q=query         — the search term (set by the header SearchBar)
 *   ?type=pages,...  — comma-separated scope filter (optional)
 *
 * Layout (like Weijmens / Brons / De Beer examples):
 *   ┌─ Hero (subtle bg) ──────────────────────────────────────────────┐
 *   │  "N resultaten voor 'query'"                                     │
 *   │  [Search input ______________________________________] [Zoeken]  │
 *   └──────────────────────────────────────────────────────────────────┘
 *   ┌─ Content ────────────────────────────────────────────────────────┐
 *   │  [Filters 1/4]  │  [Results 3/4]                                │
 *   │   Type           │   Title                              [→]     │
 *   │   ☐ Pagina's     │   Excerpt text…                             │
 *   │   ☐ Vacatures    │   ─────────────────────────────────────────  │
 *   │   ☐ Artikelen    │   Title                              [→]     │
 *   └──────────────────────────────────────────────────────────────────┘
 */

import {
  Suspense,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type FormEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { SearchResult, SearchResponse } from "@/search";

// ── Result grouping ───────────────────────────────────────────────────────────
//
// The "Type" filter sidebar is built dynamically from the result set.
// Results are grouped by their source collection (result.collection — set by
// the Statamic provider and Meilisearch index from the CMS-configured
// searchable collections), so every collection automatically gets its own
// filter checkbox with the collection's CMS title as label.
//
// Providers that don't supply collection info fall back to grouping by the
// generic content type with a static label.

const TYPE_FALLBACK_LABELS: Record<string, string> = {
  page:    "Pagina's",
  post:    "Artikelen",
  vacancy: "Vacatures",
};

function resultGroupKey(r: SearchResult): string {
  return r.collection ?? r.type;
}

function resultGroupLabel(r: SearchResult): string {
  return r.collectionLabel ?? TYPE_FALLBACK_LABELS[r.type] ?? r.type;
}

// ── API helper ────────────────────────────────────────────────────────────────
//
// All scopes are always queried — type filtering happens client-side on the
// result set, grouped per collection (see Result grouping above).

async function runSearch(query: string): Promise<SearchResponse> {
  const res = await fetch("/api/search", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      query,
      limit:  50,
      offset: 0,
    }),
  });
  if (!res.ok) throw new Error("Search failed");
  return res.json() as Promise<SearchResponse>;
}

// ── Highlight helper ──────────────────────────────────────────────────────────

/**
 * Wraps occurrences of `term` in `text` with <mark> tags.
 * Simple case-insensitive highlight — providers may return richer snippets via
 * result.highlights, but this is a reliable fallback.
 */
function highlight(text: string, term: string): string {
  if (!term.trim()) return text;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`(${escaped})`, "gi"), "<mark>$1</mark>");
}

// ── Arrow icon ────────────────────────────────────────────────────────────────

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      style={{ width: 18, height: 18 }}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 10h12M10 4l6 6-6 6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      style={{ width: 20, height: 20, flexShrink: 0 }}
    >
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path strokeLinecap="round" d="m13.5 13.5 3.5 3.5" />
    </svg>
  );
}

// ── Result row ────────────────────────────────────────────────────────────────

function ResultRow({ result, query }: { result: SearchResult; query: string }) {
  // Use provider highlight snippet if available, else compute our own
  const excerptHighlight = result.highlights?.find(
    (h) => h.field === "excerpt" || h.field === "body",
  );
  const titleHighlight = result.highlights?.find((h) => h.field === "title");
  const titleHtml  = titleHighlight?.snippet ?? highlight(result.title, query);
  const excerptHtml =
    excerptHighlight?.snippet ??
    (result.excerpt ? highlight(result.excerpt, query) : "");

  return (
    <a
      href={result.slug}
      style={{
        display:        "flex",
        alignItems:     "center",
        gap:            "1rem",
        padding:        "1.25rem 1.5rem",
        background:     "var(--bg, #fff)",
        border:         "1px solid var(--card-border, #e5e7eb)",
        borderRadius:   "var(--radius-md, 0.5rem)",
        textDecoration: "none",
        color:          "inherit",
        transition:     "box-shadow 0.15s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.boxShadow =
          "0 4px 16px rgba(0,0,0,0.1)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none";
      }}
    >
      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin:     0,
            fontWeight: 700,
            fontSize:   "1rem",
            color:      "var(--text, #111)",
            fontFamily: "var(--font-heading, inherit)",
          }}
          dangerouslySetInnerHTML={{ __html: titleHtml }}
        />
        {excerptHtml && (
          <p
            style={{
              margin:          "0.35rem 0 0",
              fontSize:        "0.875rem",
              color:           "var(--text-muted, #6b7280)",
              lineHeight:      1.55,
              display:         "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 3,
              overflow:        "hidden",
            }}
            dangerouslySetInnerHTML={{ __html: excerptHtml }}
          />
        )}
      </div>

      {/* Arrow button */}
      <div
        style={{
          flexShrink:    0,
          width:         40,
          height:        40,
          borderRadius:  "var(--radius-sm, 0.375rem)",
          background:    "var(--primary-subtle, var(--bg-subtle, #f0f4ff))",
          color:         "var(--primary, #2563eb)",
          display:       "flex",
          alignItems:    "center",
          justifyContent:"center",
        }}
      >
        <ArrowIcon />
      </div>
    </a>
  );
}

// ── Filter sidebar ────────────────────────────────────────────────────────────

interface FilterGroup {
  key:   string;
  label: string;
  count: number;
}

interface FilterSidebarProps {
  groups:     FilterGroup[];
  activeKeys: string[];
  onToggle:   (key: string) => void;
}

function FilterSidebar({ groups, activeKeys, onToggle }: FilterSidebarProps) {
  return (
    <aside>
      <p
        style={{
          margin:       "0 0 0.875rem",
          fontWeight:   700,
          fontSize:     "0.9375rem",
          color:        "var(--text, #111)",
          fontFamily:   "var(--font-heading, inherit)",
        }}
      >
        Type
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {groups.map(({ key, label, count }) => {
          const active = activeKeys.includes(key);
          return (
            <label
              key={key}
              style={{
                display:    "flex",
                alignItems: "center",
                gap:        "0.625rem",
                cursor:     "pointer",
                fontSize:   "0.9375rem",
                color:      active ? "var(--text, #111)" : "var(--text-muted, #6b7280)",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() => onToggle(key)}
                style={{
                  accentColor: "var(--primary, #2563eb)",
                  width:       16,
                  height:      16,
                  flexShrink:  0,
                }}
              />
              {label}
              <span style={{ marginLeft: "auto", color: "var(--text-muted, #6b7280)", fontSize: "0.8125rem" }}>
                ({count})
              </span>
            </label>
          );
        })}
      </div>
    </aside>
  );
}

// ── Inner page (reads searchParams) ──────────────────────────────────────────

function SearchPageInner() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const initialQuery = searchParams.get("q") ?? "";

  const [inputValue, setInputValue] = useState(initialQuery);
  // Active filter keys (collection handles / fallback types).
  // null = all groups active (the default — also after every new search).
  const [activeKeys, setActiveKeys] = useState<string[] | null>(null);
  const [results,   setResults]   = useState<SearchResult[]>([]);
  const [status,    setStatus]    = useState<"idle" | "loading" | "success" | "error">("idle");
  const [lastQuery, setLastQuery] = useState("");

  // Sync input when URL ?q changes (e.g. navigating from header bar)
  useEffect(() => {
    setInputValue(initialQuery);
  }, [initialQuery]);

  // Guards the URL-driven fetch effect below against re-fetching a query that
  // doSearch() just fetched (its router.replace() re-triggers the effect).
  const lastFetchedQuery = useRef("");

  const doSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    lastFetchedQuery.current = trimmed;
    setStatus("loading");
    setLastQuery(trimmed);
    setActiveKeys(null); // new query → reset filters to "all"
    try {
      const resp = await runSearch(trimmed);
      setResults([...resp.results]);
      setStatus("success");
      // Update URL without push (replaceState) so Back works naturally
      const params = new URLSearchParams();
      params.set("q", trimmed);
      router.replace(`/search?${params.toString()}`, { scroll: false });
    } catch {
      setStatus("error");
      setResults([]);
    }
  }, [router]);

  // Fetch whenever the URL ?q changes — covers both the initial page load AND
  // follow-up searches from the header search bar while already on /search.
  useEffect(() => {
    const q = initialQuery.trim();
    if (!q || q === lastFetchedQuery.current) return;
    doSearch(q);
  }, [initialQuery, doSearch]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    doSearch(inputValue);
  }

  // ── Dynamic filter groups ──────────────────────────────────────────────────
  // Derived from the result set: one group per source collection (or fallback
  // type).  Only groups with ≥1 result are shown.
  const groups: FilterGroup[] = useMemo(() => {
    const map = new Map<string, FilterGroup>();
    for (const r of results) {
      const key = resultGroupKey(r);
      const existing = map.get(key);
      if (existing) {
        existing.count++;
      } else {
        map.set(key, { key, label: resultGroupLabel(r), count: 1 });
      }
    }
    return [...map.values()];
  }, [results]);

  const effectiveActiveKeys = activeKeys ?? groups.map((g) => g.key);

  function toggleKey(key: string) {
    const allKeys = groups.map((g) => g.key);
    const current = activeKeys ?? allKeys;
    const next = current.includes(key)
      ? current.length > 1
        ? current.filter((k) => k !== key)
        : current // keep at least one
      : [...current, key];
    setActiveKeys(next.length === allKeys.length ? null : next);
  }

  // Filter displayed results by active group keys (client-side)
  const displayed = results.filter((r) =>
    effectiveActiveKeys.includes(resultGroupKey(r)),
  );

  const hasQuery = Boolean(lastQuery || initialQuery);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, #fff)" }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          // Page-level hero surface: its headline uses --text, so it pairs with the
          // page subtle background — not --header-topband-bg, which is the header's
          // section-tabs band (paired with the header foreground) and may be pinned
          // to a dark header colour that would go dark-on-dark with --text here.
          background: "var(--bg-subtle, #f0f4f8)",
          borderBottom: "1px solid var(--border, #e5e7eb)",
          padding: "2.5rem 1rem 2rem",
        }}
      >
        <div style={{ maxWidth: "56rem", margin: "0 auto" }}>
          {/* Result count headline */}
          <h1
            style={{
              margin:     "0 0 1.25rem",
              fontSize:   "clamp(1.25rem, 2.5vw, 1.625rem)",
              fontWeight: 700,
              fontFamily: "var(--font-heading, inherit)",
              color:      "var(--text, #111)",
            }}
          >
            {status === "success"
              ? `${displayed.length} ${displayed.length === 1 ? "resultaat" : "resultaten"} voor '${lastQuery}'`
              : status === "loading"
                ? "Zoeken…"
                : hasQuery
                  ? `Zoeken naar '${initialQuery}'`
                  : "Zoeken"}
          </h1>

          {/* Search bar */}
          <form
            role="search"
            onSubmit={handleSubmit}
            style={{ display: "flex", gap: "0.625rem" }}
          >
            <div
              style={{
                flex:         1,
                display:      "flex",
                alignItems:   "center",
                gap:          "0.625rem",
                background:   "var(--bg, #fff)",
                border:       "1.5px solid var(--border, #d1d5db)",
                borderRadius: "var(--radius-md, 0.5rem)",
                padding:      "0 1rem",
              }}
            >
              <SearchIcon />
              <input
                type="search"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Zoek op de site…"
                autoFocus={!initialQuery}
                autoComplete="off"
                style={{
                  flex:       1,
                  border:     "none",
                  outline:    "none",
                  background: "transparent",
                  padding:    "0.75rem 0",
                  fontSize:   "1rem",
                  color:      "var(--text, #111)",
                }}
              />
              {inputValue && (
                <button
                  type="button"
                  aria-label="Wis zoekopdracht"
                  onClick={() => { setInputValue(""); setResults([]); setStatus("idle"); setLastQuery(""); }}
                  style={{
                    background: "none",
                    border:     "none",
                    cursor:     "pointer",
                    padding:    "0.25rem",
                    color:      "var(--text-muted, #9ca3af)",
                    fontSize:   "1.25rem",
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={!inputValue.trim() || status === "loading"}
              style={{
                padding:      "0 1.5rem",
                background:   "var(--primary, #2563eb)",
                color:        "#fff",
                border:       "none",
                borderRadius: "var(--radius-md, 0.5rem)",
                fontSize:     "0.9375rem",
                fontWeight:   600,
                cursor:       !inputValue.trim() ? "default" : "pointer",
                opacity:      !inputValue.trim() ? 0.6 : 1,
                whiteSpace:   "nowrap",
                transition:   "opacity 0.15s",
              }}
            >
              {status === "loading" ? "Zoeken…" : "Zoeken"}
            </button>
          </form>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      {(status === "success" || status === "loading") && (
        <div
          style={{
            maxWidth: "72rem",
            margin:   "0 auto",
            padding:  "2.5rem 1rem",
            display:  "grid",
            gridTemplateColumns: "200px 1fr",
            gap:      "3rem",
            alignItems: "start",
          }}
        >
          {/* Left: filters */}
          {status === "success" && (
            <FilterSidebar
              groups={groups}
              activeKeys={effectiveActiveKeys}
              onToggle={toggleKey}
            />
          )}
          {status === "loading" && (
            <div />
          )}

          {/* Right: results */}
          <div>
            {status === "loading" ? (
              <div
                style={{
                  display:        "flex",
                  flexDirection:  "column",
                  gap:            "0.75rem",
                }}
              >
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      height:       80,
                      borderRadius: "var(--radius-md, 0.5rem)",
                      background:   "var(--bg-subtle, #f3f4f6)",
                      animation:    "pulse 1.5s ease infinite",
                    }}
                  />
                ))}
              </div>
            ) : displayed.length === 0 ? (
              <div
                style={{
                  padding:      "3rem",
                  textAlign:    "center",
                  color:        "var(--text-muted, #6b7280)",
                  background:   "var(--bg-subtle, #f9fafb)",
                  borderRadius: "var(--radius-md, 0.5rem)",
                  border:       "1px dashed var(--border, #e5e7eb)",
                }}
              >
                <p style={{ margin: 0, fontSize: "0.9375rem" }}>
                  Geen resultaten gevonden voor &apos;{lastQuery}&apos;. Probeer een andere zoekopdracht.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {displayed.map((result) => (
                  <ResultRow key={result.id} result={result} query={lastQuery} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Idle state — no search yet */}
      {status === "idle" && !initialQuery && (
        <div
          style={{
            maxWidth: "40rem",
            margin:   "4rem auto",
            padding:  "0 1rem",
            textAlign:"center",
            color:    "var(--text-muted, #6b7280)",
          }}
        >
          <p>Typ een zoekterm en druk op Zoeken.</p>
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <div
          style={{
            maxWidth: "40rem",
            margin:   "4rem auto",
            padding:  "0 1rem",
            textAlign:"center",
            color:    "var(--color-error, #dc2626)",
          }}
        >
          <p>Er is iets misgegaan. Probeer het opnieuw.</p>
        </div>
      )}
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight:   "100vh",
            background:  "var(--bg-subtle, #f0f4f8)",
            display:     "flex",
            alignItems:  "center",
            justifyContent: "center",
            color:       "var(--text-muted, #6b7280)",
          }}
        >
          Zoeken…
        </div>
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}
