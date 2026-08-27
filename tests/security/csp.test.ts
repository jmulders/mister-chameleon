/**
 * Content-Security-Policy builder.
 *
 * Locks the production allowances that must be present so an enforcing CSP does
 * not break Next fonts, inline scripts, GTM or Leadinfo — and that inline scripts
 * ride the nonce rather than a bare 'unsafe-inline'. Also locks the report-only
 * vs enforced header-name switch.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildContentSecurityPolicy, cspHeaderName, cspEnforced } from "../../lib/security/csp.ts";

/** Parse "a b; c d" into { a: "b", c: "d" }. */
function directives(csp: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of csp.split(";")) {
    const t = part.trim();
    if (!t) continue;
    const sp = t.indexOf(" ");
    if (sp === -1) { out[t] = ""; continue; }
    out[t.slice(0, sp)] = t.slice(sp + 1);
  }
  return out;
}

describe("buildContentSecurityPolicy", () => {
  const csp = buildContentSecurityPolicy({ nonce: "n0nce123", isDev: false });
  const d = directives(csp);

  it("font-src allows self (next/font) — not 'none'", () => {
    assert.match(d["font-src"], /'self'/);
    assert.doesNotMatch(csp, /font-src[^;]*'none'/);
  });

  it("prod script-src carries the nonce + self, GTM and Leadinfo CDNs, and no bare 'unsafe-inline'/'unsafe-eval'", () => {
    assert.match(d["script-src"], /'self'/);
    assert.match(d["script-src"], /'nonce-n0nce123'/);
    assert.match(d["script-src"], /https:\/\/www\.googletagmanager\.com/);
    assert.match(d["script-src"], /https:\/\/cdn\.leadinfo\.net/);
    assert.doesNotMatch(d["script-src"], /'unsafe-inline'/);
    assert.doesNotMatch(d["script-src"], /'unsafe-eval'/);
  });

  it("dev script-src relaxes to unsafe-inline + unsafe-eval (Turbopack HMR + React dev), no nonce", () => {
    const dev = directives(buildContentSecurityPolicy({ nonce: "x", isDev: true }));
    assert.match(dev["script-src"], /'unsafe-inline'/);
    assert.match(dev["script-src"], /'unsafe-eval'/);
    assert.doesNotMatch(dev["script-src"], /'nonce-/);
  });

  it("connect-src allows self, Leadinfo, GA/GTM and Supabase", () => {
    assert.match(d["connect-src"], /'self'/);
    assert.match(d["connect-src"], /https:\/\/\*\.leadinfo\.net/);
    assert.match(d["connect-src"], /https:\/\/api\.leadinfo\.com/);
    assert.match(d["connect-src"], /google-analytics\.com/);
    assert.match(d["connect-src"], /supabase/);
  });

  it("img-src allows self, data: and https (pixels + proxied images)", () => {
    assert.match(d["img-src"], /'self'/);
    assert.match(d["img-src"], /data:/);
    assert.match(d["img-src"], /https:/);
  });

  it("frame-src allows GTM (the noscript iframe)", () => {
    assert.match(d["frame-src"], /https:\/\/www\.googletagmanager\.com/);
  });

  it("locks down object-src and base-uri", () => {
    assert.equal(d["object-src"], "'none'");
    assert.equal(d["base-uri"], "'self'");
  });

  it("prod frame-ancestors allows the managed CP host; dev allows localhost:8000", () => {
    assert.match(d["frame-ancestors"], /'self'/);
    assert.match(d["frame-ancestors"], /https:\/\/\*\.ploi\.it/);
    const dev = directives(buildContentSecurityPolicy({ nonce: "x", isDev: true }));
    assert.match(dev["frame-ancestors"], /http:\/\/localhost:8000/);
  });

  it("adds upgrade-insecure-requests in prod, not in dev", () => {
    assert.ok("upgrade-insecure-requests" in d);
    const dev = directives(buildContentSecurityPolicy({ nonce: "x", isDev: true }));
    assert.ok(!("upgrade-insecure-requests" in dev));
  });
});

describe("CSP header mode switch", () => {
  it("defaults to report-only, enforces only when the flag is truthy", () => {
    const prev = process.env.CSP_ENFORCE;
    try {
      delete process.env.CSP_ENFORCE;
      assert.equal(cspEnforced(), false);
      assert.equal(cspHeaderName(), "Content-Security-Policy-Report-Only");

      process.env.CSP_ENFORCE = "true";
      assert.equal(cspEnforced(), true);
      assert.equal(cspHeaderName(), "Content-Security-Policy");

      process.env.CSP_ENFORCE = "0";
      assert.equal(cspEnforced(), false);
    } finally {
      if (prev === undefined) delete process.env.CSP_ENFORCE;
      else process.env.CSP_ENFORCE = prev;
    }
  });

  it("cspHeaderName honours an explicit argument", () => {
    assert.equal(cspHeaderName(true), "Content-Security-Policy");
    assert.equal(cspHeaderName(false), "Content-Security-Policy-Report-Only");
  });
});
