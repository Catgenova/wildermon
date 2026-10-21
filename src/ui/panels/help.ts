import { BUILD_COUNTS, MOST_GOES } from '../buildCounts';
import { CELL, CLEAR_CELLS } from '../snapgrid';
import { UPDATE_CHECK_MS } from '../update';
import { JOINT_EVERY, PIN_EVERY, SOFT, STITCH_EVERY } from '../runecut-dress';
import { FRAMES } from '../runecut-frames';
import { lifeWords } from '../runecut-life';
import { islandTime, LOCAL_NIGHT_ENDS, LOCAL_NIGHT_STARTS } from '../theme';
import {
  ACTION_BY_ID, CHIP_CHANCE, CLEARED_TO, FRUIT_MATURE, FRUIT_OLD, GLAZE_ASH, GRASS_PER_CUT, GRASS_PLANT, KIT_MEND, MINE_COLLAPSE, MINE_DEPTH, MOSS_PER_CUT, MOSS_PLANT,
  PROSPECT_REACH, PROSPECT_STEP, REPAIR_FLOOR, repairGo, RESIN_TREE,
} from '../../game/actions';
import { CIRCLET_SHARE, CIRCLET_STONES, GEM_ODDS, GEMS, JEWEL_BONUS, tradeName } from '../../game/gems';
import { ANVIL_SUBTILES } from '../../game/anvil';
import { SKILL_DEFS } from '../../game/skills';
import { CHART_LEAST, CHART_QL_PER_TILE, CHART_SKILL, chartReach, chartSide, COPY_TIME, DRAW_TIME, STUDY_MAP_TIME } from '../../game/cartography';
import { ARCHAEOLOGY_ACTION_BY_ID, FIND_DAMAGE, FIND_DAMAGE_SPREAD, LECTERN_GAIN, RELICS, RESTORE_AGE, RESTORE_HARM, RESTORE_HARM_SPREAD } from '../../game/archaeology';
import { BELT_MAX, QL_PER_LOOP } from '../../game/belt';
import { HUNGER_RATE, staminaBarAbove, SWIM_LEARN } from '../../game/body';
import { HEAL_FED } from '../../game/body';
import { BOON_BONUS, BOON_FOODS, boonTime, REST_CAP, REST_MULT, REST_PER_SECOND, TINCTURE_BONUS, TINCTURE_SECONDS } from '../../game/boons';
import { TINCTURE_NAMES } from '../../game/remedies';
import { BREW_BY_ID, BREWS, isBrew } from '../../game/brewing';
import { AGEING_GROUPS, CELLAR_AGEING, keepsQl } from '../../game/ageing';
import {
  CUT_VINE, CUTTING_TOOL, GRAPE, GRAPE_CUTTING, onceEvery, GRAPE_SEASON, GRAPES_A_PICK, GRAPES_BASE, GRAPES_SPAN, grapesFor, PICK_GRAPES, PLANT_VINE,
  TRELLIS_RULE, trellisRefusedSaid, VINE_BEARS, VINE_REST, VINE_SKILL, vineSoilWords, VINEYARD_ACTIONS, WILD_VINE,
} from '../../game/vineyard';
import { BRIDGES, CLEARANCE, END_SLOP, PULL_REACH, RAMP_SLOPE, rampTiles } from '../../game/bridges';
import { AQUEDUCT } from '../../game/aqueducts';
import { AQUEDUCT_FLOW, AQUEDUCT_LPS, CHANNEL_DEEP, CHANNEL_WIDE, CORNER_LITRES, FOUNTAIN_RIM, TILE_METRES } from '../../world/aqueducts';
import { gateJobWords, gateReach, HIDDEN_DOOR_IRON, HIDDEN_DOOR_LAPSE } from '../../game/gates';
import { RUNE_GATE, RUNE_GATE_FADE, RUNE_GATE_GLOW_REACH, RUNE_GATE_REACH, RUNE_GATE_RISE, runeGateName } from '../../game/runegate';
import { HOARD_LUMPS, HOARD_MORE } from '../../game/butcher';
import {
  CELLAR_DECAY, CELLAR_DEPTH, CELLAR_SOIL, COLUMN_SHARE, columnBill, floorBill, GLASS_ROOF, HEFT_WORDS, INDOORS_DECAY, INDOORS_REST, JETTY_REACH, MATERIALS as WALL_MATERIALS, onlySaid, OUTSIDE_STAIR_LEVEL, takesAs,
  MAX_LEVELS, RAILING_HEIGHT, roofShapeDef, SINGLE_STAIRS_NAME, SINGLE_STAIRS_SHARE, STAIRS_SHARE, roofShapeOf, SIDE_NAMES, WALL_HEIGHT, wallBill, WALL_TYPE_BY_ID, WALL_TYPES,
} from '../../game/building';
import { CELLAR_ACTION_BY_ID, CELLAR_DAYLIGHT, cellarOutdoor } from '../../game/cellar';
import { materialName } from '../../game/buildActions';
import { COUNTER_HOLDS, COUNTER_REACH, COUNTER_SEEN, COUNTER_WALL } from '../../game/counters';
import { BARTER_IDLE, BARTER_MOST, BARTER_REACH } from '../../game/barter';
import { flameSources } from '../../game/lantern';
import { LAMP_INTO_WALL } from '../../game/lamps';
import { STORE_REACH } from '../../game/crates';
import { GREEN_ACTIONS, GREEN_DAY, GREEN_DAYS, GREEN_SHADE, GREEN_SUN, GREEN_WET, GREEN_WET_REACH } from '../../game/greening';
import { FIRE_COST, FIRE_SUBTILES } from '../../game/campfire';
import {
  CHANNELS, CLASS_AT, CLASS_CHANGE_COST, CLASS_COLUMNS, CLASS_NODES, CLASS_TIER_AT, CLASSES, channelSays, NODES_PER_TRADE, PERK_CLASSES,
  PERK_TIER_AT, PERKS_PER_TIER, riteDef, RITES, type Channel,
} from '../../game/classes';
import { PERK_BY_ID, PERKS, perksOf } from '../../game/perks';
import { CLASS_LEARN_BLOW, CLASS_LEARN_KILL, CLASS_LEVEL_START, CLASS_SPELL_BY_ID, spellTerms } from '../../game/talents';
import { CREATURE_CRATE } from '../../game/creaturecrate';
import { CRATE_DEFS, SUBTILES } from '../../game/crates';
import {
  AGES, BLOW_SHARE, BREED_REST, CARE_BONUS, CARE_HOURS, COAX_LAPSE, COAX_STEP, COMPANION_LEASH, COMPANION_SIGHT, cookRecipes, restoredMul, STYLE_SAYS, abilityName, abilitySays, GATHER_DO, GATHER_VERB, panFind, REED_LEVELS, RESIN_TAPPED, SKILL_TOP, TEND_JOBS, GESTATION, GRAZE_FILL, HUNGRY, HUNT_REST, HUNT_SIGHT, MONSTER_CAP, MONSTER_KEEP_OFF,
  BED_REST, DEN_HEALTH, restFor, SPECIALTY_AT, SPECIALTY_BONUS, TIRE_GOES, UNFED_PACE, unfedSays, UPKEEP_FOR,
  BASE_STATS, BLOW_MEMORY, EVOLVE_AT, FILE_RARITY_ODDS, HOME_SLACK, LEARNS_SAYS, PULL_LEARN, MONSTER_SHARE, MONSTERS, OLD_AT, WILD_STAY, POT_MOST, POT_STEP, PULL_DEFAULT, RANGE_PER_STEP, rangeSteps, seasonSays, SKILL_STEP, SPECIES, stageSays, trainedHit, YOUNG_FOR, FED_CARE, FED_FAVOURITE, FED_FOR, FED_LEARN, levelSkill, stageLevels, tameNeeds, WILD_STAGE_CHANCE, WILD_STAGE_ODDS, WILD_STAGE_TAME, LEARN_PACE, learnPaceSays, STAGE_LOADS, TEND_REACH,
} from '../../game/creatures';
import { DEED_UPGRADES } from '../../game/deed';
import { idleSays, LEDGER_ITEMS, LEDGER_SHOWN } from '../../game/workerlog';
import { BANNER_AGAIN, BANNER_DEPTH, BANNER_MS, LEAVING_MS } from '../deedbanner';
import { DEFAULT_RANKS, NEWCOMER_RANK, permsOf, POWER, RANK_CAP, RANK_NAME_MAX, RANK_POWERS, rankMay, STORE_LOG_CAP } from '../../game/ranks';
import { storeMarkable } from '../../game/stores';
import {
  DELIVER_REACH, LEDGER_KEEP, NOTICE_KEEP, NOTICE_MAIL_DAYS, NOTICE_MAX, WORK_COUNT_MAX, WORK_DONE_KEEP, WORK_OPEN_MAX, WORK_QL_TOP,
} from '../../game/noticeboard';
import {
  colourWord, DYE_LITRES, DYE_LITRES_PER_KG, DYE_PANE_LITRES, DYE_PARTS, DYE_QL_BLACK, DYE_QL_PURE, DYE_QL_WHITE, dyeGrams, DYESTUFF_OF, DYESTUFFS, dyeHex, dyeRecipeId, kgSaid, mixDye,
  PRIMARIES, pureDye, type DyeLiquid, type Primary,
} from '../../game/dyestuffs';
import { BOIL_LITRES, boilCountPlain, gramsOf, litresWord, TINTED_PANE } from '../../game/dyes';
import { SIGN_MAX, SIGN_QL } from '../../game/signing';
import { CROP_BY_SEED, CROPS, cropYield, growthWords, PATCH_TIME, RIPE, STAGE_NAMES } from '../../game/farming';
import { GLASSHOUSE_GROWTH, PLANTER_GROWTH, SEASON_GROWTH, SEASON_SECONDS, YEAR_SECONDS, YEARLESS_GROWTH } from '../../game/growth';
import { CASTS, FAVOUR_TRICKLE, favourCap, PRAYER_BASE, PRAYER_GAIN, PRAYER_LIFT, PRAYER_PEAKS, PRAYER_REST, PRAYER_TAPER, prayerWorth } from '../../game/faith';
import { tryGain } from '../../game/learn';
import { DRIVING_LEARN, DRIVING_TOP, drivingPace, SAILING_LEARN, SAILING_TOP, sailingPace, TRAVEL_TOP_AT, VEHICLE_QL_TOP, vehicleQlPace } from '../../game/travel';
import { ANCIENT_EFFECTS, ANCIENT_PLUS, BAUBLE_HIGH, BAUBLE_KINDS, BAUBLE_LOW, BAUBLE_SHARE, BAUBLE_TIERS, baubleTimes, MAJOR_SKILLS, MINOR_SKILLS, REGRET_SHARE, YIELD_TIMES } from '../../game/baubles';
import { SOUL_CHANCE } from '../../game/sacrifice';
import { HERB_HEAL, healAmount, SUITS_HEAL } from '../../game/firstaid';
import { groomGain } from '../../game/husbandry';
import { ARTIFACT_FOR, SHEAR_FEATHERS, SHEAR_WOOL } from '../../game/creatureActions';
import { butcherYield } from '../../game/butcher';
import { BAIT_BY_ID, biteShare, FISH, LINE_REACH } from '../../game/fishing';
import { BOTANIZE_WATER_TABLE, COIN_FIND_ONE_IN, COIN_FINDS_A_DAY, FORAGE_TABLE, PER_ROLL, rollsAt, watersideOdds } from '../../game/forage';
import { FRUITING, fruitingSeasons, fruitsIn } from '../../game/fruiting';
import { BUCKET_LITRES, FURNITURE, furnitureDef, LIQUID_NAME, type LiquidKind, POND_EVERY, STATION_REACH, teamSaid, WELL_TRICKLE, WELL_TRICKLE_QL } from '../../game/furniture';
import { BUTTER_CHURN, CHURN_BUTTER, MILK_READY, milkLitres, WHEY_FEED } from '../../game/dairy';
import { STONES_DEPTH, STONES_DIFFICULTY, STONES_SLABS, WATER_GARDEN_ACTIONS, yearSays } from '../../game/watergarden';
import { WATER_PLANT_BY_ID, WATER_PLANT_DEEPEST, WATER_PLANT_SHALLOWEST, WATER_ROOTING, type WaterPlantDef } from '../../world/waterplants';
import { GRAVE_KEEPS, GRAVE_REACH } from '../../game/graves';
import {
  ASH_RATE, BASE_QUEUE, BOAT_LOAD_DRAG, boatHands, MIND_EASE_PER_LEVEL, MIND_EASED_SKILLS, mindEaseAt, queueCapAt, controlPaceAbove, staminaCostAbove, windRegenAbove, CARRY_BASE, CARRY_PER_STRENGTH, CARRY_STOP, CHAR_START, DAMAGE_MAX, DAMAGE_WARN,
  DAMAGE_WARN_STEP, DAWN, DAY_SECONDS, DEED_RADIUS, DEED_RADIUS_PER_LEVEL, DEEDS_JOINED, deedWorkersAt, DUSK,
  footing, Game, goSeconds, hullSpeed, kitQl, MAX_DEED_LEVEL, MAX_MOUNT_SPEED, ORDINARY_GAIN, overDrag, QL_BARE, QL_LOW,
  QL_SPAN, QUEUE_PER_MIND, TWILIGHT, wearPerUse,
  QL_TOP,
} from '../../game/game';
import { ARMOUR, ARMOUR_CLASSES, BANE_BONUS, SLOTS, WEAPON_BY_ID, WEAPONS, type ArmourClass, type WeaponDef } from '../../game/gear';
import { PAIR_RANGE, TIER_LEVEL } from '../../game/husbandry';
import { IMPROVE_DAMAGE, IMPROVE_FLOOR } from '../../game/improve';
import { billWords, countOf, DEED_DECAY, HOARD_METALS, itemDef, ITEM_DEFS, RARITIES, RARITY_ROOM, rarityBands, rarityChance, roomFor } from '../../game/items';
import { ALL_GOALS, JOURNAL, LEGEND_AT } from '../../game/journal';
import { guidePages, keepable } from '../../game/guide';
import { TRACK_RANGE_BASE, TRACK_RANGE_PER, TRACK_SHOW, trackBandsSays, trackErrSays, trackRange } from '../../game/tracking';
import { MOBS_RANGE } from '../../game/keep';
import { KILN_CAPACITY } from '../../game/kiln';
import { candleBurn, FIRE_REACH, HELD_LIGHTS, lanternReach, MEMORIAL_REACH, OVEN_REACH, PLINTH_BUSY_REACH, PLINTH_REACH, torchBurn, torchReach } from '../../game/light';
import { MARK_CAP } from '../../game/marks';
import { MATERIAL_BY_ID, type MaterialDef } from '../../game/materials';
import { calmCap, CHOOSE_AT, PATH_LIST, PATH_TIER_AT, PICKS_PER_TIER, picksOf, SIT_CALM, SIT_REST, SIT_WORTH } from '../../game/meditation';
import { COIN_METALS, COIN_QL_WEIGHT, COINS_PER_LUMP, coinPurity, INGOT_LUMPS, INGOT_WEIGHT, METALS, MOULD_SKILL, MOULDS, NAILS_PER_LUMP, PRECIOUS_METALS, RARE_METALS } from '../../game/metal';
import { COIN_WORTH } from '../../game/money';
import { ORDER_LIFE } from '../../game/orders';
import { KEPT_BEST, NUTRIENT_HOURS, NUTRIENT_NAMES, NUTRIENTS, TABLE_BEST } from '../../game/nutrition';
import { OVEN_CAPACITY, SHORE_REACH } from '../../game/placeables';
import { BASE_SPEED, CARRY_CRAWL, CLIMB_LEARN, CLIMB_LEARN_FROM, CLIMB_LEARN_STEEP, CLIMB_PER_LEVEL, MAX_STAND, MAX_STEP, SWIM_DEPTH } from '../../game/player';
import { deckBill, metres, PIER_CLEAR, PIER_DROP, PIER_WALL_DROP, PIER_WATER } from '../../game/piers';
import { POST_FOLLOW_REACH, POST_LIFE_MAX, POST_LIFE_MIN, postRadius } from '../../game/posts';
import { CRAFT_REACH, RECIPE_BY_ID, RECIPES, TRADE_BOOK_AT, TRADE_BOOK_SKILLS } from '../../game/recipes';
import { TREE_DEPTH } from '../recipetree';
import { GAIN_RATE, MIN_GAIN, SKILL_BY_ID, skillGain } from '../../game/skills';
import { SMELTER_H, SMELTER_W } from '../../game/smelter';
import { KNACK_BONUS, KNACK_CAP, KNACK_GO, KNACK_HOME, KNACK_ODDS, TITLE_STEPS, titlesFor } from '../../game/titles';
import { CATCH_MOST, CHECK_EVERY, CREEL_BAIT_LOSS, creelOdds, HUNTER_TRAPPED, TIMID_TRAPPED, TRAPS } from '../../game/traps';
import {
  betterThanCommon, CHANNELS as BLOOD, depthMul, FIGHT_SHARE, FIGHTING, GRADE_STEP, husbandryOdds, inheritChance, LAMP_TIER_ODDS, lineSaid, MUTATION_ODDS, pct as cardPct,
  PEDIGREE_MOST, PEDIGREE_STEP, TIERS, TRAIT_SLOTS, TRAIT_SOURCES, TRAITS, upgradeChance, type TraitTier,
} from '../../game/traits';
import { CHAIN_MOST, FALL_DROP, FILL_RATE, POND_MOST, POOL_DEPTH, POOL_LIP, RUN_MOST, RUN_RATE, SPRING_DEPTH, SPRINGS_EACH } from '../../world/springs';
import { CLEAR_OF_BUILDINGS, CONCRETE_PER_STEP, LIFT_PER_MASONRY, POOL_FILL } from '../../game/foundations';
import { AWARENESS, awarenessReach, BASE_SIGHT, LIGHT_GIVES_BACK, NIGHT_LOSS, TREE_OPACITY } from '../../game/vision';
import { AWARE_PER_LEVEL, AWARE_TRAIT_STEP, awareShareAbove, awareTraitEase } from '../../game/game';
import { NIGHT_EYES_FROM } from '../../game/learn';
import { NO_GO, pointAt, windWord, windWorth } from '../../game/wind';
import { article, capital, finePercent, listed, listedOr, percent, timeWords } from '../../game/words';
import { DODGE_MOST } from '../../game/fight';
import { CONTROL_HIT } from '../../game/gear';
import { BACK_PACE, BACK_SLACK, CIRCLE_ARC, CIRCLE_R, COWARD_AT, COWARD_DRAG, DRAW_WALK, FALL_BACK, FLEE_SECS, GUARD_RANGE, HUNTER_TURN, KEEP_OFF, MONSTER_TURN, PACK_CALL, PACK_MOST, PACK_RANGE, THROW_HIT, THROW_REACH } from '../../game/fight';
import { FIGHT_QUIET, ARM_SLOW, ARM_SLOW_MOST, armourSays, BLINDSIDE, blowSays, CROWD_BLOCK, FLANK_HIT, HEAVY_EVERY, HEAVY_HIT, HIDE_NAMES, HIDES, hideSays, LEG_SLOW_MOST, sideOf, WIND_UP, BLOW_DEFENSIVE, BLOW_HUNTER, BLOW_PREY, FIGHT_BACK_STILL, FIGHT_GIVE_UP, FIGHT_LEASH, FIGHT_STANCE_NAMES, FIGHT_STANCES, FIST, FOLLOW_RANGE, stanceSays, SWING_FLOOR, SWING_WIND, SWING_WIND_KG, swingSeconds, TARGET_RANGE, TIRED_AT, TIRED_SLOW, armourSwingSays, OVERBURDEN_SWING, overburdenSwingSays } from '../../game/fight';
import {
  ARROW_IDS, BODKIN_HIDE, BURN_WEAR, CONSIDER_EASY, CONSIDER_HARD, CRIT_BASE, CRIT_HIT, CRIT_KNIFE, CRIT_PER_SKILL, DODGE_FROM, DODGE_PER_CONTROL, DODGE_PER_KG, dodgeChance, KNIFE_BLEED,
  KNIFE_BLEED_SECS, STAGGER_MAUL, THREAT_HOLD, VENOM_DRAIN, VENOM_SECS,
} from '../../game/fight';
import { ALIGNMENT_NAMES, BAR_SLOTS, FAITH_SPELLS, FAITH_TIER_AT, PATRON_AT, PATRONS, SCHOOL_NAMES, slotsFor, SPELL_ON_WORDS, SPELL_ONS, SPELL_REACH, SPELLS_PER_TIER } from '../../game/patrons';
import { BIND_BY_ID, keyName } from '../../game/keybinds';
import {
  CLOSE_BARE, CLOSE_CLOTH, CLOSE_PACE, CLOSE_PER_SKILL, CLOSE_RIGHT, CLOSE_WRONG, DRESSING_RANK, FESTER_CLOTH, FESTER_WRONG, WOUND_KINDS,
} from '../../game/wounds';
import { TURNS } from '../../render/view';
import { ORE_DENSITY, seamShare } from '../../world/ore';
import { lairOf, REGIONS } from '../../world/regions';
import { ISLAND_ELEMENT, MOTES_LEAST, MOTES_MOST, MOTES_STEP, SWIRL_DARK, SWIRL_LIGHT, SWIRLS_A_DAY } from '../../game/motes';
import { LANDING_STAND, RUNESTONES, STONE_SPAN, TELE_FAR, TELE_FAST, TELE_NEAR, TELE_QL_HIGH, TELE_QL_LOW, TELE_RANGE_STEP, TELE_REST_STEP, TELE_SLOW, telestoneRange, telestoneRest } from '../../game/runestones';
import {
  BUSH_DEFS, groundRoll, ROCK_VARIANTS, SLAB_VARIANTS, STEPS_BRICKS, STEPS_LEAST, STEPS_MOST, STEPS_PLANKS, STEPS_SLABS, STEPS_TWIST, TILE_DEFS, TileType,
  TREE_DAWN_UTC, TREE_DEFS, WEAR_FALL, WEAR_MOST, WEAR_TRAIL, WEARS,
} from '../../world/tiles';
import { STEPS_BACK, stepsBack, STONE_DIFFICULTY, STONE_STEPS_BILL, TIMBER_DIFFICULTY, TIMBER_STEPS_BILL } from '../../game/steps';
import { ROSES_RULE } from '../../game/roses';
import { DEVICE_COUNT } from '../../render/furniture';
import { FLOWER_MOST, FLOWER_SEASONS } from '../../world/flowers';
import { SEASON_DAYS, SEASONS, YEAR_DAYS, YEAR_FROM } from '../../world/calendar';
import { BLOOMS, BUSH_EVERGREEN, BUSH_FLOWER_FROM, evergreen, LEAF_DAYS, SHED_DAYS, TURN_DAYS } from '../../render/foliage';
import { lifeSeasons } from '../../render/life';
import { COUNTS } from '../beltmenu';
import { DAMAGE_BREAKING } from '../itemcells';
import { IDLE_LOGOUT } from '../../game/keep';
import { awayFor } from '../../game/away';
import { BOARD_RULES, REFRESH as BOARD_REFRESH } from './boards';
import { LETTER_MAX } from '../../net/island';
import { KEYS as NUMBER_KEYS } from './tile';
import { HUNGRY_AT, HURT_AT } from './wildermon';
import {
  ENCHANTMENTS, enchantFigure, enchantValue, ENCHANT_BREAK, ENCHANT_HARM, ENCHANT_LEAST, ENCHANT_MOST, ENCHANTERS_PLINTH, enchantChance, ENCHANTMENT_LIST, enchantPct, FROST_PACE, FROST_SECS, GRACE_TILES, NETMENDER_WEAR, ON_WORDS, ROLLED_EFFECTS, SCROLL_HARM, SHOT_EFFECTS, WORN_CAP,
} from '../../game/enchant';
import { BOWS, BRAND_SPELL, enchantLineAt, jobTools, meleeNames, monsterNames } from '../../game/enchanting';
import { blockSays, reachSays, STUN_SECS } from '../../game/fight';
import { DAMAGE_MAX as BROKEN_AT, PLACED_REACH, QL_TOP as ENCHANT_TOP } from '../../game/limits';
import { TRY_LEARN } from '../../game/learn';
import { raisedBySays } from '../raisedBy';
import { ENGRAVE_MAX, ENGRAVE_SKILL, ENGRAVE_TOOL, MEMORIAL } from '../../game/memorial';
import { HOUR as SKEP_HOUR, SKEP, SKEP_CLUMP_HOURS, SKEP_HOLDS, SKEP_IDLE, SKEP_REACH, SKEP_SKILL, SKEP_WAX_EVERY, skepRate, skepRateSaid, skepWax } from '../../game/bees';
import { keepControlKeys } from '../controlkeys';

/** What a cellar's rock gives, by the stone: every stone's own shards. */
const CELLAR_SHARDS = listed(ROCK_VARIANTS.filter((r) => r.yields.endsWith('_shards')).map((r) => itemDef(r.yields).name.toLowerCase()));
/** The perk that lowers what a vein wants of a miner (`ore:below`). */
const ORE_SENSE = PERKS.find((p) => 'ore:below' in p.fx);
/** The pieces that do not go down into a cellar, by name: what burns an open fire, and `cellarOutdoor` but the grave nobody makes. */
const CELLAR_BURNS = FURNITURE.filter((d) => d.hearth).map((d) => article(d.name) + ' ' + d.name.toLowerCase());
/** The brews that age in their barrel (`ageing.ts`). */
const AGEING = BREWS.filter((b) => b.ages);
/** How grape wine ages, for the vineyard's own paragraph. */
const GRAPE_AGEING = BREW_BY_ID.get('grape_wine')?.ages;
/** The liquids besides brews, spirit and dye that carry their QL in and out of a barrel (`keepsQl`), by name. */
const QL_LIQUIDS = (Object.keys(LIQUID_NAME) as LiquidKind[]).filter((l) => keepsQl(l) && !isBrew(l) && l !== 'dye').map((l) => LIQUID_NAME[l]);
/** A vine job's label, as the menu says it. */
const VINE_ACTION = (id: string): string => VINEYARD_ACTIONS.find((a) => a.id === id)?.label ?? id;
const CELLAR_NOT_DOWN = FURNITURE.filter((d) => cellarOutdoor().includes(d.id) && d.bill.length).map((d) => article(d.name) + ' ' + d.name.toLowerCase());
/** The pieces that hold things and still cannot be a settlement store (`storeMarkable`), by name. */
const NOT_A_STORE = FURNITURE.filter((d) => ((d.capacity ?? 0) > 0 || (d.heft ?? 0) > 0) && !storeMarkable(d.id, d))
  .map((d) => article(d.name) + ' ' + d.name.toLowerCase());

/** The Farmer's perk that holds an effect, by name. */
/** The frames a seam is stitched between, by name (`SOFT`): "the burlap sack, the starred leather book or the treasure map". */
const softFrames = (): string => {
  const names = FRAMES.filter((f) => SOFT.has(f.kind)).map((f) => `the ${f.label.toLowerCase()}`);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names.join('');
};

const farmerPerk = (key: string): string => perksOf('farmer').find((p) => key in p.fx)?.name ?? key;
/** What a tile of glass roof of a shape takes: "12 glass panes and 4 timbers". */
/**
 * The rune gate's paragraph (`runegate.ts`): where it stands, what it costs
 * and what lights it, every number off the rule.
 */
const runeGateHelp = (): string => {
  const def = WALL_TYPE_BY_ID.get(RUNE_GATE);
  const mat = (WALL_MATERIALS.find((m) => m.id === def?.laidIn)?.name ?? '').toLowerCase();
  return `<p><b>${runeGateName()}</b>: settlement entrance.</p>
    <ul>
      <li>Build: point at a tile edge on the ground, <b>Plan fence</b>, <b>${def?.name}</b>; feed with <b>Build fence</b>.
      Material: ${mat} only. Bill: ${billIn(Object.entries(wallBill(def?.laidIn ?? '', RUNE_GATE).total))}.</li>
      <li>No door, no lock, see-through. People, carts and wildermon pass. Nothing rests on its lintel.</li>
      <li>Lights while a citizen stands within ${RUNE_GATE_REACH} of a tile of the middle of its opening: the founder, or a rank
      with <b>${POWER.gate.label}</b>, of a settlement whose border takes in the tile on either side.
      Strangers, ranks without ${POWER.gate.label} and wildermon do not light it.</li>
      <li>Light up: ${RUNE_GATE_RISE} s. Go out: ${RUNE_GATE_FADE} s after the last citizen leaves.</li>
      <li>Lit after dark: light ${RUNE_GATE_GLOW_REACH} tiles round its opening. No other effect.</li>
      <li>Island: the member lists of settlements with a rune gate are sent to every player ashore.</li>
    </ul>`;
};
/** The wall types too low to close in a glasshouse, from their own `low`: "a fence, a fence gate, an iron-bound gate or a half wall". */
const lowWalls = (): string => {
  const names = WALL_TYPES.filter((w) => w.low).map((w) => w.name.toLowerCase()).map((n) => `${article(n)} ${n}`);
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
};
/** What a tile of glass roof takes, on the shape Plan roof lays: "12 glass panes and 4 timbers". */
const glassTile = (): string =>
  listed(Object.entries(floorBill(GLASS_ROOF.id, 'roof', roofShapeOf(undefined)).total).map(([id, n]) => `${n} ${materialName(id, n)}`));
/** The Farmer's perks that work on a planter as on a field: whatever a sowing or a harvest reads, but for Crop Rotation, which a planter keys to itself. */
const planterPerks = () => perksOf('farmer').filter((p) => !('rotate:plant_seed' in p.fx)
  && Object.keys(p.fx).some((k) => /:(plant_seed|harvest_crop)$/.test(k) || k.startsWith('plus:')));
/** How long a quiet browser is still counted as there: `idle_logout()` on the island. */
const awayAfter = (): string => (IDLE_LOGOUT % 60 ? `${+(IDLE_LOGOUT / 60).toFixed(1)} minutes` : awayFor(IDLE_LOGOUT));

/*
 * The help gives every count and quantity in figures ("64 stone bricks",
 * "1/5", "×3", "20 minutes"), so these stand in for the words helpers of
 * `words.ts` and `items.ts`, off the same numbers.
 */
/** A multiplier in figures: "×3", "×1.25". */
const mul = (m: number): string => `×${+m.toFixed(2)}`;
/** A part of a whole in figures: 0.2 is "1/5", 0.75 "3/4"; a share that is no simple fraction is a percentage, as `share` has it. */
const frac = (x: number): string => {
  for (const d of [2, 3, 4, 5, 6, 8, 10, 12, 20]) {
    const n = Math.round(x * d);
    if (n >= 1 && n < d && Math.abs(x * d - n) < 1e-6) return `${n}/${d}`;
  }
  return percent(x);
};
/** A stretch of time in figures, to the second under a minute and a half, the half minute under ten, the minute under two hours, the quarter hour past: "45 seconds", "2.5 minutes", "1.25 hours", "3 days". */
export const dur = (seconds: number): string => {
  const s = Math.round(seconds);
  const unit = (n: number, one: string): string => `${n} ${one}${n === 1 ? '' : 's'}`;
  if (s < 90) return unit(s, 'second');
  if (s < 600) return unit(Math.round(s / 30) / 2, 'minute');
  const m = Math.round(s / 60);
  if (m < 60) return unit(m, 'minute');
  if (m < 120) return m === 60 ? unit(1, 'hour') : `${unit(1, 'hour')} ${unit(m - 60, 'minute')}`;
  const h = Math.round(m / 15) / 4;
  return h >= 24 && h % 24 === 0 ? unit(h / 24, 'day') : unit(h, 'hour');
};
/** "3 sand", "a gem": a count of a thing in figures (`countOf`). */
const countIn = (id: string, n: number): string => countOf(id, n, true);
/** A bill in figures (`billWords`). */
const billIn = (b: ReadonlyArray<readonly [string, number]>): string => billWords(b, true);

/*
 * Every number in the help is the rule's own, read off the constant, the
 * table or the function that decides it, so that the text cannot drift from
 * what the game does (`CLAUDE.md`; `supabase/test/benefit.ts` asks). The few
 * helpers below read those tables the way a sentence wants them.
 */

/** A glassblowing job as the help names it: "Melt into glass, three sand into two glass lumps". */
const glassJob = (id: string): string => {
  const r = recipe(id);
  return `<b>${r.label}</b>, ${bill(id)} into ${countIn(r.result, r.count ?? 1)}`;
};
/** What one prayer trains a skill by at `v`, for a gain of `base`, on the roll's mean: "+1.4". */
const prayerTrains = (v: number, base: number): string => `+${skillGain(v, base, 1).toFixed(1)}`;
/** Every count of motes a swirl can give, fewest first (`motesFor`). */
const MOTE_COUNTS = Array.from({ length: MOTES_MOST - MOTES_LEAST + 1 }, (_, i) => MOTES_LEAST + i);
/** Where the help reads a prayer off: the skill levels, and the altar's quality at either end and in the middle. */
const PRAYER_SHOWN = [1, 50, 100];
/* The weapon and the fighting skills Help times a swing at, off the rule the fight times it by (`swingSeconds`). */
const HELP_SWORD = WEAPON_BY_ID.get('short_sword') as WeaponDef;
const HELP_SWING_AT = [1, 30, 50];
const fixed2 = (n: number): string => String(+n.toFixed(2));
const ALTAR_QL = [0, 50, 100] as const;
/** What one prayer banks at Prayer `v`, at an altar of the middling quality, at the better hour. */
const prayerBanks = (v: number): number => Math.round(prayerWorth(ALTAR_QL[1], PRAYER_PEAKS[0], v));
/** What stained glass is laid as, in the words the plan refuses anything else in. */
const stainedOnly = (): string => { const m = WALL_MATERIALS.find((x) => x.id === 'stained_glass'); return m ? onlySaid(m) : ''; };
/** How many glass panels an opening is glazed with. */
const glazing = (type: 'window' | 'bay'): number => WALL_TYPE_BY_ID.get(type)?.fittings?.find(([item]) => item === 'glass')?.[1] ?? 0;
/** A recipe by its id. A missing one is a mistake in the help, and says so. */
const recipe = (id: string) => {
  const r = RECIPE_BY_ID.get(id);
  if (!r) throw new Error(`The help names a recipe there is not: ${id}`);
  return r;
};
/** Each size a dyeing goes by, as the help names it (`DYE_LITRES`). */
const DYE_SIZE_SAID = { garment: 'a garment', banner: 'a banner', sail: 'a sailing boat', ship: 'a caravel', wall: 'a side of a wall', floor: 'a tile of floor' } as const;
/** What a recipe takes, as it is read: "a shaft, two leathers and four nails", or in figures. */
/** An enchantment's figure at the best quality, as Examine says it: "10%". */
const atTop = (id: string): string => {
  const e = ENCHANTMENTS[id];
  if (!e) throw new Error(`The help names an enchantment there is not: ${id}`);
  return enchantFigure(e, enchantValue(e, ENCHANT_TOP));
};
/** A skill's name as the Skills window shows it. */
const SKILL_NAME = (id: string): string => SKILL_BY_ID.get(id)?.name ?? id;
/** Care runs from none to full (`Math.min(1, …)` wherever it is added). */
const CARE_RANGE = [0, 1] as const;
/** What care is, the first time a section names it. */
const CARE_SAID = `${percent(CARE_RANGE[0])}–${percent(CARE_RANGE[1])}: from brushing and feeding; raises breeding odds`;
/**
 * Enchanting, off its table (`enchant.ts`): the scrolls, what Enchant takes
 * and makes, and what each enchantment does, every number from the rule.
 */
function enchantingHelp(): string {
  const pts: Array<[number, number]> = [[1, 20], [20, 40], [50, 50], [90, 100]];
  // A Kindler's own burns grow, and this is one of theirs when they swing it (`class_burn`).
  const linger = PERKS.find((p) => 'burn:secs' in p.fx);
  const sear = PERKS.find((p) => 'burn:rate' in p.fx);
  const kindled = BRAND_SPELL && linger && sear
    ? ` Swung by a Kindler: counts as their burn. Lasts ${mul(BRAND_SPELL.fx.long)} as long while ${BRAND_SPELL.name} holds
      (${BRAND_SPELL.fx.secs} s); +${percent(linger.fx['burn:secs'] - 1)} duration with ${linger.name}; +${percent(sear.fx['burn:rate'] - 1)}
      damage a second with ${sear.name}.`
    : '';
  const rows = ENCHANTMENT_LIST.map((e) => `<li><b>${e.name}</b>: ${bill(`make_${e.scroll}`)}; on ${ON_WORDS[e.on]}.
      QL ${ENCHANT_TOP}: ${enchantLineAt(e, ENCHANT_TOP)} Scales with QL; QL ${ENCHANT_TOP / 2}: ${enchantLineAt(e, ENCHANT_TOP / 2)}
      ${e.effect === 'burn' ? kindled : ''}</li>`).join('');
  const first = ENCHANTMENT_LIST[0];
  return `<h4>Scrolls</h4>
    <ul>
      <li>Written at the crafting window with <b>enchanting</b>, one recipe per enchantment, at ${workedAt(`make_${first.scroll}`)}.</li>
      <li>Quality (QL): the usual craft check, capped at the papyrus sheet's QL.</li>
      <li>Failure: motes lost; the sheet takes ${SCROLL_HARM} damage (spread over its pile's sheets); a sheet that would reach ${BROKEN_AT} is used up.</li>
    </ul>
    <ul>${rows}</ul>
    <h4>Enchanter's plinth</h4>
    <ul>
      <li>Enchant is done standing within ${STATION_REACH} tiles of the middle of an <b>enchanter's plinth</b> on the ground; writing a scroll needs none.</li>
      <li>Bill: ${bill(`make_${ENCHANTERS_PLINTH}`)}. Built with a trowel at ${workedAt(`make_${ENCHANTERS_PLINTH}`)}. Gathers moss like a statue.</li>
      <li>Night light: ${PLINTH_REACH} tiles at rest, ${PLINTH_BUSY_REACH} tiles while somebody enchants at it.</li>
    </ul>
    <h4>Enchant</h4>
    <ul>
      <li><b>Enchant</b> on a scroll in the pack, then pick the target in the pack. Melee weapon: ${meleeNames()} (not a bow or thrown weapon).
      Bow: ${listed(BOWS.map((id) => itemDef(id).name.toLowerCase()))}.</li>
      <li>Chance: average of enchanting and scroll QL, as a percent; min ${percent(ENCHANT_LEAST)}, max ${percent(ENCHANT_MOST)}
      (${pts.map(([sk, q]) => `${percent(enchantChance(sk, q))} at enchanting ${sk} with a QL ${q} scroll`).join('; ')}).</li>
      <li>Enchantment QL: that average × ${QL_LOW} to ${Number((QL_LOW + QL_SPAN).toFixed(2))}, + ${QL_BARE}; capped at the scroll's QL and the
      weapon's QL. The log names the cap that held.</li>
      <li>Failure: ${ENCHANT_HARM} damage to the weapon; ${percent(ENCHANT_BREAK)} chance it breaks outright. A weapon at ${BROKEN_AT} damage is gone.</li>
      <li>The scroll is used up either way.</li>
      <li>One enchantment per weapon, shown in its name (Sword (${first.name})) and on Examine with its QL.</li>
      <li>Trains <b>enchanting</b> every action; a failed action ${percent(TRY_LEARN)} as much.</li>
    </ul>
    <h4>Weapon effects</h4>
    <ul>
      <li><b>Stun</b>: ${STUN_SECS} s on a creature: no moving (fleeing included), no striking; a heavy blow being drawn back is lost.
      A new stun restarts the timer (no stacking). Target panel: "stunned".</li>
      <li>Set off only by an ordinary melee swing that lands: ${listed(ENCHANTMENT_LIST.filter((e) => ROLLED_EFFECTS.has(e.effect) || e.effect === 'leech' || e.effect === 'drain').map((e) => e.name))}.
      Not by class blows, shots or throws.</li>
      <li>On every blow with the weapon: ${listed(ENCHANTMENT_LIST.filter((e) => e.effect === 'swing' || e.effect === 'crit' || e.effect === 'smite').map((e) => e.name))}.</li>
      <li>Gale: % off swing time (${atTop('gale')} at QL ${ENCHANT_TOP}), applied last, multiplies with tired or wounded arms and a Berserker's Wild Strength or Adrenaline.</li>
      <li>Nightblade: points added to critical chance (${atTop('nightblade')} at QL ${ENCHANT_TOP}), on top of skill and a Skirmisher's Keen Edge.</li>
      <li>Sunstrike: multiplies with every other damage change. Hostile monsters: ${monsterNames()}.</li>
      <li>Leeching: health on top of a Berserker's Thirst for Blood.</li>
      <li>Farsight: multiplies with the bow's range, its maker's mark and an Archer's Long Draw.</li>
      <li>Worn pieces add up: ${listed(ENCHANTMENT_LIST.filter((e) => WORN_CAP[e.effect] !== undefined)
        .map((e) => `${e.name} to ${percent(WORN_CAP[e.effect] ?? 0)} at most`))} in total; each multiplies with every other change to a blow
      (stance, armour, ward, spell).</li>
      <li>Featherstep: multiplies with every other pace (speed multiplier) change, Power's Long Stride included.</li>
      <li>Shadowcloak: multiplies with each hunter's sight of you, at night only. Goes on the chest piece.</li>
      <li>Bulwark: points on top of a shield's block chance, past the usual shield maximum.</li>
      <li>Set off only by an ordinary bow shot that lands: ${listed(ENCHANTMENT_LIST.filter((e) => SHOT_EFFECTS.has(e.effect)).map((e) => e.name))}.</li>
      <li><b>Slow</b>: ${percent(FROST_PACE)} of the creature's pace for ${FROST_SECS} s. Two slows: the stronger holds, to the later end. Target panel: "slowed".</li>
    </ul>
    <h4>Tools</h4>
    <ul>
      <li>Action tools: ${listed([...jobTools()].map((id) => itemDef(id).name.toLowerCase()))}. A weapon takes
      ${listed(ENCHANTMENT_LIST.filter((e) => e.on === 'tool').map((e) => e.name))} only if it is one of these.</li>
      <li>Several of a tool carried: the one best at the action is used, and its enchantment counts.</li>
      <li>Swiftwork: % off time per action (${atTop('swiftwork')} at QL ${ENCHANT_TOP}) after the floor; multiplies with time-per-action perks, a piece standing near and Steady Hands.</li>
      <li>Truesteel: multiplies with tool-wear perks.</li>
      <li>Bountiful: Harvest on a bush (sickle), and a fish landed with the rod. Lodestone: Mine (pickaxe).
      The extra one is at the action's QL; an extra fish is never rare.</li>
    </ul>
    <h4>Light</h4>
    <ul>
      <li>Lantern's Grace: on a carried lantern or torch. % added to the burn time (${atTop('lanterns_grace')} at QL ${ENCHANT_TOP}) of a candle set in the lantern afterwards, or of the torch
      when struck empty; a candle already in it burns as before. +${GRACE_TILES} tiles of light reach.</li>
      <li>A lantern hung on a lantern post burns and lights as the post's own.</li>
    </ul>
    <h4>Jewellery</h4>
    <ul>
      <li>Counts while worn in the single jewel slot: one of ${listed(ENCHANTMENT_LIST.filter((e) => e.on === 'ring' || e.on === 'amulet').map((e) => e.name))} at a time.</li>
      <li>Scholar's Band: % added to skill gain (${atTop('scholars_band')} at QL ${ENCHANT_TOP}) in every skill, like a worn stone; alongside a reader's Attentive and knacks.</li>
      <li>Knackstone: multiplies with a reader's Polymath. Steady Heart: with body stamina's share of wind.
      Hearthbound: with Power's Enduring and what you have eaten. Favoured: with a prayer's favour before the faith cap.
      Stillwater: with the sitting place's own bonus.</li>
    </ul>
    <h4>Packs, swimming, sight</h4>
    <ul>
      <li>Packmule: kilos added to carry weight per enchanted backpack or satchel carried; alongside a Terraformer's Strong Back and Power's Pack Mule.
      A pack inside another pack counts for the outer pack.</li>
      <li>Seal's Coat: multiplies swim speed (never past walking) and takes the same % off swimming's stamina cost, with Power's Hard Breath.</li>
      <li>Hawk's Eye: multiplies sight range, with a reader's Keen Sight.</li>
    </ul>
    <h4>Furnaces and stations</h4>
    <ul>
      <li>${listed(ENCHANTMENT_LIST.filter((e) => e.on === 'furnace' || e.on === 'station').map((e) => `${e.name} goes on ${ON_WORDS[e.on]}`))}.</li>
      <li>Enchanted in place: Enchant on the scroll in the pack, within ${PLACED_REACH} tiles of the thing's middle; only on a thing you may open past any padlock.</li>
      <li>Chance as in the pack; QL capped at the thing's QL. Failure: ${ENCHANT_HARM} damage, never past ${BROKEN_AT - 1} (never breaks).</li>
      <li>Enchantment and damage stay with it when picked up and set down again.</li>
      <li>Ember Heart: % off fuel burnt per second of heat (${atTop('ember_heart')} at QL ${ENCHANT_TOP}); work speed unchanged.</li>
      <li>Masterwork: points added to anvil and loom results after recipe perks, max QL ${ENCHANT_TOP}; a scroll still never beats its sheet.
      Several looms in reach: the best counts.</li>
    </ul>
    <h4>Boats, carts, containers</h4>
    <ul>
      <li>Fair Wind: multiplies sailing pace on every point of sail, after wind, build, maker's mark and Sailing.</li>
      <li>Deep Hold, True Axle, Bag of Holding: multiply capacity (items, kilos or litres) before rarity's bonus. Cart or wagon: its load; pace unchanged.
      A crate is enchanted in place, like furniture.</li>
      <li>Contents still weigh their full weight on a cart, a boat and your back.</li>
      <li>One enchantment per thing: a boat takes Deep Hold or Bag of Holding, not both, and names the one it has when asked for the other.</li>
      <li>Enchantments are never removed. If one were lost, contents stay and nothing more goes in until under the new capacity.</li>
    </ul>
    <h4>Traps, nets, beds</h4>
    <ul>
      <li>Snarecraft: multiplies a trap's catch chance after its QL, the wildermon's wariness and timid or hunter; max ${enchantPct(CATCH_MOST)}.
      Creel: multiplies fish chance after maker's mark. Enchanted in place or in the pack; kept through pickup and set-down.</li>
      <li>Netmender: multiplies a drag's average haul after a Fisher's Full Net and the net's maker's mark; its fish % × ${NETMENDER_WEAR} off
      drag wear on the net, alongside Truesteel and perks.</li>
      <li>Dreamweave: multiplies a night's banked rest after bed QL and roof; raises max rest held after that night by the same %.
      A later night in a plain bed never takes rest away.</li>
    </ul>
    <h4>Tack</h4>
    <ul>
      <li>Fleetfoot: multiplies mount pace after saddle and bridle maker's marks, past the usual mount maximum.</li>
      <li>Tamer's Bridle: multiplies an offering's tame chance after Love's Gentle Hand (best bridle in the pack counts). A mount wearing it keeps
      fighting at any distance from you, as with Love's Steady Herd.</li>
      <li>Both go on the saddle or bridle in the pack, ride on the mount when saddled and return to the pack with the tack.
      An enchanted saddle or bridle is its own pile, never merged with plain ones.</li>
    </ul>`;
}

/**
 * Milk, butter and cheese (`dairy.ts`): who is milked and for how much, what
 * a bucket of milk becomes, what each feeds, and how much longer each keeps
 * than the milk, every number off the rule.
 */
function dairyHelp(): string {
  const milkers = Object.values(SPECIES).filter((d) => d.milk);
  const fills = milkers.filter((d) => milkLitres(d.id) >= BUCKET_LITRES).map((d) => d.name);
  const short = milkers.filter((d) => milkLitres(d.id) < BUCKET_LITRES);
  const milk = itemDef('milk_bucket');
  const fed = (id: string): string => {
    const d = itemDef(id);
    const parts = NUTRIENTS.filter((n) => feeds(id, n) > 0).map((n) => `${percent(feeds(id, n))} ${NUTRIENT_NAMES[n].toLowerCase()}`);
    return `${d.drink ? `${percent(d.drink)} of thirst` : `${percent(d.food ?? 0)} of the food bar`}, ${listed(parts)}`;
  };
  const keeps = (id: string): string => frac((itemDef(id).decay ?? 1) / (milk.decay ?? 1));
  return `
    <h3>Milk, butter and cheese</h3>
    <h4>Milking</h4>
    <ul>
      <li>Who: a tamed, grown female ${listedOr(milkers.map((d) => d.name))}. Action: <b>Milk</b>, once ${percent(MILK_READY)} of its milk has come back; takes all of it.</li>
      ${milkers.map((d) => `<li>${d.name}: milk back in full in ${dur(1 / (d.fleece ?? 1))}.</li>`).join('')}
      ${fills.length ? `<li>${listedOr(fills)}: fills an empty bucket per milking: <b>bucket of milk</b>, ${BUCKET_LITRES} litres.</li>` : ''}
      ${short.map((d) => `<li>${d.name}: ${milkLitres(d.id)} litres per milking, into an empty bucket or a
      <b>part bucket of milk</b>; full at ${BUCKET_LITRES} litres, the excess lost; quality (QL) averaged by litres.</li>`).join('')}
    </ul>
    <h4>What milk makes</h4>
    <ul>
      <li>Bucket of milk: ${milk.charges ?? 0} drinks, each ${fed('milk_bucket')}.</li>
      <li>Barrel: keeps its QL, averaged by litres with milk already there (see Brewing).</li>
      <li>Cheese: pressed in a clay bowl (${workedAt('make_cheese')}): ${made('make_cheese')} <b>cheeses</b>. Returns a <b>bucket of whey</b>
      (${BUCKET_LITRES} litres).</li>
      <li>Butter: churned within ${STATION_REACH} tiles of a <b>butter churn</b> on the ground (${workedAt(CHURN_BUTTER)}): ${made(CHURN_BUTTER)}
      pats of <b>butter</b>. Returns the bucket empty. Churn: ${(SKILL_BY_ID.get(recipe(`make_${BUTTER_CHURN}`).skill)?.name ?? '').toLowerCase()},
      ${bill(`make_${BUTTER_CHURN}`)}.</li>
      <li>Failed cheese or butter: milk lost, bucket returned empty.</li>
      <li>Pastry: ${need('bake_pastry', 'butter')} pats of butter + ${need('bake_pastry', 'dough')} round of dough, at a lit fire or oven
      (${workedAt('bake_pastry')}): ${made('bake_pastry')} <b>pastries</b>.</li>
    </ul>
    <h4>Food values</h4>
    <ul>
      <li>Cheese: ${fed('cheese')}. Butter (pat): ${fed('butter')}. Pastry: ${fed('pastry')}.</li>
      <li>Rot rate on the ground, against a bucket of milk: cheese ${keeps('cheese')}, butter ${keeps('butter')}.</li>
    </ul>
    <h4>Whey</h4>
    <ul>
      <li>Feed to any wildermon you keep: fills ${percent(WHEY_FEED)} of its hunger (one item of its own diet: ${percent(GRAZE_FILL)}). Bucket returned empty.</li>
      <li>Not drinkable. Can be poured into a barrel or tipped out. Rots as fast as a bucket of milk.</li>
    </ul>`;
}

/** The clumps of wildflowers in reach the help works a skep's rate out for. */
const BEE_CLUMPS = [25, 50, 100];
const bill = (id: string, figures = true): string =>
  billWords(recipe(id).inputs.map((i) => [i.item, i.count ?? 1] as const), figures);
/** How many of one thing a recipe takes. */
const need = (id: string, item: string): number => {
  const input = recipe(id).inputs.find((i) => i.item === item);
  if (!input) throw new Error(`The help says ${id} takes ${item}, and it does not.`);
  return input.count ?? 1;
};
/** How many a recipe makes. */
const made = (id: string): number => recipe(id).count ?? 1;
/** What a skill a recipe is worked on is called, and how hard the recipe is: "ropemaking 6". */
const workedAt = (id: string): string => {
  const r = recipe(id);
  return `${(SKILL_BY_ID.get(r.skill)?.name ?? r.skill).toLowerCase()} ${r.difficulty ?? 0}`;
};
/** A material by its id. */
const mat = (id: string): MaterialDef => {
  const m = MATERIAL_BY_ID.get(id);
  if (!m) throw new Error(`The help names a material there is not: ${id}`);
  return m;
};
/** A kind of ground. */
const ground = (t: TileType) => TILE_DEFS[t];
/** What a kind of ground takes off a full wagon's pace. */
const rollCost = (t: TileType): number => 1 - groundRoll(ground(t).roll, 1);
/**
 * The day a tile walked `steps` times a day wears through to a trail, a
 * night's fall coming off between one day and the next; or none, when the
 * nights take off all the days put on.
 */
const daysToTrail = (steps: number): number | null => {
  let wear = 0;
  for (let day = 1; day <= 4 * WEAR_MOST; day++) {
    wear = Math.min(WEAR_MOST, wear + steps);
    if (wear >= WEAR_TRAIL) return day;
    wear = Math.max(0, wear - WEAR_FALL);
  }
  return null;
};
/** "1 time", "3 times": how often a thing is done in a day. */
const often = (n: number): string => `${n} time${n === 1 ? '' : 's'}`;
/** A walk there and back puts a step on every tile of the way each way. */
const STEPS_A_TRIP = 2;
/** The walks there and back a day the help works a trail out for. */
const TRIPS_A_DAY = [1, 2] as const;
/** How much of one of the four a thing feeds. */
const feeds = (id: string, nutrient: string): number => (itemDef(id).feeds as Record<string, number> | undefined)?.[nutrient] ?? 0;
/** A shop counter's wall type, and the hinges it is hung with (`counters.ts`). */
const COUNTER_TYPE = WALL_TYPE_BY_ID.get(COUNTER_WALL) ?? { factor: 1, fittings: [] as Array<[string, number]> };
const counterHinges = COUNTER_TYPE.fittings?.find(([id]) => id === 'hinge')?.[1] ?? 0;
/** The best anything can be made, and the roughest. */
const TOP_QL = 100;
const LOW_QL = 1;
/** Seconds in an hour of the clock on the wall. */
const HOUR = 3600;
/** An hour of the island's clock as the hud shows it: "21:00". */
const hudHour = (h: number): string =>
  `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

/** The creatures that carry a light of their own, and the ones whose blows burn. */
const GLOWING = Object.values(SPECIES).filter((s) => s.glow);
const BURNERS = Object.values(SPECIES).filter((s) => s.wound === 'burn');
/** The share of a day the sun is up. */
const DAYLIT = (DUSK - DAWN) / 24;
/** Where a skill starts, and the top of any skill. */
const startOf = (id: string): number => SKILL_BY_ID.get(id)?.start ?? 1;
const TOP_SKILL = 100;
/** Kilos over the mark to show the drag of, and what a full suit of iron plate drags. */
const OVER_EXAMPLE = 100;
const PLATE_SUIT = ARMOUR_CLASSES.plate.burden * mat('iron').weight;
/** Jobs a copper tool of this quality does before it goes to pieces, to the nearest ten. */
const jobsAt = (ql: number): number => Math.round(DAMAGE_MAX / (wearPerUse(ql) * mat('copper').wear) / 10) * 10;
/** A badly worn tool and a skilled repairer, to show what repair costs. */
const WORN = 80;
const SKILLED = 90;
const repairGoes = (skill: number): number => Math.ceil(WORN / repairGo(skill).healed);
const repairCost = (skill: number): string => `${+(WORN * repairGo(skill).cost).toFixed(1)} points`;
/** The kinds of wound. */
const KINDS = Object.values(WOUND_KINDS);
/** What a go's quality is spread over when it is not simply your skill. */
const QL_SPREAD = `${QL_LOW} to ${+(QL_LOW + QL_SPAN).toFixed(2)} times`;

/** One height unit: a slice of a cellar, a step of a corner. Shown in metres (`metres`). */
const HEIGHT_UNIT = 1;
/** A height too small for `metres`' one place, to two: a climbing level's 0.04 m. */
const metresFine = (units: number): string => String(+(units / 10).toFixed(2));
/** The railing's wall type, for its share of a wall's bill. */
const railing = WALL_TYPE_BY_ID.get('railing') ?? { factor: 0 };
/** The weight rule in words: each weight of material, what it is, and what has to be under it. */
const heftGroups = (): string => {
  const hefts = [...new Set(WALL_MATERIALS.map((m) => m.heft))].sort((a, b) => a - b);
  const or = (xs: string[]): string => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`);
  return hefts.map((h) => `${HEFT_WORDS[h]} (${listed(WALL_MATERIALS.filter((m) => m.heft === h).map((m) => m.name.toLowerCase()))}) goes over `
    + `${h === hefts[0] ? 'anything' : h === hefts[hefts.length - 1] ? `${HEFT_WORDS[h]} only` : or(hefts.filter((k) => k >= h).map((k) => HEFT_WORDS[k]))}`).join('; ');
};
/** A column's bill in the lightest and the heaviest of the materials. */
const columnBills = (): string => ['log', 'marble'].map((m) => `${billIn(Object.entries(columnBill(m).needed))} in ${m}`).join(', ');

/** The steps of rarity above the ordinary. */
const RARE_STEPS = RARITIES.map((_, i) => i).slice(1);
/**
 * What one supreme unit of two puts on the chance of a supreme thing, off the
 * rule (`rarityBands`): two units, one of them supreme, against two plain ones.
 */
const SUPREME = RARITIES.findIndex((r) => r.name === 'supreme');
const RARE_IN_EXAMPLE = ((): { units: number; step: string; more: number } => {
  const one = RARITIES.map((_, i) => (i === 0 || i === SUPREME ? 1 : 0));
  const plain = RARITIES.map((_, i) => (i === 0 ? 2 : 0));
  return { units: one.reduce((a: number, b) => a + b, 0), step: RARITIES[SUPREME].name, more: rarityBands(one)[SUPREME] - rarityBands(plain)[SUPREME] };
})();
/** How long a go at a book is, as the action has it. */
const STUDY_TIME = ARCHAEOLOGY_ACTION_BY_ID.get('study_book')?.baseTime ?? 0;
/** The trade a map is drawn with, by name, and the level the help times its jobs at. */
const CHART_SKILL_NAME = (SKILL_DEFS.find((d) => d.id === CHART_SKILL)?.name ?? CHART_SKILL).toLowerCase();
const HELP_SKILL = 50;

/** Stone that ages: the two clearings, and the day a thing at a pace is covered on. */
const [CLEAR_IVY, SCRUB_MOSS] = GREEN_ACTIONS;
/** Planning a wall, which a hidden door's plan is in every way anybody else can see. */
const PLAN_WALL = ACTION_BY_ID.get('plan_wall');
/** Pulling a bridge down, which a settlement keeps to its builders. */
const BRIDGE_PULL = ACTION_BY_ID.get('demolish_bridge');
const AQUEDUCT_PULL = ACTION_BY_ID.get('demolish_aqueduct');
const coveredBy = (pace: number): number => Math.ceil(GREEN_DAYS / pace);
/** A name as the middle of a sentence has it, with its article: "a statue". */
const aOrAn = (name: string): string => `${article(name)} ${name.toLowerCase()}`;
/** A mix of dye as its hex and plain word, at QL 50 where it is the mix itself. */
const mixSaid = (l: DyeLiquid): string => `${colourWord(dyeHex(l))} (${dyeHex(l)})`;
/** Equal parts of the primaries named, at the QL a dye is the mix itself at; the first takes what does not divide. */
const equalParts = (ps: readonly Primary[]): DyeLiquid => {
  const each = Math.floor(DYE_PARTS / ps.length);
  const l: DyeLiquid = { red: 0, yellow: 0, blue: 0, ql: DYE_QL_PURE };
  ps.forEach((p, i) => { l[p] = i === 0 ? DYE_PARTS - each * (ps.length - 1) : each; });
  return l;
};
/** The litres of each that the help pours together to show a mix. */
const MIX_SHOWN = 2;
/** The QLs the help shows red at, a quarter of the way up and three quarters. */
const DARK_SHOWN = Math.round((DYE_QL_BLACK + DYE_QL_PURE) / 2), LIGHT_SHOWN = Math.round((DYE_QL_PURE + DYE_QL_WHITE) / 2);

/** Where armour is worn, and the classes of it anybody can make: all but the one riveted from a dragon. */
const ARMOUR_SLOTS = [...new Set(ARMOUR.map((a) => a.slot))];
const MADE_ARMOUR = Object.values(ARMOUR_CLASSES).filter((c) =>
  !ARMOUR.some((a) => a.cls === c.id && RECIPE_BY_ID.get(`make_${a.id}`)?.inputs.some((i) => i.item === 'dragon_scale')));
/** The kinds of weapon, each its own subskill, and the bows strung with a bowstring. */
const WEAPON_KINDS = [...new Set(WEAPONS.map((w) => w.kind))];
const WOOD_BOWS = WEAPONS.filter((w) => w.ammo && RECIPE_BY_ID.get(`make_${w.id}`)?.inputs.some((i) => i.item === 'bow_string'));
/** What gives feathers: butchered, or plucked. */
const FEATHERED = Object.values(SPECIES).filter((s) => s.butcher?.feather || s.shearYield === 'feather');
/** The relic in the most pieces, which the list runs up to. */
const LAST_RELIC = RELICS[RELICS.length - 1];

/** The mining a metal's seam asks for. */
const METAL_LEVEL = (id: string): number => METALS.find((m) => m.id === id)?.level ?? 0;
/** A Thistlekit (`orse`) under a rider, green and with its climbing worked right up. */
const ORSE_GREEN = SPECIES.orse.speed * footing(0);
const ORSE_WORKED = Math.min(MAX_MOUNT_SPEED, SPECIES.orse.speed * footing(TOP_SKILL));
/** What each settlement level asks for, as the deed menu says it. */
const UPGRADES_SAID = listed(Object.entries(DEED_UPGRADES).map(([level, reqs], i) =>
  `level ${level} ${i === 0 ? 'wants ' : ''}${listed(reqs.map((r) => `${r.label[0].toLowerCase()}${r.label.slice(1)}`))}`));
/** How far a worker starts from the token, sort by sort, and the sorts whose range grows by other than the usual step. */
const WORK_RANGES = [...new Set(Object.values(SPECIES).filter((s) => !s.monster).map((s) => s.workRange))].sort((a, b) => a - b);
const RANGE_STEPS_SAID = (() => {
  const odd = new Map<number, string[]>();
  for (const s of Object.values(SPECIES)) {
    if (s.rangePerStep && s.rangePerStep !== RANGE_PER_STEP) odd.set(s.rangePerStep, [...(odd.get(s.rangePerStep) ?? []), `a ${s.name}`]);
  }
  return listed([...odd.entries()].sort((a, b) => a[0] - b[0]).map(([n, names]) => `${listed(names).replace(/ and ([^,]*)$/, ' or $1')} ${n}`));
})();
/** How many passes a forager takes over a tile, at the skills worth naming. */
const PASSES_SAID = listed([0, PER_ROLL, 2 * PER_ROLL, TOP_SKILL].map((at, i) =>
  (i === 0 ? `${rollsAt(at)} pass below ${PER_ROLL}` : `${rollsAt(at)} at ${at}`)));

/** A sentence's first letter down, for one set inside another. */
const lowerFirst = (t: string): string => (t ? `${t[0].toLowerCase()}${t.slice(1)}` : t);
/** The things that are not wildermon, how far off they notice you, and how their weights add up. */
const MONSTER_SORTS = Object.values(SPECIES).filter((s) => s.monster);
const NOTICED = MONSTER_SORTS.map((s) => s.notice ?? HUNT_SIGHT).sort((a, b) => a - b);
const MONSTER_WEIGHT = MONSTERS.reduce((n, [, w]) => n + w, 0);
/** A hoard's deep metals: the ones nobody strikes a coin from. */
const HOARD_DEEP = HOARD_METALS.filter((id) => !PRECIOUS_METALS.some((m) => id === `${m}_lump`));
/** The composite bow, the best of the wooden ones, and what a suit of scale takes. */
const COMPOSITE = WEAPONS.find((w) => w.id === 'composite_bow') ?? WEAPONS[0];
const BEST_WOOD_BOW = [...WOOD_BOWS].sort((a, b) => (b.range ?? 0) - (a.range ?? 0))[0] ?? WEAPONS[0];
const SCALE_SUIT = ARMOUR.filter((a) => a.cls === 'scale').reduce((n, a) => n + need(`make_${a.id}`, 'dragon_scale'), 0);
/** The least and the most a trait of each tier moves the number it moves most. */
const TIER_SPAN = Object.fromEntries(TIERS.map((tier) => {
  const most = TRAITS.filter((t) => t.tier === tier).map((t) => Math.max(...Object.values(t.effects).map((m) => Math.abs((m ?? 1) - 1))));
  return [tier, [Math.min(...most), Math.max(...most)]];
})) as Record<TraitTier, [number, number]>;
/** The seams in the rock, by the mining each asks, and what one is called in a list. */
const SEAMS = ROCK_VARIANTS.filter((r) => r.level).sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
const seamName = (name: string): string => name.replace(/ (vein|seam)$/, '').toLowerCase();
/** What an ordinary go teaches at a level, and the levels worth showing it at. */
const GAIN_AT = [1, 50, 90, 99];
const gainAt = (level: number): number => skillGain(level, ORDINARY_GAIN, 1);
const gainSaid = (level: number): string => String(Number(gainAt(level).toPrecision(gainAt(level) >= 0.1 ? 2 : 1)));

/** What a wildermon crate is built of, read off its bill: "8 × plank, 4 × nails and 2 × metal ribbon". */
const crateBill = (): string => {
  const parts = furnitureDef(CREATURE_CRATE).bill.map(([id, n]) => `<b>${n} × ${itemDef(id).name.toLowerCase()}</b>`);
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
};

// ---- What the help counts and compares, each off the table that decides it. ----

/** A trade's tree, while any trade is still on one: its columns, and the ranks in each. None now, the Warder having moved last. */
const TREED = CLASS_NODES[0]?.class;
const COLUMNS = TREED ? CLASS_COLUMNS[TREED].length : 0;
const RANKS = COLUMNS ? NODES_PER_TRADE / COLUMNS : 0;
/** What a trade put down or undone takes with it: the nodes bought as well as the perks taken, while any trade has a tree. */
const BOUGHT = COLUMNS ? 'the nodes you bought or the perks you took' : 'the perks you took';
/** What a node of this rank costs. */
const costOf = (rank: number): number => CLASS_NODES.find((n) => n.rank === rank)?.cost ?? 0;
/** The same, in figures: "1 point", "3 points". */
const pointsFor = (rank: number): string => `${costOf(rank)} point${costOf(rank) === 1 ? '' : 's'}`;
/** What a node of this channel and rank says on its card. */
const nodeSays = (ch: Channel, rank: number): string => CLASS_NODES.find((n) => n.channel === ch && n.rank === rank)?.note ?? '';
/** The trades moved over to perks, and the first perk of the first of them, as its card says it. */
const PERK_TRADES = CLASSES.filter((c) => PERK_CLASSES.has(c.id) && c.kind === 'craft');
const FIRST_PERK = PERK_TRADES.length ? perksOf(PERK_TRADES[0].id)[0] : undefined;
/** The fighting trades moved over to spells and passives, and the first spell of the first of them. */
const SPELL_TRADES = CLASSES.filter((c) => PERK_CLASSES.has(c.id) && c.kind === 'combat');
const FIRST_SPELL = SPELL_TRADES.length
  ? perksOf(SPELL_TRADES[0].id).map((p) => CLASS_SPELL_BY_ID.get(p.id)).find((sp) => sp !== undefined)
  : undefined;
/** A Forester's perk's numbers, by the perk's name. */
const forester = (name: string): Record<string, number> => perksOf('forester').find((p) => p.name === name)?.fx ?? {};
const BRUSH_SIDE = 2 * (forester('Clear Brush').clear_brush ?? 0) + 1;
const farmer = (name: string): Record<string, number> => perksOf('farmer').find((p) => p.name === name)?.fx ?? {};
const cook = (name: string): Record<string, number> => perksOf('cook').find((p) => p.name === name)?.fx ?? {};
const fisher = (name: string): Record<string, number> => perksOf('fisher').find((p) => p.name === name)?.fx ?? {};
const tailor = (name: string): Record<string, number> => perksOf('tailor').find((p) => p.name === name)?.fx ?? {};
const herdsman = (name: string): Record<string, number> => perksOf('herdsman').find((p) => p.name === name)?.fx ?? {};
const PATCH_SIDE = 2 * (farmer('Sow a Patch').sow_patch ?? 0) + 1;
/** How many channels the rites push, from the narrowest to the widest. */
const riteWidths = [...new Set(RITES.map((r) => Object.keys(r.muls).length))].sort((a, b) => a - b);
/** What a rite does to its channels, as its card says it. */
const riteSays = (id: string): string =>
  Object.entries(riteDef(id)?.muls ?? {})
    .map(([ch, mul]) => `${CHANNELS[ch as Channel].note.toLowerCase()} ${channelSays(mul)}`)
    .join(', ');
/** Where awareness starts. */
const AWARE_START = SKILL_BY_ID.get(AWARENESS)?.start ?? CHAR_START;
/** Awareness's share per level, to three places: "0.125%". */
const AWARE_RATE = `${+(AWARE_PER_LEVEL * 100).toFixed(3)}%`;
/** And at the top: "10%". */
const AWARE_TOP = percent(awareShareAbove(SKILL_TOP - CHAR_START));
/** Levels from a characteristic's start to the top. */
const TOP_ABOVE = SKILL_TOP - CHAR_START;
/** A multiplier to two places, trailing zeros dropped. */
const two = (x: number): number => +x.toFixed(2);
/** The things that hold other things and go in a pack. */
const BAGS = Object.keys(ITEM_DEFS).filter((id) => ITEM_DEFS[id].holds);
/** The pieces a fine carpenter builds, and the ones among them that hold things. */
const FINE = FURNITURE.filter((f) => RECIPE_BY_ID.get(`make_${f.id}`)?.skill === 'fine_carpentry');
const HOLDERS = FINE.filter((f) => f.capacity && !f.liquid).sort((a, b) => (a.capacity ?? 0) - (b.capacity ?? 0));
/** How many ways a piece can face. */
const SIDES = Object.keys(SIDE_NAMES).length;
/** The hulls, and the vehicles that are driven. */
const BOATS = FURNITURE.filter((f) => f.boat);
const ROWER = furnitureDef('rowing_boat');
const SAILER = furnitureDef('sailing_boat');
const SHIP = furnitureDef('caravel');
const CART = furnitureDef('large_cart');
const WAGON = furnitureDef('wagon');
/** The barrels, smallest first. */
const BARRELS = FURNITURE.filter((f) => f.liquid).sort((a, b) => (a.liquid ?? 0) - (b.liquid ?? 0));
/** What the bins that weigh rather than count will take, in kilos. */
const CRAFT_HEFT = furnitureDef('craft_bin').heft ?? 0;
const SEED_HEFT = furnitureDef('seed_bin').heft ?? 0;
const SPROUT_HEFT = furnitureDef('sprout_bin').heft ?? 0;
/** A settlement's width, token and all. */
const DEED_ACROSS = DEED_RADIUS * 2 + 1;
/** What a gold coin is worth in silver, and a handful of small change for the example. */
const GOLD = (COIN_WORTH.Gold ?? 0) / (COIN_WORTH.Silver ?? 1);
const POCKET = 5;
/** The metals out of the deep seams: the rare ones nobody strikes a coin from. */
const DEEP_METALS = [...RARE_METALS].filter((m) => !PRECIOUS_METALS.includes(m));
/** A quality to show a hatchet at, and a helping at. */
const HATCHET_QL = 40;
const BOON_QL = 70;
/** The brew a quern skips the barrel for. */
const CIDER = BREW_BY_ID.get('cider') ?? BREWS[0];
/** The trees that bear. */
const FRUIT_TREES = TREE_DEFS.filter((t) => t.fruit);
/** An item's name as a sentence carries it. */
const lowName = (id: string): string => itemDef(id).name.toLowerCase();
/** The bushes a sickle cuts something off. */
const CUT_BUSHES = BUSH_DEFS.filter((b) => b.yields);
/** Each season and the trees in fruit in it: "in summer cherry, peach and fig". */
const TREES_BY_SEASON = SEASONS.map((s) => `in ${s} <b>${listed(FRUIT_TREES.filter((t) => fruitsIn(t.fruit ?? '', s)).map((t) => t.name.toLowerCase()))}</b>`);
/** A loot table's finds that keep a season, each with its seasons, and the ones had all year. */
const seasonalFinds = (table: Array<[string, number]>): string =>
  table.filter(([id]) => FRUITING[id]).map(([id]) => `<b>${lowName(id)}</b> in ${listed(fruitingSeasons(id))}`).join('; ');
const yearRoundFinds = (table: Array<[string, number]>): string => listed(table.filter(([id]) => !FRUITING[id]).map(([id]) => lowName(id)));
/** Whether every seed foraging and botanizing turn up is had all year. */
const SEEDS_ALL_YEAR = BOTANIZE_WATER_TABLE.concat(FORAGE_TABLE).filter(([id]) => id.endsWith('_seed')).every(([id]) => !FRUITING[id]);
/** An island of the chart by name, as a sentence carries it. */
const islandName = (name: string): string => name.replace(/^The /, 'the ');
/** A rock or seam by what it yields, as a prospector names it. */
const rockName = (yields: string): string => (ROCK_VARIANTS.find((r) => r.yields === yields)?.name ?? yields).replace(/ (vein|seam)$/, '').toLowerCase();
/** The fruit trees each island of the chart holds to itself. */
const ISLAND_FRUIT = REGIONS.map((R) => ({ R, trees: R.trees.filter((s) => TREE_DEFS[s]?.fruit).map((s) => TREE_DEFS[s].name.toLowerCase()) }))
  .filter((r) => r.trees.length);
/** Which of them flower in which colour, the colour first: "deep pink on cherry, peach and pomegranate". */
const FLOWER_KINDS: Array<[string, string[]]> = (['deep pink', 'pale pink', 'white'] as const).map((family) => [
  family, FRUIT_TREES.filter((t) => BLOOMS[t.fruit ?? '']?.family === family).map((t) => t.name.toLowerCase()),
]);
/** How long a helping's knack holds, from the least filling at its worst to the most at its best. */
const DISH_TIMES = BOON_FOODS.flatMap((id) => [boonTime(id, 1), boonTime(id, TOP_QL)]);
const DISH_SHORTEST = Math.min(...DISH_TIMES);
const DISH_LONGEST = Math.max(...DISH_TIMES);
/** What a mould asks of the smelter and gives back. */
const mouldNote = (id: string): string => {
  const m = MOULDS.find((x) => x.id === id);
  if (!m) throw new Error(`The help names a mould there is not: ${id}`);
  const lumps = `${m.lumps} lump${m.lumps === 1 ? '' : 's'} of metal`;
  return `poured at the smelter and beaten out on an anvil, ${lumps} ${m.per ? `to ${m.per}` : 'to each'}`;
};
/** What a full wagon takes over this ground to cover what it covers in a minute on slabs. */
const wagonMinute = (t: TileType): number => {
  const pace = (g: (typeof TILE_DEFS)[TileType]): number => g.speed * groundRoll(g.roll, 1);
  return (60 * pace(ground(TileType.Slabs))) / pace(ground(t));
};
/** A sailing boat to show the wind on, and what she makes at each point of sail in it. */
const SAIL_EXAMPLE = { ql: 50, force: 0.6 };
const sailSpeeds = listed(
  [Math.PI / 2, Math.PI, NO_GO, 0].map((upwind) =>
    (SAILER.boat ? hullSpeed(SAILER.boat, SAIL_EXAMPLE.ql, CHAR_START, windWorth(SAIL_EXAMPLE.force) * pointAt(upwind), 0) : 0).toFixed(1)),
);

/** The depths of a line past the first, for the help's figures. */
const LINE_DEPTHS = Array.from({ length: PEDIGREE_MOST - 1 }, (_, i) => i + 2);
/** A line as the card says it (`lineSaid`), one short of the deepest, on what a creature's attack lands for. */
const LINE_EXAMPLE = lineSaid(TRAITS.filter((t) => t.effects.tough !== undefined).slice(0, 1).map((t) => t.id), { tough: PEDIGREE_MOST - 1 })[0] ?? '';

/** Where a bred one's trait can have come from, in the words its card uses: "<b>from the dam</b> (drawn from …), …". */
const pedigreeSources = (): string => {
  const parts = Object.values(TRAIT_SOURCES).map((s) => `<b>${s.label}</b> (${s.means})`);
  return `${parts.slice(0, -1).join(', ')} or ${parts[parts.length - 1]}`;
};


/** The settlement's hands, in the order the help names them, and what each one's numbers come to at no skill and at a hundred. */
/** The dressing quality the help works a salva's number at. */
const SHOWN_QL = 50;
const HANDS = ['kemma', 'sheela', 'salva', 'carra', 'tanna', 'grista', 'wicka', 'brambo', 'grazza', 'siffa',
  'forga', 'potta', 'cindra', 'hoppa', 'simma', 'relka', 'bedda', 'wurla', 'sprigga', 'ambra', 'petta', 'scurra',
  'rippa', 'chissa', 'mudda', 'cordra', 'flecha', 'papra', 'glossa', 'dippa'];
/** A kind's two evolutions and the levels they come at: "Reedweaver at 30, Reedlord at 60". */
const evolves = (id: string): string => {
  const st = SPECIES[id]?.stages;
  return st ? `${st[0].name} at ${EVOLVE_AT[0]}, ${st[1].name} at ${EVOLVE_AT[1]}` : 'none';
};
/** The wildermon that fight in a way of their own (`FightStyle`), in the order the help gives them. */
const FIGHTERS = ['testa', 'skulka', 'gasha', 'thumpa', 'spitta', 'awla', 'sparra'];
/** The wildermon with an ability of their own (`AbilityId`), in the order the help gives them. */
const ABLE = ['lungra', 'hamma', 'crakka', 'bashka', 'executa', 'whirla', 'scorcha', 'frosta', 'rootle', 'dulla', 'brittla', 'shova',
  'howla', 'marka', 'wardo', 'stona', 'leecha', 'whispet'];
const HAND_NUMBERS: Record<string, string> = {
  kemma: `a brushing puts in ${percent(groomGain(1, 1))} care (${CARE_SAID}) at no husbandry and ${percent(groomGain(SKILL_TOP, SKILL_TOP))} at ${SKILL_TOP}, as a keeper of its skill with a brush as good`,
  sheela: `a full fleece gives ${SHEAR_WOOL} wool and a full crop of feathers ${SHEAR_FEATHERS}, and a cudda a bucket of milk`,
  salva: `a QL ${SHOWN_QL} dressing puts back ${percent(healAmount(1, SHOWN_QL))} of a life at no first aid and ${percent(healAmount(SKILL_TOP, SHOWN_QL))} at ${SKILL_TOP}`,
  carra: `it keeps ${percent(butcherYield(1, 1))} of a carcass at no butchering and ${percent(butcherYield(SKILL_TOP, SKILL_TOP))} at ${SKILL_TOP}`,
  siffa: `something is in the pan ${percent(panFind(0))} of the time at no prospecting and ${percent(panFind(SKILL_TOP))} at ${SKILL_TOP}`,
  hoppa: `it tries ${listed(BREWS.map((b) => b.name.toLowerCase()))} in that order`,
  simma: `it tries ${cookRecipes().length} recipes in the order the recipes are listed, from ${itemDef(RECIPE_BY_ID.get(cookRecipes()[0])!.result).name.toLowerCase()} on`,
  relka: `a relic comes out at what its pieces were worth less their damage, times ${percent(restoredMul(1))} at no restoration and ${percent(restoredMul(SKILL_TOP))} at ${SKILL_TOP}`,
  ambra: `${RESIN_TAPPED} tar a pine a day`,
  petta: `it leaves every tile within ${SKEP_REACH} of a skep to the skep`,
};

/**
 * What the relics that restore into things of their own do on a wildermon of yours, every number read off the
 * rule (`ARTIFACT_FOR`, `combedBorn`, `FILE_RARITY_ODDS`, `LAMP_TIER_ODDS`, `POT_STEP`, `POT_MOST`).
 */
function artifactHelp(): string {
  const from = (action: string): string => {
    const id = ARTIFACT_FOR[action];
    const relic = RELICS.find((r) => r.result === id)?.name ?? '';
    return `<b>${itemDef(id).name}</b> (restored from ${article(relic)} ${relic})`;
  };
  const top = TIERS[TIERS.length - 1];
  return `<p>${Object.keys(ARTIFACT_FOR).length} relics restore into items used on a wildermon of yours, out of its crate and beside you,
    from its menu. Used up whatever the result; refused and kept when it would do nothing.</p>
    <ul>
      <li>${from('use_ancient_comb')}: one age back. Old to grown (full pace (speed multiplier) and pull again, from ${percent(AGES.old.speed)} pace and ${percent(AGES.old.pull)} pull).
      Grown to young: cannot be worked, ridden or harnessed until grown again. Not on a young one.</li>
      <li>${from('use_ancient_file')}: 1 in ${FILE_RARITY_ODDS}: one rarity step up (${listed(RARITIES.map((r) => r.name || 'ordinary'))}).
      Every blood figure over an ordinary one's: ${listed(RARITIES.slice(1).map((r) => cardPct(r.blood)))} at ${listed(RARITIES.slice(1).map((r) => r.name))}.
      Not on ${article(RARITIES[RARITIES.length - 1].name)} ${RARITIES[RARITIES.length - 1].name} one.</li>
      <li>${from('use_ancient_lamp')}: replaces its lowest-rarity trait (random among ties of its ${TRAIT_SLOTS}) with a random trait it does not carry
      (the outgoing one included), same rarity; 1 in ${LAMP_TIER_ODDS}: the rarity above (${listed(TIERS.slice(1).map((t, i) => `${TIERS[i]} to ${t}`))}).
      Never lower; at ${top}: another ${top} trait. Fewer than ${TRAIT_SLOTS} traits: fills the empty slot with ${article(TIERS[0])} ${TIERS[0]} trait,
      1 in ${LAMP_TIER_ODDS} ${article(TIERS[1])} ${TIERS[1]} one. Fighting blood: ${percent(FIGHT_SHARE)} chance, as in the wild.</li>
      <li>${from('use_ancient_pot')}: +1 point in a random one of its ${BASE_STATS.length} base stats under ${POT_MOST}:
      ${listed(BASE_STATS.map((st) => `${st.name.toLowerCase()} (${st.says})`))}. Each point: +${percent(POT_STEP)} of that stat over kind and blood;
      max ${POT_MOST} points (+${percent(POT_STEP * POT_MOST)}). Not on one with every stat at ${POT_MOST}.</li>
    </ul>
    <p>Old pots and files restored before these existed stay a plain clay pot or file; an old lamp restored before is an ancient lamp.</p>`;
}

export function helpText(): string {
  const CRATE_BILL = crateBill();
  const PEDIGREE_SOURCES = pedigreeSources();
  return `
    <h3>Getting around</h3>
    <p>Movement is by clicking only. Keys move the <i>view</i>. Walking paths round obstacles.</p>
    <table>
      <tr><td><kbd>Left click</kbd></td><td>Walk to a tile (the only way to move)</td></tr>
      <tr><td><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></td><td>Pan the view (detaches the camera)</td></tr>
      <tr><td><kbd>Drag</kbd></td><td>Pan the view</td></tr>
      <tr><td><kbd>Scroll</kbd> / <kbd>+</kbd> <kbd>-</kbd></td><td>Zoom</td></tr>
      <tr><td><kbd>C</kbd></td><td>Centre the camera on yourself and follow again</td></tr>
      <tr><td><kbd>Q</kbd> <kbd>E</kbd></td><td>Turn the view ${frac(1 / TURNS)} of a turn; the compass shows north</td></tr>
    </table>
    <ul>
      <li>Rebind: <b>Settings</b> (<kbd>O</kbd>), <b>Keys</b> tab. Click a key, press the new one. A key already in use is taken off its old action.</li>
      <li>Fixed: number keys <kbd>1</kbd>–<kbd>0</kbd> always pick from the Tile window or the toolbelt.</li>
    </ul>
    <h3>Touch screens</h3>
    <table>
      <tr><td>Tap</td><td>Walk to a tile</td></tr>
      <tr><td>Drag</td><td>Look around</td></tr>
      <tr><td>Pinch</td><td>Zoom</td></tr>
      <tr><td>Long press</td><td>Actions for a tile or tree</td></tr>
    </table>
    <h3>Doing things</h3>
    <table>
      <tr><td><kbd>Right click</kbd></td><td>Actions for a tile or tree</td></tr>
      <tr><td><kbd>Click</kbd> an item</td><td>Its actions: eat, drink, drop, examine…</td></tr>
      <tr><td><kbd>Esc</kbd></td><td>Stop the current action and clear the queue</td></tr>
      <tr><td><kbd>Enter</kbd></td><td>Talk in the event window</td></tr>
    </table>
    <h3>The event log, and finding things in it</h3>
    <table>
      <tr><td>All</td><td>Everything</td></tr>
      <tr><td>Work</td><td>Your actions</td></tr>
      <tr><td>Combat</td><td>Blows given and taken, what has your scent, kills</td></tr>
      <tr><td>Skills</td><td>Skill gains</td></tr>
      <tr><td>Talk</td><td>Chat</td></tr>
      <tr><td>Trouble</td><td>Failures and refusals, with the reason</td></tr>
    </table>
    <ul>
      <li>A tab shows its unread count; opening it clears the count.</li>
      <li>Search box: searches the open tab; <kbd>Esc</kbd> clears it.</li>
    </ul>
    <h3>Marks on the map, and the way home</h3>
    <ul>
      <li>Add a mark: right-click the map (<kbd>M</kbd>) or <b>Mark here</b>; the tile menu offers the same with a colour chosen first.</li>
      <li>Marks: pins with names on the map; listed under it, nearest first. <b>Go</b> walks to one.</li>
      <li>In the list: click the dot to cycle colour, the name to rename, × to delete.</li>
      <li>Max ${MARK_CAP} marks; past that the oldest is removed.</li>
      <li><kbd>Home</kbd> or <b>Walk home</b>: walks to your settlement totem; with none, to your landing shore or the last bed you woke in.</li>
    </ul>
    <h3>The camera</h3>
    <ul>
      <li>Follows you by default. Dragging away detaches it; <kbd>C</kbd> or <b>Centre</b> reattaches.</li>
      <li>Cursor at a screen edge: pans that way, faster nearer the edge; detaches the camera. Not while over a window or the toolbar.</li>
      <li>Edge panning and drag panning can be turned off in Settings (<kbd>O</kbd>).</li>
    </ul>
    <h3>Your wildermon, in order</h3>
    <ul>
      <li>Wildermon window (<kbd>P</kbd>): sort by name, level, kind, health, hunger, care (${CARE_SAID}), age or best trait.</li>
      <li>Search matches name, kind, task, age, orders setting or any trait ("supreme", "hungry").</li>
      <li>Grouped: by location. Flat: one list.</li>
      <li>Card tags: <b>hurt</b> under ${percent(HURT_AT)} of max health; <b>hungry</b> under ${percent(HUNGRY_AT)} fed. Tagged cards are outlined.</li>
      <li>Footer: herd count, hungry count, hurt count. Clicking a count lays the herd out flat, worst first, unfiltered.</li>
    </ul>
    <h3>Other people</h3>
    <h4>Right-click a person</h4>
    <ul>
      <li><b>Invite to a settlement</b> (you founded it, or your rank there holds ${POWER.invite.label}); <b>Ask to be a friend</b>; <b>Write</b>.</li>
      <li>Also in the <b>Social</b> window (<kbd>Y</kbd>): <b>Waiting</b> (needs your yes or no), <b>Friends</b> (everybody you know and where), <b>Letters</b>.</li>
    </ul>
    <h4>Citizenship</h4>
    <ul>
      <li>Accepting an invitation: you join on the settlement's <b>rank for newcomers</b> (${NEWCOMER_RANK} until the founder picks another); permissions are that rank's
      (<b>Who may do what on a settlement</b>, below). Disbanding and setting wildermon to work: founder only, never a rank.</li>
      <li>Limits: found <b>one</b> settlement; be a citizen of <b>${DEEDS_JOINED}</b> others.</li>
      <li>Borders you may work inside are drawn at the same weight as your own.</li>
      <li>Leaving frees the place at once. An invitation you had no room for stays open.</li>
      <li>Who may invite: the founder and ranks with <b>${POWER.invite.label}</b>; anyone may be invited, citizens of other settlements included.</li>
      <li>Friends tab: <b>Invite</b> beside everybody not on the member list (friends, fellow citizens, everybody ashore). Shows <b>Citizen of ${DEEDS_JOINED}</b> (disabled)
      for somebody already a citizen of ${DEEDS_JOINED} others' settlements; <b>Asked</b> while unanswered.</li>
      <li>Citizen of ${DEEDS_JOINED} yourself: <b>Move in</b> is disabled until you leave one.</li>
      <li>Can invite to several settlements: pick which at the top of the Friends tab; the right-click menu has an Invite for each.</li>
      <li><b>Ask to join</b>: right-click another player's settlement totem, standing on its land. Answered under <b>Waiting</b> by its founder and any rank with
      <b>${POWER.invite.label}</b>: <b>Let in</b> (rank for newcomers) or <b>No</b>. Your own requests: same tab, <b>Withdraw</b>.</li>
    </ul>
    <h4>Ranks and removal</h4>
    <ul>
      <li>Set rank: Settlement window, <b>Citizens</b>. Founder: any rank to anybody else.
      <b>${POWER.set_ranks.label}</b>: to somebody ranked below you, a rank below your own. Nobody changes the founder's rank or their own.
      The ranked citizen is told the new rank's permissions.</li>
      <li><b>Send away</b> (Social window, beside a name): removes from the member list. Founder: anybody. <b>${POWER.send_away.label}</b>: anybody ranked below you.</li>
      <li><b>Leave</b>: right-click its land, <b>Leave</b> under its name; or the button in the Settlement or People window. Off the member list at once; you are then a
      stranger: may walk it, may shape nothing; only stores you made still open. The founder is told. Only a new invitation lets you back.</li>
    </ul>
    <h4>Friends and letters</h4>
    <ul>
      <li>Friendship is mutual (ask, they accept). Friends see each other's location while at the keyboard; otherwise "away".</li>
      <li>Letters are kept: delivered to an open tab at once, otherwise waiting until read.</li>
    </ul>
    <h4>While you were away</h4>
    <ul>
      <li>Counted as away after ${awayAfter()} with no word from your browser.</li>
      <li>Counted while away: loads your workers put in the settlement stores (by item); young born to your wildermon, and any that went wild with no empty wildermon crate
      because something already followed you; stall sales and silver; everything brought to your buy orders and the silver it cost; parcels posted to you, by sender.</li>
      <li>On return: a window lists it all; the same lines go into the event log.</li>
    </ul>
    <h3>Leaderboards</h3>
    <ul>
      <li>Journal, <b>Leaderboards</b> tab (<kbd>F2</kbd>): everybody on an island; refreshes every ${BOARD_REFRESH} seconds while shown.</li>
      <li><b>Skills:</b> ${BOARD_RULES.skills}</li>
      <li><b>Wildermon:</b> ${BOARD_RULES.wildermon}</li>
      <li><b>Settlements:</b> ${BOARD_RULES.settlements}</li>
    </ul>

    <h3>The settlement window</h3>
    <ul>
      <li><kbd>N</kbd>: level, border radius, wildermon working of how many allowed, what the next upgrade wants and its button, everything inside the border,
      standing orders for everything kept there. Each entry has a button that walks you to it.</li>
      <li>Island tabs: <b>Settlement</b> (all the above, plus citizens and ranks), <b>Notices</b>, <b>Work</b>. Notices and Work: founder and citizens only;
      anybody else is told they are not a citizen.</li>
    </ul>
    <h4>Notices</h4>
    <ul>
      <li>Newest first, with poster and time.</li>
      <li>Post: founder and ranks with <b>${POWER.notices.label}</b>; max ${NOTICE_MAX} characters (runs of spaces and line breaks count as one space).
      Same people may <b>Take down</b> any notice.</li>
      <li>Kept: newest ${NOTICE_KEEP}; posting another drops the oldest.</li>
      <li>Delivery, once per citizen: ashore, in the event log at once; not ashore for more than ${NOTICE_MAIL_DAYS} day${NOTICE_MAIL_DAYS === 1 ? '' : 's'},
      as a <b>letter</b> from the poster (checked when posted and every hour after); otherwise in a window and the log on next landing.</li>
    </ul>
    <h4>Work</h4>
    <ul>
      <li>Set: founder and ranks with <b>${POWER.work.label}</b>. A thing (anything a settlement crate takes: everything but coins and crates), a count from one to
      ${WORK_COUNT_MAX}, optional minimum quality (QL) (whole number up to ${WORK_QL_TOP}). Max ${WORK_OPEN_MAX} open at once. Same people may <b>Take down</b> any.</li>
      <li>Deliver: any citizen, within ${DELIVER_REACH} tiles of the settlement totem: <b>Deliver</b> on a work, or <b>Deliver work</b> in the settlement's menu
      (opens this tab).</li>
      <li>Moves every matching item from your pack (that thing, at the work's QL or better; not worn, held, kept back, in a bag or holding anything) into
      the founder's <b>settlement crate</b>, lowest QL first, until the work is filled or the crate is full. The founder empties the settlement crate like any crate.</li>
      <li>Done when filled: it closes; the deliverer, the founder and the setter are told. Taken down: what was delivered stays in the crate.</li>
      <li><b>Ledger</b> (under the list): every work set, delivery (who, how many of what, average QL, work number), work done and work taken down.
      Keeps its newest ${LEDGER_KEEP} lines; the list keeps the newest ${WORK_DONE_KEEP} finished or taken-down works.</li>
    </ul>
    <h4>Border banner</h4>
    <ul>
      <li>${BANNER_DEPTH} tile${BANNER_DEPTH === 1 ? '' : 's'} inside any border: its name for ${BANNER_MS / 1000} seconds, with <b>your rank</b>
      (citizen) or <b>its founder</b> (not a citizen).</li>
      <li>${BANNER_DEPTH} tile${BANNER_DEPTH === 1 ? '' : 's'} back out: <i>Leaving</i> and the name for ${LEAVING_MS / 1000} seconds.</li>
      <li>Re-entering within ${BANNER_AGAIN} seconds of leaving: nothing shown. Off switch: Settings, Interface.</li>
    </ul>
    <h3>What a tool is worth</h3>
    <ul>
      <li>A tool's working value is its quality (QL) changed by damage (down), its head metal (up or down), rarity and blessing (up).</li>
      <li>That value, not the made QL, sets action speed, success chance and result QL.</li>
      <li>Pack shows both when they differ: QL <b>&rarr;</b> value. Examine says it in words.</li>
    </ul>
    <h3>The number keys</h3>
    <ul>
      <li>Something <b>selected</b> in the Tile window (<kbd>T</kbd>) (tile, tree, wildermon, crate): <kbd>1</kbd>–<kbd>9</kbd>, <kbd>0</kbd> do the
      <b>first ${NUMBER_KEYS.length} available actions</b>, in list order; each row shows its key. Submenu rows and greyed-out rows take no key.</li>
      <li><b>Nothing selected</b>, or the window shut: the keys use the belt loops; the belt bar dims while the window has them.</li>
    </ul>
    <h3>What a wildermon's tooltip tells you</h3>
    <ul>
      <li><b>Wild</b>: kind, age, accepted foods, taming needed against your taming, <b>the exact chance of one offering</b> (the attempt's own check:
      hunger, soul, age, path and a run of offerings counted).</li>
      <li><b>Yours</b>: name, sex, kind, age, level; health and fullness bars; brushing; current task and skill at it, worker reach in tiles; traits
      (marked when better than common; <i>something unread</i> until your animal husbandry can read them); time left on a carried young.</li>
      <li><b>Monster</b>: health, hit damage, "cannot be tamed".</li>
    </ul>
    <h3>The belt, and doing a thing many times</h3>
    <h4>Repeats</h4>
    <ul>
      <li>Repeatable actions (digging, mining, chopping, bricks…): <b>once</b>, ${COUNTS.map(String).join(', ')}, or <b>until you stop</b>.
      Counts down, then stops; the action bar shows progress.</li>
      <li>Mouse: a ring round the pointer fills with progress while over the island; in a fight, once per swing or draw. Off switch: Settings, Interface.</li>
    </ul>
    <h4>Toolbelt</h4>
    <ul>
      <li>${bill('make_toolbelt')}, on an awl. Worn.</li>
      <li><b>One loop per ${QL_PER_LOOP} quality (QL)</b>, max ${BELT_MAX}. Loops map to number keys <kbd>1</kbd>–<kbd>9</kbd>, <kbd>0</kbd> for the tenth.</li>
      <li>Hang an action from any menu: <i>Hang on belt</i>. From the pack: remembers the <b>kind</b> of item, not the one held.
      From the ground: done <b>where you point</b>, or on your own tile when pointing at nothing.</li>
      <li>Right-click a loop to clear it. Taking the belt off keeps its actions.</li>
    </ul>
    <h4>Queue</h4>
    <ul>
      <li>A second action asked for while one runs <b>queues</b> behind it, walking you there if needed. The bar above the action shows the queue.</li>
      <li>Size: <b>${BASE_QUEUE}</b>, one more per ${QUEUE_PER_MIND} <b>mind logic</b>.</li>
      <li>Walking off pauses the queue (resume: below). <kbd>Esc</kbd> clears it.</li>
      <li>Crafting window foot: every queued action, current first, with its count, time at your current pace (speed multiplier) and, for a craft, what it will use and from where
      (pack, bags or a named store) after the actions ahead.</li>
      <li>Reorder: drag by the grip, or <b>&uarr;</b> / <b>&darr;</b>. <b>&times;</b> removes. The current action never moves.</li>
    </ul>
    <h3>What the characteristics are for</h3>
    <ul>
      <li>Raised by work only. Eating, drinking and moving items in and out of crates, bags and barrels cost wind and teach nothing.</li>
      <li>Start at ${CHAR_START}. Each is raised only by the things listed. One action there = one action in a skill, before the curve and multipliers.</li>
      <li>Every raise: the same one in ${KNACK_ODDS} knack chance as an action in a skill; the knack lands on that characteristic.</li>
    </ul>
    <table>
      <tr><td><b>Body strength</b></td><td>Hit damage. Raised by ${raisedBySays('body_strength')}.</td></tr>
      <tr><td><b>Body stamina</b></td><td>Stamina bar ×${staminaBarAbove(0)} at ${CHAR_START}, ×${staminaBarAbove(TOP_ABOVE)} at ${SKILL_TOP}. Stamina cost of actions and swings ×${two(staminaCostAbove(0))} to ×${two(staminaCostAbove(TOP_ABOVE))}. Stamina recovery ×${two(windRegenAbove(0))} to ×${two(windRegenAbove(TOP_ABOVE))}. Spending and recovery per second: shares of the bar. Raised by ${raisedBySays('body_stamina')}.</td></tr>
      <tr><td><b>Body control</b></td><td>Time per action and swing ×${two(controlPaceAbove(0))} at ${CHAR_START}, ×${two(controlPaceAbove(TOP_ABOVE))} at ${SKILL_TOP}. Dodge chance +${percent(DODGE_PER_CONTROL)} per level over ${DODGE_FROM}, −${percent(DODGE_PER_KG)} per kg of armour worn, max ${percent(DODGE_MOST)} (${percent(dodgeChance(SKILL_TOP, 0))} at ${SKILL_TOP} unarmoured). Hit chance + level ÷ ${CONTROL_HIT} (+${percent(SKILL_TOP / CONTROL_HIT)} at ${SKILL_TOP}). Sailing boat speed ×${two(boatHands(true, CHAR_START))} to ×${two(boatHands(true, SKILL_TOP))}. Raised by ${raisedBySays('body_control')}.</td></tr>
      <tr><td><b>Mind logic</b></td><td>Action queue ${BASE_QUEUE}, one more per ${QUEUE_PER_MIND} levels over ${CHAR_START} (${queueCapAt(SKILL_TOP)} at ${SKILL_TOP}). Difficulty −${MIND_EASE_PER_LEVEL} per level over ${CHAR_START}, max half (−${mindEaseAt(SKILL_TOP)} at ${SKILL_TOP}): crafts, ${listed(MIND_EASED_SKILLS.map((id) => SKILL_NAME(id).toLowerCase()))}. Raised by ${raisedBySays('mind_logic')}.</td></tr>
      <tr><td><b>Soul strength</b></td><td>Taming chance. Raised by ${raisedBySays('soul_strength')}.</td></tr>
    </table>
    <ul>
      <li><b>Climbing</b>: step between tiles from ${metres(MAX_STEP)} m and standable slope from ${metres(MAX_STAND)} m, both +${metresFine(CLIMB_PER_LEVEL)} m a level.
      Learned on foot, per step between tiles over ${frac(CLIMB_LEARN_FROM)} of ${metres(MAX_STEP)} m up or down, more for steeper. Not in a saddle, on a cart or boat,
      on a bridge, on an upper floor, or on or off garden steps.</li>
      <li><b>Swimming</b>: deep-water speed and wind cost. Learned while out of your depth.</li>
      <li>Both log only whole points. Current value: Skills window (<kbd>K</kbd>).</li>
      <li>Skills window: click a skill for a slider per effect. Left end: the skill's starting value. Right end: ${SKILL_TOP}. Marker: your level.</li>
    </ul>
    <h3>What you can see</h3>
    <table>
      <tr><td><b>Unknown</b></td><td>Never seen. <b>Black</b>: nothing drawn; cannot be clicked or acted on.</td></tr>
      <tr><td><b>In sight</b></td><td>Seen now by somebody. Full colour, everything on it.</td></tr>
      <tr><td><b>Remembered</b></td><td>Seen before. <b>Grey</b>, no detail, <b>as last seen</b> (felled trees stay drawn until seen again).</td></tr>
    </table>
    <ul>
      <li>Your sight circle turns unknown ground into remembered ground; the map is everywhere you have seen.</li>
    </ul>
    <h4>Awareness, and how far that circle reaches</h4>
    <ul>
      <li><b>Awareness</b>: a characteristic. <b>Starts at ${AWARE_START}</b>.</li>
      <li>Sight range: ${BASE_SIGHT} tiles on the flat at ${SKILL_TOP}. At ${AWARE_START}: ${percent(awarenessReach(AWARE_START))}
      (${Math.round(BASE_SIGHT * awarenessReach(AWARE_START))} tiles against ${BASE_SIGHT}). Scales with the square root of the level.</li>
      <li>Per level over ${CHAR_START}: monster notice range −${AWARE_RATE} (−${AWARE_TOP} at ${SKILL_TOP}); tracking range +${AWARE_RATE} (+${AWARE_TOP} at ${SKILL_TOP});
      hit chance +${AWARE_RATE} × darkness, over ${percent(NIGHT_EYES_FROM)} dark or underground (+${AWARE_TOP} at ${SKILL_TOP} in full dark).
      Animal husbandry to read a trait: one level less per ${AWARE_TRAIT_STEP} levels over ${CHAR_START} (−${awareTraitEase(SKILL_TOP)} at ${SKILL_TOP}).</li>
      <li>Raised by ${raisedBySays('awareness')}.</li>
      <li>Height adds distance; ridges hide what is behind; a wood blocks sight ${Math.ceil(1 / TREE_OPACITY)} trees deep;
      <b>darkness takes ${frac(NIGHT_LOSS)} of sight</b>.</li>
      <li>Your settlement is in sight while you hold it; your wildermon see from wherever they work.</li>
      <li>Walls: only <b>solid</b> ones block sight. Window, bay, door, double door, arch, gate: seen through. Fence, half wall: seen over.</li>
      <li>Fog of war: Settings, <b>Fog of war</b>, to show the whole island.</li>
    </ul>
    <h4>Wildlife</h4>
    <ul>
      <li>Creatures far from everybody are stored as their region's count and respawn when somebody comes; never in anybody's sight.
      The island's total wildlife stays the same.</li>
      <li><b>Turnover</b>: a wild wildermon stays until between ${dur(WILD_STAY)} and ${dur(2 * WILD_STAY)} old (set by its own number), then goes at
      its region's next restock; the region is refilled from every kind at current weights.</li>
      <li>Never goes while tamed or kept, fighting or fought, struck in the last ${dur(BLOW_MEMORY)}, trapped, harnessed, ridden, tied to a post, stunned,
      marked, offered food in the last ${dur(COAX_LAPSE)}, or being acted on. Monsters do not turn over.</li>
    </ul>
    <h3>Windows</h3>
    <table>
      <tr><td><kbd>I</kbd></td><td>Inventory</td></tr>
      <tr><td><kbd>R</kbd></td><td>Crafting: everything you can make with what you carry</td></tr>
      <tr><td><kbd>T</kbd></td><td>Tile: every action on the tile you last clicked</td></tr>
      <tr><td><kbd>Page Up</kbd> / <kbd>Page Down</kbd></td><td>View the storey above or below</td></tr>
      <tr><td><kbd>X</kbd></td><td>Cut away the walls facing you</td></tr>
      <tr><td><kbd>K</kbd></td><td>Skills</td></tr>
      <tr><td><kbd>F</kbd></td><td>Trades: every trade's and class's offer, yours, its perks or class tiers, its rite</td></tr>
      <tr><td><kbd>L</kbd></td><td>Event log</td></tr>
      <tr><td><kbd>M</kbd></td><td>Map</td></tr>
      <tr><td><kbd>G</kbd></td><td>Toggle the tile grid</td></tr>
      <tr><td><kbd>P</kbd></td><td>Wildermon: your wildermon's stats and actions</td></tr>
      <tr><td><kbd>J</kbd></td><td>Journal: goals, the ledger of what you have made, this help</td></tr>
      <tr><td><kbd>N</kbd></td><td>Settlement: your settlement at a glance</td></tr>
      <tr><td><kbd>Y</kbd></td><td>Social: waiting requests, friends, letters</td></tr>
      <tr><td><kbd>O</kbd></td><td>Settings: display, keys, your look</td></tr>
      <tr><td><kbd>F1</kbd> / <kbd>H</kbd></td><td>This help, the journal's Help tab</td></tr>
      <tr><td>⤢ / double-click title</td><td>Expand a window to nearly full screen, and back</td></tr>
    </table>
    <h4>Status marks</h4>
    <ul>
      <li>Foot of the status panel. Left, round: in your favour (rest, a meal boost, a tincture boost, favour, Calm (meditation resource), a spell or technique, a light,
      a worn enchantment, settlement baubles). Right, square red: against you (wounds, bleeding, venom, burn, hunger, thirst, overload, winded,
      tired arms, darkness).</li>
      <li>Under each: time left or count. Point or tap: exact effect and source.</li>
      <li>Tired arms: under ${percent(TIRED_AT)} stamina; swing up to ${percent(TIRED_SLOW)} longer.</li>
      <li>Health does not mend while food or water is at or under ${percent(HEAL_FED)}.</li>
    </ul>
    <h3>Trades</h3>
    <ul>
      <li>Craft trade: opens at <b>${CLASS_AT}</b> in any skill it covers. <b>Fighting class</b>: no requirement.</li>
      <li>Hold <b>one craft trade and one fighting class</b>. Taken up and spent in the <b>Trades</b> window (<kbd>F</kbd>).</li>
    </ul>
    ${COLUMNS ? `<h4>Tree trades</h4>
    <ul>
      <li>Earn <b>points</b> off the best skill covered. Tree: <b>${COLUMNS} columns of ${RANKS}</b>.</li>
      <li>A column is one <b>channel</b> (one rule number); each card names it and the change: ${(['hands', 'aim', 'knit'] as Channel[]).map((ch, i) => `<i>${nodeSays(ch, [1, 1, RANKS][i])}</i>`).join(', ')}.</li>
      <li>Lower nodes: ${pointsFor(1)} each; top node: ${costOf(RANKS)}. Lower first.</li>
      <li>Better lower (shown as a minus): ${listed(Object.values(CHANNELS).filter((c) => c.lower).map((c) => c.note.toLowerCase()))}.</li>
    </ul>` : ''}
    ${FIRST_PERK ? `<h4>Perk trades</h4>
    <ul>
      <li>${listed(PERK_TRADES.map((c) => `the ${c.name}`))}. No tree, no points.</li>
      <li><b>${PERK_TIER_AT.length} perk tiers of ${PERKS_PER_TIER}</b>. First opens with the trade; others at ${listed(PERK_TIER_AT.slice(1).map(String))} in its
      main skill. Take <b>one</b> of the ${PERKS_PER_TIER} per perk tier.</li>
      <li>Each card states the change, e.g. ${FIRST_PERK.name}: <i>${FIRST_PERK.note}</i></li>
      <li>Perks are kept while the trade is held.</li>
    </ul>` : ''}
    ${FIRST_SPELL ? `<h4>Fighting classes</h4>
    <ul>
      <li>${listed(SPELL_TRADES.map((c) => `the ${c.name}`))}. ${CLASS_TIER_AT.length} class tiers, opened by <b>class level</b>.</li>
      <li>Class level: ${CLASS_LEVEL_START} on taking the class (first class tier open); others at ${listed(CLASS_TIER_AT.slice(1).map(String))}.
      Rises on the skill curve with every blow or shot that lands on a creature while held; a killing blow ${1 + CLASS_LEARN_KILL / CLASS_LEARN_BLOW} times as much.</li>
      <li>Each class tier: <b>${PERKS_PER_TIER - 1} spells and a passive</b>; take one. Passive: always on.</li>
      <li>Spell: on the spell bar; costs <b>stamina</b> (% of a full bar); own cooldown in seconds.
      ${FIRST_SPELL.name}: <i>${spellTerms(FIRST_SPELL)} ${FIRST_SPELL.note}</i></li>
      <li>Putting the class down removes its level, spells and their bar places.</li>
    </ul>` : ''}
    <h4>Rites</h4>
    <ul>
      <li>Fighting classes only. Pushes ${listed(riteWidths.map(String)).replace(' and ', ' or ')} channels much harder for a fixed number of seconds;
      paid from <b>favour</b> (as prayer); then a cooldown. The card gives every figure.</li>
      <li>Some swap one channel for another: ${riteDef('redhour')?.name} is <i>${riteSays('redhour')}</i>.</li>
      <li>Shown at the head of its class's ${COLUMNS ? 'tree or class tiers' : 'class tiers'}, with the reason when it cannot be called.</li>
    </ul>
    <h4>Taking up and changing</h4>
    <ul>
      <li><b>What it offers</b> on every card: its ${PERK_TIER_AT.length} perk or class tiers with their opening skill or class level, and a fighting class's
      rite${COLUMNS ? `, or its ${COLUMNS} columns with each node's cost and effect` : ''}. Read from the rulebook.</li>
      <li><b>Take up</b> and <b>Take this one</b> confirm first, listing what goes, the cost and which perks close.</li>
      <li>Spent points, purse and altar state are the island's answer; a disabled button's reason is the island's own.</li>
      <li>Changing a trade or class: <b>${CLASS_CHANGE_COST} silver</b>; ${BOUGHT} for the old one are lost. The other slot is unchanged.</li>
      <li><b>Bauble of Regret</b>: ${percent(REGRET_SHARE)} of trowel finds, whole. In the pack, a held trade's or class's card shows <i>Undo</i>: breaks the bauble,
      removes it and ${BOUGHT} for it, leaves the slot empty; the next trade or class in that slot is free. The other slot is unchanged.</li>
    </ul>
    <h4>Window layout</h4>
    <ul>
      <li>Move: drag a window's title bar, or the status panel or toolbar anywhere. Resize: a window's bottom-right corner.</li>
      <li>While moving: ${CELL}-pixel grid; snaps to whole cells. Windows, status panel and toolbar never overlap (edges may touch).</li>
      <li>Kept clear: a square ${CLEAR_CELLS} cells across round your character (fewer on a small screen). Dropped on another piece or that square: moved to
      the nearest free space of its size; resizing stops at them.</li>
      <li>Status panel and toolbar: no resize, no close. Layout is saved. No grid on a phone.</li>
      <li><b>Update to v…</b> (gold, bottom right): a later version is on the site. Checked every ${UPDATE_CHECK_MS / 60_000} min and on returning to the tab. Click: reload to it.</li>
      <li>Runecut: shared edges get one seam capped in gold. ${softFrames()} to the same: stitched every ${STITCH_EVERY} pixels; anything else: mortar joint every
      ${JOINT_EVERY}; a brass pin every ${PIN_EVERY}.</li>
      <li><i>Frame life</i> (Settings (<kbd>O</kbd>), Display): animals and lights on Runecut frames: ${lifeWords()}. Never over window contents.
      Off on a phone, with Fast graphics, or with reduced motion.</li>
      <li><b>Runecut light</b> (Settings, Display): dark stone with the island's night, your computer's (${islandTime(LOCAL_NIGHT_STARTS)} to ${islandTime(LOCAL_NIGHT_ENDS)}),
      always or never; frame life follows the same night.</li>
      <li><b>Colours</b> (Settings, Display): red-green safe (blue and vermilion) or blue-yellow safe (teal and crimson). Marks as well: &#9650; / &#9660; better and worse,
      &#10003; / &#10007; in Crafting, Easy, Even or Hard on the target, &#9888;&#xFE0E; overloaded.</li>
    </ul>
    <h4>Your look</h4>
    <ul>
      <li>Island: <i>Customize character</i> under <b>How you look</b> (Settings, <kbd>O</kbd>) opens the account page's character creator on your current look.
      <i>Step ashore</i> saves it to your account, applies it on every island you have a body on and returns you. Nothing changes before that.</li>
    </ul>
    <h4>Map</h4>
    <ul>
      <li><b>Map</b> (<kbd>M</kbd>): dark unvisited, dim remembered, bright in sight. Zoomed to the ground you have walked; widens as you explore, to the whole island.
      Click: move the view there.</li>
    </ul>
    <h4>Tile window</h4>
    <ul>
      <li>Clicking a tile <b>selects</b> it (outlined); the <b>Tile</b> window lists every action, the same list as the right-click menu.
      Unavailable actions are greyed with the reason; <b>&#9656;</b> rows expand in place.</li>
      <li>Works on anything clicked: ground, chest, smelter, campfire, wildermon.</li>
      <li>Untick <i>Open the tile window on a click</i> (Settings) to keep it where you left it.</li>
      <li><b>i</b> beside the title: what the thing is for. Ground: walking pace (speed multiplier), loaded-cart pace, shovel and pickaxe yield, whether anything grows,
      whether it takes paving. Wildermon: every skill and what it decides. Hover to read, click to pin.</li>
      <li><b>Trees are picked by their ground tile</b>, not the canopy drawn over the tiles behind.</li>
    </ul>
    <h4>Search boxes</h4>
    <ul>
      <li>Inventory: name and kind. Recipe book: product, skill, workplace and ingredients at once (<i>leather</i>, <i>mason</i>: the oven and the well;
      <i>nail</i>: all ${RECIPES.filter((r) => r.inputs.some((i) => i.item === 'nail')).length} recipes that use nails).</li>
      <li>Match count at the foot. <kbd>Esc</kbd> clears.</li>
    </ul>
    <h3>The ledger</h3>
    <ul>
      <li>Journal, <b>Ledger</b> tab (<kbd>J</kbd>): everything you have made, by kind: count, count <b>rare</b> or better, <b>best quality (QL)</b>.</li>
      <li>Sort by any of those, by name or newest first; searchable.</li>
      <li>Logged: the first of anything, and every new personal best.</li>
    </ul>
    <h3>The journal</h3>
    <ul>
      <li><b>Journal</b> (<kbd>J</kbd>): ${ALL_GOALS.length} goals in ${JOURNAL.length} chapters, from the first tree felled to a skill at ${LEGEND_AT}.</li>
      <li>Optional; no rewards. Each ticks itself when done, is logged, and stays ticked.</li>
    </ul>
    <h3>Crafting</h3>
    <ul>
      <li>Crafting window (<kbd>R</kbd>): recipes grouped by craft. Each lists tool and materials: green at hand, red missing. Makeable recipes first in each group.</li>
      <li><i>Only what I can make</i>: hides the rest. The same recipes are on each material's menu, where <i>All</i> repeats until materials run out.</li>
      <li>Point at, tab to or long-press a red tool or material: a tree of how it is made, down to gathered materials: count of each part needed and at hand,
      up to ${TREE_DEPTH} recipes deep. Parts you have enough of are not expanded; with several recipes, the first makeable one is shown.
      Click a line for that thing's recipes.</li>
    </ul>
    <h4>What is at hand</h4>
    <ul>
      <li>Crafts and station work that use materials take from: pack, then bags on your back, then your stores within <b>${CRAFT_REACH} tiles</b>, nearest first.</li>
      <li>At stations: mould or anvil metal, smelter ore and scrap, kiln clay, fuel for a campfire, smelter, kiln or oven, casting or coin metal at an anvil,
      improving stock, brew ingredients. Stacks in a store are marked with the store's name on the station's menu.</li>
      <li>Tools must be carried (moulds, coin die, files and so on).</li>
      <li>Never taken from: a store behind a padlock you have no key to, one set down off your settlement by somebody else, a trash crate, a market stall,
      or anything put by. Carts, wagons and boats are anybody's store.</li>
      <li>Settings, <b>Crafting</b>: <i>Use stores within reach</i> unticked: pack and back bags only. <i>Keep rare materials out of crafting</i>: no automatic pick of a
      ${RARITIES.slice(1, -1).map((r) => r.name).join(', ')} or ${RARITIES[RARITIES.length - 1].name} stack; one you choose (right-clicked, or picked on a station's menu) is still used.
      On an island both are saved with your body and apply to actions it finishes later.</li>
    </ul>
    <h3>What a thing is made of</h3>
    <ul>
      <li>Wood and metal carry through: a log's wood into planks, timbers, shafts and what is built of them; a lump's metal from seam to blade.</li>
      <li>Every wood and metal has: working difficulty, weight, durability, rot rate, edge, armour, tool and container value. Examine names the material and its effect.</li>
      <li><b>One craft, one material.</b> The crafting window shows the material and picks the one you have most of; several carried: the row offers a choice;
      clicking a stack uses that one. Nails and similar fittings are exempt. <b>Improving</b>: the same material only.</li>
    </ul>
    <h4>The ${TREE_DEFS.filter((t) => !t.fruit).length} woods that bear nothing</h4>
    <ul>
      <li><b>Pine</b>: soft, light, quick to work, rots fast.</li>
      <li><b>Willow</b>, <b>birch</b>: light, springy. <b>Maple</b>: average.</li>
      <li><b>Oak</b>: hard to work; takes ${percent(mat('oak').wear / mat('pine').wear)} of pine's wear, holds more, hits harder, heavier.</li>
      <li><b>Cedar</b>: barely rots.</li>
      <li>Bows: short bow from <b>willow</b>, medium bow from <b>birch</b>, long bow from <b>oak</b> only.</li>
    </ul>
    <h4>The ${METALS.length} metals</h4>
    <ul>
      <li><b>Copper</b>: the starting metal; soft.</li>
      <li><b>Tin</b>, <b>zinc</b>, <b>lead</b>, <b>pewter</b>: alloy stock; poor as tools and weapons.</li>
      <li><b>Iron</b>: better than copper at everything; rusts in the rain.</li>
      <li><b>Steel</b> (iron with coal): edge lasts ${mul(mat('copper').wear / mat('steel').wear)} as long as copper; weatherproof.</li>
      <li><b>Bronze</b>, <b>brass</b>: the first useful alloys.</li>
      <li><b>Silver</b>: barely tarnishes; damage ${mul(BANE_BONUS)} against creatures with their own light
      (${listedOr(Object.values(SPECIES).filter((s) => s.glow).map((s) => `${article(s.name)} <b>${s.name}</b>`))}).</li>
      <li><b>Gold</b>: rots at ${percent(mat('gold').decay / mat('copper').decay)} of copper's rate; weighs ${mul(mat('gold').weight / mat('copper').weight)} copper; no other use.</li>
      <li>Deep seams (${DEEP_METALS.length}): <b>adamantine</b> keenest edge; <b>glimmersteel</b> light, deflects ${percent(mat('glimmersteel').soak / mat('copper').soak - 1)} more than copper;
      <b>mithril</b> lighter than its wooden haft; <b>seryll</b> barely wears.</li>
      <li>Tools: metal sets speed and accuracy (a bronze hatchet at ${HATCHET_QL} = a copper one at ${Math.round(HATCHET_QL * mat('bronze').bite / mat('copper').bite)}).
      Weapons: metal sets damage. Armour: protection and carried weight.</li>
    </ul>
    <h3>Brewing</h3>
    <ul>
      <li>Fill a barrel from a well or the shore, stand at it, <b>set a brew going</b>. ${BREWS.length} brews:
      ${listed(BREWS.map((b) => `<b>${b.name.toLowerCase()}</b>: ${countIn(b.input, b.count)} + ${b.litres} litres of water, ${dur(b.time)}`))}.</li>
      <li>Yield: litres of drink = litres of water.</li>
      <li>While working: cannot be drawn off; cannot be hurried. Then draw into a bucket and drink from that.</li>
      <li>Brew quality (QL): half the ingredients' QL + half your <b>brewing</b>. A failed brew sours the barrel.</li>
    </ul>
    <h4>Ageing</h4>
    <ul>
      <li>${listed(AGEING.map((b, i) => `<b>${i ? b.name.toLowerCase() : b.name}</b>`))} gain QL per island day (${dur(DAY_SECONDS)}) kept after finishing;
      ${CELLAR_AGEING} times as much in a barrel in a <b>cellar</b>; capped over the brewed QL; max QL ${QL_TOP}.</li>
      ${AGEING_GROUPS.map(({ ageing: a, brews }) => `<li>${listed(brews.map((b) => b.name.toLowerCase()))}: ${a.rate} QL a day (${a.rate * CELLAR_AGEING} in a cellar),
      up to ${a.cap} QL more; reached in ${a.cap / a.rate} days out of a cellar, ${a.cap / (a.rate * CELLAR_AGEING)} in one.</li>`).join('')}
      <li>Ages until the barrel is empty. Examine the barrel: time kept, QL gained, current QL. Drinks and their drink boost are at the current QL.</li>
      <li>A barrel poured into stops ageing (drawing off and pouring back cannot pass the cap).</li>
    </ul>
    <h4>Quern</h4>
    <ul>
      <li>${need('press_apple_juice', 'apple')} of any fruit: a <b>bucket of juice</b> (no harmful effects).</li>
      <li>${need('press_apple_cider', 'apple')} apples or pears: a <b>bucket of cider</b>, no barrel, no wait. One bucket, where a barrel makes
      ${CIDER.litres / BUCKET_LITRES} from ${countIn(CIDER.input, CIDER.count)} and ${CIDER.litres} litres of water.</li>
    </ul>
    <h4>Liquid QL</h4>
    <ul>
      <li>Every liquid but water keeps its QL in and out of a barrel. A bucket drawn from a barrel of ${listedOr([...QL_LIQUIDS, 'a brew', 'spirit'])} is at the barrel's
      current QL (ageing gains included) and keeps it for drinking, selling and exchanging.</li>
      <li>Poured into an empty barrel: barrel takes the bucket's QL. Into a barrel of the same: average weighted by litres. Dye: the same in its mix (see Dye).</li>
      <li>Water: the QL of its container.</li>
    </ul>
    <h4>Drink boosts</h4>
    <ul>
      <li>Any drink gives a drink boost, as a cooked dish gives a meal boost; brews last far longer. At QL ${BOON_QL}: baked potato ${dur(boonTime('baked_potato', BOON_QL))},
      bucket of wine ${dur(boonTime('wine_bucket', BOON_QL))}.</li>
    </ul>
    <h4>Cook</h4>
    <ul>
      <li><b>Distil</b>: ${bill('distil_wine')} over a campfire: a <b>bucket of spirit</b>; ${recipe('distil_wine').returns?.[0]?.[1] ?? 0} buckets back.
      Spirit drink boost at QL ${BOON_QL}: ${dur(boonTime('spirit_bucket', BOON_QL))}.</li>
      <li>Strong Brew: marks every barrel the Cook sets going; its drinks (and buckets drawn from it) give a drink boost ${percent((cook('Strong Brew')['brewed:wine'] ?? 1) - 1)} longer,
      whoever drinks. Mixed brews: the weakest mark. An emptied barrel loses the mark.</li>
      <li><b>Broth</b>: ${bill('make_broth')} over a campfire: ${made('make_broth')} bowls, each feeding a little of all ${NUTRIENTS.length} nutrients.</li>
    </ul>
    <h3>Fishing</h3>
    <h4>Rod</h4>
    <ul>
      <li><b>Fishing rod</b>: ${bill('make_fishing_rod')}. Stand at water and fish.</li>
      <li>Line reach: ${LINE_REACH} tiles; casts into the deepest water in reach. Inland: no catch.</li>
      <li>${FISH.length} fish at ${new Set(FISH.map((f) => f.depth)).size} depths:
      ${listed(FISH.map((f) => `<b>${f.name.toLowerCase()}</b> ${f.depth > 0 ? `from ${metres(f.depth)} m deep` : 'in any water'}${f.level > FISH[0].level ? `, fishing ${f.level}` : ''}`))}.
      Shallow beaches give perch at most; deep water right off a bank gives everything.</li>
      <li>Cooked over a fire; helpings by size: pike ${made('cook_pike')}, sturgeon ${made('cook_sturgeon')}.</li>
    </ul>
    <h4>Bait</h4>
    <ul>
      <li>Bare hook: whatever passes, mostly minnows.</li>
      <li><b>Worms</b> (dug from damp dirt with a shovel; marshes have many): <b>perch</b>. Live <b>minnow</b> or raw <b>meat</b>: <b>pike</b>.
      Whole <b>perch</b>: <b>sturgeon</b>. Corn: a weak bait.</li>
      <li>Cook with Bait Maker: cuts <b>offal</b> from every carcass; draws ${listed((BAIT_BY_ID.get('offal')?.favours ?? []).map((f) => `${itemDef(f).name.toLowerCase()}`))}.</li>
      <li>The best bait in the pack goes on automatically; the menu names it.</li>
      <li>Deep enough water, skill for all: sturgeon is ${percent(biteShare('sturgeon'))} of bites on a bare hook, ${percent(biteShare('sturgeon', 'perch'))} on perch.</li>
    </ul>
    <h4>Net and creel</h4>
    <ul>
      <li><b>Net</b>: ${bill('make_net')}, knotted with a needle. <b>Dragged</b> through wadeable water: several small fish a haul; big fish escape.</li>
      <li><b>Creel</b>: ${bill('make_creel')}. <b>Sink it in water</b> off a bank and bait it; fishes unattended. Holds ${TRAPS.creel.hold ?? 0};
      about <b>${Math.round(1 / CREEL_BAIT_LOSS)} fish per baiting</b>. Emptied from the bank. Best possible creel, kept baited and emptied:
      about ${Math.round(HOUR / CHECK_EVERY * creelOdds(TOP_QL))} fish an hour.</li>
      <li>Tailor with Fisher's Friend: their nets haul ${percent((tailor("Fisher's Friend")['catch:fishing_net'] ?? 1) - 1)} more on average; their creels
      ${percent((tailor("Fisher's Friend")['catch:creel'] ?? 1) - 1)} likelier to catch per check.</li>
      <li><b>Wadd</b>: set to a settlement or work post, fishes the banks in its range and carries the catch home.</li>
    </ul>
    <h4>Fisher</h4>
    <ul>
      <li><b>Smoke the</b> <i>fish</i> at a lit campfire: same fish, same quality (QL), rots ${percent(1 - (fisher('Smoke Fish')['rot:trout'] ?? 1))} slower anywhere.</li>
      <li><b>Fishing Journal</b>: examining water shows depth, each fish's % of bites with the bait they would use, and how often a biting fish stays on with their rod.</li>
      <li><b>Fish pond</b> (${bill('make_fish_pond')}, with a shovel), on their settlement: stocks one fish per ${dur(POND_EVERY)} up to ${furnitureDef('fish_pond').pond};
      take fish out like comb from a hive; nothing goes in.</li>
    </ul>
    <h3>Fruit trees</h3>
    <ul>
      <li>${FRUIT_TREES.length} of the ${TREE_DEFS.length} trees bear. <b>Apple</b> and <b>olive</b>: wild in the warm lowlands of any island.
      The rest each grow on one island of the chart, among the apples and olives:
      ${listed(ISLAND_FRUIT.map(({ R, trees }) => `${listed(trees.map((t) => `<b>${t}</b>`))} on ${islandName(R.name)}`))}.</li>
      ${REGIONS.filter((R) => R.treeless).map((R) => `<li>${capital(islandName(R.name))}: no trees grow or seed on their own.</li>`).join('')}
      <li>Spring flowers: ${FLOWER_KINDS.map(([family, kinds]) => `${family} on ${listed(kinds)}`).join('; ')}.</li>
      <li>A <b>sprout</b> (forestry) planted anywhere grows the tree.</li>
      <li><b>Plucka</b> on a settlement: picks bearing trees into the crate.</li>
      <li><b>Seasons</b>: ${TREES_BY_SEASON.join('; ')}. Out of season, <b>Pick fruit</b> gives nothing and names the next season; a plucka skips the tree;
      <b>Examine</b> gives its seasons and whether it is in season.</li>
      <li>Bushes: <b>Harvest</b> with a sickle cuts ${CUT_BUSHES.map((b) => `${lowName(b.yields ?? '')} off a ${b.name.toLowerCase()} only in ${listed(fruitingSeasons(b.yields ?? ''))}`).join('; ')}.</li>
      <li>Yield per picking: sapling none; mature about ${FRUIT_MATURE}; old about ${FRUIT_OLD}; more with forestry. A few minutes to regrow.</li>
      <li>${capital(countIn('apple', need('make_apple_pie', 'apple')))} + a dough: ${made('make_apple_pie')} <b>apple pies</b> (the best food).
      ${capital(countIn('cherry', need('make_cherry_preserves', 'cherry')))}: ${made('make_cherry_preserves')} jars of <b>preserves</b>.
      ${capital(countIn('olive', need('press_olives', 'olive')))} under a <b>quern</b>: ${made('press_olives')} measures of <b>olive oil</b> (barely rots).</li>
      <li>As <b>wood</b>: apple wears like oak with a finer edge; cherry is the best handle wood; olive is very hard to work and outlasts everything. One log per tree.</li>
    </ul>
    <h4>Forester</h4>
    <ul>
      <li><b>Coppice</b> (hatchet): a mature or older tree back to young, for ${forester('Coppice').coppice ?? 0} logs; it keeps growing.</li>
      <li><b>Tap resin</b> (carving knife): ${forester('Tap Resin').tap_resin ?? 0} tar from a living ${TREE_DEFS[RESIN_TREE].name.toLowerCase()}, once a day per tree;
      the day starts at the daily reset (${hudHour(TREE_DAWN_UTC)} UTC).</li>
      <li><b>Clear brush</b> (sickle): every bush and reed in the ${BRUSH_SIDE}&times;${BRUSH_SIDE} tiles round the chosen one, at once;
      bushes leave ${TILE_DEFS[CLEARED_TO[TileType.Bush] as TileType].name.toLowerCase()}, reeds ${TILE_DEFS[CLEARED_TO[TileType.Reed] as TileType].name.toLowerCase()}.</li>
    </ul>
    <h3>Vineyards</h3>
    <ul>
      <li>Wild vines: in ${WILD_VINE.toLowerCase()}es. <b>${VINE_ACTION(CUT_VINE)}</b> (${itemDef(CUTTING_TOOL).name.toLowerCase()} in pack): ${countIn(GRAPE_CUTTING, 1)};
      again once the bush regrows, as after a harvest.</li>
      <li><b>Trellis</b>: ${bill('make_trellis')} (${workedAt('make_trellis')}, ${itemDef(recipe('make_trellis').tool ?? '').name.toLowerCase()}).
      ${TRELLIS_RULE()} ${trellisRefusedSaid()} Turn: moves to the next side of its tile with such a wall; refused where there is none.</li>
      <li><b>${VINE_ACTION(PLANT_VINE)}</b> at its foot: roots only where the trellis stands on ${vineSoilWords()}.</li>
      <li>Bears from ${VINE_BEARS} days after planting, only in <b>${GRAPE_SEASON}</b>; <b>${VINE_ACTION(PICK_GRAPES)}</b> out of season gives nothing and says how long.</li>
      <li>In ${GRAPE_SEASON}: picked ${onceEvery(VINE_REST)}; grapes = ${GRAPES_A_PICK} &times; (${GRAPES_BASE} + ${VINE_SKILL} &divide; ${GRAPES_SPAN}), rounded:
      ${grapesFor(1)} at the start, ${grapesFor(QL_TOP / 2)} at ${VINE_SKILL} ${QL_TOP / 2}, ${grapesFor(QL_TOP)} at ${QL_TOP}.</li>
      <li>Cutting, planting and picking train ${VINE_SKILL}. Picking a trellis up loses its vine.</li>
      <li><b>Grape wine</b>: ${countIn(GRAPE, BREW_BY_ID.get('grape_wine')?.count ?? 0)} + ${BREW_BY_ID.get('grape_wine')?.litres} litres of water in a barrel,
      ${dur(BREW_BY_ID.get('grape_wine')?.time ?? 0)}. Ages${GRAPE_AGEING === BREW_BY_ID.get('wine')?.ages ? ' as cherry wine' : ''}: ${GRAPE_AGEING?.rate} quality (QL) a day,
      ${(GRAPE_AGEING?.rate ?? 0) * CELLAR_AGEING} in a cellar, up to ${GRAPE_AGEING?.cap} QL more (see Brewing).</li>
    </ul>
    <h3>Farming</h3>
    <ul>
      <li><b>Till</b> (rake in pack): grass or dirt into a field.</li>
      <li>Seeds: foraging (vegetables, starches) and botanizing (spices, fibres)${SEEDS_ALL_YEAR ? ', every season' : ''}. A field's menu offers <b>Sow</b> for each carried.</li>
      <li>${STAGE_NAMES.length} growth stages: ${listed(STAGE_NAMES)}. Time per growth stage by crop (mint fastest, corn slowest).</li>
      <li><b>Tend</b>: once per growth stage. Untended: ${cropYield(0).produce} crop, ${cropYield(0).seeds} seed. Tended every growth stage: <b>${cropYield(RIPE).produce} crops, ${cropYield(RIPE).seeds} seeds</b>.</li>
      <li>Tending and tilling train <b>Farming</b>; farming sets harvest quality (QL).</li>
      <li>Harvesting leaves the field tilled (resowable; a ${SPECIES.seavic.name} can run one alone).</li>
    </ul>
    <h4>Farmer patches</h4>
    <ul>
      <li><b>Sow a patch</b>, <b>Tend a patch</b>, <b>Harvest a patch</b>: the ${PATCH_SIDE}&times;${PATCH_SIDE} tiles round the chosen field as one action, in
      ${PATCH_TIME} times the one-field time.</li>
      <li>Sow: the chosen seed on every empty field, one each. Tend: every crop not yet tended at its growth stage. Harvest: every ripe crop, each by its own tending.</li>
      <li>A crop keeps the growth speed it was sown at, whoever harvests.</li>
    </ul>
    <h4>Seasons</h4>
    <ul>
      <li>Field growth: ${listed(SEASONS.map((s) => `${growthWords(SEASON_GROWTH[s])} in ${s}`))}.</li>
      <li>Winter: crops <b>hold their growth stage until spring</b>; nothing dies; sowing, tending and harvesting still work. A growth stage running into winter finishes after it.
      Before the first spring: ${growthWords(YEARLESS_GROWTH)}.</li>
      <li>Hovering a field: real time to the next growth stage; in winter, time until spring.</li>
    </ul>
    <h4>Planter</h4>
    <ul>
      <li>One crop, <b>${growthWords(PLANTER_GROWTH)} in every season</b>, winter included, indoors or out. Cotton growth stage: ${dur(CROPS.cotton.stageSeconds)} in a spring field,
      ${dur(CROPS.cotton.stageSeconds / PLANTER_GROWTH)} in a planter.</li>
      <li>Sow, tend and harvest from its menu: the field's seeds, growth stages and yields. <b>Pull it up</b>: what grows goes back into the soil.</li>
      <li>Farmer perks that work on it: ${listed(planterPerks().map((p) => p.name))}; ${farmerPerk('rotate:plant_seed')} reads the planter's own last crop.
      Fields only: ${listed(['sow_patch', 'tend_patch', 'harvest_patch'].map(farmerPerk))}.</li>
      <li>Cannot be picked up while growing. Bounty covers planters on your settlement along with its fields.</li>
    </ul>
    <h3>Campfires and cooking</h3>
    <ul>
      <li><b>Build campfire</b> on any dry, open spot: ${FIRE_COST} shafts; fills a ${FIRE_SUBTILES} by ${FIRE_SUBTILES} block of the tile's spots.</li>
      <li>Fuel: thatch, shafts, planks, peat, timbers, logs or coal, each worth so many minutes. Then <b>Light</b>.</li>
      <li>Peat: dug off a peat bed with a shovel; free.</li>
      <li><b>Cook</b> at a lit fire: cooked meat fills ${percent(itemDef('cooked_meat').food ?? 0)} of the food bar (raw ${percent(itemDef('meat').food ?? 0)}); baked potatoes;
      roast onions and nuts; with a <b>clay bowl</b>: berry compote, meat and vegetable stew.</li>
      <li>Cooking recipes: in the crafting window, unlocked next to a lit fire. A failed dish loses the ingredients.</li>
      <li>Burns fuel in real time; goes cold when out. Unlit: take apart for the wood.</li>
    </ul>
    <h3>Grain, the quern and bread</h3>
    <ul>
      <li><b>Quern</b>: ${bill('make_quern')}, stonecutting. Use trains <b>Milling</b>.</li>
      <li>${capital(countIn('wheat', need('make_flour', 'wheat')))}: a lot of <b>flour</b>. ${capital(countIn('corn', need('make_cornmeal', 'corn')))}: <b>cornmeal</b>. Failed grinding: grit.</li>
      <li><b>Dough</b>: flour + a bucket of water: ${made('make_dough')} rounds; bucket back empty.</li>
      <li><b>Bread</b>: a round of dough on a hot stone at a lit fire. Keeps and travels.</li>
      <li><b>Porridge</b>: cornmeal boiled in a clay bowl: ${made('make_porridge')} bowls.</li>
      <li>Dough, bread and porridge are cooking, not milling.</li>
    </ul>
    <h3>The oven</h3>
    <ul>
      <li><b>Oven</b>: masonry, ${bill('make_oven')}, with a trowel; set down on a block of ${furnitureDef('oven').w * furnitureDef('oven').h} spots.</li>
      <li>Fuel: anything a fire takes, peat and coal included; holds ${dur(OVEN_CAPACITY)}. Then light it.</li>
      <li>Lit: a cooking fire for every Cook recipe; dishes that burn over an open flame come out right, and better.</li>
      <li>Leaves ashes like any fire; raked out the same way.</li>
    </ul>
    ${dairyHelp()}
    <h3>Metal</h3>
    <h4>Smelter</h4>
    <ul>
      <li>Mining a seam gives <b>ore</b>. <b>Stone smelter</b>: masonry, ${bill('make_smelter', true)}, with a trowel; made in the crafting window, carried,
      <b>set down</b> on ${SMELTER_W * SMELTER_H} spots of a tile on your own settlement. Picked up whole when cold, empty and raked out.</li>
      <li>Fuel as a campfire (coal burns longest); light; charge with ore. Smelt time per piece: longer for fine ore and harder metal, shorter in a better smelter.
      Draw the lumps off when done.</li>
      <li>Lumps of one metal merge into one lump; quality (QL) = average weighted by size.</li>
      <li><b>Alloys</b> at a hot smelter: bronze, brass, pewter, electrum, <b>steel</b> (${bill('make_steel')}). QL from the input metal; skill only sets how little is lost.</li>
    </ul>
    <h4>Moulds and castings</h4>
    <ul>
      <li>Sand fired in a smelter: <b>moulds</b> (anvil, pan, rake, shovel, hatchet, pickaxe and knife heads, sword blade, helm).</li>
      <li>Every mould: <b>${SKILL_BY_ID.get(MOULD_SKILL)?.name.toLowerCase()}</b>; QL = your ${SKILL_BY_ID.get(MOULD_SKILL)?.name.toLowerCase()}, not the sand's; pouring
      also trains ${SKILL_BY_ID.get(MOULD_SKILL)?.name.toLowerCase()}.</li>
      <li>Wears on every filling; <b>cannot be mended</b>; higher QL lasts more fillings.</li>
      <li><b>Anvil mould</b>, poured at the smelter: an anvil of that metal; set down on ${ANVIL_SUBTILES * ANVIL_SUBTILES} spots of a tile.</li>
      <li>Other moulds, <b>poured at the smelter</b> in any metal: a <b>casting</b> (shovel head casting, nail casting…) out with the lumps.</li>
      <li>Castings are finished at an <b>anvil</b> with <b>blacksmithing</b>, <b>weaponsmithing</b> or <b>armoursmithing</b> as the piece needs. Skill sets success and QL,
      with the casting (mould and metal QL) and the anvil.</li>
      <li>Tool heads and blades: fit a shaft. Swords hit far harder than tools. A helm stops most of a cornered wildermon's damage.</li>
    </ul>
    <h4>Smith</h4>
    <ul>
      <li><b>Ingots</b>: <b>Pour ingots</b> at the smelter: ${INGOT_LUMPS} lumps of one metal into an <b>ingot</b>. Weighs ${frac(INGOT_WEIGHT)} of its lumps; counts as all
      ${INGOT_LUMPS} wherever the smelter, anvil, a recipe or Improve takes lumps; unused remainder comes back as lumps.</li>
      <li><b>Temper Bath</b>: a weapon or tool this Smith finished can be <b>quenched</b> once, by any Smith with the perk, from its menu, at water or beside a barrel or
      well of it; QL gain as its maker's mark says. Shown on Examine.</li>
    </ul>
    <h3>Glass</h3>
    <ul>
      <li><b>Glassblowing</b> (Artisan), at a hot smelter: ${listed(['make_glass', 'make_glass_panel', 'make_bottle', 'make_stained_glass'].map(glassJob))}.</li>
      <li>Glazing: window ${glazing('window')} glass panels; bay window ${glazing('bay')}; glasshouse roofs are laid in them.</li>
      <li>Failed stained glass keeps the gem and sand; other failures lose the inputs.</li>
      <li><b>Bottle</b>: holds ${itemDef('bottle').holds ?? 0} of one food or drink; contents rot at ${frac(itemDef('bottle').shelter ?? 1)} of the rate on the ground.</li>
      <li>Solid <b>stained glass</b> wall: ${billIn(WALL_MATERIALS.find((m) => m.id === 'stained_glass')?.bill ?? [])}; trowel; trains masonry. One firing glazes one wall.
      ${stainedOnly()}</li>
      <li><b>${itemDef(TINTED_PANE).name}</b>: <b>Dye it</b>, ${litresWord(DYE_PANE_LITRES)} of dye a panel, one panel an action; keeps the colour; stacks apart from clear ones.</li>
      <li>A window or bay window is the colour of the <b>last panel fitted</b> (a clear panel last: clear). Seen by everybody, inside and out.
      Stained glass walls keep their gem colours and take no dyed panel.</li>
    </ul>

    <h3>Hunting and butchering</h3>
    <ul>
      <li><b>Attack</b> wild wildermon from their menu. An edged tool in the pack hits far harder than bare hands. Timid wildermon flee when hurt.</li>
      <li>A kill leaves a <b>corpse</b>; corpses rot. <b>Butcher</b> (tile menu): meat, fur, <b>hide</b>, bone, sometimes a gland.</li>
      <li>Amount kept: <b>Butchering</b> and the <b>butchering knife</b>; bare hands waste most. Every carcass trains Butchering.</li>
      <li>Quality (QL) with a knife of QL <i>n</i>: your Butchering <i>n</i>% of the time; otherwise knife QL × ${QL_LOW.toFixed(1)} to ${(QL_LOW + QL_SPAN).toFixed(1)}, capped at your Butchering.
      Bare hands: Butchering × ${QL_LOW.toFixed(1)} to ${(QL_LOW + QL_SPAN).toFixed(1)}, + ${QL_BARE}. The menu's <b>Butcher</b> line gives the range for your knife.</li>
      <li>Hides come off <b>raw</b>; useless until treated with lye.</li>
    </ul>
    <h3>Looking inside a building</h3>
    <ul>
      <li>Storey arrows (right edge, once anything is built): pick the <b>storey shown</b>; everything above it is hidden. Label <i>1st</i>, <i>2nd</i>…;
      click for <i>Auto</i> (follows your storey). <kbd>Page Up</kbd> / <kbd>Page Down</kbd> do the same.</li>
      <li>Once any cellar is dug: <i>Cellar</i>, below the ground floor: every nearby cellar as dug, buildings over them removed. Contents and people in a cellar
      show only to somebody in it, within their sight.</li>
      <li><b>◪</b>, <kbd>X</kbd> or the Settings box: <b>hides the walls facing you</b>; far walls stay.</li>
    </ul>
    <h3>Settling and building</h3>
    <h4>Founding</h4>
    <ul>
      <li><b>Settlement stake</b>: a shaft, carving knife. Use where you stand: a settlement ${DEED_ACROSS} by ${DEED_ACROSS} tiles round a settlement totem.</li>
      <li>One settlement at a time. Building only on its land.</li>
      <li>Items left outside on settlement land: rot rate ${frac(DEED_DECAY)} of that off it.</li>
    </ul>
    <h4>Buildings and walls</h4>
    <ul>
      <li>Flatten and pack a tile; with a mallet, <b>Plan building</b> on it and <b>Add to building</b> on neighbouring flat packed tiles.</li>
      <li><b>Plan wall</b> on a tile edge: solid, window, bay window, door or double door; in log, plank, timbercraft, cobblestone, slate, marble, sandstone, stone brick,
      clay adobe, clay bricks, ornate silver or ornate gold.</li>
      <li><b>Build wall</b>: one material an action, from the pack, then a crate on the tile, then crates, carts, wagons and containers within ${CRAFT_REACH} tiles
      (<i>Use stores within reach</i> unticked: pack and the crate on the tile only). Floors, frames, and bridge and aqueduct spans draw the same way.</li>
      <li>Actions per click: one, ${listed(BUILD_COUNTS.map(String))} (where the piece still needs more), or all it needs (max ${MOST_GOES}); stops when finished or out of materials.</li>
      <li>Floors: planned the same way; laid with paving.</li>
      <li>Next storey: needs every side of the storey below finished as a wall, or with a finished column at each end. Max ${MAX_LEVELS} storeys.</li>
      <li>Actions go to the storey you are working on (<b>Work on storey N</b> on its menu).</li>
      <li>A finished full-height wall with a wall of the storey above on the same side (once any of that wall's materials are in) cannot come down until that upper
      wall does, or a finished column stands at each end; likewise the last wall a jetty rests on. To turn one into a door: column at each end, take it down, build the door.</li>
      <li>Roof: <b>Plan roof</b> tile by tile once the top storey's walls are done; neighbours join into ridges and hips.</li>
    </ul>
    <h4>Stairs</h4>
    <ul>
      <li>On an upper storey, plan a <b>staircase</b> or <b>ladder</b> instead of a floor. Walk onto it from below: up. Step off it toward the ground: down.</li>
      <li>Every flight material comes in both widths: wide (full tile), ${percent(STAIRS_SHARE)} of a solid wall's materials; <b>${SINGLE_STAIRS_NAME}</b> (half the tile),
      ${percent(SINGLE_STAIRS_SHARE)}. The ${SINGLE_STAIRS_NAME} runs up the left or right half; the other half is the stairwell.</li>
      <li><b>Outside staircase</b>: ground to storey ${OUTSIDE_STAIR_LEVEL + 1}. On open ground sharing a side with a building of ${OUTSIDE_STAIR_LEVEL + 1} storeys or more:
      <b>Plan outside staircase</b> or <b>Plan outside ${SINGLE_STAIRS_NAME}</b>, same materials as inside. Q and E turn it; head against the building.</li>
      <li>Refused: in water, on a tree or bush, under a jetty or bridge, off your settlement, on ground higher than the building's ground floor. Ladders stay inside the footprint.</li>
      <li>Enter from the ground; leave its head onto storey ${OUTSIDE_STAIR_LEVEL + 1} through a door, double door, arch or wall gap; leave its sides or foot onto the ground.</li>
      <li>Not part of the storey: needs no walls, no roof, no wall below; nothing else planned on its tile.</li>
    </ul>
    <h4>Glass roofs and glasshouses</h4>
    <ul>
      <li><b>Plan roof</b> offers <b>glass</b>: ${glassTile()} per tile of the ${roofShapeDef(undefined).name.toLowerCase()} roof Plan roof lays; mallet; trains carpentry.
      Glass goes on roofs only.</li>
      <li><b>Glasshouse</b>: one storey, <b>walled all round to full height</b> (door, window, arch count; ${lowWalls()} too low), every footprint tile under finished glass.
      Its menu lists what is missing.</li>
      <li>Ground-floor tiles with no floor planned and no slab poured: <b>Till</b> with a rake into fields (all field rules, Farmer patches, perks and Bounty included).</li>
      <li>With a field inside: no floor over the field, no roof but glass, no storey above. <b>Clear the field</b> packs it flat again.</li>
      <li>Growth: <b>${growthWords(GLASSHOUSE_GROWTH)} in every season</b>, winter included (open field: ${listed(SEASONS.map((s) => `${growthWords(SEASON_GROWTH[s])} in ${s}`))}).
      Cotton growth stage: ${dur(CROPS.cotton.stageSeconds / GLASSHOUSE_GROWTH)} all year.</li>
      <li>Last panel or wall in: crops continue at glasshouse growth speed from their progress. A roof tile or wall removed, or a tile added: field growth speed from there.</li>
      <li>Indoors: items left in it rot at ${frac(INDOORS_DECAY)} of the open-air rate.</li>
    </ul>
    <h4>Fences, gates, half walls</h4>
    <ul>
      <li>No building needed: <b>Plan fence</b> on any tile edge, on or off your settlement, packed or not.</li>
      <li>Log fence: ${wallBill('log', 'fence').needed.log} logs (log wall: ${wallBill('log', 'solid').needed.log}). Half wall: ${frac(WALL_TYPE_BY_ID.get('half_wall')?.factor ?? 0)} of a wall.</li>
      <li>Both block everything alive, you included (a paddock holds a ${SPECIES.roxxen.name}). <b>Fence gate</b>: passable.</li>
      <li><b>Build fence</b> feeds them like a wall; taken down from the same menu.</li>
      <li>No storey over a fence, half wall or railing: the side below needs a wall, or a finished column at each end.</li>
    </ul>
    <h4>Portcullis</h4>
    <ul>
      <li>Ground-floor wall type in ${listed(WALL_MATERIALS.filter((m) => m.kind === 'stone' && takesAs(m, { wall: 'portcullis' })).map((m) => m.name.toLowerCase()))}; as wide as a double door.
      Bill: ${billIn(WALL_TYPE_BY_ID.get('portcullis')?.fittings ?? [])} over the stone's own (stone brick: ${billIn(Object.entries(wallBill('stone_brick', 'portcullis').total))}).</li>
      <li><b>Raise the portcullis</b>: ${gateJobWords('raise_portcullis', goSeconds)}. <b>Lower the portcullis</b>: ${gateJobWords('lower_portcullis', goSeconds)}.
      From either side, within ${gateReach('raise_portcullis')} tile${gateReach('raise_portcullis') === 1 ? '' : 's'} of the tile beside it.</li>
      <li>Down: nothing passes (people, carts, wildermon). Up: everything passes, carts included. Always see-through.</li>
      <li>Pointing at it (either side, any storey) shows up or down and padlocked.</li>
      <li>No padlock: anybody raises or lowers it. <b>Fit a padlock</b>: only its key holder and the settlement's founder raise, lower or take it down.</li>
    </ul>
    ${runeGateHelp()}
    <h4>Hidden door</h4>
    <ul>
      <li>A solid wall's bill; looks like a solid wall. <b>Plan wall</b>, <b>Hidden door</b>: to everybody else a plain solid-wall plan (same action,
      ${dur(goSeconds(PLAN_WALL?.baseTime ?? 0))}, ${percent(PLAN_WALL?.stamina ?? 0)} stamina, same overhead text, same island record).
      On an island the door request travels in the plan's own call.</li>
      <li>Request is for that side of that tile; kept only if the plan starts or is queued (a refused plan: too far, too tired, queue full, no padlock and hinges in
      pack, requests nothing).</li>
      <li>Kept while you have a wall plan on that side running or queued (walking off pauses both). No plan left on that side (refused when reached, or cleared with
      <kbd>Esc</kbd>): request dropped.</li>
      <li>The next solid wall you plan on that side, on any storey, is the hidden door. Several sides can be requested and queued.</li>
      <li>Lapses after ${dur(HIDDEN_DOOR_LAPSE)}: the plan stays a solid wall.</li>
      <li>On finishing the plan: takes ${billIn(HIDDEN_DOOR_IRON)} from your pack; the padlock becomes its key. Missing from the pack by then: solid wall.</li>
      <li>Key holder and settlement founder: a door (walk and see through; dashed seam and keyhole on its face; pointing says your key opens it).</li>
      <li>Everybody else: a solid wall (impassable, opaque, wall actions only; on an island their browser is told solid wall). Wildermon and carts never pass.</li>
    </ul>
    <h4>Piers and stilts</h4>
    <ul>
      <li>A tile that is sloped, below the floor, or under at most ${metres(PIER_WATER)} m of water is built on piers: ground floor is a <b>deck</b> at floor height,
      on timber posts or stone piers and arches by the deck's material. Level dry ground at floor height: built on directly, packed first.</li>
      <li>Deck height when planned on such a tile: its highest corner, or ${metres(PIER_CLEAR)} m over water if higher, or a level you have taken if higher still.</li>
      <li>Added tiles: wholly under the deck (plan hillside houses from the highest tile); lowest corner at most ${metres(PIER_DROP)} m under the deck; bare ground or flat
      growth only: no tree, field, paving, water plant, anything standing, bridge landing or person. Creatures are moved off.</li>
      <li><b>Plan deck</b> on each: floor materials + ${frac(10 / PIER_WALL_DROP)} of a solid wall of the same material per metre from deck to lowest corner, rounded up per item.
      Plank deck ${metres(PIER_DROP)} m up: ${deckBill('plank', PIER_DROP).needed.plank} planks, ${deckBill('plank', PIER_DROP).needed.timber} timbers.</li>
      <li>A deck carries no wall heavier than its own material (${Object.entries(HEFT_WORDS).sort(([a], [b]) => Number(a) - Number(b)).map(([, w]) => w).join(', then ')},
      lightest first); the lightest deck under a building carries every storey.</li>
      <li>Unbuilt: nobody stands on the tile. Built: dry floor at deck height for walls, stairs, furniture, crates; a bridge lands on it as on a bank.</li>
      <li>Step on or off from ground at most ${metres(MAX_STEP)} m above or below, +${metresFine(CLIMB_PER_LEVEL)} m per climbing level. Higher: reach it by extending
      the building until the ground is within a step, or by bridge.</li>
      <li>No creature, cart, mount or boat on or under a deck.</li>
      <li>Ground under any building: no digging, raising, flattening, mining, packing, cultivating, paving or planting; no tilling except in a glasshouse.</li>
    </ul>
    <h4>Materials</h4>
    <ul>
      <li>Logs: sawn into planks and timbers. Cut grass: thatch. Clay + sand: mortar. Clay + grass: adobe. Silver and gold: chipped from mountain veins.</li>
    </ul>
    <h3>Cellars</h3>
    <h4>Digging</h4>
    <ul>
      <li>Under a building with every ground-floor wall built. Dug a tile at a time, ${metres(CELLAR_DEPTH)} m down (a full storey) in slices of ${metres(HEIGHT_UNIT)} m, by somebody inside that
      building (ground floor or its cellar); not through a wall from outside or from the next building's cellar.</li>
      <li><b>${CELLAR_ACTION_BY_ID.get('dig_cellar')?.label}</b>: shovel, Digging, a slice an action, a dirt per slice. At the rock:
      <b>${CELLAR_ACTION_BY_ID.get('mine_cellar')?.label}</b>: pickaxe, Mining; each slice gives what mining that rock gives (${CELLAR_SHARDS} by stone, or ore where a vein runs under).</li>
      <li>A vein needs its own Mining level${ORE_SENSE ? `, ${ORE_SENSE.fx['ore:below']} less with ${ORE_SENSE.name}` : ', as a face of it does'}.</li>
      <li>Only where every tile corner has ${metres(CELLAR_SOIL)} m or more soil and the floor (${metres(CELLAR_DEPTH)} m under the ground floor) is above the sea.
      Never under a poured foundation or a deck on piers.</li>
    </ul>
    <h4>Way down</h4>
    <ul>
      <li><b>Staircase down</b> or <b>ladder down</b>: planned on a dug tile from the ground floor; <kbd>Q</kbd> / <kbd>E</kbd> pick the side it is climbed from.
      Removes flooring; a glasshouse field is cleared first. Its foot lands on the cellar tile on that side, which must also be dug.</li>
      <li>Walk off it that way: down. Walk onto it from its foot: up. Its sides and back are solid, as is the ground between neighbouring cellars (each needs its own way down).</li>
      <li>A tile has a way down or a staircase up, not both.</li>
      <li>No towed wildermon, driven cart or mount goes down: let go or dismount first. Nothing can be dropped on the head of one.</li>
    </ul>
    <h4>Inside</h4>
    <ul>
      <li>Always indoors, no walls needed, roof or none. Rot: ${frac(CELLAR_DECAY)} of the open-air rate (closed room: ${frac(INDOORS_DECAY)}); the slowest anywhere.</li>
      <li>Bed: +${percent(INDOORS_REST - 1)} rest over the same bed outdoors, as in a closed room.</li>
      <li>All furniture goes down except ${listed(CELLAR_BURNS)} (open fires), anything on wheels or afloat, and ${listed(CELLAR_NOT_DOWN)}.</li>
      <li>Always dark; counts as deep night for Awareness learned in the dark. Sight: what a carried lantern or torch lights. A lantern or torch can be lit there only
      from another alight in your hands.</li>
      <li>Daylight: ${CELLAR_DAYLIGHT} tiles round the foot of the way in, by day.</li>
    </ul>
    <h4>Filling in</h4>
    <ul>
      <li>Ground over a cellar: no digging, raising or levelling. A building over a cellar cannot be removed from the plan until every cellar tile is filled.</li>
      <li><b>${CELLAR_ACTION_BY_ID.get('fill_cellar')?.label}</b>: a dirt, clay or sand a slice an action, from the pack or something beside you; once everything down there is
      carried out and the way down on that tile removed.</li>
    </ul>
    <h3>Jetties, balconies, railings and columns</h3>
    <h4>Jetty</h4>
    <ul>
      <li>An upper storey floored <b>${JETTY_REACH} tile past the footprint</b>. Right-click the open tile beside the building: <b>Jetty of &hellip; (storey N)</b>
      &rarr; <b>Plan jetty floor</b>. N: the storey you work on (<b>Work on storey N</b>), or the storey above the ground floor when working on that. Menu actions go to
      the named storey.</li>
      <li>Costs a floor. The tile must share a side with a <b>finished full-height wall</b> of the storey below (solid, window, bay, door; not a half wall, fence or railing);
      be open ground on your settlement, no tree or bush; no corner higher than the floor of the storey below.</li>
      <li>Weight rule, set by the lightest wall or column below: ${heftGroups()}.</li>
      <li>Stairs and ladders stay in the footprint. A storey over a jettied room floors out over it, resting on its walls (jetties stack).</li>
      <li>Ground under it: nothing planned or planted; no bridge or aqueduct; corners not dug or raised.</li>
      <li>The last wall it rests on stays up until the jetty is removed or a finished column stands at each end of it.</li>
      <li>Removed only after the walls, railings and columns on it, the floor above and the roof over it are down.</li>
      <li>Open to its storey, it <b>is part of that storey</b>: its open sides need a wall, railing or columns before the storey counts as closed for another storey or a roof.</li>
      <li><b>Plan roof over the jetty</b>: only on <b>walls or columns</b>; every side out from the storey needs a finished full-height wall, or at each end a finished column or
      a finished full-height wall's end (railings carry nothing). The refusal names the corner missing a column.</li>
      <li>Under a jetty roof: its wall stays until a column at each end carries the roof; a wall end that alone carries a side stays until a column stands on that corner;
      a column that alone carries one stays until the side is walled or the roof is off. No wall or door between a storey and its roofed jetty.</li>
      <li>Walled or doored off from its storey: a <b>balcony</b>: outside the storey (its railings are not needed for the storey above); no roof.</li>
    </ul>
    <h4>Railing</h4>
    <ul>
      <li>Wall type: ${frac(railing.factor)} of a solid wall's bill (log: ${wallBill('log', 'railing').needed.log} logs, wall ${wallBill('log', 'solid').needed.log});
      ${metres(RAILING_HEIGHT * WALL_HEIGHT)} m high (wall ${metres(WALL_HEIGHT)} m); see-through. Finished: impassable.</li>
      <li>On the edges of an upper storey, jetty, balcony or finished deck on piers; never on the ground (use a fence).</li>
      <li>Round a finished <b>flat roof</b> (a walkable terrace): <b>Plan railing round the roof</b> on its edge. A railed roof tile cannot be removed until the railing is.</li>
      <li>Upper edges with nothing built past them are impassable anyway; a railing closes a storey in.</li>
    </ul>
    <h4>Column</h4>
    <ul>
      <li>On a tile corner: right-click near it, <b>Plan column (&hellip; corner, storey N)</b>, on the storey you work on.</li>
      <li>Costs ${frac(COLUMN_SHARE)} of a solid wall's bill in its material (${columnBills()}); built a unit at a time.</li>
      <li>Ground floor: on the footprint, or a finished deck on piers. Higher: on a finished floor of its storey.</li>
      <li>Weight rule as a wall there; on piers: no column heavier than the lightest deck, no deck lighter than its heaviest wall or column. Not in glass.</li>
      <li>On the ground it takes the corner spot of every tile round it: no furniture, smelter or kiln there, and no column over furniture in one.</li>
      <li>A side with a <b>finished column at each end</b> counts as closed: columns plus a roof make an open hall or colonnade; a storey can be planned over them.</li>
      <li>Counts toward the storeys its material allows.</li>
      <li>Roof on columns: rot under it ${frac(INDOORS_DECAY)} of the open-air rate. Beds: still outdoors (indoor rest &times;${INDOORS_REST} of outdoor needs walls all round).</li>
      <li>A column carrying a side (an edge side with no full-height wall, closed by it and the far column, with a floor or roof over): stays until the side is walled or what
      is over it is off. Otherwise removable any time.</li>
      <li>Drawn as a pilaster where walls meet on its corner. The floor under one comes up only while another finished floor round the corner holds it.</li>
    </ul>
    <h3>Nails, furniture and storage</h3>
    <h4>Nails</h4>
    <ul>
      <li><b>Nail mould</b>: sand fired at a smelter; ${NAILS_PER_LUMP} channels. One lump poured at the smelter and beaten on an anvil:
      ${NAILS_PER_LUMP} nails, ${Math.round(itemDef('nail').weight * 1000)} grams each.</li>
      <li>Needed by: crates, tool heads on shafts, all furniture. Not by: sawing planks, carving shafts, bundling thatch.</li>
    </ul>
    <h4>Furniture</h4>
    <ul>
      <li><b>Fine carpentry</b> (separate from carpentry): mallet, planks, timbers, shafts, nails; ${FINE.length} pieces: ${listed(FINE.map((f) => f.name.toLowerCase()))}.</li>
      <li>Carried like a crate. <b>Set furniture down</b> (tile menu): the piece follows the cursor; click to place; <b>Q</b> / <b>E</b> turn ${frac(1 / SIDES)}; Escape keeps it.</li>
      <li>Keeps its facing whatever the view. <b>Turn it</b>: ${frac(1 / SIDES)} round. Stairs and ladders: Q and E pick the climbing side (and the half on a
      ${SINGLE_STAIRS_NAME}, a half at a time).</li>
      <li>Storage (${HOLDERS.length} pieces): ${listed(HOLDERS.map((f, i) => `${f.name.endsWith('s') ? '' : 'a '}${f.name.toLowerCase()} ${i === 0 ? 'takes ' : ''}${f.capacity}`))}
      (plank crate: ${CRATE_DEFS.plank.capacity}).</li>
      <li><b>Larder</b>: food and drink (raw or cooked), flour, dough and cornmeal only.</li>
      <li><b>Open</b> to see inside; <b>Put away</b> on a carried item while beside it. Must be empty to pick up.</li>
      <li>Drag a stack from the inventory onto a crate, cart, wagon or holding piece: goes in whole (Put away rules); walks there if out of reach.
      Not into a trash crate or market stall.</li>
      <li>Dropped on a <b>${furnitureDef('crate_shelf').name.toLowerCase()}</b>: into its crates in order of its ${furnitureDef('crate_shelf').crates ?? 0} spots, front row first,
      each taking what it has room for. Leftovers stay in your pack. Crates shut to you (somebody else's, padlocked, or a settlement store your rank cannot use) are skipped.</li>
    </ul>
    <h3>Shop counters</h3>
    <ul>
      <li>A wall with a market stall in it. <b>Plan wall</b>, <b>Shop counter</b>, in any of ${WALL_MATERIALS.filter((m) => takesAs(m, { wall: 'counter' })).length} materials.
      Bill: ${frac(COUNTER_TYPE.factor ?? 1)} of a solid wall's material + ${countIn('hinge', counterHinges)} (log: ${wallBill('log', 'counter').needed.log ?? 0} logs,
      solid log wall ${wallBill('log', 'solid').needed.log ?? 0}).</li>
      <li><b>Ground floor</b> only, in a wall with no building across it: that side is the <b>street</b>; no building is planned or added onto that tile afterwards.</li>
      <li>Impassable; carries a storey like any wall; does not block sight.</li>
      <li>Owner: whoever planned it. Within <b>${COUNTER_REACH} tiles</b> of the wall's middle, either side: <b>Set out on the counter</b> on a pack item, or drag the stack.
      Holds <b>${COUNTER_HOLDS} things</b>, as a stall; a wildermon crate is the only furniture it takes.</li>
      <li>Prices: <b>Stall</b> tab of the <b>Market</b> window; unpriced items are not for sale.</li>
      <li>Buyers: <b>street side only</b>, within ${COUNTER_REACH} tiles, not inside any building (the shop's other rooms and next door included).
      Right-click beside it: <b>Buy</b> (<b>Buy from</b> its keeper's counter where several sell onto the tile), or <b>Look at</b> and <b>Buy</b> on an item.</li>
      <li>Items and prices visible within <b>${COUNTER_SEEN} tiles</b>; further off, only the count.</li>
      <li>Silver goes to its <b>till</b>: keeper empties it from either side with <b>Take the takings</b>; items come back with <b>Take</b>.</li>
      <li>Cannot be taken down while anything is on it or in the till.</li>
    </ul>
    <h3>Lantern posts</h3>
    <ul>
      <li><b>Lantern post</b>: ${bill('make_lamp_post')} (${workedAt('make_lamp_post')}). <b>Lantern pillar</b>: ${bill('make_lamp_pillar')} (${workedAt('make_lamp_pillar')}).
      Set down like furniture; no light of their own.</li>
      <li>Within <b>${STORE_REACH} tiles</b>: <b>Hang a lantern on it</b> / <b>Set a lantern in it</b>, the best carried or the one chosen. Then it follows every lantern rule:
      <b>Put a candle in</b>, <b>Strike a light</b> (at a fire or off something alight in hand), <b>Put it out</b>.</li>
      <li>Candle burns only while lit: <b>${dur(candleBurn(LOW_QL))}</b> in the roughest lantern, <b>${dur(candleBurn(TOP_QL))}</b> in the best.</li>
      <li>Lit at night: lights the ground to the lantern's reach, <b>${lanternReach(LOW_QL)} to ${lanternReach(TOP_QL)} tiles</b>, for everybody;
      that ground is in sight from as far as you can see.</li>
      <li><b>Take the lantern down</b>: back to the pack with its remaining candle, still lit if it was. Cannot be picked up with a lantern in it.</li>
      <li><b>Padlock</b>: without the key nobody fits or removes a lantern, adds a candle, puts it out or picks the piece up. Anybody may <b>strike a light</b>.</li>
      <li>Not set down with its arm and lantern into a wall: <i>${LAMP_INTO_WALL}</i> <b>Turn it</b> skips such facings.</li>
      <li><b>Rune lantern post</b>: ${bill('make_rune_lantern')} (${workedAt('make_rune_lantern')}). No lantern: at night lights the ground for everybody as a lantern of its quality (QL),
      <b>${lanternReach(LOW_QL)} tiles at QL ${LOW_QL} to ${lanternReach(TOP_QL)} at QL ${TOP_QL}</b>, in sight from as far as you can see.
      No candle, no fuel, never goes out. Set down, turned, padlocked and picked up as any piece; not allowed in a cellar.</li>
    </ul>
    <h3>Memorial stones</h3>
    <ul>
      <li><b>Memorial stone</b>: ${bill(`make_${MEMORIAL}`)} (${workedAt(`make_${MEMORIAL}`)}). Set down on a ${furnitureDef(MEMORIAL).w} by ${furnitureDef(MEMORIAL).h} block of subtiles.</li>
      <li><b>Engrave</b>: within <b>${STORE_REACH} tiles</b>, ${itemDef(ENGRAVE_TOOL).name.toLowerCase()} in pack; one line up to <b>${ENGRAVE_MAX} characters</b>.
      ${capital((SKILL_BY_ID.get(ENGRAVE_SKILL)?.name ?? ENGRAVE_SKILL).toLowerCase())} work: trains it, wears the chisel like an action.</li>
      <li>Cleaned like chat: line breaks and tabs become spaces; runs of spaces become one. <b>Cut a new line</b> replaces it.</li>
      <li>Who may engrave: whoever set it down and anybody of the settlement it stands on; nobody muted by a keeper.</li>
      <li><b>Examine</b> reads the line in quotes. Keeps its line in the pack (its Examine shows it) and when set down again. No decay.</li>
      <li>After dark: runes and line glow; light ${MEMORIAL_REACH} tiles round its middle.</li>
    </ul>
    <h3>Calling things by name</h3>
    <ul>
      <li><b>Give it a name</b> on any crate, bin, chest, cart, furniture, work post or trap. The name is used <b>everywhere</b>: Stores window, settlement window,
      its own menu, hover text. An empty answer removes it.</li>
      <li><b>Sign</b> (${bill('make_sign', true)}) and <b>signboard</b> (${bill('make_great_sign', true)}): set up and name; the name shows above the board in the world for anybody.</li>
    </ul>
    <h3>Bags</h3>
    <ul>
      <li>${BAGS.length} carried containers: ${listed(BAGS.map((id) => `a <b>${itemDef(id).name.toLowerCase()}</b> of ${bill(`make_${id}`, true)} (${itemDef(id).holds} things)`))}.</li>
      <li>Open from its pack entry; <i>Put it in a bag</i> on any carried item; <i>Empty it out</i> returns everything to the pack.</li>
      <li>Contents are <b>out of reach</b> (no recipe draws on them). No bag inside another bag.</li>
      <li>Rot on the ground: ${listed(BAGS.map((id, i) => `${frac(itemDef(id).shelter ?? 1)}${i === 0 ? ' the rate' : ''} in ${aOrAn(itemDef(id).name)}`))}.</li>
    </ul>
    <h3>Work posts</h3>
    <ul>
      <li><b>Work post</b>: <b>${bill('make_work_post', true)}</b>, mallet. Driven in on any tile <b>outside your own borders</b> (refused inside).</li>
      <li><b>Set a wildermon to it</b> (its menu): <b>one</b>, following you within ${POST_FOLLOW_REACH} tiles or in a crate in your pack or beside you (let out at the post). Same task and skill pay as on a settlement, measured from the post.</li>
      <li>Range: <b>${postRadius(1)} tiles round a rough post, ${postRadius(TOP_QL)} round the best</b>, whatever the wildermon's own range.</li>
      <li>Loads go into anything with room inside that circle; with nothing there, all the way home.</li>
      <li><b>Rots where it stands</b>: <b>${dur(POST_LIFE_MIN)}</b> (roughest) to <b>${dur(POST_LIFE_MAX)}</b> (best); leans as it goes; one warning near the end.</li>
      <li>When it falls, its worker: <b>returns to you</b> if you walk alone; otherwise <b>goes to work on your settlement</b>; with no settlement, into an empty
      <b>wildermon crate</b> in your pack; with neither, back to the wild.</li>
      <li>Can be pulled up early; comes up as worn as it was.</li>
      <li>A post's worker is <b>not</b> counted against your settlement level's working slots.</li>
    </ul>
    <h3>Raw materials, worked materials, seed, sprouts, rubbish, and something to pull it in</h3>
    <ul>
      <li><b>Raw material bin</b>: <b>${furnitureDef('bulk_bin').capacity}</b> of unworked material from the ground, trees, veins or wildermon (ore, logs, dirt, sand, clay, shards, wool, hides).
      Refuses anything worked at a bench, kiln or smelter (bricks, planks, lumps) and food.</li>
      <li><b>Craft material bin</b>: same bill; takes exactly what the raw bin refuses: every bench, kiln or smelter product (planks, nails, ribbons, hinges, lumps, bricks,
      cloth, arrows). Together they take every material; neither takes tools, crops or meals.</li>
      <li>Weighed, not counted (first of ${FURNITURE.filter((f) => f.heft).length} such pieces): <b>${CRAFT_HEFT} kg</b>
      (${Math.round(CRAFT_HEFT / itemDef('nail').weight)} nails or ${Math.round(CRAFT_HEFT / itemDef('plank').weight)} planks); no item-count limit. Stronger wood: proportionally more.</li>
      <li><b>Seed bin</b>, <b>sprout bin</b>: ${furnitureDef('seed_bin').w * furnitureDef('seed_bin').h} subtile each, ${bill('make_seed_bin')} apiece; weighed.
      Seed bin <b>${SEED_HEFT} kg</b> (${Math.round(SEED_HEFT / itemDef('wheat_seed').weight)} wheat seeds or ${Math.round(SEED_HEFT / itemDef('potato_seed').weight)} seed potatoes): the
      ${CROP_BY_SEED.size} sowable seeds only. Sprout bin <b>${SPROUT_HEFT} kg</b> (${Math.round(SPROUT_HEFT / itemDef('sprout').weight)} sprouts): sprouts only.</li>
      <li><b>Trash crate</b>: contents rot <b>${mul(furnitureDef('trash_crate').trash ?? 1)} faster</b> than out in the rain; gone in minutes.
      <b>Put away</b> never picks it; use <b>Throw it in the trash</b> on the item.</li>
      <li><b>Small cart</b>: holds ${furnitureDef('cart').capacity}. <b>Take hold of it</b>: follows you until you <b>let go</b>. One cart at a time; not into water or over what it cannot roll over.</li>
    </ul>
    <h3>Bridges</h3>
    <ul>
      <li>A deck from solid ground to solid ground. Finished: walked, ridden and, by material, driven over like ground.</li>
      <li>Stand on one bank, right-click the other: <b>Throw a bridge across from here</b>. Straight (north, south, east or west); both ends dry ground you can stand in the
      middle of; everything between at least ${metres(CLEARANCE)} m below the deck over its tile's middle (a gap, not a slope).</li>
      <li>End height: the tile's middle (mean of corners), or the top of a poured foundation or finished deck on piers; an upper-floor end at that floor's height.
      Ends within ${metres(END_SLOP)} m: a level deck at their mean.</li>
      <li>${Object.values(BRIDGES).filter((b) => b !== AQUEDUCT).length} kinds:
      ${listed(Object.values(BRIDGES).filter((b) => b !== AQUEDUCT).map((b) => `<b>${b.name.toLowerCase()}</b> (${billIn(b.bill)} a span${b.tool === 'trowel' ? ', trowel' : ''}): <b>${b.span}</b> tiles, ${b.carts ? 'carries a cart' : 'foot traffic only'}`))}.</li>
      <li><b>Ramp</b> (ends further apart): rises evenly, at most <b>${metres(RAMP_SLOPE)} m</b> per tile of deck, or refused with the tiles needed. A storey is ${metres(WALL_HEIGHT)} m:
      one storey needs at least ${rampTiles(WALL_HEIGHT)} tiles of deck;
      ${((up: number) => `${up} storeys (ground to storey ${up + 1}) at least ${rampTiles(up * WALL_HEIGHT)}`)(2)}.
      Ends may be on different storeys or one on the ground; you walk it at the storey you stepped on from and step off at the far end's storey.
      Cost: a span's bill per tile of deck. Carries a cart only with both ends on the ground. Drawbridges are always level.</li>
      <li>Ends may also be a finished upper floor (jetty floors included) or a finished deck on piers. Not inside a building on a ground floor laid on the ground,
      not on another bridge's end, never through a wall (out through a doorway, archway or open side). Nothing is built on a landing tile.</li>
      <li>Built a span at a time like a wall, one unit an action. Nothing crosses until the last span is decked.</li>
      <li><b>${BRIDGE_PULL?.label}</b>: half the materials back; within ${PULL_REACH} tiles of the middle of either end. Either end on a settlement: founder and ranks with
      ${POWER.shape.label} only; elsewhere anybody. Boats pass underneath.</li>
    </ul>
    <h4>Drawbridge</h4>
    <ul>
      <li>Open ground to open ground, neither end in a building, at most ${BRIDGES.draw.span} tiles of deck. First span also takes ${billIn(BRIDGES.draw.winch ?? [])}
      (hinge, gallows, winch, chains). Hinged at the end it was set out from, where its winch stands.</li>
      <li>${gateReach('raise_drawbridge') === 0 ? 'On that tile' : `Within ${gateReach('raise_drawbridge')} tiles of that tile`}:
      <b>Raise the drawbridge</b> ${gateJobWords('raise_drawbridge', goSeconds)}; <b>Lower the drawbridge</b> ${gateJobWords('lower_drawbridge', goSeconds)}.</li>
      <li>Raised: nobody, no cart, no wildermon crosses; its hinge is shut; blocks sight. Only what is under the span remains; anybody on the deck as it rises is left in it.</li>
      <li>A moat or ditch under it blocks people only where too steep to climb: a tile falling more than ${metres(MAX_STAND)} m corner to corner, or a step over ${metres(MAX_STEP)} m
      between neighbouring tile middles, each +${metresFine(CLIMB_PER_LEVEL)} m per climbing level. Water stops nobody (swum).</li>
      <li>Lowered: a bridge; carries a cart. Deck at the mean of its end tiles' heights (over a one-tile moat between sloping banks: halfway down).
      A foundation on each end tile (dug to bare rock, set out, poured) is level with the bank's highest corner, and so is the deck.</li>
      <li>Winch: not under a jetty; no jetty floored over it (its gallows rise higher than a storey).</li>
      <li>No padlock: anybody raises or lowers it. Padlock on the winch: raising, lowering and pulling down only by its key holder and the settlement's founder,
      on top of the usual bridge rule.</li>
    </ul>
    <h3>Aqueducts</h3>
    <h4>Setting out</h4>
    <ul>
      <li>Carries a spring's water from a pond or pool to a basin up to <b>${AQUEDUCT.span}</b> tiles off, over whatever lies between.</li>
      <li>Right-click the target tile (a pool in a foundation, a pond, a tiered fountain, or a hollow holding <b>${metres(SPRING_DEPTH)} m</b> or more over no more than ${POND_MOST} corners):
      <b>Lead an aqueduct here</b> offers the first pond or pool straight out each way within an aqueduct's span, with the reason where one will not do.
      <b>Throw a bridge across</b> does not make one.</li>
      <li>Channel height: the water level at its head when set out; fixed. The foot's water must stand no higher (a fountain holds water <b>${metres(FOUNTAIN_RIM)} m</b>
      over its ground). Everything under it at least <b>${metres(CLEARANCE)} m</b> below the channel bed.</li>
      <li>Refused: anything bridged or built in the way; a tree or bush under a span; a bridge at either end. On a settlement, only its builders lead water from or to it.</li>
      <li>One aqueduct per pond or pool: the first takes all its water; a second from the same water is refused.</li>
      <li>Built like a bridge, a span at a time, a unit an action, trowel: ${billIn(AQUEDUCT.bill)} a span, masonry difficulty ${AQUEDUCT.difficulty}.</li>
      <li><b>${AQUEDUCT_PULL?.label}</b>: half back; within ${PULL_REACH} tiles of the middle of either end; on a settlement, builders only.
      Gathers moss like a stone arch (see Ivy and moss on old stone).</li>
    </ul>
    <h4>Around it</h4>
    <ul>
      <li>Not walkable along its top. Passable through its arches across its run; once any stone is laid, its piers block travel along it.</li>
      <li>Ground under the arches: walked, worn and climbed as before. Under a span: no planting, building plans, poured foundations, pools or self-seeded trees.</li>
    </ul>
    <h4>Flow</h4>
    <ul>
      <li>Runs while a spring's pond or pool at its head stands at the channel's height or higher: <b>all</b> the water that would go over that lip goes along it; the stream beyond
      dries up, with every pond only it kept.</li>
      <li>Channel: <b>${CHANNEL_WIDE * TILE_METRES} m</b> wide, water <b>${metres(CHANNEL_DEEP)} m</b> deep, at ${RUN_RATE} tiles a second:
      <b>${AQUEDUCT_LPS} litres a second</b> (${AQUEDUCT_FLOW} a minute); ${1 / RUN_RATE} s per span.</li>
      <li>Into a <b>pool</b>: full at once; overflows its lowest edge as if a spring rose in it (never the edge its end pier stands on, nor edges between tiles of its line).</li>
      <li>Into a <b>hollow</b>: fills at the channel's rate (${CORNER_LITRES} litres per corner under water per ${metres(HEIGHT_UNIT)} m over that corner), then spills over its lip; at once if a spring's
      pond already stands there.</li>
      <li>Into a <b>fountain</b>: +${AQUEDUCT_LPS} litres a second over its own well; empty to full in ${+((furnitureDef('fountain').well ?? 0) / AQUEDUCT_LPS).toFixed(2)} s.</li>
      <li>Onto bare ground: runs downhill from the tile's lowest corner.</li>
      <li>The last-span message and its menu name the outcome and a hollow's fill time. A spring dug in its head pond or pool says its water goes along it.</li>
      <li>Head water below the channel (spring stopped, pond cut lower): runs dry; hollows it filled empty; a foot pool keeps its water but stops overflowing; a fountain is back to
      its well.</li>
      <li>Fountain removed: water pours onto that tile and away from its lowest corner. Pool filled in: lands on the foundation and leaves over its lowest edge.
      Fountain set back: fed again.</li>
      <li>Menu gives the reason it is dry: no spring water at its head, head water under the channel, or another aqueduct from the same water first.</li>
    </ul>
    <h3>Ivy and moss on old stone</h3>
    <ul>
      <li><b>Ivy</b>: every finished wall, fence and half wall of ${listed(WALL_MATERIALS.filter((m) => m.kind === 'stone').map((m) => m.name.toLowerCase()))}; up from the foot and
      down from the top where nothing stands on it; never on doorways, arches, windows or gates.</li>
      <li><b>Moss</b>: paving joints (${listed(Object.values(TILE_DEFS).filter((d) => d.paved).map((d) => d.name.toLowerCase()))}), poured foundations,
      ${listed(FURNITURE.filter((f) => f.mossy).map((f) => aOrAn(f.name)))}, ${aOrAn(BRIDGES.stone.name)}, ${aOrAn(BRIDGES.aqueduct.name)}.</li>
      <li>Bare when built, laid, set down or poured; grows a day at a time for <b>${GREEN_DAYS} days</b> (a day = ${GREEN_DAY / HOUR} hours real time), then stops.
      Things standing before this existed started bare that day. Island: one clock for everybody.</li>
      <li>Cover = days ÷ ${GREEN_DAYS} × pace (speed multiplier). Pace: <b>${GREEN_SUN}</b> for tops and south or east faces; <b>${+(GREEN_SUN + GREEN_SHADE).toFixed(2)}</b> for north or west faces;
      <b>+${GREEN_WET}</b> on a water tile, ${percent(1 / GREEN_WET_REACH)} of that less per tile further off, none at ${GREEN_WET_REACH} tiles.</li>
      <li>End result: south or east face ${percent(GREEN_SUN)} covered; north or west face covered after ${coveredBy(GREEN_SUN + GREEN_SHADE)} days; facing water after
      ${coveredBy(GREEN_SUN + GREEN_SHADE + GREEN_WET)}.</li>
      <li><b>${CLEAR_IVY.label}</b> (${aOrAn(itemDef(CLEAR_IVY.tool ?? '').name)}): right-click a wall, choose the side; every storey on that side at once.
      <b>${SCRUB_MOSS.label}</b> (${aOrAn(itemDef(SCRUB_MOSS.tool ?? '').name)}): right-click the paving or foundation (both where a tile has both), statue, arch or aqueduct.</li>
      <li>Either: ${dur(goSeconds(CLEAR_IVY.baseTime))} an action with a tool of no quality, less with better; ${percent(CLEAR_IVY.stamina)} stamina. Leaves bare stone that starts again.
      Nothing under a day old is cleared.</li>
      <li>On a settlement: founder and ranks with ${POWER.shape.label} only; elsewhere anybody.</li>
    </ul>
    <h3>Boats</h3>
    <ul>
      <li>${BOATS.length} hulls, all carpentry.</li>
      <li><b>Rowing boat</b>: ${bill('make_rowing_boat', true)}. Carries <b>${ROWER.capacity} things</b>; draught <b>${metres(ROWER.boat?.draught ?? 0)} m</b>; rowed: <b>body strength</b> sets speed.</li>
      <li><b>Sailing boat</b>: ${bill('make_sailing_boat', true)}. Carries <b>${SAILER.capacity}</b>; draught <b>${metres(SAILER.boat?.draught ?? 0)} m</b>; wind-driven:
      <b>body control</b> sets how much is wasted.</li>
      <li><b>Caravel</b>: ${bill('make_caravel', true)}; a whole tile. Carries <b>${SHIP.capacity}</b>; draught <b>${metres(SHIP.boat?.draught ?? 0)} m</b>;
      <b>${SHIP.boat?.speed}</b> tiles a second at fair effort (sailing boat <b>${SAILER.boat?.speed}</b>); <b>${SHIP.boat?.passengers ?? 0} passengers</b> plus the helm.</li>
      <li><b>Sailing</b> skill, rowed or sailed: +${percent(sailingPace(TRAVEL_TOP_AT / 2) - 1)} speed at ${TRAVEL_TOP_AT / 2}, +${percent(SAILING_TOP)} at ${TRAVEL_TOP_AT}.
      Trained per tile entered at the helm.</li>
      <li><b>Launch</b>: set down on deep enough water from the bank; never on land or a puddle.</li>
      <li><b>Climb aboard</b> from the shore or swimming beside her. Moves only over water deep enough: no beaching, no dragging over sandbars.</li>
      <li><b>Step ashore</b>: nearest dry ground within ${SHORE_REACH} tiles. None: <b>Go over the side</b> (into the water to swim; the boat stays).</li>
      <li><b>Come aboard as a passenger</b> (beside a caravel, or from the water): first free of ${SHIP.boat?.passengers ?? 0} deck places; you move with her only.
      Step ashore and Go over the side work as for the helm.</li>
      <li><b>Take the helm</b>: anybody aboard, when nobody holds it or its holder has gone away at sea; never from somebody present.</li>
      <li>Not picked up or turned with anybody aboard.</li>
      <li>A line cast from a boat in deep water reaches every fish, pike and sturgeon included.</li>
    </ul>
    <h3>Wind, and how a sail uses it</h3>
    <ul>
      <li>Direction and strength both wander (calm to gale within a day); computed from the clock: the same for everybody at that hour, different per island.</li>
      <li>Rowing boats ignore it. Sailing boats depend on the <b>angle</b> more than the strength: across the wind fastest; downwind steady and slower; close-hauled slow.</li>
      <li>Within ${Math.round((NO_GO * 180) / Math.PI)} degrees of the wind: <b>in irons</b>, almost no way. Upwind: <b>tack</b> (close-hauled on one side, then the other).</li>
      <li>Example: quality (QL) ${SAIL_EXAMPLE.ql} sailing boat, body control ${CHAR_START}, ${windWord(SAIL_EXAMPLE.force)}: ${sailSpeeds} tiles a second on a beam reach, running,
      close-hauled and in irons.</li>
      <li>Under sail the bars show the wind: arrow, name, direction it is from, point of sail.</li>
      <li>Sailing boat <b>holds ${SAILER.capacity ?? 0} things</b>, crates included; fully loaded she is ${percent(BOAT_LOAD_DRAG)} slower than empty.</li>
    </ul>
    <h3>Why a road is worth its stone</h3>
    <ul>
      <li>On foot, against grass: sand ${percent(ground(TileType.Sand).speed)}, laid stone ${percent(ground(TileType.Slabs).speed)}, bog ${percent(ground(TileType.Marsh).speed)}.</li>
      <li>Carts: empty rolls anywhere at its own speed; full is held to what the ground allows; in between, a straight blend (half loaded pays half).</li>
      <li>Cart or wagon quality (QL): +${percent(VEHICLE_QL_TOP)} speed at full QL, in proportion to its QL below (+${percent(vehicleQlPace(QL_TOP / 2) - 1)} at half). Counts past a team's top speed,
      as a Carpenter's mark does.</li>
      <li>Full wagon speed lost: stone slabs and cobble <b>nothing</b>; packed dirt ${frac(rollCost(TileType.PackedDirt))}; grass ${frac(rollCost(TileType.Grass))};
      sand ${frac(rollCost(TileType.Sand))}; tilled field ${frac(rollCost(TileType.Field))}; <b>bog ${frac(rollCost(TileType.Marsh))}</b>.</li>
      <li>A minute of paved road takes a full wagon <b>${dur(wagonMinute(TileType.Grass))} over grass, ${dur(wagonMinute(TileType.Marsh))} through marsh</b>.</li>
      <li>Walking with a load routes like a carter (round bogs, along stone, even if longer). Empty carts go straight.</li>
      <li>The hud shows the ground's cost whenever there is one.</li>
    </ul>
    <h3>Paths worn by feet</h3>
    <ul>
      <li>${capital(listed([...WEARS].map((t) => ground(t as TileType).name.toLowerCase())))} wear: each step onto a tile adds <b>one</b>, max <b>${WEAR_MOST}</b>;
      at <b>${WEAR_TRAIL}</b> it becomes a <b>trail</b> of bare earth.</li>
      <li>At the daily reset (<b>${hudHour(TREE_DAWN_UTC)} UTC</b>): each tile loses <b>${WEAR_FALL}</b>; a trail at none grows back.</li>
      <li>Walked there and back ${often(TRIPS_A_DAY[0])} a day: a trail in <b>${daysToTrail(STEPS_A_TRIP * TRIPS_A_DAY[0]) ?? 0} days</b>;
      ${often(TRIPS_A_DAY[1])} a day: <b>${daysToTrail(STEPS_A_TRIP * TRIPS_A_DAY[1]) ?? 0}</b>;
      ${daysToTrail(WEAR_FALL) === null ? `crossed ${often(WEAR_FALL)} a day: never wears through, but keeps an existing trail open` : `crossed ${often(WEAR_FALL)} a day: wears through in ${daysToTrail(WEAR_FALL) ?? 0} days`}.</li>
      <li>Unwalked trail: gone within <b>${Math.ceil(WEAR_MOST / WEAR_FALL)} days</b>. Examine shows a tile's wear.</li>
      <li>Only your own feet wear it: not riding, a cart seat, a deck, a bridge or an upper floor. Paved, built-on, tilled or planted ground and ground under a building or
      foundation never wears.</li>
      <li>Trail: walked and rolled like packed dirt (${percent(ground(TileType.Trail).speed)} of grass speed on foot; full wagon loses ${frac(rollCost(TileType.Trail))});
      dug, packed and paved like it. No flowers.</li>
    </ul>
    <h3>Wildflowers</h3>
    <ul>
      <li>Grass flowers in ${listed(FLOWER_SEASONS)}, in drifts fixed by location (the same for everybody).</li>
      <li>Max per tile in a drift: <b>${FLOWER_MOST.summer} clumps</b> in summer (widest drifts), <b>${FLOWER_MOST.spring}</b> in spring; none in autumn or winter.</li>
      <li>Grass only: never lawn, steppe, tundra, moss, trail, field, paving, or under a building.</li>
      <li><b>Pick flowers</b> (bare hands): a <b>wildflower</b> per clump, quality (QL) your foraging; trains foraging. The tile is bare for everybody until the first day of the
      next ${SEASONS[0]}.</li>
      <li>Use: <b>${DYESTUFF_OF.get('wildflowers')?.primary} dye</b>: ${bill(dyeRecipeId('wildflowers'))} boil into ${BOIL_LITRES} litres (${workedAt(dyeRecipeId('wildflowers'))});
      ${kgSaid(dyeGrams(BOIL_LITRES, DYE_LITRES_PER_KG))} kg, ${kgSaid(dyeGrams(1, DYE_LITRES_PER_KG))} kg per litre of lye.</li>
    </ul>
    <h3>Bees</h3>
    <ul>
      <li><b>Skep</b>: ${bill(`make_${SKEP}`)} (${workedAt(`make_${SKEP}`)}, ${itemDef(recipe(`make_${SKEP}`).tool ?? '').name.toLowerCase()}). Set down like furniture.</li>
      <li>Range: <b>${SKEP_REACH} tiles</b> each way (a square ${2 * SKEP_REACH + 1} tiles across).</li>
      <li>Output: <b>a honey per ${SKEP_CLUMP_HOURS} hours per flowering clump</b> in range; <b>a beeswax per ${SKEP_WAX_EVERY} honey</b>.
      ${listed(BEE_CLUMPS.map((n) => `${n} clumps: ${skepRateSaid(n, 'summer')} honey an hour (full in ${dur((SKEP_HOLDS / skepRate(n, 'summer')) * SKEP_HOUR)})`))}.</li>
      <li>Holds <b>${SKEP_HOLDS} honey</b> (and ${skepWax(SKEP_HOLDS)} beeswax); stops when full.</li>
      <li>Clumps counted per season as Pick flowers finds them: picked tiles and tiles under buildings count none. Nothing in
      ${listed(SEASONS.filter((x) => !FLOWER_SEASONS.includes(x) && x !== SKEP_IDLE))} (no flowers), nothing in ${SKEP_IDLE} regardless.</li>
      <li>Fills on the wall clock, while you are away too.</li>
      <li><b>Take honey</b> within ${STORE_REACH} tiles: every whole honey and its beeswax, at your ${(SKILL_BY_ID.get(SKEP_SKILL)?.name ?? SKEP_SKILL).toLowerCase()} with the skep
      as the tool (its quality (QL) counts as a tool's); trains ${(SKILL_BY_ID.get(SKEP_SKILL)?.name ?? SKEP_SKILL).toLowerCase()}. Restarts empty; a part honey is lost.</li>
      <li>Who may take: whoever set it down, and anybody of the settlement it stands on.</li>
      <li><b>Examine</b>: clumps in reach this season, honey an hour, contents, capacity.</li>
      <li>Picked up and set down: restarts empty. Not allowed in a cellar.</li>
    </ul>
    <h3>Mote swirls and elementalism</h3>
    <ul>
      <li>At each daily reset (${hudHour(TREE_DAWN_UTC)} UTC): the day's <b>mote swirls</b> vanish; ${SWIRLS_A_DAY} new ones appear on random tiles, land or water; never under a tree,
      inside a building, or on a tile that has one.</li>
      <li>Element: on water, <b>water</b>. On land: <b>dark</b> ${percent(SWIRL_DARK)}, <b>light</b> ${percent(SWIRL_LIGHT)}, otherwise the island's:
      ${listed(REGIONS.map((R) => `<b>${ISLAND_ELEMENT[R.key]}</b> on ${islandName(R.name)}`))}.</li>
      <li><b>Collect motes</b> (bare hands, beside it; from the bank, swimming or a boat on water): motes of its element by elementalism before the action:
      ${listed(MOTE_COUNTS.map((n) => `${n} at elementalism ${n === MOTES_LEAST ? `under ${MOTES_STEP}` : `${(n - MOTES_LEAST) * MOTES_STEP}${n === MOTES_MOST ? ' and up' : ''}`}`))};
      Quality (QL) = your elementalism.</li>
      <li>Then gone for everybody: the first to finish gets it; others are told it is gone.</li>
      <li>Trains <b>elementalism</b> (only source): about ${listed([1, 20, 50].map((v) => `+${skillGain(v, 1, 1).toFixed(2)} at ${v}`))}.</li>
    </ul>
    <h3>Runestones and the Telestone</h3>
    <ul>
      <li>${RUNESTONES.length} <b>Runestones</b> on the Crescent's inner bay shore, ${STONE_SPAN} by ${STONE_SPAN} tiles each:
      ${listed(RUNESTONES.map((r) => `<b>${r.name}</b> (${r.x}, ${r.y})`))}. On the map from the start.</li>
      <li>Impassable; nothing dug, built, planted or set down on its ${STONE_SPAN * STONE_SPAN} tiles. Hover or Examine names it.</li>
      <li>Meditation gain ${mul(SIT_WORTH.stone)} on a rug within ${SIT_WORTH.stoneReach} tiles (Meditation, below).</li>
      <li><b>Telestone</b>: ${bill('make_telestone')}, ${workedAt('make_telestone')}. <b>Travel to a Runestone</b> on it in the pack, pick a stone: instant, onto a free tile beside it
      (dry, no building, no more than ${metres(LANDING_STAND)} m between highest and lowest corner; the middle of its south side tried first).</li>
      <li>Reach (straight line to the stone's middle): ${TELE_NEAR} tiles at quality (QL) ${TELE_QL_LOW}, ${TELE_FAR} tiles at QL ${TELE_QL_HIGH}, ${TELE_RANGE_STEP.toFixed(1)} tiles more per QL between.</li>
      <li>Cooldown: ${dur(TELE_SLOW)} at QL ${TELE_QL_LOW}, ${dur(TELE_FAST)} at QL ${TELE_QL_HIGH}, ${(TELE_REST_STEP / 60).toFixed(1)} minutes less per QL between
      (${[25, 50, 75].map((q) => `QL ${q}: ${Math.floor(telestoneRange(q) + 0.5)} tiles and ${timeWords(telestoneRest(q))}`).join('; ')}).
      Yours, set by the stone used: carrying several does not help. Not used up.</li>
      <li>Refused while: fighting or hunted; driving, pulling, riding or aboard anything; swimming; overloaded; a wildermon follows you; mid-action.</li>
    </ul>
    <h3>Enchanting</h3>
    ${enchantingHelp()}
    <h3>Large carts and wagons</h3>
    <ul>
      <li><b>Driven</b>: a wildermon in the traces, you on the seat; the load does not slow the wheels.</li>
      <li>Both: <b>rough carpentry</b>, from parts:</li>
    </ul>
    <ul>
      <li><b>Large wheel</b>: ${bill('make_large_wheel', true)}, with a mallet.</li>
      <li><b>Big axle</b>: an <b>axle mould</b> ${mouldNote('axle_mould')}.</li>
      <li><b>Metal ribbon</b>: a <b>ribbon mould</b> ${mouldNote('ribbon_mould')}.</li>
      <li><b>Yoke</b>: ${bill('make_yoke')}, stitched with an awl. One per hitch.</li>
    </ul>
    <ul>
      <li><b>Large cart</b>: ${bill('make_large_cart', true)}. Holds <b>${CART.capacity} things of any weight</b>; ${CART.vehicle?.yokes ?? 0} yokes;
      ${CART.vehicle?.needs ?? 0} wildermon move it, ${CART.vehicle?.yokes ?? 0} faster.</li>
      <li><b>Wagon</b>: ${bill('make_wagon', true)}. Holds <b>${WAGON.capacity} things</b>; needs <b>${WAGON.vehicle ? teamSaid(WAGON.vehicle) : ''} yokes</b> filled to move.</li>
      <li><b>Hitch</b> (from its menu, beside it): a tamed wildermon with you or a settlement worker; one in a wildermon crate is let out first. Then <b>take the reins</b>.</li>
      <li>Pace (speed multiplier): the team's speed and number, and hunger (a hungry one is slower).</li>
      <li><b>Driving</b> (the driver): team pace +${percent(drivingPace(TRAVEL_TOP_AT / 2) - 1)} at ${TRAVEL_TOP_AT / 2}, +${percent(DRIVING_TOP)} at ${TRAVEL_TOP_AT}; trained per tile entered
      on the seat. A ${SPECIES.seavic.name} pair outruns walking; ${WAGON.vehicle?.needs ?? 0} ${SPECIES.quarra.name}s do not, but shift ${WAGON.capacity ?? 0} bricks.</li>
      <li>Draught wildermon train <b>climbing</b> hauling over rough ground; the team's skill sets wheel speed and the steepest step taken.</li>
      <li><b>${SPECIES.roxxen.name}</b>: learns <b>driving</b> instead, ${LEARNS_SAYS.pull} (${percent((PULL_LEARN * LEARN_PACE.pull) / KNACK_GO)} of an action); its driving counts where
      another wildermon's climbing does. Standing still, in or out of the traces: no learning.</li>
      <li>Open ground only: no fords, garden steps or steep ground. Indoors through an <b>arch</b>, <b>double door</b> or <b>gate</b>, never a plain door.</li>
      <li>Indoors: up a finished <b>wide staircase</b> from its foot, onto finished floors of that storey; no ${SINGLE_STAIRS_NAME}, ladder or roof; never over a staircase's rails.
      The team goes with it; hitched and unhitched on the ground floor only.</li>
      <li>Cannot be picked up with anything on it or in the yokes.</li>
      <li>In the traces <b>until taken out</b> (one from its own menu, or all from the vehicle's): goes where the vehicle goes; no following, working, bell, wandering;
      cannot be crated, posted, released or culled; <b>no hunger</b> (feeding still fills it); <b>never targeted</b>.</li>
      <li>A hitched companion <b>no longer counts as following you</b>: the next can come out of its crate.</li>
      <li><b>Hitch to the traces</b> (cart or wagon menu): lists your wildermon that fit, including those in wildermon crates in your pack or within reach (crate straight to yoke).</li>
      <li>Unhitched: follows you only if nothing else does; the rest go into empty wildermon crates in your pack; too few crates: they stay hitched.</li>
      <li>Vehicles are <b>anybody's to use</b>: anyone at it may drive, take hold, hitch, unhitch, load, empty or pick up.</li>
      <li>Holding the reins (or a small cart's shafts): <b>gathered items go into it</b> (mining ore, stone and gems; digging dirt, sand and clay; logs, sprouts, forage, herbs,
      fruit, harvest, catch, butchering, shearing). Overflow: to your pack, with one "full" line. Boats: into your pack.</li>
    </ul>
    <h3>Water: the well and the barrels</h3>
    <ul>
      <li><b>Well</b>: masonry, ${bill('make_well')}. <b>Draws its own water</b> up to <b>${furnitureDef('well').well} litres</b>; rate set by its quality (QL).</li>
      <li>Fill a bucket or waterskin as at a shore, or <b>drink from it</b>.</li>
      <li><b>Barrels</b>: liquid only; ${BARRELS.length} sizes: ${listed(BARRELS.map((f, i) => `<b>${f.name.toLowerCase()}</b> (${f.liquid}${i === 0 ? ' litres' : ''})`))}.
      One liquid per barrel.</li>
      <li><b>Pour</b> a full bucket in: empty bucket back; on a stack, all of them in turn. Filling a bucket beside a barrel draws from the barrel.</li>
    </ul>
    <h3>Rest, and what the cooking is for</h3>
    <ul>
      <li>Sleeping in a bed banks <b>rest</b>: ${frac(REST_PER_SECOND)} the night in a perfect bed, less in poorer ones; max ${dur(REST_CAP)} held.</li>
      <li>Burns only while working; skill gain <b>${mul(REST_MULT)}</b> while it burns. Shown on the hud.</li>
      <li>Every cooked dish <b>favours one skill</b>: eating it gives a <b>meal boost</b>: skill gain ${mul(1 + BOON_BONUS)} in that skill for ${dur(DISH_SHORTEST)} to
      ${dur(DISH_LONGEST)}, by fill and quality (QL). A meal boost expires; a knack earned at work does not.</li>
      <li>Dish-to-skill pairings are fixed per island, different on each: <b>examine</b> a dish to see its skill.</li>
      <li>A second helping of the same dish resets the timer (no stacking).</li>
    </ul>
    <h3>What is actually in a meal</h3>
    <ul>
      <li>${NUTRIENTS.length} nutrients under the food bar, each fed by different food and each draining on its own over <b>${dur(NUTRIENT_HOURS)}</b>:</li>
    </ul>
    <table>
      <tr><td><b>Starch</b></td><td>bread, porridge, roots and grain</td></tr>
      <tr><td><b>Flesh</b></td><td>meat and fish; cooked meat ${mul(feeds('cooked_meat', 'flesh') / feeds('meat', 'flesh'))} the flesh of raw</td></tr>
      <tr><td><b>Fat</b></td><td>oil, nuts, cheese, butter and what is fried in them</td></tr>
      <tr><td><b>Greens</b></td><td>vegetables, fruit and berries</td></tr>
    </table>
    <ul>
      <li>Raw food: one, a little (potato ${percent(feeds('potato', 'starch'))} starch; meat ${percent(feeds('meat', 'flesh'))} flesh).</li>
      <li><b>Cooked dishes feed several, more</b>: bread ${percent(feeds('bread', 'starch'))} starch; cooked fish ${percent(feeds('cooked_fish', 'flesh'))} flesh and ${percent(feeds('cooked_fish', 'fat'))} fat.
      <b>Stew</b>: the only food feeding all ${NUTRIENTS.length}. Higher quality (QL) fills more.</li>
      <li>Anything in you <b>slows hunger and thirst</b>: full board, <b>${frac(1 - KEPT_BEST)}</b> of the normal rate (hunger bar to half in ${dur(0.5 / (HUNGER_RATE * (1 - KEPT_BEST)))}
      instead of ${dur(0.5 / HUNGER_RATE)}).</li>
      <li><b>All</b> full: skill gain <b>${frac(TABLE_BEST)} more</b>, read off the <b>lowest</b> one (one empty: nothing).</li>
    </ul>
    <h3>Money, and four ways to spend it</h3>
    <h4>Coins</h4>
    <ul>
      <li><b>A gold coin = ${GOLD} silver</b>. Prices are in silver; change comes in silver.</li>
      <li>Paying uses your largest coins first (${GOLD + 1} silver from a gold and ${POCKET} silver leaves ${POCKET - 1}).</li>
      <li><b>Struck from ${COIN_METALS.join(' or ')} only</b>, ${COINS_PER_LUMP} per lump, at an anvil with a coin die in the pack. The lump is spent every strike; a failure loses it.</li>
      <li>After the smith's check, gold quality (QL): takes the die every time at QL ${QL_TOP}, ${percent(coinPurity(QL_TOP / 2))} at QL ${QL_TOP / 2}, ${percent(1 - COIN_QL_WEIGHT)} at the bottom; linear between.</li>
      <li>Gold ore: only under the mountain of ${REGIONS.filter((R) => R.mountain?.includes('gold_ore')).map((R) => islandName(R.name)).join(' and ')}; never panned or in a hoard.</li>
      <li>Gold coins in the grass: a <b>foraging</b> action finds one one time in ${COIN_FIND_ONE_IN}, max ${COIN_FINDS_A_DAY} a day per person (daily reset (${hudHour(TREE_DAWN_UTC)} UTC) to the next).
      Your own foraging only, never a settlement worker's.</li>
      <li>Silver coins: circulate and come back as change; none are struck.</li>
    </ul>
    <h4>Market</h4>
    <ul>
      <li><b>Market</b> window (<kbd>U</kbd>) holds every way below.</li>
      <li><b>The market board</b> (at a settlement totem or mailbox): every stall on the island, location, owner, goods and prices, nearest first.
      Buy at the stall: <b>Buy</b> at its counter; the price goes from your purse to its till.</li>
      <li><b>A deal</b> (both present, within a few tiles): tick what you give, name what you want, choose who. Your side is held out of your pack while it stands (cannot be eaten,
      sold or promised elsewhere). Accepted or declined whole; you may withdraw until they answer.</li>
      <li><b>A stall</b> (you absent): nail one up, put goods on the counter, price each; sells while you are away; coins wait in its till. Only its owner takes goods back;
      a thing taken back is not for sale until priced again.</li>
      <li><b>A buy order</b> is for what nobody has put out. At a settlement totem or mailbox, <b>Orders</b> tab: a kind of thing, the lowest QL (nought: any), how many,
      silver each. The full price is taken from your purse at once and held; listed after the stalls with your name and location.</li>
      <li>Anybody else at a settlement totem or mailbox fills it, wholly or partly, paid from what it holds at once. The island picks from their pack: that kind, any material, at that QL
      or better, poorest first; never locked, worn, held, in a deal or holding anything.</li>
      <li>Goods come to you by post (any mailbox); you are told. Withdraw any time, anywhere: the rest returns to your purse; one left open for <b>${dur(ORDER_LIFE)}</b> lapses
      and refunds itself. You cannot fill your own.</li>
      <li><b>A parcel</b> (neither present): letters (${LETTER_MAX} characters) carry things, posted at a <b>mailbox</b>, collected at any other. Both ends need a box;
      without one, words only. The recipient owns it once posted.</li>
      <li><b>A wildermon</b> changes hands in its wildermon crate: in a deal, on a stall (no other store) and in the post. The new owner keeps it.
      While on offer, on a stall or in the post the crate cannot be opened and its occupant cannot be released or culled.</li>
    </ul>
    <h3>Barter</h3>
    <ul>
      <li><b>Barter</b>: things and silver with somebody beside you. Right-click them (<b>Barter with …</b>), or <b>Barter</b> beside their name in the Social window; they accept or decline.
      Within ${BARTER_REACH} tiles of each other.</li>
      <li><b>Barter</b> window: your side and theirs. Drag items from the Inventory, or pick under your side (all or part of a stack); type silver. Max ${BARTER_MOST} things a side.</li>
      <li>Both press <b>Accept</b>; any change on either side clears both. Both accepted: everything changes hands at once, or nothing.</li>
      <li>Refused (same words to both) when an item has left its owner's pack, is in a deal, worn, held or kept back, or somebody lacks the silver put in.
      Nothing is held out of the pack during a barter.</li>
      <li>Ends: either cancels; more than ${BARTER_REACH} tiles apart; somebody leaves; ${dur(BARTER_IDLE)} with no change.</li>
      <li>Never refused for weight: an overloaded pack slows you, as picking up does.</li>
    </ul>
    <h3>Who may do what on a settlement</h3>
    <ul>
      <li><b>Ranks</b>: up to ${RANK_CAP} besides the founder. Each: a name of up to ${RANK_NAME_MAX} characters (unique in the settlement), a place in the list,
      and the permissions the founder ticked.</li>
      <li>The founder is no rank: holds every permission; cannot be demoted.</li>
      <li>Settlement window, <b>Ranks</b>: highest first; click one for its permissions.</li>
      <li>Founder only: <b>New rank</b> (added at the foot, no permissions), ▲ / ▼ move, <b>Rename</b>, ✕ delete, <b>Newcomers join as</b> (the invitation rank).
      A rank somebody holds cannot be deleted (re-rank them first), nor can the newcomers' rank.</li>
      <li>List order matters for <b>${POWER.send_away.label}</b> and <b>${POWER.set_ranks.label}</b>: a rank acts only on ranks below it.</li>
    </ul>
    <table>
      ${RANK_POWERS.map((p) => `<tr><td><b>${p.label}</b></td><td>${p.rule}</td></tr>`).join('\n      ')}
    </table>
    <ul>
      <li>Disbanding: founder only (frees the founder's wildermon and tips out the founder's settlement crate). Setting wildermon to work and standing orders: founder only.</li>
      <li>Delivering to a settlement's work: every citizen, no permission needed (<b>The settlement window</b>).</li>
      <li>Starting ranks on every settlement (Mayor also holds <b>${POWER.notices.label}</b> and <b>${POWER.work.label}</b>):</li>
    </ul>
    <table>
      ${DEFAULT_RANKS.map((r) => `<tr><td><b>${r.name}</b>${r.name === NEWCOMER_RANK ? ' (newcomers)' : ''}</td><td>May ${rankMay(permsOf(r.powers))}.</td></tr>`).join('\n      ')}
    </table>
    <ul>
      <li>Without <b>${POWER.shape.label}</b>: citizens still walk it and their wildermon still work there; no digging or building.</li>
      <li>A refusal names your rank and what it may not do. Pointing at ground shows whose it is and what you may do; on a <b>stranger's</b> settlement: its name, founder,
      and walk only.</li>
      <li>Buildings on a settlement belong to every rank with ${POWER.shape.label}: several people can fill one wall's bill.</li>
    </ul>
    <h4>Settlement stores</h4>
    <ul>
      <li>Made by the founder or a rank with <b>${POWER.keep_stores.label}</b>, from any crate or holding furniture standing on the settlement except ${listedOr(NOT_A_STORE)}:
      open it, <b>Make it a settlement store</b> in its Storage window; <b>Stop it being a settlement store</b> to undo.</li>
      <li>Opens (take and put) for the founder and every citizen whose rank holds <b>${POWER.use_stores.label}</b>, padlocked or not, whoever made it; replaces
      <b>${POWER.stores.label}</b> and the padlock.</li>
      <li>Opens for nobody else, key or not. A citizen without ${POWER.use_stores.label} is told so; anybody else is told whose store it is.</li>
      <li>Moved, turned and picked up only by whoever set it down and the founder; its padlock still applies to them as on any store.</li>
      <li>Never drawn on by a craft, a build or a drop of dirt: take out what an action needs first.</li>
      <li><b>Store log</b>: every take and put (who, what, how many, when); keeps the last ${STORE_LOG_CAP}; read in the Settlement window by the founder and ranks with
      ${POWER.keep_stores.label}.</li>
      <li>No starting rank holds ${POWER.keep_stores.label} or ${POWER.use_stores.label}. Disbanding unmarks all stores.</li>
    </ul>
    <h3>Padlocks and keys</h3>
    <ul>
      <li><b>Padlock</b>: forged at a smelter, no key. <b>Fit</b> to a crate, storage furniture, a portcullis or a drawbridge winch: locks it and cuts <b>one key</b>.</li>
      <li>A key is an ordinary item; whoever holds it opens the lock. No record of who has it. Removing the padlock removes the key.</li>
      <li>On a <b>ship, wagon or cart</b>, without the key nobody takes the helm or reins, takes the shafts, boards as a passenger or picks it up.
      Stepping ashore and getting down always work.</li>
      <li>Override: the <b>founder</b> of the settlement it stands on opens anything on their land, and so does every rank given <b>${POWER.locks.label}</b>
      (no starting rank holds it).</li>
      <li>Blocks taking one item as well as emptying or putting in, on crates and furniture alike.</li>
      <li><b>Settlement stores</b> (see <i>Who may do what on a settlement</i>) ignore their padlock: the founder and ranks with <b>${POWER.use_stores.label}</b> use them
      without the key; everybody else is refused, key or not. Fitting, removing and picking up still follow the padlock rules.</li>
    </ul>
    <h3>Where creatures live</h3>
    <ul>
      <li>Every wild creature has <b>a home</b>: the patch where it was first placed. It wanders there and turns back when too far.</li>
      <li>Grazers arriving near their own kind take <b>that</b> home: herds form and move together. Hunters keep separate ranges.</li>
      <li>A hunter gives up the chase at the end of its leash <i>or</i> its furthest distance from home, whichever comes first, then returns home.
      Met at its den: long chase. Met at the edge of its range: short chase.</li>
    </ul>
    <h3>The field guide</h3>
    <ul>
      <li>Journal, <b>Field guide</b> tab (<kbd>F4</kbd>): a page for each of ${guidePages().length} creature kinds; marks <b>seen</b>, <b>tamed</b>, <b>bred</b>.</li>
      <li>Seen: one stood out of a crate within your sight (your wildermon's and settlement's sight count). Tamed: an offering took, or one taken from a trap.
      Bred: a young born to a dam you keep. Taming or breeding also marks seen; the first sighting is logged.</li>
      <li>Index: seen kinds drawn, the rest as shadows. Progress: seen of all ${guidePages().length}; tamed and bred of the ${guidePages().filter(keepable).length}
      tameable (monsters are not).</li>
      <li>A page: where it spawns and how far it keeps from home, its % of wild spawns, taming needed and accepted food, its use once yours, how it fights, carcass yield.</li>
      <li><b>Field guide</b> on any creature's menu opens its page.</li>
      <li>Kept by the island; a sighting counts only within ${MOBS_RANGE} tiles of you.</li>
    </ul>
    <h4>Track</h4>
    <ul>
      <li>On the page of a seen wildermon kind (not monsters, not shadows): reads the trail of the nearest wild one, any evolution stage. A <b>Tracking</b> action; walking pauses it.
      Kept ones are never tracked.</li>
      <li>Reach: ${TRACK_RANGE_BASE} tiles + ${TRACK_RANGE_PER} per Tracking level (${trackRange(SKILL_TOP)} at ${SKILL_TOP}); +${AWARE_TOP} at awareness ${SKILL_TOP}. Direction error: ${trackErrSays()}, evenly spread.</li>
      <li>Detail by Tracking: ${trackBandsSays().join('; ')}. North is up the map.</li>
      <li>An on-screen arrow points the read direction from where you stood for ${TRACK_SHOW} seconds.</li>
      <li>Trains Tracking: an action's worth when it finds one; ${percent(TRY_LEARN)} of one when it finds no sign.</li>
    </ul>
    <h3>What the island will not tell you</h3>
    <ul>
      <li><b>Skill is the ceiling; tool quality (QL) is the chance to reach it.</b> Tool QL sets the chance of each action: success gives your skill, failure roughly the tool's worth.
      Starting copper chisel: QL ${kitQl('chisel')}, reaching your ceiling about one action in ${Math.round(100 / kitQl('chisel'))}.
      Crafting (<kbd>R</kbd>) rows show the expected QL and mark where the tool is the limit.</li>
      <li><b>Free, instant actions teach the body nothing</b> (examining, locking, naming, choosing a stance). Only work with a cost trains.</li>
      <li><b>Carts need a double door, archway or gate</b>; never a single door. A fence with no gate traps a cart.</li>
      <li><b>Everything rots where it lies.</b> Settlement: ${frac(DEED_DECAY)} the rate; a closed, roofed room: ${frac(INDOORS_DECAY)} again; a crate or sack: lower still.</li>
      <li><b>Refusals give the reason</b> in <b>Trouble</b>: the tool, material, skill or distance at fault.</li>
    </ul>
    <h3>Walking, running, and looking into a room</h3>
    <ul>
      <li>Running animation is read from ground speed, for every person and creature; nothing to switch on.</li>
      <li>Inside a building, your room's walls between you and the camera fade (not the whole house). <kbd>X</kbd> removes every near wall everywhere.</li>
    </ul>
    <h3>Walking away from an action</h3>
    <ul>
      <li>Walking <b>pauses the work</b>: the current action goes to the front of the queue with its remaining count; the queue stays; the bar shows the count.</li>
      <li>Nothing restarts on its own: <b>Carry on</b> on the bar, or <kbd>B</kbd>. <kbd>Esc</kbd> clears the queue.</li>
    </ul>
    <h3>Improving up to a quality</h3>
    <ul>
      <li><b>Improve</b> menu, <b>Up to…</b>: name a quality (QL); works until reached, then stops. Each pass gains less as QL rises.</li>
      <li>Stops early, with a message, if your skill caps first.</li>
    </ul>
    <h3>Finding things in a store</h3>
    <ul>
      <li>Crates, cupboards, carts and bags: <b>search box</b> and the pack's <b>sort</b> (name, quality (QL), weight, damage, count).</li>
      <li>Settlement crate: ${CRATE_DEFS.plank.capacity} things of every sort the settlement produces.</li>
    </ul>
    <h3>What you can hear</h3>
    <ul>
      <li><b>Footsteps</b> by ground: grass, sand, laid stone, plank deck, snow, water each sound different.</li>
      <li><b>Work</b> sounds by skill (digging clay, picking rock, axe on wood, hammer on anvil; the anvil is the loudest).</li>
      <li>Positional, with the <b>camera as the ear</b>: pan and volume from the screen; zooming out lowers everything.</li>
      <li>Generated live from noise and oscillators; nothing downloaded.</li>
      <li>Volume: top of the Display tab in <b>Settings</b> (<kbd>O</kbd>); zero turns sound off.</li>
    </ul>
    <h3>Light after dark</h3>
    <ul>
      <li>Night takes <b>${frac(NIGHT_LOSS)}</b> of your sight. ${HELD_LIGHTS.length} hand-held lights:</li>
      <li><b>Torch</b>: ${countIn('cloth', need('make_torch', 'cloth'))} round ${countIn('shaft', need('make_torch', 'shaft'))} (${workedAt('make_torch')}).
      <b>${torchReach(LOW_QL)} to ${torchReach(TOP_QL)} tiles</b> for <b>${dur(torchBurn(LOW_QL))} to ${dur(torchBurn(TOP_QL))}</b> by quality (QL); used up when burnt out.</li>
      <li><b>Lantern</b> (${bill('make_lantern')}, ${workedAt('make_lantern')}) with a <b>candle</b> (${bill('make_candle')}, ${workedAt('make_candle')}):
      <b>${lanternReach(LOW_QL)} tiles and ${dur(candleBurn(LOW_QL))}</b> a candle at the roughest, <b>${lanternReach(TOP_QL)} tiles and
      ${dur(candleBurn(TOP_QL))}</b> at the best.</li>
      <li>Lit at anything burning you stand at (${flameSources()}) or off something alight in your hand. Burn <b>only while lit</b>; each says when it goes out.</li>
      <li>Carried lit: gives back <b>${frac(LIGHT_GIVES_BACK)}</b> of the sight darkness takes; its reach is a <b>minimum</b> on your sight.</li>
      <li>Other lights: <b>lit campfire</b> ${FIRE_REACH} tiles; <b>oven, kiln or smelter</b> in blast ${OVEN_REACH} tiles; ${GLOWING.length} glowing creatures:
      ${listed(GLOWING.map((s) => `a ${s.name.toLowerCase()} ${s.glow ?? 0} tiles`))}. No light is computed while the sun is up.</li>
      <li>A lantern on a <b>lantern post</b> or in a <b>lantern pillar</b> lights the ground round it for everybody, at its hand-held reach (see <i>Lantern posts</i>).</li>
    </ul>
    <h3>Night, and a bed to wake in</h3>
    <h4>Clock</h4>
    <ul>
      <li>Shown beside your position. A day and night: <b>${dur(DAY_SECONDS)}</b> real time; ${dur(DAY_SECONDS / 24)} per game hour.</li>
      <li>Sunset <b>${hudHour(DUSK)}</b>, sunrise <b>${hudHour(DAWN)}</b>: <b>${frac(DAYLIT)} day, ${frac(1 - DAYLIT)} night</b> (${dur(DAY_SECONDS * (1 - DAYLIT))} of real time dark a day).
      Light fades over the ${2 * TWILIGHT} game hours round sunset and returns over the ${2 * TWILIGHT} round sunrise.</li>
    </ul>
    <h4>Year</h4>
    <ul>
      <li>${SEASONS.length} seasons (${listed([...SEASONS])}) of <b>${SEASON_DAYS} days</b>, ${YEAR_DAYS} days a year.
      A year day = a clock day (<b>${dur(DAY_SECONDS)}</b>): a season <b>${dur(SEASON_SECONDS)}</b>, a year ${dur(YEAR_SECONDS)}.</li>
      <li>Counted from the first daily reset (<b>${hudHour(TREE_DAWN_UTC)} UTC</b>) of the first spring, on
      ${new Date(YEAR_FROM * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}, the same on every island (not from the clock's midnight,
      which sleeping moves). The clock line shows season and day.</li>
      <li>Evergreen: ${listed(TREE_DEFS.filter((_, i) => evergreen(i)).map((t) => t.name.toLowerCase()))} (darker in winter). Other trees: leaf out over the first
      <b>${LEAF_DAYS} days of spring</b>, full leaf in summer, turn over the first ${TURN_DAYS} days of autumn, drop over the last ${SHED_DAYS},
      <b>bare in winter</b>.</li>
      <li>Every tree old enough to fruit <b>flowers all ${SEASON_DAYS} days of spring</b>; bears in its own seasons (<i>Fruit trees</i>).</li>
      <li>Bushes bare in winter: ${listed(BUSH_DEFS.filter((b) => !BUSH_EVERGREEN.has(b.name)).map((b) => b.name.toLowerCase().replace(' bush', 's')))};
      evergreen: ${listed(BUSH_DEFS.filter((b) => BUSH_EVERGREEN.has(b.name)).map((b) => b.name.toLowerCase().replace(' bush', '')))}.
      Roses and lavender flower from day ${BUSH_FLOWER_FROM} of spring to the end of summer; the thorn through spring.</li>
      <li>Leaves and flowers are visual only; yields and seasons: <i>Fruit trees</i>.</li>
      <li>Ambient life, visual only: <b>butterflies</b> at flowers by day, <b>dragonflies</b> over ponds, pools and streams morning to dusk, <b>fireflies</b> over grass near
      trees and water at night: ${lifeSeasons()}.</li>
    </ul>
    <h4>Beds</h4>
    <ul>
      <li><b>Make this your home</b> (bed or cot): where you wake, whatever happens.</li>
      <li><b>Sleep until morning</b> (after dark): wind restored, some damage mended; better bed, better night.</li>
      <li>Island: the night cannot be skipped; you wake rested at the same clock time.</li>
      <li>You wake hungry and thirsty.</li>
      <li>Tailor: <b>tent</b>, ${bill('make_tent')}, with a needle. Set down anywhere; sleeps as a bed: ${percent((furnitureDef('tent').bed ?? 0) / (furnitureDef('bed').bed ?? 1))} of a bed
      of its quality (QL).</li>
    </ul>
    <h3>Finding things, and moving them in bulk</h3>
    <ul>
      <li><b>Stores</b> window (<kbd>U</kbd>): every container you own, nearest first, with fill and contents. Typing narrows to stores holding it, with counts.
      <b>Walk there</b>; <b>Open</b> when beside it.</li>
      <li>Open container footer: <b>Take all</b> (into your pack); <b>Put all in</b> (everything loose in your pack); <b>Put in what it holds</b> (only kinds already inside).
      Items <b>kept back</b> and worn items never move.</li>
      <li><b>Inventory</b>: sort by name, quality (QL), weight, damage or count; grouped by kind or flat.</li>
      <li><b>Pick up everything here</b>: your tile and the ${((2 * Game.SWEEP + 1) ** 2 - 1)} round it at once, nearest pile first.</li>
    </ul>
    <h3>Keeping something back</h3>
    <ul>
      <li><b>Keep this back</b> (right-click in the pack): never spent: not used by recipes, bait or feeding; cannot be dropped, sacrificed, melted, sold, bartered or bulk-moved.</li>
      <li>Still usable as a tool. <b>Put it back in the pack</b> undoes it. Shown as <i>kept back</i>.</li>
    </ul>
    <h3>What your back will take</h3>
    <ul>
      <li>Carry limit: <b>${CARRY_BASE} kilos</b> + <b>${CARRY_PER_STRENGTH} kilos</b> per point of <b>body strength</b>
      (${CARRY_BASE + CHAR_START * CARRY_PER_STRENGTH} at the start, ${CARRY_BASE + TOP_SKILL * CARRY_PER_STRENGTH} at ${TOP_SKILL}).</li>
      <li>Over it: slower, and more wind per action, rising with the excess, as armour does. ${OVER_EXAMPLE} kilos over a starting limit drags like about
      ${Math.round(overDrag(OVER_EXAMPLE, CARRY_BASE + CHAR_START * CARRY_PER_STRENGTH) / PLATE_SUIT)} full suits of iron plate.</li>
      <li>Past <b>${mul(CARRY_STOP)}</b> the limit: <b>${frac(CARRY_CRAWL)} pace (speed multiplier)</b>. Any amount over: every swing or draw <b>${percent(OVERBURDEN_SWING)} longer</b>.</li>
      <li>Inventory footer turns red with the excess; the bars show it too.</li>
      <li>Damage column: <b>amber past ${DAMAGE_WARN}</b>, <b>red past ${DAMAGE_BREAKING}</b>.</li>
    </ul>
    <h3>Eating, and keeping your things</h3>
    <ul>
      <li><b>Eat</b> (beside the food bar): eats your best food. <b>Feed</b> (companion line): gives it the <i>poorest</i> food it accepts.</li>
    </ul>
    <h4>Wear</h4>
    <ul>
      <li>Every use damages the tool the action needs; low quality (QL) wears far faster. Copper tool: about ${jobsAt(LOW_QL)} actions at QL ${LOW_QL}, ${jobsAt(TOP_QL)} at
      ${TOP_QL}; the material lengthens or shortens that.</li>
      <li>Damage lowers working value. Past <b>${DAMAGE_WARN} damage</b>: red warning, again every ${DAMAGE_WARN_STEP} points; at ${DAMAGE_MAX}: breaks.</li>
    </ul>
    <h4>Repair</h4>
    <ul>
      <li><b>Repair</b> (right-click anything damaged; not a fragment or an unrestored tarnished bauble, see <b>Digging up the past</b>): its own skill; an action at a time,
      removing damage and a little QL; stop any time.</li>
      <li>${WORN} damage off: ${repairGoes(startOf('repair'))} actions at repair ${startOf('repair')}, costing ${repairCost(startOf('repair'))} of QL;
      at repair ${SKILLED}: ${repairGoes(SKILLED)} actions for ${repairCost(SKILLED)}.</li>
      <li>No repair at or below QL ${REPAIR_FLOOR}.</li>
      <li>Tailor <b>Patch</b> (cloth and leather armour): one cloth or leather of the piece's material removes ${tailor('Patch').patch_item ?? 0} damage an action, no QL loss.</li>
      <li>Mender <b>repair kit</b> (${bill('make_repair_kit')}, ${itemDef(recipe('make_repair_kit').tool ?? '').name.toLowerCase()}): anybody may <b>use</b> it on anything damaged, anywhere:
      ${KIT_MEND} damage off, no QL loss; used up.</li>
      <li>Mender <b>sealant</b> (${bill('make_sealant')}): <b>Seal it</b>, one per item (one per item in a pile); a sealed item never decays anywhere. Anybody may use sealant.</li>
    </ul>
    <h3>Wounds, herbs and covers</h3>
    <h4>Wounds</h4>
    <ul>
      <li>Damage through armour leaves a <b>wound</b> of a kind, where it landed. It <b>bleeds</b> until dressed; goes <b>bad</b> if never dressed; nothing heals while any is open.
      The bars panel lists them worst first, with what each needs.</li>
      <li><b>Health</b> window (<b>${keyName(BIND_BY_ID.get('win_health')?.keys[0] ?? '')}</b>, or Health on the menu): each wound on a body figure and in a list, worst first:
      depth, health lost a minute, time to close. Click one: treatments, what each needs (dressing, bucket of lye, salve), how many you carry, how to make one,
      and a button that treats that wound (or says why not). Below: effects against and for you, and recent food.</li>
      <li>${KINDS.length} kinds, each with a suited herb: ${listed(KINDS.map((k, i) => `<b>${k.name}</b>${i === 0 ? ': ' : ' '}<b>${k.herb}</b>`))}.
      By source: hooves bruise, claws open, stings go deep and narrow; ${listed(BURNERS.map((s) => `the ${s.name.toLowerCase()}`))} burn.</li>
    </ul>
    <h4>Dressings</h4>
    <ul>
      <li><b>Bandage</b>: cloth cut ${made('make_bandage')} to a length with a knife. <b>Healing cover</b>: the herb bruised into cotton, ${made(`make_cover_${KINDS[0].herb}`)}
      a batch, <b>first aid</b>.</li>
      <li>Either stops bleeding and restores ${percent(healAmount(startOf('first_aid'), LOW_QL))} to ${percent(healAmount(TOP_SKILL, TOP_QL))} of your health at once, by first aid and quality (QL).</li>
      <li>Right-click: goes on the worst wound it would close faster than its current dressing, and names it. Rank, slowest first: ${listed(DRESSING_RANK)}.
      Only over a lower rank; refused, with the reason, when nothing would improve.</li>
      <li>Close rate: cloth ${mul(CLOSE_CLOTH / CLOSE_BARE)} that of bare. <b>Right herb</b>: ${mul(SUITS_HEAL)} the instant heal, ${mul(CLOSE_RIGHT / CLOSE_CLOTH)} cloth's close rate,
      <b>never goes bad</b>. Wrong herb: ${mul(HERB_HEAL)} the heal, ${percent(CLOSE_WRONG / CLOSE_CLOTH - 1)} faster than cloth.</li>
      <li>Chance of going bad, against an open wound: cloth ${percent(FESTER_CLOTH)}, wrong herb ${percent(FESTER_WRONG)}.</li>
      <li><b>Chirurgy</b>: every ${Math.round(CLOSE_PACE / CLOSE_PER_SKILL)} points adds the base close rate again, on every wound.</li>
      <li><b>Gone bad</b>: drains instead of closing; no dressing holds (skipped for the next worst). Scour with a bucket of <b>lye</b> first (hard first aid); it reopens and
      bleeds: dress straight after.</li>
    </ul>
    <h4>Naturalist remedies</h4>
    <ul>
      <li>Made from any of the ${KINDS.length} healing herbs; usable by anybody.</li>
      <li><b>Herb tea</b> (${recipe(`brew_tea_${KINDS[0].herb}`).inputs[0].count ?? 1} herb + a bucket of water, ${made(`brew_tea_${KINDS[0].herb}`)} cups):
      ${percent(itemDef('herb_tea').stamina ?? 0)} stamina a cup.</li>
      <li><b>Salve</b> (${recipe(`make_salve_${KINDS[0].herb}`).inputs[0].count ?? 1} herb + beeswax): on the worst dressed wound that could still go bad; while on, it never does.
      Goes over a dressing, not instead; scouring removes it.</li>
      <li><b>Tincture</b> (${recipe(`make_tincture_${KINDS[0].herb}`).inputs[0].count ?? 1} herb): ${TINCTURE_NAMES} each +${percent(TINCTURE_BONUS)} skill gain for
      ${dur(TINCTURE_SECONDS)}, alongside a meal boost for the same skill.</li>
    </ul>
    <h4>Others</h4>
    <ul>
      <li><b>Dress</b> <i>name</i><b>'s wounds</b> (right-click them, beside them): their worst wound it would close faster, at your first aid, from your pack.</li>
      <li>Naturalist <b>Field Medic</b> / Chirurgeon <b>Field Surgeon</b>: +${percent((PERK_BY_ID.get('naturalist_field_medic')?.fx['heal:others'] ?? 1) - 1)} heal on others.</li>
      <li>Wildermon: <b>Treat its wounds</b> (tame, beside it): a bandage; restores the same % of its full health. Wild creatures refuse.</li>
    </ul>
    <h3>Dying, and your grave</h3>
    <ul>
      <li>Health at zero: you <b>die</b> and wake on your landing shore, every wound closed.</li>
      <li><b>What you carried stays</b> in a <b>grave</b> where you fell: pack, held items, toolbelt, every bag and its contents.</li>
      <li>Kept on you: clothing, armour, jewel, a crate with a wildermon in it, anything offered in a deal.</li>
      <li>Died in water too deep to stand: grave on the nearest dry ground within <b>${GRAVE_REACH} tiles</b>, else where you fell. Carrying nothing: no grave.</li>
      <li>For <b>${dur(GRAVE_KEEPS)}</b> real time (online or not): yours only; nobody else opens, takes from, picks up or breaks it; they are told whose it is.</li>
      <li>Open like a chest; take one at a time or <b>Take everything</b>; nothing goes back in.</li>
      <li>Then it <b>crumbles</b> with whatever is left. One grave per death; each is on your map until it crumbles.</li>
    </ul>
    <h3>What quality is worth</h3>
    <ul>
      <li><b>Skill is the ceiling; tool quality (QL) is the percentage chance an action comes out at your skill.</b> Otherwise: ${QL_SPREAD} the tool's QL, never above your skill.</li>
      <li>Starting hatchet: QL ${kitQl('hatchet')}, so ${frac(kitQl('hatchet') / TOP_QL)} of logs come out at your skill.</li>
      <li>No tool (picking berries, tending a field): ${QL_SPREAD} your skill, + ${QL_BARE}.</li>
    </ul>
    <h3>Rare things</h3>
    <ul>
      <li>Base odds: ${listed(RARE_STEPS.map((step, i) => `<b>one in ${Math.round(1 / rarityChance(step))}</b> ${i === 0 ? 'is ' : ''}<b>${RARITIES[step].name}</b>`))}.
      Skill, tools and metal do not change them (${Math.round(1 / rarityChance(RARITIES.length - 1))} ordinary things per ${RARITIES[RARITIES.length - 1].name} one on average).</li>
      <li><b>Rare ingredients raise them.</b> The share of a craft's used-up units that is ${listedOr(RARE_STEPS.map((step) => RARITIES[step].name))} is added to that rarity's chance:
      ${RARE_IN_EXAMPLE.units} units, one ${RARE_IN_EXAMPLE.step}: <b>+${percent(RARE_IN_EXAMPLE.more)}</b> chance of ${RARE_IN_EXAMPLE.step}.
      Checked from ${RARITIES[RARITIES.length - 1].name} down; the first hit wins.</li>
      <li>Not ingredients: tools, the station, a full bucket (it comes back). At the anvil the single casting or lump is everything: a rare one makes the result at least that rare.
      Each action says what a rare ingredient added.</li>
      <li>Effect: <b>better at its use</b> by ${listed(RARE_STEPS.map((step) => frac(RARITIES[step].boost - 1))).replace(/ and ([^,]*)$/, ' or $1')} (edge, armour, tool accuracy);
      <b>wears and rots at ${listed(RARE_STEPS.map((step) => percent(RARITIES[step].keep)))}</b> of the ordinary rate; <b>improvable past your skill ceiling</b> by
      ${listed(RARE_STEPS.map((step) => String(RARITIES[step].ceiling))).replace(/ and ([^,]*)$/, ' or $1')}.</li>
      <li>Containers (bag, crate, cupboard, weight bin, smelter charge, kiln load): +${percent(RARITY_ROOM)} capacity a step (${RARE_STEPS.map((n) => `<b>${percent(RARITY_ROOM * n)}</b>`).join(', ')}
      for rare, supreme and fantastic), at least <b>one more unit a step</b> (a kiln's ${KILN_CAPACITY}: ${listed(RARE_STEPS.map((n) => String(roomFor(KILN_CAPACITY, { rare: n }))))}).
      Kept when set down and picked up.</li>
      <li>Shown in their own colour in the pack; on the ground they glow (rare: a few motes; supreme: more over a bloom; fantastic: a gold bloom under a star).</li>
    </ul>
    <h3>Signed masterworks</h3>
    <ul>
      <li>A single item (not a pile, not furniture) made at <b>quality (QL) ${SIGN_QL} or better</b> carries its maker's name.</li>
      <li>While QL ${SIGN_QL} or better, its maker only may <b>Sign</b> it (its menu): one line up to <b>${SIGN_MAX} characters</b>, cleaned like chat; no tool, no skill.</li>
      <li>Signed <b>once</b>; the line stays with the item. <b>Examine</b>: <i>Made and signed by Mira: “For Otto”.</i> No other effect.</li>
    </ul>
    <h3>Improving</h3>
    <ul>
      <li><b>Improve</b> (right-click a finished item): each pass uses a little stock; success raises quality (QL), by a lot at first and very little near the top.
      Failure damages it; past ${IMPROVE_DAMAGE} damage it must be <b>Repair</b>ed before more work.</li>
      <li><b>Starting kit cannot be improved</b> (repairable only).</li>
    </ul>
    <table>
      <tr><td><b>Metal</b></td><td><b>File</b> + <b>whetstone</b>; a lump of metal per pass</td></tr>
      <tr><td><b>Wood</b></td><td><b>Carving knife</b> + <b>file</b>; a plank or shaft</td></tr>
      <tr><td><b>Cloth</b></td><td><b>Needle</b>; a length of cloth</td></tr>
      <tr><td><b>Leather</b></td><td><b>Awl</b> + <b>needle</b>; a piece of tanned leather</td></tr>
      <tr><td><b>Stone</b></td><td><b>Chisel</b> + <b>whetstone</b>; shards</td></tr>
    </table>
    <ul>
      <li><b>Whetstone</b>: chiselled from ${bill('make_whetstone')}. <b>Needle</b>, <b>awl</b>: carved from bone with a knife. <b>File</b>: its own mould at the smelter, beaten at an anvil.</li>
      <li>Skill used: the one that makes it (blacksmithing for tools, weaponsmithing for weapons, chain and plate armoursmithing for their armour, bowyery for bows; tailoring,
      leatherworking, carpentry, fine carpentry, stonecutting for the rest).</li>
      <li><b>Max QL: that skill</b>, or ${IMPROVE_FLOOR} while the skill is lower. Improving trains the skill.</li>
    </ul>
    <h3>Ashes, lye and tanning</h3>
    <ul>
      <li><b>Ashes</b>: a <b>campfire</b>, <b>smelter</b> or <b>kiln</b> leaves one lot per ${dur(1 / ASH_RATE)} of burning. <b>Take ashes</b>, lit or cold; they accumulate.</li>
      <li><b>Bucket</b>: ${bill('make_bucket')}, mallet. <b>Fill</b> at any shore (not on dry land). <b>Empty</b> any time.</li>
      <li><b>Bucket of lye</b>: ${need('make_lye', 'ash')} lots of ashes + a bucket of water; <b>Alchemy</b>. One bucket tans one hide.</li>
      <li><b>Tanning</b> (leatherworking): raw <b>hide</b> + bucket of lye + carving knife: <b>leather</b>; the bucket comes back empty. Failure spoils the hide.</li>
      <li>Leather: cap, jerkin, sleeves, trousers, boots; improving leather pieces.</li>
    </ul>
    <h3>Reeds, papyrus and books</h3>
    <ul>
      <li><b>Reed beds</b> (shallows): cut with a knife for reeds; regrows before it can be cut again.</li>
      <li><b>Papyrus</b>: ${countIn('reed', need('make_papyrus', 'reed'))} + a bucket of water: ${made('make_papyrus')} sheets; <b>Papyrusmaking</b>; only standing at a <b>paper press</b>
      on the ground (${bill('make_paper_press')}, mallet, ${workedAt('make_paper_press')}).</li>
      <li><b>Ink</b> (alchemy): a gland + ${need('make_ink', 'ash')} lots of ashes + a bucket of water: ${made('make_ink')} lots of ink.</li>
      <li><b>Book</b>: ${need('make_book', 'papyrus')} sheets, ${need('make_book', 'leather')} leather boards, a lot of ink, a needle.</li>
      <li><b>Study</b>: ${dur(goSeconds(STUDY_TIME))} an action; trains <b>mind logic</b> (queue size); wears the pages. At a <b>lectern</b>: skill gain ${mul(LECTERN_GAIN)}.</li>
      <li>Artisan <b>trade book</b> (${bill(`write_trade_book_${TRADE_BOOK_SKILLS[0]}`)}, needle): on any skill they have at ${TRADE_BOOK_AT}; studying trains that skill instead of
      mind logic, same amount an action. Anybody may read it. Artisan perks can raise gain or lower wear; Examine gives the figures.</li>
    </ul>
    <h3>Maps</h3>
    <ul>
      <li>Your map (<kbd>M</kbd>) shows only ground you have seen; studying a <b>map</b> adds a square without walking it.</li>
      <li><b>Draw a map</b> (right-click papyrus): ${dur(goSeconds(DRAW_TIME, HELP_SKILL))} at ${CHART_SKILL_NAME} ${HELP_SKILL}; uses the sheet; covers the square round your tile.</li>
      <li>Quality (QL): ${percent(QL_LOW)} to ${percent(QL_LOW + QL_SPAN)} of your ${CHART_SKILL_NAME} + ${QL_BARE}; max the sheet's QL.</li>
      <li>Reach: ${CHART_LEAST} tiles each way, one more per ${CHART_QL_PER_TILE} QL: ${chartReach(HELP_SKILL)} each way (${chartSide(chartReach(HELP_SKILL))} by ${chartSide(chartReach(HELP_SKILL))})
      at QL ${HELP_SKILL}; ${chartReach(QL_TOP)} (${chartSide(chartReach(QL_TOP))} by ${chartSide(chartReach(QL_TOP))}) at QL ${QL_TOP}. Name: place and reach; Examine: the square and
      tiles added.</li>
      <li><b>Study map</b> (${dur(goSeconds(STUDY_MAP_TIME))}): every tile of the square onto your map, as it is now. Not used up. Island: kept across sessions.</li>
      <li><b>Copy map</b> (${dur(goSeconds(COPY_TIME, HELP_SKILL))} at ${CHART_SKILL_NAME} ${HELP_SKILL}): uses your best papyrus; QL by your check, max the original's and the sheet's;
      a lower-QL copy reaches less. Maps sell, drop and store like anything else.</li>
    </ul>
    <h3>Titles and knacks</h3>
    <ul>
      <li><b>Titles</b>: every skill at ${listed(TITLE_STEPS.map(String))} (${titlesFor('carpentry').map((t) => t.name).join(', ')}). Wear <b>one</b>, chosen in Skills (<kbd>K</kbd>),
      shown beside your position. Click it to remove.</li>
      <li><b>Knack</b>: <b>one action in ${KNACK_ODDS}</b> in any skill at any level. Lands on that skill ${frac(KNACK_HOME)} of the time, otherwise a neighbouring skill (carpentry may give bowyery).</li>
      <li>Each knack: +${frac(KNACK_BONUS)} on all that skill's gains, permanent. Max <b>${KNACK_CAP}</b> a skill (${mul(1 + KNACK_CAP * KNACK_BONUS)} on every gain).
      Stacks with rest and meal boosts. Skills window shows each skill's count.</li>
      <li>Swimming, climbing, driving, sailing count for knacks as a fraction of an action: a second in deep water ${percent(SWIM_LEARN / KNACK_GO)}; a tile driven or sailed
      ${percent(DRIVING_LEARN / KNACK_GO)}${SAILING_LEARN === DRIVING_LEARN ? '' : ` and ${percent(SAILING_LEARN / KNACK_GO)}`}; a steep step ${percent((CLIMB_LEARN + CLIMB_LEARN_FROM * CLIMB_LEARN_STEEP) / KNACK_GO)}
      to ${percent((CLIMB_LEARN + CLIMB_LEARN_STEEP) / KNACK_GO)}, steeper more. One knack per ${Math.round(KNACK_ODDS * KNACK_GO / SWIM_LEARN).toLocaleString('en')} seconds of swimming;
      per ${Math.round(KNACK_ODDS * KNACK_GO / DRIVING_LEARN).toLocaleString('en')} tiles driven.</li>
      <li>Pure chance per action: no milestones, no slowdown at high levels.</li>
      <li>Meal boost: skill gain ${mul(1 + BOON_BONUS)} instead of +${frac(KNACK_BONUS)}, but expires after ${dur(DISH_SHORTEST)} to ${dur(DISH_LONGEST)}. They stack, with rest too.</li>
    </ul>
    <h3>Dye</h3>
    <h4>Boiling</h4>
    <ul>
      <li>Undyed: cloth wool-white, leather hide-brown.</li>
      <li>Boiled dye is <b>${listed(PRIMARIES.map((p) => p))}</b> only. Boil a dyestuff in a bucket of <b>lye</b>: <b>${kgSaid(dyeGrams(1, DYE_LITRES_PER_KG))} kg per litre of lye</b>, by weight;
      litres of dye = litres of lye. A bucket is <b>${BOIL_LITRES} litres</b>: ${kgSaid(dyeGrams(BOIL_LITRES, DYE_LITRES_PER_KG))} kg makes ${BOIL_LITRES} litres, pure, quality (QL) your alchemy.</li>
      <li>Uses the fewest whole items that weigh enough, and reports the count:
      ${listed(PRIMARIES.map((p) => `${p} from ${listedOr(DYESTUFFS.filter((d) => d.primary === p)
        .map((d) => `${countIn(d.from, boilCountPlain(d.from))} at ${kgSaid(gramsOf(d.from))} kg each (alchemy ${d.difficulty})`))}`))}.
      Short: reports the weight needed and held.</li>
    </ul>
    <h4>Mixing</h4>
    <ul>
      <li>Pour a bucket of dye into an empty or dye barrel: red, yellow and blue parts and QL averaged by litres.
      ${MIX_SHOWN} litres of red + ${MIX_SHOWN} of blue at QL ${DYE_QL_PURE}: ${MIX_SHOWN * 2} litres of ${mixSaid(mixDye(pureDye('red', DYE_QL_PURE), MIX_SHOWN, pureDye('blue', DYE_QL_PURE), MIX_SHOWN))}
      at QL ${DYE_QL_PURE}.</li>
      <li>Fill a bucket from a dye barrel: up to a bucket's worth. A part-full bucket of dye fills from a dye barrel and mixes.</li>
      <li>Dye never shares a barrel with anything else.</li>
      <li>At QL ${DYE_QL_PURE}: red ${mixSaid(pureDye('red', DYE_QL_PURE))}, yellow ${mixSaid(pureDye('yellow', DYE_QL_PURE))}, blue ${mixSaid(pureDye('blue', DYE_QL_PURE))};
      red + yellow ${mixSaid(equalParts(['red', 'yellow']))}; yellow + blue ${mixSaid(equalParts(['yellow', 'blue']))}; red + blue ${mixSaid(equalParts(['red', 'blue']))};
      all ${PRIMARIES.length} ${mixSaid(equalParts(['red', 'yellow', 'blue']))}.</li>
      <li><b>QL = brightness</b> only: black at QL ${DYE_QL_BLACK}, the mix at ${DYE_QL_PURE}, white at ${DYE_QL_WHITE}, linear between. Red at QL ${DARK_SHOWN}: ${mixSaid(pureDye('red', DARK_SHOWN))};
      at QL ${LIGHT_SHOWN}: ${mixSaid(pureDye('red', LIGHT_SHOWN))}. Low alchemy gives dark dye; mix in brighter dye to raise it.</li>
      <li><b>Examine</b> a bucket or barrel of dye: hex colour, QL, litres, mix.</li>
    </ul>
    <h4>Dyeing</h4>
    <ul>
      <li>Litres by size (a litre = a kilo): <b>${DYE_LITRES.garment}</b> garment, cloth, bag, saddle or bridle; <b>${DYE_LITRES.banner}</b> banner or flag; <b>${DYE_LITRES.sail}</b>
      sailing boat; <b>${DYE_LITRES.ship}</b> caravel; <b>${DYE_LITRES.wall}</b> a side of a wall or a tile of floor; <b>${DYE_PANE_LITRES}</b> a ${itemDef(TINTED_PANE).name.toLowerCase()}.</li>
      <li>From <b>one</b> source only: a bucket of dye loose in your pack (not in a bag, not kept back), or a dye barrel within <b>${CRAFT_REACH} tiles</b> that is yours or on your
      settlement. A bucket holds ${BUCKET_LITRES} litres, so ${listed((Object.keys(DYE_LITRES) as Array<keyof typeof DYE_LITRES>).filter((k) => DYE_LITRES[k] > BUCKET_LITRES)
        .map((k) => DYE_SIZE_SAID[k]))} ${(Object.keys(DYE_LITRES) as Array<keyof typeof DYE_LITRES>).filter((k) => DYE_LITRES[k] > BUCKET_LITRES).length === 1 ? 'needs' : 'need'} a barrel.</li>
      <li>Several sources with enough: you pick (colour, hex, QL, litres listed); one: used. Short: reports litres needed and the most any source holds.</li>
      <li>Takes the dye's exact colour; named by the nearest plain colour word; Examine gives the hex.</li>
      <li>Dyeable: cloth and leather (not metal): cloth and leather armour, cloth, sacks, satchels, backpacks, saddle, bridle, <b>banner</b>, a <b>flagpole</b>'s flag, a
      <b>sailing boat</b>'s or <b>caravel</b>'s sail, and a <b>${itemDef(TINTED_PANE).name.toLowerCase()}</b> (colours its window or bay; see Glass).</li>
      <li>Dyed chest and leg pieces show on your figure.</li>
      <li><b>Banner</b>: ${bill('make_banner')}; planted anywhere; flies its dyed colour.</li>
      <li>Boiling in lye removes dye.</li>
    </ul>
    <h3>Rope</h3>
    <ul>
      <li>Wemp, grown in a field, cut for <b>fibre</b>. Spindle: coarse yarn. <b>Rope tool</b> (${bill('make_rope_tool')}, carved): <b>rope</b>, ${need('make_rope', 'wemp')} fibres a rope,
      <b>ropemaking</b>. ${capital(countIn('rope', need('make_thick_rope', 'rope')))}: a <b>thick rope</b>.</li>
      <li>Used by: <b>bridle</b> ${need('make_bridle', 'rope')}; <b>rowing boat</b> ${need('make_rowing_boat', 'rope')}; <b>sailing boat</b> ${need('make_sailing_boat', 'rope')} and
      ${need('make_sailing_boat', 'thick_rope')} thick ropes; <b>well</b> ${countIn('thick_rope', need('make_well', 'thick_rope'))}.</li>
    </ul>
    <h3>Wool, cloth and the loom</h3>
    <ul>
      <li><b>Spindle</b> and <b>loom</b>: fine carpentry furniture.</li>
      <li>At the spindle: wool, cotton or wemp into <b>yarn</b>. At the loom: ${need('weave_cloth', 'yarn')} yarn into a length of <b>cloth</b>.</li>
      <li>Cloth: mattress stuffing, clothing; twisted into a <b>bowstring</b> for every bow.</li>
    </ul>
    <h3>Armour</h3>
    <ul>
      <li>Worn per piece in ${ARMOUR_SLOTS.length} places (${listed(ARMOUR_SLOTS)}); counts only where a blow lands. <b>Wear or wield</b> (right-click); the inventory marks worn items.</li>
      <li>${MADE_ARMOUR.length} craftable kinds, each with its own skill trained <b>by being hit in it</b>. Base % of a blow stopped, before quality (QL), metal and that skill:
      <b>cloth</b> (tailoring) ${percent(ARMOUR_CLASSES.cloth.soak)}; <b>leather</b> (tanned hide, knife, leatherworking) ${percent(ARMOUR_CLASSES.leather.soak)};
      <b>chain</b> (moulds, riveted at an anvil, chain armoursmithing) ${percent(ARMOUR_CLASSES.chain.soak)}; <b>plate</b> (beaten whole, plate armoursmithing) ${percent(ARMOUR_CLASSES.plate.soak)}.</li>
      <li>QL and skill raise it; damage lowers it. Wears where struck; a piece at full damage falls off.</li>
      <li>Burden (slowdown from weight carried): a full suit of iron plate: ${percent(PLATE_SUIT / (1 + PLATE_SUIT))} slower, +${percent(PLATE_SUIT)} wind per action (cloth: ${percent(ARMOUR_CLASSES.cloth.burden)}).</li>
      <li><b>Shield</b> (off hand): blocks a whole blow. ${blockSays()} No hand free for it with a two-handed weapon. Hover one in the pack for your current chance and its breakdown.</li>
    </ul>
    <h3>Weapons and the bow</h3>
    <h4>Starting a fight</h4>
    <ul>
      <li><b>Left click</b> on a wild thing that is after you, or a kind that hunts on sight: walk to it and swing (or shoot with a bow); follows it up to ${FOLLOW_RANGE} tiles.</li>
      <li><b>${keyName(BIND_BY_ID.get('fight_mark')?.keys[0] ?? '')}</b>: mark the nearest such thing within ${TARGET_RANGE} tiles, the next nearest on each press.
      <b>${keyName(BIND_BY_ID.get('fight')?.keys[0] ?? '')}</b>: attack the marked or last-clicked one.</li>
      <li>A fight jumps the queue; the current action resumes after. Clicking the ground walks out of a fight.</li>
      <li>Struck creatures that do not flee <b>hit back on their own clock</b>: hunters and monsters every ${BLOW_HUNTER} seconds, defensive kinds every ${BLOW_DEFENSIVE}, others every
      ${BLOW_PREY}. Chase up to ${FIGHT_LEASH} tiles from where struck; give up at ${FIGHT_GIVE_UP} tiles away.</li>
      <li><b>Auto-retaliate</b>: bitten after ${FIGHT_BACK_STILL} seconds standing still, you fight it until dead, gone or out of reach (current action resumes after). Not while walking,
      not when already swinging at it, never against tame wildermon. Off switch: Settings, Fighting.</li>
    </ul>
    <h4>Equipment window</h4>
    <ul>
      <li><b>${keyName(BIND_BY_ID.get('win_equipment')?.keys[0] ?? '')}</b> or Equipment on the menu: you in your gear, a socket for each of ${SLOTS.length} places.</li>
      <li>Drag onto a socket or onto you (from the shelf or the pack) to equip; to the shelf to remove. Click on the shelf: equip; a double-click on a socket: remove.</li>
      <li>Shelf: each item's change against what is in its place.</li>
      <li>Tabs: every number a fight reads, from the fight's own rule: blow damage, time, hit and critical chance, reach, damage a second; hit locations and what is stopped there,
      dodge, block, stance, what gets through of each blow type, carry cost; each skill behind them, its current bonus over its start and the next level's.</li>
    </ul>
    <h4>Stance and swing</h4>
    <ul>
      <li><b>Stance</b>: button beside the health bar, or <b>${keyName(BIND_BY_ID.get('fight_stance')?.keys[0] ?? '')}</b> for the next. ${FIGHT_STANCES.map((st) => `<b>${FIGHT_STANCE_NAMES[st]}</b>: ${stanceSays(st)}`).join(' ')}</li>
      <li>Base swing time (seconds): ${listed([...WEAPONS].filter((w) => !w.ammo).sort((a, b) => a.swing - b.swing).map((w) => `${itemDef(w.id).name.toLowerCase()} ${w.swing}`))}; bare hands ${FIST.swing}.
      A bow's draw likewise.</li>
      <li>Skill shortens it as on any action (fighting for swings, archery for draws), and body control too. ${itemDef(HELP_SWORD.id).name}:
      ${HELP_SWING_AT.map((f) => `${fixed2(swingSeconds(HELP_SWORD.swing, f))} seconds at fighting ${f}`).join(', ')}. Minimum ${SWING_FLOOR.toFixed(1)} seconds.</li>
      <li>${armourSwingSays()} ${overburdenSwingSays()}</li>
      <li>Carry limit: ${CARRY_BASE} kilos + ${CARRY_PER_STRENGTH} per body strength, plus a trade perk, Power's Pack Mule and Packmule packs (What your back will take).
      Both slowdowns apply after the ${SWING_FLOOR.toFixed(1)}-second floor.</li>
      <li>Hover a weapon: its swing time in your hands and why; armour or a shield: what it adds to every swing or draw.</li>
      <li>Wind per swing or draw: ${percent(SWING_WIND)} stamina + ${percent(SWING_WIND_KG)} per kilogram in hand, before body stamina and armour. Below ${percent(TIRED_AT)} stamina:
      slower, up to ${percent(TIRED_SLOW)} at none.</li>
    </ul>
    <h4>Blows</h4>
    <ul>
      <li><b>Heavy blow</b>: ${listed(Object.values(SPECIES).filter((d) => d.heavy).map((d) => `${d.name.toLowerCase()}s`))}, every ${HEAVY_EVERY} blows. A red ring shows its reach for
      ${WIND_UP} second; lands at damage ${mul(HEAVY_HIT)} on anything still inside. Step out to avoid it.</li>
      <li>Blow types: <b>cut</b> (${blowSays('cut')}), <b>puncture</b> (${blowSays('pierce')}), <b>crush</b> (${blowSays('crush')}).</li>
      <li>Hides: ${HIDES.map((h) => `${HIDE_NAMES[h].toLowerCase()} (${listed(Object.values(SPECIES).filter((d) => d.hide === h).map((d) => d.name.toLowerCase()))}) ${hideSays(h)}`).join('; ')}.</li>
      <li>Armour by type: ${(Object.keys(ARMOUR_CLASSES) as ArmourClass[]).map((c) => `${ARMOUR_CLASSES[c].name.toLowerCase()} ${armourSays(c)}`).join('; ')}.</li>
      <li>On landing: ${listed(['mauls', 'polearms', 'knives'].map((k) => { const w = WEAPONS.find((x) => x.kind === k); return w ? `${k === 'polearms' ? 'spear' : k === 'mauls' ? 'maul' : 'knife'} ${sideOf(w)}` : ''; }).filter(Boolean))}.
      Bleeding never kills: the last point needs a blow.</li>
      <li>Arm or hand <b>wound</b>: swing time longer by the % of health it took × ${ARM_SLOW}, max ${percent(ARM_SLOW_MOST)}; leg or foot: walking likewise, max ${percent(LEG_SLOW_MOST)}.</li>
      <li>A blow from something on you that is <b>not your target</b>: +${percent(FLANK_HIT - 1)}. Each extra attacker: −${percent(CROWD_BLOCK)} shield block chance.
      Your blow on something fighting somebody else: +${percent(BLINDSIDE - 1)}.</li>
      <li><b>Dodge</b> (checked first on every creature blow): ${finePercent(DODGE_PER_CONTROL)} per body control over ${DODGE_FROM} (${percent(dodgeChance(TOP_SKILL, 0))} at ${TOP_SKILL}),
      −${finePercent(DODGE_PER_KG)} per kilogram of armour worn. Dodged: no damage; trains body control.</li>
      <li><b>Critical</b> (landed blow or shot): ${percent(CRIT_BASE)} + ${finePercent(CRIT_PER_SKILL)} per point of the weapon's subskill (${percent(CRIT_BASE + TOP_SKILL * CRIT_PER_SKILL)}
      at ${TOP_SKILL}); critical chance ${mul(CRIT_KNIFE)} with a knife. +${percent(CRIT_HIT - 1)} damage; logged; shown larger, in orange.</li>
      <li><b>Venom</b> (${listed(Object.values(SPECIES).filter((d) => d.venom).map((d) => `${d.name.toLowerCase()}s`))}): the bite's wound drains ${percent(VENOM_DRAIN)} health a second
      for ${VENOM_SECS} seconds; none while dressed.</li>
      <li><b>Burn</b> (${listed(BURNERS.map((s) => `the ${s.name.toLowerCase()}`))}): wears the armour it hits ${mul(BURN_WEAR)} as fast.</li>
    </ul>
    <h4>Display</h4>
    <ul>
      <li>Top panel: your target's or mark's health, current action, and its hide against your weapon.</li>
      <li>Health bars over everything after you; a ring at your feet fills with your swing or draw; edge arrows to attackers off screen; the edge reddens when hit.</li>
      <li>Cursor on a hunter not yet after you: a dashed ring at its notice range: ${HUNT_SIGHT} tiles, or ${listed(Object.values(SPECIES).filter((d) => d.hunter && d.notice !== undefined).map((d) => `${d.name.toLowerCase()}s ${d.notice}`))}.</li>
      <li><b>One line for a whole fight</b> (Settings): skill gains reported once, ${FIGHT_QUIET} seconds after the last blow, with duration, damage dealt and taken.</li>
    </ul>
    <h4>Packs, throwers, fleeing</h4>
    <ul>
      <li><b>Packs</b>: ${listed(Object.values(SPECIES).filter((d) => d.pack).map((d) => `${d.name.toLowerCase()}s`))}. One spawning near its kind shares its home, max ${PACK_MOST}
      a home, staying within ${PACK_RANGE} tiles. When one has your scent, every other of its kind within ${PACK_CALL} tiles joins; the first leads.</li>
      <li>A pack <b>surrounds you</b>: each takes an equal part of the circle from the leader, circling ${CIRCLE_R} tiles out until within ${Math.round((CIRCLE_ARC * 180) / Math.PI)} degrees of
      its place, then closes; all but your target hit +${percent(FLANK_HIT - 1)}.</li>
      <li><b>Throwers</b>: ${listed(Object.values(SPECIES).filter((d) => d.throws).map((d) => `${d.name.toLowerCase()}s`))}: stand off ${KEEP_OFF} tiles, throw from up to ${THROW_REACH};
      each throw ${percent(THROW_HIT)} of a blow, a crush. Closer than ${KEEP_OFF - BACK_SLACK} tiles: back away at ${percent(BACK_PACE)} of walking; melee only when cornered.</li>
      <li><b>Fleeing</b>: hunters below ${percent(HUNTER_TURN)} health, monsters below ${percent(MONSTER_TURN)}; ${listed(Object.values(SPECIES).filter((d) => d.coward).map((d) => `${d.name.toLowerCase()}s`))}
      below ${percent(COWARD_AT)}, or ${percent(COWARD_DRAG)} once another of their kind within ${PACK_CALL} tiles has fled. Runs ${FLEE_SECS} seconds; ignores you for ${Math.round(HUNT_REST)}.
      The leader dying or fleeing makes the whole pack flee.</li>
    </ul>
    <h4>Companion orders</h4>
    <ul>
      <li><b>Attack my target</b> (its menu), <b>Set</b> <i>name</i> <b>on it</b> (a wild one's menu), or <b>${keyName(BIND_BY_ID.get('pet_attack')?.keys[0] ?? '')}</b>: attacks your target or mark,
      else the nearest foe, whatever its stance.</li>
      <li><b>Fall back</b> or <b>${keyName(BIND_BY_ID.get('pet_back')?.keys[0] ?? '')}</b>: returns to you; starts no fight for ${FALL_BACK} seconds.</li>
      <li><b>Guarding you</b> stance: attacks anything hunting you within ${COMPANION_SIGHT} tiles before it strikes, and whatever strikes it or you; gives up ${GUARD_RANGE} tiles from you
      (otherwise ${COMPANION_LEASH}). A dashed blue line links it to its target.</li>
      <li><b>Threat</b>: a creature fights what hurt it last. Your companion hitting something on you draws it after you have not hurt it for ${THREAT_HOLD} seconds (logged);
      a <b>Guarding you</b> companion draws it at once. It stays on the companion until the companion has not hurt it for ${THREAT_HOLD} seconds; then your next blow takes it back.
      While on the companion it attacks on its own clock and does not count among those on you.</li>
    </ul>
    <h4>Bows and consider</h4>
    <ul>
      <li><b>Bows draw on the move</b>: walking at ${percent(DRAW_WALK)} pace (speed multiplier) keeps drawing; looses when full; keeps shooting while in range with arrows.
      A line to the target fills with the draw: amber in range, grey out of it.</li>
      <li><b>Consider</b> (Examine on a wild creature, or the target panel while marked): your blows to down it and its to down you, from weapon, skill, stance, arrows, its hide,
      your dodge, shield and armour. <b>Easy</b>: it would take at least ${mul(CONSIDER_EASY)} as long to down you as you it (strike rates and hit rates counted); <b>Hard</b>: under
      ${percent(CONSIDER_HARD)} as long; <b>Even</b> between.</li>
    </ul>
    <h4>Weapons</h4>
    <ul>
      <li>Kinds, each its own subskill: ${listed(WEAPON_KINDS.map((k) => `<b>${k}</b>`))}. Swinging trains it and <b>fighting</b>; both set hit chance and damage.</li>
      <li>Each weapon: damage, swing seconds (above), reach. ${reachSays()} Hover for its reach in your hands.</li>
      <li>A two-handed weapon removes the shield.</li>
      <li>Heads from <b>moulds</b> at the smelter, beaten at an anvil, fitted to shafts: short and long sword blades, axe and maul heads, spear heads; a gang mould makes
      ${MOULDS.find((m) => m.id === 'arrow_head_mould')?.per ?? 0} <b>arrow heads</b> from a lump. Club: carved from a log.</li>
      <li>Bows: <b>bowyery</b>, shafts + bowstring, ${WOOD_BOWS.length} sizes: ${listed(WOOD_BOWS.map((w, i) => `<b>${itemDef(w.id).name.toLowerCase()}</b> ${w.range ?? 0}${i === 0 ? ' tiles' : ''}`))};
      each slower to draw and harder-hitting than the last.</li>
      <li>Arrows: <b>fletching</b>, ${bill('make_arrows')}, ${made('make_arrows')} an action. Feathers only from birds: ${listed(FEATHERED.map((s) => `the ${s.name}`))}.</li>
      <li>Bow in hand: <b>Shoot</b> on any wild creature in range; far range is much harder than near. Each shot uses an arrow.</li>
      <li>${ARROW_IDS.length - 1} other arrow types: <b>Broadhead</b> (${bill('make_broadhead_arrows')}): bleed like a knife, ${percent(KNIFE_BLEED)} of the shot a second for ${KNIFE_BLEED_SECS} seconds.
      <b>Bodkin</b> (${bill('make_bodkin_arrows')}): +${percent(BODKIN_HIDE - 1)} on anything with a hide (${listed(HIDES.map((h) => HIDE_NAMES[h].toLowerCase()))}).
      <b>Blunt</b> (${bill('make_blunt_arrows')}): crush; like a maul, cancel a heavy blow and delay the next ${STAGGER_MAUL} second${STAGGER_MAUL === 1 ? '' : 's'}.</li>
      <li><b>Shoot these first</b> (on an arrow stack): picks the type used; when out, plain arrows, then any left.</li>
    </ul>
    <h3>Stonecutting</h3>
    <ul>
      <li><b>Stonecutting</b> (chisel): rock, slate, marble and sandstone shards into <b>bricks</b> (walls, smelters, kilns), or ${need('make_stone_slab', 'rock_shards')} shards into a <b>slab</b>.</li>
      <li>Slabs are paving only: <b>Pave (slabs)</b> with a trowel in hand lays a floor of that stone; ${SLAB_VARIANTS.length} looks.</li>
      <li>Breaking paving with a pickaxe usually returns the slab whole. Laying is masonry; cutting is stonecutting.</li>
    </ul>
    <h3>Pottery and the kiln</h3>
    <ul>
      <li>Clay: dug from a clay pit with a shovel. <b>Pottery</b>: <b>unfired</b> bricks, bowls, pots, jars; unusable until fired.</li>
      <li><b>Kiln</b>: ${bill('make_kiln')}, trowel; carried; set down on dry flat ground; picked up when cold and empty.</li>
      <li>Fuel as a fire (peat and coal included); load the ware; light. Fire time per piece; a better kiln is faster and keeps more of the potter's quality (QL).</li>
      <li>Fired: bowl (cooking), pot (pottage), jar (preserves), brick (building).</li>
      <li>Artisan <b>amphora</b> (${bill('make_amphora')}, fired like a pot): holds ${itemDef('amphora').holds} of one food or drink; contents rot at ${frac(itemDef('amphora').shelter ?? 1)} the rate on the ground.</li>
      <li>Artisan <b>potter's wheel</b> (${bill('make_potters_wheel')}): anybody shaping clay within ${furnitureDef('potters_wheel').pace?.reach} tiles takes ${percent(1 - (furnitureDef('potters_wheel').pace?.by ?? 1))} less time per action.</li>
      <li>Artisan <b>glaze</b>: a fired pot, bowl, jar or amphora + ${GLAZE_ASH} lot of ashes: never decays.</li>
    </ul>
    <h3>Stones and jewels</h3>
    <ul>
      <li>Mining: a <b>gem</b> one action in ${Math.round(1 / GEM_ODDS)}. Each favours a skill: ${listed(GEMS.filter((g) => !g.perk).map((g) => `${g.name.toLowerCase()} ${tradeName(g.skill)}`))}.</li>
      <li><b>Jewellery</b> (file): set in a <b>ring</b> or <b>pendant</b>; worn in the jewel slot: +${percent(JEWEL_BONUS)} skill gain in its skill. In silver: a <b>focus</b> (spells are cast from it).
      Listed under Jewellery in the crafting window.</li>
      <li>Artisan gold <b>circlet</b> (${bill('make_circlet')}, file): worn on the head instead of a helm. ${CIRCLET_STONES} stones, set one at a time by anybody (<b>Set in the circlet</b>
      on the stone); each gives ${frac(CIRCLET_SHARE)} of its ring bonus.</li>
      <li>Artisan More Stones: ${GEMS.filter((g) => g.perk).length} more gems from rock: ${listed(GEMS.filter((g) => g.perk).map((g) => `${g.name.toLowerCase()} ${tradeName(g.skill)}`))}.</li>
    </ul>
    <h3>Digging up the past</h3>
    <ul>
      <li><b>Investigate</b> (right-click soil or sand): <b>trowel</b>, <b>Archaeology</b>; sometimes a <b>fragment</b>. A searched tile is empty for a while.</li>
      <li>A fragment names its relic and piece (<i>${LAST_RELIC.name} ${LAST_RELIC.parts - 1}/${LAST_RELIC.parts}</i>); found at ${FIND_DAMAGE} to ${FIND_DAMAGE + FIND_DAMAGE_SPREAD} damage.</li>
      <li><b>Fragments and tarnished baubles cannot be repaired until restored</b> (no Repair, repair kit, Mend or worker mending). Damage only rises (failed restoring, weather);
      at ${DAMAGE_MAX} it breaks. Restored, it mends like anything else.</li>
      <li>${RELICS.length} relics, from ${article(RELICS[0].name)} <b>${RELICS[0].name}</b> in ${RELICS[0].parts} pieces to ${article(LAST_RELIC.name)} <b>${LAST_RELIC.name}</b> in ${LAST_RELIC.parts};
      each recognised only at enough archaeology. Common ones turn up far more often; pieces you lack are favoured.</li>
      <li><b>Restore</b> (all pieces in hand, right-click one): <b>Restoration</b>, at any damage short of breaking. Failure: ${RESTORE_HARM} to ${RESTORE_HARM + RESTORE_HARM_SPREAD} more damage on
      every piece. Result quality (QL): the pieces' worth, less ${percent(1 / RESTORE_AGE)} per point of their damage.</li>
      <li>Some are treasure only (statuette, bronze mirror); an <b>old blade</b> is a sword and an <b>ancient helm</b> a helm.</li>
    </ul>
    ${artifactHelp()}
    <h3>Baubles</h3>
    <ul>
      <li>${percent(BAUBLE_SHARE)} of trowel finds: a whole <b>tarnished bauble</b>, by grade: ${listed(BAUBLE_TIERS.map((t) => `${percent(t.odds)} ${t.name.toLowerCase()}`))}. No effect until restored.</li>
      <li><b>Restore</b> alone, restoration difficulty ${listed(BAUBLE_TIERS.map((t) => `${t.difficulty} ${t.name.toLowerCase()}`))}; failure damages it like relic pieces.</li>
      <li>Effect drawn on restoring, with rarity, and written on it: rare ${mul(baubleTimes(1))} an ordinary one's, supreme ${mul(baubleTimes(2))}, fantastic ${mul(baubleTimes(3))}.</li>
      <li>Another ${percent(REGRET_SHARE)}: a whole <b>Bauble of Regret</b> (undoes a trade or class; see <b>Trades</b>).</li>
    </ul>
    <table>
      ${BAUBLE_TIERS.map((t) => `<tr><td><b>${t.name}</b></td><td>${t.slots} sockets. ${
        t.id === 'minor' ? `${BAUBLE_LOW} to ${BAUBLE_HIGH}% less time per action, or ${BAUBLE_LOW} to ${BAUBLE_HIGH}% more skill gained, in one of the ${MINOR_SKILLS.length} skills an action is done with.`
        : t.id === 'major' ? `${BAUBLE_LOW} to ${BAUBLE_HIGH}% chance of ${mul(YIELD_TIMES)} yield per action in one of ${MAJOR_SKILLS.length} skills: every crafting-window skill, and ${listed(MAJOR_SKILLS.filter((k) => !RECIPES.some((r) => r.skill === k)).map((k) => SKILL_BY_ID.get(k)?.name.toLowerCase() ?? k))}.`
        : `One of: ${listed(ANCIENT_EFFECTS.map((e) => `+${ANCIENT_PLUS} ${e.said}`))}.`}</td></tr>`).join('\n      ')}
    </table>
    <ul>
      <li>Set at an altar of your settlement: <b>Baubles</b> on its menu. ${BAUBLE_TIERS.reduce((n, t) => n + t.slots, 0)} sockets, belonging to the settlement (they stay filled if the altar moves).</li>
      <li>Into an empty socket: the founder or a rank with <b>${POWER.set_bauble.label}</b>. Replacing also needs <b>${POWER.replace_bauble.label}</b>; the old one is destroyed. Nothing comes out.</li>
      <li>Works for the founder and every rank with <b>${POWER.served.label}</b>, on every action done standing on its land.</li>
      <li>Starting ranks: ${listed(DEFAULT_RANKS.filter((r) => r.powers.includes('set_bauble')).map((r) => r.name))} set;
      ${listed(DEFAULT_RANKS.filter((r) => r.powers.includes('replace_bauble')).map((r) => r.name))} replace; ${listed(DEFAULT_RANKS.filter((r) => r.powers.includes('served')).map((r) => r.name))} served.</li>
      <li>Same kind, same skill: adds up, max ${percent(BAUBLE_KINDS.time.cap / 100)} less time, ${mul(1 + BAUBLE_KINDS.learn.cap / 100)} skill gain, ${percent(BAUBLE_KINDS.double.cap / 100)} chance of
      ${mul(YIELD_TIMES)} yield (all or nothing per action). Settlement window shows the totals.</li>
    </ul>
    <h3>Wildermon</h3>
    <table>
      <tr><td><b>Kind</b></td><td><b>Habitat, food, evolution, settlement task</b></td></tr>
      <tr><td><b>Snufflet</b></td><td>Forages berries.</td></tr>
      <tr><td><b>${SPECIES.vola.name}</b> (was Vola)</td><td>Botanizes herbs and roots. Evolves: ${evolves('vola')}.</td></tr>
      <tr><td><b>${SPECIES.bevere.name}</b> (was Bevere)</td><td>Near water; eats vegetables and starches; placid. Fells trees, logs to the crate. Evolves: ${evolves('bevere')}.</td></tr>
      <tr><td><b>${SPECIES.seavic.name}</b> (was Seavic)</td><td>Among trees; eats acorns and nuts; placid. Farms: sows seed from the crate, tends every growth stage, carries the harvest back;
      unsown seed goes back to the settlement stores. Only works ground you tilled. Evolves: ${evolves('seavic')}.</td></tr>
      <tr><td><b>${SPECIES.mola.name}</b> (was Mola)</td><td>On metal; eats spices. Mines the nearest ore no other ${SPECIES.mola.name} has claimed, within its mining level
      (iron from mining ${METAL_LEVEL('iron')}); quality (QL) = its mining, capped by the seam. Works ${metres(MINE_DEPTH)} m of water deep, as you do; a face it cannot stand on is worked from the bank
      (shore seams, seabed under wading depth; the ${SPECIES.quarra.name} likewise for plain rock). Range +${SPECIES.mola.rangePerStep ?? RANGE_PER_STEP} tiles per ${SKILL_STEP} levels
      (usual ${RANGE_PER_STEP}). Evolves: ${evolves('mola')}.</td></tr>
      <tr><td><b>${SPECIES.crawler.name}</b> (was Crawler)</td><td>On sand; eats vegetables. Digs sand (a clawful from the highest corner) to the crate. Defensive: always hits back;
      tamed ones still sometimes attack whoever stands beside them (a helm stops the worst). Evolves: ${evolves('crawler')}.</td></tr>
      <tr><td><b>${SPECIES.quarra.name}</b> (was Quarra)</td><td>On bare rock; eats clay. Cuts rock, slate, marble and sandstone shards. Evolves: ${evolves('quarra')}.</td></tr>
      <tr><td><b>${SPECIES.embra.name}</b> (was Embra)</td><td>Marsh peat and tar; eats cooked food only. Keeps every fire, smelter and kiln on the settlement fuelled and lit from the crate.
      Evolves: ${evolves('embra')}.</td></tr>
      <tr><td><b>Magga</b></td><td>Collects everything dropped on the settlement into the crate. Wild ones steal items left near their trees.</td></tr>
      <tr><td><b>${SPECIES.woola.name}</b> (was Woola)</td><td>No task. <b>Shear</b> with a knife for <b>wool</b> once grown; regrows in ${dur(1 / (SPECIES.woola.fleece ?? 1))}.
      Evolves: ${evolves('woola')}.</td></tr>
      <tr><td><b>Ulva</b></td><td>Hunts by scent from ${SPECIES.ulva.notice ?? HUNT_SIGHT} tiles, until you are well away or it is badly hurt. Taming ${SPECIES.ulva.tameLevel}.
      Tamed: guards the settlement, attacking anything wild crossing the border.</td></tr>
      <tr><td><b>${SPECIES.roxxen.name}</b> (was Roxxen)</td><td>Draught ox: +${percent(SPECIES.roxxen.pull!)} team pace (speed multiplier) in the traces. No settlement task. Level = <b>driving</b>, learned
      ${LEARNS_SAYS.pull}; counts in the traces where another wildermon's climbing does (speed and steepest step). Largest carcass. Evolves: ${evolves('roxxen')}.</td></tr>
      <tr><td><b>${SPECIES.orse.name}</b> (was Orse)</td><td>Mount; learns <b>climbing</b> in the traces or ridden. Fit a <b>saddle</b> and <b>bridle</b> from its menu, then <b>mount</b>.
      Green: ${mul(ORSE_GREEN / BASE_SPEED)} your pace on the same ground; climbing maxed: ${mul(ORSE_WORKED / ORSE_GREEN)} a green one, up slopes you must walk round.
      Tailor Saddler tack: +${percent((tailor('Saddler')['speed:saddle'] ?? 1) - 1)} mount speed, past the usual ${MAX_MOUNT_SPEED} tiles a second; their yokes do the same for carts
      and wagons. Evolves: ${evolves('orse')}.</td></tr>
      <tr><td><b>Rowl</b></td><td>Hunts on sight; taming ${SPECIES.rowl.tameLevel}; unruly when tamed. On a settlement: patrols round the totem, kills anything wild inside,
      carcasses to storage. <b>Fighting</b> sets damage (${mul(trainedHit(TOP_SKILL))} at mastery) and patrol radius (${SPECIES.rowl.workRange} to
      ${SPECIES.rowl.workRange + rangeSteps(TOP_SKILL) * (SPECIES.rowl.rangePerStep ?? RANGE_PER_STEP)} tiles).</td></tr>
      <tr><td><b>${SPECIES.noot.name}</b> (was Noot)</td><td>Beside clay pits; eats root vegetables. Digs <b>clay</b> to the crate. Evolves: ${evolves('noot')}.</td></tr>
    </table>
    <h4>Taming</h4>
    <ul>
      <li>Carry its food (Snufflet: a berry or vegetable; ${SPECIES.vola.name}: a spice or vegetable), long-press or right-click it, <b>Tame</b>. Food is used up; low taming rarely succeeds;
      a failure has no lasting effect.</li>
      <li><b>Keep at it</b>: after a refused offering, <b>+${percent(COAX_STEP)} chance</b> per attempt in a row, capped only by the overall cap. Lapses after ${dur(COAX_LAPSE)};
      <b>hitting it ends the run</b>. Examine shows progress.</li>
      <li><b>Evolved in the wild</b>: ${((): string => {
        const [a, b] = stageLevels(1);
        const [c, d] = stageLevels(2);
        const e = SPECIES.sedra;
        const st = e.stages![0].name;
        return `1 in ${WILD_STAGE_ODDS[0]} wild ones of an evolving kind are at their second evolution stage (level ${a} to ${b - 1}), 1 in ${WILD_STAGE_ODDS[1]} at their third
      (level ${c} to ${d - 1}), with that evolution stage's name, look, health, blow, pace and task. Per evolution stage past the first: <b>+${WILD_STAGE_TAME} taming</b> needed and
      <b>${percent(WILD_STAGE_CHANCE)} of the kind's</b> base chance. ${st}: taming ${tameNeeds({ species: e.id, skills: { [levelSkill(e)!]: a } }).level}, base
      ${percent(tameNeeds({ species: e.id, skills: { [levelSkill(e)!]: a } }).chance)} (${e.name}: ${e.tameLevel}, ${percent(e.tameChance)}). Its card shows the requirement.`;
      })()}</li>
    </ul>
    <h4>Age and stats</h4>
    <ul>
      <li><b>Young</b>: ${percent(AGES.young.scale)} size, ${percent(AGES.young.speed)} pace, no fleece or milk, cannot be harnessed or ridden; ${mul(AGES.young.tame)} as easy to tame.</li>
      <li><b>Grown</b> after ${dur(YOUNG_FOR)} (all other figures assume grown). <b>Old</b> after ${dur(OLD_AT)}: ${percent(AGES.old.speed)} pace, ${percent(AGES.old.pull)} pull,
      ${percent(AGES.old.growth)} fleece regrowth; heavier; carcass +${percent(AGES.old.yield - 1)}.</li>
      <li>The Wildermon window shows its age and a yearling's time to grow. Wildermon present when the island was raised count as grown.
      ${capital(article(itemDef(ARTIFACT_FOR.use_ancient_comb).name.toLowerCase()))} <b>${itemDef(ARTIFACT_FOR.use_ancient_comb).name.toLowerCase()}</b> takes one age off (see <b>Digging up the past</b>).</li>
      <li><b>Base stats</b> (card): its ${BASE_STATS.length} base stats as the rules read them: ${listed(BASE_STATS.map((st) => `<b>${st.name}</b>, ${st.says}`))}; each a multiplier on its kind's.
      Beside each: points from ${article(itemDef(ARTIFACT_FOR.use_ancient_pot).name.toLowerCase())} ${itemDef(ARTIFACT_FOR.use_ancient_pot).name.toLowerCase()}, +${percent(POT_STEP)} each, max ${POT_MOST}.</li>
      <li><b>Cull</b> (its menu, anywhere): one action; leaves a normal carcass; confirmation, stronger for valuable blood. <b>Release</b>: back to the wild, blood intact.
      Neither while harnessed or ridden.</li>
    </ul>
    <h4>The working sorts</h4>
    <ul>
      <li><b>Bogga</b>: marshes; cuts <b>peat and tar</b>.</li>
      <li><b>${SPECIES.sedra.name}</b> (was Sedra): cuts <b>reeds</b>, ${1 + Math.floor(SKILL_TOP / REED_LEVELS)} a cut at ${SKILL_TOP} foraging. Evolves: ${evolves('sedra')}.</li>
      <li><b>${SPECIES.holla.name}</b> (was Holla): carries <b>water</b> from the shore or a well into your barrels. Evolves: ${evolves('holla')}.</li>
      <li><b>Dowse</b>: only over metal; on a settlement <b>reads the ground</b> and marks ore.</li>
      <li><b>Sappa</b>: <b>plants sprouts</b> where trees were felled.</li>
      <li><b>${SPECIES.cobbe.name}</b> (was Cobbe): <b>hod</b>: carries what a planned wall (any storey), floor, roof, staircase, ladder, column, open bridge or aqueduct span or foundation
      still needs from your settlement stores, crates and furniture, and fits it, one piece a trip. Evolves: ${evolves('cobbe')}.</li>
      <li><b>${SPECIES.tinka.name}</b> (was Tinka): <b>mends</b> damaged gear in your settlement stores, most damaged first. Evolves: ${evolves('tinka')}.</li>
      <li><b>Middun</b>: turns rotting things on the ground into <b>compost</b>.</li>
      <li><b>Snout</b>: finds <b>buried relics</b> and marks where to dig. Taming ${SPECIES.snout.tameLevel}.</li>
      <li><b>Bura</b>: no task; panniers hold <b>${SPECIES.bura.pannier} things</b> (open from its menu).</li>
      <li><b>Gorral</b>: saddle mount; climbs ground ${article(SPECIES.orse.name)} ${SPECIES.orse.name} refuses.</li>
      <li><b>Wadd</b>: the only mount that swims deep water with a rider.</li>
      <li><b>Shaggan</b>: slowest in the traces; +${percent(SPECIES.shaggan.pull ?? PULL_DEFAULT)} team pull each (most add ${percent(PULL_DEFAULT)}).</li>
      <li><b>${SPECIES.warda.name}</b> (was Warda): sees ${SPECIES.warda.sight} tiles for you wherever it stands. Evolves: ${evolves('warda')}.</li>
      <li><b>Quill</b>: <b>pluck</b> for <b>feathers</b>.</li>
      <li><b>Cudda</b>: <b>milked</b> into an empty bucket; a bucket of milk makes ${made('make_cheese')} <b>cheeses</b>.</li>
      <li><b>Vesp</b>: a swarm. Build a <b>hive</b> (${bill('make_hive', true)}) on your settlement; a tamed Vesp set to work the settlement (task <b>${GATHER_VERB.hive}</b>) goes to the nearest hive in reach
      and fills it with <b>honey</b> and <b>beeswax</b>. Brings nothing to the crate; reports when no hive is in reach. ${capital(bill('make_candle'))}: ${made('make_candle')} <b>candles</b>.</li>
      <li><b>Lume</b>: out only after dark; lights ${SPECIES.lume.glow ?? 0} tiles round itself.</li>
    </ul>
    <h4>The settlement's hands</h4>
    <ul>
      <li>${HANDS.length} chore workers, set to a settlement as usual, working within their reach of the totem. ${HANDS.filter((id) => TEND_JOBS.has(SPECIES[id].gathers!)).length} work at the settlement stores
      or at one of your stations: output goes into that store, else any settlement store that takes it, else onto the ground there.</li>
      ${HANDS.map((id) => {
        const d = SPECIES[id];
        return `<li><b>${d.name}</b> (taming ${d.tameLevel}): ${GATHER_DO[d.gathers!]}${HAND_NUMBERS[id] ? `; ${HAND_NUMBERS[id]}` : ''}.</li>`;
      }).join('')}
    </ul>
    <h4>Wildermon that fight</h4>
    <ul>
      <li>${FIGHTERS.length} fight in their own way whenever one of yours lands a blow on another creature (at your heel or guarding a settlement); wild ones fight normally.</li>
      ${FIGHTERS.map((id) => {
        const d = SPECIES[id];
        return `<li><b>${d.name}</b> (taming ${d.tameLevel}): ${STYLE_SAYS[d.style!]}.</li>`;
      }).join('')}
    </ul>
    <h4>Wildermon with an ability</h4>
    <ul>
      <li>${ABLE.length} use an ability instead of a blow, the first time it is useful, then not until its cooldown ends; each is a fighting class's spell at that spell's numbers, except the
      ${listed(ABLE.filter((id) => !CLASS_SPELL_BY_ID.has(SPECIES[id].ability!)).map((id) => `${SPECIES[id].name}'s`))}. Used wherever one of yours fights; wild ones fight normally.</li>
      ${ABLE.map((id) => {
        const d = SPECIES[id];
        return `<li><b>${d.name}</b> (taming ${d.tameLevel}), ${abilityName(d.ability!)}: ${abilitySays(d.ability!)}.</li>`;
      }).join('')}
      <li>${((): string => {
        const d = SPECIES.whispet;
        const [one, two] = d.stages!;
        return `${d.name}: wild only ${d.nocturnal ? 'after dark, ' : ''}from ${seasonSays(d.season!)} (UTC calendar); on other days no wild ones; tamed, kept or bred ones stay all year.
      Level = body strength. Evolves into ${article(one.name)} ${one.name} at ${EVOLVE_AT[0]} (${stageSays(1, false)}) and ${article(two.name)} ${two.name} at ${EVOLVE_AT[1]}
      (${stageSays(2, false)}), against ${article(d.name)} ${d.name}.`;
      })()}</li>
    </ul>
    <h4>Settlement menu and upgrades</h4>
    <ul>
      <li>Right-click any tile of your settlement: <b>settlement menu</b>: its wildermon, their <b>orders</b>, <b>upgrade</b>, rename, disband.</li>
      <li>Orders apply to every settlement worker when something wild crosses the border: <b>aggressive</b> (drop work and attack), <b>defensive</b> (only answer what struck them or you),
      <b>passive</b> (keep working).</li>
      <li>Each upgrade: border +${DEED_RADIUS_PER_LEVEL} tiles; +${deedWorkersAt(2) - deedWorkersAt(1)} working wildermon. Requirements: ${UPGRADES_SAID}. In order; each level asks only
      the new thing. The menu ticks what you have. Max level ${MAX_DEED_LEVEL}.</li>
      <li>The totem grows a carved block per level, each with one lit rune: lit runes = level.</li>
    </ul>
    <h4>Settlement workers</h4>
    <ul>
      <li><b>Food</b>: under ${frac(HUNGRY)} fed, a worker eats from any crate on the settlement holding its food, then returns to work.</li>
      <li><b>Range</b>: starts at ${WORK_RANGES[0]} to ${WORK_RANGES[WORK_RANGES.length - 1]} tiles from the totem by sort; +${RANGE_PER_STEP} tiles per ${SKILL_STEP} levels of its task skill
      (${RANGE_STEPS_SAID}). Its card shows current range and the skill for the next step.</li>
      <li><b>Idle reasons</b> (card and hover, until it next sets out): nothing of its task in range of the totem or post at its level
      (&ldquo;${idleSays({ why: 'range', n: SPECIES.sedra.workRange }, 'reed')}&rdquo; for a new ${SPECIES.sedra.name}); nothing in your settlement stores to work, naming what it needs
      (&ldquo;${idleSays({ why: 'stock', n: 0 }, 'mend')}&rdquo;); no barrel with room for its water; a load with nowhere to put it; walking home when over ${HOME_SLACK} tiles past
      its range, with the distance. Island: no work while its keeper is away or no awake player is near enough; the card says which and how near.</li>
      <li><b>Ledger</b> (card): this island day and the previous (a day = ${dur(DAY_SECONDS)}): cycles at its task, skill gained, the ${LEDGER_SHOWN} items it handled most
      (up to ${LEDGER_ITEMS} kinds counted a day).</li>
      <li>A tamed wildermon: <b>travels with you</b> (one at a time; stance Passive, Defensive or Aggressive), <b>assigned to your settlement</b> (a Snufflet forages and drops finds in storage),
      or in a <b>wildermon crate</b>. Feed from your pack; settlement workers feed from storage.</li>
      <li><b>Wildermon</b> window (<kbd>P</kbd>): condition, level and skills of every one you own (not wild ones). Level = its skill.</li>
      <li>Settlement workers learn at half a player's pace and work at half a player's speed; higher skill: better finds, faster work.</li>
      <li>Kinds with no work learn their skill otherwise: ${listed(Object.values(SPECIES).filter((d) => d.learns).map((d) => `${d.name} its ${(SKILL_BY_ID.get(d.learns!.skill)?.name ?? d.learns!.skill).toLowerCase()}, ${LEARNS_SAYS[d.learns!.by]}`))}.</li>
      <li><b>Learning pace by task</b>: each gain at its level skill × its task's multiplier, set so every task reaches level ${EVOLVE_AT[0]} and then ${EVOLVE_AT[1]} in about the middle task's time:
      ${learnPaceSays()}. Keeping watch, hunting and anything else: the skill curve's own gain.</li>
    </ul>
    <h4>Loads per evolution stage</h4>
    <ul>
      <li>Things at once: first evolution stage ${STAGE_LOADS[0]}, second ${STAGE_LOADS[1]}, third ${STAGE_LOADS[2]}.</li>
      <li>Fetching tasks carry that many loads a trip (moving to the next tile while they have room; home when nothing is left).</li>
      <li>Water carrier: fills that many buckets, pours as many as the barrel takes, at once. Hod carrier: that many pieces, as many as the work needs, fitted at once.
      Stoker: that many fuel pieces, as many as the hearth takes. Planter, lantern keeper, planter keeper, bucket filler: that many sprouts, candles, seeds, buckets a trip.</li>
      <li>In-place tasks handle that many a cycle: mender (most damaged items in your settlement stores); store, fire or press tasks (batches, while the makings last); butcher (carcasses);
      restorer (relics); glazer (pieces); ash raker (hearths raked, lye leached); brusher, milker or shearer, and dresser (your wildermon within ${TEND_REACH} tiles, with a bucket or dressing
      from the settlement stores for each).</li>
      <li>A cycle still teaches one cycle's gain. No multiples: keeping watch, hunting, pruning, stump digging, scrubbing, tending hives, reading the ground, charging smelters and kilns, brewing.</li>
    </ul>
    <h4>Rest and wildermon beds</h4>
    <ul>
      <li>${TIRE_GOES} cycles at its task (one cycle = one gain) before it tires; extra loads cost nothing more.</li>
      <li>Tired, once its arms are empty (or between errand steps): rests ${dur(restFor(false))}, then full stamina. A rest is not a cycle in its ledger.</li>
      <li><b>Wildermon bed</b> of its size, free on your settlement: it walks to the nearest and sleeps ${frac(BED_REST)} as long (${dur(restFor(true))}).</li>
      <li>Sizes: small for first evolution stage (under level ${EVOLVE_AT[0]}), medium for second (to ${EVOLVE_AT[1] - 1}), large for third. Non-evolving kinds: small under ${DEN_HEALTH[0]} health,
      medium under ${DEN_HEALTH[1]}, large at ${DEN_HEALTH[1]} and over. Its own size only; one per bed.</li>
      <li>Card: stamina, and rest left while resting (&ldquo;${idleSays({ why: 'bed', n: restFor(true), bed: 'den_small' }, 'forage')}&rdquo;).</li>
    </ul>
    <h4>Upkeep and specialties</h4>
    <ul>
      <li>Eats from your settlement stores when hungry. ${dur(UPKEEP_FOR)} (an island day) at work without a meal (no food it eats there): ${percent(UNFED_PACE)} task pace until it eats;
      card: &ldquo;${unfedSays({ species: 'sedra', unfed: UPKEEP_FOR })}&rdquo;.</li>
      <li><b>Specialty</b>: ${SPECIALTY_AT} or more settlement workers of one task on a settlement: each ${percent(SPECIALTY_BONUS)} faster (work time ÷ ${1 + SPECIALTY_BONUS}), on top of evolution stage and blood.
      Not keeping watch or hunting. Listed per task in the settlement window and on each card.</li>
    </ul>
    <h4>Wildermon crates</h4>
    <ul>
      <li>Holds <b>one</b> wildermon. Fine carpentry, mallet, ${CRATE_BILL}; <b>${itemDef(CREATURE_CRATE).weight} kg</b>; no rot.</li>
      <li>Your first tame follows you; <b>every later one goes into an empty crate in your pack</b> (none: cannot tame). Trap catches likewise.</li>
      <li>Put your follower or a settlement worker into an empty carried crate from its menu.</li>
      <li>Set down on any spot: shown inside with its name. Open (beside it, or from the pack): <b>let it out to follow you</b> (the current follower goes into the crate), or
      <b>set it to work the settlement</b> (uses a working slot).</li>
      <li>No hunger inside. A young born while something follows you goes into a crate too (see breeding).</li>
      <li>An occupied crate can only be carried, set down or opened: not dropped, bagged, stored, sold, posted or bartered.</li>
      <li><b>Take with you</b> on a settlement worker while a companion follows you: the companion takes its place on the settlement, or goes into an empty carried crate if the settlement has no room.</li>
    </ul>
    <h4>Crates and storage</h4>
    <ul>
      <li>Each tile: a ${SUBTILES} by ${SUBTILES} grid of spots.</li>
      <li><b>Log crate</b>: ${bill('make_log_crate')} (no nails). <b>Plank crate</b>: ${bill('make_plank_crate')} (mallet). Right-click a spot to place; snaps to the grid.
      Hold ${CRATE_DEFS.log.capacity} and ${CRATE_DEFS.plank.capacity}. Open, empty, pick up when empty. The settlement crate beside the totem is one.</li>
      <li>Workers fill the settlement crate first, then the nearest store on the settlement that takes the load (crate, raw material bin, chest, larder, cart); never a <b>trash crate</b>.</li>
      <li><b>All full</b>: the worker holds its load near the totem and says so once; resumes when room appears.</li>
      <li>Seed for sowing and wood for stoking come from any store on the settlement.</li>
      <li><b>Dragging</b> between the inventory and an open container: must be beside it, and it must accept the item (raw bin: unworked only; craft bin: worked only; larder: food, drink, flour;
      seed bin: seed; sprout bin: sprouts; barrel: no solids; full crate: nothing). The refusal names the reason.</li>
    </ul>
    <h4>Gathering</h4>
    <ul>
      <li>Click a tile or press <b>T</b>: the Tile window shows <b>something to pick</b> or <b>something to gather</b>. Picked: gone; regrows after a while.</li>
      <li>Can hold finds: grass, steppe, tundra, moss, marsh, lawn. Never: sand, dirt, clay.</li>
      <li>Foraging and botanizing: <b>one more pass per ${PER_ROLL} skill</b>: ${PASSES_SAID}. Each pass is checked separately. The menu shows your passes. The tile stays empty for the usual time.</li>
      <li><b>Seasons</b>: foraging finds ${seasonalFinds(FORAGE_TABLE)}; all year: ${yearRoundFinds(FORAGE_TABLE)}. Botanizing finds ${seasonalFinds(BOTANIZE_WATER_TABLE)};
      all year: ${yearRoundFinds(BOTANIZE_WATER_TABLE)}.</li>
      <li>A pass draws only from what is in season, at the usual weights: finds are as frequent in winter as in summer. Settlement workers follow the same seasons.</li>
    </ul>
    <h3>Meditation, and the three paths</h3>
    <ul>
      <li><b>Rug</b>: ${bill('make_rug')}, needle. Stand on the spot, <b>Sit and think about nothing</b>. Once per ${dur(SIT_REST)}.</li>
      <li>Calm (meditation resource) gain by place: your own yard ${percent(SIT_WORTH.yard)}; high ground off your settlement ${mul(SIT_WORTH.high)}; where the ground runs out and the air is thin <b>${mul(SIT_WORTH.thin)}</b>.</li>
      <li>Modifiers: feet in water +${percent(SIT_WORTH.water - 1)}; a mote swirl within ${SIT_WORTH.swirlReach} tiles +${percent(SIT_WORTH.swirl - 1)}; a <b>Runestone</b> within
      ${SIT_WORTH.stoneReach} tiles (to its nearest tile) <b>${mul(SIT_WORTH.stone)}</b>; within ${SIT_WORTH.staleReach} tiles of anywhere you sat since the last daily reset (${hudHour(TREE_DAWN_UTC)} UTC)
      ${percent(SIT_WORTH.stale)}.</li>
      <li>All multiply (Runestone + feet in water: ${mul(SIT_WORTH.stone * SIT_WORTH.water)}). A blow landing on you ends the sitting with nothing.</li>
      <li><b>Calm</b> per sitting: ${SIT_CALM} Calm × the spot's multiplier. Cap follows the favour curve, off meditation: ${listed(PATH_TIER_AT.filter((_, i) => i % 2 === 0).map((m) => `${Math.floor(calmCap(m))} at ${m}`))}.
      No regeneration; spent on techniques.</li>
      <li>At ${CHOOSE_AT} meditation: choose <b>one</b> of ${PATH_LIST.length} paths at the rug, permanent; earlier choices stand.</li>
      <li>Tiered paths: ${PICKS_PER_TIER} picks at each path tier (${listed(PATH_TIER_AT.map(String))} meditation): a <b>technique</b> and ${PICKS_PER_TIER - 1} <b>disciplines</b>; take one, permanently,
      in the <b>Faith</b> window's Path tab. Technique: the spell bar's path slot; costs Calm; cooldown. Discipline: always on.</li>
    </ul>
    <table>
      ${PATH_LIST.filter((p) => p.moved).flatMap((p) => PATH_TIER_AT.map((at, i) => `<tr><td><b>${p.name}</b> ${at}</td><td>${picksOf(p.id, i + 1).map((k) => (k.kind === 'technique'
        ? `<b>${k.name}</b> (${k.cost} Calm, cooldown ${dur(k.rest)}): ${lowerFirst(k.note)}`
        : `<i>${k.name}</i>: ${lowerFirst(k.note)}`)).join(' ')}</td></tr>`)).join('\n      ')}
    </table>
    ${PATH_LIST.every((p) => p.moved) ? '' : `<p>${listed(PATH_LIST.filter((p) => !p.moved).map((p) => p.name))}: steps unchanged until moved to path tiers.</p>`}
    <h3>An altar, and what kneeling at one buys</h3>
    <ul>
      <li><b>Altar</b>: masonry, ${bill('make_altar')}, trowel. Built and set down only on a settlement of yours (founded or citizen). One per settlement.</li>
      <li><b>Pray</b>: banks <b>favour</b>; once per ${dur(PRAYER_REST)}. Trains <b>${SKILL_NAME('praying')}</b> about ${listed([1, 20, 50].map((v) => `${prayerTrains(v, tryGain(true))} at ${v}`))};
      <b>${SKILL_NAME('prayer')}</b> about ${listed([1, 20, 50].map((v) => `${prayerTrains(v, PRAYER_GAIN)} at ${v}`))}.</li>
      <li><b>${SKILL_NAME('praying')}</b> sets favour per prayer (quality (QL) ${ALTAR_QL[1]} altar at ${hudHour(PRAYER_PEAKS[0])}): ${listed(PRAYER_SHOWN.map((v) => `${prayerBanks(v)} favour at ${SKILL_NAME('praying')} ${v}`))}.</li>
      <li><b>${SKILL_NAME('prayer')}</b> sets max favour: ${listed(PRAYER_SHOWN.map((v) => `${Math.floor(favourCap(v))} favour at ${SKILL_NAME('prayer')} ${v}`))}.</li>
      <li>Best at <b>${listed(PRAYER_PEAKS.map(hudHour))}</b>: favour ${mul((PRAYER_BASE + PRAYER_LIFT) / PRAYER_BASE)} that at ${PRAYER_TAPER} hours or more from either; tapering between.</li>
      <li>Altar QL ${ALTAR_QL[2]}: favour ${mul(prayerWorth(ALTAR_QL[2], PRAYER_PEAKS[0], 1) / prayerWorth(ALTAR_QL[0], PRAYER_PEAKS[0], 1))} that at a QL ${ALTAR_QL[0]} one.</li>
      <li>Regeneration: ${Number((FAVOUR_TRICKLE * 3600).toFixed(1))} favour an hour, up to your cap.</li>
      <li>Holds the settlement's bauble sockets (see <b>Baubles</b>).</li>
      <li><b>Sacrifice</b> (altar menu): gives up one ${RARITIES.slice(1, -1).map((r) => r.name).join(', ')} or ${RARITIES[RARITIES.length - 1].name} item from the pack (one of a stack);
      fills ${listed(NUTRIENTS.map((k) => NUTRIENT_NAMES[k].toLowerCase()))} to the top.</li>
      <li>${percent(SOUL_CHANCE)} of sacrifices leave a <b>soul</b> of the item's rarity. <b>Absorb into</b> (on the soul) an ordinary pack item (one of a stack): it takes that rarity.</li>
      <li>Not sacrificable: locked or worn items, bags with contents, occupied wildermon crates. Baubles take no soul (rarity drawn on restoring).</li>
    </ul>
    <p>${CASTS.length} favour casts, found nowhere else:</p>
    <table>
      ${CASTS.map((c) => `<tr><td><b>${c.name}</b></td><td>${c.cost} favour, ${SKILL_NAME('prayer')} ${c.level}. ${c.note}</td></tr>`).join('\n      ')}
    </table>
    <h3>Patrons and the spell bar</h3>
    <ul>
      <li>At <b>${PATRON_AT} ${SKILL_NAME('prayer')}</b>: take a <b>patron</b> in the <b>Faith</b> window: ${listed(PATRONS.map((p) => `<b>${p.name}</b> (${ALIGNMENT_NAMES[p.alignment].toLowerCase()})`))}. Permanent.</li>
      <li>${SPELLS_PER_TIER} spells at each of ${FAITH_TIER_AT.length} faith tiers (${listed(FAITH_TIER_AT.map(String))} ${SKILL_NAME('prayer')}); take one per faith tier: ${FAITH_TIER_AT.length} of
      ${FAITH_TIER_AT.length * SPELLS_PER_TIER}. Every patron's faith tiers are readable beforehand. Patron and spell choices need confirming.</li>
      <li>Spells cost favour and have their own cooldown in seconds.</li>
      <li><b>Spell bar</b>: ${BAR_SLOTS} slots: ${listed((['class', 'faith', 'path'] as const).map((s) => `${slotsFor(s)} for ${SCHOOL_NAMES[s].toLowerCase()} spells`))}.
      New patron spells fill the first empty faith slot, fighting-class spells the first empty class slot, techniques the path slot. Right-click a slot to change or empty it.
      Dark shading: cooldown left.</li>
      <li>Path techniques are called from the Path tab or the rug.</li>
      <li>Targets (each spell says): ${listedOr(SPELL_ONS.map((o) => `<b>${SPELL_ON_WORDS[o]}</b>`))}. Wildermon: any creature not after you; enemy: any wild creature
      (a peaceful wild one is both). Thing: in your pack or set down. Ground spells reach everything within their own tiles of the spot.</li>
      <li>Range: <b>${SPELL_REACH}</b> tiles for anything but you and what you carry.</li>
      <li>Click a slot, or <b>Shift</b> + its number: casts on your target or mark if it takes a creature, else on you or your spot if allowed, else asks for a target.
      Right-click a person, creature, thing or ground: cast any bar spell that takes it.</li>
      <li>The Blessing's ${FAITH_SPELLS.filter((s) => s.patron === 'blessing').length} spells: per faith tier one heal, one guard, one for creatures, things and land.
      Justice's ${FAITH_SPELLS.filter((s) => s.patron === 'justice').length}: one judging its target, one keeping order in a fight, one measuring.
      Chaos's ${FAITH_SPELLS.filter((s) => s.patron === 'chaos').length}: one ruin, one dread, one bargain (paid in your health or items, not favour); none on another person.
      Every spell's numbers: Faith window.</li>
    </ul>
    <h3>The things that are not wildermon</h3>
    <ul>
      <li>${MONSTER_SORTS.length} untameable kinds: <b>goblin</b>, <b>orc</b>, <b>ogre</b>, <b>dragon</b>.</li>
      <li>Notice range ${NOTICED[0]} to ${NOTICED[NOTICED.length - 1]} tiles (other hunters ${HUNT_SIGHT}); they come straight at you and chase far.</li>
      <li><b>Rare</b>: ${percent(MONSTER_SHARE)} of wild spawns; of those ${listed(MONSTERS.map(([id, w]) => `${percent(w / MONSTER_WEIGHT)} ${SPECIES[id].name.toLowerCase()}s`))}.</li>
      <li>Max alive: ${listed(MONSTERS.map(([id]) => `${MONSTER_CAP[id] ?? 1} ${SPECIES[id].name.toLowerCase()}${(MONSTER_CAP[id] ?? 1) === 1 ? '' : 's'}`))}.
      Distance kept from your settlement totem: ${listed(MONSTERS.map(([id]) => `${SPECIES[id].name.toLowerCase()} ${MONSTER_KEEP_OFF[id] ?? 0} tiles`))}.</li>
      <li>Cannot be tamed, trapped, bred or brushed.</li>
      <li>Blow against an unarmoured life: ${listed(MONSTERS.map(([id]) => `${SPECIES[id].name.toLowerCase()} ${percent(Math.round(SPECIES[id].attack * BLOW_SHARE * 100) / 100)}`))}.</li>
      ${REGIONS.filter((R) => R.monsters).map((R) => `<li>${capital(islandName(R.name))}: monster country: every wild spawn is one of these; holds ${mul(R.monsters ?? 1)} the number the rest of the chart shares
      (${listed(MONSTERS.filter(([id]) => (lairOf(id) ?? R) === R).map(([id]) => `${(MONSTER_CAP[id] ?? 1) * (R.monsters ?? 1)} ${SPECIES[id].name.toLowerCase()}${(MONSTER_CAP[id] ?? 1) * (R.monsters ?? 1) === 1 ? '' : 's'}`))}).</li>`).join('')}
      ${REGIONS.filter((R) => R.lair?.length).map((R) => `<li>${capital(listed(R.lair!.map((id) => `${SPECIES[id].name.toLowerCase()}`)))}: only on ${islandName(R.name)}.</li>`).join('')}
      <li>Butchering: the usual yields, plus <b>tusk</b> and <b>sinew</b> (orc, ogre); dragon: ${SPECIES.dragon.butcher.scale ?? 0} <b>dragon scales</b> and a <b>hoard</b> of ${HOARD_LUMPS} to
      ${HOARD_LUMPS + HOARD_MORE} lumps (by carcass kept) of the ${HOARD_DEEP.length} deep metals and ${HOARD_METALS.length - HOARD_DEEP.length} precious ones; the only source of them together.</li>
      <li><b>Composite bow</b>: ${bill('make_composite_bow')}, ${workedAt('make_composite_bow')}. Range <b>${COMPOSITE.range ?? 0}</b> tiles, ${COMPOSITE.damage} damage
      (best wooden bow: ${BEST_WOOD_BOW.range ?? 0} tiles, ${BEST_WOOD_BOW.damage} damage).</li>
      <li><b>Scale armour</b> (dragon scale on leather): stops <b>${percent(ARMOUR_CLASSES.scale.soak)}</b> of a blow (plate ${percent(ARMOUR_CLASSES.plate.soak)}); lighter than chain.
      Full suit: ${SCALE_SUIT} scales; one dragon: ${SPECIES.dragon.butcher.scale ?? 0}.</li>
    </ul>
    <h3>Traps</h3>
    <ul>
      <li>Catches are held <b>alive</b>, blood intact.</li>
      <li><b>Snare</b>: ${billIn(TRAPS.snare.bill)}; holds up to about <b>taming ${TRAPS.snare.holds}</b>. <b>Deadfall</b>: ${billIn(TRAPS.deadfall.bill)}, mallet; up to about
      <b>taming ${TRAPS.deadfall.holds}</b>. Build quality (QL) shifts both a little.</li>
      <li>Set on any spot <b>outside your own borders</b> (nothing wild comes inside), then <b>bait it</b> from the pack; the menu lists which kinds each carried item draws.
      Warier than the trap holds: it takes the bait and leaves.</li>
      <li>Rots in place: snare ${dur(TRAPS.snare.lifeMin)} to ${dur(TRAPS.snare.lifeMax)}, a good deadfall up to ${dur(TRAPS.deadfall.lifeMax)}; a catch inside escapes when it falls.</li>
      <li><b>Timid</b> wildermon ${mul(TIMID_TRAPPED)} as likely to be caught; hunters ${percent(HUNTER_TRAPPED)}.</li>
      <li>Taking the catch out is a <b>taming</b> check at the usual requirement; a failure means another try.</li>
    </ul>
    <h3>Blood, the brush and breeding</h3>
    <h4>Traits</h4>
    <ul>
      <li>Every wildermon: <b>male</b> or <b>female</b>, <b>${TRAIT_SLOTS} traits</b>.</li>
      <li>${TIERS.length} rarities: ${listed(TIERS.map((t) => `<b>${t}</b>`))}. Common: ${percent(TIER_SPAN.common[0])} to ${percent(TIER_SPAN.common[1])} on its number;
      fantastic: ${percent(TIER_SPAN.fantastic[0])} to ${percent(TIER_SPAN.fantastic[1])}.</li>
      <li>What traits change: <b>move</b> speed, <b>work</b> speed, <b>skill</b> gain, <b>carry and pull</b>, <b>yield</b>, <b>food</b> needed, <b>health</b>, <b>hit</b> damage,
      <b>sight</b>, <b>range</b>, <b>fleece and milk</b> regrowth; in a fight: damage taken, chance to be hit, attack speed, wound <b>closing</b>.</li>
      <li><b>Communal</b> (&#9673;): applies to every wildermon on the same settlement or post, the bearer included.</li>
      <li><b>Fighting blood</b> (${FIGHTING.length} traits: fanged, plated, slippery, quick-jawed, quick-healing…): one name in every rarity; its <b>grade</b> is drawn separately on the same odds
      (fanged, fanged (rare), (supreme), (fantastic)), worth ${listed(TIERS.map((t) => mul(GRADE_STEP[t])).slice(1))} the common grade. Bred up a grade at a time.
      ${percent(FIGHT_SHARE)} of wild traits are fighting blood. One grade per name per wildermon.</li>
      <li>${capital(article(itemDef(ARTIFACT_FOR.use_ancient_lamp).name.toLowerCase()))} <b>${itemDef(ARTIFACT_FOR.use_ancient_lamp).name.toLowerCase()}</b>: replaces the lowest-rarity trait with one of that rarity,
      one in ${LAMP_TIER_ODDS} the rarity above (see <b>Digging up the past</b>).</li>
    </ul>
    <h4>Rare wildermon</h4>
    <ul>
      <li>Odds as for made things: ${listed(RARE_STEPS.map((s) => `1 in ${Math.round(1 / rarityChance(s))} ${RARITIES[s].name}`))}. Never monsters. Young: rarity drawn at birth, whatever the parents.</li>
      <li>Size: rare <b>${mul(RARITIES[1].size)}</b>, ${listed(RARE_STEPS.slice(1).map((s) => `${RARITIES[s].name} ${mul(RARITIES[s].size)}`))}; shimmers in its rarity's colour.</li>
      <li>${listed(BLOOD.filter((ch) => ch.up).map((ch) => ch.label))}: up ${listed(RARE_STEPS.map((s) => `<b>${cardPct(RARITIES[s].blood).slice(1)}</b> ${RARITIES[s].name}`))};
      ${listed(BLOOD.filter((ch) => !ch.up).map((ch) => ch.label))}: down ${listed(RARE_STEPS.map((s) => `<b>${cardPct(1 / RARITIES[s].blood).slice(1)}</b> ${RARITIES[s].name}`))};
      on top of traits.</li>
      <li>Wild rare ones draw better traits: better than common ${listed(RARE_STEPS.map((s) => `${percent(Math.round(100 * betterThanCommon(husbandryOdds(0, s))) / 100)} for ${RARITIES[s].name}`))}
      (ordinary ${percent(Math.round(100 * betterThanCommon(husbandryOdds(0, 0))) / 100)}).</li>
      <li>Rarity shown on its card, the Wildermon window and <b>Look it over</b>.</li>
    </ul>
    <h4>Care and feeding</h4>
    <ul>
      <li><b>Brush</b>: ${bill('make_brush')}, carving knife. <b>Brush a wildermon down</b>: adds <b>care</b> (${CARE_SAID}; works faster, learns faster, heals). Care drains over ${dur(CARE_HOURS * HOUR)}
      left alone.</li>
      <li><b>Feeding</b>: each item of its diet eaten (from your hand or the stores): <b>+${percent(FED_CARE)} care</b> at quality (QL) ${QL_TOP}, proportionally less below; for ${dur(FED_FOR)}:
      <b>learns ${percent(FED_LEARN)} faster</b> at QL ${QL_TOP}, proportionally less; learning bonus ${mul(FED_FAVOURITE)} for its <b>favourite</b> (the first food on its field guide page).</li>
      <li>No stacking: an equal or better meal replaces the effect and restarts the ${dur(FED_FOR)}; a lesser one does nothing. Grazing and whey give neither.
      The card shows its favourite's worth and the time left.</li>
    </ul>
    <h4>Breeding</h4>
    <ul>
      <li>A <b>male</b> and <b>female</b> of one sort within ${PAIR_RANGE} tiles, both <b>grown</b> and <b>fed</b>, neither mated in the last ${dur(BREED_REST)}: <b>Put it to a mate</b>.</li>
      <li>Taken: gestation ${dur(GESTATION)}; the young's traits are fixed at mating (a sire sold, released or eaten meanwhile still counts).</li>
      <li>The young <b>follows you</b> if nothing does; else an <b>empty wildermon crate in your pack</b>; else an <b>empty crate of yours on your settlement</b>, nearest the mother;
      else the wild.</li>
      <li>${TRAIT_SLOTS} slots filled one at a time from the pair's traits. Husbandry sets <b>parent inheritance</b> (${frac(inheritChance(0, 0))} at no skill,
      ${percent(inheritChance(TOP_SKILL, 1))} at ${TOP_SKILL} with a well-brushed pair) and <b>rarity-up chance</b> (none at no skill and no care, ${percent(upgradeChance(TOP_SKILL, 1))} at ${TOP_SKILL}
      with a well-brushed pair). High husbandry also favours the pair's best traits.</li>
      <li><b>Look it over</b> names traits your husbandry can read: common always; ${listed(TIERS.slice(1).map((t, i) => `${t} ${i === 0 ? 'needs ' : ''}${TIER_LEVEL[t] + 1}`))};
      one level less per ${AWARE_TRAIT_STEP} awareness over ${CHAR_START}.
      Unread: <i>something</i>.</li>
      <li>Only females give milk. Young and old ones do not breed.</li>
      <li><b>Pedigree</b> (card and hover): <b>dam</b>, <b>sire</b>, and each readable trait's source: ${PEDIGREE_SOURCES}.</li>
    </ul>
    <h4>Lines and mutations</h4>
    <ul>
      <li>A <b>line</b> per thing a trait can change. Wild: depth one wherever it carries a trait. Young: one deeper than the deeper parent where it carries one, max ${PEDIGREE_MOST};
      none where it carries none.</li>
      <li>Each generation past the first: <b>+${percent(PEDIGREE_STEP)}</b> on its blood there: ${listed(LINE_DEPTHS.map((d) => `${cardPct(depthMul(d, 'tough'))} at depth ${d}`))};
      for ${listed(BLOOD.filter((ch) => !ch.up).map((ch) => ch.label))} (lower is better): ${listed(LINE_DEPTHS.map((d) => cardPct(depthMul(d, 'appetite'))))}.
      Card line: <i>${LINE_EXAMPLE}</i>.</li>
      <li><b>Mutation</b>: one young in ${MUTATION_ODDS}: a trait neither parent has in any grade, one rarity above their best (${listed(TIERS.slice(1).map((t, i) => `${t} for ${TIERS[i]}`))};
      ${TIERS[TIERS.length - 1]} stays ${TIERS[TIERS.length - 1]}), in its lowest-rarity slot. Announced at birth; card marks it <b>mutation</b>.</li>
      <li>Preview (<b>Put it to a mate</b>, before <b>Yes</b>), from the mating's own draw at your husbandry, care and perks: take chance; per trait, inheritance and rarity-up chance;
      chance of each parent trait; best-trait rarity odds; mutation chance and rarity; line depth and carry chance per thing; rarity odds.</li>
    </ul>
    <h4>Herdsman</h4>
    <ul>
      <li>Perks apply to every wildermon they keep, on or off an island; a wildermon changing hands takes the new keeper's.</li>
      <li>Lasting Care: care drains over ${dur((herdsman('Lasting Care')['kept:care_hours'] ?? CARE_HOURS) * HOUR)} instead of ${dur(CARE_HOURS * HOUR)}.</li>
      <li>Well Kept: fully brushed, works and learns ${percent(herdsman('Well Kept')['kept:care_bonus'] ?? CARE_BONUS)} faster instead of ${percent(CARE_BONUS)}.</li>
      <li>Light Eaters: hunger ${percent(1 - (herdsman('Light Eaters')['kept:hunger'] ?? 1))} slower.</li>
      <li>Long-lived: old at ${dur(herdsman('Long-lived')['kept:old_at'] ?? OLD_AT)} instead of ${dur(OLD_AT)}.</li>
      <li>Choose the Sex: <i>For a female young</i> / <i>For a male young</i> under <b>Put it to a mate</b>.</li>
      <li>Twins: one in ${Math.round(1 / (herdsman('Twins')['breed:twins'] ?? 1))} pairings give a second young (into an empty wildermon crate once the first follows you).</li>
      <li>Stud Book: <b>Examine</b> on one of theirs with them: take chance with its would-be mate, and per-trait inheritance and rarity-up chances.</li>
    </ul>
    <h3>Terraforming</h3>
    <h4>Digging and the level</h4>
    <ul>
      <li>Every corner: soil over bedrock. <b>Digging</b> lowers the corner nearest the click (marker) and takes a spadeful of its soil; stops at rock.
      All corners bare: the tile becomes rock (whatever lies there, possibly a seam). Dropping dirt on a corner covers rock again.</li>
      <li><b>Take the level here</b> (right-click a corner): that height becomes the target. <b>Flatten</b> aims at it instead of your own tile.
      <b>Digging</b> and <b>Chip corner</b> stop at the mark going down; <b>dropping dirt</b> and <b>concrete</b> stop at it going up (a repeat run ends when level).
      The Tile window shows the cursor corner's distance from it. <b>Clear the level</b> removes it.</li>
    </ul>
    <h4>Foundations</h4>
    <ul>
      <li>Squares off a sloping tile without moving the ground round it; bare rock only (plain stone, seam or ore): dig every corner's soil off first.
      <b>Set out a foundation</b> is not offered on grass, dirt, any tile with soil on a corner, or a level tile.</li>
      <li>Mallet: shutters it to the highest corner's height, or the level if taken higher. <b>Pour the foundation</b> (trowel): <b>${CONCRETE_PER_STEP}</b> concrete per ${metres(HEIGHT_UNIT)} m each corner is
      raised; the deepest corner needs one point of masonry per <b>${metres(LIFT_PER_MASONRY)} m</b> of it.</li>
      <li>Keeps ${CLEAR_OF_BUILDINGS} tile clear of any building or plan. Poured: packed ground for building or paving, whatever happens round it.</li>
    </ul>
    <h4>Soil</h4>
    <ul>
      <li>Dirt, clay and sand: <b>${itemDef('dirt').weight}kg</b> each; a starting back carries ${Math.floor((CARRY_BASE + CHAR_START * CARRY_PER_STRENGTH) / itemDef('dirt').weight)} before overload.</li>
      <li>Dropping dirt and flattening's fill take a spadeful from any <b>crate, cart or bin within reach</b> when you carry none.</li>
      <li><b>${capital(listed(Object.values(TILE_DEFS).filter((d) => d.collect).map((d) => d.name.toLowerCase())))}</b>: <b>Collect</b> (<i>Collect clay</i>, <i>Collect dirt</i>), standing on it:
      a shovelful off the top; tile type, corner heights and soil unchanged; slightly slower than digging a corner.</li>
      <li><b>Cut moss</b>: <b>${MOSS_PER_CUT} moss</b>; tile stays moss; regrows before the next cut. Digging its corner gives dirt.
      <b>Plant moss</b> on dry <b>dirt</b>: <b>${MOSS_PLANT} moss</b>; farm work; a border-controlled action on a settlement.</li>
      <li>Dirt never regrows grass. <b>Plant grass</b> on dry <b>dirt</b>: <b>${GRASS_PLANT} mixed grass</b>; farm work; border-controlled on a settlement.
      <b>Cut grass</b>: <b>${GRASS_PER_CUT}</b> mixed grass.</li>
      <li><b>Packing</b> (shovel): <b>grass, dirt, lawn, steppe, tundra or moss</b> into <b>packed dirt</b> (turf cut first). Buildings need it; <b>paving</b> (cobblestone, slabs) goes on
      nothing else. Breaking paving with a pickaxe leaves dirt.</li>
    </ul>
    <h4>Seams and mining</h4>
    <ul>
      <li>${SEAMS.length} seam kinds, each needing <b>mining</b>: ${listed(SEAMS.filter((r) => r.level === SEAMS[0].level).map((r) => seamName(r.name)))} from the start;
      ${listed(SEAMS.filter((r) => r.level !== SEAMS[0].level).map((r) => `${seamName(r.name)} at ${r.level}`))}.</li>
      <li><b>Iron: ${percent(seamShare('iron_ore'))} of all seams</b>; the rest share the remainder. Coal burns longer than a log in a campfire.</li>
      <li><b>Mining</b> (pickaxe, bare rock): each biting swing gives shards or metal; the face stays. About <b>one swing in ${Math.round(1 / MINE_COLLAPSE)}</b> the corner drops ${metres(HEIGHT_UNIT)} m
      (you or a mola).</li>
      <li><b>Chip corner</b>: lowers the rock; gives way about one attempt in ${Math.round(1 / CHIP_CHANCE)}. You keep what breaks off either way.</li>
      <li>Every tile has a fixed rock and quality underneath, set at creation. About one land tile in ${Math.round(1 / ORE_DENSITY.land)} carries a seam; one sea tile in
      ${Math.round(1 / ORE_DENSITY.water)}.</li>
      <li><b>Prospecting</b>: marks every ore tile in range, buried or bare; sampling your tile names the rock, the mining level, the max quality (QL) and the depth.
      Range ${PROSPECT_REACH} tiles, one more per ${PROSPECT_STEP} levels. Buried metal must be dug down to first.</li>
      <li>Island-specific ground: ${listed(REGIONS.filter((R) => R.ores.length || (R.stone !== 'rock_shards' && !R.mountain)).map((R) => `${listed([...(R.stone !== 'rock_shards' && !R.mountain ? [R.stone] : []), ...R.ores].map((y) => `<b>${rockName(y)}</b>`))} on ${islandName(R.name)}`))}.
      ${REGIONS.filter((R) => R.mountain).map((R) => `${capital(islandName(R.name))}: plain rock, with <b>${rockName(R.stone)}</b> and ${listed((R.mountain ?? []).map((y) => `<b>${rockName(y)}</b>`))} seams only under its mountain, above the alpine line.`).join(' ')}
      Elsewhere, another island's seam is iron instead.</li>
    </ul>
    <h4>Flatten, decay, skill</h4>
    <ul>
      <li><b>Flatten</b>: brings a tile to your standing height corner by corner; cuts above (dirt to pack), fills below (dirt from pack). On your own tile: to its lowest corner.</li>
      <li>Dropped items lie on your tile (pick up from its menu). Items outside decay, even while away: food within the hour, stone over days; higher QL lasts longer.</li>
      <li>Water skin: fill at any shore.</li>
      <li>Skill gain per ordinary action: about ${listed(GAIN_AT.map((v, i) => `<b>${gainSaid(v)}</b> at ${i === 0 ? 'level ' : ''}${v}`))}:
      ${Math.round(1 / gainAt(GAIN_AT[0]))} actions for the first point, ${Math.round(1 / gainAt(GAIN_AT[2]))} for the point after ${GAIN_AT[2]}, about <b>${Math.round(1 / (MIN_GAIN * GAIN_RATE))}</b>
      for the last. The log shows gains to the fourth decimal.</li>
      <li>Higher skill: faster, more successful actions; steeper slopes shapeable.</li>
    </ul>
    <h3>Garden steps, rose arches and flags</h3>
    <ul>
      <li><b>Garden steps</b>: a flight on a sloping packed-dirt tile; walkable where bare ground is too steep. Slope, highest to lowest corner: <b>${metres(STEPS_LEAST)} to ${metres(STEPS_MOST)} m</b>; end corners within <b>${metres(STEPS_TWIST)} m</b> of each other; climbs toward the higher side.</li>
      <li><b>Lay stone steps</b> (trowel, masonry ${STONE_DIFFICULTY}): ${STONE_STEPS_BILL}, in ${listed(SLAB_VARIANTS.map((v) => v.name.replace(/ slabs$/, '').toLowerCase()))}.
      <b>Lay timber steps</b> (mallet, carpentry ${TIMBER_DIFFICULTY}): ${TIMBER_STEPS_BILL}, in that wood. Several materials carried: the menu asks. On a settlement: needs ${POWER.shape.label}.</li>
      <li>Standable up to slope <b>${metres(STEPS_MOST)} m</b> (bare ground: ${metres(MAX_STAND)} m, +${metresFine(CLIMB_PER_LEVEL)} m per climbing level). Steps on or off ignore the ${metres(MAX_STEP)} m step limit between tile centres;
      only the tile stepped onto must be standable. Wildermon likewise; no carts or wagons.</li>
      <li><b>Take up the steps</b> (pickaxe, paving): ${frac(STEPS_BACK)} back, rounded down (${stepsBack(STEPS_SLABS)} of ${STEPS_SLABS} slabs and ${stepsBack(STEPS_BRICKS)} of ${STEPS_BRICKS} bricks,
      or ${stepsBack(STEPS_PLANKS)} of ${STEPS_PLANKS} planks); leaves packed dirt.</li>
      <li><b>Rose arch</b> (${workedAt('make_rose_arch')}: ${bill('make_rose_arch')}); <b>stone rose arch</b> (${workedAt('make_stone_rose_arch')}, trowel: ${bill('make_stone_rose_arch')}):
      ${furnitureDef('rose_arch').w} subtiles across, ${furnitureDef('rose_arch').h} deep; set down like furniture; walk-through. ${ROSES_RULE} Pointing shows its roses' state and time to the next change.</li>
      <li><b>Flagpole</b> (${workedAt('make_flagpole')}: ${bill('make_flagpole')}): the flag shows wind direction and strength. A <b>banner</b> does too. Dyed before setting down: flies that colour.
      On a settlement: shows its device, one of ${DEVICE_COUNT}, picked by the settlement's name.</li>
    </ul>
    <h3>Springs, ponds and streams</h3>
    <ul>
      <li><b>Dig a spring</b> (shovel, right-click the bottom of a hollow): fills the hollow to its lowest rim point at <b>${metres(FILL_RATE)} m a second</b>.
      The hollow must hold at least <b>${metres(SPRING_DEPTH)} m</b>; one spreading over more than <b>${POND_MOST} corners</b> never fills.</li>
      <li>Full: <b>spills</b> over the lowest point, runs downhill the steepest way to the next hollow, fills it, and so on: into the sea, or into the ground after
      <b>${RUN_MOST} tiles</b> with nothing to fill, a hollow too wide, or <b>${CHAIN_MOST} ponds</b>. Crosses level ground to the nearest way down.
      Falls where it drops <b>${metres(FALL_DROP)} m</b> or more between corners.</li>
      <li>A pond is water for everything (buckets, skins, drinking, fishing). Nothing built or planted in one; no launching. Deeper than <b>${metres(SWIM_DEPTH)} m</b>: swim.</li>
      <li>Follows the ground: a notch in the rim lowers it; deeper digging deepens it; filling the hollow stops the spring. <b>Stop up the spring</b> removes it and its water.</li>
      <li>Max <b>${SPRINGS_EACH}</b> springs per person. Off a settlement only the digger may stop one; on one, whoever may shape its ground may dig or stop any, nobody else.</li>
      <li><b>Dig a pool</b> (pickaxe, in a poured foundation): water <b>${metres(POOL_DEPTH - POOL_LIP)} m</b> deep, <b>${metres(POOL_LIP)} m</b> under the slab top, spring or not.
      Adjacent pools in foundations of the same top join. Clear the slab first.</li>
      <li>Spring in a pool: overflows its lowest edge, down the slab face (falling at <b>${metres(FALL_DROP)} m</b> or more) or into a lower neighbouring pool, then downhill as usual.
      No lower neighbour: it keeps its water.</li>
      <li>A foundation with no pool blocks water; one poured over a spring stops it. <b>Fill the pool in</b>: trowel, <b>${POOL_FILL}</b> concrete; stops its spring.</li>
      <li><b>Aqueduct</b>: takes all a pond's or pool's water elsewhere, ${AQUEDUCT_FLOW} litres a minute (see Aqueducts).</li>
    </ul>
    ${waterGarden()}
  `;
}

/** The water garden: stepping stones, the tiered fountain, and water lilies and lotus. */
function waterGarden(): string {
  const lily = WATER_PLANT_BY_ID.get('lily') as WaterPlantDef;
  const lotus = WATER_PLANT_BY_ID.get('lotus') as WaterPlantDef;
  const lotusDye = DYESTUFF_OF.get(lotus.flower);
  const reach = WATER_GARDEN_ACTIONS.find((a) => a.id === `plant_${lily.id}`)?.range ?? 1;
  const perMinute = (litres: number): string => (litres * 60).toFixed(1);
  const stones = SLAB_VARIANTS.map((v) => v.name.replace(/ slabs$/, '').toLowerCase());
  const stonesOf = `${stones.slice(0, -1).join(', ')} or ${stones[stones.length - 1]}`;
  return `
    <h3>A water garden: stepping stones, a fountain, lilies and lotus</h3>
    <h4>Stepping stones</h4>
    <ul>
      <li><b>Lay stepping stones</b> (trowel in pack): masonry difficulty ${STONES_DIFFICULTY}; <b>${STONES_SLABS}</b> cut slab a tile of ${stonesOf} (sets their colour).</li>
      <li>On shallow water (sea edge, pond, stream-covered ground) where the water at the tile's middle is <b>${metres(STONES_DEPTH)} m</b> deep or less (swimming starts at
      <b>${metres(SWIM_DEPTH)} m</b>); on bare ground or flat growth only, never paving, a field or anything standing.</li>
      <li>Walking: <b>${percent(ground(TileType.SteppingStones).speed / ground(TileType.Grass).speed)}</b> of grass speed; no wading or swimming whatever the depth around.
      A loaded cart loses ${frac(rollCost(TileType.SteppingStones))} of its speed.</li>
      <li><b>Take up the stepping stones</b>: the slab back; ground as it was.</li>
    </ul>
    <h4>Tiered fountain</h4>
    <ul>
      <li>Masonry: ${bill('make_fountain')}. <b>A well in every rule</b>: draws <b>${perMinute(WELL_TRICKLE)}</b> litres a minute at the least, <b>${perMinute(WELL_TRICKLE + WELL_TRICKLE_QL)}</b>
      at quality (QL) ${TOP_QL}, up to <b>${furnitureDef('fountain').well} litres</b>. Fill a bucket or waterskin, or drink.</li>
    </ul>
    <h4>Water lilies and lotus</h4>
    <ul>
      <li>Botanizing on a tile with or beside still water (sea, pond, pool): <b>${itemDef(lily.from).name.toLowerCase()}</b> about 1 find in ${watersideOdds(lily.from)};
      <b>${itemDef(lotus.from).name.toLowerCase()}</b> 1 in ${watersideOdds(lotus.from)}; plus the usual finds.</li>
      <li>Plant within ${reach} tiles in a pond, pool or the sea's shallows, water <b>${metres(WATER_PLANT_SHALLOWEST)} to ${metres(WATER_PLANT_DEEPEST)} m</b> deep; never in running water,
      one a tile, not among stepping stones.</li>
      <li>Leaves at once (in season); <b>roots in ${dur(WATER_ROOTING)}</b>; then follows the island's year, the same for everybody.</li>
      <li>Water lily: ${yearSays(lily)}. Lotus: ${yearSays(lotus)}.</li>
      <li>In ${listed(SEASONS.filter((sn) => !lily.leaves.includes(sn) && !lotus.leaves.includes(sn)))}: root only, under water; leaves return in
      ${SEASONS.find((sn) => lily.leaves.includes(sn) && lotus.leaves.includes(sn))}.</li>
      <li><b>Pick</b> a flower or seed head: gone until the season turns.</li>
      <li>${boilCountPlain(lotus.flower)} lotus flowers (${kgSaid(dyeGrams(BOIL_LITRES, DYE_LITRES_PER_KG))} kg) + a bucket of lye: ${BOIL_LITRES} litres of <b>${lotusDye?.primary}</b> dye.
      Water lily flowers: no use.</li>
      <li>Seed head: <b>${lotus.seedCount ?? 0} ${itemDef(lotus.seed ?? '').name.toLowerCase()}</b>: plant, or eat: raw ${percent(itemDef(lotus.seed ?? '').food ?? 0)} of the food bar;
      roasted at a campfire (${need('roast_lotus_seeds', lotus.seed ?? '')} a handful) ${percent(itemDef('roast_lotus_seeds').food ?? 0)}.</li>
      <li><b>Pull it up</b>: the root or seed back.</li>
    </ul>
  `;
}

/**
 * The help, cut into sections at every heading, with a list of contents folded
 * at the top and a box to search the lot. Searching keeps whole sections rather
 * than single lines, because half an explanation is worse than none, and marks
 * where in them it was found.
 */
/** What the help can be asked to do once it is built: open at a section. */
export interface HelpPages {
  /** Every section's heading, in order. */
  titles: string[];
  /** Clear any search and put the section with this heading at the top. */
  jump(title: string): void;
  /** Search the help for this, as the box at its top does; false when no section answers. */
  search(query: string): boolean;
}

export function buildHelp(host: HTMLElement): HelpPages {
  host.classList.add('help-body');
  const holder = document.createElement('div');
  holder.innerHTML = helpText();
  // Gather the run of nodes under each heading into a section of its own.
  const sections: Array<{ title: string; el: HTMLElement }> = [];
  let current: HTMLElement | null = null;
  for (const node of [...holder.childNodes]) {
    if (node instanceof HTMLHeadingElement && node.tagName === 'H3') {
      current = document.createElement('section');
      current.className = 'help-sec';
      current.id = `help-${sections.length}`;
      current.append(node);
      sections.push({ title: node.textContent ?? '', el: current });
      continue;
    }
    if (current) current.append(node);
    else if (node.nodeType !== Node.TEXT_NODE || (node.textContent ?? '').trim()) holder.removeChild(node);
  }

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'panel-search help-search';
  search.placeholder = 'Search the help…';
  search.setAttribute('aria-label', 'Search the help');
  // The contents fold away under a line that opens them, so the pages have the room.
  const toc = document.createElement('button');
  toc.type = 'button';
  toc.className = 'help-toc';
  toc.setAttribute('aria-controls', 'help-contents');
  const contents = document.createElement('nav');
  contents.className = 'help-contents';
  contents.id = 'help-contents';
  const pages = document.createElement('div');
  pages.className = 'help-pages';
  const count = document.createElement('div');
  count.className = 'help-count';
  count.hidden = true;

  const fold = (open: boolean): void => {
    contents.hidden = !open;
    toc.setAttribute('aria-expanded', String(open));
  };
  toc.addEventListener('click', () => fold(toc.getAttribute('aria-expanded') !== 'true'));
  fold(false);

  const links = sections.map(({ title, el }, i) => {
    const a = document.createElement('button');
    a.type = 'button';
    a.className = 'help-link';
    a.textContent = title;
    a.addEventListener('click', () => {
      // Clear any search first, so the section being jumped to is on the page.
      if (search.value) {
        search.value = '';
        show('');
      }
      fold(false);
      el.scrollIntoView({ block: 'start' });
      el.classList.add('help-found');
      setTimeout(() => el.classList.remove('help-found'), 1200);
    });
    a.title = `Jump to “${title}” (section ${i + 1} of ${sections.length})`;
    return a;
  });
  contents.append(...links);

  /** Take out the marks of the last search, then mark every place this one is found in the sections still shown. */
  const mark = (q: string): HTMLElement | null => {
    const was = new Set<Node>();
    for (const m of pages.querySelectorAll('mark.help-mark')) {
      if (m.parentNode) was.add(m.parentNode);
      m.replaceWith(...m.childNodes);
    }
    for (const parent of was) parent.normalize();
    if (q.length < 2) return null;
    for (const { el } of sections) {
      if (el.hidden) continue;
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const found: Text[] = [];
      for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.nodeValue?.toLowerCase().includes(q)) found.push(n as Text);
      for (let text of found) {
        for (let at = text.data.toLowerCase().indexOf(q); at >= 0; at = text.data.toLowerCase().indexOf(q)) {
          const hit = text.splitText(at);
          text = hit.splitText(q.length);
          const m = document.createElement('mark');
          m.className = 'help-mark';
          hit.replaceWith(m);
          m.append(hit);
        }
      }
    }
    return pages.querySelector<HTMLElement>('mark.help-mark');
  };

  /** Keep only the sections that answer to what has been typed, mark where, and say how many did. */
  const show = (query: string): number => {
    const q = query.trim().toLowerCase();
    let kept = 0;
    for (let i = 0; i < sections.length; i += 1) {
      const { title, el } = sections[i];
      const hit = !q || `${title} ${el.textContent ?? ''}`.toLowerCase().includes(q);
      el.hidden = !hit;
      links[i].hidden = !hit;
      if (hit) kept += 1;
    }
    toc.textContent = q ? `Contents: ${kept} of ${sections.length} sections` : `Contents: ${sections.length} sections`;
    toc.hidden = q !== '' && !kept;
    count.hidden = !q || kept > 0;
    count.textContent = `Nothing in the help answers to “${query.trim()}”. Esc in the box clears the search.`;
    pages.scrollTop = 0;
    // The first place it is found: its section from the heading when it is near the top of it, or else the line before it on.
    const first = mark(q);
    const sec = first?.closest<HTMLElement>('.help-sec');
    if (first && sec) {
      const top = pages.getBoundingClientRect().top;
      const k = pages.offsetHeight / (pages.getBoundingClientRect().height || 1);
      const into = (first.getBoundingClientRect().top - sec.getBoundingClientRect().top) * k;
      const from = into < pages.clientHeight * 0.6 ? sec : first;
      pages.scrollTop = Math.max(0, (from.getBoundingClientRect().top - top) * k - (from === sec ? 0 : 40));
    }
    return kept;
  };
  search.addEventListener('input', () => show(search.value));
  search.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key !== 'Escape') return;
    search.value = '';
    show('');
  });
  keepControlKeys(host);

  pages.append(...sections.map((s) => s.el));
  show('');
  host.replaceChildren(search, toc, contents, count, pages);
  return {
    titles: sections.map((s) => s.title),
    jump: (title) => {
      const i = sections.findIndex((s) => s.title === title);
      if (i >= 0) links[i].click();
    },
    search: (query) => {
      search.value = query;
      return show(query) > 0;
    },
  };
}
