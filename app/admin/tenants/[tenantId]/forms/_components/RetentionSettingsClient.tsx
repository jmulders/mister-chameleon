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
  { value: null, label: "Altijd bewaren" },
  { value: 30,   label: "30 dagen" },
  { value: 60,   label: "60 dagen" },
  { value: 90,   label: "90 dagen" },
  { value: 180,  label: "180 dagen (6 maanden)" },
  { value: 365,  label: "365 dagen (1 jaar)" },
  { value: 730,  label: "730 dagen (2 jaar)" },
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
    "Onbekend";

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      {/* ── Section header ──────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-neutral-100">
        <h2 className="text-sm font-semibold text-neutral-900">Bewaartermijn inzendingen (AVG)</h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Automatisch verwijderen van formulierinzendingen na een bepaald aantal dagen.
          Vereist door de AVG wanneer inzendingen persoonsgegevens bevatten.
        </p>
      </div>

      {/* ── Fields ──────────────────────────────────────────────────────── */}
      <div className="px-5 py-4 space-y-4">

        {/* AVG warning */}
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <span className="text-base leading-none mt-0.5">⚠️</span>
          <span>
            <strong>AVG-vereiste:</strong> sla persoonsgegevens niet langer op dan noodzakelijk.
            Kies een bewaartermijn die past bij het doel van het formulier.
          </span>
        </div>

        {/* Select */}
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1" htmlFor="retentionDays">
            Bewaartermijn
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
            Huidige instelling:{" "}
            <span className="font-medium text-neutral-600">{currentLabel}</span>
            {retentionDays !== null && (
              <>
                {" "}— inzendingen ouder dan{" "}
                <span className="font-medium">{retentionDays} dagen</span> worden
                dagelijks automatisch verwijderd.
              </>
            )}
            {retentionDays === null && (
              <> — inzendingen worden nooit automatisch verwijderd.</>
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
            <p className="text-sm text-green-600">Bewaartermijn opgeslagen.</p>
          )}
          {saveStatus === "saving" && (
            <p className="text-sm text-neutral-400">Opslaan…</p>
          )}
          {saveStatus === "idle" && isDirty && (
            <p className="text-xs text-amber-600">Niet-opgeslagen wijzigingen</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saveStatus === "saving" || !isDirty}
          className="inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-700 transition-colors disabled:opacity-40"
        >
          {saveStatus === "saving" ? "Opslaan…" : "Opslaan"}
        </button>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 " +
  "focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]";
