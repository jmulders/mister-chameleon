/**
 * components/scenario/panel-start.ts
 *
 * Whether the Scenario Control console starts collapsed to its floating button.
 *
 * On a tenant that shows the console to every visitor (production tenant
 * "statamic"), a first-time visitor used to get it open, on top of the page.
 * It now starts collapsed: the button is there for whoever wants it, and the
 * page is not covered for everyone else.
 */

export interface PanelStartInput {
  /** window.location.pathname */
  pathname: string;
  /** window.location.search, e.g. "?scenario=true" */
  search:   string;
  /** localStorage "mc_scenario_panel_minimized": "1", "0", or null when never set. */
  stored:   string | null;
}

/**
 * True when the console should start collapsed.
 *
 *   /demo-controls            always open: the page exists to show the console
 *   a remembered choice       wins: "0" open, "1" collapsed
 *   ?scenario=true            open: the visitor asked for it in the address
 *   a first visit             collapsed
 */
export function startsMinimized(input: PanelStartInput): boolean {
  if (input.pathname === "/demo-controls") return false;
  if (input.stored === "0") return false;
  if (input.stored === "1") return true;
  try {
    if (new URLSearchParams(input.search).get("scenario") === "true") return false;
  } catch {
    // An unreadable query string is no request to open the console.
  }
  return true;
}
