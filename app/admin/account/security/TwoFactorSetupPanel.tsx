"use client";

import { useState, useTransition } from "react";
import {
  initSetup2faAction,
  confirmEnable2faAction,
  disable2faAction,
  regenerateBackupCodesAction,
} from "./actions";

interface Props {
  twoFaEnabled:     boolean;
  backupCodeCount:  number;
}

/**
 * TwoFactorSetupPanel
 *
 * Client Component that drives the interactive 2FA setup and management UI.
 * All state changes are performed via Server Actions.
 *
 * ── Flows ────────────────────────────────────────────────────────────────────
 *
 *   Setup (2FA disabled):
 *     idle → [click "Set up"] → qr (show QR + manual secret) →
 *     [enter TOTP code + submit] → done (show backup codes)
 *
 *   Disable (2FA enabled):
 *     management → [click "Disable 2FA"] → confirm form →
 *     [enter TOTP code + submit] → (page reloads with success flash)
 *
 *   Regenerate backup codes (2FA enabled):
 *     management → [click "Regenerate"] → confirm form →
 *     [enter TOTP code + submit] → show new codes
 */
export function TwoFactorSetupPanel({ twoFaEnabled, backupCodeCount }: Props) {
  type SetupStep = "idle" | "qr" | "done";
  type ManageStep = "idle" | "disable_confirm" | "regen_confirm" | "regen_done";

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // ── Setup flow state ──────────────────────────────────────────────────────
  const [setupStep, setSetupStep] = useState<SetupStep>("idle");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [manualSecret, setManualSecret] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [showManualSecret, setShowManualSecret] = useState(false);

  // ── Manage flow state ─────────────────────────────────────────────────────
  const [manageStep, setManageStep] = useState<ManageStep>("idle");
  const [regenCodes, setRegenCodes] = useState<string[] | null>(null);

  // ── Setup: Step 1 — generate QR ──────────────────────────────────────────
  function handleStartSetup() {
    setError(null);
    startTransition(async () => {
      const result = await initSetup2faAction();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setQrDataUrl(result.qrCodeDataUrl);
      setManualSecret(result.secret);
      setSetupStep("qr");
    });
  }

  // ── Setup: Step 2 — verify first TOTP code ───────────────────────────────
  function handleConfirmEnable(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await confirmEnable2faAction(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setBackupCodes(result.backupCodes);
      setSetupStep("done");
    });
  }

  // ── Manage: disable ───────────────────────────────────────────────────────
  function handleDisable(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await disable2faAction(formData);
      // disable2faAction redirects on success/error; no client-side state needed.
    });
  }

  // ── Manage: regenerate backup codes ──────────────────────────────────────
  function handleRegen(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await regenerateBackupCodesAction(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setRegenCodes(result.backupCodes);
      setManageStep("regen_done");
    });
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (!twoFaEnabled) {
    // ── 2FA disabled — setup flow ─────────────────────────────────────────

    return (
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 text-lg">
            ⚠
          </span>
          <div>
            <h2 className="text-base font-semibold text-neutral-900">
              Two-factor authentication is not enabled
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Add an extra layer of security by requiring a code from your
              authenticator app every time you sign in.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {setupStep === "idle" && (
          <div className="mt-5">
            <button
              onClick={handleStartSetup}
              disabled={isPending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Generating…" : "Set up two-factor authentication"}
            </button>
          </div>
        )}

        {setupStep === "qr" && qrDataUrl && (
          <div className="mt-6 space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-neutral-700">
                1. Scan this QR code with your authenticator app
              </h3>
              <p className="mt-1 text-xs text-neutral-500">
                Works with Google Authenticator, 1Password, Authy, Microsoft
                Authenticator, and any TOTP-compatible app.
              </p>
              {/* QR code image — data URL contains the otpauth:// provisioning URI */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="TOTP QR code — scan with your authenticator app"
                width={240}
                height={240}
                className="mt-3 rounded-lg border border-neutral-200"
              />
            </div>

            {/* Manual entry toggle */}
            <div>
              <button
                type="button"
                onClick={() => setShowManualSecret((v) => !v)}
                className="text-xs text-brand-600 hover:underline"
              >
                {showManualSecret ? "Hide" : "Can't scan?"} — enter the code manually
              </button>
              {showManualSecret && manualSecret && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
                  <code className="flex-1 font-mono text-sm tracking-wider text-neutral-700 break-all">
                    {manualSecret}
                  </code>
                </div>
              )}
            </div>

            {/* Verify first code */}
            <form onSubmit={handleConfirmEnable} className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-neutral-700">
                  2. Enter the 6-digit code to verify setup
                </h3>
                <input
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={7}
                  placeholder="123456"
                  className="mt-2 w-40 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-center text-lg tracking-[0.3em] text-neutral-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? "Verifying…" : "Enable two-factor authentication"}
              </button>
            </form>
          </div>
        )}

        {setupStep === "done" && backupCodes && (
          <BackupCodeDisplay
            codes={backupCodes}
            message="Two-factor authentication is now enabled. Save these backup codes in a safe place — they are shown only once."
          />
        )}
      </section>
    );
  }

  // ── 2FA enabled — management view ────────────────────────────────────────

  return (
    <section className="space-y-4">
      {/* Status */}
      <div className="rounded-xl border border-green-200 bg-green-50 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 text-lg">
            ✓
          </span>
          <div>
            <h2 className="text-base font-semibold text-neutral-900">
              Two-factor authentication is enabled
            </h2>
            <p className="mt-0.5 text-sm text-neutral-600">
              You have {backupCodeCount === 0
                ? "no"
                : backupCodeCount}{" "}
              backup {backupCodeCount === 1 ? "code" : "codes"} remaining.
              {backupCodeCount <= 2 && backupCodeCount > 0 && (
                <span className="ml-1 font-medium text-amber-600">
                  Consider regenerating your backup codes soon.
                </span>
              )}
              {backupCodeCount === 0 && (
                <span className="ml-1 font-medium text-red-600">
                  Regenerate backup codes so you can recover access if you lose your device.
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Regenerate backup codes */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-neutral-900">Backup codes</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Backup codes let you sign in when you don't have access to your
          authenticator app. Each code can only be used once.
        </p>

        {manageStep === "idle" && (
          <button
            onClick={() => { setError(null); setManageStep("regen_confirm"); }}
            className="mt-4 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            Regenerate backup codes
          </button>
        )}

        {manageStep === "regen_confirm" && (
          <form onSubmit={handleRegen} className="mt-4 space-y-3">
            <p className="text-sm text-neutral-600">
              Your existing backup codes will be invalidated. Enter your
              authenticator code to confirm.
            </p>
            <input
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={7}
              placeholder="123456"
              className="w-40 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-center text-lg tracking-[0.3em] text-neutral-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? "Regenerating…" : "Regenerate"}
              </button>
              <button
                type="button"
                onClick={() => setManageStep("idle")}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {manageStep === "regen_done" && regenCodes && (
          <BackupCodeDisplay
            codes={regenCodes}
            message="Your new backup codes are shown below. These replace your old codes — save them now."
          />
        )}
      </div>

      {/* Disable 2FA */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-neutral-900">Disable two-factor authentication</h3>
        <p className="mt-1 text-sm text-neutral-500">
          This will remove the 2FA requirement from your account. You'll only
          need your password to sign in.
        </p>

        {manageStep === "idle" && (
          <button
            onClick={() => { setError(null); setManageStep("disable_confirm"); }}
            className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
          >
            Disable 2FA
          </button>
        )}

        {manageStep === "disable_confirm" && (
          <form onSubmit={handleDisable} className="mt-4 space-y-3">
            <p className="text-sm text-neutral-600">
              Enter your authenticator code to confirm disabling 2FA.
            </p>
            <input
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={7}
              placeholder="123456"
              className="w-40 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-center text-lg tracking-[0.3em] text-neutral-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? "Disabling…" : "Confirm disable"}
              </button>
              <button
                type="button"
                onClick={() => setManageStep("idle")}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

// ── BackupCodeDisplay ─────────────────────────────────────────────────────────

function BackupCodeDisplay({
  codes,
  message,
}: {
  codes: string[];
  message: string;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(codes.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mt-5 space-y-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {message}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
          {codes.map((code) => (
            <code
              key={code}
              className="font-mono text-sm tracking-wider text-neutral-700"
            >
              {code}
            </code>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
      >
        {copied ? "Copied!" : "Copy all codes"}
      </button>
    </div>
  );
}
