/**
 * lib/cron/daily-run.ts
 *
 * The daily cron: which jobs it runs, how it runs them, and how old its last
 * run may be before somebody should look.
 *
 * On 14 Nov 2026 production turned out to hold 1,164 visitor profiles past
 * their retention date, the oldest expired on 26 September, and an ad sync
 * that last ran on 25 August. The cron had been doing nothing for months and
 * nothing said so: the dispatcher called its jobs over HTTP, answered 200
 * whatever they returned, and kept no trace of a run.
 *
 * So the jobs now run in the same function, a failed job makes the cron
 * answer 500, and every run is written down (see daily-run-store.ts).
 */

/** Order matters: billing first, then the purges, then the ad jobs. */
export const DAILY_JOB_PATHS = [
  "/api/cron/billing-renewal",
  "/api/cron/subscription-reconcile",
  "/api/cron/form-submission-purge",
  "/api/cron/visitor-profile-purge",
  "/api/cron/ip-company-cache-purge",
  "/api/cron/rate-limit-cleanup",
  "/api/cron/ad-sync",
  "/api/cron/ad-billing",
] as const;

export type DailyJobPath = (typeof DAILY_JOB_PATHS)[number];

/**
 * Time the jobs get together. The function itself is cut off at 60 seconds;
 * stopping at 50 leaves room to write the run down.
 */
export const DAILY_BUDGET_MS = 50_000;

/** A run older than this is stale: one night may be missed, two may not. */
export const DAILY_RUN_STALE_MS = 36 * 60 * 60 * 1000;

const ERROR_MAX = 200;

export interface DailyJobResult {
  path:       string;
  /** HTTP status the job answered with; 0 when it threw, timed out or was skipped. */
  status:     number;
  ok:         boolean;
  durationMs: number;
  error?:     string;
  /** The counters from the job's own answer, such as `deleted`. */
  summary?:   Record<string, number | boolean>;
}

export interface DailyRunRecord {
  startedAt:  string;
  finishedAt: string;
  ok:         boolean;
  ran:        number;
  failed:     number;
  results:    DailyJobResult[];
}

export type JobInvoker = (path: string) => Promise<Response>;

/** Keep the numbers and flags of a job's answer; drop everything else. */
export function summarizeBody(body: unknown): {
  summary?: Record<string, number | boolean>;
  error?:   string;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const summary: Record<string, number | boolean> = {};
  let error: string | undefined;
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (key === "ok") continue;
    if (typeof value === "number" || typeof value === "boolean") summary[key] = value;
    if (key === "error" && typeof value === "string") error = value.slice(0, ERROR_MAX);
  }
  return {
    ...(Object.keys(summary).length > 0 ? { summary } : {}),
    ...(error ? { error } : {}),
  };
}

const TIMED_OUT = Symbol("timed-out");

/**
 * Run the jobs one after another and report on each.
 *
 * One job that fails does not hold up the rest. One job that outlasts the
 * budget does: it is still running, and the jobs touch the same tables, so the
 * ones after it are skipped and wait for the next night.
 */
export async function runDailyJobs(
  paths:    readonly string[],
  invoke:   JobInvoker,
  now:      () => number = Date.now,
  budgetMs: number = DAILY_BUDGET_MS,
): Promise<DailyRunRecord> {
  const startedMs = now();
  const results: DailyJobResult[] = [];
  let outOfTime = false;

  for (const path of paths) {
    const jobStart  = now();
    const remaining = budgetMs - (jobStart - startedMs);

    if (outOfTime || remaining <= 0) {
      outOfTime = true;
      results.push({ path, status: 0, ok: false, durationMs: 0, error: "skipped: out of time" });
      continue;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const deadline = new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), remaining);
      });
      const answer = await Promise.race([invoke(path), deadline]);

      if (answer === TIMED_OUT) {
        outOfTime = true;
        results.push({ path, status: 0, ok: false, durationMs: now() - jobStart, error: "timed out" });
        continue;
      }

      const body  = await answer.json().catch(() => null);
      const extra = summarizeBody(body);
      results.push({
        path,
        status:     answer.status,
        ok:         answer.ok,
        durationMs: now() - jobStart,
        ...extra,
        ...(!answer.ok && !extra.error ? { error: `HTTP ${answer.status}` } : {}),
      });
    } catch (err) {
      results.push({
        path,
        status:     0,
        ok:         false,
        durationMs: now() - jobStart,
        error:      (err instanceof Error ? err.message : String(err)).slice(0, ERROR_MAX),
      });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  const failed = results.filter((r) => !r.ok).length;
  return {
    startedAt:  new Date(startedMs).toISOString(),
    finishedAt: new Date(now()).toISOString(),
    ok:         failed === 0,
    ran:        results.length,
    failed,
    results,
  };
}

export type DailyRunState = "never" | "ok" | "failed" | "stale";

export interface DailyRunHealth {
  state:    DailyRunState;
  /** Hours since the last run finished; null when there never was one. */
  ageHours: number | null;
}

/**
 * How the last run stands. Stale wins over failed: a run from last week says
 * nothing about tonight, whatever its outcome was.
 */
export function dailyRunHealth(record: DailyRunRecord | null, nowMs: number = Date.now()): DailyRunHealth {
  if (!record) return { state: "never", ageHours: null };
  const finished = Date.parse(record.finishedAt);
  if (!Number.isFinite(finished)) return { state: "never", ageHours: null };
  const ageMs    = Math.max(0, nowMs - finished);
  const ageHours = Math.round(ageMs / 3_600_000);
  if (ageMs > DAILY_RUN_STALE_MS) return { state: "stale", ageHours };
  return { state: record.ok ? "ok" : "failed", ageHours };
}
