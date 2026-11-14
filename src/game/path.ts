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
import { STARTER_FOOD, type Game } from './game';
import { foundingRefusal } from './actions';
import { layingBill } from './buildActions';
import { FIRE_COST } from './campfire';
import { GATHER_VERB, SPECIES, type SpeciesDef } from './creatures';
import { DEED_UPGRADES, UPGRADE_WORKERS } from './deed';
import { DEED_STONE_GAP, deedRadiusAt, deedWorkersAt, MAX_DEED_LEVEL } from './deedsize';
import { BOTANIZE_TABLE, FORAGE_TABLE } from './forage';
import { fruitSeason, fruitsIn } from './fruiting';
import { itemDef } from './items';
import { defaultKey } from './keybinds';
import { LAIR_KINDS } from './lairs';
import { METALS, MOULDS, mouldLumps } from './metal';
import { isFounder } from './ranks';
import { RECIPE_BY_ID } from './recipes';
import { hasRunestones, RUNESTONES, stoneGap, stonePoint } from './runestones';
import { SKILL_BY_ID } from './skills';
import { bearingTo } from './tracking';
import { listed } from './words';
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
  if (got) return `Bait: ${name(got.item)} ×${got.n} (Path supply, ${got.season})`;
  const now = dietInSeason(def, season);
  if (!now.length) return `Bait: ${name(supplyItem(def))} ×${supplySize(def)} (Path supply, ${season})`;
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
    label: () => `Eat ${name(STARTER_FOOD)}: Eat`,
    met: (g) => did(g, `ate:${STARTER_FOOD}`) > 0 || g.inventory.count(STARTER_FOOD) === 0,
  },
  {
    id: 'forage', phase: 'stone', skills: ['foraging'],
    label: (g) => {
      const season = fruitSeason(g.wallNow());
      const finds = FORAGE_TABLE.map(([id]) => id).filter((id) => !id.endsWith('_seed') && fruitsIn(id, season));
      return `Forage ×${PATH_FORAGE}: grass or forest tile · finds now: ${listed(finds.map(name))}, seeds`;
    },
    met: (g) => did(g, 'forage') >= PATH_FORAGE || skilled(g, 'foraging'),
  },
  {
    id: 'track', phase: 'stone', tame: 'bevere', skills: ['tracking'],
    label: () => `Track ${kind('bevere').name}: Field guide (${defaultKey('win_guide')}), Track`,
    met: (g) => did(g, 'track:bevere') > 0 || tamedKind(g, 'bevere'),
  },
  {
    id: 'tame', phase: 'stone', tame: 'bevere', skills: ['taming'],
    label: (g) => tameLine(g, 'tame', 'bevere'),
    met: (g) => tamedKind(g, 'bevere'),
  },
  {
    id: 'around', phase: 'stone', skills: [],
    label: () => {
      const def = kind('bevere');
      return `Work around me: ${def.name} · ${def.gathers ? GATHER_VERB[def.gathers] : ''}`;
    },
    met: (g) => g.creatures.aroundYou().some((c) => c.species === 'bevere')
      || (tally(g, 'around') > 0 && g.creatures.yours().some((c) => c.species === 'bevere')),
  },
  {
    id: 'tree', phase: 'stone', skills: ['woodcutting'],
    label: () => `Cut down a tree: ${name('hatchet')}`,
    met: (g) => tally(g, 'tree') > 0,
  },
  {
    id: 'shafts', phase: 'stone', skills: ['carpentry'],
    label: () => {
      const r = recipe('make_shafts');
      return `Shafts: ${r.n} ${name(r.input)} → ${r.makes}; campfire takes ${FIRE_COST}`;
    },
    met: (g) => tally(g, 'made:shaft') > 0,
  },
  {
    id: 'fish', phase: 'stone', skills: ['fishing'],
    label: () => `Fish ×${PATH_FISH}: ${name('fishing_rod')}, at the shore`,
    met: (g) => Object.entries(g.tally).reduce((n, [k, v]) => n + (k.startsWith('fish:') ? v : 0), 0) >= PATH_FISH,
  },
  {
    id: 'cook', phase: 'stone', skills: ['cooking'],
    label: () => `Campfire (${FIRE_COST} ${name('shaft')}s), light it; cook the fish → ${name('cooked_fish')}`,
    met: (g) => tally(g, 'fire') > 0 && tally(g, 'made:cooked_fish') > 0,
  },
  // B. Set out.
  {
    id: 'walk', phase: 'out', skills: [],
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
    label: (g) => {
      const s = g.pathSites[0];
      return s ? `Site: ${siteSays(s)}` : `Site: trees ≥${PATH_SITE.trees} in ${PATH_SITE.treeReach} · water in ${PATH_SITE.water} · rock in ${PATH_SITE.rock}`;
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
    label: () => `Found the settlement: ${name('deed_stake')}, border ${deedRadiusAt(1)}`,
    met: (g) => !!founded(g),
  },
  {
    id: 'assign', phase: 'one', tame: 'bevere', skills: [],
    label: () => `Assign ${kind('bevere').name} to the settlement (${deedWorkersAt(1)}/${deedWorkersAt(1)})`,
    met: (g) => working(g, 'bevere'),
  },
  // D. Level 2.
  {
    id: 'crate', phase: 'two', skills: ['carpentry'],
    label: () => {
      const r = recipe('make_log_crate');
      return `Log crate: ${r.n} ${name(r.input)}s, ${name('mallet')}; place inside the border`;
    },
    met: (g) => wants(g, 2, 0),
  },
  {
    id: 'campfire', phase: 'two', skills: [],
    label: () => `Campfire inside the border: ${FIRE_COST} ${name('shaft')}s`,
    met: (g) => wants(g, 2, 1),
  },
  { id: 'up2', phase: 'two', skills: [], label: () => upgradeLine(2), met: (g) => levelAt(g, 2) },
  {
    id: 'clay', phase: 'two', skills: ['digging'],
    label: () => `Dig ${name('clay')} ×${PATH_CLAY}: ${name('shovel')}, clay tile`,
    met: (g) => did(g, 'clay') >= PATH_CLAY || g.inventory.count('clay') >= PATH_CLAY,
  },
  {
    id: 'chiptail', phase: 'two', tame: 'quarra', skills: ['taming'],
    label: (g) => assignLine(g, 'chiptail', 'quarra', 2, 'Track, tame, assign'),
    met: (g) => working(g, 'quarra'),
  },
  // E. Level 3.
  {
    id: 'bricks', phase: 'three', skills: ['stonecutting', 'mining'],
    label: () => {
      const r = recipe('make_stone_brick');
      return `${itemDef('stone_brick').name} ×${SMELTER_BRICKS()}: ${Math.ceil(SMELTER_BRICKS() / r.makes)} × ${name(r.input)} (mine rock), ${name('chisel')}`;
    },
    met: (g) => tally(g, 'made:stone_brick') >= SMELTER_BRICKS() || tally(g, 'made:smelter') > 0 || wants(g, 3, 0),
  },
  {
    id: 'mortar', phase: 'three', skills: ['masonry'],
    label: () => {
      const r = RECIPE_BY_ID.get('make_mortar');
      const goes = Math.ceil(SMELTER_MORTAR() / (r?.count ?? 1));
      return `${itemDef('mortar').name} ×${SMELTER_MORTAR()}: ${(r?.inputs ?? []).map((i) => `${goes * (i.count ?? 1)} × ${name(i.item)}`).join(', ')}`;
    },
    met: (g) => tally(g, 'made:mortar') >= SMELTER_MORTAR() || tally(g, 'made:smelter') > 0 || wants(g, 3, 0),
  },
  {
    id: 'smelter', phase: 'three', skills: ['masonry'],
    label: () => `Smelter: ${SMELTER_BRICKS()} ${name('stone_brick')}s, ${SMELTER_MORTAR()} ${name('mortar')}, ${name('trowel')}; inside the border`,
    met: (g) => wants(g, 3, 0),
  },
  { id: 'up3', phase: 'three', skills: [], label: () => upgradeLine(3), met: (g) => levelAt(g, 3) },
  {
    id: 'prospect', phase: 'three', skills: ['prospecting'],
    label: () => `Prospect a seam: rock tile, ${name('pickaxe')}`,
    met: (g) => did(g, 'prospect') > 0 || skilled(g, 'prospecting'),
  },
  {
    id: 'ironemole', phase: 'three', tame: 'mola', skills: ['taming'],
    label: (g) => assignLine(g, 'ironemole', 'mola', 3, 'Tame, assign'),
    met: (g) => working(g, 'mola'),
  },
  // F. Level 4.
  {
    id: 'lumps', phase: 'four', skills: ['smelting'],
    label: () => `Smelt ore ×${ANVIL_LUMPS} → ${ANVIL_LUMPS} lumps; fuel by hand`,
    met: (g) => anvilLumps(g) || wants(g, 4, 0) || g.inventory.count('anvil') > 0,
  },
  {
    id: 'anvil', phase: 'four', skills: ['blacksmithing'],
    label: () => `${ANVIL_MOULD.name}: ${ANVIL_MOULD.sand} ${name('sand')}; cast the anvil: ${ANVIL_LUMPS} lumps; set down inside the border`,
    met: (g) => wants(g, 4, 0),
  },
  { id: 'up4', phase: 'four', skills: [], label: () => upgradeLine(4), met: (g) => levelAt(g, 4) },
  {
    id: 'snailglow', phase: 'four', tame: 'embra', skills: ['taming'],
    label: (g) => assignLine(g, 'snailglow', 'embra', 4, 'Tame, assign'),
    met: (g) => working(g, 'embra'),
  },
  // G. Level 5.
  {
    id: 'pack', phase: 'five', skills: ['digging'],
    label: () => `Pack a dirt tile inside the border: ${name('shovel')}`,
    met: (g) => did(g, 'pack') > 0 || packedOnDeed(g),
  },
  {
    id: 'plan', phase: 'five', skills: [],
    label: () => `Plan a building ${PATH_BUILD}×${PATH_BUILD} inside the border`,
    met: (g) => plannedOnDeed(g),
  },
  {
    id: 'walls', phase: 'five', skills: ['carpentry'],
    label: () => {
      // A building's ground-floor walls: its border, both ways round.
      const walls = 2 * (PATH_BUILD + PATH_BUILD);
      const bill = layingBill('log', 'solid');
      return `Log walls ×${walls}: ${Object.entries(bill.total).map(([item, n]) => `${n} ${name(item)}s`).join(', ')} each, ${name('mallet')}`;
    },
    met: (g) => wants(g, 5, 0),
  },
  {
    id: 'workers', phase: 'five', skills: [],
    label: (g) => `Wildermon working the settlement: ${g.creatures.workers().length}/${UPGRADE_WORKERS}`,
    met: (g) => wants(g, 5, 1),
  },
  { id: 'up5', phase: 'five', skills: [], label: () => upgradeLine(5), met: (g) => levelAt(g, 5) },
  {
    id: 'chestkit', phase: 'five', tame: 'magga', skills: ['taming'],
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
/** Every skill the Path trains, steps and detours. */
export const PATH_SKILLS: readonly string[] = [...new Set([...PATH_STEPS, ...PATH_DETOURS].flatMap((s) => s.skills ?? []))];

/** What a site says: "Trees 14 · Water 6 · Rock 11 · Lair: none". */
export const siteSays = (s: PathSite): string =>
  `Trees ${s.trees} · Water ${s.water} · Rock ${s.rock} · Lair: ${s.lair ? `${s.lair} ${s.lairAt ?? ''}`.trim() : 'none'}`;

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
  if (!s) return `Path: ${PATH_STEPS.length}/${PATH_STEPS.length} done`;
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
export function pathCheck(g: Game): void {
  if (!g.thePath?.on) return;
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
      g.logMsg(step ? `Path: ${stepNumber(step)}/${PATH_STEPS.length} done.` : `Path: ${s.label(g)}: done.`, 'skill');
      g.events.emit('path');
    }
  }
}

/** The tame step a supply is due for now: the current one, its kind with nothing in season, and none claimed yet. */
export function supplyDue(g: Game, state: PathState | null = g.thePath): string | null {
  const s = currentStep(g);
  if (!state?.on || !s || !PATH_TAMES.some(([id]) => id === s.id) || state.supply[s.id]) return null;
  return needsSupply(kind(s.tame as string), fruitSeason(g.wallNow())) ? s.id : null;
}

/** The nearest seen lair of a kind to a place, for a site's line; the island names its own. */
export const lairName = (k: string): string => LAIR_KINDS.find((l) => l.id === k)?.name ?? k;
