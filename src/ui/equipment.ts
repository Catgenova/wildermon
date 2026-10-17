/**
 * What the Equipment window shows: what you have on in each place, what you
 * could put on instead, and every number the fight reads off you, each from
 * the rule the fight itself uses -- `weaponDamage`, `hitChance`,
 * `myCritChance` and `Game.swingTime` for a blow; `pieceSoak`, `blockChance`,
 * `dodgeChance` and `Game.expectedBlow` for one taken; `Game.burden` and
 * `Game.swingBurden` for what it all costs to carry. Nothing here is a rule of
 * its own: the window says what the fight would do, in your hands today.
 *
 * And what each skill behind those numbers is doing for you: each number
 * asked again of the same rule with that one skill at where it starts and at
 * its next level, so "Swords: damage +9%" is the difference the rule makes and
 * cannot drift from it.
 */
import { ARMOUR_BY_ID, ARMOUR_CLASSES, HIT_LOCATIONS, hitChance, pieceBurden, pieceSoak, SHIELDS, SLOT_NAMES, SLOTS, slotOf, WEAPON_BY_ID,
  WEAPON_SKILL_NAMES, weaponDamage, type Slot, type WeaponDef } from '../game/gear';
import { blockChance, blockNote, blowOf, bowReach, critMul, dodgeChance, DODGE_PER_KG, FIGHT_STANCE_NAMES, FIGHT_STANCES, FIST, meleeReach,
  myCritChance, sideOf, stanceDealt, stanceSays, stanceTaken, swungWith, nockedArrow, type FightStance } from '../game/fight';
import type { Game } from '../game/game';
import { itemDef, itemName, itemWeight, type Item } from '../game/items';
import { matOf } from '../game/materials';
import { METAL_TONE, WOOD_TONE } from '../render/materials';
import { SKILL_BY_ID } from '../game/skills';
import { finePercent, percent } from '../game/words';
import { WOUND_KINDS, type WoundKind } from '../game/wounds';
import { swingNote } from './compare';

/** One place on the body, and what is in it. */
export interface SlotView {
  slot: Slot;
  name: string;
  item: Item | null;
  /** "Iron sword", or null for an empty place. */
  label: string | null;
  /** What it does in this place, in a few words with its number: "Turns aside 34% of a blow here". */
  does: string | null;
  /** How worn it is, 0 (new) to 1 (falling apart), as `item.dmg` of 100. */
  wear: number;
  /** For a place a blow lands on: how often one lands there, 0..1. */
  struck: number | null;
  /** What a blow there loses to what is worn there, 0..1, or null for nothing worn. */
  soak: number | null;
  /** A colour for the piece's material, `#rrggbb`, or null. */
  tint: string | null;
}

/** A thing in the pack that could be put on, with what it would change. */
export interface ShelfView {
  item: Item;
  slot: Slot;
  label: string;
  /** Its first number set against what is on in its place: "+1.4 damage", "−6 points turned". */
  delta: string | null;
  /** Whether that change is for the better. */
  better: boolean | null;
  /** Why it cannot go on now, or null. */
  why: string | null;
  wear: number;
  tint: string | null;
}

/** A number with what it is and, where it came from more than one thing, how. */
export interface Stat {
  key: string;
  label: string;
  value: number;
  /** As it reads: "62%", "2.40 s". */
  says: string;
  /** How it came to that, for the line under it. */
  note?: string;
}

/** A skill the fight reads, how far along it is, and what it is doing for you now and at its next level. */
export interface SkillView {
  id: string;
  name: string;
  level: number;
  /** How far to the next whole level, 0..1. */
  toNext: number;
  /** What it gives now over where it starts, and what one more level adds: "Damage +9.2% (+0.4%)". */
  gives: Array<{ what: string; now: string; next: string }>;
  /** How it rises. */
  trains: string;
}

export interface EquipReport {
  slots: SlotView[];
  shelf: ShelfView[];
  /** What is swung or drawn, and what with. */
  weapon: { name: string; kind: string; skill: string; ranged: boolean; blow: string; side: string | null; arrows: string | null };
  offence: Stat[];
  defence: Stat[];
  /** Of a blow of each kind, the share that gets through to you. */
  through: Array<{ kind: WoundKind; name: string; share: number }>;
  burden: Stat[];
  stance: { now: FightStance; all: Array<{ id: FightStance; name: string; says: string }> };
  skills: SkillView[];
  /** The four up top: what a blow does, how often it lands, how much of one taken gets through, and how much you are slowed. */
  head: Stat[];
}

/** What a place on the body is for, when nothing is in it. */
export const EMPTY_SAYS: Record<Slot, string> = {
  head: 'Nothing on your head', chest: 'Nothing on your chest', arms: 'Nothing on your arms', legs: 'Nothing on your legs',
  feet: 'Nothing on your feet', weapon: 'Your fists', offhand: 'Nothing in your off hand', belt: 'No belt: no loops for jobs',
  jewel: 'No jewel',
};

/** The game asked with one skill at another level: every rule that reads it reads that, everything else as it is. */
function withSkill(g: Game, id: string, v: number): Game {
  return new Proxy(g, {
    get(t, p) {
      if (p === 'skills') return { get: (k: string): number => (k === id ? v : t.skills.get(k)) };
      const x = Reflect.get(t, p, t);
      return typeof x === 'function' ? x.bind(t) : x;
    },
  }) as Game;
}

/** A chance moved by so many points of a hundred: two places when it is under a tenth of one, so a small step does not read as none. */
const pts = (d: number): string => `${d >= 0 ? '+' : '−'}${Math.abs(d * 100).toFixed(Math.abs(d * 100) < 0.1 && d !== 0 ? 2 : 1)} pts`;
const pct = (d: number): string => `${d >= 0 ? '+' : '−'}${finePercent(Math.abs(d))}`;

/** The weight of the armour you have on, without a shield: what a dodge is held back by (`Game.dodge`). */
const armourOnKg = (g: Game): number => SLOTS.reduce((n, s) => {
  const it = g.worn(s);
  return n + (it && ARMOUR_BY_ID.get(it.id) ? itemDef(it.id).weight : 0);
}, 0);

/** What a blow there loses, with the wearer's skill and Power's Ironhide, as `Game.expectedBlow` counts it, before the blow's kind. */
function slotSoak(g: Game, slot: Slot): number | null {
  const it = g.worn(slot);
  const def = it && ARMOUR_BY_ID.get(it.id);
  if (!it || !def) return null;
  return Math.min(0.92, pieceSoak(def, it, g.skills.get(ARMOUR_CLASSES[def.cls].skill)) * g.pathFx('hide', 1));
}

/** The material's colour, for the swatch beside a piece. */
const tintOf = (it: Item | null | undefined): string | null => {
  if (!it?.extra) return null;
  const id = matOf(it.extra).id;
  const metal = METAL_TONE[id];
  if (metal) return `#${metal.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  return WOOD_TONE[id] ?? null;
};

/** What a piece does where it is, in a few words with its number. */
function slotDoes(g: Game, slot: Slot, it: Item | null): string | null {
  if (!it) return null;
  const armour = ARMOUR_BY_ID.get(it.id);
  if (armour) return `Turns aside ${percent(slotSoak(g, slot) ?? 0)} of a blow here`;
  const w = WEAPON_BY_ID.get(it.id);
  if (w) return `${weaponDamage(g, w, it).toFixed(1)} a blow, ${percent(hitChance(g, w, it))} land`;
  const sh = SHIELDS[it.id];
  if (sh) return `Blocks ${finePercent(blockChance(sh.block, it.ql, g.skills.get('shields'), (k, o) => g.perk(k, o)) + g.wornEnchant('block'))} of blows`;
  if (slot === 'belt') return `${g.beltLoops()} loops for jobs`;
  return itemDef(it.id).name;
}

/** The first number of a thing set against what is on in its place: what the shelf shows beside it. */
function deltaOf(g: Game, it: Item, slot: Slot): { delta: string | null; better: boolean | null } {
  const on = g.worn(slot) ?? null;
  const w = WEAPON_BY_ID.get(it.id);
  if (w) {
    const mine = weaponDamage(g, w, it);
    const held = on && WEAPON_BY_ID.get(on.id);
    const theirs = held ? weaponDamage(g, held, on) : weaponDamage(g, FIST, null);
    const d = mine - theirs;
    return { delta: `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)} a blow`, better: Math.abs(d) < 1e-6 ? null : d > 0 };
  }
  const armour = ARMOUR_BY_ID.get(it.id);
  if (armour) {
    const mine = Math.min(0.92, pieceSoak(armour, it, g.skills.get(ARMOUR_CLASSES[armour.cls].skill)) * g.pathFx('hide', 1));
    const d = mine - (slotSoak(g, slot) ?? 0);
    return { delta: `${pts(d)} turned`, better: Math.abs(d) < 1e-6 ? null : d > 0 };
  }
  const sh = SHIELDS[it.id];
  if (sh) {
    const perk = (k: string, o: number): number => g.perk(k, o);
    const mine = blockChance(sh.block, it.ql, g.skills.get('shields'), perk);
    const osh = on && SHIELDS[on.id];
    const d = mine - (osh && on ? blockChance(osh.block, on.ql, g.skills.get('shields'), perk) : 0);
    return { delta: `${pts(d)} blocked`, better: Math.abs(d) < 1e-6 ? null : d > 0 };
  }
  return { delta: null, better: null };
}

/** What is swung or drawn now: the weapon in hand, a bow drawn, or fists. */
function inHand(g: Game): { def: WeaponDef; item: Item | null } {
  const held = g.worn('weapon');
  const def = held && WEAPON_BY_ID.get(held.id);
  return def ? { def, item: held ?? null } : swungWith(g);
}

/** What one of the fight's numbers is with a skill at a level. */
type Rule = (gg: Game) => number;

/** A skill's line: what each number it moves is with it as it is, against at its start and at its next level. */
function skillView(g: Game, id: string, name: string, trains: string, rules: Array<{ what: string; rule: Rule; as: (d: number, base: number) => string }>): SkillView {
  const level = g.skills.get(id);
  const start = SKILL_BY_ID.get(id)?.start ?? 0;
  const next = Math.floor(level) + 1;
  return {
    id, name, level, toNext: level - Math.floor(level), trains,
    gives: rules.map(({ what, rule, as }) => {
      const now = rule(g), from = rule(withSkill(g, id, start)), up = rule(withSkill(g, id, next));
      return { what, now: as(now - from, from), next: as(up - now, now) };
    }),
  };
}

/** Every number the Equipment window shows, off the rules, for what you have on now. */
export function equipReport(g: Game): EquipReport {
  const perk = (k: string, o: number): number => g.perk(k, o);
  const { def, item } = inHand(g);
  const ranged = !!def.ammo;
  const struck = new Map(HIT_LOCATIONS);

  const slots: SlotView[] = SLOTS.map((slot) => {
    const it = g.worn(slot) ?? null;
    return {
      slot, name: SLOT_NAMES[slot], item: it, label: it ? itemName(it) : null, does: slotDoes(g, slot, it),
      wear: it ? Math.min(1, it.dmg / 100) : 0, struck: struck.get(slot) ?? null, soak: slotSoak(g, slot), tint: tintOf(it),
    };
  });

  // What could go on instead: everything in the pack that is worn or held and is not on, best first in its place.
  const shelf: ShelfView[] = [];
  for (const it of g.inventory.items) {
    const slot = slotOf(it.id);
    if (!slot || g.isEquipped(it.uid)) continue;
    const { delta, better } = deltaOf(g, it, slot);
    const why = slot === 'offhand' && g.twoHandedInHand() ? 'Both your hands are on your weapon.' : null;
    shelf.push({ item: it, slot, label: itemName(it), delta, better, why, wear: Math.min(1, it.dmg / 100), tint: tintOf(it) });
  }
  shelf.sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || b.item.ql - a.item.ql);

  // A blow: what it does, how long each takes and why, how often it lands and is critical, how far it reaches.
  const dealt = stanceDealt(g.settings.fightStance, perk);
  const dmg = weaponDamage(g, def, item) * dealt;
  const t = g.swingTime(def, item);
  const lands = hitChance(g, def, item);
  const crit = myCritChance(g, def);
  const mul = critMul(g, def);
  const perSec = (dmg * lands * (1 + crit * (mul - 1))) / Math.max(0.01, t.secs);
  const reach = ranged ? bowReach(g, def, item) : meleeReach(g);
  const arrow = ranged ? nockedArrow(g) : undefined;
  const offence: Stat[] = [
    { key: 'damage', label: 'Damage a blow', value: dmg, says: dmg.toFixed(1),
      note: dealt !== 1 ? `${(dmg / dealt).toFixed(1)}, ×${+dealt.toFixed(2)} in your ${FIGHT_STANCE_NAMES[g.settings.fightStance].toLowerCase()} stance.` : undefined },
    { key: 'swing', label: ranged ? 'A shot every' : 'A swing every', value: t.secs, says: `${t.secs.toFixed(2)} s`, note: swingNote(t) },
    { key: 'lands', label: 'Lands', value: lands, says: percent(lands) },
    { key: 'crit', label: 'Critical', value: crit, says: `${finePercent(crit)}, ×${+mul.toFixed(2)} as hard` },
    { key: 'reach', label: ranged ? 'Shoots' : 'Reaches', value: reach, says: `${+reach.toFixed(1)} tiles` },
    { key: 'dps', label: 'Damage a second', value: perSec, says: perSec.toFixed(2),
      note: `${dmg.toFixed(1)} × ${percent(lands)} landing × ${(1 + crit * (mul - 1)).toFixed(2)} for criticals ÷ ${t.secs.toFixed(2)} s.` },
  ];
  const weapon = {
    name: item ? itemName(item) : 'Your fists',
    kind: def.id === FIST.id ? 'Bare hands' : WEAPON_SKILL_NAMES[def.kind],
    skill: def.kind,
    ranged,
    blow: blowOf(def),
    side: sideOf(def),
    arrows: ranged ? (arrow ? `${itemName(arrow)} ×${g.inventory.count(arrow.id)}` : 'No arrows in your pack') : null,
  };

  // A blow taken: dodged, blocked, and turned aside where it lands; what is left of each kind.
  const kg = armourOnKg(g);
  const dodge = g.dodge();
  const shield = g.worn('offhand');
  const sh = shield && SHIELDS[shield.id];
  const block = sh && shield ? Math.min(1, blockChance(sh.block, shield.ql, g.skills.get('shields'), perk) + g.wornEnchant('block')) : 0;
  const taken = stanceTaken(g.settings.fightStance, perk);
  const covered = HIT_LOCATIONS.reduce((n, [slot, share]) => n + share * (slotSoak(g, slot) ?? 0), 0);
  const through = (Object.keys(WOUND_KINDS) as WoundKind[]).map((kind) => ({ kind, name: WOUND_KINDS[kind].name, share: g.expectedBlow(1, kind) }));
  const defence: Stat[] = [
    { key: 'armour', label: 'Armour turns aside', value: covered, says: `${percent(covered)} of a blow`,
      note: `Where a blow lands, by how often: ${HIT_LOCATIONS.map(([s, share]) => `${SLOT_NAMES[s].toLowerCase()} ${percent(share)}`).join(', ')}.` },
    { key: 'dodge', label: 'Dodges', value: dodge, says: finePercent(dodge),
      note: kg > 0 ? `Less ${finePercent(kg * DODGE_PER_KG)} for the ${kg.toFixed(1)} kg of armour on you.` : undefined },
    { key: 'block', label: 'Blocks', value: block, says: sh ? finePercent(block) : 'No shield',
      note: sh && shield ? blockNote(sh.block, shield.ql, g.skills.get('shields'), perk) : undefined },
    { key: 'taken', label: 'Stance', value: taken, says: `×${+taken.toFixed(2)} of every blow`, note: stanceSays(g.settings.fightStance) },
  ];
  const guard = g.wornEnchant('guard');
  if (guard > 0) defence.push({ key: 'guard', label: 'Enchanted', value: guard, says: `−${finePercent(guard)} of every blow` });

  // What it costs to carry.
  const { armour: swingBy, over } = g.swingBurden();
  const walk = g.burden();
  const burden: Stat[] = [
    { key: 'kg', label: 'Armour and shield', value: g.armourKg(), says: `${g.armourKg().toFixed(1)} kg`,
      note: `Counted at ${g.armourCounted().toFixed(1)} kg against a swing.` },
    { key: 'swingby', label: 'Each swing or draw', value: swingBy * over, says: `+${finePercent(swingBy * over - 1)} longer`,
      note: over > 1 ? `Of it, +${finePercent(over - 1)} for carrying more than your back takes.` : undefined },
    { key: 'walk', label: 'Walking and stamina', value: walk, says: `−${finePercent(walk)}` },
    { key: 'carried', label: 'All you have on weighs', value: 0,
      says: `${SLOTS.reduce((n, s) => n + (g.worn(s) ? itemWeight(g.worn(s) as Item) : 0), 0).toFixed(1)} kg` },
  ];

  // The skills behind it all, and what each is doing for you.
  const skill = (id: string): string => SKILL_BY_ID.get(id)?.name ?? id;
  const asPct = (d: number, base: number): string => pct(base > 0 ? d / base : 0);
  const asPts = (d: number): string => pts(d);
  const skills: SkillView[] = [];
  const kindSkill = def.kind;
  skills.push(skillView(g, kindSkill, WEAPON_SKILL_NAMES[kindSkill] ?? skill(kindSkill), `Rises as you fight with ${(WEAPON_SKILL_NAMES[kindSkill] ?? kindSkill).toLowerCase()}`, [
    { what: 'Damage', rule: (gg) => weaponDamage(gg, def, item), as: asPct },
    { what: 'Lands', rule: (gg) => hitChance(gg, def, item), as: asPts },
    { what: 'Critical', rule: (gg) => myCritChance(gg, def), as: asPts },
  ]));
  skills.push(skillView(g, 'fighting', skill('fighting'), 'Rises with every fight', [
    { what: 'Damage', rule: (gg) => weaponDamage(gg, def, item), as: asPct },
    { what: 'Lands', rule: (gg) => hitChance(gg, def, item), as: asPts },
  ]));
  skills.push(skillView(g, 'body_strength', skill('body_strength'), 'Rises with heavy work', [
    { what: 'Damage', rule: (gg) => weaponDamage(gg, def, item), as: asPct },
  ]));
  skills.push(skillView(g, 'body_control', skill('body_control'), 'Rises as you dodge and work with care', [
    { what: 'Lands', rule: (gg) => hitChance(gg, def, item), as: asPts },
    { what: 'Dodges', rule: (gg) => dodgeChance(gg.skills.get('body_control'), kg), as: asPts },
  ]));
  if (sh && shield) {
    skills.push(skillView(g, 'shields', skill('shields'), 'Rises as you block', [
      { what: 'Blocks', rule: (gg) => blockChance(sh.block, shield.ql, gg.skills.get('shields'), perk), as: asPts },
    ]));
  }
  // Each class of armour you have on, by the pieces of it you wear.
  const classes = new Set(SLOTS.map((s) => g.worn(s)).map((it) => it && ARMOUR_BY_ID.get(it.id)?.cls).filter((c): c is NonNullable<typeof c> => !!c));
  for (const cls of classes) {
    const id = ARMOUR_CLASSES[cls].skill;
    if (skills.some((s) => s.id === id)) continue;
    skills.push(skillView(g, id, skill(id), `Rises as you are struck in ${ARMOUR_CLASSES[cls].name.toLowerCase()}`, [
      { what: 'Turns aside', rule: (gg) => HIT_LOCATIONS.reduce((n, [slot, share]) => {
        const it = gg.worn(slot);
        const a = it && ARMOUR_BY_ID.get(it.id);
        return n + (it && a && ARMOUR_CLASSES[a.cls].skill === id ? share * Math.min(0.92, pieceSoak(a, it, gg.skills.get(id)) * gg.pathFx('hide', 1)) : 0);
      }, 0), as: asPts },
    ]));
  }

  const avgThrough = through.reduce((n, x) => n + x.share, 0) / through.length;
  const head: Stat[] = [
    { key: 'damage', label: 'A blow', value: dmg, says: dmg.toFixed(1) },
    { key: 'lands', label: 'Lands', value: lands, says: percent(lands) },
    { key: 'through', label: 'Gets through', value: avgThrough, says: percent(avgThrough) },
    { key: 'slowed', label: 'Swings slowed', value: swingBy * over - 1, says: `+${percent(swingBy * over - 1)}` },
  ];

  return {
    slots, shelf, weapon, offence, defence, through, burden, skills, head,
    stance: { now: g.settings.fightStance, all: FIGHT_STANCES.map((id) => ({ id, name: FIGHT_STANCE_NAMES[id], says: stanceSays(id) })) },
  };
}

/** Whether what was dragged may go into this place. */
export const fitsSlot = (id: string, slot: Slot): boolean => slotOf(id) === slot;

export { pieceBurden };
