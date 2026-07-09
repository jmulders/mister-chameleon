/**
 * Ad-platform audience sync — PII hashing.
 *
 * Google Ads Customer Match, Meta Custom Audiences and LinkedIn Matched
 * Audiences all match on the SHA-256 hash of a *normalized* identifier. The
 * normalization rules are near-identical across platforms; we apply the strict
 * Google/Meta rules (lowercase, trim, strip Gmail dots) so one hash matches
 * everywhere.
 *
 * Raw identifiers are hashed here and never persisted or logged. See
 * docs/lead-base-design.md.
 */

import "server-only";

import { createHash } from "node:crypto";

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Normalize an email the way the ad platforms require, then SHA-256 it.
 *   - trim + lowercase
 *   - for gmail.com / googlemail.com: strip dots and any "+tag" in the local part
 * Returns null for anything that isn't a plausible address.
 */
export function hashEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let email = raw.trim().toLowerCase();
  const at = email.indexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  let local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.replace(/\./g, "");
    const plus = local.indexOf("+");
    if (plus >= 0) local = local.slice(0, plus);
  }
  email = `${local}@${domain}`;
  return sha256Hex(email);
}

/**
 * Normalize a phone to E.164-ish (leading +, digits only) then SHA-256 it.
 * `defaultCountryCode` (e.g. "31") is prepended when the number has no country
 * code and starts with a national trunk 0. Returns null when unusable.
 */
export function hashPhone(
  raw: string | null | undefined,
  defaultCountryCode?: string | null,
): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("+")) {
    digits = `+${digits.slice(1).replace(/\D/g, "")}`;
  } else {
    let national = digits.replace(/\D/g, "");
    const cc = (defaultCountryCode ?? "").replace(/\D/g, "");
    if (cc) {
      national = national.replace(/^0+/, "");
      digits = `+${cc}${national}`;
    } else {
      digits = `+${national}`;
    }
  }
  if (digits.replace(/\D/g, "").length < 7) return null;
  return sha256Hex(digits);
}

/** Lowercase + trim + strip non-letters, then SHA-256. For first/last name. */
export function hashName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase().replace(/[^a-zÀ-ɏ]/g, "");
  if (!cleaned) return null;
  return sha256Hex(cleaned);
}

/** Lowercase ISO country code, hashed (Meta accepts a hashed 2-letter country). */
export function hashCountry(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cc = raw.trim().toLowerCase();
  if (cc.length !== 2) return null;
  return sha256Hex(cc);
}
