/**
 * What a request may change on a tenant wallet.
 *
 * The two wallet settings routes used to spread the whole request body into
 * `tenant_wallets.update(...)`. A TypeScript type on the body is not a filter:
 * a caller could send `balance_cents`, `status` or `stripe_payment_method_id`
 * and it was written. These functions copy the named fields only, and check
 * each value, so nothing else can reach the row.
 *
 * Pure: no I/O, so it is testable without a database.
 */

export type WalletAutoReloadSettings = {
  auto_reload_enabled?:             boolean;
  auto_reload_trigger_cents?:       number;
  auto_reload_amount_cents?:        number;
  auto_reload_monthly_limit_cents?: number;
};

export type WalletNotificationPrefs = {
  notify_email?:                boolean;
  notify_sms?:                  boolean;
  notification_email?:          string | null;
  notification_phone?:          string | null;
  low_balance_threshold_cents?: number;
};

export type Picked<T> = { ok: true; value: T } | { ok: false; error: string };

/** One hundred thousand euros: far above any real setting, below integer trouble. */
const MAX_CENTS = 10_000_000;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function cents(v: unknown, min: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= MAX_CENTS;
}

export function pickAutoReloadSettings(body: unknown): Picked<WalletAutoReloadSettings> {
  if (!isRecord(body)) return { ok: false, error: "Invalid body" };
  const out: WalletAutoReloadSettings = {};

  if (body.auto_reload_enabled !== undefined) {
    if (typeof body.auto_reload_enabled !== "boolean") {
      return { ok: false, error: "auto_reload_enabled must be true or false" };
    }
    out.auto_reload_enabled = body.auto_reload_enabled;
  }
  if (body.auto_reload_trigger_cents !== undefined) {
    if (!cents(body.auto_reload_trigger_cents, 0)) {
      return { ok: false, error: "auto_reload_trigger_cents must be a whole number ≥ 0" };
    }
    out.auto_reload_trigger_cents = body.auto_reload_trigger_cents;
  }
  if (body.auto_reload_amount_cents !== undefined) {
    if (!cents(body.auto_reload_amount_cents, 100)) {
      return { ok: false, error: "auto_reload_amount_cents must be a whole number ≥ 100 (€1.00 minimum)" };
    }
    out.auto_reload_amount_cents = body.auto_reload_amount_cents;
  }
  if (body.auto_reload_monthly_limit_cents !== undefined) {
    if (!cents(body.auto_reload_monthly_limit_cents, 0)) {
      return { ok: false, error: "auto_reload_monthly_limit_cents must be a whole number ≥ 0" };
    }
    out.auto_reload_monthly_limit_cents = body.auto_reload_monthly_limit_cents;
  }
  if (
    out.auto_reload_monthly_limit_cents !== undefined &&
    out.auto_reload_amount_cents !== undefined &&
    out.auto_reload_monthly_limit_cents < out.auto_reload_amount_cents
  ) {
    return { ok: false, error: "auto_reload_monthly_limit_cents must be ≥ auto_reload_amount_cents" };
  }

  if (Object.keys(out).length === 0) return { ok: false, error: "No settings to save" };
  return { ok: true, value: out };
}

function optionalText(v: unknown, max: number): v is string | null {
  return v === null || (typeof v === "string" && v.length <= max);
}

export function pickNotificationPrefs(body: unknown): Picked<WalletNotificationPrefs> {
  if (!isRecord(body)) return { ok: false, error: "Invalid body" };
  const out: WalletNotificationPrefs = {};

  if (body.notify_email !== undefined) {
    if (typeof body.notify_email !== "boolean") return { ok: false, error: "notify_email must be true or false" };
    out.notify_email = body.notify_email;
  }
  if (body.notify_sms !== undefined) {
    if (typeof body.notify_sms !== "boolean") return { ok: false, error: "notify_sms must be true or false" };
    out.notify_sms = body.notify_sms;
  }
  if (body.notification_email !== undefined) {
    const v = body.notification_email;
    if (!optionalText(v, 254) || (typeof v === "string" && v !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))) {
      return { ok: false, error: "notification_email is not a valid email address" };
    }
    out.notification_email = v === "" ? null : v;
  }
  if (body.notification_phone !== undefined) {
    const v = body.notification_phone;
    if (!optionalText(v, 32) || (typeof v === "string" && v !== "" && !/^[+0-9 ()-]+$/.test(v))) {
      return { ok: false, error: "notification_phone is not a valid phone number" };
    }
    out.notification_phone = v === "" ? null : v;
  }
  if (body.low_balance_threshold_cents !== undefined) {
    if (!cents(body.low_balance_threshold_cents, 0)) {
      return { ok: false, error: "low_balance_threshold_cents must be a whole number ≥ 0" };
    }
    out.low_balance_threshold_cents = body.low_balance_threshold_cents;
  }

  if (Object.keys(out).length === 0) return { ok: false, error: "No preferences to save" };
  return { ok: true, value: out };
}
