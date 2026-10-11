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
 * enchantment's quality held to the item's own as well as the scroll's. The
 * first was renamed Emberbrand afterwards, so that it is not mistaken for the
 * Kindler's Firebrand spell (`talents.ts`), which keeps the name.
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
 * What an enchantment does. The first five are what a hit that lands does to
 * the creature it lands on: now and then -- a burn as a Kindler's Scorch
 * starts one, a bleed as a knife opens one, a stun (`STUN_SECS`, `fight.ts`),
 * venom (`VENOM_DRAIN`) -- or every time, for `drain`, which puts its next
 * blow back. The rest are always so while the thing is in hand: a quicker
 * swing, more critical blows, more damage to hostile monsters, and a share of
 * every hit back as health (`leech`).
 */
export type EnchantEffect = 'burn' | 'bleed' | 'stun' | 'venom' | 'drain' | 'swing' | 'crit' | 'smite' | 'leech' | 'range' | 'flame' | 'frost'
  | 'guard' | 'fireguard' | 'stride' | 'thorns' | 'shadow' | 'block' | 'work' | 'temper' | 'bounty' | 'lode' | 'grace'
  | 'learn' | 'knack' | 'wind' | 'upkeep' | 'favour' | 'calm';
/** The ones that happen on a hit now and then, at `perQl` a point of quality: a hit's roll comes up or it does not. */
export const ROLLED_EFFECTS: ReadonlySet<EnchantEffect> = new Set(['burn', 'bleed', 'stun', 'venom']);
/** And the ones a bow's shot that lands sets off now and then, the same way: a burn, or a frost that slows. */
export const SHOT_EFFECTS: ReadonlySet<EnchantEffect> = new Set(['flame', 'frost']);

/** What an enchantment goes on: what the scroll may be put into, and what its refusal names. */
export type EnchantOn = 'melee' | 'bow' | 'armour' | 'boots' | 'chest' | 'shield' | 'tool' | 'reaper' | 'pick' | 'light' | 'ring' | 'amulet';
/** What the refusal calls each: "Emberbrand goes on a melee weapon, not a bow or a thrown weapon." */
export const ON_WORDS: Record<EnchantOn, string> = {
  melee: 'a melee weapon, not a bow or a thrown weapon',
  bow: 'a bow',
  armour: 'a piece of armour or clothing that is worn',
  boots: 'boots or shoes',
  // The game has no cloaks; what hangs over the body is the piece worn on the chest.
  chest: 'what is worn on the chest: a tunic, a jerkin, a hauberk, a breastplate or a cuirass',
  shield: 'a shield',
  // A weapon takes one of these only where a job is done with it (`FITS.tool`).
  tool: 'a tool that a job is done with',
  reaper: 'a sickle or a fishing rod',
  pick: 'a pickaxe',
  light: 'a lantern or a torch',
  ring: 'a jewelled ring',
  amulet: 'a jewelled pendant',
};
/**
 * The ones a worn piece holds, and the most all of that kind you wear can come
 * to together; each piece adds its share. Featherstep and Bulwark go on the
 * one slot there is for them, so their cap is the piece's own.
 */
export const WORN_CAP: Partial<Record<EnchantEffect, number>> = {};

export interface EnchantmentDef {
  id: string;
  /** What it is called, and what the name of a thing holding it carries: "Sword (Emberbrand)". */
  name: string;
  /** The scroll it is written on. */
  scroll: string;
  /** The first mote it is written with (`motes` has them all). */
  mote: string;
  /** Every mote it is written with, and how many of each: two of one element, or one each of two. */
  motes: ReadonlyArray<readonly [string, number]>;
  /** What it goes on. */
  on: EnchantOn;
  /** What it does. */
  effect: EnchantEffect;
  /**
   * How much, for each point of the enchantment's quality, up to `QL_TOP`: the
   * share of hits it works on for a rolled effect, and otherwise the share it
   * changes the number it changes by.
   */
  perQl: number;
}

/** Two motes of one element, `SCROLL_MOTES` of them, or one each of the elements named. */
const row = (id: string, name: string, elements: string | readonly string[], on: EnchantOn, effect: EnchantEffect, perQl: number): EnchantmentDef => {
  const motes: Array<readonly [string, number]> = typeof elements === 'string'
    ? [[`${elements}_mote`, SCROLL_MOTES]]
    : elements.map((el) => [`${el}_mote`, 1] as const);
  return { id, name, scroll: `${id}_scroll`, mote: motes[0][0], motes, on, effect, perQl };
};

/**
 * The share for each point of quality, as the owner asked for each: a quarter
 * of the quality as a percent is 0.0025, a tenth 0.001, a fifth 0.002, a
 * twentieth 0.0005.
 */
export const EMBERBRAND_PER_QL = 0.0025;
export const RAZOREDGE_PER_QL = 0.0025;
export const CONCUSSION_PER_QL = 0.001;
/** Venomfang: a hit poisons QL/4 percent of the time. */
export const VENOMFANG_PER_QL = 0.0025;
/** Gale: a swing takes QL/10 percent less time. */
export const GALE_PER_QL = 0.001;
/** Nightblade: QL/20 percentage points more chance of a critical blow. */
export const NIGHTBLADE_PER_QL = 0.0005;
/** Sunstrike: QL/4 percent more damage to a hostile monster. */
export const SUNSTRIKE_PER_QL = 0.0025;
/** Leeching: QL/10 percent of what every hit deals comes back as health. */
export const LEECHING_PER_QL = 0.001;
/** Tidecaller: every hit puts the creature's next blow back by QL/5 percent of the time between its blows. */
export const TIDECALLER_PER_QL = 0.002;
/** Farsight: a bow reaches QL/4 percent further. */
export const FARSIGHT_PER_QL = 0.0025;
/** Flamearrow: a shot that lands sets the target burning QL/5 percent of the time. */
export const FLAMEARROW_PER_QL = 0.002;
/** Frostbite: a shot that lands slows the target QL/5 percent of the time, */
export const FROSTBITE_PER_QL = 0.002;
/** to this share of its pace (30% slower), */
export const FROST_PACE = 0.7;
/** for this many seconds; another frost on one already slowed starts it again from then. */
export const FROST_SECS = 3;
/** Stoneskin: every blow that reaches you lands QL/20 percent lighter, for each piece, */
export const STONESKIN_PER_QL = 0.0005;
/** and all the Stoneskin you wear together never more than this. */
export const STONESKIN_CAP = 0.15;
/** Emberward: a burn's blow lands QL/5 percent lighter, for each piece, */
export const EMBERWARD_PER_QL = 0.002;
/** and never more than this together. */
export const EMBERWARD_CAP = 0.5;
/** Featherstep: you walk QL/20 percent faster. */
export const FEATHERSTEP_PER_QL = 0.0005;
/** Thornhide: what lands on you, QL/10 percent of it back on whatever struck, for each piece, */
export const THORNHIDE_PER_QL = 0.001;
/** and never more than this together. */
export const THORNHIDE_CAP = 0.25;
/** Shadowcloak: at night a hunter notices you from QL/4 percent closer. */
export const SHADOWCLOAK_PER_QL = 0.0025;
/** Bulwark: QL/10 percentage points on a shield's chance of a block. */
export const BULWARK_PER_QL = 0.001;
/** Swiftwork: a job done with the tool takes QL/5 percent less time. */
export const SWIFTWORK_PER_QL = 0.002;
/** Truesteel: the tool takes QL/2 percent less damage from use. */
export const TRUESTEEL_PER_QL = 0.005;
/** Bountiful: QL/5 percent of the goes at a harvest or a catch with it bring one more of what they bring. */
export const BOUNTIFUL_PER_QL = 0.002;
/** Lodestone: QL/10 percent of the goes at mining with it bring one more ore or stone. */
export const LODESTONE_PER_QL = 0.001;
/** Lantern's Grace: a candle set in it, or a torch struck, burns QL percent longer (twice as long at QL 100), */
export const GRACE_PER_QL = 0.01;
/** and it throws its light this many tiles further, at any quality. */
export const GRACE_TILES = 2;
/** Scholar's Band: QL/20 percent more skill from every go, on every trade. */
export const SCHOLARS_PER_QL = 0.0005;
/** Knackstone: the chance of a knack at a go is QL/2 percent greater (times 1 + QL/200, so half again at QL 100). */
export const KNACKSTONE_PER_QL = 0.005;
/** Steady Heart: your wind comes back QL/5 percent faster. */
export const STEADY_HEART_PER_QL = 0.002;
/** Hearthbound: hunger and thirst fall QL/5 percent slower. */
export const HEARTHBOUND_PER_QL = 0.002;
/** Favoured: QL/10 percent more favour from a prayer. */
export const FAVOURED_PER_QL = 0.001;
/** Stillwater: QL/10 percent more Calm banked from a sitting. */
export const STILLWATER_PER_QL = 0.001;
WORN_CAP.guard = STONESKIN_CAP;
WORN_CAP.fireguard = EMBERWARD_CAP;
WORN_CAP.thorns = THORNHIDE_CAP;

/**
 * Every enchantment there is. The first three are the owner's first asks; the
 * six after them go on a melee weapon too, the three after those on a bow,
 * the six after those on what you wear and the shield you hold, and the four
 * after those on the tools a job is done with, and the last on a light you carry.
 */
export const ENCHANTMENT_LIST: readonly EnchantmentDef[] = [
  row('emberbrand', 'Emberbrand', 'fire', 'melee', 'burn', EMBERBRAND_PER_QL),
  row('razoredge', 'Razoredge', 'ice', 'melee', 'bleed', RAZOREDGE_PER_QL),
  row('concussion', 'Concussion', 'earth', 'melee', 'stun', CONCUSSION_PER_QL),
  row('venomfang', 'Venomfang', 'life', 'melee', 'venom', VENOMFANG_PER_QL),
  row('gale', 'Gale', 'wind', 'melee', 'swing', GALE_PER_QL),
  row('nightblade', 'Nightblade', 'dark', 'melee', 'crit', NIGHTBLADE_PER_QL),
  row('sunstrike', 'Sunstrike', 'light', 'melee', 'smite', SUNSTRIKE_PER_QL),
  row('leeching', 'Leeching', ['life', 'dark'], 'melee', 'leech', LEECHING_PER_QL),
  row('tidecaller', 'Tidecaller', 'water', 'melee', 'drain', TIDECALLER_PER_QL),
  row('farsight', 'Farsight', 'wind', 'bow', 'range', FARSIGHT_PER_QL),
  row('flamearrow', 'Flamearrow', 'fire', 'bow', 'flame', FLAMEARROW_PER_QL),
  row('frostbite', 'Frostbite', 'ice', 'bow', 'frost', FROSTBITE_PER_QL),
  row('stoneskin', 'Stoneskin', 'earth', 'armour', 'guard', STONESKIN_PER_QL),
  row('emberward', 'Emberward', 'ice', 'armour', 'fireguard', EMBERWARD_PER_QL),
  row('featherstep', 'Featherstep', 'wind', 'boots', 'stride', FEATHERSTEP_PER_QL),
  row('thornhide', 'Thornhide', 'life', 'armour', 'thorns', THORNHIDE_PER_QL),
  row('shadowcloak', 'Shadowcloak', 'dark', 'chest', 'shadow', SHADOWCLOAK_PER_QL),
  row('bulwark', 'Bulwark', 'earth', 'shield', 'block', BULWARK_PER_QL),
  row('swiftwork', 'Swiftwork', 'wind', 'tool', 'work', SWIFTWORK_PER_QL),
  row('truesteel', 'Truesteel', 'earth', 'tool', 'temper', TRUESTEEL_PER_QL),
  row('bountiful', 'Bountiful', 'life', 'reaper', 'bounty', BOUNTIFUL_PER_QL),
  row('lodestone', 'Lodestone', 'earth', 'pick', 'lode', LODESTONE_PER_QL),
  row('lanterns_grace', 'Lantern\'s Grace', 'light', 'light', 'grace', GRACE_PER_QL),
  row('scholars_band', 'Scholar\'s Band', 'light', 'ring', 'learn', SCHOLARS_PER_QL),
  row('knackstone', 'Knackstone', ['light', 'life'], 'ring', 'knack', KNACKSTONE_PER_QL),
  row('steady_heart', 'Steady Heart', 'water', 'amulet', 'wind', STEADY_HEART_PER_QL),
  row('hearthbound', 'Hearthbound', 'earth', 'amulet', 'upkeep', HEARTHBOUND_PER_QL),
  row('favoured', 'Favoured', 'light', 'amulet', 'favour', FAVOURED_PER_QL),
  row('stillwater', 'Stillwater', 'water', 'amulet', 'calm', STILLWATER_PER_QL),
];
export const ENCHANTMENTS: Record<string, EnchantmentDef> = Object.fromEntries(ENCHANTMENT_LIST.map((e) => [e.id, e]));
export const EMBERBRAND = 'emberbrand';
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

/**
 * What an enchantment at this quality comes to: the share of hits it works on
 * for a rolled effect, and otherwise the share it changes its number by.
 */
export const enchantHitChance = (e: EnchantmentDef, ql: number): number => Math.max(0, Math.min(QL_TOP, ql)) * e.perQl;
/** The same, by its other name, for the ones that are not a roll. */
export const enchantValue = enchantHitChance;

/** A quality as the log says one: to the tenth. The island's `to_char(.., 'FM990.0')`. */
export const qlWord = (ql: number): string => ql.toFixed(1);

/** What the name of a thing holding one carries: " (Emberbrand)". */
export const enchantMarker = (e: Enchant | undefined | null): string =>
  (e && ENCHANTMENTS[e.id] ? ` (${ENCHANTMENTS[e.id].name})` : '');

/** Why a scroll will not go into this, or null; in the words both sides say. */
export const ENCHANT_SAID = {
  scroll: 'Choose an enchantment scroll.',
  weapon: 'Choose something in your pack to enchant.',
  broken: 'It is broken.',
} as const;
/** Why this scroll will not go into a thing of the wrong kind: "Featherstep goes on boots." */
export const wrongKind = (e: EnchantmentDef): string => `${e.name} goes on ${ON_WORDS[e.on]}.`;
/** Why a thing that holds an enchantment already takes no other. */
export const alreadyEnchanted = (e: Enchant): string => `It already holds ${ENCHANTMENTS[e.id]?.name ?? e.id} at QL ${qlWord(e.ql)}.`;

/**
 * What an enchantment on what you swing makes of the swing: the share of time
 * it takes off (Gale), the critical chance it adds (Nightblade), and the
 * damage it adds against a hostile monster (Sunstrike). Nothing for one that
 * does none of these. The island's `enchant_of`.
 */
export const swingEnchant = (item: { enchant?: Enchant } | null | undefined, effect: EnchantEffect): number => {
  const e = item?.enchant && ENCHANTMENTS[item.enchant.id];
  return e && item?.enchant && e.effect === effect ? enchantValue(e, item.enchant.ql) : 0;
};

/**
 * What every piece you wear and hold of one enchantment comes to together,
 * held to its cap where it has one (`WORN_CAP`). The island's `worn_enchant`.
 */
export const wornEnchant = (worn: ReadonlyArray<{ enchant?: Enchant } | null | undefined>, effect: EnchantEffect): number => {
  const sum = worn.reduce((n, it) => n + swingEnchant(it, effect), 0);
  const cap = WORN_CAP[effect];
  return cap === undefined ? sum : Math.min(cap, sum);
};

/** What a go that brings one more says: "Bountiful brings one more of the raspberries." The island's `enchant_more` says it. */
export const moreSaid = (e: EnchantmentDef, what: string): string => `${e.name} brings one more of the ${what}.`;

/**
 * A share as Examine says it: the island's `enchant_pct`, which rounds the
 * figure as it is written in decimals, a half up (20.65 is 20.7), where
 * `toFixed` would round what the float holds (20.6499..., so 20.6).
 */
export const enchantPct = (x: number): string => {
  const dec = (n: number): number => Number(n.toPrecision(12));
  const p = dec(x * 100);
  return Math.abs(p - Math.round(p)) < 1e-6 ? percent(x) : `${Math.round(dec(p * 10)) / 10}%`;
};
