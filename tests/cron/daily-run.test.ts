/**
 * The daily cron dispatcher: it runs every job in order, reports each one,
 * stops when its time is up, and says when the last run is too old.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DAILY_JOB_PATHS,
  DAILY_RUN_STALE_MS,
  dailyRunHealth,
  runDailyJobs,
  summarizeBody,
  type DailyRunRecord,
} from "@/lib/cron/daily-run";
import { isDailyRunRecord } from "@/lib/cron/daily-run-store";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** A clock the test moves by hand. */
function clock(start = Date.parse("2026-11-14T03:00:00Z")) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

describe("runDailyJobs", () => {
  it("runs every job in the given order", async () => {
    const seen: string[] = [];
    const record = await runDailyJobs(["/a", "/b", "/c"], async (path) => {
      seen.push(path);
      return json({ ok: true });
    });
    assert.deepEqual(seen, ["/a", "/b", "/c"]);
    assert.equal(record.ok, true);
    assert.equal(record.ran, 3);
    assert.equal(record.failed, 0);
  });

  it("keeps going after a job that answers with an error", async () => {
    const record = await runDailyJobs(["/a", "/b"], async (path) =>
      path === "/a" ? json({ ok: false, error: "Unauthorized" }, 401) : json({ ok: true, deleted: 4 }));
    assert.equal(record.ok, false);
    assert.equal(record.failed, 1);
    assert.deepEqual(record.results.map((r) => r.status), [401, 200]);
    assert.equal(record.results[0]?.error, "Unauthorized");
    assert.deepEqual(record.results[1]?.summary, { deleted: 4 });
  });

  it("keeps going after a job that throws", async () => {
    const record = await runDailyJobs(["/a", "/b"], async (path) => {
      if (path === "/a") throw new Error("module failed to load");
      return json({ ok: true });
    });
    assert.equal(record.results[0]?.ok, false);
    assert.equal(record.results[0]?.status, 0);
    assert.equal(record.results[0]?.error, "module failed to load");
    assert.equal(record.results[1]?.ok, true);
  });

  it("names the status when a failed job gives no reason", async () => {
    const record = await runDailyJobs(["/a"], async () => new Response("<html>", { status: 429 }));
    assert.equal(record.results[0]?.error, "HTTP 429");
  });

  it("stops a job that outlasts the budget and skips the ones after it", async () => {
    const seen: string[] = [];
    let release: (() => void) | undefined;
    const record = await runDailyJobs(["/slow", "/next", "/last"], (path) => {
      seen.push(path);
      // Holds its own timer, so the process stays alive on Node 22 too.
      return new Promise<Response>((resolve) => {
        const hold = setTimeout(() => resolve(json({ ok: true })), 5_000);
        release = () => { clearTimeout(hold); resolve(json({ ok: true })); };
      });
    }, Date.now, 30);
    release?.();
    assert.deepEqual(seen, ["/slow"]);
    assert.equal(record.results[0]?.error, "timed out");
    assert.equal(record.results[1]?.error, "skipped: out of time");
    assert.equal(record.results[2]?.error, "skipped: out of time");
    assert.equal(record.failed, 3);
  });

  it("skips what is left once the budget is spent by finished jobs", async () => {
    const c = clock();
    const seen: string[] = [];
    const record = await runDailyJobs(["/a", "/b"], async (path) => {
      seen.push(path);
      c.advance(60_000);
      return json({ ok: true });
    }, c.now, 50_000);
    assert.deepEqual(seen, ["/a"]);
    assert.equal(record.results[0]?.ok, true);
    assert.equal(record.results[1]?.error, "skipped: out of time");
  });

  it("stamps the run with its start and finish", async () => {
    const c = clock();
    const record = await runDailyJobs(["/a"], async () => { c.advance(1_500); return json({ ok: true }); }, c.now);
    assert.equal(record.startedAt, "2026-11-14T03:00:00.000Z");
    assert.equal(record.finishedAt, "2026-11-14T03:00:01.500Z");
    assert.equal(record.results[0]?.durationMs, 1_500);
  });
});

describe("summarizeBody", () => {
  it("keeps numbers and flags and drops the rest", () => {
    const out = summarizeBody({
      ok: true, deleted: 12, matched: 3, dryRun: false,
      runAt: "2026-11-14T03:00:00Z",
      results: [{ tenantId: "acme", action: "renewed" }],
    });
    assert.deepEqual(out, { summary: { deleted: 12, matched: 3, dryRun: false } });
  });

  it("cuts a long error short", () => {
    const out = summarizeBody({ ok: false, error: "x".repeat(900) });
    assert.equal(out.error?.length, 200);
  });

  it("makes nothing of an answer that is not an object", () => {
    assert.deepEqual(summarizeBody(null), {});
    assert.deepEqual(summarizeBody("fine"), {});
    assert.deepEqual(summarizeBody([1, 2]), {});
  });
});

describe("dailyRunHealth", () => {
  const at = Date.parse("2026-11-14T09:00:00Z");
  const run = (finishedAt: string, ok = true): DailyRunRecord =>
    ({ startedAt: finishedAt, finishedAt, ok, ran: 8, failed: ok ? 0 : 1, results: [] });

  it("says never when no run is on record", () => {
    assert.deepEqual(dailyRunHealth(null, at), { state: "never", ageHours: null });
  });

  it("is ok for last night's clean run", () => {
    assert.deepEqual(dailyRunHealth(run("2026-11-14T03:00:20Z"), at), { state: "ok", ageHours: 6 });
  });

  it("is failed for last night's run with a failure", () => {
    assert.equal(dailyRunHealth(run("2026-11-14T03:00:20Z", false), at).state, "failed");
  });

  it("forgives one late night and not two", () => {
    const finished = Date.parse("2026-11-12T03:00:00Z");
    assert.equal(dailyRunHealth(run("2026-11-12T03:00:00Z"), finished + DAILY_RUN_STALE_MS).state, "ok");
    assert.equal(dailyRunHealth(run("2026-11-12T03:00:00Z"), finished + DAILY_RUN_STALE_MS + 1).state, "stale");
  });

  it("calls an old run stale whatever its outcome", () => {
    assert.equal(dailyRunHealth(run("2026-08-25T06:30:08Z", false), at).state, "stale");
  });

  it("treats an unreadable date as no run", () => {
    assert.equal(dailyRunHealth(run("yesterday"), at).state, "never");
  });
});

describe("isDailyRunRecord", () => {
  it("accepts what the dispatcher writes", async () => {
    const record = await runDailyJobs(["/a"], async () => json({ ok: true }));
    assert.equal(isDailyRunRecord(JSON.parse(JSON.stringify(record))), true);
  });

  it("refuses a row of another shape", () => {
    assert.equal(isDailyRunRecord(null), false);
    assert.equal(isDailyRunRecord({}), false);
    assert.equal(isDailyRunRecord({ startedAt: "x", finishedAt: "y", ok: "yes", results: [] }), false);
  });
});

describe("the job list", () => {
  const jobsSource  = readFileSync("lib/cron/daily-jobs.ts", "utf8");
  const routeSource = readFileSync("app/api/cron/daily/route.ts", "utf8");

  it("has a handler and a route file for every job", () => {
    for (const path of DAILY_JOB_PATHS) {
      assert.ok(jobsSource.includes(`"${path}":`), `${path} has no handler`);
      assert.ok(jobsSource.includes(`import("@/app${path}/route")`), `${path} does not load its own route`);
      assert.doesNotThrow(() => readFileSync(`app${path}/route.ts`, "utf8"), `${path} has no route file`);
    }
  });

  it("bills before it purges and purges before the ad jobs", () => {
    const order = [...DAILY_JOB_PATHS] as string[];
    assert.ok(order.indexOf("/api/cron/billing-renewal") < order.indexOf("/api/cron/visitor-profile-purge"));
    assert.ok(order.indexOf("/api/cron/rate-limit-cleanup") < order.indexOf("/api/cron/ad-sync"));
  });

  it("does not call its jobs over the network", () => {
    assert.ok(!/\bfetch\(/.test(routeSource), "the dispatcher fetches again");
    assert.ok(!/\bfetch\(/.test(jobsSource), "the job caller fetches again");
  });

  it("answers 500 when a job failed and writes the run down", () => {
    assert.ok(routeSource.includes("status: record.ok ? 200 : 500"));
    assert.ok(routeSource.includes("saveDailyRun(record)"));
  });
});
