/**
 * RulesMatrix
 *
 * Read-only grid showing which variant key is assigned to each adaptive slot
 * for every rule in the tenant's rules config, plus the default plan row.
 *
 * Columns: Priority · Rule · Hero · Proof · CTA · Feature · Conversion · Notification · Pricing · CTA Mode
 * Rows:    Default plan (pinned top) + each rule sorted by priority ascending.
 *
 * Rendered entirely server-side — no client state required.
 */

import type { StoredRulesConfig, StoredPlan } from "@/decision/rules/stored-rule";
import { cn } from "@/lib/utils";
import { RefreshButton } from "./RefreshButton";

// ── Slot display config ────────────────────────────────────────────────────────

const SLOT_COLUMNS = [
  { key: "heroKey",          label: "Hero",         color: "bg-violet-100 text-violet-800 border-violet-200" },
  { key: "proofKey",         label: "Proof",        color: "bg-blue-100 text-blue-800 border-blue-200" },
  { key: "ctaKey",           label: "CTA",          color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { key: "featureKey",       label: "Feature",      color: "bg-orange-100 text-orange-800 border-orange-200" },
  { key: "conversionKey",    label: "Conversion",   color: "bg-teal-100 text-teal-800 border-teal-200" },
  { key: "notificationKey",  label: "Notification", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { key: "pricingEmphasis",  label: "Pricing",      color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { key: "pricingCtaMode",   label: "CTA Mode",     color: "bg-pink-100 text-pink-800 border-pink-200" },
] as const;

type SlotKey = typeof SLOT_COLUMNS[number]["key"];

// ── Variant key → short display label ─────────────────────────────────────────

const KEY_LABELS: Record<string, string> = {
  // Hero
  hero_default:                   "default",
  hero_google_problem:            "google / problem",
  hero_linkedin_vision:           "linkedin / vision",
  hero_direct_brand:              "direct / brand",
  hero_consideration:             "consideration",
  hero_intent_direct:             "intent / direct",
  hero_customer_onboarding:       "onboarding",
  hero_saas_default:              "saas / default",
  hero_saas_consideration:        "saas / consider.",
  hero_saas_intent:               "saas / intent",
  hero_saas_trial:                "saas / trial",
  hero_saas_customer_onboarding:  "saas / onboard.",
  hero_careers_default:           "careers / default",
  hero_careers_job_match:         "careers / job match",
  hero_careers_high_intent:       "careers / intent",
  hero_careers_reassurance:       "careers / reassure",
  // Proof
  proof_default:                  "default",
  proof_cases:                    "cases",
  proof_vision:                   "vision",
  proof_platform:                 "platform",
  proof_stats:                    "stats",
  proof_reassurance:              "reassurance",
  proof_saas_default:             "saas / default",
  proof_saas_consideration:       "saas / consider.",
  proof_saas_intent:              "saas / intent",
  proof_saas_reassurance:         "saas / reassure",
  proof_careers_default:          "careers / default",
  proof_careers_team:             "careers / team",
  proof_careers_reassurance:      "careers / reassure",
  // CTA
  cta_default:                    "default",
  cta_guide:                      "guide",
  cta_platform:                   "platform",
  cta_meeting:                    "meeting",
  cta_demo:                       "demo",
  cta_onboarding:                 "onboarding",
  cta_expansion:                  "expansion",
  cta_saas_default:               "saas / default",
  cta_saas_demo:                  "saas / demo",
  cta_saas_trial:                 "saas / trial",
  cta_saas_onboarding:            "saas / onboard.",
  cta_saas_expansion:             "saas / expansion",
  cta_careers_browse:             "careers / browse",
  cta_careers_apply:              "careers / apply",
  cta_careers_open:               "careers / open",
  cta_careers_contact:            "careers / contact",
  // Notification
  notification_default:           "default",
  notification_offer:             "offer",
  notification_urgency:           "urgency",
  notification_returning:         "returning",
  // Feature
  feature_grid_primary:           "grid (full)",
  feature_highlights:             "highlights",
  feature_comparison:             "comparison",
  // Conversion
  conversion_signup:              "signup",
  conversion_demo:                "demo form",
  conversion_contact:             "contact",
  // Pricing
  hidden:                         "hidden",
  teaser:                         "teaser",
  standard:                       "standard",
  emphasized:                     "emphasized",
  // CTA Mode
  trial:                          "trial",
  demo:                           "demo",
  onboarding:                     "onboarding",
  expansion:                      "expansion",
  none:                           "none",
};

function shortLabel(key: string | undefined): string {
  if (!key) return "";
  return KEY_LABELS[key] ?? key.replace(/^(hero|proof|cta|feature|conversion)_/, "");
}

// ── Slot cell ──────────────────────────────────────────────────────────────────

function SlotCell({ value, colorClass }: { value: string | undefined; colorClass: string }) {
  if (!value) {
    return (
      <td className="px-3 py-2 text-center">
        <span className="text-neutral-300 text-xs">—</span>
      </td>
    );
  }
  return (
    <td className="px-3 py-2 text-center">
      <span
        className={cn(
          "inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium leading-tight whitespace-nowrap",
          colorClass,
        )}
      >
        {shortLabel(value)}
      </span>
    </td>
  );
}

// ── Condition summary (one-liner) ──────────────────────────────────────────────

type AnyCondition = { type: string; [k: string]: unknown };

function summariseCondition(cond: AnyCondition | undefined | null): string {
  if (!cond) return "—";
  if (cond.type === "field") {
    const field    = String(cond.field ?? "");
    const op       = String(cond.operator ?? "=");
    const val      = cond.value != null ? String(cond.value) : "";
    const fieldShort = field.replace(/([A-Z])/g, " $1").toLowerCase();
    const opShort  = op === "equals" ? "=" : op === "not_equals" ? "≠" : op === "greater_than_or_equal" ? "≥" : op === "greater_than" ? ">" : op === "less_than_or_equal" ? "≤" : op === "less_than" ? "<" : op;
    return `${fieldShort} ${opShort} ${val}`.trim();
  }
  if (cond.type === "named") return String(cond.name ?? "");
  if (cond.type === "context") return String(cond.contextId ?? "").replace("ctx_", "");
  if (cond.type === "context_library") {
    const ids = Array.isArray(cond.contextIds) ? (cond.contextIds as string[]) : [];
    return ids.map((id) => String(id).replace(/^(intent|lifecycle|enrichment|behaviour)-/, "")).join(" | ");
  }
  if (cond.type === "group") {
    const logic = String(cond.logic ?? "and").toUpperCase();
    const children = Array.isArray(cond.conditions) ? (cond.conditions as AnyCondition[]) : [];
    const parts = children.map((c) => summariseCondition(c));
    return parts.length <= 2 ? parts.join(` ${logic} `) : `${parts[0]} ${logic} +${parts.length - 1} more`;
  }
  return String(cond.type ?? "?");
}

// ── Precedence badge ───────────────────────────────────────────────────────────

const PRECEDENCE_STYLES: Record<string, string> = {
  hard_state:          "bg-red-100 text-red-700 border-red-200",
  high_intent:         "bg-orange-100 text-orange-700 border-orange-200",
  medium_segmentation: "bg-blue-100 text-blue-700 border-blue-200",
  decorative:          "bg-neutral-100 text-neutral-500 border-neutral-200",
};

const PRECEDENCE_LABELS: Record<string, string> = {
  hard_state:          "hard",
  high_intent:         "high",
  medium_segmentation: "mid",
  decorative:          "deco",
};

// ── Main component ─────────────────────────────────────────────────────────────

interface RulesMatrixProps {
  config: StoredRulesConfig;
}

export function RulesMatrix({ config }: RulesMatrixProps) {
  const { rules, defaultPlan } = config;

  // Sort rules by priority ascending (should already be, but make it explicit).
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);

  function getPlanValue(plan: StoredPlan, slotKey: SlotKey): string | undefined {
    return (plan as Record<string, string | undefined>)[slotKey];
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Slot assignment matrix</h2>
          <p className="mt-0.5 text-xs text-neutral-400">
            Which variant key each rule assigns to each adaptive slot. Rows ordered by priority.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <RefreshButton />
          {/* Slot legend */}
          <div className="hidden xl:flex items-center gap-2 flex-wrap justify-end">
            {SLOT_COLUMNS.map((col) => (
              <span
                key={col.key}
                className={cn("inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium", col.color)}
              >
                {col.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="sticky left-0 z-10 bg-neutral-50 px-3 py-2.5 text-left font-semibold text-neutral-500 whitespace-nowrap w-8">P</th>
              <th className="px-3 py-2.5 text-left font-semibold text-neutral-500 whitespace-nowrap min-w-[180px]">Rule</th>
              <th className="px-3 py-2.5 text-left font-semibold text-neutral-500 whitespace-nowrap min-w-[160px]">Condition</th>
              {SLOT_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2.5 text-center font-semibold text-neutral-500 whitespace-nowrap min-w-[100px]"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* Default plan — pinned first, visually distinct */}
            <tr className="border-b border-neutral-100 bg-neutral-50/70 hover:bg-neutral-100/60 transition-colors">
              <td className="sticky left-0 z-10 bg-neutral-50/70 px-3 py-2 text-center">
                <span className="inline-block rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
                  —
                </span>
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
                    default
                  </span>
                  <span className="font-medium text-neutral-700 leading-tight">
                    {defaultPlan.reason ?? "Default plan"}
                  </span>
                </div>
              </td>
              <td className="px-3 py-2 text-neutral-400 italic text-[11px]">No match (fallback)</td>
              {SLOT_COLUMNS.map((col) => (
                <SlotCell
                  key={col.key}
                  value={getPlanValue(defaultPlan as StoredPlan, col.key)}
                  colorClass={col.color}
                />
              ))}
            </tr>

            {/* Rule rows */}
            {sorted.map((rule, idx) => {
              const isDisabled = rule.enabled === false;
              const precedence = rule.precedenceLevel ?? "";
              const precedenceStyle = PRECEDENCE_STYLES[precedence] ?? "bg-neutral-100 text-neutral-400 border-neutral-200";
              const precedenceLabel = PRECEDENCE_LABELS[precedence] ?? precedence;

              return (
                <tr
                  key={rule.id}
                  className={cn(
                    "border-b border-neutral-100 transition-colors",
                    isDisabled
                      ? "opacity-40 bg-neutral-50"
                      : idx % 2 === 0 ? "bg-white hover:bg-neutral-50/60" : "bg-neutral-50/40 hover:bg-neutral-50/80",
                  )}
                >
                  {/* Priority */}
                  <td className="sticky left-0 z-10 bg-inherit px-3 py-2 text-center whitespace-nowrap">
                    <span className="inline-block rounded border border-neutral-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-neutral-600">
                      {rule.priority}
                    </span>
                  </td>

                  {/* Rule label + badges */}
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {precedenceLabel && (
                          <span className={cn("inline-block rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide", precedenceStyle)}>
                            {precedenceLabel}
                          </span>
                        )}
                        {isDisabled && (
                          <span className="inline-block rounded border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-neutral-400">
                            off
                          </span>
                        )}
                      </div>
                      <span className={cn("font-medium leading-tight", isDisabled ? "text-neutral-400" : "text-neutral-800")}>
                        {rule.label}
                      </span>
                    </div>
                  </td>

                  {/* Condition summary */}
                  <td className="px-3 py-2">
                    <span className="text-neutral-500 text-[11px] leading-snug">
                      {summariseCondition(rule.condition as AnyCondition)}
                    </span>
                  </td>

                  {/* Slot cells */}
                  {SLOT_COLUMNS.map((col) => (
                    <SlotCell
                      key={col.key}
                      value={getPlanValue(rule.plan, col.key)}
                      colorClass={col.color}
                    />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>

        {rules.length === 0 && (
          <div className="py-10 text-center text-sm text-neutral-400">
            No rules defined yet. Add rules above or seed preset rules.
          </div>
        )}
      </div>

      {/* Slot key */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <span className="text-[11px] text-neutral-400">
          <strong className="text-neutral-500">P</strong> = evaluation priority (lower fires first)
        </span>
        <span className="text-[11px] text-neutral-400">
          <strong className="text-neutral-500">hard/high/mid/deco</strong> = precedence tier
        </span>
        <span className="text-[11px] text-neutral-400">
          <strong className="text-neutral-500">—</strong> = slot not set by this rule (falls back to page default or no notification)
        </span>
      </div>
    </section>
  );
}
