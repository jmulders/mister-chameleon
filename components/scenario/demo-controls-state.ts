/**
 * components/scenario/demo-controls-state.ts
 *
 * Whether Scenario Control is switched on in this browser.
 *
 * A tenant decides whether its site has Scenario Control at all
 * (debug.showScenarioControl). On such a site a visitor can switch the console
 * on and off for themselves: off means no panel and no button in the corner,
 * on any page. The choice is kept in the browser.
 *
 * It starts off. A visitor who never chose sees the site as it is, and finds
 * the switch in the menu. The owner asked for that on 27 Nov 2026: until then
 * every first visit had the button of the console in the corner. An address
 * with ?scenario=true switches it on, so a link to a demo still opens it.
 *
 * Two switches set it: the one in the site menu (ScenarioControlSwitch) and
 * the one on /demo-controls (DemoControlsToggle). The panel listens. They talk
 * through one storage key and one window event, both named here so the three
 * cannot drift apart.
 */

export const DEMO_CONTROLS_STORAGE_KEY  = "mc_demo_controls_active";
export const DEMO_CONTROLS_CHANGE_EVENT = "mc_demo_controls_changed";

/** Off unless the visitor switched it on: a browser that never chose has it off. */
export function demoControlsEnabledFrom(stored: string | null | undefined): boolean {
  return stored === "1";
}

/** True when the address asks for the console: ?scenario=true. */
export function demoControlsAskedInAddress(search: string | null | undefined): boolean {
  try {
    return new URLSearchParams(search ?? "").get("scenario") === "true";
  } catch {
    // An unreadable query string is no request for the console.
    return false;
  }
}

export function demoControlsStoredValue(enabled: boolean): "1" | "0" {
  return enabled ? "1" : "0";
}

/** The choice of this browser. Off when storage cannot be read. */
export function readDemoControlsEnabled(): boolean {
  try {
    return demoControlsEnabledFrom(localStorage.getItem(DEMO_CONTROLS_STORAGE_KEY));
  } catch {
    return false;
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
