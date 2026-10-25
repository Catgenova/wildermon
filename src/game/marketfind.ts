import { itemDef } from './items';

/**
 * Finding a thing on the market board: every priced thing on every stall and
 * shop counter the island lists (`rpc_market`), one row each, whatever stall
 * it is on, matched against what is typed and sorted by the price of one, by
 * quality or by distance. And the buy orders that want the same.
 *
 * A thing on a stall is priced as it lies, a stack of five iron ore for one
 * price; the price of one is that price over the five, which is what two
 * stalls are compared by and what the island's sales are counted in
 * (`prices.ts`).
 */

/** A stall as the board lists it, as far as finding a thing on it needs. */
export interface FindStall {
  id: number;
  x: number;
  y: number;
  owner: string;
  mine: boolean;
  deed: string | null;
  what?: 'stall' | 'counter';
  goods: FindGood[];
}
export interface FindGood {
  id: number;
  def: string;
  ql: number;
  count: number;
  extra: string | null;
  price: number | null;
}

/** One priced thing on one stall: the price of one, and how far its stall is, in tiles. */
export interface Offer<S extends FindStall = FindStall, G extends FindGood = FindGood> {
  stall: S;
  good: G;
  each: number;
  far: number;
}

/** How the found are sorted: by the price of one, by quality, or by distance. */
export type FindSort = 'each' | 'ql' | 'near';
export const FIND_SORTS: ReadonlyArray<readonly [FindSort, string]> = [
  ['each', 'Price each'],
  ['ql', 'QL'],
  ['near', 'Distance'],
];

/** How many found rows the board shows at once. */
export const FIND_SHOWN = 60;

/** Tiles from a spot to a stall's middle, as the board says them. */
export const tilesTo = (st: { x: number; y: number }, from: { x: number; y: number }): number =>
  Math.round(Math.hypot(st.x + 0.5 - from.x, st.y + 0.5 - from.y));

/**
 * Whether a kind of thing, and what it is made of, answers what was typed:
 * every word typed is in its name or its material, in any case. Nothing typed
 * answers nothing.
 */
export function answers(def: string, extra: string | null, typed: string): boolean {
  const words = typed.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  const name = `${itemDef(def).name} ${extra ?? ''} ${def.replace(/_/g, ' ')}`.toLowerCase();
  return words.every((w) => name.includes(w));
}

/**
 * Every priced thing on somebody else's stall that answers what was typed,
 * sorted: by the price of one, cheapest first; by quality, best first; or by
 * distance, nearest first. Ties go to the cheaper, then the nearer.
 */
export function offersFor<S extends FindStall>(stalls: readonly S[], typed: string, from: { x: number; y: number },
  sort: FindSort): Array<Offer<S, S['goods'][number]>> {
  const out: Array<Offer<S, S['goods'][number]>> = [];
  for (const stall of stalls) {
    if (stall.mine) continue;
    const far = tilesTo(stall, from);
    for (const good of stall.goods) {
      if (good.price === null || good.price <= 0 || !answers(good.def, good.extra, typed)) continue;
      out.push({ stall, good, each: good.price / Math.max(1, good.count), far });
    }
  }
  const by: Record<FindSort, (a: Offer, b: Offer) => number> = {
    each: (a, b) => a.each - b.each || b.good.ql - a.good.ql || a.far - b.far,
    ql: (a, b) => b.good.ql - a.good.ql || a.each - b.each || a.far - b.far,
    near: (a, b) => a.far - b.far || a.each - b.each,
  };
  return out.sort(by[sort]);
}

/** The kinds of thing for sale on the board, by name, for the Find box to offer. */
export const kindsOnSale = (stalls: readonly FindStall[]): string[] =>
  [...new Set(stalls.filter((s) => !s.mine).flatMap((s) => s.goods.filter((g) => g.price).map((g) => itemDef(g.def).name)))]
    .sort((a, b) => a.localeCompare(b));

/**
 * The price of one against what one has gone for on the island this month:
 * how many in a hundred dearer (above nought) or cheaper (below), rounded; null
 * when nothing like it has sold.
 */
export const againstAverage = (each: number, average: number | null | undefined): number | null =>
  average && average > 0 ? Math.round((each / average - 1) * 100) : null;

/** "12% under avg", "8% over avg", "at avg": the price of one against the month's average. */
export function againstWords(pct: number | null): string {
  if (pct === null) return '';
  if (pct === 0) return 'at avg';
  return pct < 0 ? `${-pct}% under avg` : `${pct}% over avg`;
}
