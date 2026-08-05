"use client";

/**
 * ExportTenantDataButton
 *
 * Downloads the tenant's accumulated personalization value (rules/segmentation,
 * variants, visitor profiles + interest history) as a JSON file. The server
 * action gathers and serializes the data; the client turns the returned string
 * into a Blob and triggers a browser download. No data touches a third party.
 */

import { useState, useTransition } from "react";

interface ExportTenantDataButtonProps {
  /** Bound server action — `exportTenantDataAction.bind(null, tenantId)` */
  exportAction: () => Promise<
    { ok: true; json: string; filename: string } | { ok: false; error: string }
  >;
}

export function ExportTenantDataButton({ exportAction }: ExportTenantDataButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleExport() {
    setError(null);
    startTransition(async () => {
      const result = await exportAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Turn the JSON string into a downloadable file, client-side only.
      const blob = new Blob([result.json], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleExport}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-wait disabled:opacity-60"
      >
        {isPending ? "Exporting…" : "Export tenant data"}
      </button>
      <span className="text-xs text-neutral-400">
        Rules, variants &amp; visitor profiles as JSON. Your work, portable.
      </span>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
