/**
 * The row of what is on you just now, under the status panel: one small mark
 * for each thing working for you or against you, with the time it has left
 * where it has a clock, and its exact effect and where it came from on a hover
 * or a tap.
 *
 * Everything here is read off the rules that do it, never typed again: rest
 * off `REST_MULT`, tired arms off `tiredPace`, a wound's blood off
 * `woundDrain`, a worn enchantment off its own Examine line, a spell off its
 * own note. A spell cast on you is known by the island's answer to the cast
 * (`CastSeen.told`, the seconds it lasts on you), which is also what draws it,
 * and by what the island keeps of it on your row (`Player.held`), which the
 * join and every beat hand over, so a reload keeps it.
 *
 * What is working for you sits on the left in round marks; what is working
 * against you on the right in square ones, in the colour of harm. Position,
 * shape and colour all say which, so none of the three has to be seen alone.
 */
import type { Game } from '../game/game';
import { CARRY_STOP, overDrag } from '../game/game';
import type { CastSeen } from '../game/events';
import { REST_MULT } from '../game/boons';
import { SKILL_BY_ID } from '../game/skills';
import { FAITH, favourCap } from '../game/faith';
import { CLOSE_BARE, CLOSE_RIGHT, PART_NAMES, WOUND_KINDS, woundDrain, woundText, worstWound, type Wound } from '../game/wounds';
import { ARM_SLOW_MOST, armPace, LEG_SLOW_MOST, legPace, OVERBURDEN_SWING, TIRED_AT, TIRED_SLOW, tiredPace, VENOM_DRAIN } from '../game/fight';
import { DROWN_RATE, EXHAUSTED, HEAL_FED, HEAL_RATE, WIND_STARVING } from '../game/body';
import { CARRY_CRAWL, WINDED_AT, WINDED_PACE } from '../game/player';
import { LIGHT_GIVES_BACK, NIGHT_LOSS } from '../game/vision';
import { foreknowSaid, PATH_PICK_BY_ID, PATHS, type PathId } from '../game/meditation';
import { CLASS_SPELL_BY_ID } from '../game/talents';
import { PERK_BY_ID } from '../game/perks';
import type { Held } from '../game/player';
import { FAITH_SPELL_BY_ID, PATRON_BY_ID } from '../game/patrons';
import { spellDef } from '../game/arcane';
import { classDef } from '../game/classes';
import { spellInfo } from '../render/spells/info';
import { ENCHANTMENT_LIST, ENCHANTMENTS, enchantFigure, qlWord, swingEnchant, type EnchantEffect, type EnchantmentDef } from '../game/enchant';
import { enchantLine } from '../game/enchanting';
import { baubleSummary } from '../game/baubles';
import { itemDef, itemName, type Item } from '../game/items';
import { groundRoll, TILE_DEFS } from '../world/tiles';
import { furnitureDef } from '../game/furniture';
import { capital, listed, percent, timeWords } from '../game/words';
import type { TipLine, Tooltip } from './tooltip';

/* ---- What is on you -------------------------------------------------------- */

/** The marks a row draws with: small line drawings in the panel's own ink. */
type Glyph = 'rest' | 'meal' | 'flask' | 'sun' | 'enso' | 'eye' | 'leaf' | 'bolt' | 'shield' | 'cross' | 'paw' | 'flame' | 'chain'
  | 'sword' | 'spear' | 'dash' | 'scales' | 'spiral' | 'lamp' | 'gem' | 'star' | 'hourglass' | 'wind' | 'claw' | 'drop'
  | 'blister' | 'fang' | 'weight' | 'bowl' | 'cup' | 'moon' | 'waves' | 'wheel' | 'bow' | 'tick'
  | 'skin' | 'layers' | 'link' | 'stone' | 'wall';

export interface Effect {
  /** Stable across looks, so a mark is kept rather than drawn again. */
  id: string;
  good: boolean;
  glyph: Glyph;
  name: string;
  /** Under the mark: the time it has left, or how many, or nothing. */
  caption: string;
  /** What it does, in the game's numbers. */
  does: string[];
  /** Where it came from. */
  from: string;
}

/** Seconds as the row says them under a mark: 45s, 12m, 3h. */
export function shortLeft(secs: number): string {
  const s = Math.max(0, secs);
  if (s < 60) return `${Math.ceil(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

/** And in words, for the note: "45 seconds", "12 minutes", "1 hour and 4 minutes". */
const longLeft = (secs: number): string => {
  const s = Math.max(1, Math.ceil(secs));
  return s < 60 ? `${s} second${s === 1 ? '' : 's'}` : timeWords(s);
};

/** A share of health a second, as a minute of it. */
const perMinute = (perSecond: number): string => percent(perSecond * 60);

/** A skin's size as the island says it when one is laid ("a skin of 24%", `faith_pct`), finer only under a whole one, so a last sliver never reads as nothing. */
export const skinSaid = (size: number): string => (size < 0.01 ? percent(size) : `${Math.round(size * 100)}%`);

/** Kilograms as they read. */
const kg = (n: number): string => `${Math.round(n)} kg`;

/**
 * What the island keeps on your row (`player.blessings`) from a spell or a
 * passive, by the key it is kept under (`blessing_put`), and the spell or
 * passive that put it there. What else it keeps there has a mark of its own
 * (`KEPT_ELSEWHERE`).
 */
export const KEPT_AS: Readonly<Record<string, string>> = {
  // The Sworn Blade.
  breathing: 'blade_measured_breathing', deflect: 'blade_deflect', hold_line: 'blade_hold_the_line', last_stand: 'blade_last_stand',
  // The Berserker.
  adrenaline: 'berserker_adrenaline', battle_rage: 'berserker_battle_rage', last_rage: 'berserker_last_rage',
  // The Pikeman.
  brace: 'pikeman_brace_for_the_charge', fend_off: 'pikeman_fend_off', keep_away: 'pikeman_keep_away',
  // The Archer.
  deadeye: 'archer_deadeye', decoy: 'archer_decoy', read_wind: 'archer_read_the_wind',
  // The Skirmisher.
  hit_and_run: 'skirmisher_hit_and_run', opportunist: 'skirmisher_opportunist',
  // The Chirurgeon.
  regenerate: 'chirurgeon_regenerate', surgeons_hands: 'chirurgeon_surgeons_hands',
  // The Beastmaster.
  bloodlust: 'beastmaster_bloodlust', feral_bond: 'beastmaster_feral_bond', primal_fury: 'beastmaster_primal_fury',
  vengeance: 'beastmaster_vengeance',
  // The Kindler, and its Blaze Momentum: a passive whose share grows with every spell.
  blaze_aura: 'kindler_blaze_aura', firebrand: 'kindler_firebrand', stoke: 'kindler_stoke', momentum: 'kindler_blaze_momentum',
  // The Binder.
  still_skin: 'binder_still_skin',
  // The Warder.
  bastion_stone: 'warder_bastion_of_stone', stoneskin: 'warder_stoneskin', thicken: 'warder_thicken', unbreakable: 'warder_unbreakable',
  ward_link: 'warder_ward_link',
  // The three patrons.
  arms: 'blessing_arms', kinship: 'blessing_kinship', renewal: 'blessing_renewal', second_life: 'blessing_second_life',
  shield: 'blessing_shield', steady: 'blessing_steady', ward: 'blessing_ward',
  oath: 'justice_oath', retribution: 'justice_retribution', reward: 'justice_reward', temper: 'justice_temper',
  shroud: 'chaos_shroud',
};
/** What else the island keeps on your row: a path's techniques, which `Player.pathTimes` has and `HELD_TECHNIQUES` marks. */
export const KEPT_ELSEWHERE = /^path_/;
/** Every spell the island keeps on your row, so that one it no longer keeps is known to have run out or been spent. */
const KEPT_SPELLS = new Set(Object.values(KEPT_AS));
/** Seconds the island's word on what you hold has to be newer than a cast to say that spell is gone: a beat asked before the cast can answer after it. */
const HELD_SLACK = 2;

/**
 * What the island says is held on you (`Island.held`: seconds left and the
 * numbers it keeps), as `Player.held` keeps it: when each runs out on the
 * game's clock, and its numbers, a list as how many are in it.
 */
export function heldFrom(said: Readonly<Record<string, Readonly<Record<string, unknown>>>>, now: number): Record<string, Held> {
  const out: Record<string, Held> = {};
  for (const [key, o] of Object.entries(said)) {
    const secs = o.secs;
    if (typeof secs !== 'number' || !(secs > 0)) continue;
    const fx: Record<string, number> = {};
    for (const [k, v] of Object.entries(o)) {
      if (k === 'secs') continue;
      if (typeof v === 'number' && Number.isFinite(v)) fx[k] = v;
      else if (Array.isArray(v)) fx[k] = v.length;
    }
    out[key] = { until: now + secs, fx };
  }
  return out;
}

/** One spell on you, as `SpellsOnYou.list` says it: its seconds left, who cast it (null you, undefined not known), and the numbers the island keeps of it. */
export interface SpellOn {
  spell: string;
  left: number;
  by: number | null | undefined;
  fx?: Readonly<Record<string, number>>;
}

/**
 * Spells cast on you: what the island keeps of each on your row
 * (`Player.held`, handed over at the join and on every beat, so a reload
 * keeps it), and what it said at the moment of a cast (`CastSeen.told`),
 * which says who cast it and holds a spell until the next beat.
 */
export class SpellsOnYou {
  private readonly on = new Map<string, { spell: string; until: number; by: number | null; at: number }>();

  constructor(private readonly game: Game) {
    game.events.on('cast', (c) => this.saw(c));
    game.events.on('reset', () => this.on.clear());
  }

  private saw(c: CastSeen): void {
    const mine = c.by === null;
    // A Thicken or a Stoke the cast spent is gone at once, not at the next beat.
    if (mine) {
      for (const used of c.told?.used ?? []) {
        this.on.delete(used);
        for (const [key, spell] of Object.entries(KEPT_AS)) if (spell === used) delete this.game.player.held[key];
      }
    }
    const info = spellInfo(c.spell);
    if (!info) return;
    // You, by the island's own list of who the cast reached and for how long.
    const hit = c.told?.hit.find((h) => h.at.kind === 'you' || (mine && h.at.kind === 'self'));
    let secs = hit?.secs;
    // A spell on yourself whose answer named nobody (an island from before `told`, or an aura round you): its own seconds.
    if (secs === undefined && mine && (c.at.kind === 'self' || c.at.kind === 'you') && info.on.includes('self') && !info.fx.skin) secs = info.fx.secs;
    // A cast on a creature that quickens your own walk for a while (a Skirmisher's Hit and Run).
    if (secs === undefined && mine && info.fx.pace && info.fx.secs) secs = info.fx.secs;
    if (!secs || secs <= 0) return;
    this.on.set(c.spell, { spell: c.spell, until: this.game.time + secs, by: c.by, at: this.game.time });
  }

  /**
   * What still holds: everything the island keeps on you, with who cast it
   * where a cast said so, and then what a cast said that the island has not
   * been asked about since.
   */
  list(): SpellOn[] {
    const now = this.game.time;
    const p = this.game.player;
    const out = new Map<string, SpellOn>();
    for (const [key, h] of Object.entries(p.held)) {
      const spell = KEPT_AS[key];
      if (!spell || h.until <= now) continue;
      out.set(spell, { spell, left: h.until - now, by: this.on.get(spell)?.by, fx: h.fx });
    }
    for (const [id, s] of this.on) {
      if (s.until <= now) this.on.delete(id);
      else if (out.has(id)) continue;
      // Kept on your row, and the island has said since that it is not there: run out, spent or taken off.
      else if (KEPT_SPELLS.has(id) && p.heldAt - s.at > HELD_SLACK) this.on.delete(id);
      else out.set(id, { spell: s.spell, left: s.until - now, by: s.by });
    }
    return [...out.values()];
  }

  holds(spell: string): boolean {
    return this.list().some((s) => s.spell === spell);
  }
}

/** A spell's name, what it does, and what kind of spell it is, by its id. */
function spellCard(id: string): { name: string; note: string; kind: string; glyph: Glyph } | null {
  const cls = CLASS_SPELL_BY_ID.get(id);
  if (cls) {
    return { name: cls.name, note: cls.note, kind: `${classDef(cls.class)?.name ?? capital(cls.class)} spell`, glyph: SPELL_GLYPH[id] ?? CLASS_GLYPH[cls.class] ?? 'star' };
  }
  const faith = FAITH_SPELL_BY_ID.get(id);
  if (faith) return { name: faith.name, note: faith.note, kind: `${PATRON_BY_ID.get(faith.patron)?.name ?? capital(faith.patron)} spell`, glyph: FAITH_GLYPH[faith.patron] ?? 'sun' };
  const arc = spellDef(id);
  if (arc) return { name: arc.name, note: arc.note, kind: `${capital(SKILL_BY_ID.get(arc.school)?.name ?? arc.school)} spell`, glyph: 'star' };
  // A passive whose share the island keeps on you while it holds (a Kindler's Blaze Momentum).
  const perk = PERK_BY_ID.get(id);
  if (perk) return { name: perk.name, note: perk.note, kind: `${classDef(perk.class)?.name ?? capital(perk.class)} passive`, glyph: CLASS_GLYPH[perk.class] ?? 'star' };
  return null;
}

/**
 * What a spell's numbers come to just now, where the island keeps more of it
 * than its seconds: the multiplier a Thicken has waiting, how many a Ward Link
 * has laid a skin back over, how large a Blaze Momentum has grown.
 */
function heldLines(spell: string, fx: Readonly<Record<string, number>> | undefined): string[] {
  switch (spell) {
    case 'warder_thicken': {
      const more = fx?.more ?? CLASS_SPELL_BY_ID.get(spell)?.fx.more ?? 1;
      return [`Next skin: ×${Number(more.toFixed(2))} (+${percent(more - 1)}); used by the next skin laid.`];
    }
    case 'warder_ward_link':
      return !fx?.done ? [] : [`Skins renewed so far: ${fx.done}.`];
    case 'kindler_blaze_momentum':
      return fx?.more === undefined ? [] : [`Fire damage now: +${percent(fx.more)}.`];
    default:
      return [];
  }
}

const CLASS_GLYPH: Record<string, Glyph> = {
  blade: 'shield', berserker: 'bolt', pikeman: 'spear', archer: 'bow', skirmisher: 'dash', chirurgeon: 'cross',
  beastmaster: 'paw', kindler: 'flame', binder: 'chain', warder: 'shield',
};
/** The Warder's that hold on you, each its own mark, so none is taken for another or for the skin over you (`skin`). */
const SPELL_GLYPH: Record<string, Glyph> = {
  warder_thicken: 'layers', warder_ward_link: 'link', warder_stoneskin: 'stone', warder_bastion_of_stone: 'wall',
};
const FAITH_GLYPH: Record<string, Glyph> = { blessing: 'sun', justice: 'scales', chaos: 'spiral' };
const PATH_GLYPH: Partial<Record<PathId, Glyph>> = { knowledge: 'eye', love: 'leaf', power: 'bolt' };

/** Love's and Power's techniques that hold a while, by the key their clock is kept under (`Player.pathTimes`). */
const HELD_TECHNIQUES: Array<{ key: 'herd' | 'lungs' | 'surge' | 'unbroken'; pick: string }> = [
  { key: 'herd', pick: 'love_herd_heart' },
  { key: 'lungs', pick: 'power_deep_lungs' },
  { key: 'surge', pick: 'power_surge' },
  { key: 'unbroken', pick: 'power_unbroken' },
];

/**
 * The enchantments a worn piece holds that work on you rather than on the
 * piece or on what it strikes, and the mark each is drawn with. Packmule's is
 * on a pack carried rather than worn.
 */
const ON_YOU: Partial<Record<EnchantEffect, Glyph>> = {
  guard: 'shield', fireguard: 'shield', block: 'shield', thorns: 'star', stride: 'dash', shadow: 'moon', learn: 'star',
  knack: 'star', wind: 'wind', upkeep: 'bowl', favour: 'sun', calm: 'enso', swim: 'waves', sight: 'eye', mule: 'weight',
};

/** How worse a cart's going has to be before the ground is worth a mark: as the status line had it. */
const ROUGH_FROM = 0.985;

/** Its line, with what you have of it put in, from where it says "while it is worn" on. */
function enchantOnYou(e: EnchantmentDef, total: number): string {
  const line = enchantLine(e).replaceAll('{v}', enchantFigure(e, total)).replace(/^(Worn|Carried|In pack): /, '');
  return capital(line);
}

/** What is on you just now, good first, each side in the order it is listed here. */
export function effectsOn(g: Game, spells: SpellsOnYou): Effect[] {
  const p = g.player;
  const s = p.stats;
  const out: Effect[] = [];
  const add = (e: Effect): void => {
    out.push(e);
  };

  /* -- For you --------------------------------------------------------------- */

  // The skin over you, which every blow takes what it can out of first, and which lasts until blows use it up.
  if (p.skin.size > 0) {
    const size = skinSaid(p.skin.size);
    add({
      id: 'skin', good: true, glyph: 'skin', name: `Skin of ${size}`, caption: size,
      does: [`Absorbs blows before shield and armour: ${size} of max health left.`, 'Lasts until used up.'],
      from: p.skin.mine ? 'Laid by you.' : p.skin.by ? `Laid by ${p.skin.by}.` : 'Source: Warder spell, Aegis or Bulwark.',
    });
  }
  // Spells cast on you, yours or anybody's, and a passive the island keeps a share of.
  for (const on of spells.list()) {
    const card = spellCard(on.spell);
    if (!card) continue;
    // Not said by the island, which keeps no caster: you, for a spell cast only on yourself that reaches nobody else.
    const info = spellInfo(on.spell);
    const by = on.by === undefined && info?.on.length === 1 && info.on[0] === 'self' && !info.fx.reach ? null : on.by;
    const who = by === null ? 'you' : by === undefined ? null : g.roster.get(by)?.name ?? 'somebody';
    const passive = PERK_BY_ID.has(on.spell) && !CLASS_SPELL_BY_ID.has(on.spell);
    add({
      id: `spell:${on.spell}`, good: true, glyph: card.glyph, name: card.name, caption: shortLeft(on.left),
      does: [card.note, ...heldLines(on.spell, on.fx), `${longLeft(on.left)} left.`],
      from: passive ? `Your ${card.kind}.` : who ? `Cast by ${who}: ${card.kind}.` : `${capital(card.kind)}.`,
    });
  }
  // A path's techniques that hold a while.
  for (const t of HELD_TECHNIQUES) {
    const left = (p.pathTimes[t.key] ?? -Infinity) - g.time;
    const k = PATH_PICK_BY_ID.get(t.pick);
    if (left <= 0 || !k) continue;
    add({ id: `path:${t.key}`, good: true, glyph: PATH_GLYPH[k.path] ?? 'enso', name: k.name, caption: shortLeft(left), does: [k.note, `${longLeft(left)} left.`], from: `Your ${PATHS[k.path].name} technique.` });
  }
  const clarity = p.clarityUntil - g.time;
  const clear = PATH_PICK_BY_ID.get('knowledge_clarity');
  if (clarity > 0 && clear) {
    add({ id: 'path:clarity', good: true, glyph: 'eye', name: clear.name, caption: shortLeft(clarity), does: [clear.note, `${longLeft(clarity)} left.`], from: `Your ${PATHS[clear.path].name} technique.` });
  }
  const fore = PATH_PICK_BY_ID.get('knowledge_foreknow');
  if (p.foreknow > 0 && fore) {
    add({ id: 'path:foreknow', good: true, glyph: 'tick', name: fore.name, caption: String(p.foreknow), does: [foreknowSaid(p.foreknow)], from: `Your ${PATHS[fore.path].name} technique.` });
  }
  // Rest, banked in a bed and burned at the work.
  if (p.rested > 0) {
    add({
      id: 'rest', good: true, glyph: 'rest', name: 'Rested', caption: shortLeft(p.rested),
      does: [`Skill gain ×${REST_MULT} base, other bonuses added.`,
        `Used only while working: ${longLeft(p.rested)} of work left.`],
      from: 'Sleep in a bed.',
    });
  }
  // What a dish or a tincture favours, while it lasts.
  for (const b of p.boons) {
    const left = b.until - g.time;
    if (left <= 0) continue;
    const skill = SKILL_BY_ID.get(b.skill)?.name ?? b.skill;
    add({
      id: `boon:${b.kind ?? 'dish'}:${b.skill}`, good: true, glyph: b.kind === 'tincture' ? 'flask' : 'meal', name: `${skill} ${b.kind === 'tincture' ? 'tincture' : 'meal'} boost`, caption: shortLeft(left),
      does: [`${skill} skill gain +${percent(b.bonus)} (added).`, `${longLeft(left)} left.`],
      from: `${b.kind === 'tincture' ? 'A tincture' : 'A meal'}: ${b.from}.`,
    });
  }
  // A light in your hand, which is a clock and what it buys you.
  const lamp = g.heldLight();
  if (lamp) {
    const left = lamp.charges ?? 0;
    add({
      id: 'lamp', good: true, glyph: 'lamp', name: `${itemName(lamp)} lit`, caption: shortLeft(left),
      does: [`Restores ${percent(LIGHT_GIVES_BACK)} of sight lost to darkness; sight at least its light radius.`,
        `Sight: ${Math.round(g.vision.sightRange())} tiles.`, `${longLeft(left)} of light left.`],
      from: `${capital(itemName(lamp).toLowerCase())} in your pack.`,
    });
  }
  // Favour and Calm, which are what spells and techniques are paid in.
  if (p.favour >= 1) {
    const faith = g.skills.get(FAITH);
    add({
      id: 'favour', good: true, glyph: 'sun', name: 'Favour', caption: String(Math.floor(p.favour)),
      does: [`${Math.floor(p.favour)}/${Math.floor(favourCap(faith))} (max at ${(SKILL_BY_ID.get(FAITH)?.name ?? FAITH).toLowerCase()} ${faith.toFixed(1)}). Pays for faith spells.`],
      from: 'Prayer at an altar; slow regeneration.',
    });
  }
  if (p.calm >= 1) {
    add({
      id: 'calm', good: true, glyph: 'enso', name: 'Calm', caption: String(Math.floor(p.calm)),
      does: [`${Math.floor(p.calm)}/${Math.floor(g.calmCap())} (max by meditation). Pays for path techniques.`],
      from: 'Sitting on a rug.',
    });
  }
  // What is worn and works on you.
  const worn = Object.values(p.equipped).map((uid) => (uid === null || uid === undefined ? undefined : g.inventory.get(uid))).filter((it): it is Item => !!it);
  for (const [effect, glyph] of Object.entries(ON_YOU) as Array<[EnchantEffect, Glyph]>) {
    const pieces = (effect === 'mule' ? g.inventory.items : worn).filter((it) => swingEnchant(it, effect) > 0);
    if (!pieces.length) continue;
    const total = effect === 'mule' ? pieces.reduce((n, it) => n + swingEnchant(it, effect), 0) : g.wornEnchant(effect);
    const e = ENCHANTMENTS[pieces[0].enchant?.id ?? ''] ?? ENCHANTMENT_LIST.find((x) => x.effect === effect);
    if (!e || total <= 0) continue;
    add({
      id: `ench:${effect}`, good: true, glyph, name: e.name, caption: '',
      does: [enchantOnYou(e, total)],
      from: `${capital(listed(pieces.map((it) => `${e.name} QL ${qlWord(it.enchant?.ql ?? 0)} on your ${itemDef(it.id).name.toLowerCase()}`)))}.`,
    });
  }
  // The baubles of the settlement under your feet, while they serve you.
  const here = g.baubleHere();
  if (here.length) {
    const deed = g.deedOfMineAt(p.tileX, p.tileY);
    const name = deed?.name ?? 'This settlement';
    add({
      id: 'baubles', good: true, glyph: 'gem', name: `${name}'s baubles`, caption: String(here.length),
      does: baubleSummary(here).map((b) => `${capital(b.text)}${b.capped ? ' (capped)' : ''}.`),
      from: `${here.length} ${here.length === 1 ? 'bauble' : 'baubles'} in ${name}'s altar, while on ${name}.`,
    });
  }

  /* -- Against you ----------------------------------------------------------- */

  // Deep water and nothing left to swim with.
  if (p.swimming && s.stamina <= 0) {
    add({ id: 'drown', good: false, glyph: 'waves', name: 'Drowning', caption: '', does: [`Health −${percent(DROWN_RATE)}/s while swimming at 0 stamina.`], from: 'Deep water, no stamina.' });
  }
  const wounds = p.wounds;
  const kind = (w: Wound): string => WOUND_KINDS[w.kind].name;
  // A wound by what and where, without the state its own mark says.
  const plain = (w: Wound): string => woundText(w).replace(/, (bleeding|with venom in it|dressed|gone bad)$/, '');
  // Blood out of what is open, burns apart: a burn weeps rather than bleeds.
  const bleeding = wounds.filter((w) => w.bleeding && !w.infected && w.kind !== 'burn');
  if (bleeding.length) {
    const drain = bleeding.reduce((n, w) => n + woundDrain(w), 0);
    add({
      id: 'bleed', good: false, glyph: 'drop', name: 'Bleeding', caption: String(bleeding.length),
      does: [`Health −${perMinute(drain)}/min.`, 'A dressing stops a wound bleeding.'],
      from: `${capital(listed(bleeding.map(plain)))}.`,
    });
  }
  const venom = wounds.filter((w) => (w.venom ?? 0) > 0 && w.dressing === null);
  if (venom.length) {
    const left = Math.max(...venom.map((w) => w.venom ?? 0));
    add({
      id: 'venom', good: false, glyph: 'fang', name: 'Venom', caption: shortLeft(left),
      does: [`Per venomous wound: health −${percent(VENOM_DRAIN)}/s, up to ${longLeft(left)} more.`, 'A dressing stops it.'],
      from: `A venomous bite: ${listed(venom.map(plain))}.`,
    });
  }
  const bad = wounds.filter((w) => w.infected);
  if (bad.length) {
    const drain = bad.reduce((n, w) => n + woundDrain({ ...w, bleeding: false }), 0);
    add({
      id: 'fester', good: false, glyph: 'blister', name: 'Infected', caption: String(bad.length),
      does: [`Health −${perMinute(drain)}/min; does not close.`, 'Clean out with lye before dressing.'],
      from: `Infected: ${listed(bad.map((w) => `${kind(w)} on your ${PART_NAMES[w.part] ?? w.part}`))}.`,
    });
  }
  const burns = wounds.filter((w) => w.kind === 'burn' && !w.infected);
  if (burns.length) {
    const weeping = burns.filter((w) => w.bleeding);
    const drain = weeping.reduce((n, w) => n + woundDrain(w), 0);
    add({
      id: 'burn', good: false, glyph: 'flame', name: burns.length === 1 ? 'Burn' : 'Burns', caption: String(burns.length),
      does: [weeping.length ? `Weeping: health −${perMinute(drain)}/min until dressed.` : 'Dressed: not weeping.',
        `Right herb for burns: ${WOUND_KINDS.burn.herb}.`],
      from: `${capital(listed(burns.map(plain)))}.`,
    });
  }
  if (wounds.length) {
    const worst = worstWound(wounds);
    const arms = spells.holds('blade_hold_the_line') ? 1 : armPace(wounds);
    const legs = p.unslowed ? 1 : legPace(wounds);
    const does: string[] = [];
    if (worst) does.push(`Worst: ${woundText(worst)}.`);
    if (arms > 1) does.push(`Arm and hand wounds: swing and draw time +${percent(arms - 1)} (max +${percent(ARM_SLOW_MOST)}).`);
    if (legs < 1) does.push(`Leg and foot wounds: walk speed −${percent(1 - legs)} (max −${percent(LEG_SLOW_MOST)}).`);
    const sorted = [...wounds].sort((a, b) => (b.infected ? 1 : 0) - (a.infected ? 1 : 0) || b.severity - a.severity);
    for (const w of sorted.slice(0, 5)) {
      does.push(`${capital(woundText(w).replace(/^an? /, ''))}: ${w.infected ? 'clean it out with lye' : `wants a ${WOUND_KINDS[w.kind].herb} cover`}.`);
    }
    if (sorted.length > 5) does.push(`And ${sorted.length - 5} more.`);
    add({
      id: 'wounds', good: false, glyph: 'claw', name: `Wounds: ${wounds.length}`, caption: String(wounds.length), does,
      from: `Blows taken. Right herb: closing ×${+(CLOSE_RIGHT / CLOSE_BARE).toFixed(2)} vs undressed.`,
    });
  }
  // Food and water, at the two lines the body draws.
  for (const [bar, low, empty, word, glyph] of [['hunger', 'Hungry', 'Starving', 'food', 'bowl'], ['thirst', 'Thirsty', 'Parched', 'water', 'cup']] as const) {
    const v = s[bar];
    if (v > HEAL_FED) continue;
    const does = [`No healing while ${word} ≤ ${percent(HEAL_FED)}; above it, +${perMinute(HEAL_RATE)}/min.`];
    if (v <= 0) does.push(`Stamina regeneration ×${WIND_STARVING} while ${word} is empty.`);
    add({ id: bar, good: false, glyph, name: v <= 0 ? empty : low, caption: '', does, from: `${capital(word)} at ${percent(Math.round(v * 100) / 100)}.` });
  }
  // A load past what your back takes: the status panel's warning, and the walk it slows.
  const over = g.overloaded();
  if (over > 0) {
    const limit = g.carryLimit();
    const burden = g.burden();
    const load = overDrag(over, limit) * g.pathFx('burden', 1);
    const does = [`Load ${kg(limit + over)}; limit ${kg(limit)}.`];
    if (p.unslowed) does.push('Surge: no slowing.');
    else {
      does.push(`Walk speed −${percent(load / (1 + burden))} from load.`);
      does.push(p.stalled
        ? `Over ${kg(limit * CARRY_STOP)} (limit ×${CARRY_STOP}): speed ×${CARRY_CRAWL} (now).`
        : `Over ${kg(limit * CARRY_STOP)} (limit ×${CARRY_STOP}): speed ×${CARRY_CRAWL}.`);
    }
    does.push(`Swing and draw time +${percent(OVERBURDEN_SWING)}.`);
    add({ id: 'over', good: false, glyph: 'weight', name: p.stalled ? 'Overloaded: crawling' : 'Overloaded', caption: '', does, from: `Overload: ${kg(over)}.` });
  }
  // Wind, at the two lines it is drawn at.
  if (s.stamina < WINDED_AT) {
    const does = [p.unslowed ? 'Surge: no slowing.' : `Walk speed ×${WINDED_PACE} on foot.`];
    if (s.stamina < EXHAUSTED) does.push(`No timed actions until ${percent(EXHAUSTED)} stamina.`);
    add({ id: 'winded', good: false, glyph: 'wind', name: s.stamina < EXHAUSTED ? 'Exhausted' : 'Winded', caption: '', does, from: `Stamina under ${percent(WINDED_AT)}.` });
  }
  if (s.stamina < TIRED_AT) {
    const slow = tiredPace(s.stamina) - 1;
    add({
      id: 'tired', good: false, glyph: 'hourglass', name: 'Tired arms', caption: `+${Math.round(slow * 100)}%`,
      does: [`Swing and draw time +${percent(slow)} (+${percent(TIRED_SLOW)} at 0 stamina).`],
      from: `Stamina under ${percent(TIRED_AT)}.`,
    });
  }
  // The dark, which takes off how far you see, when nothing in your hand gives it back.
  const down = p.level < 0;
  const dark = down ? 1 : g.darkness();
  const loss = NIGHT_LOSS * g.pathFx('dark', 1) * dark;
  if (!lamp && (down || g.isNight()) && loss > 0) {
    add({
      id: 'dark', good: false, glyph: 'moon', name: 'Dark', caption: '',
      does: [`Sight −${percent(loss)}: ${Math.round(g.vision.sightRange())} tiles.`,
        `Lit lantern or torch: restores ${percent(LIGHT_GIVES_BACK)} of it.`],
      from: down ? 'Cellar: dark at any hour.' : `Time: ${g.clock()}.`,
    });
  }
  // What the ground under a loaded wheel is costing, when it is costing anything.
  const cart = g.driving();
  if (cart) {
    const def = TILE_DEFS[g.world.getTile(p.tileX, p.tileY)];
    const roll = groundRoll(def.roll, g.vehicleLoad(cart));
    if (roll < ROUGH_FROM) {
      const what = furnitureDef(cart.kind).name.toLowerCase();
      add({
        id: 'ground', good: false, glyph: 'wheel', name: `${def.name} underfoot`, caption: '',
        does: [`${capital(what)} speed here: ${percent(roll)} (with its load).`], from: `Ground: ${def.name.toLowerCase()}.`,
      });
    }
  }
  return out;
}

/* ---- How it is drawn -------------------------------------------------------- */

/** Each mark, as the inside of a sixteen-unit square drawn in the current ink. */
const GLYPHS: Record<Glyph, string> = {
  rest: '<path d="M11 2.6A5.8 5.8 0 1 0 13.6 11 4.6 4.6 0 0 1 11 2.6z"/>',
  moon: '<path d="M2.2 8c2.6 3.1 9 3.1 11.6 0"/><path d="M4.2 10.4l-1 1.6M8 11.3v1.9M11.8 10.4l1 1.6"/>',
  meal: '<path d="M2 8.5h12a6 5.5 0 0 1-12 0z"/><path d="M6 6c-.8-.9.8-1.6 0-3.2M10 6c-.8-.9.8-1.6 0-3.2"/>',
  bowl: '<path d="M2 7.5h12a6 5.5 0 0 1-12 0z"/><path d="M5.5 14.5h5"/>',
  flask: '<path d="M6 2h4M7 2v4.2L3.4 12.6a1 1 0 0 0 .9 1.4h7.4a1 1 0 0 0 .9-1.4L9 6.2V2"/><path d="M4.8 10.2h6.4"/>',
  cup: '<path d="M3.2 3h9.6l-1.1 10.1a1 1 0 0 1-1 .9H5.3a1 1 0 0 1-1-.9z"/><path d="M5.5 6.5l.7 4"/>',
  sun: '<circle cx="8" cy="8" r="2.6"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/>',
  enso: '<path d="M12.6 4.6A5.6 5.6 0 1 0 13.5 9"/><circle cx="8" cy="8" r=".9" fill="currentColor" stroke="none"/>',
  eye: '<path d="M1.5 8c2.2-3.6 10.8-3.6 13 0-2.2 3.6-10.8 3.6-13 0z"/><circle cx="8" cy="8" r="2"/>',
  leaf: '<path d="M3 13C3 6.5 7 3 13 3c0 6-3.5 10-10 10z"/><path d="M3 13l5.5-5.5"/>',
  bolt: '<path d="M9.2 1.5L3.8 9h4l-1 5.5L12.2 7h-4z"/>',
  shield: '<path d="M8 1.8l5.4 2v4.1c0 3.4-2.4 5.4-5.4 6.4-3-1-5.4-3-5.4-6.4V3.8z"/>',
  cross: '<path d="M6.3 2.5h3.4v3.8h3.8v3.4H9.7v3.8H6.3V9.7H2.5V6.3h3.8z"/>',
  paw: '<ellipse cx="8" cy="10.6" rx="3" ry="2.6"/><circle cx="3.6" cy="6.8" r="1.3"/><circle cx="6.4" cy="4" r="1.3"/><circle cx="9.6" cy="4" r="1.3"/><circle cx="12.4" cy="6.8" r="1.3"/>',
  flame: '<path d="M8 1.8c2.6 3 4.2 5.1 4.2 7.6a4.2 4.2 0 0 1-8.4 0c0-2 1.3-3.4 2-4.9.6 1.3 1.2 1.8 2 2.1C8.3 5.1 8.2 3.6 8 1.8z"/>',
  chain: '<rect x="1.8" y="5.6" width="7" height="4.8" rx="2.4"/><rect x="7.2" y="5.6" width="7" height="4.8" rx="2.4"/>',
  sword: '<path d="M13.5 2.5L6 10M4 8.5l3.5 3.5M3 13l2-2M13.5 2.5h-2.2M13.5 2.5v2.2"/>',
  spear: '<path d="M2.5 13.5L11 5M11 5l2.5-2.5-.6 3.6zM9.2 3.6l3.2 3.2"/>',
  dash: '<path d="M2 5h6M2 8h9M2 11h6"/><path d="M10 4.5l3.5 3.5-3.5 3.5"/>',
  scales: '<path d="M8 2.5v11M5 13.5h6M3 4.5h10"/><path d="M3 4.5L1.5 8.5h3zM13 4.5l-1.5 4h3z"/>',
  spiral: '<path d="M8 8.2a1 1 0 1 1 1-1.2 2.4 2.4 0 1 1-3.4 2.4A3.8 3.8 0 1 1 12 6a5.2 5.2 0 1 1-9.6 3"/>',
  lamp: '<path d="M5.5 4.5h5l1 8.5h-7z"/><path d="M6.5 4.5a1.5 1.5 0 0 1 3 0M8 7.2c1 1.2 1.3 2 1.3 2.6a1.3 1.3 0 0 1-2.6 0c0-.6.3-1.4 1.3-2.6z"/><path d="M4 13h8"/>',
  gem: '<path d="M4.5 2.5h7l3 3.6L8 14 1.5 6.1z"/><path d="M1.5 6.1h13M6.2 2.5L5 6.1 8 14l3-7.9-1.2-3.6"/>',
  star: '<path d="M8 1.5l1.6 4.9 4.9 1.6-4.9 1.6L8 14.5 6.4 9.6 1.5 8l4.9-1.6z"/>',
  hourglass: '<path d="M4 2h8M4 14h8M5 2c0 3.6 6 3.6 6 6s-6 2.4-6 6M11 2c0 3.6-6 3.6-6 6s6 2.4 6 6"/>',
  wind: '<path d="M2 6h8.2a2 2 0 1 0-2-2"/><path d="M2 9.5h10a2 2 0 1 1-2 2"/>',
  claw: '<path d="M4.5 2.5L2.8 9.5M8.5 2L6.3 12.5M12.5 3l-2.2 8"/>',
  drop: '<path d="M8 1.8c2.6 3.5 4 5.6 4 7.7a4 4 0 0 1-8 0c0-2.1 1.4-4.2 4-7.7z"/>',
  blister: '<circle cx="6" cy="9.5" r="3.2"/><circle cx="11.3" cy="5.4" r="2.2"/><circle cx="11.8" cy="11.6" r="1.4"/>',
  fang: '<path d="M2 3.5c4 1.6 8 1.6 12 0"/><path d="M4.6 4.4L6 11.5l1.3-6.8M8.7 4.7L10 11.5l1.4-7.1"/>',
  weight: '<path d="M5.3 5.5h5.4l2.6 8.5H2.7z"/><path d="M6.2 5.5a1.8 1.8 0 1 1 3.6 0"/>',
  waves: '<path d="M1.5 5.5c1.6-1.6 3.3-1.6 4.9 0s3.3 1.6 4.9 0 2.4-1.2 3.2-.4M1.5 10.5c1.6-1.6 3.3-1.6 4.9 0s3.3 1.6 4.9 0 2.4-1.2 3.2-.4"/>',
  bow: '<path d="M4.5 1.8c5.6 2.4 5.6 10 0 12.4"/><path d="M4.5 1.8v12.4M1.8 8h11.4M11.2 6l2 2-2 2"/>',
  tick: '<circle cx="8" cy="8" r="6"/><path d="M5 8.2l2.1 2.1L11 6.2"/>',
  skin: '<path d="M8 1.8l5.4 2v4.1c0 3.4-2.4 5.4-5.4 6.4-3-1-5.4-3-5.4-6.4V3.8z"/><path d="M8 4.6l2.8 1v2.3c0 1.8-1.2 2.9-2.8 3.5-1.6-.6-2.8-1.7-2.8-3.5V5.6z"/>',
  layers: '<path d="M8 2.4l5.6 2.8L8 8 2.4 5.2z"/><path d="M2.4 8.2L8 11l5.6-2.8M2.4 11L8 13.8l5.6-2.8"/>',
  link: '<circle cx="5.8" cy="8" r="3.5"/><circle cx="10.2" cy="8" r="3.5"/>',
  stone: '<path d="M2.8 12.6l1.3-5.4 3.5-3.8 4.4 1.7 1.6 5.1-2.3 2.4z"/><path d="M7.6 3.4l.7 4.4 4.6 2.2M8.3 7.8l-4.2-.6"/>',
  wall: '<path d="M3 14V4.5h2.2v2h1.7v-2h2.2v2h1.7v-2H13V14z"/><path d="M6.8 14v-3.2h2.4V14"/>',
  wheel: '<circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="1.4"/><path d="M8 2v4.6M8 9.4V14M2 8h4.6M9.4 8H14"/>',
};

export const svgOf = (g: Glyph): string =>
  `<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[g]}</svg>`;

/** One mark in the row, and what it last said, so nothing is written twice. */
interface Mark {
  el: HTMLButtonElement;
  cap: HTMLSpanElement;
  glyph: Glyph;
  caption: string;
  label: string;
}

/** A mark's width and the gap after it, and the gap between the two halves on one line, in pixels: what the row is counted in. */
const MARK_W = 22;
const MARK_GAP = 3;
const HALF_GAP = 6;

/** One half of the row: its box, its "+N", and what did not fit in it. */
interface Half {
  el: HTMLDivElement;
  more: HTMLButtonElement;
  hidden: Effect[];
}

/**
 * The row itself: what is for you from the left, what is against you from the
 * right. On one line while they fit; past that, two lines, the good above and
 * the bad below, each with what does not fit behind a "+N" at its inner end;
 * and one half with nothing of the other has both lines.
 * Never more than two lines, so the status panel never grows past the cells
 * it was laid out on by more than a line of marks.
 */
export class EffectRow {
  readonly el = document.createElement('div');
  private readonly good: Half;
  private readonly bad: Half;
  private readonly marks = new Map<string, Mark>();
  readonly spells: SpellsOnYou;
  /** What each mark says just now, by id, for the note. */
  private shown = new Map<string, Effect>();
  /** The row's width, measured when it changes rather than every look. */
  private width = 0;
  private order = '';
  /** Which mark's note is up, and whether a tap pinned it there. */
  private open: string | null = null;
  private pinned = false;

  constructor(private readonly game: Game, private readonly tooltip: Tooltip | null) {
    this.spells = new SpellsOnYou(game);
    this.el.className = 'hud-fx';
    this.el.hidden = true;
    this.el.setAttribute('aria-label', 'Effects');
    const half = (cls: string, side: 'good' | 'bad'): Half => {
      const el = document.createElement('div');
      el.className = `hud-fx-side ${cls}`;
      el.setAttribute('role', 'list');
      el.setAttribute('aria-label', side === 'good' ? 'Buffs' : 'Debuffs');
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'hud-fx-mark hud-fx-more';
      more.dataset.fx = `more:${side}`;
      this.wire(more);
      return { el, more, hidden: [] };
    };
    this.good = half('hud-fx-good', 'good');
    this.bad = half('hud-fx-bad', 'bad');
    this.el.append(this.good.el, this.bad.el);
    new ResizeObserver(() => {
      const w = this.el.clientWidth;
      if (w > 0 && w !== this.width) {
        this.width = w;
        this.update();
      }
    }).observe(this.el);
    // A tap anywhere else puts a pinned note away.
    document.addEventListener('pointerdown', (e) => {
      if (this.pinned && !(e.target instanceof Node && this.el.contains(e.target))) this.close();
    }, true);
  }

  private wire(el: HTMLButtonElement): void {
    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || this.pinned) return;
      this.open = el.dataset.fx ?? null;
      this.note();
    });
    el.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse' || this.pinned) return;
      this.close();
    });
    // A tap or a click pins it open, so it can be read with a finger; again, or anywhere else, puts it away.
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = el.dataset.fx ?? null;
      if (this.pinned && this.open === id) {
        this.close();
        return;
      }
      this.open = id;
      this.pinned = true;
      this.note();
    });
    el.addEventListener('focus', () => {
      if (this.pinned || !el.matches(':focus-visible')) return;
      this.open = el.dataset.fx ?? null;
      this.note();
    });
    el.addEventListener('blur', () => {
      if (!this.pinned) this.close();
    });
  }

  private close(): void {
    this.open = null;
    this.pinned = false;
    this.tooltip?.hide(this);
  }

  /** The note of the mark that is open, under it: said again only when a word of it has changed, which `Tooltip` sees to. */
  private note(): void {
    if (!this.tooltip || !this.open) return;
    const half = this.open === 'more:good' ? this.good : this.open === 'more:bad' ? this.bad : null;
    const at = half ? half.more : this.marks.get(this.open)?.el;
    const e = half ? null : this.shown.get(this.open);
    if (!at || !at.isConnected || (!half && !e)) {
      this.close();
      return;
    }
    const lines: TipLine[] = e
      ? [e.name, ...e.does.map((text) => ({ text })), `Source: ${e.from}`]
      : [`${half?.hidden.length} more ${half === this.good ? 'for you' : 'against you'} than the row has room for`,
        ...(half?.hidden ?? []).map((h): TipLine => ({ text: `${h.name}${h.caption ? ` · ${h.caption}` : ''}: ${h.does[0]}` }))];
    const r = at.getBoundingClientRect();
    this.tooltip.show(r.left - 16, r.bottom - 16, lines, this, true);
  }

  private markFor(e: Effect): Mark {
    let m = this.marks.get(e.id);
    if (!m) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `hud-fx-mark ${e.good ? 'hud-fx-buff' : 'hud-fx-debuff'}`;
      el.dataset.fx = e.id;
      el.setAttribute('role', 'listitem');
      const icon = document.createElement('span');
      icon.className = 'hud-fx-icon';
      icon.innerHTML = svgOf(e.glyph);
      const cap = document.createElement('span');
      cap.className = 'hud-fx-cap';
      el.append(icon, cap);
      this.wire(el);
      m = { el, cap, glyph: e.glyph, caption: '\u0000', label: '' };
      this.marks.set(e.id, m);
    }
    if (m.glyph !== e.glyph) {
      m.glyph = e.glyph;
      (m.el.firstElementChild as HTMLElement).innerHTML = svgOf(e.glyph);
    }
    if (m.caption !== e.caption) {
      m.caption = e.caption;
      m.cap.textContent = e.caption;
    }
    const label = `${e.name}${e.caption ? `, ${e.caption}` : ''}`;
    if (m.label !== label) {
      m.label = label;
      m.el.setAttribute('aria-label', label);
    }
    return m;
  }

  /** Lay one half out in `room` marks: all of it, or all but what a "+N" stands for. */
  private lay(half: Half, list: Effect[], room: number): string {
    const shown = list.length <= room ? list : list.slice(0, Math.max(0, room - 1));
    half.hidden = list.slice(shown.length);
    const els = shown.map((e) => this.markFor(e).el);
    if (half.hidden.length) {
      half.more.textContent = `+${half.hidden.length}`;
      half.more.setAttribute('aria-label', `${half.hidden.length} more`);
      els.push(half.more);
    }
    const order = `${shown.map((e) => e.id).join(',')}+${half.hidden.length}`;
    if (half.el.dataset.order !== order) {
      half.el.dataset.order = order;
      half.el.replaceChildren(...els);
    }
    return order;
  }

  /** Look again: a few times a second, from the hud's own beat. */
  update(): void {
    const all = effectsOn(this.game, this.spells);
    const good = all.filter((e) => e.good);
    const bad = all.filter((e) => !e.good);
    this.shown = new Map(all.map((e) => [e.id, e]));
    // Marks across a whole line, and across one line shared by both halves.
    const w = this.width || 206;
    const line = Math.max(2, Math.floor((w + MARK_GAP) / (MARK_W + MARK_GAP)));
    const shared = Math.max(2, Math.floor((w + MARK_GAP - HALF_GAP) / (MARK_W + MARK_GAP)));
    // Both halves on one line while they fit; past that a line each. A half alone has both lines to itself.
    const two = good.length > 0 && bad.length > 0 && good.length + bad.length > shared;
    const alone = !good.length || !bad.length;
    const order = `${two}|${this.lay(this.good, good, alone ? 2 * line : line)}|${this.lay(this.bad, bad, alone ? 2 * line : line)}`;
    if (order !== this.order) {
      this.order = order;
      this.el.classList.toggle('hud-fx-two', two);
      this.el.hidden = !all.length;
      // Marks for what has worn off are let go.
      for (const id of [...this.marks.keys()]) if (!this.shown.has(id)) this.marks.delete(id);
    }
    if (this.open) this.note();
  }
}
