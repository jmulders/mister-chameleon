/**
 * The launcher row: a corner toast sits above the small launchers in the
 * bottom corners instead of on top of them.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toastBottom, LAUNCHER_ATTRIBUTE, claimLauncherSide } from "@/lib/layout/floating-stack";

describe("corner toast", () => {
  it("reads the offset of its own side and stays at 1.25rem without one", () => {
    assert.equal(toastBottom("right"), "calc(1.25rem + var(--floating-offset-right, 0px))");
    assert.equal(toastBottom("left"),  "calc(1.25rem + var(--floating-offset-left, 0px))");
  });

  it("uses that position in the block, not a fixed class", () => {
    const source = readFileSync("components/blocks/NotificationBlock.tsx", "utf8");
    assert.match(source, /bottom: toastBottom\(/);
    assert.doesNotMatch(source, /\$\{anchor\} bottom-5 \$\{corner\}/);
  });
});

describe("launchers", () => {
  it("each claim one side", () => {
    assert.equal(LAUNCHER_ATTRIBUTE.left,  "data-cookie-launcher");
    assert.equal(LAUNCHER_ATTRIBUTE.right, "data-scenario-launcher");
  });

  it("do nothing on the server", () => {
    assert.doesNotThrow(() => claimLauncherSide("left", true));
    assert.doesNotThrow(() => claimLauncherSide("right", false));
  });

  it("are the ones that set the attributes", () => {
    assert.match(readFileSync("components/tracking/CookiePreferences.tsx", "utf8"), /claimLauncherSide\("left", true\)/);
    assert.match(readFileSync("components/scenario/ScenarioControlPanel.tsx", "utf8"), /claimLauncherSide\("right", shown\)/);
  });
});

describe("the offsets in the stylesheet", () => {
  const css = readFileSync("app/globals.css", "utf8");

  it("lift a toast on the side of the launcher", () => {
    assert.match(css, /html\[data-cookie-launcher\]\s*\{\s*--floating-offset-left: 44px;/);
    assert.match(css, /html\[data-scenario-launcher\]\s*\{\s*--floating-offset-right: 44px;/);
  });

  it("lift a toast on either side on a narrow screen", () => {
    const narrow = css.slice(css.indexOf("@media (max-width: 639px) {\n  html[data-cookie-launcher]"));
    assert.match(narrow, /--floating-offset-left: 44px;\s*--floating-offset-right: 44px;/);
  });
});
