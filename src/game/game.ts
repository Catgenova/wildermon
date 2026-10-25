import { Springs, type SpringSave } from './springs';
import { DAMAGE_MAX, PLACED_REACH, QL_TOP, wearPerUse, wornShare } from './limits';
import { generateWorld } from '../world/generate';
import { EMOTES, EMOTE_BY_ID } from './emotes';
import { deedMay, lacks, type DeedRole } from './ranks';
import { boundKey } from './keybinds';
import { capital, listed, percent } from './words';
import { brazierBurn, shoreNear } from './placeables';
import { dyeChoice, dyeEnough, pickDyeAsks, sourceSays, type DyeSource } from './dyes';
import type { Hoard } from './treasure';
import { packTreeData, TILE_DEFS, TileType, TREE_DEFS, TREE_AGES, TREE_ROOM_ONE, TREE_ROOM_TWO, TREE_SEED_BOTH, TREE_SEED_NONE, TREE_SEED_REACH, TREE_SEEDS, lastDawn, treeAge, treeSpecies, treeVariant, LAWN_AFTER, mownDays, mownToday, FLOWERS_PICKED, WEAR_FALL, WEAR_MOST, WEAR_TRAIL, trailGround, wears } from '../world/tiles';
import { yearOf } from '../world/calendar';
import { oreAt } from '../world/ore';
import { World } from '../world/world';
import { ACTIONS, ACTION_BY_ID, SPOIL_ORDER, spoilFrom, TEACHES_NOTHING, TRY_LEARN, type ActionDef, type Target } from './actions';
import { feedable, feedFill, riposte } from './creatureActions';
import { aimPin, BELT_MAX, loopsFor, pinLabel, type BeltPin } from './belt';
import { bodyForward } from '../net/felt';
import type { ItemRow } from '../net/island';
import { packed, type Aged } from '../net/packed';
import { DROWN_RATE, DROWN_WARN, EXHAUSTED, HEAL_FED, HEAL_RATE, HUNGER_RATE, staminaBarAbove, SWIM_LEARN, SWIM_WIND, THIRST_RATE, WIND_PER_LEVEL, WIND_REST, WIND_STARVING, WIND_WALK } from './body';
import { markName, MARK_CAP, MARK_COLOURS, type Marker } from './marks';
import { acrossSide, Buildings, OPPOSITE_SIDE, type FloorTile, CELLAR_DECAY, CELLAR_FLOOR, CELLAR_LEVEL, connectsDown, floorKind, floorOf, INDOORS_DECAY, isDone, isSpiral, SPIRAL_FOOT_SAID, progressOf, roofShapeDef, TOP_LEVELS, WALL_HEIGHT, walkableKind, workLevel, type BuildingsJSON, type Building, type Wall, type Side, type Bill, type Column } from './building';
import { CELLAR_DAYLIGHT, cellarGate, cellarPieceOk, targetFloor } from './cellar';
import { jettyBase } from './frame';
import { CRATE_DEFS, crateCentre, crateName, crateCapacity, crateUnits, STORE_REACH, SUBTILES, subtileOf, type CrateKind, type PlacedCrate } from './crates';
import { anvilAnchor, anvilCentre, anvilCovers, anvilName, ANVIL_SUBTILES, type PlacedAnvil } from './anvil';
import { fireAnchor, fireCentre, fireCovers, FIRE_SUBTILES, type PlacedCampfire } from './campfire';
import { smelterAnchor, smelterCentre, smelterCovers, smelterName, SMELTER_H, SMELTER_PLUME, SMELTER_PLUME_WORKING, SMELTER_STACK_BACK, SMELTER_STACK_UP, SMELTER_W, type PlacedSmelter, type Plume, type SmeltJob } from './smelter';
import { kilnAnchor, kilnCentre, kilnCovers, kilnName, KILN_GLOW, KILN_GLOW_FIRING, KILN_PLUME, KILN_PLUME_FIRING, KILN_SUBTILES, KILN_VENT_BACK, KILN_VENT_UP, type PlacedKiln } from './kiln';
import { WELL_TRICKLE, WELL_TRICKLE_AT, WELL_TRICKLE_QL, ACROSS_OF, DEED_PLACE, FURNITURE, ONE_ALTAR, deckSpot, isPlanter, furnitureAnchor, furnitureCapacity, furnitureCentre, furnitureCovers, furnitureDef, furnitureHeft, furnitureHolds, furnitureKg, furnitureRefuses, furnitureRoom, furnitureUnits, hiveRoom, POND_EVERY, rackDeck, rackSpots, teamOf, vehicleOf, type LiquidKind, type PlacedFurniture, furnitureName, facingOf, LIQUID_NAME, isBoat, furnitureFootprint, holdsLiquid, STATION_REACH, type BoatDef, pieceShut } from './furniture';
import { hiveTakes } from './bees';
import { crateTheRest, emptyCrate, occupiedRefusal, shutIn, teamOut, teamOutRefusal } from './creaturecrate';
import { bury, crumble, graveAt, graveRefusal, graveSays, GRAVE_MARK } from './graves';
import { cropStageSeconds, RIPE, settleCrop, type Crop } from './farming';
import { fieldClock, fieldRate, GLASSHOUSE_GROWTH, handClock, handRate, PLANTER_GROWTH } from './growth';
import { glassResync, underGlass } from './glasshouse';
import { ageDef, stageOf, bridleTeam, harnessTeam, tameNeeds, attackOf, bloodMul, BLOW_SHARE, markOn, CALL_WINDOW, Creatures, setLocalKept, FIGHT_BACK_GOES, footing, HAUL_SKILL, haulLearn, MAX_MOUNT_SPEED, MOUNT_STAIRS_SAID, isBaitFor, tracesSkill, isShod, maxHealth, PLAYER_ATTACKER, PULL_DEFAULT, SHOE_PACE, SHOE_STEP, tackSpeed, type Creature, type CreatureJSON, type Stance } from './creatures';
import { CRAFT_REACH, knackable, type CraftStock, type Station } from './recipes';
import { Actor, type ActiveAction, type GuestSave } from './actor';
import { HOST_ID, type PeerId } from '../net/protocol';
import { Roster } from './roster';
import { runeGateLights } from './runegate';
import { GameEmitter, isTalk, TALK_LOG, type LogEntry, type LogKind } from './events';
import { bagTake, DEED_DECAY, describeWith, foldInto, groundDecayRate, Inventory, ITEM_DEFS, itemName, type Item, markOf, type Mark, rarityOf, rarityStep, itemDef, sameMark, sameStack, spendOut, unrestored } from './items';
import { ENCHANTERS_PLINTH, ENCHANTMENTS, furnaceBurn, moreSaid, NETMENDER_WEAR, swingEnchant, wornEnchant, type Enchant, type EnchantEffect } from './enchant';
import { BASE_SPEED, CARRY_CRAWL, CLIMB_LEARN, CLIMB_LEARN_FROM, CLIMB_LEARN_STEEP, CLIMB_PER_LEVEL, groundStep, MAX_STAND, MAX_STEP, pathOptions, Player, readPlayer, type LiftRule, standsOn, walkKey, writePlayer, SWIM_DEPTH, SWIM_SPEED } from './player';
import { findPath } from '../world/pathfinding';
import { randomLook, type Look } from './look';
import { ACTION_FLOOR, ACTION_PACE, DAY_SECONDS } from './pace';
import { ARMOUR_BY_ID, ARMOUR_CLASSES, bagCarry, HIT_LOCATIONS, pieceBurden, pieceSoak, SHIELDS, WEAPON_BY_ID, type Slot, SLOTS, type WeaponDef } from './gear';
import { boonOf, boonTime, BOON_BONUS, clockLeft, REST_CAP, REST_MULT, REST_PER_SECOND, TINCTURE_BONUS, TINCTURE_SECONDS, TINCTURE_SKILLS, type Boon } from './boons';
import { cleanSaid } from './chat';
import { cleanText, nameRefusal, NAMES_ASKED } from './playertext';
import { ALL_GOALS } from './journal';
import { journalRulesA } from './journal-a';
import * as creatureRules from './creatures';
import * as guideRules from './guide';
import { FieldGuide, formSeenLine, GUIDE_LOOK, guideEntry, guideMarks, guideName, seenLine, stageKey, type GuideBook, type GuideMark } from './guide';
import { formKey, formsOf } from './wildforms';
import { sightedLine } from './sighted';
import { matOf, rollEase, workingQl } from './materials';
import { postCentre, postDecayRate, postKeep, postName, postRadius, postSite, type PlacedPost } from './posts';
import {
  catchChance, CHECK_EVERY, CREEL_BAIT_LOSS, creelHold, creelOdds, trapCentre, trapDecayRate, trapHolds, trapKeep, trapName, TRAPS, type PlacedTrap,
  type TrapKind,
} from './traps';
import { BAIT_BY_ID, FISH, fishHere, pickFish, waterDepth } from './fishing';
import { across, BRIDGES, sideStep, bridgeDone, deckLane, bridgeLevels, bridgeWheels, CLEARANCE, deckFurnitureRefusal, deckHeight, deckTiles, END_SLOP, endTiles, isMaterialBridge, laneOffsets, pierSpans, pierStoreys, RAMP_SLOPE, rampDeck, rampRefusal, rampRise, fitIntoSpan, openSpan, spanBill, spanTiles, WIDEST, type Bridge, type BridgeKind, type BridgeSpan } from './bridges';
import { AQ_NOT_THROWN, AQ_OVER, channelOf, fitIntoChannel } from './aqueducts';
import { AQUEDUCT_LPS, aqueductShut, type Channel } from '../world/aqueducts';
import { BRIDGE_END_HERE, bridgeEndAt, bridgeEndRefusal, deckDown, hingeKey, hingeOf, isDrawbridge, keepHiddenAsks } from './gates';
import { CLEAR_OF_BUILDINGS, LIFT_PER_MASONRY, concreteFor, foundationBill, foundationDone, liftFor, masonryFor, pourIntoFoundation, soilSays, type Foundation } from './foundations';
import { poolLevel } from '../world/springs';
import { deckOver, floorNear, levelGround, pierDrop, pierGround, pierRefusal, pierSays, type PierGround } from './piers';
import { metres } from '../world/tiles';
import { greenNow, mossyPiece } from './greening';
import { WATER_PLANT_BY_ID, type WaterPlant, type WaterPlantKind } from '../world/waterplants';
import { liveSettings, type Settings } from './settings';
import { considerSays } from './consider';
import { ARMOUR_VS, armsRefusal, blockChance, BLOCKED_SAID, SHIELD_WEAR, BURN_WEAR, CROWD_BLOCK, DODGE_GAIN, dodgeChance, DRAW_WALK, FIGHT_QUIET, VENOM_DRAIN, VENOM_SECS, skillLine, type FightRecord, FIGHT_BACK_STILL, FIGHT_STANCE_NAMES, FLANK_HIT, legPace, FIGHT_TRIES, fightBase, fightWind, armPace, armourSwing, overburdenSwing, swingKgOf, swingBase, swingSeconds, SWING_FLOOR, tiredPace, FOLLOW_RANGE, inFightReach, isFightJob, nextStance, stanceSays, stanceTaken, TARGET_RANGE } from './fight';
import { Skills, SKILL_BY_ID, SKILL_DEFS, isQuiet } from './skills';
import { jewelGain } from './gems';
import { earnedBy, knackBonus, knackChance, knackLands, KNACK_CAP, TITLE_BY_ID } from './titles';
import { TileIndex, Tally, keyX, keyY, tileKey } from './tileindex';
import { DARK_HIT, NIGHT_EYES_FROM, SOUL_PER_LEVEL, WORK_HAND, WORK_WIND, WORK_WIND_SPENT, HEAVY_SKILLS, WORK_BACK } from './learn';
import { DRIVING, DRIVING_LEARN, drivingPace, SAILING, SAILING_LEARN, sailingPace, vehicleQlPace } from './travel';
import { laySwirls, swirlLight, type Swirl } from './motes';
import type { Trail } from './tracking';
import { hasRunestones, runestoneAt, RUNESTONES, stonePoint, stoneTiles } from './runestones';
import { AWARENESS, Vision } from './vision';
import { blessBonus, favourCap, FAITH, FAVOUR_TRICKLE } from './faith';
import {
  bondNone, bondSaid, bondWhole, calmCap, calmRefusal, claritySaid, deepLungsSaid, foreknowSaid, gatherNone, gatherSaid, hardToKillSaid, HERD_NONE, herdSaid,
  lullNone, lullSaid, MEDITATION, PATH_PICK_BY_ID, PATH_PICKS, pathPickRefusal, PATHS, REFRESH_SAID, LAND_GROWS, satSince, SECOND_WIND_SAID, seekNone, seekSaid, SHRUG_NONE,
  SHRUG_SAID, gatherSpot, skySaid, STRUCK_SAID, surgeSaid, TECHNIQUE_GAIN, tookSaid, traceNone, traceSaid, unbrokenSaid, type PathBeat, type PathId, type PathSaid,
} from './meditation';
import { ledgerTotals, record, type Ledger } from './ledger';
import { ALTAR_CAST, ALTAR_CAST_ALPHA, ALTAR_GLOW, ALTAR_REACH, FIRE_REACH, heldReachOf, HELD_LIGHTS, memorialLight, MOTH_LIGHT, OVEN_REACH, plinthLight, runestoneLight, type LightSource } from './light';
import { plinthBusy } from './plinth';
import { MEMORIAL } from './memorial';
import { counterFinished, counterInto, counterMiddle, Counters, type CountersJSON, type CounterWire } from './counters';
import { burnLamps, isLampPiece, lampArmRefusal, lampBurning, lampFrom, lampLight, lampTurnsTo } from './lamps';
import { settleTrellises, trellisShares, trellisTurnsTo, trellisWallRefusal, VINE_SAID } from './vineyard';
import { isRuneLantern, runeLanternLight } from './runelantern';
import { helpingOf, NUTRIENTS, NUTRIENT_DECAY, NUTRIENT_NAMES, TABLE_BEST, tableMul, upkeepMul, type Nutrient } from './nutrition';
import { strokeOf } from '../audio/sound';
import { lockRefusal, type Lockable } from './locks';
import { REACH_FORCE, sailFactor, sailWord, windAt, windFrom, windWord, type Wind } from './wind';
import { festerChance, PART_NAMES, woundClose, woundDrain, WOUND_KINDS, woundText, type Wound, type WoundKind } from './wounds';
import { baubleLearn, baublePace, baublePlus, baublesFrom, baublesServe, baubleTwice, YIELD_TIMES, type DeedBauble, type IslandBauble } from './baubles';
import { orderRefusal, queueDropped, seenOf, type SeenJob } from './jobqueue';
import { layOver, same } from './heldrows';

export type { ActiveAction } from './actor';

/** A settlement: a square of land around a token that the player may build on. */
/** One place on the deed that holds things, whatever it is underneath. */
/** A thing standing on the ground that a scroll can be set into where it stands (`Game.placedFor`). */
export interface PlacedEnchantable {
  thing: { x: number; y: number; ql: number; enchant?: Enchant; dmg?: number };
  /** What it is by the catalogue: the item it was in the pack. */
  def: string;
  name: string;
  /** Its middle, in tiles. */
  at: [number, number];
  lock?: number;
}

/** What a hod carrier works on, in the order it takes them when all else is even. The island's `hod_rank`. */
export const HOD_WORK = ['wall', 'floor', 'column', 'span', 'foundation'] as const;

/** A piece of planned work a hod carrier fits into (`Game.hodNeeding`). */
export type HodTarget =
  | { kind: 'wall'; wall: Wall }
  | { kind: 'floor'; floor: FloorTile }
  | { kind: 'column'; column: Column }
  | { kind: 'span'; bridge: Bridge; span: BridgeSpan }
  | { kind: 'foundation'; foundation: Foundation };

/** The work a hod carrier is to fit a piece into, the piece, and the tile it is worked from. */
export interface HodJob {
  target: HodTarget;
  item: string;
  x: number;
  y: number;
}

export interface DeedStore {
  x: number;
  y: number;
  centre: [number, number];
  items: Item[];
  name: string;
  /** The settlement's own crate, which a worker fills before any other. */
  deed: boolean;
  /**
   * A bin built for exactly this sort of thing, which a worker fills before
   * anything else.
   *
   * It is not asked whether the load is raw. The list has already been through
   * `room`, which is `furnitureRefuses` -- so a store standing in it is one
   * that has agreed to take this thing, and that makes it the store built for
   * it, whichever of the five it is. Ore goes to the raw bin, a morning at the
   * anvil to the craft bin, dinner to the larder and a handful of seed to the
   * seed bin, by one rule rather than five.
   */
  bin: boolean;
  /** Whether this would take the thing being carried. */
  room(item: Item): boolean;
  add(item: Item): boolean;
  /** Tell the windows something in here changed. */
  changed(): void;
}

export interface Deed {
  name: string;
  x: number;
  y: number;
  radius: number;
  /** Upgrades bought so far; level 1 is a freshly founded settlement. */
  level?: number;
  /** Standing orders for every wildermon kept here. */
  stance?: Stance;
  /**
   * Whether this one is yours.
   *
   * On an island somebody else's settlement is a thing you can see and walk
   * around and may not build on — so the browser has to hold it, and has to
   * know the difference. False here means the token in the ground belongs to
   * somebody else; absent means the single-player game, where it is always
   * yours because there is only you.
   */
  mine?: boolean;
  /**
   * What you are here: `founder` for the person who planted the stake, or
   * the name of the rank the founder gave you, in lower case.
   *
   * Absent in the game you play by yourself, where there is one person and
   * they founded everything, so absent reads as `founder` everywhere it is
   * asked. On an island it comes down with the settlement.
   */
  role?: DeedRole;
  /** Your rank's name as its founder wrote it; absent for the founder. */
  rank?: string;
  /**
   * What your rank may do here (`ranks.ts`, `RANK_POWERS`), as bits. Absent
   * for the founder, in the solo game, and from an island from before custom
   * ranks, where `role` alone says (`permsHeld`).
   */
  perms?: number;
  /**
   * What is set into its altar's sockets (`baubles.ts`): the settlement's,
   * whichever altar on it they were set at. Absent or empty when none is.
   */
  baubles?: DeedBauble[];
}

// The ranks live in `ranks.ts`, which imports nothing; see there for why.
export { deedMay, type DeedRole } from './ranks';

/**
 * How far a go's quality is spread when it is not simply your skill: from
 * `QL_LOW` times what it is spread from, up by as much as `QL_SPAN` more --
 * 0.6 to 1.4 times. Bare hands spread your skill (and add one); a tool that
 * misses spreads its own quality, never above your skill. See `productQl`.
 */
export const QL_LOW = 0.6;
export const QL_SPAN = 0.8;
/** And what bare hands add on top of it, so a first go at anything is never nothing. */
export const QL_BARE = 1;

/**
 * The lowest and highest quality `productQl` can give at a skill, with a tool
 * of this quality or none (0), for anything that says so before the go.
 */
export function productQlRange(skill: number, toolQl = 0): [number, number] {
  const s = Math.min(100, Math.max(1, skill));
  if (toolQl <= 0) return [Math.min(100, s * QL_LOW + QL_BARE), Math.min(100, s * (QL_LOW + QL_SPAN) + QL_BARE)];
  return [Math.min(s, Math.max(1, toolQl * QL_LOW)), s];
}

export const DEED_RADIUS = 5;
// A deed stake says how much land it claims: the token and this far each way.
describeWith({ deedAcross: DEED_RADIUS * 2 + 1 });
/** Every upgrade pushes the border out this far and takes on one more worker. */
export const DEED_RADIUS_PER_LEVEL = 2;
export const DEED_WORKERS_AT_LEVEL_ONE = 1;
export const MAX_DEED_LEVEL = 5;
/**
 * How many settlements you may be a citizen of, besides the one you founded.
 *
 * One deed is yours: you planted the stake, you pay for the upgrades, you are
 * the one who can disband it. Beyond that a person can belong to other
 * people's land — help build it, keep things in its crates, work its fields —
 * and three is enough to be a neighbour, a partner and a guest without the
 * word *citizen* ceasing to mean anything.
 */
export const DEEDS_JOINED = 3;

/**
 * How many people have to be about before the island stops saying where
 * everybody is.
 *
 * A list of every body on the island with a position beside it is a radar, and
 * `rpc_social` has said so in a comment since the day it was written: your
 * friends' whereabouts, and everybody else's name and nothing more. That is
 * the right rule for a place with people in it.
 *
 * It is the wrong rule for an empty one. On four thousand tiles with a
 * half-dozen ashore you can play for a week and never learn that anybody else
 * exists, and the thing a new island needs most is for its handful of people
 * to run into each other. So while there are fewer than this many about,
 * everybody is on the map, with their name on them.
 *
 * A headcount rather than a switch, deliberately: a switch is a thing somebody
 * has to remember to turn off, and this turns itself off on the day it stops
 * being true. The Social window says which side of the line the island is on,
 * so the day it changes is a thing people read rather than notice.
 */
export const CROWD_HIDES = 20;

/**
 * Following somebody: how often to think about it, how close is close enough,
 * and how far off is gone.
 *
 * Twice a second rather than every frame, because re-pathing sixty times a
 * second to the same tile is a walk that restarts before it takes a step.
 * Two tiles is close enough to talk and near enough that it reads as
 * following rather than as treading on somebody. And forty is the distance
 * at which they are somebody else's problem — past it a follow is a walk
 * across the island with no arrival, and it should end saying so rather than
 * quietly going on.
 */
export const FOLLOW_EVERY = 0.5;
export const FOLLOW_CLOSE = 2;
export const FOLLOW_LOSE = 40;

/**
 * The counts the journal reads that only a browser can make, because only it
 * moves a hull through the water: a beam reach in a fresh wind, and a hold
 * more than half full under way. Everything else on an island is the island's
 * to count (`Game.tallyFromIsland`).
 */
export const BROWSER_TALLY: ReadonlySet<string> = new Set(['reach', 'laden']);

export const deedLevel = (d: Deed | null): number => Math.max(1, Math.min(MAX_DEED_LEVEL, d?.level ?? 1));
export const deedRadiusAt = (level: number): number => DEED_RADIUS + (level - 1) * DEED_RADIUS_PER_LEVEL;
export const deedWorkersAt = (level: number): number => DEED_WORKERS_AT_LEVEL_ONE + (level - 1);
// The journal's goals of the wildermon and of a settlement read these, handed over now the game is running (`journal-a.ts`).
journalRulesA(creatureRules, guideRules, { most: MAX_DEED_LEVEL, workersAt: deedWorkersAt });

/**
 * UI questions the game needs; main.ts wires them to the interface.
 *
 * Both answer with a promise, because both used to be `window.prompt` and
 * `window.confirm` and neither of those is a dialogue on a phone: Chrome on
 * Android suppresses them in more cases than it documents, and once anybody
 * has dismissed one with "don't let this page create more dialogs" every
 * later call returns null and false, silently, for the rest of the session.
 * What that looks like from the outside is a game that ignores you.
 */
export interface GameHooks {
  /** A line of text, `fallback` offered; `ok` labels the button ("Name it" when absent). Resolves with what was typed, or null. */
  prompt: (question: string, fallback: string, ok?: string) => Promise<string | null>;
  confirm: (question: string) => Promise<boolean>;
  /** Choose one of several: each with a colour to show beside it and what it says. Resolves with the key chosen, or null. */
  choose: (question: string, choices: ReadonlyArray<{ key: string; colour?: string; text: string }>) => Promise<string | null>;
  /** How many, from 1 to `most`, with `fallback` offered: a part of a stack to move. Resolves with the number, or null. */
  count?: (question: string, most: number, fallback: number) => Promise<number | null>;
  /** A line of free text up to `max` characters, the box empty: a report's note. Resolves with what was typed, or null. */
  note?: (question: string, max: number) => Promise<string | null>;
}

export interface GameInit {
  seed: number;
  world: World;
  /** When the woods were last turned over, in real seconds. */
  treesAt?: number;
  /** When greening came in, and when each tile paved since was paved or scrubbed, as [x, y, seconds]. */
  greenFrom?: number;
  pavingSince?: Array<[number, number, number]>;
  spawn: { x: number; y: number };
  deed?: Deed | null;
  buildings?: BuildingsJSON;
  creatures?: { nextId: number; list: CreatureJSON[]; banked?: Array<[number, number]> };
  crates?: PlacedCrate[];
  /** Pre-crate-grid saves kept a single deed crate. */
  crate?: { x: number; y: number; items: Item[] } | null;
  campfires?: PlacedCampfire[];
  smelters?: PlacedSmelter[];
  kilns?: PlacedKiln[];
  furniture?: PlacedFurniture[];
  posts?: PlacedPost[];
  traps?: PlacedTrap[];
  nextTrapId?: number;
  bridges?: Bridge[];
  nextBridgeId?: number;
  /** The springs dug here (`./springs`): where, and by whom. Their water is worked out again from the ground. */
  springs?: SpringSave[];
  foundations?: Foundation[];
  nextFoundationId?: number;
  tally?: Record<string, number>;
  ledger?: Ledger;
  ticked?: string[];
  /** The field guide: the kinds seen, tamed and bred. */
  guide?: GuideBook;
  anvils?: PlacedAnvil[];
  crops?: Crop[];
  /** The crop last sown on each field, as `[x, y, crop]`. */
  sown?: Array<[number, number, string]>;
  /** What grows in planters, each with the id of its planter. */
  planted?: Crop[];
  /** The field clock, in growing seconds (`Game.fieldTime`). */
  fieldTime?: number;
  /** And a Season's Hand's (`Game.handTime`). */
  handTime?: number;
  /** The water lilies and lotus planted here. */
  waterPlants?: WaterPlant[];
  /** The day's mote swirls, and the dawn they were put down for (`motes.ts`). */
  swirls?: Swirl[];
  swirlDawn?: number;
  /** The stores behind the shop counters (`counters.ts`). */
  counters?: CountersJSON;
  marks?: Marker[];
  hoards?: Hoard[];
  player?: { x: number; y: number; name: string; stats: Player['stats']; level?: number; equipped?: Record<string, number | null>; rested?: number; boons?: Boon[]; knacks?: Record<string, number>; nutrition?: Record<Nutrient, number>;
  /** What knacks were called before they were called knacks. */
  affinities?: Record<string, number>; titles?: string[]; title?: string | null; wounds?: Wound[]; nextWound?: number; favour?: number; prayedAt?: number; way?: PathId | null; satAt?: number; usedAt?: Record<string, number>; belt?: Array<BeltPin | null>; look?: Look };
  inventory?: Item[];
  nextUid?: number;
  ground?: Record<string, Item[]>;
  /** What lies on the floors of cellars, the same way: by tile as `"x,y"`. */
  cellarGround?: Record<string, Item[]>;
  skills?: Record<string, number>;
  time?: number;
  /** The island's guest book: everybody who has visited, and what they had. */
  guests?: GuestSave[];
}

/** Actions you can hold in your head before any mind logic is earned. */
export const BASE_QUEUE = 3;
/** Where every characteristic starts, and so what counts as a point gained. */
export const CHAR_START = 20;
/** And one job more for every this much mind logic past it. */
export const QUEUE_PER_MIND = 10;
/**
 * How many jobs a given mind logic will hold, which is the whole of what mind
 * logic is for and the only reason to tell anybody it went up.
 *
 * A function of the number rather than of the player, because the sentence
 * about it is asked twice — what it holds now against what it held before the
 * go — and the second of those is a value nobody has any more.
 */
export const queueCapAt = (mind: number): number => BASE_QUEUE + Math.floor(Math.max(0, mind - CHAR_START) / QUEUE_PER_MIND);
/** Ashes left per second of burning: a log's worth of fire leaves about five. */
export const ASH_RATE = 1 / 120;
/** Damage at which a tool starts warning you, and every `DAMAGE_WARN_STEP` points after. */
export const DAMAGE_WARN = 75;
/** The longest leg of a long walk, in tiles (`travelTo`): well inside what one path is looked for over. */
export const TRAVEL_LEG = 60;
/** Legs in a row that bring you no nearer before a long walk gives up. */
export const TRAVEL_STUCK = 3;
export const DAMAGE_WARN_STEP = 5;
/** Damage a thing goes to pieces at (`limits.ts`). */
export { DAMAGE_MAX };
/** Damage one use puts on a tool of this quality (`limits.ts`). */
export { wearPerUse };
/** No team takes a vehicle faster than this, whatever is in the traces. */
export const MAX_VEHICLE_SPEED = 4;
/** How far ahead of the shafts a hitched team walks. */
const TRACE_LENGTH = 1.6;
/** How fast a mount works its dinner off under a rider. One in the traces does not. */
const HAUL_HUNGER = 0.0006;
/** Steepest ground a green team will take a wheel up, against a walker's limit. */
const VEHICLE_STEP = MAX_STEP / 2;
/** Height units of extra slope every point of a beast's climbing is worth. */
const CLIMB_PITCH = 0.16;
// A mount's pace (`mountSpeed`) is read off these, which its kind's words say (`creatures.ts`).
export { footing, MAX_MOUNT_SPEED } from './creatures';
/** Tiles to a side of a new island. */
export const WORLD_SIZE = 1024;
/**
 * The island the keeper serves: 4096 tiles a side.
 *
 * Sixteen kilometres across and 268 km2, against the one square kilometre a
 * 256-tile island covers. It is affordable because nothing about it travels:
 * the land is a pure function of the seed and every browser works out the
 * ground it is standing on, so what a join costs is the same on a big island
 * as on a small one. `docs/tile-map-cost-analysis.md` is the arithmetic.
 *
 * The single-player island in this browser keeps `WORLD_SIZE`. It is a
 * different thing with a different life — it lives in IndexedDB, it is rolled
 * by `generate.ts` rather than from the survey chart, and making everybody's
 * saved island sixteen times bigger is not a change anybody asked for.
 */
export const ISLAND_SIZE = 4096;
/**
 * A day and a night, in seconds.
 *
 * At the world's pace, which is the most visible thing about slowing that
 * clock: an hour of real time to the day now, and fifteen and a half minutes
 * of dark in it rather than six. It has to move with everything else or the
 * whole point is lost — a crop that took a third of a day to ripen would take
 * most of one, and every "twice a day" thing in the game would quietly become
 * once.
 *
 * It also keeps the lights honest. A torch is twelve and a half minutes
 * against that fifteen-and-a-half-minute night, which is most of one: the
 * night was cut back to a quarter of the cycle and the torch was not.
 */
/**
 * What `groundAt` hands back for a tile with nothing on it.
 *
 * One array, shared, never written to. The renderer asks about every tile it
 * draws and the answer is almost always nothing, so the old `?? []` was a
 * fresh empty array a few hundred thousand times a second.
 */
const NO_ITEMS: readonly Item[] = [];
/**
 * Rows of the island turned over per tick when the woods have a day owing.
 * Sixty-four rows of a four-thousand-wide map is a quarter of a million tiles,
 * which is under a millisecond, and the whole island is done inside a minute
 * of looking at it.
 */
const TREE_STRIP = 64;

export { DAY_SECONDS };
/**
 * When the sun comes up and goes down, in game hours.
 *
 * Three quarters of the cycle is day and the remaining quarter is night:
 * eighteen hours between dawn and dusk, six the other way round, and noon
 * sitting exactly between the two. Six to eight was fourteen hours of sun on
 * paper and — once the two-hour ramps at either end are counted as the dark
 * they are — very nearly half a night in practice, which is a long time to
 * stand about holding a lantern.
 *
 * `darkness` below is written off these two and nothing else, so moving them
 * moves the ramps, the sun's arc, the wash over the sky, what a nocturnal
 * thing comes out for and how long a sleeper skips, all at once.
 */
export const DAWN = 3;
export const DUSK = 21;
/** Game hours either side of sundown and of sunrise that the light takes to go, and to come back. */
export const TWILIGHT = 1;
/** How dark it is at an hour of the day, 0 to 1 (`Game.darkness`). */
export function darknessAt(h: number): number {
  if (h >= DAWN + TWILIGHT && h <= DUSK - TWILIGHT) return 0;
  if (h >= DUSK + TWILIGHT || h <= DAWN - TWILIGHT) return 1;
  const ramp = 2 * TWILIGHT;
  return h > 12 ? Math.min(1, Math.max(0, (h - (DUSK - TWILIGHT)) / ramp)) : Math.min(1, Math.max(0, (DAWN + TWILIGHT - h) / ramp));
}
/** How dark it has to be (`Game.darkness`) for `isNight`: past it, the night's things happen and Runecut's clock light turns to Night. */
export const NIGHT_FROM = 0.45;
/** The game hours, after sundown and before sunrise, at which `darkness` crosses `NIGHT_FROM`. */
export const NIGHT_STARTS = DUSK - TWILIGHT + NIGHT_FROM * 2 * TWILIGHT;
export const NIGHT_ENDS = DAWN + TWILIGHT - NIGHT_FROM * 2 * TWILIGHT;
/** Game hours after sunrise that somebody asleep wakes up. */
export const WAKE_AFTER_DAWN = 0.5;
/** Real seconds a spot stays picked over, for every kind but a sprout (the island's `forage_cooldown`). */
export const FORAGE_COOLDOWN = 180;
/** Real seconds between sprouts off one tree (`sprout_cooldown`). */
export const SPROUT_COOLDOWN = 3600;
/** Real seconds a spot stays picked over for a kind of work: `SPROUT_COOLDOWN` for a sprout, `FORAGE_COOLDOWN` for the rest. */
export const forageCooldown = (kind: string): number => (kind === 'sprout' ? SPROUT_COOLDOWN : FORAGE_COOLDOWN);
/**
 * How dark it has to be before a fight teaches you anything about noticing.
 * Dusk is not night: a scuffle at seven in the evening is still fought by eye.
 */
/**
 * The things a single tile can be worked over for, each with its own
 * cooldown: picking berries does not stop you cutting the grass.
 */
const FORAGE_KINDS = ['forage', 'botanize', 'grass', 'reed', 'dig', 'moss', 'worm', 'sprout', 'vine'];
/** How long ore stays lit after prospecting. */
export const PROSPECT_MARK_TIME = 120;
/** Lines of the log kept of everything but talk. */
const MAX_LOG = 400;

/** Let go of the oldest lines past `TALK_LOG` of talk and `MAX_LOG` of the rest, each counted apart. */
export function trimLog(log: LogEntry[]): void {
  let talk = 0;
  for (const e of log) if (isTalk(e.kind)) talk += 1;
  let over = talk - TALK_LOG, rest = log.length - talk - MAX_LOG;
  if (over <= 0 && rest <= 0) return;
  let w = 0;
  for (const e of log) {
    if (isTalk(e.kind) ? over-- > 0 : rest-- > 0) continue;
    log[w++] = e;
  }
  log.length = w;
}
/** Seconds between ground decay passes while playing. */
const DECAY_STEP = 5;
/** Ground a sprout will take, which is the same ground a tree grows on. */
/** How far a prospector moves on before reading the ground again. */
const PROSPECT_STRIDE = 4;

export const PLANTABLE = new Set<number>([TileType.Grass, TileType.Dirt, TileType.Lawn, TileType.Steppe, TileType.Tundra, TileType.Moss]);

/** Central simulation state: the world, the player and everything they do. */
/** What a back takes before it tells on you, in kilos, and what each point of body strength adds. */
export const CARRY_BASE = 120;
export const CARRY_PER_STRENGTH = 5;
/**
 * Where carrying too much stops being a drag and becomes a wall.
 *
 * Past the limit everything is already slower and dearer in wind, and the
 * curve was the whole of it: load a body with ten times what it can take and
 * it still walked, at a crawl. Asked for: "when inventory is above 150% cap,
 * movement speed becomes 0". So half again over the limit became the end of
 * walking.
 *
 * And then, asked for after that: five per cent rather than nought. Nought
 * had a sharp edge on it — a body that cannot move at all cannot get itself
 * out of wherever it overloaded, and the only way out was to put things down
 * where they stood. `CARRY_CRAWL` is what is left of your pace past this
 * line: enough to get somewhere, not enough to make carrying it worth doing.
 */
export const CARRY_STOP = 1.5;
/** The damage at which a post's worker is warned that it is near collapse. */
export const POST_WARN = 85;

/** What an ordinary go teaches, before the curve and everything that multiplies it. */
export const ORDINARY_GAIN = 0.45;

/**
 * How long a go takes, off the weight it is written at (see `pace.ts`), the
 * skill and tool behind it and the body doing it. `Game.duration` asks it of
 * whoever is acting, and the help asks it of somebody new to the work.
 */
/** Difficulty mind logic takes off a thinking check for every level over the starting mark (`mind_ease`); never more than half the check's. */
export const MIND_EASE_PER_LEVEL = 0.2;
export const mindEaseAt = (mind: number): number => Math.max(0, (mind - CHAR_START) * MIND_EASE_PER_LEVEL);
/** The thinking checks mind logic eases, and only these: every one passes `mindEase()` to its check. */
export const MIND_EASED_SKILLS: readonly string[] = ['blacksmithing', 'brewing', 'first_aid', 'restoration', 'jewellery'];

/** Body control's share of every timed action's time, this many levels over the starting mark (`control_speed`). */
export const controlPaceAbove = (above: number): number => Math.max(0.6, 1 - above * 0.003);
/** Body stamina's share of what an action or a swing costs, this many levels over the starting mark (`spend_wind`). */
export const staminaCostAbove = (above: number): number => Math.max(0.45, 1 - Math.max(0, above) * 0.0045);
/** And of how fast stamina comes back (`body_settle`). */
export const windRegenAbove = (above: number): number => 1 + Math.max(0, above) * WIND_PER_LEVEL;
/** Awareness's share for every level over the starting mark (`aware_per_level`): monster notice range down, tracking range up, hit chance in the dark up. */
export const AWARE_PER_LEVEL = 0.00125;
/** That share, this many levels of awareness over the starting mark (`aware_share`). */
export const awareShareAbove = (above: number): number => Math.max(0, above) * AWARE_PER_LEVEL;
/** One level less animal husbandry to read a trait per this many levels of awareness over the starting mark (`aware_trait_step`). */
export const AWARE_TRAIT_STEP = 10;
/** Levels of animal husbandry an awareness takes off reading a trait (`aware_trait_ease`). */
export const awareTraitEase = (aware: number): number => Math.max(0, Math.floor((aware - CHAR_START) / AWARE_TRAIT_STEP));
/** Soul strength's points of tame chance per level over the starting mark (`tame_chance`). */
export const SOUL_TAME_PER_LEVEL = 0.002;
export const soulTameAbove = (above: number): number => Math.max(0, above) * SOUL_TAME_PER_LEVEL;
/** Soul strength's multiplier on favour per prayer, Calm per sitting and a Beastmaster spell's heal, blow and bonus, this many levels over the starting mark (`soul_mul`). */
export const soulAbove = (above: number): number => 1 + Math.max(0, above) * SOUL_PER_LEVEL;
export { SOUL_PER_LEVEL };
/** The hands on a boat, as a share of her speed: body control at a sail, body strength at the oars (`hull_speed`). */
export const boatHands = (sail: boolean, body: number): number => (sail ? 0.9 + body / 320 : 0.6 + body / 150);

export const goSeconds = (baseTime: number, skill = 50, toolQl = 0, control = 1): number =>
  Math.max(ACTION_FLOOR, baseTime * ACTION_PACE * (1 - skill / 140) * (1 - toolQl / TOOL_QL_SPAN) * control);
/** Each point of a tool's QL takes one part in this many off a go's time: a QL 100 tool, a quarter of it. */
export const TOOL_QL_SPAN = 400;
/** The best a thing's QL can be (`limits.ts`). */
export { QL_TOP };

/**
 * What you wash ashore with: each tool, the quality it comes at and what its
 * head or handle is. Everything here is marked as issued: rough gear off the
 * beach, good enough to get a first tool made with and not worth working on.
 * Copper heads on pine handles, which is the poorest of everything: the first
 * bronze tool you cast for yourself is already better than any of it.
 */
export const STARTER_KIT: ReadonlyArray<readonly [string, number, string]> = [
  ['hatchet', 20, 'Copper'],
  ['shovel', 20, 'Copper'],
  ['pickaxe', 20, 'Copper'],
  ['carving_knife', 20, 'Copper'],
  ['chisel', 15, 'Copper'],
  ['mallet', 20, 'Pine'],
  ['trowel', 20, 'Copper'],
  ['saw', 20, 'Copper'],
  ['butchering_knife', 20, 'Copper'],
  ['rake', 20, 'Copper'],
  ['water_skin', 30, ''],
];
/** The quality a tool in the kit comes ashore at, for the text that says why to better it. */
export const kitQl = (id: string): number => STARTER_KIT.find(([k]) => k === id)?.[1] ?? 0;

/**
 * What carrying past your limit costs, as burden: the share of your limit you
 * are over, times `OVER_DRAG`, and never more than `OVER_DRAG_CAP` — so twice
 * your limit is not twice as bad, it is worse, and then it stops getting worse.
 */
export const OVER_DRAG = 1.1;
export const OVER_DRAG_CAP = 1.2;
export const overDrag = (over: number, limit: number): number =>
  over > 0 && limit > 0 ? Math.min(OVER_DRAG_CAP, (over / limit) * OVER_DRAG) : 0;

/** What a hold loaded to her marks costs a hull: this much slower than one running empty. */
export const BOAT_LOAD_DRAG = 0.33;
/**
 * How fast a hull goes, in tiles a second, off everything that decides it:
 * the build, the body behind it (control under sail, strength at the oars),
 * the weather she is taking (1 for oars) and how full her hold is, 0 to 1.
 * `boatSpeed` asks it of the boat you are in and the help asks it of an
 * example, so the two cannot disagree.
 */
export function hullSpeed(def: BoatDef, ql: number, body: number, weather: number, load: number): number {
  const hands = boatHands(!!def.sail, body);
  const hull = 0.75 + ql / 220;
  return def.speed * hands * hull * weather * (1 - load * BOAT_LOAD_DRAG);
}

export class Game {
  readonly seed: number;
  readonly world: World;
  /** Where you wake up: the shore you came in on until a bed says otherwise. */
  spawn: { x: number; y: number };
  /**
   * Whoever is acting at this instant: their body, their pack, their skills.
   *
   * These were `readonly` and pointed at the one person on the island. They
   * still point at one person — they are simply no longer always the same
   * person. Everything that reads them reads them exactly as it always did;
   * `as()` decides who that is, and puts it back afterwards. See `actor.ts`
   * for why it was done this way round and not the other.
   */
  player: Player;
  inventory: Inventory;
  skills: Skills;
  /** Everyone with a body on this island, by who they are on the wire. */
  readonly actors = new Map<PeerId, Actor>();
  /**
   * The guest book: everyone who has ever set foot here, and what they had
   * when they left.
   *
   * Filed by a durable name the visitor keeps on their own machine, not by
   * the number they are given when they connect — that is handed out fresh
   * every session and would make everyone a stranger every time. Somebody who
   * comes back finds their pack where they left it, their skills where they
   * earned them, and themselves standing where they logged out.
   */
  readonly guestbook = new Map<string, GuestSave>();
  /** Whoever is playing on this machine. Never changes for the life of a game. */
  readonly local: Actor;
  /** Whoever `player`, `inventory` and `skills` are pointing at this instant. */
  private acting: Actor;
  readonly events = new GameEmitter();
  readonly log: LogEntry[] = [];
  /**
   * What the person sitting here likes, which is theirs rather than the
   * island's — see `settings.ts`. They put themselves away as they are
   * changed, so a refresh comes back to the view you left.
   */
  readonly settings: Settings = liveSettings();
  /**
   * Everything placed, filed by the tile it stands on. The renderer asks what
   * is on a tile for every tile it draws, so these are what keep that from
   * being a walk of every crate and every stick of furniture in the world.
   */
  private readonly standing = new Tally();
  readonly placed = {
    crates: new TileIndex<PlacedCrate>(this.standing),
    campfires: new TileIndex<PlacedCampfire>(this.standing),
    smelters: new TileIndex<PlacedSmelter>(this.standing),
    kilns: new TileIndex<PlacedKiln>(this.standing),
    furniture: new TileIndex<PlacedFurniture>(this.standing),
    anvils: new TileIndex<PlacedAnvil>(this.standing),
    posts: new TileIndex<PlacedPost>(this.standing),
    traps: new TileIndex<PlacedTrap>(this.standing),
  };

  /**
   * Whether anything at all has been put down on a tile: a crate, a fire, a
   * smelter, a kiln, a stick of furniture, an anvil, a post, a trap. One
   * lookup in place of eight, for the renderer, which asks per tile.
   */
  anythingPlaced(x: number, y: number): boolean {
    return this.standing.any(x, y);
  }
  /**
   * The other people on the island, when there are any. Empty on a world
   * nobody else is in, which is every world until somebody opens one up, so
   * everything that reads it can ask once and skip.
   */
  readonly roster = new Roster();
  /**
   * Hoards in the ground, by the map that points at each.
   *
   * On an island this is `treasure`, a table nothing may read. Here it is in
   * the save, which hides nothing — a single-player island is the player's own
   * machine and always was. What makes it a hunt is the picture, not the
   * secrecy: the map shows you a stretch of country and you go and look.
   */
  hoards: Hoard[] = [];

  /** Names pinned to spots on the island, and the next id to give one. */
  readonly marks: Marker[] = [];
  private nextMarkId = 1;
  readonly buildings: Buildings;
  /** What can be seen from where you are, and what is only remembered. */
  readonly vision: Vision;
  readonly creatures: Creatures;
  deed: Deed | null = null;
  /** Work posts by id; each stands on one subtile off the deed. */
  readonly posts = new Map<number, PlacedPost>();
  readonly traps = new Map<number, PlacedTrap>();
  nextTrapId = 1;
  /** Game time a fair wind holds until; the weather does as it is told till then. */
  favourWind = -1e9;
  readonly bridges = new Map<number, Bridge>();
  nextBridgeId = 1;
  /** The springs dug on this island, and the ponds and streams they keep (`./springs`). */
  readonly springs: Springs;
  /** Tile key to the bridge whose deck covers it, rebuilt whenever one changes. */
  private deckIndex = new Map<string, number>();
  /** The hinge of every drawbridge drawn up, by `hingeKey`, to the bridge: a border shut to everything (`gates.ts`). */
  readonly hinges = new Map<string, number>();
  /** Concrete slabs poured over sloping tiles, one to a tile. */
  readonly foundations = new Map<number, Foundation>();
  nextFoundationId = 1;
  private slabIndex = new Map<string, number>();
  private nextPostId = 1;
  /**
   * A running count of things done: felled trees, landed fish, brews set
   * going. Nothing in the game reads these but the journal, which is the
   * only place that knows there is anything worth doing.
   */
  readonly tally: Record<string, number> = {};
  /** Everything ever made: how many, and the best one. */
  readonly ledger: Ledger = {};
  /** Goals already ticked off, which stay ticked whatever happens after. */
  readonly ticked = new Set<string>();
  /**
   * The field guide: every kind with a page, and which of them you have seen,
   * tamed and bred (`guide.ts`). Alone it is this side's and goes in the save;
   * on an island it is the island's, and this holds what the island has said.
   */
  readonly guide = new FieldGuide();
  /**
   * Who to tell about a kind that has just come into view, on an island,
   * where the book is kept over there and a sighting is only one once the
   * island has taken it. Nothing here off one: alone, the book is written on
   * the spot.
   */
  guideSaw?: (species: string) => void;
  private guideClock = 0;
  /** The wild ones already said in the log as rare or in a form (`sightedLine`), by id, so each is said once. */
  private sighted = new Set<number>();
  /**
   * Who to tell when one is ticked, on an island. Nothing here off one.
   *
   * The journal reads the book, the pack, the ground and what is standing on
   * it, all of which the island keeps and this side draws — so the *reading*
   * stays here and the record goes over. Eighty-five predicates are eighty-five
   * ports for another day; a list of ids is one column.
   */
  tickedGoal?: (id: string) => void;
  /**
   * Whether the journal is worth reading yet.
   *
   * True by itself, because a browser playing alone has its journal the moment
   * it has loaded one. On an island it is the island's, and the first beat is
   * a second away — so until that lands, this side is holding an empty tally
   * and no ticks, and every goal already met would be announced again on every
   * refresh. Nothing is lost by waiting a second for the book.
   */
  journalReady = true;
  private journalAt = -1e9;
  /**
   * Whether the counts the journal reads are the island's, which keeps one for each person.
   *
   * Reported: "often receiving completions when another online player
   * completes a task". On an island this side still runs some of the world
   * for everything it can see -- the traps in view were rolled here, anybody's,
   * and one that caught something noted "caught" in the journal of whoever was
   * looking -- and a count only this tab had made was kept through every beat,
   * so the goal was ticked before the island could say otherwise. On an island
   * nothing is noted here but `BROWSER_TALLY`, which only this side can see,
   * and the island's counts replace this side's on every beat.
   */
  tallyFromIsland = false;

  /** Note that something was done, once. */
  note(key: string, n = 1): void {
    if (this.tallyFromIsland && !BROWSER_TALLY.has(key)) return;
    this.tally[key] = (this.tally[key] ?? 0) + n;
  }

  /**
   * Mark a kind in the field guide, for the person at this screen, and say so
   * the first time it is seen. A guest's taming on a host's machine is the
   * guest's, and it is not written into the host's book.
   */
  guideMark(species: string, what: GuideMark): void {
    // A kind's page, or a stage's (`species:stage`), seen and tamed, or a wild form's (`species/form`), seen and tamed.
    if (this.acting !== this.local || !guideMarks(species).includes(what)) return;
    const fresh = this.guide.mark(species, what);
    if (!fresh.length) return;
    if (fresh.includes('seen')) this.logMsg(this.guideSeenLine(species), 'wildermon');
    this.events.emit('guide');
  }

  /** What the log says of a key first seen: a page's line, or a wild form's (`formSeenLine`). */
  private guideSeenLine(key: string): string {
    const entry = guideEntry(key);
    return entry ? seenLine(entry, this.guide) : formSeenLine(guideName(key) ?? key);
  }

  /** A creature's kind marked, its stage's page where it is tamed past its first, and each wild form it is in (`formKey`), as the island's taming marks them. */
  guideMarkKind(c: Pick<Creature, 'species' | 'formColour' | 'formSize' | 'skills'>, what: GuideMark): void {
    this.guideMark(c.species, what);
    if (what === 'tamed' && stageOf(c) > 0) this.guideMark(stageKey(c.species, stageOf(c)), what);
    for (const f of formsOf(c)) this.guideMark(formKey(c.species, f), what);
  }

  /**
   * What the island said of kinds handed over as seen: the ones it wrote down
   * just now, which are said in the log exactly as they are alone, and the
   * ones it had already, which are only marked.
   */
  guideHeard(added: string[], had: string[]): void {
    let changed = false;
    for (const id of had) if (guideMarks(id).length && this.guide.mark(id, 'seen').length) changed = true;
    for (const id of added) {
      if (!guideMarks(id).length || !this.guide.mark(id, 'seen').length) continue;
      changed = true;
      this.logMsg(this.guideSeenLine(id), 'wildermon');
    }
    if (changed) this.events.emit('guide');
  }

  /** The whole book as the island keeps it, read as the window opens. */
  guideRead(book: GuideBook): void {
    this.guide.take(book);
    this.events.emit('guide');
  }

  /**
   * Whatever is in view, looked over for a kind the book has not got.
   *
   * In view is what the drawing means by it: a creature out of a crate, on a
   * tile in sight now, which counts your own wildermon's eyes and the ground
   * of your settlement as the drawing does. Once a `GUIDE_LOOK`, and one
   * question a kind however many of it are standing about. Alone the book is
   * written here; on an island the kind is handed over, and it goes in the
   * book when the island has taken it.
   */
  private lookForKinds(dt: number): void {
    this.guideClock += dt;
    if (this.guideClock < GUIDE_LOOK) return;
    this.guideClock = 0;
    let asked: Set<string> | null = null;
    for (const c of this.creatures.list.values()) {
      if (c.mode === 'stored') continue;
      // A wild one that is rare or in a wild form, said once as it comes into view.
      if (c.mode === 'wild' && (c.rare || formsOf(c).length) && !this.sighted.has(c.id) && this.vision.isWatched(c.x, c.y)) {
        this.sighted.add(c.id);
        this.logMsg(sightedLine(c, this.player.x, this.player.y), 'wildermon');
      }
      // Its kind's page, and its stage's where it is past its first (`stageKey`).
      // And each wild form it is in (`formKey`).
      const keys = [c.species, stageKey(c.species, stageOf(c)), ...formsOf(c).map((f) => formKey(c.species, f))].filter((k, i, all) => all.indexOf(k) === i
        && !this.guide.seen.has(k) && !asked?.has(k));
      if (!keys.length || !this.vision.isWatched(c.x, c.y)) continue;
      for (const k of keys) {
        (asked ??= new Set()).add(k);
        if (this.guideSaw) this.guideSaw(k);
        else this.guideMark(k, 'seen');
      }
    }
  }

  /**
   * Write a finished thing into the ledger, and say so when it is the best of
   * its kind you have ever managed. A first one is worth saying too: it is the
   * only time you will ever make your first of anything.
   */
  madeIt(id: string, ql: number, count = 1, rare = 0): void {
    const had = this.ledger[id];
    const before = had?.best ?? 0;
    const rec = record(this.ledger, id, ql, count, rare, this.time);
    this.note('made');
    this.note(`made:${id}`);
    const name = itemDef(id).name.toLowerCase();
    if (!had) this.logMsg(`First ${name} made. (Journal: Ledger tab, J)`, 'skill');
    else if (rec.best > before + 0.05 && rec.n > 1) this.logMsg(`Best ${name} made: QL ${rec.best.toFixed(1)}, was ${before.toFixed(1)}.`, 'skill');
  }

  /** What the ledger adds up to. */
  ledgerTotals(): ReturnType<typeof ledgerTotals> {
    return ledgerTotals(this.ledger);
  }

  /**
   * Look over the journal for anything newly done. Only the goals still open
   * are tested, and only now and again, so a list of fifty costs nothing.
   */
  private checkJournal(): void {
    // The journal belongs to the person at this screen, and is written down in
    // their save. A guest's mining skill is not the host's progress, and a
    // guest has no journal of their own yet — so theirs ticks nothing.
    if (this.acting !== this.local) return;
    if (!this.journalReady) return;
    if (this.time - this.journalAt < 2) return;
    this.journalAt = this.time;
    for (const goal of ALL_GOALS) {
      if (this.ticked.has(goal.id)) continue;
      let met = false;
      try {
        met = goal.met(this);
      } catch {
        met = false;
      }
      if (!met) continue;
      this.ticked.add(goal.id);
      // And the island keeps the record of it, so that done stays done through
      // a refresh. An island session never saves — `main.ts` starts the save
      // loop behind `if (!island)` — so until now every tick was a thing this
      // tab knew and nothing else did.
      this.tickedGoal?.(goal.id);
      this.logMsg(`Journal: ${goal.text.toLowerCase()}. (${this.ticked.size} of ${ALL_GOALS.length})`, 'skill');
      this.events.emit('journal');
    }
  }

  /**
   * The island's record of the goals done, as a beat brings it (`rpc_settle`).
   *
   * Merged in, and the journal read from now on. And the Goals page told when
   * the record holds any this side did not, which on coming ashore is every
   * one: the page was drawn before the first beat, and the journal opens by
   * itself at What's new on coming ashore whenever there is news, so it was
   * drawn with nothing done and stayed so. Not `journal`: these were done
   * before, so there is no line and no chime.
   */
  heardTicked(ids: readonly unknown[]): void {
    const had = this.ticked.size;
    for (const id of ids) if (typeof id === 'string') this.ticked.add(id);
    this.journalReady = true;
    if (this.ticked.size > had) this.events.emit('goals');
  }

  /** Placed crates by id; each sits on one subtile. */
  readonly crates = new Map<number, PlacedCrate>();
  nextCrateId = 1;
  /** Campfires by id; each covers a two by two block of subtiles. */
  readonly campfires = new Map<number, PlacedCampfire>();
  nextFireId = 1;
  /** Smelters by id; each covers six subtiles. */
  readonly smelters = new Map<number, PlacedSmelter>();
  nextSmelterId = 1;
  /** Kilns by id; each covers four subtiles. */
  readonly kilns = new Map<number, PlacedKiln>();
  nextKilnId = 1;
  /** Furniture by id; each covers the block of subtiles its kind takes. */
  readonly furniture = new Map<number, PlacedFurniture>();
  nextFurnitureId = 1;
  /** What is set out on each shop counter, and its till (`counters.ts`). */
  readonly counters = new Counters();
  /** Anvils by id; each covers four subtiles. */
  readonly anvils = new Map<number, PlacedAnvil>();
  nextAnvilId = 1;
  /**
   * What a ground read builds before it is laid over what is held (`layOver`),
   * and the counters it named last time: kept, so a read that says what the
   * last one said makes no maps and tells no window anything.
   */
  private readonly readBuilt = {
    crates: new Map<number, PlacedCrate>(), campfires: new Map<number, PlacedCampfire>(), smelters: new Map<number, PlacedSmelter>(),
    kilns: new Map<number, PlacedKiln>(), furniture: new Map<number, PlacedFurniture>(), anvils: new Map<number, PlacedAnvil>(),
    posts: new Map<number, PlacedPost>(), traps: new Map<number, PlacedTrap>(), piles: new Map<number, Item[]>(), counters: [] as unknown[],
  };
  /** Crops growing on tilled fields, keyed by "x,y". */
  readonly crops = new Map<number, Crop>();
  /** The crop last sown on each field, by tile, for a Farmer's Crop Rotation. */
  readonly sown = new Map<number, string>();
  /** What is growing in planters, by the id of the piece it grows in. A planter holds one crop. */
  readonly planted = new Map<number, Crop>();
  /**
   * The field clock in the game you play by yourself: the growing seconds a
   * field has had, run on at the season's share (`fieldRate`) of every game
   * second, a night slept included. The game's own clock is not the wall
   * clock -- it stops when the page is shut and leaps when you sleep -- so the
   * field clock cannot be read off the year the way an island's is
   * (`fieldNow`). Kept in the save; one that never held it starts it at the
   * game clock, which is where every crop in it was stamped.
   */
  fieldTime = 0;
  /** A Season's Hand's field clock by yourself, as `fieldTime` (`handClock`'s rates). */
  handTime = 0;
  /** Seconds the island's wall clock is ahead of this machine's, as the last ground read that carried it said. */
  wallSkew = 0;
  /**
   * The wall clock, in epoch seconds, when something other than this
   * machine's is wanted: a test asking about a moment, or a picture of a
   * season. Null reads this machine's, set right by the island's (`wallSkew`).
   */
  wallClock: (() => number) | null = null;
  /**
   * The water lilies and lotus planted in still water, by tile (`watergarden.ts`):
   * when each was planted and last picked, in seconds of the wall clock, which
   * is all that is kept of one. On an island the island's, off the slow ground read.
   */
  readonly waterPlants = new Map<number, WaterPlant>();
  /**
   * The mote swirls turning over the ground, by id (`motes.ts`), and the same
   * by tile. In a game of your own the day's, put down at each turn of the
   * woods; on an island the ones in the nine blocks round you, as the island
   * last said (`rpc_swirls`, through `setSwirls`).
   */
  readonly swirls = new Map<number, Swirl>();
  private readonly swirlTiles = new Map<number, Swirl>();
  /** The dawn the swirls in a game of your own were put down for; null before the first. */
  swirlDawn: number | null = null;
  /** Tiles a prospector has marked, and when the marks fade. */
  prospected: { tiles: Set<number>; until: number } | null = null;
  hooks: GameHooks = { prompt: async (_q, fallback) => fallback, confirm: async () => true, choose: async (_q, choices) => choices[0]?.key ?? null };
  /** What the acting person is in the middle of, and what is behind it. */
  get action(): ActiveAction | null {
    return this.acting.action;
  }

  set action(a: ActiveAction | null) {
    this.acting.action = a;
  }

  /**
   * Set by a `perform` that swung and did not land, read once by the gain
   * above and cleared there. On the row rather than a return value because
   * `perform` already uses its return to say whether to go round again.
   */
  /**
   * When the woods were last turned over, in real seconds.
   *
   * Real seconds and not the world's own faster hours: a stage was asked for as
   * a real life day, so a tree planted on a Tuesday is a young tree on
   * Wednesday whether or not this tab was open for any of it.
   */
  treesAt = Date.now() / 1000;
  /**
   * When greening came to this island, in real seconds: nothing greens from
   * before it (`greening.ts`). On an island it is the island's, off the
   * ground's slow half; at home a save that has never held it starts from
   * now, so a village that stood before this came in is bare on the day it
   * arrives and greens over from there.
   */
  greenFrom = Date.now() / 1000;
  /**
   * When each tile paved since then was paved or last scrubbed, in real
   * seconds, by "x,y". Beside the land rather than in it, the way the felling
   * notches are; a tile paved before greening came in, or no longer paved,
   * is not in it.
   */
  readonly pavingSince = new Map<string, number>();

  /**
   * A tile the island says was paved or had its paving lifted, before the
   * ground read that says when (`Island.hooks.paved`): new paving is taken as
   * laid now until then, and lifted paving forgets.
   */
  sawPaving(x: number, y: number, paved: boolean): void {
    const at = `${x},${y}`;
    if (!paved) this.pavingSince.delete(at);
    else if (!this.pavingSince.has(at)) this.pavingSince.set(at, greenNow());
  }
  /** How far down the island a tree turn has got, or -1 when none is running. */
  private treeRow = -1;
  /** The moment the turn in progress is for, banked until it finishes. */
  private treeTurn = 0;
  /** The trees the turn in progress has seen the end of, which seed once the whole island is done. */
  private treeGone: Array<[number, number, number]> = [];
  /**
   * The height everything that shapes the ground is working towards, or null.
   *
   * A surveyor sights a level and every cut and every barrowful after it is
   * measured against that one mark. Until now flattening aimed at whatever
   * tile you happened to be standing on, so levelling a yard meant standing in
   * exactly the right place for every tile of it, and digging had no mark at
   * all: you counted spadefuls and overshot. Take the level at a corner and it
   * is the mark until you clear it — flattening aims at it, digging and
   * chipping stop when they reach it, and dirt and concrete stop when they
   * come up to it. On an island it lives on the player row, so it is the same
   * mark in every browser you open.
   */
  level: number | null = null;

  /**
   * The last track read (`tracking.ts`), for the arrow on the screen while it
   * is fresh: set by a go of Track here, and on an island by what the island
   * says the go read. Not saved.
   */
  trail: Trail | null = null;

  /** The last log on or off the island said (`src/net/presence.ts`), for the banner: who, which, and when it came in. Not saved. */
  loggedSaid: { name: string; on: boolean; at: number } | null = null;

  /** Whether this body keeps the island (`rpc_owner_am_i`): a keeper's names are not refused as a keeper's (`playertext.ts`). Not saved. */
  keeper = false;

  private swingMissed = false;
  /** Whether the go in hand had its roll taken by a Foreknow, which spends one of its goes when the go is done. */
  private foreknown = false;

  /** Said by a `perform` whose swing found nothing. */
  missed(): void {
    this.swingMissed = true;
  }

  /** Actions lined up behind the one in hand, oldest first. */
  get queue(): Array<{ def: ActionDef; target: Target; goes?: number; was?: string }> {
    return this.acting.queue;
  }
  /**
   * What lies on the floor of a cellar, by tile, apart from what lies on the
   * ground over it: everything that looks at `ground` -- a beast after food, a
   * worker after logs -- is up top and never sees down here, which is right.
   */
  readonly cellarGround = new Map<number, Item[]>();
  /** Items lying on tiles, keyed by "x,y". */
  readonly ground = new Map<number, Item[]>();
  /** Game seconds since the world was created. */
  time = 0;

  /**
   * What time it is on the island, when there is one, in seconds since it
   * began. Null in the game you play by yourself, where this browser's own
   * count is the only clock there is.
   *
   * "Day and night only seem to change on client refresh." This is why. The
   * hour used to be `time`, and `time` is added up a frame at a time — with a
   * frame capped at a tenth of a second, so that a tab coming back from a
   * stall does not walk anybody a minute across the island in one step. Every
   * scrap of real time past that cap is gone, and a tab that is not being
   * drawn at all gets no frames to cap. So on a phone the clock fell behind by
   * most of the session, and the one thing that ever put it right was a reload
   * reading the hour again.
   *
   * A seam rather than a number, filled in by `play.ts`, because what is
   * behind it is the island's own reading pinned against a monotonic clock —
   * and a monotonic clock keeps running while a tab is asleep.
   */
  islandClock: (() => number) | null = null;
  /**
   * What the perks you hold come to, as the island folded them
   * (`player.class_mul.fx`), key by key. Empty in a game played alone, which
   * has no trades. Read through `perk`, which hands back the rule's own number
   * wherever you hold no perk that changes it.
   */
  perkFx: Record<string, number> = {};
  /** One number off `perkFx`, or the rule's own when no perk you hold changes it. */
  perk(key: string, otherwise: number): number {
    const v = this.perkFx[key];
    return typeof v === 'number' ? v : otherwise;
  }
  /** Take the island's fold of your perks, and hand what it says on to the body and the pack. */
  setPerks(fx: Record<string, number> | null | undefined): void {
    this.perkFx = { ...(fx ?? {}) };
    this.player.roadPace = this.perk('walk:road', 1);
    // And through brush, for a Forester's Woodsman's Stride: each tile that has a pace in the perks.
    this.player.tilePace = Object.fromEntries(Object.keys(TILE_DEFS).map(Number)
      .map((t) => [t, this.perk(walkKey(t), 1)] as const).filter(([, v]) => v !== 1));
    this.inventory.weightMul = (id: string): number => this.perk(`weight:${id}`, 1);
    // What keeping a beast comes to under your perks, for every one of yours offline (a Herdsman's).
    this.refreshKept();
    this.events.emit('inventory');
  }
  rand: () => number = Math.random;
  private foraged = new Map<number, number>();

  private decayClock = 0;

  /**
   * The guest book as it stands, with everybody currently on the island
   * written into it as they are this instant.
   *
   * A record is normally filed when somebody leaves, which is the moment their
   * pack stops changing. But a host who saves and then closes the tab never
   * sees anybody leave, and the evening four guests just spent filling their
   * packs would go with the tab. So a save asks, and everybody still standing
   * here is written down mid-sentence.
   */
  guestRecords(): GuestSave[] {
    const out = new Map(this.guestbook);
    for (const actor of this.actors.values()) if (actor !== this.local) out.set(actor.who, this.guestSave(actor));
    return [...out.values()];
  }

  /** Everything of a visitor's that outlives their visit. */
  private guestSave(actor: Actor): GuestSave {
    return {
      who: actor.who,
      body: writePlayer(actor.player),
      items: actor.inventory.items,
      skills: actor.skills.toJSON(),
      seen: Date.now(),
    };
  }

  static create(seed: number, size = WORLD_SIZE): Game {
    const gen = generateWorld(seed, size);
    const game = new Game({ seed, world: gen.world, spawn: gen.spawn });
    // Somebody, rather than the same somebody every time. An account replaces
    // this with whatever was chosen on the landing page; a browser that has
    // never seen one still gets a face of its own.
    game.player.look = randomLook();
    game.giveStarterKit();
    // A new island is stocked on the books; what is near the player takes a
    // body on the first streaming pass, and the rest waits to be walked to.
    game.creatures.stockIsland(game);
    game.logMsg('Welcome to Wildermon.', 'system');
    game.logMsg(`Left-click: walk. Right-click a tile: actions. ${['pan_up', 'pan_left', 'pan_down', 'pan_right'].map(boundKey).join(' ')}: pan the view. Scroll: zoom. Settings (${boundKey('win_settings')}), Keys tab: rebind. ${boundKey('win_help')}: help.`, 'system');
    return game;
  }

  constructor(init: GameInit) {
    this.seed = init.seed;
    this.world = init.world;
    // The Runestones stand on this world, laid over it by scale, and nothing walks through them (`runestones.ts`).
    this.world.solid = stoneTiles(this.world.w);
    this.spawn = init.spawn;
    this.player = new Player(init.player?.x ?? init.spawn.x + 0.5, init.player?.y ?? init.spawn.y + 0.5);
    if (init.player) readPlayer(this.player, init.player);
    this.refreshKept();
    this.hoards = init.hoards ?? [];
    for (const m of init.marks ?? []) {
      this.marks.push(m);
      if (m.id >= this.nextMarkId) this.nextMarkId = m.id + 1;
    }
    this.inventory = new Inventory(init.inventory, init.nextUid);
    this.inventory.onChange = () => {
      this.unwearWhatIsGone();
      this.events.emit('inventory');
    };
    for (const [into, from] of [[this.ground, init.ground], [this.cellarGround, init.cellarGround]] as const) {
      for (const [key, items] of Object.entries(from ?? {})) {
        const [kx, ky] = key.split(',');
        if (items.length) into.set(tileKey(Number(kx), Number(ky)), items);
        for (const it of items) if (it.uid >= this.inventory.nextUid) this.inventory.nextUid = it.uid + 1;
      }
    }
    this.skills = new Skills(init.skills);
    for (const g of init.guests ?? []) {
      if (!g || typeof g.who !== 'string') continue;
      this.guestbook.set(g.who, g);
      // A visitor's numbers are the island's numbers. Nothing made while they
      // are away may be given a number one of their things is already wearing,
      // or the two become one the evening they walk back in.
      for (const it of g.items ?? []) if (it.uid >= this.inventory.nextUid) this.inventory.nextUid = it.uid + 1;
    }
    // The one person a single-player island has. On a shared one they are the
    // host, which is the same thing said differently.
    this.local = new Actor(HOST_ID, 'local', this.player, this.inventory, this.skills);
    this.local.hear = (text, kind) => this.write(text, kind);
    this.local.packed = () => this.events.emit('inventory');
    this.acting = this.local;
    // News about a person only reaches this screen when it is about the person
    // at it.
    this.events.mine = () => this.acting === this.local;
    this.actors.set(this.local.id, this.local);
    // A new castaway washes ashore at eight in the morning, not at midnight.
    this.time = init.time ?? (8 / 24) * DAY_SECONDS;
    /*
     * And the woods' own clock, which is a real one.
     *
     * A save that has never held it starts from now rather than from nothing:
     * a world opened for the first time should not find its whole forest a
     * lifetime overdue on the first pass.
     */
    this.treesAt = init.treesAt ?? Date.now() / 1000;
    this.greenFrom = init.greenFrom ?? Date.now() / 1000;
    for (const [x, y, since] of init.pavingSince ?? []) this.pavingSince.set(`${x},${y}`, since);
    this.deed = init.deed ?? null;
    this.buildings = Buildings.fromJSON(init.buildings);
    // A hidden door is a door to whoever its padlock admits, and a wall to everybody else (`gates.ts`).
    this.buildings.admits = (w) => this.lockRefusal({ lock: w.lock, x: w.x, y: w.y }) === null;
    this.creatures = Creatures.fromJSON(init.creatures);
    // What a wildermon does, for its moves, its light and its voice (`beast`).
    this.creatures.onAct = (id, act) => this.events.emit('beast', id, act);
    for (const c of init.crates ?? []) {
      this.crates.set(c.id, c);
      if (c.id >= this.nextCrateId) this.nextCrateId = c.id + 1;
    }
    if (init.crate && !this.crates.size) this.addCrate('plank', init.crate.x, init.crate.y, 1, 1, init.crate.items, true);
    for (const f of init.campfires ?? []) {
      this.campfires.set(f.id, f);
      if (f.id >= this.nextFireId) this.nextFireId = f.id + 1;
    }
    for (const c of init.crops ?? []) this.crops.set(tileKey(c.x, c.y), c);
    // A save from before the year has no field clock: it starts where the game clock stands, so nothing growing jumps.
    this.fieldTime = init.fieldTime ?? this.time;
    this.handTime = init.handTime ?? this.fieldTime;
    for (const c of init.planted ?? []) if (c.planter !== undefined) this.planted.set(c.planter, c);
    for (const [x, y, id] of init.sown ?? []) this.sown.set(tileKey(x, y), id);
    for (const w of init.waterPlants ?? []) this.waterPlants.set(tileKey(w.x, w.y), { ...w });
    // A save from before the swirls has none, and puts the day's down on its first frame (`growTrees`).
    if (init.swirls && init.swirlDawn !== undefined) {
      this.setSwirls(init.swirls.filter((s) => this.world.inBounds(s.x, s.y)));
      this.swirlDawn = init.swirlDawn;
    }
    for (const k of init.kilns ?? []) {
      this.kilns.set(k.id, k);
      if (k.id >= this.nextKilnId) this.nextKilnId = k.id + 1;
    }
    for (const f of init.furniture ?? []) {
      this.furniture.set(f.id, f);
      if (f.id >= this.nextFurnitureId) this.nextFurnitureId = f.id + 1;
    }
    this.counters.load(init.counters);
    Object.assign(this.tally, init.tally ?? {});
    Object.assign(this.ledger, init.ledger ?? {});
    for (const id of init.ticked ?? []) this.ticked.add(id);
    this.guide.take(init.guide);
    for (const p of init.posts ?? []) {
      this.posts.set(p.id, p);
      this.placed.posts.add(p);
      if (p.id >= this.nextPostId) this.nextPostId = p.id + 1;
    }
    for (const t of init.traps ?? []) {
      this.traps.set(t.id, t);
      this.placed.traps.add(t);
      if (t.id >= this.nextTrapId) this.nextTrapId = t.id + 1;
    }
    if (init.nextTrapId) this.nextTrapId = Math.max(this.nextTrapId, init.nextTrapId);
    for (const b of init.bridges ?? []) {
      this.bridges.set(b.id, b);
      if (b.id >= this.nextBridgeId) this.nextBridgeId = b.id + 1;
    }
    if (init.nextBridgeId) this.nextBridgeId = Math.max(this.nextBridgeId, init.nextBridgeId);
    if (this.bridges.size) this.reindexDecks();
    for (const f of init.foundations ?? []) {
      this.foundations.set(f.id, f);
      this.slabIndex.set(`${f.x},${f.y}`, f.id);
      if (f.id >= this.nextFoundationId) this.nextFoundationId = f.id + 1;
    }
    if (init.nextFoundationId) this.nextFoundationId = Math.max(this.nextFoundationId, init.nextFoundationId);
    for (const s of init.smelters ?? []) {
      this.smelters.set(s.id, s);
      if (s.id >= this.nextSmelterId) this.nextSmelterId = s.id + 1;
    }
    for (const a of init.anvils ?? []) {
      this.anvils.set(a.id, a);
      if (a.id >= this.nextAnvilId) this.nextAnvilId = a.id + 1;
    }
    // Everything that came out of the save still has to be filed by tile.
    this.placed.crates.reset(this.crates.values());
    this.placed.campfires.reset(this.campfires.values());
    this.placed.smelters.reset(this.smelters.values());
    this.placed.kilns.reset(this.kilns.values());
    this.placed.furniture.reset(this.furniture.values());
    this.placed.anvils.reset(this.anvils.values());
    // Which beast is in which traces is the vehicle's business, so it is read
    // back off the vehicles rather than saved twice and left to disagree.
    for (const f of this.furniture.values()) {
      if (!f.team?.length) continue;
      f.team = f.team.filter((id) => this.creatures.get(id));
      for (const id of f.team) {
        const c = this.creatures.get(id);
        if (c) c.hitchedTo = f.id;
      }
      if (!f.team.length) f.driven = false;
    }
    this.springs = new Springs(this.world);
    // What the water sees of the foundations: a slab is a wall to it, and a pool dug in one is water.
    this.springs.slabs = (tx, ty) => {
      const f = this.foundations.size ? this.slabAt(tx, ty) : undefined;
      return f ? { top: f.top, pool: !!f.pool } : null;
    };
    this.springs.pools = () => [...this.foundations.values()].filter((f) => f.pool && foundationDone(f));
    // And the aqueducts, which carry it from one basin to another (`./aqueducts`).
    this.springs.channels = () => this.aqueductChannels();
    // Whose piers are walls to a pool's water, set out or built.
    this.springs.shut = () => aqueductShut([...this.bridges.values()].filter((b) => b.kind === 'aqueduct'));
    this.springs.load(init.springs);
    // Trellises kept from before one took the whole of a side of its tile, one to a row and the rest back in the pack (`vineyard.ts`).
    settleTrellises(this);
    this.vision = new Vision(this);
    this.world.onChange((x, y) => {
      // Felling a tree or raising a wall changes what can be seen past it.
      this.vision.invalidate();
      this.events.emit('world', x, y);
    });
  }

  giveStarterKit(): void {
    for (const [id, ql, made] of STARTER_KIT) this.inventory.add(id, { ql, issued: true, extra: made || undefined });
    this.inventory.add('deed_stake', { ql: 50, extra: 'Pine' });
  }

  /** Whether the player can stand on a tile at a storey: the ground, or a finished floor, staircase or ladder. */
  standable(x: number, y: number, level: number): boolean {
    // Down in a cellar there is the cellar's own floor to stand on, and nothing else.
    if (level < 0) return this.buildings.cellarDone(x, y);
    // A poured slab is the ground here: flat, dry and solid, over water or
    // bare rock or a hole, which is the whole of what it was poured for.
    if (level <= 0 && this.foundations.size && this.slabAt(x, y)) return true;
    if (!this.world.isPassable(x, y)) return false;
    // A tile on piers is its deck, and until the deck is built there is nothing there to stand on.
    if (level <= 0 && this.buildings.pierTiles.size && this.buildings.onPiers(x, y)) return this.pierDeckAt(x, y) !== null;
    if (level <= 0) return true;
    const f = this.buildings.floor(level, x, y);
    if (!f || !isDone(f)) return false;
    // A flat roof is a deck: you walk out onto it. A pitched one you do not.
    if (!walkableKind(floorKind(f))) return roofShapeDef(this.buildings.list.get(f.building)).walkable;
    return true;
  }

  /**
   * The storey a body at a tile a storey up stands on: its own where there is
   * something under it there, a floor or a bridge's deck or end at that storey,
   * and otherwise the highest under it that has, the ground at the least. The
   * island lets a body down by the same rule (`storey_footing`).
   */
  footing(x: number, y: number, level: number): number {
    for (let l = level; l > 0; l--) if (this.standsUp(x, y, l)) return l;
    return Math.min(level, 0);
  }

  /** Whether there is something to stand on at a tile a storey up: a finished floor, or a bridge's deck or end at that storey (`frame_stands`). */
  private standsUp(x: number, y: number, level: number): boolean {
    const f = this.buildings.floor(level, x, y);
    if (f && isDone(f) && (walkableKind(floorKind(f)) || roofShapeDef(this.buildings.list.get(f.building)).walkable)) return true;
    if (!this.bridges.size) return false;
    return [this.bridgeAt(x, y), this.bridgeEndAt(x, y)].some((b) => !!b && bridgeLevels(b).includes(level));
  }

  /** A finished staircase or ladder occupying a tile's floor slot at a storey. */
  private connector(x: number, y: number, level: number): boolean {
    const f = this.buildings.floor(level, x, y);
    return !!f && isDone(f) && connectsDown(floorKind(f));
  }

  /** A finished spiral staircase in a tile's floor slot at a storey: up to it from the storey under it, on its own tile. */
  spiralAt(x: number, y: number, level: number): boolean {
    const f = this.buildings.floor(level, x, y);
    return !!f && isDone(f) && isSpiral(f);
  }

  /**
   * The storeys a body standing on a tile at a storey goes to without leaving
   * it: up a finished spiral staircase going up from the storey, or down the
   * one it stands at the head of -- to the cellar too, down one let into the
   * ground floor (`flightDown`). On foot only: none mounted, driving or
   * afloat. A spiral staircase's tile is stepped onto and off at the storey
   * it is walked on (`step`), across any side, and these are the only ways
   * up and down it; spirals on the same tile a storey over a storey are one
   * stair. The island's `spiral_lift_ok` holds a body to the same.
   */
  readonly liftRule = (x: number, y: number, level: number): number[] => (this.driving() || this.mounted() ? [] : this.liftFree(x, y, level));

  /** The same with nothing under you, to say a way would be there on foot (`onFootTo`). */
  readonly liftFree = (x: number, y: number, level: number): number[] => {
    const out: number[] = [];
    if (!this.buildings.list.size) return out;
    if (level < 0) {
      const down = this.buildings.flightDown(x, y);
      if (down && isSpiral(down)) out.push(0);
      return out;
    }
    if (this.spiralAt(x, y, level + 1) && this.standable(x, y, level)) out.push(level + 1);
    if (level === 0) {
      const down = this.buildings.cellars.size ? this.buildings.flightDown(x, y) : undefined;
      if (down && isSpiral(down)) out.push(CELLAR_LEVEL);
    } else if (this.spiralAt(x, y, level) && this.standable(x, y, level - 1)) out.push(level - 1);
    return out;
  };

  /**
   * The one rule for moving between neighbouring tiles: stepping onto a
   * staircase or ladder from below takes you up a storey, stepping off one
   * can take you down, walls of the storey you cross on block you, and on
   * the ground cliffs do too. Returns the storey you arrive on or null.
   */
  readonly stepRule = (x0: number, y0: number, level: number, x1: number, y1: number): number | null => this.step(x0, y0, level, x1, y1, true);

  /**
   * The same rule with nothing in tow, which is asked only to say so when a
   * cart taken by the shafts is all that stops a walk into a cellar (`noWay`).
   */
  private readonly stepFree = (x0: number, y0: number, level: number, x1: number, y1: number): number | null => this.step(x0, y0, level, x1, y1, false);

  private step(x0: number, y0: number, level: number, x1: number, y1: number, tow: boolean): number | null {
    const b = this.buildings;
    // An aqueduct's piers stand on the ground between its tiles, along its run.
    if (level === 0 && this.bridges.size && this.pierBetween(x0, y0, x1, y1)) return null;
    if (b.cellars.size) {
      const under = this.cellarStep(x0, y0, level, x1, y1, tow);
      if (under !== undefined) return under;
    }
    // Onto a spiral staircase's tile at the storey you are on: up it is a climb on the tile (`liftRule`).
    if (this.connector(x1, y1, level + 1) && !b.blocksAt(level, x0, y0, x1, y1) && !(this.spiralAt(x1, y1, level + 1) && this.standable(x1, y1, level))) return level + 1;
    // Deck is ground: it is flat, and the drop under it is not your problem.
    if (this.bridges.size) {
      // Walked at the storey you are on: a ramp's at either of its ends' (`bridgeStepLevel`).
      const deck = this.bridgeStepLevel(x0, y0, x1, y1, level);
      // gates: and a wall on the border is still a wall, a portcullis let down among them (`gates.ts`): at the storey of the end it is on.
      if (deck !== null) return b.blocksAt(deck, x0, y0, x1, y1) ? null : deck;
    }
    if (this.standable(x1, y1, level) && !b.blocksAt(level, x0, y0, x1, y1)) {
      if (level === 0) {
        const deck = this.deckStep(x0, y0, x1, y1);
        if (deck !== null) return deck ? 0 : null;
        const slab = this.slabStep(x0, y0, x1, y1);
        if (slab !== null) return slab ? 0 : null;
        if (!groundStep(this.world, x0, y0, x1, y1, this.climbStep(), this.dropStep()) || !standsOn(this.world, x1, y1, this.standSlope())) return null;
      }
      return level;
    }
    // Off a flight down onto the storey under it; off a spiral staircase only at the storey it is walked on.
    if (level > 0 && this.connector(x0, y0, level) && !this.spiralAt(x0, y0, level) && this.standable(x1, y1, level - 1) && !b.blocksAt(level - 1, x0, y0, x1, y1)) {
      return level - 1;
    }
    return null;
  }

  /**
   * A step that has anything to do with a cellar, or undefined for one that
   * has not and is the ordinary rule's to decide.
   *
   * Down in the cellar you walk its floor and nothing else -- the ground round
   * it is its walls, and so is the ground between it and the cellar of the
   * building next door, so a corner is cut only where one of the two ways
   * round it is the same cellar too -- and a step onto the tile of a flight or
   * a ladder down, from its foot, is a step up it, to the ground floor; its
   * sides and its back are as solid as the ground. On the ground floor, a
   * step off such a tile across the side it is climbed from is a step down
   * it, onto the cellar tile at its foot; and nobody walks onto one from that
   * side up top, where the stairwell is open. Not with anything in tow: a
   * cart does not go down a flight. The island's `cellar_move_ok` holds a
   * body to the same.
   */
  private cellarStep(x0: number, y0: number, level: number, x1: number, y1: number, tow = true): number | null | undefined {
    const b = this.buildings;
    if (level < 0) {
      const own = b.cellar(x0, y0)?.building;
      if (!b.sameCellar(own, x1, y1)) return null;
      if (x1 !== x0 && y1 !== y0 && !b.sameCellar(own, x1, y0) && !b.sameCellar(own, x0, y1)) return null;
      const up = b.flightDown(x1, y1);
      // Under a spiral staircase, its foot: up it is a climb on the tile (`liftRule`).
      if (!up || isSpiral(up)) return CELLAR_LEVEL;
      return acrossSide(up.facing ?? 's', x1, y1, x0, y0) ? 0 : null;
    }
    if (level !== 0) return undefined;
    const from = b.flightDown(x0, y0);
    if (from && !isSpiral(from) && acrossSide(from.facing ?? 's', x0, y0, x1, y1)) {
      if (!b.sameCellar(from.building, x1, y1)) return null;
      if (tow) for (const f of this.furniture.values()) if (f.hitched) return null;
      return CELLAR_LEVEL;
    }
    const onto = b.flightDown(x1, y1);
    if (onto && !isSpiral(onto) && acrossSide(onto.facing ?? 's', x1, y1, x0, y0)) return null;
    return undefined;
  }

  /**
   * The rule for driving rather than walking. Wheels keep to the open ground:
   * no fords, no stairs, no climbing anything a horse would baulk at.
   */
  readonly driveRule = (x0: number, y0: number, level: number, x1: number, y1: number): number | null => {
    // Up a wide staircase, from its foot, onto the storey over the one you are on (`wideFlightUp`).
    const up = this.wideFlightUp(x0, y0, level, x1, y1);
    if (up !== undefined) return up;
    // Up there, on the building's own floors (`driveStorey`).
    if (level > 0) return this.driveStorey(x0, y0, level, x1, y1);
    if (level !== 0) return null;
    // A deck on piers takes feet, not wheels (`pier_step`).
    if (this.buildings.pierTiles.size && this.buildings.onPiers(x1, y1)) return null;
    if (this.bridges.size && this.pierBetween(x0, y0, x1, y1)) return null;
    // Onto a bridge's end, any lane's, as onto its deck: only wheels that may cross it, as the island's `deck_wheels` has it.
    if (this.bridges.size) {
      const end = this.bridgeEndAt(x1, y1);
      if (end && end.kind !== 'aqueduct' && deckDown(end) && (!bridgeWheels(end, this.driving()?.kind ?? 'cart') || end.level || end.levelB)) return null;
    }
    // A material bridge carries wheels, a wagon from `WAGON_WIDTH` lanes; a rope bridge does not.
    if (this.bridges.size && this.bridgeStep(x0, y0, x1, y1)) {
      const b = this.bridgeAt(x1, y1) ?? this.bridgeAt(x0, y0);
      // A wagon only on a bridge `WAGON_WIDTH` lanes wide (`bridgeWheels`).
      if (!b || !bridgeWheels(b, this.driving()?.kind ?? 'cart')) return null;
      // A walkway between two upper storeys is a walkway, and so is a ramp up to one. Nobody drives it.
      if (b.level || b.levelB) return null;
      // Coming off the deck onto the bank: the bank still has to take wheels.
      if (!this.bridgeAt(x1, y1) && !this.vehicleGround(x1, y1)) return null;
      // gates: and through a gateway wide enough, as off any other ground (`gates.ts`).
      if (this.buildings.blocksVehicle(x0, y0, x1, y1)) return null;
      return 0;
    }
    if (!this.vehicleGround(x1, y1)) return null;
    // A flight of garden steps is climbed, not driven: no wheel takes one.
    if (this.world.getTile(x1, y1) === TileType.Steps) return null;
    // A door is for a person. Wheels want a double door, an archway or a gate.
    if (this.buildings.blocksVehicle(x0, y0, x1, y1)) return null;
    // And a staircase or a ladder going up from the tile is no road, nor the stairwell of one going down.
    if (this.connector(x1, y1, 1)) return null;
    if (this.buildings.cellars.size && this.buildings.flightDown(x1, y1)) return null;
    // Wheels get the bare cap: no team makes a cart stand on a wall.
    return groundStep(this.world, x0, y0, x1, y1, this.vehicleStep(this.driving())) && standsOn(this.world, x1, y1) ? 0 : null;
  };

  /** A finished wide staircase in a tile's floor slot at a storey: the one wheels take. A single one is too narrow for them. */
  private wideFlight(x: number, y: number, level: number): FloorTile | undefined {
    const f = this.buildings.floor(level, x, y);
    return f && isDone(f) && floorKind(f) === 'stairs' && !f.hand ? f : undefined;
  }

  /**
   * A step onto a wide staircase going up from the storey you are on: taken
   * from its foot, the side it is climbed from, through a doorway wide enough
   * for wheels, it is the storey over this one; from any other side it is its
   * rails, and nothing on wheels goes over them. Undefined where no wide
   * flight goes up from the tile.
   */
  private wideFlightUp(x0: number, y0: number, level: number, x1: number, y1: number, hooves = false): number | null | undefined {
    if (level < 0) return undefined;
    const f = this.wideFlight(x1, y1, level + 1);
    if (!f) return undefined;
    if (!acrossSide(f.facing ?? 's', x1, y1, x0, y0)) return null;
    if (hooves ? this.mountBlocks(x0, y0, x1, y1, level) : this.buildings.blocksVehicle(x0, y0, x1, y1, level)) return null;
    // From the ground, the ground it is driven off still has to take wheels.
    if (!hooves && level === 0 && !this.vehicleGround(x0, y0)) return null;
    return level + 1;
  }

  /**
   * Driving a storey up. Wheels go on the building's finished floors and its
   * wide staircases and on nothing else -- not a roof, a ladder's hatch or a
   * single staircase -- and through its doorways only where they are wide
   * enough, as on the ground. On a wide staircase you go on off its head, or
   * back down off its foot onto the storey under it; never over its rails.
   * A mount goes the same way, through the doorways it takes (`mountBlocks`).
   */
  private driveStorey(x0: number, y0: number, level: number, x1: number, y1: number, hooves = false): number | null {
    const b = this.buildings;
    const blocks = (fx: number, fy: number, tx: number, ty: number, at: number): boolean =>
      hooves ? this.mountBlocks(fx, fy, tx, ty, at) : b.blocksVehicle(fx, fy, tx, ty, at);
    const here = this.wideFlight(x0, y0, level);
    if (here) {
      const facing = here.facing ?? 's';
      if (acrossSide(facing, x0, y0, x1, y1)) {
        const below = level - 1;
        if (below === 0) return (hooves ? this.rideRule : this.driveRule)(x0, y0, 0, x1, y1) === 0 ? 0 : null;
        if (blocks(x0, y0, x1, y1, below)) return null;
        return this.floorTakesWheels(x1, y1, below) ? below : null;
      }
      if (!acrossSide(OPPOSITE_SIDE[facing], x0, y0, x1, y1)) return null;
    }
    if (blocks(x0, y0, x1, y1, level)) return null;
    // No wheels or hooves on a spiral staircase's tile, at its foot or its head (`SPIRAL_FOOT_SAID`).
    if (this.spiralAt(x1, y1, level + 1)) return null;
    const there = this.wideFlight(x1, y1, level);
    if (there) return acrossSide(OPPOSITE_SIDE[there.facing ?? 's'], x1, y1, x0, y0) ? level : null;
    return this.floorTakesWheels(x1, y1, level) ? level : null;
  }

  /** Whether a tile's floor at a storey takes wheels: a finished floor, and not a roof, a staircase or a ladder. */
  private floorTakesWheels(x: number, y: number, level: number): boolean {
    const f = this.buildings.floor(level, x, y);
    return !!f && isDone(f) && floorKind(f) === 'floor';
  }

  /**
   * Whether a wall stops a mount between two tiles at a storey, the ground floor too: what stops
   * wheels (`blocksVehicle`: only an arch, a double door or a gate is wide
   * enough), and an iron-bound gate, which swings for a person only.
   */
  private mountBlocks(x0: number, y0: number, x1: number, y1: number, level: number): boolean {
    return this.buildings.blocksVehicle(x0, y0, x1, y1, level) || this.buildings.blocksAt(level, x0, y0, x1, y1, true);
  }

  /**
   * The rule for riding. A mount takes a slope a walker would balk at, the
   * better the further it has been worked, but it will not swim. Indoors and
   * up a building it goes where wheels go (`driveRule`): through a doorway
   * wide enough (`mountBlocks`), up a finished wide staircase from its foot
   * (`wideFlightUp`) and on the finished floors of a storey (`driveStorey`);
   * never up a single staircase or a ladder.
   */
  readonly rideRule = (x0: number, y0: number, level: number, x1: number, y1: number): number | null => {
    const up = this.mounted();
    if (!up || level < 0) return null;
    // Up a wide staircase, from its foot, onto the storey over the one you are on (`wideFlightUp`).
    const flight = this.wideFlightUp(x0, y0, level, x1, y1, true);
    if (flight !== undefined) return flight;
    // Up there, on the building's own floors (`driveStorey`).
    if (level > 0) return this.driveStorey(x0, y0, level, x1, y1, true);
    if (!this.world.inBounds(x1, y1) || !this.world.isPassable(x1, y1)) return null;
    // A deck on piers takes feet, not hooves (`pier_step`).
    if (this.buildings.pierTiles.size && this.buildings.onPiers(x1, y1)) return null;
    if (this.bridges.size && this.pierBetween(x0, y0, x1, y1)) return null;
    // Only the web-footed sort will take a rider into deep water.
    if (!this.creatures.species(up).swims && this.world.bedAt(x1 + 0.5, y1 + 0.5) < this.world.surfaceAt(x1, y1) - SWIM_DEPTH) return null;
    // Through a doorway wide enough, as wheels go (`mountBlocks`).
    if (this.mountBlocks(x0, y0, x1, y1, 0)) return null;
    // And a staircase or a ladder going up from the tile is no way for hooves but a wide one from its foot (`wideFlightUp`).
    if (this.connector(x1, y1, 1)) return null;
    // Nor over the open stairwell of a flight down to a cellar.
    if (this.buildings.cellars.size && this.buildings.flightDown(x1, y1)) return null;
    return groundStep(this.world, x0, y0, x1, y1, this.mountStep(up)) && standsOn(this.world, x1, y1, this.mountStand(up)) ? 0 : null;
  };

  /**
   * The rule for being afloat. A hull goes where there is water enough under
   * it and nowhere else: no beaching, no dragging it over a sandbar, and
   * nothing indoors.
   */
  readonly sailRule = (x0: number, y0: number, level: number, x1: number, y1: number): number | null => {
    const boat = this.afloat();
    if (!boat || level !== 0) return null;
    if (this.bridges.size && this.pierBetween(x0, y0, x1, y1)) return null;
    const def = furnitureDef(boat.kind).boat;
    if (!def || !this.world.inBounds(x1, y1)) return null;
    // No hull goes in under a deck on piers, among its posts (`pier_step`).
    if (this.buildings.pierTiles.size && this.buildings.onPiers(x1, y1)) return null;
    return -this.world.centerHeight(x1, y1) >= def.draught ? 0 : null;
  };

  /** The boat the player is sitting in, if any. */
  afloat(): PlacedFurniture | undefined {
    const f = this.driving();
    return f && isBoat(f) ? f : undefined;
  }

  /** The wind at this hour, worked out from the clock rather than stored. */
  wind(): Wind {
    // The island's clock when there is one, so the wind Read the Sky says is the wind a sail gets.
    const w = windAt(this.seed, this.islandClock ? this.islandClock() : this.time);
    // A fair wind is still the weather; it has only been asked to oblige.
    if (this.time < this.favourWind) return { dir: this.heading(), force: Math.max(0.62, w.force) };
    return w;
  }

  /** Where the player is pointed, in the same radians the wind uses. */
  heading(): number {
    const p = this.player;
    return Math.atan2(p.dirY, p.dirX);
  }

  /**
   * How fast the hull goes: the build, the arms behind it, and — under sail —
   * the weather and the angle you are holding to it.
   */
  boatSpeed(f: PlacedFurniture): number {
    const def = furnitureDef(f.kind).boat;
    if (!def) return 0;
    // Oars are worked by the body; a sail is worked by the weather, and the
    // best you can do is hold the angle that suits her.
    const body = this.skills.get(def.sail ? 'body_control' : 'body_strength');
    const weather = def.sail ? sailFactor(this.heading(), this.wind()) : 1;
    // What is in the hold rides on the hull, and the hull feels it: a boat
    // loaded to her marks is `BOAT_LOAD_DRAG` slower than one running empty.
    const heft = furnitureHeft(f);
    const cap = furnitureCapacity(f);
    const load = heft ? Math.min(1, furnitureKg(f) / heft) : cap ? Math.min(1, furnitureUnits(f) / cap) : 0;
    // And her builder's hand in her, for a hull a Carpenter laid the keel of,
    // and the hand at her helm: Sailing (`sailingPace`).
    // And a Fair Wind set into her, on every point of sail (`enchanting.ts`), which only a boat with a sail takes.
    return hullSpeed(def, f.ql, body, weather, load) * markOf(f, 'speed') * sailingPace(this.skills.get(SAILING)) * (1 + swingEnchant(f, 'sail'));
  }

  /**
   * Whether a pick of a moved path is yours (`meditation.ts`): taken, and of
   * the path you walk. On an island the island says which you hold
   * (`setPath`); by yourself they are in your save.
   */
  holds(pick: string): boolean {
    const p = PATH_PICK_BY_ID.get(pick);
    return !!p && this.player.way === p.path && PATHS[p.path].moved && this.player.picks.includes(pick);
  }

  /** One number off the disciplines you hold, by its key, or the rule's own when none of them has it. */
  pathFx(key: string, otherwise: number): number {
    for (const id of this.player.picks) {
      const p = PATH_PICK_BY_ID.get(id);
      if (p?.kind === 'discipline' && key in p.fx && this.holds(id)) return p.fx[key];
    }
    return otherwise;
  }

  /**
   * What keeping a beast comes to offline: your perks' (a Herdsman's), and
   * your path's `kept:` disciplines (Love's Kin), as the island's `kept_of`
   * puts them together.
   */
  refreshKept(): void {
    const path: Record<string, number> = {};
    for (const id of this.player.picks) {
      const k = PATH_PICK_BY_ID.get(id);
      if (k?.kind !== 'discipline' || !this.holds(id)) continue;
      for (const [key, v] of Object.entries(k.fx)) if (key.startsWith('kept:') && !(key in path)) path[key] = v;
    }
    setLocalKept({ ...this.perkFx, ...path });
  }

  /** Whether a technique's spell is still running on you: `herd`, `lungs`, `surge` or `unbroken` (`Player.pathTimes`). */
  pathHolds(what: 'herd' | 'lungs' | 'surge' | 'unbroken'): boolean {
    return (this.player.pathTimes[what] ?? -1e9) > this.time;
  }

  /**
   * What a Heart of the Herd makes of a blow on or by a creature: `taken` the
   * share of one on it that lands, `dealt` what one it strikes is worth. Your
   * companion only, within the technique's reach of you, while it holds; one
   * everywhere else. The island's `herd_heart`.
   */
  herdMul(c: Creature, way: 'taken' | 'dealt'): number {
    if (c.mode !== 'active' || c.mine === false || !this.pathHolds('herd')) return 1;
    const k = PATH_PICK_BY_ID.get('love_herd_heart');
    if (!k || Math.hypot(c.x - this.player.x, c.y - this.player.y) > k.fx.reach) return 1;
    return way === 'taken' ? 1 - k.fx.cut : 1 + k.fx.more;
  }

  /** The most Calm you can hold, with a Deep Calm's more. */
  calmCap(): number {
    return calmCap(this.skills.get(MEDITATION), this.pathFx('calm', 1));
  }

  /** Note where you sat, for the next sitting near it (`SIT_WORTH.stale`): the spots kept until the woods turn. */
  satHere(): void {
    const dawn = lastDawn(Date.now() / 1000);
    const p = this.player;
    p.satSpots = [...satSince(p.satSpots, p.satDawn, dawn).map(([x, y]): [number, number] => [x, y]), [p.tileX, p.tileY]];
    p.satDawn = dawn;
  }

  /**
   * What a technique leaves on the map: the swirl Seek found and the hoard
   * Trace found, until the one is collected and the other dug up. On an island
   * the island says where they are on every beat (`setPath`); by yourself they
   * are looked for again each time they are drawn.
   */
  pathMarks: { seek?: { x: number; y: number }; trace?: { x: number; y: number } } = {};
  /** Whether the island says what the marks are. */
  islandMarks = false;
  /** Seek's swirl and Trace's hoard by the id they were found by, playing by yourself. */
  private pathFound: { seek?: number; trace?: number } = {};

  /** The marks as they stand: by yourself, only the ones whose swirl or hoard is still there. */
  marksNow(): Array<{ kind: 'seek' | 'trace'; x: number; y: number }> {
    if (!this.islandMarks) {
      const s = this.pathFound.seek !== undefined ? this.swirls.get(this.pathFound.seek) : undefined;
      this.pathMarks.seek = s ? { x: s.x, y: s.y } : undefined;
      const h = this.pathFound.trace !== undefined ? this.hoards.find((k) => k.uid === this.pathFound.trace) : undefined;
      this.pathMarks.trace = h ? { x: h.x, y: h.y } : undefined;
    }
    const out: Array<{ kind: 'seek' | 'trace'; x: number; y: number }> = [];
    if (this.pathMarks.seek) out.push({ kind: 'seek', ...this.pathMarks.seek });
    if (this.pathMarks.trace) out.push({ kind: 'trace', ...this.pathMarks.trace });
    return out;
  }

  /** Your path as the Faith window draws it, worked out here: the island's `faith_said` `path` when there is one. */
  pathSaid(): PathSaid {
    const p = this.player;
    const med = this.skills.get(MEDITATION);
    const mine = p.way ? PATH_PICKS.filter((k) => k.path === p.way) : [];
    return {
      way: p.way,
      meditation: med,
      calm: Math.floor(p.calm),
      cap: Math.floor(this.calmCap()),
      taken: [...p.picks],
      picks: Object.fromEntries(mine.map((k) => [k.id, pathPickRefusal(k, p.way, p.picks, med)])),
    };
  }

  /** Take a pick of your path, playing by yourself: refused in the island's words, or null. */
  takePathPick(id: string): string | null {
    const k = PATH_PICK_BY_ID.get(id);
    if (!k) return 'No such pick.';
    const why = pathPickRefusal(k, this.player.way, this.player.picks, this.skills.get(MEDITATION));
    if (why) return why;
    this.player.picks = [...this.player.picks, id];
    this.refreshKept();
    this.note('path');
    this.logMsg(tookSaid(k), 'system');
    this.events.emit('skill', '', 0);
    return null;
  }

  /** Seconds before a technique can be called again, playing by yourself. */
  techniqueRest(id: string): number {
    const k = PATH_PICK_BY_ID.get(id);
    return k ? Math.max(0, (this.player.usedAt[`spell:${id}`] ?? -1e9) + k.rest - this.time) : 0;
  }

  /**
   * Why a technique cannot be called now, or null: not yours, resting, or
   * short of Calm, in the island's words (`spell_cast_refusal`).
   */
  techniqueRefusal(id: string): string | null {
    const k = PATH_PICK_BY_ID.get(id);
    if (!k || k.kind !== 'technique' || !this.holds(id)) return 'Spell not known.';
    const left = Math.ceil(this.techniqueRest(id));
    if (left > 0) return `${k.name}: cooldown ${left} s.`;
    if (this.player.calm < k.cost) return calmRefusal(k.name, k.cost, this.player.calm);
    return null;
  }

  /**
   * Call a technique, playing by yourself: on an island it is the spell bar's
   * (`rpc_cast_spell`). Null, or why it did nothing -- a Seek or a Trace that
   * finds nothing is refused, and costs nothing.
   */
  castTechnique(id: string): string | null {
    const why = this.techniqueRefusal(id);
    if (why) return why;
    const k = PATH_PICK_BY_ID.get(id);
    if (!k) return 'Spell not known.';
    const done = this.workTechnique(k.id, k.fx);
    if ('why' in done) return done.why;
    this.player.calm = Math.max(0, this.player.calm - k.cost);
    this.player.usedAt[`spell:${id}`] = this.time;
    // And meditation, as an ability of a path on its steps teaches it.
    this.gainSkill(MEDITATION, TECHNIQUE_GAIN);
    this.note(`cast:${id}`);
    this.logMsg(done.said, 'system');
    this.events.emit('skill', '', 0);
    return null;
  }

  /** What a technique does, playing by yourself. The island's `path_technique_cast` does the same. */
  private workTechnique(id: string, fx: Readonly<Record<string, number>>): { said: string } | { why: string } {
    const p = this.player;
    switch (id) {
      case 'knowledge_seek': {
        let best: { id: number; element: string; d: number } | null = null;
        for (const s of this.swirls.values()) {
          const d = Math.hypot(s.x - p.tileX, s.y - p.tileY);
          if (d <= fx.reach && (!best || d < best.d || (d === best.d && s.id < best.id))) best = { id: s.id, element: s.element, d };
        }
        if (!best) return { why: seekNone(fx.reach) };
        this.pathFound.seek = best.id;
        return { said: seekSaid(best.element, Math.round(best.d)) };
      }
      case 'knowledge_sky':
        return { said: skySaid(this.seed, this.islandClock ? this.islandClock() : this.time, fx.hours) };
      case 'knowledge_trace': {
        const carried = new Set(this.inventory.items.filter((it) => it.id === 'treasure_map').map((it) => it.uid));
        let best: { uid: number; d: number } | null = null;
        for (const h of this.hoards) {
          if (!carried.has(h.uid)) continue;
          const d = Math.hypot(h.x - p.tileX, h.y - p.tileY);
          if (d <= fx.reach && (!best || d < best.d || (d === best.d && h.uid < best.uid))) best = { uid: h.uid, d };
        }
        if (!best) return { why: traceNone(fx.reach) };
        this.pathFound.trace = best.uid;
        return { said: traceSaid(Math.round(best.d)) };
      }
      case 'knowledge_foreknow':
        p.foreknow = fx.goes;
        return { said: foreknowSaid(fx.goes) };
      case 'knowledge_clarity':
        p.clarityUntil = this.time + fx.secs;
        return { said: claritySaid(fx.secs, fx.more) };
      case 'love_refresh':
        p.stats.hunger = 1;
        p.stats.thirst = 1;
        return { said: REFRESH_SAID };
      case 'love_bond': {
        const c = this.creatures.active();
        if (!c || Math.hypot(c.x - p.x, c.y - p.y) > fx.reach) return { why: bondNone(fx.reach) };
        const most = maxHealth(c, this.creatures.species(c));
        if (c.health >= most) return { why: bondWhole(c.name) };
        c.health = Math.min(most, c.health + most * fx.heal);
        this.events.emit('creature');
        return { said: bondSaid(c.name, fx.heal) };
      }
      case 'love_gather': {
        // Yours that can come: not in the traces, not under you, not held in a trap; nearest id first, as the island orders them.
        const near = this.creatures.yours()
          .filter((c) => (c.mode === 'active' || c.mode === 'deed') && c.hitchedTo === null && !c.ridden && c.trapped === null
            && Math.hypot(c.x - p.x, c.y - p.y) <= fx.reach)
          .sort((a, b) => a.id - b.id);
        if (!near.length) return { why: gatherNone(fx.reach) };
        near.forEach((c, i) => {
          const [x, y] = gatherSpot(p.x, p.y, i, near.length);
          c.x = x;
          c.y = y;
          c.tx = x;
          c.ty = y;
          c.state = 'idle';
          c.until = this.time;
          c.enemy = null;
        });
        this.events.emit('creature');
        return { said: gatherSaid(near.length, near[0].name) };
      }
      case 'love_lull': {
        const on = [...this.creatures.list.values()].filter((c) => c.mode === 'wild' && c.health > 0 && c.enemy === PLAYER_ATTACKER
          && Math.hypot(c.x - p.x, c.y - p.y) <= fx.reach);
        if (!on.length) return { why: lullNone(fx.reach) };
        for (const c of on) {
          c.enemy = null;
          c.windup = 0;
          c.huntRest = this.time + fx.secs;
          c.state = 'idle';
          c.until = this.time;
        }
        return { said: lullSaid(on.length, fx.secs) };
      }
      case 'love_herd_heart': {
        const c = this.creatures.active();
        if (!c) return { why: HERD_NONE };
        p.pathTimes.herd = this.time + fx.secs;
        return { said: herdSaid(c.name, fx.secs, fx.cut, fx.more, fx.reach) };
      }
      case 'power_second_wind':
        p.stats.stamina = 1;
        return { said: SECOND_WIND_SAID };
      case 'power_deep_lungs':
        p.pathTimes.lungs = this.time + fx.secs;
        return { said: deepLungsSaid(fx.secs) };
      case 'power_shrug': {
        const on = p.wounds.filter((w) => w.bleeding || (w.venom ?? 0) > 0);
        if (!on.length) return { why: SHRUG_NONE };
        for (const w of on) {
          w.bleeding = false;
          delete w.venom;
        }
        return { said: SHRUG_SAID };
      }
      case 'power_surge':
        p.pathTimes.surge = this.time + fx.secs;
        return { said: surgeSaid(fx.secs, fx.pace) };
      case 'power_unbroken':
        p.pathTimes.unbroken = this.time + fx.secs;
        return { said: unbrokenSaid(fx.secs) };
      default:
        return { why: 'Spell has no effect yet.' };
    }
  }

  /**
   * What the island says of your path on the beat (`rpc_settle`'s `path`):
   * the picks you hold, Calm, a Foreknow's goes and a Clarity's seconds left,
   * the spots you have sat at since the woods turned, and the marks.
   */
  setPath(said: PathBeat): void {
    const p = this.player;
    /*
     * The path only when it has moved. A path still on its steps is the
     * island's to work out, and always was: the browser on an island never
     * knew it, and the steps it reads here -- a back that carries more, a hide
     * that turns more -- would be a second opinion the island does not share.
     */
    p.way = said.way && PATHS[said.way]?.moved ? said.way : null;
    p.picks = said.picks ?? [];
    p.calm = said.calm ?? 0;
    p.foreknow = said.foreknow ?? 0;
    p.clarityUntil = this.time + (said.clarity ?? 0);
    p.satSpots = said.sat ?? [];
    p.satDawn = lastDawn(Date.now() / 1000);
    p.studied = said.studied ?? {};
    // What Love's and Power's techniques left running, and when a Hard to Kill is ready again, as seconds from now.
    const until = (secs: number | undefined): number => this.time + (secs ?? 0);
    p.pathTimes = {
      ...p.pathTimes,
      herd: until(said.herd), lungs: until(said.lungs), surge: until(said.surge), unbroken: until(said.unbroken),
      killed: said.hardToKill ? this.time + said.hardToKill - (PATH_PICK_BY_ID.get('power_hard_to_kill')?.fx.every ?? 0) : -1e9,
    };
    this.islandMarks = true;
    this.pathMarks = { seek: said.seek ?? undefined, trace: said.trace ?? undefined };
    this.events.emit('skill', '', 0);
  }

  /** Work one of the abilities a path on its steps opens: none now, every path having moved onto tiers. */
  workAbility(_id: string): string {
    return 'Nothing happens.';
  }

  /**
   * Bring every crop on the settlement on one stage, and say how many: the
   * fields, and the planters standing on it. Each begins its new stage now,
   * on the clock it grows on.
   */
  hastenCrops(): number {
    let n = 0;
    for (const crop of [...this.crops.values(), ...this.planted.values()]) {
      if (!this.onDeed(crop.x, crop.y)) continue;
      if (crop.stage >= RIPE) continue;
      crop.stage += 1;
      crop.stageAt = this.growNow(crop);
      crop.tendedNow = false;
      this.events.emit('world', crop.x, crop.y);
      n++;
    }
    return n;
  }

  /** What the wind is doing, and what the hull under you makes of it. */
  sailNote(): string {
    const w = this.wind();
    const from = `${windWord(w.force)} out of the ${windFrom(w)}`;
    const boat = this.afloat();
    const def = boat && furnitureDef(boat.kind).boat;
    if (!def?.sail) return from;
    return `${from} \u00b7 ${sailWord(this.heading(), w)}`;
  }

  /** Water deep enough to float this hull, near where the player is standing. */
  launchSpot(kind: string, x: number, y: number): boolean {
    const def = furnitureDef(kind).boat;
    // And never in under a deck on piers (`launch_spot`).
    return !!def && this.world.inBounds(x, y) && -this.world.centerHeight(x, y) >= def.draught
      && !(this.buildings.pierTiles.size > 0 && this.buildings.onPiers(x, y));
  }

  /**
   * Whether the player stands at a flight or a ladder down to a cellar: on its
   * tile up top, or on the tile at its foot down there; or on a spiral
   * staircase's tile, at its foot or its head, at any storey. Those two are said to
   * the island the moment they are stepped onto (`Island.move`), because it
   * lets a body change storey only off the one onto the other.
   */
  atStairs(): boolean {
    const b = this.buildings;
    const { tileX: x, tileY: y, level } = this.player;
    // On a spiral staircase's tile, at its foot or its head: the island takes a storey up or down it on its tile only (`spiral_lift_ok`).
    if (level >= 0 && b.list.size && (this.spiralAt(x, y, level) || this.spiralAt(x, y, level + 1))) return true;
    if (!b.cellars.size) return false;
    if (level === 0) return !!b.flightDown(x, y);
    if (level > 0) return false;
    // Under a spiral staircase down to the cellar, at its foot.
    if (isSpiral(b.flightDown(x, y))) return true;
    for (const [dx, dy, side] of [[0, -1, 's'], [1, 0, 'w'], [0, 1, 'n'], [-1, 0, 'e']] as Array<[number, number, Side]>) {
      const f = b.flightDown(x + dx, y + dy);
      if (f && (f.facing ?? 's') === side) return true;
    }
    return false;
  }

  /** The building whose cellar the player is down in, or undefined up top. */
  myCellar(): number | undefined {
    return this.player.level < 0 ? this.buildings.cellar(this.player.tileX, this.player.tileY)?.building : undefined;
  }

  /**
   * Whether the view is down in a cellar: the storey control put on the
   * cellar, or, following you, you down in one. Never where there is none.
   */
  cellarView(): boolean {
    if (!this.buildings.cellars.size) return false;
    return floorOf(this.settings.viewLevel ?? this.player.level) < 0;
  }

  /**
   * The storey a walk to a clicked tile aims at, when it matters: the cellar
   * when it is the cellar you are looking at, up top when you are down in one
   * and looking up top, and otherwise wherever the walk arrives first.
   */
  walkFloor(x: number, y: number): number | undefined {
    if (!this.buildings.cellars.size) return undefined;
    const view = floorOf(this.settings.viewLevel ?? this.player.level);
    if (view < 0) return this.buildings.cellarDone(x, y) ? CELLAR_LEVEL : undefined;
    return this.player.level < 0 ? 0 : undefined;
  }

  /**
   * The storey pinned on the storey control (`storeyview.ts`): every other
   * storey hidden, clicks and walks on this one. Null on Auto, and looking
   * into a cellar, which is its own view (`cellarView`).
   */
  pinnedStorey(): number | null {
    const v = this.settings.viewLevel;
    return v !== null && v >= 0 ? v : null;
  }

  /**
   * The storey of a building that menus, hover lines and markers are for:
   * the pinned one, as far as the building goes, and on Auto the one being
   * worked (`workLevel`).
   */
  storeyFor(b: Building): number {
    const pinned = this.pinnedStorey();
    return pinned === null ? workLevel(b) : Math.max(0, Math.min(pinned, b.levels - 1));
  }

  /** How the player may move right now, how many storeys they may cross, and how many under the ground (a cellar). */
  movement(): { rule: (x0: number, y0: number, level: number, x1: number, y1: number) => number | null; levels: number; below: number; lift?: LiftRule } {
    if (this.afloat()) return { rule: this.sailRule, levels: 1, below: 0 };
    // Wheels go up wide staircases, so a drive crosses storeys as a walk does (`driveStorey`).
    if (this.driving()) return { rule: this.driveRule, levels: TOP_LEVELS, below: 0 };
    // And a mount goes up wide staircases as wheels do (`rideRule`).
    if (this.mounted()) return { rule: this.rideRule, levels: TOP_LEVELS, below: 0 };
    // On foot, up and down spiral staircases on their own tiles as well (`liftRule`).
    return { rule: this.stepRule, levels: TOP_LEVELS, below: this.buildings.cellars.size ? -CELLAR_LEVEL : 0, lift: this.liftRule };
  }

  /**
   * Whether the player is on the ground under a bridge's deck rather than on
   * it: walked in under it from beside it, and still under it. A body on a
   * tile of deck is on the deck unless it came in under it (`walksUnder`).
   * What is drawn and where the feet are, nothing more: a walk is the same
   * either way.
   */
  underDeck = false;

  /** Whether a step from one tile to the next leaves the player under a bridge's deck. */
  walksUnder(x0: number, y0: number, x1: number, y1: number): boolean {
    return this.underAfter(x0, y0, x1, y1, this.underDeck);
  }

  /** Whether a step from one tile to the next leaves a body under a bridge's deck, it having been under one before it (`was`) or not. */
  underAfter(x0: number, y0: number, x1: number, y1: number, was: boolean): boolean {
    if (!this.onWalkedDeck(x1, y1)) return false;
    const b = this.bridgeAt(x1, y1);
    // From a tile of the same deck, as it was; from one of its ends, onto it; from anywhere else, in under it.
    if (b && this.bridgeAt(x0, y0) === b) return was;
    return !(b && this.onBridge(b, x0, y0));
  }

  /** Height of the player's feet, storeys included: in a building on piers, from its deck. */
  playerHeight(): number {
    // Out on a jetty the floor is the building's, whatever the ground under it does (`jettyBase`).
    const p = this.player;
    const jetty = p.level > 0 && this.buildings.jettyAt(p.tileX, p.tileY);
    const base = jetty ? jettyBase(this, jetty, p.tileX, p.tileY) : this.deckBase(p.tileX, p.tileY, p.level);
    // On a bridge's deck, at its height there, up a ramp's slope too, as the body is drawn (`deckHeightAt`).
    const deck = base === null && this.bridges.size && !this.afloat() && !this.underDeck ? this.deckHeightAt(p.x, p.y) : null;
    if (deck !== null) return deck;
    return (base ?? this.world.heightAt(p.x, p.y)) + p.visualLevel * 30;
  }

  /**
   * What a body on a tile at a storey stands on, storeys not counted, in a
   * building that stands on piers: its deck, on every storey of every tile of
   * it -- a tile of level ground in it is at the deck's height anyway -- and
   * on the ground floor of a tile on piers only once the deck there is built.
   * Null everywhere else, where the ground is what a body stands on.
   */
  deckBase(x: number, y: number, level: number): number | null {
    if (!this.buildings.pierTiles.size) return null;
    const b = this.buildings.buildingAt(x, y);
    if (b?.deck == null) return null;
    if (level > 0 || !this.buildings.onPiers(x, y)) return b.deck;
    return this.pierDeckAt(x, y);
  }

  /**
   * Whose border you are standing in, when it is not your own.
   *
   * Drawn, and used to say why the ground will not take a building — never to
   * light anything, which is the whole distinction this pair exists for.
   */
  neighbourDeeds: Array<{ name: string; x: number; y: number; radius: number; level: number; holder: string | null; mine?: boolean; role?: DeedRole; rank?: string; perms?: number }> = [];

  /**
   * Everybody else ashore, as of the last slow read.
   *
   * Only those with an `x` on them can be drawn, and whether anybody has one
   * is the island's call rather than this machine's: while fewer than
   * `CROWD_HIDES` are about it says where everybody is, and after that it says
   * where your friends are and no more.
   */
  folkAshore: Array<{ uid: string; name: string; online: boolean; x?: number; y?: number }> = [];

  /**
   * The neighbour whose settlement covers this tile, if one does.
   *
   * It carries everything the island sent about it — the founder's name, the
   * level, what you are on it — rather than the two fields it used to narrow
   * to, so a stranger's land can be read from outside instead of being a
   * green border you find the edges of by being refused.
   */
  deedAt(x: number, y: number): Game['neighbourDeeds'][number] | null {
    for (const d of this.neighbourDeeds) {
      if (Math.abs(x - d.x) <= d.radius && Math.abs(y - d.y) <= d.radius) return d;
    }
    return null;
  }

  /**
   * Every settlement this body may work: its own, and any it was asked into.
   *
   * The island has held a list since citizens landed — `deeds_of` is founder
   * first, citizen otherwise, and `deed_here` asks it about a tile. This
   * browser held one deed and one only: `ground.deed` is `my_deed`, which is
   * the *first* of that list. For anybody who founded a stake of their own and
   * was then asked onto somebody else's, the one it held was their own, and
   * every rule that asked "is this my land" said no while standing in the
   * middle of the settlement they are a citizen of. Reported from the island:
   * "i'm a citizen of your deed but i'm unable to place down a smelter."
   *
   * `ground.deeds` has carried the rest all along, each marked `mine` — it was
   * drawn on the map and read by nothing else.
   */
  myDeeds(): Deed[] {
    const out: Deed[] = [];
    if (this.deed) out.push(this.deed);
    for (const d of this.neighbourDeeds) if (d.mine) out.push(d);
    return out;
  }

  /** Which settlement of ours covers this tile, when one does. */
  deedOfMineAt(x: number, y: number): Deed | null {
    // `myDeeds` in its order, without making the list: asked per tile.
    const d = this.deed;
    if (d && Math.abs(x - d.x) <= d.radius && Math.abs(y - d.y) <= d.radius) return d;
    for (const n of this.neighbourDeeds) if (n.mine && Math.abs(x - n.x) <= n.radius && Math.abs(y - n.y) <= n.radius) return n;
    return null;
  }

  onDeed(x: number, y: number): boolean {
    return !!this.deedOfMineAt(x, y);
  }

  /**
   * Whether the stores standing on this tile that somebody else made are
   * yours to use: on a settlement you founded, or one your rank on holds
   * Crates and stores. The island's `crate_yours` and `craft_stock`.
   */
  storesOpenAt(x: number, y: number): boolean {
    return deedMay(this.deedOfMineAt(x, y), 'stores');
  }

  /**
   * The altar standing on the settlement of yours that covers this tile, when
   * one does -- other than `except`, a piece being turned where it stands. A
   * settlement has one altar and no more (`ONE_ALTAR`).
   */
  altarOfDeedAt(x: number, y: number, except?: number): PlacedFurniture | undefined {
    const d = this.deedOfMineAt(x, y);
    if (!d) return undefined;
    for (const f of this.furniture.values()) {
      if (f.id !== except && furnitureDef(f.kind).altar && Math.abs(f.x - d.x) <= d.radius && Math.abs(f.y - d.y) <= d.radius) return f;
    }
    return undefined;
  }

  /**
   * Why a locked store will not open for you, or null.
   *
   * The key in your pack is the ordinary answer. The other is the ground:
   * the **founder** of the settlement a store stands on may open anything on
   * their own land, because a game where losing a small item costs you a
   * building is a game nobody enjoys, and because that is what makes a lock
   * worth fitting on somebody else's deed and only worth so much on your own.
   * The founder may hand that master key to a rank (Open its locks); a
   * citizen whose rank lacks it is told so, in `lacks`'s words.
   *
   * In the game you play by yourself the second answer is always yes on your
   * own deed and always no off it, which is exactly right: a lock out in the
   * country is worth something even when the only person who could open it is
   * you, because the wildermon that came with you cannot.
   */
  lockRefusal(store: Lockable & { x: number; y: number }): string | null {
    const mine = this.deedOfMineAt(Math.floor(store.x), Math.floor(store.y));
    return lockRefusal(this.inventory.items, store, deedMay(mine, 'locks'), lacks(mine, 'locks'));
  }

  /**
   * The thing standing on the ground that a job is aimed at, when it is one a
   * scroll can be set into where it stands: a piece of furniture, a smelter, a
   * kiln, an anvil or a trap. With it, what it is by the catalogue (`def`, the
   * item it was in the pack and goes back to), what to call it, and where its
   * middle is, which is what "within reach" is measured to. The island's
   * `placed_def` and `placed_in_reach` answer the same.
   */
  placedFor(t: Target): PlacedEnchantable | undefined {
    if (t.kind === 'furniture') {
      const f = this.furniture.get(t.id);
      return f && { thing: f, def: f.kind, name: furnitureName(f), at: furnitureCentre(f), lock: f.lock };
    }
    if (t.kind === 'smelter') {
      const p = this.smelters.get(t.id);
      return p && { thing: p, def: 'smelter', name: smelterName(p), at: smelterCentre(p) };
    }
    if (t.kind === 'kiln') {
      const p = this.kilns.get(t.id);
      return p && { thing: p, def: 'kiln', name: kilnName(p), at: kilnCentre(p) };
    }
    if (t.kind === 'anvil') {
      const p = this.anvils.get(t.id);
      return p && { thing: p, def: 'anvil', name: anvilName(p), at: anvilCentre(p) };
    }
    if (t.kind === 'trap') {
      const p = this.traps.get(t.id);
      return p && { thing: p, def: p.kind, name: trapName(p), at: trapCentre(p) };
    }
    if (t.kind === 'crate') {
      const c = this.crates.get(t.id);
      return c && { thing: c, def: CRATE_DEFS[c.kind].item, name: crateName(c), at: crateCentre(c), lock: c.lock };
    }
    return undefined;
  }
  /** Everything standing within reach that a scroll could be set into, for the scroll's menu (`placedFor`). */
  placedNear(range = PLACED_REACH): { target: Target; placed: PlacedEnchantable }[] {
    const near: { target: Target; placed: PlacedEnchantable }[] = [];
    const ids: [Target['kind'], Iterable<number>][] = [
      ['furniture', this.furniture.keys()], ['smelter', this.smelters.keys()], ['kiln', this.kilns.keys()],
      ['anvil', this.anvils.keys()], ['trap', this.traps.keys()], ['crate', this.crates.keys()],
    ];
    for (const [kind, keys] of ids) for (const id of keys) {
      const target = { kind, id } as Target;
      const placed = this.placedFor(target);
      if (placed && Math.hypot(placed.at[0] - this.player.x, placed.at[1] - this.player.y) <= range) near.push({ target, placed });
    }
    return near;
  }

  /**
   * On the one settlement this browser calls its own, and no other.
   *
   * What an upgrade is counted against. `onDeed` is "may I work here" and is
   * rightly the whole list; this is "does this count towards *this* token",
   * and a crate on a settlement you are a citizen of does not buy the founder
   * of another one their next level.
   */
  onOwnDeed(x: number, y: number): boolean {
    const d = this.deed;
    return !!d && Math.abs(x - d.x) <= d.radius && Math.abs(y - d.y) <= d.radius;
  }

  /** The settlement's upgrade level, 1 when freshly founded. */
  get deedLevel(): number {
    return deedLevel(this.deed);
  }

  /** How many wildermon may work the deed at this level. */
  get workerCap(): number {
    return deedWorkersAt(this.deedLevel);
  }

  /**
   * The settlement whose token stands on this tile, ours or anybody's we have
   * heard of: the island's `is_token` asks every deed, so nobody builds on a
   * stranger's token either, and a stranger's is drawn as ours is.
   */
  tokenAt(x: number, y: number): Deed | null {
    // `myDeeds` first and then everybody's, without making the list: the renderer asks this of every tile it draws.
    if (this.deed && this.deed.x === x && this.deed.y === y) return this.deed;
    for (const d of this.neighbourDeeds) if (d.mine && d.x === x && d.y === y) return d;
    for (const d of this.neighbourDeeds) if (d.x === x && d.y === y) return d;
    return null;
  }

  /** Whether any settlement's token stands on this tile (`tokenAt`). */
  isToken(x: number, y: number): boolean {
    return this.tokenAt(x, y) !== null;
  }

  /** The token tile of a settlement of ours: where it is renamed and disbanded from. */
  isMyToken(x: number, y: number): boolean {
    return this.myDeeds().some((d) => d.x === x && d.y === y);
  }

  insideBuilding(): Building | undefined {
    return this.buildings.buildingAt(this.player.tileX, this.player.tileY);
  }

  /**
   * Why a tile cannot take a building plan, or null when it can: a new plan
   * on it, or `into` the building beside it that it would be added to.
   *
   * Level, dry ground is built on as it stands, and has to be packed first.
   * Any other ground a building stands on piers over (`piers.ts`): under the
   * deck of the building it joins, or under a deck at the tile's own top for a
   * new plan. The island's `plan_reason` and `extend_reason`.
   */
  planReason(x: number, y: number, into?: Building): string | null {
    if (!this.onDeed(x, y)) return 'Only on your own settlement.';
    if (this.isToken(x, y)) return 'Settlement totem here.';
    if (this.buildings.buildingAt(x, y)) return 'Already part of a building.';
    if (this.bridgeAt(x, y)?.kind === 'aqueduct') return AQ_OVER;
    // gates: nor over the end of a bridge, whose winch or landing stands there (`gates.ts`).
    if (this.bridges.size && bridgeEndAt(this, x, y)) return BRIDGE_END_HERE;
    /*
     * Unless it is a slab, and then the ground under it is the slab's business.
     *
     * A foundation exists to make a tile a hillside would never give you: one
     * flat top at one height, with nothing under it that anybody has to care
     * about. So the three questions asked of open ground — is it level, is it
     * dry, is it out of the water — are all answered by the pour, and asking
     * the terrain again would refuse the one tile that was built to be built
     * on. Shuttering is not a slab: a plan is a line of boards round a hole.
     */
    const slab = this.foundationAt(x, y);
    if (slab) {
      if (this.world.getTile(x, y) !== TileType.PackedDirt) return 'Needs packed dirt.';
      if (!foundationDone(slab)) return 'Foundation not poured yet.';
      if (slab.pool) return 'Not in a pool.';
      // And level with a deck the building already has, since a floor is.
      if (into?.deck != null && slab.top !== into.deck) {
        return `Slab at ${metres(slab.top)} m; ${into.name} floor at ${metres(into.deck)} m. Must match.`;
      }
    } else {
      const site = this.pierSite(x, y, into);
      if (site.deck === null) {
        if (this.world.getTile(x, y) !== TileType.PackedDirt) return 'Needs packed dirt.';
      } else {
        const plant = this.waterPlantAt(x, y);
        const why = pierRefusal(site.ground, site.deck, plant ? WATER_PLANT_BY_ID.get(plant.kind)?.name.toLowerCase() ?? 'water plant' : undefined);
        if (why) return why;
        // What would be left under the deck, or on nothing until it is built (`pier_site_refusal`).
        const under = this.pierSiteRefusal(x, y);
        if (under) return under;
      }
    }
    if (this.groundAt(x, y).length) return 'Items on the tile: clear them first.';
    return null;
  }

  /**
   * Why a tile whose ground would take piers cannot be taken onto them yet,
   * or null: what is there would be left under the deck, or standing on
   * nothing until it is built. A bridge landing on it lands on its ground;
   * a hull, a cart, a fire or a crate standing on it would be shut under the
   * deck; and a body standing on it would stand on nothing. A creature on it
   * is moved off as it is planned (`Creatures.shoo`). The island's
   * `pier_site_refusal`, in its words and order.
   */
  pierSiteRefusal(x: number, y: number): string | null {
    if (this.bridges.size && this.bridgeEndAt(x, y)) return 'Bridge end on this tile: remove the bridge first.';
    if (this.anythingPlaced(x, y)) return 'Something placed on the tile: move it first.';
    if (this.player.tileX === x && this.player.tileY === y) return 'Step off the tile first.';
    if (this.peerOn(x, y)) return 'Someone is on that tile.';
    return null;
  }

  /**
   * Every tile a bridge set out from here to there covers, every lane of it
   * (`laneOffsets`), in a box: what a stone's ground is asked about. The
   * island's `stone_job_tiles`.
   */
  planTiles(ax: number, ay: number, t: { x: number; y: number; width?: number; side?: Side }): Array<[number, number]> {
    const [px, py] = across(ax, ay)(t.x, t.y);
    const lanes = laneOffsets(t.width ?? 1, sideStep(ax, ay, t.x, t.y, t.side) || 1);
    const lo = Math.min(...lanes), hi = Math.max(...lanes);
    const out: Array<[number, number]> = [];
    for (let y = Math.min(ay, t.y) + lo * py; y <= Math.max(ay, t.y) + hi * py; y++) {
      for (let x = Math.min(ax, t.x) + lo * px; x <= Math.max(ax, t.x) + hi * px; x++) out.push([x, y]);
    }
    return out;
  }

  /**
   * Whether a piece standing on a tile stands on a bridge's deck there rather
   * than on the ground under it: wheels, which only come onto a deck from
   * its end, and anything set down on an outer lane of a wide one
   * (`deckLane`). What is drawn, nothing more.
   */
  pieceOnDeck(f: { kind: string; level?: number }, x: number, y: number): boolean {
    if (furnitureDef(f.kind).boat) return false;
    return furnitureDef(f.kind).vehicle ? this.onWalkedDeck(x, y) : this.deckLaneAt(x, y);
  }

  /** Whether a thing set down on a tile is on a bridge's deck there: an outer lane of a wide one (`deckLane`). */
  deckLaneAt(x: number, y: number): boolean {
    const b = this.bridges.size ? this.bridgeAt(x, y) : undefined;
    return !!b && b.kind !== 'aqueduct' && deckLane(b, x, y);
  }

  /** The bridge one of whose two ends is this tile, if any. */
  bridgeEndAt(x: number, y: number): Bridge | undefined {
    for (const b of this.bridges.values()) {
      if ((b.ax === x && b.ay === y) || (b.bx === x && b.by === y)) return b;
      if ((b.width ?? 1) > 1 && endTiles(b).some((e) => e.x === x && e.y === y)) return b;
    }
    return undefined;
  }

  /** Whether somebody else on the island stands on a tile, on its ground or its deck. */
  peerOn(x: number, y: number): boolean {
    if (!this.roster.size) return false;
    for (const p of this.roster.list()) if (p.level === 0 && Math.floor(p.x) === x && Math.floor(p.y) === y) return true;
    return false;
  }

  /**
   * What a tile would stand on as a tile of a building: its ground, and the
   * deck it would stand on piers under, or null for level ground built on as
   * it stands. `into` is the building it would join; without one it is a new
   * plan, whose deck is the tile's own top -- or the level taken, when one is
   * taken higher than that, which is how a stilt house is set up high over
   * its water (as a foundation is poured to it, `foundationTop`).
   */
  pierSite(x: number, y: number, into?: Building): { ground: PierGround; deck: number | null } {
    const ground = pierGround(this.world, x, y);
    const floor = into ? into.deck ?? floorNear(this.buildings, this.world, (tx, ty) => this.slabAt(tx, ty)?.top ?? null, into, x, y) : null;
    if (levelGround(ground, floor)) return { ground, deck: null };
    if (floor !== null) return { ground, deck: floor };
    const top = deckOver(ground);
    return { ground, deck: this.level !== null && this.level > top ? this.level : top };
  }

  /** How far the deck over a tile on piers stands above its lowest corner: what its tallest post spans. */
  pierDropAt(x: number, y: number): number {
    const b = this.buildings.buildingAt(x, y);
    return b?.deck != null && this.buildings.onPiers(x, y) ? pierDrop(pierGround(this.world, x, y), b.deck) : 0;
  }

  /**
   * The height of the finished deck over a tile on piers, or null: off the
   * piers, or on a tile whose deck is not built yet, which is nowhere to
   * stand (`standable`).
   */
  pierDeckAt(x: number, y: number): number | null {
    const bld = this.buildings;
    if (!bld.pierTiles.size || !bld.onPiers(x, y)) return null;
    const f = bld.floor(0, x, y);
    return f && isDone(f) ? bld.buildingAt(x, y)?.deck ?? null : null;
  }

  /** What Examine says of a tile on piers (`pierSays`, the island's `pier_says`), and nothing off the piers. */
  pierSays(x: number, y: number): string {
    const b = this.buildings.onPiers(x, y) ? this.buildings.buildingAt(x, y) : undefined;
    if (b?.deck == null) return '';
    return pierSays(b.deck, this.pierDropAt(x, y), this.pierDeckAt(x, y) !== null, this.world.hasWater(x, y) ? this.world.surfaceAt(x, y) : null);
  }

  /** Whether a tile stands on piers whose deck is not finished: nothing to stand on at all. */
  pierBare(x: number, y: number): boolean {
    return this.buildings.pierTiles.size > 0 && this.buildings.onPiers(x, y) && this.pierDeckAt(x, y) === null;
  }

  /**
   * What a thing set down on a tile stands on, where the tile is on piers: its
   * finished deck (true), which is dry, level floor whatever is under it, or
   * nothing yet (false). Null off the piers, where the ground answers.
   */
  deckFooting(x: number, y: number): boolean | null {
    if (!this.buildings.pierTiles.size || !this.buildings.onPiers(x, y)) return null;
    return this.pierDeckAt(x, y) !== null;
  }

  /** Whether a body on a tile is on a deck rather than on the ground or in the water under it. */
  readonly onPierDeck = (x: number, y: number): boolean => this.buildings.pierTiles.size > 0 && this.pierDeckAt(x, y) !== null;

  /**
   * How many actions you can hold in your head at once, the one in hand
   * included: three to start with, and one more for every ten points of mind
   * logic above where you began.
   */
  queueCapacity(): number {
    if (this.remoteCap !== null) return this.remoteCap;
    // And more for a perk's `jobs`, as `queue_capacity` has it on the island (no perk grants it now).
    return queueCapAt(this.skills.get('mind_logic')) + this.perk('jobs', 0);
  }

  /** Body control quickens every action; the effect is small but it is always there. */
  controlSpeed(): number {
    return controlPaceAbove(this.skills.get('body_control') - CHAR_START);
  }

  /**
   * What a second of deep water costs your wind: less for a strong swimmer and
   * for Power's Hard Breath, and nothing in a Deep Lungs or an Unbroken. The
   * island's `body_settle`.
   */
  swimWind(): number {
    if (this.pathHolds('lungs') || this.pathHolds('unbroken')) return 0;
    // And less for a Seal's Coat worn (`body_settle`).
    return SWIM_WIND * Math.max(0.4, 1 - this.skills.get('swimming') / 200) * this.pathFx('swim', 1) * (1 - this.wornEnchant('swim'));
  }

  /** How fast your wind comes back, as a share of its pace at the start: more for body stamina, and Steady Heart's (`windMul`). */
  windRegen(): number {
    return windRegenAbove(this.skills.get('body_stamina') - CHAR_START) * this.windMul();
  }

  /** Your pace in deep water, as a share of a walk: more for swimming and a Seal's Coat worn, never past a walk (`travel_speed`). */
  swimPace(): number {
    return Math.min(1, Math.min(0.85, SWIM_SPEED + this.skills.get('swimming') * 0.0033) * (1 + this.wornEnchant('swim')));
  }

  /** How big your stamina bar is, against the one you started with: 1 at the starting mark, 2 at a hundred (`stamina_bar`). */
  staminaBar(): number {
    return staminaBarAbove(this.skills.get('body_stamina') - CHAR_START);
  }

  /** Body stamina makes the same work cost less wind; armour makes it dearer. */
  staminaCost(cost: number): number {
    // Nothing at all while Power's Unbroken holds.
    if (this.pathHolds('unbroken')) return 0;
    const body = staminaCostAbove(this.skills.get('body_stamina') - CHAR_START);
    return cost * body * (1 + this.burden());
  }

  /** Mind logic takes the edge off a difficult craft, though never more than half of it. */
  mindEase(): number {
    return mindEaseAt(this.skills.get('mind_logic'));
  }

  /** The orders every wildermon on the deed works under. */
  deedStance(): Stance {
    return this.deed?.stance ?? 'defensive';
  }

  /** Give every wildermon kept here the same orders. */
  setDeedStance(stance: Stance): void {
    if (!this.deed) return;
    this.deed.stance = stance;
    let n = 0;
    for (const c of this.creatures.list.values()) {
      if (c.mode !== 'deed') continue;
      c.stance = stance;
      c.enemy = null;
      n++;
    }
    this.logMsg(`${this.deed.name} wildermon stance: ${stance}${n ? ` (${n} changed)` : ''}.`, 'wildermon');
    this.events.emit('creature');
  }

  /** The best food you are carrying, for the eat button. */
  bestFood(): Item | undefined {
    let best: Item | undefined;
    for (const it of this.inventory.items) {
      if (!ITEM_DEFS[it.id]?.food) continue;
      if (!best || it.ql > best.ql) best = it;
    }
    return best;
  }

  /**
   * The poorest thing your companion is fed, for the feed button: keep the good stuff.
   *
   * What it is fed is its own diet or a bucket of whey (`feedable`). The one
   * that fills least of its hunger goes first (`feedFill`: a bucket of whey
   * fills `WHEY_FEED`, a thing of its diet `GRAZE_FILL`), and of those the
   * lowest quality, so the food that fills it most is kept for later.
   */
  worstFoodFor(c: Creature): Item | undefined {
    const def = this.creatures.species(c);
    let worst: Item | undefined;
    for (const it of this.inventory.items) {
      if (!feedable(def, it.id)) continue;
      const fill = feedFill(it.id);
      if (!worst || fill < feedFill(worst.id) || (fill === feedFill(worst.id) && it.ql < worst.ql)) worst = it;
    }
    return worst;
  }

  /** The item in a slot, if anything is there and still in the pack. */
  worn(slot: Slot): Item | undefined {
    const uid = this.player.equipped[slot];
    if (uid === null || uid === undefined) return undefined;
    const item = this.inventory.get(uid);
    if (!item) {
      this.player.equipped[slot] = null;
      return undefined;
    }
    return item;
  }

  isEquipped(uid: number): boolean {
    if (uid === undefined) return false;
    for (const slot of SLOTS) if (this.player.equipped[slot] === uid) return !!this.inventory.get(uid);
    return false;
  }

  /**
   * Empty any slot whose thing has left your pack.
   *
   * A slot held a number and nothing ever took the number back out of it. So
   * a helm you dropped, stowed in a crate, traded away or wore through stayed
   * in the slot it was worn in, `isEquipped` answered off the number alone,
   * and the helm went on reading as worn wherever it had got to -- "even
   * dropping and picking it up indicates that i'm still wearing it". Worse
   * than the mark: the slot was still the slot, so picking the thing up again
   * put it back on your head without anybody asking, and `Take it off` was
   * the one entry the menu would not offer, because as far as this was
   * concerned the thing was already off.
   *
   * Run off the pack's own change hook rather than at each of the dozen
   * places a thing can leave it, because there is no way out of a pack that
   * does not go past that hook.
   */
  private unwearWhatIsGone(): void {
    for (const slot of SLOTS) {
      const uid = this.player.equipped[slot];
      if (uid === null || uid === undefined) continue;
      if (!this.inventory.get(uid)) this.player.equipped[slot] = null;
    }
  }

  /**
   * What the island says you have on.
   *
   * `equipped` is a column of the player row that the island has kept and
   * written to since the day `equip` was dispatched there, and has never once
   * sent back -- so a browser that reloaded held an empty record, nothing in
   * the pack was marked worn, and `Take it off` never appeared on anything,
   * whatever the island had you wearing. Replaced wholesale rather than
   * merged: the island is the one that knows, and an empty slot has to be
   * able to mean "nothing is on it".
   */
  sawEquipped(what: Record<string, number | null>): void {
    for (const slot of SLOTS) {
      const v = what[slot];
      this.player.equipped[slot] = typeof v === 'number' ? v : null;
    }
    this.unwearWhatIsGone();
    this.events.emit('inventory');
  }

  /** Whether the thing in hand takes both of them. */
  twoHandedInHand(): boolean {
    const held = this.worn('weapon');
    return !!held && !!WEAPON_BY_ID.get(held.id)?.twoHanded;
  }

  /** Put something on or take it off; a two-handed weapon pushes the shield away. */
  equip(slot: Slot, uid: number | null): void {
    const before = this.worn(slot);
    this.player.equipped[slot] = uid;
    const item = uid === null ? undefined : this.inventory.get(uid);
    if (uid !== null && slot === 'weapon' && item && WEAPON_BY_ID.get(item.id)?.twoHanded && this.worn('offhand')) {
      const shield = this.worn('offhand');
      this.player.equipped.offhand = null;
      if (shield) this.logMsg(`Needs both hands: ${itemName(shield).toLowerCase()} unequipped.`, 'info');
    }
    if (item) this.logMsg(`Equipped: ${itemName(item).toLowerCase()}.`, 'info');
    else if (before) this.logMsg(`Unequipped: ${itemName(before).toLowerCase()}.`, 'info');
    this.events.emit('inventory');
  }

  /**
   * How many loops the belt you are wearing has: one for every ten points of
   * how well it was made, and none at all when you are not wearing one. A belt
   * worn to pieces is still a belt, so damage does not take loops away.
   */
  beltLoops(): number {
    const belt = this.worn('belt');
    return belt ? loopsFor(belt.ql) : 0;
  }

  /** Hang a job on a loop. */
  pinToBelt(loop: number, pin: BeltPin): void {
    if (loop < 0 || loop >= BELT_MAX) return;
    this.player.belt[loop] = pin;
    const def = ACTION_BY_ID.get(pin.action);
    this.logMsg(`Loop ${loop + 1}: ${pinLabel(pin, def)}.`, 'info');
    this.events.emit('inventory');
  }

  /** The first empty loop within reach, or -1 when they are all full. */
  freeLoop(): number {
    const loops = this.beltLoops();
    for (let i = 0; i < loops; i += 1) if (!this.player.belt[i]) return i;
    return -1;
  }

  /** Take a job off a loop. */
  clearLoop(loop: number): void {
    if (loop < 0 || loop >= BELT_MAX || !this.player.belt[loop]) return;
    this.player.belt[loop] = null;
    this.events.emit('inventory');
  }

  /** What a loop would do right now, for drawing the bar and for pressing it. */
  aimLoop(loop: number, where: Target | null): { pin: BeltPin; def: ActionDef; target: Target; reason: string | null } | null {
    const pin = this.player.belt[loop];
    if (!pin || loop >= this.beltLoops()) return null;
    const def = ACTION_BY_ID.get(pin.action);
    if (!def) return null;
    const aim = aimPin(this, pin, def, where);
    if (!aim) return { pin, def, target: { kind: 'tile', x: this.player.tileX, y: this.player.tileY, cx: this.player.tileX, cy: this.player.tileY }, reason: `Need ${itemName({ uid: 0, id: pin.item ?? '', ql: 1, dmg: 0, count: 1 }).toLowerCase()}.` };
    return { pin, def, target: aim.target, reason: aim.reason };
  }

  /** Press a loop: do what hangs on it, where you are pointing. */
  useLoop(loop: number, where: Target | null): void {
    if (!this.beltLoops()) {
      this.logMsg('Need a toolbelt worn.', 'error');
      return;
    }
    const aim = this.aimLoop(loop, where);
    if (!aim) {
      this.logMsg(`Loop ${loop + 1} is empty.`, 'error');
      return;
    }
    if (aim.reason) {
      this.logMsg(aim.reason, 'error');
      return;
    }
    this.requestAction(aim.def, aim.target);
  }

  /** Ask for the name this action wants, then start it again carrying one. */
  private async askName(def: ActionDef, target: Target, goes?: number): Promise<void> {
    const asks = def.asks;
    if (!asks) return;
    const said = await this.hooks.prompt(asks.question, asks.fallback?.(target, this) ?? '');
    const name = said === null ? null : cleanText(said, asks.max ?? 32);
    if (name === null || (!name && !asks.allowEmpty)) {
      if (asks.declined) this.logMsg(asks.declined, 'info');
      return;
    }
    // A name that reads as a keeper or staff, refused before it is sent, in the island's words (`act_refusal`).
    const reserved = (NAMES_ASKED as readonly string[]).includes(def.id) ? nameRefusal(name, [], this.keeper) : null;
    if (reserved) {
      this.logMsg(reserved, 'error');
      return;
    }
    this.requestAction(def, { ...target, name } as unknown as Target, goes);
  }

  /**
   * Ask which bucket or barrel of dye a dyeing draws from, then start it again
   * with the one chosen on it (`dyeFrom`), as the island takes it.
   */
  private async askDye(def: ActionDef, target: Target, goes: number | undefined, litres: number, from: readonly DyeSource[]): Promise<void> {
    const key = await this.hooks.choose(pickDyeAsks(litres), from.map((s) => ({ key: s.key, colour: s.hex, text: sourceSays(s) })));
    if (key === null || !from.some((s) => s.key === key)) return;
    this.requestAction(def, { ...target, dyeFrom: key } as unknown as Target, goes);
  }

  /** Ask whether to go ahead, then start it again with the answer on it. */
  private async askSure(def: ActionDef, target: Target, goes: number | undefined, question: string): Promise<void> {
    if (!(await this.hooks.confirm(question))) return;
    this.requestAction(def, { ...target, sure: true } as unknown as Target, goes);
  }

  /**
   * Pin a name to a spot. The colour is chosen from the small list in
   * `marks.ts`; past the cap the oldest mark is pushed off, since a map with
   * a hundred pins on it is a map with none.
   */
  addMark(x: number, y: number, name: string, colour = MARK_COLOURS[0].id): Marker {
    const mark: Marker = { id: this.nextMarkId++, name: markName(name, x, y), x, y, colour };
    this.marks.push(mark);
    while (this.marks.length > MARK_CAP) this.marks.shift();
    this.marksChanged?.();
    this.logMsg(`Marked: ${mark.name} at (${x}, ${y}).`, 'info');
    this.events.emit('world', x, y);
    return mark;
  }

  /** Told whenever the marks change, so an island game can keep them in this browser (`play.ts`). */
  marksChanged?: () => void;

  /** Change a mark's colour. */
  recolourMark(id: number, colour: string): void {
    const mark = this.marks.find((m) => m.id === id);
    if (!mark) return;
    mark.colour = colour;
    this.marksChanged?.();
    this.events.emit('world', mark.x, mark.y);
  }

  /** Marks kept somewhere else than the save, taken back: an island game's, from this browser. Graves mark themselves. */
  takeMarks(marks: readonly Marker[]): void {
    for (const m of marks) {
      if (m.grave !== undefined || this.marks.some((k) => k.id === m.id)) continue;
      this.marks.push({ ...m });
      if (m.id >= this.nextMarkId) this.nextMarkId = m.id + 1;
    }
  }

  removeMark(id: number): void {
    const i = this.marks.findIndex((m) => m.id === id);
    if (i < 0) return;
    const [gone] = this.marks.splice(i, 1);
    this.marksChanged?.();
    this.logMsg(`Mark removed: ${gone.name}.`, 'info');
    this.events.emit('world', gone.x, gone.y);
  }

  renameMark(id: number, name: string): void {
    const mark = this.marks.find((m) => m.id === id);
    if (!mark) return;
    mark.name = markName(name, mark.x, mark.y);
    this.marksChanged?.();
    this.events.emit('world', mark.x, mark.y);
  }

  /** Nearest mark to a spot, for saying where something is. */
  markNear(x: number, y: number, within = 4): Marker | undefined {
    let best: Marker | undefined;
    let close = within;
    for (const m of this.marks) {
      const d = Math.hypot(m.x - x, m.y - y);
      if (d <= close) {
        close = d;
        best = m;
      }
    }
    return best;
  }

  /**
   * Where home is: the settlement token when there is one, the bed you last
   * woke in otherwise. Somewhere to walk back to without hunting the map.
   */
  home(): { x: number; y: number; name: string } | null {
    if (this.deed) return { x: this.deed.x, y: this.deed.y, name: this.deed.name };
    if (this.spawn) return { x: this.spawn.x, y: this.spawn.y, name: 'where you wake' };
    return null;
  }

  /** Set off for home, saying so. Returns false when there is nowhere to go. */
  /**
   * Somebody you are walking after.
   *
   * Entirely on this machine. The island is not told and has nothing to be
   * told: following is a series of ordinary walks, and every one of them goes
   * through `rpc_move` like any other step. There is no rule over there that
   * would read it and nothing it could refuse.
   */
  private followed: { uid: string; name: string } | null = null;
  private followTick = 0;
  /** The tile we last set off for, so a stationary target is not re-pathed at. */
  private followTile: { x: number; y: number } | null = null;

  /**
   * Whether you are following somebody in particular, or anybody at all.
   *
   * Both questions, because both get asked: the menu wants to know whether
   * *this* row is the one you are following, and Escape only wants to know
   * whether there is anything to stop.
   */
  following(uid?: string): boolean {
    return uid === undefined ? this.followed !== null : this.followed?.uid === uid;
  }

  /** Walk after somebody until one of you stops it. Asking twice stops it. */
  follow(uid: string, name: string): void {
    if (this.followed?.uid === uid) {
      this.unfollow(`Stopped following ${name}.`);
      return;
    }
    this.followed = { uid, name };
    this.followTile = null;
    this.followTick = FOLLOW_EVERY;
    this.logMsg(`Following ${name}. Move or press Escape to stop.`, 'info');
  }

  unfollow(why?: string): void {
    if (!this.followed) return;
    this.followed = null;
    this.followTile = null;
    if (why) this.logMsg(why, 'info');
  }

  /**
   * Keep up, a few times a second rather than every frame.
   *
   * Re-pathing at sixty frames a second would be sixty paths a second to the
   * same tile and a walk that restarts before it takes a step. So: only when
   * the clock comes round, and then only when they have actually moved off the
   * tile we set out for or we have arrived and stopped.
   */
  private updateFollow(dt: number): void {
    const f = this.followed;
    if (!f) return;
    this.followTick += dt;
    if (this.followTick < FOLLOW_EVERY) return;
    this.followTick = 0;
    const who = this.roster.list().find((p) => p.uid === f.uid);
    if (!who) {
      this.unfollow(`Lost sight of ${f.name}.`);
      return;
    }
    const away = Math.hypot(who.x - this.player.x, who.y - this.player.y);
    if (away > FOLLOW_LOSE) {
      this.unfollow(`${f.name} is too far off to follow.`);
      return;
    }
    // Close enough. Stand still rather than shuffling into them, and stay
    // following, because they will move again.
    if (away <= FOLLOW_CLOSE) {
      if (this.followTile) {
        this.player.stop();
        this.followTile = null;
      }
      return;
    }
    const tx = Math.floor(who.x);
    const ty = Math.floor(who.y);
    if (this.followTile && this.followTile.x === tx && this.followTile.y === ty && this.player.moving) return;
    this.followTile = { x: tx, y: ty };
    // `moveTo` says so itself when there is no way through, so this does not.
    if (!this.moveTo(tx, ty, true)) this.unfollow();
  }

  walkHome(): boolean {
    const h = this.home();
    if (!h) {
      this.logMsg('No home: found a settlement or sleep in a bed.', 'error');
      return false;
    }
    const away = Math.round(Math.hypot(h.x + 0.5 - this.player.x, h.y + 0.5 - this.player.y));
    if (away < 2) {
      this.logMsg(`Already at ${h.name}.`, 'info');
      return true;
    }
    // moveTo says so itself when there is no way through.
    if (!this.moveTo(h.x, h.y)) return false;
    this.logMsg(`Heading to ${h.name}: ${away} tiles.`, 'info');
    return true;
  }

  /** Everything worn, as pieces of armour. */
  private wornArmour(): Array<{ slot: Slot; item: Item; def: (typeof ARMOUR_BY_ID) extends Map<string, infer V> ? V : never }> {
    const out = [];
    for (const slot of ['head', 'chest', 'arms', 'legs', 'feet'] as Slot[]) {
      const item = this.worn(slot);
      const def = item && ARMOUR_BY_ID.get(item.id);
      if (item && def) out.push({ slot, item, def });
    }
    return out;
  }

  /**
   * What you can carry before it tells on you: `CARRY_BASE` kilos, and
   * `CARRY_PER_STRENGTH` more for every point of body strength. Nothing stops
   * you going over it; going over it simply costs. Asked for: "change base kg
   * players can carry to 120kg, increased 5kg per body strength point" — it
   * was forty and most of a kilo. The island does not read this: what you are
   * carrying is the browser's to weigh, and the drag of it is drawn here.
   */
  carryLimit(): number {
    // And whatever a trade's perks add to it: a Terraformer's Strong Back.
    // And Power's Pack Mule.
    // And a Packmule on each pack carried (`pack_mule`).
    // And all of it by a backpack on the back and a sack at the side, by their QL (`bagCarry`).
    return (CARRY_BASE + this.skills.get('body_strength') * CARRY_PER_STRENGTH + this.perk('carry', 0) + this.pathFx('mule', 0)
      + this.inventory.items.reduce((n, it) => n + swingEnchant(it, 'mule'), 0)) * (1 + bagCarry(this.worn('back')) + bagCarry(this.worn('side')));
  }

  /** How far past the limit you are, 0 when you are inside it. */
  overloaded(): number {
    const over = this.inventory.totalWeight() - this.carryLimit();
    return over > 0 ? over : 0;
  }

  /** What is on your back as a share of what your back will take: 1 is exactly full. */
  carryShare(): number {
    const limit = this.carryLimit();
    return limit > 0 ? this.inventory.totalWeight() / limit : 0;
  }

  /**
   * Whether you are carrying so much that you are down to a crawl. The island
   * reads the same sum in `over_carry` and holds a body over it to the same
   * fraction of its pace, so a browser that drew you striding would only be
   * drawing.
   */
  stalled(): boolean {
    return this.carryShare() > CARRY_STOP;
  }

  /** How much armour and a full pack slow you down and tire you. */
  burden(): number {
    let sum = 0;
    for (const { def, item } of this.wornArmour()) sum += pieceBurden(def, item);
    const shield = this.worn('offhand');
    const sh = shield && SHIELDS[shield.id];
    if (sh) sum += sh.burden;
    // Everything past what your back will take is carried at a price, and the
    // price climbs: twice your limit is not twice as bad, it is worse.
    sum += overDrag(this.overloaded(), this.carryLimit());
    // Power's Strong Back carries the same steel, and the same load, for less.
    return sum * this.pathFx('burden', 1);
  }

  /**
   * Take a blow. The hit lands somewhere, whatever is worn there turns some of
   * it aside and wears a little for doing so, and the armour learns from it.
   * A shield in the off hand may stop the whole thing first.
   */
  absorb(raw: number, kind: WoundKind = 'bite'): { taken: number; part: Slot; worn: Item | null; blocked: boolean } {
    // The shield, first of all.
    const shield = this.worn('offhand');
    const sh = shield && SHIELDS[shield.id];
    if (sh) {
      // Less of a chance for every other thing on you than the one that struck (`CROWD_BLOCK`).
      const crowd = Math.max(0, 1 - CROWD_BLOCK * this.othersOnYou());
      // And what a Sworn Blade's Shield Mastery adds, under the ceiling it raises (`blockChance`).
      // And a Bulwark's points on top, past the ceiling (`worn_enchant`).
      const chance = (blockChance(sh.block, shield.ql, this.skills.get('shields'), (k, o) => this.perk(k, o)) + this.wornEnchant('block')) * crowd;
      this.gainSkill('shields', 0.12);
      if (this.rand() < chance) {
        // Less for a Mender's Armour Care, as `hurt_player` has it.
        shield.dmg = Math.min(100, shield.dmg + raw * SHIELD_WEAR * this.perk('worn:shield', 1));
        this.gainSkill('shields', 0.5);
        this.events.emit('inventory');
        return { taken: 0, part: 'offhand', worn: shield, blocked: true };
      }
    }
    // Then wherever it lands.
    let roll = this.rand();
    let part: Slot = 'chest';
    for (const [slot, share] of HIT_LOCATIONS) {
      roll -= share;
      if (roll <= 0) {
        part = slot;
        break;
      }
    }
    const item = this.worn(part);
    const def = item && ARMOUR_BY_ID.get(item.id);
    if (!item || !def) return { taken: raw, part, worn: null, blocked: false };
    const skillId = ARMOUR_CLASSES[def.cls].skill;
    const soak = pieceSoak(def, item, this.skills.get(skillId));
    // Armour is learned by being hit in it, and worn out the same way.
    this.gainSkill(skillId, 0.4);
    // And a burn wears it out `BURN_WEAR` times as fast.
    item.dmg = Math.min(100, item.dmg + raw * 4 * this.perk('worn:armour', 1) * (kind === 'burn' ? BURN_WEAR : 1));
    if (item.dmg >= 100) {
      this.inventory.remove(item.uid, 1);
      this.player.equipped[part] = null;
      this.logMsg(`Destroyed: ${itemName(item).toLowerCase()} (${DAMAGE_MAX}% damage).`, 'fight');
    }
    this.events.emit('inventory');
    // And more for Power's Ironhide, as the island's `hurt_player` has it.
    const hide = this.pathFx('hide', 1);
    // And what this class of armour makes of this kind of blow (`ARMOUR_VS`).
    return { taken: raw * (1 - Math.min(0.92, soak * hide * ARMOUR_VS[def.cls][kind])), part, worn: item, blocked: false };
  }

  /** A walk on foot this many times as quick for so many seconds, as a spell the island cast says (a Skirmisher's Hit and Run). */
  spedUp(mul: number, secs: number): void {
    this.paceMul = mul;
    this.paceUntil = this.time + secs;
  }

  /**
   * The kilograms of armour on you, a shield in the off hand with it: each
   * piece at its make's own weight, whatever it is made of, as a dodge counts
   * it. What the weapon card says you have on.
   */
  armourKg(): number {
    const shield = this.worn('offhand');
    return this.wornArmour().reduce((n, { item }) => n + itemDef(item.id).weight, 0)
      + (shield && SHIELDS[shield.id] ? itemDef(shield.id).weight : 0);
  }

  /**
   * The same pieces as a swing counts them: each one's weight times its
   * family's share (`swingKgOf`, `ARMOUR_SWING_BY`). What a swing is slowed by
   * (`swingBurden`); the island's `swing_burden`.
   */
  armourCounted(): number {
    const shield = this.worn('offhand');
    return this.wornArmour().reduce((n, { item }) => n + swingKgOf(item.id), 0)
      + (shield && SHIELDS[shield.id] ? swingKgOf(shield.id) : 0);
  }

  /**
   * What you wear and carry make of a swing or a draw, each as a share of its
   * time (1.2 is 20% longer): the armour on you (`armourSwing`), and being
   * over what your back takes (`overburdenSwing`), which is the status
   * panel's "Overloaded" and nothing short of it. A cart's or a wagon's load
   * is not on your back. The island's `swing_burden`.
   */
  swingBurden(): { armour: number; over: number } {
    return { armour: armourSwing(this.armourCounted()), over: overburdenSwing(this.overloaded() > 0) };
  }

  /** Your chance of dodging a creature's blow just now (`dodgeChance`): body control past where it starts, less the kilograms of armour on you. */
  dodge(): number {
    const kg = this.wornArmour().reduce((n, { item }) => n + itemDef(item.id).weight, 0);
    return dodgeChance(this.skills.get('body_control'), kg);
  }

  /**
   * What a blow of this size and kind would leave you with on average, for
   * the consider line (`consider.ts`): after your stance, your dodge, your
   * shield's chance and what your armour turns where it might land. Nothing
   * is worn or learned by asking.
   */
  expectedBlow(raw: number, kind: WoundKind): number {
    const perk = (k: string, o: number): number => this.perk(k, o);
    let through = raw * stanceTaken(this.settings.fightStance, perk) * (1 - this.dodge());
    const shield = this.worn('offhand');
    const sh = shield && SHIELDS[shield.id];
    if (sh) through *= 1 - Math.min(1, blockChance(sh.block, shield.ql, this.skills.get('shields'), perk) + this.wornEnchant('block'));
    through *= this.enchantTaken(kind);
    let soaked = 0;
    for (const [slot, share] of HIT_LOCATIONS) {
      const item = this.worn(slot);
      const def = item && ARMOUR_BY_ID.get(item.id);
      if (!item || !def) continue;
      const soak = pieceSoak(def, item, this.skills.get(ARMOUR_CLASSES[def.cls].skill)) * this.pathFx('hide', 1);
      soaked += share * Math.min(0.92, soak * ARMOUR_VS[def.cls][kind]);
    }
    return through * (1 - soaked);
  }

  /** Every wild thing after you but the one that last struck you: what a crowd takes off your shield (`CROWD_BLOCK`). */
  othersOnYou(): number {
    let n = 0;
    for (const c of this.creatures.list.values()) {
      if (c.mode === 'wild' && c.health > 0 && c.enemy === PLAYER_ATTACKER && c.brawl === null && c.id !== this.player.attackedBy) n++;
    }
    return n;
  }

  /**
   * Hurt the player through their armour, and say what happened. What gets
   * through is not only a number off the bar: it leaves a wound, of a kind,
   * in whichever place the blow landed, and that wound has its own life.
   */
  hurtPlayer(raw: number, what: string, kind: WoundKind = 'bite'): void {
    const by = this.player.attackedBy;
    const from = by !== null && by !== PLAYER_ATTACKER ? this.creatures.get(by) : undefined;
    // Smaller from claws a dulla has dulled (`binder_dull_claws`), as `hurt_player` has it (`class_dull`).
    raw *= markOn(this, from, 'dull');
    // Dodged, before anything else has its say (`dodgeChance`): your body control, less the armour on you.
    // No roll at all while there is no chance, so nothing else's luck moves.
    const dodge = this.dodge();
    if (dodge > 0 && this.rand() < dodge) {
      this.gainSkill('body_control', DODGE_GAIN);
      this.player.attackedAt = this.time;
      this.logMsg(`Dodged: ${from ? this.creatures.species(from).name.toLowerCase() : 'blow'}.`, 'fight');
      // And answer it, for a Skirmisher's Riposte (`class_riposte`).
      const share = this.perk('riposte:blow', 0);
      if (share > 0 && from) riposte(this, from, share);
      this.fightBack();
      return;
    }
    // The skin over you takes it first, and is spent doing it; what it does not cover carries on (`hurt_player`'s aegis).
    if (this.player.skin.size > 0) {
      const skin = this.player.skin.size;
      this.player.skin = skin > raw ? { ...this.player.skin, size: skin - raw } : { size: 0, mine: false, by: null };
      if (skin >= raw) {
        this.player.attackedAt = this.time;
        this.logMsg(`Ward absorbed: ${what.charAt(0).toLowerCase()}${what.slice(1)}.`, 'fight');
        this.fightBack();
        return;
      }
      raw -= skin;
      this.logMsg('Ward broken; the rest of the blow hits.', 'fight');
    }
    // A blow that lands is answered with its share of the creature's own attack, for a Warder's Thorns (`class_owed_pay`).
    const thorns = this.perk('thorns:attack', 0);
    if (thorns > 0 && from && from.health > 0) {
      this.creatures.hurt(this, from, attackOf(from, this.creatures.species(from)) * thorns, 'player');
    }
    // Being hit in the dark teaches more about watching than hitting does.
    this.fought(DARK_HIT);
    /*
     * Harder or softer for the way you stand, and harder from something on
     * you that is not what you are fighting: it is at your back (`fight.ts`).
     * Both before the armour has its say.
     */
    const a = this.action;
    const flank = a && isFightJob(a.def.id) && a.target.kind === 'creature' && by !== null && by !== PLAYER_ATTACKER && a.target.id !== by;
    // And less on feet that have not moved for a Pikeman's Bastion, as `hurt_player` has it,
    const still = this.time - this.movedAt >= FIGHT_BACK_STILL ? this.perk('still:taken', 1) : 1;
    // and less from a creature that is burning for a Kindler's Flame Ward.
    const ward = from && (from.burnUntil ?? 0) > this.time ? this.perk('ward:burning', 1) : 1;
    // And lighter for a Stoneskin you wear, and a burn lighter for an Emberward (`enchant_guard`).
    const hit = this.absorb(raw * stanceTaken(this.settings.fightStance, (k, o) => this.perk(k, o)) * (flank ? FLANK_HIT : 1) * still * ward
      * this.enchantTaken(kind), kind);
    if (hit.blocked) {
      this.player.attackedAt = this.time;
      this.events.emit('hit', this.player.x, this.player.y, 0, 'taken');
      this.logMsg(BLOCKED_SAID, 'fight');
      this.fightBack();
      return;
    }
    // Whatever landed it is set alight, for a Kindler's Burning Retort (`class_owed_pay`).
    const retort = this.perk('retort:each', 0);
    if (retort > 0 && from) this.burn(from, retort, this.perk('retort:secs', 0));
    // Less of it on you while your companion beside you takes its share, for a Beastmaster's Shared Wounds (`class_bond_take`).
    // And a Thornhide's share of what landed back on whatever struck, as a blow of yours that size would hurt it (`worn_enchant`).
    const prick = this.wornEnchant('thorns');
    if (prick > 0 && from && from.health > 0) this.creatures.hurt(this, from, (hit.taken * prick) / BLOW_SHARE, 'player');
    const lost = this.bondTake(hit.taken, from);
    this.player.stats.health = Math.max(0, this.player.stats.health - lost);
    // A blow that would kill you leaves you standing, once in so long, for Power's Hard to Kill (`path_hard_to_kill`).
    const hard = PATH_PICK_BY_ID.get('power_hard_to_kill');
    if (this.player.stats.health <= 0 && hard && this.holds(hard.id) && this.time - (this.player.pathTimes.killed ?? -1e9) >= hard.fx.every) {
      this.player.stats.health = hard.fx.kill;
      this.player.pathTimes.killed = this.time;
      this.logMsg(hardToKillSaid(hard.fx.kill), 'fight');
    }
    this.player.attackedAt = this.time;
    this.events.emit('hit', this.player.x, this.player.y, lost, 'taken');
    // Less of a wound than of a blow for a Sworn Blade's Battle-Hardened, and less of a fresh one for a
    // Pikeman's Scarred; the health it takes is the same.
    const fresh = !this.player.wounds.some((w) => w.kind === kind && w.part === hit.part && !w.infected);
    const wound = this.wound(kind, hit.part, hit.taken * this.perk('severity:wound', 1) * (fresh ? this.perk('severity:new', 1) : 1));
    // A venomous bite leaves venom in what it opened (`VENOM_SECS`).
    if (from && this.creatures.species(from).venom) wound.venom = VENOM_SECS;
    const where = hit.worn ? ` (${itemName(hit.worn).toLowerCase()} absorbed some)` : '';
    this.logMsg(`${what}${where}. Wound: ${woundText(wound)}.`, 'fight');
    this.fightBack();
  }

  /**
   * A burn you start on a creature, as the island's `class_burn`: a bleed of a
   * share of its full health a second, the stronger of it and any bleed
   * already running, to the later end, and never the last of its health. More
   * a second for a Searing Burn and longer for a Lingering Burn.
   */
  burn(c: Creature, each: number, secs: number): void {
    if (c.health <= 0 || secs <= 0) return;
    const rate = maxHealth(c, this.creatures.species(c)) * each * this.perk('burn:rate', 1);
    const until = this.time + secs * this.perk('burn:secs', 1);
    const running = c.bleedUntil > this.time;
    c.bleedRate = running ? Math.max(c.bleedRate, rate) : rate;
    if (!running) c.bleedFrom = this.time;
    c.bleedUntil = Math.max(running ? c.bleedUntil : 0, until);
    c.burnUntil = Math.max(c.burnUntil ?? 0, until);
  }

  /**
   * What of a creature's blow comes off your health once your companion has
   * taken its share, for a Beastmaster's Shared Wounds: within the reach it
   * names of you, the share of what landed, in its own health at what a blow
   * of a creature's is to yours (`BLOW_SHARE`), and taken as any blow is. The
   * wound it opens on you is the blow's. The island's `class_bond_take`.
   */
  private bondTake(taken: number, from: Creature | undefined): number {
    const share = this.perk('bond:share', 0);
    const c = share > 0 && from ? this.creatures.active() : undefined;
    if (!c || !from || c.health <= 0 || Math.hypot(c.x - this.player.x, c.y - this.player.y) > this.perk('bond:reach', 0)) return taken;
    this.creatures.hurt(this, c, (taken * share) / BLOW_SHARE, from);
    return taken * (1 - share);
  }

  /**
   * Turn on whatever just bit you.
   *
   * Asked for: "players automatically attack back when attacked". Whoever
   * hurt you was marked before the blow (`attackedBy`); if it is something
   * wild and you are not already swinging at it, whatever was in hand goes to
   * the front of the line to be picked up again after, and you swing at it
   * `FIGHT_BACK_GOES` times or until the first refusal — dead, gone, out of
   * reach — ends the run. A companion that nipped you, a body with no wind
   * left, a thing already dead, are no fight. Reach is not asked here: the
   * bite is the proof of it, and every go of the swing asks again. The island
   * does the same in `fight_back`, off the same number and the same guards,
   * so a bite on an island turns you the same way.
   */
  private fightBack(): void {
    const id = this.player.attackedBy;
    if (id === null || id === PLAYER_ATTACKER || this.player.stats.health <= 0) return;
    if (this.player.stats.stamina < EXHAUSTED) return;
    /*
     * Not with the setting off, and not while you are walking: walking is how
     * you leave a fight, and a bite on the way out used to turn you round and
     * put you back in it. The island asks the same two things in `fight_back`.
     */
    if (!this.settings.fightBack || this.time - this.movedAt < FIGHT_BACK_STILL) return;
    const c = this.creatures.get(id);
    if (!c || c.mode !== 'wild' || c.health <= 0) return;
    if (this.action?.def.id === 'attack_creature' && this.action.target.kind === 'creature' && this.action.target.id === id) return;
    const def = ACTION_BY_ID.get('attack_creature');
    if (!def) return;
    const target: Target = { kind: 'creature', id };
    if (this.action) this.queue.unshift({ def: this.action.def, target: this.action.target, goes: this.action.left });
    this.action = null;
    this.logMsg(`Fighting back: ${this.creatures.species(c).name.toLowerCase()}.`, 'fight');
    this.fightTarget = id;
    this.startAction(def, target, FIGHT_BACK_GOES);
  }

  /** When your feet last moved, which is what `fightBack` asks of a bite. */
  private movedAt = -Infinity;
  /** A spell's quicker walk on foot (a Skirmisher's Hit and Run), and the game time it ends. */
  private paceMul = 1;
  private paceUntil = -Infinity;

  /**
   * The creature you are fighting, or null.
   *
   * A fight follows it: when it steps out of reach and is still within
   * `FOLLOW_RANGE` you go after it and swing again, rather than standing there
   * until you click it a second time. Walking off, `Esc` and its death are
   * what end it.
   */
  fightTarget: number | null = null;
  /** And not before this, so an ask on its way to the island is not asked twice. */
  private fightNext = 0;

  /** The fight a weapon in hand makes: a shot for a bow, a swing for anything else. */
  fightJob(): ActionDef | undefined {
    const held = this.worn('weapon');
    return ACTION_BY_ID.get(held && WEAPON_BY_ID.get(held.id)?.ammo ? 'shoot_creature' : 'attack_creature');
  }

  /** Whether this one is a fight to be had: wild, alive, and either coming for you or the kind that does. */
  hostile(c: Creature): boolean {
    if (c.mode !== 'wild' || c.health <= 0) return false;
    const def = this.creatures.species(c);
    return c.enemy === PLAYER_ATTACKER || c.attackedBy === PLAYER_ATTACKER || !!def.hunter || !!def.monster;
  }

  /**
   * Go for it: the fight a weapon in hand makes, now, and the fight follows it
   * when it steps away (`fightTarget`). Work in hand is put to the front of the
   * line to be picked up after, as a bite puts it.
   */
  engage(id: number): boolean {
    const c = this.creatures.get(id);
    if (!c || c.mode !== 'wild' || c.health <= 0) return false;
    const def = this.fightJob();
    if (!def) return false;
    this.fightTarget = id;
    this.fightNext = this.time + 1;
    const a = this.action;
    if (a && isFightJob(a.def.id) && a.target.kind === 'creature' && a.target.id === id) return true;
    this.requestAction(def, { kind: 'creature', id });
    return true;
  }

  /** The nearest thing within `TARGET_RANGE` that is a fight to be had, for the key that picks one. */
  nearestHostile(): Creature | null {
    const p = this.player;
    let best: Creature | null = null;
    let bestD = TARGET_RANGE;
    for (const c of this.creatures.list.values()) {
      if (!this.hostile(c)) continue;
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d <= bestD) {
        best = c;
        bestD = d;
      }
    }
    return best;
  }

  /**
   * Keep after what you are fighting: with nothing in hand and the fight not
   * over, swing at it again where it stands, or walk to it first while it is
   * still within `FOLLOW_RANGE`. Past that it has got away.
   */
  private updateFight(): void {
    const id = this.fightTarget;
    if (id === null) return;
    const c = this.creatures.get(id);
    if (!c || c.mode !== 'wild' || c.health <= 0) {
      this.fightTarget = null;
      return;
    }
    const a = this.action;
    // A go of it under way is the fight going as it should.
    if (a && isFightJob(a.def.id) && a.state === 'performing') this.fightTries = 0;
    if (a || this.queue.length || this.time < this.fightNext) return;
    const p = this.player;
    const name = this.creatures.species(c).name.toLowerCase();
    if (Math.hypot(c.x - p.x, c.y - p.y) > FOLLOW_RANGE) {
      this.fightTarget = null;
      this.logMsg(`${capital(name)} out of range.`, 'fight');
      return;
    }
    // Spent: the fight waits for your wind rather than ending.
    if (this.player.stats.stamina < EXHAUSTED) return;
    const def = this.fightJob();
    if (!def) return;
    // What no amount of following mends ends it, said once.
    const arms = armsRefusal(this, def.id);
    if (arms || this.fightTries >= FIGHT_TRIES) {
      this.fightTarget = null;
      this.logMsg(arms ?? `Cannot reach the ${name}.`, 'error');
      return;
    }
    // Too close to draw on: it is on you, and there is nothing to walk to.
    if (def.id === 'shoot_creature' && !inFightReach(this, def.id, c) && Math.hypot(c.x - p.x, c.y - p.y) < FOLLOW_RANGE / 2) return;
    this.fightNext = this.time + 1;
    this.fightTries += 1;
    this.requestAction(def, { kind: 'creature', id });
  }

  /** The fight going on, from its first blow to `FIGHT_QUIET` seconds after its last; null between fights. */
  fightRec: FightRecord | null = null;

  /** A blow given or taken: a fight begins, or goes on. */
  private fightGoing(): void {
    const id = this.fightTarget ?? this.marked ?? (this.player.attackedBy !== PLAYER_ATTACKER ? this.player.attackedBy : null);
    const c = id !== null ? this.creatures.get(id) : undefined;
    if (!this.fightRec) {
      this.fightRec = {
        foe: c ? c.id : null,
        foeName: c ? this.creatures.species(c).name.toLowerCase() : 'it',
        foeAt: c ? c.health : 0,
        youAt: this.player.stats.health,
        started: this.time,
        last: this.time,
        skills: new Map(),
      };
    } else if (this.fightRec.foe === null && c) {
      this.fightRec.foe = c.id;
      this.fightRec.foeName = this.creatures.species(c).name.toLowerCase();
      this.fightRec.foeAt = c.health;
    }
    this.fightRec.last = this.time;
  }

  /** Once `FIGHT_QUIET` seconds pass without a blow, or what it was with is dead: one line for the whole of it. */
  private fightEnding(): void {
    const rec = this.fightRec;
    if (!rec) return;
    const c = rec.foe !== null ? this.creatures.get(rec.foe) : undefined;
    const dead = rec.foe !== null && (!c || c.health <= 0);
    if (!dead && this.time - rec.last < FIGHT_QUIET) return;
    this.fightRec = null;
    const secs = Math.max(1, Math.round(rec.last - rec.started));
    const parts: string[] = [`${secs} second${secs === 1 ? '' : 's'}`];
    if (rec.foe !== null) {
      const dealt = Math.max(0, rec.foeAt - (dead ? 0 : (c?.health ?? 0)));
      parts.push(`${Math.round(dealt)} dealt`);
    }
    const taken = Math.max(0, rec.youAt - this.player.stats.health);
    parts.push(`${Math.round(taken * 100)}% of your health taken`);
    const learned = [...rec.skills].map(([k, v]) => `${k} +${v.toFixed(2)}`);
    // Nothing given, nothing taken, nothing learned: a scent and a walk away is not a fight to report.
    if (!dead && taken === 0 && !learned.length && (rec.foe === null || Math.abs(rec.foeAt - (c?.health ?? rec.foeAt)) < 1e-9)) return;
    const how = rec.foe === null ? 'Fight over' : dead ? `${capital(rec.foeName)} killed` : `Fight with ${rec.foeName} over`;
    this.write(`${how}: ${parts.join(', ')}.${learned.length ? ` Learned: ${learned.join(', ')}.` : ''}`, 'fight');
    // That line is the fight's last word, not the start of another.
    this.fightRec = null;
  }

  /** Asks in a row that came to nothing, and how many of them end a fight (`FIGHT_TRIES`). */
  private fightTries = 0;

  /** The creature a fight job is after, while it is still there to fight. */
  private foeOf(a: { def: ActionDef; target: Target }): Creature | undefined {
    if (!isFightJob(a.def.id) || a.target.kind !== 'creature') return undefined;
    const c = this.creatures.get(a.target.id);
    return c && c.mode === 'wild' && c.health > 0 ? c : undefined;
  }

  /** Walk again to where it is now, while it is within `FOLLOW_RANGE`; false when it is not, or there is no way. */
  private closeOn(a: { def: ActionDef; target: Target }, c: Creature): boolean {
    if (Math.hypot(c.x - this.player.x, c.y - this.player.y) > FOLLOW_RANGE) return false;
    return this.walkToward(a.def, a.target) && !!this.player.path;
  }

  /** Open a wound, or deepen one of the same kind already in that place. */
  wound(kind: WoundKind, part: Slot, severity: number): Wound {
    const had = this.player.wounds.find((w) => w.kind === kind && w.part === part && !w.infected);
    if (had) {
      had.severity += severity;
      if (WOUND_KINDS[kind].bleed > 0.001) had.bleeding = true;
      return had;
    }
    const w: Wound = {
      id: this.player.nextWound++,
      kind,
      part,
      severity,
      // A bruise does not bleed; everything else does until it is seen to.
      bleeding: kind !== 'crush',
      infected: false,
      dressing: null,
      at: this.time,
    };
    this.player.wounds.push(w);
    this.note('wounded');
    return w;
  }

  /**
   * What is open on you, once a second: blood out of anything still bleeding,
   * a little closing on anything dressed, and the chance that something left
   * alone goes bad.
   */
  private tendWounds(dt: number): void {
    const p = this.player;
    if (!p.wounds.length) return;
    const aid = this.skills.get('chirurgy');
    let bad = false;
    for (const w of p.wounds) {
      const drain = woundDrain(w);
      if (drain > 0) {
        p.stats.health = Math.max(0, p.stats.health - drain * dt);
        bad = true;
      }
      // Venom, for what is left of it, unless the wound is dressed (`VENOM_DRAIN`).
      if (w.venom && w.venom > 0) {
        if (w.dressing === null) {
          p.stats.health = Math.max(0, p.stats.health - VENOM_DRAIN * Math.min(dt, w.venom));
          bad = true;
        }
        w.venom = Math.max(0, w.venom - dt);
      }
      w.severity = Math.max(0, w.severity - woundClose(w, aid) * dt);
      if (this.rand() < festerChance(w) * dt) {
        w.infected = true;
        w.dressing = null;
        this.logMsg(`Infected: ${WOUND_KINDS[w.kind].name}, ${PART_NAMES[w.part] ?? w.part}. Clean it before dressing.`, 'error');
      }
    }
    const closed = p.wounds.filter((w) => w.severity <= 0.004 && !w.infected);
    for (const w of closed) this.logMsg(`Healed: ${WOUND_KINDS[w.kind].name}, ${PART_NAMES[w.part] ?? w.part}.`, 'event');
    if (closed.length) p.wounds = p.wounds.filter((w) => !closed.includes(w));
    // Losing blood also means losing the wind to do anything about it.
    if (bad) p.stats.stamina = Math.max(0, p.stats.stamina - (dt * 0.01) / this.staminaBar());
  }

  /** Whether anything open is still working against you. */
  bleeding(): boolean {
    return this.player.wounds.some((w) => w.bleeding || w.infected || (!!w.venom && w.dressing === null));
  }

  /** The lit lantern you are carrying, if you are carrying one. */
  litLantern(): Item | undefined {
    return this.inventory.items.find((it) => it.id === 'lantern' && it.lit && (it.charges ?? 0) > 0);
  }

  /**
   * Anything you are carrying that is actually burning — a lantern or a torch.
   *
   * The best of them, so that a torch struck while a good lantern is already
   * going does not shorten your sight. Everything that asks "is there a light
   * in your hand" asks this; `litLantern` is kept for the one thing that is
   * specifically about the candle.
   */
  heldLight(): Item | undefined {
    let best: Item | undefined;
    for (const it of this.inventory.items) {
      if (!it.lit || (it.charges ?? 0) <= 0) continue;
      if (!(HELD_LIGHTS as readonly string[]).includes(it.id)) continue;
      if (!best || heldReachOf(it) > heldReachOf(best)) best = it;
    }
    return best;
  }

  /**
   * A blow struck or taken, for whatever wants to know that a fight happened:
   * awareness × darkness (`awareDark`), as `fought_in_dark`. Down in a cellar it
   * is the dead of night at every hour, as it is to the eye (`cellar.ts`).
   */
  fought(weight = 1): void {
    const dark = this.awareDark();
    if (!dark) return;
    this.gainSkill(AWARENESS, weight * dark);
  }

  /** Darkness as awareness reads it: 1 below ground, 0 at or under `NIGHT_EYES_FROM` (`aware_dark`). */
  awareDark(): number {
    const dark = this.player.level < 0 ? 1 : this.darkness();
    return dark > NIGHT_EYES_FROM ? dark : 0;
  }

  /** Awareness's share over the starting mark (`aware_share`). */
  awareShare(): number {
    return awareShareAbove(this.skills.get(AWARENESS) - CHAR_START);
  }

  /** How far a hunter notices you from, as a share of how far it would, for your awareness (`aware_notice`). */
  awareNotice(): number {
    return 1 - this.awareShare();
  }

  /** What awareness adds to the hit chance, × darkness as it reads it (`hit_chance`). */
  awareDarkHit(): number {
    return this.awareShare() * this.awareDark();
  }

  /**
   * Everything burning near enough to matter, as circles of light. The
   * renderer cuts these out of the night and the eye reaches further inside
   * them. Only what is close is looked at: a fire forty tiles off lights
   * nothing you can see.
   */
  lights(): LightSource[] {
    if (this.darkness() <= 0.01) return [];
    const out: LightSource[] = [];
    const px = this.player.x;
    const py = this.player.y;
    const near = (x: number, y: number): boolean => Math.abs(x - px) < 60 && Math.abs(y - py) < 60;
    const lamp = this.litLantern();
    // Carried down into a cellar, it lights the cellar and nothing up here (`cellarLights`).
    if (lamp && this.player.level >= 0) out.push({ x: px, y: py, radius: heldReachOf(lamp), strength: 0.92, steady: true, level: this.player.level });
    for (const f of this.campfires.values()) {
      if (!f.lit || !near(f.x, f.y)) continue;
      const [cx, cy] = fireCentre(f);
      out.push({ x: cx, y: cy, radius: FIRE_REACH, strength: 0.85 });
    }
    for (const f of this.furniture.values()) {
      // A piece down in a cellar lights nothing up here: an altar's glow stays under the floor.
      if (!near(f.x, f.y) || (f.level ?? 0) < 0) continue;
      // A rune lantern throws what a lantern of its quality throws, and needs nothing to (`runelantern.ts`).
      if (isRuneLantern(f)) {
        out.push(runeLanternLight(f));
        continue;
      }
      // A lantern post throws what its lantern throws, from under the lantern (`lamps.ts`).
      if (isLampPiece(f)) {
        if (lampBurning(f)) out.push(lampLight(f));
        continue;
      }
      // An enchanter's plinth's runes, brighter while somebody enchants at it (`plinth.ts`).
      // Where it stands, worked out only for what lights from there: every piece in the settlement is looked at every frame.
      if (f.kind !== ENCHANTERS_PLINTH && f.kind !== MEMORIAL && !f.lit && !furnitureDef(f.kind).altar) continue;
      const [cx, cy] = furnitureCentre(f);
      if (f.kind === ENCHANTERS_PLINTH) {
        out.push(plinthLight(cx, cy, plinthBusy(this, f)));
        continue;
      }
      // A memorial stone's runes, a small pool of pale gold at its foot (`memorialLight`).
      if (f.kind === MEMORIAL) {
        out.push(memorialLight(cx, cy));
        continue;
      }
      if (f.lit) out.push({ x: cx, y: cy, radius: OVEN_REACH, strength: 0.8 });
      else if (furnitureDef(f.kind).altar) out.push({ x: cx, y: cy, radius: ALTAR_REACH, strength: ALTAR_GLOW, steady: true, cast: ALTAR_CAST, castAlpha: ALTAR_CAST_ALPHA });
    }
    // A kiln's and a smelter's from the middle of its block, where its mouth and its vent or stack are.
    for (const k of this.kilns.values()) {
      if (!k.lit || !near(k.x, k.y)) continue;
      const [cx, cy] = kilnCentre(k);
      out.push({ x: cx, y: cy, radius: OVEN_REACH, strength: k.jobs.length ? KILN_GLOW_FIRING : KILN_GLOW });
    }
    for (const sm of this.smelters.values()) {
      if (!sm.lit || !near(sm.x, sm.y)) continue;
      const [cx, cy] = smelterCentre(sm);
      out.push({ x: cx, y: cy, radius: OVEN_REACH, strength: 0.85 });
    }
    // The two that carry a light of their own.
    for (const c of this.creatures.list.values()) {
      const glow = this.creatures.species(c).glow;
      if (glow && near(c.x, c.y)) out.push({ x: c.x, y: c.y, radius: glow, strength: 0.7, steady: true });
      // The Glimmoth line's lantern belly: a light to see it by, and nothing else (`glow` is silver's bane on the island).
      else if (c.species === 'wicka' && near(c.x, c.y)) out.push({ x: c.x, y: c.y, radius: MOTH_LIGHT, strength: 0.5, steady: true });
    }
    for (const l of this.spellLights) out.push(l);
    // A mote swirl's own small glow, soft as a spell's (`swirlLight`).
    if (this.swirls.size) for (const s of this.swirls.values()) if (near(s.x, s.y)) out.push(swirlLight(s));
    // The runestones' runes, round the middle of each (`runestoneLight`).
    if (hasRunestones(this.world.w)) {
      for (const s of RUNESTONES) {
        const p = stonePoint(s, this.world.w);
        if (near(p.x, p.y)) out.push(runestoneLight(p.x, p.y));
      }
    }
    // And the rune gates a citizen of their settlement is passing through, as lit as each is (`runegate.ts`).
    out.push(...runeGateLights(this, performance.now() / 1000, near));
    return out;
  }

  /**
   * What lights a cellar, which is dark at every hour: what you carry alight
   * down there, a lantern or a torch, out to its reach; and by day the
   * daylight coming down every flight or ladder into one, round its foot
   * (`CELLAR_DAYLIGHT`), as strong as the day is.
   */
  cellarLights(): LightSource[] {
    const out: LightSource[] = [];
    const held = this.heldLight();
    if (held && this.player.level < 0) {
      out.push({ x: this.player.x, y: this.player.y, radius: heldReachOf(held), strength: 0.94, steady: held.id !== 'torch', level: CELLAR_LEVEL });
    }
    const day = 1 - this.darkness();
    if (day <= 0.01) return out;
    for (const c of this.buildings.cellars.values()) {
      if (!this.buildings.flightDown(c.x, c.y)) continue;
      out.push({ x: c.x + 0.5, y: c.y + 0.5, radius: CELLAR_DAYLIGHT, strength: 0.72 * day, steady: true, cast: '222, 232, 255', castAlpha: 0.1 * day, level: CELLAR_LEVEL });
    }
    return out;
  }

  /**
   * Everything actually burning, whatever the hour. `lights` answers a
   * different question — what is pushing back the dark — so it is empty at
   * noon and counts a lantern and a glowing wildermon among its answers. A
   * fire smokes whether or not anyone needs the light of it, and by day is
   * when you can see that it does.
   */
  fires(): Array<{ x: number; y: number; heat: number; lift?: number; plume?: Plume }> {
    const out: Array<{ x: number; y: number; heat: number; lift?: number; plume?: Plume }> = [];
    const px = this.player.x;
    const py = this.player.y;
    const near = (x: number, y: number): boolean => Math.abs(x - px) < 60 && Math.abs(y - py) < 60;
    for (const f of this.campfires.values()) {
      if (!f.lit || !near(f.x, f.y)) continue;
      const [cx, cy] = fireCentre(f);
      out.push({ x: cx, y: cy, heat: 0.7 });
    }
    for (const f of this.furniture.values()) {
      // A candle behind glass is not a fire, and sends up no smoke.
      if (!f.lit || isLampPiece(f) || !near(f.x, f.y)) continue;
      const [cx, cy] = furnitureCentre(f);
      out.push({ x: cx, y: cy, heat: 0.62 });
    }
    // Out of the head of a kiln's vent and a smelter's stack, not off the ground.
    for (const k of this.kilns.values()) {
      if (!k.lit || !near(k.x, k.y)) continue;
      const [cx, cy] = kilnCentre(k);
      out.push({ x: cx, y: cy - KILN_VENT_BACK, heat: 0.85, lift: KILN_VENT_UP, plume: k.jobs.length ? KILN_PLUME_FIRING : KILN_PLUME });
    }
    for (const sm of this.smelters.values()) {
      if (!sm.lit || !near(sm.x, sm.y)) continue;
      const [cx, cy] = smelterCentre(sm);
      out.push({ x: cx, y: cy - SMELTER_STACK_BACK, heat: 1, lift: SMELTER_STACK_UP, plume: sm.jobs.length ? SMELTER_PLUME_WORKING : SMELTER_PLUME });
    }
    return out;
  }

  /** Hours since midnight, 0 up to 24. */
  hourOfDay(): number {
    const secs = this.islandClock ? this.islandClock() : this.time;
    return ((((secs % DAY_SECONDS) + DAY_SECONDS) % DAY_SECONDS) / DAY_SECONDS) * 24;
  }

  /** The clock as it reads on the hud: "06:30". */
  clock(): string {
    const h = this.hourOfDay();
    const m = Math.floor((h % 1) * 60);
    return `${Math.floor(h).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  /**
   * How dark it is out, 0 in broad day and 1 at the dead of night, with an
   * hour of dusk and an hour of dawn between the two.
   */
  darkness(): number {
    return darknessAt(this.hourOfDay());
  }

  isNight(): boolean {
    return this.darkness() > NIGHT_FROM;
  }

  /** What every piece you wear and hold of one enchantment comes to together, to its cap (`wornEnchant`, the island's `worn_enchant`). */
  wornEnchant(effect: EnchantEffect): number {
    return wornEnchant(Object.values(this.player.equipped).map((uid) => (uid === null || uid === undefined ? null : this.inventory.get(uid))), effect);
  }

  /** What hunger and thirst fall at: a body's own rate times Power's Enduring and a Hearthbound worn (`body_settle`). */
  upkeepMul(): number {
    return this.pathFx('upkeep', 1) * (1 - this.wornEnchant('upkeep'));
  }

  /** What a Steady Heart worn makes of the wind coming back (`body_settle`). */
  windMul(): number {
    return 1 + this.wornEnchant('wind');
  }

  /** What is left of a blow of this kind after the Stoneskin and Emberward you wear (`enchant_guard`). */
  enchantTaken(kind: WoundKind): number {
    return (1 - this.wornEnchant('guard')) * (kind === 'burn' ? 1 - this.wornEnchant('fireguard') : 1);
  }

  /** How far a hunter notices you from, as a share of how far it would: less at night in a Shadowcloak (`enchant_shadow`). */
  shadowNotice(): number {
    return this.isNight() ? 1 - Math.min(1, this.wornEnchant('shadow')) : 1;
  }

  /**
   * Sleep until morning. The world does not stop for it: fires burn down,
   * crops come on and everything left outside ages by however long you slept.
   */
  sleepUntilMorning(rest: number, what: string, dream = 0): void {
    const h = this.hourOfDay();
    const wake = DAWN + WAKE_AFTER_DAWN;
    const hours = h < wake ? wake - h : 24 - h + wake;
    const seconds = (hours / 24) * DAY_SECONDS;
    /*
     * On an island the night belongs to everybody standing in it.
     *
     * Winding this browser's clock on to dawn was honest while the clock was
     * this browser's. It is the island's now, and one sleeper cannot move the
     * sun for the rest of them — so the rest is still banked and the sun is
     * left where it stands. The line below says which of the two happened
     * rather than reporting a morning that did not come.
     */
    const skipped = !this.islandClock;
    if (skipped) {
      this.time += seconds;
      // A night in the fields at the season's share, as every waking second is (`update`).
      this.fieldTime += seconds * fieldRate(this.wallNow());
      this.handTime += seconds * handRate(this.wallNow());
      // Everything that works by itself carries on working while you are under.
      if (this.campfires.size) this.burnFires(seconds);
      if (this.smelters.size) this.runSmelters(seconds);
      if (this.kilns.size) this.runKilns(seconds);
      if (this.furniture.size) this.runPlaceables(seconds);
      if (this.furniture.size) burnLamps(this, seconds, true);
      if (this.posts.size) this.runPosts(seconds);
      if (this.traps.size) this.runTraps(seconds);
      if (this.crops.size || this.planted.size) this.growCrops();
      if (this.ground.size || this.cellarGround.size) this.applyDecay(seconds);
    }
    const s = this.player.stats;
    s.stamina = 1;
    s.health = Math.min(1, s.health + 0.25 * rest);
    // Sleeping is hungry work, and a night is a long time to go without water.
    s.hunger = Math.max(0, s.hunger - 0.2);
    s.thirst = Math.max(0, s.thirst - 0.25);
    this.gainSkill('body_stamina', 0.3 * rest);
    // A good bed banks more of the night than a poor one, and a Dreamweave in it more again.
    const banked = this.bankRest(seconds, rest, dream);
    const bank = banked > 1 ? ` Rested: ${clockLeft(this.player.rested)}, skill gain ×${REST_MULT}.` : '';
    this.logMsg(
      skipped
        ? `Slept in the ${what}: woke at ${this.clock()}.${bank}`
        : `Dozed in the ${what}. Time ${this.clock()}: the night is not skipped while others are on the island.${bank}`,
      'event',
    );
    this.events.emit('world', this.player.tileX, this.player.tileY);
  }

  /** Soul strength's points of tame chance (`tame_chance`). */
  soulBonus(): number {
    return soulTameAbove(this.skills.get('soul_strength') - CHAR_START);
  }

  /** Soul strength's multiplier on favour per prayer, Calm per sitting and a Beastmaster spell's heal, blow and bonus (`soul_mul`). */
  soulMul(): number {
    return soulAbove(this.skills.get('soul_strength') - CHAR_START);
  }

  /** Steepest step the player can take, which climbing raises, and Power's Sure Feet on top of it. */
  climbStep(): number {
    return (MAX_STEP + this.skills.get('climbing') * CLIMB_PER_LEVEL) * this.pathFx('climb', 1);
  }

  /** Steepest drop the player can step down on foot: the step up, or any at all for Power's Sure Fall. */
  dropStep(): number {
    return this.pathFx('drop', 0) > 0 ? Infinity : this.climbStep();
  }

  /** Steepest tile the player can stand on, which climbing raises at the rate it raises the step. */
  standSlope(): number {
    return MAX_STAND + this.skills.get('climbing') * CLIMB_PER_LEVEL;
  }

  /** What a full table is worth to you on what you learn: `TABLE_BEST`, or a Cook's Balanced Diet. */
  tableBest(): number {
    return Math.max(TABLE_BEST, this.perk('table:best', TABLE_BEST));
  }

  /** Raise a skill and announce it. Returns the gain. */
  /**
   * How much faster a trade goes into you than it otherwise would: doubled
   * while there is rest left to burn, and lifted again by whatever you have
   * eaten that favours it.
   */
  skillMult(id: string): number {
    let mult = this.player.rested > 0 ? REST_MULT : 1;
    // A knack earned on the way up never wears off, unlike a meal or a night's sleep.
    mult += knackBonus(this.player.knacks[id]);
    // And the stone you wear, worth a knack on the one trade it favours.
    // A jewel worn, and a circlet on the head, for each stone of theirs that favours it.
    mult += jewelGain(this.worn('jewel'), id) + jewelGain(this.worn('head'), id);
    // And a Scholar's Band worn, on every trade.
    mult += this.wornEnchant('learn');
    // And a reader's Attentive, for good, and a Clarity while it lasts (`meditation.ts`).
    mult += this.pathFx('learn', 0);
    if (this.player.clarityUntil > this.time) mult += PATH_PICK_BY_ID.get('knowledge_clarity')?.fx.more ?? 0;
    // A table with all four things on it is worth a fifth more on everything.
    // It reads off the worst of the four, so bread alone buys nothing.
    mult *= tableMul(this.player.nutrition, this.tableBest());
    for (const b of this.player.boons) if (b.skill === id && b.until > this.time) mult += b.bonus;
    // And a bauble for the trade in the altar of the settlement you are working on.
    return mult * baubleLearn(this.baubleHere(), id);
  }

  /**
   * What a reader's Quick Study makes of a gain: the first in each skill on
   * each day of the island's clock is worth `first` times what it would be,
   * and the day is written down against the skill. The island's `skill_raise`
   * does the same.
   */
  /** Which of the island's days it is (`DAY_SECONDS` each), on its clock when there is one: what a worker's ledger is kept by (`ledgerAdd`). The island's `island_day`. */
  islandDay(): number {
    return Math.floor((this.islandClock ? this.islandClock() : this.time) / DAY_SECONDS);
  }

  /**
   * Love's Bloom, at the end of a sitting: every tree within its reach of you
   * a stage on (`LAND_GROWS`), once a day of the island's clock -- the first
   * sitting that finds one to grow. How many grew. The island's `path_bloom`.
   */
  bloomSitting(): number {
    const r = this.pathFx('bloom', 0);
    if (r <= 0) return 0;
    const day = Math.floor((this.islandClock ? this.islandClock() : this.time) / DAY_SECONDS);
    if (this.player.pathTimes.bloom === day) return 0;
    const next = new Map(LAND_GROWS);
    const { x: px, y: py } = this.player;
    let n = 0;
    for (let ty = Math.max(0, Math.floor(py - r)); ty <= Math.min(this.world.h - 1, Math.floor(py + r)); ty++) {
      for (let tx = Math.max(0, Math.floor(px - r)); tx <= Math.min(this.world.w - 1, Math.floor(px + r)); tx++) {
        if ((tx + 0.5 - px) ** 2 + (ty + 0.5 - py) ** 2 > r * r || this.world.getTile(tx, ty) !== TileType.Tree) continue;
        const data = this.world.getData(tx, ty);
        const to = next.get(treeVariant(data));
        if (to === undefined) continue;
        this.world.setTile(tx, ty, TileType.Tree, packTreeData(treeSpecies(data), to));
        this.events.emit('world', tx, ty);
        n++;
      }
    }
    if (n) this.player.pathTimes.bloom = day;
    return n;
  }

  private firstOfDay(id: string): number {
    const first = this.pathFx('first', 1);
    if (first === 1) return 1;
    const day = Math.floor((this.islandClock ? this.islandClock() : this.time) / DAY_SECONDS);
    if (this.player.studied[id] === day) return 1;
    this.player.studied[id] = day;
    return first;
  }

  /**
   * A knack from a go at a trade: one in five thousand, whatever the level and
   * whatever the go -- and for the trades taught a tick at a time on the move,
   * the share of a go the tick teaches (`knackChance`). It lands usually in
   * that trade and sometimes in one beside it. They are permanent and they
   * stack, up to five to a trade, which is half again on everything that trade
   * teaches you.
   */
  private earnKnacks(skill: string, base: number): void {
    // A Knackstone worn multiplies with a reader's Polymath (`earn_knacks`).
    if (this.rand() >= knackChance(skill, base, this.pathFx('knack', 1) * (1 + this.wornEnchant('knack')))) return;
    const id = knackLands(skill, this.rand);
    const had = this.player.knacks[id] ?? 0;
    if (had >= KNACK_CAP) return;
    this.player.knacks[id] = had + 1;
    const def = SKILL_DEFS.find((d) => d.id === id);
    this.logMsg(
      `Knack: ${def?.name.toLowerCase() ?? id}, skill gain +${Math.round(knackBonus(had + 1) * 100)}%.`,
      'skill',
    );
    this.note('knack');
  }

  /** Titles this level has earned that were not earned before, worn if you have none. */
  private earnTitles(skill: string, before: number, after: number): void {
    for (const t of earnedBy(skill, after)) {
      if (before >= t.at || this.player.titles.includes(t.id)) continue;
      this.player.titles.push(t.id);
      if (!this.player.title) this.player.title = t.id;
      this.logMsg(`Title earned: ${t.name}. (Skills window to wear it)`, 'skill');
      this.note('title');
    }
  }

  /** Wear one of the titles you have earned, or none at all. */
  wearTitle(id: string | null): void {
    if (id !== null && !this.player.titles.includes(id)) return;
    this.player.title = id;
    // And tell the island, which keeps it. Without this the chip lights up
    // and the next heartbeat puts it back: the island reports `title` on
    // every beat and had never been told this one changed.
    this.woreTitle?.(id);
    this.events.emit('skill', '', 0);
  }

  /** Set by the island, when there is one, to carry a title across. */
  woreTitle?: (id: string | null) => void;

  /**
   * Set by the island, when there is one, to carry the two crafting settings
   * across -- `fromStores` and `spareRare` -- whenever Settings changes one.
   * The island spends the stock when a job settles, so its copy is the one
   * that counts there.
   */
  craftPrefsChanged?: () => void;
  /** The graphics settings changed: the screen is sized again for them. */
  graphicsChanged?: () => void;
  /** Leave each layer of the picture out in turn and write down the frame rate without it (`Timings.measure`). */
  measureDrawing?: () => void;

  /**
   * And the two fighting ones -- `fightStance` and `fightBack` -- for the same
   * reason: the island lands the blows, so its copy is the one that counts.
   */
  fightPrefsChanged?: () => void;

  /** Stand the next way round (`FIGHT_STANCES`), and say what it does. */
  cycleStance(): void {
    const s = nextStance(this.settings.fightStance);
    this.settings.fightStance = s;
    this.fightPrefsChanged?.();
    this.logMsg(`${FIGHT_STANCE_NAMES[s]} stance: ${stanceSays(s)}`, 'info');
    this.events.emit('stats');
  }

  /** The creature marked to fight, by a click or by the key that picks the nearest; null for none. */
  marked: number | null = null;

  /** When the island last said a blow of yours was critical, for the number that follows it. */
  private critAt = -Infinity;
  /** Whether the next number dealt is a critical one the island has just told of; asking spends it. */
  critPending(): boolean {
    const was = this.time - this.critAt < 2;
    this.critAt = -Infinity;
    return was;
  }

  /** Mark the nearest foe within `TARGET_RANGE`, or the next nearest after the one already marked. */
  markNext(): Creature | null {
    const p = this.player;
    const foes = [...this.creatures.list.values()]
      .filter((c) => this.hostile(c) && Math.hypot(c.x - p.x, c.y - p.y) <= TARGET_RANGE)
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    if (!foes.length) {
      this.logMsg(`No attackers within ${TARGET_RANGE} tiles.`, 'info');
      return null;
    }
    const at = foes.findIndex((c) => c.id === this.marked);
    const next = foes[(at + 1) % foes.length];
    this.marked = next.id;
    const def = this.creatures.species(next);
    this.logMsg(`Target: ${def.name.toLowerCase()}, ${Math.round(Math.hypot(next.x - p.x, next.y - p.y))} tiles, ${Math.ceil(next.health)} health.`, 'fight');
    return next;
  }

  /** Whether a bow is being drawn just now, which a walk does not interrupt. */
  drawingBow(): boolean {
    const a = this.action;
    return !!a && a.def.id === 'shoot_creature' && a.state === 'performing';
  }

  /**
   * Whether you are in a fight: a fight is the job in hand, or something wild
   * and alive is hunting you. The island asks the same in `telestone_refusal`.
   */
  inAFight(): boolean {
    if (isFightJob(this.action?.def.id)) return true;
    for (const c of this.creatures.list.values()) if (c.mode === 'wild' && c.enemy === PLAYER_ATTACKER && c.health > 0) return true;
    return false;
  }

  /** What follows you, when anything does: on an island, only one the island says is yours. */
  companion(): Creature | null {
    return this.creatures.active() ?? null;
  }

  /** Send your companion at what you are fighting, or have marked, or else the nearest foe (`order_attack`). */
  orderAttack(): void {
    const c = this.companion();
    const def = ACTION_BY_ID.get('order_attack');
    if (!c || !def) {
      this.logMsg('Nothing following you.', 'info');
      return;
    }
    const foe = this.fightTarget ?? this.marked ?? this.nearestHostile()?.id;
    this.requestAction(def, { kind: 'creature', id: c.id, ...(foe === undefined || foe === null ? {} : { foe }) });
  }

  /** Call your companion out of its fight to your side (`order_heel`). */
  orderHeel(): void {
    const c = this.companion();
    const def = ACTION_BY_ID.get('order_heel');
    if (!c || !def) {
      this.logMsg('Nothing following you.', 'info');
      return;
    }
    this.requestAction(def, { kind: 'creature', id: c.id });
  }

  /** Fight what is marked, if it is still there to fight, or else the nearest foe. */
  fightMarked(): void {
    const c = this.marked !== null ? this.creatures.get(this.marked) : undefined;
    const foe = c && c.mode === 'wild' && c.health > 0 ? c : this.nearestHostile();
    if (!foe) {
      this.logMsg(`No attackers within ${TARGET_RANGE} tiles. Click a target or mark one first.`, 'info');
      return;
    }
    this.marked = foe.id;
    this.engage(foe.id);
  }

  /**
   * What this body last said out loud, for the bubble over its own head.
   *
   * Everybody else's lives on their `Peer`, which is where everything drawn
   * about somebody else lives. The one body the roster does not hold is this
   * one, so it keeps its own — and it is here rather than on `player` because
   * `player` is swapped between actors on a shared machine and what was said
   * belongs to the screen, not to whichever body it is pointing at.
   */
  saidAloud: { text: string; at: number } | null = null;
  /**
   * What spells are lighting this frame (a Kindler's bolt in flight, a
   * blessing on the ground), set by the renderer each frame (`SpellStage`)
   * and handed on with everything else alight by `lights`.
   */
  spellLights: readonly LightSource[] = [];

  /** The title being worn, written out. */
  titleName(): string | null {
    return this.player.title ? TITLE_BY_ID.get(this.player.title)?.name ?? null : null;
  }

  /** Everything running on you just now, for the hud to put up. */
  activeBoons(): Boon[] {
    return this.player.boons.filter((b) => b.until > this.time);
  }

  /**
   * Eat or drink something that favours a trade, and be better at it for a
   * while. A second helping of the same thing puts the clock back rather
   * than stacking on itself.
   */
  grantBoon(itemId: string, ql: number, knack = 1): string | null {
    // A knack comes off something somebody made. A berry off a bush is food.
    if (!knackable(itemId)) return null;
    const skill = boonOf(this.seed, itemId);
    if (!skill) return null;
    // And lasts longer for its maker's hand in it (a Cook's Flavoursome, Strong Brew), and for Love's Long Table.
    const seconds = boonTime(itemId, ql, knack) * this.pathFx('table', 1);
    const def = SKILL_DEFS.find((d) => d.id === skill);
    // A dish's own, never a tincture's: the two stand side by side.
    const already = this.player.boons.find((b) => b.skill === skill && !b.kind && b.until > this.time);
    if (already) already.until = Math.max(already.until, this.time + seconds);
    else this.player.boons.push({ skill, bonus: BOON_BONUS, until: this.time + seconds, from: itemName({ id: itemId, uid: 0, ql, dmg: 0, count: 1 }) });
    // Keep the list from growing without end as things run out.
    this.player.boons = this.player.boons.filter((b) => b.until > this.time);
    this.events.emit('inventory');
    return def ? `${def.name} comes easier for the next ${clockLeft(seconds)}.` : null;
  }

  /**
   * A Naturalist's tincture taken: each of its trades goes in faster for a
   * while, beside whatever a dish is doing for it. A second one puts the clock
   * back on the first rather than stacking on it.
   */
  takeTincture(): void {
    const until = this.time + TINCTURE_SECONDS;
    for (const skill of TINCTURE_SKILLS) {
      const already = this.player.boons.find((b) => b.skill === skill && b.kind === 'tincture' && b.until > this.time);
      if (already) already.until = Math.max(already.until, until);
      else this.player.boons.push({ skill, bonus: TINCTURE_BONUS, until, from: itemDef('tincture').name.toLowerCase(), kind: 'tincture' });
    }
    this.player.boons = this.player.boons.filter((b) => b.until > this.time);
    this.events.emit('inventory');
  }

  /**
   * What a helping actually puts into you. Raw food feeds one of the four a
   * little; a cooked dish feeds several, and better food feeds them fuller.
   * Returns a word about it when something has been filled right up, since
   * that is the moment worth knowing about.
   */
  nourish(itemId: string, ql: number, feed = 1): string | null {
    const feeds = itemDef(itemId).feeds;
    if (!feeds) return null;
    const n = this.player.nutrition;
    // And more of it for its maker's hand in it (a Cook's Hearty).
    const share = helpingOf(ql) * feed;
    const filled: string[] = [];
    for (const k of NUTRIENTS) {
      const gain = (feeds[k] ?? 0) * share;
      if (gain <= 0) continue;
      const was = n[k];
      n[k] = Math.min(1, was + gain);
      if (n[k] >= 1 && was < 1) filled.push(NUTRIENT_NAMES[k].toLowerCase());
    }
    if (!filled.length) return null;
    const all = NUTRIENTS.every((k) => n[k] >= 1);
    if (all) return `All nutrients full: skill gain +${percent(this.tableBest())} while it lasts.`;
    return `Full: ${filled.join(' and ')}.`;
  }

  /** Bank a night's sleep as rest, up to the hour that will stay banked. */
  bankRest(seconds: number, quality: number, dream = 0): number {
    const before = this.player.rested;
    // What a Dreamweave in the bed adds, to the night and to the most that is held.
    this.player.rested = Math.max(before, Math.min(REST_CAP * (1 + dream), before + seconds * REST_PER_SECOND * quality * (1 + dream)));
    return this.player.rested - before;
  }

  gainSkill(id: string, base = ORDINARY_GAIN): number {
    const def = SKILL_DEFS.find((d) => d.id === id);
    const before = this.skills.standing(id);
    const gain = this.skills.gain(id, base * this.skillMult(id) * this.firstOfDay(id), this.rand);
    // The last stretch of a skill moves in ten-thousandths, and a player at
    // ninety-nine deserves to see that it is moving at all.
    if (gain <= 0.000005 || !def) return gain;
    const now = this.skills.standing(id);
    // What you pick up in the background says less about itself than what you set out to do.
    if (isQuiet(id)) {
      if (Math.floor(now) > Math.floor(before)) {
        const room = id === 'mind_logic' && queueCapAt(now) > queueCapAt(before);
        this.logMsg(`${def.name}: ${Math.floor(now)}.${room ? ` Action queue: ${queueCapAt(now)}.` : ''}`, 'skill');
      }
    } else {
      const places = gain < 0.0001 ? 6 : 4;
      this.logMsg(`${def.name} ${now.toFixed(4)} (+${gain.toFixed(places)}).`, 'skill');
    }
    /*
     * A knack and a title are the island's to hand out where there is one.
     *
     * `earn_knacks` and `earn_titles` run over there, off every raise the
     * island makes. Both rolling would be two knacks for one go and a title
     * announced twice, and then the next answer disagreeing with whichever of
     * them wrote last.
     */
    if (!this.bodyFromIsland) {
      this.earnKnacks(id, base);
      this.earnTitles(id, before, now);
    }
    this.events.emit('skill', id, gain);
    return gain;
  }

  /**
   * Tell whoever is acting what just happened to them.
   *
   * Every one of these lines is in the second person — *you dig a hole*, *your
   * pick is blunt* — and every one of them was written on the assumption that
   * there is one *you*. There still is, per line: it is whoever the game is
   * acting as when the line is written, which is exactly who the line is
   * about. A guest's news goes home to their machine and never appears in the
   * host's log, which is right: the host did not dig that hole.
   */
  logMsg(text: string, kind: LogKind = 'info'): void {
    this.acting.hear(text, kind);
  }

  /**
   * Put a line on this machine's own screen. Where the local player's news
   * ends up.
   *
   * `at` is when the island says it was said, in milliseconds. Left out for
   * anything this machine came up with itself, which is now.
   *
   * Reported: *"when logging in, all prior world chats default to the login
   * timestamp."* They did — every line came through here and was stamped with
   * the moment it arrived, so a conversation from this morning read back as
   * sixty lines all said at once, at the second somebody opened the page.
   */
  write(text: string, kind: LogKind = 'info', at?: number): void {
    // A fight is going on from its first blow until `FIGHT_QUIET` seconds pass without one.
    if (kind === 'fight') this.fightGoing();
    // And a critical one is drawn larger, when the island's word of it comes before its number (`critPending`).
    if (kind === 'fight' && / a critical (blow|hit)/.test(text)) this.critAt = this.time;
    // And what is learned in one is folded into the line at its end (`compactFight`).
    const rec = this.fightRec;
    if (kind === 'skill' && rec && this.settings.compactFight) {
      const line = skillLine(text);
      if (line) {
        rec.skills.set(line.skill, (rec.skills.get(line.skill) ?? 0) + line.gain);
        return;
      }
    }
    const entry: LogEntry = { time: at ?? Date.now(), text, kind };
    this.log.push(entry);
    trimLog(this.log);
    this.events.emit('log', entry);
  }

  /**
   * Do something as somebody else: their body, their pack, their skills, for
   * the length of one call and no longer.
   *
   * Nested swaps are fine and are what happens when one person's action stirs
   * another's — the previous actor is put back, not the local one. The
   * `finally` is the whole safety of the thing: an action that throws must not
   * leave the island wearing a guest's arms.
   */
  as<T>(actor: Actor, fn: () => T): T {
    const was = this.acting;
    this.acting = actor;
    this.player = actor.player;
    this.inventory = actor.inventory;
    this.skills = actor.skills;
    try {
      return fn();
    } finally {
      this.acting = was;
      this.player = was.player;
      this.inventory = was.inventory;
      this.skills = was.skills;
    }
  }

  /** Whoever the game is acting as this instant. */
  get actor(): Actor {
    return this.acting;
  }

  /**
   * Somebody has arrived and wants a body. They get an empty one: a guest
   * wearing a copy of the host's pack would be a guest handed the host's tools.
   */
  welcome(id: PeerId, who: string, name: string, hear: Actor['hear']): Actor {
    const had = this.actors.get(id);
    if (had) return had;
    const actor = Actor.arriving(id, who, name, this.spawn.x + 0.5, this.spawn.y + 0.5, this.inventory.well);
    const kept = this.guestbook.get(who);
    if (kept) {
      // Somebody who has been here before picks up exactly where they left
      // off: the same pack, the same skills, the same spot on the ground.
      readPlayer(actor.player, kept.body);
      actor.player.name = name;
      actor.inventory.items = kept.items.map((it) => ({ ...it }));
      for (const [skill, v] of Object.entries(kept.skills)) actor.skills.values.set(skill, v);
      // Their things came back from the book with the numbers they left
      // wearing; the island counts on from above them.
      for (const it of actor.inventory.items) if (it.uid >= actor.inventory.nextUid) actor.inventory.nextUid = it.uid + 1;
    }
    actor.hear = hear;
    actor.inventory.onChange = () => actor.packed();
    this.actors.set(id, actor);
    return actor;
  }

  /** Whether this island has seen somebody before, and what it remembers of them. */
  remembers(who: string): GuestSave | undefined {
    return this.guestbook.get(who);
  }

  /**
   * Somebody has gone. Their body and their pack go into the guest book
   * rather than onto the ground.
   *
   * They used to be tipped out where they stood, on the reasoning that a guest
   * who quits mid-haul should not take the island's ore with them. That was
   * the right call for a visitor the island would never see again; it is the
   * wrong one now that it will. A pack somebody spent an evening filling is
   * theirs, and it waits for them.
   */
  farewell(id: PeerId): GuestSave | null {
    const actor = this.actors.get(id);
    if (!actor || actor === this.local) return null;
    this.actors.delete(id);
    // Whatever they were in the middle of is not: an action is a moment, and
    // this one is over.
    actor.action = null;
    actor.queue.length = 0;
    const kept = this.guestSave(actor);
    this.guestbook.set(actor.who, kept);
    return kept;
  }

  update(dt: number): void {
    this.time += dt;
    // The fields' clock runs at the share of it the season gives them; on an island it is read off the year instead (`fieldNow`).
    if (!this.islandClock) {
      this.fieldTime += dt * fieldRate(this.wallNow());
      this.handTime += dt * handRate(this.wallNow());
    }
    // A slice of the woods, which keep a real day rather than the world's own.
    this.growTrees(Date.now() / 1000);
    // The fog is the one thing that stays on the machine it belongs to, so it
    // is advanced for the person sitting here and for nobody else.
    this.vision.update();
    // And whatever it has just shown you goes in the field guide.
    this.lookForKinds(dt);
    // Which way the hulls other people are steering point, before anybody aboard one is put on her deck.
    this.trackHelms();
    // Every body on the island walks, tires, heals and gets on with whatever
    // it is doing — each wearing its own arms for the length of its own turn.
    if (this.actors.size > 1) {
      for (const actor of this.actors.values()) this.as(actor, () => this.updateBody(dt));
    } else this.updateBody(dt);
    /*
     * Outside the body loop, and deliberately.
     *
     * `updateBody` runs once per actor on a machine hosting other people, with
     * `this.player` swapped to each of them in turn — and following is one
     * person's, kept on the game rather than on a body. Inside that loop it
     * would walk every guest after whoever you picked.
     */
    if (this.followed) this.updateFollow(dt);
    if (this.travel) this.updateTravel();
    this.updateWorld(dt);
  }

  /** One person's turn: their body, their wind, their wounds, their work. */
  private updateBody(dt: number): void {
    const p = this.player;
    // On a seat you go at your team's pace, in the saddle at your mount's, and
    // on your own feet at your own.
    const driven = this.driving();
    const up = this.mounted();
    const boat = this.afloat();
    p.speedMul = boat ? this.boatSpeed(boat) / BASE_SPEED : driven ? this.vehicleSpeed(driven) / BASE_SPEED : up ? this.mountSpeed(up) / BASE_SPEED : 1;
    // And on your own feet, what a wound to a leg or a foot leaves of your pace (`legPace`).
    p.legPace = legPace(p.wounds);
    // And drawing a bow, a walk at `DRAW_WALK` of it, or more for an Archer's Mobile Archer: the draw goes on as you go.
    p.drawPace = this.drawingBow() ? this.perk('pace:draw', DRAW_WALK) : 1;
    // And quicker while a spell's walk holds, as the island's `travel_speed` lets it be.
    p.spellPace = this.time < this.paceUntil ? this.paceMul : 1;
    // And Power's Long Stride, and a Surge while it holds, which nothing slows (`travel_speed`).
    const surge = this.pathHolds('surge');
    // And quicker in a Featherstep's boots (`travel_speed`).
    p.pathPace = this.pathFx('stride', 1) * (surge ? PATH_PICK_BY_ID.get('power_surge')?.fx.pace ?? 1 : 1) * (1 + this.wornEnchant('stride'));
    p.unslowed = surge;
    // Only wheels feel the ground: a boat is on water and feet are feet.
    p.wheelLoad = driven ? this.vehicleLoad(driven) : 0;
    // And whether your own feet are in the water at all, which is the whole of
    // what deep water is asking. A hull, a cart bed or a saddle is not.
    p.carried = !!(driven || up);
    /*
     * A passenger goes where she goes. The place on her deck is worked out
     * from where her middle is and the way she points, every frame, and the
     * body is put there; nothing it walks is asked. A hull that has gone —
     * taken up, or no longer in the island's answer — leaves nobody aboard.
     */
    const ship = this.aboardShip();
    if (p.aboard !== null && !ship) {
      p.aboard = null;
      p.seat = 0;
    }
    let moved = 0;
    if (ship) {
      p.carried = true;
      p.path = null;
      p.moving = false;
      p.swimming = false;
      p.level = 0;
      [p.x, p.y] = this.passengerSpot(ship, p.seat);
    } else {
      // Nothing under it on its storey: let down onto the highest one under it that has (`footing`).
      if (p.level > 0) p.level = this.footing(p.tileX, p.tileY, p.level);
      const { rule, lift } = this.movement();
      const [fx, fy] = [p.tileX, p.tileY];
      // A deck on piers is walked dry and level, whatever is under it (`piers.ts`); up and down a spiral staircase on its tile (`liftRule`).
      moved = p.update(dt, this.world, rule, this.buildings.pierTiles.size || this.foundations.size ? this.onFloor : undefined, lift);
      if (this.bridges.size && (fx !== p.tileX || fy !== p.tileY)) this.underDeck = this.walksUnder(fx, fy, p.tileX, p.tileY);
    }
    this.acting.stepped = moved;
    /*
     * And the ground under a step on your own feet wears (`WEARS`), in a game
     * of your own. On an island the island counts it, off the walk it is told
     * about (`rpc_move`), and says so when a tile changes; a saddle, a seat or
     * a hull puts no feet on the ground at all.
     */
    if (p.steppedX >= 0) {
      if (!this.bodyFromIsland && !p.carried) this.wearStep(p.steppedX, p.steppedY);
      /*
       * And a tile gone into with the reins or the helm in your hands is a go
       * of Driving or of Sailing. On an island the island pays it, off the
       * walk it is told about (`rpc_move`), as it pays climbing.
       */
      if (!this.bodyFromIsland && driven) this.gainSkill(boat ? SAILING : DRIVING, boat ? SAILING_LEARN : DRIVING_LEARN);
      // And a tile sailed, for the journal (the island's `rpc_move` the same).
      if (driven && boat) this.note('sailed');
      /*
       * And the same tile is a go for every beast in the traces of a large
       * cart or a wagon that learns its own skill by pulling, a Roxxen its
       * driving (`LearnsBy` 'pull', `PULL_LEARN`); nothing for one standing,
       * since only a tile gone into is paid. On an island the island pays it,
       * off the same walk (`rpc_move`).
       */
      if (!this.bodyFromIsland && driven && !boat && furnitureDef(driven.kind).vehicle) {
        for (const c of this.team(driven)) {
          this.creatures.learnBy(this, c, 'pull');
          // And a wildermon harness on it wears a tile (`wildgear.ts`).
          if (c.gear?.harness) this.creatures.wearGear(this, c, 'harness');
        }
      }
      p.steppedX = -1;
      p.steppedY = -1;
    }
    if (boat && furnitureDef(boat.kind).boat?.sail && moved > 0) {
      const w = this.wind();
      if (w.force >= REACH_FORCE && sailWord(this.heading(), w) === 'reaching') this.note('reach');
      const cap = furnitureCapacity(boat);
      if (cap && furnitureUnits(boat) > cap / 2) this.note('laden');
    }

    if (up) this.carryRider(up, dt, moved);
    const s = p.stats;
    // What is in you falls away on its own, and while it is there it holds
    // hunger and thirst off: a body with something behind it goes longer.
    const keep = upkeepMul(p.nutrition);
    for (const k of NUTRIENTS) p.nutrition[k] = Math.max(0, p.nutrition[k] - dt * NUTRIENT_DECAY);
    if (!this.bodyFromIsland) {
      // And slower for Power's Enduring and a Hearthbound worn.
      const upkeep = this.upkeepMul();
      s.hunger = Math.max(0, s.hunger - dt * HUNGER_RATE * keep * upkeep);
      s.thirst = Math.max(0, s.thirst - dt * THIRST_RATE * keep * upkeep);
    } else {
      /*
       * The island's body, drawn forward between one answer and the next.
       *
       * The four bars rode `rpc_settle` and nothing else, so standing still
       * they were up to a minute stale: eat a loaf and the hunger bar sat
       * there and then jumped. The answer is not to ask more often — it is
       * that a body is a function of elapsed time and fixed rates, and this
       * side has every one of them, generated from the same constants the
       * island's are. So the curve is drawn here at the frame rate and the
       * island re-pins it on every answer, exactly as the action bar and a
       * wildermon's leg already work.
       *
       * `bodyForward` is `body_settle` to the letter and deliberately not the
       * richer version above it — see the note on it.
       */
      // Both shares of the bar, which a hardy body has more of (`stamina_bar`).
      const bar = this.staminaBar();
      const wind = this.windRegen() / bar;
      // What the wounds are taking, by the island's own sum — `woundDrain` and
      // `wound_drain` are the same arithmetic over the same table.
      const drain = p.wounds.reduce((n, w) => n + woundDrain(w), 0);
      /*
       * And what the job in hand is costing, spread across it.
       *
       * The island's own sum, not this one's: `spend_wind` says in as many
       * words that it leaves the burden out — "the island does not know what
       * you are carrying" — so `staminaCost` would overshoot for a laden body
       * and be yanked back on every answer. Drawing the island's arithmetic is
       * the whole discipline here.
       */
      const a = this.action;
      const doing = a?.state === 'performing';
      const body = staminaCostAbove(this.skills.get('body_stamina') - CHAR_START);
      // And nothing while Power's Unbroken holds (`spend_wind`).
      const spend = doing && a.def.stamina > 0 && !this.pathHolds('unbroken')
        ? (a.def.stamina * body) / Math.max(0.001, a.duration) / bar
        : 0;
      const now = bodyForward(s, dt, { acting: doing, wind, drain, spend, upkeep: this.upkeepMul() });
      s.hunger = now.hunger;
      s.thirst = now.thirst;
      s.stamina = now.stamina;
      s.health = now.health;
    }

    // What climbing and swimming have earned, and what the armour costs, before the next step.
    p.burden = this.burden();
    /*
     * And whether there is going to be a next step at all. Said once, when it
     * happens: a line a frame while somebody shuffles about under a hill of
     * ore would be the whole event log.
     */
    const stuck = this.stalled();
    if (stuck !== p.stalled) {
      p.stalled = stuck;
      if (stuck) this.logMsg(`Overloaded: ${this.inventory.totalWeight().toFixed(0)} kg. Carry limit ${this.carryLimit().toFixed(0)} kg; over ${(this.carryLimit() * CARRY_STOP).toFixed(0)} kg, speed ×${CARRY_CRAWL}.`, 'error');
      else this.logMsg('No longer overloaded.', 'event');
    }
    p.maxStep = this.climbStep();
    p.maxDrop = this.dropStep();
    p.maxStand = this.standSlope();
    // And faster for a Seal's Coat worn, but never past a walk, which is all the island lets a body cover (`travel_speed`).
    p.swimSpeed = this.swimPace();
    if (p.lastClimb > 0) {
      /*
       * Only ground that would have turned you back at the start teaches you
       * anything, and only to your own feet: a saddle's climb is the beast's,
       * a hull and a cart seat climb nothing, and a bridge deck is not the
       * ground under it.
       *
       * And on an island, not here at all. Reported as climbing going up and
       * then back to one: this raised it into the browser's copy of the book,
       * the island had never raised it, and the book the island sends every
       * beat is the island's -- so the number went up, was written over, and
       * was gone at the next refresh, as swimming's was before it. The island
       * pays it now, off the walk it is told about (`rpc_move`), by this rule.
       */
      if (!this.bodyFromIsland && !p.carried && !this.onWalkedDeck(p.tileX, p.tileY) && p.lastClimb > MAX_STEP * CLIMB_LEARN_FROM) {
        this.gainSkill('climbing', CLIMB_LEARN + (p.lastClimb / MAX_STEP) * CLIMB_LEARN_STEEP);
      }
      p.lastClimb = 0;
    }
    this.checkJournal();
    const performing = this.action?.state === 'performing';
    // Rest only goes while you are working; standing about does not spend it.
    if (performing && this.player.rested > 0) {
      const was = this.player.rested;
      this.player.rested = Math.max(0, was - dt);
      if (was > 0 && this.player.rested === 0) this.logMsg(`Rested ended: normal skill gain.`, 'system');
    }
    if (p.swimming) {
      /*
       * Deep water is its own teacher, and a strong swimmer tires more slowly.
       *
       * All of it is the island's on an island now, down to the telling-off:
       * `swim_wind` and `drown_rate` were crossed the day the body was and
       * called by nothing over there, so deep water cost a body nothing at all
       * — and the trade this raised was raised into a number the next beat
       * threw away, because the island sends the whole book and has never had
       * a `swimming` row to send. An hour of open water, and a refresh put it
       * back to one.
       */
      this.acting.swimClock += dt;
      if (this.acting.swimClock >= 1) {
        this.acting.swimClock = 0;
        if (!this.bodyFromIsland) this.gainSkill('swimming', SWIM_LEARN);
      }
      if (!this.bodyFromIsland) {
        s.stamina = Math.max(0, s.stamina - (dt * this.swimWind()) / this.staminaBar());
        if (s.stamina <= 0) {
          s.health = Math.max(0, s.health - dt * DROWN_RATE);
          if (this.time - this.acting.drownWarning > DROWN_WARN) {
            this.acting.drownWarning = this.time;
            this.logMsg('Drowning: no stamina. Get to shore.', 'error');
          }
        }
      }
    } else if (!performing && !this.bodyFromIsland) {
      // Body stamina is what gets your wind back between jobs.
      const wind = this.windRegen() / this.staminaBar();
      const regen = (moved > 0 ? WIND_WALK : WIND_REST) * wind;
      const starving = s.hunger <= 0 || s.thirst <= 0 ? WIND_STARVING : 1;
      s.stamina = Math.min(1, s.stamina + dt * regen * starving);
      // Nothing knits while it is still open: see to the wound first.
      if (s.hunger > HEAL_FED && s.thirst > HEAL_FED && s.health < 1 && !this.bleeding()) s.health = Math.min(1, s.health + dt * HEAL_RATE);
    }
    /*
     * A light burns only while it is lit; a dark lantern costs nothing to
     * carry. Every lit thing in the pack burns at once, because two torches
     * held to the same night is two torches spent.
     *
     * A lantern that runs out goes dark and waits for another candle. A torch
     * that runs out is gone: there is nothing left of it but char.
     */
    for (const it of this.inventory.items) {
      if (!it.lit || !(HELD_LIGHTS as readonly string[]).includes(it.id)) continue;
      it.charges = Math.max(0, (it.charges ?? 0) - dt);
      if (it.charges > 0) continue;
      it.lit = false;
      // Going dark is what the eye sees, and this side may say so. What
      // becomes of the thing afterwards is the island's word where there is
      // one, and it will say it down the same subscription as everything else.
      if (!this.packFromIsland) {
        if (it.id === 'torch') {
          this.logMsg('Torch burnt out.', 'event');
          this.inventory.remove(it.uid, 1);
        } else {
          this.logMsg('Lantern candle burnt out.', 'event');
        }
      }
      this.events.emit('inventory');
    }
    /*
     * And the wounds themselves, which are the island's where there is one.
     *
     * `tendWounds` closes them, turns them bad and takes the blood out — all
     * three of which `wounds_settle` is already doing over there, off its own
     * clock and its own dice. Running both would close a wound twice as fast
     * and roll for infection twice as often, and then have the next answer
     * disagree with all of it. The blood is drawn forward above, because that
     * lands on a bar somebody is watching; the rest is drawn, not decided.
     */
    if (!this.bodyFromIsland) this.tendWounds(dt);
    // Favour comes back on its own, at a trickle, up to what faith carries.
    const cap = favourCap(this.skills.get(FAITH));
    if (this.player.favour < cap) this.player.favour = Math.min(cap, this.player.favour + dt * FAVOUR_TRICKLE);
    if (s.health <= 0) this.die();

    if (this.player.moving) this.movedAt = this.time;
    this.updateFight();
    this.fightEnding();
    if (this.action) this.updateAction(dt);
  }

  /** The island's own turn: everything there is one of. */
  private updateWorld(dt: number): void {
    if (this.campfires.size) this.burnFires(dt);
    if (this.smelters.size) this.runSmelters(dt);
    if (this.kilns.size) this.runKilns(dt);
    if (this.furniture.size) this.runPlaceables(dt);
    // A lantern post's candle, which on an island is the island's to say has gone out.
    if (this.furniture.size) burnLamps(this, dt, !this.ask);
    if (this.posts.size) this.runPosts(dt);
    // On an island the traps are the island's to roll (`trap_settle`); rolled here, anybody's in view caught for whoever was looking.
    if (this.traps.size && !this.packFromIsland) this.runTraps(dt);
    if (this.crops.size || this.planted.size) this.growCrops();
    this.creatures.update(dt, this);
    // Ground dug or filled this turn under or round a spring's water: settle it again, once.
    this.springs.update(Date.now());

    this.decayClock += dt;
    // On an island what is lying about rots on the island's clock, and every
    // ground answer replaces it; rotting it here as well would take a pile off
    // the screen a second before the next answer put it back, and say so.
    if (this.decayClock >= DECAY_STEP && (this.ground.size || this.cellarGround.size) && !this.bodyFromIsland) {
      this.applyDecay(this.decayClock);
      this.decayClock = 0;
    } else if (this.decayClock >= DECAY_STEP) {
      this.decayClock = 0;
    }
  }

  /**
   * Age everything lying on the ground by `seconds` of real time. Items that
   * reach 100 damage rot away. Returns how many units were lost.
   */
  applyDecay(seconds: number): number {
    const hours = seconds / 3600;
    let lost = 0;
    // The ground, and the floors of the cellars under it, each at what its place is worth.
    for (const [piles, level] of [[this.ground, 0], [this.cellarGround, CELLAR_LEVEL]] as const) for (const [key, pile] of piles) {
      const x = keyX(key);
      const y = keyY(key);
      const mult = this.decayMultiplier(x, y, level);
      // Only a pile that actually lost something is worth telling anybody
      // about. Every pile on the island raised a `world` event on every decay
      // step whether or not a thing on it had moved, which on a settlement
      // with a few hundred piles on it is a few hundred repaints asked for,
      // several times a minute, to say that nothing had happened.
      let changed = false;
      for (let i = pile.length - 1; i >= 0; i--) {
        const item = pile[i];
        item.dmg = Math.min(100, item.dmg + groundDecayRate(item) * hours * mult);
        // A bag sheds the weather: what is in it ages slower than what is not.
        const shelter = itemDef(item.id).shelter;
        if (shelter !== undefined && item.inside?.length) {
          for (let k = item.inside.length - 1; k >= 0; k--) {
            const held = item.inside[k];
            held.dmg = Math.min(100, held.dmg + groundDecayRate(held) * hours * mult * shelter);
            if (held.dmg >= 100) {
              item.inside.splice(k, 1);
              changed = true;
            }
          }
        }
        if (item.dmg >= 100) {
          pile.splice(i, 1);
          lost += item.count;
          changed = true;
          if (seconds < 60 && Math.hypot(x + 0.5 - this.player.x, y + 0.5 - this.player.y) < 16) {
            this.logMsg(`Rotted away: ${itemName(item).toLowerCase()}, on the ${level < 0 ? 'cellar floor' : 'ground'}.`, 'event');
          }
        }
      }
      if (!pile.length) piles.delete(key);
      if (changed) this.events.emit('world', x, y);
    }
    return lost;
  }

  /**
   * How fast things rot at a spot: full speed in the wild, a tenth of that on
   * deed land, and a tenth of whatever that comes to under a roof.
   *
   * The indoor tenth is the whole of what a roof was worth and never gave.
   * A building was a shape with a door in it: the roof tile cost as much as
   * half a wall, took the same work, and did nothing at all for anything left
   * under it. A crate of planks in a closed room now keeps a hundred times as
   * long as one in a field, which is the reason anybody puts a roof on.
   *
   * And on the floor of a cellar, `CELLAR_DECAY` of it in place of the
   * indoor tenth: the slowest there is. The island's `decay_multiplier` and
   * `cellar_sweep` say the same.
   */
  decayMultiplier(x: number, y: number, level = 0): number {
    const out = this.onDeed(x, y) ? DEED_DECAY : 1;
    if (level < 0) return out * CELLAR_DECAY;
    // Under a roof on walls, or on columns: an open hall keeps as a room does (`Buildings.sheltered`).
    return this.buildings.sheltered(0, x, y) ? out * INDOORS_DECAY : out;
  }

  private updateAction(dt: number): void {
    const a = this.action;
    if (!a) return;
    /*
     * A job being watched rather than done. The clock runs so the bar moves
     * between one answer from the island and the next; nothing else happens,
     * because nothing else here is entitled to.
     *
     * The wall clock, from the moment the island's answer put the go at
     * (`began`), and not the frames: frames came a fifth of a second apart
     * zoomed out on a slow machine, each moved the bar a tenth, and the bar
     * fell further behind the island with every one of them.
     */
    if (this.watching) {
      a.elapsed = a.began !== undefined
        ? Math.max(0, Math.min(a.duration, this.wallNow() - a.began))
        : Math.min(a.duration, a.elapsed + dt);
      return;
    }
    /*
     * On the way to a job the island will be asked for. The walking is ours,
     * the deciding is not: arriving is what sends the ask, and after that the
     * island's own answer drives the bar.
     */
    if (this.ask && a.state === 'walking') {
      // A fight is asked for the moment it is in reach, walk done or not, and walked again when it has moved on.
      const foe = this.foeOf(a);
      if (foe && inFightReach(this, a.def.id, foe)) this.player.stop();
      else if (this.player.path) return;
      else if (foe && this.closeOn(a, foe)) return;
      const { def, target, goes } = a;
      this.action = null;
      if (foe ? !inFightReach(this, def.id, foe) : !this.inRange(def, target)) {
        this.logMsg(cellarGate(this, def.id, target) ?? 'You are too far away from that.', 'error');
        this.events.emit('action');
        return;
      }
      this.ask(def, target, goes);
      return;
    }
    const p = this.player;
    if (a.state === 'walking') {
      // Walking off under your own steam used to cancel what you were on your
      // way to do. There is no longer a way to do that without clicking, and a
      // click cancels the action itself, so there is nothing left to catch.
      // A fight begins the moment it is in reach, and goes after one that has moved on.
      const foe = this.foeOf(a);
      if (foe && inFightReach(this, a.def.id, foe)) {
        p.stop();
        this.beginPerform();
        return;
      }
      if (!p.path && foe && this.closeOn(a, foe)) return;
      if (!p.path) {
        if (!foe && this.inRange(a.def, a.target)) this.beginPerform();
        else if (a.waitUntil !== undefined && this.time < a.waitUntil) {
          // A called wildermon is still on its way over.
        } else {
          const pet = a.target.kind === 'creature' ? this.creatures.get(a.target.id) : undefined;
          this.logMsg(a.waitUntil !== undefined && pet ? `${pet.name}: no path to you.`
            : cellarGate(this, a.def.id, a.target) ?? 'You are too far away from that.', 'error');
          this.action = null;
          this.nextInQueue();
          this.events.emit('action');
        }
      }
      return;
    }
    // Walking puts the work down, but not a bow being drawn: that looses on the move (`DRAW_WALK`).
    if (p.moving && a.def.id !== 'shoot_creature') {
      this.cancelAction();
      return;
    }
    // Stillness: a blow that lands in the middle of a sitting ends it, with nothing come of it.
    if (a.def.id === 'meditate' && p.attackedAt > this.time - a.elapsed) {
      this.logMsg(STRUCK_SAID, 'error');
      this.action = null;
      this.nextInQueue();
      this.events.emit('action');
      return;
    }
    a.elapsed += dt;
    if (a.elapsed >= a.duration) this.completeAction();
  }

  private beginPerform(): void {
    const a = this.action;
    if (!a) return;
    // Up top for what is up top and down in the cellar for what is down there, before anything else.
    const reason = cellarGate(this, a.def.id, a.target) ?? a.def.check?.(a.target, this);
    if (reason) {
      this.logMsg(reason, 'error');
      this.action = null;
      this.nextInQueue();
      this.events.emit('action');
      return;
    }
    a.state = 'performing';
    a.elapsed = 0;
    a.duration = this.duration(a.def);
    this.player.stop();
    if (a.target.kind === 'creature') {
      const c = this.creatures.get(a.target.id);
      if (c) c.busyUntil = this.time + a.duration + 0.2;
    }
    // A job with no length to it has no start to speak of.
    if (!a.def.instant) this.logMsg(`${capital(a.def.verb)}.`, 'info');
    this.events.emit('action');
  }

  /**
   * Say what a go sounded like, and where.
   *
   * The place is the target when the job has one out in the world and the
   * body when it does not, because a needle and a hammer both happen where
   * you are standing. The jobs that are not work make no sound at all — the
   * same rule that decides whether they teach the hands anything, asked the
   * same way, so a click that costs nothing stays silent.
   */
  private soundOfWork(def: ActionDef, target: Target): void {
    const kind = strokeOf(def);
    if (!kind) return;
    let x = this.player.x;
    let y = this.player.y;
    if (target.kind === 'tile') {
      x = target.x + 0.5;
      y = target.y + 0.5;
    } else if (target.kind === 'creature') {
      const c = this.creatures.get(target.id);
      if (c) {
        x = c.x;
        y = c.y;
      }
    }
    this.events.emit('work', x, y, kind);
  }

  private completeAction(): void {
    const a = this.action;
    if (!a) return;
    const reason = this.jobReason(a.def, a.target);
    if (reason) {
      this.logMsg(reason, 'error');
      this.action = null;
      this.nextInQueue();
      this.events.emit('action');
      return;
    }
    // Where the work is going, so the renderer can put the effort there. Only
    // work done on the ground or on a beast has a place in the world; filing
    // a nail in your own hands does not.
    if (a.target.kind === 'tile') this.events.emit('strike', a.target.x + 0.5, a.target.y + 0.5);
    else if (a.target.kind === 'creature') {
      const c = this.creatures.get(a.target.id);
      if (c) this.events.emit('strike', c.x, c.y);
    }
    this.soundOfWork(a.def, a.target);
    this.baubleGo = { job: a.def, made: [] };
    this.foreknown = false;
    const again = a.def.perform(a.target, this) === true;
    if (this.foreknown) this.player.foreknow = Math.max(0, this.player.foreknow - 1);
    this.foreknown = false;
    this.sayBaubleGo();
    if (a.def.tool) this.wearTool(a.def.tool, a.def.wear ?? 1);
    // A swing costs what is swung: more for every kilogram in the hand (`fightWind`).
    const cost = this.staminaCost(fightWind(this, a.def) ?? a.def.stamina);
    this.player.stats.stamina = Math.max(0, this.player.stats.stamina - cost / this.staminaBar());
    /*
     * The skill for the go, whether or not the go landed.
     *
     * It was a full measure either way, which made a failed dig and a chip
     * that found no line in the rock worth exactly as much as a good one — and
     * the island pays nothing at all for those, so the two sides disagreed
     * about it by the whole amount. Both say `TRY_LEARN` now: a swing teaches
     * you something, landing it teaches you more.
     */
    /*
     * And nothing at all for the jobs that are not work.
     *
     * Asked for: "no stats should be gained by eating, drinking, or moving
     * items". The wind is still spent below — a cost is not a lesson — but a
     * body that empties a crate into its pack a hundred times is no steadier
     * for it. `TEACHES_NOTHING` is the list, and the island keeps its own.
     *
     * A list is the wrong shape for it, though, and the report that followed
     * said so: "free body control gains from examining as well as
     * keeping/putting back items". Those are two of thirty-two. A list is
     * something somebody has to remember to add to, and every job written
     * since that costs no wind and takes no time — examining a tile, a thing
     * or a beast, locking one back, naming one, setting a stance, choosing a
     * path — was paying a full measure of body control for a click.
     *
     * So that half of it is read off the job instead: a go that costs nothing
     * and takes no time is not work, and the hands learn nothing from it. The
     * list stays for the jobs that do cost something and still teach nothing.
     */
    const isWork = cost > 0 || (a.def.baseTime ?? 0) > 0;
    if (!TEACHES_NOTHING.has(a.def.id)) {
      if (a.def.skill) this.gainSkill(a.def.skill, this.swingMissed ? TRY_LEARN : 1);
      // The body learns from the work itself: wind from spending it, control from doing it.
      if (cost > 0) this.gainSkill('body_stamina', WORK_WIND + cost * WORK_WIND_SPENT);
      if (isWork) this.gainSkill('body_control', WORK_HAND);
      // And the back, from the heavy trades: a shovel or a pick, whatever the go found.
      if (isWork && a.def.skill && HEAVY_SKILLS.has(a.def.skill)) this.gainSkill('body_strength', WORK_BACK);
    }
    this.swingMissed = false;
    if (this.action !== a) {
      // Whatever was performed put something else in hand; leave it alone.
      this.events.emit('action');
      return;
    }
    const counted = a.left !== undefined;
    if (a.left !== undefined) a.left -= 1;
    // A job that says it is finished is finished, count or no count: the tree
    // is down, the wall is built. Everything else is only a matter of wind.
    const done = a.def.repeat ? !again : false;
    const winded = this.player.stats.stamina <= 0.05;
    const more = counted ? (a.left as number) > 0 : again && !!a.def.repeat;
    // Whether it could be started again this moment, so work that has run out
    // of ground stops now, and says so, rather than after another turn of the
    // timer.
    const barred = more && !done && !winded ? this.jobReason(a.def, a.target) : null;
    if (more && !done && !winded && !barred) {
      a.elapsed = 0;
      a.duration = this.duration(a.def);
      this.events.emit('action');
      return;
    }
    if (counted) {
      const did = (a.goes as number) - (a.left as number);
      if (did >= (a.goes as number)) this.logMsg(`Done: ${a.goes}/${a.goes}.`, 'info');
      else if (winded) this.logMsg(`Out of stamina: ${did}/${a.goes} done.`, 'info');
      else if (barred) this.logMsg(`${barred} Done: ${did}/${a.goes}.`, 'info');
      else this.logMsg(`Stopped: ${did}/${a.goes} done.`, 'info');
    } else if (barred) this.logMsg(barred, 'error');
    this.action = null;
    this.nextInQueue();
    this.events.emit('action');
  }

  /**
   * Put down what is in hand without forgetting what was lined up behind it.
   *
   * Walking somewhere used to throw the whole list away. `moveTo` called
   * `cancelAction`, which calls `clearQueue`, so a builder with four walls
   * lined up who stepped three tiles to the woodpile came back to an empty
   * head and four right-clicks to do again. Nothing warned them and nothing
   * could get it back.
   *
   * A walk is a pause now. Whatever was in hand goes back to the *front* of
   * the queue with however many goes it had left, and the whole lot waits.
   * Nothing starts itself again — being dragged back across the yard the
   * moment your feet stopped would be worse than losing the list — so the
   * jobs sit there, the bar says how many and offers to carry on, and
   * `Esc` still forgets the lot, which is what `Esc` has always been for.
   */
  pauseAction(): void {
    const a = this.action;
    if (!a && !this.queue.length) return;
    if (a) {
      this.action = null;
      // A fight is not work to come back to: walking off leaves it, as `rpc_hold` has it.
      if (!isFightJob(a.def.id)) this.queue.unshift({ def: a.def, target: a.target, goes: a.left ?? a.goes });
    }
    this.held = this.queue.length > 0;
    // The island keeps the queue on the player row, so the hold is its
    // business too: `rpc_hold` puts the job in hand back at the front of
    // `act_queue` where `rpc_cancel` would have emptied it.
    this.hold?.();
    this.events.emit('action');
  }

  /**
   * Take the waiting jobs up again. Nothing else does this: it is a button
   * and a key, and that is the point of holding rather than resuming.
   */
  resumeQueue(): boolean {
    if (this.action || !this.queue.length) return false;
    this.held = false;
    const went = this.nextInQueue();
    if (!went) this.events.emit('action');
    return went;
  }

  /**
   * Put the jobs waiting in another order, or take some out (`jobqueue.ts`).
   * The job in hand is not in the list, so it is never moved. On an island the
   * island does it (`rpc_queue_order`) and says the list back; here it is
   * done at once. Returns the refusal, in the island's words, or null.
   */
  putQueueInOrder(seen: SeenJob[], order: number[]): string | null {
    const why = orderRefusal(seen, seenOf(this.queue), order);
    if (why) {
      this.logMsg(why, 'error');
      return why;
    }
    const was = this.queue.slice();
    const dropped = was.filter((_, i) => !order.includes(i)).map((q) => q.def.label);
    this.queue.splice(0, this.queue.length, ...order.map((i) => was[i]));
    if (!this.queue.length) this.held = false;
    if (this.reorder) this.reorder(seen, order);
    else if (dropped.length) this.logMsg(queueDropped(dropped), 'info');
    this.events.emit('action');
    return null;
  }

  /** Said to the island when the list is put in order (`rpc_queue_order`); null in the game you play by yourself. */
  reorder: ((seen: SeenJob[], order: number[]) => void) | null = null;

  /** Whether the jobs in the queue are waiting on you rather than on the job in hand. */
  held = false;

  /**
   * Said to the island when a walk puts the work down, as `stop` is said when
   * something gives it up. Filled in by `play.ts`; null in the game you play
   * by yourself, where there is nobody to tell.
   */
  hold: (() => void) | null = null;

  cancelAction(silent = false): void {
    // Stop is stop: a long walk in legs as well.
    this.travel = null;
    const a = this.action;
    const lined = this.queue.length;
    // Out of the fight as well as the job: nothing goes after it again.
    this.fightTarget = null;
    this.clearQueue(silent || !a);
    if (!a && !lined) return;
    /*
     * And wherever the job really is.
     *
     * Only when there was something to put down — `moveTo` cancels on every
     * click of the ground, and a body walking across an empty field has no
     * business telling the island anything. Not on a silent one either: the
     * only silent cancel is dying, which is the island's own business on an
     * island and has already happened by the time we hear about it.
     */
    if (!silent) this.stop?.();
    if (!a) return;
    this.action = null;
    if (!silent && a.state === 'performing') this.logMsg(`Stopped ${a.def.verb}.`, 'info');
    this.events.emit('action');
  }

  /** Actions that apply to a target, with the reason each may be unavailable. */
  actionsFor(target: Target): Array<{ def: ActionDef; reason: string | null }> {
    const out: Array<{ def: ActionDef; reason: string | null }> = [];
    const grave = graveAt(this, target);
    for (const def of ACTIONS) {
      if (def.hidden || !def.applies(target, this)) continue;
      // Nothing is offered for a crate with a wildermon in it that would be refused.
      if (occupiedRefusal(this, def.id, target)) continue;
      // Nor at a grave, where there is only taking out and only for its owner.
      if (grave && graveSays(this, grave, def.id)) continue;
      // A thing down in a cellar is done from down there, and a thing up top from up top (`cellarGate`).
      out.push({ def, reason: cellarGate(this, def.id, target) ?? def.check?.(target, this) ?? null });
    }
    return out;
  }

  /**
   * Ask for a job. A repeating one may be given a **number of goes**: it stops
   * of its own accord after that many rather than running until your wind
   * gives out, which is most of what a count is for.
   */
  /**
   * Somewhere else to send the asking.
   *
   * On an island kept in Postgres nothing below decides anything: the checks,
   * the roll, the time it takes and the hole at the end all happen there, and
   * this machine's job is to ask and then listen. Setting this is what turns
   * the game from a thing that does into a thing that asks — one seam rather
   * than a second copy of every action.
   */
  ask: ((def: ActionDef, target: Target, goes?: number) => void) | null = null;

  /**
   * And somewhere else to send the putting down.
   *
   * `ask` had no opposite, which meant stopping was the one thing this machine
   * still decided for itself — and it decided it about a copy. Reported: "a
   * player that stops a task locally doesn't stop it on the server, the task
   * continues until completed." The bar went out here and the tree went on
   * falling there.
   */
  stop: (() => void) | null = null;

  /**
   * Whether the body is the island's to keep, rather than this machine's.
   *
   * Hunger, thirst, wind and health fell all session and came back full on a
   * refresh, because the browser was moving its own copy and the island — which
   * is where the row actually lives — had never moved it at all. The island
   * settles the body off a timestamp now, so this side stops moving it and
   * draws what it is told.
   *
   * The rest of `update` stays: nutrition, lights burning down, wounds, the
   * boat and the rider are still worked out here, and the two that matter are
   * plainly marked below.
   */
  bodyFromIsland = false;

  /**
   * Whether the pack is the island's to keep, in the same way.
   *
   * The count-down on a burning thing stays here either way — it is drawing,
   * between one answer and the next, like the action bar. What does not is
   * what happens when it reaches the bottom: the island holds the row, and a
   * browser that quietly drops a spent torch out of the pack is announcing
   * something that did not happen. The next refresh hands it straight back.
   */
  packFromIsland = false;

  /**
   * A job somebody else is doing, shown here so that there is a clock on it.
   *
   * `ask` sends the whole of an action away, which is what makes the island
   * the authority — and left the screen with nothing to draw. There was no
   * progress bar on an island at all: you pressed cut down, the log said "You
   * start cutting down", and then nothing moved for half a minute.
   *
   * So the island says what it is doing and this shows it. The clock runs here
   * and *only* the clock: `updateAction` will not finish a watched job, will
   * not perform it, and will not cancel it because the body moved. Whether it
   * happened is the island's to say, and it says so by stopping telling us
   * about it.
   */
  watching = false;

  /**
   * Put the island's job on the screen, or take it off.
   *
   * `total` is how long the whole go is and `secs` how much of it is left, both
   * worked out by the island — a browser clock that is a minute out would draw
   * a bar that is a minute wrong, and there is no reason to subtract two of the
   * island's timestamps here rather than there.
   */
  showAction(def: ActionDef | null, target: Target | null, total = 0, secs = 0, left?: number, goes?: number): void {
    this.watching = true;
    if (!def) {
      if (this.action) {
        this.action = null;
        this.events.emit('action');
      }
      return;
    }
    const had = this.action;
    const same = had && had.def.id === def.id && had.left === left;
    this.action = {
      def,
      target: target ?? (had?.target as Target) ?? { kind: 'self' } as unknown as Target,
      state: 'performing',
      duration: Math.max(0.001, total),
      elapsed: Math.max(0, Math.min(total, total - secs)),
      // The wall second the go began, as the island counted it: the bar runs off the wall clock from here.
      began: this.wallNow() - Math.max(0, Math.min(total, total - secs)),
      left,
      /*
       * What the island says was asked for, and nothing else.
       *
       * This used to fall back to the count of whatever was in hand before,
       * which is how the bar came to draw "3 of 10" off two numbers from two
       * different jobs: ask for ten while something is in hand and the ask is
       * queued, so nothing here ever heard the ten, and the one it was still
       * holding belonged to the job that had just finished. The island keeps
       * `act_goes` now, through the queue and out the other side.
       */
      goes,
    };
    if (!same) this.events.emit('action');
    // On an island the work is done over there and only reported here, so
    // `completeAction` never runs and the sound has to come off the report.
    // A go has landed when the same job comes back with one fewer to do.
    if (had && had.def.id === def.id && left !== undefined && had.left !== undefined && left < had.left) {
      this.soundOfWork(def, this.action.target);
    }
  }

  /**
   * The last job asked for, for the repeat key (`repeatLast`), with what kind
   * of thing it named so that another of the same can stand in once that one
   * is used up.
   */
  lastAsked: { def: ActionDef; target: Target; goes?: number; was?: string } | null = null;

  /**
   * Ask for the last job again: the same thing done to the same target the
   * same number of times. Asked for: "a repeat last action key ... for some of
   * the more tedious actions like casting nails."
   *
   * It goes through `requestAction` like any other ask, so it is refused, lined
   * up behind the job in hand or walked to exactly as the first one was. A
   * stack the last one used up is stood in for by another of the same kind in
   * the pack (`retarget`, as the queue does), and a name or a yes given the
   * first time is asked for again rather than taken as read.
   */
  repeatLast(): void {
    const last = this.lastAsked;
    if (!last) {
      this.logMsg('Nothing to repeat.', 'info');
      return;
    }
    // And the dye a dyeing drew from: that bucket may be empty now, so it is chosen again.
    const { name: _name, sure: _sure, dyeFrom: _dyeFrom, ...rest } = last.target as Target & { name?: string; sure?: boolean; dyeFrom?: string };
    const target = this.retarget({ target: rest as Target, was: last.was });
    if (!last.def.applies(target, this)) {
      this.logMsg(`Nothing here to ${last.def.label.toLowerCase()}.`, 'error');
      return;
    }
    this.requestAction(last.def, target, last.goes);
  }

  requestAction(def: ActionDef, target: Target, goes?: number): void {
    // Asking for a job is deciding to stop somewhere: a long walk in legs ends here.
    this.travel = null;
    const named = target.kind === 'item' ? target.uid : 'itemUid' in target ? target.itemUid : undefined;
    this.lastAsked = { def, target, goes, was: named !== undefined ? this.inventory.get(named)?.id : undefined };
    // gates: a hidden door asked for is kept only while a plan of a wall on its border is in hand or lined up (`keepHiddenAsks`).
    keepHiddenAsks(this);
    // Examining a wild thing says how a fight with it would go (`consider`), whoever answers the rest.
    if (def.id === 'examine_creature' && target.kind === 'creature') {
      const c = this.creatures.get(target.id);
      const said = c && c.mode === 'wild' ? considerSays(this, c) : null;
      if (said) this.logMsg(said, 'fight');
    }
    // A crate with a wildermon in it is carried, set down or opened, and that is all.
    const held = occupiedRefusal(this, def.id, target);
    if (held) {
      this.logMsg(held, 'error');
      return;
    }
    // A grave opens for whoever lies under it, and only to be emptied. The
    // island asks the same of the same two, in `grave_refusal`.
    const buried = graveRefusal(this, def.id, target);
    if (buried) {
      this.logMsg(buried, 'error');
      return;
    }
    /*
     * A name, or a yes, before anything else.
     *
     * Asked here because this is the one door every way of starting an action
     * goes through — the tile menu, the settlement panel, the toolbelt, the
     * picker a thumb uses. It used to be asked inside `perform`, and on an
     * island `perform` is the island's half: so the name was asked for by the
     * single menu entry that knew about it and by nothing else, and the island
     * was handed an action with no name on it. It made one up for a new
     * settlement and refused to rename an old one, which is both halves of
     * what was reported.
     */
    const asked = target as Target & { name?: string; sure?: boolean };
    if (def.asks && typeof asked.name !== 'string') {
      void this.askName(def, target, goes);
      return;
    }
    if (def.confirms && asked.sure !== true) {
      const question = def.confirms(target, this);
      if (question) {
        void this.askSure(def, target, goes, question);
        return;
      }
    }
    /*
     * Which dye, for a dyeing: of the buckets of dye in the pack and the
     * barrels of it within reach, the one it draws from. Where only one holds
     * enough it is that one, unasked; where none does the job is refused in
     * its own words. Either way the island is told which (`dyeFrom`).
     */
    const litres = def.dyeLitres?.(target, this) ?? null;
    if (litres !== null && dyeChoice(target) === undefined && !def.check?.(target, this)) {
      const from = dyeEnough(this, litres);
      if (from.length > 1) {
        void this.askDye(def, target, goes, litres, from);
        return;
      }
      if (from.length === 1) target = { ...target, dyeFrom: from[0].key } as unknown as Target;
    }
    if (this.ask) {
      /*
       * Walk there first, if it is not already within reach.
       *
       * The island checks the distance and refuses — "You are too far away
       * from that." — which used to be the whole of what happened when you
       * clicked something across the field: the menu opened, you chose, and
       * nothing moved. The single-player game has always walked to the job
       * first, and the walking is the one part of this that is not the
       * island's business: it says where a body may go, and this side does the
       * going.
       *
       * So the ask is held until the feet arrive, and sent from
       * `updateAction`. Nothing about who decides has changed — the island is
       * still asked, and may still say no when we get there.
       */
      const foe = this.foeOf({ def, target });
      if (foe) this.fightTarget = foe.id;
      if (foe ? !inFightReach(this, def.id, foe) : !this.inRange(def, target)) {
        this.action = { def, target, state: 'walking', elapsed: 0, duration: 0, left: goes, goes };
        this.watching = false;
        if (!this.walkToward(def, target)) {
          this.action = null;
          this.logMsg(this.noWayTo(def, target), 'error');
          return;
        }
        this.events.emit('action');
        return;
      }
      this.ask(def, target, goes);
      return;
    }
    /*
     * A thing put into a store across the yard walks to that store first, the
     * way the island's half above does, and is asked when the feet arrive --
     * by `beginPerform`, which asks every job again before doing it.
     */
    const foe = this.foeOf({ def, target });
    if (foe) this.fightTarget = foe.id;
    // And a fight out of reach walks to it first, and is asked again when it is in reach (`closeOn`).
    const walkFirst = (target.kind === 'item' && this.intoStore(def, target) !== null && !this.inRange(def, target))
      || (!!foe && !inFightReach(this, def.id, foe) && !armsRefusal(this, def.id));
    if (!walkFirst) {
      const reason = def.check?.(target, this);
      if (reason) {
        this.logMsg(reason, 'error');
        return;
      }
      if (def.instant) {
        def.perform(target, this);
        return;
      }
    }
    // gates: in the words a hidden door's ask is refused in too (`gates.ts`).
    const spent = this.bodyRefusal(def);
    if (spent) {
      this.logMsg(spent, 'error');
      return;
    }
    /*
     * A fight never waits behind work: what is in hand goes to the front of the
     * line to be picked up after, as a bite puts it, and a fight already in
     * hand gives way to this one. `rpc_act` does the same.
     */
    if (this.action && foe) {
      const was = this.action;
      this.action = null;
      if (!isFightJob(was.def.id)) this.queue.unshift({ def: was.def, target: was.target, goes: was.left ?? was.goes });
      this.startAction(def, target, goes);
      return;
    }
    // Something already in hand: line this one up behind it instead of dropping it.
    if (this.action) {
      // gates: in the words a hidden door's ask is refused in too, when there would be no room for its plan (`gates.ts`).
      const full = this.queueRefusal();
      if (full) {
        this.logMsg(full, 'error');
        return;
      }
      /*
       * What it was, while there is still something to ask. Once the row is
       * gone there is nothing left to ask what kind of thing it had been.
       *
       * Both ways a target can name a thing, which is the whole of the bug
       * reported as "error placing a crate says it's not a crate": a crate
       * does not stack, so five crates are five rows, and five placings
       * queued off one menu entry all named the first of them. The first went
       * down and took its row with it, and the other four were pointed at
       * nothing. `kind: 'item'` carries `uid`; a tile with a thing to put on
       * it carries `itemUid`, and that is what every placing uses.
       */
      const named = target.kind === 'item' ? target.uid
        : 'itemUid' in target ? target.itemUid : undefined;
      const was = named !== undefined ? this.inventory.get(named)?.id : undefined;
      this.queue.push({ def, target, goes, was });
      this.logMsg(`Queued: ${def.label} (${this.queue.length + 1}/${this.queueCapacity()}).`, 'info');
      this.events.emit('action');
      return;
    }
    this.startAction(def, target, goes);
  }

  /**
   * Why this body is too spent for a job now, as asking for one says it, or
   * null: the island's `body_refusal`.
   */
  bodyRefusal(def: ActionDef): string | null {
    return !def.instant && this.player.stats.stamina < EXHAUSTED ? 'Too exhausted. Rest.' : null;
  }

  /**
   * Why another job will not fit in the head now, as asking for one says it,
   * or null: the room `rpc_act` measures on an island, of the job in hand and
   * those lined up behind it.
   */
  queueRefusal(): string | null {
    if (!this.action || this.queueCapacity() - 1 - this.queue.length > 0) return null;
    return `Action queue full: ${this.queueCapacity()}. Mind logic raises it.`;
  }

  /** Put an action in hand and either begin it or start walking to it. */
  private startAction(def: ActionDef, target: Target, goes?: number): void {
    // Anything starting takes the hold off: what is behind it in the queue
    // follows on the way it always has, once this one is done.
    this.held = false;
    this.action = { def, target, state: 'walking', elapsed: 0, duration: this.duration(def), left: goes, goes };
    const foe = this.foeOf(this.action);
    if (foe ? inFightReach(this, def.id, foe) : this.inRange(def, target)) {
      this.beginPerform();
      return;
    }
    /*
     * Within reach is always allowed under any load. Setting off across the
     * deed under one is not.
     *
     * While the load stopped a body outright this took care of itself: the
     * walk was dropped the same frame it was asked for, so the job came
     * straight back with "you are too far away from that" and you knew where
     * you stood. Letting an overloaded body creep took that away — the path
     * survives now, and a job waits on `player.path` going empty, so what used
     * to be an immediate answer became a quarter of an hour of shuffling with
     * the bar sitting there and nothing said. That is worse than the refusal
     * it replaced.
     *
     * So the reach is what changes, not the load: everything you can already
     * touch works exactly as it does unladen — put things down, into a cart,
     * into a crate, anything on the tiles around you — and anything further
     * off says so now instead of setting out at a twentieth of a pace.
     */
    if (this.stalled()) {
      this.logMsg(`Overloaded (${this.inventory.totalWeight().toFixed(0)} kg): cannot walk there. `
        + 'Work within reach or drop something.', 'error');
      this.action = null;
      this.nextInQueue();
      this.events.emit('action');
      return;
    }
    // A tamed wildermon comes to you, rather than being chased around the field.
    const pet = target.kind === 'creature' ? this.creatures.get(target.id) : undefined;
    if (pet && pet.mode !== 'wild' && pet.mode !== 'stored') {
      this.creatures.callToPlayer(this, pet);
      this.action.waitUntil = this.time + CALL_WINDOW;
      this.player.stop();
      this.logMsg(`Called: ${pet.name}.`, 'info');
    } else if (!this.walkToward(def, target)) {
      this.logMsg(this.noWayTo(def, target), 'error');
      this.action = null;
      this.nextInQueue();
    }
    this.events.emit('action');
  }

  /** Take the next job off the queue, if there is one. */
  /**
   * Why a job cannot be done now, or null. The world moves between lining a job
   * up and reaching it: the tree you queued three chops at falls on the first,
   * and there is no sense swinging at the grass it left behind.
   */
  private jobReason(def: ActionDef, target: Target): string | null {
    if (!def.applies(target, this)) return `Nothing here to ${def.label.toLowerCase()}.`;
    return def.check?.(target, this) ?? null;
  }

  /**
   * Point a queued job at another one like it, when the one it named is gone.
   *
   * Queueing three eats means eat three times; the row id was how you pointed
   * at the onion, not which onion you had an appointment with. Nothing is
   * invented — with no other onion in the pack the job is refused exactly as
   * it was, in the same words.
   */
  private retarget(job: { target: Target; was?: string }): Target {
    const t = job.target;
    if (!job.was) return t;
    const uid = t.kind === 'item' ? t.uid : 'itemUid' in t ? t.itemUid : undefined;
    if (uid === undefined || this.inventory.get(uid)) return t;
    const other = this.inventory.items.find((it) => it.id === job.was && !it.locked);
    if (!other) return t;
    if (t.kind === 'item') return { ...t, uid: other.uid };
    // Only the shapes that carry one: `itemUid` is not a field every kind has.
    return { ...t, itemUid: other.uid } as Target;
  }

  private nextInQueue(): boolean {
    const next = this.queue.shift();
    if (!next) return false;
    next.target = this.retarget(next);
    const reason = this.jobReason(next.def, next.target);
    if (reason) {
      this.logMsg(`${next.def.label}: ${reason}`, 'error');
      return this.nextInQueue();
    }
    this.startAction(next.def, next.target, next.goes);
    return true;
  }

  /** Forget everything lined up; moving off or stopping does this. */
  clearQueue(silent = false): void {
    this.held = false;
    if (!this.queue.length) return;
    const n = this.queue.length;
    this.queue.length = 0;
    if (!silent) this.logMsg(`Queue cleared: ${n} ${n === 1 ? 'action' : 'actions'}.`, 'info');
    this.events.emit('action');
  }

  /** Walk to a tile; when the tile itself is blocked, stop next to it. */
  /**
   * Walk there.
   *
   * `keepFollowing` is only ever true from `updateFollow`, which is the one
   * caller that is not you deciding to go somewhere. Everything else — a
   * click, walking home, a job that wants you nearer — is you, and you going
   * somewhere is how anybody stops following without thinking about it.
   */
  moveTo(x: number, y: number, keepFollowing = false, quiet = false, floor?: number): boolean {
    // You going somewhere is a new order: a long walk in legs gives way to it (`travelTo` asks quietly).
    if (!quiet) this.travel = null;
    if (this.player.aboard !== null) {
      if (keepFollowing) this.unfollow();
      else this.logMsg('Aboard as a passenger: step ashore first.', 'error');
      return false;
    }
    if (!keepFollowing) this.unfollow();
    // And out of a fight: going somewhere is how you leave one.
    this.fightTarget = null;
    // Following somebody about is not you deciding to go anywhere, so it
    // gives the work up as it always did. A click is, and a click holds --
    // except a bow being drawn, which goes on drawing as you go (`DRAW_WALK`).
    if (keepFollowing) this.cancelAction();
    else if (!this.drawingBow()) this.pauseAction();
    const p = this.player;
    if (!this.world.inBounds(x, y)) return false;
    const { rule, levels, below, lift } = this.movement();
    // A spiral staircase is walked on foot only: mounted or driving, a walk to its tile stops beside it, and says so.
    if (!quiet && !lift && (this.mounted() || this.driving()) && this.spiralTile(x, y)) this.logMsg(SPIRAL_FOOT_SAID, 'error');
    // Clicked in the cellar's view, the cellar is where you mean; up top, the ground (`walkFloor`); on a pinned storey, that storey.
    const aim = floor ?? this.walkFloor(x, y);
    if (this.world.isPassable(x, y) && (floor === undefined || this.standable(x, y, floor)) && p.walkTo(this.world, x, y, rule, levels, below, aim, lift)) return true;
    // Beside it, on the storey asked for: a storey's floor, not the ground under it.
    const candidates = this.neighbours(x, y).filter((c) => this.world.isPassable(c.x, c.y) && (floor === undefined || this.standable(c.x, c.y, floor)));
    candidates.sort((a, b) => this.distanceToPlayer(a.x, a.y) - this.distanceToPlayer(b.x, b.y));
    for (const c of candidates) if (p.walkTo(this.world, c.x, c.y, rule, levels, below, aim === CELLAR_LEVEL && !this.buildings.cellarDone(c.x, c.y) ? undefined : aim, lift)) return true;
    if (!quiet) {
      if (floor !== undefined && floor > 0 && !candidates.length) this.logMsg(`No floor on storey ${floor + 1}.`, 'error');
      // Mounted, where your own feet would get there: a single staircase, a ladder or a narrow doorway in the way (`rideRule`).
      else if (floor !== undefined && floor > 0 && this.mounted() && this.onFootTo(x, y, floor)) this.logMsg(MOUNT_STAIRS_SAID, 'error');
      else this.logMsg(aim === CELLAR_LEVEL ? this.noWay(x, y, 'No path there.') : 'No path there.', 'error');
    }
    return false;
  }

  /**
   * A long walk, to somewhere further than one path can be found to: a map
   * pin across the island. The pathfinder looks so far and gives up, so a
   * click on the far side of a bay said "You can't find a way there." This
   * walks it a leg at a time, each up to `TRAVEL_LEG` tiles toward the place
   * and shorter where a leg that long finds no way, and sets off on the next
   * as each ends. Any other order -- a click, a job, Stop -- ends it.
   */
  private travel: { x: number; y: number; name: string; best: number; stuck: number } | null = null;

  /** Where a long walk is headed, while one is under way. */
  get travelling(): { x: number; y: number; name: string } | null {
    return this.travel;
  }

  travelTo(x: number, y: number, name: string): boolean {
    this.travel = null;
    const away = Math.round(Math.hypot(x + 0.5 - this.player.x, y + 0.5 - this.player.y));
    if (away < 2) {
      this.logMsg(`Already at ${name}.`, 'info');
      return true;
    }
    if (!this.legToward(x, y)) {
      this.logMsg(`No path to ${name} from here.`, 'error');
      return false;
    }
    this.travel = { x, y, name, best: away, stuck: 0 };
    this.logMsg(`Heading to ${name}: ${away} tiles.`, 'info');
    return true;
  }

  /** Set off on the next leg toward a place: as long as `TRAVEL_LEG`, shorter where that finds no way. */
  private legToward(x: number, y: number): boolean {
    const px = this.player.x - 0.5, py = this.player.y - 0.5;
    const d = Math.hypot(x - px, y - py);
    for (const leg of [TRAVEL_LEG, TRAVEL_LEG / 2, TRAVEL_LEG / 4]) {
      const f = Math.min(1, leg / Math.max(1, d));
      if (this.moveTo(Math.round(px + (x - px) * f), Math.round(py + (y - py) * f), false, true)) return true;
      if (f >= 1) break;
    }
    return false;
  }

  /** Each frame of a long walk: when a leg has ended, the next, until there or no nearer for `TRAVEL_STUCK` legs. */
  private updateTravel(): void {
    const t = this.travel;
    if (!t || this.player.path) return;
    const away = Math.hypot(t.x + 0.5 - this.player.x, t.y + 0.5 - this.player.y);
    if (away < 1.5) {
      this.travel = null;
      this.logMsg(`Arrived: ${t.name}.`, 'info');
      return;
    }
    // Getting no nearer, leg after leg, is a way round that does not go round.
    if (away < t.best - 1) {
      t.best = away;
      t.stuck = 0;
    } else t.stuck++;
    if (t.stuck >= TRAVEL_STUCK || !this.legToward(t.x, t.y)) {
      this.travel = null;
      this.logMsg(`No path on to ${t.name} from here: ${Math.round(away)} tiles.`, 'error');
    }
  }

  /**
   * What a walk into a cellar that finds no way says, when it is not the way
   * that stops it but what you have with you: nothing in tow, nothing on
   * wheels and no mount goes down a flight or a ladder, and on foot with your
   * hands free the walk is there to be had. Otherwise `plain`.
   */
  private noWay(x: number, y: number, plain: string): string {
    if (this.afloat()) return plain;
    const towing = [...this.furniture.values()].some((f) => f.hitched);
    const mount = this.mounted();
    const seat = this.driving();
    if (!towing && !mount && !seat) return plain;
    if (!this.onFootTo(x, y, CELLAR_LEVEL)) return plain;
    if (mount) return 'Dismount first: no mounts in a cellar.';
    if (seat) return 'Get off first: no vehicles in a cellar.';
    return 'Let go of the cart first: nothing towed into a cellar.';
  }

  /** Whether your own feet, with nothing in tow, would find a way to a tile on a storey. */
  private onFootTo(x: number, y: number, level: number): boolean {
    const p = this.player;
    return !!findPath(this.world, p.tileX, p.tileY, p.level, x, y,
      { ...pathOptions(this.world, this.stepFree, TOP_LEVELS), lift: this.liftFree, below: this.buildings.cellars.size ? -CELLAR_LEVEL : 0, goalLevel: level });
  }

  /** Whether a spiral staircase stands on a tile, at any storey, finished or not. */
  spiralTile(x: number, y: number): boolean {
    for (let level = 0; level <= TOP_LEVELS; level++) if (isSpiral(this.buildings.floor(level, x, y))) return true;
    return false;
  }

  /** `noWay`, for a job whose target is down in a cellar. */
  private noWayTo(def: ActionDef, target: Target): string {
    const plain = 'No path there.';
    if (targetFloor(this, def.id, target) !== CELLAR_LEVEL) return plain;
    const tile = target.kind === 'item' ? this.intoStore(def, target) : this.targetTile(target);
    return tile ? this.noWay(tile.x, tile.y, plain) : plain;
  }

  /** The tile a target occupies right now, or null for inventory items. */
  targetTile(target: Target): { x: number; y: number } | null {
    if (target.kind === 'item') return null;
    if (target.kind === 'creature') {
      const c = this.creatures.get(target.id);
      return c ? { x: Math.floor(c.x), y: Math.floor(c.y) } : null;
    }
    if (target.kind === 'crate') {
      const c = this.crates.get(target.id);
      return c ? { x: c.x, y: c.y } : null;
    }
    // Somebody else: where the island last said they were standing.
    if (target.kind === 'person') {
      const who = this.roster.list().find((p) => p.uid === target.uid);
      return who ? { x: Math.floor(who.x), y: Math.floor(who.y) } : null;
    }
    if (target.kind === 'campfire') {
      const f = this.campfires.get(target.id);
      return f ? { x: f.x, y: f.y } : null;
    }
    if (target.kind === 'smelter') {
      const s = this.smelters.get(target.id);
      return s ? { x: s.x, y: s.y } : null;
    }
    if (target.kind === 'kiln') {
      const k = this.kilns.get(target.id);
      return k ? { x: k.x, y: k.y } : null;
    }
    if (target.kind === 'furniture') {
      const f = this.furniture.get(target.id);
      return f ? { x: f.x, y: f.y } : null;
    }
    if (target.kind === 'anvil') {
      const a = this.anvils.get(target.id);
      return a ? { x: a.x, y: a.y } : null;
    }
    if (target.kind === 'post') {
      const p = this.posts.get(target.id);
      return p ? { x: p.x, y: p.y } : null;
    }
    if (target.kind === 'trap') {
      const t = this.traps.get(target.id);
      return t ? { x: t.x, y: t.y } : null;
    }
    if (target.kind === 'bridge') {
      const b = this.bridges.get(target.id);
      if (!b) return null;
      // The open span is where the work is; failing that, the near end.
      const open = b.spans.find((sp) => Object.values(sp.needed).some((n) => n > 0));
      return open ? { x: open.x, y: open.y } : { x: b.ax, y: b.ay };
    }
    return { x: target.x, y: target.y };
  }

  /**
   * The store a thing is being put into, when the ask names one: the crate or
   * the piece `into` points at, for the two doors that put things away -- the
   * tile it stands on, to walk to, and its centre, which is where the doors
   * measure reach from.
   *
   * A thing let go over a crate across the yard is meant for that crate, and
   * the doors only honour a name within reach -- out of it they fall back on
   * whatever stands nearest. So the feet go first, as they do for any job
   * with a place to be done at.
   */
  private intoStore(def: ActionDef, target: Target): { x: number; y: number; centre: [number, number] } | null {
    if (target.kind !== 'item' || target.into === undefined) return null;
    if (def.id === 'store_in_crate') {
      const c = this.crates.get(target.into);
      return c ? { x: c.x, y: c.y, centre: crateCentre(c) } : null;
    }
    // A rack is loaded from beside it, measured from its middle as any piece is (`rack_put`).
    if (def.id === 'store_in_furniture' || def.id === 'rack_put') {
      const f = this.furniture.get(target.into);
      return f ? { x: f.x, y: f.y, centre: furnitureCentre(f) } : null;
    }
    // Goods set out on a counter walk to the counter first, to its keeper's side of it or the other.
    if (def.id === 'set_out_goods') {
      const c = counterInto(this, target);
      return c ? { x: c.x, y: c.y, centre: counterMiddle(c) } : null;
    }
    return null;
  }

  inRange(def: ActionDef, target: Target): boolean {
    // On the storey the thing is on, first: a crate down in the cellar is not reached from the floor over it,
    // nor one in the cellar next door from this one (`cellarGate`).
    if ((this.buildings.cellars.size || this.player.level < 0) && cellarGate(this, def.id, target)) return false;
    // A piece set down on a pinned storey is set down on the storey you stand on: that one (`setsDownOn`).
    const on = this.setsDownOn(def, target);
    if (on !== undefined && this.player.level !== on) return false;
    if (target.kind === 'item') {
      const into = this.intoStore(def, target);
      if (!into) return true;
      // Measured the way the doors measure it, or a corner of the next tile
      // would count as near here and not there.
      return Math.hypot(into.centre[0] - this.player.x, into.centre[1] - this.player.y) <= STORE_REACH;
    }
    const tile = this.targetTile(target);
    if (!tile) return false;
    const px = this.player.tileX;
    const py = this.player.tileY;
    if (def.corner && target.kind === 'tile') return px >= target.cx - 1 && px <= target.cx && py >= target.cy - 1 && py <= target.cy;
    return Math.max(Math.abs(px - tile.x), Math.abs(py - tile.y)) <= (def.rangeFor?.(this) ?? def.range ?? 1);
  }

  /** The storey a piece is being set down on, picked on a pinned storey (`storeyview.ts`); undefined for any other job. */
  private setsDownOn(def: ActionDef, target: Target): number | undefined {
    return def.id === 'place_furniture' && target.kind === 'tile' && typeof target.level === 'number' && target.level >= 0 ? target.level : undefined;
  }

  private walkToward(def: ActionDef, target: Target): boolean {
    if (target.kind === 'item' && !this.intoStore(def, target)) return true;
    const tile = target.kind === 'item' ? this.intoStore(def, target) : this.targetTile(target);
    if (!tile) return false;
    let candidates: Array<{ x: number; y: number }>;
    if (def.corner && target.kind === 'tile') {
      candidates = [
        { x: target.cx - 1, y: target.cy - 1 },
        { x: target.cx, y: target.cy - 1 },
        { x: target.cx - 1, y: target.cy },
        { x: target.cx, y: target.cy },
      ];
    } else if (def.range === 0) {
      // Nought tiles of reach means there is one place to stand: on it.
      candidates = [{ x: tile.x, y: tile.y }];
    } else {
      candidates = [{ x: tile.x, y: tile.y }, ...this.neighbours(tile.x, tile.y)];
    }
    candidates = candidates.filter((c) => this.world.isPassable(c.x, c.y));
    candidates.sort((a, b) => this.distanceToPlayer(a.x, a.y) - this.distanceToPlayer(b.x, b.y));
    const { rule, levels, below, lift } = this.movement();
    // To the storey the thing is on: down to a crate in the cellar, up to a tree out of one.
    const at = below || this.player.level < 0 ? targetFloor(this, def.id, target) : null;
    // A piece set down on a pinned storey: to a spot on that storey's floor.
    const on = this.setsDownOn(def, target);
    for (const c of candidates) {
      if (at === CELLAR_LEVEL && !this.buildings.cellarDone(c.x, c.y)) continue;
      if (on !== undefined && !this.standable(c.x, c.y, on)) continue;
      const aim = on ?? (at === CELLAR_LEVEL ? CELLAR_LEVEL : at === 0 && this.player.level < 0 ? 0 : undefined);
      if (!this.player.walkTo(this.world, c.x, c.y, rule, levels, below, aim, lift)) continue;
      // Already on the tile, but in the corner of it furthest from the store:
      // to the middle of it, which every tile beside a store is near enough from.
      if (target.kind === 'item' && !this.player.path && !this.inRange(def, target)) {
        this.player.path = [{ x: c.x, y: c.y, level: this.player.level }];
      }
      return true;
    }
    return false;
  }

  private neighbours(x: number, y: number): Array<{ x: number; y: number }> {
    const out: Array<{ x: number; y: number }> = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (this.world.inBounds(x + dx, y + dy)) out.push({ x: x + dx, y: y + dy });
      }
    }
    return out;
  }

  private distanceToPlayer(x: number, y: number): number {
    return Math.hypot(x + 0.5 - this.player.x, y + 0.5 - this.player.y);
  }

  /**
   * How long a go at something takes.
   *
   * `baseTime` is a weight rather than a number of seconds — see `pace.ts` —
   * so the pace is what turns it into a clock. Skill and a good tool shorten
   * it from there, and the floor moves with the pace so that the quickest jobs
   * stay quick relative to everything else rather than all landing on the same
   * second.
   *
   * A perk on the job's own time (a Carpenter's Quick Saw, a Mender's Quick
   * Hands) comes off after the floor, as the island has it: it says a job takes
   * that much less time, and a job already down on the floor -- a go of Repair
   * always is -- would otherwise take none less.
   */
  duration(def: ActionDef): number {
    const skill = def.skill ? this.skills.get(def.skill) : 50;
    // A Farmer's Worn-in Rake counts the rake better than it is, to the top.
    const toolQl = def.tool ? Math.min(QL_TOP, this.toolQl(def.tool) + this.perk(`tool:${def.id}`, 0)) : 0;
    // And less of it on a settlement whose altar has a bauble for the trade.
    // A fight goes at the weapon's own swing, and slower on tired arms (`fight.ts`).
    // And a Swiftwork on the tool takes its share off after the floor, as the island's `faith_steady` does.
    const control = this.controlSpeed() * baublePace(this.baubleHere(), def.skill);
    // A fight's go is the weapon's own seconds (`swingSeconds`); every other job's is a weight at the pace (`goSeconds`).
    // And slower for the armour on you and for being over what your back takes, after the floor (`swingBurden`).
    const fight = fightBase(this, def);
    let go: number;
    if (fight === null) go = goSeconds(def.baseTime, skill, toolQl, control);
    else {
      const { armour, over } = this.swingBurden();
      go = swingSeconds(fight, skill, control, armour * over);
    }
    return go * this.perk(`time:${def.id}`, 1) * this.pieceSpeed(def.skill) * (def.tool ? 1 - this.toolEnchant(def.tool, 'work') : 1);
  }

  /**
   * A swing of this weapon, or a draw of this bow, in your hands as they are
   * now: what `duration` makes of a go of the fight with it in hand, the
   * weapon's own seconds (with what a perk or an enchantment on it makes of
   * them) and each thing that moves it from there, as a share of the time:
   * 1.12 is 12% longer. For the card a weapon shows (`compareLines`).
   */
  swingTime(w: WeaponDef, item: Item | null): { own: number; secs: number; parts: Array<{ what: string; by: number }>; floored: boolean } {
    const def = ACTION_BY_ID.get(w.ammo ? 'shoot_creature' : 'attack_creature');
    const skillId = def?.skill ?? 'fighting';
    const skill = this.skills.get(skillId);
    const tired = tiredPace(this.player.stats.stamina);
    const arms = armPace(this.player.wounds);
    const base = swingBase(this, w, item);
    const control = this.controlSpeed();
    const bauble = baublePace(this.baubleHere(), skillId);
    const perk = this.perk(`time:${def?.id ?? 'attack_creature'}`, 1);
    const piece = this.pieceSpeed(skillId);
    const { armour, over } = this.swingBurden();
    const secs = swingSeconds(base, skill, control * bauble, armour * over) * perk * piece;
    return {
      own: base / (tired * arms),
      secs,
      floored: base * (1 - skill / 140) * control * bauble < SWING_FLOOR,
      parts: [
        { what: 'tired arms', by: tired },
        { what: 'wounded arms', by: arms },
        { what: `${(SKILL_BY_ID.get(skillId)?.name ?? skillId).toLowerCase()} ${Math.floor(skill)}`, by: 1 - skill / 140 },
        { what: `body control ${Math.floor(this.skills.get('body_control'))}`, by: control },
        { what: 'a bauble on the settlement', by: bauble },
        { what: 'your perks', by: perk },
        { what: 'a piece standing near', by: piece },
        { what: `armour ${this.armourKg().toFixed(1)} kg, counting ${this.armourCounted().toFixed(1)} kg`, by: armour },
        { what: 'overburdened', by: over },
      ].filter((p) => Math.abs(p.by - 1) > 1e-9),
    };
  }

  /**
   * The tool of a kind a job is done with, as the island picks it: the one
   * worth most at the work (`toolWorth`, the island's `tool_worth`).
   */
  jobTool(id: string): Item | undefined {
    let best: Item | undefined;
    let worth = -1;
    for (const it of this.inventory.items) if (it.id === id && this.toolWorth(it) > worth) [worth, best] = [this.toolWorth(it), it];
    return best;
  }

  /** What an enchantment on that tool comes to, for an effect it has: Swiftwork's share, Bountiful's chance. The island's `tool_enchant`. */
  toolEnchant(id: string, effect: EnchantEffect): number {
    return swingEnchant(this.jobTool(id), effect);
  }

  /**
   * A go that may bring one more: a Bountiful on the sickle or the rod, a
   * Lodestone on the pickaxe, at its chance. Gathers the one more at the
   * quality the go made and says so. The island's `enchant_more`. Here and
   * not in `enchanting.ts` so that the jobs calling it (fishing's among them)
   * need nothing that loads the job table back round in a circle.
   */
  enchantMore(tool: string, effect: 'bounty' | 'lode', item: string, ql: number, what = itemDef(item).name.toLowerCase()): void {
    const held = this.jobTool(tool)?.enchant;
    const e = held && ENCHANTMENTS[held.id];
    if (!e || e.effect !== effect || !(this.rand() < this.toolEnchant(tool, effect))) return;
    this.gather(item, { ql });
    this.logMsg(moreSaid(e, what), 'event');
  }

  /**
   * What a piece standing near makes of a go at its trade, after the floor as
   * a perk's time is: an Artisan's potter's wheel, anybody's pottery within
   * its reach. The island's `piece_pace`.
   */
  pieceSpeed(skill: string | undefined): number {
    if (!skill) return 1;
    let m = 1;
    for (const f of FURNITURE) {
      if (f.pace?.skill === skill && this.furnitureNear(f.id, f.pace.reach)) m *= f.pace.by;
    }
    return m;
  }

  /** How many of a thing a go of this recipe makes for you: its own count, or a perk's (a Carpenter's Clean Sawing). */
  madeAGo(r: { result: string; count?: number }): number {
    return this.perk(`count:${r.result}`, r.count ?? 1);
  }

  /**
   * The baubles working for you where you stand: those of the settlement of
   * yours under your feet, while you founded it or your rank on it holds
   * Bauble effects; nothing anywhere else.
   */
  baubleHere(): readonly DeedBauble[] {
    const deed = this.deedOfMineAt(this.player.tileX, this.player.tileY);
    return baublesServe(deed) ? deed?.baubles ?? [] : [];
  }

  /**
   * The go being done, while it is being done: its job, whether the baubles
   * doubled it -- asked once, at its first yield, so a go comes out doubled
   * or not as a whole -- and what they made of what it yielded, said once the
   * go has said its own piece (`sayBaubleGo`).
   */
  private baubleGo: { job: ActionDef; twice?: boolean; made: string[] } | null = null;

  /**
   * A yield of the go in hand, and what the settlement's baubles make of it:
   * what an ancient bauble on the job adds, and then `YIELD_TIMES` as many,
   * the go a major bauble on its skill comes up. Outside a go, as it was.
   */
  baubleYield(id: string, count: number): number {
    const go = this.baubleGo;
    if (!go || count <= 0) return count;
    const here = this.baubleHere();
    let n = count + baublePlus(here, go.job.id);
    go.twice ??= baubleTwice(here, go.job.skill, this.rand);
    if (go.twice) n *= YIELD_TIMES;
    if (n !== count) go.made.push(`${n} × ${itemDef(id).name.toLowerCase()}`);
    return n;
  }

  /** After the go's own words, what the baubles made of its yield, in so many. */
  private sayBaubleGo(): void {
    const made = this.baubleGo?.made ?? [];
    this.baubleGo = null;
    if (made.length) this.logMsg(`Altar baubles: yield now ${listed(made)}.`, 'event');
  }

  /**
   * What a tool is worth at the work: its quality, dragged down by the state
   * it is in and lifted or lowered by the metal of its head. This is what
   * decides how fast a job goes, how often it comes out right, and how good
   * what comes out of it is, so the metal reaches all three at once.
   */
  toolQl(id: string): number {
    const tool = this.inventory.tool(id);
    return tool ? this.toolWorth(tool) : 0;
  }

  /**
   * The same figure for one named tool rather than the best of its kind, so
   * the pack can say what each is actually worth: quality, dragged down by the
   * state it is in, lifted by its metal, its rarity and any blessing on it.
   */
  toolWorth(tool: Item): number {
    // A battered tool works like a poorer one than it was.
    return Math.min(100, workingQl(tool.ql, tool.extra) * rarityOf(tool).boost * blessBonus(tool.bless)) * wornShare(tool.dmg);
  }

  /**
   * Wear on a tool from one use. A poor tool goes to pieces far faster than a
   * good one, which is most of what quality is for — but a tool is a long-term
   * thing, so this is a slow business: a rough shovel is good for hundreds of
   * holes and a fine one for thousands.
   */
  wearTool(id: string, multiplier = 1): void {
    const tool = this.inventory.tool(id);
    if (!tool) return;
    // Less for a perk on the tool (a Carpenter's Saw Care) and a Truesteel in it, as `wear_tool` has it.
    this.damageItem(tool, wearPerUse(tool.ql) * multiplier * this.perk(`wear:${id}`, 1) * (1 - swingEnchant(tool, 'temper'))
      // And a Netmender in a net, that many times its share of the catch.
      * (1 - swingEnchant(tool, 'mend') * NETMENDER_WEAR));
  }

  /**
   * Put damage on a thing, saying so in red as it passes three quarters gone
   * and at every twentieth after that, and taking it away when it is finished.
   */
  damageItem(item: Item, amount: number): void {
    if (amount <= 0) return;
    const before = item.dmg;
    // Oak takes a third of what pine takes; seryll barely marks at all.
    item.dmg = Math.min(DAMAGE_MAX, item.dmg + amount * matOf(item.extra).wear * rarityOf(item).keep);
    const step = (v: number): number => Math.floor((v - DAMAGE_WARN) / DAMAGE_WARN_STEP);
    if (item.dmg >= DAMAGE_MAX) {
      this.inventory.remove(item.uid, 1);
      for (const [slot, uid] of Object.entries(this.player.equipped)) if (uid === item.uid) this.player.equipped[slot] = null;
      this.logMsg(`Destroyed: ${itemName(item).toLowerCase()} (${DAMAGE_MAX}% damage).`, 'error');
    } else if (item.dmg >= DAMAGE_WARN && (before < DAMAGE_WARN || step(item.dmg) > step(before))) {
      this.logMsg(`${capital(itemName(item).toLowerCase())}: damage ${Math.floor(item.dmg)}% of ${DAMAGE_MAX}%. Repair it.`, 'error');
    }
    this.events.emit('inventory');
  }

  /** Wurm-flavoured success roll: better skill and tools help, difficulty hurts. */
  /**
   * A skill check at a job that a perk may make surer (`fail:` and the job, a
   * Mason's Sure Chisel, a Miner's Sure Pick, a Tailor's Sure Needle): a
   * failure stands only that share of the time, as `perk_pass` has it on the
   * island. No perk, no second roll, so the dice fall as they always did.
   */
  sureCheck(job: string, skill: string, difficulty = 10, toolQl = 0, ease = 0): boolean {
    const ok = this.skillCheck(skill, difficulty, toolQl, ease);
    const fail = this.perk(`fail:${job}`, 1);
    return ok || (fail < 1 && this.rand() >= fail);
  }

  skillCheck(skill: string, difficulty = 10, toolQl = 0, ease = 0): boolean {
    // A Foreknow's goes cannot fail: the roll is taken as a success, and the go is spent when it is done (`completeAction`).
    if (this.player.foreknow > 0) {
      this.foreknown = true;
      return true;
    }
    return this.rand() < this.skillChance(skill, difficulty, toolQl, ease);
  }

  /** The chance a `skillCheck` comes off: better skill and tools help, difficulty hurts, between 30% and 98%. */
  skillChance(skill: string, difficulty = 10, toolQl = 0, ease = 0): number {
    const s = this.skills.get(skill);
    // A clear head makes a hard piece of work easier, but never simple.
    const d = ease > 0 ? Math.max(difficulty * 0.5, difficulty - ease) : difficulty;
    return Math.min(0.98, Math.max(0.3, 0.6 + (s / 100) * 0.38 + toolQl / 500 - d / 150));
  }

  /**
   * What a piece of work comes out at.
   *
   * Your skill is the ceiling — nothing you make is finer than the hands that
   * made it — and the tool decides whether you reach it. A tool's quality is
   * the percentage chance of the piece coming out at that ceiling; every other
   * time it comes out at 1, fit for nothing but being used up. A rough issued
   * hatchet is right four times in twenty; a hatchet somebody has worked up to
   * ninety is right nine times in ten, and that is the whole reason to better
   * a tool.
   *
   * Work done with no tool at all has nothing to roll against, so it keeps the
   * older reckoning: what your hands can do, give or take.
   */
  productQl(skill: string, toolQl = 0): number {
    const s = Math.min(100, Math.max(1, this.skills.get(skill)));
    if (toolQl <= 0) return Math.min(100, Math.max(1, s * (QL_LOW + this.rand() * QL_SPAN) + QL_BARE));
    /*
     * And what a go that did not come off is worth.
     *
     * Reported: "i've made a lot of whetstones and haven't managed anything
     * other than QL 1, even got a rare QL 1." Quite so. This used to hand back
     * a flat 1 every time the tool's roll missed, and an issued copper chisel
     * is quality fifteen — so five goes in six came off the bench as rubbish,
     * and the sixth came off at your stonecutting, which on the day you start
     * is also about one. A trade that makes nothing but QL 1 for its first
     * afternoon is a trade nobody gets to the second afternoon of.
     *
     * A rough tool makes rough work, which is not the same as making rubbish.
     * A miss comes out at what the tool itself is worth now, never above what
     * your hands could have managed — so a poor chisel is the thing holding
     * you back and says so, which is the whole reason to better one, and a
     * good one puts nearly every piece at your own ceiling as it always did.
     */
    if (this.rand() * 100 < toolQl) return s;
    return Math.min(s, Math.max(1, toolQl * (QL_LOW + this.rand() * QL_SPAN)));
  }

  /** The most `productQl` can give for this skill and tool: the island's `product_ql` at its luckiest roll. */
  qlCeiling(skill: string, toolQl = 0): number {
    const s = Math.min(100, Math.max(1, this.skills.get(skill)));
    return toolQl <= 0 ? Math.min(100, Math.max(1, s * (QL_LOW + QL_SPAN) + QL_BARE)) : s;
  }

  /** The chance a `sureCheck` comes off: the skill check, and a perk's second chance at a miss (`fail:<job>`). */
  sureChance(job: string, skill: string, difficulty = 10, toolQl = 0): number {
    const p = this.skillChance(skill, difficulty, toolQl);
    const fail = this.perk(`fail:${job}`, 1);
    return fail < 1 ? p + (1 - p) * (1 - Math.max(0, fail)) : p;
  }

  nearestCornerToPlayer(): { cx: number; cy: number } {
    return { cx: Math.round(this.player.x), cy: Math.round(this.player.y) };
  }

  /** Whether the player stands on or next to a tile with water. */
  nearWater(): boolean {
    // The sea and the ponds are up top, not down in a cellar.
    if (this.player.level < 0) return false;
    const px = this.player.tileX;
    const py = this.player.tileY;
    for (let y = py - 1; y <= py + 1; y++) {
      for (let x = px - 1; x <= px + 1; x++) {
        if (this.world.inBounds(x, y) && this.world.hasWater(x, y)) return true;
      }
    }
    return false;
  }

  // ---- Bridges: ground where there was none. ----

  addBridge(kind: BridgeKind, ax: number, ay: number, bx: number, by: number, height: number, material?: string, level = 0,
    levelB = level, rise = 0, width = 1, side = 1): Bridge {
    const tiles = spanTiles(ax, ay, bx, by);
    // A material bridge's piers, each billed by the storeys it stands down from the deck there (`pierStoreys`).
    const piers = new Set(isMaterialBridge(kind) ? pierSpans(tiles.length, BRIDGES[kind].bay) : []);
    const pier = (i: number, x: number, y: number): number =>
      piers.has(i) ? pierStoreys(rampDeck(height, rise, tiles.length, i + 0.5) - this.surfaceHeight(x, y)) : 0;
    // The first span, beside the end it is set out from, carries a drawbridge's winch.
    const spans = tiles.map(([x, y], i) => ({ x, y, ...spanBill(kind, i === 0, width, pier(i, x, y)) }));
    const b: Bridge = { id: this.nextBridgeId++, kind, ax, ay, bx, by, height, material, level, spans };
    // Wider than a lane, its lanes (`laneOffsets`).
    if (width > 1) {
      b.width = width;
      b.side = side;
    }
    // A ramp: its far end on another storey, and its deck rising to it (`deckHeight`).
    if (levelB !== level) b.levelB = levelB;
    if (rise) b.rise = rise;
    this.bridges.set(b.id, b);
    this.reindexDecks();
    return b;
  }

  removeBridge(id: number): void {
    const b = this.bridges.get(id);
    if (!b) return;
    this.bridges.delete(id);
    this.reindexDecks();
    for (const s of b.spans) this.events.emit('world', s.x, s.y);
  }

  /** Which tiles have deck over them, worked out once rather than per step. */
  reindexDecks(): void {
    this.deckIndex.clear();
    this.hinges.clear();
    for (const b of this.bridges.values()) {
      // Every lane of it (`deckTiles`).
      if ((b.width ?? 1) > 1) for (const t of deckTiles(b)) this.deckIndex.set(`${t.x},${t.y}`, b.id);
      else for (const s of b.spans) this.deckIndex.set(`${s.x},${s.y}`, b.id);
      // A drawbridge drawn up stands on end over its hinge, which is shut to everything (`gates.ts`).
      if (isDrawbridge(b) && b.raised) this.hinges.set(hingeKey(b.level ?? 0, hingeOf(b)), b.id);
    }
    this.buildings.barred = this.hinges.size ? (level, br) => this.hinges.has(hingeKey(level, br)) : undefined;
  }

  /** The bridge whose deck covers this tile, finished or not. */
  bridgeAt(x: number, y: number): Bridge | undefined {
    const id = this.deckIndex.get(`${x},${y}`);
    return id === undefined ? undefined : this.bridges.get(id);
  }

  /** The height of finished deck over this tile, or null for open ground: an aqueduct's deck is water, and nobody stands on it. */
  deckAt(x: number, y: number): number | null {
    return this.deckHeightAt(x + 0.5, y + 0.5);
  }

  /**
   * The height of finished deck at a point, or null for open ground: up its
   * slope on a ramp (`deckHeight`), which is where a body walking it stands.
   * The island's `deck_height_at`.
   */
  deckHeightAt(x: number, y: number): number | null {
    const b = this.bridgeAt(Math.floor(x), Math.floor(y));
    // A drawbridge drawn up has no deck: what is under it is what there is (`gates.ts`).
    return b && deckDown(b) && b.kind !== 'aqueduct' ? deckHeight(b, x, y) : null;
  }

  /** Whether a tile is walked on a bridge's deck rather than on the ground: under an aqueduct it is the ground, worn and climbed as ever. */
  onWalkedDeck(x: number, y: number): boolean {
    const b = this.bridgeAt(x, y);
    return !!b && b.kind !== 'aqueduct';
  }

  /**
   * Whether a step between two neighbouring tiles goes through one of an
   * aqueduct's piers: along its run, between two tiles of its line, beside a
   * bay with any of its stone laid. Across its run you go under its arches.
   * The island's `aqueduct_pier`.
   */
  pierBetween(x0: number, y0: number, x1: number, y1: number): boolean {
    if (Math.abs(x1 - x0) + Math.abs(y1 - y0) !== 1) return false;
    for (const [x, y] of [[x0, y0], [x1, y1]]) {
      const b = this.bridgeAt(x, y);
      if (b?.kind !== 'aqueduct') continue;
      const along = b.ay === b.by ? y0 === b.ay && y1 === b.ay : x0 === b.ax && x1 === b.ax;
      const sp = b.spans.find((s) => s.x === x && s.y === y);
      if (along && sp && (isDone(sp) || progressOf(sp) > 0)) return true;
    }
    return false;
  }

  /** What is said of a tile a bridge or an aqueduct is carried over, where a pour or a pool would go; null where none is. */
  carriedOver(x: number, y: number): string | null {
    const b = this.bridgeAt(x, y);
    return b ? (b.kind === 'aqueduct' ? AQ_OVER : 'Bridge over that tile.') : null;
  }

  /** The finished aqueducts, as the springs' water sees them. */
  aqueductChannels(): Channel[] {
    const out: Channel[] = [];
    for (const b of this.bridges.values()) if (b.kind === 'aqueduct' && bridgeDone(b)) out.push(channelOf(this, b));
    return out;
  }

  /**
   * The height of anything laid over a tile that you stand on instead of the
   * ground under it: a poured slab, or a finished bridge deck. Null when the
   * ground is the ground. A deck on piers is not asked here: a body on one is
   * on a storey of its building (`deckBase`), and nothing else is there.
   */
  laidOver(x: number, y: number, at?: { x: number; y: number }): number | null {
    const slab = this.foundations.size ? this.slabAt(x, y) : undefined;
    // In a pool, a body swims with its head out, as in the sea.
    if (slab) return slab.pool ? poolLevel(slab.top) - SWIM_DEPTH : slab.top;
    // At a point on the tile, where one is given: on a ramp the deck is higher at one side of it than the other.
    return this.bridges.size ? (at ? this.deckHeightAt(at.x, at.y) : this.deckAt(x, y)) : null;
  }

  /** Whether a bridge's ends or deck cover this tile, which is where you may step on. */
  onBridge(b: Bridge, x: number, y: number): boolean {
    if ((x === b.ax && y === b.ay) || (x === b.bx && y === b.by)) return true;
    if ((b.width ?? 1) > 1) return endTiles(b).some((e) => e.x === x && e.y === y) || this.bridgeAt(x, y) === b;
    return b.spans.some((s) => s.x === x && s.y === y);
  }

  /**
   * Whether a step is a step along a bridge. You get onto a deck at an end
   * and walk it; you do not climb onto one out of the water underneath.
   */
  bridgeStep(x0: number, y0: number, x1: number, y1: number): boolean {
    return this.bridgeStepLevel(x0, y0, x1, y1) !== null;
  }

  /**
   * The same step, and which storey it is walked on.
   *
   * Nought for a bridge between two banks. A bridge that lands on a finished
   * floor is walked at that storey, so stepping onto it from the room it meets
   * keeps you upstairs instead of dropping you into the yard.
   */
  bridgeStepLevel(x0: number, y0: number, x1: number, y1: number, level?: number): number | null {
    // gates: a drawbridge drawn up has no deck to step onto or off (`deckDown`). Never an aqueduct's: under it is open ground.
    const walked = (b: Bridge | undefined): b is Bridge => !!b && deckDown(b) && b.kind !== 'aqueduct';
    // A ramp's two ends may be on two storeys, and its deck is walked at either: at the one you came onto it at.
    const at = (b: Bridge): boolean => level === undefined || bridgeLevels(b).includes(level);
    // Onto the deck, from an end at the storey that end lands on, or along the deck itself.
    const to = this.bridgeAt(x1, y1);
    if (walked(to) && this.onBridge(to, x0, y0)) {
      const end = this.bridgeEndLevel(to, x0, y0);
      if (end !== null) return level === undefined || level === end ? end : null;
      return at(to) ? level ?? bridgeLevels(to)[0] : null;
    }
    // And off the far end of it again, which is a step down onto solid ground
    // from a deck the terrain underneath knows nothing about: onto the storey that end lands on.
    const from = this.bridgeAt(x0, y0);
    return walked(from) && this.onBridge(from, x1, y1) && at(from) ? this.bridgeEndLevel(from, x1, y1) : null;
  }

  /** The storey a bridge's end on this tile lands on, or null where neither of its ends is. */
  bridgeEndLevel(b: Bridge, x: number, y: number): number | null {
    const [la, lb] = bridgeLevels(b);
    if (x === b.ax && y === b.ay) return la;
    if (x === b.bx && y === b.by) return lb;
    // Every lane's ends land as the line's do (`bridgeReason`).
    const e = (b.width ?? 1) > 1 ? endTiles(b).find((t) => t.x === x && t.y === y) : undefined;
    return e ? (e.end ? lb : la) : null;
  }

  /**
   * The highest thing at a tile that somebody may stand on and a bridge may
   * land on: a finished floor of a building, or the ground and whatever is
   * poured over it.
   */
  topDeck(x: number, y: number): { level: number; height: number } {
    const base = this.surfaceHeight(x, y);
    // gates: and a jetty's floor out past the footprint, a floor of the storey it is out from, as the island's
    // `top_deck` has it: a bridge's end lands on it as on any finished floor (`frame.ts`).
    const b = this.buildings.buildingAt(x, y) ?? this.buildings.jettyAt(x, y);
    if (b) {
      for (let l = b.levels - 1; l >= 1; l--) {
        if (this.standable(x, y, l)) return { level: l, height: base + l * WALL_HEIGHT };
      }
    }
    return { level: 0, height: base };
  }

  /**
   * Why a bridge of this sort, `width` lanes wide (its second on `side` at
   * two, `laneOffsets`), cannot be thrown between these two tiles, or null.
   * Every lane's ends land as the line's do, and every lane's deck is asked
   * what the line's is. The island's `bridge_reason`, in the same order.
   */
  bridgeReason(kind: BridgeKind, ax: number, ay: number, bx: number, by: number, width = 1, side = 1): string | null {
    const def = BRIDGES[kind];
    // An aqueduct is set out from where it pours (`plan_aqueduct`).
    if (kind === 'aqueduct') return AQ_NOT_THROWN;
    if (!def) return 'Choose a material.';
    const w = this.world;
    if (!w.inBounds(ax, ay) || !w.inBounds(bx, by)) return 'Not there.';
    if (ax !== bx && ay !== by) return 'Bridges run straight: pick an end due north, south, east or west.';
    const span = spanTiles(ax, ay, bx, by);
    if (!span.length) return 'No gap between those tiles.';
    // Lanes: a material bridge one to `WIDEST`, anything else one.
    if (!Number.isInteger(width) || width < 1 || width > (isMaterialBridge(kind) ? WIDEST : 1)) {
      return isMaterialBridge(kind) ? `Width: 1 to ${WIDEST} lanes.` : `${def.name}: 1 lane only.`;
    }
    /*
     * A Mason's Bridge Mason carries a stone bridge further, and a
     * Carpenter's Bridge Wright a timber or a rope one: a material bridge by
     * so many tiles past its own (`span:bridge_stone`, `span:bridge_wood`), a
     * rope bridge to so many (`span:bridge_rope`).
     */
    const reach = isMaterialBridge(kind) ? def.span + this.perk(`span:bridge_${def.stone ? 'stone' : 'wood'}`, 0) : this.perk(`span:bridge_${kind}`, def.span);
    if (span.length > reach) return `${def.name}: max span ${reach} tiles; this is ${span.length}.`;
    const [px, py] = across(ax, ay)(bx, by);
    const lanes = laneOffsets(width, side);
    /*
     * And what each end lands on.
     *
     * A bank, a poured slab, or a finished floor of a building — which is the
     * new one, and the reason anybody builds a tower and then wishes they had
     * not. A storey is as flat and as solid as a slab, and it is already at a
     * height somebody chose; a walkway from one at second-storey height to
     * another at the same is the thing two towers have always wanted and had
     * to do with a staircase down, a walk across the yard and a staircase up.
     */
    const ends = [this.topDeck(ax, ay), this.topDeck(bx, by)];
    for (const o of lanes) {
      for (const [i, [x0, y0]] of ([[ax, ay], [bx, by]] as Array<[number, number]>).entries()) {
        const x = x0 + o * px, y = y0 + o * py;
        if (!w.inBounds(x, y)) return 'Not there.';
        const end = o ? this.topDeck(x, y) : ends[i];
        // A deck on piers is landed on once it is built, and is dry, solid ground whatever is under it (`piers.ts`).
        if (this.pierBare(x, y)) return 'Needs a finished deck at that end.';
        // The bank of a ravine always shares a corner with the ravine, so what
        // matters is whether you can stand in the middle of the tile, not
        // whether every corner of it is dry.
        if (!end.level && !this.slabAt(x, y) && !this.onPierDeck(x, y) && (!w.isPassable(x, y) || w.centerHeight(x, y) < w.surfaceAt(x, y) && w.hasWater(x, y))) {
          return 'Both ends need dry, solid ground.';
        }
        // gates: nor on the end of another, which the island's `bridge_at` counts as under it as it counts a span.
        if (this.bridgeAt(x, y) || this.bridgeEndAt(x, y)) return 'An end is already under a bridge.';
        // A lane's end on the storey the line's is, within `END_SLOP` of it.
        if (o && end.level !== ends[i].level) return 'Lane ends on different storeys.';
        if (o && Math.abs(end.height - ends[i].height) > END_SLOP) {
          return `Lane ends ${metres(Math.abs(end.height - ends[i].height))} m apart in height; max ${metres(END_SLOP)} m.`;
        }
      }
    }
    // gates: not from inside a ground floor nor through a wall, and a drawbridge outside at both ends (`gates.ts`): every lane's.
    for (const o of lanes) {
      const outside = bridgeEndRefusal(this, kind, ax + o * px, ay + o * py, bx + o * px, by + o * py, [ends[0].level, ends[1].level]);
      if (outside) return outside;
    }
    // A drawbridge goes from bank to bank: its hinge and its winch stand on the ground (`gates.ts`).
    if (def.grounded && (ends[0].level || ends[1].level)) return `${def.name}: ground to ground only, not to a storey.`;
    const ha = ends[0].height;
    const hb = ends[1].height;
    const apart = Math.abs(ha - hb);
    // Past `END_SLOP` a deck is a ramp, from one storey to another or from bank to bank, at `RAMP_SLOPE` a tile at most.
    if (apart > END_SLOP && def.grounded) return `Ends ${metres(apart)} m apart in height; max ${metres(END_SLOP)} m. Level one.`;
    if (apart > END_SLOP && apart > RAMP_SLOPE * span.length) return rampRefusal(ends[0].level, ends[1].level, apart, span.length);
    const height = Math.round((ha + hb) / 2);
    const rise = rampRise(ha, hb);
    for (const o of lanes) {
      for (const [i, [x0, y0]] of span.entries()) {
        const x = x0 + o * px, y = y0 + o * py;
        if (!w.inBounds(x, y)) return 'Not there.';
        // gates: nor over the end of another, as the island has it (`bridge_at`).
        if (this.bridgeAt(x, y) || this.bridgeEndAt(x, y)) return 'Already bridged there.';
        if (this.buildings.buildingAt(x, y)) return 'Not over a building.';
        if (this.buildings.jettyAt(x, y)) return 'Not over a building\'s jetty.';
        // At the deck's height over the middle of the tile, up a ramp's slope.
        const drop = rampDeck(height, rise, span.length, i + 0.5) - this.surfaceHeight(x, y);
        if (drop < CLEARANCE) return `Ground under the span: needs ${metres(CLEARANCE)} m clearance.`;
        // And no deeper than its material stands (`BridgeDef.deepest`).
        if (def.deepest !== undefined && drop > def.deepest) {
          return `Drop under the span ${metres(drop)} m; max ${metres(def.deepest)} m (${def.storeys} storeys).`;
        }
      }
    }
    return null;
  }

  // ---- Foundations: level ground poured into a slope, leaving the slope alone. ----

  addFoundation(x: number, y: number, top: number, needed?: number): Foundation {
    const want = needed ?? concreteFor(this.world.tileCorners(x, y), top);
    const f: Foundation = { id: this.nextFoundationId++, x, y, top, ...foundationBill(want) };
    // Poured as it is set out, when there is nothing to pour: bare from now.
    if (foundationDone(f)) f.greenSince = greenNow();
    this.foundations.set(f.id, f);
    this.slabIndex.set(`${x},${y}`, f.id);
    return f;
  }

  removeFoundation(id: number): void {
    const f = this.foundations.get(id);
    if (!f) return;
    this.slabIndex.delete(`${f.x},${f.y}`);
    this.foundations.delete(id);
  }

  /** The foundation on a tile, shuttered or poured. */
  foundationAt(x: number, y: number): Foundation | undefined {
    const id = this.slabIndex.get(`${x},${y}`);
    return id === undefined ? undefined : this.foundations.get(id);
  }

  /**
   * The *poured* one, which is the only one you can stand on.
   *
   * Shuttering is a line of boards round a hole: everything that asks whether
   * there is ground here has to be asking about the slab, not the plan.
   */
  slabAt(x: number, y: number): Foundation | undefined {
    const f = this.foundationAt(x, y);
    return f && foundationDone(f) ? f : undefined;
  }

  /** The top of a finished slab with no pool dug in it, which is dry floor whatever water stands round it; null anywhere else. */
  dryTop(x: number, y: number): number | null {
    const f = this.slabAt(x, y);
    return f && !f.pool ? f.top : null;
  }

  /** What a body walks as floor rather than ground or water: a finished deck on piers, or a dry slab (`dryTop`). */
  readonly onFloor = (x: number, y: number): boolean =>
    this.onPierDeck(x, y) || (this.foundations.size > 0 && this.dryTop(x, y) !== null);

  /**
   * How high the top of a tile is: a poured slab's, the water in a pool dug
   * in one, a finished deck on piers, or the ground's own -- the order the
   * island's `surface_height` asks in, which is where a bridge lands.
   */
  surfaceHeight(x: number, y: number): number {
    const slab = this.slabAt(x, y);
    if (slab) return slab.pool ? poolLevel(slab.top) : slab.top;
    return this.pierDeckAt(x, y) ?? this.world.centerHeight(x, y);
  }

  /**
   * Why a pool cannot be dug in the foundation on a tile, or null.
   *
   * Whatever stands on the slab would go into the water, so it has to be
   * cleared first, as a pour has to be; and a house stands on its floor.
   */
  poolReason(x: number, y: number): string | null {
    const f = this.slabAt(x, y);
    if (!f) return 'Needs a poured foundation.';
    if (f.pool) return 'Already a pool.';
    const b = this.buildings.buildingAt(x, y);
    if (b) return `${b.name} is on it.`;
    if (this.isToken(x, y)) return 'Settlement totem there.';
    const over = this.carriedOver(x, y);
    if (over) return over;
    if (this.groundAt(x, y).length) return 'Items on the tile: clear them first.';
    const p = this.placed;
    if (p.furniture.at(x, y).length || p.crates.at(x, y).length || p.campfires.at(x, y).length || p.smelters.at(x, y).length
      || p.kilns.at(x, y).length || p.anvils.at(x, y).length || p.posts.at(x, y).length || p.traps.at(x, y).length) {
      return 'Something placed on the slab: move it first.';
    }
    return null;
  }

  /** A pool has been dug in a foundation or filled in: the water is laid again, and any spring it touches settled again. */
  poolsChanged(x: number, y: number): void {
    this.springs.touched(x, y, true);
  }

  /**
   * The level a foundation here would be poured to.
   *
   * What you have sighted, if you have sighted anything above the tile, and
   * the top of the tile otherwise — which is the cheapest slab that squares
   * the tile off and is what anybody wants nine times in ten. Sighting a
   * level is already how this game is told "work to *here*", so a plinth
   * needs no new question asked at the menu.
   */
  foundationTop(x: number, y: number): number {
    const high = Math.max(...this.world.tileCorners(x, y));
    return this.level !== null && this.level > high ? this.level : high;
  }

  /**
   * A step on, off or along a poured slab, or null when no slab is involved
   * and the ordinary rule should answer.
   *
   * The question is the same one as ever — how far up or down is the next
   * tile — but asked of the two *surfaces*. Under a slab the terrain may be a
   * cliff, a seabed or a hole, and none of that is under your feet any more.
   * Landing on a slab needs no slope check either: level is what it is.
   */
  private slabStep(x0: number, y0: number, x1: number, y1: number): boolean | null {
    if (!this.foundations.size) return null;
    const onto = this.slabAt(x1, y1);
    if (!onto && !this.slabAt(x0, y0)) return null;
    if (Math.abs(this.surfaceHeight(x1, y1) - this.surfaceHeight(x0, y0)) > this.climbStep()) return false;
    return !!onto || standsOn(this.world, x1, y1, this.standSlope());
  }

  /**
   * A step on, off or along a deck on piers, or null when no deck is in it.
   *
   * The slab's question asked of the deck: how far up or down the next
   * surface is, held to the climb a body takes between two tile centres.
   * Landing on a deck asks nothing of the ground under it; stepping off one
   * onto the ground asks what any step onto that ground asks. Higher than the
   * climb, the edge of a deck is a drop a body is stopped at. The island's
   * `walk_share` asks the same of `deck_surface`.
   */
  deckStep(x0: number, y0: number, x1: number, y1: number): boolean | null {
    if (!this.buildings.pierTiles.size) return null;
    const onto = this.pierDeckAt(x1, y1);
    const from = this.pierDeckAt(x0, y0);
    if (onto === null && from === null) return null;
    if (Math.abs((onto ?? this.surfaceHeight(x1, y1)) - (from ?? this.surfaceHeight(x0, y0))) > this.climbStep()) return false;
    return onto !== null || standsOn(this.world, x1, y1, this.standSlope());
  }

  /** Why a slab cannot be poured over this tile to that level, or null. */
  foundationReason(x: number, y: number, top: number): string | null {
    const w = this.world;
    if (!w.inBounds(x, y)) return 'Not there.';
    if (this.foundationAt(x, y)) return 'Already a foundation.';
    // On bare rock and nowhere else: every spadeful of soil off all four corners first.
    const soil = w.soilOn(x, y);
    if (soil > 0) return soilSays(soil);
    const corners = w.tileCorners(x, y);
    const high = Math.max(...corners);
    // It fills a hole; it does not cut one. Pouring below the ground you are
    // pouring over is not a foundation, it is a trench.
    if (top < high) return `Foundations fill up only. High corner ${metres(high)} m: set a level at or above it.`;
    /*
     * And it is an answer to a slope. On ground that is already flat there is
     * nothing to fill, and the tile next to it is the flat tile you were
     * after — so a slab there is concrete spent on nothing.
     */
    if (top === high && high === Math.min(...corners)) return 'Tile already level.';
    /*
     * Not up against a building. A wall is planned against the ground as the
     * ground was, and a slab poured at its foot is a shelf under somebody
     * else's footings; keep a tile between them.
     */
    for (let dy = -CLEAR_OF_BUILDINGS; dy <= CLEAR_OF_BUILDINGS; dy++) {
      for (let dx = -CLEAR_OF_BUILDINGS; dx <= CLEAR_OF_BUILDINGS; dx++) {
        const b = this.buildings.buildingAt(x + dx, y + dy);
        if (b) return `${b.name} too close: needs a tile clear of buildings and plans.`;
      }
    }
    if (this.isToken(x, y)) return 'Settlement totem there.';
    const over = this.carriedOver(x, y);
    if (over) return over;
    if (this.groundAt(x, y).length) return 'Items on the tile: clear them first.';
    const other = this.deedAt(x, y);
    if (other && !this.onDeed(x, y)) return `Inside ${other.name}: own ground only.`;
    /*
     * And the deepest part of the pour is what asks for the skill: shuttering
     * a step is a morning's work and shuttering a cliff is not.
     */
    const lift = liftFor(corners, top);
    const want = masonryFor(lift);
    const have = this.skills.get('masonry');
    if (have < want) {
      return `Pour ${metres(lift)} m deep needs masonry ${want.toFixed(1)}; have ${have.toFixed(1)}.`
        + ` Your max depth: ${metres(have * LIFT_PER_MASONRY)} m.`;
    }
    return null;
  }

  // ---- Traps: what you catch while you are somewhere else. ----

  addTrap(kind: TrapKind, x: number, y: number, sx: number, sy: number, ql: number, material?: string): PlacedTrap {
    const t: PlacedTrap = { id: this.nextTrapId++, x, y, sx, sy, kind, ql, dmg: 0, bait: null, caught: null, checkAt: this.time + CHECK_EVERY, material };
    this.traps.set(t.id, t);
    this.placed.traps.add(t);
    return t;
  }

  removeTrap(id: number): void {
    const t = this.traps.get(id);
    if (!t) return;
    this.placed.traps.remove(t);
    this.traps.delete(id);
  }

  trapAt(x: number, y: number, sx: number, sy: number): PlacedTrap | undefined {
    for (const t of this.placed.traps.at(x, y)) if (t.sx === sx && t.sy === sy) return t;
    return undefined;
  }

  trapsOnTile(x: number, y: number): readonly PlacedTrap[] {
    return this.placed.traps.at(x, y);
  }

  /** Why a trap cannot be set here, or null. */
  trapPlaceReason(x: number, y: number, sx: number, sy: number, kind: TrapKind = 'snare'): string | null {
    if (!this.world.inBounds(x, y)) return 'Not there.';
    if (TRAPS[kind]?.water) {
      // A creel goes in the water, within reach of a bank you can stand on.
      const creelDepth = 1;
      if (waterDepth(this, x, y) < creelDepth) return `Creel needs water ${metres(creelDepth)} m deep or more.`;
      if (Math.hypot(x + 0.5 - this.player.x, y + 0.5 - this.player.y) > 3.6) return 'Too far: within 3.6 tiles.';
      if (this.trapAt(x, y, sx, sy)) return 'Something is already there.';
      return null;
    }
    if (this.onDeed(x, y)) return 'Not on your settlement: wild creatures do not enter it.';
    if (!this.world.isPassable(x, y) || this.world.hasWater(x, y)) return 'Trap needs dry, open ground.';
    if (this.buildings.buildingAt(x, y)) return 'Not inside a building.';
    if (this.occupiedSubtile(x, y, sx, sy)) return 'Something is already there.';
    return null;
  }

  /** Let whatever is in it go, and say so. */
  springTrap(t: PlacedTrap, why: string): void {
    const c = t.caught !== null ? this.creatures.get(t.caught) : undefined;
    t.caught = null;
    t.bait = null;
    if (c) {
      c.trapped = null;
      c.state = 'flee';
      c.until = this.time + 4;
      this.logMsg(why, 'event');
    }
    this.events.emit('world', t.x, t.y);
  }

  /**
   * Traps, on the clock. They rot where they stand like everything else left
   * out, and every so often a baited one is rolled against whatever wild
   * thing is within reach of the smell of it.
   */
  private runTraps(dt: number): void {
    for (const t of [...this.traps.values()]) {
      // Slower for a Mender's Post Keeper, whose traps these all are.
      t.dmg = Math.min(100, t.dmg + dt * (trapDecayRate(t) / trapKeep(this, t.kind)));
      if (t.dmg >= 100) {
        if (t.caught !== null) this.springTrap(t, `${trapName(t)} rotted: catch escaped.`);
        this.removeTrap(t.id);
        this.logMsg(`Rotted away: ${trapName(t).toLowerCase()}.`, 'system');
        continue;
      }
      if (!t.bait || this.time < t.checkAt) continue;
      t.checkAt = this.time + CHECK_EVERY;
      if (TRAPS[t.kind]?.water) this.rollCreel(t);
      else if (t.caught === null) this.rollTrap(t);
    }
  }

  /**
   * One roll of a creel. It takes what the water it sits in holds, weighted by
   * whatever is in it, and it goes on filling until it is full or the bait is
   * gone — which is the whole of why a creel is worth weaving.
   */
  private rollCreel(t: PlacedTrap): void {
    const held = (t.fish ?? []).reduce((a, f) => a + f.count, 0);
    // As many as it holds, more for a Fisher's Deep Creel in it.
    if (held >= creelHold(t)) return;
    const depth = waterDepth(this, t.x, t.y);
    const pool = fishHere(depth, this.skills.get('fishing'));
    if (!pool.length) return;
    // Better odds for its maker's hand in it (a Tailor's Fisher's Friend), and for a Snarecraft set into it.
    if (this.rand() >= creelOdds(t.ql) * markOf(t, 'catch') * (1 + swingEnchant(t, 'snare'))) return;
    // What its bait draws, and what its setter's perks make of that (a Fisher's Strong Bait and Big Fish).
    const bait = t.bait ? BAIT_BY_ID.get(t.bait.id) : undefined;
    const got = pickFish(this, pool, bait, (k, d) => this.perk(k, d));
    if (!got) return;
    t.fish ??= [];
    const ql = Math.max(1, Math.min(100, t.ql * (0.5 + this.rand() * 0.7)));
    const stack = t.fish.find((f) => f.id === got.id);
    if (stack) {
      stack.ql = (stack.ql * stack.count + ql) / (stack.count + 1);
      stack.count += 1;
    } else t.fish.push({ uid: this.inventory.nextUid++, id: got.id, ql, dmg: 0, count: 1 });
    // Every so often the bait is worked out of it and the creel goes on empty.
    if (this.rand() < CREEL_BAIT_LOSS && t.bait) {
      t.bait = null;
      this.logMsg('Creel bait used up: rebait to catch.', 'system');
    }
    this.events.emit('world', t.x, t.y);
  }

  /** One roll of one trap against the country round it. */
  private rollTrap(t: PlacedTrap): void {
    const bait = t.bait;
    if (!bait) return;
    const [cx, cy] = trapCentre(t);
    const reach = TRAPS[t.kind].reach;
    const holds = trapHolds(t);
    let best: Creature | null = null;
    let bestChance = 0;
    for (const c of this.creatures.list.values()) {
      if (c.mode !== 'wild' || c.trapped !== null) continue;
      if (Math.hypot(c.x - cx, c.y - cy) > reach) continue;
      const s = this.creatures.species(c);
      // Nothing that is not a wildermon walks into a noose for a berry.
      if (s.monster || !isBaitFor(s, bait.id)) continue;
      // Anything warier than the trap will hold simply takes the bait and goes.
      // At the taming its stage asks (`tameNeeds`).
      if (tameNeeds(c).level > holds) {
        if (this.rand() < 0.3) {
          t.bait = null;
          this.logMsg(`${trapName(t)}: bait taken, catch too big for it.`, 'system');
          return;
        }
        continue;
      }
      const chance = catchChance(t, c);
      if (chance > bestChance) {
        best = c;
        bestChance = chance;
      }
    }
    if (!best || this.rand() >= bestChance) return;
    best.trapped = t.id;
    best.state = 'idle';
    best.enemy = null;
    const [tx, ty] = trapCentre(t);
    best.x = tx;
    best.y = ty;
    t.caught = best.id;
    t.bait = null;
    this.note('caught');
    this.logMsg(`${trapName(t)} sprung: ${this.creatures.species(best).name.toLowerCase()} caught.`, 'event');
    this.events.emit('world', t.x, t.y);
  }

  // ---- Work posts: a settlement's worth of orders on a stake, for an hour. ----

  addPost(x: number, y: number, sx: number, sy: number, ql: number, material?: string): PlacedPost {
    const p: PlacedPost = { id: this.nextPostId++, x, y, sx, sy, ql, dmg: 0, worker: null, material };
    this.posts.set(p.id, p);
    this.placed.posts.add(p);
    return p;
  }

  postAt(x: number, y: number, sx: number, sy: number): PlacedPost | undefined {
    for (const p of this.placed.posts.at(x, y)) if (p.sx === sx && p.sy === sy) return p;
    return undefined;
  }

  postsOnTile(x: number, y: number): readonly PlacedPost[] {
    return this.placed.posts.at(x, y);
  }

  /** The post a worker is set to, if it is set to one that is still standing. */
  postOf(c: Creature): PlacedPost | undefined {
    return c.post !== null ? this.posts.get(c.post) : undefined;
  }

  /**
   * Where a wildermon works: the post it is set to, or the settlement. The
   * shape is the same either way, which is what lets one worker loop serve
   * both — only a post keeps its creature on a short rein, and a deed does
   * not.
   */
  workSite(c: Creature): { x: number; y: number; radius: number; post?: number } | null {
    const p = this.postOf(c);
    return p ? postSite(p) : this.deed;
  }

  /** Why a post cannot go in here, or null. */
  postPlaceReason(x: number, y: number, sx: number, sy: number): string | null {
    if (!this.world.inBounds(x, y)) return 'Not there.';
    if (this.onDeed(x, y)) return 'Not on your settlement: the totem covers it.';
    if (!this.world.isPassable(x, y) || this.world.hasWater(x, y)) return 'Post needs dry, open ground.';
    const steepest = 25;
    if (this.world.slope(x, y) > steepest) return `Too steep: slope over ${metres(steepest)} m.`;
    if (this.buildings.buildingAt(x, y)) return 'Not inside a building.';
    if (this.occupiedSubtile(x, y, sx, sy)) return 'Something is already standing there.';
    return null;
  }

  /**
   * Take a worker off its post and send it where it belongs: to your side if
   * you are walking alone, to the settlement's keeping if you are not, and
   * back to the wild if you have neither.
   */
  leavePost(p: PlacedPost, why: string): void {
    const c = p.worker !== null ? this.creatures.get(p.worker) : undefined;
    p.worker = null;
    if (!c) return;
    c.post = null;
    c.state = 'idle';
    c.until = this.time;
    c.enemy = null;
    const into = emptyCrate(this);
    if (!this.creatures.active()) {
      c.mode = 'active';
      this.logMsg(`Post ${why}: ${c.name} returns to you.`, 'wildermon');
    } else if (this.deed) {
      // Back to the settlement it came from, as the island has it.
      c.mode = 'deed';
      this.logMsg(`Post ${why}: ${c.name} back to work at ${this.deed.name}.`, 'wildermon');
    } else if (into) {
      shutIn(this, c, into);
      this.logMsg(`Post ${why}: ${c.name} into the wildermon crate in your pack.`, 'wildermon');
    } else {
      c.mode = 'wild';
      this.logMsg(`Post ${why}: no settlement, no empty wildermon crate, active slot taken. ${c.name} went wild.`, 'error');
    }
    this.events.emit('creature');
  }

  /** Take a creature off whatever post it is on, quietly, when it is re-ordered. */
  clearPost(c: Creature): void {
    const p = this.postOf(c);
    if (p) p.worker = null;
    c.post = null;
  }

  removePost(id: number, why = 'gone'): void {
    const p = this.posts.get(id);
    if (!p) return;
    this.leavePost(p, why);
    this.placed.posts.remove(p);
    this.posts.delete(id);
    this.events.emit('world', p.x, p.y);
  }

  /**
   * Posts rotting where they stand. Nothing holds one up and nothing can be
   * done about it: the only question is whether the work got done first.
   */
  private runPosts(dt: number): void {
    for (const p of [...this.posts.values()]) {
      const before = p.dmg;
      // Slower for a Mender's Post Keeper, whose posts these all are.
      p.dmg = Math.min(100, p.dmg + (postDecayRate(p.ql) / postKeep(this)) * dt);
      // One word of warning, once, when it is nearly through.
      if (before < POST_WARN && p.dmg >= POST_WARN && p.worker !== null) {
        const [cx, cy] = postCentre(p);
        this.logMsg(`${postName(p)} at ${Math.floor(cx)}, ${Math.floor(cy)}: ${POST_WARN} damage, near collapse.`, 'error');
      }
      if (p.dmg >= 100) this.removePost(p.id, 'rotted away');
    }
  }

  addCrate(kind: CrateKind, x: number, y: number, sx: number, sy: number, items: Item[] = [], deed = false, material?: string, ql = 20, level = 0): PlacedCrate {
    const crate: PlacedCrate = { id: this.nextCrateId++, x, y, sx, sy, kind, items, deed, material, ql };
    // Set down in a cellar, it is down there: see `cellar.ts`.
    if (level < 0) crate.level = CELLAR_LEVEL;
    this.crates.set(crate.id, crate);
    this.placed.crates.add(crate);
    return crate;
  }

  removeCrate(id: number): void {
    const crate = this.crates.get(id);
    if (crate) this.placed.crates.remove(crate);
    this.crates.delete(id);
    this.events.emit('crate');
  }

  /** The crate on a spot of a tile, on a storey: a cellar's floor and the ground over it are two spots. */
  crateAt(x: number, y: number, sx: number, sy: number, level = 0): PlacedCrate | undefined {
    const down = level < 0;
    return this.placed.crates.at(x, y).find((c) => c.sx === sx && c.sy === sy && (c.level ?? 0) < 0 === down);
  }

  cratesOnTile(x: number, y: number): readonly PlacedCrate[] {
    return this.placed.crates.at(x, y);
  }

  /** The settlement's crate, where deed workers deliver. */
  deedCrate(): PlacedCrate | undefined {
    for (const c of this.crates.values()) if (c.deed) return c;
    return undefined;
  }

  /** Whether anybody -- you, or somebody else on the island -- is down in a building's cellar. */
  cellarOccupied(b: Building): boolean {
    const under = (x: number, y: number): boolean => this.buildings.cellar(x, y)?.building === b.id;
    if (this.player.level < 0 && under(this.player.tileX, this.player.tileY)) return true;
    return this.roster.list().some((p) => p.level < 0 && under(Math.floor(p.x), Math.floor(p.y)));
  }

  /** A spadeful of dirt, clay or sand to fill in with: from the pack, or a store beside you (`spoilFrom`). */
  spoilToHand(): { id: string; take: () => boolean } | undefined {
    return spoilFrom(this, SPOIL_ORDER);
  }

  /** The crate closest to the player. */
  nearestCrate(range = 3): PlacedCrate | undefined {
    let best: PlacedCrate | undefined;
    let bestD = Infinity;
    this.placed.crates.around(this.player.x, this.player.y, range, (c) => {
      const [cx, cy] = crateCentre(c);
      const d = Math.hypot(cx - this.player.x, cy - this.player.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }, this.player.level);
    return best;
  }

  /** Put the settlement's plank crate on a free spot beside the token. */
  placeDeedCrate(): void {
    const d = this.deed;
    if (!d) return;
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
      [1, 1],
    ]) {
      const x = d.x + dx;
      const y = d.y + dy;
      if (this.world.inBounds(x, y) && this.world.isPassable(x, y) && !this.world.hasWater(x, y) && !this.buildings.buildingAt(x, y) && !this.crateAt(x, y, 1, 1)) {
        this.addCrate('plank', x, y, 1, 1, [], true);
        return;
      }
    }
    this.addCrate('plank', d.x, d.y, 3, 3, [], true);
  }

  /** Add an item to a crate; false when it would not fit. */
  crateAdd(crate: PlacedCrate, item: Item): boolean {
    if (crateUnits(crate) + item.count > crateCapacity(crate)) return false;
    const def = ITEM_DEFS[item.id];
    const stack = def?.stackable ? crate.items.find((it) => it.id === item.id && it.extra === item.extra && it.piece === item.piece) : undefined;
    if (stack) {
      stack.ql = (stack.ql * stack.count + item.ql * item.count) / (stack.count + item.count);
      stack.count += item.count;
    } else crate.items.push(item);
    this.events.emit('crate');
    return true;
  }

  /**
   * The crate or chest holding this thing, if one is.
   *
   * There has been a way to put a thing into a container and a way to take
   * *everything* out, and nothing in between — so taking one thing out was
   * done by the browser alone, moving the row from one window to the other in
   * its own copy with nobody told. On an island the next answer put it back,
   * which is what "it rubber bands from crate to inventory" was. This is what
   * `take_from_store` asks, so that there is a door.
   *
   * Crates and the chests and barrels that hold things are shown through the
   * same window, and had the same hole in them, so both are looked in.
   */
  storeWith(uid: number): { what: string; at: [number, number]; take: (id: number, count?: number) => Item | null; piece?: PlacedFurniture; crate?: PlacedCrate; level?: number } | null {
    /*
     * A bag on your back is the third of these, and was missing.
     *
     * It did not show while a bag on an island was always empty, and would
     * have the moment its contents came down: the window would have moved the
     * row in this browser's copy and the next answer would have put it back.
     * A worn bag is never out of reach, so it stands where you do.
     */
    const bag = this.inventory.bagWith(uid);
    if (bag) {
      return {
        what: itemDef(bag.id).name.toLowerCase(),
        at: [this.player.x, this.player.y],
        take: (id) => {
          const got = bagTake(bag, id);
          if (got) this.inventory.addItem(got);
          this.events.emit('inventory');
          return got;
        },
      };
    }
    /*
     * `count` of a stack, split off it, as the island's `move_part` does for
     * `take_from_store`: the rest stays where it is under its own uid. All of
     * it, or with no count, the stack itself.
     */
    const part = (items: Item[], whole: (id: number) => Item | null) => (id: number, count?: number): Item | null => {
      const it = items.find((i) => i.uid === id);
      if (!it) return null;
      if (count === undefined || count >= it.count) return whole(id);
      if (count < 1) return null;
      it.count -= count;
      this.events.emit('crate');
      return { ...it, uid: this.inventory.nextUid++, count };
    };
    for (const c of this.crates.values()) {
      if (!c.items.some((it) => it.uid === uid)) continue;
      return { what: crateName(c).toLowerCase(), at: crateCentre(c), take: part(c.items, (id) => this.crateTake(c, id)), crate: c, level: c.level ?? 0 };
    }
    for (const f of this.furniture.values()) {
      if (!f.items.some((it) => it.uid === uid)) continue;
      return {
        what: furnitureName(f).toLowerCase(),
        at: [f.x + 0.5, f.y + 0.5],
        take: part(f.items, (id) => this.furnitureTake(f, id)),
        piece: f,
        level: f.level ?? 0,
      };
    }
    return null;
  }

  crateTake(crate: PlacedCrate, uid: number): Item | null {
    const idx = crate.items.findIndex((it) => it.uid === uid);
    if (idx < 0) return null;
    const [item] = crate.items.splice(idx, 1);
    this.events.emit('crate');
    return item;
  }

  /**
   * What a craft may make things out of, in the order it spends them.
   *
   * Asked for: "When crafting, allow the ingredients to be used from any
   * container within 3 tiles." So a craft reaches past the pack: into the
   * bags on your back, and into every crate and every piece of furniture that
   * holds things within `CRAFT_REACH` tiles of the tile you are standing on,
   * measured the way any job's reach is.
   *
   * The pack is spent first, then the bags, then the stores nearest first: a
   * craft uses what you are carrying before it reaches for anything, and
   * reaches no further than it has to. The island spends in the same order,
   * in `craft_stock`.
   *
   * It reaches only where a hand could: not into a store with a padlock you
   * hold no key to, nor into one that is somebody else's -- a crate the
   * island says is not yours, a piece neither set down by you nor standing on
   * a settlement of yours -- nor into a trash crate, whose contents are on
   * their way out, nor a market stall, whose wares are for sale. A thing put
   * by is never spent, wherever it is.
   *
   * And only as far as the settings let it. With `fromStores` off it stops at
   * the bags on your back. With `spareRare` on, a rare, supreme or fantastic
   * stack is left out -- unless it is `chosen`, the stack the work was
   * pointed at, or the list is `every` stack for a menu to choose from, where
   * naming a stack is choosing it. The island narrows its `craft_stock` the
   * same two ways.
   */
  craftStock(chosen?: number, every = false, reach = CRAFT_REACH): CraftStock[] {
    const pack = this.inventory;
    const out: CraftStock[] = [];
    const spare = this.settings.spareRare && !every;
    const kept = (it: Item): boolean => !spare || !(it.rare ?? 0) || it.uid === chosen;
    for (const it of pack.items) {
      if (pack.loose(it) && kept(it)) out.push({ item: it, carried: true, spend: (n) => pack.remove(it.uid, n), list: pack.items, touched: () => { pack.onChange?.(); this.events.emit('inventory'); } });
    }
    for (const bag of pack.items) {
      const inside = bag.inside;
      if (!inside?.length) continue;
      for (const it of inside) {
        if (!pack.loose(it) || !kept(it)) continue;
        out.push({
          item: it,
          carried: true,
          spend: (n) => {
            if (!spendOut(inside, it.uid, n)) return false;
            pack.onChange?.();
            return true;
          },
          list: inside,
          touched: () => { pack.onChange?.(); this.events.emit('inventory'); },
        });
      }
    }
    for (const store of this.storesForCraft(reach)) {
      for (const it of store.items) {
        if (it.locked || it.price !== undefined || !kept(it)) continue;
        out.push({
          item: it,
          carried: false,
          store: store.name,
          spend: (n) => {
            if (!spendOut(store.items, it.uid, n)) return false;
            this.events.emit('crate');
            return true;
          },
          list: store.items,
          touched: () => this.events.emit('crate'),
        });
      }
    }
    return out;
  }

  /**
   * The crates and pieces a craft may reach into, nearest first. See
   * `craftStock` for which, and why.
   *
   * A vehicle is the one piece that is anybody's: a cart, a wagon or a boat
   * may be loaded and emptied by whoever stands at it, so a craft reaches
   * into one whoever built it and whosever ground it stands on. A padlock on
   * it still keeps a craft out, as it keeps out a hand.
   */
  private storesForCraft(reach = CRAFT_REACH): Array<{ items: Item[]; name: string }> {
    // "A player setting to only use inventory."
    if (!this.settings.fromStores) return [];
    return this.storesWithin(reach);
  }

  /**
   * How far work at a smelter or an anvil reaches into your stores: as far as
   * a craft does, and further for a Smith's Forge Reach. Which work that is,
   * is `FORGE_WORK`; the island reads the same key for the same jobs.
   */
  forgeReach(): number {
    return Math.max(CRAFT_REACH, this.perk('reach:forge', CRAFT_REACH));
  }

  /**
   * The crates and pieces within `reach` tiles that a craft may take from,
   * nearest first: the same rule as `storesForCraft`, at any reach. A Mason's
   * Hod Carrier builds out of these.
   */
  storesWithin(reach: number): Array<{ items: Item[]; name: string }> {
    const tx = this.player.tileX;
    const ty = this.player.tileY;
    const within = (x: number, y: number): boolean => Math.max(Math.abs(x - tx), Math.abs(y - ty)) <= reach;
    const found: Array<{ items: Item[]; name: string; d: number; order: number }> = [];
    const far = (cx: number, cy: number): number => Math.hypot(cx - this.player.x, cy - this.player.y);
    this.placed.crates.around(tx + 0.5, ty + 0.5, reach, (c) => {
      // Never a settlement store: everything that leaves one goes through its log (`stores.ts`).
      if (!c.items.length || !within(c.x, c.y) || c.storeOf || c.mine === false || this.lockRefusal(c)) return;
      const [cx, cy] = crateCentre(c);
      found.push({ items: c.items, name: crateName(c), d: far(cx, cy), order: c.id });
    }, this.player.level);
    this.placed.furniture.around(tx + 0.5, ty + 0.5, reach, (f) => {
      if (!f.items.length || !within(f.x, f.y) || f.storeOf) return;
      const def = furnitureDef(f.kind);
      if (!furnitureHolds(f) || def.trash || def.stall) return;
      const anybodys = !!(def.cart || def.vehicle || def.boat);
      if (f.mine === false && !anybodys && !this.storesOpenAt(f.x, f.y)) return;
      if (this.lockRefusal(f)) return;
      const [cx, cy] = furnitureCentre(f);
      // After the crates at the same distance, to the same rule as the island.
      found.push({ items: f.items, name: furnitureName(f), d: far(cx, cy), order: 1e9 + f.id });
    }, this.player.level);
    return found.sort((a, b) => a.d - b.d || a.order - b.order);
  }

  /**
   * The pieces holding a liquid that work may draw from, within `reach`
   * tiles: by the rule `storesWithin` keeps for the stores a craft reaches --
   * on your side of the ground floor, yours or on a settlement of yours, not
   * locked against you, and none at all with `fromStores` off. A dyeing draws
   * its dye from a barrel of these (`dyeBarrels`); the island's `dye_barrels`.
   */
  liquidStoresWithin(reach = CRAFT_REACH): PlacedFurniture[] {
    if (!this.settings.fromStores) return [];
    const tx = this.player.tileX;
    const ty = this.player.tileY;
    const out: PlacedFurniture[] = [];
    this.placed.furniture.around(tx + 0.5, ty + 0.5, reach, (f) => {
      if (Math.max(Math.abs(f.x - tx), Math.abs(f.y - ty)) > reach || !holdsLiquid(f)) return;
      if (f.mine === false && !this.storesOpenAt(f.x, f.y)) return;
      if (this.lockRefusal(f)) return;
      out.push(f);
    }, this.player.level);
    return out;
  }

  /** How far a craft reaches into your stores (`CRAFT_REACH`): as far as building does too (`buildReach`). */
  craftReach(): number {
    return CRAFT_REACH;
  }

  /** How far a dyeing reaches for a barrel of dye: as far as a craft reaches into your stores. */
  dyeReach(): number {
    return CRAFT_REACH;
  }

  /**
   * One stack that work at a station may spend, by its number: in the pack,
   * in a bag on your back, or in a store within `CRAFT_REACH`.
   *
   * Asked for: "pouring a mould, as an action that requires ingredients,
   * should be pulling the iron from the adjacent wagon as it is within 3
   * tiles". So whatever a smelter, a kiln, a fire, an oven, an anvil, a
   * barrel or an improvement uses up comes from the same stock a craft does,
   * in the same order and by the same rules (see `craftStock`). The tools --
   * a mould, a coin die, a file -- are still the ones you carry.
   */
  stockEntry(uid: number, reach = CRAFT_REACH): CraftStock | undefined {
    return this.craftStock(uid, false, reach).find((s) => s.item.uid === uid);
  }

  /** Every stack at hand that answers `pick`, in the order a craft spends them. */
  stockOf(pick: (it: Item) => boolean, reach = CRAFT_REACH): CraftStock[] {
    return this.craftStock(undefined, false, reach).filter((s) => pick(s.item));
  }

  /**
   * The same, for a station's menu to choose from: rare stock included
   * whatever the settings say, because a stack named off a menu is chosen.
   */
  stockChoices(pick: (it: Item) => boolean, reach = CRAFT_REACH): CraftStock[] {
    return this.craftStock(undefined, true, reach).filter((s) => pick(s.item));
  }

  /** How many of a kind are at hand to be spent, carried and stored within reach. */
  stockCount(id: string): number {
    return this.stockOf((it) => it.id === id).reduce((n, s) => n + s.item.count, 0);
  }

  /**
   * Use up `n` of a kind from what is at hand, across as many stacks as it
   * takes and in the order a craft spends them: a bill, like a brew's twenty
   * apples, rather than one stack pointed at. False, and nothing spent, when
   * there are not that many.
   */
  spendStock(id: string, n: number): boolean {
    const from = this.stockOf((it) => it.id === id);
    if (from.reduce((sum, s) => sum + s.item.count, 0) < n) return false;
    let left = n;
    for (const s of from) {
      if (left <= 0) break;
      const take = Math.min(left, s.item.count);
      if (take > 0 && s.spend(take)) left -= take;
    }
    return left === 0;
  }

  /**
   * One thing a craft may be aimed at, by its number: in the pack, in a bag
   * on your back, or in a store within reach. The pack is asked first and on
   * its own, since that is where nearly every aim is and the question is put
   * once for every recipe a menu offers.
   */
  craftItem(uid: number, reach = CRAFT_REACH): Item | undefined {
    const pack = this.inventory;
    const it = pack.get(uid);
    if (it) return pack.loose(it) ? it : undefined;
    for (const bag of pack.items) {
      const inside = bag.inside?.find((x) => x.uid === uid);
      if (inside) return pack.loose(inside) ? inside : undefined;
    }
    for (const store of this.storesForCraft(reach)) {
      const stored = store.items.find((x) => x.uid === uid);
      if (stored) return !stored.locked && stored.price === undefined ? stored : undefined;
    }
    return undefined;
  }

  addCampfire(x: number, y: number, sx: number, sy: number, fuel = 0, lit = false): PlacedCampfire {
    const [ax, ay] = fireAnchor(sx, sy);
    const fire: PlacedCampfire = { id: this.nextFireId++, x, y, sx: ax, sy: ay, fuel, lit };
    this.campfires.set(fire.id, fire);
    this.placed.campfires.add(fire);
    this.events.emit('crate');
    return fire;
  }

  removeCampfire(id: number): void {
    const fire = this.campfires.get(id);
    if (fire) this.placed.campfires.remove(fire);
    this.campfires.delete(id);
    this.events.emit('crate');
  }

  campfiresOnTile(x: number, y: number): readonly PlacedCampfire[] {
    return this.placed.campfires.at(x, y);
  }

  /** The fire covering a subtile, if any. */
  campfireAt(x: number, y: number, sx: number, sy: number): PlacedCampfire | undefined {
    return this.placed.campfires.at(x, y).find((f) => fireCovers(f, sx, sy));
  }

  /** Why a campfire cannot go on this spot, or null when it can. */
  firePlaceReason(x: number, y: number, sx: number, sy: number): string | null {
    const [ax, ay] = fireAnchor(sx, sy);
    if (!this.world.isPassable(x, y) || this.world.hasWater(x, y)) return 'Fire needs dry, open ground.';
    const steepest = 20;
    if (this.world.slope(x, y) > steepest) return `Too steep: slope over ${metres(steepest)} m.`;
    if (this.isToken(x, y)) return 'Not on the totem.';
    if (this.buildings.buildingAt(x, y)) return 'Not inside a building.';
    for (let dy = 0; dy < FIRE_SUBTILES; dy++) {
      for (let dx = 0; dx < FIRE_SUBTILES; dx++) {
        if (this.crateAt(x, y, ax + dx, ay + dy)) return 'A crate is in the way.';
        if (this.campfireAt(x, y, ax + dx, ay + dy)) return 'Already a fire there.';
      }
    }
    return null;
  }

  /** The nearest lit fire within reach, for cooking. */
  litFireNear(range = 2.4): PlacedCampfire | undefined {
    let best: PlacedCampfire | undefined;
    let bestD = range;
    this.placed.campfires.around(this.player.x, this.player.y, range + 1, (f) => {
      if (!f.lit) return;
      const [cx, cy] = fireCentre(f);
      const d = Math.hypot(cx - this.player.x, cy - this.player.y);
      if (d <= bestD) {
        bestD = d;
        best = f;
      }
    }, this.player.level);
    return best;
  }

  /** Whether the player is standing somewhere a recipe's station requires. */
  atStation(station: Station): boolean {
    if (station === 'campfire') return this.litFireNear() !== undefined || this.hotOvenNear() !== undefined;
    if (station === 'smelter') return this.hotSmelterNear() !== undefined;
    return this.furnitureNear(station) !== undefined;
  }

  /**
   * What Masterwork adds to the quality of a thing made at a station: the best
   * of the pieces of that kind within reach (`swingEnchant`), and none for a
   * fire. The island's `station_master`.
   */
  masterAt(station: Station): number {
    if (station === 'campfire' || station === 'smelter') return 0;
    let most = 0;
    this.placed.furniture.around(this.player.x, this.player.y, PLACED_REACH + 2, (f) => {
      if (f.kind !== station) return;
      const [cx, cy] = furnitureCentre(f);
      if (Math.hypot(cx - this.player.x, cy - this.player.y) <= PLACED_REACH) most = Math.max(most, swingEnchant(f, 'master'));
    }, this.player.level);
    return most;
  }

  /** The nearest piece of furniture of a kind, within arm's reach. */
  furnitureNear(kind: string, range = STATION_REACH): PlacedFurniture | undefined {
    let best: PlacedFurniture | undefined;
    this.placed.furniture.around(this.player.x, this.player.y, range + 2, (f) => {
      if (best || f.kind !== kind) return;
      const [cx, cy] = furnitureCentre(f);
      if (Math.hypot(cx - this.player.x, cy - this.player.y) <= range) best = f;
    }, this.player.level);
    return best;
  }

  /** The nearest smelter that is lit and within reach. */
  hotSmelterNear(range = 2.6): PlacedSmelter | undefined {
    let best: PlacedSmelter | undefined;
    this.placed.smelters.around(this.player.x, this.player.y, range + 1, (s) => {
      if (best || !s.lit) return;
      const [cx, cy] = smelterCentre(s);
      if (Math.hypot(cx - this.player.x, cy - this.player.y) <= range) best = s;
    }, this.player.level);
    return best;
  }

  /** The nearest oven that is alight and within reach of the work. */
  hotOvenNear(range = 2.6): PlacedFurniture | undefined {
    let best: PlacedFurniture | undefined;
    this.placed.furniture.around(this.player.x, this.player.y, range + 2, (f) => {
      if (best || !f.lit || !furnitureDef(f.kind).hearth) return;
      const [cx, cy] = furnitureCentre(f);
      if (Math.hypot(cx - this.player.x, cy - this.player.y) <= range) best = f;
    }, this.player.level);
    return best;
  }

  /** Litres a well draws in a second: a deep, true-lined shaft finds more water. */
  wellRate(f: PlacedFurniture): number {
    return WELL_TRICKLE + (f.ql / WELL_TRICKLE_AT) * WELL_TRICKLE_QL;
  }

  /**
   * What a Vesp brought from its trip, into its hive (`hiveTakes`): the whole honey and beeswax it made, which go in
   * at the quality of the honey toward them. The island's `vesp_put`.
   */
  hivePut(f: PlacedFurniture, honey: number, ql: number): { honey: number; wax: number } {
    const made = hiveTakes(f, honey, ql);
    const q = Math.min(100, Math.max(1, made.ql));
    if (made.honey) this.furnitureAdd(f, { uid: this.inventory.nextUid++, id: 'honey', ql: q, dmg: 0, count: made.honey });
    if (made.wax) this.furnitureAdd(f, { uid: this.inventory.nextUid++, id: 'wax', ql: q, dmg: 0, count: made.wax });
    if (made.honey || made.wax) this.events.emit('crate');
    return made;
  }

  /**
   * A Fisher's pond, stocking itself: a fish every `POND_EVERY` while it has
   * room, any of the five at their plain weights, at about its own quality.
   * The island's `pond_sweep`.
   */
  private stockPond(f: PlacedFurniture, dt: number): void {
    let stock = (f.stock ?? 0) + dt / POND_EVERY;
    let made = 0;
    while (stock >= 1 && hiveRoom(f) > 0) {
      stock -= 1;
      const fish = pickFish(this, FISH);
      if (!fish) break;
      const ql = Math.min(100, Math.max(1, f.ql * (0.7 + this.rand() * 0.6)));
      this.furnitureAdd(f, { uid: this.inventory.nextUid++, id: fish.id, ql, dmg: 0, count: 1 });
      made++;
    }
    f.stock = stock;
    if (made) this.events.emit('crate');
  }

  /**
   * Everything placed that works by itself: ovens burning down, wells filling,
   * rubbish rotting where it was thrown, a cart following you about, and a
   * grave whose hour is up crumbling.
   */
  private runPlaceables(dt: number): void {
    // Graves keep real time, like the woods; an island crumbles its own.
    const now = Date.now() / 1000;
    const crumbled: PlacedFurniture[] = [];
    for (const f of this.furniture.values()) {
      if (f.grave && f.grave.crumbles <= now && !this.packFromIsland) crumbled.push(f);
      const def = furnitureDef(f.kind);
      if (def.hearth && f.lit) {
        f.ash = (f.ash ?? 0) + Math.min(f.fuel ?? 0, dt) * ASH_RATE;
        f.fuel = (f.fuel ?? 0) - dt;
        if ((f.fuel ?? 0) <= 0) {
          f.fuel = 0;
          f.lit = false;
          this.logMsg('Oven out of fuel.', 'event');
          this.events.emit('world', f.x, f.y);
        }
      }
      if (def.pond && hiveRoom(f) > 0 && this.onDeed(f.x, f.y)) this.stockPond(f, dt);
      if (f.ferment !== undefined && f.ferment > 0) {
        f.ferment = Math.max(0, f.ferment - dt);
        if (f.ferment === 0) {
          // By yourself, a wine ages from the moment it is done here, whatever the clock said when it was set going (`ageing.ts`).
          if (!this.islandClock && f.agedFrom !== undefined) f.agedFrom = this.wallNow();
          this.logMsg(`${furnitureName(f)} done: ${LIQUID_NAME[f.liquid ?? 'water']}.`, 'event');
          this.events.emit('crate');
        }
      }
      if (def.well) {
        const before = f.litres ?? 0;
        if (before < def.well) {
          // A fountain an aqueduct pours into takes the channel's water on top of its own (`AQUEDUCT_LPS`).
          const fed = f.kind === 'fountain' && this.springs.feeds(f.x, f.y) ? AQUEDUCT_LPS : 0;
          f.litres = Math.min(def.well, before + (this.wellRate(f) + fed) * dt);
          f.liquid = 'water';
          if (Math.floor(f.litres) !== Math.floor(before)) this.events.emit('crate');
        }
      }
      if (def.trash && f.items.length) {
        // A trash crate is built to rot: what goes in it ages many times over.
        const hours = (dt / 3600) * def.trash;
        for (let i = f.items.length - 1; i >= 0; i--) {
          const item = f.items[i];
          item.dmg = Math.min(100, item.dmg + groundDecayRate(item) * hours);
          if (item.dmg < 100) continue;
          f.items.splice(i, 1);
          this.events.emit('crate');
        }
      }
      if (f.hitched) this.dragCart(f);
      // A cart goes at the pace of whoever has its reins, which on a shared
      // island is not always the person sitting at this screen.
      if (def.vehicle && teamOf(f).length) this.haulVehicle(f, dt, this.actors.get(f.driverId ?? this.local.id)?.stepped ?? 0);
      if (def.boat && f.driven) this.floatBoat(f);
    }
    if (crumbled.length) crumble(this, crumbled);
  }

  /**
   * The one vehicle the player is driving, if any. Nothing else in the world
   * can be driven at the same time, which is what keeps this a lookup.
   */
  driving(): PlacedFurniture | undefined {
    const me = this.acting.id;
    for (const f of this.furniture.values()) if (f.driven && (f.driverId ?? me) === me) return f;
    return undefined;
  }

  /** Who this body is in a hull's list of passengers, on this machine. An island names them by uid instead. */
  riderId(): string {
    return `local:${this.acting.id}`;
  }

  /** The hull this body is riding in as a passenger, if it is. */
  aboardShip(): PlacedFurniture | undefined {
    const id = this.player.aboard;
    return id === null ? undefined : this.furniture.get(id);
  }

  /** Into a place on her deck: the walk given up, and the body where the place is. */
  boardAsPassenger(f: PlacedFurniture, seat: number): void {
    const p = this.player;
    p.aboard = f.id;
    p.seat = seat;
    p.stop();
    [p.x, p.y] = this.passengerSpot(f, seat);
    p.level = 0;
  }

  /** Out of her and onto the ground at `x`, `y`. */
  leaveAsPassenger(x: number, y: number): void {
    const p = this.player;
    p.aboard = null;
    p.seat = 0;
    p.x = x;
    p.y = y;
    p.stop();
  }

  /**
   * Which way a hull points, in world radians: the way whoever has her helm
   * last took her, or the way she was set down.
   *
   * The helm is somebody else's on an island, so what is known of it is where
   * their body has been; `helmHeadings` keeps the last way it moved.
   */
  shipHeading(f: PlacedFurniture): number {
    if (f.driven && (f.driverId ?? this.acting.id) === this.acting.id) return this.heading();
    const known = this.helmHeadings.get(f.id);
    if (known !== undefined) return known;
    const [ax, ay] = ACROSS_OF[f.facing ?? 's'];
    return Math.atan2(ay, ax);
  }

  /** The place on deck where the passenger in `seat` stands, in the world. */
  passengerSpot(f: PlacedFurniture, seat: number): [number, number] {
    return this.onDeck(f, deckSpot(f.kind, seat));
  }

  /** Where whoever has her helm is drawn: at her middle, or on the deck her helm stands on. */
  helmSpot(f: PlacedFurniture): [number, number] {
    return this.onDeck(f, furnitureDef(f.kind).boat?.helm ?? [0, 0]);
  }

  /** A place on her deck, `along` her toward the bow and `across` her toward starboard, in the world. */
  private onDeck(f: PlacedFurniture, [along, across]: [number, number]): [number, number] {
    const [cx, cy] = this.hullCentre(f);
    const a = this.shipHeading(f);
    return [cx + Math.cos(a) * along - Math.sin(a) * across, cy + Math.sin(a) * along + Math.cos(a) * across];
  }

  /**
   * Where her middle is now: the body of whoever has the helm when that is
   * somebody else — they are moved a dozen times a second and she is re-read
   * once — and where she was set down when nobody has it.
   */
  hullCentre(f: PlacedFurniture): [number, number] {
    if (f.helm) {
      const who = this.roster.list().find((p) => p.uid === f.helm);
      if (who) return this.roster.drawnAt(who);
    }
    return furnitureCentre(f);
  }

  /** The way each hull with somebody else at her helm last moved, and where that helm was. */
  private readonly helmHeadings = new Map<number, number>();
  private readonly helmWas = new Map<number, [number, number]>();

  /** Follows the hulls other people are steering, for the way each points. */
  private trackHelms(): void {
    for (const f of this.furniture.values()) {
      if (!f.helm) continue;
      const [x, y] = this.hullCentre(f);
      const was = this.helmWas.get(f.id);
      if (was && Math.hypot(x - was[0], y - was[1]) > 0.02) this.helmHeadings.set(f.id, Math.atan2(y - was[1], x - was[0]));
      if (!was || Math.hypot(x - was[0], y - was[1]) > 0.02) this.helmWas.set(f.id, [x, y]);
    }
  }

  /**
   * The cart you are working from: the cart or wagon you have the reins of,
   * or the small cart you have by the shafts. Not a boat.
   *
   * Asked for: "When doing actions from the cart, all gathered materials
   * should go right to the cart." What a gathering job brings up goes into
   * this, as far as it has room; see `gather`.
   */
  workCart(): PlacedFurniture | undefined {
    const driven = this.driving();
    if (driven && vehicleOf(driven)) return driven;
    for (const f of this.furniture.values()) if (f.hitched) return f;
    return undefined;
  }

  /** When the cart was last said to be full, so a run of swings says it once. */
  private cartFullSaid = -Infinity;

  /**
   * What a gathering job brings up -- ore, dirt, logs, a catch, a harvest --
   * put where it belongs: into the cart you are working from, as much as it
   * has room for and will take, and the rest into the pack. The stack it
   * went into comes back, the cart's when any of it went there.
   */
  gather(id: string, opts: { ql?: number; count?: number; extra?: string; rare?: number } = {}): Item {
    const cart = this.workCart();
    // And what the settlement's baubles make of it, when it is the yield of a go.
    const count = this.baubleYield(id, opts.count ?? 1);
    if (count !== (opts.count ?? 1)) opts = { ...opts, count };
    if (!cart) return this.inventory.add(id, opts);
    const def = itemDef(id);
    const item: Item = { uid: 0, id, ql: Math.max(1, Math.min(100, opts.ql ?? 20)), dmg: 0, count, extra: opts.extra };
    if (opts.rare) item.rare = opts.rare;
    if (def.charges) item.charges = def.charges;
    const fit = furnitureRefuses(cart, item) ? 0 : Math.min(count, furnitureRoom(cart, item));
    if (fit < count) this.saidCartFull(cart);
    if (fit <= 0) return this.inventory.add(id, opts);
    item.uid = this.inventory.nextUid++;
    item.count = fit;
    const stack = cart.items.find((it) => sameStack(it, item));
    if (stack) foldInto(stack, item);
    else cart.items.push(item);
    if (fit < count) this.inventory.add(id, { ...opts, count: count - fit });
    this.events.emit('crate');
    return stack ?? item;
  }

  /** A catch that is already a thing -- a creel's -- put the same way `gather` puts one. */
  gatherItem(item: Item): void {
    const cart = this.workCart();
    const fit = !cart || furnitureRefuses(cart, item) ? 0 : Math.min(item.count, furnitureRoom(cart, item));
    if (cart && fit < item.count) this.saidCartFull(cart);
    if (!cart || fit <= 0) {
      this.inventory.addItem(item);
      return;
    }
    const part: Item = fit < item.count ? { ...item, uid: this.inventory.nextUid++, count: fit } : item;
    const stack = cart.items.find((it) => sameStack(it, part));
    if (stack) foldInto(stack, part);
    else cart.items.push(part);
    if (fit < item.count) this.inventory.addItem({ ...item, count: item.count - fit });
    this.events.emit('crate');
  }

  private saidCartFull(cart: PlacedFurniture): void {
    if (this.time - this.cartFullSaid < 30) return;
    this.cartFullSaid = this.time;
    this.logMsg(`${furnitureName(cart)} full: the rest goes to your pack.`, 'error');
  }

  /** The wildermon in the traces of a vehicle, dead ones dropped. */
  team(f: PlacedFurniture): Creature[] {
    const out: Creature[] = [];
    for (const id of teamOf(f)) {
      const c = this.creatures.get(id);
      if (c) out.push(c);
    }
    return out;
  }

  /**
   * How fast a team takes a vehicle along, in tiles a second. The animals
   * decide it and nothing else: a quick one gets there sooner, more of them
   * pull better than fewer, a practised one finds its feet, and a hungry one
   * drags. What is loaded on the back has no say at all, which is the whole
   * point of putting it there.
   */
  vehicleSpeed(f: PlacedFurniture): number {
    const v = vehicleOf(f);
    const team = this.team(f);
    if (!v || team.length < v.needs) return 0;
    let sum = 0;
    let worst = 1;
    for (const c of team) {
      sum += this.creatures.species(c).speed * ageDef(c, this.time).speed * this.creatures.speedMul(c);
      worst = Math.min(worst, 0.6 + 0.4 * c.hunger);
    }
    const mean = sum / team.length;
    // Every beast adds its own share of the pull; the ones bred for it add more.
    let pull = 0.75;
    for (const c of team) pull += (this.creatures.species(c).pull ?? PULL_DEFAULT) * ageDef(c, this.time).pull * bloodMul(c, 'haul');
    // A body of light wood rolls a shade easier than one of oak, which is the
    // price oak charges for holding more and lasting longer.
    // The builder's mark goes on after the cap, as the island has it, so a
    // Carpenter's Smooth Axle is its whole share at the top of the range too;
    // and so does the driver's hand on the reins (`drivingPace`), and how well the thing was built (`vehicleQlPace`).
    // And the team's ancient bridles (`bridleTeam`), past the cap as tack is, and its wildermon harnesses (`harnessTeam`).
    return Math.min(MAX_VEHICLE_SPEED, mean * pull * worst * footing(this.teamClimb(f)) * rollEase(f.material)) * markOf(f, 'speed')
      * drivingPace(this.skills.get(DRIVING)) * vehicleQlPace(f.ql) * bridleTeam(team) * harnessTeam(team);
  }

  /** How full a vehicle is, 0..1. An empty one rolls over anything. */
  vehicleLoad(f: PlacedFurniture): number {
    const heft = furnitureHeft(f);
    if (heft) return Math.min(1, furnitureKg(f) / heft);
    const cap = furnitureCapacity(f);
    return cap ? Math.min(1, furnitureUnits(f) / cap) : 0;
  }

  /**
   * What a team knows about hills between them, which is what a slope asks: each one's climbing, or for a kind that
   * learns its own skill by pulling, that skill in its place (`tracesSkill`). The island's `team_climb`.
   */
  teamClimb(f: PlacedFurniture): number {
    const team = this.team(f);
    if (!team.length) return 0;
    let sum = 0;
    for (const c of team) sum += c.skills[tracesSkill(this.creatures.species(c))] ?? 0;
    return sum / team.length;
  }

  /**
   * The steepest step a vehicle will take, in height units. Wheels start off
   * worse than a walker and a trained team ends up better: what a draught
   * beast learns in the traces is which lines it can hold.
   */
  vehicleStep(f: PlacedFurniture | undefined): number {
    return VEHICLE_STEP + (f ? this.teamClimb(f) * CLIMB_PITCH : 0);
  }

  /**
   * The storey a creature stands on: a wagon's it is in the traces of, its
   * rider's under a rider (`rideRule`), and otherwise the ground. A mount is
   * mounted and dismounted on the ground floor only (`MOUNT_STOREY_SAID`).
   */
  creatureStorey(c: Creature): number {
    if (c.hitchedTo !== null) return Math.max(0, this.furniture.get(c.hitchedTo)?.level ?? 0);
    if (c.ridden) return Math.max(0, this.player.level);
    if (c.riderUid) return Math.max(0, this.roster.byUid(c.riderUid)?.level ?? c.storey ?? 0);
    return 0;
  }

  /** The wildermon the player is up on, if any. */
  mounted(): Creature | undefined {
    for (const c of this.creatures.list.values()) if (c.ridden) return c;
    return undefined;
  }

  /** How fast a mount carries a rider: its own pace, steadied by practice. */
  mountSpeed(c: Creature): number {
    const def = this.creatures.species(c);
    // Shod, it goes quicker on laid stone.
    const shod = isShod(this.time, c) && !!TILE_DEFS[this.world.getTile(this.player.tileX, this.player.tileY)].paved ? SHOE_PACE : 1;
    // And quicker again in tack its maker's hand is in (a Tailor's Saddler), past the cap, as a vehicle's mark is.
    return Math.min(MAX_MOUNT_SPEED, def.speed * ageDef(c, this.time).speed * this.creatures.speedMul(c) * footing(c.skills[HAUL_SKILL] ?? 0) * (0.6 + 0.4 * c.hunger) * shod) * tackSpeed(c);
  }

  /**
   * The steepest step a mount will take. A green one is no worse than your own
   * legs and a worked one goes up what you would have to go round, which is
   * what the climbing it earns on bad ground is for.
   */
  mountStep(c: Creature): number {
    const sure = this.creatures.species(c).pitch ?? 1;
    return MAX_STEP + (c.skills[HAUL_SKILL] ?? 0) * CLIMB_PITCH * 2 * sure + (isShod(this.time, c) ? SHOE_STEP : 0);
  }

  /** The steepest tile a mount will carry a rider onto: the standing cap, raised by whatever raises its step. */
  mountStand(c: Creature): number {
    return MAX_STAND + this.mountStep(c) - MAX_STEP;
  }

  /** Get up on a saddled wildermon. */
  mount(c: Creature): boolean {
    if (!this.creatures.species(c).mount || !c.tacked || c.hitchedTo !== null || this.driving()) return false;
    const up = this.mounted();
    if (up) up.ridden = false;
    c.ridden = true;
    c.enemy = null;
    c.state = 'idle';
    c.x = this.player.x;
    c.y = this.player.y;
    this.events.emit('creature');
    return true;
  }

  /** Get down again, wherever the pair of you have got to. */
  dismount(): void {
    const c = this.mounted();
    if (!c) return;
    c.ridden = false;
    c.moving = false;
    this.player.speedMul = 1;
    this.player.stop();
    this.events.emit('creature');
  }

  /**
   * Off everything at once, at the island's word: a place on a deck, the helm
   * or the reins, the shafts of a cart and a saddle, each left where it is.
   *
   * A keeper of the island moving a stuck body has already let go of them over
   * there (`rpc_owner_move`). Said here too, before the next ground read says
   * it, because until then a passenger's body is put back on her deck every
   * frame, and that read would then step it ashore beside her.
   */
  letGoOfAll(): void {
    const p = this.player;
    p.aboard = null;
    p.seat = 0;
    const me = this.acting.id;
    for (const f of this.furniture.values()) {
      if (f.driven && (f.driverId ?? me) === me) {
        f.driven = false;
        f.driverId = undefined;
      }
      if (f.hitched) f.hitched = false;
    }
    this.dismount();
  }

  // ---- What the errand workers need to know about the world. ----

  /** A barrel on the deed with room in it for more water. */
  thirstyVessel(): PlacedFurniture | undefined {
    for (const f of this.furniture.values()) {
      const def = furnitureDef(f.kind);
      if (!def.liquid || !this.onDeed(f.x, f.y)) continue;
      if ((f.litres ?? 0) >= def.liquid) continue;
      if (f.liquid && f.liquid !== 'water') continue;
      return f;
    }
    return undefined;
  }

  /** Pour a measure into a vessel, which is what a bucket does at either end. */
  pourInto(f: PlacedFurniture, litres: number, liquid: LiquidKind): void {
    const cap = furnitureDef(f.kind).liquid ?? 0;
    f.liquid = liquid;
    f.litres = Math.min(cap, (f.litres ?? 0) + litres);
    this.events.emit('crate');
    this.events.emit('world', f.x, f.y);
  }

  /** Somewhere within reach worth dipping into: a well, or open water. */
  waterSource(fromX: number, fromY: number, range: number, near: (x: number, y: number) => boolean): { x: number; y: number; well?: PlacedFurniture } | undefined {
    for (const f of this.furniture.values()) {
      if (!furnitureDef(f.kind).well || (f.litres ?? 0) < 1 || !this.onDeed(f.x, f.y)) continue;
      const [cx, cy] = furnitureCentre(f);
      return { x: cx, y: cy, well: f };
    }
    const r = Math.ceil(range);
    let best: { x: number; y: number } | undefined;
    let bestD = Infinity;
    for (let y = Math.floor(fromY) - r; y <= Math.floor(fromY) + r; y++) {
      for (let x = Math.floor(fromX) - r; x <= Math.floor(fromX) + r; x++) {
        if (!this.world.inBounds(x, y) || !this.world.hasWater(x, y) || !near(x, y)) continue;
        const d = Math.hypot(x + 0.5 - fromX, y + 0.5 - fromY);
        if (d < bestD) {
          bestD = d;
          best = { x: x + 0.5, y: y + 0.5 };
        }
      }
    }
    return best;
  }

  /** Take a measure out of a well, as a bucket would. */
  drawFromWell(f: PlacedFurniture, litres: number): void {
    f.litres = Math.max(0, (f.litres ?? 0) - litres);
    this.events.emit('crate');
  }

  /**
   * The planned work within reach that wants something, and what it wants: a
   * wall on any storey, a floor slot (a floor, a roof, a staircase or a
   * ladder, a deck on piers with its piers), a column, the open span of a
   * bridge or an aqueduct, or a foundation's shuttering -- whatever is built a
   * piece at a time off a bill (`HOD_WORK`).
   *
   * The piece in hand first, wherever it is wanted, and otherwise only what
   * the stores hold (`stocked`), nearest `from` first -- so one piece of work
   * wanting what nobody has brought never keeps a hod carrier from another it
   * could finish -- and of one piece of work's wants, what is furthest behind
   * its bill, so brick and mortar go in together. Ties go by kind in the order
   * of `HOD_WORK`, then storey, side, x, y and the thing's name. The island's
   * `hod_needing` and `hod_needing_stocked`, in the same order.
   */
  hodNeeding(
    near: (x: number, y: number) => boolean,
    holding?: string,
    from?: { x: number; y: number },
    stocked?: (item: string) => boolean,
  ): HodJob | undefined {
    type Key = { held: boolean; d: number; behind: number; rank: number; level: number; dir: string; x: number; y: number; item: string };
    const before = (a: Key, b: Key): boolean => {
      if (a.held !== b.held) return a.held;
      if (a.d !== b.d) return a.d < b.d;
      if (a.behind !== b.behind) return a.behind > b.behind;
      if (a.rank !== b.rank) return a.rank < b.rank;
      if (a.level !== b.level) return a.level < b.level;
      if (a.dir !== b.dir) return a.dir < b.dir;
      if (a.x !== b.x) return a.x < b.x;
      if (a.y !== b.y) return a.y < b.y;
      return a.item < b.item;
    };
    let best: (Key & { target: HodTarget }) | undefined;
    const consider = (target: HodTarget, bill: Bill, x: number, y: number, level: number, dir: string): void => {
      if (!near(x, y)) return;
      const d = from ? (x - from.x) ** 2 + (y - from.y) ** 2 : 0;
      for (const [item, n] of Object.entries(bill.needed)) {
        if (n <= 0) continue;
        const held = item === holding;
        if (!held && stocked && !stocked(item)) continue;
        const key = { held, d, behind: n / Math.max(1, bill.total[item] ?? 0), rank: HOD_WORK.indexOf(target.kind), level, dir, x, y, item };
        if (!best || before(key, best)) best = { ...key, target };
      }
    };
    for (const wall of this.buildings.walls.values()) if (!isDone(wall)) consider({ kind: 'wall', wall }, wall, wall.x, wall.y, wall.level, wall.dir);
    for (const floor of this.buildings.floors.values()) if (!isDone(floor)) consider({ kind: 'floor', floor }, floor, floor.x, floor.y, floor.level, '');
    for (const column of this.buildings.columns.values()) if (!isDone(column)) consider({ kind: 'column', column }, column, column.x, column.y, column.level, '');
    for (const bridge of this.bridges.values()) {
      // The span a builder works: the first still open (`openSpan`).
      const span = openSpan(bridge);
      if (span) consider({ kind: 'span', bridge, span }, span, span.x, span.y, 0, '');
    }
    for (const foundation of this.foundations.values()) if (!foundationDone(foundation)) consider({ kind: 'foundation', foundation }, foundation, foundation.x, foundation.y, 0, '');
    return best && { target: best.target, item: best.item, x: best.x, y: best.y };
  }

  /**
   * Everything planned work within reach (`near`) still wants, whether the
   * stores hold it or not: each thing once, nearest the work wanting it to
   * `from` first, then by name; and how many things that is. What a hod
   * carrier with nothing it can fetch names as wanted (`Idle.what`). The
   * island's `hod_wanted`.
   */
  hodWanted(near: (x: number, y: number) => boolean, from: { x: number; y: number }): { items: string[]; n: number } {
    const nearest = new Map<string, number>();
    const consider = (bill: Bill, x: number, y: number): void => {
      if (!near(x, y)) return;
      const d = (x - from.x) ** 2 + (y - from.y) ** 2;
      for (const [item, n] of Object.entries(bill.needed)) if (n > 0 && d < (nearest.get(item) ?? Infinity)) nearest.set(item, d);
    };
    for (const wall of this.buildings.walls.values()) if (!isDone(wall)) consider(wall, wall.x, wall.y);
    for (const floor of this.buildings.floors.values()) if (!isDone(floor)) consider(floor, floor.x, floor.y);
    for (const column of this.buildings.columns.values()) if (!isDone(column)) consider(column, column.x, column.y);
    for (const bridge of this.bridges.values()) {
      const span = openSpan(bridge);
      if (span) consider(span, span.x, span.y);
    }
    for (const foundation of this.foundations.values()) if (!foundationDone(foundation)) consider(foundation, foundation.x, foundation.y);
    const items = [...nearest].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([item]) => item);
    return { items, n: items.length };
  }

  /**
   * Fit one piece of `item` into a piece of planned work, as a builder's own go
   * at it does: the same bill, and what the last of it starts (`wallFitted`,
   * `floorFitted`, `fitIntoSpan`, `fitIntoChannel`, `pourIntoFoundation`).
   * Without the builder's skill, tool or words, which are the builder's own.
   * The island's `hod_fit`.
   */
  fitPiece(target: HodTarget, item: string): void {
    switch (target.kind) {
      case 'wall':
        return this.fitIntoWall(target.wall, item);
      case 'floor': {
        const f = target.floor;
        if ((f.needed[item] ?? 0) <= 0) return;
        f.needed[item] -= 1;
        this.floorFitted();
        this.events.emit('world', f.x, f.y);
        return;
      }
      case 'column': {
        const c = target.column;
        if ((c.needed[item] ?? 0) <= 0) return;
        c.needed[item] -= 1;
        this.events.emit('world', c.x, c.y);
        return;
      }
      case 'span': {
        if ((target.span.needed[item] ?? 0) <= 0) return;
        if (target.bridge.kind === 'aqueduct') fitIntoChannel(this, target.bridge, target.span, item);
        else fitIntoSpan(this, target.bridge, target.span, item);
        return;
      }
      case 'foundation':
        if (item !== 'concrete' || (target.foundation.needed.concrete ?? 0) <= 0) return;
        return pourIntoFoundation(this, target.foundation);
    }
  }

  /** How many more of `item` a piece of planned work wants. The island's `hod_left`. */
  hodWants(target: HodTarget, item: string): number {
    const bill = target.kind === 'wall' ? target.wall : target.kind === 'floor' ? target.floor : target.kind === 'column' ? target.column
      : target.kind === 'span' ? target.span : target.foundation;
    return Math.max(0, (bill.needed as Record<string, number>)[item] ?? 0);
  }

  /** Fit one piece into a planned wall, the way a builder does by hand. */
  fitIntoWall(wall: Wall, item: string): void {
    if ((wall.needed[item] ?? 0) <= 0) return;
    wall.needed[item] -= 1;
    this.wallFitted(wall);
    this.events.emit('world', wall.x, wall.y);
  }

  /**
   * What a piece fitted into a wall starts, a builder's or a hod carrier's:
   * with the last of it the ivy starts from bare stone (`greening.ts`), the last
   * wall round a building roofed in glass makes a glasshouse of it
   * (`glasshouse.ts`), and a shop counter's store opens behind it
   * (`counters.ts`). On the island the wall's triggers and `counter_finished`.
   */
  wallFitted(wall: Wall): void {
    if (!isDone(wall)) return;
    wall.greenSince = greenNow();
    this.buildings.changed();
    glassResync(this);
    counterFinished(this, wall);
  }

  /**
   * What a piece fitted into a floor slot starts, a builder's or a hod
   * carrier's: the last pane of a glass roof makes a glasshouse, and what
   * grows in it goes onto the glass clock (`glasshouse.ts`). On the island the
   * floor's triggers.
   */
  floorFitted(): void {
    glassResync(this);
  }

  /**
   * The most knocked-about thing in the deed's stores, and where it is kept.
   * Never a find nobody has restored yet, which nothing mends (`unrestored`), and never one in `skip`: a mender
   * at a stage mends the next most damaged after it in the same go.
   */
  damagedInStores(skip?: ReadonlySet<Item>): { store: DeedStore; item: Item } | undefined {
    let best: { store: DeedStore; item: Item } | undefined;
    for (const store of this.deedStores()) {
      for (const item of store.items) {
        if (item.dmg <= 1 || unrestored(item) || skip?.has(item)) continue;
        if (!best || item.dmg > best.item.dmg) best = { store, item };
      }
    }
    return best;
  }

  /** Ground a sprout would take: open, dry and nothing standing on it. */
  plantableTile(x: number, y: number): boolean {
    if (!this.world.inBounds(x, y) || this.world.hasWater(x, y)) return false;
    if (this.buildings.buildingAt(x, y) || this.isToken(x, y)) return false;
    // Nor a Runestone's ground (`runestones.ts`), as the island's `plantable_tile` has it.
    if (runestoneAt(x, y, this.world.w)) return false;
    if (this.cratesOnTile(x, y).length || this.furnitureOnTile(x, y).length) return false;
    return PLANTABLE.has(this.world.getTile(x, y));
  }

  /**
   * Somewhere in range worth putting a tree, kept clear of its neighbours and
   * as near the planter as the ground allows. A worker that walks half a deed
   * to put one sprout in never gets to the second.
   */
  plantingSpot(cx: number, cy: number, range: number, near: (x: number, y: number) => boolean, fromX = cx, fromY = cy): { x: number; y: number } | undefined {
    const r = Math.ceil(range);
    let best: { x: number; y: number } | undefined;
    let bestD = Infinity;
    for (let i = 0; i < 60; i++) {
      const x = Math.round(cx + (this.rand() * 2 - 1) * r);
      const y = Math.round(cy + (this.rand() * 2 - 1) * r);
      if (!near(x, y) || !this.plantableTile(x, y)) continue;
      const d = Math.hypot(x - fromX, y - fromY);
      if (d >= bestD) continue;
      let crowded = false;
      for (let dy = -1; dy <= 1 && !crowded; dy++) for (let dx = -1; dx <= 1; dx++) if (this.world.getTile(x + dx, y + dy) === TileType.Tree) crowded = true;
      if (crowded) continue;
      bestD = d;
      best = { x, y };
    }
    return best;
  }

  /** Put a sprout in the ground, as the player's own planting would. */
  plantSprout(x: number, y: number, species: string | undefined): void {
    if (!this.plantableTile(x, y)) return;
    const i = Math.max(0, TREE_DEFS.findIndex((d) => d.name === species));
    this.world.setTile(x, y, TileType.Tree, packTreeData(i, 0));
  }

  /**
   * A tile in range worth reading, for a prospector to walk out to: the
   * nearest ground a stride or more from where it is standing, so it works
   * its way across the country rather than across it and back.
   */
  unreadGround(cx: number, cy: number, range: number, near: (x: number, y: number) => boolean, fromX = cx, fromY = cy): { x: number; y: number } | undefined {
    const r = Math.ceil(range);
    let best: { x: number; y: number } | undefined;
    let bestD = Infinity;
    for (let i = 0; i < 60; i++) {
      const x = Math.round(cx + (this.rand() * 2 - 1) * r);
      const y = Math.round(cy + (this.rand() * 2 - 1) * r);
      if (!near(x, y) || !this.world.inBounds(x, y) || this.world.hasWater(x, y)) continue;
      if (!this.world.isPassable(x, y)) continue;
      const d = Math.hypot(x - fromX, y - fromY);
      if (d < PROSPECT_STRIDE || d >= bestD) continue;
      bestD = d;
      best = { x, y };
    }
    return best;
  }

  /** Read the ground around a point and light up any metal under it. */
  readGround(by: Creature, x: number, y: number, radius: number): void {
    const found: number[] = [];
    const names = new Set<string>();
    for (let ty = y - radius; ty <= y + radius; ty++) {
      for (let tx = x - radius; tx <= x + radius; tx++) {
        if (!this.world.inBounds(tx, ty)) continue;
        const ore = oreAt(this.world, tx, ty);
        if (!ore) continue;
        found.push(ty * this.world.w + tx);
        names.add(ore.name.toLowerCase());
      }
    }
    if (!found.length) return;
    this.markProspected(found);
    if (this.time - by.noRoomAt < 30) return;
    by.noRoomAt = this.time;
    this.logMsg(`${by.name} found ore: ${[...names].join(', ')}.`, 'wildermon');
  }

  /**
   * The nearest vehicle to a point with a yoke still free, within reach of
   * somebody standing there.
   */
  vehicleNear(x: number, y: number, range = 5): PlacedFurniture | undefined {
    let best: PlacedFurniture | undefined;
    let bestD = Infinity;
    this.placed.furniture.around(x, y, range, (f) => {
      const v = vehicleOf(f);
      if (!v || teamOf(f).length >= v.yokes) return;
      const [cx, cy] = furnitureCentre(f);
      const d = Math.hypot(cx - x, cy - y);
      if (d <= range && d < bestD) {
        bestD = d;
        best = f;
      }
    });
    return best;
  }

  /** The vehicle a wildermon is in the traces of. */
  vehicleOfCreature(c: Creature): PlacedFurniture | undefined {
    return c.hitchedTo === null ? undefined : this.furniture.get(c.hitchedTo);
  }

  /** Put a wildermon in a vehicle's traces. */
  hitch(c: Creature, f: PlacedFurniture): boolean {
    const v = vehicleOf(f);
    // One shut in a crate is let out before it is anything else.
    if (!v || c.mode === 'stored' || c.hitchedTo !== null || c.ridden || teamOf(f).length >= v.yokes) return false;
    f.team = [...teamOf(f), c.id];
    c.hitchedTo = f.id;
    c.carrying = null;
    c.enemy = null;
    c.state = 'idle';
    this.events.emit('world', f.x, f.y);
    this.events.emit('creature');
    return true;
  }

  /** Take a wildermon out of the traces, wherever it is standing. */
  unhitch(c: Creature): void {
    const f = this.vehicleOfCreature(c);
    c.hitchedTo = null;
    if (!f) return;
    f.team = teamOf(f).filter((id) => id !== c.id);
    if (!f.team.length && f.driven) this.leaveVehicle(f);
    this.events.emit('world', f.x, f.y);
    this.events.emit('creature');
  }

  /** Why a vehicle's whole team cannot come out of the traces, or null: more of yours than can follow you, and too few empty crates (`teamOutRefusal`). */
  teamOutRefusal(f: PlacedFurniture): string | null {
    return teamOutRefusal(this, this.team(f));
  }

  /** The whole team out of the traces, the rest of yours into crates; how many came out, and what to say of the crates. */
  teamOut(f: PlacedFurniture): { n: number; said: string } {
    const out = teamOut(this, this.team(f));
    const n = this.unhitchAll(f);
    return { n, said: crateTheRest(this, out) };
  }

  /** Everything out of the traces at once, when the driver is done with it. */
  unhitchAll(f: PlacedFurniture): number {
    const team = this.team(f);
    for (const c of team) c.hitchedTo = null;
    f.team = [];
    if (f.driven) this.leaveVehicle(f);
    this.events.emit('world', f.x, f.y);
    this.events.emit('creature');
    return team.length;
  }

  /** Get down off a vehicle, leaving it where it stands. */
  leaveVehicle(f: PlacedFurniture): void {
    f.driven = false;
    this.player.speedMul = 1;
    this.player.stop();
    this.events.emit('world', f.x, f.y);
  }

  /**
   * Keep a mount under its rider, and let the work teach it something. A
   * beast learns the hills by being taken over them, which is the same thing
   * that happens in the traces.
   */
  private carryRider(c: Creature, dt: number, moved: number): void {
    c.x = this.player.x;
    c.y = this.player.y;
    c.dirX = this.player.dirX;
    c.dirY = this.player.dirY;
    c.moving = this.player.moving;
    if (!this.player.moving) return;
    c.walkPhase += dt * 10;
    c.hunger = Math.max(0, c.hunger - dt * HAUL_HUNGER);
    // On the ground only, as the island pays it (`rpc_move`): a floor is flat.
    if (this.player.level === 0) this.workClimb(c, moved);
  }

  /**
   * What a draught beast picks up from a stretch of ground: nothing on the
   * flat, and something worth having on a slope, which is why a hill team is
   * made on hills.
   */
  workClimb(c: Creature, moved: number): void {
    if (moved <= 0) return;
    // The rise over the last half tile, as a tile's (`haulLearn`).
    const rise = 2 * (this.world.heightAt(c.x, c.y) - this.world.heightAt(c.x - this.player.dirX * 0.5, c.y - this.player.dirY * 0.5));
    this.creatures.gainSkill(this, c, HAUL_SKILL, moved * haulLearn(rise));
  }

  /**
   * Whether a vehicle could stand on a tile: solid, dry, level enough ground.
   *
   * Indoors as well, on the ground floor. This refused every tile a building
   * stands on, so a wagon could not be driven through an archway at all --
   * and one set down inside a smithy could not be driven anywhere, every way
   * out "no way there". The walls are what keep wheels out now, and only the
   * walls: `blocksVehicle` lets them through an arch, a double door or a
   * gate and nothing narrower.
   */
  vehicleGround(x: number, y: number): boolean {
    const w = this.world;
    if (!w.inBounds(x, y)) return false;
    // A slab is hard level ground with a road's worth of room on it; a cart
    // crosses one the way it crosses a bridge deck.
    if (this.foundations.size && this.slabAt(x, y)) return !this.slabAt(x, y)!.pool;
    return w.isPassable(x, y) && !w.hasWater(x, y);
  }

  /**
   * Move a hitched team, and the vehicle under the driver with it. A vehicle
   * being driven sits wherever the player does — they are on the seat — and
   * the team walks a length ahead of it, spread across the yokes.
   */
  /** Keep the hull under whoever is sitting in it. */
  private floatBoat(f: PlacedFurniture): void {
    const def = furnitureDef(f.kind);
    const x = Math.floor(this.player.x);
    const y = Math.floor(this.player.y);
    if (!this.launchSpot(f.kind, x, y)) return;
    const [sx, sy] = subtileOf(x, y, this.player.x, this.player.y);
    const [ax, ay] = furnitureAnchor(f.kind, sx - Math.floor(def.w / 2), sy - Math.floor(def.h / 2));
    if (f.x === x && f.y === y && f.sx === ax && f.sy === ay) return;
    const from = { x: f.x, y: f.y };
    f.x = x;
    f.y = y;
    f.sx = ax;
    f.sy = ay;
    this.placed.furniture.moved(f, from.x, from.y);
    this.events.emit('world', from.x, from.y);
    this.events.emit('world', f.x, f.y);
  }

  private haulVehicle(f: PlacedFurniture, dt: number, moved: number): void {
    const team = this.team(f);
    // Anything that died or was let go in the meantime leaves its yoke empty.
    if (team.length !== teamOf(f).length) f.team = team.map((c) => c.id);
    // A parked team stands where it was left; nothing moves without a driver.
    if (!f.driven) return;
    const def = furnitureDef(f.kind);
    const x = Math.floor(this.player.x);
    const y = Math.floor(this.player.y);
    // Up a storey the floor under you is what it stands on, the ground or none (`driveStorey`).
    const storey = Math.max(0, this.player.level);
    if (storey > 0 || this.vehicleGround(x, y)) {
      const [sx, sy] = subtileOf(x, y, this.player.x, this.player.y);
      const [ax, ay] = furnitureAnchor(f.kind, sx - Math.floor(def.w / 2), sy - Math.floor(def.h / 2));
      if (f.x !== x || f.y !== y || f.sx !== ax || f.sy !== ay || (f.level ?? 0) !== storey) {
        const from = { x: f.x, y: f.y };
        f.x = x;
        f.y = y;
        f.sx = ax;
        f.sy = ay;
        if (storey > 0) f.level = storey;
        else delete f.level;
        this.placed.furniture.moved(f, from.x, from.y);
        this.movedOn(from.x, from.y, f.x, f.y);
      }
    }
    // The team keeps its line whether the wheels are turning or not, so a
    // halted cart still has its animals stood in front of it rather than under.
    const [cx, cy] = furnitureCentre(f);
    const moving = this.player.moving;
    const len = Math.hypot(this.player.dirX, this.player.dirY) || 1;
    const fx = this.player.dirX / len;
    const fy = this.player.dirY / len;
    for (let i = 0; i < team.length; i++) {
      const c = team[i];
      // Abreast of one another, a pace and a half ahead of the shafts.
      const off = team.length === 1 ? 0 : (i / (team.length - 1) - 0.5) * 1.6;
      const tx = cx + fx * TRACE_LENGTH - fy * off;
      const ty = cy + fy * TRACE_LENGTH + fx * off;
      if (this.world.inBounds(Math.floor(tx), Math.floor(ty)) && this.world.isPassable(Math.floor(tx), Math.floor(ty))) {
        c.x = tx;
        c.y = ty;
      } else {
        c.x = cx;
        c.y = cy;
      }
      c.moving = moving;
      if (moving) {
        c.dirX = fx;
        c.dirY = fy;
        c.walkPhase += dt * 12;
        // Hauling teaches the hills. It costs no hunger: nothing in the traces
        // gets hungry, which is what a team was asked to be.
        // Climbing, for a kind that keeps climbing in the traces; one that learns its own skill by pulling is paid that by the island (`beast_learns` 'pull').
        if (tracesSkill(this.creatures.species(c)) === HAUL_SKILL) this.workClimb(c, moved);
      }
      c.enemy = null;
      c.state = 'idle';
    }
  }

  /** Keep a hitched cart at the player's heels, a step behind wherever they are. */
  private dragCart(f: PlacedFurniture): void {
    const def = furnitureDef(f.kind);
    const [cx, cy] = furnitureCentre(f);
    const dx = this.player.x - cx;
    const dy = this.player.y - cy;
    if (Math.hypot(dx, dy) < 0.9) return;
    const x = Math.floor(this.player.x);
    const y = Math.floor(this.player.y);
    if (!this.world.inBounds(x, y) || !this.world.isPassable(x, y) || this.world.hasWater(x, y)) return;
    const [sx, sy] = subtileOf(x, y, this.player.x, this.player.y);
    const [ax, ay] = furnitureAnchor(f.kind, sx - Math.floor(def.w / 2), sy - Math.floor(def.h / 2));
    if (f.x === x && f.y === y && f.sx === ax && f.sy === ay) return;
    const from = { x: f.x, y: f.y };
    f.x = x;
    f.y = y;
    f.sx = ax;
    f.sy = ay;
    this.placed.furniture.moved(f, from.x, from.y);
    this.movedOn(from.x, from.y, f.x, f.y);
  }

  /**
   * A vehicle moved from one tile to another (or within one): one 'world' for the step. Its new tile's is enough
   * when the old one is beside it, since a 'world' at a tile is heard for the tiles round it (the map repaints those).
   */
  private movedOn(fromX: number, fromY: number, x: number, y: number): void {
    if (Math.abs(fromX - x) > 1 || Math.abs(fromY - y) > 1) this.events.emit('world', fromX, fromY);
    this.events.emit('world', x, y);
  }

  /** Burn down every lit fire; one that runs out goes cold. */
  private burnFires(dt: number): void {
    for (const f of this.campfires.values()) {
      if (!f.lit) continue;
      f.ash = (f.ash ?? 0) + Math.min(f.fuel, dt) * ASH_RATE;
      f.fuel -= dt;
      if (f.fuel > 0) continue;
      f.fuel = 0;
      f.lit = false;
      this.logMsg('Campfire burnt out.', 'event');
      this.events.emit('world', f.x, f.y);
      this.events.emit('crate');
    }
    /*
     * And the braziers, which light themselves.
     *
     * A brazier exists to be a light, so leaving it burning through the
     * afternoon is fuel spent on nothing and asking somebody to walk round
     * their deed twice a day is a chore rather than a feature. One with fuel
     * in it takes at dusk and is raked out at dawn.
     *
     * Only braziers. An oven burns while somebody is baking and stops when
     * they stop, and an oven that lit itself every night would be an oven
     * nobody could keep fuel in.
     */
    const night = this.isNight();
    for (const f of this.furniture.values()) {
      if (f.kind !== 'brazier') continue;
      if (f.lit) {
        f.fuel = Math.max(0, (f.fuel ?? 0) - dt * brazierBurn(f.ql ?? 20));
        if (f.fuel <= 0) {
          f.lit = false;
          this.logMsg('Brazier burnt out.', 'event');
          this.events.emit('world', f.x, f.y);
        } else if (!night) {
          f.lit = false;
          this.events.emit('world', f.x, f.y);
        }
      } else if (night && (f.fuel ?? 0) > 0) {
        f.lit = true;
        this.events.emit('world', f.x, f.y);
      }
    }
  }

  /**
   * Bring the tiles around a corner in line with the soil left on it: strip
   * the last dirt from all four corners of a tile and its bedrock shows.
   *
   * Except under a poured slab. Its top is packed ground, or whatever it was
   * paved with, over corners that were bare rock before it was set out, so the
   * rule would turn it into rock the first time a corner it shares was dug or
   * mined, and nothing could be built or paved on it after. The island leaves
   * it alone the same way (`reconcile`).
   */
  exposeRock(cx: number, cy: number): void {
    for (let y = cy - 1; y <= cy; y++) for (let x = cx - 1; x <= cx; x++) if (!this.slabAt(x, y)) this.world.reconcile(x, y);
  }

  /**
   * Everything the island has on the ground here, in one word.
   *
   * The browser never asked. `placed` has been there since the island was
   * built and nothing under `src/` ever read it, so on a live island every
   * campfire, smelter, kiln, anvil, work post, trap and stick of furniture
   * anybody had ever set down was in Postgres and invisible — and so was every
   * crate, and so was the settlement. "Placed campfire doesn't show": it was
   * there, and nothing had ever been told to look.
   *
   * Replaces rather than merges, like the wildlife: what is not in the answer
   * is out of the range we asked about or gone, and either way it is not here.
   * Ids are the island's, which is what makes replacing safe — the same fire
   * comes back as the same fire.
   */
  sawGround(ground: IslandGround, aged: Aged = UNLIT, me: string | null = null): void {
    // What we were in before this read, for the moment the island says we are not in it any more.
    const wasAboard = this.player.aboard;
    const steered = this.driving();
    const steeredHull = steered && isBoat(steered) ? steered.id : null;
    /*
     * What is lying on the ground, which until now the island never said.
     *
     * Reported as "killed a roxxa, no corpse dropped to butcher, or at least
     * isn't displaying". The corpse was there: the island drops one where
     * the thing fell, and the suite has measured it since kills were ported.
     * Nothing carried it: `rpc_ground` sent the fires, the crates, the crops
     * and the walls and never a thing lying on the grass, and this map was
     * only ever written by the browser's own rules, which do not run on an
     * island. So a corpse, a log a worker put down, a hatchet somebody else
     * dropped — all in Postgres and drawn by nobody.
     *
     * Replaced outright, like the rest of the fast half: what is not in the
     * answer has been picked up, has rotted, or is out of range. Ids are the
     * island's, so a pile clicked is the row the island will be asked about.
     */
    const built = this.readBuilt;
    // Whether this read changed anything a window shows, which is all the 'crate' and 'smelter' below are for.
    let news = false;
    for (const [rows, piles] of [[ground.lying, this.ground], [ground.cellarLying, this.cellarGround]] as const) {
      if (!rows) continue;
      const next = built.piles;
      for (const row of rows) {
        if (row.gx === null || row.gy === null) continue;
        const key = tileKey(row.gx, row.gy);
        const pile = next.get(key) ?? [];
        pile.push(packed(row, aged));
        next.set(key, pile);
      }
      if (next.size !== piles.size) news = true;
      else for (const [key, pile] of next) if (!same(piles.get(key), pile)) { news = true; break; }
      piles.clear();
      for (const [key, pile] of next) piles.set(key, pile);
      next.clear();
    }
    this.counters.clear();
    const counterRows: unknown[] = [];
    for (const r of ground.placed ?? []) {
      /*
       * `mine` rides along with everything set down.
       *
       * The island has always said whose each thing is and the browser threw
       * it away here, which is how "launch a boat" and "raise an altar" came
       * to be ticked off in one person's journal by another person's work.
       * Absent means the single-player game, where everything is yours because
       * there is only you.
       */
      const at = { id: r.id, x: r.x, y: r.y, sx: r.sx, sy: r.sy, mine: r.mine };
      // An enchantment set into it where it stands, and the wear a scroll that did not take left on it (`enchanting.ts`).
      const kept = { ...(r.enchant ? { enchant: r.enchant } : {}), ...(r.dmg ? { dmg: r.dmg } : {}) };
      // Down in a cellar: only furniture goes down there, and says so.
      // Down in a cellar, or a storey up: a wagon driven up a wide staircase (`driveStorey`).
      const down = (r.level ?? 0) < 0 ? { level: CELLAR_LEVEL } : (r.level ?? 0) > 0 ? { level: r.level as number } : {};
      if (r.kind === 'campfire' || r.kind === 'fire') {
        built.campfires.set(r.id, { ...at, fuel: r.fuel ?? 0, lit: !!r.lit, ash: r.ash ?? 0 });
      } else if (r.kind === 'smelter') {
        built.smelters.set(r.id, {
          ...at, ...kept, ql: r.ql ?? 20, rare: rarityStep(r.rare), fuel: r.fuel ?? 0, lit: !!r.lit, ash: r.ash ?? 0,
          jobs: furnaceJobs(r.state?.jobs),
          output: furnaceOutput(r.id, r.state?.output),
        });
      } else if (r.kind === 'kiln') {
        built.kilns.set(r.id, {
          ...at, ...kept, ql: r.ql ?? 20, rare: rarityStep(r.rare), fuel: r.fuel ?? 0, lit: !!r.lit, ash: r.ash ?? 0,
          jobs: furnaceJobs(r.state?.jobs),
          output: furnaceOutput(r.id, r.state?.output),
        });
      } else if (r.kind === 'anvil') {
        // An anvil's metal rides in `sub` — the island's `perform_forge` puts
        // what the anvil was poured from there, and its `anvil_name` and
        // `anvil_ql` read it back from there; `material` is never written for
        // one. Reported as "made a copper anvil and placed down an iron anvil":
        // this read `material`, found nothing, and called every anvil iron.
        built.anvils.set(r.id, { ...at, ...kept, ql: r.ql ?? 20, metal: r.sub ?? 'copper', rare: rarityStep(r.rare) });
      } else if (r.kind === 'post') {
        const p: PlacedPost = { ...at, ql: r.ql ?? 20, dmg: r.dmg ?? 0, worker: null, name: r.name ?? undefined, material: r.material ?? undefined };
        built.posts.set(r.id, p);
      } else if (r.kind === 'trap') {
        const t: PlacedTrap = {
          ...at, kind: (r.sub ?? 'deadfall') as PlacedTrap['kind'], ql: r.ql ?? 20, dmg: r.dmg ?? 0,
          bait: r.bait ? { uid: -r.id, id: r.bait, ql: r.bait_ql ?? 1, dmg: 0, count: 1 } : null,
          caught: r.caught ?? null, checkAt: this.time, name: r.name ?? undefined,
          material: r.material ?? undefined,
          ...(r.enchant ? { enchant: r.enchant } : {}),
        };
        built.traps.set(r.id, t);
      } else if (r.kind === 'counter') {
        // What is set out on a shop counter, and for whom (`counters.ts`).
        this.counters.saw(r as unknown as CounterWire);
        counterRows.push(r);
      } else if (r.kind === 'furniture') {
        built.furniture.set(r.id, {
          ...at, ...kept, ...down, kind: r.sub ?? 'chest', ql: r.ql ?? 20,
          // What the island says is in it, and empty for one too far off to
          // reach into, which is the only reason this is ever short.
          items: (r.things ?? []).map(storedThing),
          name: r.name ?? undefined,
          // The wood it was built of and the rarity it was made with, both of
          // which the island used to drop on the floor at the moment a piece
          // was set down. A chest of oak is a chest of oak standing up.
          material: r.material ?? undefined,
          rare: rarityStep(r.rare),
          // And its maker's mark, which is how much more it holds or how much faster it goes.
          mark: r.mark ?? undefined,
          // Its colour, and for an arch the moment its roses were planted, which the island keeps for everybody.
          dye: r.dye ?? undefined,
          setAt: r.set ?? undefined,
          // When the moss on a statue began, on this machine's clock (`greening.ts`).
          greenSince: sinceAgo(r.green_ago),
          fuel: r.fuel ?? undefined, lit: r.lit ?? undefined, ash: r.ash ?? undefined,
          litres: r.litres ?? undefined, liquid: (r.liquid ?? undefined) as PlacedFurniture['liquid'],
          ferment: r.ferment ?? undefined,
          // When a wine in it stops working, and a trellis's vine (`ageing.ts`, `vineyard.ts`).
          agedFrom: r.aged_from ?? undefined,
          vineAt: r.vine_at ?? undefined,
          pickedAt: r.picked_at ?? undefined,
          facing: (r.facing ?? 's') as Side,
          lock: r.lock ?? undefined,
          // The settlement it is a store of, when it is marked one (`stores.ts`).
          ...(r.store_of ? { storeOf: r.store_of } : {}),
          creature: r.creature ?? undefined,
          // The wildermon asleep in a wildermon bed (`placed.sleeper`).
          ...(r.sleeper ? { sleeper: r.sleeper } : {}),
          // A planter's last crop, which Crop Rotation reads as it reads a field's.
          ...(typeof r.state?.sown === 'string' ? { sown: r.state.sown } : {}),
          // A lantern post's lantern (`lamps.ts`).
          ...lampFrom(r.state),
          // A memorial stone's line (`memorial.ts`).
          ...(typeof r.engraving === 'string' && r.engraving ? { engraving: r.engraving } : {}),
          // When a skep was set down or last emptied, which what it has made is worked out from (`bees.ts`).
          ...(typeof r.state?.skep_at === 'number' ? { skepAt: r.state.skep_at } : {}),
          /*
           * The reins and the shafts, which the island has always sent and
           * this dropped: somebody who took the reins on an island walked
           * beside the wagon at their own pace while the island dragged it
           * after them a second behind. Only our own — a vehicle somebody
           * else is driving is the island's to move, and this side moves a
           * driven one to the body at this screen.
           */
          ...(me !== null && r.driver === me ? { driven: true, driverId: this.local.id } : {}),
          ...(me !== null && r.puller === me ? { hitched: true } : {}),
          /*
           * And somebody else's hands on the helm or the reins, while they are
           * here to hold them, and who is aboard as a passenger: what the
           * menu may offer, where a passenger stands, and whether it is us.
           */
          ...(me !== null && r.driver && r.driver !== me ? (r.helm_open ? { helmAway: r.driver } : { helm: r.driver }) : {}),
          ...(Array.isArray(r.riders) && r.riders.length ? { riders: r.riders.map((x) => ({ who: x.uid, seat: x.seat })) } : {}),
          /*
           * A grave: whose it is, for what anybody else is told, and how long
           * it has, counted from now on this machine's clock rather than the
           * island's. What is in it came with `things` above, and only to the
           * one who may take it.
           */
          ...(r.grave ? {
            grave: { name: r.grave.name ?? 'Somebody', crumbles: Date.now() / 1000 + r.grave.left, units: r.grave.units ?? undefined },
          } : {}),
        });
      }
    }
    // Laid over what is held, by id: what the island names again keeps the object it had (`heldrows.ts`).
    const laid = {
      campfires: layOver(this.campfires, built.campfires), smelters: layOver(this.smelters, built.smelters),
      kilns: layOver(this.kilns, built.kilns), furniture: layOver(this.furniture, built.furniture),
      anvils: layOver(this.anvils, built.anvils), posts: layOver(this.posts, built.posts), traps: layOver(this.traps, built.traps),
    };
    if (!same(counterRows, built.counters)) news = true;
    built.counters = counterRows;
    /*
     * Whether we are aboard something as a passenger, which is the island's to
     * say: it moves us with her and keeps our place, and the list of who is
     * aboard is where it says so.
     */
    if (me !== null) {
      let mine: { id: number; seat: number } | null = null;
      for (const f of this.furniture.values()) for (const r of f.riders ?? []) if (r.who === me) mine = { id: f.id, seat: r.seat };
      this.player.aboard = mine?.id ?? null;
      this.player.seat = mine?.seat ?? 0;
      /*
       * Stepped ashore, from a place on deck or from the helm: the island has
       * put the body on the nearest dry ground to her, and this side has only
       * just heard. The shore is found by the same rule from the same tile, so
       * the body goes where the island put it rather than being left in the
       * water beside her until it swims. Not when what happened is that we
       * have the helm now, and not when the body is on dry ground already.
       */
      const left = wasAboard !== null && !mine ? wasAboard : steeredHull !== null && !this.driving() && !mine ? steeredHull : null;
      const hull = left !== null ? this.furniture.get(left) : undefined;
      if (hull && !hull.driven && this.world.hasWater(this.player.tileX, this.player.tileY)) {
        const shore = shoreNear(this, 2, furnitureCentre(hull));
        if (shore) this.putBody(shore.x + 0.5, shore.y + 0.5, 0);
      }
    }
    /*
     * What is standing on the ground, which until now the island never said.
     * Replaced outright rather than merged, because a wall somebody else took
     * down has to be able to come down here too.
     */
    if (ground.buildings) {
      // When the ivy on each began, on this machine's clock rather than the island's (`greening.ts`).
      for (const w of ground.buildings.walls ?? []) {
        /*
         * Worked out from seconds ago, it moves by however long each read took
         * to come: within `SAME_SINCE` of what this wall had, it is that, or
         * every wall looked changed on every read and was drawn afresh.
         */
        const since = sinceAgo(w.greenAgo);
        const had = this.buildings.wallOnBorder(w.level, w)?.greenSince;
        w.greenSince = since !== undefined && had !== undefined && Math.abs(since - had) < SAME_SINCE ? had : since;
        delete w.greenAgo;
      }
      this.buildings.sawIsland(ground.buildings);
    }
    /*
     * And the slabs, replaced outright for the same reason the walls are: one
     * somebody struck has to be able to come away here too. Shuttering that
     * has been poured while we were looking elsewhere arrives poured.
     */
    if (ground.foundations) {
      this.foundations.clear();
      this.slabIndex.clear();
      for (const f of ground.foundations) {
        f.greenSince = sinceAgo(f.greenAgo);
        delete f.greenAgo;
        this.foundations.set(f.id, f);
        this.slabIndex.set(`${f.x},${f.y}`, f.id);
      }
      if (ground.nextFoundationId) this.nextFoundationId = ground.nextFoundationId;
      // A pool dug in one is water: laid again with whatever the island says of them.
      this.springs.lay();
    }
    /*
     * And the bridges, replaced outright like the slabs: one somebody pulled
     * down has to come away here too. Until now nothing carried them, so on an
     * island a bridge was neither drawn nor walked by anybody.
     */
    if (ground.bridges) {
      this.bridges.clear();
      for (const b of ground.bridges) {
        b.greenSince = sinceAgo(b.greenAgo);
        delete b.greenAgo;
        this.bridges.set(b.id, b);
      }
      this.reindexDecks();
    }
    /*
     * And the paving: when greening came in, and when each tile paved since
     * was paved or last scrubbed. Replaced outright, since a tile lifted or
     * laid again elsewhere has to be able to change here.
     */
    if (ground.greenFromAgo !== undefined && Number.isFinite(ground.greenFromAgo)) this.greenFrom = Date.now() / 1000 - ground.greenFromAgo;
    if (ground.paving) {
      this.pavingSince.clear();
      for (const p of ground.paving) {
        const since = sinceAgo(p.ago);
        if (since !== undefined) this.pavingSince.set(`${p.x},${p.y}`, since);
      }
    }
    for (const c of ground.crates ?? []) {
      built.crates.set(c.id, {
        id: c.id, x: c.x, y: c.y, sx: c.sx, sy: c.sy,
        kind: c.kind as PlacedCrate['kind'],
        // What the island says is in it. Empty for a crate too far off to
        // reach into, which is why `units` rides along beside it.
        items: (c.things ?? []).map(storedThing),
        units: c.units,
        name: c.name ?? undefined, deed: c.deed ?? undefined, material: c.material ?? undefined,
        rare: rarityStep(c.rare), ql: c.ql ?? 20,
        ...(c.enchant ? { enchant: c.enchant } : {}), ...(c.dmg ? { dmg: c.dmg } : {}),
        /*
         * The padlock and whose it is, which the island has always sent and
         * this dropped. A craft reaches only into a store that is yours and
         * opens for you, and the crafting window counts what is in one by the
         * same two questions the island asks.
         */
        lock: c.lock ?? undefined, mine: c.mine,
        // The settlement it is a store of, when it is marked one (`stores.ts`).
        ...(c.store_of ? { storeOf: c.store_of } : {}),
        ...((c.level ?? 0) < 0 ? { level: CELLAR_LEVEL } : {}),
      });
    }
    /*
     * Your settlement, which is the island's word on it and not this machine's.
     *
     * `deed` decides what may be built where and what a worker will carry, and
     * the browser's copy was whatever it founded itself — which on an island is
     * nothing, ever. It is yours or it is nothing: other people's come in
     * beside it and are drawn, and light nothing.
     */
    /*
     * The settlements, which only arrive with the slow half.
     *
     * `buildings` has always been applied only when it was sent; these two
     * were not, so the fast ground read — everything burning, once a second —
     * would have wiped your own settlement and your neighbours' off the map
     * between reconciles. `undefined` is "nothing said about this"; `null` is
     * still "you have no settlement", which is what a disband sends.
     */
    // `null` from the island means you are nothing on it, which here is the
    // same as saying nothing: a deed you do not belong to is not in `myDeeds`.
    if (ground.deeds !== undefined) this.neighbourDeeds = ground.deeds.map((d) => ({ ...d, role: d.role ?? undefined, rank: d.rank ?? undefined, perms: d.perms ?? undefined, baubles: baublesFrom(d.baubles) }));
    if (ground.folk !== undefined) this.folkAshore = ground.folk;
    // Your graves wherever they are, on the slow half, for the marks on your map.
    if (ground.graves !== undefined) this.markGraves(ground.graves);
    if (ground.deed !== undefined) {
      const d = ground.deed;
      const was = this.deed;
      this.deed = d ? { name: d.name, x: d.x, y: d.y, radius: d.radius, level: d.level, mine: d.mine, role: d.role ?? undefined, rank: d.rank ?? undefined, perms: d.perms ?? undefined, baubles: baublesFrom(d.baubles) } : null;
      // Only when it is actually different: this runs every few seconds, and a
      // settlement that has not moved is not news to anybody.
      if ((was?.name ?? null) !== (d?.name ?? null) || was?.x !== d?.x || was?.y !== d?.y
          || was?.radius !== d?.radius || was?.level !== d?.level) {
        if (d) this.events.emit('world', d.x, d.y);
        else if (was) this.events.emit('world', was.x, was.y);
      }
    }
    /*
     * And what is growing, which was the last thing on the ground nobody had
     * been told to look for.
     *
     * `placed` and `crates` were found and wired up when this read was built —
     * the note at the top of this function is about exactly that — and `crop`
     * sat in Postgres beside them and was missed. The whole of farming on an
     * island is that miss: sowing wrote a row nothing ever read, so the field
     * stayed bare, no stage was ever drawn, and `cropAt` answering nothing
     * meant Sow went on being offered while Tend and Harvest never were.
     *
     * The stage is the island's. `growCrops` still moves one along between
     * reads so a field looks alive rather than stepping every twenty seconds,
     * and this puts it right each time — the same arrangement the wildlife's
     * legs are drawn under.
     *
     * Applied only when it was *sent*, which is the whole of why the clear is
     * in here rather than at the top with the crates. Crops ride the slow half
     * and `placed` and `crates` ride the fast one, so a bare `clear()` up there
     * emptied the map about once a second and the reconcile put it back twenty
     * seconds later: crops that showed up and flickered away. The note under
     * the settlements a few lines down says this in so many words about
     * `deeds` and `folk`, and it was written after the same mistake.
     * `undefined` is "nothing said about this"; an empty array is "nothing is
     * growing here", and they are not the same answer.
     */
    if (ground.notches !== undefined) {
      this.world.notches.clear();
      for (const n of ground.notches) this.world.setNotch(n.x, n.y, n.cuts);
    }
    if (ground.treesAgo !== undefined && Number.isFinite(ground.treesAgo)) this.treesAt = Date.now() / 1000 - ground.treesAgo;
    // The level is the island's when you are on one: taking it is an ask
    // like any other, and this is the answer coming back.
    if (ground.level !== undefined) this.level = ground.level;
    /*
     * The island's wall clock, which the year is read off: a field's clock is
     * the year's integral to the second, so this machine's being a few
     * seconds out would move a stage that crosses a season's turn.
     */
    if (ground.now !== undefined && Number.isFinite(ground.now)) this.wallSkew = ground.now - Date.now() / 1000;
    /*
     * Where each crop is, on the clock it grows on: `grown` is how far into
     * its stage it has grown, in growing seconds, which a field's winter does
     * not add to -- so it goes onto this side's reading of the same clock and
     * the stage comes due here when it comes due there. An island from before
     * the year said only `ago`, wall seconds, which was the same thing then.
     */
    const into = (c: { grown?: number; ago?: number }): number =>
      c.grown !== undefined && Number.isFinite(c.grown) ? c.grown : c.ago !== undefined && Number.isFinite(c.ago) ? c.ago : 0;
    // And what is planted in the water, on the same slow half: when it was planted and last picked, which is all of it.
    if (ground.waterPlants !== undefined) {
      this.waterPlants.clear();
      for (const w of ground.waterPlants) {
        this.waterPlants.set(tileKey(w.x, w.y), { x: w.x, y: w.y, kind: w.kind, at: w.at, picked: w.picked ?? null });
      }
    }
    if (ground.crops !== undefined) {
      this.crops.clear();
      const field = this.fieldNow();
      // A crop in a glasshouse, on the glass clock: the island says which it is on (`glass`).
      const glass = this.glassNow();
      const hand = this.handNow();
      for (const c of ground.crops) {
        this.crops.set(tileKey(c.x, c.y), {
          x: c.x, y: c.y, id: c.id, stage: c.stage,
          stageAt: (c.glass ? glass : c.hand ? hand : field) - into(c),
          tended: c.tended, tendedNow: c.tendedNow, ql: c.ql,
          ...(c.pace !== undefined && c.pace !== 1 ? { pace: c.pace } : {}),
          ...(c.glass ? { glass: true } : {}),
          // And a Season's Hand's, on its clock (`hand`).
          ...(c.hand ? { hand: true } : {}),
        });
      }
    }
    // And what grows in the planters, on theirs; on the slow half beside the fields.
    if (ground.planted !== undefined) {
      this.planted.clear();
      const box = this.planterNow();
      for (const c of ground.planted) {
        this.planted.set(c.planter, {
          x: c.x, y: c.y, id: c.id, stage: c.stage, planter: c.planter,
          stageAt: box - into(c),
          tended: c.tended, tendedNow: c.tendedNow, ql: c.ql,
          ...(c.pace !== undefined && c.pace !== 1 ? { pace: c.pace } : {}),
        });
      }
    }
    const crates = layOver(this.crates, built.crates);
    // Filed by tile again only when something is new, gone or standing elsewhere.
    if (crates.moved) this.placed.crates.reset(this.crates.values());
    if (laid.campfires.moved) this.placed.campfires.reset(this.campfires.values());
    if (laid.smelters.moved) this.placed.smelters.reset(this.smelters.values());
    if (laid.kilns.moved) this.placed.kilns.reset(this.kilns.values());
    if (laid.furniture.moved) this.placed.furniture.reset(this.furniture.values());
    if (laid.anvils.moved) this.placed.anvils.reset(this.anvils.values());
    if (laid.posts.moved) this.placed.posts.reset(this.posts.values());
    if (laid.traps.moved) this.placed.traps.reset(this.traps.values());
    this.teamsFromCreatures();
    /*
     * And told only when it said something new. Anything but the burning
     * half -- the slow half's settlements, buildings and fields -- is taken
     * to be news, as it always was.
     */
    if (crates.news || Object.values(laid).some((l) => l.news)) news = true;
    else for (const k in ground) if (!FAST_KEYS.has(k)) { news = true; break; }
    if (news) {
      this.events.emit('crate');
      this.events.emit('smelter');
    }
  }

  /**
   * Who is in which traces, on an island, read off the creatures.
   *
   * The island keeps a team on the animals (`hitched_to`) and the browser
   * keeps it on the vehicle (`team`), and on an island nothing ever wrote the
   * second from the first: every wagon read as having empty yokes whatever
   * was backed into them. Asked after either half arrives, because a ground
   * read rebuilds every vehicle from nothing and a creature read is the only
   * thing that knows who is hitched. And who works out of which work post, the
   * same way round (`creature.post`, `PlacedPost.worker`): every worked post
   * read as having nobody on it.
   */
  teamsFromCreatures(): void {
    for (const f of this.furniture.values()) if (f.team?.length) f.team = [];
    const hitched = [...this.creatures.list.values()].filter((c) => c.hitchedTo !== null).sort((a, b) => a.id - b.id);
    for (const c of hitched) {
      const f = this.furniture.get(c.hitchedTo as number);
      if (f) f.team = [...teamOf(f), c.id];
    }
    for (const p of this.posts.values()) p.worker = null;
    for (const c of this.creatures.list.values()) {
      const p = c.post !== null ? this.posts.get(c.post) : undefined;
      if (p) p.worker = c.id;
    }
  }

  /**
   * The crates the island has just said something about, and only those.
   *
   * `sawGround` clears everything set down and builds it again, because a
   * ground read is the whole of what is standing near you. This is not that:
   * it is the answer to one ask, naming the crates within arm's reach, and
   * everything it does not mention is left exactly where it was.
   */
  sawCrates(crates: IslandCrate[]): void {
    for (const c of crates) {
      this.crates.set(c.id, {
        id: c.id, x: c.x, y: c.y, sx: c.sx, sy: c.sy,
        kind: c.kind as PlacedCrate['kind'],
        items: (c.things ?? []).map(storedThing),
        units: c.units,
        name: c.name ?? undefined, deed: c.deed ?? undefined, material: c.material ?? undefined,
        rare: rarityStep(c.rare), ql: c.ql ?? 20,
        ...(c.enchant ? { enchant: c.enchant } : {}), ...(c.dmg ? { dmg: c.dmg } : {}),
        lock: c.lock ?? undefined, mine: c.mine,
        // The settlement it is a store of, when it is marked one (`stores.ts`).
        ...(c.store_of ? { storeOf: c.store_of } : {}),
        ...((c.level ?? 0) < 0 ? { level: CELLAR_LEVEL } : {}),
      });
    }
    this.placed.crates.reset(this.crates.values());
    this.events.emit('crate');
  }

  /**
   * What the island says you are carrying.
   *
   * Replaced wholesale rather than merged: over there `wounds_settle` closes
   * them, turns them bad and takes the blood out, so what arrives is the whole
   * truth about them and an empty list means they have all closed over. This
   * side draws them and lets `bodyForward` take the blood off the bar between
   * answers; it does not decide anything about them.
   */
  sawWounds(rows: unknown[]): void {
    this.player.wounds = rows as Wound[];
    this.events.emit('stats');
  }

  /**
   * Where the island says the body is, when that is not where we thought.
   *
   * There is one thing that moves a body without this side doing it: dying.
   * `player_die` fills the bars, empties the wounds and puts you back where
   * you first came ashore — and `rpc_move` has answered with the island's own
   * position since the day it was written, with nothing here ever reading the
   * answer. So being killed left a body walking about from where it fell,
   * which is exactly what was reported, and only a refresh put it right.
   *
   * The feet are stopped along with it: whatever it was walking to is hundreds
   * of tiles away now, and a body that keeps walking is a body that claims its
   * old ground again on the next call. What is in the hands and what was
   * queued behind it are the beat's to say, and the beat is asked for as this
   * lands.
   */
  putBody(x: number, y: number, level: number, resume = false): void {
    // Held to its pace on the way somewhere (`resume`): the walk goes on from where the island has it.
    const path = this.player.path;
    const goal = resume && path?.length ? path[path.length - 1] : null;
    this.player.stop();
    // The steps walked to where it was are not steps from where it is.
    this.player.turns.length = 0;
    this.player.x = x;
    this.player.y = y;
    this.player.level = level;
    this.player.visualLevel = level;
    // Put somewhere, on a deck rather than under it.
    this.underDeck = false;
    if (goal) {
      const { rule, levels, below, lift } = this.movement();
      this.player.walkTo(this.world, goal.x, goal.y, rule, levels, below, goal.level, lift);
    }
    this.events.emit('world', Math.floor(x), Math.floor(y));
    this.events.emit('stats');
  }

  /** Light up the ore a prospector just read, for a while. */
  markProspected(tiles: number[]): void {
    this.prospected = tiles.length ? { tiles: new Set(tiles), until: this.time + PROSPECT_MARK_TIME } : null;
  }

  /**
   * The ore a prospector read, as the island has it.
   *
   * Seconds left rather than an instant, for the same reason the action bar
   * takes seconds: the island subtracts its own two clocks and this one does
   * not have to agree with them about what time it is.
   */
  showProspected(tiles: number[], secs: number): void {
    this.prospected = tiles.length && secs > 0
      ? { tiles: new Set(tiles), until: this.time + secs }
      : null;
  }

  /**
   * What the island says is lined up behind the job in hand.
   *
   * The queue lives on the island — `act_queue` on the player row — so the
   * browser's own list was empty for ever and the bar never said what was
   * next. Only the labels are wanted here: a queued job is a thing to read,
   * and the island is the one that will do it.
   */
  showQueue(lined: Array<{ action: string; goes: number }>, cap: number | null): void {
    this.remoteCap = cap;
    const q = this.queue;
    q.length = 0;
    for (const { action, goes } of lined) {
      const def = ACTION_BY_ID.get(action);
      // The count comes with it now. It used to be thrown away on the island
      // side, so the line under the bar named the job three times and could
      // not say that one of them was for ten goes.
      if (def) q.push({ def, target: { kind: 'self' } as unknown as Target, goes });
    }
    this.events.emit('action');
  }

  /** How many jobs the island says fit in this head, when the island is counting. */
  private remoteCap: number | null = null;

  /** Whether a tile is currently marked by prospecting. */
  isProspected(x: number, y: number): boolean {
    const p = this.prospected;
    if (!p || this.time >= p.until) return false;
    return p.tiles.has(y * this.world.w + x);
  }

  addSmelter(x: number, y: number, sx: number, sy: number, ql: number): PlacedSmelter {
    const [ax, ay] = smelterAnchor(sx, sy);
    const s: PlacedSmelter = { id: this.nextSmelterId++, x, y, sx: ax, sy: ay, ql, fuel: 0, lit: false, jobs: [], output: [] };
    this.smelters.set(s.id, s);
    this.placed.smelters.add(s);
    this.events.emit('smelter');
    return s;
  }

  removeSmelter(id: number): void {
    const s = this.smelters.get(id);
    if (s) this.placed.smelters.remove(s);
    this.smelters.delete(id);
    this.events.emit('smelter');
  }

  smeltersOnTile(x: number, y: number): readonly PlacedSmelter[] {
    return this.placed.smelters.at(x, y);
  }

  /** Why a smelter cannot stand on this block of subtiles, or null. */
  smelterPlaceReason(x: number, y: number, sx: number, sy: number): string | null {
    const [ax, ay] = smelterAnchor(sx, sy);
    const deck = this.deckFooting(x, y);
    if (deck === false || (deck === null && (!this.world.isPassable(x, y) || this.world.hasWater(x, y)))) return 'Smelter needs dry, solid ground.';
    const steepest = 12;
    if (deck === null && this.world.slope(x, y) > steepest) return `Too uneven: slope over ${metres(steepest)} m.`;
    if (this.isToken(x, y)) return 'Not on the totem.';
    for (let dy = 0; dy < SMELTER_H; dy++) {
      for (let dx = 0; dx < SMELTER_W; dx++) {
        if (this.occupiedSubtile(x, y, ax + dx, ay + dy)) return 'Something is already standing there.';
      }
    }
    // Nor in the corner a column stands in (`columnInBlock`).
    if (this.columnInBlock(x, y, ax, ay, SMELTER_W, SMELTER_H)) return 'Something is already standing there.';
    return null;
  }

  addKiln(x: number, y: number, sx: number, sy: number, ql: number): PlacedKiln {
    const [ax, ay] = kilnAnchor(sx, sy);
    const k: PlacedKiln = { id: this.nextKilnId++, x, y, sx: ax, sy: ay, ql, fuel: 0, lit: false, jobs: [], output: [] };
    this.kilns.set(k.id, k);
    this.placed.kilns.add(k);
    this.events.emit('smelter');
    return k;
  }

  removeKiln(id: number): void {
    const k = this.kilns.get(id);
    if (k) this.placed.kilns.remove(k);
    this.kilns.delete(id);
    this.events.emit('smelter');
  }

  kilnsOnTile(x: number, y: number): readonly PlacedKiln[] {
    return this.placed.kilns.at(x, y);
  }

  /** Why a kiln cannot stand on this block of subtiles, or null. */
  kilnPlaceReason(x: number, y: number, sx: number, sy: number): string | null {
    const [ax, ay] = kilnAnchor(sx, sy);
    const deck = this.deckFooting(x, y);
    if (deck === false || (deck === null && (!this.world.isPassable(x, y) || this.world.hasWater(x, y)))) return 'Kiln needs dry, solid ground.';
    const steepest = 14;
    if (deck === null && this.world.slope(x, y) > steepest) return `Too uneven: slope over ${metres(steepest)} m.`;
    if (this.isToken(x, y)) return 'Not on the totem.';
    for (let dy = 0; dy < KILN_SUBTILES; dy++) {
      for (let dx = 0; dx < KILN_SUBTILES; dx++) {
        if (this.occupiedSubtile(x, y, ax + dx, ay + dy)) return 'Something is already standing there.';
      }
    }
    // Nor in the corner a column stands in (`columnInBlock`).
    if (this.columnInBlock(x, y, ax, ay, KILN_SUBTILES, KILN_SUBTILES)) return 'Something is already standing there.';
    return null;
  }

  addFurniture(kind: string, x: number, y: number, sx: number, sy: number, ql: number, items: Item[] = [], material?: string, facing: Side = 's', level = 0): PlacedFurniture {
    const [ax, ay] = furnitureAnchor(kind, sx, sy, facing);
    const f: PlacedFurniture = { id: this.nextFurnitureId++, x, y, sx: ax, sy: ay, kind, ql, items, material, facing };
    // Set down in a cellar, it is down there: see `cellar.ts`.
    if (level < 0) f.level = CELLAR_LEVEL;
    // A statue set down is bare stone: the moss starts from here (`greening.ts`).
    if (mossyPiece(f)) f.greenSince = greenNow();
    this.furniture.set(f.id, f);
    this.placed.furniture.add(f);
    // A fountain set down where an aqueduct pours keeps its water from now (`./aqueducts`).
    if (kind === 'fountain') this.springs.channelChanged({ from: [x, y], to: [x, y] });
    this.events.emit('crate');
    return f;
  }

  removeFurniture(id: number): void {
    const f = this.furniture.get(id);
    if (f) this.placed.furniture.remove(f);
    this.furniture.delete(id);
    // A planter goes with whatever was in it, though nothing lifts one that has anything in it.
    this.planted.delete(id);
    // And a fountain an aqueduct poured into leaves its water to run away downhill.
    if (f?.kind === 'fountain') this.springs.channelChanged({ from: [f.x, f.y], to: [f.x, f.y] });
    this.events.emit('crate');
  }

  furnitureOnTile(x: number, y: number): readonly PlacedFurniture[] {
    return this.placed.furniture.at(x, y);
  }

  /**
   * Why a piece of furniture cannot stand on this block of subtiles, or null.
   * `level` is the storey it goes on: where you are standing, for a piece
   * being set down, and where it stands, for one being turned.
   */
  furniturePlaceReason(kind: string, x: number, y: number, sx: number, sy: number, facing: Side = 's', except?: number,
    level = floorOf(this.player.level)): string | null {
    const def = furnitureDef(kind);
    const [fw, fh] = furnitureFootprint(kind, facing);
    const [ax, ay] = furnitureAnchor(kind, sx, sy, facing);
    /*
     * Down in a cellar: on the floor of the cellar you are in, and only what
     * may go down there (`cellarPieceReason`). The floor is dug level and
     * dry, so none of the ground's questions are asked of it.
     */
    if (level < 0) {
      if (!this.buildings.sameCellar(this.myCellar(), x, y)) return CELLAR_FLOOR;
      const why = cellarPieceOk(kind);
      if (why) return why;
      for (let dy = 0; dy < fh; dy++) {
        for (let dx = 0; dx < fw; dx++) {
          if (this.occupiedSubtile(x, y, ax + dx, ay + dy, except, level)) return 'Something is already standing there.';
        }
      }
      return null;
    }
    if (def.boat) {
      // A hull goes in the water and nowhere else, and you have to be able to
      // reach the water you are putting it in.
      if (!this.launchSpot(kind, x, y)) return `Needs water ${metres(def.boat.draught)} m deep.`;
      if (Math.hypot(x + 0.5 - this.player.x, y + 0.5 - this.player.y) > 4) return 'Too far: within 4 tiles.';
      for (let dy = 0; dy < fh; dy++) for (let dx = 0; dx < fw; dx++) if (this.occupiedSubtile(x, y, ax + dx, ay + dy, except)) return 'Something already in the water there.';
      return null;
    }
    // On a bridge's deck, a wide material bridge's outer lanes; under it anywhere else, high enough over the ground (`deckFurnitureRefusal`).
    const over = this.bridges.size ? this.bridgeAt(x, y) : undefined;
    const bridged = !!over && over.kind !== 'aqueduct';
    if (over && bridged) {
      const why = deckFurnitureRefusal(over, x, y, deckHeight(over, x + 0.5, y + 0.5) - this.surfaceHeight(x, y));
      if (why) return why;
    }
    // On the deck, the deck is the footing; under it, the ground.
    const deck = bridged && deckLane(over, x, y) ? true : this.deckFooting(x, y);
    if (deck === false || (deck === null && (!this.world.isPassable(x, y) || this.world.hasWater(x, y)))) return 'Furniture needs dry, solid ground.';
    const steepest = 16;
    if (deck === null && this.world.slope(x, y) > steepest) return `Too uneven: slope over ${metres(steepest)} m.`;
    if (this.isToken(x, y)) return 'Not on the totem.';
    // An altar goes down on a settlement of yours, and on one that has none yet; one already standing may still be turned where it is.
    if (def.deed && except === undefined && !this.onDeed(x, y)) return DEED_PLACE;
    if (def.altar && except === undefined && this.altarOfDeedAt(x, y)) return ONE_ALTAR;
    // A trellis against the outside of a wall, from the ground: the storey of whoever sets it down, or of the one turned (`vineyard.ts`).
    if (def.vine) {
      const why = trellisWallRefusal(this, x, y, facing, except === undefined ? this.player.level : (this.furniture.get(except)?.level ?? 0));
      if (why) return why;
    }
    // A trellis shares the corner spot of its row with one at right angles to it (`trellisShares`).
    const shares = def.vine ? (f: PlacedFurniture): boolean => trellisShares(kind, facing, f) : undefined;
    for (let dy = 0; dy < fh; dy++) {
      for (let dx = 0; dx < fw; dx++) {
        if (this.occupiedSubtile(x, y, ax + dx, ay + dy, except, 0, shares)) return 'Something is already standing there.';
      }
    }
    // Nor in the corner a column stands in (`columnInBlock`).
    if (this.columnInBlock(x, y, ax, ay, fw, fh)) return 'Something is already standing there.';
    // And a lantern post's arm not into a wall (`lamps.ts`).
    return lampArmRefusal(this, kind, x, y, ax, ay, facing);
  }

  /**
   * Which way a piece faces after a quarter turn to the right: on round past a
   * facing a lantern post's arm would go into a wall (`lampTurnsTo`), and a
   * trellis on round to the next side it may stand against (`trellisTurnsTo`;
   * where there is none it is refused before it is turned).
   */
  pieceTurnsTo(f: PlacedFurniture): Side {
    if (furnitureDef(f.kind).vine) return trellisTurnsTo(this, f) ?? facingOf(f);
    return lampTurnsTo(this, f);
  }

  /** Why a trellis will not turn, or null: no other side of its tile has a wall it stands against (`VINE_SAID.turn`). */
  trellisTurnRefusal(f: PlacedFurniture): string | null {
    return furnitureDef(f.kind).vine && !trellisTurnsTo(this, f) ? VINE_SAID.turn : null;
  }

  /** The piece of storage furniture closest to the player. */
  nearestStore(item?: Item, range = 3): PlacedFurniture | undefined {
    let best: PlacedFurniture | undefined;
    let bestD = Infinity;
    for (const f of this.furnitureWithin(range)) {
      if (!furnitureHolds(f)) continue;
      // A raw material bin that will not take a tool is not the nearest store for a tool.
      if (item && furnitureRefuses(f, item)) continue;
      // Nothing goes in the trash by accident: that one has to be asked for.
      if (furnitureDef(f.kind).trash) continue;
      // Nor into a store shut to you: a settlement store you may not use, or a padlock you have no key to.
      if (pieceShut(this, f)) continue;
      const [cx, cy] = furnitureCentre(f);
      const d = Math.hypot(cx - this.player.x, cy - this.player.y);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    return best;
  }

  /** Every piece of furniture on the tiles within reach of the player: on the player's own storey, and down in a cellar, in that cellar. */
  furnitureWithin(range: number): PlacedFurniture[] {
    const out: PlacedFurniture[] = [];
    const own = this.myCellar();
    this.placed.furniture.around(this.player.x, this.player.y, range,
      (f) => (own === undefined || this.buildings.sameCellar(own, f.x, f.y)) && out.push(f), this.player.level);
    return out;
  }

  /**
   * Whether a thing standing on a tile, on a storey, is on the player's own
   * side of the ground floor: up top from up top, and from down in a cellar,
   * in that same cellar -- the cellar of the building next door is the far
   * side of solid ground.
   */
  onMySide(level: number | undefined, x: number, y: number): boolean {
    if (floorOf(level) !== floorOf(this.player.level)) return false;
    return this.player.level >= 0 || this.buildings.sameCellar(this.myCellar(), Math.floor(x), Math.floor(y));
  }

  /**
   * Every place on the deed that holds things, seen the same way: crates,
   * bins, chests, larders, carts. A worker looking for somewhere to put a load
   * down, something to eat or a seed to sow asks this rather than knowing
   * about the deed crate and nothing else. A trash crate is never offered,
   * since nothing a worker carries is meant for it.
   */
  /** One crate, as a place a worker can put something down. */
  private crateStore(c: PlacedCrate): DeedStore {
    const cap = crateCapacity(c);
    return {
      x: c.x,
      y: c.y,
      centre: crateCentre(c),
      items: c.items,
      name: crateName(c),
      deed: !!c.deed,
      bin: false,
      room: (item) => crateUnits(c) + item.count <= cap,
      add: (item) => this.crateAdd(c, item),
      changed: () => this.events.emit('crate'),
    };
  }

  /** One piece of furniture, the same way; undefined for the ones that hold nothing. */
  private furnitureStore(f: PlacedFurniture): DeedStore | undefined {
    const def = furnitureDef(f.kind);
    if (!furnitureHolds(f) || def.trash) return undefined;
    return {
      x: f.x,
      y: f.y,
      centre: furnitureCentre(f),
      items: f.items,
      name: def.name,
      deed: false,
      bin: !!def.takes,
      room: (item) => !furnitureRefuses(f, item) && item.count <= furnitureRoom(f, item),
      add: (item) => this.furnitureAdd(f, item),
      changed: () => this.events.emit('crate'),
    };
  }

  deedStores(): DeedStore[] {
    // A field worker asks this for every tile it looks at, so build the list
    // once a tick. The entries hold the crates and pieces themselves, so what
    // is inside them is always current; only the set of them is cached.
    const stamp = this.crates.size * 1000 + this.furniture.size;
    if (this.storeCache && this.storeCache.at === this.time && this.storeCache.stamp === stamp) return this.storeCache.stores;
    const out: DeedStore[] = [];
    for (const c of this.crates.values()) if (this.onDeed(c.x, c.y)) out.push(this.crateStore(c));
    for (const f of this.furniture.values()) {
      if (!this.onDeed(f.x, f.y)) continue;
      const store = this.furnitureStore(f);
      if (store) out.push(store);
    }
    this.storeCache = { at: this.time, stamp, stores: out };
    return out;
  }

  /**
   * Anything within reach of a worker's post that will hold what it is
   * carrying. Put a crate beside the post and a logging camp keeps itself;
   * leave the post bare and the loads go all the way home.
   */
  postStores(c: Creature): DeedStore[] {
    const p = this.postOf(c);
    if (!p) return [];
    const [cx, cy] = postCentre(p);
    const reach = postRadius(p.ql);
    const out: DeedStore[] = [];
    this.placed.crates.around(cx, cy, reach, (crate) => out.push(this.crateStore(crate)));
    this.placed.furniture.around(cx, cy, reach, (f) => {
      const store = this.furnitureStore(f);
      if (store) out.push(store);
    });
    return out;
  }

  private storeCache: { at: number; stamp: number; stores: DeedStore[] } | null = null;

  /** Load something onto a pack beast's back; false when it will not fit. */
  pannierAdd(c: Creature, item: Item): boolean {
    const cap = Math.round((this.creatures.species(c).pannier ?? 0) * bloodMul(c, 'haul'));
    const used = c.pannier.reduce((n, it) => n + it.count, 0);
    if (!cap || used + item.count > cap) return false;
    const def = ITEM_DEFS[item.id];
    const stack = def?.stackable ? c.pannier.find((it) => it.id === item.id && it.extra === item.extra && it.piece === item.piece) : undefined;
    if (stack) {
      stack.ql = (stack.ql * stack.count + item.ql * item.count) / (stack.count + item.count);
      stack.count += item.count;
    } else c.pannier.push(item);
    this.events.emit('crate');
    return true;
  }

  /** Take something back off a pack beast. */
  pannierTake(c: Creature, uid: number): Item | null {
    const i = c.pannier.findIndex((it) => it.uid === uid);
    if (i < 0) return null;
    const [item] = c.pannier.splice(i, 1);
    this.events.emit('crate');
    return item;
  }

  /** Put something away; false when it would not fit. */
  furnitureAdd(f: PlacedFurniture, item: Item): boolean {
    if (item.count > furnitureRoom(f, item)) return false;
    const def = ITEM_DEFS[item.id];
    const stack = def?.stackable ? f.items.find((it) => it.id === item.id && it.extra === item.extra && it.piece === item.piece) : undefined;
    if (stack) {
      stack.ql = (stack.ql * stack.count + item.ql * item.count) / (stack.count + item.count);
      stack.count += item.count;
    } else f.items.push(item);
    this.events.emit('crate');
    return true;
  }

  furnitureTake(f: PlacedFurniture, uid: number): Item | null {
    const idx = f.items.findIndex((it) => it.uid === uid);
    if (idx < 0) return null;
    const [item] = f.items.splice(idx, 1);
    this.events.emit('crate');
    return item;
  }

  addAnvil(x: number, y: number, sx: number, sy: number, metal: string, ql: number): PlacedAnvil {
    const [ax, ay] = anvilAnchor(sx, sy);
    const a: PlacedAnvil = { id: this.nextAnvilId++, x, y, sx: ax, sy: ay, metal, ql };
    this.anvils.set(a.id, a);
    this.placed.anvils.add(a);
    this.events.emit('smelter');
    return a;
  }

  removeAnvil(id: number): void {
    const a = this.anvils.get(id);
    if (a) this.placed.anvils.remove(a);
    this.anvils.delete(id);
    this.events.emit('smelter');
  }

  anvilsOnTile(x: number, y: number): readonly PlacedAnvil[] {
    return this.placed.anvils.at(x, y);
  }

  anvilPlaceReason(x: number, y: number, sx: number, sy: number): string | null {
    const [ax, ay] = anvilAnchor(sx, sy);
    const deck = this.deckFooting(x, y);
    if (deck === false || (deck === null && (!this.world.isPassable(x, y) || this.world.hasWater(x, y)))) return 'Anvil needs dry, level ground.';
    const steepest = 16;
    if (deck === null && this.world.slope(x, y) > steepest) return `Too uneven: slope over ${metres(steepest)} m.`;
    if (this.isToken(x, y)) return 'Not on the totem.';
    for (let dy = 0; dy < ANVIL_SUBTILES; dy++) {
      for (let dx = 0; dx < ANVIL_SUBTILES; dx++) {
        if (this.occupiedSubtile(x, y, ax + dx, ay + dy)) return 'Something is already standing there.';
      }
    }
    return null;
  }

  /** Whether anything already stands on one subtile. */
  /**
   * The crate rack whose deck covers this subtile, when one does.
   *
   * A rack's footprint *is* its crate spots — eight subtiles, eight crates —
   * so this is the one question everything about it turns on: whether the spot
   * somebody is pointing at is a rack's deck or bare ground.
   */
  rackAt(x: number, y: number, sx: number, sy: number, level = 0): PlacedFurniture | undefined {
    for (const f of this.placed.furniture.at(x, y)) {
      if ((f.level ?? 0) < 0 === level < 0 && rackSpots(f) && furnitureCovers(f, sx, sy)) return f;
    }
    return undefined;
  }

  /**
   * The crates standing on a rack, in the order its spots fill.
   *
   * On the rack's own storey: a rack down in a cellar carries the crates down
   * there, not the ones standing on the floor over its head.
   */
  cratesOn(f: PlacedFurniture): PlacedCrate[] {
    const out: PlacedCrate[] = [];
    for (const [sx, sy] of rackDeck(f)) {
      const crate = this.crateAt(f.x, f.y, sx, sy, f.level ?? 0);
      if (crate) out.push(crate);
    }
    return out;
  }

  /**
   * What a rack is carrying, added up.
   *
   * A rack holds nothing of its own — its `items` are always empty and
   * `furnitureCapacity` is nought — so everything that reads a piece of
   * furniture to say how full it is said nothing at all about one, however
   * many crates were standing on it. Asked for: "for crate shelf show
   * inventory gross (x/x)". The gross is the crates' own figures added up,
   * which is the only honest answer: each one is its own crate, and a rack of
   * eight plank crates in oak holds more than one of eight in pine.
   */
  rackLoad(f: PlacedFurniture): { crates: number; spots: number; units: number; capacity: number } {
    const on = this.cratesOn(f);
    let units = 0;
    let capacity = 0;
    for (const c of on) {
      units += crateUnits(c);
      capacity += crateCapacity(c);
    }
    return { crates: on.length, spots: rackSpots(f), units, capacity };
  }

  /** Whether a spot is taken, leaving out one piece of furniture when it is that piece asking about its own turn. */
  /**
   * Whether anything takes up a spot of a tile. `shares`, when it is given,
   * names pieces that may stand on the same spot as the one being asked for:
   * a trellis and another at right angles to it, in the corner they share
   * (`trellisShares`).
   */
  occupiedSubtile(x: number, y: number, sx: number, sy: number, exceptFurniture?: number, level = 0, shares?: (f: PlacedFurniture) => boolean): boolean {
    // Down in a cellar only what is down there takes up room: crates and furniture, the two that go down.
    if (level < 0) {
      if (this.crateAt(x, y, sx, sy, level)) return true;
      for (const f of this.placed.furniture.at(x, y)) if ((f.level ?? 0) < 0 && f.id !== exceptFurniture && furnitureCovers(f, sx, sy)) return true;
      return false;
    }
    if (this.crateAt(x, y, sx, sy)) return true;
    if (this.campfireAt(x, y, sx, sy)) return true;
    for (const s of this.placed.smelters.at(x, y)) if (smelterCovers(s, sx, sy)) return true;
    for (const k of this.placed.kilns.at(x, y)) if (kilnCovers(k, sx, sy)) return true;
    for (const f of this.placed.furniture.at(x, y)) if ((f.level ?? 0) >= 0 && f.id !== exceptFurniture && furnitureCovers(f, sx, sy) && !shares?.(f)) return true;
    for (const a of this.placed.anvils.at(x, y)) if (anvilCovers(a, sx, sy)) return true;
    for (const p of this.placed.posts.at(x, y)) if (p.sx === sx && p.sy === sy) return true;
    return false;
  }

  /**
   * Whether a column of the ground floor stands in a corner spot of a block
   * of spots on a tile: a column takes the corner spot of every tile round
   * its corner (`frame.ts`). Asked wherever the island's `block_taken` is --
   * a piece, a smelter or a kiln set down or turned, a grave dug -- which asks
   * it as `frame_column_corner`.
   */
  columnInBlock(x: number, y: number, sx: number, sy: number, w: number, h: number): boolean {
    const bld = this.buildings;
    if (!bld.columns.size) return false;
    for (const [cx, at] of [[x, sx === 0], [x + 1, sx + w === SUBTILES]] as Array<[number, boolean]>) {
      for (const [cy, on] of [[y, sy === 0], [y + 1, sy + h === SUBTILES]] as Array<[number, boolean]>) {
        if (at && on && bld.column(0, cx, cy)) return true;
      }
    }
    return false;
  }

  /** Burn fuel in every lit smelter and move its work along. */
  private runSmelters(dt: number): void {
    for (const s of this.smelters.values()) {
      if (!s.lit) continue;
      // Seconds of heat, and the fuel they take: less of it for an Ember Heart (`furnaceBurn`).
      const per = furnaceBurn(s);
      const burn = Math.min(s.fuel / per, dt);
      s.ash = (s.ash ?? 0) + burn * per * ASH_RATE;
      s.fuel -= burn * per;
      if (s.fuel <= 0) {
        s.fuel = 0;
        s.lit = false;
        this.logMsg('Smelter out of fuel.', 'event');
        this.events.emit('smelter');
        this.events.emit('world', s.x, s.y);
      }
      const job = s.jobs[0];
      if (!job || burn <= 0) continue;
      job.left -= burn;
      if (job.left > 0) continue;
      /*
       * On an island the furnace is the island's. The count runs down here so
       * the menu reads right between two looks at the ground, but what came
       * out is the island's to say: it settles the furnace on its own clock
       * and the next look brings the lump. A browser that made the lump
       * itself made one the island had never heard of.
       */
      if (this.islandClock) { job.left = 0; continue; }
      s.jobs.shift();
      const made: Item =
        job.makes === 'anvil'
          ? { uid: this.inventory.nextUid++, id: 'anvil', ql: job.ql, dmg: 0, count: 1, extra: job.item.id.replace('_lump', '') }
          : { uid: this.inventory.nextUid++, id: job.makes, ql: job.ql, dmg: 0, count: 1, extra: job.extra, piece: job.piece };
      furnaceOut(s.output, made);
      this.logMsg(`Smelter made: ${itemName(made).toLowerCase()}, QL ${made.ql.toFixed(1)}.`, 'event');
      this.events.emit('smelter');
    }
  }

  /** Burn fuel in every lit kiln and bring its ware on. */
  private runKilns(dt: number): void {
    for (const k of this.kilns.values()) {
      if (!k.lit) continue;
      const per = furnaceBurn(k);
      const burn = Math.min(k.fuel / per, dt);
      k.ash = (k.ash ?? 0) + burn * per * ASH_RATE;
      k.fuel -= burn * per;
      if (k.fuel <= 0) {
        k.fuel = 0;
        k.lit = false;
        this.logMsg('Kiln out of fuel.', 'event');
        this.events.emit('smelter');
        this.events.emit('world', k.x, k.y);
      }
      const job = k.jobs[0];
      if (!job || burn <= 0) continue;
      job.left -= burn;
      if (job.left > 0) continue;
      // As for the smelter: on an island the ware is the island's to fire.
      if (this.islandClock) { job.left = 0; continue; }
      k.jobs.shift();
      // With its shaper's mark, which a pot, a bowl or a jar carries through the fire (an Artisan's Deep Pot and Sealed Jar).
      const made: Item = { uid: this.inventory.nextUid++, id: job.makes, ql: job.ql, dmg: 0, count: 1, ...(job.item.mark ? { mark: { ...job.item.mark } } : {}) };
      furnaceOut(k.output, made);
      this.logMsg(`Kiln fired: ${ITEM_DEFS[made.id]?.name.toLowerCase() ?? made.id}, QL ${made.ql.toFixed(1)}.`, 'event');
      this.events.emit('smelter');
    }
  }

  cropAt(x: number, y: number): Crop | undefined {
    return this.crops.get(tileKey(x, y));
  }

  /** The water lily or lotus planted on a tile, if there is one. */
  waterPlantAt(x: number, y: number): WaterPlant | undefined {
    return this.waterPlants.size ? this.waterPlants.get(tileKey(x, y)) : undefined;
  }

  /** Plant a water lily or a lotus on a tile, at a moment of the wall clock in seconds. */
  plantWater(x: number, y: number, kind: WaterPlantKind, at: number): WaterPlant {
    const p: WaterPlant = { x, y, kind, at, picked: null };
    this.waterPlants.set(tileKey(x, y), p);
    this.events.emit('world', x, y);
    return p;
  }

  /** Pull up whatever is planted on a tile. */
  pullWater(x: number, y: number): void {
    if (this.waterPlants.delete(tileKey(x, y))) this.events.emit('world', x, y);
  }

  /** The mote swirl turning over a tile, if there is one (`motes.ts`). */
  swirlAt(x: number, y: number): Swirl | undefined {
    return this.swirlTiles.size ? this.swirlTiles.get(tileKey(x, y)) : undefined;
  }

  /** These swirls and no others: a day's put down, or what the island says is in the blocks round you. */
  setSwirls(list: readonly Swirl[]): void {
    this.swirls.clear();
    this.swirlTiles.clear();
    for (const s of list) {
      this.swirls.set(s.id, s);
      this.swirlTiles.set(tileKey(s.x, s.y), s);
    }
  }

  /** A swirl collected, here or by anybody on the island: gone for good. */
  takeSwirl(id: number): void {
    const s = this.swirls.get(id);
    if (!s) return;
    this.swirls.delete(id);
    if (this.swirlTiles.get(tileKey(s.x, s.y)) === s) this.swirlTiles.delete(tileKey(s.x, s.y));
    this.events.emit('world', s.x, s.y);
  }

  /**
   * The day's swirls, in a game of your own: yesterday's gone and
   * `SWIRLS_A_DAY` new ones put down (`laySwirls`), stamped with the dawn they
   * are for. On an island the island does this, in `swirl_day`.
   */
  private laySwirlsFor(dawn: number): void {
    const first = this.swirls.size ? Math.max(...this.swirls.keys()) + 1 : 1;
    this.setSwirls(laySwirls(this, first, this.rand));
    this.swirlDawn = dawn;
  }

  plantCrop(x: number, y: number, id: string, seedQl: number, pace = 1): Crop {
    // Under glass it begins on the glass clock, and anywhere else on the field's (`glasshouse.ts`).
    const glass = underGlass(this.buildings, x, y);
    // And on a Season's Hand's clock for a sower with Love's Season's Hand (`hand_sown`).
    const hand = this.pathFx('winter', 0) > 0;
    const c: Crop = { x, y, id, stage: 0, stageAt: glass ? this.glassNow() : hand ? this.handNow() : this.fieldNow(), tended: 0, tendedNow: false, ql: seedQl };
    if (pace !== 1) c.pace = pace;
    if (glass) c.glass = true;
    if (hand) c.hand = true;
    this.crops.set(tileKey(x, y), c);
    this.sown.set(tileKey(x, y), id);
    this.events.emit('world', x, y);
    return c;
  }

  /** Sow a planter: its crop begins on the planter's clock, and the planter remembers what it was sown with. */
  sowPlanter(f: PlacedFurniture, id: string, seedQl: number, pace = 1): Crop {
    const c: Crop = { x: f.x, y: f.y, id, stage: 0, stageAt: this.planterNow(), tended: 0, tendedNow: false, ql: seedQl, planter: f.id };
    if (pace !== 1) c.pace = pace;
    this.planted.set(f.id, c);
    f.sown = id;
    this.events.emit('world', f.x, f.y);
    return c;
  }

  /** A crop gone from where it grew, harvested or turned back in: out of its field, or out of its planter. */
  uproot(c: Crop): void {
    if (c.planter !== undefined) {
      this.planted.delete(c.planter);
      this.events.emit('world', c.x, c.y);
    } else this.removeCrop(c.x, c.y);
  }

  /** The planter a piece's id names, or nothing when it names anything else. */
  planterPiece(id: number): PlacedFurniture | undefined {
    const f = this.furniture.get(id);
    return f && isPlanter(f) ? f : undefined;
  }

  /** Whether a piece is near enough to work at: its middle within `STORE_REACH` of you, as the island measures it (`placed_in_reach`). */
  besidePiece(f: PlacedFurniture): boolean {
    const [cx, cy] = furnitureCentre(f);
    return Math.hypot(cx - this.player.x, cy - this.player.y) <= STORE_REACH;
  }

  /**
   * The wall clock, in epoch seconds: what the year is read off. The island's
   * when there is one (this machine's put right by `wallSkew`), this
   * machine's otherwise, and whatever `wallClock` says when it says anything.
   */
  wallNow(): number {
    return this.wallClock ? this.wallClock() : Date.now() / 1000 + this.wallSkew;
  }

  /** The field clock now: on an island, read off the year (`fieldClock`); by yourself, the one kept in the save. */
  fieldNow(): number {
    return this.islandClock ? fieldClock(this.wallNow()) : this.fieldTime;
  }

  /** A Season's Hand's field clock now: on an island read off the year (`handClock`), by yourself the one kept in the save. */
  handNow(): number {
    return this.islandClock ? handClock(this.wallNow()) : this.handTime;
  }

  /** A planter's clock now: `PLANTER_GROWTH` of the plain one -- the wall clock on an island, the game's own by yourself. */
  planterNow(): number {
    return PLANTER_GROWTH * (this.islandClock ? this.wallNow() : this.time);
  }

  /** The glass clock now: `GLASSHOUSE_GROWTH` of the plain one -- the wall clock on an island, the game's own by yourself. */
  glassNow(): number {
    return GLASSHOUSE_GROWTH * (this.islandClock ? this.wallNow() : this.time);
  }

  /** The clock a crop grows on, read now: a planter's, a glasshouse's or a field's. */
  growNow(c: { planter?: number; glass?: boolean; hand?: boolean }): number {
    return c.planter !== undefined ? this.planterNow() : c.glass ? this.glassNow() : c.hand ? this.handNow() : this.fieldNow();
  }

  /**
   * Growing seconds one stage of a crop takes: the crop's own, at the pace it
   * was sown at, and shortened by the gardener's path for everything in the
   * ground of whoever walks it.
   */
  cropPer(c: Crop): number {
    const green = this.deed && this.onDeed(c.x, c.y) ? this.pathFx('grow', 1) : 1;
    return cropStageSeconds(c) * green;
  }

  /** The crop last sown on a field, which a Farmer's Crop Rotation asks after; none on a field never sown. */
  lastSown(x: number, y: number): string | undefined {
    return this.sown.get(tileKey(x, y));
  }

  /** A field broken up has no last crop any more. */
  forgetSown(x: number, y: number): void {
    this.sown.delete(tileKey(x, y));
  }

  removeCrop(x: number, y: number): void {
    this.crops.delete(tileKey(x, y));
    this.events.emit('world', x, y);
  }

  /**
   * Move every crop on to its next stage once its time is up, on the clock it
   * grows on: a field's, which the season sets the pace of and a winter
   * stops, and a planter's and a glasshouse's, which run the same in every
   * season.
   */
  private growCrops(): void {
    const field = this.fieldNow();
    const glass = this.glassNow();
    const hand = this.handNow();
    const box = this.planterNow();
    for (const c of this.crops.values()) {
      if (c.stage < RIPE && settleCrop(c, this.cropPer(c), c.glass ? glass : c.hand ? hand : field)) this.events.emit('world', c.x, c.y);
    }
    for (const c of this.planted.values()) {
      if (c.stage < RIPE && settleCrop(c, this.cropPer(c), box)) this.events.emit('world', c.x, c.y);
    }
  }

  /**
   * What is lying on a tile. The array is the game's own — read it, do not
   * keep it or add to it — and an empty tile hands back one shared empty
   * array rather than a fresh one, because the renderer asks this of every
   * tile it draws and nearly every answer is nothing.
   */
  groundAt(x: number, y: number, level = 0): readonly Item[] {
    return this.pilesOn(level).get(tileKey(x, y)) ?? NO_ITEMS;
  }

  /** The piles on a storey: a cellar's floor, or the ground and everything over it. */
  pilesOn(level: number): Map<number, Item[]> {
    return level < 0 ? this.cellarGround : this.ground;
  }

  dropOnGround(x: number, y: number, item: Item, level = 0): void {
    const key = tileKey(x, y);
    const piles = this.pilesOn(level);
    const pile = piles.get(key) ?? [];
    const def = ITEM_DEFS[item.id];
    // Onto a pile of the same thing, by the one rule for what shares a stack
    // (a maker's mark and a rarity are part of it), and rotting at the same pace.
    const stack = def?.stackable ? pile.find((it) => sameStack(it, item) && (it.cool ?? 1) === (item.cool ?? 1)) : undefined;
    if (stack) {
      stack.ql = (stack.ql * stack.count + item.ql * item.count) / (stack.count + item.count);
      stack.count += item.count;
    } else pile.push(item);
    piles.set(key, pile);
    this.events.emit('world', x, y);
  }

  /** Remove one item (by uid) or everything (null) from a tile. */
  /** How far a sweep of the ground reaches: the tile you are on and its neighbours. */
  static readonly SWEEP = 1;

  /** How many loose things are lying within reach of a spot, on a storey. */
  sweepable(x: number, y: number, level = 0): number {
    let n = 0;
    for (let dy = -Game.SWEEP; dy <= Game.SWEEP; dy++) {
      for (let dx = -Game.SWEEP; dx <= Game.SWEEP; dx++) if (this.sweeps(x + dx, y + dy, level)) n += this.groundAt(x + dx, y + dy, level).length;
    }
    return n;
  }

  /** Whether a sweep on a storey takes up what lies on a tile: anywhere up top, and down in a cellar, in the player's own cellar. */
  private sweeps(x: number, y: number, level: number): boolean {
    return level >= 0 || this.buildings.sameCellar(this.myCellar(), x, y);
  }

  /** Gather up everything lying within reach of a spot, nearest first, on a storey. */
  sweep(x: number, y: number, level = 0): Item[] {
    const got: Item[] = [];
    const spots: Array<[number, number]> = [];
    for (let dy = -Game.SWEEP; dy <= Game.SWEEP; dy++) {
      for (let dx = -Game.SWEEP; dx <= Game.SWEEP; dx++) if (this.sweeps(x + dx, y + dy, level)) spots.push([x + dx, y + dy]);
    }
    spots.sort((a, b) => Math.hypot(a[0] - x, a[1] - y) - Math.hypot(b[0] - x, b[1] - y));
    for (const [sx, sy] of spots) {
      for (const it of this.takeFromGround(sx, sy, null, level)) {
        this.inventory.addItem(it);
        got.push(it);
      }
    }
    return got;
  }

  takeFromGround(x: number, y: number, uid: number | null, level = 0): Item[] {
    const key = tileKey(x, y);
    const piles = this.pilesOn(level);
    const pile = piles.get(key);
    if (!pile) return [];
    let taken: Item[];
    if (uid === null) {
      taken = pile.splice(0, pile.length);
    } else {
      const idx = pile.findIndex((it) => it.uid === uid);
      taken = idx >= 0 ? pile.splice(idx, 1) : [];
    }
    // Nothing rots off the ground, so what kept a thing from rotting on it
    // (a Fisher's Cool Pack) goes when it is taken up.
    for (const it of taken) delete it.cool;
    if (!pile.length) piles.delete(key);
    this.events.emit('world', x, y);
    return taken;
  }

  /** Out to a save, which has always written the tile as `"x,y"` and still does; a cellar's floor the same way. */
  groundToJSON(level = 0): Record<string, Item[]> {
    const out: Record<string, Item[]> = {};
    for (const [k, v] of this.pilesOn(level)) out[`${keyX(k)},${keyY(k)}`] = v;
    return out;
  }

  private forageKey(x: number, y: number, kind: string): number {
    const k = Math.max(0, FORAGE_KINDS.indexOf(kind));
    return k * this.world.w * this.world.h + y * this.world.w + x;
  }

  isForaged(x: number, y: number, kind: string): boolean {
    return this.foragedLeft(x, y, kind) > 0;
  }

  /** Seconds until a spot can be worked again for a kind (`forageCooldown`), nought when it can: the island's `foraged_left`. */
  foragedLeft(x: number, y: number, kind: string): number {
    if (!FORAGE_KINDS.includes(kind)) return 0;
    const t = this.foraged.get(this.forageKey(x, y, kind));
    return t === undefined ? 0 : Math.max(0, forageCooldown(kind) - (this.time - t));
  }

  /**
   * The spots near us the island has down as picked over (`foraged`), each
   * with the seconds since, by the island's clock (`Island.refreshForaged`):
   * every one it sent, so whatever this side held that is not among them has
   * grown back or was never so.
   */
  foragedFromIsland(rows: Array<{ x: number; y: number; kind: string; ago: number }>): void {
    this.foraged.clear();
    for (const r of rows) {
      if (FORAGE_KINDS.includes(r.kind) && this.world.inBounds(r.x, r.y)) this.foraged.set(this.forageKey(r.x, r.y, r.kind), this.time - r.ago);
    }
    this.events.emit('foraged');
  }

  /** The stage nothing else grows into: the beginning of a tree. */
  private static readonly FIRST = TREE_AGES.find((a) => !TREE_AGES.some((b) => b.next === a.id))?.id ?? 0;

  /**
   * A day in the woods: every tree one stage older, the old ones gone, and up
   * to two saplings round each of them.
   *
   * A tree that dies of age leaves grass where it stood, not a stump. A stump
   * is what a hatchet leaves, and only on a tree with timber in it; every
   * stump there is, however it got there, is grass after the next turn.
   *
   * Once a day and not a moment otherwise. The first cut of this crept — a
   * slice of the map every few seconds, each tree carrying its own hour so the
   * wood would not turn over all at once — and on the island that cost a tenth
   * of a second every second to answer a question that changes once a day, and
   * showed up as a second of input delay. A day's rule does not want a second's
   * clock. What is left here is one comparison, which is free.
   *
   * The day turns at dawn (`TREE_DAWN_UTC`), the same moment on every island
   * and in every game of your own, rather than a day after the last turnover:
   * once the last dawn is past what was stamped, the woods move on, and are
   * stamped with now. A game shut for a week turns over once when it is
   * opened, and again at the next dawn.
   */
  growTrees(nowSeconds: number): void {
    if (this.ask) return; // On a live island the woods are the island's.
    const w = this.world;
    // A game that has never had its swirls has the day's now, rather than at the next dawn (`motes.ts`).
    if (this.swirlDawn === null) this.laySwirlsFor(lastDawn(nowSeconds));
    /*
     * A day's growth, a strip of the island at a time.
     *
     * The woods turn at one moment for everybody, and turning them means
     * looking at every tile there is: aging the trees, clearing the stumps
     * left since the last turn and counting the days a lawn has been kept cut. On a four
     * thousand square map that is sixteen and three quarter million tiles in
     * one go, in the middle of a frame — and it fires the moment a saved
     * world is opened, because a world that has been shut since before the
     * last dawn has a dawn owing.
     *
     * So the walk is cut into strips and carried across frames. The day still
     * turns at the one moment — `treesAt` is only moved on when the last
     * strip is done, so an interrupted pass starts again rather than leaving
     * half an island a day behind — and the dead still seed after the whole
     * island has turned, which is the rule that stops a sapling dropped into
     * ground the walk has not reached yet being aged the same day.
     */
    if (this.treeRow < 0) {
      if (this.treesAt >= lastDawn(nowSeconds)) return;
      this.treeRow = 0;
      this.treeTurn = nowSeconds;
      this.treeGone.length = 0;
      // A year begun since the last turn: every picked tile of flowers flowers again.
      this.treeNewYear = yearOf(nowSeconds) !== yearOf(this.treesAt);
    }
    const gone = this.treeGone;
    const until = Math.min(w.h, this.treeRow + TREE_STRIP);
    for (let y = this.treeRow; y < until; y++) {
      for (let x = 0; x < w.w; x++) {
        const here = w.getTile(x, y);
        // Every stump goes at the turn, however long it has stood.
        if (here === TileType.Stump) {
          w.setTile(x, y, TileType.Grass, 0);
          continue;
        }
        // Grass kept cut on a deed becomes lawn; a day without a cut starts
        // the count over. And flowers picked this year stay picked beside the
        // count, until a new year begins.
        if (here === TileType.Grass) {
          const data = w.getData(x, y);
          if (data) {
            const picked = this.treeNewYear ? 0 : data & FLOWERS_PICKED;
            if (!mownToday(data)) {
              if (data !== picked) w.setTile(x, y, TileType.Grass, picked);
            } else if (mownDays(data) + 1 >= LAWN_AFTER) w.setTile(x, y, TileType.Lawn, 0);
            else w.setTile(x, y, TileType.Grass, (mownDays(data) + 1) | picked);
          }
          continue;
        }
        if (here !== TileType.Tree) continue;
        const data = w.getData(x, y);
        const age = treeAge(data);
        if (age.next === null) {
          // A tree that dies of age leaves grass. Stumps are a hatchet's.
          w.setTile(x, y, TileType.Grass, 0);
          gone.push([x, y, treeSpecies(data)]);
        } else {
          w.setTile(x, y, TileType.Tree, packTreeData(treeSpecies(data), age.next));
        }
      }
    }
    this.treeRow = until;
    if (this.treeRow < w.h) return;
    // The whole island has turned. Only now is the day counted as turned.
    this.treeRow = -1;
    this.treesAt = this.treeTurn;
    // A year's growth closes whatever was cut into anything.
    w.notches.clear();
    // The dead seed after the whole island has turned, so a sapling dropped
    // into ground the walk had not reached yet cannot be aged the same day.
    // Nor where one of them stood: that ground took the day to clear, as it
    // did when a stump stood on it for the day, so a wood that dies together
    // comes back as thickly as it always did rather than in its own footprint.
    const cleared = new Set(gone.map(([x, y]) => y * w.w + x));
    for (const [x, y, species] of gone) this.seedTrees(x, y, species, cleared);
    gone.length = 0;
    // And the day's fall off every worn tile, after the seeding, as on the island.
    this.wearDay();
    // And the day's mote swirls in place of yesterday's, after everything that moves the ground (`swirl_day`).
    this.laySwirlsFor(lastDawn(this.treeTurn));
  }

  /** Whether the turn in progress is the first of a new year. */
  private treeNewYear = false;

  /**
   * A step on your own feet onto a tile: a point of wear on it, if it is one
   * of the grounds that wear (`WEARS`) or a trail already, up to `WEAR_MOST`;
   * and at `WEAR_TRAIL` a trail, keeping in its byte what it was. The island
   * does the same in `wear_step`, off the walk it is told about.
   *
   * A bridge deck is not the ground under it, and ground a building or a
   * foundation stands on is built ground: neither wears.
   */
  wearStep(x: number, y: number): void {
    const w = this.world;
    if (!w.inBounds(x, y)) return;
    const here = w.getTile(x, y);
    if (!wears(here)) return;
    if (this.onWalkedDeck(x, y) || this.buildings.buildingAt(x, y) || this.foundationAt(x, y)) return;
    // Kept with the game's papers rather than the land (`save.ts`), so a step
    // does not mark the whole island as wanting writing out again.
    const i = y * w.w + x;
    const had = w.wear.get(i) ?? 0;
    if (had >= WEAR_MOST) return;
    w.wear.set(i, had + 1);
    if (had + 1 >= WEAR_TRAIL && here !== TileType.Trail) {
      w.setTile(x, y, TileType.Trail, here);
      this.note('trail');
    }
  }

  /**
   * The day's fall off every worn tile, at the turn of the woods: `WEAR_FALL`
   * each, and a tile with none left is forgotten -- and if it is a trail, it
   * is the ground it was worn out of again. The island's `trail_day`.
   */
  private wearDay(): void {
    const w = this.world;
    if (!w.wear.size) return;
    for (const [i, v] of [...w.wear]) {
      if (v > WEAR_FALL) {
        w.wear.set(i, v - WEAR_FALL);
        continue;
      }
      w.wear.delete(i);
      const x = i % w.w;
      const y = (i - x) / w.w;
      if (w.getTile(x, y) === TileType.Trail) w.setTile(x, y, trailGround(w.getData(x, y)), 0);
    }
  }

  /**
   * What an old tree leaves behind it: its own kind, on ground a sprout could
   * have been planted in, and not inside anybody's settlement. A wood is
   * welcome to spread, and not over the place somebody levelled and built on.
   */
  private seedTrees(x: number, y: number, species: number, cleared: ReadonlySet<number>): void {
    const w = this.world;
    const spots: Array<[number, number]> = [];
    for (let dy = -TREE_SEED_REACH; dy <= TREE_SEED_REACH; dy++) {
      for (let dx = -TREE_SEED_REACH; dx <= TREE_SEED_REACH; dx++) {
        if (!dx && !dy) continue;
        const gx = x + dx;
        const gy = y + dy;
        if (!w.inBounds(gx, gy) || !PLANTABLE.has(w.getTile(gx, gy)) || cleared.has(gy * w.w + gx)) continue;
        if (this.deedAt(gx, gy)) continue;
        // Nor under an aqueduct's spans: it would grow up through its arches (the island's `tree_day`).
        if (this.bridges.size && this.bridgeAt(gx, gy)?.kind === 'aqueduct') continue;
        spots.push([gx, gy]);
      }
    }
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(this.rand() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    /*
     * What it wants, and what the ground will have.
     *
     * The roll averages a shade over replacement; the room is what keeps a
     * thick wood from running away, because a stump with nothing open round it
     * leaves nothing. Neither alone settles anywhere — together they do.
     */
    const roll = this.rand();
    const wants = roll < TREE_SEED_NONE ? 0 : roll < 1 - TREE_SEED_BOTH ? 1 : TREE_SEEDS;
    const room = spots.length >= TREE_ROOM_TWO ? TREE_SEEDS : spots.length >= TREE_ROOM_ONE ? 1 : 0;
    for (const [gx, gy] of spots.slice(0, Math.min(wants, room))) {
      w.setTile(gx, gy, TileType.Tree, packTreeData(species, Game.FIRST));
    }
  }

  /** Gold coins found foraging since the woods' last dawn, and which dawn that was. */
  coinFinds = { dawn: 0, n: 0 };

  markForaged(x: number, y: number, kind: string): void {
    this.foraged.set(this.forageKey(x, y, kind), this.time);
  }

  /**
   * When each pine was last tapped for resin (a Forester's Tap Resin), in
   * wall-clock seconds, as the woods keep time: a pine gives once a day, the
   * day turning at the woods' dawn. The island keeps the same in `foraged`.
   */
  private tapped = new Map<number, number>();
  tappedToday(x: number, y: number): boolean {
    const at = this.tapped.get(y * this.world.w + x);
    return at !== undefined && at >= lastDawn(Date.now() / 1000);
  }

  markTapped(x: number, y: number): void {
    this.tapped.set(y * this.world.w + x, Date.now() / 1000);
  }

  private die(): void {
    const p = this.player;
    // Off any deck she has, as the island's `player_die` takes a body off hers:
    // a place kept aboard would put the body back on her the next frame.
    const ship = this.aboardShip();
    if (ship) ship.riders = (ship.riders ?? []).filter((r) => r.who !== this.riderId());
    p.aboard = null;
    p.seat = 0;
    /*
     * What you were carrying goes into a grave where you fell, before the body
     * is anywhere else: where it fell is where the grave goes. On an island the
     * island digs it, in `player_die`, and says so in its own line; saying it
     * here as well would say it twice, and a death drawn a moment ahead of the
     * island's would say it about a grave that is not there yet.
     */
    const said = this.packFromIsland ? null : bury(this);
    p.stats = { health: 1, stamina: 0.5, hunger: 0.6, thirst: 0.6 };
    p.stop();
    p.x = this.spawn.x + 0.5;
    p.y = this.spawn.y + 0.5;
    p.level = 0;
    // Whatever killed you stays with the body. The wounds that did it would
    // open you again in a minute, and nothing you could do would be quick
    // enough; waking up is waking up whole.
    p.wounds = [];
    p.attackedBy = null;
    p.attackedAt = -1e9;
    this.player.boons = this.player.boons.filter((b) => b.until > this.time);
    this.cancelAction(true);
    if (said) this.logMsg(said, 'error');
    this.events.emit('inventory');
  }

  /**
   * Your graves on your map, each a mark that goes when the grave goes.
   *
   * Handed every grave of yours there is: on an island the slow half of the
   * ground read lists them wherever they are, and on this machine they are
   * all in `furniture` (`markOwnGraves`). One not seen before gets a mark; a
   * mark whose grave is no longer listed comes off. A mark you rub off
   * yourself stays off for as long as the page is open.
   */
  markGraves(graves: ReadonlyArray<{ id: number; x: number; y: number }>): void {
    for (const gr of graves) {
      if (this.graveMarks.has(gr.id)) continue;
      this.graveMarks.add(gr.id);
      if (this.marks.some((m) => m.grave === gr.id)) continue;
      this.marks.push({ id: this.nextMarkId++, name: GRAVE_MARK, x: gr.x, y: gr.y, colour: MARK_COLOURS[0].id, grave: gr.id });
      while (this.marks.length > MARK_CAP) this.marks.shift();
      this.events.emit('world', gr.x, gr.y);
    }
    const kept = new Set(graves.map((gr) => gr.id));
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const m = this.marks[i];
      if (m.grave === undefined || kept.has(m.grave)) continue;
      this.marks.splice(i, 1);
      this.events.emit('world', m.x, m.y);
    }
  }

  /** The graves on this machine that are the player's at this screen, to the map. A guest's are not on the host's. */
  markOwnGraves(): void {
    if (this.packFromIsland) return;
    const own: Array<{ id: number; x: number; y: number }> = [];
    for (const f of this.furniture.values()) if (f.grave && f.grave.who === this.local.who) own.push(f);
    this.markGraves(own);
  }

  /** Graves this page has put on the map, so a mark rubbed off is not put back. */
  private readonly graveMarks = new Set<number>();

  /**
   * Somewhere for a line to go when there is an island listening.
   *
   * Filled in by `play.ts`, like `ask` and `stop`. Null in the game you play
   * by yourself, where the only person who could hear you is you.
   */
  talk: ((text: string) => void) | null = null;

  /**
   * Wave, or hop.
   *
   * Drawn here at once and said over the wire in the same breath: an emote
   * that waited for the island to answer would be an emote you pressed and
   * then watched for, which is the opposite of the point of one.
   */
  emote(id: string): void {
    const def = EMOTE_BY_ID.get(id);
    if (!def) return;
    this.player.emote = id;
    this.player.emoteAt = performance.now() / 1000;
    this.logMsg(def.said.replace('{name}', 'You').replace(/s\.$/, '.'), 'event');
    this.emoted?.(id);
  }

  /** Filled in by whatever is carrying this game to other people, if anything. */
  emoted?: (id: string) => void;

  say(text: string): void {
    const trimmed = cleanSaid(text);
    if (!trimmed) return;
    if (trimmed.startsWith('/')) {
      this.command(trimmed.slice(1));
      return;
    }
    /*
     * On an island the line is not drawn here. It goes over, and comes back
     * down the same subscription that carries it to everybody else — at the
     * same moment and in the same words.
     */
    if (this.talk) {
      this.talk(trimmed);
      return;
    }
    this.logMsg(`<${this.player.name}> ${trimmed}`, 'chat');
  }

  private command(cmd: string): void {
    const [name, ...rest] = cmd.split(/\s+/);
    switch (name.toLowerCase()) {
      case 'name': {
        const n = rest.join(' ').trim();
        if (n) {
          this.player.name = n.slice(0, 24);
          this.logMsg(`Name: ${this.player.name}.`, 'system');
        }
        break;
      }
      case 'where':
        this.logMsg(`Position (${this.player.tileX}, ${this.player.tileY}), height ${metres(this.world.heightAt(this.player.x, this.player.y))} m.`, 'system');
        break;
      case 'help':
        this.logMsg(`Commands: /name <name>, /where, ${EMOTES.map((e) => `/${e.id}`).join(', ')}, /help.`
          + ` Controls: ${boundKey('win_help')}.`, 'system');
        break;
      default:
        // An emote is its own command, so /wave reads the way anybody would
        // guess it does rather than as an argument to something else.
        if (EMOTE_BY_ID.has(name.toLowerCase())) {
          this.emote(name.toLowerCase());
          break;
        }
        this.logMsg(`Unknown command: /${name}`, 'error');
    }
  }
}

/**
 * A thing the island says is on the ground, as the row comes off `placed`.
 *
 * The row itself, less the columns that are nobody's business — so a column
 * the island learns later arrives here without anybody having to widen a list.
 */
/**
 * What a furnace off the island is working on and has finished, as things the
 * browser knows.
 *
 * The island writes a finished piece as `{def, ql, count, extra}` — its own
 * shape for a thing — and a job as `{makes, left, total, ql}` with nothing
 * about what went in. The browser's item has an `id`, and its job has an
 * `item`. Reported from the island as a right-click on a smelter that locked
 * the game up: the menu named what was finished in it, a piece with no `id`
 * has no name, and a name with nothing in it cannot be lowercased. The list
 * had been taken as it came, cast and not looked at.
 *
 * The uid is the furnace's and the piece's place in it, negative so it can
 * never be a uid of anything in the pack, and the same on every read so a
 * menu built off one read and used after the next still names the same
 * piece.
 */
export function furnaceOutput(furnace: number, rows: unknown[] | undefined): Item[] {
  return (rows ?? []).map((raw, i) => {
    const o = raw as {
      id?: string; def?: string; ql?: number; dmg?: number; count?: number; extra?: string | null; piece?: string | null; uid?: number; mark?: Mark | null;
    };
    return {
      uid: typeof o.uid === 'number' ? o.uid : -(furnace * 1000 + i + 1),
      id: o.id ?? o.def ?? 'lump',
      ql: o.ql ?? 1,
      dmg: o.dmg ?? 0,
      count: o.count ?? 1,
      extra: o.extra ?? undefined,
      piece: o.piece ?? undefined,
      ...(o.mark ? { mark: o.mark } : {}),
    };
  });
}

/**
 * A finished piece put with what is waiting, folded into a stack of its kind
 * the way a pack folds it: twenty lumps wait as one entry of twenty rather
 * than twenty of one, and the quality is the average by the unit. The
 * island folds its furnace output the same way (`furnace_fold`).
 */
export function furnaceOut(output: Item[], made: Item): void {
  const def = ITEM_DEFS[made.id];
  const stack = def?.stackable
    ? output.find((it) => it.id === made.id && it.extra === made.extra && it.piece === made.piece && sameMark(it, made)) : undefined;
  if (stack) {
    stack.ql = (stack.ql * stack.count + made.ql * made.count) / (stack.count + made.count);
    stack.count += made.count;
  } else output.push(made);
}

/** And the jobs, each with something in the `item` a local finish would read. */
export function furnaceJobs(rows: unknown[] | undefined): SmeltJob[] {
  return (rows ?? []).map((raw) => {
    const j = raw as { makes?: string; left?: number; total?: number; ql?: number; extra?: string | null; piece?: string | null; item?: Item };
    const ql = j.ql ?? 1;
    return {
      item: j.item ?? { uid: 0, id: j.extra ? `${j.extra.toLowerCase()}_lump` : (j.makes ?? ''), ql, dmg: 0, count: 1 },
      makes: j.makes ?? '',
      left: j.left ?? 0,
      total: j.total ?? j.left ?? 0,
      ql,
      extra: j.extra ?? undefined,
      piece: j.piece ?? undefined,
    };
  });
}

export interface IslandPlaced {
  id: number;
  kind: string;
  sub: string | null;
  x: number;
  y: number;
  /** The storey it stands on: -1 down in a cellar; absent from older islands, and 0 on the ground. */
  level?: number | null;
  sx: number;
  sy: number;
  ql: number | null;
  fuel: number | null;
  ash: number | null;
  /** The enchantment set into it where it stands (`enchanting.ts`), absent for none. */
  enchant?: Enchant | null;
  lit: boolean | null;
  dmg: number | null;
  name: string | null;
  material: string | null;
  /** Which way a piece faces, for furniture; absent from older islands. */
  facing?: string | null;
  /**
   * 'rare', 'supreme' or 'fantastic', for a piece that was one before it was
   * set down; absent from older islands, and null for the rest.
   */
  rare?: string | null;
  litres: number | null;
  liquid: string | null;
  ferment: number | null;
  /** For a barrel of wine, when it stops working, in epoch seconds (`ageing.ts`); absent from older islands. */
  aged_from?: number | null;
  /** For a trellis, when its vine was planted and last picked, in epoch seconds (`vineyard.ts`); absent from older islands. */
  vine_at?: number | null;
  picked_at?: number | null;
  bait: string | null;
  bait_ql: number | null;
  caught: number | null;
  /** A furnace's queue and what it has made; a planter's last crop (`sown`), for a Farmer's Crop Rotation. */
  state: { jobs?: unknown[]; output?: unknown[]; sown?: string; skep_at?: number } | null;
  mine: boolean;
  /** The padlock fitted to it, by the number it shares with its key. */
  lock?: number | null;
  /** The founder of the settlement it is a store of, when it is marked one (`stores.ts`). */
  store_of?: string | null;
  /** For a wildermon bed, the wildermon asleep in it (`PlacedFurniture.sleeper`). */
  sleeper?: number | null;
  /** Whoever has the reins of it or is sitting in it, by uid. */
  driver?: string | null;
  /** Whether that helm is as good as empty, its holder having gone away; only sent when there is a holder. */
  helm_open?: boolean;
  /** Who is aboard as a passenger and in which place on deck, for a hull that has any; absent when nobody is. */
  riders?: Array<{ uid: string; seat: number }>;
  /** Whoever has a cart by the shafts, by uid. */
  puller?: string | null;
  /** The wildermon shut in it, for a wildermon crate; absent from older islands. */
  creature?: number | null;
  /** What its maker's perks put into it (`Mark`); null for most, and absent from older islands. */
  mark?: Mark | null;
  /** The colour a banner, a flag or a sail was dyed; null undyed, and absent from older islands. */
  dye?: string | null;
  /** The line cut into a memorial stone (`memorial.ts`); null uncut. */
  engraving?: string | null;
  /**
   * When it was set down, in epoch seconds, for a piece with roses on it
   * (`furniture_def.roses`): what its roses grow from (`roses.ts`).
   */
  set?: number | null;
  /**
   * What is in it, for a piece of furniture near enough to reach into.
   *
   * Reported as "i opened it and dragged my dirt into it and the dirt
   * vanished". It had not: the island had it in the bin and said so to
   * nobody. Every chest, bin, larder and cart on an island read as empty
   * here, because this read filled `items` with a bare `[]` and nothing ever
   * filled it again — so anything put away went out of the pack and was
   * never seen again. It rides with the row now, the way a crate's contents
   * have since crates crossed, and only within reach, since a yard of full
   * chests is not worth a phone's second.
   */
  things?: StoredThing[];
  /**
   * For a grave: whose it is, by name, and the seconds it has left before it
   * crumbles. What is in it rides in `things`, to its owner only and from
   * within reach; `units`, how many things that is, to its owner from anywhere.
   */
  grave?: { name: string | null; left: number; units?: number | null };
  /**
   * For a piece that gathers moss (a statue), seconds since the moss on it
   * began: since it was set down or last scrubbed, and never from before
   * greening came to the island (`greening.ts`). Absent for everything else.
   */
  green_ago?: number | null;
}

/** A crate, likewise. */
export interface IslandCrate {
  id: number;
  kind: string;
  /** The enchantment set into it where it stands (`enchanting.ts`), absent for none. */
  enchant?: Enchant | null;
  /** Its wear, out of a hundred. */
  dmg?: number | null;
  /** The storey it stands on: -1 down in a cellar; absent from older islands, and 0 on the ground. */
  level?: number | null;
  /** The padlock fitted to it, by the number it shares with its key. */
  lock?: number | null;
  /** The founder of the settlement it is a store of, when it is marked one (`stores.ts`). */
  store_of?: string | null;
  /** Whether it is yours: the island's `crate_yours`. */
  mine?: boolean;
  x: number;
  y: number;
  sx: number;
  sy: number;
  material: string | null;
  /** What it was built at; absent from older islands, where every crate was a 20. */
  ql?: number | null;
  /** 'rare', 'supreme' or 'fantastic'; absent from older islands, null for the rest. */
  rare?: string | null;
  name: string | null;
  deed: boolean;
  /**
   * What is in it, and how much of it.
   *
   * `units` comes for every crate in sight; `things` only for the ones near
   * enough to reach into. The browser used to be told neither, so every crate
   * on an island was drawn empty for ever — which is what "if I put things in
   * the deed crate it automatically puts them back in my inventory" was: the
   * thing went in, the crate never showed it, and the pack settled back to the
   * island's truth a moment later.
   */
  units?: number;
  things?: StoredThing[];
}

/**
 * A thing in a chest, a bin or a crate, as the island sends one: the island's
 * `rpc_ground` and `crates_near`. Its rarity, its colour and its enchantment
 * ride with it, so an enchanted sword put away still reads "(Razoredge)";
 * absent from an island from before they did.
 */
export interface StoredThing {
  id: number;
  def: string;
  ql: number;
  dmg: number;
  count: number;
  extra: string | null;
  /** 'rare', 'supreme' or 'fantastic'; null for the ordinary run of things. */
  rare?: string | null;
  /** The colour it has taken, as a `dye_def` id. */
  dye?: string | null;
  /** What is enchanted into it from a scroll (`enchant.ts`). */
  enchant?: Enchant | null;
  /** For a wildermon crate, the wildermon in it and its name; absent from older islands. */
  creature?: number | null;
  occupant?: string | null;
  /** Its price in silver, on a market stall: what anybody at it sees and buys it for. */
  price?: number | null;
}

/** A stored thing as this side holds one: the same fields `packed` reads off a pack's row. */
export const storedThing = (it: StoredThing): Item => ({
  uid: it.id, id: it.def, ql: it.ql, dmg: it.dmg, count: it.count,
  extra: it.extra ?? undefined,
  rare: rarityStep(it.rare),
  dye: it.dye ?? undefined,
  enchant: it.enchant ?? undefined,
  ...(typeof it.creature === 'number' ? { creature: it.creature } : {}),
  ...(it.occupant ? { occupant: it.occupant } : {}),
  ...(typeof it.price === 'number' ? { price: it.price } : {}),
});

/** How far apart, in seconds, two reads of when a thing began to green are the same moment, read across the network twice (`sinceAgo`). */
const SAME_SINCE = 60;

/**
 * Seconds ago on the island as a moment on this machine's clock, in real
 * seconds: when a thing began to green, for `greenSince`. Seconds since are
 * what two clocks agree on without being set to each other.
 */
/** What the burning half of a ground read carries: a read of only these that says what the last said is not news (`sawGround`). */
const FAST_KEYS: ReadonlySet<string> = new Set(['placed', 'crates', 'lying', 'cellarLying', 'now']);

const sinceAgo = (ago: number | null | undefined): number | undefined =>
  ago === null || ago === undefined || !Number.isFinite(ago) ? undefined : Date.now() / 1000 - ago;

/** Everything on the ground within sight, as one answer. */
/** An island clock for a ground read that comes without one: nothing lying about has been burning. */
const UNLIT: Aged = { since: () => 0 };

export interface IslandGround {
  placed: IslandPlaced[];
  crates: IslandCrate[];
  /** The height the ground is being worked to, or null for none. */
  level?: number | null;
  /**
   * What is lying on the ground within range, whole rows, on the fast half.
   * Left out means nothing said; an empty list means nothing is there.
   */
  lying?: ItemRow[];
  /**
   * And what is lying on the floors of the cellars in range, the same way
   * (the rows held as `cellar` on the island): with the fast half, whenever
   * it is sent.
   */
  cellarLying?: ItemRow[];
  /**
   * What is growing, and how far along.
   *
   * `grown` is how far into the stage it is in, in growing seconds on the
   * clock it grows on, rather than the hour the stage began: the island keeps
   * `stage_at` as a timestamp and this browser counts on its own field clock,
   * and a winter between the two readings would put a stage start read as an
   * hour somewhere a field clock never stood. `ago` is the wall seconds since
   * it began, which is all an island from before the year sent.
   */
  crops?: Array<{ x: number; y: number; id: string; stage: number; ago?: number; grown?: number; tended: number; tendedNow: boolean; ql: number; pace?: number; glass?: boolean; hand?: boolean }>;
  /** What grows in the planters within reach, by the planter's id and tile, on the slow half beside `crops`. */
  planted?: Array<{ planter: number; x: number; y: number; id: string; stage: number; ago?: number; grown?: number; tended: number; tendedNow: boolean; ql: number; pace?: number }>;
  /** The island's wall clock as it answered, in epoch seconds: what `wallSkew` is set by. */
  now?: number;
  /**
   * The felling notches near you and how long ago the woods last turned
   * over, both on the slow half. Look reads them: "2 of 3 strokes in it", and
   * "the woods turn over in 9 hours". A browser on an island keeps no clock
   * of its own for the woods, so this is the only place it hears the hour.
   */
  notches?: Array<{ x: number; y: number; cuts: number }>;
  treesAgo?: number;
  /**
   * The water lilies and lotus planted near you, on the slow half: when each
   * was planted and last picked, in seconds of the wall clock -- the same
   * clock both sides read the year off, so what one is doing is worked out
   * here exactly as the island works it out (`waterPlantState`).
   */
  waterPlants?: Array<{ x: number; y: number; kind: WaterPlantKind; at: number; picked: number | null }>;
  /**
   * Your own settlement, on the slow half.
   *
   * Optional, and the three states are three different answers: absent is
   * "this read said nothing about it", null is "you have no settlement" —
   * which is what a disband sends — and an object is the one you have. The
   * fast read carries none of the three, which is why `sawGround` applies it
   * only when it was sent, and why this was wrong to type as always present.
   */
  deed?: { name: string; x: number; y: number; radius: number; level: number; mine: boolean; role?: DeedRole | null; rank?: string | null; perms?: number | null; baubles?: IslandBauble[] | null } | null;
  /**
   * Other people's settlements, and only those near enough to be standing in.
   *
   * Separate from `deed` because the browser does two quite different things
   * with the two. `deed` is yours: `vision.ts` lights it whatever the hour and
   * however far off, `journal.ts` counts it as a stake you planted, `onDeed`
   * decides what you may build. None of that is true of somebody else's, and
   * handing theirs over as `deed` — which is what an island with one
   * settlement in it did — lit their homestead in your fog and ticked their
   * work off in your journal.
   */
  deeds?: Array<{ name: string; x: number; y: number; radius: number; level: number; holder: string | null; mine?: boolean; role?: DeedRole | null; rank?: string | null; perms?: number | null; baubles?: IslandBauble[] | null }>;
  /**
   * Everybody else ashore, with whereabouts while the island is quiet.
   *
   * On the slow half, beside the settlements, because it is the same kind of
   * thing: a fact about the island rather than about the tile you are on.
   * `folk_ashore` decides whether the positions come with it — see
   * `CROWD_HIDES`.
   */
  folk?: Array<{ uid: string; name: string; online: boolean; x?: number; y?: number }>;
  /**
   * Every grave of yours on the island, however far off, on the slow half:
   * what the marks on your map are put down and taken up by. `placed` has
   * only the ones in range, and you wake a long way from where you fell.
   */
  graves?: Array<{ id: number; x: number; y: number }>;
  /**
   * What is standing, and what is half built.
   *
   * The island has kept `building`, `wall` and `floor_tile` since buildings
   * were ported and has never once said a word about them, so on an island a
   * building was invisible to everybody — including whoever planned it. It
   * went up in Postgres, the rules answered about it, and no browser ever drew
   * a wall of it.
   */
  buildings?: BuildingsJSON & { walls: Array<Wall & { greenAgo?: number | null }> };
  /**
   * And the slabs, which are not buildings: a foundation is ground somebody
   * poured, and it is laid beside the terrain rather than inside a house.
   */
  foundations?: Array<Foundation & { greenAgo?: number | null }>;
  nextFoundationId?: number;
  /**
   * The bridges in range, spans and all, on the slow half: shaped as the
   * browser's own. The island has kept them since bridges were ported and
   * said nothing, so on an island a bridge was neither drawn nor walked.
   */
  bridges?: Array<Bridge & { greenAgo?: number | null }>;
  /**
   * Stone that ages (`greening.ts`), on the slow half: the seconds since
   * greening came to this island, and every tile in range paved or scrubbed
   * since, with the seconds since that. A paved tile not in the list began
   * when greening came in. Each wall, slab, bridge and statue carries its own
   * as `greenAgo` (`green_ago` on what is set down): seconds since it began,
   * for the ones that green.
   */
  greenFromAgo?: number;
  paving?: Array<{ x: number; y: number; ago: number }>;
}
