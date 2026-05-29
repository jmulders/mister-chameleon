/**
 * Neutral Landing Plugin
 *
 * Prevents the hosted Studio from opening directly into a stale pane path
 * that was persisted in the browser's history or session (e.g. a URL like
 * /structure/tenants;workEngine saved from a previous visit).
 *
 * ─── How it works ─────────────────────────────────────────────────────────────
 *
 *   On the very first page-load of each browser session the plugin checks
 *   whether the current URL has navigated deeper than the structure root.
 *   If so, it navigates back to just /structure so the operator always starts
 *   from the neutral top-level workspace:
 *
 *     Shared content
 *     Tenants                ← operator chooses which tenant to enter
 *     All documents
 *
 *   A sessionStorage flag is written after the first check so the reset fires
 *   once only — subsequent navigation within the same tab (clicking into a
 *   tenant, refreshing while inside it, etc.) is never interrupted.
 *
 * ─── What it does NOT affect ──────────────────────────────────────────────────
 *
 *   • Intentional navigation inside the Studio — clicking Tenants → workEngine
 *     works exactly as before.
 *   • Direct document links shared between operators, once they have already
 *     navigated once in their current session.
 *   • The structure itself — tenant panes remain fully accessible.
 *
 * ─── Why this is needed ───────────────────────────────────────────────────────
 *
 *   Sanity Studio v3 uses the URL as the sole source of truth for the current
 *   pane state.  When a developer last had the Studio open at
 *   /structure/tenants;workEngine, the browser (or Sanity.io's manage page
 *   "Open Studio" link) remembers that URL.  Any subsequent cold-open
 *   to that saved URL replays the tenant pane directly, bypassing the neutral
 *   workspace entry point.
 *
 *   There is no built-in Sanity Studio option to suppress this behaviour, so
 *   a layout-level plugin is the correct interception point.
 */

import { definePlugin }            from "sanity";
import type { LayoutProps }        from "sanity";
import React, { useEffect }        from "react";
import { useRouter }               from "sanity/router";

// ── Session guard key ─────────────────────────────────────────────────────────

/**
 * Written to sessionStorage after the first check runs.
 * Prevents the reset from firing again within the same browser session so
 * that normal in-session navigation (and F5 reloads mid-session) is not
 * disturbed.
 */
const LANDING_GUARD_KEY = "mc:studio:landing-reset";

// ── Layout guard component ────────────────────────────────────────────────────

/**
 * Wraps the Studio's root layout component.
 *
 * On mount it runs the one-time session check and — when the URL is already
 * inside a deep structure path — navigates back to the neutral /structure root.
 *
 * We use Sanity's own exported `LayoutProps` type (from "sanity") so the
 * component signature matches what `definePlugin({ studio.components.layout })`
 * expects, without a local interface that may drift from the installed version.
 */
function NeutralLandingGuard(props: LayoutProps): React.ReactElement {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Only run once per browser tab session.
    if (sessionStorage.getItem(LANDING_GUARD_KEY)) return;
    sessionStorage.setItem(LANDING_GUARD_KEY, "1");

    const path = window.location.pathname;

    // Match any URL that is deeper than /structure, e.g.:
    //   /structure/tenants;workEngine   → deep (should reset)
    //   /structure/shared-content       → deep (should reset)
    //   /structure                      → root (already neutral, no action)
    //   /vision                         → different tool entirely, no action
    //
    // Capture group 1 = everything up to and including /structure.
    const match = path.match(/^(.*\/structure)(?:\/[^?#]+)/);
    if (!match) return;

    // Navigate to the neutral structure root, replacing the stale deep-link
    // in the browser history so the back button does not loop back to it.
    router.navigateUrl({ path: match[1] });
  }, [router]); // eslint-disable-line react-hooks/exhaustive-deps

  return props.renderDefault(props);
}

// ── Plugin export ─────────────────────────────────────────────────────────────

export const neutralLandingPlugin = definePlugin({
  name: "neutral-landing",
  studio: {
    components: {
      /**
       * Sanity Studio v3 lets plugins override the root layout component.
       * We use this to wrap the default layout with the one-time route guard
       * without altering any visual or behavioural aspect of the Studio.
       */
      layout: NeutralLandingGuard,
    },
  },
});
