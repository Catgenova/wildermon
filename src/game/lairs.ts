/**
 * Monster lairs: the only place a goblin, an orc, an ogre or a dragon stands up.
 *
 * Asked for: monsters come only from lairs, with no wandering spawns and no
 * raiding patrols. Each lair is a placed piece the island sites from the ground
 * (`LairKind.site`), holds a garrison that stays leashed to it (`LAIR_LEASH`),
 * and once its garrison is dead sends out its boss; the boss's death opens a
 * hoard for everybody who dealt it `HOARD_SHARE` of its health or more, and
 * leaves the lair empty, safe ground round it (`LAIR_RING`), until it
 * restocks. A lair cleared `LAIR_MOVE_CLEARS` times in `LAIR_MOVE_DAYS` days
 * comes back somewhere else.
 *
 * A leaf on purpose: no value imports but words, so the defs dump, the help,
 * the field guide and the suite can read it. The island has the rules off
 * these numbers (`lair_kinds`, `lair_garrison` and the scalars in the defs;
 * `lair_site_ok`, `lair_tick`, `lair_hoard` in the migration);
 * `supabase/test/lairs.ts` holds them.
 */
import { BOOK_DROPS, type BookKind } from './bookdrops';
import { percent, spanWords } from './words';

/** The ground a lair is sited on (`lair_site_ok`). */
export type LairSite = 'forest_edge' | 'open_grass' | 'hillside' | 'peak';

export interface LairKind {
  /** Its id, which is also the furniture kind it is drawn as. */
  id: string;
  name: string;
  /** The monster it is the lair of: the field guide's page and the boss's kind. */
  species: string;
  site: LairSite;
  /** How many of it the island holds. */
  count: number;
  /** Its garrison, in the order a restock fills it: a kind, and the fewest and most of it. */
  garrison: ReadonlyArray<readonly [string, number, number]>;
  /** What its boss is called; null for a lair whose garrison is its boss. */
  boss: string | null;
  /** Its boss's health and blow, as multiples of its kind's. */
  bossHealth: number;
  bossAttack: number;
  /** Seconds between one of its garrison coming back and the next, and from its clearing to the first. */
  restock: number;
  /** The fewest tiles from any settlement token, for a lair and a token alike. */
  keepOff: number;
  /** The chance a hoard share holds a treasure map. */
  map: number;
  /** The trophy every hoard share holds, by item id. */
  trophy: string;
  /** Hoard dragon scales in every hoard share. */
  scales: number;
}

export const LAIR_KINDS: readonly LairKind[] = [
  {
    id: 'goblin_warren', name: 'Goblin warren', species: 'goblin', site: 'forest_edge', count: 4,
    garrison: [['goblin', 3, 5]], boss: 'Warren chief', bossHealth: 2, bossAttack: 1,
    restock: 30 * 60, keepOff: 40, map: 0.5, trophy: 'chief_ear', scales: 0,
  },
  {
    id: 'orc_camp', name: 'Orc camp', species: 'orc', site: 'open_grass', count: 2,
    garrison: [['orc', 2, 3]], boss: 'Warlord', bossHealth: 2, bossAttack: 1,
    restock: 60 * 60, keepOff: 60, map: 0.75, trophy: 'warlord_tusk', scales: 0,
  },
  {
    id: 'ogre_cave', name: 'Ogre cave', species: 'ogre', site: 'hillside', count: 1,
    garrison: [['ogre', 1, 1], ['goblin', 2, 2]], boss: 'Ogre king', bossHealth: 2, bossAttack: 1.5,
    restock: 3 * 3600, keepOff: 80, map: 1, trophy: 'ogre_king_jaw', scales: 0,
  },
  {
    id: 'dragon_roost', name: 'Dragon roost', species: 'dragon', site: 'peak', count: 1,
    garrison: [], boss: null, bossHealth: 1, bossAttack: 1,
    restock: 24 * 3600, keepOff: 120, map: 1, trophy: 'great_dragon_scale', scales: 5,
  },
];

export const LAIR_BY_ID: ReadonlyMap<string, LairKind> = new Map(LAIR_KINDS.map((k) => [k.id, k]));
/** The lair of a monster's kind, by the kind's id. */
export const lairOfKind = (species: string): LairKind | undefined => LAIR_KINDS.find((k) => k.species === species);
/** What a lair's boss is called: its own name, or its kind's for a lair whose garrison is its boss. */
export const bossName = (k: LairKind, kindName: string): string => k.boss ?? kindName;

/** No monster of a lair is ever further than this from it, in tiles; past it a hunt is given up and it walks back. */
export const LAIR_LEASH = 20;
/** The tiles round a cleared lair that count as the safe ring until it restocks. */
export const LAIR_RING = 30;
/** How many times the usual count of wildermon stand up in a cleared lair's ring. */
export const LAIR_RING_WILD = 1.5;
/** Who is told a boss is out: everybody within this many tiles of its lair. */
export const LAIR_ANNOUNCE = 30;
/** The share of a boss's health a body must deal (their companions' blows counted) for a share of its hoard. */
export const HOARD_SHARE = 0.1;
/** The chance a hoard share holds a Recipe or a Formula: the book its boss's kind carries (`BOOK_DROPS`). */
export const HOARD_BOOK = 0.25;
/** The crafting QL cap, as a multiple of the skill, for scale armour made of hoard dragon scales alone. */
export const HOARD_SCALE_CAP = 1.2;
/** The `extra` a hoard dragon scale carries: "Dragon scale (hoard)". */
export const HOARD_SCALE = 'hoard';
/** Clears that move a lair, within this many days. */
export const LAIR_MOVE_CLEARS = 3;
export const LAIR_MOVE_DAYS = 7;
/** How far Track, from a monster's field guide page, reads to its kind's nearest lair, in tiles. */
export const LAIR_TRACK = 100;
/** How near a lair a body comes to have seen it: its pin on the map, and "Lair: found" in the field guide. */
export const LAIR_SIGHT = 40;
/** How often the island looks again for a site for a kind of lair it is short of, in seconds. */
export const LAIR_LOOK_EVERY = 600;
/** The fewest tiles between two lairs: one's ring never takes in another's leash. */
export const LAIR_APART = LAIR_RING + LAIR_LEASH;

/** The ground each site wants, as `lair_site_ok` reads it. */
/** A forest edge: a tree within this many tiles, on open ground. */
export const EDGE_TREES = 2;
/** Open grass: no tree within this many tiles, and no more than `OPEN_SLOPE` between the tile's corners. */
export const OPEN_CLEAR = 6;
export const OPEN_SLOPE = 10;
/** A hillside: bare rock with at least this much between the tile's corners, in tenths of a metre. */
export const HILL_SLOPE = 24;

/** What each site is, in the help's and the guide's words. */
export const SITE_SAYS: Record<LairSite, string> = {
  forest_edge: `forest edge: open ground within ${EDGE_TREES} tiles of a tree`,
  open_grass: `open grass: grass or steppe, no tree within ${OPEN_CLEAR} tiles, corners within ${OPEN_SLOPE / 10} m`,
  hillside: `hillside: bare rock, corners at least ${HILL_SLOPE / 10} m apart`,
  peak: 'mountain peak: the highest ground of its island',
};

/**
 * How many wildermon stand in a cleared lair's ring: `LAIR_RING_WILD` times what the stocking puts on that much ground,
 * `perSquare` to a square `square` tiles a side (`PER_REGION`, `REGION`). The island's `lair_ring_want`.
 */
export const lairRingWant = (perSquare: number, square: number): number =>
  Math.round(LAIR_RING_WILD * Math.PI * LAIR_RING ** 2 / square ** 2 * perSquare);
/** And the usual, unrounded, for the help. */
export const lairRingUsual = (perSquare: number, square: number): number => Math.PI * LAIR_RING ** 2 / square ** 2 * perSquare;

/** A garrison in words: "3–5 goblins", "1 ogre and 2 goblins". */
export function garrisonSays(k: LairKind, name: (species: string) => string): string {
  if (!k.garrison.length) return `1 ${name(k.species).toLowerCase()} (the boss)`;
  return k.garrison.map(([s, lo, hi]) => `${lo === hi ? lo : `${lo}–${hi}`} ${name(s).toLowerCase()}${hi === 1 ? '' : 's'}`).join(' and ');
}

/** A boss in words: "Warren chief: health ×2", "Ogre king: health ×2, damage ×1.5". */
export function bossSays(k: LairKind, kindName: string): string {
  const more = [k.bossHealth !== 1 ? `health ×${k.bossHealth}` : '', k.bossAttack !== 1 ? `damage ×${k.bossAttack}` : ''].filter(Boolean);
  return `${bossName(k, kindName)}${more.length ? `: ${more.join(', ')}` : ''}`;
}

/** The restock in words: "1 per 30 minutes", or for a lair with no garrison "24 hours after its kill". */
export const restockSays = (k: LairKind): string =>
  (k.garrison.length ? `1 per ${spanWords(k.restock).replace(/^1 /, '')}, from ${spanWords(k.restock)} after its boss's kill` : `${spanWords(k.restock)} after its kill`);

/** The book a lair's hoard holds at `HOARD_BOOK`: the one its boss's kind carries when butchered (`BOOK_DROPS`). */
export const hoardBook = (k: LairKind): BookKind => BOOK_DROPS.find((d) => d.kind === k.species)?.book ?? 'recipe';

/** A hoard share in words, off the kind and the trophy's name. */
export function hoardSays(k: LairKind, trophyName: string, bookName: string): string {
  const parts = [`treasure map ${percent(k.map)}`, `${trophyName.toLowerCase()} 100%`];
  if (k.scales) parts.push(`${k.scales} hoard dragon scales 100%`);
  parts.push(`${bookName.toLowerCase()} ${percent(HOARD_BOOK)}`);
  return parts.join(', ');
}

/** Where a lair is, as a browser knows it: what the island hands it of the lairs a body has seen (`rpc_ground`'s `lairs`). */
export interface LairSeen {
  id: number;
  kind: string;
  x: number;
  y: number;
}

/** "Lair: found" or "Lair: not found", for a monster's page in the field guide, off the lairs this body has seen. */
export const lairFoundSays = (species: string, seen: readonly LairSeen[]): string | null => {
  const k = lairOfKind(species);
  if (!k) return null;
  return `Lair (${k.name.toLowerCase()}): ${seen.some((l) => l.kind === k.id) ? 'found' : 'not found'}`;
};

/** Why a settlement may not be founded here, for the lairs known: the nearest one too close, or null. The island's `deed_refusal`. */
export function lairFoundingRefusal(x: number, y: number, lairs: readonly LairSeen[]): string | null {
  let worst: { k: LairKind; d: number } | null = null;
  for (const l of lairs) {
    const k = LAIR_BY_ID.get(l.kind);
    if (!k) continue;
    const d = Math.hypot(x - l.x, y - l.y);
    if (d < k.keepOff && (!worst || d < worst.d)) worst = { k, d };
  }
  return worst ? `Too close to a ${worst.k.name.toLowerCase()}: ${Math.floor(worst.d)} tiles; ${worst.k.keepOff} needed.` : null;
}
