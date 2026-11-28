/**
 * lib/theme/theme-swap.ts
 *
 * A theme that changes on a page that is already open changes in one step.
 *
 * The root layout writes the theme as custom properties in <head>. When a
 * scenario changes it (Scenario Control calls router.refresh()), React puts
 * the new values in those <style> tags and every element follows. But not at
 * the same moment: the header fades its background over 250 ms and every
 * button fades its colours over 150 ms, because their own transitions see a
 * changed colour. The hero has no transition and is there at once.
 *
 * A fade only moves when the browser draws frames. Measured on production on
 * 26 Nov 2026 in a browser pane that drew two frames a second: the hero was in
 * the Christmas theme and the header and its button still had the colours of
 * the theme before, for as long as no frame came. With the tab in view it is a
 * quarter of a second in which the page shows two themes.
 *
 * So during the swap nothing transitions. The attribute below is on <html>
 * from the moment React writes the new values until the browser has worked
 * them out, and a rule in app/globals.css turns transitions off while it is
 * there. No transition starts, so there is nothing that waits for a frame.
 *
 * Pure: no React, no DOM types beyond the two calls it makes.
 */

/** On <html> while a theme swap is being worked out. See app/globals.css. */
export const THEME_SWAP_ATTRIBUTE = "data-theme-swap";

/**
 * One short value for the theme a request painted. It changes when anything
 * in the given parts changes, and only then. FNV-1a, because all it has to do
 * is tell two themes apart.
 */
export function themeSignature(...parts: Array<string | null | undefined>): string {
  let hash = 0x811c9dc5;
  for (const part of parts) {
    const text = part ?? "";
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    // A boundary between parts, so ("ab", "c") and ("a", "bc") differ.
    hash ^= 0xff;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** The part of an element this module uses. */
export interface SwapRoot {
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

/** Transitions off. Call before the browser works out the new theme. */
export function holdTransitions(root: SwapRoot): void {
  root.setAttribute(THEME_SWAP_ATTRIBUTE, "");
}

/**
 * Transitions on again. `settle` makes the browser work out the styles now,
 * while transitions are still off; after it every element has its new colour
 * and nothing is left to start a transition. The attribute goes away whatever
 * `settle` does: left behind, it would turn off every transition on the page.
 */
export function releaseTransitions(root: SwapRoot, settle: () => void): void {
  try {
    settle();
  } finally {
    root.removeAttribute(THEME_SWAP_ATTRIBUTE);
  }
}
