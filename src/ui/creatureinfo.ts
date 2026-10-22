import { clockLeft } from '../game/boons';
import {
  ageOf,
  attackOf,
  careWord,
  coaxBonus,
  creatureLevel,
  favouriteSays,
  kindName,
  GATHER_VERB,
  growsAt,
  maxHealth,
  lineLines,
  pedigreeLine,
  rarityLine,
  SEX_NAMES,
  SPECIES,
  specialtySays,
  specialtyTrade,
  staminaOf,
  staminaSays,
  stageTameSays,
  STANCE_NAMES,
  tameNeeds,
  taskSkill,
  tracesSkill,
  unfedSays,
  workRangeOf,
  wellFedSays,
  workSkill,
  sparsAsGuard,
  type Creature,
} from '../game/creatures';
import { baitHint, coaxStep, tameChance } from '../game/creatureActions';
import { crateOf } from '../game/creaturecrate';
import type { Game } from '../game/game';
import { itemDef } from '../game/items';
import { traitOf } from '../game/traits';
import { traitReadNeeds } from '../game/husbandry';
import { SKILL_BY_ID } from '../game/skills';
import { idleSays, ledgerLines } from '../game/workerlog';

const pct = (v: number): number => Math.round(v * 100);

/** A bar of blocks, so a figure can be read without reading the figure. */
const bar = (v: number, width = 8): string => {
  const full = Math.max(0, Math.min(width, Math.round(v * width)));
  return '█'.repeat(full) + '░'.repeat(width - full);
};

/**
 * A long list of figures, broken after a comma into lines of about `width`
 * characters, so a rare one's dozen figures make a tooltip of a sensible width
 * rather than one line across the screen. Lines after the first are indented.
 */
const wrapList = (text: string, width = 64): string[] => {
  const lines: string[] = [];
  let line = '';
  for (const part of text.split(/(?<=,) /)) {
    if (line && line.length + part.length + 1 > width) {
      lines.push(line);
      // En spaces, which a tooltip's collapsing white space keeps.
      line = `\u2002\u2002${part}`;
    } else line = line ? `${line} ${part}` : part;
  }
  if (line) lines.push(line);
  return lines;
};

/** How rare it is and how big that made it, then what that is worth, a line or two of figures. */
const rarityLines = (c: Creature): string[] => {
  const [what = '', size = '', ...gives] = rarityLine(c).split(' · ');
  if (!what) return [];
  return [size ? `${what} · ${size}` : what, ...wrapList(gives.join(' · '))];
};

/**
 * Everything worth knowing about a creature at a glance, as lines for a
 * tooltip. What it says depends on what the creature is to you: a wild one
 * tells you only what you could learn by looking at it and what it would take
 * to win it over; one of your own tells you its condition, its blood, what it
 * is doing and how well it does it. Nothing here is decoration — every line is
 * a number you would otherwise have to go and look up.
 */
export function creatureLines(g: Game, c: Creature): string[] {
  const def = SPECIES[c.species] ?? SPECIES.rabba;
  const lines: string[] = [];
  const age = ageOf(c, g.time);
  // Only the young are growing: what was walking about before the clock started is grown however the sum comes out.
  const growing = age === 'young' ? growsAt(c, g.time) : 0;

  // A monster is not a wildermon and nothing about it is negotiable.
  if (def.monster) {
    lines.push(`${def.name} · hostile`);
    lines.push(`Health ${Math.ceil(c.health)}/${maxHealth(c, def)} ${bar(c.health / maxHealth(c, def))} · blow ${attackOf(c, def).toFixed(0)} damage`);
    lines.push('Cannot be tamed.');
    return lines;
  }

  if (c.mode === 'wild') {
    lines.push(`Wild ${kindName(c)} · ${age}${growing > 0 ? `, grown in ${clockLeft(growing)}` : ''}`);
    if (c.rare) lines.push(...rarityLines(c));
    lines.push(`Eats: ${baitHint(c)}`);
    // What taming it asks at its stage (`tameNeeds`), and for one past its first, what that adds over its kind's.
    const taming = g.skills.get('taming');
    const needs = tameNeeds(c).level;
    if (taming < needs) lines.push(`Taming needed ${needs} · yours ${taming.toFixed(1)}`);
    else lines.push(`Taming needed ${needs} · yours ${taming.toFixed(1)} · ${pct(tameChance(g, c))}% chance per offering`);
    const evolved = stageTameSays(c);
    if (evolved) lines.push(evolved);
    // At the step the chance itself is worked out with, a Herdsman's Patient Coax and all.
    const warm = coaxBonus(c, g.time, coaxStep(g));
    if (warm > 0) lines.push(`Offerings taken: ${c.coaxed} · chance +${pct(warm)} points`);
    if (c.trapped !== null) lines.push('Held in a trap.');
    return lines;
  }

  // One of your own: name, what it is, and how far along it is.
  lines.push(`${c.name} · ${SEX_NAMES[c.sex]} ${kindName(c)} · ${age}${growing > 0 ? `, grown in ${clockLeft(growing)}` : ''} · Lv ${creatureLevel(c)}`);
  if (c.rare) lines.push(...rarityLines(c));
  const max = maxHealth(c, def);
  lines.push(`Health ${Math.ceil(c.health)}/${max} ${bar(c.health / max)}`);
  lines.push(`Fed ${pct(c.hunger)}% ${bar(c.hunger)} · care ${pct(c.care)}%, ${careWord(c.care)}`);
  // What a good meal is putting on its learning now, and what its favourite would (`fedOn`).
  const fed = wellFedSays(c, g.time);
  if (fed) lines.push(fed);
  const favourite = favouriteSays(def);
  if (favourite) lines.push(favourite);

  // What it is doing, and how well it does it.
  if (c.ridden) lines.push('Ridden');
  else if (c.hitchedTo !== null) lines.push('In the traces');
  else if (c.mode === 'stored') {
    // Where the crate is: standing somewhere, or on your back.
    const h = crateOf(g, c.id);
    const where = h && 'piece' in h ? ` at (${h.piece.x}, ${h.piece.y})` : h?.carried ? ' in your pack' : '';
    lines.push(`In a wildermon crate${where} · no hunger`);
  } else if (c.mode === 'deed') {
    // A reach means nothing to something with no trade to range out and do.
    if (def.gathers) lines.push(`Settlement worker · ${GATHER_VERB[def.gathers]} ${taskSkill(c, def).toFixed(1)} · range ${workRangeOf(c, def)} tiles`);
    else lines.push(`Settlement worker · ${def.style === 'spar' ? 'sparring' : 'no task'}`);
    // Who it is sparring with on the settlement (`sparTaskSays`).
    const partner = c.sparWith != null ? g.creatures.get(c.sparWith) : undefined;
    if (partner && partner.mode === 'deed') lines.push(`Sparring with ${partner.name}`);
    if (c.carrying) lines.push(`Carrying: ${itemDef(c.carrying.id).name.toLowerCase()}`);
    // Its stamina and its settlement's specialty in its trade, for a trade with goes to tire it and to quicken; a spar
    // tires a guard and a Sparra as a go does, and quickens nothing.
    const kind = c.trade ?? def.gathers;
    if (specialtyTrade(kind) || sparsAsGuard(c) || def.style === 'spar') lines.push(`${staminaSays(c)} ${bar(staminaOf(c))}`);
    if (specialtyTrade(kind)) lines.push(specialtySays(kind, g.creatures.specialtyOf(c)));
    // And what a day without a meal makes of its pace (`UPKEEP_FOR`).
    const unfed = unfedSays(c);
    if (unfed) lines.push(unfed);
    // Why it is standing about, and what it did this island day and the one before.
    if (c.idle) lines.push(idleSays(c.idle, c.trade ?? def.gathers, c.carrying ? itemDef(c.carrying.id).name : null));
    lines.push(...ledgerLines(c.ledger, g.islandDay()));
  } else lines.push(`Companion · ${STANCE_NAMES[c.stance].toLowerCase()} · blow ${attackOf(c, def).toFixed(0)} damage`);

  // Blood, which is the whole of what breeding is for.
  const husbandry = g.skills.get('animal_husbandry');
  const traits = c.traits.map((id) => {
    const t = traitOf(id);
    if (!t) return null;
    if (husbandry < traitReadNeeds(t.tier, g.skills.get('awareness'))) return 'unread';
    // Nearly everything is common, so only what is better than common says so.
    // A fighting trait's grade is already in its name: "fanged (rare)".
    return t.tier === 'common' || t.family ? t.name : `${t.name} (${t.tier})`;
  }).filter(Boolean);
  if (traits.length) lines.push(`Traits: ${traits.join(', ')}`);
  // Who it was bred from, and how deep its line runs; anything not bred says nothing about it.
  if (c.pedigree) lines.push(pedigreeLine(c.pedigree), ...lineLines(c));
  // "In young", as the Wildermon card says it: a vola does not carry a calf.
  if (c.due > 0) lines.push(`In young · due in ${clockLeft(c.due - g.time)}`);
  return lines;
}

/**
 * What a creature can actually do, as opposed to what it is.
 *
 * A wildermon learns its trade the way you learn yours — by doing it — and
 * everything it knows sits in the same 1..100 scale your own skills do. None
 * of it showed anywhere: a worker's trade was one figure buried in a line
 * about its reach, and the hauling a draught beast picks up in the traces,
 * which decides the pace of every cart it is put in front of, was invisible.
 */
export function creatureSkills(g: Game, c: Creature): string[] {
  const def = SPECIES[c.species] ?? SPECIES.rabba;
  const lines: string[] = [`${c.mode === 'wild' ? `Wild ${def.name}` : c.name}: skills`];
  const known = Object.entries(c.skills).sort((a, b) => b[1] - a[1]);
  const trade = workSkill(def);
  if (!known.length) {
    if (def.monster) lines.push('No task.');
    else if (trade) lines.push('No skills yet.');
    else lines.push('No task.');
    return lines;
  }
  for (const [id, value] of known) {
    const name = SKILL_BY_ID.get(id)?.name ?? id;
    // A skill is worth the same to a beast as to you: what it can attempt and
    // how well it does it.
    // What it keeps in the traces is climbing, or a Roxxen's driving (`tracesSkill`).
    const note = id === trade ? 'task' : (id === 'climbing' || id === tracesSkill(def)) ? 'team pace in the traces' : id === 'fighting' ? 'blow damage' : '';
    lines.push(`${name} ${value.toFixed(1)} ${bar(value / 100)}${note ? ` · ${note}` : ''}`);
  }
  if (trade && c.mode === 'deed') lines.push(`Work range: ${workRangeOf(c, def)} tiles from its orders.`);
  else if (trade) lines.push('Task skill, used as a settlement worker.');
  return lines;
}
