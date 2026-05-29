"use client";

/**
 * ContentBudgetForm
 *
 * Client component that lets platform admins edit per-slot content budget
 * ceilings.  Saving calls the saveBudgetAction server action and shows
 * inline success / error feedback without a full page reload.
 *
 * ─── Budget semantics ──────────────────────────────────────────────────────────
 *
 *   Each ceiling is the total number of Sanity variant documents (platform + CMS)
 *   that should exist for a given slot before the team is prompted to consolidate.
 *   The VariantUsagePanel on the tenant rules page turns amber at 75 % and red at
 *   100 % of the ceiling — never hard-blocking, just visible friction.
 */

import { useState, useTransition } from "react";
import { CONTENT_BUDGET_DEFAULTS } from "@/decision/rules/variant-usage";
import type { ContentBudget }       from "@/decision/rules/variant-usage";
import type { SaveBudgetResult }    from "../actions";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ContentBudgetFormProps {
  initialBudget: ContentBudget;
  saveAction:    (input: ContentBudget) => Promise<SaveBudgetResult>;
}

// ── Slot definitions ───────────────────────────────────────────────────────────

const SLOTS: {
  key:         keyof ContentBudget;
  label:       string;
  description: string;
  defaultVal:  number;
}[] = [
  {
    key:         "heroMax",
    label:       "Hero",
    description: "Headline variants above the fold",
    defaultVal:  CONTENT_BUDGET_DEFAULTS.heroMax,
  },
  {
    key:         "proofMax",
    label:       "Proof",
    description: "Social proof / evidence variants",
    defaultVal:  CONTENT_BUDGET_DEFAULTS.proofMax,
  },
  {
    key:         "ctaMax",
    label:       "CTA",
    description: "Call-to-action conversion variants",
    defaultVal:  CONTENT_BUDGET_DEFAULTS.ctaMax,
  },
  {
    key:         "featureMax",
    label:       "Feature",
    description: "Feature showcase / highlight variants",
    defaultVal:  CONTENT_BUDGET_DEFAULTS.featureMax,
  },
  {
    key:         "conversionMax",
    label:       "Conversion",
    description: "End-of-page conversion block variants",
    defaultVal:  CONTENT_BUDGET_DEFAULTS.conversionMax,
  },
];

// ── Component ──────────────────────────────────────────────────────────────────

export function ContentBudgetForm({
  initialBudget,
  saveAction,
}: ContentBudgetFormProps) {
  const [values, setValues] = useState<ContentBudget>({ ...initialBudget });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  function handleChange(key: keyof ContentBudget, raw: string) {
    const num = parseInt(raw, 10);
    if (!isNaN(num) && num > 0) {
      setValues((prev) => ({ ...prev, [key]: num }));
    }
  }

  function handleSave() {
    setStatus("saving");
    setErrorMsg("");
    startTransition(async () => {
      const result = await saveAction(values);
      if (result.ok) {
        setStatus("saved");
        // Reset to idle after brief confirmation
        setTimeout(() => setStatus("idle"), 2500);
      } else {
        setStatus("error");
        setErrorMsg(result.error);
      }
    });
  }

  function handleReset() {
    setValues({
      heroMax:       CONTENT_BUDGET_DEFAULTS.heroMax,
      proofMax:      CONTENT_BUDGET_DEFAULTS.proofMax,
      ctaMax:        CONTENT_BUDGET_DEFAULTS.ctaMax,
      featureMax:    CONTENT_BUDGET_DEFAULTS.featureMax,
      conversionMax: CONTENT_BUDGET_DEFAULTS.conversionMax,
    });
  }

  const isDirty = SLOTS.some((s) => values[s.key] !== initialBudget[s.key]);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Content budget ceilings</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Maximum variant count per slot before the usage panel flags overload.
            The warning turns amber at 75 % and red at 100 % of the ceiling.
          </p>
        </div>
        <span className="text-[10px] font-medium text-neutral-400 bg-neutral-100 border border-neutral-200 rounded-full px-2 py-0.5">
          per tenant · all templates
        </span>
      </div>

      {/* Slot inputs */}
      <div className="divide-y divide-neutral-100">
        {SLOTS.map((slot) => (
          <div key={slot.key} className="flex items-center gap-4 px-5 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-800">{slot.label}</p>
              <p className="text-xs text-neutral-400">{slot.description}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-neutral-400 hidden sm:block">
                default: {slot.defaultVal}
              </span>
              <input
                type="number"
                min={1}
                max={999}
                value={values[slot.key]}
                onChange={(e) => handleChange(slot.key, e.target.value)}
                className="w-20 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm font-mono text-neutral-900 text-right focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 transition-colors"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-neutral-100 bg-neutral-50">
        <div className="text-xs">
          {status === "saved" && (
            <span className="text-emerald-600 font-medium flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Saved
            </span>
          )}
          {status === "error" && (
            <span className="text-red-600">
              Error: {errorMsg}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={isPending}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            Reset to defaults
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || (!isDirty && status !== "error")}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
