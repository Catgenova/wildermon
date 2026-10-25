import { PICK_SLACK, PICK_SLACK_TOUCH } from '../../render/pickslack';
import { COLOUR_FORM_ODDS, FORM_PASS, formGives, SIZE_FORM_ODDS } from '../../game/wildforms';
import { BUILD_COUNTS, MOST_GOES } from '../buildCounts';
import { UPDATE_CHECK_MS } from '../update';
import { FAST_DPR, LOW_POWER_FPS } from '../../game/settings';
import { RECONNECTING } from '../phone';
import { DYED_HAIR, HAIR_COLOURS } from '../../game/look';
import { POST_FOLLOW_REACH } from '../../game/posts';
import { AUTO_EAT_AT } from '../../game/autoeat';
import { CRATE_KINDS_SAID, rackPutLine, STORE_REACH } from '../../game/crates';
import { DAMAGE_WARN, FORAGE_COOLDOWN, SPROUT_COOLDOWN, TRAVEL_LEG } from '../../game/game';
import { ROT_SOON } from '../../game/rot';
import {
  BODKIN_HIDE, BURN_WEAR, CONSIDER_EASY, CONSIDER_HARD, CRIT_BASE, CRIT_HIT, CRIT_KNIFE, CRIT_PER_SKILL, DODGE_FROM, DODGE_PER_CONTROL, DODGE_PER_KG, KNIFE_BLEED,
  KNIFE_BLEED_SECS, STAGGER_MAUL, THREAT_HOLD, VENOM_DRAIN, VENOM_SECS,
} from '../../game/fight';
import { ENCHANT_BREAK, ENCHANT_HARM, ENCHANT_LEAST, ENCHANT_MOST, ENCHANT_SAID, ENCHANTERS_PLINTH, enchantHitChance, ENCHANTMENT_LIST, ENCHANTMENTS, ON_WORDS, SCROLL_HARM, wrongKind } from '../../game/enchant';
import { EFFECT_HEAD, EFFECT_TAIL, enchantLineAt } from '../../game/enchanting';
import { STUN_SECS } from '../../game/fight';
import { LAYOUT_NAMES } from '../../game/keybinds';
import { SNAP } from '../windows';
import { CELL, CLEAR_CELLS } from '../snapgrid';
import { JOINT_EVERY, PIN_EVERY, STITCH_EVERY } from '../runecut-dress';
import { lifeWords } from '../runecut-life';
import { islandTime, LOCAL_NIGHT_ENDS, LOCAL_NIGHT_STARTS } from '../theme';
import { FRAME_REACH, FRAME_REACHES, FRAME_RIM, FRAMES, frameLabel, frameOddities, RIM } from '../runecut-art';
import { SALE_DAYS, SALES_SHOWN } from '../../game/prices';
import { RECENT } from './craft';
import { STANDING_A, WILDERMON_A } from '../../game/journal-a';
import { PLACED_REACH, QL_TOP as NEWS_QL_TOP } from '../../game/limits';
import { SPIRAL_TREADS } from '../../game/spiral';
import { BACK_PACE, BACK_SLACK, CIRCLE_R, COWARD_AT, COWARD_DRAG, DRAW_WALK, FALL_BACK, GUARD_RANGE, HUNTER_TURN, KEEP_OFF, MONSTER_TURN, PACK_CALL, PACK_MOST, THROW_HIT, THROW_REACH } from '../../game/fight';
import { FIGHT_QUIET, ARM_SLOW_MOST, ARMOUR_VS, armourSays, BLINDSIDE, blowSays, CROWD_BLOCK, FLANK_HIT, HEAVY_EVERY, HEAVY_HIT, HIDE_NAMES, HIDES, hideSays, LEG_SLOW_MOST, sideOf, WIND_UP, BLOW_DEFENSIVE, BLOW_HUNTER, BLOW_PREY, FIGHT_BACK_STILL, FIGHT_GIVE_UP, FIGHT_LEASH, FIGHT_STANCE_NAMES, FIGHT_STANCES, FIST, FOLLOW_RANGE, stanceSays, SWING_FLOOR, SWING_WIND, SWING_WIND_KG, swingSeconds, TARGET_RANGE, TIRED_AT, TIRED_SLOW, armourSwingSays, overburdenSwingSays } from '../../game/fight';
import {
  CELLAR_DECAY, CELLAR_DEPTH, CELLAR_SOIL, COLUMN_SHARE, SINGLE_STAIRS_NAME, SINGLE_STAIRS_SHARE, SPIRAL_STAIRS_NAME, STAIRS_SHARE, columnBill, floorBill, GLASS_ROOF, heftWord, onlySaid, takesAs, INDOORS_DECAY, INDOORS_REST, JETTY_REACH, MATERIAL_BY_ID, MATERIALS as WALL_MATERIALS, RAILING_HEIGHT,
  NO_PLAN_FROM, OUTSIDE_STAIR_LEVEL, roofShapeDef, roofShapeOf, WALL_HEIGHT, WALL_TYPE_BY_ID, wallBill as typeBill,
} from '../../game/building';
import { CELLAR_DAYLIGHT } from '../../game/cellar';
import { materialName } from '../../game/buildActions';
import { COUNTER_HOLDS, COUNTER_REACH, COUNTER_WALL } from '../../game/counters';
import { candleBurn, lanternReach, PLINTH_BUSY_REACH, PLINTH_REACH, torchBurn } from '../../game/light';
import { flameSources } from '../../game/lantern';
import { ACTION_FLOOR, ACTION_PACE, WORLD_PACE } from '../../game/pace';
import { GAIN_RATE, MIN_GAIN, PAST_TOP, SKILL_BY_ID, SKILL_TOP, skillGain } from '../../game/skills';
import { favourCap, PRAYER_GAIN, PRAYER_PEAKS, PRAYER_REST, prayerWorth } from '../../game/faith';
import {
  calmCap, CHOOSE_AT, PATH_PICK_BY_ID, PATH_TIER_AT, PATHS, PICKS_PER_TIER, picksOf, SIT_CALM, SIT_WORTH, TECHNIQUES,
} from '../../game/meditation';
import { tryGain } from '../../game/learn';
import { DRIVING_LEARN, DRIVING_TOP, drivingPace, SAILING_LEARN, SAILING_TOP, sailingPace, TRAVEL_TOP_AT, VEHICLE_QL_TOP, vehicleQlPace } from '../../game/travel';
import { deckBill, metres, PIER_CLEAR, PIER_DROP, PIER_WALL_DROP, PIER_WATER } from '../../game/piers';
import { COIN_FIND_ONE_IN, COIN_FINDS_A_DAY } from '../../game/forage';
import { BUSH_DEFS, ROCK_VARIANTS, TILE_DEFS, TileType, TREE_AGES, TREE_DAWN_UTC, TREE_DEFS } from '../../world/tiles';
import { REGIONS } from '../../world/regions';
import { TREASURE_TIERS } from '../../game/treasure';
import { ISLAND_ELEMENT, MOTES_LEAST, MOTES_MOST, MOTES_MOST_AT, MOTES_STEP, SWIRL_DARK, SWIRL_LIGHT, SWIRLS_A_DAY } from '../../game/motes';
import { LIGHT_RES, RING_REACH, THREAT_SHADE, THREAT_SHADE_HUNTING } from '../../render/renderer';
import { FLOWER_COLOURS } from '../../render/flowers';
import { BUSH3D_SPECIES, SUN_STEPS, SWAY_MS } from '../../render/trees3d';
import { TURNS } from '../../render/view';
import { BUDGET as BEAST_BUDGET, STAND_FPS } from '../../render/beasts';
import { BIND_BY_ID, keyName } from '../../game/keybinds';
import { RUNESTONES, STONE_SPAN, TELE_FAR, TELE_FAST, TELE_NEAR, TELE_QL_HIGH, TELE_QL_LOW, TELE_SLOW } from '../../game/runestones';
import { BAG_CARRY as BAG_CARRY_293 } from '../../game/gear';
import { OLD_AT as OLD_AT_287, OLD_FOR as OLD_FOR_287, YOUNG_FOR as YOUNG_FOR_287 } from '../../game/creatures';
import { HAUL_LEARN as HAUL_LEARN_290, HAUL_LEARN_RISE as HAUL_LEARN_RISE_290, HAUL_LEARN_STEEP as HAUL_LEARN_STEEP_290 } from '../../game/creatures';
import { SEASON_DAYS, SHORT_SEASON_DAYS, YEAR_DAYS, YEAR_FROM } from '../../world/calendar';
import { ENCHANT_HEAD, HOARD_HEAD, MIND_GAIN, PROSPECT_HEAD, SOUL_GAIN, TAME_HEAD } from '../../game/learn';
import { BARTER_IDLE, BARTER_REACH } from '../../game/barter';
import { GOALS_B } from '../../game/journal-b';
import { FRUITING } from '../../game/fruiting';
import { SKEP_CLUMP_HOURS, SKEP_HOLDS, SKEP_IDLE, SKEP_REACH, SKEP_WAX_EVERY } from '../../game/bees';
import { BUTTER_PATS, GORRAL_MILK } from '../../game/dairy';
import { CELLAR_AGEING, WINE_AGE_CAP, WINE_AGE_RATE } from '../../game/ageing';
import { GRAPE_SEASON, TRELLIS_RULE, VINE_BEARS } from '../../game/vineyard';
import { SEASONS } from '../../world/calendar';
import { ARTIFACT_FOR, SHEAR_FROM, SHEAR_WOOL } from '../../game/creatureActions';
import { GRAPE_WINE_GRAPES } from '../../game/brewing';
import { CHART_LEAST, CHART_QL_PER_TILE } from '../../game/cartography';
import { MEAD_AGE_CAP, MEAD_AGE_RATE } from '../../game/ageing';
import { WHEY_FEED } from '../../game/dairy';
import { GATHER_SKILL, LEARN_PACE as PACE_258, sparTaskSays } from '../../game/creatures';
import { BED_REST, DEN_HEALTH, restFor, SPECIALTY_AT, SPECIALTY_BONUS, STANCE_NAMES, TIRE_GOES, UNFED_PACE, UPKEEP_FOR, workDuration } from '../../game/creatures';
import { BARDING_CUT, GEAR_FLOOR, GEAR_QL_LEAST, GEAR_SIZES, HARNESS_PACE, PACK_LOADS } from '../../game/wildgear';
import { favouriteOf, fedBonus, FED_CARE, FED_FAVOURITE, FED_FOR, FED_LEARN, levelSkill, stageLevels, TAME_HARD, tameLearn, tameNeeds, WILD_STAGE_CHANCE, WILD_STAGE_ODDS, WILD_STAGE_TAME } from '../../game/creatures';
import { abilityName, abilitySays, BASE_STATS, EVOLVE_AT, FILE_RARITY_ODDS, POT_MOST, POT_STEP, GATHER_DO, GATHER_VERB, GRAZE_FILL, LEARNS_SAYS, seasonSays, stageSays, STYLE_SAYS, learnPaceSays, STAGE_LOADS, stageWorkSays, TEND_REACH } from '../../game/creatures';
import { DELIVER_REACH, NOTICE_KEEP, NOTICE_MAIL_DAYS, NOTICE_MAX, WORK_OPEN_MAX } from '../../game/noticeboard';
import { STORE_LOG_CAP } from '../../game/ranks';
import { ORDER_STANCES, VISIT_KEEP_DAYS } from '../../game/visitors';
import { SIGN_MAX, SIGN_QL } from '../../game/signing';
import { DYE_PANE_LITRES } from '../../game/dyestuffs';
import { blockSays, reachSays } from '../../game/fight';
import { BLOOMS, BUSH_FLOWER_FROM, evergreen, LEAF_DAYS, SHED_DAYS, TURN_DAYS } from '../../render/foliage';
import { lifeSeasons } from '../../render/life';
import { LAYERS, TRIAL_SECONDS } from '../../render/timings';
import { SWELL_RATE } from '../../render/water';
import { WALK_FRAMES } from '../../render/figure';
import { BEARD_ODDS } from '../../game/look';
import { EMOTE_BY_ID } from '../../game/emotes';
import { SPELL_VISUALS } from '../../render/spells';
import { furnitureDef, liquidCapacity, POND_EVERY, STATION_REACH, type PlacedFurniture } from '../../game/furniture';
import { billWords, countOf, DRINK_LITRES, LITRE_KG, TAN_LYE, type Item } from '../../game/items';
import { RUNE_GATE, RUNE_GATE_FADE, RUNE_GATE_GLOW_REACH, RUNE_GATE_REACH, RUNE_GATE_RISE, runeGateName } from '../../game/runegate';
import { COIN_METALS, coinPurity, INGOT_LUMPS, INGOT_WEIGHT, MOULD_BY_ID, MOULD_SKILL } from '../../game/metal';
import { meltLumps } from '../../game/melt';
import { ORDER_LIFE } from '../../game/orders';
import { POST_LIFE_MIN } from '../../game/posts';
import { ACTION_BY_ID, GLAZE_ASH, GRASS_PER_CUT, GRASS_PLANT, KIT_MEND, MOSS_PER_CUT, MOSS_PLANT } from '../../game/actions';
import { CIRCLET_SHARE, CIRCLET_STONES, GEMS } from '../../game/gems';
import { CRAFT_REACH, RECIPE_BY_ID, RECIPES, TRADE_BOOK_AT } from '../../game/recipes';
import { BOARD_TOP, RECORD_STATS } from '../../game/boards';
import { BANNER_MS, LEAVING_MS } from '../deedbanner';
import { JAR_SEEDS, SEED_JAR, STAMP, STAMP_GOES, STAMP_RARE, TABLET, TABLET_BELOW, TABLET_GAIN, WHETSTONE } from '../../game/relicuse';
import { RELICS } from '../../game/archaeology';
import { BRACE_MOST, BRACE_STEP, BRIDLE_PACE, COLLAR_CUT } from '../../game/creatures';
import { cropYield, RIPE, seedSays } from '../../game/farming';
import { HEARTBEAT, IDLE_LOGOUT, WORKER_REST_EVERY, WORKER_REST_FIRST, WORKER_REST_MOST } from '../../game/keep';
import { REPORTS_A_SESSION } from '../../net/errors';
import { VIA_MAX } from '../../net/island';
import { CATCH_UP, MAX_STEP as CLOCK_STEP } from '../../engine/loop';
import { ALIGNMENT_NAMES, BAR_SLOTS, FAITH_SPELLS, FAITH_TIER_AT, PATRON_AT, PATRONS, SCHOOL_NAMES, slotsFor, SPELL_ON_WORDS, SPELL_ONS, SPELL_REACH, SPELLS_PER_TIER } from '../../game/patrons';
import { NEED_KINDS, NEED_LABEL } from './care';
import { HUNGRY_AT, HURT_AT } from './wildermon';
import { CARE_WANTING as CARE_WANTING_317 } from '../../game/creatures';
import { article, burnsFor, capital, finePercent, listed, listedOr, numberWord, percent, readyIn, timeWords } from '../../game/words';
import { DEED_UPGRADES } from '../../game/deed';
import { LYE_USE, SHORE_REACH } from '../../game/placeables';
import { DEFAULT_RANKS, lacksSaid, NEWCOMER_RANK, permsOf, POWER, RANK_CAP, RANK_NAME_MAX, RANK_POWERS, rankMay } from '../../game/ranks';
import { DRESSING_RANK } from '../../game/wounds';
import { ANCIENT_EFFECTS, ANCIENT_PLUS, BAUBLE_HIGH, BAUBLE_LOW, BAUBLE_SHARE, BAUBLE_TIERS, baubleTimes, REGRET_SHARE, YIELD_TIMES } from '../../game/baubles';
import { CLASS_AT, CLASS_CHANGE_COST, CLASS_TIER_AT, CLASSES, PERK_CLASSES, PERK_TIER_AT, PERKS_PER_TIER, tiersAtFor } from '../../game/classes';
import { spellDef, spellForce, spellsOf } from '../../game/arcane';
import { PERK_BY_ID, perksOf } from '../../game/perks';
import { CLASS_LEARN_BLOW, CLASS_LEARN_KILL, CLASS_LEVEL_START, CLASS_SPELL_BY_ID, CLASS_SPELLS, classSpellsOf, FIRE_LOW, FIRE_TOP, skinOf, spellTerms } from '../../game/talents';
import { HUSBANDRY_ACTIONS, ODDS_BAND, ODDS_BANDS_AT, ODDS_EXACT_AT, ODDS_LIKELY, ODDS_PLACES } from '../../game/husbandry';
import { TINCTURE_BONUS, TINCTURE_SECONDS } from '../../game/boons';
import { TINCTURE_NAMES } from '../../game/remedies';
import { FED_SAID, SOUL_CHANCE } from '../../game/sacrifice';
import { GRAVE_KEEPS, GRAVE_REACH } from '../../game/graves';
import { RESTORE_HARM, RESTORE_HARM_SPREAD } from '../../game/archaeology';
import { CARRY_BASE, CARRY_PER_STRENGTH, DAMAGE_MAX, DAY_SECONDS, DEEDS_JOINED, deedWorkersAt, goSeconds, MAX_DEED_LEVEL, NIGHT_ENDS, NIGHT_STARTS, QL_TOP } from '../../game/game';
import { UI_SIZE_MAX, UI_SIZE_MIN } from '../screen';
import { defaultKey } from '../../game/keybinds';
import { guideEntries, guidePages } from '../../game/guide';
import { MUTE_FOR, MUTE_SHUTS, NEW_BODIES_A_DAY, REPORT_REASONS, REPORTS_A_DAY } from '../../game/keeper';
import { awayFor } from '../../game/away';
import { ARMOUR, BANE_BONUS, SHIELDS, SLOTS, WEAPON_BY_ID, WEAPONS } from '../../game/gear';
import { JEWEL_PIECES } from '../../game/gems';
import { itemDef, RARITIES, rarityBands, rarityChance, rareInputSaid } from '../../game/items';
import { improvable } from '../../game/improve';
import { weaponCarry } from '../../render/figure';
import { TRY_LEARN } from '../../game/learn';
import { BASE_SPEED, CLIMB_LEARN, CLIMB_LEARN_FROM, CLIMB_LEARN_STEEP, CLIMB_PER_LEVEL, MAX_STEP, strideAt } from '../../game/player';
import { staminaBarAbove, SWIM_LEARN } from '../../game/body';
import { CHAR_START, SOUL_PER_LEVEL, soulAbove } from '../../game/game';
import { AWARE_PER_LEVEL, AWARE_TRAIT_STEP, awareShareAbove, awareTraitEase } from '../../game/game';
import { DARK_WALK, DARK_WORK, NIGHT_EYES_FROM, TRACK_AWARE } from '../../game/learn';
import { KNACK_BY_LEARNING, KNACK_GO, KNACK_ODDS } from '../../game/titles';
import { ALL_GOALS } from '../../game/journal';
import { ISLAND_GOALS, TRADE_GOALS, WILDERMON_GOALS_C } from '../../game/journal-c';
import { IDLE_WANTS, idleSays, LEDGER_ITEMS, LEDGER_SHOWN, workDoneLine } from '../../game/workerlog';
import { CULL_RANGE, COMPANION_SIGHT, FORMER_NAME, HEARTH_FULL, HOME_LEG, HOME_SLACK, MONSTER_CAP, MONSTERS, REED_LEVELS, SPECIES, WILD_SPECIES, WILD_STAY } from '../../game/creatures';
import { TRACK_RANGE_BASE, TRACK_RANGE_PER, TRACK_SHOW, trackBandsSays, trackErrSays, trackRange } from '../../game/tracking';
import { betterThanCommon, BLOOD_CHANNELS, husbandryOdds, LAMP_TIER_ODDS, pct as cardPct, TIERS, TRAIT_SLOTS, depthMul, MUTATION_ODDS, PEDIGREE_MOST, PEDIGREE_STEP } from '../../game/traits';
import { SLOTS_PER_STAGE, stageSlots } from '../../game/traits';
import { CHANNELS, FIGHTING, gradeId, traitOf, traitSays, type TraitDef } from '../../game/traits';
import { PERK_STAGE, perkSays, STAGE_PERKS } from '../../game/creatures';
import { CHAIN_MOST, FALL_DROP, FILL_RATE, POOL_DEPTH, POOL_LIP, RUN_RATE, SPRING_DEPTH, SPRINGS_EACH } from '../../world/springs';
import { POOL_FILL } from '../../game/foundations';
import { MAX_STAND, SWIM_DEPTH } from '../../game/player';
import {
  STEPS_BRICKS, STEPS_LEAST, STEPS_MOST, STEPS_PLANKS, STEPS_SLABS, STEPS_TWIST, TILE_DEFS as GROUNDS, TileType as Ground, WEAR_FALL, WEAR_MOST,
  WEAR_TRAIL, WEARS,
} from '../../world/tiles';
import { STEPS_BACK, stepsBack, STONE_STEPS_BILL, TIMBER_STEPS_BILL } from '../../game/steps';
import { ROSE_BUD, ROSE_FLOWER, ROSE_LEAFY, ROSES_RULE } from '../../game/roses';
import { DEVICE_COUNT } from '../../render/furniture';
import { FLOWER_MOST, FLOWER_SEASONS } from '../../world/flowers';
import {
  colourWord, DYE_LITRES, DYE_LITRES_PER_KG, DYE_QL_BLACK, DYE_QL_PURE, DYE_QL_WHITE, dyeGrams, DYESTUFFS, dyeHex, kgSaid, LEGACY_DYES, LEGACY_POT_LITRES,
  LEGACY_POTS, legacyLiquid, PRIMARIES, pureDye, mixDye, sharesSaid,
} from '../../game/dyestuffs';
import { BOIL_LITRES, boilCountPlain, gramsOf } from '../../game/dyes';
import { GREEN_ACTIONS, GREEN_DAYS, GREEN_SHADE, GREEN_SUN, GREEN_WET } from '../../game/greening';
import { BUCKET_LITRES, FURNITURE, WELL_HOLDS, WELL_TRICKLE, WELL_TRICKLE_QL } from '../../game/furniture';
import { BAY_PAST_HEFT, BRIDGE_REACH, BRIDGES, CLEARANCE, END_SLOP, isMaterialBridge, PULL_REACH, RAMP_SLOPE, rampTiles, STALL_WIDTH, STONE_ARCH, THROWN, WAGON_WIDTH, WIDEST } from '../../game/bridges';
import { AQUEDUCT } from '../../game/aqueducts';
import { AQUEDUCT_FLOW, AQUEDUCT_LPS, CHANNEL_DEEP, CHANNEL_WIDE, TILE_METRES } from '../../world/aqueducts';
import { gateJobWords, gateReach, HIDDEN_DOOR_IRON, HIDDEN_DOOR_LAPSE } from '../../game/gates';
import { CROPS, growthWords } from '../../game/farming';
import { GLASSHOUSE_GROWTH, PLANTER_GROWTH, SEASON_GROWTH, SEASON_SECONDS, YEAR_SECONDS } from '../../game/growth';
import { STONES_DEPTH, STONES_SLABS, yearSays } from '../../game/watergarden';
import { WATER_PLANT_BY_ID, WATER_PLANT_DEEPEST, WATER_PLANT_SHALLOWEST, WATER_ROOTING, type WaterPlantDef } from '../../world/waterplants';
import { ENGRAVE_MAX, ENGRAVE_TOOL, MEMORIAL } from '../../game/memorial';
import { CHAT_KEEP_DAYS, EVENT_KEEP_DAYS, TALK_LOG } from '../../game/events';
import { gemFound } from '../../game/gems';
import { BRAZIER_CAPACITY, DEPLOY_REACH, OVEN_CAPACITY } from '../../game/furniture';

/**
 * What's new: what changed on the island, a line each, shown once as you come
 * ashore after it changed.
 *
 * Asked for: "What's new, on login. Players aren't told when things change,
 * such as today's cost increases and the caravel. A short note after each
 * deploy would say what changed."
 *
 * One entry a deploy, numbered in the order they went out. A browser keeps
 * the highest number it has shown (`SEEN`), and the window opens by itself on
 * the way in when there is a higher one, with the ones it has not shown
 * marked. A browser nobody has played in before is not behind, it is new: it
 * is marked up to date without being shown anything, since a list of what
 * changed is no use to somebody who never saw it the other way.
 *
 * Every line says what changed and by how much, in the game's own terms, and
 * takes its numbers from the rule where the rule has them (CLAUDE.md). So a
 * line reads what is true now, which for a note a few days old is what it
 * said when it was written.
 */

interface News {
  /** Counted up from one, a deploy each; see `SEEN`. */
  n: number;
  /** The day it reached the island. */
  day: string;
  /** What changed. Worked out when the window is drawn, from the rules as they stand. */
  lines: () => string[];
}

/** A piece's bill, as its recipe has it. */
const pieceBill = (id: string): string => billWords(furnitureDef(id).bill, true);
/** A recipe's bill. */
const recipeBill = (id: string): string =>
  billWords((RECIPE_BY_ID.get(id)?.inputs ?? []).map((i): [string, number] => [i.item, i.count ?? 1]), true);
/** A solid wall's bill in a material. */
const wallBill = (id: string): string => billWords(MATERIAL_BY_ID.get(id)?.bill ?? [], true);
const pct = (k: number): string => `${Math.round(k * 100)}%`;
/** "a, b or c". */
const either = (parts: string[]): string =>
  parts.length > 1 ? `${parts.slice(0, -1).join(', ')} or ${parts[parts.length - 1]}` : (parts[0] ?? '');
/** A shop counter's wall type (`counters.ts`), for what entry 70 says it costs. */
const counterType = () => WALL_TYPE_BY_ID.get(COUNTER_WALL);
/** The skill a recipe is worked at, by name. */
const skillOf = (id: string): string => (SKILL_BY_ID.get(RECIPE_BY_ID.get(id)?.skill ?? '')?.name ?? '').toLowerCase();

/** A count or quantity in figures: 1500 is "1,500". */
const num = (n: number): string => n.toLocaleString('en');
/** A share in figures: 0.2 is "1/5", 0.75 "3/4"; one that is no simple fraction is a percentage. */
const frac = (x: number): string => {
  for (const d of [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 20, 100]) {
    const n = Math.round(x * d);
    // As `share` has it: past a tenth, only one part of the whole (7/20 is 35%).
    if (n >= 1 && n < d && !(n > 1 && d > 10) && Math.abs(x * d - n) < 1e-6) return `${n}/${d}`;
  }
  return percent(x);
};
/** A multiplier in figures: "×2", "×1.5". */
const mult = (m: number): string => `×${Number(m.toFixed(2))}`;
/** A stretch of time in figures: "45 s", "1 hour and 15 minutes", "2 days". */
const dur = (secs: number): string => (Math.round(secs) < 90 ? `${Math.round(secs)} s` : timeWords(secs));

/** An hour of the island's clock as the hud shows it: "06:00". */
const hudHour = (h: number): string =>
  `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
/** The moment the woods turn and the day's counts start again, by one name everywhere. */
const RESET = `daily reset (${hudHour(TREE_DAWN_UTC)} UTC)`;

/** What a boil made and a dyeing took the day dye became a liquid (111), before it went by weight (117). */
const WAS_DYE = { boil: 3, garment: 1, banner: 2, sail: 3, ship: 5, wall: 1, floor: 1 } as const;

export const NEWS: News[] = [
  {
    n: 1,
    day: '2026-09-25',
    lines: () => [
      `Added: ${itemDef('creature_crate').name.toLowerCase()}s, 1 wildermon each. With one already following you, another is tamed only into an empty crate in your pack.`,
      'Removed: keeping wildermon at the settlement totem. Those kept there: in crates set down beside it, or in the keeper\'s pack where there was no room.',
      'Changed: a newborn follows its keeper when nothing else does; else goes into an empty crate in their pack; else an empty crate of theirs on their settlement, nearest its dam first; else goes wild.',
      'Changed: Butchering trains on an island as well as solo. Carcass yield made at your Butchering and knife quality; the carcass\'s own quality no longer lowers it.',
      'Added: a citizen may leave a settlement they joined (its menu on its land, or the Settlement window) and may found one of their own.',
      'Added: market board (Market window at a settlement totem or a mailbox): every stall on the island, its prices, location and owner. A crated wildermon can be offered in a deal, sold off a stall or posted; the crate\'s new owner keeps it.',
      `Added: leaderboards: top ${BOARD_TOP} in each skill, top ${BOARD_TOP} best-bred wildermon, top ${BOARD_TOP} biggest settlements.`,
      'Added: Wildermon window names a newborn\'s dam and sire and which parent each readable trait came from.',
      `Added: While you were away window on coming ashore: workers' deliveries to settlement stores, newborns, stall sales, parcels posted to you; counted from ${IDLE_LOGOUT / 60} min after your browser was last heard from.`,
    ],
  },
  {
    n: 2,
    day: '2026-09-25',
    lines: () => {
      const caravel = furnitureDef('caravel'), sailer = furnitureDef('sailing_boat');
      return [
        `Changed: wall bills, scaled to the cobblestone wall's ${wallBill('cobblestone')}: log wall ${wallBill('log')}, plank wall ${wallBill('plank')}, marble wall ${wallBill('marble')}. Floors, stairs, roofs and fences rise with their material. Already-planned work keeps its old bill.`,
        `Changed: furniture bill amounts: planks, timber, cloth, stone bricks and mortar ×4 the old amount; nails and metal ribbon ×2; legs, wheels, ropes, castings and other counted parts unchanged. Chest: ${pieceBill('chest')}.`,
        `Changed: smelter ${recipeBill('make_smelter')}; kiln ${recipeBill('make_kiln')}; anvil poured from ${MOULD_BY_ID.get('anvil_mould')?.lumps ?? 0} lumps. Traps rose as furniture did.`,
        `Changed: rowing boat ${pieceBill('rowing_boat')}; sailing boat ${pieceBill('sailing_boat')}.`,
        `Added: caravel: ${pieceBill('caravel')}. Holds ${caravel.capacity} items; ${caravel.boat?.passengers} passengers plus the helmsman; speed ${caravel.boat?.speed} tiles/s (sailing boat ${sailer.boat?.speed}); draught ${metres(caravel.boat?.draught ?? 0)} m.`,
      ];
    },
  },
  {
    n: 3,
    day: '2026-09-25',
    lines: () => [
      'Added: padlock on a ship, wagon or cart. Without its key: no helm, reins, boarding, taking the shafts or picking up. Stepping ashore and getting down always allowed.',
      `Added: Settings, Display: text and window size ${pct(UI_SIZE_MIN)} to ${pct(UI_SIZE_MAX)}. Scales every window, menu and bar and their text; not the island.`,
      `Changed: an idle worker looks for work again after ${WORKER_REST_FIRST} s, +1 s per ${WORKER_REST_EVERY} s idle, at most every ${WORKER_REST_MOST} s.`,
      `Added: browser errors reported to the island, each distinct error once, at most ${REPORTS_A_SESSION} a session, with the game version.`,
    ],
  },
  {
    n: 4,
    day: '2026-09-25',
    lines: () => [
      'Fixed: people on a caravel drawn in depth order with her sails.',
      'Changed: a piece is clickable anywhere it is drawn beyond its tile (caravel: bow and stern).',
      `Added: buy orders (Market window at a settlement totem or a mailbox): item, minimum quality, count, silver each; full price held from your purse. Anyone there can fill some or all from their pack and is paid at once; goods come to you by post. Cancel any time; open ${ORDER_LIFE / 86400} days: cancels itself, returning what it holds.`,
      `Added: Field guide (${defaultKey('win_guide')}): a page per creature kind, ${guidePages().length} kinds: seen, tamed, bred, habitat, yields.`,
      'Added: What\'s new window: opens on coming ashore when there are unread entries; also in the UI Menu.',
    ],
  },
  {
    n: 5,
    day: '2026-09-25',
    lines: () => [
      `Added: graves. On death your pack, hands, toolbelt and every bag with contents go into a grave where you fell, or nearest dry ground within ${GRAVE_REACH} tiles if in deep water. Only you can open or take from it. Crumbles with its contents ${dur(GRAVE_KEEPS)} after death. Worn gear and crated wildermon stay on you.`,
      'Fixed: 2 simultaneous payments from 1 purse both going through. The second waits for the first and is refused if the remainder cannot cover it.',
    ],
  },
  {
    n: 6,
    day: '2026-09-26',
    lines: () => [
      'Added: island keepers: the founder, and the all-islands keeper. A keeper sees everyone on the island, can move a stuck body to the totem of the settlement it founded (or the newcomer landing if none), and can clear a tile.',
      `Added: keeper mute ${either(MUTE_FOR.map((secs) => (secs === null ? 'until a keeper lifts it' : `for ${awayFor(secs)}`)))}. While muted, the island refuses ${MUTE_SHUTS} and gives the end time.`,
    ],
  },
  {
    n: 7,
    day: '2026-09-26',
    lines: () => {
      const shine = RARITIES.slice(1).map((r) => r.name);
      return [
        `Added: worn and held gear drawn on everyone: ${ARMOUR.length} armour pieces, ${WEAPONS.length} weapons, ${Object.keys(SHIELDS).length} shields, the toolbelt and ${JEWEL_PIECES.length} jewels, each its own model in its material and dye, in any combination.`,
        'Added: weapon drawn in the hand, bow in the other, shield on the arm.',
        `Added: ${either(shine)} items shine when worn, each in its rarity colour: a glint crosses all of one rarity together; ${shine[1]} colour pulses; ${shine[2]} sparkles.`,
      ];
    },
  },
  {
    n: 8,
    day: '2026-09-26',
    lines: () => {
      const shine = RARITIES.slice(1).map((r) => r.name);
      // The weapons each way, named as the figure draws them.
      const held = (pick: (c: { carry: string; stow: string }) => boolean): string =>
        either(WEAPONS.filter((w) => { const c = weaponCarry(w.id); return !!c && pick(c); }).map((w) => itemDef(w.id).name.toLowerCase()));
      return [
        `Added: ${held((c) => c.carry === 'shoulder')} carried over the shoulder.`,
        `Added: held items stowed while working, swimming, driving, waving or hopping: ${held((c) => c.stow === 'hip')} in a scabbard at the left hip; ${held((c) => c.stow === 'belt')} through the belt at the right; anything else on a back strap, shield over it.`,
        `Added: ${either(shine)} pieces edged in their colour on the shaded side; anything worn over a piece covers its shine.`,
      ];
    },
  },
  {
    n: 9,
    day: '2026-09-26',
    lines: () => {
      const carried = (how: string): string[] => WEAPONS.filter((w) => weaponCarry(w.id)?.carry === how).map((w) => itemDef(w.id).name.toLowerCase());
      const shouldered = carried('shoulder');
      return [
        'Changed: armour class outlines: cloth padded to the knee, split skirt; leather tall collar, shoulder caps, 4-panel flared skirt; mail split front and back; dragon scale in overlapping courses head to feet.',
        `Changed: ${either(shouldered)} goes over the shoulder that keeps it clear of the head from the viewer. Bow held upright at the side, higher the longer it is and higher at a run, lower tip off the ground. ${either(carried('staff'))} leans out past the face.`,
      ];
    },
  },
  {
    n: 10,
    day: '2026-09-26',
    lines: () => {
      const shine = RARITIES.slice(1).map((r) => r.name);
      const carried = (how: string): string[] => WEAPONS.filter((w) => weaponCarry(w.id)?.carry === how).map((w) => itemDef(w.id).name.toLowerCase());
      return [
        `Changed: ${either(carried('fist'))} turns out to the side where it would point at the viewer or hide behind you; visible from every side. ${either(['bow', ...carried('staff')])} leans back where forward would cross the head. ${either(carried('shoulder'))} carried more upright seen from behind.`,
        `Changed: ${either(shine)} pieces keep their metal, wood or dye; rarity colour only in the edge line, the glint and the stars.`,
        'Changed: mail drawn as ring rows, dragon scale as overlapping scales at play scale. Cloth and leather shaded lit/dark like the body; cap, coat and breeches of one dye each a step lighter or darker.',
        'Added: toolbelt shows a claw hammer behind the left hip and chisel and awl handles at the right.',
      ];
    },
  },
  {
    n: 11,
    day: '2026-09-26',
    lines: () => {
      const shine = RARITIES.slice(1).map((r) => r.name);
      const named = (id: string): string => itemDef(id).name.toLowerCase();
      const knives = WEAPONS.filter((w) => weaponCarry(w.id)?.front).map((w) => named(w.id));
      return [
        `Changed: hair shows below the rim of a ${either(['wool_cap', 'leather_cap', 'helm', 'scale_helm'].map(named))}; long hair hangs below a ${named('wool_cap')} or ${named('leather_cap')} as cut. ${named('chain_coif')} covers all hair.`,
        `Changed: ${either(knives)} stowed upright at the front of the belt, right of the buckle, not at the hip.`,
        `Changed: ${named('hatchet')}: square bit, hammer poll. ${named('throwing_axe')}: swept-up head, bowed haft. ${named('javelin')}: tail vanes. ${named('carving_knife')}: finger guard. ${named('chain_hauberk')}: longer, flared past the hips.`,
        `Changed: dragon scales end in a broad U, each over the course below. ${either(shine)} dragon scale shows its colour on lit scale tips, not an edge line.`,
      ];
    },
  },
  {
    n: 12,
    day: '2026-09-26',
    lines: () => {
      const shine = RARITIES.slice(1).map((r) => r.name);
      const named = (id: string): string => itemDef(id).name.toLowerCase();
      return [
        `Changed: hair under a ${either(['wool_cap', 'leather_cap', 'helm', 'scale_helm'].map(named))} cut at the rim; only what hangs below shows. ${named('helm')} and ${named('scale_helm')} stand clear of the hair, with a neck guard. ${named('leather_cap')}: 4 panels, darker redder hide than the coat.`,
        `Changed: ${either(shine)} colour shown as a sheen on the lit side, not an edge line. Glint crosses it nearly all the time; ${shine[2]} glint paler, stars bigger.`,
        `Changed: ${named('maul')} slung head up; ${named('spear')} and ${named('javelin')} slung higher, butt off the ground; ${named('throwing_axe')} leans out from the belt, haft visible; scabbarded sword hangs out from the leg, visible from the front.`,
        'Changed: dragon scale lower edges pale where lit, mid green where not; no dark line under each course.',
      ];
    },
  },
  {
    n: 13,
    day: '2026-09-26',
    lines: () => {
      const named = (id: string): string => itemDef(id).name.toLowerCase();
      return [
        `Changed: ${named('leather_jerkin')} studded with rivets over the chest and skirt.`,
        `Changed: ${named('chain_hauberk')} wider below the hips; every skirt swings wider with longer strides.`,
      ];
    },
  },
  {
    n: 14,
    day: '2026-09-26',
    lines: () => {
      const shine = RARITIES.slice(1).map((r) => r.name);
      const named = (id: string): string => itemDef(id).name.toLowerCase();
      const onBack = WEAPONS.filter((w) => weaponCarry(w.id)?.stow === 'back').map((w) => named(w.id));
      const bows = WEAPONS.filter((w) => weaponCarry(w.id)?.carry === 'bow').map((w) => named(w.id));
      return [
        `Changed: ${either(onBack)} stowed on the back goes over the shoulder visible to the viewer, axe bit and bow bend facing the viewer. ${named('battle_axe')} or ${named('maul')} on the shoulder rises back over it, head above and behind.`,
        `Changed: ${either(bows)} held upright at the side, lower tip clear of the boots.`,
        `Changed: ${named('chain_coif')} closes under the chin and over the ears.`,
        `Changed: ${shine[2]} sheen and glint gold. ${either(shine)} colour goes under mail rings and scale edges, not over; none on thin rims.`,
        `Changed: leather lighter. ${named('leather_jerkin')}: chest strap and buckle, front stitching, pale collar and shoulders. ${named('leather_cap')}: rolled rim, rim-to-crown seams, narrower ear flaps.`,
        `Changed: ${named('hatchet')} bearded bit; stowed, it and ${named('throwing_axe')} turn blades out from the hip. ${named('butchering_knife')} broad sheath; scabbards dark leather; seated, a scabbard lies back along the seat. ${named('jewelled_ring')}: a band on 1 finger.`,
        `Changed: plate arms: 1 domed shoulder plate over 2 lames. ${named('helm')} cheek plates curve round the jaw. ${named('scale_helm')} spines are fins. Long hair narrows under a cap or helm.`,
      ];
    },
  },
  {
    n: 15,
    day: '2026-09-26',
    lines: () => {
      const named = (id: string): string => itemDef(id).name.toLowerCase();
      return [
        `Changed: dragon scale in fewer, larger scales; mail ring rows further apart; ${named('chain_hauberk')} flares wider below the hips.`,
        `Changed: ${either(Object.keys(SHIELDS).map(named))} thicker at the rim (a band edge on). Fully lit blades pale steel, not white. Bare arms outlined as dark as armour.`,
      ];
    },
  },
  {
    n: 16,
    day: '2026-09-26',
    lines: () => {
      const named = (id: string): string => itemDef(id).name.toLowerCase();
      return [
        `Fixed: filling, emptying or pouring 1 ${named('bucket')} from a stack (pack or bag) did nothing while filling still drew the water. It now splits that one off the stack.`,
      ];
    },
  },
  {
    n: 17,
    day: '2026-09-26',
    lines: () => {
      const shine = RARITIES.slice(1).map((r) => r.name);
      const named = (id: string): string => itemDef(id).name.toLowerCase();
      const bows = WEAPONS.filter((w) => weaponCarry(w.id)?.carry === 'bow').map((w) => named(w.id));
      const shouldered = WEAPONS.filter((w) => weaponCarry(w.id)?.carry === 'shoulder').map((w) => named(w.id));
      const slungHeavy = WEAPONS.filter((w) => { const c = weaponCarry(w.id); return c?.carry === 'shoulder' && c.stow === 'back' && c.headUp; }).map((w) => named(w.id));
      const slungPoles = WEAPONS.filter((w) => weaponCarry(w.id)?.carry === 'staff' && weaponCarry(w.id)?.stow === 'back').map((w) => named(w.id));
      return [
        `Changed: ${either(shine)} colour covers the whole lit side, wood and leather included, and stays between glints.`,
        `Changed: ${either(bows)} held out past the hip, bend facing the viewer.`,
        `Changed: from behind, ${either(shouldered)} on the shoulder rises behind it, haft visible under the head; carrying arm on the far side.`,
        `Changed: while working, ${either(slungHeavy)} on the back hangs head down; ${either(slungPoles)} hangs lower, clear of the hammer.`,
        `Changed: leather red-brown except skin-coloured, sheen on the lit side. ${named('leather_trousers')} knee pads flat and darker.`,
        `Changed: ${itemDef('cloth_sleeves').name} join the coat at the shoulder and bend at the elbow with no visible joint. ${named('cloth_tunic')} collar, hem and cuffs faced a lighter shade.`,
        `Changed: ${named('helm')} cheek plates narrow to the chin, neck guard flares. ${named('scale_helm')}: crest of splayed fins, scale cheek plates. Long hair under a cap or helm drawn in at the nape, falls in locks.`,
        `Changed: ${named('chain_coif')} face opening narrows at the chin, cut back at the cheek (face visible side on).`,
        `Changed: ${named('toolbelt')} hammer hangs head down from a loop; ${named('jewelled_ring')} shows a gold point from every side; ${named('wooden_shield')}: weathered boards, dark rawhide rim; ${named('chain_hauberk')} skirt flies out behind at a run; belted axe shows its blade three-quarters on.`,
      ];
    },
  },
  {
    n: 18,
    day: '2026-09-26',
    lines: () => {
      const shine = RARITIES.slice(1).map((r) => r.name);
      const named = (id: string): string => itemDef(id).name.toLowerCase();
      return [
        `Changed: ${either(shine)} pieces tinted their rarity colour all over, lit and shaded, material still visible; outline a dark of that colour.`,
        'Changed: dragon scale in overlapping courses, edges pointed at shoulders, elbows, knees, hem and boot tops; gauntlets dark scale.',
        `Changed: ${itemDef('chain_sleeves').name} flare over the hand back; ${named('chain_leggings')} hang over the knee in ragged points; ${named('chain_hauberk')} hem a band of bright rings of its metal.`,
        `Changed: leather browner red; dyed leather keeps its dye. ${itemDef('leather_sleeves').name}: no elbow knob. Cloth and leather suit pieces step further apart in shade cap to shoes; wider quilting channels. Copper warmer, pale edges, green shadow.`,
        `Changed: back-slung items hang from a strap over the same shoulder; working left-handed, both on the other shoulder. ${named('long_bow')} longer, held further forward at a run. ${named('throwing_axe')} held head up.`,
        `Changed: ${named('chain_coif')} face opening pointed under the chin; ${named('scale_helm')} fins on the crown; long hair under a cap or helm falls as one curtain.`,
      ];
    },
  },
  {
    n: 19,
    day: '2026-09-26',
    lines: () => [
      'Fixed: Climbing gains reverting at the next island update or reload. The island now raises it.',
      `Changed: Climbing trains on a step between tiles of more than ${metres(CLIMB_LEARN_FROM * MAX_STEP)} m (${frac(CLIMB_LEARN_FROM)} of the ${metres(MAX_STEP)} m highest step) up or down, on foot only: not mounted, on a cart or boat, on a bridge or upper floor.`,
    ],
  },
  {
    n: 20,
    day: '2026-09-26',
    lines: () => [
      'Changed: altar model: coursed stone pedestal, gold sun on its face, gold dish on top; above the dish a turning figure of stars joined by lines in a ring of light; stars shine at night.',
    ],
  },
  {
    n: 21,
    day: '2026-09-26',
    lines: () => [
      'Changed: an altar can only be built while standing on your settlement (founded or citizen of).',
    ],
  },
  {
    n: 22,
    day: '2026-09-26',
    lines: () => [
      'Changed: an altar can only be set down on your settlement. Altars already elsewhere stay.',
    ],
  },
  {
    n: 23,
    day: '2026-09-26',
    lines: () => [
      `Added: baubles: ${percent(BAUBLE_SHARE)} of archaeology finds are a tarnished bauble: ${listed(BAUBLE_TIERS.map((t) => `${percent(t.odds)} ${t.name.toLowerCase()}`))}. Restore as a relic; its effect is set at random and written on it.`,
      `Added: set into an altar on your settlement (Baubles on the altar menu). Sockets per settlement, by grade: ${listed(BAUBLE_TIERS.map((t) => `${num(t.slots)} ${t.name.toLowerCase()}`))}. Applies to the founder, mayors and builders on every action on its land.`,
      `Added: Minor: ${BAUBLE_LOW} to ${BAUBLE_HIGH}% less time per action, or ${BAUBLE_LOW} to ${BAUBLE_HIGH}% more skill gain, in 1 skill. Major: ${BAUBLE_LOW} to ${BAUBLE_HIGH}% chance of yield ${mult(YIELD_TIMES)} per action in 1 skill. Ancient: +${ANCIENT_PLUS} to every yield of 1 action, e.g. ${ANCIENT_EFFECTS[1].said}.`,
      `Added: rarity multiplies the effect: ${listed(RARITIES.slice(1).map((r, i) => `${mult(baubleTimes(i + 1))} for ${article(r.name)} ${r.name} one`))}.`,
      'Added: a set bauble cannot be removed. Setting another in its socket destroys the old one.',
    ],
  },
  {
    n: 24,
    day: '2026-09-26',
    lines: () => [
      'Changed: 1 altar per settlement. A second cannot be built or set down there; turning the existing one still works.',
      'Changed: settlements with several altars keep them but cannot get more. Bauble sockets belong to the settlement: an altar picked up and set down again keeps its baubles.',
    ],
  },
  {
    n: 25,
    day: '2026-09-26',
    lines: () => [
      `Changed: altar bill from a gold lump to ${billWords(furnitureDef('altar').bill, true)}.`,
    ],
  },
  {
    n: 26,
    day: '2026-09-26',
    lines: () => [
      `Added: Sacrifice (altar menu): gives up 1 rare, supreme or fantastic item from your pack. ${FED_SAID}`,
      `Added: ${percent(SOUL_CHANCE)} of sacrifices leave a mote of the same rarity. Absorb into (on the mote) gives an ordinary item in your pack the mote's rarity.`,
    ],
  },
  {
    n: 27,
    day: '2026-09-26',
    lines: () => [
      `Added: Bauble of Regret: ${percent(REGRET_SHARE)} of archaeology finds, already whole. Tarnished bauble still ${percent(BAUBLE_SHARE)}.`,
      `Added: with one in your pack, Undo on a held trade (Trades window) breaks the bauble and drops the trade with its bought nodes or perks. The next trade in that slot costs nothing (normally ${CLASS_CHANGE_COST} silver).`,
    ],
  },
  {
    n: 28,
    day: '2026-09-27',
    lines: () => {
      const main = (CLASSES.find((c) => c.id === 'terraformer')?.main ?? '').replace(/_/g, ' ');
      return [
        `Changed: Terraformer from a tree to perks: ${num(PERK_TIER_AT.length)} perk tiers of ${num(PERKS_PER_TIER)}; perk tier 1 with the trade, the rest at ${listed(PERK_TIER_AT.slice(1).map(String))} ${main}. Pick 1 of ${num(PERKS_PER_TIER)} per perk tier in the Trades window; each card states its effect.`,
        'Removed: Terraformer tree nodes. Dropping the trade (silver or Bauble of Regret) drops its perks too.',
      ];
    },
  },
  {
    n: 29,
    day: '2026-09-27',
    lines: () => {
      const main = (CLASSES.find((c) => c.id === 'miner')?.main ?? '').replace(/_/g, ' ');
      return [
        `Changed: Miner from a tree to perks: ${num(PERK_TIER_AT.length)} perk tiers of ${num(PERKS_PER_TIER)}; perk tier 1 with the trade, the rest at ${listed(PERK_TIER_AT.slice(1).map(String))} ${main}. Added action: Pan, on sand with water at a corner.`,
        'Removed: Miner tree nodes.',
      ];
    },
  },
  {
    n: 30,
    day: '2026-09-27',
    lines: () => [
      'Changed: Terraformer perks set in final perk tiers. Taken perks that moved perk tier are cleared to choose again in the Trades window; Wader and Dredger unmoved.',
    ],
  },
  {
    n: 31,
    day: '2026-09-27',
    lines: () => [
      'Changed: Miner perks set in final perk tiers. Taken perks that moved are cleared to choose again in the Trades window; only Pan unmoved.',
    ],
  },
  {
    n: 32,
    day: '2026-09-27',
    lines: () => {
      const main = (CLASSES.find((c) => c.id === 'mason')?.main ?? '').replace(/_/g, ' ');
      return [
        `Changed: Mason from a tree to perks: ${num(PERK_TIER_AT.length)} perk tiers of ${num(PERKS_PER_TIER)}; perk tier 1 with the trade, the rest at ${listed(PERK_TIER_AT.slice(1).map(String))} ${main}. Added actions: Repoint (relay a finished stone wall in another stone) and Raise the rock with rubble.`,
        'Removed: Mason tree nodes.',
      ];
    },
  },
  {
    n: 33,
    day: '2026-09-27',
    lines: () => [
      `Added: What it offers on every Trades window card: the trade's ${num(PERK_TIER_AT.length)} perk tiers, or its rite and tree, before taking it up, with each perk tier's skill threshold and your skill. Solo: shown for every trade.`,
      'Added: confirmation on taking up a trade or a perk, stating what is lost, the cost and which perks close.',
    ],
  },
  {
    n: 34,
    day: '2026-09-27',
    lines: () => {
      const main = (CLASSES.find((c) => c.id === 'carpenter')?.main ?? '').replace(/_/g, ' ');
      return [
        `Changed: Carpenter from a tree to perks: ${num(PERK_TIER_AT.length)} perk tiers of ${num(PERKS_PER_TIER)}; perk tier 1 with the trade, the rest at ${listed(PERK_TIER_AT.slice(1).map(String))} ${main}. Removed: Carpenter tree nodes.`,
        'Added: some perks are built into the item for any later owner: chest capacity, boat or wagon speed, bow damage or range. Examine shows what its maker put in.',
        'Fixed: on an island the bench wears its tool each action (saws, carving knives, mallets, files, etc.), as solo.',
      ];
    },
  },
  {
    n: 35,
    day: '2026-09-27',
    lines: () => {
      const barrel = (material: string): number =>
        liquidCapacity({ id: 0, x: 0, y: 0, sx: 0, sy: 0, kind: 'barrel', ql: 20, items: [], material } as PlacedFurniture);
      return [
        `Fixed: island barrel capacity by wood: oak ${barrel('Oak')} L, pine ${barrel('Pine')} L (was ${furnitureDef('barrel').liquid} for all). An overfull barrel keeps its contents and takes no more until below the line.`,
        'Fixed: island capacity of some pieces off by 1 (mostly rare ones and pine, willow or fig); now exactly what the window shows.',
      ];
    },
  },
  {
    n: 36,
    day: '2026-09-27',
    lines: () => {
      const main = (CLASSES.find((c) => c.id === 'smith')?.main ?? '').replace(/_/g, ' ');
      const hauberk = { uid: 0, id: 'chain_hauberk', ql: 50, dmg: 0, count: 1, extra: 'Iron' } as Item;
      return [
        `Changed: Smith from a tree to perks: ${num(PERK_TIER_AT.length)} perk tiers of ${num(PERKS_PER_TIER)}; perk tier 1 with the trade, the rest at ${listed(PERK_TIER_AT.slice(1).map(String))} ${main}. Removed: Smith tree nodes.`,
        'Added: some perks are built into the item: blade damage or hit chance (for whoever fits the weapon), chain and plate deflection, mould life, and 1 quench of a weapon or tool for quality. Examine shows what its maker put in.',
        `Added: Ingots perk: ${INGOT_LUMPS} lumps into a bar weighing ${frac(INGOT_WEIGHT)} as much, counted as ${num(INGOT_LUMPS)} lumps at smelter, anvil, bench and file.`,
        `Fixed: island melting rounds .5 up, as solo: chain hauberk returns ${meltLumps(hauberk, 1)} lumps, not 1 fewer.`,
      ];
    },
  },
  {
    n: 37,
    day: '2026-09-27',
    lines: () => {
      const main = (CLASSES.find((c) => c.id === 'forester')?.main ?? '').replace(/_/g, ' ');
      return [
        `Changed: Forester from a tree to perks: ${num(PERK_TIER_AT.length)} perk tiers of ${num(PERKS_PER_TIER)}; perk tier 1 with the trade, the rest at ${listed(PERK_TIER_AT.slice(1).map(String))} ${main}. Removed: Forester tree nodes.`,
        'Added actions: Coppice (grown tree back to young, yields its logs, tree stays); Tap Resin (tar from a living pine, once a day); Clear Brush (bushes and reeds around a tile at once).',
        'Changed: Look on a partly cut tree counts strokes left at your felling rate.',
      ];
    },
  },
  {
    n: 38,
    day: '2026-09-27',
    lines: () => {
      const main = (CLASSES.find((c) => c.id === 'farmer')?.main ?? '').replace(/_/g, ' ');
      return [
        `Changed: Farmer from a tree to perks: ${num(PERK_TIER_AT.length)} perk tiers of ${num(PERKS_PER_TIER)}; perk tier 1 with the trade, the rest at ${listed(PERK_TIER_AT.slice(1).map(String))} ${main}. Removed: Farmer tree nodes.`,
        'Added actions: Sow a patch, Tend a patch, Harvest a patch: every field in the square around the chosen one, as 1 action.',
        'Changed: a crop keeps the growth pace it was sown at, whoever harvests it.',
        'Fixed: island farming wildermon brought home the seed and left the harvest; now the reverse.',
      ];
    },
  },
  {
    n: 39,
    day: '2026-09-27',
    lines: () => {
      const main = (CLASSES.find((c) => c.id === 'cook')?.main ?? '').replace(/_/g, ' ');
      return [
        `Changed: Cook from a tree to perks: ${num(PERK_TIER_AT.length)} perk tiers of ${num(PERKS_PER_TIER)}; perk tier 1 with the trade, the rest at ${listed(PERK_TIER_AT.slice(1).map(String))} ${main}. Removed: Cook tree nodes.`,
        'Added: Cook perks stay in the dish for whoever eats it. Fixed: island Examine shows what the maker put in, as solo.',
        'Added: broth, spirit and offal bait, for a Cook who has learned them.',
        'Fixed: part of a pile set down on an island keeps maker marks, rarity, colour and blessing.',
      ];
    },
  },
  {
    n: 40,
    day: '2026-09-27',
    lines: () => {
      const main = (CLASSES.find((c) => c.id === 'tailor')?.main ?? '').replace(/_/g, ' ');
      const tent = furnitureDef('tent');
      const mends = perksOf('tailor').find((p) => p.fx.patch_item)?.fx.patch_item ?? 0;
      const sprouts = perksOf('forester').find((p) => p.fx['count:sprout']);
      return [
        `Changed: Tailor from a tree to perks: ${num(PERK_TIER_AT.length)} perk tiers of ${num(PERKS_PER_TIER)}; perk tier 1 with the trade, the rest at ${listed(PERK_TIER_AT.slice(1).map(String))} ${main}. Removed: Tailor tree nodes.`,
        `Added: tent (${billWords(tent.bill, true)}): a night's rest ${percent((tent.bed ?? 0) / (furnitureDef('bed').bed ?? 1))} of a bed's; `
          + `and Patch: −${mends} damage on a cloth or leather piece for 1 cloth or 1 leather. Both for a Tailor who has learned them.`,
        'Fixed: offline, every fail-chance perk works as on an island (was only the anvil\'s), and so does Nothing Wasted (a failed craft keeps its inputs).',
        ...(sprouts ? [`Fixed: offline, ${sprouts.name} gives its ${num(sprouts.fx['count:sprout'])} sprouts, as on an island.`] : []),
        'Fixed: offline, an action that makes more than its recipe count reports how many, as on an island.',
      ];
    },
  },
  {
    n: 41,
    day: '2026-09-27',
    lines: () => {
      const main = (CLASSES.find((c) => c.id === 'herdsman')?.main ?? '').replace(/_/g, ' ');
      const kept = perksOf('herdsman').filter((p) => Object.keys(p.fx).some((k) => k.startsWith('kept:'))).map((p) => p.name);
      return [
        `Changed: Herdsman from a tree to perks: ${num(PERK_TIER_AT.length)} perk tiers of ${num(PERKS_PER_TIER)}; perk tier 1 with the trade, the rest at ${listed(PERK_TIER_AT.slice(1).map(String))} ${main}. Removed: Herdsman tree nodes.`,
        `Fixed: ${listed(HUSBANDRY_ACTIONS.map((a) => a.label))} were missing from the wildermon menu.`,
        `Added: ${listed(kept)} apply to every wildermon the Herdsman keeps, island and offline. On a change of hands it takes its new keeper's.`,
      ];
    },
  },
  {
    n: 42,
    day: '2026-09-27',
    lines: () => {
      const main = (CLASSES.find((c) => c.id === 'naturalist')?.main ?? '').replace(/_/g, ' ');
      return [
        `Changed: Naturalist from a tree to perks: ${num(PERK_TIER_AT.length)} perk tiers of ${num(PERKS_PER_TIER)}; perk tier 1 with the trade, the rest at ${listed(PERK_TIER_AT.slice(1).map(String))} ${main}. Removed: Naturalist tree nodes.`,
        `Added (made by a Naturalist who has learned them, usable by anyone): herb tea: +${percent(itemDef('herb_tea').stamina ?? 0)} stamina a cup; `
          + `salve: a dressed wound cannot go bad; tincture: ${TINCTURE_NAMES} each action ${percent(TINCTURE_BONUS)} faster for ${dur(TINCTURE_SECONDS)}.`,
        'Added: Field Medic: dress another person\'s wounds from their menu.',
        'Fixed: island hives fill with honey and beeswax for Vesp kept on their settlement, as offline. First island source of beeswax.',
        'Fixed: offline, a rare item made at a bench made its whole stack rare.',
      ];
    },
  },
  {
    n: 43,
    day: '2026-09-27',
    lines: () => {
      const main = (CLASSES.find((c) => c.id === 'fisher')?.main ?? '').replace(/_/g, ' ');
      const smoked = perksOf('fisher').find((p) => p.name === 'Smoke Fish')?.fx['rot:trout'] ?? 1;
      return [
        `Changed: Fisher from a tree to perks: ${num(PERK_TIER_AT.length)} perk tiers of ${num(PERKS_PER_TIER)}; perk tier 1 with the trade, the rest at ${listed(PERK_TIER_AT.slice(1).map(String))} ${main}. Removed: Fisher tree nodes.`,
        `Added (for a Fisher who has learned them): smoked fish: rot ${percent(1 - smoked)} slower anywhere; fish pond (on your settlement): `
          + `stocks 1 fish every ${dur(POND_EVERY)} up to ${furnitureDef('fish_pond').pond}; Fishing Journal: Examine on water lists what it holds for you.`,
        'Changed: a net clicked on water out of reach goes into the deepest water within whole tiles of its reach, as a line does. Fixed: island searched further than offline.',
        'Fixed: offline, rod, net and digging for worms gave tool wear ×2 the island\'s; now as on an island.',
        'Fixed: offline, a net\'s deep fish came all or none; now each deep fish in a haul has its own chance, as on an island.',
      ];
    },
  },
  {
    n: 44,
    day: '2026-09-27',
    lines: () => {
      const main = (CLASSES.find((c) => c.id === 'mender')?.main ?? '').replace(/_/g, ' ');
      return [
        `Changed: Mender from a tree to perks: ${num(PERK_TIER_AT.length)} perk tiers of ${num(PERKS_PER_TIER)}; perk tier 1 with the trade, the rest at ${listed(PERK_TIER_AT.slice(1).map(String))} ${main}. Removed: Mender tree nodes.`,
        `Added (made by a Mender who has learned them, usable by anyone): repair kit: −${KIT_MEND} damage on anything, anywhere, no quality loss; sealant: 1 item stops decaying wherever left.`,
        'Changed: action-time perks apply after the minimum action time, not before; each now gives its stated amount at any skill, and Quick Hands shortens a Repair action.',
        `Fixed: island lowest-quality work post lasts ${dur(POST_LIFE_MIN)}, as offline (fell in well under 1/2 of that).`,
        'Fixed: offline, brushing a wildermon wears the brush by its quality, as on an island.',
        `Added: hammer: head cast in a hammer head mould at a smelter, trued on an anvil, fitted to a shaft. `
          + `Now makeable: ${listed(RECIPES.filter((r) => r.tool === 'hammer').map((r) => itemDef(r.result).name.toLowerCase()))}.`,
      ];
    },
  },
  {
    n: 45,
    day: '2026-09-27',
    lines: () => {
      const main = (CLASSES.find((c) => c.id === 'artisan')?.main ?? '').replace(/_/g, ' ');
      const wheel = furnitureDef('potters_wheel').pace;
      const more = GEMS.filter((g) => g.perk);
      return [
        `Changed: Artisan from a tree to perks: ${num(PERK_TIER_AT.length)} perk tiers of ${num(PERKS_PER_TIER)}; perk tier 1 with the trade, the rest at ${listed(PERK_TIER_AT.slice(1).map(String))} ${main}. Removed: Artisan tree nodes; no craft trade has a tree.`,
        `Added (for an Artisan who has learned them): gold circlet (head slot): ${num(CIRCLET_STONES)} stones at ${frac(CIRCLET_SHARE)} of a ring's each, set by anyone; amphora: holds ${itemDef('amphora').holds} of 1 food or drink; potter's wheel: pottery time per action −${percent(1 - (wheel?.by ?? 1))} for anyone within ${wheel?.reach} tiles; glaze of ${num(GLAZE_ASH)} lot of ashes: pot never decays; book on a skill the writer has at ${TRADE_BOOK_AT}: teaches that skill.`,
        `Added: More Stones: ${num(more.length)} more stones in rock: ${listed(more.map((g) => g.name.toLowerCase()))}.`,
        'Added: Jewellery heading in the crafting window (ring, pendant, focus were only on the stone menu).',
        'Fixed: pot, bowl or jar kept its maker\'s perks through the kiln.',
        'Fixed: island bags left lying rot their contents at the % of weather the bag keeps off (did not rot); a set-down item is no longer charged for time spent in a pack.',
      ];
    },
  },
  {
    n: 46,
    day: '2026-09-27',
    lines: () => [
      `Fixed: island relic and bauble restoring trains Restoration: a full action's gain on success, ${percent(TRY_LEARN)} of 1 action's on failure, as offline (trained only Mind Logic).`,
    ],
  },
  {
    n: 47,
    day: '2026-09-27',
    lines: () => [
      `Fixed: island Wildermon window lists only wildermon you tamed (listed every tame one near you). "${ALL_GOALS.find((g) => g.id === 'five')?.text}", post-assignable wildermon and herd best trait rarity count only yours.`,
    ],
  },
  {
    n: 48,
    day: '2026-09-27',
    lines: () => {
      const kinds = ['rabba', 'woola', 'noot', 'seavic', 'vola', 'dowse', 'cudda', 'bura', 'sappa', 'cobbe', 'quarra', 'embra', 'bogga', 'wadd', 'holla', 'middun', 'sedra', 'warda', 'quill', 'lume'];
      return [
        `Added: animated models (stand, walk, run, forage) for ${num(kinds.length)} wildermon: ${listed(kinds.map((k) => SPECIES[k]?.name ?? k))}. Others unchanged for now.`,
        'Changed: a modelled wildermon is clickable anywhere on it; name and health shown above it.',
      ];
    },
  },
  {
    n: 49,
    day: '2026-09-27',
    lines: () => {
      const steps = RARITIES.map((_, s) => s).slice(1);
      const name = (s: number): string => RARITIES[s].name;
      // A step's figure against each of the three, the first saying what it is for.
      const each = (fig: (s: number) => string): string =>
        listed(steps.map((s, i) => `${fig(s)} for ${i === 0 ? `${article(name(s))} ${name(s)} one` : `${article(name(s))} ${name(s)}`}`));
      // How far a multiplier moves a figure, as a card rounds it (`cardPct`), without its sign.
      const by = (m: number): string => cardPct(m).slice(1);
      // How much of what a wild roll gives it comes out better than common.
      const better = (s: number): string => {
        const n = Math.round(100 * betterThanCommon(husbandryOdds(0, s)));
        return n === 100 ? 'all' : `${n}%`;
      };
      const up = BLOOD_CHANNELS.filter((ch) => ch.up).map((ch) => ch.label);
      const down = BLOOD_CHANNELS.filter((ch) => !ch.up).map((ch) => ch.label);
      return [
        `Added: rare wildermon, at made-item odds: ${listed(steps.map((s) => `1 in ${num(Math.round(1 / rarityChance(s)))} ${name(s)}`))}. Never monsters. Newborns' rarity set by chance at birth regardless of parents.`,
        `Added: size vs its kind: ${name(1)} ${mult(RARITIES[1].size)}, ${listed(steps.slice(1).map((s) => `${name(s)} ${mult(RARITIES[s].size)}`))}.`,
        `Added: ${listed(up)} up by ${each((s) => by(RARITIES[s].blood))}; ${listed(down)} down by ${each((s) => by(1 / RARITIES[s].blood))}.`,
        `Added: wild-caught trait odds: better than common for ${listed(steps.map((s) => `${better(s)} of ${article(name(s))} ${name(s)} one's`))}; ordinary: ${better(0)}.`,
        'Added: rare wildermon shimmer in their rarity colour; card, Wildermon window and Look it over state rarity and its effect.',
      ];
    },
  },
  {
    n: 50,
    day: '2026-09-27',
    lines: () => {
      // The youngest a tree is with timber in it, along the stages it grows through from the first.
      let age = TREE_AGES.find((a) => !TREE_AGES.some((b) => b.next === a.id));
      while (age && !age.logs && age.next !== null) age = TREE_AGES.find((a) => a.id === age?.next);
      return [
        `Changed: a tree dying of age leaves grass, not a stump. Stumps only from felling a tree with timber: ${(age?.name ?? 'Young').toLowerCase()} or older.`,
        `Changed: every stump goes at the next ${RESET}, for everyone. Fixed: seen stumps stayed until reload.`,
      ];
    },
  },
  {
    n: 51,
    day: '2026-09-27',
    lines: () => {
      const m = (units: number): string => (units / 10).toFixed(1);
      return [
        `Added: springs: dig with a shovel at the bottom of a hollow holding ${m(SPRING_DEPTH)} m of water or more. Fills to the lowest rim point at ${m(FILL_RATE)} m/s, at any height.`,
        `Added: a full pond spills from that point downhill to the next hollow, and on to the sea, up to ${num(CHAIN_MOST)} ponds. A drop of ${m(FALL_DROP)} m or more is a waterfall.`,
        `Added: ponds are water for everything: buckets, fishing, no building; swim deeper than ${m(SWIM_DEPTH)} m. A rim notch lowers it to the notch; filling the hollow or Stop up the spring removes the water.`,
        `Added: at most ${num(SPRINGS_EACH)} springs each. Off a settlement only the digger may stop one; on one, only those allowed to shape its ground may dig or stop any.`,
        `Added: pools: dig in a poured foundation with a pickaxe: water ${m(POOL_DEPTH - POOL_LIP)} m deep, ${m(POOL_LIP)} m below the slab top, spring or not; adjacent pools of the same top are one. A spring in one spills over its lowest edge to the ground or a lower pool. Filling a pool: ${POOL_FILL} concrete.`,
      ];
    },
  },
  {
    n: 52,
    day: '2026-09-27',
    lines: () => [
      'Changed: foundations set out on bare rock only (plain stone, seam or ore); dig soil off every corner first. Not offered on grass, dirt or a tile with soil on any corner.',
      'Changed: a poured slab stays packed ground when a shared corner is dug or mined. Existing foundations unchanged.',
    ],
  },
  {
    n: 53,
    day: '2026-09-28',
    lines: () => [
      'Changed: crafting window row for spindle/loom work: "spindle: set yours down" if carried, "stand at one" if not. Yarn and cloth need one set down on the ground (Set furniture down); one in the pack does not count.',
    ],
  },
  {
    n: 54,
    day: '2026-09-28',
    lines: () => [
      `Changed: fragments and tarnished baubles cannot be repaired before restoring (Repair, repair kit, Mend, workers). Damage only rises; at ${DAMAGE_MAX} it breaks.`,
      `Changed: Restore allowed at any damage below that (was refused when badly damaged). Failure: +${RESTORE_HARM} to ${RESTORE_HARM + RESTORE_HARM_SPREAD} damage on every piece.`,
    ],
  },
  {
    n: 55,
    day: '2026-09-28',
    lines: () => {
      const keep = TREE_DEFS.filter((_, i) => evergreen(i)).map((t) => t.name.toLowerCase());
      const bloom = (['deep pink', 'pale pink', 'white'] as const).map((family) =>
        `${family} on ${listed(TREE_DEFS.filter((t) => BLOOMS[t.fruit ?? '']?.family === family).map((t) => t.name.toLowerCase()))}`);
      return [
        `Added: seasonal foliage. Evergreen: ${listed(keep)}. Others leaf over the first ${num(LEAF_DAYS)} days of spring, colour over the first ${num(TURN_DAYS)} days of autumn, drop over the last ${num(SHED_DAYS)}, bare in winter. Roses and thorns likewise; lavender evergreen.`,
        `Added: fruiting-age trees flower all ${num(SHORT_SEASON_DAYS)} days of spring (${bloom.join('; ')}), shedding petals on wind and water. Roses and lavender flower from spring day ${BUSH_FLOWER_FROM} to end of summer. Visual only; yields unchanged.`,
        `Added: butterflies at flowers by day, dragonflies over ponds, pools and streams morning to dusk, fireflies over grass near trees and water at night: ${lifeSeasons()}. Visual only.`,
      ];
    },
  },
  {
    n: 56,
    day: '2026-09-28',
    lines: () => {
      const bill = (id: string): string => billWords((RECIPE_BY_ID.get(`make_${id}`)?.inputs ?? []).map((i) => [i.item, i.count ?? 1] as const), true);
      return [
        `Added: garden steps on packed dirt, slope ${metres(STEPS_LEAST)} to ${metres(STEPS_MOST)} m, end corners within ${metres(STEPS_TWIST)} m. Stone (trowel, masonry): ${STONE_STEPS_BILL}; timber (mallet, carpentry): ${TIMBER_STEPS_BILL}.`,
        `Added: steps standable at slope up to ${metres(STEPS_MOST)} m (bare ground ${metres(MAX_STAND)} m); steps on or off ignore the ${metres(MAX_STEP)} m tile-centre limit. No carts or wagons. Pickaxe removal returns ${frac(STEPS_BACK)}: ${num(stepsBack(STEPS_SLABS))} of ${num(STEPS_SLABS)} slabs and ${num(stepsBack(STEPS_BRICKS))} of ${num(STEPS_BRICKS)} bricks, or ${num(stepsBack(STEPS_PLANKS))} of ${num(STEPS_PLANKS)} planks.`,
        `Added: rose arch (carpentry: ${bill('rose_arch')}) and stone rose arch (masonry: ${bill('stone_rose_arch')}), walk-through over a path. ${ROSES_RULE}`,
        `Added: flagpole (tailoring: ${bill('flagpole')}); flag and banner cloth follow the wind. Both take dye; on a settlement they show its device, 1 of ${num(DEVICE_COUNT)}, chosen by settlement name. Fixed: banners and sails set down lost their dye.`,
      ];
    },
  },
  {
    n: 57,
    day: '2026-09-28',
    lines: () => [
      'Added: Collect dirt (shovel, on dirt): fills a shovel; tile type and height unchanged, as on sand and clay.',
      `Added: Cut moss on moss: ${num(MOSS_PER_CUT)} moss, tile stays moss. Plant moss on dirt with ${MOSS_PLANT} moss in pack: tile becomes moss.`,
    ],
  },
  {
    n: 58,
    day: '2026-09-28',
    lines: () => {
      // As it was then: a pot of orange, before dye was mixed (`LEGACY_DYES`).
      const dye = LEGACY_DYES.find((d) => d.id === 'wildflowers');
      return [
        `Added: trail wear on ${listed([...WEARS].map((t) => GROUNDS[t as Ground].name.toLowerCase()))}: +1 per step on foot, up to ${WEAR_MOST}; at ${WEAR_TRAIL} it is a bare-earth trail (as packed dirt). −${WEAR_FALL} per tile at each ${RESET}; at zero it reverts. Paved, built, tilled or planted ground never wears.`,
        `Added: grass flowers in ${listed(FLOWER_SEASONS)}: up to ${num(FLOWER_MOST.summer)} clumps a tile in summer, ${num(FLOWER_MOST.spring)} in spring. Pick flowers: 1 wildflower per clump at your foraging quality; none again until next spring.`,
        `Added: wildflower dye: ${billWords([[dye?.from ?? 'wildflowers', dye?.count ?? 1], ['lye_bucket', 1]], true)} boil into ${num(LEGACY_POTS)} pots of ${dye?.word ?? 'orange'}, alchemy ${dye?.difficulty ?? 0}.`,
        'Changed: steep rock drawn with overhanging grass, moss on the upper face, ferns in cracks, damp at the foot over water. Visual only.',
      ];
    },
  },
  {
    n: 59,
    day: '2026-09-28',
    lines: () => {
      const [clear, scrub] = GREEN_ACTIONS;
      const a = (name: string): string => `${article(name)} ${name.toLowerCase()}`;
      return [
        `Added: greening. Ivy on finished stone or brick walls, fences and half walls; moss on paving, poured foundations, ${listed([...FURNITURE.filter((f) => f.mossy).map((f) => a(f.name)), a(STONE_ARCH.name)])}. Bare when made; greens daily for ${GREEN_DAYS} days. Everything existing starts bare today.`,
        `Added: shown amount = days / ${GREEN_DAYS} × pace: ${GREEN_SUN} on tops and south/east faces, ${+(GREEN_SUN + GREEN_SHADE).toFixed(2)} on north/west faces, up to +${GREEN_WET} beside water.`,
        `Added: ${clear.label} (${a(itemDef(clear.tool ?? '').name)}): 1 wall side, every storey; ${scrub.label} (${a(itemDef(scrub.tool ?? '').name)}): paving, foundation, statue or arch. Both reset to bare. On a settlement builders only; elsewhere anyone. Island keeps the clock for everyone.`,
        'Fixed: island bridges were invisible and uncrossable; now drawn and walkable for everyone.',
      ];
    },
  },
  {
    n: 60,
    day: '2026-09-28',
    lines: () => {
      const rotation = perksOf('farmer').find((p) => 'rotate:plant_seed' in p.fx)?.name ?? 'Crop Rotation';
      return [
        `Added: seasonal crop growth: ${listed(SEASONS.map((s) => `${growthWords(SEASON_GROWTH[s])} in ${s}`))}. Winter: holds its growth stage until spring; no dying; sowing, tending and harvesting still allowed.`,
        `Added: planter: 1 crop ${growthWords(PLANTER_GROWTH)} every season incl. winter, indoors or out (cotton growth stage: ${dur(CROPS.cotton.stageSeconds / PLANTER_GROWTH)}). Sow, tend, harvest, pull up from its menu; same seeds, growth stages, yields as a field; Farmer sow/harvest perks apply; ${rotation} reads the planter's last crop. Cannot be picked up while growing; empty: bare earth.`,
        'Added: hovering over or sowing a field or planter shows real time to the next growth stage; a wintering field shows the wait for spring.',
        'Changed: Bounty affects crops (incl. planters) on your own settlements only, not others\'.',
      ];
    },
  },
  {
    n: 61,
    day: '2026-09-28',
    lines: () => {
      const lily = WATER_PLANT_BY_ID.get('lily') as WaterPlantDef;
      const lotus = WATER_PLANT_BY_ID.get('lotus') as WaterPlantDef;
      const dyeWord = (item: string): string => LEGACY_DYES.find((d) => d.from === item)?.word ?? '';
      const metres = (units: number): string => (units / 10).toFixed(1);
      return [
        `Added: stepping stones: trowel and ${num(STONES_SLABS)} cut slab a tile, in water ${metres(STONES_DEPTH)} m deep or less (sea edge, pond, stream; swimming from ${metres(SWIM_DEPTH)} m). Walk speed ${percent(TILE_DEFS[TileType.SteppingStones].speed / TILE_DEFS[TileType.Grass].speed)} of grass; no wading or swimming. Take up the stepping stones returns the slab.`,
        `Added: tiered fountain (masonry: ${pieceBill('fountain')}): a well in every rule: ${(WELL_TRICKLE * 60).toFixed(1)} to ${((WELL_TRICKLE + WELL_TRICKLE_QL) * 60).toFixed(1)} L/min by quality, up to ${furnitureDef('fountain').well} L; fill a bucket or skin, or drink.`,
        `Added: botanizing at the water's edge finds ${itemDef(lily.from).name.toLowerCase()}s and ${itemDef(lotus.from).name.toLowerCase()}. Plant in still water ${metres(WATER_PLANT_SHALLOWEST)} to ${metres(WATER_PLANT_DEEPEST)} m deep; roots in ${dur(WATER_ROOTING)}; seasons: water lily ${yearSays(lily)}, lotus ${yearSays(lotus)}. Dye: water lily flowers ${dyeWord(lily.flower)}, lotus flowers ${dyeWord(lotus.flower)}. Seed head: ${num(lotus.seedCount ?? 0)} lotus seeds (eat or plant).`,
      ];
    },
  },
  {
    n: 62,
    day: '2026-09-28',
    lines: () => [
      `Changed: island year day from 1 real day to 1 clock day and night, ${dur(DAY_SECONDS)}. Season: ${num(SHORT_SEASON_DAYS)} days, ${dur(SHORT_SEASON_DAYS * DAY_SECONDS)}. Year: ${num(SEASONS.length * SHORT_SEASON_DAYS)} days, ${dur(SEASONS.length * SHORT_SEASON_DAYS * DAY_SECONDS)}. Shown beside your position: "Spring, day 2 of ${SHORT_SEASON_DAYS}".`,
      `Changed: seasonal timings now in those days: leaf over the first ${num(LEAF_DAYS)} days of spring, turn over the first ${num(TURN_DAYS)} of autumn, drop over the last ${num(SHED_DAYS)}; roses and lavender flower from spring day ${BUSH_FLOWER_FROM}; arch roses, days after set down: leaf ${num(ROSE_LEAFY)}, bud ${num(ROSE_BUD)}, flower ${num(ROSE_FLOWER)}; water plants root in ${dur(WATER_ROOTING)}; field crops ${listed(SEASONS.map((s) => `${growthWords(SEASON_GROWTH[s])} in ${s}`))}, ${dur(SHORT_SEASON_DAYS * DAY_SECONDS)} each.`,
    ],
  },
  {
    n: 63,
    day: '2026-09-28',
    lines: () => [
      `Changed: last of a trade's ${num(PERK_TIER_AT.length)} perk tiers from 100 to ${PERK_TIER_AT[PERK_TIER_AT.length - 1]} main skill. Perk tiers after the first: ${listed(PERK_TIER_AT.slice(1).map(String))}.`,
    ],
  },
  {
    n: 64,
    day: '2026-10-02',
    lines: () => {
      const bill = (b: { needed: Record<string, number> }): string => billWords(Object.entries(b.needed), true);
      return [
        `Added: jetties: Plan jetty floor on an upper storey: floor ${num(JETTY_REACH)} tile past the footprint over open ground on your settlement, on a finished full-height wall of the storey below on the shared side (door counts; half wall, fence, railing do not). Costs as an inside floor; no heavier than the lightest wall or column under it carries. A storey above a jettied room floors out over it on the room's walls. Ground under a jetty stays open: no plans, planting, bridges, aqueducts, digging or raising; walkable. On piers, storeys count from the deck.`,
        'Added: a jetty open to its storey is part of it; walls, railings or columns on its outer sides close the storey. Roof over it on walls or columns only: each outer side needs a finished full-height wall, or at each end a finished column or full-height wall end (railings carry nothing). The supporting wall, and a wall whose end alone carries an end, stay up until columns take the roof; a column alone carrying an end stays until that side is walled or the roof is off. Behind a wall or door it is a balcony: outside the storey, no roof.',
        'Added: jetty and column rows name their storey (Jetty of ‹house› (storey N), Plan column (‹corner› corner, storey N)). Every building action goes to the storey you are working on, island too; lower storeys workable from above; ground-floor stairs under an upper storey say to work on storey 2 or above. A finished full-height wall with a same-side wall of the storey above (once any of its materials are in) stays up until that wall comes down or a finished column at each end carries the side; likewise the last wall a jetty rests on.',
        `Added: railings: wall type for open edges of upper storeys, jetties, balconies, finished pier decks and finished flat roofs (Plan railing round the roof); never on the ground. ${capital(frac(WALL_TYPE_BY_ID.get('railing')?.factor ?? 0))} of a solid wall's bill (log: ${bill(typeBill('log', 'railing'))}); ${metres(RAILING_HEIGHT * WALL_HEIGHT)} m high; see-through; finished: blocks crossing.`,
        `Added: columns: Plan column on a tile corner of a building, ${frac(COLUMN_SHARE)} of a solid wall's bill (log ${bill(columnBill('log'))}, marble ${bill(columnBill('marble'))}); on the ground, a finished pier deck or a finished floor of its storey; never glass; on piers no heavier than the lightest deck (which must carry the heaviest column and wall). On the ground it takes each adjacent tile's corner spot: no furniture, smelter or kiln there, no column over furniture there. A side with a finished column at each end is closed like a wall: columns on every corner plus a roof = open hall; a row = colonnade; storeys can rise on them. Counts toward what may be raised over it and storey count as a wall of its material. Comes down only if it does not carry a side with no full-height wall under a floor or roof; the refusal names that side. Drawn as a pilaster where walls meet.`,
        `Added: under a roof on columns, decay ${frac(INDOORS_DECAY)} of outdoors, as in a room. Beds there count as outdoors: indoor rest (×${INDOORS_REST} of outdoors) needs walls all round.`,
        'Added: Examine on a tile names any jetty or balcony over it, its corner columns, and what an unfinished one needs.',
      ];
    },
  },
  {
    n: 65,
    day: '2026-10-02',
    lines: () => {
      const full = deckBill('plank', PIER_DROP).needed;
      return [
        `Added: piers. A tile not level and dry at floor height (sloped, lower than the floor, or under at most ${metres(PIER_WATER)} m of water) is built on piers: a level deck at floor height on braced timber posts, or stone piers with arches, up to ${metres(PIER_DROP)} m above the tile's lowest corner. Level dry ground at floor height still packed and built on directly.`,
        `Added: deck height: highest corner of the first tile, ${metres(PIER_CLEAR)} m above water, or a level you took, whichever is highest; every added tile must lie wholly under it. Plan deck on each: floor materials plus ${frac(10 / PIER_WALL_DROP)} of a solid wall per metre of drop, each item rounded up (plank deck ${metres(PIER_DROP)} m up: ${full.plank} planks, ${full.timber} timbers). A deck carries no wall heavier than its material; the lightest deck carries the whole building.`,
        `Added: a built deck is walked at its height, never in the water under it; step on or off from ground up to ${metres(MAX_STEP)} m above or below, +${(CLIMB_PER_LEVEL / 10).toFixed(2)} m per climbing level; bridges land on it as on a bank. Walls, stairs, furniture and crates allowed; no creatures, carts, mounts or boats on or under it. Changed: island and offline, ground under any building cannot be dug at a corner, raised, mined, cut back, packed, cultivated, paved or planted.`,
      ];
    },
  },
  {
    n: 66,
    day: '2026-10-02',
    lines: () => [
      `Added: cellars under a building with all ground-floor walls built: 1 tile at a time, ${num(CELLAR_DEPTH)} slices to a storey, from its ground floor or cellar. Soil: shovel, Digging, 1 dirt a slice. Rock: pickaxe, Mining, 1 slice of that stone's shards, or ore where a vein runs under. Needs ${num(CELLAR_SOIL)} or more soil at every tile corner to begin; floor must be above sea level; not under a poured foundation or pier deck.`,
      `Added: cellar floor decay ${frac(CELLAR_DECAY)} of outdoors (closed room: ${frac(INDOORS_DECAY)}); beds rest as in a closed room. All furniture allowed except open fires, wheeled or floating pieces and those the help lists. Entry: a staircase down or ladder down from the ground floor, climbed from its foot only; no towing or mounts. A neighbouring building's cellar is a separate room. Dark at all hours except carried light and, by day, ${num(CELLAR_DAYLIGHT)} tiles of daylight round the entry. Ground above cannot be dug; the building can be unplanned only after the cellar is filled in.`,
    ],
  },
  {
    n: 67,
    day: '2026-10-02',
    lines: () => {
      const shape = roofShapeOf(undefined);
      const tile = listed(Object.entries(floorBill(GLASS_ROOF.id, 'roof', shape).total).map(([id, n]) => `${n} ${materialName(id, n)}`));
      return [
        `Added: glass roof in Plan roof: ${tile} per tile of the ${roofShapeDef(undefined).name.toLowerCase()} roof; mallet, carpentry. Roofs only.`,
        `Added: glasshouse: 1 storey, walled all round at full height, every footprint tile under finished glass. Till ground-floor tiles with no floor planned or slab poured; sow, tend, harvest as fields (Farmer patches, perks and Bounty apply). Growth ${growthWords(GLASSHOUSE_GROWTH)} every season incl. winter: cotton growth stage ${dur(CROPS.cotton.stageSeconds / GLASSHOUSE_GROWTH)} all year. While it has a field: no floor over the field, no roof but glass, no storey above, until Clear the field packs the ground.`,
        `Added: on the last pane or wall, crops carry on from their progress at glasshouse pace; removing a roof tile or wall, or adding a footprint tile, returns them to field pace. A glasshouse is indoors: decay ${frac(INDOORS_DECAY)} of outdoors.`,
      ];
    },
  },
  {
    n: 68,
    day: '2026-10-02',
    lines: () => [
      `Added: aqueducts. Right-click a pool, pond, tiered fountain or hollow that would hold ${metres(SPRING_DEPTH)} m of water: Lead an aqueduct here from the first pond or pool straight out, up to ${num(AQUEDUCT.span)} tiles. Stone arcade, built a span at a time with a trowel, ${billWords(AQUEDUCT.bill, true)} a span. Channel at the head's water height, which must be no lower than the foot's water; everything under it ${metres(CLEARANCE)} m or more below its bed.`,
      `Added: finished, it takes all water spilling over the source's lip or edge: channel ${CHANNEL_WIDE * TILE_METRES} m wide, ${metres(CHANNEL_DEEP)} m deep, ${RUN_RATE} tiles/s, ${AQUEDUCT_FLOW} L/min; the stream it fed dries up. At the foot: a pool spills over its lowest edge; a hollow fills at that rate then spills; a fountain gets +${AQUEDUCT_LPS} L/s on top of its own; bare ground sends it downhill.`,
      'Added: head water below the channel: channel runs dry, and what only it fed dries too. Fountain removed: water runs downhill there; pool filled in: water leaves the foundation over its lowest edge. 1 aqueduct per pond or pool. Not walkable. Demolishing returns 1/2 of its materials.',
      'Added: walk under it through the arches; piers block. Ground under it walks, wears and climbs as before. No planting, building, pouring or digging under a span; none set out over a tree or bush. Takes moss like a stone arch.',
    ],
  },
  {
    n: 69,
    day: '2026-10-02',
    lines: () => {
      const stones = WALL_MATERIALS.filter((m) => m.kind === 'stone' && takesAs(m, { wall: 'portcullis' })).map((m) => m.name.toLowerCase());
      const portReach = gateReach('raise_portcullis');
      const winchReach = gateReach('raise_drawbridge');
      const planWall = ACTION_BY_ID.get('plan_wall');
      const pull = ACTION_BY_ID.get('demolish_bridge')?.label;
      return [
        `Added: portcullis: wall type for a ground-floor wall of ${listed(stones)}; double-door-wide gateway; iron grille ${billWords(WALL_TYPE_BY_ID.get('portcullis')?.fittings ?? [], true)} on top of the stone bill. Raise the portcullis ${gateJobWords('raise_portcullis', goSeconds)}, Lower the portcullis ${gateJobWords('lower_portcullis', goSeconds)}, either side, within ${num(portReach)} tile${portReach === 1 ? '' : 's'} of the adjacent tile. Down: blocks people, carts and wildermon; see-through. Up: everything passes, carts included.`,
        `Added: drawbridge: plank bridge, open ground to open ground, at most ${num(BRIDGES.draw.span)} tiles of deck; ${billWords(BRIDGES.draw.bill, true)} a span, first span +${billWords(BRIDGES.draw.winch ?? [], true)} for gallows and winch. ${winchReach === 0 ? 'On the tile it was set out from' : `Within ${num(winchReach)} tiles of the tile it was set out from`}: Raise the drawbridge ${gateJobWords('raise_drawbridge', goSeconds)}, Lower the drawbridge ${gateJobWords('lower_drawbridge', goSeconds)}. Up: no crossing or seeing past; anyone on the deck drops to what is under it. Down: ${BRIDGES.draw.carts ? 'carts can cross' : 'foot traffic only'}. No winch under a jetty and no jetty over a winch (the gallows exceed a storey).`,
        `Added: hidden door: exactly a solid wall's bill and look. Plan wall, Hidden door plans what everyone else sees as a solid wall: ${dur(goSeconds(planWall?.baseTime ?? 0))}, ${percent(planWall?.stamina ?? 0)} stamina; on finishing it takes ${billWords(HIDDEN_DOOR_IRON, true)} and the padlock becomes its key. Each request is for 1 side of 1 tile, kept only if its plan is started or queued, then while a wall plan on that side is in hand or queued (several can queue). Walking away pauses it and keeps the request; Esc clears it with the queued actions. The next solid wall you plan on that side, on your working storey, is the door. Unused after ${dur(HIDDEN_DOOR_LAPSE)}: lapses, the plan is a solid wall. Key holder and settlement founder see a door with a dashed seam and keyhole; to everyone else it is a solid wall, and their island browser is told nothing else.`,
        'Added: padlock on a portcullis or drawbridge winch: only the key holder and the settlement founder can raise, lower or demolish it.',
        'Changed: every new bridge starts and ends on open ground, a finished pier deck or a finished upper floor (jetties included); never inside a ground-floor building on the ground, never on another bridge\'s end, never through a wall (from a storey or deck it exits through a doorway, archway or open side). No building on a tile a bridge lands on.',
        `Fixed: ${pull} on an island returned an error. Changed: if either end is on a settlement, only its builders may ${pull?.toLowerCase()} (not guests); elsewhere anyone. Within ${PULL_REACH} tiles of the middle of either end. ${ACTION_BY_ID.get('demolish_aqueduct')?.label}: same 2 rules.`,
      ];
    },
  },
  {
    n: 70,
    day: '2026-10-02',
    lines: () => [
      `Added: shop counter: wall type with a market stall, ${frac(counterType()?.factor ?? 1)} of a solid wall's material plus ${countOf('hinge', counterType()?.fittings?.find(([id]) => id === 'hinge')?.[1] ?? 0, true)}. Outside ground-floor wall with no building across it. Holds ${num(COUNTER_HOLDS)} items priced on the Market window's Stall tab; sells to the street only, within ${COUNTER_REACH} tiles of its middle, not to anyone inside a building; silver held in its till for the planner.`,
      `Added: lantern post (${skillOf('make_lamp_post')}) and lantern pillar (${skillOf('make_lamp_pillar')}): fixed lantern; takes candles; light and put out as in hand; at night lights the ground to the lantern's reach, ${num(lanternReach(1))} to ${num(lanternReach(100))} tiles, for everyone. Padlock: lantern removable by key holder only; anyone may light it.`,
      `Fixed: island lantern candles burned at burn speed ${mult(WORLD_PACE)}; now ${dur(candleBurn(1))} to ${dur(candleBurn(100))} by lantern quality. Fixed: a light taken off a brazier or lantern post said "oven". Added: an unlit lantern with no flame near names what lights it: a burning ${flameSources()}.`,
      'Changed: overlapping night light glows draw the stronger, not the sum.',
    ],
  },
  {
    n: 71,
    day: '2026-10-03',
    lines: () => [
      `Changed: swing time per weapon before skill (s): ${[...WEAPONS].filter((w) => !w.ammo).sort((a, b) => a.swing - b.swing).map((w) => `${itemDef(w.id).name.toLowerCase()} ${w.swing}`).join(', ')}; bare hands ${FIST.swing}. Bows draw at their own pace likewise.`,
      `Added: each swing or draw costs ${pct(SWING_WIND)} stamina +${pct(SWING_WIND_KG)} per kg in hand. Below ${pct(TIRED_AT)} stamina swings slow, up to ${pct(TIRED_SLOW)} slower at zero.`,
      `Changed: targets that do not flee fight back on their own clock: hunters and monsters every ${BLOW_HUNTER} s, defensive kinds every ${BLOW_DEFENSIVE} s, others every ${BLOW_PREY} s. They follow up to ${FIGHT_LEASH} tiles from where struck, and give up at ${FIGHT_GIVE_UP} tiles. Removed: a counter-attack check on each of your swings.`,
      `Added: stances (button beside the health bar, or \`): ${FIGHT_STANCES.map((st) => `${FIGHT_STANCE_NAMES[st]}, ${stanceSays(st).toLowerCase()}`).join(' ')}`,
      `Added: left-click a creature after you, or a hunt-on-sight kind, to fight it; you follow up to ${FOLLOW_RANGE} tiles. Tab marks the nearest foe within ${TARGET_RANGE} tiles; Space attacks it. Fights jump to the front of the action queue.`,
      `Changed: walking leaves a fight: a ground click cancels the queued swing-back; a bite while walking does not turn you. A bite turns you to the biter after ${FIGHT_BACK_STILL} s standing still; toggle in Settings, Fighting.`,
    ],
  },
  {
    n: 72,
    day: '2026-10-03',
    lines: () => [
      `Added: heavy blows: ${Object.values(SPECIES).filter((d) => d.heavy).map((d) => `${d.name.toLowerCase()}s`).join(', ')} every ${HEAVY_EVERY} blows. Red ring shows the reach for ${WIND_UP} s; anything inside takes ×${HEAVY_HIT} the damage of a normal blow.`,
      `Added: blow types: ${blowSays('cut')} cut, ${blowSays('pierce')} puncture, ${blowSays('crush')} crush. ${HIDES.map((h) => `${HIDE_NAMES[h]} (${Object.values(SPECIES).filter((d) => d.hide === h).map((d) => d.name.toLowerCase()).join(', ')}): ${hideSays(h)}.`).join(' ')}`,
      `Added: armour by blow type: ${(Object.keys(ARMOUR_VS) as Array<keyof typeof ARMOUR_VS>).map((c) => `${c} ${armourSays(c)}`).join('; ')}.`,
      `Added: maul hit ${sideOf(WEAPON_BY_ID.get('maul')!)}; spear ${sideOf(WEAPON_BY_ID.get('spear')!)}; knife ${sideOf(WEAPON_BY_ID.get('hunting_knife')!)}, never taking the last of it.`,
      `Added: arm or hand wounds slow swings, up to ${pct(ARM_SLOW_MOST)}; leg or foot wounds slow walking, up to ${pct(LEG_SLOW_MOST)}.`,
      `Added: a blow from something other than your target +${pct(FLANK_HIT - 1)}; each extra attacker −${pct(CROWD_BLOCK)} shield block chance; your blow on something fighting someone else +${pct(BLINDSIDE - 1)}.`,
      'Added: target panel (top of screen): health, current action, and its hide versus your weapon\'s blow.',
      'Added: health bars over attackers, a swing-timer ring at your feet, edge arrows to off-screen attackers, red screen edge when struck.',
      'Added: cursor on a hunter not yet after you: dashed ring shows its notice range.',
      `Added: Settings, Fighting, One line for a whole fight (default on): fight skill gains reported once, ${FIGHT_QUIET} s after the last blow, with duration, damage dealt and taken.`,
    ],
  },
  {
    n: 73,
    day: '2026-10-03',
    lines: () => [
      `Added: packs: ${listed(Object.values(SPECIES).filter((d) => d.pack).map((d) => `${d.name.toLowerCase()}s`))} share a home, up to ${PACK_MOST}. When one has your scent, all of its kind within ${PACK_CALL} tiles come; they circle at ${CIRCLE_R} tiles then close in from their sides.`,
      `Added: throwers: ${listed(Object.values(SPECIES).filter((d) => d.throws).map((d) => `${d.name.toLowerCase()}s`))} keep ${KEEP_OFF} tiles off, throw from up to ${THROW_REACH} for ${pct(THROW_HIT)} of a blow's damage; closer than ${KEEP_OFF - BACK_SLACK} they back off at ${pct(BACK_PACE)} of walk speed.`,
      `Added: fleeing: hunters below ${pct(HUNTER_TURN)} health, monsters below ${pct(MONSTER_TURN)}, ${listed(Object.values(SPECIES).filter((d) => d.coward).map((d) => `${d.name.toLowerCase()}s`))} below ${pct(COWARD_AT)}, or ${pct(COWARD_DRAG)} once a nearby one of their kind has fled. Killing or routing a pack leader routs the pack.`,
      `Added: companion orders, any distance: Attack my target (${defaultKey('pet_attack')}, or Set … on it from a wild one's menu), any stance; Fall back (${defaultKey('pet_back')}): no fighting for ${FALL_BACK} s; Guarding you stance: attacks anything hunting you within ${COMPANION_SIGHT} tiles, stays within ${GUARD_RANGE} tiles. Dashed blue line to its target.`,
      `Added: bows while moving: walking continues a draw at ${pct(DRAW_WALK)} speed; keeps loosing while in range. Target line fills with the draw: amber in range, grey out.`,
    ],
  },
  {
    n: 74,
    day: '2026-10-03',
    lines: () => [
      `Added: dodge: each creature hit first has a dodge chance of ${finePercent(DODGE_PER_CONTROL)} per body control point above the starting ${DODGE_FROM}, −${finePercent(DODGE_PER_KG)} per kg of armour worn. Dodged: no damage; trains body control.`,
      `Added: critical hits: ${percent(CRIT_BASE)} +${finePercent(CRIT_PER_SKILL)} per weapon subskill point, crit chance ${mult(CRIT_KNIFE)} with a knife; +${percent(CRIT_HIT - 1)} damage. Shown larger, in orange.`,
      `Added: arrow heads (fletched like arrows): broadhead: bleed ${percent(KNIFE_BLEED)} of the shot/s for ${KNIFE_BLEED_SECS} s; bodkin: +${percent(BODKIN_HIDE - 1)} on thick hide, shell or scales; blunt: crush, interrupts a heavy blow, delays the next by ${STAGGER_MAUL} s. Shoot these first on an arrow stack picks the kind.`,
      `Added: venom: ${listed(Object.values(SPECIES).filter((d) => d.venom).map((d) => `${d.name.toLowerCase()}`))} bites drain ${percent(VENOM_DRAIN)} health/s for ${VENOM_SECS} s while undressed. Armour wear from burns ${mult(BURN_WEAR)} that of other blows.`,
      `Added: threat: a creature switches to your companion when it strikes, after ${THREAT_HOLD} s without damage from you (at once if Guarding you), and back the same way. While on your companion it does not count as on you.`,
      `Added: Consider (Examine on a wild creature, and the target panel): approx. your blows to down it and its blows to down you; Easy (it needs ${mult(CONSIDER_EASY)} the time or more), Hard (under ${percent(CONSIDER_HARD)} as long) or Even.`,
    ],
  },
  {
    n: 75,
    day: '2026-10-04',
    lines: () => [
      `Added: patrons: at ${PATRON_AT} faith take ${PATRONS.map((p) => `${p.name} (${ALIGNMENT_NAMES[p.alignment].toLowerCase()})`).join(', ').replace(/, ([^,]*)$/, ' or $1')}, permanently, in the Faith window. ${SPELLS_PER_TIER} spells at each of ${FAITH_TIER_AT.length} faith tiers (${FAITH_TIER_AT.join(', ')} faith), 1 per faith tier. Blessing's spells next.`,
      `Added: spell bar (bottom middle): ${BAR_SLOTS} slots, ${(['class', 'faith', 'path'] as const).map((s) => `${slotsFor(s)} ${SCHOOL_NAMES[s].toLowerCase()}`).join(', ')}. Click or Shift+number to cast; right-click to assign.`,
      'Changed: Prayer skill renamed Faith. No other change.',
    ],
  },
  {
    n: 76,
    day: '2026-10-04',
    lines: () => [
      `Changed: Faith tiers: ${FAITH_TIER_AT.length}, at ${FAITH_TIER_AT.join(', ')} faith; ${SPELLS_PER_TIER} spells each, 1 taken.`,
      `Added: each spell lists its targets: ${listedOr(SPELL_ONS.map((o) => SPELL_ON_WORDS[o]))}. Right-click a person, creature, item or ground to cast from your bar; anything but you and your carried items within ${SPELL_REACH} tiles.`,
    ],
  },
  {
    n: 77,
    day: '2026-10-04',
    lines: () => [
      `Added: Blessing spells, ${SPELLS_PER_TIER} per faith tier: ${listed(FAITH_SPELLS.filter((s) => s.patron === 'blessing').map((s) => s.name))}. Exact effects in the Faith window.`,
      `Added: patron at ${PATRON_AT} faith; 1 spell per faith tier as faith reaches it; ${num(slotsFor('faith'))} on the spell bar.`,
    ],
  },
  {
    n: 78,
    day: '2026-10-04',
    lines: () => [
      `Added: Justice spells, ${SPELLS_PER_TIER} per faith tier: ${listed(FAITH_SPELLS.filter((s) => s.patron === 'justice').map((s) => s.name))}. Exact effects in the Faith window.`,
      'Added: per faith tier: 1 spell judges its target, 1 keeps order in a fight, 1 measures. Oath binds friends only; Restitution returns your latest grave\'s contents.',
    ],
  },
  {
    n: 79,
    day: '2026-10-04',
    lines: () => [
      `Added: Chaos spells, ${SPELLS_PER_TIER} per faith tier: ${listed(FAITH_SPELLS.filter((s) => s.patron === 'chaos').map((s) => s.name))}. Exact effects in the Faith window.`,
      'Added: per faith tier: 1 spell ruins, 1 dreads, 1 is a bargain paid in your health or items instead of favour. None target another person.',
    ],
  },
  {
    n: 80,
    day: '2026-10-04',
    lines: () => {
      const job = (id: string): string => {
        const r = RECIPE_BY_ID.get(id);
        return r ? `${r.label} (${billWords(r.inputs.map((i) => [i.item, i.count ?? 1] as const), true)} into ${countOf(r.result, r.count ?? 1, true)})` : id;
      };
      const panes = (type: 'window' | 'bay'): number => WALL_TYPE_BY_ID.get(type)?.fittings?.find(([item]) => item === 'glass')?.[1] ?? 0;
      const stained = MATERIAL_BY_ID.get('stained_glass');
      const bottle = itemDef('bottle');
      return [
        `Added: Glassblowing skill (Artisan), at a hot smelter: ${listed(['make_glass', 'make_glass_panel', 'make_bottle', 'make_stained_glass'].map(job))}. Failed stained glass keeps the gem and sand.`,
        `Changed: windows, bay windows and glasshouse roofs glazed with glass panels: window ${panes('window')}, bay window ${panes('bay')}. Existing panes converted to glass panels.`,
        stained ? `Added: stained glass material: ${billWords(stained.bill, true)} per solid wall, weight ${heftWord(stained.heft)}, up to ${stained.storeys} storeys. ${onlySaid(stained)}` : '',
        `Added: bottle: holds ${bottle.holds} of 1 food or drink; contents left lying rot at ${frac(bottle.shelter ?? 1)} the rate.`,
      ].filter(Boolean);
    },
  },
  {
    n: 81,
    day: '2026-10-04',
    lines: () => [
      `Changed: altar prayer once every ${dur(PRAYER_REST)}; Faith gain per prayer approx. +${skillGain(1, PRAYER_GAIN, 1).toFixed(1)} at Faith 1, +${skillGain(20, PRAYER_GAIN, 1).toFixed(1)} at 20, +${skillGain(50, PRAYER_GAIN, 1).toFixed(1)} at 50.`,
    ],
  },
  {
    n: 82,
    day: '2026-10-04',
    lines: () => {
      const [low, high, altar] = [1, 100, 50];
      const banks = (v: number): number => Math.round(prayerWorth(altar, PRAYER_PEAKS[0], v));
      return [
        `Added: Prayer skill, starting at ${low}. Per prayer at ${low}: Prayer approx. +${skillGain(low, tryGain(true), 1).toFixed(1)}, Faith approx. +${skillGain(low, PRAYER_GAIN, 1).toFixed(1)}.`,
        `Changed: favour banked per prayer set by Prayer, not Faith: QL ${altar} altar at ${String(PRAYER_PEAKS[0]).padStart(2, '0')}:00: ${banks(low)} favour at Prayer ${low}, ${banks(high)} favour at Prayer ${high}.`,
        `Changed: Faith sets max favour: ${Math.floor(favourCap(low))} favour at Faith ${low}, ${Math.floor(favourCap(high))} favour at Faith ${high}.`,
      ];
    },
  },
  {
    n: 83,
    day: '2026-10-05',
    lines: () => {
      const mid = TRAVEL_TOP_AT / 2;
      return [
        `Added: Driving skill: cart or wagon team speed +${percent(drivingPace(mid) - 1)} at Driving ${mid}, +${percent(DRIVING_TOP)} at ${TRAVEL_TOP_AT}.`,
        `Added: Sailing skill: boat speed at the helm, rowed or sailed, +${percent(sailingPace(mid) - 1)} at Sailing ${mid}, +${percent(SAILING_TOP)} at ${TRAVEL_TOP_AT}.`,
        'Added: each trains per tile entered while at the reins or helm.',
      ];
    },
  },
  {
    n: 84,
    day: '2026-10-05',
    lines: () => {
      const go = (v: number): string => skillGain(v, tryGain(true), 1).toFixed(v < 50 ? 2 : 3);
      return [
        `Changed: all skill gain to ${frac(GAIN_RATE)} of before (players, workers, wildermon); skill already learned is kept.`,
        `Changed: a successful action approx. +${go(1)} at level 1, +${go(50)} at 50, +${go(90)} at 90; the last point takes about ${num(Math.round(1 / (MIN_GAIN * GAIN_RATE)))} actions.`,
      ];
    },
  },
  {
    n: 85,
    day: '2026-10-06',
    lines: () => [
      `Added: Plant grass on dirt with ${GRASS_PLANT} mixed grass in pack: tile becomes grass. Dirt never regrows grass by itself.`,
      `Changed: Cut grass gives ${num(GRASS_PER_CUT)} mixed grass a cut.`,
    ],
  },
  {
    n: 86,
    day: '2026-10-07',
    lines: () => {
      const blade = CLASSES.find((c) => c.id === 'blade');
      const first = perksOf('blade').map((p) => CLASS_SPELL_BY_ID.get(p.id)).find((sp) => sp !== undefined);
      return [
        `Changed: ${blade?.name} from a tree to spells and passives: ${num(CLASS_TIER_AT.length)} class tiers, each offering `
          + `${num(PERKS_PER_TIER - 1)} spells and a passive, take 1. Removed: its tree and bought nodes. Rite kept, above the class tiers.`,
        `Added: class tiers open on class level: ${CLASS_LEVEL_START} on taking it up, then ${listed(CLASS_TIER_AT.slice(1).map(String))}. `
          + `Class level rises per landed blow while you hold the class, on the skill curve; a kill counts ${num(1 + CLASS_LEARN_KILL / CLASS_LEARN_BLOW)} times as much.`,
        first ? `Added: ${num(classSpellsOf('blade').length)} spells in the spell bar's class slots, paid in stamina. ${first.name}: ${spellTerms(first)} ${first.note}` : '',
        'Added: a creature turned on you by Summons or Challenge stays on you for its full duration however often you strike it.',
      ].filter(Boolean);
    },
  },
  {
    n: 87,
    day: '2026-10-07',
    lines: () => {
      const spells = classSpellsOf('berserker');
      const first = perksOf('berserker').map((p) => CLASS_SPELL_BY_ID.get(p.id)).find((sp) => sp !== undefined);
      const wants = spells.filter((sp) => sp.needs).map((sp) => sp.name);
      return [
        `Changed: Berserker from a tree to ${num(spells.length)} spells and ${num(perksOf('berserker').length - spells.length)} passives `
          + `in ${num(CLASS_TIER_AT.length)} class tiers on class level, as Sworn Blade. Removed: its tree and bought nodes. Rite kept.`,
        first ? `Added: ${first.name}: ${spellTerms(first)} ${first.note}` : '',
        wants.length ? `Added: ${listed(wants)} need the named weapon in hand; refused without it.` : '',
        'Added: a fighting-class spell blow also has its weapon\'s swing effect: maul staggers, spear holds off, knife opens it up.',
      ].filter(Boolean);
    },
  },
  {
    n: 88,
    day: '2026-10-07',
    lines: () => {
      const spells = classSpellsOf('pikeman');
      const first = perksOf('pikeman').map((p) => CLASS_SPELL_BY_ID.get(p.id)).find((sp) => sp !== undefined);
      return [
        `Changed: Pikeman from a tree to ${num(spells.length)} spells and ${num(perksOf('pikeman').length - spells.length)} passives `
          + `in ${num(CLASS_TIER_AT.length)} class tiers on class level, as Sworn Blade and Berserker. Removed: its tree and bought nodes. `
          + 'Rite kept.',
        first ? `Added: ${first.name}: ${spellTerms(first)} ${first.note}` : '',
        'Fixed: offline, Berserker\'s Executioner and Pain Fuels count on every landed blow, as on an island.',
      ].filter(Boolean);
    },
  },
  {
    n: 89,
    day: '2026-10-07',
    lines: () => {
      const spells = classSpellsOf('archer');
      const first = perksOf('archer').map((p) => CLASS_SPELL_BY_ID.get(p.id)).find((sp) => sp !== undefined);
      return [
        `Changed: Archer from a tree to ${num(spells.length)} spells and ${num(perksOf('archer').length - spells.length)} passives `
          + `in ${num(CLASS_TIER_AT.length)} class tiers on class level, as Sworn Blade, Berserker and Pikeman. Removed: its tree and `
          + 'bought nodes. Rite kept.',
        first ? `Added: ${first.name}: ${spellTerms(first)} ${first.note}` : '',
      ].filter(Boolean);
    },
  },
  {
    n: 90,
    day: '2026-10-07',
    lines: () => {
      const spells = classSpellsOf('skirmisher');
      const first = perksOf('skirmisher').map((p) => CLASS_SPELL_BY_ID.get(p.id)).find((sp) => sp !== undefined);
      return [
        `Changed: Skirmisher from a tree to ${num(spells.length)} spells and `
          + `${num(perksOf('skirmisher').length - spells.length)} passives in ${num(CLASS_TIER_AT.length)} class tiers on class level, `
          + 'as Sworn Blade, Berserker, Pikeman and Archer. Removed: its tree and bought nodes. Rite kept.',
        first ? `Added: ${first.name}: ${spellTerms(first)} ${first.note}` : '',
      ].filter(Boolean);
    },
  },
  {
    n: 91,
    day: '2026-10-07',
    lines: () => {
      const spells = classSpellsOf('chirurgeon');
      const first = perksOf('chirurgeon').map((p) => CLASS_SPELL_BY_ID.get(p.id)).find((sp) => sp !== undefined);
      return [
        `Changed: Chirurgeon from a tree to ${num(spells.length)} spells and `
          + `${num(perksOf('chirurgeon').length - spells.length)} passives in ${num(CLASS_TIER_AT.length)} class tiers on class level, `
          + 'as Sworn Blade, Berserker, Pikeman, Archer and Skirmisher. Removed: its tree and bought nodes. '
          + 'Rite kept.',
        first ? `Added: ${first.name}: ${spellTerms(first)} ${first.note}` : '',
        'Added: a heal trains Chirurgeon only while its target has something hunting them.',
      ].filter(Boolean);
    },
  },
  {
    n: 92,
    day: '2026-10-07',
    lines: () => {
      const spells = classSpellsOf('beastmaster');
      const first = perksOf('beastmaster').map((p) => CLASS_SPELL_BY_ID.get(p.id)).find((sp) => sp !== undefined);
      return [
        `Changed: Beastmaster from a tree to ${num(spells.length)} spells and `
          + `${num(perksOf('beastmaster').length - spells.length)} passives in ${num(CLASS_TIER_AT.length)} class tiers on class `
          + 'level, as Sworn Blade, Berserker, Pikeman, Archer, Skirmisher and Chirurgeon. Removed: its tree '
          + 'and bought nodes. Rite kept.',
        first ? `Added: ${first.name}: ${spellTerms(first)} ${first.note}` : '',
        'Added: each blow your companion lands trains Beastmaster class level, as your own blows do.',
      ].filter(Boolean);
    },
  },
  {
    n: 93,
    day: '2026-10-07',
    lines: () => {
      const spells = classSpellsOf('kindler');
      const first = perksOf('kindler').map((p) => CLASS_SPELL_BY_ID.get(p.id)).find((sp) => sp !== undefined);
      const before = CLASSES.filter((c) => c.kind === 'combat' && c.id !== 'kindler' && PERK_CLASSES.has(c.id)).map((c) => `the ${c.name}’s`);
      return [
        `Changed: Kindler from a tree to ${num(spells.length)} spells and `
          + `${num(perksOf('kindler').length - spells.length)} passives in ${num(CLASS_TIER_AT.length)} class tiers on class `
          + `level, as ${listed(before)}. Removed: its tree and bought nodes. Rite kept.`,
        first ? `Added: ${first.name}: ${spellTerms(first)} ${first.note}` : '',
        'Added: Kindler spells cast from the best garnet or ruby focus in your pack, no wear; each cast trains kindling, '
          + 'as Ember does.',
      ].filter(Boolean);
    },
  },
  {
    n: 94,
    day: '2026-10-07',
    lines: () => {
      const spells = classSpellsOf('binder');
      const first = perksOf('binder').map((p) => CLASS_SPELL_BY_ID.get(p.id)).find((sp) => sp !== undefined);
      const before = CLASSES.filter((c) => c.kind === 'combat' && c.id !== 'binder' && PERK_CLASSES.has(c.id)).map((c) => `the ${c.name}’s`);
      return [
        `Changed: Binder from a tree to ${num(spells.length)} spells and `
          + `${num(perksOf('binder').length - spells.length)} passives in ${num(CLASS_TIER_AT.length)} class tiers on class `
          + `level, as ${listed(before)}. Removed: its tree and bought nodes. Rite kept.`,
        first ? `Added: ${first.name}: ${spellTerms(first)} ${first.note}` : '',
        'Added: Binder spells cast from the best sapphire or diamond focus in your pack, no wear; each cast trains binding, '
          + 'as Snare does.',
        `Fixed: a hold from ${listed([...CLASS_SPELLS.filter((sp) => 'hold' in sp.fx), ...spellsOf('binding')].map((sp) => sp.name))} `
          + 'ended when a blow turned the held creature on its striker; now lasts its full stated duration.',
        'Changed: after a blow, shot, fire or shatter, the message gives the creature\'s true remaining health, counting every '
          + 'damage modifier.',
      ].filter(Boolean);
    },
  },
  {
    n: 95,
    day: '2026-10-07',
    lines: () => {
      const spells = classSpellsOf('warder');
      const first = perksOf('warder').map((p) => CLASS_SPELL_BY_ID.get(p.id)).find((sp) => sp !== undefined);
      const before = CLASSES.filter((c) => c.kind === 'combat' && c.id !== 'warder' && PERK_CLASSES.has(c.id)).map((c) => `the ${c.name}’s`);
      const aegis = spellDef('aegis')!;
      return [
        `Changed: Warder from a tree to ${num(spells.length)} spells and `
          + `${num(perksOf('warder').length - spells.length)} passives in ${num(CLASS_TIER_AT.length)} class tiers on class `
          + `level, as ${listed(before)}. Removed: its tree and bought nodes. Rite kept. No class or trade uses a tree now.`,
        first ? `Added: ${first.name}: ${spellTerms(first)} ${first.note}` : '',
        'Added: Warder spells cast from the best topaz or emerald focus in your pack, no wear; each cast trains warding, '
          + 'as Aegis does.',
        `Fixed: skins now in hundredths of health (Aegis laid its whole force, absorbing nearly every blow). Aegis `
          + `skin ${percent(skinOf(spellForce(aegis, FIRE_LOW, FIRE_LOW, 1)))} of full health at ${FIRE_LOW} warding with a QL ${FIRE_LOW} `
          + `focus, up to ${percent(skinOf(spellForce(aegis, FIRE_TOP, FIRE_TOP, 1)))} at ${FIRE_TOP} with QL ${FIRE_TOP}; `
          + 'existing skins reduced the same.',
      ].filter(Boolean);
    },
  },
  {
    n: 96,
    day: '2026-10-07',
    lines: () => {
      const staired = WALL_MATERIALS.filter((m) => takesAs(m, { floor: 'stairs' }));
      const plank = (hand?: 'l'): string => billWords(Object.entries(floorBill('plank', 'stairs', undefined, hand).needed), true);
      return [
        `Added: ${SINGLE_STAIRS_NAME}, in all ${num(staired.length)} stair materials: 1/2 tile `
          + `wide, left or right 1/2 as you climb, stairwell beside it. Upper storey → `
          + `Plan ${SINGLE_STAIRS_NAME}; Q and E rotate it 1/2 tile at a time.`,
        `Added: cost ${percent(SINGLE_STAIRS_SHARE)} of a solid wall's materials (wide: ${percent(STAIRS_SHARE)}): `
          + `plank ${plank('l')} vs ${plank()}. Climbs as the wide one.`,
      ];
    },
  },
  {
    n: 97,
    day: '2026-10-07',
    lines: () => [
      'Added: carts and wagons climb finished wide staircases indoors: drive on from the foot through an arch, '
        + 'double door or gate; exit at the head onto the storey above; drive on its finished floors.',
      `Added: no wheels on a ${SINGLE_STAIRS_NAME}, ladder, roof or staircase side. The team moves with the `
        + 'wagon; harness and unharness on the ground floor only.',
    ],
  },
  {
    n: 98,
    day: '2026-10-08',
    lines: () => {
      const said = (id: string): string => {
        const p = PERK_BY_ID.get(id)!;
        const cls = CLASSES.find((c) => c.id === p.class)!;
        const at = tiersAtFor(cls.kind)[p.tier - 1];
        return `${cls.name}, ${p.name}, perk tier ${p.tier} (at ${cls.kind === 'combat' ? 'class level' : 'skill'} ${at}): ${p.note}`;
      };
      return [
        'Changed: some class perks. A taken perk that moved or was removed reopens its perk tier.',
        `Added: ${said('smith_masters_mark')} Replaces Long Shift.`,
        `Added: ${said('cook_quick_kitchen')} Replaces the Cook’s Cool Pack.`,
        `Added: ${said('binder_hard_edges')} Replaces Unmoved.`,
        `Changed (moved): ${said('archer_bow_mastery')} ${said('archer_arrow_saver')}`,
        `Changed (improved): ${said('artisan_gem_eye')}`,
        'Changed (renamed, duplicate names): Mason’s Nothing Wasted to Careful Builder; Herdsman’s Any Bait '
          + 'to Any Offering; Artisan’s Gem Eye to Gem Finder. Holders keep them.',
        `Fixed: ${CLASS_SPELL_BY_ID.get('chirurgeon_healing_circle')!.name} description: ${CLASS_SPELL_BY_ID.get('chirurgeon_healing_circle')!.note}`,
      ];
    },
  },
  {
    n: 99,
    day: '2026-10-08',
    lines: () => {
      const medic = PERK_BY_ID.get('naturalist_field_medic')!;
      return [
        'Added: Dress their wounds (right-click a person beside you), for anyone: dresses their worst wound '
          + 'at your first aid, from your pack.',
        `Changed: Naturalist’s ${medic.name} and Chirurgeon’s ${PERK_BY_ID.get('chirurgeon_field_surgeon')!.name}: ${medic.note} `
          + 'Holders keep them.',
      ];
    },
  },
  {
    n: 100,
    day: '2026-10-08',
    lines: () => [
      `Added: cart and wagon speed by quality: +${percent(VEHICLE_QL_TOP)} at full quality, proportionally `
        + `below (+${percent(vehicleQlPace(QL_TOP / 2) - 1)} at 1/2 quality), any team, beyond the team's top speed.`,
    ],
  },
  {
    n: 101,
    day: '2026-10-08',
    lines: () => {
      const island = (key: string) => REGIONS.find((R) => R.key === key)!;
      const rock = (yields: string): string => (ROCK_VARIANTS.find((r) => r.yields === yields)?.name ?? yields).replace(/ (vein|seam)$/, '').toLowerCase();
      const tree = (s: number): string => TREE_DEFS[s].name.toLowerCase();
      const skerry = island('WestSkerry');
      const east = island('EastIsle');
      const tundra = island('NortheastTundra');
      return [
        `Changed: ${listed(skerry.ores.map(rock))} only on ${skerry.name}.`,
        `Changed: ${listed(east.trees.filter((s) => TREE_DEFS[s].fruit).map(tree))} grow on ${east.name}.`,
        `Changed: ${tundra.name} is bare plain rock. Its ${rock(tundra.stone)} and ${listed((tundra.mountain ?? []).map(rock))} seams `
          + 'only under its mountain, above the alpine line; no other metal or seam in its ground.',
        'Changed: islands founded before today: rock under those regions and untouched trees converted to match.',
      ];
    },
  },
  {
    n: 102,
    day: '2026-10-08',
    lines: () => REGIONS.filter((R) => R.monsters || R.treeless).flatMap((R) => [
      ...(R.treeless ? [`Changed: no trees grow or seed by themselves on the ${R.name.replace(/^The /, '')}.`] : []),
      ...(R.monsters ? [`Changed: every wild creature that fights back on the ${R.name.replace(/^The /, '')} is a monster, never a wildermon, at ${mult(R.monsters)} `
        + `the rest of the chart's count of each: ${listed(MONSTERS.map(([id]) => `${num((MONSTER_CAP[id] ?? 1) * (R.monsters ?? 1))} ${SPECIES[id].name.toLowerCase()}${(MONSTER_CAP[id] ?? 1) * (R.monsters ?? 1) === 1 ? '' : 's'}`))}.`] : []),
    ]),
  },
  {
    n: 103,
    day: '2026-10-08',
    lines: () => [
      `Changed: new coins struck from ${COIN_METALS.join(' or ')} only. Silver coins still circulate and come back as change.`,
      `Changed: a failed coin strike loses its lump. Past the smith's check, gold purity decides: takes the die always at QL ${QL_TOP}, `
        + `${percent(coinPurity(0))} at the bottom of the scale, linear between.`,
      `Changed: gold only from under the mountain of the ${REGIONS.filter((R) => R.mountain?.includes('gold_ore')).map((R) => R.name.replace(/^The /, '')).join(' and ')}. `
        + 'Removed: gold from panning, hoards and chests. Gold seams elsewhere are now iron.',
      `Added: foraging finds a gold coin 1 action in ${num(COIN_FIND_ONE_IN)}, up to ${num(COIN_FINDS_A_DAY)} a day per person. `
        + 'Settlement foraging workers never find one.',
    ],
  },
  {
    n: 104,
    day: '2026-10-08',
    lines: () => [
      'Changed: trees and bushes drawn from a cached picture at exact screen size, leaning as grown; wind sway in whole pixels.',
      `Changed: sea swell painted ${num(SWELL_RATE)} times a second, moved with the view between, not every frame.`,
      'Changed: close-up people and wildermon redrawn as often as distant ones (was twice as often).',
      `Added: Settings, Show drawing times: ms per frame under the frame rate for the ground, ${listed(Object.keys(LAYERS))}; `
        + `Measure each layer: omits each for ${num(TRIAL_SECONDS)} second in turn and records the frame rate without it.`,
    ],
  },
  {
    n: 105,
    day: '2026-10-08',
    lines: () => [
      `Changed: a person walking steadily one way is drawn from ${num(WALK_FRAMES)} cached frames a stride; `
        + 'turning, starting, stopping or wearing a shining item: drawn as before.',
      'Fixed: path walking paused a frame at every tile (body eased to standing each step).',
      'Changed: only the sea part of the screen takes the swell each frame.',
    ],
  },
  {
    n: 106,
    day: '2026-10-08',
    lines: () => [
      'Changed: woman build: fuller chest visible side and three-quarter, narrower waist, wider hips; '
        + 'finer, higher-arched brows, lash lines, fuller lips. Neither build: 1/2 the body difference, none of the face\'s.',
      `Changed: Roll me one beard odds: man ${percent(BEARD_ODDS.man)}, neither ${percent(BEARD_ODDS.neither)}, `
        + `woman ${BEARD_ODDS.woman ? percent(BEARD_ODDS.woman) : 'never'}. Any build can still choose any beard.`,
    ],
  },
  {
    n: 107,
    day: '2026-10-08',
    lines: () => [
      'Changed: legs 1 tube hip to ankle bending at the knee; arms 1 tube shoulder to wrist bending at the elbow; no separate knee or elbow caps.',
      'Changed: walk and run keyed per step: planted foot stays put, knee driven forward, turns led by the head.',
      'Changed: an arm holding a blade, spear or shield swings less and keeps it off the leg.',
      `Changed: standing shifts weight foot to foot; wave and hop redone; hop lasts ${EMOTE_BY_ID.get('hop')!.seconds} s.`,
      'Changed: swimming is a breaststroke, body cut at the waterline, rings behind; drivers sit on the cart, wagon or boat seat holding reins or oars.',
    ],
  },
  {
    n: 108,
    day: '2026-10-08',
    lines: () => [
      `Added: visuals for all ${SPELL_VISUALS.size} class, faith and arcane spells, drawn on island acceptance: `
        + 'cast animation, travel to target, impact, and duration. '
        + 'Visible to others. Refused spells draw nothing.',
    ],
  },
  {
    n: 109,
    day: '2026-10-09',
    lines: () => [
      `Changed: walk speed on open ground from 2.4 to ${Number(BASE_SPEED.toFixed(2))} tiles/s, matching the drawn stride (planted feet stay put). Roads, wading, swimming, slopes, wounds, load, `
        + 'drawing a bow and Hit and Run keep the same % of this pace.',
      `Changed: jogging and running lengthen strides as well as quicken them, up to ${mult(strideAt(1) / strideAt(0))} `
        + 'walking stride length at a flat run; feet stay planted. Mounts, carts, wagons, boats, wildermon and monsters unchanged.',
    ],
  },
  {
    n: 110,
    day: '2026-10-10',
    lines: () => [
      `Added: mote swirls: at each ${RESET} the day's swirls go and ${num(SWIRLS_A_DAY)} new ones appear anywhere, `
        + 'land or water, never on a tree or inside a building.',
      `Added: swirl element: water on water; on land dark ${percent(SWIRL_DARK)}, light ${percent(SWIRL_LIGHT)}, else `
        + `the island's element: ${listed(REGIONS.map((R) => `${ISLAND_ELEMENT[R.key]} on ${R.name.replace(/^The /, 'the ')}`))}.`,
      `Added: Elementalism skill. Collect motes on a swirl: ${num(MOTES_LEAST)} mote of its element below Elementalism ${MOTES_STEP}, `
        + `+1 per ${MOTES_STEP} points, ${num(MOTES_MOST)} from ${MOTES_MOST_AT}; the swirl is removed for everyone. `
        + 'Only collecting trains Elementalism.',
    ],
  },
  {
    n: 111,
    day: '2026-10-10',
    lines: () => {
      const from = (p: string): string => listed(DYESTUFFS.filter((d) => d.primary === p).map((d) => itemDef(d.from).name.toLowerCase()));
      const gone = [...new Set(LEGACY_DYES.filter((d) => !DYESTUFFS.some((x) => x.from === d.from)).map((d) => itemDef(d.from).name.toLowerCase()))];
      const purple = mixDye(pureDye('red', DYE_QL_PURE), 1, pureDye('blue', DYE_QL_PURE), 1);
      // What this entry announced, which 117 changed: the litres a boil made and a dyeing took that day.
      const was = WAS_DYE;
      return [
        `Changed: dye is a liquid in a bucket or barrel, boiled in 3 primaries: ${listed(PRIMARIES.map((p) => `${p} from ${from(p)}`))}. `
          + `A boil turns a bucket of lye into ${num(was.boil)} L of dye at the alchemy QL `
          + `(was ${num(LEGACY_POTS)} pots of 1 of ${num(LEGACY_DYES.length)} colours). Removed: dye from ${listed(gone)}; their other uses unchanged.`,
        'Added: mixing by pouring: dye into a barrel of dye mixes, primary % and QL averaged by litres. '
          + 'Dye mixes only with dye. A bucket fills from a dye barrel (less than full if that is all there is); '
          + 'a part-full dye bucket tops up from one, mixing.',
        `Added: dye QL is brightness: black at QL ${DYE_QL_BLACK}, the pure mix at ${DYE_QL_PURE}, white at ${DYE_QL_WHITE}, linear between. `
          + `Red at QL ${DYE_QL_PURE}: ${dyeHex(pureDye('red', DYE_QL_PURE))}; red and blue 1:1: ${colourWord(dyeHex(purple))}, ${dyeHex(purple)}.`,
        `Added: litres per dyeing: ${was.garment} garment, cloth, bag, saddle or bridle; ${was.banner} banner or flag; `
          + `${was.sail} sailing boat; ${was.ship} caravel; ${was.wall} wall side or floor tile. `
          + 'Takes the exact colour, named by the nearest plain colour word. Examine: hex on a dyed item; hex, QL, litres and mix on a dye bucket or barrel.',
        `Changed: dyed items keep their colour. Each old pot is now ${LEGACY_POT_LITRES} L in a dye bucket (up to ${BUCKET_LITRES}), `
          + `of the nearest mix and QL: ${LEGACY_DYES.map((d) => {
            const l = legacyLiquid(d.id) ?? pureDye('red', DYE_QL_PURE);
            return `${d.name.toLowerCase()} ${sharesSaid(l)} at QL ${l.ql}, ${dyeHex(l)}`;
          }).join('; ')}.`,
      ];
    },
  },
  {
    n: 112,
    day: '2026-10-10',
    lines: () => [
      `Changed: knack checks for ${listed(KNACK_BY_LEARNING.map((k) => SKILL_BY_ID.get(k)?.name.toLowerCase() ?? k))} (raised in small steps while moving) from a whole action's chance (1 in ${num(KNACK_ODDS)}) `
        + `to the % of an action each step teaches: `
        + `a second in deep water ${percent(SWIM_LEARN / KNACK_GO)}, a tile driven ${percent(DRIVING_LEARN / KNACK_GO)}, a tile sailed ${percent(SAILING_LEARN / KNACK_GO)}, `
        + `a steep step climbed ${percent((CLIMB_LEARN + CLIMB_LEARN_FROM * CLIMB_LEARN_STEEP) / KNACK_GO)} to ${percent((CLIMB_LEARN + CLIMB_LEARN_STEEP) / KNACK_GO)}.`,
      `Changed: 1 knack per ${Math.round(KNACK_ODDS * KNACK_GO / SWIM_LEARN).toLocaleString('en')} s of swimming (was 1 in ${num(KNACK_ODDS)}); `
        + `1 per ${Math.round(KNACK_ODDS * KNACK_GO / DRIVING_LEARN).toLocaleString('en')} tiles driven or sailed. Other skills unchanged. Earned knacks kept.`,
    ],
  },
  {
    n: 113,
    day: '2026-10-10',
    lines: () => [
      `Added: repeat key (${defaultKey('repeat')}): repeats the last action: same action, same target, same count. `
        + 'Queued like any action: lines up behind the current one, walks to its target, refused for the same reasons.',
      'Added: if the last action\'s stack is gone, another of the same kind in your pack is used. Names or confirmations are asked again. '
        + 'Rebind in Settings, Keys.',
    ],
  },
  {
    n: 114,
    day: '2026-10-10',
    lines: () => {
      // What this entry was about, which later entries moved past: Knowledge alone, with Love and Power still on their steps (115).
      const moved = [PATHS.knowledge];
      return [
        `Changed: meditation path chosen at ${CHOOSE_AT} meditation, where its first path tier opens. Existing choices kept regardless of meditation.`,
        `Added: Calm: each sitting banks ${SIT_CALM} Calm × the spot multiplier. Max Calm follows favour's curve on meditation, `
          + `${listed(PATH_TIER_AT.filter((_, i) => i % 2 === 0).map((m) => `${Math.floor(calmCap(m))} Calm at ${m}`))}; no regeneration.`,
        `Added: sitting within ${num(SIT_WORTH.swirlReach)} tiles of a mote swirl +${percent(SIT_WORTH.swirl - 1)}; within ${num(SIT_WORTH.staleReach)} tiles `
          + `of anywhere you sat since the last ${RESET}: ${percent(SIT_WORTH.stale)}. A blow landing on you ends the sitting with nothing gained.`,
        `Changed: ${listed(moved.map((p) => p.name))} onto path tiers: ${num(PICKS_PER_TIER)} picks at each of ${listed(PATH_TIER_AT.map(String))} meditation, `
          + `a technique and ${num(PICKS_PER_TIER - 1)} disciplines, take 1 (Faith window, Path tab). `
          + `Techniques go in the path slot and cost Calm: ${listed(TECHNIQUES.filter((k) => moved.some((p) => p.id === k.path)).map((k) => `${k.name} ${k.cost} Calm`))}. `
          + `Removed: old steps, incl. Sense the Rock and Recall the Way. Attentive (now ${percent(picksOf('knowledge', 1).find((k) => k.name === 'Attentive')?.fx.learn ?? 0)}), `
          + 'Reader and Keen Sight are disciplines. Love and Power keep their steps and abilities for now.',
      ];
    },
  },
  {
    n: 115,
    day: '2026-10-10',
    lines: () => {
      const fx = (id: string, key: string): number => PATH_PICK_BY_ID.get(id)?.fx[key] ?? 0;
      const tiers = (path: 'love' | 'power'): string => PATH_TIER_AT.map((at, i) => `${at}: ${listedOr(picksOf(path, i + 1).map((k) => k.name))}`).join('; ');
      return [
        `Changed: Love and Power onto path tiers, as Knowledge: ${num(PICKS_PER_TIER)} picks per path tier, take 1 (Faith window, Path tab). `
          + 'Walkers keep their path and pick at each path tier reached; old steps stop.',
        `Added: Love: ${tiers('love')}.`,
        `Added: Power: ${tiers('power')}.`,
        `Changed: Abundance +${percent(fx('love_abundance', 'harvest') - 1)}, on fruit as well as crops. Green Thumb, Gentle Hand, Strong Back unchanged. `
          + `Fixed: Ironhide's +${percent(fx('power_ironhide', 'hide') - 1)} now counted on the island.`,
        'Removed: Fury, Hard Hands, Mend the Flesh (damage belongs to fighting classes, healing to the Blessing).',
        `Changed: every technique costs Calm: ${listed(TECHNIQUES.filter((k) => k.path !== 'knowledge').map((k) => `${k.name} ${k.cost} Calm`))}.`,
      ];
    },
  },
  {
    n: 116,
    day: '2026-10-10',
    lines: () => {
      const bill = recipeBill('make_telestone');
      return [
        `Added: ${num(RUNESTONES.length)} Runestones on the Crescent's inner bay shore, ${num(STONE_SPAN)} by ${num(STONE_SPAN)} tiles, on the map: `
          + `${listed(RUNESTONES.map((s) => `${s.name} (${s.x}, ${s.y})`))}. Impassable; no digging, building, planting or setting down on their tiles. `
          + 'Removed: whatever stood there; people there moved beside the stone.',
        `Added: sitting within ${num(SIT_WORTH.stoneReach)} tiles of a Runestone: meditation and Calm ${mult(SIT_WORTH.stone)}, `
          + 'multiplying other spot bonuses.',
        `Added: Telestone (${skillOf('make_telestone')}: ${bill}). Travel to a Runestone: to any Runestone within reach, `
          + `${TELE_NEAR} tiles at QL ${TELE_QL_LOW} to ${TELE_FAR} at QL ${TELE_QL_HIGH}.`,
        `Added: cooldown after travel ${dur(TELE_SLOW)} at QL ${TELE_QL_LOW} down to ${dur(TELE_FAST)} at QL ${TELE_QL_HIGH}, `
          + 'by the Telestone used. Cooldown is yours, not the stone\'s; the Telestone is not consumed.',
      ];
    },
  },
  {
    n: 117,
    day: '2026-10-10',
    lines: () => {
      const was = WAS_DYE;
      const kg = kgSaid(dyeGrams(BOIL_LITRES, DYE_LITRES_PER_KG));
      const double = PERK_BY_ID.get('naturalist_double_boil');
      const thrifty = PERK_BY_ID.get('naturalist_thrifty_dyer');
      const perKg = double?.fx['litres:dye'] ?? DYE_LITRES_PER_KG;
      const thrift = thrifty ? Object.values(thrifty.fx)[0] : 1;
      const size = (k: keyof typeof DYE_LITRES): string => `${DYE_LITRES[k]} (was ${was[k]})`;
      return [
        `Changed: dye boil by weight: ${kgSaid(dyeGrams(1, DYE_LITRES_PER_KG))} kg dyestuff per litre of lye; litres of dye out = litres of lye in: `
          + `${num(BOIL_LITRES)} L from ${kg} kg (was ${num(was.boil)} L from a count of 8 or 10). `
          + `Per dyestuff: ${listed(DYESTUFFS.map((d) => `${countOf(d.from, boilCountPlain(d.from), true)} (${kgSaid(gramsOf(d.from))} kg each)`))}: `
          + 'fewest whole items that weigh enough; the boil reports what it used. Short: reports kg needed and kg held.',
        `Changed: ${double?.name ?? 'Double Boil'} (Naturalist): ${num(perKg)} L of dye per kg, so `
          + `${kgSaid(dyeGrams(BOIL_LITRES, perKg))} kg for ${num(BOIL_LITRES)} L (was ${num(BUCKET_LITRES)} L where a boil gave ${num(was.boil)}). `
          + `${thrifty?.name ?? 'Thrifty Dyer'}: ${percent(thrift)} of the weight: ${kgSaid(dyeGrams(BOIL_LITRES, DYE_LITRES_PER_KG, thrift))} kg, `
          + `${kgSaid(dyeGrams(BOIL_LITRES, perKg, thrift))} kg with both. Alchemy baubles add nothing to a boil (bucket already full).`,
        `Changed: litres per dyeing, a kilo each: ${size('garment')} garment, cloth, bag, saddle or bridle; ${size('banner')} banner or flag; `
          + `${size('sail')} sailing boat; ${size('ship')} caravel; ${size('wall')} wall side or floor tile.`,
        `Changed: dyeing draws from 1 dye bucket in your pack or 1 dye barrel within ${CRAFT_REACH} tiles (yours or on your settlement), never several. `
          + 'Several with enough: choose from a list (colour, hex, QL, litres); exactly 1: used. '
          + 'Repeat key asks again. None with enough: reports litres needed and the most any one holds.',
      ];
    },
  },
  {
    n: 118,
    day: '2026-10-10',
    lines: () => [
      `Added: Enchanting skill. Changed: papyrus pressed only at a paper press (${recipeBill('make_paper_press')}, ${skillOf('make_paper_press')}).`,
      `Added: scrolls (crafting window, ${skillOf(`make_${ENCHANTMENT_LIST[0].scroll}`)}): ${listed(ENCHANTMENT_LIST.slice(0, 3).map((e) => `${e.name} from ${recipeBill(`make_${e.scroll}`)}`))}. `
        + `QL capped at the papyrus QL. Failure: motes lost, papyrus takes ${SCROLL_HARM} damage.`,
      `Added: Enchant (on a scroll) into a melee weapon in your pack: success chance = average of enchanting and scroll QL as a percent, `
        + `${percent(ENCHANT_LEAST)} to ${percent(ENCHANT_MOST)}; quality set at random around that average, capped at scroll and weapon QL. `
        + `Failure: weapon takes ${ENCHANT_HARM} damage, ${percent(ENCHANT_BREAK)} chance it breaks. Scroll consumed either way; 1 enchantment per weapon.`,
      ...ENCHANTMENT_LIST.slice(0, 3).map((e) => `Added: ${e.name}: a landed ordinary melee swing ${EFFECT_HEAD[e.effect]} ${percent(enchantHitChance(e, NEWS_QL_TOP))} of the time at QL ${NEWS_QL_TOP}, `
        + `proportionally less below. ${EFFECT_TAIL[e.effect]}`),
      `Added: stun: ${STUN_SECS} s with no moving or striking; cancels a heavy blow being drawn. A new stun restarts the timer, no stacking; `
        + `target panel shows "stunned". Enchanted weapons are named with it, e.g. Sword (${ENCHANTMENT_LIST[0].name}); Examine gives its quality and proc chance.`,
    ],
  },
  {
    n: 119,
    day: '2026-10-11',
    lines: () => [
      `Removed: the ${CLASS_AT} skill requirement for fighting classes (${listed(CLASSES.filter((c) => c.kind === 'combat').map((c) => c.name))}); `
        + `available from the start. Craft trades still open at ${CLASS_AT} in any covered skill.`,
    ],
  },
  {
    n: 120,
    day: '2026-10-11',
    lines: () => [
      `Added: ${num(ENCHANTMENT_LIST.slice(3, 9).length)} more melee weapon enchantments (crafting window): `
        + `${listed(ENCHANTMENT_LIST.slice(3, 9).map((e) => `${e.name} from ${recipeBill(`make_${e.scroll}`)}`))}.`,
      ...ENCHANTMENT_LIST.slice(3, 9).map((e) => `Added: ${e.name}: at QL ${NEWS_QL_TOP}, ${enchantLineAt(e, NEWS_QL_TOP)} Proportionally less below.`),
      `Changed: a scroll used on the wrong item kind is refused naming the right one: "${wrongKind(ENCHANTMENT_LIST[4])}"`,
    ],
  },
  {
    n: 121,
    day: '2026-10-11',
    lines: () => [
      `Added: ${num(ENCHANTMENT_LIST.slice(9, 12).length)} bow enchantments: ${listed(ENCHANTMENT_LIST.slice(9, 12).map((e) => `${e.name} from ${recipeBill(`make_${e.scroll}`)}`))}.`,
      ...ENCHANTMENT_LIST.slice(9, 12).map((e) => `Added: ${e.name}: at QL ${NEWS_QL_TOP}, ${enchantLineAt(e, NEWS_QL_TOP)} Proportionally less below.`),
      'Added: target panel shows "slowed", as for "stunned".',
    ],
  },
  {
    n: 122,
    day: '2026-10-11',
    lines: () => [
      `Added: ${num(ENCHANTMENT_LIST.slice(12, 18).length)} enchantments for worn and held gear: ${listed(ENCHANTMENT_LIST.slice(12, 18).map((e) => `${e.name} from ${recipeBill(`make_${e.scroll}`)}, on ${ON_WORDS[e.on]}`))}.`,
      ...ENCHANTMENT_LIST.slice(12, 18).map((e) => `Added: ${e.name}: at QL ${NEWS_QL_TOP}, ${enchantLineAt(e, NEWS_QL_TOP)} Proportionally less below.`),
    ],
  },
  {
    n: 123,
    day: '2026-10-11',
    lines: () => [
      `Added: ${num(ENCHANTMENT_LIST.slice(18, 22).length)} tool enchantments: ${listed(ENCHANTMENT_LIST.slice(18, 22).map((e) => `${e.name} from ${recipeBill(`make_${e.scroll}`)}, on ${ON_WORDS[e.on]}`))}.`,
      ...ENCHANTMENT_LIST.slice(18, 22).map((e) => `Added: ${e.name}: at QL ${NEWS_QL_TOP}, ${enchantLineAt(e, NEWS_QL_TOP)} Proportionally less below.`),
      'Changed: carrying several of a tool, the action uses the best one for the work, and its enchantment counts.',
    ],
  },
  {
    n: 124,
    day: '2026-10-11',
    lines: () => {
      const e = ENCHANTMENTS.lanterns_grace;
      return [
        `Added: ${e.name} from ${recipeBill(`make_${e.scroll}`)}, on ${ON_WORDS[e.on]}: at QL ${NEWS_QL_TOP}, ${enchantLineAt(e, NEWS_QL_TOP)} Proportionally less below.`,
        `Fixed: island torches burned at burn speed ${mult(WORLD_PACE)}; now ${dur(torchBurn(1))} to ${dur(torchBurn(100))} by winding quality.`,
      ];
    },
  },  {
    n: 125,
    day: '2026-10-11',
    lines: () => {
      const jewel = ENCHANTMENT_LIST.filter((e) => e.on === 'ring' || e.on === 'amulet');
      return [
        `Added: ${num(jewel.length)} jewel-slot enchantments (1 worn at a time): ${listed(jewel.map((e) => `${e.name} from ${recipeBill(`make_${e.scroll}`)}, on ${ON_WORDS[e.on]}`))}.`,
        ...jewel.map((e) => `Added: ${e.name}: at QL ${NEWS_QL_TOP}, ${enchantLineAt(e, NEWS_QL_TOP)} Proportionally less below.`),
      ];
    },
  },  {
    n: 126,
    day: '2026-10-11',
    lines: () => {
      const three = ['packmule', 'seals_coat', 'hawks_eye'].map((id) => ENCHANTMENTS[id]);
      return [
        `Added: ${listed(three.map((e) => `${e.name} from ${recipeBill(`make_${e.scroll}`)}, on ${ON_WORDS[e.on]}`))}.`,
        ...three.map((e) => `Added: ${e.name}: at QL ${NEWS_QL_TOP}, ${enchantLineAt(e, NEWS_QL_TOP)} Proportionally less below.`),
      ];
    },
  },  {
    n: 127,
    day: '2026-10-11',
    lines: () => {
      const two = ['ember_heart', 'masterwork'].map((id) => ENCHANTMENTS[id]);
      return [
        `Added: enchanting set-down items: Enchant on the scroll, within ${PLACED_REACH} tiles. `
          + `Failure: ${ENCHANT_HARM} damage, never breaks. Enchantment kept through pick up and set down.`,
        `Added: ${listed(two.map((e) => `${e.name} from ${recipeBill(`make_${e.scroll}`)}, on ${ON_WORDS[e.on]}`))}.`,
        ...two.map((e) => `Added: ${e.name}: at QL ${NEWS_QL_TOP}, ${enchantLineAt(e, NEWS_QL_TOP)} Proportionally less below.`),
      ];
    },
  },  {
    n: 128,
    day: '2026-10-11',
    lines: () => {
      const four = ['fair_wind', 'deep_hold', 'true_axle', 'bag_of_holding'].map((id) => ENCHANTMENTS[id]);
      return [
        `Added: ${num(four.length)} carrying and storage enchantments: ${listed(four.map((e) => `${e.name} from ${recipeBill(`make_${e.scroll}`)}, on ${ON_WORDS[e.on]}`))}. Crates take one where they stand.`,
        ...four.map((e) => `Added: ${e.name}: at QL ${NEWS_QL_TOP}, ${enchantLineAt(e, NEWS_QL_TOP)} Proportionally less below.`),
      ];
    },
  },  {
    n: 129,
    day: '2026-10-11',
    lines: () => {
      const three = ['snarecraft', 'netmender', 'dreamweave'].map((id) => ENCHANTMENTS[id]);
      return [
        `Added: ${num(three.length)} enchantments for traps, nets and beds: ${listed(three.map((e) => `${e.name} from ${recipeBill(`make_${e.scroll}`)}, on ${ON_WORDS[e.on]}`))}. Traps and beds take one where they stand.`,
        ...three.map((e) => `Added: ${e.name}: at QL ${NEWS_QL_TOP}, ${enchantLineAt(e, NEWS_QL_TOP)} Proportionally less below.`),
      ];
    },
  },  {
    n: 130,
    day: '2026-10-11',
    lines: () => {
      const two = ['fleetfoot', 'tamers_bridle'].map((id) => ENCHANTMENTS[id]);
      return [
        `Added: ${num(two.length)} tack enchantments: ${listed(two.map((e) => `${e.name} from ${recipeBill(`make_${e.scroll}`)}, on ${ON_WORDS[e.on]}`))}. `
          + 'They apply on the mount with the tack and return to the pack when it is removed; an enchanted saddle or bridle does not stack.',
        ...two.map((e) => `Added: ${e.name}: at QL ${NEWS_QL_TOP}, ${enchantLineAt(e, NEWS_QL_TOP)} Proportionally less below.`),
      ];
    },
  },
  {
    n: 131,
    day: '2026-10-11',
    lines: () => [
      `Added: enchanter's plinth: ${recipeBill(`make_${ENCHANTERS_PLINTH}`)}, ${skillOf(`make_${ENCHANTERS_PLINTH}`)}, trowel. `
        + `Changed: Enchant only within ${STATION_REACH} tiles of the middle of one set down; elsewhere "${ENCHANT_SAID.plinth}", `
        + 'shown on the scroll\'s Enchant entry before choosing a target, for set-down and pack items alike. Writing scrolls needs none.',
      `Added: while in use its runes brighten; night light ${PLINTH_BUSY_REACH} tiles (idle: ${PLINTH_REACH}). `
        + 'Takes moss like a statue.',
    ],
  },
  {
    n: 132,
    day: '2026-10-11',
    lines: () => [
      `Added: rune lantern post (${recipeBill('make_rune_lantern')}, ${skillOf('make_rune_lantern')}): night light for everyone `
        + `as a lantern of its QL, ${num(lanternReach(1))} tiles at QL 1 to ${num(lanternReach(100))} at QL 100; lit ground visible from full sight range. `
        + `No lantern or candle needed; burns nothing, never goes out. Moss over ${GREEN_DAYS} days, like a statue.`,
    ],
  },
  {
    n: 133,
    day: '2026-10-11',
    lines: () => {
      const def = WALL_TYPE_BY_ID.get(RUNE_GATE);
      const mat = (MATERIAL_BY_ID.get(def?.laidIn ?? '')?.name ?? '').toLowerCase();
      return [
        `Added: ${runeGateName()} for settlement entrances: Plan fence, ${def?.name}, on a ground tile edge, ${mat} only, `
          + `${billWords(Object.entries(typeBill(def?.laidIn ?? '', RUNE_GATE).total), true)}. People, carts and wildermon pass; see-through; cannot be locked.`,
        `Added: runes light while a citizen of its settlement (founder, mayor or builder) is within ${RUNE_GATE_REACH} of a tile of its opening's middle, `
          + `over ${RUNE_GATE_RISE} s; fade over ${RUNE_GATE_FADE} s when none is. Strangers and guests do not light it. `
          + `Lit after dark: pale gold light ${RUNE_GATE_GLOW_REACH} tiles round the opening. Light only, no other effect.`,
      ];
    },
  },
  {
    n: 134,
    day: '2026-10-11',
    lines: () => [
      `Added: memorial stone: crafting window, ${recipeBill(`make_${MEMORIAL}`)}, ${skillOf(`make_${MEMORIAL}`)}; set down like furniture.`,
      `Added: engrave with a ${itemDef(ENGRAVE_TOOL).name.toLowerCase()}: 1 line, up to ${ENGRAVE_MAX} characters, filtered as chat. `
        + 'Re-engravable by whoever set it down or anyone of its settlement; nobody else, nobody muted. '
        + 'Examine shows it in quotes. Keeps its line when moved. No decay.',
    ],
  },
  {
    n: 135,
    day: '2026-10-11',
    lines: () => [
      'Changed: meditating drawn sitting cross-legged, eyes shut, hands on knees, slow breathing '
        + '(was the bench-work animation). Effect unchanged.',
    ],
  },
  {
    n: 136,
    day: '2026-10-11',
    lines: () => [
      `Added: Find anything: ${defaultKey('palette')} or Ctrl+K: search and open any window, recipe, setting, help page, `
        + 'window layout or key by name.',
      `Added: ${LAYOUT_NAMES.length} window layouts on ${defaultKey('layout_1')} to ${defaultKey(`layout_${LAYOUT_NAMES.length}`)}. `
        + 'Shift+key saves the current windows; the key restores. Named in Settings, Windows.',
      `Added: windows snap to the screen edge or another window within ${SNAP} px; hold Alt to place freely.`,
      'Added: ◐ on the event log, tracker and map title bars: see-through, clicks pass '
        + 'to the island. Hold Alt to click in one.',
      'Added: hovering a weapon, armour piece or shield in the pack or a store shows damage, swing, hit chance, '
        + 'deflection % or block chance, each compared with what you wear in that slot.',
      'Added: Shift+drag a stack to move part of it (asks how many).',
      'Added: pack load bar, marked where weight starts to slow you, ending at crawl.',
      'Added: Take every one of it (right-click in a store), stack by stack; pack menu: Put every one of it in the open store.',
      `Added: Crafting window: Pinned recipes (☆ on a row) and the ${RECENT} most recent at the top. A missing material `
        + 'links to recipes making it, or its help entry if none.',
      'Added: ring over each nearby fire, smelter and kiln: fuel, contents, and a dot when something is ready.',
      'Added: notices (top of screen) for a new whole skill level, a knack, a work run finished and a birth. Each '
        + 'toggleable in Settings.',
    ],
  },
  {
    n: 137,
    day: '2026-10-11',
    lines: () => [
      `Added: Market window Prices tab: everything bought from a stall or counter, or delivered to a buy order, in the last ${SALE_DAYS} days: `
        + 'count sold, lowest, highest and average unit price, a bar per day. Hovering an item in the pack or a store shows the same for its kind.',
      'Added: Ctrl-click (⌘-click on Mac) to multi-select rows in the pack or a store; Shift-click selects a range from the last pick. '
        + 'Drag any selected row to move all, or Put in the store / Take them out on the bar below.',
    ],
  },
  {
    n: 138,
    day: '2026-10-11',
    lines: () => [
      'Added: Runecut interface look: pale carved stone windows, menus, tooltips and bars, dark text, cut corners, '
        + 'window rune at the title head (lit on the front window), titles in Cormorant Unicase. '
        + 'Text Alegreya Sans, from 13 to 14 px; small labels in its small caps.',
      'Added: health, stamina, food and water bars as grooves filled red, green, amber and blue-grey. Rare, supreme and fantastic items '
        + 'get a diamond notch at the row head in rarity colour, a size larger per step, plus the name in that colour.',
      `Added: Settings, Display: Interface look: Runecut or Classic (the old dark look). Runecut light: Day, Night `
        + `(dark stone, pale text) or Island clock (Night from ${islandTime(NIGHT_STARTS)} to ${islandTime(NIGHT_ENDS)} island time).`,
      'Added: Runecut windows painted as runestone slabs: lichen, cracks, chipped edges, '
        + 'shaded side and foot; rune in a pointed niche at the title head, lit amber by day; after dark on the front window it pulses with rising motes.',
      `Added: themed window borders, ${RIM} px (${frameOddities(FRAME_RIM)}), in ${FRAMES.length} kinds: pack ${frameLabel('inventory').toLowerCase()}, `
        + `stores ${frameLabel('stores').toLowerCase()}, crafting ${frameLabel('craft').toLowerCase()}, events ${frameLabel('events').toLowerCase()}, status panel ${frameLabel('hud').toLowerCase()}, toolbar ${frameLabel('toolbar').toLowerCase()}. `
        + `Knobs, knots or seals extend up to ${FRAME_REACH} px past the edge (${frameOddities(FRAME_REACHES)}); click-through; inner space unchanged. Settings, Display, Window frames: Themed, or Stone (plain rim on all).`,
    ],
  },
  {
    n: 139,
    day: '2026-10-12',
    lines: () => [
      `Changed: windows on a ${CELL}-px cell grid (shown while moving or resizing); position and size in whole cells. `
        + 'Resize from a bottom-right grip. Removed: edge snapping within a few pixels, and Alt free placement.',
      'Changed: windows never overlap each other, the status panel or the toolbar; edges may touch. A window dropped on another moves to the nearest free space of its size; resizing stops at a neighbour.',
      `Added: a square of ${CLEAR_CELLS} cells round your character (fewer on small screens) kept clear of windows.`,
      'Changed: status panel and toolbar movable (press and drag anywhere on them); whole cells; not resizable or closable; saved in layouts.',
      `Added: Runecut shared edges: frames stop at it, 1 seam, gold caps at each end: cloth, leather or paper to the same stitched every ${STITCH_EVERY} px; `
        + `other pairs mortared with a joint every ${JOINT_EVERY}; mixed pairs pinned in brass every ${PIN_EVERY}. A new join glints and clicks.`,
      'Changed: none on phones (no grid).',
    ],
  },
  {
    n: 140,
    day: '2026-10-12',
    lines: () => [
      `Added: Runecut themed frames have small animals and lights: ${lifeWords()}.`,
      'Added: they stay on the frame, never over window contents; click-through. Settings, Display, Frame life toggles them; '
        + 'hidden on phones, with Fast graphics, or with reduced motion.',
    ],
  },
  {
    n: 141,
    day: '2026-10-12',
    lines: () => [
      'Changed: a bandage or cover goes on the worst wound it would close faster than its current dressing, on you or whoever you dress, and names the wound. '
        + 'Fixed: an infected wound was picked first and refused, blocking all dressing; now skipped, and named only when nothing else takes a dressing.',
      `Changed: dressings ranked by closing speed, slowest first: ${listed(DRESSING_RANK)}. A dressing only replaces a lower-ranked one: `
        + 'cloth no longer replaces a cover (and its herb); a cover replaces cloth. If every wound is dressed as well already, refused with a message.',
    ],
  },
  {
    n: 142,
    day: '2026-10-12',
    lines: () => [
      'Added: Social window Friends tab shows Invite beside friends and people sharing another settlement with you, not only everyone else ashore. '
        + `Living on a settlement is no bar: anyone may be a citizen of ${DEEDS_JOINED} other people's settlements.`,
      `Added: Invite reads Citizen of ${DEEDS_JOINED} (disabled) for someone already on ${DEEDS_JOINED}, and Asked for a pending invite; `
        + 'right-click menu greys it with the same reason. Move in on an invitation is disabled while you are on the maximum.',
    ],
  },
  {
    n: 143,
    day: '2026-10-12',
    lines: () => [
      'Fixed: windows could not be moved or resized flush to the right and bottom screen edges (rarely on a whole cell).',
      'Changed: each Runecut frame animal and light redrawn with its own movement: land, look about, rest, move on, varied per frame. '
        + 'Mouse, ladybird, spider, snail and snow take night lighting after dark, as their frames do.',
    ],
  },
  {
    n: 144,
    day: '2026-10-12',
    lines: () => [
      // As it was that day: the fixed ranks this describes are gone (145), so nothing here is read from them.
      'Added: ranks, in the Settlement window under Citizens. The founder may set anyone else on the member list to mayor, builder or guest; '
        + 'a mayor may move a citizen between builder and guest. Only the founder makes or unmakes mayors; nobody changes the founder\'s rank or their own.',
      'Added: mayors may build, invite, send away builders and guests, and make them builders or guests. Mayors invite from the Social window and right-click menu like the founder; '
        + 'founder or mayor of several settlements: choose which one Invite is for.',
      'Added: the founder may send anyone away; a mayor only builders and guests, not another mayor. '
        + 'Upgrading, renaming and disbanding: founder only.',
    ],
  },
  {
    n: 145,
    day: '2026-10-13',
    lines: () => [
      `Changed: settlement ranks made by the founder: up to ${num(RANK_CAP)} besides the founder, names up to ${RANK_NAME_MAX} characters, `
        + `an order in the list and any of ${num(RANK_POWERS.length)} permissions: ${listed(RANK_POWERS.map((p) => p.label))}. `
        + 'Settlement window, Ranks: add, rename, reorder, delete, and tick permissions; each permission\'s tooltip gives its exact rule.',
      `Added: every settlement, existing ones included, starts with ${listed(DEFAULT_RANKS.map((r) => r.name))}, with their old abilities: `
        + `${DEFAULT_RANKS.map((r) => `${r.name} may ${rankMay(permsOf(r.powers))}`).join('; ')}. `
        + `Newcomers join as ${NEWCOMER_RANK} until the founder sets another rank.`,
      `Added: ${POWER.send_away.label} and ${POWER.set_ranks.label} act only on citizens ranked below you; ${POWER.set_ranks.label} gives only ranks below yours. `
        + 'Upgrading and renaming can be granted to a rank; disbanding cannot (it frees the founder\'s wildermon and empties the founder\'s settlement crate). '
        + 'A held rank cannot be deleted until its holders have another.',
      `Added: rank refusals name the rank and what it lacks, worded the same everywhere: "${lacksSaid('Hearth', 'Guest', 'locks')}"`,
    ],
  },
  {
    n: 146,
    day: '2026-10-13',
    lines: () => {
      const sword = WEAPON_BY_ID.get('short_sword');
      if (!sword) return [];
      const name = itemDef(sword.id).name.toLowerCase();
      const s = (n: number): string => String(+n.toFixed(2));
      // The fighting from which the old clock (a job's, `goSeconds`) held a short sword on the job floor.
      const flat = Array.from({ length: 100 }, (_, i) => i + 1).find((f) => goSeconds(sword.swing, f) <= ACTION_FLOOR + 1e-9) ?? 100;
      return [
        `Changed: swing and draw time from action timing to the weapon's own seconds less skill: ${name} ${sword.swing} s before skill, ${s(swingSeconds(sword.swing, 1))} at fighting 1, `
          + `${s(swingSeconds(sword.swing, 30))} at fighting 30. Was: action weight at ${s(ACTION_PACE)} s per unit, minimum `
          + `${s(ACTION_FLOOR)} s: ${name} ${s(goSeconds(sword.swing, 1))} s at fighting 1, ${s(goSeconds(sword.swing, 30))} at fighting 30, `
          + `and from fighting ${flat} no quicker than a knife.`,
        `Added: minimum swing or draw ${SWING_FLOOR.toFixed(1)} s. Fighting (archery for draws) and body control reduce it by the same % as before; `
          + 'tired or wounded arms add the same. Armour, carried load and wagons (driven or not) do not affect swing time.',
        'Changed: weapon hover A swing every shows your current swing seconds, with base seconds and each modifier on the line below. '
          + 'Examine and the target panel use that time.',
      ];
    },
  },
  {
    n: 147,
    day: '2026-10-13',
    lines: () => [
      'Changed: layout and wording of every window, menu and bar (Runecut day and night, Classic, phone). Includes: '
        + 'right-click menu, toolbar list and every question box keyboard-operable (arrows, Enter, Esc); Drop, Send away, Leave, removing a map mark '
        + 'and resetting keys ask for confirmation; empty lists say what to do; no unreadable truncation on phones.',
      'Added: hover card on pack and store items: weight, damage, tool use, capacity or feed value. '
        + 'Armour, shields and weapons show plain quality, no working-quality arrow (work tools only).',
      'Changed: with no free space the size of a window, it opens at the space available and grows back when room appears, instead of overlapping a window or bar.',
    ],
  },
  {
    n: 148,
    day: '2026-10-13',
    lines: () => [
      `Added: ${armourSwingSays()}`,
      `Added: ${overburdenSwingSays()} Carry capacity ${CARRY_BASE} kg +${CARRY_PER_STRENGTH} per body strength point, plus trade perks, Power's Pack Mule and a Packmule enchantment on a pack.`,
      `Added: both apply after the ${SWING_FLOOR.toFixed(1)} s floor, island and browser alike, multiplying with tired and wounded arms. `
        + 'Weapon hover lists each under A swing every, with its %.',
    ],
  },
  {
    n: 149,
    day: '2026-10-13',
    lines: () => [
      'Added: status panel effect row: round marks left for buffs (rest, meal boost, tincture boost, favour, Calm, spells and techniques, lit light, worn enchantments, settlement baubles), '
        + 'square red marks right for harms (wounds, bleeding, venom, burns, hunger and thirst, overload, winded or tired arms, darkness). '
        + 'Time left under each; hover or tap for exact effect and source. Removed: the separate rest, meal, favour, light and Overloaded lines and the wound list.',
      'Added: progress ring at the mouse pointer for the current action, like the action bar; in a fight, once per swing or draw. Over the island only, not windows, bars or menus; not on touch screens. '
        + 'Settings, Display, Interface: Progress ring at the pointer.',
      'Added: entering a settlement\'s border shows its name near the top of the screen with your rank there or its founder; leaving shows a leaving notice. '
        + 'Settings, Display, Interface: Settlement names at the border.',
      'Added: Crafting window action queue, current action first: actions left, time at your pace, and for crafts the inputs and their source (pack, bags or a named store), '
        + 'after earlier actions take theirs. Reorder by dragging the grip or with up/down buttons; × removes; the current action is fixed.',
      'Added: hover, tab to or long-press a red tool or material in a recipe: a tree of how to make it down to gathered items, with counts needed and at hand. Click a line for that recipe.',
      'Added: Settings, Display, Interface: Colours: red–green safe or blue–yellow safe palette for every meaningful colour, windows and island. '
        + 'In every palette, better/worse, have/lack, fight odds, overload and irreversible buttons also carry a mark.',
      `Added: Runecut light options: Island clock, My computer's clock (dark from ${islandTime(LOCAL_NIGHT_STARTS)} to ${islandTime(LOCAL_NIGHT_ENDS)} local), Always day, Always night.`,
    ],
  },
  {
    n: 150,
    day: '2026-10-13',
    lines: () => [
      `Added: Mind logic from prospecting ${percent(PROSPECT_HEAD)} of an action, `
        + `taming offerings ${percent(TAME_HEAD)}, setting an enchantment scroll ${percent(ENCHANT_HEAD)}, digging a treasure hoard ${percent(HOARD_HEAD)}; ${percent(TRY_LEARN)} of that `
        + 'on a refused offering or failed scroll. Skills window and Help (What the characteristics are for) list what raises each characteristic.',
      `Added: ${armourSwingSays()}`,
      'Fixed: spells on you keep their remaining time through a reload and stay in sync each beat. Added: status panel mark for a Warder skin on you '
        + '(size as a % of your health, and caster); also for pending Thicken, Ward Link, Stoneskin and Bastion of Stone.',
      `Added: exchange items with someone within ${num(BARTER_REACH)} tiles: right-click them or Trade in the Social window. Once accepted, `
        + 'each adds pack items (part stacks allowed) and silver; both press Accept. Any change clears both Accepts; '
        + `the exchange is all or nothing. Cancelled by moving more than ${num(BARTER_REACH)} tiles apart, leaving, or ${dur(BARTER_IDLE)} without change.`,
      `Added: seasonal fruit, bushes and forage/botanize finds: ${SEASONS.map((season) => `${season}: ${listed(Object.entries(FRUITING)
        .filter(([, in_]) => in_.includes(season)).map(([id]) => itemDef(id).name.toLowerCase()))}`).join('; ')}. `
        + 'Out of season, Pick fruit and Harvest give the next bearing time; Examine and the tile window give seasons; everything else all year.',
      `Added: skep (ropemaking), set among wildflowers: 1 honey per ${SKEP_CLUMP_HOURS} h per flowering clump within ${num(SKEP_REACH)} tiles, `
        + `1 beeswax per ${num(SKEP_WAX_EVERY)} honey, up to ${SKEP_HOLDS} honey; nothing in ${SKEP_IDLE}. Take honey empties it, trains animal husbandry. Help: Bees.`,
      `Added: butter churn (carpentry): a bucket of milk into ${num(BUTTER_PATS)} pats of butter, bucket returned; butter and dough bake into pastries. `
        + `Female Gorral milkable: ${num(GORRAL_MILK)} L a milking into a part bucket, full at ${num(BUCKET_LITRES)}. Help: Milk, butter and cheese.`,
      `Added: vineyards: build a trellis; cut a grape cutting from a thorn bush with a sickle; plant at the trellis foot. Bears from ${num(VINE_BEARS)} days after planting, `
        + `${GRAPE_SEASON} only; ${num(GRAPE_WINE_GRAPES)} grapes brew a barrel of grape wine. Wine and grape wine +${WINE_AGE_RATE} QL a day in their barrel `
        + `once finished, ageing ${mult(CELLAR_AGEING)} in a cellar, up to +${WINE_AGE_CAP} QL; drinking from the barrel uses the aged QL. Help: Vineyards.`,
      `Added: Draw a map (papyrus): records tiles round you, ${num(CHART_LEAST)} each way +1 per ${CHART_QL_PER_TILE} QL. `
        + 'Study map adds that square to your map permanently; Copy map makes another, capped at the map and sheet QL. Help: Maps.',
    ],
  },
  {
    n: 151,
    day: '2026-10-13',
    lines: () => [
      'Changed: a bucket drawn from a non-water barrel takes the barrel\'s QL incl. ageing gain (aged wine sells and exchanges at aged QL). '
        + 'Pouring into an empty barrel sets its QL; into the same contents, the litre-weighted average; a brew poured into stops ageing.',
      `Added: mead ageing: +${MEAD_AGE_RATE} QL a day in its barrel, ageing ${mult(CELLAR_AGEING)} in a cellar, up to +${MEAD_AGE_CAP} QL.`,
      `Added: pressing a bucket of milk into cheese leaves it full of whey. Whey fed to your wildermon fills ${percent(WHEY_FEED)} hunger `
        + `(1 diet item: ${percent(GRAZE_FILL)}), bucket returned empty; feed button offers whey first.`,
      'Fixed: island treasure hoard digging trains digging and wears the shovel, as offline.',
      `Added: Settlement window Notices and Work tabs. Founder and ranks with Post notices post up to ${NOTICE_MAX} characters; newest ${NOTICE_KEEP} kept; `
        + `absent citizens see new ones on coming ashore; absent more than ${num(NOTICE_MAIL_DAYS)} days: each sent as a letter. `
        + `Founder and ranks with Set work list up to ${num(WORK_OPEN_MAX)} wanted works (kind, count, optional minimum QL); a citizen within ${num(DELIVER_REACH)} tiles `
        + 'of the totem presses Deliver to move matching pack items into the settlement crate; deliveries go in the settlement ledger.',
      'Added: founder or a rank with Keep the stores can make a settlement crate or storage piece a settlement store (its Storage window). Opens for the founder and ranks '
        + `with Use the stores, padlocked or not, for nobody else, key or not; every take and put logged, last ${STORE_LOG_CAP} shown in the Settlement window.`,
      `Added: bench or anvil work at QL ${SIGN_QL}+ carries your name; Sign once with up to ${SIGN_MAX} characters, shown on Examine. `
        + `Glass panels take dye at ${num(DYE_PANE_LITRES)} L a panel; windows and bay windows tinted the last fitted panel's colour, both sides.`,
      `Added: ${blockSays()}`,
      `Added: ${reachSays()}`,
    ],
  },
  {
    n: 152,
    day: '2026-10-13',
    lines: () => [
      `Changed: trellises stand against a wall's outside, full width. ${TRELLIS_RULE()}`,
      'Changed: adjacent trellises on 1 wall join into 1 lattice. Existing trellises keep their vines; where several stood in 1 row, '
        + 'the one with a vine (else the oldest) stays and the rest return to their owner\'s pack, planted vines as grape cuttings.',
      'Changed: items of 1 kind keep 1 place in every list, best first, not reordering as used; pour, smelt, melt-down and '
        + 'cast menus show each item\'s QL, and moulds their damage.',
    ],
  },
  {
    n: 153,
    day: '2026-10-14',
    lines: () => [
      `Fixed: Shear missing from the wildermon menu; now beside Milk: carving knife, fleece ${percent(SHEAR_FROM)} regrown, `
        + `${num(SHEAR_WOOL)} wool from a full fleece.`,
    ],
  },
  {
    n: 154,
    day: '2026-10-14',
    lines: () => [
      'Fixed: favour showed zero after logout or reload. Status panel and Faith window now read it '
        + 'from the island on coming ashore and every beat, with accrued favour.',
    ],
  },
  {
    n: 155,
    day: '2026-10-14',
    lines: () => [
      'Fixed: corners lowered by a mining slab breaking away, chipped back, or by dropped dirt showed their new height only after reload; now at once for everyone.',
      `Added: improvable: ${['brush', 'hammer', 'fishing_rod', 'rope_tool'].map((id) => {
        const how = improvable(id);
        return `${itemDef(id).name.toLowerCase()} (${how?.material.name}, ${(SKILL_BY_ID.get(how?.skill ?? '')?.name ?? how?.skill ?? '').toLowerCase()})`;
      }).join(', ')}. Brush QL adds to the care per grooming.`,
      'Changed: Sacrifice, melt-down and Bauble of Regret refuse items marked Keep this back with "It is kept back. Put it back in the pack first." '
        + '(the pack menu\'s wording).',
    ],
  },
  {
    n: 156,
    day: '2026-10-14',
    lines: () => [
      'Fixed: a wildermon under a vehicle could not be clicked to hitch. Added: Hitch to the traces on a cart or wagon menu with a free yoke, '
        + 'listing each of your wildermon that fits.',
    ],
  },
  {
    n: 157,
    day: '2026-10-15',
    lines: () => [
      'Changed: a hitched companion no longer counts as following you; another can be let out of its crate.',
      `Added: Hitch to the traces also lists your wildermon in ${itemDef('creature_crate').name.toLowerCase()}s in your pack or within reach; each goes straight from crate to yoke.`,
      `Changed: unhitched, one of yours follows you only if nothing else does; others go into empty ${itemDef('creature_crate').name.toLowerCase()}s in your pack; too few: they stay hitched, with the number of crates needed.`,
    ],
  },
  {
    n: 158,
    day: '2026-10-15',
    lines: () => [
      'Added: Go over the side (replaces Step ashore with no land in reach): puts you in the water beside the boat, which stays. '
        + `Dry ground within ${num(SHORE_REACH)} tiles: Step ashore as before.`,
      'Added: from the water beside a boat: climb aboard, board as passenger, or take an empty helm, as from shore.',
    ],
  },
  {
    n: 159,
    day: '2026-10-15',
    lines: () => [
      'Changed: names keep the capitals typed at account creation (Alice, not alice). Sign-in is case-insensitive (alice and Alice are 1 account); '
        + 'signing in with different capitals changes your displayed name on every island. Capitals only, not letters.',
    ],
  },
  {
    n: 160,
    day: '2026-10-16',
    lines: () => [
      'Changed: dirt dropped on a kelp tile (at your feet or a corner) turns it to dirt, as on grass, sand or reed bed; kelp removed.',
    ],
  },
  {
    n: 161,
    day: '2026-10-16',
    lines: () => [
      'Changed: action count menus offer Once and 5, 10, 25 or 50 times. Removed: Until you stop.',
    ],
  },
  {
    n: 162,
    day: '2026-10-16',
    lines: () => [
      `Changed: every mould formed with ${SKILL_BY_ID.get(MOULD_SKILL)?.name.toLowerCase()}; QL = your ${SKILL_BY_ID.get(MOULD_SKILL)?.name.toLowerCase()}, never the sand's. `
        + 'Was: sword, axe, armour, ring and pendant moulds used the cast piece\'s skill.',
      `Changed: pouring a mould and casting an anvil train ${SKILL_BY_ID.get(MOULD_SKILL)?.name.toLowerCase()}. Fixed: island pours trained nothing.`,
    ],
  },
  {
    n: 163,
    day: '2026-10-16',
    lines: () => [
      `Added: Vesp settlement task: ${GATHER_VERB.hive}. Set from its menu or crate; goes to the nearest hive in reach `
        + 'and works it; the hive fills with honey and beeswax meanwhile. Brings nothing to the crate; no hive in reach: reports it after an hour.',
    ],
  },
  {
    n: 164,
    day: '2026-10-16',
    lines: () => [
      'Fixed: windows restored to exact position and size after refresh or browser restart. '
        + 'Was: re-laid out on load, could be a cell off or smaller; the keeper\'s window lost its place to any window saved before it.',
    ],
  },
  {
    n: 165,
    day: '2026-10-16',
    lines: () => [
      `Changed: mote swirls per ${RESET} from 500 to ${num(SWIRLS_A_DAY)}, from the next one.`,
    ],
  },
  {
    n: 166,
    day: '2026-10-16',
    lines: () => [
      'Fixed: island flattening, bedding or taking up paving, cutting reeds and prospecting wore no tool. '
        + 'Each action now wears the best such tool in your pack by 1 use, as digging does; 2 of a tool alternate.',
    ],
  },
  {
    n: 167,
    day: '2026-10-16',
    lines: () => [
      `Added: hostile marking: every hunt-on-sight wild creature, and any creature hunting you, overlaid in red above trees and buildings in front of it, ${percent(THREAT_SHADE)} strength, ${percent(THREAT_SHADE_HUNTING)} while hunting you, `
        + 'with a red head marker that pulses while hunting you. Toggle: Settings, Mark hostile creatures.',
    ],
  },
  {
    n: 168,
    day: '2026-10-16',
    lines: () => [
      `Added: Health window (menu, or key ${keyName(BIND_BY_ID.get('win_health')?.keys[0] ?? '')}): health as a heart beating faster as it drops; `
        + 'every wound on a body figure and in a list, worst first, with damage per minute and time to close. '
        + 'Clicking a wound shows treatments, what each needs carried (dressing, bucket of lye or salve), '
        + 'how many you carry and how to make one; its button dresses, cleans or salves that wound only, or says why not. '
        + 'Below: effects against and for you, and nutrition with each kind\'s effect. Birch and linen frame.',
    ],
  },
  {
    n: 169,
    day: '2026-10-17',
    lines: () => [
      `Added: building walls, floors, frames, bridges and aqueducts takes materials from crates, carts, wagons and containers within ${CRAFT_REACH} tiles `
        + '(the containers crafting uses), after your pack and a crate on the tile. '
        + 'Toggle: Settings, Use stores within reach. Mason\'s Hod Carrier still reaches further on stone, also with it off.',
    ],
  },  {
    n: 170,
    day: '2026-10-17',
    lines: () => [
      `Added: Equipment window (menu, or key ${keyName(BIND_BY_ID.get('win_equipment')?.keys[0] ?? '')}): your figure on a turntable in worn gear, a socket for each of ${num(SLOTS.length)} slots. `
        + 'Drag onto a socket or the figure to equip, back to the pack shelf to remove; the shelf shows each item\'s change versus what is worn. '
        + 'Tabs give every fight number read off you, each from the fight rule (blow, blow taken, carry cost), '
        + 'and each skill behind them with its contribution now and at its next level. Stance selectable there. Oak and iron frame.',
    ],
  },
  {
    n: 171,
    day: '2026-10-17',
    lines: () => [
      'Fixed: island journal goals ticked from other players\' trap catches, walls and second storeys, '
        + 'or a settlement you are only a citizen of. Only your own work counts.',
      'Fixed: goals now count what they say: smelting = charging a smelter with ore (lumps never counted); '
        + 'Improve = your pass leaving it at QL 50 or 90; field = seed sown; hive = honey taken out (skeps count); '
        + 'relic = one restored; bed = one you built; cart or wagon = a full team yoked; fantastic trait = one bred; '
        + 'campfire cooking = anything Crafting cooks at one; enchanted melee weapon = a melee weapon (any enchanted item counted); '
        + 'dyed banner = one on your settlement; caravel = a sailing boat; Make dye renamed Dye something (what it counted). '
        + 'Done before today under the old rule: ticks next time you do it.',
      'Added: click a goal for how to do it, or Show every how-to above the list.',
    ],
  },
  {
    n: 172,
    day: '2026-10-18',
    lines: () => [
      `Added: Put away (Inventory): each loose stack goes into a crate, chest or cart within ${STORE_REACH} tiles already holding the same item. `
        + `Stores window shows total count of the searched item; Within ${CRAFT_REACH} tiles limits it to the containers crafting uses.`,
      'Added: Crafting: List adds a recipe to the Shopping list window, with every input down to gathered, cast or intermediate items, against your pack and containers in reach, '
        + 'each item counted once across branches. To… crafts until you hold the target count, counting what you have, and tops up after a failed action.',
      `Added: Map: double-click, or Go on a pin, to walk there in legs of up to ${TRAVEL_LEG} tiles, any distance. Fixed: island pins lost on refresh; now kept in this browser.`,
      `Added: Settings, Eating: auto-eat when Food falls under ${AUTO_EAT_AT.filter((v) => v).map((v) => `${Math.round(v * 100)}%`).join(', ')} (choose), after the current action, never from a locked stack. `
        + `Notices: a worn or held item at ${DAMAGE_WARN}% damage; food on the ground near you under ${Math.round(ROT_SOON / 60)} min from rotting; ground items show time left in their tooltip and Pick up menu.`,
      'Changed: Wildermon Needs attention shows only hungry, hurt, needing a brush, or about to give birth. Fixed: Equipment and Health keys open their windows again.',
    ],
  },
  {
    n: 173,
    day: '2026-10-18',
    lines: () => {
      const ids = ['kemma', 'sheela', 'salva', 'carra', 'tanna', 'grista', 'wicka', 'brambo', 'grazza', 'siffa'];
      return [
        `Added: ${num(ids.length)} wildermon with settlement tasks:`,
        ...ids.map((id) => `${SPECIES[id].name} (taming ${SPECIES[id].tameLevel}): ${GATHER_DO[SPECIES[id].gathers!]}.`),
      ];
    },
  },
  {
    n: 174,
    day: '2026-10-18',
    lines: () => {
      const ids = ['forga', 'potta', 'cindra', 'hoppa', 'simma', 'relka', 'bedda', 'wurla', 'sprigga', 'ambra', 'petta', 'scurra'];
      return [
        `Added: ${num(ids.length)} more wildermon with settlement tasks:`,
        ...ids.map((id) => `${SPECIES[id].name} (taming ${SPECIES[id].tameLevel}): ${GATHER_DO[SPECIES[id].gathers!]}.`),
        'Fixed: offline, a working plucka skipped every fruit tree round it.',
      ];
    },
  },
  {
    n: 175,
    day: '2026-10-18',
    lines: () => {
      const ids = ['rippa', 'chissa', 'mudda', 'cordra', 'flecha', 'papra', 'glossa', 'dippa'];
      return [
        `Added: ${num(ids.length)} more wildermon with settlement tasks:`,
        ...ids.map((id) => `${SPECIES[id].name} (taming ${SPECIES[id].tameLevel}): ${GATHER_DO[SPECIES[id].gathers!]}.`),
        'Added: they never fail a cycle; output QL at their own skill. Locked stacks untouched.',
      ];
    },
  },
  {
    n: 176,
    day: '2026-10-18',
    lines: () => {
      const ids = ['testa', 'skulka', 'gasha', 'thumpa', 'spitta', 'awla', 'sparra'];
      return [
        `Added: ${num(ids.length)} wildermon with their own fighting style, as companion or settlement guard:`,
        ...ids.map((id) => `${SPECIES[id].name} (taming ${SPECIES[id].tameLevel}): ${STYLE_SAYS[SPECIES[id].style!]}.`),
      ];
    },
  },
  {
    n: 177,
    day: '2026-10-18',
    lines: () => [
      `Added: ${num(ABLE_NEWS.length)} wildermon that use an ability instead of a blow in a fight, then rest:`,
      ...ABLE_NEWS
        .map((id) => `${SPECIES[id].name} (taming ${SPECIES[id].tameLevel}), ${abilityName(SPECIES[id].ability!)}: ${abilitySays(SPECIES[id].ability!)}.`),
      'Fixed: offline, a skin over you now absorbs incoming blows, as on an island.',
    ],
  },
  {
    n: 178,
    day: '2026-10-18',
    lines: () => [
      'Changed: wildermon level from 1 + 1/5 of its skill to its skill, rounded down.',
      // As it was that day: the Roxxen's, by pulling, came later (212).
      ...Object.values(SPECIES).filter((d) => d.learns && d.learns.by !== 'pull')
        .map((d) => `${d.name}: learns ${SKILL_BY_ID.get(d.learns!.skill)?.name.toLowerCase() ?? d.learns!.skill} ${LEARNS_SAYS[d.learns!.by]}.`),
    ],
  },
  {
    n: 179,
    day: '2026-10-18',
    lines: () => {
      const d = SPECIES.rabba;
      const [one, two] = d.stages!;
      return [
        `Changed: ${d.was![0]} renamed ${d.name}. Evolves into ${one.name} at level ${EVOLVE_AT[0]}, ${two.name} at level ${EVOLVE_AT[1]}.`,
        `Added: ${one.name}: ${stageSays(1)} than a ${d.name}; ${two.name}: ${stageSays(2)}.`,
        'Added: new models for all 3 (walk, strike, rooting, voice); evolving has a visual and a sound.',
        `Changed: old ${d.was![0]} carcasses butcher as ${d.name}.`,
        'Changed: carcasses drawn as a heap of hide and bones, not a sack.',
      ];
    },
  },
  {
    n: 180,
    day: '2026-10-18',
    lines: () => [
      `Added: skills continue past ${SKILL_TOP}, for leaderboards only: gain per action ×${percent(1 / PAST_TOP)} per point already over, so each point past ${SKILL_TOP} takes ×${PAST_TOP} the actions of the one before.`,
      `Added: every skill effect caps at ${SKILL_TOP} (output, success chance, speed unchanged). Skills window and boards show the full value.`,
    ],
  },
  {
    n: 181,
    day: '2026-10-18',
    lines: () => (['quarra', 'mola'] as const).flatMap((id) => {
      const d = SPECIES[id];
      const [one, two] = d.stages!;
      return [
        `Changed: ${d.was![0]} renamed ${d.name}. Evolves into ${one.name} at level ${EVOLVE_AT[0]} (${stageSays(1)}) and ${two.name} at level ${EVOLVE_AT[1]} (${stageSays(2)}); both vs ${article(d.name)} ${d.name}. New models for all 3 (walk, strike, work, voice).`,
      ];
    }),
  },
  {
    n: 182,
    day: '2026-10-18',
    lines: () => {
      const storey = OUTSIDE_STAIR_LEVEL + 1;
      return [
        `Added: outside staircases, wide or single: on an open-ground tile sharing a side with the footprint of a building of ${num(storey)}+ storeys; climbs from the ground to storey ${storey}. Tile menu: Plan outside staircase, Plan outside ${SINGLE_STAIRS_NAME}; cost as indoors, ${percent(STAIRS_SHARE)} or ${percent(SINGLE_STAIRS_SHARE)} of a solid wall's materials; Q and E rotate.`,
        'Added: head against the building, foot on the ground. Refused in water, on a tree or bush, under a jetty or bridge, off your settlement, or on ground higher than the ground floor. Ladders still go inside the footprint.',
        `Added: enter from the ground; exit at the head onto storey ${storey} through a door, double door, arch or no wall; leave by its sides or foot back to the ground. Not part of the storey: no walls needed round it, no roof over it, no wall below carries it; nothing else planned on its tile.`,
      ];
    },
  },
  {
    n: 183,
    day: '2026-10-18',
    lines: () => [
      'Changed: marble floor look from white octagons with dark diamonds to 1 jointless polished white slab with grey veins. Cost and effect unchanged.',
    ],
  },  {
    n: 184,
    day: '2026-10-18',
    lines: () => {
      const line = (id: 'vola' | 'warda', task: boolean, moves: string): string => {
        const d = SPECIES[id];
        const [one, two] = d.stages!;
        return `Changed: ${d.was![0]} renamed ${d.name}. Evolves into ${one.name} at level ${EVOLVE_AT[0]} (${stageSays(1, task)}) and ${two.name} at level ${EVOLVE_AT[1]} (${stageSays(2, task)}); both vs ${article(d.name)} ${d.name}. New models for all 3 (${moves} voice).`;
      };
      return [
        line('vola', true, 'walk, strike, botanizing,'),
        line('warda', false, 'walk, strike, idle look-about,'),
      ];
    },
  },  {
    n: 185,
    day: '2026-10-18',
    lines: () => {
      const d = SPECIES.woola;
      const [one, two] = d.stages!;
      return [
        `Changed: ${d.was![0]} renamed ${d.name}. Evolves into ${one.name} at level ${EVOLVE_AT[0]} (${stageSays(1, false, true)}) and ${two.name} at level ${EVOLVE_AT[1]} (${stageSays(2, false, true)}); both vs ${article(d.name)} ${d.name}. New models for all 3 (cloud fleece from full to shorn, walk, strike, graze, shake, voice).`,
        'Fixed: offline, a digger\'s clay or sand yield raised by its yield traits as well as digging, as on an island.',
      ];
    },
  },
  {
    n: 186,
    day: '2026-10-19',
    lines: () => {
      const d = SPECIES.crawler;
      const [one, two] = d.stages!;
      return [
        `Changed: ${d.was![0]} renamed ${d.name}. Evolves into ${one.name} at level ${EVOLVE_AT[0]} (${stageSays(1)}) and ${two.name} at level ${EVOLVE_AT[1]} (${stageSays(2)}); both vs ${article(d.name)} ${d.name}. New models for all 3: hermit crab, sand-heaped shell to a crown of shells and coral (walk, strike, digging, voice).`,
      ];
    },
  },
  {
    n: 187,
    day: '2026-10-19',
    lines: () => {
      const d = SPECIES.seavic;
      const [one, two] = d.stages!;
      return [
        `Changed: ${d.was![0]} renamed ${d.name}. Evolves into ${one.name} at level ${EVOLVE_AT[0]} (${stageSays(1)}) and ${two.name} at level ${EVOLVE_AT[1]} (${stageSays(2)}); both vs ${article(d.name)} ${d.name}. New models for all 3: leaf-backed piglet, plough-snouted hog, tusked boar (walk, strike, field work, voice).`,
      ];
    },
  },
  {
    n: 188,
    day: '2026-10-19',
    lines: () => {
      const up = 2;
      return [
        `Added: ramp bridges: ends more than ${metres(END_SLOP)} m apart: deck rises evenly, at most ${metres(RAMP_SLOPE)} m per deck tile. Ends may be on different storeys, ground and a storey, or 2 banks. Storey height ${metres(WALL_HEIGHT)} m: 1 storey up needs ${rampTiles(WALL_HEIGHT)}+ deck tiles; ground to storey ${up + 1} (${metres(up * WALL_HEIGHT)} m) needs ${rampTiles(up * WALL_HEIGHT)}+. Too steep: refused, stating the tiles needed.`,
        'Added: step on at the storey of the end you enter from, off at the storey of the end you leave onto. Each span costs as on a level bridge (1 span bill per deck tile). Cart-carrying kinds carry carts only with both ends on the ground; drawbridges stay level.',
        'Fixed: island bridges set out to a storey were carried at the ground under their ends; now at that storey\'s floor, as offline.',
      ];
    },
  },
  {
    n: 189,
    day: '2026-10-19',
    lines: () => {
      const d = SPECIES.noot;
      const [one, two] = d.stages!;
      return [
        `Changed: ${d.was![0]} renamed ${d.name}. Evolves into ${one.name} at level ${EVOLVE_AT[0]} (${stageSays(1)}) and ${two.name} at level ${EVOLVE_AT[1]} (${stageSays(2)}); both vs ${article(d.name)} ${d.name}. New models for all 3: clay-caked burrower in teal-glazed armour to a great mole carrying clay pots (walk, strike, digging, voice).`,
        `Changed: butchering ${article(d.name)} ${d.name} gives up to ${d.butcher.clay} ${itemDef('clay').name.toLowerCase()} instead of feathers, by your butchering's % of the carcass, island and offline.`,
      ];
    },
  },
  {
    n: 190,
    day: '2026-10-19',
    lines: () => {
      const d = SPECIES.whispet;
      const [one, two] = d.stages!;
      const food = d.diet.map((id) => itemDef(id).name.toLowerCase());
      return [
        `Added: ${d.name}, wild only ${seasonSays(d.season!)}${d.nocturnal ? ', after dark' : ''}, by UTC calendar. Other days: none spawn and wild ones vanish, island and offline; tamed, kept or bred ones stay all year.`,
        `Added: taming ${d.tameLevel}, base ${percent(d.tameChance)} per offering; takes ${listedOr(food)} from your hand. Tamed: uses ${abilityName(d.ability!)} in a fight: ${abilitySays(d.ability!)}. Wild: fights like any other and always strikes back when struck.`,
        `Added: evolves into ${one.name} at level ${EVOLVE_AT[0]} (${stageSays(1, false)}) and ${two.name} at level ${EVOLVE_AT[1]} (${stageSays(2, false)}); both vs ${article(d.name)} ${d.name}. Level = body strength, learned keeping watch over a settlement. Butchering: up to ${num(d.butcher.gland ?? 0)} ${itemDef('gland').name.toLowerCase()}s only. Drawn as a Lume until it has its own model.`,
      ];
    },
  },
  {
    n: 191,
    day: '2026-10-19',
    lines: () => {
      const d = SPECIES.bevere;
      const [one, two] = d.stages!;
      return [
        `Changed: ${d.was![0]} renamed ${d.name}. Evolves into ${one.name} at level ${EVOLVE_AT[0]} (${stageSays(1)}) and ${two.name} at level ${EVOLVE_AT[1]} (${stageSays(2)}); both vs ${article(d.name)} ${d.name}. New models for all 3: beaver kit, mantle of wood shingles and leaves, crest of split planks (walk, strike, gnawing, voice).`,
        'Fixed: offline, felled log yield raised by its yield traits as well as woodcutting, as on an island.',
      ];
    },
  },
  {
    n: 192,
    day: '2026-10-19',
    lines: () => {
      const d = SPECIES.embra;
      const [one, two] = d.stages!;
      return [
        `Changed: ${d.was![0]} renamed ${d.name}. Evolves into ${one.name} at level ${EVOLVE_AT[0]} (${stageSays(1)}) and ${two.name} at level ${EVOLVE_AT[1]} (${stageSays(2)}); both vs ${article(d.name)} ${d.name}. New models for all 3: snail with a fire-lit shell, larger and hotter per stage (glide, strike, stoking, voice).`,
        `Fixed: description now states its settlement task: keeps every campfire, smelter and kiln in reach fuelled from your settlement stores when under ${HEARTH_FULL / 60} min of fuel, relighting if out.`,
        `Fixed: help listed Embra as silver-vulnerable. Silver damage ${mult(BANE_BONUS)} only on light-carrying kinds: ${listedOr(Object.values(SPECIES).filter((s) => s.glow).map((s) => `${article(s.name)} ${s.name}`))}.`,
      ];
    },
  },
  {
    n: 193,
    day: '2026-10-19',
    lines: () => {
      const d = SPECIES.whispet;
      const [one, two] = d.stages!;
      return [
        `Added: own models for ${d.name}, ${one.name} and ${two.name} (were Lume): round pearly ghost; sheet ghost in a purple witch hat with a jack-o'-lantern; tall tattered veil under a torn lantern-hung hat. Each with its own float, strike, ${abilityName(d.ability!)} effect (swell, ring of violet wisps), evolve mist and voice.`,
      ];
    },
  },
  {
    n: 194,
    day: '2026-10-19',
    lines: () => [
      `Fixed: island wildermon ability use looked like an ordinary blow; now drawn and heard as offline. ${num(Object.values(SPECIES).filter((d) => d.ability).length)} kinds have one, incl. the ${SPECIES.whispet.name}'s ${abilityName(SPECIES.whispet.ability!)}.`,
    ],
  },
  {
    n: 195,
    day: '2026-10-19',
    lines: () => [
      `Added: Build wall, Build floor and every row building a planned piece (stairs, roof, railing, jetty floor) open an action count, 1 material piece an action: 1, ${listed(BUILD_COUNTS.map(String))} where the piece needs more than that, or all it needs, up to ${MOST_GOES}. Stops early when finished or when nothing needed is at hand. Was: island Build fitted 1 piece.`,
    ],
  },
  {
    n: 196,
    day: '2026-10-19',
    lines: () => [
      `Changed: the occasional altar sacrifice drop (${percent(SOUL_CHANCE)}) from mote to soul, distinct from swirl motes. Same effect: Absorb into (on the soul) gives an ordinary item its rarity. Held ones converted.`,
    ],
  },
  {
    n: 197,
    day: '2026-10-19',
    lines: () => {
      const stitch = CLASS_SPELL_BY_ID.get('chirurgeon_quick_stitch')!, mass = CLASS_SPELL_BY_ID.get('chirurgeon_mass_dressing')!;
      return [
        `Fixed: island ${stitch.name} and ${mass.name} targeted your first wound, not your worst. `
          + `Now the worst: ${stitch.name} closes it by ${percent(stitch.fx.close)} of its severity; `
          + `${mass.name} stops its bleeding and closes it by ${percent(mass.fx.close)}.`,
      ];
    },
  },
  {
    n: 198,
    day: '2026-10-19',
    lines: () => {
      const lair = REGIONS.find((R) => R.lair?.includes('dragon'))!;
      const grand = TREASURE_TIERS.find((t) => t.guard === 'dragon')!;
      return [
        `Changed: dragons spawn only on ${lair.name} (1 spawned on the Crescent). ${capital(grand.name)} hoards (dragon-guarded) `
          + `buried on ${lair.name} wherever the map was found; held maps pointing elsewhere now point there.`,
        'Fixed: wildermon spawned before their kind was renamed kept the old name, so newly tamed ones were still called '
          + `${['rabba', 'bevere'].map((id) => FORMER_NAME[id]).join(' or ')}. All still named their kind's old name renamed; `
          + 'player-given names kept.',
      ];
    },
  },
  {
    n: 199,
    day: '2026-10-19',
    lines: () => {
      // Whether the runes up a token count its workers too: so long as one more may work at each level, starting from one.
      const workers = [1, 2, MAX_DEED_LEVEL].every((l) => deedWorkersAt(l) === l);
      // What each level asked for, as the settlement menu lists it.
      const asked = (level: number): string => listed((DEED_UPGRADES[level] ?? []).map((r) => r.label.toLowerCase()));
      return [
        `Changed: settlement totem look from a plain pillar to carved stone, 1 block per settlement level up to ${MAX_DEED_LEVEL}, `
          + `each with 1 lit rune: lit runes = settlement level${workers ? ' = wildermon worker slots' : ''}. `
          + `Block carvings by level requirement: fire bowl (${asked(2)}), iron bands (${asked(3)}), winged bird (${asked(4)}), `
          + `roofed crown with carved wildermon heads (${asked(5)}). `
          + 'No light: runes and fire-bowl embers glow but light nothing.',
      ];
    },
  },
  {
    n: 200,
    day: '2026-10-19',
    lines: () => [
      `Fixed: ${SPECIES.cobbe.name.toLowerCase()} idled when the nearest planned wall needed something not in your settlement stores; on an island `
        + 'it took only from crates. Now: nearest wall needing something your settlement stores hold, '
        + 'from any of your settlement stores on the settlement, bringing what that wall lacks most first (brick and mortar together). '
        + 'Changed: island errand workers take only from your own settlement stores.',
    ],
  },
  {
    n: 201,
    day: '2026-10-19',
    lines: () => {
      const lair = REGIONS.find((R) => R.lair?.includes('dragon'))!;
      return [
        'Fixed: slow frame rate and input with working wildermon: task, strike and stationary ability poses '
          + 'now drawn once and cached, as walking and standing were. Evolving and rare shine still drawn per frame.',
        `Removed: every wild dragon outside ${lair.name}, island and offline; trapped ones stay.`,
      ];
    },
  },
  {
    n: 202,
    day: '2026-10-19',
    lines: () => [
      `Fixed: wildermon kept their kind's name after evolving (a ${SPECIES.seavic.name} grown into a ${SPECIES.seavic.stages![1].name} still `
        + `named ${SPECIES.seavic.name}). One named only its kind's name, an evolution stage name, or its kind's former name is renamed for its current evolution stage `
        + 'on evolving; all existing ones updated. Player-given names kept.',
    ],
  },
  {
    n: 203,
    day: '2026-10-19',
    lines: () => [
      `Fixed: a wildermon assigned to your settlement from afar walks back before starting its task, ${num(HOME_LEG)} tiles a leg, `
        + `once more than ${num(HOME_SLACK)} tiles past its work area. Was: menders, hod carriers, stokers and other errand workers `
        + 'with nothing to do from the assignment spot stood there forever; one walking home in 1 long leg was invisible and unselectable to those nearby.',
    ],
  },
  {
    n: 204,
    day: '2026-10-19',
    lines: () => [
      'Fixed: island frozen from 16:57 UTC until this fix: clock rounds timed out while a hod carrier chose its wall '
        + '(it scanned every piece of furniture on the island once per planned wall). '
        + 'Nothing moved, wildermon could not be used, finally the island would not load. Now reads only your settlement stores, once per choice.',
    ],
  },
  {
    n: 205,
    day: '2026-10-19',
    lines: () => {
      const named = (action: string): string => itemDef(ARTIFACT_FOR[action]).name.toLowerCase();
      return [
        `Added: old pot, bone comb and old file restore into ${article(named('use_ancient_pot'))} ${named('use_ancient_pot')}, ${article(named('use_ancient_comb'))} ${named('use_ancient_comb')} `
          + `and ${article(named('use_ancient_file'))} ${named('use_ancient_file')}: used on your wildermon from its menu, consumed regardless of outcome. `
          + 'Old pots and files restored earlier stay ordinary clay pots and files; held bone combs became ancient combs.',
        `Added: ${named('use_ancient_comb')}: 1 age younger: old to just grown, grown to just born.`,
        `Added: ${named('use_ancient_file')}: 1 rarity step up, 1 time in ${FILE_RARITY_ODDS}, up to ${RARITIES[RARITIES.length - 1].name}; `
          + `blood-set figures ${listed(RARITIES.slice(1).map((r) => cardPct(r.blood)))} over ordinary at ${listed(RARITIES.slice(1).map((r) => r.name))}.`,
        `Added: ${named('use_ancient_pot')}: +1 point in a random one of ${num(BASE_STATS.length)} base stats not yet at ${POT_MOST}: `
          + `${listed(BASE_STATS.map((st) => st.name.toLowerCase()))}. Each point +${percent(POT_STEP)} of that stat over kind and blood, up to ${POT_MOST} a stat.`,
        'Added: Wildermon window card shows base stats as the rules read them, with ancient pot points: health, attack, speed in tiles/s, work as a multiplier.',
      ];
    },
  },
  {
    n: 206,
    day: '2026-10-19',
    lines: () => {
      const d = SPECIES.cobbe;
      const [one, two] = d.stages!;
      return [
        `Changed: ${d.was![0]} renamed ${d.name}. Evolves into ${one.name} at level ${EVOLVE_AT[0]} (${stageSays(1)}) and ${two.name} at level ${EVOLVE_AT[1]} (${stageSays(2)}); both vs ${article(d.name)} ${d.name}. New models for all 3: brick lizard, then with a mortar hod and trowel, then a brick tower (walk, strike, bricklaying, voice).`,
      ];
    },
  },
  {
    n: 207,
    day: '2026-10-19',
    lines: () => {
      // Two units, one of them supreme, off the rule (`rarityBands`).
      const s = RARITIES.findIndex((r) => r.name === 'supreme');
      const one = RARITIES.map((_, i) => (i === 0 || i === s ? 1 : 0));
      const more = rarityBands(one)[s] - rarityBands(RARITIES.map((_, i) => (i === 0 ? 2 : 0)))[s];
      const top = RARITIES.length - 1;
      return [
        `Added: rare ingredients raise output rarity chance: the % of consumed units at each of ${listed(RARITIES.slice(1).map((r) => r.name))} `
          + `is added to the chance of that rarity (2 units, 1 supreme: +${percent(more)} supreme chance). `
          + `Checked from ${RARITIES[top].name} down; first hit wins.`,
        'Added: tools, the station and a full bucket (returned empty) not counted. At the anvil the casting a piece is beaten from, '
          + 'or a coin strike\'s 1 lump, is the whole input: a rare one makes the output at least that rare.',
        `Added: an action with rare ingredients reports their effect, e.g. "${rareInputSaid(one)}"`,
      ];
    },
  },
  {
    n: 208,
    day: '2026-10-19',
    lines: () => {
      const shelf = furnitureDef('crate_shelf');
      const brick = itemDef('stone_brick').name;
      return [
        `Added: drop a stack from the inventory onto a ${shelf.name.toLowerCase()}: fills its crates in spot order (${num(shelf.crates ?? 0)} spots), `
          + 'each taking what it has room for, until the stack is gone or all are full. Remainder stays in your pack.',
        'Added: crates closed to you (others\', padlocked, or a settlement store your rank cannot use) are skipped. '
          + 'Same rules as putting into each crate in turn, at once.',
        `Added: 1 summary line, e.g. "${rackPutLine(12, 20, brick, 2, '', shelf.name)}"`,
      ];
    },
  },
  {
    n: 209,
    day: '2026-10-19',
    lines: () => [`Changed: brush bill from a plank and wool to ${recipeBill('make_brush')}.`],
  },
  {
    n: 210,
    day: '2026-10-19',
    lines: () => ['Fixed: island settlement worker slots counted neighbours\' working wildermon within sight, refusing yours with room left. Counts only yours.'],
  },
  {
    n: 211,
    day: '2026-10-19',
    lines: () => [
      `Changed: wild creatures despawn between ${dur(WILD_STAY)} and ${dur(2 * WILD_STAY)} old, at the next restock of their area, `
        + `replaced by new random picks from all ${WILD_SPECIES.length} kinds at their weights. Was: areas only refilled for kills, `
        + 'so kinds added later rarely spawned.',
      'Changed: every wild creature not being fought, tamed, marked or kept was removed; areas restock '
        + 'as people enter them, starting where you stand.',
      'Added: tamed or kept, fighting, just struck, trapped, ridden, hitched, tied to a post, stunned, marked, being offered food '
        + 'or acted on: stays until that ends. Monsters keep their own rules.',
    ],
  },
  {
    n: 212,
    day: '2026-10-19',
    lines: () => [
      `Changed: ${SPECIES.roxxen.name} level from climbing to driving; learns driving ${LEARNS_SAYS.pull}, nothing while still or unhitched.`,
      `Changed: hitched, its driving counts where other wildermon's climbing does (team pace, steepest step the wheels take). Existing ${SPECIES.roxxen.name} keep their level: climbing converted to driving.`,
    ],
  },
  {
    n: 213,
    day: '2026-10-19',
    lines: () => {
      const d = SPECIES.roxxen;
      const [one, two] = d.stages!;
      return [
        `Changed: ${d.was![0]} renamed ${d.name}. Evolves into ${one.name} at level ${EVOLVE_AT[0]} (${stageSays(1, false)}) and ${two.name} at level ${EVOLVE_AT[1]} (${stageSays(2, false)}); both vs ${article(d.name)} ${d.name}. Hitched: still +${percent(d.pull!)} team pace.`,
        'Added: new models for all 3: cream calf in a leaf mane and plain harness; then ram horns, padded collar and bell; then poles, yoke and banners (walk, trot, strike, haul, voice).',
      ];
    },
  },
  {
    n: 214,
    day: '2026-10-20',
    lines: () => [
      `Changed: a working ${SPECIES.cobbe.name} carries the hod to all planned building work in reach, not only ground-floor walls: `
        + 'walls on any storey, floors, roofs, staircases, ladders, pier decks, columns, open bridge or aqueduct spans, and foundation concrete.',
      'Added: each piece counts as 1 of your actions: bill −1; the last piece triggers what yours would '
        + '(moss or ivy start, glasshouse under a glass roof, shop counter store opens, aqueduct water runs, foundation top packed).',
      'Changed: none to target choice: the piece it carries wherever wanted, else the nearest work needing something your settlement stores hold, '
        + 'bringing whatever is furthest behind its bill.',
    ],
  },
  {
    n: 215,
    day: '2026-10-20',
    lines: () => [
      'Fixed: a wildermon assigned to your settlement from afar walked only while you were near and stopped when you left. '
        + 'Now walks the whole way home regardless.',
    ],
  },
  {
    n: 216,
    day: '2026-10-20',
    lines: () => {
      const d = SPECIES.tinka;
      const [one, two] = d.stages!;
      return [
        `Changed: ${d.was![0]} renamed ${d.name}. Evolves into ${one.name} at level ${EVOLVE_AT[0]} (${stageSays(1)}) and ${two.name} at level ${EVOLVE_AT[1]} (${stageSays(2)}); both vs ${article(d.name)} ${d.name}.`,
        'Added: new models for all 3: tinker raccoon with a spanner; then goggles, pack and mallet; then a great pack with lantern and brass wrench (walk, strike, mending, voice).',
      ];
    },
  },
  {
    n: 217,
    day: '2026-10-20',
    lines: () => {
      const d = SPECIES.orse;
      const [one, two] = d.stages!;
      return [
        `Changed: ${d.was![0]} renamed ${d.name}; still the mount. Evolves into ${one.name} at level ${EVOLVE_AT[0]} (${stageSays(1, false)}) and ${two.name} at level ${EVOLVE_AT[1]} (${stageSays(2, false)}); both vs ${article(d.name)} ${d.name}.`,
        'Added: new models for all 3: long-eared hare, fluffy kit to courser to great Moonhare with flowing mane and 2 plumes (walk, bounding gallop, kick, voice). Rider seat per size: knees up on a Thistlekit, astride further back on the larger 2.',
      ];
    },
  },
  {
    n: 218,
    day: '2026-10-20',
    lines: () => {
      const d = SPECIES.sedra;
      const [one, two] = d.stages!;
      return [
        `Changed: ${d.was![0]} renamed ${d.name}. Evolves into ${one.name} at level ${EVOLVE_AT[0]} (${stageSays(1)}) and ${two.name} at level ${EVOLVE_AT[1]} (${stageSays(2)}); both vs ${article(d.name)} ${d.name}.`,
        `Changed: reeds per cut: 1 +1 per ${REED_LEVELS} foraging levels (${1 + Math.floor(SKILL_TOP / REED_LEVELS)} at ${SKILL_TOP}). Carcass gives fur instead of the Sedra's feathers.`,
        'Added: new models for all 3: marsh otter with reeds down its back; upright Reedweaver with a pampas bundle; great Marshreaper with reed mantle, plume fan and sickle (walk, strike, reed cutting, voice).',
      ];
    },
  },
  {
    n: 219,
    day: '2026-10-20',
    lines: () => {
      const lamp = itemDef(ARTIFACT_FOR.use_ancient_lamp).name.toLowerCase();
      const top = TIERS[TIERS.length - 1];
      return [
        `Added: old lamp restores into ${article(lamp)} ${lamp}; held ones converted. Used on your wildermon from its menu: replaces its lowest-rarity trait `
          + `(random among ties) with one it lacks, same rarity, or 1 time in ${LAMP_TIER_ODDS} the rarity above `
          + `(${listed(TIERS.slice(1).map((t, i) => `${TIERS[i]} to ${t}`))}), never lower. At ${top}: another ${top} trait. Consumed.`,
        `Added: with fewer than ${num(TRAIT_SLOTS)} traits, the lamp fills an empty slot first: ${article(TIERS[0])} ${TIERS[0]} trait, or 1 time in ${LAMP_TIER_ODDS} ${article(TIERS[1])} ${TIERS[1]} one.`,
      ];
    },
  },
  {
    n: 220,
    day: '2026-10-20',
    lines: () => [
      `Added: idle settlement workers show the reason on their card and hover until they next set out: nothing of their task in range of the totem at their level ("${idleSays({ why: 'range', n: SPECIES.sedra.workRange }, 'reed')}"), `
        + `nothing in your settlement stores to work, with what is wanted ("${idleSays({ why: 'stock', n: 0 }, 'mend')}"), "${idleSays({ why: 'room', n: 0 }, 'water')}", `
        + `a load with nowhere on the settlement to go, or walking home from more than ${HOME_SLACK} tiles past range, with distance.`,
      'Added: island: also when nothing runs it: keeper away, or nobody awake near enough, with how near. Changed: you receive all your settlement workers wherever they are, not only nearby ones.',
      `Added: card ledger for this island day and the previous (${dur(DAY_SECONDS)} each): cycles at its task, skill gained, and the top ${num(LEDGER_SHOWN)} items handled, of up to ${num(LEDGER_ITEMS)} kinds a day.`,
    ],
  },
  {
    n: 221,
    day: '2026-10-20',
    lines: () => [
      `Added: Tracking skill (Naturalist). Track, on the field guide page of a seen wildermon: nearest wild one of that kind, any evolution stage, `
        + `within ${TRACK_RANGE_BASE} tiles +${TRACK_RANGE_PER} per Tracking level (${trackRange(SKILL_TOP)} at ${SKILL_TOP}); gives direction and distance. Kept ones never tracked.`,
      `Added: direction error ${trackErrSays()}. Distance: ${trackBandsSays().join('; ')}.`,
      `Added: on-screen arrow along the read direction from where you stood, for ${TRACK_SHOW} s. Offline, range capped at ${CULL_RANGE} tiles (wild beyond that is kept as a count).`,
    ],
  },
  {
    n: 222,
    day: '2026-10-20',
    lines: () => {
      const [a, b] = stageLevels(1);
      const [c, d] = stageLevels(2);
      const e = SPECIES.sedra;
      const at = (lv: number) => tameNeeds({ species: e.id, skills: { [levelSkill(e)!]: lv } });
      const fav = favouriteOf(e)!;
      return [
        `Added: wild evolved spawns: 1 time in ${WILD_STAGE_ODDS[0]} second evolution stage, level ${a} to ${b - 1}; 1 time in ${WILD_STAGE_ODDS[1]} third evolution stage, ${c} to ${d - 1}; named, drawn and as strong as that evolution stage.`
          + ` Taming +${WILD_STAGE_TAME} per evolution stage past the first, base chance ×${percent(WILD_STAGE_CHANCE)} per evolution stage:`
          + ` ${e.stages![0].name} taming ${at(a).level} at base ${percent(at(a).chance)}, ${e.stages![1].name} ${at(c).level} at ${percent(at(c).chance)}; ${e.name} ${e.tameLevel} at ${percent(e.tameChance)}.`,
        `Added: food quality: each diet item eaten gives ${percent(FED_CARE)} care at QL ${NEWS_QL_TOP} and +${percent(FED_LEARN)} learning for ${dur(FED_FOR)} at QL ${NEWS_QL_TOP},`
          + ` both ${mult(FED_FAVOURITE)} for its favourite (first in its diet); both proportionally less below QL ${NEWS_QL_TOP}. ${e.name} favourite: ${itemDef(fav).name.toLowerCase()}, +${percent(fedBonus(e, fav, NEWS_QL_TOP))} learning at QL ${NEWS_QL_TOP}.`,
        `Added: a meal worth as much or more than the current one replaces it and restarts the ${dur(FED_FOR)}; a lesser one does nothing; no stacking. Grazing and whey give neither. Card shows favourite value and meal time left; wild ones show evolution stage requirements over their kind's.`,
      ];
    },
  },
  {
    n: 223,
    day: '2026-10-20',
    lines: () => {
      // The kinds that evolve and have a trade a stage lets do more of, at their second stage.
      const lines = Object.values(SPECIES).filter((d) => d.stages && stageWorkSays(d.gathers, STAGE_LOADS[1]))
        .map((d) => {
          const [verb, rest] = stageWorkSays(d.gathers, STAGE_LOADS[1])!;
          return `${article(d.stages![0].name)} ${d.stages![0].name} ${verb} ${rest.replace(/,$/, '')}`;
        });
      return [
        `Changed: evolution time equalised across tasks (some reached level ${EVOLVE_AT[0]} in a fraction of others' time). Each settlement worker's gain in its level skill × its task's learning factor, `
          + `set so each takes about as long as the median to reach level ${EVOLVE_AT[0]} and then ${EVOLVE_AT[1]}: ${learnPaceSays()}. Watch and hunting unchanged.`,
        `Added: loads by evolution stage: ${STAGE_LOADS[1]} at the second, ${STAGE_LOADS[2]} at the third (first: ${STAGE_LOADS[0]}). `
          + 'Gatherers carry that many a trip, moving to the next tile while arms have room; errands carrying water, pieces, fuel, sprouts, candles, seed and buckets carry that many; '
          + `in-place tasks handle that many a cycle: items mended, batches made, carcasses butchered, relics restored, pieces glazed, your wildermon brushed, milked, shorn or dressed within ${TEND_REACH} tiles. `
          + `Second evolution stage: ${lines.join('; ')}; third: ${STAGE_LOADS[2]} of each. Learning per action unchanged.`,
      ];
    },
  },
  {
    n: 224,
    day: '2026-10-20',
    lines: () => {
      const top = TIERS[TIERS.length - 1];
      const deepest = depthMul(PEDIGREE_MOST, 'tough');
      return [
        'Added: Put it to a mate preview before confirming, from the covering\'s own success check at your husbandry, their care and your perks: '
          + 'success chance, chance the young carries each parent trait, best-trait rarity odds, '
          + 'mutation chance and rarity, resulting line depth, and its rarity odds.',
        `Added: pedigree per trait channel: 1 generation per consecutive generation (incl. itself) carrying a trait on it, up to ${PEDIGREE_MOST}. `
          + `Each generation past the first +${Math.round(PEDIGREE_STEP * 100)}% to its blood effect there, ${cardPct(deepest)} at ${PEDIGREE_MOST}, `
          + 'reversed where lower is better. Card shows a line each. Existing island wildermon start at 1 on each carried channel.',
        `Added: mutation, 1 young in ${MUTATION_ODDS}: a trait neither parent carries at any rarity, 1 rarity above their best (${top} at ${top}), `
          + 'in its lowest-rarity slot. Birth message names it; card marks its source as mutation.',
        'Fixed: island wild trait picks repeating a carried name now pick again as in the browser; both sides use the same odds.',
      ];
    },
  },
  {
    n: 225,
    day: '2026-10-20',
    lines: () => {
      const d = SPECIES.holla;
      const [one, two] = d.stages!;
      return [
        `Changed: ${d.was![0]} renamed ${d.name}. Evolves into ${one.name} at level ${EVOLVE_AT[0]} (${stageSays(1)}) and ${two.name} at level ${EVOLVE_AT[1]} (${stageSays(2)}); both vs ${article(d.name)} ${d.name}.`,
        `Changed: still carries water from shore or well to your barrels, ${BUCKET_LITRES} L a bucket; ${STAGE_LOADS[1]} then ${STAGE_LOADS[2]} buckets a trip as it evolves. Carcass gives no fur.`,
        'Added: new models for all 3: frog with rope-ringed water bladders on its back; Springcarrier with a bladder each flank; great Aquavoyager with wooden yoke pipe, spouts and leaf canopy (hop, strike, pour, voice).',
      ];
    },
  },
  {
    n: 226,
    day: '2026-10-20',
    lines: () => [
      `Added: settlement worker stamina: ${TIRE_GOES} cycles at its task, 1 cycle = 1 gain (extra loads from evolution stage cost nothing more). `
        + `At zero, once arms are empty or between errand steps, rests ${dur(restFor(false))}, then full stamina. Card shows stamina and rest seconds left.`,
      `Added: a free wildermon bed of its size on your settlement: walks to the nearest and sleeps ${frac(BED_REST)} as long, ${dur(restFor(true))}. `
        + `Small bed: first evolution stage (under level ${EVOLVE_AT[0]}); medium: second; large: third (level ${EVOLVE_AT[1]}+). `
        + `Non-evolving kinds: small under ${DEN_HEALTH[0]} health, medium under ${DEN_HEALTH[1]}, large at that and over. Only its own size; 1 per bed.`,
      `Added: upkeep: a settlement worker working ${dur(UPKEEP_FOR)} (an island day) without a meal works at ${percent(UNFED_PACE)} pace until it eats; card shows it. `
        + 'Eats from your settlement stores when hungry, as before; only one with nothing to eat slows.',
      `Added: specialties: ${SPECIALTY_AT}+ settlement workers of 1 task on a settlement: each works ${percent(SPECIALTY_BONUS)} faster. Settlement window lists your tasks and counts; worker card shows its own.`,
      `Fixed: offline, mender, water carrier, hod carrier, planter, stoker and prospector take a cycle's work time on every cycle, `
        + `${Math.round(workDuration(1))} s at level 1, ${Math.round(workDuration(SKILL_TOP))} at ${SKILL_TOP} before care and evolution stage, and wait after a settlement store fetch as on the island; `
        + 'fetcher and stoker learn as on the island; rot clearing walks out to a tile, as there. '
        + `Fixed: island reed cutter cuts 1 reed +1 per ${REED_LEVELS} foraging levels, as described: ${1 + Math.floor(SKILL_TOP / REED_LEVELS)} at ${SKILL_TOP}.`,
      `Changed: task learning factors recalculated with rest counted; each still evolves in about the median time: ${learnPaceSays()}.`,
    ],
  },
  {
    n: 227,
    day: '2026-10-20',
    lines: () => [
      'Added: Ask to join, on another player\'s settlement totem. Stand on the settlement to ask.',
      'Answered under Social → Waiting by the founder and any rank with Invite: Let in (rank for newcomers) or No. Your own requests: same tab, Withdraw.',
      `Limit: citizen of ${DEEDS_JOINED} settlements, checked when asking and when let in.`,
      'Fixed: settlement totems were drawn only for settlements you belong to.',
    ],
  },
  {
    n: 228,
    day: '2026-10-20',
    lines: () => [
      `Added: Skills window: click a skill for a slider per effect, its value now and at either end. Left end: the skill's starting value. Right end: ${SKILL_TOP}.`,
      'Effects read off the rules with your gear and perks: carry weight, blow damage, hit and crit chance, swing and draw time, block, armour, time per action, success chance, best QL and each skill\'s own.',
    ],
  },
  {
    n: 229,
    day: '2026-10-20',
    lines: () => [
      `Added: Update to v… button (gold, bottom right): shown when a later version is on the site, checked every ${UPDATE_CHECK_MS / 60_000} min and on returning to the tab. Click: reload to it.`,
    ],
  },
  {
    n: 230,
    day: '2026-10-20',
    lines: () => [
      'Fixed: work posts refused every wildermon ("Choose a wildermon.").',
      `Set a wildermon to it (post menu), as Hitch: those following you within ${POST_FOLLOW_REACH} tiles, then those in a crate in your pack or beside you. A crated one is let out at the post.`,
    ],
  },
  {
    n: 231,
    day: '2026-10-20',
    lines: () => [
      'Renamed: go → action.',
      `Renamed: Faith skill → ${SKILL_BY_ID.get('prayer')?.name} skill. Faith window unchanged.`,
      `Renamed: Prayer skill → ${SKILL_BY_ID.get('praying')?.name} skill.`,
      `Renamed: deed → settlement: ${itemDef('deed_stake').name}, settlement worker, settlement crate.`,
      'Renamed: settlement token → settlement totem.',
      `Renamed: height units → metres, to ${metres(1)} m: highest step ${metres(MAX_STEP)} m (was ${MAX_STEP}).`,
      'Renamed: meal knack → meal boost.',
      `Renamed: trait tier → rarity: ${listed(TIERS)}.`,
      `Renamed: bauble tier → grade: ${listed(BAUBLE_TIERS.map((t) => t.name.toLowerCase()))}.`,
      'Renamed: settlement roll → member list.',
      'Renamed: Job queue → Action queue.',
      'Renamed: settlement worker go → cycle.',
      `Renamed: Creature crate → ${itemDef('creature_crate').name}.`,
      'Renamed: Deed job → Settlement task; a worker\'s trade → task.',
      'Renamed: Tier Up perk → Grade Up.',
      'Renamed: Trade window (face to face) → Barter.',
    ],
  },  {
    n: 232,
    day: '2026-10-21',
    lines: () => [
      'Changed: kiln model, in the smelter\'s rune pastel kit: beehive dome on a mossy plinth, stoke porch, rune band, vent.',
      'Cold, lit and firing drawn apart: firing lights the runes and flares at the vent. Smoke from the vent while lit; glows at night.',
    ],
  },
  {
    n: 233,
    day: '2026-10-21',
    lines: () => [
      `Changed: body stamina grows the stamina bar: ×${staminaBarAbove(0)} at ${CHAR_START}, ×${staminaBarAbove(SKILL_TOP - CHAR_START)} at ${SKILL_TOP}.`,
      'Stamina spent and regained per second: same amounts, shares of the bigger bar. Winded and exhausted marks and "+N%" restores: shares of the bar.',
    ],
  },
  {
    n: 234,
    day: '2026-10-21',
    lines: () => [
      `Changed: mind logic gain, one amount for every source: ${percent(MIND_GAIN / KNACK_GO)} of an action's gain (finds restored, scrolls set and hoards dug up gave more).`,
      'Fixed: Skills window success chance added mind logic\'s ease on skills whose checks have none (mining, digging, woodcutting and the like).',
    ],
  },
  {
    n: 235,
    day: '2026-10-21',
    lines: () => [
      `Added: dyed hair colours in the character creator: ${listed(HAIR_COLOURS.filter((c) => DYED_HAIR.has(c.id)).map((c) => c.name.toLowerCase()))}. Never rolled at random.`,
    ],
  },
  {
    n: 236,
    day: '2026-10-21',
    lines: () => {
      const start = SKILL_BY_ID.get('awareness')?.start ?? CHAR_START;
      const rate = `${+(AWARE_PER_LEVEL * 100).toFixed(3)}%`;
      const top = percent(awareShareAbove(SKILL_TOP - CHAR_START));
      const gain = (base: number): string => `${percent(base / KNACK_GO)} of an action's gain`;
      return [
        `Changed: awareness starts at ${start}; every awareness under ${start} raised to ${start}.`,
        `Added: awareness, per level over ${CHAR_START}: monster notice range −${rate}, tracking range +${rate}, hit chance +${rate} × darkness over ${percent(NIGHT_EYES_FROM)} dark or underground (${top} each at ${SKILL_TOP}).`,
        `Added: animal husbandry to read a trait, one level less per ${AWARE_TRAIT_STEP} awareness over ${CHAR_START} (−${awareTraitEase(SKILL_TOP)} at ${SKILL_TOP}).`,
        `Added: awareness raised by tile walked in the dark (${gain(DARK_WALK)}), forage or fishing action in the dark (${gain(DARK_WORK)}), each × darkness; tracking action at any hour (${gain(TRACK_AWARE)}).`,
        'Added: Skills window line and sliders for awareness: sight range, monster notice range, tracking range, hit chance in the dark, husbandry to read a trait.',
      ];
    },
  },
  {
    n: 237,
    day: '2026-10-21',
    lines: () => [
      `Changed: soul strength: favour per prayer, Calm per sitting, Beastmaster spell heal, blow and bonus +${+(SOUL_PER_LEVEL * 100).toFixed(4)}% per level over ${CHAR_START} (+${percent(soulAbove(SKILL_TOP - CHAR_START) - 1)} at ${SKILL_TOP}).`,
      `Changed: soul strength gain: prayer, sitting, sacrifice at an altar, each ${percent(SOUL_GAIN / KNACK_GO)} of an action's gain, as a taming offering.`,
    ],
  },
  {
    n: 238,
    day: '2026-10-21',
    lines: () => [
      'Changed: on a phone, a window opens as a full-width sheet, one at a time; no dragging or resizing.',
      'Changed: on a phone, status bars and toolbar in one bottom strip; tap the bars for the full status panel.',
      'Changed: on a phone, the event log is a one-line bar; tap to open, ▾ to fold.',
      'Added: notch and home bar room on phones (safe areas).',
      'Added: Add to Home Screen: fullscreen, own icon.',
      'Added: Settings, Display, Phone: Fullscreen (where the browser has it); Keep screen on while working (action running or queued).',
      `Added: Settings, Display, Phone: Low power: frame limit ${LOW_POWER_FPS}/s, Fast graphics (${FAST_DPR} pixel per screen pixel), no wakes or dust.`,
      `Added: nothing drawn while the page is hidden; back with the live connection cut: "${RECONNECTING}", island re-read at once.`,
      'Added: phone text boxes: no zoom on focus; kept above the keyboard.',
    ],
  },
  {
    n: 239,
    day: '2026-10-21',
    lines: () => [
      'Fixed: dropped clay or sand left dirt; a spadeful now lays its own tile, on dirt too.',
      'Changed: Drop dirt and Drop (raise ground) renamed Change tile; one option per dirt, clay or sand in the pack.',
      'Changed: Change tile at your feet takes clay and sand as well as dirt.',
    ],
  },
  {
    n: 240,
    day: '2026-10-21',
    lines: () => [
      `Fixed: crates, chests, carts, wagons, furnaces, kilns, anvils, work posts, traps and fires picked by their drawn shape, ±${PICK_SLACK} px (±${PICK_SLACK_TOUCH} px by touch); not a box round them, not their shadow.`,
      'Fixed: where two overlap, the one drawn in front is picked.',
    ],
  },
  {
    n: 241,
    day: '2026-10-22',
    lines: () => {
      const water = (id: string): number => RECIPE_BY_ID.get(id)?.inputs.find((i) => i.litres)?.litres ?? 0;
      return [
        `Changed: buckets and skins hold litres: a bucket ${BUCKET_LITRES} L; its name says what is in it (Bucket of water (${BUCKET_LITRES - water('make_dough')} L)).`,
        `Changed: water by the litre: dough ${water('make_dough')} L, porridge ${water('make_porridge')} L, broth ${water('make_broth')} L, ink ${water('make_ink')} L, papyrus ${water('make_papyrus')} L, herb tea ${water('brew_tea_thyme')} L; the bucket is kept.`,
        'Changed: a recipe\'s water, lye or milk: from buckets carried, then in stores, then barrels, wells and fountains within its reach.',
        `Changed: tanning ${TAN_LYE} L lye a hide; cleaning a wound, removing dye or paint ${LYE_USE} L lye.`,
        'Changed: lye, cheese, dye boils and distilling take a full bucket.',
        `Changed: a drink ${DRINK_LITRES} L; a bucket drunk dry is an empty bucket. Pour into the barrel pours what is in the bucket.`,
        'Changed: Fill with water tops up a part bucket of water.',
        `Changed: a bucket weighs ${itemDef('bucket').weight} kg + ${LITRE_KG} kg a litre.`,
        'Changed: thick rope recipe: Lay up thick rope.',
      ];
    },
  },
  {
    n: 242,
    day: '2026-10-22',
    lines: () => [
      'Fixed: a quarry worker (Chiptail and its stages) cuts rock under snow: a mountain top\'s marble.',
      'Fixed: a quarry worker brings up the stone it cuts: marble shards off marble, not rock shards.',
    ],
  },
  {
    n: 243,
    day: '2026-10-22',
    lines: () => [
      'Fixed: a wildermon on a work post pulled up, rotted away or called off comes back: to you if nothing follows you, else to your settlement, else into an empty wildermon crate in your pack; wild only with none of these.',
    ],
  },
  {
    n: 244,
    day: '2026-10-22',
    lines: () => [
      `Added: a banner as somebody logs on (${BANNER_MS / 1000} s) or off (${LEAVING_MS / 1000} s), as at a settlement border; off switch in Settings, Interface.`,
      `Added: Talk line as somebody logs on or off: Logged on: name, Logged off: name. Logged off is ${IDLE_LOGOUT / 60} min after their browser was last heard from.`,
      'Changed: "has gone home." is now "Logged off: name", in Talk.',
    ],
  },
  {
    n: 245,
    day: '2026-10-22',
    lines: () => [
      `Added: ${SIX_RELICS.length} relics: ${SIX_RELICS.map((r) => `${r.name} (${r.parts} pieces, archaeology ${r.difficulty})`).join(', ')}.`,
      `Added: ancient collar, on your wildermon: upkeep −${percent(COLLAR_CUT)}, for good, once per wildermon.`,
      `Added: ancient bridle, on your wildermon: speed ridden +${percent(BRIDLE_PACE)}, and its share of a team's, past the speed cap; for good, once per wildermon.`,
      'Added: ancient whetstone: Hone a damaged tool or weapon: all damage off, QL kept.',
      `Added: ancient seed jar: Open: ${JAR_SEEDS} seeds of a random crop at the jar's QL.`,
      `Added: ancient stamp, carried: rare chance ×${STAMP_RARE} on your next ${STAMP_GOES} crafts and forgings.`,
      `Added: rune tablet: Skills window, a skill under ${TABLET_BELOW}: +${TABLET_GAIN.toFixed(1)}.`,
    ],
  },
  {
    n: 246,
    day: '2026-10-22',
    lines: () => [
      `Added: old brace relic (${BRACE.parts} pieces, archaeology ${BRACE.difficulty}): ancient brace, on your wildermon: action speed +${percent(BRACE_STEP)} a use, up to ${BRACE_MOST} uses (+${percent(BRACE_STEP * BRACE_MOST)}).`,
      'Added: a wildermon on a work post, hungry, eats its diet from a container you made inside the post\'s range.',
      `Changed: farming seed per harvest: ${seedSays()}, tended or not (was one, or two tended twice); settlement workers too.`,
    ],
  },
  {
    n: 247,
    day: '2026-10-22',
    lines: () => [
      `Added: Field guide page for every evolution stage, after its kind's: ${guideEntries().length - guidePages().length} pages, each with its model; seen once one at that stage is in sight.`,
    ],
  },
  {
    n: 248,
    day: '2026-10-22',
    lines: () => ['Changed: Investigate works on a trail.'],
  },
  {
    n: 249,
    day: '2026-10-22',
    lines: () => [`Changed: well holds ${WELL_HOLDS} litres (was 50).`],
  },
  {
    n: 250,
    day: '2026-10-22',
    lines: () => [
      `Changed: trees redrawn, all ${TREE_DEFS.length} kinds, every age and season; fruit sized down.`,
      `Changed: ore and stone seams redrawn, ${ROCK_VARIANTS.length - 1} kinds; each by its own shape, precious and rare ones with glints and crystals.`,
      'Changed: work post redrawn; ribbon flies and rune lights while a wildermon works from it. Island now says which post each worker is on.',
    ],
  },
  {
    n: 251,
    day: '2026-10-22',
    lines: () => [
      ...NINE_LINES.map((id) => {
        const d = SPECIES[id];
        const [one, two] = d.stages!;
        return `Replaced: ${d.was![0]} with ${d.name}; evolves to ${one.name} at level ${EVOLVE_AT[0]}, ${two.name} at ${EVOLVE_AT[1]}. Same task, stats and ability.`;
      }),
      `Each stage: own model, animations and voice. Stage 2: ${stageSays(1)}; stage 3: ${stageSays(2)}.`,
      'Changed: Mosskip line butchers no fur; Pebbletooth line gives scales, not fur.',
    ],
  },
  {
    n: 252,
    day: '2026-10-22',
    lines: () => [
      `Added: Report a player (right-click a person): ${REPORT_REASONS.map((r) => r.label.toLowerCase()).join(', ')}; ${REPORTS_A_DAY} a day.`,
      'Added: island keepers kick and bar, see reports, and see flags for shared connections, all-day play and fast skill gain.',
      'Added: authenticator sign-in on the account page; keeper tools ask for the code when it is on.',
      `Changed: new characters per connection a day: ${NEW_BODIES_A_DAY}.`,
      'Changed: other islands\' players, wildermon, settlements, trades and island talk no longer readable.',
    ],
  },
  {
    n: 253,
    day: '2026-10-22',
    lines: () => [
      `Changed: bronze mirror (relic, ${MIRROR.parts} pieces, archaeology ${MIRROR.difficulty}), was treasure only: use on your wildermon; its next covering's young get its best trait`
        + ' (highest rarity; first listed on a tie) at that rarity, in place of a draw. One mark at a time, used up at that covering. Shown on its card and in the pairing preview.',
    ],
  },
  {
    n: 254,
    day: '2026-10-22',
    lines: () => [
      `Added: a skill per evolving line from evolution stage ${PERK_STAGE + 1} (level ${EVOLVE_AT[PERK_STAGE - 1]}): `
        + `${Object.keys(STAGE_PERKS).filter((id) => SPECIES[id]?.stages).map((id) => `${SPECIES[id].stages![PERK_STAGE - 1].name} ${perkSays(id)}`).join('; ')}.`,
      `Added: trait slots by evolution stage: ${stageSlots(0)}, ${stageSlots(1)}, ${stageSlots(2)}. Evolving: +${SLOTS_PER_STAGE} trait, a fresh draw by its keeper's husbandry, `
        + `1 in ${MUTATION_ODDS} a mutation. Wild ones at a later stage: their stage's slots. Evolved ones on the island given their missing slots.`,
    ],
  },
  {
    n: 255,
    day: '2026-10-22',
    lines: () => [
      `Changed: pairing preview odds exact, by animal husbandry to read a trait: below ${ODDS_BANDS_AT}, likely (${percent(ODDS_LIKELY)}+) or unlikely; `
        + `${ODDS_BANDS_AT}, ${percent(ODDS_BAND)} bands; ${ODDS_EXACT_AT}, to ${1 / 10 ** ODDS_PLACES}% with best-trait rarity and mutation odds.`,
      `Added: Leaderboards, Bred records: per kind, best ever bred (${RECORD_STATS.map((r) => r.name.toLowerCase()).join(', ')}), wildermon, breeder, day; `
        + 'kept after death or release. Also on each kind\'s Field guide page.',
    ],
  },
  {
    n: 256,
    day: '2026-10-22',
    lines: () => [
      `Added: wild forms. Colour form, 1 in ${COLOUR_FORM_ODDS} wild spawns: a palette none of its variants has, pale or dark by kind. Size form, 1 in ${SIZE_FORM_ODDS}: `
        + `large (${formGives('large')}) or small (${formGives('small')}). Kept when tamed; young: ${percent(FORM_PASS)} per parent with it. On the card and the Field guide page (seen, tamed).`,
      `Added: Work on your wildermon's card: lifetime cycles, skill and things handled, best island day, time working, idle (top reason) and resting.`,
    ],
  },
  {
    n: 257,
    day: '2026-10-22',
    lines: () => [
      `Added: wildermon gear, ${GEAR_SIZES.length} sizes each (${listed([...GEAR_SIZES])}, as the beds), its size only; Fit and Remove from its menu, one per slot. Crafting window: pack and harness leatherworking, barding blacksmithing.`,
      `Added: pack: loads a trip +${PACK_LOADS}, on a task that carries loads.`,
      `Added: harness: team pace in the traces +${percent(HARNESS_PACE * GEAR_FLOOR)} at QL ${GEAR_QL_LEAST} to +${percent(HARNESS_PACE)} at QL ${QL_TOP}, its share of the team.`,
      `Added: barding: damage taken −${percent(BARDING_CUT * GEAR_FLOOR)} at QL ${GEAR_QL_LEAST} to −${percent(BARDING_CUT)} at QL ${QL_TOP}.`,
      'Added: gear wears as a tool of its QL: pack a cycle, harness a tile pulled, barding a blow taken. Remove to repair; released or culled, back to your pack. Shown on its card.',
    ],
  },
  {
    n: 258,
    day: '2026-10-22',
    lines: () => [
      `Added: ${SPECIES.sparra.name} on a settlement (takes a worker place): ${sparTaskSays().replace(/^Settlement task: /, '')}`,
      `Changed: learning factor for guarding ${percent(PACE_258.guard)} on ${GATHER_SKILL.guard.replace(/_/g, ' ')}, from wild creatures and from spars.`,
      `Added: card: "Sparring with" its partner; stamina for guards and the ${SPECIES.sparra.name}; idle when no guard is free, or yielded.`,
    ],
  },
  {
    n: 259,
    day: '2026-10-22',
    lines: () => [
      `Added: ${SPECIES.magga.name} sorts bins: with nothing dropped in range, a stack a load from a settlement crate, chest or other store into the `
        + `${itemDef('bulk_bin').name.toLowerCase()} or ${itemDef('craft_bin').name.toLowerCase()} that takes it, up to the bin's room. `
        + 'Not from bins, padlocked or marked stores, or off a work post.',
    ],
  },
  {
    n: 260,
    day: '2026-10-23',
    lines: () => [
      `Fixed: action bar behind the island on slow frames (zoomed out): runs on the wall clock. Game clock per frame: up to ${CATCH_UP} s, was ${CLOCK_STEP} s.`,
      `Fixed: long walks round trees, rock, water or slopes pulled back and stopped: position reports carry the path's turns (up to ${VIA_MAX} each), checked leg by leg, not as a straight line.`,
      'Fixed: path walking over its pace (end of each step skipped); long walks pulled back.',
      'Changed: a walk held to its pace by the island goes on to its goal, was stopped.',
    ],
  },
  {
    n: 261,
    day: '2026-10-22',
    lines: () => [
      `Fixed: Journal Goals tab showing no goals done when the journal opened before the first heartbeat (up to ${HEARTBEAT} s after coming ashore), as it does at What's new.`,
      'Fixed: goals ticked during a refused heartbeat now kept for the next one.',
    ],
  },
  {
    n: 262,
    day: '2026-10-23',
    lines: () => [
      ...EIGHT_LINES.map((id) => {
        const d = SPECIES[id];
        const [one, two] = d.stages!;
        return `Replaced: ${d.was![0]} with ${d.name}; evolves to ${one.name} at level ${EVOLVE_AT[0]}, ${two.name} at ${EVOLVE_AT[1]}. Same task and stats.`;
      }),
      `Each stage: own model, animations and voice. Stage 2: ${stageSays(1)}; stage 3: ${stageSays(2)}.`,
      `Changed: butchered, ${SPECIES.wurla.name} line gives feathers, not fur; ${SPECIES.magga.name} line no feathers; ${SPECIES.grazza.name}, ${SPECIES.grubba.name}, ${SPECIES.mudda.name}, ${SPECIES.middun.name} and ${SPECIES.sparra.name} lines no fur.`,
    ],
  },
  {
    n: 265,
    day: '2026-10-23',
    lines: () => [
      'Changed: a wildermon in a crate set down drawn still, not animated: frame rate with many crates out.',
      'Fixed: a wildermon in a crate drawn at its own stage, not its first.',
    ],
  },
  {
    n: 266,
    day: '2026-10-23',
    lines: () => [
      `Fixed: frame rate with wildermon standing about in view, close in or on a sharp screen: each kept picture cut to what is drawn, so it stays kept, not drawn again ${STAND_FPS} times a second.`,
      `Fixed: frame rate after dark with an altar in view: night mixed at ${Math.round(LIGHT_RES * LIGHT_RES * 100)}% of the screen's pixels, as without one (was 100%).`,
    ],
  },
  {
    n: 267,
    day: '2026-10-23',
    lines: () => [
      'Fixed: shade at a wall\'s foot drawn down the slope below it at some view angles; now on the ground at the foot, every angle.',
    ],
  },
  {
    n: 268,
    day: '2026-10-23',
    lines: () => [
      `Changed: dragon scales from a dragon only; none from ${listed(UNSCALED.map((id) => SPECIES[id].name))}.`,
    ],
  },
  {
    n: 269,
    day: '2026-10-23',
    lines: () => [
      'Fixed: a column at a wall corner washed grey as remembered ground when the tile in front of it is remembered; now in full colour when any tile round its corner is in sight.',
    ],
  },
  {
    n: 270,
    day: '2026-10-23',
    lines: () => [
      'Changed: Field guide stage pages marked tamed when one of yours reaches that stage, or is tamed at it; was seen only. Your evolved wildermon count already.',
    ],
  },
  {
    n: 271,
    day: '2026-10-23',
    lines: () => [
      'Fixed: a guard after something wild stopping at the edge of its reach, never striking, never letting go; with it, a Sparra on the settlement idle, no guard free to spar. Its chase now ends half its reach off.',
    ],
  },
  {
    n: 272,
    day: '2026-10-23',
    lines: () => [
      `Changed: Vesp task ${GATHER_VERB.hive}: the nearest hive with room in its reach of the totem; per go, out to one wildflower tile within ${SKEP_REACH} tiles of the hive, in turn, and back.`,
      `Changed: Vesp honey into the hive: a skep's rate there, a honey per ${SKEP_CLUMP_HOURS} hours worked per clump within ${SKEP_REACH} tiles, per Vesp; a beeswax per ${SKEP_WAX_EVERY} honey; none in ${SKEP_IDLE}. Was comb every second, whatever was in flower.`,
      `Changed: Vesp ledger: trips as goes, honey and beeswax made. Learning factor ${percent(PACE_258.hive)} on ${GATHER_SKILL.hive.replace(/_/g, ' ')}, for its trips.`,
      'Changed: a Vesp following you fills no hive. Was comb every second on your settlement.',
      `Added: Vesp idle reasons: hives full; no wildflowers within ${SKEP_REACH} tiles of its hive; ${SKEP_IDLE}.`,
      `Changed: wildflower pickers leave tiles within ${SKEP_REACH} of a hive, as of a skep.`,
    ],
  },
  {
    n: 273,
    day: '2026-10-23',
    lines: () => [
      `Added: ${WILDERMON_A.length + STANDING_A.length + GOALS_B + ISLAND_GOALS.length + WILDERMON_GOALS_C.length + TRADE_GOALS.length} goals in the journal: The wildermon, Standing, The crafts, The land, The water, The island, People and trade.`,
    ],
  },
  {
    n: 274,
    day: '2026-10-23',
    lines: () => [
      ...TWO_LINES.map((id) => {
        const d = SPECIES[id];
        const [one, two] = d.stages!;
        return `Replaced: ${d.was![0]} with ${d.name}; evolves to ${one.name} at level ${EVOLVE_AT[0]}, ${two.name} at ${EVOLVE_AT[1]}. Same task and stats.`;
      }),
      `Each stage: own model, animations and voice. Stage 2: ${stageSays(1)}; stage 3: ${stageSays(2)}.`,
      `Added: stage 3 skill: ${TWO_LINES.map((id) => `${SPECIES[id].stages![PERK_STAGE - 1].name} ${perkSays(id)}`).join('; ')}.`,
    ],
  },
  {
    n: 275,
    day: '2026-10-23',
    lines: () => [
      'Fixed: tool damage per action, as every other tool, for: butchering knife (butcher), carving knife (shear), rake (till), trowel (investigate, repoint wall, fill pool, pour foundation), sickle (clear ivy), brush (scrub moss), mallet (plan foundation), pickaxe (dig pool). Was none.',
    ],
  },
  {
    n: 276,
    day: '2026-10-23',
    lines: () => [
      ...TRAITS_276.flatMap(newTraitLines),
      `Added: heavy blow chance: blow ×${HEAVY_HIT}. Bleed chance: target bleeds ${percent(KNIFE_BLEED)} of the blow per second for ${KNIFE_BLEED_SECS} seconds, as a knife. Bleeding taken: bleeding, venom and burns.`,
      'Added: young per birth past 1: chance of a second young, (1 + Twins) × the dam\'s young per birth − 1. Mutation chance, fresh-draw chance: the better parent of the pair.',
      `Rarity and breeding lines: no effect on ${listed(CHANNELS.filter((ch) => ch.blood === false).map((ch) => ch.label))}; trait figures only.`,
    ],
  },
  {
    n: 277,
    day: '2026-10-23',
    lines: () => [
      'Fixed: Runecut frame rate: window stone, frames and badges shown as still images, not 4 canvases a window; one small canvas per seam, not one the size of the screen; frame lamp glow still, no swell.',
      'Changed: trees and bushes drawn still; no wind sway. Frame rate.',
      'Changed: after dark, light behind a window worked out once per room per frame, not once per wall; altar and runestone light from one cached picture. Frame rate.',
    ],
  },
  {
    n: 278,
    day: '2026-10-23',
    lines: () => [
      'Fixed: a wildermon nobody named shown by an old kind name, or by its first stage once evolved or tamed evolved; now its kind at its stage, on every change. Named ones keep their names.',
    ],
  },
  {
    n: 279,
    day: '2026-10-23',
    lines: () => [
      `Changed: taming gained per attempt +${percent(1 / TAME_HARD)} per point of taming needed: offering (taken or refused), taking a catch out of a trap, Call of the Wild. ${['rabba', 'lume'].map((id) => `${SPECIES[id].name} ${mult(tameLearn({ species: id, skills: {} }))}`).join(', ')}.`,
    ],
  },
  {
    n: 280,
    day: '2026-10-23',
    lines: () => [
      `Added: ${itemDef('creature_crate').name.toLowerCase()}s on a stall, a counter or a rack listed with their wildermon's name.`,
    ],
  },
  {
    n: 281,
    day: '2026-10-23',
    lines: () => [
      `Changed: foraging finds ${listed(['strawberry', 'raspberry', 'blueberry', 'lingonberry', 'acorn', 'nuts'].filter((id) => FRUITING[id]?.includes('spring')).map((id) => itemDef(id).name.toLowerCase()))} in spring too.`,
    ],
  },
  {
    n: 282,
    day: '2026-10-23',
    lines: () => [
      `Changed: season ${num(SHORT_SEASON_DAYS)} → ${num(SEASON_DAYS)} days (${dur(SEASON_SECONDS)}); year ${num(YEAR_DAYS)} days (${dur(YEAR_SECONDS)}). The spring begun ${new Date(YEAR_FROM * 1000).toLocaleString('en-GB', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC runs to ${num(SEASON_DAYS)} days; field crops keep what they have grown.`,
    ],
  },
  {
    n: 283,
    day: '2026-10-23',
    lines: () => [
      'Added: log line when a rare or wild-form wild wildermon comes into view: kind, rarity and forms, distance, direction. Once each.',
    ],
  },
  {
    n: 284,
    day: '2026-10-23',
    lines: () => [
      'Fixed: frame rate zooming over a settlement: crated wildermon, pieces, token, kilns, smelters, anvils, walls, floors and roofs stretched from their last size until the zoom stops. Worst frame of a 1 s zoom over Solara 453 → 174 ms (814 → 237 ms on a 2× screen).',
      'Fixed: shade at wall feet drawn from a kept image per tile, not clipped to each tile every frame; floors kept as images after dark too. All of Solara in view: 87 floors and 186 shaded tiles drawn a frame → under 1.',
      `Fixed: frame rate with 14 wildermon of 10 kinds standing about close in on a 2× screen: pictures kept ${num(BEAST_BUDGET / 1e6)} million pixels (was 14 million), loops in view never dropped for new ones. 322 → 33 ms a frame.`,
    ],
  },
  {
    n: 285,
    day: '2026-10-23',
    lines: () => [
      'Fixed: Mount refused "no saddle and bridle" on a saddled and bridled wildermon.',
    ],
  },
  {
    n: 286,
    day: '2026-10-23',
    lines: () => [
      'Added: Wildermon tab in the event log: taming, crates, posts, tack, gear, relics used, breeding, births, evolving, sightings. Moved there from Talk and Work; refusals stay in Trouble, blows in Combat.',
      `Added: Wildermon tab line to the keeper for each settlement worker's finished work: ${workDoneLine(SPECIES.bevere.name, { stored: { log: 12 } })} Stored: into settlement storage or a hive. Handled: used on an errand.`,
    ],
  },
  {
    n: 287,
    day: '2026-10-23',
    lines: () => [
      `Changed: wildermon life stages in real days: grown after ${dur(YOUNG_FOR_287)}, old after ${dur(OLD_AT_287)}. Dies of old age ${dur(OLD_FOR_287)} after turning old. Every wildermon keeps its stage; old ones set back to grown.`,
    ],
  },
  {
    n: 288,
    day: '2026-10-23',
    lines: () => [
      'Fixed: Mount said "Mounted" and left you on foot beside the wildermon.',
    ],
  },
  {
    n: 289,
    day: '2026-10-23',
    lines: () => [
      'Fixed: frame rate walking or driving with fog on: grass edges on remembered ground redrawn only where the memory changed, not every step. Driving a cart: frame 52 → 18 ms, worst 289 → 92 ms.',
    ],
  },
  {
    n: 290,
    day: '2026-10-23',
    lines: () => [
      `Fixed: riding and pulling teach climbing on the island: Thistlekit, Gorral, Shaggan and every mount. Base climbing gain per tile: ${HAUL_LEARN_290} on the flat, rising with slope to ${HAUL_LEARN_290 + HAUL_LEARN_STEEP_290} at a rise of ${HAUL_LEARN_STEEP_290 * HAUL_LEARN_RISE_290} or more.`,
    ],
  },
  {
    n: 291,
    day: '2026-10-23',
    lines: () => [
      'Fixed: other players saw a mounted rider on foot, the wildermon trailing behind. Now drawn in the saddle, the wildermon moving with them.',
    ],
  },
  {
    n: 292,
    day: '2026-10-23',
    lines: () => [
      'Fixed: market stalls. Anybody, settlement member or not: prices shown, Buy in the stall\'s menu and window. Owner: Set prices in the stall\'s menu.',
    ],
  },
  {
    n: 293,
    day: '2026-10-23',
    lines: () => [
      `Added: Back and Side slots. Backpack worn on the back: carry limit +${percent(BAG_CARRY_293.backpack)}; sack at the side: +${percent(BAG_CARRY_293.sack)}. Each × QL%; both at once.`,
    ],
  },
  {
    n: 294,
    day: '2026-10-23',
    lines: () => [
      'Fixed: settlement workers left idle beside their keeper ("nobody awake within 104 tiles"). The island\'s clock settles everybody\'s own wildermon first, every round; each player\'s area then gets a share of the rest.',
    ],
  },
  {
    n: 295,
    day: '2026-10-23',
    lines: () => [
      'Changed: furniture art: every piece redrawn in the style of the smelter, anvil and wildermon beds. Carts, wagons and boats recoloured to match. Bells coloured by their metal.',
    ],
  },
  {
    n: 296,
    day: '2026-10-24',
    lines: () => [
      'Added: storey mode. Storey arrows or Page Up / Page Down pin one storey: every other storey hidden, above and below, with its furniture and people.',
      'Pinned: clicks land on that storey\'s floor and walk you there; its menu: that storey\'s walls, floors, columns, jetties, Plan staircase up, furniture set down on it. Roof work on the top storey.',
    ],
  },
  {
    n: 297,
    day: '2026-10-24',
    lines: () => [
      'Changed: Plan another storey: only the ground storey must be closed in. 3rd storey and up: planned over a storey still going up.',
    ],
  },
  {
    n: 298,
    day: '2026-10-24',
    lines: () => [
      'Added: mounts climb finished wide staircases: ride on from the foot, through an arch, double door or gate; along finished floors of the storey above. '
        + `No ${SINGLE_STAIRS_NAME}, ladder, roof or staircase side.`,
      'Changed: mounted, indoors through an arch, double door or gate only; no plain door, hidden door or iron-bound gate. Mount and dismount on the ground floor only.',
    ],
  },
  {
    n: 299,
    day: '2026-10-24',
    lines: () => [
      `Added: No plan (side): storey ${NO_PLAN_FROM + 1} and up, bare outside side; no plan model drawn; side still counts as open. Mark out (side): the model back.`,
    ],
  },
  {
    n: 300,
    day: '2026-10-24',
    lines: () => [
      'Faster frames: wildermon, walls, roofs, ground, night lights, trees at dusk and dawn, windows, map, log, island reads.',
    ],
  },
  {
    n: 301,
    day: '2026-10-24',
    lines: () => [
      `Changed: wooden bridge and stone arch replaced by a bridge of each of ${listed(THROWN.filter(isMaterialBridge).map((k) => MATERIAL_BY_ID.get(k)!.name.toLowerCase()))}: `
        + `max length storeys + ${BRIDGE_REACH} tiles, bays equal, each at most heft + ${BAY_PAST_HEFT} tiles, max drop its storeys; per span a wall's bill a lane, per pier a wall's bill a storey of drop; `
        + `1 to ${WIDEST} lanes (${WAGON_WIDTH}: wagons; ${STALL_WIDTH}: furniture on the outer lanes). Existing: wooden → plank, stone arch → stone brick, 1 lane.`,
    ],
  },
  {
    n: 302,
    day: '2026-10-24',
    lines: () => [
      `Changed: idle ${SPECIES.cobbe.name}, work in range wanting only what your settlement stores lack: "${idleSays({ why: 'stock', n: 2, what: ['marble_brick', 'glass'] }, 'hod')}" (up to ${IDLE_WANTS} named), `
        + 'not "no planned building work". Carried piece no work in range wants: back to your settlement stores.',
    ],
  },
  {
    n: 303,
    day: '2026-10-24',
    lines: () => {
      const staired = WALL_MATERIALS.filter((m) => takesAs(m, { floor: 'stairs' }));
      return [
        `Added: ${SPIRAL_STAIRS_NAME}, in all ${num(staired.length)} stair materials: a tile a storey, ${num(SPIRAL_TREADS)} treads round a post, no climbing side. `
          + `Upper storey, cellar or outside staircase tile → Plan ${SPIRAL_STAIRS_NAME}.`,
        `Added: on from the storey below, off on the storey above, any side; stacks storey on storey on one tile, cellar included, on spirals only. `
          + `Cost ${percent(SINGLE_STAIRS_SHARE)} of a solid wall's materials. On foot only.`,
      ];
    },
  },
  {
    n: 304,
    day: '2026-10-24',
    lines: () => [
      'Changed: into the pack (made, gathered, picked up), same as a kept pile but for the keeping: onto the kept pile, kept. Was: a pile of its own.',
      'Changed: count boxes for a craft (shopping list, make until you hold): button Select Quantity.',
      'Fixed: part of a row of a thing that does not stack (needles) into a crate: the count asked for, as far as there is room. Was: the whole row.',
      'Fixed: mounted and at a wagon\'s reins at once: drawn twice, name and speech bubble twice, to everyone else. Take the reins while mounted: refused, "Dismount first."',
    ],
  },
  {
    n: 305,
    day: '2026-10-24',
    lines: () => [
      `Changed: maples drawn solid: own shape from each of the ${num(TURNS)} camera turns; lit by the sun, ${num(SUN_STEPS + 1)} lights a day; shade on the ground away from the sun.`,
    ],
  },
  {
    n: 306,
    day: '2026-10-25',
    lines: () => [
      `Changed: oaks and pines drawn solid, as maples: own shape from each of the ${num(TURNS)} camera turns; lit by the sun, ${num(SUN_STEPS + 1)} lights a day; shade on the ground away from the sun.`,
      'Fixed: solid trees\' long dusk shade on uneven ground: whole, not cut into strips.',
    ],
  },
  {
    n: 307,
    day: '2026-10-25',
    lines: () => [
      `Fixed: Talk tab emptied by other lines (work, wildermon). Talk kept apart: ${num(TALK_LOG)} lines.`,
      `Changed: chat kept on the island ${num(CHAT_KEEP_DAYS)} days, other lines ${num(EVENT_KEEP_DAYS)}; on arriving, last ${num(TALK_LOG)} lines of chat.`,
    ],
  },
  {
    n: 308,
    day: '2026-10-25',
    lines: () => [
      `Added: Deploy on a carried cart, wagon or hull (pack, right click): set down at once on the nearest free spot within ${num(DEPLOY_REACH)} tiles, off your own tile, facing your way.`,
    ],
  },
  {
    n: 309,
    day: '2026-10-25',
    lines: () => [
      `Fixed: Pick sprout on a sapling or clipped tree: refused.`,
      `Changed: Pick sprout: once per tree per ${num(SPROUT_COOLDOWN / 60)} min, workers included.`,
    ],
  },
  {
    n: 310,
    day: '2026-10-25',
    lines: () => [
      `Fixed: oven, brazier: fuel left on hover and right-click title; fuel ring within ${num(RING_REACH)} tiles. Full: oven ${burnsFor(OVEN_CAPACITY)}, brazier ${burnsFor(BRAZIER_CAPACITY)}.`,
      'Added: crate shelf → Open all: every crate in one store window, a line per pile (total, spots). Take and put in: crates in spot order.',
      `Changed: crate shelf menu rows: spot, then name or top ${numberWord(CRATE_KINDS_SAID)} kinds with counts; things / room.`,
      'Fixed: right-click ▸ rows: note shown; rows of one label open apart.',
    ],
  },
  {
    n: 311,
    day: '2026-10-25',
    lines: () => [
      'Fixed: on a foundation: wagon, driver, placed furniture, other players and creatures drawn on its top. Was: on the ground under it.',
      'Fixed: foundation poured in water: dry floor, no swimming. A pool dug in one: water.',
    ],
  },
  {
    n: 312,
    day: '2026-10-25',
    lines: () => [
      'Added: Skills window, Mining: hardest ore, time per action, mine success.',
      `Changed: gem found while working: "${gemFound('Ruby', 34)}" Was: a sentence.`,
    ],
  },
  {
    n: 313,
    day: '2026-10-25',
    lines: () => [
      `Changed: trees drawn solid, as maples: birch, cedar, willow, cherry, apple, pear, plum, peach, apricot, quince, fig, lemon, olive, pomegranate. Own shape from each of the ${num(TURNS)} camera turns; lit by the sun, ${num(SUN_STEPS + 1)} lights a day; shade on the ground away from the sun.`,
    ],
  },
  {
    n: 314,
    day: '2026-10-25',
    lines: () => [
      `Changed: bushes drawn solid, as trees: ${[...BUSH3D_SPECIES].map((b) => BUSH_DEFS[b].name.replace(/ bush$/, '').toLowerCase()).join(', ')}. Own shape from each of the ${num(TURNS)} camera turns; lit by the sun, ${num(SUN_STEPS + 1)} lights a day; shade on the ground away from the sun.`,
      `Changed: rose bush flowers: ${FLOWER_COLOURS.find((c) => c.petal === BUSH_DEFS.find((b) => b.name === 'Rose bush')?.flowers)?.name ?? 'pink'}.`,
    ],
  },  {
    n: 315,
    day: '2026-10-25',
    lines: () => [
      `Changed: tree and bush sway: a step every ${(SWAY_MS / 1000).toFixed(2)} s.`,
      `Changed: rose arch ${recipeBill('make_rose_arch')}; stone rose arch ${recipeBill('make_stone_rose_arch')}.`,
    ],
  },
  {
    n: 316,
    day: '2026-10-25',
    lines: () => [
      'Added: tile window, hover, right-click head: fish catchable here and QL cap; forage, botanize: ready, or wait left; fruit, bush: season time left, wait left, QL cap; sprout wait; wildflowers; grass, moss, reeds cut: wait left.',
      'Added: menu odds and QL cap: Forage, Botanize (passes, find %), Fish (stay on %), Drag the net, Mine, Cut down, Collect, Pick sprout, Pick fruit, Cut (bush), Pick flowers, Investigate (find %).',
      `Changed: picked-over refusals end "${readyIn(FORAGE_COOLDOWN - 50)}" Was: "Try later."`,
      `Fixed: picked-over spots shown as ready. Wait: ${num(FORAGE_COOLDOWN / 60)} min, sprout ${num(SPROUT_COOLDOWN / 60)} min.`,
      `Added: field hover: ripe in, harvest QL cap; ripe fields marked ripe. Fixed: field info: untended harvest ${num(cropYield(0).produce)}, tended every stage ${num(cropYield(RIPE).produce)}. Was: "only the seed".`,
    ],
  },
  {
    n: 317,
    day: '2026-10-25',
    lines: () => [
      `Added: Wildermon window, Care tab, opened first. Needs, worst first: ${listed(NEED_KINDS.map((k) => NEED_LABEL[k].toLowerCase()))}; hurt under ${percent(HURT_AT)} health, hungry under ${percent(HUNGRY_AT)} fed, care under ${percent(CARE_WANTING_317)}. Fix per row: feed, brush, fit gear, pair. Herd: fed, rest, health and care meters; size, job, idle and needs filters. Bulk: Feed hungry, Brush, Assign selected. Beds by size against workers. Gear Fit and Remove in its menu.`,
    ],
  },
  {
    n: 318,
    day: '2026-10-25',
    lines: () => [
      `Added: cottage pie (cooking ${RECIPE_BY_ID.get('make_cottage_pie')?.difficulty ?? 0}, clay bowl, lit fire): ${recipeBill('make_cottage_pie')}; makes ${RECIPE_BY_ID.get('make_cottage_pie')?.count ?? 1}, ${Math.round((itemDef('cottage_pie').food ?? 0) * 100)}% food each.`,
    ],
  },
  {
    n: 319,
    day: '2026-10-25',
    lines: () => [
      'Fixed: a kept stack put in a bag, chest or counter and taken back stays kept, part or whole. Loose stacks taken back join a kept stack first.',
      'Fixed: a kept stack shown loose when two actions were answered out of order.',
    ],
  },
  {
    n: 320,
    day: '2026-10-25',
    lines: () => [
      `Added: Market window, Board and Prices tabs: Find. Every priced thing on every stall and shop counter: QL, silver each, % under or over the ${SALE_DAYS}-day average, stall, location, distance. Sort: price each, QL, distance.`,
      `Added: per row: Walk, Pin (map mark, market colour), Buy within ${COUNTER_REACH} tiles of the counter.`,
      'Added: away from a totem or mailbox: last board read this session, and the nearest settlement totem with Walk and Pin.',
      `Added: price History: last ${SALES_SHOWN} sales of a thing: when, how many, QL, silver each. Order: buy-order form at its ${SALE_DAYS}-day average. Prices: average QL.`,
      'Added: map: a square at every stall and shop counter on the last board read; yours hollow.',
      'Changed: Market board: each thing with its QL, and silver each for a stack.',
    ],
  },
  {
    n: 321,
    day: '2026-10-25',
    lines: () => [
      'Added: Settlement window tabs: Ranks, Workers, Visitors. Settlement tab: citizens, ranks, workers, unfed, specialties and visitors, each a click from its tab.',
      `Added: Ranks tab: every rank's permissions on one grid, a column a rank, a row a permission; one click gives or takes. Was: open a rank, then tick.`,
      `Added: Workers tab: each worker fed and unfed in (${timeWords(UPKEEP_FOR)} at work without a meal: task pace ${percent(UNFED_PACE)}), soonest first; each task's workers against ${SPECIALTY_AT} for a specialty (task speed +${percent(SPECIALTY_BONUS)}), with your wildermon that would add to it and Assign; guards; orders.`,
      `Added: Visitors tab: everybody not a citizen who came onto the settlement, by the hour: last hour, hours seen; kept ${VISIT_KEEP_DAYS} days. Rank permission: ${POWER.visitors.label}.`,
      `Fixed: settlement orders (${ORDER_STANCES.map((st) => STANCE_NAMES[st]).join(', ')}) changed nothing on the island. Now every settlement worker, the founder's and the citizens', and every one assigned after. Rank permission: ${POWER.orders.label}.`,
    ],
  },
];

/**
 * New traits as What's new 276 gives them: the plain ones on one line, by name, rarity and what each lifts; each
 * fighting blood name on a line of its own, by grade.
 */
function newTraitLines(ids: readonly string[]): string[] {
  const plain = ids.map((id) => traitOf(id)).filter((t): t is TraitDef => !!t && !t.family);
  const fights = FIGHTING.filter((f) => ids.includes(f.id));
  return [
    ...(plain.length ? [`Added: traits: ${plain.map((t) => `${t.name} (${t.tier}${t.aura ? ', communal' : ''}) ${traitSays(t)}`).join('; ')}.`] : []),
    ...fights.map((f) => `Added: fighting blood: ${f.name}${f.aura ? ' (communal)' : ''}, by grade: ${TIERS.map((tier) => `${tier} ${traitSays(traitOf(gradeId(f.id, tier)) as TraitDef)}`).join('; ')}.`),
  ];
}

/** The traits What's new 276 adds, a line each part. */
const TRAITS_276: readonly (readonly string[])[] = [
  ['steady_handed', 'ox_necked', 'hawk_eyed', 'lean', 'bookish', 'glutton', 'sure_footed', 'hearth_bred', 'thorned',
    'gentle_mouthed', 'dense_boned', 'fleece_heavy'],
  ['enduring', 'light_sleeper', 'fertile', 'twin_bearing', 'mutable', 'true_breeding', 'long_memoried', 'iron_stomached'],
  ['night_eyed', 'deep_pocketed', 'lucky_finder', 'settler'],
  ['venom_proof', 'fearless', 'quick_recovering', 'quick_clotting', 'crushing', 'ripping'],
];

/** The kinds that butchered into dragon scales until What's new 268. */
const UNSCALED = ['glossa', 'testa', 'thumpa', 'spitta', 'scorcha', 'brittla', 'stona'];

/** The nine kinds What's new 251 gives new lines. */
const NINE_LINES = ['sappa', 'sprigga', 'rowl', 'snout', 'wicka', 'thumpa', 'stona', 'lungra', 'bogga'];

/** The two kinds What's new 274 gives new lines. */
const TWO_LINES = ['plucka', 'grista'];

/** The eight kinds What's new 262 gives new lines. */
const EIGHT_LINES = ['magga', 'grazza', 'grubba', 'wurla', 'mudda', 'dippa', 'middun', 'sparra'];

/** The bronze mirror, as What's new 253 gives it. */
const MIRROR = RELICS.find((r) => r.result === 'bronze_mirror') ?? { parts: 0, difficulty: 0 };

/** The old brace, as What's new 246 gives it. */
const BRACE = RELICS.find((r) => r.result === 'ancient_brace') ?? { parts: 0, difficulty: 0 };

/** The six relics What's new 245 added, by what they restore into. */
const SIX_RELICS = RELICS.filter((r) => [WHETSTONE, SEED_JAR, STAMP, TABLET, 'ancient_collar', 'ancient_bridle'].includes(r.result));


/** The wildermon with an ability of their own, as What's new 177 gives them. */
const ABLE_NEWS = ['lungra', 'hamma', 'crakka', 'bashka', 'executa', 'whirla', 'scorcha', 'frosta', 'rootle', 'dulla', 'brittla', 'shova',
  'howla', 'marka', 'wardo', 'stona', 'leecha'];

/** The highest entry this browser has shown. */
const SEEN = 'wurm.news.seen';

/**
 * Whether this browser has been played in before this page was opened: a
 * window put somewhere, which every session that did anything at all leaves
 * behind (`WindowManager.persist`). Read once, as the page loads, before this
 * session can write one of its own.
 */
const PLAYED_HERE = ((): boolean => {
  try {
    return localStorage.getItem('wurm-iso-windows') !== null || localStorage.getItem(SEEN) !== null;
  } catch {
    return false;
  }
})();

const latest = (): number => Math.max(0, ...NEWS.map((e) => e.n));

function seen(): number {
  try {
    const v = Number(localStorage.getItem(SEEN));
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(SEEN, String(latest()));
  } catch {
    // A browser that keeps nothing is shown the news each time, which is the price of it.
  }
}

/**
 * The entries to show as you come ashore: those past the last one this
 * browser showed, or none for a browser nobody has played in.
 */
export function unseenNews(): number {
  if (!PLAYED_HERE) {
    markSeen();
    return 0;
  }
  return NEWS.filter((e) => e.n > seen()).length;
}

const DAY_WORDS = (day: string): string => {
  const d = new Date(`${day}T12:00:00Z`);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};

/**
 * The journal's What's new tab: every entry, newest first under the day it
 * went out, the ones this browser had not shown marked. Drawn each time it is
 * shown, since what it marks depends on what was seen before, and then marked
 * seen.
 */
export class NewsPanel {
  /** Drawn into `host`, the journal's What's new tab (`JournalPanel`), each time it is shown (`draw`). */
  constructor(private readonly host: HTMLElement) {
    host.classList.add('news-body');
  }

  /** Write it out afresh, the entries not read before marked, and mark them read. */
  draw(): void {
    const was = seen();
    const body = this.host;
    body.replaceChildren();
    let day = '';
    for (const e of [...NEWS].sort((a, b) => b.n - a.n)) {
      if (e.day !== day) {
        day = e.day;
        const h = document.createElement('h4');
        h.className = 'news-day';
        h.textContent = DAY_WORDS(day);
        body.append(h);
      }
      const list = document.createElement('ul');
      list.className = 'news-entry' + (e.n > was ? ' news-new' : '');
      for (const line of e.lines()) {
        const li = document.createElement('li');
        li.textContent = line;
        list.append(li);
      }
      body.append(list);
    }
    markSeen();
  }
}
