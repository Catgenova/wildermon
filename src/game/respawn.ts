/**
 * Where a body wakes after a death: picked from a chooser over the world.
 *
 * Asked for: "show that screen [the first join's Runestone picker] on death,
 * with an indicator of how far each rune is from your corpse, or an option to
 * respawn at your deed token or one you belong to".
 *
 * A death puts the body on the island's spawn, as it always has
 * (`player_die`), and keeps where it fell (`private.fallen`). While the body
 * is still on the tile death put it on, every beat's answer carries the offer
 * (`rpc_settle`'s `fallen`, `respawn_offer`): where it fell, and every
 * settlement it may wake at (`deeds_of`: the one it founded, then each it is a
 * citizen of). The browser shows the five Runestones and those settlements,
 * each with its distance from where the body fell (`respawnChoices`), and the
 * one picked goes to the island (`rpc_respawn`), which puts the body:
 *
 *   * beside a Runestone, on the ring a first join starts on
 *     (`START_RING`, `start_landing`);
 *   * beside a settlement's token, on the first free tile of `RESPAWN_RING`
 *     round it (`respawn_landing`), by the same terms as a Telestone's landing.
 *
 * Staying, a step, or a closed tab: the spawn, as before. The offer goes once
 * the body leaves that tile.
 *
 * A leaf, but for the stones: the chooser (`src/ui/respawn.ts`), the help and
 * the defs dump read it; `supabase/test/respawnpick.ts` holds both sides to it.
 */
import { hasRunestones, rings, RUNESTONES, stonePoint, type RunestoneId } from './runestones';

/** What `rpc_respawn` is asked for a settlement: this, then its founder's id. */
export const DEED_AT = 'deed:';
/** What `rpc_respawn` is asked to stay on the spawn: the offer goes, and the body stays. */
export const RESPAWN_STAY = 'stay';
/** Tiles out from a settlement's token tried for a body waking there, nearest first: the ring next to it, then three more. */
export const RESPAWN_GAP = 1;
export const RESPAWN_SPARE = 3;
/** The tiles a body may wake on round a token, in the order they are tried, as offsets from it. The island's `respawn_ring`. */
export const RESPAWN_RING: ReadonlyArray<readonly [number, number]> = rings(RESPAWN_GAP, RESPAWN_GAP + RESPAWN_SPARE, 0);

/** A settlement a body may wake at, as the island offers it. `id` is its founder's. */
export interface FallenDeed {
  id: string;
  name: string;
  x: number;
  y: number;
  level: number;
  /** Founded by the one who fell; otherwise a member of it. */
  own: boolean;
}

/** The island's offer after a death: where the body fell, and the settlements it may wake at. */
export interface Fallen {
  x: number;
  y: number;
  deeds: FallenDeed[];
}

/** One card of the chooser. */
export interface RespawnChoice {
  /** What `rpc_respawn` is asked: a Runestone's id, or `DEED_AT` and a founder's id. */
  at: string;
  stone: RunestoneId | null;
  deed: FallenDeed | null;
  name: string;
  /** Where on the bay a stone stands; a settlement's tie to the body. */
  place: string;
  /** Tiles from where the body fell. */
  tiles: number;
}

/** Whole tiles between two points, rounded. */
export const tilesBetween = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
  Math.round(Math.hypot(a.x - b.x, a.y - b.y));

/** A distance as a card says it. */
export const tilesSaid = (n: number): string => `${n} ${n === 1 ? 'tile' : 'tiles'}`;

/** A settlement's tie to the body, as its card says it. */
export const deedTie = (d: FallenDeed): string => (d.own ? 'Founder' : 'Member');

/** What the chooser is headed, and each of its two rows. */
export const RESPAWN_TITLE = 'Respawn';
export const STONES_HEAD = 'Runestones: distance from your body';
export const DEEDS_HEAD = 'Your settlements: distance from your body';
/** The way out that keeps the body where death put it. */
export const STAY_SAID = 'Stay at the spawn';

/**
 * The cards for a body that fell at `fell` on a world `size` across: the five
 * stones where they stand on it (none on a test's world), then each
 * settlement offered, as the island orders them; each with its distance from
 * where the body fell, to the middle of the stone's centre tile
 * (`stonePoint`) or of the token's tile.
 */
export function respawnChoices(fell: Fallen, size: number): RespawnChoice[] {
  const stones: RespawnChoice[] = (hasRunestones(size) ? RUNESTONES : []).map((s) => ({
    at: s.id, stone: s.id, deed: null, name: s.name, place: s.place, tiles: tilesBetween(fell, stonePoint(s, size)),
  }));
  const deeds: RespawnChoice[] = fell.deeds.map((d) => ({
    at: DEED_AT + d.id, stone: null, deed: d, name: d.name, place: deedTie(d), tiles: tilesBetween(fell, { x: d.x + 0.5, y: d.y + 0.5 }),
  }));
  return [...stones, ...deeds];
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** The island's offer, from a beat's answer: null when there is none, or it is not one. */
export function fallenIn(v: unknown): Fallen | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!num(o.x) || !num(o.y)) return null;
  const deeds: FallenDeed[] = [];
  for (const d of Array.isArray(o.deeds) ? o.deeds : []) {
    const e = (d ?? {}) as Record<string, unknown>;
    if (typeof e.id !== 'string' || typeof e.name !== 'string' || !num(e.x) || !num(e.y)) continue;
    deeds.push({ id: e.id, name: e.name, x: e.x, y: e.y, level: num(e.level) ? e.level : 1, own: e.own === true });
  }
  return { x: o.x, y: o.y, deeds };
}
