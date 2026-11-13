/**
 * The cold laid over ground that is remembered rather than watched.
 *
 * A neutral grey rather than the blue it was: remembered ground is *memory*,
 * not night, and a blue wash said "it is dark over there" where what is meant
 * is "you are not looking". The colour underneath it is drained of its own
 * hue as well — see `computeColor` — so the two together read as an old
 * photograph of the place rather than the place at midnight.
 */
export const FOG_RGB = '30, 30, 32';
export const FOG_ALPHA = 0.46;
export const FOG_COLOR = `rgba(${FOG_RGB}, ${FOG_ALPHA})`;
/** The same laid solid, for the wash's own layer (`fogLayer`). */
export const FOG_INK = `rgb(${FOG_RGB})`;
