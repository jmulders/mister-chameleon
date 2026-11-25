/**
 * The default texts for a new tenant do not promise a control group that is
 * not there.
 *
 * A tenant's control group is off until the tenant picks a share, from 0 to 50
 * percent (Integrations, "Personalization holdout"). The seed said it was on
 * by default and that every change ran against one. The same claim stood on
 * misterchameleon.nl until 25 Nov 2026, when the owner had the texts brought
 * in line with the platform. These are the defaults a new tenant starts from.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const seed = readFileSync("lib/adaptive-blocks/adaptive-blocks-seed.ts", "utf8");

describe("seed texts about the control group", () => {
  it("matches a platform where the control group is off until it is set", () => {
    // If this default ever becomes more than 0, the texts may say so again.
    for (const file of ["lib/pipeline/homepage-pipeline.ts", "lib/cms-page-decision.ts"]) {
      assert.match(readFileSync(file, "utf8"), /personalizationHoldoutPct \?\? 0\)/, `${file}: the default share changed`);
    }
  });

  it("does not say the control group is always there or on by default", () => {
    assert.doesNotMatch(seed, /standaard aan/i);
    assert.doesNotMatch(seed, /Controlegroep standaard/);
    assert.doesNotMatch(seed, /Elke aanpassing draait tegen een controlegroep/);
    assert.doesNotMatch(seed, /krijgt altijd de (ongewijzigde|gewone) site/);
  });

  it("says you switch it on", () => {
    assert.match(seed, /Zet een controlegroep aan die uw gewone site ziet\./);
    assert.match(seed, /Zet die dus aan voordat u begint\./);
  });
});
