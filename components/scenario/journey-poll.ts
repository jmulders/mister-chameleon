/**
 * components/scenario/journey-poll.ts
 *
 * When the Scenario Control console may ask the server for journey state.
 *
 * ─── Why ──────────────────────────────────────────────────────────────────────
 *
 * The console asks /api/journey/state every three seconds. On a tenant that
 * shows the console to every visitor (production tenant "statamic", measured
 * 13 Nov 2026) that came to twenty calls a minute per open tab, also from tabs
 * in the background and from visitors who gave no consent, for whom the server
 * answers with nothing. Since 27 May 2026 the two reads behind that endpoint
 * ran about 400,000 times each, against 26,500 page views.
 *
 * These rules decide when a call is worth making. They change nothing about
 * what the console shows.
 */

export interface JourneyPollInput {
  /** The console is collapsed to its floating button. */
  minimized:           boolean;
  /** The console is switched on for this browser (dev, env flag or ?scenario=true). */
  visible:             boolean;
  /** The toggle on /demo-controls has not switched the console off. */
  demoControlsEnabled: boolean;
  /** The tab is in the foreground (document.visibilityState === "visible"). */
  documentVisible:     boolean;
}

/**
 * True when the console is open on screen in a foreground tab. Only then is the
 * three-second poll worth running: nobody reads a collapsed, hidden or
 * switched-off console, and a background tab has nobody looking at it.
 */
export function shouldPollJourneyState(input: JourneyPollInput): boolean {
  return input.visible
    && input.demoControlsEnabled
    && !input.minimized
    && input.documentVisible;
}

/**
 * True when the console exists for this browser at all. When it does not, the
 * component renders nothing and should not fetch or record anything either.
 */
export function consoleIsActive(input: Pick<JourneyPollInput, "visible" | "demoControlsEnabled">): boolean {
  return input.visible && input.demoControlsEnabled;
}

/**
 * True when the server has journey state to give. /api/journey/state returns
 * `journey: null` without personalization consent, so the call is skipped and
 * the console works from its local events, exactly as it did with that answer.
 */
export function shouldFetchBackendState(consent: { personalization?: boolean } | null | undefined): boolean {
  return consent?.personalization === true;
}
