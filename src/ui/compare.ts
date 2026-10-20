import type { Game } from '../game/game';
import { ARMOUR_BY_ID, ARMOUR_CLASSES, hitChance, pieceBurden, pieceSoak, SHIELDS, SLOT_NAMES, slotOf, WEAPON_BY_ID, weaponDamage } from '../game/gear';
import { armourSwingKg, blockChance, blockNote, reachOf, SWING_FLOOR, swingByOf, swingKgOf, THROWN_PAST } from '../game/fight';
import { bagRoom, bagUnits, isBag, itemDef, itemName, itemWeight, unitWeight, type Item } from '../game/items';
import { finePercent, listed, percent } from '../game/words';
import { ACTIONS, tasteSays } from '../game/actions';
import { RECIPES } from '../game/recipes';
import { MATERIALS } from '../game/improve';
import { SKILL_BY_ID } from '../game/skills';
import { NUTRIENT_NAMES, NUTRIENTS } from '../game/nutrition';
import type { TipLine } from './tooltip';

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
  /** A line under it saying how it came to that. */
  note?: string;
}

/** A share of the time as it reads: "+12%" longer, "−7%" shorter. */
const share = (by: number): string => `${by > 1 ? '+' : '−'}${percent(Math.abs(by - 1))}`;

/**
 * How a swing's time came to what it is: the weapon's own seconds, and each
 * thing in your hands now that moves it, with the floor when it holds.
 */
export function swingNote(t: ReturnType<Game['swingTime']>): string {
  const parts = t.parts.map((p) => `${p.what} ${share(p.by)}`);
  return `Base ${t.own.toFixed(2)} s${parts.length ? `; ${parts.join(', ')}` : ''}${t.floored ? `; min ${SWING_FLOOR.toFixed(1)} s` : ''}.`;
}

/**
 * What a piece of armour or a shield adds to every swing or draw while it is
 * on (`swingKgOf` at `armourSwingKg`), and how: its weight, its family's share
 * of it (`ARMOUR_SWING_BY`) and the rate a counted kilogram goes at.
 */
function swingStat(id: string, family: string): Stat {
  const kg = itemDef(id).weight;
  return {
    label: 'Swing or draw time', value: swingKgOf(id) * armourSwingKg(), say: (v) => `+${finePercent(v)}`,
    diff: (d) => `${d > 0 ? '+' : '−'}${finePercent(Math.abs(d))}`, more: false,
    note: `Its ${kg.toFixed(1)} kg counts ×${+swingByOf(id).toFixed(2)} for ${family}, ${swingKgOf(id).toFixed(2)} kg at ${finePercent(armourSwingKg())} a kilogram.`,
  };
}

/**
 * How far a swing of it reaches in your hands (`meleeReach`): its family's
 * reach (`WEAPON_REACH`), or a thrown one's range and `THROWN_PAST`, and what
 * a perk adds (a Pikeman's Long Reach, a Skirmisher's Long Throw).
 */
function reachStat(g: Game, weapon: NonNullable<ReturnType<typeof WEAPON_BY_ID.get>>): Stat {
  const own = reachOf(weapon);
  const more = g.perk(`length:${weapon.kind}`, 0);
  const why = weapon.thrown ? `Range ${weapon.range ?? 0} + ${THROWN_PAST}` : `All ${weapon.kind}: reach ${+own.toFixed(1)} tiles`;
  return {
    label: 'Reaches', value: own + more, say: (v) => `${+v.toFixed(1)} tiles`, diff: (d) => signed(d, 1, ' tiles'), more: true,
    note: `${why}${more ? `, + ${+more.toFixed(1)} for your perks` : ''}.`,
  };
}

const signed = (d: number, fixed: number, unit = ''): string => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d).toFixed(fixed)}${unit}`;
const points = (d: number): string => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(Math.round(d * 100))} points`;

function statsOf(g: Game, item: Item): Stat[] | null {
  const weapon = WEAPON_BY_ID.get(item.id);
  if (weapon) {
    // What a go of the fight with it would take in your hands now (`Game.swingTime`, the same sum as `Game.duration`), and why.
    const t = g.swingTime(weapon, item);
    return [
      { label: 'Damage per blow', value: weaponDamage(g, weapon, item), say: (v) => `${v.toFixed(1)} damage`, diff: (d) => signed(d, 1, ' damage'), more: true },
      { label: weapon.ammo ? 'Shot time' : 'Swing time', value: t.secs, say: (v) => `${v.toFixed(2)} s`, diff: (d) => signed(d, 2, ' s'), more: false,
        note: swingNote(t) },
      { label: 'Lands', value: hitChance(g, weapon, item), say: (v) => `${percent(v)} of ${weapon.ammo ? 'shots' : 'swings'}`, diff: points, more: true },
      ...(weapon.ammo ? [] : [reachStat(g, weapon)]),
    ];
  }
  const armour = ARMOUR_BY_ID.get(item.id);
  if (armour) {
    const skill = g.skills.get(ARMOUR_CLASSES[armour.cls].skill);
    return [
      { label: 'Damage stopped', value: pieceSoak(armour, item, skill), say: (v) => `${percent(v)} of a blow there`, diff: points, more: true },
      { label: 'Burden', value: pieceBurden(armour, item), say: (v) => percent(v), diff: points, more: false },
      { label: 'Weighs', value: itemWeight(item), say: (v) => `${v.toFixed(1)} kg`, diff: (d) => signed(d, 1, ' kg'), more: false },
      swingStat(item.id, ARMOUR_CLASSES[armour.cls].name.toLowerCase()),
    ];
  }
  const shield = SHIELDS[item.id];
  if (shield) {
    const perk = (k: string, d: number): number => g.perk(k, d);
    return [
      { label: 'Blocks', value: blockChance(shield.block, item.ql, g.skills.get('shields'), perk), say: (v) => `${finePercent(v)} of blows`, diff: points, more: true,
        note: blockNote(shield.block, item.ql, g.skills.get('shields'), perk) },
      { label: 'Burden', value: shield.burden, say: (v) => percent(v), diff: points, more: false },
      swingStat(item.id, 'a shield'),
    ];
  }
  return null;
}

/**
 * The card's lines, or null for a thing that is not worn to fight in. The first
 * line is the name; the rest are its numbers, each with the difference from
 * what is on you in that place when something is.
 */
export function compareLines(g: Game, item: Item): TipLine[] | null {
  const mine = statsOf(g, item);
  const slot = slotOf(item.id);
  if (!mine || !slot) return null;
  const on = g.worn(slot);
  const same = on?.uid === item.uid;
  const theirs = on && !same ? statsOf(g, on) : null;
  const lines: TipLine[] = [`${itemName(item)} · Quality ${item.ql.toFixed(1)}`];
  mine.forEach((s, i) => {
    const o = theirs?.[i];
    if (!o || o.label !== s.label) {
      lines.push({ text: `${s.label} ${s.say(s.value)}` });
      if (s.note) lines.push(s.note);
      return;
    }
    const d = s.value - o.value;
    if (Math.abs(d) < 1e-6) {
      lines.push({ text: `${s.label} ${s.say(s.value)}`, tail: '(the same)', tone: 'same' });
      if (s.note) lines.push(s.note);
      return;
    }
    const better = (d > 0) === s.more;
    lines.push({ text: `${s.label} ${s.say(s.value)}`, tail: `(${s.diff(d)} ${better ? 'better' : 'worse'})`, tone: better ? 'good' : 'bad' });
    if (s.note) lines.push(s.note);
  });
  const where = slot === 'weapon' ? 'in your hands' : `on your ${SLOT_NAMES[slot].toLowerCase()}`;
  lines.push(same
    ? 'Worn.'
    : on
      ? `Compared with: ${itemName(on).toLowerCase()} (Quality ${on.ql.toFixed(1)}) ${where}.`
      : `Nothing ${where} to compare.`);
  return lines;
}

/**
 * What each job tool is worked with, by item id: the skills of every job,
 * recipe and improving pass that takes it as its tool (`ActionDef.tool`,
 * `Recipe.tool`, `MATERIALS[…].tools`). These are the things whose working QL
 * (`Game.toolWorth`) the rules read; armour, a shield and a weapon nobody
 * works with are not among them. Built the first time it is asked.
 */
let jobTools: Map<string, Set<string>> | null = null;

function toolSkills(): Map<string, Set<string>> {
  if (jobTools) return jobTools;
  const map = new Map<string, Set<string>>();
  const add = (tool: string | undefined, skill: string | undefined): void => {
    if (!tool) return;
    const set = map.get(tool) ?? new Set<string>();
    if (skill) set.add(skill);
    map.set(tool, set);
  };
  for (const a of ACTIONS) add(a.tool, a.skill);
  for (const r of RECIPES) add(r.tool, r.skill);
  for (const m of Object.values(MATERIALS)) for (const t of m.tools) add(t, m.skill);
  return (jobTools = map);
}

/** Whether some job or recipe works with this as its tool, so its working QL is the one that counts. */
export const isJobTool = (id: string): boolean => toolSkills().has(id);

/**
 * The card for anything that is not worn to fight in: its name and QL, what
 * it weighs, its damage, and what it is for where its defs say so -- the
 * skills a tool is worked with and the QL it works as, what a bag holds and
 * how well it keeps it, the drinks in a skin, and what a food feeds. How much
 * a helping fills is said only to a Cook's Taste, as it is when eaten
 * (`tasteSays`). Every figure is the rule's own.
 */
export function itemCard(g: Game, item: Item): TipLine[] {
  const def = itemDef(item.id);
  const lines: TipLine[] = [`${itemName(item)} · Quality ${item.ql.toFixed(1)}`];
  lines.push({ text: `Weighs ${itemWeight(item).toFixed(1)} kg${item.count > 1 ? `, ${unitWeight(item).toFixed(2)} kg each` : ''}` });
  if (item.dmg > 0) lines.push({ text: `Damage ${item.dmg.toFixed(1)} of 100` });
  const skills = toolSkills().get(item.id);
  if (skills) {
    const names = [...skills].map((k) => (SKILL_BY_ID.get(k)?.name ?? k).toLowerCase());
    lines.push({ text: `Effective quality ${g.toolWorth(item).toFixed(1)}${names.length ? ` for ${listed(names)}` : ''}` });
  }
  if (isBag(item)) {
    lines.push({ text: `Holds ${bagRoom(item)} things; ${bagUnits(item)} in it now` });
    if (def.shelter !== undefined) lines.push(`Rot rate of contents on the ground ×${def.shelter}.`);
  }
  if (def.charges) lines.push({ text: `Holds ${def.charges} drinks; ${item.charges ?? 0} left` });
  const taste = g.perk('taste', 0) > 0 ? tasteSays(g, item).trim() : '';
  if (taste) lines.push(taste);
  else {
    const feeds = NUTRIENTS.filter((k) => (def.feeds?.[k] ?? 0) > 0).map((k) => NUTRIENT_NAMES[k].toLowerCase());
    if (feeds.length) lines.push({ text: `Feeds ${listed(feeds)}` });
  }
  if (item.locked) lines.push('Kept back: never spent, dropped or fed away.');
  return lines;
}
