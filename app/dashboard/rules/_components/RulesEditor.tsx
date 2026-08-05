"use client";

/**
 * RulesEditor
 *
 * Internal UI for inspecting and editing homepage decision rules.
 * Supports creating, editing, reordering, and deleting rules.
 *
 * ─── Field metadata ─────────────────────────────────────────────────────────────
 *
 *   All field labels, valid operators, and allowed values come from
 *   FIELD_REGISTRY (decision/rules/field-registry.ts) — the single source of
 *   truth shared with the validator and the runtime evaluator.
 *
 * ─── Multi-condition model ─────────────────────────────────────────────────────
 *
 *   Internally the editor works with an EditorGroup — a flat list of leaf
 *   conditions (field or named) plus an AND / OR logic selector.
 *
 *   On save the group is serialised back to the most compact RuleCondition:
 *     • 1 leaf  → the leaf itself (preserves backwards-compatibility with
 *                 existing single-condition rules stored before R4)
 *     • 2+ leaves → GroupCondition { type: "group", logic, conditions }
 *
 *   On load any existing RuleCondition is converted to EditorGroup:
 *     • field / named → single-leaf group with logic = "and"
 *     • group         → uses stored logic; only direct field/named children
 *                       are editable (nested sub-groups are silently dropped;
 *                       the flat editor cannot express them)
 *
 * ─── Safety ────────────────────────────────────────────────────────────────────
 *
 *   All variant key selects are bound to the explicit ALLOWED_* constants.
 *   Condition fields, operators, and values are constrained to what the field
 *   registry permits for the selected field.
 *
 *   The final save is validated server-side in saveRulesAction() regardless
 *   of client-side state; the server is the authoritative validator.
 *
 * ─── Persistence ───────────────────────────────────────────────────────────────
 *
 *   Changes are held in local React state until the user clicks "Save changes".
 *   Saving calls saveRulesAction() which writes to decision/rules/runtime-rules.json.
 */

import { useState, useCallback, useId, useRef, useEffect } from "react";
import {
  saveRulesAction,
  resetRulesAction,
} from "../actions";
import type {
  StoredRulesConfig,
  StoredRule,
  StoredDefaultPlan,
  RuleCondition,
  FieldCondition,
  NamedCondition,
  ContextCondition,
  FlagCondition,
  RuleContextWrite,
  ConditionField,
  NamedConditionId,
  FieldConditionValue,
} from "@/decision/rules/stored-rule";
import {
  NAMED_CONDITIONS,
  ALLOWED_HERO_KEYS,
  ALLOWED_PROOF_KEYS,
  ALLOWED_CTA_KEYS,
  formatCondition,
} from "@/decision/rules/stored-rule";
import type { VariantCatalogue, VariantEntry, VariantSource } from "@/decision/rules/variant-catalogue";
import { SOURCE_LABELS, buildPlatformCatalogue } from "@/decision/rules/variant-catalogue";
import { PRESET_PLANS }                           from "@/decision/rules/preset-plans";
import {
  FIELD_REGISTRY,
  FIELD_KEYS_BY_GROUP,
  ALL_FIELD_KEYS,
  FIELD_OPERATORS,
  NO_VALUE_OPERATORS,
  ARRAY_VALUE_OPERATORS,
  NUMERIC_OPERATORS,
  STRING_ONLY_OPERATORS,
} from "@/decision/rules/field-registry";
import type {
  RuleFieldKey,
  FieldOperator,
  FieldGroup,
} from "@/decision/rules/field-registry";
import type {
  HeroVariantKey,
  ProofVariantKey,
  CTAVariantKey,
  FeatureVariantKey,
  ConversionVariantKey,
} from "@/decision/types";
import {
  CONTEXT_REGISTRY,
  ALL_CONTEXT_IDS,
} from "@/decision/rules/context-library";
import type { ContextId } from "@/decision/rules/context-library";
import {
  RULE_PACK_REGISTRY,
  PRECEDENCE_TIERS,
  inferPrecedenceLevel,
} from "@/decision/rules/rule-packs";
import type { PrecedenceLevel } from "@/decision/rules/rule-packs";
import { PRESET_CONDITIONS } from "@/decision/rules/preset-conditions";

// ── Internal editor model ──────────────────────────────────────────────────────
//
// The editor always works with a flat list of leaf conditions.  No nested groups
// are exposed in this editor — a GroupCondition arriving from storage that contains
// nested group children will have those nested children stripped on load.

/** A leaf is any non-group condition — the only editable unit in this UI. */
type EditorLeaf = FieldCondition | NamedCondition | ContextCondition | FlagCondition;

// ── Rule-written context keys (regels die context schrijven) ────────────────────
//
// Keys prefixed with "__" are internal, engine-managed (e.g. __entryPath). They
// are reserved: the editor never lists them and strips the prefix from any typed
// input, so team members can neither pick nor overwrite them.

/** True for engine-internal keys that must not be author-editable. */
function isReservedContextKey(key: string): boolean {
  return key.startsWith("__");
}

/** Remove a leading "__"/"_" so authors can never enter a reserved key. */
function sanitizeContextKey(raw: string): string {
  return raw.replace(/^_+/, "");
}

/** Registry field keys offered as override targets in the context editors. */
const OVERRIDE_KEY_SUGGESTIONS: readonly string[] =
  (ALL_FIELD_KEYS as readonly string[]).filter((k) => !isReservedContextKey(k));

/** Operators valid for a flag condition — scalar only, so array ops are excluded. */
const FLAG_OPERATORS: readonly FieldOperator[] =
  (FIELD_OPERATORS as readonly FieldOperator[]).filter((op) => !ARRAY_VALUE_OPERATORS.has(op));

/**
 * The internal flat model for a rule's condition block.
 *
 * `logic`  — "and" → all leaves must match; "or" → any leaf must match.
 * `leaves` — ordered list of field / named conditions.  Always ≥ 1 entry.
 */
type EditorGroup = {
  logic:  "and" | "or";
  leaves: EditorLeaf[];
};

/** Convert any stored RuleCondition to the flat EditorGroup model. */
function toEditorGroup(condition: RuleCondition): EditorGroup {
  if (condition.type === "group") {
    // Only include direct leaf children — nested sub-groups are not editable here.
    const leaves = condition.conditions.filter(
      (c): c is EditorLeaf =>
        c.type === "field" || c.type === "named" || c.type === "context" || c.type === "flag",
    );
    return {
      logic:  condition.logic,
      leaves: leaves.length > 0 ? [...leaves] : [defaultLeaf()],
    };
  }
  // field or named — single-leaf group
  return { logic: "and", leaves: [condition as EditorLeaf] };
}

/**
 * Serialise an EditorGroup back to the most compact RuleCondition.
 *   1 leaf  → the leaf itself (no group wrapper, backwards-compatible)
 *   2+ leaves → GroupCondition
 */
function fromEditorGroup(group: EditorGroup): RuleCondition {
  if (group.leaves.length === 1) return group.leaves[0];
  return { type: "group", logic: group.logic, conditions: group.leaves };
}

/** The default leaf added when a user clicks "+ Add condition". */
function defaultLeaf(): EditorLeaf {
  return { type: "field", field: "source", operator: "equals", value: "google" };
}

// ── Editable rule (client-side draft) ─────────────────────────────────────────

/** A StoredRule that may be in an incomplete/invalid draft state during editing. */
type EditableRule = StoredRule & {
  _editOpen: boolean;
};

// ── Variant key labels ─────────────────────────────────────────────────────────

const HERO_KEY_LABELS: Record<HeroVariantKey, string> = {
  // ── Platform defaults ──────────────────────────────────────────────────────
  hero_default:             "Default — generic awareness entry",
  hero_google_problem:      "Google Problem — search / solution intent",
  hero_linkedin_vision:     "LinkedIn Vision — thought-leadership intent",
  hero_direct_brand:        "Direct Brand — unattributed / returning",
  hero_consideration:       "Consideration — mid-funnel evaluation",
  hero_intent_direct:       "Intent Direct — high-intent, direct apply",
  hero_customer_onboarding: "Customer Onboarding — post-conversion",
  // ── B2B SaaS blueprint ────────────────────────────────────────────────────
  hero_saas_default:            "SaaS Default — platform intro",
  hero_saas_consideration:      "SaaS Consideration — evaluating fit",
  hero_saas_intent:             "SaaS Intent — ready to trial",
  hero_saas_trial:              "SaaS Trial — start free trial",
  hero_saas_customer_onboarding:"SaaS Onboarding — activation mode",
  // ── Careers / Werken-bij blueprint ───────────────────────────────────────
  hero_careers_default:      "Careers Default — brand intro, culture showcase",
  hero_careers_job_match:    "Careers Job Match — role-led messaging",
  hero_careers_high_intent:  "Careers High Intent — direct apply CTA",
  hero_careers_reassurance:  "Careers Reassurance — drop-off recovery",
  // ── Per-preset demo variants ─────────────────────────────────────────────
  hero_trial_ready:          "Trial Ready — proefperiode staat klaar",
  hero_returning:            "Returning — welkom terug",
  hero_enterprise:           "Enterprise — personalisatie op schaal",
  hero_form_dropoff:         "Form Drop-off — nog vragen?",
  hero_customer_expansion:   "Customer Expansion — meer uit je site",
  hero_post_conversion:      "Post-Conversion — bedankt, we gaan aan de slag",
  hero_high_friction:        "High Friction — even vastgelopen",
  hero_churn_risk:           "Churn Risk — we zien je graag blijven",
  hero_careers_job_interest: "Careers Job Interest — deze rol past",
  hero_careers_submitted:    "Careers Submitted — sollicitatie ontvangen",
};

const PROOF_KEY_LABELS: Record<ProofVariantKey, string> = {
  // ── Platform defaults ──────────────────────────────────────────────────────
  proof_default:     "Default — general trust building",
  proof_cases:       "Cases — concrete case studies & ROI numbers",
  proof_vision:      "Vision — analyst quotes & industry recognition",
  proof_platform:    "Platform — scale & reliability stats",
  proof_stats:       "Stats — performance metrics",
  proof_reassurance: "Reassurance — low-pressure fallback",
  // ── B2B SaaS blueprint ────────────────────────────────────────────────────
  proof_saas_default:       "SaaS Default — platform value & credibility",
  proof_saas_consideration: "SaaS Consideration — use cases & fit signals",
  proof_saas_intent:        "SaaS Intent — ROI & conversion impact",
  proof_saas_reassurance:   "SaaS Reassurance — safe fallback",
  // ── Careers / Werken-bij blueprint ───────────────────────────────────────
  proof_careers_default:     "Careers Default — culture & employer credibility",
  proof_careers_team:        "Careers Team — team spotlights & department proof",
  proof_careers_reassurance: "Careers Reassurance — process transparency",
};

const CTA_KEY_LABELS: Record<CTAVariantKey, string> = {
  // ── Platform defaults ──────────────────────────────────────────────────────
  cta_default:    "Default — low-friction awareness CTA",
  cta_guide:      "Guide — get the free personalisation guide",
  cta_platform:   "Platform — start building for free",
  cta_meeting:    "Meeting — book a 20-minute intro call",
  cta_demo:       "Demo — bekijk een gratis demo",
  cta_onboarding: "Onboarding — start je onboarding",
  cta_expansion:  "Expansion — bekijk uitbreidingsopties",
  // ── B2B SaaS blueprint ────────────────────────────────────────────────────
  cta_saas_default:    "SaaS Default — learn more / see how it works",
  cta_saas_demo:       "SaaS Demo — book a product demo",
  cta_saas_trial:      "SaaS Trial — start free trial",
  cta_saas_onboarding: "SaaS Onboarding — next onboarding step",
  cta_saas_expansion:  "SaaS Expansion — expand plan",
  // ── Careers / Werken-bij blueprint ───────────────────────────────────────
  cta_careers_browse:  "Careers Browse — Bekijk vacatures",
  cta_careers_apply:   "Careers Apply — Solliciteer nu",
  cta_careers_open:    "Careers Open — Stuur open sollicitatie",
  cta_careers_contact: "Careers Contact — Stel een vraag",
};

const FEATURE_KEY_LABELS: Record<FeatureVariantKey, string> = {
  feature_grid_primary: "Feature Grid — full feature overview (awareness / orientation)",
  feature_highlights:   "Feature Highlights — condensed differentiators (mid-funnel)",
  feature_comparison:   "Feature Comparison — side-by-side plan table (high intent / trial)",
};

const CONVERSION_KEY_LABELS: Record<ConversionVariantKey, string> = {
  conversion_signup:  "Conversion Signup — email / account signup form",
  conversion_demo:    "Conversion Demo — demo request or booking embed",
  conversion_contact: "Conversion Contact — contact / enquiry form",
};

// ── Field group labels (for <optgroup> headings) ───────────────────────────────

const GROUP_LABELS: Record<FieldGroup, string> = {
  traffic:        "Traffic & Acquisition",
  device_session: "Device & Session",
  behavior:       "Behaviour & History",
  tenant_page:    "Tenant & Page",
  enrichment:     "Enrichment",
  time:           "Time",
  client_device:  "Client Device",
  derived:        "Derived Signals",
  interest:       "Interest Profiles",
  audience:       "Audience Segments",
};

/**
 * A short, curated shortlist of the most-used fields, surfaced in a "Common"
 * optgroup at the top of the field picker so non-technical authors don't have
 * to scan the full ~150-field list. Every key here also still appears in its
 * normal category below under "All fields". Order is intentional.
 */
const COMMON_FIELD_KEYS: readonly RuleFieldKey[] = [
  "channelGroup",
  "source",
  "entryPath",
  "pathname",
  "device",
  "visitType",
  "hasCampaignParam",
  "pageViewCount",
  "funnelStage",
  "contentInterestCategory",
  "isReturningVisitor",
  "isBot",
];

// ── Operator labels ────────────────────────────────────────────────────────────

const OPERATOR_LABELS: Record<FieldOperator, string> = {
  equals:                "equals",
  not_equals:            "does not equal",
  in:                    "is one of",
  not_in:                "is not one of",
  greater_than:          "is greater than",
  greater_than_or_equal: "is ≥",
  less_than:             "is less than",
  less_than_or_equal:    "is ≤",
  contains:              "contains",
  not_contains:          "does not contain",
  exists:                "exists (not null)",
  not_exists:            "does not exist (null)",
};

// ── New rule template ──────────────────────────────────────────────────────────

/**
 * Build a new blank EditableRule with a priority that is guaranteed not to
 * collide with any of the existing rules.
 *
 * Priority is computed as `max(existing priorities) + 10`, rounded up to the
 * nearest 10 for readability.  This avoids the duplicate-priority validation
 * error that arose when a module-level counter was used (the counter reset to
 * 100 on every full page reload, colliding with previously-saved rules that
 * were already at priority 110+).
 */
function newEditableRule(existingRules: EditableRule[]): EditableRule {
  const maxPriority = existingRules.length > 0
    ? Math.max(...existingRules.map((r) => r.priority))
    : 100;
  // Round up to the next clean multiple of 10 above maxPriority.
  const nextPriority = Math.ceil((maxPriority + 1) / 10) * 10;
  return {
    id:        `homepage.rule_${Date.now()}`,
    priority:  nextPriority,
    label:     "",
    condition: { type: "field", field: "source", operator: "equals", value: "google" },
    plan: {
      heroKey:  "hero_direct_brand",
      proofKey: "proof_platform",
      ctaKey:   "cta_meeting",
    },
    reason:    "",
    _editOpen: true,
  };
}

// ── Main component ─────────────────────────────────────────────────────────────

interface RulesEditorProps {
  initialConfig:     StoredRulesConfig;
  variantCatalogue?: VariantCatalogue;
  /**
   * Override the default saveRulesAction with a tenant-scoped action.
   * Provided by admin/tenants/[tenantId]/rules/page.tsx; when absent
   * the component falls back to the global saveRulesAction.
   */
  saveAction?:  (config: unknown) => Promise<{ ok: true } | { ok: false; error: string; fieldErrors?: string[] }>;
  /** Override the default resetRulesAction with a tenant-scoped one. */
  resetAction?: () => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Plan limits for this tenant — enables active-rule counter and limit enforcement. */
  planLimits?: { maxRules?: number };
}

export function RulesEditor({ initialConfig, variantCatalogue, saveAction, resetAction, planLimits }: RulesEditorProps) {
  const catalogue     = variantCatalogue ?? buildPlatformCatalogue();
  const doSaveAction  = saveAction  ?? saveRulesAction;
  const doResetAction = resetAction ?? resetRulesAction;
  const maxRules      = planLimits?.maxRules;
  const [rules, setRules] = useState<EditableRule[]>(
    () => initialConfig.rules.map((r) => ({ ...r, _editOpen: false })),
  );
  const [defaultPlan, setDefaultPlan] = useState<StoredDefaultPlan>(initialConfig.defaultPlan);
  const [defaultEditOpen, setDefaultEditOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);
  const [packFilter, setPackFilter]     = useState<string>("all");
  const [tierFilter, setTierFilter]     = useState<string>("all");
  const [variantFilter, setVariantFilter] = useState<string>("all");
  const [showContextLib, setShowContextLib] = useState(false);
  // ── Bulk selection state ───────────────────────────────────────────────────
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set());
  const [bulkPackId,  setBulkPackId]      = useState<string>("");
  const [limitError,  setLimitError]      = useState<string | null>(null);

  // ── Mutation helpers ─────────────────────────────────────────────────────────

  const markDirty = useCallback(() => {
    setIsDirty(true);
    setSaveStatus("idle");
    setSaveError(null);
    setFieldErrors([]);
  }, []);

  const updateRule = useCallback(
    (id: string, patch: Partial<EditableRule>) => {
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      markDirty();
    },
    [markDirty],
  );

  const toggleEdit = useCallback((id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, _editOpen: !r._editOpen } : r)),
    );
  }, []);

  const deleteRule = useCallback(
    (id: string) => {
      setRules((prev) => prev.filter((r) => r.id !== id));
      markDirty();
    },
    [markDirty],
  );

  // Card DOM nodes keyed by rule id, so a freshly-added rule can be scrolled
  // into view. A "pending scroll" id is set on add and consumed by the effect
  // below once the new card has rendered.
  const cardRefs        = useRef<Map<string, HTMLDivElement>>(new Map());
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingScrollId) return;
    const el = cardRefs.current.get(pendingScrollId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    setPendingScrollId(null);
  }, [pendingScrollId]);

  const addRule = useCallback(() => {
    const rule = newEditableRule(rules); // _editOpen: true → new rule renders expanded
    setRules((prev) => [...prev, rule]);
    setPendingScrollId(rule.id);          // scroll to it once rendered
    markDirty();
  }, [rules, markDirty]);

  const moveRule = useCallback(
    (id: string, direction: "up" | "down") => {
      setRules((prev) => {
        const sorted = [...prev].sort((a, b) => a.priority - b.priority);
        const idx = sorted.findIndex((r) => r.id === id);
        if (direction === "up" && idx > 0) {
          const swapPriority = sorted[idx - 1].priority;
          sorted[idx - 1] = { ...sorted[idx - 1], priority: sorted[idx].priority };
          sorted[idx]     = { ...sorted[idx], priority: swapPriority };
        }
        if (direction === "down" && idx < sorted.length - 1) {
          const swapPriority = sorted[idx + 1].priority;
          sorted[idx + 1] = { ...sorted[idx + 1], priority: sorted[idx].priority };
          sorted[idx]     = { ...sorted[idx], priority: swapPriority };
        }
        return sorted;
      });
      markDirty();
    },
    [markDirty],
  );

  // ── Enable / disable individual rule (with limit check) ──────────────────────

  const toggleEnabled = useCallback((id: string) => {
    setLimitError(null);
    setRules((prev) => {
      const rule = prev.find((r) => r.id === id);
      if (!rule) return prev;
      const isCurrentlyEnabled = rule.enabled !== false;
      if (!isCurrentlyEnabled) {
        // Trying to enable — check plan limit
        const enabledCount = prev.filter((r) => r.enabled !== false).length;
        if (maxRules !== undefined && enabledCount >= maxRules) {
          setLimitError(
            `Plan limit reached: your plan allows ${maxRules} active rule${maxRules === 1 ? "" : "s"}. ` +
            `Disable another rule first, or upgrade your plan.`,
          );
          return prev; // block the change
        }
      }
      return prev.map((r) => r.id === id ? { ...r, enabled: isCurrentlyEnabled ? false : undefined } : r);
    });
    markDirty();
  }, [markDirty, maxRules]);

  // ── Bulk selection helpers ────────────────────────────────────────────────────

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(rules.map((r) => r.id)));
  }, [rules]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setBulkPackId("");
  }, []);

  const bulkEnable = useCallback(() => {
    setLimitError(null);
    setRules((prev) => {
      const currentEnabled = prev.filter((r) => r.enabled !== false).length;
      const toEnable       = [...selectedIds].filter((id) => {
        const r = prev.find((x) => x.id === id);
        return r && r.enabled === false;
      });
      if (maxRules !== undefined && currentEnabled + toEnable.length > maxRules) {
        setLimitError(
          `Cannot enable ${toEnable.length} rule${toEnable.length === 1 ? "" : "s"}: ` +
          `that would bring the total to ${currentEnabled + toEnable.length}, exceeding your plan limit of ${maxRules}.`,
        );
        return prev;
      }
      return prev.map((r) =>
        selectedIds.has(r.id) ? { ...r, enabled: undefined } : r,
      );
    });
    markDirty();
    setSelectedIds(new Set());
  }, [selectedIds, markDirty, maxRules]);

  const bulkDisable = useCallback(() => {
    setLimitError(null);
    setRules((prev) =>
      prev.map((r) => selectedIds.has(r.id) ? { ...r, enabled: false } : r),
    );
    markDirty();
    setSelectedIds(new Set());
  }, [selectedIds, markDirty]);

  const bulkAssignPack = useCallback(() => {
    if (!bulkPackId) return;
    setRules((prev) =>
      prev.map((r) =>
        selectedIds.has(r.id)
          ? { ...r, packId: bulkPackId === "__clear" ? undefined : bulkPackId }
          : r,
      ),
    );
    markDirty();
    setSelectedIds(new Set());
    setBulkPackId("");
  }, [selectedIds, bulkPackId, markDirty]);

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setSaveStatus("saving");
    setSaveError(null);
    setFieldErrors([]);

    const config: StoredRulesConfig = {
      schemaVersion: 1,
      updatedAt:     new Date().toISOString(),
      rules:         rules.map(({ _editOpen: _, ...r }) => r),
      defaultPlan,
    };

    const result = await doSaveAction(config);

    if (result.ok) {
      setSaveStatus("saved");
      setIsDirty(false);
    } else {
      setSaveStatus("error");
      setSaveError(result.error);
      if ("fieldErrors" in result && result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
      }
    }
  }, [rules, defaultPlan, doSaveAction]);

  // ── Reset ────────────────────────────────────────────────────────────────────

  const handleReset = useCallback(async () => {
    setSaveStatus("saving");
    const result = await doResetAction();
    if (result.ok) {
      window.location.reload();
    } else {
      setSaveStatus("error");
      setSaveError(result.error);
    }
    setConfirmReset(false);
  }, [doResetAction]);

  // ── Render ───────────────────────────────────────────────────────────────────

  const sortedRules   = [...rules].sort((a, b) => a.priority - b.priority);
  const enabledCount  = rules.filter((r) => r.enabled !== false).length;
  const isOverLimit   = maxRules !== undefined && enabledCount > maxRules;
  const isAtLimit     = maxRules !== undefined && enabledCount >= maxRules;

  // All variant/adaptive-slot keys any rule points at (heroKey, proofKey, ctaKey,
  // featureKey, conversionKey, notificationKey — any *Key on the plan). Powers the
  // "filter by variant" dropdown so you can see which rules use a given block.
  const planVariantKeys = (plan: Record<string, unknown>): string[] =>
    Object.entries(plan)
      .filter(([k, v]) => k.endsWith("Key") && typeof v === "string" && v !== "")
      .map(([, v]) => v as string);

  const usedVariantKeys = Array.from(
    new Set(rules.flatMap((r) => planVariantKeys(r.plan as unknown as Record<string, unknown>))),
  ).sort();

  const filteredRules = sortedRules.filter((r) => {
    if (packFilter !== "all" && r.packId !== packFilter) return false;
    if (tierFilter !== "all") {
      const effectiveTier = r.precedenceLevel ?? inferPrecedenceLevel(r.priority);
      if (effectiveTier !== tierFilter) return false;
    }
    if (variantFilter !== "all"
        && !planVariantKeys(r.plan as unknown as Record<string, unknown>).includes(variantFilter)) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-8 px-8 py-8">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-neutral-900">Decision Rules</h1>
          <p className="text-sm text-neutral-500">
            Rules that map visitor signals to content variants, adaptive slots, and
            theme overrides. Evaluated across all page templates in priority order —
            first match wins.
          </p>
        </div>
        <SaveBar
          isDirty={isDirty}
          saveStatus={saveStatus}
          onSave={handleSave}
          onReset={() => setConfirmReset(true)}
        />
      </div>

      {/* ── Status messages ─────────────────────────────────────────────── */}
      {saveStatus === "error" && saveError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm">
          <p className="font-medium text-red-800">{saveError}</p>
          {fieldErrors.length > 0 && (
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-red-700">
              {fieldErrors.map((e, i) => (
                <li key={i} className="font-mono text-xs">{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {saveStatus === "saved" && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Rules saved successfully.
        </div>
      )}

      {/* ── Rules ───────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-neutral-800">Rules</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {/* Active counter */}
              {maxRules !== undefined ? (
                <span className={isOverLimit ? "text-red-600 font-semibold" : isAtLimit ? "text-amber-600 font-medium" : ""}>
                  {enabledCount} / {maxRules} active
                </span>
              ) : (
                <span>{enabledCount} active</span>
              )}
              {" · "}
              {filteredRules.length === sortedRules.length
                ? `${sortedRules.length} total · evaluated top to bottom`
                : `${filteredRules.length} of ${sortedRules.length} shown · filtered`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowContextLib((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-600 shadow-sm hover:bg-neutral-50 transition-colors"
              title="Context Library — named reusable predicates"
            >
              <span aria-hidden className="text-neutral-400">≡</span>
              Contexts
            </button>
            <button
              type="button"
              onClick={addRule}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50 transition-colors"
            >
              <span aria-hidden className="text-neutral-400">+</span>
              Add rule
            </button>
          </div>
        </div>

        {/* ── Filter toolbar ─────────────────────────────────────────── */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-500 font-medium shrink-0">Filter:</span>
          <select
            value={packFilter}
            onChange={(e) => setPackFilter(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            aria-label="Filter by pack"
          >
            <option value="all">All packs</option>
            {Object.values(RULE_PACK_REGISTRY).map((pack) => (
              <option key={pack.id} value={pack.id}>{pack.label}</option>
            ))}
            <option value="">No pack</option>
          </select>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            aria-label="Filter by precedence tier"
          >
            <option value="all">All tiers</option>
            {(Object.entries(PRECEDENCE_TIERS) as [PrecedenceLevel, typeof PRECEDENCE_TIERS[PrecedenceLevel]][]).map(([level, meta]) => (
              <option key={level} value={level}>{meta.label}</option>
            ))}
          </select>
          {usedVariantKeys.length > 0 && (
            <select
              value={variantFilter}
              onChange={(e) => setVariantFilter(e.target.value)}
              className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              aria-label="Filter by adaptive block / variant"
            >
              <option value="all">All blocks &amp; variants</option>
              {usedVariantKeys.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          )}
          {(packFilter !== "all" || tierFilter !== "all" || variantFilter !== "all") && (
            <button
              type="button"
              onClick={() => { setPackFilter("all"); setTierFilter("all"); setVariantFilter("all"); }}
              className="text-xs font-medium text-brand-600 hover:text-brand-800 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* ── Over-limit warning ────────────────────────────────────── */}
        {isOverLimit && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm">
            <p className="font-medium text-red-800">
              Over plan limit — {enabledCount - maxRules!} rule{enabledCount - maxRules! === 1 ? "" : "s"} over your allowance of {maxRules} active.
            </p>
            <p className="mt-1 text-xs text-red-700">
              Disable {enabledCount - maxRules!} rule{enabledCount - maxRules! === 1 ? "" : "s"} to stay within your plan, or upgrade.
            </p>
          </div>
        )}

        {/* ── Limit-blocked error ────────────────────────────────────── */}
        {limitError && (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
            <p className="text-amber-800">{limitError}</p>
            <button
              type="button"
              onClick={() => setLimitError(null)}
              className="shrink-0 text-xs font-medium text-amber-600 hover:text-amber-800 transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ── Context Library panel ──────────────────────────────────── */}
        {showContextLib && (
          <ContextLibraryPanel onClose={() => setShowContextLib(false)} />
        )}

        {/* ── Bulk action toolbar ────────────────────────────────────── */}
        {selectedIds.size > 0 && (
          <div className="mb-1 flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
            <span className="text-xs font-medium text-neutral-600 shrink-0">
              {selectedIds.size} of {sortedRules.length} selected
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={bulkEnable}
                className="inline-flex items-center gap-1 rounded border border-green-300 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
              >
                Enable
              </button>
              <button
                type="button"
                onClick={bulkDisable}
                className="inline-flex items-center gap-1 rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 transition-colors"
              >
                Disable
              </button>
              <span className="select-none text-neutral-300">|</span>
              <select
                value={bulkPackId}
                onChange={(e) => setBulkPackId(e.target.value)}
                className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 focus:outline-none"
                aria-label="Bulk assign pack"
              >
                <option value="">Assign to pack…</option>
                {Object.values(RULE_PACK_REGISTRY).map((pack) => (
                  <option key={pack.id} value={pack.id}>{pack.label}</option>
                ))}
                <option value="__clear">— Remove from pack —</option>
              </select>
              <button
                type="button"
                onClick={bulkAssignPack}
                disabled={!bulkPackId}
                className="inline-flex items-center rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Apply
              </button>
            </div>
            <button
              type="button"
              onClick={selectAll}
              className="text-xs font-medium text-brand-600 hover:text-brand-800 transition-colors"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="ml-auto text-xs text-neutral-400 hover:text-neutral-700 transition-colors shrink-0"
            >
              Clear
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {filteredRules.length === 0 && sortedRules.length === 0 && (
            <div className="rounded-lg border border-dashed border-neutral-300 py-10 text-center text-sm text-neutral-400">
              No rules yet. Click &ldquo;Add rule&rdquo; to create one.
            </div>
          )}
          {filteredRules.length === 0 && sortedRules.length > 0 && (
            <div className="rounded-lg border border-dashed border-neutral-300 py-8 text-center text-sm text-neutral-400">
              No rules match the current filters.
            </div>
          )}
          {filteredRules.map((rule, idx) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              index={idx}
              total={sortedRules.length}
              catalogue={catalogue}
              onChange={(patch) => updateRule(rule.id, patch)}
              onToggleEdit={() => toggleEdit(rule.id)}
              onDelete={() => deleteRule(rule.id)}
              onMove={(dir) => moveRule(rule.id, dir)}
              isSelected={selectedIds.has(rule.id)}
              onSelect={() => toggleSelect(rule.id)}
              onToggleEnabled={() => toggleEnabled(rule.id)}
              isAtLimit={isAtLimit}
              cardRef={(el) => {
                if (el) cardRefs.current.set(rule.id, el);
                else    cardRefs.current.delete(rule.id);
              }}
            />
          ))}
        </div>
      </section>

      {/* ── Default plan ────────────────────────────────────────────────── */}
      <section>
        <div className="mb-3">
          <h2 className="text-base font-semibold text-neutral-800">Default plan</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Applied when no rule matches (direct traffic, unknown sources).
          </p>
        </div>
        <DefaultPlanCard
          plan={defaultPlan}
          editOpen={defaultEditOpen}
          catalogue={catalogue}
          onToggleEdit={() => setDefaultEditOpen((v) => !v)}
          onChange={(patch) => {
            setDefaultPlan((prev) => ({ ...prev, ...patch }));
            markDirty();
          }}
        />
      </section>

      {/* ── Reset confirmation ───────────────────────────────────────────── */}
      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-neutral-900 mb-2">Reset to defaults?</h3>
            <p className="text-sm text-neutral-600 mb-6">
              This will overwrite your saved rules with the code-defined defaults and reload the page.
              Any unsaved changes will be lost.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SaveBar ────────────────────────────────────────────────────────────────────

function SaveBar({
  isDirty,
  saveStatus,
  onSave,
  onReset,
}: {
  isDirty:    boolean;
  saveStatus: "idle" | "saving" | "saved" | "error";
  onSave:     () => void;
  onReset:    () => void;
}) {
  return (
    <div className="flex items-center gap-3 shrink-0">
      {isDirty && (
        <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
      )}
      <button
        type="button"
        onClick={onReset}
        disabled={saveStatus === "saving"}
        className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors disabled:opacity-50"
      >
        Reset to defaults
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saveStatus === "saving" || !isDirty}
        className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saveStatus === "saving" ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

// ── RuleCard ───────────────────────────────────────────────────────────────────

interface RuleCardProps {
  rule:            EditableRule;
  index:           number;
  total:           number;
  catalogue:       VariantCatalogue;
  onChange:        (patch: Partial<EditableRule>) => void;
  onToggleEdit:    () => void;
  onDelete:        () => void;
  onMove:          (dir: "up" | "down") => void;
  isSelected:      boolean;
  onSelect:        () => void;
  onToggleEnabled: () => void;
  isAtLimit:       boolean;
  cardRef?:        (el: HTMLDivElement | null) => void;
}

// ── Advanced-feature detection (progressive disclosure) ─────────────────────────

/** True when any leaf in the condition tree is not a plain field condition. */
function conditionHasNonFieldLeaf(c: RuleCondition): boolean {
  if (c.type === "group") return c.conditions.some(conditionHasNonFieldLeaf);
  return c.type !== "field";
}

/**
 * True when a rule already uses an "advanced" feature — an extended variant
 * slot, form/email targeting, context writes, a pack/precedence override, or a
 * non-field condition type. Used to auto-open the Advanced panel so nothing in
 * use is ever hidden behind the toggle.
 */
function ruleUsesAdvanced(rule: StoredRule): boolean {
  const p = rule.plan;
  if (
    p.featureKey || p.conversionKey || p.notificationKey || p.pageBannerKey ||
    p.themeKey || p.pricingEmphasis || p.pricingCtaMode
  ) return true;
  if (p.formVariants  && Object.keys(p.formVariants).length  > 0) return true;
  if (p.emailVariants && Object.keys(p.emailVariants).length > 0) return true;
  if (p.setContext    && p.setContext.length > 0)                 return true;
  if (rule.packId || rule.precedenceLevel)                       return true;
  return conditionHasNonFieldLeaf(rule.condition);
}

function RuleCard({
  rule,
  index,
  total,
  catalogue,
  onChange,
  onToggleEdit,
  onDelete,
  onMove,
  isSelected,
  onSelect,
  onToggleEnabled,
  isAtLimit,
  cardRef,
}: RuleCardProps) {
  const isFirst        = index === 0;
  const isLast         = index === total - 1;
  const isDisabled     = rule.enabled === false;
  const conditionLabel = formatCondition(rule.condition);

  // Progressive disclosure: advanced sections (packs/precedence, extended
  // variant slots, form/email targeting, context writes, uncommon condition
  // types) stay hidden until toggled — but auto-open when the rule already uses
  // one so nothing in use is concealed. Presentation only; data is untouched.
  const [advanced, setAdvanced] = useState(() => ruleUsesAdvanced(rule));

  return (
    <div ref={cardRef} className={`rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden transition-opacity${isDisabled ? " opacity-60" : ""}`}>
      {/* ── Summary row ───────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Selection checkbox — nudge down so it aligns with the first text line */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 mt-1 h-4 w-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
          aria-label={`Select rule: ${rule.label || "Unnamed rule"}`}
        />

        <span className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 text-xs font-mono font-semibold text-neutral-600">
          {rule.priority}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-x-2 gap-y-1 flex-wrap">
            <p className="text-sm font-medium text-neutral-900">
              {rule.label || <span className="italic text-neutral-400">Unnamed rule</span>}
            </p>
            {isDisabled && (
              <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-500">
                disabled
              </span>
            )}
            {rule.packId && RULE_PACK_REGISTRY[rule.packId] && (
              <PackBadge packId={rule.packId} />
            )}
            <TierChip priority={rule.priority} precedenceLevel={rule.precedenceLevel} />
          </div>
          <p
            className="text-xs text-neutral-500 mt-0.5 font-mono truncate"
            title={conditionLabel}
          >
            {conditionLabel}
          </p>
        </div>

        {/* Plan badges — only show at xl+ so they don't crowd narrower viewports */}
        <div className="hidden xl:flex items-start gap-1.5 shrink-0 flex-wrap max-w-xs justify-end">
          <PlanBadge block="hero"  value={rule.plan.heroKey} />
          <PlanBadge block="proof" value={rule.plan.proofKey} />
          <PlanBadge block="cta"   value={rule.plan.ctaKey} />
          {rule.plan.featureKey    && <PlanBadge block="feature"    value={rule.plan.featureKey} />}
          {rule.plan.conversionKey && <PlanBadge block="conversion" value={rule.plan.conversionKey} />}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Enable / Disable toggle */}
          <button
            type="button"
            onClick={onToggleEnabled}
            title={isDisabled
              ? (isAtLimit ? "Plan limit reached — disable another rule first" : "Enable this rule")
              : "Disable this rule"
            }
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
              isDisabled
                ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
                : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            {isDisabled ? "Enable" : "Disable"}
          </button>
          <IconButton label="Move up"   onClick={() => onMove("up")}   disabled={isFirst} icon={<ArrowUpIcon />} />
          <IconButton label="Move down" onClick={() => onMove("down")} disabled={isLast}  icon={<ArrowDownIcon />} />
          <button
            type="button"
            onClick={onToggleEdit}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            {rule._editOpen ? "Done" : "Edit"}
          </button>
        </div>
      </div>

      {/* ── Edit panel ────────────────────────────────────────────────── */}
      {rule._editOpen && (
        <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-5">
          {/* Advanced-options toggle — reveals packs/precedence, extended
              variant slots, form/email targeting, context writes and uncommon
              condition types. */}
          <div className="mb-4 flex justify-end">
            <label className="flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-neutral-500">
              <input
                type="checkbox"
                checked={advanced}
                onChange={(e) => setAdvanced(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
              />
              Advanced options
            </label>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Left column: identity + conditions */}
            <div className="flex flex-col gap-4">
              <Field label="Label">
                <input
                  type="text"
                  value={rule.label}
                  onChange={(e) => onChange({ label: e.target.value })}
                  placeholder="e.g. Google traffic on mobile"
                  className={inputCls}
                />
              </Field>

              <Field label="Priority" hint="Lower number = higher priority. Must be unique.">
                <input
                  type="number"
                  value={rule.priority}
                  min={1}
                  max={9999}
                  onChange={(e) =>
                    onChange({ priority: Math.max(1, parseInt(e.target.value, 10) || 1) })
                  }
                  className={inputCls}
                />
              </Field>

              <Field label="Reason" hint="Shown in debug output and analytics events.">
                <input
                  type="text"
                  value={rule.reason}
                  onChange={(e) => onChange({ reason: e.target.value })}
                  placeholder="e.g. Traffic source indicates search/problem intent."
                  className={inputCls}
                />
              </Field>

              {advanced && (
                <Field label="Rule pack" hint="Organisational group for admin filtering. Does not affect evaluation.">
                  <select
                    value={rule.packId ?? ""}
                    onChange={(e) => onChange({ packId: e.target.value || undefined })}
                    className={selectCls}
                  >
                    <option value="">— None —</option>
                    {Object.values(RULE_PACK_REGISTRY).map((pack) => (
                      <option key={pack.id} value={pack.id}>{pack.label}</option>
                    ))}
                  </select>
                </Field>
              )}

              {advanced && (
                <Field label="Precedence tier" hint="Overrides the tier inferred from priority. Leave blank to infer automatically.">
                  <select
                    value={rule.precedenceLevel ?? ""}
                    onChange={(e) =>
                      onChange({ precedenceLevel: (e.target.value as PrecedenceLevel) || undefined })
                    }
                    className={selectCls}
                  >
                    <option value="">— Infer from priority —</option>
                    {(Object.entries(PRECEDENCE_TIERS) as [PrecedenceLevel, typeof PRECEDENCE_TIERS[PrecedenceLevel]][]).map(([level, meta]) => (
                      <option key={level} value={level}>
                        {meta.label} ({meta.range[0]}–{meta.range[1]})
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              <FlatGroupEditor
                condition={rule.condition}
                advanced={advanced}
                onChange={(condition) => onChange({ condition })}
              />
            </div>

            {/* Right column: plan */}
            <div className="flex flex-col gap-4">
              {/* Header row: label + Fill from preset */}
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Variant Plan
                </p>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const key = e.target.value;
                    if (!key) return;
                    const preset = PRESET_PLANS[key];
                    if (!preset) return;
                    onChange({
                      plan: {
                        ...rule.plan,
                        heroKey:       preset.heroKey,
                        proofKey:      preset.proofKey,
                        ctaKey:        preset.ctaKey,
                        featureKey:    preset.featureKey,
                        conversionKey: preset.conversionKey,
                        pricingEmphasis: preset.pricingEmphasis,
                        pricingCtaMode:  preset.pricingCtaMode,
                      },
                    });
                    e.target.value = "";
                  }}
                  className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-600 hover:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                  title="Fill all plan fields from a scenario preset"
                >
                  <option value="" disabled>Fill from preset…</option>
                  <optgroup label="Generic / B2B SaaS">
                    {PRESET_CONDITIONS.filter((p) => p.group === "generic").map((p) => (
                      <option key={p.key} value={p.key}>{p.icon} {p.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Careers / Werken-bij">
                    {PRESET_CONDITIONS.filter((p) => p.group === "careers").map((p) => (
                      <option key={p.key} value={p.key}>{p.icon} {p.label}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Core slots */}
              <Field label="Hero variant">
                <select
                  value={rule.plan.heroKey}
                  onChange={(e) =>
                    onChange({ plan: { ...rule.plan, heroKey: e.target.value as HeroVariantKey } })
                  }
                  className={selectCls}
                >
                  <VariantOptions entries={catalogue.hero} />
                </select>
              </Field>

              <Field label="Proof variant">
                <select
                  value={rule.plan.proofKey}
                  onChange={(e) =>
                    onChange({ plan: { ...rule.plan, proofKey: e.target.value as ProofVariantKey } })
                  }
                  className={selectCls}
                >
                  <VariantOptions entries={catalogue.proof} />
                </select>
              </Field>

              <Field label="CTA variant">
                <select
                  value={rule.plan.ctaKey}
                  onChange={(e) =>
                    onChange({ plan: { ...rule.plan, ctaKey: e.target.value as CTAVariantKey } })
                  }
                  className={selectCls}
                >
                  <VariantOptions entries={catalogue.cta} />
                </select>
              </Field>

              {advanced && (<>
              {/* Extended slots */}
              <Field label="Feature variant" hint="Optional — leave blank to omit this slot.">
                <select
                  value={rule.plan.featureKey ?? ""}
                  onChange={(e) =>
                    onChange({
                      plan: {
                        ...rule.plan,
                        featureKey: (e.target.value as FeatureVariantKey) || undefined,
                      },
                    })
                  }
                  className={selectCls}
                >
                  <option value="">— None (slot omitted) —</option>
                  {catalogue.feature.map((entry) => (
                    <option key={entry.key} value={entry.key}>{entry.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Conversion variant" hint="Optional — leave blank to omit this slot.">
                <select
                  value={rule.plan.conversionKey ?? ""}
                  onChange={(e) =>
                    onChange({
                      plan: {
                        ...rule.plan,
                        conversionKey: (e.target.value as ConversionVariantKey) || undefined,
                      },
                    })
                  }
                  className={selectCls}
                >
                  <option value="">— None (slot omitted) —</option>
                  {catalogue.conversion.map((entry) => (
                    <option key={entry.key} value={entry.key}>{entry.label}</option>
                  ))}
                </select>
              </Field>

              {/* Form + email variants: target an authored variant per key */}
              <VariantTargetFields
                title="Form variants"
                groups={catalogue.forms}
                value={rule.plan.formVariants}
                onChange={(next) => onChange({ plan: { ...rule.plan, formVariants: next } })}
                formatLabel={formatFormKey}
                emptyHint="No variants yet. Add them on the form page to target one here."
                defaultOptionLabel="Default form"
              />
              <VariantTargetFields
                title="Email variants"
                groups={catalogue.emails}
                value={rule.plan.emailVariants}
                onChange={(next) => onChange({ plan: { ...rule.plan, emailVariants: next } })}
                formatLabel={formatEmailKey}
                emptyHint="No variants yet. Add them on the email page to target one here."
                defaultOptionLabel="Default email"
              />

              {/* Context writes: set flags / override derived fields when this rule fires */}
              <SetContextFields
                value={rule.plan.setContext}
                onChange={(next) => onChange({ plan: { ...rule.plan, setContext: next } })}
              />
              </>)}
            </div>
          </div>

          <div className="mt-5 flex justify-end border-t border-neutral-200 pt-4">
            <button
              type="button"
              onClick={onDelete}
              className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors"
            >
              Delete rule
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── DefaultPlanCard ────────────────────────────────────────────────────────────

function DefaultPlanCard({
  plan,
  editOpen,
  catalogue,
  onToggleEdit,
  onChange,
}: {
  plan:         StoredDefaultPlan;
  editOpen:     boolean;
  catalogue:    VariantCatalogue;
  onToggleEdit: () => void;
  onChange:     (patch: Partial<StoredDefaultPlan>) => void;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full border border-dashed border-neutral-300 text-xs font-mono text-neutral-400">
          —
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-900">Default (no match)</p>
          <p className="text-xs text-neutral-500 mt-0.5">Applied when no rule fires.</p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 shrink-0 flex-wrap">
          <PlanBadge block="hero"  value={plan.heroKey} />
          <PlanBadge block="proof" value={plan.proofKey} />
          <PlanBadge block="cta"   value={plan.ctaKey} />
          {plan.featureKey    && <PlanBadge block="feature"    value={plan.featureKey} />}
          {plan.conversionKey && <PlanBadge block="conversion" value={plan.conversionKey} />}
        </div>
        <button
          type="button"
          onClick={onToggleEdit}
          className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          {editOpen ? "Done" : "Edit"}
        </button>
      </div>

      {editOpen && (
        <div className="border-t border-neutral-100 bg-neutral-50 px-5 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <Field label="Reason" hint="Shown in debug output and analytics events.">
                <input
                  type="text"
                  value={plan.reason}
                  onChange={(e) => onChange({ reason: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="flex flex-col gap-4">
              {/* Core slots */}
              <Field label="Hero variant">
                <select
                  value={plan.heroKey}
                  onChange={(e) => onChange({ heroKey: e.target.value as HeroVariantKey })}
                  className={selectCls}
                >
                  <VariantOptions entries={catalogue.hero} />
                </select>
              </Field>
              <Field label="Proof variant">
                <select
                  value={plan.proofKey}
                  onChange={(e) => onChange({ proofKey: e.target.value as ProofVariantKey })}
                  className={selectCls}
                >
                  <VariantOptions entries={catalogue.proof} />
                </select>
              </Field>
              <Field label="CTA variant">
                <select
                  value={plan.ctaKey}
                  onChange={(e) => onChange({ ctaKey: e.target.value as CTAVariantKey })}
                  className={selectCls}
                >
                  <VariantOptions entries={catalogue.cta} />
                </select>
              </Field>
              {/* Extended slots */}
              <Field label="Feature variant" hint="Optional — omit to skip this slot.">
                <select
                  value={plan.featureKey ?? ""}
                  onChange={(e) =>
                    onChange({ featureKey: (e.target.value as FeatureVariantKey) || undefined })
                  }
                  className={selectCls}
                >
                  <option value="">— None (slot omitted) —</option>
                  {catalogue.feature.map((entry) => (
                    <option key={entry.key} value={entry.key}>{entry.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Conversion variant" hint="Optional — omit to skip this slot.">
                <select
                  value={plan.conversionKey ?? ""}
                  onChange={(e) =>
                    onChange({ conversionKey: (e.target.value as ConversionVariantKey) || undefined })
                  }
                  className={selectCls}
                >
                  <option value="">— None (slot omitted) —</option>
                  {catalogue.conversion.map((entry) => (
                    <option key={entry.key} value={entry.key}>{entry.label}</option>
                  ))}
                </select>
              </Field>

              {/* Form + email variants: default variant per key */}
              <VariantTargetFields
                title="Form variants"
                groups={catalogue.forms}
                value={plan.formVariants}
                onChange={(next) => onChange({ formVariants: next })}
                formatLabel={formatFormKey}
                emptyHint="No variants yet. Add them on the form page to target one here."
                defaultOptionLabel="Default form"
              />
              <VariantTargetFields
                title="Email variants"
                groups={catalogue.emails}
                value={plan.emailVariants}
                onChange={(next) => onChange({ emailVariants: next })}
                formatLabel={formatEmailKey}
                emptyHint="No variants yet. Add them on the email page to target one here."
                defaultOptionLabel="Default email"
              />

              {/* Context writes for the default plan */}
              <SetContextFields
                value={plan.setContext}
                onChange={(next) => onChange({ setContext: next })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── FlatGroupEditor ────────────────────────────────────────────────────────────

/**
 * Multi-condition editor for a rule's condition block.
 *
 * Renders a flat list of leaf conditions (field or named) with an AND / OR
 * logic toggle at the top when more than one condition is present.
 *
 * The internal EditorGroup model is derived from the incoming RuleCondition prop
 * on every render — the parent holds the source-of-truth condition and all
 * mutations propagate upward via onChange.
 *
 * Save behaviour:
 *   • 1 condition  → saved as the leaf itself (no group wrapper)
 *   • 2+ conditions → saved as GroupCondition { type: "group", logic, conditions }
 */
function FlatGroupEditor({
  condition,
  onChange,
  advanced = false,
}: {
  condition: RuleCondition;
  onChange:  (c: RuleCondition) => void;
  advanced?: boolean;
}) {
  const group = toEditorGroup(condition);

  const emit = (next: EditorGroup) => onChange(fromEditorGroup(next));

  const handleLogicChange = (logic: "and" | "or") => {
    emit({ ...group, logic });
  };

  const handleLeafChange = (i: number, leaf: EditorLeaf) => {
    const leaves = group.leaves.map((l, idx) => (idx === i ? leaf : l));
    emit({ ...group, leaves });
  };

  const handleAddLeaf = () => {
    emit({ ...group, leaves: [...group.leaves, defaultLeaf()] });
  };

  const handleRemoveLeaf = (i: number) => {
    if (group.leaves.length <= 1) return;
    const leaves = group.leaves.filter((_, idx) => idx !== i);
    emit({ ...group, leaves });
  };

  const isMulti = group.leaves.length > 1;

  const genericPresets = PRESET_CONDITIONS.filter((p) => p.group === "generic");
  const careersPresets = PRESET_CONDITIONS.filter((p) => p.group === "careers");

  const handlePresetSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value;
    if (!key) return;
    const preset = PRESET_CONDITIONS.find((p) => p.key === key);
    if (!preset) return;
    emit({ logic: preset.logic, leaves: [...preset.leaves] });
    // Reset the select back to the placeholder so it can be re-used.
    e.target.value = "";
  };

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <legend className="text-xs font-semibold uppercase tracking-wide text-neutral-500 px-1">
        {isMulti ? "Conditions" : "Condition"}
      </legend>

      {/* ── Quick preset selector ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 -mt-1">
        <span className="text-xs text-neutral-400">Start from a preset or build manually below.</span>
        <select
          defaultValue=""
          onChange={handlePresetSelect}
          className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-500 shadow-sm hover:border-neutral-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
          aria-label="Apply a quick preset condition"
          title="Replace conditions with a scenario preset"
        >
          <option value="" disabled>Quick preset…</option>
          <optgroup label="Generic / B2B SaaS">
            {genericPresets.map((p) => (
              <option key={p.key} value={p.key}>{p.icon} {p.label}</option>
            ))}
          </optgroup>
          <optgroup label="Careers / Werken-bij">
            {careersPresets.map((p) => (
              <option key={p.key} value={p.key}>{p.icon} {p.label}</option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* ── AND / OR logic selector (only shown for 2+ conditions) ───── */}
      {isMulti && (
        <div className="flex items-center gap-2 rounded-md bg-neutral-50 border border-neutral-200 px-3 py-2">
          <span className="text-xs text-neutral-500 font-medium shrink-0">Match</span>
          <select
            value={group.logic}
            onChange={(e) => handleLogicChange(e.target.value as "and" | "or")}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            aria-label="Logic operator"
          >
            <option value="and">ALL</option>
            <option value="or">ANY</option>
          </select>
          <span className="text-xs text-neutral-500 shrink-0">of the following conditions</span>
        </div>
      )}

      {/* ── Condition rows ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        {group.leaves.map((leaf, i) => (
          <ConditionRow
            key={i}
            leaf={leaf}
            index={i}
            isOnly={!isMulti}
            showLogicLabel={isMulti && i > 0}
            logic={group.logic}
            advanced={advanced}
            onChange={(next) => handleLeafChange(i, next)}
            onRemove={() => handleRemoveLeaf(i)}
          />
        ))}
      </div>

      {/* ── Add condition ────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleAddLeaf}
        className="mt-1 self-start text-xs font-medium text-brand-600 hover:text-brand-800 transition-colors"
      >
        + Add condition
      </button>
    </fieldset>
  );
}

// ── ConditionRow ───────────────────────────────────────────────────────────────

/**
 * A single leaf condition within a FlatGroupEditor.
 *
 * Renders a type selector (field / named) in the header bar alongside the
 * remove button, then the appropriate body: FieldConditionEditor for field
 * conditions or a named-condition selector for named ones.
 *
 * `isOnly`           — true when this is the only condition in the group;
 *                      hides the Remove button (can't reduce to zero conditions).
 * `showLogicLabel`   — true for all rows after the first when multi-condition;
 *                      renders a small AND/OR badge as a visual separator.
 */
function ConditionRow({
  leaf,
  isOnly,
  showLogicLabel,
  logic,
  advanced,
  onChange,
  onRemove,
}: {
  leaf:           EditorLeaf;
  index:          number;
  isOnly:         boolean;
  showLogicLabel: boolean;
  logic:          "and" | "or";
  advanced:       boolean;
  onChange:       (l: EditorLeaf) => void;
  onRemove:       () => void;
}) {
  const namedConditions = Object.entries(NAMED_CONDITIONS) as [
    NamedConditionId,
    { label: string; description: string },
  ][];

  const handleTypeChange = (type: "field" | "named" | "context" | "flag") => {
    if (type === "field") {
      onChange({ type: "field", field: "source", operator: "equals", value: "google" });
    } else if (type === "named") {
      onChange({ type: "named", name: "returning_cta_clicked" });
    } else if (type === "flag") {
      onChange({ type: "flag", name: "", operator: "equals", value: true });
    } else {
      onChange({ type: "context", contextId: ALL_CONTEXT_IDS[0] as ContextId });
    }
  };

  return (
    <div>
      {/* AND / OR connector label between rows */}
      {showLogicLabel && (
        <div className="flex items-center gap-2 py-1 pl-1">
          <span className="inline-flex items-center rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
            {logic}
          </span>
        </div>
      )}

      {/* Condition card */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 overflow-hidden">
        {/* Header: type selector (advanced) + remove */}
        <div className="flex items-center justify-between gap-2 border-b border-neutral-200 bg-white px-3 py-2">
          {advanced ? (
            <select
              value={leaf.type}
              onChange={(e) => handleTypeChange(e.target.value as "field" | "named" | "context" | "flag")}
              className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              aria-label="Condition type"
            >
              <option value="field">Field condition</option>
              <option value="named">Named condition</option>
              <option value="context">Context condition</option>
              <option value="flag">Flag condition</option>
            </select>
          ) : (
            // Calm view: field conditions only. Named/Context/Flag types live
            // behind the Advanced toggle. A static label keeps the header honest
            // for the rare rule that already uses another type.
            <span className="text-xs font-medium text-neutral-500">
              {leaf.type === "field"   ? "Field condition"
               : leaf.type === "named"   ? "Named condition"
               : leaf.type === "context" ? "Context condition"
               : "Flag condition"}
            </span>
          )}

          {!isOnly && (
            <button
              type="button"
              onClick={onRemove}
              className="text-xs font-medium text-neutral-400 hover:text-red-600 transition-colors"
              aria-label="Remove condition"
            >
              Remove
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-3 py-3 flex flex-col gap-3">
          {leaf.type === "field" && (
            <FieldConditionEditor
              field={leaf.field}
              operator={leaf.operator ?? "equals"}
              value={leaf.value}
              onChange={(field, operator, value) =>
                onChange({ type: "field", field, operator, value })
              }
            />
          )}

          {leaf.type === "named" && (
            <Field label="Named condition">
              <select
                value={leaf.name}
                onChange={(e) =>
                  onChange({ type: "named", name: e.target.value as NamedConditionId })
                }
                className={selectCls}
              >
                {namedConditions.map(([name, meta]) => (
                  <option key={name} value={name}>{meta.label}</option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-neutral-500">
                {NAMED_CONDITIONS[leaf.name].description}
              </p>
            </Field>
          )}

          {leaf.type === "context" && (
            <Field
              label="Context"
              hint="Reusable named predicate from the Context Library. Evaluated once per request."
            >
              <select
                value={leaf.contextId}
                onChange={(e) =>
                  onChange({ type: "context", contextId: e.target.value as ContextId })
                }
                className={selectCls}
              >
                {ALL_CONTEXT_IDS.map((id) => {
                  const ctx = CONTEXT_REGISTRY[id];
                  return (
                    <option key={id} value={id}>
                      {ctx?.label ?? id}
                    </option>
                  );
                })}
              </select>
              {leaf.contextId && CONTEXT_REGISTRY[leaf.contextId] && (
                <p className="mt-1.5 text-xs text-neutral-500">
                  {CONTEXT_REGISTRY[leaf.contextId].description}
                </p>
              )}
            </Field>
          )}

          {leaf.type === "flag" && (
            <FlagConditionEditor
              name={leaf.name}
              operator={leaf.operator ?? "equals"}
              value={leaf.value}
              onChange={(name, operator, value) =>
                onChange({ type: "flag", name, operator, value })
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── FlagConditionEditor ──────────────────────────────────────────────────────────

/**
 * Editor for a FlagCondition — reads a rule-written flag from ctx.ruleContext.
 *
 * Flag names are free-form (own flags like "gericht_binnengekomen"), so the name
 * is a text input with a datalist of override-target suggestions. Reserved
 * internal keys (prefixed "__", e.g. __entryPath) are never suggested and are
 * stripped from typed input — team members cannot read or target them here.
 * Operators mirror field conditions minus the array (in/not_in) operators.
 */
function FlagConditionEditor({
  name,
  operator,
  value,
  onChange,
}: {
  name:     string;
  operator: FieldOperator;
  value:    string | number | boolean | undefined;
  onChange: (name: string, operator: FieldOperator, value: string | number | boolean | undefined) => void;
}) {
  const listId = useId();
  const effectiveOp: FieldOperator = FLAG_OPERATORS.includes(operator) ? operator : "equals";

  const handleOperatorChange = (newOp: FieldOperator) => {
    // Adjust the value to fit the new operator: none for existence checks,
    // number for ordering, string for substring, else keep/seed a scalar.
    let newValue: string | number | boolean | undefined = value;
    if (NO_VALUE_OPERATORS.has(newOp))            newValue = undefined;
    else if (NUMERIC_OPERATORS.has(newOp))        newValue = typeof value === "number" ? value : 0;
    else if (STRING_ONLY_OPERATORS.has(newOp))    newValue = typeof value === "string" ? value : "";
    else if (value === undefined)                 newValue = true;
    onChange(name, newOp, newValue);
  };

  return (
    <>
      <Field
        label="Flag name"
        hint="Own flag written by a rule (e.g. gericht_binnengekomen). Internal keys (__) are reserved."
      >
        <input
          type="text"
          value={name}
          list={listId}
          placeholder="gericht_binnengekomen"
          onChange={(e) => onChange(sanitizeContextKey(e.target.value), effectiveOp, value)}
          className={inputCls}
        />
        <datalist id={listId}>
          {OVERRIDE_KEY_SUGGESTIONS.map((k) => (
            <option key={k} value={k} />
          ))}
        </datalist>
      </Field>

      <Field label="Operator">
        <select
          value={effectiveOp}
          onChange={(e) => handleOperatorChange(e.target.value as FieldOperator)}
          className={selectCls}
        >
          {FLAG_OPERATORS.map((op) => (
            <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
          ))}
        </select>
      </Field>

      {!NO_VALUE_OPERATORS.has(effectiveOp) && (
        <Field label="Value">
          <ScalarValueInput
            operator={effectiveOp}
            value={value}
            onChange={(v) => onChange(name, effectiveOp, v)}
          />
        </Field>
      )}
    </>
  );
}

// ── ScalarValueInput ─────────────────────────────────────────────────────────────

/**
 * Scalar value input (string | number | boolean) for flag conditions and context
 * writes. Picks the widget from the operator (numeric/string) or an explicit
 * `kind` override, defaulting to a text/number/boolean chooser.
 */
function ScalarValueInput({
  operator,
  value,
  onChange,
}: {
  operator?: FieldOperator;
  value:     string | number | boolean | undefined;
  onChange:  (v: string | number | boolean | undefined) => void;
}) {
  // Numeric ordering operators force a number input.
  if (operator && NUMERIC_OPERATORS.has(operator)) {
    return (
      <input
        type="number"
        value={typeof value === "number" ? value : ""}
        placeholder="0"
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          onChange(Number.isFinite(n) ? n : undefined);
        }}
        className={inputCls}
      />
    );
  }
  // Substring operators force a string input.
  if (operator && STRING_ONLY_OPERATORS.has(operator)) {
    return (
      <input
        type="text"
        value={typeof value === "string" ? value : ""}
        placeholder="enter text…"
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    );
  }

  // equals / not_equals (or no operator): a type chooser + matching input, so the
  // author controls whether the value is text, a number, or a boolean.
  const kind: "text" | "number" | "boolean" =
    typeof value === "boolean" ? "boolean" : typeof value === "number" ? "number" : "text";

  const changeKind = (k: "text" | "number" | "boolean") => {
    if (k === "boolean")      onChange(typeof value === "boolean" ? value : true);
    else if (k === "number")  onChange(typeof value === "number" ? value : 0);
    else                      onChange(typeof value === "string" ? value : "");
  };

  return (
    <div className="flex gap-2">
      <select
        value={kind}
        onChange={(e) => changeKind(e.target.value as "text" | "number" | "boolean")}
        className={`${selectCls} max-w-[8rem]`}
        aria-label="Value type"
      >
        <option value="text">Text</option>
        <option value="number">Number</option>
        <option value="boolean">Boolean</option>
      </select>
      {kind === "boolean" ? (
        <select
          value={String(value ?? "true")}
          onChange={(e) => onChange(e.target.value === "true")}
          className={selectCls}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : kind === "number" ? (
        <input
          type="number"
          value={typeof value === "number" ? value : ""}
          placeholder="0"
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            onChange(Number.isFinite(n) ? n : undefined);
          }}
          className={inputCls}
        />
      ) : (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          placeholder="enter value…"
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      )}
    </div>
  );
}

// ── FieldConditionEditor ───────────────────────────────────────────────────────

/**
 * Registry-driven field condition editor.
 *
 * Field picker    — groups all FIELD_REGISTRY entries into <optgroup> sections.
 * Operator picker — constrained to operators valid for the selected field
 *                   (from fieldDef.operators).
 * Value input     — adapts to field kind and operator:
 *                     categorical + equals/not_equals  → <select> from allowedValues
 *                     boolean                          → <select> true / false
 *                     number or ordering operator      → <input type="number">
 *                     in / not_in                      → <input> comma-separated
 *                     nullable_string / other          → <input type="text">
 *                     exists / not_exists              → no value input shown
 */
function FieldConditionEditor({
  field,
  operator,
  value,
  onChange,
}: {
  field:    ConditionField;
  operator: FieldOperator;
  value:    FieldConditionValue | undefined;
  onChange: (field: ConditionField, operator: FieldOperator, value: FieldConditionValue | undefined) => void;
}) {
  const fieldDef       = FIELD_REGISTRY[field as RuleFieldKey];
  const validOperators = fieldDef?.operators ?? (["equals"] as readonly FieldOperator[]);

  // Clamp operator to what the selected field allows
  const effectiveOp: FieldOperator = validOperators.includes(operator)
    ? operator
    : validOperators[0];

  const handleFieldChange = (newField: RuleFieldKey) => {
    const def      = FIELD_REGISTRY[newField];
    const firstOp  = def.operators[0];
    const firstVal = deriveDefaultValue(def, firstOp);
    onChange(newField, firstOp, firstVal);
  };

  const handleOperatorChange = (newOp: FieldOperator) => {
    const newValue = NO_VALUE_OPERATORS.has(newOp)
      ? undefined
      : NO_VALUE_OPERATORS.has(effectiveOp)
        ? deriveDefaultValue(fieldDef, newOp)
        : value;
    onChange(field, newOp, newValue);
  };

  const handleValueChange = (newValue: FieldConditionValue | undefined) => {
    onChange(field, effectiveOp, newValue);
  };

  return (
    <>
      {/* Field picker — a curated "Common" shortlist first, then the full
          categorised list under "All fields". */}
      <Field label="Field">
        <select
          value={field}
          onChange={(e) => handleFieldChange(e.target.value as RuleFieldKey)}
          className={selectCls}
        >
          <optgroup label="Common">
            {COMMON_FIELD_KEYS.map((k) => (
              <option key={`common-${k}`} value={k}>
                {FIELD_REGISTRY[k].label}
              </option>
            ))}
          </optgroup>
          <optgroup label="────────  All fields  ────────" />
          {(Object.entries(FIELD_KEYS_BY_GROUP) as [FieldGroup, readonly RuleFieldKey[]][]).map(
            ([group, keys]) => (
              <optgroup key={group} label={GROUP_LABELS[group]}>
                {keys.map((k) => (
                  <option key={k} value={k}>
                    {FIELD_REGISTRY[k].label}
                  </option>
                ))}
              </optgroup>
            ),
          )}
        </select>
        {fieldDef && (
          <p className="mt-1 text-xs text-neutral-400">{fieldDef.description}</p>
        )}
      </Field>

      {/* Operator picker */}
      <Field label="Operator">
        <select
          value={effectiveOp}
          onChange={(e) => handleOperatorChange(e.target.value as FieldOperator)}
          className={selectCls}
        >
          {validOperators.map((op) => (
            <option key={op} value={op}>
              {OPERATOR_LABELS[op]}
            </option>
          ))}
        </select>
      </Field>

      {/* Value input — hidden for existence operators */}
      {!NO_VALUE_OPERATORS.has(effectiveOp) && (
        <Field
          label="Value"
          hint={
            ARRAY_VALUE_OPERATORS.has(effectiveOp)
              ? "Separate multiple values with commas"
              : undefined
          }
        >
          <FieldValueInput
            fieldDef={fieldDef}
            operator={effectiveOp}
            value={value}
            onChange={handleValueChange}
          />
        </Field>
      )}
    </>
  );
}

// ── FieldValueInput ────────────────────────────────────────────────────────────

/**
 * Adaptive value input component driven entirely by FieldDefinition metadata.
 *
 * The component never needs to know about specific field names or operator
 * semantics beyond what is present in the fieldDef.
 */
function FieldValueInput({
  fieldDef,
  operator,
  value,
  onChange,
}: {
  fieldDef: typeof FIELD_REGISTRY[RuleFieldKey];
  operator: FieldOperator;
  value:    FieldConditionValue | undefined;
  onChange: (v: FieldConditionValue | undefined) => void;
}) {
  // in / not_in — comma-separated text input; value is stored as string[]
  if (ARRAY_VALUE_OPERATORS.has(operator)) {
    const displayValue = Array.isArray(value)
      ? (value as (string | number)[]).join(", ")
      : typeof value === "string" ? value : "";
    return (
      <input
        type="text"
        value={displayValue}
        placeholder="value1, value2, value3"
        onChange={(e) => {
          const arr = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
          onChange(arr.length > 0 ? arr : undefined);
        }}
        className={inputCls}
      />
    );
  }

  // boolean — select true / false
  if (fieldDef.kind === "boolean") {
    return (
      <select
        value={String(value ?? "true")}
        onChange={(e) => onChange(e.target.value === "true")}
        className={selectCls}
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  // numeric ordering operators — number input
  if (fieldDef.kind === "number" || NUMERIC_OPERATORS.has(operator)) {
    return (
      <input
        type="number"
        value={typeof value === "number" ? value : ""}
        placeholder="0"
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          onChange(Number.isFinite(n) ? n : undefined);
        }}
        className={inputCls}
      />
    );
  }

  // categorical with equals / not_equals — select from allowedValues
  if (
    fieldDef.kind === "categorical" &&
    fieldDef.allowedValues &&
    (operator === "equals" || operator === "not_equals")
  ) {
    return (
      <select
        value={typeof value === "string" ? value : (fieldDef.allowedValues[0] ?? "")}
        onChange={(e) => onChange(e.target.value)}
        className={selectCls}
      >
        {fieldDef.allowedValues.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
    );
  }

  // nullable_string and all other cases — text input
  return (
    <input
      type="text"
      value={typeof value === "string" ? value : ""}
      placeholder="enter value…"
      onChange={(e) => onChange(e.target.value !== "" ? e.target.value : undefined)}
      className={inputCls}
    />
  );
}

// ── Derive a sensible default value when the field or operator changes ─────────

function deriveDefaultValue(
  def:      typeof FIELD_REGISTRY[RuleFieldKey],
  operator: FieldOperator,
): FieldConditionValue | undefined {
  if (NO_VALUE_OPERATORS.has(operator))    return undefined;
  if (ARRAY_VALUE_OPERATORS.has(operator)) return def.allowedValues ? [def.allowedValues[0]] : [];
  if (def.kind === "boolean")              return true;
  if (def.kind === "number")               return 0;
  if (def.allowedValues)                   return def.allowedValues[0];
  return "";
}

// ── VariantOptions ─────────────────────────────────────────────────────────────

/**
 * Renders <optgroup> / <option> elements for a slot's variant catalogue entries.
 *
 * Entries are grouped by source ("Platform", "CMS / Tenant", "CMS / Shared").
 * Groups with only one source level that spans all entries skip the <optgroup>
 * wrapper (platform-only catalogue) to keep the select clean.
 */
// ── VariantTargetFields ─────────────────────────────────────────────────────────

const EMAIL_TEMPLATE_LABELS: Record<string, string> = {
  abm_intro:            "ABM intro",
  application_followup: "Application follow-up",
  contact_followup:     "Contact follow-up",
  appointment_followup: "Appointment follow-up",
};

function formatFormKey(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}
function formatEmailKey(key: string): string {
  return EMAIL_TEMPLATE_LABELS[key] ?? key;
}

/**
 * Targeting for a family of tenant-authored variants (forms or emails), grouped
 * under one collapsible sub-section. Forms and emails are categories of keys,
 * not single content slots like hero/proof/cta, so they read as one block. One
 * select per key sets plan.<family>Variants[key]. A key with no authored
 * variants is shown disabled with a hint, so the feature stays discoverable.
 * Collapsed by default unless the rule already targets a variant here.
 */
function VariantTargetFields({
  title,
  groups,
  value,
  onChange,
  formatLabel,
  emptyHint,
  defaultOptionLabel,
}: {
  title:              string;
  groups:             Record<string, VariantEntry[]> | undefined;
  value:              Record<string, string> | undefined;
  onChange:           (next: Record<string, string> | undefined) => void;
  formatLabel:        (key: string) => string;
  emptyHint:          string;
  defaultOptionLabel: string;
}) {
  const keys = groups ? Object.keys(groups) : [];
  const activeCount = keys.filter((k) => !!value?.[k]).length;
  const [open, setOpen] = useState(() => activeCount > 0);
  if (keys.length === 0) return null;

  function setKey(key: string, variantKey: string) {
    const next: Record<string, string> = { ...(value ?? {}) };
    if (variantKey) next[key] = variantKey;
    else delete next[key];
    onChange(Object.keys(next).length > 0 ? next : undefined);
  }

  return (
    <div className="mt-1 border-t border-neutral-200 pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          {title}
          {activeCount > 0 && (
            <span className="ml-2 font-normal normal-case text-neutral-400">
              {activeCount} targeted
            </span>
          )}
        </span>
        <span className="text-[11px] text-neutral-400">{open ? "Hide" : "Edit"}</span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-4">
          {keys.map((key) => {
            const entries = groups?.[key] ?? [];
            const empty   = entries.length === 0;
            return (
              <Field
                key={key}
                label={formatLabel(key)}
                hint={empty ? emptyHint : "Optional. Applied when this rule fires."}
              >
                <select
                  value={value?.[key] ?? ""}
                  onChange={(e) => setKey(key, e.target.value)}
                  className={selectCls}
                  disabled={empty}
                >
                  <option value="">{defaultOptionLabel}</option>
                  {entries.map((entry) => (
                    <option key={entry.key} value={entry.key}>
                      {entry.key}{entry.label && entry.label !== entry.key ? ` (${entry.label})` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── SetContextFields ("Context zetten") ──────────────────────────────────────────

/**
 * Editor for plan.setContext — the context a rule writes when it fires ("regels
 * die context schrijven"). Rows of (key, value, sticky, monotone).
 *
 *   key      — an own flag name or a registry field key to override. Reserved
 *              internal keys ("__…") are never suggested and stripped on input.
 *   value    — scalar (text / number / boolean).
 *   sticky   — persists for the session (default on). Off = request-only.
 *   monotone — write-once: never overwrites an existing value for the key, so a
 *              latch flag does not fall back on a later view.
 *
 * Collapsed by default unless the rule already writes context.
 */
function SetContextFields({
  value,
  onChange,
}: {
  value:    RuleContextWrite[] | undefined;
  onChange: (next: RuleContextWrite[] | undefined) => void;
}) {
  const listId = useId();
  const rows = value ?? [];
  const [open, setOpen] = useState(() => rows.length > 0);

  function commit(next: RuleContextWrite[]) {
    onChange(next.length > 0 ? next : undefined);
  }

  function updateRow(i: number, patch: Partial<RuleContextWrite>) {
    commit(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function removeRow(i: number) {
    commit(rows.filter((_, idx) => idx !== i));
  }

  function addRow() {
    setOpen(true);
    commit([...rows, { key: "", value: true, sticky: true }]);
  }

  return (
    <div className="mt-1 border-t border-neutral-200 pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Context zetten
          {rows.length > 0 && (
            <span className="ml-2 font-normal normal-case text-neutral-400">
              {rows.length} {rows.length === 1 ? "write" : "writes"}
            </span>
          )}
        </span>
        <span className="text-[11px] text-neutral-400">{open ? "Hide" : "Edit"}</span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-xs text-neutral-400">
            Sets context when this rule fires — an own flag or an override of a
            derived field. Overrides bypass the normal derivation (advanced).
          </p>

          {rows.map((row, i) => {
            const isOverride = OVERRIDE_KEY_SUGGESTIONS.includes(row.key);
            const fieldDef   = isOverride ? FIELD_REGISTRY[row.key as RuleFieldKey] : undefined;
            return (
              <div key={i} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    Write {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="text-xs font-medium text-neutral-400 hover:text-red-600 transition-colors"
                  >
                    Remove
                  </button>
                </div>

                <Field
                  label="Key"
                  hint={isOverride ? undefined : "Own flag name. Internal keys (__) are reserved."}
                >
                  <input
                    type="text"
                    value={row.key}
                    list={listId}
                    placeholder="gericht_binnengekomen"
                    onChange={(e) => {
                      const key = sanitizeContextKey(e.target.value);
                      const def = OVERRIDE_KEY_SUGGESTIONS.includes(key)
                        ? FIELD_REGISTRY[key as RuleFieldKey]
                        : undefined;
                      const patch: Partial<RuleContextWrite> = { key };
                      // When the key becomes a registry override, seed a value that
                      // fits the field kind if the current one doesn't (avoids a
                      // boolean landing on a categorical field like funnelStage).
                      if (def) {
                        const v = row.value;
                        const fits =
                          def.kind === "number"      ? typeof v === "number" :
                          def.kind === "boolean"     ? typeof v === "boolean" :
                          def.kind === "categorical" ? typeof v === "string" && (!def.allowedValues || def.allowedValues.includes(v)) :
                          typeof v === "string";
                        if (!fits) patch.value = deriveDefaultValue(def, "equals") as string | number | boolean;
                      }
                      updateRow(i, patch);
                    }}
                    className={inputCls}
                  />
                </Field>

                {/* Override warning — writing a registry field bypasses its derivation. */}
                {fieldDef && (
                  <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <span aria-hidden className="mt-px">⚠</span>
                    <span>
                      Override of derived field <span className="font-mono font-semibold">{row.key}</span> ({fieldDef.label}).
                      This bypasses the normal derivation for the session — advanced use only.
                    </span>
                  </div>
                )}

                <Field label="Value">
                  {fieldDef ? (
                    // Registry override — drive the widget off the field kind so a
                    // fixed-value field (e.g. funnelStage) becomes an allowedValues
                    // dropdown and a boolean/number gets the right input.
                    <FieldValueInput
                      fieldDef={fieldDef}
                      operator="equals"
                      value={row.value}
                      onChange={(v) => {
                        const scalar = Array.isArray(v) ? v[0] : v;
                        updateRow(i, { value: (scalar ?? "") as string | number | boolean });
                      }}
                    />
                  ) : (
                    <ScalarValueInput
                      value={row.value}
                      onChange={(v) => updateRow(i, { value: v ?? "" })}
                    />
                  )}
                </Field>

                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                    <input
                      type="checkbox"
                      checked={row.sticky !== false}
                      onChange={(e) => updateRow(i, { sticky: e.target.checked })}
                    />
                    Sticky <span className="text-neutral-400">(persists for the session)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-neutral-600">
                    <input
                      type="checkbox"
                      checked={row.monotone === true}
                      onChange={(e) => updateRow(i, { monotone: e.target.checked })}
                    />
                    Monotone <span className="text-neutral-400">(write-once, never falls back)</span>
                  </label>
                </div>
              </div>
            );
          })}

          <datalist id={listId}>
            {OVERRIDE_KEY_SUGGESTIONS.map((k) => (
              <option key={k} value={k} />
            ))}
          </datalist>

          <button
            type="button"
            onClick={addRow}
            className="self-start rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:border-brand-400 hover:text-brand-600 transition-colors"
          >
            + Add context write
          </button>
        </div>
      )}
    </div>
  );
}

function VariantOptions({ entries }: { entries: VariantEntry[] }) {
  // Determine the distinct source values in the order they appear.
  const sources: VariantSource[] = [];
  for (const e of entries) {
    if (!sources.includes(e.source)) sources.push(e.source);
  }

  // Single source → flat list (no optgroups needed).
  if (sources.length <= 1) {
    return (
      <>
        {entries.map((e) => (
          <option key={e.key} value={e.key}>
            {e.key} — {e.label}
          </option>
        ))}
      </>
    );
  }

  // Multiple sources → group by source.
  return (
    <>
      {sources.map((src) => {
        const group = entries.filter((e) => e.source === src);
        return (
          <optgroup key={src} label={SOURCE_LABELS[src]}>
            {group.map((e) => (
              <option key={e.key} value={e.key}>
                {e.key} — {e.label}
              </option>
            ))}
          </optgroup>
        );
      })}
    </>
  );
}

// ── PackBadge ──────────────────────────────────────────────────────────────────

const PACK_BADGE_COLORS: Record<string, string> = {
  purple:  "bg-purple-50 text-purple-700 border-purple-200",
  blue:    "bg-blue-50   text-blue-700   border-blue-200",
  slate:   "bg-slate-100 text-slate-600  border-slate-300",
  green:   "bg-green-50  text-green-700  border-green-200",
  amber:   "bg-amber-50  text-amber-700  border-amber-200",
  neutral: "bg-neutral-100 text-neutral-600 border-neutral-300",
};

function PackBadge({ packId }: { packId: string }) {
  const pack  = RULE_PACK_REGISTRY[packId];
  if (!pack) return null;
  const color = PACK_BADGE_COLORS[pack.color ?? "neutral"] ?? PACK_BADGE_COLORS.neutral;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${color}`}
      title={pack.description}
    >
      {pack.label}
    </span>
  );
}

// ── TierChip ───────────────────────────────────────────────────────────────────

const TIER_CHIP_COLORS: Record<string, string> = {
  red:     "bg-red-50    text-red-700    border-red-200",
  orange:  "bg-orange-50 text-orange-700 border-orange-200",
  blue:    "bg-blue-50   text-blue-700   border-blue-200",
  neutral: "bg-neutral-100 text-neutral-500 border-neutral-200",
};

function TierChip({
  priority,
  precedenceLevel,
}: {
  priority:         number;
  precedenceLevel?: PrecedenceLevel;
}) {
  const level = precedenceLevel ?? inferPrecedenceLevel(priority);
  if (!level) return null;
  const meta  = PRECEDENCE_TIERS[level];
  const color = TIER_CHIP_COLORS[meta.color] ?? TIER_CHIP_COLORS.neutral;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${color}`}
      title={meta.description}
    >
      {meta.label}
    </span>
  );
}

// ── ContextLibraryPanel ────────────────────────────────────────────────────────

/**
 * Read-only reference panel listing all registered context definitions.
 * Shows each context's label, description, ID, and tags.
 */
function ContextLibraryPanel({ onClose }: { onClose: () => void }) {
  const TAG_COLORS: Record<string, string> = {
    traffic:    "bg-blue-50   text-blue-700   border-blue-200",
    source:     "bg-sky-50    text-sky-700    border-sky-200",
    paid:       "bg-amber-50  text-amber-700  border-amber-200",
    visitor:    "bg-violet-50 text-violet-700 border-violet-200",
    history:    "bg-purple-50 text-purple-700 border-purple-200",
    engagement: "bg-green-50  text-green-700  border-green-200",
    intent:     "bg-orange-50 text-orange-700 border-orange-200",
    device:     "bg-slate-100 text-slate-600  border-slate-300",
    default:    "bg-neutral-100 text-neutral-500 border-neutral-200",
  };

  return (
    <div className="mb-4 rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-neutral-800">Context Library</h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Reusable named predicates — reference them in rules with a &ldquo;Context condition&rdquo;.
            Evaluated once per request and cached.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors shrink-0"
          aria-label="Close context library"
        >
          Close
        </button>
      </div>

      {/* Context grid */}
      <div className="grid grid-cols-1 gap-px bg-neutral-100 md:grid-cols-2 lg:grid-cols-3">
        {ALL_CONTEXT_IDS.map((id) => {
          const ctx = CONTEXT_REGISTRY[id];
          if (!ctx) return null;
          return (
            <div key={id} className="bg-white px-4 py-3 flex flex-col gap-1.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-neutral-800">{ctx.label}</p>
                <code className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500">
                  {id}
                </code>
              </div>
              <p className="text-xs text-neutral-500 leading-relaxed">{ctx.description}</p>
              {ctx.tags && ctx.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {ctx.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${TAG_COLORS[tag] ?? TAG_COLORS.default}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── PlanBadge ──────────────────────────────────────────────────────────────────

type PlanSlot = "hero" | "proof" | "cta" | "feature" | "conversion";

const BADGE_COLORS: Record<PlanSlot, string> = {
  hero:       "bg-violet-50 text-violet-700 border-violet-200",
  proof:      "bg-sky-50    text-sky-700    border-sky-200",
  cta:        "bg-amber-50  text-amber-700  border-amber-200",
  feature:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  conversion: "bg-rose-50   text-rose-700   border-rose-200",
};

function PlanBadge({ block, value }: { block: PlanSlot; value: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs ${BADGE_COLORS[block]}`}
      title={`${block}: ${value}`}
    >
      {value}
    </span>
  );
}

// ── Primitives ─────────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label:    string;
  hint?:    string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-neutral-700">
        {label}
      </label>
      <div id={id}>{children}</div>
      {hint && <p className="text-xs text-neutral-400">{hint}</p>}
    </div>
  );
}

function IconButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label:    string;
  icon:     React.ReactNode;
  onClick:  () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {icon}
    </button>
  );
}

// ── Shared class strings ───────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

const selectCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

// ── SVG icons ──────────────────────────────────────────────────────────────────

function ArrowUpIcon() {
  return (
    <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M8 12V4M4 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M8 4v8m4-3-4 4-4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
