/**
 * EP-Online energielabel enricher (D5 Fase 3): band mapping, response parse,
 * is_prive skip, the lazy enricher, and the licence display-gate (raw label token
 * only renders when the tenant flag is on; band always). Pure — no DB, no network.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import {
  deriveLabelBand, parseEpOnlineLabel, type EpOnlineLabel, type EpOnlineFetchResult,
} from "../../lib/enrichment/eponline-ingest.ts";
import { createEpOnlineLabelEnricher } from "../../enrichment/providers/eponline-label.ts";
import { substituteContextTokens } from "../../lib/blocks/substitute-context-tokens.ts";
import type { RuleEvaluationContext } from "../../decision/rules/field-registry.ts";
import type { CopyVariable } from "../../tenant/types.ts";
import type { EnricherInput, EnrichmentOutput } from "../../enrichment/types.ts";

// ── deriveLabelBand ─────────────────────────────────────────────────────────────

describe("deriveLabelBand", () => {
  it("A/B → green, C/D → amber, E/F/G → red (A++ counts on the leading letter)", () => {
    for (const l of ["A", "A+++", "B"]) assert.equal(deriveLabelBand(l), "green");
    for (const l of ["C", "D"])         assert.equal(deriveLabelBand(l), "amber");
    for (const l of ["E", "F", "G"])    assert.equal(deriveLabelBand(l), "red");
  });
  it("null / unknown → null", () => {
    assert.equal(deriveLabelBand(null), null);
    assert.equal(deriveLabelBand(""), null);
    assert.equal(deriveLabelBand("X"), null);
  });
});

// ── parseEpOnlineLabel ──────────────────────────────────────────────────────────

describe("parseEpOnlineLabel", () => {
  it("parses the first registration + derives the band", () => {
    const json = [{
      Energieklasse: "C", Energie_index: "1.35", Pand_gebouwklasse: "W",
      Pand_bouwjaar: 1975, Energiebehoefte: 110, Aandeel_hernieuwbare_energie: 22,
      Registratiedatum_einde: "2033-05-01", Pand_registratie_prive: false,
      BAGVerblijfsobjectID: "0363010000000001",
    }];
    const p = parseEpOnlineLabel(json)!;
    assert.equal(p.energyLabel, "C");
    assert.equal(p.energyLabelBand, "amber");
    assert.equal(p.energyIndex, 1.35);
    assert.equal(p.buildingClass, "W");
    assert.equal(p.bouwjaar, 1975);
    assert.equal(p.energiebehoefte, 110);
    assert.equal(p.aandeelHernieuwbaar, 22);
    assert.equal(p.geldigTot, "2033-05-01");
    assert.equal(p.isPrive, false);
  });
  it("flags a private registration and returns null on an empty result", () => {
    const priv = parseEpOnlineLabel([{ Energieklasse: "A", Pand_registratie_prive: true }])!;
    assert.equal(priv.isPrive, true);
    assert.equal(parseEpOnlineLabel([]), null);
    assert.equal(parseEpOnlineLabel(null), null);
  });
});

// ── enricher ────────────────────────────────────────────────────────────────────

const input = (postcode: string | null, houseNumber: string | null): EnricherInput =>
  ({ formLocation: postcode ? { postcode, place: null, houseNumber } : null } as EnricherInput);
const acc = (): Partial<EnrichmentOutput> => ({});

const label = (over: Partial<EpOnlineLabel> = {}): EpOnlineLabel => ({
  energyLabel: "A", energyLabelBand: "green", energyIndex: 0.8, buildingClass: "W",
  gebouwtype: null, bouwjaar: 2015, gebruiksoppervlakte: 120, energiebehoefte: 45,
  aandeelHernieuwbaar: 60, co2: 5, geldigTot: "2033-01-01", isPrive: false, bagVboId: null, ...over,
});

describe("createEpOnlineLabelEnricher", () => {
  it("shouldRun needs a form postcode AND house number", () => {
    const s = createEpOnlineLabelEnricher({ resolveKey: () => "k", cacheLookup: async () => null });
    assert.equal(s.shouldRun!(input("3011AD", "1"), acc()), true);
    assert.equal(s.shouldRun!(input("3011AD", null), acc()), false);
    assert.equal(s.shouldRun!(input(null, "1"), acc()), false);
  });

  it("sets band + internal signals on a hit", async () => {
    const s = createEpOnlineLabelEnricher({ resolveKey: () => "k", cacheLookup: async () => label() });
    const out = await s.enricher(input("3011AD", "1"), acc());
    assert.equal(out.locationEnergyLabel, "A");
    assert.equal(out.locationEnergyLabelBand, "green");
    assert.equal(out.locationEnergyIndex, 0.8);
    assert.equal(out.locationBuildingEnergyDemand, 45);
    assert.equal(out.locationRenewableShare, 60);
    assert.equal(out.locationEnergyLabelValidUntil, "2033-01-01");
  });

  it("skips a private registration (no fields)", async () => {
    const s = createEpOnlineLabelEnricher({ resolveKey: () => "k", cacheLookup: async () => label({ isPrive: true }) });
    const out = await s.enricher(input("3011AD", "1"), acc());
    assert.equal(out.locationEnergyLabel, undefined);
    assert.equal(out.locationEnergyLabelBand, undefined);
  });

  it("no-ops without an API key", async () => {
    const s = createEpOnlineLabelEnricher({ resolveKey: () => null });
    const out = await s.enricher(input("3011AD", "1"), acc());
    assert.equal(out.locationEnergyLabel, undefined);
  });

  it("is fail-open: a transient error adds no fields and marks retry", async () => {
    let retried = false;
    const s = createEpOnlineLabelEnricher({
      resolveKey: () => "k", cacheLookup: async () => null,
      liveFetch: async (): Promise<EpOnlineFetchResult> => ({ status: "error" }),
    });
    const out = await s.enricher(input("3011AD", "1"), acc(), { setNote() {}, markRetry() { retried = true; } } as never);
    assert.equal(out.locationEnergyLabel, undefined);
    assert.equal(retried, true);
  });
});

// ── licence display-gate ─────────────────────────────────────────────────────────

describe("EP-Online raw-label display gate", () => {
  const ctx = { enrichment: { locationEnergyLabel: "A", locationEnergyLabelBand: "green" } } as unknown as RuleEvaluationContext;
  const registry: CopyVariable[] = [
    { token: "eplabel", label: "raw",  source: { kind: "builtin", key: "locationEnergyLabel" } },
    { token: "epband",  label: "band", source: { kind: "builtin", key: "locationEnergyLabelBand" } },
  ];

  it("the raw label token does NOT render when the flag is off (default)", () => {
    assert.equal(substituteContextTokens("label={eplabel}", ctx, registry), "label=");
  });
  it("the raw label token renders when epLabelDisplayAllowed is on", () => {
    assert.equal(substituteContextTokens("label={eplabel}", ctx, registry, { epLabelDisplayAllowed: true }), "label=A");
  });
  it("the band token always renders, regardless of the flag", () => {
    assert.equal(substituteContextTokens("band={epband}", ctx, registry), "band=green");
    assert.equal(substituteContextTokens("band={epband}", ctx, registry, { epLabelDisplayAllowed: true }), "band=green");
  });
});
