"use client";

/**
 * CreatePlanExperimentForm
 *
 * Form for creating a new plan-based A/B experiment.
 *
 * ─── Fields ───────────────────────────────────────────────────────────────────
 *
 *   id               Stable slug (unique, immutable). Auto-suggested from name.
 *   name             Human-readable label.
 *   rule_id          Which rule's audience to target.  Selecting a rule also
 *                    shows the rule's control plan so the user knows what they're
 *                    testing against.
 *   challenger_plan  Slot overrides for bucket 1. Each slot shows a variant
 *                    selector populated from the variant catalogue.
 *   traffic_fraction Percentage of matching sessions enrolled (1–100%).
 *   status           draft (default) or active.
 *
 * ─── Bucket semantics ─────────────────────────────────────────────────────────
 *
 *   Bucket 0 = control  — the rule's plan, unchanged.
 *   Bucket 1 = challenger — the rule's plan with challenger_plan merged in.
 *
 * The form defaults to "draft" so experiments don't accidentally start
 * before they've been reviewed.
 */

import { useState, useTransition, useEffect } from "react";
import { useRouter }                          from "next/navigation";
import { createPlanExperimentAction }         from "../actions";
import type { VariantCatalogue, VariantEntry } from "@/decision/rules/variant-catalogue";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Rule {
  id:       string;
  label:    string;
  plan?: {
    heroKey?:       string;
    proofKey?:      string;
    ctaKey?:        string;
    featureKey?:    string;
    conversionKey?: string;
  };
}

type ChallengerPlan = {
  heroKey?:       string;
  proofKey?:      string;
  ctaKey?:        string;
  featureKey?:    string;
  conversionKey?: string;
};

const PLAN_SLOTS = [
  { key: "heroKey"  as const, slot: "hero"  as const, label: "Hero" },
  { key: "proofKey" as const, slot: "proof" as const, label: "Proof" },
  { key: "ctaKey"   as const, slot: "cta"   as const, label: "CTA" },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  tenantId:          string;
  rules:             Rule[];
  variantCatalogue?: VariantCatalogue;
}

// ── Slug helper ───────────────────────────────────────────────────────────────

function toSlug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CreatePlanExperimentForm({ tenantId, rules, variantCatalogue }: Props) {
  const router = useRouter();

  const [open,       setOpen]       = useState(false);
  const [name,       setName]       = useState("");
  const [id,         setId]         = useState("");
  const [idTouched,  setIdTouched]  = useState(false);
  const [ruleId,     setRuleId]     = useState(rules[0]?.id ?? "");
  const [challenger, setChallenger] = useState<ChallengerPlan>({});
  const [traffic,    setTraffic]    = useState("100");
  const [status,     setStatus]     = useState<"draft" | "active">("draft");
  const [error,      setError]      = useState<string | null>(null);
  const [success,    setSuccess]    = useState(false);
  const [isPending,  startTransition] = useTransition();

  // Auto-generate slug from name unless the user has edited it manually.
  useEffect(() => {
    if (!idTouched) {
      setId(toSlug(name));
    }
  }, [name, idTouched]);

  const selectedRule = rules.find((r) => r.id === ruleId);

  function updateSlot(slotKey: keyof ChallengerPlan, value: string) {
    setChallenger((prev) => ({ ...prev, [slotKey]: value || undefined }));
  }

  function reset() {
    setName("");
    setId("");
    setIdTouched(false);
    setRuleId(rules[0]?.id ?? "");
    setChallenger({});
    setTraffic("100");
    setStatus("draft");
    setError(null);
  }

  function handleSubmit() {
    setError(null);
    setSuccess(false);

    if (!id.trim())     { setError("ID is required."); return; }
    if (!name.trim())   { setError("Name is required."); return; }
    if (!ruleId.trim()) { setError("Please select a rule."); return; }

    const tf = parseFloat(traffic) / 100;
    if (isNaN(tf) || tf <= 0 || tf > 1) {
      setError("Traffic must be between 1 and 100.");
      return;
    }

    const hasOverride = PLAN_SLOTS.some((s) => !!challenger[s.key]);
    if (!hasOverride) {
      setError("Challenger plan must override at least one slot.");
      return;
    }

    startTransition(async () => {
      const result = await createPlanExperimentAction(tenantId, {
        id:               id.trim(),
        name:             name.trim(),
        rule_id:          ruleId,
        challenger_plan:  challenger,
        traffic_fraction: tf,
        status,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccess(true);
      reset();
      setTimeout(() => setSuccess(false), 3000);
      router.refresh();
    });
  }

  return (
    <div className={`rounded-xl border bg-white shadow-sm transition-colors ${open ? "border-brand-300" : "border-neutral-200"}`}>
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-neutral-50 rounded-xl transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`inline-flex size-7 shrink-0 items-center justify-center rounded-lg border text-sm font-bold transition-colors ${
            open
              ? "border-brand-300 bg-brand-50 text-brand-600"
              : "border-neutral-300 bg-neutral-100 text-neutral-500"
          }`}>
            {open ? "−" : "+"}
          </span>
          <div>
            <p className="text-sm font-semibold text-neutral-800">New plan experiment</p>
            <p className="text-xs text-neutral-500">
              Test a challenger plan against a rule&apos;s control plan for a specific audience.
            </p>
          </div>
        </div>
        <ChevronIcon open={open} />
      </button>

      {success && (
        <div className="mx-5 mb-3 rounded-md border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-800">
          ✓ Plan experiment created successfully.
        </div>
      )}

      {open && (
        <div className="space-y-5 border-t border-neutral-100 px-5 py-5">

          {error && (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          {/* Name + ID */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Hero: Problem vs Brand (Google)"
                maxLength={100}
                className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">
                ID <span className="text-red-400">*</span>{" "}
                <span className="font-normal text-neutral-400">(slug, immutable)</span>
              </label>
              <input
                type="text"
                value={id}
                onChange={(e) => { setId(e.target.value); setIdTouched(true); }}
                placeholder="hero_problem_vs_brand_google_q2"
                pattern="[a-z0-9_-]+"
                maxLength={80}
                className="w-full rounded-md border border-neutral-300 px-3 py-1.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Rule selector */}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Target rule <span className="text-red-400">*</span>
            </label>
            {rules.length === 0 ? (
              <p className="text-xs text-amber-600">
                No rules found. Create rules in the Rules editor first.
              </p>
            ) : (
              <select
                value={ruleId}
                onChange={(e) => { setRuleId(e.target.value); setChallenger({}); }}
                className="w-full max-w-sm rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {rules.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label} ({r.id})
                  </option>
                ))}
              </select>
            )}
            {selectedRule && (
              <p className="mt-1.5 text-xs text-neutral-500">
                Bucket 0 (control) will receive this rule&apos;s plan unchanged.
                Configure bucket 1 (challenger) below.
              </p>
            )}
          </div>

          {/* Control plan preview */}
          {selectedRule?.plan && (
            <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Control plan (rule: {selectedRule.label})
              </p>
              <div className="flex flex-wrap gap-3">
                {PLAN_SLOTS.map(({ key, label }) =>
                  selectedRule.plan?.[key] ? (
                    <div key={key} className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-neutral-500">{label}:</span>
                      <code className="rounded bg-neutral-200 px-1.5 py-0.5 font-mono text-xs text-neutral-700">
                        {selectedRule.plan[key]}
                      </code>
                    </div>
                  ) : null,
                )}
              </div>
            </div>
          )}

          {/* Challenger plan */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Challenger plan (bucket 1)
            </p>
            <p className="mb-3 text-xs text-neutral-500">
              Override one or more slots. Slots not overridden inherit from the control plan.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {PLAN_SLOTS.map(({ key, slot, label }) => {
                const entries = variantCatalogue?.[slot] as VariantEntry[] | undefined;
                const controlVal = selectedRule?.plan?.[key];

                return (
                  <div key={key}>
                    <label className="mb-1 block text-xs font-medium text-neutral-600">
                      {label}
                      {controlVal && (
                        <span className="ml-1 font-normal text-neutral-400">
                          (control: <code className="font-mono">{controlVal}</code>)
                        </span>
                      )}
                    </label>
                    {entries && entries.length > 0 ? (
                      <select
                        value={challenger[key] ?? ""}
                        onChange={(e) => updateSlot(key, e.target.value)}
                        className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">(same as control)</option>
                        {entries
                          .filter((e) => e.key !== controlVal)
                          .map((e) => (
                            <option key={e.key} value={e.key}>{e.key}</option>
                          ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={challenger[key] ?? ""}
                        onChange={(e) => updateSlot(key, e.target.value)}
                        placeholder="variant key…"
                        className="w-full rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Traffic + Status */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">
                Traffic <span className="font-normal text-neutral-400">(%)</span>
              </label>
              <input
                type="number"
                value={traffic}
                onChange={(e) => setTraffic(e.target.value)}
                min={1}
                max={100}
                className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="mt-0.5 text-[10px] text-neutral-400">
                Of sessions where the rule matches.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "draft" | "active")}
                className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="draft">Draft (not live yet)</option>
                <option value="active">Active (start immediately)</option>
              </select>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || rules.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? <SpinnerIcon /> : null}
              {isPending ? "Creating…" : "Create experiment"}
            </button>
            <button
              type="button"
              onClick={() => { reset(); setOpen(false); }}
              disabled={isPending}
              className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-600 shadow-sm hover:bg-neutral-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`size-4 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M6 1.5A4.5 4.5 0 1 1 1.5 6" strokeLinecap="round" />
    </svg>
  );
}
