/**
 * Google Calendar — Availability Slots
 *
 * Computes available 30-minute demo booking slots for a given date by:
 *   1. Generating all candidate slots within working hours (Mon-Fri, 09:00-17:00).
 *   2. Querying the Google Calendar freebusy API for that day.
 *   3. Filtering out any slot that overlaps with a busy period.
 *   4. Filtering out slots that have already started (no booking in the past).
 *
 * All times are handled in the configured timezone (default: Europe/Amsterdam).
 *
 * ─── Slot format ─────────────────────────────────────────────────────────────
 *
 *   Slots are returned as "HH:MM" strings in 24-hour format, local time.
 *   e.g. ["09:00", "09:30", "10:00", ...]
 *
 * ─── Environment variables ───────────────────────────────────────────────────
 *
 *   GOOGLE_CALENDAR_ID         The calendar to check. Usually your personal
 *                              Google Calendar ID (email address) or a
 *                              dedicated calendar for demo bookings.
 *   DEMO_BOOKING_TIMEZONE      IANA timezone string. Default: Europe/Amsterdam
 *   DEMO_BOOKING_HOURS_START   First slot hour (inclusive). Default: 9
 *   DEMO_BOOKING_HOURS_END     Last slot hour (exclusive). Default: 17
 *                              e.g. 17 means slots up to 16:30 are shown.
 */

import "server-only";
import { getGoogleAccessToken } from "./auth";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const FREEBUSY_URL   = "https://www.googleapis.com/calendar/v3/freeBusy";
const SLOT_DURATION  = 30; // minutes
const MIN_ADVANCE_MS = 2 * 60 * 60 * 1000; // 2 hours minimum advance booking

function getConfig() {
  return {
    calendarId:  process.env.GOOGLE_CALENDAR_ID ?? "",
    timezone:    process.env.DEMO_BOOKING_TIMEZONE ?? "Europe/Amsterdam",
    hoursStart:  parseInt(process.env.DEMO_BOOKING_HOURS_START ?? "9",  10),
    hoursEnd:    parseInt(process.env.DEMO_BOOKING_HOURS_END   ?? "17", 10),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface AvailabilityResult {
  ok:     true;
  slots:  string[];  // "HH:MM" local-time strings
  date:   string;    // YYYY-MM-DD
}

export interface AvailabilityError {
  ok:     false;
  error:  string;
}

/**
 * Returns available 30-minute slots for the given date (YYYY-MM-DD).
 *
 * Returns an empty slots array for weekends and past dates.
 * Falls back to no slots when Google Calendar is not configured.
 */
export async function getAvailableSlots(
  date: string,
): Promise<AvailabilityResult | AvailabilityError> {
  const { calendarId, timezone, hoursStart, hoursEnd } = getConfig();

  // ── Validate date format ───────────────────────────────────────────────────
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "Invalid date format. Expected YYYY-MM-DD." };
  }

  // ── Skip weekends ──────────────────────────────────────────────────────────
  const dayOfWeek = getDayOfWeekInTimezone(date, timezone);
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { ok: true, slots: [], date };
  }

  // ── Generate all candidate slots ──────────────────────────────────────────
  const candidates = generateSlots(date, timezone, hoursStart, hoursEnd);

  // ── No calendar configured — return all candidates ────────────────────────
  if (!calendarId) {
    const now = Date.now();
    const filtered = candidates.filter((s) => s.startMs - now >= MIN_ADVANCE_MS);
    return {
      ok:    true,
      slots: filtered.map((s) => s.label),
      date,
    };
  }

  // ── Query Google Calendar freebusy ────────────────────────────────────────
  let busyPeriods: Array<{ start: string; end: string }>;
  try {
    busyPeriods = await fetchBusyPeriods(calendarId, date, timezone);
  } catch (err) {
    const error = err instanceof Error ? err.message : "Google Calendar error";
    return { ok: false, error };
  }

  // ── Filter out busy slots and past slots ──────────────────────────────────
  const now        = Date.now();
  const busyRanges = busyPeriods.map((b) => ({
    startMs: new Date(b.start).getTime(),
    endMs:   new Date(b.end).getTime(),
  }));

  const available = candidates.filter((slot) => {
    // Slot must be at least MIN_ADVANCE_MS in the future
    if (slot.startMs - now < MIN_ADVANCE_MS) return false;

    // Slot must not overlap with any busy period
    return !busyRanges.some(
      (b) => slot.startMs < b.endMs && slot.endMs > b.startMs,
    );
  });

  return {
    ok:    true,
    slots: available.map((s) => s.label),
    date,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: slot generation
// ─────────────────────────────────────────────────────────────────────────────

interface Slot {
  label:   string;  // "HH:MM"
  startMs: number;  // UTC timestamp
  endMs:   number;  // UTC timestamp
}

/**
 * Generates all 30-minute candidate slots for the given date in the given timezone.
 *
 * Uses the Intl.DateTimeFormat trick to parse local wall-clock times reliably
 * across timezones without any date library.
 */
function generateSlots(
  date:       string,
  timezone:   string,
  hoursStart: number,
  hoursEnd:   number,
): Slot[] {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const slots: Slot[] = [];

  for (let hour = hoursStart; hour < hoursEnd; hour++) {
    for (let minute = 0; minute < 60; minute += SLOT_DURATION) {
      // Build a UTC Date that represents this wall-clock time in the given timezone.
      const utcMs  = localTimeToUtc(year, month - 1, day, hour, minute, timezone);
      const endMs  = utcMs + SLOT_DURATION * 60 * 1000;
      const label  = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      slots.push({ label, startMs: utcMs, endMs });
    }
  }

  return slots;
}

/**
 * Converts a local wall-clock time in the given timezone to a UTC timestamp.
 *
 * Strategy: construct a Date object treating the input as UTC, then measure
 * the actual UTC offset for that timezone/moment using Intl.DateTimeFormat,
 * and compensate.  Two iterations converge on the correct offset.
 */
function localTimeToUtc(
  year:     number,
  month:    number, // 0-indexed
  day:      number,
  hour:     number,
  minute:   number,
  timezone: string,
): number {
  // First approximation: treat the wall-clock time as UTC
  let utc = Date.UTC(year, month, day, hour, minute, 0, 0);

  // Refine twice to handle DST boundary edge cases
  for (let i = 0; i < 2; i++) {
    const offset = getUtcOffsetMs(new Date(utc), timezone);
    utc = Date.UTC(year, month, day, hour, minute, 0, 0) - offset;
  }

  return utc;
}

/**
 * Returns the UTC offset in milliseconds for a given Date in a given timezone.
 * Positive when the timezone is ahead of UTC (e.g. CET = +3600000).
 */
function getUtcOffsetMs(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone:     timezone,
    year:         "numeric",
    month:        "2-digit",
    day:          "2-digit",
    hour:         "2-digit",
    minute:       "2-digit",
    second:       "2-digit",
    hour12:       false,
  });

  const parts = formatter.formatToParts(date);
  const get   = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

  // Note: hour12:false may return hour=24 for midnight — normalise to 0
  const hour   = get("hour") % 24;
  const local  = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  return local - date.getTime();
}

/** Returns the day of week (0=Sunday) for a YYYY-MM-DD date in the given timezone. */
function getDayOfWeekInTimezone(date: string, timezone: string): number {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const utcMs   = Date.UTC(year, month - 1, day, 12, 0, 0); // midday to avoid DST issues
  const d       = new Date(utcMs);
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" });
  const abbr    = formatter.format(d);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[abbr] ?? d.getUTCDay();
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: Google Calendar freebusy API
// ─────────────────────────────────────────────────────────────────────────────

interface FreeBusyResponse {
  calendars: Record<string, { busy: Array<{ start: string; end: string }> }>;
}

async function fetchBusyPeriods(
  calendarId: string,
  date:       string,
  timezone:   string,
): Promise<Array<{ start: string; end: string }>> {
  const accessToken = await getGoogleAccessToken();

  // Build the day boundaries in UTC
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const timeMin = new Date(localTimeToUtc(year, month - 1, day, 0,  0, timezone)).toISOString();
  const timeMax = new Date(localTimeToUtc(year, month - 1, day, 23, 59, timezone)).toISOString();

  const res = await fetch(FREEBUSY_URL, {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      timeZone: timezone,
      items:    [{ id: calendarId }],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google freebusy query failed (${res.status}): ${text}`);
  }

  const data = await res.json() as FreeBusyResponse;
  return data.calendars[calendarId]?.busy ?? [];
}
