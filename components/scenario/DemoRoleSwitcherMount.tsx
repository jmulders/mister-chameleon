"use client";

/**
 * DemoRoleSwitcherMount — ssr:false mount voor de DemoRoleSwitcher, zodat
 * app/(site)/layout.tsx een Server Component kan blijven (net als
 * ScenarioControlMount). De schakelaar rendert nooit op de server.
 */

import dynamic from "next/dynamic";

const DemoRoleSwitcher = dynamic(
  () =>
    import("@/components/scenario/DemoRoleSwitcher").then(
      (mod) => ({ default: mod.DemoRoleSwitcher }),
    ),
  { ssr: false },
);

export function DemoRoleSwitcherMount() {
  return <DemoRoleSwitcher />;
}
