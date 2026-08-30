"use client";

/**
 * EmailPlatformClient
 *
 * Client component for the platform-level email transport configuration editor.
 * Accessible at /admin/platform/integrations/email.
 *
 * Configures the PLATFORM-LEVEL email transport — the default used by all
 * tenants that do not have their own transport configured in
 * /admin/tenants/[id]/forms (tenant_email_transport).
 *
 * Fields:
 *   • Transport type: none / Resend / SMTP
 *   • Backoffice email  — platform-level fallback notification recipient
 *   • From name + from email
 *   • Resend API key (encrypted, "has key" indicator + replace flow)
 *   • SMTP: host, port, username, password (encrypted), TLS toggle
 *
 * ─── Secret handling ──────────────────────────────────────────────────────────
 *
 *   Secrets are never returned from the server — only boolean "has X" flags.
 *   When stored: shows "Key saved ✓" badge + "Replace" button.
 *   Submitting with an empty field preserves the stored secret.
 */

import { useState }            from "react";
import type {
  SafePlatformEmailConfig,
  PlatformEmailFormInput,
}                              from "../actions";
import { sendPlatformTestEmailAction } from "../actions";

// ── Props ──────────────────────────────────────────────────────────────────────

interface EmailPlatformClientProps {
  initialConfig: SafePlatformEmailConfig;
  saveAction: (input: PlatformEmailFormInput) => Promise<{ ok: true } | { ok: false; error: string }>;
  clearAction: () => Promise<{ ok: true } | { ok: false; error: string }>;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function EmailPlatformClient({
  initialConfig,
  saveAction,
  clearAction,
}: EmailPlatformClientProps) {
  // ── Form state ──────────────────────────────────────────────────────────────
  const [transportType, setTransportType] = useState<"none" | "resend" | "smtp">(
    initialConfig.transportType,
  );
  const [fromName,        setFromName]        = useState(initialConfig.fromName);
  const [fromEmail,       setFromEmail]       = useState(initialConfig.fromEmail);
  const [backofficeEmail, setBackofficeEmail] = useState(initialConfig.backofficeEmail);

  // Resend
  const [resendApiKey,    setResendApiKey]    = useState("");
  const [showResendInput, setShowResendInput] = useState(!initialConfig.hasResendKey);
  const [hasResendKey,    setHasResendKey]    = useState(initialConfig.hasResendKey);

  // SMTP
  const [smtpHost,        setSmtpHost]        = useState(initialConfig.smtpHost);
  const [smtpPort,        setSmtpPort]        = useState(String(initialConfig.smtpPort || 587));
  const [smtpUsername,    setSmtpUsername]    = useState(initialConfig.smtpUsername);
  const [smtpPassword,    setSmtpPassword]    = useState("");
  const [showSmtpPwInput, setShowSmtpPwInput] = useState(!initialConfig.hasSmtpPassword);
  const [hasSmtpPassword, setHasSmtpPassword] = useState(initialConfig.hasSmtpPassword);
  const [smtpSecure,      setSmtpSecure]      = useState(initialConfig.smtpSecure);

  // ── Dirty / save state ──────────────────────────────────────────────────────
  const [isDirty,    setIsDirty]    = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);

  const markDirty = () => {
    setIsDirty(true);
    setSaveStatus("idle");
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaveStatus("saving");
    setErrorMsg(null);

    const input: PlatformEmailFormInput = {
      transportType,
      fromName:        fromName.trim(),
      fromEmail:       fromEmail.trim(),
      backofficeEmail: backofficeEmail.trim(),
      resendApiKey:    showResendInput ? resendApiKey.trim() : "",
      smtpHost:        smtpHost.trim(),
      smtpPort:        smtpPort.trim() || "587",
      smtpUsername:    smtpUsername.trim(),
      smtpPassword:    showSmtpPwInput ? smtpPassword.trim() : "",
      smtpSecure,
    };

    const result = await saveAction(input);

    if (result.ok) {
      setSaveStatus("saved");
      setIsDirty(false);

      if (transportType === "resend" && showResendInput && resendApiKey.trim()) {
        setHasResendKey(true);
        setShowResendInput(false);
        setResendApiKey("");
      }
      if (transportType === "smtp" && showSmtpPwInput && smtpPassword.trim()) {
        setHasSmtpPassword(true);
        setShowSmtpPwInput(false);
        setSmtpPassword("");
      }
    } else {
      setSaveStatus("error");
      setErrorMsg(result.error);
    }
  };

  // ── Clear transport ─────────────────────────────────────────────────────────
  const handleClear = async () => {
    if (!confirm("Reset transport to 'none'? Stored credentials will be cleared.")) return;
    setSaveStatus("saving");
    const result = await clearAction();
    if (result.ok) {
      setTransportType("none");
      setHasResendKey(false);
      setShowResendInput(true);
      setResendApiKey("");
      setHasSmtpPassword(false);
      setShowSmtpPwInput(true);
      setSmtpPassword("");
      setSaveStatus("saved");
      setIsDirty(false);
    } else {
      setSaveStatus("error");
      setErrorMsg(result.error);
    }
  };

  // ── Send test email ──────────────────────────────────────────────────────────
  const [testTo,     setTestTo]     = useState("");
  const [testStatus, setTestStatus] = useState<"idle" | "sending">("idle");
  const [testMsg,    setTestMsg]    = useState<{ ok: boolean; text: string } | null>(null);

  const handleTest = async () => {
    setTestStatus("sending"); setTestMsg(null);
    const r = await sendPlatformTestEmailAction(testTo);
    setTestMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
    setTestStatus("idle");
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Transport type ─────────────────────────────────────────────────── */}
      <Section
        title="Default Transport"
        description="Platform-wide fallback transport used when a tenant has no transport configured in their Forms settings. Tenants always take priority over this."
      >
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-neutral-700 mb-2">Transport type</legend>

          {(["none", "resend", "smtp"] as const).map((type) => (
            <label key={type} className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="platformTransportType"
                value={type}
                checked={transportType === type}
                onChange={() => { setTransportType(type); markDirty(); }}
                className="h-4 w-4 border-neutral-300 accent-[var(--primary)]"
              />
              <span className="text-sm text-neutral-800">
                {type === "none"   && "None: fall back to RESEND_API_KEY / SMTP_HOST env vars (no platform default)"}
                {type === "resend" && "Resend: use the Resend transactional email API"}
                {type === "smtp"   && "SMTP: connect to a custom mail server"}
              </span>
            </label>
          ))}
        </fieldset>

        {transportType !== "none" && initialConfig.configured && (
          <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-green-700">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
              Transport configured
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-neutral-400 underline hover:text-neutral-600"
            >
              Reset to none
            </button>
          </div>
        )}
      </Section>

      {/* ── Backoffice recipient ─────────────────────────────────────────────── */}
      <Section
        title="Default Backoffice Notification Address"
        description="Platform-wide fallback for backoffice notifications. Used when a tenant has no notification recipients configured in their Forms settings. Tenant recipients always take priority over this address."
      >
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1" htmlFor="backofficeEmail">
            Backoffice email <span className="text-neutral-400 font-normal">(optional)</span>
          </label>
          <input
            id="backofficeEmail"
            type="email"
            value={backofficeEmail}
            onChange={(e) => { setBackofficeEmail(e.target.value); markDirty(); }}
            placeholder="team@yourdomain.com"
            className={inputCls}
          />
          <p className="mt-1 text-xs text-neutral-400">
            When set here, this overrides the{" "}
            <code className="bg-neutral-100 px-1 rounded">BACKOFFICE_EMAIL</code> env var.
          </p>
        </div>
      </Section>

      {/* ── Sender identity ──────────────────────────────────────────────────── */}
      {transportType !== "none" && (
        <Section
          title="Sender Identity"
          description="The From address shown to recipients for all platform emails."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1" htmlFor="pfFromName">
                From name <span className="text-neutral-400 font-normal">(optional)</span>
              </label>
              <input
                id="pfFromName"
                type="text"
                value={fromName}
                onChange={(e) => { setFromName(e.target.value); markDirty(); }}
                placeholder="Acme Platform"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1" htmlFor="pfFromEmail">
                From email
              </label>
              <input
                id="pfFromEmail"
                type="email"
                value={fromEmail}
                onChange={(e) => { setFromEmail(e.target.value); markDirty(); }}
                placeholder="noreply@yourdomain.com"
                className={inputCls}
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-neutral-400">
            Falls back to the <code className="bg-neutral-100 px-1 rounded">MAIL_FROM_ADDRESS</code>{" "}
            env var when left blank.
          </p>
        </Section>
      )}

      {/* ── Resend config ────────────────────────────────────────────────────── */}
      {transportType === "resend" && (
        <Section
          title="Resend API Key"
          description="API key from your Resend account (resend.com). Stored encrypted at rest."
        >
          {hasResendKey && !showResendInput ? (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs font-medium text-green-700">
                <span aria-hidden>✓</span> Key saved
              </span>
              <button
                type="button"
                onClick={() => { setShowResendInput(true); markDirty(); }}
                className="text-xs text-neutral-500 underline hover:text-neutral-700"
              >
                Replace key
              </button>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1" htmlFor="pfResendKey">
                API key
              </label>
              <input
                id="pfResendKey"
                type="password"
                autoComplete="off"
                value={resendApiKey}
                onChange={(e) => { setResendApiKey(e.target.value); markDirty(); }}
                placeholder="re_xxxxxxxxxxxxxxxxxxxx"
                className={inputCls + " font-mono"}
              />
              {hasResendKey && (
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-xs text-neutral-400">Leave empty to keep the existing key.</p>
                  <button
                    type="button"
                    onClick={() => { setShowResendInput(false); setResendApiKey(""); }}
                    className="text-xs text-neutral-500 underline hover:text-neutral-700"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </Section>
      )}

      {/* ── SMTP config ──────────────────────────────────────────────────────── */}
      {transportType === "smtp" && (
        <Section
          title="SMTP Settings"
          description="Connection details for your mail server. Password stored encrypted at rest."
        >
          <div className="space-y-4">

            {/* Host + Port */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-neutral-700 mb-1" htmlFor="pfSmtpHost">
                  Host
                </label>
                <input
                  id="pfSmtpHost"
                  type="text"
                  value={smtpHost}
                  onChange={(e) => { setSmtpHost(e.target.value); markDirty(); }}
                  placeholder="smtp.mailprovider.com"
                  className={inputCls + " font-mono"}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1" htmlFor="pfSmtpPort">
                  Port
                </label>
                <input
                  id="pfSmtpPort"
                  type="number"
                  min={1}
                  max={65535}
                  value={smtpPort}
                  onChange={(e) => { setSmtpPort(e.target.value); markDirty(); }}
                  placeholder="587"
                  className={inputCls + " font-mono"}
                />
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1" htmlFor="pfSmtpUser">
                Username
              </label>
              <input
                id="pfSmtpUser"
                type="text"
                autoComplete="username"
                value={smtpUsername}
                onChange={(e) => { setSmtpUsername(e.target.value); markDirty(); }}
                placeholder="you@mailprovider.com"
                className={inputCls}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Password
              </label>
              {hasSmtpPassword && !showSmtpPwInput ? (
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-3 py-1 text-xs font-medium text-green-700">
                    <span aria-hidden>✓</span> Password saved
                  </span>
                  <button
                    type="button"
                    onClick={() => { setShowSmtpPwInput(true); markDirty(); }}
                    className="text-xs text-neutral-500 underline hover:text-neutral-700"
                  >
                    Replace password
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    id="pfSmtpPw"
                    type="password"
                    autoComplete="new-password"
                    value={smtpPassword}
                    onChange={(e) => { setSmtpPassword(e.target.value); markDirty(); }}
                    placeholder="••••••••••••"
                    className={inputCls + " font-mono"}
                  />
                  {hasSmtpPassword && (
                    <div className="mt-2 flex items-center gap-2">
                      <p className="text-xs text-neutral-400">Leave empty to keep the existing password.</p>
                      <button
                        type="button"
                        onClick={() => { setShowSmtpPwInput(false); setSmtpPassword(""); }}
                        className="text-xs text-neutral-500 underline hover:text-neutral-700"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* TLS toggle */}
            <label
              htmlFor="pfSmtpSecure"
              className="flex items-start gap-3 cursor-pointer"
            >
              <div className="mt-0.5">
                <input
                  id="pfSmtpSecure"
                  type="checkbox"
                  checked={smtpSecure}
                  onChange={(e) => { setSmtpSecure(e.target.checked); markDirty(); }}
                  className="h-4 w-4 rounded border-neutral-300 accent-[var(--primary)]"
                />
              </div>
              <div>
                <span className="block text-sm font-medium text-neutral-800">Use TLS / SSL</span>
                <span className="block text-xs text-neutral-500 mt-0.5">
                  Enable for port 465 (SSL). Leave off for port 587 (STARTTLS), which most providers prefer.
                </span>
              </div>
            </label>
          </div>
        </Section>
      )}

      {/* ── Send test email ──────────────────────────────────────────────────── */}
      <Section
        title="Send a test email"
        description="Sends a test message using the saved platform transport above (Resend/SMTP), the quickest way to verify your credentials and from-address. Save your changes first."
      >
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-medium text-neutral-700 mb-1" htmlFor="pfTestTo">
              Recipient
            </label>
            <input
              id="pfTestTo"
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="you@yourdomain.com"
              className={inputCls}
            />
          </div>
          <button
            type="button"
            onClick={handleTest}
            disabled={testStatus === "sending" || !testTo.trim() || isDirty}
            className="inline-flex items-center rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 transition-colors disabled:opacity-40"
          >
            {testStatus === "sending" ? "Sending…" : "Send test"}
          </button>
        </div>
        {isDirty && <p className="mt-2 text-xs text-amber-600">Save your changes before sending a test.</p>}
        {testMsg && <p className={"mt-2 text-sm " + (testMsg.ok ? "text-green-600" : "text-red-600")}>{testMsg.text}</p>}
      </Section>

      {/* ── Save bar ─────────────────────────────────────────────────────────── */}
      <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-neutral-200 bg-white pt-4 pb-2">
        <div className="flex-1 text-sm">
          {saveStatus === "error"  && errorMsg  && <p className="text-red-600">{errorMsg}</p>}
          {saveStatus === "saved"               && <p className="text-green-600">Platform email settings saved.</p>}
          {saveStatus === "idle"   && isDirty   && <p className="text-xs text-amber-600">Unsaved changes</p>}
          {saveStatus === "saving"              && <p className="text-neutral-400">Saving…</p>}
        </div>
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

// ── Shared style ──────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 " +
  "placeholder-neutral-400 focus:border-[var(--ring)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]";

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
