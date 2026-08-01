"use client";

/**
 * RetentionSettingsClient
 *
 * AVG/GDPR retention configuration for form submissions.
 * Lets admins set how many days submissions are kept before automatic deletion.
 */

import { useState } from "react";
import { saveRetentionSettingAction } from "../submissions/actions";

// ── Types ──────────────────────────────────────────────────────────────────────

interface RetentionSettingsClientProps {
  tenantId:             string;
  initialRetentionDays: number | null;
}

// ── Options ────────────────────────────────────────────────────────────────────

const RETENTION_OPTIONS: Array<{ value: number | null; label: string }> = [
  { value: null, label: "Keep forever" },
  { value: 30,   label: "30 days" },
  { value: 60,   label: "60 days" },
  { value: 90,   label: "90 days" },
  { value: 180,  label: "180 days (6 months)" },
  { value: 365,  label: "365 days (1 year)" },
  { value: 730,  label: "730 days (2 years)" },
];

// ── Component ──────────────────────────────────────────────────────────────────

export function RetentionSettingsClient({
  tenantId,
  initialRetentionDays,
}: RetentionSettingsClientProps) {
  const [retentionDays, setRetentionDays] = useState<number | null>(initialRetentionDays);
  const [saveStatus, setSaveStatus]       = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg]           = useState<string | null>(null);
  const [isDirty, setIsDirty]             = useState(false);

  const handleChange = (raw: string) => {
    const val = raw === "null" ? null : Number(raw);
    setRetentionDays(val);
    setIsDirty(true);
    setSaveStatus("idle");
  };

  const handleSave = async () => {
    setSaveStatus("saving");
    setErrorMsg(null);

    const result = await saveRetentionSettingAction(tenantId, retentionDays);
    if (result.ok) {
      setSaveStatus("saved");
      setIsDirty(false);
    } else {
      setSaveStatus("error");
      setErrorMsg(result.error);
    }
  };

  const currentLabel =
    RETENTION_OPTIONS.find((o) => o.value === retentionDays)?.label ??
    "Unknown";

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      {/* ── Section header ──────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-neutral-100">
        <h2 className="text-sm font-semibold text-neutral-900">Submission retention (GDPR)</h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Automatically delete form submissions after a set number of days.
          Required by GDPR when submissions contain personal data.
        </p>
      </div>

      {/* ── Fields ──────────────────────────────────────────────────────── */}
      <div className="px-5 py-4 space-y-4">

        {/* AVG warning */}
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <span className="text-base leading-none mt-0.5">⚠️</span>
          <span>
            <strong>GDPR requirement:</strong> do not store personal data longer than necessary.
            Choose a retention period that matches the form&rsquo;s purpose.
          </span>
        </div>

        {/* Select */}
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1" htmlFor="retentionDays">
            Retention period
          </label>
          <select
            id="retentionDays"
            value={retentionDays === null ? "null" : String(retentionDays)}
            onChange={(e) => handleChange(e.target.value)}
            className={inputCls}
          >
            {RETENTION_OPTIONS.map((opt) => (
              <option key={String(opt.value)} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-neutral-400">
            Current setting:{" "}
            <span className="font-medium text-neutral-600">{currentLabel}</span>
            {retentionDays !== null && (
              <>
                {". Submissions older than "}
                <span className="font-medium">{retentionDays} days</span> are
                deleted automatically each day.
              </>
            )}
            {retentionDays === null && (
              <>. Submissions are never automatically deleted.</>
            )}
          </p>
        </div>
      </div>

      {/* ── Save bar ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 border-t border-neutral-100 bg-neutral-50 px-5 py-3">
        <div className="flex-1">
          {saveStatus === "error" && errorMsg && (
            <p className="text-sm text-red-600">{errorMsg}</p>
          )}
          {saveStatus === "saved" && (
            <p className="text-sm text-green-600">Retention period saved.</p>
          )}
          {saveStatus === "saving" && (
            <p className="text-sm text-neutral-400">Saving…</p>
          )}
          {saveStatus === "idle" && isDirty && (
            <p className="text-xs text-amber-600">Unsaved changes</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saveStatus === "saving" || !isDirty}
          className="inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-700 transition-colors disabled:opacity-40"
        >
          {saveStatus === "saving" ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 " +
  "focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]";
