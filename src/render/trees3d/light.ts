/**
 * The light a tree is baked under: the island's sun (`../sun`), taken in
 * `SUN_STEPS` steps through the day so a wood is baked again a few times a
 * day rather than every frame, and a flat cool light from overhead once it
 * is dark, under the night's own wash.
 */
import { dayShare, sunOfDay } from '../sun';
import type { V3 } from './types';
import { unit } from './vec';

/** Steps of the sun from dawn to dusk, both ends counted: `SUN_STEPS + 1` lights a day, and the night's. */
export const SUN_STEPS = 8;
/** How dark (`Game.darkness`) it is before a tree is lit as at night. */
const NIGHT_FROM = 0.55;

export interface Light {
  /** Toward the light, a world vector. */
  sun: V3;
  /** What the light adds facing it square on, and what every side has anyway. */
  direct: number;
  ambient: number;
  night: boolean;
  /** How long a shadow on the ground is, against how tall what throws it stands: none at night. */
  throw: number;
}

/** The step a tree is baked at for an hour and a darkness: 0 to `SUN_STEPS`, or -1 for the night. */
export const sunStepOf = (hour: number, dark: number): number =>
  dark > NIGHT_FROM ? -1 : Math.round(dayShare(hour) * SUN_STEPS);

const MOON: V3 = unit([-0.25, 0.35, 1]);

export function lightOf(step: number): Light {
  if (step < 0) return { sun: MOON, direct: 0.32, ambient: 0.5, night: true, throw: 0 };
  const sun = sunOfDay(step / SUN_STEPS) as V3;
  // Low sun: a long throw, but kept to what a tile or two can hold.
  const flat = Math.hypot(sun[0], sun[1]);
  return { sun, direct: 0.78, ambient: 0.3, night: false, throw: Math.min(1.9, flat / Math.max(0.2, sun[2])) };
}

/** The next step the sun takes after `hour`, with the darkness at each hour (`darknessAt`); null when none comes within six hours. */
export function nextSunStep(hour: number, darkAt: (h: number) => number): number | null {
  const now = sunStepOf(hour, darkAt(hour));
  for (let d = 0.05; d <= 6; d += 0.05) {
    const h = (hour + d) % 24;
    const s = sunStepOf(h, darkAt(h));
    if (s !== now) return s;
  }
  return null;
}
