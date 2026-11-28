/**
 * billing/trial-end.ts
 *
 * The end of a trial that has no payment method.
 *
 * A trial asks for no payment details (billing/trial-signup.ts), so when its
 * fourteen days are over there is nothing to charge. That is not a missed
 * payment. Nothing is owed, so there is no reminder and no "past due": the
 * subscription is paused. Paused means the tenant's site shows its ordinary
 * pages again (the payment gate treats it like unpaid), the account and
 * everything in it stay, and the tenant goes on by paying the first period in
 * the dashboard.
 *
 * With Mollie that payment is the one the dashboard already offers for a
 * charge that failed (billing/mollie-renewal.ts): the daily job tried to
 * charge the first period, found no mandate and left the period open. Paying
 * it gives the mandate and makes the subscription active.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { escapeHtml } from "@/lib/html-escape";

/** True when the charge of a period failed only because a trial has nothing to charge. */
export function isTrialEndWithoutPayment(
  sub:    { status: string },
  charge: { ok: boolean; noPaymentMethod?: boolean },
): boolean {
  return sub.status === "trialing" && !charge.ok && charge.noPaymentMethod === true;
}

export interface TrialEndedMail { subject: string; text: string; html: string }

/**
 * The mail for a trial that is over. Dutch first, English under it: the job
 * that sends it does not know which language the tenant reads.
 */
export function trialEndedMail(input: { planName: string; priceCents: number; billingUrl: string }): TrialEndedMail {
  const price = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(input.priceCents / 100);
  const nl = [
    "Je proefperiode bij Mister Chameleon is afgelopen.",
    "Er is niets afgeschreven en je zit nergens aan vast. Je site toont nu weer je gewone pagina's. Je account, je regels en je versies blijven staan.",
    `Wil je doorgaan? Dan kies je in je account het pakket ${input.planName} (${price} per maand, excl. btw) of een ander pakket en reken je de eerste maand af. Daarna staat alles weer aan.`,
  ];
  const en = [
    "Your trial of Mister Chameleon has ended.",
    "Nothing was charged and you are not tied to anything. Your site shows its ordinary pages again. Your account, your rules and your versions stay as they are.",
    `Want to go on? Choose the ${input.planName} plan (${price} a month, excl. VAT) or another plan in your account and pay the first month. After that everything is on again.`,
  ];
  const text = [...nl, "", input.billingUrl, "", "Het team van Mister Chameleon", "", "English", "", ...en, "", input.billingUrl, "", "The Mister Chameleon team"].join("\n");
  const para = (lines: string[]) => lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("");
  const link = (label: string) => `<p><a href="${escapeHtml(input.billingUrl)}" style="display:inline-block;padding:12px 20px;background:#1a171b;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">${escapeHtml(label)}</a></p>`;
  const html = para(nl) + link("Ga door met Mister Chameleon") + `<p>Het team van Mister Chameleon</p><hr style="border:none;border-top:1px solid #e3e1e4;margin:24px 0">` + para(en) + link("Go on with Mister Chameleon") + `<p>The Mister Chameleon team</p>`;
  return { subject: "Je proefperiode is afgelopen / Your trial has ended", text, html };
}

export interface TrialEndDeps {
  /** Who to tell: the invoice address, else the tenant's own admins. */
  recipients: (client: SupabaseClient, tenantId: string) => Promise<string[]>;
  send:       (to: string[], mail: TrialEndedMail) => Promise<boolean>;
  billingUrl: (tenantId: string) => Promise<string>;
}

async function defaultDeps(): Promise<TrialEndDeps> {
  return {
    recipients: async (client, tenantId) => {
      const { data: details } = await client.from("billing_details").select("invoice_email").eq("tenant_id", tenantId).maybeSingle();
      const invoiceEmail = (details as { invoice_email?: string | null } | null)?.invoice_email;
      if (invoiceEmail) return [invoiceEmail];
      const { data: links } = await client.from("admin_user_tenants").select("user_id").eq("tenant_id", tenantId);
      const ids = ((links as { user_id: string }[] | null) ?? []).map((l) => l.user_id);
      if (ids.length === 0) return [];
      const { data: users } = await client.from("admin_users").select("email, is_active").in("id", ids);
      return ((users as { email: string; is_active: boolean | null }[] | null) ?? []).filter((u) => u.is_active !== false && u.email).map((u) => u.email);
    },
    send: async (to, mail) => {
      const { sendMail, resolveTransportConfig } = await import("@/forms/mail-transport");
      const { serverEnv }                        = await import("@/lib/env");
      const { getPlatformEmailSettings }         = await import("@/platform/platform-store");
      const { PLATFORM_FROM }                    = await import("@/lib/platform-contact");
      const settings  = await getPlatformEmailSettings();
      const transport = resolveTransportConfig(null, settings.ok ? settings.data : null);
      const result    = await sendMail({ from: serverEnv.email.fromAddress ?? PLATFORM_FROM, to, subject: mail.subject, text: mail.text, html: mail.html }, transport);
      return result.ok;
    },
    billingUrl: async (tenantId) => {
      const base = (process.env["NEXT_PUBLIC_APP_URL"] ?? "").replace(/\/+$/, "");
      return `${base}/admin/tenants/${encodeURIComponent(tenantId)}/billing`;
    },
  };
}

export interface TrialEndResult {
  /** False when the subscription was no longer a trial: another run was first. */
  paused: boolean;
  mailed: boolean;
}

/**
 * Pause the subscription of a trial that ended with nothing to charge, and
 * tell the tenant. The pause is claimed on the status, so two runs of the job
 * pause and mail once. The mail is best effort: a tenant whose mail could not
 * be sent still sees the same in the dashboard.
 */
export async function endTrialWithoutPayment(
  client:   SupabaseClient,
  tenantId: string,
  info:     { planName: string; priceCents: number },
  deps?:    TrialEndDeps,
): Promise<TrialEndResult> {
  const now = new Date().toISOString();
  const { data: turned, error } = await client
    .from("subscriptions")
    .update({ status: "paused", updated_at: now })
    .eq("tenant_id", tenantId)
    .eq("status", "trialing")
    .select("tenant_id");
  if (error) throw new Error(`subscriptions update failed: ${error.message}`);
  if (!Array.isArray(turned) || turned.length === 0) return { paused: false, mailed: false };

  let mailed = false;
  try {
    const d  = deps ?? await defaultDeps();
    const to = await d.recipients(client, tenantId);
    if (to.length > 0) mailed = await d.send(to, trialEndedMail({ ...info, billingUrl: await d.billingUrl(tenantId) }));
    else console.warn(`[trial-end] no address to tell tenant=${tenantId} that the trial ended`);
  } catch (err) {
    console.warn(`[trial-end] mail failed: tenant=${tenantId}`, err);
  }
  return { paused: true, mailed };
}
