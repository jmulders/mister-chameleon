/**
 * Admin Session — JWT creation and verification
 *
 * Intentionally has NO "server-only" guard because this module is imported by
 * both Next.js middleware (Edge runtime) and server-side code (Node.js runtime).
 * jose is Edge-compatible — it uses the Web Crypto API internally.
 *
 * NEVER import this in Client Components. The absence of "server-only" is a
 * deliberate trade-off for Edge compatibility, not an oversight.
 *
 * ─── Token design ─────────────────────────────────────────────────────────────
 *
 *   One cookie: mc_admin_token
 *
 *   The same cookie is used for two states, distinguished by `twoFaVerified`:
 *
 *     • Pre-2FA  (twoFaEnabled: true, twoFaVerified: false)
 *       — Issued immediately after correct password when 2FA is on.
 *       — Expires in 10 minutes so the user must complete the challenge quickly.
 *       — Middleware redirects any protected page to /admin/login/2fa.
 *
 *     • Full session (twoFaVerified: true, or twoFaEnabled: false)
 *       — Issued after 2FA verification (or when user has no 2FA).
 *       — Expires in 8 hours.
 *       — Grants access to all /admin routes.
 *
 * ─── Secret ───────────────────────────────────────────────────────────────────
 *
 *   ADMIN_SESSION_SECRET must be ≥ 32 characters.
 *   Generate with: openssl rand -hex 32
 */

import { SignJWT, jwtVerify } from "jose";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Cookie name written to the browser. */
export const ADMIN_TOKEN_COOKIE = "mc_admin_token";

/** Full authenticated session lifetime in seconds (8 hours). */
export const SESSION_MAX_AGE = 60 * 60 * 8;

/** Pre-2FA pending session lifetime in seconds (10 minutes). */
export const PRE_2FA_MAX_AGE = 60 * 10;

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Payload baked into the JWT. Also the shape returned by verifySession().
 */
export interface AdminSession {
  /** Admin user UUID — maps to admin_users.id. */
  sub:           string;
  email:         string;
  name:          string;
  /** "superadmin" | "tenant_admin" (legacy: "admin") */
  role:          string;
  /** True when the user has TOTP 2FA configured. */
  twoFaEnabled:  boolean;
  /**
   * True when the second-factor challenge has been passed in this session.
   * Always false for pre-2FA tokens; always true for fully authenticated tokens
   * when twoFaEnabled is true.
   */
  twoFaVerified: boolean;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function getSecret(): Uint8Array {
  const raw = process.env.ADMIN_SESSION_SECRET ?? "";
  if (raw.length < 32) {
    throw new Error(
      "[admin-auth] ADMIN_SESSION_SECRET must be set and at least 32 characters. " +
        "Generate one with: openssl rand -hex 32",
    );
  }
  return new TextEncoder().encode(raw);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Creates a signed JWT for the given session payload.
 *
 * @param session  The session payload to embed.
 * @param preAuth  When true, issues a short-lived (10 min) pre-2FA token.
 *                 When false (default), issues an 8-hour full session token.
 */
export async function signSession(
  session: AdminSession,
  preAuth = false,
): Promise<string> {
  const maxAge = preAuth ? PRE_2FA_MAX_AGE : SESSION_MAX_AGE;
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(getSecret());
}

/**
 * Verifies a JWT and returns the decoded AdminSession, or null if invalid/expired.
 * Safe to call from Edge middleware — uses only Web Crypto.
 */
export async function verifySession(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());

    // Validate that the required string fields are present.
    if (
      typeof payload["sub"]   !== "string" ||
      typeof payload["email"] !== "string" ||
      typeof payload["name"]  !== "string" ||
      typeof payload["role"]  !== "string"
    ) {
      return null;
    }

    return {
      sub:           payload["sub"]           as string,
      email:         payload["email"]         as string,
      name:          payload["name"]          as string,
      role:          payload["role"]          as string,
      twoFaEnabled:  Boolean(payload["twoFaEnabled"]),
      twoFaVerified: Boolean(payload["twoFaVerified"]),
    };
  } catch {
    return null;
  }
}

/**
 * Returns cookie options for the admin session token.
 *
 * @param maxAge    Lifetime in seconds.
 * @param isSecure  True in production (sets the Secure flag).
 */
export function sessionCookieOptions(
  maxAge: number,
  isSecure: boolean,
): {
  httpOnly: true;
  secure:   boolean;
  sameSite: "strict";
  path:     "/";
  maxAge:   number;
} {
  return {
    httpOnly: true,
    secure:   isSecure,
    // "lax" (not "strict") is required so the browser includes the session
    // cookie when an external service (e.g. Stripe Checkout) redirects back
    // to this origin via a top-level GET navigation.  "strict" silently drops
    // the cookie on cross-site redirects, causing a spurious login prompt.
    sameSite: "lax",
    path:     "/",
    maxAge,
  };
}
