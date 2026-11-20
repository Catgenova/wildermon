/**
 * The Path's state as the island keeps it (`player.thepath`), and the shapes the
 * browser holds it in. A leaf, so that `game.ts` can hold the state without
 * reaching for the rules in `path.ts`, which read half the game.
 */

/** A step's id as it goes up with the journal's ticks (`rpc_settle`'s `p_ticked`): `path:<id>`. */
export const PATH_TICK = 'path:';

/** One supply handed out for a tame step (`rpc_thepath_supply`): what, how many, and the season it was for. */
export interface PathSupply {
  item: string;
  n: number;
  season: string;
}

/**
 * The island's record of the Path for one body: on or off, the steps skipped, the
 * supplies claimed by step, and the goes counted for steps nothing else counts
 * (`did`: `ate:<item>`, `forage`, `botanize`, `clay`, `prospect`, `pack`, `mine`,
 * `track:<kind>`), counted only while the Path is on.
 */
export interface PathState {
  on: boolean;
  skip: string[];
  supply: Record<string, PathSupply>;
  did: Record<string, number>;
  /** The phases whose reward was given (`private.thepath_reward`). */
  rewarded?: string[];
}

/** A suggested place for a settlement (`rpc_thepath_sites`), with its numbers. */
export interface PathSite {
  x: number;
  y: number;
  /** Trees within the reach counted: only those the player's woodcutting fells (`fellsSaid`). */
  trees: number;
  /** Tiles to the nearest water, the nearest bare rock. */
  water: number;
  rock: number;
  /** The nearest lair you have seen, and how far; null for none in reach. */
  lair: string | null;
  lairAt: number | null;
}

/** What the Path's window and strip ask the island for, set where the island is (`src/net/pathwire.ts`): a refusal's words, or null. */
export interface PathDoor {
  turn(on: boolean): Promise<string | null>;
  skip(step: string, skip: boolean): Promise<string | null>;
}

/** A state read off whatever the island said, every field checked; null for nothing usable. */
export function pathStateIn(v: unknown): PathState | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const supply: Record<string, PathSupply> = {};
  if (o.supply && typeof o.supply === 'object') {
    for (const [k, s] of Object.entries(o.supply as Record<string, unknown>)) {
      const r = s as Record<string, unknown> | null;
      if (r && typeof r.item === 'string' && typeof r.n === 'number') supply[k] = { item: r.item, n: r.n, season: typeof r.season === 'string' ? r.season : '' };
    }
  }
  const did: Record<string, number> = {};
  if (o.did && typeof o.did === 'object') {
    for (const [k, n] of Object.entries(o.did as Record<string, unknown>)) if (typeof n === 'number') did[k] = n;
  }
  return {
    on: o.on === true,
    skip: Array.isArray(o.skip) ? o.skip.filter((s): s is string => typeof s === 'string') : [],
    supply,
    did,
    rewarded: Array.isArray(o.rewarded) ? o.rewarded.filter((s): s is string => typeof s === 'string') : [],
  };
}

/** Sites read off the island's answer, every field checked. */
export function pathSitesIn(v: unknown): PathSite[] {
  if (!Array.isArray(v)) return [];
  const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  const out: PathSite[] = [];
  for (const s of v) {
    if (!s || typeof s !== 'object') continue;
    const o = s as Record<string, unknown>;
    const x = num(o.x), y = num(o.y), trees = num(o.trees), water = num(o.water), rock = num(o.rock);
    if (x === null || y === null || trees === null || water === null || rock === null) continue;
    out.push({ x, y, trees, water, rock, lair: typeof o.lair === 'string' ? o.lair : null, lairAt: num(o.lair_at) });
  }
  return out;
}
