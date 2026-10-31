/**
 * Which tracks play when: by the island's hour and its season.
 *
 * A day on the island is an hour of wall clock (`DAY_SECONDS`), dawn at
 * `DAWN` and dusk at `DUSK`. The music keeps to four parts of it:
 *
 *   dawn   from a twilight before sunrise to two after   First Light
 *   day    the rest of the light                         the season's two, by turns
 *   dusk   from a twilight before sundown to two after   Lanternfall
 *   night  the dark between                              Moonwater
 *
 * The sign-in page has its own (`SIGN_IN_TRACKS`), and is not on the island's clock.
 */
import type { Season } from '../../world/calendar';
import { DAWN, DUSK, TWILIGHT } from '../../game/game';
import type { Track } from './score';
import { BLOSSOM } from './tracks/blossom';
import { EMBER_LEAVES } from './tracks/emberleaves';
import { FIRST_LIGHT } from './tracks/firstlight';
import { FROSTGLASS } from './tracks/frostglass';
import { HAMMOCK } from './tracks/hammock';
import { HEARTHLIGHT } from './tracks/hearthlight';
import { LANTERNFALL } from './tracks/lanternfall';
import { LONG_MEADOW } from './tracks/longmeadow';
import { MOONWATER } from './tracks/moonwater';
import { PETALWIND } from './tracks/petalwind';
import { SNOWLIGHT } from './tracks/snowlight';
import { SIGN_IN_TRACKS } from './playlist-sign-in';

export type Moment = 'dawn' | 'day' | 'dusk' | 'night';
export const MOMENTS: readonly Moment[] = ['dawn', 'day', 'dusk', 'night'];

/** The part of the island's day at game hour `h` (0 to 24). */
export function momentAt(h: number): Moment {
  if (h >= DAWN - TWILIGHT && h < DAWN + 2 * TWILIGHT) return 'dawn';
  if (h >= DUSK - TWILIGHT && h < DUSK + 2 * TWILIGHT) return 'dusk';
  if (h >= DAWN + 2 * TWILIGHT && h < DUSK - TWILIGHT) return 'day';
  return 'night';
}

/** The day's tracks in each season: two, played by turns. */
export const DAY_TRACKS: Readonly<Record<Season, readonly Track[]>> = {
  spring: [BLOSSOM, PETALWIND],
  summer: [LONG_MEADOW, HAMMOCK],
  autumn: [EMBER_LEAVES, HEARTHLIGHT],
  winter: [FROSTGLASS, SNOWLIGHT],
};

/** The tracks for the rest of the day, the same in every season. */
export const MOMENT_TRACKS: Readonly<Record<Exclude<Moment, 'day'>, readonly Track[]>> = {
  dawn: [FIRST_LIGHT],
  dusk: [LANTERNFALL],
  night: [MOONWATER],
};

/** The tracks that may play at game hour `h` in `season`; the first is the one to start with. */
export function tracksFor(season: Season, h: number): readonly Track[] {
  const m = momentAt(h);
  return m === 'day' ? DAY_TRACKS[season] : MOMENT_TRACKS[m];
}

/** Every track there is, once each. */
export const ALL_TRACKS: readonly Track[] = [...new Set([...Object.values(DAY_TRACKS).flat(), ...Object.values(MOMENT_TRACKS).flat(), ...SIGN_IN_TRACKS])];

/** What plays when, as a line of labels: the help and What's new read it rather than writing it out. */
export function playlistSays(): string {
  const names = (ts: readonly Track[]): string => ts.map((t) => t.name).join(' and ');
  const days = (Object.keys(DAY_TRACKS) as Season[]).map((s) => `${s} ${names(DAY_TRACKS[s])}`).join(', ');
  return `dawn ${names(MOMENT_TRACKS.dawn)}; day, by turns: ${days}; dusk ${names(MOMENT_TRACKS.dusk)}; night ${names(MOMENT_TRACKS.night)}; sign-in page ${names(SIGN_IN_TRACKS)}`;
}
