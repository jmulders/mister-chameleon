"use client";

/**
 * SubmissionsClient
 *
 * Interactive inbox for form submissions — filtering, pagination, inline detail
 * panel, CSV export, and deletion with optimistic removal.
 */

import { useState, useCallback, useTransition } from "react";
import type { FormSubmissionRow } from "@/data/repositories/form-submissions-repository";
import {
  listFormSubmissionsAction,
  deleteFormSubmissionAction,
  exportFormSubmissionsAction,
} from "../actions";

// ── Types ──────────────────────────────────────────────────────────────────────

interface SubmissionsClientProps {
  initialRows:  FormSubmissionRow[];
  initialTotal: number;
  tenantId:     string;
  /** Unique form keys for the filter dropdown. */
  formKeys:     string[];
  /** Form key to pre-select the filter on (from the ?formKey= param). Empty = all. */
  initialFormKey?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd   = String(d.getDate()).padStart(2, "0");
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh   = String(d.getHours()).padStart(2, "0");
  const min  = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
}

function getDisplayName(values: Record<string, string>): string {
  return values["name"] ?? values["naam"] ?? values["voornaam"] ?? "—";
}

function getPreview(values: Record<string, string>): string {
  const text = Object.values(values).join(" · ");
  return text.length > 80 ? text.slice(0, 80) + "…" : text;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function SubmissionsClient({
  initialRows,
  initialTotal,
  tenantId,
  formKeys,
  initialFormKey = "",
}: SubmissionsClientProps) {
  // ── Filter state ────────────────────────────────────────────────────────────
  // Pre-select the form filter when opened scoped from the Forms page. The
  // initialRows were already server-filtered on the same key, so no re-fetch is
  // needed on mount; switching via the dropdown re-fetches as usual.
  const [filterFormKey, setFilterFormKey] = useState<string>(initialFormKey);
  const [filterFrom,    setFilterFrom]    = useState<string>("");
  const [filterTo,      setFilterTo]      = useState<string>("");
  const [filterSearch,  setFilterSearch]  = useState<string>("");

  // ── Data state ──────────────────────────────────────────────────────────────
  const [rows,  setRows]  = useState<FormSubmissionRow[]>(initialRows);
  const [total, setTotal] = useState<number>(initialTotal);
  const [page,  setPage]  = useState<number>(1);

  // ── Expanded row ────────────────────────────────────────────────────────────
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [isLoading,    startLoading]    = useTransition();
  const [isExporting,  startExporting]  = useTransition();
  const [statusMsg,    setStatusMsg]    = useState<string | null>(null);

  const PAGE_SIZE = 50;

  // ── Fetch helper ────────────────────────────────────────────────────────────

  const fetchPage = useCallback(
    (nextPage: number, overrides?: {
      formKey?: string;
      from?: string;
      to?: string;
      search?: string;
    }) => {
      startLoading(async () => {
        setStatusMsg(null);
        const params = {
          formKey: overrides?.formKey  ?? (filterFormKey || undefined),
          from:    overrides?.from     ?? (filterFrom    || undefined),
          to:      overrides?.to       ?? (filterTo      || undefined),
          search:  overrides?.search   ?? (filterSearch  || undefined),
          page:    nextPage,
        };
        const result = await listFormSubmissionsAction(tenantId, params);
        if (result.ok) {
          setRows(result.rows);
          setTotal(result.total);
          setPage(nextPage);
          setExpandedId(null);
        } else {
          setStatusMsg(`Error: ${result.error}`);
        }
      });
    },
    [tenantId, filterFormKey, filterFrom, filterTo, filterSearch],
  );

  // ── Filter submit ───────────────────────────────────────────────────────────

  const handleFilter = () => {
    fetchPage(1);
  };

  // ── Export ──────────────────────────────────────────────────────────────────

  const handleExport = () => {
    startExporting(async () => {
      setStatusMsg(null);
      const result = await exportFormSubmissionsAction(tenantId, {
        formKey: filterFormKey || undefined,
        from:    filterFrom    || undefined,
        to:      filterTo      || undefined,
      });
      if (result.ok) {
        const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
        const url  = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href     = url;
        link.download = `submissions-${tenantId}-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        setStatusMsg(`Export failed: ${result.error}`);
      }
    });
  };

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this submission?")) return;

    // Optimistic removal.
    setRows((prev) => prev.filter((r) => r.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));

    const result = await deleteFormSubmissionAction(tenantId, id);
    if (!result.ok) {
      setStatusMsg(`Delete failed: ${result.error}`);
      // Re-fetch current page to restore state.
      fetchPage(page);
    }
  };

  // ── Pagination ──────────────────────────────────────────────────────────────

  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstOnPage = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastOnPage  = Math.min(page * PAGE_SIZE, total);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 px-5 py-4">
        <div className="flex flex-wrap gap-3 items-end">

          {/* Form key select */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-400">Form</label>
            <select
              value={filterFormKey}
              onChange={(e) => setFilterFormKey(e.target.value)}
              className={selectCls}
            >
              <option value="">All forms</option>
              {formKeys.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          {/* Date from */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-400">From</label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Date to */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-400">To</label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Search */}
          <div className="flex flex-col gap-1 flex-1 min-w-40">
            <label className="text-xs font-medium text-slate-400">Search</label>
            <input
              type="text"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFilter()}
              placeholder="Search by name, email, content…"
              className={inputCls}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleFilter}
              disabled={isLoading}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {isLoading ? "Loading…" : "Filter"}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || rows.length === 0}
              className="rounded-lg border border-slate-600 bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600 disabled:opacity-50 transition-colors"
            >
              {isExporting ? "Exporting…" : "Export CSV"}
            </button>
          </div>
        </div>

        {/* Status message */}
        {statusMsg && (
          <p className="mt-2 text-sm text-red-400">{statusMsg}</p>
        )}
      </div>

      {/* ── Pagination summary ───────────────────────────────────────────── */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-400 px-1">
          <span>{firstOnPage}–{lastOnPage} of {total} submissions</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fetchPage(page - 1)}
              disabled={page <= 1 || isLoading}
              className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              ← Previous
            </button>
            <span className="px-2 py-1 text-xs">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => fetchPage(page + 1)}
              disabled={page >= totalPages || isLoading}
              className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800 px-8 py-12 text-center">
          <p className="text-slate-300 font-medium">No submissions found</p>
          <p className="text-slate-500 text-sm mt-1">
            Adjust the filters or check whether the form stores submissions.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">Form</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Preview</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <>
                  <tr
                    key={row.id}
                    onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                    className="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap font-mono text-xs">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-full bg-indigo-900/50 border border-indigo-700 px-2 py-0.5 text-xs font-medium text-indigo-300">
                        {row.form_key}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-200 whitespace-nowrap">
                      {getDisplayName(row.values)}
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                      {row.values["email"] ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-400 max-w-xs truncate">
                      {getPreview(row.values)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); void handleDelete(row.id); }}
                        className="inline-flex items-center gap-1 rounded-md border border-red-800 bg-red-900/30 px-2.5 py-1 text-xs text-red-400 hover:bg-red-900/60 transition-colors"
                        title="Delete submission"
                      >
                        <TrashIcon />
                        Delete
                      </button>
                    </td>
                  </tr>

                  {/* ── Inline detail panel ────────────────────────────────── */}
                  {expandedId === row.id && (
                    <tr key={`${row.id}-detail`} className="border-b border-slate-700/50">
                      <td colSpan={6} className="px-6 py-4 bg-slate-900/50">
                        <div className="space-y-3">
                          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                            All fields, {row.form_key}, {formatDate(row.created_at)}
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {Object.entries(row.values).map(([k, v]) => (
                              <div key={k} className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2">
                                <p className="text-xs text-slate-500 font-medium">{k}</p>
                                <p className="text-sm text-slate-200 mt-0.5 break-words">{v}</p>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-slate-600 font-mono">ID: {row.id}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Bottom pagination ────────────────────────────────────────────── */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-slate-400 px-1">
          <span>{firstOnPage}–{lastOnPage} of {total} submissions</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fetchPage(page - 1)}
              disabled={page <= 1 || isLoading}
              className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              ← Previous
            </button>
            <button
              type="button"
              onClick={() => fetchPage(page + 1)}
              disabled={page >= totalPages || isLoading}
              className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1 text-xs hover:bg-slate-700 disabled:opacity-40 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const inputCls =
  "rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 " +
  "placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

const selectCls =
  "rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-200 " +
  "focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

// ── Icons ─────────────────────────────────────────────────────────────────────

function TrashIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
