/**
 * Deterministic keyed hash of a visitor IP, for use as the ip_company_cache key.
 *
 * The platform-wide IP→company cache (ip_company_cache) must not store raw IP
 * addresses: an IP is personal data. We only ever need to look a company up by
 * IP, never to recover the IP from a row, so the table is keyed by a one-way
 * digest of the IP instead of the raw value. Company firmographics stay
 * plaintext — only the *key* is hashed.
 *
 * This mirrors `emailHash` in lib/forms-crypto.ts (same domain-separated
 * HMAC-SHA256 construction), but under its own dedicated key so the IP key and
 * form-encryption secrets rotate independently.
 *
 * ─── Key setup ────────────────────────────────────────────────────────────────
 *
 *   Set IP_HASH_KEY to a 64-character hex string (32 bytes). Generate:
 *
 *     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 *   When the env var is absent the hash falls back to an unkeyed SHA-256 so dev
 *   works without a key (a one-time warning is emitted). Cache correctness does
 *   not depend on the key: the same IP always yields the same digest within a
 *   given key mode, which is all a lookup needs. The key only makes the digest
 *   unforgeable (an attacker cannot confirm "is IP X in the cache?" without it).
 *
 *   IMPORTANT: changing IP_HASH_KEY (or moving between keyed and unkeyed mode)
 *   changes every digest, so existing cache rows stop matching. That is safe —
 *   they simply read as misses and get re-queried and overwritten within the
 *   normal freshness window — but it means a paid Leadinfo re-lookup for warm
 *   IPs until the cache refills.
 */

import "server-only";

import { createHash, createHmac } from "crypto";

/**
 * Info string that domain-separates the IP-hash sub-key from the raw IP_HASH_KEY.
 * Never change it, or existing ip_hash values stop matching.
 */
const IP_HASH_INFO = "ip-company-cache-hash-v1";

const HEX_KEY_RE = /^[0-9a-fA-F]{64}$/;

let warned = false;

/** Load and validate IP_HASH_KEY (32-byte hex). Returns null when unset/invalid. */
function loadKey(): Buffer | null {
  const raw = process.env.IP_HASH_KEY;
  if (!raw) {
    if (!warned) {
      warned = true;
      console.warn(
        "[ip-hash] IP_HASH_KEY is not set — falling back to unkeyed SHA-256 for " +
        "the ip_company_cache key. Set a 64-char hex key in production so the IP " +
        "digest is unforgeable.",
      );
    }
    return null;
  }
  if (!HEX_KEY_RE.test(raw)) {
    if (!warned) {
      warned = true;
      console.warn(
        "[ip-hash] IP_HASH_KEY is set but is not a 64-character hex string — " +
        "ignoring it and falling back to unkeyed SHA-256.",
      );
    }
    return null;
  }
  return Buffer.from(raw, "hex");
}

/** Normalise an IP for hashing: trim (IPs are already canonical from the request). */
function normalizeIp(ip: string): string {
  return ip.trim();
}

/**
 * One-way hex digest of a visitor IP, used as the ip_company_cache key.
 *
 * Keyed HMAC-SHA256 under a sub-key derived from IP_HASH_KEY when the key is set;
 * unkeyed SHA-256 fallback when it is absent (so dev lookups work).
 */
export function ipHash(ip: string): string {
  const normalized = normalizeIp(ip);
  const key = loadKey();

  if (!key) {
    return createHash("sha256").update(normalized, "utf8").digest("hex");
  }

  const subKey = createHmac("sha256", key).update(IP_HASH_INFO, "utf8").digest();
  return createHmac("sha256", subKey).update(normalized, "utf8").digest("hex");
}
