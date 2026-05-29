/**
 * Scenario System — Public API
 *
 * Everything a consuming component needs to work with scenario overrides.
 * Import from this barrel rather than individual files.
 */

export type { ScenarioOverrides, ScenarioState } from "./scenario-store";
export {
  getScenarioState,
  activateScenario,
  patchScenarioOverride,
  clearScenario,
  subscribeToScenario,
  isScenarioActive,
} from "./scenario-store";

export type { ScenarioPreset } from "./scenario-presets";
export { SCENARIO_PRESETS, SCENARIO_PRESET_LIST } from "./scenario-presets";

export type { DemoFlow, DemoFlowStep, DemoFlowProgress, ProgressCallback } from "./demo-flows";
export { DEMO_FLOWS, DEMO_FLOW_LIST, runDemoFlow } from "./demo-flows";

export { applyScenarioOverride } from "./apply-scenario-override";

export { ScenarioControlPanel } from "./ScenarioControlPanel";
