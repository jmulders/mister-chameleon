"use client";

/**
 * TurnstileSettingsClient
 *
 * Tenant-level Cloudflare Turnstile keys used by the per-form CAPTCHA toggle.
 *
 *   • siteKey   — PUBLIC, rendered in the form widget (data-sitekey).
 *   • secretKey — SERVER ONLY, encrypted at rest; used to verify tokens.
 *
 * The secret is never sent back to the browser — the server returns only a
 * `hasSecret` boolean. Leaving the secret field empty on save PRESERVES the
 * stored secret, so the site key can be updated without re-entering it.
 *
 * Get free keys at https://dash.cloudflare.com → Turnstile. Add each site's
 * hostname(s) to the widget so verification passes on those domains.
 */

import { useState } from "react";

interface TurnstileSettingsClientProps {
  initialSiteKey: string;
  hasSecret:      boolean;
  saveAction:     (input: { siteKey: string; secretKey: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
}

export function TurnstileSettingsClient({
  initialSiteKey,
  hasSecret,
  saveAction,
}: TurnstileSettingsClientProps) {
  const [siteKey, setSiteKey]     = useState(initialSiteKey);
  const [secretKey, setSecretKey] = useState("");
  const [status, setStatus]       = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);
  const [secretStored, setSecretStored] = useState(hasSecret);

  async function handleSave() {
    setStatus("saving");
    setErrorMsg(null);
    const result = await saveAction({ siteKey: siteKey.trim(), secretKey: secretKey.trim() });
    if (result.ok) {
      setStatus("saved");
      if (secretKey.trim()) setSecretStored(true);
      setSecretKey("");
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      setStatus("error");
      setErrorMsg(result.error);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 " +
    "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1";

  return (
    <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-100">
        <h2 className="text-sm font-semibold text-neutral-900">Spam protection — Cloudflare Turnstile</h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Enter this tenant&rsquo;s Turnstile keys, then enable the CAPTCHA per form under each form&rsquo;s
          settings. Turnstile is free — get keys at{" "}
          <a
            href="https://dash.cloudflare.com/?to=/:account/turnstile"
            target="_blank"
            rel="noreferrer"
            className="text-indigo-600 hover:underline"
          >
            Cloudflare → Turnstile
          </a>
          , and add each site&rsquo;s domain to the widget.
        </p>
      </div>

      <div className="px-5 py-4 space-y-4">
        <div>
          <label htmlFor="ts-site" className="block text-xs font-medium text-neutral-700 mb-1">
            Site key <span className="text-neutral-400">(public)</span>
          </label>
          <input
            id="ts-site"
            type="text"
            value={siteKey}
            onChange={(e) => { setSiteKey(e.target.value); setStatus("idle"); }}
            placeholder="0x4AAAAAAA…"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="ts-secret" className="block text-xs font-medium text-neutral-700 mb-1">
            Secret key <span className="text-neutral-400">(server-only, encrypted)</span>
          </label>
          <input
            id="ts-secret"
            type="password"
            value={secretKey}
            onChange={(e) => { setSecretKey(e.target.value); setStatus("idle"); }}
            placeholder={secretStored ? "•••••••• (stored — leave empty to keep)" : "0x4AAAAAAA…"}
            autoComplete="new-password"
            className={inputCls}
          />
          <p className="text-xs text-neutral-400 mt-1">
            {secretStored
              ? "A secret is stored. Leave this empty to keep it, or enter a new one to replace it."
              : "No secret stored yet."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={status === "saving"}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {status === "saving" ? "Saving…" : "Save Turnstile keys"}
          </button>
          {status === "saved" && <span className="text-sm text-green-600">Saved</span>}
          {status === "error" && <span className="text-sm text-red-600">{errorMsg}</span>}
        </div>
      </div>
    </div>
  );
}
