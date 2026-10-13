import { BREW_BY_ID, BREWS, MEAD_AGEING, WINE_AGEING, type Ageing, type BrewDef } from './brewing';
import { LIQUID_NAME, type LiquidKind, type PlacedFurniture } from './furniture';
import { describeFrom } from './items';
import { QL_TOP } from './limits';
import { DAY_SECONDS } from './pace';
import { STATE_TAILS } from './pieceTails';

/**
 * Brews that age: a barrel of wine or mead gets better the longer it is kept
 * after it stops working.
 *
 * A brew that ages (`BrewDef.ages`: cherry wine, grape wine and mead, each
 * with its own `Ageing`) gains its `rate` in QL for every day of the island's
 * year it has been kept, `CELLAR_AGEING` times that in a barrel standing in a
 * cellar, and never more than its `cap` over the QL it was brewed at, nor
 * past 100. It counts from the moment the brew stops working (`agedFrom`; the
 * island's placed row's `aged_from`), which is stamped when the brew is set
 * going -- the moment it began and the seconds it works -- and kept on the
 * barrel until it is empty. A barrel holding liquid does not move, so where
 * it stands is where it has been all along: its storey decides the rate for
 * the whole of its age.
 *
 * Nothing is written down as it ages. Its QL is read off the clock whenever
 * it is wanted -- Examine, the line under its name, a drink from it, a bucket
 * drawn off it -- the same on both sides (`age_gain`, `brew_ql`).
 *
 * Every liquid but water carries its QL in and out of a barrel (`keepsQl`):
 * a bucket drawn off milk, juice, lye or a brew is at the QL the barrel is at
 * as it is drawn (`drawnQl`), aged or not, and keeps it: it is drunk, sold
 * and traded at it. Poured back into a barrel it keeps it too -- an empty
 * barrel takes the bucket's QL, a barrel of the same the average of the two
 * by litres (`pouredQl`) -- and a barrel poured into does not age: what was poured was
 * aged somewhere else, and drawing off and pouring back would otherwise take
 * a brew past its cap a cap at a time. `supabase/test/vineyard.ts` and
 * `supabase/test/aged.ts` hold the two sides to each other.
 */

/** QL a barrel of wine gains a day of the island's year, kept out of a cellar (wine's `Ageing`, for what says wine alone). */
export const WINE_AGE_RATE = WINE_AGEING.rate;
/** The most QL ageing adds to a wine over what it was brewed at. */
export const WINE_AGE_CAP = WINE_AGEING.cap;
/** QL a barrel of mead gains a day of the island's year, kept out of a cellar. */
export const MEAD_AGE_RATE = MEAD_AGEING.rate;
/** The most QL ageing adds to a mead over what it was brewed at. */
export const MEAD_AGE_CAP = MEAD_AGEING.cap;
/** How many times as fast a brew ages in a barrel standing in a cellar. */
export const CELLAR_AGEING = 4;

/** How a liquid ages in its barrel, or nothing for one that does not. The island's `age_rate` and `age_cap`. */
export const ageingOf = (liquid: LiquidKind | undefined): Ageing | undefined => (liquid ? BREW_BY_ID.get(liquid)?.ages : undefined);

/** Whether a liquid is a brew that ages in its barrel. The island's `brew_ages`. */
export const brewAges = (liquid: LiquidKind | undefined): boolean => !!ageingOf(liquid);

/** The brews that age, grouped by the ageing they share, in the order they are brewed: wine and grape wine together, then mead. */
export const AGEING_GROUPS: Array<{ ageing: Ageing; brews: BrewDef[] }> = [];
for (const b of BREWS) {
  if (!b.ages) continue;
  const group = AGEING_GROUPS.find((g) => g.ageing === b.ages);
  if (group) group.brews.push(b);
  else AGEING_GROUPS.push({ ageing: b.ages, brews: [b] });
}

/** Whether a piece stands in a cellar. */
export const inCellar = (f: Pick<PlacedFurniture, 'level'>): boolean => (f.level ?? 0) < 0;

/**
 * The QL a brew that ages has gained after `age` seconds kept, in a cellar or
 * not: the island's `age_gain`, operation for operation. Nothing for a liquid
 * that does not age.
 */
export function ageGain(liquid: LiquidKind | undefined, age: number, cellar: boolean): number {
  const a = ageingOf(liquid);
  if (!a || !(age > 0)) return 0;
  return Math.min(a.cap, a.rate * (cellar ? CELLAR_AGEING : 1) * (age / DAY_SECONDS));
}

/** Seconds the brew in a barrel has been kept since it stopped working, at `now` (epoch seconds); null for one that does not age. */
export function wineAge(f: PlacedFurniture, now: number): number | null {
  if (!brewAges(f.liquid) || f.agedFrom === undefined || (f.litres ?? 0) <= 0) return null;
  return Math.max(0, now - f.agedFrom);
}

/** The QL of what is in a barrel, at `now`: what it was brewed at, and what it has gained since. The island's `brew_ql`. */
export function brewQl(f: PlacedFurniture, now: number): number {
  const age = wineAge(f, now);
  return age === null ? f.ql : Math.min(QL_TOP, f.ql + ageGain(f.liquid, age, inCellar(f)));
}

/**
 * Whether a liquid carries its own QL in and out of a barrel: every one but
 * water, which takes the QL of whatever it is in. Dye carries its QL in its
 * mix (`dyestuffs.ts`), by its own pouring and drawing. The island's
 * `keeps_ql`.
 */
export const keepsQl = (liquid: LiquidKind | undefined): boolean => !!liquid && liquid !== 'water';

/**
 * The QL a bucket drawn off a barrel holds at `now`: what the barrel holds,
 * aged as it is now for a brew that ages, which goes with it; nothing for
 * water, which leaves the bucket its own. The island's `drawn_ql`.
 */
export const drawnQl = (f: PlacedFurniture, now: number): number | undefined => (keepsQl(f.liquid) ? brewQl(f, now) : undefined);

/**
 * The QL of a barrel a bucket of what it holds is poured into at `now`: the
 * bucket's, into an empty barrel, and the average of the barrel's (aged, as
 * it is now) and the bucket's by litres, into one that holds some. The
 * island's `poured_ql`.
 */
export function pouredQl(f: PlacedFurniture, now: number, poured: number, ql: number): number {
  const had = f.litres ?? 0;
  if (!(had > 0)) return ql;
  return (had * brewQl(f, now) + poured * ql) / (had + poured);
}

/**
 * A number to `d` places, rounded half up off the number itself first, so
 * that a tie falls the same way here and in the island's `to_char` (the
 * island's `fixed_to`).
 */
export const fixedTo = (x: number, d: number): string => (Math.floor(x * 10 ** d + 0.5) / 10 ** d).toFixed(d);

/** The rate a barrel of `a` ages at where it stands, in QL a day. */
export const ageRate = (a: Ageing, cellar: boolean): number => a.rate * (cellar ? CELLAR_AGEING : 1);

/**
 * What Examine adds of a barrel of a brew that ages: how long it has been kept and where,
 * the QL it has gained at what rate and up to what, and the QL it pours at.
 * Nothing for anything that does not age, or is still working. The island's
 * `wine_age_says`.
 */
export function wineAgeSays(f: PlacedFurniture, now: number): string {
  const age = wineAge(f, now);
  if (age === null || now < (f.agedFrom ?? now)) return '';
  const cellar = inCellar(f);
  const a = ageingOf(f.liquid) as Ageing;
  return ` Kept ${fixedTo(age / DAY_SECONDS, 1)} days${cellar ? ' in a cellar' : ''}, at ${fixedTo(ageRate(a, cellar), 2)} QL a day`
    + `${cellar ? ` (${CELLAR_AGEING} × ${fixedTo(a.rate, 2)})` : ''} up to +${fixedTo(a.cap, 2)}: `
    + `+${fixedTo(ageGain(f.liquid, age, cellar), 2)} QL, so the ${LIQUID_NAME[f.liquid as LiquidKind]} in it is QL ${fixedTo(brewQl(f, now), 2)}.`;
}

/** The rule for one brew that ages, said once, for its bucket's text. */
export const ageingRule = (a: Ageing): string => `it gains ${a.rate} QL a day of the island's year after it stops working, `
  + `${CELLAR_AGEING} times that (${a.rate * CELLAR_AGEING} a day) in a barrel standing in a cellar, up to ${a.cap} QL over what it was brewed at; `
  + 'a bucket drawn off it is at the QL the barrel is at.';

// The line under a barrel's name says how long its brew has been kept and the QL it is at now.
STATE_TAILS.push((f) => {
  const now = Date.now() / 1000;
  const age = wineAge(f, now);
  if (age === null || now < (f.agedFrom ?? now)) return '';
  return ` · kept ${fixedTo(age / DAY_SECONDS, 1)} days${inCellar(f) ? ' in a cellar' : ''}, now QL ${fixedTo(brewQl(f, now), 2)}`;
});

for (const b of BREWS) if (b.ages) describeFrom(`${b.id}_bucket`, { ageing: ageingRule(b.ages) });
