/**
 * A lair and a cleared lair's hoard chest, as pieces (`lairs.ts`): what may be asked of either, in the island's words
 * (`lair_refusal`).
 *
 * Asked for: "goblin warrens should not be able to be picked up or renamed", and "when all the mobs are cleared create
 * the loot chest in place of the warren". Nothing at all is asked of a lair: no picking up, naming, moving, turning,
 * dyeing, repairing, filling or padlocking; its menu is Examine of its tile. The chest is taken from, one thing or all,
 * by anybody, and nothing else: its menu is Open, Take all and Examine. Asked in `Game.requestAction`, the one door
 * every way of starting an action goes through, so a drag into the pack or into the chest is refused there too.
 */
import type { Target } from './actions';
import { FURNITURE_BY_ID, type PlacedFurniture } from './furniture';
import type { Game } from './game';
import { LAIR_BY_ID, LAIR_CHEST_OPENS, LAIR_CHEST_SHUT, lairShutSaid, type LairSeen } from './lairs';

/** Whether a piece is a lair (`FurnitureDef.lair`). */
export const isLairPiece = (f: { kind: string }): boolean => !!FURNITURE_BY_ID.get(f.kind)?.lair;
/** Whether a piece is a cleared lair's hoard chest (`FurnitureDef.lairChest`). */
export const isLairChest = (f: { kind: string }): boolean => !!FURNITURE_BY_ID.get(f.kind)?.lairChest;
/** Either: a piece the island sets down at a lair, which nobody moves, names or works. */
export const isLairOwn = (f: { kind: string }): boolean => isLairPiece(f) || isLairChest(f);

/** The lair or hoard chest an action is aimed at: the piece itself, a thing lying in it, or one a thing is put into. */
export function lairPieceAt(g: Game, t: Target): PlacedFurniture | undefined {
  if (t.kind === 'furniture') {
    const f = g.furniture.get(t.id);
    return f && isLairOwn(f) ? f : undefined;
  }
  if (t.kind !== 'item') return undefined;
  if (!g.inventory.get(t.uid)) {
    const piece = g.storeWith(t.uid)?.piece;
    if (piece && isLairOwn(piece)) return piece;
  }
  if (t.into !== undefined) {
    const f = g.furniture.get(t.into);
    if (f && isLairOwn(f)) return f;
  }
  return undefined;
}

/** Why this cannot be asked of this lair or chest, or null when it may: only taking out of a chest. */
export function lairPieceSays(f: PlacedFurniture, actionId: string): string | null {
  if (isLairChest(f)) return LAIR_CHEST_OPENS.has(actionId) ? null : LAIR_CHEST_SHUT;
  return lairShutSaid(LAIR_BY_ID.get(f.kind)?.name ?? FURNITURE_BY_ID.get(f.kind)?.name ?? f.kind);
}

/** Why this cannot be asked of the lair or chest it is aimed at; null when it is aimed at neither, or may be. */
export function lairPieceRefusal(g: Game, actionId: string, t: Target): string | null {
  const f = lairPieceAt(g, t);
  return f ? lairPieceSays(f, actionId) : null;
}

/** The lair a hoard chest stands for, of those this body has seen: the one on its tile. */
export const chestLair = (f: PlacedFurniture, seen: readonly LairSeen[]): string | undefined => {
  const l = seen.find((s) => s.x === f.x && s.y === f.y);
  return l ? LAIR_BY_ID.get(l.kind)?.name : undefined;
};
