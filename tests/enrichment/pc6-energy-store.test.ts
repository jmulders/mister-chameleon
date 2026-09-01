/**
 * pc6-energy-store — coalescePc6Rows: merge all rows containing a PC6, taking each
 * field from the tightest range (smallest van→tot span), skipping nulls. Covers the
 * split-fuel case (ELK exact + GAS in a wider merged range), the single-row case,
 * and tightest-range-wins on a contested field. Pure — no DB.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { coalescePc6Rows, type Pc6EnergyRow } from "../../enrichment/pc6-energy-store.ts";

const row = (over: Partial<Pc6EnergyRow> & { postcode_van: string; postcode_tot: string }): Pc6EnergyRow => ({
  netbeheerder:       "liander",
  avg_gas_m3:         null,
  avg_elk_kwh:        null,
  solar_feedback_pct: null,
  smart_meter_pct:    null,
  connections_count:  null,
  ...over,
});

describe("coalescePc6Rows", () => {
  it("merges ELK from an exact row and GAS from a wider overlapping range", () => {
    const rows = [
      row({ postcode_van: "3011AD", postcode_tot: "3011AD", avg_elk_kwh: 2900, solar_feedback_pct: 17.5, smart_meter_pct: 90, connections_count: 25 }),
      row({ postcode_van: "3011AB", postcode_tot: "3011AL", avg_gas_m3: 1200, smart_meter_pct: 88, connections_count: 40 }),
    ];
    const out = coalescePc6Rows("3011AD", rows)!;
    assert.equal(out.avgElkKwh, 2900);   // from the exact row
    assert.equal(out.avgGasM3, 1200);    // from the merged range (exact row had null)
    assert.equal(out.solarPct, 17.5);
    assert.equal(out.smartMeterPct, 90); // tightest (exact) wins over the merged 88
    assert.equal(out.connectionsCount, 25);
    assert.equal(out.netbeheerder, "liander");
  });

  it("a single matching row returns that row's values (unchanged behaviour)", () => {
    const rows = [row({ postcode_van: "1234AB", postcode_tot: "1234AB", avg_elk_kwh: 3000, avg_gas_m3: 1000, solar_feedback_pct: 20, smart_meter_pct: 85, connections_count: 30 })];
    const out = coalescePc6Rows("1234AB", rows)!;
    assert.deepEqual(out, {
      netbeheerder: "liander", avgElkKwh: 3000, avgGasM3: 1000,
      solarPct: 20, smartMeterPct: 85, connectionsCount: 30,
    });
  });

  it("on multiple non-null values for a field, the tightest range wins", () => {
    const rows = [
      row({ postcode_van: "5000AA", postcode_tot: "5000ZZ", avg_elk_kwh: 3300, solar_feedback_pct: 30 }), // wide
      row({ postcode_van: "5000AB", postcode_tot: "5000AB", avg_elk_kwh: 2800, solar_feedback_pct: 15 }), // exact (tightest)
    ];
    const out = coalescePc6Rows("5000AB", rows)!;
    assert.equal(out.avgElkKwh, 2800);
    assert.equal(out.solarPct, 15);
  });

  it("coalesces string-typed numerics (as PostgREST returns them)", () => {
    const rows = [
      row({ postcode_van: "2000AA", postcode_tot: "2000AA", avg_elk_kwh: "2900" as unknown as number, avg_gas_m3: "" as unknown as number }),
      row({ postcode_van: "2000AA", postcode_tot: "2000ZZ", avg_gas_m3: "1200" as unknown as number }),
    ];
    const out = coalescePc6Rows("2000AA", rows)!;
    assert.equal(out.avgElkKwh, 2900);
    assert.equal(out.avgGasM3, 1200); // "" treated as null → falls through to the wider row
  });

  it("returns null when no row actually contains the PC6", () => {
    const rows = [row({ postcode_van: "9999ZX", postcode_tot: "9999ZZ", avg_elk_kwh: 3100 })];
    assert.equal(coalescePc6Rows("1000AA", rows), null);
    assert.equal(coalescePc6Rows("3011AD", []), null);
  });
});
