"use client";

/**
 * Makes a theme change on an open page happen in one step.
 *
 * The root layout hands over a signature of the theme it painted. When a
 * refresh brings another one, transitions are off for the length of that one
 * commit, so the header and the buttons take their new colours together with
 * the rest instead of fading after it. Why: lib/theme/theme-swap.ts.
 *
 * The two effects are the two ends of the commit. The insertion effect runs
 * while React writes the DOM, before any other component's layout effect can
 * ask the browser for a measurement (which would work out the new styles and
 * start the fades). The layout effect ends it.
 */

import { useInsertionEffect, useLayoutEffect, useRef } from "react";
import { holdTransitions, releaseTransitions } from "@/lib/theme/theme-swap";

export function ThemeSwapGuard({ signature }: { signature: string }) {
  // The theme that is on screen. Starts as the one the server rendered, so
  // the first render does nothing.
  const painted = useRef(signature);

  useInsertionEffect(() => {
    if (painted.current !== signature) holdTransitions(document.documentElement);
  }, [signature]);

  useLayoutEffect(() => {
    if (painted.current === signature) return;
    painted.current = signature;
    // Reading a layout value makes the browser work out every style now.
    releaseTransitions(document.documentElement, () => void document.body.offsetHeight);
  }, [signature]);

  return null;
}
