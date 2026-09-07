/**
 * Snippet render-mode (D3) authoring → runtime glue.
 *
 * An adaptive variant authored as renderMode "block" must forward its
 * renderMode + blockHtml onto the resolved *BlockData, so the (already-built)
 * decide-route/snippet path (which reads BlockData.renderMode/blockHtml) picks it
 * up. Content-mode variants must stay byte-identical — no renderMode/blockHtml
 * emitted — so the default path is unchanged and backward-compatible.
 *
 * The shared mappers are the directly-testable representative of the forward the
 * provider adapters (adaptiveToHero/Proof/CTA/Feature + these two) all apply.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";

import {
  adaptiveVariantToConversionData,
  adaptiveVariantToNotificationData,
} from "../../lib/blocks/adaptive-variant-to-overlay.ts";
import type { AdaptiveVariantContent } from "../../cms/types.ts";

const base = (extra: Partial<AdaptiveVariantContent> = {}): AdaptiveVariantContent => ({
  title:    "Kop",
  subtitle: "Sub",
  ...extra,
});

describe("render-mode forwarding — conversion", () => {
  it("forwards renderMode + blockHtml for a block variant", () => {
    const d = adaptiveVariantToConversionData(
      base({ renderMode: "block", blockHtml: "<div class=\"mc-x\">hi</div>" }),
      "conv_a",
    );
    assert.equal(d.renderMode, "block");
    assert.equal(d.blockHtml, "<div class=\"mc-x\">hi</div>");
  });

  it("content-mode variant emits NEITHER field (backward-compatible)", () => {
    const d = adaptiveVariantToConversionData(base(), "conv_a");
    assert.equal(d.renderMode, undefined);
    assert.equal(d.blockHtml, undefined);
  });

  it("block WITHOUT markup does not activate block mode", () => {
    const d = adaptiveVariantToConversionData(base({ renderMode: "block", blockHtml: "" }), "conv_a");
    assert.equal(d.renderMode, undefined);
    assert.equal(d.blockHtml, undefined);
  });
});

describe("render-mode forwarding — notification", () => {
  it("forwards renderMode + blockHtml for a block variant", () => {
    const d = adaptiveVariantToNotificationData(
      base({ title: "Let op", renderMode: "block", blockHtml: "<p class=\"mc-n\">!</p>" }),
      "notif_a",
    );
    assert.ok(d);
    assert.equal(d!.renderMode, "block");
    assert.equal(d!.blockHtml, "<p class=\"mc-n\">!</p>");
  });

  it("content-mode notification emits neither field", () => {
    const d = adaptiveVariantToNotificationData(base({ title: "Let op" }), "notif_a");
    assert.ok(d);
    assert.equal(d!.renderMode, undefined);
    assert.equal(d!.blockHtml, undefined);
  });
});
