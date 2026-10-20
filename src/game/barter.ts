/**
 * A trade between two people standing together: the Trade window.
 *
 * One asks, the other says yes or no. Then each puts things from their pack
 * and a sum of coins on their side, and each presses Accept. Any change to
 * either side takes both Accepts back. When both stand, the island moves
 * everything at once, in one transaction: all of it changes hands or none of
 * it does.
 *
 * The island does every part of this (`rpc_barter_ask`, `rpc_barter_answer`,
 * `rpc_barter`, `rpc_barter_offer`, `rpc_barter_accept`, `rpc_barter_cancel`)
 * and there is no such thing in the game you play by yourself. What is here
 * is what both sides say: how near, how long, how many, and every refusal,
 * which the island reads as `barter_said(key)` with the same words.
 *
 * Called a barter in the code, because a "trade" in this game is the craft
 * you follow (`classes.ts`, the Trades window); the window itself says Trade.
 */
import { itemDef } from './items';

/**
 * How far apart two people may stand and trade, in tiles, measured as the
 * larger of the two distances across the grid: the reach a deal is shaken on
 * (`rpc_deal_answer`). Asking, saying yes and every Accept want it, and a
 * trade whose two sides are found further apart than this is called off.
 */
export const BARTER_REACH = 4;

/** How long a trade may sit with nothing changing in it before it lapses, in seconds. */
export const BARTER_IDLE = 120;

/** The most separate things one side may put in. A stack counts as one. */
export const BARTER_MOST = 12;

/** How often an open Trade window asks the island again, in seconds, besides being told of every change. */
export const BARTER_REFRESH = 3;

/**
 * Every sentence a trade says, with `{who}`, `{what}` and `{n}` where the
 * island puts a name, a kind of thing and a number of silver. The island
 * fills the same templates (`barter_said`), so a refusal reads the same in
 * either browser and in the browser's own check.
 */
export const BARTER_SAID = {
  /** Asking yourself, or nobody. */
  self: 'Nobody there to trade with.',
  /** The other one is not on the island, or is away. */
  gone: '{who} is not ashore.',
  /** Too far apart to ask, to say yes or to accept. */
  far: `Too far: trade within ${BARTER_REACH} tiles.`,
  /** Already in a trade. */
  busy: 'Already trading: finish or cancel first.',
  busyThem: '{who} is already trading.',
  /** A trade you are not in, or one that never was: the same answer, so it tells a stranger nothing. */
  none: 'No such trade.',
  /** One of yours, already finished. */
  over: 'Trade over.',
  /** Putting things in, or accepting, before the one asked has said yes. */
  notYet: '{who} has not agreed yet.',
  /** Answering a trade you asked for. */
  notYours: '{who} answers this.',
  /** A thing on a side that has left that side's pack: eaten, dropped, sold, posted or held in a deal. */
  missing: 'No longer in {who}\'s pack: {what}.',
  /** Fewer in the stack than were put in. */
  fewer: 'Fewer than were put in: {who}\'s {what}.',
  /** Worn or held in a hand. */
  worn: 'Worn or held by {who}: {what}. Unequip it first.',
  /** Set aside with Keep this back. */
  locked: 'Set aside by {who}: {what}. Return it to the pack first.',
  /** Coins go by the sum, not by the stack. */
  coin: 'Coins go in as a silver sum, not as a stack.',
  /** More silver on a side than its owner carries. */
  coins: '{who} lacks {n} silver.',
  /** Too many things on one side. */
  most: `Max ${BARTER_MOST} items per side.`,
  /** An Accept sent against a side that has changed since it was drawn. */
  changed: 'Trade changed before your Accept: check it, then accept.',
  /** What each is told along the way. */
  asked: 'Trade request from {who}: answer in the Trade window.',
  asking: 'Trade request sent: {who}.',
  opened: 'Trading with {who}: add your side, then Accept.',
  declined: 'Trade declined by {who}.',
  youDeclined: 'Trade with {who} declined.',
  cancelled: 'Trade cancelled by {who}. Nothing exchanged.',
  youCancelled: 'Trade with {who} cancelled. Nothing exchanged.',
  apart: `Trade with {who} off: more than ${BARTER_REACH} tiles apart. Nothing exchanged.`,
  left: 'Trade with {who} off: {who} left. Nothing exchanged.',
  lapsed: `Trade with {who} lapsed: idle ${BARTER_IDLE} s. Nothing exchanged.`,
  accepts: '{who} accepted.',
  done: 'Trade with {who} done: both sides exchanged.',
} as const;
export type BarterKey = keyof typeof BARTER_SAID;

/** A sentence of a trade's, filled in. */
export function barterSaid(key: BarterKey, fill: { who?: string; what?: string; n?: number } = {}): string {
  return BARTER_SAID[key]
    .split('{who}').join(fill.who ?? '')
    .split('{what}').join(fill.what ?? '')
    .split('{n}').join(String(fill.n ?? 0));
}

/** A kind of thing as a refusal names it: the island's `lower(item_def.name)`. */
export const barterThing = (def: string): string => itemDef(def).name.toLowerCase();

/** One thing on a side, as the island sends it. */
export interface BarterThing {
  id: number;
  def: string;
  ql: number;
  dmg: number;
  /** How many of it go: the whole stack, or part of one. */
  count: number;
  /** How many the stack in the pack holds now. */
  has: number;
  extra: string | null;
  rare: string | null;
}

/** One side of a trade. */
export interface BarterSide {
  uid: string;
  name: string;
  things: BarterThing[];
  /** Silver on this side. */
  coins: number;
  /** Whether this side has pressed Accept since the last change. */
  ok: boolean;
}

/** A trade, as `rpc_barter` sends it to one of the two in it. */
export interface Barter {
  n: number;
  /** Bumped on every change; an Accept names the one it was pressed against. */
  rev: number;
  /** `asked` until the one asked says yes, then `open`. */
  state: 'asked' | 'open';
  /** Whether you are the one who asked. */
  asker: boolean;
  mine: BarterSide;
  theirs: BarterSide;
  /** Seconds before it lapses with nothing changed. */
  left: number;
  /** How far apart the two stand, in tiles across the grid. */
  apart: number;
}

/**
 * Why the browser would not put a thing on your side, before the island is
 * asked: the same rules the island holds to, as far as a pack in a browser
 * can see them. Null when it may go.
 */
export function barterPutRefusal(
  it: { id: string; locked?: boolean; count: number },
  worn: boolean, count: number, who: string,
): string | null {
  if (it.id === 'coin') return barterSaid('coin');
  if (worn) return barterSaid('worn', { who, what: barterThing(it.id) });
  if (it.locked) return barterSaid('locked', { who, what: barterThing(it.id) });
  if (count > it.count) return barterSaid('fewer', { who, what: barterThing(it.id) });
  return null;
}

/** What a side comes to, in a line: "2 × log, a rope and 15 silver", or "nothing". */
export function sideWords(side: { things: ReadonlyArray<{ def: string; count: number }>; coins: number }): string {
  const parts = side.things.map((t) => (t.count > 1 ? `${t.count} × ${barterThing(t.def)}` : barterThing(t.def)));
  if (side.coins > 0) parts.push(`${side.coins} silver`);
  if (!parts.length) return 'nothing';
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
