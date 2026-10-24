/**
 * A spiral staircase's shape, for whoever walks it and whoever draws it: the
 * treads wound once round a post in the middle of its tile for every storey,
 * the bottom one starting at `SPIRAL_START` and each a storey's
 * `SPIRAL_TREADS`th higher than the last, round the way `SPIRAL_WIND` says.
 *
 * A body up it is `t` of the way up the storey, 0 at its foot and 1 at its
 * head, and stands round the post on the tread under that share of the turn
 * (`spiralSpot`): a body on the storey under its foot or on its head stands
 * on the same spot, one turn apart, so spirals stacked a storey over a storey
 * on one tile are walked as one stair.
 */
import { LIFT_COST } from '../world/pathfinding';

/** Treads to a storey. */
export const SPIRAL_TREADS = 14;
/** Where the bottom tread starts, as an angle in the world (`atan2(dy, dx)`, y running south): on the north-east. */
export const SPIRAL_START = -Math.PI / 4;
/** Which way round they climb: one for the way the angle grows, clockwise seen from overhead with north at the top. */
export const SPIRAL_WIND = 1;
/** How far out from the middle of the tile the treads run from and to, and where a body walks round, as shares of a tile. */
export const SPIRAL_POST = 0.09;
export const SPIRAL_OUT = 0.46;
export const SPIRAL_WALK = 0.27;
/** A storey up or down one, in tiles of walking: the turn round the post a body walks (`Player.climb`), and what the search counts it as (`LIFT_COST`). */
export const SPIRAL_CLIMB = LIFT_COST;

/** The angle round the post a share `t` of the way up a storey, a body standing on the middle of the tread under it. */
export function spiralAngle(t: number): number {
  return SPIRAL_START + SPIRAL_WIND * Math.PI * 2 * (t - 0.5 / SPIRAL_TREADS);
}

/** Where a body `t` of the way up a storey stands, from the middle of the tile, in tiles. */
export function spiralSpot(t: number): [number, number] {
  const a = spiralAngle(t);
  return [Math.cos(a) * SPIRAL_WALK, Math.sin(a) * SPIRAL_WALK];
}

/** The way a body faces going round, up (`up`) or down, `t` of the way up. */
export function spiralHeading(t: number, up: boolean): [number, number] {
  const a = spiralAngle(t), k = SPIRAL_WIND * (up ? 1 : -1);
  return [-Math.sin(a) * k, Math.cos(a) * k];
}

/** How high a body `t` of the way up a storey stands, as a share of the storey: on the tread under it, the floor at the foot. */
export function spiralRise(t: number): number {
  return Math.max(0, Math.min(SPIRAL_TREADS, Math.floor(t * SPIRAL_TREADS - 0.5) + 1)) / SPIRAL_TREADS;
}
