/**
 * Where a body fell, drawn lying there until it wakes.
 *
 * Asked for: a body whose health reaches nought falls (a crumple, not a
 * ragdoll) and lies there until it respawns or gets up, for its player and
 * for everybody watching.
 *
 * A death puts the body on the island's spawn at once (`player_die`,
 * `respawn.ts`), and it may pick where to wake while it is still on that
 * tile. The island keeps where it fell on the row (`player.fell`: where,
 * which storey and when), says it to the body (`rpc_settle`) and to
 * everybody's roster (`PEOPLE_COLUMNS`), and the body's own browser carries it
 * on its body broadcast. While the body is still on the tile death woke it on
 * -- the island's spawn, on the ground floor, aboard nothing, as the island's
 * `respawn_fall` has it -- it is drawn lain where it fell
 * (`src/sculpt/anim/clips/down-ko.ts`), and the camera stays there; a pick, a
 * stay or a step off that tile and it is drawn where it is, getting up.
 *
 * A leaf: the island's code (`src/net`), the game and the renderer read it;
 * `supabase/test/fell.ts` holds the island to it.
 */

/** Seconds a body takes to crumple to the ground (`../sculpt/anim/clips/down-ko.ts`); played backward, quicker, it gets up. */
export const FALL_SECS = 1.3;

/** Where a body fell: the place and storey, and when, the island's instant in epoch milliseconds. */
export interface Fell {
  x: number;
  y: number;
  level: number;
  at: number;
}

/** The island's `player.fell` (`{ x, y, level, at }`), or null when it is not said or not one. */
export function fellIn(v: unknown): Fell | null {
  if (!v || typeof v !== 'object') return null;
  const f = v as Record<string, unknown>;
  const at = typeof f.at === 'string' ? Date.parse(f.at) : NaN;
  if (typeof f.x !== 'number' || typeof f.y !== 'number' || !Number.isFinite(f.x) || !Number.isFinite(f.y) || !Number.isFinite(at)) return null;
  return { x: f.x, y: f.y, level: typeof f.level === 'number' && Number.isInteger(f.level) ? f.level : 0, at };
}

/**
 * Where a body is drawn lying, or null: `fell` said, and the body still on the tile death woke it on (`spawn`, the
 * island's), on the ground floor and aboard nothing -- the island's `respawn_fall`.
 */
export function lyingAt(fell: Fell | null | undefined, body: { x: number; y: number; level: number; aboard?: number | null }, spawn: { x: number; y: number }): Fell | null {
  if (!fell) return null;
  if (Math.floor(body.x) !== spawn.x || Math.floor(body.y) !== spawn.y || (body.level ?? 0) !== 0 || (body.aboard ?? null) !== null) return null;
  return fell;
}
