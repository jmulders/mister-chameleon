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
 * ─── Credential resolution order ──────────────────────────────────────────────
 *
 *   1. platform_settings DB  (Admin → Platform → Integrations → Calendar)
 *   2. Env vars              (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)
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
 *        "client_email"  → service account email
 *        "private_key"   → private key PEM
 *   7. Share your Google Calendar with the service account email:
 *        Open Google Calendar → Settings → [Your calendar] → Share
 *        Add the service account email with "See all event details" permission.
 *   8. Configure in Admin → Platform → Integrations → Calendar.
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
 *
 * Credentials are resolved in order:
 *   1. platform_settings DB  (Admin → Integrations → Calendar)
 *   2. GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY env vars
 */
export async function getGoogleAccessToken(): Promise<string> {
  const now = Date.now();

  // Use cached token if it has > 60 seconds left
  if (_tokenCache && _tokenCache.expiresAt - now > 60_000) {
    return _tokenCache.accessToken;
  }

  const { email, privateKey } = await resolveCredentials();

  if (!email || !privateKey) {
    throw new Error(
      "Google Calendar is not configured. " +
      "Set the service account credentials in Admin → Platform → Integrations → Calendar, " +
      "or set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in your env vars.",
    );
  }

  const token = await fetchServiceAccountToken(email, privateKey);
  _tokenCache = token;
  return token.accessToken;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: credential resolution (DB first, env fallback)
// ─────────────────────────────────────────────────────────────────────────────

async function resolveCredentials(): Promise<{ email: string | undefined; privateKey: string | undefined }> {
  try {
    const { getPlatformGoogleCalendarSettings } = await import("@/platform/platform-store");
    const { decryptSecret }                     = await import("@/lib/email-crypto");

    const result = await getPlatformGoogleCalendarSettings();
    if (result.ok && result.data.serviceAccountEmail && result.data.serviceAccountPrivateKey) {
      return {
        email:      result.data.serviceAccountEmail,
        privateKey: decryptSecret(result.data.serviceAccountPrivateKey),
      };
    }
  } catch {
    // DB not available or not configured — fall through to env vars
  }

  return {
    email:      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  };
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
  // Robust PEM parser — handles all common formats:
  //   • Literal \n (two chars, backslash-n) from Vercel / .env files without quotes
  //   • Real newlines from dotenv-parsed values
  //   • Windows line endings (\r\n)
  //   • Surrounding quotes accidentally included in the value
  const normalised = privateKeyPem
    .replace(/^["']|["']$/g, "")   // strip accidental surrounding quotes
    .replace(/\\n/g, "\n");        // literal \n → real newline

  // Split on line breaks only (NOT spaces — the header "-----BEGIN PRIVATE KEY-----"
  // contains spaces and would otherwise split into "KEY-----" which pollutes the base64).
  // Filter out any line starting with a dash (PEM header/footer lines).
  const pemContents = normalised
    .split(/\r?\n|\r/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("-"))
    .join("");

  // Uint8Array<ArrayBuffer>, not bare Uint8Array: since TypeScript 5.7 the array
  // is generic over its buffer, and the bare form widens to ArrayBufferLike —
  // which includes SharedArrayBuffer, which crypto.subtle.importKey will not
  // accept. Uint8Array.from() always allocates a plain ArrayBuffer, so this is
  // the narrower truth rather than a cast.
  let binaryKey: Uint8Array<ArrayBuffer>;
  try {
    binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  } catch {
    // Find the first invalid base64 character to aid debugging
    const invalid = [...pemContents].find((c) => !/[A-Za-z0-9+/=]/.test(c));
    throw new Error(
      `Google private key contains an invalid character: ${invalid ? JSON.stringify(invalid) : "unknown"}. ` +
      `Key preview: "${privateKeyPem.slice(0, 60).replace(/\n/g, "\\n")}..."`,
    );
  }

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    // .buffer is ArrayBufferLike, which since TS 5.7 includes SharedArrayBuffer —
    // importKey does not accept that. Passing the view itself is equivalent here
    // (Uint8Array.from allocates exactly this key) and typechecks.
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const data      = new TextEncoder().encode(input);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, data);
  return base64urlBytes(signature);
}
