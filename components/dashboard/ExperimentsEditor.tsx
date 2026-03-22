"use client";

/**
 * ExperimentsEditor
 *
 * Internal dashboard UI for managing A/B experiments.
 * Displays all experiments in a table, supports creating new experiments, and
 * allows inline editing of name, status, traffic fraction, and variant buckets.
 *
 * ─── Safety ────────────────────────────────────────────────────────────────────
 *
 *   Variant key selects are bound to ALLOWED_*_KEYS from the stored-rule
 *   vocabulary — no free-text input reaches variant fields. Slot is a
 *   constrained enum. Final save is validated server-side regardless of
 *   client-side guards.
 *
 * ─── Conflict detection ────────────────────────────────────────────────────────
 *
 *   A warning banner appears when two or more experiments with status "active"
 *   share the same slot. The ExperimentDecisionProvider resolves conflicts by
 *   using the first experiment (by created_at order), but running two active
 *   experiments on the same slot is almost certainly a configuration mistake.
 *
 * ─── Traffic fraction ──────────────────────────────────────────────────────────
 *
 *   Stored as a decimal (0 < f ≤ 1) in Supabase.
 *   Displayed and edited as a whole percentage (1–100%) in the UI.
 */

import { useState, useCallback, useMemo } from "react";
import {
  createExperimentAction,
  updateExperimentAction,
} from "@/app/dashboard/experiments/actions";
import type { ExperimentRow } from "@/data/types";
import {
  ALLOWED_HERO_KEYS,
  ALLOWED_PROOF_KEYS,
  ALLOWED_CTA_KEYS,
} from "@/decision/rules/stored-rule";

// ── Constants ─────────────────────────────────────────────────────────────────

type Slot   = "hero" | "proof" | "cta";
type Status = "active" | "paused" | "ended";

const VALID_SLOTS:    readonly Slot[]   = ["hero", "proof", "cta"];
const VALID_STATUSES: readonly Status[] = ["active", "paused", "ended"];

const VARIANTS_FOR_SLOT: Record<Slot, readonly string[]> = {
  hero:  ALLOWED_HERO_KEYS,
  proof: ALLOWED_PROOF_KEYS,
  cta:   ALLOWED_CTA_KEYS,
};

const SLOT_LABELS: Record<Slot, string> = {
  hero:  "Hero",
  proof: "Proof",
  cta:   "CTA",
};

const STATUS_LABELS: Record<Status, string> = {
  active: "Active",
  paused: "Paused",
  ended:  "Ended",
};

// ── Draft types ───────────────────────────────────────────────────────────────

interface CreateDraft {
  id:         string;
  name:       string;
  slot:       Slot;
  trafficPct: string; // "10" = 10% → stored as 0.1
  variants:   string[];
  status:     Status;
}

interface EditDraft {
  name:       string;
  status:     Status;
  trafficPct: string;
  variants:   string[];
}

function defaultCreateDraft(): CreateDraft {
  return {
    id:         "",
    name:       "",
    slot:       "hero",
    trafficPct: "10",
    variants:   [VARIANTS_FOR_SLOT.hero[0], VARIANTS_FOR_SLOT.hero[1]],
    status:     "active",
  };
}

function editDraftFromRow(row: ExperimentRow): EditDraft {
  return {
    name:       row.name,
    status:     row.status as Status,
    trafficPct: String(Math.round(row.traffic_fraction * 100 * 10) / 10),
    variants:   [...row.variants],
  };
}

function pctToFraction(pct: string): number {
  return parseFloat(pct) / 100;
}

// ── Main component ─────────────────────────────────────────────────────────────

interface ExperimentsEditorProps {
  initialExperiments: ExperimentRow[];
}

export function ExperimentsEditor({ initialExperiments }: ExperimentsEditorProps) {
  const [experiments, setExperiments] = useState<ExperimentRow[]>(initialExperiments);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [editDraft,   setEditDraft]   = useState<EditDraft | null>(null);
  const [showCreate,  setShowCreate]  = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateDraft>(defaultCreateDraft);

  const [saving,     setSaving]     = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  // ── Conflict detection ─────────────────────────────────────────────────────

  const conflictSlots = useMemo<Slot[]>(() => {
    const counts: Partial<Record<Slot, number>> = {};
    experiments
      .filter((e) => e.status === "active")
      .forEach((e) => {
        const s = e.slot as Slot;
        counts[s] = (counts[s] ?? 0) + 1;
      });
    return (Object.entries(counts) as [Slot, number][])
      .filter(([, n]) => n > 1)
      .map(([slot]) => slot);
  }, [experiments]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const clearMessages = useCallback(() => {
    setSuccessMsg(null);
    setErrorMsg(null);
    setFieldErrors([]);
  }, []);

  const openEdit = useCallback((row: ExperimentRow) => {
    setEditingId(row.id);
    setEditDraft(editDraftFromRow(row));
    clearMessages();
  }, [clearMessages]);

  const closeEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft(null);
  }, []);

  // ── Create ────────────────────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    clearMessages();
    setSaving(true);

    const payload = {
      id:               createDraft.id.trim(),
      name:             createDraft.name.trim(),
      slot:             createDraft.slot,
      variants:         createDraft.variants,
      traffic_fraction: pctToFraction(createDraft.trafficPct),
      status:           createDraft.status,
    };

    const result = await createExperimentAction(payload);
    setSaving(false);

    if (!result.ok) {
      setErrorMsg(result.error);
      if ("fieldErrors" in result && result.fieldErrors) setFieldErrors(result.fieldErrors);
      return;
    }

    setExperiments((prev) => [result.experiment, ...prev]);
    setSuccessMsg(`Experiment "${result.experiment.name}" created.`);
    setShowCreate(false);
    setCreateDraft(defaultCreateDraft());
  }, [createDraft, clearMessages]);

  // ── Save edit ─────────────────────────────────────────────────────────────

  const handleSaveEdit = useCallback(async (experimentId: string) => {
    if (!editDraft) return;
    clearMessages();
    setSaving(true);

    const row = experiments.find((e) => e.id === experimentId);
    const payload = {
      name:             editDraft.name.trim(),
      status:           editDraft.status,
      traffic_fraction: pctToFraction(editDraft.trafficPct),
      variants:         editDraft.variants,
      slot:             row?.slot, // for server-side variant validation
    };

    const result = await updateExperimentAction(experimentId, payload);
    setSaving(false);

    if (!result.ok) {
      setErrorMsg(result.error);
      if ("fieldErrors" in result && result.fieldErrors) setFieldErrors(result.fieldErrors);
      return;
    }

    setExperiments((prev) =>
      prev.map((e) => (e.id === experimentId ? result.experiment : e)),
    );
    setSuccessMsg(`"${result.experiment.name}" saved.`);
    closeEdit();
  }, [editDraft, experiments, closeEdit, clearMessages]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-8 px-8 py-8">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-neutral-900">Experiments</h1>
          <p className="text-sm text-neutral-500">
            A/B tests that override variant slots after the rules engine resolves a plan.
            Only the first active experiment per slot (by creation date) takes effect.
          </p>
        </div>
        {!showCreate && (
          <button
            type="button"
            onClick={() => { setShowCreate(true); clearMessages(); }}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
          >
            <span aria-hidden className="text-brand-200">+</span>
            New experiment
          </button>
        )}
      </div>

      {/* ── Status messages ──────────────────────────────────────────────────── */}
      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm">
          <p className="font-medium text-red-800">{errorMsg}</p>
          {fieldErrors.length > 0 && (
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-red-700">
              {fieldErrors.map((e, i) => (
                <li key={i} className="font-mono text-xs">{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {successMsg}
        </div>
      )}

      {/* ── Slot conflict warning ────────────────────────────────────────────── */}
      {conflictSlots.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">
            {conflictSlots.length === 1
              ? `Multiple active experiments are targeting the "${conflictSlots[0]}" slot.`
              : `Multiple active experiments are targeting the ${conflictSlots.map((s) => `"${s}"`).join(" and ")} slots.`}
          </p>
          <p className="mt-1 text-amber-700">
            Only the first experiment per slot (by creation date) will be applied.
            Pause or end the duplicates to avoid confusion.
          </p>
        </div>
      )}

      {/* ── Create form ─────────────────────────────────────────────────────── */}
      {showCreate && (
        <CreateForm
          draft={createDraft}
          saving={saving}
          onChange={setCreateDraft}
          onSubmit={handleCreate}
          onCancel={() => { setShowCreate(false); setCreateDraft(defaultCreateDraft()); clearMessages(); }}
        />
      )}

      {/* ── Experiments list ─────────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-neutral-800">All experiments</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {experiments.length} experiment{experiments.length === 1 ? "" : "s"} total ·{" "}
              {experiments.filter((e) => e.status === "active").length} active
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {experiments.length === 0 && (
            <div className="rounded-lg border border-dashed border-neutral-300 py-12 text-center text-sm text-neutral-400">
              No experiments yet. Click &ldquo;New experiment&rdquo; to create one.
            </div>
          )}
          {experiments.map((exp) => (
            <ExperimentCard
              key={exp.id}
              experiment={exp}
              isEditing={editingId === exp.id}
              editDraft={editingId === exp.id ? editDraft : null}
              saving={saving && editingId === exp.id}
              onEdit={() => openEdit(exp)}
              onCancelEdit={closeEdit}
              onSaveEdit={() => handleSaveEdit(exp.id)}
              onDraftChange={(patch) => setEditDraft((prev) => prev ? { ...prev, ...patch } : prev)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

// ── CreateForm ────────────────────────────────────────────────────────────────

interface CreateFormProps {
  draft:    CreateDraft;
  saving:   boolean;
  onChange: (d: CreateDraft) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

function CreateForm({ draft, saving, onChange, onSubmit, onCancel }: CreateFormProps) {
  const set = <K extends keyof CreateDraft>(key: K, value: CreateDraft[K]) =>
    onChange({ ...draft, [key]: value });

  // When slot changes, reset variants to the default two for that slot.
  const handleSlotChange = (slot: Slot) => {
    const keys = VARIANTS_FOR_SLOT[slot];
    onChange({
      ...draft,
      slot,
      variants: [keys[0], keys[1]],
    });
  };

  return (
    <div className="rounded-xl border border-brand-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-neutral-100 bg-brand-50/50 px-5 py-3">
        <h2 className="text-sm font-semibold text-brand-800">New experiment</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create"}
          </button>
        </div>
      </div>

      <div className="px-5 py-5">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

          {/* Left: identity */}
          <div className="flex flex-col gap-4">
            <Field label="ID slug" hint="Stable identifier. Lowercase letters, digits, underscores, hyphens. Cannot be changed.">
              <input
                type="text"
                value={draft.id}
                onChange={(e) => set("id", e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                placeholder="hero_q2_2025_test"
                className={inputCls}
              />
            </Field>

            <Field label="Name">
              <input
                type="text"
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Hero Q2 2025 — Problem vs Brand"
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Slot">
                <select
                  value={draft.slot}
                  onChange={(e) => handleSlotChange(e.target.value as Slot)}
                  className={selectCls}
                >
                  {VALID_SLOTS.map((s) => (
                    <option key={s} value={s}>{SLOT_LABELS[s]}</option>
                  ))}
                </select>
              </Field>

              <Field label="Traffic" hint="% of sessions enrolled">
                <div className="relative">
                  <input
                    type="number"
                    value={draft.trafficPct}
                    min={1}
                    max={100}
                    step={1}
                    onChange={(e) => set("trafficPct", e.target.value)}
                    className={inputCls + " pr-8"}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">%</span>
                </div>
              </Field>
            </div>

            <Field label="Initial status">
              <select
                value={draft.status}
                onChange={(e) => set("status", e.target.value as Status)}
                className={selectCls}
              >
                {VALID_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Right: variant buckets */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Variant buckets
            </p>
            <p className="text-xs text-neutral-400">
              Sessions are assigned a bucket (0, 1, …) by deterministic hash.
              Each bucket maps to one variant key. Minimum 2 buckets required.
            </p>
            <VariantsEditor
              slot={draft.slot}
              variants={draft.variants}
              onChange={(v) => set("variants", v)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ExperimentCard ────────────────────────────────────────────────────────────

interface ExperimentCardProps {
  experiment:    ExperimentRow;
  isEditing:     boolean;
  editDraft:     EditDraft | null;
  saving:        boolean;
  onEdit:        () => void;
  onCancelEdit:  () => void;
  onSaveEdit:    () => void;
  onDraftChange: (patch: Partial<EditDraft>) => void;
}

function ExperimentCard({
  experiment,
  isEditing,
  editDraft,
  saving,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onDraftChange,
}: ExperimentCardProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">

      {/* ── Summary row ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3">

        {/* Slot badge */}
        <SlotBadge slot={experiment.slot as Slot} />

        {/* Name + ID */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-900 truncate">{experiment.name}</p>
          <p className="text-xs text-neutral-400 font-mono mt-0.5 truncate">{experiment.id}</p>
        </div>

        {/* Variant badges */}
        <div className="hidden sm:flex items-center gap-1 shrink-0 flex-wrap max-w-xs">
          {experiment.variants.map((v, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-mono text-xs text-neutral-600"
              title={`Bucket ${i}`}
            >
              <span className="text-neutral-300">{i}:</span>
              {v}
            </span>
          ))}
        </div>

        {/* Traffic + status */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm tabular-nums text-neutral-600">
            {Math.round(experiment.traffic_fraction * 100)}%
          </span>
          <StatusBadge status={experiment.status as Status} />
        </div>

        {/* Created */}
        <span className="hidden lg:block shrink-0 text-xs text-neutral-400">
          {formatDate(experiment.created_at)}
        </span>

        {/* Edit toggle */}
        <button
          type="button"
          onClick={isEditing ? onCancelEdit : onEdit}
          className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          {isEditing ? "Cancel" : "Edit"}
        </button>
      </div>

      {/* ── Edit panel ──────────────────────────────────────────────────────── */}
      {isEditing && editDraft && (
        <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-5">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

            {/* Left: mutable scalars */}
            <div className="flex flex-col gap-4">
              <Field label="Name">
                <input
                  type="text"
                  value={editDraft.name}
                  onChange={(e) => onDraftChange({ name: e.target.value })}
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Status">
                  <select
                    value={editDraft.status}
                    onChange={(e) => onDraftChange({ status: e.target.value as Status })}
                    className={selectCls}
                  >
                    {VALID_STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Traffic" hint="% of sessions">
                  <div className="relative">
                    <input
                      type="number"
                      value={editDraft.trafficPct}
                      min={1}
                      max={100}
                      step={1}
                      onChange={(e) => onDraftChange({ trafficPct: e.target.value })}
                      className={inputCls + " pr-8"}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">%</span>
                  </div>
                </Field>
              </div>

              {editDraft.status === "ended" && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Saving will set <code className="font-mono">ended_at</code> to the current timestamp.
                  This action is permanent.
                </p>
              )}
            </div>

            {/* Right: variant buckets */}
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Variant buckets
              </p>
              <p className="text-xs text-neutral-400">
                Slot is locked to{" "}
                <span className="font-semibold">{SLOT_LABELS[experiment.slot as Slot]}</span>.
                Changing buckets on a live experiment will reassign sessions.
              </p>
              <VariantsEditor
                slot={experiment.slot as Slot}
                variants={editDraft.variants}
                onChange={(v) => onDraftChange({ variants: v })}
              />
            </div>
          </div>

          {/* Save button */}
          <div className="mt-5 flex justify-end border-t border-neutral-200 pt-4">
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={saving}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── VariantsEditor ────────────────────────────────────────────────────────────

function VariantsEditor({
  slot,
  variants,
  onChange,
}: {
  slot:     Slot;
  variants: string[];
  onChange: (v: string[]) => void;
}) {
  const allowed = VARIANTS_FOR_SLOT[slot];

  const updateBucket = (idx: number, value: string) => {
    const next = [...variants];
    next[idx] = value;
    onChange(next);
  };

  const removeBucket = (idx: number) => {
    onChange(variants.filter((_, i) => i !== idx));
  };

  const addBucket = () => {
    // Pick the first allowed key not already used; fall back to first key.
    const unused = allowed.find((k) => !variants.includes(k)) ?? allowed[0];
    onChange([...variants, unused]);
  };

  return (
    <div className="flex flex-col gap-2">
      {variants.map((v, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-right text-xs font-mono text-neutral-400">
            bucket {idx}
          </span>
          <select
            value={v}
            onChange={(e) => updateBucket(idx, e.target.value)}
            className={selectCls + " flex-1"}
          >
            {allowed.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          {variants.length > 2 && (
            <button
              type="button"
              onClick={() => removeBucket(idx)}
              aria-label={`Remove bucket ${idx}`}
              className="shrink-0 rounded-full p-1 text-neutral-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              <svg className="size-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                <path d="M2 2l10 10M12 2L2 12" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      ))}

      {variants.length < allowed.length && (
        <button
          type="button"
          onClick={addBucket}
          className="mt-1 inline-flex items-center gap-1 self-start text-xs font-medium text-brand-600 hover:text-brand-800 transition-colors"
        >
          <span aria-hidden>+</span> Add bucket
        </button>
      )}
    </div>
  );
}

// ── SlotBadge ─────────────────────────────────────────────────────────────────

const SLOT_BADGE_COLORS: Record<Slot, string> = {
  hero:  "bg-violet-50 text-violet-700 border-violet-200",
  proof: "bg-sky-50    text-sky-700    border-sky-200",
  cta:   "bg-amber-50  text-amber-700  border-amber-200",
};

function SlotBadge({ slot }: { slot: Slot }) {
  return (
    <span
      className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${SLOT_BADGE_COLORS[slot]}`}
    >
      {SLOT_LABELS[slot]}
    </span>
  );
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

const STATUS_BADGE_COLORS: Record<Status, string> = {
  active: "bg-green-50 text-green-700 border-green-200",
  paused: "bg-neutral-100 text-neutral-600 border-neutral-300",
  ended:  "bg-red-50 text-red-600 border-red-200",
};

function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE_COLORS[status]}`}
    >
      {status === "active" && (
        <span className="size-1.5 rounded-full bg-green-500 shrink-0" aria-hidden />
      )}
      {STATUS_LABELS[status]}
    </span>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label:    string;
  hint?:    string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-neutral-700">{label}</label>
      {children}
      {hint && <p className="text-xs text-neutral-400">{hint}</p>}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day:   "2-digit",
    month: "short",
    year:  "numeric",
  });
}

// ── Shared class strings ───────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

const selectCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
