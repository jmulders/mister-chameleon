/**
 * A tenant is told when the month's personalised sessions run out, and the
 * colours stop with the content.
 *
 * Until 27 Nov 2026 a tenant over the plan limit heard nothing, and kept the
 * personalised colours while the content had gone back to default.
 */
import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";

import {
  SESSION_CAP_NOTICE_THRESHOLDS, sessionCapNoticeDue, nearSessionCapNotice, thresholdsUpTo, noteSessionCounted,
} from "../../billing/session-cap-notice.ts";
import { sessionCapNoticeText } from "../../billing/notifications.ts";

// ── A database that answers what the test says and remembers what was asked ──

function fakeDb(opts: { count: number; alreadySent?: number[]; claimFails?: boolean; countFails?: boolean }) {
  const tables: string[] = [];
  const claims: number[][] = [];
  const thenable = <T,>(value: T) => ({ then: (resolve: (v: T) => unknown) => Promise.resolve(value).then(resolve) });
  const db = {
    from(table: string) {
      tables.push(table);
      if (table === "personalization_sessions") {
        const answer = opts.countFails ? { count: null, error: { message: "down" } } : { count: opts.count, error: null };
        const query: Record<string, unknown> = { eq: () => query, ...thenable(answer) };
        return { select: () => query };
      }
      if (table === "session_cap_notices") {
        return {
          upsert(rows: { threshold: number }[]) {
            claims.push(rows.map((r) => r.threshold));
            const created = rows.filter((r) => !(opts.alreadySent ?? []).includes(r.threshold));
            return { select: () => thenable(opts.claimFails ? { data: null, error: { message: "relation does not exist" } } : { data: created, error: null }) };
          },
        };
      }
      if (table === "tenant_wallets") {
        // No recipient: the notice is reached, and nothing is sent from a test.
        const query: Record<string, unknown> = {
          eq: () => query,
          maybeSingle: async () => ({ data: { notify_email: false, notify_sms: false, notification_email: null, notification_phone: null }, error: null }),
        };
        return { select: () => query };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return { db: db as never, tables, claims };
}

const base = { tenantId: "t", monthKey: "2026-11", bonusSessions: 0 };

describe("session limit notice: when one is due", () => {
  it("has two thresholds: 80% of the plan, and the plan used up", () => {
    assert.deepEqual([...SESSION_CAP_NOTICE_THRESHOLDS], [80, 100]);
  });

  it("is due at 80% and at 100% of the plan, in whole sessions", () => {
    assert.equal(sessionCapNoticeDue(1_199, 1_500), null);
    assert.equal(sessionCapNoticeDue(1_200, 1_500), 80);
    assert.equal(sessionCapNoticeDue(1_499, 1_500), 80);
    assert.equal(sessionCapNoticeDue(1_500, 1_500), 100);
    assert.equal(sessionCapNoticeDue(9_000, 1_500), 100);
    // 80% of 7 sessions is 5.6: the sixth session reaches it.
    assert.equal(sessionCapNoticeDue(5, 7), null);
    assert.equal(sessionCapNoticeDue(6, 7), 80);
  });

  it("is never due on a plan without a limit, or without sessions", () => {
    assert.equal(sessionCapNoticeDue(1_000_000, 0), null);
    assert.equal(sessionCapNoticeDue(0, 1_500), null);
    assert.equal(sessionCapNoticeDue(10, -1), null);
  });

  it("claims the lower thresholds with the one that is due", () => {
    assert.deepEqual(thresholdsUpTo(80), [80]);
    assert.deepEqual(thresholdsUpTo(100), [80, 100]);
  });

  it("only counts exactly from three quarters of the plan", () => {
    assert.equal(nearSessionCapNotice(1_000, 1_500), false);
    assert.equal(nearSessionCapNotice(1_123, 1_500), false);
    assert.equal(nearSessionCapNotice(1_124, 1_500), true);   // 1,124 + this session = 1,125 = 75%
    assert.equal(nearSessionCapNotice(5_000, 0), false);
  });
});

describe("session limit notice: after a session was counted", () => {
  it("reads nothing far below the limit", async () => {
    const { db, tables } = fakeDb({ count: 100 });
    await noteSessionCounted(db, { ...base, knownCount: 99, planLimit: 1_500 });
    assert.deepEqual(tables, []);
  });

  it("counts exactly near the limit, and claims nothing below 80%", async () => {
    const { db, tables } = fakeDb({ count: 1_150 });
    await noteSessionCounted(db, { ...base, knownCount: 1_149, planLimit: 1_500 });
    assert.deepEqual(tables, ["personalization_sessions"]);
  });

  it("claims 80% once and goes on to notify", async () => {
    const { db, tables, claims } = fakeDb({ count: 1_200 });
    await noteSessionCounted(db, { ...base, knownCount: 1_199, planLimit: 1_500 });
    assert.deepEqual(claims, [[80]]);
    assert.deepEqual(tables, ["personalization_sessions", "session_cap_notices", "tenant_wallets"]);
  });

  it("does not notify a second time for the same threshold", async () => {
    const { db, tables } = fakeDb({ count: 1_300, alreadySent: [80] });
    await noteSessionCounted(db, { ...base, knownCount: 1_299, planLimit: 1_500 });
    assert.deepEqual(tables, ["personalization_sessions", "session_cap_notices"]);
  });

  it("notifies for the limit when 80% was said before", async () => {
    const { db, tables, claims } = fakeDb({ count: 1_500, alreadySent: [80] });
    await noteSessionCounted(db, { ...base, knownCount: 1_499, planLimit: 1_500 });
    assert.deepEqual(claims, [[80, 100]]);
    assert.equal(tables.at(-1), "tenant_wallets");
  });

  it("uses the exact count, not the count the caller held", async () => {
    // The caller's count is a minute old and says 1,150; the month is at 1,500.
    const { db, claims } = fakeDb({ count: 1_500 });
    await noteSessionCounted(db, { ...base, knownCount: 1_150, planLimit: 1_500 });
    assert.deepEqual(claims, [[80, 100]]);
  });

  it("sends nothing when the claim fails, as before migration 190", async () => {
    const { db, tables } = fakeDb({ count: 1_500, claimFails: true });
    await noteSessionCounted(db, { ...base, knownCount: 1_499, planLimit: 1_500 });
    assert.deepEqual(tables, ["personalization_sessions", "session_cap_notices"]);
  });

  it("sends nothing when the count fails, and never throws", async () => {
    const { db, tables } = fakeDb({ count: 0, countFails: true });
    await noteSessionCounted(db, { ...base, knownCount: 1_499, planLimit: 1_500 });
    assert.deepEqual(tables, ["personalization_sessions"]);
    await noteSessionCounted({ from() { throw new Error("no database"); } } as never, { ...base, knownCount: 1_499, planLimit: 1_500 });
  });
});

describe("session limit notice: what the mail says", () => {
  const info = { count: 1_200, planLimit: 1_500, bonusSessions: 0, monthKey: "2026-11" };

  it("at 80%: how much is used and what happens when it runs out", () => {
    const { subject, body } = sessionCapNoticeText({ ...info, threshold: 80 });
    assert.match(subject, /80% of your monthly sessions used/);
    assert.match(body, /1,200 of the 1,500 personalised sessions/);
    assert.match(body, /default version of your pages/);
  });

  it("at the limit: that content and colours are the default ones now", () => {
    const { subject, body } = sessionCapNoticeText({ ...info, count: 1_500, threshold: 100 });
    assert.match(subject, /Monthly session limit reached/);
    assert.match(body, /no personalised content and no personalised colours/);
    assert.match(body, /first day of next month/);
  });

  it("at the limit with a bundle left: that personalisation continues on it", () => {
    const { body } = sessionCapNoticeText({ ...info, count: 1_500, threshold: 100, bonusSessions: 1_000 });
    assert.match(body, /1,000 extra sessions left/);
    assert.doesNotMatch(body, /From now on visitors get the default/);
  });
});

// The page files cannot be imported here, so these read the source.

describe("session limit: wiring", () => {
  const enforcement = fs.readFileSync("billing/plan-enforcement.ts", "utf8");
  const notice      = fs.readFileSync("billing/session-cap-notice.ts", "utf8");

  it("the notice runs after a session was newly counted, and only then", () => {
    assert.match(enforcement, /if \(isNewSession\) \{\s*await noteSessionCounted\(db, \{/);
    assert.match(enforcement, /knownCount:\s+capResult\.current,/);
    assert.match(enforcement, /planLimit:\s+capResult\.planLimit,/);
  });

  it("the mail code is not loaded on the path of every page", () => {
    assert.doesNotMatch(notice, /^import .*from "\.\/notifications";/m);
    assert.match(notice, /await import\("\.\/notifications"\)/);
  });

  it("migration 190 makes the table the claim needs, closed to everyone but the service role", () => {
    const sql = fs.readFileSync("supabase/migrations/20240101000190_session_cap_notices.sql", "utf8");
    assert.match(sql, /CREATE TABLE IF NOT EXISTS session_cap_notices/);
    assert.match(sql, /PRIMARY KEY \(tenant_id, month_key, threshold\)/);
    assert.match(sql, /ALTER TABLE session_cap_notices ENABLE ROW LEVEL SECURITY;/);
    assert.doesNotMatch(sql, /CREATE POLICY/);
  });
});

describe("session limit: the colours stop with the content", () => {
  const helper  = fs.readFileSync("lib/theme/theme-session-limit.ts", "utf8");
  const request = fs.readFileSync("lib/theme/request-theme.ts", "utf8");
  const blocks  = fs.readFileSync("lib/theme/contextual-block-tokens.ts", "utf8");

  it("asks the verdict the content path uses, and keeps the colours on a failed read", () => {
    assert.match(helper, /checkSessionSoftCapRemembered\(tenantId\)\)\.overLimit === true/);
    assert.match(helper, /catch \{\s*return false;/);
  });

  it("the page-wide theme evaluates no rule and locks no theme over the limit", () => {
    const stopped = request.indexOf("else if (await themeStoppedBySessionLimit(tenantConfig.tenantId))");
    assert.ok(stopped > 0, "the page-wide decision does not ask the limit");
    // Before the branch that loads the rules and writes the session cookie.
    assert.ok(stopped < request.indexOf("resolveThemeDecision(storedConfig"));
    assert.ok(stopped < request.indexOf("writeThemeSessionSelection("));
    // And after the edit-mode guard, which stays first.
    assert.ok(stopped > request.indexOf("DEV_TENANT_COOKIE)?.value"));
  });

  it("the block tokens stop too", () => {
    const stopped = blocks.indexOf("if (await themeStoppedBySessionLimit(tenantId)) return null;");
    assert.ok(stopped > 0, "the block tokens do not ask the limit");
    assert.ok(stopped < blocks.indexOf("resolveThemeDecision("));
  });

  it("no other place decides a theme from the rules", () => {
    const callers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && /resolveThemeDecision\(/.test(fs.readFileSync(full, "utf8").replace(/^\s*(\/\/|\*).*$/gm, ""))) callers.push(full);
      }
    };
    for (const dir of ["app", "lib", "components"]) walk(dir);
    assert.deepEqual(callers.sort(), ["lib/theme/contextual-block-tokens.ts", "lib/theme/request-theme.ts"]);
  });
});
