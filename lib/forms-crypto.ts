/**
 * Form Submission Payload Encryption
 *
 * AES-256-GCM at-rest encryption for form submission payloads (personal data:
 * emails, contact messages, etc.) stored in the `form_submissions` table, plus a
 * deterministic keyed email hash for lookup without decrypting rows.
 *
 * This mirrors lib/email-crypto.ts (same enc:v1 format and plain: fallback) but
 * uses its own key so form data and email transport secrets rotate independently.
 *
 * ─── Key setup ────────────────────────────────────────────────────────────────
 *
 *   Set FORMS_ENCRYPTION_KEY to a 64-character hex string (32 bytes). Generate:
 *
 *     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 *   When the env var is absent, payloads are stored with a "plain:" prefix and a
 *   startup warning is emitted. The app stays fully functional; only at-rest
 *   encryption is skipped (so dev works without a key).
 *
 * ─── Ciphertext format ───────────────────────────────────────────────────────
 *
 *   Encrypted:    "enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 *   Unencrypted:  "plain:<plaintext>"
 *   Legacy:        any other string is treated as plaintext (backward compat)
 *
 * ─── Email hash ──────────────────────────────────────────────────────────────
 *
 *   emailHash(value) returns a hex digest used to look a submission up by email
 *   without decrypting payloads. When a key is set it is HMAC-SHA256 under a
 *   sub-key derived from FORMS_ENCRYPTION_KEY (domain-separated from the
 *   encryption key), so the hash is unforgeable. When no key is set it falls back
 *   to an unkeyed SHA-256 so dev lookups still work. The value is normalised
 *   (trim + lowercase) before hashing, so lookups are case/whitespace-insensitive.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   // Write (repository, before insert):
 *   payload_enc = encryptPayload(JSON.stringify(values));
 *   email_hash  = email ? emailHash(email) : null;
 *
 *   // Read (repository mapRow, after select):
 *   values = JSON.parse(decryptPayload(row.payload_enc));
 *
 *   // Lookup by email:
 *   query.eq("email_hash", emailHash(searchTerm));
 */

import "server-only";

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "crypto";

// ── Constants ──────────────────────────────────────────────────────────────────

const ENC_PREFIX     = "enc:v1:";
const PLAIN_PREFIX    = "plain:";
const ALGORITHM       = "aes-256-gcm" as const;
const IV_BYTES        = 12; // 96-bit IV recommended for GCM
// Info string that domain-separates the email-hash sub-key from the encryption
// key. Never change it, or existing email_hash values stop matching.
const EMAIL_HASH_INFO = "forms-email-hash-v1";

// ── Key loading ────────────────────────────────────────────────────────────────

let _warnedOnce = false;

function loadKey(): Buffer | null {
  const raw = process.env.FORMS_ENCRYPTION_KEY;
  if (!raw) {
    if (!_warnedOnce && process.env.NODE_ENV !== "test") {
      _warnedOnce = true;
      console.warn(
        "[forms-crypto] FORMS_ENCRYPTION_KEY is not set. " +
        "Form submission payloads are stored unencrypted in the database. " +
        'Generate a key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      );
    }
    return null;
  }

  // Accept hex (64 chars for 32 bytes) or base64 (44 chars with padding).
  const buf = raw.length === 64
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");

  if (buf.length !== 32) {
    throw new Error(
      `FORMS_ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64). Got ${buf.length} bytes.`,
    );
  }
  return buf;
}

// ── Payload encryption ───────────────────────────────────────────────────────

/**
 * Encrypts a plaintext payload string for storage in form_submissions.payload_enc.
 * Returns an "enc:v1:..." ciphertext when FORMS_ENCRYPTION_KEY is set, or a
 * "plain:..." prefixed value when the key is absent.
 */
export function encryptPayload(plaintext: string): string {
  const key = loadKey();

  if (!key) {
    return `${PLAIN_PREFIX}${plaintext}`;
  }

  const iv        = randomBytes(IV_BYTES);
  const cipher    = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag   = cipher.getAuthTag();

  return (
    ENC_PREFIX +
    iv.toString("hex") + ":" +
    authTag.toString("hex") + ":" +
    encrypted.toString("hex")
  );
}

/**
 * Decrypts a value previously produced by encryptPayload().
 *
 * Handles all three storage formats:
 *   - "enc:v1:..." — AES-256-GCM decryption
 *   - "plain:..."  — strips the prefix, returns as-is
 *   - anything else — returned as-is (legacy backward compat)
 */
export function decryptPayload(stored: string): string {
  if (stored.startsWith(PLAIN_PREFIX)) {
    return stored.slice(PLAIN_PREFIX.length);
  }

  if (!stored.startsWith(ENC_PREFIX)) {
    // Legacy unformatted value — return as-is for backward compatibility.
    return stored;
  }

  const key = loadKey();
  if (!key) {
    throw new Error(
      "Cannot decrypt form payload: FORMS_ENCRYPTION_KEY is not set. " +
      "Set the same key used when the payload was encrypted.",
    );
  }

  const payload = stored.slice(ENC_PREFIX.length);
  const parts   = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted payload — expected iv:authTag:ciphertext format.");
  }

  const [ivHex, authTagHex, ciphertextHex] = parts as [string, string, string];
  const iv         = Buffer.from(ivHex, "hex");
  const authTag    = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

// ── Email hash (deterministic lookup) ────────────────────────────────────────

/** Normalise an email/value for hashing: trim + lowercase. */
function normalizeForHash(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Deterministic hex digest of an email for lookup by email without decrypting.
 *
 * Keyed HMAC-SHA256 under a sub-key derived from FORMS_ENCRYPTION_KEY when the
 * key is set; unkeyed SHA-256 fallback when it is absent (so dev lookups work).
 * The same value always yields the same digest within a given key mode, which is
 * all that lookup needs.
 */
export function emailHash(value: string): string {
  const normalized = normalizeForHash(value);
  const key = loadKey();

  if (!key) {
    return createHash("sha256").update(normalized, "utf8").digest("hex");
  }

  const subKey = createHmac("sha256", key).update(EMAIL_HASH_INFO, "utf8").digest();
  return createHmac("sha256", subKey).update(normalized, "utf8").digest("hex");
}
