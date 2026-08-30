/**
 * Unit tests for the LAZY CBS location enricher: per-buurt fetch + mapping,
 * PDOK buurtcode reverse geocode, the lazy stage flow, and the resumable
 * backfill's adaptive split.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createCbsLocationEnricher, resetCbsNegativeCache, normalizeCityName } from "../../enrichment/providers/cbs-location.ts";
import {
  buurtcodeFromLatLng, normalizeBuurtcode,
  resolveBuurtcodeFromLatLng, resetBuurtcodePositiveCache,
} from "../../lib/enrichment/pdok-geocode.ts";
import {
  mapCbsRow, deriveIncomeBand, deriveUrbanityProxy, resolveUrbanity, normalizeAreaCode,
  fetchCbsArea, type CbsFetchResult,
} from "../../lib/enrichment/cbs-ingest.ts";
import { backfillPrefix } from "../../lib/enrichment/cbs-backfill.ts";
import type { CbsAreaStats } from "../../enrichment/cbs-location-store.ts";
import type { EnricherInput, EnrichmentOutput } from "../../enrichment/types.ts";

const input = {} as EnricherInput;
const acc = (o: Partial<EnrichmentOutput> = {}): Partial<EnrichmentOutput> => o;

// ── Pure helpers (unchanged behaviour) ────────────────────────────────────────

describe("normalizeBuurtcode / normalizeAreaCode", () => {
  it("extracts a BU######## code from various shapes", () => {
    assert.equal(normalizeBuurtcode("BU03630000"), "BU03630000");
    assert.equal(normalizeBuurtcode("buurt-BU03630000"), "BU03630000");
    assert.equal(normalizeAreaCode("BU03630000        "), "BU03630000");
    assert.equal(normalizeBuurtcode("WK036300"), null);
  });
});

describe("buurtcodeFromLatLng", () => {
  beforeEach(() => resetBuurtcodePositiveCache());
  it("requests the buurtcode field list and returns the buurtcode (Rotterdam)", async () => {
    let calledUrl = "";
    const fetchImpl = (async (u: string) => {
      calledUrl = u;
      return { ok: true, json: async () => ({ response: { docs: [{ weergavenaam: "Stadsdriehoek Rotterdam", id: "buu-338eb078b0c6154065945d2503031a1b", buurtcode: "BU05990110" }] } }) };
    }) as unknown as typeof fetch;
    assert.equal(await buurtcodeFromLatLng(51.9225, 4.4792, 4000, fetchImpl), "BU05990110");
    // The fl field list MUST include buurtcode — PDOK's /reverse omits it otherwise
    // (the bug that left locationAreaCode null despite valid lat/lng).
    assert.match(calledUrl, /[?&]fl=[^&]*buurtcode/i);
    assert.match(calledUrl, /type=buurt/);
  });

  it("returns null for the default PDOK reverse shape (opaque id, no buurtcode)", async () => {
    // Without fl the default doc carries only id="buu-<hash>" — no CBS code to parse.
    const fetchImpl = (async () => ({ ok: true, json: async () => ({ response: { docs: [{ weergavenaam: "Stadsdriehoek Rotterdam", id: "buu-338eb078b0c6154065945d2503031a1b" }] } }) })) as unknown as typeof fetch;
    assert.equal(await buurtcodeFromLatLng(51.9225, 4.4792, 4000, fetchImpl), null);
  });

  it("returns null on a non-OK response / invalid coords", async () => {
    const bad = (async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
    assert.equal(await buurtcodeFromLatLng(52.37, 4.9, 4000, bad), null);
    assert.equal(await buurtcodeFromLatLng(NaN, 4.9), null);
  });
});

describe("resolveBuurtcodeFromLatLng — transient robustness (the empty-session bug)", () => {
  beforeEach(() => resetBuurtcodePositiveCache());
  const okDoc = { response: { docs: [{ buurtcode: "BU05990110" }] } };

  it("classifies a resolved code as ok and caches it (coordinate → buurtcode)", async () => {
    let calls = 0;
    const f = (async () => { calls++; return { ok: true, json: async () => okDoc }; }) as unknown as typeof fetch;
    const first = await resolveBuurtcodeFromLatLng(51.9225, 4.4792, 4000, f);
    assert.deepEqual({ status: first.status, code: first.code }, { status: "ok", code: "BU05990110" });
    // Second call for the same coordinate is served from the positive cache — no fetch.
    const second = await resolveBuurtcodeFromLatLng(51.9225, 4.4792, 4000, f);
    assert.equal(second.status, "ok");
    assert.equal(second.fromCache, true);
    assert.equal(calls, 1, "the positive cache prevents a second PDOK call");
  });

  it("distinguishes a genuine empty (PDOK answered, no buurt) — no retry", async () => {
    let calls = 0;
    const f = (async () => { calls++; return { ok: true, json: async () => ({ response: { docs: [] } }) }; }) as unknown as typeof fetch;
    const r = await resolveBuurtcodeFromLatLng(52.1, 5.1, 4000, f);
    assert.equal(r.status, "empty");
    assert.equal(r.code, null);
    assert.equal(calls, 1, "a genuine empty is NOT retried");
  });

  it("marks a timeout/5xx as a transient error AND retries once", async () => {
    let calls = 0;
    const f = (async () => { calls++; return { ok: false, status: 503, json: async () => ({}) }; }) as unknown as typeof fetch;
    const r = await resolveBuurtcodeFromLatLng(52.2, 5.2, 4000, f);
    assert.equal(r.status, "error", "transient failure surfaces as error, not empty");
    assert.equal(r.code, null);
    assert.equal(calls, 2, "one retry on a transient failure");
  });

  it("a later PDOK hiccup does NOT wipe an already-known buurtcode", async () => {
    // First: resolve and cache. Then: the same coord with a failing fetch still
    // returns the known code from the positive cache (status ok, fromCache).
    const good = (async () => ({ ok: true, json: async () => okDoc })) as unknown as typeof fetch;
    await resolveBuurtcodeFromLatLng(51.9225, 4.4792, 4000, good);
    const bad = (async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch;
    const r = await resolveBuurtcodeFromLatLng(51.9225, 4.4792, 4000, bad);
    assert.equal(r.status, "ok");
    assert.equal(r.code, "BU05990110");
    assert.equal(r.fromCache, true);
  });
});

describe("income / urbanity derivations", () => {
  it("deriveIncomeBand measures deviation from each field's national baseline", () => {
    // Average buurt (~40 low / ~20 high) must be mid, not "low".
    assert.equal(deriveIncomeBand(40, 20), "mid");
    assert.equal(deriveIncomeBand(38.3, 20.8), "mid");
    assert.equal(deriveIncomeBand(17.6, 58.3), "high");
    assert.equal(deriveIncomeBand(55, 10), "low");
    assert.equal(deriveIncomeBand(null, null), null);
  });
  it("resolveUrbanity prefers the official class, density fallback", () => {
    assert.equal(resolveUrbanity(2, 100), 2);
    assert.equal(resolveUrbanity(null, 6000), 1);
    assert.equal(resolveUrbanity(0, 300), 5);
  });
  it("deriveUrbanityProxy bands density", () => {
    assert.equal(deriveUrbanityProxy(6000), 1);
    assert.equal(deriveUrbanityProxy(100), 5);
  });
});

describe("mapCbsRow", () => {
  it("maps verified fields, ×1000 income, official urbanity, keeps raw", () => {
    const raw = {
      WijkenEnBuurten: "BU03630000        ",
      GemiddeldInkomenPerInwoner_78: "32.5",
      k_40PersonenMetLaagsteInkomen_79: "20",
      k_20PersonenMetHoogsteInkomen_80: "45",
      BedrijfsvestigingenTotaal_95: "500",
      Bevolkingsdichtheid_34: "6000",
      MateVanStedelijkheid_120: "3",
      AantalInwoners_5: "1000",
    };
    const row = mapCbsRow(raw, 2024, "85984NED");
    assert.ok(row);
    assert.equal(row!.area_code, "BU03630000");
    assert.equal(row!.avg_income, 32_500);
    assert.equal(row!.income_band, "high");
    assert.equal(row!.urbanity_proxy, 3);
    assert.equal(row!.business_share, 0.5);
  });
  it("skips GM/WK rows and treats suppressed cells as null", () => {
    assert.equal(mapCbsRow({ WijkenEnBuurten: "GM0363" }, 2024, "85984NED"), null);
    const r = mapCbsRow({ WijkenEnBuurten: "BU03630000", Bevolkingsdichtheid_34: "-99997", MateVanStedelijkheid_120: "0" }, 2024, "85984NED");
    assert.equal(r!.urbanity_proxy, null); // 0 + no density → null
    assert.equal(r!.population_density, null);
  });
});

// ── Single-buurt live fetch ───────────────────────────────────────────────────

describe("fetchCbsArea (single-predicate eq)", () => {
  const fetchWith = (impl: () => unknown) => (impl as unknown) as typeof fetch;

  it("found → the single row", async () => {
    const urls: string[] = [];
    const f = ((u: string) => { urls.push(u); return { ok: true, json: async () => ({ value: [{ WijkenEnBuurten: "BU16800000" }] }) }; }) as unknown as typeof fetch;
    const res = await fetchCbsArea("85984NED", "BU16800000", f);
    assert.equal(res.status, "found");
    assert.match(urls[0], /WijkenEnBuurten%20eq%20'BU16800000'/);
    assert.match(urls[0], /\$select=/);
  });
  it("empty value[] → empty", async () => {
    const res: CbsFetchResult = await fetchCbsArea("85984NED", "BU99999999", fetchWith(() => ({ ok: true, json: async () => ({ value: [] }) })));
    assert.equal(res.status, "empty");
  });
  it("non-OK → error (fail-open)", async () => {
    const res = await fetchCbsArea("85984NED", "BU16800000", fetchWith(() => ({ ok: false, json: async () => ({}) })));
    assert.equal(res.status, "error");
  });
});

// ── Lazy stage ────────────────────────────────────────────────────────────────

describe("createCbsLocationEnricher — lazy flow", () => {
  beforeEach(() => resetCbsNegativeCache());

  const stats: CbsAreaStats = { areaCode: "BU16800000", urbanityProxy: 1, incomeBand: "high", businessShare: 0.3 };
  const foundRow = { WijkenEnBuurten: "BU16800000", MateVanStedelijkheid_120: "1", k_20PersonenMetHoogsteInkomen_80: "45", k_40PersonenMetLaagsteInkomen_79: "10", BedrijfsvestigingenTotaal_95: "300", AantalInwoners_5: "1000" };

  it("shouldRun needs NL + coordinates", () => {
    const s = createCbsLocationEnricher({ cacheLookup: async () => null });
    assert.equal(s.shouldRun!(input, acc({ latitude: 52.3, longitude: 4.9 })), true);
    assert.equal(s.shouldRun!(input, acc({ latitude: 52.3, longitude: 4.9, addressCountry: "DE" })), false);
    assert.equal(s.shouldRun!(input, acc({})), false);
  });

  it("cache HIT → uses cache, no live fetch", async () => {
    let live = 0;
    const s = createCbsLocationEnricher({
      geocode: async () => "BU16800000",
      cacheLookup: async () => stats,
      liveFetch: async () => { live++; return { status: "found", raw: foundRow }; },
      upsert: async () => {},
    });
    const out = await s.enricher(input, acc({ latitude: 52.3, longitude: 4.9 }));
    assert.equal(out.locationAreaCode, "BU16800000");
    assert.equal(out.locationUrbanityClass, 1);
    assert.equal(live, 0);
  });

  it("cache MISS → live found → maps, upserts, uses", async () => {
    let upserted: Record<string, unknown> | null = null;
    const s = createCbsLocationEnricher({
      geocode: async () => "BU16800000",
      cacheLookup: async () => null,
      liveFetch: async () => ({ status: "found", raw: foundRow }),
      upsert: async (row) => { upserted = row; },
    });
    const out = await s.enricher(input, acc({ latitude: 52.3, longitude: 4.9 }));
    assert.equal(out.locationAreaCode, "BU16800000");
    assert.equal(out.locationUrbanityClass, 1);   // MateVanStedelijkheid_120
    assert.equal(out.locationIncomeBand, "high");
    assert.ok(upserted, "row was cached");
  });

  it("cache MISS → empty → {} and negative-caches (second call skips live)", async () => {
    let live = 0;
    const s = createCbsLocationEnricher({
      geocode: async () => "BU99999999",
      cacheLookup: async () => null,
      liveFetch: async () => { live++; return { status: "empty" }; },
      upsert: async () => {},
    });
    assert.deepEqual(await s.enricher(input, acc({ latitude: 52.3, longitude: 4.9 })), {});
    assert.deepEqual(await s.enricher(input, acc({ latitude: 52.3, longitude: 4.9 })), {});
    assert.equal(live, 1); // second lookup served from the negative cache
  });

  it("cache MISS → error → {} and does NOT negative-cache (retries next time)", async () => {
    let live = 0;
    const s = createCbsLocationEnricher({
      geocode: async () => "BU16800000",
      cacheLookup: async () => null,
      liveFetch: async () => { live++; return { status: "error" }; },
      upsert: async () => {},
    });
    await s.enricher(input, acc({ latitude: 52.3, longitude: 4.9 }));
    await s.enricher(input, acc({ latitude: 52.3, longitude: 4.9 }));
    assert.equal(live, 2); // errors are not cached → retried
  });

  it("transient PDOK geocode failure → {} and marks the stage for retry", async () => {
    let retryReason: string | null = null;
    let note: string | null = null;
    const ctx = {
      setCacheSource: () => {},
      setNote: (n: string) => { note = n; },
      markRetry: (r: string) => { retryReason = r; },
    };
    const s = createCbsLocationEnricher({
      // Simulate a transient PDOK failure (classified error, no code).
      geocode: async () => ({ status: "error" as const, code: null }),
      cacheLookup: async () => stats,
    });
    const out = await s.enricher(input, acc({ latitude: 52.3, longitude: 4.9 }), ctx);
    assert.deepEqual(out, {});
    assert.ok(retryReason, "markRetry was called for a transient failure");
    assert.match(String(note), /transient/);
  });

  it("genuine empty geocode (no buurt) → {} and does NOT mark retry", async () => {
    let retried = false;
    const ctx = {
      setCacheSource: () => {},
      setNote: () => {},
      markRetry: () => { retried = true; },
    };
    const s = createCbsLocationEnricher({
      geocode: async () => null, // genuine empty
      cacheLookup: async () => stats,
    });
    const out = await s.enricher(input, acc({ latitude: 52.3, longitude: 4.9 }), ctx);
    assert.deepEqual(out, {});
    assert.equal(retried, false, "a genuine empty must not trigger a retry");
  });

  it("all-suppressed stats → {} (no billing-worthy enrichment)", async () => {
    const s = createCbsLocationEnricher({
      geocode: async () => "BU16800000",
      cacheLookup: async () => ({ areaCode: "BU16800000", urbanityProxy: null, incomeBand: null, businessShare: null }),
    });
    assert.deepEqual(await s.enricher(input, acc({ latitude: 52.3, longitude: 4.9 })), {});
  });

  // ── Debug visibility: the stage reports a note even when output is empty ──────
  function capturingCtx() {
    const notes: string[] = [];
    return { ctx: { setCacheSource() {}, setNote: (n: string) => notes.push(n), markRetry() {} }, notes };
  }

  it("notes the resolved buurtcode + cache hit on success", async () => {
    const { ctx, notes } = capturingCtx();
    const s = createCbsLocationEnricher({ geocode: async () => "BU16800000", cacheLookup: async () => stats });
    await s.enricher(input, acc({ latitude: 52.3, longitude: 4.9 }), ctx);
    assert.match(notes.at(-1)!, /buurtcode=BU16800000/);
    assert.match(notes.at(-1)!, /cbs=cache/);
  });

  it("notes 'no buurtcode' when PDOK returns nothing (no silent null)", async () => {
    const { ctx, notes } = capturingCtx();
    const s = createCbsLocationEnricher({ geocode: async () => null, cacheLookup: async () => null });
    assert.deepEqual(await s.enricher(input, acc({ latitude: 52.3, longitude: 4.9 }), ctx), {});
    assert.match(notes.at(-1)!, /no buurtcode/);
    assert.match(notes.at(-1)!, /ip-geo/);
  });

  it("notes buurtcode + cbs=empty when the store misses", async () => {
    const { ctx, notes } = capturingCtx();
    const s = createCbsLocationEnricher({
      geocode: async () => "BU99999999", cacheLookup: async () => null,
      liveFetch: async () => ({ status: "empty" }), upsert: async () => {},
    });
    assert.deepEqual(await s.enricher(input, acc({ latitude: 52.3, longitude: 4.9 }), ctx), {});
    assert.match(notes.at(-1)!, /buurtcode=BU99999999/);
    assert.match(notes.at(-1)!, /cbs=empty/);
  });
});

describe("createCbsLocationEnricher — city/coords coherence (the wrong-buurt bug)", () => {
  beforeEach(() => resetCbsNegativeCache());
  const stats: CbsAreaStats = { areaCode: "BU16800000", urbanityProxy: 1, incomeBand: "high", businessShare: 0.3 };

  // Injectable geocoders that record whether the coords or the city path was used.
  function tracked() {
    const calls: string[] = [];
    return {
      calls,
      geocode:     async (_lat: number, _lng: number) => { calls.push("coords"); return "BU_COORDS0"; },
      formGeocode: async (_pc: string | null, place: string | null) => { calls.push(`city:${place}`); return "BU16800000"; },
    };
  }

  it("mismatch (IP city ≠ reverse-geocoded city) → resolves via the CITY, low confidence", async () => {
    const t = tracked();
    const s = createCbsLocationEnricher({ geocode: t.geocode, formGeocode: t.formGeocode, cacheLookup: async () => stats });
    const out = await s.enricher(input, acc({
      latitude: 51.92, longitude: 4.48,          // MaxMind coords (Rotterdam)
      city: "Veenendaal", addressCity: "Rotterdam", // IPinfo city vs reverse-geocode
      geoCitySource: "ipinfo", geoCoordsSource: "maxmind",
    }));
    assert.equal(out.locationAreaCode, "BU16800000");
    assert.equal(out.locationCityCoordMismatch, true);
    assert.equal(out.locationConfidence, "low");
    assert.deepEqual(t.calls, ["city:Veenendaal"], "resolved via the city centroid, not the incoherent coordinates");
  });

  it("no mismatch (city agrees with reverse-geocode) → uses the coordinates, high confidence", async () => {
    const t = tracked();
    const s = createCbsLocationEnricher({ geocode: t.geocode, formGeocode: t.formGeocode, cacheLookup: async () => ({ ...stats, areaCode: "BU_COORDS0" }) });
    const out = await s.enricher(input, acc({
      latitude: 51.92, longitude: 4.48,
      city: "Rotterdam", addressCity: "Rotterdam ", // same city (whitespace-insensitive)
      geoCitySource: "ipinfo", geoCoordsSource: "maxmind",
    }));
    assert.equal(out.locationCityCoordMismatch, false);
    assert.equal(out.locationConfidence, "high");
    assert.deepEqual(t.calls, ["coords"], "coherent → trust the precise coordinates");
  });

  it("no addressCity to compare → no mismatch, uses coordinates (high)", async () => {
    const t = tracked();
    const s = createCbsLocationEnricher({ geocode: t.geocode, formGeocode: t.formGeocode, cacheLookup: async () => ({ ...stats, areaCode: "BU_COORDS0" }) });
    const out = await s.enricher(input, acc({ latitude: 51.92, longitude: 4.48, city: "Veenendaal" }));
    assert.equal(out.locationCityCoordMismatch, false);
    assert.equal(out.locationConfidence, "high");
    assert.deepEqual(t.calls, ["coords"]);
  });

  it("normalizeCityName is diacritic/whitespace/case insensitive but keeps genuine differences", () => {
    assert.equal(normalizeCityName("Rotterdam ") === normalizeCityName("rotterdam"), true);
    assert.equal(normalizeCityName("Nijmegen") === normalizeCityName("Níjmégen"), true);
    assert.equal(normalizeCityName("Den Haag") === normalizeCityName("'s-Gravenhage"), false);
  });
});

// ── Backfill adaptive split ───────────────────────────────────────────────────

describe("backfillPrefix — adaptive split at the cap", () => {
  it("splits one digit deeper when a bucket hits the cap", async () => {
    const CAP = 10_000;
    const fetched: string[] = [];
    // Top prefix returns exactly the cap → must split into 10 children (each small).
    const fetchPrefix = async (_ds: string, prefix: string) => {
      fetched.push(prefix);
      const n = prefix === "BU03" ? CAP : 2;
      return Array.from({ length: n }, (_, i) => ({ WijkenEnBuurten: `${prefix}${String(i).padStart(6, "0")}` }));
    };
    let upsertCalls = 0;
    const totals = await backfillPrefix("BU03", {
      datasetId: "85984NED", sourceYear: 2024, fetchPrefix,
      upsert: async (rows) => { upsertCalls++; return rows.length; },
    });
    // Fetched BU03 (cap) + BU030..BU039 (10 children).
    assert.equal(fetched[0], "BU03");
    assert.equal(fetched.filter((p) => /^BU03\d$/.test(p)).length, 10);
    assert.equal(upsertCalls, 10);       // only the leaf buckets upsert
    assert.equal(totals.buckets, 10);
  });

  it("small bucket upserts directly, no split", async () => {
    const fetchPrefix = async (_ds: string, prefix: string) =>
      Array.from({ length: 3 }, (_, i) => ({ WijkenEnBuurten: `${prefix}${String(i).padStart(6, "0")}` }));
    let written = 0;
    const totals = await backfillPrefix("BU07", {
      fetchPrefix, upsert: async (rows) => { written += rows.length; return rows.length; },
    });
    assert.equal(totals.buckets, 1);
    assert.equal(written, 3);
  });
});
