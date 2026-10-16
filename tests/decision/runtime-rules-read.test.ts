/**
 * Runtime reads of a tenant's rules config must not drop the whole config
 * because a plan names a CMS-defined variant key.
 *
 * Those keys were validated at SAVE time against the tenant's CMS catalogue.
 * The per-pageview read paths (snippet/decide, v1/slot, theme, email) call the
 * loader without that catalogue, so strict validation rejected the config, the
 * loader returned null and `new RulesDecisionProvider(undefined)` served the
 * PLATFORM's runtime-rules.json to the tenant, ignoring its rulesEnabled=false.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import { validateStoredConfig }                   from "@/decision/rules/stored-rule";
import type { RuleCondition }                     from "@/decision/rules/stored-rule";
import { parseStoredTenantRulesConfig }           from "@/decision/rules/load-tenant-rules";
import { RulesDecisionProvider }                  from "@/decision/providers/rules-decision-provider";
import { buildJourney, buildInput, RULES_CONFIG } from "../personalization/_fixtures";

const condition = { type: "field", field: "source", operator: "equals", value: "linkedin" } as unknown as RuleCondition;

const cmsConfig = {
  schemaVersion: 1,
  rulesEnabled:  false,
  updatedAt:     "2026-10-01T00:00:00.000Z",
  defaultPlan:   RULES_CONFIG.defaultPlan,
  rules: [
    {
      id: "cms_hero", priority: 1, label: "CMS hero", reason: "cms", condition,
      plan: { heroKey: "hero_sanity_custom", proofKey: "proof_sanity_custom", ctaKey: "cta_sanity_custom" },
    },
  ],
};

const LENIENT = { allowUnknownVariantKeys: true } as const;

describe("load-tenant-rules — runtime reads tolerate CMS variant keys", () => {
  it("the save path still rejects unknown variant keys without the catalogue", () => {
    const fields = validateStoredConfig(cmsConfig).map((e) => e.field);
    assert.ok(fields.some((f) => /heroKey$/.test(f)));
    assert.ok(fields.some((f) => /proofKey$/.test(f)));
    assert.ok(fields.some((f) => /ctaKey$/.test(f)));
  });

  it("the lenient runtime read keeps the config and its rulesEnabled flag", () => {
    const loaded = parseStoredTenantRulesConfig(cmsConfig, undefined, LENIENT);
    assert.ok(loaded, "config must not be dropped on a runtime read");
    assert.strictEqual(loaded.rulesEnabled, false);
    assert.strictEqual(loaded.rules[0].plan.heroKey, "hero_sanity_custom");
  });

  it("the lenient read still rejects structural errors", () => {
    const badKeys = { ...cmsConfig, rules: [{ ...cmsConfig.rules[0], plan: { heroKey: "", proofKey: 3, ctaKey: null } }] };
    assert.strictEqual(parseStoredTenantRulesConfig(badKeys, undefined, LENIENT), null);

    const dupPriority = { ...cmsConfig, rules: [cmsConfig.rules[0], { ...cmsConfig.rules[0], id: "other" }] };
    assert.strictEqual(parseStoredTenantRulesConfig(dupPriority, undefined, LENIENT), null);

    const badFeature = { ...cmsConfig, rules: [{ ...cmsConfig.rules[0], plan: { ...cmsConfig.rules[0].plan, featureKey: "nope" } }] };
    assert.strictEqual(parseStoredTenantRulesConfig(badFeature, undefined, LENIENT), null);

    assert.strictEqual(parseStoredTenantRulesConfig({ ...cmsConfig, schemaVersion: 2 }, undefined, LENIENT), null);
  });

  it("without the option the read stays strict, and extraKeys still work", () => {
    assert.strictEqual(parseStoredTenantRulesConfig(cmsConfig), null);
    const loaded = parseStoredTenantRulesConfig(cmsConfig, {
      heroKeys: ["hero_sanity_custom"], proofKeys: ["proof_sanity_custom"], ctaKeys: ["cta_sanity_custom"],
    });
    assert.ok(loaded);
  });

  it("the tenant's rulesEnabled=false is honoured instead of serving the platform rules", async () => {
    const loaded   = parseStoredTenantRulesConfig(cmsConfig, undefined, LENIENT);
    const provider = new RulesDecisionProvider(loaded ?? undefined);
    const plan     = await provider.getHomepagePlan(
      buildInput(buildJourney({}), { source: "linkedin", utmSource: "linkedin" }),
    );
    assert.strictEqual(provider.lastRulesEnabled, false);
    assert.strictEqual(plan.heroKey, RULES_CONFIG.defaultPlan.heroKey);
  });
});
