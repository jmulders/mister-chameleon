"use client";

/**
 * DemoProfilePanelMount — ssr:false mount for the DemoProfilePanel, so the site
 * layout can stay a Server Component (same pattern as ScenarioControlMount).
 */

import dynamic from "next/dynamic";

const DemoProfilePanel = dynamic(
  () =>
    import("@/components/scenario/DemoProfilePanel").then(
      (mod) => ({ default: mod.DemoProfilePanel }),
    ),
  { ssr: false },
);

export function DemoProfilePanelMount() {
  return <DemoProfilePanel />;
}
