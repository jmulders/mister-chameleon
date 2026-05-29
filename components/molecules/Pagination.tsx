/**
 * Pagination
 *
 * URL-param-driven page number controls. Reads the `page` search param and
 * renders prev/next arrows plus numbered page buttons. Updates the URL via
 * router.replace so the page re-renders without a full navigation.
 *
 * Must be wrapped in <Suspense> when used in a Server Component tree
 * (because it calls useSearchParams).
 *
 * ─── Props ───────────────────────────────────────────────────────────────────
 *
 *   totalPages    number   Total page count. If ≤ 1, renders nothing.
 *   maxVisible    number   Max page buttons to show (default 5).
 *                          The first + last page are always visible; the rest
 *                          are a sliding window around the current page.
 *
 * ─── URL params ──────────────────────────────────────────────────────────────
 *
 *   page    1-based current page number (default 1 when absent).
 *
 * ─── Design tokens consumed ──────────────────────────────────────────────────
 *
 *   --primary               Active page button background
 *   --primary-foreground    Active page button text colour
 *   --card-bg               Inactive button background
 *   --card-border           Button border colour
 *   --card-radius           Button border-radius
 *   --text                  Button text colour
 *   --text-muted            Disabled arrow colour
 *   --transition-base       Hover transition
 */

"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface PaginationProps {
  totalPages:   number;
  maxVisible?:  number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Pagination({ totalPages, maxVisible = 5 }: PaginationProps) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const currentPage = Math.max(1, Math.min(
    parseInt(searchParams.get("page") ?? "1", 10) || 1,
    totalPages,
  ));

  if (totalPages <= 1) return null;

  // Build the visible page-number window
  const pages = buildPageWindow(currentPage, totalPages, maxVisible);

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page === 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: true });
  }

  const btnBase: React.CSSProperties = {
    display:         "inline-flex",
    alignItems:      "center",
    justifyContent:  "center",
    width:           "2.25rem",
    height:          "2.25rem",
    fontSize:        "0.875rem",
    fontWeight:      500,
    borderRadius:    "var(--card-radius, 0.375rem)",
    border:          "1px solid var(--card-border)",
    cursor:          "pointer",
    transition:      "background-color var(--transition-base), border-color var(--transition-base)",
    userSelect:      "none",
  };

  const activeBtnStyle: React.CSSProperties = {
    ...btnBase,
    backgroundColor: "var(--primary)",
    color:           "var(--primary-foreground, #fff)",
    borderColor:     "var(--primary)",
    cursor:          "default",
  };

  const inactiveBtnStyle: React.CSSProperties = {
    ...btnBase,
    backgroundColor: "var(--card-bg, #fff)",
    color:           "var(--text)",
  };

  const disabledBtnStyle: React.CSSProperties = {
    ...btnBase,
    backgroundColor: "var(--card-bg, #fff)",
    color:           "var(--text-muted)",
    cursor:          "not-allowed",
    opacity:         0.4,
  };

  return (
    <nav aria-label="Pagination" style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>

        {/* Previous */}
        <button
          type="button"
          aria-label="Go to previous page"
          disabled={currentPage <= 1}
          onClick={() => goToPage(currentPage - 1)}
          style={currentPage <= 1 ? disabledBtnStyle : inactiveBtnStyle}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 4L6 8l4 4" />
          </svg>
        </button>

        {/* Page numbers */}
        {pages.map((page, i) =>
          page === "ellipsis" ? (
            <span
              key={`ellipsis-${i}`}
              style={{ ...inactiveBtnStyle, cursor: "default", border: "none", background: "transparent" }}
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <button
              key={page}
              type="button"
              aria-label={`Go to page ${page}`}
              aria-current={page === currentPage ? "page" : undefined}
              onClick={() => goToPage(page as number)}
              style={page === currentPage ? activeBtnStyle : inactiveBtnStyle}
            >
              {page}
            </button>
          )
        )}

        {/* Next */}
        <button
          type="button"
          aria-label="Go to next page"
          disabled={currentPage >= totalPages}
          onClick={() => goToPage(currentPage + 1)}
          style={currentPage >= totalPages ? disabledBtnStyle : inactiveBtnStyle}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 4l4 4-4 4" />
          </svg>
        </button>

      </div>
    </nav>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns an array of page numbers and "ellipsis" placeholders.
 * Always includes the first and last page; uses a sliding window around
 * the current page for the middle range.
 *
 * Example (current=5, total=10, maxVisible=5):
 *   [1, "ellipsis", 4, 5, 6, "ellipsis", 10]
 */
function buildPageWindow(
  current:    number,
  total:      number,
  maxVisible: number,
): (number | "ellipsis")[] {
  if (total <= maxVisible) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const half   = Math.floor((maxVisible - 2) / 2); // pages each side of current
  const start  = Math.max(2, current - half);
  const end    = Math.min(total - 1, current + half);

  const pages: (number | "ellipsis")[] = [1];

  if (start > 2)         pages.push("ellipsis");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1)   pages.push("ellipsis");
  pages.push(total);

  return pages;
}
