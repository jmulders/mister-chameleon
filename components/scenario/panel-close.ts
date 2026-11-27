/**
 * components/scenario/panel-close.ts
 *
 * Opening and closing the Scenario Control console.
 *
 * The console used to close with one small "▾" in the top-right corner of a
 * panel that fills most of a phone screen: a target of about 22 by 18 pixels,
 * as far from the thumb as it could be, and nowhere near the button that had
 * opened the console. The owner asked for an easier way on 27 Nov 2026.
 *
 * Three ways to close now, and the sizes for them:
 *   - the title in the header is a button, the whole of it
 *   - the close button in the header has a word on it and a real size
 *   - on a phone a second close button stands in the foot of the panel, on the
 *     spot of the button that opened it, so open and close are one thumb
 *     position
 * Escape closes as well, except while typing in a field.
 */

/** The viewport or pointer for which the phone layout applies. */
export const TOUCH_LAYOUT_QUERY = "(pointer: coarse), (max-width: 640px)";

/** Smallest side of something a finger has to hit, in pixels. */
export const TOUCH_TARGET = 44;

export interface PanelCloseSizes {
  /** The floating button that opens the console. */
  opener:      { minHeight: number; padding: string; fontSize: number };
  /** The close button in the header. */
  headerClose: { minHeight: number; padding: string; fontSize: number };
  /** Whether the foot of the panel carries a close button of its own. */
  footClose:   boolean;
  /**
   * A header with less in it, so the title stays on one line on a phone. With
   * a scenario active the header also holds "Exit", and on a screen of 360 to
   * 375 pixels "Scenario Control" then broke over two lines: the mask icon
   * goes and the link to the variables gets a shorter word.
   */
  compactHeader: boolean;
}

/** Sizes of the open and close controls, for a mouse or for a finger. */
export function panelCloseSizes(touch: boolean): PanelCloseSizes {
  if (touch) {
    return {
      opener:      { minHeight: TOUCH_TARGET, padding: "0 18px", fontSize: 13 },
      headerClose: { minHeight: TOUCH_TARGET, padding: "0 12px", fontSize: 13 },
      footClose:   true,
      compactHeader: true,
    };
  }
  return {
    opener:      { minHeight: 30, padding: "0 14px", fontSize: 11 },
    headerClose: { minHeight: 26, padding: "0 10px", fontSize: 11 },
    footClose:   false,
    compactHeader: false,
  };
}

/**
 * The width of the open panel. On a phone 360 pixels plus the margin is wider
 * than the screen, which pushed the left edge, and with it the start of every
 * row, out of view.
 */
export function panelWidthCss(width: number, margin: number): string {
  return `min(${width}px, calc(100vw - ${margin * 2}px))`;
}

/** True when Escape should close the console: not while typing in a field. */
export function escapeCloses(key: string, targetTag: string | null | undefined, editable = false): boolean {
  if (key !== "Escape") return false;
  if (editable) return false;
  const tag = (targetTag ?? "").toLowerCase();
  return tag !== "input" && tag !== "textarea" && tag !== "select";
}

/**
 * One line of text in the header that never wraps: what does not fit is cut
 * with an ellipsis. For the title and for the scenario's name under it, which
 * can be as long as a tenant made its preset label.
 */
export const HEADER_LINE = {
  display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
} as const;
