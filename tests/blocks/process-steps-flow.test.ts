/**
 * The "flow" layout of the process steps block: a line the steps hang on,
 * with cards left and right of it in turn.
 *
 * The component is a .tsx file, which this test runner cannot import, so the
 * checks read the source.
 */
import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveBlockVariant } from "@/page-config/block-variants";

const source = readFileSync("components/blocks/sections/ProcessStepsBlock.tsx", "utf8");
const flow   = source.slice(source.indexOf('if (variant === "flow")'), source.indexOf("// ── default variant"));

describe("process steps, flow layout", () => {
  it("is a variant the block accepts", () => {
    assert.equal(resolveBlockVariant("processSteps", "flow"), "flow");
    // A name the block does not know still falls back to the numbered list.
    assert.equal(resolveBlockVariant("processSteps", "no-such-layout"), "default");
    assert.ok(flow.length > 0, "the component has no flow branch");
  });

  it("stays an ordered list, so the order reaches a screen reader", () => {
    assert.match(flow, /<ol /);
    assert.match(flow, /<li/);
  });

  it("lets a step start one row below the step before it and take two rows", () => {
    // Two rows per step is what keeps two cards on the same side from ever
    // overlapping: step n+2 starts where step n ends.
    assert.match(flow, /"--flow-row": index \+ 1/);
    assert.match(flow, /"--flow-span": last \? 1 : 2/);
    assert.match(flow, /md:\[grid-row:var\(--flow-row\)_\/_span_var\(--flow-span\)\]/);
  });

  it("draws the line from each node to the next, and none under the last", () => {
    assert.match(flow, /\{!last && <span aria-hidden="true"/);
  });

  it("puts the cards left and right in turn on a wide screen only", () => {
    assert.match(flow, /right \? "md:col-start-3" : "md:col-start-1"/);
    // On a phone every card stands right of the line.
    assert.match(flow, /className=\{`col-start-2 /);
  });

  it("keeps the numbered circle a brand layer can colour", () => {
    assert.match(flow, /<StepNumber n=\{index \+ 1\} large \/>/);
    assert.match(source, /data-part="step-number"/);
  });
});

// ── The "arrows" layout ───────────────────────────────────────────────────────
//
// A row of arrow-shaped blocks that slides sideways on a small screen. The
// owner asked for it on 25 Nov 2026, for the four steps on /hoe-het-werkt.

const arrows = source.slice(source.indexOf('if (variant === "arrows")'), source.indexOf("// ── flow variant"));

describe("process steps, arrows layout", () => {
  it("is a variant the block accepts", () => {
    assert.equal(resolveBlockVariant("processSteps", "arrows"), "arrows");
    assert.ok(arrows.length > 0, "the component has no arrows branch");
  });

  it("stays an ordered list", () => {
    assert.match(arrows, /<ol/);
    assert.match(arrows, /<li/);
  });

  it("slides with snap points and no script", () => {
    assert.match(arrows, /snap-x snap-mandatory/);
    assert.match(arrows, /overflow-x-auto/);
    assert.match(arrows, /className="snap-start"/);
    assert.doesNotMatch(source, /^"use client"/m);
  });

  it("shows the next arrow at the edge of a small screen, and all of them on a wide one", () => {
    // 78% leaves a strip of the next step in view, which is what says "swipe".
    assert.match(arrows, /auto-cols-\[78%\]/);
    assert.match(arrows, /lg:auto-cols-\[minmax\(13rem,1fr\)\]/);
  });

  it("can take focus, so the keyboard can scroll the row", () => {
    assert.match(arrows, /tabIndex=\{0\}/);
    assert.match(arrows, /aria-label=\{heading \|\| undefined\}/);
  });

  it("cuts a notch in every arrow but the first and leaves a gap between two", () => {
    assert.match(arrows, /clipPath:\s+first \? shapeFirst : shapeNext/);
    assert.match(arrows, /marginLeft:\s+first \? 0 : -\(POINT - GAP\)/);
    const point = Number(/const POINT = (\d+);/.exec(arrows)![1]);
    const gap   = Number(/const GAP   = (\d+);/.exec(arrows)![1]);
    assert.ok(gap > 0 && gap < point, "the arrows must not touch, and must still interlock");
  });

  it("takes its colour from the same hook as the numbered circle", () => {
    assert.match(arrows, /data-part="step-number"/);
    assert.match(arrows, /data-step=\{\(index % 6\) \+ 1\}/);
  });
});
