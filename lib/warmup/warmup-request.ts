/**
 * Warm-up requests
 *
 * The keep-warm endpoint (/api/cron/keep-warm) requests the homepage every few
 * minutes so a visitor never meets a function that has to start. Such a
 * request must cost nothing: no counted session, no AI call, no enrichment
 * credit.
 *
 * It says what it is with a header. The value is derived from CRON_SECRET, so
 * only the platform itself can make one: a plain "1" would let anyone in front
 * of a tenant's site switch off the session count for every visitor.
 */

import { createHash, timingSafeEqual } from "node:crypto";

export const WARMUP_HEADER = "x-mc-warmup";

/** The header value a warm-up request carries, or null without a secret. */
export function warmupToken(secret: string | undefined = process.env["CRON_SECRET"]): string | null {
  if (!secret) return null;
  return createHash("sha256").update(`mc-warmup:${secret}`).digest("hex");
}

/**
 * True when the header value proves the request is a warm-up.
 *
 * Without a secret nothing can be proven. Production then treats every request
 * as a visitor. Development accepts "1", so the path can be tried locally.
 */
export function isWarmupHeader(
  value:      string | null | undefined,
  secret:     string | undefined = process.env["CRON_SECRET"],
  production: boolean = process.env["NODE_ENV"] === "production",
): boolean {
  if (!value) return false;
  const token = warmupToken(secret);
  if (!token) return !production && value === "1";
  const given    = Buffer.from(value);
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
