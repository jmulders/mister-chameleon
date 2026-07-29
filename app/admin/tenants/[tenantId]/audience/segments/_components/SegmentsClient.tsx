"use client";

/**
 * Audience Segments — Admin Client
 *
 * Full CRUD UI for tenant audience segments.
 *
 * Features:
 *   - List all segments with active/inactive indicator
 *   - Create new segments (key + label + description + criteria JSON)
 *   - Edit existing segments
 *   - Toggle active/inactive with dependency warning
 *   - Delete with dependency warning
 *   - Plan limit banner when at or near cap
 */

import React, { useState, useTransition } from "react";
import type { AudienceSegment }           from "@/audience-segments/types";
import { SEED_AUDIENCE_SEGMENTS }          from "@/audience-segments/seed";
import {
  FlatGroupEditor,
  toEditorGroup,
  fromEditorGroup,
  defaultLeaf,
} from "@/components/rules/ConditionBuilder";
import type { RuleCondition } from "@/decision/rules/stored-rule";
import {
  listAudienceSegmentsAction,
  createAudienceSegmentAction,
  updateAudienceSegmentAction,
  deleteAudienceSegmentAction,
  toggleAudienceSegmentActiveAction,
  checkSegmentDependenciesAction,
  seedAudienceSegmentsAction,
} from "../actions";
import type { DependentRule } from "@/decision/rules/find-dependent-rules";

// ── Props ─────────────────────────────────────────────────────────────────────

interface SegmentsClientProps {
  initialSegments: AudienceSegment[];
  tenantId:        string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Pretty-print JSONB criteria for display */
function prettyCriteria(criteria: Record<string, unknown>): string {
  if (!criteria || Object.keys(criteria).length === 0) return "(empty)";
  try {
    return JSON.stringify(criteria, null, 2);
  } catch {
    return "(invalid)";
  }
}

// ── Dependency Confirmation Banner ────────────────────────────────────────────

function DepConfirmBanner({
  dependentRules,
  actionLabel,
  onConfirm,
  onCancel,
}: {
  dependentRules: DependentRule[];
  actionLabel:    string;
  onConfirm:      () => void;
  onCancel:       () => void;
}) {
  return (
    <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-5 py-4 space-y-3">
      <p className="text-sm font-semibold text-amber-900">
        {actionLabel} this segment may affect {dependentRules.length} active rule{dependentRules.length === 1 ? "" : "s"}
      </p>
      <p className="text-xs text-amber-800">
        The following enabled personalization rules condition on{" "}
        <code className="font-mono bg-amber-100 px-0.5 rounded">audienceSegmentIds</code>{" "}
        for this segment. They will silently stop matching if this segment is {actionLabel.toLowerCase()}d:
      </p>
      <ul className="space-y-1">
        {dependentRules.map((r) => (
          <li key={r.id} className="text-xs text-amber-800 flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
            <span className="font-medium">{r.label}</span>
            <span className="font-mono text-amber-600">({r.id})</span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="rounded border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="rounded bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
        >
          {actionLabel} anyway
        </button>
      </div>
    </div>
  );
}

// CriteriaEditor is replaced by FlatGroupEditor from @/components/rules/ConditionBuilder.

// ── Segment Form ──────────────────────────────────────────────────────────────

interface SegmentFormProps {
  initial:  Partial<AudienceSegment> | null;
  tenantId: string;
  onSaved:  (segment: AudienceSegment) => void;
  onCancel: () => void;
}

function SegmentForm({ initial, tenantId, onSaved, onCancel }: SegmentFormProps) {
  const isNew = !initial?.id;

  // Helper: build the initial RuleCondition from stored criteria (or a blank leaf).
  function initialCondition(seg: Partial<AudienceSegment> | null): RuleCondition {
    const c = seg?.criteria;
    if (!c || Object.keys(c).length === 0) return defaultLeaf();
    return c as unknown as RuleCondition;
  }

  const [key,         setKey]         = useState(initial?.key         ?? "");
  const [keyTouched,  setKeyTouched]  = useState(!!initial?.key);
  const [label,       setLabel]       = useState(initial?.label       ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [criteria,    setCriteria]    = useState<RuleCondition>(() => initialCondition(initial));
  const [isActive,    setIsActive]    = useState(initial?.isActive !== false);

  const [error,     setError]       = useState("");
  const [isPending, startTransition] = useTransition();

  function handleLabelChange(v: string) {
    setLabel(v);
    if (!keyTouched) setKey(slugify(v));
  }

  function handleSave() {
    setError("");
    if (!label.trim()) { setError("Label is required."); return; }
    if (isNew && !key.trim()) { setError("Key is required."); return; }
    if (isNew && !/^[a-z0-9]([a-z0-9-]{0,58}[a-z0-9])?$/.test(key)) {
      setError("Key must be 1–60 lowercase letters, digits, or hyphens.");
      return;
    }

    // Serialise the visual condition to a plain object for storage.
    const criteriaObj = fromEditorGroup(toEditorGroup(criteria)) as unknown as Record<string, unknown>;

    startTransition(async () => {
      let result: { ok: boolean; data?: AudienceSegment; error?: string };

      if (isNew) {
        result = await createAudienceSegmentAction(tenantId, {
          tenantId,
          key,
          label:       label.trim(),
          description: description.trim() || null,
          criteria:    criteriaObj,
          isActive,
        });
      } else {
        result = await updateAudienceSegmentAction(tenantId, {
          id:          initial!.id!,
          label:       label.trim(),
          description: description.trim() || null,
          criteria:    criteriaObj,
          isActive,
        });
      }

      if (result.ok && result.data) {
        onSaved(result.data);
      } else {
        setError(result.error ?? "Save failed.");
      }
    });
  }

  const inputCls = "w-full rounded border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-100";
  const labelCls = "block mb-1 text-xs font-medium text-neutral-500 uppercase tracking-wide";

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 space-y-4">
      <p className="text-sm font-semibold text-neutral-800">
        {isNew ? "New segment" : `Edit: ${initial?.label}`}
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Label</label>
          <input
            value={label}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder="e.g. High-Intent Enterprise"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Key</label>
          <input
            value={key}
            onChange={(e) => { setKey(e.target.value); setKeyTouched(true); }}
            disabled={!isNew}
            placeholder="e.g. high-intent-enterprise"
            className={`${inputCls} font-mono ${!isNew ? "bg-neutral-100 text-neutral-500 cursor-not-allowed" : ""}`}
          />
          {isNew && (
            <p className="mt-0.5 text-[10px] text-neutral-400">Lowercase letters, digits, hyphens. Cannot change after creation.</p>
          )}
        </div>
      </div>

      <div>
        <label className={labelCls}>Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Briefly describe who this segment targets"
          rows={3}
          className={`${inputCls} min-h-[4.5rem] resize-y leading-relaxed`}
        />
      </div>

      <div>
        <p className="block text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
          Criteria
        </p>
        <FlatGroupEditor
          condition={criteria}
          onChange={setCriteria}
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
        />
        Active (evaluated at runtime)
      </label>

      {error && (
        <p className="rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3 pt-1 border-t border-neutral-200">
        <button
          onClick={onCancel}
          className="rounded border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving…" : isNew ? "Create segment" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ── Segment Row ───────────────────────────────────────────────────────────────

interface SegmentRowProps {
  segment:     AudienceSegment;
  tenantId:    string;
  onEdit:      (s: AudienceSegment) => void;
  onToggle:    (s: AudienceSegment, newActive: boolean) => void;
  onDelete:    (s: AudienceSegment) => void;
  toggling?:   boolean;
  deleting?:   boolean;
  selected?:   boolean;
  onSelect?:   (id: string) => void;
}

function SegmentRow({ segment, onEdit, onToggle, onDelete, toggling, deleting, selected, onSelect }: SegmentRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={[
      "rounded-lg border bg-white transition-colors",
      selected ? "border-brand-300 bg-brand-50/30" : segment.isActive ? "border-neutral-200" : "border-neutral-100 opacity-60",
    ].join(" ")}>
      <div className="flex items-center gap-3 px-4 py-3">

        {/* Bulk select checkbox */}
        <input
          type="checkbox"
          checked={!!selected}
          onChange={() => onSelect?.(segment.id)}
          onClick={(e) => e.stopPropagation()}
          className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500 shrink-0"
        />

        {/* Active indicator */}
        <span className={[
          "inline-block h-2 w-2 rounded-full shrink-0",
          segment.isActive ? "bg-emerald-500" : "bg-neutral-300",
        ].join(" ")} />

        {/* Labels */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-neutral-900 truncate">{segment.label}</span>
            <code className="font-mono text-[11px] text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded shrink-0">
              {segment.key}
            </code>
          </div>
          {segment.description && (
            <p className="mt-0.5 text-xs text-neutral-500 truncate">{segment.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 transition-colors"
            title="View criteria"
          >
            {expanded ? "Hide" : "Criteria"}
          </button>
          <button
            onClick={() => onEdit(segment)}
            className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onToggle(segment, !segment.isActive)}
            disabled={toggling}
            className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
          >
            {toggling ? "…" : segment.isActive ? "Deactivate" : "Activate"}
          </button>
          <button
            onClick={() => onDelete(segment)}
            disabled={deleting}
            className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {deleting ? "…" : "Delete"}
          </button>
        </div>
      </div>

      {/* Criteria preview */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-neutral-100">
          <pre className="mt-2 overflow-x-auto rounded bg-neutral-50 border border-neutral-200 p-3 text-[11px] font-mono text-neutral-700 max-h-48">
            {prettyCriteria(segment.criteria)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Seed Panel ────────────────────────────────────────────────────────────────

/**
 * Expandable panel that previews all SEED_AUDIENCE_SEGMENTS and lets the
 * admin seed them with one click.  Shown as the primary CTA when there are
 * no segments yet, and as a secondary link otherwise.
 */
function SeedPanel({
  tenantId,
  onSeeded,
  compact = false,
}: {
  tenantId: string;
  onSeeded: (result: { created: number; skipped: number; createdAsInactive: number }) => void;
  compact?: boolean;
}) {
  const [open,     setOpen]    = useState(false);
  const [seeding,  setSeeding] = useState(false);
  const [seedErr,  setSeedErr] = useState<string | null>(null);

  async function handleSeed() {
    setSeeding(true);
    setSeedErr(null);
    const result = await seedAudienceSegmentsAction(tenantId);
    setSeeding(false);
    if (result.ok) {
      setOpen(false);
      onSeeded({ created: result.created, skipped: result.skipped, createdAsInactive: result.createdAsInactive });
    } else {
      setSeedErr(result.error ?? "Seed failed.");
    }
  }

  if (compact) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-neutral-400 hover:text-brand-600 transition-colors underline-offset-2 hover:underline"
        >
          {open ? "Hide starter segments" : "Seed starter segments"}
        </button>
        {open && (
          <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 space-y-3">
            <SeedPreviewList />
            <SeedActions seeding={seeding} seedErr={seedErr} onSeed={handleSeed} onCancel={() => setOpen(false)} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50 p-8 text-center">
      <div className="mb-3 text-3xl">🏷️</div>
      <p className="text-sm font-semibold text-neutral-800">No audience segments yet</p>
      <p className="mt-1 text-xs text-neutral-500 max-w-sm mx-auto">
        Seed {SEED_AUDIENCE_SEGMENTS.length} pre-built segments to get started instantly, or create your own.
      </p>
      <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 transition-colors"
        >
          {open ? "▲ Hide preview" : "▼ Preview starter segments"}
        </button>
      </div>

      {open && (
        <div className="mt-5 text-left space-y-3">
          <SeedPreviewList />
          {seedErr && (
            <p className="rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{seedErr}</p>
          )}
          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSeed}
              disabled={seeding}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {seeding ? "Creating segments…" : `Seed ${SEED_AUDIENCE_SEGMENTS.length} starter segments`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SeedPreviewList() {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
        {SEED_AUDIENCE_SEGMENTS.length} segments will be created
      </p>
      {SEED_AUDIENCE_SEGMENTS.map((seg) => (
        <div key={seg.key} className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5">
          <span className="mt-0.5 inline-block h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-neutral-800">{seg.label}</span>
              <code className="font-mono text-[11px] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded shrink-0">
                {seg.key}
              </code>
            </div>
            <p className="mt-0.5 text-xs text-neutral-500 leading-snug">{seg.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SeedActions({
  seeding, seedErr, onSeed, onCancel,
}: {
  seeding: boolean;
  seedErr: string | null;
  onSeed:  () => void;
  onCancel: () => void;
}) {
  return (
    <div>
      {seedErr && (
        <p className="mb-2 rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{seedErr}</p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSeed}
          disabled={seeding}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {seeding ? "Creating…" : `Seed ${SEED_AUDIENCE_SEGMENTS.length} segments`}
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main Client ───────────────────────────────────────────────────────────────

export function SegmentsClient({
  initialSegments,
  tenantId,
}: SegmentsClientProps) {
  const [segments,    setSegments]    = useState<AudienceSegment[]>(initialSegments);
  const [editing,     setEditing]     = useState<AudienceSegment | null | "new">(null);
  const [error,       setError]       = useState<string | null>(null);

  // Per-row loading states
  const [togglingId,  setTogglingId]  = useState<string | null>(null);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);

  // ── Bulk selection ─────────────────────────────────────────────────────────
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [bulkPending,  setBulkPending]  = useState(false);

  const toggleSelect  = (id: string) =>
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const selectAll     = () => setSelectedIds(new Set(segments.map((s) => s.id)));
  const clearSelected = () => setSelectedIds(new Set());

  async function bulkActivate(ids: string[]) {
    const toActivate = segments.filter((s) => ids.includes(s.id) && !s.isActive);
    if (toActivate.length === 0) { clearSelected(); return; }
    setBulkPending(true);
    setError(null);
    try {
      const results = await Promise.all(
        toActivate.map((s) => toggleAudienceSegmentActiveAction(tenantId, s.id, true)),
      );
      const failed = results.filter((r) => !r.ok).length;
      setSegments((prev) => prev.map((s) => ids.includes(s.id) ? { ...s, isActive: true } : s));
      if (failed > 0) setError(`${failed} segment${failed === 1 ? "" : "s"} failed to activate.`);
    } finally {
      setBulkPending(false);
      clearSelected();
    }
  }

  async function bulkDeactivate(ids: string[]) {
    const toDeactivate = segments.filter((s) => ids.includes(s.id) && s.isActive);
    if (toDeactivate.length === 0) { clearSelected(); return; }
    setBulkPending(true);
    setError(null);
    try {
      const results = await Promise.all(
        toDeactivate.map((s) => toggleAudienceSegmentActiveAction(tenantId, s.id, false)),
      );
      const failed = results.filter((r) => !r.ok).length;
      setSegments((prev) => prev.map((s) => ids.includes(s.id) ? { ...s, isActive: false } : s));
      if (failed > 0) setError(`${failed} segment${failed === 1 ? "" : "s"} failed to deactivate.`);
    } finally {
      setBulkPending(false);
      clearSelected();
    }
  }

  // Dependency confirmation state
  const [pendingAction,   setPendingAction]   = useState<
    | { type: "toggle"; segment: AudienceSegment; newActive: boolean }
    | { type: "delete"; segment: AudienceSegment }
    | null
  >(null);
  const [depRules,        setDepRules]        = useState<DependentRule[]>([]);
  const [checkingDepId,   setCheckingDepId]   = useState<string | null>(null);

  const [, startTransition] = useTransition();

  // ── Seed result banner ─────────────────────────────────────────────────────
  const [seedResult, setSeedResult] = useState<{
    created:           number;
    skipped:           number;
    createdAsInactive: number;
  } | null>(null);

  const activeCount = segments.filter((s) => s.isActive).length;

  // ── Seed callback ─────────────────────────────────────────────────────────

  async function handleSeeded(result: { created: number; skipped: number; createdAsInactive: number }) {
    setSeedResult(result);
    // Reload the segment list from the server action to pick up newly created rows.
    const fresh = await listAudienceSegmentsAction(tenantId);
    if (fresh.ok) setSegments(fresh.data);
  }

  // ── Segment saved (create / edit) ──────────────────────────────────────────

  function handleSaved(segment: AudienceSegment) {
    setSegments((prev) => {
      const idx = prev.findIndex((s) => s.id === segment.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = segment;
        return next;
      }
      return [...prev, segment];
    });
    setEditing(null);
    setError(null);
  }

  // ── Toggle active ──────────────────────────────────────────────────────────

  async function doToggle(segment: AudienceSegment, newActive: boolean) {
    setTogglingId(segment.id);
    setError(null);
    const result = await toggleAudienceSegmentActiveAction(tenantId, segment.id, newActive);
    setTogglingId(null);
    if (result.ok) {
      setSegments((prev) =>
        prev.map((s) => s.id === segment.id ? { ...s, isActive: newActive } : s),
      );
    } else {
      setError(result.error ?? "Toggle failed.");
    }
  }

  async function handleToggle(segment: AudienceSegment, newActive: boolean) {
    // Only check dependencies when deactivating
    if (!newActive) {
      setCheckingDepId(segment.id);
      const depResult = await checkSegmentDependenciesAction(tenantId, segment.key);
      setCheckingDepId(null);
      if (depResult.ok && depResult.dependentRules.length > 0) {
        setPendingAction({ type: "toggle", segment, newActive });
        setDepRules(depResult.dependentRules);
        return;
      }
    }
    await doToggle(segment, newActive);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function doDelete(segment: AudienceSegment) {
    setDeletingId(segment.id);
    setError(null);
    const result = await deleteAudienceSegmentAction(tenantId, segment.id);
    setDeletingId(null);
    if (result.ok) {
      setSegments((prev) => prev.filter((s) => s.id !== segment.id));
    } else {
      setError(result.error ?? "Delete failed.");
    }
  }

  async function handleDelete(segment: AudienceSegment) {
    setCheckingDepId(segment.id);
    const depResult = await checkSegmentDependenciesAction(tenantId, segment.key);
    setCheckingDepId(null);
    if (depResult.ok && depResult.dependentRules.length > 0) {
      setPendingAction({ type: "delete", segment });
      setDepRules(depResult.dependentRules);
      return;
    }
    // No dependents — proceed directly (no confirm for delete without dependents)
    await doDelete(segment);
  }

  // ── Confirm after dep warning ───────────────────────────────────────────────

  function handleDepConfirm() {
    const action = pendingAction;
    setPendingAction(null);
    setDepRules([]);
    if (!action) return;

    startTransition(async () => {
      if (action.type === "toggle") {
        await doToggle(action.segment, action.newActive);
      } else {
        await doDelete(action.segment);
      }
    });
  }

  function handleDepCancel() {
    setPendingAction(null);
    setDepRules([]);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const sorted = [...segments].sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div>
      {/* Dependency confirmation banner */}
      {pendingAction && depRules.length > 0 && (
        <DepConfirmBanner
          dependentRules={depRules}
          actionLabel={pendingAction.type === "toggle" ? "Deactivate" : "Delete"}
          onConfirm={handleDepConfirm}
          onCancel={handleDepCancel}
        />
      )}

      {/* Seed result banner */}
      {seedResult && (
        <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex items-start justify-between gap-3">
          <div>
            <span className="font-semibold">
              {seedResult.created === 0
                ? "All starter segments already exist."
                : `${seedResult.created} segment${seedResult.created === 1 ? "" : "s"} created.`}
            </span>
            {seedResult.skipped > 0 && (
              <span className="ml-2 text-emerald-600">
                {seedResult.skipped} already existed and were skipped.
              </span>
            )}
            {seedResult.createdAsInactive > 0 && (
              <span className="ml-2 text-amber-700">
                {seedResult.createdAsInactive} created as inactive (plan limit).
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSeedResult(null)}
            className="text-emerald-500 hover:text-emerald-700 shrink-0 text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Global error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Create form */}
      {editing === "new" && (
        <div className="mb-6">
          <SegmentForm
            initial={null}
            tenantId={tenantId}
            onSaved={handleSaved}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {/* Edit form */}
      {editing && editing !== "new" && (
        <div className="mb-6">
          <SegmentForm
            initial={editing}
            tenantId={tenantId}
            onSaved={handleSaved}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {/* Segment list header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {segments.length > 0 && (
            <input
              type="checkbox"
              aria-label="Select all segments"
              checked={segments.length > 0 && selectedIds.size === segments.length}
              onChange={(e) => e.target.checked ? selectAll() : clearSelected()}
              className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
            />
          )}
          <div className="text-sm text-neutral-500">
            {segments.length === 0
              ? "No segments yet."
              : `${activeCount} active · ${segments.length - activeCount} inactive`}
          </div>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing("new")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
          >
            <span>+</span>
            New segment
          </button>
        )}
      </div>

      {/* Bulk toolbar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
          <span className="text-xs font-medium text-neutral-600 shrink-0">
            {selectedIds.size} of {segments.length} selected
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => bulkActivate([...selectedIds])}
              disabled={bulkPending}
              className="inline-flex items-center gap-1 rounded border border-green-300 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors"
            >
              Activate
            </button>
            <button
              type="button"
              onClick={() => bulkDeactivate([...selectedIds])}
              disabled={bulkPending}
              className="inline-flex items-center gap-1 rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
            >
              Deactivate
            </button>
          </div>
          <button type="button" onClick={selectAll} className="text-xs font-medium text-brand-600 hover:text-brand-800 transition-colors">
            Select all
          </button>
          <button type="button" onClick={clearSelected} className="ml-auto text-xs text-neutral-400 hover:text-neutral-700 transition-colors shrink-0">
            Clear
          </button>
        </div>
      )}

      {/* Empty state: show full SeedPanel */}
      {segments.length === 0 && !editing && (
        <SeedPanel tenantId={tenantId} onSeeded={handleSeeded} compact={false} />
      )}

      {/* Compact seed link — shown when segments already exist */}
      {segments.length > 0 && (
        <div className="mb-3">
          <SeedPanel tenantId={tenantId} onSeeded={handleSeeded} compact={true} />
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((segment) => (
          <SegmentRow
            key={segment.id}
            segment={segment}
            tenantId={tenantId}
            onEdit={(s) => setEditing(s)}
            onToggle={handleToggle}
            onDelete={handleDelete}
            toggling={togglingId === segment.id || checkingDepId === segment.id}
            deleting={deletingId === segment.id}
            selected={selectedIds.has(segment.id)}
            onSelect={toggleSelect}
          />
        ))}
      </div>
    </div>
  );
}
