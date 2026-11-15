/**
 * Skill gates: the one rule for what a skill level opens.
 *
 * A thing has at most one gate, a skill and a level (`SkillGate`). Under it the thing is refused, for a person and for a
 * worker alike; at it, allowed. Every gate is held here, once, and the island has the same table (`skill_gate`, emitted
 * by `npm run defs` from `SKILL_GATES`), the same check (`skill_gate_refusal`) and the same words (`skillGateRefusal`):
 *
 *   "Willow: needs woodcutting 70; have 12.4."
 *
 * which is the form mining has always refused a seam in. A menu shows a gated action greyed with those words as its
 * hint (the context menu does that for any refusal); the Skills window lists each skill's gates, ticked or not
 * (`unlocksOf`, `unlocksSaid`); the help says them per skill off the same list.
 *
 * A worker uses the same gate against its own level in the task's skill: it never picks the thing its level could not
 * work, and an idle one with only gated work in reach says so (`IdleWhy` 'gate', the island's `gate_idle`).
 *
 * Levels sit on `GATE_LADDER`, so gates land on few steps a player can learn. See docs/gating.md for the whole table
 * this is the start of: trees, seams, veins, stone faces, kinds tamed, fish, wagons and boats are on it.
 *
 * A leaf: game, UI, defs and tests read it.
 */
import { SKILL_BY_ID } from './skills';
import { isSeam, ROCK_VARIANTS, TREE_DEFS, treeAge, treeSpecies, UNIDENTIFIED_ROCK, UNIDENTIFIED_VEIN } from '../world/tiles';

/** The steps a gate's level is chosen from. */
export const GATE_LADDER = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90] as const;
export type GateLevel = (typeof GATE_LADDER)[number];

/**
 * What sort of thing a gate is on, which with `id` keys it: a tree species by its lower-case name; a seam, a vein and a
 * stone face by what the rock yields; a kind of wildermon by its species id; a fish by its id; a wagon or a boat by its
 * piece's id.
 */
export type GateKind = 'tree' | 'seam' | 'vein' | 'stone' | 'tame' | 'fish' | 'vehicle' | 'boat';

/** What each evolution stage past the first adds to a kind's taming gate (`TAME_GATE`). The island's `wild_stage_tame`. */
export const TAME_STAGE_GATE = 15;

/** What a gate of each kind stops, as the help says it. */
export const GATE_STOPS: Readonly<Record<GateKind, string>> = {
  tree: 'felling a tree with logs: Cut down, Coppice, a feller\'s work',
  seam: 'mining a seam: Mine, Chip corner, Mine out the cellar, a miner\'s work; less with Ore Sense; the Ironemole line exempt',
  vein: 'naming a vein: Prospect, a marked tile, a prospector\'s find; under it "Unidentified metal"',
  stone: 'quarrying a plain face: Mine, Chip corner, a quarrier\'s work',
  tame: `taming a kind: Tame, Take catch; +${TAME_STAGE_GATE} an evolution stage`,
  fish: 'catching a fish: under it, not in the catch',
  vehicle: 'taking the reins',
  boat: 'taking the helm or the oars',
};

export interface SkillGate {
  kind: GateKind;
  /** The thing within its kind: a tree's lower-case name. */
  id: string;
  /** Its name as the game says it: "Willow". */
  readonly name: string;
  skill: string;
  /** On `GATE_LADDER`, but for the kinds that kept the numbers they had before it (`KEPT_OFF_LADDER`). */
  level: number;
}

/** The kinds whose levels were gates before the ladder and keep their numbers: taming 6, 8, 12 …; fish 15, 35, 45. */
export const KEPT_OFF_LADDER: ReadonlySet<GateKind> = new Set<GateKind>(['tame', 'fish']);

/**
 * Felling a tree that has logs in it (Cut down, Coppice; a feller's work), by woodcutting. Asked for: pine least,
 * birch, oak and maple early, willow most. The rest by their wood's difficulty (`materials.ts`): 0-1 at 20, 2 at 30,
 * 3 at 40, 4-5 at 50, 6 at 60. A tree with no logs yet is cleared by anybody.
 */
export const TREE_GATE: Readonly<Record<string, GateLevel>> = {
  Pine: 1,
  Birch: 5,
  Oak: 10,
  Maple: 20,
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
  Willow: 70,
};

/**
 * Seams by mining, by what the seam yields: the levels the rock list held (`ROCK_VARIANTS`), kept. Ore Sense lowers each
 * by its rank (`ore:below`); the Ironemole line mines any (`SpeciesDef.anySeam`).
 */
export const SEAM_GATE: Readonly<Record<string, GateLevel>> = {
  copper_ore: 1,
  coal: 1,
  iron_ore: 5,
  tin_ore: 10,
  zinc_ore: 20,
  lead_ore: 30,
  silver_ore: 40,
  gold_ore: 50,
  adamantine_ore: 60,
  glimmersteel_ore: 70,
  mithril_ore: 80,
  seryll_ore: 90,
};

/**
 * Naming a vein by prospecting: each seam's mining level. Under it the vein is marked and glows as any other, and is
 * "Unidentified metal" (`seenVein`).
 */
export const VEIN_GATE: Readonly<Record<string, GateLevel>> = SEAM_GATE;

/** Quarrying a plain stone face by mining, by what it yields: rock 1, sandstone 10, slate 20, marble 30. */
export const STONE_GATE: Readonly<Record<string, GateLevel>> = {
  rock_shards: 1,
  sandstone_shards: 10,
  slate_shards: 20,
  marble_shards: 30,
};

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

/** Every gate, in skill then level then id order. */
export const SKILL_GATES: readonly SkillGate[] = [
  ...TREE_DEFS.map((t): SkillGate => {
    const level = TREE_GATE[t.name];
    if (level === undefined) throw new Error(`${t.name}: no woodcutting gate`);
    return { kind: 'tree', id: t.name.toLowerCase(), name: t.name, skill: 'woodcutting', level };
  }),
  ...rockRows(),
  ...rows('tame', 'taming', TAME_GATE),
  ...rows('fish', 'fishing', FISH_GATE),
  ...rows('vehicle', 'driving', VEHICLE_GATE),
  ...rows('boat', 'sailing', BOAT_GATE),
].sort((a, b) => a.skill.localeCompare(b.skill) || a.level - b.level || a.id.localeCompare(b.id));

for (const g of SKILL_GATES) {
  if (!KEPT_OFF_LADDER.has(g.kind) && !(GATE_LADDER as readonly number[]).includes(g.level)) throw new Error(`${g.kind} ${g.id}: ${g.level} is not on the ladder`);
  if (!SKILL_BY_ID.has(g.skill)) throw new Error(`${g.kind} ${g.id}: no skill ${g.skill}`);
}

const BY_KEY = new Map(SKILL_GATES.map((g) => [`${g.kind}:${g.id}`, g]));

/** The gate on a thing, or undefined: it is open to all. The island's `skill_gate`. */
export const gateOf = (kind: GateKind, id: string): SkillGate | undefined => BY_KEY.get(`${kind}:${id}`);

/** A skill as the refusal says it: "animal husbandry". */
export const skillWord = (skill: string): string => (SKILL_BY_ID.get(skill)?.name ?? skill.replace(/_/g, ' ')).toLowerCase();

/**
 * The one refusal: null at or over the level, else "Willow: needs woodcutting 70; have 12.4." The island's
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

/* ---- Rock: seams, veins and plain faces ------------------------------------------------------------------------ */

/** The gate on mining a rock, by what it yields: its seam's, or its plain face's (`STONE_GATE`). */
export const rockGate = (rock: { yields: string }): SkillGate | undefined =>
  gateOf(isSeam(rock) ? 'seam' : 'stone', rock.yields);

/** Whoever reads a gate for themselves: a skill by its id. A `Game` is one. */
export interface Viewer {
  skills: { get(id: string): number };
}

/** What a vein is called by somebody under its prospecting gate (`VEIN_GATE`). */
export const UNIDENTIFIED_METAL = UNIDENTIFIED_VEIN.name;

/**
 * A vein's name as somebody sees it: its own at or over its prospecting gate, else "Unidentified metal". Plain stone is
 * always itself. The island's `seen_vein`; an item's is `seenName`.
 */
export const seenVein = (rock: { yields: string; name: string }, viewer: Viewer): string =>
  (veinTip(rock, viewer) ? UNIDENTIFIED_METAL : rock.name);

/** Why a vein is "Unidentified metal" to somebody: "5 prospecting required to identify this vein.", or null. The island's `vein_tip`. */
export const veinTip = (rock: { yields: string }, viewer: Viewer): string | null => {
  // One the island would not name to you (`UNIDENTIFIED_ROCK`): which gate it is under would name it.
  if (rock.yields === UNIDENTIFIED_VEIN.yields) return `More ${skillWord('prospecting')} required to identify this vein.`;
  const g = gateOf('vein', rock.yields);
  return g && viewer.skills.get(g.skill) < g.level ? `${g.level} ${skillWord(g.skill)} required to identify this vein.` : null;
};

/**
 * A rock kind as the island sends it to somebody (`rpc_land_window`): `UNIDENTIFIED_ROCK` for a seam over their
 * prospecting gate, else itself. The island's `rock_unseen` and `mask_rock`.
 */
export const seenRock = (kind: number, viewer: Viewer): number => {
  const rock = ROCK_VARIANTS[kind];
  return rock && isSeam(rock) && veinTip(rock, viewer) ? UNIDENTIFIED_ROCK : kind;
};

/** Whether prospecting going from `was` to `now` names a vein it did not (`VEIN_GATE`): the land is read again. */
export const veinGateCrossed = (was: number, now: number | undefined): boolean =>
  now !== undefined && Object.values(VEIN_GATE).some((lv) => was < lv && now >= lv);

/* ---- Wagons and boats ---------------------------------------------------------------------------------------------- */

/** The gate on taking the reins or the helm of a piece: a wagon's by driving, a boat's by sailing; none for a cart. */
export const helmGate = (kind: string): SkillGate | undefined => gateOf('vehicle', kind) ?? gateOf('boat', kind);

/** Whether a worker at `skill` in a gate's skill may work it: the same rule as a person's. */
export const gateOpen = (g: SkillGate | undefined, skill: number): boolean => !g || skill >= g.level;

/* ---- What a skill opens, for the Skills window and the help ----------------------------------------------------- */

/** One gate on a skill as the Skills window lists it: met or not at a level. */
export interface Unlock {
  name: string;
  level: number;
  met: boolean;
}

/** A skill's gates in level order, each met or not at `have`. */
export const unlocksOf = (skill: string, have: number): Unlock[] =>
  gatesOn(skill).map((g) => ({ name: g.name, level: g.level, met: have >= g.level }));

/** A skill's gates in level then name order. */
const gatesOn = (skill: string): SkillGate[] =>
  SKILL_GATES.filter((g) => g.skill === skill).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

/** Whether a skill has any gate on it. */
export const hasUnlocks = (skill: string): boolean => SKILL_GATES.some((g) => g.skill === skill);

/** The next of a skill's gates: "Next: Birch at 5 (yours 1.0)", or null with every one met. */
export const nextUnlockSaid = (skill: string, have: number): string | null => {
  const next = unlocksOf(skill, have).find((u) => !u.met);
  return next ? `Next: ${next.name} at ${next.level} (yours ${have.toFixed(1)})` : null;
};

/** A skill's gates grouped by level, for the help: "Pine 1; Birch 5; Oak 10; Fig, Maple and Peach 20". */
export const unlocksSaid = (skill: string): string => {
  const rungs = new Map<number, string[]>();
  for (const g of gatesOn(skill)) rungs.set(g.level, [...(rungs.get(g.level) ?? []), g.name]);
  const and = (xs: string[]): string => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
  return [...rungs].map(([level, names]) => `${and(names)} ${level}`).join('; ');
};

/** The skills with gates, in the order the Skills window lists skills. */
export const GATED_SKILLS: readonly string[] = [...new Set(SKILL_GATES.map((g) => g.skill))];
