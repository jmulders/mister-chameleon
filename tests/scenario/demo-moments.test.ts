/**
 * The time and the moment a demo can pretend it is.
 *
 * The owner asked on 26 Nov 2026 for morning, afternoon, evening and weekend
 * under "Simulate time", and for moments beside them: Valentine's Day, Easter,
 * Halloween, Christmas and a day the national team plays.
 *
 * A moment sets one of two values a rule can already test: the calendar
 * window (`seasonalEvent`) or the day (`dateKey`). The panel is a client
 * component that cannot be rendered here, so those checks read the source.
 */

import { describe, it } from "node:test";
import assert           from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  BUILTIN_MOMENTS, MOMENT_EVENTS, TIME_OPTIONS,
  activeMoment, activeTime, isDemoTimeId, isEmptyScenario, panelMoments, timeLabel, timeOverrides, withMoment,
} from "@/components/scenario/demo-moments";
import type { DemoMoment } from "@/components/scenario/demo-moments";
import { FIELD_REGISTRY }    from "@/decision/rules/field-registry";
import type { RuleEvaluationContext } from "@/decision/rules/field-registry";
import { evaluateCondition } from "@/decision/rules/stored-rule";
import type { RuleCondition } from "@/decision/rules/stored-rule";
import { buildTimeContext }  from "@/context/time";
import { validateTenantSettings } from "@/tenant/tenant-store";
import { resolveThemeDecision } from "@/decision/theme-decision";
import { getDesignPreset } from "@/tenant/design-presets-gallery";

const ctxWith = (fields: object) => fields as unknown as RuleEvaluationContext;

describe("simulate time", () => {
  it("offers morning, afternoon, evening and weekend", () => {
    assert.deepEqual(TIME_OPTIONS.map((o) => o.label), ["Morning", "Afternoon", "Evening", "Weekend"]);
  });

  it("keeps the id tenants have stored for the afternoon", () => {
    assert.deepEqual(TIME_OPTIONS.map((o) => o.id), ["morning", "day", "evening", "weekend"]);
    assert.equal(isDemoTimeId("day"), true);
    assert.equal(isDemoTimeId("afternoon"), false);
    assert.equal(isDemoTimeId(undefined), false);
  });

  it("sets what a visit at that time has", () => {
    assert.deepEqual(timeOverrides("morning"), { timeOfDay: "morning",   currentHour: 9,  isWeekend: false });
    assert.deepEqual(timeOverrides("day"),     { timeOfDay: "afternoon", currentHour: 14, isWeekend: false });
    assert.deepEqual(timeOverrides("evening"), { timeOfDay: "evening",   currentHour: 20, isWeekend: false });
    assert.deepEqual(timeOverrides("weekend"), { timeOfDay: "afternoon", currentHour: 14, isWeekend: true  });
  });

  it("sets an hour that lies in its own part of the day", () => {
    // The platform derives the part of the day from the hour: the two must agree.
    for (const option of TIME_OPTIONS) {
      const set  = timeOverrides(option.id);
      const real = buildTimeContext(new Date(Date.UTC(2026, 10, 25, set.currentHour!, 30)), "UTC");
      assert.equal(real.timeOfDay, set.timeOfDay, option.id);
    }
  });

  it("marks the button that is active, and names it in the readout", () => {
    for (const option of TIME_OPTIONS) {
      assert.equal(activeTime(timeOverrides(option.id)), option.id);
      assert.equal(timeLabel(timeOverrides(option.id)), option.label);
    }
    assert.equal(activeTime({}), null);
    assert.equal(timeLabel({}), "Now (real time)");
    assert.equal(activeTime({ timeOfDay: "night" }), "evening");
  });

  it("is the list the admin page curates and the settings type allows", () => {
    const types = readFileSync("tenant/types.ts", "utf8");
    assert.match(types, /readonly timeOptions\?: readonly \("morning" \| "day" \| "evening" \| "weekend"\)\[\];/);
    const admin = readFileSync("app/admin/tenants/[tenantId]/debug/_components/ScenarioPanelCurationClient.tsx", "utf8");
    assert.match(admin, /timeOptions: \[\.\.\.times\]\.filter\(isDemoTimeId\),/);
  });
});

describe("the moments of the panel", () => {
  const own = [
    { key: "kerst",  label: "Kerst",         seasonalEvent: "christmas" },
    { key: "oranje", label: "Oranje speelt", dateKey: "2027-03-27" },
  ];

  it("offers Valentine's Day, Easter, Halloween and Christmas when the tenant lists none", () => {
    assert.deepEqual(BUILTIN_MOMENTS.map((m) => m.label), ["Valentine's Day", "Easter", "Halloween", "Christmas"]);
    assert.deepEqual(panelMoments(undefined), [...BUILTIN_MOMENTS]);
    assert.deepEqual(panelMoments(null), [...BUILTIN_MOMENTS]);
    assert.deepEqual(panelMoments([]), [...BUILTIN_MOMENTS]);
    assert.deepEqual(panelMoments("kerst"), [...BUILTIN_MOMENTS]);
  });

  it("shows the tenant's own list in its place, in the tenant's order", () => {
    assert.deepEqual(panelMoments(own), own);
  });

  it("leaves out an entry that cannot work", () => {
    const list = panelMoments([
      ...own,
      { key: "kerst", label: "Nog een Kerst", seasonalEvent: "christmas" },          // key came before
      { key: "geen", label: "Geen van beide" },                                       // neither
      { key: "beide", label: "Beide", seasonalEvent: "easter", dateKey: "2027-03-28" }, // both
      { key: "onbekend", label: "Onbekend", seasonalEvent: "koningsdag" },            // unknown window
      { key: "none", label: "Niets", seasonalEvent: "none" },                         // not a moment
      { key: "dag", label: "Geen dag", dateKey: "27-03-2027" },                       // not YYYY-MM-DD
      { key: "februari", label: "30 februari", dateKey: "2027-02-30" },               // does not exist
      { key: "", label: "Zonder sleutel", seasonalEvent: "easter" },
      { key: "zonder", label: "  ", seasonalEvent: "easter" },
      null, "kerst", 42,
    ]);
    assert.deepEqual(list, own);
  });

  it("falls back to the built-in moments when nothing in the list can work", () => {
    assert.deepEqual(panelMoments([{ key: "x", label: "X" }]), [...BUILTIN_MOMENTS]);
  });

  it("knows only windows the rule engine knows", () => {
    const allowed = FIELD_REGISTRY.seasonalEvent.allowedValues ?? [];
    for (const event of MOMENT_EVENTS) assert.ok(allowed.includes(event), event);
    for (const moment of BUILTIN_MOMENTS) assert.ok(allowed.includes(moment.seasonalEvent!), moment.key);
  });
});

describe("picking a moment", () => {
  const kerst:  DemoMoment = { key: "kerst",  label: "Kerst",         seasonalEvent: "christmas" };
  const oranje: DemoMoment = { key: "oranje", label: "Oranje speelt", dateKey: "2027-03-27" };
  const list = [kerst, oranje];

  it("sets the calendar window or the day, and nothing else", () => {
    assert.deepEqual(withMoment({}, kerst), { seasonalEvent: "christmas" });
    assert.deepEqual(withMoment({}, oranje), { dateKey: "2027-03-27" });
  });

  it("keeps the role and the time the demo already set", () => {
    const before = { audienceSegmentIds: "demo-role-bureau", ...timeOverrides("evening") };
    assert.deepEqual(withMoment(before, kerst), { ...before, seasonalEvent: "christmas" });
  });

  it("holds one moment at a time", () => {
    assert.deepEqual(withMoment(withMoment({}, kerst), oranje), { dateKey: "2027-03-27" });
    assert.deepEqual(withMoment(withMoment({}, oranje), kerst), { seasonalEvent: "christmas" });
  });

  it("takes the moment away again", () => {
    assert.deepEqual(withMoment({ isWeekend: true, seasonalEvent: "christmas" }, null), { isWeekend: true });
    assert.deepEqual(withMoment({ dateKey: "2027-03-27" }, null), {});
  });

  it("does not change the overrides it was given", () => {
    const before = { seasonalEvent: "christmas" as const };
    withMoment(before, oranje);
    assert.deepEqual(before, { seasonalEvent: "christmas" });
  });

  it("marks the moment that is active", () => {
    assert.equal(activeMoment(withMoment({}, kerst), list), kerst);
    assert.equal(activeMoment(withMoment({}, oranje), list), oranje);
    assert.equal(activeMoment({}, list), null);
    assert.equal(activeMoment({ seasonalEvent: "none" }, list), null);
    assert.equal(activeMoment({ seasonalEvent: "halloween" }, list), null);
    assert.equal(activeMoment({ dateKey: "2027-01-01" }, list), null);
  });

  it("goes back to the real visit when taking the moment away leaves nothing", () => {
    assert.equal(isEmptyScenario(withMoment({ _scenarioKey: "demo_moment", seasonalEvent: "christmas" }, null)), true);
    assert.equal(isEmptyScenario({}), true);
    assert.equal(isEmptyScenario(withMoment({ _scenarioKey: "demo_time", isWeekend: true, seasonalEvent: "christmas" }, null)), false);
  });
});

describe("a rule sees the moment", () => {
  const cond = (field: string, operator: string, value: unknown) => ({ type: "field", field, operator, value }) as unknown as RuleCondition;

  it("matches on the calendar window", () => {
    const rule = cond("seasonalEvent", "equals", "christmas");
    assert.equal(evaluateCondition(rule, ctxWith(withMoment({}, { key: "k", label: "Kerst", seasonalEvent: "christmas" }))), true);
    assert.equal(evaluateCondition(rule, ctxWith({ seasonalEvent: "none" })), false);
  });

  it("matches on a day from a list, which is how a tenant names a moment of its own", () => {
    const rule = cond("dateKey", "in", ["2027-03-27", "2027-03-30"]);
    assert.equal(evaluateCondition(rule, ctxWith(withMoment({}, { key: "o", label: "Oranje speelt", dateKey: "2027-03-27" }))), true);
    assert.equal(evaluateCondition(rule, ctxWith({ dateKey: "2027-03-28" })), false);
  });
});

describe("the colours of a moment", () => {
  // The rules a tenant stores for this: a moment above the times of day.
  const plan = (themePresetId: string) => ({ heroKey: "hero_default", ctaKey: "cta_default", proofKey: "proof_default", themePresetId });
  const config = {
    version: 1,
    rules: [
      { id: "theme.moment.oranje", label: "Oranje speelt", enabled: true, priority: 64, plan: plan("teamnl-oranje"),
        condition: { type: "field", field: "dateKey", operator: "in", value: ["2024-07-10"] } },
      { id: "theme.moment.kerst", label: "Kerst", enabled: true, priority: 65, plan: plan("christmas"),
        condition: { type: "field", field: "seasonalEvent", operator: "equals", value: "christmas" } },
      { id: "theme.evening", label: "Evening", enabled: true, priority: 66, plan: plan("midnight-amber"),
        condition: { type: "field", field: "timeOfDay", operator: "equals", value: "evening" } },
      { id: "theme.day", label: "Day", enabled: true, priority: 67, plan: plan("ibiza-rush-bone"),
        condition: { type: "field", field: "timeOfDay", operator: "in", value: ["morning", "afternoon"] } },
    ],
  } as unknown as Parameters<typeof resolveThemeDecision>[0];
  const real = { timeOfDay: "afternoon", currentHour: 14, isWeekend: false, seasonalEvent: "none", dateKey: "2026-11-26" };
  const preset = (overrides: object) =>
    resolveThemeDecision(config, ctxWith({ ...real, ...overrides }), "custom" as never, null, null, null).resolvedPresetId;

  it("is the time of day on an ordinary day", () => {
    assert.equal(preset({}), "ibiza-rush-bone");
    assert.equal(preset(timeOverrides("evening")), "midnight-amber");
  });

  it("goes before the time of day", () => {
    const kerst = withMoment({}, { key: "kerst", label: "Kerst", seasonalEvent: "christmas" });
    assert.equal(preset(kerst), "christmas");
    assert.equal(preset({ ...timeOverrides("evening"), ...kerst }), "christmas");
  });

  it("turns orange on a day from the list and on no other day", () => {
    assert.equal(preset(withMoment({}, { key: "oranje", label: "Oranje speelt", dateKey: "2024-07-10" })), "teamnl-oranje");
    assert.equal(preset({ dateKey: "2024-07-11" }), "ibiza-rush-bone");
  });

  it("uses presets that exist", () => {
    for (const id of ["teamnl-oranje", "christmas", "halloween", "spring-bloom", "valentine-romance"]) {
      assert.ok(getDesignPreset(id), id);
    }
  });
});

describe("the panel", () => {
  const demo  = readFileSync("components/scenario/DemoStageSection.tsx", "utf8");
  const panel = readFileSync("components/scenario/ScenarioControlPanel.tsx", "utf8");

  it("has a row of moments under the time buttons", () => {
    const time    = demo.indexOf(">Simulate time<");
    const moments = demo.indexOf(">Simulate a moment<");
    assert.ok(time > 0 && moments > time, "the moment row must come after the time row");
    assert.match(demo, /data-part="scenario-moments"/);
    assert.match(demo, /\{momentList\.map\(\(item\) => \(/);
  });

  it("lets the buttons wrap: five moments do not fit on one line", () => {
    assert.match(demo, /data-part="scenario-moments" style=\{\{ display: "flex", flexWrap: "wrap", gap: 6 \}\}/);
  });

  it("takes the moment away on a second click, and leaves no empty scenario behind", () => {
    assert.match(demo, /const taken = moment\?\.key === next\.key;/);
    assert.match(demo, /withMoment\(scenario\.overrides \?\? \{\}, taken \? null : next\)/);
    assert.match(demo, /if \(isEmptyScenario\(base\)\) clearScenario\(\);/);
    // The scenario does not keep the name of a moment that was taken away.
    assert.match(demo, /activateScenario\(base, "demo_moment", taken \? "Demo" : next\.label\)/);
  });

  it("says in the readout which moment it is", () => {
    assert.match(demo, /<Row label="Moment"\s+value=\{moment \? moment\.label : "None"\} \/>/);
  });

  it("gets the tenant's moments from the settings", () => {
    assert.match(panel, /moments=\{scenarioPanel\?\.moments\}/);
  });
});

describe("the settings", () => {
  it("keeps the moments when the admin page saves the lists it does edit", () => {
    const actions = readFileSync("app/admin/tenants/[tenantId]/debug/actions.ts", "utf8");
    assert.match(actions, /const keptMoments = panel\.moments \?\? stored\.scenarioPanel\?\.moments;/);
    assert.match(actions, /if \(keptMoments && keptMoments\.length > 0\) clean\.moments = keptMoments;/);
  });

  it("accepts a list of moments and refuses anything else", () => {
    const base = {
      tenantId:   "acme",
      packageKey: "starter",
      features:   { experiments: false, ai: false, analytics: false },
      blocks:     { context: [], content: [] },
      ai:         { mode: "disabled" },
      cms:        { provider: "mock" },
      design:     { theme: "default" },
    };
    const moments = [{ key: "kerst", label: "Kerst", seasonalEvent: "christmas" }, { key: "oranje", label: "Oranje speelt", dateKey: "2027-03-27" }];
    const good = validateTenantSettings({ ...base, scenarioPanel: { timeOptions: ["morning", "day"], moments } });
    assert.equal(good.ok, true);
    if (good.ok) assert.deepEqual(good.data.scenarioPanel?.moments, moments);
    for (const wrong of ["kerst", ["kerst"], [{ key: "kerst" }], [{ label: "Kerst" }], [null]]) {
      const bad = validateTenantSettings({ ...base, scenarioPanel: { moments: wrong } });
      assert.equal(bad.ok, false, JSON.stringify(wrong));
      if (!bad.ok) assert.match(bad.error, /scenarioPanel\.moments/);
    }
  });
});
