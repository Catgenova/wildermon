import { DAWN, DUSK } from '../game/game';

/** How far through the day the sun is at an hour: 0 at dawn, 1 at dusk, held there through the night. */
export const dayShare = (hour: number): number => Math.min(1, Math.max(0, (hour - DAWN) / (DUSK - DAWN)));

/** The sun's direction, a world vector toward it, at a share of the day (`dayShare`). */
export function sunOfDay(t: number): [number, number, number] {
  const a = Math.PI * t;
  const x = 0.72 * Math.cos(a), y = -0.3, z = 0.3 + 0.7 * Math.sin(a);
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

/**
 * Where the light comes from at a given hour. The sun rises on one side, goes
 * overhead at noon and sets on the other, so a hillside that was bright in the
 * morning is in shade by the afternoon and every slope on the island changes
 * shape as the day goes by. Before dawn and after dusk it sits on the horizon,
 * which is as close to moonlight as this needs to get.
 */
export const sunAt = (hour: number): [number, number, number] => sunOfDay(dayShare(hour));
