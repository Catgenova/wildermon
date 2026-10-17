/**
 * Where building finds what it lays: the pack, a crate on the tile, and the
 * stores within reach (`buildReach`). Kept apart from the building actions so
 * a bridge's or an aqueduct's work can take from the same places without
 * drawing every building action in after it.
 */
import { MATERIAL_BY_ID, type Bill, type MaterialDef } from './building';
import type { PlacedCrate } from './crates';
import type { Game } from './game';
import { spendOut, type Item } from './items';

const material = (id: string | undefined): MaterialDef | undefined => (id ? MATERIAL_BY_ID.get(id) : undefined);

/**
 * The work site: a crate standing on the tile you are building on.
 *
 * A builder carried everything. Six log walls, at what a log weighs, is trip
 * after trip from the woodpile to the corner of a house, and the crate you
 * tipped them all into is standing on the very tile you are working — which
 * is where a builder's materials have stood since anybody built anything. So
 * the bill draws from a crate on the tile first and from the pack after: the
 * pile on the site is the pile you are building out of.
 *
 * On the tile, not within reach: a crate two tiles off is a store, and walking
 * to it is the point of it being over there.
 */
const siteCrates = (g: Game, x: number, y: number): PlacedCrate[] =>
  [...g.crates.values()].filter((c) => c.x === x && c.y === y);

/**
 * What a perk names building work by: `build_stone` for anything laid with
 * the trowel, `build_wood` for timber (`time:build_stone`, `reach:build_stone`).
 */
export const buildWork = (mat: MaterialDef | undefined): string => `build_${mat?.kind ?? 'wood'}`;

/**
 * How far building reaches into your stores for what it lays, besides the
 * pack and a crate on the tile: as far as a craft does (`CRAFT_REACH`) while
 * work may draw on stores (`fromStores`), so a wagon of logs drawn up beside
 * the wall is built out of where it stands; and on stone, as far as a Mason's
 * Hod Carrier, whichever is further. The island's `build_reach`.
 *
 * Asked for: "building a wall or other building actions should also be able
 * to draw materials from wagon or nearby storage within 3 tiles".
 */
export const buildReach = (g: Game, mat: MaterialDef | undefined): number =>
  Math.max(g.perk(`reach:${buildWork(mat)}`, 0), g.settings.fromStores ? g.craftReach() : 0);

/** The stores building draws on, nearest first: those within `buildReach` that a craft may take from. */
const buildStores = (g: Game, mat: MaterialDef | undefined): Array<{ items: Item[] }> => {
  const reach = buildReach(g, mat);
  return reach > 0 ? g.storesWithin(reach) : [];
};
const takeable = (it: Item, id: string): boolean => it.id === id && it.count > 0 && !it.locked && it.price === undefined;

/** The next item on a bill that is to hand: in the pack, in a crate on the tile, or in a store within `buildReach`. */
export function nextAvailable(g: Game, bill: Bill & { material: string }, at?: { x: number; y: number }): string | null {
  const stores = buildStores(g, material(bill.material));
  for (const [id, n] of Object.entries(bill.needed)) {
    if (n <= 0) continue;
    if (g.inventory.has(id)) return id;
    if (at && siteCrates(g, at.x, at.y).some((c) => c.items.some((it) => it.id === id && it.count > 0))) return id;
    if (stores.some((st) => st.items.some((it) => takeable(it, id)))) return id;
  }
  return null;
}

/**
 * One unit of `id` out of the pack, then a crate on the tile, then the
 * stores within `buildReach`, nearest first: the thing it was taken off, for
 * what it carries with it (a pane's colour, `TINTED_PANE`), or null when
 * there was none to take. A bridge or an aqueduct takes its stuff the same
 * way, with no material.
 */
export function takeUnit(g: Game, id: string, mat: MaterialDef | undefined, at?: { x: number; y: number }): Item | null {
  if (g.inventory.has(id)) {
    // The pile `consume` takes it off: the first loose one, as the island takes the lowest numbered.
    const from = g.inventory.find(id);
    return from && g.inventory.consume(id) ? from : null;
  }
  // Out of the crate on the site, a unit at a time, and the row goes when
  // the last of it does.
  for (const c of siteCrates(g, at?.x ?? 0, at?.y ?? 0)) {
    const i = c.items.findIndex((it) => it.id === id && it.count > 0);
    if (i < 0) continue;
    const it = c.items[i];
    it.count -= 1;
    if (it.count <= 0) c.items.splice(i, 1);
    return it;
  }
  for (const st of buildStores(g, mat)) {
    const it = st.items.find((x) => takeable(x, id));
    if (it && spendOut(st.items, it.uid, 1)) {
      g.events.emit('crate');
      return it;
    }
  }
  return null;
}

/**
 * One unit off a bill, of whatever is next and to hand: what it was, or null.
 * `took` is told the thing it came off, for what that carries with it.
 */
export function consumeUnit(g: Game, bill: Bill & { material: string }, at?: { x: number; y: number },
  took?: (from: Item) => void): string | null {
  const id = nextAvailable(g, bill, at);
  const from = id ? takeUnit(g, id, material(bill.material), at) : null;
  if (!id || !from) return null;
  bill.needed[id] -= 1;
  took?.(from);
  return id;
}

/** How much of `id` is to hand for a bill: the pack, a crate on the tile, and the stores within `buildReach`. */
export function toHand(g: Game, id: string, mat: MaterialDef | undefined, at: { x: number; y: number }): number {
  let n = g.inventory.count(id);
  for (const c of siteCrates(g, at.x, at.y)) for (const it of c.items) if (it.id === id) n += it.count;
  for (const st of buildStores(g, mat)) for (const it of st.items) if (takeable(it, id)) n += it.count;
  return n;
}
