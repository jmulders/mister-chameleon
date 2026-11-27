/**
 * The amount of the payment that gives a mandate.
 *
 * The tenant pays one wallet top-up and thereby allows the automatic ones.
 * The same bounds as the manual top-up route: at least one euro, at most a
 * thousand per payment.
 */

export const FIRST_PAYMENT_MIN_CENTS = 100;
export const FIRST_PAYMENT_MAX_CENTS = 100_000;

export type FirstPaymentAmount =
  | { ok: true;  cents: number }
  | { ok: false; error: string };

/**
 * Pure. The amount the request names, else the tenant's own automatic top-up
 * amount. Anything outside the bounds is refused, never clamped: the tenant
 * must see the amount they agreed to.
 */
export function firstPaymentAmount(requested: unknown, walletAmountCents: unknown): FirstPaymentAmount {
  const picked = requested ?? walletAmountCents;
  if (typeof picked !== "number" || !Number.isInteger(picked)) {
    return { ok: false, error: "Set an automatic top-up amount first." };
  }
  if (picked < FIRST_PAYMENT_MIN_CENTS) {
    return { ok: false, error: "The top-up amount must be at least €1.00." };
  }
  if (picked > FIRST_PAYMENT_MAX_CENTS) {
    return { ok: false, error: "The top-up amount may be at most €1000.00 per payment." };
  }
  return { ok: true, cents: picked };
}
