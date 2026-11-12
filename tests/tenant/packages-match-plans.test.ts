/**
 * The package gates and the price list say the same thing.
 *
 * There are two descriptions of what a plan includes: BILLING_PLANS (what the
 * pricing page shows and what billing enforces) and the PACKAGE definitions
 * (what the admin lets a tenant switch on). They had drifted: the page sold AI
 * with Growth and experiments with every plan, the packages allowed AI only on
 * Pro and no experiments on Starter.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import fs               from "node:fs";
import { BILLING_PLANS } from "../../billing/plans.ts";
import { STARTER_PACKAGE, GROWTH_PACKAGE, PRO_PACKAGE } from "../../tenant/packages.ts";

const PACKAGES = { starter: STARTER_PACKAGE, growth: GROWTH_PACKAGE, pro: PRO_PACKAGE } as const;

describe("packages and price list", () => {
  for (const id of ["starter", "growth", "pro"] as const) {
    it(`${id}: AI is allowed exactly when the plan sells it`, () => {
      assert.equal(PACKAGES[id].allowedFeatures.ai, BILLING_PLANS[id].features.aiPersonalization);
    });

    it(`${id}: experiments are part of the plan, without a cap`, () => {
      assert.equal(PACKAGES[id].allowedFeatures.experiments, true);
      assert.equal(PACKAGES[id].limits.maxExperiments, Infinity);
    });
  }

  it("the price list is what this test assumes", () => {
    assert.equal(BILLING_PLANS.starter.features.aiPersonalization, false);
    assert.equal(BILLING_PLANS.growth.features.aiPersonalization, true);
    assert.equal(BILLING_PLANS.growth.features.crmAbmEnrichment, true);
    assert.equal(BILLING_PLANS.pro.features.multiTenant, true);
  });

  it("migration 187 switches on what the price list promises", () => {
    const sql = fs.readFileSync("supabase/migrations/20240101000187_plan_features_match_price_list.sql", "utf8");
    const featuresFor = (plan: string): Record<string, boolean> => {
      const statement = sql.split("UPDATE billing_plans").find((part) => part.includes(`WHERE plan_id = '${plan}'`));
      assert.ok(statement, `update for ${plan} found`);
      const json = /\|\| '(\{[^']+\})'::jsonb/.exec(statement);
      assert.ok(json, `features for ${plan} found`);
      return JSON.parse(json[1]) as Record<string, boolean>;
    };
    for (const id of ["starter", "growth", "pro"] as const) {
      const set = featuresFor(id);
      for (const [key, sold] of Object.entries(BILLING_PLANS[id].features)) {
        if (sold) assert.equal(set[key], true, `${id}.${key} is sold, so the migration turns it on`);
      }
      assert.ok(Object.values(set).every((v) => v === true), `${id}: the migration only switches features on`);
    }
  });
});
