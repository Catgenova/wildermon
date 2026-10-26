/**
 * The surface of the sea.
 *
 * Water used to be a flat diamond of colour per tile with a faint breathing
 * alpha over it, which from a distance looked like a painted floor. It is a
 * surface now: a long swell and a short chop laid over each other, travelling
 * down the wind at a speed the wind sets, so a hard blow runs visible bands
 * across the bay and a flat calm barely moves at all.
 *
 * Nothing here is stored: the swell is a function of the clock and the wind,
 * laid over the sea as two gradients (`Renderer.swellBand`).
 */

/**
 * How many times a second the sea's picture -- its colour, its swell and the
 * lace along its shores -- is painted afresh (`Renderer.drawSea`); it is
 * copied on, moved with the view, in between. The swell and the foam both
 * move a tile in seconds, which ten steps a second keep smooth.
 */
export const SWELL_RATE = 10;

/** Tiles a second the swell travels at, in a full blow. */
export const SWELL_SPEED = 1.25;

/** The two waves the surface is made of, in tiles from crest to crest. */
export const LONG_WAVE = 9.5;
export const SHORT_WAVE = 3.6;

/** How much of the swell actually shows: a calm is glassy, a blow is not. */
export const swellShow = (force: number): number => 0.3 + 0.7 * Math.max(0, Math.min(1, force));

/** How bright a crest goes and how dark a trough, before the wind is counted. */
export const CREST_ALPHA = 0.10;
export const TROUGH_ALPHA = 0.085;

/* ---- The colour of it, shallow to deep -----------------------------------
 *
 * One ramp for all water, read by the world and by the map: the sea, a
 * spring's pond and a pool dug in a slab are each coloured by how deep they
 * are under their own surface, so a pond two feet deep is the colour of the
 * sea two feet deep. Light turquoise-green over the shallows, teal through the
 * middle depths, dark blue in deep water.
 *
 * Measured on the real island, the sea floor lies:
 *
 *     0–2      0.8%        20–40   16.7%
 *     2–5      1.5%        40–80   50.0%
 *     5–10     2.5%       80–160   23.0%
 *     10–20    5.6%
 *
 * so the stops are close together in the first twenty units, where the eye
 * reads the shape of a coast, and far apart below that.
 *
 * The world paints the ramp a corner at a time and lets the picture blend
 * between corners (`watertint.ts`), so it runs smooth across tiles; nothing
 * here is cut into steps.
 */

type RGB = readonly [number, number, number];

/** The ramp's colours, shallow to deep. */
export const WATER_SHALLOW: RGB = [124, 218, 180];
export const WATER_TURQUOISE: RGB = [98, 206, 192];
export const WATER_TEAL: RGB = [58, 164, 178];
export const WATER_BLUE: RGB = [40, 110, 156];
export const WATER_DEEP: RGB = [26, 60, 104];

/** The depth, in height units, each colour of the ramp is at; and how much of the floor the water hides there. */
export const WATER_STOPS: ReadonlyArray<{ depth: number; rgb: RGB; veil: number }> = [
  { depth: 0, rgb: WATER_SHALLOW, veil: 0.66 },
  { depth: 5, rgb: WATER_TURQUOISE, veil: 0.85 },
  { depth: 16, rgb: WATER_TEAL, veil: 0.97 },
  { depth: 42, rgb: WATER_BLUE, veil: 0.985 },
  { depth: 110, rgb: WATER_DEEP, veil: 0.995 },
];

/**
 * How far down the sun still lights the bottom the way it lights a hillside.
 * Light that has been through a few feet of water arrives from no one
 * direction, so the floor's slope shading fades out with depth and is gone by
 * here.
 */
export const WATER_LIT = 18;

/** Where a depth falls between two stops: the lower stop's index and how far on to the next, eased so a stop is never a crease. */
function stopAt(depth: number): [number, number] {
  const d = Math.max(0, depth);
  const last = WATER_STOPS.length - 1;
  if (d >= WATER_STOPS[last].depth) return [last - 1, 1];
  let i = 0;
  while (d > WATER_STOPS[i + 1].depth) i++;
  const t = (d - WATER_STOPS[i].depth) / (WATER_STOPS[i + 1].depth - WATER_STOPS[i].depth);
  return [i, t * t * (3 - 2 * t)];
}

/** The colour of water this deep over its floor, before any alpha. */
export function waterRgb(depth: number): [number, number, number] {
  const [i, t] = stopAt(depth);
  const a = WATER_STOPS[i].rgb;
  const b = WATER_STOPS[i + 1].rgb;
  return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
}

/** How much of the floor water this deep hides: thin enough over the shallows to show the sand. */
export function waterVeil(depth: number): number {
  const [i, t] = stopAt(depth);
  return WATER_STOPS[i].veil + (WATER_STOPS[i + 1].veil - WATER_STOPS[i].veil) * t;
}

/* ---- Where it meets the land ---------------------------------------------
 *
 * Along every shore, sea and pond: a band of wet ground on the land side, and
 * a line of broken foam that runs up the beach and back (`shore.ts`). Widths
 * are in tiles measured across the shore, so a steep rock face and a shelving
 * beach carry the same band; the sand factor makes sand's wider than rock's.
 */

/** Foam, the wet ground's tint, and the wake's foam: one white for all broken water. */
export const FOAM: RGB = [246, 252, 250];
export const WET_GROUND: RGB = [58, 50, 44];
/** How dark the wet band goes at the waterline, as an alpha over the ground. */
export const WET_ALPHA = 0.2;
/** How far up the shore the wet band reaches, in tiles: on rock, and on sand. */
export const WET_ROCK = 0.16;
export const WET_SAND = 0.45;
/** How far the foam runs up the shore and back from the waterline, in tiles, on sand; rock gets `SHORE_ROCK` of it. */
export const SURGE_UP = 0.16;
export const SURGE_BACK = 0.14;
/** How wide the foam line is, in tiles, on sand. */
export const FOAM_WIDE = 0.22;
/** What share of sand's surge and foam a rocky shore gets. */
export const SHORE_ROCK = 0.45;
/** Seconds for one run up the shore and back. */
export const SURGE_PERIOD = 6.5;
/** How strong the foam is at its brightest, and how much of that a pond's still water keeps. */
export const FOAM_ALPHA = 0.85;
export const POND_FOAM = 0.55;
/** How much of the sea's surge and foam line a pond's bank gets, and of its wet band. */
export const POND_SURGE = 0.3;
export const WET_POND = 0.5;
/** A wake's foam at its freshest; how much of each side's spread its arm is; how much of it the track down the middle is. */
export const WAKE_ALPHA = 0.8;
export const WAKE_ARM = 0.24;
export const WAKE_TRACK = 0.28;
/** How strong the shore and a wake are drawn at zoom 1, against zoom 2 and in. */
export const SHORE_FAR = 0.85;

/* ---- The water springs bring up -------------------------------------------
 *
 * A pond, a stream, a fall and a pool are the same water as the sea, off the
 * same ramp; these are the colours a stream and a fall are drawn in, which are
 * thin water over a bed, at the depths named.
 */

/** Spring water where a pond shelves up to its bank, over most of it, and in its deepest middle. */
export const SPRING_SHALLOW: RGB = waterRgb(1);
export const SPRING_WATER: RGB = waterRgb(6);
export const SPRING_DEEP: RGB = waterRgb(18);
/** The thin darker line where it meets a bank or a wall. */
export const SPRING_EDGE: RGB = [44, 134, 140];
/** Foam, spray and the ripples on the surface. */
export const SPRING_FOAM: RGB = FOAM;
/** The two streaks a fall comes down in: the near white, and the darker teal between them. */
export const SPRING_PALE: RGB = [214, 248, 238];
export const SPRING_DARK: RGB = [52, 156, 162];
