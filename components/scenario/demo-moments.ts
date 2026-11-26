/**
 * The time and the moment a demo can pretend it is.
 *
 * The Demo tab of the Scenario Control panel had three time buttons: day,
 * evening and weekend. A site that looks different in the morning could not
 * show that, and a site that changes at Christmas could not show it in
 * November. The owner asked on 26 Nov 2026 for morning, afternoon, evening and
 * weekend, and for moments such as Valentine's Day, Easter, Halloween,
 * Christmas and a day the national team plays.
 *
 * A moment is nothing new to the rule engine. It is one of two values a rule
 * can already test:
 *
 *   seasonalEvent — the calendar windows the platform knows (context/time.ts)
 *   dateKey       — one day, for a moment of the tenant's own. A rule lists
 *                   the days ("dateKey in [...]"), the button picks one.
 *
 * So a button here only sets what a real visit on that day would have.
 *
 * Pure: no I/O, no React.
 */

import type { ScenarioOverrides } from "./scenario-store";

// ── Time ─────────────────────────────────────────────────────────────────────

/**
 * The ids a tenant can list in `scenarioPanel.timeOptions`. "day" is the
 * afternoon: it kept its id, because tenants have it stored.
 */
export type DemoTimeId = "morning" | "day" | "evening" | "night" | "weekend";

export const TIME_OPTIONS: { id: DemoTimeId; label: string }[] = [
  { id: "morning", label: "Morning" },
  { id: "day",     label: "Afternoon" },
  { id: "evening", label: "Evening" },
  // Added on 26 Nov 2026, when the owner gave the night colours of its own.
  { id: "night",   label: "Night" },
  { id: "weekend", label: "Weekend" },
];

export function isDemoTimeId(value: unknown): value is DemoTimeId {
  return TIME_OPTIONS.some((option) => option.id === value);
}

/** What a time button sets. The hour is one inside its part of the day. */
export function timeOverrides(kind: DemoTimeId): Pick<ScenarioOverrides, "timeOfDay" | "currentHour" | "isWeekend"> {
  switch (kind) {
    case "morning": return { timeOfDay: "morning",   currentHour: 9,  isWeekend: false };
    case "day":     return { timeOfDay: "afternoon", currentHour: 14, isWeekend: false };
    case "evening": return { timeOfDay: "evening",   currentHour: 20, isWeekend: false };
    case "night":   return { timeOfDay: "night",     currentHour: 23, isWeekend: false };
    case "weekend": return { timeOfDay: "afternoon", currentHour: 14, isWeekend: true  };
  }
}

/** Which time button is active. Null when the time is the real one. */
export function activeTime(o: ScenarioOverrides): DemoTimeId | null {
  if (o.isWeekend) return "weekend";
  if (o.timeOfDay === "night") return "night";
  if (o.timeOfDay === "evening") return "evening";
  if (o.timeOfDay === "morning") return "morning";
  if (o.timeOfDay) return "day";
  return null;
}

/** The time as the readout names it. */
export function timeLabel(o: ScenarioOverrides): string {
  const id = activeTime(o);
  return id ? TIME_OPTIONS.find((option) => option.id === id)!.label : "Now (real time)";
}

// ── Moments ──────────────────────────────────────────────────────────────────

/** The calendar windows a moment can stand for. */
export const MOMENT_EVENTS = [
  "new-year", "valentines", "easter", "back-to-school", "halloween", "black-friday", "cyber-monday", "christmas",
] as const;
export type MomentEvent = (typeof MOMENT_EVENTS)[number];

/**
 * One button under "Simulate a moment". It has a calendar window or a day,
 * not both: a button with both would set a day outside its own window.
 */
export interface DemoMoment {
  readonly key:   string;
  readonly label: string;
  /** A calendar window the platform knows. */
  readonly seasonalEvent?: MomentEvent;
  /** One day, "YYYY-MM-DD", for a moment of the tenant's own. */
  readonly dateKey?: string;
}

/** The moments a tenant gets who listed none. */
export const BUILTIN_MOMENTS: readonly DemoMoment[] = [
  { key: "valentines", label: "Valentine's Day", seasonalEvent: "valentines" },
  { key: "easter",     label: "Easter",          seasonalEvent: "easter" },
  { key: "halloween",  label: "Halloween",       seasonalEvent: "halloween" },
  { key: "christmas",  label: "Christmas",       seasonalEvent: "christmas" },
];

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** True for a day that exists: "2027-02-30" is not one. */
function isRealDay(value: string): boolean {
  if (!DAY.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * The moments of the panel. A tenant's own list (`scenarioPanel.moments`)
 * takes the place of the built-in one. An entry that cannot work is left out:
 * no key, no label, neither a window nor a day, both, an unknown window, a day
 * that does not exist, or a key that came before. A list with nothing usable
 * gives the built-in moments, so a typing error never empties the row.
 */
export function panelMoments(stored: unknown): DemoMoment[] {
  if (!Array.isArray(stored)) return [...BUILTIN_MOMENTS];
  const seen = new Set<string>();
  const moments: DemoMoment[] = [];
  for (const raw of stored) {
    if (!raw || typeof raw !== "object") continue;
    const item  = raw as Record<string, unknown>;
    const key   = typeof item.key === "string" ? item.key.trim() : "";
    const label = typeof item.label === "string" ? item.label.trim() : "";
    if (!key || !label || seen.has(key)) continue;
    const event = (MOMENT_EVENTS as readonly unknown[]).includes(item.seasonalEvent) ? (item.seasonalEvent as MomentEvent) : null;
    const day   = typeof item.dateKey === "string" && isRealDay(item.dateKey) ? item.dateKey : null;
    if ((event === null) === (day === null)) continue;
    seen.add(key);
    moments.push(event ? { key, label, seasonalEvent: event } : { key, label, dateKey: day! });
  }
  return moments.length > 0 ? moments : [...BUILTIN_MOMENTS];
}

/**
 * The overrides with `moment` set, or with no moment when it is null. Only the
 * two fields of a moment change: a role or a time the demo already set stays.
 */
export function withMoment(o: ScenarioOverrides, moment: DemoMoment | null): ScenarioOverrides {
  const next: ScenarioOverrides = { ...o };
  delete next.seasonalEvent;
  delete next.dateKey;
  if (moment?.seasonalEvent) next.seasonalEvent = moment.seasonalEvent;
  if (moment?.dateKey)       next.dateKey       = moment.dateKey;
  return next;
}

/** The moment that is active, or null. */
export function activeMoment(o: ScenarioOverrides, moments: readonly DemoMoment[]): DemoMoment | null {
  if (typeof o.dateKey === "string" && o.dateKey) {
    const byDay = moments.find((moment) => moment.dateKey === o.dateKey);
    if (byDay) return byDay;
  }
  if (typeof o.seasonalEvent === "string" && o.seasonalEvent !== "none") {
    return moments.find((moment) => moment.seasonalEvent === o.seasonalEvent) ?? null;
  }
  return null;
}

// ── A row of buttons ─────────────────────────────────────────────────────────

/** What a row of buttons in the panel has to spend, in px. The panel is 360 wide. */
export const BUTTON_ROW_WIDTH = 330;
/** One character of a button label: 11 px, semi-bold. Measured at 5.7, rounded up. */
const LABEL_CHAR = 6;
/** Around the label: 4 px padding and a 1 px border on each side. */
const BUTTON_CHROME = 10;
const BUTTON_GAP = 6;

const buttonWidth = (label: string) => label.length * LABEL_CHAR + BUTTON_CHROME;

/**
 * How many buttons go on one line. All of them when they fit: five moments
 * stood as four and one, the one stretched over the whole second line. When
 * they do not fit they are spread evenly over as few lines as it takes (six as
 * three and three, not five and one). The buttons stand in a grid, so a column
 * is as wide as its widest label.
 *
 * Both rows use it, the times and the moments. Five times in columns of equal
 * width would cut "Afternoon" short.
 */
export function buttonColumns(labels: readonly string[], width: number = BUTTON_ROW_WIDTH): number {
  const n = labels.length;
  if (n <= 1) return 1;
  const fits = (columns: number) => {
    let total = BUTTON_GAP * (columns - 1);
    for (let c = 0; c < columns; c++) {
      let widest = 0;
      for (let i = c; i < n; i += columns) widest = Math.max(widest, buttonWidth(labels[i]!));
      total += widest;
    }
    return total <= width;
  };
  for (let rows = 1; rows <= n; rows++) {
    const columns = Math.ceil(n / rows);
    if (fits(columns)) return columns;
  }
  return 1;
}

/**
 * True when the overrides say nothing a visit would notice. The demo then
 * goes back to the real visit, in place of a scenario that changes nothing.
 */
export function isEmptyScenario(o: ScenarioOverrides): boolean {
  return Object.keys(o).every((key) => key === "_scenarioKey");
}
