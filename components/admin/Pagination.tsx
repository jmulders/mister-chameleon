"use client";

/**
 * Reusable client-side pagination for admin list views.
 *
 * `usePagination(items)` slices an already-loaded array into pages and returns
 * the current page's items plus the state a control bar needs. Pair it with
 * <PaginationControls .../> rendered just below the list.
 *
 *   const p = usePagination(rows, 25);
 *   {p.pageItems.map(...)}
 *   <PaginationControls {...p} label="leads" />
 *
 * Page size options: 10 / 25 / 50 / 100 / All. Changing the size or the
 * underlying list resets to page 1. Fully presentational, no server round-trip.
 */

import { useState } from "react";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export type PageSize = number | "all";

export interface PaginationState<T> {
  pageItems: readonly T[];
  page: number;        // zero-based, already clamped to a valid range
  pageCount: number;
  total: number;
  start: number;       // zero-based index of first item on the page
  end: number;         // exclusive index of last item on the page
  pageSize: PageSize;
  setPageSize: (v: PageSize) => void;
  setPage: (p: number) => void;
}

export function usePagination<T>(items: readonly T[], defaultPageSize: PageSize = 25): PaginationState<T> {
  const [pageSize, setPageSizeRaw] = useState<PageSize>(defaultPageSize);
  const [page, setPage] = useState(0);

  const total = items.length;
  const size = pageSize === "all" ? Math.max(total, 1) : pageSize;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const clampedPage = Math.min(Math.max(page, 0), pageCount - 1);
  const start = clampedPage * size;
  const pageItems = pageSize === "all" ? items : items.slice(start, start + size);

  const setPageSize = (v: PageSize) => { setPageSizeRaw(v); setPage(0); };

  return {
    pageItems,
    page: clampedPage,
    pageCount,
    total,
    start,
    end: start + pageItems.length,
    pageSize,
    setPageSize,
    setPage,
  };
}

interface PaginationControlsProps {
  page: number;
  pageCount: number;
  total: number;
  start: number;
  end: number;
  pageSize: PageSize;
  setPageSize: (v: PageSize) => void;
  setPage: (p: number) => void;
  /** Noun for the count label, e.g. "leads", "profielen". Default "rijen". */
  label?: string;
}

export function PaginationControls({
  page, pageCount, total, start, end, pageSize, setPageSize, setPage, label = "rijen",
}: PaginationControlsProps) {
  const btn =
    "rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-neutral-100 pt-3 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
      <span>
        {total === 0 ? `Geen ${label}` : `${start + 1}–${end} van ${total} ${label}`}
      </span>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5">
          <span>Toon</span>
          <select
            value={String(pageSize)}
            onChange={(e) => setPageSize(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="rounded-md border border-neutral-300 bg-white px-1.5 py-1 text-xs text-neutral-700 focus:border-neutral-500 focus:outline-none"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
            <option value="all">Alle</option>
          </select>
        </label>

        {pageCount > 1 && (
          <div className="flex items-center gap-1.5">
            <button type="button" className={btn} disabled={page <= 0} onClick={() => setPage(page - 1)}>
              Vorige
            </button>
            <span className="tabular-nums">{page + 1} / {pageCount}</span>
            <button type="button" className={btn} disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)}>
              Volgende
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
