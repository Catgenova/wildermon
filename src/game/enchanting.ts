/**
 * Enchanting, done: the Enchant job, what a hit with an enchanted weapon does,
 * and every sentence either says.
 *
 * The table and its numbers are `enchant.ts`, a leaf the item table reads.
 * This is the half that leans on the rest of the game: the weapons, the
 * Kindler's burn, the knife's bleed and the stun (`STUN_SECS`), and the
 * spread every craft's quality is rolled with.
 *
 * The island does the same (`enchant_*` and `perform_enchant` in the
 * migrations), off the same numbers crossed in the defs, and says the same
 * words; `supabase/test/enchant.ts` holds the two to each other.
 */
import type { ActionDef, Target } from './actions';
import { maxHealth, SPECIES, type Creature } from './creatures';
import { QL_BARE, QL_LOW, QL_SPAN, type Game, type PlacedEnchantable } from './game';
import { describeWith, ITEM_DEFS, itemDef, itemName, type Item } from './items';
import { FURNITURE } from './furniture';
import { CRATE_DEFS } from './crates';
import { CATCH_MOST, TRAPS } from './traps';
import { ARMOUR, ARMOUR_BY_ID, isArmour, isShield, SHIELDS, WEAPON_BY_ID, WEAPONS } from './gear';
import { CLASS_SPELLS } from './talents';
import { blowEvery, KNIFE_BLEED, KNIFE_BLEED_SECS, STUN_SECS, VENOM_DRAIN, VENOM_SECS } from './fight';
import { BLOW_SHARE, DAMAGE_MAX, PLACED_REACH, QL_TOP } from './limits';
import { HELD_LIGHTS } from './light';
import {
  alreadyEnchanted, ENCHANTERS_PLINTH, ENCHANT_BREAK, ENCHANT_HARM, ENCHANT_SAID, ENCHANT_TIME, ENCHANT_WIND, ENCHANTING, ENCHANTMENT_LIST, ENCHANTMENTS,
  enchantChance, enchantFigure, enchantHitChance, enchantPct, enchantQl, EMBERWARD_CAP, enchantValue, FROST_PACE, FROST_SECS, GRACE_TILES, qlWord, SECOND_FIGURE, STONESKIN_CAP, THORNHIDE_CAP, ROLLED_EFFECTS, scrollOf, SHOT_EFFECTS, wrongKind,
  type EnchantEffect, type EnchantHeld, type EnchantmentDef, type EnchantOn,
} from './enchant';
import { listed } from './words';
import { ENCHANT_HEAD, tryGain } from './learn';

/** The job: a scroll in the pack put into a melee weapon in the pack. The weapon is the target, the scroll `Target.scroll`. */
export const ENCHANT = 'enchant';

/** A weapon that is swung rather than shot or thrown. The island's `melee_weapon`, generated from this. */
export const isMelee = (id: string): boolean => {
  const w = WEAPON_BY_ID.get(id);
  return !!w && !w.ammo && !w.thrown;
};
/** Every melee weapon there is, for the help and the island. */
export const MELEE_WEAPONS: string[] = WEAPONS.filter((w) => isMelee(w.id)).map((w) => w.id);

/**
 * An Emberbrand's burn is a Kindler's Scorch: the smallest burn the game
 * starts, a share of the creature's full health a second for a few seconds,
 * through the same rule (`Game.burn`, the island's `class_burn`), so a
 * Kindler's Lingering and Searing Burn and their Firebrand spell lengthen and
 * deepen it as they do every burn of theirs.
 */
const SCORCH = CLASS_SPELLS.find((s) => s.id === 'kindler_scorch');
export const ENCHANT_BURN = { each: SCORCH?.fx.each ?? 0, secs: SCORCH?.fx.secs ?? 0 };
/** The Kindler's Firebrand spell (not this enchantment): while it holds, every burn its caster starts lasts `long` times as long. */
export const BRAND_SPELL = CLASS_SPELLS.find((s) => s.id === 'kindler_firebrand');

/** What a rolled hit does, as Examine's line begins it: "Burn on 30% of hits". */
export const EFFECT_HEAD: Partial<Record<EnchantEffect, string>> = {
  burn: 'Burn',
  bleed: 'Bleed',
  stun: `Stun (${STUN_SECS} s)`,
  venom: 'Venom',
};
/** And what that is, after it: the rule it borrows, in its numbers. */
export const EFFECT_TAIL: Partial<Record<EnchantEffect, string>> = {
  burn: `Burn: ${enchantPct(ENCHANT_BURN.each)} of max health per second for ${ENCHANT_BURN.secs} s, never the last of it.`,
  bleed: `Bleed: ${enchantPct(KNIFE_BLEED)} of the blow per second for ${KNIFE_BLEED_SECS} s, never the last of it (as a knife).`,
  stun: 'Stunned: no moving or striking; a new stun restarts it, does not add.',
  venom: `Venom: ${enchantPct(VENOM_DRAIN)} of max health per second for ${VENOM_SECS} s, never the last of it (as a venomous bite).`,
};
/** And what the log says when it does it, after "Emberbrand: ", `{t}` the creature: "Emberbrand: boar burning." */
export const EFFECT_SAID: Partial<Record<EnchantEffect, string>> = {
  burn: '{t} burning.',
  bleed: '{t} bleeding.',
  stun: `{t} stunned ${STUN_SECS} s.`,
  venom: '{t} envenomed.',
  flame: '{t} burning.',
  frost: `{t} slowed to ${enchantPct(FROST_PACE)} speed for ${FROST_SECS} s.`,
};

/** Every hostile monster, by name, for what Sunstrike is harder on. */
export const monsterNames = (): string => listed(Object.values(SPECIES).filter((d) => d.monster).map((d) => `${d.name.toLowerCase()}s`));

/**
 * What an enchantment does at a quality, as Examine says it after "Gale at QL
 * 40.0: ", with `{v}` where the figure goes -- the share of hits, or the
 * share its number changes by. The island's `enchant_line`, crossed in the
 * defs; `enchantSays` and `enchant_says` put the figure in.
 */
export function enchantLine(e: EnchantmentDef): string {
  switch (e.effect) {
    case 'burn': case 'bleed': case 'stun': case 'venom':
      return `${EFFECT_HEAD[e.effect]} on {v} of hits. ${EFFECT_TAIL[e.effect]}`;
    case 'swing': return 'Swing time \u2212{v}.';
    case 'crit': return 'Critical chance +{v} (added).';
    case 'smite': return 'Damage +{v} on hostile (untameable) monsters.';
    case 'leech':
      return `Health back: {v} of damage dealt, on hits that leave the target standing; each point ${enchantPct(BLOW_SHARE)} of your health, as a creature's blow.`;
    case 'drain':
      return 'Per hit: target\'s next blow delayed {v} of its attack interval.';
    case 'range': return 'Range +{v}.';
    case 'flame': return `Shot: burn on {v} of hits. ${EFFECT_TAIL.burn}`;
    case 'frost':
      return `Shot: slow to ${enchantPct(FROST_PACE)} speed for ${FROST_SECS} s on {v} of hits; a new slow restarts it, does not add.`;
    case 'guard':
      return `Worn: damage taken from blows \u2212{v}; pieces add, max ${enchantPct(STONESKIN_CAP)}.`;
    case 'fireguard':
      return `Worn: burn damage taken \u2212{v}; pieces add, max ${enchantPct(EMBERWARD_CAP)}.`;
    case 'stride': return 'Worn: walk speed +{v}.';
    case 'thorns':
      return 'Worn: an attacker that hits you takes {v} of the damage it dealt, as your blow would; '
        + `pieces add, max ${enchantPct(THORNHIDE_CAP)}.`;
    case 'shadow': return 'Worn: at night, creature notice range \u2212{v}.';
    case 'block': return 'Shield block chance +{v}, above the normal shield max.';
    case 'work': return 'Job time \u2212{v}.';
    case 'temper': return 'Damage from use \u2212{v}.';
    case 'bounty': return 'Sickle bush harvest or rod catch: one extra on {v} of goes.';
    case 'grace': return `Candle or struck torch burn time +{v}; light radius +${GRACE_TILES} tiles.`;
    case 'learn': return 'Worn: skill gain +{v}.';
    case 'knack': return 'Worn: knack chance per action +{v}.';
    case 'wind': return 'Worn: stamina regeneration +{v}.';
    case 'upkeep': return 'Worn: hunger and thirst rate \u2212{v}.';
    case 'favour': return 'Worn: favour per prayer +{v}.';
    case 'calm': return 'Worn: Calm per sitting +{v}.';
    case 'mule': return 'Carried: carry weight +{v}; each pack adds its own.';
    case 'swim': return 'Worn: swim speed +{v} (max walk speed), swimming stamina \u2212{v}.';
    case 'sight': return 'Worn: sight range +{v}.';
    case 'lode': return 'Mining ore or stone: one extra on {v} of goes.';
    case 'ember': return 'Fuel use \u2212{v}.';
    case 'master': return `QL of things made here +{v}, max QL ${QL_TOP}; the best within reach counts.`;
    case 'sail': return 'Sailing speed +{v}, on every point of sail.';
    case 'room': return 'Capacity +{v} (things or kg).';
    case 'bag': return 'Capacity +{v} (things, kg or litres); contents weigh the same.';
    case 'snare': return `Catch chance +{v}, max ${enchantPct(CATCH_MOST)}; creel fish chance +{v}.`;
    case 'mend': return 'Fish per drag +{v} on average; wear \u2212{w}.';
    case 'fleet': return 'Mount speed +{v}, after tack makers\' bonuses.';
    case 'tame': return 'In pack: tame chance per offering +{v}. On a mount: never breaks off a fight for distance.';
    case 'dream': return 'Rest banked per night +{v}; max banked rest +{v}.';
  }
}
/** That line with its figure at this quality. */
export const enchantLineAt = (e: EnchantmentDef, ql: number): string => enchantLine(e)
  .replaceAll('{v}', enchantFigure(e, enchantValue(e, ql)))
  .replaceAll('{w}', enchantPct(enchantValue(e, ql) * (SECOND_FIGURE[e.effect] ?? 0)));

/** Examine's line for a thing holding an enchantment, or nothing. */
export function enchantSays(item: Pick<Item, 'enchant'>): string {
  const e = item.enchant && ENCHANTMENTS[item.enchant.id];
  if (!e || !item.enchant) return '';
  return ` ${e.name} at QL ${qlWord(item.enchant.ql)}: ${enchantLineAt(e, item.enchant.ql)}`;
}

// What each scroll says it does: its line at the top of the scale, and in proportion below.
describeWith({
  enchant: Object.fromEntries(ENCHANTMENT_LIST.map((e) => [e.id, {
    does: `At QL ${QL_TOP}: ${enchantLineAt(e, QL_TOP)} Linear below.`,
  }])),
});

/** What the help lists as what an enchantment goes into. */
export const meleeNames = (): string => listed(MELEE_WEAPONS.map((id) => itemDef(id).name.toLowerCase()));

/** Whether a thing of this kind takes an enchantment that goes on this. The island's `enchant_fits`, generated from this. */
export const fitsOn = (on: EnchantOn, id: string): boolean => {
  switch (on) {
    case 'melee': return isMelee(id);
    case 'bow': return isBowId(id);
    case 'armour': return isArmour(id);
    case 'boots': return ARMOUR_BY_ID.get(id)?.slot === 'feet';
    case 'chest': return ARMOUR_BY_ID.get(id)?.slot === 'chest';
    case 'shield': return isShield(id);
    case 'tool': return jobTools().has(id);
    case 'reaper': return REAPERS.includes(id);
    case 'pick': return id === 'pickaxe';
    case 'light': return (HELD_LIGHTS as readonly string[]).includes(id);
    case 'ring': return id === 'jewelled_ring';
    case 'pack': return PACKS.includes(id);
    case 'head': return ARMOUR_BY_ID.get(id)?.slot === 'head';
    case 'amulet': return id === 'jewelled_pendant';
    case 'furnace': return FURNACES.includes(id);
    case 'station': return STATIONS.includes(id);
    case 'ship': return SHIPS().includes(id);
    case 'hull': return HULLS().includes(id);
    case 'cart': return CARTS().includes(id);
    case 'store': return STORES().includes(id);
    case 'trap': return id in TRAPS;
    case 'net': return id === 'fishing_net';
    case 'bed': return BEDS().includes(id);
    case 'saddle': return id === 'saddle';
    case 'bridle': return id === 'bridle';
  }
};
/** What Dreamweave goes on: every piece that is slept in. */
export const BEDS = (): string[] => FURNITURE.filter((f) => f.bed).map((f) => f.id);
/** What Ember Heart goes on, where it stands. */
export const FURNACES = ['smelter', 'kiln'];
/** What Masterwork goes on, where it stands: the two places a thing is made at that stand on the ground. */
export const STATIONS = ['anvil', 'loom'];
/** What Fair Wind goes on: the boats that carry a sail. */
export const SHIPS = (): string[] => FURNITURE.filter((f) => f.boat?.sail).map((f) => f.id);
/** What Deep Hold goes on: every boat. */
export const HULLS = (): string[] => FURNITURE.filter((f) => f.boat).map((f) => f.id);
/** What True Axle goes on: what is pulled on wheels. */
export const CARTS = (): string[] => FURNITURE.filter((f) => !f.boat && (f.vehicle || f.id === 'cart') && (f.capacity || f.heft)).map((f) => f.id);
/**
 * What Bag of Holding goes on: everything that holds things -- every piece
 * that keeps things, kilos or litres (`furnitureCapacity`, `furnitureHeft`,
 * `liquidCapacity`) but a hive and a pond, which fill themselves; the crates;
 * and every bag (`bagRoom`).
 */
export const STORES = (): string[] => [
  ...FURNITURE.filter((f) => (f.capacity || f.heft || f.liquid) && !f.hive && !f.pond && !f.well).map((f) => f.id),
  ...Object.values(CRATE_DEFS).map((c) => c.item),
  ...Object.entries(ITEM_DEFS).filter(([, d]) => d.holds).map(([id]) => id),
];
/** What Packmule goes on: the packs that are carried. */
export const PACKS = ['backpack', 'satchel'];
/** What Bountiful goes on: the tools a bush is harvested and a fish caught with. */
export const REAPERS = ['sickle', 'fishing_rod'];
/**
 * Every tool a job is done with: whatever any job names as its tool. The job
 * table is `actions.ts`'s, which loads after this and hands it over
 * (`knowJobs`); a value import of it here would load the two in a circle.
 */
let jobs: () => readonly ActionDef[] = () => [];
let toolSet: Set<string> | undefined;
export const knowJobs = (all: () => readonly ActionDef[]): void => { jobs = all; toolSet = undefined; };
export const jobTools = (): Set<string> =>
  (toolSet ??= new Set(jobs().flatMap((a) => (a.tool && ITEM_DEFS[a.tool] ? [a.tool] : [])).sort()));
/** A bow: a weapon that shoots, rather than one that is swung or thrown. */
export const isBowId = (id: string): boolean => !!WEAPON_BY_ID.get(id)?.ammo;
/** Every bow there is. */
export const BOWS: string[] = WEAPONS.filter((w) => isBowId(w.id)).map((w) => w.id);
/** Every item id each kind of enchantment goes on, for the help and the island. */
export const FITS: Record<EnchantOn, string[]> = {
  melee: MELEE_WEAPONS,
  bow: BOWS,
  armour: ARMOUR.map((a) => a.id),
  boots: ARMOUR.filter((a) => a.slot === 'feet').map((a) => a.id),
  chest: ARMOUR.filter((a) => a.slot === 'chest').map((a) => a.id),
  shield: Object.keys(SHIELDS),
  get tool() { return [...jobTools()]; },
  reaper: REAPERS,
  pick: ['pickaxe'],
  light: [...HELD_LIGHTS],
  ring: ['jewelled_ring'],
  pack: PACKS,
  head: ARMOUR.filter((a) => a.slot === 'head').map((a) => a.id),
  amulet: ['jewelled_pendant'],
  furnace: FURNACES,
  station: STATIONS,
  get ship() { return SHIPS(); },
  get hull() { return HULLS(); },
  get cart() { return CARTS(); },
  get store() { return STORES(); },
  get trap() { return Object.keys(TRAPS); },
  net: ['fishing_net'],
  get bed() { return BEDS(); },
  saddle: ['saddle'],
  bridle: ['bridle'],
};

/* ---- the Enchant job ------------------------------------------------------ */

/** The kinds of target a scroll can be aimed at: a thing in the pack, or a thing standing on the ground (`Game.placedFor`). */
const SCROLL_TARGETS: ReadonlySet<Target['kind']> = new Set(['item', 'furniture', 'smelter', 'kiln', 'anvil', 'trap', 'crate']);
const scrollUid = (t: Target): number | undefined => (SCROLL_TARGETS.has(t.kind) ? (t as { scroll?: number }).scroll : undefined);

/** What a scroll is going into: a thing in the pack, or a thing standing where it was set down. */
export type EnchantInto = { item: Item } | { placed: PlacedEnchantable };

/** Why this scroll will not go into this thing, or the three of them when it will. */
export function enchantSetting(g: Game, t: Target): { why: string } | { scroll: Item; into: EnchantInto; e: EnchantmentDef } {
  const uid = scrollUid(t);
  const scroll = uid !== undefined ? g.inventory.get(uid) : undefined;
  const e = scroll ? scrollOf(scroll.id) : undefined;
  if (!scroll || !e) return { why: ENCHANT_SAID.scroll };
  // Done standing at an enchanter's plinth, and nowhere else (`enchant.ts`).
  if (!g.atStation(ENCHANTERS_PLINTH)) return { why: ENCHANT_SAID.plinth };
  if (t.kind === 'item') {
    const weapon = g.inventory.get(t.uid);
    if (!weapon) return { why: ENCHANT_SAID.weapon };
    if (!fitsOn(e.on, weapon.id)) return { why: wrongKind(e) };
    if (weapon.dmg >= DAMAGE_MAX) return { why: ENCHANT_SAID.broken };
    if (weapon.enchant) return { why: alreadyEnchanted(weapon.enchant) };
    return { scroll, into: { item: weapon }, e };
  }
  // Something standing where it was set down: enchanted there, from within reach, if it is yours to use.
  const placed = g.placedFor(t);
  if (!placed) return { why: ENCHANT_SAID.gone };
  if (Math.hypot(placed.at[0] - g.player.x, placed.at[1] - g.player.y) > PLACED_REACH) return { why: ENCHANT_SAID.reach };
  const shut = placed.lock ? g.lockRefusal({ lock: placed.lock, x: placed.thing.x, y: placed.thing.y }) : null;
  if (shut) return { why: shut };
  if (!fitsOn(e.on, placed.def)) return { why: wrongKind(e) };
  if ((placed.thing.dmg ?? 0) >= DAMAGE_MAX) return { why: ENCHANT_SAID.broken };
  if (placed.thing.enchant) return { why: alreadyEnchanted(placed.thing.enchant) };
  return { scroll, into: { placed }, e };
}

/** What may take this scroll, of what is in the pack: everything of the kind it goes on. */
export const enchantable = (g: Game, e: EnchantmentDef): Item[] => g.inventory.items.filter((it) => fitsOn(e.on, it.id));

/** The spread every craft's quality is rolled with (`Game.productQl` with no tool), about a figure rather than a skill. */
export const craftSpread = (base: number, r: number): number => base * (QL_LOW + r * QL_SPAN) + QL_BARE;

/** What a go that took says: "Emberbrand goes into the sword (iron) at QL 34.0, held to the sword's QL 34.0. The scroll is used up." */
export function enchantedSaid(e: EnchantmentDef, name: string, kind: string, ql: number, held: EnchantHeld, scrollQl: number, itemQl: number): string {
  const by = held === 'item' ? ` (capped at ${kind} QL ${qlWord(itemQl)})` : held === 'scroll' ? ` (capped at scroll QL ${qlWord(scrollQl)})` : '';
  return `Enchanted: ${name}, ${e.name} QL ${qlWord(ql)}${by}. Scroll used.`;
}
/**
 * What a go that did not take on a thing standing where it was set down says.
 * It takes the scroll's harm, but no more than leaves it whole: a placed thing
 * never goes to pieces from a scroll (`ENCHANT_SAID.standing`).
 */
export function placedNotTakenSaid(e: EnchantmentDef, name: string, harm: number, dmg: number): string {
  return `${e.name} failed: ${name} +${qlWord(harm)} damage (now ${qlWord(dmg)}). Scroll used.`;
}
/** The damage a scroll that did not take leaves on a placed thing: its harm, held short of broken. */
export const placedHarm = (dmg: number): number => Math.min(DAMAGE_MAX - 1, dmg + ENCHANT_HARM);
/** What a go that did not take says: what happened to the weapon. */
export function notTakenSaid(e: EnchantmentDef, name: string, how: 'broke' | 'harm' | 'harmBroke', dmg: number): string {
  const head = `${e.name} failed: ${name}`;
  if (how === 'broke') return `${head} destroyed. Scroll used.`;
  if (how === 'harmBroke') return `${head} +${ENCHANT_HARM} damage, destroyed. Scroll used.`;
  return `${head} +${ENCHANT_HARM} damage (now ${qlWord(dmg)}). Scroll used.`;
}

function lose(g: Game, item: Item): void {
  g.inventory.remove(item.uid, item.count);
  for (const [slot, uid] of Object.entries(g.player.equipped)) if (uid === item.uid) g.player.equipped[slot] = null;
}

export const ENCHANT_ACTIONS: ActionDef[] = [
  {
    id: ENCHANT,
    label: 'Enchant',
    verb: 'enchanting',
    skill: ENCHANTING,
    hidden: true,
    stamina: ENCHANT_WIND,
    baseTime: ENCHANT_TIME,
    applies: (t) => scrollUid(t) !== undefined,
    check: (t, g) => {
      const s = enchantSetting(g, t);
      return 'why' in s ? s.why : null;
    },
    perform: (t, g) => {
      const s = enchantSetting(g, t);
      if ('why' in s) return;
      const { scroll, into, e } = s;
      const skill = g.skills.get(ENCHANTING);
      // Both rolls first, as the island takes them: whether it takes, then its quality or whether the weapon breaks.
      const r1 = g.rand();
      const r = g.rand();
      g.inventory.remove(scroll.uid, 1);
      // Head work as well as the trade's, into whatever it was set, taken or not (`ENCHANT_HEAD`).
      g.gainSkill('mind_logic', tryGain(r1 < enchantChance(skill, scroll.ql), ENCHANT_HEAD));
      if ('placed' in into) {
        const { thing, def, name } = into.placed;
        const said = name.toLowerCase();
        if (r1 < enchantChance(skill, scroll.ql)) {
          const { ql, held } = enchantQl(skill, scroll.ql, thing.ql, (base) => craftSpread(base, r));
          thing.enchant = { id: e.id, ql };
          g.logMsg(enchantedSaid(e, said, itemDef(def).name.toLowerCase(), ql, held, scroll.ql, thing.ql), 'event');
        } else {
          g.missed();
          const was = thing.dmg ?? 0;
          thing.dmg = placedHarm(was);
          g.logMsg(placedNotTakenSaid(e, said, thing.dmg - was, thing.dmg), 'error');
        }
        g.events.emit('world', Math.floor(into.placed.at[0]), Math.floor(into.placed.at[1]));
        g.events.emit('inventory');
        return;
      }
      const weapon = into.item;
      const name = itemName({ ...weapon, count: 1 }).toLowerCase();
      if (r1 < enchantChance(skill, scroll.ql)) {
        const { ql, held } = enchantQl(skill, scroll.ql, weapon.ql, (base) => craftSpread(base, r));
        weapon.enchant = { id: e.id, ql };
        g.logMsg(enchantedSaid(e, name, itemDef(weapon.id).name.toLowerCase(), ql, held, scroll.ql, weapon.ql), 'event');
      } else {
        g.missed();
        if (r < ENCHANT_BREAK) {
          lose(g, weapon);
          g.logMsg(notTakenSaid(e, name, 'broke', DAMAGE_MAX), 'error');
        } else {
          weapon.dmg = Math.min(DAMAGE_MAX, weapon.dmg + ENCHANT_HARM);
          if (weapon.dmg >= DAMAGE_MAX) {
            lose(g, weapon);
            g.logMsg(notTakenSaid(e, name, 'harmBroke', DAMAGE_MAX), 'error');
          } else {
            g.logMsg(notTakenSaid(e, name, 'harm', weapon.dmg), 'error');
          }
        }
      }
      g.events.emit('inventory');
    },
  },
];

/* ---- a hit ---------------------------------------------------------------- */

/**
 * The enchantment on what a hit that landed was struck with, when it works
 * this time, or null: a rolled one when its roll comes up, and Leeching and
 * Tidecaller every time. Asked once a landed melee hit is done with, of a
 * creature still alive; the island's `enchant_hit` asks the same. A rolled
 * one takes a roll and the others none, on both sides.
 */
export function enchantRoll(g: Game, item: Item | null | undefined, c: Creature): EnchantmentDef | null {
  const e = item?.enchant && ENCHANTMENTS[item.enchant.id];
  if (!e || !item?.enchant || c.health <= 0) return null;
  if (e.effect === 'leech' || e.effect === 'drain') return e;
  if (!ROLLED_EFFECTS.has(e.effect)) return null;
  return g.rand() < enchantHitChance(e, item.enchant.ql) ? e : null;
}

/** "Concussion: boar stunned 2 s." Nothing for one that works every time, which would say so on every swing. */
export const enchantHitSaid = (e: EnchantmentDef, creature: string): string =>
  (EFFECT_SAID[e.effect] ? `${e.name}: ${EFFECT_SAID[e.effect]!.replace('{t}', creature)}` : '');

/**
 * Venom in a creature, as the island's `enchant_venom`: a bleed of
 * `VENOM_DRAIN` of its full health a second for `VENOM_SECS`, the stronger of
 * it and any bleed already running, to the later end, never the last of its
 * health. A creature has no wounds to hold venom as you do; its bleed is the
 * one hurt that runs on in it, so that is where it goes.
 */
export function venom(g: Game, c: Creature): void {
  if (c.health <= 0) return;
  const rate = maxHealth(c, SPECIES[c.species]) * VENOM_DRAIN;
  const running = c.bleedUntil > g.time;
  c.bleedRate = running ? Math.max(c.bleedRate, rate) : rate;
  if (!running) c.bleedFrom = g.time;
  c.bleedUntil = Math.max(running ? c.bleedUntil : 0, g.time + VENOM_SECS);
}

/** Leeching: this much of what a hit dealt back as your health, at what a creature's blow of that size takes (`BLOW_SHARE`). The island's `enchant_leech`. */
export const leechHeal = (e: EnchantmentDef, ql: number, dealt: number): number => Math.max(0, dealt) * enchantValue(e, ql) * BLOW_SHARE;
/** Tidecaller: how many seconds its next blow is put back, a share of the time between its blows. The island's `enchant_drain`. */
export const drainSecs = (e: EnchantmentDef, ql: number, c: Creature): number => blowEvery(SPECIES[c.species]) * enchantValue(e, ql);

/**
 * What an enchantment that works does, once a landed hit of `dealt` is done
 * with. The burn, the bleed and the stun are the swing's own (`Game.burn`,
 * `sideBlow`, `stun`), handed in, as the island's `enchant_hit` calls its own.
 */
export function enchantWorks(g: Game, e: EnchantmentDef, ql: number, c: Creature, dealt: number,
  own: { burn: () => void; bleed: () => void }): void {
  switch (e.effect) {
    case 'burn': own.burn(); break;
    case 'bleed': own.bleed(); break;
    case 'stun': stun(g, c); break;
    case 'venom': venom(g, c); break;
    case 'leech': g.player.stats.health = Math.min(1, g.player.stats.health + leechHeal(e, ql, dealt)); break;
    case 'drain': c.cooldown = Math.max(0, c.cooldown) + drainSecs(e, ql, c); break;
    case 'flame': own.burn(); break;
    case 'frost': frost(g, c); break;
    default: break;
  }
  const said = enchantHitSaid(e, SPECIES[c.species]?.name.toLowerCase() ?? 'thing');
  if (said) g.logMsg(said, 'fight');
}


/**
 * The enchantment on the bow a shot that landed came from, when its roll comes
 * up this time, or null: Flamearrow and Frostbite. Asked once a landed shot is
 * done with, of a creature still alive; the island's `enchant_shot` asks the
 * same, one roll each side.
 */
export function shotRoll(g: Game, bow: Item | null | undefined, c: Creature): EnchantmentDef | null {
  const e = bow?.enchant && ENCHANTMENTS[bow.enchant.id];
  if (!e || !bow?.enchant || c.health <= 0 || !SHOT_EFFECTS.has(e.effect)) return null;
  return g.rand() < enchantHitChance(e, bow.enchant.ql) ? e : null;
}

/**
 * A frost: for `FROST_SECS` from now it goes at `FROST_PACE` of its pace; on
 * one already slowed it runs from now rather than adding on. The island's
 * `enchant_frost`, which keeps it in the creature's `slow` and `slow_until`.
 */
export function frost(g: Game, c: Creature): void {
  if (c.health <= 0) return;
  // The stronger of it and any slow already holding, to the later end, as `enchant_frost` keeps it.
  const running = (c.slowUntil ?? 0) > g.time;
  c.slowPace = running ? Math.min(c.slowPace ?? 1, FROST_PACE) : FROST_PACE;
  c.slowUntil = Math.max(running ? c.slowUntil ?? 0 : 0, g.time + FROST_SECS);
}
/** Whether it is slowed now. */
export const slowed = (g: Game, c: Creature): boolean => (c.slowUntil ?? 0) > g.time;

/**
 * A stun: for `STUN_SECS` from now it neither moves nor strikes, and a heavy
 * blow it was drawing back for is lost. On one already stunned it starts
 * again from now rather than adding on. The island's `enchant_stun`.
 */
export function stun(g: Game, c: Creature): void {
  if (c.health <= 0) return;
  c.stunUntil = Math.max(c.stunUntil ?? 0, g.time + STUN_SECS);
  c.windup = 0;
  c.moving = false;
}
/** Whether it is stunned now. */
export const stunned = (g: Game, c: Creature): boolean => (c.stunUntil ?? 0) > g.time;
