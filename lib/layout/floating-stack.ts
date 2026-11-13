/**
 * lib/layout/floating-stack.ts
 *
 * Keeps the small things that float in the bottom corners of a page from
 * landing on top of each other.
 *
 * There is one bottom row for launchers: the cookie-settings pill on the left
 * and the scenario-console button on the right. A corner toast sits above that
 * row when the row is taken on its side. On a narrow screen a toast spans the
 * width, so it clears the row when either side is taken.
 *
 * A launcher claims its side by setting an attribute on <html>; the rules in
 * app/globals.css turn that into an offset. Measured on the live site on a
 * phone, 13 Nov 2026: the knowledge-base toast, the console button and the
 * cookie pill lay on top of each other and the pill could not be reached.
 */

export type ToastSide = "left" | "right";

/** Attribute a launcher sets on <html> while it is on screen. */
export const LAUNCHER_ATTRIBUTE = {
  left:  "data-cookie-launcher",
  right: "data-scenario-launcher",
} as const satisfies Record<ToastSide, string>;

/** CSS `bottom` for a corner toast on the given side. */
export function toastBottom(side: ToastSide): string {
  return `calc(1.25rem + var(--floating-offset-${side}, 0px))`;
}

/** Claim or release a side of the launcher row. Safe to call on the server. */
export function claimLauncherSide(side: ToastSide, claimed: boolean): void {
  if (typeof document === "undefined") return;
  const attribute = LAUNCHER_ATTRIBUTE[side];
  if (claimed) document.documentElement.setAttribute(attribute, "");
  else document.documentElement.removeAttribute(attribute);
}
