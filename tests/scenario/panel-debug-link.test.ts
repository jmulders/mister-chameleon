/**
 * Scenario Control links to the page with every context variable.
 *
 * The owner asked on 26 Nov 2026 where to see what the site found for a visit,
 * all context variables with their value. That page is /engine-debug. The
 * panel's tabs show a part of it, and nothing pointed to the full list.
 *
 * The panel is a .tsx file, which this test runner cannot import, so these
 * checks read the source.
 */
import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const panel = readFileSync("components/scenario/ScenarioControlPanel.tsx", "utf8");
const link  = /<a\s+data-part="scenario-debug-link"[\s\S]*?<\/a>/.exec(panel)?.[0] ?? "";

describe("Scenario Control: link to the context variables", () => {
  it("is there, and points at the debug page that exists", () => {
    assert.ok(link.length > 0, "the link is gone");
    assert.match(link, /href=\{ENGINE_DEBUG_PATH\}/);
    assert.match(panel, /const ENGINE_DEBUG_PATH = "\/engine-debug";/);
    assert.ok(existsSync("app/(site)/engine-debug/page.tsx"), "the page it points at is gone");
  });

  it("opens in a new tab, so the page being looked at stays open", () => {
    assert.match(link, /target="_blank"/);
    assert.match(link, /rel="noopener"/);
  });

  it("stands in the header, so it is there on every tab and never behind a notification", () => {
    const header = panel.slice(panel.indexOf("{/* Header */}"), panel.indexOf("{/* Scenario mode banner */}"));
    assert.ok(header.includes('data-part="scenario-debug-link"'), "the link is not in the header");
    // In the footer it wrapped over two lines and a notification card covered it.
    const footer = panel.slice(panel.indexOf("{/* Footer */}"));
    assert.equal(footer.includes("scenario-debug-link"), false);
  });

  it("stays on one line", () => {
    assert.match(link, /whiteSpace: "nowrap"/);
  });

  it("says what it leads to", () => {
    assert.match(link, /All variables/);
    assert.match(link, /title="Every context variable of this visit, with its value"/);
  });
});
