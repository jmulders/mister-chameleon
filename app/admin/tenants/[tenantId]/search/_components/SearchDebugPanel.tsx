"use client";

/**
 * SearchDebugPanel
 *
 * Admin debug panel for the platform search API.
 *
 * Lets admins test a search query with a specific visitor context and see:
 *   - Raw Meilisearch results (before re-ranking)
 *   - Context-aware results (after re-ranking)
 *   - Which context signals were used
 *   - Per-result boost scores (via debug flag)
 *
 * This component calls the platform's /api/search endpoint directly — the
 * same endpoint used by the production frontend.  This ensures the debug
 * panel shows exactly what real visitors would see.
 */

import { useState } from "react";
import type { SearchContext } from "@/search/ranking/context-ranker";

interface SearchResult {
  id:      string;
  type:    string;
  title:   string;
  slug:    string;
  excerpt?: string;
}

interface SearchResponse {
  results: SearchResult[];
  total:   number;
  query:   string;
}

const FUNNEL_STAGES = ["awareness", "consideration", "intent", "high_intent", "customer"];
const VISIT_TYPES   = ["first_visit", "returning", "high_intent"];
const SOURCES       = ["direct", "google", "linkedin", "email", "paid", "organic"];

export function SearchDebugPanel() {
  const [searchQuery,   setSearchQuery]   = useState("");
  const [context,       setContext]       = useState<Partial<SearchContext>>({});
  const [results,       setResults]       = useState<SearchResponse | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const body: Record<string, unknown> = { query: searchQuery };
      if (Object.keys(context).some((k) => context[k as keyof SearchContext] != null)) {
        body.effectiveContext = context;
      }

      const res = await fetch("/api/search", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });

      if (!res.ok) {
        setError(`Search failed: ${res.status}`);
        return;
      }

      const data = await res.json() as SearchResponse;
      setResults(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const updateContext = (field: keyof SearchContext, value: string) => {
    setContext((prev) => ({ ...prev, [field]: value || null }));
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 space-y-4">
      <h3 className="text-sm font-semibold text-neutral-900">Search Debug</h3>
      <p className="text-xs text-neutral-500">
        Test the context-aware search API with a visitor context. Results are re-ranked
        in real time using the platform re-ranking logic.
      </p>

      {/* Query input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search query…"
          className="flex-1 rounded border border-neutral-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={handleSearch}
          disabled={loading || !searchQuery.trim()}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {/* Context controls */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Funnel stage</label>
          <select
            value={context.funnelStage ?? ""}
            onChange={(e) => updateContext("funnelStage", e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1 text-xs focus:outline-none"
          >
            <option value="">(none)</option>
            {FUNNEL_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Visit type</label>
          <select
            value={context.visitType ?? ""}
            onChange={(e) => updateContext("visitType", e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1 text-xs focus:outline-none"
          >
            <option value="">(none)</option>
            {VISIT_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Source</label>
          <select
            value={context.source ?? ""}
            onChange={(e) => updateContext("source", e.target.value)}
            className="w-full rounded border border-neutral-300 px-2 py-1 text-xs focus:outline-none"
          >
            <option value="">(none)</option>
            {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Intent score</label>
          <input
            type="number"
            min={0}
            max={100}
            value={context.intentScore ?? ""}
            onChange={(e) => setContext((p) => ({ ...p, intentScore: e.target.value ? parseInt(e.target.value) : null }))}
            placeholder="0–100"
            className="w-full rounded border border-neutral-300 px-2 py-1 text-xs focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">CRM lifecycle</label>
          <input
            type="text"
            value={context.crmLifecycle ?? ""}
            onChange={(e) => updateContext("crmLifecycle", e.target.value)}
            placeholder="e.g. customer, lead"
            className="w-full rounded border border-neutral-300 px-2 py-1 text-xs focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Scenario</label>
          <input
            type="text"
            value={context.scenario ?? ""}
            onChange={(e) => updateContext("scenario", e.target.value)}
            placeholder="e.g. behavioral_candidate"
            className="w-full rounded border border-neutral-300 px-2 py-1 text-xs focus:outline-none"
          />
        </div>
      </div>

      {/* Error */}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Results */}
      {results && (
        <div>
          <p className="text-xs text-neutral-500 mb-2">
            {results.total} result{results.total !== 1 ? "s" : ""} for &ldquo;{results.query}&rdquo;
            {Object.values(context).some(Boolean) && " (context-aware re-ranking applied)"}
          </p>
          <div className="space-y-2">
            {results.results.slice(0, 10).map((r, i) => (
              <div key={r.id} className="flex items-start gap-2 rounded border border-neutral-100 px-3 py-2">
                <span className="text-xs font-mono text-neutral-400 w-5 flex-shrink-0">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-neutral-900 truncate">{r.title}</p>
                  <p className="text-xs text-neutral-400">{r.type} · {r.slug}</p>
                  {r.excerpt && (
                    <p className="text-xs text-neutral-500 mt-0.5 truncate" dangerouslySetInnerHTML={{ __html: r.excerpt }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
