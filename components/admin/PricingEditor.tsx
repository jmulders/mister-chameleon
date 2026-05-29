"use client";

/**
 * components/admin/PricingEditor.tsx
 *
 * Client component — editable enrichment pricing table.
 *
 * ─── What this renders ───────────────────────────────────────────────────────
 *
 *   A row per enrichment type from CREDIT_PRICING_DEFAULTS.  Each row shows:
 *     • Enrichment display name + description
 *     • Category badge (recognition / adaptation / brainpower)
 *     • Unit price (EUR/call, decimal) — editable, supports fractions like 0.001
 *     • Credit cost (credits/call, decimal) — editable, supports 0.25
 *     • Internal cost (EUR/call, optional) — editable
 *     • Source badge: "DB" when from enrichment_pricing, "static" otherwise
 *     • Save button (per-row; only enabled when values change)
 *
 * ─── Persistence model ────────────────────────────────────────────────────────
 *
 *   Edits call `upsertEnrichmentPricing` (server action).  The action upserts
 *   into `enrichment_pricing` and revalidates this page.
 */

import { useState, useTransition } from "react";
import { upsertEnrichmentPricing } from "@/app/admin/platform/billing/pricing/actions";
import type { PricingDisplayRow }  from "@/app/admin/platform/billing/pricing/page";

// ── Category colours ──────────────────────────────────────────────────────────

const categoryColour: Record<string, string> = {
  recognition: "bg-blue-100 text-blue-700",
  adaptation:  "bg-amber-100 text-amber-700",
  brainpower:  "bg-purple-100 text-purple-700",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtEur(value: number, decimals = 6): string {
  return `€${value.toFixed(decimals)}`;
}

function parseDecimal(val: string): number | null {
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

// ── Row editor ────────────────────────────────────────────────────────────────

interface RowEditorProps {
  row: PricingDisplayRow;
}

function RowEditor({ row }: RowEditorProps) {
  // Store as strings for input editing, convert on save
  const [unitPrice,    setUnitPrice]    = useState(String(row.unit_price));
  const [creditCost,   setCreditCost]   = useState(String(row.credit_cost));
  const [internalCost, setInternalCost] = useState<string>(
    row.internal_cost != null ? String(row.internal_cost) : "",
  );

  const [status,    setStatus]    = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errMsg,    setErrMsg]    = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const parsedUnit     = parseDecimal(unitPrice);
  const parsedCredits  = parseDecimal(creditCost);
  const parsedInternal = internalCost === "" ? null : parseDecimal(internalCost);

  const isDirty =
    parsedUnit     !== row.unit_price ||
    parsedCredits  !== row.credit_cost ||
    parsedInternal !== row.internal_cost;

  function handleSave() {
    if (parsedUnit === null || parsedUnit < 0) {
      setErrMsg("Unit price must be a non-negative number.");
      setStatus("error");
      return;
    }
    if (parsedCredits === null || parsedCredits < 0) {
      setErrMsg("Credit cost must be a non-negative number.");
      setStatus("error");
      return;
    }
    if (internalCost !== "" && parsedInternal === null) {
      setErrMsg("Internal cost must be a number or blank.");
      setStatus("error");
      return;
    }
    if (parsedInternal !== null && parsedInternal < 0) {
      setErrMsg("Internal cost cannot be negative.");
      setStatus("error");
      return;
    }

    setStatus("saving");
    setErrMsg("");

    startTransition(async () => {
      const result = await upsertEnrichmentPricing({
        enrichment_type: row.enrichment_type,
        label:           row.displayName,
        category:        row.category,
        unit_price:      parsedUnit,
        credit_cost:     parsedCredits!,
        internal_cost:   parsedInternal,
        billing_unit:    row.billing_unit,
        description:     row.description,
      });

      if (result.ok) {
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 2500);
      } else {
        setErrMsg(result.error ?? "Unknown error");
        setStatus("error");
      }
    });
  }

  // Margin calculation in EUR
  const marginPct = parsedUnit && parsedUnit > 0 && parsedInternal != null && parsedInternal >= 0
    ? Math.round(((parsedUnit - parsedInternal) / parsedUnit) * 100)
    : null;

  return (
    <tr className="border-b border-neutral-50 text-sm align-top hover:bg-neutral-50/40 transition-colors">
      {/* Enrichment name + description */}
      <td className="px-4 py-3">
        <p className="font-medium text-neutral-800">{row.displayName}</p>
        <p className="mt-0.5 text-xs text-neutral-400 leading-snug max-w-xs">{row.description}</p>
        <code className="mt-1 inline-block text-[10px] font-mono text-neutral-400 bg-neutral-100 rounded px-1 py-px">
          {row.enrichment_type}
        </code>
      </td>

      {/* Category badge */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${categoryColour[row.category] ?? "bg-neutral-100 text-neutral-500"}`}>
          {row.category}
        </span>
      </td>

      {/* Unit price (EUR/call) */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            step={0.000001}
            value={unitPrice}
            onChange={(e) => { setUnitPrice(e.target.value); setStatus("idle"); }}
            className="w-24 rounded border border-neutral-200 bg-white px-2 py-1 text-right text-sm font-mono focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100"
          />
          <span className="text-xs text-neutral-400">€</span>
        </div>
        {parsedUnit != null && (
          <p className="mt-0.5 text-[10px] text-neutral-400">
            per call
          </p>
        )}
      </td>

      {/* Credit cost (credits/call) */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            step={0.001}
            value={creditCost}
            onChange={(e) => { setCreditCost(e.target.value); setStatus("idle"); }}
            className="w-20 rounded border border-neutral-200 bg-white px-2 py-1 text-right text-sm font-mono focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100"
          />
          <span className="text-xs text-neutral-400">cr</span>
        </div>
      </td>

      {/* Internal cost (EUR/call) */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            step={0.000001}
            placeholder="—"
            value={internalCost}
            onChange={(e) => { setInternalCost(e.target.value); setStatus("idle"); }}
            className="w-24 rounded border border-neutral-200 bg-white px-2 py-1 text-right text-sm font-mono placeholder:text-neutral-300 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100"
          />
          <span className="text-xs text-neutral-400">€</span>
        </div>
        {marginPct !== null && (
          <p className="mt-0.5 text-[10px] text-neutral-400">
            {marginPct}% margin
          </p>
        )}
      </td>

      {/* Source badge */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
          row.fromDb
            ? "bg-green-100 text-green-700"
            : "bg-neutral-100 text-neutral-500"
        }`}>
          {row.fromDb ? "DB" : "static"}
        </span>
      </td>

      {/* Save button + status */}
      <td className="px-4 py-3 text-right whitespace-nowrap">
        {status === "error" && (
          <p className="mb-1 text-[10px] text-red-500 max-w-[140px] text-right leading-tight">{errMsg}</p>
        )}
        <button
          onClick={handleSave}
          disabled={!isDirty || isPending || status === "saving"}
          className={`rounded px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            status === "saved"
              ? "bg-green-100 text-green-700"
              : status === "error"
              ? "bg-red-100 text-red-700"
              : isDirty
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "border border-neutral-200 bg-white text-neutral-400"
          }`}
        >
          {status === "saving" ? "Saving…" : status === "saved" ? "✓ Saved" : status === "error" ? "Error" : "Save"}
        </button>
      </td>
    </tr>
  );
}

// ── Seed button ───────────────────────────────────────────────────────────────

import { seedDefaultPricing, resetToDefaultPricing } from "@/app/admin/platform/billing/pricing/actions";

interface SeedButtonProps {
  hasDbRows: boolean;
}

function SeedButton({ hasDbRows }: SeedButtonProps) {
  const [status, setStatus]     = useState<"idle" | "seeding" | "done" | "error">("idle");
  const [seedError, setSeedError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (hasDbRows) return null;

  function handleSeed() {
    setStatus("seeding");
    setSeedError(null);
    startTransition(async () => {
      const result = await seedDefaultPricing();
      if (result.ok) {
        setStatus("done");
      } else {
        setStatus("error");
        setSeedError(result.error ?? "Unknown error — check server logs.");
      }
    });
  }

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
      <div className="flex items-center gap-3">
        <span className="text-sm text-amber-700">
          No pricing rows in the database. Seed the <code className="rounded bg-amber-100 px-1 text-xs">enrichment_pricing</code> table to enable per-row editing.
        </span>
        <button
          onClick={handleSeed}
          disabled={isPending || status === "seeding"}
          className="shrink-0 rounded bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {status === "seeding" ? "Seeding…" : status === "done" ? "✓ Seeded" : "Seed defaults"}
        </button>
      </div>
      {status === "error" && seedError && (
        <pre className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 whitespace-pre-wrap break-all">
          {seedError}
        </pre>
      )}
    </div>
  );
}

// ── Reset button ──────────────────────────────────────────────────────────────
//
// Shown when rows exist in the DB but one or more have credit_cost=0.
// Clicking overwrites all built-in rows with static defaults (ignoreDuplicates=false).

function ResetButton({ hasZeroCost }: { hasZeroCost: boolean }) {
  const [status, setStatus]       = useState<"idle" | "resetting" | "done" | "error">("idle");
  const [resetError, setResetError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!hasZeroCost) return null;

  function handleReset() {
    if (!confirm("Reset all built-in enrichment pricing rows to their default values? Custom rows will not be affected.")) return;
    setStatus("resetting");
    setResetError(null);
    startTransition(async () => {
      const result = await resetToDefaultPricing();
      if (result.ok) {
        setStatus("done");
      } else {
        setStatus("error");
        setResetError(result.error ?? "Unknown error — check server logs.");
      }
    });
  }

  return (
    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium text-red-700">
            One or more enrichment types have <code className="rounded bg-red-100 px-1 text-xs">credit_cost = 0</code>
          </p>
          <p className="mt-0.5 text-xs text-red-600">
            This causes enrichments to be billed at 0 credits — Transaction History will show "0 cr" for all calls.
            Click "Reset to defaults" to restore correct billing amounts.
          </p>
        </div>
        <button
          onClick={handleReset}
          disabled={isPending || status === "resetting"}
          className="shrink-0 rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {status === "resetting" ? "Resetting…" : status === "done" ? "✓ Reset" : "Reset to defaults"}
        </button>
      </div>
      {status === "error" && resetError && (
        <pre className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 whitespace-pre-wrap break-all">
          {resetError}
        </pre>
      )}
    </div>
  );
}

// ── PricingEditor ─────────────────────────────────────────────────────────────

export interface PricingEditorProps {
  rows: PricingDisplayRow[];
}

export function PricingEditor({ rows }: PricingEditorProps) {
  const hasDbRows   = rows.some((r) => r.fromDb);
  // Detect rows that came from DB but have credit_cost=0 (schema default, never seeded correctly).
  const hasZeroCost = rows.some((r) => r.fromDb && r.credit_cost === 0);

  const categories = ["recognition", "adaptation", "brainpower"] as const;

  return (
    <div>
      <SeedButton hasDbRows={hasDbRows} />
      <ResetButton hasZeroCost={hasZeroCost} />

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-neutral-100 text-xs font-medium uppercase tracking-wide text-neutral-400">
              <th className="px-4 py-3 text-left">Enrichment type</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Unit price (€/call)</th>
              <th className="px-4 py-3 text-left">Credit cost</th>
              <th className="px-4 py-3 text-left">Internal cost (€)</th>
              <th className="px-4 py-3 text-left">Source</th>
              <th className="px-4 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => {
              const catRows = rows.filter((r) => r.category === cat);
              if (catRows.length === 0) return null;
              return catRows.map((row) => (
                <RowEditor key={row.enrichment_type} row={row} />
              ));
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-neutral-400">
        Unit price in EUR per successful live API call. Supports fractions like €0.001.
        Credit cost: credits deducted per call (supports 0.250 for sub-credit billing).
        Internal cost tracks the platform's provider cost for margin analysis.
        Changes take effect immediately on the next enrichment call.
      </p>
    </div>
  );
}
