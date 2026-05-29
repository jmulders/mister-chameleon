"use server";

/**
 * Platform Google Calendar Integration — Server Actions
 *
 * Reads and writes the "google-calendar" row in `platform_settings`.
 *
 * ─── Credential resolution order at runtime ───────────────────────────────────
 *
 *   1. platform_settings DB  (this page)                  — highest priority
 *   2. Env vars              (GOOGLE_SERVICE_ACCOUNT_EMAIL etc.) — legacy fallback
 *
 * ─── Security ─────────────────────────────────────────────────────────────────
 *
 *   The private key is stored encrypted at rest (AES-256-GCM via lib/email-crypto.ts).
 *   Read actions strip the private key before returning — only a boolean flag is sent
 *   to the client.
 */

import { revalidatePath }                         from "next/cache";
import {
  getPlatformGoogleCalendarSettings,
  savePlatformGoogleCalendarSettings,
  googleCalendarFlags,
}                                                 from "@/platform/platform-store";
import { getRequiredAdminSession }                from "@/lib/admin-auth/authorization";

// ── Safe client type ──────────────────────────────────────────────────────────

export interface SafeGoogleCalendarConfig {
  serviceAccountEmail: string;
  hasPrivateKey:       boolean;
  calendarId:          string;
  bookingTimezone:     string;
  bookingHoursStart:   number;
  bookingHoursEnd:     number;
  isConfigured:        boolean;
  updatedAt:           string | null;
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getGoogleCalendarSettingsAction(): Promise<
  { ok: true; config: SafeGoogleCalendarConfig } | { ok: false; error: string }
> {
  await getRequiredAdminSession();

  const result = await getPlatformGoogleCalendarSettings();
  if (!result.ok) return { ok: false, error: result.error };

  const flags = googleCalendarFlags(result.data);
  return {
    ok:     true,
    config: { ...flags, updatedAt: result.updatedAt },
  };
}

// ── Write ─────────────────────────────────────────────────────────────────────

export interface GoogleCalendarFormInput {
  serviceAccountEmail:     string;
  /** Empty string = preserve existing key; non-empty = replace. */
  serviceAccountPrivateKey: string;
  calendarId:              string;
  bookingTimezone:         string;
  bookingHoursStart:       number;
  bookingHoursEnd:         number;
}

export async function saveGoogleCalendarSettingsAction(
  input: GoogleCalendarFormInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await getRequiredAdminSession();

  const patch: Parameters<typeof savePlatformGoogleCalendarSettings>[0] = {
    serviceAccountEmail: input.serviceAccountEmail.trim() || undefined,
    calendarId:          input.calendarId.trim()          || undefined,
    bookingTimezone:     input.bookingTimezone.trim()      || undefined,
    bookingHoursStart:   input.bookingHoursStart,
    bookingHoursEnd:     input.bookingHoursEnd,
  };

  // Only update the private key if a new value was supplied.
  if (input.serviceAccountPrivateKey.trim()) {
    patch.serviceAccountPrivateKey = input.serviceAccountPrivateKey.trim();
  }

  const result = await savePlatformGoogleCalendarSettings(patch);
  if (!result.ok) return result;

  revalidatePath("/admin/platform/integrations/calendar");
  revalidatePath("/admin/platform/integrations");
  return { ok: true };
}

export async function clearGoogleCalendarSettingsAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  await getRequiredAdminSession();

  const result = await savePlatformGoogleCalendarSettings({
    serviceAccountEmail:     "",
    serviceAccountPrivateKey: "",
    calendarId:              "",
  });
  if (!result.ok) return result;

  revalidatePath("/admin/platform/integrations/calendar");
  revalidatePath("/admin/platform/integrations");
  return { ok: true };
}
