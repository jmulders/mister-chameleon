/**
 * Unit tests for the snippet decide-context sanitiser.
 *
 * `context` arrives from an untrusted client. A null / non-object context used
 * to throw on `context.sessionId` (500 without CORS headers), a non-string path
 * crashed resolvePageMeta, and keywords / path / utm values were written into
 * visitor_journey_events unbounded. Pure function, no infra.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import {
  sanitizeDecideContext,
  MAX_KEYWORDS,
  MAX_KEYWORD_LENGTH,
  MAX_PATH_LENGTH,
  MAX_UTM_LENGTH,
} from "@/lib/snippet/decide-context";

describe("sanitizeDecideContext", () => {
  it("returns an empty context for anything that is not a plain object", () => {
    for (const v of [null, undefined, "x", 42, true, [], [{ path: "/a" }]]) {
      assert.deepEqual(sanitizeDecideContext(v), {});
    }
  });

  it("keeps well-formed string fields as-is", () => {
    const ctx = sanitizeDecideContext({
      path: "/pricing", referrer: "https://google.com/", utm_source: "google",
      utm_medium: "cpc", utm_campaign: "spring", gclid: "abc", sessionId: "vid_12345678",
      visitorId: "vid_12345678", locale: "nl", eventId: "e1", _demoMode: "mirror",
      _demoScenario: "awareness", _demoId: "d1", _demoNotif: "open",
    });
    assert.equal(ctx.path, "/pricing");
    assert.equal(ctx.referrer, "https://google.com/");
    assert.equal(ctx.utm_source, "google");
    assert.equal(ctx.utm_campaign, "spring");
    assert.equal(ctx.gclid, "abc");
    assert.equal(ctx.sessionId, "vid_12345678");
    assert.equal(ctx.locale, "nl");
    assert.equal(ctx.eventId, "e1");
    assert.equal(ctx._demoMode, "mirror");
    assert.equal(ctx._demoScenario, "awareness");
  });

  it("drops non-string fields instead of passing them on", () => {
    const ctx = sanitizeDecideContext({
      path: 42, referrer: {}, utm_source: ["x"], sessionId: 1, locale: null, eventId: 7,
      _demoMode: true, customAttributes: "nope", keywords: "not-an-array",
    });
    assert.equal(ctx.path, undefined);
    assert.equal(ctx.referrer, undefined);
    assert.equal(ctx.utm_source, undefined);
    assert.equal(ctx.sessionId, undefined);
    assert.equal(ctx.locale, undefined);
    assert.equal(ctx.eventId, undefined);
    assert.equal(ctx._demoMode, undefined);
    assert.equal(ctx.customAttributes, undefined);
    assert.equal(ctx.keywords, undefined);
  });

  it("caps the path length and forces a leading slash", () => {
    const ctx = sanitizeDecideContext({ path: "/" + "a".repeat(2000) });
    assert.equal(ctx.path?.length, MAX_PATH_LENGTH);
    assert.equal(sanitizeDecideContext({ path: "pricing" }).path, "/pricing");
    assert.equal(sanitizeDecideContext({ path: "@evil.example/x" }).path, "/@evil.example/x");
  });

  it("caps utm values", () => {
    const long = "u".repeat(1000);
    const ctx = sanitizeDecideContext({ utm_source: long, utm_medium: long, utm_campaign: long });
    assert.equal(ctx.utm_source?.length, MAX_UTM_LENGTH);
    assert.equal(ctx.utm_medium?.length, MAX_UTM_LENGTH);
    assert.equal(ctx.utm_campaign?.length, MAX_UTM_LENGTH);
  });

  it("keeps only string keywords, trimmed, capped in count and length", () => {
    const many = Array.from({ length: 500 }, (_, i) => `kw${i}`);
    assert.equal(sanitizeDecideContext({ keywords: many }).keywords?.length, MAX_KEYWORDS);

    const ctx = sanitizeDecideContext({ keywords: ["  Trailer ", 5, null, "", "k".repeat(300), { a: 1 }] });
    assert.deepEqual(ctx.keywords, ["Trailer", "k".repeat(MAX_KEYWORD_LENGTH)]);
  });

  it("keeps customAttributes only when it is a plain object", () => {
    assert.deepEqual(sanitizeDecideContext({ customAttributes: { massa: 750 } }).customAttributes, { massa: 750 });
    assert.equal(sanitizeDecideContext({ customAttributes: [1, 2] }).customAttributes, undefined);
    assert.equal(sanitizeDecideContext({ customAttributes: null }).customAttributes, undefined);
  });
});
