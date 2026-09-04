/**
 * The platform half of a demo rollout: the adaptive block and the rule that
 * make the CMS seed's context slot actually switch.
 *
 * The rule construction is pure, so it is asserted directly — and it is
 * validated with the ENGINE'S OWN validateStoredConfig rather than a
 * hand-written approximation, because that function is all-or-nothing: a config
 * it rejects disables every rule the tenant has, not just the bad one.
 *
 * The write path takes its store and DB client as injected dependencies, so it
 * is exercised here without a database.
 */

import { describe, it, beforeEach } from "node:test";
import assert                      from "node:assert/strict";

import { validateStoredConfig } from "../../decision/rules/stored-rule.ts";
import { ALLOWED_HERO_KEYS }    from "../../decision/rules/stored-rule.ts";
import type { StoredRulesConfig } from "../../decision/rules/stored-rule.ts";
import {
  buildDemoRule, buildDemoRulesConfig, seedDemoPlatformData,
  DEMO_BRAND, DEMO_RULE_ID, DEMO_RULE_PRIORITY, DEMO_HERO_BLOCK_KEY,
} from "../../lib/provisioning/demo-platform-seed.ts";

// ── The rule ──────────────────────────────────────────────────────────────────

describe("buildDemoRule", () => {
  it("targets a PLATFORM hero key — a Statamic tenant has no extraKeys", () => {
    // A CMS-invented key here would make validateStoredConfig reject the whole
    // config, and the slot would silently never switch.
    const rule = buildDemoRule();
    assert.ok((ALLOWED_HERO_KEYS as readonly string[]).includes(rule.plan.heroKey!));
  });

  it("switches on one field an operator can actually set", () => {
    const rule = buildDemoRule();
    assert.deepEqual(rule.condition, {
      type: "field", field: "source", operator: "equals", value: "linkedin",
    });
  });

  it("is enabled, so the demo works without anyone toggling it", () => {
    assert.equal(buildDemoRule().enabled, true);
  });
});

// ── The config ────────────────────────────────────────────────────────────────

describe("buildDemoRulesConfig", () => {
  it("produces a config the ENGINE accepts", () => {
    const config = buildDemoRulesConfig(null);
    assert.deepEqual(validateStoredConfig(config as unknown), []);
  });

  it("seeds a default plan when the tenant has none", () => {
    const config = buildDemoRulesConfig(null);
    assert.equal(config.rules.length, 1);
    assert.equal(config.rules[0]!.id, DEMO_RULE_ID);
    assert.equal(config.defaultPlan.heroKey, "hero_default");
    assert.equal(config.schemaVersion, 1);
  });

  it("keeps the tenant's existing rules and default plan", () => {
    const existing = {
      schemaVersion: 1,
      updatedAt:     "2026-01-01T00:00:00.000Z",
      rules: [{
        id: "their_rule", priority: 10, label: "Theirs",
        condition: { type: "field", field: "device", operator: "equals", value: "mobile" },
        plan: { heroKey: "hero_default", proofKey: "proof_default", ctaKey: "cta_default" },
        reason: "theirs", enabled: true,
      }],
      defaultPlan: { heroKey: "hero_service", proofKey: "proof_default", ctaKey: "cta_default", reason: "theirs" },
    } as unknown as StoredRulesConfig;

    const config = buildDemoRulesConfig(existing);
    assert.equal(config.rules.length, 2);
    assert.ok(config.rules.some((r) => r.id === "their_rule"));
    assert.equal(config.defaultPlan.heroKey, "hero_service");
    assert.deepEqual(validateStoredConfig(config as unknown), []);
  });

  it("steps past a taken priority instead of colliding", () => {
    // A duplicate priority makes validateStoredConfig reject the ENTIRE config,
    // which would take the tenant's own rules down with it.
    const existing = {
      schemaVersion: 1,
      updatedAt:     "2026-01-01T00:00:00.000Z",
      rules: [{
        id: "their_rule", priority: DEMO_RULE_PRIORITY, label: "Theirs",
        condition: { type: "field", field: "device", operator: "equals", value: "mobile" },
        plan: { heroKey: "hero_default", proofKey: "proof_default", ctaKey: "cta_default" },
        reason: "theirs", enabled: true,
      }],
      defaultPlan: { heroKey: "hero_default", proofKey: "proof_default", ctaKey: "cta_default", reason: "d" },
    } as unknown as StoredRulesConfig;

    const config = buildDemoRulesConfig(existing);
    const demo = config.rules.find((r) => r.id === DEMO_RULE_ID)!;
    assert.notEqual(demo.priority, DEMO_RULE_PRIORITY);
    assert.deepEqual(validateStoredConfig(config as unknown), []);
  });

  it("replaces its own rule rather than accumulating copies", () => {
    const once  = buildDemoRulesConfig(null);
    const twice = buildDemoRulesConfig(once);
    assert.equal(twice.rules.filter((r) => r.id === DEMO_RULE_ID).length, 1);
    assert.deepEqual(validateStoredConfig(twice as unknown), []);
  });

  it("preserves an explicit rulesEnabled flag", () => {
    const off = buildDemoRulesConfig({ ...buildDemoRulesConfig(null), rulesEnabled: false });
    assert.equal(off.rulesEnabled, false);
    assert.equal(buildDemoRulesConfig(null).rulesEnabled, undefined);
  });
});

describe("DEMO_BRAND", () => {
  it("is the one place the example brand is named", () => {
    assert.equal(DEMO_BRAND, "Acme");
  });
});

// ── The write path ────────────────────────────────────────────────────────────
//
// seedDemoPlatformData takes its store and DB client as optional dependencies,
// so the write path is exercised here without a database.

describe("seedDemoPlatformData", () => {
  interface Upsert { key: string; tenantId?: string | null; adaptiveVariants: unknown[] }
  let upserts:    Upsert[];
  let rulesRows:  Array<{ key: string; config: string }>;
  let blockFails: boolean;
  let existingConfig: unknown;

  beforeEach(() => { upserts = []; rulesRows = []; blockFails = false; existingConfig = null; });

  const deps = () => ({
    upsertBlock: (async (b: Upsert) => {
      if (blockFails) return { ok: false as const, error: "db down" };
      upserts.push(b);
      return { ok: true as const, id: "block-1" };
    }) as never,
    db: () => ({
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existingConfig ? { config: existingConfig } : null }) }) }),
        upsert: async (row: { key: string; config: string }) => { rulesRows.push(row); return { error: null }; },
      }),
    }),
  });

  it("writes one block with two variants and one valid rule", async () => {
    const result = await seedDemoPlatformData("acme", deps());
    assert.equal(result.ok, true);

    assert.equal(upserts.length, 1);
    assert.equal(upserts[0]!.key, DEMO_HERO_BLOCK_KEY);
    assert.equal(upserts[0]!.adaptiveVariants.length, 2);

    assert.equal(rulesRows.length, 1);
    assert.equal(rulesRows[0]!.key, "homepage_acme");
    const written = JSON.parse(rulesRows[0]!.config) as StoredRulesConfig;
    assert.equal(written.rules.length, 1);
    assert.deepEqual(validateStoredConfig(written as unknown), []);
  });

  it("scopes the block to the tenant, not the platform", async () => {
    // A null tenantId would make this demo content visible to every tenant.
    await seedDemoPlatformData("acme", deps());
    assert.equal(upserts[0]!.tenantId, "acme");
  });

  it("still writes the rule when the block fails, and warns", async () => {
    blockFails = true;
    const result = await seedDemoPlatformData("acme", deps());
    assert.equal(rulesRows.length, 1);
    assert.equal(result.ok, true); // the rule landed
    assert.ok(result.warnings.some((w) => /Adaptive block/.test(w)));
    assert.ok(!result.seeded.some((s) => s.includes("adaptive block")));
  });

  it("merges into an existing config instead of replacing it", async () => {
    existingConfig = JSON.stringify({
      schemaVersion: 1,
      updatedAt:     "2026-01-01T00:00:00.000Z",
      rules: [{
        id: "their_rule", priority: 10, label: "Theirs",
        condition: { type: "field", field: "device", operator: "equals", value: "mobile" },
        plan: { heroKey: "hero_default", proofKey: "proof_default", ctaKey: "cta_default" },
        reason: "theirs", enabled: true,
      }],
      defaultPlan: { heroKey: "hero_default", proofKey: "proof_default", ctaKey: "cta_default", reason: "d" },
    });

    await seedDemoPlatformData("acme", deps());
    const written = JSON.parse(rulesRows[0]!.config) as StoredRulesConfig;
    assert.equal(written.rules.length, 2);
    assert.ok(written.rules.some((r) => r.id === "their_rule"));
    assert.deepEqual(validateStoredConfig(written as unknown), []);
  });

  it("requires a tenantId", async () => {
    const result = await seedDemoPlatformData("", deps());
    assert.equal(result.ok, false);
    assert.equal(upserts.length, 0);
    assert.equal(rulesRows.length, 0);
  });
});
