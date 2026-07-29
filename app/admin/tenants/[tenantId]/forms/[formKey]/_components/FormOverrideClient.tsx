"use client";

/**
 * FormOverrideClient
 *
 * Client component for the per-form override configuration UI.
 *
 * ─── Sections ──────────────────────────────────────────────────────────────────
 *
 *   1. Override toggle  — master switch; when off, all fields below are dimmed
 *   2. Action flags     — notify / confirm / store toggles for this form only
 *   3. Custom recipients — replaces tenant-level recipients for this form
 *   4. Subject / sender  — per-form email customisation
 *   5. Save / Reset buttons
 *
 * ─── Props ────────────────────────────────────────────────────────────────────
 *
 *   initialOverride      — current DB state (TenantFormOverrideSettings)
 *   tenantNotify         — effective notify flag from tenant defaults (for display)
 *   tenantConfirm        — effective confirm flag from tenant defaults (for display)
 *   tenantStore          — effective store flag from tenant defaults (for display)
 *   tenantRecipients     — tenant-level recipients (shown as fallback)
 *   defNotify            — form definition default for notify
 *   defConfirm           — form definition default for confirm
 *   defStore             — form definition default for store
 *   saveAction           — bound server action: (overrides) => Promise<result>
 *   resetAction          — bound server action: () => Promise<result>
 */

import { useState, useTransition }    from "react";
import type { TenantFormOverrideSettings } from "@/tenant/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormOverrideClientProps {
  initialOverride:    TenantFormOverrideSettings;
  tenantNotify:       boolean;
  tenantConfirm:      boolean;
  tenantStore:        boolean;
  tenantRecipients:   string[];
  defNotify:          boolean;
  defConfirm:         boolean;
  defStore:           boolean;
  /** Whether the tenant has Turnstile site + secret keys configured (for a hint). */
  turnstileHasKeys?:  boolean;
  saveAction:  (overrides: Partial<TenantFormOverrideSettings>) => Promise<{ ok: true } | { ok: false; error: string }>;
  resetAction: ()                                               => Promise<{ ok: true } | { ok: false; error: string }>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FormOverrideClient({
  initialOverride,
  tenantNotify,
  tenantConfirm,
  tenantStore,
  tenantRecipients,
  defNotify,
  defConfirm,
  defStore,
  turnstileHasKeys,
  saveAction,
  resetAction,
}: FormOverrideClientProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [overrideEnabled, setOverrideEnabled] = useState(initialOverride.overrideEnabled);
  const [notifyEnabled,   setNotifyEnabled]   = useState(initialOverride.notifyEnabled);
  const [confirmEnabled,  setConfirmEnabled]  = useState(initialOverride.confirmEnabled);
  const [storeEnabled,    setStoreEnabled]    = useState(initialOverride.storeEnabled);
  const [turnstileEnabled, setTurnstileEnabled] = useState(initialOverride.turnstileEnabled ?? false);
  const [recipients,      setRecipients]      = useState(initialOverride.customRecipients.join(", "));
  const [customSubject,   setCustomSubject]   = useState(initialOverride.customSubject ?? "");
  const [customSender,    setCustomSender]    = useState(initialOverride.customSenderName ?? "");

  const [saveStatus,  setSaveStatus]  = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [resetStatus, setResetStatus] = useState<"idle" | "resetting" | "done" | "error">("idle");
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const [isPending,   startTransition] = useTransition();

  const isBusy = isPending || saveStatus === "saving" || resetStatus === "resetting";

  // ── Save handler ───────────────────────────────────────────────────────────
  function handleSave() {
    setSaveStatus("saving");
    setErrorMsg(null);

    const parsed = recipients
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    startTransition(async () => {
      const result = await saveAction({
        overrideEnabled,
        notifyEnabled,
        confirmEnabled,
        storeEnabled,
        turnstileEnabled,
        customRecipients: parsed,
        customSubject:    customSubject.trim() || undefined,
        customSenderName: customSender.trim()  || undefined,
      });

      if (result.ok) {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("error");
        setErrorMsg(result.error);
      }
    });
  }

  // ── Reset handler ──────────────────────────────────────────────────────────
  function handleReset() {
    if (!confirm("Reset this form to tenant defaults? All per-form overrides will be removed.")) return;

    setResetStatus("resetting");
    setErrorMsg(null);

    startTransition(async () => {
      const result = await resetAction();

      if (result.ok) {
        // Restore UI to defaults
        setOverrideEnabled(false);
        setNotifyEnabled(true);
        setConfirmEnabled(true);
        setStoreEnabled(true);
        setTurnstileEnabled(false);
        setRecipients("");
        setCustomSubject("");
        setCustomSender("");
        setResetStatus("done");
        setTimeout(() => setResetStatus("idle"), 3000);
      } else {
        setResetStatus("error");
        setErrorMsg(result.error);
      }
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Master override toggle ───────────────────────────────────────── */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-5 py-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Override Tenant Defaults</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              When enabled, the settings below override the tenant-level defaults for this form only.
              When disabled, all settings inherit from the tenant.
            </p>
          </div>
          <Toggle
            value={overrideEnabled}
            onChange={setOverrideEnabled}
            disabled={isBusy}
          />
        </div>

        {/* Current effective source — tenant defaults preview */}
        {!overrideEnabled && (
          <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50">
            <p className="text-xs text-neutral-500">
              Using tenant defaults,{" "}
              <span className="font-medium text-neutral-700">
                Notify: {tenantNotify ? "on" : "off"},{" "}
                Confirm: {tenantConfirm ? "on" : "off"},{" "}
                Store: {tenantStore ? "on" : "off"}
              </span>
              {tenantRecipients.length > 0 && (
                <>, Recipients: {tenantRecipients.join(", ")}</>
              )}
            </p>
          </div>
        )}
      </div>

      {/* ── Action flags ─────────────────────────────────────────────────── */}
      <div className={`rounded-xl border border-neutral-200 bg-white overflow-hidden ${!overrideEnabled ? "opacity-50 pointer-events-none" : ""}`}>
        <div className="px-5 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">Action Flags</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Control which actions run for submissions to this form.
            These override the tenant defaults when "Override Tenant Defaults" is enabled.
          </p>
        </div>

        <div className="divide-y divide-neutral-100">
          <FlagRow
            label="Backoffice notification"
            description="Send a notification email to the configured recipients on each submission."
            defValue={defNotify}
            tenantValue={tenantNotify}
            value={notifyEnabled}
            onChange={setNotifyEnabled}
            disabled={isBusy || !overrideEnabled}
          />
          <FlagRow
            label="Submitter confirmation"
            description="Send a confirmation email to the person who submitted the form."
            defValue={defConfirm}
            tenantValue={tenantConfirm}
            value={confirmEnabled}
            onChange={setConfirmEnabled}
            disabled={isBusy || !overrideEnabled}
          />
          <FlagRow
            label="Store submission"
            description="Write the submission to the form_submissions database table."
            defValue={defStore}
            tenantValue={tenantStore}
            value={storeEnabled}
            onChange={setStoreEnabled}
            disabled={isBusy || !overrideEnabled}
          />
        </div>
      </div>

      {/* ── Spam protection (Turnstile) — independent of the override toggle ── */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">Spam protection</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Require a Cloudflare Turnstile challenge on this form. Applies on its own.
            It does not depend on &ldquo;Override Tenant Defaults&rdquo;.
          </p>
        </div>
        <div className="px-5 py-4 flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-neutral-800">Cloudflare Turnstile (CAPTCHA)</p>
            <p className="text-xs text-neutral-500 mt-0.5">
              On top of the always-on honeypot and rate-limit.
            </p>
            {turnstileHasKeys === false && (
              <p className="text-xs text-amber-600 mt-1">
                No Turnstile keys configured for this tenant yet. Add the site &amp; secret key under
                Forms settings first, otherwise this toggle has no effect.
              </p>
            )}
          </div>
          <Toggle value={turnstileEnabled} onChange={setTurnstileEnabled} disabled={isBusy} />
        </div>
      </div>

      {/* ── Custom recipients ─────────────────────────────────────────────── */}
      <div className={`rounded-xl border border-neutral-200 bg-white overflow-hidden ${!overrideEnabled ? "opacity-50 pointer-events-none" : ""}`}>
        <div className="px-5 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">Custom Notification Recipients</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Override the tenant-level recipients for backoffice notifications from this form only.
            Separate addresses with commas or newlines. Leave empty to use tenant recipients.
          </p>
        </div>
        <div className="px-5 py-4">
          <textarea
            value={recipients}
            onChange={(e) => setRecipients(e.target.value)}
            disabled={isBusy || !overrideEnabled}
            placeholder={
              tenantRecipients.length > 0
                ? `Tenant recipients: ${tenantRecipients.join(", ")}`
                : "e.g. sales@company.com, hr@company.com"
            }
            rows={3}
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50 resize-none"
          />
        </div>
      </div>

      {/* ── Email customisation ───────────────────────────────────────────── */}
      <div className={`rounded-xl border border-neutral-200 bg-white overflow-hidden ${!overrideEnabled ? "opacity-50 pointer-events-none" : ""}`}>
        <div className="px-5 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">Email Customisation</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Optional overrides for the backoffice notification email subject and "From" display name.
            Leave blank to use the form definition or tenant defaults.
          </p>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Custom subject
            </label>
            <input
              type="text"
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              disabled={isBusy || !overrideEnabled}
              placeholder="e.g. New contact form submission from {{name}}"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50"
            />
            <p className="text-xs text-neutral-400 mt-1">Leave blank to use the default subject from the form definition.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">
              Custom sender name
            </label>
            <input
              type="text"
              value={customSender}
              onChange={(e) => setCustomSender(e.target.value)}
              disabled={isBusy || !overrideEnabled}
              placeholder="e.g. Acme Careers Team"
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-50"
            />
            <p className="text-xs text-neutral-400 mt-1">Overrides the "From" display name for emails sent by this form.</p>
          </div>
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          <span className="font-medium">Error: </span>{errorMsg}
        </div>
      )}

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 pt-2">
        <button
          onClick={handleReset}
          disabled={isBusy}
          className="text-xs text-neutral-500 underline hover:text-neutral-700 disabled:opacity-40"
        >
          {resetStatus === "resetting" ? "Resetting…" : resetStatus === "done" ? "Reset ✓" : "Reset to tenant defaults"}
        </button>

        <button
          onClick={handleSave}
          disabled={isBusy}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50 transition-colors"
        >
          {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved ✓" : "Save overrides"}
        </button>
      </div>

    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Toggle({
  value,
  onChange,
  disabled,
}: {
  value:    boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      disabled={disabled}
      aria-pressed={value}
      className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 disabled:opacity-50 ${
        value ? "bg-neutral-900" : "bg-neutral-300"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
          value ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function FlagRow({
  label,
  description,
  defValue,
  tenantValue,
  value,
  onChange,
  disabled,
}: {
  label:       string;
  description: string;
  defValue:    boolean;
  tenantValue: boolean;
  value:       boolean;
  onChange:    (v: boolean) => void;
  disabled:    boolean;
}) {
  return (
    <div className="px-5 py-4 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-800">{label}</p>
        <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
        <p className="text-xs text-neutral-400 mt-1">
          Definition default: <span className="font-medium">{defValue ? "on" : "off"}</span>
          {" · "}
          Tenant default: <span className="font-medium">{tenantValue ? "on" : "off"}</span>
        </p>
      </div>
      <Toggle value={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}
