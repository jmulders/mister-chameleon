"use server";

/**
 * Tenant Workspace › Integrations › Calendar — Server Actions
 *
 * Per-tenant Google Calendar booking config, stored on `tenant_settings.calendar`.
 *
 * ─── No secrets here ──────────────────────────────────────────────────────────
 *
 *   Authentication uses the SHARED platform service account (Platform →
 *   Integrations → Calendar). This tenant page only stores which calendar to
 *   book into plus working hours. The tenant shares its calendar with the
 *   platform service-account email shown on the page.
 */

import { revalidatePath }                  from "next/cache";
import { getTenantById, saveTenant }        from "@/tenant/tenant-store";
import { getPlatformGoogleCalendarSettings } from "@/platform/platform-store";
import { getRequiredAdminSession }          from "@/lib/admin-auth/authorization";
import type { TenantSettings }              from "@/tenant/types";

export interface TenantCalendarConfig {
  enabled:           boolean;
  calendarId:        string;
  bookingTimezone:   string;
  bookingHoursStart: number;
  bookingHoursEnd:   number;
}

export interface TenantCalendarView {
  config: TenantCalendarConfig;
  /** Shared platform service-account email to share the tenant calendar with. */
  platformServiceAccountEmail: string;
  /** Whether the platform-level calendar credentials are configured. */
  platformConfigured: boolean;
}

// ── Read ────────────────────────────────────────────────────────────────────

export async function getTenantCalendarSettingsAction(
  tenantId: string,
): Promise<{ ok: true; data: TenantCalendarView } | { ok: false; error: string }> {
  await getRequiredAdminSession();

  const tenant = await getTenantById(tenantId);
  if (!tenant) return { ok: false, error: "Tenant not found." };

  const cal = tenant.calendar;

  let platformServiceAccountEmail = "";
  let platformConfigured = false;
  try {
    const platform = await getPlatformGoogleCalendarSettings();
    if (platform.ok) {
      platformServiceAccountEmail = platform.data.serviceAccountEmail ?? "";
      platformConfigured = Boolean(
        platform.data.serviceAccountEmail && platform.data.serviceAccountPrivateKey,
      );
    }
  } catch {
    // Platform settings unavailable — leave defaults.
  }

  return {
    ok: true,
    data: {
      config: {
        enabled:           cal?.enabled           ?? false,
        calendarId:        cal?.calendarId         ?? "",
        bookingTimezone:   cal?.bookingTimezone    ?? "Europe/Amsterdam",
        bookingHoursStart: cal?.bookingHoursStart  ?? 9,
        bookingHoursEnd:   cal?.bookingHoursEnd     ?? 17,
      },
      platformServiceAccountEmail,
      platformConfigured,
    },
  };
}

// ── Write ───────────────────────────────────────────────────────────────────

export async function saveTenantCalendarSettingsAction(
  tenantId: string,
  input: TenantCalendarConfig,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await getRequiredAdminSession();

  const existing = await getTenantById(tenantId);
  if (!existing) return { ok: false, error: "Tenant not found." };

  const hoursStart = Number.isFinite(input.bookingHoursStart) ? input.bookingHoursStart : 9;
  const hoursEnd   = Number.isFinite(input.bookingHoursEnd)   ? input.bookingHoursEnd   : 17;
  if (hoursStart < 0 || hoursStart > 23 || hoursEnd < 1 || hoursEnd > 24 || hoursEnd <= hoursStart) {
    return { ok: false, error: "Working hours must satisfy 0 ≤ start < end ≤ 24." };
  }

  const merged: TenantSettings = {
    ...existing,
    calendar: {
      enabled:           input.enabled,
      calendarId:        input.calendarId.trim()      || undefined,
      bookingTimezone:   input.bookingTimezone.trim() || undefined,
      bookingHoursStart: hoursStart,
      bookingHoursEnd:   hoursEnd,
    },
  };

  const result = await saveTenant(merged);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/admin/tenants/${tenantId}/integrations/calendar`);
  revalidatePath(`/admin/tenants/${tenantId}/integrations`);
  return { ok: true };
}
