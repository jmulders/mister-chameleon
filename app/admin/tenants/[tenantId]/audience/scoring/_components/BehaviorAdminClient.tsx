"use client";

/**
 * Behavior Admin Client
 *
 * Full client-side CRUD UI for the behavioral personalization system.
 * Organised into tabs: Overview · Scoring Rules · Sequences · Decay Profiles.
 *
 * ─── Key handling (scoring rules) ────────────────────────────────────────────
 *
 *   `key` is a machine-readable slug stored alongside the human-readable `name`.
 *   It is optional in the DB (nullable) but we always try to provide one:
 *
 *   Create:  auto-generated from the rule name via `slugify()` if the user
 *            leaves the Key field empty.  The field is pre-filled live as the
 *            user types the name so they can accept or override it.
 *
 *   Edit:    the existing key is loaded into the form state and kept unchanged
 *            unless the user explicitly edits it.  We never send null — if the
 *            existing DB row has no key, the edit also auto-generates one.
 */

import React, { useState, useTransition } from "react";
import type {
  ScoringRule,
  SequencePattern,
  DecayProfile,
} from "@/lib/journey/types";
import type { ScoringRuleInput, SequencePatternInput } from "../actions";
import { checkScoringRuleDependenciesAction } from "../actions";
import { SEED_SCORING_RULES }     from "@/behavior-scoring/seed";
// Count of seed sequences — must stay in sync with the inline array in actions.ts
const SEED_SEQUENCE_COUNT = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convert an arbitrary string into a URL/DB-safe slug.
 * e.g. "Pricing Page View" → "pricing_page_view"
 */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface BehaviorAdminClientProps {
  tenantId:                   string;
  /** Optional: link to the Journey Intelligence page. Injected by the page. */
  journeyHref?:               string;
  initialScoringRules:        ScoringRule[];
  initialSequencePatterns:    SequencePattern[];
  decayProfiles:              DecayProfile[];
  saveScoringRuleAction:      (data: ScoringRuleInput) => Promise<{ ok: boolean; error?: string }>;
  deleteScoringRuleAction:    (ruleId: string) => Promise<{ ok: boolean; error?: string }>;
  saveSequencePatternAction:  (data: SequencePatternInput) => Promise<{ ok: boolean; error?: string }>;
  deleteSequencePatternAction:(patternId: string) => Promise<{ ok: boolean; error?: string }>;
  /** Seeds preset scoring rules for this tenant. */
  seedScoringRulesAction?:      () => Promise<{ ok: true; created: number; skipped: number } | { ok: false; error: string }>;
  /** Seeds preset sequence patterns for this tenant. */
  seedSequencePatternsAction?:  () => Promise<{ ok: true; created: number; skipped: number } | { ok: false; error: string }>;
}

// ── Tab types ─────────────────────────────────────────────────────────────────

type AdminTab = "overview" | "scoring" | "sequences" | "decay";

// ── Shared UI atoms ───────────────────────────────────────────────────────────

function TabBar({ active, onChange }: { active: AdminTab; onChange: (t: AdminTab) => void }) {
  const tabs: Array<{ id: AdminTab; label: string }> = [
    { id: "overview",  label: "Overview" },
    { id: "scoring",   label: "Scoring Rules" },
    { id: "sequences", label: "Sequences" },
    { id: "decay",     label: "Decay Profiles" },
  ];
  return (
    <div className="flex gap-1 border-b border-neutral-200 mb-6">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={[
            "px-4 py-2 text-sm font-medium rounded-t transition-colors",
            active === t.id
              ? "border border-b-white border-neutral-200 -mb-px text-neutral-900 bg-white"
              : "text-neutral-500 hover:text-neutral-700",
          ].join(" ")}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function SectionCard({ title, description, children }: {
  title: string; description?: string; children: React.ReactNode;
}) {
  return (
    <div className="border border-neutral-200 rounded-lg overflow-hidden mb-6">
      <div className="px-5 py-4 bg-neutral-50 border-b border-neutral-200">
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-neutral-500">{description}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function ActionBar({ onAdd, label }: { onAdd: () => void; label: string }) {
  return (
    <div className="flex justify-end mb-4">
      <button
        onClick={onAdd}
        className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
      >
        + {label}
      </button>
    </div>
  );
}

function StatusMsg({ msg, isError }: { msg: string; isError?: boolean }) {
  return (
    <div className={`px-3 py-2 rounded text-sm mb-4 ${
      isError ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-green-50 text-green-700 border border-green-200"
    }`}>
      {msg}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BehaviorAdminClient({
  tenantId,
  initialScoringRules,
  initialSequencePatterns,
  decayProfiles,
  saveScoringRuleAction,
  deleteScoringRuleAction,
  saveSequencePatternAction,
  deleteSequencePatternAction,
  seedScoringRulesAction,
  seedSequencePatternsAction,
  journeyHref,
}: BehaviorAdminClientProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  return (
    <div>
      <TabBar active={activeTab} onChange={setActiveTab} />

      {activeTab === "overview" && (
        <OverviewTab
          scoringRulesCount={initialScoringRules.length}
          sequencePatternsCount={initialSequencePatterns.length}
          decayProfiles={decayProfiles}
          journeyHref={journeyHref}
        />
      )}
      {activeTab === "scoring" && (
        <ScoringRulesTab
          tenantId={tenantId}
          initial={initialScoringRules}
          decayProfiles={decayProfiles}
          saveAction={saveScoringRuleAction}
          deleteAction={deleteScoringRuleAction}
          seedAction={seedScoringRulesAction}
        />
      )}
      {activeTab === "sequences" && (
        <SequencePatternsTab
          tenantId={tenantId}
          initial={initialSequencePatterns}
          saveAction={saveSequencePatternAction}
          deleteAction={deleteSequencePatternAction}
          seedAction={seedSequencePatternsAction}
        />
      )}
      {activeTab === "decay" && (
        <DecayProfilesTab decayProfiles={decayProfiles} />
      )}
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({
  scoringRulesCount,
  sequencePatternsCount,
  decayProfiles,
  journeyHref,
}: {
  scoringRulesCount: number;
  sequencePatternsCount: number;
  decayProfiles: DecayProfile[];
  journeyHref?: string;
}) {
  const defaultProfile = decayProfiles.find((p) => p.slug === "standard") ?? decayProfiles[0];

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Scoring Rules",     value: scoringRulesCount,    colour: "bg-amber-50 border-amber-200 text-amber-700" },
          { label: "Sequence Patterns", value: sequencePatternsCount, colour: "bg-blue-50 border-blue-200 text-blue-700" },
          { label: "Decay Profiles",    value: decayProfiles.length,  colour: "bg-purple-50 border-purple-200 text-purple-700" },
        ].map((stat) => (
          <div key={stat.label} className={`border rounded-lg p-4 ${stat.colour}`}>
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-sm mt-0.5 opacity-80">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Journey Intelligence link */}
      {journeyHref && (
        <a
          href={journeyHref}
          className="flex items-center justify-between border border-indigo-200 bg-indigo-50 rounded-lg px-5 py-4 hover:bg-indigo-100 transition-colors group"
        >
          <div>
            <div className="font-semibold text-indigo-900 group-hover:underline">Journey Intelligence →</div>
            <div className="text-sm text-indigo-600 mt-0.5">
              Visualize any visitor&apos;s behavioral profile (stage, confidence, friction, and why they&apos;re seeing what they see).
            </div>
          </div>
          <div className="text-2xl ml-4 shrink-0">🔍</div>
        </a>
      )}

      {/* How it works */}
      <SectionCard title="How Behavioral Scoring Works">
        <div className="space-y-4 text-sm text-neutral-600 leading-relaxed">
          <div>
            <span className="font-semibold text-neutral-800">1. Event Recording</span>
            <p className="mt-1">
              Every time a visitor loads a page, clicks a CTA, starts or submits a form,
              or downloads something, a journey event is recorded.  Events carry the page path,
              category, UTM attribution, and any additional metadata.
            </p>
          </div>
          <div>
            <span className="font-semibold text-neutral-800">2. Scoring Rules</span>
            <p className="mt-1">
              Scoring rules assign intent points to specific event types.  For example,
              viewing the pricing page might be worth 40 points.  Each rule uses a decay
              profile that controls how quickly old events stop contributing. A form submit
              stays relevant for weeks, while a CTA click might fade quickly.
            </p>
          </div>
          <div>
            <span className="font-semibold text-neutral-800">3. Sequence Detection</span>
            <p className="mt-1">
              Sequences detect ordered behavioral patterns, e.g. "visited About then Pricing
              within 2 hours".  A fully matched sequence adds a bonus score and is recorded
              against the visitor's state.
            </p>
          </div>
          <div>
            <span className="font-semibold text-neutral-800">4. Funnel Stage</span>
            <p className="mt-1">
              The visitor's current funnel stage is derived from all signals combined:
              intent score, engagement depth, page visits, form interactions, and matched sequences.
              Stages: <code className="bg-neutral-100 px-1 rounded">awareness</code> →{" "}
              <code className="bg-neutral-100 px-1 rounded">consideration</code> →{" "}
              <code className="bg-neutral-100 px-1 rounded">intent</code> →{" "}
              <code className="bg-neutral-100 px-1 rounded">high_intent</code> →{" "}
              <code className="bg-neutral-100 px-1 rounded">customer</code>.
            </p>
          </div>
          <div>
            <span className="font-semibold text-neutral-800">5. Rules Engine Integration</span>
            <p className="mt-1">
              These signals are available as rule conditions.  You can target visitors by
              funnel stage, intent score, visited pages, or matched sequences, and serve
              different heroes, CTAs, or themes based on where they are in the journey.
            </p>
          </div>
        </div>
      </SectionCard>

      {defaultProfile && (
        <SectionCard title="Default Decay Profile" description="Standard decay weights applied to most scoring rules.">
          <DecayProfileVisual profile={defaultProfile} />
        </SectionCard>
      )}
    </div>
  );
}

// ── Scoring rules tab ─────────────────────────────────────────────────────────

// ── Scoring dependency confirmation banner ────────────────────────────────────

interface ScoringDepConfirmBannerProps {
  ruleLabel:   string;
  action:      "deactivate" | "delete";
  ruleLabels:  string[];
  onConfirm:   () => void;
  onCancel:    () => void;
  confirming:  boolean;
}

function ScoringDepConfirmBanner({
  ruleLabel, action, ruleLabels, onConfirm, onCancel, confirming,
}: ScoringDepConfirmBannerProps) {
  const verb = action === "delete" ? "Deleting" : "Deactivating";
  const proceed = action === "delete" ? "Delete anyway" : "Deactivate anyway";
  const proceedPending = action === "delete" ? "Deleting…" : "Deactivating…";

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-5 py-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-amber-500 shrink-0">⚠</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900">
            {ruleLabels.length === 1
              ? "1 rule uses behavioral scoring fields"
              : `${ruleLabels.length} rules use behavioral scoring fields`}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            {verb} <strong>{ruleLabel}</strong> may reduce intent scores or funnel-stage values,
            causing these rules to match less often or stop firing entirely.
          </p>
          <ul className="mt-2 space-y-0.5">
            {ruleLabels.map((label, i) => (
              <li key={i} className="text-xs text-amber-700 font-medium">• {label}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={confirming}
          className="px-3 py-1.5 text-xs font-medium rounded border border-amber-300 bg-white text-amber-800 hover:bg-amber-50 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirming}
          className="px-3 py-1.5 text-xs font-medium rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          {confirming ? proceedPending : proceed}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const EVENT_TYPE_OPTIONS = [
  { value: "page_view",   label: "Page View" },
  { value: "cta_click",  label: "CTA Click" },
  { value: "form_start", label: "Form Start" },
  { value: "form_submit", label: "Form Submit" },
  { value: "download",   label: "Download" },
];

interface ScoringRuleFormState {
  id?:          string;
  /** Machine-readable slug — auto-generated from label, but editable */
  key:          string;
  label:        string;
  eventType:    string;
  eventValue:   string;
  score:        number;
  decayProfile: string;
  /** Tracks whether key was auto-set from label so typing the label still updates it */
  keyAutoSync:  boolean;
}

function emptyScoringRule(): ScoringRuleFormState {
  return {
    key: "", label: "",
    eventType: "page_view", eventValue: "",
    score: 20, decayProfile: "standard",
    keyAutoSync: true,
  };
}

function ScoringRulesTab({
  tenantId,
  initial,
  decayProfiles,
  saveAction,
  deleteAction,
  seedAction,
}: {
  tenantId:    string;
  initial:     ScoringRule[];
  decayProfiles: DecayProfile[];
  saveAction:  (data: ScoringRuleInput) => Promise<{ ok: boolean; error?: string }>;
  deleteAction:(id: string) => Promise<{ ok: boolean; error?: string }>;
  seedAction?: () => Promise<{ ok: true; created: number; skipped: number } | { ok: false; error: string }>;
}) {
  const [rules, setRules]       = useState<ScoringRule[]>(initial);
  const [editing, setEditing]   = useState<ScoringRuleFormState | null>(null);
  const [status, setStatus]     = useState<{ msg: string; isError: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Dependency confirmation ─────────────────────────────────────────────────
  const [pendingDepCheck, setPendingDepCheck] = useState<{
    ruleId:     string;
    ruleLabel:  string;
    action:     "deactivate" | "delete";
    ruleLabels: string[];
  } | null>(null);
  const [checkingRuleId, setCheckingRuleId] = useState<string | null>(null);
  const [depConfirming,  setDepConfirming]  = useState(false);

  // ── Bulk selection ──────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulkTransition] = useTransition();

  const toggleSelect = (id: string) =>
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const selectAll = () => setSelected(new Set(rules.map((r) => r.id)));
  const clearSelection = () => setSelected(new Set());

  function bulkDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} rule${ids.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
    startBulkTransition(async () => {
      const results = await Promise.all(ids.map((id) => deleteAction(id)));
      const failed = results.filter((r) => !r.ok).length;
      setRules((prev) => prev.filter((r) => !ids.includes(r.id)));
      setSelected(new Set());
      setStatus(failed > 0 ? { msg: `${failed} rule(s) failed to delete.`, isError: true } : { msg: "Deleted.", isError: false });
    });
  }

  function bulkActivate(ids: string[]) {
    const toActivate = rules.filter((r) => ids.includes(r.id) && r.is_active === false);
    if (toActivate.length === 0) { setSelected(new Set()); return; }
    startBulkTransition(async () => {
      const results = await Promise.all(
        toActivate.map((rule) => saveAction({
          id: rule.id, tenantId, key: rule.key ?? undefined,
          label: rule.label, eventType: rule.event_type,
          eventValue: rule.event_value ?? null, score: rule.score,
          decayProfile: rule.decay_profile, isActive: true, priority: rule.priority,
        })),
      );
      const failed = results.filter((r) => !r.ok).length;
      setRules((prev) => prev.map((r) => ids.includes(r.id) ? { ...r, is_active: true } : r));
      setSelected(new Set());
      setStatus(failed > 0 ? { msg: `${failed} rule(s) failed to enable.`, isError: true } : { msg: `${toActivate.length} rule${toActivate.length === 1 ? "" : "s"} enabled.`, isError: false });
    });
  }

  function bulkDeactivateSelected(ids: string[]) {
    const toDeactivate = rules.filter((r) => ids.includes(r.id) && r.is_active !== false);
    if (toDeactivate.length === 0) { setSelected(new Set()); return; }
    startBulkTransition(async () => {
      const results = await Promise.all(
        toDeactivate.map((rule) => saveAction({
          id: rule.id, tenantId, key: rule.key ?? undefined,
          label: rule.label, eventType: rule.event_type,
          eventValue: rule.event_value ?? null, score: rule.score,
          decayProfile: rule.decay_profile, isActive: false, priority: rule.priority,
        })),
      );
      const failed = results.filter((r) => !r.ok).length;
      setRules((prev) => prev.map((r) => ids.includes(r.id) ? { ...r, is_active: false } : r));
      setSelected(new Set());
      setStatus(failed > 0 ? { msg: `${failed} rule(s) failed to deactivate.`, isError: true } : { msg: `${toDeactivate.length} rule${toDeactivate.length === 1 ? "" : "s"} deactivated.`, isError: false });
    });
  }

  // ── Seed state ──────────────────────────────────────────────────────────────
  const [seedResult, setSeedResult] = useState<{ created: number; skipped: number } | null>(null);
  const [isSeedPending, startSeedTransition] = useTransition();

  function handleSeed() {
    if (!seedAction) return;
    startSeedTransition(async () => {
      const res = await seedAction();
      if (res.ok) {
        setSeedResult({ created: res.created, skipped: res.skipped });
        if (res.created > 0) {
          // Refresh rules list by re-fetching — trigger a page reload via status
          setStatus({ msg: `✓ Seeded ${res.created} rule${res.created === 1 ? "" : "s"}.${res.skipped > 0 ? ` ${res.skipped} already existed and were skipped.` : ""}`, isError: false });
          // Re-fetch by forcing a reload through the parent
          window.location.reload();
        } else {
          setStatus({ msg: "All preset rules are already installed.", isError: false });
        }
      } else {
        setStatus({ msg: res.error ?? "Seed failed.", isError: true });
      }
    });
  }

  function openNew() {
    setEditing(emptyScoringRule());
    setStatus(null);
  }

  function openEdit(rule: ScoringRule) {
    setEditing({
      id:          rule.id,
      // Preserve the existing key; if the DB row has no key, generate one now
      key:         rule.key ?? slugify(rule.label),
      label:       rule.label,
      eventType:   rule.event_type,
      eventValue:  rule.event_value ?? "",
      score:       rule.score,
      decayProfile:rule.decay_profile,
      // An existing rule always has its key locked — don't auto-sync on edit
      keyAutoSync: false,
    });
    setStatus(null);
  }

  function cancelEdit() { setEditing(null); }

  /** Update label and, when keyAutoSync is active, keep key in sync. */
  function handleLabelChange(label: string) {
    if (!editing) return;
    setEditing({
      ...editing,
      label,
      key: editing.keyAutoSync ? slugify(label) : editing.key,
    });
  }

  /** Once the user manually edits the key, stop auto-syncing it from name. */
  function handleKeyChange(key: string) {
    if (!editing) return;
    setEditing({ ...editing, key: key.toLowerCase().replace(/[^a-z0-9_]/g, ""), keyAutoSync: false });
  }

  function handleSave() {
    if (!editing) return;
    // Always ensure a non-empty key — fall back to slugifying the label
    const resolvedKey = editing.key.trim() || slugify(editing.label) || "rule";
    startTransition(async () => {
      const res = await saveAction({
        id:           editing.id,
        tenantId,
        key:          resolvedKey,
        label:        editing.label,
        eventType:    editing.eventType,
        eventValue:   editing.eventValue || null,
        score:        editing.score,
        decayProfile: editing.decayProfile,
      });
      if (res.ok) {
        setEditing(null);
        setStatus({ msg: "Saved successfully.", isError: false });
      } else {
        setStatus({ msg: res.error ?? "Save failed.", isError: true });
      }
    });
  }

  /** Runs dep check then deletes. Shows confirmation banner if any journey rules found. */
  async function handleDelete(rule: ScoringRule) {
    setCheckingRuleId(rule.id);
    let depLabels: string[] = [];
    try {
      const check = await checkScoringRuleDependenciesAction(tenantId);
      if (check.ok && check.dependentRules.length > 0) {
        depLabels = check.dependentRules.map((r) => r.label);
      }
    } catch {
      // If check fails, proceed without blocking.
    } finally {
      setCheckingRuleId(null);
    }

    if (depLabels.length > 0) {
      setPendingDepCheck({ ruleId: rule.id, ruleLabel: rule.label, action: "delete", ruleLabels: depLabels });
      return;
    }

    // No deps — confirm + delete immediately.
    if (!confirm("Delete this scoring rule?")) return;
    doDelete(rule.id);
  }

  function doDelete(id: string) {
    startTransition(async () => {
      const res = await deleteAction(id);
      if (res.ok) {
        setRules((prev) => prev.filter((r) => r.id !== id));
        setStatus({ msg: "Deleted.", isError: false });
      } else {
        setStatus({ msg: res.error ?? "Delete failed.", isError: true });
      }
    });
  }

  /** Runs dep check then deactivates (sets is_active=false without deleting). */
  async function handleDeactivate(rule: ScoringRule) {
    setCheckingRuleId(rule.id);
    let depLabels: string[] = [];
    try {
      const check = await checkScoringRuleDependenciesAction(tenantId);
      if (check.ok && check.dependentRules.length > 0) {
        depLabels = check.dependentRules.map((r) => r.label);
      }
    } catch {
      // If check fails, proceed.
    } finally {
      setCheckingRuleId(null);
    }

    if (depLabels.length > 0) {
      setPendingDepCheck({ ruleId: rule.id, ruleLabel: rule.label, action: "deactivate", ruleLabels: depLabels });
      return;
    }

    doDeactivate(rule);
  }

  function doDeactivate(rule: ScoringRule) {
    startTransition(async () => {
      const res = await saveAction({
        id:           rule.id,
        tenantId,
        key:          rule.key ?? undefined,
        label:        rule.label,
        eventType:    rule.event_type,
        eventValue:   rule.event_value ?? null,
        score:        rule.score,
        decayProfile: rule.decay_profile,
        isActive:     false,
        priority:     rule.priority,
      });
      if (res.ok) {
        setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, is_active: false } : r));
        setStatus({ msg: "Rule deactivated.", isError: false });
      } else {
        setStatus({ msg: res.error ?? "Deactivate failed.", isError: true });
      }
    });
  }

  /** Called when the admin confirms proceeding despite dep warning. */
  async function handleDepConfirm() {
    if (!pendingDepCheck) return;
    setDepConfirming(true);
    try {
      const { ruleId, action } = pendingDepCheck;
      const rule = rules.find((r) => r.id === ruleId);
      if (action === "delete") {
        if (!confirm("Delete this scoring rule?")) { setPendingDepCheck(null); return; }
        doDelete(ruleId);
      } else if (action === "deactivate" && rule) {
        doDeactivate(rule);
      }
    } finally {
      setDepConfirming(false);
      setPendingDepCheck(null);
    }
  }

  function handleEnable(rule: ScoringRule) {
    startTransition(async () => {
      const res = await saveAction({
        id:           rule.id,
        tenantId,
        key:          rule.key ?? undefined,
        label:        rule.label,
        eventType:    rule.event_type,
        eventValue:   rule.event_value ?? null,
        score:        rule.score,
        decayProfile: rule.decay_profile,
        isActive:     true,
        priority:     rule.priority,
      });
      if (res.ok) {
        setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, is_active: true } : r));
        setStatus({ msg: "Rule enabled.", isError: false });
      } else {
        setStatus({ msg: res.error ?? "Enable failed.", isError: true });
      }
    });
  }

  return (
    <div>
      <p className="text-sm text-neutral-500 mb-4">
        Define which events contribute to a visitor&apos;s intent score, and by how much.
        Scores are multiplied by the decay profile weight based on how recent the event was.
      </p>

      {/* Dependency confirmation banner */}
      {pendingDepCheck && (
        <ScoringDepConfirmBanner
          ruleLabel={pendingDepCheck.ruleLabel}
          action={pendingDepCheck.action}
          ruleLabels={pendingDepCheck.ruleLabels}
          onConfirm={handleDepConfirm}
          onCancel={() => setPendingDepCheck(null)}
          confirming={depConfirming}
        />
      )}

      {status && <StatusMsg msg={status.msg} isError={status.isError} />}

      {/* Seed panel — shown when no rules exist, or as compact prompt */}
      {seedAction && rules.length === 0 && (
        <div className="mb-6 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 px-6 py-6">
          <p className="text-sm font-semibold text-indigo-900 mb-1">Start with preset scoring rules</p>
          <p className="text-xs text-indigo-700 mb-4 max-w-lg">
            Install {SEED_SCORING_RULES.length} production-ready rules covering pricing page views,
            form submissions, CTA clicks, engagement signals, and friction detection.
          </p>
          <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1 max-w-md">
            {SEED_SCORING_RULES.slice(0, 8).map((r) => (
              <div key={r.key} className="flex items-center justify-between text-xs text-indigo-800">
                <span className="truncate">{r.label}</span>
                <span className={`ml-2 font-bold shrink-0 ${r.score < 0 ? "text-red-500" : "text-amber-600"}`}>
                  {r.score > 0 ? "+" : ""}{r.score}
                </span>
              </div>
            ))}
            {SEED_SCORING_RULES.length > 8 && (
              <p className="text-xs text-indigo-500 col-span-2 mt-1">
                + {SEED_SCORING_RULES.length - 8} more rules…
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleSeed}
            disabled={isSeedPending}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isSeedPending ? "Installing…" : `Install ${SEED_SCORING_RULES.length} preset rules`}
          </button>
        </div>
      )}

      {seedAction && rules.length > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2.5">
          <p className="text-xs text-neutral-500">
            {SEED_SCORING_RULES.length} preset rules available
          </p>
          <button
            type="button"
            onClick={handleSeed}
            disabled={isSeedPending}
            className="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50"
          >
            {isSeedPending ? "Installing…" : "Seed missing presets"}
          </button>
        </div>
      )}

      <ActionBar onAdd={openNew} label="Add Rule" />

      {editing && (
        <SectionCard title={editing.id ? "Edit Scoring Rule" : "New Scoring Rule"}>
          <div className="grid grid-cols-2 gap-4">
            <LabelInput
              label="Rule Name"
              value={editing.label}
              onChange={handleLabelChange}
              placeholder="e.g. Pricing page view"
            />
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Key
                {editing.keyAutoSync && (
                  <span className="ml-1 text-neutral-400 font-normal">(auto)</span>
                )}
              </label>
              <input
                type="text"
                value={editing.key}
                onChange={(e) => handleKeyChange(e.target.value)}
                placeholder="e.g. pricing_page_view"
                className="w-full border border-neutral-200 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="mt-0.5 text-xs text-neutral-400">
                Machine-readable identifier (auto-generated from name).
              </p>
            </div>
            <SelectInput
              label="Event Type"
              value={editing.eventType}
              options={EVENT_TYPE_OPTIONS}
              onChange={(v) => setEditing({ ...editing, eventType: v })}
            />
            <LabelInput
              label="Event Value (optional)"
              value={editing.eventValue}
              onChange={(v) => setEditing({ ...editing, eventValue: v })}
              placeholder="e.g. /pricing, or leave blank to match any"
            />
            <NumberInput
              label="Score"
              value={editing.score}
              onChange={(v) => setEditing({ ...editing, score: v })}
              min={0}
              max={200}
              hint="Points added before decay is applied (0-200)"
            />
            <SelectInput
              label="Decay Profile"
              value={editing.decayProfile}
              options={decayProfiles.map((p) => ({ value: p.slug, label: p.label }))}
              onChange={(v) => setEditing({ ...editing, decayProfile: v })}
            />
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleSave}
              disabled={isPending || !editing.label || !editing.eventType}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Saving…" : "Save Rule"}
            </button>
            <button
              onClick={cancelEdit}
              className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              Cancel
            </button>
          </div>
        </SectionCard>
      )}

      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5">
          <span className="text-xs font-semibold text-indigo-700">
            {selected.size} of {rules.length} selected
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => bulkActivate([...selected])}
              disabled={bulkPending}
              className="inline-flex items-center gap-1 rounded border border-green-300 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors"
            >
              Enable
            </button>
            <button
              type="button"
              onClick={() => bulkDeactivateSelected([...selected])}
              disabled={bulkPending}
              className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
            >
              Deactivate
            </button>
            <span className="select-none text-neutral-300">|</span>
            <button
              type="button"
              onClick={() => bulkDelete([...selected])}
              disabled={bulkPending}
              className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              {bulkPending ? "…" : "Delete"}
            </button>
          </div>
          <button type="button" onClick={selectAll} className="text-xs text-indigo-600 hover:underline">
            Select all
          </button>
          <button type="button" onClick={clearSelection} className="ml-auto text-xs text-neutral-400 hover:text-neutral-700 transition-colors shrink-0">
            Clear
          </button>
        </div>
      )}
      {selected.size === 0 && rules.length > 0 && (
        <div className="mb-3 text-xs text-neutral-400">
          <button type="button" onClick={selectAll} className="hover:text-neutral-600 hover:underline">Select all</button>
        </div>
      )}

      {rules.length === 0 ? (
        <EmptyState
          icon="⚡"
          title="No scoring rules yet"
          description="Add rules to define which visitor actions contribute to their intent score."
        />
      ) : (
        <table className="w-full text-sm border border-neutral-200 rounded-lg overflow-hidden">
          <thead className="bg-neutral-50 text-xs text-neutral-500 uppercase">
            <tr>
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  checked={selected.size === rules.length && rules.length > 0}
                  onChange={(e) => e.target.checked ? selectAll() : clearSelection()}
                  className="rounded border-neutral-300 text-indigo-600"
                />
              </th>
              <th className="px-4 py-2 text-left">Rule</th>
              <th className="px-4 py-2 text-left">Key</th>
              <th className="px-4 py-2 text-left">Event</th>
              <th className="px-4 py-2 text-left">Value filter</th>
              <th className="px-4 py-2 text-right">Score</th>
              <th className="px-4 py-2 text-left">Decay</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rules.map((rule) => {
              const isInactive = rule.is_active === false;
              return (
              <tr key={rule.id} className={`${isInactive ? "opacity-60" : ""} ${selected.has(rule.id) ? "bg-indigo-50/40" : "hover:bg-neutral-50"}`}>
                <td className="w-8 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(rule.id)}
                    onChange={() => toggleSelect(rule.id)}
                    className="rounded border-neutral-300 text-indigo-600"
                  />
                </td>
                <td className="px-4 py-2.5 font-medium">
                  <div className="flex items-center gap-2">
                    {rule.label}
                    {isInactive && (
                      <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-500 ring-1 ring-inset ring-neutral-200">
                        Inactive
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-neutral-400">
                  {rule.key ?? <span className="italic">, </span>}
                </td>
                <td className="px-4 py-2.5">
                  <span className="bg-neutral-100 px-1.5 py-0.5 rounded text-xs font-mono">
                    {rule.event_type}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-neutral-500 font-mono text-xs">
                  {rule.event_value ?? <span className="italic">any</span>}
                </td>
                <td className="px-4 py-2.5 text-right font-bold text-amber-600">+{rule.score}</td>
                <td className="px-4 py-2.5 text-xs text-neutral-500">{rule.decay_profile}</td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  {isInactive ? (
                    <button
                      onClick={() => handleEnable(rule)}
                      disabled={isPending}
                      className="text-xs text-green-600 hover:underline mr-3 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Enable this rule"
                    >
                      Enable
                    </button>
                  ) : (
                    <button
                      onClick={() => handleDeactivate(rule)}
                      disabled={isPending || checkingRuleId === rule.id}
                      className="text-xs text-neutral-500 hover:text-amber-700 hover:underline mr-3 disabled:opacity-50 disabled:cursor-wait"
                      title="Deactivate this rule (keeps it, stops scoring)"
                    >
                      {checkingRuleId === rule.id ? "Checking…" : "Deactivate"}
                    </button>
                  )}
                  <button onClick={() => openEdit(rule)} className="text-xs text-blue-600 hover:underline mr-3">Edit</button>
                  <button
                    onClick={() => handleDelete(rule)}
                    disabled={checkingRuleId === rule.id}
                    className="text-xs text-red-500 hover:underline disabled:opacity-50 disabled:cursor-wait"
                  >
                    {checkingRuleId === rule.id ? "…" : "Delete"}
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Sequence patterns tab ─────────────────────────────────────────────────────

interface StepForm { event_type: string; event_value: string }

interface SequenceFormState {
  id?:           string;
  label:         string;
  slug:          string;
  steps:         StepForm[];
  maxGapMinutes: number;
  score:         number;
}

function emptySequence(): SequenceFormState {
  return {
    label: "", slug: "",
    steps: [{ event_type: "page_view", event_value: "" }],
    maxGapMinutes: 60, score: 30,
  };
}

function SequencePatternsTab({
  tenantId,
  initial,
  saveAction,
  deleteAction,
  seedAction,
}: {
  tenantId:     string;
  initial:      SequencePattern[];
  saveAction:   (data: SequencePatternInput) => Promise<{ ok: boolean; error?: string }>;
  deleteAction: (id: string) => Promise<{ ok: boolean; error?: string }>;
  seedAction?:  () => Promise<{ ok: true; created: number; skipped: number } | { ok: false; error: string }>;
}) {
  const [patterns, setPatterns] = useState<SequencePattern[]>(initial);
  const [editing, setEditing]   = useState<SequenceFormState | null>(null);
  const [status, setStatus]     = useState<{ msg: string; isError: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSeedPending, startSeedTransition] = useTransition();

  function handleSeed() {
    if (!seedAction) return;
    startSeedTransition(async () => {
      const res = await seedAction();
      if (res.ok) {
        setStatus({
          msg: res.created > 0
            ? `✓ Added ${res.created} sequence${res.created === 1 ? "" : "s"}.${res.skipped > 0 ? ` ${res.skipped} already existed.` : ""}`
            : `All ${res.skipped} preset sequences already exist.`,
          isError: false,
        });
        // Reload the page to show the newly seeded patterns
        if (res.created > 0) window.location.reload();
      } else {
        setStatus({ msg: res.error ?? "Seed failed.", isError: true });
      }
    });
  }

  function openNew() {
    setEditing(emptySequence());
    setStatus(null);
  }
  function openEdit(p: SequencePattern) {
    setEditing({
      id: p.id, label: p.label, slug: p.slug,
      steps: p.sequence.map((s) => ({ event_type: s.event_type, event_value: s.event_value ?? "" })),
      maxGapMinutes: p.max_gap_minutes, score: p.score,
    });
    setStatus(null);
  }

  function addStep() {
    if (!editing) return;
    setEditing({ ...editing, steps: [...editing.steps, { event_type: "page_view", event_value: "" }] });
  }
  function removeStep(i: number) {
    if (!editing) return;
    setEditing({ ...editing, steps: editing.steps.filter((_, idx) => idx !== i) });
  }
  function updateStep(i: number, field: keyof StepForm, value: string) {
    if (!editing) return;
    const steps = editing.steps.map((s, idx) => idx === i ? { ...s, [field]: value } : s);
    setEditing({ ...editing, steps });
  }

  function handleSave() {
    if (!editing) return;
    startTransition(async () => {
      const res = await saveAction({
        id:            editing.id,
        tenantId,
        label:         editing.label,
        slug:          editing.slug,
        sequence:      editing.steps.map((s) => ({
          event_type: s.event_type,
          ...(s.event_value ? { event_value: s.event_value } : {}),
        })),
        maxGapMinutes: editing.maxGapMinutes,
        score:         editing.score,
      });
      if (res.ok) {
        setEditing(null);
        setStatus({ msg: "Saved successfully.", isError: false });
      } else {
        setStatus({ msg: res.error ?? "Save failed.", isError: true });
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this sequence pattern?")) return;
    startTransition(async () => {
      const res = await deleteAction(id);
      if (res.ok) {
        setPatterns((prev) => prev.filter((p) => p.id !== id));
        setStatus({ msg: "Deleted.", isError: false });
      } else {
        setStatus({ msg: res.error ?? "Delete failed.", isError: true });
      }
    });
  }

  return (
    <div>
      <p className="text-sm text-neutral-500 mb-4">
        Define ordered event sequences that signal meaningful intent.
        When a visitor completes all steps in order (within the allowed time gap),
        the sequence is recorded and a score bonus is awarded.
      </p>

      {status && <StatusMsg msg={status.msg} isError={status.isError} />}
      <ActionBar onAdd={openNew} label="Add Sequence" />

      {editing && (
        <SectionCard title={editing.id ? "Edit Sequence Pattern" : "New Sequence Pattern"}>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <LabelInput label="Pattern Name" value={editing.label}
              onChange={(v) => setEditing({ ...editing, label: v })}
              placeholder="e.g. About → Pricing journey" />
            <LabelInput label="Slug (unique key)" value={editing.slug}
              onChange={(v) => setEditing({ ...editing, slug: v.toLowerCase().replace(/\s+/g, "_") })}
              placeholder="e.g. about_to_pricing" />
            <NumberInput label="Max Gap (minutes)" value={editing.maxGapMinutes}
              onChange={(v) => setEditing({ ...editing, maxGapMinutes: v })}
              min={1} max={10080}
              hint="Maximum time between consecutive steps" />
            <NumberInput label="Score Bonus" value={editing.score}
              onChange={(v) => setEditing({ ...editing, score: v })}
              min={0} max={200}
              hint="Intent points added when sequence is fully matched" />
          </div>

          {/* Steps builder */}
          <div className="mb-4">
            <div className="text-xs font-semibold text-neutral-500 uppercase mb-2">
              Sequence Steps (in order)
            </div>
            <div className="space-y-2">
              {editing.steps.map((step, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </div>
                  <select
                    value={step.event_type}
                    onChange={(e) => updateStep(i, "event_type", e.target.value)}
                    className="border border-neutral-200 rounded px-2 py-1.5 text-sm"
                  >
                    {EVENT_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={step.event_value}
                    onChange={(e) => updateStep(i, "event_value", e.target.value)}
                    placeholder="Event value / page path (optional)"
                    className="flex-1 border border-neutral-200 rounded px-2 py-1.5 text-sm"
                  />
                  {editing.steps.length > 1 && (
                    <button
                      onClick={() => removeStep(i)}
                      className="text-red-400 hover:text-red-600 text-xs"
                    >
                      Remove
                    </button>
                  )}
                  {i < editing.steps.length - 1 && (
                    <span className="text-neutral-300 text-xs">→</span>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addStep}
              className="mt-2 text-sm text-indigo-600 hover:underline"
            >
              + Add step
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={isPending || !editing.label || !editing.slug || editing.steps.length < 2}
              className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Saving…" : "Save Sequence"}
            </button>
            <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900">
              Cancel
            </button>
          </div>
        </SectionCard>
      )}

      {/* Seed panel — shown when no sequences exist */}
      {patterns.length === 0 && seedAction && (
        <div className="mb-6 rounded-lg border border-indigo-100 bg-indigo-50/60 p-5">
          <div className="flex items-start gap-4">
            <div className="text-2xl">🔗</div>
            <div className="flex-1">
              <div className="font-semibold text-neutral-900 mb-1">
                Install {SEED_SEQUENCE_COUNT} preset sequences
              </div>
              <p className="text-sm text-neutral-500 mb-3">
                Covers the three most common buyer-journey paths for a B2B SaaS site:
                Homepage → Pricing, Pricing → Book Demo, and Case Study → Pricing.
              </p>
              <button
                onClick={handleSeed}
                disabled={isSeedPending}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {isSeedPending ? "Installing…" : `Install ${SEED_SEQUENCE_COUNT} preset sequences`}
              </button>
            </div>
          </div>
        </div>
      )}

      {patterns.length === 0 && !seedAction ? (
        <EmptyState
          icon="🔗"
          title="No sequence patterns yet"
          description="Add a sequence to detect multi-step behavioral journeys like about → pricing."
        />
      ) : patterns.length === 0 ? null : (
        <div className="space-y-3">
          {patterns.map((p) => (
            <div key={p.id} className="border border-neutral-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-neutral-900">{p.label}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {p.sequence.map((step, i) => (
                      <React.Fragment key={i}>
                        <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded font-mono">
                          {step.event_type}{step.event_value ? `: ${step.event_value}` : ""}
                        </span>
                        {i < p.sequence.length - 1 && (
                          <span className="text-neutral-400 text-xs">→</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="text-xs text-neutral-400 mt-1.5">
                    Max gap: {p.max_gap_minutes} min · Bonus: +{p.score} · Slug: {p.slug}
                  </div>
                </div>
                <div className="flex gap-3 ml-4 shrink-0">
                  <button onClick={() => openEdit(p)} className="text-xs text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => handleDelete(p.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Decay profiles tab ────────────────────────────────────────────────────────

function DecayProfilesTab({ decayProfiles }: { decayProfiles: DecayProfile[] }) {
  return (
    <div>
      <p className="text-sm text-neutral-500 mb-4">
        Decay profiles control how quickly a scored event fades over time.
        A "fast" profile means older actions matter less; a "slow" profile means
        even month-old signals still contribute significantly.
      </p>
      <p className="text-xs text-neutral-400 mb-6 italic">
        Decay profiles are shared across all tenants and are managed at the platform level.
        Contact your administrator to add or modify profiles.
      </p>

      {decayProfiles.length === 0 ? (
        <EmptyState
          icon="⏱️"
          title="No decay profiles found"
          description="Run the database migration to seed default decay profiles."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {decayProfiles
            // Filter out ghost rows: UUID slugs are backfilled placeholders from
            // an early migration that ran before the slug column existed.
            // They are never referenced by scoring rules (which use "standard", "fast", etc.)
            .filter((profile) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profile.slug))
            .map((profile) => (
              <SectionCard
                key={profile.slug}
                title={profile.label}
                description={`Key: ${profile.slug}`}
              >
                <DecayProfileVisual profile={profile} />
              </SectionCard>
            ))}
        </div>
      )}
    </div>
  );
}

// ── Decay profile visual ──────────────────────────────────────────────────────

function DecayProfileVisual({ profile }: { profile: DecayProfile }) {
  const points: Array<{ label: string; weight: number }> = [
    { label: "Today",        weight: profile.day_1 },
    { label: "< 1 week",     weight: profile.day_7 },
    { label: "< 1 month",    weight: profile.day_30 },
    { label: "< 3 months",   weight: profile.day_90 },
    { label: "> 3 months",   weight: 0 },
  ];
  return (
    <div className="space-y-2">
      {points.map(({ label, weight }) => (
        <div key={label} className="flex items-center gap-3 text-sm">
          <div className="w-24 text-xs text-neutral-500 shrink-0">{label}</div>
          <div className="flex-1 bg-neutral-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${Math.round(weight * 100)}%` }}
            />
          </div>
          <div className="w-10 text-right text-xs font-bold text-neutral-600">
            {Math.round(weight * 100)}%
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Shared form inputs ────────────────────────────────────────────────────────

function LabelInput({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-700 mb-1">{label}</label>
      <input
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-neutral-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}

function NumberInput({
  label, value, onChange, min, max, hint,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-700 mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        className="w-full border border-neutral-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {hint && <p className="mt-0.5 text-xs text-neutral-400">{hint}</p>}
    </div>
  );
}

function SelectInput({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-700 mb-1">{label}</label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-neutral-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="border border-dashed border-neutral-200 rounded-lg p-8 text-center">
      <div className="text-3xl mb-2">{icon}</div>
      <div className="font-medium text-neutral-700">{title}</div>
      <p className="mt-1 text-sm text-neutral-400">{description}</p>
    </div>
  );
}
