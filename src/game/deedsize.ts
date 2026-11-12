/**
 * How big a settlement is at each level, and how far apart they stand.
 *
 * A leaf, so that the modules `game.ts` is built out of (the deed's actions,
 * the action list) can read them without reaching back into it: `game.ts`
 * says them on to everybody else as it always has.
 */
import type { Deed } from './game';

export const DEED_RADIUS = 5;
/** Every upgrade pushes the border out this far and takes on one more worker. */
export const DEED_RADIUS_PER_LEVEL = 2;
export const DEED_WORKERS_AT_LEVEL_ONE = 1;
export const MAX_DEED_LEVEL = 5;

export const deedLevel = (d: Deed | null): number => Math.max(1, Math.min(MAX_DEED_LEVEL, d?.level ?? 1));
export const deedRadiusAt = (level: number): number => DEED_RADIUS + (level - 1) * DEED_RADIUS_PER_LEVEL;
export const deedWorkersAt = (level: number): number => DEED_WORKERS_AT_LEVEL_ONE + (level - 1);
/**
 * Asked for: "when forming a new settlement, it must be at least far enough away that the border between that
 * settlement at maximum size and other nearby settlements at max size would be 5 tiles apart". The tiles between two
 * borders at the last level, and the least a new token may stand from another, on one axis or the other: both borders
 * at the last level, the token's own tile and the gap. The island's `deed_gap` and `deed_spacing`.
 */
export const DEED_GAP = 5;
export const DEED_SPACING = 2 * deedRadiusAt(MAX_DEED_LEVEL) + 1 + DEED_GAP;
/**
 * Asked for: "Don't allow new settlements within 100 tiles of a runestone". The least gap between a new token and a
 * runestone, in tiles, from the stone's nearest tile (`stoneGap`). The island's `deed_stone_gap`.
 */
export const DEED_STONE_GAP = 100;
/** The refusal for a token too near a runestone, in the island's words (`deed_refusal`). */
export const deedNearStone = (name: string, gap: number): string =>
  `Too close to ${name}: ${Math.floor(gap)} tiles; ${DEED_STONE_GAP} needed.`;
/** The refusal for a token too near another settlement's, in the island's words (`deed_refusal`). */
export const deedTooClose = (name: string, apart: number): string =>
  `Too close to ${name}: ${apart} tiles token to token; ${DEED_SPACING} needed (borders at level ${MAX_DEED_LEVEL} ${DEED_GAP} tiles apart).`;
