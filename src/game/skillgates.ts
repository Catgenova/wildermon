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
 * `gate_idle`). A hod carrier's build gates (material, wall, floor, bridge) read its level instead (`hodMay`).
 *
 * An item whose use a gate stops (a seed by its crop's farming, a sprout by its species' forestry) is unidentified to
 * whoever is under that gate: named "Unidentified seed" (`seenName`) and described only by what identifies it, "30
 * farming required to identify this seed." (`identifySaid`). Each kind of gate names its items (`GATE_ITEMS`), and the
 * island has them as `skill_gate_item`, so a new gate on an item makes it unidentified with nothing else written.
 *
 * Levels sit on `GATE_LADDER`, so gates land on few steps a player can learn. See docs/gating.md for the whole table
 * this is the start of: trees, sprouts, crops, seams, veins, stone faces, kinds tamed, fish, wagons and boats are on it.
 *
 * Game, UI, defs and tests read it.
 */
import { SKILL_BY_ID } from './skills';
import { isSeam, ROCK_VARIANTS, TileType, TREE_DEFS, treeAge, treeSpecies, UNIDENTIFIED_ROCK, UNIDENTIFIED_VEIN } from '../world/tiles';
import { ITEM_DEFS, itemDef, itemName, type Item } from './items';
import { SEAM_GATE, STONE_GATE, VEIN_GATE } from './rockgates';

/** The rock gates' tables (`rockgates.ts`), read through here as every other kind's. */
export { SEAM_GATE, STONE_GATE, VEIN_GATE };

/** The steps a gate's level is chosen from. */
export const GATE_LADDER = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 99] as const;
export type GateLevel = (typeof GATE_LADDER)[number];

/**
 * What sort of thing a gate is on, which with `id` keys it: a tree species by its lower-case name (`tree` for felling
 * it, `sprout` for its sprouts); a crop by its id (`crop`); a seam, a vein and a stone face by what the rock yields; a
 * kind of wildermon by its species id; a fish by its id; a wagon or a boat by its piece's id.
 */
export type GateKind = 'tree' | 'sprout' | 'crop' | 'seam' | 'vein' | 'stone' | 'tame' | 'fish' | 'vehicle' | 'boat'
  | 'recipe' | 'relic' | 'bauble' | 'material' | 'wall' | 'floor' | 'paving' | 'metal'
  | 'graft' | 'water_plant' | 'hoard' | 'bridge' | 'smelt' | 'casting' | 'gem' | 'cross' | 'spell';

/** What each evolution stage past the first adds to a kind's taming gate (`TAME_GATE`). The island's `wild_stage_tame`. */
export const TAME_STAGE_GATE = 15;

/** What a gate of each kind stops, as the help says it. */
export const GATE_STOPS: Readonly<Record<GateKind, string>> = {
  tree: 'felling a tree with logs: Cut down, Coppice, a feller\'s work',
  sprout: 'picking, planting and grafting the species\' sprouts; a sprout picker\'s and a planter\'s work',
  crop: 'sowing it: a field, a garden bed, a planter, a herb spiral; a farmer\'s and a planter tender\'s work',
  seam: 'mining a seam: Mine, Chip corner, Mine out the cellar, a miner\'s work; less with Ore Sense; the Ironemole line exempt',
  vein: 'naming a buried vein: Prospect, a marked tile; under it "Unidentified metal"; a bare vein always named',
  stone: 'quarrying a plain face: Mine, Chip corner, a quarrier\'s work',
  tame: `taming a kind: Tame, Take catch; +${TAME_STAGE_GATE} an evolution stage`,
  fish: 'catching a fish: under it, not in the catch',
  vehicle: 'taking the reins',
  boat: 'taking the helm or the oars',
  recipe: 'making it: the crafting window, a worker\'s recipe; a Recipe or Formula unidentified under it',
  relic: 'restoring it: Restore, a restorer\'s work; its fragments unidentified under it',
  bauble: 'restoring a tarnished bauble of the tier; unidentified under it',
  material: 'planning and building walls, floors and roofs of it; a hod carrier\'s work, at its level',
  wall: 'planning and building the wall type; a hod carrier\'s work, at its level',
  floor: 'planning and building the floor type; a hod carrier\'s work, at its level',
  paving: 'paving with it',
  metal: 'pouring it: Pour a mould, Cast an anvil; a nail or ribbon smith\'s work',
  graft: 'grafting a fruit sprout onto a tree: Graft',
  water_plant: 'planting it: in still water, in a lily pond; a water planter\'s work; a lily root unidentified under it',
  hoard: 'Dig it up on a treasure map of the tier; the map unidentified under it, still read',
  bridge: 'planning and building it; a hod carrier\'s work, at its level',
  smelt: 'smelting its ore: Smelt, a smelter worker\'s and a stoker\'s work',
  casting: 'working a casting of the metal at the anvil: Smith; a nail or ribbon smith\'s work',
  gem: 'setting the stone in a circlet',
  cross: 'breeding a listed cross',
  spell: 'casting it',
};

export interface SkillGate {
  kind: GateKind;
  /** The thing within its kind: a tree's or a crop's lower-case name, a vehicle's piece. */
  id: string;
  /** Its name as the game says it: "Willow", "Willow sprout", "Wemp", "Wagon". */
  readonly name: string;
  skill: string;
  /** On `GATE_LADDER`, but for the kinds that kept the numbers they had before it (`KEPT_OFF_LADDER`). */
  level: number;
}

/** The kinds whose levels were gates before the ladder and keep their numbers: taming 6, 8, 12 …; fish 15, 35, 45. */
export const KEPT_OFF_LADDER: ReadonlySet<GateKind> = new Set<GateKind>(['tame', 'fish']);

/**
 * Felling a tree that has logs in it (Cut down, Coppice; a feller's work), by woodcutting. Asked for: pine least,
 * birch, oak and maple early, willow most; then birch at 1 and willow at 90, and no empty step between. Oak and maple
 * take the next two steps; the rest climb one step a group by their wood's difficulty (`materials.ts`): fig and peach
 * (0-1) 20, cherry, lemon and apricot (2) 30, the four woods of 3 over two steps (plum and quince 40, the heavier apple
 * and pear 50), pomegranate 60, cedar 70 and olive (6) 80. A tree with no logs yet is cleared by anybody.
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
  Plum: 40,
  Quince: 40,
  Apple: 50,
  Pear: 50,
  Pomegranate: 60,
  Cedar: 70,
  Olive: 80,
  Willow: 90,
};

/** One step down the ladder, or 1 at the bottom. */
export const stepBelow = (level: GateLevel): GateLevel => GATE_LADDER[Math.max(0, GATE_LADDER.indexOf(level) - 1)];

/** `n` steps up the ladder from `level`, or its top. */
export const stepsAbove = (level: GateLevel, n: number): GateLevel =>
  GATE_LADDER[Math.min(GATE_LADDER.length - 1, GATE_LADDER.indexOf(level) + n)];

/** The ladder step at or below `at`, 1 at the least, `top` at the most. */
export const ladderAt = (at: number, top: GateLevel = GATE_LADDER[GATE_LADDER.length - 1]): GateLevel => {
  let level: GateLevel = 1;
  for (const step of GATE_LADDER) if (step <= Math.min(at, top)) level = step;
  return level;
};

/** Grafting a fruit sprout onto a tree, by forestry (Graft). The island's `skill_gate('graft', 'graft')`. */
export const GRAFT_LEVEL: GateLevel = 50;

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
  wemp: 1,
  basil: 30,
  rosemary: 40,
};

/**
 * Crafts whose level was named rather than read off their difficulty (docs/gating.md, the difficulty rule): the
 * smelter at masonry 1 (the Path's stone phase), the wagon at carpentry 70, the caravel at carpentry 90. For the
 * crafts' gates to read.
 */
export const CRAFT_GATE_SAID: Readonly<Record<string, { skill: string; level: GateLevel }>> = {
  smelter: { skill: 'masonry', level: 1 },
  wagon: { skill: 'carpentry', level: 70 },
  caravel: { skill: 'carpentry', level: 90 },
  // A trade's first steps at 1 (decided, batch F): bowyery's string and short bow, leatherworking's awl and leather,
  // papyrusmaking's papyrus and the paper press it is pressed at, ropemaking's rope.
  bow_string: { skill: 'bowyery', level: 1 },
  short_bow: { skill: 'bowyery', level: 1 },
  awl: { skill: 'leatherworking', level: 1 },
  leather: { skill: 'leatherworking', level: 1 },
  papyrus: { skill: 'papyrusmaking', level: 1 },
  paper_press: { skill: 'carpentry', level: 1 },
  rope: { skill: 'ropemaking', level: 1 },
  // Stonecutting's stone brick, milling's flour and glassblowing's glass: each skill made nothing at its start (whetstone,
  // flour and glass were 5, brick 10), and nothing else trains them.
  stone_brick: { skill: 'stonecutting', level: 1 },
  flour: { skill: 'milling', level: 1 },
  glass_lump: { skill: 'glassblowing', level: 1 },
  // And the everyday makings under them (decided, batch G): the bucket papyrus's water comes in, the lye leather is tanned in.
  bucket: { skill: 'carpentry', level: 1 },
  lye_bucket: { skill: 'alchemy', level: 1 },
};

/**
 * Anything made with obsidian, or built of it (decided, batch G): the top of the ladder, in its own making skill.
 * Obsidian gear, knapped tools and weapons, the obsidian pieces and lamps, the dragon-glass fountain, obsidian glass
 * building (`craftgates.ts`, `OBSIDIAN`).
 */
export const OBSIDIAN_LEVEL: GateLevel = 99;
/** The highest step a craft reaches by its difficulty alone (`craftLevel`): 99 is obsidian's. */
export const CRAFT_TOP: GateLevel = 90;

/** A crop's seed item: its id and `_seed` (`farming.ts`). */
export const cropSeed = (crop: string): string => `${crop}_seed`;

/** A crop as its gate names it, as `CROPS` names it: "Wemp". */
const cropName = (id: string): string => `${id.charAt(0).toUpperCase()}${id.slice(1)}`;

/**
 * Taming a kind at its first stage, by species id: the levels each kind held, kept. Each evolution stage past the
 * first adds `TAME_STAGE_GATE` (`tameNeeds`). Monsters are not tamed; hybrids are never wild.
 */
export const TAME_GATE: Readonly<Record<string, number>> = {
  rabba: 1, vola: 1, bevere: 1, crawler: 1, noot: 1, embra: 1, quarra: 1, woola: 1, ulva: 30, magga: 1, mola: 1,
  seavic: 1, roxxen: 25, orse: 30, rowl: 1, bogga: 1, sedra: 1, holla: 1, dowse: 15, sappa: 10, snedda: 1, grubba: 1,
  plucka: 1, cobbe: 20, tinka: 25, middun: 8, kemma: 12, sheela: 16, salva: 20, carra: 22, tanna: 18, grista: 14,
  wicka: 24, brambo: 1, grazza: 1, siffa: 20, potta: 14, cindra: 16, hoppa: 18, simma: 16, relka: 28, bedda: 10,
  wurla: 1, sprigga: 1, ambra: 1, petta: 1, scurra: 1, rippa: 14, chissa: 16, mudda: 8, flecha: 20, papra: 18,
  glimmip: 20, glossa: 24, dippa: 1, thumpa: 28, spitta: 26, awla: 24, sparra: 6, lungra: 24, crakka: 28, whirla: 30,
  scorcha: 30, frosta: 28, dulla: 1, stona: 26, leecha: 28, whispet: 28, crumbud: 28, bura: 1, wadd: 1, springlet: 40,
  warda: 30, quill: 12, cudda: 14, vesp: 1, snout: 50,
};

/** Fish by fishing, by id: the levels each held, kept. Over it a fish is not in the catch, never a refusal. */
export const FISH_GATE: Readonly<Record<string, number>> = {
  minnow: 1,
  perch: 1,
  trout: 15,
  pike: 35,
  sturgeon: 60,
  cod: 20,
  halibut: 45,
  bluefin: 70,
};

/** Taking the reins, by driving: the wagon. The small and large carts are open (a small cart teaches no driving). */
export const VEHICLE_GATE: Readonly<Record<string, GateLevel>> = { wagon: 30 };

/** Taking the helm or the oars, by sailing. Boarding as a passenger is open. */
export const BOAT_GATE: Readonly<Record<string, GateLevel>> = { rowing_boat: 1, sailing_boat: 20, caravel: 50 };

/*
 * The names of the things whose defs are not leaves (a kind of wildermon, a fish, a piece), said by the module that
 * holds them once it is loaded (`nameGates`): this one stays a leaf, and every page, test and dump that shows a gate
 * loads those modules. Before then a gate's name is its id.
 */
const NAMERS: Partial<Record<GateKind, (id: string) => string | undefined>> = {};
/** Where a kind's gates get their names from: the module holding the things calls it once, at load. */
export const nameGates = (kind: GateKind, namer: (id: string) => string | undefined): void => {
  NAMERS[kind] = namer;
};
const named = (kind: GateKind, id: string, skill: string, level: number): SkillGate => {
  const g = { kind, id, skill, level } as SkillGate;
  Object.defineProperty(g, 'name', { enumerable: true, get: () => NAMERS[kind]?.(id) ?? id });
  return g;
};
const rows = (kind: GateKind, skill: string, table: Readonly<Record<string, number>>): SkillGate[] =>
  Object.entries(table).map(([id, level]) => named(kind, id, skill, level));
/** A rock's gates, by its yield: its seam (mining) and its vein (prospecting), or its plain face (mining). */
const rockRows = (): SkillGate[] => ROCK_VARIANTS.flatMap((r): SkillGate[] => {
  const seam = isSeam(r);
  const level = (seam ? SEAM_GATE : STONE_GATE)[r.yields];
  if (level === undefined) throw new Error(`${r.name}: no ${seam ? 'seam' : 'stone'} gate`);
  const g = (kind: GateKind, skill: string): SkillGate => ({ kind, id: r.yields, name: r.name, skill, level });
  return seam ? [g('seam', 'mining'), g('vein', 'prospecting')] : [g('stone', 'mining')];
});

const bySkillLevel = (a: SkillGate, b: SkillGate): number => a.skill.localeCompare(b.skill) || a.level - b.level || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id);

/**
 * Every gate, in skill then level then id order. The kinds whose things live in modules that are not leaves (a recipe,
 * a relic, a bauble, a building material, a wall type, a floor type, a paving) are added by `craftgates.ts` at load
 * (`addGates`), so this module stays a leaf and every page, test and dump that loads the game has them all.
 */
const ALL: SkillGate[] = [
  ...TREE_DEFS.map((t): SkillGate => {
    const level = TREE_GATE[t.name];
    if (level === undefined) throw new Error(`${t.name}: no woodcutting gate`);
    return { kind: 'tree', id: t.name.toLowerCase(), name: t.name, skill: 'woodcutting', level };
  }),
  ...TREE_DEFS.map((t): SkillGate => ({ kind: 'sprout', id: t.name.toLowerCase(), name: `${t.name} sprout`, skill: 'forestry', level: sproutLevel(t.name) })),
  ...Object.entries(CROP_GATE).map(([id, level]): SkillGate => ({ kind: 'crop', id, name: cropName(id), skill: 'farming', level })),
  ...rockRows(),
  ...rows('tame', 'taming', TAME_GATE),
  ...rows('fish', 'fishing', FISH_GATE),
  ...rows('vehicle', 'driving', VEHICLE_GATE),
  ...rows('boat', 'sailing', BOAT_GATE),
].sort(bySkillLevel);
export const SKILL_GATES: readonly SkillGate[] = ALL;

const checkGate = (g: SkillGate): void => {
  if (!KEPT_OFF_LADDER.has(g.kind) && !(GATE_LADDER as readonly number[]).includes(g.level)) throw new Error(`${g.kind} ${g.id}: ${g.level} is not on the ladder`);
  if (!SKILL_BY_ID.has(g.skill)) throw new Error(`${g.kind} ${g.id}: no skill ${g.skill}`);
};
for (const g of ALL) checkGate(g);

const BY_KEY = new Map(ALL.map((g) => [`${g.kind}:${g.id}`, g]));

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

/**
 * A thing's gate for somebody, by kind and id, in the one rule's words, or null: "Graft: needs forestry 50; have
 * 12.0." The island's `kind_gate_refusal`.
 */
export const kindGateRefusal = (viewer: Viewer, kind: GateKind, id: string): string | null =>
  gatedFor(kind, id, (skill) => viewer.skills.get(skill));

/** The felling gate on a tree tile's data, or undefined for a tree with no logs in it: those anybody clears. */
export const treeGate = (data: number): SkillGate | undefined =>
  treeAge(data).logs > 0 ? gateOf('tree', TREE_DEFS[treeSpecies(data)].name.toLowerCase()) : undefined;

/** The sprout gate of a tree tile's species. The island's `sprout_gate`. */
export const sproutGate = (data: number): SkillGate | undefined => gateOf('sprout', TREE_DEFS[treeSpecies(data)].name.toLowerCase());

/* ---- Rock: seams, veins and plain faces ------------------------------------------------------------------------ */

/** The gate on mining a rock, by what it yields: its seam's, or its plain face's (`STONE_GATE`). */
export const rockGate = (rock: { yields: string }): SkillGate | undefined =>
  gateOf(isSeam(rock) ? 'seam' : 'stone', rock.yields);

/**
 * Cutting a rock, bare or under a building (Mine, Chip corner, Mine out the cellar): its gate for somebody, or null. A
 * seam's by its mining, less `below` (a Miner's Ore Sense); a plain stone's (rock, sandstone, slate, marble) by its
 * quarrying. "Marble: needs mining 30; have 12.0." The island's `rock_gate_refusal`.
 */
export const rockGateRefusal = (rock: { yields: string; name: string }, viewer: Viewer, below = 0): string | null => {
  const gate = rockGate(rock);
  if (!gate) return null;
  return skillGateRefusal(rock.name, gate.skill, viewer.skills.get(gate.skill), gate.kind === 'seam' ? Math.max(0, gate.level - below) : gate.level);
};

/** Whoever reads a gate or looks at an item for themselves: a skill by its id. A `Game` is one. */
export interface Viewer {
  skills: { get(id: string): number };
}

/** What a vein is called by somebody under its prospecting gate (`VEIN_GATE`). */
export const UNIDENTIFIED_METAL = UNIDENTIFIED_VEIN.name;

/** What an unidentified vein says of itself: no level, which would name the metal (`VEIN_GATE` is one level a metal). */
export const VEIN_UNREAD = `More ${skillWord('prospecting')} required to identify this vein.`;

/**
 * A vein's name as somebody sees it: a bare one (`exposed`, a Rock tile) always its own; a buried one its own at or over
 * its prospecting gate, else "Unidentified metal". Plain stone is always itself. The island's `seen_vein_at`; an item's
 * is `seenName`.
 */
export const seenVein = (rock: { yields: string; name: string }, viewer: Viewer, exposed = false): string =>
  (veinTip(rock, viewer, exposed) ? UNIDENTIFIED_METAL : rock.name);

/**
 * Why a vein is "Unidentified metal" to somebody: "More prospecting required to identify this vein.", or null for a bare
 * one, one at or over its gate, or plain stone. The island's `vein_tip_at`.
 */
export const veinTip = (rock: { yields: string }, viewer: Viewer, exposed = false): string | null => {
  // One the island did not name to you (`UNIDENTIFIED_ROCK`), bare or not: there is nothing here to name it by.
  if (rock.yields === UNIDENTIFIED_VEIN.yields) return VEIN_UNREAD;
  if (exposed) return null;
  const g = gateOf('vein', rock.yields);
  return g && viewer.skills.get(g.skill) < g.level ? VEIN_UNREAD : null;
};

/**
 * A rock kind as the island sends it to somebody (`rpc_land_window`): `UNIDENTIFIED_ROCK` for a buried seam over their
 * prospecting gate, else itself; a bare one (`tile` Rock) always itself. The island's `rock_unseen` and `mask_rock`.
 */
export const seenRock = (kind: number, viewer: Viewer, tile?: number): number => {
  const rock = ROCK_VARIANTS[kind];
  return rock && isSeam(rock) && veinTip(rock, viewer, tile === TileType.Rock) ? UNIDENTIFIED_ROCK : kind;
};

/** Whether prospecting going from `was` to `now` names a vein it did not (`VEIN_GATE`): the land is read again. */
export const veinGateCrossed = (was: number, now: number | undefined): boolean =>
  now !== undefined && Object.values(VEIN_GATE).some((lv) => was < lv && now >= lv);

/* ---- Wagons and boats ---------------------------------------------------------------------------------------------- */

/** The gate on taking the reins or the helm of a piece: a wagon's by driving, a boat's by sailing; none for a cart. */
export const helmGate = (kind: string): SkillGate | undefined => gateOf('vehicle', kind) ?? gateOf('boat', kind);

/** Whether somebody at `skill` in a gate's skill may work it: the same rule for a person and a worker. */
export const gateOpen = (g: SkillGate | undefined, skill: number): boolean => !g || skill >= g.level;

/** A worker's level in a skill: its own, 1 where it has none. */
export const workerLevel = (c: { skills: Record<string, number> }, skill: string): number => c.skills[skill] ?? 1;

/**
 * Whether a worker may work a gate: its own level in the gate's skill, not its trade's. A miner at a stone face reads
 * its mining. Not a hod carrier's build gates, which read its level (`hodMay`). The island's `worker_gate_open`.
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

const itemsOf = (gate: SkillGate): GatedItem[] =>
  (GATE_ITEMS[gate.kind]?.(gate) ?? []).map((x) => ({ item: x.item, extra: x.extra ?? '', gate, noun: x.noun }));

/** Every gated item, in the table's order. */
const ITEMS: GatedItem[] = ALL.flatMap(itemsOf);
export const GATED_ITEMS: readonly GatedItem[] = ITEMS;

const checkItem = (x: GatedItem): void => {
  if (!ITEM_DEFS[x.item]) throw new Error(`${x.gate.kind} ${x.gate.id}: no item ${x.item}`);
};
for (const x of ITEMS) checkItem(x);

const ITEM_GATE = new Map(ITEMS.map((x) => [`${x.item}:${x.extra}`, x]));

/**
 * What of an item's `extra` says which gate is on it, by item id, where not all of it does: a fragment's relic, not its
 * part ("old pot 1/2" is "old pot"). The island's `gate_item_extra`.
 */
const EXTRA_KEYS: Record<string, (extra: string) => string> = {};
/** The lower-case key of an item's `extra` its gate is found by (`EXTRA_KEYS`). */
export const gateExtra = (item: { id: string; extra?: string }): string => {
  const extra = (item.extra ?? '').toLowerCase();
  return EXTRA_KEYS[item.id]?.(extra) ?? extra;
};

/** The skills with gates, in the order the Skills window lists skills. */
const SKILLS_GATED: string[] = [...new Set(ALL.map((g) => g.skill))];
export const GATED_SKILLS: readonly string[] = SKILLS_GATED;

/**
 * Gates and gated items added by the module that holds the things (`craftgates.ts`), once, at load: rows of kinds not
 * held here, their items (`GATE_ITEMS`), and how an item's `extra` names its thing (`EXTRA_KEYS`).
 */
export const addGates = (
  rowsAdded: readonly SkillGate[],
  items: Partial<Record<GateKind, (g: SkillGate) => Array<{ item: string; extra?: string; noun: string }>>> = {},
  extraKeys: Record<string, (extra: string) => string> = {},
): void => {
  Object.assign(GATE_ITEMS, items);
  Object.assign(EXTRA_KEYS, extraKeys);
  for (const g of rowsAdded) {
    checkGate(g);
    if (BY_KEY.has(`${g.kind}:${g.id}`)) throw new Error(`${g.kind} ${g.id}: gated twice`);
    BY_KEY.set(`${g.kind}:${g.id}`, g);
    ALL.push(g);
    for (const x of itemsOf(g)) {
      checkItem(x);
      if (ITEM_GATE.has(`${x.item}:${x.extra}`)) throw new Error(`${x.item} ${x.extra}: gated twice`);
      ITEMS.push(x);
      ITEM_GATE.set(`${x.item}:${x.extra}`, x);
    }
  }
  ALL.sort(bySkillLevel);
  ITEMS.sort((a, b) => bySkillLevel(a.gate, b.gate) || a.item.localeCompare(b.item) || a.extra.localeCompare(b.extra));
  SKILLS_GATED.splice(0, SKILLS_GATED.length, ...new Set(ALL.map((g) => g.skill)));
};

/** The gate on an item's use, or undefined: anybody uses it. */
export const itemGate = (item: { id: string; extra?: string }): GatedItem | undefined =>
  ITEM_GATE.get(`${item.id}:${gateExtra(item)}`) ?? ITEM_GATE.get(`${item.id}:`);

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

/** A skill's gates in level order, each met or not at `have`; one line a name at a level. */
export const unlocksOf = (skill: string, have: number): Unlock[] =>
  gatesOn(skill).map((g) => ({ name: g.name, level: g.level, met: have >= g.level }));

/** Over this many gates, a skill's Unlocks list is one row a level (`unlockRows`): taming's kinds, fishing, cooking, carpentry. */
export const UNLOCKS_GROUPED_OVER = 15;
/** The names a level's row shows before "… (+N)". */
export const UNLOCK_ROW_NAMES = 3;

/** One row of a skill's Unlocks list: a gate ("Oak 5"), or a level's gates ("16: Logchewer, Snufflet, Pip, … (+4)"). */
export interface UnlockRow {
  label: string;
  level: number;
  met: boolean;
  /** Every name the row stands for. */
  names: string[];
}

/**
 * A skill's Unlocks as the Skills window lists them: a row a gate, or over `UNLOCKS_GROUPED_OVER` gates a row a level,
 * its names joined, the first `UNLOCK_ROW_NAMES` and "… (+N)" for the rest.
 */
export const unlockRows = (skill: string, have: number): UnlockRow[] => {
  const list = unlocksOf(skill, have);
  if (list.length <= UNLOCKS_GROUPED_OVER) return list.map((u) => ({ label: `${u.name} ${u.level}`, level: u.level, met: u.met, names: [u.name] }));
  const rungs = new Map<number, string[]>();
  for (const u of list) rungs.set(u.level, [...(rungs.get(u.level) ?? []), u.name]);
  return [...rungs].map(([level, names]) => {
    const more = names.length - UNLOCK_ROW_NAMES;
    return { label: `${level}: ${names.slice(0, UNLOCK_ROW_NAMES).join(', ')}${more > 0 ? `, … (+${more})` : ''}`, level, met: have >= level, names };
  });
};

/** A skill's gates in level then name order, one a name at a level (five herb teas are one "Herb tea 5"). */
const gatesOn = (skill: string): SkillGate[] => {
  const seen = new Set<string>();
  return SKILL_GATES.filter((g) => g.skill === skill).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
    .filter((g) => !seen.has(`${g.level}:${g.name}`) && !!seen.add(`${g.level}:${g.name}`));
};

/**
 * A skill's next threshold, for its bar in the Skills window: "10: Maple", the lowest gate over `have`, the first of
 * that level in the table's order, "+2 more" for the others there; null with none left.
 */
export const nextUnlockBar = (skill: string, have: number): string | null => {
  const over = gatesOn(skill).filter((g) => g.level > have);
  if (!over.length) return null;
  const at = SKILL_GATES.filter((g) => g.skill === skill && g.level === over[0].level);
  const names = [...new Set(at.map((g) => g.name))];
  return `${over[0].level}: ${names[0]}${names.length > 1 ? ` +${names.length - 1} more` : ''}`;
};

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
  for (const g of gatesOn(skill)) rungs.set(g.level, [...(rungs.get(g.level) ?? []), g.name]);
  const and = (xs: string[]): string => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
  return [...rungs].map(([level, names]) => `${and(names)} ${level}`).join('; ');
};

