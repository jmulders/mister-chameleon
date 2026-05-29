"use client";

/**
 * Context Library — Admin Client Component
 *
 * app/admin/context/library/_components/ContextLibraryClient.tsx
 *
 * Interactive catalog with family/status/site-model filters and full-text search.
 *
 * ─── Filtering ────────────────────────────────────────────────────────────────
 *
 *   Family tabs   — one tab per ContextFamily; "All" shows every definition.
 *   Status chips  — multi-select: active | suggested | draft (hidden by default).
 *   Site model    — single-select: all | service | product-saas | careers | catalog | commerce.
 *   Search        — fuzzy text search across label, description, id, and matchReason.
 *
 * ─── Card layout ──────────────────────────────────────────────────────────────
 *
 *   Each card shows:
 *     • Family badge (colored)
 *     • Status badge
 *     • Definition label + description
 *     • Site model pills
 *     • Criteria list (field, op, value — human-readable)
 *     • matchReason
 *     • usageNote (collapsed by default if long)
 *     • Definition id (monospace, copy-on-click)
 */

import { useState, useMemo, useCallback } from "react";
import type {
  ContextDefinition,
  ContextFamily,
  ContextFamilyKey,
  ContextSiteModel,
  ContextDefinitionStatus,
  ContextCriterion,
} from "@/context/library";

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  definitions: ContextDefinition[];
  families:    ContextFamily[];
  /** Optional map of definition id → rules-usage count. */
  usedByCount?: Record<string, number>;
}

// ── Types ──────────────────────────────────────────────────────────────────────

type StatusFilter   = ContextDefinitionStatus | "all";
type SiteModelFilter = ContextSiteModel | "all";

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ContextDefinitionStatus, string> = {
  active:    "Active",
  suggested: "Suggested",
  draft:     "Draft",
};

const STATUS_COLORS: Record<ContextDefinitionStatus, string> = {
  active:    "bg-green-100 text-green-700",
  suggested: "bg-yellow-100 text-yellow-700",
  draft:     "bg-neutral-100 text-neutral-500",
};

const SITE_MODEL_LABELS: Record<ContextSiteModel, string> = {
  all:           "All sites",
  service:       "Service",
  "product-saas":"SaaS",
  careers:       "Careers",
  catalog:       "Catalog",
  commerce:      "Commerce",
};

/** Human-readable rendering of a single criterion. */
function criterionLabel(c: ContextCriterion): string {
  const f = c.field;
  switch (c.op) {
    case "eq":      return `${f} = ${c.value}`;
    case "not_eq":  return `${f} ≠ ${c.value}`;
    case "in":      return `${f} in [${(c.value as (string | number)[]).join(", ")}]`;
    case "not_in":  return `${f} not in [${(c.value as (string | number)[]).join(", ")}]`;
    case "gte":     return `${f} ≥ ${c.value}`;
    case "lte":     return `${f} ≤ ${c.value}`;
    case "gt":      return `${f} > ${c.value}`;
    case "lt":      return `${f} < ${c.value}`;
    case "present": return `${f} is present`;
    case "absent":  return `${f} is absent`;
    case "truthy":  return `${f} is truthy`;
    case "falsy":   return `${f} is falsy`;
    default:        return f;
  }
}

/** Normalise a string for search comparison. */
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ContextLibraryClient({ definitions, families, usedByCount }: Props) {
  const [activeFamily, setActiveFamily]    = useState<ContextFamilyKey | "all">("all");
  const [statusFilter, setStatusFilter]    = useState<StatusFilter>("all");
  const [siteModel,    setSiteModel]       = useState<SiteModelFilter>("all");
  const [search,       setSearch]          = useState("");
  const [copiedId,     setCopiedId]        = useState<string | null>(null);

  // Filtered definitions
  const filtered = useMemo(() => {
    const q = norm(search);

    return definitions.filter((def) => {
      if (activeFamily !== "all" && def.family !== activeFamily) return false;
      if (statusFilter !== "all" && def.status !== statusFilter) return false;
      if (siteModel !== "all") {
        const includes = def.siteModels.includes(siteModel as ContextSiteModel)
          || def.siteModels.includes("all");
        if (!includes) return false;
      }
      if (q) {
        const haystack = norm(
          [def.label, def.description, def.id, def.matchReason, def.usageNote ?? ""].join(" ")
        );
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [definitions, activeFamily, statusFilter, siteModel, search]);

  const handleCopyId = useCallback((id: string) => {
    navigator.clipboard.writeText(id).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }, []);

  const familyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const def of definitions) {
      counts[def.family] = (counts[def.family] ?? 0) + 1;
    }
    return counts;
  }, [definitions]);

  return (
    <div className="space-y-5">

      {/* ── Filters row ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">

        {/* Search */}
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search definitions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-64 rounded-md border border-neutral-200 bg-white pl-8 pr-3 text-sm
                       text-neutral-900 placeholder:text-neutral-400 focus:outline-none
                       focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-neutral-400">Status</span>
          {(["all", "active", "suggested", "draft"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors
                ${statusFilter === s
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
            >
              {s === "all" ? "All" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Site model filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-neutral-400">Site</span>
          <select
            value={siteModel}
            onChange={(e) => setSiteModel(e.target.value as SiteModelFilter)}
            className="h-9 rounded-md border border-neutral-200 bg-white px-2.5 text-xs
                       text-neutral-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {(["all", "service", "product-saas", "careers", "catalog", "commerce"] as SiteModelFilter[]).map((sm) => (
              <option key={sm} value={sm}>
                {SITE_MODEL_LABELS[sm as ContextSiteModel] ?? sm}
              </option>
            ))}
          </select>
        </div>

        {/* Result count */}
        <span className="ml-auto text-xs text-neutral-400">
          {filtered.length} {filtered.length === 1 ? "definition" : "definitions"}
        </span>
      </div>

      {/* ── Family tabs ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveFamily("all")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors
            ${activeFamily === "all"
              ? "bg-neutral-900 text-white"
              : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
            }`}
        >
          All families
          <span className="ml-1.5 text-neutral-400">{definitions.length}</span>
        </button>
        {families.map((fam) => (
          <button
            key={fam.key}
            onClick={() => setActiveFamily(fam.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors
              ${activeFamily === fam.key
                ? "bg-neutral-900 text-white"
                : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
              }`}
          >
            {fam.label}
            <span className="ml-1.5 opacity-50">{familyCounts[fam.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* ── Definition cards ─────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed
                        border-neutral-200 bg-neutral-50 text-sm text-neutral-400">
          No definitions match the current filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((def) => {
            const family = families.find((f) => f.key === def.family);
            const rulesCount = usedByCount?.[def.id] ?? 0;

            return (
              <div
                key={def.id}
                className="flex flex-col rounded-lg border border-neutral-200 bg-white
                           p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Card header */}
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {/* Family badge */}
                  {family && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${family.color}`}>
                      {family.label}
                    </span>
                  )}
                  {/* Status badge */}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[def.status]}`}>
                    {STATUS_LABELS[def.status]}
                  </span>
                  {/* Used-by count */}
                  {rulesCount > 0 && (
                    <span className="ml-auto rounded-full bg-blue-50 px-2 py-0.5 text-xs
                                     font-medium text-blue-600">
                      {rulesCount} {rulesCount === 1 ? "rule" : "rules"}
                    </span>
                  )}
                </div>

                {/* Label + description */}
                <h3 className="text-sm font-semibold text-neutral-900">{def.label}</h3>
                <p className="mt-0.5 text-xs text-neutral-500 leading-relaxed">{def.description}</p>

                {/* Site models */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {def.siteModels.map((sm) => (
                    <span
                      key={sm}
                      className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px]
                                 font-medium text-neutral-500 uppercase tracking-wide"
                    >
                      {SITE_MODEL_LABELS[sm] ?? sm}
                    </span>
                  ))}
                </div>

                {/* Criteria */}
                <div className="mt-3">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                    Criteria
                  </p>
                  <ul className="space-y-0.5">
                    {def.criteria.map((c, i) => (
                      <li key={i} className="flex items-center gap-1.5 text-xs">
                        <span className="font-mono text-neutral-700">{criterionLabel(c)}</span>
                        {c.optional && (
                          <span className="rounded bg-sky-50 px-1 py-0.5 text-[9px]
                                           font-medium text-sky-500 uppercase">
                            optional
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Match reason */}
                <p className="mt-3 text-xs text-neutral-500 italic leading-relaxed">
                  <span className="not-italic font-medium text-neutral-600">Match: </span>
                  {def.matchReason}
                </p>

                {/* Usage note */}
                {def.usageNote && (
                  <p className="mt-1.5 text-xs text-neutral-400 leading-relaxed">
                    <span className="font-medium text-neutral-500">Tip: </span>
                    {def.usageNote}
                  </p>
                )}

                {/* ID — copy on click */}
                <button
                  onClick={() => handleCopyId(def.id)}
                  className="mt-3 flex items-center gap-1.5 self-start rounded bg-neutral-50
                             px-2 py-1 font-mono text-[10px] text-neutral-400 hover:bg-neutral-100
                             hover:text-neutral-600 transition-colors"
                  title="Click to copy ID"
                >
                  {copiedId === def.id ? (
                    <>
                      <svg className="h-3 w-3 text-green-500" fill="none" viewBox="0 0 16 16">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"
                          strokeWidth="2" d="M2 8l4 4 8-8" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 16 16">
                        <rect x="2" y="5" width="9" height="9" rx="1.5" stroke="currentColor"
                          strokeWidth="1.5" />
                        <path d="M5 5V3.5A1.5 1.5 0 0 1 6.5 2H12.5A1.5 1.5 0 0 1 14 3.5V9.5A1.5 1.5 0 0 1 12.5 11H11"
                          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      {def.id}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
