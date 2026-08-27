/**
 * buildDecisionContext must read cookie-derived signals (mc_li company enrichment,
 * mc_cc client context, mc_tz timezone) from an EXPLICIT cookieHeader param when
 * given one.
 *
 * Why: `Cookie` is a forbidden header name, so it is stripped from a synthetic
 * Request built by the RSC pipelines in the Next.js server runtime (undici) —
 * request.headers.get("cookie") is then empty and mc_li never merges. (Note: a
 * plain-Node Request in this test env does NOT strip it, which is exactly why the
 * bug only surfaced at runtime; the fix — an explicit param — is env-independent.)
 * The param falls back to request.headers.get("cookie") so genuine-Request callers
 * are unaffected.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildDecisionContext } from "../../decision/context/build-decision-context.ts";

// A valid mc_li cookie: URL-encoded compact JSON (m=matched, cn/cd/co = company*).
const MC_LI = "mc_li=" + encodeURIComponent(JSON.stringify({ m: true, cn: "Nakatomi BV", cd: "nakatomi.example", co: "NL" }));

describe("buildDecisionContext — cookieHeader param", () => {
  it("an explicit cookieHeader drives the mc_li leadinfo merge (the fix)", async () => {
    // Request carries NO Cookie header (mirrors the stripped synthetic Request);
    // the company still comes through via the explicit param.
    const req = new Request("http://tenant.example/", { headers: new Headers({ "user-agent": "test" }) });
    const ctx = await buildDecisionContext({ request: req, cookieHeader: MC_LI });
    assert.equal(ctx.enrichment?.leadinfoCompanyName, "Nakatomi BV");
    assert.equal(ctx.enrichment?.leadinfoCompanyDomain, "nakatomi.example");
    assert.equal(ctx.enrichment?.leadinfoCompanyCountry, "NL");
    assert.equal(ctx.enrichment?.leadinfoMatched, true);
  });

  it("with no cookie anywhere, no leadinfo fields appear", async () => {
    const req = new Request("http://tenant.example/", { headers: new Headers({ "user-agent": "test" }) });
    const ctx = await buildDecisionContext({ request: req });
    assert.equal(ctx.enrichment?.leadinfoCompanyName ?? null, null);
  });

  it("falls back to the request Cookie header when no param is given", async () => {
    // Genuine-Request callers (e.g. the snippet route's incoming request) keep working.
    const req = new Request("http://tenant.example/", { headers: new Headers({ cookie: MC_LI, "user-agent": "test" }) });
    const ctx = await buildDecisionContext({ request: req });
    assert.equal(ctx.enrichment?.leadinfoCompanyName, "Nakatomi BV");
  });
});
