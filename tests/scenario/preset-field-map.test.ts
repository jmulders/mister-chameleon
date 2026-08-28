/**
 * Preset field → ScenarioOverrides mapping.
 *
 * The custom-preset editor produces (field, value) rows via the rules-editor field
 * controls; overridesFromRows must map those to the ScenarioOverrides namespace
 * (with the journey-funnel / comma-segment quirks), and rowsFromOverrides must
 * invert it (fail-open on unknown keys).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { FIELD_REGISTRY } from "../../decision/rules/field-registry.ts";
import {
  PRESET_FIELD_KEYS, overridesFromRows, rowsFromOverrides,
} from "../../components/scenario/preset-field-map.ts";

describe("preset field map", () => {
  it("every allowlisted field exists in FIELD_REGISTRY (fail-open filter worked)", () => {
    assert.ok(PRESET_FIELD_KEYS.length > 0);
    for (const k of PRESET_FIELD_KEYS) assert.ok(k in FIELD_REGISTRY, `${k} missing from registry`);
  });

  it("overridesFromRows maps registry fields → ScenarioOverrides keys", () => {
    const out = overridesFromRows([
      { field: "journey.funnelStage", value: "high_intent" },
      { field: "journey.intentScore", value: 75 },
      { field: "interestPrimary",     value: "pricing" },
      { field: "hasClickedCta",       value: true },
    ]);
    assert.deepEqual(out, {
      funnelStage:    "high_intent",
      intentScore:    75,
      interestPrimary: "pricing",
      hasClickedCta:  true,
    });
  });

  it("coerces an array value (multi-select) to a comma-string (segments)", () => {
    const out = overridesFromRows([{ field: "audienceSegmentIds", value: ["enterprise", "hot"] }]);
    assert.equal(out.audienceSegmentIds, "enterprise,hot");
  });

  it("skips empty/undefined values", () => {
    const out = overridesFromRows([
      { field: "companyName", value: "" },
      { field: "region",      value: undefined },
      { field: "companyDomain", value: "acme.example" },
    ]);
    assert.deepEqual(out, { companyDomain: "acme.example" });
  });

  it("rowsFromOverrides inverts the mapping and fail-opens on unknown keys", () => {
    const rows = rowsFromOverrides({ funnelStage: "intent", intentScore: 40, notAField: "x" });
    const byOverride = new Map(rows.map((r) => [r.field, r.value]));
    assert.equal(byOverride.get("journey.funnelStage"), "intent");
    assert.equal(byOverride.get("journey.intentScore"), 40);
    // unknown override key → not turned into a row
    assert.equal(rows.length, 2);
  });

  it("round-trips overrides → rows → overrides", () => {
    const original = { funnelStage: "customer", intentScore: 90, companyName: "Nakatomi BV" };
    assert.deepEqual(overridesFromRows(rowsFromOverrides(original)), original);
  });
});
