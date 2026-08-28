/**
 * Unit tests for the CBS location enricher stage (buurt-keyed) + PDOK buurtcode
 * reverse geocode + CBS mapping/derivations.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { createCbsLocationEnricher } from "../../enrichment/providers/cbs-location.ts";
import { buurtcodeFromLatLng, normalizeBuurtcode } from "../../lib/enrichment/pdok-geocode.ts";
import { mapCbsRow, deriveIncomeBand, deriveUrbanityProxy, resolveUrbanity, normalizeAreaCode, fetchCbsRows } from "../../lib/enrichment/cbs-ingest.ts";
import type { CbsAreaStats } from "../../enrichment/cbs-location-store.ts";
import type { EnricherInput, EnrichmentOutput } from "../../enrichment/types.ts";

const input = {} as EnricherInput;
const acc = (o: Partial<EnrichmentOutput> = {}): Partial<EnrichmentOutput> => o;

describe("normalizeBuurtcode / normalizeAreaCode", () => {
  it("extracts a BU######## code from various shapes", () => {
    assert.equal(normalizeBuurtcode("BU03630000"), "BU03630000");
    assert.equal(normalizeBuurtcode("buurt-BU03630000"), "BU03630000");
    assert.equal(normalizeAreaCode("BU03630000        "), "BU03630000"); // CBS space padding
    assert.equal(normalizeBuurtcode("WK036300"), null);
    assert.equal(normalizeBuurtcode(null), null);
  });
});

describe("buurtcodeFromLatLng", () => {
  it("returns the buurtcode from a PDOK reverse response", async () => {
    const fetchImpl = (async () => ({
      ok: true,
      json: async () => ({ response: { docs: [{ buurtcode: "BU03630000" }] } }),
    })) as unknown as typeof fetch;
    assert.equal(await buurtcodeFromLatLng(52.37, 4.9, 4000, fetchImpl), "BU03630000");
  });
  it("parses the code out of the doc id when no explicit field", async () => {
    const fetchImpl = (async () => ({
      ok: true,
      json: async () => ({ response: { docs: [{ id: "buurt-BU03630000" }] } }),
    })) as unknown as typeof fetch;
    assert.equal(await buurtcodeFromLatLng(52.37, 4.9, 4000, fetchImpl), "BU03630000");
  });
  it("returns null on a non-OK response / invalid coords", async () => {
    const bad = (async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
    assert.equal(await buurtcodeFromLatLng(52.37, 4.9, 4000, bad), null);
    assert.equal(await buurtcodeFromLatLng(NaN, 4.9), null);
  });
});

describe("deriveIncomeBand", () => {
  it("uses the low/high income-share percentiles", () => {
    assert.equal(deriveIncomeBand(20, 40), "high"); // more high earners
    assert.equal(deriveIncomeBand(50, 10), "low");  // more low earners
    assert.equal(deriveIncomeBand(30, 32), "mid");  // within margin
    assert.equal(deriveIncomeBand(null, null), null);
  });
});

describe("deriveUrbanityProxy (density-derived)", () => {
  it("bands population density 1..5", () => {
    assert.equal(deriveUrbanityProxy(6000), 1);
    assert.equal(deriveUrbanityProxy(3000), 2);
    assert.equal(deriveUrbanityProxy(1200), 3);
    assert.equal(deriveUrbanityProxy(700), 4);
    assert.equal(deriveUrbanityProxy(100), 5);
    assert.equal(deriveUrbanityProxy(null), null);
  });
});

describe("resolveUrbanity (official class, density fallback)", () => {
  it("uses the official CBS class 1..5 when present", () => {
    assert.equal(resolveUrbanity(2, 100), 2); // official wins over the density band
  });
  it("falls back to density when the class is suppressed (null / 0 / out of range)", () => {
    assert.equal(resolveUrbanity(null, 6000), 1);
    assert.equal(resolveUrbanity(0, 300), 5);
    assert.equal(resolveUrbanity(9, 6000), 1);
  });
});

describe("fetchCbsRows — explicit $top/$skip pagination", () => {
  it("pages with $top + $skip and stops on a short page", async () => {
    const pages: Record<number, unknown[]> = {
      0: Array.from({ length: 2000 }, (_, i) => ({ WijkenEnBuurten: `BU0000${i}` })),
      2000: Array.from({ length: 137 }, (_, i) => ({ WijkenEnBuurten: `BU1000${i}` })),
    };
    const urls: string[] = [];
    const fetchImpl = (async (u: string) => {
      urls.push(u);
      const skip = Number(new URL(u).searchParams.get("$skip"));
      return { ok: true, json: async () => ({ value: pages[skip] ?? [] }) };
    }) as unknown as typeof fetch;

    const rows = await fetchCbsRows("85984NED", fetchImpl, 2000);
    assert.equal(rows.length, 2137);
    // Two requests: skip=0 (full page) then skip=2000 (short page → stop).
    assert.equal(urls.length, 2);
    assert.match(urls[0], /\$top=2000/);
    assert.match(urls[0], /\$select=/);
    assert.match(urls[0], /startswith/);
    assert.match(urls[1], /\$skip=2000/);
  });

  it("throws on a non-OK page", async () => {
    const fetchImpl = (async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch;
    await assert.rejects(() => fetchCbsRows("85984NED", fetchImpl, 2000), /HTTP 500/);
  });
});

describe("mapCbsRow (85984NED buurt)", () => {
  it("maps verified fields, derives bands, keeps raw", () => {
    const raw = {
      WijkenEnBuurten: "BU03630000        ",
      GemiddeldInkomenPerInwoner_78: "32.5",
      k_40PersonenMetLaagsteInkomen_79: "20",
      k_20PersonenMetHoogsteInkomen_80: "45",
      BedrijfsvestigingenTotaal_95: "500",
      Bevolkingsdichtheid_34: "6000",       // density band would be 1…
      MateVanStedelijkheid_120: "3",        // …but the official class wins
      AantalInwoners_5: "1000",
    };
    const row = mapCbsRow(raw, 2024, "85984NED");
    assert.ok(row);
    assert.equal(row!.area_code, "BU03630000");
    assert.equal(row!.avg_income, 32_500); // "32.5" x 1000 euro
    assert.equal(row!.income_band, "high");
    assert.equal(row!.urbanity_proxy, 3);  // official CBS class, not the density band
    assert.equal(row!.business_share, 0.5); // 500/1000
    assert.equal(row!.business_total, 500);
    assert.equal(row!.population_density, 6000);
    assert.equal(row!.source_year, 2024);
    assert.equal(row!.source_dataset, "85984NED");
    assert.deepEqual(row!.raw, raw);
  });

  it("falls back to the density band when the official class is suppressed (0/null)", () => {
    const row = mapCbsRow({ WijkenEnBuurten: "BU03630000", Bevolkingsdichtheid_34: "6000", MateVanStedelijkheid_120: "0" }, 2024, "85984NED");
    assert.equal(row!.urbanity_proxy, 1); // 0 → suppressed → density 6000 → band 1
  });

  it("skips GM/WK aggregate rows (no BU code)", () => {
    assert.equal(mapCbsRow({ WijkenEnBuurten: "GM0363", Bevolkingsdichtheid_34: "5000" }, 2024, "85984NED"), null);
  });

  it("treats suppressed / negative cells as null (not 0)", () => {
    const row = mapCbsRow({ WijkenEnBuurten: "BU03630000", Bevolkingsdichtheid_34: "-99997", BedrijfsvestigingenTotaal_95: null }, 2024, "85984NED");
    assert.ok(row);
    assert.equal(row!.population_density, null);
    assert.equal(row!.urbanity_proxy, null);
    assert.equal(row!.business_total, null);
    assert.equal(row!.business_share, null);
  });
});

describe("createCbsLocationEnricher — shouldRun", () => {
  const stage = createCbsLocationEnricher({ lookup: async () => null });
  it("runs with lat/lng", () => {
    assert.equal(stage.shouldRun!(input, acc({ latitude: 52.3, longitude: 4.9 })), true);
  });
  it("skips a resolved non-NL country", () => {
    assert.equal(stage.shouldRun!(input, acc({ latitude: 52.3, longitude: 4.9, addressCountry: "DE" })), false);
  });
  it("skips without coordinates", () => {
    assert.equal(stage.shouldRun!(input, acc({ addressPostcode: "1011 AB" })), false);
  });
});

describe("createCbsLocationEnricher — enricher", () => {
  const stats: CbsAreaStats = {
    areaCode: "BU03630000", urbanityProxy: 1, incomeBand: "high", businessShare: 0.3,
  };

  it("resolves location fields from a buurt hit", async () => {
    const stage = createCbsLocationEnricher({
      lookup:  async (code) => (code === "BU03630000" ? stats : null),
      geocode: async () => "BU03630000",
    });
    const out = await stage.enricher(input, acc({ latitude: 52.3, longitude: 4.9 }));
    assert.equal(out.locationAreaCode, "BU03630000");
    assert.equal(out.locationUrbanityClass, 1);
    assert.equal(out.locationIncomeBand, "high");
    assert.equal(out.locationBusinessShare, 0.3);
  });

  it("returns {} when no buurtcode resolves", async () => {
    const stage = createCbsLocationEnricher({ lookup: async () => stats, geocode: async () => null });
    assert.deepEqual(await stage.enricher(input, acc({ latitude: 52.3, longitude: 4.9 })), {});
  });

  it("returns {} when the buurt has no CBS row", async () => {
    const stage = createCbsLocationEnricher({ lookup: async () => null, geocode: async () => "BU99999999" });
    assert.deepEqual(await stage.enricher(input, acc({ latitude: 52.3, longitude: 4.9 })), {});
  });

  it("returns {} without coordinates", async () => {
    const stage = createCbsLocationEnricher({ lookup: async () => stats, geocode: async () => "BU03630000" });
    assert.deepEqual(await stage.enricher(input, acc()), {});
  });
});
