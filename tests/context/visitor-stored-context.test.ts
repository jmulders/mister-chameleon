/**
 * Everything stored about a returning visitor comes in one database read.
 *
 * Measured on 21 Nov 2026: a visitor who had accepted cookies waited 0.4 to
 * 7 s for the hero. The page read their history, behaviour state and profile
 * with five or six requests at once, and on a database that had been quiet
 * each of those opened a connection of its own. Migration 188 answers all of
 * it in one request. These tests hold that the readers use it, that they give
 * the same answers as with their own reads, and that they fall back to those
 * reads while the function is not there.
 *
 * The Supabase client is pointed at a stub host and `fetch` is stubbed, as in
 * history-queries-parallel.test.ts.
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

process.env.NEXT_PUBLIC_SUPABASE_URL  = "http://supabase.stub.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "stub-service-role";

const origFetch = globalThis.fetch;

const SESSION = "3f2c1b7a-9d4e-4c1a-8b0f-5a6d7e8f9a10";
const FRESH = new Date(Date.now() - 86_400_000).toISOString();

/** What the database holds for the visitor, in the shape of the tables. */
const TABLES = {
  pageViews: [
    { created_at: "2026-11-01T10:00:00+00:00", payload: { _tid: "t1" } },
    { created_at: "2026-11-02T10:00:00+00:00", payload: { _tid: "t1" } },
    { created_at: "2026-11-03T10:00:00+00:00", payload: { _tid: "andere-tenant" } },
  ],
  ctaClicks: [{ created_at: "2026-11-02T10:05:00+00:00", payload: { _tid: "t1" } }],
  lastVariant: { hero_key: "hero_returning", cta_key: "cta_demo" },
  profile: {
    company_name: "Zorggroep Voorbeeld", company_domain: "voorbeeld.test", company_industry: "zorg",
    company_size: "200-500", firmographics_at: FRESH,
    identity_level: "company", status: "lead", intent_score: 62, visit_count: 4, last_seen_at: FRESH,
  },
};

type Mode = "function" | "missing" | "failing" | "odd";
let mode: Mode = "function";
const asked: string[] = [];

function respond(u: unknown, init?: RequestInit): Response {
  const url = String(u);
  const path = /\/rest\/v1\/([^?]+)/.exec(url)?.[1] ?? "?";
  asked.push(`${init?.method ?? "GET"} ${path}`);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  if (path === "rpc/visitor_stored_context") {
    if (mode === "missing") return json({ code: "PGRST202", message: "Could not find the function public.visitor_stored_context" }, 404);
    if (mode === "failing") return json({ code: "57014", message: "canceling statement due to statement timeout" }, 500);
    if (mode === "odd") return json({ page_views: "geen lijst" });
    return json({
      page_views: TABLES.pageViews, cta_clicks: TABLES.ctaClicks, last_variant: TABLES.lastVariant,
      behavior_state: null, profile: TABLES.profile,
    });
  }
  if (path === "events") return json(url.includes("cta_click") ? TABLES.ctaClicks : TABLES.pageViews);
  if (path === "served_variants") return json([TABLES.lastVariant]);
  if (path === "visitor_behavior_state") return json([]);
  if (path === "visitor_profiles") return json(TABLES.profile);
  return json([]);
}

type StoredMod = typeof import("../../context/visitor-stored-context.ts");
type HistoryMod = typeof import("../../context/fetch-visitor-history.ts");
type ProfilesMod = typeof import("../../lib/lead-base/visitor-profiles-store.ts");
let stored: StoredMod;
let fetchVisitorHistory: HistoryMod["fetchVisitorHistory"];
let getKnownFirmographics: ProfilesMod["getKnownFirmographics"];
let getReturningProfileSignals: ProfilesMod["getReturningProfileSignals"];

/** The three readers as the page calls them, sharing one started read. */
async function readAll(shared: boolean) {
  const promise = shared ? stored.startVisitorStoredContext("t1", SESSION) : undefined;
  const [history, firmographics, signals] = await Promise.all([
    fetchVisitorHistory(SESSION, "t1", promise),
    getKnownFirmographics("t1", SESSION, 30, promise),
    getReturningProfileSignals("t1", SESSION, promise),
  ]);
  return { history, firmographics, signals };
}

describe("everything stored about a visitor in one read", () => {
  before(async () => {
    globalThis.fetch = async (u: unknown, init?: RequestInit) => respond(u, init);
    stored = await import("../../context/visitor-stored-context.ts");
    ({ fetchVisitorHistory } = await import("../../context/fetch-visitor-history.ts"));
    ({ getKnownFirmographics, getReturningProfileSignals } = await import("../../lib/lead-base/visitor-profiles-store.ts"));
  });

  after(() => { globalThis.fetch = origFetch; });

  beforeEach(() => {
    mode = "function";
    asked.length = 0;
    stored.resetVisitorStoredContextAvailability();
  });

  it("makes one request where there were six", async () => {
    await readAll(true);
    assert.deepEqual(asked, ["POST rpc/visitor_stored_context"]);
    asked.length = 0;
    await readAll(false);
    assert.equal(asked.length, 6, asked.join(", "));
  });

  it("gives the readers the same answers as their own reads do", async () => {
    const one = await readAll(true);
    const six = await readAll(false);
    assert.deepEqual(one, six);
    // And the answers are the right ones: the tenant filter still applies.
    assert.equal(one.history.pageViewCount, 2, "the page view of another tenant does not count");
    assert.equal(one.history.ctaClickCount, 1);
    assert.equal(one.history.hasClickedCta, true);
    assert.equal(one.history.firstSeenAt, "2026-11-02T10:05:00+00:00");
    assert.equal(one.history.lastHeroKey, "hero_returning");
    assert.equal(one.history.lastCtaKey, "cta_demo");
    assert.equal(one.history.fromDatabase, true);
    assert.deepEqual(one.firmographics, {
      companyName: "Zorggroep Voorbeeld", companyDomain: "voorbeeld.test", companyIndustry: "zorg", companySize: "200-500",
    });
    assert.deepEqual(one.signals, {
      identityLevel: "company", status: "lead", intentScore: 62, visitCount: 4, lastSeenAt: FRESH,
    });
  });

  it("falls back to the six reads while the function is not there, and does not keep asking for it", async () => {
    mode = "missing";
    const first = await readAll(true);
    assert.equal(first.history.pageViewCount, 2);
    assert.deepEqual(first.signals?.visitCount, 4);
    assert.equal(asked.filter((a) => a === "POST rpc/visitor_stored_context").length, 1);
    assert.equal(asked.length, 7, "the one failed call, then the six reads");

    asked.length = 0;
    await readAll(true);
    assert.equal(asked.includes("POST rpc/visitor_stored_context"), false, "a missing function is remembered for a while");
    assert.equal(asked.length, 6);
  });

  it("falls back for this request when the read fails, and tries the function again next time", async () => {
    mode = "failing";
    const failed = await readAll(true);
    assert.equal(failed.history.pageViewCount, 2);
    assert.equal(asked.length, 7);

    mode = "function";
    asked.length = 0;
    await readAll(true);
    assert.deepEqual(asked, ["POST rpc/visitor_stored_context"]);
  });

  it("falls back when the answer does not look as expected", async () => {
    mode = "odd";
    const out = await readAll(true);
    assert.equal(out.history.pageViewCount, 2);
    assert.equal(asked.length, 7);
  });

  it("reads nothing without a tenant or a session", async () => {
    assert.equal(await stored.startVisitorStoredContext("", SESSION), null);
    assert.equal(await stored.startVisitorStoredContext("t1", ""), null);
    assert.deepEqual(asked, []);
  });

  it("accepts the function's answer and refuses anything else", () => {
    const { parseVisitorStoredContext } = stored;
    assert.deepEqual(
      parseVisitorStoredContext({ page_views: [], cta_clicks: [], last_variant: null, behavior_state: null, profile: null }),
      { pageViews: [], ctaClicks: [], lastVariant: null, behaviorState: null, profile: null },
    );
    assert.equal(parseVisitorStoredContext(null), null);
    assert.equal(parseVisitorStoredContext([]), null);
    assert.equal(parseVisitorStoredContext({ page_views: [], cta_clicks: "x" }), null);
    assert.equal(parseVisitorStoredContext({ page_views: [{ payload: {} }], cta_clicks: [] }), null, "an event without a time");
    assert.equal(parseVisitorStoredContext({ page_views: [], cta_clicks: [], profile: "tekst" }), null);
  });
});

describe("the page starts the one read once and shares it", () => {
  const read = (file: string) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("the homepage", () => {
    const code = read("lib/pipeline/homepage-pipeline.ts");
    assert.equal(code.match(/startVisitorStoredContext\(/g)?.length, 1);
    assert.match(code, /storedContextPromise = \(\(consent\.personalization \|\| consent\.enrichment\) && sessionId\)\s*\? startVisitorStoredContext\(tenantConfig\.tenantId, sessionId\)\s*: undefined/);
    assert.match(code, /fetchVisitorHistory\(sessionId, tenantConfig\.tenantId, storedContextPromise\)/);
    assert.match(code, /firmographicFreshnessDays \?\? 30,\s*storedContextPromise,/);
    assert.match(code, /getReturningProfileSignals\(tenantConfig\.tenantId, sessionId, storedContextPromise\)/);
  });

  it("the other pages", () => {
    const code = read("lib/cms-page-decision.ts");
    assert.equal(code.match(/startVisitorStoredContext\(/g)?.length, 1);
    assert.match(code, /fetchVisitorHistory\(sessionId, tenantId, storedContextPromise\)/);
    assert.match(code, /getReturningProfileSignals\(tenantId, sessionId, storedContextPromise\)/);
  });

  it("nothing is read for a visitor without consent", () => {
    // The promise stays undefined, and every reader is behind its own consent check.
    const code = read("lib/pipeline/homepage-pipeline.ts");
    assert.match(code, /historyPromise = consent\.personalization\s*\? fetchVisitorHistory\(/);
    assert.match(code, /seedFirmographicsPromise = \(consent\.enrichment && sessionId\)/);
    assert.match(code, /returningSignalsPromise = \(consent\.personalization && sessionId\)/);
  });
});

describe("migration 188", () => {
  const sql = readFileSync("supabase/migrations/20240101000188_visitor_stored_context.sql", "utf8");

  it("is read-only, runs as the caller and is for the server only", () => {
    assert.match(sql, /CREATE OR REPLACE FUNCTION public\.visitor_stored_context\(\s*p_tenant_id\s+text,\s*p_session_id\s+text\s*\)/);
    assert.match(sql, /\bSTABLE\b/);
    assert.match(sql, /SECURITY INVOKER/);
    assert.match(sql, /SET search_path = public/);
    assert.match(sql, /REVOKE EXECUTE ON FUNCTION public\.visitor_stored_context\(text, text\) FROM PUBLIC, anon, authenticated;/);
    assert.match(sql, /GRANT\s+EXECUTE ON FUNCTION public\.visitor_stored_context\(text, text\) TO service_role;/);
    assert.doesNotMatch(sql.replace(/^--.*$/gm, ""), /\b(INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
  });

  it("returns every key the application reads", () => {
    for (const key of ["page_views", "cta_clicks", "last_variant", "behavior_state", "profile"]) {
      assert.ok(sql.includes(`'${key}'`), key);
    }
    for (const column of ["company_name", "company_domain", "company_industry", "company_size", "firmographics_at",
      "identity_level", "status", "intent_score", "visit_count", "last_seen_at"]) {
      assert.ok(sql.includes(`'${column}'`), column);
    }
  });

  it("keeps a session id that is not a uuid from failing the call", () => {
    assert.match(sql, /WHEN p_session_id ~ '\^\[0-9a-fA-F\]\{8\}-/);
  });
});
