"use client";

/**
 * VariantUsagePanel
 *
 *
 * Shows per-slot variant usage statistics for the current tenant's rules config.
 * Helps operators prevent content explosion by surfacing dead, single-use, and
 * well-reused variants at a glance.
 *
 * ─── Visual indicators ────────────────────────────────────────────────────────
 *
 *   Each variant row is colour-coded by ruleCount:
 *     grey   (0 rules) — dead content; safe to archive
 *     yellow (1 rule)  — single-use; consider sharing with another archetype
 *     green  (2+ rules)— reused; healthy
 *
 *   The slot header shows a progress bar and count badge (current / budget).
 *   The bar turns amber at 75 % and red at or above the ceiling.
 *
 * ─── Collapsible sections ─────────────────────────────────────────────────────
 *
 *   Each slot section is independently collapsible so operators can focus on
 *   the slots that need attention.
 */

import { useState } from "react";
import type { AllSlotUsage, SlotUsageSummary, VariantUsageStat, ContentBudget } from "@/decision/rules/variant-usage";
import { SLOT_BUDGET_KEY, slotBudgetStatus } from "@/decision/rules/variant-usage";
import { RefreshButton } from "./RefreshButton";

// ── Props ──────────────────────────────────────────────────────────────────────

export interface VariantUsagePanelProps {
  usage:  AllSlotUsage;
  budget: ContentBudget;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function VariantUsagePanel({ usage, budget }: VariantUsagePanelProps) {
  const slots = Object.values(usage) as SlotUsageSummary[];

  // Surface slots that need attention first (over → warning → ok).
  const sorted = [...slots].sort((a, b) => {
    const priority = { over: 0, warning: 1, ok: 2 };
    const aStatus  = slotBudgetStatus(a.total, budget[SLOT_BUDGET_KEY[a.slot]]);
    const bStatus  = slotBudgetStatus(b.total, budget[SLOT_BUDGET_KEY[b.slot]]);
    if (aStatus !== bStatus) return priority[aStatus] - priority[bStatus];
    // Within same status: most unused (dead content) first.
    return b.unused - a.unused;
  });

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Variant Usage</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Shows how many rules reference each variant key. Dead variants waste Sanity quota;
            single-use variants are candidates for consolidation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <RefreshButton />
          <Legend />
        </div>
      </div>

      {/* Slot sections */}
      <div className="divide-y divide-neutral-100">
        {sorted.map((slot) => (
          <SlotSection
            key={slot.slot}
            slot={slot}
            max={budget[SLOT_BUDGET_KEY[slot.slot]]}
          />
        ))}
      </div>
    </div>
  );
}

// ── SlotSection ────────────────────────────────────────────────────────────────

function SlotSection({
  slot,
  max,
}: {
  slot: SlotUsageSummary;
  max:  number;
}) {
  const [open, setOpen] = useState(slot.unused > 0 || slotBudgetStatus(slot.total, max) !== "ok");
  const status = slotBudgetStatus(slot.total, max);

  return (
    <div>
      {/* Slot header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-neutral-50 transition-colors"
      >
        {/* Slot name + summary badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-neutral-800">{slot.label}</span>
            <SummaryBadge count={slot.reused}  label="reused"     color="green"  />
            <SummaryBadge count={slot.active - slot.reused} label="single-use" color="yellow" />
            {slot.unused > 0 && (
              <SummaryBadge count={slot.unused} label="dead"      color="grey"   />
            )}
          </div>
          {/* Budget progress bar */}
          <BudgetBar total={slot.total} max={max} status={status} />
        </div>

        {/* Count + chevron */}
        <div className="flex items-center gap-2 shrink-0">
          <BudgetBadge total={slot.total} max={max} status={status} />
          <ChevronIcon open={open} />
        </div>
      </button>

      {/* Variant rows */}
      {open && (
        <div className="px-5 pb-4">
          <div className="rounded-lg border border-neutral-100 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-100">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-neutral-500 w-1/2">Variant key</th>
                  <th className="px-3 py-2 text-left font-medium text-neutral-500 hidden sm:table-cell">Source</th>
                  <th className="px-3 py-2 text-right font-medium text-neutral-500 w-20">Rules</th>
                  <th className="px-3 py-2 text-left font-medium text-neutral-500 w-24">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {slot.variants.map((v) => (
                  <VariantRow key={v.key} variant={v} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── VariantRow ─────────────────────────────────────────────────────────────────

function VariantRow({ variant }: { variant: VariantUsageStat }) {
  const usageStatus =
    variant.ruleCount === 0 ? "dead"
    : variant.ruleCount === 1 ? "single"
    : "reused";

  const rowBg =
    usageStatus === "dead"   ? "bg-neutral-50/60"
    : usageStatus === "single" ? ""
    : "";

  return (
    <tr className={`${rowBg} hover:bg-neutral-50 transition-colors`}>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-mono text-neutral-700 truncate">{variant.key}</span>
          <span className="text-neutral-400 truncate hidden sm:block">{variant.label !== variant.key ? variant.label : ""}</span>
        </div>
        {variant.isDefault && (
          <span className="mt-0.5 inline-block rounded-full bg-neutral-100 border border-neutral-200 px-1.5 py-0 text-[9px] font-medium text-neutral-500">
            default
          </span>
        )}
      </td>
      <td className="px-3 py-2 hidden sm:table-cell">
        <SourceBadge source={variant.source} />
      </td>
      <td className="px-3 py-2 text-right font-mono font-medium text-neutral-700">
        {variant.ruleCount}
      </td>
      <td className="px-3 py-2">
        <UsageStatusBadge status={usageStatus} />
      </td>
    </tr>
  );
}

// ── Primitives ─────────────────────────────────────────────────────────────────

function BudgetBar({
  total,
  max,
  status,
}: {
  total:  number;
  max:    number;
  status: "ok" | "warning" | "over";
}) {
  const pct = Math.min(100, Math.round((total / max) * 100));
  const barColor =
    status === "over"    ? "bg-red-500"
    : status === "warning" ? "bg-amber-400"
    : "bg-emerald-400";

  return (
    <div className="mt-1.5 h-1 w-full max-w-[180px] rounded-full bg-neutral-100 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${barColor}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function BudgetBadge({
  total,
  max,
  status,
}: {
  total:  number;
  max:    number;
  status: "ok" | "warning" | "over";
}) {
  const cls =
    status === "over"    ? "bg-red-50 text-red-700 border-red-200"
    : status === "warning" ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-neutral-50 text-neutral-600 border-neutral-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-mono font-medium ${cls}`}>
      {total} / {max}
    </span>
  );
}

function SummaryBadge({
  count,
  label,
  color,
}: {
  count: number;
  label: string;
  color: "green" | "yellow" | "grey";
}) {
  if (count === 0) return null;
  const cls =
    color === "green"  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : color === "yellow" ? "bg-amber-50   text-amber-700   border-amber-200"
    : "bg-neutral-100  text-neutral-500  border-neutral-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[10px] font-medium ${cls}`}>
      {count} {label}
    </span>
  );
}

function UsageStatusBadge({
  status,
}: {
  status: "dead" | "single" | "reused";
}) {
  if (status === "dead") {
    return (
      <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-100 px-1.5 py-0 text-[10px] font-medium text-neutral-500">
        dead
      </span>
    );
  }
  if (status === "single") {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0 text-[10px] font-medium text-amber-700">
        single-use
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0 text-[10px] font-medium text-emerald-700">
      reused
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  if (source === "platform") {
    return (
      <span className="inline-flex items-center rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0 text-[10px] font-medium text-neutral-500">
        platform
      </span>
    );
  }
  if (source === "cms-tenant") {
    return (
      <span className="inline-flex items-center rounded border border-violet-200 bg-violet-50 px-1.5 py-0 text-[10px] font-medium text-violet-600">
        cms · tenant
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded border border-sky-200 bg-sky-50 px-1.5 py-0 text-[10px] font-medium text-sky-600">
      cms · shared
    </span>
  );
}

function Legend() {
  return (
    <div className="hidden md:flex items-center gap-3 text-[10px] text-neutral-500">
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> reused (≥ 2)
      </span>
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> single-use (1)
      </span>
      <span className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-neutral-300 inline-block" /> dead (0)
      </span>
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
