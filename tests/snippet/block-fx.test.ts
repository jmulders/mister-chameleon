/**
 * Snippet whole-block effect resolution (resolveBlockFx).
 *
 * resolveBlockFx is the shared chokepoint both snippet whole-block paths use:
 * the block-mode `toBlockSlot` and the CMS-injected `emitBlockInto`. It resolves
 * the four tiers (instance ref -> block-type default -> tenant default, with
 * `disabled` as the kill-switch) and emits the BlockSlot.fx the snippet applies.
 *
 * This locks that emitBlockInto now animates blocks the same way, including the
 * kill-switch producing no fx at all.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { resolveBlockFx } from "../../lib/snippet/block-slot.ts";
import type { EffectSet, BlockEffectConfig } from "../../design-system/effects/effect-ref.ts";

const SETS: EffectSet[] = [
  { id: "s1", key: "gentle", name: "Gentle", effects: [{ effect: "reveal" }] },
];
const TYPE_DEFAULT: BlockEffectConfig[]   = [{ effect: "zoom-in" }];
const TENANT_DEFAULT: BlockEffectConfig[] = [{ effect: "fade-in" }];

describe("resolveBlockFx (snippet whole-block effects)", () => {
  it("instance named-set ref produces fx with that effect's class", () => {
    const fx = resolveBlockFx({ effectSet: "gentle" }, SETS, TYPE_DEFAULT, TENANT_DEFAULT);
    assert.ok(fx, "expected fx");
    assert.match(fx!.className, /\bmc-fx\b/);
    assert.match(fx!.className, /\bmc-fx-reveal\b/);
    assert.equal(fx!.data?.["data-mc-fx-ids"], "reveal");
  });

  it("no ref falls to the block-type default", () => {
    const fx = resolveBlockFx(null, SETS, TYPE_DEFAULT, TENANT_DEFAULT);
    assert.match(fx!.className, /\bmc-fx-zoom-in\b/);
    assert.equal(fx!.data?.["data-mc-fx-ids"], "zoom-in");
  });

  it("no ref and no block-type default falls to the tenant default", () => {
    const fx = resolveBlockFx(null, SETS, null, TENANT_DEFAULT);
    assert.match(fx!.className, /\bmc-fx-fade-in\b/);
  });

  it("disabled (kill-switch) yields NO fx, over every default", () => {
    const fx = resolveBlockFx({ disabled: true }, SETS, TYPE_DEFAULT, TENANT_DEFAULT);
    assert.equal(fx, undefined);
  });

  it("nothing configured yields no fx", () => {
    assert.equal(resolveBlockFx(null, SETS, null, null), undefined);
    assert.equal(resolveBlockFx(undefined, undefined, undefined, undefined), undefined);
  });
});
