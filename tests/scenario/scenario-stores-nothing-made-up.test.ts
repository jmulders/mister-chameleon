/**
 * A page render under a Scenario Control preset stores nothing the preset made up.
 *
 * Found on production on 26 Nov 2026: `visitor_profiles` for tenant "statamic"
 * held two rows with company_name "Voorbeeld BV" and geo_region "Utrecht". Those
 * are the values of the tenant's preset "Bedrijf herkend". No such company
 * visited. Both pipelines handed the context AFTER the scenario override to
 * recordVisitorProfile, so the preset was stored as if it were a visitor. From
 * there it went round: the stored company is read back as known firmographics
 * on the next visit, written again, and its freshness stamp renewed, so it
 * never aged out. One of the rows had 81 visits.
 *
 * The panel says "No real user data modified". These tests hold that for the
 * stored profile and everything that hangs off that write (the lead credit,
 * the profile webhook, the hot-lead mail and the HubSpot sync), and for the
 * session row and the served-variant log of the homepage.
 *
 * The Supabase client is pointed at a stub host and `fetch` is stubbed, as in
 * tests/context/visitor-stored-context.test.ts. Every request that leaves is
 * recorded, whatever its host, so "nothing was sent" can be asserted.
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

process.env.NEXT_PUBLIC_SUPABASE_URL  = "http://supabase.stub.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "stub-service-role";

const origFetch = globalThis.fetch;

const TENANT  = "statamic";
const SESSION = "3f2c1b7a-9d4e-4c1a-8b0f-5a6d7e8f9a10";

/** The tenant's preset "Bedrijf herkend", as the panel writes it to the cookie. */
const PRESET = {
  _scenarioKey:       "bedrijf-herkend",
  companyName:        "Voorbeeld BV",
  region:             "Utrecht",
  audienceSegmentIds: "demo-bedrijf-herkend",
};

const cookie = (name: string, value: unknown) => `${name}=${encodeURIComponent(JSON.stringify(value))}`;
const FULL_CONSENT = cookie("mc_consent", { v: 1, a: true, p: true, e: true, ad: false });
const BASE_COOKIES = `mc_session_id=${SESSION}; ${FULL_CONSENT}`;
const withScenario = (overrides: unknown) => `${BASE_COOKIES}; ${cookie("mc_scenario", overrides)}`;

/** The context of the real visit: an anonymous visitor from Noord-Holland. */
const realContext = () => ({
  tenantId:           TENANT,
  source:             "direct",
  device:             "desktop",
  visitType:          "returning",
  isBot:              false,
  audienceSegmentIds: "",
  enrichment:         { countryCode: "NL", region: "Noord-Holland" },
  derived:            { funnelStage: "awareness" },
});

interface Sent { method: string; target: string; body: string }
const sent: Sent[] = [];

function respond(u: unknown, init?: RequestInit): Response {
  const url    = String(u);
  const table  = /\/rest\/v1\/([^?]+)/.exec(url)?.[1];
  const method = init?.method ?? "GET";
  sent.push({ method, target: table ?? new URL(url).host, body: typeof init?.body === "string" ? init.body : "" });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  // The profile as it was before this visit: seen before, nothing known.
  if (table === "visitor_profiles" && method === "GET") {
    return json([{ visit_count: 3, first_seen_at: "2026-11-01T10:00:00+00:00", identity_level: "anonymous", status: "visitor" }]);
  }
  return json([]);
}

const profileWrites = () => sent.filter((s) => s.target === "visitor_profiles" && s.method !== "GET");
const everythingSent = () => sent.map((s) => `${s.method} ${s.target} ${s.body}`).join("\n");

type RecorderMod = typeof import("../../lib/lead-base/record-visitor-profile.ts");
type ScenarioMod = typeof import("../../lib/scenario/server-scenario.ts");
type Ctx         = Parameters<RecorderMod["recordVisitorProfile"]>[0]["ctx"];
let recordVisitorProfile: RecorderMod["recordVisitorProfile"];
let scenario: ScenarioMod;

/**
 * The part of a pipeline run that matters here: the context is built from the
 * request, the scenario cookie is applied to it (pass 2), and what comes out is
 * handed to the recorder after the response, with the request's Cookie header.
 */
async function renderAndRecord(cookieHeader: string, raw: Record<string, unknown> = realContext()) {
  const overrides = scenario.parseScenarioCookie(cookieHeader);
  const input = overrides
    ? scenario.applyScenarioToDecisionContext(raw as never, overrides)
    : raw;
  await recordVisitorProfile({
    tenantId:     TENANT,
    visitorKey:   SESSION,
    cookieHeader,
    ctx:          input as unknown as Ctx,
    personalizationGroup: "personalized",
  });
}

describe("a scenario preset is not stored as a visitor", () => {
  before(async () => {
    globalThis.fetch = async (u: unknown, init?: RequestInit) => respond(u, init);
    ({ recordVisitorProfile } = await import("../../lib/lead-base/record-visitor-profile.ts"));
    scenario = await import("../../lib/scenario/server-scenario.ts");
  });

  after(() => { globalThis.fetch = origFetch; });

  beforeEach(() => { sent.length = 0; });

  it("stores the real visit when no scenario is active (the stub sees profile writes)", async () => {
    await renderAndRecord(BASE_COOKIES, {
      ...realContext(),
      enrichment: { countryCode: "NL", region: "Noord-Holland", companyName: "Echt Bedrijf BV" },
    });
    const writes = profileWrites();
    assert.equal(writes.length, 1, "one upsert of the profile");
    const row = JSON.parse(writes[0].body) as Record<string, unknown>;
    assert.equal(row.company_name, "Echt Bedrijf BV");
    assert.equal(row.geo_region, "Noord-Holland");
    assert.equal(row.identity_level, "recognised");
    assert.equal(row.visit_count, 4);
  });

  it("does not store the company name of a preset in the visitor profile", async () => {
    await renderAndRecord(withScenario(PRESET));
    assert.deepEqual(profileWrites(), [], "the profile must not be written while a scenario is active");
    const all = everythingSent();
    for (const madeUp of ["Voorbeeld BV", "Utrecht", "demo-bedrijf-herkend"]) {
      assert.ok(!all.includes(madeUp), `"${madeUp}" comes from the preset and must not leave the process:\n${all}`);
    }
  });

  it("sends nothing at all for that visit: no credit, no webhook, no mail, no HubSpot", async () => {
    // A preset that recognises a company moves the profile from anonymous to
    // recognised. That transition bills a lead credit, and a company on the
    // profile starts the HubSpot sync. None of it may start from a preset.
    await renderAndRecord(withScenario(PRESET));
    assert.deepEqual(sent, [], `nothing may be read or written:\n${everythingSent()}`);
  });

  it("also skips a preset that overrides no company at all", async () => {
    // The journey overrides are applied to the history BEFORE the context is
    // built (pass 1), so the pipeline has no context left that is free of
    // them: a preset "decision stage" would be stored as status sql and fire
    // the qualification webhook. Any scenario cookie skips the write.
    for (const overrides of [{ funnelStage: "decision", intentScore: 90 }, { _scenarioKey: "pricing_visitor" }, { bypass: true }]) {
      sent.length = 0;
      await renderAndRecord(withScenario(overrides));
      assert.deepEqual(sent, [], `written under ${JSON.stringify(overrides)}:\n${everythingSent()}`);
    }
  });

  it("stores the visit as usual when the scenario cookie is empty or unreadable", async () => {
    // parseScenarioCookie answers null for these, so the pipeline applies no
    // override and the context is the real one.
    for (const raw of ["mc_scenario=%7B%7D", "mc_scenario=kapot", "mc_scenario=%5B1%5D"]) {
      sent.length = 0;
      await renderAndRecord(`${BASE_COOKIES}; ${raw}`);
      assert.equal(profileWrites().length, 1, `no profile write with ${raw}`);
    }
  });
});

describe("the pipelines under a scenario", () => {
  const strip = (file: string) =>
    readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const homepage = strip("lib/pipeline/homepage-pipeline.ts");
  const cmsPage  = strip("lib/cms-page-decision.ts");
  const page     = strip("app/(site)/page.tsx");

  it("hand the request's Cookie header to the profile recorder, which is where the scenario is seen", () => {
    // The recorder reads the scenario cookie itself, next to the consent
    // cookie. A pipeline that passed null there would switch the rule off.
    for (const [name, code] of [["homepage-pipeline", homepage], ["cms-page-decision", cmsPage]] as const) {
      const calls = code.match(/recordVisitorProfile\(\{[^}]*\}\)/g) ?? [];
      assert.equal(calls.length, 1, `${name}: one call of recordVisitorProfile`);
      assert.match(calls[0], /\bcookieHeader,/, `${name}: the call must pass cookieHeader`);
      // The same header the pipeline applied the scenario from.
      assert.match(code, /scenarioOverrides = parseScenarioCookie\(cookieHeader\)/, `${name}: the scenario is parsed from that header`);
    }
  });

  it("do not write the session row or the served-variant log on the homepage", () => {
    // The session row stores source, device, visit type and UTM values, all of
    // which a preset overrides, and it is written once and never corrected.
    // The served-variant log would count a variant the preset forced.
    assert.match(homepage, /analyticsAllowed: consent\.analytics && consent\.personalization && !scenarioOverrides,/);
    // Both writes of the page hang on that one answer.
    assert.match(page, /const logAnalytics = isFeatureEnabled\(tenant, "analytics"\) && result\.analyticsAllowed;/);
    const guarded = /if \(logAnalytics\) \{([\s\S]*?)\n    \}\n/.exec(page)?.[1] ?? "";
    assert.match(guarded, /upsertSession\(/);
    assert.match(guarded, /logServedVariants\(/);
    assert.equal(page.match(/upsertSession\(/g)?.length, 1, "no session write outside the guard");
    assert.equal(page.match(/logServedVariants\(/g)?.length, 1, "no variant log outside the guard");
  });

  it("are the only callers of the profile recorder", () => {
    // A third caller must pass the Cookie header too. This fails when one is
    // added, so it gets looked at.
    const callers: string[] = [];
    for (const dir of ["app", "lib", "decision", "experience", "request", "context", "data"]) {
      for (const entry of readdirSync(dir, { recursive: true, encoding: "utf8" })) {
        if (!/\.tsx?$/.test(entry)) continue;
        const file = `${dir}/${entry}`;
        if (file === "lib/lead-base/record-visitor-profile.ts") continue;
        if (/recordVisitorProfile\(/.test(strip(file))) callers.push(file);
      }
    }
    assert.deepEqual(callers.sort(), ["lib/cms-page-decision.ts", "lib/pipeline/homepage-pipeline.ts"]);
  });
});
