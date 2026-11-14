/**
 * A body on a ladder, climbing it.
 *
 * Asked for: the walk played on a ladder replaced by a climb, hands and feet
 * on the rungs, facing the ladder, up and down.
 *
 * A ladder stands in the floor slot of the storey it opens into (`FloorKind`
 * 'ladder', `./building.ts`), climbed from its `facing` side: a step onto its
 * tile from below is a step up a storey, and a step off it can be one down
 * (`Game.step`); one in the ground floor's slot goes down to a cellar
 * (`Buildings.flightDown`). Nothing about a walk changes on it: the body
 * crosses its tile at its walking pace. What changes is how it is drawn while
 * it is on the tile: how far up the storey the climb has got goes with how far
 * across the tile the body is, along the way the ladder is climbed (`CLIMB_FROM`
 * to `CLIMB_TO` of the way, the storey under it before, the one it opens into
 * after), and the renderer puts it on the ladder at that height, faced to it
 * (`../render/ladderbody.ts`), playing the climb (`../sculpt/anim/clips/ladder.ts`).
 * Your own body's eased storey follows it (`Player.visualLevel`), so stepping
 * off at either end, or across a side, goes on from the height it was drawn at.
 */
import { floorKind, isDone, type FloorTile, type Side } from './building';

/** Of the way across a ladder's tile, from the side it is climbed from: where the climb starts and where it is done. */
export const CLIMB_FROM = 0.3;
export const CLIMB_TO = 0.9;

/** The ladder's run over its rise, as `../render/stairdraw.ts` drawLadder leans it. */
export const LADDER_LEAN = 0.26;
/** Game units from a climber's feet to the ladder at their height (`../render/ladderbody.ts`; the climb's keys put the rungs there). */
export const LADDER_STAND = 1.6;

/** Game units between a ladder's rungs (`../render/stairdraw.ts` drawLadder: a rung to every three units of height). */
export const RUNG = 3;
/** Game units a hand or a foot goes up a ladder at a time, the body half that: two rungs (`../sculpt/anim/clips/ladder.ts`). */
export const CLIMB_RUN = 2 * RUNG;

/** A body on a ladder: the ladder, the side it is climbed from, how far across its tile the body is that way, and how far up the storey. */
export interface OnLadder { floor: FloorTile; side: Side; s: number; u: number }

/** What a ladder is looked up in: the floors, and a ground floor's way down to a cellar (`Buildings`). */
interface Floors { floor(level: number, x: number, y: number): FloorTile | undefined; flightDown(x: number, y: number): FloorTile | undefined }

const clamp = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * The ladder a body at (x, y) on storey `level` is on, or null: a finished ladder in that storey's floor slot on its tile
 * (on the ground floor, the way down to a cellar there). `u`, how far up from the storey under it, nought to one.
 */
export function onLadder(b: Floors, x: number, y: number, level: number): OnLadder | null {
  const tx = Math.floor(x), ty = Math.floor(y);
  const f = level >= 1 ? b.floor(level, tx, ty) : level === 0 ? b.flightDown(tx, ty) : undefined;
  if (!f || floorKind(f) !== 'ladder' || !isDone(f)) return null;
  const side = f.facing ?? 's', dx = x - tx, dy = y - ty;
  const s = clamp(side === 'n' ? dy : side === 's' ? 1 - dy : side === 'w' ? dx : 1 - dx);
  return { floor: f, side, s, u: clamp((s - CLIMB_FROM) / (CLIMB_TO - CLIMB_FROM)) };
}

/** The way a ladder is climbed up, in the world (x east, y south): away from the side it is climbed from. */
export const climbWay = (side: Side): [number, number] => (side === 'n' ? [0, 1] : side === 's' ? [0, -1] : side === 'w' ? [1, 0] : [-1, 0]);
