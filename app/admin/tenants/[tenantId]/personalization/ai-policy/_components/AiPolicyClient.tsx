"use client";

/**
 * AiPolicyClient
 *
 * Client component for the unified AI Policy admin page.
 *
 * Shows two phase panels — selection (Phase 1) and fieldFill (Phase 2) — each
 * with a mode radio group and a confidence threshold slider.
 *
 * Also shows a read-only "Platform defaults" panel derived from environment
 * variables (passed as props from the server component).
 */

import { useState, useTransition } from "react";
import {
  saveAiPolicyAction,
  type SaveAiPolicyInput,
  type AiPolicyFormValue,
} from "../actions";
import type { TenantAiPolicies, TenantAiPolicyMode } from "@/tenant/types";

// ── Mode options ──────────────────────────────────────────────────────────────

const MODE_OPTIONS: Array<{ value: TenantAiPolicyMode; label: string; hint: string; color: string }> = [
  {
    value: "disabled",
    label: "Disabled",
    hint:  "AI is not called. Original content is always served.",
    color: "neutral",
  },
  {
    value: "shadow",
    label: "Shadow",
    hint:  "AI runs in the background but its output is only logged, never served. Safe for observation.",
    color: "amber",
  },
  {
    value: "live",
    label: "Live",
    hint:  "AI output is served when confidence meets the threshold. Falls back otherwise.",
    color: "green",
  },
];

// ── Phase metadata ────────────────────────────────────────────────────────────

interface PhaseMeta {
  id:          "selection" | "fieldFill";
  label:       string;
  description: string;
}

const PHASES: PhaseMeta[] = [
  {
    id:          "selection",
    label:       "Phase 1 (Variant Selection)",
    description: "Controls whether AI may choose which variant key to serve for each slot.",
  },
  {
    id:          "fieldFill",
    label:       "Phase 2 (Content Field Fill)",
    description: "Controls whether AI may rewrite text fields within a selected variant.",
  },
];

// ── Default builder ───────────────────────────────────────────────────────────

function buildDefault(saved: TenantAiPolicies | null): SaveAiPolicyInput {
  return {
    selection: {
      mode:                saved?.selection?.mode                ?? "shadow",
      confidenceThreshold: saved?.selection?.confidenceThreshold ?? 0.70,
    },
    fieldFill: {
      mode:                saved?.fieldFill?.mode                ?? "disabled",
      confidenceThreshold: saved?.fieldFill?.confidenceThreshold ?? 0.70,
    },
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AiPolicyClient({
  tenantId,
  initialSettings,
  platformDefaults,
}: {
  tenantId:         string;
  initialSettings:  TenantAiPolicies | null;
  platformDefaults: { selectionMode?: string; selectionThreshold?: string; fieldFillMode?: string; fieldFillThreshold?: string };
}) {
  const [form,       setForm]       = useState<SaveAiPolicyInput>(() => buildDefault(initialSettings));
  const [status,     setStatus]     = useState<"idle" | "success" | "error">("idle");
  const [errorMsg,   setErrorMsg]   = useState<string>("");
  const [isPending,  startTransition] = useTransition();

  const updatePhase = (
    phase: "selection" | "fieldFill",
    patch:  Partial<AiPolicyFormValue>,
  ) => setForm((prev) => ({ ...prev, [phase]: { ...prev[phase], ...patch } }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("idle");
    startTransition(async () => {
      const result = await saveAiPolicyAction(tenantId, form);
      if (result.ok) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMsg(result.error ?? "Unknown error");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Platform defaults (read-only) */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
          Platform defaults (from environment)
        </h3>
        <div className="grid grid-cols-2 gap-4 text-xs text-neutral-600">
          <div>
            <span className="font-medium">Selection mode: </span>
            <span className="font-mono">{platformDefaults.selectionMode ?? "shadow (system default)"}</span>
          </div>
          <div>
            <span className="font-medium">Selection threshold: </span>
            <span className="font-mono">{platformDefaults.selectionThreshold ?? "0.70 (system default)"}</span>
          </div>
          <div>
            <span className="font-medium">Field fill mode: </span>
            <span className="font-mono">{platformDefaults.fieldFillMode ?? "disabled (system default)"}</span>
          </div>
          <div>
            <span className="font-medium">Field fill threshold: </span>
            <span className="font-mono">{platformDefaults.fieldFillThreshold ?? "0.70 (system default)"}</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-neutral-400">
          Set via MC_AI_SELECTION_MODE, MC_AI_SELECTION_THRESHOLD, MC_AI_FIELD_FILL_MODE,
          MC_AI_FIELD_FILL_THRESHOLD. Tenant settings below override these.
        </p>
      </div>

      {/* Tenant-level policy controls */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {PHASES.map((phase) => {
          const value = form[phase.id];
          return (
            <div key={phase.id} className="rounded-lg border border-neutral-200 bg-white p-6">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-neutral-900">{phase.label}</h3>
                <p className="mt-0.5 text-xs text-neutral-500">{phase.description}</p>
              </div>

              {/* Mode radio group */}
              <fieldset className="mb-4">
                <legend className="sr-only">AI mode for {phase.label}</legend>
                <div className="space-y-2">
                  {MODE_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 px-3 py-2.5 hover:border-blue-300 hover:bg-blue-50/40 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50"
                    >
                      <input
                        type="radio"
                        name={`${phase.id}-mode`}
                        value={opt.value}
                        checked={value.mode === opt.value}
                        onChange={() => updatePhase(phase.id, { mode: opt.value })}
                        className="mt-0.5 accent-blue-600"
                      />
                      <span>
                        <span className="block text-xs font-medium text-neutral-900">{opt.label}</span>
                        <span className="block text-xs text-neutral-500">{opt.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* Confidence threshold */}
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Minimum confidence threshold
                  {value.mode !== "live" && (
                    <span className="ml-2 text-neutral-400 font-normal">
                      (only applies in live mode)
                    </span>
                  )}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={value.confidenceThreshold}
                    onChange={(e) =>
                      updatePhase(phase.id, { confidenceThreshold: parseFloat(e.target.value) })
                    }
                    className="w-48 accent-blue-600"
                  />
                  <span className="text-xs font-mono text-neutral-600 w-10">
                    {(value.confidenceThreshold * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-400">
                  In live mode, AI output is only applied when the model reports confidence ≥ this
                  value. Below threshold, original content is kept.
                </p>
              </div>
            </div>
          );
        })}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-neutral-200 pt-4">
          <div>
            {status === "success" && (
              <p className="text-sm text-green-600 font-medium">AI policy saved.</p>
            )}
            {status === "error" && (
              <p className="text-sm text-red-600">{errorMsg}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Saving…" : "Save AI policy"}
          </button>
        </div>
      </form>
    </div>
  );
}
