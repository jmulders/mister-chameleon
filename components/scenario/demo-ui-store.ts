"use client";

/**
 * demo-ui-store — gedeelde inklap-state voor de prospect-gerichte demo-chrome.
 *
 * Governs the two demo panels (DemoRoleSwitcher top-bar + DemoProfilePanel
 * left window) as one unit: één keer inklappen ruimt beide op, uitklappen laat
 * alles weer zien. This is separate from the operator ScenarioControlPanel,
 * which keeps its own minimize (bottom-right).
 *
 * Module-level singleton (shared across client components in the same bundle)
 * with a listener set, persisted in localStorage so the choice survives reloads.
 */

const KEY = "mc_demo_chrome_collapsed";

type Listener = (collapsed: boolean) => void;
const listeners = new Set<Listener>();

function read(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Current collapsed state (false = expanded, everything shown). */
export function isDemoChromeCollapsed(): boolean {
  return read();
}

/** Set collapsed state, persist, and notify all panels. */
export function setDemoChromeCollapsed(collapsed: boolean): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore quota/availability errors — state still propagates in-memory */
    }
  }
  listeners.forEach((l) => l(collapsed));
}

/** Flip collapsed ↔ expanded. */
export function toggleDemoChrome(): void {
  setDemoChromeCollapsed(!read());
}

/** Subscribe to collapse changes. Returns an unsubscribe function. */
export function subscribeDemoChrome(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
