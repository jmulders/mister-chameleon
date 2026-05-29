"use client";

/**
 * ContextVariableManager
 *
 * Client component powering the interactive parts of /admin/context:
 *
 *   • Edit panel     — inline expand when "Edit" is clicked; saves via
 *                      upsertMetadataAction (built-ins) or is a no-op for the
 *                      system-immutable fields of built-ins.
 *   • Toggle switch  — enables/disables a variable via toggleEnabledAction.
 *   • Create panel   — collapsible form for adding a new custom variable.
 *   • Delete button  — removes a custom variable after confirmation.
 *
 * Props are passed from the async server component in page.tsx; no
 * additional data fetching happens client-side.
 */

import { useState, useTransition } from "react";
import {
  upsertMetadataAction,
  createCustomVariableAction,
  deleteCustomVariableAction,
  toggleEnabledAction,
} from "./actions";
import type { MergedContextVar } from "@/context/merged-registry";

// ── Colour maps (replicated from page.tsx for client use) ─────────────────────

const TYPE_BADGE: Record<string, string> = {
  string:  "bg-blue-100 text-blue-700",
  enum:    "bg-violet-100 text-violet-700",
  number:  "bg-amber-100 text-amber-700",
  boolean: "bg-green-100 text-green-700",
};

const SOURCE_BADGE: Record<string, string> = {
  request:    "bg-sky-100 text-sky-700",
  session:    "bg-teal-100 text-teal-700",
  history:    "bg-orange-100 text-orange-700",
  tenant:     "bg-pink-100 text-pink-700",
  page:       "bg-neutral-100 text-neutral-600",
  enrichment: "bg-indigo-100 text-indigo-700",
  time:       "bg-amber-100 text-amber-700",
};

// ── ToggleSwitch ──────────────────────────────────────────────────────────────

function ToggleSwitch({
  varKey,
  enabled,
  onToggle,
}: {
  varKey:   string;
  enabled:  boolean;
  onToggle: (key: string, value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onToggle(varKey, !enabled)}
      className={[
        "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent",
        "transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1",
        enabled ? "bg-brand-500" : "bg-neutral-200",
      ].join(" ")}
      title={enabled ? "Disable variable" : "Enable variable"}
    >
      <span
        className={[
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow",
          "transition duration-200 ease-in-out",
          enabled ? "translate-x-4" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

// ── EditPanel ─────────────────────────────────────────────────────────────────

function EditPanel({
  v,
  onClose,
  onSaved,
}: {
  v:       MergedContextVar;
  onClose: () => void;
  onSaved: (key: string, updates: Partial<MergedContextVar>) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [label,       setLabel]       = useState(v.label       ?? "");
  const [description, setDescription] = useState(v.description ?? "");
  const [category,    setCategory]    = useState(v.category    ?? "");
  const [sortOrder,   setSortOrder]   = useState(String(v.sortOrder ?? 0));
  const [usableRules, setUsableRules] = useState(v.usableInRules);
  const [usableAI,    setUsableAI]    = useState(v.usableInAI);
  const [error,       setError]       = useState<string | null>(null);
  const [success,     setSuccess]     = useState(false);

  function handleSave() {
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await upsertMetadataAction(v.key, {
        label:           label.trim()       || null,
        description:     description.trim() || null,
        category:        category.trim()    || null,
        sort_order:      parseInt(sortOrder, 10) || 0,
        usable_in_rules: usableRules,
        usable_in_ai:    usableAI,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccess(true);
      onSaved(v.key, {
        label:         label.trim()       || v.label,
        description:   description.trim() || v.description,
        category:      category.trim()    || null,
        sortOrder:     parseInt(sortOrder, 10) || 0,
        usableInRules: usableRules,
        usableInAI:    usableAI,
      });
      setTimeout(onClose, 600);
    });
  }

  return (
    <tr>
      <td colSpan={8} className="px-0 py-0">
        <div className="border-l-2 border-brand-400 bg-brand-50/40 px-6 py-4">
          <p className="mb-3 text-xs font-semibold text-neutral-600 uppercase tracking-wide">
            Editing: <code className="font-mono normal-case text-neutral-800">{v.key}</code>
            {v.isCustom && (
              <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 uppercase">
                custom
              </span>
            )}
          </p>

          {/* Two-column grid for fields */}
          <div className="grid gap-3 sm:grid-cols-2">

            {/* Label */}
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-neutral-600">Label</span>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={v.isCustom ? "Required" : `Default: ${v.label}`}
                className="rounded border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
              />
            </label>

            {/* Category */}
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-neutral-600">Category <span className="text-neutral-400">(optional)</span></span>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Traffic, Company"
                className="rounded border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
              />
            </label>

            {/* Description */}
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs font-medium text-neutral-600">Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder={v.isCustom ? "Required" : `Default: ${v.description}`}
                className="rounded border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
              />
            </label>

            {/* Sort order */}
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-neutral-600">Sort order</span>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="rounded border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
              />
            </label>

            {/* Availability gates */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-neutral-600">Available to</span>
              <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={usableRules}
                  onChange={(e) => setUsableRules(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-neutral-300 text-brand-600 focus:ring-brand-400"
                />
                Rules builder
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={usableAI}
                  onChange={(e) => setUsableAI(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-neutral-300 text-brand-600 focus:ring-brand-400"
                />
                AI context
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="rounded bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
            >
              Cancel
            </button>
            {success && (
              <span className="text-xs text-emerald-600 font-medium">Saved ✓</span>
            )}
            {error && (
              <span className="text-xs text-red-600">{error}</span>
            )}
          </div>

          {/* Immutable fields notice for built-ins */}
          {!v.isCustom && (
            <p className="mt-3 text-[11px] text-neutral-400">
              Type ({v.type}), source ({v.source}), and operators are read-only for built-in variables —
              they are defined in <code className="font-mono">context/registry.ts</code>.
            </p>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── CreateCustomForm ──────────────────────────────────────────────────────────

function CreateCustomForm({ onCreated }: { onCreated: (v: MergedContextVar) => void }) {
  const [open,        setOpen]        = useState(false);
  const [isPending,   startTransition] = useTransition();
  const [key,         setKey]          = useState("");
  const [label,       setLabel]        = useState("");
  const [description, setDescription]  = useState("");
  const [type,        setType]         = useState<"string" | "enum" | "number" | "boolean">("string");
  const [source,      setSource]       = useState<"request"|"session"|"history"|"tenant"|"page"|"enrichment"|"time">("enrichment");
  const [usableRules, setUsableRules]  = useState(false);
  const [usableAI,    setUsableAI]     = useState(false);
  const [category,    setCategory]     = useState("");
  const [error,       setError]        = useState<string | null>(null);

  function reset() {
    setKey(""); setLabel(""); setDescription("");
    setType("string"); setSource("enrichment");
    setUsableRules(false); setUsableAI(false);
    setCategory(""); setError(null);
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createCustomVariableAction({
        key:             key.trim(),
        label:           label.trim(),
        description:     description.trim(),
        custom_type:     type,
        custom_source:   source,
        usable_in_rules: usableRules,
        usable_in_ai:    usableAI,
        category:        category.trim() || null,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Build a MergedContextVar-like shape from the new row.
      const row = result.data;
      const newVar: MergedContextVar = {
        key:              row.key,
        label:            row.label            ?? row.key,
        description:      row.description      ?? "",
        type:             row.custom_type       as "string" | "enum" | "number" | "boolean",
        source:           row.custom_source     as "request"|"session"|"history"|"tenant"|"page"|"enrichment"|"time",
        operators:        [],
        availableToRules: row.usable_in_rules ?? false,
        availableToAI:    row.usable_in_ai    ?? false,
        usableInRules:    row.usable_in_rules ?? false,
        usableInAI:       row.usable_in_ai    ?? false,
        enabled:          true,
        category:         row.category          ?? null,
        sortOrder:        row.sort_order        ?? 0,
        isCustom:         true,
        metadataRow:      row,
      };

      onCreated(newVar);
      reset();
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-dashed border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
      >
        + Add custom variable
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-brand-200 bg-brand-50/40 p-5">
      <p className="mb-4 text-sm font-semibold text-neutral-800">New custom variable</p>

      <div className="grid gap-3 sm:grid-cols-2">

        {/* Key */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-600">Key <span className="text-red-500">*</span></span>
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            placeholder="e.g. company_tier"
            className="rounded border border-neutral-300 px-2.5 py-1.5 text-sm font-mono focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
          />
          <span className="text-[10px] text-neutral-400">Lowercase letters, digits, underscores. Cannot be changed later.</span>
        </label>

        {/* Label */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-600">Label <span className="text-red-500">*</span></span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Company Tier"
            className="rounded border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
          />
        </label>

        {/* Description */}
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-xs font-medium text-neutral-600">Description <span className="text-red-500">*</span></span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="What this variable represents."
            className="rounded border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
          />
        </label>

        {/* Type */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-600">Type <span className="text-red-500">*</span></span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className="rounded border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
          >
            <option value="string">string</option>
            <option value="enum">enum</option>
            <option value="number">number</option>
            <option value="boolean">boolean</option>
          </select>
        </label>

        {/* Source */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-600">Source <span className="text-red-500">*</span></span>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as typeof source)}
            className="rounded border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
          >
            <option value="request">request</option>
            <option value="session">session</option>
            <option value="history">history</option>
            <option value="tenant">tenant</option>
            <option value="page">page</option>
            <option value="enrichment">enrichment</option>
            <option value="time">time (derived)</option>
          </select>
        </label>

        {/* Category */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-neutral-600">Category <span className="text-neutral-400">(optional)</span></span>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Company"
            className="rounded border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-300"
          />
        </label>

        {/* Availability */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-neutral-600">Available to</span>
          <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
            <input
              type="checkbox"
              checked={usableRules}
              onChange={(e) => setUsableRules(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-neutral-300 text-brand-600"
            />
            Rules builder
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
            <input
              type="checkbox"
              checked={usableAI}
              onChange={(e) => setUsableAI(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-neutral-300 text-brand-600"
            />
            AI context
          </label>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={handleCreate}
          disabled={isPending || !key.trim() || !label.trim() || !description.trim()}
          className="rounded bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Creating…" : "Create variable"}
        </button>
        <button
          type="button"
          onClick={() => { reset(); setOpen(false); }}
          disabled={isPending}
          className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── DeleteButton ──────────────────────────────────────────────────────────────

function DeleteButton({
  varKey,
  onDeleted,
}: {
  varKey:    string;
  onDeleted: (key: string) => void;
}) {
  const [confirming,  setConfirming]  = useState(false);
  const [isPending,   startTransition] = useTransition();
  const [error,       setError]        = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteCustomVariableAction(varKey);
      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      onDeleted(varKey);
    });
  }

  if (error) {
    return <span className="text-[10px] text-red-600">{error}</span>;
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-[11px] text-neutral-400 hover:text-red-500 transition-colors"
        title="Delete custom variable"
      >
        Delete
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-[11px] text-neutral-600">Sure?</span>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="text-[11px] font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
      >
        {isPending ? "…" : "Yes"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={isPending}
        className="text-[11px] text-neutral-400 hover:text-neutral-600"
      >
        No
      </button>
    </span>
  );
}

// ── VariableRow ───────────────────────────────────────────────────────────────

function VariableRow({
  v,
  editingKey,
  onEditOpen,
  onEditClose,
  onSaved,
  onToggle,
  onDeleted,
}: {
  v:          MergedContextVar;
  editingKey: string | null;
  onEditOpen:  (key: string) => void;
  onEditClose: () => void;
  onSaved:     (key: string, updates: Partial<MergedContextVar>) => void;
  onToggle:    (key: string, value: boolean) => void;
  onDeleted:   (key: string) => void;
}) {
  const isEditing = editingKey === v.key;

  return (
    <>
      <tr
        className={[
          "border-b border-neutral-100 last:border-0 transition-colors",
          !v.enabled ? "opacity-50" : "",
          isEditing ? "bg-brand-50/60" : "hover:bg-neutral-50/60",
        ].join(" ")}
      >
        {/* Key + label */}
        <td className="py-2.5 pl-4 pr-3 align-top">
          <div className="flex items-start gap-1.5">
            <div>
              <code className="block text-xs font-mono font-semibold text-neutral-800">
                {v.key}
              </code>
              <span className="mt-0.5 block text-[11px] text-neutral-500">{v.label}</span>
            </div>
            {v.isCustom && (
              <span className="mt-0.5 flex-shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 uppercase">
                custom
              </span>
            )}
          </div>
        </td>

        {/* Description */}
        <td className="py-2.5 pr-3 align-top text-xs text-neutral-600 max-w-xs">
          {v.description}
        </td>

        {/* Type */}
        <td className="py-2.5 pr-3 align-top whitespace-nowrap">
          <span className={[
            "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            TYPE_BADGE[v.type] ?? "bg-neutral-100 text-neutral-600",
          ].join(" ")}>
            {v.type}
          </span>
        </td>

        {/* Source */}
        <td className="py-2.5 pr-3 align-top whitespace-nowrap">
          <span className={[
            "inline-block rounded px-1.5 py-0.5 text-[10px] font-medium",
            SOURCE_BADGE[v.source] ?? "bg-neutral-100 text-neutral-600",
          ].join(" ")}>
            {v.source}
          </span>
        </td>

        {/* Availability */}
        <td className="py-2.5 pr-3 align-top">
          <div className="flex flex-col gap-0.5">
            <span className={[
              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              v.usableInRules ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-400",
            ].join(" ")}>
              <span className={["h-1.5 w-1.5 rounded-full", v.usableInRules ? "bg-emerald-500" : "bg-neutral-300"].join(" ")} />
              Rules
            </span>
            <span className={[
              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              v.usableInAI ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-400",
            ].join(" ")}>
              <span className={["h-1.5 w-1.5 rounded-full", v.usableInAI ? "bg-emerald-500" : "bg-neutral-300"].join(" ")} />
              AI
            </span>
          </div>
        </td>

        {/* Enabled toggle */}
        <td className="py-2.5 pr-3 align-middle">
          <ToggleSwitch varKey={v.key} enabled={v.enabled} onToggle={onToggle} />
        </td>

        {/* Actions */}
        <td className="py-2.5 pr-4 align-middle whitespace-nowrap">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => isEditing ? onEditClose() : onEditOpen(v.key)}
              className="text-[11px] font-medium text-brand-600 hover:text-brand-800 transition-colors"
            >
              {isEditing ? "Close" : "Edit"}
            </button>
            {v.isCustom && (
              <DeleteButton varKey={v.key} onDeleted={onDeleted} />
            )}
          </div>
        </td>
      </tr>

      {isEditing && (
        <EditPanel
          v={v}
          onClose={onEditClose}
          onSaved={onSaved}
        />
      )}
    </>
  );
}

// ── Main export: ContextVariableManager ──────────────────────────────────────

export interface ContextVariableManagerProps {
  initialVars: MergedContextVar[];
}

export function ContextVariableManager({ initialVars }: ContextVariableManagerProps) {
  const [vars,       setVars]       = useState<MergedContextVar[]>(initialVars);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [togglePending, startToggle] = useTransition();

  function handleToggle(key: string, value: boolean) {
    startToggle(async () => {
      const result = await toggleEnabledAction(key, value);
      if (!result.ok) return; // Silently ignore; production app could toast here.
      setVars((prev) =>
        prev.map((v) => v.key === key ? { ...v, enabled: value } : v),
      );
    });
  }

  function handleSaved(key: string, updates: Partial<MergedContextVar>) {
    setVars((prev) =>
      prev.map((v) => v.key === key ? { ...v, ...updates } : v),
    );
  }

  function handleCreated(newVar: MergedContextVar) {
    setVars((prev) => [...prev, newVar]);
  }

  function handleDeleted(key: string) {
    setVars((prev) => prev.filter((v) => v.key !== key));
    if (editingKey === key) setEditingKey(null);
  }

  // Group by source for display.
  const sourceOrder = ["request", "session", "history", "tenant", "page", "enrichment", "time", "custom"] as const;
  type SourceGroup = typeof sourceOrder[number];

  const grouped = vars.reduce<Record<string, MergedContextVar[]>>((acc, v) => {
    const group = v.isCustom ? "custom" : v.source;
    (acc[group] ??= []).push(v);
    return acc;
  }, {});

  const sourceLabels: Record<string, string> = {
    request:    "HTTP Request",
    session:    "Session Cookie",
    history:    "Event History",
    tenant:     "Tenant Config",
    page:       "Page Metadata",
    enrichment: "Enrichment",
    time:       "Time & Seasonality",
    custom:     "Custom Variables",
  };

  const enabledCount  = vars.filter((v) => v.enabled).length;
  const rulesCount    = vars.filter((v) => v.enabled && v.usableInRules).length;
  const aiCount       = vars.filter((v) => v.enabled && v.usableInAI).length;
  const customCount   = vars.filter((v) => v.isCustom).length;

  return (
    <div>
      {/* Summary bar */}
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-2.5">
          <p className="text-xs text-neutral-500">Total</p>
          <p className="text-xl font-bold text-neutral-900">{vars.length}</p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white px-4 py-2.5">
          <p className="text-xs text-neutral-500">Enabled</p>
          <p className="text-xl font-bold text-neutral-900">{enabledCount}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5">
          <p className="text-xs text-emerald-600">Rules eligible</p>
          <p className="text-xl font-bold text-emerald-800">{rulesCount}</p>
        </div>
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5">
          <p className="text-xs text-sky-600">AI eligible</p>
          <p className="text-xl font-bold text-sky-800">{aiCount}</p>
        </div>
        {customCount > 0 && (
          <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5">
            <p className="text-xs text-violet-600">Custom</p>
            <p className="text-xl font-bold text-violet-800">{customCount}</p>
          </div>
        )}
      </div>

      {/* Variable groups */}
      {sourceOrder.map((group) => {
        const groupVars = grouped[group];
        if (!groupVars || groupVars.length === 0) return null;

        return (
          <section key={group} className="mb-6">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-700">
              <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-neutral-100 text-neutral-600">
                {group}
              </span>
              <span>{sourceLabels[group]}</span>
              <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
                {groupVars.length}
              </span>
            </h2>

            <div className="overflow-hidden rounded-lg border border-neutral-200">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50">
                  <tr>
                    <th className="py-2 pl-4 pr-3 text-xs font-semibold text-neutral-500">Key / Label</th>
                    <th className="py-2 pr-3 text-xs font-semibold text-neutral-500">Description</th>
                    <th className="py-2 pr-3 text-xs font-semibold text-neutral-500">Type</th>
                    <th className="py-2 pr-3 text-xs font-semibold text-neutral-500">Source</th>
                    <th className="py-2 pr-3 text-xs font-semibold text-neutral-500">Available to</th>
                    <th className="py-2 pr-3 text-xs font-semibold text-neutral-500">Enabled</th>
                    <th className="py-2 pr-4 text-xs font-semibold text-neutral-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {groupVars.map((v) => (
                    <VariableRow
                      key={v.key}
                      v={v}
                      editingKey={editingKey}
                      onEditOpen={setEditingKey}
                      onEditClose={() => setEditingKey(null)}
                      onSaved={handleSaved}
                      onToggle={handleToggle}
                      onDeleted={handleDeleted}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {/* Create custom variable */}
      <div className="mt-4">
        <CreateCustomForm onCreated={handleCreated} />
      </div>

      {/* Legend */}
      <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-[11px] text-neutral-500">
        <strong className="text-neutral-600">Built-in variables</strong> — type, source, and operators are read-only (defined in{" "}
        <code className="font-mono">context/registry.ts</code>). Label, description, availability gates, and enabled state are editable.
        {" "}<strong className="text-neutral-600">Custom variables</strong> — fully configurable; can be deleted. Keys cannot be changed after creation.
      </div>
    </div>
  );
}
