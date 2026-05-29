"use client";

/**
 * SlotModesClient
 *
 * Client component for the Adaptive Slot Mode admin page.
 *
 * Shows three slot configuration panels — hero, proof, cta — each with:
 *   • Mode radio group: AI-assisted | Rules only | Static
 *   • Static key input (visible only when mode === "static")
 *
 * On save, calls saveSlotModesAction() and shows inline success/error feedback.
 */

import { useState, useTransition } from "react";
import { saveSlotModesAction, type SaveSlotModesInput, type SlotModeFormValue } from "../actions";
import type { TenantAdaptiveSlotSettings, TenantSlotMode } from "@/tenant/types";
import {
  HERO_VARIANT_KEYS,
  PROOF_VARIANT_KEYS,
  CTA_VARIANT_KEYS,
} from "@/decision/types";

// ── Slot metadata ─────────────────────────────────────────────────────────────

interface SlotMeta {
  id:          "hero" | "proof" | "cta";
  label:       string;
  description: string;
  keys:        readonly string[];
}

const SLOT_META: SlotMeta[] = [
  {
    id:          "hero",
    label:       "Hero",
    description: "Adaptive page header — headline, subtitle, and primary CTA.",
    keys:        HERO_VARIANT_KEYS,
  },
  {
    id:          "proof",
    label:       "Proof",
    description: "Social proof section — case studies, recognition, or platform stats.",
    keys:        PROOF_VARIANT_KEYS,
  },
  {
    id:          "cta",
    label:       "CTA",
    description: "Call-to-action section — nurture, product-led, or sales-led.",
    keys:        CTA_VARIANT_KEYS,
  },
];

const MODE_OPTIONS: Array<{ value: TenantSlotMode; label: string; hint: string }> = [
  {
    value: "ai-assisted",
    label: "AI-assisted",
    hint:  "AI may select this slot when confidence gates pass. Falls back to rules.",
  },
  {
    value: "rules-only",
    label: "Rules only",
    hint:  "Always use the rules plan key. AI is never consulted for this slot.",
  },
  {
    value: "static",
    label: "Static",
    hint:  "Always serve the fixed key you specify below, regardless of context.",
  },
];

// ── Helper ────────────────────────────────────────────────────────────────────

function buildDefault(saved: TenantAdaptiveSlotSettings | null): SaveSlotModesInput {
  const slotDefault = (
    slotId: "hero" | "proof" | "cta",
  ): SlotModeFormValue => ({
    mode:      saved?.[slotId]?.mode      ?? "ai-assisted",
    staticKey: saved?.[slotId]?.staticKey ?? "",
  });
  return { hero: slotDefault("hero"), proof: slotDefault("proof"), cta: slotDefault("cta") };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SlotModesClient({
  tenantId,
  initialSettings,
}: {
  tenantId:        string;
  initialSettings: TenantAdaptiveSlotSettings | null;
}) {
  const [form,       setForm]       = useState<SaveSlotModesInput>(() => buildDefault(initialSettings));
  const [status,     setStatus]     = useState<"idle" | "success" | "error">("idle");
  const [errorMsg,   setErrorMsg]   = useState<string>("");
  const [isPending,  startTransition] = useTransition();

  const updateSlot = (
    slotId: "hero" | "proof" | "cta",
    patch:  Partial<SlotModeFormValue>,
  ) => setForm((prev) => ({ ...prev, [slotId]: { ...prev[slotId], ...patch } }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("idle");
    startTransition(async () => {
      const result = await saveSlotModesAction(tenantId, form);
      if (result.ok) {
        setStatus("success");
      } else {
        setStatus("error");
        setErrorMsg(result.error ?? "Unknown error");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {SLOT_META.map((slot) => {
        const value = form[slot.id];
        return (
          <div key={slot.id} className="rounded-lg border border-neutral-200 bg-white p-6">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-neutral-900">{slot.label}</h3>
              <p className="mt-0.5 text-xs text-neutral-500">{slot.description}</p>
            </div>

            {/* Mode radio group */}
            <fieldset>
              <legend className="sr-only">Selection mode for {slot.label}</legend>
              <div className="space-y-2.5">
                {MODE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 px-3 py-2.5 hover:border-blue-300 hover:bg-blue-50/40 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50"
                  >
                    <input
                      type="radio"
                      name={`${slot.id}-mode`}
                      value={opt.value}
                      checked={value.mode === opt.value}
                      onChange={() => updateSlot(slot.id, { mode: opt.value })}
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

            {/* Static key selector (only shown in static mode) */}
            {value.mode === "static" && (
              <div className="mt-4">
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Fixed variant key
                </label>
                <select
                  value={value.staticKey ?? ""}
                  onChange={(e) => updateSlot(slot.id, { staticKey: e.target.value })}
                  className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                >
                  <option value="" disabled>— choose a variant key —</option>
                  {slot.keys.map((key) => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-neutral-400">
                  This key will always be served for the {slot.label.toLowerCase()} slot,
                  regardless of visitor context or AI decisions.
                </p>
              </div>
            )}
          </div>
        );
      })}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-neutral-200 pt-4">
        <div>
          {status === "success" && (
            <p className="text-sm text-green-600 font-medium">Slot modes saved.</p>
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
          {isPending ? "Saving…" : "Save slot modes"}
        </button>
      </div>
    </form>
  );
}
