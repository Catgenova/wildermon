/**
 * The three patrons, and the statue of each.
 *
 * A leaf on purpose: `items.ts` names the statues off it, and `patrons.ts`
 * (which reads the faith rules, the fight and the paths) would load ahead of
 * the item table. `patrons.ts` hands these on as its own.
 *
 * A patron's statue is a restored statuette enchanted with a mote of each
 * element (`relicuse.ts`, `enchant_statue`), one item for each patron: what it
 * is, and which patron it is of, is its id. Prayed with from the pack by a
 * follower of that patron, as at an altar of its QL (`faith.ts`,
 * `pray_statue`). The island's `patron_statue` and `statue_patron`.
 */

export type PatronId = 'blessing' | 'justice' | 'chaos';
export type Alignment = 'good' | 'neutral' | 'evil';

export interface PatronDef {
  id: PatronId;
  name: string;
  alignment: Alignment;
}

export const PATRONS: PatronDef[] = [
  { id: 'blessing', name: 'Blessing', alignment: 'good' },
  { id: 'justice', name: 'Justice', alignment: 'neutral' },
  { id: 'chaos', name: 'Chaos', alignment: 'evil' },
];
export const PATRON_BY_ID = new Map(PATRONS.map((p) => [p.id, p]));

/** What a statue is enchanted out of: a restored statuette (`archaeology.ts`). */
export const STATUETTE = 'statuette';
/** A patron's statue, by its item id: `patron_statue_chaos`. */
export const patronStatue = (p: PatronId): string => `patron_statue_${p}`;
/** The patron a statue is of, or undefined for anything that is not one. */
export const statuePatron = (item: string): PatronDef | undefined => PATRONS.find((p) => patronStatue(p.id) === item);
/** What one is called: "Statue of Chaos". */
export const statueName = (p: PatronDef): string => `Statue of ${p.name}`;
