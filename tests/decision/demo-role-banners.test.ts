/**
 * Each demo role has a banner of its own.
 *
 * The Scenario Control panel asks a visitor "Who are you?" and offers three
 * roles. Each role fires a rule, and that rule used to pick a banner written
 * for something else: the agency owner got the LinkedIn banner, the technical
 * lead the one for visitors from Google. A rule can only name a banner the
 * platform knows, so the three role banners are keys here.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { StoredRulesConfig } from "@/decision/rules/stored-rule";
import { ALLOWED_HERO_KEYS, ALLOWED_PROOF_KEYS, ALLOWED_CTA_KEYS, validateStoredConfig } from "@/decision/rules/stored-rule";
import { HERO_VARIANT_KEYS } from "@/decision/types";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SCENARIO_PRESETS } from "@/components/scenario/scenario-presets";
import { RULES_CONFIG } from "../personalization/_fixtures";

// The roles live in a client component that cannot be loaded here, so their
// keys and segments are read from its source.
const panelSource = readFileSync(join(import.meta.dirname, "../../components/scenario/DemoStageSection.tsx"), "utf8");
const ROLES = [...panelSource.matchAll(/\{ key: "(demo_role_\w+)",\s+segment: "([\w-]+)",\s+label: "([^"]+)"/g)]
  .map((m) => ({ key: m[1], segment: m[2], label: m[3] }));

const BANNER_OF: Record<string, string> = {
  demo_role_marketeer: "hero_role_marketeer",
  demo_role_bureau:    "hero_role_bureau",
  demo_role_technisch: "hero_role_technisch",
};

describe("demo role banners", () => {
  it("has a banner key for every role the panel offers", () => {
    assert.equal(ROLES.length, 3, "the roles could not be read from the panel");
    assert.deepEqual(ROLES.map((r) => r.key).sort(), Object.keys(BANNER_OF).sort());
    for (const key of Object.values(BANNER_OF)) {
      assert.ok((HERO_VARIANT_KEYS as readonly string[]).includes(key), `${key} is not a hero variant key`);
      assert.ok((ALLOWED_HERO_KEYS as readonly string[]).includes(key), `${key} is not allowed in a rule`);
    }
  });

  it("has a proof block and a closing call to action of its own for every role", () => {
    for (const hero of Object.values(BANNER_OF)) {
      const proof = hero.replace("hero_", "proof_");
      const cta   = hero.replace("hero_", "cta_");
      assert.ok((ALLOWED_PROOF_KEYS as readonly string[]).includes(proof), `${proof} is not allowed in a rule`);
      assert.ok((ALLOWED_CTA_KEYS as readonly string[]).includes(cta), `${cta} is not allowed in a rule`);
    }
  });

  it("accepts the rule of each role with its own banner, proof and call to action", () => {
    const rules = ROLES.map((role, i) => ({
      id:        `demo.role_${i}`,
      priority:  i,
      label:     `Demo role ${role.label}`,
      reason:    "Demo role",
      enabled:   true,
      // The segment the role's preset simulates is the one its rule matches on.
      condition: { type: "field", field: "audienceSegmentIds", operator: "contains", value: role.segment },
      plan:      {
        ...RULES_CONFIG.defaultPlan,
        heroKey:  BANNER_OF[role.key],
        proofKey: BANNER_OF[role.key].replace("hero_", "proof_"),
        ctaKey:   BANNER_OF[role.key].replace("hero_", "cta_"),
        reason:   "Demo role",
      },
    }));
    const config = {
      schemaVersion: 1,
      rulesEnabled:  true,
      updatedAt:     "2026-11-23T10:00:00.000Z",
      defaultPlan:   RULES_CONFIG.defaultPlan,
      rules,
    } as unknown as StoredRulesConfig;
    assert.deepEqual(validateStoredConfig(config), []);
  });

  it("simulates for each role the segment its rule matches on", () => {
    for (const role of ROLES) {
      assert.equal(SCENARIO_PRESETS[role.key]?.overrides.audienceSegmentIds, role.segment);
    }
  });
});

// ── The demo preset "company recognised" ──────────────────────────────────────
//
// A tenant's own Scenario Control preset that simulates a recognised company
// and shows a banner with its name. It is tied to a demo segment, as the roles
// are, so a real visitor never gets it (25 Nov 2026).

describe("the banner for a recognised company", () => {
  const KEY = "hero_company_known";

  it("is a hero variant key a rule may use", () => {
    assert.ok((HERO_VARIANT_KEYS as readonly string[]).includes(KEY));
    assert.ok((ALLOWED_HERO_KEYS as readonly string[]).includes(KEY));
  });

  it("has a name in the catalogue and in the rules editor", () => {
    for (const file of ["../../decision/rules/variant-catalogue.ts", "../../app/dashboard/rules/_components/RulesEditor.tsx"]) {
      assert.match(readFileSync(join(import.meta.dirname, file), "utf8"), /hero_company_known:\s+"Demo · company recognised"/);
    }
  });

  it("makes a valid rule on a demo segment", () => {
    const config = {
      ...RULES_CONFIG,
      rules: [{
        id: "demo.bedrijf_herkend", priority: 3, label: "Demo, bedrijf herkend", reason: "Demo preset", enabled: true,
        condition: { type: "field", field: "audienceSegmentIds", operator: "contains", value: "demo-bedrijf-herkend" },
        plan: { heroKey: KEY, proofKey: "proof_cases", ctaKey: "cta_meeting", reason: "Demo preset" },
      }],
    } as unknown as StoredRulesConfig;
    assert.deepEqual(validateStoredConfig(config), []);
  });
});
