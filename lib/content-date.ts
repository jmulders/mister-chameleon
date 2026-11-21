/**
 * lib/content-date.ts
 *
 * Turns a date string from the CMS into what a visitor reads ("23 juli 2026")
 * plus the machine-readable value for a <time datetime> attribute.
 *
 * ─── Why this exists ─────────────────────────────────────────────────────────
 *
 *   The CMS providers do not agree on one date shape. A card can receive:
 *
 *     "2026-07-23"                     date only (mock data, Sanity)
 *     "2026-07-23 09:00"               date and wall-clock time (older Statamic)
 *     "2026-07-23T09:00:00.000000Z"    full instant (Statamic 6 REST API)
 *
 *   The listing card only understood the first two, so the third reached the
 *   page as the raw string. This helper reads all three.
 *
 * ─── Which calendar day ──────────────────────────────────────────────────────
 *
 *   A string without a zone is a wall-clock date: its day is shown as written.
 *   A string with a zone ("Z", "+02:00") is an instant; its day is taken in
 *   `timeZone`, which defaults to UTC, i.e. the day as the CMS wrote it. The
 *   zone is always passed explicitly to Intl, so the server render and the
 *   browser produce the same text whatever zone either of them runs in.
 *
 * Pure and dependency-free: safe to import from Client Components.
 */

export interface ContentDate {
  /** Value for <time datetime>: "2026-07-23" or "2026-07-23T09:00:00.000Z". */
  readonly dateTime: string;
  /** The date in the reader's language, e.g. "23 juli 2026". */
  readonly label:    string;
}

// YYYY-MM-DD, optionally followed by a time ("T" or space separated, seconds
// and fraction optional) and an optional zone designator.
const CONTENT_DATE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?)?$/i;

/** Minutes east of UTC for "Z", "+02:00", "+0200" or "-05". */
function zoneOffsetMinutes(zone: string): number {
  if (zone.toUpperCase() === "Z") return 0;
  const sign    = zone.startsWith("-") ? -1 : 1;
  const digits  = zone.slice(1).replace(":", "");
  const hours   = Number(digits.slice(0, 2));
  const minutes = Number(digits.slice(2, 4) || "0");
  return sign * (hours * 60 + minutes);
}

/**
 * Format a CMS date string for display.
 *
 * @param raw         The date as the CMS delivered it.
 * @param dateLocale  BCP 47 locale for the label, e.g. BLOCK_TEXTS[locale].dateLocale.
 * @param timeZone    IANA zone in which an instant's calendar day is read. Default "UTC".
 * @returns           The label and datetime value, or null when `raw` is not a date
 *                    this helper recognises (the caller decides what to show then).
 */
export function formatContentDate(
  raw:        string | null | undefined,
  dateLocale: string,
  timeZone:   string = "UTC",
): ContentDate | null {
  const match = CONTENT_DATE.exec((raw ?? "").trim());
  if (!match) return null;

  const [, y, mo, d, h, mi, s, fraction, zone] = match;
  const year  = Number(y);
  const month = Number(mo);
  const day   = Number(d);

  // Noon UTC on the written day: the anchor for a wall-clock date, and the
  // check that the day exists at all (Date.UTC would roll 31 February over
  // into March instead of rejecting it).
  const written = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    written.getUTCFullYear() !== year ||
    written.getUTCMonth()    !== month - 1 ||
    written.getUTCDate()     !== day
  ) {
    return null;
  }

  try {
    if (zone === undefined) {
      // Wall-clock date: show the day as written, never shifted by a zone.
      return {
        dateTime: `${y}-${mo}-${d}`,
        label:    new Intl.DateTimeFormat(dateLocale, {
          day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
        }).format(written),
      };
    }

    // Instant: resolve it to a point in time, then read its day in `timeZone`.
    if (Number(h) > 23 || Number(mi) > 59 || Number(s ?? "0") > 59) return null;
    const millis  = Number((fraction ?? "").slice(0, 3).padEnd(3, "0"));
    const instant = new Date(
      Date.UTC(year, month - 1, day, Number(h), Number(mi), Number(s ?? "0"), millis)
        - zoneOffsetMinutes(zone) * 60_000,
    );
    if (Number.isNaN(instant.getTime())) return null;

    return {
      dateTime: instant.toISOString(),
      label:    new Intl.DateTimeFormat(dateLocale, {
        day: "numeric", month: "long", year: "numeric", timeZone,
      }).format(instant),
    };
  } catch {
    // Unknown locale or time zone (Intl throws a RangeError).
    return null;
  }
}
