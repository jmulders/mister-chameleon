/**
 * Platform Enrichment Settings — Server Actions
 *
 * Actions for the /admin/platform/integrations/enrichment page.
 *
 *   getEnrichmentPlatformSettingsAction — read current state (secrets stripped)
 *   saveEnrichmentPlatformSettingsAction — persist new credentials
 *
 * ─── Security model ───────────────────────────────────────────────────────────
 *
 *   Only boolean presence flags cross the server→client boundary.
 *   API keys (clearbitSecretKey, ipinfoToken, leadinfoApiKey) are accepted as
 *   input but never returned.  The `getPlatformEnrichmentSettings` read is used
 *   for merge-on-write only — callers never see raw secret values.
 */

"use server";

import { revalidatePath } from "next/cache";
import {
  getPlatformEnrichmentSettings,
  savePlatformEnrichmentSettings,
  enrichmentFlags,
  getPlatformOpenKvKSettings,
  savePlatformOpenKvKSettings,
  openKvKFlags,
  getPlatformHolidaySettings,
  savePlatformHolidaySettings,
  holidayFlags,
  getPlatformReverseGeocodeSettings,
  savePlatformReverseGeocodeSettings,
  reverseGeocodeFlags,
  getPlatformWeatherSettings,
  savePlatformWeatherSettings,
  weatherFlags,
  getPlatformGa4HistorySettings,
  savePlatformGa4HistorySettings,
  ga4HistoryFlags,
} from "@/platform/platform-store";
import type { PlatformOpenKvKSettings, PlatformHolidaySettings, PlatformWeatherSettings, PlatformGa4HistorySettings } from "@/platform/platform-store";

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Load current platform enrichment settings, secrets stripped.
 *
 * Returns boolean presence flags for each credential so the UI can show
 * "configured / not configured" without exposing the actual key values.
 */
export async function getEnrichmentPlatformSettingsAction(): Promise<
  | {
      ok:              true;
      hasClearbitKey:  boolean;
      hasIpinfoToken:  boolean;
      hasLeadinfoKey:  boolean;
      updatedAt:       string | null;
    }
  | { ok: false; error: string }
> {
  const result = await getPlatformEnrichmentSettings();
  if (!result.ok) return { ok: false, error: result.error };

  const flags = enrichmentFlags(result.data);

  return {
    ok:              true,
    hasClearbitKey:  flags.hasClearbitKey,
    hasIpinfoToken:  flags.hasIpinfoToken,
    hasLeadinfoKey:  flags.hasLeadinfoKey,
    updatedAt:       result.updatedAt,
  };
}

// ── Write ─────────────────────────────────────────────────────────────────────

const MAX_FIELD_LENGTH = 512;

function trimField(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Save platform enrichment credentials.
 *
 * Key behaviour for each field:
 *   - Non-empty string  → stored as new credential
 *   - Empty string ""   → clears any stored credential
 *   - Undefined         → existing credential is left unchanged
 */
export async function saveEnrichmentPlatformSettingsAction(input: {
  clearbitSecretKey?: string;
  ipinfoToken?:       string;
  leadinfoApiKey?:    string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  // Validate lengths
  for (const [field, raw] of Object.entries(input)) {
    if (raw === undefined) continue;
    const val = trimField(raw);
    if (val.length > MAX_FIELD_LENGTH) {
      return { ok: false, error: `${field} must be ${MAX_FIELD_LENGTH} characters or fewer.` };
    }
  }

  const clearbitSecretKey =
    input.clearbitSecretKey !== undefined ? trimField(input.clearbitSecretKey) : undefined;
  const ipinfoToken =
    input.ipinfoToken !== undefined ? trimField(input.ipinfoToken) : undefined;
  const leadinfoApiKey =
    input.leadinfoApiKey !== undefined ? trimField(input.leadinfoApiKey) : undefined;

  const result = await savePlatformEnrichmentSettings({
    clearbitSecretKey,
    ipinfoToken,
    leadinfoApiKey,
  });

  if (!result.ok) return result;

  revalidatePath("/admin/platform/integrations/enrichment");
  revalidatePath("/admin/platform/integrations");
  return { ok: true };
}

// ── OpenKvK ───────────────────────────────────────────────────────────────────

/**
 * Load current platform OpenKvK settings.
 *
 * All fields are non-secret — they are returned directly as resolved defaults.
 */
export async function getOpenKvKPlatformSettingsAction(): Promise<
  | {
      ok:                  true;
      mode:                "off" | "nl-only" | "always";
      confidenceThreshold: number;
      matchingStrategy:    "networkOrg" | "companyName" | "networkDomain";
      updatedAt:           string | null;
    }
  | { ok: false; error: string }
> {
  const result = await getPlatformOpenKvKSettings();
  if (!result.ok) return { ok: false, error: result.error };

  const flags = openKvKFlags(result.data);

  return {
    ok:                  true,
    mode:                flags.mode,
    confidenceThreshold: flags.confidenceThreshold,
    matchingStrategy:    flags.matchingStrategy,
    updatedAt:           result.updatedAt,
  };
}

/**
 * Save platform OpenKvK settings.
 *
 * All fields are non-secret configuration values — they are stored as-is.
 */
export async function saveOpenKvKPlatformSettingsAction(
  input: PlatformOpenKvKSettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Validate confidenceThreshold range
  if (
    input.confidenceThreshold !== undefined &&
    (input.confidenceThreshold < 0 || input.confidenceThreshold > 1)
  ) {
    return { ok: false, error: "confidenceThreshold must be between 0 and 1." };
  }

  const result = await savePlatformOpenKvKSettings(input);
  if (!result.ok) return result;

  revalidatePath("/admin/platform/integrations/enrichment");
  revalidatePath("/admin/platform/integrations");
  return { ok: true };
}

// ── Holidays ──────────────────────────────────────────────────────────────────

/**
 * Load current platform holiday provider settings.
 *
 * All fields are non-secret — they are returned directly as resolved defaults.
 */
export async function getHolidayPlatformSettingsAction(): Promise<
  | {
      ok:              true;
      enabled:         boolean;
      cacheTtlHours:   number;
      countriesFilter: string;
      updatedAt:       string | null;
    }
  | { ok: false; error: string }
> {
  const result = await getPlatformHolidaySettings();
  if (!result.ok) return { ok: false, error: result.error };

  const flags = holidayFlags(result.data);

  return {
    ok:              true,
    enabled:         flags.enabled,
    cacheTtlHours:   flags.cacheTtlHours,
    countriesFilter: flags.countriesFilter,
    updatedAt:       result.updatedAt,
  };
}

/**
 * Save platform holiday provider settings.
 *
 * All fields are non-secret configuration values — they are stored as-is.
 */
export async function saveHolidayPlatformSettingsAction(
  input: PlatformHolidaySettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Validate cacheTtlHours range
  if (
    input.cacheTtlHours !== undefined &&
    (input.cacheTtlHours < 1 || input.cacheTtlHours > 720)
  ) {
    return { ok: false, error: "cacheTtlHours must be between 1 and 720." };
  }

  const result = await savePlatformHolidaySettings(input);
  if (!result.ok) return result;

  revalidatePath("/admin/platform/integrations/enrichment");
  revalidatePath("/admin/platform/integrations");
  return { ok: true };
}

// ── Reverse Geocode ────────────────────────────────────────────────────────────

/**
 * Load current platform reverse-geocode settings, secrets stripped.
 *
 * Returns `hasLocationIqApiKey` (boolean), `enabled`, and `cacheTtlHours`.
 * The LocationIQ API key is never returned to the client.
 */
export async function getReverseGeocodePlatformSettingsAction(): Promise<
  | {
      ok:                  true;
      enabled:             boolean;
      hasLocationIqApiKey: boolean;
      cacheTtlHours:       number;
      updatedAt:           string | null;
    }
  | { ok: false; error: string }
> {
  const result = await getPlatformReverseGeocodeSettings();
  if (!result.ok) return { ok: false, error: result.error };

  const flags = reverseGeocodeFlags(result.data);

  return {
    ok:                  true,
    enabled:             flags.enabled,
    hasLocationIqApiKey: flags.hasLocationIqApiKey,
    cacheTtlHours:       flags.cacheTtlHours,
    updatedAt:           result.updatedAt,
  };
}

/**
 * Save platform reverse-geocode settings.
 *
 * Key behaviour for `locationIqApiKey`:
 *   - Non-empty string  → stored as new credential
 *   - Empty string ""   → clears any stored credential
 *   - Undefined         → existing credential is left unchanged
 */
export async function saveReverseGeocodePlatformSettingsAction(input: {
  enabled?:          boolean;
  locationIqApiKey?: string;
  cacheTtlHours?:    number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  // Validate cacheTtlHours range
  if (
    input.cacheTtlHours !== undefined &&
    (input.cacheTtlHours < 1 || input.cacheTtlHours > 720)
  ) {
    return { ok: false, error: "cacheTtlHours must be between 1 and 720." };
  }

  // Validate API key length
  if (input.locationIqApiKey !== undefined) {
    const trimmed = input.locationIqApiKey.trim();
    if (trimmed.length > 512) {
      return { ok: false, error: "locationIqApiKey must be 512 characters or fewer." };
    }
  }

  const result = await savePlatformReverseGeocodeSettings({
    enabled:          input.enabled,
    locationIqApiKey: input.locationIqApiKey !== undefined
      ? input.locationIqApiKey.trim()
      : undefined,
    cacheTtlHours: input.cacheTtlHours,
  });

  if (!result.ok) return result;

  revalidatePath("/admin/platform/integrations/enrichment");
  revalidatePath("/admin/platform/integrations");
  return { ok: true };
}

// ── Weather ────────────────────────────────────────────────────────────────────

/**
 * Load current platform weather enrichment settings.
 *
 * All fields are non-secret — they are returned directly as resolved defaults.
 * No credentials: the weather stage uses the free Open-Meteo API (no key needed).
 */
export async function getWeatherPlatformSettingsAction(): Promise<
  | {
      ok:            true;
      enabled:       boolean;
      cacheTtlHours: number;
      updatedAt:     string | null;
    }
  | { ok: false; error: string }
> {
  const result = await getPlatformWeatherSettings();
  if (!result.ok) return { ok: false, error: result.error };

  const flags = weatherFlags(result.data);

  return {
    ok:            true,
    enabled:       flags.enabled,
    cacheTtlHours: flags.cacheTtlHours,
    updatedAt:     result.updatedAt,
  };
}

/**
 * Save platform weather enrichment settings.
 *
 * All fields are non-secret configuration values — they are stored as-is.
 * No credentials: the weather stage uses the free Open-Meteo API (no key needed).
 */
export async function saveWeatherPlatformSettingsAction(
  input: PlatformWeatherSettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Validate cacheTtlHours range
  if (
    input.cacheTtlHours !== undefined &&
    (input.cacheTtlHours < 1 || input.cacheTtlHours > 168)
  ) {
    return { ok: false, error: "cacheTtlHours must be between 1 and 168 (one week)." };
  }

  const result = await savePlatformWeatherSettings(input);
  if (!result.ok) return result;

  revalidatePath("/admin/platform/integrations/enrichment");
  revalidatePath("/admin/platform/integrations");
  return { ok: true };
}

// ── GA4 Analytics History ──────────────────────────────────────────────────────

/**
 * Load current platform GA4 History enrichment settings.
 *
 * The `serviceAccountJson` secret is stripped — only a boolean presence flag
 * is returned to the client.
 */
export async function getGa4HistoryPlatformSettingsAction(): Promise<
  | {
      ok:                 true;
      enabled:            boolean;
      hasServiceAccount:  boolean;
      propertyId:         string;
      visitorIdDimension: string;
      lookbackDays:       number;
      cacheTtlMinutes:    number;
      measurementId:      string;
      visitorIdParamName: string;
      sendMode:           "off" | "client" | "server";
      updatedAt:          string | null;
    }
  | { ok: false; error: string }
> {
  const result = await getPlatformGa4HistorySettings();
  if (!result.ok) return { ok: false, error: result.error };

  const flags = ga4HistoryFlags(result.data);

  return {
    ok:                 true,
    enabled:            flags.enabled,
    hasServiceAccount:  flags.hasServiceAccount,
    propertyId:         flags.propertyId,
    visitorIdDimension: flags.visitorIdDimension,
    lookbackDays:       flags.lookbackDays,
    cacheTtlMinutes:    flags.cacheTtlMinutes,
    measurementId:      flags.measurementId,
    visitorIdParamName: flags.visitorIdParamName,
    sendMode:           flags.sendMode,
    updatedAt:          result.updatedAt,
  };
}

/**
 * Save platform GA4 History enrichment settings.
 *
 * `serviceAccountJson` is accepted as a raw string (the full JSON key file
 * contents).  An empty string clears the existing value.  The value is never
 * returned to the client after saving.
 */
export async function saveGa4HistoryPlatformSettingsAction(
  input: PlatformGa4HistorySettings,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Validate serviceAccountJson when provided — must be parseable JSON with
  // the required fields.
  if (input.serviceAccountJson && input.serviceAccountJson.trim().length > 0) {
    try {
      const parsed = JSON.parse(input.serviceAccountJson) as Record<string, unknown>;
      if (!parsed.client_email || !parsed.private_key) {
        return {
          ok:    false,
          error: "Service account JSON must contain client_email and private_key fields.",
        };
      }
    } catch {
      return { ok: false, error: "Service account JSON is not valid JSON." };
    }
  }

  // Validate lookbackDays range
  if (
    input.lookbackDays !== undefined &&
    (input.lookbackDays < 1 || input.lookbackDays > 730)
  ) {
    return { ok: false, error: "lookbackDays must be between 1 and 730." };
  }

  // Validate cacheTtlMinutes range
  if (
    input.cacheTtlMinutes !== undefined &&
    (input.cacheTtlMinutes < 1 || input.cacheTtlMinutes > 1440)
  ) {
    return { ok: false, error: "cacheTtlMinutes must be between 1 and 1440 (24 hours)." };
  }

  // Validate measurementId format when provided
  if (input.measurementId && input.measurementId.trim().length > 0) {
    if (!/^G-[A-Z0-9]+$/i.test(input.measurementId.trim())) {
      return { ok: false, error: 'measurementId must be a valid GA4 Measurement ID (e.g. "G-XXXXXXXXXX").' };
    }
  }

  // Validate visitorIdParamName format when provided
  if (input.visitorIdParamName && input.visitorIdParamName.trim().length > 0) {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,99}$/.test(input.visitorIdParamName.trim())) {
      return {
        ok:    false,
        error: "visitorIdParamName must start with a letter or underscore and contain only letters, digits, and underscores.",
      };
    }
  }

  // Validate sendMode value
  if (input.sendMode !== undefined && !["off", "client", "server"].includes(input.sendMode)) {
    return { ok: false, error: 'sendMode must be "off", "client", or "server".' };
  }

  const result = await savePlatformGa4HistorySettings(input);
  if (!result.ok) return result;

  revalidatePath("/admin/platform/integrations/enrichment");
  revalidatePath("/admin/platform/integrations");
  return { ok: true };
}
