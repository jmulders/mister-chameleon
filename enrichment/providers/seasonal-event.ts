/**
 * Seasonal Event Enrichment — Country-Aware Holiday Detection
 *
 * A staged enrichment provider that resolves the active seasonal event for
 * a visitor's country using the Nager.Date public holiday API, augmented by
 * a date-math business-event layer for commercially important windows that
 * don't appear in public holiday calendars.
 *
 * ─── PART 1: Holiday source ────────────────────────────────────────────────
 *
 *   NagerDateHolidayProvider fetches public holidays from:
 *     GET https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}
 *
 *   The provider is modular — pass a custom implementation of
 *   `HolidayProvider` to swap in a different backend (e.g. for tests).
 *
 * ─── PART 2: Event resolution ──────────────────────────────────────────────
 *
 *   Raw holiday names (English) are mapped to SeasonalEvent values via
 *   `mapHolidayNameToEvent()`.  Covered commercial events:
 *     christmas  — holidays containing "christmas"
 *     new-year   — holidays containing "new year"
 *     easter     — Good Friday, Easter Sunday/Monday
 *   Unmapped holidays produce null (no override of the static value).
 *
 * ─── PART 3: Business event layer ─────────────────────────────────────────
 *
 *   Date-math events applied before the holiday API call.  When a
 *   business event is active, the API is skipped entirely.  Events:
 *     cyber-monday  — Monday after Black Friday (3 days after Thanksgiving)
 *     black-friday  — Day after Thanksgiving (Fri–Sun, 3 days)
 *     back-to-school — Aug 1 – Sep 15 (global approximation)
 *
 * ─── PART 4: Caching ───────────────────────────────────────────────────────
 *
 *   Holiday lists are stable within a year — a country's public holidays
 *   don't change after publication.  Results are cached in a module-level
 *   Map keyed by `"{countryCode}:{year}"` with a 24-hour TTL.
 *
 *   The cache is process-scoped (survives hot reloads in dev but resets on
 *   cold starts in production).  This is intentional — it avoids the
 *   overhead of a distributed cache for data that is stable and small.
 *
 * ─── PART 5: Output fields ─────────────────────────────────────────────────
 *
 *   seasonalEvent   — SeasonalEvent string or "none"; null means no override
 *   holidayName     — localised holiday name from Nager (e.g. "Eerste Kerstdag")
 *   seasonalSource  — "nager-date" | "business-events" | null
 *
 * ─── PART 6: Debug ─────────────────────────────────────────────────────────
 *
 *   When `isDev` is true, console.debug entries are emitted for:
 *     - countryCode used
 *     - cache hit or miss
 *     - business event match (when applicable)
 *     - holiday match (name, mapped event)
 *     - fallback to none
 *
 * ─── PART 7: Safety ────────────────────────────────────────────────────────
 *
 *   The enricher always resolves — never rejects.  All exceptions from the
 *   holiday API are caught and return `{}` (empty partial), which means the
 *   static seasonalEvent from buildTimeContext is used unchanged.
 *
 *   Gate: `shouldRun` only fires when `accumulated.countryCode` is a
 *   2-character ISO 3166-1 alpha-2 string.  Without a country code the
 *   country-aware holiday lookup is meaningless, so the stage is skipped.
 */

import type { StagedEnricher, EnricherInput, EnrichmentOutput, EnricherContext } from "../types";

// ── In-memory holiday cache ────────────────────────────────────────────────────

const CACHE_TTL_MS = 24 * 60 * 60 * 1_000; // 24 hours

interface CacheEntry {
  holidays:  NagerHoliday[];
  fetchedAt: number; // Date.now()
}

/** Module-level cache — survives hot reloads in dev, resets on cold start. */
const holidayCache = new Map<string, CacheEntry>();

// ── Nager.Date response shape ─────────────────────────────────────────────────

interface NagerHoliday {
  /** ISO date string, e.g. "2025-12-25". */
  date:        string;
  /** Holiday name in the country's primary language. */
  localName:   string;
  /** English holiday name. */
  name:        string;
  countryCode: string;
  fixed:       boolean;
  global:      boolean;
  counties:    string[] | null;
  launchYear:  number  | null;
  types:       string[];
}

// ── HolidayProvider interface (modular, swappable in tests) ───────────────────

/**
 * Contract that any holiday backend must satisfy.
 * Swap the default `NagerDateHolidayProvider` with a stub in tests.
 */
export interface HolidayProvider {
  /**
   * Return the list of public holidays for `countryCode` in `year`.
   * Must resolve — never reject.  Return `[]` on error or unknown country.
   */
  getHolidays(countryCode: string, year: number): Promise<NagerHoliday[]>;
  /** Return true when the result for (countryCode, year) is already cached. */
  isCacheHit(countryCode: string, year: number): boolean;
}

// ── NagerDateHolidayProvider ──────────────────────────────────────────────────

export interface NagerDateHolidayProviderOptions {
  /**
   * API base URL.
   * Default: "https://date.nager.at/api/v3"
   * Override in tests to point at a local mock server.
   */
  apiBase?:     string;
  /**
   * Cache TTL in milliseconds.
   * Default: 86 400 000 ms (24 hours).
   */
  cacheTtlMs?:  number;
}

/**
 * Fetches public holidays from the Nager.Date free public API.
 *
 * Endpoint: GET /api/v3/PublicHolidays/{year}/{countryCode}
 * Docs:     https://date.nager.at
 * License:  MIT — free for public use, attribution appreciated.
 *
 * Results are cached per `{countryCode}:{year}` for up to 24 hours
 * in a module-level Map (no external cache dependency required).
 */
export class NagerDateHolidayProvider implements HolidayProvider {
  private readonly apiBase:    string;
  private readonly cacheTtlMs: number;

  constructor(options: NagerDateHolidayProviderOptions = {}) {
    this.apiBase    = options.apiBase    ?? "https://date.nager.at/api/v3";
    this.cacheTtlMs = options.cacheTtlMs ?? CACHE_TTL_MS;
  }

  async getHolidays(countryCode: string, year: number): Promise<NagerHoliday[]> {
    const cacheKey = `${countryCode}:${year}`;
    const cached   = holidayCache.get(cacheKey);

    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      return cached.holidays;
    }

    const url = `${this.apiBase}/PublicHolidays/${year}/${countryCode}`;

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      // Bypass Next.js fetch cache — we manage our own TTL above
      cache: "no-store",
    });

    // 404 = country not supported by Nager — treat as empty list, not error
    if (response.status === 404) {
      holidayCache.set(cacheKey, { holidays: [], fetchedAt: Date.now() });
      return [];
    }

    if (!response.ok) {
      throw new Error(
        `Nager.Date API error: ${response.status} ${response.statusText} for ${url}`,
      );
    }

    const holidays: NagerHoliday[] = (await response.json()) as NagerHoliday[];
    holidayCache.set(cacheKey, { holidays, fetchedAt: Date.now() });
    return holidays;
  }

  isCacheHit(countryCode: string, year: number): boolean {
    const cacheKey = `${countryCode}:${year}`;
    const cached   = holidayCache.get(cacheKey);
    return !!(cached && Date.now() - cached.fetchedAt < this.cacheTtlMs);
  }
}

// ── PART 2: Holiday → SeasonalEvent mapping ───────────────────────────────────

/**
 * Map a Nager.Date English holiday name to a SeasonalEvent string.
 *
 * Uses case-insensitive substring matching — holiday names vary by country
 * (e.g. "Christmas Day", "Christmas Eve", "First Day of Christmas") so
 * exact matches would miss legitimate events.
 *
 * Returns null when the holiday is real but not commercially significant.
 */
function mapHolidayNameToEvent(name: string): string | null {
  const lower = name.toLowerCase();

  // Christmas — "christmas day", "christmas eve", "first day of christmas", …
  if (lower.includes("christmas")) {
    return "christmas";
  }

  // New Year — "new year's day", "new year's eve", "new years day", …
  if (lower.includes("new year")) {
    return "new-year";
  }

  // Easter — "easter sunday", "easter monday", "good friday", "holy friday"
  if (
    lower.includes("easter") ||
    lower.includes("good friday") ||
    lower.includes("holy friday")
  ) {
    return "easter";
  }

  // Not a commercially mapped event
  return null;
}

// ── PART 3: Business event layer (pure date math, no API) ─────────────────────

/**
 * Determine whether the given date (year/month/day, all 1-indexed, month 1–12)
 * falls within a business-event window.
 *
 * Business events are computed from fixed date rules — no API call required.
 * Priority (first match wins):
 *   1. Cyber Monday — Monday after Black Friday
 *   2. Black Friday — day after US Thanksgiving (Fri–Sun, 3-day window)
 *   3. Back to School — Aug 1 – Sep 15 (global approximation)
 *
 * Returns the SeasonalEvent string when matched, or null when no event is active.
 */
function resolveBusinessEvent(
  year:  number,
  month: number,
  day:   number,
): string | null {
  // ── Cyber Monday & Black Friday ──────────────────────────────────────────
  if (month === 11) {
    // Thanksgiving = 4th Thursday of November
    // Date.UTC(year, 10, 1) = Nov 1 00:00 UTC; .getUTCDay() → 0=Sun … 6=Sat
    const nov1DayOfWeek       = new Date(Date.UTC(year, 10, 1)).getUTCDay();
    const daysToFirstThursday = (4 - nov1DayOfWeek + 7) % 7;
    const thanksgivingDay     = 1 + daysToFirstThursday + 21; // 4th Thursday
    const blackFridayDay      = thanksgivingDay + 1;          // Black Friday (Fri)
    const cyberMondayDay      = blackFridayDay + 3;           // Cyber Monday (Mon)

    // Cyber Monday takes precedence (more specific)
    if (day === cyberMondayDay) return "cyber-monday";

    // Black Friday window: Fri, Sat, Sun (3 days)
    if (day >= blackFridayDay && day <= blackFridayDay + 2) return "black-friday";
  }

  // ── Back to School ────────────────────────────────────────────────────────
  // Global approximation — Northern Hemisphere Aug/Sep school return
  if (month === 8 || (month === 9 && day <= 15)) {
    return "back-to-school";
  }

  return null;
}

// ── PART 1/5/6: Staged enricher factory ──────────────────────────────────────

export interface SeasonalEventEnricherOptions {
  /**
   * Holiday data provider.
   * Defaults to `new NagerDateHolidayProvider()`.
   * Swap for a stub in unit tests.
   */
  provider?: HolidayProvider;
  /**
   * Emit verbose debug logs via `console.debug`.
   * Default: false.
   */
  isDev?: boolean;
  /**
   * Comma-separated list of ISO 3166-1 alpha-2 country codes that are
   * eligible for holiday detection (e.g. "NL,DE,BE,GB").
   *
   * When provided and non-empty, `shouldRun` returns false for any
   * countryCode that is not in this list.
   * When absent or empty, all countries supported by Nager.Date are eligible.
   */
  allowedCountries?: string;
}

/**
 * Create a `StagedEnricher` that resolves the country-aware seasonal event.
 *
 * Gate: skipped when `accumulated.countryCode` is absent or not a valid
 * 2-character ISO string.  When skipped, the static `seasonalEvent` from
 * `buildTimeContext` is used unchanged.
 *
 * @example
 * const stage = createSeasonalEventStagedEnricher({ isDev: true });
 * // Returns a StagedEnricher that resolves seasonalEvent, holidayName,
 * // and seasonalSource for the visitor's countryCode.
 */
export function createSeasonalEventStagedEnricher(
  options: SeasonalEventEnricherOptions = {},
): StagedEnricher {
  const provider = options.provider ?? new NagerDateHolidayProvider();
  const isDev    = options.isDev    ?? false;

  // Pre-parse the countries filter into a Set for O(1) lookup.
  // Empty string / absent → no restriction (all countries allowed).
  const allowedSet: Set<string> | null =
    options.allowedCountries
      ? new Set(
          options.allowedCountries
            .split(",")
            .map((c) => c.trim().toUpperCase())
            .filter(Boolean),
        )
      : null;

  return {
    label: "Seasonal Event",

    // ── Gate ────────────────────────────────────────────────────────────────
    shouldRun: (
      _input:      EnricherInput,
      accumulated: Partial<EnrichmentOutput>,
    ): boolean => {
      // Require a resolved 2-char country code from prior geo stages
      if (
        typeof accumulated.countryCode !== "string" ||
        accumulated.countryCode.length !== 2
      ) {
        return false;
      }

      // When a countries filter is set, skip countries not in the list
      if (allowedSet && !allowedSet.has(accumulated.countryCode.toUpperCase())) {
        if (isDev) {
          console.debug("[seasonal-event] skipped (country not in allowedCountries)", {
            countryCode:     accumulated.countryCode,
            allowedCountries: [...(allowedSet ?? [])].join(","),
          });
        }
        return false;
      }

      return true;
    },

    // ── Enricher ────────────────────────────────────────────────────────────
    enricher: async (
      _input:      EnricherInput,
      accumulated: Partial<EnrichmentOutput>,
      ctx?:        EnricherContext,
    ): Promise<Partial<EnrichmentOutput>> => {
      // shouldRun guarantees this is a string
      const countryCode = accumulated.countryCode as string;

      const now   = new Date();
      const year  = now.getUTCFullYear();
      const month = now.getUTCMonth() + 1; // 1-indexed
      const day   = now.getUTCDate();

      // Record cache state before any fetch so debug log is accurate.
      // Business-event resolution (date math) never touches the provider cache;
      // for the cacheSource signal we treat that path as "request-time" since
      // no I/O is involved.  Nager.Date cache hits count as "provider-cache".
      const wasCacheHit = provider.isCacheHit(countryCode, year);

      if (isDev) {
        console.debug("[seasonal-event] starting", {
          countryCode,
          date:     `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
          cacheHit: wasCacheHit,
        });
      }

      // ── PART 3: Business event layer (date math, no API call) ─────────────
      //
      // Business events take priority over public holidays because they are
      // commercially curated windows that operators explicitly want to target.
      const businessEvent = resolveBusinessEvent(year, month, day);

      if (businessEvent) {
        // Business event = pure date math, no external I/O.
        ctx?.setCacheSource("request-time");
        if (isDev) {
          console.debug("[seasonal-event] business-event matched", {
            countryCode,
            event: businessEvent,
            rule:  "date-math",
          });
        }

        return {
          seasonalEvent:  businessEvent,
          holidayName:    null,
          seasonalSource: "business-events",
        };
      }

      // ── PART 1/2: Public holiday lookup via Nager.Date ────────────────────
      // Signal the cache source now — before getHolidays() which may fetch.
      ctx?.setCacheSource(wasCacheHit ? "provider-cache" : "fresh");
      try {
        const holidays = await provider.getHolidays(countryCode, year);

        if (isDev) {
          console.debug("[seasonal-event] nager.date response", {
            countryCode,
            year,
            cacheHit:     wasCacheHit,
            holidayCount: holidays.length,
          });
        }

        // Build today's YYYY-MM-DD key to match against API response dates
        const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        // Find a holiday that falls exactly on today's date
        const todayHoliday = holidays.find((h) => h.date === dateKey);

        if (todayHoliday) {
          const mappedEvent = mapHolidayNameToEvent(todayHoliday.name);

          if (isDev) {
            console.debug("[seasonal-event] holiday found", {
              date:        todayHoliday.date,
              name:        todayHoliday.name,
              localName:   todayHoliday.localName,
              mappedEvent: mappedEvent ?? "(not commercially mapped)",
            });
          }

          if (mappedEvent) {
            // Mapped to a known commercial event
            return {
              seasonalEvent:  mappedEvent,
              holidayName:    todayHoliday.localName || todayHoliday.name,
              seasonalSource: "nager-date",
            };
          }

          // Today is a public holiday but not a commercially mapped event.
          // Return the holiday name so the debug overlay can surface it, but
          // don't override seasonalEvent (return null = keep static value).
          return {
            seasonalEvent:  null,
            holidayName:    todayHoliday.localName || todayHoliday.name,
            seasonalSource: "nager-date",
          };
        }

        // No public holiday today
        if (isDev) {
          console.debug("[seasonal-event] no public holiday today", {
            countryCode,
            date: dateKey,
          });
        }

        return {
          seasonalEvent:  null,
          holidayName:    null,
          seasonalSource: null,
        };

      } catch (err) {
        // PART 7: Safety — API failure must never block rendering.
        // Return {} so the static seasonalEvent from buildTimeContext is used.
        if (isDev) {
          console.warn("[seasonal-event] provider error, using static fallback", {
            countryCode,
            error: err instanceof Error ? err.message : String(err),
          });
        }

        return {};
      }
    },
  };
}

// ── Debug cache flush ─────────────────────────────────────────────────────────

/**
 * Flush the in-process holiday / seasonal-event cache.
 *
 * Called by `enrichment/flush-debug.ts` during a debug session reset so that
 * the post-reset request re-fetches public holiday data rather than serving
 * TTL-cached (up to 24 h) holiday lists for the visitor's country.
 *
 * Note: `holidayCache` is a plain `Map`, not a `ProviderCache`, so we call
 * `.clear()` rather than `.flush()`.
 */
export function flushSeasonalEventProviderCache(): void {
  holidayCache.clear();
}
