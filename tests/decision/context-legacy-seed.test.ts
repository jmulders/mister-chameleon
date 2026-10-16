/**
 * buildDecisionContext — the legacy branch (no stagedEnrichers) must keep
 * `seedEnrichment`. Callers that seed known firmographics / GA4 history without a
 * staged chain (the advertiser rule-ad context in the decide route, adaptive
 * email) previously lost the seed entirely.
 *
 * Precedence mirrors the staged path: header geo < seed < non-null enricher
 * output. The stub company/CRM providers answer with nulls, which must not wipe
 * the seeded values.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildDecisionContext } from "../../decision/context/build-decision-context.ts";
import type { CompanyProvider } from "../../enrichment/providers/company.ts";

const req = () =>
  new Request("http://tenant.example/", {
    headers: new Headers({ "user-agent": "test", "x-vercel-ip-country": "BE" }),
  });

describe("buildDecisionContext — legacy branch keeps seedEnrichment", () => {
  it("seeded firmographics survive when no stagedEnrichers are passed", async () => {
    const ctx = await buildDecisionContext({
      request: req(),
      seedEnrichment: { companyName: "Acme BV", companyIndustry: "Software", countryCode: "NL" },
    });
    assert.equal(ctx.enrichment?.companyName, "Acme BV");
    assert.equal(ctx.enrichment?.companyIndustry, "Software");
    assert.equal(ctx.enrichment?.countryCode, "NL", "seed wins over the CDN header geo");
  });

  it("a real (non-null) enricher value still wins over the seed", async () => {
    const companyProvider = {
      identify: async () => ({ companyName: "Live Corp" }),
    } as unknown as CompanyProvider;
    const ctx = await buildDecisionContext({
      request: req(),
      companyProvider,
      seedEnrichment: { companyName: "Acme BV", companyIndustry: "Software" },
    });
    assert.equal(ctx.enrichment?.companyName, "Live Corp");
    assert.equal(ctx.enrichment?.companyIndustry, "Software");
  });
});
