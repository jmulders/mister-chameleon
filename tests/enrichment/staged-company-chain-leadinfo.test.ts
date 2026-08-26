/**
 * Firmographic (Leadinfo) stage wiring in the shared company/CRM chain.
 *
 * `buildTenantStagedEnrichers` (used by BOTH the platform-hosted homepage and the
 * JS-snippet decide route) maps `tenant.enrichment.useLeadinfo` + the platform
 * Leadinfo key onto `buildCompanyCrmChain({ enableLeadinfo, leadinfoApiKey })`.
 * Leadinfo is the stage that resolves companyName/companyIndustry from the
 * visitor IP — the data a rule webhook forwards as `fields.companyName`. This
 * locks that the stage is present exactly when enabled AND keyed, and absent
 * otherwise, so a live Statamic visit can actually deliver firmographics.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildCompanyCrmChain } from "../../enrichment/providers/staged-company-crm-chain.ts";

const hasLeadinfo = (chain: { stageKey?: string }[]): boolean =>
  chain.some((s) => s.stageKey === "leadinfo");

describe("company/CRM chain — Leadinfo firmographic stage", () => {
  it("includes the Leadinfo stage when enabled AND an API key is present", () => {
    const chain = buildCompanyCrmChain({ enableLeadinfo: true, leadinfoApiKey: "ld_test" });
    assert.equal(hasLeadinfo(chain), true);
  });

  it("omits the Leadinfo stage when the tenant flag is off (even with a key)", () => {
    const chain = buildCompanyCrmChain({ enableLeadinfo: false, leadinfoApiKey: "ld_test" });
    assert.equal(hasLeadinfo(chain), false);
  });

  it("omits the Leadinfo stage when no API key is configured", () => {
    const chain = buildCompanyCrmChain({ enableLeadinfo: true });
    assert.equal(hasLeadinfo(chain), false);
  });

  it("always builds a non-empty chain (always-on IP classification stage)", () => {
    const chain = buildCompanyCrmChain({});
    assert.ok(chain.length > 0, "expected at least the always-on internal stages");
  });
});
