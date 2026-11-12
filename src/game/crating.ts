/**
 * Shutting a wildermon in a crate, and finding an empty crate to shut it in:
 * the player's crate actions (`creaturecrate.ts`), a trap's catch (`traps.ts`)
 * and a birth (`creatures.ts`) all use them.
 *
 * A leaf, so the wildermon's rules can crate one without loading the crate's
 * actions, which say them on.
 */
import type { Creature } from './creatures';
import { furnitureCentre, type PlacedFurniture } from './furniture';
import type { Game } from './game';
import type { Item } from './items';

export const CREATURE_CRATE = 'creature_crate';

/** An empty wildermon crate in the pack, the first there is. */
export const emptyCrate = (g: Game): Item | undefined =>
  g.inventory.items.find((it) => it.id === CREATURE_CRATE && it.creature === undefined);

/** An empty wildermon crate of yours standing on your settlement, the nearest to (x, y) there is. */
export function standingCrate(g: Game, x: number, y: number): PlacedFurniture | undefined {
  let best: PlacedFurniture | undefined;
  let bestD = Infinity;
  for (const f of g.furniture.values()) {
    if (f.kind !== CREATURE_CRATE || f.creature !== undefined || f.mine === false || !g.onDeed(f.x, f.y)) continue;
    const [cx, cy] = furnitureCentre(f);
    const d = Math.hypot(cx - x, cy - y);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

/**
 * Shut a wildermon in a crate. Whatever it was carrying is put down where it
 * stood, and a post it was at is let go. It stops where it is, and it does
 * not get hungry while it is in there.
 */
export function shutIn(g: Game, c: Creature, crate: Item | PlacedFurniture): void {
  g.clearPost(c);
  // Every load of a trip in its arms, not only the last.
  for (const it of takeArms(c)) g.dropOnGround(Math.floor(c.x), Math.floor(c.y), it);
  c.mode = 'stored';
  c.around = null;
  c.enemy = null;
  c.state = 'idle';
  c.moving = false;
  c.until = g.time;
  crate.creature = c.id;
  if ('kind' in crate) {
    const [cx, cy] = furnitureCentre(crate);
    c.x = cx;
    c.y = cy;
    g.events.emit('world', crate.x, crate.y);
  } else {
    c.x = g.player.x;
    c.y = g.player.y;
  }
  g.events.emit('creature');
}

/** Everything in its arms, and its arms emptied: what it puts down when it stops working, the loads of a trip and all. */
export function takeArms(c: Pick<Creature, 'carrying' | 'laden' | 'homeward'>): Item[] {
  const all = [...(c.carrying ? [c.carrying] : []), ...(c.laden ?? [])];
  c.carrying = null;
  c.laden = undefined;
  c.homeward = false;
  return all;
}
