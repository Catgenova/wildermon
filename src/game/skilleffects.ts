import { goSeconds, hullSpeed, productQlRange, queueCapAt, type Game } from './game';
import { ACTIONS, maxDigSlope, maxMasonSlope, prospectReach, repairGo } from './actions';
import { RECIPES } from './recipes';
import { MOULDS } from './metal';
import { findChance, relicsWithin, restoredQl } from './archaeology';
import { butcherYield } from './butcher';
import { enchantChance } from './enchant';
import { favourCap, PRAYER_PEAKS, prayerWorth } from './faith';
import { healAmount } from './firstaid';
import { staysOn } from './fishing';
import { rollsAt } from './forage';
import { breedChance, groomGain } from './husbandry';
import { inheritChance } from './traits';
import { calmCap } from './meditation';
import { motesFor } from './motes';
import { trackErr, trackLevel, trackRange } from './tracking';
import { grapesFor } from './vineyard';
import { woundClose, type Wound } from './wounds';
import { ROCK_VARIANTS } from '../world/tiles';
import { SKILL_BY_ID, SKILL_TOP } from './skills';
import { ARMOUR, ARMOUR_BY_ID, ARMOUR_CLASSES, hitChance, pieceSoak, SHIELDS, WEAPONS, WEAPON_BY_ID, weaponDamage, type ArmourClass, type WeaponDef } from './gear';
import { blockChance, myCritChance, swungWith } from './fight';
import { drivingPace, SAILING, sailingPace } from './travel';
import { awarenessReach, BASE_SIGHT } from './vision';
import { spellDef, spellForce, spellSecs } from './arcane';
import { skinOf } from './talents';
import { furnitureDef } from './furniture';
import { itemDef, type Item } from './items';
import { percent } from './words';

/**
 * What a skill's level changes, one entry per number, for the Skills window's
 * sliders.
 *
 * Every value is read off the rule itself (`atLevel`): the skill is set to the
 * level asked about, the rule the game plays by is asked, and the skill is put
 * back. Nothing here restates a formula, so a slider cannot drift from the
 * rule it shows, and what you carry and the perks you hold count as they do in
 * play.
 */
export interface SkillEffect {
  /** What it changes, in the game's terms: "Carry weight", "Boat row speed". */
  label: string;
  /** Its value now, as the rule reads it, with the skill at whatever level `atLevel` has set. */
  at: (g: Game) => number;
  /** The value as the game writes it. */
  say: (v: number) => string;
  /** What else it depends on, when the rule needs more than the level: "Difficulty 20". */
  note?: string;
}

/** A rule read with one skill at another level, and the skill put back however the rule returns. */
export function atLevel<T>(g: Game, id: string, level: number, read: () => T): T {
  const had = g.skills.values.get(id);
  g.skills.values.set(id, level);
  try {
    return read();
  } finally {
    if (had === undefined) g.skills.values.delete(id);
    else g.skills.values.set(id, had);
  }
}

/** One effect laid out along its track: the skill's starting value at the left, `SKILL_TOP` at the right. */
export interface EffectTrack {
  label: string;
  note?: string;
  /** The level the track starts at (the skill's own starting value) and ends at. */
  from: number;
  to: number;
  /** Where your level stands along it, 0 to 1. */
  share: number;
  low: string;
  now: string;
  high: string;
}

/** Every effect of a skill, along its track, for this body. */
export function effectTracks(g: Game, id: string): EffectTrack[] {
  const def = SKILL_BY_ID.get(id);
  const effects = effectsOf(id);
  if (!def || !effects.length) return [];
  const from = def.start;
  const to = SKILL_TOP;
  const level = Math.min(to, Math.max(from, g.skills.get(id)));
  return effects.map((e) => ({
    label: e.label,
    note: effectNote(g, id, e),
    from,
    to,
    share: to > from ? (level - from) / (to - from) : 1,
    low: e.say(atLevel(g, id, from, () => e.at(g))),
    now: e.say(e.at(g)),
    high: e.say(atLevel(g, id, to, () => e.at(g))),
  }));
}

/* ---- How values are written ------------------------------------------------- */

const times = (v: number): string => `×${v.toFixed(2)}`;
const kg = (v: number): string => `${Math.round(v)} kg`;
const secs = (v: number): string => `${v.toFixed(1)} s`;
const tiles = (v: number): string => `${v.toFixed(1)} tiles`;
const pace = (v: number): string => `${v.toFixed(2)} tiles/s`;
const points = (v: number): string => v.toFixed(1);
const height = (v: number): string => (Number.isFinite(v) ? `${Math.round(v)}` : 'any');

/* ---- What a rule is asked about ----------------------------------------------- */

/** The QL a piece is shown at when you have none of the kind to hand: the middle of the scale. */
export const EXAMPLE_QL = 50;
/** A thing of this kind at `EXAMPLE_QL`, unworn, as a rule reads an item. */
/** What a thing of this id is called. */
const named = (id: string): string => itemDef(id)?.name ?? id;
const example = (id: string): Item => ({ uid: -1, id, ql: EXAMPLE_QL, dmg: 0, count: 1 });

/** The weapon a weapon skill is shown with: the one in your hands if it is of the kind, otherwise the first of the kind. */
function weaponFor(g: Game, kind: string): { def: WeaponDef; item: Item | null; held: boolean } {
  const held = g.worn('weapon');
  const def = held ? WEAPON_BY_ID.get(held.id) : undefined;
  if (held && def && def.kind === kind) return { def, item: held, held: true };
  return { def: WEAPONS.find((w) => w.kind === kind)!, item: null, held: false };
}
const weaponNote = (w: { def: WeaponDef; item: Item | null; held: boolean }): string =>
  w.held && w.item ? `Held: ${named(w.item.id)}, QL ${w.item.ql.toFixed(0)}` : `${named(w.def.id)}, QL ${w.item?.ql ?? 20}`;

/** The armour piece a class's skill is shown with: one you wear of the class, otherwise its chest piece at `EXAMPLE_QL`. */
function pieceFor(g: Game, cls: ArmourClass): { item: Item; worn: boolean } {
  for (const slot of ['chest', 'head', 'legs', 'arms', 'feet'] as const) {
    const it = g.worn(slot);
    if (it && ARMOUR_BY_ID.get(it.id)?.cls === cls) return { item: it, worn: true };
  }
  return { item: example(ARMOUR.find((a) => a.cls === cls && a.slot === 'chest')!.id), worn: false };
}

/** The boat a body skill is shown pulling or sailing: QL `EXAMPLE_QL`, empty, wind full astern. */
const boatPace = (g: Game, kind: string, body: number): number => {
  const def = furnitureDef(kind).boat!;
  return hullSpeed(def, EXAMPLE_QL, body, 1, 0) * sailingPace(g.skills.get(SAILING));
};

/** The three things every weapon skill changes, with the weapon it is shown for. */
function weaponEffects(kind: string): SkillEffect[] {
  return [
    { label: 'Hit chance', at: (g) => { const w = weaponFor(g, kind); return hitChance(g, w.def, w.item); }, say: percent, note: undefined },
    { label: 'Damage per blow', at: (g) => { const w = weaponFor(g, kind); return weaponDamage(g, w.def, w.item); }, say: points },
    { label: 'Critical chance', at: (g) => myCritChance(g, weaponFor(g, kind).def), say: percent },
  ];
}

/** An armour class's skill: what one piece of it stops of a blow. */
const armourEffect = (cls: ArmourClass): SkillEffect => ({
  label: 'Damage stopped per piece',
  at: (g) => pieceSoak(ARMOUR_BY_ID.get(pieceFor(g, cls).item.id)!, pieceFor(g, cls).item, g.skills.get(ARMOUR_CLASSES[cls].skill)),
  say: percent,
});

/**
 * What each skill changes, by its id, built on first use so nothing here runs
 * while the modules it reads are still loading. A skill with nothing here has
 * no row of sliders.
 */
let built: Record<string, SkillEffect[]> | null = null;
export function effectsOf(id: string): SkillEffect[] {
  built ??= buildEffects();
  return built[id] ?? [];
}

/** Which skills have sliders. */
export const hasEffects = (id: string): boolean => effectsOf(id).length > 0;

/**
 * What every job done with a skill takes from it: the time a go takes, for
 * the skills an action or recipe is timed by (as a share of the time at level
 * 0, before the floor); the chance it comes off where it can fail; and the
 * best a piece of work can come out at. A piece smithed on an anvil is done
 * with its mould's skill and takes the time it takes, whatever the skill.
 */
const SLOW_GO = 100;
function workEffects(id: string): SkillEffect[] {
  const done = [...ACTIONS, ...RECIPES].filter((j) => j.skill === id);
  const timed = done.filter((j) => j.baseTime > 0 && !('instant' in j && j.instant));
  const jobs = [...done, ...MOULDS.filter((m) => m.skill === id)];
  if (!jobs.length) return [];
  const out: SkillEffect[] = timed.length
    ? [{ label: 'Time per go', at: (g) => goSeconds(SLOW_GO, g.skills.get(id)) / goSeconds(SLOW_GO, 0), say: times }]
    : [];
  if (jobs.some((j) => j.difficulty)) {
    out.push({ label: 'Success chance', at: (g) => g.skillChance(id, CHANCE_AT, 0, g.mindEase()), say: percent, note: `Difficulty ${CHANCE_AT}, no tool` });
  }
  // What comes out is no better than the skill it was made with (`productQl`): for the skills that make or bring in things.
  if (RECIPES.some((r) => r.skill === id) || MOULDS.some((m) => m.skill === id) || BRINGS_IN.has(id)) {
    out.push({ label: 'Highest QL made', at: (g) => productQlRange(g.skills.get(id), 100)[1], say: (v) => `QL ${v.toFixed(0)}` });
  }
  return out;
}
/** The trades that bring things in rather than make them from a recipe, each at a QL its skill caps (`productQl`). */
const BRINGS_IN = new Set(['digging', 'mining', 'prospecting', 'woodcutting', 'forestry', 'foraging', 'botanizing', 'fishing', 'farming',
  'butchering', 'archaeology', 'elementalism', 'animal_husbandry', 'paving']);
/** The difficulty a success chance is shown at: the one a job has when it names none (`skillChance`). */
const CHANCE_AT = 10;

/** The ore you may mine at a level: the hardest metal whose level is in reach (`oreNeeds`). */
const hardestOre = (level: number): string => {
  const open = ROCK_VARIANTS.filter((r) => r.level !== undefined && r.level <= level).sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  return open.length ? open[open.length - 1].name.replace(/ (vein|seam)$/, '') : 'none';
};

/** A pair shown as a pair nobody has groomed: no care. */
const NO_CARE = 0;

/** A wound as a chirurgeon finds one: a whole one, under cloth. */
const CLOTHED: Wound = { id: -1, kind: 'cut', part: 'chest', severity: 1, bleeding: false, infected: false, dressing: '' } as Wound;

function buildEffects(): Record<string, SkillEffect[]> {
  const fx: Record<string, SkillEffect[]> = {
    body_strength: [
      { label: 'Carry weight', at: (g) => g.carryLimit(), say: kg },
      { label: 'Damage per blow', at: (g) => { const w = swungWith(g); return weaponDamage(g, w.def, w.item); }, say: points },
      { label: 'Rowing boat speed', at: (g) => boatPace(g, 'rowing_boat', g.skills.get('body_strength')), say: pace, note: `QL ${EXAMPLE_QL}, empty` },
    ],
    body_stamina: [
      { label: 'Stamina cost of jobs and swings', at: (g) => g.staminaCost(1), say: times },
      { label: 'Stamina regained', at: (g) => g.windRegen(), say: times },
    ],
    body_control: [
      { label: 'Time per job', at: (g) => g.controlSpeed(), say: times },
      { label: 'Dodge chance', at: (g) => g.dodge(), say: percent },
      { label: 'Hit chance', at: (g) => { const w = swungWith(g); return hitChance(g, w.def, w.item); }, say: percent },
      { label: 'Sailing boat speed', at: (g) => boatPace(g, 'sailing_boat', g.skills.get('body_control')), say: pace, note: `QL ${EXAMPLE_QL}, empty, wind astern` },
    ],
    mind_logic: [
      { label: 'Job queue', at: (g) => queueCapAt(g.skills.get('mind_logic')) + g.perk('jobs', 0), say: (v) => `${v} jobs` },
      { label: 'Craft difficulty eased', at: (g) => g.mindEase(), say: (v) => (v > 0 ? `−${+v.toFixed(1)}` : '0'), note: 'At most half a craft\'s difficulty' },
    ],
    soul_strength: [{ label: 'Tame chance', at: (g) => g.soulBonus(), say: (v) => `+${percent(v)}` }],
    awareness: [{ label: 'Sight range', at: (g) => BASE_SIGHT * awarenessReach(g.skills.get('awareness')), say: tiles, note: 'Daylight, flat ground' }],
    climbing: [
      { label: 'Step up', at: (g) => g.climbStep(), say: height },
      { label: 'Step down', at: (g) => g.dropStep(), say: height },
      { label: 'Steepest ground to stand on', at: (g) => g.standSlope(), say: height },
    ],
    swimming: [
      { label: 'Swim speed', at: (g) => g.swimPace(), say: (v) => `${times(v)} walk` },
      { label: 'Stamina lost swimming', at: (g) => g.swimWind(), say: (v) => `${percent(v)}/s` },
    ],
    driving: [{ label: 'Cart and wagon speed', at: (g) => drivingPace(g.skills.get('driving')), say: times }],
    sailing: [{ label: 'Boat speed', at: (g) => sailingPace(g.skills.get(SAILING)), say: times }],
    fighting: [
      { label: 'Hit chance', at: (g) => { const w = swungWith(g); return hitChance(g, w.def, w.item); }, say: percent },
      { label: 'Damage per blow', at: (g) => { const w = swungWith(g); return weaponDamage(g, w.def, w.item); }, say: points },
      { label: 'Swing time', at: (g) => { const w = swungWith(g); return g.swingTime(w.def, w.item).secs; }, say: secs },
    ],
    shields: [{
      label: 'Block chance',
      at: (g) => {
        const held = g.worn('offhand');
        const sh = held && SHIELDS[held.id] ? { def: SHIELDS[held.id], ql: held.ql } : { def: SHIELDS.wooden_shield, ql: EXAMPLE_QL };
        return blockChance(sh.def.block, sh.ql, g.skills.get('shields'), (k, o) => g.perk(k, o));
      },
      say: percent,
    }],
    kindling: [{ label: 'Ember damage', at: (g) => spellForce(spellDef('ember')!, g.skills.get('kindling'), EXAMPLE_QL, 1), say: points, note: `Focus QL ${EXAMPLE_QL}` }],
    binding: [{ label: 'Snare hold', at: (g) => spellSecs(spellDef('snare')!, g.skills.get('binding'), 1), say: secs }],
    warding: [{ label: 'Aegis skin', at: (g) => skinOf(spellForce(spellDef('aegis')!, g.skills.get('warding'), EXAMPLE_QL, 1)), say: (v) => `${percent(v)} of max health`, note: `Focus QL ${EXAMPLE_QL}` }],
  };
  // The trades: each skill's own rules first, then what every job done with it takes from it.
  const own: Record<string, SkillEffect[]> = {
    digging: [{ label: 'Steepest slope you may leave', at: (g) => maxDigSlope(g), say: height }],
    mining: [{ label: 'Hardest ore', at: (g) => g.skills.get('mining'), say: hardestOre }],
    prospecting: [{ label: 'Prospect reach', at: (g) => prospectReach(g), say: tiles }],
    forestry: [{ label: 'Grapes per pick', at: (g) => grapesFor(g.skills.get('forestry')), say: (v) => `${v}` }],
    foraging: [{ label: 'Looks per go', at: (g) => rollsAt(g.skills.get('foraging')), say: (v) => `${v}` }],
    botanizing: [{ label: 'Looks per go', at: (g) => rollsAt(g.skills.get('botanizing')), say: (v) => `${v}` }],
    tracking: [
      { label: 'Track reach', at: (g) => trackRange(trackLevel(g.skills.get('tracking'))), say: (v) => `${v} tiles` },
      { label: 'Bearing error', at: (g) => trackErr(trackLevel(g.skills.get('tracking'))), say: (v) => `±${v.toFixed(0)}°` },
    ],
    fishing: [{ label: 'Fish stays on the hook', at: (g) => staysOn(g.skills.get('fishing'), EXAMPLE_QL, false), say: percent, note: `Rod QL ${EXAMPLE_QL}, no bait` }],
    masonry: [{ label: 'Steepest rock you may raise', at: (g) => maxMasonSlope(g), say: height }],
    animal_husbandry: [
      { label: 'Breeding success', at: (g) => breedChance(g.skills.get('animal_husbandry'), NO_CARE), say: percent, note: `Care ${NO_CARE}` },
      { label: 'Trait passed on', at: (g) => inheritChance(g.skills.get('animal_husbandry'), NO_CARE), say: percent, note: `Care ${NO_CARE}` },
      { label: 'Care per brushing', at: (g) => groomGain(g.skills.get('animal_husbandry'), EXAMPLE_QL), say: percent, note: `Brush QL ${EXAMPLE_QL}` },
    ],
    butchering: [{ label: 'Carcass kept', at: (g) => butcherYield(g.skills.get('butchering'), EXAMPLE_QL), say: percent, note: `Knife QL ${EXAMPLE_QL}` }],
    prayer: [{ label: 'Most favour held', at: (g) => favourCap(g.skills.get('prayer')), say: (v) => `${Math.round(v)}` }],
    praying: [{ label: 'Favour per prayer', at: (g) => prayerWorth(EXAMPLE_QL, PRAYER_PEAKS[0], g.skills.get('praying')), say: points, note: `Altar QL ${EXAMPLE_QL}, hour ${PRAYER_PEAKS[0]}` }],
    meditation: [{ label: 'Most Calm held', at: (g) => calmCap(g.skills.get('meditation')), say: (v) => `${Math.round(v)}` }],
    repair: [
      { label: 'Damage mended per go', at: (g) => repairGo(g.skills.get('repair')).healed, say: points },
      { label: 'QL lost per damage mended', at: (g) => repairGo(g.skills.get('repair')).cost, say: (v) => v.toFixed(3) },
    ],
    first_aid: [{ label: 'Health a dressing heals', at: (g) => healAmount(g.skills.get('first_aid'), EXAMPLE_QL), say: percent, note: `Dressing QL ${EXAMPLE_QL}` }],
    chirurgy: [{ label: 'Wound closing speed', at: (g) => woundClose(CLOTHED, g.skills.get('chirurgy')) / woundClose(CLOTHED, 0), say: times, note: 'Under cloth' }],
    archaeology: [
      { label: 'Chance of a find', at: (g) => findChance(g.skills.get('archaeology'), EXAMPLE_QL), say: percent, note: `Trowel QL ${EXAMPLE_QL}` },
      { label: 'Relics you can find', at: (g) => relicsWithin(g.skills.get('archaeology')).length, say: (v) => `${v}` },
    ],
    restoration: [{ label: 'QL kept restoring', at: (g) => restoredQl(g, 100) / 100, say: percent }],
    elementalism: [{ label: 'Motes per swirl', at: (g) => motesFor(g.skills.get('elementalism')), say: (v) => `${v}` }],
    enchanting: [{ label: 'Enchantment takes', at: (g) => enchantChance(g.skills.get('enchanting'), EXAMPLE_QL), say: percent, note: `Scroll QL ${EXAMPLE_QL}` }],
  };
  for (const def of SKILL_BY_ID.values()) {
    if (def.group !== 'Skills' || fx[def.id]) continue;
    const list = [...(own[def.id] ?? []), ...workEffects(def.id)];
    if (list.length) fx[def.id] = list;
  }
  for (const kind of ['swords', 'axes', 'mauls', 'knives', 'polearms', 'archery', 'throwing']) fx[kind] = weaponEffects(kind);
  // A bow is drawn on archery, as a swing is swung on fighting (`swingTime`).
  fx.archery.push({ label: 'Draw time', at: (g) => { const w = weaponFor(g, 'archery'); return g.swingTime(w.def, w.item).secs; }, say: secs });
  for (const cls of ['cloth', 'leather', 'chain', 'plate'] as const) fx[ARMOUR_CLASSES[cls].skill] = [armourEffect(cls)];
  return fx;
}

/** What an effect is shown with, where it is shown with something: the weapon, the piece, the shield. */
export function effectNote(g: Game, id: string, e: SkillEffect): string | undefined {
  if (e.note) return e.note;
  if (['swords', 'axes', 'mauls', 'knives', 'polearms', 'archery', 'throwing'].includes(id)) return weaponNote(weaponFor(g, id));
  if (id === 'fighting' || (id === 'body_strength' && e.label === 'Damage per blow') || (id === 'body_control' && e.label === 'Hit chance')) {
    const w = swungWith(g);
    return w.item ? `Held: ${named(w.item.id)}, QL ${w.item.ql.toFixed(0)}` : 'Fists';
  }
  const cls = (Object.keys(ARMOUR_CLASSES) as ArmourClass[]).find((c) => ARMOUR_CLASSES[c].skill === id && c !== 'scale');
  if (cls) {
    const p = pieceFor(g, cls);
    return `${p.worn ? 'Worn: ' : ''}${named(p.item.id)}, QL ${p.item.ql.toFixed(0)}`;
  }
  if (id === 'shields') {
    const held = g.worn('offhand');
    return held && SHIELDS[held.id] ? `Held: ${named(held.id)}, QL ${held.ql.toFixed(0)}` : `${named('wooden_shield')}, QL ${EXAMPLE_QL}`;
  }
  return undefined;
}
