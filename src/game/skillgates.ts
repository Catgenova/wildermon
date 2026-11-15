/**
 * Skill gates: the one rule for what a skill level opens.
 *
 * A thing has at most one gate, a skill and a level (`SkillGate`). Under it the thing is refused, for a person and for a
 * worker alike; at it, allowed. Every gate is held here, once, and the island has the same table (`skill_gate`, emitted
 * by `npm run defs` from `SKILL_GATES`), the same check (`skill_gate_refusal`) and the same words (`skillGateRefusal`):
 *
 *   "Willow: needs woodcutting 90; have 12.4."
 *
 * which is the form mining has always refused a seam in. A menu shows a gated action greyed with those words as its
 * hint (the context menu does that for any refusal); the Skills window lists each skill's gates, ticked or not
 * (`unlocksOf`, `unlocksSaid`); the help says them per skill off the same list.
 *
 * A worker uses the same gate against its own level in the gate's skill (`workerGateOpen`): it never picks the thing
 * its level could not work, and an idle one with only gated work in reach says so (`IdleWhy` 'gate', the island's
 * `gate_idle`).
 *
 * An item whose use a gate stops (a seed by its crop's farming, a sprout by its species' forestry) is unidentified to
 * whoever is under that gate: named "Unidentified seed" (`seenName`) and described only by what identifies it, "30
 * farming required to identify this seed." (`identifySaid`). Each kind of gate names its items (`GATE_ITEMS`), and the
 * island has them as `skill_gate_item`, so a new gate on an item makes it unidentified with nothing else written.
 *
 * Levels sit on `GATE_LADDER`, so gates land on few steps a player can learn. See docs/gating.md for the whole table.
 *
 * A leaf: game, UI, defs and tests read it.
 */
import { SKILL_BY_ID } from './skills';
import { TREE_DEFS, treeAge, treeSpecies } from '../world/tiles';
import { ITEM_DEFS, itemDef, itemName, type Item } from './items';

/** The steps a gate's level is chosen from. */
export const GATE_LADDER = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90] as const;
export type GateLevel = (typeof GATE_LADDER)[number];

/**
 * What sort of thing a gate is on, which with `id` keys it: a tree species by its lower-case name (`tree` for felling
 * it, `sprout` for its sprouts), a crop by its id (`crop`), a vehicle by its piece (`vehicle`).
 */
export type GateKind = 'tree' | 'sprout' | 'crop' | 'vehicle';

/** What a gate of each kind stops, as the help says it. */
export const GATE_STOPS: Readonly<Record<GateKind, string>> = {
  tree: 'felling a tree with logs: Cut down, Coppice, a feller\'s work',
  sprout: 'picking, planting and grafting the species\' sprouts; a sprout picker\'s and a planter\'s work',
  crop: 'sowing it: a field, a garden bed, a planter, a herb spiral; a farmer\'s and a planter tender\'s work',
  vehicle: 'taking the reins',
};

export interface SkillGate {
  kind: GateKind;
  /** The thing within its kind: a tree's or a crop's lower-case name, a vehicle's piece. */
  id: string;
  /** Its name as the game says it: "Willow", "Willow sprout", "Wemp", "Wagon". */
  name: string;
  skill: string;
  level: GateLevel;
}

/**
 * Felling a tree that has logs in it (Cut down, Coppice; a feller's work), by woodcutting. Asked for: pine least,
 * birch, oak and maple early, willow most; then birch at 1 and willow at 90. Oak and maple take the next two steps,
 * the rest by their wood's difficulty (`materials.ts`): 0-1 at 20, 2 at 30, 3 at 40, 4 at 50, 6 at 60. A tree with no
 * logs yet is cleared by anybody.
 */
export const TREE_GATE: Readonly<Record<string, GateLevel>> = {
  Pine: 1,
  Birch: 1,
  Oak: 5,
  Maple: 10,
  Fig: 20,
  Peach: 20,
  Cherry: 30,
  Lemon: 30,
  Apricot: 30,
  Apple: 40,
  Pear: 40,
  Plum: 40,
  Quince: 40,
  Cedar: 50,
  Pomegranate: 50,
  Olive: 60,
  Willow: 90,
};

/** One step down the ladder, or 1 at the bottom. */
export const stepBelow = (level: GateLevel): GateLevel => GATE_LADDER[Math.max(0, GATE_LADDER.indexOf(level) - 1)];

/**
 * A species' sprouts (picking, planting, grafting), by forestry: one ladder step under its felling gate, so a wood is
 * grown before it is felled.
 */
export const sproutLevel = (tree: string): GateLevel => stepBelow(TREE_GATE[tree]);

/**
 * Sowing a crop (a field, a garden bed, a planter, a herb spiral; a farmer's and a planter tender's work), by farming,
 * by crop id. Asked for. Harvesting what is in the ground is anybody's.
 */
export const CROP_GATE: Readonly<Record<string, GateLevel>> = {
  onion: 1,
  carrot: 1,
  potato: 1,
  cabbage: 5,
  wheat: 5,
  corn: 10,
  thyme: 10,
  cotton: 20,
  mint: 20,
  sage: 20,
  wemp: 30,
  basil: 30,
  rosemary: 40,
};

/** Taking the reins of a vehicle, by driving, by its piece. Asked for: a wagon at 30; a cart has none. */
export const VEHICLE_GATE: Readonly<Record<string, GateLevel>> = { wagon: 30 };

/**
 * Crafts whose level was named rather than read off their difficulty (docs/gating.md, the difficulty rule): the
 * smelter at masonry 1 (the Path's stone phase), the wagon at carpentry 70, the caravel at carpentry 90. For the
 * crafts' gates to read.
 */
export const CRAFT_GATE_SAID: Readonly<Record<string, { skill: string; level: GateLevel }>> = {
  smelter: { skill: 'masonry', level: 1 },
  wagon: { skill: 'carpentry', level: 70 },
  caravel: { skill: 'carpentry', level: 90 },
};

/** A crop's seed item: its id and `_seed` (`farming.ts`). */
export const cropSeed = (crop: string): string => `${crop}_seed`;

/** A crop as its gate names it, as `CROPS` names it: "Wemp". */
const cropName = (id: string): string => `${id.charAt(0).toUpperCase()}${id.slice(1)}`;

/** Every gate, in skill then level then name order. */
export const SKILL_GATES: readonly SkillGate[] = [
  ...TREE_DEFS.map((t): SkillGate => {
    const level = TREE_GATE[t.name];
    if (level === undefined) throw new Error(`${t.name}: no woodcutting gate`);
    return { kind: 'tree', id: t.name.toLowerCase(), name: t.name, skill: 'woodcutting', level };
  }),
  ...TREE_DEFS.map((t): SkillGate => ({ kind: 'sprout', id: t.name.toLowerCase(), name: `${t.name} sprout`, skill: 'forestry', level: sproutLevel(t.name) })),
  ...Object.entries(CROP_GATE).map(([id, level]): SkillGate => ({ kind: 'crop', id, name: cropName(id), skill: 'farming', level })),
  ...Object.entries(VEHICLE_GATE).map(([id, level]): SkillGate => ({ kind: 'vehicle', id, name: itemDef(id).name, skill: 'driving', level })),
].sort((a, b) => a.skill.localeCompare(b.skill) || a.level - b.level || a.name.localeCompare(b.name));

for (const g of SKILL_GATES) {
  if (!GATE_LADDER.includes(g.level)) throw new Error(`${g.kind} ${g.id}: ${g.level} is not on the ladder`);
  if (!SKILL_BY_ID.has(g.skill)) throw new Error(`${g.kind} ${g.id}: no skill ${g.skill}`);
}

const BY_KEY = new Map(SKILL_GATES.map((g) => [`${g.kind}:${g.id}`, g]));

/** The gate on a thing, or undefined: it is open to all. The island's `skill_gate`. */
export const gateOf = (kind: GateKind, id: string): SkillGate | undefined => BY_KEY.get(`${kind}:${id}`);

/** A skill as the refusal says it: "animal husbandry". */
export const skillWord = (skill: string): string => (SKILL_BY_ID.get(skill)?.name ?? skill.replace(/_/g, ' ')).toLowerCase();

/**
 * The one refusal: null at or over the level, else "Willow: needs woodcutting 90; have 12.4." The island's
 * `skill_gate_refusal`, word for word.
 */
export const skillGateRefusal = (name: string, skill: string, have: number, need: number): string | null =>
  have >= need ? null : `${name}: needs ${skillWord(skill)} ${need}; have ${have.toFixed(1)}.`;

/** A thing's refusal for somebody at `have` in its gate's skill (`haveOf`), or null for none. */
export const gatedFor = (kind: GateKind, id: string, haveOf: (skill: string) => number): string | null => {
  const g = gateOf(kind, id);
  return g ? skillGateRefusal(g.name, g.skill, haveOf(g.skill), g.level) : null;
};

/** The felling gate on a tree tile's data, or undefined for a tree with no logs in it: those anybody clears. */
export const treeGate = (data: number): SkillGate | undefined =>
  treeAge(data).logs > 0 ? gateOf('tree', TREE_DEFS[treeSpecies(data)].name.toLowerCase()) : undefined;

/** The sprout gate of a tree tile's species. The island's `sprout_gate`. */
export const sproutGate = (data: number): SkillGate | undefined => gateOf('sprout', TREE_DEFS[treeSpecies(data)].name.toLowerCase());

/** Whether somebody at `skill` in a gate's skill may work it: the same rule for a person and a worker. */
export const gateOpen = (g: SkillGate | undefined, skill: number): boolean => !g || skill >= g.level;

/** A worker's level in a skill: its own, 1 where it has none. */
export const workerLevel = (c: { skills: Record<string, number> }, skill: string): number => c.skills[skill] ?? 1;

/**
 * Whether a worker may work a gate: its own level in the gate's skill, not its trade's. A hod carrier fitting a plank
 * wall reads its carpentry. The island's `worker_gate_open`.
 */
export const workerGateOpen = (c: { skills: Record<string, number> }, g: SkillGate | undefined): boolean =>
  !g || workerLevel(c, g.skill) >= g.level;

/* ---- Items a gate stops the use of: unidentified under it -------------------------------------------------------- */

/** An item whose use a gate stops: its def, its `extra` where that tells which ("oak" for a sprout), the noun. */
export interface GatedItem {
  item: string;
  /** Lower case; '' where the def alone says it. */
  extra: string;
  gate: SkillGate;
  /** What an unidentified one is called: "seed". */
  noun: string;
}

/**
 * The items each kind of gate stops the use of. A seed is its crop's (`cropSeed`), unidentified as what its id says
 * it is (`wemp_seed`: "seed"); a sprout is the species' (`extra` the species), unidentified as the item's own name
 * ("sprout"). A kind with no entry gates no item. The island's `skill_gate_item`.
 */
export const GATE_ITEMS: Partial<Record<GateKind, (g: SkillGate) => Array<{ item: string; extra?: string; noun: string }>>> = {
  crop: (g) => [{ item: cropSeed(g.id), noun: cropSeed(g.id).slice(g.id.length + 1) }],
  sprout: (g) => [{ item: 'sprout', extra: g.id, noun: itemDef('sprout').name.toLowerCase() }],
};

/** Every gated item, in the table's order. */
export const GATED_ITEMS: readonly GatedItem[] = SKILL_GATES.flatMap((gate) =>
  (GATE_ITEMS[gate.kind]?.(gate) ?? []).map((x) => ({ item: x.item, extra: x.extra ?? '', gate, noun: x.noun })));

for (const x of GATED_ITEMS) if (!ITEM_DEFS[x.item]) throw new Error(`${x.gate.kind} ${x.gate.id}: no item ${x.item}`);

const ITEM_GATE = new Map(GATED_ITEMS.map((x) => [`${x.item}:${x.extra}`, x]));

/** The gate on an item's use, or undefined: anybody uses it. */
export const itemGate = (item: { id: string; extra?: string }): GatedItem | undefined =>
  ITEM_GATE.get(`${item.id}:${(item.extra ?? '').toLowerCase()}`) ?? ITEM_GATE.get(`${item.id}:`);

/** Whoever looks at an item, with their skills read the way the game reads them. A `Game` is one. */
export interface Viewer {
  skills: { get(id: string): number };
}

/** The gate an item is unidentified under for `viewer`, or undefined: it knows the thing. */
export const unidentified = (item: { id: string; extra?: string }, viewer: Viewer): GatedItem | undefined => {
  const x = itemGate(item);
  return x && viewer.skills.get(x.gate.skill) < x.gate.level ? x : undefined;
};

/**
 * An item's name as `viewer` sees it: "Unidentified seed" under its gate, its own name (`itemName`) at it. Every name
 * of an item put in front of a person goes through this. The island's `seen_name`.
 */
export const seenName = (item: Pick<Item, 'id'> & Partial<Item>, viewer: Viewer): string => {
  const x = unidentified(item, viewer);
  return x ? `Unidentified ${x.noun}` : itemName({ uid: 0, ql: 0, dmg: 0, count: 1, ...item });
};

/**
 * An item def's name as `viewer` sees it, where a line names the def rather than one of it: "Unidentified seed" under
 * its gate, its def's name ("Wemp seeds") at it. The island's `seen_name` of a def.
 */
export const seenDefName = (id: string, viewer: Viewer, extra?: string): string => {
  const x = unidentified({ id, extra }, viewer);
  return x ? `Unidentified ${x.noun}` : itemDef(id).name;
};

/**
 * What an unidentified item says of itself, as its tooltip and its examine: "30 farming required to identify this
 * seed." Null for one `viewer` knows. The island's `identify_said`.
 */
export const identifySaid = (item: { id: string; extra?: string }, viewer: Viewer): string | null => {
  const x = unidentified(item, viewer);
  return x ? `${x.gate.level} ${skillWord(x.gate.skill)} required to identify this ${x.noun}.` : null;
};

/**
 * Using an item under its gate: "Unidentified seed: needs farming 30; have 20.0.", named as `viewer` sees it. Null
 * for an item with no gate, or one it meets. The island's `item_gate_refusal`.
 */
export const itemGateRefusal = (item: { id: string; extra?: string }, viewer: Viewer): string | null => {
  const x = itemGate(item);
  return x ? skillGateRefusal(seenName(item, viewer), x.gate.skill, viewer.skills.get(x.gate.skill), x.gate.level) : null;
};

/** Whether a worker may use an item, at its own level in the gate's skill (`workerGateOpen`). The island's `worker_item_open`. */
export const workerItemOpen = (c: { skills: Record<string, number> }, item: { id: string; extra?: string }): boolean =>
  workerGateOpen(c, itemGate(item)?.gate);

/* ---- What a skill opens, for the Skills window and the help ----------------------------------------------------- */

/** One gate on a skill as the Skills window lists it: met or not at a level. */
export interface Unlock {
  name: string;
  level: number;
  met: boolean;
}

/** A skill's gates in level order, each met or not at `have`. */
export const unlocksOf = (skill: string, have: number): Unlock[] =>
  SKILL_GATES.filter((g) => g.skill === skill).map((g) => ({ name: g.name, level: g.level, met: have >= g.level }));

/** Whether a skill has any gate on it. */
export const hasUnlocks = (skill: string): boolean => SKILL_GATES.some((g) => g.skill === skill);

/** The next of a skill's gates: "Next: Oak at 5 (yours 1.0)", or null with every one met. */
export const nextUnlockSaid = (skill: string, have: number): string | null => {
  const next = unlocksOf(skill, have).find((u) => !u.met);
  return next ? `Next: ${next.name} at ${next.level} (yours ${have.toFixed(1)})` : null;
};

/** A skill's gates grouped by level, for the help: "Birch and Pine 1; Oak 5; Maple 10; Fig and Peach 20". */
export const unlocksSaid = (skill: string): string => {
  const rungs = new Map<number, string[]>();
  for (const g of SKILL_GATES.filter((x) => x.skill === skill)) rungs.set(g.level, [...(rungs.get(g.level) ?? []), g.name]);
  const and = (xs: string[]): string => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
  return [...rungs].map(([level, names]) => `${and(names)} ${level}`).join('; ');
};

/** The skills with gates, in the order the Skills window lists skills. */
export const GATED_SKILLS: readonly string[] = [...new Set(SKILL_GATES.map((g) => g.skill))];
