import type { Game } from './game';
import { isFounder, lacks, POWER } from './ranks';
import { capital } from './words';

/**
 * Shared settlement stores.
 *
 * A crate or a piece of storage furniture standing on a settlement may be
 * marked one of its stores by its founder or by a rank holding Keep the
 * stores, and unmarked the same way. Then:
 *
 *   * it opens -- to take from and to put into -- for its founder and for
 *     every citizen whose rank holds Use the stores, padlocked or not, and
 *     whoever made it. Its padlock is not asked of them;
 *   * it opens for nobody else, key or not: a citizen whose rank lacks Use
 *     the stores is told so by rank, anybody else whose store it is;
 *   * it is moved, turned and picked up only by whoever set it down and the
 *     founder, padlock and all as before;
 *   * a craft, a build and a drop of dirt never draw on it, so that every
 *     thing that leaves it goes through its log;
 *   * every take and every put is logged -- who, what, how many and when --
 *     and the settlement keeps its last `STORE_LOG_CAP`, read in the
 *     Settlement window by its founder and by ranks holding Keep the stores.
 *
 * The island holds the rule (`store_refusal`, `store_move_said`,
 * `store_markable_refusal`, `rpc_store_mark`, `rpc_store_log`, in
 * `20261013203100_settlement_stores.sql`); this is the same rule said
 * before it is asked, and `supabase/test/stores.ts` holds the two together.
 */

/** A crate or a piece of furniture, as far as being a settlement store goes. */
export interface Keepable {
  /** The founder of the settlement it is a store of: the island's `store_of`. Absent on anything unmarked. */
  storeOf?: string;
  x: number;
  y: number;
  /** For a piece of furniture, whether you set it down; for a crate, whether the island counts it yours. */
  mine?: boolean;
}

/** A store is one of a settlement's while it is marked. */
export const isSettlementStore = (s: Keepable | undefined): boolean => !!s?.storeOf;

/** The settlement whose border takes in a tile, yours or anybody's. */
export function deedAt(g: Game, x: number, y: number): { name: string } | undefined {
  const all = [...(g.deed ? [g.deed] : []), ...g.neighbourDeeds];
  return all.find((d) => Math.abs(x - d.x) <= d.radius && Math.abs(y - d.y) <= d.radius);
}

/** What a settlement store says to somebody who is not its citizen. The island's `store_refusal`. */
export const storeStrangerSaid = (what: string, deed: string): string =>
  `${capital(what)}: store of ${deed}. Opens for its founder and ranks with ${POWER.use_stores.label} only.`;

/** Why a settlement store is not yours to move: the island's `store_move_said`. */
export const storeMoveSaid = (what: string, deed: string): string =>
  `${capital(what)}: store of ${deed}. Only whoever set it down and its founder may move or pick it up.`;

/** Marking a store that stands on no settlement: the island's `store_unsettled_said`. */
export const STORE_UNSETTLED = 'Not on a settlement.';

/** Marking anything that is no crate or piece of storage furniture: the island's `store_markable_refusal`. */
export const STORE_NOT_MARKABLE = 'Settlement stores: crates and storage furniture only; not stalls, trash crates, '
  + 'mailboxes, or anything driven, pulled or sailed.';

/**
 * Whether a store opens for you when it is a settlement store: `open`, when
 * you are its founder or your rank there holds Use the stores, and then
 * neither its padlock nor whose it is is asked; a refusal when you may not;
 * null when it is no settlement store, and the ordinary rules decide.
 */
export function storeUse(g: Game, s: Keepable, what: string): 'open' | string | null {
  if (!isSettlementStore(s)) return null;
  const mine = g.deedOfMineAt(Math.floor(s.x), Math.floor(s.y));
  if (mine) return lacks(mine, 'use_stores') ?? 'open';
  return storeStrangerSaid(what, deedAt(g, s.x, s.y)?.name ?? 'a settlement');
}

/**
 * Why you may not move, turn or pick up a settlement store, or null: whoever
 * set it down and its founder may. A crate's `mine` is the island's "yours
 * to use", which is wider than "set it down", so for a crate the island has
 * the last word where this lets it through.
 */
export function storeMoveRefusal(g: Game, s: Keepable, what: string): string | null {
  if (!isSettlementStore(s)) return null;
  const mine = g.deedOfMineAt(Math.floor(s.x), Math.floor(s.y));
  if (mine && isFounder(mine)) return null;
  if (s.mine !== false) return null;
  return storeMoveSaid(what, deedAt(g, s.x, s.y)?.name ?? 'a settlement');
}

/** What a piece of furniture is, as far as holding things goes. */
export interface StoreShape {
  capacity?: number;
  heft?: number;
  stall?: boolean;
  trash?: number;
  cart?: boolean;
  vehicle?: unknown;
  boat?: unknown;
}

/**
 * Whether a piece of furniture can be a settlement store: it holds things by
 * count or by weight, and is not a stall, a trash crate, a mailbox or
 * anything driven, pulled or sailed off the land. Any crate can.
 */
export const storeMarkable = (kind: string, def: StoreShape, grave = false): boolean =>
  !grave && ((def.capacity ?? 0) > 0 || (def.heft ?? 0) > 0)
  && !def.stall && !def.trash && !def.cart && !def.vehicle && !def.boat && kind !== 'mailbox';

/**
 * Why you may not mark (`on`) or unmark a store, or null: the island's
 * `rpc_store_mark`, in its order. `markable` is `storeMarkable` for a piece of
 * furniture, and true for a crate.
 */
export function storeMarkRefusal(g: Game, s: Keepable, what: string, markable: boolean, on: boolean): string | null {
  if (!markable) return STORE_NOT_MARKABLE;
  const deed = deedAt(g, s.x, s.y);
  if (!deed) return STORE_UNSETTLED;
  const mine = g.deedOfMineAt(Math.floor(s.x), Math.floor(s.y));
  if (!mine) return `Not a citizen of ${deed.name}.`;
  const rank = lacks(mine, 'keep_stores');
  if (rank) return rank;
  if (on && isSettlementStore(s)) return `${capital(what)}: already a store of ${deed.name}.`;
  if (!on && !isSettlementStore(s)) return `${capital(what)}: not a settlement store.`;
  return null;
}

/** What marking or unmarking a store says, in the log. */
export const storeMarkedLine = (what: string, deed: string, on: boolean): string => (on
  ? `${capital(what)}: now a store of ${deed}. Opens for its founder and ranks with ${POWER.use_stores.label}, `
    + `padlocked or not; nobody else. Every take and put is logged.`
  : `${capital(what)}: no longer a store of ${deed}. Its padlock and owner decide who opens it.`);

/** One take or put out of a settlement store, as `rpc_store_log` lists it. */
export interface StoreLogEntry {
  /** When, in seconds since 1970. */
  at: number;
  who: string;
  put: boolean;
  what: string;
  count: number;
  store: string;
}

/** One line of the store log: "Ada took 3 × iron lump out of the chest". */
export const storeLogLine = (e: StoreLogEntry): string =>
  `${e.who} ${e.put ? 'put' : 'took'} ${e.count > 1 ? `${e.count} × ` : ''}${e.what} ${e.put ? 'into' : 'out of'} the ${e.store.toLowerCase()}`;
