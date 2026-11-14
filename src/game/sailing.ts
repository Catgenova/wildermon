/**
 * Sailing: what the skill does past the pace it already gave (`travel.ts`),
 * and what a hull is fitted and worked with.
 *
 * A leaf on purpose (it imports nothing), so the wind, the game, the skill
 * pages, the help and the defs dump can all read it. Every number here
 * reaches the island as a function of the same name (`scripts/dump-defs.ts`),
 * and the island holds a hull to the rules that need holding (`sail_*` in the
 * migrations); the points of sail and the turn through the wind are the
 * browser's to sail, as the wind always was, under the island's top speed.
 */

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/* ---- points of sail ------------------------------------------------------------------- */

/** The closest a hull sails to the wind's eye, in degrees, at Sailing 1 and at `SAIL_TOP_AT`. */
export const NO_GO_AT_ONE = 60;
export const NO_GO_AT_TOP = 35;
/** The level the skill has the whole of what it adds at. */
export const SAIL_TOP_AT = 100;
/** A rigging set fitted brings her this many degrees closer to the wind. */
export const RIGGING_CLOSER = 10;
/** The closest to the wind at a level, in degrees, rigged or not: 60 at 1, 35 at 100, 10 fewer rigged. The island's `no_go_degrees`. */
export const noGoDegrees = (skill: number, rigged = false): number =>
  NO_GO_AT_ONE - ((NO_GO_AT_ONE - NO_GO_AT_TOP) * (clamp(skill, 1, SAIL_TOP_AT) - 1)) / (SAIL_TOP_AT - 1) - (rigged ? RIGGING_CLOSER : 0);
/** The same in radians, as the wind reads it. */
export const noGoAt = (skill: number, rigged = false): number => (noGoDegrees(skill, rigged) * Math.PI) / 180;

/** What Sailing `SAIL_TOP_AT` makes of a reach, as a share more of it: ×1 at 0, ×1.15 at 100. */
export const BEAM_TOP = 0.15;
/** A reach's pace at a level. The island's `beam_pace`. */
export const beamPace = (skill: number): number => 1 + (BEAM_TOP * clamp(skill, 0, SAIL_TOP_AT)) / SAIL_TOP_AT;

/* ---- a turn through the wind ------------------------------------------------------------ */

/** Seconds a tack or a gybe takes at Sailing 1 and at `SAIL_TOP_AT`, and her pace through it. */
export const TACK_SECS_AT_ONE = 2;
export const TACK_SECS_AT_TOP = 0.5;
export const TACK_PACE = 0.3;
/** Seconds a turn through the wind costs at a level. */
export const tackSecs = (skill: number): number =>
  TACK_SECS_AT_ONE - ((TACK_SECS_AT_ONE - TACK_SECS_AT_TOP) * (clamp(skill, 1, SAIL_TOP_AT) - 1)) / (SAIL_TOP_AT - 1);

/* ---- rough water ---------------------------------------------------------------------- */

/** Wind stronger than this is a gale. */
export const GALE = 0.7;
/** Below this level of Sailing a hull takes damage in a gale. */
export const GALE_SAFE_AT = 30;
/** Tiles sailed in a gale for each point of damage a hull takes below `GALE_SAFE_AT`. */
export const GALE_TILES_PER_DAMAGE = 10;
/** What a rowing boat says when asked to put out in a gale. The island's words too. */
export const GALE_ROW_SAID = 'A gale: a rowing boat cannot put out.';
/** Whether a wind of this force is a gale. */
export const isGale = (force: number): boolean => force > GALE;

/* ---- the hold --------------------------------------------------------------------------- */

/** What Sailing `SAIL_TOP_AT` adds to the hold of the boat you have the helm of, as a share of it. */
export const CARGO_TOP = 0.25;
/** The hold at a level, as a share of its own. The island's `cargo_room`. */
export const cargoRoom = (skill: number): number => 1 + (CARGO_TOP * clamp(skill, 0, SAIL_TOP_AT)) / SAIL_TOP_AT;

/* ---- what a hull is fitted with ---------------------------------------------------------- */

/** A rigging set: fitted to a sailing boat or a caravel, her speed ×(1 + this) and `RIGGING_CLOSER` closer to the wind. */
export const RIGGING_SET = 'rigging_set';
export const RIGGING_PACE = 0.1;
/** What a fitted rigging set makes of her pace. */
export const riggingPace = (rigged: boolean): number => (rigged ? 1 + RIGGING_PACE : 1);
/** What her sails' QL adds to her speed at 100, as a share, and in proportion below. */
export const SAIL_QL_TOP = 0.1;
/** Her sails' pace off the QL of the sailcloth they were made of. The island's `sail_ql_pace`. */
export const sailQlPace = (ql: number): number => 1 + (SAIL_QL_TOP * clamp(ql, 0, 100)) / 100;
/** The mark on a hull that holds her sails' pace (`Mark`). */
export const SAILS_MARK = 'sails';
/** The mark on a hull that says a rigging set is fitted. */
export const RIG_MARK = 'rig';
/** A hull's marks, read by name: hers are kept in the same `mark` her maker's are, under names of their own. */
const marked = (f: { mark?: object | null }, key: string): number | undefined => (f.mark as Record<string, number> | null | undefined)?.[key];
/** Whether a rigging set is fitted to her. */
export const isRigged = (f: { mark?: object | null }): boolean => !!marked(f, RIG_MARK);
/** What her sails' QL makes of her pace: one for a hull with no sailcloth in her. */
export const sailsPace = (f: { mark?: object | null }): number => marked(f, SAILS_MARK) ?? 1;

/* ---- work from a boat ------------------------------------------------------------------- */

/** Water deeper than this, in height units (a tenth of a metre), is deep: 4 m. */
export const DEEP_WATER = 40;
/** A cast from a boat in deep water: the chance a fish stays on, times this, and deep-water fish only. */
export const DEEP_CATCH = 1.3;
/** A net cast from a boat in deep water hauls this many times what a shore net does. */
export const DEEP_NET = 1.5;
/** Sounding the depth: the tiles round you a sounding reads, every way. */
export const SOUND_REACH = 5;
/** What a sounding teaches Sailing, as the base of a gain. */
export const SOUND_LEARN = 0.3;
/** Real seconds a sounding stays on the map. */
export const SOUND_SHOWN = 300;

/* ---- training ---------------------------------------------------------------------------- */

/** A tile sailed in a gale counts this many times; one sailed close-hauled this many. */
export const GALE_LEARN = 2;
export const CLOSE_LEARN = 1.5;
