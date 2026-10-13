/**
 * A settlement's notices, the work it wants and the ledger of who brought it.
 *
 * Only an island has these, and the island does every part of them:
 *
 *   * **Notices.** A citizen whose rank holds Post notices -- and the founder,
 *     who holds everything -- posts a notice of at most `NOTICE_MAX`
 *     characters to the settlement (`rpc_notice_post`) and takes any notice
 *     down (`rpc_notice_drop`). It keeps the newest `NOTICE_KEEP`; posting one
 *     more drops the oldest. Whoever is ashore hears a new one in the log at
 *     once; everybody else is shown what they have not seen when they next
 *     come ashore (`rpc_notices_ashore`), once.
 *   * **Work.** A rank holding Set work lists what the settlement wants: a
 *     kind of thing, how many, and a lowest quality if it matters
 *     (`rpc_work_set`), up to `WORK_OPEN_MAX` open at once, and takes any of
 *     it down (`rpc_work_drop`).
 *   * **Delivering.** Any citizen standing within `DELIVER_REACH` tiles of
 *     the settlement token delivers toward a work (`rpc_work_deliver`): the
 *     things in their pack that match it, lowest quality first, go into the
 *     founder's deed crate -- the same rows, moved, never copied -- until the
 *     work has what it wants or the crate is full. The deed crate is where
 *     the founder already collects what the settlement's workers bring in, so
 *     it is where the settlement's goods are, and nothing new had to be built
 *     to hold them.
 *   * **The ledger.** Every work set, every delivery (who, how many, of what,
 *     toward which work), every work done and every work taken down is a line
 *     in the settlement's ledger. It keeps the newest `LEDGER_KEEP`.
 *
 * Nobody outside a settlement reads or writes any of it: the island answers a
 * stranger with the one sentence it gives for every other settlement door.
 *
 * Imports nothing but the top of the quality scale from `limits.ts`, which
 * imports nothing, so `ranks.ts` -- kept free of imports for the reason it
 * gives -- can say these limits in its rules. The island reads the
 * same numbers and sentences from the definitions (`notice_max`,
 * `settle_said` and the rest; `scripts/dump-defs.ts`).
 */

import { QL_TOP } from './limits';

/** The longest a notice may be, in characters, after runs of spaces and line breaks are made one space. */
export const NOTICE_MAX = 200;

/** How many notices a settlement keeps. Posting one more drops the oldest. */
export const NOTICE_KEEP = 20;

/** How many works a settlement may have open at once. */
export const WORK_OPEN_MAX = 8;

/** The most of a thing one work may ask for. */
export const WORK_COUNT_MAX = 1000;

/** The highest quality a work may ask for at least: the top of the scale. */
export const WORK_QL_TOP = QL_TOP;

/** How near the settlement token you stand to deliver, in tiles, across the grid. */
export const DELIVER_REACH = 3;

/** How many finished or taken-down works a settlement keeps listed under its open ones. */
export const WORK_DONE_KEEP = 10;

/** How many lines a settlement's ledger keeps. A new line past that drops the oldest. */
export const LEDGER_KEEP = 100;

/** How often the Settlement window's Notices and Work tabs ask the island again while one is showing, in seconds. */
export const SETTLE_REFRESH = 10;

/**
 * Every sentence the notices and the work say, with `{deed}`, `{who}`,
 * `{what}` and `{n}` where the island puts a settlement, a name, a kind of
 * thing and a number. The island fills the same templates (`settle_said`).
 */
export const SETTLE_SAID = {
  /** The settlement was disbanded. */
  gone: 'That settlement is gone.',
  /** Reading or delivering to a settlement you are not on the roll of. */
  stranger: 'You are not a citizen of {deed}.',
  /** A notice with nothing in it. */
  empty: 'Write something to post.',
  /** A notice too long. */
  long: `A notice is at most ${NOTICE_MAX} characters.`,
  /** Taking down a notice that is not there. */
  noNotice: 'That notice is gone.',
  /** The start of a notice told in the log: the notice follows it. */
  heard: 'Notice at {deed} from {who}:',
  /** Asking for a kind of thing there is no such thing as. */
  what: 'There is no such thing to ask for.',
  /** Asking for a thing a crate does not take. */
  unstored: '{what} cannot go into a deed crate, so it cannot be asked for.',
  /** Asking for too few or too many. */
  count: `Ask for at least one and at most ${WORK_COUNT_MAX}.`,
  /** A lowest quality over the top of the scale. */
  ql: `A lowest quality is a whole number, at most ${WORK_QL_TOP}.`,
  /** Too many works open. */
  full: `{deed} has ${WORK_OPEN_MAX} works open, which is as many as a settlement may have.`,
  /** A work finished, taken down or never there. */
  noWork: 'That work is finished or taken down.',
  /** Too far from the token. */
  far: `Stand within ${DELIVER_REACH} tiles of the token of {deed} to deliver.`,
  /** Nothing in the pack that matches. */
  none: 'You carry no {what} to deliver.',
  /** Nothing in the pack good enough. */
  poor: 'You carry no {what} of QL {n} or better to deliver.',
  /** No deed crate standing. */
  noCrate: '{deed} has no deed crate standing to deliver into.',
  /** The deed crate full. */
  crateFull: 'The deed crate at {deed} is full.',
  /** Told to whoever delivered. */
  delivered: 'You deliver {n} × {what} to {deed}.',
  /** Told to the founder, when somebody else delivered. */
  deliveredBy: '{who} delivers {n} × {what} to {deed}.',
  /** Told to whoever delivered, the founder and whoever set it, when a work has all it wants. */
  finished: 'The work for {n} × {what} at {deed} is done.',
} as const;

export type SettleKey = keyof typeof SETTLE_SAID;

/** One of the sentences, filled in: what the island's `settle_line` does. */
export function settleLine(key: SettleKey, fill: { deed?: string; who?: string; what?: string; n?: number } = {}): string {
  return SETTLE_SAID[key]
    .replace('{deed}', fill.deed ?? '')
    .replace('{who}', fill.who ?? '')
    .replace('{what}', fill.what ?? '')
    .replace('{n}', String(fill.n ?? 0));
}

/** One notice on a settlement's board. `at` is in seconds. */
export interface Notice {
  n: number;
  uid: string;
  by: string;
  text: string;
  at: number;
}

/** One work a settlement wants. `closed` is when it was finished or taken down, in seconds; null while open. */
export interface Work {
  id: number;
  def: string;
  want: number;
  got: number;
  /** The lowest quality it takes, a whole number; null takes any. */
  minQl: number | null;
  by: string;
  at: number;
  closed: number | null;
  how: 'done' | 'dropped' | null;
}

/** One line of a settlement's ledger: a work set, a delivery, a work done or one taken down. */
export interface LedgerLine {
  n: number;
  work: number;
  what: 'set' | 'delivered' | 'done' | 'dropped';
  uid: string;
  by: string;
  def: string;
  count: number;
  /** The average quality of what was delivered; null on every other line. */
  ql: number | null;
  at: number;
}

/** Everything the Notices and Work tabs show of one settlement: `rpc_settlement`. */
export interface SettleBoard {
  deed: string;
  founder: string;
  /** Where its token stands, which delivering is measured from. */
  x: number;
  y: number;
  /** Newest first. */
  notices: Notice[];
  /** Open ones first, oldest first; then the finished and taken down, newest first. */
  work: Work[];
  /** Newest first. */
  ledger: LedgerLine[];
  /** Whether you may post and take down notices, and set and take down work. */
  post: boolean;
  set: boolean;
  /** Room left in the deed crate, in things; null when none stands. */
  room: number | null;
}

/** A notice as it is kept: trimmed, every run of spaces, tabs and line breaks made one space. */
export const cleanNotice = (text: string): string => text.trim().replace(/\s+/g, ' ');

/** Why a notice will not be posted, or null: `rpc_notice_post`, after the rank. */
export function noticeRefusal(text: string): string | null {
  const t = cleanNotice(text);
  if (!t) return settleLine('empty');
  if ([...t].length > NOTICE_MAX) return settleLine('long');
  return null;
}

/**
 * Why a work will not be set, or null: `rpc_work_set`, after the rank.
 * `name` is the thing's name, or null when there is no such thing;
 * `storable` whether a deed crate takes it; `open` how many works are open.
 */
export function workSetRefusal(deed: string, name: string | null, storable: boolean, count: number, minQl: number | null, open: number): string | null {
  if (name === null) return settleLine('what');
  if (!storable) return settleLine('unstored', { what: name });
  if (!Number.isInteger(count) || count < 1 || count > WORK_COUNT_MAX) return settleLine('count');
  if (minQl !== null && (!Number.isInteger(minQl) || minQl > WORK_QL_TOP)) return settleLine('ql');
  if (open >= WORK_OPEN_MAX) return settleLine('full', { deed });
  return null;
}

/** How far you stand from a settlement's token, across the grid, as delivering measures it. */
export const tokenDistance = (b: Pick<SettleBoard, 'x' | 'y'>, px: number, py: number): number =>
  Math.max(Math.abs(px - (b.x + 0.5)), Math.abs(py - (b.y + 0.5)));

/**
 * Why a delivery toward a work will not go, or null: `rpc_work_deliver`, in
 * its order. `held` is how many of the thing at the work's quality or better
 * you carry; `name` the thing's name, in lower case.
 */
export function deliverRefusal(b: SettleBoard, w: Work, name: string, held: number, px: number, py: number): string | null {
  if (w.closed !== null) return settleLine('noWork');
  if (tokenDistance(b, px, py) > DELIVER_REACH) return settleLine('far', { deed: b.deed });
  if (b.room === null) return settleLine('noCrate', { deed: b.deed });
  if (held <= 0) return w.minQl === null ? settleLine('none', { what: name }) : settleLine('poor', { what: name, n: w.minQl });
  if (b.room <= 0) return settleLine('crateFull', { deed: b.deed });
  return null;
}

/** Who has delivered how many toward one work, most first: read off the ledger's delivery lines. */
export function deliveredBy(ledger: readonly LedgerLine[], work: number): Array<{ uid: string; by: string; count: number }> {
  const by = new Map<string, { uid: string; by: string; count: number }>();
  for (const l of ledger) {
    if (l.work !== work || l.what !== 'delivered') continue;
    const e = by.get(l.uid) ?? { uid: l.uid, by: l.by, count: 0 };
    e.count += l.count;
    by.set(l.uid, e);
  }
  return [...by.values()].sort((a, b) => b.count - a.count || a.by.localeCompare(b.by));
}
