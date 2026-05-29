/**
 * lib/admin-auth — barrel export
 *
 * ── Modules ──────────────────────────────────────────────────────────────────
 *
 *   session.ts       — JWT creation + verification (Edge-compatible)
 *   password.ts      — bcrypt hashing (Node.js only)
 *   totp.ts          — TOTP generation + QR code (Node.js only)
 *   backup-codes.ts  — one-time backup code helpers (Node.js only)
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *
 *   import { signSession, verifySession } from "@/lib/admin-auth";
 *   import { hashPassword, verifyPassword } from "@/lib/admin-auth";
 */

// Session (Edge + Node.js safe)
export {
  ADMIN_TOKEN_COOKIE,
  SESSION_MAX_AGE,
  PRE_2FA_MAX_AGE,
  signSession,
  verifySession,
  sessionCookieOptions,
} from "./session";
export type { AdminSession } from "./session";

// Password (Node.js only)
export { hashPassword, verifyPassword, validatePasswordStrength } from "./password";

// TOTP (Node.js only)
export {
  generateTotpSecret,
  generateTotpUri,
  generateQrCodeDataUrl,
  verifyTotpCode,
} from "./totp";

// Backup codes (Node.js only)
export {
  generateBackupCodes,
  hashBackupCodes,
  hashBackupCode,
  consumeBackupCode,
} from "./backup-codes";
