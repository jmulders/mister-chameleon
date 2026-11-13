/**
 * When the Scenario Control console may ask the server for journey state.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import {
  shouldPollJourneyState,
  consoleIsActive,
  shouldFetchBackendState,
} from "@/components/scenario/journey-poll";

const OPEN = { minimized: false, visible: true, demoControlsEnabled: true, documentVisible: true };

describe("three-second poll", () => {
  it("runs while the console is open in a foreground tab", () => {
    assert.equal(shouldPollJourneyState(OPEN), true);
  });

  it("stops in a background tab", () => {
    assert.equal(shouldPollJourneyState({ ...OPEN, documentVisible: false }), false);
  });

  it("stops when the console is collapsed", () => {
    assert.equal(shouldPollJourneyState({ ...OPEN, minimized: true }), false);
  });

  it("stops when the console is not switched on for this browser", () => {
    assert.equal(shouldPollJourneyState({ ...OPEN, visible: false }), false);
  });

  it("stops when the demo-controls toggle switched the console off", () => {
    assert.equal(shouldPollJourneyState({ ...OPEN, demoControlsEnabled: false }), false);
  });
});

describe("console exists for this browser", () => {
  it("needs both the switch and the toggle", () => {
    assert.equal(consoleIsActive({ visible: true,  demoControlsEnabled: true  }), true);
    assert.equal(consoleIsActive({ visible: false, demoControlsEnabled: true  }), false);
    assert.equal(consoleIsActive({ visible: true,  demoControlsEnabled: false }), false);
  });
});

describe("asking the server for journey state", () => {
  it("is skipped without personalization consent, where the server answers with nothing", () => {
    assert.equal(shouldFetchBackendState({ personalization: false }), false);
    assert.equal(shouldFetchBackendState({}), false);
    assert.equal(shouldFetchBackendState(null), false);
    assert.equal(shouldFetchBackendState(undefined), false);
  });

  it("happens with personalization consent", () => {
    assert.equal(shouldFetchBackendState({ personalization: true }), true);
  });
});
