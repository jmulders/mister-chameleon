"use client";

/**
 * ExperimentsTable
 *
 * Client component that renders the experiments table with inline editing.
 * Each row has an Edit button that expands a full-width edit panel immediately
 * below it. Only one row can be in edit mode at a time.
 *
 * ─── Edit panel fields ────────────────────────────────────────────────────────
 *
 *   name             Free text, ≤ 100 chars.
 *   status           Segmented button: active / paused / ended.
 *   variants         Checkboxes restricted to the per-slot allow-list.
 *                    Slot is read-only (shown as a badge, not editable).
 *   traffic_fraction Entered as a whole percentage (1–100).
 *
 * ─── After save ───────────────────────────────────────────────────────────────
 *
 *   Calls router.refresh() so the parent server component re-fetches and passes
 *   updated props back. The edit panel closes; a per-row success indicator
 *   appears briefly in the table row.
 */

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateExperimentAction } from "@/app/dashboard/experiments/actions";
import type { ExperimentRow } from "@/data/types";
import {
  ALLOWED_HERO_KEYS,
  ALLOWED_PROOF_KEYS,
  ALLOWED_CTA_KEYS,
} from "@/decision/rules/stored-rule";

// ── Types ─────────────────────────────────────────────────────────────────────

type Slot = "hero" | "proof" | "cta";
type Status = "active" | "paused" | "ended";

const VALID_STATUSES: Status[] = ["active", "paused", "ended"];

const VARIANTS_FOR_SLOT: Record<Slot, readonly string[]> = {
  hero: ALLOWED_HERO_KEYS,
  proof: ALLOWED_PROOF_KEYS,
  cta: ALLOWED_CTA_KEYS,
};

interface EditDraft {
  name: string;
  status: Status;
  selectedVariants: Set<string>;
  trafficPct: string;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  experiments: ExperimentRow[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ExperimentsTable({ experiments }: Props) {
  const router = useRouter();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  const [isPending, startTransition] = useTransition();

  function openEdit(exp: ExperimentRow) {
    setEditingId(exp.id);
    setDraft({
      name: exp.name,
      status: exp.status as Status,
      selectedVariants: new Set(exp.variants),
      trafficPct: String(Math.round(exp.traffic_fraction * 100)),
    });
    setErrorMsg(null);
    setFieldErrors([]);
  }

  function closeEdit() {
    setEditingId(null);
    setDraft(null);
    setErrorMsg(null);
    setFieldErrors([]);
  }

  function toggleVariant(key: string) {
    if (!draft) return;

    setDraft((d) => {
      if (!d) return d;
      const next = new Set(d.selectedVariants);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...d, selectedVariants: next };
    });
  }

  function handleSave(exp: ExperimentRow) {
    if (!draft) return;

    setErrorMsg(null);
    setFieldErrors([]);

    const slotKeys = VARIANTS_FOR_SLOT[exp.slot as Slot];
    const variants = slotKeys.filter((k) => draft.selectedVariants.has(k));
    const tf = parseFloat(draft.trafficPct) / 100;

    const payload = {
      name: draft.name.trim(),
      status: draft.status,
      variants,
      slot: exp.slot,
      traffic_fraction: tf,
    };

    startTransition(async () => {
      const result = await updateExperimentAction(exp.id, payload);

      if (!result.ok) {
        setErrorMsg(result.error);
        setFieldErrors(result.fieldErrors ?? []);
        return;
      }

      closeEdit();
      setSavedId(exp.id);
      setTimeout(() => setSavedId((id) => (id === exp.id ? null : id)), 3000);
      router.refresh();
    });
  }

  if (experiments.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-100 bg-neutral-50">
            <Th>ID</Th>
            <Th>Name</Th>
            <Th>Slot</Th>
            <Th>Variants</Th>
            <Th>Status</Th>
            <Th right>Traffic</Th>
            <Th right>Created</Th>
            <Th right>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>

        <tbody className="divide-y divide-neutral-50">
          {experiments.map((exp) => {
            const isEditing = editingId === exp.id;
            const wasSaved = savedId === exp.id;

            return (
              <React.Fragment key={exp.id}>
                <tr
                  className={[
                    "transition-colors",
                    isEditing
                      ? "bg-brand-50/40"
                      : wasSaved
                        ? "bg-green-50/60"
                        : "hover:bg-neutral-50/60",
                  ].join(" ")}
                >
                  <td className="px-4 py-3 align-middle">
                    <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-700">
                      {exp.id}
                    </code>
                  </td>

                  <td className="px-4 py-3 align-middle">
                    <span className={`font-medium ${isEditing ? "text-neutral-500" : "text-neutral-800"}`}>
                      {exp.name}
                    </span>
                    {wasSaved && (
                      <span className="ml-2 text-xs font-medium text-green-700">✓ saved</span>
                    )}
                  </td>

                  <td className="px-4 py-3 align-middle">
                    <SlotPill slot={exp.slot as Slot} />
                  </td>

                  <td className="px-4 py-3 align-middle">
                    <div className="flex max-w-xs flex-wrap gap-1">
                      {exp.variants.map((v, i) => (
                        <span
                          key={v}
                          className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 font-mono text-xs text-neutral-700"
                        >
                          <span className="tabular-nums text-neutral-400">{i}</span>
                          {v}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="px-4 py-3 align-middle">
                    <StatusBadge status={exp.status as Status} />
                    {exp.ended_at && (
                      <p className="mt-1 text-xs text-neutral-400">
                        ended {formatDate(exp.ended_at)}
                      </p>
                    )}
                  </td>

                  <td className="px-4 py-3 align-middle text-right">
                    <span className="tabular-nums text-neutral-700">
                      {Math.round(exp.traffic_fraction * 100)}%
                    </span>
                    <div className="ml-auto mt-1 h-1 w-16 rounded-full bg-neutral-100">
                      <div
                        className="h-1 rounded-full bg-brand-500"
                        style={{ width: `${Math.round(exp.traffic_fraction * 100)}%` }}
                      />
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 align-middle text-right text-xs tabular-nums text-neutral-500">
                    {formatDate(exp.created_at)}
                  </td>

                  <td className="px-4 py-3 align-middle text-right">
                    {isEditing ? (
                      <button
                        type="button"
                        onClick={closeEdit}
                        disabled={isPending}
                        className="text-xs text-neutral-400 transition-colors hover:text-neutral-700 disabled:opacity-40"
                      >
                        Cancel
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openEdit(exp)}
                        className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 shadow-sm transition-colors hover:border-neutral-300 hover:bg-neutral-50"
                      >
                        <EditIcon />
                        Edit
                      </button>
                    )}
                  </td>
                </tr>

                {isEditing && draft && (
                  <tr>
                    <td
                      colSpan={8}
                      className="border-b border-brand-100 bg-brand-50/30 px-0 py-0"
                    >
                      <EditPanel
                        exp={exp}
                        draft={draft}
                        setDraft={setDraft}
                        isPending={isPending}
                        errorMsg={errorMsg}
                        fieldErrors={fieldErrors}
                        onToggleVariant={toggleVariant}
                        onSave={() => handleSave(exp)}
                        onCancel={closeEdit}
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
  );
}

// ── EditPanel ─────────────────────────────────────────────────────────────────

interface EditPanelProps {
  exp: ExperimentRow;
  draft: EditDraft;
  setDraft: React.Dispatch<React.SetStateAction<EditDraft | null>>;
  isPending: boolean;
  errorMsg: string | null;
  fieldErrors: string[];
  onToggleVariant: (key: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

function EditPanel({
  exp,
  draft,
  setDraft,
  isPending,
  errorMsg,
  fieldErrors,
  onToggleVariant,
  onSave,
  onCancel,
}: EditPanelProps) {
  const availableKeys = VARIANTS_FOR_SLOT[exp.slot as Slot];
  const selectedCount = draft.selectedVariants.size;
  const variantsValid = selectedCount >= 2;

  return (
    <div className="px-5 py-5">
      <div className="mb-4 flex items-center gap-2">
        <EditIcon className="text-neutral-400" />
        <span className="text-xs font-semibold text-neutral-600">
          Editing{" "}
          <code className="rounded bg-neutral-200 px-1 py-0.5 font-mono text-neutral-700">
            {exp.id}
          </code>
        </span>
        <span className="ml-1 text-xs text-neutral-400">
          (id and slot are immutable)
        </span>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        <Field label="Display Name" required>
          <input
            type="text"
            value={draft.name}
            onChange={(e) =>
              setDraft((d) => (d ? { ...d, name: e.target.value } : d))
            }
            className={inputCls}
            disabled={isPending}
          />
        </Field>

        <Field label="Traffic fraction" hint="Percentage of sessions enrolled (1–100)">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={draft.trafficPct}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, trafficPct: e.target.value } : d))
              }
              className={[inputCls, "w-24 tabular-nums"].join(" ")}
              disabled={isPending}
            />
            <span className="text-sm text-neutral-500">%</span>
          </div>
        </Field>

        <Field label="Status">
          <div className="flex gap-2">
            {VALID_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setDraft((d) => (d ? { ...d, status: s } : d))}
                disabled={isPending}
                className={[
                  "flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                  draft.status === s
                    ? STATUS_ACTIVE_CLS[s]
                    : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-neutral-700",
                ].join(" ")}
              >
                {s}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Slot" hint="Immutable after creation">
          <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
            <SlotPill slot={exp.slot as Slot} />
            <span className="text-xs text-neutral-400">cannot be changed</span>
          </div>
        </Field>

        <Field
          label="Variants"
          hint={`Bucket 0 is listed first · select ≥ 2 · allow-list for ${exp.slot}`}
          span2
        >
          <div className="flex flex-wrap gap-2">
            {availableKeys.map((key, idx) => {
              const checked = draft.selectedVariants.has(key);
              const bucketIndex = checked
                ? availableKeys.filter(
                    (k) => draft.selectedVariants.has(k) && availableKeys.indexOf(k) <= idx,
                  ).length - 1
                : null;

              return (
                <label
                  key={key}
                  className={[
                    "inline-flex cursor-pointer select-none items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors",
                    checked
                      ? "border-brand-300 bg-brand-50 text-brand-800"
                      : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300",
                    isPending ? "pointer-events-none opacity-60" : "",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleVariant(key)}
                    className="sr-only"
                    disabled={isPending}
                  />
                  {checked && bucketIndex !== null ? (
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white tabular-nums">
                      {bucketIndex}
                    </span>
                  ) : (
                    <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-neutral-300" />
                  )}
                  <span className="font-mono">{key}</span>
                </label>
              );
            })}
          </div>

          {selectedCount === 1 && (
            <p className="mt-2 text-xs text-amber-700">
              Select at least one more variant (minimum 2).
            </p>
          )}

          {selectedCount === 0 && (
            <p className="mt-2 text-xs text-neutral-400">
              No variants selected — select at least 2.
            </p>
          )}
        </Field>
      </div>

      {fieldErrors.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="mb-1.5 text-xs font-semibold text-red-700">
            Fix the following before saving:
          </p>
          <ul className="space-y-0.5">
            {fieldErrors.map((e) => (
              <li key={e} className="text-xs text-red-700">
                {e}
              </li>
            ))}
          </ul>
        </div>
      )}

      {errorMsg && fieldErrors.length === 0 && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      <div className="mt-5 flex items-center justify-end gap-3 border-t border-neutral-200 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-600 shadow-sm transition-colors hover:bg-neutral-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isPending || !variantsValid}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-600 active:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending && <SpinnerIcon />}
          {isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

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
  hero: { cls: "border-violet-200 bg-violet-50 text-violet-700" },
  proof: { cls: "border-sky-200 bg-sky-50 text-sky-700" },
  cta: { cls: "border-amber-200 bg-amber-50 text-amber-700" },
};

function SlotPill({ slot, inline }: { slot: Slot; inline?: boolean }) {
  const { cls } = SLOT_CONFIG[slot];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}${
        inline ? " mx-0.5" : ""
      }`}
    >
      {slot}
    </span>
  );
}

const STATUS_CONFIG: Record<Status, { dot: string; text: string }> = {
  active: { dot: "bg-green-500", text: "text-green-700" },
  paused: { dot: "bg-amber-400", text: "text-amber-700" },
  ended: { dot: "bg-neutral-300", text: "text-neutral-500" },
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

function Field({
  label,
  hint,
  required,
  span2,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  span2?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={span2 ? "sm:col-span-2" : undefined}>
      <label className="mb-1.5 block">
        <span className="text-xs font-semibold text-neutral-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </span>
        {hint && <span className="mt-0.5 block text-xs text-neutral-400">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

// ── Style constants ────────────────────────────────────────────────────────────

const inputCls =
  "block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-50";

const STATUS_ACTIVE_CLS: Record<Status, string> = {
  active: "border-green-300 bg-green-50 text-green-700",
  paused: "border-amber-300 bg-amber-50 text-amber-700",
  ended: "border-neutral-300 bg-neutral-100 text-neutral-600",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

// ── SVG icons ─────────────────────────────────────────────────────────────────

function EditIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`size-3.5 ${className ?? "text-neutral-400"}`}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 2.5a1.5 1.5 0 0 1 2.5 1.5L5 12.5 2 13.5l1-3L11 2.5Z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="size-3.5 animate-spin"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="M8 1.5A6.5 6.5 0 1 1 1.5 8" strokeLinecap="round" />
    </svg>
  );
}