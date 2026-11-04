import type { ActionDef, Target } from './actions';
import { CROP_LIST } from './farming';
import type { Game } from './game';
import { describeWith, itemDef, itemName, NOT_RESTORED, STAMP_GOES_NAMED, unmendable, unmendableSays, unrestored, type Item } from './items';
import { SKILL_BY_ID } from './skills';
import { ENCHANT_TIME, ENCHANT_WIND, ENCHANTING } from './enchant';
import { MOTE_ELEMENTS, moteItem, motesWord, STATUE_MOTES, type MoteElement } from './motes';
import { PATRON_BY_ID, patronStatue, STATUETTE, statueName, type PatronDef } from './patronlist';
import { listed } from './words';

/**
 * Four relics put back together out of the ground and used on you and your
 * things, rather than on a wildermon (`creatureActions.ts` has the collar and
 * the bridle): an ancient whetstone takes all the damage off a tool or weapon
 * and none of its quality, an ancient seed jar opens to seeds, an ancient
 * stamp doubles the chance of a rare result on the crafts and forgings it is
 * carried through, and a rune tablet puts a point into a skill of your
 * choosing below `TABLET_BELOW`. Asked for: "Old collar, old bridle, seed jar,
 * old whetstone, makers stamp, rune tablet". The island's `relic_use_*`.
 */

/** Seeds an ancient seed jar opens to, of one crop, at the jar's QL. The island's `jar_seeds`. */
export const JAR_SEEDS = 5;
/** Crafts and forgings an ancient stamp is good for before it is gone. The island's `stamp_goes`. */
export const STAMP_GOES = STAMP_GOES_NAMED;
/** What a carried stamp does to the chance of the first step of rarity on each. The island's `stamp_rare`. */
export const STAMP_RARE = 2;
/** What a rune tablet puts into the skill it is read into. The island's `tablet_gain`. */
export const TABLET_GAIN = 1;
/** A skill at or over this takes nothing from a rune tablet. The island's `tablet_below`. */
export const TABLET_BELOW = 50;

export const WHETSTONE = 'ancient_whetstone';
export const SEED_JAR = 'ancient_seed_jar';
export const STAMP = 'ancient_stamp';
export const TABLET = 'rune_tablet';

/** The goes a stamp has left: a fresh one carries none written on it, and is good for all of them. */
export const stampGoes = (it: Pick<Item, 'charges'>): number => Math.max(0, it.charges ?? STAMP_GOES);

/** The stamp a craft or a forging is pressed with: the first one carried with a go left in it. */
export const stampCarried = (g: Game): Item | undefined =>
  g.inventory.items.find((it) => it.id === STAMP && stampGoes(it) > 0);

/**
 * A craft or a forging with a stamp carried: the first step of rarity at
 * `STAMP_RARE` its odds, and a go off the stamp, which is gone after its last.
 * Hands back the first step's odds, as they come in when there is none.
 */
export function pressStamp(g: Game, first: number): number {
  const stamp = stampCarried(g);
  if (!stamp) return first;
  const left = stampGoes(stamp) - 1;
  if (left <= 0) {
    g.inventory.remove(stamp.uid, 1);
    g.logMsg(`Ancient stamp: rare chance ×${STAMP_RARE}. Last go; stamp used up.`, 'event');
  } else {
    stamp.charges = left;
    g.logMsg(`Ancient stamp: rare chance ×${STAMP_RARE}. ${left} of ${STAMP_GOES} goes left.`, 'event');
  }
  g.events.emit('inventory');
  return Math.min(1, first * STAMP_RARE);
}

type ItemTarget = Extract<Target, { kind: 'item' }>;
const held = (g: Game, t: Target): Item | undefined => (t.kind === 'item' ? g.inventory.get(t.uid) : undefined);

/** Why a whetstone will not hone this, or null. The island's `relic_use_refusal`, word for word. */
export function honeRefusal(g: Game, t: Target): string | null {
  const it = held(g, t);
  if (!it) return 'It is gone.';
  if (!g.inventory.find(WHETSTONE)) return 'Need an ancient whetstone.';
  if (unrestored(it)) return NOT_RESTORED;
  // Nor restored gear, which nothing repairs (`unmendable`).
  if (unmendable(it)) return unmendableSays(it);
  if (it.dmg <= 0) return 'Not damaged.';
  return null;
}

/** Why a rune tablet will not go into this skill, or null. The island's `relic_use_refusal`, word for word. */
export function tabletRefusal(g: Game, t: Target): string | null {
  const it = held(g, t);
  if (!it || it.id !== TABLET) return 'It is gone.';
  const skill = t.kind === 'item' ? t.skill : undefined;
  const def = skill ? SKILL_BY_ID.get(skill) : undefined;
  if (!skill || !def) return 'Choose a skill in the Skills window.';
  if (g.skills.standing(skill) >= TABLET_BELOW) return `${def.name}: ${TABLET_BELOW} or over, nothing to learn.`;
  return null;
}

/**
 * A restored statuette enchanted into a patron's statue: `STATUE_MOTES` of
 * every element's mote, all used up, the statuette made the statue of the
 * patron chosen (one option for each, anybody any of them), its QL, damage and
 * rarity as they were. Done anywhere, with enchanting, as a job: never fails.
 * Asked for: "The restored statue can be Enchanted using one of each mote to
 * be statue of x diety". The island's `enchant_statue`.
 */
export const ENCHANT_STATUE = 'enchant_statue';
/** Why one will not be made, in the words both sides say. */
export const STATUE_SAID = {
  gone: 'It is gone.',
  statuette: `Restored ${itemDef(STATUETTE).name.toLowerCase()}s only.`,
  patron: 'Choose a patron.',
} as const;
/** The elements short of `STATUE_MOTES` in the pack, in `MOTE_ELEMENTS` order. */
export const statueShort = (g: Game): MoteElement[] => MOTE_ELEMENTS.filter((e) => g.inventory.count(moteItem(e)) < STATUE_MOTES);
/** Why, when motes are short: "Need 1 dark mote and 1 light mote." The island's `relic_use_refusal`, word for word. */
export const statueMotesNeed = (short: readonly MoteElement[]): string => `Need ${listed(short.map((e) => motesWord(STATUE_MOTES, e)))}.`;
/** Every mote a statue takes, all elements together. */
export const STATUE_MOTES_ALL = STATUE_MOTES * MOTE_ELEMENTS.length;
/** What making one says: "Enchanted: Statue of Chaos, QL 40.0. 8 motes used up." */
export const statueMadeSays = (p: PatronDef, ql: number): string =>
  `Enchanted: ${statueName(p)}, QL ${ql.toFixed(1)}. ${STATUE_MOTES_ALL} motes used up.`;

/** Why this statuette will not be made into this patron's statue now, or null. The island's `relic_use_refusal`, word for word. */
export function statueEnchantRefusal(g: Game, t: Target): string | null {
  const it = held(g, t);
  if (!it) return STATUE_SAID.gone;
  if (it.id !== STATUETTE) return STATUE_SAID.statuette;
  const p = t.kind === 'item' && t.patron ? PATRON_BY_ID.get(t.patron) : undefined;
  if (!p) return STATUE_SAID.patron;
  const short = statueShort(g);
  if (short.length) return statueMotesNeed(short);
  return null;
}

// The numbers the four describe themselves with, from the rules above.
describeWith({
  relicUse: {
    jarSeeds: JAR_SEEDS,
    crops: CROP_LIST.length,
    stampGoes: STAMP_GOES,
    stampRare: STAMP_RARE,
    tabletGain: TABLET_GAIN.toFixed(1),
    tabletBelow: TABLET_BELOW,
  },
});

export const RELIC_USE_ACTIONS: ActionDef[] = [
  {
    id: 'hone_whetstone',
    label: 'Hone with ancient whetstone',
    verb: 'honing',
    stamina: 0.01,
    baseTime: 3,
    applies: (t, g) => {
      const it = held(g, t);
      return !!it && it.id !== WHETSTONE && it.dmg > 0 && !unrestored(it) && !unmendable(it) && !!g.inventory.find(WHETSTONE);
    },
    check: (t, g) => honeRefusal(g, t),
    perform: (t, g) => {
      if (honeRefusal(g, t)) return;
      const it = held(g, t);
      const stone = g.inventory.find(WHETSTONE);
      if (!it || !stone || !g.inventory.remove(stone.uid, 1)) return;
      it.dmg = 0;
      g.events.emit('inventory');
      g.logMsg(`Honed: ${itemName(it).toLowerCase()}, all damage off, QL ${it.ql.toFixed(1)}. Whetstone used up.`, 'event');
    },
  },
  {
    id: 'open_seed_jar',
    label: 'Open',
    verb: 'opening the jar',
    stamina: 0.01,
    baseTime: 2,
    applies: (t, g) => held(g, t)?.id === SEED_JAR,
    check: (t, g) => (held(g, t)?.id === SEED_JAR ? null : 'It is gone.'),
    perform: (t, g) => {
      const jar = held(g, t);
      if (!jar || jar.id !== SEED_JAR) return;
      const crop = CROP_LIST[Math.floor(g.rand() * CROP_LIST.length)];
      const ql = jar.ql;
      if (!g.inventory.remove(jar.uid, 1)) return;
      g.inventory.add(crop.seed, { count: JAR_SEEDS, ql });
      g.events.emit('inventory');
      g.logMsg(`Seed jar opened: ${JAR_SEEDS} × ${itemDef(crop.seed).name.toLowerCase()}, QL ${ql.toFixed(1)}.`, 'event');
    },
  },
  {
    // Chosen in the Skills window, which puts the skill on the target (`skills.ts` in the panels).
    id: 'read_rune_tablet',
    label: 'Read the rune tablet',
    verb: 'reading the tablet',
    hidden: true,
    stamina: 0.01,
    baseTime: 5,
    applies: (t, g) => held(g, t)?.id === TABLET && (t as ItemTarget).skill !== undefined,
    check: (t, g) => tabletRefusal(g, t),
    perform: (t, g) => {
      if (tabletRefusal(g, t) || t.kind !== 'item' || !t.skill) return;
      const tablet = held(g, t);
      if (!tablet || !g.inventory.remove(tablet.uid, 1)) return;
      const now = g.skills.standing(t.skill) + TABLET_GAIN;
      g.skills.values.set(t.skill, now);
      g.events.emit('inventory');
      g.logMsg(`Rune tablet read: ${SKILL_BY_ID.get(t.skill)?.name} ${now.toFixed(4)} (+${TABLET_GAIN.toFixed(1)}). Tablet used up.`, 'skill');
    },
  },
  {
    // Chosen on the statuette's own menu, one option for each patron, which puts the patron on the target (`inventory.ts`).
    id: ENCHANT_STATUE,
    label: 'Enchant',
    labelFor: (t) => {
      const p = t.kind === 'item' && t.patron ? PATRON_BY_ID.get(t.patron) : undefined;
      return p ? `Enchant: ${statueName(p)}` : 'Enchant';
    },
    verb: 'enchanting',
    hidden: true,
    skill: ENCHANTING,
    stamina: ENCHANT_WIND,
    baseTime: ENCHANT_TIME,
    applies: (t, g) => held(g, t)?.id === STATUETTE && (t as ItemTarget).patron !== undefined,
    check: (t, g) => statueEnchantRefusal(g, t),
    perform: (t, g) => {
      if (statueEnchantRefusal(g, t) || t.kind !== 'item' || !t.patron) return;
      const it = held(g, t);
      const p = PATRON_BY_ID.get(t.patron);
      if (!it || !p) return;
      for (const e of MOTE_ELEMENTS) g.inventory.consume(moteItem(e), STATUE_MOTES);
      it.id = patronStatue(p.id);
      g.events.emit('inventory');
      g.logMsg(statueMadeSays(p, it.ql), 'event');
    },
  },
];
