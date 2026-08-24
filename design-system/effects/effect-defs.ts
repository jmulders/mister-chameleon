/**
 * Declarative block effects — the single source of truth.
 *
 * An "effect" is a named, declarative animation applied to a content block
 * (entrance reveals, emphasis, later parallax / sticky / Ken Burns). Effects are
 * DECLARATIVE only: a block references an effect by id and supplies typed params
 * (duration, delay, distance). There is no raw-JS upload path — the runtime is a
 * fixed, versioned player that only knows how to run the effects defined here.
 *
 * ─── Three tiers (same cascade as block tokens) ───────────────────────────────
 *
 *   1. Tenant default effects       (design.defaultEffects)      — lowest
 *   2. Named effect set             (design.effectSets, by key)  — middle
 *   3. Per-block inline effects      (block.effects.effects)      — highest
 *
 *   resolveBlockEffects() applies whole-tier precedence (inline replaces set
 *   replaces tenant default) and honours a `disabled` flag at any tier.
 *
 * ─── Versioned runtime ────────────────────────────────────────────────────────
 *
 *   EFFECT_SCHEMA_VERSION is emitted on the wrapper (data-mc-fx-v) and the client
 *   runtime declares the versions it can play. A block authored under v1 keeps
 *   working when a v2 runtime ships, because the runtime branches on the version.
 *
 * Pure module: no React, no DOM, no app imports — safe to unit-test.
 */

/** Bump when the on-wire effect config shape changes in a breaking way. */
export const EFFECT_SCHEMA_VERSION = 1 as const;
export type EffectSchemaVersion = typeof EFFECT_SCHEMA_VERSION;

export type EffectTrigger = "scroll" | "hover" | "load";
export type EffectGroupKey = "entrance" | "emphasis" | "continuous";

/** A declarative, typed parameter for an effect (rendered as a form control). */
export interface EffectParamDef {
  key:      string;
  label:    string;
  type:     "number" | "select";
  /** number params */
  min?:     number;
  max?:     number;
  step?:    number;
  unit?:    string;
  /** select params */
  options?: ReadonlyArray<{ value: string; label: string }>;
  default:  string | number;
  /** The CSS custom property this param drives on the wrapper (number/select). */
  cssVar?:  string;
}

export interface EffectDefinition {
  /** Stable id used on the wire and as the CSS hook (`mc-fx-<id>`). Never rename. */
  id:            string;
  label:         string;
  group:         EffectGroupKey;
  description:   string;
  trigger:       EffectTrigger;
  /**
   * Advanced effects (parallax / sticky / Ken Burns) are default-off: they are
   * only applied when explicitly enabled, and the runtime feature-detects support
   * before activating. Entrance / emphasis effects are on when referenced.
   */
  defaultOff?:    boolean;
  featureDetect?: boolean;
  params?:        readonly EffectParamDef[];
}

// ── Shared param defs ─────────────────────────────────────────────────────────

const DURATION: EffectParamDef = {
  key: "duration", label: "Duration", type: "number", min: 100, max: 2000, step: 50,
  unit: "ms", default: 600, cssVar: "--mc-fx-duration",
};
const DELAY: EffectParamDef = {
  key: "delay", label: "Delay", type: "number", min: 0, max: 1500, step: 50,
  unit: "ms", default: 0, cssVar: "--mc-fx-delay",
};
const DISTANCE: EffectParamDef = {
  key: "distance", label: "Distance", type: "number", min: 4, max: 80, step: 2,
  unit: "px", default: 24, cssVar: "--mc-fx-distance",
};
const EASING: EffectParamDef = {
  key: "easing", label: "Easing", type: "select",
  options: [
    { value: "ease",        label: "Ease" },
    { value: "ease-out",    label: "Ease out" },
    { value: "ease-in-out", label: "Ease in-out" },
    { value: "linear",      label: "Linear" },
  ],
  default: "ease", cssVar: "--mc-fx-ease",
};
const BLUR_START: EffectParamDef = {
  key: "blur", label: "Blur start", type: "number", min: 2, max: 24, step: 1,
  unit: "px", default: 8, cssVar: "--mc-fx-blur",
};
const SCALE_START: EffectParamDef = {
  key: "scaleStart", label: "Scale start", type: "number", min: 0.5, max: 0.95, step: 0.05,
  default: 0.8, cssVar: "--mc-fx-scale-start",
};
const FLIP_ANGLE: EffectParamDef = {
  key: "angle", label: "Angle", type: "number", min: 4, max: 45, step: 1,
  unit: "deg", default: 12, cssVar: "--mc-fx-angle",
};
const WIPE_DIRECTION: EffectParamDef = {
  key: "direction", label: "Direction", type: "select",
  // Option values ARE the initial clip-path inset; .mc-fx-in clears it to inset(0).
  options: [
    { value: "inset(0 0 100% 0)", label: "Reveal down" },
    { value: "inset(100% 0 0 0)", label: "Reveal up" },
    { value: "inset(0 100% 0 0)", label: "Reveal from left" },
    { value: "inset(0 0 0 100%)", label: "Reveal from right" },
  ],
  default: "inset(0 0 100% 0)", cssVar: "--mc-fx-wipe-inset",
};

// ── v1 registry (reduced-motion-safe entrance + emphasis) ─────────────────────
//
// Advanced continuous effects (parallax / sticky / Ken Burns) are added in a
// follow-up alongside their runtime; the registry is the SoT and grows per set.

export const EFFECT_DEFINITIONS: readonly EffectDefinition[] = [
  {
    id: "reveal", label: "Reveal (fade + rise)", group: "entrance",
    description: "Fades in and rises slightly as the block scrolls into view.",
    trigger: "scroll", params: [DURATION, DELAY, DISTANCE],
  },
  {
    id: "fade-in", label: "Fade in", group: "entrance",
    description: "Fades in as the block scrolls into view.",
    trigger: "scroll", params: [DURATION, DELAY],
  },
  {
    id: "slide-in-up", label: "Slide in (up)", group: "entrance",
    description: "Slides up into place as the block scrolls into view.",
    trigger: "scroll", params: [DURATION, DELAY, DISTANCE],
  },
  {
    id: "slide-in-left", label: "Slide in (from left)", group: "entrance",
    description: "Slides in from the left as the block scrolls into view.",
    trigger: "scroll", params: [DURATION, DELAY, DISTANCE],
  },
  {
    id: "slide-in-right", label: "Slide in (from right)", group: "entrance",
    description: "Slides in from the right as the block scrolls into view.",
    trigger: "scroll", params: [DURATION, DELAY, DISTANCE],
  },
  {
    id: "zoom-in", label: "Zoom in", group: "entrance",
    description: "Scales up slightly from 96% as the block scrolls into view.",
    trigger: "scroll", params: [DURATION, DELAY],
  },
  {
    id: "slide-in-down", label: "Slide in (down)", group: "entrance",
    description: "Slides down into place as the block scrolls into view.",
    trigger: "scroll", params: [DISTANCE, DURATION, DELAY, EASING],
  },
  {
    id: "blur-in", label: "Blur in", group: "entrance",
    description: "Sharpens from a soft blur as the block scrolls into view.",
    trigger: "scroll", params: [BLUR_START, DURATION, DELAY],
  },
  {
    id: "pop", label: "Pop (bounce in)", group: "entrance",
    description: "Scales up with a slight overshoot as the block scrolls into view.",
    trigger: "scroll", params: [SCALE_START, DURATION, DELAY],
  },
  {
    id: "flip-in", label: "Flip in", group: "entrance",
    description: "Rotates into place in 3D as the block scrolls into view. Falls back to a fade where 3D transforms are unsupported.",
    trigger: "scroll", params: [FLIP_ANGLE, DURATION, DELAY],
  },
  {
    id: "wipe-reveal", label: "Wipe reveal", group: "entrance",
    description: "Reveals the block behind a directional clip-path wipe as it scrolls into view.",
    trigger: "scroll", params: [WIPE_DIRECTION, DURATION, DELAY],
  },
  {
    id: "hover-lift", label: "Hover lift", group: "emphasis",
    description: "Lifts the block on hover. No scroll trigger, no reduced-motion concern.",
    trigger: "hover",
    params: [{
      key: "lift", label: "Lift", type: "number", min: 1, max: 16, step: 1,
      unit: "px", default: 4, cssVar: "--mc-fx-lift",
    }],
  },
  {
    id: "pulse", label: "Pulse", group: "emphasis",
    description: "A subtle continuous scale pulse to draw attention. Fully off under reduced-motion.",
    trigger: "load",
    params: [
      { key: "scale", label: "Scale", type: "number", min: 1.01, max: 1.2, step: 0.01, default: 1.04, cssVar: "--mc-fx-pulse-scale" },
      { key: "interval", label: "Interval", type: "number", min: 600, max: 4000, step: 100, unit: "ms", default: 1600, cssVar: "--mc-fx-pulse-interval" },
    ],
  },
  {
    id: "glow-pulse", label: "Glow pulse", group: "emphasis",
    description: "A soft box-shadow glow that pulses in a brand colour. Fully off under reduced-motion.",
    trigger: "load",
    params: [
      {
        key: "color", label: "Colour", type: "select",
        options: [
          { value: "var(--primary)", label: "Primary" },
          { value: "var(--accent)",  label: "Accent" },
          { value: "var(--secondary)", label: "Secondary" },
        ],
        default: "var(--primary)", cssVar: "--mc-fx-glow-color",
      },
      { key: "intensity", label: "Intensity", type: "number", min: 4, max: 40, step: 2, unit: "px", default: 14, cssVar: "--mc-fx-glow-size" },
      { key: "interval", label: "Interval", type: "number", min: 600, max: 4000, step: 100, unit: "ms", default: 1800, cssVar: "--mc-fx-glow-interval" },
    ],
  },

  // ── Advanced continuous effects ──────────────────────────────────────────────
  //
  // Heavier, movement-forward effects. All are default-off (never applied unless
  // explicitly enabled), feature-detected by the runtime before activating, and
  // FULLY disabled under prefers-reduced-motion (not merely dampened).
  {
    id: "parallax", label: "Parallax", group: "continuous",
    description: "Shifts the block vertically as the page scrolls. Default-off, feature-detected, off under reduced-motion.",
    trigger: "scroll", defaultOff: true, featureDetect: true,
    params: [{
      key: "speed", label: "Speed", type: "number", min: 0.05, max: 0.6, step: 0.05,
      default: 0.2, cssVar: "--mc-fx-parallax-speed",
    }],
  },
  {
    id: "sticky", label: "Sticky", group: "continuous",
    description: "Pins the block while its section scrolls past. Default-off, needs position:sticky support, off under reduced-motion.",
    trigger: "scroll", defaultOff: true, featureDetect: true,
    params: [{
      key: "top", label: "Top offset", type: "number", min: 0, max: 160, step: 4,
      unit: "px", default: 16, cssVar: "--mc-fx-sticky-top",
    }],
  },
  {
    id: "ken-burns", label: "Ken Burns", group: "continuous",
    description: "Slow continuous zoom, best on media blocks. Default-off, feature-detected, off under reduced-motion.",
    trigger: "load", defaultOff: true, featureDetect: true,
    params: [
      { key: "scale", label: "Zoom to", type: "number", min: 1.05, max: 1.4, step: 0.01, default: 1.15, cssVar: "--mc-fx-kb-scale" },
      { key: "duration", label: "Duration", type: "number", min: 4000, max: 30000, step: 1000, unit: "ms", default: 12000, cssVar: "--mc-fx-kb-duration" },
    ],
  },
];

export const EFFECT_GROUPS: ReadonlyArray<{ key: EffectGroupKey; label: string }> = [
  { key: "entrance",   label: "Entrance" },
  { key: "emphasis",   label: "Emphasis" },
  { key: "continuous", label: "Continuous" },
];

const BY_ID = new Map(EFFECT_DEFINITIONS.map((d) => [d.id, d]));

/** Look up an effect definition by id (undefined for unknown ids). */
export function effectDefinition(id: string): EffectDefinition | undefined {
  return BY_ID.get(id);
}

/** True when the id is a known, currently-implemented effect. */
export function isKnownEffect(id: string): boolean {
  return BY_ID.has(id);
}

/** The group of an effect id, or undefined for unknown ids. */
export function effectGroup(id: string): EffectGroupKey | undefined {
  return BY_ID.get(id)?.group;
}

/** Advanced effects are default-off + feature-detected + off under reduced-motion. */
export function isAdvancedEffect(id: string): boolean {
  return BY_ID.get(id)?.defaultOff === true;
}
