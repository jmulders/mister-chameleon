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
    assert.match(flow, /<StepNumber n=\{index \+ 1\} large connect=/);
    assert.match(source, /data-part="step-number"/);
  });

  it("ties every node to its own card with an arm in the step's colour", () => {
    // The owner on 25 Nov 2026: with interleaving cards it is not clear which
    // card belongs to which step. The card's side decides where the arm goes.
    assert.match(flow, /connect=\{right \? "after" : "before"\}/);
    const node = source.slice(source.indexOf("function StepNumber("), source.indexOf("// ── Block component"));
    // Arm and tab sit inside the circle, so they inherit the brand's step colour.
    assert.match(node, /var\(--mc-step, var\(--primary\)\)/);
    assert.equal(node.match(/aria-hidden="true"/g)?.length, 2, "an arm and a tab, both decoration");
    // On a phone the card is always after the circle, on either setting.
    assert.match(node, /"left-full md:left-auto md:right-full"/);
    // Other layouts draw the plain circle.
    assert.match(node, /\{connect && \(/);
  });
});

// ── The "arrows" layout ───────────────────────────────────────────────────────
//
// Arrow-shaped blocks that point from one step to the next. The owner asked for
// them on 25 Nov 2026, for the four steps on /hoe-het-werkt. The first version
// slid sideways on a phone. The owner found that unclear the same day: one
// step filled the screen and the other three sat behind a swipe. Now the steps
// stack on a narrow screen and the arrows point down, all the same size.

const arrows = source.slice(source.indexOf('if (variant === "arrows")'), source.indexOf("// ── flow variant"));

describe("process steps, arrows layout", () => {
  it("is a variant the block accepts", () => {
    assert.equal(resolveBlockVariant("processSteps", "arrows"), "arrows");
    assert.ok(arrows.length > 0, "the component has no arrows branch");
  });

  it("stays an ordered list, with no script", () => {
    assert.match(arrows, /<ol/);
    assert.match(arrows, /<li/);
    assert.doesNotMatch(source, /^"use client"/m);
  });

  it("stacks the steps on a narrow screen and does not slide there", () => {
    const list = /<ol[\s\S]*?className="([^"]+)"/.exec(arrows)![1].split(" ");
    assert.ok(list.includes("flex") && list.includes("flex-col"), "the steps must stack below lg");
    // Scrolling sideways belongs to the wide row only.
    assert.ok(list.includes("lg:overflow-x-auto"));
    assert.ok(!list.includes("overflow-x-auto"), "a phone must show every step without a swipe");
    assert.doesNotMatch(arrows, /snap-x|auto-cols-\[78%\]/);
  });

  it("puts the steps side by side on a wide screen", () => {
    assert.match(arrows, /lg:grid-flow-col/);
    assert.match(arrows, /lg:auto-cols-\[minmax\(13rem,1fr\)\]/);
  });

  it("can take focus, so the keyboard can scroll the wide row", () => {
    assert.match(arrows, /tabIndex=\{0\}/);
    assert.match(arrows, /aria-label=\{heading \|\| undefined\}/);
  });

  it("points down when stacked and right in the row", () => {
    assert.match(arrows, /\[clip-path:var\(--arrow-down\)\]/);
    assert.match(arrows, /lg:\[clip-path:var\(--arrow-right\)\]/);
    assert.match(arrows, /"--arrow-down":\s+downShape/);
    assert.match(arrows, /"--arrow-right":\s+first \? rightFirst : rightNext/);
    // Down: the point is in the middle of the bottom edge.
    assert.match(arrows, /const down\s+= `[^`]*50% 100%/);
    // Right: the point is in the middle of the right edge.
    assert.match(arrows, /const right\s+= `[^`]*100% 50%/);
  });

  // The first stacked version made an arrow as tall as its step. Four steps
  // with four lengths of text gave four sizes of arrow, and the owner did not
  // find that pretty (25 Nov 2026).
  it("gives every stacked arrow the same size, whatever the length of the text", () => {
    const arrow = /data-part="step-number"[\s\S]*?className="([^"]+)"/.exec(arrows)![1].split(" ");
    assert.ok(arrow.includes("h-[4.25rem]") && arrow.includes("shrink-0"), "a stacked arrow must have a fixed height");
    // One shape for every step: stacked arrows do not interlock.
    assert.match(arrows, /const downShape\s+= `polygon\(0 0, \$\{down\}\)`/);
    assert.doesNotMatch(arrows, /downNext|mt-\[var\(--arrow-pull\)\]/);
  });

  it("joins two stacked arrows with a dashed line that takes up the length", () => {
    assert.match(arrows, /\{!last && \(\s*<span aria-hidden="true" className="my-1\.5 w-0\.5 flex-1 lg:hidden" style=\{lineStyle\} \/>/);
    assert.match(arrows, /const last\s+= index === items\.length - 1;/);
  });

  it("cuts a notch in every arrow of the row but the first and leaves a gap between two", () => {
    assert.match(arrows, /const rightNext\s+= `polygon\(0 0, \$\{right\}, \$\{POINT\}px 50%\)`/);
    assert.match(arrows, /"--arrow-pull":\s+`\$\{first \? 0 : -\(POINT - GAP\)\}px`/);
    assert.match(arrows, /lg:ml-\[var\(--arrow-pull\)\]/);
    const point = Number(/const POINT = (\d+);/.exec(arrows)![1]);
    const gap   = Number(/const GAP   = (\d+);/.exec(arrows)![1]);
    assert.ok(gap > 0 && gap < point, "the arrows must not touch, and must still interlock");
  });

  it("shows the title once: beside the arrow when stacked, in it in the row", () => {
    assert.equal(arrows.match(/\{step\.title\}/g)?.length, 2);
    assert.match(arrows, /<span className="hidden lg:inline">\{step\.title\}<\/span>/);
    assert.match(arrows, /className="block [^"]*lg:hidden"[^>]*>\s*\{step\.title\}/);
  });

  it("takes its colour from the same hook as the numbered circle", () => {
    assert.match(arrows, /data-part="step-number"/);
    assert.match(arrows, /data-step=\{\(index % 6\) \+ 1\}/);
  });
});
