"use client";

/**
 * ScenarioControlMount — client-only mount point for the ScenarioControlPanel.
 *
 * Next.js 13+ App Router enforces that `next/dynamic` with `{ ssr: false }` may
 * only be called from a Client Component.  This tiny wrapper satisfies that rule
 * while keeping app/(site)/layout.tsx a pure Server Component.
 *
 * The dynamic import with ssr:false means:
 *   • The ScenarioControlPanel module is never evaluated on the server.
 *   • All browser-only APIs (sessionStorage, window.location, URLSearchParams)
 *     used by the panel and its imports are safe.
 *   • No scenario-related code lands in the SSR bundle or affects TTFB.
 */

import dynamic from "next/dynamic";
import type { TenantScenarioPanelSettings, TenantScenarioPreset, TenantScenarioOverride } from "@/tenant/types";

const ScenarioControlPanel = dynamic(
  () =>
    import("@/components/scenario/ScenarioControlPanel").then(
      (mod) => ({ default: mod.ScenarioControlPanel }),
    ),
  { ssr: false },
);

export function ScenarioControlMount({
  scenarioPanel,
  scenarioPresets,
  scenarioOverrides,
}: {
  scenarioPanel?:     TenantScenarioPanelSettings | null;
  scenarioPresets?:   readonly TenantScenarioPreset[] | null;
  scenarioOverrides?: Readonly<Record<string, TenantScenarioOverride>> | null;
}) {
  return <ScenarioControlPanel scenarioPanel={scenarioPanel} scenarioPresets={scenarioPresets} scenarioOverrides={scenarioOverrides} />;
}
