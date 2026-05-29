"use client";

/**
 * PlanExperimentsTable
 *
 * Tenant admin view of plan-based A/B experiments.
 *
 * Each experiment targets a specific rule and tests the rule's control plan
 * against a challenger plan (bucket 0 = control, bucket 1 = challenger).
 *
 * Shows:
 *   • Rule ID (which audience segment is being tested)
 *   • Challenger plan slots (what's different for bucket 1)
 *   • Status pill + quick-toggle (active ↔ paused)
 *   • Traffic fraction
 *   • Inline edit form (name, status, traffic, challenger plan)
 *   • Delete with confirmation
 */

import React, { useState, useTransition }              from "react";
import { useRouter }                                   from "next/navigation";
import {
  updatePlanExperimentAction,
  deletePlanExperimentAction,
}                                                       from "../actions";
import type { PlanExperimentRow }                       from "@/data/types";
import type { VariantCatalogue, VariantEntry }           from "@/decision/rules/variant-catalogue";

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = "draft" | "active" | "paused" | "ended";

type ChallengerPlan = PlanExperimentRow["challenger_plan"];

const PLAN_SLOTS = ["heroKey", "proofKey", "ctaKey", "featureKey", "conversionKey"] as const;
type PlanSlot = typeof PLAN_SLOTS[number];

const SLOT_LABELS: Record<PlanSlot, string> = {
  heroKey:       "Hero",
  proofKey:      "Proof",
  ctaKey:        "CTA",
  featureKey:    "Feature",
  conversionKey: "Conversion",
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Rule {
  id:    string;
  label: string;
}

interface Props {
  experiments:        PlanExperimentRow[];
  experimentsEnabled: boolean;
  tenantId:           string;
  variantCatalogue?:  VariantCatalogue;
  /** Available rules from the tenant's rules config. */
  rules:              Rule[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PlanExperimentsTable({
  experiments,
  experimentsEnabled,
  tenantId,
  variantCatalogue,
  rules,
}: Props) {
  const router = useRouter();

  const [togglingId,      setTogglingId]      = useState<string | null>(null);
  const [savedId,         setSavedId]         = useState<string | null>(null);
  const [deletingId,      setDeletingId]      = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingId,       setEditingId]       = useState<string | null>(null);
  const [error,           setError]           = useState<string | null>(null);
  const [isPending,       startTransition]    = useTransition();

  function handleToggleStatus(exp: PlanExperimentRow) {
    const next: Status = exp.status === "active" ? "paused" : "active";
    setTogglingId(exp.id);
    setError(null);

    startTransition(async () => {
      const result = await updatePlanExperimentAction(tenantId, exp.id, { status: next });
      setTogglingId(null);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSavedId(exp.id);
      setTimeout(() => setSavedId((id) => (id === exp.id ? null : id)), 2500);
      router.refresh();
    });
  }

  function handleDeleteConfirm(id: string) {
    setDeletingId(id);
    setConfirmDeleteId(null);
    setError(null);

    startTransition(async () => {
      const result = await deletePlanExperimentAction(tenantId, id);
      setDeletingId(null);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  if (experiments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-8 py-12 text-center">
        <p className="text-sm font-medium text-neutral-600">No plan experiments yet</p>
        <p className="mt-1 text-xs text-neutral-400">
          Use the create form above to define your first plan experiment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {!experimentsEnabled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Experiments globally disabled.</strong>{" "}
          No experiments are being evaluated for this tenant. Enable the experiments engine above to resume.
        </div>
      )}

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="shrink-0 text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50">
              <Th>ID / Name</Th>
              <Th>Rule</Th>
              <Th>Challenger plan</Th>
              <Th right>Traffic</Th>
              <Th>Status</Th>
              <Th right><span className="sr-only">Actions</span></Th>
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-50">
            {experiments.map((exp) => {
              const isToggling   = togglingId === exp.id && isPending;
              const isDeleting   = deletingId === exp.id && isPending;
              const wasSaved     = savedId    === exp.id;
              const isEditing    = editingId  === exp.id;
              const awaitConfirm = confirmDeleteId === exp.id;
              const status       = exp.status as Status;
              const canToggle    = status === "active" || status === "paused";

              const ruleLabel = rules.find((r) => r.id === exp.rule_id)?.label ?? exp.rule_id;

              return (
                <React.Fragment key={exp.id}>
                  <tr className={`transition-colors ${wasSaved ? "bg-green-50/60" : "hover:bg-neutral-50/40"}`}>
                    {/* ID / Name */}
                    <td className="px-4 py-3 align-middle">
                      <div className="flex flex-col gap-0.5">
                        <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs text-neutral-700 w-fit">
                          {exp.id}
                        </code>
                        <span className="text-xs font-medium text-neutral-700">{exp.name}</span>
                      </div>
                    </td>

                    {/* Rule */}
                    <td className="px-4 py-3 align-middle">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-neutral-700 font-medium">{ruleLabel}</span>
                        <code className="font-mono text-[10px] text-neutral-400">{exp.rule_id}</code>
                      </div>
                    </td>

                    {/* Challenger plan */}
                    <td className="px-4 py-3 align-middle">
                      <ChallengerPlanSummary plan={exp.challenger_plan} />
                    </td>

                    {/* Traffic */}
                    <td className="px-4 py-3 align-middle text-right">
                      <span className="tabular-nums text-xs text-neutral-600">
                        {Math.round(exp.traffic_fraction * 100)}%
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 align-middle">
                      <div className="flex flex-col gap-0.5">
                        <StatusBadge status={status} />
                        {wasSaved && (
                          <span className="text-[10px] font-medium text-green-700">✓ saved</span>
                        )}
                        {exp.ended_at && (
                          <span className="text-[10px] text-neutral-400">
                            ended {formatDate(exp.ended_at)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 align-middle text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canToggle && (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(exp)}
                            disabled={isPending || isEditing}
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium shadow-sm transition-colors disabled:cursor-wait disabled:opacity-50 ${
                              status === "active"
                                ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                            }`}
                          >
                            {isToggling
                              ? <SpinnerIcon />
                              : status === "active"
                                ? <PauseIcon />
                                : <PlayIcon />}
                            {isToggling
                              ? "Saving…"
                              : status === "active"
                                ? "Pause"
                                : status === "paused"
                                  ? "Activate"
                                  : "Draft → Active"}
                          </button>
                        )}

                        {status === "draft" && (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus({ ...exp, status: "paused" } as PlanExperimentRow)}
                            disabled={isPending || isEditing}
                            className="inline-flex items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 shadow-sm hover:bg-green-100 disabled:opacity-50"
                          >
                            <PlayIcon /> Activate
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setEditingId(isEditing ? null : exp.id)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 shadow-sm transition-colors hover:bg-neutral-50 disabled:opacity-50"
                        >
                          <EditIcon />
                          {isEditing ? "Cancel" : "Edit"}
                        </button>

                        {awaitConfirm ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-red-600">Sure?</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteConfirm(exp.id)}
                              disabled={isPending}
                              className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 shadow-sm hover:bg-red-100 disabled:opacity-50"
                            >
                              {isDeleting ? <SpinnerIcon /> : "Delete"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-500 shadow-sm hover:bg-neutral-50"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(exp.id)}
                            disabled={isPending}
                            className="inline-flex items-center gap-1 rounded-md border border-red-100 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 shadow-sm transition-colors hover:bg-red-100 disabled:opacity-50"
                          >
                            <TrashIcon /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {isEditing && (
                    <tr className="bg-neutral-50/70">
                      <td colSpan={6} className="px-4 py-4">
                        <InlineEditForm
                          exp={exp}
                          tenantId={tenantId}
                          variantCatalogue={variantCatalogue}
                          rules={rules}
                          onDone={() => {
                            setEditingId(null);
                            setSavedId(exp.id);
                            setTimeout(() => setSavedId((id) => (id === exp.id ? null : id)), 2500);
                            router.refresh();
                          }}
                          onCancel={() => setEditingId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-neutral-400">
        Draft experiments are not evaluated. Activate to start the test. Each experiment targets one rule —
        bucket 0 receives the rule&apos;s plan unchanged; bucket 1 receives the challenger plan.
      </p>
    </div>
  );
}

// ── Inline edit form ──────────────────────────────────────────────────────────

interface InlineEditFormProps {
  exp:               PlanExperimentRow;
  tenantId:          string;
  variantCatalogue?: VariantCatalogue;
  rules:             { id: string; label: string }[];
  onDone:            () => void;
  onCancel:          () => void;
}

function InlineEditForm({ exp, tenantId, variantCatalogue, rules, onDone, onCancel }: InlineEditFormProps) {
  const [name,       setName]       = useState(exp.name);
  const [ruleId,     setRuleId]     = useState(exp.rule_id);
  const [traffic,    setTraffic]    = useState(String(Math.round(exp.traffic_fraction * 100)));
  const [status,     setStatus]     = useState<Status>(exp.status as Status);
  const [challenger, setChallenger] = useState<ChallengerPlan>({ ...exp.challenger_plan });
  const [error,      setError]      = useState<string | null>(null);
  const [isPending,  startTransition] = useTransition();

  function updateSlot(slot: PlanSlot, value: string) {
    setChallenger((prev) => ({ ...prev, [slot]: value || undefined }));
  }

  function handleSave() {
    setError(null);
    const tf = parseFloat(traffic) / 100;
    if (isNaN(tf) || tf <= 0 || tf > 1) {
      setError("Traffic must be between 1 and 100.");
      return;
    }
    const hasSlot = PLAN_SLOTS.some((s) => !!challenger[s]);
    if (!hasSlot) {
      setError("Challenger plan must override at least one slot.");
      return;
    }

    startTransition(async () => {
      const result = await updatePlanExperimentAction(tenantId, exp.id, {
        name:             name.trim(),
        rule_id:          ruleId,
        status,
        traffic_fraction: tf,
        challenger_plan:  challenger,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onDone();
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Edit — <code className="font-mono normal-case">{exp.id}</code>
      </p>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-neutral-600">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium text-neutral-600">Rule</label>
          {rules.length > 0 ? (
            <select
              value={ruleId}
              onChange={(e) => setRuleId(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {rules.map((r) => (
                <option key={r.id} value={r.id}>{r.label} ({r.id})</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={ruleId}
              onChange={(e) => setRuleId(e.target.value)}
              placeholder="rule ID…"
              className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Traffic %</label>
          <input
            type="number"
            value={traffic}
            onChange={(e) => setTraffic(e.target.value)}
            min={1}
            max={100}
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="ended">Ended</option>
          </select>
        </div>
      </div>

      {/* Challenger plan */}
      <div>
        <p className="mb-2 text-xs font-medium text-neutral-600">
          Challenger plan <span className="font-normal text-neutral-400">(bucket 1 — override one or more slots)</span>
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PLAN_SLOTS.filter((s) => ["heroKey", "proofKey", "ctaKey"].includes(s)).map((slot) => {
            const catalogueSlot = slot.replace("Key", "") as "hero" | "proof" | "cta";
            const entries = variantCatalogue?.[catalogueSlot] as VariantEntry[] | undefined;

            return (
              <div key={slot}>
                <label className="mb-1 block text-xs font-medium text-neutral-500">
                  {SLOT_LABELS[slot]}
                </label>
                {entries && entries.length > 0 ? (
                  <select
                    value={challenger[slot] ?? ""}
                    onChange={(e) => updateSlot(slot, e.target.value)}
                    className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">(same as control)</option>
                    {entries.map((e) => (
                      <option key={e.key} value={e.key}>{e.key}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={challenger[slot] ?? ""}
                    onChange={(e) => updateSlot(slot, e.target.value)}
                    placeholder="variant key…"
                    className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
        >
          {isPending ? <SpinnerIcon /> : null}
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 shadow-sm hover:bg-neutral-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Challenger plan summary ───────────────────────────────────────────────────

function ChallengerPlanSummary({ plan }: { plan: ChallengerPlan }) {
  const overrides = PLAN_SLOTS
    .filter((s) => !!plan[s])
    .map((s) => ({ slot: SLOT_LABELS[s], key: plan[s]! }));

  if (overrides.length === 0) {
    return <span className="text-xs text-neutral-400 italic">no overrides</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      {overrides.map(({ slot, key }) => (
        <div key={slot} className="flex items-center gap-1.5">
          <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 uppercase tracking-wide">
            {slot}
          </span>
          <code className="font-mono text-xs text-neutral-700">{key}</code>
        </div>
      ))}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

const STATUS_CONFIG: Record<Status, { dot: string; text: string }> = {
  draft:  { dot: "bg-neutral-400",  text: "text-neutral-600"  },
  active: { dot: "bg-green-500",    text: "text-green-700"    },
  paused: { dot: "bg-amber-400",    text: "text-amber-700"    },
  ended:  { dot: "bg-neutral-300",  text: "text-neutral-500"  },
};

function StatusBadge({ status }: { status: Status }) {
  const { dot, text } = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${text}`}>
      <span className={`size-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch {
    return iso;
  }
}

function PauseIcon() {
  return (
    <svg className="size-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <rect x="2" y="1.5" width="3" height="9" rx="0.75" />
      <rect x="7" y="1.5" width="3" height="9" rx="0.75" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="size-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <path d="M3 2l7 4-7 4V2z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="size-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M8.5 1.5l2 2L4 10 1.5 10.5 2 8 8.5 1.5z" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="size-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M1.5 3.5h9M4 3.5V2h4v1.5M5 5.5v3M7 5.5v3M2.5 3.5l.5 7h6l.5-7" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="size-3 animate-spin" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M6 1.5A4.5 4.5 0 1 1 1.5 6" strokeLinecap="round" />
    </svg>
  );
}
