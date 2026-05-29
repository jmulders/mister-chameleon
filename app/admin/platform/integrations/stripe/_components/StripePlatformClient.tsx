/**
 * StripePlatformClient
 *
 * Client component for /admin/platform/integrations/stripe.
 * Manages the three Stripe credentials: publishable key, secret key, webhook secret.
 *
 * ─── Security ──────────────────────────────────────────────────────────────────
 *
 *   secretKey and webhookSecret are never held in React state after a successful
 *   save — the inputs are cleared immediately.  The server never echoes them back.
 *   The component receives only boolean presence flags (hasSecretKey, hasWebhookSecret)
 *   and the publishableKey value (which is safe — it is public by design).
 *
 * ─── Test connection ───────────────────────────────────────────────────────────
 *
 *   The "Test connection" button calls testStripeConnectionAction, which pings
 *   the Stripe /v1/balance endpoint.  Only success/failure and live-mode state
 *   are returned — no account data crosses the server→client boundary.
 */

"use client";

import { useState, useTransition }                  from "react";
import { saveStripePlatformSettingsAction, testStripeConnectionAction } from "../actions";

// ── Shared primitives ──────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function SecretField({
  label,
  value,
  onChange,
  hasExisting,
  placeholder,
  hint,
}: {
  label:       string;
  value:       string;
  onChange:    (v: string) => void;
  hasExisting: boolean;
  placeholder: string;
  hint?:       string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-neutral-700">
        {label}
        <span className="ml-1.5 font-normal text-neutral-400">(not shown after save)</span>
      </label>
      {hasExisting && !value && (
        <div className="mb-1.5 flex items-center gap-2 rounded-md border border-neutral-100 bg-neutral-50 px-3 py-1.5">
          <span className="font-mono text-xs tracking-widest text-neutral-400">
            ••••••••••••••••••••••••••••••••
          </span>
          <span className="ml-auto text-[11px] text-green-600 font-medium">configured</span>
        </div>
      )}
      <input
        type="password"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={hasExisting ? "Enter new value to replace…" : placeholder}
        className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 font-mono text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
      />
      {hint && <p className="mt-0.5 text-[11px] text-neutral-400">{hint}</p>}
      {!hint && (
        <p className="mt-0.5 text-[11px] text-neutral-400">
          Leave blank to keep the existing value. Stored server-side only — never echoed back.
        </p>
      )}
    </div>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return ok ? (
    <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700">
      ✓ {label}
    </span>
  ) : (
    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-500">
      {label} not set
    </span>
  );
}

type SaveState =
  | { mode: "idle" }
  | { mode: "saving" }
  | { mode: "success" }
  | { mode: "error"; message: string };

type TestState =
  | { mode: "idle" }
  | { mode: "testing" }
  | { mode: "success"; liveMode: boolean; message: string }
  | { mode: "error"; message: string };

// ── Root component ─────────────────────────────────────────────────────────────

export interface StripePlatformClientProps {
  publishableKey:            string;
  hasSecretKey:              boolean;
  hasWebhookSecret:          boolean;
  liveMode:                  boolean;
  creditBundle250PriceId:    string;
  creditBundle1000PriceId:   string;
  creditBundle5000PriceId:   string;
  planStarterMonthlyPriceId: string;
  planStarterAnnualPriceId:  string;
  planGrowthMonthlyPriceId:  string;
  planGrowthAnnualPriceId:   string;
  planProMonthlyPriceId:     string;
  planProAnnualPriceId:      string;
  updatedAt:                 string | null;
}

export function StripePlatformClient({
  publishableKey:            initialPublishableKey,
  hasSecretKey:              initialHasSecretKey,
  hasWebhookSecret:          initialHasWebhookSecret,
  liveMode:                  initialLiveMode,
  creditBundle250PriceId:    initialBundle250,
  creditBundle1000PriceId:   initialBundle1000,
  creditBundle5000PriceId:   initialBundle5000,
  planStarterMonthlyPriceId: initialStarterMonthly,
  planStarterAnnualPriceId:  initialStarterAnnual,
  planGrowthMonthlyPriceId:  initialGrowthMonthly,
  planGrowthAnnualPriceId:   initialGrowthAnnual,
  planProMonthlyPriceId:     initialProMonthly,
  planProAnnualPriceId:      initialProAnnual,
  updatedAt:                 initialUpdatedAt,
}: StripePlatformClientProps) {
  const [publishableKey,        setPublishableKey]        = useState(initialPublishableKey);
  const [secretKey,             setSecretKey]             = useState("");
  const [webhookSecret,         setWebhookSecret]         = useState("");
  const [hasSecretKey,          setHasSecretKey]          = useState(initialHasSecretKey);
  const [hasWebhookSecret,      setHasWebhookSecret]      = useState(initialHasWebhookSecret);
  const [liveMode,              setLiveMode]              = useState(initialLiveMode);
  const [bundle250PriceId,      setBundle250PriceId]      = useState(initialBundle250);
  const [bundle1000PriceId,     setBundle1000PriceId]     = useState(initialBundle1000);
  const [bundle5000PriceId,     setBundle5000PriceId]     = useState(initialBundle5000);
  const [starterMonthlyPriceId, setStarterMonthlyPriceId] = useState(initialStarterMonthly);
  const [starterAnnualPriceId,  setStarterAnnualPriceId]  = useState(initialStarterAnnual);
  const [growthMonthlyPriceId,  setGrowthMonthlyPriceId]  = useState(initialGrowthMonthly);
  const [growthAnnualPriceId,   setGrowthAnnualPriceId]   = useState(initialGrowthAnnual);
  const [proMonthlyPriceId,     setProMonthlyPriceId]     = useState(initialProMonthly);
  const [proAnnualPriceId,      setProAnnualPriceId]      = useState(initialProAnnual);
  const [updatedAt,             setUpdatedAt]             = useState<string | null>(initialUpdatedAt);
  const [saveState,             setSaveState]             = useState<SaveState>({ mode: "idle" });
  const [testState,             setTestState]             = useState<TestState>({ mode: "idle" });
  const [isSavePending,         startSaveTransition]      = useTransition();
  const [isTestPending,         startTestTransition]      = useTransition();

  const formatted = formatDate(updatedAt);
  const hasPublishableKey = Boolean(publishableKey);

  function handleSave() {
    startSaveTransition(async () => {
      setSaveState({ mode: "saving" });

      const result = await saveStripePlatformSettingsAction({
        publishableKey:            publishableKey        !== initialPublishableKey    ? publishableKey        : undefined,
        secretKey:                 secretKey             || undefined,
        webhookSecret:             webhookSecret         || undefined,
        creditBundle250PriceId:    bundle250PriceId      !== initialBundle250         ? bundle250PriceId      : undefined,
        creditBundle1000PriceId:   bundle1000PriceId     !== initialBundle1000        ? bundle1000PriceId     : undefined,
        creditBundle5000PriceId:   bundle5000PriceId     !== initialBundle5000        ? bundle5000PriceId     : undefined,
        planStarterMonthlyPriceId: starterMonthlyPriceId !== initialStarterMonthly   ? starterMonthlyPriceId : undefined,
        planStarterAnnualPriceId:  starterAnnualPriceId  !== initialStarterAnnual    ? starterAnnualPriceId  : undefined,
        planGrowthMonthlyPriceId:  growthMonthlyPriceId  !== initialGrowthMonthly    ? growthMonthlyPriceId  : undefined,
        planGrowthAnnualPriceId:   growthAnnualPriceId   !== initialGrowthAnnual     ? growthAnnualPriceId   : undefined,
        planProMonthlyPriceId:     proMonthlyPriceId     !== initialProMonthly       ? proMonthlyPriceId     : undefined,
        planProAnnualPriceId:      proAnnualPriceId      !== initialProAnnual        ? proAnnualPriceId      : undefined,
      });

      if (result.ok) {
        if (secretKey)     setHasSecretKey(true);
        if (webhookSecret) setHasWebhookSecret(true);
        if (publishableKey.startsWith("pk_live_")) setLiveMode(true);
        if (publishableKey.startsWith("pk_test_")) setLiveMode(false);
        setSecretKey("");
        setWebhookSecret("");
        setUpdatedAt(new Date().toISOString());
        setSaveState({ mode: "success" });
        setTestState({ mode: "idle" });  // reset test result after key change
      } else {
        setSaveState({ mode: "error", message: result.error });
      }
    });
  }

  function handleTest() {
    startTestTransition(async () => {
      setTestState({ mode: "testing" });
      const result = await testStripeConnectionAction();
      if (result.ok) {
        setTestState({ mode: "success", liveMode: result.liveMode, message: result.message });
      } else {
        setTestState({ mode: "error", message: result.error });
      }
    });
  }

  return (
    <div className="space-y-6">

      {/* ── Credentials card ─────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5">

        {/* Header */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-0.5">
              <h2 className="text-sm font-semibold text-neutral-900">Stripe credentials</h2>
              <StatusBadge ok={hasPublishableKey} label="Publishable key" />
              <StatusBadge ok={hasSecretKey}      label="Secret key"      />
              <StatusBadge ok={hasWebhookSecret}  label="Webhook secret"  />
              {(hasPublishableKey || hasSecretKey) && (
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                    liveMode
                      ? "bg-amber-100 text-amber-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {liveMode ? "Live mode" : "Test mode"}
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500">
              Platform-level Stripe keys used for subscription billing and payment processing.
            </p>
          </div>
          {formatted && (
            <span className="shrink-0 text-[11px] text-neutral-400">
              Last saved: {formatted}
            </span>
          )}
        </div>

        {/* Fields */}
        <div className="space-y-4">

          {/* Publishable key — non-secret, shown as regular text input */}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700">
              Publishable key
              <span className="ml-1.5 font-normal text-neutral-400">(safe to expose to browser)</span>
            </label>
            <input
              type="text"
              autoComplete="off"
              value={publishableKey}
              onChange={(e) => setPublishableKey(e.target.value)}
              placeholder="pk_live_… or pk_test_…"
              className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 font-mono text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
            <p className="mt-0.5 text-[11px] text-neutral-400">
              Used to initialise Stripe.js on the client. Not a secret — safe to expose.
              Supplements the NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY env var.
            </p>
          </div>

          <SecretField
            label="Secret key"
            value={secretKey}
            onChange={setSecretKey}
            hasExisting={hasSecretKey}
            placeholder="sk_live_… or sk_test_…"
            hint="Used for server-side Stripe API calls. Supplements the STRIPE_SECRET_KEY env var."
          />

          <SecretField
            label="Webhook signing secret"
            value={webhookSecret}
            onChange={setWebhookSecret}
            hasExisting={hasWebhookSecret}
            placeholder="whsec_…"
            hint="Used to verify incoming webhooks at /api/webhooks/stripe. Supplements STRIPE_WEBHOOK_SECRET env var."
          />
        </div>

        {/* Save footer */}
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isSavePending}
            className="rounded bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSavePending ? "Saving…" : "Save settings"}
          </button>

          <button
            onClick={handleTest}
            disabled={isTestPending || !hasSecretKey}
            title={!hasSecretKey ? "Save a secret key first" : undefined}
            className="rounded border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isTestPending ? "Testing…" : "Test connection"}
          </button>

          {saveState.mode === "success" && (
            <span className="flex items-center gap-1.5 text-xs text-green-700">
              ✓ Settings saved
              <button
                onClick={() => setSaveState({ mode: "idle" })}
                className="text-[11px] text-neutral-400 underline hover:text-neutral-600"
              >
                Dismiss
              </button>
            </span>
          )}

          {saveState.mode === "error" && (
            <span className="flex items-center gap-1.5 text-xs text-red-700">
              {saveState.message}
              <button
                onClick={() => setSaveState({ mode: "idle" })}
                className="text-[11px] text-neutral-400 underline hover:text-neutral-600"
              >
                Dismiss
              </button>
            </span>
          )}
        </div>

        {/* Test result */}
        {testState.mode !== "idle" && testState.mode !== "testing" && (
          <div
            className={`mt-3 rounded-md px-3 py-2 text-xs ${
              testState.mode === "success"
                ? "border border-green-200 bg-green-50 text-green-800"
                : "border border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {testState.mode === "success" ? (
              <span>
                ✓ {testState.message}
                {" "}
                <span className={`font-medium ${testState.liveMode ? "text-amber-700" : "text-blue-700"}`}>
                  ({testState.liveMode ? "live mode" : "test mode"})
                </span>
              </span>
            ) : (
              <span>✗ {testState.message}</span>
            )}
          </div>
        )}
      </div>

      {/* ── Credit bundle price IDs ──────────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-neutral-900">Credit bundle price IDs</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Stripe Price IDs for the three credit top-up bundles tenants can purchase.
            These are non-secret and supplement the <code className="font-mono text-[11px]">STRIPE_PRICE_CREDITS_*</code> env vars.
          </p>
        </div>

        <div className="space-y-4">
          {(
            [
              { label: "250 credits — €6.50",    value: bundle250PriceId,  set: setBundle250PriceId  },
              { label: "1,000 credits — €22.00",  value: bundle1000PriceId, set: setBundle1000PriceId },
              { label: "5,000 credits — €99.00",  value: bundle5000PriceId, set: setBundle5000PriceId },
            ] as const
          ).map(({ label, value, set }) => (
            <div key={label}>
              <label className="mb-1 block text-xs font-medium text-neutral-700">{label}</label>
              <input
                type="text"
                autoComplete="off"
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder="price_…"
                className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 font-mono text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
              />
            </div>
          ))}
        </div>

        <p className="mt-3 text-[11px] text-neutral-400 leading-relaxed">
          Create these products and prices in the Stripe Dashboard, then paste the Price IDs here.
          Leave blank to use the corresponding env var, or to disable that bundle.
        </p>
      </div>

      {/* ── Subscription plan price IDs ─────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-neutral-900">Subscription plan price IDs</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Stripe Price IDs for the three recurring subscription plans (Starter, Growth, Pro).
            Non-secret — supplement the{" "}
            <code className="font-mono text-[11px]">STRIPE_PRICE_*</code> env vars.
            Resolution order: env var → here → billing_plans table.
          </p>
        </div>

        {/* Grid: plan rows × monthly/annual columns */}
        <div className="space-y-5">
          {(
            [
              {
                plan: "Starter",
                monthly: { value: starterMonthlyPriceId, set: setStarterMonthlyPriceId },
                annual:  { value: starterAnnualPriceId,  set: setStarterAnnualPriceId  },
              },
              {
                plan: "Growth",
                monthly: { value: growthMonthlyPriceId, set: setGrowthMonthlyPriceId },
                annual:  { value: growthAnnualPriceId,  set: setGrowthAnnualPriceId  },
              },
              {
                plan: "Pro",
                monthly: { value: proMonthlyPriceId, set: setProMonthlyPriceId },
                annual:  { value: proAnnualPriceId,  set: setProAnnualPriceId  },
              },
            ] as const
          ).map(({ plan, monthly, annual }) => (
            <div key={plan}>
              <p className="mb-1.5 text-xs font-semibold text-neutral-700">{plan}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-neutral-500">Monthly</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={monthly.value}
                    onChange={(e) => monthly.set(e.target.value)}
                    placeholder="price_…"
                    className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 font-mono text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-neutral-500">Annual</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={annual.value}
                    onChange={(e) => annual.set(e.target.value)}
                    placeholder="price_…"
                    className="w-full rounded-md border border-neutral-200 bg-white px-3 py-1.5 font-mono text-xs text-neutral-700 placeholder:text-neutral-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[11px] text-neutral-400 leading-relaxed">
          Find Price IDs in the Stripe Dashboard → Products → select the plan product → copy the Price ID.
          Leave a field blank to fall through to the env var or billing_plans table.
        </p>
      </div>

      {/* ── Info card ────────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-4 space-y-3">
        <div>
          <h3 className="text-xs font-semibold text-neutral-700">Webhook endpoint</h3>
          <p className="mt-0.5 text-xs text-neutral-500 leading-relaxed">
            Register exactly one endpoint in the Stripe Dashboard pointing to:
          </p>
          <div className="mt-1.5 rounded bg-neutral-100 px-3 py-1.5 font-mono text-[11px] text-neutral-600">
            https://&lt;your-domain&gt;/api/webhooks/stripe
          </div>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-neutral-700">Key resolution order</h3>
          <p className="mt-0.5 text-xs text-neutral-500 leading-relaxed">
            Keys stored here take priority over environment variables.
            Resolution order (highest first):{" "}
            <strong>platform store (here)</strong> → environment variable
            (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).
          </p>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-neutral-700">Events handled</h3>
          <p className="mt-0.5 text-xs text-neutral-500 leading-relaxed">
            checkout.session.completed · invoice.paid · customer.subscription.updated ·
            customer.subscription.deleted
          </p>
        </div>
      </div>
    </div>
  );
}
