/**
 * BAG per-address enricher (D5 Fase 1): the pure parser, the classified fetch, and
 * the lazy-cache enricher (form-address path, key-gated, fail-open).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseBagAddress, fetchBagAddress } from "../../lib/enrichment/bag-ingest.ts";
import { createBagLocationEnricher } from "../../enrichment/providers/bag-location.ts";
import { formLocationFromValues, serializeFormLocation, parseFormLocationCookie } from "../../context/form-location-context.ts";
import type { EnricherInput, EnrichmentOutput } from "../../enrichment/types.ts";

const input = (fl?: { postcode: string | null; place: string | null; houseNumber?: string | null }) =>
  ({ formLocation: fl ?? null } as EnricherInput);
const acc = (o: Partial<EnrichmentOutput> = {}): Partial<EnrichmentOutput> => o;

describe("parseBagAddress", () => {
  it("extracts build year (array), use, and area from adressenuitgebreid", () => {
    const body = { _embedded: { adressen: [{
      oorspronkelijkBouwjaar: ["1931"], gebruiksdoelen: ["woonfunctie"], oppervlakte: 120,
    }] } };
    assert.deepEqual(parseBagAddress(body), { buildYear: 1931, buildingUse: "woonfunctie", areaM2: 120 });
  });
  it("returns null when no address / all facts absent", () => {
    assert.equal(parseBagAddress({ _embedded: { adressen: [] } }), null);
    assert.equal(parseBagAddress({}), null);
    assert.equal(parseBagAddress({ _embedded: { adressen: [{}] } }), null);
  });
});

describe("fetchBagAddress", () => {
  const okBody = { _embedded: { adressen: [{ oorspronkelijkBouwjaar: ["1970"], gebruiksdoelen: ["kantoorfunctie"], oppervlakte: 300 }] } };

  it("found → sends the key + CRS headers and parses", async () => {
    let hdrs: Record<string, string> = {};
    const f = (async (_u: string, init: RequestInit) => { hdrs = init.headers as Record<string, string>; return { ok: true, status: 200, json: async () => okBody }; }) as unknown as typeof fetch;
    const r = await fetchBagAddress("3011 AD", "1", "key123", 4000, f);
    assert.equal(r.status, "found");
    assert.equal(r.data?.buildYear, 1970);
    assert.equal(hdrs["X-Api-Key"], "key123");
    assert.equal(hdrs["Accept-Crs"], "epsg:28992");
  });
  it("404 → empty, 5xx → error (transient)", async () => {
    const f404 = (async () => ({ ok: false, status: 404, json: async () => ({}) })) as unknown as typeof fetch;
    assert.equal((await fetchBagAddress("3011AD", "1", "k", 4000, f404)).status, "empty");
    const f500 = (async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch;
    assert.equal((await fetchBagAddress("3011AD", "1", "k", 4000, f500)).status, "error");
  });
  it("invalid input / no key → empty (no call)", async () => {
    let called = false;
    const f = (async () => { called = true; return { ok: true, status: 200, json: async () => okBody }; }) as unknown as typeof fetch;
    assert.equal((await fetchBagAddress("bad", "1", "k", 4000, f)).status, "empty");
    assert.equal((await fetchBagAddress("3011AD", "1", "", 4000, f)).status, "empty");
    assert.equal(called, false);
  });
});

describe("createBagLocationEnricher", () => {
  it("shouldRun needs a form postcode AND house number", () => {
    const s = createBagLocationEnricher({ resolveKey: () => "k" });
    assert.equal(s.shouldRun!(input({ postcode: "3011AD", place: null, houseNumber: "1" }), acc()), true);
    assert.equal(s.shouldRun!(input({ postcode: "3011AD", place: null }), acc()), false);
    assert.equal(s.shouldRun!(input(), acc()), false);
  });

  it("no key → skips with a persisted note", async () => {
    const s = createBagLocationEnricher({ resolveKey: () => null });
    const out = await s.enricher(input({ postcode: "3011AD", place: null, houseNumber: "1" }), acc());
    assert.equal(out.locationBuildingYear, undefined);
    assert.match(String(out.locationResolutionNote), /no BAG_API_KEY/);
  });

  it("cache hit → uses it, no live fetch", async () => {
    let live = 0;
    const s = createBagLocationEnricher({
      resolveKey: () => "k",
      cacheLookup: async () => ({ buildYear: 1900, buildingUse: "woonfunctie", areaM2: 85 }),
      liveFetch: async () => { live++; return { status: "found", data: { buildYear: 0, buildingUse: null, areaM2: null } }; },
    });
    const out = await s.enricher(input({ postcode: "3011AD", place: null, houseNumber: "1" }), acc());
    assert.equal(out.locationBuildingYear, 1900);
    assert.equal(out.locationBuildingUse, "woonfunctie");
    assert.equal(out.locationBuildingAreaM2, 85);
    assert.equal(live, 0);
  });

  it("cache miss → live fetch → upserts + uses", async () => {
    let upserted = false;
    const s = createBagLocationEnricher({
      resolveKey: () => "k",
      cacheLookup: async () => null,
      liveFetch: async () => ({ status: "found", data: { buildYear: 2005, buildingUse: "kantoorfunctie", areaM2: 240 } }),
      upsert: async () => { upserted = true; },
    });
    const out = await s.enricher(input({ postcode: "3011AD", place: null, houseNumber: "2" }), acc());
    assert.equal(out.locationBuildingYear, 2005);
    assert.equal(upserted, true);
  });

  it("transient BAG error → marks retry, no output", async () => {
    let retried = false;
    const ctx = { setCacheSource() {}, setNote() {}, markRetry() { retried = true; } };
    const s = createBagLocationEnricher({
      resolveKey: () => "k",
      cacheLookup: async () => null,
      liveFetch: async () => ({ status: "error" }),
    });
    const out = await s.enricher(input({ postcode: "3011AD", place: null, houseNumber: "3" }), acc(), ctx);
    assert.equal(out.locationBuildingYear, undefined);
    assert.equal(retried, true);
  });
});

describe("form capture — house number", () => {
  it("formLocationFromValues extracts a huisnummer field", () => {
    const loc = formLocationFromValues({ postcode: "3011 AD", huisnummer: "12a", plaats: "Rotterdam" });
    assert.equal(loc?.postcode, "3011AD");
    assert.equal(loc?.houseNumber, "12");   // digits only
    assert.equal(loc?.place, "Rotterdam");
  });
  it("cookie round-trips the house number", () => {
    const c = serializeFormLocation({ postcode: "3011AD", place: null, houseNumber: "7" });
    assert.deepEqual(parseFormLocationCookie(c), { postcode: "3011AD", place: null, houseNumber: "7" });
  });
});
