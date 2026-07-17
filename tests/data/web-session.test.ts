/**
 * Web session resolution — the billing unit.
 *
 * ─── The distinction under test ──────────────────────────────────────────────
 *
 *   mc_session_id  30 days, survives across visits. The VISITOR key: it anchors
 *                  the enrichment cache, journey history and visitor_profiles.
 *   mc_ws          30 minutes of inactivity, one per visit. The BILLING key.
 *
 *   Billing was keyed on mc_session_id, so a visitor who returned six times in a
 *   month was one row in personalization_sessions and one contextual session on
 *   the invoice. The tenant got six adapted visits and paid for one. Nothing
 *   errored; the counter simply undercounted, quietly, in the tenant's favour.
 *
 *   These tests pin the two apart. If someone later "simplifies" by reusing
 *   sessionId for billing, the last test here fails.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import {
  resolveSession,
  SESSION_COOKIE,
  WEB_SESSION_COOKIE,
  SESSION_MAX_AGE,
  WEB_SESSION_MAX_AGE,
} from "@/data/session";

function cookieFor(name: string, resolution: ReturnType<typeof resolveSession>) {
  return resolution.cookiesToSet.find((c) => c.name === name);
}

// ── First visit ───────────────────────────────────────────────────────────────

describe("resolveSession — first ever request", () => {
  it("mints both a visitor key and a web session key", () => {
    const r = resolveSession(null);

    assert.ok(r.sessionId,    "sessionId must be populated");
    assert.ok(r.webSessionId, "webSessionId must be populated");
    assert.equal(r.isNewSession,    true);
    assert.equal(r.isNewWebSession, true);
  });

  it("the two keys are different values", () => {
    const r = resolveSession(null);
    assert.notStrictEqual(r.sessionId, r.webSessionId);
  });

  it("sets both cookies, with their own lifetimes", () => {
    const r  = resolveSession(null);
    const sid = cookieFor(SESSION_COOKIE, r);
    const ws  = cookieFor(WEB_SESSION_COOKIE, r);

    assert.ok(sid, "mc_session_id must be set");
    assert.ok(ws,  "mc_ws must be set");
    assert.equal(sid!.maxAge, SESSION_MAX_AGE,     "visitor key lives 30 days");
    assert.equal(ws!.maxAge,  WEB_SESSION_MAX_AGE, "web session lives 30 minutes");
    assert.ok(WEB_SESSION_MAX_AGE < SESSION_MAX_AGE, "a visit is shorter than a visitor");
  });

  it("both cookies are httpOnly — neither is readable from page scripts", () => {
    const r = resolveSession(null);
    assert.equal(cookieFor(SESSION_COOKIE, r)!.httpOnly, true);
    assert.equal(cookieFor(WEB_SESSION_COOKIE, r)!.httpOnly, true);
  });
});

// ── Second pageview within the same visit ─────────────────────────────────────

describe("resolveSession — another pageview in the same visit", () => {
  it("reuses both keys", () => {
    const r = resolveSession(`${SESSION_COOKIE}=visitor-1; ${WEB_SESSION_COOKIE}=visit-1`);

    assert.equal(r.sessionId,       "visitor-1");
    assert.equal(r.webSessionId,    "visit-1");
    assert.equal(r.isNewSession,    false);
    assert.equal(r.isNewWebSession, false);
  });

  it("re-writes mc_ws on every request so the 30-minute window slides", () => {
    // Not a cosmetic detail: without the refresh the cookie expires 30 minutes
    // after the visit STARTED. A visitor reading for longer than that would be
    // handed a second web session mid-visit, and billed twice for one sitting.
    const r  = resolveSession(`${SESSION_COOKIE}=visitor-1; ${WEB_SESSION_COOKIE}=visit-1`);
    const ws = cookieFor(WEB_SESSION_COOKIE, r);

    assert.ok(ws, "mc_ws must be re-set even when it already existed");
    assert.equal(ws!.value,  "visit-1", "the value must not change mid-visit");
    assert.equal(ws!.maxAge, WEB_SESSION_MAX_AGE);
  });

  it("does NOT re-write mc_session_id when it already exists", () => {
    const r = resolveSession(`${SESSION_COOKIE}=visitor-1; ${WEB_SESSION_COOKIE}=visit-1`);
    assert.equal(cookieFor(SESSION_COOKIE, r), undefined);
  });
});

// ── A return visit: same visitor, new web session ─────────────────────────────

describe("resolveSession — the visitor comes back later", () => {
  it("keeps the visitor key and mints a fresh web session", () => {
    // mc_ws has expired (the browser dropped it); mc_session_id has not. This is
    // exactly the case that used to bill nothing: same visitor key, so the
    // INSERT … ON CONFLICT DO NOTHING found the row already there.
    const r = resolveSession(`${SESSION_COOKIE}=visitor-1`);

    assert.equal(r.sessionId,       "visitor-1", "the visitor is still the same visitor");
    assert.equal(r.isNewSession,    false);
    assert.equal(r.isNewWebSession, true,        "but this is a new visit");
    assert.notStrictEqual(r.webSessionId, "visitor-1");
  });

  it("each return visit gets its own web session id", () => {
    const first  = resolveSession(`${SESSION_COOKIE}=visitor-1`);
    const second = resolveSession(`${SESSION_COOKIE}=visitor-1`);

    assert.equal(first.sessionId, second.sessionId, "same visitor across both visits");
    assert.notStrictEqual(
      first.webSessionId, second.webSessionId,
      "two visits must be two billable sessions",
    );
  });
});
