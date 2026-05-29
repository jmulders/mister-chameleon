/**
 * Stripe Integration — Server Actions
 *
 * Thin wrappers around platform/platform-store that expose server-callable
 * actions for the /admin/platform/integrations/stripe page.
 *
 * ─── Security contract ────────────────────────────────────────────────────────
 *
 *   Reads strip all secret values before returning to the caller:
 *     • publishableKey    — returned as-is (non-secret by design)
 *     • secretKey         — returned as boolean hasSecretKey only
 *     • webhookSecret     — returned as boolean hasWebhookSecret only
 *     • liveMode          — derived from publishableKey prefix (pk_live_ vs pk_test_)
 *
 *   Writes accept secret inputs but never echo them back.
 *   Successful write responses are `{ ok: true }` only.
 *
 * ─── Test connection ──────────────────────────────────────────────────────────
 *
 *   testStripeConnectionAction calls the Stripe /v1/balance endpoint using the
 *   stored secretKey.  It confirms the key is valid and returns the account's
 *   live-mode state.  No sensitive data is returned — only { ok, liveMode }.
 */

"use server";

import { revalidatePath }           from "next/cache";
import {
  getPlatformStripeSettings,
  savePlatformStripeSettings,
  stripeFlags,
}                                   from "@/platform/platform-store";

// ── Shared validation ──────────────────────────────────────────────────────────

const MAX_FIELD_LENGTH = 512;

function trimField(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function validateLength(field: string, value: string): string | null {
  return value.length > MAX_FIELD_LENGTH
    ? `${field} must be ${MAX_FIELD_LENGTH} characters or fewer.`
    : null;
}

function validateKeyFormat(field: string, value: string, prefix: string): string | null {
  if (value && !value.startsWith(prefix)) {
    return `${field} must start with "${prefix}".`;
  }
  return null;
}

// ── Read ───────────────────────────────────────────────────────────────────────

/**
 * Load Stripe integration status, stripped of secrets.
 *
 * Returns:
 *   publishableKey              — actual value (safe; public by design)
 *   hasSecretKey                — boolean only
 *   hasWebhookSecret            — boolean only
 *   liveMode                    — true when publishableKey starts with "pk_live_"
 *   creditBundle*PriceId        — Stripe Price IDs for credit bundles (non-secret)
 *   plan*PriceId                — Stripe Price IDs for subscription plans (non-secret)
 *   updatedAt                   — ISO-8601 timestamp or null
 */
export async function getStripePlatformSettingsAction(): Promise<
  | {
      ok:                        true;
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
  | { ok: false; error: string }
> {
  const result = await getPlatformStripeSettings();
  if (!result.ok) return result;

  const flags = stripeFlags(result.data);

  return {
    ok:                        true,
    publishableKey:            flags.publishableKey,
    hasSecretKey:              flags.hasSecretKey,
    hasWebhookSecret:          flags.hasWebhookSecret,
    liveMode:                  flags.liveMode,
    creditBundle250PriceId:    flags.creditBundle250PriceId,
    creditBundle1000PriceId:   flags.creditBundle1000PriceId,
    creditBundle5000PriceId:   flags.creditBundle5000PriceId,
    planStarterMonthlyPriceId: flags.planStarterMonthlyPriceId,
    planStarterAnnualPriceId:  flags.planStarterAnnualPriceId,
    planGrowthMonthlyPriceId:  flags.planGrowthMonthlyPriceId,
    planGrowthAnnualPriceId:   flags.planGrowthAnnualPriceId,
    planProMonthlyPriceId:     flags.planProMonthlyPriceId,
    planProAnnualPriceId:      flags.planProAnnualPriceId,
    updatedAt:                 result.updatedAt,
  };
}

// ── Write ──────────────────────────────────────────────────────────────────────

/**
 * Save Stripe integration settings.
 *
 * For each field:
 *   • Pass the new value to set it.
 *   • Pass "" to clear it.
 *   • Omit (undefined) to leave the existing value untouched.
 *
 * Basic format checks:
 *   publishableKey  must start with "pk_" when non-empty
 *   secretKey       must start with "sk_" when non-empty
 *   webhookSecret   must start with "whsec_" when non-empty
 */
export async function saveStripePlatformSettingsAction(input: {
  publishableKey?:            string;
  secretKey?:                 string;
  webhookSecret?:             string;
  creditBundle250PriceId?:    string;
  creditBundle1000PriceId?:   string;
  creditBundle5000PriceId?:   string;
  planStarterMonthlyPriceId?: string;
  planStarterAnnualPriceId?:  string;
  planGrowthMonthlyPriceId?:  string;
  planGrowthAnnualPriceId?:   string;
  planProMonthlyPriceId?:     string;
  planProAnnualPriceId?:      string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const publishableKey            = input.publishableKey            !== undefined ? trimField(input.publishableKey)            : undefined;
  const secretKey                 = input.secretKey                 !== undefined ? trimField(input.secretKey)                 : undefined;
  const webhookSecret             = input.webhookSecret             !== undefined ? trimField(input.webhookSecret)             : undefined;
  const creditBundle250PriceId    = input.creditBundle250PriceId    !== undefined ? trimField(input.creditBundle250PriceId)    : undefined;
  const creditBundle1000PriceId   = input.creditBundle1000PriceId   !== undefined ? trimField(input.creditBundle1000PriceId)   : undefined;
  const creditBundle5000PriceId   = input.creditBundle5000PriceId   !== undefined ? trimField(input.creditBundle5000PriceId)   : undefined;
  const planStarterMonthlyPriceId = input.planStarterMonthlyPriceId !== undefined ? trimField(input.planStarterMonthlyPriceId) : undefined;
  const planStarterAnnualPriceId  = input.planStarterAnnualPriceId  !== undefined ? trimField(input.planStarterAnnualPriceId)  : undefined;
  const planGrowthMonthlyPriceId  = input.planGrowthMonthlyPriceId  !== undefined ? trimField(input.planGrowthMonthlyPriceId)  : undefined;
  const planGrowthAnnualPriceId   = input.planGrowthAnnualPriceId   !== undefined ? trimField(input.planGrowthAnnualPriceId)   : undefined;
  const planProMonthlyPriceId     = input.planProMonthlyPriceId     !== undefined ? trimField(input.planProMonthlyPriceId)     : undefined;
  const planProAnnualPriceId      = input.planProAnnualPriceId      !== undefined ? trimField(input.planProAnnualPriceId)      : undefined;

  // Length checks — all fields
  for (const [field, value] of [
    ["publishableKey",            publishableKey],
    ["secretKey",                 secretKey],
    ["webhookSecret",             webhookSecret],
    ["creditBundle250PriceId",    creditBundle250PriceId],
    ["creditBundle1000PriceId",   creditBundle1000PriceId],
    ["creditBundle5000PriceId",   creditBundle5000PriceId],
    ["planStarterMonthlyPriceId", planStarterMonthlyPriceId],
    ["planStarterAnnualPriceId",  planStarterAnnualPriceId],
    ["planGrowthMonthlyPriceId",  planGrowthMonthlyPriceId],
    ["planGrowthAnnualPriceId",   planGrowthAnnualPriceId],
    ["planProMonthlyPriceId",     planProMonthlyPriceId],
    ["planProAnnualPriceId",      planProAnnualPriceId],
  ] as [string, string | undefined][]) {
    if (value !== undefined) {
      const lenErr = validateLength(field, value);
      if (lenErr) return { ok: false, error: lenErr };
    }
  }

  // Format checks (only when non-empty — "" means "clear")
  if (publishableKey) {
    const fmtErr = validateKeyFormat("Publishable key", publishableKey, "pk_");
    if (fmtErr) return { ok: false, error: fmtErr };
  }
  if (secretKey) {
    const fmtErr = validateKeyFormat("Secret key", secretKey, "sk_");
    if (fmtErr) return { ok: false, error: fmtErr };
  }
  if (webhookSecret) {
    const fmtErr = validateKeyFormat("Webhook secret", webhookSecret, "whsec_");
    if (fmtErr) return { ok: false, error: fmtErr };
  }
  // All price IDs must start with "price_" when non-empty
  for (const [field, value] of [
    ["250-credit bundle price ID",     creditBundle250PriceId],
    ["1,000-credit bundle price ID",   creditBundle1000PriceId],
    ["5,000-credit bundle price ID",   creditBundle5000PriceId],
    ["Starter monthly price ID",       planStarterMonthlyPriceId],
    ["Starter annual price ID",        planStarterAnnualPriceId],
    ["Growth monthly price ID",        planGrowthMonthlyPriceId],
    ["Growth annual price ID",         planGrowthAnnualPriceId],
    ["Pro monthly price ID",           planProMonthlyPriceId],
    ["Pro annual price ID",            planProAnnualPriceId],
  ] as [string, string | undefined][]) {
    if (value) {
      const fmtErr = validateKeyFormat(field, value, "price_");
      if (fmtErr) return { ok: false, error: fmtErr };
    }
  }

  const result = await savePlatformStripeSettings({
    publishableKey,
    secretKey,
    webhookSecret,
    creditBundle250PriceId,
    creditBundle1000PriceId,
    creditBundle5000PriceId,
    planStarterMonthlyPriceId,
    planStarterAnnualPriceId,
    planGrowthMonthlyPriceId,
    planGrowthAnnualPriceId,
    planProMonthlyPriceId,
    planProAnnualPriceId,
  });

  if (!result.ok) return result;

  revalidatePath("/admin/platform/integrations/stripe");
  revalidatePath("/admin/platform/integrations");
  return { ok: true };
}

// ── Test connection ────────────────────────────────────────────────────────────

/**
 * Ping the Stripe API with the stored secret key.
 *
 * Calls GET /v1/balance (a lightweight, read-only endpoint).
 * Returns whether the connection succeeded and whether the key is in live mode.
 *
 * Falls back to the STRIPE_SECRET_KEY env var if no key is stored in the DB
 * (same priority order as the rest of the billing module).
 */
export async function testStripeConnectionAction(): Promise<
  | { ok: true;  liveMode: boolean; message: string }
  | { ok: false; error:    string }
> {
  const result = await getPlatformStripeSettings();
  if (!result.ok) return { ok: false, error: result.error };

  const secretKey =
    result.data.secretKey ??
    process.env["STRIPE_SECRET_KEY"] ??
    "";

  if (!secretKey) {
    return { ok: false, error: "No secret key configured. Save a secret key first." };
  }

  try {
    const resp = await fetch("https://api.stripe.com/v1/balance", {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
      cache: "no-store",
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({})) as { error?: { message?: string } };
      return {
        ok:    false,
        error: body?.error?.message ?? `Stripe returned HTTP ${resp.status}`,
      };
    }

    const body = await resp.json() as { livemode?: boolean };
    const liveMode = Boolean(body.livemode);

    return {
      ok:       true,
      liveMode,
      message:  liveMode
        ? "Connected — live mode key"
        : "Connected — test mode key",
    };
  } catch (err) {
    return {
      ok:    false,
      error: `Network error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
