/**
 * Item 6 PR 1 — contextual gallery-preset injection runtime.
 *
 * Covers: resolveThemeDecision returns a gallery selection (resolvedPresetId)
 * when a plan.themePresetId rule fires; the gallery session lock; curated
 * backward-compat; and the mc_theme selection encode/decode.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveThemeDecision } from "../../decision/theme-decision.ts";
import { readThemeSessionSelection, writeThemeSessionSelection, THEME_SESSION_COOKIE } from "../../lib/theme-session.ts";
import { DESIGN_PRESET_GALLERY } from "../../tenant/design-presets-gallery.ts";

const GALLERY_ID = DESIGN_PRESET_GALLERY[1].id; // a real gallery preset id

type Cfg = Parameters<typeof resolveThemeDecision>[0];
type Ctx = Parameters<typeof resolveThemeDecision>[1];

// Minimal RuleEvaluationContext (desktop) — only fields the conditions read.
const ctx = {
  source: "direct", device: "desktop", visitType: "new",
  rawReferrer: null, referrerDomain: null,
  utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null,
  userAgent: "", resolvedAt: Date.now(), history: { events: [] }, tenantId: "t",
} as unknown as Ctx;

function galleryRuleConfig(): Cfg {
  return {
    rulesEnabled: true,
    rules: [{
      id: "r1", label: "Desktop -> gallery", priority: 1, enabled: true,
      condition: { type: "field", field: "device", operator: "equals", value: "desktop" },
      plan: { heroKey: "hero_default", proofKey: "proof_default", ctaKey: "cta_default", themePresetId: GALLERY_ID },
    }],
  } as unknown as Cfg;
}

describe("resolveThemeDecision — gallery selection", () => {
  it("a plan.themePresetId rule wins and returns resolvedPresetId", () => {
    const t = resolveThemeDecision(galleryRuleConfig(), ctx, "modern-saas");
    assert.equal(t.resolvedPresetId, GALLERY_ID);
    assert.equal(t.matchedRuleId, "r1");
    assert.equal(t.sessionLocked, false);
  });

  it("a gallery session lock is respected (no rule re-eval)", () => {
    const t = resolveThemeDecision(null, ctx, "modern-saas", null, null, GALLERY_ID);
    assert.equal(t.resolvedPresetId, GALLERY_ID);
    assert.equal(t.sessionLocked, true);
    assert.equal(t.triggerMode, "session_lock");
  });

  it("curated rules stay backward-compatible (no presetId)", () => {
    const cfg = {
      rulesEnabled: true,
      rules: [{
        id: "r2", label: "Desktop -> curated", priority: 1, enabled: true,
        condition: { type: "field", field: "device", operator: "equals", value: "desktop" },
        plan: { heroKey: "h", proofKey: "p", ctaKey: "c", themeKey: "dark-contrast" },
      }],
    } as unknown as Cfg;
    const t = resolveThemeDecision(cfg, ctx, "modern-saas");
    assert.equal(t.resolvedTheme, "dark-contrast");
    assert.ok(!t.resolvedPresetId);
  });
});

describe("mc_theme selection encode/decode", () => {
  type Store = Parameters<typeof writeThemeSessionSelection>[0];
  function fakeStore(initial?: string) {
    let v = initial;
    const store = {
      get: (name: string) => (name === THEME_SESSION_COOKIE && v !== undefined ? { value: v } : undefined),
      set: (_n: string, value: string) => { v = value; },
      _val: () => v,
    };
    return store as typeof store & Store;
  }

  it("round-trips a gallery selection", () => {
    const s = fakeStore();
    writeThemeSessionSelection(s, { kind: "gallery", presetId: GALLERY_ID });
    assert.equal(s._val(), `gallery:${GALLERY_ID}`);
    assert.deepEqual(readThemeSessionSelection(s), { kind: "gallery", presetId: GALLERY_ID });
  });

  it("round-trips a curated selection and reads a legacy bare key", () => {
    const s = fakeStore();
    writeThemeSessionSelection(s, { kind: "curated", themeKey: "dark-contrast" });
    assert.equal(s._val(), "curated:dark-contrast");
    assert.deepEqual(readThemeSessionSelection(fakeStore("dark-contrast")), { kind: "curated", themeKey: "dark-contrast" });
  });

  it("rejects an unknown gallery id / invalid key", () => {
    assert.equal(readThemeSessionSelection(fakeStore("gallery:nope")), null);
    assert.equal(readThemeSessionSelection(fakeStore("curated:not-a-key")), null);
  });
});
