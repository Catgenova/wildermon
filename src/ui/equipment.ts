/**
 * What the Equipment window shows: what you have on in each place, what you
 * could put on instead and what it would change, and every number the fight
 * reads off you, each from the rule the fight itself uses -- `weaponDamage`,
 * `hitChance`, `myCritChance` and `Game.swingTime` for a blow; `pieceSoak`,
 * `blockChance`, `dodgeChance` and `Game.expectedBlow` for one taken;
 * `Game.burden` and `Game.swingBurden` for what it all costs to carry.
 * Nothing here is a rule of its own: the window says what the fight would do,
 * in your hands today.
 *
 * What a thing on the shelf would change is the same rules asked again with
 * it on in its place; what each skill does for you is the same rules asked
 * again with that skill at where it starts and at its next level. So neither
 * can drift from the fight.
 */
import { ARMOUR_BY_ID, ARMOUR_CLASSES, HIT_LOCATIONS, hitChance, pieceSoak, SHIELDS, SLOT_NAMES, SLOTS, slotOf, WEAPON_BY_ID,
  WEAPON_SKILL_NAMES, weaponDamage, type Slot, type WeaponDef } from '../game/gear';
import { ARMOUR_SWING_BY, BLOCK_PER_SKILL, blockChance, blockQl, blowOf, bowReach, critMul, DODGE_FROM, DODGE_PER_CONTROL, DODGE_PER_KG, dodgeChance,
  FIGHT_STANCE_NAMES, FIGHT_STANCES, FIST, HIDE_NAMES, HIDE_TAKES, HIDES, meleeReach, myCritChance, nockedArrow, SHIELD_SWING_BY, SHIELD_WEAR, sideOf,
  stanceDealt, stanceSays, stanceTaken, swungWith, type FightStance } from '../game/fight';
import { BELT_MAX, QL_PER_LOOP } from '../game/belt';
import type { Game } from '../game/game';
import { JEWEL_BONUS, stonesOf, tradeName } from '../game/gems';
import { itemDef, itemName, itemWeight, unitWeight, type Item } from '../game/items';
import { matOf } from '../game/materials';
import { SKILL_BY_ID } from '../game/skills';
import { WOUND_KINDS, type WoundKind } from '../game/wounds';
import { METAL_TONE, WOOD_TONE } from '../render/materials';

/** A share as the window says it: one place, two under one in a hundred so a small one does not read as none. */
export const pc = (x: number): string => `${(x * 100).toFixed(Math.abs(x) < 0.01 && x !== 0 ? 2 : 1)}%`;
/** A change in a share, signed. */
const dpc = (d: number): string => `${d >= 0 ? '+' : '−'}${pc(Math.abs(d))}`;

/** One place on the body, and what is in it. */
export interface SlotView {
  slot: Slot;
  name: string;
  item: Item | null;
  /** "Iron sword", or null for an empty place. */
  label: string | null;
  /** What it does in this place, with its number: "Turns aside 20.4% of a blow here". */
  does: string | null;
  /** How worn it is, 0 (new) to 1 (falling apart), as `item.dmg` of 100. */
  wear: number;
  /** For a place a blow lands on: how often one lands there, 0..1. */
  struck: number | null;
  /** What a blow there loses to what is worn there, 0..1, or null for nothing worn. */
  soak: number | null;
  /** A colour for the piece's material, `#rrggbb`, or null. */
  tint: string | null;
  /** How worn it is and what that costs it, by the rule that reads the wear: "worn 38%: turns ×0.71 of what it turned new". */
  wearSays: string | null;
  /**
   * Whether the pack holds something that does more here, by its shelf card's main line: 'up' when nothing
   * else it moves is for the worse, 'trade' when something is, or null.
   */
  upgrade: 'up' | 'trade' | null;
  /** For a place something better is waiting: what it is, and what it costs, said once for its tooltip. */
  upgradeSays: string | null;
}

/** One thing a change does, and whether for the better: "through −1.7%". */
export interface Effect { text: string; better: boolean }

/** A thing in the pack that could be put on, with what it would change. */
export interface ShelfView {
  item: Item;
  slot: Slot;
  label: string;
  /** What it does in its place, against what is there now: "20.4% → 38.9% turned". */
  main: Effect | null;
  /** How much better the main line gets, for putting the best first: a blow's share more, or the share of a blow more turned or blocked. */
  gain: number;
  /**
   * What it comes to: 'up' does more in its place with nothing else in a fight the worse, 'trade' does more but costs
   * something a fight reads (more gets through, lands less, the shield off), 'down' does less.
   */
  verdict: 'up' | 'trade' | 'down';
  /** And what else it moves, each said once and signed: "gets through −1.7%", "swings +0.5%", "+1.8 kg". */
  effects: Effect[];
  /** Why it cannot go on now, or null. */
  why: string | null;
  /** What it weighs. */
  kg: number;
  wear: number;
  tint: string | null;
}

/** A number with what it is and, where it came from more than one thing, the things it came from. */
export interface Stat {
  key: string;
  label: string;
  value: number;
  /** As it reads: "62.0%", "2.40 s". */
  says: string;
  /** How it came to that, a line each: "2.40 s its own", "×0.87 fighting 18". */
  lines?: string[];
}

/** A step of a blow on its way to you: what took its share off, and how much of the blow is left after it. */
export interface Step { what: string; took: string; left: number }

/** A skill the fight reads, how far along, and what it is doing for you now and at its next level. */
export interface SkillView {
  id: string;
  name: string;
  level: number;
  /** How far to the next whole level, 0..1. */
  toNext: number;
  /** For each number it moves: where it starts → where it is now, and what the next level makes it. */
  gives: Array<{ what: string; now: string; next: string | null }>;
}

export interface EquipReport {
  slots: SlotView[];
  shelf: ShelfView[];
  /** What is swung or drawn, and what with. */
  weapon: { name: string; kind: string; ranged: boolean; blow: string; hides: string; side: string | null; arrows: string | null };
  offence: Stat[];
  /** A blow taken, step by step: your stance, your dodge, your shield, your armour, and what is left. */
  chain: Step[];
  defence: Stat[];
  /** Of a blow of each kind, the share that gets through to you. */
  through: Array<{ kind: WoundKind; name: string; share: number }>;
  burden: Stat[];
  stance: { now: FightStance; all: Array<{ id: FightStance; name: string; says: string; dealt: number; taken: number }> };
  skills: SkillView[];
  /** The four up top: what a blow does, how often it lands, how much of one taken gets through, and how much you are slowed. */
  head: Stat[];
}

/** What a place on the body is for, when nothing is in it. */
export const EMPTY_SAYS: Record<Slot, string> = {
  head: 'Empty', chest: 'Empty', arms: 'Empty', legs: 'Empty',
  feet: 'Empty', weapon: 'Fists', offhand: 'Empty', belt: 'No belt: 0 action loops',
  jewel: 'Empty',
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

/** The material's colour, for the picture of a piece. */
const tintOf = (it: Item | null | undefined): string | null => {
  if (!it?.extra) return null;
  const id = matOf(it.extra).id;
  const metal = METAL_TONE[id];
  if (metal) return `#${metal.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  return WOOD_TONE[id] ?? null;
};

/** A shield's chance in your hands, and a Bulwark's points on top (`Game.absorb`). */
const blockOf = (g: Game, it: Item): number => {
  const sh = SHIELDS[it.id];
  return sh ? Math.min(1, blockChance(sh.block, it.ql, g.skills.get('shields'), (k, o) => g.perk(k, o)) + g.wornEnchant('block')) : 0;
};

/** What a piece does where it is, with its number. */
function slotDoes(g: Game, slot: Slot, it: Item | null): string | null {
  const loops = `1 action loop per ${QL_PER_LOOP} QL, max ${BELT_MAX}`;
  const jewel = `stone in a ring or pendant: skill gain +${+(JEWEL_BONUS * 100).toFixed(1)}% on its skill`;
  if (!it && slot === 'offhand' && g.twoHandedInHand()) return `In use: two-handed ${itemName(g.worn('weapon') as Item).toLowerCase()}`;
  if (!it) return slot === 'belt' ? `No combat effect; belt: ${loops}` : slot === 'jewel' ? `No combat effect; ${jewel}` : null;
  if (ARMOUR_BY_ID.get(it.id)) return `Damage stopped here: ${pc(slotSoak(g, slot) ?? 0)}`;
  const w = WEAPON_BY_ID.get(it.id);
  if (w) return `Damage ${weaponDamage(g, w, it).toFixed(1)}, hit chance ${pc(hitChance(g, w, it))}`;
  if (SHIELDS[it.id]) return `Block chance ${pc(blockOf(g, it))}`;
  if (slot === 'belt') return `Action loops ${g.beltLoops()} (${loops}); no combat effect`;
  const stones = stonesOf(it);
  if (slot === 'jewel') return stones.length ? `Skill gain +${+(JEWEL_BONUS * 100).toFixed(1)}%: ${stones.map((x) => tradeName(x.skill)).join(', ')}; no combat effect` : 'No stone set';
  return itemDef(it.id).name;
}

/** What of each family's weight counts against a swing, for the families worn: "leather ×0.5 · chain ×1 · shield ×1". */
function shares(g: Game): string {
  const seen = new Map<string, number>();
  for (const slot of SLOTS) {
    const it = g.worn(slot);
    const a = it && ARMOUR_BY_ID.get(it.id);
    if (a) seen.set(a.cls, ARMOUR_SWING_BY[a.cls]);
    else if (it && slot === 'offhand' && SHIELDS[it.id]) seen.set('shield', SHIELD_SWING_BY);
  }
  return [...seen].map(([k, by]) => `${k} ×${+by.toFixed(2)}`).join(' · ');
}

/** How worn a thing is, and what the wear takes off it, asked of the rule with the wear and without it. */
function wearOf(g: Game, it: Item | null): string | null {
  if (!it) return null;
  const n = `worn ${Math.round(Math.min(100, it.dmg))}%`;
  const fresh = { ...it, dmg: 0 };
  const a = ARMOUR_BY_ID.get(it.id);
  if (a) {
    const sk = g.skills.get(ARMOUR_CLASSES[a.cls].skill);
    return `${n}: turns ×${(pieceSoak(a, it, sk) / Math.max(1e-9, pieceSoak(a, fresh, sk))).toFixed(2)} of what it turned new`;
  }
  const w = WEAPON_BY_ID.get(it.id);
  if (w) return `${n}: hits ×${(weaponDamage(g, w, it) / Math.max(1e-9, weaponDamage(g, w, fresh))).toFixed(2)} as hard as new`;
  return n;
}

/** What is swung or drawn now: the weapon in hand, a bow drawn, or fists. */
function inHand(g: Game): { def: WeaponDef; item: Item | null } {
  const held = g.worn('weapon');
  const def = held && WEAPON_BY_ID.get(held.id);
  return def ? { def, item: held ?? null } : swungWith(g);
}

/** The few numbers a change is judged by, off the rules, for what is on now. */
interface Heads { damage: number; lands: number; through: number; slowed: number; kg: number; soak: Map<Slot, number | null>; block: number }

const KINDS = Object.keys(WOUND_KINDS) as WoundKind[];

function heads(g: Game): Heads {
  const { def, item } = inHand(g);
  const { armour, over } = g.swingBurden();
  const shield = g.worn('offhand');
  return {
    damage: weaponDamage(g, def, item) * stanceDealt(g.settings.fightStance, (k, o) => g.perk(k, o)),
    lands: hitChance(g, def, item),
    through: KINDS.reduce((n, k) => n + g.expectedBlow(1, k), 0) / KINDS.length,
    slowed: armour * over - 1,
    kg: SLOTS.reduce((n, s) => n + (g.worn(s) ? itemWeight(g.worn(s) as Item) : 0), 0),
    soak: new Map(HIT_LOCATIONS.map(([s]) => [s, slotSoak(g, s)])),
    block: shield ? blockOf(g, shield) : 0,
  };
}

/** The same numbers with a thing put on in its place, and anything it pushes off (a two-handed weapon the shield); put back after. */
function headsWith(g: Game, it: Item, slot: Slot): Heads {
  const eq = g.player.equipped;
  const was = { ...eq };
  eq[slot] = it.uid;
  if (slot === 'weapon' && WEAPON_BY_ID.get(it.id)?.twoHanded) eq.offhand = null;
  try {
    return heads(g);
  } finally {
    for (const s of SLOTS) eq[s] = was[s] ?? null;
  }
}

/** What putting a thing on would change: what it does in its place, and the rest of what moves, each signed and judged. */
function changeOf(g: Game, now: Heads, it: Item, slot: Slot): { main: Effect | null; gain: number; effects: Effect[] } {
  const then = headsWith(g, it, slot);
  const effects: Effect[] = [];
  let main: Effect | null = null;
  let gain = 0;
  const tiny = (d: number): boolean => Math.abs(d) < 5e-4;
  if (WEAPON_BY_ID.get(it.id)) {
    main = { text: `A blow ${now.damage.toFixed(1)} → ${then.damage.toFixed(1)} damage`, better: then.damage >= now.damage };
    gain = (then.damage - now.damage) / Math.max(0.1, now.damage);
    if (!tiny(then.lands - now.lands)) effects.push({ text: `lands ${dpc(then.lands - now.lands)}`, better: then.lands > now.lands });
  } else if (ARMOUR_BY_ID.get(it.id)) {
    const a = now.soak.get(slot) ?? 0, b = then.soak.get(slot) ?? 0;
    // Onto a bare place, just what it turns; over something, from what that turns.
    main = { text: now.soak.get(slot) == null ? `${pc(b)} turned` : `${pc(a)} → ${pc(b)} turned`, better: b >= a };
    gain = b - a;
  } else if (SHIELDS[it.id]) {
    main = { text: `Blocks ${pc(now.block)} → ${pc(then.block)}`, better: then.block >= now.block };
    gain = then.block - now.block;
  }
  if (!tiny(then.through - now.through)) effects.push({ text: `through ${dpc(then.through - now.through)}`, better: then.through < now.through });
  if (WEAPON_BY_ID.get(it.id)?.twoHanded && g.worn('offhand')) effects.push({ text: 'two-handed: shield off', better: false });
  if (!tiny(then.slowed - now.slowed)) effects.push({ text: `swing ${dpc(then.slowed - now.slowed)}`, better: then.slowed < now.slowed });
  return { main, gain, effects };
}

/** A skill's line: for each number it moves, where it starts → where it is, and what the next level makes it; a number it does not move is left out. */
function skillView(g: Game, id: string, name: string, rules: Array<{ what: string; rule: (gg: Game) => number; say: (v: number) => string }>): SkillView {
  const level = g.skills.get(id);
  const start = SKILL_BY_ID.get(id)?.start ?? 0;
  const next = Math.floor(level) + 1;
  const gives: SkillView['gives'] = [];
  for (const { what, rule, say } of rules) {
    const now = rule(g), from = rule(withSkill(g, id, start)), up = rule(withSkill(g, id, next));
    const moved = say(from) !== say(now), more = say(up) !== say(now);
    if (!moved && !more) continue;
    gives.push({ what, now: moved ? `${say(from)} → ${say(now)}` : say(now), next: more ? `${say(up)} at ${next}` : null });
  }
  return { id, name, level, toNext: level - Math.floor(level), gives };
}

/** Every number the Equipment window shows, off the rules, for what you have on now. */
export function equipReport(g: Game): EquipReport {
  const perk = (k: string, o: number): number => g.perk(k, o);
  const { def, item } = inHand(g);
  const ranged = !!def.ammo;
  const struck = new Map(HIT_LOCATIONS);
  const now = heads(g);

  const slots: SlotView[] = SLOTS.map((slot) => {
    const it = g.worn(slot) ?? null;
    return {
      slot, name: SLOT_NAMES[slot], item: it, label: it ? itemName(it) : null, does: slotDoes(g, slot, it),
      wear: it ? Math.min(1, it.dmg / 100) : 0, struck: struck.get(slot) ?? null, soak: slotSoak(g, slot), tint: tintOf(it),
      wearSays: wearOf(g, it), upgrade: null, upgradeSays: null,
    };
  });

  // What could go on instead: everything in the pack that is worn or held and is not on, by place and best first.
  const shelf: ShelfView[] = [];
  for (const it of g.inventory.items) {
    const slot = slotOf(it.id);
    if (!slot || g.isEquipped(it.uid)) continue;
    const why = slot === 'offhand' && g.twoHandedInHand() ? 'Off hand in use: two-handed weapon.' : null;
    const change = changeOf(g, now, it, slot);
    // A slower swing alone is named but does not make a trade: nearly every piece costs some.
    const costs = change.effects.some((e) => !e.better && !e.text.startsWith('swing'));
    const verdict = change.gain <= 5e-4 ? 'down' : costs ? 'trade' : 'up';
    shelf.push({ item: it, slot, label: itemName(it), ...change, verdict, why, kg: unitWeight(it), wear: Math.min(1, it.dmg / 100), tint: tintOf(it) });
  }
  // Clean upgrades first, then trades, then the rest; within each, what does most for its place first.
  const rank = { up: 0, trade: 1, down: 2 } as const;
  shelf.sort((a, b) => Number(!!a.why) - Number(!!b.why) || rank[a.verdict] - rank[b.verdict] || b.gain - a.gain || SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || b.item.ql - a.item.ql);
  for (const v of slots) {
    // The best for this place, by what it does there; a trade if anything else it moves is for the worse.
    const best = shelf.find((s) => s.slot === v.slot && !s.why && s.verdict !== 'down');
    if (!best) continue;
    const worse = best.effects.filter((e) => !e.better);
    v.upgrade = best.verdict === 'up' ? 'up' : 'trade';
    v.upgradeSays = `Better in pack: ${best.label}, ${best.main?.text ?? ''}${worse.length ? `; worse: ${worse.map((e) => e.text).join(', ')}` : ''}`;
  }

  // A blow: what it does, how long each takes and why, how often it lands and is critical, how far it reaches.
  const dealt = stanceDealt(g.settings.fightStance, perk);
  const t = g.swingTime(def, item);
  const lands = now.lands;
  const crit = myCritChance(g, def);
  const mul = critMul(g, def);
  const perSec = (now.damage * lands * (1 + crit * (mul - 1))) / Math.max(0.01, t.secs);
  const reach = ranged ? bowReach(g, def, item) : meleeReach(g);
  const arrow = ranged ? nockedArrow(g) : undefined;
  const offence: Stat[] = [
    { key: 'damage', label: 'Damage per blow', value: now.damage, says: `${now.damage.toFixed(1)} damage`,
      lines: dealt !== 1 ? [`${(now.damage / dealt).toFixed(1)} damage from the weapon in your hands`, `×${+dealt.toFixed(2)} ${FIGHT_STANCE_NAMES[g.settings.fightStance].toLowerCase()} stance`] : undefined },
    { key: 'swing', label: ranged ? 'Shot time' : 'Swing time', value: t.secs, says: `${t.secs.toFixed(2)} s`,
      lines: [`${t.own.toFixed(2)} s its own`, ...t.parts.flatMap((p) => p.what.startsWith('armour ')
        ? [`×${p.by.toFixed(3)} armour and shield, ${g.armourKg().toFixed(1)} kg worn, counted as ${g.armourCounted().toFixed(1)} kg (${shares(g)})`]
        : [`×${p.by.toFixed(3)} ${p.what}`]), ...(t.floored ? ['never quicker than the floor'] : [])] },
    { key: 'lands', label: 'Lands', value: lands, says: pc(lands) },
    { key: 'crit', label: 'Critical', value: crit, says: `${pc(crit)}, ×${+mul.toFixed(2)} as hard` },
    { key: 'reach', label: ranged ? 'Shoots' : 'Reaches', value: reach, says: `${+reach.toFixed(1)} tiles` },
    { key: 'dps', label: 'Damage per second', value: perSec, says: `${perSec.toFixed(2)} damage/s`,
      lines: [`${now.damage.toFixed(1)} damage a blow × ${pc(lands)} landing`, `× ${(1 + crit * (mul - 1)).toFixed(3)} for criticals`, `÷ ${t.secs.toFixed(2)} s a swing`] },
  ];
  const blow = blowOf(def);
  const weapon = {
    name: item ? itemName(item) : 'Fists',
    kind: def.id === FIST.id ? 'Bare hands' : WEAPON_SKILL_NAMES[def.kind],
    ranged,
    blow,
    hides: HIDES.map((h) => `${HIDE_NAMES[h].toLowerCase()} ×${HIDE_TAKES[h][blow]}`).join(' · '),
    side: sideOf(def),
    arrows: ranged ? (arrow ? `${itemName(arrow)}: ${g.inventory.count(arrow.id)} in pack` : 'No arrows in pack') : null,
  };

  // A blow taken, step by step: the stance, the dodge, the shield, and the armour where it lands.
  const kg = armourOnKg(g);
  const dodge = g.dodge();
  const shield = g.worn('offhand');
  const sh = shield && SHIELDS[shield.id];
  const block = now.block;
  const taken = stanceTaken(g.settings.fightStance, perk);
  const guard = g.wornEnchant('guard');
  const afterStance = taken, afterDodge = afterStance * (1 - dodge), afterBlock = afterDodge * (1 - block), afterGuard = afterBlock * (1 - guard);
  // Each step says how much of the whole blow it takes off, so the steps add up to what is left.
  const steps: Array<{ what: string; left: number }> = [
    ...(taken !== 1 ? [{ what: `${FIGHT_STANCE_NAMES[g.settings.fightStance]} stance`, left: afterStance }] : []),
    { what: 'Dodge', left: afterDodge },
    { what: sh ? 'Shield' : 'No shield', left: afterBlock },
    ...(guard > 0 ? [{ what: 'Enchanted', left: afterGuard }] : []),
    { what: 'Armour', left: now.through },
  ];
  const chain: Step[] = [{ what: 'A blow', took: '', left: 1 }];
  for (const st of steps) {
    const d = chain[chain.length - 1].left - st.left;
    chain.push({ ...st, took: Math.abs(d) < 5e-5 ? 'none' : `${d > 0 ? '−' : '+'}${pc(Math.abs(d))}` });
  }
  const control = g.skills.get('body_control');
  const blockLines = sh && shield ? [
    `${pc(sh.block)} its own × ${+blockQl(shield.ql).toFixed(3)} for QL ${shield.ql.toFixed(0)}`,
    `+ ${pc(g.skills.get('shields') * BLOCK_PER_SKILL)} for shields ${g.skills.get('shields').toFixed(1)}`,
    ...(perk('block:shield', 0) ? [`+ ${pc(perk('block:shield', 0))} for your perks`] : []),
    `max ${pc(perk('blockcap:shield', 0.6))}; checked after dodge`,
    `shield wear per block: ${SHIELD_WEAR} damage per whole health blocked`,
  ] : undefined;
  const defence: Stat[] = [
    { key: 'dodge', label: 'Dodges', value: dodge, says: pc(dodge),
      lines: [`${pc(Math.max(0, (control - DODGE_FROM) * DODGE_PER_CONTROL))} for body control ${control.toFixed(1)}`,
        `− ${pc(kg * DODGE_PER_KG)} for ${kg.toFixed(1)} kg of armour (shield excluded)`, `range 0% to ${pc(dodgeChance(1e9, 0))}`] },
    { key: 'block', label: 'Blocks', value: block, says: sh ? pc(block) : 'No shield', lines: blockLines },
  ];
  const through = KINDS.map((kind) => ({ kind, name: WOUND_KINDS[kind].name, share: g.expectedBlow(1, kind) }));

  // What it costs to carry.
  const { armour: swingBy, over } = g.swingBurden();
  const walk = g.burden();
  const burden: Stat[] = [
    { key: 'kg', label: 'Total worn weight', value: now.kg, says: `${now.kg.toFixed(1)} kg`,
      lines: [`armour and shield: ${g.armourKg().toFixed(1)} kg`, `armour (counts for dodge): ${kg.toFixed(1)} kg`] },
    { key: 'swingby', label: 'Swing or draw time', value: swingBy * over, says: `+${pc(swingBy * over - 1)}`,
      lines: [`armour and shield counted: ${g.armourCounted().toFixed(1)} kg (each family a % of its weight)`,
        ...(over > 1 ? [`+${pc(over - 1)} from overload`] : [])] },
    { key: 'walk', label: 'Walk speed and stamina', value: walk, says: `−${pc(walk)}` },
  ];

  // The skills behind it all, and what each is doing for you.
  const skill = (id: string): string => SKILL_BY_ID.get(id)?.name ?? id;
  const one = (v: number): string => `${v.toFixed(1)} damage`;
  const skills: SkillView[] = [];
  skills.push(skillView(g, def.kind, WEAPON_SKILL_NAMES[def.kind] ?? skill(def.kind), [
    { what: 'A blow', rule: (gg) => weaponDamage(gg, def, item) * dealt, say: one },
    { what: 'Lands', rule: (gg) => hitChance(gg, def, item), say: pc },
    { what: 'Critical', rule: (gg) => myCritChance(gg, def), say: pc },
  ]));
  skills.push(skillView(g, 'fighting', skill('fighting'), [
    { what: 'A blow', rule: (gg) => weaponDamage(gg, def, item) * dealt, say: one },
    { what: 'Lands', rule: (gg) => hitChance(gg, def, item), say: pc },
  ]));
  skills.push(skillView(g, 'body_strength', skill('body_strength'), [
    { what: 'A blow', rule: (gg) => weaponDamage(gg, def, item) * dealt, say: one },
  ]));
  skills.push(skillView(g, 'body_control', skill('body_control'), [
    { what: 'Lands', rule: (gg) => hitChance(gg, def, item), say: pc },
    { what: 'Dodges', rule: (gg) => dodgeChance(gg.skills.get('body_control'), kg), say: pc },
  ]));
  if (sh && shield) {
    skills.push(skillView(g, 'shields', skill('shields'), [
      { what: 'Blocks', rule: (gg) => blockChance(sh.block, shield.ql, gg.skills.get('shields'), perk), say: pc },
    ]));
  }
  // Each class of armour you have on, by what the pieces of it turn aside where they are.
  const classes = new Set(SLOTS.map((s) => g.worn(s)).map((it) => it && ARMOUR_BY_ID.get(it.id)?.cls).filter((c): c is NonNullable<typeof c> => !!c));
  for (const cls of classes) {
    const id = ARMOUR_CLASSES[cls].skill;
    if (skills.some((s) => s.id === id)) continue;
    const where = HIT_LOCATIONS.filter(([slot]) => {
      const it = g.worn(slot);
      const a = it && ARMOUR_BY_ID.get(it.id);
      return !!a && ARMOUR_CLASSES[a.cls].skill === id;
    }).map(([slot]) => slot);
    skills.push(skillView(g, id, skill(id), where.map((slot) => ({
      what: `${SLOT_NAMES[slot]} turns`,
      rule: (gg: Game): number => {
        const it = gg.worn(slot);
        const a = it && ARMOUR_BY_ID.get(it.id);
        return it && a ? Math.min(0.92, pieceSoak(a, it, gg.skills.get(id)) * gg.pathFx('hide', 1)) : 0;
      },
      say: pc,
    }))));
  }

  const head: Stat[] = [
    { key: 'damage', label: 'A blow', value: now.damage, says: now.damage.toFixed(1) },
    { key: 'lands', label: 'Lands', value: lands, says: pc(lands) },
    { key: 'through', label: 'Damage taken', value: now.through, says: pc(now.through) },
    { key: 'slowed', label: 'Swing time', value: now.slowed, says: `+${pc(now.slowed)}` },
  ];

  return {
    slots, shelf, weapon, offence, chain, defence, through, burden, skills, head,
    stance: {
      now: g.settings.fightStance,
      all: FIGHT_STANCES.map((id) => ({ id, name: FIGHT_STANCE_NAMES[id], says: stanceSays(id), dealt: stanceDealt(id, perk), taken: stanceTaken(id, perk) })),
    },
  };
}

/** Whether what was dragged may go into this place. */
export const fitsSlot = (id: string, slot: Slot): boolean => slotOf(id) === slot;
