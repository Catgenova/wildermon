/**
 * Skill gates on what is made, restored and built (docs/gating.md, batch C): every crafting recipe, a relic's and a
 * bauble's restoring, a building material, a wall type, a floor type and a paving. Their things live in modules that
 * are not leaves, so their rows are added to the one table here, at load (`addGates`); `skillgates.ts` holds the rule,
 * the words and the readers, and the island has the same rows in `skill_gate`.
 *
 * Levels, in the ladder's order of choosing:
 *
 *   * a recipe by its difficulty (`craftLevel`): the ladder step at or below 2 × (difficulty − 6), 1 for none, so the
 *     whole craft table moves with the numbers players already see; but for the ones named (`CRAFT_GATE_SAID`: the
 *     smelter at masonry 1, the wagon at carpentry 70, the caravel at 90) and a Formula's scroll, by what it goes on
 *     (`FORMULA_GATE`);
 *   * a relic and a bauble tier by its restoring difficulty, the same rule;
 *   * a material, a wall type, a floor type and a paving by tier, the cheapest at 1 (`MATERIAL_GATE`, `WALL_GATE`,
 *     `FLOOR_GATE`, `PAVING_GATE`);
 *   * pouring a metal by its seam's mining gate (iron at 1, `POUR_GATE_SAID`), an alloy by the recipe that mixes it (`METAL_GATE`); anything of obsidian at 99 (`OBSIDIAN_LEVEL`). A wall type's and a floor type's gate is in its material's skill: carpentry for
 *     timber, masonry for stone, a row each; a wall or a floor needs both its material's gate and its type's.
 *
 *   * batch F: grafting (forestry 50) and a listed cross (animal husbandry 50) as they were; a water plant (lily 10,
 *     lotus 20); a treasure map by its tier (`MAP_GATE_PER_TIER`); a bridge by its material's gate or its difficulty;
 *     smelting an ore and working a casting by the metal (`METAL_GATE`, the one table pouring reads); a stone set in a
 *     circlet by its rarity; a spell at its level.
 *
 * An item whose use one of these stops is unidentified under it (`GATE_ITEMS`): a Recipe or a Formula by its
 * recipe's gate, a fragment by its relic's, a tarnished bauble by its tier's, a lily root by the water lily's, a
 * treasure map by its tier's.
 */
import {
  addGates, CRAFT_TOP, gateOf, GRAFT_LEVEL, kindGateRefusal, OBSIDIAN_LEVEL, ladderAt, SKILL_GATES, gateOpen, seenDefName, skillGateRefusal, stepsAbove, unidentified,
  workerGateOpen, CRAFT_GATE_SAID, type GateLevel, type SkillGate, type Viewer,
} from './skillgates';
import { bookOf, RECIPES, recipeTitle, type Recipe } from './recipes';
import { BOOKS } from './bookdrops';
import { scrollOf, type EnchantOn } from './enchant';
import { RELICS, type RelicDef } from './archaeology';
import { BAUBLE_TIERS, TARNISHED } from './baubles';
import {
  FLOOR_KIND_NAMES, GARDEN_BED, GLASS_ROOF, MATERIAL_BY_ID, MATERIALS, SINGLE_STAIRS_NAME, SPIRAL, SPIRAL_STAIRS_NAME, WALL_TYPES,
  wallWord, type FloorKind, type StairHand, type WallType,
} from './building';
import { SLAB_VARIANTS } from '../world/tiles';
import { capital } from './words';
import type { HodTarget } from './game';
import { itemDef } from './items';
import { castWhole, METALS, MOULD_BY_MAKES, MOULD_SKILL, MOULDS, metalOfBar, type MetalDef } from './metal';
import { SEAM_GATE } from './rockgates';
import { WATER_PLANTS, type WaterPlantDef } from '../world/waterplants';
import { TREASURE_TIERS } from './treasure';
import { BRIDGES, type BridgeDef } from './bridges';
import { GEMS, type GemDef } from './gems';
import { CROSS_SKILL } from './hybridlist';
import { schoolOf, SPELLS, type SpellDef } from './arcane';

/** A craft's level by its difficulty: the ladder step at or below `CRAFT_PER` × (difficulty − `CRAFT_FROM`). */
export const CRAFT_PER = 2;
export const CRAFT_FROM = 6;
/** A craft's level by its difficulty: the ladder step at or below 2 × (difficulty − 6); 1 for none. */
export const craftLevel = (difficulty: number | undefined): GateLevel => ladderAt(CRAFT_PER * ((difficulty ?? 0) - CRAFT_FROM), CRAFT_TOP);

/** What makes a recipe or a building material obsidian's (`OBSIDIAN_LEVEL`): an input of it, or a bill with it. */
export const OBSIDIAN = 'obsidian';
const ofObsidian = (items: ReadonlyArray<string>): boolean => items.includes(OBSIDIAN);

/**
 * A Formula's scroll, by what its enchantment goes on: a weapon, a bow, armour, a shield, a tool or a light 20;
 * jewellery, clothing and gear 30; a vessel, a cart, a store, a furnace or a station 40; two elements 50. Every scroll
 * has the one difficulty, which would put them all at 10.
 */
export const FORMULA_GATE: Readonly<Record<EnchantOn, GateLevel>> = {
  melee: 20, bow: 20, armour: 20, shield: 20, tool: 20, reaper: 20, pick: 20, light: 20,
  boots: 30, chest: 30, ring: 30, amulet: 30, pack: 30, head: 30, trap: 30, net: 30, saddle: 30, bridle: 30,
  furnace: 40, station: 40, ship: 40, hull: 40, cart: 40, store: 40, bed: 40,
};
/** A scroll written with two elements. */
export const FORMULA_TWO_ELEMENTS: GateLevel = 50;

/**
 * A recipe's level: obsidian's for anything made with it (`OBSIDIAN_LEVEL`), named (`CRAFT_GATE_SAID`), a Formula's
 * scroll's (`FORMULA_GATE`), else by its difficulty.
 */
export const recipeLevel = (r: Recipe): GateLevel => {
  if (ofObsidian(r.inputs.map((i) => i.item))) return OBSIDIAN_LEVEL;
  const said = CRAFT_GATE_SAID[r.result];
  if (said && said.skill === r.skill) return said.level;
  const scroll = scrollOf(r.result);
  if (scroll && r.category === 'Enchanting') return scroll.motes.length > 1 ? FORMULA_TWO_ELEMENTS : FORMULA_GATE[scroll.on];
  return craftLevel(r.difficulty);
};

/** Planning and building with a material, in its skill, by its bill (cheapest first); stone brick at 10 as decided. */
export const MATERIAL_GATE: Readonly<Record<string, GateLevel>> = {
  log: 1, garden_bed: 1, plank: 10, timbercraft: 20, glass: 40,
  cobblestone: 1, clay_adobe: 5, clay_bricks: 10, stone_brick: 10, sandstone: 30, slate: 40, marble: 50, ornate_silver: 60,
  stained_glass: 60, ornate_gold: 70,
};

/** Planning and building a wall type, in its material's skill. */
export const WALL_GATE: Readonly<Record<WallType, GateLevel>> = {
  solid: 1, fence: 1, half_wall: 1, railing: 1, window: 5, door: 5, fence_gate: 5, double_door: 10, arch: 10, counter: 10,
  bay: 20, iron_gate: 30, hidden_door: 40, portcullis: 50, rune_gate: 60,
};

/** A floor slot's type: its kind, or a staircase's hand ('single', 'spiral'). */
export type FloorType = FloorKind | 'single' | 'spiral';
export const floorType = (kind: FloorKind, hand?: StairHand | null): FloorType =>
  (kind === 'stairs' && hand === SPIRAL ? 'spiral' : kind === 'stairs' && hand ? 'single' : kind);
const FLOOR_TYPE_NAME: Record<FloorType, string> = { ...FLOOR_KIND_NAMES, single: SINGLE_STAIRS_NAME, spiral: SPIRAL_STAIRS_NAME };

/** Planning and building a floor type, in its material's skill. */
export const FLOOR_GATE: Readonly<Record<FloorType, GateLevel>> = { floor: 1, roof: 1, ladder: 1, stairs: 10, single: 20, spiral: 20 };

/** Paving, by paving: cobblestones and each slab by its item. */
export const COBBLESTONES = 'cobblestone';
export const PAVING_GATE: Readonly<Record<string, GateLevel>> = { [COBBLESTONES]: 5, stone_slab: 10, sandstone_slab: 20, slate_slab: 30, marble_slab: 50 };

/**
 * Pouring a metal (Pour a mould, Cast an anvil; a nail or ribbon smith's work), in the trade that pours moulds
 * (`MOULD_SKILL`), by the metal: a mined one at its seam's mining gate (`SEAM_GATE`: copper 1, tin 10 … seryll 90) but
 * the ones named (`POUR_GATE_SAID`: iron 1, as decided, so a fresh nail smith pours); an alloy at the level of the
 * recipe that mixes it (decided, batch G: pewter 5, bronze and brass 10, steel and electrum 20, fire-tempered steel
 * 40). Forming the mould is its own recipe's gate; ingots are not a mould and stay open.
 */
export const POUR_GATE_SAID: Readonly<Record<string, GateLevel>> = { iron: 1 };
/** The recipe that mixes an alloy at the smelter. */
const alloyRecipe = (m: MetalDef): Recipe | undefined => RECIPES.find((r) => r.category === 'Smelting' && r.result === m.lump);
const metalLevel = (m: MetalDef): GateLevel => {
  if (m.ore) {
    const level = POUR_GATE_SAID[m.id] ?? SEAM_GATE[m.ore];
    if (level === undefined) throw new Error(`${m.id}: no seam gate`);
    return level;
  }
  const mix = alloyRecipe(m);
  if (!mix) throw new Error(`${m.id}: no recipe mixes it`);
  return recipeLevel(mix);
};
export const METAL_GATE: Readonly<Record<string, GateLevel>> = Object.fromEntries(METALS.map((m) => [m.id, metalLevel(m)]));

/*
 * Batch F (docs/gating.md §11): a metal's one table, read three ways. `METAL_GATE` is a metal's level in the furnace
 * and at the anvil: smelting its ore (kind `smelt`, in smelting), pouring it (kind `metal`, in blacksmithing) and
 * working a casting of it at the anvil (kind `casting`, in the trade the casting's mould is worked in). A mined metal's
 * casting is at its smelting gate; an alloy's at the level of the recipe that mixes it (batch G), which pouring reads
 * too. No copy: every row reads `METAL_GATE`.
 */

/** Smelting a metal's ore (Smelt; a smelter worker's and a stoker's work), in smelting, at the metal's level. */
export const SMELT_SKILL = 'smelting';
/** The mined metals: an ore to smelt. */
const MINED = METALS.filter((m) => m.ore);

/** The trades a casting is worked in at the anvil: each mould's own, for every mould not cast whole. */
export const CASTING_SKILLS: readonly string[] = [...new Set(MOULDS.filter((m) => !castWhole(m)).map((m) => m.skill))];
/** A casting gate's id: the trade it is worked in and the metal, "weaponsmithing:tin". */
export const castingGateId = (skill: string, metal: string): string => `${skill}:${metal}`;

/**
 * Planting a water plant (Plant a water lily or a lotus; in a lily pond; a water planter's work), in botanizing: the
 * water lily 10, the lotus 20. A lily root, which is only planted, is unidentified under it; lotus seeds are food too.
 */
export const WATER_PLANT_GATE: Readonly<Record<string, GateLevel>> = { lily: 10, lotus: 20 };
const waterPlantItems = (d: WaterPlantDef): Array<{ item: string; noun: string }> =>
  (itemDef(d.from).food ? [] : [{ item: d.from, noun: itemDef(d.from).name.split(' ').pop()!.toLowerCase() }]);

/** Reading and digging up a treasure map, in digging, by its tier: the ladder step at or below this many a tier (worn 1, sound 20, fine 40, grand 60). */
export const MAP_GATE_PER_TIER = 20;

/**
 * A bridge (Throw a bridge across, Work on the bridge; Lead an aqueduct here, Work on the aqueduct; a hod carrier's
 * spans), in its trade: a material bridge at its material's gate (`MATERIAL_GATE`), the rest by their difficulty
 * (`craftLevel`: the garden footbridge 10, the rope bridge 20, the drawbridge 50, the aqueduct 70).
 */
export const bridgeLevel = (b: BridgeDef): GateLevel => (b.material ? MATERIAL_GATE[b.material] : craftLevel(b.difficulty));

/**
 * Setting a stone in a circlet, in jewellery, by its rarity: the commonest at the circlet's own gate, each rarer weight
 * one ladder step up (topaz, garnet, onyx, amber 30; emerald, peridot, amethyst, jasper 40; ruby, sapphire, opal 50;
 * diamond 60). Gems have other uses (a ring, a pendant, a focus), so are not unidentified.
 */
export const CIRCLET_RECIPE = 'make_circlet';
const GEM_COMMONEST = Math.max(...GEMS.map((g) => g.weight));
export const gemLevel = (g: GemDef): GateLevel =>
  stepsAbove(recipeLevel(RECIPES.find((r) => r.id === CIRCLET_RECIPE)!), GEM_COMMONEST - g.weight);

/** A spell's school's skill. */
const spellSkill = (s: SpellDef): string => schoolOf(s.school)?.skill ?? s.school;

const F_ROWS: SkillGate[] = [
  { kind: 'graft', id: 'graft', name: 'Graft', skill: 'forestry', level: GRAFT_LEVEL },
  ...WATER_PLANTS.map((d): SkillGate => ({ kind: 'water_plant', id: d.id, name: d.name, skill: 'botanizing', level: WATER_PLANT_GATE[d.id] })),
  ...TREASURE_TIERS.map((t): SkillGate => ({ kind: 'hoard', id: t.id, name: capital(t.name), skill: 'digging', level: ladderAt(MAP_GATE_PER_TIER * t.ord) })),
  ...Object.values(BRIDGES).map((b): SkillGate => ({ kind: 'bridge', id: b.id, name: b.name, skill: b.skill, level: bridgeLevel(b) })),
  ...MINED.map((m): SkillGate => ({ kind: 'smelt', id: m.id, name: `${m.name} smelting`, skill: SMELT_SKILL, level: METAL_GATE[m.id] })),
  ...CASTING_SKILLS.flatMap((skill) => METALS.map((m): SkillGate =>
    ({ kind: 'casting', id: castingGateId(skill, m.id), name: `${m.name} casting`, skill, level: METAL_GATE[m.id] }))),
  ...GEMS.map((g): SkillGate => ({ kind: 'gem', id: g.id, name: `${g.name} setting`, skill: 'jewellery', level: gemLevel(g) })),
  { kind: 'cross', id: 'cross', name: 'Cross', skill: 'animal_husbandry', level: CROSS_SKILL },
  ...SPELLS.map((s): SkillGate => ({ kind: 'spell', id: s.id, name: s.name, skill: spellSkill(s), level: s.level })),
];

/** The skills buildings are trained in, and the wall types each lays: stone ones only in masonry. */
const BUILD_SKILLS = ['carpentry', 'masonry'] as const;
const wallIn = (skill: string, type: (typeof WALL_TYPES)[number]): boolean => skill === 'masonry' || (!type.stone && !type.laidIn);

const relicId = (r: RelicDef): string => r.name.toLowerCase();

/**
 * A recipe's gate name: its title (`recipeTitle`), unless another recipe or gate in its skill has that name at another
 * level (five dye boils, three yarns, a smoked fish and the fish): then its label where that is its own ("Smoke the
 * trout"), else its title and first input ("Yarn (wool)").
 */
const recipeGateName = (r: Recipe, levels: ReadonlyMap<string, ReadonlySet<number>>): string => {
  const title = recipeTitle(r);
  if ((levels.get(`${r.skill}|${title}`)?.size ?? 0) < 2) return title;
  const sameLabel = RECIPES.filter((o) => o.skill === r.skill && o.label === r.label).length;
  return sameLabel < 2 ? r.label : `${title} (${itemDef(r.inputs[0].item).name.toLowerCase()})`;
};

const recipeRows = (others: readonly SkillGate[]): SkillGate[] => {
  const levels = new Map<string, Set<number>>();
  const add = (skill: string, name: string, level: number): void => {
    levels.set(`${skill}|${name}`, (levels.get(`${skill}|${name}`) ?? new Set<number>()).add(level));
  };
  for (const g of [...SKILL_GATES, ...others]) add(g.skill, g.name, g.level);
  for (const r of RECIPES) add(r.skill, recipeTitle(r), recipeLevel(r));
  return RECIPES.map((r): SkillGate => ({ kind: 'recipe', id: r.id, name: recipeGateName(r, levels), skill: r.skill, level: recipeLevel(r) }));
};

const OTHER_ROWS: SkillGate[] = [
  ...RELICS.map((r): SkillGate => ({ kind: 'relic', id: relicId(r), name: capital(r.name), skill: 'restoration', level: craftLevel(r.difficulty) })),
  ...BAUBLE_TIERS.map((t): SkillGate => ({ kind: 'bauble', id: t.id, name: `${t.name} bauble`, skill: 'restoration', level: craftLevel(t.difficulty) })),
  ...[...MATERIALS, GLASS_ROOF, GARDEN_BED].map((m): SkillGate => {
    // Obsidian glass and anything else built of obsidian: obsidian's level.
    const level = ofObsidian(m.bill.map(([item]) => item)) ? OBSIDIAN_LEVEL : MATERIAL_GATE[m.id];
    if (level === undefined) throw new Error(`${m.id}: no material gate`);
    return { kind: 'material', id: m.id, name: `${m.name} building`, skill: m.skill, level };
  }),
  ...BUILD_SKILLS.flatMap((skill) => WALL_TYPES.filter((w) => wallIn(skill, w)).map((w): SkillGate =>
    ({ kind: 'wall', id: `${skill}:${w.id}`, name: capital(wallWord(w)), skill, level: WALL_GATE[w.id] }))),
  ...BUILD_SKILLS.flatMap((skill) => (Object.keys(FLOOR_GATE) as FloorType[]).map((f): SkillGate =>
    ({ kind: 'floor', id: `${skill}:${f}`, name: capital(FLOOR_TYPE_NAME[f]), skill, level: FLOOR_GATE[f] }))),
  { kind: 'paving', id: COBBLESTONES, name: 'Cobblestones', skill: 'paving', level: PAVING_GATE[COBBLESTONES] },
  ...SLAB_VARIANTS.map((v): SkillGate => ({ kind: 'paving', id: v.item, name: v.name, skill: 'paving', level: PAVING_GATE[v.item] ?? 1 })),
  ...METALS.map((m): SkillGate => ({ kind: 'metal', id: m.id, name: `${m.name} pouring`, skill: MOULD_SKILL, level: METAL_GATE[m.id] })),
  ...F_ROWS,
];
const ROWS: SkillGate[] = [...recipeRows(OTHER_ROWS), ...OTHER_ROWS];

/** A fragment's `extra`, "old pot 1/2": its relic, "old pot". The island's `fragment_relic`. */
const FRAGMENT_OF = /^(.+) \d+\/\d+$/;

const RECIPE_BY_GATE = new Map(RECIPES.map((r) => [r.id, r]));

addGates(ROWS, {
  // A shut recipe's book: a Recipe or a Formula, by the recipe's title (`recipeOn`).
  recipe: (g) => {
    const r = RECIPE_BY_GATE.get(g.id);
    return r?.locked ? [{ item: BOOKS[bookOf(r)].item, extra: recipeTitle(r).toLowerCase(), noun: bookOf(r) }] : [];
  },
  relic: (g) => [{ item: 'fragment', extra: g.id, noun: 'fragment' }],
  bauble: (g) => [{ item: TARNISHED, extra: g.id, noun: 'bauble' }],
  water_plant: (g) => waterPlantItems(WATER_PLANTS.find((d) => d.id === g.id)!),
  hoard: (g) => [{ item: 'treasure_map', extra: g.id, noun: 'map' }],
}, { fragment: (extra) => FRAGMENT_OF.exec(extra)?.[1] ?? extra });

/* ---- Readers --------------------------------------------------------------------------------------------------- */

/** The gate on making a recipe. */
export const recipeGate = (r: Pick<Recipe, 'id'>): SkillGate | undefined => gateOf('recipe', r.id);

/** Making a recipe under its gate: "Apple pie: needs cooking 20; have 4.0.", or null. */
export const recipeGateRefusal = (r: Pick<Recipe, 'id'>, viewer: Viewer): string | null => {
  const g = recipeGate(r);
  return g ? skillGateRefusal(g.name, g.skill, viewer.skills.get(g.skill), g.level) : null;
};

/** Whether a worker may make a recipe, at its own level in the recipe's skill. */
export const workerRecipeOpen = (c: { skills: Record<string, number> }, id: string): boolean => workerGateOpen(c, gateOf('recipe', id));

/** The gate on restoring a relic. */
export const relicGate = (r: RelicDef): SkillGate | undefined => gateOf('relic', relicId(r));

/** What a wall or a floor of a material is planned and built under: its material's gate, then its type's. */
export interface BuildType {
  wall?: WallType;
  floor?: FloorKind;
  hand?: StairHand | null;
}

/** The gates on building with a material as a type: its material's, then its wall type's or floor type's, in its skill. */
export const buildGates = (material: string | undefined, as: BuildType): SkillGate[] => {
  const m = material ? MATERIAL_BY_ID.get(material) : undefined;
  if (!m) return [];
  const type = as.wall ? gateOf('wall', `${m.skill}:${as.wall}`)
    : as.floor ? gateOf('floor', `${m.skill}:${floorType(as.floor, as.hand)}`) : undefined;
  return [gateOf('material', m.id), type].filter((g): g is SkillGate => !!g);
};

/** Planning or building with a material as a type under one of its gates: the first unmet, or null. The island's `build_gate_refusal`. */
export const buildGateRefusal = (viewer: Viewer, material: string | undefined, as: BuildType): string | null => {
  for (const g of buildGates(material, as)) {
    const no = skillGateRefusal(g.name, g.skill, viewer.skills.get(g.skill), g.level);
    if (no) return no;
  }
  return null;
};

/**
 * Whether a worker at `level` (`creatureLevel`) may build with a material as a type: every gate's level at or under it,
 * whatever the gate's skill. A hod carrier's. The island's `worker_build_open`.
 */
export const workerBuildOpen = (level: number, material: string | undefined, as: BuildType): boolean =>
  buildGates(material, as).every((g) => level >= g.level);

/**
 * The gates on fitting what a piece of work wants: a wall, a floor, a column by its material and type (a change planned
 * on a wall by the change's); a bridge span by its bridge. The island's `hod_build_gates` and `hod_may`.
 */
const hodGates = (t: HodTarget): SkillGate[] =>
  t.kind === 'wall' ? buildGates((t.wall.change ?? t.wall).material, { wall: (t.wall.change ?? t.wall).type })
    : t.kind === 'floor' ? buildGates(t.floor.material, { floor: t.floor.kind ?? 'floor', hand: t.floor.hand })
      : t.kind === 'column' ? buildGates(t.column.material, {})
        : t.kind === 'span' ? [gateOf('bridge', t.bridge.kind)].filter((g): g is SkillGate => !!g) : [];

/**
 * The first gate on a piece of work over a hod carrier's level (`creatureLevel`), whatever the gate's skill, or
 * undefined: it may fit it. The island's `hod_build_gate`.
 */
export const hodGate = (level: number, t: HodTarget): SkillGate | undefined =>
  hodGates(t).find((g) => level < g.level);

/** Whether a hod carrier at `level` may fit what a piece of work wants: every gate on it at or under it. The island's `hod_may`. */
export const hodMay = (level: number, t: HodTarget): boolean => !hodGate(level, t);

/** Paving with cobblestones or a slab under its gate, or null. */
export const pavingGateRefusal = (viewer: Viewer, id: string): string | null => {
  const g = gateOf('paving', id);
  return g ? skillGateRefusal(g.name, g.skill, viewer.skills.get(g.skill), g.level) : null;
};

/** Whether somebody may lay a paving. */
export const pavingOpen = (viewer: Viewer, id: string): boolean => {
  const g = gateOf('paving', id);
  return gateOpen(g, g ? viewer.skills.get(g.skill) : 0);
};

/** The gate on pouring a metal, by its id. */
export const metalGate = (metalId: string): SkillGate | undefined => gateOf('metal', metalId);

/** Pouring a metal under its gate: "Tin pouring: needs blacksmithing 10; have 2.3.", or null. The island's `metal_gate_refusal`. */
export const metalGateRefusal = (viewer: Viewer, metalId: string): string | null => {
  const g = metalGate(metalId);
  return g ? skillGateRefusal(g.name, g.skill, viewer.skills.get(g.skill), g.level) : null;
};

/** Whether a worker may pour a lump's or an ingot's metal, at its own level in the gate's skill. The island's `worker_smith_lumps`. */
export const workerMetalOpen = (c: { skills: Record<string, number> }, bar: string): boolean => {
  const m = metalOfBar(bar);
  return !m || workerGateOpen(c, metalGate(m.id));
};

/* ---- Batch F readers ------------------------------------------------------------------------------------------- */

/** The metal a casting or a smithed piece is of, by its `extra` ("Iron"). */
const METAL_BY_NAME = new Map(METALS.map((m) => [m.name.toLowerCase(), m]));
const metalNamed = (extra: string | undefined): MetalDef | undefined => (extra ? METAL_BY_NAME.get(extra.toLowerCase()) : undefined);

/** The gate on working a casting of a piece at the anvil, by its metal's name, in the trade its mould is worked in; none for a piece cast whole. */
export const castingGate = (piece: string | undefined, metal: string | undefined): SkillGate | undefined => {
  const mould = piece ? MOULD_BY_MAKES.get(piece) : undefined;
  const m = metalNamed(metal);
  return mould && m && !castWhole(mould) ? gateOf('casting', castingGateId(mould.skill, m.id)) : undefined;
};

/** Working a casting at the anvil under its gate: "Tin casting: needs weaponsmithing 10; have 2.3.", or null. The island's `casting_gate_refusal`. */
export const castingGateRefusal = (viewer: Viewer, casting: { piece?: string; extra?: string }): string | null => {
  const g = castingGate(casting.piece, casting.extra);
  return g ? skillGateRefusal(g.name, g.skill, viewer.skills.get(g.skill), g.level) : null;
};

/**
 * Whether a nail or ribbon smith may beat a lump of a metal out into its piece: at its own blacksmithing, the metal's
 * pouring gate and the casting gate of its piece's mould, both off `METAL_GATE`. The island's `worker_smith_lumps`.
 */
export const workerSmithOpen = (c: { skills: Record<string, number> }, bar: string, makes: string): boolean => {
  const m = metalOfBar(bar);
  return workerMetalOpen(c, bar) && (!m || workerGateOpen(c, castingGate(makes, m.name)));
};

/** Smelting an ore under its metal's gate: "Tin smelting: needs smelting 10; have 2.3.", or null. The island's `kind_gate_refusal(…, 'smelt', …)`. */
export const smeltGateRefusal = (viewer: Viewer, ore: string): string | null => {
  const m = MINED.find((x) => x.ore === ore);
  return m ? kindGateRefusal(viewer, 'smelt', m.id) : null;
};

/** The smelting gate on an ore, by its metal. */
export const smeltGate = (ore: string): SkillGate | undefined => {
  const m = MINED.find((x) => x.ore === ore);
  return m ? gateOf('smelt', m.id) : undefined;
};

/** Whether a worker may smelt an ore, at its own smelting. The island's `worker_furnace_fits`. */
export const workerSmeltOpen = (c: { skills: Record<string, number> }, ore: string): boolean => workerGateOpen(c, smeltGate(ore));

/**
 * Planting a water plant under its gate, named as `viewer` sees what is planted: "Unidentified root: needs botanizing
 * 10; have 2.0." for a lily root, "Lotus: needs botanizing 20; have 4.0." for lotus seeds; or null. The island's
 * `water_plant_gate_refusal`.
 */
export const waterPlantGateRefusal = (viewer: Viewer, d: WaterPlantDef): string | null => {
  const g = gateOf('water_plant', d.id);
  if (!g) return null;
  return skillGateRefusal(unidentified({ id: d.from }, viewer) ? seenDefName(d.from, viewer) : g.name, g.skill, viewer.skills.get(g.skill), g.level);
};

/** The water plant a root or seed grows into. */
export const waterPlantFrom = (from: string): WaterPlantDef | undefined => WATER_PLANTS.find((x) => x.from === from);

/** Whether a worker may plant from a root or seed, at its own botanizing. The island's `worker_roots`. */
export const workerWaterPlantOpen = (c: { skills: Record<string, number> }, from: string): boolean => {
  const d = waterPlantFrom(from);
  return !d || workerGateOpen(c, gateOf('water_plant', d.id));
};

/** Planning or building a bridge or an aqueduct under its gate: "Drawbridge: needs carpentry 50; have 12.0.", or null. */
export const bridgeGateRefusal = (viewer: Viewer, kind: string): string | null => kindGateRefusal(viewer, 'bridge', kind);

/** Setting a stone in a circlet under its gate: "Diamond setting: needs jewellery 60; have 31.0.", or null. */
export const gemGateRefusal = (viewer: Viewer, gem: string): string | null => kindGateRefusal(viewer, 'gem', gem);
