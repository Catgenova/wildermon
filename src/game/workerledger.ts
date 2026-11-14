/**
 * A worker's idle reason and its ledger, as kept on it: the codes, and the
 * ledger's two days rolled and counted to (`ledger_roll`, `ledger_add`).
 *
 * A leaf, so the worker's rules (`creatures.ts`) can keep them without loading
 * the sentences made from them (`workerlog.ts`), which says them on.
 */

export type IdleWhy = 'range' | 'stock' | 'room' | 'full' | 'far' | 'away' | 'unswept' | 'rest' | 'bed' | 'tired' | 'nospar' | 'yielded' | 'season' | 'flowers' | 'stairs' | 'stranded' | 'waiting' | 'nostore' | 'seam' | 'noseam';
export const IDLE_WHYS: readonly IdleWhy[] = ['range', 'stock', 'room', 'full', 'far', 'away', 'unswept', 'rest', 'bed', 'tired', 'nospar', 'yielded', 'season', 'flowers', 'stairs', 'stranded', 'waiting', 'nostore', 'seam', 'noseam'];

/**
 * Why a worker is idle, as kept on it: the code, its number, and whether it works off a post or round its keeper
 * (`around`, the island's `idleAround`) rather than the token; for a rest in a bed, the bed's kind.
 */
export interface Idle {
  why: IdleWhy;
  n: number;
  post?: boolean;
  around?: boolean;
  bed?: string;
  what?: string[];
}

/** How many of what work in range wants a `stock` reason names (`Idle.what`). The island's `idle_wants`. */
export const IDLE_WANTS = 3;

/**
 * How many different things one day's ledger counts. A worker handles one or
 * two kinds of thing a day as a rule; a ninth kind on the same day is left
 * uncounted, so that the ledger stays the same small size however long it
 * runs. The island's `ledger_items`.
 */
export const LEDGER_ITEMS = 8;
/** How many of them the card says: the most, then by name. */
export const LEDGER_SHOWN = 3;

/** One island day's work: its goes at its task, the skill it gained, and what it handled by the item. */
export interface LedgerDay {
  goes: number;
  skill: number;
  made: Record<string, number>;
}

/**
 * Two days, the one under way and the one before it, by the island day
 * (`islandDay`): rolled over when a day goes by, so it never holds more than
 * two. `last` is the day before `day` only; a day it did nothing is no day.
 */
export interface WorkLedger {
  day: number;
  now: LedgerDay;
  last: LedgerDay | null;
}

const emptyDay = (): LedgerDay => ({ goes: 0, skill: 0, made: {} });

/** The ledger as it stands on `day`: rolled on to it if it was last written on an earlier one. The island's `ledger_roll`. */
export function ledgerRoll(l: WorkLedger | null | undefined, day: number): WorkLedger {
  if (!l) return { day, now: emptyDay(), last: null };
  if (l.day === day) return l;
  return { day, now: emptyDay(), last: l.day === day - 1 ? l.now : null };
}

/**
 * Something counted to today's work: a go, skill gained, or so many of a
 * thing handled. The island's `ledger_add`, to the letter.
 */
export function ledgerAdd(
  l: WorkLedger | null | undefined,
  day: number,
  add: { goes?: number; skill?: number; item?: string | null; n?: number },
): WorkLedger {
  const out = ledgerRoll(l, day);
  const now = out.now;
  now.goes += add.goes ?? 0;
  now.skill += add.skill ?? 0;
  if (add.item && (add.n ?? 0) > 0 && (add.item in now.made || Object.keys(now.made).length < LEDGER_ITEMS)) {
    now.made[add.item] = (now.made[add.item] ?? 0) + (add.n ?? 0);
  }
  return out;
}

/** The two days as they read on `day`: today's so far, and yesterday's. */
export function ledgerDays(l: WorkLedger | null | undefined, day: number): { today: LedgerDay | null; last: LedgerDay | null } {
  if (!l || l.day < day - 1) return { today: null, last: null };
  if (l.day === day - 1) return { today: null, last: l.now };
  return { today: l.now, last: l.last };
}
