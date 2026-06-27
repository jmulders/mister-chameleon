/**
 * Google Calendar — Create a Demo Booking Event
 *
 * Creates a 30-minute calendar event for the booked demo slot.
 *
 * ─── What gets created ────────────────────────────────────────────────────────
 *
 *   - A Google Calendar event on the configured calendar.
 *   - The booker is added as a guest (attendee).
 *   - sendUpdates: "all" → Google sends an automatic calendar invite email
 *     to all attendees (including the booker).
 *   - The event includes the booker's contact details in the description.
 *
 * ─── Confirmation email ────────────────────────────────────────────────────────
 *
 *   Google's own invite email covers the calendar invite part.
 *   A separate branded confirmation email is sent via Resend from the
 *   /api/demo/book route handler after this function returns successfully.
 */

import "server-only";
import { getGoogleAccessToken } from "./auth";
import { resolveCalendarConfig } from "./config";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BookingDetails {
  /** YYYY-MM-DD */
  date:     string;
  /** HH:MM local time (24h) */
  time:     string;
  name:     string;
  email:    string;
  company?: string;
  phone?:   string;
  message?: string;
}

export interface BookingResult {
  ok:      true;
  eventId: string;
  htmlLink: string;
}

export interface BookingError {
  ok:    false;
  error: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a Google Calendar event for the demo booking.
 *
 * Returns the event ID and a link to the calendar event on success.
 */
export async function createDemoBooking(
  details: BookingDetails,
  tenantId?: string,
): Promise<BookingResult | BookingError> {
  // Resolve which calendar to book into (per-tenant → platform → env). Auth is
  // always the shared platform service account.
  const { calendarId, timezone } = await resolveCalendarConfig(tenantId);

  if (!calendarId) {
    return { ok: false, error: "No booking calendar is configured." };
  }

  const { startDateTime, endDateTime } = buildEventTimes(
    details.date,
    details.time,
    timezone,
  );

  const description = buildDescription(details);

  const eventBody = {
    summary:     `Demo: ${details.name}${details.company ? ` — ${details.company}` : ""}`,
    description,
    start:       { dateTime: startDateTime, timeZone: timezone },
    end:         { dateTime: endDateTime,   timeZone: timezone },
    // Note: attendees are omitted because adding guests via a service account
    // requires Domain-Wide Delegation (Google Workspace only).
    // The booker receives their confirmation via the Resend email instead.
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email",  minutes: 24 * 60 }, // 1 day before
        { method: "popup",  minutes: 30 },       // 30 min before
      ],
    },
  };

  try {
    const accessToken = await getGoogleAccessToken();

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;

    const res = await fetch(url, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventBody),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok:    false,
        error: `Google Calendar event creation failed (${res.status}): ${text}`,
      };
    }

    const event = await res.json() as { id: string; htmlLink: string };
    return {
      ok:       true,
      eventId:  event.id,
      htmlLink: event.htmlLink,
    };

  } catch (err) {
    const error = err instanceof Error ? err.message : "Calendar booking failed";
    return { ok: false, error };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Builds ISO 8601 start/end datetime strings from the date + "HH:MM" time. */
function buildEventTimes(
  date:     string,
  time:     string,
  timezone: string,
): { startDateTime: string; endDateTime: string } {
  const [startHour, startMin] = time.split(":").map(Number) as [number, number];
  const endMin  = startMin + 30;
  const endHour = startHour + Math.floor(endMin / 60);

  // Format: "2026-05-10T09:30:00"  (no Z — timezone is passed separately)
  const startDateTime = `${date}T${pad(startHour)}:${pad(startMin % 60)}:00`;
  const endDateTime   = `${date}T${pad(endHour)}:${pad(endMin % 60)}:00`;

  void timezone; // Passed in eventBody.start.timeZone / eventBody.end.timeZone
  return { startDateTime, endDateTime };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Builds the event description from the booking details. */
function buildDescription(details: BookingDetails): string {
  const lines: string[] = [
    "Demo booking via Mister Chameleon",
    "",
    `Name:    ${details.name}`,
    `Email:   ${details.email}`,
  ];

  if (details.company) lines.push(`Company: ${details.company}`);
  if (details.phone)   lines.push(`Phone:   ${details.phone}`);
  if (details.message) {
    lines.push("", "Message:", details.message);
  }

  return lines.join("\n");
}
