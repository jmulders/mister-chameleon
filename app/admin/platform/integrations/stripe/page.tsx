/**
 * Admin — Integrations › Stripe
 *
 * Platform-level Stripe payment integration settings page.
 * Accessible at /admin/platform/integrations/stripe.
 *
 * ─── What this page manages ───────────────────────────────────────────────────
 *
 *   Stripe credentials and price IDs, stored platform-wide (not per-tenant):
 *
 *     publishableKey          — non-secret; used to initialise Stripe.js on the client.
 *                               Supplements NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY env var.
 *     secretKey               — SERVER ONLY; used for all server-side Stripe API calls.
 *                               Supplements STRIPE_SECRET_KEY env var.
 *     webhookSecret           — SERVER ONLY; used to verify signatures at /api/webhooks/stripe.
 *                               Supplements STRIPE_WEBHOOK_SECRET env var.
 *     creditBundle250PriceId  — Stripe Price ID for 250-credit bundle (non-secret).
 *                               Supplements STRIPE_PRICE_CREDITS_250 env var.
 *     creditBundle1000PriceId — Stripe Price ID for 1,000-credit bundle (non-secret).
 *                               Supplements STRIPE_PRICE_CREDITS_1000 env var.
 *     creditBundle5000PriceId — Stripe Price ID for 5,000-credit bundle (non-secret).
 *                               Supplements STRIPE_PRICE_CREDITS_5000 env var.
 *
 * ─── Scope note ───────────────────────────────────────────────────────────────
 *
 *   These are infrastructure-level credentials shared across all tenants.
 *   Billing plan assignment, subscription management, and credit logic happen
 *   at the tenant level in the tenant billing pages.
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   This server component calls getStripePlatformSettingsAction(), which strips
 *   all secret values before returning.  Only boolean flags (hasSecretKey,
 *   hasWebhookSecret), the publishable key value, live-mode state, and the
 *   updatedAt timestamp are passed to the client component.
 */

import Link                               from "next/link";
import { getStripePlatformSettingsAction } from "./actions";
import { StripePlatformClient }           from "./_components/StripePlatformClient";
import { getStripeWebhookHealth }         from "@/billing/stripe";

export default async function IntegrationsStripePage() {
  const result = await getStripePlatformSettingsAction();
  const health = await getStripeWebhookHealth();

  const mismatchDate = health.lastMismatchAt
    ? new Date(health.lastMismatchAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="mx-auto max-w-xl space-y-5 p-8">

      {/* Live/test mode mismatch warning — live events arriving on test keys (or
          vice versa) are being rejected, so that billing is not being processed. */}
      {health.mismatchCount > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Stripe events are being rejected on a live/test mode mismatch</p>
          <p className="mt-1 text-amber-800">
            {health.mismatchCount} recent event{health.mismatchCount === 1 ? "" : "s"} did not match the platform&apos;s
            configured mode{mismatchDate ? ` (most recent ${mismatchDate})` : ""}.
            {health.lastMismatchLivemode
              ? " These are LIVE Stripe events arriving while the platform is configured with TEST keys, so live subscriptions and payments are not being tracked."
              : " These are TEST events arriving while the platform is configured with LIVE keys."}
            {" "}Fix the credentials below to match, and register a matching webhook endpoint in Stripe.
          </p>
        </div>
      )}

      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Stripe: Payment Credentials</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Platform-level Stripe keys for subscription billing and payment processing.
          This page stores <strong>infrastructure credentials only</strong>: plan
          assignment, subscriptions, and tenant billing are managed in each tenant's
          billing page.
        </p>
      </div>

      {/* Scope note */}
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
        <strong>Tenant billing</strong> (subscriptions, credits, invoices) is managed in
        each tenant's{" "}
        <Link href="/admin/tenants" className="font-medium text-brand-600 hover:underline">
          billing workspace tab
        </Link>
        . The credentials stored here are shared infrastructure, they enable the
        payment flow but don't configure it per tenant.
      </div>

      {/* Security callout */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
        <strong>Secrets stay server-side.</strong> The secret key and webhook signing
        secret are stored encrypted at rest and never returned to the browser after
        saving. Only the publishable key (which is public by design) is shown in the UI.
      </div>

      {/* Error loading settings */}
      {!result.ok && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-800">Failed to load Stripe settings</p>
          <p className="mt-1 text-xs text-red-700">{result.error}</p>
        </div>
      )}

      {/* Settings form */}
      {result.ok && (
        <StripePlatformClient
          publishableKey={result.publishableKey}
          hasSecretKey={result.hasSecretKey}
          hasWebhookSecret={result.hasWebhookSecret}
          liveMode={result.liveMode}
          creditBundle250PriceId={result.creditBundle250PriceId}
          creditBundle1000PriceId={result.creditBundle1000PriceId}
          creditBundle5000PriceId={result.creditBundle5000PriceId}
          planStarterMonthlyPriceId={result.planStarterMonthlyPriceId}
          planStarterAnnualPriceId={result.planStarterAnnualPriceId}
          planGrowthMonthlyPriceId={result.planGrowthMonthlyPriceId}
          planGrowthAnnualPriceId={result.planGrowthAnnualPriceId}
          planProMonthlyPriceId={result.planProMonthlyPriceId}
          planProAnnualPriceId={result.planProAnnualPriceId}
          updatedAt={result.updatedAt}
        />
      )}
    </div>
  );
}
