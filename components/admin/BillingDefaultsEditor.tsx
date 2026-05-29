"use client";

/**
 * components/admin/BillingDefaultsEditor.tsx
 *
 * Client component — form for editing platform-wide billing defaults.
 *
 * ─── Canonical schema (migration 065) ────────────────────────────────────────
 *
 *   All fields map to fractional EUR columns in billing_defaults:
 *
 *   currency                — ISO 4217 code (e.g. "eur")
 *   low_balance_threshold   — EUR below which a notification fires (e.g. 3.000)
 *   auto_reload_trigger     — EUR below which auto-reload fires (e.g. 2.000)
 *   auto_reload_amount      — EUR loaded per auto-reload (e.g. 22.000)
 *   monthly_auto_reload_cap — EUR max per month (null = unlimited)
 *
 * ─── Inheritance model ────────────────────────────────────────────────────────
 *
 *   Defaults apply to NEW tenant wallets at creation time.
 *   Existing wallets retain their existing values.
 */

import { useState, useTransition }    from "react";
import { updateBillingDefaults }       from "@/app/admin/platform/billing/defaults/actions";
import type { BillingDefaultsPayload } from "@/app/admin/platform/billing/defaults/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BillingDefaultsRow {
  currency:                 string;
  /** EUR (e.g. 3.000 = €3.00). */
  low_balance_threshold:    number;
  /** EUR (e.g. 2.000 = €2.00). */
  auto_reload_trigger:      number;
  /** EUR (e.g. 22.000 = €22.00). */
  auto_reload_amount:       number;
  /** EUR, null = unlimited. */
  monthly_auto_reload_cap:  number | null;
}

export interface BillingDefaultsEditorProps {
  defaults: BillingDefaultsRow;
}

// ── BillingDefaultsEditor ─────────────────────────────────────────────────────

export function BillingDefaultsEditor({ defaults }: BillingDefaultsEditorProps) {
  const [currency,  setCurrency]  = useState(defaults.currency);
  const [lowBal,    setLowBal]    = useState(String(defaults.low_balance_threshold));
  const [trigger,   setTrigger]   = useState(String(defaults.auto_reload_trigger));
  const [amount,    setAmount]    = useState(String(defaults.auto_reload_amount));
  const [cap,       setCap]       = useState(
    defaults.monthly_auto_reload_cap != null
      ? String(defaults.monthly_auto_reload_cap)
      : "",
  );

  const [status,    setStatus]    = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errMsg,    setErrMsg]    = useState("");
  const [isPending, startTransition] = useTransition();

  // ── Dirty check ─────────────────────────────────────────────────────────────

  const isDirty = (
    currency !== defaults.currency ||
    lowBal   !== String(defaults.low_balance_threshold)    ||
    trigger  !== String(defaults.auto_reload_trigger)      ||
    amount   !== String(defaults.auto_reload_amount)       ||
    cap      !== (defaults.monthly_auto_reload_cap != null ? String(defaults.monthly_auto_reload_cap) : "")
  );

  // ── Save ─────────────────────────────────────────────────────────────────────

  function handleSave() {
    setErrMsg("");
    setStatus("saving");

    if (!/^[a-z]{3}$/i.test(currency.trim())) {
      setErrMsg("Currency must be a 3-letter ISO 4217 code (e.g. eur, usd).");
      setStatus("error");
      return;
    }

    const nums: Array<[string, string]> = [
      ["Low balance threshold", lowBal],
      ["Auto-reload trigger",   trigger],
      ["Auto-reload amount",    amount],
    ];
    for (const [name, val] of nums) {
      if (isNaN(Number(val)) || Number(val) < 0) {
        setErrMsg(`${name} must be a non-negative number.`);
        setStatus("error");
        return;
      }
    }

    const capNum = cap === "" ? null : Number(cap);
    if (capNum !== null && (isNaN(capNum) || capNum < 0)) {
      setErrMsg("Monthly cap must be a non-negative number or blank (unlimited).");
      setStatus("error");
      return;
    }

    const payload: BillingDefaultsPayload = {
      currency:                currency.trim().toLowerCase(),
      low_balance_threshold:   Number(lowBal),
      auto_reload_trigger:     Number(trigger),
      auto_reload_amount:      Number(amount),
      monthly_auto_reload_cap: capNum,
    };

    startTransition(async () => {
      const r = await updateBillingDefaults(payload);
      if (r.ok) {
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 2500);
      } else {
        setErrMsg(r.error ?? "Save failed.");
        setStatus("error");
      }
    });
  }

  // ── UI ────────────────────────────────────────────────────────────────────────

  const inputCls =
    "w-full rounded border border-neutral-200 bg-white px-3 py-2 text-sm font-mono focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100";
  const labelCls = "block mb-1 text-xs font-medium text-neutral-500 uppercase tracking-wide";

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 space-y-6">

      {/* ── Currency ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-6 items-start">
        <div>
          <label className={labelCls}>Default currency</label>
          <input
            value={currency}
            onChange={(e) => { setCurrency(e.target.value); setStatus("idle"); }}
            placeholder="eur"
            maxLength={3}
            className={`${inputCls} w-24 uppercase`}
          />
          <p className="mt-1 text-[11px] text-neutral-400">
            ISO 4217 — used for new wallet display and Stripe charge currency.
          </p>
        </div>
      </div>

      <div className="border-t border-neutral-100" />

      {/* ── Low balance threshold ─────────────────────────────────────────────── */}
      <div>
        <p className="mb-4 text-xs font-semibold text-neutral-700 uppercase tracking-wide">
          Low balance notifications
        </p>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className={labelCls}>Threshold (EUR)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={lowBal}
              onChange={(e) => { setLowBal(e.target.value); setStatus("idle"); }}
              className={inputCls}
            />
            {lowBal && !isNaN(Number(lowBal)) && (
              <p className="mt-0.5 text-[11px] text-neutral-400">
                Notify when wallet drops below €{Number(lowBal).toFixed(2)}.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-neutral-100" />

      {/* ── Auto-reload ───────────────────────────────────────────────────────── */}
      <div>
        <p className="mb-4 text-xs font-semibold text-neutral-700 uppercase tracking-wide">
          Auto-reload defaults
        </p>
        <p className="mb-4 text-xs text-neutral-500">
          Applied to new tenant wallets at creation. Individual tenants can override via their wallet settings.
        </p>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <label className={labelCls}>Trigger (EUR)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={trigger}
              onChange={(e) => { setTrigger(e.target.value); setStatus("idle"); }}
              className={inputCls}
            />
            {trigger && !isNaN(Number(trigger)) && (
              <p className="mt-0.5 text-[11px] text-neutral-400">
                Reload when balance ≤ €{Number(trigger).toFixed(2)}.
              </p>
            )}
          </div>

          <div>
            <label className={labelCls}>Reload amount (EUR)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setStatus("idle"); }}
              className={inputCls}
            />
            {amount && !isNaN(Number(amount)) && (
              <p className="mt-0.5 text-[11px] text-neutral-400">
                Load €{Number(amount).toFixed(2)} per reload event.
              </p>
            )}
          </div>

          <div>
            <label className={labelCls}>Monthly cap (EUR)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={cap}
              onChange={(e) => { setCap(e.target.value); setStatus("idle"); }}
              placeholder="blank = unlimited"
              className={inputCls}
            />
            {cap && !isNaN(Number(cap)) ? (
              <p className="mt-0.5 text-[11px] text-neutral-400">
                Max €{Number(cap).toFixed(2)}/month in auto-reloads.
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] text-neutral-400">Unlimited.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────────── */}
      {errMsg && (
        <p className="rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
          {errMsg}
        </p>
      )}

      {/* ── Save ──────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-100">
        {status === "saved" && (
          <span className="text-xs text-green-600 font-medium">✓ Saved</span>
        )}
        <button
          onClick={handleSave}
          disabled={!isDirty || isPending || status === "saving"}
          className={`rounded px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            status === "saved"
              ? "bg-green-100 text-green-700"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {status === "saving" ? "Saving…" : "Save defaults"}
        </button>
      </div>
    </div>
  );
}
