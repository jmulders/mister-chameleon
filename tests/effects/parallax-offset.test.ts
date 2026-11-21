/**
 * The parallax shift is bounded.
 *
 * A parallax block stays in the page flow. The first version let it travel
 * without a limit: the closing block of the homepage slid 120 px down over the
 * footer on a phone. These tests hold the bound, and hold the snippet runtime
 * (a string) against the platform runtime (the function).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parallaxOffset,
  PARALLAX_MAX_TRAVEL,
  PARALLAX_TRAVEL_PER_SPEED,
} from "../../design-system/effects/parallax-offset.ts";
import { effectRuntimeJs } from "../../design-system/effects/effect-runtime.ts";

const PHONE = 844;

describe("parallaxOffset", () => {
  it("stands still in the middle of the screen", () => {
    assert.equal(parallaxOffset({ top: PHONE / 2 - 200, height: 400, viewport: PHONE, speed: 0.2, current: 0 }), 0);
  });

  it("keeps the direction: down when the block is above the middle, up when below", () => {
    assert.ok(parallaxOffset({ top: -300, height: 400, viewport: PHONE, speed: 0.2, current: 0 }) > 0);
    assert.ok(parallaxOffset({ top: 700, height: 400, viewport: PHONE, speed: 0.2, current: 0 }) < 0);
  });

  it("moves the closing block of a page no further than its travel, however far it is scrolled", () => {
    // The case from the phone: a block of 543 px, scrolled up until the footer
    // fills the screen. It used to be shifted 119 px.
    for (const top of [-200, -400, -543, -2000]) {
      const d = parallaxOffset({ top, height: 543, viewport: PHONE, speed: 0.2, current: 0 });
      assert.ok(d <= 0.2 * PARALLAX_TRAVEL_PER_SPEED, `top ${top}: ${d}`);
    }
    assert.equal(parallaxOffset({ top: -2000, height: 543, viewport: PHONE, speed: 0.2, current: 0 }), 20);
  });

  it("never exceeds the smallest section padding, at any speed", () => {
    for (const speed of [0.05, 0.2, 0.4, 0.6, 5]) {
      for (const top of [-5000, -600, -100, 0, 300, 900, 5000]) {
        const d = parallaxOffset({ top, height: 500, viewport: PHONE, speed, current: 0 });
        assert.ok(Math.abs(d) <= PARALLAX_MAX_TRAVEL, `speed ${speed}, top ${top}: ${d}`);
      }
    }
  });

  it("measures the block's own place, not where the last shift put it", () => {
    const own = parallaxOffset({ top: 100, height: 400, viewport: PHONE, speed: 0.2, current: 0 });
    // The same block, measured while it is shifted 15 px down.
    const shifted = parallaxOffset({ top: 115, height: 400, viewport: PHONE, speed: 0.2, current: 15 });
    assert.equal(shifted, own);
  });

  it("answers 0 for a block and a screen without height", () => {
    assert.equal(parallaxOffset({ top: 0, height: 0, viewport: 0, speed: 0.2, current: 0 }), 0);
  });
});

describe("the snippet runtime carries the same sum", () => {
  const js = effectRuntimeJs();
  const match = js.match(/var mcParallaxOffset = (function\(top, height, vh, speed, current\) \{[\s\S]*?\n      \});/);

  it("defines the function", () => {
    assert.ok(match, "mcParallaxOffset not found in the snippet runtime");
  });

  it("gives the same answer as the platform runtime", () => {
    const snippet = new Function(`return (${match![1]});`)() as (
      top: number, height: number, vh: number, speed: number, current: number,
    ) => number;
    for (const speed of [0.05, 0.2, 0.6]) {
      for (const top of [-2000, -543, -120, 0, 222, 700, 3000]) {
        for (const current of [0, 12.5, -20]) {
          const args = { top, height: 543, viewport: PHONE, speed, current };
          assert.equal(snippet(top, 543, PHONE, speed, current), parallaxOffset(args), JSON.stringify(args));
        }
      }
    }
  });

  it("no longer multiplies the distance to the middle by the speed", () => {
    assert.ok(!js.includes("- vh / 2) * -sp"));
  });
});
