"use client";

/**
 * CreateExperimentForm
 *
 * Inline form for creating a new A/B experiment from the experiments
 * dashboard. Rendered as a collapsible card so the read-only table remains
 * the primary focus until the marketer explicitly wants to create.
 *
 * ─── Field summary ────────────────────────────────────────────────────────────
 *
 *   id               Stable slug — lowercase letters, digits, _ and - only.
 *                    Becomes the primary key; immutable after creation.
 *   name             Human-readable display label.
 *   slot             hero | proof | cta — the page block being tested.
 *   variants         Ordered bucket list. Each checkbox maps to a bucket index.
 *                    Options are restricted to the per-slot allow-list from
 *                    decision/rules/stored-rule.ts. Minimum 2 required.
 *   status           active | paused | ended. Defaults to "active".
 *   traffic_fraction Entered as a whole percentage (1–100); stored as 0–1.
 *
 * ─── Variant ordering ─────────────────────────────────────────────────────────
 *
 *   The decision engine maps bucket 0 → variants[0], bucket 1 → variants[1],
 *   etc. The variant checkboxes appear in a fixed display order and the
 *   resulting array preserves that order, so the bucket assignment is
 *   deterministic and visible in the UI.
 *
 * ─── After save ───────────────────────────────────────────────────────────────
 *
 *   On success the form resets and calls router.refresh() so the server-rendered
 *   table re-fetches and picks up the new row without a full navigation.
 */

import { useState, useTransition }   from "react";
import { useRouter }                 from "next/navigation";
import { createExperimentAction }    from "@/app/dashboard/experiments/actions";
import {
  ALLOWED_HERO_KEYS,
  ALLOWED_PROOF_KEYS,
  ALLOWED_CTA_KEYS,
} from "@/decision/rules/stored-rule";

// ── Types ─────────────────────────────────────────────────────────────────────

type Slot   = "hero" | "proof" | "cta";
type Status = "active" | "paused" | "ended";

const VALID_SLOTS:    Slot[]   = ["hero", "proof", "cta"];
const VALID_STATUSES: Status[] = ["active", "paused", "ended"];

const VARIANTS_FOR_SLOT: Record<Slot, readonly string[]> = {
  hero:  ALLOWED_HERO_KEYS,
  proof: ALLOWED_PROOF_KEYS,
  cta:   ALLOWED_CTA_KEYS,
};

interface FormDraft {
  id:               string;
  name:             string;
  slot:             Slot;
  selectedVariants: Set<string>;
  status:           Status;
  trafficPct:       string; // entered as "1"–"100", stored as 0–1
}

const DEFAULT_DRAFT: FormDraft = {
  id:               "",
  name:             "",
  slot:             "hero",
  selectedVariants: new Set(),
  status:           "active",
  trafficPct:       "100",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function CreateExperimentForm() {
  const router = useRouter();

  const [open,        setOpen]        = useState(false);
  const [draft,       setDraft]       = useState<FormDraft>(DEFAULT_DRAFT);
  const [successMsg,  setSuccessMsg]  = useState<string | null>(null);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [isPending,   startTransition] = useTransition();

  // ── Helpers ────────────────────────────────────────────────────────────────

  function resetForm() {
    setDraft(DEFAULT_DRAFT);
    setErrorMsg(null);
    setSuccessMsg(null);
    setFieldErrors([]);
  }

  function handleOpen() {
    resetForm();
    setOpen(true);
  }

  function handleCancel() {
    resetForm();
    setOpen(false);
  }

  // ── Slot change → clear variant selection ─────────────────────────────────

  function handleSlotChange(slot: Slot) {
    setDraft((d) => ({ ...d, slot, selectedVariants: new Set() }));
  }

  // ── Variant checkbox toggle ───────────────────────────────────────────────

  function toggleVariant(key: string) {
    setDraft((d) => {
      const next = new Set(d.selectedVariants);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return { ...d, selectedVariants: next };
    });
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setFieldErrors([]);

    // Preserve display order from the allow-list rather than Set insertion order.
    const slotKeys  = VARIANTS_FOR_SLOT[draft.slot];
    const variants  = slotKeys.filter((k) => draft.selectedVariants.has(k));
    const tf        = parseFloat(draft.trafficPct) / 100;

    const payload = {
      id:               draft.id.trim(),
      name:             draft.name.trim(),
      slot:             draft.slot,
      variants,
      status:           draft.status,
      traffic_fraction: tf,
    };

    startTransition(async () => {
      const result = await createExperimentAction(payload);

      if (!result.ok) {
        setErrorMsg(result.error);
        setFieldErrors(result.fieldErrors ?? []);
        return;
      }

      setSuccessMsg(`Experiment "${result.experiment.name}" created.`);
      resetForm();
      setOpen(false);
      // Re-run the server component so the read-only table picks up the new row.
      router.refresh();
    });
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const availableKeys  = VARIANTS_FOR_SLOT[draft.slot];
  const selectedCount  = draft.selectedVariants.size;
  const variantsValid  = selectedCount >= 2;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      {/* ── Header / toggle ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <PlusIcon />
          <span className="text-sm font-semibold text-neutral-800">New Experiment</span>
        </div>

        {!open ? (
          <button
            type="button"
            onClick={handleOpen}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-600 active:bg-brand-700 transition-colors"
          >
            Create experiment
          </button>
        ) : (
          <button
            type="button"
            onClick={handleCancel}
            className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      {/* ── Success banner (shown even when form is closed) ──────────────── */}
      {successMsg && !open && (
        <div className="flex items-center justify-between border-b border-green-100 bg-green-50 px-5 py-3 text-sm text-green-800">
          <span>
            <span className="mr-1.5 font-semibold">✓</span>
            {successMsg}
          </span>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="ml-4 text-green-600 hover:text-green-800 transition-colors"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Form body ────────────────────────────────────────────────────── */}
      {open && (
        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 px-5 py-5 sm:grid-cols-2">
            {/* id */}
            <Field
              label="Experiment ID"
              hint="Stable slug · lowercase, digits, _ and - only · max 80 chars"
              required
            >
              <input
                type="text"
                value={draft.id}
                onChange={(e) => setDraft((d) => ({ ...d, id: e.target.value }))}
                placeholder="hero_q2_2025_test"
                className={inputCls}
                autoComplete="off"
                spellCheck={false}
                disabled={isPending}
              />
            </Field>

            {/* name */}
            <Field label="Display Name" required>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Hero — Q2 problem vs. brand"
                className={inputCls}
                disabled={isPending}
              />
            </Field>

            {/* slot */}
            <Field label="Slot" hint="The page block being tested">
              <div className="flex gap-2">
                {VALID_SLOTS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSlotChange(s)}
                    disabled={isPending}
                    className={[
                      "flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                      draft.slot === s
                        ? SLOT_ACTIVE_CLS[s]
                        : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-neutral-700",
                    ].join(" ")}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Field>

            {/* traffic_fraction */}
            <Field label="Traffic fraction" hint="Percentage of sessions enrolled (1–100)">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={draft.trafficPct}
                  onChange={(e) => setDraft((d) => ({ ...d, trafficPct: e.target.value }))}
                  className={[inputCls, "w-24 tabular-nums"].join(" ")}
                  disabled={isPending}
                />
                <span className="text-sm text-neutral-500">%</span>
              </div>
            </Field>

            {/* variants */}
            <Field
              label="Variants"
              hint={`Bucket 0 is listed first · select ≥ 2 · ${availableKeys.length} keys available for ${draft.slot}`}
              span2
            >
              <div className="flex flex-wrap gap-2">
                {availableKeys.map((key, idx) => {
                  const checked     = draft.selectedVariants.has(key);
                  // Bucket index = position within selected variants in display order
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
                        onChange={() => toggleVariant(key)}
                        className="sr-only"
                        disabled={isPending}
                      />
                      {checked && bucketIndex !== null && (
                        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white tabular-nums">
                          {bucketIndex}
                        </span>
                      )}
                      {!checked && (
                        <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-neutral-300" />
                      )}
                      <span className="font-mono">{key}</span>
                    </label>
                  );
                })}
              </div>
              {selectedCount === 1 && (
                <p className="mt-2 text-xs text-amber-700">Select at least one more variant (minimum 2).</p>
              )}
              {selectedCount === 0 && (
                <p className="mt-2 text-xs text-neutral-400">No variants selected — select at least 2.</p>
              )}
            </Field>

            {/* status */}
            <Field label="Initial status" hint="Can be changed after creation">
              <div className="flex gap-2">
                {VALID_STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, status: s }))}
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
          </div>

          {/* ── Field errors ──────────────────────────────────────────────── */}
          {fieldErrors.length > 0 && (
            <div className="mx-5 mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
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

          {/* ── Top-level error ───────────────────────────────────────────── */}
          {errorMsg && fieldErrors.length === 0 && (
            <div className="mx-5 mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {errorMsg}
            </div>
          )}

          {/* ── Footer actions ────────────────────────────────────────────── */}
          <div className="flex items-center justify-end gap-3 border-t border-neutral-100 bg-neutral-50 px-5 py-3.5">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-600 shadow-sm hover:bg-neutral-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !variantsValid}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-600 active:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending && <SpinnerIcon />}
              {isPending ? "Saving…" : "Create experiment"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Field wrapper ──────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  required,
  span2,
  children,
}: {
  label:    string;
  hint?:    string;
  required?: boolean;
  span2?:   boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={span2 ? "sm:col-span-2" : undefined}>
      <label className="mb-1.5 block">
        <span className="text-xs font-semibold text-neutral-700">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </span>
        {hint && (
          <span className="mt-0.5 block text-xs text-neutral-400">{hint}</span>
        )}
      </label>
      {children}
    </div>
  );
}

// ── Style constants ────────────────────────────────────────────────────────────

const inputCls =
  "block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-50 transition-colors";

const SLOT_ACTIVE_CLS: Record<Slot, string> = {
  hero:  "border-violet-300 bg-violet-50 text-violet-700",
  proof: "border-sky-300    bg-sky-50    text-sky-700",
  cta:   "border-amber-300  bg-amber-50  text-amber-700",
};

const STATUS_ACTIVE_CLS: Record<Status, string> = {
  active: "border-green-300   bg-green-50   text-green-700",
  paused: "border-amber-300   bg-amber-50   text-amber-700",
  ended:  "border-neutral-300 bg-neutral-100 text-neutral-600",
};

// ── SVG icons ──────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg
      className="size-4 text-neutral-400"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M8 2.5v11M2.5 8h11" />
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
