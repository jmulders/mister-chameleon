/**
 * One credit per paid Stripe Checkout session, however often we hear about it.
 *
 * A bundle or top-up payment reaches us twice by design: the webhook
 * (checkout.session.completed) and the browser coming back to the success
 * page. Each used its own key for "did I already credit this?" (the event id
 * and the session id), and the wallet function in use stores that key in a
 * column the check did not read. So both credited, and every reload of the
 * success page credited again.
 *
 * The claim here is the single gate for both paths. It inserts one row keyed
 * on the Checkout session id into wallet_webhook_events, whose stripe_event_id
 * column is unique: the insert succeeds exactly once, in the database, so two
 * requests arriving together cannot both win. Whoever claims, credits. If the
 * credit then fails, the claim is released so a retry can try again.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type ClaimResult = "claimed" | "already-claimed" | "unavailable";

/** The row key for a session's credit. Distinct from real event ids (evt_…). */
export function checkoutCreditClaimKey(checkoutSessionId: string): string {
  return `credit:${checkoutSessionId}`;
}

/**
 * Try to become the one request that credits this Checkout session.
 *
 * "unavailable" means the claim table could not be written (missing or a
 * database error). The caller then falls back to its own check rather than
 * refusing a credit the customer paid for.
 */
export async function claimCheckoutCredit(
  client:            SupabaseClient,
  checkoutSessionId: string,
  tenantId:          string,
  livemode:          boolean,
  kind:              string,
): Promise<ClaimResult> {
  try {
    const { data, error } = await client
      .from("wallet_webhook_events")
      .upsert(
        {
          stripe_event_id: checkoutCreditClaimKey(checkoutSessionId),
          event_type:      "checkout.session.credit",
          livemode,
          tenant_id:       tenantId,
          handled:         true,
          action:          `${kind}_credited`,
        },
        { onConflict: "stripe_event_id", ignoreDuplicates: true },
      )
      .select("stripe_event_id");
    if (error) {
      console.error("[billing/credit-claim] claim failed", { checkoutSessionId, error: error.message });
      return "unavailable";
    }
    return Array.isArray(data) && data.length > 0 ? "claimed" : "already-claimed";
  } catch (err) {
    console.error("[billing/credit-claim] claim threw", { checkoutSessionId, err });
    return "unavailable";
  }
}

/** Give the claim back after a failed credit, so the next attempt can credit. */
export async function releaseCheckoutCredit(
  client:            SupabaseClient,
  checkoutSessionId: string,
): Promise<void> {
  try {
    await client
      .from("wallet_webhook_events")
      .delete()
      .eq("stripe_event_id", checkoutCreditClaimKey(checkoutSessionId));
  } catch (err) {
    console.error("[billing/credit-claim] release threw", { checkoutSessionId, err });
  }
}

/**
 * Claim, run the credit, release on failure.
 *
 * @returns "credited" when `credit` ran, "already-credited" when another
 *          request holds the claim. Rethrows what `credit` throws.
 */
export async function creditCheckoutSessionOnce(
  client:            SupabaseClient,
  checkoutSessionId: string,
  tenantId:          string,
  livemode:          boolean,
  kind:              string,
  credit:            () => Promise<unknown>,
): Promise<"credited" | "already-credited"> {
  const claim = await claimCheckoutCredit(client, checkoutSessionId, tenantId, livemode, kind);
  if (claim === "already-claimed") return "already-credited";

  try {
    await credit();
  } catch (err) {
    if (claim === "claimed") await releaseCheckoutCredit(client, checkoutSessionId);
    throw err;
  }
  return "credited";
}
