/**
 * The trial signup through Mollie (step 2b).
 *
 * With Stripe the visitor enters a card and nothing is charged for 14 days.
 * Mollie has no "card on file without a payment" for iDEAL: a mandate comes
 * from a first payment that is really paid. So the signup asks for a small
 * verification payment. Paying it does two things: it proves the payment
 * method, and it gives the mandate the subscription will be charged on once
 * the trial ends.
 *
 * What is NOT here yet: the charge at the end of the trial and every month
 * after it. That is step 3. Until it exists a tenant that signs up this way
 * stays on trial, so this path has its own switch and is off by default:
 *
 *     PAYMENT_PROVIDER=mollie   and   MOLLIE_TRIAL_SIGNUP=on
 *
 * The flow
 *
 *   form → pending_trial_signups row → Mollie customer → first payment
 *   paid (webhook or the visitor's return, whichever is first, once)
 *     → admin user + tenant (trial-provisioning.ts, shared with Stripe)
 *     → subscriptions row: trialing, 14 days
 *     → mollie_customers row: the customer and its mandate
 *     → welcome mails
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  centsFromMollieAmount,
  createMollieCustomer,
  createMolliePayment,
  isMollieCustomerId,
  isMollieMandateId,
  mollieConfigured,
  mollieWebhookUrl,
  type MollieDeps,
  type MolliePayment,
} from "./mollie";
import type { MollieFulfilment } from "./mollie-fulfil";
import { getPaymentProvider } from "./payment-provider";
import { completeTrialSignup, provisionTrialTenant, type ProvisionResult, type ProvisionedTrial } from "./trial-provisioning";

/** `metadata.type` of the verification payment of a trial signup. */
export const TRIAL_SIGNUP_PAYMENT_TYPE = "trial_signup";

/**
 * The verification payment, in cents. One cent: the smallest amount iDEAL
 * accepts. A zero amount would only work for cards, and most Dutch companies
 * pay with iDEAL.
 */
export const TRIAL_VERIFICATION_CENTS = 1;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Pure: whether a raw setting switches the Mollie trial signup on. */
export function mollieTrialSwitchFrom(raw: string | null | undefined): boolean {
  return typeof raw === "string" && ["on", "true", "1"].includes(raw.trim().toLowerCase());
}

/** The trial signup goes through Mollie only when all three hold. */
export function mollieTrialSignupEnabled(): boolean {
  return getPaymentProvider() === "mollie"
    && mollieTrialSwitchFrom(process.env["MOLLIE_TRIAL_SIGNUP"])
    && mollieConfigured();
}

/**
 * The payments table wants a tenant, and at this point there is none: the
 * tenant is made when the payment is paid. The row carries this stand-in
 * until then.
 */
export function pendingTenantKey(pendingId: string): string {
  return `pending:${pendingId}`;
}

/** Where the visitor lands after the verification payment. */
export function trialReturnUrl(origin: string, ref: string): string {
  return `${origin}/checkout/success?ref=${ref}`;
}

export interface StartMollieTrialInput {
  pendingId: string;
  company:   string;
  email:     string;
  planId:    string;
  origin:    string;
  publicBaseUrl?: string | null;
}

export async function startMollieTrialSignup(
  client: SupabaseClient,
  input:  StartMollieTrialInput,
  deps?:  { mollie?: MollieDeps; newRef?: () => string },
): Promise<{ url: string; paymentId: string; ref: string }> {
  const ref = (deps?.newRef ?? (() => crypto.randomUUID()))();

  const customer = await createMollieCustomer(
    { name: input.company, email: input.email, metadata: { pending_signup_id: input.pendingId } },
    deps?.mollie,
  );

  const payment = await createMolliePayment(
    {
      amountCents:    TRIAL_VERIFICATION_CENTS,
      description:    "Mister Chameleon: verification of your payment method for the free trial",
      redirectUrl:    trialReturnUrl(input.origin, ref),
      webhookUrl:     mollieWebhookUrl(input.publicBaseUrl || input.origin),
      idempotencyKey: ref,
      sequenceType:   "first",
      customerId:     customer.id,
      metadata: {
        type:              TRIAL_SIGNUP_PAYMENT_TYPE,
        pending_signup_id: input.pendingId,
        plan_id:           input.planId,
        amount_cents:      String(TRIAL_VERIFICATION_CENTS),
        ref,
      },
    },
    deps?.mollie,
  );

  const url = payment._links?.checkout?.href;
  if (!url) throw new Error("Mollie returned no checkout address");

  // Without this row the return page cannot find the payment. The webhook
  // still completes the signup, so a failed insert is logged and no more.
  const { error } = await client.from("mollie_payments").insert({
    id:           payment.id,
    ref,
    tenant_id:    pendingTenantKey(input.pendingId),
    kind:         TRIAL_SIGNUP_PAYMENT_TYPE,
    bundle_id:    input.planId,
    amount_cents: TRIAL_VERIFICATION_CENTS,
    mode:         payment.mode === "live" ? "live" : "test",
    status:       String(payment.status),
  });
  if (error) {
    console.error("[mollie] trial_signup: could not record the payment", { paymentId: payment.id, error: error.message });
  }

  return { url, paymentId: payment.id, ref };
}

export type TrialSignupPlan =
  | { action: "provision"; pendingId: string; planId: string; customerId: string; mandateId: string; method: string | null }
  | { action: "wait";   status: string }
  | { action: "none";   status: string }
  | { action: "refuse"; reason: string };

/**
 * Decide what a trial signup payment allows. Pure, so every refusal is
 * testable. The payment must have been read from Mollie with the platform's
 * own key: its metadata was written by the platform and cannot be changed by
 * the visitor.
 */
export function planMollieTrialSignup(payment: MolliePayment): TrialSignupPlan {
  const status = String(payment.status);
  if (status === "open" || status === "pending" || status === "authorized") return { action: "wait", status };
  if (status !== "paid") return { action: "none", status };

  const meta      = payment.metadata ?? {};
  const pendingId = meta["pending_signup_id"];
  if (typeof pendingId !== "string" || !UUID.test(pendingId)) return { action: "refuse", reason: "no_pending_signup" };

  const paid  = centsFromMollieAmount(payment.amount);
  const asked = Number.parseInt(typeof meta["amount_cents"] === "string" ? meta["amount_cents"] : "", 10);
  if (paid === null || paid !== asked) return { action: "refuse", reason: "amount_mismatch" };

  // A trial without a mandate could never be charged. A paid first payment
  // always gives one; a payment that somehow does not is not a signup.
  if (payment.sequenceType !== "first") return { action: "refuse", reason: "not_a_first_payment" };
  if (!isMollieCustomerId(payment.customerId) || !isMollieMandateId(payment.mandateId)) {
    return { action: "refuse", reason: "no_mandate" };
  }

  const planId = meta["plan_id"];
  if (planId !== "starter" && planId !== "growth" && planId !== "pro") return { action: "refuse", reason: "unknown_plan" };

  return {
    action:     "provision",
    pendingId,
    planId,
    customerId: payment.customerId,
    mandateId:  payment.mandateId,
    method:     typeof payment.method === "string" ? payment.method : null,
  };
}

export interface TrialSettleDeps {
  /** checkout-credit-claim.ts: runs `work` once per payment id. */
  once: (
    client: SupabaseClient, paymentId: string, tenantKey: string, livemode: boolean, kind: string,
    work: () => Promise<unknown>,
  ) => Promise<"credited" | "already-credited">;
  provision: (client: SupabaseClient, pendingId: string, logTag: string) => Promise<ProvisionResult>;
  complete:  (client: SupabaseClient, pendingId: string, trial: ProvisionedTrial, source: "Mollie", logTag: string) => Promise<void>;
}

async function defaultDeps(): Promise<TrialSettleDeps> {
  const { creditCheckoutSessionOnce } = await import("./checkout-credit-claim");
  return { once: creditCheckoutSessionOnce, provision: provisionTrialTenant, complete: completeTrialSignup };
}

/**
 * Turn a paid verification payment into a tenant on trial, once.
 *
 * The webhook and the visitor's return both come here. The claim on the
 * payment id lets one of them do the work. Whoever comes second is told it
 * was done.
 */
export async function settleMollieTrialSignup(
  client:  SupabaseClient,
  payment: MolliePayment,
  deps?:   TrialSettleDeps,
): Promise<MollieFulfilment> {
  const plan = planMollieTrialSignup(payment);
  if (plan.action === "wait")   return { outcome: "trial-signup", state: "waiting",  status: plan.status, tenantId: null };
  if (plan.action === "none")   return { outcome: "trial-signup", state: "not-paid", status: plan.status, tenantId: null };
  if (plan.action === "refuse") {
    console.error("[mollie] trial_signup: paid but not usable", { paymentId: payment.id, reason: plan.reason });
    return { outcome: "trial-signup", state: "refused", status: plan.reason, tenantId: null };
  }

  const d        = deps ?? await defaultDeps();
  const livemode = payment.mode === "live";
  const mode     = livemode ? "live" : "test";
  let created: ProvisionedTrial | null = null;
  let failure: string | null = null;

  const outcome = await d.once(client, payment.id, pendingTenantKey(plan.pendingId), livemode, TRIAL_SIGNUP_PAYMENT_TYPE, async () => {
    const provisioned = await d.provision(client, plan.pendingId, "[mollie]");
    if (!provisioned.ok) {
      // The pending row is gone, used or marked failed. Trying again cannot
      // help, so this does not throw: the claim stands and the reason is kept.
      failure = provisioned.action;
      return;
    }
    const trial = provisioned.trial;
    created = trial;

    // The subscription, as the platform's own: no Stripe ids. `trialing`
    // puts the tenant under the trial's session limit until step 3 charges.
    const { error: subErr } = await client.from("subscriptions").upsert({
      tenant_id:            trial.tenantId,
      plan:                 trial.planId,
      status:               "trialing",
      billing_cycle:        "monthly",
      current_period_start: trial.now,
      current_period_end:   trial.trialEndsAt,
      trial_end:            trial.trialEndsAt,
    }, { onConflict: "tenant_id" });
    if (subErr) console.error("[mollie] trial_signup: subscriptions upsert failed:", subErr.message);

    // The customer and the mandate the payment gave, now under the real tenant.
    const { error: custErr } = await client.from("mollie_customers").upsert({
      tenant_id:      trial.tenantId,
      mode,
      customer_id:    plan.customerId,
      mandate_id:     plan.mandateId,
      mandate_method: plan.method,
      mandate_since:  trial.now,
      updated_at:     trial.now,
    }, { onConflict: "tenant_id,mode" });
    if (custErr) console.error("[mollie] trial_signup: mollie_customers upsert failed:", custErr.message);

    // The payment row stood on the stand-in key. It belongs to the tenant now.
    await client.from("mollie_payments").update({ tenant_id: trial.tenantId }).eq("id", payment.id);

    await d.complete(client, plan.pendingId, trial, "Mollie", "[mollie]");
    console.info(`[mollie] trial_signup: created user=${trial.userId} tenant=${trial.tenantId} plan=${trial.planId}`);
  });

  if (failure) return { outcome: "trial-signup", state: "refused", status: failure, tenantId: null };
  if (outcome === "already-credited") return { outcome: "trial-signup", state: "already", status: "paid", tenantId: null };
  return { outcome: "trial-signup", state: "created", status: "paid", tenantId: (created as ProvisionedTrial | null)?.tenantId ?? null };
}

/**
 * The visitor is back from the verification payment. Finds the payment by
 * the platform's own reference and settles it. Returns the state the success
 * page shows, or null when the reference is not a trial signup.
 */
export async function settleMollieTrialReturn(
  client: SupabaseClient,
  ref:    string,
  settle: (client: SupabaseClient, paymentId: string) => Promise<{ result: MollieFulfilment }>,
): Promise<"created" | "already" | "waiting" | "not-paid" | "refused" | null> {
  if (!UUID.test(ref)) return null;
  const { data: row } = await client
    .from("mollie_payments")
    .select("id")
    .eq("ref", ref)
    .eq("kind", TRIAL_SIGNUP_PAYMENT_TYPE)
    .maybeSingle();
  if (!row) return null;

  const { result } = await settle(client, row.id as string);
  return result.outcome === "trial-signup" ? result.state : null;
}
