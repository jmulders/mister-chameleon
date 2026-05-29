/**
 * DunningSettingsPanel
 *
 * Admin panel for configuring per-tenant dunning (payment-due) email settings.
 *
 * ─── What it configures ───────────────────────────────────────────────────────
 *
 *   email_subject    — subject line for the payment-due notification
 *   email_body       — plain-text body template (supports {{variables}})
 *   billing_email    — recipient override (falls back to wallet notification_email)
 *   quarantine_days  — days before service is blocked (default 8)
 *   payment_link     — optional URL injected into the email via {{payment_link}}
 *
 * ─── Template variables ───────────────────────────────────────────────────────
 *
 *   {{tenant_name}}    tenant display name
 *   {{plan_name}}      e.g. "Growth"
 *   {{amount}}         e.g. "€ 349,00"
 *   {{due_date}}       date payment was due
 *   {{quarantine_end}} date service will be blocked
 *   {{payment_link}}   value of the payment_link field (or empty string)
 */

"use client";

import { useState, useTransition } from "react";
import {
  getDunningSettingsAction,
  saveDunningSettingsAction,
  clearDunningAction,
}                                   from "@/app/admin/tenants/[tenantId]/billing/actions";
import type { TenantDunningSettings } from "@/billing/dunning";

// ── Props ─────────────────────────────────────────────────────────────────────

interface DunningSettingsPanelProps {
  tenantId:         string;
  initialSettings:  TenantDunningSettings;
  subscriptionStatus?: string | null;
  isSuperAdmin:     boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DunningSettingsPanel({
  tenantId,
  initialSettings,
  subscriptionStatus,
  isSuperAdmin,
}: DunningSettingsPanelProps) {
  const [settings,    setSettings]    = useState<TenantDunningSettings>(initialSettings);
  const [isPending,   startTransition] = useTransition();
  const [saveStatus,  setSaveStatus]  = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError,   setSaveError]   = useState<string | null>(null);
  const [clearStatus, setClearStatus] = useState<"idle" | "clearing" | "cleared" | "error">("idle");
  const [clearError,  setClearError]  = useState<string | null>(null);

  const isDunning = subscriptionStatus === "past_due" || subscriptionStatus === "unpaid";

  function handleSave() {
    startTransition(async () => {
      setSaveStatus("saving");
      setSaveError(null);

      const result = await saveDunningSettingsAction(tenantId, {
        email_subject:   settings.email_subject,
        email_body:      settings.email_body,
        billing_email:   settings.billing_email || null,
        quarantine_days: settings.quarantine_days,
        payment_link:    settings.payment_link  || null,
      });

      if (result.ok) {
        setSettings(result.data);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("error");
        setSaveError(result.error);
      }
    });
  }

  function handleClearDunning() {
    if (!isSuperAdmin) return;
    startTransition(async () => {
      setClearStatus("clearing");
      setClearError(null);
      const result = await clearDunningAction(tenantId);
      if (result.ok) {
        setClearStatus("cleared");
        // Reload to reflect new subscription status.
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setClearStatus("error");
        setClearError(result.error);
      }
    });
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 mb-6">

      {/* Header */}
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-neutral-900">
          Payment Due Notifications
        </span>
        {isDunning && (
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
            subscriptionStatus === "unpaid"
              ? "bg-red-100 text-red-700"
              : "bg-amber-100 text-amber-700"
          }`}>
            {subscriptionStatus === "unpaid" ? "⛔ Service blocked" : "⚠ In quarantine"}
          </span>
        )}
      </div>

      <p className="mb-5 text-xs text-neutral-500">
        Configure the payment-due email sent when a subscription renewal charge fails.
        Supports template variables (see reference below).
      </p>

      {/* Active dunning alert + clear button */}
      {isDunning && isSuperAdmin && (
        <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-medium text-amber-900 mb-2">
            This tenant is currently {subscriptionStatus === "unpaid" ? "blocked (unpaid)" : "in the payment quarantine window"}.
            If payment has been received outside of Stripe (e.g. bank transfer), you can manually restore service.
          </p>
          <button
            onClick={handleClearDunning}
            disabled={isPending || clearStatus === "clearing"}
            className="rounded bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
          >
            {clearStatus === "clearing" ? "Restoring…" : "Mark as paid — restore service"}
          </button>
          {clearStatus === "cleared" && (
            <p className="mt-2 text-xs text-green-700">✓ Service restored. Reloading…</p>
          )}
          {clearStatus === "error" && clearError && (
            <p className="mt-2 text-xs text-red-700">{clearError}</p>
          )}
        </div>
      )}

      {/* Form */}
      <div className="space-y-4">

        {/* Billing email */}
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">
            Billing email (recipient)
            <span className="ml-1 font-normal text-neutral-400">
              — falls back to wallet notification email if empty
            </span>
          </label>
          <input
            type="email"
            value={settings.billing_email ?? ""}
            onChange={(e) => setSettings((s) => ({ ...s, billing_email: e.target.value || null }))}
            placeholder="billing@tenant.com"
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>

        {/* Email subject */}
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">
            Email subject
          </label>
          <input
            type="text"
            value={settings.email_subject}
            onChange={(e) => setSettings((s) => ({ ...s, email_subject: e.target.value }))}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>

        {/* Email body */}
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">
            Email body (plain text)
          </label>
          <textarea
            rows={12}
            value={settings.email_body}
            onChange={(e) => setSettings((s) => ({ ...s, email_body: e.target.value }))}
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 font-mono text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 resize-y"
          />
        </div>

        {/* Quarantine days */}
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">
            Quarantine window
            <span className="ml-1 font-normal text-neutral-400">
              — days after missed payment before service blocks entirely
            </span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={90}
              value={settings.quarantine_days}
              onChange={(e) => setSettings((s) => ({
                ...s,
                quarantine_days: Math.max(1, Math.min(90, Number(e.target.value) || 8)),
              }))}
              className="w-24 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
            <span className="text-xs text-neutral-500">days</span>
          </div>
          <p className="mt-1 text-[11px] text-neutral-400">
            During this window the tenant site serves default content (no personalisation).
            After this window, the snippet returns 404 until payment is received.
          </p>
        </div>

        {/* Payment link */}
        <div>
          <label className="block text-xs font-medium text-neutral-700 mb-1">
            Payment link
            <span className="ml-1 font-normal text-neutral-400">
              — injected as <code className="font-mono">{"{{payment_link}}"}</code> in the email body
            </span>
          </label>
          <input
            type="url"
            value={settings.payment_link ?? ""}
            onChange={(e) => setSettings((s) => ({ ...s, payment_link: e.target.value || null }))}
            placeholder="https://pay.stripe.com/…"
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>

        {/* Template variable reference */}
        <div className="rounded-md border border-neutral-100 bg-neutral-50 px-3 py-2">
          <p className="text-[11px] font-medium text-neutral-600 mb-1">Template variables</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {[
              ["{{tenant_name}}",    "tenant display name"],
              ["{{plan_name}}",      "e.g. Growth"],
              ["{{amount}}",         "e.g. € 349,00"],
              ["{{due_date}}",       "date payment was due"],
              ["{{quarantine_end}}", "date service blocks"],
              ["{{payment_link}}",   "value of payment link field"],
            ].map(([v, d]) => (
              <div key={v} className="flex gap-1.5 items-baseline">
                <code className="text-[10px] font-mono text-brand-700">{v}</code>
                <span className="text-[10px] text-neutral-500">{d}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={isPending || saveStatus === "saving"}
            className="rounded bg-brand-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveStatus === "saving" ? "Saving…" : "Save settings"}
          </button>
          {saveStatus === "saved" && (
            <span className="text-xs text-green-700">✓ Saved</span>
          )}
          {saveStatus === "error" && saveError && (
            <span className="text-xs text-red-700">{saveError}</span>
          )}
        </div>
      </div>
    </div>
  );
}
