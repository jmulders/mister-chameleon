/**
 * ContextSlotsEditor — interactive context slot configuration editor (PB5)
 *
 * Client component that manages the context slot envelope for a page.
 *
 * ─── What it configures ───────────────────────────────────────────────────────
 *
 *   For each slot present on this page (hero / proof / cta):
 *
 *   allowedVariantKeys  — checkbox list.  Operator picks which variants from the
 *                         slot's platform vocabulary this page is allowed to serve.
 *                         Undefined = full vocabulary (current engine behaviour).
 *
 *   variantKey          — select (= fallback variant).  The variant the engine
 *                         falls back to when no visitor-specific signal matches.
 *                         Must be a key from the slot's platform vocabulary.
 *
 * ─── What it does NOT do ──────────────────────────────────────────────────────
 *
 *   It does NOT assign the final variant for any specific visitor.
 *   The decision engine always makes that choice at request time.
 *   This editor only sets the governance envelope — the allowed set and fallback.
 *
 * ─── Data flow ────────────────────────────────────────────────────────────────
 *
 *   Server (page.tsx)
 *     → EditableContextSlot[] (initialSlots)
 *     → SlotVocabulary — per-slot valid key arrays from decision/types.ts
 *   Client (this component)
 *     → local SlotEditorState[] — allowedKeys (checkboxes) + fallbackKey (select)
 *     → on save: maps back to EditableContextSlot[], calls saveContextSlotsAction
 *   Server action (actions.ts → page-store/store.ts)
 *     → validates keys, persists contextSlots, revalidates paths
 */

"use client";

import { useState, useTransition } from "react";
import { saveContextSlotsAction } from "./actions";
import type { ActionResult }      from "./actions";
import type { EditableContextSlot } from "@/page-store";

// ── Vocabulary shape (passed from server) ──────────────────────────────────────

export interface SlotVocabulary {
  hero:  readonly string[];
  proof: readonly string[];
  cta:   readonly string[];
}

// ── Per-slot editor state ─────────────────────────────────────────────────────

interface SlotEditorState {
  slotId:      string;
  position:    "before-content" | "after-content";
  allowedKeys: string[];    // checkbox state — empty = none selected
  fallbackKey: string;      // select state  — empty string = null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SLOT_LABEL: Record<string, string> = {
  hero:  "Hero",
  proof: "Social proof",
  cta:   "Call to action",
};

const SLOT_DESCRIPTION: Record<string, string> = {
  hero:  "Headline, sub-headline, and primary CTA — shown above the content blocks.",
  proof: "Social proof angle (case studies, analyst quotes, platform stats) — shown above content blocks.",
  cta:   "Standalone call-to-action — shown below the content blocks.",
};

const KEY_LABEL: Record<string, string> = {
  // Hero
  hero_google_problem:  "Google / Problem-aware",
  hero_linkedin_vision: "LinkedIn / Vision-seeker",
  hero_direct_brand:    "Direct / Brand fallback",
  // Proof
  proof_cases:          "Case studies (ROI-focused)",
  proof_vision:         "Analyst quotes (thought-leader)",
  proof_platform:       "Platform stats (evaluator)",
  // CTA
  cta_guide:            "Guide download (nurture)",
  cta_platform:         "Start for free (product-led)",
  cta_meeting:          "Book intro call (sales-led)",
};

function toEditorState(slot: EditableContextSlot, vocab: readonly string[]): SlotEditorState {
  // Default allowedKeys: if not configured, treat as "all in vocabulary" so
  // the checkboxes start fully checked — accurately reflecting the current
  // unrestricted engine behaviour.
  const allowedKeys =
    slot.allowedVariantKeys !== undefined
      ? slot.allowedVariantKeys
      : [...vocab];

  return {
    slotId:      slot.slotId,
    position:    slot.position,
    allowedKeys,
    fallbackKey: slot.variantKey ?? "",
  };
}

function toSlot(state: SlotEditorState, original: EditableContextSlot): EditableContextSlot {
  return {
    slotId:            original.slotId,
    variantKey:        state.fallbackKey || null,
    position:          original.position,
    allowedVariantKeys: state.allowedKeys,
  };
}

// ── Status banner ──────────────────────────────────────────────────────────────

function StatusBanner({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        result.ok
          ? "rounded-md border border-success-200 bg-success-50 px-4 py-2.5 text-sm text-success-700"
          : "rounded-md border border-error-200 bg-error-50 px-4 py-2.5 text-sm text-error-700"
      }
    >
      {result.ok ? "Context slots saved." : (result.error ?? "Save failed — please try again.")}
    </div>
  );
}

// ── Single slot card ───────────────────────────────────────────────────────────

function SlotCard({
  state,
  vocab,
  onChange,
}: {
  state:    SlotEditorState;
  vocab:    readonly string[];
  onChange: (patch: Partial<SlotEditorState>) => void;
}) {
  const isBefore  = state.position === "before-content";
  const label     = SLOT_LABEL[state.slotId]       ?? state.slotId;
  const desc      = SLOT_DESCRIPTION[state.slotId] ?? "";

  // Warn when fallback is set but not in the allowed list.
  const fallbackNotAllowed =
    state.fallbackKey !== "" && !state.allowedKeys.includes(state.fallbackKey);

  function toggleKey(key: string) {
    const next = state.allowedKeys.includes(key)
      ? state.allowedKeys.filter((k) => k !== key)
      : [...state.allowedKeys, key];
    onChange({ allowedKeys: next });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-3">
        <span className="flex-1 text-sm font-semibold text-neutral-800">
          {label}
          <code className="ml-2 text-xs font-mono text-neutral-400">{state.slotId}</code>
        </span>
        <span
          className={[
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            isBefore
              ? "bg-brand-50 text-brand-700"
              : "bg-neutral-100 text-neutral-600",
          ].join(" ")}
        >
          {isBefore ? "Before content" : "After content"}
        </span>
      </div>

      <div className="px-4 py-4 flex flex-col gap-5">
        {/* Description */}
        <p className="text-xs text-neutral-400">{desc}</p>

        {/* Allowed variants — checkboxes */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Allowed variants
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onChange({ allowedKeys: [...vocab] })}
                className="text-xs text-brand-600 hover:text-brand-800 transition-colors"
              >
                All
              </button>
              <span className="text-xs text-neutral-300">·</span>
              <button
                type="button"
                onClick={() => onChange({ allowedKeys: [] })}
                className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors"
              >
                None
              </button>
            </div>
          </div>
          <p className="text-xs text-neutral-400">
            Which variants from this slot's vocabulary the decision engine may select for this page.
            The engine always makes the final per-visitor choice.
          </p>
          <div className="flex flex-col gap-1.5">
            {vocab.map((key) => {
              const checked = state.allowedKeys.includes(key);
              return (
                <label
                  key={key}
                  className="flex items-center gap-2.5 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleKey(key)}
                    className="size-3.5 accent-brand-500 cursor-pointer"
                  />
                  <span className="flex-1 text-sm text-neutral-700 group-hover:text-neutral-900 transition-colors">
                    {KEY_LABEL[key] ?? key}
                  </span>
                  <code className="text-xs text-neutral-400 font-mono">{key}</code>
                </label>
              );
            })}
          </div>
        </div>

        {/* Fallback variant — select */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Fallback variant
          </span>
          <p className="text-xs text-neutral-400">
            Used when the engine cannot resolve a visitor-specific variant. Should be a broadly
            applicable option from the vocabulary above.
          </p>
          <select
            value={state.fallbackKey}
            onChange={(e) => onChange({ fallbackKey: e.target.value })}
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          >
            <option value="">— none (slot inactive) —</option>
            {vocab.map((key) => (
              <option key={key} value={key}>
                {KEY_LABEL[key] ?? key}  ({key})
              </option>
            ))}
          </select>

          {fallbackNotAllowed && (
            <p className="text-xs text-warning-600">
              ⚠ The fallback key is not in the allowed variants list. Consider adding it above,
              or the engine may fall back to a variant that isn't in the allowed envelope.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface ContextSlotsEditorProps {
  pageId:       string;
  initialSlots: EditableContextSlot[];
  vocabulary:   SlotVocabulary;
  /**
   * Optional override for the save action.  When provided this function is
   * called instead of the default `saveContextSlotsAction`.  Pass a bound
   * server action from a tenant-scoped parent route to keep saving within the
   * correct tenant context.
   *
   * Signature matches saveContextSlotsAction: (slots) => Promise<ActionResult>
   */
  onSave?: (slots: EditableContextSlot[]) => Promise<ActionResult>;
}

export function ContextSlotsEditor({
  pageId,
  initialSlots,
  vocabulary,
  onSave,
}: ContextSlotsEditorProps) {
  // Build initial editor state from slot data + vocabulary.
  const [states,    setStates]    = useState<SlotEditorState[]>(() =>
    initialSlots.map((slot) => {
      const vocab = vocabulary[slot.slotId as keyof SlotVocabulary] ?? [];
      return toEditorState(slot, vocab);
    }),
  );
  const [status,    setStatus]    = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateSlot(slotId: string, patch: Partial<SlotEditorState>) {
    setStates((prev) =>
      prev.map((s) => (s.slotId === slotId ? { ...s, ...patch } : s)),
    );
    setStatus(null);
  }

  function handleSave() {
    // Map editor state back to EditableContextSlot[] for the server action.
    const updatedSlots: EditableContextSlot[] = states.map((state, i) => {
      const original = initialSlots[i];
      return toSlot(state, original!);
    });

    startTransition(async () => {
      // Use injected onSave if provided (tenant-scoped route); fall back to the
      // default global action for the legacy /admin/pages/[pageId] route.
      const res = onSave
        ? await onSave(updatedSlots)
        : await saveContextSlotsAction(pageId, updatedSlots);
      setStatus(res);
    });
  }

  if (initialSlots.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm px-4 py-6">
        <p className="text-sm text-neutral-400">
          This page's template has no context slots. Context slots are available on
          <code className="mx-1 rounded bg-neutral-100 px-1 py-0.5 text-xs font-mono">marketing-page</code>
          and
          <code className="mx-1 rounded bg-neutral-100 px-1 py-0.5 text-xs font-mono">landing-page</code>
          templates only.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Slot cards */}
      {states.map((state) => {
        const vocab = vocabulary[state.slotId as keyof SlotVocabulary] ?? [];
        return (
          <SlotCard
            key={state.slotId}
            state={state}
            vocab={vocab}
            onChange={(patch) => updateSlot(state.slotId, patch)}
          />
        );
      })}

      {/* Save row */}
      <div className="flex flex-col gap-3 pt-1">
        <StatusBanner result={status} />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="inline-flex h-9 items-center justify-center rounded-md bg-brand-500 px-4 text-sm font-medium text-white shadow-xs transition-colors hover:bg-brand-600 active:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? (
              <>
                <span className="mr-2 size-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving…
              </>
            ) : (
              "Save context slots"
            )}
          </button>

          <span className="text-xs text-neutral-400">
            Visitor variant chosen by decision engine at request time
          </span>
        </div>
      </div>
    </div>
  );
}
