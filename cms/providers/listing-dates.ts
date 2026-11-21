/**
 * Dates of entries in a listing.
 *
 * Statamic gives a date in two shapes. Its file reader gives
 * "2026-11-21 09:00:00", its REST API "2026-11-21T09:00:00.000000Z". A listing
 * shows the day. It orders on the time of day as well: six articles dated the
 * same day stood under an older one of that morning, in the order of their
 * file names (21 Nov 2026).
 */

/** The day of a CMS date, as "YYYY-MM-DD", or undefined when there is none. */
export function dateOnly(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = /^\d{4}-\d{2}-\d{2}/.exec(value.trim());
  return match ? match[0] : undefined;
}

/**
 * Whether an entry may be shown today. An entry without a date always may. An
 * entry dated today may too, whatever its time of day.
 */
export function isPublishedBy(value: unknown, now: Date): boolean {
  const day = dateOnly(value);
  if (!day) return true;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return day <= today;
}

/**
 * Newest first. An item without a date goes last, and items of the same day
 * keep the order they came in.
 */
export function newestFirst<T extends { readonly date?: string }>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const da = a.item.date ?? "";
      const db = b.item.date ?? "";
      if (da === db) return a.index - b.index;
      if (!da) return 1;
      if (!db) return -1;
      return da < db ? 1 : -1;
    })
    .map(({ item }) => item);
}

/**
 * A CMS date as a string that sorts in time: "YYYY-MM-DD HH:MM:SS". The same
 * for both shapes Statamic gives. A date without a time counts as midnight.
 * Empty when there is no date.
 */
export function timeKey(value: unknown): string {
  if (typeof value !== "string") return "";
  const match = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2})?))?/.exec(value.trim());
  if (!match) return "";
  const time = match[2] ?? "00:00:00";
  return `${match[1]} ${time.length === 5 ? `${time}:00` : time}`;
}

/**
 * Entries newest first, on the day and the time of day. An entry without a
 * date goes last, and entries of the same moment keep the order they came in.
 * Sort the entries with this before they become listing items, which carry
 * the day only.
 */
export function newestEntriesFirst<T extends { readonly date?: unknown }>(entries: readonly T[]): T[] {
  return entries
    .map((entry, index) => ({ entry, index, key: timeKey(entry.date) }))
    .sort((a, b) => {
      if (a.key === b.key) return a.index - b.index;
      if (!a.key) return 1;
      if (!b.key) return -1;
      return a.key < b.key ? 1 : -1;
    })
    .map(({ entry }) => entry);
}
