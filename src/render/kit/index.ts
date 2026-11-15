import type { KitPiece } from './core';
import { ALTAR } from './altar';
import { HIVE, SKEP } from './apiary';
import { BANNER, FLAGPOLE } from './banners';
import { BARREL, LARGE_BARREL, SMALL_BARREL } from './barrel';
import { BED, COT, TENT } from './beds';
import { BELL } from './bell';
import { BULK_BIN, CRAFT_BIN, SEED_BIN, SPROUT_BIN } from './bins';
import { BRAZIER } from './brazier';
import { CUPBOARD, LARDER, WARDROBE } from './cases';
import { CHAIR } from './chair';
import { CHEST } from './chest';
import { COFFER } from './coffer';
import { BUTTER_CHURN, LOOM, PAPER_PRESS, POTTERS_WHEEL, SPINDLE } from './crafts';
import { CREATURE_CRATE } from './creature-crate';
import { FIREWOOD_RACK } from './firewood';
import { FOUNTAIN } from './fountain';
import { GRAVE } from './grave';
import { ASH_VENT, CINDER_VENT, DRAGON_ROOST, GOBLIN_WARREN, MAGMA_VENT, OGRE_CAVE, ORC_CAMP } from './lairs';
import { ASH_LORD_VEIL, CHIEF_EAR, CINDER_ALPHA_FANG, GREAT_DRAGON_SCALE, MAGMA_CORE, OGRE_KING_JAW, WARLORD_TUSK } from './trophies';
import { LAMP_PILLAR, LAMP_POST } from './lamps';
import { MAILBOX } from './mailbox';
import { OVEN } from './oven';
import { PLANTER } from './planter';
import { FISH_POND } from './pond';
import { LAVENDER_ARCH, ROSE_ARCH, STONE_LAVENDER_ARCH, STONE_ROSE_ARCH } from './rosearch';
import { BENCH, STOOL } from './seating';
import { BOOKSHELF, CRATE_SHELF, SHELVES } from './shelving';
import { GREAT_SIGN, SIGN } from './signs';
import { STALL } from './stall';
import { COAT_RACK, LECTERN } from './stands';
import { STATUE } from './statue';
import { DESK, LONG_TABLE, TABLE } from './tables';
import { TRASH_CRATE } from './trash';
import { TRELLIS } from './trellis';
import { WELL } from './well';
import {
  ARBOUR_BENCH, BIRDHOUSE, BONSAI, CARVED_FIGURE, FLOWER_BED, FLOWER_CART, FOLDING_SCREEN, HANGING_BASKET, HEDGE, HERB_BOX, PLANT_STAND, POTTED_FERN, POTTED_PALM,
  TOPIARY_TUB, TROPHY_PLAQUE, WIND_CHIME, WINDOW_BOX, WISTERIA_PERGOLA, OBSIDIAN_CHIME,
} from './garden';
import { HAMMOCK, ROPE_WALK_PIECE } from './ropework';
import { ARMOUR_STAND, COMPOST_BIN, CURTAINS, STONE_LANTERN, SUNDIAL, WOVEN_RUG } from './decor';
import {
  BIRDBATH, CAIRN, FIREPLACE, FISH_MOUNT, FOOTSTOOL, FOUR_POSTER, GARDEN_SWING, GAZEBO, HAY_BALE, SIDE_TABLE, SIGNPOST, STONE_BENCH, VASE, WATER_TROUGH,
} from './furnish';
import {
  ARCHERY_TARGET, LANTERN_POLE, MOORING_POST, MOSS_BOULDER, SPICE_SHELF, STONE_BUST, TRAINING_DUMMY, TREE_BENCH, WINDOW_SEAT,
} from './fittings';
import {
  BUOY, CAULDRON_HEARTH, CHEESE_RACK, GAME_TABLE, GARDEN_OBELISK, GEM_LAMP, HERB_SPIRAL, IVY_PANEL, LILY_POND, NAMEPLATE, PEDIGREE_BOARD, PELT_RUG, PLUSH,
} from './adorn';
import {
  BLACK_LANTERN, DRAGON_FOUNTAIN, EMBER_ORB, LAVA_LAMP, OBSIDIAN_BUST, OBSIDIAN_OBELISK, OBSIDIAN_THRONE, OBSIDIAN_VASE, SHARD_GARDEN, SHARD_PATH,
} from './obsidian';

/**
 * Every piece of furniture drawn in the kit, by its kind (`FurnitureDef.id`).
 * A kind here is drawn by `kitpieces.ts` and never by its old model in
 * `MODELS` (furniture.ts), which stays only until the kit's is reviewed.
 * One line a piece: see `docs/kit-pieces.md`.
 */
export const KIT_PIECES: Readonly<Record<string, KitPiece>> = {
  chair: CHAIR,
  chest: CHEST,
  stool: STOOL,
  bench: BENCH,
  table: TABLE,
  long_table: LONG_TABLE,
  desk: DESK,
  lectern: LECTERN,
  coat_rack: COAT_RACK,
  sign: SIGN,
  great_sign: GREAT_SIGN,
  barrel: BARREL,
  small_barrel: SMALL_BARREL,
  large_barrel: LARGE_BARREL,
  bulk_bin: BULK_BIN,
  craft_bin: CRAFT_BIN,
  seed_bin: SEED_BIN,
  sprout_bin: SPROUT_BIN,
  trash_crate: TRASH_CRATE,
  firewood_rack: FIREWOOD_RACK,
  planter: PLANTER,
  bed: BED,
  cot: COT,
  tent: TENT,
  potters_wheel: POTTERS_WHEEL,
  spindle: SPINDLE,
  loom: LOOM,
  paper_press: PAPER_PRESS,
  butter_churn: BUTTER_CHURN,
  stall: STALL,
  oven: OVEN,
  brazier: BRAZIER,
  lamp_post: LAMP_POST,
  lamp_pillar: LAMP_PILLAR,
  altar: ALTAR,
  banner: BANNER,
  flagpole: FLAGPOLE,
  fountain: FOUNTAIN,
  hive: HIVE,
  skep: SKEP,
  fish_pond: FISH_POND,
  well: WELL,
  bell: BELL,
  statue: STATUE,
  grave: GRAVE,
  trellis: TRELLIS,
  rose_arch: ROSE_ARCH,
  stone_rose_arch: STONE_ROSE_ARCH,
  lavender_arch: LAVENDER_ARCH,
  stone_lavender_arch: STONE_LAVENDER_ARCH,
  coffer: COFFER,
  cupboard: CUPBOARD,
  wardrobe: WARDROBE,
  shelves: SHELVES,
  bookshelf: BOOKSHELF,
  larder: LARDER,
  crate_shelf: CRATE_SHELF,
  creature_crate: CREATURE_CRATE,
  mailbox: MAILBOX,
  // The garden pieces (`garden.ts`).
  flower_bed: FLOWER_BED,
  window_box: WINDOW_BOX,
  hanging_basket: HANGING_BASKET,
  herb_box: HERB_BOX,
  topiary_tub: TOPIARY_TUB,
  potted_fern: POTTED_FERN,
  potted_palm: POTTED_PALM,
  hedge: HEDGE,
  wisteria_pergola: WISTERIA_PERGOLA,
  bonsai: BONSAI,
  flower_cart: FLOWER_CART,
  birdhouse: BIRDHOUSE,
  arbour_bench: ARBOUR_BENCH,
  carved_figure: CARVED_FIGURE,
  trophy_plaque: TROPHY_PLAQUE,
  folding_screen: FOLDING_SCREEN,
  plant_stand: PLANT_STAND,
  wind_chime: WIND_CHIME,
  // The home pieces (`decor.ts`).
  sundial: SUNDIAL,
  compost_bin: COMPOST_BIN,
  stone_lantern: STONE_LANTERN,
  woven_rug: WOVEN_RUG,
  curtains: CURTAINS,
  armour_stand: ARMOUR_STAND,
  // The furnishings (`furnish.ts`).
  birdbath: BIRDBATH,
  stone_bench: STONE_BENCH,
  garden_swing: GARDEN_SWING,
  gazebo: GAZEBO,
  hay_bale: HAY_BALE,
  water_trough: WATER_TROUGH,
  signpost: SIGNPOST,
  cairn: CAIRN,
  fireplace: FIREPLACE,
  four_poster_bed: FOUR_POSTER,
  vase: VASE,
  side_table: SIDE_TABLE,
  footstool: FOOTSTOOL,
  fish_mount: FISH_MOUNT,
  // The fittings (`fitting.ts`).
  lantern_pole: LANTERN_POLE,
  moss_boulder: MOSS_BOULDER,
  tree_bench: TREE_BENCH,
  spice_shelf: SPICE_SHELF,
  window_seat: WINDOW_SEAT,
  training_dummy: TRAINING_DUMMY,
  archery_target: ARCHERY_TARGET,
  mooring_post: MOORING_POST,
  stone_bust: STONE_BUST,
  // The adornments (`adorn.ts`), and the nameplate a wildermon bed wears.
  lily_pond: LILY_POND,
  ivy_panel: IVY_PANEL,
  garden_obelisk: GARDEN_OBELISK,
  herb_spiral: HERB_SPIRAL,
  buoy: BUOY,
  cauldron_hearth: CAULDRON_HEARTH,
  cheese_rack: CHEESE_RACK,
  pelt_rug: PELT_RUG,
  plush_wildermon: PLUSH,
  game_table: GAME_TABLE,
  gem_lamp: GEM_LAMP,
  pedigree_board: PEDIGREE_BOARD,
  worker_nameplate: NAMEPLATE,
  // The obsidian pieces (`obsidian.ts`); its wind chime hangs with the wind chime (`garden.ts`).
  black_glass_lantern: BLACK_LANTERN,
  obsidian_throne: OBSIDIAN_THRONE,
  obsidian_obelisk: OBSIDIAN_OBELISK,
  dragon_glass_fountain: DRAGON_FOUNTAIN,
  shard_garden: SHARD_GARDEN,
  obsidian_vase: OBSIDIAN_VASE,
  lava_lamp: LAVA_LAMP,
  obsidian_wind_chime: OBSIDIAN_CHIME,
  obsidian_bust: OBSIDIAN_BUST,
  glass_shard_path: SHARD_PATH,
  ember_orb: EMBER_ORB,
  // Ropemaking's pieces (`ropework.ts`).
  hammock: HAMMOCK,
  rope_walk: ROPE_WALK_PIECE,
  goblin_warren: GOBLIN_WARREN,
  orc_camp: ORC_CAMP,
  ogre_cave: OGRE_CAVE,
  dragon_roost: DRAGON_ROOST,
  chief_ear: CHIEF_EAR,
  warlord_tusk: WARLORD_TUSK,
  ogre_king_jaw: OGRE_KING_JAW,
  great_dragon_scale: GREAT_DRAGON_SCALE,
  // Volcano Isle's vents and their trophies (`volcano.ts`).
  ash_vent: ASH_VENT,
  magma_vent: MAGMA_VENT,
  cinder_vent: CINDER_VENT,
  ash_lord_veil: ASH_LORD_VEIL,
  magma_core: MAGMA_CORE,
  cinder_alpha_fang: CINDER_ALPHA_FANG,
};
