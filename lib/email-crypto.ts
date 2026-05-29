/**
 * Email Transport Secret Encryption
 *
 * AES-256-GCM at-rest encryption for SMTP passwords and Resend API keys
 * stored in the `tenant_email_transport` table.
 *
 * ─── Key setup ────────────────────────────────────────────────────────────────
 *
 *   Set EMAIL_ENCRYPTION_KEY to a 64-character hex string (32 bytes).
 *   Generate one with:
 *
 *     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 *   When the env var is absent, secrets are stored with a "plain:" prefix and
 *   a startup warning is emitted.  The admin UI remains fully functional — only
 *   at-rest encryption is skipped.  Set the key to enable encryption without
 *   any other code changes.
 *
 * ─── Ciphertext format ───────────────────────────────────────────────────────
 *
 *   Encrypted:    "enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 *   Unencrypted:  "plain:<plaintext>"
 *   Legacy:        any other string — treated as plaintext (backward compat)
 *
 *   The IV is 12 random bytes (GCM-recommended), the auth tag is 16 bytes.
 *   Ciphertext length equals plaintext length.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   // In the admin save action (before writing to DB):
 *   config.resendApiKey = encryptSecret(incomingApiKey);
 *
 *   // In the loader (after reading from DB):
 *   const apiKey = decryptSecret(row.config.resendApiKey);
 */

import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ── Constants ──────────────────────────────────────────────────────────────────

const ENC_PREFIX   = "enc:v1:";
const PLAIN_PREFIX = "plain:";
const ALGORITHM    = "aes-256-gcm" as const;
const IV_BYTES     = 12; // 96-bit IV recommended for GCM

// ── Key loading ────────────────────────────────────────────────────────────────

let _warnedOnce = false;

function loadKey(): Buffer | null {
  const raw = process.env.EMAIL_ENCRYPTION_KEY;
  if (!raw) {
    if (!_warnedOnce && process.env.NODE_ENV !== "test") {
      _warnedOnce = true;
      console.warn(
        "[email-crypto] EMAIL_ENCRYPTION_KEY is not set. " +
        "Email transport secrets are stored unencrypted in the database. " +
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
      `EMAIL_ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64). Got ${buf.length} bytes.`,
    );
  }
  return buf;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Encrypts a plaintext secret for storage in the tenant_email_transport table.
 *
 * Returns an "enc:v1:..." ciphertext when EMAIL_ENCRYPTION_KEY is set,
 * or a "plain:..." prefixed value when the key is absent.
 */
export function encryptSecret(plaintext: string): string {
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
 * Decrypts a value previously produced by encryptSecret().
 *
 * Handles all three storage formats:
 *   - "enc:v1:..." — AES-256-GCM decryption
 *   - "plain:..."  — strips the prefix, returns as-is
 *   - anything else — returned as-is (legacy backward compat)
 */
export function decryptSecret(stored: string): string {
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
      "Cannot decrypt email secret: EMAIL_ENCRYPTION_KEY is not set. " +
      "Set the same key used when the secret was encrypted.",
    );
  }

  const payload = stored.slice(ENC_PREFIX.length);
  const parts   = payload.split(":");
  if (parts.length !== 3) {
    throw new Error(
      "Malformed encrypted secret — expected iv:authTag:ciphertext format.",
    );
  }

  const [ivHex, authTagHex, ciphertextHex] = parts as [string, string, string];
  const iv         = Buffer.from(ivHex, "hex");
  const authTag    = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * Returns true when `stored` looks like a non-empty secret value
 * (encrypted, plain-prefixed, or legacy unformatted).
 *
 * Used by admin actions to return a `hasXxx: boolean` to the client
 * without exposing the actual secret value.
 */
export function hasStoredSecret(stored: string | undefined | null): boolean {
  if (!stored) return false;
  if (stored.startsWith(ENC_PREFIX))   return true;
  if (stored.startsWith(PLAIN_PREFIX)) return stored.length > PLAIN_PREFIX.length;
  return stored.length > 0;
}
