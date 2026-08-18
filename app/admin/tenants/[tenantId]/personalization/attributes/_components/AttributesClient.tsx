"use client";

/**
 * Custom Attributes editor (client).
 *
 * A simple list of declarations: name, type, optional label, optional
 * allowedValues (comma-separated, for string / number), optional description.
 * Saves via saveCustomAttributesAction. English UI.
 */

import { useState, useTransition } from "react";
import type { CustomAttributeDeclaration } from "@/tenant/types";
import { saveCustomAttributesAction }       from "../actions";

interface Row {
  name:             string;
  type:             "string" | "number" | "boolean";
  label:            string;
  description:      string;
  allowedValuesText: string;
}

function toRow(d: CustomAttributeDeclaration): Row {
  return {
    name:              d.name,
    type:              d.type,
    label:             d.label ?? "",
    description:       d.description ?? "",
    allowedValuesText: (d.allowedValues ?? []).join(", "),
  };
}

function blankRow(): Row {
  return { name: "", type: "string", label: "", description: "", allowedValuesText: "" };
}

const inputCls =
  "w-full rounded border border-neutral-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none";

export function AttributesClient({
  tenantId,
  initialDeclarations,
}: {
  tenantId:            string;
  initialDeclarations: CustomAttributeDeclaration[];
}) {
  const [rows, setRows]       = useState<Row[]>(initialDeclarations.map(toRow));
  const [status, setStatus]   = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startSave]  = useTransition();

  function patch(i: number, next: Partial<Row>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...next } : r)));
    setStatus(null);
  }
  function addRow()          { setRows((rs) => [...rs, blankRow()]); setStatus(null); }
  function removeRow(i: number) { setRows((rs) => rs.filter((_, idx) => idx !== i)); setStatus(null); }

  function save() {
    const drafts = rows.map((r) => ({
      name:          r.name,
      type:          r.type,
      label:         r.label,
      description:   r.description,
      allowedValues: r.allowedValuesText.split(",").map((v) => v.trim()).filter((v) => v !== ""),
    }));
    startSave(async () => {
      const result = await saveCustomAttributesAction(tenantId, drafts);
      setStatus(result.ok
        ? { kind: "ok", text: "Saved." }
        : { kind: "error", text: result.error ?? "Save failed." });
    });
  }

  return (
    <div>
      {rows.length === 0 && (
        <p className="mb-4 rounded border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">
          No attributes declared yet. Add one to use it in an Attribute condition.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {rows.map((row, i) => (
          <div key={i} className="rounded-lg border border-neutral-200 bg-white p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_130px]">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-600">Name</span>
                <input
                  className={inputCls}
                  value={row.name}
                  placeholder="massa"
                  onChange={(e) => patch(i, { name: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-600">Type</span>
                <select
                  className={inputCls}
                  value={row.type}
                  onChange={(e) => patch(i, { type: e.target.value as Row["type"] })}
                >
                  <option value="string">string</option>
                  <option value="number">number</option>
                  <option value="boolean">boolean</option>
                </select>
              </label>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-600">Label (optional)</span>
                <input
                  className={inputCls}
                  value={row.label}
                  placeholder="Mass (kg)"
                  onChange={(e) => patch(i, { label: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-600">
                  Allowed values (optional, comma-separated)
                </span>
                <input
                  className={inputCls}
                  value={row.allowedValuesText}
                  placeholder={row.type === "boolean" ? "not used for boolean" : "kipper, transporter, bak"}
                  disabled={row.type === "boolean"}
                  onChange={(e) => patch(i, { allowedValuesText: e.target.value })}
                />
              </label>
            </div>

            <div className="mt-3 flex items-end gap-3">
              <label className="block flex-1">
                <span className="mb-1 block text-xs font-medium text-neutral-600">Description (optional)</span>
                <input
                  className={inputCls}
                  value={row.description}
                  placeholder="Trailer mass in kilograms"
                  onChange={(e) => patch(i, { description: e.target.value })}
                />
              </label>
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Add attribute
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save changes"}
        </button>
        {status && (
          <span className={`text-sm ${status.kind === "ok" ? "text-green-600" : "text-red-600"}`}>
            {status.text}
          </span>
        )}
      </div>
    </div>
  );
}
