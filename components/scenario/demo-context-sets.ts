/**
 * Demo Context Sets — per-tenant demo switcher configuration.
 *
 * The generic DemoStageSection persona picker uses SCENARIO_PRESETS. Some tenants
 * demo a different, business-specific set of contexts instead (e.g. a trailer
 * dealer: service customer / business owner / consumer / default). This registry
 * lets DemoStageSection render a tenant-specific set of one-click contexts.
 *
 * Each context activates a scenario with `bypass: true` and a `_scenarioKey` that
 * maps to an ExperiencePlan in lib/demo/demo-scenario-plans.ts — so the homepage
 * pipeline forces that plan directly, independent of production rules (which for
 * these tenants need real signals / domain data that a live prospect demo lacks).
 *
 * Demo-UI labels are English (house convention); the variant content itself is the
 * tenant's website copy (Dutch), authored per-tenant in platform_cms_content.
 */

import type { ScenarioOverrides } from "./scenario-store";

export interface DemoContext {
  /** Matches a key in DEMO_SCENARIO_PLANS. Forces that plan via the demo bypass. */
  key:       string;
  label:     string;   // English demo-UI label
  sub:       string;   // one-line description
  icon:      string;   // emoji avatar
  color:     string;   // avatar background
  /** Extra overrides merged in. `bypass: true` is added automatically on activate. */
  overrides?: ScenarioOverrides;
}

export const DEMO_CONTEXT_SETS: Record<string, DemoContext[]> = {
  cluistra: [
    { key: "cluistra_service",     label: "Service customer", sub: "Returning, visited a service page",   icon: "🔧", color: "#0f4c81" },
    { key: "cluistra_ondernemer",  label: "Business owner",   sub: "Sector landing or heavy trailer",     icon: "🏢", color: "#b45309" },
    { key: "cluistra_particulier", label: "Consumer",         sub: "Choice-helper or a light trailer",    icon: "🏡", color: "#166534" },
    { key: "cluistra_default",     label: "Default",          sub: "No context signal yet",               icon: "•",  color: "#64748b" },
  ],
};

/** The demo context set for a tenant, or null when the tenant uses the generic personas. */
export function getDemoContextSet(tenantId: string | null | undefined): DemoContext[] | null {
  if (!tenantId) return null;
  return DEMO_CONTEXT_SETS[tenantId] ?? null;
}

/**
 * A time-driven notification state for the live demo switcher — a second, optional
 * axis alongside the visitor context. Each maps to a notification variant key in
 * platform_cms_content. The snippet renders these as a small toggle so a prospect
 * can show the open / closed notification on their own site.
 */
export interface DemoNotif {
  /** Toggle key sent to the decide endpoint as `_demoNotif`. */
  key:             string;
  label:           string;   // English demo-UI label
  sub:             string;   // one-line description
  /** Matches a notification variant key in platform_cms_content. */
  notificationKey: string;
}

export const DEMO_NOTIF_SETS: Record<string, DemoNotif[]> = {
  cluistra: [
    { key: "open",   label: "Open",   sub: "During opening hours",  notificationKey: "notification_default" },
    { key: "closed", label: "Closed", sub: "Outside opening hours",  notificationKey: "notification_urgency" },
  ],
};

/** The demo notification set for a tenant, or null when the tenant has none. */
export function getDemoNotifSet(tenantId: string | null | undefined): DemoNotif[] | null {
  if (!tenantId) return null;
  return DEMO_NOTIF_SETS[tenantId] ?? null;
}

/**
 * A demo control for a declared custom attribute, so the scenario panel can flip
 * it and watch AttributeConditions react on the real rule path. `options` are the
 * values offered (plus an implicit "unset"); a boolean attribute uses true/false.
 */
export interface DemoAttribute {
  key:      string;   // matches a declared attribute name + customAttributes key
  label:    string;   // English demo-UI label
  kind:     "select" | "boolean";
  options?: (string | number)[];   // for kind "select"
}

export const DEMO_ATTRIBUTE_SETS: Record<string, DemoAttribute[]> = {
  cluistra: [
    { key: "categorie", label: "Category", kind: "select", options: ["kipper", "transporter", "bak"] },
    { key: "massa",     label: "Mass (kg)", kind: "select", options: [1200, 2200] },
    { key: "occasion",  label: "Occasion", kind: "boolean" },
  ],
};

/** The demo attribute set for a tenant, or null when the tenant has none. */
export function getDemoAttributeSet(tenantId: string | null | undefined): DemoAttribute[] | null {
  if (!tenantId) return null;
  return DEMO_ATTRIBUTE_SETS[tenantId] ?? null;
}
