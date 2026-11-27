/**
 * The switch in the site menu that turns Scenario Control on and off.
 *
 * The owner asked for it on 27 Nov 2026. Until then the console could only be
 * switched off on /demo-controls, a page a visitor has to know about.
 *
 * The state helpers are tested directly. The components are .tsx files, which
 * this test runner cannot import, so the wiring is read from the source.
 */
import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DEMO_CONTROLS_STORAGE_KEY, DEMO_CONTROLS_CHANGE_EVENT,
  demoControlsEnabledFrom, demoControlsStoredValue,
} from "../../components/scenario/demo-controls-state.ts";
import { hasMobileMenuExtras } from "../../components/layout/mobile-menu.ts";

const read = (path: string) => readFileSync(path, "utf8");

describe("Scenario Control on or off: the state", () => {
  it("is on in a browser that never chose, and off only when switched off", () => {
    assert.equal(demoControlsEnabledFrom(null), true);
    assert.equal(demoControlsEnabledFrom(undefined), true);
    assert.equal(demoControlsEnabledFrom("1"), true);
    assert.equal(demoControlsEnabledFrom("0"), false);
    assert.equal(demoControlsEnabledFrom("anything else"), true);
  });

  it("is stored as 1 or 0, which reads back as the same choice", () => {
    for (const enabled of [true, false]) {
      assert.equal(demoControlsEnabledFrom(demoControlsStoredValue(enabled)), enabled);
    }
  });

  it("keeps the key and the event the panel has always used", () => {
    // A browser that switched the console off before this change stays off.
    assert.equal(DEMO_CONTROLS_STORAGE_KEY, "mc_demo_controls_active");
    assert.equal(DEMO_CONTROLS_CHANGE_EVENT, "mc_demo_controls_changed");
  });

  it("is named in one place: no component spells the key or the event itself", () => {
    for (const file of ["ScenarioControlPanel.tsx", "DemoControlsToggle.tsx", "ScenarioControlSwitch.tsx"]) {
      const code = read(`components/scenario/${file}`).replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");
      assert.equal(code.includes('"mc_demo_controls_active"'), false, `${file} spells the key`);
      assert.equal(code.includes('"mc_demo_controls_changed"'), false, `${file} spells the event`);
    }
  });
});

describe("Scenario Control on or off: the three places follow each other", () => {
  const panel  = read("components/scenario/ScenarioControlPanel.tsx");
  const toggle = read("components/scenario/DemoControlsToggle.tsx");
  const menu   = read("components/scenario/ScenarioControlSwitch.tsx");

  it("the switch in the menu writes the choice and listens for it", () => {
    assert.match(menu, /writeDemoControlsEnabled\(next\)/);
    assert.match(menu, /return subscribeToDemoControls\(setEnabled\);/);
    assert.match(menu, /role="switch"/);
    assert.match(menu, /aria-checked=\{enabled\}/);
  });

  it("the switch on /demo-controls does the same", () => {
    assert.match(toggle, /writeDemoControlsEnabled\(next\)/);
    assert.match(toggle, /return subscribeToDemoControls\(setEnabled\);/);
  });

  it("the panel reads the choice, follows it, and opens when switched on", () => {
    assert.match(panel, /setDemoControlsEnabled\(readDemoControlsEnabled\(\)\);/);
    assert.match(panel, /subscribeToDemoControls\(\(enabled\) => \{\s*setDemoControlsEnabled\(enabled\);\s*if \(enabled\) setMinimized\(false\);/);
    // Switched off there is no panel and no button in the corner.
    assert.match(panel, /if \(!demoControlsEnabled\) return null;/);
  });

  it("renders as on before the browser's choice is known, at a fixed width", () => {
    // What a browser that never chose has; and the links beside it do not move.
    assert.match(menu, /useState\(true\)/);
    assert.doesNotMatch(menu, /return null/);
    assert.match(menu, /width: track\.width/);
  });
});

describe("Scenario Control on or off: where the switch stands", () => {
  const header = read("components/layout/Header.tsx");
  const tabs   = read("components/layout/SectionTabs.tsx");
  const nav    = read("components/layout/NavBar.tsx");

  it("only on a site whose tenant has Scenario Control", () => {
    assert.match(header, /const scenarioSwitch = tenantSettings\?\.debug\?\.showScenarioControl === true;/);
    assert.match(header, /trailing=\{scenarioSwitch \? <ScenarioControlSwitch variant="band" \/> : null\}/);
    assert.match(header, /\n\s+scenarioSwitch,\n\s+\};/);
    // No other mention: nothing renders it without the tenant's setting.
    assert.equal((header.match(/<ScenarioControlSwitch/g) ?? []).length, 1);
  });

  it("at the right end of the top band, after the quick links", () => {
    assert.match(tabs, /trailing\?:\s+React\.ReactNode;/);
    assert.ok(tabs.indexOf("{trailing}") > tabs.indexOf("quickLinks.map("), "the switch comes after the quick links");
  });

  it("in the menu on a phone, where switching closes the menu", () => {
    assert.match(nav, /\{extras\?\.scenarioSwitch && \(/);
    assert.match(nav, /<ScenarioControlSwitch variant="menu" onSwitched=\{\(\) => setMenuOpen\(false\)\} \/>/);
    // Above the call to action, which closes the menu.
    assert.ok(nav.indexOf("mobile-menu-scenario-switch") < nav.indexOf("mobile-menu-cta"));
  });

  it("makes the phone menu worth opening on its own", () => {
    assert.equal(hasMobileMenuExtras({ scenarioSwitch: true }), true);
    assert.equal(hasMobileMenuExtras({ scenarioSwitch: false }), false);
    assert.equal(hasMobileMenuExtras({}), false);
  });
});
