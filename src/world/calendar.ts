/**
 * The island's year: four seasons of `SEASON_DAYS` days each.
 *
 * Asked for along with wildflowers that come up in spring and summer, trees
 * that blossom in spring and lilies that flower in their season. There was no
 * year before this: the days went round and nothing else did.
 *
 * A day of the year is as long as one of the island's days and nights
 * (`DAY_SECONDS`), and a season is `SEASON_DAYS` of them: asked for as
 * "approximately 30 in game day cycles". It is worked out from the wall clock
 * alone, counted from the first dawn of the first spring, the same on every
 * page and on every island (`season_at`), and nothing about it is kept. The
 * clock beside your position is the island's own, which a night slept through
 * moves on, so a day of the year turns at the same moment everywhere rather
 * than at any one island's midnight.
 */
import { DAY_SECONDS } from '../game/pace';
import { TREE_DAWN_UTC } from './tiles';

/** The seasons, in the order they come round. */
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];
/** Days in a season. Asked for: "Increase season time to 90 game days". */
export const SEASON_DAYS = 90;
/** Days in a year. */
export const YEAR_DAYS = SEASONS.length * SEASON_DAYS;
/** The first dawn of the first spring, in epoch seconds: 13:00 UTC on 28 September 2026. */
export const FIRST_SPRING = Date.UTC(2026, 8, 28, TREE_DAWN_UTC) / 1000;
/** Days in a season from the first spring until they were lengthened. */
export const SHORT_SEASON_DAYS = 30;
/** The years of short seasons there were. */
export const SHORT_YEARS = 5;
/**
 * The dawn the year is counted from, in epoch seconds: the first spring of `SEASON_DAYS` days, which began where the
 * last of the short years ended (13:00 UTC on 23 October 2026), so the spring then begun went on rather than the year
 * jumping on to wherever the longer seasons would have had it. Before it there are no seasons, as before the first
 * spring; a field's growth up to it is carried over (`20261023150000_seasons_of_ninety_days`).
 */
export const YEAR_FROM = FIRST_SPRING + SHORT_YEARS * SEASONS.length * SHORT_SEASON_DAYS * DAY_SECONDS;

/** Whole days of the year since the first dawn of the first spring at `now` (epoch seconds), below nought before it. */
const dayOf = (now: number): number => Math.floor((now - YEAR_FROM) / DAY_SECONDS);

/** The season at `now` (epoch seconds), and which day of it, from 1 to `SEASON_DAYS`. */
export function seasonAt(now: number): { season: Season; day: number } {
  const days = dayOf(now);
  const inYear = ((days % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS;
  return { season: SEASONS[Math.floor(inYear / SEASON_DAYS)], day: (inYear % SEASON_DAYS) + 1 };
}

/**
 * Which year a moment falls in: nought for the first, counted from the first
 * dawn of the first spring and below nought before it. A year begins with a
 * spring, so a new one is what a picked tile of flowers waits for. The
 * island's `year_of` is the same count.
 */
export function yearOf(now: number): number {
  return Math.floor(dayOf(now) / YEAR_DAYS);
}

/** The first dawn of the season `now` falls in, in epoch seconds: when the last season turned. The island's `season_began`. */
export function seasonBegan(now: number): number {
  const days = dayOf(now);
  const inYear = ((days % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS;
  return YEAR_FROM + (days - (inYear % SEASON_DAYS)) * DAY_SECONDS;
}

/** The season as the hud says it: "Spring, day 3 of 30". */
export function seasonLine(now: number): string {
  const { season, day } = seasonAt(now);
  return `${season[0].toUpperCase()}${season.slice(1)}, day ${day} of ${SEASON_DAYS}`;
}
