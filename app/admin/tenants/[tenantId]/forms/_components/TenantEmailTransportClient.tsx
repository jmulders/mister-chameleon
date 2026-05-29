"use client";

/**
 * TenantEmailTransportClient
 *
 * Client component for the tenant email transport configuration editor.
 *
 * ─── Transport options ────────────────────────────────────────────────────────
 *
 *   "Use platform default" (none) — no tenant-specific transport; falls back
 *     to the platform-configured transport (Platform › Email) or env vars.
 *
 *   "Resend"               — use the Resend transactional email API with a
 *     tenant-specific API key.
 *
 *   "SMTP"                 — connect to a custom mail server with tenant-specific
 *     credentials.
 *
 * ─── Secret handling ──────────────────────────────────────────────────────────
 *
 *   Secrets (Resend API key, SMTP password) are never returned from the server.
 *   The server only tells us whether a secret is stored (hasResendKey / hasSmtpPassword).
 *
 *   When a secret is already stored:
 *     • The input is hidden and a "Key saved ✓" badge is shown.
 *     • A "Replace" button reveals the input so the user can provide a new value.
 *     • Submitting with an empty field KEEPS the stored secret unchanged.
 *
 * ─── Test email ───────────────────────────────────────────────────────────────
 *
 *   After saving a transport, the admin can send a test email to any address
 *   using the resolved transport (tenant → platform → env).  This validates
 *   delivery before the transport goes live for real submissions.
 *
 * ─── Reset to platform default ────────────────────────────────────────────────
 *
 *   Deletes the tenant transport row, falling back to platform/env defaults.
 *   Requires confirmation before executing.
 */

import { useState } from "react";
import type {
  SafeTransportConfig,
  TransportFormInput,
} from "../actions";

// ── Props ──────────────────────────────────────────────────────────────────────

interface TenantEmailTransportClientProps {
  initialConfig:    SafeTransportConfig;
  saveAction:       (input: TransportFormInput) => Promise<{ ok: true } | { ok: false; error: string }>;
  testEmailAction:  (recipientEmail: string) => Promise<{ ok: true; message: string } | { ok: false; error: string }>;
  resetAction:      () => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Platform transport type — shown when tenant is on "none" to confirm fallback is configured. */
  platformTransportType:  "resend" | "smtp" | "none";
  platformTransportLabel: string | null;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function TenantEmailTransportClient({
  initialConfig,
  saveAction,
  testEmailAction,
  resetAction,
  platformTransportType,
  platformTransportLabel,
}: TenantEmailTransportClientProps) {
  // ── Form state ─────────────────────────────────────────────────────────────
  const [transportType, setTransportType] = useState<"none" | "resend" | "smtp">(
    initialConfig.transportType,
  );
  const [fromName,  setFromName]  = useState(initialConfig.fromName);
  const [fromEmail, setFromEmail] = useState(initialConfig.fromEmail);

  // Resend
  const [resendApiKey,     setResendApiKey]     = useState("");
  const [showResendInput,  setShowResendInput]  = useState(!initialConfig.hasResendKey);
  const [hasResendKey,     setHasResendKey]     = useState(initialConfig.hasResendKey);

  // SMTP
  const [smtpHost,        setSmtpHost]        = useState(initialConfig.smtpHost);
  const [smtpPort,        setSmtpPort]        = useState(String(initialConfig.smtpPort || 587));
  const [smtpUsername,    setSmtpUsername]    = useState(initialConfig.smtpUsername);
  const [smtpPassword,    setSmtpPassword]    = useState("");
  const [showSmtpPwInput, setShowSmtpPwInput] = useState(!initialConfig.hasSmtpPassword);
  const [hasSmtpPassword, setHasSmtpPassword] = useState(initialConfig.hasSmtpPassword);
  const [smtpSecure,      setSmtpSecure]      = useState(initialConfig.smtpSecure);

  // ── Save state ─────────────────────────────────────────────────────────────
  const [isDirty,    setIsDirty]    = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);

  const markDirty = () => {
    setIsDirty(true);
    setSaveStatus("idle");
  };

  // ── Test email state ───────────────────────────────────────────────────────
  const [testRecipient,  setTestRecipient]  = useState("");
  const [testStatus,     setTestStatus]     = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [testMsg,        setTestMsg]        = useState<string | null>(null);

  // ── Reset state ────────────────────────────────────────────────────────────
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetStatus,      setResetStatus]      = useState<"idle" | "resetting" | "done" | "error">("idle");
  const [resetError,       setResetError]       = useState<string | null>(null);

  // ── Save handler ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaveStatus("saving");
    setErrorMsg(null);

    const input: TransportFormInput = {
      transportType,
      fromName:     fromName.trim(),
      fromEmail:    fromEmail.trim(),
      resendApiKey: showResendInput ? resendApiKey.trim() : "",
      smtpHost:     smtpHost.trim(),
      smtpPort:     smtpPort.trim() || "587",
      smtpUsername: smtpUsername.trim(),
      smtpPassword: showSmtpPwInput ? smtpPassword.trim() : "",
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

  // ── Test email handler ─────────────────────────────────────────────────────
  const handleTestEmail = async () => {
    if (!testRecipient.includes("@")) return;
    setTestStatus("sending");
    setTestMsg(null);

    const result = await testEmailAction(testRecipient.trim());

    if (result.ok) {
      setTestStatus("sent");
      setTestMsg(result.message);
    } else {
      setTestStatus("error");
      setTestMsg(result.error);
    }
  };

  // ── Reset handler ──────────────────────────────────────────────────────────
  const handleReset = async () => {
    setResetStatus("resetting");
    setResetError(null);

    const result = await resetAction();
    if (result.ok) {
      setResetStatus("done");
      setShowResetConfirm(false);
      // Reset local state back to "none"
      setTransportType("none");
      setFromName("");
      setFromEmail("");
      setHasResendKey(false);
      setShowResendInput(true);
      setResendApiKey("");
      setHasSmtpPassword(false);
      setShowSmtpPwInput(true);
      setSmtpPassword("");
      setIsDirty(false);
      setSaveStatus("idle");
    } else {
      setResetStatus("error");
      setResetError(result.error);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      {/* ── Section header ──────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-neutral-100">
        <h2 className="text-sm font-semibold text-neutral-900">Email Transport</h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Configure a tenant-specific email transport, or use the{" "}
          <a href="/admin/platform/integrations/email" className="underline hover:text-neutral-700">
            platform default
          </a>
          . Tenant transport takes priority over the platform default and env vars.
        </p>
      </div>

      <div className="px-5 py-5 space-y-6">
        {/* ── Transport type ──────────────────────────────────────────────── */}
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-neutral-700 mb-2">Transport</legend>

          {(["none", "resend", "smtp"] as const).map((type) => (
            <label key={type} className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="transportType"
                value={type}
                checked={transportType === type}
                onChange={() => { setTransportType(type); markDirty(); }}
                className="mt-0.5 h-4 w-4 border-neutral-300 accent-[var(--primary)]"
              />
              <span className="text-sm text-neutral-800">
                {type === "none" && (
                  <>
                    <span className="font-medium">Use platform default</span>
                    <span className="text-neutral-500">
                      {" — falls back to "}
                      {platformTransportLabel
                        ? <span className="text-neutral-700">{platformTransportLabel}</span>
                        : <span className="text-amber-700">platform not configured — env vars checked next</span>}
                    </span>
                  </>
                )}
                {type === "resend" && (
                  <>
                    <span className="font-medium">Resend</span>
                    <span className="text-neutral-500"> — tenant-specific Resend API key</span>
                  </>
                )}
                {type === "smtp" && (
                  <>
                    <span className="font-medium">SMTP</span>
                    <span className="text-neutral-500"> — tenant-specific SMTP server</span>
                  </>
                )}
              </span>
            </label>
          ))}
        </fieldset>

        {/* ── Sender identity (shown for Resend / SMTP) ──────────────────── */}
        {transportType !== "none" && (
          <div>
            <p className="text-xs font-medium text-neutral-700 mb-2">Sender identity</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1" htmlFor="fromName">
                  From name <span className="text-neutral-400 font-normal">(optional)</span>
                </label>
                <input
                  id="fromName"
                  type="text"
                  value={fromName}
                  onChange={(e) => { setFromName(e.target.value); markDirty(); }}
                  placeholder="Acme Support"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1" htmlFor="fromEmail">
                  From email
                </label>
                <input
                  id="fromEmail"
                  type="email"
                  value={fromEmail}
                  onChange={(e) => { setFromEmail(e.target.value); markDirty(); }}
                  placeholder="noreply@acme.com"
                  className={inputCls}
                />
              </div>
            </div>
            <p className="mt-1.5 text-xs text-neutral-400">
              When blank, falls back to the platform From address, then the{" "}
              <code className="bg-neutral-100 px-0.5 rounded">MAIL_FROM_ADDRESS</code> env var.
            </p>
          </div>
        )}

        {/* ── Resend config ───────────────────────────────────────────────── */}
        {transportType === "resend" && (
          <div>
            <p className="text-xs font-medium text-neutral-700 mb-2">Resend API key</p>
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
                <input
                  id="resendApiKey"
                  type="password"
                  autoComplete="off"
                  value={resendApiKey}
                  onChange={(e) => { setResendApiKey(e.target.value); markDirty(); }}
                  placeholder="re_xxxxxxxxxxxxxxxxxxxx"
                  className={inputCls + " font-mono"}
                />
                {hasResendKey && (
                  <div className="mt-1.5 flex items-center gap-2">
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
            <p className="mt-1.5 text-xs text-neutral-400">
              Stored encrypted. Get your key from{" "}
              <a
                href="https://resend.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-neutral-600"
              >
                resend.com/api-keys
              </a>
              .
            </p>
          </div>
        )}

        {/* ── SMTP config ─────────────────────────────────────────────────── */}
        {transportType === "smtp" && (
          <div className="space-y-4">
            <p className="text-xs font-medium text-neutral-700">SMTP settings</p>

            {/* Host + Port */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-neutral-700 mb-1" htmlFor="smtpHost">
                  Host
                </label>
                <input
                  id="smtpHost"
                  type="text"
                  value={smtpHost}
                  onChange={(e) => { setSmtpHost(e.target.value); markDirty(); }}
                  placeholder="smtp.mailprovider.com"
                  className={inputCls + " font-mono"}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1" htmlFor="smtpPort">
                  Port
                </label>
                <input
                  id="smtpPort"
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
              <label className="block text-xs font-medium text-neutral-700 mb-1" htmlFor="smtpUsername">
                Username
              </label>
              <input
                id="smtpUsername"
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
              <label className="block text-xs font-medium text-neutral-700 mb-1">Password</label>
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
                    id="smtpPassword"
                    type="password"
                    autoComplete="new-password"
                    value={smtpPassword}
                    onChange={(e) => { setSmtpPassword(e.target.value); markDirty(); }}
                    placeholder="••••••••••••"
                    className={inputCls + " font-mono"}
                  />
                  {hasSmtpPassword && (
                    <div className="mt-1.5 flex items-center gap-2">
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
            <Toggle
              id="smtpSecure"
              label="Use TLS / SSL"
              hint="Enable for port 465 (SSL). Leave off for port 587 (STARTTLS), which most providers prefer."
              checked={smtpSecure}
              onChange={(v) => { setSmtpSecure(v); markDirty(); }}
            />
          </div>
        )}

        {/* ── Save bar ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 pt-1">
          <StatusMessage status={saveStatus} errorMsg={errorMsg} isDirty={isDirty} savedText="Transport saved." />
          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === "saving" || !isDirty}
            className="inline-flex items-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-700 transition-colors disabled:opacity-40"
          >
            {saveStatus === "saving" ? "Saving…" : "Save transport"}
          </button>
        </div>
      </div>

      {/* ── Test email ──────────────────────────────────────────────────── */}
      <div className="border-t border-neutral-100 px-5 py-4 bg-neutral-50/50">
        <p className="text-xs font-medium text-neutral-700 mb-2">Send a test email</p>
        <p className="text-xs text-neutral-500 mb-3">
          Verify delivery using the currently-resolved transport (tenant → platform → env).
          Save any transport changes before testing.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="email"
            value={testRecipient}
            onChange={(e) => { setTestRecipient(e.target.value); setTestStatus("idle"); setTestMsg(null); }}
            placeholder="you@example.com"
            className={inputCls + " max-w-xs"}
          />
          <button
            type="button"
            onClick={handleTestEmail}
            disabled={testStatus === "sending" || !testRecipient.includes("@")}
            className="inline-flex items-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition-colors disabled:opacity-40"
          >
            {testStatus === "sending" ? "Sending…" : "Send test"}
          </button>
        </div>
        {testMsg && (
          <p className={`mt-2 text-xs ${testStatus === "error" ? "text-red-600" : "text-green-600"}`}>
            {testMsg}
          </p>
        )}
      </div>

      {/* ── Reset to platform default ────────────────────────────────────── */}
      {initialConfig.transportType !== "none" && (
        <div className="border-t border-neutral-100 px-5 py-4">
          {!showResetConfirm ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-neutral-700">Reset to platform default</p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Remove this tenant&apos;s transport override and fall back to the platform default.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="text-xs text-red-600 underline hover:text-red-800"
              >
                Reset
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 space-y-2">
              <p className="font-medium">Remove tenant transport override?</p>
              <p className="text-xs text-red-700">
                The tenant transport configuration will be deleted. Emails will fall back to
                {platformTransportLabel
                  ? ` the platform default (${platformTransportLabel})`
                  : " platform or env-var transport"}.
              </p>
              {resetStatus === "error" && resetError && (
                <p className="text-xs text-red-700">{resetError}</p>
              )}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={resetStatus === "resetting"}
                  className="rounded-lg bg-red-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-800 transition-colors disabled:opacity-50"
                >
                  {resetStatus === "resetting" ? "Resetting…" : "Yes, reset"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowResetConfirm(false); setResetError(null); setResetStatus("idle"); }}
                  className="text-xs text-red-600 underline"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
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
