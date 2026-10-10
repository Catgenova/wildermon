/**
 * Enchanting: the table, the numbers and the words, and nothing else.
 *
 * Asked for: "First the player will need to make a Paper Press station out of
 * wood, and then make papyrus from reed. They can then craft scrolls by
 * combining papyrus and motes. The first enchantment will require Fire Motes
 * and papyrus to make a Firebrand Enchantment. This will have a chance to
 * apply a fire burn debuff on hit with a melee weapon. The chance will depend
 * on the Enchantment quality. The Enchantment will show an indicator on the
 * item name and the QL will display when the item is examined. Creating an
 * Enchantment scroll is determined by the Enchanting skill. If a roll is
 * failed when making a scroll the mote is lost and the papyrus damaged.
 * Applying the enchantment has a chance determined by enchantment skill and
 * scroll ql, both of which also determine the applied enchantment ql, capped
 * at scroll QL. A failure when applying an enchantment causes significant
 * damage to the item, with a small chance to completely break it." And then
 * two more beside it, Razoredge (a bleed) and Concussion (a stun), and the
 * enchantment's quality held to the item's own as well as the scroll's.
 *
 * An enchantment is one row of `ENCHANTMENT_LIST`: what it is called, the mote
 * its scroll is written with, what a hit does (`effect`) and how often for
 * each point of its quality (`perQl`). Everything else -- the scroll, its
 * recipe, the refusals, the marker on a name, Examine's line, the help and
 * the island's copy -- is worked out from the row.
 *
 * A leaf on purpose: `items.ts` reads the name marker off it, and anything
 * this imported would load ahead of the item table. The doing of it -- the
 * Enchant job, a scroll that fails, what a hit does -- is `enchanting.ts`.
 * The island holds the same numbers, crossed in the defs, and says the same
 * words (`enchant_*` in the migrations).
 */
import { QL_TOP } from './limits';
import { percent } from './words';

/** The skill, trained by writing a scroll and by putting one into a weapon, a go each. */
export const ENCHANTING = 'enchanting';
/** The station papyrus is pressed at: a wooden screw press set down on the ground. */
export const PAPER_PRESS = 'paper_press';

/**
 * What a melee hit with an enchanted weapon does, the share of the time it
 * does it: a burn as a Kindler's Scorch starts one, a bleed as a knife opens
 * one, or a stun (`STUN_SECS`, `fight.ts`).
 */
export type EnchantEffect = 'burn' | 'bleed' | 'stun';

export interface EnchantmentDef {
  id: string;
  /** What it is called, and what the name of a thing holding it carries: "Sword (Firebrand)". */
  name: string;
  /** The scroll it is written on. */
  scroll: string;
  /** The mote it is written with. */
  mote: string;
  /** What a hit that lands does, now and then. */
  effect: EnchantEffect;
  /** The share of hits it does it on, for each point of the enchantment's quality, up to `QL_TOP`. */
  perQl: number;
}

const row = (id: string, name: string, element: string, effect: EnchantEffect, perQl: number): EnchantmentDef =>
  ({ id, name, scroll: `${id}_scroll`, mote: `${element}_mote`, effect, perQl });

/**
 * Every enchantment there is. Firebrand and Razoredge a quarter of their
 * quality as a percent (25% at QL 100), Concussion a tenth (10% at QL 100):
 * the owner's numbers.
 */
export const ENCHANTMENT_LIST: readonly EnchantmentDef[] = [
  row('firebrand', 'Firebrand', 'fire', 'burn', 0.0025),
  row('razoredge', 'Razoredge', 'ice', 'bleed', 0.0025),
  row('concussion', 'Concussion', 'earth', 'stun', 0.001),
];
export const ENCHANTMENTS: Record<string, EnchantmentDef> = Object.fromEntries(ENCHANTMENT_LIST.map((e) => [e.id, e]));
export const FIREBRAND = 'firebrand';
export const RAZOREDGE = 'razoredge';
export const CONCUSSION = 'concussion';
/** The enchantment a scroll carries, by the scroll's item id, or undefined for anything that is not a scroll. */
export const scrollOf = (item: string): EnchantmentDef | undefined => ENCHANTMENT_LIST.find((e) => e.scroll === item);

/** What an enchanted thing carries: which enchantment, and at what quality. On the island, `item.enchant`. */
export interface Enchant {
  id: string;
  ql: number;
}

/**
 * Writing a scroll. Its recipe takes `SCROLL_SHEETS` papyrus and
 * `SCROLL_MOTES` motes and rolls on enchanting at `SCROLL_DIFFICULTY`, as any
 * craft rolls -- a first-tier one, beside a loom's cloth (12) and a papyrus
 * press (16). A scroll comes out at the quality an enchanting go makes, and
 * never better than the papyrus it is written on.
 */
export const SCROLL_SHEETS = 1;
export const SCROLL_MOTES = 2;
export const SCROLL_DIFFICULTY = 14;
/**
 * A scroll that fails: the motes are gone, and the sheet it was being written
 * on takes this much damage, and is used up if that takes it to `DAMAGE_MAX`
 * (`limits.ts`). A sheet of a pile takes it as one of the pile: the pile's
 * damage goes up by this over how many sheets are in it.
 */
export const SCROLL_HARM = 25;

/**
 * Putting a scroll into a weapon. It takes when a roll falls under the average
 * of enchanting and the scroll's QL, as a percent, never under `ENCHANT_LEAST`
 * and never over `ENCHANT_MOST`; either way the scroll is used up.
 */
export const ENCHANT_LEAST = 0.05;
export const ENCHANT_MOST = 0.95;
/** A go at it: seconds at enchanting 1, and wind. */
export const ENCHANT_TIME = 8;
export const ENCHANT_WIND = 0.02;
/** One that does not take: the weapon takes this much damage, and one in `1 / ENCHANT_BREAK` goes to pieces outright. */
export const ENCHANT_HARM = 30;
export const ENCHANT_BREAK = 0.05;

/** The average of the two: the share of goes that take, and what the quality is rolled about. */
export const enchantBase = (skill: number, scrollQl: number): number => (skill + scrollQl) / 2;
/** The chance a go takes, as a share. */
export const enchantChance = (skill: number, scrollQl: number): number =>
  Math.min(ENCHANT_MOST, Math.max(ENCHANT_LEAST, enchantBase(skill, scrollQl) / 100));

/** What held an enchantment's quality down, when something did. */
export type EnchantHeld = 'scroll' | 'item' | null;

/**
 * The quality an enchantment that took comes out at: the average of
 * enchanting and the scroll's QL put through the spread every craft's quality
 * is rolled with (`rolled`, handed the average, is that rule: `Game`'s
 * `QL_LOW`, `QL_SPAN` and `QL_BARE`), and then held to the scroll's QL and to
 * the item's own -- and which of the two held it down, when one did: the
 * item's, where it is the lower. The island's `enchant_ql` is the same sum.
 */
export function enchantQl(skill: number, scrollQl: number, itemQl: number, rolled: (base: number) => number): { ql: number; held: EnchantHeld } {
  const base = Math.min(QL_TOP, Math.max(1, enchantBase(skill, scrollQl)));
  const r = Math.min(QL_TOP, Math.max(1, rolled(base)));
  const cap = Math.min(scrollQl, itemQl);
  if (r <= cap) return { ql: r, held: null };
  return { ql: cap, held: itemQl < scrollQl ? 'item' : 'scroll' };
}

/** The share of hits an enchantment at this quality does what it does. */
export const enchantHitChance = (e: EnchantmentDef, ql: number): number => Math.max(0, Math.min(QL_TOP, ql)) * e.perQl;

/** A quality as the log says one: to the tenth. The island's `to_char(.., 'FM990.0')`. */
export const qlWord = (ql: number): string => ql.toFixed(1);

/** What the name of a thing holding one carries: " (Firebrand)". */
export const enchantMarker = (e: Enchant | undefined | null): string =>
  (e && ENCHANTMENTS[e.id] ? ` (${ENCHANTMENTS[e.id].name})` : '');

/** Why a scroll will not go into this, or null; in the words both sides say. */
export const ENCHANT_SAID = {
  scroll: 'Choose an enchantment scroll.',
  weapon: 'Choose a melee weapon to enchant.',
  notMelee: 'Only a melee weapon takes an enchantment, not a bow or a thrown weapon.',
  broken: 'It is broken.',
} as const;
/** Why a thing that holds an enchantment already takes no other. */
export const alreadyEnchanted = (e: Enchant): string => `It already holds ${ENCHANTMENTS[e.id]?.name ?? e.id} at QL ${qlWord(e.ql)}.`;

/** A share as Examine says it: the island's `enchant_pct`. */
export const enchantPct = (x: number): string => percent(x);
