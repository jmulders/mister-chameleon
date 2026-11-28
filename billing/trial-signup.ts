/**
 * billing/trial-signup.ts
 *
 * A trial without a payment method.
 *
 * Until 28 Nov 2026 a visitor had to put a card on file (Stripe) or pay one
 * cent (Mollie) to start a trial. The owner asked to take that away: being
 * asked for payment details makes a trial feel like a commitment, and that is
 * a threshold most visitors do not cross.
 *
 * What stood in for it is the visitor's e-mail address. The form is stored as
 * a pending signup, a link goes to the address, and the account is made when
 * the link is opened. So an account still needs something only the visitor
 * has, and a made-up address makes nothing.
 *
 * The link carries a signed token and nothing is stored for it. The token is
 * signed with a key of its own, derived from the admin secret, so it can
 * never be read as an admin session and an admin session never as this.
 *
 * TRIAL_REQUIRES_PAYMENT=on brings back the old way (billing/mollie-trial.ts
 * and the Stripe Checkout in /api/trial/checkout-session).
 */

import { SignJWT, jwtVerify } from "jose";
import type { SupabaseClient } from "@supabase/supabase-js";
import { escapeHtml } from "@/lib/html-escape";
import type { SiteLocale } from "@/lib/site-texts/locale";
import { TRIAL_SESSION_LIMIT } from "./trial-session-cap";
import type { ProvisionResult, ProvisionedTrial } from "./trial-provisioning";

/** True when a trial starts with a payment method, as it did before. */
export function trialNeedsPayment(env: Record<string, string | undefined> = process.env): boolean {
  return env["TRIAL_REQUIRES_PAYMENT"] === "on";
}

/** How long the link in the confirmation mail works. */
export const CONFIRM_TTL_HOURS = 48;

const AUDIENCE = "trial-confirm";

/** A key for these tokens only: never the admin secret itself. */
async function confirmationKey(secret: string): Promise<Uint8Array> {
  if (secret.length < 32) throw new Error("trial confirmation: the signing secret is missing or too short");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${AUDIENCE}:${secret}`));
  return new Uint8Array(digest);
}

export async function signTrialConfirmation(pendingId: string, secret: string, now: Date = new Date()): Promise<string> {
  const issued = Math.floor(now.getTime() / 1000);
  return new SignJWT({ sub: pendingId, aud: AUDIENCE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(issued)
    .setExpirationTime(issued + CONFIRM_TTL_HOURS * 60 * 60)
    .sign(await confirmationKey(secret));
}

export type ConfirmationToken =
  | { ok: true;  pendingId: string }
  | { ok: false; reason: "expired" | "invalid" };

export async function readTrialConfirmation(token: string, secret: string, now: Date = new Date()): Promise<ConfirmationToken> {
  try {
    const { payload } = await jwtVerify(token, await confirmationKey(secret), { audience: AUDIENCE, algorithms: ["HS256"], currentDate: now });
    return typeof payload.sub === "string" && payload.sub ? { ok: true, pendingId: payload.sub } : { ok: false, reason: "invalid" };
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    return { ok: false, reason: code === "ERR_JWT_EXPIRED" ? "expired" : "invalid" };
  }
}

export function confirmationUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/checkout/confirm?token=${encodeURIComponent(token)}`;
}

// ── The mail ───────────────────────────────────────────────────────────────────

export interface ConfirmationMail { subject: string; text: string; html: string }

const MAIL: Record<SiteLocale, {
  subject: string; greeting: (name: string) => string; lead: string; button: string;
  terms: string; validity: string; ignore: string; signoff: string;
}> = {
  nl: {
    subject:  "Bevestig je e-mailadres en start je proefperiode",
    greeting: (name) => `Hallo ${name},`,
    lead:     "Je hebt je aangemeld voor een proefperiode bij Mister Chameleon. Bevestig je e-mailadres, dan staat je account klaar.",
    button:   "Bevestig en start je proefperiode",
    terms:    `Je probeert 14 dagen gratis, tot ${TRIAL_SESSION_LIMIT} gepersonaliseerde bezoeken. Je hoeft geen betaalgegevens in te vullen en er wordt niets afgeschreven.`,
    validity: `De link werkt ${CONFIRM_TTL_HOURS} uur.`,
    ignore:   "Heb je je niet aangemeld? Dan hoef je niets te doen. Zonder bevestiging maken we geen account aan.",
    signoff:  "Het team van Mister Chameleon",
  },
  en: {
    subject:  "Confirm your e-mail address and start your trial",
    greeting: (name) => `Hi ${name},`,
    lead:     "You signed up for a trial of Mister Chameleon. Confirm your e-mail address and your account is ready.",
    button:   "Confirm and start your trial",
    terms:    `You try it free for 14 days, up to ${TRIAL_SESSION_LIMIT} personalised sessions. You do not enter payment details and nothing is charged.`,
    validity: `The link works for ${CONFIRM_TTL_HOURS} hours.`,
    ignore:   "Did not sign up? Then there is nothing to do. Without a confirmation no account is made.",
    signoff:  "The Mister Chameleon team",
  },
};

export function confirmationMail(locale: SiteLocale, input: { name: string; url: string }): ConfirmationMail {
  const w = MAIL[locale] ?? MAIL.en;
  const text = [w.greeting(input.name), "", w.lead, "", input.url, "", w.terms, w.validity, "", w.ignore, "", w.signoff].join("\n");
  const html =
    `<p>${escapeHtml(w.greeting(input.name))}</p>` +
    `<p>${escapeHtml(w.lead)}</p>` +
    `<p><a href="${escapeHtml(input.url)}" style="display:inline-block;padding:12px 20px;background:#1a171b;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">${escapeHtml(w.button)}</a></p>` +
    `<p>${escapeHtml(w.terms)} ${escapeHtml(w.validity)}</p>` +
    `<p style="color:#5c585d">${escapeHtml(w.ignore)}</p>` +
    `<p>${escapeHtml(w.signoff)}</p>`;
  return { subject: w.subject, text, html };
}

/**
 * Send the confirmation mail through the platform's own transport.
 *
 * Returns false when there is no transport or the mail was refused. The
 * caller then tells the visitor: without this mail the signup cannot go on.
 */
export async function sendConfirmationMail(to: string, mail: ConfirmationMail): Promise<boolean> {
  try {
    const { sendMail, resolveTransportConfig } = await import("@/forms/mail-transport");
    const { serverEnv }                        = await import("@/lib/env");
    const { getPlatformEmailSettings }         = await import("@/platform/platform-store");
    const { PLATFORM_FROM }                    = await import("@/lib/platform-contact");
    const settings  = await getPlatformEmailSettings();
    const transport = resolveTransportConfig(null, settings.ok ? settings.data : null);
    const result    = await sendMail({
      from: serverEnv.email.fromAddress ?? PLATFORM_FROM, to: [to],
      subject: mail.subject, text: mail.text, html: mail.html,
    }, transport);
    if (!result.ok) console.warn("[trial] confirmation mail failed:", result.error);
    return result.ok;
  } catch (err) {
    console.warn("[trial] confirmation mail threw:", err);
    return false;
  }
}

// ── Opening the link ───────────────────────────────────────────────────────────

export type ConfirmOutcome =
  | { state: "created"; tenantId: string }
  /** The link was used before: the account exists. */
  | { state: "already" }
  | { state: "expired" }
  | { state: "invalid" }
  /** The signup could not be turned into an account. */
  | { state: "failed"; reason: string };

export interface ConfirmDeps {
  once:      (client: SupabaseClient, key: string, tenantKey: string, run: () => Promise<void>) => Promise<"ran" | "already">;
  provision: (client: SupabaseClient, pendingId: string, logTag: string) => Promise<ProvisionResult>;
  complete:  (client: SupabaseClient, pendingId: string, trial: ProvisionedTrial) => Promise<void>;
}

async function defaultDeps(): Promise<ConfirmDeps> {
  const { creditCheckoutSessionOnce }                = await import("./checkout-credit-claim");
  const { provisionTrialTenant, completeTrialSignup } = await import("./trial-provisioning");
  return {
    once: async (client, key, tenantKey, run) =>
      (await creditCheckoutSessionOnce(client, key, tenantKey, false, "trial_confirm", run)) === "credited" ? "ran" : "already",
    provision: provisionTrialTenant,
    complete:  (client, pendingId, trial) => completeTrialSignup(client, pendingId, trial, "E-mail", "[trial]"),
  };
}

/**
 * The visitor opened the link: make the account, once.
 *
 * Claimed on the signup's id, so two clicks at the same moment make one
 * account. The second click, then or days later, is told the account exists.
 */
export async function confirmTrialSignup(
  client: SupabaseClient,
  token:  string,
  secret: string,
  deps?:  ConfirmDeps,
  now:    Date = new Date(),
): Promise<ConfirmOutcome> {
  const read = await readTrialConfirmation(token, secret, now);
  if (!read.ok) return { state: read.reason };
  const { pendingId } = read;

  const { data: row } = await client.from("pending_trial_signups").select("status").eq("id", pendingId).maybeSingle();
  const status = (row as { status?: string } | null)?.status;
  if (!status) return { state: "invalid" };
  if (status === "completed") return { state: "already" };

  const d = deps ?? await defaultDeps();
  let created: ProvisionedTrial | null = null;
  let failure: string | null = null;

  const ran = await d.once(client, `trial-confirm:${pendingId}`, `pending:${pendingId}`, async () => {
    const provisioned = await d.provision(client, pendingId, "[trial]");
    if (!provisioned.ok) { failure = provisioned.action; return; }
    const trial = provisioned.trial;
    created = trial;

    // The subscription is the platform's own: no provider ids, no payment
    // method. `trialing` puts the tenant under the trial's session limit. What
    // happens when it ends is in the daily job (see billing/trial-end.ts).
    const { error } = await client.from("subscriptions").upsert({
      tenant_id:            trial.tenantId,
      plan:                 trial.planId,
      status:               "trialing",
      billing_cycle:        "monthly",
      current_period_start: trial.now,
      current_period_end:   trial.trialEndsAt,
      trial_end:            trial.trialEndsAt,
    }, { onConflict: "tenant_id" });
    if (error) console.error("[trial] trial_signup: subscriptions upsert failed:", error.message);

    await d.complete(client, pendingId, trial);
    console.info(`[trial] trial_signup: created user=${trial.userId} tenant=${trial.tenantId} plan=${trial.planId}`);
  });

  if (failure) return { state: "failed", reason: failure };
  if (ran === "already") return { state: "already" };
  const made = created as ProvisionedTrial | null;
  return made ? { state: "created", tenantId: made.tenantId } : { state: "failed", reason: "nothing was provisioned" };
}
