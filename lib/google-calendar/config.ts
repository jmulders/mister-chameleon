/**
 * Google Calendar — Booking config resolution
 *
 * Resolves WHICH calendar to book into (and its working hours / timezone) for a
 * given booking request. Authentication is handled separately and always uses
 * the SHARED platform service account (see ./auth.ts) — this module never deals
 * with credentials.
 *
 * ─── Resolution order ─────────────────────────────────────────────────────────
 *
 *   1. Per-tenant   — tenant_settings.calendar, when `enabled` + `calendarId`.
 *                     The tenant shares its calendar with the platform service
 *                     account and supplies only the calendar ID + hours.
 *   2. Platform     — platform_settings → google-calendar (the default "book a
 *                     Mister Chameleon demo" calendar).
 *   3. Environment  — GOOGLE_CALENDAR_ID / DEMO_BOOKING_* env vars.
 *   4. Defaults     — empty calendarId (callers treat as "not configured").
 */

import "server-only";

export interface ResolvedCalendarConfig {
  calendarId: string;
  timezone:   string;
  hoursStart: number;
  hoursEnd:   number;
}

const DEFAULT_TIMEZONE    = "Europe/Amsterdam";
const DEFAULT_HOURS_START = 9;
const DEFAULT_HOURS_END   = 17;

function envTimezone(): string {
  return process.env.DEMO_BOOKING_TIMEZONE ?? DEFAULT_TIMEZONE;
}
function envHoursStart(): number {
  return parseInt(process.env.DEMO_BOOKING_HOURS_START ?? String(DEFAULT_HOURS_START), 10);
}
function envHoursEnd(): number {
  return parseInt(process.env.DEMO_BOOKING_HOURS_END ?? String(DEFAULT_HOURS_END), 10);
}

/**
 * Resolve the calendar config for a booking request, optionally scoped to a
 * tenant. Auth (the service account) is always the shared platform one.
 */
export async function resolveCalendarConfig(
  tenantId?: string,
): Promise<ResolvedCalendarConfig> {
  // 1. Per-tenant calendar — only when explicitly enabled with a calendar ID.
  if (tenantId) {
    try {
      const { getTenantByIdCached } = await import("@/tenant/tenant-store");
      const tenant = await getTenantByIdCached(tenantId);
      const cal    = tenant?.calendar;
      if (cal?.enabled && cal.calendarId) {
        return {
          calendarId: cal.calendarId,
          timezone:   cal.bookingTimezone   ?? envTimezone(),
          hoursStart: cal.bookingHoursStart ?? DEFAULT_HOURS_START,
          hoursEnd:   cal.bookingHoursEnd    ?? DEFAULT_HOURS_END,
        };
      }
    } catch {
      // Tenant store unavailable — fall through to platform/env.
    }
  }

  // 2. Platform-level calendar.
  try {
    const { getPlatformGoogleCalendarSettings } = await import("@/platform/platform-store");
    const result = await getPlatformGoogleCalendarSettings();
    if (result.ok && result.data.calendarId) {
      return {
        calendarId: result.data.calendarId,
        timezone:   result.data.bookingTimezone   ?? envTimezone(),
        hoursStart: result.data.bookingHoursStart ?? envHoursStart(),
        hoursEnd:   result.data.bookingHoursEnd    ?? envHoursEnd(),
      };
    }
  } catch {
    // DB unavailable — fall through to env.
  }

  // 3. Environment variables / 4. defaults.
  return {
    calendarId: process.env.GOOGLE_CALENDAR_ID ?? "",
    timezone:   envTimezone(),
    hoursStart: envHoursStart(),
    hoursEnd:   envHoursEnd(),
  };
}
