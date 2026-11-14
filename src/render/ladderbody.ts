/**
 * Where a body on a ladder is drawn (`../game/ladderclimb.ts`): on the ladder as `StairPainter.drawLadder` lays it,
 * at the height its climb has got to, faced to it.
 *
 * The ladder leans: its foot out on the floor below toward the side it is climbed from, its head against the far edge
 * of the hatch (or the face of a wall standing there), its run `LEAN` of its rise. The body's feet are put `STAND`
 * game units short of it, at the height the climb has got to: the climb's own keys put the hands and feet on the rungs
 * from there (`../sculpt/anim/clips/ladder.ts`, which leans with it). Over the walk up to its foot
 * (`CLIMB_FROM`) and the step off at its head (`CLIMB_TO`) the body goes from where it walks to the ladder, and back.
 */
import { borderOf, isDone, WALL_HEIGHT, WALL_THICK, type Side } from '../game/building';
import type { Game } from '../game/game';
import { CLIMB_FROM, CLIMB_TO, climbWay, LADDER_LEAN, LADDER_STAND, onLadder } from '../game/ladderclimb';
import { UNITS_PER_TILE } from './iso';

/** A body on a ladder: where it is drawn (x, y, the height of its feet), how far up the ladder its feet are (game units; none off the climb), and the way it faces. */
export interface LadderBody { x: number; y: number; h: number; climb?: number; dirX: number; dirY: number }

const OPPOSITE: Record<Side, Side> = { n: 's', s: 'n', e: 'w', w: 'e' };
const smooth = (u: number): number => { const x = Math.min(1, Math.max(0, u)); return x * x * (3 - 2 * x); };
/** A point on a tile from across (t) and away from the side it is climbed from (s), as `StairPainter` lays a flight. */
function stairPoint(x: number, y: number, side: Side, t: number, s: number): [number, number] {
  switch (side) {
    case 'n': return [x + t, y + s];
    case 's': return [x + t, y + 1 - s];
    case 'w': return [x + s, y + t];
    default: return [x + 1 - s, y + t];
  }
}

/** A body at (x, y) on storey `level` on a ladder, as it is drawn, or null when it is on none. */
export function ladderBody(game: Game, x: number, y: number, level: number): LadderBody | null {
  const b = game.buildings;
  if (!b.list.size) return null;
  const on = onLadder(b, x, y, level);
  if (!on) return null;
  const f = on.floor, tx = Math.floor(x), ty = Math.floor(y), side = on.side;
  const base = b.buildingAt(tx, ty)?.deck ?? game.world.getHeight(tx, ty);
  const h0 = base + (f.level - 1) * WALL_HEIGHT, rise = WALL_HEIGHT;
  // its head and its foot, as `drawLadder` lays them
  const headWall = b.wallOnBorder(f.level - 1, borderOf(tx, ty, OPPOSITE[side]));
  const sHead = headWall && isDone(headWall) ? 1 - WALL_THICK - 0.02 : 0.985;
  const sFoot = sHead - (rise / UNITS_PER_TILE) * LADDER_LEAN;
  const climb = on.u * rise;
  const sAt = sFoot + (sHead - sFoot) * on.u - LADDER_STAND / UNITS_PER_TILE;
  // where it walks, across the tile and along it, taken to the ladder over the walk up to it and back over the step off
  const k = on.s < CLIMB_FROM ? smooth(on.s / CLIMB_FROM) : on.s > CLIMB_TO ? 1 - smooth((on.s - CLIMB_TO) / (1 - CLIMB_TO)) : 1;
  const t0 = side === 'n' || side === 's' ? x - tx : y - ty;
  const [wx, wy] = stairPoint(tx, ty, side, t0 + (0.5 - t0) * k, on.s + (sAt - on.s) * k);
  const [dirX, dirY] = climbWay(side);
  const climbing = on.s >= CLIMB_FROM && on.s <= CLIMB_TO;
  return { x: wx, y: wy, h: h0 + climb, ...(climbing ? { climb } : {}), dirX, dirY };
}
