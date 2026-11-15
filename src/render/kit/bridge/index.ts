import type { BridgeStyle } from './core';
import { clay_adobe } from './clay_adobe';
import { clay_bricks } from './clay_bricks';
import { cobblestone } from './cobblestone';
import { footbridge } from './footbridge';
import { log } from './log';
import { marble } from './marble';
import { plank } from './plank';
import { rope } from './rope';
import { sandstone } from './sandstone';
import { slate } from './slate';
import { stone_brick } from './stone_brick';
import { timbercraft } from './timbercraft';

/** Every material bridge's look, by its kind (`BRIDGE_MATERIALS`), the rope bridge's and the garden footbridge's: each in a file of its own. */
export const BRIDGE_STYLES: Record<string, BridgeStyle> = {
  log, plank, timbercraft, cobblestone, slate, marble, sandstone, stone_brick, clay_adobe, clay_bricks, rope, footbridge,
};
