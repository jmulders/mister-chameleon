/**
 * Google Calendar — Service Account JWT Authentication
 *
 * Authenticates with the Google Calendar API using a service account,
 * without any external npm package (pure fetch + Web Crypto API).
 *
 * ─── How it works ─────────────────────────────────────────────────────────────
 *
 *   Google service account auth uses the OAuth2 JWT Bearer flow:
 *     1. Build a signed JWT (RS256) containing the scopes we need.
 *     2. POST the JWT to Google's token endpoint.
 *     3. Google returns a short-lived access token (1 hour).
 *     4. The access token is cached in memory and refreshed automatically.
 *
 * ─── Required env vars ────────────────────────────────────────────────────────
 *
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL   The service account email from Google Cloud.
 *                                  e.g. demo-booking@my-project.iam.gserviceaccount.com
 *
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 *                                  The RSA private key from the service account JSON.
 *                                  Paste the full PEM string with literal \n chars,
 *                                  e.g. "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
 *
 * ─── Setup instructions ───────────────────────────────────────────────────────
 *
 *   1. Go to https://console.cloud.google.com
 *   2. Create a project (or use an existing one).
 *   3. Enable the Google Calendar API:
 *        APIs & Services → Enable APIs → search "Google Calendar API" → Enable
 *   4. Create a service account:
 *        IAM & Admin → Service Accounts → Create Service Account
 *        Give it a name like "demo-booking", click Done.
 *   5. Create a key for the service account:
 *        Click the service account → Keys → Add Key → Create new key → JSON
 *        Download the JSON file.
 *   6. From the JSON file, copy:
 *        "client_email"  → GOOGLE_SERVICE_ACCOUNT_EMAIL
 *        "private_key"   → GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 *   7. Share your Google Calendar with the service account email:
 *        Open Google Calendar → Settings → [Your calendar] → Share
 *        Add the service account email with "Make changes to events" permission.
 *   8. Find your calendar ID:
 *        Google Calendar → Settings → [Your calendar] → Calendar ID
 *        Copy it into GOOGLE_CALENDAR_ID in .env.local.
 */

import "server-only";

// ── Token cache ───────────────────────────────────────────────────────────────

interface CachedToken {
  accessToken: string;
  expiresAt:   number; // Unix ms
}

let _tokenCache: CachedToken | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a valid Google API access token, using a cached one when available
 * and fetching a fresh one otherwise.
 */
export async function getGoogleAccessToken(): Promise<string> {
  const now = Date.now();

  // Use cached token if it has > 60 seconds left
  if (_tokenCache && _tokenCache.expiresAt - now > 60_000) {
    return _tokenCache.accessToken;
  }

  const email      = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !privateKey) {
    throw new Error(
      "Google Calendar is not configured. " +
      "Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in .env.local. " +
      "See lib/google-calendar/auth.ts for setup instructions.",
    );
  }

  const token = await fetchServiceAccountToken(email, privateKey);
  _tokenCache = token;
  return token.accessToken;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: JWT creation + token exchange
// ─────────────────────────────────────────────────────────────────────────────

const GOOGLE_TOKEN_URL  = "https://oauth2.googleapis.com/token";
const CALENDAR_SCOPE    = "https://www.googleapis.com/auth/calendar";

async function fetchServiceAccountToken(
  clientEmail: string,
  privateKeyPem: string,
): Promise<CachedToken> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600; // 1 hour

  const header  = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss:   clientEmail,
    scope: CALENDAR_SCOPE,
    aud:   GOOGLE_TOKEN_URL,
    iat,
    exp,
  };

  const encodedHeader  = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput   = `${encodedHeader}.${encodedPayload}`;

  const signature = await signRS256(signingInput, privateKeyPem);
  const jwt       = `${signingInput}.${signature}`;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion:  jwt,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresAt:   Date.now() + data.expires_in * 1000,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: Web Crypto helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Base64url-encode a string (UTF-8). */
function base64url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary  = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Base64url-encode raw bytes. */
function base64urlBytes(buffer: ArrayBuffer): string {
  let binary = "";
  new Uint8Array(buffer).forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Sign a string with an RSA private key (PEM) using RS256. */
async function signRS256(input: string, privateKeyPem: string): Promise<string> {
  // Strip PEM headers/footers and whitespace to get raw base64
  const pemContents = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const data      = new TextEncoder().encode(input);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, data);
  return base64urlBytes(signature);
}
