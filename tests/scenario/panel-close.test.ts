/**
 * Scenario Control: opening and closing it, on a phone above all.
 *
 * The owner asked on 27 Nov 2026 for an easier way to close the console: on a
 * phone it was one very small button. The sizes and the Escape rule are in
 * panel-close.ts and tested directly. The panel is a .tsx file, which this
 * test runner cannot import, so the rest reads the source.
 */
import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  TOUCH_LAYOUT_QUERY, TOUCH_TARGET, HEADER_LINE, panelCloseSizes, panelWidthCss, escapeCloses,
} from "../../components/scenario/panel-close.ts";

const panel  = readFileSync("components/scenario/ScenarioControlPanel.tsx", "utf8");
const header = panel.slice(panel.indexOf("{/* Header */}"), panel.indexOf("{/* Scenario mode banner */}"));
const footer = panel.slice(panel.indexOf("{/* Footer */}"));
const part   = (source: string, name: string) =>
  new RegExp(`<button[^>]*?data-part="${name}"[\\s\\S]*?</button>`).exec(source)?.[0] ?? "";

describe("Scenario Control: sizes of the open and close controls", () => {
  it("gives a finger a full-size target on every control", () => {
    const sizes = panelCloseSizes(true);
    assert.ok(TOUCH_TARGET >= 44);
    assert.ok(sizes.opener.minHeight >= TOUCH_TARGET);
    assert.ok(sizes.headerClose.minHeight >= TOUCH_TARGET);
    assert.equal(sizes.footClose, true);
  });

  it("keeps the panel compact for a mouse, without the second close button", () => {
    const sizes = panelCloseSizes(false);
    assert.ok(sizes.opener.minHeight < TOUCH_TARGET);
    assert.ok(sizes.headerClose.minHeight < TOUCH_TARGET);
    // Still larger than the old 18 pixel "▾".
    assert.ok(sizes.headerClose.minHeight >= 24);
    assert.equal(sizes.footClose, false);
  });

  it("applies the phone layout to a coarse pointer and to a narrow screen", () => {
    assert.match(TOUCH_LAYOUT_QUERY, /pointer: coarse/);
    assert.match(TOUCH_LAYOUT_QUERY, /max-width: 640px/);
  });

  it("never makes the panel wider than the screen", () => {
    assert.equal(panelWidthCss(360, 16), "min(360px, calc(100vw - 32px))");
  });
});

describe("Scenario Control: the title on one line", () => {
  it("makes room in the header on a phone, and only there", () => {
    assert.equal(panelCloseSizes(true).compactHeader, true);
    assert.equal(panelCloseSizes(false).compactHeader, false);
    const title = part(header, "scenario-title");
    // The mask icon goes and the link gets a shorter word.
    assert.match(title, /\{!closeSizes\.compactHeader && <span[^>]*>🎭<\/span>\}/);
    assert.match(header, /closeSizes\.compactHeader \? "Variables ↗" : "All variables ↗"/);
  });

  it("never wraps the title or the scenario's name: what does not fit is cut", () => {
    assert.equal(HEADER_LINE.whiteSpace, "nowrap");
    assert.equal(HEADER_LINE.overflow, "hidden");
    assert.equal(HEADER_LINE.textOverflow, "ellipsis");
    const title = part(header, "scenario-title");
    // The title, the scenario's name and the line shown without a scenario.
    assert.equal((title.match(/\.\.\.HEADER_LINE/g) ?? []).length, 3);
    assert.match(title, /minWidth: 0/, "the title may shrink, or the ellipsis never shows");
  });
});

describe("Scenario Control: Escape", () => {
  it("closes the console", () => {
    assert.equal(escapeCloses("Escape", "BODY"), true);
    assert.equal(escapeCloses("Escape", "BUTTON"), true);
    assert.equal(escapeCloses("Escape", null), true);
  });

  it("leaves a field that is being typed in alone", () => {
    assert.equal(escapeCloses("Escape", "INPUT"), false);
    assert.equal(escapeCloses("Escape", "textarea"), false);
    assert.equal(escapeCloses("Escape", "SELECT"), false);
    assert.equal(escapeCloses("Escape", "DIV", true), false);
  });

  it("ignores every other key", () => {
    assert.equal(escapeCloses("Enter", "BODY"), false);
    assert.equal(escapeCloses("Esc", "BODY"), false);
  });
});

describe("Scenario Control: the controls in the panel", () => {
  it("opens and closes through one pair of functions that remember the choice", () => {
    assert.match(panel, /const collapse = useCallback\(/);
    assert.match(panel, /const expand = useCallback\(/);
    // No control writes the remembered state by hand any more.
    assert.equal((panel.match(/localStorage\.setItem\("mc_scenario_panel_minimized"/g) ?? []).length, 2);
    // /demo-controls exists to show the console and is not remembered as closed.
    assert.match(panel, /if \(pathname !== "\/demo-controls"\) localStorage\.setItem\("mc_scenario_panel_minimized", "1"\)/);
  });

  it("has an opener that says what it does and takes its size from the helper", () => {
    const opener = part(panel, "scenario-open");
    assert.ok(opener.length > 0, "the opener is gone");
    assert.match(opener, /onClick=\{expand\}/);
    assert.match(opener, /aria-label="Open Scenario Control"/);
    assert.match(opener, /minHeight: closeSizes\.opener\.minHeight/);
  });

  it("closes from the whole title and from a close button with a word on it", () => {
    const title = part(header, "scenario-title");
    assert.ok(title.length > 0, "the title is no button");
    assert.match(title, /onClick=\{collapse\}/);
    assert.match(title, /Scenario Control/);
    assert.match(title, /flex: 1/, "the title takes the room that is left");

    const close = part(header, "scenario-close");
    assert.ok(close.length > 0, "the close button is gone");
    assert.match(close, /onClick=\{collapse\}/);
    assert.match(close, /minHeight: closeSizes\.headerClose\.minHeight/);
    assert.match(close, /Close ▾/);
  });

  it("has a second close button at the foot, on a phone only", () => {
    const foot = part(footer, "scenario-close-foot");
    assert.ok(foot.length > 0, "the close button at the foot is gone");
    assert.match(foot, /onClick=\{collapse\}/);
    assert.match(footer, /closeSizes\.footClose \? \(/);
    // The size of the opener: it stands on the opener's spot.
    assert.match(foot, /minHeight: closeSizes\.opener\.minHeight/);
  });

  it("listens for Escape only while the console is open", () => {
    assert.match(panel, /if \(minimized \|\| !visible \|\| !demoControlsEnabled\) return;\s*\n\s*const onKey/);
    assert.match(panel, /escapeCloses\(e\.key, target\?\.tagName, target\?\.isContentEditable === true\)/);
  });

  it("sizes the panel to the screen", () => {
    assert.match(panel, /const panelWidth = panelWidthCss\(360, 16\);/);
  });
});
