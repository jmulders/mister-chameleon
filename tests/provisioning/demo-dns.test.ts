/**
 * Per-demo DNS step: the provisioner registers <slug>.demo.misterchameleon.nl on
 * Vercel and surfaces the one CNAME the operator must set at their DNS provider
 * (Strato has no wildcard). Fail-open on every Vercel failure — the rollout
 * still succeeds and a warning is set. Vercel calls are injected, so this is a
 * pure unit test.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { resolveDemoDnsStep, LEGACY_DEMO_CNAME } from "../../lib/provisioning/demo-dns.ts";
import { extractVercelCname } from "../../lib/vercel-cname.ts";

const HOST = "acme.demo.misterchameleon.nl";
const SLUG = "acme";
const VERCEL_CNAME = "b1a2c3d4e5f6.vercel-dns-017.com";

describe("resolveDemoDnsStep", () => {
  it("registers the FULL demo host on Vercel and returns Vercel's recommended CNAME", async () => {
    const added: string[] = [];
    const step = await resolveDemoDnsStep(HOST, SLUG, {
      isVercelConfigured: () => true,
      addVercelDomain: async (h) => { added.push(h); return { ok: true, alreadyVerified: false }; },
      getVercelRecommendedCname: async () => ({ ok: true, cname: VERCEL_CNAME }),
    });
    // addVercelDomain called with exactly <slug>.demo.misterchameleon.nl.
    assert.deepEqual(added, [HOST]);
    // Strato-CNAME hint: host <slug>.demo + the value pulled from Vercel.
    assert.equal(step.dnsHost, "acme.demo");
    assert.equal(step.dnsCnameValue, VERCEL_CNAME);
    assert.equal(step.dnsIsFallback, false);
    assert.ok(step.steps.some((s) => s.label.includes(HOST) && s.ok));
    assert.deepEqual(step.warnings, []);
  });

  it("is FAIL-OPEN when addVercelDomain errors: fallback CNAME, warning, no throw", async () => {
    const step = await resolveDemoDnsStep(HOST, SLUG, {
      isVercelConfigured: () => true,
      addVercelDomain: async () => ({ ok: false, error: "Vercel API error 500" }),
      getVercelRecommendedCname: async () => { throw new Error("must not be called"); },
    });
    // The rollout continues: a usable fallback hint + a warning, step marked not-ok.
    assert.equal(step.dnsHost, "acme.demo");
    assert.equal(step.dnsCnameValue, LEGACY_DEMO_CNAME);
    assert.equal(step.dnsIsFallback, true);
    assert.ok(step.steps.some((s) => s.label.includes(HOST) && !s.ok));
    assert.ok(step.warnings.some((w) => /Vercel domain add failed/.test(w)));
  });

  it("falls back when Vercel returns no recommended CNAME (domain add still ok)", async () => {
    const step = await resolveDemoDnsStep(HOST, SLUG, {
      isVercelConfigured: () => true,
      addVercelDomain: async () => ({ ok: true, alreadyVerified: true }),
      getVercelRecommendedCname: async () => ({ ok: true, cname: null }),
    });
    assert.equal(step.dnsCnameValue, LEGACY_DEMO_CNAME);
    assert.equal(step.dnsIsFallback, true);
    assert.ok(step.steps.some((s) => s.label.includes(HOST) && s.ok));
    assert.ok(step.warnings.some((w) => /recommended CNAME/.test(w)));
  });

  it("falls back (with a warning) when the config lookup errors", async () => {
    const step = await resolveDemoDnsStep(HOST, SLUG, {
      isVercelConfigured: () => true,
      addVercelDomain: async () => ({ ok: true, alreadyVerified: false }),
      getVercelRecommendedCname: async () => ({ ok: false, error: "boom" }),
    });
    assert.equal(step.dnsCnameValue, LEGACY_DEMO_CNAME);
    assert.equal(step.dnsIsFallback, true);
  });

  it("skips Vercel when unconfigured — still returns a usable fallback hint + warning", async () => {
    let called = false;
    const step = await resolveDemoDnsStep(HOST, SLUG, {
      isVercelConfigured: () => false,
      addVercelDomain: async () => { called = true; return { ok: true, alreadyVerified: true }; },
      getVercelRecommendedCname: async () => { called = true; return { ok: true, cname: VERCEL_CNAME }; },
    });
    assert.equal(called, false, "no Vercel calls when unconfigured");
    assert.equal(step.dnsHost, "acme.demo");
    assert.equal(step.dnsCnameValue, LEGACY_DEMO_CNAME);
    assert.equal(step.dnsIsFallback, true);
    assert.ok(step.warnings.some((w) => /not configured/i.test(w)));
  });
});

describe("extractVercelCname", () => {
  it("reads a bare-string recommendedCNAME", () => {
    assert.equal(extractVercelCname({ recommendedCNAME: "x1.vercel-dns-017.com" }), "x1.vercel-dns-017.com");
  });
  it("reads an array-of-{value} recommendedCNAME (first vercel-dns wins)", () => {
    assert.equal(
      extractVercelCname({ recommendedCNAME: [{ rank: 0, value: "x2.vercel-dns-9.com" }] }),
      "x2.vercel-dns-9.com",
    );
  });
  it("scans the payload as a last resort", () => {
    assert.equal(extractVercelCname({ cnames: ["y3.vercel-dns.com"] }), "y3.vercel-dns.com");
  });
  it("returns null when there is no vercel-dns hostname", () => {
    assert.equal(extractVercelCname({ misconfigured: true, acceptedChallenges: [] }), null);
  });
});
