/**
 * Fruiting seasons: what is picked, cut and found in which seasons of the
 * island's year (`world/calendar.ts`).
 *
 * Asked for: fruit trees, berry bushes and wild forage each fruit in their
 * own seasons, and out of season give nothing, with a refusal that says when
 * they next fruit. Staples -- grain and vegetables in a field, and the
 * potatoes, onions and seeds foraging turns up -- keep their own rules.
 *
 * `FRUITING` is the one table, by the item a tree bears, a bush is cut for or
 * the ground gives up; an item not in it is had in every season. It is
 * emitted to the island (`fruiting_seasons`, and every sentence below as
 * `fruit_out_said` and `fruit_says`), which asks the same questions:
 *
 *   * Pick fruit and Harvest on a bush are refused out of season, in
 *     `outOfSeasonSaid`'s words, and a plucka passes the tree by;
 *   * a go of foraging or botanizing, and a worker's, rolls only on what is
 *     in season (`inSeason`): the table's other weights as they are, so a
 *     look finds something exactly as often in every season;
 *   * Examine on a fruit tree or a bush that is cut says its seasons and
 *     whether it is in season now (`fruitingSays`).
 *
 * Under glass everything fruits in every season, as a crop under glass grows
 * in every season (`fruitsIn`'s `glass`). Before the first spring
 * (`YEAR_FROM`) there are no seasons and everything fruits, as it always had.
 *
 * Data in, words out; nothing here reads the time for itself.
 */
import { SEASONS, YEAR_FROM, seasonAt, type Season } from '../world/calendar';
import { BUSH_DEFS, TREE_DEFS } from '../world/tiles';
import { ITEM_DEFS } from './items';
import { capital, listed } from './words';

/** The seasons each thing is picked, cut or found in, in the order the year has them. Anything not here is had all year. */
export const FRUITING: Record<string, readonly Season[]> = {
  // Fruit trees, by their fruit.
  cherry: ['summer'],
  apricot: ['summer'],
  peach: ['summer'],
  plum: ['summer'],
  fig: ['summer', 'autumn'],
  apple: ['autumn'],
  pear: ['autumn'],
  quince: ['autumn'],
  pomegranate: ['autumn'],
  olive: ['autumn', 'winter'],
  lemon: ['spring', 'winter'],
  // A vine on a trellis (`vineyard.ts`), picked only in its one season.
  grape: ['autumn'],
  // Bushes, by what a sickle cuts off them.
  rose_petals: ['spring', 'summer'],
  lavender: ['spring', 'summer'],
  // Foraging.
  strawberry: ['spring', 'summer'],
  raspberry: ['spring', 'summer'],
  blueberry: ['spring', 'summer', 'autumn'],
  lingonberry: ['spring', 'autumn'],
  acorn: ['spring', 'autumn'],
  nuts: ['spring', 'autumn'],
  // Botanizing.
  basil: ['summer'],
  sage: ['spring', 'summer', 'autumn'],
  thyme: ['spring', 'summer', 'autumn'],
  mint: ['spring', 'summer', 'autumn'],
};

/** The seasons a thing is had in: all four for anything not in the table. */
export const fruitingSeasons = (id: string): readonly Season[] => FRUITING[id] ?? SEASONS;

/** The season fruiting goes by at `now` (epoch seconds), or null before the first spring, when everything fruits. */
export const fruitSeason = (now: number): Season | null => (now < YEAR_FROM ? null : seasonAt(now).season);

/** Whether a thing is had in a season: always under glass, and always before the year began (`season` null). */
export const fruitsIn = (id: string, season: Season | null, glass = false): boolean =>
  glass || season === null || fruitingSeasons(id).includes(season);

/** Whether a thing is had at a moment (epoch seconds). */
export const fruitsAt = (id: string, now: number, glass = false): boolean => fruitsIn(id, fruitSeason(now), glass);

/** The next season after `season` that a thing is had in: the first one round the year from the season after. */
export function nextFruiting(id: string, season: Season): Season {
  const at = SEASONS.indexOf(season);
  const seasons = fruitingSeasons(id);
  for (let k = 1; k <= SEASONS.length; k++) {
    const s = SEASONS[(at + k) % SEASONS.length];
    if (seasons.includes(s)) return s;
  }
  return season;
}

/** What a thing comes off, as a sentence names it: "apple tree", "rose bush", or the thing itself. */
export function fruitSource(id: string): string {
  const tree = TREE_DEFS.find((t) => t.fruit === id);
  if (tree) return `${tree.name.toLowerCase()} tree`;
  const bush = BUSH_DEFS.find((b) => b.yields === id);
  if (bush) return bush.name.toLowerCase();
  return (ITEM_DEFS[id]?.name ?? id).toLowerCase();
}

/** Why a tree or a bush has nothing on it in a season: its seasons, the season it is, and when it next has. The island's `fruit_out_said`. */
export const outOfSeasonSaid = (id: string, season: Season): string =>
  `${capital(fruitSource(id))}: fruits in ${listed(fruitingSeasons(id))}. Now ${season}: none until ${nextFruiting(id, season)}.`;

/** What Examine adds about a tree or a bush that bears: its seasons, and whether it is in season now. The island's `fruit_says`. */
export const fruitingSays = (id: string, season: Season | null): string =>
  ` Fruits in ${listed(fruitingSeasons(id))}: ${fruitsIn(id, season) ? 'in season now' : `out of season until ${nextFruiting(id, season as Season)}`}.`;

/** Why picking a thing is refused at a moment, or null when it is in season. */
export const fruitRefusal = (id: string, now: number, glass = false): string | null => {
  const season = fruitSeason(now);
  return fruitsIn(id, season, glass) || season === null ? null : outOfSeasonSaid(id, season);
};

/** A loot table cut down to what is in season at a moment, the weights of the rest as they were. */
export const inSeason = (table: Array<[string, number]>, now: number): Array<[string, number]> =>
  table.filter(([id]) => fruitsAt(id, now));

/** A thing's seasons as an item's tooltip gives them. */
export const seasonLine = (id: string): string => `Fruits in ${listed(fruitingSeasons(id))}.`;

// Every item in the table says its seasons wherever its description is shown.
for (const id of Object.keys(FRUITING)) {
  const d = ITEM_DEFS[id];
  if (d) d.description = d.description ? `${d.description} ${seasonLine(id)}` : seasonLine(id);
}
