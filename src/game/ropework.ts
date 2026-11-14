/**
 * Ropemaking: what the skill does past the recipes it is worked by, and the
 * things made of rope that carry the rope in them.
 *
 * A leaf on purpose (it imports nothing), so the recipes, the furniture, the
 * skill pages, the help and the defs dump can all read it. Every number here
 * reaches the island as a function of the same name (`scripts/dump-defs.ts`),
 * and the rules are the island's (`rope_*` in the migrations): this side only
 * says them.
 */

/** The skill rope is laid up with. */
export const ROPEMAKING = 'ropemaking';

/**
 * The lay-ups: rope off wemp and thick rope off rope, on a rope tool. What the
 * skill's count, its failed go and the rope walk speak to. The island's
 * `rope_lay_up(recipe)`.
 */
export const LAY_UPS: readonly string[] = ['make_rope', 'make_thick_rope'];
export const isLayUp = (recipe: string): boolean => LAY_UPS.includes(recipe);

/** Rope a lay-up gives at Ropemaking 0 (`rope_per_lay_up`). */
export const LAY_UP_BASE = 1;
/** And one more for every this many levels of Ropemaking. */
export const LAY_UP_EVERY = 30;
/** What a lay-up gives at a level: 1, 2 at 30, 3 at 60, 4 at 90. The island's `rope_per_lay_up`. */
export const ropePerLayUp = (skill: number): number => LAY_UP_BASE + Math.floor(Math.max(0, Math.min(100, skill)) / LAY_UP_EVERY);

/** What a level of Ropemaking takes off the time of a go at a ropemaking job, as a share of it. */
export const ROPE_TIME_PER_LEVEL = 0.005;
/** A go at a ropemaking job at this level, as a share of its time: ×0.5 at 100. The island's `rope_time`. */
export const ropeTime = (skill: number): number => 1 - ROPE_TIME_PER_LEVEL * Math.max(0, Math.min(100, skill));

/** Above this level of Ropemaking a failed lay-up damages only part of its fibre. */
export const LAY_UP_SPARE_ABOVE = 50;
/** The share of a failed lay-up's fibre units damaged above that, rounded up; the rest is untouched. */
export const LAY_UP_FAIL_SHARE = 0.5;
/** How many of `n` units a failed lay-up damages at this level. The island's `rope_fail_units`. */
export const ropeFailUnits = (n: number, skill: number): number =>
  (skill > LAY_UP_SPARE_ABOVE ? Math.ceil(n * LAY_UP_FAIL_SHARE) : n);

/**
 * The rope walk: a long bench of hooks and a jack, one subtile across and a
 * tile long. A lay-up worked standing at it takes `ROPE_WALK_TIME` of the time
 * and comes out `ROPE_WALK_QL` better, to 100.
 */
export const ROPE_WALK = 'rope_walk';
export const ROPE_WALK_TIME = 0.6;
export const ROPE_WALK_QL = 5;

/**
 * The QL of the rope in a thing, carried into its own: a share of what it is
 * made at comes from the rope and thick rope it took, weighed by their mass,
 * the rest from the hands as before. Boats and traps; a bridge has no QL.
 * The island's `recipe.rope_share` and `rope_blend`.
 */
export const ROPE_SHARE_BOAT = 0.15;
export const ROPE_SHARE_TRAP = 0.25;
/** The inputs whose QL is carried. */
export const ROPE_INPUTS: readonly string[] = ['rope', 'thick_rope'];
/** What a thing made at `made` comes out at with rope of `rope` in it at `share`. */
export const ropeBlend = (made: number, rope: number, share: number): number => made * (1 - share) + rope * share;

/** A hammock's rest, beside a bed's 1 and a tent's 0.5 (`FurnitureDef.bed`). */
export const HAMMOCK_REST = 0.75;

/**
 * A bell rope: carried to ring a bell at all. The ring is heard, and the
 * settlement's workers come, within this many tiles of the bell at QL 0 and
 * this many more for every point of the rope's QL: 10 tiles to 100 at QL 100.
 * The island's `bell_heard`.
 */
export const BELL_ROPE = 'bell_rope';
export const BELL_HEARD_BASE = 10;
export const BELL_HEARD_PER_QL = 0.9;
export const bellHeard = (ql: number): number => BELL_HEARD_BASE + BELL_HEARD_PER_QL * Math.max(0, Math.min(100, ql));
/** Why a bell will not ring without one. */
export const NO_BELL_ROPE = 'Needs a bell rope in your pack.';
/** What a ring says to whoever rang it. The island's words too. */
export const bellRangSaid = (piece: string, x: number, y: number, came: number, deed: string, heard: number): string =>
  `Rang: ${piece.toLowerCase()} at ${x}, ${y}. Heard within ${Math.round(heard)} tiles. Settlement workers called: ${came}. Citizens of ${deed} in hearing notified.`;

/**
 * A lead rope: carried, a tamed wildermon that has no saddle and bridle may be
 * mounted, and goes at `LEAD_PACE` of its pace while it carries you so. The
 * island's `lead_pace`.
 */
export const LEAD_ROPE = 'lead_rope';
export const LEAD_PACE = 0.8;
/** Why a wildermon with no saddle and bridle will not be mounted without one. The island's words too. */
export const noTackSaid = (name: string): string => `${name}: no saddle and bridle, no lead rope.`;

/** Twine off a go: 2 wemp to 3 twine (`make_twine`). */
export const TWINE_MADE = 3;
