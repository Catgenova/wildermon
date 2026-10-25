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

/**
 * One day's sales of one thing: how many days ago, how many went, the silver for them all, the least and most paid for
 * one, and the average quality of what went (null where none of that day's sales was written down with its quality).
 */
export interface SaleDay {
  ago: number;
  n: number;
  silver: number;
  lo: number;
  hi: number;
  ql?: number | null;
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
  /** The average quality of what went, by the unit, over the days that say it; null when none does. */
  ql: number | null;
}

export function summarise(days: readonly SaleDay[] | undefined): SaleSummary | null {
  if (!days?.length) return null;
  const n = days.reduce((s, d) => s + d.n, 0);
  const silver = days.reduce((s, d) => s + d.silver, 0);
  if (n <= 0) return null;
  const withQl = days.filter((d) => typeof d.ql === 'number');
  const qn = withQl.reduce((s, d) => s + d.n, 0);
  return {
    n,
    each: silver / n,
    lo: Math.min(...days.map((d) => d.lo)),
    hi: Math.max(...days.map((d) => d.hi)),
    last: Math.min(...days.map((d) => d.ago)),
    ql: qn > 0 ? withQl.reduce((s, d) => s + (d.ql as number) * d.n, 0) / qn : null,
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
  return `Island sales, last ${SALE_DAYS} days: ${s.n}, ${range}.`;
}

/**
 * One sale of a thing, as `rpc_sales` hands the month's last few back: how
 * long ago in seconds, how many went, the silver for them all, and the average
 * quality of what went (null for a sale from before the island wrote it down).
 */
export interface Sale {
  ago: number;
  n: number;
  silver: number;
  ql: number | null;
}

/** How many of a thing's last sales `rpc_sales` hands back. The island's `sales_shown()` says the same. */
export const SALES_SHOWN = 12;

/** "5 min", "3 h", "4 days": how long ago a sale was. */
export function agoWords(secs: number): string {
  const s = Math.max(0, secs);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86400);
  return `${d} ${d === 1 ? 'day' : 'days'}`;
}

/** One sale as the history lists it: "3 h ago · 4 sold · QL 28 · 3.3 silver each". */
export const saleLine = (s: Sale): string =>
  `${agoWords(s.ago)} ago · ${s.n} sold${s.ql === null ? '' : ` · QL ${Math.round(s.ql)}`} · ${silverEach(s.silver / Math.max(1, s.n))} silver each`;

/** A month of a thing's sales in one line: "43 sold · 2–5 silver each, avg 3.1 · avg QL 31". */
export function summaryWords(s: SaleSummary): string {
  const range = s.lo === s.hi ? `${silverEach(s.lo)} silver each` : `${silverEach(s.lo)}–${silverEach(s.hi)} silver each, avg ${silverEach(s.each)}`;
  return `${s.n} sold · ${range}${s.ql === null ? '' : ` · avg QL ${Math.round(s.ql)}`}`;
}
