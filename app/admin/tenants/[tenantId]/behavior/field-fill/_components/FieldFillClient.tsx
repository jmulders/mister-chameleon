"use client";

/**
 * FieldFillClient
 *
 * Client component for the AI Field Fill admin page.
 *
 * Shows three slot configuration panels — hero, proof, cta — each with:
 *   • Master enable toggle
 *   • Confidence threshold input (optional)
 *   • Per-field rows with aiEnabled toggle, maxWords, maxChars, style inputs
 *
 * On save, calls saveFieldFillAction() and shows inline success/error feedback.
 */

import { useState, useTransition } from "react";
import {
  saveFieldFillAction,
  type SaveFieldFillInput,
  type SlotFieldFillFormValue,
  type FieldFillSpecFormValue,
} from "../actions";
import type { TenantFieldFillSettings } from "@/tenant/types";

// ── Slot metadata ─────────────────────────────────────────────────────────────

interface FieldMeta {
  path:        string;
  label:       string;
  defaultMax?: number;
}

interface SlotMeta {
  id:          "hero" | "proof" | "cta";
  label:       string;
  description: string;
  fields:      FieldMeta[];
}

const SLOT_META: SlotMeta[] = [
  {
    id:          "hero",
    label:       "Hero",
    description: "Adaptive page header (headline, subtitle, eyebrow tag, and CTA labels).",
    fields: [
      { path: "title",        label: "Title (headline)",     defaultMax: 10 },
      { path: "subtitle",     label: "Subtitle",             defaultMax: 25 },
      { path: "tag",          label: "Eyebrow tag",          defaultMax: 6  },
      { path: "ctas.0.label", label: "Primary CTA label",   defaultMax: 5  },
      { path: "ctas.1.label", label: "Secondary CTA label", defaultMax: 5  },
    ],
  },
  {
    id:          "proof",
    label:       "Proof",
    description: "Social proof section (section title and up to three proof point titles and text).",
    fields: [
      { path: "title",          label: "Section title",         defaultMax: 10 },
      { path: "items.0.title",  label: "Proof point 1 (title)", defaultMax: 8  },
      { path: "items.0.text",   label: "Proof point 1 (text)",  defaultMax: 30 },
      { path: "items.1.title",  label: "Proof point 2 (title)", defaultMax: 8  },
      { path: "items.1.text",   label: "Proof point 2 (text)",  defaultMax: 30 },
      { path: "items.2.title",  label: "Proof point 3 (title)", defaultMax: 8  },
      { path: "items.2.text",   label: "Proof point 3 (text)",  defaultMax: 30 },
    ],
  },
  {
    id:          "cta",
    label:       "CTA",
    description: "Call-to-action section (headline, supporting text, and CTA button label).",
    fields: [
      { path: "title",     label: "CTA headline",      defaultMax: 12 },
      { path: "text",      label: "Supporting text",   defaultMax: 40 },
      { path: "cta.label", label: "Button label",      defaultMax: 5  },
    ],
  },
];

// ── Default builder ───────────────────────────────────────────────────────────

function buildDefault(saved: TenantFieldFillSettings | null): SaveFieldFillInput {
  const slotDefault = (slotId: "hero" | "proof" | "cta"): SlotFieldFillFormValue => {
    const savedSlot = saved?.[slotId];
    const meta      = SLOT_META.find((s) => s.id === slotId)!;

    const fields: Record<string, FieldFillSpecFormValue> = {};
    for (const field of meta.fields) {
      const savedField = savedSlot?.fields[field.path];
      fields[field.path] = {
        aiEnabled: savedField?.aiEnabled ?? false,
        maxWords:  savedField?.maxWords  ?? field.defaultMax,
        style:     savedField?.style     ?? "",
      };
    }

    return {
      enabled:             savedSlot?.enabled             ?? false,
      confidenceThreshold: savedSlot?.confidenceThreshold ?? 0.7,
      fields,
    };
  };

  return {
    hero:  slotDefault("hero"),
    proof: slotDefault("proof"),
    cta:   slotDefault("cta"),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FieldFillClient({
  tenantId,
  initialSettings,
}: {
  tenantId:        string;
  initialSettings: TenantFieldFillSettings | null;
}) {
  const [form,        setForm]        = useState<SaveFieldFillInput>(() => buildDefault(initialSettings));
  const [status,      setStatus]      = useState<"idle" | "success" | "error">("idle");
  const [errorMsg,    setErrorMsg]    = useState<string>("");
  const [isPending,   startTransition] = useTransition();

  const updateSlot = (
    slotId: "hero" | "proof" | "cta",
    patch:  Partial<SlotFieldFillFormValue>,
  ) => setForm((prev) => ({ ...prev, [slotId]: { ...prev[slotId], ...patch } }));

  const updateField = (
    slotId:    "hero" | "proof" | "cta",
    fieldPath: string,
    patch:     Partial<FieldFillSpecFormValue>,
  ) =>
    setForm((prev) => ({
      ...prev,
      [slotId]: {
        ...prev[slotId],
        fields: {
          ...prev[slotId].fields,
          [fieldPath]: { ...prev[slotId].fields[fieldPath]!, ...patch },
        },
      },
    }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("idle");
    startTransition(async () => {
      const result = await saveFieldFillAction(tenantId, form);
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
            {/* Slot header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">{slot.label}</h3>
                <p className="mt-0.5 text-xs text-neutral-500">{slot.description}</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs font-medium text-neutral-700">Enable</span>
                <input
                  type="checkbox"
                  checked={value.enabled}
                  onChange={(e) => updateSlot(slot.id, { enabled: e.target.checked })}
                  className="h-4 w-4 accent-blue-600"
                />
              </label>
            </div>

            {/* Confidence threshold */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Minimum confidence threshold
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={value.confidenceThreshold ?? 0.7}
                  onChange={(e) =>
                    updateSlot(slot.id, { confidenceThreshold: parseFloat(e.target.value) })
                  }
                  className="w-48 accent-blue-600"
                  disabled={!value.enabled}
                />
                <span className="text-xs font-mono text-neutral-600 w-10">
                  {((value.confidenceThreshold ?? 0.7) * 100).toFixed(0)}%
                </span>
              </div>
              <p className="mt-1 text-xs text-neutral-400">
                AI field fill is only applied when the AI&apos;s confidence meets this threshold.
                Set to 0 to always apply.
              </p>
            </div>

            {/* Per-field table */}
            {value.enabled && (
              <div className="rounded border border-neutral-100 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-neutral-600">Field</th>
                      <th className="px-3 py-2 text-center font-medium text-neutral-600">AI enabled</th>
                      <th className="px-3 py-2 text-center font-medium text-neutral-600">Max words</th>
                      <th className="px-3 py-2 text-left font-medium text-neutral-600">Style hint</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {slot.fields.map((field) => {
                      const spec = value.fields[field.path] ?? { aiEnabled: false };
                      return (
                        <tr key={field.path} className={spec.aiEnabled ? "bg-blue-50/30" : ""}>
                          <td className="px-3 py-2 text-neutral-700 font-mono">{field.label}</td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={spec.aiEnabled}
                              onChange={(e) =>
                                updateField(slot.id, field.path, { aiEnabled: e.target.checked })
                              }
                              className="h-4 w-4 accent-blue-600"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={1}
                              value={spec.maxWords ?? field.defaultMax ?? ""}
                              onChange={(e) =>
                                updateField(slot.id, field.path, {
                                  maxWords: e.target.value ? parseInt(e.target.value, 10) : undefined,
                                })
                              }
                              disabled={!spec.aiEnabled}
                              className="w-16 rounded border border-neutral-300 px-1.5 py-0.5 text-center text-xs disabled:bg-neutral-50 disabled:text-neutral-400 focus:border-blue-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={spec.style ?? ""}
                              placeholder="e.g. punchy, benefit-led"
                              onChange={(e) =>
                                updateField(slot.id, field.path, { style: e.target.value })
                              }
                              disabled={!spec.aiEnabled}
                              className="w-full rounded border border-neutral-300 px-2 py-0.5 text-xs disabled:bg-neutral-50 disabled:text-neutral-400 focus:border-blue-500 focus:outline-none"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!value.enabled && (
              <p className="text-xs text-neutral-400 italic mt-2">
                Field fill is disabled for this slot. Enable above to configure fields.
              </p>
            )}
          </div>
        );
      })}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-neutral-200 pt-4">
        <div>
          {status === "success" && (
            <p className="text-sm text-green-600 font-medium">Field fill settings saved.</p>
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
          {isPending ? "Saving…" : "Save field fill settings"}
        </button>
      </div>
    </form>
  );
}
