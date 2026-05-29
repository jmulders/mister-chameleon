/**
 * Platform Settings Server Actions
 *
 * Thin wrappers around platform/platform-store.ts that expose server-callable
 * actions for the /admin/platform/settings UI.
 *
 * ─── Security model ───────────────────────────────────────────────────────────
 *
 *   Reads strip all secret values before returning to the caller.  Only safe
 *   boolean presence flags (e.g. hasWriteToken) and non-secret config values
 *   (projectId, dataset, teamId) are returned.
 *
 *   Writes accept secret inputs but never echo them back — the response shape
 *   for a successful write is `{ ok: true }` only.
 *
 *   Secret inputs that are the empty string ("") are treated as "clear this
 *   field" rather than "store an empty string" — the store layer normalises them
 *   to null.  Non-secret fields with an empty string are stored as-is so an
 *   operator can explicitly clear e.g. the Sanity projectId.
 *
 * ─── Argument validation ──────────────────────────────────────────────────────
 *
 *   Inputs are validated at the action boundary:
 *     – String fields are trimmed.
 *     – No field may exceed 512 characters (prevents oversized payloads).
 *     – Secret inputs that contain only whitespace are treated as empty / clear.
 *
 * ─── revalidatePath ───────────────────────────────────────────────────────────
 *
 *   Each write action revalidates /admin/platform/settings so the page server
 *   component re-fetches the current flags on the next request.
 */

"use server";

import { revalidatePath } from "next/cache";
import {
  getPlatformSanitySettings,
  savePlatformSanitySettings,
  sanityFlags,
  getPlatformMaxMindSettings,
  savePlatformMaxMindSettings,
  maxmindFlags,
  getPlatformAiSettings,
  savePlatformAiSettings,
  aiPlatformFlags,
  getPlatformVercelSettings,
  savePlatformVercelSettings,
  vercelFlags,
} from "@/platform/platform-store";

// ── Shared validation ──────────────────────────────────────────────────────────

const MAX_FIELD_LENGTH = 512;

function trimField(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function validateLength(field: string, value: string): string | null {
  if (value.length > MAX_FIELD_LENGTH) {
    return `${field} must be ${MAX_FIELD_LENGTH} characters or fewer.`;
  }
  return null;
}

// ── Platform settings read (safe — no secrets) ─────────────────────────────────

/**
 * Load all platform integration settings, stripped of secrets.
 *
 * Returns safe boolean flags for each secret field, non-secret config values
 * (projectId, dataset, teamId), and the ISO-8601 `updatedAt` timestamp for
 * each section (null when the section has never been saved).
 *
 * All returned data is safe to pass directly to client components.
 */
export async function getPlatformSettingsAction(): Promise<{
  ok: true;
  sanity: {
    projectId:      string;
    dataset:        string;
    hasWriteToken:  boolean;
    updatedAt:      string | null;
  };
  maxmind: {
    accountId:      string;
    hasLicenseKey:  boolean;
    updatedAt:      string | null;
  };
  ai: {
    hasAnthropicKey: boolean;
    hasOpenaiKey:    boolean;
    hasDemoSiteKey:  boolean;
    updatedAt:       string | null;
  };
  vercel: {
    teamId:       string;
    hasApiToken:  boolean;
    updatedAt:    string | null;
  };
} | { ok: false; error: string }> {
  const [sanityRes, maxmindRes, aiRes, vercelRes] = await Promise.all([
    getPlatformSanitySettings(),
    getPlatformMaxMindSettings(),
    getPlatformAiSettings(),
    getPlatformVercelSettings(),
  ]);

  if (!sanityRes.ok)  return { ok: false, error: sanityRes.error };
  if (!maxmindRes.ok) return { ok: false, error: maxmindRes.error };
  if (!aiRes.ok)      return { ok: false, error: aiRes.error };
  if (!vercelRes.ok)  return { ok: false, error: vercelRes.error };

  const sf = sanityFlags(sanityRes.data);
  const mf = maxmindFlags(maxmindRes.data);
  const af = aiPlatformFlags(aiRes.data);
  const vf = vercelFlags(vercelRes.data);

  return {
    ok: true,
    sanity: {
      projectId:     sanityRes.data.projectId  ?? "",
      dataset:       sanityRes.data.dataset    ?? "",
      hasWriteToken: sf.hasWriteToken,
      updatedAt:     sanityRes.updatedAt,
    },
    maxmind: {
      accountId:    maxmindRes.data.accountId ?? "",
      hasLicenseKey: mf.hasLicenseKey,
      updatedAt:    maxmindRes.updatedAt,
    },
    ai: {
      hasAnthropicKey: af.hasAnthropicKey,
      hasOpenaiKey:    af.hasOpenaiKey,
      hasDemoSiteKey:  af.hasDemoSiteKey,
      updatedAt:       aiRes.updatedAt,
    },
    vercel: {
      teamId:      vercelRes.data.teamId ?? "",
      hasApiToken: vf.hasApiToken,
      updatedAt:   vercelRes.updatedAt,
    },
  };
}

// ── Sanity ─────────────────────────────────────────────────────────────────────

/**
 * Save platform-wide Sanity CMS settings.
 *
 * `writeToken` — pass the new token to set it; pass "" to clear it; omit to
 *                leave the existing token unchanged.
 *
 * Non-secret fields (projectId, dataset) are always overwritten with the
 * trimmed value supplied.
 */
export async function savePlatformSanityAction(input: {
  projectId:    string;
  dataset:      string;
  writeToken?:  string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const projectId  = trimField(input.projectId);
  const dataset    = trimField(input.dataset);
  const writeToken = input.writeToken !== undefined ? trimField(input.writeToken) : undefined;

  for (const [field, value] of [
    ["projectId", projectId],
    ["dataset",   dataset],
  ] as [string, string][]) {
    const err = validateLength(field, value);
    if (err) return { ok: false, error: err };
  }

  if (writeToken !== undefined) {
    const err = validateLength("writeToken", writeToken);
    if (err) return { ok: false, error: err };
  }

  const result = await savePlatformSanitySettings({ projectId, dataset, writeToken });

  if (!result.ok) return result;

  revalidatePath("/admin/platform/settings");
  return { ok: true };
}

// ── MaxMind ────────────────────────────────────────────────────────────────────

/**
 * Save platform-wide MaxMind GeoIP settings.
 *
 * `licenseKey` — pass the new key to set it; pass "" to clear it; omit to
 *                leave the existing key unchanged.
 */
export async function savePlatformMaxMindAction(input: {
  accountId:    string;
  licenseKey?:  string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const accountId  = trimField(input.accountId);
  const licenseKey = input.licenseKey !== undefined ? trimField(input.licenseKey) : undefined;

  const err = validateLength("accountId", accountId);
  if (err) return { ok: false, error: err };

  if (licenseKey !== undefined) {
    const err2 = validateLength("licenseKey", licenseKey);
    if (err2) return { ok: false, error: err2 };
  }

  const result = await savePlatformMaxMindSettings({ accountId, licenseKey });

  if (!result.ok) return result;

  revalidatePath("/admin/platform/settings");
  return { ok: true };
}

// ── AI ─────────────────────────────────────────────────────────────────────────

/**
 * Save platform-wide AI provider API keys.
 *
 * Pass the new key to set it; pass "" to clear it; omit to leave unchanged.
 */
export async function savePlatformAiAction(input: {
  anthropicKey?: string;
  openaiKey?:    string;
  demoSiteKey?:  string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const anthropicKey = input.anthropicKey !== undefined ? trimField(input.anthropicKey) : undefined;
  const openaiKey    = input.openaiKey    !== undefined ? trimField(input.openaiKey)    : undefined;
  const demoSiteKey  = input.demoSiteKey  !== undefined ? trimField(input.demoSiteKey)  : undefined;

  if (anthropicKey !== undefined) {
    const err = validateLength("anthropicKey", anthropicKey);
    if (err) return { ok: false, error: err };
  }
  if (openaiKey !== undefined) {
    const err = validateLength("openaiKey", openaiKey);
    if (err) return { ok: false, error: err };
  }
  if (demoSiteKey !== undefined) {
    const err = validateLength("demoSiteKey", demoSiteKey);
    if (err) return { ok: false, error: err };
  }

  const result = await savePlatformAiSettings({ anthropicKey, openaiKey, demoSiteKey });

  if (!result.ok) return result;

  revalidatePath("/admin/platform/settings");
  return { ok: true };
}

// ── Vercel ─────────────────────────────────────────────────────────────────────

/**
 * Save platform-wide Vercel integration settings.
 *
 * `apiToken` — pass the new token to set it; pass "" to clear it; omit to
 *              leave the existing token unchanged.
 */
export async function savePlatformVercelAction(input: {
  teamId:     string;
  apiToken?:  string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const teamId   = trimField(input.teamId);
  const apiToken = input.apiToken !== undefined ? trimField(input.apiToken) : undefined;

  const err = validateLength("teamId", teamId);
  if (err) return { ok: false, error: err };

  if (apiToken !== undefined) {
    const err2 = validateLength("apiToken", apiToken);
    if (err2) return { ok: false, error: err2 };
  }

  const result = await savePlatformVercelSettings({ teamId, apiToken });

  if (!result.ok) return result;

  revalidatePath("/admin/platform/settings");
  return { ok: true };
}
