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
import type { Creature } from './creatures';
import { QL_BARE, QL_LOW, QL_SPAN, type Game } from './game';
import { describeWith, itemDef, itemName, type Item } from './items';
import { WEAPON_BY_ID, WEAPONS } from './gear';
import { CLASS_SPELLS } from './talents';
import { KNIFE_BLEED, KNIFE_BLEED_SECS, STUN_SECS } from './fight';
import { DAMAGE_MAX } from './limits';
import {
  alreadyEnchanted, ENCHANT_BREAK, ENCHANT_HARM, ENCHANT_SAID, ENCHANT_TIME, ENCHANT_WIND, ENCHANTING, ENCHANTMENT_LIST, ENCHANTMENTS,
  enchantChance, enchantHitChance, enchantPct, enchantQl, qlWord, scrollOf, type EnchantEffect, type EnchantHeld, type EnchantmentDef,
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
 * A Firebrand's burn is a Kindler's Scorch: the smallest burn the game starts,
 * a share of the creature's full health a second for a few seconds, through
 * the same rule (`Game.burn`, the island's `class_burn`), so a Kindler's
 * Lingering and Searing Burn and their Firebrand spell lengthen and deepen
 * it as they do every burn of theirs.
 */
const SCORCH = CLASS_SPELLS.find((s) => s.id === 'kindler_scorch');
export const ENCHANT_BURN = { each: SCORCH?.fx.each ?? 0, secs: SCORCH?.fx.secs ?? 0 };

/** What a hit does, as Examine's line begins it: "sets the target burning". */
export const EFFECT_HEAD: Record<EnchantEffect, string> = {
  burn: 'sets the target burning',
  bleed: 'opens a bleed on the target',
  stun: `stuns the target for ${STUN_SECS} seconds`,
};
/** And what that is, after it: the rule it borrows, in its numbers. */
export const EFFECT_TAIL: Record<EnchantEffect, string> = {
  burn: `A burn takes ${enchantPct(ENCHANT_BURN.each)} of its full health a second for ${ENCHANT_BURN.secs} seconds, never the last of it.`,
  bleed: `A bleed takes ${enchantPct(KNIFE_BLEED)} of the blow a second for ${KNIFE_BLEED_SECS} seconds, never the last of it, as a knife's does.`,
  stun: 'Stunned, it neither moves nor strikes; a stun on one already stunned starts again rather than adding to it.',
};
/** And what the log says when it does it, `{t}` the creature: "Your Firebrand sets the boar burning." */
export const EFFECT_SAID: Record<EnchantEffect, string> = {
  burn: 'sets the {t} burning.',
  bleed: 'opens the {t} up, and it bleeds.',
  stun: `stuns the {t} for ${STUN_SECS} seconds.`,
};

/** Examine's line for a thing holding an enchantment, or nothing. */
export function enchantSays(item: Pick<Item, 'enchant'>): string {
  const e = item.enchant && ENCHANTMENTS[item.enchant.id];
  if (!e || !item.enchant) return '';
  const ql = item.enchant.ql;
  return ` ${e.name} at QL ${qlWord(ql)}: a hit ${EFFECT_HEAD[e.effect]} ${enchantPct(enchantHitChance(e, ql))} of the time. ${EFFECT_TAIL[e.effect]}`;
}

// What each scroll says a hit does, off the rule it borrows.
describeWith({
  enchant: Object.fromEntries(ENCHANTMENT_LIST.map((e) => [e.id, {
    does: e.effect === 'burn' ? `sets what it lands on burning, ${enchantPct(ENCHANT_BURN.each)} of its full health a second for ${ENCHANT_BURN.secs} seconds, never the last of it,`
      : e.effect === 'bleed' ? `opens a bleed on what it lands on, ${enchantPct(KNIFE_BLEED)} of the blow a second for ${KNIFE_BLEED_SECS} seconds, never the last of it,`
        : `stuns what it lands on for ${STUN_SECS} seconds, in which it neither moves nor strikes,`,
  }])),
});

/** What the help lists as what an enchantment goes into. */
export const meleeNames = (): string => listed(MELEE_WEAPONS.map((id) => itemDef(id).name.toLowerCase()));

/* ---- the Enchant job ------------------------------------------------------ */

/** Why this scroll will not go into this weapon, or the three of them when it will. */
export function enchantSetting(g: Game, t: Target): { why: string } | { scroll: Item; weapon: Item; e: EnchantmentDef } {
  const scroll = t.kind === 'item' && t.scroll !== undefined ? g.inventory.get(t.scroll) : undefined;
  const e = scroll ? scrollOf(scroll.id) : undefined;
  if (!scroll || !e) return { why: ENCHANT_SAID.scroll };
  const weapon = t.kind === 'item' ? g.inventory.get(t.uid) : undefined;
  if (!weapon) return { why: ENCHANT_SAID.weapon };
  if (!isMelee(weapon.id)) return { why: ENCHANT_SAID.notMelee };
  if (weapon.dmg >= DAMAGE_MAX) return { why: ENCHANT_SAID.broken };
  if (weapon.enchant) return { why: alreadyEnchanted(weapon.enchant) };
  return { scroll, weapon, e };
}

/** What may take a scroll, of what is in the pack: every melee weapon. */
export const enchantable = (g: Game): Item[] => g.inventory.items.filter((it) => isMelee(it.id));

/** The spread every craft's quality is rolled with (`Game.productQl` with no tool), about a figure rather than a skill. */
export const craftSpread = (base: number, r: number): number => base * (QL_LOW + r * QL_SPAN) + QL_BARE;

/** What a go that took says: "Firebrand goes into the sword (iron) at QL 34.0, held to the sword's QL 34.0. The scroll is used up." */
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
 * The enchantment on what a hit that landed was struck with, when its roll
 * comes up this time, or null. Asked once a landed melee hit is done with,
 * of a creature still alive; the island's `enchant_hit` asks the same.
 */
export function enchantRoll(g: Game, item: Item | null | undefined, c: Creature): EnchantmentDef | null {
  const e = item?.enchant && ENCHANTMENTS[item.enchant.id];
  if (!e || !item?.enchant || c.health <= 0) return null;
  return g.rand() < enchantHitChance(e, item.enchant.ql) ? e : null;
}

/** "Your Concussion stuns the boar for 2 seconds." */
export const enchantHitSaid = (e: EnchantmentDef, creature: string): string =>
  `Your ${e.name} ${EFFECT_SAID[e.effect].replace('{t}', creature)}`;

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
