import { BREW_BY_ID } from './brewing';
import { LIQUID_NAME, type LiquidKind, type PlacedFurniture } from './furniture';
import { describeFrom } from './items';
import { QL_TOP } from './limits';
import { DAY_SECONDS } from './pace';
import { STATE_TAILS } from './pieceTails';

/**
 * Wine that ages: a barrel of wine gets better the longer it is kept after it
 * stops working.
 *
 * A brew that ages (`BrewDef.ages`: cherry wine and grape wine) gains
 * `WINE_AGE_RATE` QL for every day of the island's year it has been kept,
 * `CELLAR_AGEING` times that in a barrel standing in a cellar, and never more
 * than `WINE_AGE_CAP` over the QL it was brewed at, nor past 100. It counts
 * from the moment the brew stops working (`agedFrom`; the island's placed
 * row's `aged_from`), which is stamped when the brew is set going -- the
 * moment it began and the seconds it works -- and kept on the barrel until it
 * is empty. A barrel holding liquid does not move, so where it stands is
 * where it has been all along: its storey decides the rate for the whole of
 * its age. Wine poured into a barrel from a bucket was brewed somewhere else,
 * and does not age in it.
 *
 * Nothing is written down as it ages. Its QL is read off the clock whenever
 * it is wanted -- Examine, the line under its name, a drink from it -- the
 * same on both sides (`wine_gain`, `brew_ql`), and `supabase/test/vineyard.ts`
 * holds the two to each other.
 */

/** QL a barrel of wine gains a day of the island's year, kept out of a cellar. */
export const WINE_AGE_RATE = 0.25;
/** The most QL ageing adds to what it was brewed at. */
export const WINE_AGE_CAP = 10;
/** How many times as fast wine ages in a barrel standing in a cellar. */
export const CELLAR_AGEING = 4;

/** Whether a liquid is a brew that ages in its barrel. The island's `brew_ages`. */
export const brewAges = (liquid: LiquidKind | undefined): boolean => !!liquid && !!BREW_BY_ID.get(liquid)?.ages;

/** Whether a piece stands in a cellar. */
export const inCellar = (f: Pick<PlacedFurniture, 'level'>): boolean => (f.level ?? 0) < 0;

/**
 * The QL a brew that ages has gained after `age` seconds kept, in a cellar or
 * not: the island's `wine_gain`, operation for operation.
 */
export function wineGain(age: number, cellar: boolean): number {
  if (!(age > 0)) return 0;
  return Math.min(WINE_AGE_CAP, WINE_AGE_RATE * (cellar ? CELLAR_AGEING : 1) * (age / DAY_SECONDS));
}

/** Seconds the brew in a barrel has been kept since it stopped working, at `now` (epoch seconds); null for one that does not age. */
export function wineAge(f: PlacedFurniture, now: number): number | null {
  if (!brewAges(f.liquid) || f.agedFrom === undefined || (f.litres ?? 0) <= 0) return null;
  return Math.max(0, now - f.agedFrom);
}

/** The QL of what is in a barrel, at `now`: what it was brewed at, and what it has gained since. The island's `brew_ql`. */
export function brewQl(f: PlacedFurniture, now: number): number {
  const age = wineAge(f, now);
  return age === null ? f.ql : Math.min(QL_TOP, f.ql + wineGain(age, inCellar(f)));
}

/**
 * A number to `d` places, rounded half up off the number itself first, so
 * that a tie falls the same way here and in the island's `to_char` (the
 * island's `fixed_to`).
 */
export const fixedTo = (x: number, d: number): string => (Math.floor(x * 10 ** d + 0.5) / 10 ** d).toFixed(d);

/** The rate a barrel ages at where it stands, in QL a day. */
export const ageRate = (cellar: boolean): number => WINE_AGE_RATE * (cellar ? CELLAR_AGEING : 1);

/**
 * What Examine adds of a barrel of wine: how long it has been kept and where,
 * the QL it has gained at what rate and up to what, and the QL it pours at.
 * Nothing for anything that does not age, or is still working. The island's
 * `wine_age_says`.
 */
export function wineAgeSays(f: PlacedFurniture, now: number): string {
  const age = wineAge(f, now);
  if (age === null || now < (f.agedFrom ?? now)) return '';
  const cellar = inCellar(f);
  return ` Kept ${fixedTo(age / DAY_SECONDS, 1)} days${cellar ? ' in a cellar' : ''}, at ${fixedTo(ageRate(cellar), 2)} QL a day`
    + `${cellar ? ` (${CELLAR_AGEING} × ${fixedTo(WINE_AGE_RATE, 2)})` : ''} up to +${fixedTo(WINE_AGE_CAP, 2)}: `
    + `+${fixedTo(wineGain(age, cellar), 2)} QL, so the ${LIQUID_NAME[f.liquid as LiquidKind]} in it is QL ${fixedTo(brewQl(f, now), 2)}.`;
}

/** The rule, said once, for the help and a wine's text. */
export const AGEING_RULE = (): string => `it gains ${WINE_AGE_RATE} QL a day of the island's year after it stops working, `
  + `${CELLAR_AGEING} times that (${WINE_AGE_RATE * CELLAR_AGEING} a day) in a barrel standing in a cellar, up to ${WINE_AGE_CAP} QL over what it was brewed at.`;

// The line under a barrel's name says how long its wine has been kept and the QL it is at now.
STATE_TAILS.push((f) => {
  const now = Date.now() / 1000;
  const age = wineAge(f, now);
  if (age === null || now < (f.agedFrom ?? now)) return '';
  return ` · kept ${fixedTo(age / DAY_SECONDS, 1)} days${inCellar(f) ? ' in a cellar' : ''}, now QL ${fixedTo(brewQl(f, now), 2)}`;
});

for (const id of ['wine_bucket', 'grape_wine_bucket']) describeFrom(id, { ageing: AGEING_RULE() });
