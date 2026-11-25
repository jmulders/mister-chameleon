/**
 * A preset from Scenario Control must be decided the same way on the homepage
 * and on an inner CMS page: the scenario changes the context, the tenant's own
 * rules produce the plan. The hardcoded demo plan is served only when the
 * scenario says `bypass: true`.
 *
 * Until 25 Nov 2026 lib/cms-page-decision.ts served the demo plan for every
 * preset key that had one. Several presets share a demo plan (a LinkedIn visit,
 * a pricing visit and a returning visit all map to "considering"), so on an
 * inner page a preset showed another audience's variant than on the homepage.
 *
 * Both files pull in the whole request pipeline, which this runner cannot
 * load, so the checks read the source.
 */
import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getDemoScenarioPlan } from "@/lib/demo/demo-scenario-plans";

const home = readFileSync("lib/pipeline/homepage-pipeline.ts", "utf8");
const cms  = readFileSync("lib/cms-page-decision.ts", "utf8");

const GATE = /const demoPlan = scenarioOverrides\?\.bypass === true\s*\?\s*\(getDemoScenarioPlan\(scenarioOverrides\?\._scenarioKey\)\s*\?\?\s*getSegmentDemoPlan\(scenarioOverrides\?\.audienceSegmentIds\)\)\s*:\s*null;/;

describe("a Scenario Control preset on the homepage and on a CMS page", () => {
  it("is decided by the rules on the homepage unless the scenario asks for the bypass", () => {
    assert.match(home, GATE);
  });

  it("is decided the same way on a CMS page", () => {
    assert.match(cms, GATE);
    // No second, unguarded way to the demo plan.
    assert.equal(cms.match(/getDemoScenarioPlan\(/g)?.length, 1);
    assert.equal(cms.match(/getSegmentDemoPlan\(/g)?.length, 1);
  });

  it("matters, because several presets share one demo plan", () => {
    // The reason the bypass may not be the default: with it, these presets
    // cannot be told apart on a page that keeps a variant per audience.
    const considering = getDemoScenarioPlan("consideration");
    assert.ok(considering);
    for (const preset of ["enterprise_prospect", "returning_visitor", "trial_ready"]) {
      assert.equal(getDemoScenarioPlan(preset)?.heroKey, considering.heroKey, preset);
    }
  });
});
