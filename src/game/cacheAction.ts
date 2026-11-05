/**
 * The two winter jobs of critter caches: Search for caches and Dig up cache.
 * The rules are `winter.ts`'s; where a cache lies is the island's and nobody
 * else's, so both goes are the island's (`perform_cache`). What the browser
 * holds is the one tile a search of yours last named (`Game.cacheSpot`), off
 * the island's `cached` line.
 */
import type { ActionDef, Target } from './actions';
import type { Game } from './game';
import { ACTION_PACE } from './pace';
import { TRACKING, trackLevel, trackReach } from './tracking';
import { qlTag, tagged } from './yields';
import { CACHE_DIG, CACHE_DIG_TIME, CACHE_GROUND, CACHE_SAID, CACHE_SEARCH, CACHE_SEARCH_TIME, cacheDraws, winterNow } from './winter';

/** The level a search and a dig are read at: the whole level below your Tracking, as a track's. */
const levelOf = (g: Game): number => trackLevel(g.skills.get(TRACKING));

/** Why a search cannot be made, or null: the island's `cache_refusal` for a search. */
export function cacheSearchRefusal(g: Game, t: Target): string | null {
  if (!winterNow(g.wallNow())) return CACHE_SAID.season;
  if (t.kind !== 'tile') return CACHE_SAID.ground;
  return null;
}

/** Why a cache cannot be dug here, or null: the island's `cache_refusal` for a dig, with the one tile you know of. */
export function cacheDigRefusal(g: Game, t: Target): string | null {
  if (!winterNow(g.wallNow())) return CACHE_SAID.season;
  if (t.kind !== 'tile') return CACHE_SAID.ground;
  const s = g.cacheSpot;
  if (!s || s.x !== t.x || s.y !== t.y) return CACHE_SAID.none;
  return null;
}

/** Ground a cache can lie in, inside the island and not under water. */
const cacheGround = (g: Game, t: Target): boolean =>
  t.kind === 'tile' && g.world.inBounds(t.x, t.y) && !g.world.hasWater(t.x, t.y) && CACHE_GROUND.includes(g.world.getTile(t.x, t.y));

export const CACHE_ACTIONS: ActionDef[] = [
  {
    id: CACHE_SEARCH,
    label: 'Search for caches',
    // Its reach: "Search for caches (140 tiles)".
    labelFor: (_t, g) => tagged('Search for caches', `${trackReach(levelOf(g), g.awareShare())} tiles`),
    verb: 'searching for caches',
    skill: TRACKING,
    stamina: 0.03,
    baseTime: CACHE_SEARCH_TIME / ACTION_PACE,
    // Winter only, from a tile of land.
    applies: (t, g) => winterNow(g.wallNow()) && t.kind === 'tile' && g.world.inBounds(t.x, t.y) && !g.world.hasWater(t.x, t.y),
    check: (t, g) => cacheSearchRefusal(g, t),
    // The island's (`perform_cache`): it alone knows where they lie.
    perform: () => undefined,
  },
  {
    id: CACHE_DIG,
    label: 'Dig up cache',
    // What it gives: "Dig up cache (3 draws, QL ≤45)".
    labelFor: (_t, g) => tagged('Dig up cache', `${cacheDraws(levelOf(g))} draws`, qlTag(g.qlCeiling(TRACKING))),
    verb: 'digging up a cache',
    skill: TRACKING,
    stamina: 0.05,
    baseTime: CACHE_DIG_TIME / ACTION_PACE,
    applies: (t, g) => winterNow(g.wallNow()) && cacheGround(g, t),
    check: (t, g) => cacheDigRefusal(g, t),
    // The island's (`perform_cache`).
    perform: () => undefined,
  },
];
