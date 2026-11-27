/**
 * A thin client for the Mollie Payments API (v2).
 *
 * Three calls: create a payment, read one back, and create a customer. They
 * go over fetch, so there is no extra dependency, and all take their fetch
 * and key as arguments so the tests run without a network.
 *
 * A payment comes in three kinds (`sequenceType`):
 *
 *   oneoff     the default: the customer pays once, nothing is kept.
 *   first      the customer pays once and thereby authorises later charges.
 *              Mollie keeps that authorisation as a mandate on the customer.
 *   recurring  the platform charges an existing mandate. The customer is not
 *              there, so there is no checkout and no return address.
 *
 * How Mollie differs from Stripe, as far as this file is concerned:
 *
 *   - There is no price catalogue. The platform sends the amount, as a
 *     string with two decimals ("29.00").
 *   - Test or live is decided by the key: test_… or live_….
 *   - The webhook carries only a payment id. The handler reads the payment
 *     back with the key, and that answer is the truth. Nothing in the
 *     webhook body is trusted, so it needs no signature.
 *
 * The key is never logged and never part of an error message.
 */

export const MOLLIE_API_BASE = "https://api.mollie.com/v2";

export type MollieMode = "test" | "live";

/** Every status a payment can have. Only "paid" is money received. */
export type MolliePaymentStatus =
  | "open" | "pending" | "authorized" | "paid" | "canceled" | "expired" | "failed";

export interface MollieAmount {
  currency: string;
  value:    string;
}

export type MollieSequenceType = "oneoff" | "first" | "recurring";

export interface MolliePayment {
  id:                 string;
  status:             MolliePaymentStatus | string;
  mode?:              MollieMode | string;
  amount:             MollieAmount;
  /** The Mollie customer the payment belongs to (first and recurring payments). */
  customerId?:        string | null;
  /** The mandate a paid first payment created, or the one a recurring payment charged. */
  mandateId?:         string | null;
  sequenceType?:      MollieSequenceType | string;
  /** The method the customer chose: "ideal", "creditcard", "directdebit", … */
  method?:            string | null;
  amountRefunded?:    MollieAmount;
  amountChargedBack?: MollieAmount;
  metadata?:          Record<string, unknown> | null;
  _links?:            { checkout?: { href?: string } };
}

export class MollieError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name   = "MollieError";
    this.status = status;
  }
}

/** The mode a key belongs to, or null when it is not a Mollie key. */
export function mollieModeFromKey(key: string | null | undefined): MollieMode | null {
  if (typeof key !== "string") return null;
  const k = key.trim();
  if (k.startsWith("test_") && k.length > 10) return "test";
  if (k.startsWith("live_") && k.length > 10) return "live";
  return null;
}

/** The configured key, or null. Read on every call so a new key needs no rebuild. */
export function getMollieApiKey(): string | null {
  const key = process.env["MOLLIE_API_KEY"]?.trim();
  return key && mollieModeFromKey(key) ? key : null;
}

export function mollieConfigured(): boolean {
  return getMollieApiKey() !== null;
}

/**
 * Cents to Mollie's amount string. Mollie refuses "29" and "29.0": the value
 * must have exactly two decimals for EUR.
 */
export function mollieAmountValue(cents: number): string {
  if (!Number.isInteger(cents) || cents <= 0) {
    throw new Error(`Mollie amount must be a positive whole number of cents (got ${cents})`);
  }
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/** A Mollie amount back to cents. Null for anything that is not a clean EUR amount. */
export function centsFromMollieAmount(amount: MollieAmount | null | undefined): number | null {
  if (!amount || amount.currency !== "EUR" || typeof amount.value !== "string") return null;
  if (!/^\d{1,9}\.\d{2}$/.test(amount.value)) return null;
  const [euros, cents] = amount.value.split(".");
  return Number(euros) * 100 + Number(cents);
}

/** A payment id as Mollie writes it. Checked before it goes into a URL. */
export function isMolliePaymentId(id: unknown): id is string {
  return typeof id === "string" && /^tr_[A-Za-z0-9]{4,60}$/.test(id);
}

export function isMollieCustomerId(id: unknown): id is string {
  return typeof id === "string" && /^cst_[A-Za-z0-9]{4,60}$/.test(id);
}

export function isMollieMandateId(id: unknown): id is string {
  return typeof id === "string" && /^mdt_[A-Za-z0-9]{4,60}$/.test(id);
}

/**
 * The webhook address for a site, or undefined when Mollie could not reach it.
 *
 * Mollie refuses a payment whose webhook is not publicly reachable, so on
 * localhost the payment is created without one. The return page confirms the
 * payment there, which is enough for local work.
 */
export function mollieWebhookUrl(baseUrl: string | null | undefined): string | undefined {
  if (!baseUrl) return undefined;
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:") return undefined;
  const host = url.hostname;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".test") || /^[\d.]+$/.test(host) || host.includes(":")) {
    return undefined;
  }
  return `${url.origin}/api/webhooks/mollie`;
}

export interface MollieDeps {
  fetch?:   typeof fetch;
  apiKey?:  string | null;
  apiBase?: string;
}

/**
 * The API address. A stand-in address can be set for local trials, never in
 * production: there the real address is the only one.
 */
function resolveApiBase(deps?: MollieDeps): string {
  if (deps?.apiBase) return deps.apiBase;
  const override = process.env["MOLLIE_API_BASE"]?.trim();
  if (override && process.env.NODE_ENV !== "production") return override.replace(/\/+$/, "");
  return MOLLIE_API_BASE;
}

async function mollieRequest<T extends { id: string } = MolliePayment>(
  method: "GET" | "POST",
  path:   string,
  body:   unknown,
  deps:   MollieDeps | undefined,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const apiKey = deps?.apiKey ?? getMollieApiKey();
  if (!apiKey) throw new MollieError(0, "Mollie is not configured. Set MOLLIE_API_KEY.");
  const doFetch = deps?.fetch ?? fetch;

  let res: Response;
  try {
    res = await doFetch(`${resolveApiBase(deps)}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept:        "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...extraHeaders,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (err) {
    throw new MollieError(0, `Mollie could not be reached: ${err instanceof Error ? err.message : String(err)}`);
  }

  let json: unknown = null;
  try {
    json = await res.json();
  } catch { /* an empty or non-JSON body is handled below */ }

  if (!res.ok) {
    const detail = (json as { detail?: unknown; title?: unknown } | null);
    const text   = typeof detail?.detail === "string" ? detail.detail
                 : typeof detail?.title  === "string" ? detail.title
                 : "request failed";
    throw new MollieError(res.status, `Mollie ${res.status}: ${text}`);
  }
  if (!json || typeof json !== "object" || typeof (json as { id?: unknown }).id !== "string") {
    throw new MollieError(res.status, "Mollie answered without an object id");
  }
  return json as T;
}

export interface CreateMolliePaymentInput {
  amountCents: number;
  /** Shown to the customer on the bank statement and the checkout page. */
  description: string;
  /**
   * Where the customer lands after paying, cancelling or giving up. Required
   * unless the payment is recurring: nobody is there to send anywhere.
   */
  redirectUrl?: string;
  /**
   * "first" makes this payment also an authorisation for later charges,
   * "recurring" charges such an authorisation. Both need the customer.
   */
  sequenceType?: MollieSequenceType;
  customerId?:   string;
  /** For a recurring payment: the mandate to charge. Mollie picks one when left out. */
  mandateId?:    string;
  /** Left out when Mollie could not reach the site (localhost). */
  webhookUrl?: string;
  metadata:    Record<string, string>;
  /**
   * The same key on a retried request returns the first payment instead of
   * creating a second one.
   */
  idempotencyKey?: string;
}

export async function createMolliePayment(
  input: CreateMolliePaymentInput,
  deps?: MollieDeps,
): Promise<MolliePayment> {
  const sequenceType = input.sequenceType ?? "oneoff";
  if (sequenceType !== "oneoff" && !isMollieCustomerId(input.customerId)) {
    throw new MollieError(400, `A ${sequenceType} payment needs a Mollie customer`);
  }
  if (sequenceType !== "recurring" && !input.redirectUrl) {
    throw new MollieError(400, "A payment the customer makes needs a return address");
  }
  if (input.mandateId !== undefined && !isMollieMandateId(input.mandateId)) {
    throw new MollieError(400, "Not a Mollie mandate id");
  }
  return mollieRequest(
    "POST",
    "/payments",
    {
      amount:      { currency: "EUR", value: mollieAmountValue(input.amountCents) },
      description: input.description.slice(0, 255),
      ...(input.redirectUrl ? { redirectUrl: input.redirectUrl } : {}),
      ...(input.webhookUrl ? { webhookUrl: input.webhookUrl } : {}),
      metadata:    input.metadata,
      // Left out for a plain payment, so step 1's request is unchanged.
      ...(sequenceType !== "oneoff" ? { sequenceType, customerId: input.customerId } : {}),
      ...(sequenceType === "recurring" && input.mandateId ? { mandateId: input.mandateId } : {}),
    },
    deps,
    input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {},
  );
}

export async function getMolliePayment(id: string, deps?: MollieDeps): Promise<MolliePayment> {
  if (!isMolliePaymentId(id)) throw new MollieError(400, "Not a Mollie payment id");
  return mollieRequest("GET", `/payments/${id}`, undefined, deps);
}

export interface MollieCustomer {
  id:    string;
  mode?: MollieMode | string;
}

/**
 * Create a customer at Mollie: the object a mandate hangs on. Name and email
 * are what the tenant sees on their bank statement and in Mollie's mails.
 */
export async function createMollieCustomer(
  input: { name?: string | null; email?: string | null; metadata?: Record<string, string> },
  deps?: MollieDeps,
): Promise<MollieCustomer> {
  const customer = await mollieRequest<MollieCustomer>(
    "POST",
    "/customers",
    {
      ...(input.name  ? { name:  input.name.slice(0, 255) } : {}),
      ...(input.email ? { email: input.email } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    },
    deps,
  );
  if (!isMollieCustomerId(customer.id)) throw new MollieError(502, "Mollie answered without a customer");
  return customer;
}
