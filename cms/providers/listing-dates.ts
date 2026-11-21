/**
 * Dates of entries in a listing.
 *
 * Statamic gives a date in two shapes. Its file reader gives
 * "2026-11-21 09:00:00", its REST API "2026-11-21T09:00:00.000000Z". A listing
 * only needs the day.
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
