/**
 * Unit tests for the form-provided location enricher input:
 * cookie/context helpers, PDOK forward geocode, and CBS-stage precedence.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePostcode, serializeFormLocation, parseFormLocationCookie, formLocationFromValues,
} from "../../context/form-location-context.ts";
import {
  parseCentroidLatLng, latLngFromFree, buurtcodeFromFormLocation,
} from "../../lib/enrichment/pdok-geocode.ts";
import { createCbsLocationEnricher, resetCbsNegativeCache } from "../../enrichment/providers/cbs-location.ts";
import type { CbsAreaStats } from "../../enrichment/cbs-location-store.ts";
import type { EnricherInput, EnrichmentOutput } from "../../enrichment/types.ts";

describe("form-location-context helpers", () => {
  it("normalizePostcode accepts NL postcodes, rejects junk", () => {
    assert.equal(normalizePostcode("1011 AB"), "1011AB");
    assert.equal(normalizePostcode("1011ab"), "1011AB");
    assert.equal(normalizePostcode("SW1A 1AA"), null);
    assert.equal(normalizePostcode("1011"), null);
    assert.equal(normalizePostcode(null), null);
  });

  it("formLocationFromValues prefers a postcode field, falls back to place", () => {
    assert.deepEqual(formLocationFromValues({ postcode: "1011 AB", city: "Amsterdam" }), { postcode: "1011AB", place: "Amsterdam", houseNumber: null });
    assert.deepEqual(formLocationFromValues({ woonplaats: "Utrecht" }), { postcode: null, place: "Utrecht", houseNumber: null });
    // postcode hidden in a generic field is still found
    assert.deepEqual(formLocationFromValues({ note: "ik woon op 3511LN" }), { postcode: "3511LN", place: null, houseNumber: null });
    assert.equal(formLocationFromValues({ name: "Jane" }), null);
  });

  it("cookie round-trips", () => {
    const c = serializeFormLocation({ postcode: "1011AB", place: null });
    assert.deepEqual(parseFormLocationCookie(c), { postcode: "1011AB", place: null, houseNumber: null });
    assert.equal(parseFormLocationCookie(""), null);
    assert.equal(parseFormLocationCookie("garbage"), null);
  });
});

describe("PDOK forward geocode", () => {
  it("parseCentroidLatLng parses POINT(lon lat)", () => {
    assert.deepEqual(parseCentroidLatLng("POINT(4.90564828 52.37779461)"), { lat: 52.37779461, lng: 4.90564828 });
    assert.equal(parseCentroidLatLng("nope"), null);
  });

  it("latLngFromFree reads the centroid from the free endpoint", async () => {
    const urls: string[] = [];
    const f = ((u: string) => { urls.push(u); return { ok: true, json: async () => ({ response: { docs: [{ centroide_ll: "POINT(4.9 52.37)" }] } }) }; }) as unknown as typeof fetch;
    assert.deepEqual(await latLngFromFree("1011AB", 4000, f), { lat: 52.37, lng: 4.9 });
    assert.match(urls[0], /\/free\?/);
    assert.match(urls[0], /q=1011AB/);
  });

  it("buurtcodeFromFormLocation: forward (centroid) then reverse (buurt)", async () => {
    const calls: string[] = [];
    const f = ((u: string) => {
      calls.push(u);
      if (u.includes("/free")) return { ok: true, json: async () => ({ response: { docs: [{ centroide_ll: "POINT(4.9 52.37)" }] } }) };
      return { ok: true, json: async () => ({ response: { docs: [{ buurtcode: "BU03630000" }] } }) }; // /reverse
    }) as unknown as typeof fetch;
    assert.equal(await buurtcodeFromFormLocation("1011 AB", null, 4000, f), "BU03630000");
    assert.ok(calls.some((u) => u.includes("/free")));
    assert.ok(calls.some((u) => u.includes("/reverse")));
  });

  it("buurtcodeFromFormLocation returns null with no query / empty forward", async () => {
    assert.equal(await buurtcodeFromFormLocation(null, null), null);
    const empty = ((u: string) => ({ ok: true, json: async () => ({ response: { docs: [] } }) })) as unknown as typeof fetch;
    assert.equal(await buurtcodeFromFormLocation("1011AB", null, 4000, empty), null);
  });

  it("pins a bare PLACE forward to type:woonplaats (not a street/address top-match)", async () => {
    const calls: string[] = [];
    const f = ((u: string) => {
      calls.push(u);
      if (u.includes("/free")) return { ok: true, json: async () => ({ response: { docs: [{ centroide_ll: "POINT(5.55 52.02)" }] } }) };
      return { ok: true, json: async () => ({ response: { docs: [{ buurtcode: "BU05990110" }] } }) };
    }) as unknown as typeof fetch;
    // place only (no postcode) → the free forward MUST carry fq=type:woonplaats.
    await buurtcodeFromFormLocation(null, "Veenendaal", 4000, f);
    const free = calls.find((u) => u.includes("/free"))!;
    assert.match(free, /[?&]fq=type%3Awoonplaats/i, "place forward filters to woonplaats");
  });

  it("does NOT filter a POSTCODE forward to woonplaats (postcode is precise)", async () => {
    const calls: string[] = [];
    const f = ((u: string) => {
      calls.push(u);
      if (u.includes("/free")) return { ok: true, json: async () => ({ response: { docs: [{ centroide_ll: "POINT(4.9 52.37)" }] } }) };
      return { ok: true, json: async () => ({ response: { docs: [{ buurtcode: "BU03630000" }] } }) };
    }) as unknown as typeof fetch;
    await buurtcodeFromFormLocation("1011 AB", null, 4000, f);
    const free = calls.find((u) => u.includes("/free"))!;
    assert.doesNotMatch(free, /woonplaats/i, "postcode forward is not woonplaats-filtered");
  });
});

describe("CBS stage — form-location precedence", () => {
  beforeEach(() => resetCbsNegativeCache());
  const input = (fl?: { postcode: string | null; place: string | null }) => ({ formLocation: fl ?? null } as EnricherInput);
  const acc = (o: Partial<EnrichmentOutput> = {}): Partial<EnrichmentOutput> => o;
  const stats: CbsAreaStats = { areaCode: "BU00000001", urbanityProxy: 2, incomeBand: "high", businessShare: 0.2 };

  it("shouldRun fires on a form location even without lat/lng or NL country", () => {
    const s = createCbsLocationEnricher({ cacheLookup: async () => null });
    assert.equal(s.shouldRun!(input({ postcode: "1011AB", place: null }), acc({ addressCountry: "DE" })), true);
    assert.equal(s.shouldRun!(input(), acc()), false);
  });

  it("form location wins over IP lat/lng", async () => {
    let usedForm = 0, usedLatLng = 0;
    const s = createCbsLocationEnricher({
      formGeocode: async () => { usedForm++; return "BU00000001"; },
      geocode:     async () => { usedLatLng++; return "BU99999999"; },
      cacheLookup: async (code) => (code === "BU00000001" ? stats : null),
    });
    const out = await s.enricher(input({ postcode: "1011AB", place: null }), acc({ latitude: 52.3, longitude: 4.9 }));
    assert.equal(out.locationAreaCode, "BU00000001");
    assert.equal(usedForm, 1);
    assert.equal(usedLatLng, 0); // IP path not used when the form location resolves
  });

  it("falls back to IP lat/lng when the form location does not resolve", async () => {
    const s = createCbsLocationEnricher({
      formGeocode: async () => null,
      geocode:     async () => "BU00000001",
      cacheLookup: async () => stats,
    });
    const out = await s.enricher(input({ postcode: "9999ZZ", place: null }), acc({ latitude: 52.3, longitude: 4.9 }));
    assert.equal(out.locationAreaCode, "BU00000001");
  });

  it("shouldRun fires on a GA4 last-known city (no lat/lng, no form location)", () => {
    const s = createCbsLocationEnricher({ cacheLookup: async () => null });
    assert.equal(s.shouldRun!(input(), acc({ gaLastKnownCity: "Amsterdam" })), true);
    assert.equal(s.shouldRun!(input(), acc({ gaLastKnownCity: null })), false);
  });

  it("coarse GA4-city fallback resolves when there is no lat/lng and no form location", async () => {
    let formArgs: [string | null, string | null] | null = null;
    const s = createCbsLocationEnricher({
      formGeocode: async (postcode, place) => { formArgs = [postcode, place]; return "BU00000001"; },
      geocode:     async () => { throw new Error("IP path must not run"); },
      cacheLookup: async () => stats,
    });
    const out = await s.enricher(input(), acc({ gaLastKnownCity: "Amsterdam" }));
    assert.equal(out.locationAreaCode, "BU00000001");
    assert.deepEqual(formArgs, [null, "Amsterdam"]); // forward-geocoded the city, no postcode
  });

  it("IP lat/lng wins over the GA4-city fallback", async () => {
    let usedGa = 0, usedLatLng = 0;
    const s = createCbsLocationEnricher({
      formGeocode: async () => { usedGa++; return "BU99999999"; },
      geocode:     async () => { usedLatLng++; return "BU00000001"; },
      cacheLookup: async (code) => (code === "BU00000001" ? stats : null),
    });
    const out = await s.enricher(input(), acc({ latitude: 52.3, longitude: 4.9, gaLastKnownCity: "Amsterdam" }));
    assert.equal(out.locationAreaCode, "BU00000001");
    assert.equal(usedLatLng, 1);
    assert.equal(usedGa, 0); // GA4-city path not used when lat/lng resolves
  });
});
