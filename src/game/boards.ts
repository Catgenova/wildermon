/**
 * What the island's leaderboards rank by.
 *
 * Both sides read these. `BOARD_TOP` and `GRADE_STEP` reach the island as
 * `board_top()` and `grade_step(tier)` through `npm run defs`, so the order
 * `rpc_boards` puts things in and the line the Leaderboards window prints over
 * it are one set of numbers.
 */
import { GRADE_STEP, pct, traitOf } from './traits';
import { SKILL_DEFS } from './skills';
import { BASE_STATS, type BaseStat } from './creatures';

/** How many places each board has: per skill, for wildermon, and for settlements. */
export const BOARD_TOP = 10;

/**
 * What a wildermon scores on the best-bred board: each trait it carries
 * counted at its grade's step, added up. The steps are the ones a trait's
 * worth climbs by, so the board ranks blood the way the blood itself pays.
 */
export const bredScore = (traits: readonly string[]): number =>
  traits.reduce((n, id) => {
    const t = traitOf(id);
    return t ? n + GRADE_STEP[t.tier] : n;
  }, 0);

/**
 * Your best skill, for the window to open on and for the game you play by
 * yourself: the highest you have raised above where it starts, characteristics
 * not counted. Every characteristic but one starts at twenty and every other
 * skill at one, so counting them would name a characteristic as every
 * newcomer's best.
 */
export function bestSkill(get: (id: string) => number): { id: string; value: number } | null {
  let best: { id: string; value: number } | null = null;
  for (const d of SKILL_DEFS) {
    if (d.group === 'Characteristics') continue;
    const v = get(d.id);
    if (v > d.start && (!best || v > best.value)) best = { id: d.id, value: v };
  }
  return best;
}

/**
 * The bred records an island keeps for each kind, the best any young one of
 * it was ever born with: each of its base stats (`BASE_STATS`) as its blood
 * gives it at birth -- `bloodMul`, the island's `beast_mul`: its traits, its
 * line and its rarity -- and its trait total (`bredScore`). Each names the
 * young one, its breeder (the dam's keeper) and the day, and stays when the
 * young one dies or is let go. The island's `bred_record`, written in
 * `give_birth` only where a birth beats what stands; a tie keeps the first.
 */
export type RecordStat = BaseStat | 'traits';
export const RECORD_STATS: ReadonlyArray<{ id: RecordStat; name: string }> = [
  ...BASE_STATS.map((s) => ({ id: s.id, name: s.name })),
  { id: 'traits', name: 'Trait total' },
];
/** One record as the island hands it out (`rpc_bred_records`, and `records` on `rpc_boards`). */
export interface BredRecord {
  species: string;
  stat: RecordStat;
  value: number;
  /** The young one, as it was named at birth. */
  name: string;
  breeder: string;
  /** When it was born, in milliseconds. */
  at: number;
  /** Bred by you. */
  mine: boolean;
}
/** A record's figure: a base stat as its blood over its kind's ("+32%"), a trait total as the wildermon board scores it. */
export const recordFigure = (stat: RecordStat, value: number): string =>
  stat === 'traits' ? (Number.isInteger(value) ? String(value) : value.toFixed(1)) : pct(value);
/** A record's stat, named. */
export const recordName = (stat: RecordStat): string => RECORD_STATS.find((s) => s.id === stat)?.name ?? stat;
/** A day as a record says it: "22 October 2026". */
export const dayOf = (ms: number): string =>
  new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
/** "Record: Health +32% (Snowy, Ann, 22 October 2026)", for a kind's Field guide page. */
export const recordSaid = (r: BredRecord): string =>
  `Record: ${recordName(r.stat)} ${recordFigure(r.stat, r.value)} (${r.name}, ${r.breeder}, ${dayOf(r.at)})`;
