/**
 * What a paid Stripe Checkout session for a session bundle delivers.
 *
 * Two roads lead here for the same payment: Stripe's webhook
 * (checkout.session.completed, or async_payment_succeeded for a delayed
 * method) and the browser coming back to the billing page. Either can be
 * first, either can be missing (a closed tab, a webhook that cannot reach
 * localhost) and both can come twice. Until now only the browser credited, so
 * a buyer who paid and closed the tab never got the sessions.
 *
 * The delivery is claimed once per Checkout session id, with the claim the
 * credit bundle uses (checkout-credit-claim.ts): the first road credits, every
 * later one is told it was done.
 *
 * The session that is passed in must come from Stripe itself: a verified
 * webhook event, or a session retrieved with the platform's own key. Its
 * payment status and metadata are then facts: the metadata was written by the
 * platform when it created the checkout and the buyer cannot change it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { creditCheckoutSessionOnce } from "./checkout-credit-claim";
import { SESSION_CREDIT_BUNDLES } from "./plans";

export const SESSION_BUNDLE_KIND = "session_bundle";

/** The fields of a Checkout session this delivery reads. */
export interface SessionBundleCheckout {
  id:              string;
  payment_status?: string | null;
  metadata?:       Record<string, string | undefined> | null;
}

export type SessionBundlePlan =
  /** Paid, and this is what to deliver. */
  | { action: "credit"; tenantId: string; bundleId: string; sessions: number; label: string }
  /** Not paid yet: a delayed method reports the money in a later event. */
  | { action: "wait";   status: string; tenantId: string }
  /** Not something this code may deliver. Logged, never credited. */
  | { action: "refuse"; reason: "not_session_bundle" | "no_tenant" | "unknown_bundle" };

/**
 * Decide what a Checkout session delivers. Pure, so every refusal is testable.
 */
export function planSessionBundleCheckout(session: SessionBundleCheckout): SessionBundlePlan {
  if (session.metadata?.type !== SESSION_BUNDLE_KIND) return { action: "refuse", reason: "not_session_bundle" };

  const tenantId = session.metadata.tenant_id ?? "";
  if (!tenantId) return { action: "refuse", reason: "no_tenant" };

  const bundleId = session.metadata.bundle_id ?? "";
  const bundle   = SESSION_CREDIT_BUNDLES.find((b) => b.id === bundleId);
  if (!bundle) return { action: "refuse", reason: "unknown_bundle" };

  // Only "paid" delivers. A missing status is not read as paid.
  if (session.payment_status !== "paid") {
    return { action: "wait", status: String(session.payment_status ?? "unknown"), tenantId };
  }

  return { action: "credit", tenantId, bundleId, sessions: bundle.sessions, label: bundle.label };
}

export type SessionBundleFulfilment =
  | { outcome: "credited" | "already-credited"; tenantId: string; bundleId: string; sessions: number; label: string }
  | { outcome: "awaiting-payment"; status: string; tenantId: string }
  | { outcome: "refused";          reason: string; tenantId: string | null };

export interface SessionBundleFulfilDeps {
  /** checkout-credit-claim.ts: runs `credit` once per Checkout session id. */
  creditOnce: (
    client: SupabaseClient, checkoutSessionId: string, tenantId: string, livemode: boolean, kind: string,
    credit: () => Promise<unknown>,
  ) => Promise<"credited" | "already-credited">;
  /** True when the ledger already holds a purchase for this Checkout session. */
  ledgerHasPurchase: (client: SupabaseClient, tenantId: string, checkoutSessionId: string) => Promise<boolean>;
  addSessionCredits: (
    client: SupabaseClient, tenantId: string, sessions: number, bundleId: string, checkoutSessionId: string, note: string,
  ) => Promise<void>;
}

const defaultDeps: SessionBundleFulfilDeps = {
  creditOnce: creditCheckoutSessionOnce,

  ledgerHasPurchase: async (client, tenantId, checkoutSessionId) => {
    // add_session_credits() stores the Checkout session id in this column, and
    // did so before the claim existed. An exact match, and a list instead of a
    // single row: a purchase that was credited twice in the past must read as
    // "there", not as an error.
    const { data, error } = await client
      .from("session_credit_ledger")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("entry_type", "purchase")
      .eq("stripe_payment_intent_id", checkoutSessionId)
      .limit(1);
    if (error) throw new Error(`session_credit_ledger lookup failed: ${error.message}`);
    return Array.isArray(data) && data.length > 0;
  },

  addSessionCredits: async (client, tenantId, sessions, bundleId, checkoutSessionId, note) => {
    // The RPC reports a failure in its answer instead of throwing. It must
    // throw here, or the claim would stand on a delivery that did not happen.
    const { error } = await client.rpc("add_session_credits", {
      p_tenant_id: tenantId,
      p_amount:    sessions,
      p_bundle_id: bundleId,
      p_stripe_id: checkoutSessionId,
      p_note:      note,
    });
    if (error) throw new Error(`add_session_credits failed: ${error.message}`);
  },
};

/**
 * Deliver a session bundle, once. Throws when the delivery itself fails; the
 * claim is then released, so the other road or a retry can still deliver.
 */
export async function fulfilSessionBundleCheckout(
  client:   SupabaseClient,
  session:  SessionBundleCheckout,
  livemode: boolean,
  deps:     SessionBundleFulfilDeps = defaultDeps,
): Promise<SessionBundleFulfilment> {
  const plan = planSessionBundleCheckout(session);
  if (plan.action === "refuse") {
    return { outcome: "refused", reason: plan.reason, tenantId: session.metadata?.tenant_id || null };
  }
  if (plan.action === "wait") {
    return { outcome: "awaiting-payment", status: plan.status, tenantId: plan.tenantId };
  }

  // A purchase credited before the claim existed has a ledger row but no
  // claim. Its webhook resent, or its success page reloaded, must not credit
  // again. The claim is kept in that case, so the next call stops at the claim.
  // The same lookup is the check to fall back on when the claim table cannot
  // be written.
  let inLedger = false;
  const claimed = await deps.creditOnce(client, session.id, plan.tenantId, livemode, SESSION_BUNDLE_KIND, async () => {
    inLedger = await deps.ledgerHasPurchase(client, plan.tenantId, session.id);
    if (inLedger) return;
    await deps.addSessionCredits(client, plan.tenantId, plan.sessions, plan.bundleId, session.id,
      `${plan.label}, Stripe checkout ${session.id}`);
  });

  return {
    outcome:  claimed === "credited" && !inLedger ? "credited" : "already-credited",
    tenantId: plan.tenantId,
    bundleId: plan.bundleId,
    sessions: plan.sessions,
    label:    plan.label,
  };
}
