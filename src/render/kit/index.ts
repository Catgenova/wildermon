import type { KitPiece } from './core';

/**
 * Every piece of furniture drawn in the kit, by its kind (`FurnitureDef.id`).
 * A kind here is drawn by `kitpieces.ts` and never by its old model in
 * `MODELS` (furniture.ts), which stays only until the kit's is reviewed.
 * One line a piece: see `docs/kit-pieces.md`.
 */
export const KIT_PIECES: Readonly<Record<string, KitPiece>> = {
};
