/**
 * Time-based Context Variables
 *
 * Computes all time-based context values from a given timestamp and an
 * IANA tenant timezone string.  All functions are pure and side-effect-free.
 *
 * ─── Design decisions ─────────────────────────────────────────────────────
 *
 *   Timezone: resolved via the built-in Intl.DateTimeFormat API — no external
 *   library required.  The tenant's IANA timezone string (e.g.
 *   "Europe/Amsterdam") determines all derived values.  An invalid or
 *   unsupported timezone silently falls back to UTC.
 *
 *   seasonalEvent: a minimal, opinionated set of commercially relevant
 *   seasonal moments.  Not a full calendar — just the handful of windows
 *   operators actually want to target.  Priority order (first match wins)
 *   governs which event is returned when windows overlap.
 *
 * ─── Seasonal window assumptions (all dates inclusive) ────────────────────
 *
 *   new-year      — Dec 31, Jan 1–3
 *   christmas     — Dec 1–30
 *   black-friday  — Black Friday (day after US Thanksgiving, 4th Thursday
 *                   of November) through the following Sunday (3 days total)
 *   halloween     — Oct 25–31
 *   valentines    — Feb 12–14
 *   easter        — Good Friday (Easter − 2) through Easter Monday
 *                   (Easter + 1); Meeus/Jones/Butcher Gregorian algorithm
 *   none          — all other dates
 *
 * ─── Adding a new seasonal event ─────────────────────────────────────────
 *
 *   1. Add the value to SeasonalEvent.
 *   2. Add a detection branch in resolveSeasonalEvent() with a comment
 *      explaining the assumed date window.
 *   3. Add the new value to the allowedValues list in context/registry.ts
 *      and decision/rules/field-registry.ts.
 */

// ── Public types ─────────────────────────────────────────────────────────────

/** Lowercase English day-of-week names. */
export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

/**
 * Broad time-of-day bucket.
 *
 *   morning   —  6:00–11:59
 *   afternoon — 12:00–17:59
 *   evening   — 18:00–21:59
 *   night     — 22:00–05:59
 */
export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

/**
 * A small, practically useful set of seasonal events.
 *
 * "none" is the value for the vast majority of the calendar year.
 * This is NOT a full public-holiday engine — it covers commercially
 * relevant moments that marketers and operators commonly want to target.
 *
 * ─── Source of truth ──────────────────────────────────────────────────────
 *
 *   Static values (computed from date math in buildTimeContext):
 *     none, new-year, christmas, easter, black-friday, halloween, valentines
 *
 *   Enrichment-layer values (produced by createSeasonalEventStagedEnricher):
 *     cyber-monday    — Monday after Black Friday
 *     back-to-school  — Aug 1 – Sep 15 (Northern Hemisphere approximation)
 *
 *   When the enrichment stage is active, its value overrides the static one
 *   in buildDecisionContext (enrichment wins when non-null).
 *
 * ─── Adding a new event ───────────────────────────────────────────────────
 *
 *   1. Add the value here.
 *   2. Add detection in `resolveSeasonalEvent()` (for static) or in
 *      `enrichment/providers/seasonal-event.ts` (for country-aware).
 *   3. Add to `allowedValues` in `decision/rules/field-registry.ts`.
 */
export type SeasonalEvent =
  | "none"
  | "new-year"
  | "christmas"
  | "easter"
  | "black-friday"
  | "cyber-monday"
  | "back-to-school"
  | "halloween"
  | "valentines";

/** The complete set of time-based context values computed for one request. */
export interface TimeContext {
  /** Hour of the day in tenant local time, 0–23. */
  currentHour: number;
  /** Lowercase English day of the week in tenant local time. */
  dayOfWeek: DayOfWeek;
  /** True on Saturday and Sunday in tenant local time. */
  isWeekend: boolean;
  /** Month in tenant local time — 1 = January, 12 = December. */
  month: number;
  /** Date string in YYYY-MM-DD format in tenant local time. */
  dateKey: string;
  /** Broad time-of-day bucket in tenant local time. */
  timeOfDay: TimeOfDay;
  /**
   * Active seasonal event, or "none" when outside all known seasonal windows.
   * Priority order is fixed; see module-level comment for window definitions.
   */
  seasonalEvent: SeasonalEvent;
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Build all time-based context values for a timestamp in a tenant timezone.
 *
 * @param now      The current time (typically `new Date()`).
 * @param timezone IANA timezone string, e.g. "Europe/Amsterdam".
 *                 Silently falls back to UTC when the string is invalid.
 *
 * @example
 * const time = buildTimeContext(new Date(), "America/New_York");
 * // { currentHour: 14, dayOfWeek: "friday", isWeekend: false,
 * //   month: 11, dateKey: "2025-11-28", timeOfDay: "afternoon",
 * //   seasonalEvent: "black-friday" }
 */
export function buildTimeContext(now: Date, timezone: string): TimeContext {
  const { year, month, day, hour, weekdayName } = getLocalDateParts(now, timezone);

  const pad2 = (n: number) => String(n).padStart(2, "0");

  const dayOfWeek: DayOfWeek = weekdayName.toLowerCase() as DayOfWeek;

  return {
    currentHour:   hour,
    dayOfWeek,
    isWeekend:     dayOfWeek === "saturday" || dayOfWeek === "sunday",
    month,
    dateKey:       `${year}-${pad2(month)}-${pad2(day)}`,
    timeOfDay:     resolveTimeOfDay(hour),
    seasonalEvent: resolveSeasonalEvent(year, month, day),
  };
}

// ── Internal helpers ─────────────────────────────────────────────────────────

interface LocalDateParts {
  year:        number;
  month:       number; // 1–12
  day:         number; // 1–31
  hour:        number; // 0–23
  weekdayName: string; // "Monday", "Tuesday", …
}

// Fallback weekday names indexed by Date.getUTCDay() (0 = Sunday).
const UTC_WEEKDAY_NAMES: readonly string[] = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

/**
 * Extract localized date/time components using the Intl.DateTimeFormat API.
 *
 * Uses formatToParts() for reliable cross-locale parsing.  Falls back to UTC
 * values when the timezone is invalid or Intl is not available (should not
 * occur in Node.js 18+, but defence-in-depth costs nothing here).
 */
function getLocalDateParts(now: Date, timezone: string): LocalDateParts {
  // Validate the timezone first — new Intl.DateTimeFormat throws RangeError
  // for invalid/unknown IANA timezone strings.
  let tz = timezone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(now);
  } catch {
    tz = "UTC";
  }

  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year:     "numeric",
      month:    "numeric",
      day:      "numeric",
      hour:     "2-digit",
      hour12:   false,
      weekday:  "long",
    });

    // Build a keyed map from the typed parts array.
    const parts: Record<string, string> = {};
    for (const p of dtf.formatToParts(now)) {
      if (p.type !== "literal") parts[p.type] = p.value;
    }

    return {
      year:        parseInt(parts["year"]    ?? "2000", 10),
      month:       parseInt(parts["month"]   ?? "1",    10),
      day:         parseInt(parts["day"]     ?? "1",    10),
      // hour12: false can return "24" for midnight in some environments; normalise.
      hour:        parseInt(parts["hour"]    ?? "0",    10) % 24,
      weekdayName: parts["weekday"] ?? "Monday",
    };
  } catch {
    // Absolute last-resort fallback — Intl unavailable.
    return {
      year:        now.getUTCFullYear(),
      month:       now.getUTCMonth() + 1,
      day:         now.getUTCDate(),
      hour:        now.getUTCHours(),
      weekdayName: UTC_WEEKDAY_NAMES[now.getUTCDay()] ?? "Monday",
    };
  }
}

/**
 * Map an hour (0–23) to a broad time-of-day bucket.
 *
 *   morning   —  6:00–11:59  (early day / work start)
 *   afternoon — 12:00–17:59  (midday / business hours peak)
 *   evening   — 18:00–21:59  (after work / leisure browsing peak)
 *   night     — 22:00–05:59  (late night / very early morning)
 */
function resolveTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 6  && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 22) return "evening";
  return "night";
}

/**
 * Determine the active seasonal event for a given (year, month, day) in local
 * tenant time.  Returns the first matching event in priority order.
 *
 * Priority order (documented at module top):
 *   new-year → christmas → black-friday → halloween → valentines → easter → none
 */
function resolveSeasonalEvent(year: number, month: number, day: number): SeasonalEvent {
  // ── new-year: Dec 31 or Jan 1–3 ──────────────────────────────────────────
  if ((month === 12 && day === 31) || (month === 1 && day <= 3)) {
    return "new-year";
  }

  // ── christmas: Dec 1–30 ───────────────────────────────────────────────────
  // Dec 31 is new-year (handled above), so this window is Dec 1–30.
  if (month === 12 && day >= 1 && day <= 30) {
    return "christmas";
  }

  // ── black-friday: day after US Thanksgiving (4th Thursday of November)
  //                 through the following Sunday  ───────────────────────────
  if (month === 11) {
    const { day: bfDay } = getBlackFridayDate(year);
    // Window: Black Friday (Fri) + Saturday + Sunday = 3 days
    if (day >= bfDay && day <= bfDay + 2) {
      return "black-friday";
    }
  }

  // ── halloween: Oct 25–31 ─────────────────────────────────────────────────
  if (month === 10 && day >= 25) {
    return "halloween";
  }

  // ── valentines: Feb 12–14 ────────────────────────────────────────────────
  if (month === 2 && day >= 12 && day <= 14) {
    return "valentines";
  }

  // ── easter: Good Friday through Easter Monday ─────────────────────────────
  if (isInEasterWindow(year, month, day)) {
    return "easter";
  }

  return "none";
}

/**
 * Compute the calendar date of Black Friday for a given year.
 *
 * Black Friday = day after US Thanksgiving.
 * Thanksgiving = 4th Thursday of November.
 *
 * Returns { month: 11, day } where day is 1-indexed within November.
 * Note: Black Friday always falls between Nov 23 and Nov 29.
 */
function getBlackFridayDate(year: number): { month: 11; day: number } {
  // Find the day-of-week of November 1 (UTC to avoid DST)
  const nov1DayOfWeek = new Date(Date.UTC(year, 10, 1)).getUTCDay(); // 0=Sun … 6=Sat
  // Days from Nov 1 to the first Thursday (weekday index 4)
  const daysToFirstThursday = (4 - nov1DayOfWeek + 7) % 7;
  // 4th Thursday = first Thursday + 21 days
  const thanksgivingDay = 1 + daysToFirstThursday + 21;
  return { month: 11, day: thanksgivingDay + 1 };
}

/**
 * Return true when the given (year, month, day) falls within the Easter
 * window (Good Friday through Easter Monday inclusive).
 *
 * Easter Sunday is computed via the Meeus/Jones/Butcher algorithm, which is
 * valid for all years in the Gregorian calendar (1583 onwards).
 *
 * @see https://en.wikipedia.org/wiki/Date_of_Easter#Anonymous_Gregorian_algorithm
 */
function isInEasterWindow(year: number, month: number, day: number): boolean {
  const { month: eMonth, day: eDay } = computeEasterDate(year);

  // Use UTC midnight dates so arithmetic is not affected by DST changes.
  const easterSunday = new Date(Date.UTC(year, eMonth - 1, eDay));

  const goodFriday = new Date(easterSunday);
  goodFriday.setUTCDate(goodFriday.getUTCDate() - 2);

  const easterMonday = new Date(easterSunday);
  easterMonday.setUTCDate(easterMonday.getUTCDate() + 1);

  const current = new Date(Date.UTC(year, month - 1, day));
  return current >= goodFriday && current <= easterMonday;
}

/**
 * Compute Easter Sunday for a given year using the Meeus/Jones/Butcher
 * anonymous Gregorian algorithm.
 *
 * Returns { month, day } — both 1-indexed (month: 3 = March, 4 = April).
 * Easter always falls between March 22 and April 25 in the Gregorian calendar.
 */
function computeEasterDate(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);     // 3 or 4
  const day   = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}
