/**
 * A Scenario Control preset changes only the fields it overrides, and an inner
 * page starts from the same enrichment as the homepage.
 *
 * Seen on production on 26 Nov 2026, tenant "statamic". One visitor, recognised
 * as a company in Veenendaal. /engine-debug (the homepage pipeline) showed
 * `city Veenendaal`, served from the session enrichment cache: the company row
 * in ip_company_cache carries the company's city and the staged pipeline writes
 * it to `city`. With a preset active that overrides no geo field at all, the
 * token `{{location|je regio}}` on /kennisbank rendered "Nijmegen", the city
 * IP geolocation gives for that connection (the Vercel header).
 *
 * The preset was not the cause. The inner-page pipeline (lib/cms-page-decision)
 * runs no enrichment chain, and buildDecisionContext read the session cache
 * only for a caller that passes a chain. So every inner page had CDN header geo
 * and nothing else, with or without a scenario cookie, and the same visitor was
 * told two different towns in one visit. The preset only made someone look.
 *
 * What is held here:
 *   1. An inner page serves what the homepage's pipeline cached for the
 *      session, so both name the same city.
 *   2. On both pages the enrichment under a preset is the enrichment of the
 *      same request without it, except for the fields the preset overrides.
 *   3. The reuse is read-only: no stage runs, nothing is written, and it is
 *      off without the consent that lets the pipeline run.
 *
 * The Supabase client is pointed at a stub host and `fetch` is stubbed, as in
 * tests/decision/context-cache-hit-shape.test.ts. Every request is recorded so
 * "nothing was written" can be asserted. Both pipelines pull in the whole
 * request stack, which this runner cannot load, so `contextFor` repeats their
 * three steps (pass 1, build, pass 2) and the last block reads their source to
 * hold that repetition to what they really do.
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

process.env.NEXT_PUBLIC_SUPABASE_URL          = "http://supabase.stub.test";
process.env.SUPABASE_SERVICE_ROLE_KEY         = "stub-service-role";
process.env.SESSION_CACHE_TTL_SECONDS         = "3600";
process.env.SESSION_CACHE_STALE_GRACE_SECONDS = "3600";

type BuildMod    = typeof import("../../decision/context/build-decision-context.ts");
type CacheMod    = typeof import("../../enrichment/session-enrichment-cache.ts");
type ScenarioMod = typeof import("../../lib/scenario/server-scenario.ts");
type TokensMod   = typeof import("../../lib/tokens/parse-tokens.ts");
type HistoryMod  = typeof import("../../context/visitor-history.ts");
type StagedEnricher = import("../../enrichment/types.ts").StagedEnricher;

let build:    BuildMod["buildDecisionContext"];
let cache:    CacheMod;
let scenario: ScenarioMod;
let tokens:   TokensMod;
let emptyHistory: HistoryMod["emptyHistory"];

const origFetch = globalThis.fetch;

const TENANT = "statamic";
const IP     = "203.0.113.24";

/** What IP geolocation says about this connection (the Vercel headers). */
const IP_GEO_CITY = "Nijmegen";
/** Where the recognised company is, as its row in ip_company_cache has it. */
const COMPANY_CITY = "Veenendaal";

/**
 * What the staged pipeline stored for this session when the homepage ran it:
 * header geo first, then the first-party company row on top, city included.
 */
const CACHED_BY_THE_HOMEPAGE = {
  countryCode:            "NL",
  region:                 "GE",
  city:                   COMPANY_CITY,
  companyName:            "Voorbeeld Uitzendgroep B.V.",
  companyDomain:          "voorbeeld-uitzendgroep.example",
  companyIndustry:        "Employment activities",
  companyMatchSource:     "firstparty",
  companyMatchConfidence: 0.9,
};

/** The preset of the report: no geo field, no enrichment field at all. */
const PRESET_WITHOUT_GEO = {
  _scenarioKey:       "demo-bedrijf-herkend",
  source:             "direct",
  visitType:          "new",
  audienceSegmentIds: "demo-bedrijf-herkend",
  funnelStage:        "consideration",
  intentScore:        55,
  hasVisitedPricing:  true,
  pageViewCount:      4,
};

const scenarioCookie = (overrides: unknown) =>
  `mc_scenario=${encodeURIComponent(JSON.stringify(overrides))}`;

interface Sent { method: string; table: string }
const sent: Sent[] = [];
const writes = () => sent.filter((s) => s.method !== "GET");
const cacheRequests = () => sent.filter((s) => s.table === "session_enrichment_cache");

let seq = 0;
const newSession = () => `sess-scenario-city-${++seq}`;

/** A session the homepage's pipeline has already enriched. */
function enrichedSession(): string {
  const sessionId = newSession();
  cache.setSessionEnrichment(sessionId, CACHED_BY_THE_HOMEPAGE, IP, TENANT);
  return sessionId;
}

function request(path: string): Request {
  return new Request(`http://www.tenant.example${path}`, {
    headers: new Headers({
      "user-agent":                 "test",
      "x-forwarded-for":            IP,
      "x-vercel-ip-country":        "NL",
      "x-vercel-ip-country-region": "GE",
      "x-vercel-ip-city":           IP_GEO_CITY,
    }),
  });
}

/** A chain that must not run: these tests are about sessions already enriched. */
function chain(): StagedEnricher & { calls: number } {
  const stage = {
    label: "Spy Stage",
    calls: 0,
    enricher: async () => { stage.calls++; return { city: "THE-CHAIN-RAN" }; },
  };
  return stage as unknown as StagedEnricher & { calls: number };
}

type Page = "homepage" | "inner";

/**
 * The decision context of one request, built the way the two pipelines build
 * it: pass 1 on the history, buildDecisionContext, pass 2 on the result.
 * `enrichmentConsent` is the answer of `consent.enrichment && consent.personalization`.
 */
async function contextFor(
  page:         Page,
  sessionId:    string,
  cookieHeader: string | null,
  opts: { enrichmentConsent?: boolean; stage?: StagedEnricher } = {},
) {
  const overrides = scenario.parseScenarioCookie(cookieHeader);
  const history   = overrides
    ? scenario.applyScenarioToHistory(emptyHistory(), overrides)
    : emptyHistory();

  const raw = page === "homepage"
    ? await build({
        request:      request("/"),
        cookieHeader,
        history,
        tenantId:     TENANT,
        templateKey:  "homepage",
        pageType:     "homepage",
        sessionId,
        stagedEnrichers:           [opts.stage ?? chain()],
        deferSlowEnrichmentOnMiss: true,
        scheduleBackgroundWork:    () => { /* not under test */ },
      })
    : await build({
        request:      request("/kennisbank"),
        cookieHeader,
        history,
        tenantId:     TENANT,
        templateKey:  "kennisbank",
        pageType:     "cms_page",
        sessionId,
        reuseSessionEnrichment: opts.enrichmentConsent ?? true,
      });

  return overrides ? scenario.applyScenarioToDecisionContext(raw, overrides) : raw;
}

const location = (ctx: Awaited<ReturnType<typeof contextFor>>) =>
  tokens.parseTokens("{{location|je regio}}", tokens.buildTokenContextFromInput(ctx));

describe("a recognised visitor is told one city, on the homepage and on an inner page", () => {
  before(async () => {
    globalThis.fetch = async (u: unknown, init?: RequestInit) => {
      const table = /\/rest\/v1\/([^?]+)/.exec(String(u))?.[1] ?? new URL(String(u)).host;
      sent.push({ method: init?.method ?? "GET", table });
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    };
    ({ buildDecisionContext: build } = await import("../../decision/context/build-decision-context.ts"));
    cache    = await import("../../enrichment/session-enrichment-cache.ts");
    scenario = await import("../../lib/scenario/server-scenario.ts");
    tokens   = await import("../../lib/tokens/parse-tokens.ts");
    ({ emptyHistory } = await import("../../context/visitor-history.ts"));
  });

  after(() => { globalThis.fetch = origFetch; });

  // setSessionEnrichment writes the shared row without waiting for it. Let that
  // settle, so a write counted in a test is one the request under test made.
  const settle = () => new Promise((r) => setTimeout(r, 5));

  beforeEach(() => { sent.length = 0; });

  it("the homepage names the company's city (the reference: what /engine-debug showed)", async () => {
    const stage = chain();
    const home  = await contextFor("homepage", enrichedSession(), null, { stage });
    assert.equal(home.enrichment?.city, COMPANY_CITY);
    assert.equal(location(home), COMPANY_CITY);
    assert.equal(stage.calls, 0, "served from the session cache");
  });

  it("an inner page names that same city, not the city of the IP address", async () => {
    const sessionId = enrichedSession();
    const home  = await contextFor("homepage", sessionId, null);
    const inner = await contextFor("inner",    sessionId, null);
    assert.equal(inner.enrichment?.city, home.enrichment?.city);
    assert.equal(location(inner), COMPANY_CITY, `{{location}} on the inner page must not fall back to "${IP_GEO_CITY}"`);
    // Not the city alone: the page starts from everything the pipeline stored.
    assert.deepEqual(inner.enrichment, home.enrichment);
  });

  it("the reported case: a preset without any geo field on an inner page keeps the city", async () => {
    const sessionId    = enrichedSession();
    const withoutPreset = await contextFor("homepage", sessionId, null);
    const underPreset   = await contextFor("inner", sessionId, scenarioCookie(PRESET_WITHOUT_GEO));
    assert.equal(underPreset.enrichment?.city, withoutPreset.enrichment?.city);
    assert.equal(location(underPreset), COMPANY_CITY);
  });

  for (const page of ["homepage", "inner"] as const) {
    it(`${page}: a preset leaves every enrichment field it does not override as it was`, async () => {
      const sessionId = enrichedSession();
      const plain  = await contextFor(page, sessionId, null);
      const preset = await contextFor(page, sessionId, scenarioCookie(PRESET_WITHOUT_GEO));

      assert.deepEqual(preset.enrichment, plain.enrichment);
      assert.equal(preset.enrichment?.city, COMPANY_CITY);

      // And it did override what it says it overrides.
      assert.equal(preset.source, "direct");
      assert.equal(preset.visitType, "new");
      assert.equal(preset.audienceSegmentIds, "demo-bedrijf-herkend");
      assert.equal(preset.history?.journey?.funnelStage, "consideration");
      assert.equal(preset.history?.pageViewCount, 4);
    });

    it(`${page}: a preset that sets a city changes the city and nothing else in the enrichment`, async () => {
      const sessionId = enrichedSession();
      const plain  = await contextFor(page, sessionId, null);
      const preset = await contextFor(page, sessionId, scenarioCookie({ ...PRESET_WITHOUT_GEO, city: "Utrecht" }));

      assert.equal(preset.enrichment?.city, "Utrecht");
      assert.equal(location(preset), "Utrecht");
      assert.deepEqual({ ...preset.enrichment, city: null }, { ...plain.enrichment, city: null });
      assert.equal(preset.enrichment?.companyName, CACHED_BY_THE_HOMEPAGE.companyName);
    });
  }

  it("an inner page reads the entry and does nothing else: no stage, no write", async () => {
    const sessionId = enrichedSession();
    await settle();
    sent.length = 0;

    for (const cookieHeader of [null, scenarioCookie(PRESET_WITHOUT_GEO)]) {
      const ctx = await contextFor("inner", sessionId, cookieHeader);
      assert.equal(ctx.enrichment?.city, COMPANY_CITY);
    }
    await settle();
    assert.deepEqual(writes(), [], "serving a cached entry must not write anything");
    assert.deepEqual(cacheRequests(), [], "the entry is in this process: no read of the shared row either");
  });

  it("a session no pipeline has enriched keeps header geo on an inner page, and nothing is stored for it", async () => {
    // A visitor who landed on an inner page. There is no entry, and this
    // pipeline runs no chain that could make one.
    const sessionId = newSession();
    const ctx = await contextFor("inner", sessionId, null);
    assert.equal(ctx.enrichment?.city, IP_GEO_CITY);
    await settle();
    assert.deepEqual(writes(), [], "a miss must not store an entry");
    assert.deepEqual(cacheRequests(), [{ method: "GET", table: "session_enrichment_cache" }], "one look at the shared row");
    assert.equal((await cache.getSessionEnrichment(sessionId, IP, TENANT)).hit, false);
  });

  it("without consent the inner page does not look at the entry at all", async () => {
    // consent.enrichment is what lets the pipeline run and store the entry.
    // After it is withdrawn the entry may still exist, and must not be served.
    const sessionId = enrichedSession();
    await settle();
    sent.length = 0;
    const ctx = await contextFor("inner", sessionId, null, { enrichmentConsent: false });
    assert.equal(ctx.enrichment?.city, IP_GEO_CITY);
    assert.equal(ctx.enrichment?.companyName ?? null, null);
    assert.deepEqual(cacheRequests(), []);
  });

  it("an entry of another connection is not served on an inner page", async () => {
    // Same invalidation as on the homepage: the visitor changed networks, so
    // the company and the city of the old connection say nothing about this one.
    const sessionId = newSession();
    cache.setSessionEnrichment(sessionId, CACHED_BY_THE_HOMEPAGE, "198.51.100.77", TENANT);
    const ctx = await contextFor("inner", sessionId, null);
    assert.equal(ctx.enrichment?.city, IP_GEO_CITY);
    assert.equal(ctx.enrichment?.companyName ?? null, null);
  });
});

describe("the pipelines build the context the same way with and without a scenario", () => {
  const strip = (file: string) =>
    readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const buildCall = (code: string) => {
    const calls = code.match(/await buildDecisionContext\(\{[\s\S]*?\n\s*\}\);/g) ?? [];
    assert.equal(calls.length, 1, "one call of buildDecisionContext");
    return calls[0];
  };
  const homepage = buildCall(strip("lib/pipeline/homepage-pipeline.ts"));
  const cmsPage  = buildCall(strip("lib/cms-page-decision.ts"));

  it("the inner-page pipeline reuses the session's enrichment, under the homepage's consent", () => {
    assert.match(cmsPage, /\breuseSessionEnrichment: consent\.enrichment && consent\.personalization,/);
    assert.match(cmsPage, /\bsessionId,/, "the reuse is keyed on the session id");
    // It stays a pipeline without an enrichment chain: no stage, no billing.
    assert.doesNotMatch(cmsPage, /stagedEnrichers|billingClient/);
  });

  it("neither pipeline lets the scenario cookie decide what enrichment the context starts from", () => {
    // The history (pass 1) is the one argument a scenario may change. A second
    // one, say a session id or a chain that depends on the cookie, would give
    // a preset another city, company or weather than the request really has.
    for (const [name, call] of [["homepage-pipeline", homepage], ["cms-page-decision", cmsPage]] as const) {
      assert.doesNotMatch(call, /scenario/i, `${name}: buildDecisionContext must not take a scenario-dependent argument`);
    }
    assert.match(homepage, /\bhistory:\s+effectiveHistory,/);
    assert.match(cmsPage,  /\bhistory,/);
  });
});
