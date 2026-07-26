/**
 * Unsubscribe tokens — signed (tenantId, email) tokens for one-click unsubscribe.
 *
 * A token is `base64url(payload).sig` where sig is an HMAC-SHA256 over the
 * payload, keyed by EMAIL_ENCRYPTION_KEY. It carries no secret and can't be
 * forged without the key, so the unsubscribe endpoint can trust it without a DB
 * lookup. Server-only.
 */

import "server-only";

import { createHmac } from "node:crypto";

function secret(): string {
  return process.env.EMAIL_ENCRYPTION_KEY || "mc-unsubscribe-fallback-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url").slice(0, 32);
}

/** Build an opaque unsubscribe token for a recipient of this tenant. */
export function makeUnsubscribeToken(tenantId: string, email: string): string {
  const payload = Buffer.from(
    JSON.stringify({ t: tenantId, e: email.trim().toLowerCase() }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Verify a token; returns the tenantId + email when valid, else null. */
export function verifyUnsubscribeToken(token: string): { tenantId: string; email: string } | null {
  const [payload, sig] = (token || "").split(".");
  if (!payload || !sig || sig !== sign(payload)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (parsed && typeof parsed.t === "string" && typeof parsed.e === "string") {
      return { tenantId: parsed.t, email: parsed.e };
    }
  } catch {
    /* fall through */
  }
  return null;
}
