/**
 * A settlement's ranks, and the one comparison everybody asks of them.
 *
 * Here, in a module that imports nothing, rather than in `game.ts`, where they
 * were. The baubles needed the comparison, and taking it from `game.ts` closed
 * a ring -- baubles → game → actions → baubles -- so the bundle could run
 * `actions.ts` before `baubles.ts` had finished, and `ACTIONS` spread a
 * `BAUBLE_ACTIONS` that was not there yet. The page stopped on "Raising an
 * island…" with "is not iterable" in the console, for everybody, and nothing
 * in the suite noticed, because no test loads the built page. It is the same
 * race `items.ts` tells of for `TREASURE_ACTIONS`.
 *
 * `game.ts` passes these on, so what imported them from there still does.
 */

/**
 * What somebody is on a settlement.
 *
 * `deed_member` was a flat list: in or out, and everybody in it could dig up
 * the gardens, empty the stores and pull the walls down. Inviting anybody to
 * anything was therefore a decision nobody could take back short of throwing
 * them out, which is not a thing you want to have to do to somebody you are
 * merely unsure about.
 *
 *   founder   planted the stake. Cannot be demoted, may do everything, and
 *             holds the master key to every lock on their own land. The only
 *             one who upgrades, renames or disbands it, and who makes or
 *             unmakes a mayor or sends one away.
 *   mayor     builds, invites people, sends away builders and guests, and
 *             sets either to builder or guest (`rpc_invite`, `rpc_leave_deed`,
 *             `rpc_rank`). Not another mayor, and not the founder.
 *   builder   the ordinary citizen, and what an invitation makes you: shapes
 *             the ground, builds, takes from the stores.
 *   guest     walks the land and opens nothing. What you offer somebody you
 *             want to show round rather than hand the keys to.
 *
 * Nobody changes the founder's rank or their own.
 */
export type DeedRole = 'founder' | 'mayor' | 'builder' | 'guest';

/** The ranks in order, so "at least a builder" is one comparison. */
export const DEED_RANKS: DeedRole[] = ['guest', 'builder', 'mayor', 'founder'];

/** Whether a rank is at least another. Absent means the solo game: founder. */
export const rankAtLeast = (have: DeedRole | undefined, want: DeedRole): boolean =>
  DEED_RANKS.indexOf(have ?? 'founder') >= DEED_RANKS.indexOf(want);

/** The ranks a citizen can be given, highest first: everything but founder. */
export const SETTABLE_RANKS: DeedRole[] = DEED_RANKS.filter((r) => r !== 'founder').reverse();

/** The ranks a mayor may give, and take a citizen from: those below mayor, highest first. */
export const MAYOR_SETS: DeedRole[] = SETTABLE_RANKS.filter((r) => DEED_RANKS.indexOf(r) < DEED_RANKS.indexOf('mayor'));

const plural = (r: DeedRole): string => `${r}s`;
const orList = (xs: string[]): string => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`);
const andList = (xs: string[]): string => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/**
 * What a rank lets you do on a settlement, after "you may". The island's
 * `rank_may`, word for word: it is what somebody is told when they are ranked.
 */
export const RANK_MAY: Record<Exclude<DeedRole, 'founder'>, string> = {
  mayor: `build, invite people, send away its ${andList(MAYOR_SETS.map(plural))}, and make them ${orList(MAYOR_SETS.map(plural))}`,
  builder: 'shape its ground, build on it and take from its stores',
  guest: 'walk it and shape nothing',
};

/** The ranks a citizen can be given, as a sentence: "mayor, builder or guest". */
export const SETTABLE_SAID = orList(SETTABLE_RANKS);
