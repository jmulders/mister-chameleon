"use client";

/**
 * JourneyDebugMount — client-only mount point for JourneyDebugPanel.
 *
 * JourneyDebugPanel (and its internal ConsentDebugPanel) produce different
 * output on the server vs the client because they call:
 *
 *   • getConsent()              — reads window.__mc_consent; server returns
 *                                  default/no-consent state, client returns
 *                                  the visitor's actual consent choice.
 *   • getJourneyStoreEvents()   — reads window.__journey; empty on server.
 *   • getJourneyStoreVisitorId/
 *     getJourneyStoreSessionId  — same: undefined on server, real IDs on client.
 *
 * Even though JourneyDebugPanel carries "use client", React still runs it on
 * the server to produce the initial HTML — it just marks the boundary where
 * client JS takes over.  When the initial-state values differ between server
 * and hydration, React throws a hydration mismatch.
 *
 * The only correct fix (without suppressHydrationWarning or typeof window
 * hacks) is to prevent the component from producing ANY server HTML at all.
 * next/dynamic with { ssr: false } does exactly that: the slot is empty in
 * the SSR pass and the component mounts only after hydration, so there is no
 * HTML to mismatch.
 *
 * This thin wrapper is a Client Component (required by Next.js — dynamic with
 * ssr:false may only be called from a Client Component) and accepts the same
 * props as JourneyDebugPanel, forwarding them unchanged.
 */

import dynamic from "next/dynamic";
import type { JourneyDebugPanelProps } from "./JourneyDebugPanel";

const JourneyDebugPanel = dynamic(
  () =>
    import("./JourneyDebugPanel").then(
      (mod) => ({ default: mod.JourneyDebugPanel }),
    ),
  { ssr: false },
);

export function JourneyDebugMount(props: JourneyDebugPanelProps) {
  return <JourneyDebugPanel {...props} />;
}
