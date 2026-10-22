export { TRY_LEARN, tryGain } from './learn';
import { GRASS_PER_CUT, MOSS_PER_CUT } from './limits';
import { PROSPECT_HEAD, tryGain } from './learn';
import { BURYABLE, BUSH_DEFS, SLAB_BY_ITEM, SLAB_VARIANTS, TILE_DEFS, TREE_AGES, TREE_DEFS, TileType, bushSpecies, packTreeData, slabVariant, treeAge, treeSpecies, treeVariant, lastDawn, nextDawn, type TreeAge, LAWN_AFTER, MOWN_TODAY, MOWING, mownDays, mownToday } from '../world/tiles';
import { FLOWER_ACTIONS, groundSays } from './wildflowers';
import { MOTE_ACTIONS } from './motes';
import { STONE_GUARDED, stoneGroundRefusal, TELESTONE, TELESTONE_ACTIONS, telestoneSays } from './runestones';
import { DAILY_RESET, isSeam, metres } from '../world/tiles';
import type { World } from '../world/world';
import { bedrockAt, oreAt } from '../world/ore';
import { BUILD_ACTIONS } from './buildActions';
import { CELLAR_ACTIONS, cellarFloorSaid, dropRefusal } from './cellar';
import { FRAME_ACTIONS, frameSays } from './frameActions';
import { jettyOver } from './frame';
import { ANVIL_ACTIONS } from './anvil';
import { POST_ACTIONS } from './posts';
import { FISHING_ACTIONS, fishJournal } from './fishing';
import { BREWING_ACTIONS } from './brewing';
import { CAMPFIRE_ACTIONS } from './campfire';
import { SMELTER_ACTIONS } from './smelter';
import { KILN_ACTIONS } from './kiln';
import { BUCKET_LITRES, FURNITURE_ACTIONS, furnitureCentre, LIQUID_NAME } from './furniture';
import { crateCentre } from './crates';
import { GEAR_ACTIONS } from './gear';
import { IMPROVE_ACTIONS, improvable } from './improve';
import { FARM_ACTIONS, glassSays } from './farming';
import { BUTCHER_ACTIONS } from './butcher';
import { ARCHAEOLOGY_ACTIONS } from './archaeology';
import { CIRCLET, CIRCLET_SET, CIRCLET_STONES, circletSays, circletWithRoom, gemOf, maybeGem, stonesOf } from './gems';
import { TREASURE_ACTIONS, maybeMap } from './treasure';
import { LOCK_ACTIONS } from './locks';
import { GATE_ACTIONS } from './gates';
import { FIRST_AID_ACTIONS } from './firstaid';
import { REMEDY_ACTIONS } from './remedies';
import { drawDye, dyeSourceFor, fillFromSource, PLACEABLE_ACTIONS, sourceFor, vesselBecomes, waterNear } from './placeables';
import { DYE_BUCKET, dyeIn, dyeSays, dyeHexOf } from './dyestuffs';
import { WHEY_BUCKET } from './dairy';
import { DEED_ACTIONS, deedAimed } from './deed';
import { CRATE_ACTIONS } from './crates';
import { CREATURE_ACTIONS } from './creatureActions';
import { CREATURE_CRATE_ACTIONS } from './creaturecrate';
import { HUSBANDRY_ACTIONS } from './husbandry';
import { DYE_ACTIONS } from './dyes';
import { TRAP_ACTIONS } from './traps';
import { BRIDGE_ACTIONS } from './bridges';
import { AQ_OVER, AQUEDUCT_ACTIONS } from './aqueducts';
import { SPRING_ACTIONS } from './springs';
import { FOUNDATION_ACTIONS } from './foundations';
import { STEPS_ACTIONS } from './steps';
import { GREEN_ACTIONS, greenNow } from './greening';
import { NAMING_ACTIONS } from './naming';
import { LANTERN_ACTIONS } from './lantern';
import { COUNTER_ACTIONS } from './counters';
import { LAMP_ACTIONS } from './lamps';
import { FAITH_ACTIONS } from './faith';
import { BAUBLE_ACTIONS } from './baubles';
import { engravedItemSays, MEMORIAL_ACTIONS } from './memorial';
import { VINEYARD_ACTIONS } from './vineyard';
import { CHART_ACTIONS, chartItemSays } from './cartography';
import { makerSays, SIGN_ACTIONS, signableKind } from './signing';
import { BEE_ACTIONS } from './bees';
import { SACRIFICE_ACTIONS } from './sacrifice';
import { ENCHANT_ACTIONS, enchantSays, knowJobs } from './enchanting';
import { MEDITATION_ACTIONS } from './meditation';
import { TRACK_ACTIONS } from './trackAction';
import { SPECIES, type Stance, takeArms } from './creatures';
import { BOTANIZE_TABLE, BOTANIZE_WATER_TABLE, COIN_FIND_ONE_IN, COIN_FINDS_A_DAY, EMPTY_CHANCE, FIND_CHECK, FORAGE_TABLE, listOf, rollsAt, rollTable } from './forage';
import { atWaterEdge, WATER_GARDEN_ACTIONS } from './watergarden';
import { CELLAR_DEPTH, CELLAR_LEVEL, floorOf, type FloorKind, type RoofShape, type Side, type StairHand, type WallType } from './building';
import { DEED_RADIUS, PROSPECT_MARK_TIME, type Game } from './game';
import { isFounder, lacks } from './ranks';
import { materialOfItem } from './materials';
import { boonOf, boonTime, clockLeft } from './boons';
import { helpingOf, NUTRIENTS } from './nutrition';
import { SKILL_DEFS } from './skills';
import {
  describeFrom, DRINK_LITRES, itemDef, itemName, itemWeight, litresOf, markOf, VESSELS, markSays, rarityOf, bagAdd, bagRefuses, bagSpare, isBag, storedLine, RARITIES, RARITY_WORD, rollRarity,
  NOT_RESTORED, unrestored, type Item,
} from './items';
import { capital } from './words';
import { fruitRefusal, fruitSeason, fruitingSays, inSeason } from './fruiting';
import { knackable, RECIPE_ACTIONS } from './recipes';

/**
 * What an action acts upon. Tile targets carry the corner nearest to the click
 * and, for building work, the border side plus what to plan there; item targets
 * may carry a quantity; ground targets name an item lying on a tile (uid null
 * means everything there).
 */
export type Target =
  | {
      kind: 'tile';
      x: number;
      y: number;
      cx: number;
      cy: number;
      side?: Side;
      wallType?: WallType;
      material?: string;
      floorKind?: FloorKind;
      /** For a single staircase, the half of the tile it runs up; none for the wide one (`StairHand`). */
      hand?: StairHand;
      /** Which shape of roof, when a roof is what is being planned. */
      roofShape?: RoofShape;
      /** The building a storey job is for, on a tile out past its footprint: a jetty's (`frame.ts`). */
      buildingId?: number;
      /** Wall work round a flat roof, on the roof's own level, rather than on the storey being worked. */
      terrace?: boolean;
      /** The storey a storey job is for, 0 the ground floor: the one the menu was showing (`jobLevel`). */
      level?: number;
      /** Subtile for placing objects. */
      sx?: number;
      sy?: number;
      itemUid?: number;
      /** Which way a piece being set down faces. */
      facing?: Side;
      /** Which cast is being called for, when one is. */
      spell?: string;
      /** The tile an aqueduct is led from, when one is being set out to pour into this one. */
      head?: [number, number];
      /**
       * The ground floor's slot over a cellar, for a flight or a ladder down:
       * storey nought whatever storey the building is being worked on
       * (`cellar.ts`).
       */
      down?: boolean;
      /** The kind a go of Track is after, from its page in the field guide; the tile is the one you stand on (`tracking.ts`). */
      species?: string;
    }
  | { kind: 'crate'; id: number; /** The scroll going into it where it stands, for `enchant` (`enchanting.ts`). */ scroll?: number }
  /** Somebody else on the island, by who they are (anybody dressing their wounds). */
  | { kind: 'person'; uid: string; name?: string }
  | { kind: 'campfire'; id: number; itemUid?: number; count?: number }
  | { kind: 'smelter'; id: number; itemUid?: number; count?: number; mouldUid?: number; /** The scroll going into it where it stands, for `enchant` (`enchanting.ts`). */ scroll?: number }
  | { kind: 'kiln'; id: number; itemUid?: number; count?: number; /** The scroll going into it where it stands, for `enchant` (`enchanting.ts`). */ scroll?: number }
  | {
      kind: 'furniture';
      id: number;
      itemUid?: number;
      count?: number;
      brew?: string;
      /** Which socket of its tier a bauble goes into, when one is asked for (`set_bauble`). */
      slot?: number;
      /** The scroll going into it where it stands, for `enchant` (`enchanting.ts`). */
      scroll?: number;
    }
  | { kind: 'anvil'; id: number; itemUid?: number; /** The scroll going into it where it stands, for `enchant` (`enchanting.ts`). */ scroll?: number }
  | { kind: 'post'; id: number; creature?: number }
  | { kind: 'trap'; id: number; /** The scroll going into it where it stands, for `enchant` (`enchanting.ts`). */ scroll?: number }
  | { kind: 'bridge'; id: number }
  | {
      kind: 'item';
      uid: number;
      count?: number;
      spell?: string;
      /**
       * The store this is going into, when the ask knows which one.
       *
       * It did not, and everything went into whichever container happened to
       * be nearest. Reported from a crate rack: "trying to place any items in
       * any of the pine crates gives an error that the maple crate is full" —
       * eight crates stand on one tile there, the nearest of them was the
       * maple, and every put was aimed at it however carefully you had opened
       * one of the others. A crate id for `store_in_crate`, a placed id for
       * `store_in_furniture`; left out, the nearest is still taken, which is
       * what an item's own menu means by "Put in crate".
       */
      into?: number;
      /**
       * A quality to stop improving at.
       *
       * Improving repeats until its own check refuses it, so a ceiling is all
       * a target quality needs to be: `improve.ts` refuses a piece already at
       * or above this, and the repeat stops there of its own accord. The
       * island reads the same field off the same target and refuses in the
       * same words, so "take it to sixty" means the same thing on both sides.
       */
      upto?: number;
      /** The soul going into this thing, for `absorb_soul`: the thing is the target, and the soul this. */
      soul?: number;
      /** The Runestone a Telestone is to take you to, for `travel_runestone` (`runestones.ts`). */
      stone?: string;
      /** The scroll going into this thing, for `enchant` (`enchanting.ts`): the weapon is the target, and the scroll this. */
      scroll?: number;
      /**
       * The wound on you this goes on (`woundKey`), for a dressing, the lye
       * and a salve, asked from the Health window: that wound or a refusal
       * naming why not, never another. Left out, each picks its own.
       */
      wound?: string;
    }
  /** What is lying on a tile; `down` for what lies on the cellar's floor under it. */
  | { kind: 'ground'; x: number; y: number; uid: number | null; down?: boolean }
  | { kind: 'creature'; id: number; stance?: Stance; itemUid?: number; job?: string; sex?: string; foe?: number; arrow?: string };

/**
 * A name an action cannot go anywhere without.
 *
 * Declared here rather than asked for inside `perform`, because on an island
 * `perform` runs on the island — there is nobody over there to ask. Every
 * action that needed a name used to ask for one in the one menu entry that
 * knew about it, and every other way of starting the same action sent it
 * without: the tile picker, the settlement panel, the toolbelt. The island
 * then either made a name up (`Homestead`) or refused (`Choose a name.`),
 * which is exactly what was reported from the island, both halves of it.
 *
 * `requestAction` is the one door every one of those paths goes through.
 */
export interface AsksName {
  question: string;
  /** What the box is filled with when it opens. */
  fallback?(t: Target, g: Game): string;
  /** Said in the log when nobody types one. */
  declined?: string;
  /** Longest name this one takes. */
  max?: number;
  /** An empty answer means something here, rather than being a refusal. */
  allowEmpty?: boolean;
}

export interface ActionDef {
  id: string;
  label: string;
  /** A label that reads off the target: "Collect clay" rather than "Collect". */
  labelFor?(t: Target, g: Game): string;
  /** What the action bar says while it is in hand, where that reads off the target: "Tracking a Reedpup" (`tracking.ts`). */
  doing?(t: Target, g: Game): string;
  /** Present participle used in messages: "You start digging." */
  verb: string;
  skill?: string;
  /** Item id of the tool that must be carried. */
  tool?: string;
  /** Tiles away the action can be done from; one (arm's length) by default. */
  range?: number;
  /** The same for whoever is doing it, where a perk reaches further (a Fisher's Long Cast): `range` otherwise. */
  rangeFor?(g: Game): number;
  /**
   * What a go wears the tool by, a go being one: a cast of a line is half a
   * swing of an axe. The island's performer for the job wears it the same.
   */
  wear?: number;
  /** Acts on the corner of the tile target rather than the tile itself. */
  corner?: boolean;
  /** Completes immediately without walking or a timer. */
  instant?: boolean;
  /** Keeps going while `perform` returns true. */
  repeat?: boolean;
  /** For item actions: offer "one" and "all" when the stack has more than one. */
  quantity?: boolean;
  /** Not listed by the generic menu; the UI offers it in its own way. */
  hidden?: boolean;
  /** For quantity actions: how many times it can be done now, for the "all" entry. */
  maxRepeat?(t: Target, g: Game): number;
  /** Stamina drained per completion (0..1). */
  stamina: number;
  /** Seconds at skill 1. */
  baseTime: number;
  difficulty?: number;
  applies(t: Target, g: Game): boolean;
  /** Returns a reason the action cannot be done right now, or null. */
  check?(t: Target, g: Game): string | null;
  /** A name to be typed before this can start. Asked once, by `requestAction`. */
  asks?: AsksName;
  /**
   * The litres of dye this takes, for a dyeing: which bucket or barrel it
   * draws from is chosen before it starts, by `requestAction`, where more
   * than one holds enough (`dyes.ts`), and goes to the island on the target
   * as `dyeFrom`. Null where it takes none.
   */
  dyeLitres?(t: Target, g: Game): number | null;
  /**
   * Something to be sure about first, in these words, or null if not.
   *
   * Same reason as `asks`: the confirmation used to live inside `perform`, so
   * on an island — where `perform` is the island's half — disbanding a
   * settlement asked nobody anything at all.
   */
  confirms?(t: Target, g: Game): string | null;
  /** Runs on completion. Return true to repeat. */
  perform(t: Target, g: Game): boolean | void;
}

/**
 * Ground a shovel can tread down into packed dirt: soil, anything growing on
 * it, and a trail feet have half done the job on -- which is how a path
 * people wore becomes a road: pack it, then pave it. The island's `packable`.
 */
/** What "Fill with water" tops up: a skin, and a bucket of water with room in it. The island's `water_holder`. */
export const WATER_HOLDERS: ReadonlySet<string> = new Set(['water_skin', 'water_bucket']);

const PACKABLE = new Set<number>([TileType.Dirt, TileType.Grass, TileType.Lawn, TileType.Steppe, TileType.Tundra, TileType.Moss, TileType.Trail]);

const DIGGABLE_PLANT_TILES = new Set<number>([TileType.Grass, TileType.Dirt, TileType.Moss, TileType.Lawn, TileType.Steppe, TileType.Tundra]);

/**
 * What a spadeful lays down: the ground each material makes of the tile it
 * covers. Dirt was the only thing that could be dropped, and a clay bank or a
 * beach could be dug up but never laid; now what comes out of a bed can go
 * back down as itself.
 */
export const SPOIL_TILE: Record<string, TileType> = { dirt: TileType.Dirt, clay: TileType.Clay, sand: TileType.Sand };
/**
 * The jobs that teach the body nothing at all.
 *
 * Every go trains the hands a little, and spending wind trains the chest —
 * which is right for work, and wrong for the three things that are not work.
 * Asked for: "no stats should be gained by eating, drinking, or moving items".
 * Putting something in your mouth, tipping a bucket, and carrying a thing from
 * a crate to your pack are not exercise, and a body that does them over and
 * over should be no steadier for it. The wind they cost is still spent: a cost
 * is not a lesson. The island keeps the same list in `teaches_nothing`, and a
 * test of its own holds the two of them together.
 */
export const TEACHES_NOTHING = new Set<string>([
  // Eating and drinking, and handing food to something else.
  'eat', 'drink', 'drink_from_vessel', 'drink_skin', 'feed',
  // Carrying things about, in and out of whatever holds them.
  'pick_up', 'pick_up_all', 'drop', 'crate_take_all', 'furniture_take_all',
  'kiln_take_all', 'smelter_take_all', 'store_in_crate', 'store_in_furniture', 'rack_put',
  'take_from_store', 'stow_item', 'empty_bag', 'throw_away', 'equip', 'unequip',
  // And pouring, which is carrying by another name.
  'fill_bucket', 'fill_skin', 'empty_bucket', 'empty_vessel', 'pour_into_barrel',
]);

/** The order a spadeful is looked for in, which is the order it was written in. */
export const SPOIL_ORDER = ['dirt', 'clay', 'sand'];

/** A word and its article: "an oak", "a pine". */
export const an = (word: string): string => `${/^[aeiou]/i.test(word) ? 'an' : 'a'} ${word}`;

/** "in 9 hours", "in 40 minutes", "within the hour". */
export function hoursHence(seconds: number): string {
  const s = Math.max(0, seconds);
  if (s >= 5400) return `in ${Math.round(s / 3600)} hours`;
  if (s >= 3000) return 'in about an hour';
  if (s >= 120) return `in ${Math.round(s / 60)} minutes`;
  return 'any moment';
}

/**
 * What is coming for a tree, and what to do about it: the woods turn over
 * once a day, at dawn, so the next stage is a matter of hours and the
 * sentence says which. Woods not yet turned since the last dawn turn any
 * moment; otherwise at the next. A stage whose next stage is itself has
 * nothing coming.
 */
export function treeOutlook(age: TreeAge, treesAt: number): string {
  if (age.next === age.id) return ' Clipped: does not age.';
  const now = Date.now() / 1000;
  const when = hoursHence((treesAt < lastDawn(now) ? now : nextDawn(now)) - now);
  const then = age.next === null ? 'gone' : TREE_AGES[age.next].name.toLowerCase();
  let out = ` Next age ${when}: ${then}.`;
  if (!age.alive) out += ' Fell it before then for its logs.';
  else if (age.pruned !== null && age.next !== null && !TREE_AGES[age.next].alive) out += ' Prune to keep it alive.';
  return out;
}

/** Forestry it takes to graft: a beginner's graft is a sprout thrown away. */
export const GRAFT_SKILL = 50;
/** A sprout of one of the three that bear, which is what a graft is made from. */
export const fruitSprout = (it: { id: string; extra?: string }): boolean =>
  it.id === 'sprout' && !!TREE_DEFS.find((d) => d.name === it.extra)?.fruit;

/**
 * The stage a sprout comes up at when it goes in the ground: a young tree,
 * which bears nothing yet. A Forester's Nursery (`grown:plant`) brings it up
 * that many stages further on, along the stages' own order.
 */
export const PLANTED_AGE = 0;
export const plantedAge = (steps: number): number => {
  let age = PLANTED_AGE;
  for (let i = 0; i < steps; i++) age = TREE_AGES[age].next ?? age;
  return age;
};
/**
 * A Forester's Coppice takes a tree grown enough to bear -- mature and older,
 * and living -- back to where a planted one starts, for its logs.
 */
export const coppiceable = (data: number): boolean => treeAge(data).alive && treeAge(data).bears;
/** The one tree a Forester's Tap Resin taps. */
export const RESIN_TREE = TREE_DEFS.findIndex((d) => d.name === 'Pine');
/** A living pine with timber in it: not a sapling, and not one clipped to a shrub. */
export const tappable = (data: number): boolean =>
  treeSpecies(data) === RESIN_TREE && treeAge(data).alive && treeAge(data).logs > 0;
/**
 * What a Forester's Clear Brush clears, and what it leaves: grass where a bush
 * stood, bare dirt where the reeds were.
 */
export const CLEARED_TO: Partial<Record<number, TileType>> = { [TileType.Bush]: TileType.Grass, [TileType.Reed]: TileType.Dirt };
/** The brush within `r` tiles of (x, y), that tile included. */
export function brushAround(w: World, x: number, y: number, r: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let ty = y - r; ty <= y + r; ty++) {
    for (let tx = x - r; tx <= x + r; tx++) {
      if (tx >= 0 && ty >= 0 && tx < w.w && ty < w.h && CLEARED_TO[w.getTile(tx, ty)] !== undefined) out.push([tx, ty]);
    }
  }
  return out;
}

const cornerName = (t: Target & { kind: 'tile' }): string => {
  const ns = t.cy === t.y ? 'north' : 'south';
  const ew = t.cx === t.x ? 'west' : 'east';
  return `${ns}-${ew}`;
};

const tile = (t: Target, g: Game): TileType => (t.kind === 'tile' ? g.world.getTile(t.x, t.y) : TileType.Sand);

/** Paving goes on a packed floor, never on sod or loose earth. */
const unpacked = (t: Target, g: Game): string | null =>
  tile(t, g) === TileType.PackedDirt ? null : 'Need packed dirt.';

/**
 * Terraforming is not allowed under a building, and the ground over a cellar
 * is left as it is while the cellar is there: said first, since it is the
 * reason that outlasts the other. The island's `under_building` and
 * `corner_under_building` say the same.
 */
export const CELLAR_UNDER = 'Cellar under this ground: no digging, raising or levelling over it.';
const underBuilding = (g: Game, x: number, y: number): string | null =>
  (g.buildings.cellar(x, y) ? CELLAR_UNDER : g.buildings.buildingAt(x, y) ? 'Not inside a building.' : null);
/** Nor at a corner of one, nor of its jetty, which stands a storey over that ground (`frame.ts`). */
const cornerUnderBuilding = (g: Game, cx: number, cy: number): string | null => {
  for (let y = cy - 1; y <= cy; y++) for (let x = cx - 1; x <= cx; x++) if (g.buildings.cellar(x, y)) return CELLAR_UNDER;
  for (let y = cy - 1; y <= cy; y++) for (let x = cx - 1; x <= cx; x++) if (g.buildings.buildingAt(x, y) || g.buildings.jettyAt(x, y)) return 'Not under a building.';
  return null;
};

/**
 * The storey a sweep of the ground gathers on: the pile's own for a pile, and
 * wherever you are standing for a tile -- a cellar's floor from down there.
 */
const sweepFloor = (g: Game, t: Target): number => (t.kind === 'ground' ? (t.down ? CELLAR_LEVEL : 0) : floorOf(g.player.level));

/** The four corners of a tile, north-west first and going clockwise. */
export const tileCorners = (x: number, y: number): Array<[number, number]> => [
  [x, y],
  [x + 1, y],
  [x + 1, y + 1],
  [x, y + 1],
];

/**
 * The height flattening works towards: the ground the player is standing on,
 * so a terrace can be carried outwards tile by tile. Standing on the tile
 * being flattened there is nothing to match, so it settles to its own lowest
 * corner and the ground only ever comes down.
 */
export function flattenTarget(g: Game, x: number, y: number): number {
  // A level taken is the mark for everything, and the reason to take one.
  if (g.level !== null) return g.level;
  const w = g.world;
  const heights = tileCorners(x, y).map(([cx, cy]) => w.getHeight(cx, cy));
  if (g.player.tileX === x && g.player.tileY === y) return Math.min(...heights);
  return Math.round(w.centerHeight(g.player.tileX, g.player.tileY));
}

/**
 * Why this corner is finished, when a level has been taken.
 *
 * The one thing a run of goes never knew was when to stop. Ask for
 * twenty-five spadefuls at a corner and you get twenty-five, whatever height
 * that leaves it at, and the only way to land on a number was to count. With
 * a level taken the door itself says when the corner is there, so a run of any
 * length stops exactly on it: the refusal ends the run the way every other
 * refusal does. `dir` is which way the job moves the ground.
 */
export function levelStop(g: Game, cx: number, cy: number, dir: -1 | 1): string | null {
  if (g.level === null) return null;
  const h = g.world.getHeight(cx, cy);
  if (dir < 0 && h <= g.level) return `Corner already at level ${metres(g.level)} m.`;
  if (dir > 0 && h >= g.level) return `Corner already at level ${metres(g.level)} m.`;
  return null;
}

/**
 * A spadeful, from the pack or out of a store you are standing beside.
 *
 * Twenty kilos a spadeful and a hundred and twenty on your back is six of
 * them, so moving a bank of earth is a great many walks to the crate and back.
 * A cart, a crate or a bin within reach is as good as a pocket for this one
 * job: the ground is what the load was fetched for. The pack comes first, so
 * nothing changes for anybody who is carrying their own.
 */
export function spoilFrom(g: Game, want: string[], uid?: number): { id: string; take: () => boolean } | undefined {
  if (uid !== undefined) {
    const chosen = g.inventory.get(uid);
    if (!chosen || !(chosen.id in SPOIL_TILE)) return undefined;
    return { id: chosen.id, take: () => !!g.inventory.remove(chosen.uid, 1) };
  }
  for (const id of want) {
    const held = g.inventory.items.find((it) => it.id === id);
    if (held) return { id, take: () => !!g.inventory.remove(held.uid, 1) };
  }
  const reach = g.perk('reach:soil', SPOIL_REACH);
  const near = (at: [number, number]): boolean => Math.hypot(at[0] - g.player.x, at[1] - g.player.y) <= reach;
  // One spadeful off the top of the pile, not the pile: a stack of five dirt
  // is one row, and lifting the row out of the crate would take all five.
  const one = (it: { count: number }, whole: () => boolean): boolean => {
    if (it.count > 1) {
      it.count -= 1;
      g.events.emit('crate');
      return true;
    }
    return whole();
  };
  // And only what stands on your own side of the ground floor: nothing up top is within reach of a cellar,
  // nor anything in the cellar next door (`onMySide`).
  for (const id of want) {
    for (const c of g.crates.values()) {
      const it = near(crateCentre(c)) && g.onMySide(c.level, c.x, c.y) ? c.items.find((o) => o.id === id) : undefined;
      if (it) return { id, take: () => one(it, () => !!g.crateTake(c, it.uid)) };
    }
    for (const f of g.furniture.values()) {
      // Not out of a grave, whoever's it is: what is in one is taken out through its own doors or not at all.
      if (f.grave) continue;
      const it = near(furnitureCentre(f)) && g.onMySide(f.level, f.x, f.y) ? f.items.find((o) => o.id === id) : undefined;
      if (it) return { id, take: () => one(it, () => !!g.furnitureTake(f, it.uid)) };
    }
  }
  return undefined;
}

/** True while any corner of the tile is off the height flattening aims at. */
export function needsFlattening(g: Game, x: number, y: number): boolean {
  const target = flattenTarget(g, x, y);
  return tileCorners(x, y).some(([cx, cy]) => g.world.getHeight(cx, cy) !== target);
}

/** The chance a swing cuts the rock face back, from skill and the pick. */
/**
 * How often working a face for its metal happens to bring a slab of it down.
 *
 * One swing in thirty. It was one in a hundred, which is hardly ever enough to
 * be a thing that happens: a seam worked for an afternoon sank a step or two
 * and the whole business read as a fixed wall you chipped at. A thirtieth is
 * still nobody's plan for moving rock -- `chip_corner` is the job for that,
 * and it comes off three swings in four -- but it is often enough that a face
 * you have been at all day is visibly lower than it was.
 *
 * The island holds the same number in `mine_collapse()`, and the browser's
 * miner, the browser's Mola and the island's all ask their own side for it.
 */
export const MINE_COLLAPSE = 1 / 30;

/** The ground a cut of grass is taken off: a grazza's as well as yours. */
export const CUT_GRASS = new Set<number>([TileType.Grass, TileType.Steppe, TileType.Lawn, TileType.Tundra]);
// What a cut of grass and of moss gives lives in the leaf (`limits.ts`), so a grazza's words can say it.
export { GRASS_PER_CUT, MOSS_PER_CUT } from './limits';
/** Reeds a cut gives, and the foraging at which a third is certain (a third one in this many points of it). */
export const REED_CUT = 2;
export const REED_EXTRA_AT = 140;

/** How many times a go of foraging or botanizing looks: by the skill, and once more for a Naturalist's Keen Eye. */
const searches = (g: Game, job: 'forage' | 'botanize', skill: string): number =>
  rollsAt(g.skills.get(skill)) + Math.floor(g.perk(`passes:${job}`, 0));

/**
 * The looks themselves, and what each turned up: none by chance on a share
 * of them (none at all for a Naturalist's Sure Find), then the skill, then the
 * table; and now and then a rare one for their Rare Find.
 */
function lookOver(g: Game, job: 'forage' | 'botanize', skill: string, all: Array<[string, number]>, rolls: number): string[] {
  const found: string[] = [];
  // Only what is in season is there to find (`fruiting.ts`), the rest at the weights they had.
  const table = inSeason(all, g.wallNow());
  for (let i = 0; i < rolls; i++) {
    if (g.rand() < EMPTY_CHANCE * g.perk(`empty:${job}`, 1) || !g.skillCheck(skill, FIND_CHECK)) continue;
    const id = rollTable(table, g.rand());
    // Only rolled for a Rare Find, so a look draws what it always drew without one.
    const odds = g.perk(`rare:${job}`, 0);
    const rare = odds > 0 ? rollRarity(() => g.rand(), odds) : 0;
    const item = g.gather(id, { ql: g.productQl(skill), rare });
    found.push(`${rare ? `${RARITIES[rare].name} ` : ''}${itemDef(id).name.toLowerCase()} (QL ${item.ql.toFixed(1)})`);
    if (rare) {
      g.note(RARITIES[rare].name);
      g.logMsg(RARITY_WORD[rare], 'skill');
    }
  }
  return found;
}

/** Quality nothing is repaired below: a thing mended often enough is finished in the end. */
export const REPAIR_FLOOR = 1;
/**
 * One go of repair at this skill: the damage it takes out, and the quality
 * it costs for every point of damage taken out.
 */
export const repairGo = (skill: number): { healed: number; cost: number } => ({
  healed: 1.2 + skill * 0.1,
  cost: Math.max(0.004, 0.03 - skill * 0.00026),
});

/** Fruit a picking takes off a tree in bearing and off an old one, at middling forestry. */
export const FRUIT_MATURE = 3;
export const FRUIT_OLD = 5;

/**
 * How deep the water over a face may be and still be worked, in height units.
 *
 * Reported from the island: a copper vein that would not be mined, with "You
 * cannot mine below the water level." and no water anywhere on the tile. Two
 * things were wrong in one line, `rockHeight(corner) <= 0`.
 *
 * It asked the wrong corner height. `rockHeight` is the surface less the soil
 * over it, so a corner shared with a meadow refuses a face standing fifty
 * units above the sea, on the grounds that the bedrock buried under the grass
 * beside it is below sea level. Water is a question about the surface, and the
 * surface is what `hasWater` reads and what the renderer draws.
 *
 * And it was a height out even where the two agree: `<= 0` refuses a face
 * standing *at* the waterline, and water is only drawn below it — so nought is
 * the one height that refuses and shows nothing, which is exactly where a
 * shore face sits.
 *
 * So: the corner's own height, and ten units of water allowed over it. That is
 * about waist deep at the tide line and you work standing in it, which is what
 * a shore quarry looks like. Past that you are swimming, and nobody swings a
 * pick while swimming.
 */
export const MINE_DEPTH = 10;

/** How far a spade reaches down through water, for this body: a Wader works deeper. */
export const digDepth = (g: Game): number => g.perk('depth:dig', MINE_DEPTH);

/**
 * How deep a bottom may lie and still be worked from a boat, in height
 * units: three times what a pick or a shovel works to from the shore. Past
 * that a spadeful comes up empty. The island reads the same number.
 */
export const DREDGE_DEPTH = 30;

/** How much a go of Flatten moves, in height units. */
export const FLATTEN_STEP = 1;

/** A tile's corners, which a Terraformer's Dig out the tile takes down together. */
export const TILE_CORNERS = 4;
/** And the base time of that one go, against four digs one after another. */
export const DIG_TILE_TIME = 16;

/**
 * How far soil is reached for when you drop it or flatten with it: the pack,
 * and then a cart or a container within this many tiles. A Terraformer's Long
 * Reach takes it further (`reach:soil`).
 */
export const SPOIL_REACH = 2.5;

/** Ground with anything living in it, and the damp ground that is full of them. */
export const WORMY = new Set<TileType>([TileType.Grass, TileType.Dirt, TileType.PackedDirt, TileType.Marsh, TileType.Moss]);
export const RICH_WORMS = new Set<TileType>([TileType.Marsh, TileType.Moss]);

/** How often a deliberate chip at a corner actually takes it down: one in four. */
export const CHIP_CHANCE = 0.25;


/** How far a prospector reads the ground: one tile further every ten levels. */
export const PROSPECT_REACH = 3;
export const PROSPECT_STEP = 10;
export const prospectRadius = (skill: number): number => PROSPECT_REACH + Math.floor(skill / PROSPECT_STEP);
/** How far this body reads the ground: a Miner's Far Reader reads further (`further:prospect`), and so does a reader's Deep Reading (`knowledge_deep_reading`). */
export const prospectReach = (g: Game): number =>
  prospectRadius(g.skills.get('prospecting')) + g.perk('further:prospect', 0) + g.pathFx('further', 0);

/** How deep a pick works through water, for this body: a Miner's Wet Work works deeper (`depth:mine`). */
export const mineDepth = (g: Game): number => g.perk('depth:mine', MINE_DEPTH);
/** The mining an ore wants of this body before it can be worked: a Miner's Ore Sense wants less (`ore:below`). */
export const oreNeeds = (g: Game, level: number): number => Math.max(0, level - g.perk('ore:below', 0));

/**
 * A Miner's Pan: sand with water at a corner, washed in a pan. What comes out
 * of it when anything does, each as likely, and how long a go takes.
 */
export const PAN_ORES = ['copper_ore', 'tin_ore', 'silver_ore'];
export const PAN_TIME = 8;
/** Whether a tile has water at one of its corners, which panning wants. */
export const besideWater = (g: Game, x: number, y: number): boolean =>
  tileCorners(x, y).some(([cx, cy]) => g.world.getHeight(cx, cy) < 0);

/**
 * The steepest slope a spade or a trowel may leave: this many times the skill,
 * and never less than `SLOPE_FLOOR`. A Terraformer's Steep Cut raises the
 * digger's multiple (`slope:digging`).
 */
export const SLOPE_PER_SKILL = 3;
export const SLOPE_FLOOR = 40;

export function maxDigSlope(g: Game): number {
  return Math.max(SLOPE_FLOOR, Math.floor(g.skills.get('digging') * g.perk('slope:digging', SLOPE_PER_SKILL)));
}

/**
 * Why a corner of rock may not be raised a step, with concrete or a Mason's
 * rubble, or null. It goes on bare rock and never on a seam; above the water,
 * or under as much of it as a Mason's Wet Set reaches (`depth:raise_rock`).
 */
export function rockRaiseRefusal(g: Game, cx: number, cy: number, what: 'Concrete' | 'Rubble'): string | null {
  const w = g.world;
  // Concrete goes on bare rock, above the water: the only way to build
  // *up* on rock without dirt, which slides off it.
  if (w.getDirt(cx, cy) > 0) return `Soil on that corner. ${what} needs bare rock.`;
  const deep = g.perk('depth:raise_rock', 0);
  if (w.getHeight(cx, cy) < -deep) {
    return deep > 0 ? `${what}: not under more than ${metres(deep)} m of water.` : `${what}: not under water.`;
  }
  if (seamUnder(w, cx, cy)) return `Corner on a seam. ${what} needs plain rock.`;
  const under = cornerUnderBuilding(g, cx, cy);
  if (under) return under;
  if (!g.inventory.has('trowel')) return 'Need a trowel.';
  return levelStop(g, cx, cy, 1) ?? slopeRefusal(g, 'masonry', cx, cy, 1);
}

/** The same rule for a mason raising rock as for a digger moving soil. */
export function maxMasonSlope(g: Game): number {
  return Math.max(SLOPE_FLOOR, Math.floor(g.skills.get('masonry') * g.perk('slope:masonry', SLOPE_PER_SKILL)));
}

/**
 * The skill a slope wants, which is the cap read backwards.
 *
 * `max(40, floor(skill * 3))` allows a slope the moment three times the skill
 * reaches it, so a third of the slope is what it takes, and a tenth of a point
 * is as fine as a skill is ever shown.
 */
export const slopeNeeds = (slope: number, per = SLOPE_PER_SKILL): number => Math.ceil((slope / per) * 10) / 10;

/**
 * Why a cut is too steep, in numbers, or null when it is not.
 *
 * It used to say "The slope would be too steep for your digging skill" and
 * stop there, which tells you neither how far over you are nor what would
 * carry it — so the only way to find either was to dig somewhere else and see.
 * Now it says the slope the cut would leave, the slope you are good for, and
 * the skill that would do it. The island says the same in `slope_refusal`.
 */
export function slopeRefusal(g: Game, skill: 'digging' | 'masonry', cx: number, cy: number, delta: number): string | null {
  const would = slopeAfter(g, cx, cy, delta);
  const cap = skill === 'digging' ? maxDigSlope(g) : maxMasonSlope(g);
  if (would <= cap) return null;
  const per = g.perk(`slope:${skill}`, SLOPE_PER_SKILL);
  return `Slope would be ${metres(would)} m; ${skill} allows ${metres(cap)} m, needs ${skill} ${slopeNeeds(would, per).toFixed(1)}.`;
}

/** Why a rank may not disband: only its founder does. The island says the same. */
export const disbandSaid = (deed: string): string => `Only the founder of ${deed} may disband it.`;

/**
 * Ground inside a settlement that is not yours to shape.
 *
 * Nothing stopped a visitor cutting a trench through somebody's token: the
 * doors asked what the ground was made of and never whose it was. A corner is
 * shared by as many as four tiles and is refused if any of them is on a
 * settlement you may not shape; a tile action asks about its own tile alone;
 * and a spadeful dropped at your feet asks about the tile you stand on. On a
 * settlement of yours it is your rank that is asked (Shape and build), and a
 * rank without it is named. The island reads the same rule off the same
 * `corner` column, in the same words (`ground_deed_refusal`).
 */
export function foreignGround(g: Game, def: ActionDef, t: Target): string | null {
  const tiles: Array<[number, number]> = t.kind !== 'tile'
    ? [[g.player.tileX, g.player.tileY]]
    : def.corner
      ? [[t.cx - 1, t.cy - 1], [t.cx, t.cy - 1], [t.cx - 1, t.cy], [t.cx, t.cy]]
      : [[t.x, t.y]];
  for (const [x, y] of tiles) {
    const mine = g.deedOfMineAt(x, y);
    if (mine) {
      const no = lacks(mine, 'shape');
      if (no) return no;
      continue;
    }
    const d = g.deedAt(x, y);
    if (d) return `Part of ${d.name}: citizens only.`;
  }
  return null;
}

/**
 * Whether a corner holds up a seam: any of the four tiles round it over a
 * vein, or the coal. Asked for: "only allow raising a rock corner with
 * concrete, not an ore / seam corner" — a vein raised with concrete would
 * be ore for ever, mined down a step, laid up a step and mined again.
 * `isSeam` is the one word for it on both sides; the island reads it off
 * `rock_def.seam`, which is generated from it.
 */
function seamUnder(w: World, cx: number, cy: number): boolean {
  for (const [x, y] of [[cx - 1, cy - 1], [cx, cy - 1], [cx - 1, cy], [cx, cy]]) {
    if (w.inBounds(x, y) && isSeam(bedrockAt(w, x, y))) return true;
  }
  return false;
}

/** Slope around a corner if its height were changed by `delta`. */
function slopeAfter(g: Game, cx: number, cy: number, delta: number): number {
  const w = g.world;
  const old = w.getHeight(cx, cy);
  w.heights[cy * w.cw + cx] = old + delta;
  const s = w.slopeAroundCorner(cx, cy);
  w.heights[cy * w.cw + cx] = old;
  return s;
}


/** What somebody without a Tailor's Patch is told. The island says the same. */
export const PATCH_PERK = 'Needs perk: Patch (Tailor).';
/** What a piece is patched with: cloth for cloth, leather for leather, and nothing else takes a patch. The island's `patch_with`. */
export const patchWith = (id: string): 'cloth' | 'leather' | null => {
  const m = improvable(id)?.material.id;
  return m === 'cloth' || m === 'leather' ? m : null;
};

/** Damage a Mender's repair kit takes off a thing, and none of its quality. The island's `kit_mend`. */
export const KIT_MEND = 50;
/**
 * Moss planted on a tile of dirt to turn it to moss: this many, pressed in
 * at once. Asked for: "Moss can be planted in 10qty on a dirt tile to change
 * it to moss." The island's `moss_plant`.
 */
export const MOSS_PLANT = 10;
describeFrom('moss', { moss: { cut: MOSS_PER_CUT, plant: MOSS_PLANT } });
/**
 * Mixed grass planted on a tile of dirt to turn it to grass, as moss is: this
 * many, pressed in at once. Dirt never grows grass back of itself, and a
 * player found no way to put it back. The island's `grass_plant`.
 */
export const GRASS_PLANT = MOSS_PLANT;
describeFrom('mixed_grass', { grass: { cut: GRASS_PER_CUT, plant: GRASS_PLANT } });
describeFrom('repair_kit', { mend: KIT_MEND });
/** Whether a thing could take a seal: anything but the sealant itself, and nothing sealed already. */
const sealable = (item: Item): boolean => item.id !== 'sealant' && item.mark?.seal === undefined;

/** What somebody without an Artisan's Glaze is told. The island says the same. */
export const GLAZE_PERK = 'Needs perk: Glaze (Artisan).';
/** What takes a glaze: a fired pot, bowl or jar, and an amphora. The island's `glazeable`. */
export const GLAZEABLE: ReadonlySet<string> = new Set(['clay_pot', 'clay_bowl', 'clay_jar', 'amphora']);
/** The ashes a glaze is made of, for one thing. */
export const GLAZE_ASH = 1;

/** A share of a bar or a nutrient as a whole percentage, as the island says it. */
const wholePct = (x: number): string => `${Math.round(x * 100)}%`;

/**
 * What a helping of a thing does, to a Cook's tongue (a Cook's Taste): how
 * much of the food bar it fills, or of the thirst bar a drink of it quenches,
 * what it feeds of each of the four, and how long its knack lasts -- all of it
 * at its quality and with its maker's hand in it. Nothing for what is not
 * food or drink. The island says the same (`taste_says`).
 */
export function tasteSays(g: Game, item: Item): string {
  const def = itemDef(item.id);
  if (!(def.food ?? 0) && !(def.drink ?? 0)) return '';
  const said: string[] = [];
  said.push((def.food ?? 0) > 0
    ? `food bar +${wholePct((def.food ?? 0) * (0.7 + item.ql / 200) * markOf(item, 'fill'))}`
    : `thirst bar +${wholePct(def.drink ?? 0)}`);
  const feeds = NUTRIENTS.filter((k) => (def.feeds?.[k] ?? 0) > 0)
    .map((k) => `${k} +${wholePct((def.feeds?.[k] ?? 0) * helpingOf(item.ql) * markOf(item, 'feed'))}`);
  said.push(...feeds);
  const skill = knackable(item.id) ? boonOf(g.seed, item.id) : null;
  if (skill) said.push(`${(def.food ?? 0) > 0 ? 'meal' : 'drink'} boost ${clockLeft(boonTime(item.id, item.ql, markOf(item, 'knack')))}`);
  return ` Per helping: ${said.join(', ')}.`;
}

/** What is said of dye drawn into a bucket: how much, and what is in the bucket after. The island says the same. */
function drewDye(g: Game, from: { kind: string }, drew: { n: number; bucket: Item } | null): void {
  const now = dyeIn(drew?.bucket);
  if (!drew || !now) return;
  g.logMsg(`Drew ${drew.n} ${drew.n === 1 ? 'litre' : 'litres'} of dye from the ${itemDef(from.kind).name.toLowerCase()}. Bucket: ${dyeSays(now.liquid, now.litres)}`, 'event');
}

export const ACTIONS: ActionDef[] = [
  {
    id: 'examine',
    label: 'Examine',
    verb: 'examining',
    instant: true,
    stamina: 0,
    baseTime: 0,
    applies: (t) => t.kind === 'tile',
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      // From down in a cellar, a tile of it is its floor, and not the ground up top.
      const below = g.player.level < 0 ? cellarFloorSaid(g, t.x, t.y) : null;
      if (below) {
        g.logMsg(below, 'event');
        return;
      }
      const w = g.world;
      const type = w.getTile(t.x, t.y);
      const c = w.corners(t.x, t.y, [0, 0, 0, 0]);
      const avg = (c[0] + c[1] + c[2] + c[3]) / 4;
      let text = `${w.tileName(t.x, t.y)} at (${t.x}, ${t.y}).`;
      if (type === TileType.Tree) {
        const data = w.getData(t.x, t.y);
        const age = treeAge(data);
        const kind = TREE_DEFS[treeSpecies(data)].name.toLowerCase();
        text = `Tree: ${age.name.toLowerCase()} ${kind} at (${t.x}, ${t.y}).`;
        // What is in it, what is coming for it, and what to do about that —
        // the same words the island uses, so a tree reads the same on both.
        const cuts = w.notchAt(t.x, t.y);
        if (cuts) text += ` Cuts: ${cuts}/${age.hits}.`;
        text += treeOutlook(age, g.treesAt);
        // And when a fruit tree bears, and whether it is bearing now (`fruiting.ts`).
        const fruit = TREE_DEFS[treeSpecies(data)].fruit;
        if (fruit) text += fruitingSays(fruit, fruitSeason(g.wallNow()));
      } else if (type === TileType.Stump) {
        text = `${TREE_DEFS[treeSpecies(w.getData(t.x, t.y))].name} stump at (${t.x}, ${t.y}). Dig out, or grass at the next ${DAILY_RESET}.`;
      } else if (type === TileType.Grass && (w.getData(t.x, t.y) & MOWING)) {
        const d = w.getData(t.x, t.y);
        text += ` Mown: ${mownDays(d) + (mownToday(d) ? 1 : 0)}/${LAWN_AFTER} days to lawn.`;
      } else if (type === TileType.Bush) {
        const bush = BUSH_DEFS[bushSpecies(w.getData(t.x, t.y))];
        text = `${bush.name} at (${t.x}, ${t.y}).`;
        if (bush.yields) text += fruitingSays(bush.yields, fruitSeason(g.wallNow()));
      }
      // What feet have done to it, and what is in flower on it: the island's words (`ground_says`).
      text += groundSays(g, t.x, t.y);
      // And for a Fisher with a Fishing Journal, what the water holds for them.
      const water = w.hasWater(t.x, t.y) ? ` Under water.${fishJournal(g, t.x, t.y)}` : '';
      let extra = '';
      const here = g.deedOfMineAt(t.x, t.y);
      if (here && g.isToken(t.x, t.y)) extra += ` Settlement totem: ${here.name}.`;
      else if (here) extra += ` Settlement: ${here.name}.`;
      const b = g.buildings.buildingAt(t.x, t.y);
      if (b) extra += ` Building: ${b.name}, ${b.levels} ${b.levels === 1 ? 'storey' : 'storeys'}.`;
      // And a glasshouse says what it is for (`glasshouse.ts`).
      extra += glassSays(g.buildings, b);
      // And its deck, if the tile stands on piers (`pier_says`).
      if (b) extra += g.pierSays(t.x, t.y);
      // And what is dug out under it: the island's `examine_tile_text` says the same.
      const under = g.buildings.cellar(t.x, t.y);
      if (under) {
        extra += under.dug >= CELLAR_DEPTH ? ` Cellar under it: ${metres(CELLAR_DEPTH)} m deep.`
          : ` Cellar under it: ${metres(under.dug)} m of ${metres(CELLAR_DEPTH)} m dug.`;
      }
      // A jetty over it, columns on its corners, a roof on columns (`frameSays`).
      extra += frameSays(g, t.x, t.y);
      const crates = g.cratesOnTile(t.x, t.y);
      if (crates.length) extra += ` Crates: ${crates.length}.`;
      g.logMsg(`${text} Height ${metres(avg)} m, slope ${metres(w.slope(t.x, t.y))} m.${water}${extra}`, 'event');
    },
  },
  {
    // Sand, clay, peat and tar lie in beds, and dirt lies on top of the
    // ground as they do. You fill a shovel off the top of one without cutting
    // the ground about, which is what digging a corner does: stand on the
    // tile, and the tile is as it was when you walk off it.
    id: 'collect',
    label: 'Collect',
    labelFor: (t, g) => `Collect ${TILE_DEFS[tile(t, g)].name.toLowerCase()}`,
    verb: 'filling a shovel',
    skill: 'digging',
    tool: 'shovel',
    // Nought tiles of reach: you have to be standing on the bed itself, and
    // the walk that starts an action puts you there.
    range: 0,
    stamina: 0.05,
    baseTime: 7,
    difficulty: 6,
    applies: (t, g) => t.kind === 'tile' && !!TILE_DEFS[tile(t, g)].collect,
    check: (t, g) => {
      if (t.kind !== 'tile') return null;
      if (!g.inventory.has('shovel')) return 'Need a shovel.';
      const def = TILE_DEFS[tile(t, g)];
      if (!def.collect) return 'Nothing to collect here.';
      const under = g.buildings.buildingAt(t.x, t.y);
      if (under) return `Under ${under.name}.`;
      return null;
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      const def = TILE_DEFS[g.world.getTile(t.x, t.y)];
      const yieldId = def.digYield;
      if (!def.collect || !yieldId) return;
      if (!g.skillCheck('digging', 6, g.toolQl('shovel'))) {
        g.missed();
        g.logMsg(`Collect failed: ${def.name.toLowerCase()}.`, 'event');
        return;
      }
      const item = g.gather(yieldId, { ql: g.productQl('digging', g.toolQl('shovel')) });
      g.logMsg(`Collected: ${itemDef(yieldId).name.toLowerCase()}, QL ${item.ql.toFixed(1)}.`, 'event');
    },
  },
  {
    // Moss pressed into bare dirt, `MOSS_PLANT` of it at once, turns the tile
    // to moss: the same on both sides (the island's `perform_farm`).
    id: 'plant_moss',
    label: 'Plant moss',
    verb: 'planting moss',
    skill: 'farming',
    stamina: 0.03,
    baseTime: 5,
    applies: (t, g) => t.kind === 'tile' && g.world.getTile(t.x, t.y) === TileType.Dirt && g.inventory.count('moss') > 0,
    check: (t, g) => {
      if (t.kind !== 'tile') return null;
      if (g.world.getTile(t.x, t.y) !== TileType.Dirt) return 'Needs a dirt tile.';
      if (g.world.hasWater(t.x, t.y)) return 'Not under water.';
      const have = g.inventory.count('moss');
      if (have < MOSS_PLANT) return `Need ${MOSS_PLANT} moss; have ${have}.`;
      // Not the ground under a building, which a tile on piers is (`piers.ts`).
      return underBuilding(g, t.x, t.y);
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      if (g.world.getTile(t.x, t.y) !== TileType.Dirt || g.inventory.count('moss') < MOSS_PLANT) return;
      g.inventory.consume('moss', MOSS_PLANT);
      g.world.setTile(t.x, t.y, TileType.Moss);
      g.logMsg(`Planted: ${MOSS_PLANT} moss. Tile: moss.`, 'event');
    },
  },
  {
    // Mixed grass pressed into bare dirt, `GRASS_PLANT` of it at once, turns
    // the tile to grass, as moss is planted: the island's `perform_farm`.
    id: 'plant_grass',
    label: 'Plant grass',
    verb: 'planting grass',
    skill: 'farming',
    stamina: 0.03,
    baseTime: 5,
    applies: (t, g) => t.kind === 'tile' && g.world.getTile(t.x, t.y) === TileType.Dirt && g.inventory.count('mixed_grass') > 0,
    check: (t, g) => {
      if (t.kind !== 'tile') return null;
      if (g.world.getTile(t.x, t.y) !== TileType.Dirt) return 'Needs a dirt tile.';
      if (g.world.hasWater(t.x, t.y)) return 'Not under water.';
      const have = g.inventory.count('mixed_grass');
      if (have < GRASS_PLANT) return `Need ${GRASS_PLANT} mixed grass; have ${have}.`;
      return underBuilding(g, t.x, t.y);
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      if (g.world.getTile(t.x, t.y) !== TileType.Dirt || g.inventory.count('mixed_grass') < GRASS_PLANT) return;
      g.inventory.consume('mixed_grass', GRASS_PLANT);
      g.world.setTile(t.x, t.y, TileType.Grass);
      g.logMsg(`Planted: ${GRASS_PLANT} mixed grass. Tile: grass.`, 'event');
    },
  },
  {
    id: 'dig_worms',
    label: 'Dig for worms',
    verb: 'turning the dirt over',
    skill: 'digging',
    tool: 'shovel',
    // A spadeful turned over for worms is not a hole dug: the island's `perform_ground` wears the shovel as little.
    wear: 0.4,
    stamina: 0.04,
    baseTime: 6,
    repeat: true,
    applies: (t, g) => t.kind === 'tile' && WORMY.has(g.world.getTile(t.x, t.y)),
    check: (t, g) => {
      if (t.kind !== 'tile') return null;
      if (!g.inventory.has('shovel')) return 'Need a shovel.';
      if (g.world.hasWater(t.x, t.y)) return 'Not under water.';
      return null;
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      g.gainSkill('digging', 0.2);
      // Damp ground gives more than dry: a marsh is full of them.
      const rich = RICH_WORMS.has(g.world.getTile(t.x, t.y));
      const n = Math.floor(g.rand() * (rich ? 5 : 3)) + (rich ? 1 : 0);
      if (!n) {
        g.logMsg('No worms found.', 'event');
        return true;
      }
      g.gather('worm', { count: n, ql: 20 + g.rand() * 40 });
      g.note('worms');
      g.logMsg(`Found: ${n} worm${n > 1 ? 's' : ''}.`, 'event');
      return true;
    },
  },
  {
    id: 'dig',
    label: 'Dig',
    verb: 'digging',
    skill: 'digging',
    tool: 'shovel',
    corner: true,
    stamina: 0.05,
    baseTime: 6,
    difficulty: 8,
    applies: (t, g) => t.kind === 'tile' && !!TILE_DEFS[tile(t, g)].digYield,
    check: (t, g) => {
      if (t.kind !== 'tile') return null;
      if (!g.inventory.has('shovel')) return 'Need a shovel.';
      const under = cornerUnderBuilding(g, t.cx, t.cy);
      if (under) return under;
      /*
       * The same depth a pick works to. `<= 0` refused a corner standing
       * exactly *at* the waterline, where no water is drawn — the same height
       * and the same off-by-one that mining was fixed for, and digging was
       * left with.
       */
      if (g.world.getHeight(t.cx, t.cy) < -digDepth(g)) return 'Water too deep.';
      if (g.world.getDirt(t.cx, t.cy) <= 0) return 'Corner is bare rock: needs a pickaxe.';
      return levelStop(g, t.cx, t.cy, -1) ?? slopeRefusal(g, 'digging', t.cx, t.cy, -1);
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      const w = g.world;
      const def = TILE_DEFS[w.getTile(t.x, t.y)];
      if (!g.skillCheck('digging', 8, g.toolQl('shovel'))) {
        g.missed();
        g.logMsg('Dig failed.', 'event');
        return;
      }
      w.setHeight(t.cx, t.cy, w.getHeight(t.cx, t.cy) - 1);
      const left = w.getDirt(t.cx, t.cy) - 1;
      w.setDirt(t.cx, t.cy, left);
      if (def.turnsToDirt) w.setTile(t.x, t.y, TileType.Dirt);
      if (left <= 0) {
        g.logMsg('Bare rock.', 'event');
        g.exposeRock(t.cx, t.cy);
      }
      const yieldId = def.digYield ?? 'dirt';
      const item = g.gather(yieldId, { ql: g.productQl('digging', g.toolQl('shovel')) });
      g.logMsg(`Dug: ${itemDef(yieldId).name.toLowerCase()}, ${cornerName(t)} corner, QL ${item.ql.toFixed(1)}.`, 'event');
      // And one spadeful in a thousand that is not dirt at all.
      maybeMap(g, 'digging', 'shovel');
    },
  },
  /*
   * A Terraformer's Dig out the tile: all four corners down by one in a
   * single go, which is four digs' worth of ground in rather less than four
   * digs' time. Offered only to somebody holding the perk (`dig_tile`); the
   * island asks the same of it in `act_refusal_rules` and does it in
   * `perform_dig_tile`.
   */
  {
    id: 'dig_tile',
    label: 'Dig whole tile',
    verb: 'digging out the tile',
    skill: 'digging',
    tool: 'shovel',
    stamina: 0.12,
    baseTime: DIG_TILE_TIME,
    difficulty: 8,
    applies: (t, g) => t.kind === 'tile' && g.perk('dig_tile', 0) > 0 && !!TILE_DEFS[tile(t, g)].digYield,
    check: (t, g) => {
      if (t.kind !== 'tile') return null;
      if (g.perk('dig_tile', 0) <= 0) return 'Needs perk: Dig Out the Tile (Terraformer).';
      if (!g.inventory.has('shovel')) return 'Need a shovel.';
      for (const [cx, cy] of tileCorners(t.x, t.y)) {
        const under = cornerUnderBuilding(g, cx, cy);
        if (under) return under;
        if (g.world.getHeight(cx, cy) < -digDepth(g)) return 'Water too deep.';
        if (g.world.getDirt(cx, cy) <= 0) return 'A corner is bare rock: needs a pickaxe.';
        const why = levelStop(g, cx, cy, -1) ?? slopeRefusal(g, 'digging', cx, cy, -1);
        if (why) return why;
      }
      return null;
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      const w = g.world;
      const def = TILE_DEFS[w.getTile(t.x, t.y)];
      if (!g.skillCheck('digging', 8, g.toolQl('shovel'))) {
        g.missed();
        g.logMsg('Dig failed.', 'event');
        return;
      }
      for (const [cx, cy] of tileCorners(t.x, t.y)) {
        w.setHeight(cx, cy, w.getHeight(cx, cy) - 1);
        w.setDirt(cx, cy, w.getDirt(cx, cy) - 1);
        if (w.getDirt(cx, cy) <= 0) g.exposeRock(cx, cy);
      }
      if (def.turnsToDirt) w.setTile(t.x, t.y, TileType.Dirt);
      const yieldId = def.digYield ?? 'dirt';
      const item = g.gather(yieldId, { count: TILE_CORNERS, ql: g.productQl('digging', g.toolQl('shovel')) });
      g.logMsg(`Dug whole tile: ${TILE_CORNERS} × ${itemDef(yieldId).name.toLowerCase()}, QL ${item.ql.toFixed(1)}.`, 'event');
    },
  },
  {
    id: 'dredge',
    label: 'Dredge',
    verb: 'dredging',
    skill: 'digging',
    tool: 'shovel',
    corner: true,
    stamina: 0.06,
    baseTime: 7,
    difficulty: 10,
    // Digging from a boat: the bottom comes up a spadeful at a time, to a
    // depth the shore never reaches, and deepens the water as it goes.
    applies: (t, g) => t.kind === 'tile' && !!g.afloat() && !!TILE_DEFS[tile(t, g)].digYield,
    check: (t, g) => {
      if (t.kind !== 'tile') return null;
      if (!g.inventory.has('shovel')) return 'Need a shovel.';
      if (!g.afloat()) return 'Must be in a boat.';
      const w = g.world;
      if (w.getHeight(t.cx, t.cy) >= 0) return 'Corner above water: dig it instead.';
      if (w.getHeight(t.cx, t.cy) < -DREDGE_DEPTH) return 'Bottom too deep.';
      if (w.getDirt(t.cx, t.cy) <= 0) return 'Corner is bare rock.';
      const under = cornerUnderBuilding(g, t.cx, t.cy);
      if (under) return under;
      return slopeRefusal(g, 'digging', t.cx, t.cy, -1);
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      const w = g.world;
      const def = TILE_DEFS[w.getTile(t.x, t.y)];
      if (!g.skillCheck('digging', 10, g.toolQl('shovel'))) {
        g.missed();
        g.logMsg('Dredge failed.', 'event');
        return;
      }
      w.setHeight(t.cx, t.cy, w.getHeight(t.cx, t.cy) - 1);
      const left = w.getDirt(t.cx, t.cy) - 1;
      w.setDirt(t.cx, t.cy, left);
      if (def.turnsToDirt) w.setTile(t.x, t.y, TileType.Dirt);
      if (left <= 0) g.exposeRock(t.cx, t.cy);
      const yieldId = def.digYield ?? 'dirt';
      const item = g.gather(yieldId, { ql: g.productQl('digging', g.toolQl('shovel')) });
      g.logMsg(`Dredged: ${itemDef(yieldId).name.toLowerCase()}, ${cornerName(t)} corner, QL ${item.ql.toFixed(1)}.`, 'event');
    },
  },
  {
    id: 'flatten',
    label: 'Flatten',
    verb: 'flattening',
    skill: 'digging',
    tool: 'shovel',
    repeat: true,
    stamina: 0.03,
    baseTime: 3.5,
    applies: (t, g) => t.kind === 'tile' && !!TILE_DEFS[tile(t, g)].digYield && needsFlattening(g, t.x, t.y),
    check: (t, g) => {
      if (t.kind !== 'tile') return null;
      if (!g.inventory.has('shovel')) return 'Need a shovel.';
      // Shallows are workable, to the depth a pick works to.
      if (g.world.centerHeight(t.x, t.y) < -digDepth(g)) return 'Water too deep.';
      if (flattenTarget(g, t.x, t.y) < -digDepth(g)) return 'Your tile is too deep under water.';
      const under = underBuilding(g, t.x, t.y);
      if (under) return under;
      return null;
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return false;
      const w = g.world;
      const own = g.player.tileX === t.x && g.player.tileY === t.y;
      const target = flattenTarget(g, t.x, t.y);
      const cs = tileCorners(t.x, t.y);
      /*
       * The corners furthest above and below the height we are working
       * towards — and the high one has to be soil, because a shovel does not
       * move rock. It used to be the highest corner whatever it was made of,
       * and a tile with one rock shoulder on it stopped the whole run dead
       * with "Mine it down instead" while the other three corners still had
       * work in them. The rock is stepped round now and named at the end.
       */
      let hi = -1;
      let lo = -1;
      let rock = false;
      for (let i = 0; i < 4; i++) {
        const h = w.getHeight(cs[i][0], cs[i][1]);
        if (h > target && w.getDirt(cs[i][0], cs[i][1]) <= 0) rock = true;
        if (h > target && w.getDirt(cs[i][0], cs[i][1]) > 0
            && (hi < 0 || h > w.getHeight(cs[hi][0], cs[hi][1]))) hi = i;
        if (h < target && (lo < 0 || h < w.getHeight(cs[lo][0], cs[lo][1]))) lo = i;
      }
      if (hi < 0 && lo < 0) {
        g.logMsg(rock ? 'High corners are bare rock: mine them.' : 'Nothing left to move.', 'error');
        return false;
      }
      const raise = (i: number, by: number): void => {
        const [cx, cy] = cs[i];
        w.setHeight(cx, cy, w.getHeight(cx, cy) + by);
        w.setDirt(cx, cy, w.getDirt(cx, cy) + by);
        g.exposeRock(cx, cy);
      };
      if (hi >= 0 && lo >= 0) {
        // One corner down and one up: the dirt simply moves across the tile.
        raise(hi, -1);
        raise(lo, 1);
        g.logMsg('Dirt moved across the tile.', 'event');
      } else if (hi >= 0) {
        raise(hi, -1);
        // What the ground is made of, which digging has always read off the
        // tile and flattening never did: scrape a clay bank and you have clay.
        const got = TILE_DEFS[w.getTile(t.x, t.y)].digYield ?? 'dirt';
        g.gather(got, { ql: g.productQl('digging', g.toolQl('shovel')) });
        g.logMsg(`Lowered. Got: ${itemDef(got).name.toLowerCase()}.`, 'event');
      } else {
        // Its own stuff first, and dirt after: dirt fills anything, and it
        // would be a strange rule that let you take clay out of a bank and
        // not put it back.
        const want = TILE_DEFS[w.getTile(t.x, t.y)].digYield ?? 'dirt';
        const got = spoilFrom(g, want === 'dirt' ? ['dirt'] : [want, 'dirt']);
        if (!got || !got.take()) {
          g.logMsg(`Need ${itemDef(want).name.toLowerCase()} or dirt, in the pack or a container beside you.`, 'error');
          return false;
        }
        raise(lo, 1);
        g.logMsg(`Raised. Used: ${itemDef(got.id).name.toLowerCase()}.`, 'event');
      }
      if (TILE_DEFS[w.getTile(t.x, t.y)].turnsToDirt) w.setTile(t.x, t.y, TileType.Dirt);
      if (!needsFlattening(g, t.x, t.y)) {
        g.logMsg(own ? `Flat, at its lowest corner.` : 'Flat, level with your tile.', 'event');
        return false;
      }
      return true;
    },
  },
  {
    id: 'drop_dirt',
    label: 'Change tile',
    verb: 'changing tile',
    skill: 'digging',
    corner: true,
    stamina: 0.02,
    baseTime: 2,
    applies: (t, g) => t.kind === 'tile' && !!spoilFrom(g, SPOIL_ORDER, t.itemUid),
    check: (t, g) => {
      if (t.kind !== 'tile') return null;
      const it = spoilFrom(g, SPOIL_ORDER, t.itemUid);
      if (!it) {
        return t.itemUid !== undefined ? 'Not dirt, clay or sand.'
          : 'Need dirt, clay or sand, in the pack or a container beside you.';
      }
      const under = cornerUnderBuilding(g, t.cx, t.cy);
      if (under) return under;
      return levelStop(g, t.cx, t.cy, 1) ?? slopeRefusal(g, 'digging', t.cx, t.cy, 1);
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      const it = spoilFrom(g, SPOIL_ORDER, t.itemUid);
      if (!it || !it.take()) return;
      const w = g.world;
      w.setHeight(t.cx, t.cy, w.getHeight(t.cx, t.cy) + 1);
      w.setDirt(t.cx, t.cy, w.getDirt(t.cx, t.cy) + 1);
      g.exposeRock(t.cx, t.cy);
      // What the spadeful covers becomes what was in it: dirt, clay or sand.
      if (BURYABLE.has(w.getTile(t.x, t.y))) w.setTile(t.x, t.y, SPOIL_TILE[it.id]);
      g.logMsg(`Dropped: ${itemDef(it.id).name.toLowerCase()}, ${cornerName(t)} corner raised.`, 'event');
    },
  },
  {
    /*
     * A surveyor's level, and the mark everything else works to.
     *
     * Asked for as "flatten toward a chosen height" and "a run of goes that
     * knows when to stop", which turn out to be one thing: a mark. Sight it at
     * a corner and flattening aims at it instead of at the tile you are
     * standing on, and every job that moves that corner refuses once it is
     * there — so twenty-five spadefuls asked for at a bank stop the moment the
     * bank is down to the mark, rather than twenty-five spadefuls later.
     */
    id: 'take_level',
    label: 'Set level here',
    verb: 'taking the level',
    instant: true,
    corner: true,
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => t.kind === 'tile' && g.level !== g.world.getHeight(t.cx, t.cy),
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      g.level = g.world.getHeight(t.cx, t.cy);
      g.logMsg(`Level set: ${metres(g.level)} m. Flatten works to it; dig, drop and concrete stop at it.`, 'event');
      g.events.emit('action');
    },
  },
  {
    id: 'clear_level',
    label: 'Clear level',
    verb: 'clearing the level',
    instant: true,
    stamina: 0,
    baseTime: 0,
    applies: (_t, g) => g.level !== null,
    perform: (_t, g) => {
      g.level = null;
      g.logMsg('Level cleared. Flatten works to your tile.', 'event');
      g.events.emit('action');
    },
  },
  /*
   * A Mason's Rubble Fill: the same step up on bare rock, bought with rock
   * shards rather than a concrete, under the same rules and the same check.
   */
  {
    id: 'rubble_fill',
    label: 'Raise rock: rubble',
    verb: 'packing rubble',
    skill: 'masonry',
    tool: 'trowel',
    corner: true,
    stamina: 0.05,
    baseTime: 5,
    difficulty: 10,
    applies: (t, g) => t.kind === 'tile' && g.perk('rubble', 0) > 0 && g.inventory.count('rock_shards') >= g.perk('rubble', 0),
    check: (t, g) => {
      if (t.kind !== 'tile') return null;
      const n = g.perk('rubble', 0);
      if (n <= 0) return 'Needs perk: Rubble Fill (Mason).';
      if (g.inventory.count('rock_shards') < n) return `Need ${n} rock shards.`;
      return rockRaiseRefusal(g, t.cx, t.cy, 'Rubble');
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      if (!g.inventory.consume('rock_shards', g.perk('rubble', 0))) return;
      if (!g.skillCheck('masonry', 10, g.toolQl('trowel'))) {
        g.missed();
        g.logMsg('Rubble failed: shards lost.', 'event');
        return;
      }
      const w = g.world;
      w.setHeight(t.cx, t.cy, w.getHeight(t.cx, t.cy) + 1);
      g.exposeRock(t.cx, t.cy);
      g.logMsg(`Rubble packed: ${cornerName(t)} corner raised.`, 'event');
    },
  },
  {
    id: 'raise_rock',
    label: 'Raise rock: concrete',
    verb: 'laying concrete',
    skill: 'masonry',
    tool: 'trowel',
    corner: true,
    stamina: 0.04,
    baseTime: 5,
    difficulty: 10,
    applies: (t, g) => t.kind === 'tile' && g.inventory.has('concrete'),
    check: (t, g) => {
      if (t.kind !== 'tile') return null;
      if (!g.inventory.has('concrete')) return 'Need concrete.';
      return rockRaiseRefusal(g, t.cx, t.cy, 'Concrete');
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      // Spent either way: concrete that slumps off is concrete gone.
      if (!g.inventory.consume('concrete')) return;
      if (!g.sureCheck('raise_rock', 'masonry', 10, g.toolQl('trowel'))) {
        g.missed();
        g.logMsg('Concrete failed: concrete lost.', 'event');
        return;
      }
      const w = g.world;
      // The rock rises: the height goes up and the soil over it stays nought.
      w.setHeight(t.cx, t.cy, w.getHeight(t.cx, t.cy) + 1);
      g.exposeRock(t.cx, t.cy);
      g.logMsg(`Concrete laid: ${cornerName(t)} corner raised.`, 'event');
    },
  },
  {
    id: 'mine',
    label: 'Mine',
    verb: 'mining',
    skill: 'mining',
    tool: 'pickaxe',
    corner: true,
    stamina: 0.06,
    baseTime: 8,
    difficulty: 12,
    applies: (t, g) => t.kind === 'tile' && !!TILE_DEFS[tile(t, g)].mineable,
    check: (t, g) => {
      if (t.kind !== 'tile') return null;
      if (!g.inventory.has('pickaxe')) return 'Need a pickaxe.';
      // A face that comes down brings a corner down with it (`MINE_COLLAPSE`): not under a building, a tile on piers among them.
      const under = cornerUnderBuilding(g, t.cx, t.cy);
      if (under) return under;
      if (g.world.getHeight(t.cx, t.cy) < -mineDepth(g)) return 'Water too deep.';
      const ore = oreAt(g.world, t.x, t.y);
      if (ore && g.skills.get('mining') < oreNeeds(g, ore.level)) return `${ore.name}: needs mining ${oreNeeds(g, ore.level)}; have ${g.skills.get('mining').toFixed(1)}.`;
      return null;
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      const w = g.world;
      const pickQl = g.toolQl('pickaxe');
      if (!g.sureCheck('mine', 'mining', 12, pickQl)) {
        g.missed();
        g.logMsg('Mining failed.', 'event');
        return;
      }
      const type = w.getTile(t.x, t.y);
      const rock = bedrockAt(w, t.x, t.y);
      const yieldId = type === TileType.Rock ? rock.yields : 'rock_shards';
      if (yieldId.endsWith('_ore')) g.note('ore');
      // No seam gives up more quality than it holds, however good the miner.
      const item = g.gather(yieldId, { ql: Math.min(rock.maxQl, g.productQl('mining', pickQl)) });
      const what = itemDef(yieldId).name.toLowerCase();
      g.logMsg(`Mined: ${what}, QL ${item.ql.toFixed(1)}.`, 'event');
      // And one more, now and then, for a Lodestone on the pickaxe.
      g.enchantMore('pickaxe', 'lode', yieldId, item.ql);
      // And one swing in a thousand that brings out something nobody quarried.
      maybeMap(g, 'mining', 'pickaxe');
      // And a stone, now and again, which is the other thing a miner is for.
      maybeGem(g, 'mining', 'pickaxe');
      // Cutting the face back is its own job, with its own entry in the menu.
      // Now and again one comes down anyway.
      if (g.rand() < MINE_COLLAPSE) {
        w.setHeight(t.cx, t.cy, w.getHeight(t.cx, t.cy) - 1);
        w.setDirt(t.cx, t.cy, 0);
        g.exposeRock(t.cx, t.cy);
        g.logMsg('Face collapsed: corner lowered.', 'event');
      }
    },
  },
  {
    // Mining takes what is in the rock; this takes the rock itself. Three
    // swings in four find no line in it and the corner stands where it was.
    id: 'chip_corner',
    label: 'Chip corner',
    verb: 'chipping at the face',
    skill: 'mining',
    tool: 'pickaxe',
    corner: true,
    stamina: 0.07,
    baseTime: 9,
    applies: (t, g) => t.kind === 'tile' && !!TILE_DEFS[tile(t, g)].mineable,
    check: (t, g) => {
      if (t.kind !== 'tile') return null;
      if (!g.inventory.has('pickaxe')) return 'Need a pickaxe.';
      const under = cornerUnderBuilding(g, t.cx, t.cy);
      if (under) return under;
      if (g.world.getHeight(t.cx, t.cy) < -mineDepth(g)) return 'Water too deep.';
      const ore = oreAt(g.world, t.x, t.y);
      if (ore && g.skills.get('mining') < oreNeeds(g, ore.level)) return `${ore.name}: needs mining ${oreNeeds(g, ore.level)}; have ${g.skills.get('mining').toFixed(1)}.`;
      return levelStop(g, t.cx, t.cy, -1);
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      const w = g.world;
      if (g.rand() >= CHIP_CHANCE) {
        g.missed();
        g.logMsg(`Cut failed: ${cornerName(t)} corner.`, 'event');
        return;
      }
      w.setHeight(t.cx, t.cy, w.getHeight(t.cx, t.cy) - 1);
      w.setDirt(t.cx, t.cy, 0);
      g.exposeRock(t.cx, t.cy);
      // What broke away is yours, which is the only thing this shares with mining.
      const rock = bedrockAt(w, t.x, t.y);
      const yieldId = w.getTile(t.x, t.y) === TileType.Rock ? rock.yields : 'rock_shards';
      if (yieldId.endsWith('_ore')) g.note('ore');
      const item = g.gather(yieldId, { ql: Math.min(rock.maxQl, g.productQl('mining', g.toolQl('pickaxe'))) });
      g.logMsg(`Cut: ${cornerName(t)} corner lowered. Got ${itemDef(yieldId).name.toLowerCase()}, QL ${item.ql.toFixed(1)}.`, 'event');
    },
  },
  {
    id: 'prospect',
    label: 'Prospect',
    verb: 'prospecting',
    skill: 'prospecting',
    tool: 'pickaxe',
    stamina: 0.03,
    baseTime: 5,
    applies: (t, g) => t.kind === 'tile' && g.inventory.has('pickaxe'),
    check: (_t, g) => (g.inventory.has('pickaxe') ? null : 'Need a pickaxe.'),
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      const w = g.world;
      const radius = prospectReach(g);
      const found: string[] = [];
      const tiles: number[] = [];
      for (let y = t.y - radius; y <= t.y + radius; y++) {
        for (let x = t.x - radius; x <= t.x + radius; x++) {
          if (!w.inBounds(x, y)) continue;
          // Metal counts wherever it lies: bare, under soil, or below water.
          const rock = bedrockAt(w, x, y);
          // Anything worth mining, which is not the same as anything metal:
          // a coal seam yields plain `coal` and so fails the `_ore` test.
          if (!isSeam(rock)) continue;
          tiles.push(y * w.w + x);
          found.push(rock.name.toLowerCase());
        }
      }
      g.markProspected(tiles);
      // Reading a seam out of the ground is head work as well as the trade's (`PROSPECT_HEAD`); a go always reads it.
      g.gainSkill('mind_logic', tryGain(true, PROSPECT_HEAD));
      // Sampling where you stand tells you what that particular rock holds.
      const here = bedrockAt(w, t.x, t.y);
      const buried = w.getTile(t.x, t.y) === TileType.Rock ? '' : ` Under ${Math.max(1, w.getDirt(t.x, t.y))} of ground.`;
      if (isSeam(here)) {
        const can = g.skills.get('mining') >= here.level;
        g.logMsg(
          `Here: ${here.name.toLowerCase()}. Needs mining ${here.level}${can ? ' (you have it)' : ''}. Max QL ${here.maxQl}.${buried}`,
          'event',
        );
      } else {
        g.logMsg(`Here: plain ${here.name.toLowerCase()}, no metal. Max QL ${here.maxQl}.${buried}`, 'event');
      }
      if (!found.length) {
        g.logMsg(`No seams within ${radius} tiles.`, 'event');
        return;
      }
      const tally = new Map<string, number>();
      for (const n of found) tally.set(n, (tally.get(n) ?? 0) + 1);
      const parts = [...tally].map(([n, c]) => `${n} ${c}`);
      g.logMsg(`Seams within ${radius} tiles, buried or bare (tiles): ${parts.join(', ')}. Marked for ${PROSPECT_MARK_TIME / 60} min.`, 'event');
    },
  },
  /*
   * A Miner's Pan: sand washed at the water's edge, and now and then something
   * heavy left in the bottom of the pan. Offered only to somebody holding the
   * perk (`pan`, which is also the share of goes that find anything); the
   * island asks the same of it in `act_refusal_rules` and does it in
   * `perform_pan`.
   */
  {
    id: 'pan',
    label: 'Pan',
    verb: 'panning',
    skill: 'prospecting',
    stamina: 0.04,
    baseTime: PAN_TIME,
    applies: (t, g) => t.kind === 'tile' && g.perk('pan', 0) > 0 && tile(t, g) === TileType.Sand && besideWater(g, t.x, t.y),
    check: (t, g) => {
      if (t.kind !== 'tile') return null;
      if (g.perk('pan', 0) <= 0) return 'Needs perk: Pan (Miner).';
      if (tile(t, g) !== TileType.Sand) return 'Needs sand.';
      if (!besideWater(g, t.x, t.y)) return 'Needs water at a corner of the sand.';
      return null;
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      if (g.rand() >= g.perk('pan', 0)) {
        g.missed();
        g.logMsg('Panned: nothing.', 'event');
        return;
      }
      const ore = PAN_ORES[Math.floor(g.rand() * PAN_ORES.length)];
      const item = g.gather(ore, { ql: g.productQl('prospecting', 0) });
      g.logMsg(`Panned: ${itemDef(ore).name.toLowerCase()}, QL ${item.ql.toFixed(1)}.`, 'event');
    },
  },
  {
    id: 'cut_down',
    label: 'Cut down',
    verb: 'cutting down',
    skill: 'woodcutting',
    tool: 'hatchet',
    stamina: 0.07,
    baseTime: 8,
    difficulty: 10,
    applies: (t, g) => tile(t, g) === TileType.Tree || tile(t, g) === TileType.Bush,
    check: (t, g) => {
      // The tree may have come down since this was asked for; do not swing at air.
      const type = tile(t, g);
      if (type !== TileType.Tree && type !== TileType.Bush) return 'No tree or bush here.';
      return g.inventory.has('hatchet') ? null : 'Need a hatchet.';
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      const w = g.world;
      const type = w.getTile(t.x, t.y);
      if (!g.sureCheck('cut_down', 'woodcutting', 10, g.toolQl('hatchet'))) {
        g.missed();
        g.logMsg('Cut failed.', 'event');
        return;
      }
      if (type === TileType.Bush) {
        w.setTile(t.x, t.y, TileType.Grass);
        g.logMsg('Bush cut down.', 'event');
        return;
      }
      // Nothing standing is nothing to fell. `check` says so before the swing
      // and this says so after it: reading a tree off a tile that has none
      // gives you species 0 age 0 and a birch out of thin air, which is what
      // the suite got the first time it swung one stroke too many.
      if (type !== TileType.Tree) return;
      /*
       * A tree comes down in strokes, and how many depends on what it is.
       *
       * The count is kept in the tile rather than in the swinging, because a
       * wood is not one woodcutter's: leave a half-felled oak and the notch is
       * still in it tomorrow, for you or for whoever finds it. A cut that
       * glances off is not one of them — that is what the skill check above is
       * for, and it already returns before this line.
       */
      const data = w.getData(t.x, t.y);
      const def = TREE_DEFS[treeSpecies(data)];
      const age = treeAge(data);
      const cuts = w.notchAt(t.x, t.y) + 1;
      const what = `${age.name.toLowerCase()} ${def.name.toLowerCase()}`;
      if (cuts < age.hits) {
        w.setNotch(t.x, t.y, cuts);
        g.logMsg(`Cut ${what}: ${age.hits - cuts} more to fell.`, 'event');
        return;
      }
      g.note('tree');
      if (!age.logs) {
        // Nothing that size leaves a stump worth the name.
        w.setTile(t.x, t.y, TileType.Grass);
        g.logMsg(`Cleared ${what}: no logs at this age.`, 'event');
        return;
      }
      // A tree with timber in it leaves a stump, of its own kind, in the way
      // of the ground for a day or until somebody digs it out.
      w.setTile(t.x, t.y, TileType.Stump, packTreeData(treeSpecies(data), 0));
      const item = g.gather('log', { count: age.logs, ql: g.productQl('woodcutting', g.toolQl('hatchet')), extra: def.name });
      g.logMsg(`Felled ${what}: ${age.logs} ${age.logs === 1 ? 'log' : 'logs'}, QL ${item.ql.toFixed(1)}. Stump left.`, 'event');
    },
  },
  {
    id: 'dig_stump',
    label: 'Dig out stump',
    verb: 'digging out the stump',
    skill: 'digging',
    tool: 'shovel',
    stamina: 0.06,
    baseTime: 8,
    difficulty: 5,
    applies: (t, g) => tile(t, g) === TileType.Stump,
    check: (t, g) => {
      if (t.kind !== 'tile') return null;
      if (g.world.getTile(t.x, t.y) !== TileType.Stump) return 'No stump here.';
      return g.inventory.has('shovel') ? null : 'Need a shovel.';
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      const def = TREE_DEFS[treeSpecies(g.world.getData(t.x, t.y))];
      if (!g.skillCheck('digging', 5, g.toolQl('shovel'))) {
        g.missed();
        g.logMsg(`Dig failed: ${def.name.toLowerCase()} stump.`, 'event');
        return;
      }
      // Bare dirt where it stood: the roots came out with it.
      g.world.setTile(t.x, t.y, TileType.Dirt);
      g.logMsg(`Dug out: ${def.name.toLowerCase()} stump. Tile: dirt.`, 'event');
    },
  },
  {
    id: 'pick_sprout',
    label: 'Pick sprout',
    verb: 'picking a sprout',
    skill: 'forestry',
    stamina: 0.02,
    baseTime: 4,
    difficulty: 15,
    applies: (t, g) => tile(t, g) === TileType.Tree,
    check: (t, g) => {
      if (t.kind !== 'tile') return null;
      if (g.world.getTile(t.x, t.y) !== TileType.Tree) return 'No tree here.';
      return treeAge(g.world.getData(t.x, t.y)).alive ? null : 'Tree is dead.';
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      const def = TREE_DEFS[treeSpecies(g.world.getData(t.x, t.y))];
      if (!g.sureCheck('pick_sprout', 'forestry', 15)) {
        g.missed();
        g.logMsg('No sprout found.', 'event');
        return;
      }
      // And picks more than one for a Forester's Sprout Picker (`count:sprout`), as the island does.
      const n = Math.max(1, Math.floor(g.perk('count:sprout', 1)));
      g.gather('sprout', { count: n, ql: g.productQl('forestry'), extra: def.name });
      g.logMsg(`Picked: ${n} ${def.name.toLowerCase()} ${n === 1 ? 'sprout' : 'sprouts'}.`, 'event');
    },
  },
  {
    id: 'prune',
    label: 'Prune',
    verb: 'pruning',
    skill: 'forestry',
    tool: 'sickle',
    stamina: 0.03,
    baseTime: 6,
    difficulty: 20,
    applies: (t, g) => tile(t, g) === TileType.Tree,
    check: (t, g) => {
      if (t.kind !== 'tile') return null;
      if (g.world.getTile(t.x, t.y) !== TileType.Tree) return 'No tree here.';
      const data = g.world.getData(t.x, t.y);
      const age = treeAge(data);
      if (!age.alive) return 'Tree is dead.';
      // What each stage prunes to is the table's: a stage back for a grown
      // tree, a shrub for good out of a sapling, and a young tree left to grow.
      // A stage whose next stage is itself is a shrub already kept.
      if (age.pruned === null && age.next === age.id) return 'Already clipped.';
      if (age.pruned === null) return `${TREE_DEFS[treeSpecies(data)].name}: too young to prune.`;
      return g.inventory.has('sickle') ? null : 'Need a sickle.';
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      const data = g.world.getData(t.x, t.y);
      const def = TREE_DEFS[treeSpecies(data)];
      const age = treeAge(data);
      const to = age.pruned === null ? undefined : TREE_AGES[age.pruned];
      if (!to) return;
      if (!g.skillCheck('forestry', 20, g.toolQl('sickle'))) {
        g.missed();
        g.logMsg(`Prune failed: ${def.name.toLowerCase()}.`, 'event');
        return;
      }
      // The age and nothing else. The species stays, and so does the notch a
      // hatchet has left in the trunk — it is beside the land, and the tile
      // is still a tree: pruning is the crown's business, and a half-felled
      // tree pruned back is still half felled.
      g.world.setTile(t.x, t.y, TileType.Tree, packTreeData(treeSpecies(data), to.id));
      g.logMsg(`Pruned ${def.name.toLowerCase()}: ${age.name.toLowerCase()} to ${to.name.toLowerCase()}.`, 'event');
    },
  },
  {
    id: 'harvest_bush',
    label: 'Harvest',
    labelFor: (t, g) => {
      const def = t.kind === 'tile' ? BUSH_DEFS[bushSpecies(g.world.getData(t.x, t.y))] : undefined;
      return def?.yields ? `Cut ${itemDef(def.yields).name.toLowerCase()}` : 'Harvest';
    },
    verb: 'harvesting',
    skill: 'forestry',
    tool: 'sickle',
    stamina: 0.02,
    baseTime: 4,
    applies: (t, g) => tile(t, g) === TileType.Bush,
    check: (t, g) => {
      if (t.kind !== 'tile') return null;
      if (g.world.getTile(t.x, t.y) !== TileType.Bush) return 'No bush here.';
      const def = BUSH_DEFS[bushSpecies(g.world.getData(t.x, t.y))];
      if (!def.yields) return `${def.name}: nothing to harvest.`;
      // Nothing to cut out of its season (`fruiting.ts`).
      const out = fruitRefusal(def.yields, g.wallNow());
      if (out) return out;
      if (g.isForaged(t.x, t.y, 'forage')) return `${def.name}: already picked. Try later.`;
      return g.inventory.has('sickle') ? null : 'Need a sickle.';
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      const def = BUSH_DEFS[bushSpecies(g.world.getData(t.x, t.y))];
      if (!def.yields) return;
      // As fruit off a tree: more to a practised hand, and never nothing.
      const skill = g.skills.get('forestry');
      const count = Math.max(1, Math.round(3 * (0.5 + skill / 130) * (0.7 + g.rand() * 0.6)));
      const made = g.gather(def.yields, { count, ql: g.productQl('forestry', g.toolQl('sickle')) });
      g.markForaged(t.x, t.y, 'forage');
      g.gainSkill('forestry', 0.35);
      g.logMsg(`Harvested: ${count} ${itemDef(def.yields).name.toLowerCase()}, QL ${made.ql.toFixed(1)}.`, 'event');
      // And one more, now and then, for a Bountiful on the sickle.
      g.enchantMore('sickle', 'bounty', def.yields, made.ql);
    },
  },
  {
    id: 'pick_fruit',
    label: 'Pick fruit',
    labelFor: (t, g) => {
      const def = t.kind === 'tile' ? TREE_DEFS[treeSpecies(g.world.getData(t.x, t.y))] : undefined;
      return def?.fruit ? `Pick ${itemDef(def.fruit).name.toLowerCase()}s` : 'Pick fruit';
    },
    verb: 'picking fruit',
    skill: 'forestry',
    repeat: true,
    stamina: 0.02,
    baseTime: 4,
    applies: (t, g) => {
      if (t.kind !== 'tile' || g.world.getTile(t.x, t.y) !== TileType.Tree) return false;
      return !!TREE_DEFS[treeSpecies(g.world.getData(t.x, t.y))].fruit;
    },
    check: (t, g) => {
      if (t.kind !== 'tile') return null;
      const data = g.world.getData(t.x, t.y);
      const def = TREE_DEFS[treeSpecies(data)];
      if (!def.fruit) return 'Bears no fruit.';
      if (!treeAge(data).alive) return 'Tree is dead.';
      // A sapling bears nothing; it has to have some years in it first.
      if (!treeAge(data).bears) return `${def.name}: too young to bear.`;
      // Nothing hangs on it out of its season (`fruiting.ts`).
      const out = fruitRefusal(def.fruit, g.wallNow());
      if (out) return out;
      if (g.isForaged(t.x, t.y, 'forage')) return `${def.name}: already picked. Try later.`;
      return null;
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      const data = g.world.getData(t.x, t.y);
      const def = TREE_DEFS[treeSpecies(data)];
      if (!def.fruit) return;
      // An old tree carries more than one only just come into bearing, and a
      // very old one as much as an old one.
      const old = treeVariant(data) === 2 || treeVariant(data) === 4;
      const skill = g.skills.get('forestry');
      // And more for Love's Abundance, as a field's harvest has.
      const count = Math.max(1, Math.round((old ? FRUIT_OLD : FRUIT_MATURE) * (0.5 + skill / 130) * (0.7 + g.rand() * 0.6) * g.pathFx('harvest', 1)));
      const made = g.gather(def.fruit, { count, ql: g.productQl('forestry'), });
      g.markForaged(t.x, t.y, 'forage');
      g.gainSkill('forestry', 0.35);
      g.logMsg(`Picked: ${count} ${itemDef(def.fruit).name.toLowerCase()}${count === 1 ? '' : 's'}, QL ${made.ql.toFixed(1)}.`, 'event');
    },
  },
  {
    id: 'plant',
    label: 'Plant sprout',
    verb: 'planting',
    skill: 'forestry',
    stamina: 0.03,
    baseTime: 5,
    applies: (t, g) => DIGGABLE_PLANT_TILES.has(tile(t, g)) && g.inventory.has('sprout'),
    check: (t, g) => {
      // A tree would grow up through an aqueduct's arches.
      if (t.kind === 'tile' && g.bridgeAt(t.x, t.y)?.kind === 'aqueduct') return AQ_OVER;
      // The one chosen off the menu, or the first that comes to hand. Sprouts
      // come in nine species and do not look alike once they are twenty years
      // old, so a pack holding oak and cedar had no way to say which.
      const asked = t.kind === 'tile' ? t.itemUid : undefined;
      const chosen = asked !== undefined ? g.inventory.get(asked) : undefined;
      if (asked !== undefined && chosen?.id !== 'sprout') return 'Not a sprout.';
      if (!chosen && !g.inventory.has('sprout')) return 'Need a sprout.';
      // A grown tile of tree is something you walk round, not through, and the
      // sprout becomes that tile the moment it goes in. Planted underfoot it
      // closes over the person who planted it.
      if (t.kind === 'tile' && t.x === g.player.tileX && t.y === g.player.tileY) {
        return 'Step off the tile first.';
      }
      // Nor under a building, where a tile on piers has grass or sand under its deck (`piers.ts`),
      // and not under a jetty, which it would grow up through (`frame.ts`).
      return t.kind === 'tile' ? (underBuilding(g, t.x, t.y) ?? jettyOver(g, t.x, t.y)) : null;
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      const picked = t.itemUid !== undefined ? g.inventory.get(t.itemUid) : undefined;
      const sprout = picked?.id === 'sprout' ? picked : g.inventory.find('sprout');
      if (!sprout) return;
      const species = Math.max(
        0,
        TREE_DEFS.findIndex((d) => d.name === sprout.extra),
      );
      g.inventory.remove(sprout.uid, 1);
      // Young, or further on for a Forester's Nursery.
      const age = plantedAge(g.perk('grown:plant', 0));
      g.world.setTile(t.x, t.y, TileType.Tree, packTreeData(species, age));
      g.note('planted');
      if (TREE_DEFS[species].fruit) g.note('orchard');
      const name = TREE_DEFS[species].name.toLowerCase();
      g.logMsg(`Planted: ${name} sprout.${age === PLANTED_AGE ? '' : ` Starts ${TREE_AGES[age].name.toLowerCase()}.`}`, 'event');
    },
  },
  {
    id: 'graft',
    label: 'Graft',
    labelFor: (t, g) => {
      const it = t.kind === 'tile' && t.itemUid !== undefined ? g.inventory.get(t.itemUid) : undefined;
      return it?.extra ? `Graft ${it.extra.toLowerCase()} sprout` : 'Graft';
    },
    verb: 'grafting',
    skill: 'forestry',
    tool: 'carving_knife',
    stamina: 0.03,
    baseTime: 8,
    difficulty: 40,
    applies: (t, g) => tile(t, g) === TileType.Tree && g.inventory.items.some((it) => it.id === 'sprout' && fruitSprout(it)),
    check: (t, g) => {
      if (t.kind !== 'tile') return null;
      if (g.world.getTile(t.x, t.y) !== TileType.Tree) return 'No tree here.';
      const data = g.world.getData(t.x, t.y);
      const age = treeAge(data);
      if (!age.alive) return 'Tree is dead.';
      if (TREE_DEFS[treeSpecies(data)].fruit) return 'Already bears fruit.';
      // Grafting is the forester's finest work, and a beginner's graft is a
      // sprout thrown away.
      if (g.skills.get('forestry') < GRAFT_SKILL) return `Needs forestry ${GRAFT_SKILL}.`;
      const asked = t.itemUid !== undefined ? g.inventory.get(t.itemUid) : undefined;
      if (asked !== undefined && !(asked?.id === 'sprout' && fruitSprout(asked))) return 'Not a fruit sprout.';
      if (!asked && !g.inventory.items.some((it) => it.id === 'sprout' && fruitSprout(it))) return 'Need a fruit sprout.';
      if (!g.inventory.has('carving_knife')) return 'Need a carving knife.';
      // Nor under a building (`piers.ts`).
      return underBuilding(g, t.x, t.y);
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      const picked = t.itemUid !== undefined ? g.inventory.get(t.itemUid) : undefined;
      const sprout = picked?.id === 'sprout' && fruitSprout(picked) ? picked : g.inventory.items.find((it) => it.id === 'sprout' && fruitSprout(it));
      if (!sprout) return;
      const data = g.world.getData(t.x, t.y);
      const was = TREE_DEFS[treeSpecies(data)];
      const species = TREE_DEFS.findIndex((d) => d.name === sprout.extra);
      if (species < 0) return;
      // The sprout is spent either way: a graft that does not take is a sprout gone.
      g.inventory.remove(sprout.uid, 1);
      if (!g.sureCheck('graft', 'forestry', 40, g.toolQl('carving_knife'))) {
        g.missed();
        g.logMsg(`Graft failed: ${TREE_DEFS[species].name.toLowerCase()} sprout lost.`, 'event');
        return;
      }
      // The species and nothing else: the age stays, and so does any notch.
      g.world.setTile(t.x, t.y, TileType.Tree, packTreeData(species, treeVariant(data)));
      g.note('orchard');
      g.logMsg(`Grafted: ${was.name.toLowerCase()} to ${treeAge(data).name.toLowerCase()} ${TREE_DEFS[species].name.toLowerCase()}.`, 'event');
    },
  },
  /*
   * A Forester's Coppice: a tree grown enough to bear cut back to the stool
   * for `coppice` logs, and left standing, young, to grow on. It grows on the
   * same clock as any other, so it is mature again at the next dawn. The
   * island does the same in `perform_ground`.
   */
  {
    id: 'coppice',
    label: 'Coppice',
    verb: 'coppicing',
    skill: 'woodcutting',
    tool: 'hatchet',
    stamina: 0.07,
    baseTime: 8,
    difficulty: 10,
    applies: (t, g) => t.kind === 'tile' && g.perk('coppice', 0) > 0 && tile(t, g) === TileType.Tree,
    check: (t, g) => {
      if (t.kind !== 'tile') return null;
      // The tool first and then the rest, in the order the island asks them.
      if (!g.inventory.has('hatchet')) return 'Need a hatchet.';
      if (g.perk('coppice', 0) <= 0) return 'Needs perk: Coppice (Forester).';
      if (g.world.getTile(t.x, t.y) !== TileType.Tree) return 'No tree here.';
      const data = g.world.getData(t.x, t.y);
      if (!treeAge(data).alive) return 'Tree is dead.';
      if (!coppiceable(data)) return `${TREE_DEFS[treeSpecies(data)].name}: too young to coppice.`;
      return null;
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      const w = g.world;
      const data = w.getData(t.x, t.y);
      if (w.getTile(t.x, t.y) !== TileType.Tree || !coppiceable(data)) return;
      const def = TREE_DEFS[treeSpecies(data)];
      if (!g.skillCheck('woodcutting', 10, g.toolQl('hatchet'))) {
        g.missed();
        g.logMsg('Cut failed.', 'event');
        return;
      }
      // A fresh trunk off the stool: whatever notch was in the old one went with it.
      w.setTile(t.x, t.y, TileType.Tree, packTreeData(treeSpecies(data), PLANTED_AGE));
      w.setNotch(t.x, t.y, 0);
      const n = g.perk('coppice', 0);
      const item = g.gather('log', { count: n, ql: g.productQl('woodcutting', g.toolQl('hatchet')), extra: def.name });
      g.logMsg(`Coppiced ${treeAge(data).name.toLowerCase()} ${def.name.toLowerCase()}: ${n} ${n === 1 ? 'log' : 'logs'}, QL ${item.ql.toFixed(1)}. `
        + `Now ${TREE_AGES[PLANTED_AGE].name.toLowerCase()}.`, 'event');
    },
  },
  /*
   * A Forester's Tap Resin: `tap_resin` tar out of a living pine, once a day
   * for each pine -- the day turning at the woods' dawn. The island keeps
   * which pines are tapped (`foraged`, kind `resin`), and so does a game
   * played alone.
   */
  {
    id: 'tap_resin',
    label: 'Tap resin',
    verb: 'tapping resin',
    skill: 'forestry',
    tool: 'carving_knife',
    stamina: 0.03,
    baseTime: 6,
    applies: (t, g) => t.kind === 'tile' && g.perk('tap_resin', 0) > 0 && tile(t, g) === TileType.Tree
      && treeSpecies(g.world.getData(t.x, t.y)) === RESIN_TREE,
    check: (t, g) => {
      if (t.kind !== 'tile') return null;
      if (!g.inventory.has('carving_knife')) return 'Need a carving knife.';
      if (g.perk('tap_resin', 0) <= 0) return 'Needs perk: Tap Resin (Forester).';
      if (g.world.getTile(t.x, t.y) !== TileType.Tree) return 'No tree here.';
      const data = g.world.getData(t.x, t.y);
      const pine = TREE_DEFS[RESIN_TREE].name.toLowerCase();
      if (treeSpecies(data) !== RESIN_TREE) return `Only a ${pine}.`;
      if (!treeAge(data).alive) return 'Tree is dead.';
      if (!tappable(data)) return `${capital(pine)}: too young to tap.`;
      if (g.tappedToday(t.x, t.y)) return `Tapped today. Again at the ${DAILY_RESET}.`;
      return null;
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      const data = g.world.getData(t.x, t.y);
      if (g.world.getTile(t.x, t.y) !== TileType.Tree || !tappable(data) || g.tappedToday(t.x, t.y)) return;
      g.markTapped(t.x, t.y);
      const n = g.perk('tap_resin', 0);
      const item = g.gather('tar', { count: n, ql: g.productQl('forestry', g.toolQl('carving_knife')) });
      g.logMsg(`Tapped: ${n} ${itemDef('tar').name.toLowerCase()}, QL ${item.ql.toFixed(1)}.`, 'event');
    },
  },
  /*
   * A Forester's Clear Brush: every bush and reed within `clear_brush` tiles
   * of the one chosen, cleared in one go. A bush leaves grass and reeds leave
   * bare dirt, as `CLEARED_TO` has it; nothing comes of it but the clearing.
   */
  {
    id: 'clear_brush',
    label: 'Clear brush',
    verb: 'clearing brush',
    skill: 'forestry',
    tool: 'sickle',
    stamina: 0.08,
    baseTime: 16,
    applies: (t, g) => t.kind === 'tile' && g.perk('clear_brush', 0) > 0 && CLEARED_TO[tile(t, g)] !== undefined,
    check: (t, g) => {
      if (t.kind !== 'tile') return null;
      if (!g.inventory.has('sickle')) return 'Need a sickle.';
      if (g.perk('clear_brush', 0) <= 0) return 'Needs perk: Clear Brush (Forester).';
      if (CLEARED_TO[g.world.getTile(t.x, t.y)] === undefined) return 'No brush here.';
      return null;
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      const w = g.world;
      const spots = brushAround(w, t.x, t.y, g.perk('clear_brush', 0));
      for (const [x, y] of spots) w.setTile(x, y, CLEARED_TO[w.getTile(x, y)] as TileType);
      g.logMsg(`Brush cleared: ${spots.length} ${spots.length === 1 ? 'tile' : 'tiles'}.`, 'event');
    },
  },
  {
    id: 'forage',
    label: 'Forage',
    verb: 'foraging',
    skill: 'foraging',
    stamina: 0.03,
    baseTime: 5,
    applies: (t, g) => t.kind === 'tile' && !!TILE_DEFS[tile(t, g)].forage,
    check: (t, g) => (t.kind === 'tile' && g.isForaged(t.x, t.y, 'forage') ? 'Already searched. Try later.' : null),
    labelFor: (_t, g) => {
      const rolls = searches(g, 'forage', 'foraging');
      return rolls > 1 ? `Forage (${rolls} passes)` : 'Forage';
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      g.markForaged(t.x, t.y, 'forage');
      // A practised eye goes over the same ground more than once, and a
      // Naturalist's Keen Eye once more again.
      const rolls = searches(g, 'forage', 'foraging');
      const found = lookOver(g, 'forage', 'foraging', FORAGE_TABLE, rolls);
      // Now and then a gold coin in the grass, and no more than so many a day.
      const dawn = lastDawn(Date.now() / 1000);
      if (g.coinFinds.dawn !== dawn) g.coinFinds = { dawn, n: 0 };
      if (g.coinFinds.n < COIN_FINDS_A_DAY && g.rand() < 1 / COIN_FIND_ONE_IN) {
        g.coinFinds.n++;
        const coin = g.inventory.add('coin', { ql: g.productQl('foraging'), extra: 'Gold', count: 1 });
        g.logMsg(`Found: gold coin, QL ${coin.ql.toFixed(1)}.`, 'event');
      }
      if (!found.length) {
        g.missed();
        g.logMsg(rolls > 1 ? `Found nothing (${rolls} passes).` : 'Found nothing.', 'event');
        return;
      }
      g.logMsg(`Found: ${listOf(found)}.`, 'event');
    },
  },
  {
    id: 'botanize',
    label: 'Botanize',
    verb: 'botanizing',
    skill: 'botanizing',
    stamina: 0.03,
    baseTime: 5,
    applies: (t, g) => t.kind === 'tile' && !!TILE_DEFS[tile(t, g)].botanize,
    check: (t, g) => (t.kind === 'tile' && g.isForaged(t.x, t.y, 'botanize') ? 'Already searched. Try later.' : null),
    labelFor: (_t, g) => {
      const rolls = searches(g, 'botanize', 'botanizing');
      return rolls > 1 ? `Botanize (${rolls} passes)` : 'Botanize';
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      g.markForaged(t.x, t.y, 'botanize');
      const rolls = searches(g, 'botanize', 'botanizing');
      // At the water's edge the table has water lily roots and lotus seeds in it too.
      const found = lookOver(g, 'botanize', 'botanizing', atWaterEdge(g, t.x, t.y) ? BOTANIZE_WATER_TABLE : BOTANIZE_TABLE, rolls);
      if (!found.length) {
        g.missed();
        g.logMsg(rolls > 1 ? `Found nothing (${rolls} passes).` : 'Found nothing.', 'event');
        return;
      }
      g.logMsg(`Found: ${listOf(found)}.`, 'event');
    },
  },
  {
    id: 'drink',
    label: 'Drink',
    verb: 'drinking',
    stamina: 0,
    baseTime: 2,
    applies: (t, g) => t.kind === 'tile' && g.world.hasWater(t.x, t.y),
    perform: (_t, g) => {
      g.player.stats.thirst = 1;
      g.logMsg('Drank water.', 'event');
    },
  },
  {
    id: 'pack',
    label: 'Pack',
    verb: 'packing',
    /*
     * Paving, not digging. Treading a road flat is the first thing a paver
     * does and none of it is digging — the shovel is in your hand to cut the
     * turf off, which is the same reason a paver carries one.
     */
    skill: 'paving',
    tool: 'shovel',
    stamina: 0.03,
    baseTime: 4,
    applies: (t, g) => PACKABLE.has(tile(t, g)),
    check: (t, g) => (t.kind === 'tile' && underBuilding(g, t.x, t.y)) || (g.inventory.has('shovel') ? null : 'Need a shovel.'),
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      const sod = tile(t, g) !== TileType.Dirt;
      g.world.setTile(t.x, t.y, TileType.PackedDirt);
      g.logMsg(sod ? 'Turf cut; ground packed.' : 'Ground packed.', 'event');
    },
  },
  {
    id: 'cultivate',
    label: 'Cultivate',
    verb: 'cultivating',
    skill: 'digging',
    tool: 'shovel',
    stamina: 0.03,
    baseTime: 4,
    applies: (t, g) => tile(t, g) === TileType.PackedDirt,
    check: (t, g) => (t.kind === 'tile' && underBuilding(g, t.x, t.y)) || (g.inventory.has('shovel') ? null : 'Need a shovel.'),
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      g.world.setTile(t.x, t.y, TileType.Dirt);
      g.logMsg('Cultivated: tile is dirt.', 'event');
    },
  },
  {
    id: 'pave_cobble',
    label: 'Pave (cobblestone)',
    verb: 'paving',
    skill: 'paving',
    stamina: 0.03,
    baseTime: 5,
    applies: (t, g) => tile(t, g) === TileType.PackedDirt,
    check: (t, g) => (t.kind === 'tile' && underBuilding(g, t.x, t.y)) || unpacked(t, g) || (g.inventory.has('stone_brick') ? null : 'Need a stone brick.'),
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      if (!g.inventory.consume('stone_brick')) return;
      g.world.setTile(t.x, t.y, TileType.Cobblestone);
      // Laid, and bare: the moss starts from here (`greening.ts`).
      g.pavingSince.set(`${t.x},${t.y}`, greenNow());
      g.logMsg('Cobblestones laid.', 'event');
    },
  },
  {
    id: 'pave_slabs',
    label: 'Pave (slabs)',
    verb: 'laying slabs',
    skill: 'paving',
    tool: 'trowel',
    stamina: 0.04,
    baseTime: 7,
    difficulty: 10,
    applies: (t, g) => tile(t, g) === TileType.PackedDirt,
    check: (t, g) => {
      if (t.kind !== 'tile') return null;
      const under = underBuilding(g, t.x, t.y);
      if (under) return under;
      const soft = unpacked(t, g);
      if (soft) return soft;
      if (!g.inventory.has('trowel')) return 'Need a trowel.';
      const slab = t.itemUid !== undefined ? g.inventory.get(t.itemUid) : g.inventory.items.find((it) => SLAB_BY_ITEM.has(it.id));
      if (!slab || !SLAB_BY_ITEM.has(slab.id)) return 'Need a cut slab.';
      return null;
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      const slab = t.itemUid !== undefined ? g.inventory.get(t.itemUid) : g.inventory.items.find((it) => SLAB_BY_ITEM.has(it.id));
      const kind = slab && SLAB_BY_ITEM.get(slab.id);
      if (!slab || kind === undefined) return;
      if (!g.sureCheck('pave_slabs', 'paving', 10, slab.ql)) {
        g.missed();
        g.logMsg('Slab failed.', 'event');
        return;
      }
      if (!g.inventory.remove(slab.uid, 1)) return;
      g.world.setTile(t.x, t.y, TileType.Slabs, kind);
      g.pavingSince.set(`${t.x},${t.y}`, greenNow());
      g.logMsg(`Laid: ${itemDef(slab.id).name.toLowerCase()}.`, 'event');
    },
  },
  {
    id: 'remove_paving',
    label: 'Remove paving',
    verb: 'breaking up the paving',
    skill: 'paving',
    tool: 'pickaxe',
    stamina: 0.04,
    baseTime: 5,
    applies: (t, g) => tile(t, g) === TileType.Cobblestone || tile(t, g) === TileType.Slabs,
    check: (t, g) => (t.kind === 'tile' && underBuilding(g, t.x, t.y)) || (g.inventory.has('pickaxe') ? null : 'Need a pickaxe.'),
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      // A slab comes up whole more often than not; a cobble does not.
      const wasSlab = g.world.getTile(t.x, t.y) === TileType.Slabs;
      const kind = wasSlab ? SLAB_VARIANTS[slabVariant(g.world.getData(t.x, t.y))] : null;
      g.world.setTile(t.x, t.y, TileType.Dirt);
      g.pavingSince.delete(`${t.x},${t.y}`);
      if (kind && g.rand() < 0.6) {
        const back = g.gather(kind.item, { ql: g.productQl('paving') });
        g.logMsg(`Lifted whole: ${kind.name.toLowerCase().replace(/s$/, '')}, QL ${back.ql.toFixed(1)}.`, 'event');
        return;
      }
      g.logMsg('Paving removed. Tile: dirt.', 'event');
    },
  },
  // Item actions
  {
    id: 'examine_item',
    label: 'Examine',
    verb: 'examining',
    instant: true,
    stamina: 0,
    baseTime: 0,
    applies: (t) => t.kind === 'item',
    perform: (t, g) => {
      if (t.kind !== 'item') return;
      const item = g.inventory.get(t.uid);
      if (!item) return;
      const def = itemDef(item.id);
      const desc = def.description ? ` ${def.description}` : '';
      // What it is made of is half of what it is, so it is said here.
      const made = materialOfItem(item);
      const stuff = made ? ` ${made.name}: ${made.note}` : '';
      const r = rarityOf(item);
      const rare = r.name ? ` ${capital(r.name)}: effect ×${r.boost}, wear and rot ×${r.keep}, improvable to ${r.ceiling} quality past your skill.` : '';
      // Rare work and work made at the signing QL carry their maker's name, and the line it was signed with
      // (`signing.ts`): the island's `maker_says`. And what a maker's perks put into it is said.
      // And what is enchanted into it, at its quality (`enchanting.ts`): the island's `enchant_says`.
      // And the line cut into a memorial stone (`memorial.ts`): the island's `engraved_item_says`.
      // And the square a map holds (`cartography.ts`): the island's `chart_item_says`.
      const cut = signableKind(item.id) ? '' : engravedItemSays(item);
      const by = `${makerSays(item)}${markSays(item.mark)}${enchantSays(item)}${cut}${chartItemSays(item)}`;
      // A knack comes off something somebody made, so the examine line says so
      // for the same things the eating does.
      const skill = knackable(item.id) ? boonOf(g.seed, item.id) : null;
      const favours = (skill ? ` ${(def.food ?? 0) > 0 ? 'Meal' : 'Drink'} boost: ${(SKILL_DEFS.find((d) => d.id === skill)?.name ?? skill).toLowerCase()}.` : '')
        // And what an Artisan's circlet has in it.
        + (item.id === CIRCLET ? circletSays(item) : '')
        // And how far a Telestone reaches and how long a journey on it makes you wait, at its own quality.
        + (item.id === TELESTONE ? telestoneSays(item.ql) : '');
      // What it is worth at the work now, which is rarely the number stamped on it.
      const worth = g.toolWorth(item);
      const at = itemDef(item.id).category === 'tool' && Math.abs(worth - item.ql) >= 0.05 ? ` Works as Quality ${worth.toFixed(1)} now.` : '';
      // And to a Cook's tongue, what a helping of it does (a Cook's Taste).
      const taste = g.perk('taste', 0) > 0 ? tasteSays(g, item) : '';
      // What dye is in it, or what colour it was dyed (`dyestuffs.ts`): the island's `dye_item_says`.
      const held = dyeIn(item);
      const hex = held ? null : dyeHexOf(item.dye);
      const dyed = held ? ` Holds: ${dyeSays(held.liquid, held.litres)}` : hex ? ` Dyed: ${hex}.` : '';
      g.logMsg(`${itemName(item)}: Quality ${item.ql.toFixed(2)}, damage ${item.dmg.toFixed(2)}%, weight ${itemWeight(item).toFixed(2)} kg.${at}${desc}${dyed}${rare}${by}${favours}${stuff}${taste}`, 'event');
    },
  },
  {
    id: 'eat',
    label: 'Eat',
    verb: 'eating',
    stamina: 0,
    baseTime: 2,
    applies: (t, g) => {
      if (t.kind !== 'item') return false;
      const item = g.inventory.get(t.uid);
      return !!item && !!itemDef(item.id).food && !item.locked;
    },
    perform: (t, g) => {
      if (t.kind !== 'item') return;
      const item = g.inventory.get(t.uid);
      if (!item) return;
      const def = itemDef(item.id);
      g.inventory.remove(item.uid, 1);
      // Fuller, the more and the longer for its maker's hand in it (a Cook's
      // Filling, Hearty and Flavoursome), whoever is eating it.
      g.player.stats.hunger = Math.min(1, g.player.stats.hunger + (def.food ?? 0) * (0.7 + item.ql / 200) * markOf(item, 'fill'));
      // A dish favours a trade, and having eaten it you are better at that
      // trade for a while.
      const favour = g.grantBoon(item.id, item.ql, markOf(item, 'knack'));
      const full = g.nourish(item.id, item.ql, markOf(item, 'feed'));
      g.logMsg(`Ate: ${def.name.toLowerCase()}.${favour ? ` ${favour}` : ''}${full ? ` ${full}` : ''}`, 'event');
    },
  },
  {
    id: 'stow_item',
    label: 'Put in a bag',
    verb: 'stowing it',
    instant: true,
    quantity: true,
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => {
      if (t.kind !== 'item') return false;
      const item = g.inventory.get(t.uid);
      if (!item || isBag(item) || g.isEquipped(item.uid)) return false;
      return g.inventory.items.some((b) => isBag(b) && !bagRefuses(b, { ...item, count: 1 }));
    },
    check: (t, g) => {
      if (t.kind !== 'item') return null;
      const item = g.inventory.get(t.uid);
      if (!item) return 'It is gone.';
      if (isBag(item)) return 'One bag will not go inside another.';
      // A bag with room for one of them is a bag worth walking a stack to:
      // what fits goes in and the rest stays loose in the pack.
      const bag = g.inventory.items.find((b) => isBag(b) && !bagRefuses(b, { ...item, count: 1 }));
      return bag ? null : 'No bag with room.';
    },
    maxRepeat: (t, g) => (t.kind === 'item' ? (g.inventory.get(t.uid)?.count ?? 1) : 1),
    perform: (t, g) => {
      if (t.kind !== 'item') return;
      const held = g.inventory.get(t.uid);
      if (!held) return;
      const want = Math.min(t.count ?? 1, held.count);
      const bag = g.inventory.items.find((b) => isBag(b) && !bagRefuses(b, { ...held, count: 1 }));
      if (!bag) return;
      const fits = Math.min(want, bagSpare(bag));
      if (fits <= 0) return;
      const taken = g.inventory.take(held.uid, fits);
      if (!taken || !bagAdd(bag, taken)) {
        if (taken) g.inventory.addItem(taken);
        return;
      }
      g.events.emit('inventory');
      g.logMsg(storedLine(taken.count, itemName(taken), itemDef(bag.id).name, want - taken.count), 'event');
    },
  },
  {
    id: 'empty_bag',
    label: 'Empty bag',
    verb: 'emptying it',
    instant: true,
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => {
      if (t.kind !== 'item') return false;
      const item = g.inventory.get(t.uid);
      return !!item && isBag(item) && !!item.inside?.length;
    },
    perform: (t, g) => {
      if (t.kind !== 'item') return;
      const bag = g.inventory.get(t.uid);
      if (!bag?.inside?.length) return;
      const n = bag.inside.length;
      for (const it of bag.inside.splice(0)) g.inventory.addItem(it);
      g.events.emit('inventory');
      g.logMsg(`Emptied ${itemDef(bag.id).name.toLowerCase()}: ${n} ${n === 1 ? 'item' : 'items'} to pack.`, 'event');
    },
  },
  {
    id: 'repair_item',
    label: 'Repair',
    verb: 'repairing',
    skill: 'repair',
    repeat: true,
    stamina: 0.02,
    baseTime: 1,
    // Not offered on a find nobody has restored yet (`unrestored`), which nothing mends.
    applies: (t, g) => {
      if (t.kind !== 'item') return false;
      const item = g.inventory.get(t.uid);
      return !!item && item.dmg > 0 && !unrestored(item);
    },
    check: (t, g) => {
      if (t.kind !== 'item') return null;
      const item = g.inventory.get(t.uid);
      if (!item) return 'It is gone.';
      if (unrestored(item)) return NOT_RESTORED;
      if (item.dmg <= 0) return 'Not damaged.';
      if (item.ql <= REPAIR_FLOOR) return `QL at ${REPAIR_FLOOR}: cannot repair.`;
      return null;
    },
    perform: (t, g) => {
      if (t.kind !== 'item') return;
      const item = g.inventory.get(t.uid);
      if (!item || item.dmg <= 0) return;
      // A second's work: some of the damage comes out, and a little of the quality
      // with it — a little, not much, so mending a thing is not the end of it.
      // More out at a go for a Mender's Big Mend, less quality for each point of
      // it for Light Touch, and now and then none at all for Clean Repair.
      const go = repairGo(g.skills.get('repair'));
      const healed = Math.min(item.dmg, go.healed * g.perk('mend:repair_item', 1));
      const keep = g.perk('keep:repair_item', 0);
      const clean = keep > 0 && g.rand() < keep;
      item.dmg = Math.max(0, item.dmg - healed);
      if (!clean) item.ql = Math.max(REPAIR_FLOOR, item.ql - healed * go.cost * g.perk('cost:repair_item', 1));
      g.events.emit('inventory');
      g.gainSkill('repair', 0.25);
      if (item.dmg <= 0) {
        g.logMsg(`Fully repaired: ${itemName(item).toLowerCase()}, QL ${item.ql.toFixed(1)}.`, 'event');
        return false;
      }
      // Keep at it while there is damage left and wind to do it with.
      return true;
    },
  },
  {
    /*
     * A Tailor's Patch: a cloth or a leather piece mended with a piece of its
     * own stuff, the perk's own number of damage off at a go and nothing off
     * its quality, where a repair takes a little off every time.
     */
    id: 'patch_item',
    label: 'Patch',
    verb: 'patching',
    stamina: 0.02,
    baseTime: 4,
    applies: (t, g) => {
      if (t.kind !== 'item') return false;
      const item = g.inventory.get(t.uid);
      return !!item && item.dmg > 0 && patchWith(item.id) !== null;
    },
    check: (t, g) => {
      if (t.kind !== 'item') return null;
      if (g.perk('patch_item', 0) <= 0) return PATCH_PERK;
      const item = g.inventory.get(t.uid);
      if (!item) return 'It is gone.';
      const stuff = patchWith(item.id);
      if (!stuff) return 'Cloth or leather only.';
      if (item.dmg <= 0) return 'Not damaged.';
      if (!g.inventory.has(stuff)) return `Need ${stuff}.`;
      return null;
    },
    perform: (t, g) => {
      if (t.kind !== 'item') return;
      const item = g.inventory.get(t.uid);
      const stuff = item ? patchWith(item.id) : null;
      const piece = stuff ? g.inventory.find(stuff) : undefined;
      if (!item || !stuff || !piece || !g.inventory.remove(piece.uid, 1)) return;
      const off = Math.min(item.dmg, g.perk('patch_item', 0));
      item.dmg = Math.max(0, item.dmg - off);
      g.events.emit('inventory');
      g.gainSkill(improvable(item.id)?.skill ?? 'tailoring', 0.25);
      // The piece by its plain name, as the island says it.
      g.logMsg(`Patched: ${itemDef(item.id).name.toLowerCase()}, damage ${item.dmg.toFixed(2)}%.`, 'event');
    },
  },
  {
    /*
     * A Mender's repair kit, which anybody who has one may use: `KIT_MEND`
     * damage off anything, wherever you are, and nothing off its quality, and
     * the kit is used up.
     */
    id: 'mend_kit',
    label: 'Repair kit',
    verb: 'mending',
    stamina: 0.02,
    baseTime: 3,
    applies: (t, g) => {
      if (t.kind !== 'item') return false;
      const item = g.inventory.get(t.uid);
      return !!item && item.dmg > 0 && item.id !== 'repair_kit' && !unrestored(item) && g.inventory.count('repair_kit') > 0;
    },
    check: (t, g) => {
      if (t.kind !== 'item') return null;
      const item = g.inventory.get(t.uid);
      if (!item) return 'It is gone.';
      if (unrestored(item)) return NOT_RESTORED;
      if (item.dmg <= 0) return 'Not damaged.';
      if (item.id === 'repair_kit') return 'Not on a repair kit.';
      if (g.inventory.count('repair_kit') < 1) return 'Need a repair kit.';
      return null;
    },
    perform: (t, g) => {
      if (t.kind !== 'item') return;
      const item = g.inventory.get(t.uid);
      const kit = g.inventory.find('repair_kit');
      if (!item || !kit || item.dmg <= 0 || !g.inventory.remove(kit.uid, 1)) return;
      item.dmg = Math.max(0, item.dmg - KIT_MEND);
      g.events.emit('inventory');
      g.gainSkill('repair', 0.25);
      g.logMsg(`Mended: ${itemDef(item.id).name.toLowerCase()}, damage ${item.dmg.toFixed(2)}%.`, 'event');
    },
  },
  {
    /*
     * A Mender's sealant, which anybody who has some may work over a thing: it
     * never decays after, wherever it is left (`seal`, nought). A pile takes one
     * for each thing in it.
     */
    id: 'seal_item',
    label: 'Seal',
    verb: 'sealing',
    stamina: 0.02,
    baseTime: 3,
    applies: (t, g) => {
      if (t.kind !== 'item') return false;
      const item = g.inventory.get(t.uid);
      return !!item && sealable(item) && g.inventory.count('sealant') > 0;
    },
    check: (t, g) => {
      if (t.kind !== 'item') return null;
      const item = g.inventory.get(t.uid);
      if (!item) return 'It is gone.';
      if (item.id === 'sealant') return 'Not on sealant.';
      if (item.mark?.seal !== undefined) return 'Already sealed.';
      const have = g.inventory.count('sealant');
      if (have < item.count) return `Need ${item.count} sealant; have ${have}.`;
      return null;
    },
    perform: (t, g) => {
      if (t.kind !== 'item') return;
      const item = g.inventory.get(t.uid);
      if (!item || !sealable(item) || g.inventory.count('sealant') < item.count) return;
      g.inventory.consume('sealant', item.count);
      item.mark = { ...(item.mark ?? {}), seal: 0 };
      g.events.emit('inventory');
      g.gainSkill('repair', 0.1);
      g.logMsg(`Sealed: ${itemName(item).toLowerCase()}. No decay.`, 'event');
    },
  },
  {
    /*
     * A stone set in an Artisan's circlet, off the stone's own menu, by anybody
     * with a file: on jewellery at `CIRCLET_SET`, surer for a perk on it (an
     * Artisan's Sure Setting), and a stone that will not seat is taken out
     * again whole. It goes into the first circlet carried that has a setting
     * empty, by the order they were made, which is the island's order too.
     */
    id: 'set_in_circlet',
    label: 'Set in circlet',
    verb: 'setting a stone',
    skill: 'jewellery',
    tool: 'file',
    stamina: 0.03,
    baseTime: 10,
    difficulty: CIRCLET_SET,
    applies: (t, g) => {
      if (t.kind !== 'item') return false;
      const item = g.inventory.get(t.uid);
      return item?.id === 'gem' && !!gemOf(item) && circletWithRoom(g.inventory.items) !== undefined;
    },
    check: (t, g) => {
      if (t.kind !== 'item') return null;
      const item = g.inventory.get(t.uid);
      if (!item) return 'It is gone.';
      if (item.id !== 'gem' || !gemOf(item)) return 'Gems only.';
      if (!circletWithRoom(g.inventory.items)) return `Need a circlet with an empty setting (${CIRCLET_STONES} per circlet).`;
      if (!g.inventory.has('file')) return 'Need a file.';
      return null;
    },
    perform: (t, g) => {
      if (t.kind !== 'item') return;
      const item = g.inventory.get(t.uid);
      const room = circletWithRoom(g.inventory.items);
      const circlet = room ? g.inventory.get(room.uid) : undefined;
      const gem = item ? gemOf(item) : undefined;
      if (!item || !circlet || !gem) return;
      if (!g.sureCheck('set_in_circlet', 'jewellery', CIRCLET_SET, g.toolQl('file'), g.mindEase())) {
        g.missed();
        g.logMsg(`Setting failed: ${gem.name.toLowerCase()} kept.`, 'event');
        return;
      }
      if (!g.inventory.remove(item.uid, 1)) return;
      circlet.extra = [...stonesOf(circlet).map((s) => s.name), gem.name].join(', ');
      g.events.emit('inventory');
      g.logMsg(`Set: ${gem.name.toLowerCase()}. Circlet `
        + `${stonesOf(circlet).length}/${CIRCLET_STONES} settings.`, 'event');
    },
  },
  {
    /*
     * An Artisan's Glaze: ashes worked into a slip and brushed over a fired
     * pot, bowl or jar, or an amphora, which never decays after, wherever it
     * is left (`glaze`, nought). Only an Artisan who has learned it.
     */
    id: 'glaze_item',
    label: 'Glaze',
    verb: 'glazing',
    skill: 'pottery',
    stamina: 0.02,
    baseTime: 6,
    applies: (t, g) => {
      if (t.kind !== 'item') return false;
      const item = g.inventory.get(t.uid);
      return !!item && GLAZEABLE.has(item.id) && item.mark?.glaze === undefined;
    },
    check: (t, g) => {
      if (t.kind !== 'item') return null;
      if (g.perk('glaze_item', 0) <= 0) return GLAZE_PERK;
      const item = g.inventory.get(t.uid);
      if (!item) return 'It is gone.';
      if (!GLAZEABLE.has(item.id)) return 'Fired pot, bowl, jar or amphora only.';
      if (item.mark?.glaze !== undefined) return 'Already glazed.';
      if (g.inventory.count('ash') < GLAZE_ASH) return `Need ${GLAZE_ASH} ash.`;
      return null;
    },
    perform: (t, g) => {
      if (t.kind !== 'item') return;
      const item = g.inventory.get(t.uid);
      if (!item || !GLAZEABLE.has(item.id) || item.mark?.glaze !== undefined || g.perk('glaze_item', 0) <= 0) return;
      if (!g.inventory.consume('ash', GLAZE_ASH)) return;
      item.mark = { ...(item.mark ?? {}), glaze: 0 };
      g.events.emit('inventory');
      g.logMsg(`Glazed: ${itemName(item).toLowerCase()}. No decay.`, 'event');
    },
  },
  {
    id: 'drink_skin',
    label: 'Drink',
    verb: 'drinking',
    stamina: 0,
    baseTime: 1.5,
    applies: (t, g) => {
      if (t.kind !== 'item') return false;
      const item = g.inventory.held(t.uid);
      return !!item && !!itemDef(item.id).charges && !!itemDef(item.id).drink;
    },
    check: (t, g) => {
      if (t.kind !== 'item') return null;
      const item = g.inventory.held(t.uid);
      return item && litresOf(item) > 0 ? null : 'It is empty.';
    },
    perform: (t, g) => {
      if (t.kind !== 'item') return;
      const item = g.inventory.held(t.uid);
      if (!item || litresOf(item) <= 0) return;
      // A litre a drink; a bucket drunk dry is an empty bucket.
      const id = item.id;
      const ql = item.ql;
      const knack = markOf(item, 'knack');
      const feed = markOf(item, 'feed');
      if (litresOf(item) - DRINK_LITRES <= 0 && VESSELS[id]) vesselBecomes(g, item, VESSELS[id].empty);
      else item.charges = Math.max(0, litresOf(item) - DRINK_LITRES);
      g.player.stats.thirst = Math.min(1, g.player.stats.thirst + (itemDef(id).drink ?? 0));
      g.inventory.onChange?.();
      // Milk and anything brewed favour a trade the way a cooked dish does,
      // and for longer for its brewer's hand in it (a Cook's Strong Brew).
      const favour = g.grantBoon(id, ql, knack);
      const full = g.nourish(id, ql, feed);
      g.logMsg(`Drank: ${itemDef(id).name.toLowerCase()}.${favour ? ` ${favour}` : ''}${full ? ` ${full}` : ''}`, 'event');
    },
  },
  {
    id: 'fill_bucket',
    label: 'Fill with water',
    verb: 'filling the bucket',
    stamina: 0.01,
    baseTime: 2,
    // An empty bucket, or a bucket of dye with room in it, which tops up from dye and nothing else.
    applies: (t, g) => {
      if (t.kind !== 'item') return false;
      const it = g.inventory.held(t.uid);
      return it?.id === 'bucket' || (!!it && it.id === DYE_BUCKET && (dyeIn(it)?.litres ?? 0) < BUCKET_LITRES);
    },
    labelFor: (t, g) => {
      const it = t.kind === 'item' ? g.inventory.held(t.uid) : undefined;
      if (it?.id === DYE_BUCKET) return 'Fill with dye';
      const source = sourceFor(g);
      return source ? `Fill with ${LIQUID_NAME[source.liquid]}` : 'Fill with water';
    },
    check: (t, g) => {
      if (t.kind !== 'item') return null;
      const it = g.inventory.held(t.uid);
      if (it?.id === DYE_BUCKET) {
        const src = dyeSourceFor(g, it);
        return 'refusal' in src ? src.refusal : null;
      }
      if (it?.id !== 'bucket') return 'Not an empty bucket.';
      return sourceFor(g) ? null : 'Need water: shore, well, or a barrel with liquid.';
    },
    perform: (t, g) => {
      if (t.kind !== 'item') return;
      const item = g.inventory.held(t.uid);
      if (!item) return;
      if (item.id === DYE_BUCKET) {
        const src = dyeSourceFor(g, item);
        if ('refusal' in src) return;
        drewDye(g, src.from, drawDye(g, src.from, item));
        return;
      }
      if (item.id !== 'bucket') return;
      const source = sourceFor(g);
      // Dye says what is in the bucket after: its colour, hex, QL and mix.
      if (source?.liquid === 'dye' && source.from) {
        drewDye(g, source.from, drawDye(g, source.from, item));
        return;
      }
      const got = fillFromSource(g, item);
      if (!got) return;
      g.logMsg(source?.from ? `Filled: bucket of ${LIQUID_NAME[got]}, from the ${itemDef(source.from.kind).name.toLowerCase()}.` : 'Filled: bucket of water.', 'event');
    },
  },
  {
    id: 'empty_bucket',
    label: 'Empty bucket',
    verb: 'emptying the bucket',
    instant: true,
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => {
      if (t.kind !== 'item') return false;
      const id = g.inventory.held(t.uid)?.id;
      return id === 'water_bucket' || id === 'lye_bucket' || id === DYE_BUCKET || id === WHEY_BUCKET;
    },
    perform: (t, g) => {
      if (t.kind !== 'item') return;
      const item = g.inventory.held(t.uid);
      if (!item) return;
      const was = itemDef(item.id).name.toLowerCase();
      if (!vesselBecomes(g, item, 'bucket')) return;
      g.logMsg(`Emptied: ${was}.`, 'event');
    },
  },
  {
    id: 'fill_skin',
    label: 'Fill with water',
    verb: 'filling',
    stamina: 0,
    baseTime: 2,
    applies: (t, g) => {
      if (t.kind !== 'item') return false;
      const item = g.inventory.held(t.uid);
      // A skin, or a bucket of water with room in it: nothing else is topped up with water.
      return !!item && WATER_HOLDERS.has(item.id);
    },
    check: (t, g) => {
      if (t.kind !== 'item') return null;
      const item = g.inventory.held(t.uid);
      if (item && litresOf(item) >= (itemDef(item.id).charges ?? 0)) return 'Already full.';
      return waterNear(g) ? null : 'Need water: shore, well, or a barrel of water.';
    },
    perform: (t, g) => {
      if (t.kind !== 'item') return;
      const item = g.inventory.held(t.uid);
      if (!item) return;
      item.charges = itemDef(item.id).charges ?? 0;
      g.inventory.onChange?.();
      g.logMsg(`Filled: ${itemDef(item.id).name.toLowerCase()}, ${litresOf(item)} L water.`, 'event');
    },
  },
  {
    id: 'pick_up_all',
    label: 'Pick up all here',
    verb: 'gathering up',
    stamina: 0.02,
    baseTime: 2,
    applies: (t, g) => t.kind === 'ground' || (t.kind === 'tile' && g.sweepable(t.x, t.y, sweepFloor(g, t)) > 0),
    check: (t, g) => {
      const x = t.kind === 'ground' || t.kind === 'tile' ? t.x : g.player.tileX;
      const y = t.kind === 'ground' || t.kind === 'tile' ? t.y : g.player.tileY;
      return g.sweepable(x, y, sweepFloor(g, t)) ? null : 'Nothing here to pick up.';
    },
    perform: (t, g) => {
      const x = t.kind === 'ground' || t.kind === 'tile' ? t.x : g.player.tileX;
      const y = t.kind === 'ground' || t.kind === 'tile' ? t.y : g.player.tileY;
      const got = g.sweep(x, y, sweepFloor(g, t));
      if (!got.length) {
        g.logMsg('Nothing here to pick up.', 'error');
        return;
      }
      const counts = new Map<string, number>();
      for (const it of got) counts.set(itemDef(it.id).name.toLowerCase(), (counts.get(itemDef(it.id).name.toLowerCase()) ?? 0) + it.count);
      const what = [...counts.entries()].map(([n, c]) => (c > 1 ? `${c} × ${n}` : n)).join(', ');
      g.logMsg(`Picked up: ${what}.`, 'event');
    },
  },
  {
    id: 'lock_item',
    label: 'Lock (keep back)',
    verb: 'setting it aside',
    instant: true,
    stamina: 0,
    baseTime: 0,
    /*
     * Only what is loose in your hands. This asked whether the thing was
     * *not* locked, which is also true of a thing that is not there at all —
     * so the entry turned up on anything in a crate or a bag and then did
     * nothing, and on an island fetched back "It is gone." Putting a thing by
     * is about keeping a craft from spending it, and a craft only spends what
     * is loose, so a stowed thing is already safe.
     */
    applies: (t, g) => {
      if (t.kind !== 'item') return false;
      const item = g.inventory.get(t.uid);
      return !!item && !item.locked;
    },
    perform: (t, g) => {
      if (t.kind !== 'item') return;
      const item = g.inventory.get(t.uid);
      if (!item) return;
      item.locked = true;
      g.logMsg(`Locked: ${itemName(item).toLowerCase()}. Not spent, dropped or fed until unlocked.`, 'info');
      g.events.emit('inventory');
    },
  },
  {
    id: 'unlock_item',
    label: 'Unlock',
    verb: 'putting it back',
    instant: true,
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => t.kind === 'item' && !!g.inventory.get(t.uid)?.locked,
    perform: (t, g) => {
      if (t.kind !== 'item') return;
      const item = g.inventory.get(t.uid);
      if (!item) return;
      delete item.locked;
      g.logMsg(`Unlocked: ${itemName(item).toLowerCase()}.`, 'info');
      g.events.emit('inventory');
    },
  },
  {
    id: 'drop',
    label: 'Drop',
    verb: 'dropping',
    instant: true,
    quantity: true,
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => {
      if (t.kind !== 'item') return false;
      const item = g.inventory.get(t.uid);
      return !!item && !item.locked;
    },
    check: (_t, g) => dropRefusal(g),
    perform: (t, g) => {
      if (t.kind !== 'item') return;
      const item = g.inventory.take(t.uid, t.count ?? 1);
      if (!item) return;
      // Fish set down by a Fisher with Cool Pack rots slower where it lies (`cool:food` covers all food, and no perk grants it now).
      const cool = (itemDef(item.id).category === 'food' ? g.perk('cool:food', 1) : 1) * g.perk(`cool:${item.id}`, 1);
      if (cool !== 1) item.cool = cool;
      else delete item.cool;
      // Down in a cellar, onto its floor, where things keep longest (`CELLAR_DECAY`).
      const floor = floorOf(g.player.level);
      g.dropOnGround(g.player.tileX, g.player.tileY, item, floor);
      const what = item.count > 1 ? `${item.count} × ${itemName(item).toLowerCase()}` : itemName(item).toLowerCase();
      g.logMsg(`Dropped: ${what}, on the ${floor < 0 ? 'cellar floor' : 'ground'}.`, 'event');
    },
  },
  {
    id: 'pick_up',
    label: 'Pick up',
    verb: 'picking up',
    stamina: 0.01,
    baseTime: 1,
    applies: (t) => t.kind === 'ground',
    check: (t, g) => (t.kind === 'ground' && g.groundAt(t.x, t.y, t.down ? CELLAR_LEVEL : 0).length ? null : 'Nothing there.'),
    perform: (t, g) => {
      if (t.kind !== 'ground') return;
      const taken = g.takeFromGround(t.x, t.y, t.uid, t.down ? CELLAR_LEVEL : 0);
      if (!taken.length) return;
      for (const item of taken) g.inventory.addItem(item);
      const names = taken.map((it) => (it.count > 1 ? `${it.count} × ${itemName(it).toLowerCase()}` : itemName(it).toLowerCase()));
      g.logMsg(`Picked up: ${names.join(', ')}.`, 'event');
    },
  },
  {
    id: 'found_settlement',
    asks: {
      question: 'Settlement name:',
      fallback: () => 'Homestead',
      declined: 'Settlement not founded.',
    },
    label: 'Found settlement here',
    verb: 'founding a settlement',
    stamina: 0.05,
    baseTime: 4,
    /*
     * On the tile, as well as on the stake.
     *
     * Reported as "still unable to place a deed stake", and it was not a
     * refusal at all: "there's no menu option at all, grey or otherwise". The
     * entry was only ever offered on the tile you are standing on — which is
     * right about where the token goes, and is the one tile on a phone that a
     * thumb cannot hit, because your own body is drawn over it.
     *
     * `range: 0` means the tile you are standing on, and `requestAction`
     * already knows how to walk somewhere before it acts. So the offer can be
     * made anywhere: pick a spot, your feet take you there, and the token goes
     * in where you end up — which is what the island was always going to do,
     * since it founds at the player's position and takes the stake out of the
     * pack without looking at what was clicked.
     */
    range: 0,
    applies: (t, g) => (t.kind === 'item' && g.inventory.get(t.uid)?.id === 'deed_stake')
      || (t.kind === 'tile' && g.inventory.items.some((it) => it.id === 'deed_stake')),
    check: (t, g) => {
      // The spot the token would go in: the tile picked, or the one underfoot
      // when the stake itself was the thing clicked.
      const x = t.kind === 'tile' ? t.x : g.player.tileX;
      const y = t.kind === 'tile' ? t.y : g.player.tileY;
      /*
       * Somebody else's border, which used to arrive as `g.deed` because an
       * island held one settlement and everybody was handed it. It is a
       * neighbour now, and the refusal can say whose.
       */
      const near = g.deedAt(x, y);
      if (near) {
        return `${near.name}${near.holder ? `, which is ${near.holder}'s,` : ''} already reaches there. Found yours further out.`;
      }
      /*
       * Only a settlement you founded stands in the way, which is the island's
       * rule (`deed_refusal` asks `founded_by`). On an island `g.deed` is the
       * first of yours, and with none of your own it is one you were asked
       * onto -- so this refused a citizen of somebody else's settlement as if
       * it were their own. Reported: "i disbanded my settlement so i could
       * make a new one but it's still telling me i can't because i already
       * have a deed ... i think it must be because i'm a citizen of
       * oceanport". No rank at all is the solo game, where the deed is yours.
       */
      if (g.deed && isFounder(g.deed)) return 'Already founded a settlement. Disband it first.';
      const w = g.world;
      if (x - DEED_RADIUS < 0 || y - DEED_RADIUS < 0 || x + DEED_RADIUS >= w.w || y + DEED_RADIUS >= w.h) return 'Too close to the map edge.';
      // A poured slab is dry, level ground standing above whatever is under
      // it, which is exactly what a token wants and is sometimes the only
      // such tile on a hillside.
      if (!g.slabAt(x, y)) {
        if (w.hasWater(x, y)) return 'Totem needs dry land.';
        if (!w.isPassable(x, y)) return 'Totem needs a clear tile.';
      }
      return null;
    },
    perform: (t, g) => {
      // The stake is taken out of the pack whichever way the job was asked
      // for: the island does the same, and never looks at what was clicked.
      const stake = t.kind === 'item' ? g.inventory.get(t.uid) : g.inventory.items.find((it) => it.id === 'deed_stake');
      if (!stake || stake.id !== 'deed_stake') return;
      // The name rides in on the target, put there by `requestAction` before
      // any of this — on an island this half runs over there, where there is
      // nobody to ask.
      const name = (t as { name?: string }).name ?? '';
      if (!name.trim()) return;
      if (!g.inventory.remove(stake.uid, 1)) return;
      g.deed = { name: name.trim().slice(0, 32), x: g.player.tileX, y: g.player.tileY, radius: DEED_RADIUS, level: 1 };
      g.placeDeedCrate();
      g.logMsg(`Founded: ${g.deed.name}. Build area: ${DEED_RADIUS * 2 + 1}×${DEED_RADIUS * 2 + 1} tiles round the totem. Settlement crate placed beside it.`, 'system');
      g.events.emit('world', g.deed.x, g.deed.y);
    },
  },
  {
    id: 'rename_deed',
    asks: {
      question: 'New settlement name:',
      fallback: (_t, g) => g.deed?.name ?? '',
    },
    label: 'Rename settlement',
    verb: 'renaming',
    instant: true,
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => t.kind === 'tile' && g.isMyToken(t.x, t.y),
    // Its founder's, and a rank's its founder let rename it: the island's `settlement_refusal`.
    check: (t, g) => {
      const d = deedAimed(g, t);
      return d ? lacks(d, 'rename') : 'No settlement.';
    },
    perform: (t, g) => {
      const d = deedAimed(g, t);
      if (!d) return;
      const name = ((t as { name?: string }).name ?? '').trim();
      if (!name) return;
      d.name = name.slice(0, 32);
      g.logMsg(`Settlement renamed: ${d.name}.`, 'system');
    },
  },
  {
    id: 'disband_deed',
    confirms: (_t, g) => (g.deed
      ? `Disband ${g.deed.name}? Buildings and crates stay; no new building there; items outside rot at full speed; its wildermon go wild.`
      : null),
    label: 'Disband settlement',
    verb: 'disbanding',
    instant: true,
    stamina: 0,
    baseTime: 0,
    applies: (t, g) => t.kind === 'tile' && g.isMyToken(t.x, t.y),
    /*
     * Its founder's alone, and no rank may be given it: disbanding frees the
     * founder's wildermon and tips out the founder's deed crate, which are
     * theirs and not the settlement's. The island's `settlement_refusal`.
     */
    check: (t, g) => {
      const d = deedAimed(g, t);
      if (!d) return 'No settlement.';
      return isFounder(d) ? null : disbandSaid(d.name);
    },
    perform: (_t, g) => {
      if (!g.deed) return;
      const name = g.deed.name;
      let freed = 0;
      // The settlement's workers go with it. One in a wildermon crate is in
      // your crate, not the settlement's, and stays yours.
      for (const c of g.creatures.list.values()) {
        if (c.mode === 'deed') {
          // Every load of a trip in its arms, not only the last.
          for (const it of takeArms(c)) g.dropOnGround(Math.floor(c.x), Math.floor(c.y), it);
          c.mode = 'wild';
          c.name = SPECIES[c.species]?.name ?? c.name;
          freed++;
        }
      }
      // The settlement's own crate goes with the settlement. It used to be
      // quietly demoted to an ordinary crate and left standing, so founding
      // again put a second one beside the new token and the old one sat there
      // for good. Whatever was in it is tipped out where it stood rather than
      // vanishing with it.
      const crate = g.deedCrate();
      let tipped = 0;
      if (crate) {
        for (const it of [...crate.items]) {
          g.dropOnGround(crate.x, crate.y, it);
          tipped += 1;
        }
        crate.items.length = 0;
        g.removeCrate(crate.id);
      }
      for (const c of g.crates.values()) c.deed = false;
      g.deed = null;
      g.inventory.add('deed_stake', { ql: 50 });
      const spilt = tipped ? ' Settlement crate removed; its contents dropped where it stood.' : ' Settlement crate removed.';
      g.logMsg(`Disbanded: ${name}. ${itemDef('deed_stake').name} to pack.${crate ? spilt : ''}${freed ? ` Wildermon gone wild: ${freed}.` : ''}`, 'system');
    },
  },
  {
    id: 'cut_grass',
    label: 'Cut grass',
    verb: 'cutting grass',
    skill: 'foraging',
    stamina: 0.02,
    baseTime: 3,
    applies: (t, g) => CUT_GRASS.has(tile(t, g)),
    check: (t, g) => (t.kind === 'tile' && g.isForaged(t.x, t.y, 'grass') ? 'Grass too short. Try later.' : null),
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      g.markForaged(t.x, t.y, 'grass');
      // More to a cut for a Naturalist's Hay Cutter.
      const cut = g.perk('count:mixed_grass', GRASS_PER_CUT);
      g.gather('mixed_grass', { count: cut, ql: g.productQl('foraging') });
      // Grass kept cut on a deed becomes lawn: the tile counts the days.
      const w = g.world;
      if (w.getTile(t.x, t.y) === TileType.Grass && g.onDeed(t.x, t.y)) {
        const days = mownDays(w.getData(t.x, t.y));
        w.setTile(t.x, t.y, TileType.Grass, days | MOWN_TODAY);
        const left = LAWN_AFTER - days - 1;
        g.logMsg(`Cut: ${cut} mixed grass.${left > 0 ? ` Lawn in ${left} more day${left === 1 ? '' : 's'} if kept cut.` : ' Lawn tomorrow if kept cut.'}`, 'event');
        return;
      }
      g.logMsg(`Cut: ${cut} mixed grass.`, 'event');
    },
  },
  {
    // A moss tile is cut as grass is and gives moss, the tile staying moss;
    // cut, it is short until it has grown back like grass. The island's
    // `ground_refusal` and `perform_ground`.
    id: 'cut_moss',
    label: 'Cut moss',
    verb: 'cutting moss',
    skill: 'foraging',
    stamina: 0.02,
    baseTime: 3,
    applies: (t, g) => tile(t, g) === TileType.Moss,
    check: (t, g) => (t.kind === 'tile' && g.isForaged(t.x, t.y, 'moss') ? 'Moss too short. Try later.' : null),
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      g.markForaged(t.x, t.y, 'moss');
      g.gather('moss', { count: MOSS_PER_CUT, ql: g.productQl('foraging') });
      g.logMsg(`Cut: ${MOSS_PER_CUT} moss.`, 'event');
    },
  },
  {
    id: 'cut_reeds',
    label: 'Cut reeds',
    verb: 'cutting reeds',
    skill: 'foraging',
    tool: 'carving_knife',
    stamina: 0.03,
    baseTime: 4,
    applies: (t, g) => tile(t, g) === TileType.Reed,
    check: (t, g) => {
      if (!g.inventory.has('carving_knife')) return 'Need a carving knife.';
      return t.kind === 'tile' && g.isForaged(t.x, t.y, 'reed') ? 'Reeds already cut. Try later.' : null;
    },
    perform: (t, g) => {
      if (t.kind !== 'tile') return;
      g.markForaged(t.x, t.y, 'reed');
      // Never fewer than a Naturalist's Reed Cutter says, whatever the roll.
      const count = Math.max(g.perk('count:reed', 0), REED_CUT + (g.rand() < g.skills.get('foraging') / REED_EXTRA_AT ? 1 : 0));
      g.gather('reed', { count, ql: g.productQl('foraging', g.toolQl('carving_knife')) });
      g.logMsg(`Cut: ${count} reeds.`, 'event');
    },
  },
  ...BUILD_ACTIONS,
  ...CELLAR_ACTIONS,
  ...FRAME_ACTIONS,
  ...CREATURE_ACTIONS,
  ...CREATURE_CRATE_ACTIONS,
  ...HUSBANDRY_ACTIONS,
  ...DYE_ACTIONS,
  ...TRAP_ACTIONS,
  ...NAMING_ACTIONS,
  ...LANTERN_ACTIONS,
  ...LAMP_ACTIONS,
  ...COUNTER_ACTIONS,
  ...BRIDGE_ACTIONS,
  ...AQUEDUCT_ACTIONS,
  ...SPRING_ACTIONS,
  ...FLOWER_ACTIONS,
  ...MOTE_ACTIONS,
  ...TELESTONE_ACTIONS,
  ...WATER_GARDEN_ACTIONS,
  ...FOUNDATION_ACTIONS,
  ...STEPS_ACTIONS,
  ...FAITH_ACTIONS,
  ...BAUBLE_ACTIONS,
  // A memorial stone's line, cut and read (`memorial.ts`).
  ...MEMORIAL_ACTIONS,
  // A trellis's vine, and a cutting off a wild one (`vineyard.ts`).
  ...VINEYARD_ACTIONS,
  // A skep's honey, taken and looked at (`bees.ts`).
  ...BEE_ACTIONS,
  ...SACRIFICE_ACTIONS,
  ...ENCHANT_ACTIONS,
  ...MEDITATION_ACTIONS,
  // Reading a trail back to the nearest wild one of a kind, from the field guide (`tracking.ts`).
  ...TRACK_ACTIONS,
  ...ARCHAEOLOGY_ACTIONS,
  ...TREASURE_ACTIONS,
  // Drawing, studying and copying a map (`cartography.ts`).
  ...CHART_ACTIONS,
  ...SIGN_ACTIONS,
  ...FIRST_AID_ACTIONS,
  ...REMEDY_ACTIONS,
  ...PLACEABLE_ACTIONS,
  ...CRATE_ACTIONS,
  ...LOCK_ACTIONS,
  // Raising and lowering a portcullis and a drawbridge (`gates.ts`).
  ...GATE_ACTIONS,
  ...RECIPE_ACTIONS,
  ...BUTCHER_ACTIONS,
  ...CAMPFIRE_ACTIONS,
  ...SMELTER_ACTIONS,
  ...KILN_ACTIONS,
  ...FURNITURE_ACTIONS,
  ...GEAR_ACTIONS,
  ...IMPROVE_ACTIONS,
  ...ANVIL_ACTIONS,
  ...POST_ACTIONS,
  ...FISHING_ACTIONS,
  ...BREWING_ACTIONS,
  ...DEED_ACTIONS,
  ...FARM_ACTIONS,
  ...GREEN_ACTIONS,
  {
    id: 'drop_dirt_here',
    label: 'Change tile',
    verb: 'changing tile',
    skill: 'digging',
    stamina: 0.02,
    baseTime: 2,
    applies: (t, g) => t.kind === 'item' && (g.inventory.get(t.uid)?.id ?? '') in SPOIL_TILE,
    check: (t, g) => {
      if (t.kind === 'item' && !((g.inventory.get(t.uid)?.id ?? '') in SPOIL_TILE)) return 'Need dirt, clay or sand.';
      const c = g.nearestCornerToPlayer();
      // Not a corner of a building: standing on a deck on piers, the ground under it (`piers.ts`), as `drop_dirt` has it.
      return cornerUnderBuilding(g, c.cx, c.cy) ?? slopeRefusal(g, 'digging', c.cx, c.cy, 1);
    },
    perform: (t, g) => {
      if (t.kind !== 'item') return;
      const spoil = g.inventory.get(t.uid)?.id ?? '';
      if (!(spoil in SPOIL_TILE) || !g.inventory.remove(t.uid, 1)) return;
      const c = g.nearestCornerToPlayer();
      const w = g.world;
      w.setHeight(c.cx, c.cy, w.getHeight(c.cx, c.cy) + 1);
      // The soil as well as the height, which the island has always written
      // here and this side never did: a spadeful is a spadeful of something.
      w.setDirt(c.cx, c.cy, w.getDirt(c.cx, c.cy) + 1);
      g.exposeRock(c.cx, c.cy);
      // And the ground it covered, which is the tile under your feet — the
      // corner it raises belongs to as many as four of them.
      const [fx, fy] = [g.player.tileX, g.player.tileY];
      if (BURYABLE.has(w.getTile(fx, fy))) w.setTile(fx, fy, SPOIL_TILE[spoil]);
      g.logMsg(`Dropped: ${itemDef(spoil).name.toLowerCase()} at your feet, corner raised.`, 'event');
    },
  },
];

/**
 * The jobs that change the shape or the surface of the ground, and so the ones
 * a settlement's border speaks for. Wrapped once here rather than written into
 * fourteen doors, so there is one rule and one wording, and every place that
 * asks a door — the menu, the belt, a job coming off the queue — is covered by
 * having asked it.
 */
const SHAPES_GROUND = new Set(['dig', 'dredge', 'flatten', 'drop_dirt', 'drop_dirt_here', 'raise_rock',
  'mine', 'chip_corner', 'pack', 'cultivate', 'pave_cobble', 'pave_slabs', 'remove_paving',
  'dig_spring', 'stop_spring', 'dig_pool', 'fill_pool',
  'lay_steps', 'lay_timber_steps', 'take_up_steps', 'plant_moss', 'plant_grass',
  // Stepping stones laid and taken up, and a water lily or a lotus planted or pulled up.
  'lay_stones', 'lift_stones', 'plant_lily', 'plant_lotus', 'pull_water_plant']);
for (const def of ACTIONS) {
  if (!SHAPES_GROUND.has(def.id)) continue;
  const was = def.check;
  def.check = (t, g) => foreignGround(g, def, t) ?? was?.(t, g) ?? null;
}
/*
 * And a Runestone's nine tiles, which no job that changes the ground or puts
 * something on it will touch (`runestones.ts`): asked before anything else,
 * so it is the stone that is named rather than whatever the ground under it
 * would have said. The island asks the same in `stone_ground_refusal`.
 */
for (const def of ACTIONS) {
  if (!STONE_GUARDED.has(def.id)) continue;
  const was = def.check;
  def.check = (t, g) => stoneGroundRefusal(g, def, t) ?? was?.(t, g) ?? null;
}

export const ACTION_BY_ID = new Map(ACTIONS.map((a) => [a.id, a]));
knowJobs(() => ACTIONS);
