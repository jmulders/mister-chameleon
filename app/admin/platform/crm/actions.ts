/**
 * Platform CRM Settings — Server Actions
 *
 * Three actions for the /admin/platform/crm page:
 *
 *   getCrmPlatformSettingsAction   — read-only; strips secrets; safe to pass to client
 *   saveCrmPlatformSettingsAction  — write; never echoes secrets back
 *   testCrmConnectionAction        — validates HubSpot API connectivity with the token
 *
 * ─── Security model ───────────────────────────────────────────────────────────
 *
 *   Only boolean flags and non-secret values (provider) cross the
 *   server→client boundary.  The access token is accepted as input but never
 *   returned.  The test action uses the token server-side only and discards it
 *   after the test completes.
 *
 * ─── Test connection design ───────────────────────────────────────────────────
 *
 *   The test resolves effective config by merging form-provided values on top of
 *   saved database values.  This allows operators to test credentials before saving.
 *
 *   The check performs a lightweight read: GET /crm/v3/owners?limit=1 which
 *   confirms the token is valid and has CRM read access, without touching any
 *   contact or company data.  The endpoint always returns 200 for a valid token.
 */

"use server";

import { revalidatePath }          from "next/cache";
import {
  getPlatformCrmSettings,
  savePlatformCrmSettings,
  crmFlags,
} from "@/platform/platform-store";

// ── Shared validation ──────────────────────────────────────────────────────────

const MAX_FIELD_LENGTH = 512;

function trimField(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// ── Read ───────────────────────────────────────────────────────────────────────

/**
 * Load the current platform CRM settings, stripped of secrets.
 *
 * Returns:
 *   provider        — "hubspot" (or the stored value)
 *   hasAccessToken  — boolean; true when a token is stored
 *   updatedAt       — ISO-8601 last-write timestamp; null when never saved
 */
export async function getCrmPlatformSettingsAction(): Promise<
  | {
      ok:             true;
      provider:       string;
      hasAccessToken: boolean;
      updatedAt:      string | null;
    }
  | { ok: false; error: string }
> {
  const result = await getPlatformCrmSettings();
  if (!result.ok) return { ok: false, error: result.error };

  const flags = crmFlags(result.data);

  return {
    ok:             true,
    provider:       flags.provider,
    hasAccessToken: flags.hasAccessToken,
    updatedAt:      result.updatedAt,
  };
}

// ── Write ──────────────────────────────────────────────────────────────────────

/**
 * Save platform CRM settings.
 *
 * `accessToken` behaviour:
 *   - Provided non-empty string  → stored as new token
 *   - Provided empty string ""   → clears any stored token
 *   - Omitted / undefined        → existing token is left unchanged
 */
export async function saveCrmPlatformSettingsAction(input: {
  provider:      "hubspot";
  accessToken?:  string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const accessToken =
    input.accessToken !== undefined ? trimField(input.accessToken) : undefined;

  if (accessToken !== undefined && accessToken.length > MAX_FIELD_LENGTH) {
    return { ok: false, error: `Access token must be ${MAX_FIELD_LENGTH} characters or fewer.` };
  }

  const result = await savePlatformCrmSettings({
    provider:    input.provider,
    accessToken,
  });
  if (!result.ok) return result;

  revalidatePath("/admin/platform/crm");
  return { ok: true };
}

// ── Test connection ────────────────────────────────────────────────────────────

/** Result returned to the client after a CRM connection test. */
export type TestCrmConnectionResult =
  | {
      ok:      true;
      message: string;
      details: {
        provider: string;
        endpoint: string;
      };
    }
  | {
      ok:    false;
      error: string;
      hint?: string;
    };

/**
 * Parse a HubSpot API error into a human-readable error + optional hint.
 * Never throws — always returns a safe string pair.
 */
function parseHubSpotError(
  status: number,
  body: string,
): { error: string; hint?: string } {
  if (status === 401) {
    return {
      error: "Access token is invalid or has been revoked.",
      hint:  "Create a new Private App token at app.hubspot.com → Settings → Integrations → Private Apps.",
    };
  }
  if (status === 403) {
    return {
      error: "Access token has insufficient permissions.",
      hint:  "Ensure the Private App has CRM scopes: crm.objects.companies.read, crm.objects.contacts.read.",
    };
  }
  if (status === 429) {
    return {
      error: "HubSpot rate limit exceeded.",
      hint:  "Wait a few seconds and try again.",
    };
  }
  return {
    error: `HubSpot API returned status ${status}.`,
    hint:  body.slice(0, 200) || undefined,
  };
}

/**
 * Test platform CRM connectivity with the given (or saved) access token.
 *
 * Uses GET /crm/v3/owners?limit=1 — a cheap read that confirms the token
 * is valid and has basic CRM access without touching visitor data.
 *
 * @param input.accessToken  New token to test (absent or empty = use saved token)
 */
export async function testCrmConnectionAction(input: {
  accessToken?: string;
}): Promise<TestCrmConnectionResult> {
  // ── Step 1: Load saved settings for fallback ───────────────────────────────
  let savedAccessToken: string | undefined;

  try {
    const saved = await getPlatformCrmSettings();
    if (saved.ok) {
      savedAccessToken = saved.data.accessToken?.trim() || undefined;
    }
  } catch {
    // Non-fatal — fall through.
  }

  // ── Step 2: Resolve effective token ───────────────────────────────────────
  //
  // Form value (non-empty) > saved platform setting > no token
  const formToken = input.accessToken ? trimField(input.accessToken) : undefined;
  const accessToken = formToken || savedAccessToken;

  if (!accessToken) {
    return {
      ok:    false,
      error: "No access token configured.",
      hint:  "Enter a HubSpot Private App access token above and save it, or paste one to test before saving.",
    };
  }

  // ── Step 3: Call HubSpot owners endpoint ─────────────────────────────────
  //
  // GET /crm/v3/owners?limit=1 is the lightest read available that confirms
  // the token is valid.  No data is stored or used.
  const endpoint = "https://api.hubapi.com/crm/v3/owners";

  let response: Response;
  try {
    response = await fetch(`${endpoint}?limit=1`, {
      method:  "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type":  "application/json",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok:    false,
      error: `Network error: could not reach HubSpot API: ${msg}`,
      hint:  "Check your internet connection and try again.",
    };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const { error, hint } = parseHubSpotError(response.status, body);
    return { ok: false, error, hint };
  }

  return {
    ok:      true,
    message: "Connected to HubSpot. Token is valid and has CRM read access.",
    details: {
      provider: "hubspot",
      endpoint: "api.hubapi.com/crm/v3",
    },
  };
}
