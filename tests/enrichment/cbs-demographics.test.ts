/**
 * CBS demographics/housing/wealth/mobility derivations (D5 Fase 0 vervolg):
 * the pctShare helper (incl. null/zero denominator) and mapCbsRow's derived
 * location_* columns. Pure — no DB, no network.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { mapCbsRow, pctShare } from "../../lib/enrichment/cbs-ingest.ts";

describe("pctShare", () => {
  it("num/denom ×100 rounded to 1 decimal", () => {
    assert.equal(pctShare(150, 500), 30);
    assert.equal(pctShare(1, 3), 33.3);        // 33.333… → 33.3
    assert.equal(pctShare(2, 3), 66.7);
  });
  it("null when numerator or denominator is null/≤0 (no div-by-zero, no misleading 0)", () => {
    assert.equal(pctShare(null, 500), null);
    assert.equal(pctShare(150, null), null);
    assert.equal(pctShare(150, 0), null);
    assert.equal(pctShare(150, -5), null);
  });
});

// A raw CBS row with the demographic source fields populated.
const rawFull: Record<string, unknown> = {
  WijkenEnBuurten: "BU00000001",
  AantalInwoners_5: 1000,
  HuishoudensTotaal_29: 500,
  HuishoudensMetKinderen_32: 150,
  Eenpersoonshuishoudens_30: 200,
  GemiddeldeHuishoudensgrootte_33: 2.05,
  k_0Tot15Jaar_8: 150, k_15Tot25Jaar_9: 100, k_25Tot45Jaar_10: 280, k_45Tot65Jaar_11: 270, k_65JaarOfOuder_12: 200,
  Gehuwd_14: 400, Ongehuwd_13: 450, Gescheiden_15: 80, Verweduwd_16: 60,
  PercentageEengezinswoning_40: 55, PercentageMeergezinswoning_45: 45, PercentageVrijstaandeWoningEengezins_44: 12,
  Koopwoningen_47: 58, HuurwoningenTotaal_48: 42, InBezitWoningcorporatie_49: 27,
  BasisonderwijsVmboMbo1_67: 300, HavoVwoMbo24_68: 300, HboWo_69: 400,
  MediaanVermogenVanParticuliereHuish_86: 210,           // ×1000 → 210000
  GemiddeldInkomenPerInkomensontvanger_77: 39,           // ×1000 → 39000
  PersonenInArmoede_81: 6.5,
  PersonenautoSPerHuishouden_107: 1.15,
  PersonenautoSTotaal_104: 500, PersonenautoSOverigeBrandstof_106: 90,
  GemiddeldeElektriciteitsteruglevering_54: 850,
};

describe("mapCbsRow — demographic derivations", () => {
  const r = mapCbsRow(rawFull, 2024, "85984NED")!;

  it("household composition (denominator HuishoudensTotaal_29)", () => {
    assert.equal(r.location_pct_households_with_children, 30);   // 150/500
    assert.equal(r.location_pct_single_person_households, 40);   // 200/500
    assert.equal(r.location_avg_household_size, 2.05);           // raw, 2 decimals
  });
  it("age bands (denominator AantalInwoners_5)", () => {
    assert.equal(r.location_pct_age_0_15, 15);
    assert.equal(r.location_pct_age_15_25, 10);
    assert.equal(r.location_pct_age_25_45, 28);
    assert.equal(r.location_pct_age_45_65, 27);
    assert.equal(r.location_pct_age_65_plus, 20);
  });
  it("marital status", () => {
    assert.equal(r.location_pct_married, 40);
    assert.equal(r.location_pct_unmarried, 45);
    assert.equal(r.location_pct_divorced, 8);
    assert.equal(r.location_pct_widowed, 6);
  });
  it("housing type + ownership pass through the already-percentage source", () => {
    assert.equal(r.location_pct_single_family_homes, 55);
    assert.equal(r.location_pct_multi_family_homes, 45);
    assert.equal(r.location_pct_detached_homes, 12);
    assert.equal(r.location_pct_owner_occupied, 58);
    assert.equal(r.location_pct_rental, 42);
    assert.equal(r.location_pct_social_housing, 27);
  });
  it("education uses the sum of the three levels as denominator", () => {
    // higher = 400 / (300+300+400) ×100 = 40; lower = 300/1000 = 30
    assert.equal(r.location_pct_higher_educated, 40);
    assert.equal(r.location_pct_lower_educated, 30);
  });
  it("wealth (×1000 → euro), poverty %, mobility, feed-in", () => {
    assert.equal(r.location_median_household_wealth, 210000);
    assert.equal(r.location_avg_income_per_earner, 39000);
    assert.equal(r.location_poverty_pct, 6.5);
    assert.equal(r.location_cars_per_household, 1.15);
    assert.equal(r.location_pct_non_petrol_cars, 18);           // 90/500
    assert.equal(r.location_avg_electricity_feedback, 850);
  });
});

describe("mapCbsRow — null denominators / suppressed cells → null (never 0)", () => {
  // Only the area code + already-percentage housing field present; every
  // count-based denominator (inhabitants, households, education sum) is absent.
  const r = mapCbsRow({ WijkenEnBuurten: "BU00000002", PercentageEengezinswoning_40: 60 }, 2024, "85984NED")!;

  it("share fields are null when the denominator is missing", () => {
    assert.equal(r.location_pct_households_with_children, null);
    assert.equal(r.location_pct_age_25_45, null);
    assert.equal(r.location_pct_married, null);
    assert.equal(r.location_pct_higher_educated, null);   // eduSum 0 → null denom
    assert.equal(r.location_pct_lower_educated, null);
    assert.equal(r.location_pct_non_petrol_cars, null);   // carsTotal missing
  });
  it("missing raw values are null, present passthrough stays", () => {
    assert.equal(r.location_median_household_wealth, null);
    assert.equal(r.location_avg_electricity_feedback, null);
    assert.equal(r.location_pct_single_family_homes, 60); // the one present source field
  });
});
