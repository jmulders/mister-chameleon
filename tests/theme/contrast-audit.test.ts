/**
 * Theme contrast audit — proves the structural token fix.
 *
 * The fix re-pins the form token family (and font roles) at [data-site] via
 * buildThemeVarsArray, so they follow the preset instead of resolving to the
 * :root defaults. This test resolves every (surface, text) pair the way a
 * browser would (see design-system/theme/contrast-audit.ts) for all presets,
 * both before (simulated) and after the fix, and asserts:
 *
 *   1. No pair regresses (nothing flips from pass to fail).
 *   2. The fixed TEXT pairs (form label, input text) meet 4.5:1 on every preset.
 *   3. On dark presets the fix flips the form surface from the buggy light
 *      :root default to the preset's dark surface (theme-correctness).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

import { THEME_PRESETS, isThemePresetKey } from "../../design-system/theme/presets.ts";
import { tenantThemeToVarsRecord } from "../../design-system/theme/tenant-theme.ts";
import { auditPreset } from "../../design-system/theme/contrast-audit.ts";
import { isLight } from "../../lib/color/index.ts";

// ── Parse the light-mode :root + @theme defaults from theme.css ────────────────

function stripComments(s: string): string { return s.replace(/\/\*[\s\S]*?\*\//g, ""); }
function extractBlock(text: string, marker: string): string {
  const i = text.indexOf(marker);
  if (i < 0) return "";
  const open = text.indexOf("{", i);
  let depth = 0;
  for (let j = open; j < text.length; j++) {
    if (text[j] === "{") depth++;
    else if (text[j] === "}") { depth--; if (depth === 0) return text.slice(open + 1, j); }
  }
  return "";
}
function parseVars(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--[A-Za-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const cssPath = path.resolve(process.cwd(), "design-system/theme/theme.css");
const css = stripComments(fs.readFileSync(cssPath, "utf8"));
const ROOT = { ...parseVars(extractBlock(css, "@theme")), ...parseVars(extractBlock(css, ":root")) };

const KEYS = Object.keys(THEME_PRESETS).filter(isThemePresetKey);

describe("theme contrast audit", () => {
  it("parses a non-trivial :root default set from theme.css", () => {
    assert.ok(Object.keys(ROOT).length > 40, "expected many :root defaults");
    assert.equal(ROOT["--text"], "var(--color-neutral-900)");
  });

  it("no (preset, pair) regresses from pass to fail after the fix", () => {
    const regressions: string[] = [];
    for (const k of KEYS) {
      const record = tenantThemeToVarsRecord(THEME_PRESETS[k]);
      const pre  = auditPreset(k, record, ROOT, { simulatePreFix: true });
      const post = auditPreset(k, record, ROOT, { simulatePreFix: false });
      for (let i = 0; i < pre.length; i++) {
        if (pre[i].pass && !post[i].pass) {
          regressions.push(`${k}/${pre[i].pair}: ${pre[i].ratio?.toFixed(2)} → ${post[i].ratio?.toFixed(2)}`);
        }
      }
    }
    assert.deepEqual(regressions, [], `pairs regressed:\n${regressions.join("\n")}`);
  });

  it("fixed text pairs (form label, input text) meet 4.5:1 on every preset", () => {
    const fails: string[] = [];
    for (const k of KEYS) {
      const record = tenantThemeToVarsRecord(THEME_PRESETS[k]);
      const post = auditPreset(k, record, ROOT, { simulatePreFix: false });
      for (const r of post) {
        if ((r.pair === "form-label" || r.pair === "form-input") && (r.ratio === null || r.ratio < 4.5)) {
          fails.push(`${k}/${r.pair}: ${r.ratio?.toFixed(2)} (${r.surface}/${r.text})`);
        }
      }
    }
    assert.deepEqual(fails, [], `form text pairs below 4.5:\n${fails.join("\n")}`);
  });

  it("on dark presets the fix flips the form surface from the light :root default to the preset's dark surface", () => {
    let darkPresetsChecked = 0;
    for (const k of KEYS) {
      const record = tenantThemeToVarsRecord(THEME_PRESETS[k]);
      const pageBg = record["--bg"];
      if (!pageBg || isLight(pageBg)) continue; // only dark-page presets
      darkPresetsChecked++;

      const pre  = auditPreset(k, record, ROOT, { simulatePreFix: true }).find((r) => r.pair === "form-input")!;
      const post = auditPreset(k, record, ROOT, { simulatePreFix: false }).find((r) => r.pair === "form-input")!;

      assert.ok(isLight(pre.surface),
        `${k}: pre-fix form input surface should be the buggy light :root default, got ${pre.surface}`);
      assert.ok(!isLight(post.surface),
        `${k}: post-fix form input surface should follow the dark preset, got ${post.surface}`);
    }
    assert.ok(darkPresetsChecked >= 2, `expected to check some dark presets, checked ${darkPresetsChecked}`);
  });

  it("dark presets: the card separates from the section and its border is visible", () => {
    const fails: string[] = [];
    let checked = 0;
    for (const k of KEYS) {
      const record = tenantThemeToVarsRecord(THEME_PRESETS[k]);
      const pageBg = record["--bg"];
      if (!pageBg || isLight(pageBg)) continue;
      checked++;
      const post = auditPreset(k, record, ROOT, { simulatePreFix: false });
      for (const id of ["card-vs-section", "card-border-vs-card"]) {
        const r = post.find((x) => x.pair === id)!;
        if (r.ratio !== null && r.ratio < 1.25) fails.push(`${k}/${id}: ${r.ratio.toFixed(2)} (${r.surface}/${r.text})`);
      }
    }
    assert.ok(checked >= 2, `expected some dark presets, checked ${checked}`);
    assert.deepEqual(fails, [], `dark card separation below 1.25:\n${fails.join("\n")}`);
  });
});

describe("at-risk tokens are emitted concretely at [data-site]", () => {
  it("emits the full form token family for every preset", () => {
    const required = [
      "--form-bg", "--form-border", "--form-input-bg", "--form-input-border",
      "--form-input-radius", "--form-input-text", "--form-input-placeholder",
      "--form-input-focus-ring", "--form-label-color", "--form-help-color",
    ];
    for (const k of KEYS) {
      const rec = tenantThemeToVarsRecord(THEME_PRESETS[k]);
      for (const t of required) assert.ok(t in rec, `${k} missing ${t}`);
    }
  });

  it("emits font role tokens (--font-body/-ui/-code) when the preset sets a base family", () => {
    // premium-editorial sets typography.fontSans + fontMono directly.
    const rec = tenantThemeToVarsRecord(THEME_PRESETS["premium-editorial"]);
    assert.ok("--font-body" in rec, "expected --font-body to be re-pinned");
    assert.ok("--font-ui" in rec, "expected --font-ui to be re-pinned");
    // --font-body must resolve to a concrete family, not the var(--font-sans) indirection.
    assert.doesNotMatch(rec["--font-body"], /var\(/, "font-body should be concrete, not an indirection");
  });
});
