/**
 * Backup code generation and verification for admin 2FA recovery.
 *
 * Backup codes are one-time-use codes that let an admin log in when they
 * don't have access to their authenticator app.
 *
 * ─── Format ───────────────────────────────────────────────────────────────────
 *
 *   10 codes per generation, each formatted as two groups of 5 hex chars:
 *   e.g.  "a1b2c-3d4e5"
 *
 *   Codes are shown once (at generation or setup time) and then hashed with
 *   SHA-256 before being stored in `admin_users.two_factor_backup_codes`.
 *   Each code is removed from the array when it is successfully used.
 *
 * Node.js only — never import in middleware or Client Components.
 */
import "server-only";

import { createHash, randomBytes } from "crypto";

const CODE_COUNT  = 10;
const PART_BYTES  = 5; // 5 bytes → 10 hex chars per part → "xxxxx-xxxxx" (11 chars)

// ── Generation ────────────────────────────────────────────────────────────────

/**
 * Generates an array of 10 plaintext backup codes.
 * Call `hashBackupCodes()` on the result before persisting.
 */
export function generateBackupCodes(): string[] {
  return Array.from({ length: CODE_COUNT }, () => {
    const a = randomBytes(PART_BYTES).toString("hex");
    const b = randomBytes(PART_BYTES).toString("hex");
    return `${a}-${b}`;
  });
}

// ── Hashing ───────────────────────────────────────────────────────────────────

/** Produces the SHA-256 hex digest of a single normalised backup code. */
export function hashBackupCode(code: string): string {
  return createHash("sha256")
    .update(code.toLowerCase().replace(/\s/g, ""))
    .digest("hex");
}

/** Hashes an array of plaintext codes for storage. */
export function hashBackupCodes(codes: string[]): string[] {
  return codes.map(hashBackupCode);
}

// ── Verification + consumption ────────────────────────────────────────────────

/**
 * Checks whether `inputCode` matches any entry in `hashedCodes`.
 * If it does, returns the updated hashed-codes array with the used code removed.
 * If it doesn't, returns null.
 *
 * The caller is responsible for persisting the returned array to the database
 * to prevent the same code being reused.
 */
export function consumeBackupCode(
  inputCode: string,
  hashedCodes: string[],
): string[] | null {
  const inputHash = hashBackupCode(inputCode);
  const idx = hashedCodes.indexOf(inputHash);
  if (idx === -1) return null;

  const updated = [...hashedCodes];
  updated.splice(idx, 1);
  return updated;
}
