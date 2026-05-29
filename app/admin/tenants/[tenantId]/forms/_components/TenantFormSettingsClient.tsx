"use client";

/**
 * TenantFormSettingsClient
 *
 * Client component for the tenant form settings editor.
 * Renders a form that lets admins configure:
 *   - DB storage on/off
 *   - Notification email recipients (one per line)
 *   - Submitter confirmation on/off
 *   - Webhook URL
 *   - Success message override
 *   - Redirect URL after success
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import type { TenantFormSettings } from "@/tenant/types";

interface TenantFormSettingsClientProps {
  initialSettings: TenantFormSettings;
  saveAction:      (settings: TenantFormSettings) => Promise<{ ok: true } | { ok: false; error: string }>;
}

export function TenantFormSettingsClient({
  initialSettings,
  saveAction,
}: TenantFormSettingsClientProps) {
  const [settings, setSettings] = useState<TenantFormSettings>(initialSettings);
  const [recipientsText, setRecipientsText] = useState<string>(
    initialSettings.notificationRecipients.join("\n"),
  );
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [isDirty, setIsDirty]       = useState(false);

  const patch = useCallback(<K extends keyof TenantFormSettings>(
    key: K,
    value: TenantFormSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
    setSaveStatus("idle");
  }, []);

  const handleSave = async () => {
    setSaveStatus("saving");
    setErrorMsg(null);

    // Parse recipients from the textarea (one per line, trim blanks).
    const recipients = recipientsText
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s !== "" && s.includes("@"));

    const toSave: TenantFormSettings = {
      ...settings,
      notificationRecipients: recipients,
    };

    const result = await saveAction(toSave);
    if (result.ok) {
      setSaveStatus("saved");
      setIsDirty(false);
      // Sync state with saved values.
      setSettings(toSave);
      setRecipientsText(recipients.join("\n"));
    } else {
      setSaveStatus("error");
      setErrorMsg(result.error);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Submission Storage ─────────────────────────────────────────── */}
      <Section
        title="Submission Storage"
        description="Whether form submissions are stored in the database."
      >
        <Toggle
          id="storeSubmissions"
          label="Store submissions in database"
          hint="Records each submission to the form_submissions table for later review."
          checked={settings.storeSubmissions}
          onChange={(v) => patch("storeSubmissions", v)}
        />
      </Section>

      {/* ── Notification Recipients ────────────────────────────────────── */}
      <Section
        title="Notification Recipients"
        description="Email addresses that receive a notification on each new submission."
      >
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1" htmlFor="recipients">
            Email addresses <span className="text-neutral-400 font-normal">(one per line)</span>
          </label>
          <textarea
            id="recipients"
            rows={4}
            value={recipientsText}
            onChange={(e) => {
              setRecipientsText(e.target.value);
              setIsDirty(true);
              setSaveStatus("idle");
            }}
            placeholder={"admin@example.com\nsales@example.com"}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-mono text-neutral-800 placeholder-neutral-400 focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] resize-y"
          />
          <p className="mt-1 text-xs text-neutral-400">
            When empty, falls back to the platform default backoffice address (configured at{" "}
            <Link href="/admin/platform/integrations/email" className="underline hover:text-neutral-600">
              Platform › Email
            </Link>
            ), then the{" "}
            <code className="bg-neutral-100 px-1 rounded">BACKOFFICE_EMAIL</code> env var.
          </p>
        </div>
      </Section>

      {/* ── Confirmation Email ─────────────────────────────────────────── */}
      <Section
        title="Confirmation Email"
        description="Automatically send a confirmation email to the person who submitted the form."
      >
        <Toggle
          id="sendConfirmationEmails"
          label="Send confirmation to submitter"
          hint="Requires email transport configured in the Email Transport section above, at the platform level (Platform › Email), or via env vars. Uses the email field from the form submission."
          checked={settings.sendConfirmationEmails}
          onChange={(v) => patch("sendConfirmationEmails", v)}
        />
      </Section>

      {/* ── Webhook ────────────────────────────────────────────────────── */}
      <Section
        title="Webhook"
        description="POST submission data to a custom URL (n8n, Zapier, Make, HubSpot, etc.)."
      >
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1" htmlFor="webhookUrl">
            Webhook URL <span className="text-neutral-400 font-normal">(optional)</span>
          </label>
          <input
            id="webhookUrl"
            type="url"
            value={settings.webhookUrl ?? ""}
            onChange={(e) => patch("webhookUrl", e.target.value.trim() || undefined)}
            placeholder="https://n8n.example.com/webhook/xxx"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-mono text-neutral-800 placeholder-neutral-400 focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
          />
          <p className="mt-1 text-xs text-neutral-400">
            Payload: <code className="bg-neutral-100 px-1 rounded">{"{ formKey, values, tenantId }"}</code>
          </p>
        </div>

        <Toggle
          id="hubspotEnabled"
          label="HubSpot integration (coming soon)"
          hint="Requires HUBSPOT_PORTAL_ID and HUBSPOT_FORM_GUID env vars. Not yet active."
          checked={settings.hubspotEnabled ?? false}
          onChange={(v) => patch("hubspotEnabled", v)}
          disabled
        />
      </Section>

      {/* ── Success Behavior ───────────────────────────────────────────── */}
      <Section
        title="Success Behavior"
        description="What the submitter sees after a successful submission."
      >
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1" htmlFor="successMessage">
            Success message override <span className="text-neutral-400 font-normal">(optional)</span>
          </label>
          <input
            id="successMessage"
            type="text"
            value={settings.successMessage ?? ""}
            onChange={(e) => patch("successMessage", e.target.value.trim() || undefined)}
            placeholder="Thank you — we'll be in touch soon."
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 placeholder-neutral-400 focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
          />
          <p className="mt-1 text-xs text-neutral-400">
            Overrides per-form definition message. Leave empty to use the form default.
          </p>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-neutral-700 mb-1" htmlFor="successRedirectUrl">
            Redirect URL <span className="text-neutral-400 font-normal">(optional)</span>
          </label>
          <input
            id="successRedirectUrl"
            type="text"
            value={settings.successRedirectUrl ?? ""}
            onChange={(e) => patch("successRedirectUrl", e.target.value.trim() || undefined)}
            placeholder="/thank-you"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-mono text-neutral-800 placeholder-neutral-400 focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
          />
          <p className="mt-1 text-xs text-neutral-400">
            When set, the form navigates here after submission instead of showing the inline success message.
          </p>
        </div>
      </Section>

      {/* ── Save bar ───────────────────────────────────────────────────── */}
      <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-neutral-200 bg-white pt-4 pb-2">
        {saveStatus === "error" && errorMsg && (
          <p className="text-sm text-red-600 flex-1">{errorMsg}</p>
        )}
        {saveStatus === "saved" && (
          <p className="text-sm text-green-600 flex-1">Settings saved.</p>
        )}
        {saveStatus === "idle" && isDirty && (
          <p className="text-xs text-amber-600 flex-1">Unsaved changes</p>
        )}
        {saveStatus === "idle" && !isDirty && (
          <span className="flex-1" />
        )}
        {saveStatus === "saving" && (
          <p className="text-sm text-neutral-400 flex-1">Saving…</p>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saveStatus === "saving" || !isDirty}
          className="inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-700 transition-colors disabled:opacity-40"
        >
          {saveStatus === "saving" ? "Saving…" : "Save settings"}
        </button>
      </div>
    </div>
  );
}

// ── Primitive sub-components ──────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title:       string;
  description: string;
  children:    React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
      </div>
      {children}
    </div>
  );
}

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
