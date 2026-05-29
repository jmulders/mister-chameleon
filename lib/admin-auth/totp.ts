/**
 * TOTP (Time-based One-Time Password) helpers for admin 2FA.
 *
 * Uses otplib's authenticator (RFC 6238, TOTP), compatible with:
 *   Google Authenticator, 1Password, Authy, Microsoft Authenticator, etc.
 *
 * Node.js only — never import in middleware or Client Components.
 */
import "server-only";

import { authenticator } from "otplib";
import QRCode from "qrcode";

// Allow ±1 time step (30 s) of clock drift between server and authenticator app.
authenticator.options = { window: 1 };

const DEFAULT_ISSUER = "Mister Chameleon Admin";

function getIssuer(): string {
  return process.env.ADMIN_TOTP_ISSUER?.trim() || DEFAULT_ISSUER;
}

// ── Secret ────────────────────────────────────────────────────────────────────

/**
 * Generates a new random TOTP shared secret (base-32, 160-bit).
 * Store server-side only — never send to the client as plaintext.
 */
export function generateTotpSecret(): string {
  return authenticator.generateSecret(20); // 20 bytes = 160-bit
}

// ── Provisioning URI ──────────────────────────────────────────────────────────

/**
 * Returns the `otpauth://totp/...` provisioning URI for the given secret.
 * This URI is encoded into the QR code shown during setup.
 *
 * @param email   Account email — shown as the account label in the authenticator app.
 * @param secret  The base-32 TOTP shared secret.
 */
export function generateTotpUri(email: string, secret: string): string {
  return authenticator.keyuri(email, getIssuer(), secret);
}

// ── QR code ───────────────────────────────────────────────────────────────────

/**
 * Renders a TOTP provisioning URI into a base-64 PNG data URL suitable for
 * embedding directly in an `<img src="...">` element.
 *
 * Runs entirely on the server — the data URL is safe to include in a Server
 * Component response (no sensitive data travels back as a separate API call).
 */
export async function generateQrCodeDataUrl(uri: string): Promise<string> {
  return QRCode.toDataURL(uri, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 240,
    color: {
      dark:  "#171717", // neutral-900
      light: "#ffffff",
    },
  });
}

// ── Verification ──────────────────────────────────────────────────────────────

/**
 * Verifies a 6-digit TOTP code against a shared secret.
 * Strips spaces so codes copied with a space in the middle still work.
 *
 * @returns true when the code is valid for the current (or adjacent) time window.
 */
export function verifyTotpCode(code: string, secret: string): boolean {
  try {
    return authenticator.verify({ token: code.replace(/\s/g, ""), secret });
  } catch {
    return false;
  }
}
