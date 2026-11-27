/**
 * Setting up or replacing the payment method, at Mollie.
 *
 * The tenant pays one cent with the account or card they want charged from
 * now on. That payment delivers nothing. Its whole point is the mandate it
 * gives, which mollie-customer.ts stores in place of the old one.
 *
 * The old mandate is not revoked at Mollie. A direct debit that is still on
 * its way may hang on it, and revoking could cancel that. The platform simply
 * stops using it: it charges the mandate in its own record, and nothing else.
 */

import type { MolliePayment } from "./mollie";
import type { MollieFulfilment } from "./mollie-fulfil";

/** `metadata.type` of the payment that verifies a new payment method. */
export const PAYMENT_METHOD_PAYMENT_TYPE = "payment_method";

/** One cent: the smallest amount iDEAL accepts. */
export const PAYMENT_METHOD_VERIFICATION_CENTS = 1;

/**
 * What the verification payment came to. Pure.
 *
 * `updated` is decided by whether the mandate was stored: a paid payment
 * without a usable mandate changed nothing, and must not read as a success.
 */
export function paymentMethodOutcome(payment: MolliePayment, mandateStored: boolean): MollieFulfilment {
  const status = String(payment.status);
  if (status === "open" || status === "pending" || status === "authorized") {
    return { outcome: "payment-method", state: "waiting", status };
  }
  if (status !== "paid") return { outcome: "payment-method", state: "not-paid", status };
  return { outcome: "payment-method", state: mandateStored ? "updated" : "no-mandate", status };
}
