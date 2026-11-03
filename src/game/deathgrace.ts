import { HEARTBEAT } from './keep';
import { waitWords } from './words';

/**
 * A death grace for a new character: while it has played under
 * `DEATH_GRACE_HOURS`, a death takes nothing.
 *
 * Asked for: "a grace period after death for new players -- no penalty for
 * dying during a character's first 24 hours of playtime (time actually played,
 * not time since sign-up)".
 *
 * Played time is the island's (`player.played`, seconds): `body_settle`, which
 * every beat, walk and job already runs, adds the stretch it settles while the
 * body is in the game -- not away, heard from within `PLAYED_GAP`, and the
 * last settling no further back than that -- and nothing for a stretch with
 * the tab shut, logged off or asleep in a bed.
 *
 * A death in the grace (`player_die`): no grave, nothing taken off the body or
 * out of the hands, stamina, food and water not lowered; the body wakes whole
 * on the spawn and picks where to wake as after any death (`respawn.ts`).
 * Past it, a death is as it always was.
 *
 * A leaf but for `keep` and `words`: the effects row, the respawn chooser, the
 * help and What's new read it; `supabase/test/deathgrace.ts` holds the island to it.
 */

/** Hours of played time a character dies in without losing anything. The island's `death_grace_hours`. */
export const DEATH_GRACE_HOURS = 24;
/** The same, in seconds, as played time is counted. The island's `death_grace`. */
export const DEATH_GRACE = DEATH_GRACE_HOURS * 3600;
/**
 * The longest stretch counted as played, in seconds: two heartbeats. A longer
 * gap since the body was last settled, or since the browser was last heard
 * from, is a tab shut or a body away, and counts nothing. The island's `played_gap`.
 */
export const PLAYED_GAP = 2 * HEARTBEAT;

/** The grace left, as a label: "Death grace: 18 h 20 min of 24 h played left". The island's `death_grace_said`. */
export const graceSaid = (left: number): string =>
  `Death grace: ${waitWords(left)} of ${waitWords(DEATH_GRACE)} played left`;

/** The grace left after a death in it, as the respawn chooser says it: "Death grace: 18 h 20 min of 24 h played left; nothing lost." */
export const graceKeptSaid = (left: number): string => `${graceSaid(left)}; nothing lost.`;

/** What a death in the grace says. The island tells it in the same words (`player_die`). */
export const graceDeathSaid = (left: number): string => `You have died. ${graceKeptSaid(left)}`;

/** What a death in the grace spares, as the effects row and the help list it. */
export const GRACE_SPARES = 'On death: no grave, nothing dropped; stamina, food and water not lowered.';

/** The seconds of grace the island says are left (`rpc_settle`'s `grace`, `death_grace_left`); null when it is over or not said. */
export const graceIn = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;

/** The grace left from what a character has played (`player.played`): null once it is over. */
export const graceLeft = (played: number): number | null => (played < DEATH_GRACE ? DEATH_GRACE - played : null);
