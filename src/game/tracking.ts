/**
 * Tracking: reading the trail of a kind in your field guide back to the
 * nearest wild one.
 *
 * Asked for: "Add a tracking skill. Players can click a Track button in the
 * field guide to cast a tracking action. The action directs towards the
 * nearest of that species, with directions becoming more accurate and
 * specific with a higher tracking level. Can only track discovered
 * wildermon".
 *
 * A leaf but for types, so the defs dump and the suite can read it; the job
 * itself is `trackAction.ts`.
 *
 * A go of Track (`TRACK`) is asked from a kind's page in the field guide, for
 * a wildermon whose page is marked seen (`trackable`), and takes the time of
 * a job of `TRACK_TIME` seconds' weight; walking puts it down, as it does
 * every job. When it is done:
 *
 *   * it finds the nearest wild one of that kind, at any stage, within
 *     `trackRange` of where you stand; a kept one is never tracked;
 *   * the way to it is the true bearing, off by a roll taken evenly over
 *     `trackErr` degrees either side, and then said only as finely as your
 *     band of `TRACK_BANDS` reads it: four points, eight, sixteen, or the
 *     degree;
 *   * how far is said as finely as the band reads it too: far off or not
 *     (`TRACK_FAR`), or to the nearest fifty, twenty or five tiles;
 *   * from the third band it names the stage it is at, and from the fourth its
 *     level and whether it is on the move;
 *   * an arrow on the screen points the way it read, from where you stood,
 *     for `TRACK_SHOW` seconds;
 *   * it trains Tracking by a go, and by `TRY_LEARN` of one when there was no
 *     sign of one in range.
 *
 * Levels are read whole: the band, the reach and the spread all go by the
 * level below your Tracking, so the Skills window's number says which.
 *
 * The island has the same rules off the same numbers (`track_range`,
 * `track_err`, `track_band` and the band table in the defs; `track_reading`,
 * `track_said`, `track_refusal` and `perform_track` in the migration), draws
 * the roll with its own dice and says the same words;
 * `supabase/test/tracking.ts` holds the two sides together.
 */
import type { Target } from './actions';
import type { Game } from './game';
import type { Creature, SpeciesDef } from './creatures';
import { SKILL_TOP } from './skills';
import { listed } from './words';

/** The skill a trail is read with, and the only thing that trains it. */
export const TRACKING = 'tracking';
/** The job: Track, asked from a kind's page in the field guide. */
export const TRACK = 'track';

/** What a go of Track takes, in seconds at Tracking nought: its weight is this over the pace (`goSeconds`). */
export const TRACK_TIME = 5;
/** How long the arrow a track leaves on the screen stays there, in seconds. */
export const TRACK_SHOW = 60;

/** How far a track reaches at Tracking nought, in tiles. */
export const TRACK_RANGE_BASE = 100;
/** And how much further for every level of Tracking. */
export const TRACK_RANGE_PER = 4;
/** The most a reading is off the true bearing, either way, in degrees: at Tracking nought. */
export const TRACK_ERR_MOST = 60;
/** And the least it ever is, however good you are. */
export const TRACK_ERR_LEAST = 5;
/** Over this many tiles, a trail read in the first band is far off; at or under it, not. */
export const TRACK_FAR = 150;

/**
 * What a track says at each band of Tracking, lowest first, each from the
 * level `at`: how many points of the compass it reads the way to (360 for the
 * degree), what it rounds the distance to (null for far off or not), whether
 * it names the stage the one tracked is at, and whether its level and whether
 * it is moving.
 */
export interface TrackBand {
  at: number;
  points: number;
  round: number | null;
  stage: boolean;
  detail: boolean;
}
export const TRACK_BANDS: readonly TrackBand[] = [
  { at: 0, points: 4, round: null, stage: false, detail: false },
  { at: 20, points: 8, round: 50, stage: false, detail: false },
  { at: 50, points: 16, round: 20, stage: true, detail: false },
  { at: 80, points: 360, round: 5, stage: true, detail: true },
];

/** The sixteen points, clockwise from north (up the map, towards the top row); four and eight are every fourth and every second. */
export const TRACK_POINTS = [
  'north', 'north-north-east', 'north-east', 'east-north-east', 'east', 'east-south-east', 'south-east', 'south-south-east',
  'south', 'south-south-west', 'south-west', 'west-south-west', 'west', 'west-north-west', 'north-west', 'north-north-west',
] as const;

/** The level a track is read at: the whole level below your Tracking. */
export const trackLevel = (skill: number): number => Math.floor(Math.max(0, Math.min(SKILL_TOP, skill)));
/** How far a track reaches at a level, in tiles. The island's `track_range`. */
export const trackRange = (level: number): number => TRACK_RANGE_BASE + TRACK_RANGE_PER * level;
/** The most a reading is off the true bearing at a level, either way, in degrees. The island's `track_err`. */
export const trackErr = (level: number): number => Math.max(TRACK_ERR_LEAST, TRACK_ERR_MOST * (1 - level / SKILL_TOP));
/** Which of `TRACK_BANDS` a level reads in. The island's `track_band`. */
export const trackBand = (level: number): number => {
  let band = 0;
  TRACK_BANDS.forEach((b, i) => {
    if (level >= b.at) band = i;
  });
  return band;
};
/** The level the spread comes down to its least at: the first whole level at or past which `trackErr` is `TRACK_ERR_LEAST`. */
export const TRACK_ERR_FLOOR_AT = Math.ceil(SKILL_TOP * (1 - TRACK_ERR_LEAST / TRACK_ERR_MOST));

/** A point of the compass by its place among `points` of them, clockwise from north. */
export const pointName = (points: number, i: number): string => TRACK_POINTS[(i * TRACK_POINTS.length) / points];

/** Degrees put into [0, 360), the same way on both sides. */
const turn = (deg: number): number => deg - 360 * Math.floor(deg / 360);
/** To the nearest whole, a half going up: written out so that the island's `floor(x + 0.5)` is the same sum (its `round` goes to the even). */
const nearest = (x: number): number => Math.floor(x + 0.5);

/** The true bearing from one point to another, in degrees clockwise from north: north is up the map, `y` falling. */
export const bearingTo = (fromX: number, fromY: number, toX: number, toY: number): number =>
  turn((Math.atan2(toX - fromX, -(toY - fromY)) * 180) / Math.PI);

/** What a track read: its band, the way as said and as an angle, and how far as said. */
export interface TrackReading {
  band: number;
  /** "north-north-east", or "bearing 47°" in the last band. */
  way: string;
  /** The bearing it read, in whole degrees clockwise from north: what the arrow points along. */
  bearing: number;
  /** Over `TRACK_FAR`, for a band that says no more than that. */
  far: boolean;
  /** The distance rounded as the band rounds it, or null for a band that says far off or not. */
  tiles: number | null;
}

/**
 * What a track reads, from the true bearing and distance and a roll in
 * [0, 1): the roll puts the bearing off by up to `trackErr` either way, evenly,
 * and the band says it as finely as it can. A distance never rounds below the
 * band's step. The island's `track_reading`, step for step.
 */
export function trackReading(level: number, bearing: number, dist: number, roll: number): TrackReading {
  const band = trackBand(level);
  const b = TRACK_BANDS[band];
  const read = turn(bearing + (2 * roll - 1) * trackErr(level));
  const step = 360 / b.points;
  const i = nearest(read / step) % b.points;
  const tiles = b.round === null ? null : Math.max(b.round, nearest(dist / b.round) * b.round);
  return {
    band,
    way: b.points === 360 ? `bearing ${i}°` : pointName(b.points, i),
    bearing: i * step,
    far: dist > TRACK_FAR,
    tiles,
  };
}

/** How far a reading says, as the arrow's label says it: "far off", "not far off", "about 120 tiles". */
export const trackDistSays = (r: Pick<TrackReading, 'far' | 'tiles'>): string =>
  r.tiles === null ? (r.far ? 'far off' : 'not far off') : `about ${r.tiles} tiles`;

/** What the one tracked showed of itself: what it is called at its stage, its level, and whether it is on the move. */
export interface TrackFound {
  stageName: string;
  level: number;
  moving: boolean;
}

/**
 * What a finished track says in the log, for a kind (`kind`, its own name)
 * and what was found of it, or null when there was no sign within `range`.
 * The island's `track_said`, word for word.
 */
export function trackSaid(kind: string, range: number, found: TrackFound | null, r: TrackReading | null): string {
  if (!found || !r) return `No ${kind.toLowerCase()} within ${range} tiles.`;
  const b = TRACK_BANDS[r.band];
  const name = b.stage ? found.stageName : kind;
  if (b.detail) {
    return `Tracks: ${name}, level ${found.level}, ${r.way}, ${trackDistSays(r)}, ${found.moving ? 'moving' : 'still'}.`;
  }
  return `Tracks: ${name}, ${r.way}, ${trackDistSays(r)}.`;
}

/** Whether a kind's page in the field guide has a Track button: a wildermon, not a monster, and one you have seen. */
export const trackable = (def: SpeciesDef, seen: ReadonlySet<string>): boolean => !def.monster && seen.has(def.id);

/** Why a kind (its definition, if there is one) cannot be tracked, or null when it can: the island's `track_refusal`, in the same words. */
export function trackRefusal(def: SpeciesDef | undefined, seen: ReadonlySet<string>): string | null {
  if (!def) return 'No such kind.';
  if (def.monster) return `${def.name}: not a wildermon, no trail.`;
  if (!seen.has(def.id)) return `${def.name} not seen yet: only kinds marked seen in your field guide can be tracked.`;
  return null;
}

/** The nearest wild one of a kind within `range` of (x, y), nearer first and the lower id on a tie; null when there is none. */
export function nearestWild(list: Iterable<Creature>, species: string, x: number, y: number, range: number): Creature | null {
  let best: Creature | null = null;
  let bestD = Infinity;
  for (const c of list) {
    if (c.species !== species || c.mode !== 'wild') continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d > range) continue;
    if (d < bestD || (d === bestD && best && c.id < best.id)) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

/** The arrow a track leaves on the screen: what it is labelled, the way it points, from where, and when it was read. */
export interface Trail {
  name: string;
  bearing: number;
  dist: string;
  x: number;
  y: number;
  at: number;
}

/**
 * What each band of `TRACK_BANDS` says, off the table: "at 50 to 79, the way
 * to 16 points and the distance to the nearest 20 tiles, with the stage it is
 * at". For the Skills window, the help and What's new.
 */
export function trackBandsSays(): string[] {
  const way = (b: TrackBand): string => (b.points === 360 ? 'to 1°' : `to ${b.points} points`);
  const far = (b: TrackBand): string => (b.round === null ? `far (over ${TRACK_FAR} tiles) or not` : `to the nearest ${b.round} tiles`);
  return TRACK_BANDS.map((b, i) => {
    const adds = [b.stage && !TRACK_BANDS[i - 1]?.stage ? 'evolution stage' : '', b.detail && !TRACK_BANDS[i - 1]?.detail ? 'level and moving or still' : '']
      .filter(Boolean);
    const upto = TRACK_BANDS[i + 1] ? `${b.at} to ${TRACK_BANDS[i + 1].at - 1}` : `${b.at} and over`;
    return `${upto}: way ${way(b)}, distance ${far(b)}${adds.length ? `, plus ${listed(adds)}` : ''}`;
  });
}

/** The spread, in words off the numbers: "up to 60° either way at nought, 0.6° less a level, and never under 5°, from 92". */
export const trackErrSays = (): string =>
  `±${TRACK_ERR_MOST}° at level 0, −${degreesSays(TRACK_ERR_MOST / SKILL_TOP)}° per level, min ±${TRACK_ERR_LEAST}° from level ${TRACK_ERR_FLOOR_AT}`;

/**
 * What the Skills window says Tracking is worth, short and as a sentence: the
 * reach and the spread at the level you are at, and what every band adds.
 */
export function trackingSays(skill: number): [string, string] {
  const L = trackLevel(skill);
  const err = trackErr(L);
  const band = TRACK_BANDS[trackBand(L)];
  const bands = trackBandsSays();
  const reach = trackRange(L);
  return [
    `${reach} tiles · ±${fmt(err)}° · ${band.points === 360 ? 'degree' : `${band.points} points`}`,
    `Track (from a kind's field guide page): nearest wild one of a seen kind within ${TRACK_RANGE_BASE} tiles, +${TRACK_RANGE_PER} per level `
      + `(${trackRange(L)} now). Bearing error: ${trackErrSays()} (±${fmt(err)}° now). Levels: ${bands.join('; ')}.`,
  ];
}

/** A number of degrees as a window says it: to a tenth, and whole where it is whole. */
export const degreesSays = (n: number): string => String(Math.round(n * 10) / 10);
const fmt = degreesSays;

/** The ask for a go of Track at a kind, from where you stand: what the field guide's button sends. */
export function trackTarget(g: Game, species: string): Target {
  const p = g.player;
  return { kind: 'tile', x: p.tileX, y: p.tileY, cx: p.tileX, cy: p.tileY, species };
}

/**
 * The arrow a `tracked` line names: what the island says to the browser whose
 * go of Track read a trail, `{"name":..,"bearing":..,"far":..,"tiles":..}`,
 * put on the screen rather than in the log (`perform_track`). Null for
 * anything else.
 */
export function trackedArrow(text: string): Pick<Trail, 'name' | 'bearing' | 'dist'> | null {
  try {
    const o = JSON.parse(text) as { name?: unknown; bearing?: unknown; far?: unknown; tiles?: unknown };
    if (typeof o.name !== 'string' || o.name.length > 64 || typeof o.bearing !== 'number' || !Number.isFinite(o.bearing)) return null;
    const tiles = typeof o.tiles === 'number' && Number.isFinite(o.tiles) ? o.tiles : null;
    return { name: o.name, bearing: o.bearing, dist: trackDistSays({ far: o.far === true, tiles }) };
  } catch {
    return null;
  }
}
