import type { Game } from './game';
import { INGOT_LUMPS, ingotOf, METAL_BY_LUMP, MOULD_BY_MAKES, type MouldDef } from './metal';
import { CRAFT_REACH, needOf, RECIPE_BY_ID, RECIPES, type Recipe } from './recipes';

/**
 * A shopping list: everything a thing takes, down to what is gathered.
 *
 * The tree that pops out of a missing part (`recipetree.ts`) answers "how is
 * this made", one branch at a time, each branch measured against everything
 * at hand. A list has to answer "what do I still have to fetch", which is
 * the same walk with two differences: what is at hand is spent once, by the
 * first branch to want it, so a nail in the pack is not counted under the
 * wagon, under each wheel and under each yoke; and what is short at the
 * bottom of every branch is added up into one line a thing.
 *
 * What is at hand is what a craft reaches: the pack, its bags, and with
 * Settings' Use stores within reach on, the stores within `CRAFT_REACH`
 * tiles. A thing no recipe makes is either gathered (a log, ore, clay) or
 * cast at a smelter and beaten out on an anvil (a nail, a ribbon, an axle),
 * and the second says how many lumps of metal its moulds take.
 */
export interface ShoppingEntry {
  recipe: string;
  /** How many of what it makes are wanted. */
  count: number;
}

export interface ShopLine {
  item: string;
  /** How many the list takes, all told, and how many of those are at hand. */
  need: number;
  have: number;
}

export interface Shopping {
  /** What is gathered, found or bought: no recipe or mould makes it. */
  gather: ShopLine[];
  /** What is cast at a smelter and beaten out on an anvil, short: pieces, the mould, and lumps of any one metal. */
  cast: Array<{ item: string; count: number; mould: MouldDef; lumps: number }>;
  /** What is made on the way, short: how many, by which recipe. */
  make: Array<{ item: string; count: number; recipe: Recipe }>;
  /** Tools the recipes want in the pack that are not there. */
  tools: string[];
  /** Where the recipes are worked: a campfire, a smelter, a loom. */
  stations: string[];
}

/** How many recipes deep the list goes; past that a thing is listed as it is, to be fetched. */
export const SHOPPING_DEPTH = 8;

const MAKES = new Map<string, Recipe[]>();
for (const r of RECIPES) MAKES.set(r.result, [...(MAKES.get(r.result) ?? []), r]);

/** Everything the entries take, against what is at hand. */
export function shoppingList(g: Game, entries: readonly ShoppingEntry[]): Shopping {
  // What is at hand, spent as the walk goes. A lump counts its ingots too, as a craft does.
  const pool = new Map<string, number>();
  for (const s of g.craftStock(undefined, false, CRAFT_REACH)) {
    pool.set(s.item.id, (pool.get(s.item.id) ?? 0) + s.item.count);
    const metal = [...METAL_BY_LUMP.values()].find((m) => ingotOf(m) === s.item.id);
    if (metal) pool.set(metal.lump, (pool.get(metal.lump) ?? 0) + s.item.count * INGOT_LUMPS);
  }
  const wanted = new Map<string, number>();
  const got = new Map<string, number>();
  const made = new Map<string, { count: number; recipe: Recipe }>();
  const cast = new Map<string, { count: number; mould: MouldDef; fillings: number }>();
  /** What a recipe could make but the walk went no deeper into (a circle, or too deep): fetched as it is. */
  const fetch = new Set<string>();
  const tools = new Set<string>();
  const stations = new Set<string>();
  const add = (m: Map<string, number>, k: string, n: number): void => {
    m.set(k, (m.get(k) ?? 0) + n);
  };

  const work = (r: Recipe, goes: number, depth: number, above: ReadonlySet<string>): void => {
    if (r.tool) tools.add(r.tool);
    if (r.station) stations.add(r.station);
    const next = new Set(above).add(r.result);
    for (const i of r.inputs) want(i.item, needOf(g, r, i) * goes, depth + 1, next);
  };
  const want = (id: string, n: number, depth: number, above: ReadonlySet<string>): void => {
    add(wanted, id, n);
    const take = Math.min(pool.get(id) ?? 0, n);
    if (take > 0) {
      pool.set(id, (pool.get(id) ?? 0) - take);
      add(got, id, take);
    }
    const short = n - take;
    if (short <= 0) return;
    // Made at a bench, unless that goes round in a circle or too deep: the first recipe that does not want the thing itself.
    const r = depth < SHOPPING_DEPTH && !above.has(id) ? (MAKES.get(id) ?? []).find((x) => !x.inputs.some((i) => i.item === id)) : undefined;
    if (r) {
      const per = Math.max(1, g.madeAGo(r));
      const goes = Math.ceil(short / per);
      const was = made.get(id);
      made.set(id, { count: (was?.count ?? 0) + short, recipe: r });
      work(r, goes, depth, above);
      return;
    }
    const mould = MOULD_BY_MAKES.get(id);
    if (mould) {
      const was = cast.get(id);
      const count = (was?.count ?? 0) + short;
      cast.set(id, { count, mould, fillings: Math.ceil(count / Math.max(1, mould.per ?? 1)) });
      return;
    }
    fetch.add(id);
  };

  for (const e of entries) {
    const r = RECIPE_BY_ID.get(e.recipe);
    if (!r) continue;
    work(r, Math.ceil(e.count / Math.max(1, g.madeAGo(r))), 0, new Set());
  }

  const gather: ShopLine[] = [];
  // What nothing makes, short or not (so what is already in hand reads as such), and what the walk stopped at.
  for (const [item, need] of wanted) {
    if (made.has(item) || cast.has(item)) continue;
    if ((MAKES.has(item) || MOULD_BY_MAKES.has(item)) && !fetch.has(item)) continue;
    gather.push({ item, need, have: got.get(item) ?? 0 });
  }
  gather.sort((a, b) => (b.need - b.have) - (a.need - a.have) || a.item.localeCompare(b.item));
  return {
    gather,
    cast: [...cast].map(([item, c]) => ({ item, count: c.count, mould: c.mould, lumps: c.fillings * c.mould.lumps })),
    make: [...made].map(([item, m]) => ({ item, count: m.count, recipe: m.recipe })),
    tools: [...tools].filter((t) => !g.inventory.items.some((it) => it.id === t)),
    stations: [...stations],
  };
}
