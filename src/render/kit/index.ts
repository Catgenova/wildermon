import type { KitPiece } from './core';
import { ALTAR } from './altar';
import { HIVE, SKEP } from './apiary';
import { BANNER, FLAGPOLE } from './banners';
import { BARREL, LARGE_BARREL, SMALL_BARREL } from './barrel';
import { BED, COT, TENT } from './beds';
import { BELL } from './bell';
import { BULK_BIN, CRAFT_BIN, SEED_BIN, SPROUT_BIN } from './bins';
import { BRAZIER } from './brazier';
import { CHAIR } from './chair';
import { CHEST } from './chest';
import { BUTTER_CHURN, LOOM, PAPER_PRESS, POTTERS_WHEEL, SPINDLE } from './crafts';
import { FIREWOOD_RACK } from './firewood';
import { FOUNTAIN } from './fountain';
import { GRAVE } from './grave';
import { LAMP_PILLAR, LAMP_POST } from './lamps';
import { OVEN } from './oven';
import { PLANTER } from './planter';
import { FISH_POND } from './pond';
import { ROSE_ARCH, STONE_ROSE_ARCH } from './rosearch';
import { BENCH, STOOL } from './seating';
import { GREAT_SIGN, SIGN } from './signs';
import { STALL } from './stall';
import { COAT_RACK, LECTERN } from './stands';
import { STATUE } from './statue';
import { DESK, LONG_TABLE, TABLE } from './tables';
import { TRASH_CRATE } from './trash';
import { TRELLIS } from './trellis';
import { WELL } from './well';

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
};
