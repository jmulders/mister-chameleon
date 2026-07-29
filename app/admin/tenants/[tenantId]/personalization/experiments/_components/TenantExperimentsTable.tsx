"use client";

/**
 * TenantExperimentsTable
 *
 * Tenant admin view of the experiments list.  Shows all experiments with:
 *
 *   • A clear Enabled / Paused / Ended status pill
 *   • A one-click Enable / Pause quick-action (toggle active ↔ paused)
 *   • Inline edit form for name, traffic fraction, variants, and status
 *   • Delete button with a confirmation step
 *   • Slot badge (hero / proof / cta)
 *   • Traffic fraction
 *   • Variant buckets
 *
 * Uses server actions from the dashboard experiments module — no duplication
 * of write logic.  All navigation stays within the tenant admin scope.
 */

import React, { useState, useTransition }          from "react";
import { useRouter }                               from "next/navigation";
import { changeExperimentStatusAction,
         updateExperimentAction,
         deleteExperimentAction }                  from "@/app/dashboard/experiments/actions";
import type { ExperimentRow }                      from "@/data/types";
import type { VariantCatalogue, VariantEntry }      from "@/decision/rules/variant-catalogue";

// ── Types ─────────────────────────────────────────────────────────────────────

type Slot   = "hero" | "proof" | "cta";
type Status = "active" | "paused" | "ended";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  experiments:        ExperimentRow[];
  experimentsEnabled: boolean;
  /** Tenant slug — used to keep navigation within the tenant admin scope. */
  tenantId:           string;
  /** Optional variant catalogue for the edit form's variant selector. */
  variantCatalogue?:  VariantCatalogue;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TenantExperimentsTable({
  experiments,
  experimentsEnabled,
  tenantId,
  variantCatalogue,
}: Props) {
  const router = useRouter();

  const [togglingId, setTogglingId]   = useState<string | null>(null);
  const [savedId, setSavedId]         = useState<string | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [isPending, startTransition]  = useTransition();

  // ── Bulk selection ───────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulkTransition] = useTransition();

  const toggleSelect = (id: string) =>
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const selectAll = () => setSelected(new Set(experiments.filter((e) => e.status !== "ended").map((e) => e.id)));
  const clearSelection = () => setSelected(new Set());

  function bulkChangeStatus(ids: string[], next: Status) {
    setError(null);
    startBulkTransition(async () => {
      const results = await Promise.all(ids.map((id) => changeExperimentStatusAction(id, next)));
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        setError(`${failed.length} experiment(s) failed to update.`);
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  // ── Derived state ────────────────────────────────────────────────────────────
  const activeCount   = experiments.filter((e) => e.status === "active").length;

  // ── Status toggle ────────────────────────────────────────────────────────────
  function handleToggleStatus(exp: ExperimentRow) {
    const next: Status = exp.status === "active" ? "paused" : "active";
    setTogglingId(exp.id);
    setError(null);

    startTransition(async () => {
      const result = await changeExperimentStatusAction(exp.id, next);
      setTogglingId(null);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSavedId(exp.id);
      setTimeout(() => setSavedId((id) => (id === exp.id ? null : id)), 2500);
      router.refresh();
    });
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  function handleDeleteRequest(id: string) {
    setConfirmDeleteId(id);
    setError(null);
  }

  function handleDeleteConfirm(id: string) {
    setDeletingId(id);
    setConfirmDeleteId(null);
    setError(null);

    startTransition(async () => {
      const result = await deleteExperimentAction(id);
      setDeletingId(null);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  // ── Empty state ───────────────────────────────────────────────────────────────
  if (experiments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-8 py-12 text-center">
        <p className="text-sm font-medium text-neutral-600">No experiments yet</p>
        <p className="mt-1 text-xs text-neutral-400">
          Use the{" "}
          <a
            href={`/admin/tenants/${tenantId}/personalization/experiments`}
            className="text-brand-600 underline-offset-2 hover:underline"
          >
            create form above
          </a>
          {" "}to add your first experiment, then manage its status here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Global disabled context banner */}
      {!experimentsEnabled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Experiments globally disabled.</strong>{" "}
          No experiments are being evaluated for this tenant regardless of the status below.
          Enable the experiments engine above to resume A/B evaluation.
        </div>
      )}

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="shrink-0 text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {/* Bulk action toolbar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5">
          <span className="text-xs font-semibold text-brand-700">
            {selected.size} selected
          </span>
          <div className="ml-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const ids = [...selected].filter((id) => {
                  const exp = experiments.find((e) => e.id === id);
                  return exp && exp.status === "paused";
                });
                bulkChangeStatus(ids, "active");
              }}
              disabled={bulkPending}
              className="inline-flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
            >
              <PlayIcon /> Enable selected
            </button>
            <button
              type="button"
              onClick={() => {
                const ids = [...selected].filter((id) => {
                  const exp = experiments.find((e) => e.id === id);
                  return exp && exp.status === "active";
                });
                bulkChangeStatus(ids, "paused");
              }}
              disabled={bulkPending}
              className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
            >
              <PauseIcon /> Pause selected
            </button>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" onClick={selectAll} className="text-xs text-brand-600 hover:underline">All</button>
            <span className="text-neutral-300">|</span>
            <button type="button" onClick={clearSelection} className="text-xs text-neutral-500 hover:underline">Clear</button>
          </div>
        </div>
      )}

      {/* Select-all shortcut when nothing is selected */}
      {selected.size === 0 && experiments.some((e) => e.status !== "ended") && (
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <button type="button" onClick={selectAll} className="hover:text-neutral-600 hover:underline">Select all</button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50">
              <th className="w-8 px-3 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all experiments"
                  checked={selected.size > 0 && selected.size === experiments.filter((e) => e.status !== "ended").length}
                  onChange={(e) => e.target.checked ? selectAll() : clearSelection()}
                  className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                />
              </th>
              <Th>ID / Name</Th>
              <Th>Slot</Th>
              <Th>Variants</Th>
              <Th right>Traffic</Th>
              <Th>Status</Th>
              <Th right><span className="sr-only">Actions</span></Th>
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-50">
            {experiments.map((exp) => {
              const isToggling    = togglingId === exp.id && isPending;
              const isDeleting    = deletingId === exp.id && isPending;
              const wasSaved      = savedId    === exp.id;
              const isEditing     = editingId  === exp.id;
              const awaitConfirm  = confirmDeleteId === exp.id;
              const status        = exp.status as Status;
              const canToggle     = status !== "ended";

              return (
                <React.Fragment key={exp.id}>
                  {/* Main experiment row */}
                  <tr
                    className={`transition-colors ${
                      wasSaved ? "bg-green-50/60" : selected.has(exp.id) ? "bg-brand-50/40" : "hover:bg-neutral-50/40"
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="w-8 px-3 py-3 align-middle">
                      {status !== "ended" && (
                        <input
                          type="checkbox"
                          checked={selected.has(exp.id)}
                          onChange={() => toggleSelect(exp.id)}
                          aria-label={`Select ${exp.name}`}
                          className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                        />
                      )}
                    </td>
                    {/* ID / Name */}
                    <td className="px-4 py-3 align-middle">
                      <div className="flex flex-col gap-0.5">
                        <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-700 w-fit">
                          {exp.id}
                        </code>
                        <span className="text-xs font-medium text-neutral-700">{exp.name}</span>
                      </div>
                    </td>

                    {/* Slot */}
                    <td className="px-4 py-3 align-middle">
                      <SlotPill slot={exp.slot as Slot} />
                    </td>

                    {/* Variants */}
                    <td className="px-4 py-3 align-middle">
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {exp.variants.map((v, i) => (
                          <span
                            key={v}
                            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 font-mono text-xs text-neutral-600"
                          >
                            <span className="tabular-nums text-neutral-400">{i}</span>
                            {v}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Traffic */}
                    <td className="px-4 py-3 align-middle text-right">
                      <span className="tabular-nums text-xs text-neutral-600">
                        {Math.round(exp.traffic_fraction * 100)}%
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 align-middle">
                      <div className="flex flex-col gap-0.5">
                        <StatusBadge status={status} />
                        {wasSaved && (
                          <span className="text-[10px] font-medium text-green-700">✓ saved</span>
                        )}
                        {exp.ended_at && (
                          <span className="text-[10px] text-neutral-400">
                            ended {formatDate(exp.ended_at)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Action buttons */}
                    <td className="px-4 py-3 align-middle text-right">
                      <div className="flex items-center justify-end gap-1.5">

                        {/* Toggle status */}
                        {canToggle && (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(exp)}
                            disabled={isPending || isEditing}
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium shadow-sm transition-colors disabled:cursor-wait disabled:opacity-50 ${
                              status === "active"
                                ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                            }`}
                          >
                            {isToggling ? <SpinnerIcon /> : status === "active" ? <PauseIcon /> : <PlayIcon />}
                            {isToggling ? "Saving…" : status === "active" ? "Pause" : "Enable"}
                          </button>
                        )}

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => setEditingId(isEditing ? null : exp.id)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 shadow-sm transition-colors hover:bg-neutral-50 disabled:opacity-50"
                        >
                          <EditIcon />
                          {isEditing ? "Cancel" : "Edit"}
                        </button>

                        {/* Delete */}
                        {awaitConfirm ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-red-600">Sure?</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteConfirm(exp.id)}
                              disabled={isPending}
                              className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 shadow-sm hover:bg-red-100 disabled:opacity-50"
                            >
                              {isDeleting ? <SpinnerIcon /> : "Delete"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-500 shadow-sm hover:bg-neutral-50"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDeleteRequest(exp.id)}
                            disabled={isPending}
                            className="inline-flex items-center gap-1 rounded-md border border-red-100 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 shadow-sm transition-colors hover:bg-red-100 disabled:opacity-50"
                          >
                            <TrashIcon />
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Inline edit row */}
                  {isEditing && (
                    <tr className="bg-neutral-50/70">
                      <td colSpan={7} className="px-4 py-4">
                        <InlineEditForm
                          exp={exp}
                          variantCatalogue={variantCatalogue}
                          onDone={() => {
                            setEditingId(null);
                            setSavedId(exp.id);
                            setTimeout(() => setSavedId((id) => (id === exp.id ? null : id)), 2500);
                            router.refresh();
                          }}
                          onCancel={() => setEditingId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-neutral-400">
        Status changes are reflected immediately in the decision engine.
        Use <strong>Edit</strong> to update name, traffic, or variants.
        Use <strong>Delete</strong> to permanently remove an experiment.
      </p>
    </div>
  );
}

// ── Inline edit form ──────────────────────────────────────────────────────────

interface InlineEditFormProps {
  exp:              ExperimentRow;
  variantCatalogue?: VariantCatalogue;
  onDone:           () => void;
  onCancel:         () => void;
}

function InlineEditForm({ exp, variantCatalogue, onDone, onCancel }: InlineEditFormProps) {
  const [name,     setName]     = useState(exp.name);
  const [traffic,  setTraffic]  = useState(String(Math.round(exp.traffic_fraction * 100)));
  const [status,   setStatus]   = useState<Status>(exp.status as Status);
  const [selected, setSelected] = useState<Set<string>>(new Set(exp.variants));
  const [error,    setError]    = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const slot    = exp.slot as Slot;
  const entries = variantCatalogue?.[slot] as VariantEntry[] | undefined;

  function toggleVariant(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  function handleSave() {
    setError(null);
    const tf = parseFloat(traffic) / 100;
    if (isNaN(tf) || tf <= 0 || tf > 1) {
      setError("Traffic must be 1–100.");
      return;
    }
    if (selected.size < 2) {
      setError("Select at least 2 variants.");
      return;
    }

    startTransition(async () => {
      const result = await updateExperimentAction(exp.id, {
        name:             name.trim(),
        status,
        traffic_fraction: tf,
        variants:         [...selected],
        slot,
      });

      if (!result.ok) {
        setError(result.error + (result.fieldErrors ? "\n" + result.fieldErrors.join("\n") : ""));
        return;
      }

      onDone();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Edit experiment — <code className="font-mono normal-case">{exp.id}</code>
      </p>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 whitespace-pre-wrap">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Name */}
        <div className="col-span-2 sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-neutral-600">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Traffic */}
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Traffic %</label>
          <input
            type="number"
            value={traffic}
            onChange={(e) => setTraffic(e.target.value)}
            min={1}
            max={100}
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Status */}
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="ended">Ended</option>
          </select>
        </div>
      </div>

      {/* Variant selector */}
      {entries && entries.length > 0 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            Variants <span className="text-neutral-400">(select ≥ 2)</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {entries.map((entry) => {
              const checked = selected.has(entry.key);
              return (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => toggleVariant(entry.key)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    checked
                      ? "border-brand-300 bg-brand-50 text-brand-700"
                      : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300"
                  }`}
                >
                  {entry.key}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
        >
          {isPending ? <SpinnerIcon /> : null}
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 shadow-sm hover:bg-neutral-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

const SLOT_CONFIG: Record<Slot, { cls: string }> = {
  hero:  { cls: "border-violet-200 bg-violet-50 text-violet-700" },
  proof: { cls: "border-sky-200    bg-sky-50    text-sky-700"    },
  cta:   { cls: "border-amber-200  bg-amber-50  text-amber-700"  },
};

function SlotPill({ slot }: { slot: Slot }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${SLOT_CONFIG[slot].cls}`}
    >
      {slot}
    </span>
  );
}

const STATUS_CONFIG: Record<Status, { dot: string; text: string }> = {
  active: { dot: "bg-green-500",    text: "text-green-700"   },
  paused: { dot: "bg-amber-400",    text: "text-amber-700"   },
  ended:  { dot: "bg-neutral-300",  text: "text-neutral-500" },
};

function StatusBadge({ status }: { status: Status }) {
  const { dot, text } = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${text}`}>
      <span className={`size-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch {
    return iso;
  }
}

// ── SVG icons ─────────────────────────────────────────────────────────────────

function PauseIcon() {
  return (
    <svg className="size-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <rect x="2" y="1.5" width="3" height="9" rx="0.75" />
      <rect x="7" y="1.5" width="3" height="9" rx="0.75" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="size-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <path d="M3 2l7 4-7 4V2z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="size-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M8.5 1.5l2 2L4 10 1.5 10.5 2 8 8.5 1.5z" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="size-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M1.5 3.5h9M4 3.5V2h4v1.5M5 5.5v3M7 5.5v3M2.5 3.5l.5 7h6l.5-7" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="size-3 animate-spin" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M6 1.5A4.5 4.5 0 1 1 1.5 6" strokeLinecap="round" />
    </svg>
  );
}
