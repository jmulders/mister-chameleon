/**
 * effect-list-ops — the one-effect-per-group and in-place-swap rules that back
 * EffectListEditor (shared by the block drawer, Design -> Block styles, and the
 * per-block-type editor). Pure list ops, so the rules are asserted once here and
 * hold for every picker surface.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addEffectToList, swapEffectInList, isSwapTargetDisabled,
} from "../../components/admin/effects/effect-list-ops.ts";
import type { BlockEffectConfig } from "../../design-system/effects/effect-ref.ts";

const ids = (list: BlockEffectConfig[]) => list.map((e) => e.effect);

describe("addEffectToList — one effect per group", () => {
  it("adds the first effect with no replacement", () => {
    const { next, replacedLabel } = addEffectToList([], "reveal");
    assert.deepEqual(ids(next), ["reveal"]);
    assert.equal(replacedLabel, null);
  });

  it("replaces the existing entrance when a second entrance is added", () => {
    const { next, replacedLabel } = addEffectToList([{ effect: "reveal" }], "slide-in-up");
    assert.deepEqual(ids(next), ["slide-in-up"]);
    assert.equal(replacedLabel, "Reveal (fade + rise)");
  });

  it("allows one effect per group across groups (entrance + emphasis + continuous)", () => {
    let list: BlockEffectConfig[] = [];
    list = addEffectToList(list, "reveal").next;     // entrance
    list = addEffectToList(list, "pulse").next;      // emphasis
    list = addEffectToList(list, "parallax").next;   // continuous
    assert.deepEqual(ids(list).sort(), ["parallax", "pulse", "reveal"]);
  });

  it("is a no-op (same reference) when the effect is already present", () => {
    const list: BlockEffectConfig[] = [{ effect: "reveal" }];
    const { next } = addEffectToList(list, "reveal");
    assert.equal(next, list);
  });

  it("ignores an unknown effect id", () => {
    const list: BlockEffectConfig[] = [{ effect: "reveal" }];
    assert.equal(addEffectToList(list, "does-not-exist").next, list);
  });
});

describe("swapEffectInList — in-place swap keeps compatible params", () => {
  it("swaps in place and keeps params whose keys exist on the new effect", () => {
    const list: BlockEffectConfig[] = [{ effect: "reveal", params: { duration: 800, distance: 40 } }];
    const next = swapEffectInList(list, "reveal", "slide-in-up"); // shares duration + distance
    assert.deepEqual(next, [{ effect: "slide-in-up", params: { duration: 800, distance: 40 } }]);
  });

  it("drops params the new effect does not have", () => {
    const list: BlockEffectConfig[] = [{ effect: "reveal", params: { duration: 800, distance: 40 } }];
    const next = swapEffectInList(list, "reveal", "fade-in"); // has duration/delay, no distance
    assert.deepEqual(next, [{ effect: "fade-in", params: { duration: 800 } }]);
  });

  it("is a no-op when the target is already in the list", () => {
    const list: BlockEffectConfig[] = [{ effect: "reveal" }, { effect: "pulse" }];
    assert.equal(swapEffectInList(list, "reveal", "pulse"), list);
  });

  it("preserves other effects and order", () => {
    const list: BlockEffectConfig[] = [{ effect: "reveal" }, { effect: "pulse" }];
    const next = swapEffectInList(list, "reveal", "zoom-in");
    assert.deepEqual(ids(next), ["zoom-in", "pulse"]);
  });
});

describe("isSwapTargetDisabled — protects one-per-group in the dropdown", () => {
  const list: BlockEffectConfig[] = [{ effect: "reveal" }, { effect: "pulse" }];
  it("enables the current effect itself", () => {
    assert.equal(isSwapTargetDisabled(list, "reveal", "reveal"), false);
  });
  it("enables another effect in the same group as the current card", () => {
    assert.equal(isSwapTargetDisabled(list, "reveal", "slide-in-up"), false);
  });
  it("disables an effect already present in another card", () => {
    assert.equal(isSwapTargetDisabled(list, "reveal", "pulse"), true);
  });
  it("disables an effect whose group another card occupies", () => {
    // glow-pulse is emphasis; the emphasis slot is taken by pulse on another card.
    assert.equal(isSwapTargetDisabled(list, "reveal", "glow-pulse"), true);
  });
  it("enables an effect in a group no other card occupies", () => {
    assert.equal(isSwapTargetDisabled(list, "reveal", "parallax"), false); // continuous, free
  });
});
