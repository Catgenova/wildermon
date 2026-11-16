/**
 * The Path: an optional run of steps from the runestone to a settlement at its last level, one at a time.
 *
 * Asked for: "an optional, step-by-step tutorial". Each step is a label with its numbers taken from the rules, and a
 * question about the island's state (`met`); the island asks the same question of its own state (`thepath_met`)
 * before it keeps a tick, so a step is done when the island says so. Ticked ids go up with the journal's
 * (`path:<id>`, `rpc_settle`), and stay ticked. Any step may be skipped; one done early ticks itself.
 *
 * What only this side shows, and the island never needs: the labels, the arrows and which step is current.
 */
import { FIRST_TAME_SAYS, firstTameSure } from './firsttame';
import type { Game } from './game';
import { KIT_QL, STARTER_FOOD, STARTER_FOOD_COUNT } from './kit';
import { ACTION_BY_ID, foundingRefusal } from './actions';
import { layingBill, PLAN_TOOL } from './buildActions';
import { FIRE_COST } from './campfire';
import { STATIONS, type StationKind } from './stations';
import { GATHER_VERB, SPECIES, type SpeciesDef } from './creatures';
import { DEED_UPGRADES, UPGRADE_WORKERS } from './deed';
import { DEED_STONE_GAP, deedRadiusAt, deedWorkersAt, MAX_DEED_LEVEL } from './deedsize';
import { BOTANIZE_TABLE, FORAGE_TABLE } from './forage';
import { fruitSeason, fruitsIn } from './fruiting';
import { foodFill, itemDef } from './items';
import { boundKey, defaultKey } from './keybinds';
import { FieldGuide, whereItLives } from './guide';
import { MATERIAL_BY_ID } from './building';
import { FISH } from './fishing';
import { AROUND_MOST } from './around';
import { LAIR_KINDS } from './lairs';
import { METALS, MOULDS, mouldLumps, ORE_PER_LUMP } from './metal';
import { isFounder } from './ranks';
import { RECIPE_BY_ID } from './recipes';
import { hasRunestones, RUNESTONES, stoneGap, stonePoint } from './runestones';
import { SKILL_BY_ID } from './skills';
import { bearingTo, trackLevel, trackRange, TRACK_SHOW } from './tracking';
import { capital, listed, listedOr, percent } from './words';
import { SKILL_GATES } from './skillgates';
import { PATH_TICK, type PathSite, type PathState } from './pathstate';
import { TileType } from '../world/tiles';
import type { Season } from '../world/calendar';

export { PATH_TICK } from './pathstate';

export type PathPhase = 'stone' | 'out' | 'one' | 'two' | 'three' | 'four' | 'five';
/** The phases, in order, and what each is called: the two before a settlement, then one a level. */
const LEVEL_PHASES: readonly PathPhase[] = ['one', 'two', 'three', 'four', 'five'];
export const PATH_PHASES: ReadonlyArray<readonly [PathPhase, string]> = [
  ['stone', 'At the runestone'],
  ['out', 'Set out'],
  ...LEVEL_PHASES.slice(0, MAX_DEED_LEVEL).map((p, i) => [p, `Level ${i + 1}`] as const),
];

/* ---- the numbers the steps ask for ------------------------------------------------------------------------------- */

/** Forage goes the second step asks for. */
export const PATH_FORAGE = 3;
/** Fish the eighth asks for, and clay the seventeenth. */
export const PATH_FISH = 1;
export const PATH_CLAY = 1;
/** The building the last level asks for, tiles across and deep. */
export const PATH_BUILD = 1;
/**
 * Skill points over a skill's start that count a step as done before the Path was on: somebody who turns it on with
 * a forager of some standing is not sent back to forage three times. A new body's first goes do not reach it.
 */
export const PATH_SKILLED = 5;
/** The chance a supply is sized for: enough offerings that the kind is tamed at least this often. */
export const PATH_SURE = 0.9;
/** The ten kinds turning the Path on notes in the field guide (`guide_noted`): Track takes them as if seen. */
export const PATH_KINDS = ['bevere', 'quarra', 'mola', 'embra', 'magga', 'rabba', 'wadd', 'holla', 'noot', 'crawler'] as const;

/**
 * What a suggested site asks of the ground round it (`rpc_thepath_sites`): at least `trees` trees within `treeReach`
 * tiles, water within `water`, bare rock within `rock`; `count` of them, the nearest to you first, looked for within
 * `reach` tiles of you every `every` tiles, no two within `apart` tiles of each other.
 */
export const PATH_SITE = { trees: 10, treeReach: 10, water: 15, rock: 20, count: 3, reach: 64, every: 4, apart: 12 } as const;

/** The anvil's mould, whose lumps the fourth level's smelting is sized by. */
const ANVIL_MOULD = MOULDS.find((m) => m.makes === 'anvil')!;
/** The lumps a common metal's anvil takes. */
export const ANVIL_LUMPS = ANVIL_MOULD.lumps;
/** A recipe's first input and its count, and what one go makes. */
const recipe = (id: string): { input: string; n: number; makes: number } => {
  const r = RECIPE_BY_ID.get(id);
  return { input: r?.inputs[0]?.item ?? '', n: r?.inputs[0]?.count ?? 1, makes: r?.count ?? 1 };
};
/** How many of an input a recipe's bill asks for. */
const billOf = (id: string, item: string): number => RECIPE_BY_ID.get(id)?.inputs.find((i) => i.item === item)?.count ?? 1;
/** What the smelter's recipe asks: stone bricks and mortar. */
export const SMELTER_BRICKS = (): number => billOf('make_smelter', 'stone_brick');
export const SMELTER_MORTAR = (): number => billOf('make_smelter', 'mortar');
const name = (id: string): string => itemDef(id).name.toLowerCase();
const kind = (id: string): SpeciesDef => SPECIES[id];

/* ---- seasons and supplies ---------------------------------------------------------------------------------------- */

/** What a kind eats that can be had in a season (every season before the year began). */
export const dietInSeason = (def: SpeciesDef, season: Season | null): string[] => def.diet.filter((id) => fruitsIn(id, season));
/**
 * Offerings that tame a kind at least `PATH_SURE` of the time at its own chance: the fewest `n` with `(1 - chance)^n`
 * at most `1 - PATH_SURE`. One try spends one.
 */
export function supplySize(def: SpeciesDef): number {
  const miss = 1 - def.tameChance;
  if (miss <= 0) return 1;
  return Math.max(1, Math.ceil(Math.log(1 - PATH_SURE + 1e-12) / Math.log(miss)));
}
/** What a tame step hands out when nothing a kind eats is in season: its favourite, the first of its diet. */
export const supplyItem = (def: SpeciesDef): string => def.diet[0];
/** Whether a kind's step needs a supply in a season: nothing it eats is had then. */
export const needsSupply = (def: SpeciesDef, season: Season | null): boolean => dietInSeason(def, season).length === 0;

/** The bait line of a tame step: what is in season, or the supply. */
export function baitSays(g: Game, step: string, def: SpeciesDef): string {
  const season = fruitSeason(g.wallNow());
  const got = g.thePath?.supply[step];
  if (got) return `Bait: ${name(got.item)} ×${got.n} (Guiding Light supply, ${got.season})`;
  const now = dietInSeason(def, season);
  if (!now.length) return `Bait: ${name(supplyItem(def))} ×${supplySize(def)} (Guiding Light supply, ${season})`;
  return `Bait: ${now.map(name).join(', ')} (in season)`;
}

/* ---- what the island counts ------------------------------------------------------------------------------------- */

const did = (g: Game, k: string): number => g.thePath?.did[k] ?? 0;
const tally = (g: Game, k: string): number => g.tally[k] ?? 0;
const skilled = (g: Game, skill: string): boolean => g.skills.get(skill) >= (SKILL_BY_ID.get(skill)?.start ?? 0) + PATH_SKILLED;
/** Your own settlement: the one you founded. */
export const founded = (g: Game): ReturnType<Game['myDeeds']>[number] | null => g.myDeeds().find((d) => isFounder(d)) ?? null;
const inDeed = (d: { x: number; y: number; radius: number }, x: number, y: number): boolean =>
  Math.abs(x - d.x) <= d.radius && Math.abs(y - d.y) <= d.radius;
/** A kind tamed: marked tamed in the guide, or one of yours. */
const tamedKind = (g: Game, sp: string): boolean => g.guide.has(sp, 'tamed') || g.creatures.yours().some((c) => c.species === sp);
/** One of a kind of yours working the settlement (not round you, not at a post). */
const working = (g: Game, sp: string): boolean => g.creatures.workers().some((c) => c.species === sp);
/** A requirement of an upgrade met on your settlement. */
const wants = (g: Game, level: number, i: number): boolean => {
  const d = founded(g);
  return !!d && !!DEED_UPGRADES[level]?.[i]?.met(g, d);
};
const levelAt = (g: Game, level: number): boolean => (founded(g)?.level ?? 0) >= level;
/** The nearest stone to a tile, and how far; null on an island without stones. */
export function nearestStone(g: Game, x: number, y: number): { name: string; gap: number; at: { x: number; y: number } } | null {
  const size = g.world.w;
  if (!hasRunestones(size)) return null;
  let best: { name: string; gap: number; at: { x: number; y: number } } | null = null;
  for (const s of RUNESTONES) {
    const gap = stoneGap(s, size, x, y);
    if (!best || gap < best.gap) best = { name: s.name, gap, at: stonePoint(s, size) };
  }
  return best;
}
/** Whether a lump stack held reaches an anvil: of one metal from ore. */
const anvilLumps = (g: Game): boolean => METALS.some((m) => m.ore !== null && g.inventory.count(m.lump) >= mouldLumps(ANVIL_MOULD, m.id));
/** A packed tile inside your border. */
function packedOnDeed(g: Game): boolean {
  const d = founded(g);
  if (!d) return false;
  for (let y = d.y - d.radius; y <= d.y + d.radius; y++) {
    for (let x = d.x - d.radius; x <= d.x + d.radius; x++) if (g.world.inBounds(x, y) && g.world.getTile(x, y) === TileType.PackedDirt) return true;
  }
  return false;
}
/** A building planned with a tile inside your border. */
const plannedOnDeed = (g: Game): boolean => {
  const d = founded(g);
  return !!d && [...g.buildings.list.values()].some((b) => b.tiles.some((k) => {
    const [x, y] = k.split(',').map(Number);
    return inDeed(d, x, y);
  }));
};

/* ---- the steps ------------------------------------------------------------------------------------------------- */

/** Where a step points: a place, with what to call it. */
export interface PathWhere {
  x: number;
  y: number;
  name: string;
}

export interface PathStep {
  id: string;
  phase: PathPhase;
  label(g: Game): string;
  /** The place the strip's arrow points at, when the step has one. */
  where?(g: Game): PathWhere | null;
  met(g: Game): boolean;
  /** The kind a tame step tames. */
  tame?: string;
  /** The skills it trains, for the coverage list. */
  skills?: readonly string[];
  /** How it is done, a line an action: where, the menu's label, the tool and the skill (`src/ui/pathcard.ts`). */
  how(g: Game): string[];
  /** What it is for: what it unlocks or feeds, with the step that takes it (`src/ui/pathcard.ts`). */
  why(g: Game): string[];
  /** What the card's picture plays (`src/ui/pathpreview.ts`). */
  show: PathShow;
}

/**
 * What the card's picture plays for a step (`src/ui/pathpreview.ts`): the figure at a job, playing that job's clip
 * (`clipOfJob`) with its tool, or `tool` where the job's is chosen by its target; or at an emote; or walking; and a
 * kind beside it.
 */
export interface PathShow {
  job?: string;
  tool?: string;
  emote?: string;
  walk?: boolean;
  kind?: string;
}

/** A step off the path: shown beside the one it fits, never in the way. */
export interface PathDetour {
  id: string;
  beside: string;
  label(g: Game): string;
  met(g: Game): boolean;
  tame?: string;
  skills?: readonly string[];
}

/* ---- the card's lines: how a step is done and what it is for ---------------------------------------------------- */

const skillName = (id: string): string => SKILL_BY_ID.get(id)?.name ?? id;
/** A tool and whether you carry one: "Hatchet (pack)". */
const toolSays = (g: Game, id: string): string => `${itemDef(id).name} (${g.inventory.count(id) > 0 ? 'pack' : 'not carried'})`;
/** The settlement level a step's phase is in: one for the first level's, nought before a settlement. */
const levelOf = (id: string): number => LEVEL_PHASES.indexOf(PATH_STEPS.find((s) => s.id === id)?.phase ?? 'stone') + 1;
/** Where a step stands on the Path: "step 31". */
const stepOf = (id: string): string => `step ${PATH_STEPS.findIndex((s) => s.id === id) + 1}`;
/** A job on the right-click menu with its tool and skill: "Right-click: a tree · Cut down · Hatchet (pack) · Woodcutting". */
export function jobSays(g: Game, on: string, id: string, tool?: string): string {
  const a = ACTION_BY_ID.get(id);
  const t = tool ?? a?.tool;
  return [`Right-click: ${on}`, a?.label ?? id, t ? toolSays(g, t) : '', a?.skill ? skillName(a.skill) : ''].filter(Boolean).join(' · ');
}
/** A station set down as a piece is (`stations.ts`): "Right-click: the ground · Set furniture down · Campfire · Q/E rotate · click to place". */
export const setDownSays = (on: string, kind: StationKind): string =>
  `Right-click: ${on} · Set furniture down · ${STATIONS[kind].name} · Q/E rotate · click to place`;
/** `goes` of a recipe in Crafting: "Crafting (R): Carve shafts · Log ×1 → Shaft ×4 · Carving knife (pack) · Carpentry". */
export function craftSays(g: Game, id: string, goes = 1): string {
  const r = RECIPE_BY_ID.get(id);
  if (!r) return `Crafting (${boundKey('win_craft')})`;
  const bill = r.inputs.map((i) => `${itemDef(i.item).name} ×${(i.count ?? 1) * goes}`).join(' + ');
  return [
    `Crafting (${boundKey('win_craft')}): ${r.label}${goes > 1 ? ` ×${goes}` : ''}`, `${bill} → ${itemDef(r.result).name} ×${(r.count ?? 1) * goes}`,
    r.station ? `At: ${r.station}` : '', r.tool ? toolSays(g, r.tool) : '', skillName(r.skill),
  ].filter(Boolean).join(' · ');
}
/** Goes of a recipe that make `n` of what it makes. */
const goesFor = (id: string, n: number): number => Math.ceil(n / (RECIPE_BY_ID.get(id)?.count ?? 1));
/** Where a kind lives, as the field guide says it: what it spawns on, and what it is near. */
const livesSays = (sp: string): string => whereItLives(kind(sp), true).filter((l) => l.startsWith('Spawns') || l.startsWith('Within')).join(' · ');
/** Track in the field guide: "Field guide (F4): Sapgnaw · Track · Tracking". */
const trackSays = (sp: string): string => `Field guide (${boundKey('win_guide')}): ${kind(sp).name} · ${ACTION_BY_ID.get('track')?.label ?? 'Track'} · ${skillName('tracking')}`;
/** Assign one following you: the job, and the workers the level holds. */
const assignSays = (g: Game, sp: string, level: number): string =>
  `${jobSays(g, `${kind(sp).name} (following)`, 'assign_deed')} · workers ${deedWorkersAt(level)} at level ${level}`;
/** A tame step's lines: where its kind lives, Track where the step asks it, Tame with the bait, Assign where it asks it. */
function tameHow(g: Game, step: string, sp: string, o: { track?: boolean; assign?: number } = {}): string[] {
  const def = kind(sp);
  return [
    livesSays(sp),
    ...(o.track ? [trackSays(sp)] : []),
    // (the job's skill last: its level after it, "Taming 1")
    `${jobSays(g, `wild ${def.name}`, 'tame')} ${def.tameLevel}`,
    // Your first tame, sure (`firsttame.ts`).
    ...(firstTameSure(g.player.firstTame, sp) ? [FIRST_TAME_SAYS] : []),
    baitSays(g, step, def),
    ...(o.assign ? [assignSays(g, sp, o.assign)] : []),
  ];
}
/** What a kind works at and what of the Path that feeds: "Sapgnaw: felling trees · Log ×64 for log walls (step 31)". */
const workSays = (sp: string, feeds: string): string => {
  const def = kind(sp);
  return `${def.name}: ${def.gathers ? GATHER_VERB[def.gathers] : 'no task'} · ${feeds}`;
};
/** The walls the last level's building takes: its ground floor's border, both ways round. */
const pathWalls = (): number => 2 * (PATH_BUILD + PATH_BUILD);
/** Logs those walls take, at a solid log wall's bill. */
const wallLogs = (): number => pathWalls() * (layingBill('log', 'solid').total.log ?? 0);
/** Rock shards the smelter's bricks take. */
const brickShards = (): number => goesFor('make_stone_brick', SMELTER_BRICKS()) * billOf('make_stone_brick', 'rock_shards');
/** The marks on what an upgrade asks: there on your settlement, or not yet. */
export const MET_MARK = '✔';
export const UNMET_MARK = '○';
/** What an upgrade asks, each marked met or not on your settlement: "A crate on the settlement ✔". */
const wantsSays = (g: Game, level: number): string =>
  `Level ${level} needs: ${(DEED_UPGRADES[level] ?? []).map((r, i) => `${r.label} ${wants(g, level, i) ? MET_MARK : UNMET_MARK}`).join(' · ')}`;
/** An upgrade step's lines. */
const upgradeHow = (g: Game, level: number): string[] => [
  `${jobSays(g, 'a tile inside the border', 'upgrade_deed')} · or Settlement (${boundKey('win_deed')})`, wantsSays(g, level),
];
/** What the next level asks, once this one is had: "Then level 3 needs: A stone smelter on the settlement". */
const thenSays = (level: number): string[] =>
  DEED_UPGRADES[level + 1] ? [`Then level ${level + 1} needs: ${DEED_UPGRADES[level + 1].map((r) => r.label).join(' · ')}`] : [`Level ${level}: the last`];
/** The fish you would cook: one in the pack, else the first there is. */
const fishHeld = (g: Game): string => FISH.find((f) => g.inventory.count(f.id) > 0)?.id ?? FISH[0].id;
/** A kind of the Path that eats something, with its step: "Snailglow (step 28)". */
const eatenBy = (item: string): string[] =>
  PATH_TAMES.filter(([, sp]) => kind(sp).diet.includes(item)).map(([step, sp]) => `${kind(sp).name} (${stepOf(step)})`);

const tameLine = (g: Game, step: string, sp: string, verb = 'Tame'): string =>
  `${verb} ${kind(sp).name} · ${baitSays(g, step, kind(sp))} · Taming ${kind(sp).tameLevel}`;
/** "Assign Chiptail (2/2)": the kind, and the workers the level holds. */
const assignLine = (g: Game, step: string, sp: string, level: number, verb: string): string =>
  `${verb} ${kind(sp).name} (${deedWorkersAt(level)}/${deedWorkersAt(level)}) · ${baitSays(g, step, kind(sp))} · Taming ${kind(sp).tameLevel}`;
const upgradeLine = (level: number): string =>
  `Upgrade → ${level}: border ${deedRadiusAt(level)}, workers ${deedWorkersAt(level)}`;

export const PATH_STEPS: readonly PathStep[] = [
  // A. At the runestone.
  {
    id: 'cheese', phase: 'stone', skills: [],
    how: (g) => [`Inventory (${boundKey('win_inventory')}): ${itemDef(STARTER_FOOD).name} · ${ACTION_BY_ID.get('eat')?.label ?? 'Eat'} · ×${g.inventory.count(STARTER_FOOD)} in the pack`],
    why: () => [`Food bar +${percent(foodFill(STARTER_FOOD, KIT_QL))} each · ×${STARTER_FOOD_COUNT} to full`],
    show: { job: 'eat' },
    label: () => `Eat ${name(STARTER_FOOD)}: Eat`,
    met: (g) => did(g, `ate:${STARTER_FOOD}`) > 0 || g.inventory.count(STARTER_FOOD) === 0,
  },
  {
    id: 'forage', phase: 'stone', skills: ['foraging'],
    how: (g) => [jobSays(g, 'a grass or forest tile', 'forage')],
    why: (g) => {
      const season = fruitSeason(g.wallNow());
      const finds = FORAGE_TABLE.map(([id]) => id).filter((id) => fruitsIn(id, season));
      const bait = finds.filter((id) => kind('bevere').diet.includes(id));
      return [`Finds: ${listed(finds.map(name))}`, `Bait for ${kind('bevere').name} (${stepOf('tame')}): ${bait.length ? listed(bait.map(name)) : 'none in season'}`];
    },
    show: { job: 'forage' },
    label: (g) => {
      const season = fruitSeason(g.wallNow());
      const finds = FORAGE_TABLE.map(([id]) => id).filter((id) => !id.endsWith('_seed') && fruitsIn(id, season));
      return `Forage ×${PATH_FORAGE}: grass or forest tile · finds now: ${listed(finds.map(name))}, seeds`;
    },
    met: (g) => did(g, 'forage') >= PATH_FORAGE || skilled(g, 'foraging'),
  },
  {
    id: 'track', phase: 'stone', tame: 'bevere', skills: ['tracking'],
    how: () => [trackSays('bevere'), `Noted (Guiding Light): ${PATH_KINDS.length} kinds, Track as if seen`],
    why: (g) => [`Track: arrow to the nearest ${kind('bevere').name}, ${TRACK_SHOW} s · reach ${trackRange(trackLevel(g.skills.get('tracking')))} tiles`],
    show: { job: 'track', kind: 'bevere' },
    label: () => `Track ${kind('bevere').name}: Field guide (${defaultKey('win_guide')}), Track`,
    met: (g) => did(g, 'track:bevere') > 0 || tamedKind(g, 'bevere'),
  },
  {
    id: 'tame', phase: 'stone', tame: 'bevere', skills: ['taming'],
    how: (g) => tameHow(g, 'tame', 'bevere'),
    why: () => [workSays('bevere', `${itemDef('log').name} ×${wallLogs()} for log walls (${stepOf('walls')})`), `Workers: ${deedWorkersAt(levelOf('assign'))} at level ${levelOf('assign')} (${stepOf('assign')})`],
    show: { job: 'tame', kind: 'bevere' },
    label: (g) => tameLine(g, 'tame', 'bevere'),
    met: (g) => tamedKind(g, 'bevere'),
  },
  {
    id: 'around', phase: 'stone', skills: [],
    how: (g) => [jobSays(g, `${kind('bevere').name} (following)`, 'work_around'), `Work around me: ${AROUND_MOST} at a time`],
    why: () => [workSays('bevere', `${itemDef('log').name} for shafts (${stepOf('shafts')}) and the log crate ×${billOf('make_log_crate', 'log')} (${stepOf('crate')})`)],
    show: { emote: 'point', kind: 'bevere' },
    label: () => {
      const def = kind('bevere');
      return `Work around me: ${def.name} · ${def.gathers ? GATHER_VERB[def.gathers] : ''}`;
    },
    met: (g) => g.creatures.aroundYou().some((c) => c.species === 'bevere')
      || (tally(g, 'around') > 0 && g.creatures.yours().some((c) => c.species === 'bevere')),
  },
  {
    id: 'tree', phase: 'stone', skills: ['woodcutting'],
    // The trees your woodcutting fells (`skillgates.ts`): "Right-click: a birch or pine".
    how: (g) => [jobSays(g, `a ${fellsSaid(g)}`, 'cut_down')],
    why: () => [`${itemDef('log').name}: shafts ×${recipe('make_shafts').makes} a log (${stepOf('shafts')}) · log crate ×${billOf('make_log_crate', 'log')} (${stepOf('crate')})`],
    show: { job: 'cut_down' },
    label: () => `Cut down a tree: ${name('hatchet')}`,
    met: (g) => tally(g, 'tree') > 0,
  },
  {
    id: 'shafts', phase: 'stone', skills: ['carpentry'],
    how: (g) => [craftSays(g, 'make_shafts')],
    why: () => [`Campfire: ${itemDef('shaft').name} ×${FIRE_COST} (${stepOf('cook')}, ${stepOf('campfire')})`],
    show: { job: 'make_shafts' },
    label: () => {
      const r = recipe('make_shafts');
      return `Shafts: ${r.n} ${name(r.input)} → ${r.makes}; campfire takes ${FIRE_COST}`;
    },
    met: (g) => tally(g, 'made:shaft') > 0,
  },
  {
    id: 'fish', phase: 'stone', skills: ['fishing'],
    how: (g) => [`${jobSays(g, 'water', 'fish')} · reach ${ACTION_BY_ID.get('fish')?.range ?? 1} tiles`],
    why: () => [`Fish → ${itemDef('cooked_fish').name} (${stepOf('cook')})`],
    show: { job: 'fish' },
    label: () => `Fish ×${PATH_FISH}: ${name('fishing_rod')}, at the shore`,
    met: (g) => Object.entries(g.tally).reduce((n, [k, v]) => n + (k.startsWith('fish:') ? v : 0), 0) >= PATH_FISH,
  },
  {
    id: 'cook', phase: 'stone', skills: ['cooking'],
    how: (g) => [
      `${setDownSays('the ground', 'campfire')} · ${itemDef('shaft').name} ×${FIRE_COST}`, jobSays(g, 'the campfire', 'light_campfire'),
      craftSays(g, `cook_${fishHeld(g)}`),
    ],
    why: () => [`${itemDef('cooked_fish').name}: food bar +${percent(foodFill('cooked_fish', KIT_QL))}`, `Bait for: ${listed(eatenBy('cooked_fish'))}`],
    show: { job: 'cook_perch' },
    label: () => `Campfire (${FIRE_COST} ${name('shaft')}s), light it; cook the fish → ${name('cooked_fish')}`,
    met: (g) => tally(g, 'fire') > 0 && tally(g, 'made:cooked_fish') > 0,
  },
  // B. Set out.
  {
    id: 'walk', phase: 'out', skills: [],
    how: (g) => [`Walk: the Guiding Light line's arrow · away from ${nearestStone(g, g.player.tileX, g.player.tileY)?.name ?? 'the runestone'}`],
    why: () => [`Found a settlement: ${DEED_STONE_GAP} tiles or more from every runestone`],
    show: { walk: true },
    label: (g) => {
      const s = nearestStone(g, g.player.tileX, g.player.tileY);
      return `Stone: ${Math.min(DEED_STONE_GAP, Math.floor(s?.gap ?? DEED_STONE_GAP))}/${DEED_STONE_GAP} tiles`;
    },
    where: (g) => {
      // Straight away from the nearest stone, the gap's length out from it.
      const s = nearestStone(g, g.player.tileX, g.player.tileY);
      if (!s) return null;
      const dx = g.player.x - s.at.x, dy = g.player.y - s.at.y;
      const d = Math.hypot(dx, dy) || 1;
      return { x: s.at.x + (dx / d) * (DEED_STONE_GAP + 1), y: s.at.y + (dy / d) * (DEED_STONE_GAP + 1), name: `Away from ${s.name}` };
    },
    met: (g) => !!founded(g) || (nearestStone(g, g.player.tileX, g.player.tileY)?.gap ?? DEED_STONE_GAP) >= DEED_STONE_GAP,
  },
  {
    id: 'site', phase: 'out', skills: [],
    how: (g) => [
      g.pathSites.length ? `Walk: the Guiding Light line's arrow · sites ${g.pathSites.length}, the nearest first` : `Sites: within ${PATH_SITE.reach} tiles of you, none yet`,
      `Or any tile: ${jobSays(g, 'the ground', 'found_settlement')} · the refusal names the rule`,
    ],
    // Only the trees your woodcutting fells count (`rpc_thepath_sites`): "Birch or pine ≥10 within 10".
    why: (g) => [
      `${capital(fellsSaid(g))} ≥${PATH_SITE.trees} within ${PATH_SITE.treeReach}: logs (${stepOf('walls')})`, `Water within ${PATH_SITE.water}: fish (${stepOf('fish')})`,
      `Rock within ${PATH_SITE.rock}: rock shards (${stepOf('bricks')})`,
    ],
    show: { walk: true },
    label: (g) => {
      const s = g.pathSites[0];
      return s ? `Site: ${siteSays(s, g)}` : `Site: ${fellsSaid(g)} ≥${PATH_SITE.trees} in ${PATH_SITE.treeReach} · water in ${PATH_SITE.water} · rock in ${PATH_SITE.rock}`;
    },
    where: (g) => {
      const s = g.pathSites[0];
      return s ? { x: s.x + 0.5, y: s.y + 0.5, name: 'Site' } : null;
    },
    met: (g) => !!founded(g) || foundingRefusal(g, g.player.tileX, g.player.tileY) === null,
  },
  // C. Level 1.
  {
    id: 'found', phase: 'one', skills: [],
    how: (g) => [`${jobSays(g, 'the ground', 'found_settlement')} · ${toolSays(g, 'deed_stake')}`],
    why: () => [`Level ${levelOf('found')}: border ${deedRadiusAt(levelOf('found'))}, workers ${deedWorkersAt(levelOf('found'))}`, ...thenSays(levelOf('found'))],
    show: { job: 'found_settlement' },
    label: () => `Found the settlement: ${name('deed_stake')}, border ${deedRadiusAt(1)}`,
    met: (g) => !!founded(g),
  },
  {
    id: 'assign', phase: 'one', tame: 'bevere', skills: [],
    how: (g) => [assignSays(g, 'bevere', levelOf('assign'))],
    why: () => [workSays('bevere', `range ${kind('bevere').workRange} tiles from the totem`), `Level ${MAX_DEED_LEVEL} needs: ${UPGRADE_WORKERS} working the settlement (${stepOf('workers')})`],
    show: { emote: 'point', kind: 'bevere' },
    label: () => `Assign ${kind('bevere').name} to the settlement (${deedWorkersAt(1)}/${deedWorkersAt(1)})`,
    met: (g) => working(g, 'bevere'),
  },
  // D. Level 2.
  {
    id: 'crate', phase: 'two', skills: ['carpentry'],
    how: (g) => [craftSays(g, 'make_log_crate'), jobSays(g, 'the ground inside the border', 'place_crate')],
    why: () => [`Level ${levelOf('crate')}: ${DEED_UPGRADES[levelOf('crate')][0].label}`],
    show: { job: 'make_log_crate' },
    label: () => {
      const r = recipe('make_log_crate');
      return `Log crate: ${r.n} ${name(r.input)}s, ${name('mallet')}; place inside the border`;
    },
    met: (g) => wants(g, 2, 0),
  },
  {
    id: 'campfire', phase: 'two', skills: [],
    how: () => [`${setDownSays('the ground inside the border', 'campfire')} · ${itemDef('shaft').name} ×${FIRE_COST}`],
    why: () => [`Level ${levelOf('campfire')}: ${DEED_UPGRADES[levelOf('campfire')][1].label}`],
    show: { job: 'build_campfire' },
    label: () => `Campfire inside the border: ${FIRE_COST} ${name('shaft')}s`,
    met: (g) => wants(g, 2, 1),
  },
  {
    id: 'up2', phase: 'two', skills: [],
    how: (g) => upgradeHow(g, levelOf('up2')),
    why: () => [upgradeLine(levelOf('up2')), ...thenSays(levelOf('up2'))],
    show: { job: 'upgrade_deed' },
    label: () => upgradeLine(2),
    met: (g) => levelAt(g, 2),
  },
  {
    id: 'clay', phase: 'two', skills: ['digging'],
    how: (g) => [jobSays(g, 'a clay tile', 'dig')],
    why: () => [
      `${itemDef('clay').name} ×${goesFor('make_mortar', SMELTER_MORTAR()) * billOf('make_mortar', 'clay')} for mortar (${stepOf('mortar')})`,
      `Bait for: ${listed(eatenBy('clay'))}`,
    ],
    show: { job: 'dig' },
    label: () => `Dig ${name('clay')} ×${PATH_CLAY}: ${name('shovel')}, clay tile`,
    met: (g) => did(g, 'clay') >= PATH_CLAY || g.inventory.count('clay') >= PATH_CLAY,
  },
  {
    id: 'chiptail', phase: 'two', tame: 'quarra', skills: ['taming'],
    how: (g) => tameHow(g, 'chiptail', 'quarra', { track: true, assign: levelOf('chiptail') }),
    why: () => [workSays('quarra', `${itemDef('rock_shards').name} ×${brickShards()} for stone bricks (${stepOf('bricks')})`)],
    show: { job: 'tame', kind: 'quarra' },
    label: (g) => assignLine(g, 'chiptail', 'quarra', 2, 'Track, tame, assign'),
    met: (g) => working(g, 'quarra'),
  },
  // E. Level 3.
  {
    id: 'bricks', phase: 'three', skills: ['stonecutting', 'mining'],
    how: (g) => [
      `${jobSays(g, 'a rock tile', 'mine')} → ${itemDef('rock_shards').name} ×${brickShards()}`,
      craftSays(g, 'make_stone_brick', goesFor('make_stone_brick', SMELTER_BRICKS())),
    ],
    why: () => [`Smelter: ${itemDef('stone_brick').name} ×${SMELTER_BRICKS()} (${stepOf('smelter')})`],
    show: { job: 'make_stone_brick' },
    label: () => {
      const r = recipe('make_stone_brick');
      return `${itemDef('stone_brick').name} ×${SMELTER_BRICKS()}: ${Math.ceil(SMELTER_BRICKS() / r.makes)} × ${name(r.input)} (mine rock), ${name('chisel')}`;
    },
    met: (g) => tally(g, 'made:stone_brick') >= SMELTER_BRICKS() || tally(g, 'made:smelter') > 0 || wants(g, 3, 0),
  },
  {
    id: 'mortar', phase: 'three', skills: ['masonry'],
    how: (g) => [jobSays(g, 'a sand tile', 'dig'), craftSays(g, 'make_mortar', goesFor('make_mortar', SMELTER_MORTAR()))],
    why: () => [`Smelter: ${itemDef('mortar').name} ×${SMELTER_MORTAR()} (${stepOf('smelter')})`],
    show: { job: 'make_mortar' },
    label: () => {
      const r = RECIPE_BY_ID.get('make_mortar');
      const goes = Math.ceil(SMELTER_MORTAR() / (r?.count ?? 1));
      return `${itemDef('mortar').name} ×${SMELTER_MORTAR()}: ${(r?.inputs ?? []).map((i) => `${goes * (i.count ?? 1)} × ${name(i.item)}`).join(', ')}`;
    },
    met: (g) => tally(g, 'made:mortar') >= SMELTER_MORTAR() || tally(g, 'made:smelter') > 0 || wants(g, 3, 0),
  },
  {
    id: 'smelter', phase: 'three', skills: ['masonry'],
    how: (g) => [craftSays(g, 'make_smelter'), setDownSays('the ground inside the border', 'smelter')],
    why: () => [`Level ${levelOf('smelter')}: ${DEED_UPGRADES[levelOf('smelter')][0].label}`, `Smelts: ore → lumps for the anvil ×${ANVIL_LUMPS} (${stepOf('anvil')})`],
    show: { job: 'make_smelter' },
    label: () => `Smelter: ${SMELTER_BRICKS()} ${name('stone_brick')}s, ${SMELTER_MORTAR()} ${name('mortar')}, ${name('trowel')}; inside the border`,
    met: (g) => wants(g, 3, 0),
  },
  {
    id: 'up3', phase: 'three', skills: [],
    how: (g) => upgradeHow(g, levelOf('up3')),
    why: () => [upgradeLine(levelOf('up3')), ...thenSays(levelOf('up3'))],
    show: { job: 'upgrade_deed' },
    label: () => upgradeLine(3),
    met: (g) => levelAt(g, 3),
  },
  {
    id: 'prospect', phase: 'three', skills: ['prospecting'],
    how: (g) => [jobSays(g, 'a rock tile', 'prospect')],
    why: () => [`Seams: ore for lumps (${stepOf('lumps')})`, `${kind('mola').name} (${stepOf('ironemole')}): ${livesSays('mola')}`],
    show: { job: 'prospect' },
    label: () => `Prospect a seam: rock tile, ${name('pickaxe')}`,
    met: (g) => did(g, 'prospect') > 0 || skilled(g, 'prospecting'),
  },
  {
    id: 'ironemole', phase: 'three', tame: 'mola', skills: ['taming'],
    how: (g) => tameHow(g, 'ironemole', 'mola', { assign: levelOf('ironemole') }),
    why: () => [workSays('mola', `ore ×${ANVIL_LUMPS * ORE_PER_LUMP} for lumps (${stepOf('lumps')})`)],
    show: { job: 'tame', kind: 'mola' },
    label: (g) => assignLine(g, 'ironemole', 'mola', 3, 'Tame, assign'),
    met: (g) => working(g, 'mola'),
  },
  // F. Level 4.
  {
    id: 'lumps', phase: 'four', skills: ['smelting'],
    how: (g) => [
      `${jobSays(g, 'the smelter', 'fuel_smelter')} · ${ACTION_BY_ID.get('light_smelter')?.label ?? 'Light'}`,
      `${jobSays(g, 'the smelter', 'smelt_ore')} · ore ×${ORE_PER_LUMP} → lump`,
    ],
    why: () => [`Anvil: lumps ×${ANVIL_LUMPS} of one metal (${stepOf('anvil')})`],
    show: { job: 'fuel_smelter' },
    label: () => `Smelt ore ×${ANVIL_LUMPS} → ${ANVIL_LUMPS} lumps; fuel by hand`,
    met: (g) => anvilLumps(g) || wants(g, 4, 0) || g.inventory.count('anvil') > 0,
  },
  {
    id: 'anvil', phase: 'four', skills: ['blacksmithing'],
    how: (g) => [craftSays(g, 'make_anvil_mould'), jobSays(g, 'the smelter', 'cast_anvil'), setDownSays('the ground inside the border', 'anvil')],
    why: () => [`Level ${levelOf('anvil')}: ${DEED_UPGRADES[levelOf('anvil')][0].label}`],
    show: { job: 'cast_anvil' },
    label: () => `${ANVIL_MOULD.name}: ${ANVIL_MOULD.sand} ${name('sand')}; cast the anvil: ${ANVIL_LUMPS} lumps; set down inside the border`,
    met: (g) => wants(g, 4, 0),
  },
  {
    id: 'up4', phase: 'four', skills: [],
    how: (g) => upgradeHow(g, levelOf('up4')),
    why: () => [upgradeLine(levelOf('up4')), ...thenSays(levelOf('up4'))],
    show: { job: 'upgrade_deed' },
    label: () => upgradeLine(4),
    met: (g) => levelAt(g, 4),
  },
  {
    id: 'snailglow', phase: 'four', tame: 'embra', skills: ['taming'],
    how: (g) => tameHow(g, 'snailglow', 'embra', { assign: levelOf('snailglow') }),
    why: () => [workSays('embra', `fuel for the campfire (${stepOf('campfire')}) and the smelter (${stepOf('smelter')})`)],
    show: { job: 'tame', kind: 'embra' },
    label: (g) => assignLine(g, 'snailglow', 'embra', 4, 'Tame, assign'),
    met: (g) => working(g, 'embra'),
  },
  // G. Level 5.
  {
    id: 'pack', phase: 'five', skills: ['digging'],
    how: (g) => [jobSays(g, 'a dirt tile inside the border', 'pack')],
    why: () => [`Plan building: on packed dirt (${stepOf('plan')})`],
    show: { job: 'pack' },
    label: () => `Pack a dirt tile inside the border: ${name('shovel')}`,
    met: (g) => did(g, 'pack') > 0 || packedOnDeed(g),
  },
  {
    id: 'plan', phase: 'five', skills: [],
    how: (g) => [jobSays(g, 'the packed tile', 'plan_building', PLAN_TOOL)],
    why: () => [`Building ${PATH_BUILD}×${PATH_BUILD}: walls ×${pathWalls()} (${stepOf('walls')})`],
    show: { job: 'plan_building', tool: PLAN_TOOL },
    label: () => `Plan a building ${PATH_BUILD}×${PATH_BUILD} inside the border`,
    met: (g) => plannedOnDeed(g),
  },
  {
    id: 'walls', phase: 'five', skills: ['carpentry'],
    how: (g) => [
      `${jobSays(g, 'each side', 'plan_wall', PLAN_TOOL)} · ${MATERIAL_BY_ID.get('log')?.name ?? 'Log'}`,
      `${jobSays(g, 'each side', 'build_wall', MATERIAL_BY_ID.get('log')?.tool)} · ${skillName(MATERIAL_BY_ID.get('log')?.skill ?? 'carpentry')}`,
    ],
    why: () => [`Level ${levelOf('walls')}: ${DEED_UPGRADES[levelOf('walls')][0].label}`],
    show: { job: 'build_wall', tool: MATERIAL_BY_ID.get('log')?.tool },
    label: () => {
      // A building's ground-floor walls: its border, both ways round.
      const walls = pathWalls();
      const bill = layingBill('log', 'solid');
      return `Log walls ×${walls}: ${Object.entries(bill.total).map(([item, n]) => `${n} ${name(item)}s`).join(', ')} each, ${name('mallet')}`;
    },
    met: (g) => wants(g, 5, 0),
  },
  {
    id: 'workers', phase: 'five', skills: [],
    how: (g) => [`${jobSays(g, 'a wildermon of yours (following)', 'assign_deed')} · working now ${g.creatures.workers().length}/${UPGRADE_WORKERS}`],
    why: () => [`Level ${levelOf('workers')}: ${DEED_UPGRADES[levelOf('workers')][1].label}`],
    show: { emote: 'point' },
    label: (g) => `Wildermon working the settlement: ${g.creatures.workers().length}/${UPGRADE_WORKERS}`,
    met: (g) => wants(g, 5, 1),
  },
  {
    id: 'up5', phase: 'five', skills: [],
    how: (g) => upgradeHow(g, levelOf('up5')),
    why: () => [upgradeLine(levelOf('up5')), ...thenSays(levelOf('up5'))],
    show: { job: 'upgrade_deed' },
    label: () => upgradeLine(5),
    met: (g) => levelAt(g, 5),
  },
  {
    id: 'chestkit', phase: 'five', tame: 'magga', skills: ['taming'],
    how: (g) => tameHow(g, 'chestkit', 'magga', { assign: levelOf('chestkit') }),
    why: () => [workSays('magga', `workers ${deedWorkersAt(levelOf('chestkit'))} at level ${levelOf('chestkit')}`)],
    show: { job: 'tame', kind: 'magga' },
    label: (g) => assignLine(g, 'chestkit', 'magga', 5, 'Tame, assign'),
    met: (g) => working(g, 'magga'),
  },
];

/** A detour's line: the kind, its bait and its taming. */
const detourTame = (g: Game, id: string, sp: string): string => tameLine(g, id, sp);

export const PATH_DETOURS: readonly PathDetour[] = [
  { id: 'snufflet', beside: 'forage', tame: 'rabba', label: (g) => detourTame(g, 'snufflet', 'rabba'), met: (g) => tamedKind(g, 'rabba') },
  { id: 'finlet', beside: 'fish', tame: 'wadd', label: (g) => detourTame(g, 'finlet', 'wadd'), met: (g) => tamedKind(g, 'wadd') },
  { id: 'puddlehop', beside: 'clay', tame: 'holla', label: (g) => detourTame(g, 'puddlehop', 'holla'), met: (g) => tamedKind(g, 'holla') },
  { id: 'mudlet', beside: 'mortar', tame: 'noot', label: (g) => detourTame(g, 'mudlet', 'noot'), met: (g) => tamedKind(g, 'noot') },
  { id: 'sandpip', beside: 'mortar', tame: 'crawler', label: (g) => detourTame(g, 'sandpip', 'crawler'), met: (g) => tamedKind(g, 'crawler') },
  {
    id: 'botanize', beside: 'ironemole', skills: ['botanizing'],
    label: (g) => {
      const season = fruitSeason(g.wallNow());
      const finds = BOTANIZE_TABLE.map(([id]) => id).filter((id) => !id.endsWith('_seed') && fruitsIn(id, season));
      return `Botanize: grass tile · finds now: ${listed(finds.map(name))}, seeds`;
    },
    met: (g) => did(g, 'botanize') > 0 || skilled(g, 'botanizing'),
  },
  {
    id: 'mine', beside: 'lumps', skills: ['mining'],
    label: () => `Mine a seam by hand: ${name('pickaxe')}`,
    met: (g) => tally(g, 'ore') > 0,
  },
];

export const PATH_STEP_BY_ID = new Map(PATH_STEPS.map((s) => [s.id, s]));
export const PATH_DETOUR_BY_ID = new Map(PATH_DETOURS.map((s) => [s.id, s]));
/** The tame steps and their kinds, which a supply may be handed out for. */
export const PATH_TAMES: ReadonlyArray<readonly [string, string]> = PATH_STEPS.filter((s) => s.tame && s.id !== 'track' && s.id !== 'assign')
  .map((s) => [s.id, s.tame as string] as const);
/**
 * The kinds every body's field guide starts with marked seen, by species id: every kind a step or a detour asks you to
 * track or tame (its `tame`), so Track takes each from the first minute. Asked for: "players are not starting the game
 * with Saginaw discovered in the field guide, so they cant track him", and "Make sure for those that already populate
 * as seen in the guide". The island's `guide_start` (the defs), marked at the join by `guide_begin`.
 */
export const GUIDE_START: readonly string[] = [...new Set([...PATH_STEPS, ...PATH_DETOURS].flatMap((s) => (s.tame ? [s.tame] : [])))];
/** A new body's book: each of `GUIDE_START` seen, nothing else. */
export const startGuide = (): FieldGuide => FieldGuide.fromJSON({ seen: [...GUIDE_START], tamed: [], bred: [] });

/**
 * How near a wild one of a kind you are to track or tame is put down, in tiles, where none of that kind, wild, is this
 * near already: each of `ASHORE_KINDS` as a new body comes ashore, and a step's or detour's kind as it comes up
 * (`PATH_STOCKS`). The island's `wild_near`, put by `private.wild_near_put`.
 */
export const WILD_NEAR = 12;
/** The kinds a wild one of is put near a new body as it comes ashore: the Track step's. The island's `ashore_kinds`. */
export const ASHORE_KINDS: readonly string[] = PATH_STEPS.filter((s) => s.id === 'track' && s.tame).map((s) => s.tame as string);

/**
 * The steps and detours whose kind is put down near you as it comes up (`WILD_NEAR`, the island's
 * `private.thepath_stock`), as [its id, the kind, the step it comes up with]: Track's and each tame step's, at the step
 * itself; each taming detour's, at the step it is beside. Not the assign step's: its kind is yours by then.
 */
export const PATH_STOCKS: ReadonlyArray<readonly [string, string, string]> = [
  ...PATH_STEPS.filter((s) => s.tame && s.id !== 'assign').map((s) => [s.id, s.tame as string, s.id] as const),
  ...PATH_DETOURS.filter((d) => d.tame).map((d) => [d.id, d.tame as string, d.beside] as const),
];
/**
 * The item a second wildermon is tamed into while one follows you (`tameRoomRefusal`, the island's
 * `tame_room_refusal`), and how many a tame step or taming detour hands out as it comes up, to a body carrying fewer
 * empty ones than the steps coming up with it ask for (the island's `private.thepath_stock`), once a step: one, since
 * each asks for one of its kind and a crate is taken only by a tame that takes (`shutIn`, `crate_shut_in`), never by a
 * failed offering or a catch that slips. Issued, as the supply is.
 */
export const PATH_CRATE = 'creature_crate';
export const PATH_CRATES = 1;
/** Every skill the Path trains, steps and detours. */
export const PATH_SKILLS: readonly string[] = [...new Set([...PATH_STEPS, ...PATH_DETOURS].flatMap((s) => s.skills ?? []))];

/**
 * The trees your woodcutting fells, by their gates (`skillgates.ts`): "birch or pine". A site counts only these
 * (`rpc_thepath_sites`).
 */
export const fellsSaid = (g: Game): string =>
  listedOr(SKILL_GATES.filter((x) => x.kind === 'tree' && x.level <= g.skills.get(x.skill)).map((x) => x.name.toLowerCase()));

/** What a site says: "Birch or pine 14 · Water 6 · Rock 11 · Lair: none", the trees counted the ones you fell. */
export const siteSays = (s: PathSite, g: Game): string =>
  `${capital(fellsSaid(g))} ${s.trees} · Water ${s.water} · Rock ${s.rock} · Lair: ${s.lair ? `${s.lair} ${s.lairAt ?? ''}`.trim() : 'none'}`;

/* ---- where you are on it -------------------------------------------------------------------------------------------- */

/** Whether a step is behind you: done, or skipped. */
export const pathPassed = (g: Game, id: string): boolean => g.pathDone.has(id) || !!g.thePath?.skip.includes(id);
/** The step you are on: the first neither done nor skipped; null at the end. */
export function currentStep(g: Game): PathStep | null {
  return PATH_STEPS.find((s) => !pathPassed(g, s.id)) ?? null;
}
/** Its number, from one, out of `PATH_STEPS.length`. */
export const stepNumber = (s: PathStep): number => PATH_STEPS.indexOf(s) + 1;

/** The strip's line: "7/34 · Tame Sapgnaw · Bait: … · Taming 1". */
export function stripSays(g: Game): string {
  const s = currentStep(g);
  if (!s) return `Guiding Light: ${PATH_STEPS.length}/${PATH_STEPS.length} done`;
  return `${stepNumber(s)}/${PATH_STEPS.length} · ${s.label(g)}`;
}

/** Where the current step points, and the bearing and distance to it from you; null for a step with no place. */
export function stripWhere(g: Game): { where: PathWhere; bearing: number; tiles: number } | null {
  const s = currentStep(g);
  const w = s?.where?.(g);
  if (!w) return null;
  return { where: w, bearing: bearingTo(g.player.x, g.player.y, w.x, w.y), tiles: Math.round(Math.hypot(w.x - g.player.x, w.y - g.player.y)) };
}

/**
 * Look over the steps for any newly met, while the Path is on: each ticks itself as the journal's goals do, and goes
 * up with them (`tickedGoal`), the island keeping it only once its own state says the same. Held as done here at
 * once; one the island has not yet said back is sent again every `PATH_RESEND` seconds until it does.
 */
export const PATH_RESEND = 30;
/** The games whose Path has been looked over since it came on in this page: the first look's ticks are not news. */
const LOOKED = new WeakSet<Game>();
export function pathCheck(g: Game): void {
  if (!g.thePath?.on) {
    LOOKED.delete(g);
    return;
  }
  const first = !LOOKED.has(g);
  LOOKED.add(g);
  const ticked: string[] = [];
  const all: Array<PathStep | PathDetour> = [...PATH_STEPS, ...PATH_DETOURS];
  for (const s of all) {
    if (g.pathHeard.has(s.id)) continue;
    const sent = g.pathSent.get(s.id);
    if (sent !== undefined && g.time - sent < PATH_RESEND) continue;
    let met = false;
    try {
      met = s.met(g);
    } catch {
      met = false;
    }
    if (!met) continue;
    const fresh = !g.pathDone.has(s.id);
    g.pathDone.add(s.id);
    g.pathSent.set(s.id, g.time);
    g.tickedGoal?.(`${PATH_TICK}${s.id}`);
    if (fresh) {
      const step = PATH_STEP_BY_ID.get(s.id);
      g.logMsg(step ? `Guiding Light: ${stepNumber(step)}/${PATH_STEPS.length} done.` : `Guiding Light: ${s.label(g)}: done.`, 'skill');
      g.events.emit('path');
      ticked.push(s.id);
    }
  }
  // The card's cue (`watchPathCards`): every step this look ticked at once, and whether it was the first look.
  g.events.emit('pathTicked', ticked, first);
}

/* ---- the card: what was done, and the next step's how and why (`src/ui/pathcard.ts`) ---------------------------- */

/** Seconds the card stays up before a job you start takes it down (`src/ui/pathcard.ts`). */
export const PATH_CARD_HOLD = 4;

/** A step or a detour named short: its label up to its first ": ", " · " or "; " ("Tame Sapgnaw", "Upgrade → 2"). */
export function doneSays(g: Game, id: string): string {
  const step = PATH_STEP_BY_ID.get(id);
  const s = step ?? PATH_DETOUR_BY_ID.get(id);
  if (!s) return id;
  const head = s.label(g).split(/: | · |; /)[0];
  return step ? head : `Detour: ${head}`;
}

/** What a card says: the steps just done, and the next step with its line, how, why and picture; null next at the end. */
export interface PathCardSays {
  done: string[];
  next: { id: string; line: string; how: string[]; why: string[]; show: PathShow } | null;
}
export function pathCardSays(g: Game, done: readonly string[]): PathCardSays {
  const s = currentStep(g);
  return {
    done: done.map((id) => doneSays(g, id)),
    next: s ? { id: s.id, line: `${stepNumber(s)}/${PATH_STEPS.length} · ${s.label(g)}`, how: s.how(g), why: s.why(g), show: s.show } : null,
  };
}

/**
 * When a card goes up: once for every look that ticks anything, naming all it ticked; the first look since the Path
 * came on in this page names nothing (what it ticks was met before), and puts the next step up only when the Path was
 * just turned on (`pathTurned`), not when the page opened with it on; the look after a turn on is taken as the first. `show`
 * is handed the ids done.
 */
export function watchPathCards(g: Game, show: (done: string[]) => void): void {
  let turned = false;
  g.events.on('pathTurned', (on) => {
    turned = on;
  });
  g.events.on('pathTicked', (ticked, first) => {
    // (turned off and on again between two looks: the look after is taken as the first)
    if (first || turned) {
      if (turned) show([]);
      turned = false;
      return;
    }
    if (ticked.length) show(ticked);
  });
}

/** The tame step a supply is due for now: the current one, its kind with nothing in season, and none claimed yet. */
export function supplyDue(g: Game, state: PathState | null = g.thePath): string | null {
  const s = currentStep(g);
  if (!state?.on || !s || !PATH_TAMES.some(([id]) => id === s.id) || state.supply[s.id]) return null;
  return needsSupply(kind(s.tame as string), fruitSeason(g.wallNow())) ? s.id : null;
}

/** The nearest seen lair of a kind to a place, for a site's line; the island names its own. */
export const lairName = (k: string): string => LAIR_KINDS.find((l) => l.id === k)?.name ?? k;
