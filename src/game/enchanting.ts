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
import { QL_BARE, QL_LOW, QL_SPAN, type Game } from './game';
import { describeWith, ITEM_DEFS, itemDef, itemName, type Item } from './items';
import { ARMOUR, ARMOUR_BY_ID, isArmour, isShield, SHIELDS, WEAPON_BY_ID, WEAPONS } from './gear';
import { CLASS_SPELLS } from './talents';
import { blowEvery, KNIFE_BLEED, KNIFE_BLEED_SECS, STUN_SECS, VENOM_DRAIN, VENOM_SECS } from './fight';
import { BLOW_SHARE, DAMAGE_MAX, QL_TOP } from './limits';
import { HELD_LIGHTS } from './light';
import {
  alreadyEnchanted, ENCHANT_BREAK, ENCHANT_HARM, ENCHANT_SAID, ENCHANT_TIME, ENCHANT_WIND, ENCHANTING, ENCHANTMENT_LIST, ENCHANTMENTS,
  enchantChance, enchantHitChance, enchantPct, enchantQl, EMBERWARD_CAP, enchantValue, FROST_PACE, FROST_SECS, GRACE_TILES, qlWord, STONESKIN_CAP, THORNHIDE_CAP, ROLLED_EFFECTS, scrollOf, SHOT_EFFECTS, wrongKind,
  type EnchantEffect, type EnchantHeld, type EnchantmentDef, type EnchantOn,
} from './enchant';
import { listed } from './words';

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

/** What a rolled hit does, as Examine's line begins it: "sets the target burning". */
export const EFFECT_HEAD: Partial<Record<EnchantEffect, string>> = {
  burn: 'sets the target burning',
  bleed: 'opens a bleed on the target',
  stun: `stuns the target for ${STUN_SECS} seconds`,
  venom: 'puts venom in the target',
};
/** And what that is, after it: the rule it borrows, in its numbers. */
export const EFFECT_TAIL: Partial<Record<EnchantEffect, string>> = {
  burn: `A burn takes ${enchantPct(ENCHANT_BURN.each)} of its full health a second for ${ENCHANT_BURN.secs} seconds, never the last of it.`,
  bleed: `A bleed takes ${enchantPct(KNIFE_BLEED)} of the blow a second for ${KNIFE_BLEED_SECS} seconds, never the last of it, as a knife's does.`,
  stun: 'Stunned, it neither moves nor strikes; a stun on one already stunned starts again rather than adding to it.',
  venom: `Venom takes ${enchantPct(VENOM_DRAIN)} of its full health a second for ${VENOM_SECS} seconds, never the last of it, as a venomous bite's does on you.`,
};
/** And what the log says when it does it, `{t}` the creature: "Your Emberbrand sets the boar burning." */
export const EFFECT_SAID: Partial<Record<EnchantEffect, string>> = {
  burn: 'sets the {t} burning.',
  bleed: 'opens the {t} up, and it bleeds.',
  stun: `stuns the {t} for ${STUN_SECS} seconds.`,
  venom: 'puts venom in the {t}.',
  flame: 'sets the {t} burning.',
  frost: `slows the {t} to ${enchantPct(FROST_PACE)} of its pace for ${FROST_SECS} seconds.`,
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
      return `a hit ${EFFECT_HEAD[e.effect]} {v} of the time. ${EFFECT_TAIL[e.effect]}`;
    case 'swing': return 'a swing with it takes {v} less time.';
    case 'crit': return '{v} more of its blows that land are critical: that much is added to your chance.';
    case 'smite': return 'a blow with it does {v} more damage to a hostile monster, one that cannot be tamed.';
    case 'leech':
      return `every hit with it that lands and leaves the creature standing gives you back {v} of the damage it deals as health, each point of it worth ${enchantPct(BLOW_SHARE)} of your health, as a creature's blow is.`;
    case 'drain':
      return 'every hit with it that lands puts the creature\'s next blow back by {v} of the time between its blows.';
    case 'range': return 'it reaches {v} further.';
    case 'flame': return `a shot from it that lands sets the target burning {v} of the time. ${EFFECT_TAIL.burn}`;
    case 'frost':
      return `a shot from it that lands slows the target to ${enchantPct(FROST_PACE)} of its pace for ${FROST_SECS} seconds {v} of the time; `
        + 'another on one already slowed starts it again rather than adding on.';
    case 'guard':
      return `while it is worn, every blow that reaches you lands {v} lighter; each piece with it adds its share, ${enchantPct(STONESKIN_CAP)} at most together.`;
    case 'fireguard':
      return `while it is worn, a burn that reaches you lands {v} lighter; each piece with it adds its share, ${enchantPct(EMBERWARD_CAP)} at most together.`;
    case 'stride': return 'while they are worn, you walk {v} faster.';
    case 'thorns':
      return 'while it is worn, a creature whose blow lands on you takes {v} of the damage it did you back, as a blow of yours of that size would hurt it; '
        + `each piece with it adds its share, ${enchantPct(THORNHIDE_CAP)} at most together.`;
    case 'shadow': return 'while it is worn, at night a hunting creature notices you from {v} closer.';
    case 'block': return '{v} is added to the shield\'s chance of turning a blow aside, past the most a shield otherwise blocks.';
    case 'work': return 'a job done with it takes {v} less time.';
    case 'temper': return 'it takes {v} less damage from use.';
    case 'bounty': return 'a bush harvested with a sickle, or a fish landed with a rod, brings one more {v} of the time.';
    case 'grace': return `a candle set in it, or the torch when it is struck, burns {v} longer, and it throws its light ${GRACE_TILES} tiles further.`;
    case 'learn': return 'while it is worn, every go at any trade teaches {v} more skill.';
    case 'knack': return 'while it is worn, the chance of a knack from a go is {v} greater.';
    case 'wind': return 'while it is worn, your stamina comes back {v} faster.';
    case 'upkeep': return 'while it is worn, hunger and thirst fall {v} slower.';
    case 'favour': return 'while it is worn, a prayer gives {v} more favour.';
    case 'calm': return 'while it is worn, a sitting banks {v} more Calm.';
    case 'lode': return 'a go at mining with it that brings out ore or stone brings one more {v} of the time.';
  }
}
/** That line with its figure at this quality. */
export const enchantLineAt = (e: EnchantmentDef, ql: number): string => enchantLine(e).replace('{v}', enchantPct(enchantValue(e, ql)));

/** Examine's line for a thing holding an enchantment, or nothing. */
export function enchantSays(item: Pick<Item, 'enchant'>): string {
  const e = item.enchant && ENCHANTMENTS[item.enchant.id];
  if (!e || !item.enchant) return '';
  return ` ${e.name} at QL ${qlWord(item.enchant.ql)}: ${enchantLineAt(e, item.enchant.ql)}`;
}

// What each scroll says it does: its line at the top of the scale, and in proportion below.
describeWith({
  enchant: Object.fromEntries(ENCHANTMENT_LIST.map((e) => [e.id, {
    does: `At QL ${QL_TOP}, ${enchantLineAt(e, QL_TOP)} In proportion below.`,
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
    case 'amulet': return id === 'jewelled_pendant';
  }
};
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
  amulet: ['jewelled_pendant'],
};

/* ---- the Enchant job ------------------------------------------------------ */

/** Why this scroll will not go into this weapon, or the three of them when it will. */
export function enchantSetting(g: Game, t: Target): { why: string } | { scroll: Item; weapon: Item; e: EnchantmentDef } {
  const scroll = t.kind === 'item' && t.scroll !== undefined ? g.inventory.get(t.scroll) : undefined;
  const e = scroll ? scrollOf(scroll.id) : undefined;
  if (!scroll || !e) return { why: ENCHANT_SAID.scroll };
  const weapon = t.kind === 'item' ? g.inventory.get(t.uid) : undefined;
  if (!weapon) return { why: ENCHANT_SAID.weapon };
  if (!fitsOn(e.on, weapon.id)) return { why: wrongKind(e) };
  if (weapon.dmg >= DAMAGE_MAX) return { why: ENCHANT_SAID.broken };
  if (weapon.enchant) return { why: alreadyEnchanted(weapon.enchant) };
  return { scroll, weapon, e };
}

/** What may take this scroll, of what is in the pack: everything of the kind it goes on. */
export const enchantable = (g: Game, e: EnchantmentDef): Item[] => g.inventory.items.filter((it) => fitsOn(e.on, it.id));

/** The spread every craft's quality is rolled with (`Game.productQl` with no tool), about a figure rather than a skill. */
export const craftSpread = (base: number, r: number): number => base * (QL_LOW + r * QL_SPAN) + QL_BARE;

/** What a go that took says: "Emberbrand goes into the sword (iron) at QL 34.0, held to the sword's QL 34.0. The scroll is used up." */
export function enchantedSaid(e: EnchantmentDef, name: string, kind: string, ql: number, held: EnchantHeld, scrollQl: number, itemQl: number): string {
  const by = held === 'item' ? `, held to the ${kind}'s QL ${qlWord(itemQl)}` : held === 'scroll' ? `, held to the scroll's QL ${qlWord(scrollQl)}` : '';
  return `${e.name} goes into the ${name} at QL ${qlWord(ql)}${by}. The scroll is used up.`;
}
/** What a go that did not take says: what happened to the weapon. */
export function notTakenSaid(e: EnchantmentDef, name: string, how: 'broke' | 'harm' | 'harmBroke', dmg: number): string {
  const head = `The ${e.name} scroll does not take`;
  if (how === 'broke') return `${head}, and the ${name} goes to pieces. The scroll is used up.`;
  if (how === 'harmBroke') return `${head}. The ${name} takes ${ENCHANT_HARM} damage and goes to pieces. The scroll is used up.`;
  return `${head}. The ${name} takes ${ENCHANT_HARM} damage and is at ${qlWord(dmg)}. The scroll is used up.`;
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
    applies: (t) => t.kind === 'item' && t.scroll !== undefined,
    check: (t, g) => {
      const s = enchantSetting(g, t);
      return 'why' in s ? s.why : null;
    },
    perform: (t, g) => {
      const s = enchantSetting(g, t);
      if ('why' in s) return;
      const { scroll, weapon, e } = s;
      const skill = g.skills.get(ENCHANTING);
      const name = itemName({ ...weapon, count: 1 }).toLowerCase();
      // Both rolls first, as the island takes them: whether it takes, then its quality or whether the weapon breaks.
      const r1 = g.rand();
      const r = g.rand();
      g.inventory.remove(scroll.uid, 1);
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

/** "Your Concussion stuns the boar for 2 seconds." Nothing for one that works every time, which would say so on every swing. */
export const enchantHitSaid = (e: EnchantmentDef, creature: string): string =>
  (EFFECT_SAID[e.effect] ? `Your ${e.name} ${EFFECT_SAID[e.effect]!.replace('{t}', creature)}` : '');

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
