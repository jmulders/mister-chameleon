/**
 * How far a parallax block is shifted, in px.
 *
 * A parallax block stays in the page flow, so every pixel it moves is a pixel
 * it lies over its neighbour. The first version multiplied the distance to the
 * middle of the screen by the speed, without a limit: the closing block of a
 * page, which can never reach the middle, slid 120 px down over the footer on
 * a phone (21 Nov 2026). It also measured the block where the previous shift
 * had put it, so each frame fed on the last.
 *
 * Now the travel is bounded. The block drifts from +travel to -travel while it
 * crosses the screen and stands still outside it. The travel grows with the
 * speed and never exceeds PARALLAX_MAX_TRAVEL, which is the smallest padding a
 * section has (40 px on a phone), so the content of a block never reaches the
 * block next to it.
 *
 * The snippet runtime (effect-runtime.ts) carries the same sum as a string;
 * tests/effects/parallax-offset.test.ts holds the two against each other.
 */

/** Longest distance a block may move from its own place. */
export const PARALLAX_MAX_TRAVEL = 40;

/** Travel per unit of speed: the default speed of 0.2 gives 20 px. */
export const PARALLAX_TRAVEL_PER_SPEED = 100;

export interface ParallaxMeasure {
  /** Top of the block in the viewport, as getBoundingClientRect reports it. */
  top: number;
  height: number;
  /** Height of the viewport. */
  viewport: number;
  speed: number;
  /** The shift the block has at the moment of measuring. */
  current: number;
}

export function parallaxOffset({ top, height, viewport, speed, current }: ParallaxMeasure): number {
  const travel = Math.min(PARALLAX_MAX_TRAVEL, Math.abs(speed) * PARALLAX_TRAVEL_PER_SPEED);
  // The measured top includes the shift already applied; take it off to get
  // the place the block has in the page.
  const center = top - current + height / 2;
  // At this distance from the middle the block has just left the screen.
  const reach = viewport / 2 + height / 2;
  if (!(reach > 0)) return 0;
  let progress = (center - viewport / 2) / reach;
  if (progress > 1) progress = 1;
  if (progress < -1) progress = -1;
  const offset = -progress * travel * (speed < 0 ? -1 : 1);
  return offset === 0 ? 0 : offset;
}
