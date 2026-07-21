"use client";

/**
 * ProfilesClient
 *
 * Client component for the interest profiles table on
 * /admin/tenants/[tenantId]/interest-profiles.
 *
 * Handles per-profile enable/disable toggles with optimistic UI:
 *   1. Flip the local state immediately so the toggle responds without a
 *      round-trip (no visible lag).
 *   2. POST to /api/admin/tenants/[tenantId]/interest-profiles/toggle.
 *   3. If the request fails, roll the state back and show a brief error
 *      message inline on the row that failed.
 *
 * The server component (page.tsx) handles all data loading and passes
 * `initialProfiles` down so this component starts with correct data.
 */

import { useState, useCallback }    from "react";
import Link                          from "next/link";
import type { AnnotatedInterestProfile } from "../actions";
import { checkInterestProfileDependenciesAction } from "../actions";
import type { InterestProfileFamily }    from "@/interest-profiles/types";

// ── Family display config ─────────────────────────────────────────────────────

const FAMILY_CONFIG: Record<InterestProfileFamily, { label: string; colour: string }> = {
  b2b_saas:    { label: "B2B / SaaS",  colour: "bg-blue-50 text-blue-700 ring-blue-200" },
  careers:     { label: "Careers",     colour: "bg-violet-50 text-violet-700 ring-violet-200" },
  commerce:    { label: "Commerce",    colour: "bg-amber-50 text-amber-700 ring-amber-200" },
  real_estate: { label: "Real Estate", colour: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function toScoreVar(key: string): string {
  const pascal = key
    .replace(/[-_](.)/g, (_, c: string) => (c as string).toUpperCase())
    .replace(/^(.)/, (c) => (c as string).toUpperCase());
  return `interest${pascal}Score`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FamilyBadge({ family }: { family: InterestProfileFamily | undefined }) {
  if (!family) return null;
  const cfg = FAMILY_CONFIG[family];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${cfg.colour}`}>
      {cfg.label}
    </span>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <tr className="bg-neutral-50/80 border-b border-neutral-200">
      <th
        colSpan={7}
        className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-400"
      >
        {children}
      </th>
    </tr>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

interface ProfileToggleProps {
  profileKey: string;
  enabled:    boolean;
  saving:     boolean;
  checking?:  boolean;
  onToggle:   (profileKey: string, enabled: boolean) => void;
}

function ProfileToggle({ profileKey, enabled, saving, checking, onToggle }: ProfileToggleProps) {
  const busy = saving || checking;
  return (
    <button
      type="button"
      onClick={() => !busy && onToggle(profileKey, !enabled)}
      disabled={busy}
      title={checking ? "Checking rule dependencies…" : enabled ? "Disable for this tenant" : "Enable for this tenant"}
      aria-pressed={enabled}
      className={`
        relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent
        transition-colors duration-200 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1
        ${busy ? "cursor-wait opacity-60" : "cursor-pointer"}
        ${enabled ? "bg-brand-600" : "bg-neutral-200"}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0
          transition duration-200 ease-in-out
          ${enabled ? "translate-x-4" : "translate-x-0"}
        `}
      />
    </button>
  );
}

// ── Profile row ───────────────────────────────────────────────────────────────

interface ProfileRowProps {
  profile:   AnnotatedInterestProfile;
  tenantId:  string;
  saving:    boolean;
  checking?: boolean;
  error:     string | null;
  onToggle:  (profileKey: string, enabled: boolean) => void;
  selected?: boolean;
  onSelect?: (key: string) => void;
}

function ProfileRow({ profile, tenantId, saving, checking, error, onToggle, selected, onSelect }: ProfileRowProps) {
  const isPlatform  = !profile.tenantId;
  const isSuggested = isPlatform && profile.defaultStatus === "suggested";
  const validTags   = profile.tags.filter((t) => t != null);
  const tagPreview  = validTags.slice(0, 3);
  const overflow    = validTags.length - tagPreview.length;
  const isDisabled  = isPlatform && !profile.tenantEnabled;

  // Platform-managed profiles are edited on the shared platform page. Pass a
  // ?return= so its back/Cancel/delete come back to THIS tenant's Audience tab
  // (keeping the tenant tab bar) instead of the platform list.
  const editHref = isPlatform
    ? `/admin/interest-profiles/${profile.id}?return=${encodeURIComponent(`/admin/tenants/${tenantId}/interest-profiles`)}`
    : `/admin/tenants/${tenantId}/interest-profiles/${profile.id}`;

  return (
    <>
      <tr className={`border-b border-neutral-100 last:border-0 transition-colors ${selected ? "bg-brand-50/40" : isDisabled ? "bg-neutral-50/60 opacity-60" : "hover:bg-neutral-50/60"}`}>
        {/* Bulk select checkbox */}
        <td className="w-8 px-3 py-3">
          {profile.isOverrideable ? (
            <input
              type="checkbox"
              checked={!!selected}
              onChange={() => onSelect?.(profile.key)}
              onClick={(e) => e.stopPropagation()}
              className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
            />
          ) : (
            <span className="inline-block w-4" />
          )}
        </td>
        {/* Profile name + key + badges */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-neutral-900">{profile.name}</p>
            {isPlatform && (
              <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Platform
              </span>
            )}
            <FamilyBadge family={profile.family} />
            {isDisabled && (
              <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600 ring-1 ring-inset ring-red-200">
                Disabled for tenant
              </span>
            )}
          </div>
          <code className="text-xs font-mono text-neutral-400">{profile.key}</code>
        </td>

        {/* Global status */}
        <td className="px-4 py-3 whitespace-nowrap">
          {isSuggested ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Suggested
            </span>
          ) : (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
              profile.isActive
                ? "bg-green-50 text-green-700 ring-green-200"
                : "bg-neutral-100 text-neutral-500 ring-neutral-200"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${profile.isActive ? "bg-green-500" : "bg-neutral-400"}`} />
              {profile.isActive ? "Active" : "Inactive"}
            </span>
          )}
        </td>

        {/* Tenant toggle — only for platform-wide profiles */}
        <td className="px-4 py-3 whitespace-nowrap">
          {profile.isOverrideable ? (
            <div className="flex items-center gap-2">
              <ProfileToggle
                profileKey={profile.key}
                enabled={profile.tenantEnabled}
                saving={saving}
                checking={checking}
                onToggle={onToggle}
              />
              <span className="text-xs text-neutral-400">
                {profile.tenantEnabled ? "On" : "Off"}
              </span>
            </div>
          ) : (
            <span className="text-xs text-neutral-300">—</span>
          )}
        </td>

        {/* Tag preview */}
        <td className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-1">
            {tagPreview.map((tag, i) => (
              <span
                key={`${tag.keyword ?? ""}-${i}`}
                className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600"
              >
                {tag.keyword}
                <span className="ml-1 text-neutral-400 font-normal">×{tag.weight}</span>
              </span>
            ))}
            {overflow > 0 && (
              <span className="text-xs text-neutral-400">+{overflow} more</span>
            )}
            {validTags.length === 0 && (
              <span className="text-xs text-neutral-400">No tags</span>
            )}
          </div>
        </td>

        {/* Context variable */}
        <td className="px-4 py-3">
          <code className="text-xs font-mono text-neutral-500">{toScoreVar(profile.key)}</code>
        </td>

        {/* Action */}
        <td className="px-4 py-3 text-right">
          {isPlatform ? (
            <Link
              href={editHref}
              className="text-xs font-medium text-neutral-400 hover:text-neutral-600 transition-colors"
              title="Edit in global admin"
            >
              View →
            </Link>
          ) : (
            <Link
              href={editHref}
              className="text-xs font-medium text-brand-600 hover:text-brand-800 transition-colors"
            >
              Edit →
            </Link>
          )}
        </td>
      </tr>

      {/* Inline error row — only shown when this profile's toggle failed */}
      {error && (
        <tr className="border-b border-neutral-100 bg-red-50">
          <td colSpan={7} className="px-4 py-1.5">
            <p className="text-xs text-red-600">
              ⚠ Could not save change for <strong>{profile.key}</strong>: {error}
            </p>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Dependency confirmation banner ────────────────────────────────────────────

interface DepConfirmBannerProps {
  profileKey:    string;
  ruleLabels:    string[];
  onConfirm:     () => void;
  onCancel:      () => void;
  confirming:    boolean;
}

function DepConfirmBanner({ profileKey, ruleLabels, onConfirm, onCancel, confirming }: DepConfirmBannerProps) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-5 py-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-amber-500 shrink-0">⚠</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900">
            {ruleLabels.length === 1
              ? "1 rule references this profile"
              : `${ruleLabels.length} rules reference this profile`}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Disabling <strong>{profileKey}</strong> will cause{" "}
            {ruleLabels.length === 1 ? "this rule" : "these rules"} to silently stop matching
            — the rule stays active in the database but its condition can never be satisfied.
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
          {confirming ? "Disabling…" : "Disable anyway"}
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface ProfilesClientProps {
  initialProfiles: AnnotatedInterestProfile[];
  tenantId:        string;
}

export function ProfilesClient({ initialProfiles, tenantId }: ProfilesClientProps) {
  // Local copy of profiles — mutated optimistically on toggle.
  const [profiles, setProfiles] = useState<AnnotatedInterestProfile[]>(initialProfiles);

  // Track which profile key is currently saving, and any per-key error.
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [errors,    setErrors]    = useState<Record<string, string>>({});

  // ── Bulk selection ─────────────────────────────────────────────────────────
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkPending,  setBulkPending]  = useState(false);

  // Only overrideable profiles can be toggled in bulk.
  const selectableKeys = profiles.filter((p) => p.isOverrideable).map((p) => p.key);

  const toggleSelectKey = (key: string) =>
    setSelectedKeys((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  const selectAllKeys   = () => setSelectedKeys(new Set(selectableKeys));
  const clearKeys       = () => setSelectedKeys(new Set());

  async function bulkToggle(keys: string[], enable: boolean) {
    setBulkPending(true);
    try {
      await Promise.all(keys.map((key) => doToggle(key, enable)));
    } finally {
      setBulkPending(false);
      setSelectedKeys(new Set());
    }
  }

  // Pending-deactivation confirmation: set when disabling a profile that has dependent rules.
  const [pendingDisable, setPendingDisable] = useState<{
    profileKey: string;
    ruleLabels: string[];
  } | null>(null);
  const [checkingKey,  setCheckingKey]  = useState<string | null>(null);
  const [confirming,   setConfirming]   = useState(false);

  // ── Derived state ──────────────────────────────────────────────────────────
  // Count currently active profiles (tenant-owned active + platform enabled).
  const activeCount  = profiles.filter((p) => {
    if (!p.tenantId) return p.isActive && p.tenantEnabled; // platform-wide: active + tenant not suppressed
    return p.isActive;                                      // tenant-owned: just isActive
  }).length;

  /** Actually sends the toggle request (after any confirmation). */
  const doToggle = useCallback(async (profileKey: string, newEnabled: boolean) => {
    // Optimistic update — flip the state immediately.
    setProfiles((prev) =>
      prev.map((p) =>
        p.key === profileKey ? { ...p, tenantEnabled: newEnabled } : p,
      ),
    );
    setErrors((prev) => ({ ...prev, [profileKey]: "" }));
    setSavingKey(profileKey);

    try {
      const res = await fetch(
        `/api/admin/tenants/${tenantId}/interest-profiles/toggle`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ profileKey, enabled: newEnabled }),
        },
      );

      const json = await res.json() as { ok: boolean; error?: string; message?: string };

      if (!res.ok || !json.ok) {
        // Rollback on error.
        setProfiles((prev) =>
          prev.map((p) =>
            p.key === profileKey ? { ...p, tenantEnabled: !newEnabled } : p,
          ),
        );
        const msg = json.error ?? json.message ?? `HTTP ${res.status}`;
        setErrors((prev) => ({ ...prev, [profileKey]: msg }));
      }
    } catch (err) {
      // Network failure — rollback.
      setProfiles((prev) =>
        prev.map((p) =>
          p.key === profileKey ? { ...p, tenantEnabled: !newEnabled } : p,
        ),
      );
      const msg = err instanceof Error ? err.message : "Network error.";
      setErrors((prev) => ({ ...prev, [profileKey]: msg }));
    } finally {
      setSavingKey(null);
    }
  }, [tenantId]);

  const handleToggle = useCallback(async (profileKey: string, newEnabled: boolean) => {
    // When enabling: no dependency check needed — proceed immediately.
    if (newEnabled) {
      await doToggle(profileKey, true);
      return;
    }

    // When disabling: check for dependent rules first.
    setCheckingKey(profileKey);
    try {
      const check = await checkInterestProfileDependenciesAction(tenantId, profileKey);
      if (check.ok && check.dependentRules.length > 0) {
        // Show confirmation banner instead of proceeding.
        setPendingDisable({
          profileKey,
          ruleLabels: check.dependentRules.map((r) => r.label),
        });
        return;
      }
    } catch {
      // If the check fails, proceed without blocking the user.
    } finally {
      setCheckingKey(null);
    }

    // No dependencies (or check errored) — disable immediately.
    await doToggle(profileKey, false);
  }, [tenantId, doToggle]);

  /** Called when admin confirms disabling despite dependent rules. */
  const handleConfirmDisable = useCallback(async () => {
    if (!pendingDisable) return;
    setConfirming(true);
    try {
      await doToggle(pendingDisable.profileKey, false);
    } finally {
      setConfirming(false);
      setPendingDisable(null);
    }
  }, [pendingDisable, doToggle]);

  // ── Partition ───────────────────────────────────────────────────────────────

  const tenantProfiles        = profiles.filter((p) => p.tenantId === tenantId);
  const platformActive        = profiles.filter((p) => !p.tenantId && p.isActive && p.defaultStatus !== "suggested");
  const platformSuggested     = profiles.filter((p) => !p.tenantId && p.defaultStatus === "suggested");
  const platformInactiveOther = profiles.filter((p) => !p.tenantId && !p.isActive && p.defaultStatus !== "suggested");

  const platformEnabledCount  = platformActive.filter((p) => p.tenantEnabled).length;
  const platformDisabledCount = platformActive.filter((p) => !p.tenantEnabled).length;
  const hasPlatformProfiles   = platformActive.length + platformSuggested.length + platformInactiveOther.length > 0;

  // ── Render ──────────────────────────────────────────────────────────────────

  if (tenantProfiles.length === 0 && !hasPlatformProfiles) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-base font-semibold text-neutral-800">No profiles yet</p>
        <p className="mt-1 text-sm text-neutral-500 max-w-sm">
          Create tenant-specific interest profiles, or use the inherited platform-wide ones.
        </p>
        <Link
          href={`/admin/tenants/${tenantId}/interest-profiles/new`}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
        >
          <span>+</span>
          New profile
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Dependency confirmation banner */}
      {pendingDisable && (
        <DepConfirmBanner
          profileKey={pendingDisable.profileKey}
          ruleLabels={pendingDisable.ruleLabels}
          onConfirm={handleConfirmDisable}
          onCancel={() => setPendingDisable(null)}
          confirming={confirming}
        />
      )}

      {/* Stats strip */}
      <div className="rounded-xl border border-neutral-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex flex-wrap gap-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Tenant profiles</p>
            <p className="mt-1 text-2xl font-bold text-neutral-900">{tenantProfiles.length}</p>
            <p className="text-xs text-neutral-400">{tenantProfiles.filter((p) => p.isActive).length} active</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Platform enabled</p>
            <p className="mt-1 text-2xl font-bold text-green-600">{platformEnabledCount}</p>
            <p className="text-xs text-neutral-400">Active for this tenant</p>
          </div>
          {platformDisabledCount > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Platform disabled</p>
              <p className="mt-1 text-2xl font-bold text-red-500">{platformDisabledCount}</p>
              <p className="text-xs text-neutral-400">Suppressed for this tenant</p>
            </div>
          )}
          {platformSuggested.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Suggested</p>
              <p className="mt-1 text-2xl font-bold text-amber-500">{platformSuggested.length}</p>
              <p className="text-xs text-neutral-400">Enable in global admin</p>
            </div>
          )}
          <div className="border-l border-neutral-100 pl-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Context variables</p>
            <div className="mt-1 flex flex-col gap-0.5">
              <code className="text-xs font-mono text-neutral-600">interestPrimary</code>
              <code className="text-xs font-mono text-neutral-600">interestSecondary</code>
              <code className="text-xs font-mono text-neutral-600">interestConfidence</code>
              <code className="text-xs font-mono text-neutral-400">interest&lt;Key&gt;Score</code>
            </div>
          </div>
        </div>
      </div>

      {/* How-it-works callout */}
      <div className="rounded-xl border border-brand-200 bg-brand-50 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 mb-1.5">
          How scoring works
        </p>
        <p className="text-sm text-brand-800 max-w-2xl">
          At runtime the scoring engine uses all <strong>enabled</strong> profiles for this
          tenant — tenant-specific profiles plus platform-wide ones that haven&apos;t been
          turned off. Use the toggle in the <strong>Tenant</strong> column to enable or
          disable individual platform profiles for this tenant without affecting other tenants.
          Scores are normalised to 0–1 and available as context variables.
        </p>
      </div>

      {/* Bulk toolbar */}
      {selectedKeys.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2.5">
          <span className="text-xs font-medium text-neutral-600 shrink-0">
            {selectedKeys.size} of {selectableKeys.length} selected
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => bulkToggle([...selectedKeys], true)}
              disabled={bulkPending}
              className="inline-flex items-center gap-1 rounded border border-green-300 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors"
            >
              Enable
            </button>
            <button
              type="button"
              onClick={() => bulkToggle([...selectedKeys], false)}
              disabled={bulkPending}
              className="inline-flex items-center gap-1 rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
            >
              Disable
            </button>
          </div>
          <button type="button" onClick={selectAllKeys} className="text-xs font-medium text-brand-600 hover:text-brand-800 transition-colors">
            Select all
          </button>
          <button type="button" onClick={clearKeys} className="ml-auto text-xs text-neutral-400 hover:text-neutral-700 transition-colors shrink-0">
            Clear
          </button>
        </div>
      )}

      {/* Profile table */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="w-8 px-3 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all profiles"
                  checked={selectableKeys.length > 0 && selectedKeys.size === selectableKeys.length}
                  onChange={(e) => e.target.checked ? selectAllKeys() : clearKeys()}
                  className="rounded border-neutral-300 text-brand-600 focus:ring-brand-500"
                />
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Profile</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Status</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Tenant</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Keywords</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">Context var</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {/* Tenant-specific profiles */}
            {tenantProfiles.length > 0 && (
              <>
                <SectionHeading>
                  This tenant — {tenantProfiles.length} profile{tenantProfiles.length !== 1 ? "s" : ""}
                </SectionHeading>
                {tenantProfiles.map((profile) => (
                  <ProfileRow
                    key={profile.id}
                    profile={profile}
                    tenantId={tenantId}
                    saving={savingKey === profile.key}
                    checking={checkingKey === profile.key}
                    error={errors[profile.key] || null}
                    onToggle={handleToggle}
                    selected={selectedKeys.has(profile.key)}
                    onSelect={toggleSelectKey}
                  />
                ))}
              </>
            )}

            {/* Platform active profiles */}
            {platformActive.length > 0 && (
              <>
                <SectionHeading>
                  Platform — {platformActive.length} active profile{platformActive.length !== 1 ? "s" : ""}{" "}
                  ({platformEnabledCount} on, {platformDisabledCount} off)
                </SectionHeading>
                {platformActive.map((profile) => (
                  <ProfileRow
                    key={profile.id}
                    profile={profile}
                    tenantId={tenantId}
                    saving={savingKey === profile.key}
                    checking={checkingKey === profile.key}
                    error={errors[profile.key] || null}
                    onToggle={handleToggle}
                    selected={selectedKeys.has(profile.key)}
                    onSelect={toggleSelectKey}
                  />
                ))}
              </>
            )}

            {/* Platform suggested profiles */}
            {platformSuggested.length > 0 && (
              <>
                <SectionHeading>
                  Platform — {platformSuggested.length} suggested profile{platformSuggested.length !== 1 ? "s" : ""} (inactive globally)
                </SectionHeading>
                {platformSuggested.map((profile) => (
                  <ProfileRow
                    key={profile.id}
                    profile={profile}
                    tenantId={tenantId}
                    saving={savingKey === profile.key}
                    checking={checkingKey === profile.key}
                    error={errors[profile.key] || null}
                    onToggle={handleToggle}
                    selected={selectedKeys.has(profile.key)}
                    onSelect={toggleSelectKey}
                  />
                ))}
              </>
            )}

            {/* Platform inactive (manually disabled) */}
            {platformInactiveOther.length > 0 && (
              <>
                <SectionHeading>
                  Platform — {platformInactiveOther.length} inactive profile{platformInactiveOther.length !== 1 ? "s" : ""}
                </SectionHeading>
                {platformInactiveOther.map((profile) => (
                  <ProfileRow
                    key={profile.id}
                    profile={profile}
                    tenantId={tenantId}
                    saving={savingKey === profile.key}
                    checking={checkingKey === profile.key}
                    error={errors[profile.key] || null}
                    onToggle={handleToggle}
                    selected={selectedKeys.has(profile.key)}
                    onSelect={toggleSelectKey}
                  />
                ))}
              </>
            )}

            {/* No tenant-specific profiles row */}
            {tenantProfiles.length === 0 && hasPlatformProfiles && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center">
                  <p className="text-sm text-neutral-500">
                    No tenant-specific profiles yet.{" "}
                    <Link
                      href={`/admin/tenants/${tenantId}/interest-profiles/new`}
                      className="font-medium text-brand-600 hover:text-brand-800"
                    >
                      Create the first one →
                    </Link>
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Global admin link */}
      {hasPlatformProfiles && (
        <p className="text-xs text-neutral-400">
          Platform-wide profiles are managed at{" "}
          <Link
            href="/admin/interest-profiles"
            className="font-medium text-neutral-500 hover:text-brand-700 underline underline-offset-2"
          >
            /admin/interest-profiles
          </Link>
          .
        </p>
      )}
    </div>
  );
}
