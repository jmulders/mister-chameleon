"use client";

/**
 * components/admin/PlansEditor.tsx
 *
 * Client component — full CRUD for the billing_plans table.
 *
 * ─── Features ─────────────────────────────────────────────────────────────────
 *
 *   • Plans table — sort_order, label, plan_id badge, status, prices, credits
 *   • Reorder — ↑/↓ arrows swap sort_order with the neighbouring plan
 *   • Activate / Deactivate — single-click toggle
 *   • Edit — inline accordion panel with all fields:
 *       label, prices, credits, overage rate, feature flags, limits, stripe IDs
 *   • Add plan — same accordion panel for new rows (plan_id editable)
 *   • Delete — only for custom (non-built-in) plans; built-in plans show
 *       "Deactivate" instead
 *   • Seed button — appears when the DB has no rows; seeds starter/growth/pro
 *
 * ─── Validation ────────────────────────────────────────────────────────────────
 *
 *   Performed client-side before calling the server action:
 *   • label required
 *   • plan_id: lowercase alphanumeric + underscore; unique within the current list
 *   • no negative prices / credits / limits
 *
 * ─── Stripe note ──────────────────────────────────────────────────────────────
 *
 *   Stripe Price IDs stored here are informational — they are NOT pushed to
 *   Stripe automatically.  Production price changes require matching Stripe
 *   dashboard updates and STRIPE_PRICE_* env var refreshes.
 */

import { Fragment, useState, useTransition } from "react";
import {
  upsertPlan,
  togglePlanActive,
  reorderPlan,
  deletePlan,
  seedDefaultPlans,
} from "@/app/admin/platform/billing/plans/actions";
import type {
  PlanUpsertPayload,
  PlanFeatures,
  PlanLimits,
} from "@/app/admin/platform/billing/plans/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DbPlan {
  plan_id:                  string;
  label:                    string;
  active:                   boolean;
  sort_order:               number;
  /** EUR (e.g. 149.000000). */
  monthly_price:            number;
  /** EUR annual total (e.g. 1488.000000). */
  yearly_price:             number;
  /** EUR effective monthly when billed annually (e.g. 124.000000). */
  annual_monthly_price:     number;
  /** Fractional credits (e.g. 500.000). */
  included_credits:         number;
  /** EUR per credit over quota (e.g. 0.030000). */
  overage_price_per_credit: number;
  features:                 PlanFeatures;
  limits:                   PlanLimits;
  stripe_monthly_price_id:       string | null;
  stripe_yearly_price_id:        string | null;
  stripe_test_monthly_price_id:  string | null;
  stripe_test_yearly_price_id:   string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BUILTIN_IDS = new Set(["starter", "growth", "pro"]);

const FEATURE_KEYS: Array<keyof PlanFeatures> = [
  "aiPersonalization",
  "crmAbmEnrichment",
  "customDecayProfiles",
  "analyticsDashboard",
  "multiTenant",
  "prioritySupport",
];

const FEATURE_LABELS: Record<keyof PlanFeatures, string> = {
  aiPersonalization:   "AI Personalisation Engine",
  crmAbmEnrichment:    "CRM & ABM Enrichment",
  customDecayProfiles: "Custom Decay Profiles",
  analyticsDashboard:  "Analytics Dashboard",
  multiTenant:         "Multi-tenant (Agency)",
  prioritySupport:     "Priority Support",
};

const DEFAULT_FEATURES: PlanFeatures = {
  aiPersonalization:   false,
  crmAbmEnrichment:    false,
  customDecayProfiles: false,
  analyticsDashboard:  false,
  multiTenant:         false,
  prioritySupport:     false,
};

const DEFAULT_LIMITS: PlanLimits = {
  personalizedSessionsPerMonth: 25_000,
};

// ── Formatting helpers ─────────────────────────────────────────────────────────

/** Format a EUR amount (already in euros, not cents). */
function fmtEur(eur: number): string {
  return Number(eur).toLocaleString("nl-NL", {
    style:    "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

// ── SeedBanner ────────────────────────────────────────────────────────────────

function SeedBanner({ hasRows }: { hasRows: boolean }) {
  const [status,     setStatus]     = useState<"idle" | "seeding" | "done" | "error">("idle");
  const [isPending,  startTransition] = useTransition();

  if (hasRows) return null;

  return (
    <div className="mb-5 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <span className="text-sm text-amber-700">
        No plans found in the database. Seed the built-in plans (Starter / Growth / Pro) to start.
      </span>
      <button
        onClick={() => {
          setStatus("seeding");
          startTransition(async () => {
            const r = await seedDefaultPlans();
            setStatus(r.ok ? "done" : "error");
          });
        }}
        disabled={isPending || status === "seeding"}
        className="shrink-0 rounded bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {status === "seeding" ? "Seeding…" : status === "done" ? "✓ Seeded" : "Seed defaults"}
      </button>
      {status === "error" && (
        <span className="text-xs text-red-600">Seed failed — check server logs.</span>
      )}
    </div>
  );
}

// ── PlanForm ─────────────────────────────────────────────────────────────────
//
// Shared form for both create (plan_id editable) and edit (plan_id locked).

interface PlanFormProps {
  initial:       Partial<DbPlan> & { plan_id: string };
  existingIds:   Set<string>;
  isNew:         boolean;
  onCancel:      () => void;
  onSaved:       () => void;
}

function PlanForm({ initial, existingIds, isNew, onCancel, onSaved }: PlanFormProps) {
  const [planId,     setPlanId]     = useState(initial.plan_id ?? "");
  const [label,      setLabel]      = useState(initial.label ?? "");
  const [monthly,    setMonthly]    = useState(String(initial.monthly_price ?? 0));
  const [yearly,     setYearly]     = useState(String(initial.yearly_price ?? 0));
  const [annualMo,   setAnnualMo]   = useState(String(initial.annual_monthly_price ?? 0));
  const [features,     setFeatures]     = useState<PlanFeatures>({ ...DEFAULT_FEATURES, ...initial.features });
  const [sessionCap,   setSessionCap]   = useState(String(initial.limits?.personalizedSessionsPerMonth ?? 25_000));
  const [stripeM,      setStripeM]      = useState(initial.stripe_monthly_price_id      ?? "");
  const [stripeY,      setStripeY]      = useState(initial.stripe_yearly_price_id       ?? "");
  const [stripeTestM,  setStripeTestM]  = useState(initial.stripe_test_monthly_price_id ?? "");
  const [stripeTestY,  setStripeTestY]  = useState(initial.stripe_test_yearly_price_id  ?? "");

  const [validErr, setValidErr]    = useState("");
  const [saveErr,  setSaveErr]     = useState("");
  const [isPending, startTransition] = useTransition();

  function validate(): PlanUpsertPayload | null {
    setValidErr("");
    if (!label.trim()) { setValidErr("Label is required."); return null; }
    if (isNew && !/^[a-z0-9_]+$/.test(planId)) {
      setValidErr("Plan ID must be lowercase letters, numbers, or underscores only."); return null;
    }
    if (isNew && existingIds.has(planId)) {
      setValidErr(`Plan ID "${planId}" already exists.`); return null;
    }
    const nums: [string, string][] = [
      ["Monthly price",         monthly],
      ["Annual price",          yearly],
      ["Annual monthly price",  annualMo],
      ["Personalized sessions", sessionCap],
    ];
    for (const [name, val] of nums) {
      if (isNaN(Number(val)) || Number(val) < 0) {
        setValidErr(`${name} must be a non-negative number.`); return null;
      }
    }
    return {
      plan_id:                  planId,
      label:                    label.trim(),
      active:                   initial.active ?? true,
      sort_order:               initial.sort_order ?? 99,
      monthly_price:            Number(monthly),
      yearly_price:             Number(yearly),
      annual_monthly_price:     Number(annualMo),
      included_credits:         0,
      overage_price_per_credit: 0,
      features,
      limits: {
        personalizedSessionsPerMonth: Math.round(Number(sessionCap)),
      },
      stripe_monthly_price_id:      stripeM     || null,
      stripe_yearly_price_id:       stripeY     || null,
      stripe_test_monthly_price_id: stripeTestM || null,
      stripe_test_yearly_price_id:  stripeTestY || null,
    };
  }

  function handleSave() {
    const payload = validate();
    if (!payload) return;
    setSaveErr("");
    startTransition(async () => {
      const r = await upsertPlan(payload);
      if (r.ok) {
        onSaved();
      } else {
        setSaveErr(r.error ?? "Save failed.");
      }
    });
  }

  // ── Field section helper ─────────────────────────────────────────────────
  const inputCls = "w-full rounded border border-neutral-200 bg-white px-3 py-2 text-sm font-mono focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100";
  const labelCls = "block mb-1 text-xs font-medium text-neutral-500 uppercase tracking-wide";

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-5 space-y-5">

      {/* ── Identity ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Plan ID</label>
          <input
            value={planId}
            onChange={(e) => setPlanId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            disabled={!isNew}
            placeholder="e.g. enterprise"
            className={`${inputCls} ${!isNew ? "bg-neutral-100 text-neutral-500 cursor-not-allowed" : ""}`}
          />
          {isNew && <p className="mt-0.5 text-[10px] text-neutral-400">Lowercase letters, numbers, underscores. Cannot be changed after creation.</p>}
        </div>
        <div>
          <label className={labelCls}>Label</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Enterprise"
            className={inputCls}
          />
        </div>
      </div>

      {/* ── Prices (EUR) ─────────────────────────────────────────────────────── */}
      <div>
        <p className="mb-3 text-xs font-semibold text-neutral-700 uppercase tracking-wide">Prices (EUR)</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Monthly</label>
            <input type="number" min={0} value={monthly} onChange={(e) => setMonthly(e.target.value)} className={inputCls} />
            {monthly && <p className="mt-0.5 text-[10px] text-neutral-400">= {fmtEur(Number(monthly))}/mo</p>}
          </div>
          <div>
            <label className={labelCls}>Annual total</label>
            <input type="number" min={0} value={yearly} onChange={(e) => setYearly(e.target.value)} className={inputCls} />
            {yearly && <p className="mt-0.5 text-[10px] text-neutral-400">= {fmtEur(Number(yearly))}/yr</p>}
          </div>
          <div>
            <label className={labelCls}>Annual (effective/mo)</label>
            <input type="number" min={0} value={annualMo} onChange={(e) => setAnnualMo(e.target.value)} className={inputCls} />
            {annualMo && <p className="mt-0.5 text-[10px] text-neutral-400">= {fmtEur(Number(annualMo))}/mo</p>}
          </div>
        </div>
      </div>

      {/* ── Feature flags ─────────────────────────────────────────────────────── */}
      <div>
        <p className="mb-3 text-xs font-semibold text-neutral-700 uppercase tracking-wide">Feature flags</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {FEATURE_KEYS.map((key) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={features[key]}
                onChange={(e) => setFeatures((prev) => ({ ...prev, [key]: e.target.checked }))}
                className="h-4 w-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
              />
              {FEATURE_LABELS[key]}
            </label>
          ))}
        </div>
      </div>

      {/* ── Session cap ───────────────────────────────────────────────────────── */}
      <div>
        <p className="mb-3 text-xs font-semibold text-neutral-700 uppercase tracking-wide">Session cap</p>
        <p className="mb-3 text-[11px] text-neutral-500">
          Max unique visitor sessions that receive personalised content per calendar month.
          Once reached, visitors get the default (unmodified) experience — no hard errors.
          Set to <code className="bg-neutral-100 px-0.5 rounded font-mono">0</code> for unlimited.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Personalized sessions / month</label>
            <input
              type="number"
              min={0}
              step={1000}
              value={sessionCap}
              onChange={(e) => setSessionCap(e.target.value)}
              className={inputCls}
            />
            {sessionCap && Number(sessionCap) > 0 && (
              <p className="mt-0.5 text-[10px] text-neutral-400">
                = {Number(sessionCap).toLocaleString("nl-NL")} sessions/mo
              </p>
            )}
            {sessionCap === "0" && (
              <p className="mt-0.5 text-[10px] text-amber-600">Unlimited — use for enterprise overrides only</p>
            )}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-neutral-400">
          Rules, experiments, segments, interest profiles and scoring rules are all <strong>unlimited</strong> on every plan.
        </p>
      </div>

      {/* ── Stripe Price IDs ──────────────────────────────────────────────────── */}
      <div>
        <p className="mb-1 text-xs font-semibold text-neutral-700 uppercase tracking-wide">Stripe Price IDs</p>
        <p className="mb-3 text-[11px] text-neutral-500">
          Enter price IDs from your Stripe dashboard. The platform automatically uses
          the <strong>Test</strong> IDs when running with sandbox/test keys, and
          the <strong>Live</strong> IDs when running with live keys.
        </p>

        <p className="mb-2 text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">Live (production)</p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelCls}>Monthly Price ID</label>
            <input
              value={stripeM}
              onChange={(e) => setStripeM(e.target.value)}
              placeholder="price_…"
              className={`${inputCls} font-mono text-xs`}
            />
          </div>
          <div>
            <label className={labelCls}>Annual Price ID</label>
            <input
              value={stripeY}
              onChange={(e) => setStripeY(e.target.value)}
              placeholder="price_…"
              className={`${inputCls} font-mono text-xs`}
            />
          </div>
        </div>

        <p className="mb-2 text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">Test (sandbox)</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Monthly Test Price ID</label>
            <input
              value={stripeTestM}
              onChange={(e) => setStripeTestM(e.target.value)}
              placeholder="price_…"
              className={`${inputCls} font-mono text-xs`}
            />
          </div>
          <div>
            <label className={labelCls}>Annual Test Price ID</label>
            <input
              value={stripeTestY}
              onChange={(e) => setStripeTestY(e.target.value)}
              placeholder="price_…"
              className={`${inputCls} font-mono text-xs`}
            />
          </div>
        </div>
      </div>

      {/* ── Validation / save errors ──────────────────────────────────────────── */}
      {(validErr || saveErr) && (
        <p className="rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
          {validErr || saveErr}
        </p>
      )}

      {/* ── Actions ───────────────────────────────────────────────────────────── */}
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
          className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving…" : isNew ? "Create plan" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ── PlansEditor ───────────────────────────────────────────────────────────────

export interface PlansEditorProps {
  plans: DbPlan[];
}

export function PlansEditor({ plans }: PlansEditorProps) {
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [showNew,    setShowNew]    = useState(false);
  const [isPending,  startTransition] = useTransition();
  const [rowError,   setRowError]   = useState<Record<string, string>>({});

  const sorted       = [...plans].sort((a, b) => a.sort_order - b.sort_order);
  const existingIds  = new Set(plans.map((p) => p.plan_id));

  function clearError(id: string) {
    setRowError((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }

  function handleToggle(planId: string, current: boolean) {
    clearError(planId);
    startTransition(async () => {
      const r = await togglePlanActive(planId, !current);
      if (!r.ok) setRowError((prev) => ({ ...prev, [planId]: r.error ?? "Failed." }));
    });
  }

  function handleReorder(planId: string, dir: "up" | "down") {
    clearError(planId);
    startTransition(async () => {
      const r = await reorderPlan(planId, dir);
      if (!r.ok) setRowError((prev) => ({ ...prev, [planId]: r.error ?? "Failed." }));
    });
  }

  function handleDelete(planId: string) {
    if (!window.confirm(`Delete plan "${planId}"? This cannot be undone.`)) return;
    clearError(planId);
    startTransition(async () => {
      const r = await deletePlan(planId);
      if (!r.ok) setRowError((prev) => ({ ...prev, [planId]: r.error ?? "Failed." }));
    });
  }

  return (
    <div>
      <SeedBanner hasRows={plans.length > 0} />

      {/* ── Summary bar ────────────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          {sorted.filter((p) => p.active).length} active
          {" / "}
          {sorted.length} total plan{sorted.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={() => { setShowNew(true); setEditingId(null); }}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          + Add plan
        </button>
      </div>

      {/* ── Plans table ────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-xs font-medium uppercase tracking-wide text-neutral-400">
              <th className="w-16 px-3 py-3 text-center">Order</th>
              <th className="px-4 py-3 text-left">Plan</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Monthly</th>
              <th className="px-4 py-3 text-right">Annual /mo</th>
              <th className="px-4 py-3 text-right">Sessions/mo</th>
              <th className="px-4 py-3 text-right"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((plan, idx) => {
              const isFirst    = idx === 0;
              const isLast     = idx === sorted.length - 1;
              const isBuiltin  = BUILTIN_IDS.has(plan.plan_id);
              const isEditing  = editingId === plan.plan_id;

              return (
                <Fragment key={plan.plan_id}>
                  <tr
                    className={`border-b border-neutral-50 hover:bg-neutral-50/50 transition-colors ${!plan.active ? "opacity-60" : ""}`}
                  >
                    {/* Order arrows */}
                    <td className="px-3 py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          onClick={() => handleReorder(plan.plan_id, "up")}
                          disabled={isFirst || isPending}
                          className="rounded p-0.5 text-neutral-400 hover:text-neutral-600 disabled:opacity-30"
                          title="Move up"
                        >
                          ▲
                        </button>
                        <span className="text-[10px] font-mono text-neutral-400">{plan.sort_order}</span>
                        <button
                          onClick={() => handleReorder(plan.plan_id, "down")}
                          disabled={isLast || isPending}
                          className="rounded p-0.5 text-neutral-400 hover:text-neutral-600 disabled:opacity-30"
                          title="Move down"
                        >
                          ▼
                        </button>
                      </div>
                    </td>

                    {/* Plan identity */}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-neutral-800">{plan.label}</p>
                      <code className="text-[10px] text-neutral-400 bg-neutral-100 rounded px-1">{plan.plan_id}</code>
                      {isBuiltin && (
                        <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wide text-neutral-400">built-in</span>
                      )}
                    </td>

                    {/* Status badge */}
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        plan.active ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
                      }`}>
                        {plan.active ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* Monthly price */}
                    <td className="px-4 py-3 text-right font-mono text-neutral-700">
                      {fmtEur(plan.monthly_price)}
                    </td>

                    {/* Annual monthly price */}
                    <td className="px-4 py-3 text-right font-mono text-neutral-700">
                      {fmtEur(plan.annual_monthly_price)}
                      <span className="text-neutral-400 font-normal">/mo</span>
                    </td>

                    {/* Session cap */}
                    <td className="px-4 py-3 text-right font-mono text-neutral-700">
                      {plan.limits.personalizedSessionsPerMonth === 0
                        ? <span className="text-neutral-400">∞</span>
                        : (plan.limits.personalizedSessionsPerMonth / 1000).toLocaleString("nl-NL") + "K"
                      }
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {rowError[plan.plan_id] && (
                        <p className="mb-1 text-[10px] text-red-500">{rowError[plan.plan_id]}</p>
                      )}
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingId(isEditing ? null : plan.plan_id);
                            setShowNew(false);
                          }}
                          className="rounded border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
                        >
                          {isEditing ? "Close" : "Edit"}
                        </button>
                        <button
                          onClick={() => handleToggle(plan.plan_id, plan.active)}
                          disabled={isPending}
                          className="rounded border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 transition-colors disabled:opacity-50"
                        >
                          {plan.active ? "Deactivate" : "Activate"}
                        </button>
                        {!isBuiltin && (
                          <button
                            onClick={() => handleDelete(plan.plan_id)}
                            disabled={isPending}
                            className="rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-500 hover:border-red-300 hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Inline edit panel */}
                  {isEditing && (
                    <tr key={`${plan.plan_id}-edit`} className="border-b border-neutral-100">
                      <td colSpan={7} className="px-4 py-4 bg-neutral-50/70">
                        <PlanForm
                          initial={plan}
                          existingIds={existingIds}
                          isNew={false}
                          onCancel={() => setEditingId(null)}
                          onSaved={() => setEditingId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}

            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-neutral-400">
                  No plans found. Use "Seed defaults" above or "Add plan" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── New plan form ────────────────────────────────────────────────────── */}
      {showNew && (
        <div className="mt-5">
          <p className="mb-3 text-sm font-semibold text-neutral-700">New plan</p>
          <PlanForm
            initial={{ plan_id: "", sort_order: (sorted.at(-1)?.sort_order ?? 0) + 1 }}
            existingIds={existingIds}
            isNew={true}
            onCancel={() => setShowNew(false)}
            onSaved={() => setShowNew(false)}
          />
        </div>
      )}

      {/* ── Footer note ──────────────────────────────────────────────────────── */}
      <p className="mt-4 text-xs text-neutral-400">
        Changing prices here does <em>not</em> automatically update Stripe. Production plan price
        changes require matching Stripe Price IDs in the Stripe dashboard and updated{" "}
        <code className="rounded bg-neutral-100 px-1 py-px text-[10px]">STRIPE_PRICE_*</code> env
        vars. The static <code className="rounded bg-neutral-100 px-1 py-px text-[10px]">billing/plans.ts</code>{" "}
        constants remain the runtime fallback when this table is unavailable.
      </p>
    </div>
  );
}
