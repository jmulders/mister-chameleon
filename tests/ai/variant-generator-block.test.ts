/**
 * tests/ai/variant-generator-block.test.ts
 *
 * The AI variant generator can produce a BLOCK-mode variant (D1/D3): a styled
 * block that adopts the tenant brand through design-token CSS vars. These tests
 * pin the block contract without changing content mode:
 *
 *   (a) block mode → renderMode:"block" + non-empty blockHtml that uses var(--…)
 *       tokens and NO hardcoded hex/rgb colours;
 *   (b) content mode → byte-identical to before (no renderMode/blockHtml);
 *   (d) empty / token-less / hardcoded-colour blockHtml → clean error, no variant.
 *
 * (Credit-rem (c) is unchanged from fase 1: block generation is still one
 * generate() call → one ai_variant_generation charge — covered by
 * variant-generation-flow.test.ts, which is provider-mode agnostic.)
 */

import { test, describe } from "node:test";
import assert             from "node:assert/strict";

import { generateVariant, type VariantBrief } from "@/ai/variant-generator";
import type { AiGenerateResult } from "@/ai/providers/base-provider";

// ── Fixtures ────────────────────────────────────────────────────────────────

const BASE_DECISION = {
  decisionLabel:   "LinkedIn CFO",
  decisionSummary: "Voor financiële beslissers uit LinkedIn.",
  intendedAudience: "CFOs",
  intentLevel:     "consideration",
  funnelStages:    ["consideration"],
  bestForSources:  ["linkedin"],
  tone:            "credibility",
  primaryGoal:     "demo",
  supportingGoals: [],
  exclusions:      [],
};

const GOOD_BLOCK_HTML =
  `<section class="mc-hero" style="background:var(--hero-bg);color:var(--hero-title-color);font-family:var(--font-heading)">` +
  `<h1 class="mc-hero__title" style="color:var(--hero-title-color)">Schaal zonder chaos</h1>` +
  `<p class="mc-hero__sub" style="color:var(--text)">Personalisatie die meegroeit.</p>` +
  `<a class="mc-hero__cta" href="/demo" style="background:var(--btn-bg);color:var(--btn-text);border-radius:var(--btn-radius)">Plan een demo</a>` +
  `</section>`;

function blockResponse(blockHtml: unknown) {
  return JSON.stringify({
    content: { title: "Schaal zonder chaos", subtitle: "Personalisatie die meegroeit.", blockHtml },
    decision: BASE_DECISION,
  });
}

const gen = (text: string) => async (): Promise<AiGenerateResult> => ({ ok: true, text });

const BLOCK_BRIEF:   VariantBrief = { slot: "hero", audience: "CFOs", renderMode: "block", tokenSet: "enterprise" };
const CONTENT_BRIEF: VariantBrief = { slot: "hero", audience: "CFOs" };

// ── (a) block mode ────────────────────────────────────────────────────────────

describe("generateVariant — block mode", () => {
  test("returns renderMode:block + token-using blockHtml, and attaches the tokenSet", async () => {
    const res = await generateVariant(BLOCK_BRIEF, { generate: gen(blockResponse(GOOD_BLOCK_HTML)) });
    assert.ok(res.ok);
    if (!res.ok) return;

    assert.equal(res.variant.content.renderMode, "block");
    assert.ok(res.variant.content.blockHtml && res.variant.content.blockHtml.length > 0);
    assert.match(res.variant.content.blockHtml!, /var\(\s*--/, "block uses design-token vars");
    assert.doesNotMatch(res.variant.content.blockHtml!, /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(/, "no hardcoded colours");
    assert.equal(res.variant.content.tokenSet, "enterprise");
    // Content fields still present so the block has a content-mode fallback.
    assert.equal(res.variant.content.title, "Schaal zonder chaos");
    assert.equal(res.variant.content.subtitle, "Personalisatie die meegroeit.");
    // Decision still filled (aiReady).
    assert.equal(res.variant.decision.intentLevel, "consideration");
  });

  test("omits tokenSet when the brief did not pick one (tenant defaults)", async () => {
    const res = await generateVariant({ slot: "hero", audience: "CFOs", renderMode: "block" }, { generate: gen(blockResponse(GOOD_BLOCK_HTML)) });
    assert.ok(res.ok);
    assert.ok(res.ok && res.variant.content.tokenSet === undefined);
  });
});

// ── (b) content mode is unchanged ─────────────────────────────────────────────

describe("generateVariant — content mode unchanged", () => {
  const CONTENT_RESPONSE = JSON.stringify({
    content: { title: "Schaal zonder chaos", subtitle: "Personalisatie die meegroeit." },
    decision: BASE_DECISION,
  });

  test("carries no renderMode/blockHtml (byte-identical shape)", async () => {
    const res = await generateVariant(CONTENT_BRIEF, { generate: gen(CONTENT_RESPONSE) });
    assert.ok(res.ok);
    if (!res.ok) return;
    assert.equal(res.variant.content.renderMode, undefined);
    assert.equal(res.variant.content.blockHtml, undefined);
    assert.equal(res.variant.content.title, "Schaal zonder chaos");
  });

  test("a block response in content mode ignores blockHtml entirely", async () => {
    // Even if the model returns blockHtml, content mode drops it.
    const res = await generateVariant(CONTENT_BRIEF, { generate: gen(blockResponse(GOOD_BLOCK_HTML)) });
    assert.ok(res.ok);
    assert.equal(res.ok && res.variant.content.renderMode, undefined);
    assert.equal(res.ok && res.variant.content.blockHtml, undefined);
  });
});

// ── (d) invalid blockHtml → clean error, no variant ───────────────────────────

describe("generateVariant — invalid block output is rejected", () => {
  test("empty blockHtml → error, no variant", async () => {
    const res = await generateVariant(BLOCK_BRIEF, { generate: gen(blockResponse("")) });
    assert.equal(res.ok, false);
    assert.ok(!res.ok && /blockHtml/i.test(res.error));
  });

  test("missing blockHtml key → error", async () => {
    const noBlock = JSON.stringify({ content: { title: "T", subtitle: "S" }, decision: BASE_DECISION });
    const res = await generateVariant(BLOCK_BRIEF, { generate: gen(noBlock) });
    assert.equal(res.ok, false);
  });

  test("blockHtml without any design-token var → error", async () => {
    const noVars = `<section class="mc-hero"><h1>Title</h1><p>Sub</p></section>`;
    const res = await generateVariant(BLOCK_BRIEF, { generate: gen(blockResponse(noVars)) });
    assert.equal(res.ok, false);
    assert.ok(!res.ok && /design-tokens|var\(/i.test(res.error));
  });

  test("blockHtml with a hardcoded hex colour → error", async () => {
    const hardcoded = `<section class="mc-hero" style="color:#0b5cff;background:var(--hero-bg)"><h1>T</h1><p>S</p></section>`;
    const res = await generateVariant(BLOCK_BRIEF, { generate: gen(blockResponse(hardcoded)) });
    assert.equal(res.ok, false);
    assert.ok(!res.ok && /hardcoded/i.test(res.error));
  });

  test("blockHtml with an rgb() colour → error", async () => {
    const rgb = `<section class="mc-hero" style="color:rgb(11,92,255);background:var(--hero-bg)"><h1>T</h1><p>S</p></section>`;
    const res = await generateVariant(BLOCK_BRIEF, { generate: gen(blockResponse(rgb)) });
    assert.equal(res.ok, false);
  });
});
