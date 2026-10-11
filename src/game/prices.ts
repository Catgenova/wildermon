/**
 * What things have sold for on the island over the last month (`rpc_prices`).
 *
 * A sale is a thing bought off a stall or a shop counter, or brought to a buy
 * order: the island writes each one down, keeps `SALE_DAYS` days of them, and
 * hands them back a row a day per thing. The Market window charts them, and a
 * thing in the pack or a store says what its like went for.
 */

/** How many days of sales the island keeps and shows. The island's `sale_days()` says the same. */
export const SALE_DAYS = 30;

/** One day's sales of one thing: how many days ago, how many went, the silver for them all, and the least and most paid for one. */
export interface SaleDay {
  ago: number;
  n: number;
  silver: number;
  lo: number;
  hi: number;
}

/** Every thing sold in the month, by item id. */
export type Prices = Record<string, SaleDay[]>;

/** A month of one thing's sales summed: how many went, at what each on average, and the cheapest and dearest one. */
export interface SaleSummary {
  n: number;
  each: number;
  lo: number;
  hi: number;
  /** The day of the month it last sold, as days ago. */
  last: number;
}

export function summarise(days: readonly SaleDay[] | undefined): SaleSummary | null {
  if (!days?.length) return null;
  const n = days.reduce((s, d) => s + d.n, 0);
  const silver = days.reduce((s, d) => s + d.silver, 0);
  if (n <= 0) return null;
  return {
    n,
    each: silver / n,
    lo: Math.min(...days.map((d) => d.lo)),
    hi: Math.max(...days.map((d) => d.hi)),
    last: Math.min(...days.map((d) => d.ago)),
  };
}

/** The average price of one, each day of the month, oldest first; null on a day nothing sold. */
export function dailyEach(days: readonly SaleDay[] | undefined): Array<number | null> {
  const out: Array<number | null> = Array.from({ length: SALE_DAYS }, () => null);
  for (const d of days ?? []) {
    const i = SALE_DAYS - 1 - d.ago;
    if (i >= 0 && i < SALE_DAYS && d.n > 0) out[i] = d.silver / d.n;
  }
  return out;
}

/** "4.5", "12": a price of one, to the tenth of a silver where it is not whole. */
export const silverEach = (v: number): string => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));

/**
 * The line a thing in the pack says about its like on the market:
 * "Sold on the island in 30 days: 14, 3 to 5 silver each, 4.2 on average."
 */
export function priceLine(days: readonly SaleDay[] | undefined): string | null {
  const s = summarise(days);
  if (!s) return null;
  const range = s.lo === s.hi ? `${silverEach(s.lo)} silver each` : `${silverEach(s.lo)} to ${silverEach(s.hi)} silver each, ${silverEach(s.each)} on average`;
  return `Sold on the island in ${SALE_DAYS} days: ${s.n}, ${range}.`;
}
