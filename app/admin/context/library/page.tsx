/**
 * /admin/context/library — Context Library Management
 *
 * app/admin/context/library/page.tsx
 *
 * Read-only catalog view of all named audience context definitions.
 *
 * ─── What this page shows ─────────────────────────────────────────────────────
 *
 *   All ContextDefinitions from context/library/definitions.ts, grouped by
 *   family and filterable by family, status, and site model.  Each card shows
 *   the definition's label, description, criteria, and usage note.
 *
 *   A "used by N rules" count badge is reserved as a future enhancement
 *   (the DB query is left as a TODO placeholder).
 *
 * ─── Architecture ─────────────────────────────────────────────────────────────
 *
 *   This file is a lightweight async server component.  It passes the static
 *   definitions + family metadata to ContextLibraryClient (client component)
 *   for interactive filtering and search.  No DB round-trip is required because
 *   the library is code-defined in definitions.ts.
 *
 *   When used-by-rules counts are needed, add a DB query here and pass the
 *   result map to ContextLibraryClient.
 */

import { CONTEXT_DEFINITIONS, CONTEXT_FAMILIES } from "@/context/library";
import { ContextLibraryClient }                  from "./_components/ContextLibraryClient";

export const dynamic = "force-static";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ContextLibraryPage() {
  const activeCount    = CONTEXT_DEFINITIONS.filter((d) => d.status === "active").length;
  const suggestedCount = CONTEXT_DEFINITIONS.filter((d) => d.status === "suggested").length;
  const totalCount     = CONTEXT_DEFINITIONS.length;

  return (
    <div className="max-w-7xl p-8">

      {/* Page header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">Context Library</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Named audience profiles composed from runtime context signals.
            Use these as a reference when authoring personalisation rules.
          </p>
        </div>

        {/* Summary badges */}
        <div className="flex shrink-0 items-center gap-2 text-xs text-neutral-500">
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-medium">
            {totalCount} total
          </span>
          <span className="rounded-full bg-green-100 px-2.5 py-1 font-medium text-green-700">
            {activeCount} active
          </span>
          <span className="rounded-full bg-yellow-100 px-2.5 py-1 font-medium text-yellow-700">
            {suggestedCount} suggested
          </span>
        </div>
      </div>

      {/* Interactive client */}
      <ContextLibraryClient
        definitions={CONTEXT_DEFINITIONS as import("@/context/library").ContextDefinition[]}
        families={CONTEXT_FAMILIES as import("@/context/library").ContextFamily[]}
      />
    </div>
  );
}
