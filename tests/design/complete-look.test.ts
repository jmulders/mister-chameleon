/**
 * buildCompleteLookDesign / mergeUploadTokensIntoOverrides.
 *
 * The bug this guards against: applying a token set must produce a COMPLETE look
 * like applying a preset, i.e. it must derive the site-wide block tokens
 * (design.defaultTokens) and enable typography overrides, not merely set
 * tokenOverrides (which left the adaptive blocks dark).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildCompleteLookDesign,
  mergeUploadTokensIntoOverrides,
} from "../../lib/design/complete-look.ts";

const currentDesign = {
  theme: "healthcare-calm",
  selectedStyleFamily: "some-family",
  typographyOverrideEnabled: false,
  defaultTokens: { text: "#000000" },
} as unknown as Parameters<typeof buildCompleteLookDesign>[0];

const labOverrides = {
  color: { primary: "#7c3aed", background: "#faf5ff", foreground: "#2e1065" },
  typography: { fontHeading: "Space Grotesk" },
} as unknown as Parameters<typeof buildCompleteLookDesign>[1];

describe("buildCompleteLookDesign", () => {
  it("derives site-wide defaultTokens from the overrides (not just tokenOverrides)", () => {
    const design = buildCompleteLookDesign(currentDesign, labOverrides, "custom");
    // tokenOverrides set to the applied overrides.
    assert.deepEqual(design.tokenOverrides, labOverrides);
    // defaultTokens derived and non-empty, carrying the LAB palette.
    assert.ok(design.defaultTokens && Object.keys(design.defaultTokens).length > 0);
    assert.equal((design.defaultTokens as Record<string, string>).background, "#faf5ff");
    assert.equal((design.defaultTokens as Record<string, string>).primary, "#7c3aed");
  });

  it("enables typography overrides and clears the curated Style family", () => {
    const design = buildCompleteLookDesign(currentDesign, labOverrides, "custom");
    assert.equal(design.typographyOverrideEnabled, true);
    assert.equal(design.selectedStyleFamily, undefined);
    assert.equal(design.theme, "custom");
  });

  it("uses a derived-tokens override when provided (e.g. a hand-tuned preset)", () => {
    const hand = { background: "#ffffff", text: "#111111" } as unknown as Parameters<typeof buildCompleteLookDesign>[3];
    const design = buildCompleteLookDesign(currentDesign, labOverrides, "custom", hand);
    assert.deepEqual(design.defaultTokens, hand);
  });
});

describe("mergeUploadTokensIntoOverrides", () => {
  it("builds overrides from an upload against an empty base (replace)", () => {
    const overrides = mergeUploadTokensIntoOverrides(
      {},
      { color: { primary: "#111" }, typography: { fontHeading: "Inter" } } as unknown as Parameters<typeof mergeUploadTokensIntoOverrides>[1],
    );
    assert.deepEqual(overrides, { color: { primary: "#111" }, typography: { fontHeading: "Inter" } });
  });

  it("shallow-merges a group into an existing base", () => {
    const overrides = mergeUploadTokensIntoOverrides(
      { color: { primary: "#000", background: "#fff" } } as unknown as Parameters<typeof mergeUploadTokensIntoOverrides>[0],
      { color: { primary: "#111" } } as unknown as Parameters<typeof mergeUploadTokensIntoOverrides>[1],
    );
    // primary overwritten, background survives.
    assert.deepEqual(overrides.color, { primary: "#111", background: "#fff" });
  });
});
