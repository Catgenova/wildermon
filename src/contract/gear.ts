/**
 * What somebody has on, as the island sends it and the figure draws it: one
 * piece per place on the body, by ids out of the browser's own tables
 * (`gearFrom` in `game/worn.ts` checks them).
 */
/** One piece worn or held: its item id, rarity step, material, dye and whether it is enchanted. */
export interface GearPiece {
  id: string;
  rare?: number;
  /** A material's id: a metal, a wood or a stone. */
  material?: string;
  /** The dye's colour, as `#rrggbb`. */
  dye?: string;
  /** Enchanted: a sculpted figure's sword drawn with its engraving lit. */
  enchanted?: boolean;
}
/** The places on a body a piece is worn. */
export type GearSlot = 'head' | 'chest' | 'arms' | 'legs' | 'feet' | 'weapon' | 'offhand' | 'belt' | 'jewel';
/** A body's pieces, by place. */
export type GearLook = Partial<Record<GearSlot, GearPiece>>;
