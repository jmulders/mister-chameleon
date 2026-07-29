"use client";

/**
 * DefaultFormBehaviorClient
 *
 * Manages default form-behavior settings that apply to all forms for this tenant:
 *
 *   • storeSubmissions       — write to form_submissions table
 *   • sendConfirmationEmails — send confirmation to submitter
 *   • webhookUrl             — fire a POST on every submission
 *   • hubspotEnabled         — HubSpot integration (coming soon)
 *   • successMessage         — override per-form success message
 *   • successRedirectUrl     — navigate here after submission
 *
 * ─── Save model ───────────────────────────────────────────────────────────────
 *
 *   Saves via saveFormBehaviorAction which reads the current row, merges only
 *   these fields, and writes back.  Notification recipient changes made in the
 *   Notification Recipients section above are preserved.
 */

import { useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DefaultFormBehaviorData {
  storeSubmissions:       boolean;
  sendConfirmationEmails: boolean;
  webhookUrl?:            string;
  hubspotEnabled?:        boolean;
  successMessage?:        string;
  successRedirectUrl?:    string;
}

interface DefaultFormBehaviorClientProps {
  initial:     DefaultFormBehaviorData;
  saveAction:  (data: DefaultFormBehaviorData) => Promise<{ ok: true } | { ok: false; error: string }>;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function DefaultFormBehaviorClient({
  initial,
  saveAction,
}: DefaultFormBehaviorClientProps) {
  const [data, setData]           = useState<DefaultFormBehaviorData>(initial);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);
  const [isDirty, setIsDirty]     = useState(false);

  const patch = useCallback(<K extends keyof DefaultFormBehaviorData>(
    key: K,
    value: DefaultFormBehaviorData[K],
  ) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
    setSaveStatus("idle");
  }, []);

  const handleSave = async () => {
    setSaveStatus("saving");
    setErrorMsg(null);

    const result = await saveAction(data);
    if (result.ok) {
      setSaveStatus("saved");
      setIsDirty(false);
    } else {
      setSaveStatus("error");
      setErrorMsg(result.error);
    }
  };

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      {/* ── Section header ──────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-neutral-100">
        <h2 className="text-sm font-semibold text-neutral-900">Default Form Behavior</h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Tenant-wide defaults applied to all forms. Individual form definitions can override
          Store and Notify at the code level.
        </p>
      </div>

      {/* ── Fields ──────────────────────────────────────────────────────── */}
      <div className="px-5 py-4 space-y-6">

        {/* ── Storage + Confirmation ────────────────────────────────────── */}
        <div className="space-y-3">
          <Toggle
            id="storeSubmissions"
            label="Store submissions in database"
            hint="Writes each submission to the form_submissions table so it can be reviewed later. Disabling only stops DB writes. Email and webhook still fire."
            checked={data.storeSubmissions}
            onChange={(v) => patch("storeSubmissions", v)}
          />
          <Toggle
            id="sendConfirmationEmails"
            label="Send confirmation email to submitter"
            hint="Requires email transport to be configured. Uses the email field from the form submission as the recipient."
            checked={data.sendConfirmationEmails}
            onChange={(v) => patch("sendConfirmationEmails", v)}
          />
        </div>

        {/* ── Webhook ───────────────────────────────────────────────────── */}
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1" htmlFor="webhookUrl">
            Webhook URL <span className="text-neutral-400 font-normal">(optional)</span>
          </label>
          <input
            id="webhookUrl"
            type="url"
            value={data.webhookUrl ?? ""}
            onChange={(e) => patch("webhookUrl", e.target.value.trim() || undefined)}
            placeholder="https://n8n.example.com/webhook/xxx"
            className={inputCls + " font-mono"}
          />
          <p className="mt-1 text-xs text-neutral-400">
            Receives a <code className="bg-neutral-100 px-0.5 rounded">POST</code> on every valid
            submission. Payload:{" "}
            <code className="bg-neutral-100 px-0.5 rounded">
              {"{ formKey, values, tenantId }"}
            </code>
          </p>
        </div>

        <Toggle
          id="hubspotEnabled"
          label="HubSpot integration (coming soon)"
          hint="Requires HUBSPOT_PORTAL_ID and HUBSPOT_FORM_GUID env vars. Not yet active."
          checked={data.hubspotEnabled ?? false}
          onChange={(v) => patch("hubspotEnabled", v)}
          disabled
        />

        {/* ── Success behavior ──────────────────────────────────────────── */}
        <div className="space-y-4 pt-2 border-t border-neutral-100">
          <p className="text-xs font-medium text-neutral-700 pt-1">Success behavior</p>

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1" htmlFor="successMessage">
              Success message override{" "}
              <span className="text-neutral-400 font-normal">(optional)</span>
            </label>
            <input
              id="successMessage"
              type="text"
              value={data.successMessage ?? ""}
              onChange={(e) => patch("successMessage", e.target.value.trim() || undefined)}
              placeholder="Thank you, we'll be in touch soon."
              className={inputCls}
            />
            <p className="mt-1 text-xs text-neutral-400">
              Overrides the per-form definition message. Leave empty to use the form default.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1" htmlFor="successRedirectUrl">
              Redirect URL{" "}
              <span className="text-neutral-400 font-normal">(optional)</span>
            </label>
            <input
              id="successRedirectUrl"
              type="text"
              value={data.successRedirectUrl ?? ""}
              onChange={(e) => patch("successRedirectUrl", e.target.value.trim() || undefined)}
              placeholder="/thank-you"
              className={inputCls + " font-mono"}
            />
            <p className="mt-1 text-xs text-neutral-400">
              When set, the form navigates here after submission instead of showing the inline
              success message. Use a root-relative path (
              <code className="bg-neutral-100 px-0.5 rounded">/thank-you</code>) or absolute URL.
            </p>
          </div>
        </div>
      </div>

      {/* ── Save bar ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 border-t border-neutral-100 bg-neutral-50 px-5 py-3">
        <StatusMessage status={saveStatus} errorMsg={errorMsg} isDirty={isDirty} savedText="Behavior settings saved." />
        <button
          type="button"
          onClick={handleSave}
          disabled={saveStatus === "saving" || !isDirty}
          className="inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-700 transition-colors disabled:opacity-40"
        >
          {saveStatus === "saving" ? "Saving…" : "Save behavior"}
        </button>
      </div>
    </div>
  );
}

// ── Primitive sub-components ──────────────────────────────────────────────────

const inputCls =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 " +
  "placeholder-neutral-400 focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]";

function Toggle({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled = false,
}: {
  id:        string;
  label:     string;
  hint:      string;
  checked:   boolean;
  onChange:  (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 cursor-pointer ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <div className="mt-0.5">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-300 accent-[var(--primary)]"
        />
      </div>
      <div>
        <span className="block text-sm font-medium text-neutral-800">{label}</span>
        <span className="block text-xs text-neutral-500 mt-0.5">{hint}</span>
      </div>
    </label>
  );
}

function StatusMessage({
  status,
  errorMsg,
  isDirty,
  savedText,
}: {
  status:    "idle" | "saving" | "saved" | "error";
  errorMsg:  string | null;
  isDirty:   boolean;
  savedText: string;
}) {
  if (status === "error" && errorMsg)  return <p className="text-sm text-red-600 flex-1">{errorMsg}</p>;
  if (status === "saved")              return <p className="text-sm text-green-600 flex-1">{savedText}</p>;
  if (status === "saving")             return <p className="text-sm text-neutral-400 flex-1">Saving…</p>;
  if (status === "idle" && isDirty)    return <p className="text-xs text-amber-600 flex-1">Unsaved changes</p>;
  return <span className="flex-1" />;
}
