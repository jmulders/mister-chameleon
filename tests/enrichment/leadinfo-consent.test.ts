/**
 * Leadinfo waits for the visitor's consent.
 *
 * Found on 21 Nov 2026: a tenant with Leadinfo on loaded Leadinfo's script
 * for every visitor, and the route that stores a recognised company set the
 * mc_li cookie and charged the lookup whatever the visitor had chosen. Only
 * the write to the shared cache looked at consent. Recognising the company
 * behind a visit is what the enrichment category asks permission for.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { leadinfoAllowed } from "../../lib/enrichment/leadinfo-consent.ts";

const consent = (payload: Record<string, unknown>) => `mc_consent=${encodeURIComponent(JSON.stringify(payload))}`;

describe("leadinfoAllowed", () => {
  it("says no without a consent cookie", () => {
    assert.equal(leadinfoAllowed(null), false);
    assert.equal(leadinfoAllowed(""), false);
    assert.equal(leadinfoAllowed("mc_ws=abc; mc_tz=Europe%2FAmsterdam"), false);
  });

  it("says no when the visitor refused everything", () => {
    assert.equal(leadinfoAllowed(consent({ v: 1, a: false, p: false, e: false, ad: false })), false);
  });

  it("says no when the visitor allowed other categories but not enrichment", () => {
    assert.equal(leadinfoAllowed(consent({ v: 1, a: true, p: true, e: false, ad: true })), false);
  });

  it("says yes when the visitor allowed enrichment", () => {
    assert.equal(leadinfoAllowed(consent({ v: 1, a: false, p: false, e: true, ad: false })), true);
    assert.equal(leadinfoAllowed(`mc_ws=abc; ${consent({ v: 1, a: true, p: true, e: true, ad: true })}; mc_tz=x`), true);
  });

  it("says no for a cookie it cannot read", () => {
    assert.equal(leadinfoAllowed("mc_consent=kapot"), false);
    assert.equal(leadinfoAllowed(consent({ v: 2, e: true })), false);
    assert.equal(leadinfoAllowed(consent({ v: 1, e: "true" })), false);
  });
});

describe("the route keeps nothing without consent", () => {
  const route = readFileSync("app/api/enrichment/leadinfo/route.ts", "utf8");
  const code = route.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const post = code.slice(code.indexOf("export async function POST"));

  it("checks consent before it charges, sets the cookie or writes the cache", () => {
    const gate = post.indexOf('if (!leadinfoAllowed(request.headers.get("cookie")))');
    assert.ok(gate > 0, "the consent check is missing");
    for (const later of ["debitWallet(", "trackUsageEvent(", "response.cookies.set(LEADINFO_COOKIE", "ipCompanyCache.set("]) {
      const at = post.indexOf(later);
      assert.ok(at > gate, `${later} must come after the consent check`);
    }
  });

  it("answers without a cookie when consent is missing", () => {
    assert.match(post, /if \(!leadinfoAllowed\(request\.headers\.get\("cookie"\)\)\) \{\s*return NextResponse\.json\(\{ ok: true, stored: false, reason: "no-consent" \}\);\s*\}/);
  });

  it("exports nothing but the handlers, as a route file must", () => {
    const exported = [...route.matchAll(/^export (?:async )?(?:function|const) (\w+)/gm)].map((m) => m[1]);
    assert.deepEqual(exported.sort(), ["DELETE", "POST"]);
  });
});

describe("the browser does not load Leadinfo without consent", () => {
  const source = readFileSync("components/tracking/LeadinfoProvider.tsx", "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("injects the script only from the function that needs consent to be called", () => {
    const load = code.indexOf("function loadLeadinfo(");
    const inject = code.indexOf('"https://cdn.leadinfo.net/ping.js"');
    assert.ok(load > 0 && inject > load, "ping.js must be injected inside loadLeadinfo");
    assert.equal(code.match(/loadLeadinfo\(siteToken\)/g)?.length, 1, "one place starts Leadinfo");
    const effect = code.slice(code.indexOf("export function LeadinfoProvider"), load);
    assert.match(effect, /if \(hasConsent\("enrichment"\)\) \{\s*start\(\);/);
    assert.match(effect, /onConsentChange\(\(state\) => \{\s*if \(state\.enrichment\) start\(\);\s*\}\)/);
  });

  it("posts no company for a visitor who withdrew consent", () => {
    const handler = code.slice(code.indexOf("function handleDataLayerEntry"));
    const check = handler.indexOf('if (!hasConsent("enrichment")) return;');
    const post = handler.indexOf('fetch("/api/enrichment/leadinfo"');
    assert.ok(check > 0 && post > check);
  });
});

describe("the cookie list tells the same story", () => {
  it("lists mc_li under enrichment", () => {
    const registry = readFileSync("tracking/cookie-registry.ts", "utf8");
    assert.match(registry, /name: "mc_li",[^}]*category: "enrichment"/);
  });
});
