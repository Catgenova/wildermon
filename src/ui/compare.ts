import type { Game } from '../game/game';
import { ARMOUR_BY_ID, ARMOUR_CLASSES, hitChance, pieceBurden, pieceSoak, SHIELDS, SLOT_NAMES, slotOf, WEAPON_BY_ID, weaponDamage } from '../game/gear';
import { blockChance } from '../game/fight';
import { swingEnchant } from '../game/enchant';
import { itemName, itemWeight, type Item } from '../game/items';
import { percent } from '../game/words';

/**
 * A weapon, a piece of armour or a shield set against what you have on in its
 * place: "Damage 6.2 (+1.4)". Asked for as "compare tooltips": the numbers
 * that decide a fight were nowhere but the help's formulas, so choosing
 * between two swords meant wearing each and watching.
 *
 * Each number is the rule's own, in your hands today -- `weaponDamage`,
 * `hitChance`, `pieceSoak` with your armour skill, `blockChance` with your
 * shield skill -- so the card says what the fight would do, not what the
 * thing is labelled.
 */

interface Stat {
  label: string;
  /** The number, and how it reads. */
  value: number;
  say: (v: number) => string;
  /** How a difference reads, signed. */
  diff: (d: number) => string;
  /** Whether more of it is better, to call a difference better or worse. */
  more: boolean;
}

const signed = (d: number, fixed: number, unit = ''): string => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d).toFixed(fixed)}${unit}`;
const points = (d: number): string => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(Math.round(d * 100))} points`;

function statsOf(g: Game, item: Item): Stat[] | null {
  const weapon = WEAPON_BY_ID.get(item.id);
  if (weapon) {
    const swing = weapon.swing * (weapon.twoHanded ? g.perk('swing:two_handed', 1) : 1) * (1 - swingEnchant(item, 'swing'));
    return [
      { label: 'Damage a blow', value: weaponDamage(g, weapon, item), say: (v) => v.toFixed(1), diff: (d) => signed(d, 1), more: true },
      { label: weapon.ammo ? 'A shot every' : 'A swing every', value: swing, say: (v) => `${v.toFixed(2)} s`, diff: (d) => signed(d, 2, ' s'), more: false },
      { label: 'Lands', value: hitChance(g, weapon, item), say: (v) => `${percent(v)} of ${weapon.ammo ? 'shots' : 'swings'}`, diff: points, more: true },
    ];
  }
  const armour = ARMOUR_BY_ID.get(item.id);
  if (armour) {
    const skill = g.skills.get(ARMOUR_CLASSES[armour.cls].skill);
    return [
      { label: 'Turns aside', value: pieceSoak(armour, item, skill), say: (v) => `${percent(v)} of a blow there`, diff: points, more: true },
      { label: 'Slows you by', value: pieceBurden(armour, item), say: (v) => percent(v), diff: points, more: false },
      { label: 'Weighs', value: itemWeight(item), say: (v) => `${v.toFixed(1)} kg`, diff: (d) => signed(d, 1, ' kg'), more: false },
    ];
  }
  const shield = SHIELDS[item.id];
  if (shield) {
    const perk = (k: string, d: number): number => g.perk(k, d);
    return [
      { label: 'Blocks', value: blockChance(shield.block, item.ql, g.skills.get('shields'), perk), say: (v) => `${percent(v)} of blows`, diff: points, more: true },
      { label: 'Slows you by', value: shield.burden, say: (v) => percent(v), diff: points, more: false },
    ];
  }
  return null;
}

/**
 * The card's lines, or null for a thing that is not worn to fight in. The first
 * line is the name; the rest are its numbers, each with the difference from
 * what is on you in that place when something is.
 */
export function compareLines(g: Game, item: Item): string[] | null {
  const mine = statsOf(g, item);
  const slot = slotOf(item.id);
  if (!mine || !slot) return null;
  const on = g.worn(slot);
  const same = on?.uid === item.uid;
  const theirs = on && !same ? statsOf(g, on) : null;
  const lines = [`${itemName(item)} · QL ${item.ql.toFixed(1)}`];
  mine.forEach((s, i) => {
    const o = theirs?.[i];
    if (!o || o.label !== s.label) {
      lines.push(`${s.label} ${s.say(s.value)}`);
      return;
    }
    const d = s.value - o.value;
    if (Math.abs(d) < 1e-6) {
      lines.push(`${s.label} ${s.say(s.value)} (the same)`);
      return;
    }
    lines.push(`${s.label} ${s.say(s.value)} (${s.diff(d)} ${(d > 0) === s.more ? 'better' : 'worse'})`);
  });
  const where = slot === 'weapon' ? 'in your hands' : `on your ${SLOT_NAMES[slot].toLowerCase()}`;
  lines.push(same
    ? `You have this on.`
    : on
      ? `Set against the ${itemName(on).toLowerCase()} (QL ${on.ql.toFixed(1)}) ${where}.`
      : `Nothing ${where} to set it against.`);
  return lines;
}
