/**
 * components/scenario/demo-controls-state.ts
 *
 * Whether Scenario Control is switched on in this browser.
 *
 * A tenant decides whether its site has Scenario Control at all
 * (debug.showScenarioControl). On such a site a visitor can switch the console
 * off and on for themselves: off means no panel and no button in the corner,
 * on any page. The choice is kept in the browser.
 *
 * Two switches set it: the one in the site menu (ScenarioControlSwitch) and
 * the one on /demo-controls (DemoControlsToggle). The panel listens. They talk
 * through one storage key and one window event, both named here so the three
 * cannot drift apart.
 */

export const DEMO_CONTROLS_STORAGE_KEY  = "mc_demo_controls_active";
export const DEMO_CONTROLS_CHANGE_EVENT = "mc_demo_controls_changed";

/** On unless the visitor switched it off: a browser that never chose has it on. */
export function demoControlsEnabledFrom(stored: string | null | undefined): boolean {
  return stored !== "0";
}

export function demoControlsStoredValue(enabled: boolean): "1" | "0" {
  return enabled ? "1" : "0";
}

/** The choice of this browser. On when storage cannot be read. */
export function readDemoControlsEnabled(): boolean {
  try {
    return demoControlsEnabledFrom(localStorage.getItem(DEMO_CONTROLS_STORAGE_KEY));
  } catch {
    return true;
  }
}

/**
 * Keep the choice and tell everything on the page that shows it. The event is
 * needed because a storage event does not fire in the tab that wrote.
 */
export function writeDemoControlsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(DEMO_CONTROLS_STORAGE_KEY, demoControlsStoredValue(enabled));
  } catch {
    // Storage unavailable: the choice lasts as long as the page.
  }
  try {
    window.dispatchEvent(new CustomEvent(DEMO_CONTROLS_CHANGE_EVENT, { detail: { enabled } }));
  } catch {
    // No window: nothing to tell.
  }
}

/** Call `onChange` whenever the choice changes on this page. Returns the unsubscribe. */
export function subscribeToDemoControls(onChange: (enabled: boolean) => void): () => void {
  const handle = (event: Event) => {
    const detail = (event as CustomEvent<{ enabled?: unknown }>).detail;
    if (detail && typeof detail.enabled === "boolean") onChange(detail.enabled);
  };
  window.addEventListener(DEMO_CONTROLS_CHANGE_EVENT, handle);
  return () => window.removeEventListener(DEMO_CONTROLS_CHANGE_EVENT, handle);
}
