import type { PlacedFurniture } from './furniture';

/**
 * What a module adds to the line under a piece's name (`furnitureState`),
 * after what the piece says of itself: a trellis's vine (`vineyard.ts`) and
 * a barrel of wine's age (`ageing.ts`). Kept here, with nothing imported, so
 * that a module with rules of its own can say something of a piece without
 * `furniture.ts` importing it back.
 */
export const STATE_TAILS: Array<(f: PlacedFurniture) => string> = [];
