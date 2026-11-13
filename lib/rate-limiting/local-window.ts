/**
 * lib/rate-limiting/local-window.ts
 *
 * A per-instance request counter that sits in front of the database counter.
 *
 * ─── Why ──────────────────────────────────────────────────────────────────────
 *
 * Every /api call used to write one row to `rate_limit_counters` and wait for
 * the answer before doing anything else. Measured on production (30 Apr to
 * 13 Nov 2026): 506,248 calls spread over 103,531 (caller, minute) windows,
 * so about five calls per caller per minute. Nearly every one of those writes
 * counted a caller that was nowhere near a limit.
 *
 * The first calls of a caller in a minute are therefore counted here, in
 * memory, and never reach the database. Only a caller that passes the local
 * allowance is counted in the database, where the count is shared between
 * instances.
 *
 * ─── What this costs ──────────────────────────────────────────────────────────
 *
 * The allowance is per instance. A caller spread over N warm instances can make
 * up to `limit + (N - 1) * allowance` calls in a minute instead of `limit`.
 * That is acceptable for a general abuse ceiling. It is not acceptable where a
 * secret is being guessed, so "auth" has no allowance and the attempt limits
 * (login, 2FA) do not use this module at all.
 */

interface LocalEntry {
  windowKey: string;
  count:     number;
}

/** Hard ceiling on tracked callers, so a flood of made-up keys cannot grow the map. */
export const LOCAL_MAX_KEYS = 5000;

const counters = new Map<string, LocalEntry>();

/**
 * Count one call for `key` in `windowKey` and return the count within this
 * instance. A key seen in an older window starts again at 1.
 */
export function bumpLocal(key: string, windowKey: string): number {
  const entry = counters.get(key);
  if (entry && entry.windowKey === windowKey) {
    entry.count += 1;
    return entry.count;
  }

  if (!entry && counters.size >= LOCAL_MAX_KEYS) {
    // Drop everything from older windows first. If the map is still full the
    // current minute alone holds LOCAL_MAX_KEYS callers: start over, which only
    // hands those callers their allowance once more.
    for (const [k, e] of counters) {
      if (e.windowKey !== windowKey) counters.delete(k);
    }
    if (counters.size >= LOCAL_MAX_KEYS) counters.clear();
  }

  counters.set(key, { windowKey, count: 1 });
  return 1;
}

/** Number of callers currently tracked. For tests. */
export function localSize(): number {
  return counters.size;
}

/** Forget everything. For tests. */
export function resetLocal(): void {
  counters.clear();
}

/**
 * How many calls per minute a caller gets before the database is asked.
 * A quarter of the limit, and nothing for "auth".
 */
export function localAllowance(endpoint: string, limit: number): number {
  if (endpoint === "auth") return 0;
  return Math.floor(limit / 4);
}

export interface LocalDecision {
  /** True when the database must be asked for the shared count. */
  askDatabase: boolean;
  /** Count within this instance, after this call. */
  localCount:  number;
}

/**
 * Count the call locally and say whether the shared counter is needed.
 */
export function decideLocally(
  endpoint:  string,
  key:       string,
  windowKey: string,
  limit:     number,
): LocalDecision {
  const allowance = localAllowance(endpoint, limit);
  if (allowance <= 0) return { askDatabase: true, localCount: 0 };
  const localCount = bumpLocal(key, windowKey);
  return { askDatabase: localCount > allowance, localCount };
}

/**
 * The count to hold against the limit once the database has answered: the
 * shared count plus the calls this instance let through without asking.
 */
export function effectiveCount(endpoint: string, limit: number, databaseCount: number): number {
  return databaseCount + localAllowance(endpoint, limit);
}
