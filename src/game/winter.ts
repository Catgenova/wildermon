/**
 * Winter on the island: more fur off a carcass, and critter caches to find.
 *
 * Asked for, from a player's winter ideas: "critter caches that you can search
 * for, possibly utilizing tracking" with loot that is not "nuts and roots",
 * and "increased fur gain from butchering could be a nice little perk to
 * winter activity".
 *
 * The season is the island's (`fruitSeason`, the island's `fruit_season`,
 * which a test may pin with `wildermon.season`).
 *
 * Winter fur: in winter a carcass gives `WINTER_FUR` times the fur it would
 * (the island's `winter_fur`, in the butcher branch of `perform_fight`).
 *
 * Critter caches, winter only:
 *
 *   * `cachesFor` the island's size are laid at the first dawn of winter
 *     (`tree_tick`, or the first search of the winter), on tiles of
 *     `CACHE_GROUND`, on land, never on a Runestone or in a building, and no
 *     nearer a settlement than `CACHE_DEED_GAP` tiles. Where they lie is kept
 *     on the island (`critter_cache`, a table nothing may read) and nowhere
 *     else. At the end of winter every one left goes.
 *   * Search for caches (`CACHE_SEARCH`) reads the way to the nearest within
 *     a track's reach (`trackReach`), as finely as a track of your Tracking
 *     reads (`trackReading`); within `cacheSpotAt` tiles it names the tile.
 *     It trains Tracking as a track does.
 *   * Dig up cache (`CACHE_DIG`), on the tile named: the cache is gone for
 *     everybody, and you get `cacheDraws` draws off `CACHE_LOOT` at your
 *     Tracking, at a quality of your Tracking. A full go of Tracking.
 *
 * The island has the same rules off the same numbers (the defs, and
 * `20261105010000_winter_fur_and_critter_caches`) and says the same words;
 * `supabase/test/wintercache.ts` holds the two sides together.
 */
import { fruitSeason } from './fruiting';
import { itemDef } from './items';
import { TileType } from '../world/tiles';
import { TRACK_TIME, trackDistSays, trackLevel, type TrackReading } from './tracking';
import type { Season } from '../world/calendar';
import type { ButcherPart } from './creatures';

/** The season both of these are had in. */
export const WINTER: Season = 'winter';
/** Whether it is winter on the island at `now` (epoch seconds). Before the year is counted there is no winter. */
export const winterNow = (now: number): boolean => fruitSeason(now) === WINTER;

/* ---- Winter fur ---------------------------------------------------------------------------------------------- */

/** The butcher part winter gives more of (its item is of the same id, `BUTCHER_PARTS`), and how many times as much. */
export const WINTER_FUR_PART: ButcherPart = 'fur';
export const WINTER_FUR = 1.5;
/** "fur ×1.5 (winter)": the bonus as the Butcher line says it. */
export const winterFurSays = (): string => `${itemDef(WINTER_FUR_PART).name.toLowerCase()} ×${WINTER_FUR} (winter)`;

/* ---- Critter caches ------------------------------------------------------------------------------------------ */

/** The two jobs. */
export const CACHE_SEARCH = 'search_caches';
export const CACHE_DIG = 'dig_cache';

/** One cache a winter for every this many tiles square of the island, and at least one. */
export const CACHE_EVERY = 128;
/** Caches laid on an island of this many tiles a side. The island's `caches_for`. */
export const cachesFor = (size: number): number => Math.max(1, Math.floor((size * size) / (CACHE_EVERY * CACHE_EVERY)));
/** No cache within this many tiles of a settlement's edge. */
export const CACHE_DEED_GAP = 20;
/** The ground a cache is laid in. The island's `cache_ground`. */
export const CACHE_GROUND: readonly number[] = [TileType.Grass, TileType.Steppe, TileType.Tundra, TileType.Moss, TileType.Snow, TileType.Marsh];

/** A search names the cache's tile when it is within this many tiles of you, at Tracking nought, */
export const CACHE_SPOT_BASE = 3;
/** and a tile further for every this many levels of Tracking. */
export const CACHE_SPOT_EVERY = 20;
/** How near a cache must be for a search at this Tracking level to name its tile. The island's `cache_spot_at`. */
export const cacheSpotAt = (level: number): number => CACHE_SPOT_BASE + Math.floor(level / CACHE_SPOT_EVERY);

/** Draws off the loot table a dug cache gives at Tracking nought, */
export const CACHE_DRAWS = 2;
/** and one more for every this many levels of Tracking. */
export const CACHE_DRAW_EVERY = 30;
/** Draws a dug cache gives at this Tracking level. The island's `cache_draws`. */
export const cacheDraws = (level: number): number => CACHE_DRAWS + Math.floor(level / CACHE_DRAW_EVERY);

/** A search takes a track's time (`TRACK_TIME`); digging one up this many seconds' weight. */
export const CACHE_SEARCH_TIME = TRACK_TIME;
export const CACHE_DIG_TIME = 10;

/** One line of the loot table: what, how many a draw, its weight among the lines open to you, and the Tracking it opens at. */
export interface CacheLoot {
  item: string;
  count: number;
  weight: number;
  at: number;
}
export const CACHE_LOOT: readonly CacheLoot[] = [
  { item: 'ice_mote', count: 3, weight: 30, at: 0 },
  { item: 'life_mote', count: 2, weight: 20, at: 0 },
  { item: 'ancient_seed_jar', count: 1, weight: 15, at: 0 },
  { item: 'mithril_lump', count: 2, weight: 10, at: 20 },
  { item: 'tarnished_bauble', count: 1, weight: 8, at: 30 },
  { item: 'glimmersteel_lump', count: 2, weight: 7, at: 40 },
  { item: 'adamantine_lump', count: 2, weight: 6, at: 60 },
  { item: 'seryll_lump', count: 2, weight: 4, at: 80 },
];

/** The lines of `CACHE_LOOT` open at a Tracking level. */
export const cacheLootAt = (level: number): CacheLoot[] => CACHE_LOOT.filter((l) => l.at <= level);

/** The line a draw lands on, for a roll in [0, 1): by weight, in the table's order. The island's `cache_pick`. */
export function cachePick(level: number, roll: number): CacheLoot {
  const open = cacheLootAt(level);
  const total = open.reduce((n, l) => n + l.weight, 0);
  let r = roll * total;
  for (const l of open) {
    if (r < l.weight) return l;
    r -= l.weight;
  }
  return open[open.length - 1];
}

/** Each open line's chance a draw, at a Tracking level. */
export const cacheOdds = (level: number): Array<[CacheLoot, number]> => {
  const open = cacheLootAt(level);
  const total = open.reduce((n, l) => n + l.weight, 0);
  return open.map((l) => [l, l.weight / total]);
};

/** "3 × ice mote", "ancient seed jar": a line of loot as the log and the help name it. */
export const lootSays = (l: Pick<CacheLoot, 'item' | 'count'>): string =>
  `${l.count > 1 ? `${l.count} × ` : ''}${itemDef(l.item).name.toLowerCase()}`;

/** "3 × ice mote 46%, 2 × life mote 31%, ancient seed jar 23%": the odds a draw at a level. */
export const cacheOddsSays = (level: number): string =>
  cacheOdds(level).map(([l, p]) => `${lootSays(l)} ${Math.round(p * 100)}%`).join(', ');

/** "mithril lump from 20, ...": the lines a level does not yet open. */
export const cacheLaterSays = (level: number): string =>
  CACHE_LOOT.filter((l) => l.at > level).map((l) => `${itemDef(l.item).name.toLowerCase()} from ${l.at}`).join(', ');

/** The refusals, on both sides. */
export const CACHE_SAID = {
  season: 'Caches: winter only.',
  ground: 'Caches lie in the ground.',
  none: 'No cache here.',
} as const;

/**
 * What a search says: none within reach, the tile when it is near enough
 * (`cacheSpotAt`), and otherwise the way and the distance as a track reads
 * them. The island's `cache_search_said`, word for word.
 */
export function cacheSearchSaid(range: number, r: TrackReading | null, spot: { x: number; y: number } | null): string {
  if (spot) return `Cache: at ${spot.x}, ${spot.y}.`;
  if (!r) return `No cache within ${range} tiles.`;
  return `Cache: ${r.way}, ${trackDistSays(r)}.`;
}

/** The name the arrow a search leaves on the screen carries. */
export const CACHE_ARROW = 'Cache';

/**
 * The spot a `cached` line names: `{"x":..,"y":..}` for the tile a search
 * named, `{}` when the one you knew of is dug. Undefined for anything else.
 */
export function cachedSpot(text: string): { x: number; y: number } | null | undefined {
  try {
    const o = JSON.parse(text) as { x?: unknown; y?: unknown };
    if (typeof o !== 'object' || o === null) return undefined;
    if (o.x === undefined && o.y === undefined) return null;
    if (typeof o.x !== 'number' || typeof o.y !== 'number' || !Number.isInteger(o.x) || !Number.isInteger(o.y)) return undefined;
    return { x: o.x, y: o.y };
  } catch {
    return undefined;
  }
}

/**
 * What the Skills window says Tracking is worth for caches, at a skill: how
 * near a search names the tile, the draws a dug cache gives and the odds of a
 * draw, and the lines a higher level opens.
 */
export function cacheSkillSays(skill: number): string {
  const L = trackLevel(skill);
  const later = cacheLaterSays(L);
  return `Critter caches (winter): Search for caches (tile menu), same reach and error; tile named within ${cacheSpotAt(L)} tiles `
    + `(${CACHE_SPOT_BASE}, a tile further every ${CACHE_SPOT_EVERY} levels). Dig up cache: ${cacheDraws(L)} draws (${CACHE_DRAWS}, a draw more every ${CACHE_DRAW_EVERY} levels), `
    + `each: ${cacheOddsSays(L)}${later ? `; opens ${later}` : ''}. QL by Tracking.`;
}
