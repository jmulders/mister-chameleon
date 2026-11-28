/**
 * The code, the cookie registry and the cookie page tell one story.
 *
 * ─── What went wrong ─────────────────────────────────────────────────────────
 *
 *   The site tells visitors that nothing is remembered about them without
 *   their consent. Three cookies did not follow that:
 *
 *   mc_attr        campaign and referrer, 30 days. Set for every visitor, and
 *                  missing from the cookie page.
 *   mc_lead        the lead behind a personal link, 30 days. Listed under
 *                  "personalization", but set and read for every visitor.
 *   mc_session_id  listed as "strictly necessary, 1 year", while the proxy only
 *                  sets it with personalization consent, for 30 days. And the
 *                  ?lang= redirect set it without looking at consent at all.
 *
 * ─── The rule these tests pin ────────────────────────────────────────────────
 *
 *   The campaign of the request itself is always used. Nothing is stored.
 *   Cookies that remember a visitor across visits (mc_session_id, mc_seen,
 *   mc_attr, mc_lead) are written and read only with personalization consent.
 *   The registry lists each cookie in the category the code enforces, with the
 *   lifetime the code sets.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  resolveAttribution,
  serializeAttribution,
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE,
} from "@/context/attribution";
import { detectVisitorContext } from "@/context/detect-context";
import {
  resolveSession,
  SESSION_COOKIE,
  SEEN_COOKIE,
  WEB_SESSION_COOKIE,
  SESSION_MAX_AGE,
  SEEN_MAX_AGE,
  WEB_SESSION_MAX_AGE,
} from "@/data/session";
import {
  planVisitorCookies,
  PERSONALIZATION_GATED_COOKIES,
} from "@/lib/consent/visitor-cookies";
import {
  LEAD_COOKIE,
  LEAD_COOKIE_MAX_AGE,
  leadCookieAllowed,
  readLeadCookie,
} from "@/lib/abm/lead-cookie";
import { resolveConsent } from "@/lib/consent/server-consent";
import { DEFAULT_CONSENT, ESSENTIAL_CONSENT, FULL_CONSENT } from "@/tracking/consent-types";
import { COOKIE_REGISTRY, cookiesForCategory } from "@/tracking/cookie-registry";

// ── Helpers ───────────────────────────────────────────────────────────────────

const consentCookie = (personalization: boolean) =>
  `mc_consent=${encodeURIComponent(JSON.stringify({ v: 1, a: true, p: personalization, e: true, ad: true }))}`;

const WITH    = consentCookie(true);
const REFUSED = consentCookie(false);

const storedAttr = `${ATTRIBUTION_COOKIE}=${serializeAttribution({ utmSource: "linkedin", utmCampaign: "spring", referrerDomain: "linkedin.com" })}`;

function request(url: string, cookie?: string, referer?: string): Request {
  const headers = new Headers();
  if (cookie)  headers.set("cookie", cookie);
  if (referer) headers.set("referer", referer);
  return new Request(url, { headers });
}

const read = (file: string) => readFileSync(file, "utf8");

// ── mc_attr: the write ────────────────────────────────────────────────────────

describe("mc_attr — written only with personalization consent", () => {
  const campaignUrl = "https://tenant.example/?utm_source=google&utm_campaign=launch";

  it("no consent cookie: the campaign is used for this request, nothing is stored", () => {
    const r = resolveAttribution(request(campaignUrl));
    assert.equal(r.data.utmSource, "google");
    assert.equal(r.data.utmCampaign, "launch");
    assert.equal(r.shouldSetCookie, false);
    assert.equal(r.serialized, null);
  });

  it("personalization refused: nothing is stored, also when other categories are allowed", () => {
    const r = resolveAttribution(request(campaignUrl, REFUSED));
    assert.equal(r.data.utmSource, "google");
    assert.equal(r.shouldSetCookie, false);
    assert.equal(r.serialized, null);
  });

  it("an external referrer alone is not stored without consent", () => {
    const r = resolveAttribution(request("https://tenant.example/", undefined, "https://www.linkedin.com/feed"));
    assert.equal(r.data.referrerDomain, "linkedin.com");
    assert.equal(r.shouldSetCookie, false);
  });

  it("with consent the cookie is written as before", () => {
    const r = resolveAttribution(request(campaignUrl, WITH));
    assert.equal(r.shouldSetCookie, true);
    assert.ok(r.serialized && r.serialized.length > 0);
  });
});

// ── mc_attr: the read ─────────────────────────────────────────────────────────

describe("mc_attr — read only with personalization consent", () => {
  it("a stored cookie is ignored once consent is gone", () => {
    for (const cookie of [storedAttr, `${storedAttr}; ${REFUSED}`]) {
      const r = resolveAttribution(request("https://tenant.example/pricing", cookie));
      assert.deepEqual(r.data, {});
      assert.equal(r.shouldSetCookie, false);
    }
  });

  it("with consent the stored campaign carries over to the next page", () => {
    const r = resolveAttribution(request("https://tenant.example/pricing", `${storedAttr}; ${WITH}`));
    assert.equal(r.data.utmSource, "linkedin");
    assert.equal(r.data.utmCampaign, "spring");
  });

  it("the decision context follows the same rule", () => {
    const without = detectVisitorContext(request("https://tenant.example/pricing", storedAttr));
    assert.equal(without.utmSource, null);
    assert.equal(without.utmCampaign, null);
    assert.equal(without.referrerDomain, null);

    const withConsent = detectVisitorContext(request("https://tenant.example/pricing", `${storedAttr}; ${WITH}`));
    assert.equal(withConsent.utmSource, "linkedin");
    assert.equal(withConsent.referrerDomain, "linkedin.com");
  });

  it("the campaign in the URL still reaches the decision context without consent", () => {
    const ctx = detectVisitorContext(request("https://tenant.example/?utm_source=google&utm_medium=cpc", storedAttr));
    assert.equal(ctx.utmSource, "google");
    assert.equal(ctx.utmMedium, "cpc");
    assert.equal(ctx.source, "google");
  });
});

// ── The proxy's cookie plan ───────────────────────────────────────────────────

describe("planVisitorCookies — what a page response may carry", () => {
  const campaignUrl = "https://tenant.example/?utm_source=google";

  function plan(cookieHeader: string | null) {
    return planVisitorCookies({
      session:     resolveSession(cookieHeader),
      attribution: resolveAttribution(request(campaignUrl, cookieHeader ?? undefined)),
      consent:     resolveConsent(cookieHeader),
      cookieHeader,
      secure:      true,
    });
  }
  const names = (p: ReturnType<typeof plan>) => p.set.map((c) => c.name).sort();

  it("a first visit without consent gets the web session cookie and nothing else", () => {
    assert.deepEqual(names(plan(null)), [WEB_SESSION_COOKIE]);
    assert.deepEqual(names(plan(REFUSED)), [WEB_SESSION_COOKIE]);
  });

  it("with consent the visitor key, the seen marker and the attribution are set too", () => {
    const p = plan(WITH);
    assert.deepEqual(names(p), [ATTRIBUTION_COOKIE, SEEN_COOKIE, SESSION_COOKIE, WEB_SESSION_COOKIE].sort());

    const attr = p.set.find((c) => c.name === ATTRIBUTION_COOKIE)!;
    assert.equal(attr.maxAge, ATTRIBUTION_MAX_AGE);
    assert.equal(attr.httpOnly, true);
    assert.equal(attr.secure, true);
    assert.deepEqual(p.expire, []);
  });

  it("without consent a stored mc_attr and mc_lead are removed", () => {
    const p = plan(`${storedAttr}; ${LEAD_COOKIE}=lead-1; ${REFUSED}`);
    assert.deepEqual([...p.expire].sort(), [ATTRIBUTION_COOKIE, LEAD_COOKIE].sort());
  });

  it("nothing is removed that the browser does not hold", () => {
    assert.deepEqual(plan(REFUSED).expire, []);
  });

  it("with consent a stored mc_attr and mc_lead stay", () => {
    assert.deepEqual(plan(`${storedAttr}; ${LEAD_COOKIE}=lead-1; ${WITH}`).expire, []);
  });

  it("the proxy sets visitor cookies through the plan only, on both responses", () => {
    const source = read("proxy.ts");
    // The page response and the ?lang= redirect.
    assert.equal(source.match(/applyVisitorCookies\((?:response|redirectResponse)\)/g)?.length, 2);
    // No second loop over the raw session cookies, and no attribution write of its own.
    assert.doesNotMatch(source, /of session\.cookiesToSet/);
    assert.doesNotMatch(source, /ATTRIBUTION_COOKIE/);
  });
});

// ── mc_lead ───────────────────────────────────────────────────────────────────

describe("mc_lead — written and read only with personalization consent", () => {
  it("is allowed with personalization consent only", () => {
    assert.equal(leadCookieAllowed(FULL_CONSENT), true);
    assert.equal(leadCookieAllowed(DEFAULT_CONSENT), false);
    assert.equal(leadCookieAllowed(ESSENTIAL_CONSENT), false);
    assert.equal(leadCookieAllowed({ ...FULL_CONSENT, personalization: false }), false);
    assert.equal(leadCookieAllowed(null), false);
  });

  it("a reader gets the lead id with consent and nothing without", () => {
    assert.equal(readLeadCookie("lead-1", FULL_CONSENT), "lead-1");
    assert.equal(readLeadCookie("lead-1", DEFAULT_CONSENT), undefined);
    assert.equal(readLeadCookie("lead-1", { ...FULL_CONSENT, personalization: false }), undefined);
    assert.equal(readLeadCookie(undefined, FULL_CONSENT), undefined);
    assert.equal(readLeadCookie("", FULL_CONSENT), undefined);
  });

  it("/go/{token} sets the cookie inside the consent check", () => {
    const source = read("app/go/[token]/route.ts");
    const gate   = source.indexOf("if (leadCookieAllowed(resolveConsent(req.headers.get(\"cookie\"))))");
    const write  = source.indexOf("res.cookies.set(LEAD_COOKIE");
    assert.ok(gate > -1, "the consent check is gone");
    assert.ok(write > gate, "the cookie is set before the consent check");
    assert.equal(source.match(/cookies\.set\(/g)?.length, 1, "a second cookie write appeared");
  });

  it("every reader goes through readLeadCookie", () => {
    const readers = [
      "lib/pipeline/homepage-pipeline.ts",
      "lib/cms-page-decision.ts",
      "app/api/abm/known-lead/route.ts",
      "app/api/forms/prefill/route.ts",
      "components/blocks/AbmKnownLeadDebugBadge.tsx",
    ];
    for (const file of readers) {
      const source = read(file);
      assert.match(source, /readLeadCookie\(/, `${file} reads mc_lead without the consent check`);
      assert.doesNotMatch(source, /get\(["']mc_lead["']\)/, `${file} reads the cookie directly`);
      assert.doesNotMatch(source, /startsWith\(["']mc_lead=/, `${file} reads the cookie directly`);
    }
  });
});

// ── The registry says what the code does ──────────────────────────────────────

describe("cookie registry — the same story as the code", () => {
  const SECONDS: Record<string, number> = {
    "30 minutes": 30 * 60,
    "7 days":     7 * 24 * 60 * 60,
    "30 days":    30 * 24 * 60 * 60,
    "1 year":     365 * 24 * 60 * 60,
  };
  const row = (name: string) => {
    const found = COOKIE_REGISTRY.find((c) => c.name === name);
    assert.ok(found, `${name} is missing from the cookie registry`);
    return found;
  };

  it("lists every cookie the proxy can set", () => {
    const fromSession = resolveSession(null).cookiesToSet.map((c) => c.name);
    for (const name of [...fromSession, ATTRIBUTION_COOKIE, LEAD_COOKIE]) row(name);
  });

  it("puts every consent-gated cookie under personalization", () => {
    for (const name of [...PERSONALIZATION_GATED_COOKIES, LEAD_COOKIE]) {
      assert.equal(row(name).category, "personalization", `${name} is gated on personalization in the code`);
    }
  });

  it("calls only the web session cookie strictly necessary, of the cookies the proxy sets", () => {
    const plan = planVisitorCookies({
      session:      resolveSession(null),
      attribution:  resolveAttribution(request("https://tenant.example/?utm_source=google")),
      consent:      DEFAULT_CONSENT,
      cookieHeader: null,
      secure:       true,
    });
    for (const spec of plan.set) {
      assert.equal(row(spec.name).category, "essential", `${spec.name} is set without consent`);
    }
    assert.equal(row(SESSION_COOKIE).category === "essential", false);
  });

  it("states the lifetime the code sets", () => {
    const lifetimes: Array<[string, number]> = [
      [WEB_SESSION_COOKIE, WEB_SESSION_MAX_AGE],
      [SESSION_COOKIE,     SESSION_MAX_AGE],
      [SEEN_COOKIE,        SEEN_MAX_AGE],
      [ATTRIBUTION_COOKIE, ATTRIBUTION_MAX_AGE],
      [LEAD_COOKIE,        LEAD_COOKIE_MAX_AGE],
    ];
    for (const [name, maxAge] of lifetimes) {
      assert.equal(SECONDS[row(name).expiry], maxAge, `${name}: the registry says "${row(name).expiry}"`);
    }
  });

  it("marks the server-only cookies as HttpOnly", () => {
    for (const name of [WEB_SESSION_COOKIE, SESSION_COOKIE, SEEN_COOKIE, ATTRIBUTION_COOKIE, LEAD_COOKIE]) {
      assert.equal(row(name).httpOnly, true, `${name} is set httpOnly`);
    }
  });

  it("has every lifetime in Dutch on the cookie page", () => {
    const english = new Set(COOKIE_REGISTRY.map((c) => c.expiry));
    for (const category of ["essential", "personalization", "enrichment", "analytics"] as const) {
      for (const cookie of cookiesForCategory(category, "nl")) {
        assert.equal(english.has(cookie.expiry), false, `${cookie.name}: "${cookie.expiry}" has no Dutch label`);
        assert.ok(cookie.purpose.length > 0);
      }
    }
  });
});
