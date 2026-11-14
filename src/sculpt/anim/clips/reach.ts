/**
 * Reaching up to pick, reading what is held, and the lanterns: the clips of the jobs done with the hands at a height
 * other than the bench's, stood where the idle stands the feet (`plant`, so the fades in and out keep them put), the
 * hands put on their places (`Clip.hands`: body heights across (the body's left), up from the ground and forward), the
 * trunk, the head and the elbows' sides keyed. Each is played mirrored, left-handed, from the facings the flat figure
 * works left-handed from (`../index.ts` LEFT_OF). The props are tools/sculpt/gear/reach.mjs's.
 *
 * - P1 `pick-high` (picking fruit, picking a sprout): the right hand up overhead into the crown, closed on the fruit,
 *   twisted off, pulled down into the left hand cupped at the chest, let go into it.
 * - P2 `pick-grapes`: both hands up to the bunch on the trellis at head height, the left under it, the right twisting
 *   its stalk; both brought down to the chest.
 * - P3 `take-honey`: bent over the skep, the left hand tipping its dome up, the right reaching in under it, twisting a
 *   comb free and drawing it out up to the chest.
 * - R1 `read-book` (studying a book): the open book on the left hand, the right on the right page's edge, the head bowed
 *   to it and moving along the lines; the page lifted and turned over to the left.
 * - R2 `read-tablet` (reading a rune tablet): the tablet held up by its edge in the left fist, the right forefinger
 *   tracing the rows of runes, the head following.
 * - R3 `read-sheet` (reading a recipe, a formula): the sheet held in both hands before the chest, the head moving down
 *   the lines; brought nearer and held further off.
 * - R4 `read-map` (studying a map): the map held wide in both hands, looked down at, then a look up and across to the
 *   land and back down to it.
 * - L1 `lamp-fit`: the lantern held up from under its foot, lifted from the waist up overhead to the hook, on the toes,
 *   steadied by the left hand, hung.
 * - L2 `lamp-take`: both hands up overhead on the lantern, closed on it, lifted off the hook and held; let down at the
 *   go's end, as the lantern goes into the pack.
 * - L3 `lamp-candle`: the left hand up holding the lantern open, the candle brought up in the right and set in it.
 * - L4 `lamp-light`: the taper struck down across the left palm, lifted to the lantern, the left hand cupped round the
 *   flame to shield it, held to the wick.
 * - L5 `lamp-douse`: the right hand up to the lantern, the wick pinched out, the left steadying it.
 *
 * The lantern hangs at `LAMP_HANG` over the ground (`../../../game/lamps.ts`): over the head of either body, so its clips
 * reach the hands up overhead to the most a body can (the elbows near straight, up on the toes), under the lantern's foot.
 * A skep's dome stands to the man's belt; the grapes on a trellis hang at his head; a fruit tree's lowest fruit at the
 * full reach of his arm.
 */
import type { Clip, Correction, HandReach, Key, Side } from '../clip';
import { merge, poseToPose, type Beat, type KeyPose } from '../author';
import type { Euler } from '../math';

/** The feet where the idle stands them (`./idle.ts`). */
const PLANT: NonNullable<Clip['plant']> = { rot: { thigh_l: [0, -3, 6], thigh_r: [0, 3, -6] } };
/** Hers closer together, as the idle stands them. */
const HER_FEET: Record<string, Euler> = { thigh_l: [0, 0, -6], thigh_r: [0, 0, 6] };

/** The fingers of a hand, by how they are closed. */
const fingers = (s: Side, f1: number, f2: number, thumb = 0): Record<string, Euler> => ({ [`fingers_01_${s}`]: [f1, 0, 0], [`fingers_02_${s}`]: [f2, 0, 0], [`thumb_02_${s}`]: [thumb, 0, 0] });
/** Closed on what it holds (a fruit, a stalk, a comb). */
const FIST = (s: Side) => fingers(s, 70, 80, 20);
/** Open, about to close. */
const OPEN = (s: Side) => fingers(s, 4, 6, -10);
/** Cupped, palm up, to take what is dropped into it. */
const CUP = (s: Side) => fingers(s, 28, 34, 6);
/** Loosely closed, at rest. */
const LOOSE = (s: Side) => fingers(s, 14, 20, 0);
/** The forefinger and thumb pinched together (a wick, a page's corner), the other fingers curled. */
const PINCH = (s: Side): Record<string, Euler> => ({ [`fingers_01_${s}`]: [40, 0, 0], [`fingers_02_${s}`]: [60, 0, 0], [`thumb_02_${s}`]: [30, 0, 0] });

/** A beat: when, the key pose, how it is reached; where each reached hand is and its grip's way and knuckles; the other hand's place on the prop. */
interface Mark {
  t: number; pose: KeyPose; ease?: Beat['ease']; name?: string; key?: boolean;
  l?: Euler; r?: Euler; lWay?: Euler; rWay?: Euler; lKnuckles?: Euler; rKnuckles?: Euler;
  /** The other hand's place on the prop in the first, its own frame (`Clip.second`). */
  on?: Euler;
  /** Up on the toes, degrees of the heels raised about the balls of the feet. */
  toes?: number;
}
const keyOf = <T>(m: Mark, v: T): Key<T> => ({ t: m.t, v, ...(m.ease ? { ease: m.ease } : {}) });
/** A hand's reach from the beats that place it: its places, and its way and knuckles keyed where the beats give them. */
function handOf(marks: Mark[], s: Side, way: Euler, knuckles?: Euler): HandReach | undefined {
  const at = marks.filter((m) => m[s]);
  if (!at.length) return undefined;
  const ways = marks.filter((m) => m[`${s}Way`]), kn = marks.filter((m) => m[`${s}Knuckles`]);
  return {
    at: at.map((m) => keyOf(m, m[s] as Euler)),
    way: ways.length ? ways.map((m) => keyOf(m, m[`${s}Way`] as Euler)) : way,
    ...(kn.length ? { knuckles: kn.map((m) => keyOf(m, m[`${s}Knuckles`] as Euler)) } : knuckles ? { knuckles: [{ t: 0, v: knuckles }] } : {}),
  };
}
interface Opts {
  way?: Partial<Record<Side, Euler>>;
  /** The way each hand's knuckles point throughout, where the beats key none. */
  knuckles?: Partial<Record<Side, Euler>>;
  tools?: Clip['tools'];
  /** The other hand on the prop (`Clip.second`): its side and its grip's way in the prop's frame; its places from the beats (`Mark.on`). */
  second?: { side: Side; way: Euler };
  stretch?: Clip['stretch'];
  oneAGo?: boolean;
  lag?: Record<string, number>;
  her?: Correction;
}
/** A clip from its beats: looped, stood as the idle stands, the hands reached where the beats put them. */
function reachClip(name: string, length: number, marks: Mark[], o: Opts = {}): Clip {
  const toes = marks.some((m) => m.toes !== undefined);
  const beats: Beat[] = marks.map((m) => ({
    t: m.t, ease: m.ease, ...(m.key ? { stage: 'key' as const } : {}), ...(m.name ? { name: m.name } : {}),
    pose: toes ? { ...m.pose, feet: { l: { z: 0, lift: 0, pitch: -(m.toes ?? 0) }, r: { z: 0, lift: 0, pitch: -(m.toes ?? 0) } } } : m.pose,
  }));
  const { footKeys, ...keys } = poseToPose(beats, { length, loop: true, lag: o.lag ?? { neck_02: 0.03, head: 0.06 } });
  const hands: Partial<Record<Side, HandReach>> = {};
  for (const s of ['l', 'r'] as const) { const h = handOf(marks, s, o.way?.[s] ?? [0, 1, 0], o.knuckles?.[s]); if (h) hands[s] = h; }
  const on = marks.filter((m) => m.on);
  return {
    name, loop: true, length, mask: 'full', plant: PLANT, breath: { count: 1, depth: 0.5 }, armsFree: true,
    ...keys, hands,
    ...(toes && footKeys ? { feet: { stride: 1, ...footKeys } } : {}),
    ...(o.tools ? { tools: o.tools } : {}),
    ...(o.second && on.length ? { second: { side: o.second.side, at: on.map((m) => keyOf(m, m.on as Euler)), way: o.second.way } } : {}),
    ...(o.stretch ? { stretch: o.stretch } : {}),
    ...(o.oneAGo ? { oneAGo: true } : {}),
    bodies: { woman: { ...o.her, add: { ...HER_FEET, ...o.her?.add } } },
  };
}

/** The trunk and head stood, leant, bowed or looking up: spine and neck turns (degrees forward), the head's own, a turn to the left. */
const trunk = (lean: number, neck: number, head: number, yaw = 0, rise = 0): KeyPose => ({
  rot: {
    pelvis: [lean * 0.3, yaw * 0.2, 0], spine_01: [lean * 0.3, yaw * 0.2, 0], spine_02: [lean * 0.4, yaw * 0.3, 0], spine_03: [lean * 0.3, yaw * 0.3, 0],
    neck_01: [neck * 0.5, yaw * 0.3, 0], neck_02: [neck * 0.5, yaw * 0.3, 0], head: [head, yaw * 0.5, 0],
  },
  move: [0, rise, 0],
});
/** The elbows' sides before the reach (out and down), which the reach keeps them on. */
const ELBOWS: Record<string, Euler> = { upperarm_l: [20, 0, 14], lowerarm_l: [70, 0, 0], upperarm_r: [20, 0, -14], lowerarm_r: [70, 0, 0] };
/** Both arms raised overhead before the reach: the elbows out to the sides. */
const ARMS_UP: Record<string, Euler> = { upperarm_l: [120, 0, 30], lowerarm_l: [30, 0, 0], upperarm_r: [120, 0, -30], lowerarm_r: [30, 0, 0] };
/** The right raised, the left down at the chest. */
const RIGHT_UP: Record<string, Euler> = { upperarm_r: [120, 0, -30], lowerarm_r: [30, 0, 0], upperarm_l: [20, 0, 14], lowerarm_l: [70, 0, 0] };
/** Key poses and bones' turns merged, the later's over the earlier's. */
const pose = (...ps: Array<KeyPose | Record<string, Euler>>): KeyPose => merge(...ps.map((p): KeyPose => ('rot' in p ? (p as KeyPose) : { rot: p as Record<string, Euler> })));

/* ---- P1 pick-high: fruit, a sprout ----------------------------------------------------------------------------------- */
const PICK_LENGTH = 2.2;
/** Where the fruit is (the crown's lowest, at the full reach of the arm) and where the left hand waits at the chest. */
const CROWN: Euler = [-0.24, 0.985, 0.02], CATCH: Euler = [0.035, 0.6, 0.2];
/** The right fist's grip: the thumb across to the left as it closes on the fruit; turned a quarter about the arm to twist it off. */
const PICK_WAY: Euler = [0.8, 0, 0.6], TWIST_WAY: Euler = [-0.3, 0, 0.95];
/** The left palm up, its thumb out to the left. */
const CUP_WAY: Euler = [1, 0.1, 0.1], CUP_KNUCKLES: Euler = [-0.2, 0, 1];
const PICK: Mark[] = [
  { t: 0, name: 'let go', key: true, pose: pose(trunk(4, 6, 14), ELBOWS, OPEN('r'), CUP('l')), r: [0.0, 0.66, 0.21], rWay: [0.6, 0.3, 0.75], l: CATCH, lWay: CUP_WAY, lKnuckles: CUP_KNUCKLES, toes: 0 },
  { t: 0.55, name: 'reached up', key: true, ease: 'out', pose: pose(trunk(-6, -14, -20, 0, 0.012), RIGHT_UP, OPEN('r'), CUP('l')), r: CROWN, rWay: PICK_WAY, l: CATCH, lWay: CUP_WAY, lKnuckles: CUP_KNUCKLES, toes: 14 },
  { t: 0.75, name: 'closed', pose: pose(trunk(-6, -14, -20, 0, 0.012), RIGHT_UP, FIST('r'), CUP('l')), r: CROWN, rWay: PICK_WAY, l: CATCH, lWay: CUP_WAY, lKnuckles: CUP_KNUCKLES, toes: 14 },
  { t: 1.05, name: 'twisted', key: true, pose: pose(trunk(-6, -14, -20, -3, 0.012), RIGHT_UP, FIST('r'), CUP('l')), r: [-0.235, 0.98, 0.025], rWay: TWIST_WAY, l: CATCH, lWay: CUP_WAY, lKnuckles: CUP_KNUCKLES, toes: 14 },
  { t: 1.2, name: 'pulled off', ease: 'out', pose: pose(trunk(-4, -10, -16, -2, 0.006), RIGHT_UP, FIST('r'), CUP('l')), r: [-0.19, 0.88, 0.09], rWay: TWIST_WAY, l: CATCH, lWay: CUP_WAY, lKnuckles: CUP_KNUCKLES, toes: 4 },
  { t: 1.65, name: 'into the hand', key: true, pose: pose(trunk(4, 6, 14), ELBOWS, FIST('r'), CUP('l')), r: [0.005, 0.655, 0.21], rWay: [0.6, 0.3, 0.75], l: CATCH, lWay: CUP_WAY, lKnuckles: CUP_KNUCKLES, toes: 0 },
];
export const PICK_HIGH = reachClip('pick-high', PICK_LENGTH, PICK, { stretch: [[1.65, PICK_LENGTH]] });

/* ---- P2 pick-grapes: a bunch off the vine on a trellis ----------------------------------------------------------- */
const GRAPES_LENGTH = 2.2;
/** The bunch's stalk (the right fist) and its foot (the left palm under it), at the head's height ahead. */
const STALK: Euler = [-0.035, 0.84, 0.27], UNDER: Euler = [0.03, 0.77, 0.27];
const GRAPES: Mark[] = [
  { t: 0, name: 'down at the chest', key: true, pose: pose(trunk(4, 6, 14), ELBOWS, OPEN('r'), CUP('l')), r: [0.0, 0.66, 0.21], rWay: [0.6, 0.3, 0.75], l: CATCH, lWay: CUP_WAY, lKnuckles: CUP_KNUCKLES },
  { t: 0.5, name: 'up to the bunch', key: true, ease: 'out', pose: pose(trunk(2, -6, -8), ELBOWS, OPEN('r'), CUP('l')), r: STALK, rWay: PICK_WAY, l: UNDER, lWay: CUP_WAY, lKnuckles: CUP_KNUCKLES },
  { t: 0.7, name: 'closed on the stalk', pose: pose(trunk(2, -6, -8), ELBOWS, FIST('r'), CUP('l')), r: STALK, rWay: PICK_WAY, l: UNDER, lWay: CUP_WAY, lKnuckles: CUP_KNUCKLES },
  { t: 1.0, name: 'twisted', key: true, pose: pose(trunk(2, -6, -8, -3), ELBOWS, FIST('r'), CUP('l')), r: [-0.03, 0.835, 0.27], rWay: TWIST_WAY, l: [0.03, 0.765, 0.27], lWay: CUP_WAY, lKnuckles: CUP_KNUCKLES },
  { t: 1.6, name: 'down to the chest', key: true, pose: pose(trunk(4, 6, 14), ELBOWS, FIST('r'), CUP('l')), r: [0.01, 0.67, 0.22], rWay: [0.6, 0.3, 0.75], l: [0.03, 0.61, 0.21], lWay: CUP_WAY, lKnuckles: CUP_KNUCKLES },
];
export const PICK_GRAPES = reachClip('pick-grapes', GRAPES_LENGTH, GRAPES, { stretch: [[1.6, GRAPES_LENGTH]] });

/* ---- P3 take-honey: a comb out of the skep ----------------------------------------------------------------------- */
const HONEY_LENGTH = 2.8;
/**
 * Crouched at the skep: the hips let down between the knees (the knees out over the toes, the heels down), the trunk leant
 * over the thighs from the hips, the head down to the skep; `deep` 1 at the full crouch, turned to the left by `yaw`.
 */
const BENT = (deep: number, yaw = 0): KeyPose => ({
  rot: {
    pelvis: [24 * deep, yaw * 0.2, 0], spine_01: [6 * deep, yaw * 0.2, 0], spine_02: [6 * deep, yaw * 0.3, 0], spine_03: [4 * deep, yaw * 0.3, 0],
    neck_01: [-6 * deep, 0, 0], neck_02: [-2 * deep, 0, 0], head: [18, yaw * 0.5, 0],
    thigh_l: [70 * deep, -8 * deep, 14 * deep], thigh_r: [70 * deep, 8 * deep, -14 * deep], calf_l: [-110 * deep, 0, 0], calf_r: [-110 * deep, 0, 0],
  },
  move: [0, -0.24 * deep, 0.03 * deep],
});
/** The dome's side (the left hand on it) and its mouth under it (the right fist reached in). */
const DOME: Euler = [0.08, 0.36, 0.3], DOME_UP: Euler = [0.08, 0.41, 0.29], MOUTH: Euler = [-0.035, 0.2, 0.32];
const DOME_WAY: Euler = [0, 1, 0.3], DOME_KNUCKLES: Euler = [-0.4, 0, 1];
const HONEY: Mark[] = [
  { t: 0, name: 'hand on the dome', key: true, pose: pose(BENT(0.85), ELBOWS, OPEN('l'), LOOSE('r')), l: DOME, lWay: DOME_WAY, lKnuckles: DOME_KNUCKLES, r: [-0.07, 0.34, 0.24], rWay: [0.3, 0.3, 0.9] },
  { t: 0.45, name: 'dome tipped up', key: true, pose: pose(BENT(0.88, 3), ELBOWS, OPEN('l'), OPEN('r')), l: DOME_UP, lWay: DOME_WAY, lKnuckles: DOME_KNUCKLES, r: [-0.06, 0.27, 0.29], rWay: [0.4, 0.2, 0.9] },
  { t: 0.9, name: 'reached in', key: true, pose: pose(BENT(0.92, 4), ELBOWS, OPEN('l'), FIST('r')), l: DOME_UP, lWay: DOME_WAY, lKnuckles: DOME_KNUCKLES, r: MOUTH, rWay: [0.5, 0.1, 0.85] },
  { t: 1.25, name: 'comb twisted free', key: true, pose: pose(BENT(0.92, 2), ELBOWS, OPEN('l'), FIST('r')), l: DOME_UP, lWay: DOME_WAY, lKnuckles: DOME_KNUCKLES, r: [-0.03, 0.21, 0.32], rWay: [-0.2, 0.2, 0.95] },
  { t: 1.75, name: 'drawn out', key: true, ease: 'inOut', pose: pose(BENT(0.85, -2), ELBOWS, OPEN('l'), FIST('r')), l: DOME, lWay: DOME_WAY, lKnuckles: DOME_KNUCKLES, r: [-0.05, 0.42, 0.22], rWay: [0.4, 0.5, 0.75] },
  { t: 2.3, name: 'held up', pose: pose(BENT(0.85, -2), ELBOWS, OPEN('l'), FIST('r')), l: DOME, lWay: DOME_WAY, lKnuckles: DOME_KNUCKLES, r: [-0.05, 0.44, 0.21], rWay: [0.4, 0.5, 0.75] },
];
export const TAKE_HONEY = reachClip('take-honey', HONEY_LENGTH, HONEY, {
  stretch: [[1.75, 2.3]],
  // her shins longer for her height: let further down (as the tending crouches), her reach nearer
  her: { move: [1, 1.3, 1], hands: { l: [0, 0, -0.04], r: [0, 0, -0.04] } },
});

/* ---- R1 read-book --------------------------------------------------------------------------------------------------- */
const BOOK_LENGTH = 4.4;
/** The left hand under the book's spine before the chest, its knuckles to the right, the spine up the page toward the far edge. */
const BOOK_AT: Euler = [0.01, 0.6, 0.22], PAGE_UP: Euler = [0, 0.56, 0.83], BOOK_KNUCKLES: Euler = [-1, 0, 0];
/** A tablet and a sheet held more upright than a book, their faces to the eyes. */
const UPRIGHT: Euler = [0, 0.78, 0.62];
/** The right hand's place on the book (its own frame, game units: x toward the right page's edge, y up the page, z toward the eyes). */
const PAGE_EDGE: Euler = [2.0, 1.0, 0.75], PAGE_LIFT: Euler = [1.5, 1.4, 1.5], SPINE_OVER: Euler = [0.1, 1.5, 2.0], PAGE_DOWN: Euler = [-1.6, 1.3, 1.1];
/** Bowed to the book, the head moving along a line (turned a little left, then right) and down the page. */
const READ = (yaw: number, down: number): KeyPose => pose(trunk(5, 12 + down, 20 + down, yaw, -0.004), ELBOWS, LOOSE('l'), PINCH('r'));
const BOOK: Mark[] = [
  { t: 0, name: 'reading, top of the page', key: true, pose: READ(4, 0), l: BOOK_AT, on: PAGE_EDGE },
  { t: 0.9, name: 'along the line', pose: READ(-4, 1), l: BOOK_AT, on: PAGE_EDGE },
  { t: 1.4, name: 'next line', pose: READ(4, 3), l: BOOK_AT, on: PAGE_EDGE },
  { t: 2.3, name: 'along the line', pose: READ(-4, 4), l: BOOK_AT, on: PAGE_EDGE },
  { t: 2.8, name: 'page lifted', key: true, ease: 'out', pose: READ(-2, 2), l: [0.012, 0.605, 0.222], on: PAGE_LIFT },
  { t: 3.15, name: 'over the spine', pose: READ(2, 0), l: [0.012, 0.605, 0.222], on: SPINE_OVER },
  { t: 3.5, name: 'laid down left', key: true, pose: READ(4, 0), l: BOOK_AT, on: PAGE_DOWN },
  { t: 3.95, name: 'back to the edge', pose: READ(4, 0), l: BOOK_AT, on: [1.6, 1.1, 1.2] },
];
export const READ_BOOK = reachClip('read-book', BOOK_LENGTH, BOOK, {
  way: { l: PAGE_UP }, knuckles: { l: BOOK_KNUCKLES }, tools: { l: 'book_open' }, second: { side: 'r', way: [0, 1, 0] },
  stretch: [[0, 2.3]],
  // her arms shorter for her height: the book nearer
  her: { hands: { l: [0, -0.01, -0.055] } },
});

/* ---- R2 read-tablet -------------------------------------------------------------------------------------------------- */
const TABLET_LENGTH = 3.2;
/** The left fist on the tablet's near edge, its face up toward the eyes. */
const TABLET_AT: Euler = [0.04, 0.6, 0.22];
/** The right forefinger on the runes (the tablet's own frame): along a row, then the next. */
const row = (k: number, u: number): Euler => [0.4 + u * 1.6, 2.15 - k * 0.6, 0.5];
const TABLET_POSE = (yaw: number, down: number): KeyPose => pose(trunk(5, 12 + down, 20 + down, yaw, -0.004), ELBOWS, LOOSE('l'), PINCH('r'));
const TABLET: Mark[] = [
  { t: 0, name: 'first row', key: true, pose: TABLET_POSE(4, 0), l: TABLET_AT, on: row(0, 0) },
  { t: 0.8, name: 'traced along', pose: TABLET_POSE(-3, 1), l: TABLET_AT, on: row(0, 1) },
  { t: 1.1, name: 'next row', key: true, pose: TABLET_POSE(4, 3), l: TABLET_AT, on: row(1, 0) },
  { t: 1.9, name: 'traced along', pose: TABLET_POSE(-3, 4), l: TABLET_AT, on: row(1, 1) },
  { t: 2.2, name: 'next row', key: true, pose: TABLET_POSE(4, 6), l: TABLET_AT, on: row(2, 0) },
  { t: 3.0, name: 'traced along', pose: TABLET_POSE(-3, 7), l: TABLET_AT, on: row(2, 1) },
];
export const READ_TABLET = reachClip('read-tablet', TABLET_LENGTH, TABLET, {
  way: { l: UPRIGHT }, knuckles: { l: BOOK_KNUCKLES }, tools: { l: 'rune_tablet' }, second: { side: 'r', way: [0, 1, 0] },
  her: { hands: { l: [0, -0.01, -0.055] } },
});

/* ---- R3 read-sheet ----------------------------------------------------------------------------------------------- */
const SHEET_LENGTH = 3.6;
/** The left fist on the sheet's near edge; the right on its far edge (the sheet's own frame). */
const SHEET_AT: Euler = [0.08, 0.6, 0.21], SHEET_NEAR: Euler = [0.08, 0.63, 0.19], SHEET_EDGE: Euler = [2.6, 1.2, 0.2];
const SHEET_POSE = (yaw: number, down: number): KeyPose => pose(trunk(4, 10 + down, 18 + down, yaw, -0.003), ELBOWS, LOOSE('l'), LOOSE('r'));
const SHEET: Mark[] = [
  { t: 0, name: 'top of the sheet', key: true, pose: SHEET_POSE(3, 0), l: SHEET_AT, on: SHEET_EDGE },
  { t: 0.9, name: 'along the line', pose: SHEET_POSE(-3, 2), l: SHEET_AT, on: SHEET_EDGE },
  { t: 1.4, name: 'brought nearer', key: true, pose: SHEET_POSE(2, 6), l: SHEET_NEAR, on: SHEET_EDGE },
  { t: 2.3, name: 'along the line', pose: SHEET_POSE(-3, 8), l: SHEET_NEAR, on: SHEET_EDGE },
  { t: 2.8, name: 'held off', key: true, pose: SHEET_POSE(0, 2), l: SHEET_AT, on: SHEET_EDGE },
];
export const READ_SHEET = reachClip('read-sheet', SHEET_LENGTH, SHEET, {
  way: { l: UPRIGHT }, knuckles: { l: BOOK_KNUCKLES }, tools: { l: 'recipe_sheet' }, second: { side: 'r', way: [0, 1, 0] },
  her: { hands: { l: [0.01, -0.01, -0.045] } },
});

/* ---- R4 read-map ------------------------------------------------------------------------------------------------- */
const MAP_LENGTH = 4.4;
/** The left fist on the map's near edge, lower and further out to the left than a book's; the right on its far edge. */
const MAP_AT: Euler = [0.15, 0.57, 0.24], MAP_UP: Euler = [0, 0.66, 0.75], MAP_EDGE: Euler = [5.3, 1.1, 0.2];
const MAP_POSE = (yaw: number, down: number): KeyPose => pose(trunk(5, 12 + down, 20 + down, yaw, -0.004), ELBOWS, LOOSE('l'), LOOSE('r'));
const MAP: Mark[] = [
  { t: 0, name: 'looked down at', key: true, pose: MAP_POSE(4, 0), l: MAP_AT, on: MAP_EDGE },
  { t: 1.3, name: 'across it', pose: MAP_POSE(-6, 2), l: MAP_AT, on: MAP_EDGE },
  { t: 2.0, name: 'looked up across', key: true, ease: 'inOut', pose: pose(trunk(1, -6, -4, -22, -0.002), ELBOWS, LOOSE('l'), LOOSE('r')), l: [0.15, 0.56, 0.235], on: MAP_EDGE },
  { t: 2.9, name: 'held the look', pose: pose(trunk(1, -6, -4, -26, -0.002), ELBOWS, LOOSE('l'), LOOSE('r')), l: [0.15, 0.56, 0.235], on: MAP_EDGE },
  { t: 3.5, name: 'back to the map', key: true, pose: MAP_POSE(-2, 2), l: MAP_AT, on: MAP_EDGE },
];
export const READ_MAP = reachClip('read-map', MAP_LENGTH, MAP, {
  way: { l: MAP_UP }, knuckles: { l: BOOK_KNUCKLES }, tools: { l: 'chart' }, second: { side: 'r', way: [0, 1, 0] },
  stretch: [[2.0, 2.9]],
  her: { hands: { l: [0.05, 0.01, -0.06] } },
});

/* ---- the lanterns ------------------------------------------------------------------------------------------------ */
/** Under the lantern's foot ahead and overhead (each hand a little either side of it), at the full reach of the arms. */
const LAMP: Euler = [-0.02, 1.04, 0.18], LAMP_L: Euler = [0.05, 1.03, 0.18], LAMP_R: Euler = [-0.05, 1.04, 0.18];
/** Looking up at it, stretched up, on the toes. */
const UP = (yaw = 0): KeyPose => trunk(-6, -16, -22, yaw, 0.014);
/** Stood looking down at the hands before the chest. */
const DOWN = (yaw = 0): KeyPose => trunk(3, 6, 12, yaw);
const UP_TOES = 16;
/** A hand's grip up at the lantern, the thumb across toward the other hand; the knuckles up. */
const UP_WAY_R: Euler = [1, 0, 0.2], UP_WAY_L: Euler = [-1, 0, 0.2], KNUCKLES_UP: Euler = [0, 1, 0.1];

/* L1 lamp-fit: lifted from under its foot from the waist to the hook, guided by the left, hung, the hands held up there */
const FIT: Mark[] = [
  { t: 0, name: 'lantern at the waist', key: true, pose: pose(DOWN(), ELBOWS, LOOSE('l')), r: [-0.06, 0.48, 0.2], rWay: UP_WAY_R, rKnuckles: KNUCKLES_UP, l: [0.08, 0.55, 0.16], lWay: [0, 1, 0.2], toes: 0 },
  { t: 0.55, name: 'lifted to the hook', key: true, ease: 'out', pose: pose(UP(), ARMS_UP, OPEN('l')), r: LAMP_R, rWay: UP_WAY_R, rKnuckles: KNUCKLES_UP, l: [0.05, 0.95, 0.19], lWay: [0, 1, 0.2], toes: UP_TOES },
  { t: 0.8, name: 'hung', key: true, ease: 'in', pose: pose(UP(), ARMS_UP, OPEN('l')), r: [-0.05, 1.02, 0.18], rWay: UP_WAY_R, rKnuckles: KNUCKLES_UP, l: [0.05, 0.94, 0.19], lWay: [0, 1, 0.2], toes: UP_TOES },
  { t: 1.4, name: 'held', pose: pose(UP(), ARMS_UP, OPEN('l')), r: [-0.05, 1.02, 0.18], rWay: UP_WAY_R, rKnuckles: KNUCKLES_UP, l: [0.05, 0.94, 0.19], lWay: [0, 1, 0.2], toes: UP_TOES },
];
export const LAMP_FIT = reachClip('lamp-fit', 1.6, FIT, { tools: { r: 'lantern' }, oneAGo: true, stretch: [[0.8, 1.4]] });

/* L2 lamp-take: both hands up on it, lifted off the hook and held, let down at the go's end (the lantern into the pack then) */
const LIFTED_R: Euler = [-0.05, 1.06, 0.17], LIFTED_L: Euler = [0.05, 1.05, 0.17];
const TAKE: Mark[] = [
  { t: 0, name: 'hands down', key: true, pose: pose(DOWN(), ELBOWS, LOOSE('l'), LOOSE('r')), r: [-0.07, 0.62, 0.18], rWay: [0, 1, 0.2], rKnuckles: [0, 0.3, 1], l: [0.07, 0.62, 0.18], lWay: [0, 1, 0.2], lKnuckles: [0, 0.3, 1], toes: 0 },
  { t: 0.45, name: 'up on the lantern', key: true, ease: 'out', pose: pose(UP(), ARMS_UP, OPEN('l'), OPEN('r')), r: LAMP_R, rWay: UP_WAY_R, rKnuckles: KNUCKLES_UP, l: LAMP_L, lWay: UP_WAY_L, lKnuckles: KNUCKLES_UP, toes: UP_TOES },
  { t: 0.6, name: 'closed on it', pose: pose(UP(), ARMS_UP, FIST('l'), FIST('r')), r: LAMP_R, rWay: UP_WAY_R, rKnuckles: KNUCKLES_UP, l: LAMP_L, lWay: UP_WAY_L, lKnuckles: KNUCKLES_UP, toes: UP_TOES },
  { t: 0.85, name: 'lifted off the hook', key: true, ease: 'out', pose: pose(UP(), ARMS_UP, FIST('l'), FIST('r')), r: LIFTED_R, rWay: UP_WAY_R, rKnuckles: KNUCKLES_UP, l: LIFTED_L, lWay: UP_WAY_L, lKnuckles: KNUCKLES_UP, toes: UP_TOES + 6 },
  { t: 1.4, name: 'held', pose: pose(UP(), ARMS_UP, FIST('l'), FIST('r')), r: LIFTED_R, rWay: UP_WAY_R, rKnuckles: KNUCKLES_UP, l: LIFTED_L, lWay: UP_WAY_L, lKnuckles: KNUCKLES_UP, toes: UP_TOES + 6 },
];
export const LAMP_TAKE = reachClip('lamp-take', 1.6, TAKE, { oneAGo: true, stretch: [[0.85, 1.4]] });

/* L3 lamp-candle: the left hand up holding the lantern open, the candle brought up in the right and set in */
const CANDLE: Mark[] = [
  { t: 0, name: 'candle at the chest', key: true, pose: pose(DOWN(), ELBOWS, LOOSE('l')), r: [-0.05, 0.64, 0.2], rWay: [0, 1, 0.15], l: [0.07, 0.62, 0.18], lWay: [0, 1, 0.2], toes: 0 },
  { t: 0.4, name: 'lantern opened', key: true, ease: 'out', pose: pose(UP(4), RIGHT_UP, OPEN('l')), r: [-0.06, 0.86, 0.22], rWay: [0, 1, 0.15], l: LAMP_L, lWay: UP_WAY_L, lKnuckles: KNUCKLES_UP, toes: UP_TOES },
  { t: 0.8, name: 'candle set in', key: true, ease: 'in', pose: pose(UP(), ARMS_UP, OPEN('l')), r: [-0.03, 0.99, 0.2], rWay: [0, 1, 0.15], l: LAMP_L, lWay: UP_WAY_L, lKnuckles: KNUCKLES_UP, toes: UP_TOES },
  { t: 1.4, name: 'held', pose: pose(UP(), ARMS_UP, OPEN('l')), r: [-0.03, 0.995, 0.2], rWay: [0, 1, 0.15], l: LAMP_L, lWay: UP_WAY_L, lKnuckles: KNUCKLES_UP, toes: UP_TOES },
];
export const LAMP_CANDLE = reachClip('lamp-candle', 1.6, CANDLE, { tools: { r: 'candle' }, oneAGo: true, stretch: [[0.8, 1.4]] });

/* L4 lamp-light: the taper struck down across the left palm, lifted to the lantern, the left hand cupped round the flame */
const LIGHT: Mark[] = [
  { t: 0, name: 'taper over the palm', key: true, pose: pose(DOWN(), ELBOWS, CUP('l')), r: [-0.02, 0.7, 0.22], rWay: [0.2, 0.9, 0.3], rKnuckles: [0.6, -0.2, 0.75], l: [0.03, 0.62, 0.21], lWay: CUP_WAY, lKnuckles: CUP_KNUCKLES, toes: 0 },
  { t: 0.18, name: 'struck', key: true, ease: 'in', pose: pose(DOWN(-3), ELBOWS, CUP('l')), r: [-0.045, 0.6, 0.23], rWay: [0.4, 0.9, 0.1], rKnuckles: [0.6, -0.2, 0.75], l: [0.03, 0.62, 0.21], lWay: CUP_WAY, lKnuckles: CUP_KNUCKLES, toes: 0 },
  { t: 0.65, name: 'lifted to the lantern', key: true, pose: pose(UP(), ARMS_UP, CUP('l')), r: [-0.045, 1.03, 0.15], rWay: [0.15, 0.2, 1], rKnuckles: [0, 1, -0.2], l: [0.045, 1.0, 0.2], lWay: [0, 0.2, 1], lKnuckles: [-0.3, 1, 0], toes: UP_TOES },
  { t: 1.4, name: 'held to the wick, shielded', pose: pose(UP(), ARMS_UP, CUP('l')), r: [-0.045, 1.035, 0.15], rWay: [0.15, 0.2, 1], rKnuckles: [0, 1, -0.2], l: [0.045, 1.005, 0.2], lWay: [0, 0.2, 1], lKnuckles: [-0.3, 1, 0], toes: UP_TOES },
];
export const LAMP_LIGHT = reachClip('lamp-light', 1.6, LIGHT, { tools: { r: 'taper' }, oneAGo: true, stretch: [[0.65, 1.4]] });

/* L5 lamp-douse: the right hand up to the lantern, the wick pinched out, the left steadying it */
const DOUSE: Mark[] = [
  { t: 0, name: 'hands down', key: true, pose: pose(DOWN(), ELBOWS, LOOSE('l'), LOOSE('r')), r: [-0.07, 0.62, 0.18], rWay: [0, 1, 0.2], l: [0.07, 0.62, 0.18], lWay: [0, 1, 0.2], toes: 0 },
  { t: 0.45, name: 'up to the lantern', key: true, ease: 'out', pose: pose(UP(), ARMS_UP, OPEN('l'), OPEN('r')), r: LAMP, rWay: [0.3, 1, 0.3], l: LAMP_L, lWay: UP_WAY_L, lKnuckles: KNUCKLES_UP, toes: UP_TOES },
  { t: 0.7, name: 'pinched out', key: true, ease: 'in', pose: pose(UP(), ARMS_UP, OPEN('l'), PINCH('r')), r: [-0.02, 1.035, 0.18], rWay: [0.3, 1, 0.3], l: LAMP_L, lWay: UP_WAY_L, lKnuckles: KNUCKLES_UP, toes: UP_TOES },
  { t: 1.4, name: 'held', pose: pose(UP(), ARMS_UP, OPEN('l'), PINCH('r')), r: [-0.02, 1.035, 0.18], rWay: [0.3, 1, 0.3], l: LAMP_L, lWay: UP_WAY_L, lKnuckles: KNUCKLES_UP, toes: UP_TOES },
];
export const LAMP_DOUSE = reachClip('lamp-douse', 1.6, DOUSE, { oneAGo: true, stretch: [[0.7, 1.4]] });

/** Every clip here, by name (`../index.ts` CLIPS, LEFT_OF: each with its mirror). */
export const REACH_CLIPS: readonly Clip[] = [PICK_HIGH, PICK_GRAPES, TAKE_HONEY, READ_BOOK, READ_TABLET, READ_SHEET, READ_MAP, LAMP_FIT, LAMP_TAKE, LAMP_CANDLE, LAMP_LIGHT, LAMP_DOUSE];
/** Seconds the fade into and out of the crouch at the skep takes: the getting down and up (`../index.ts` SETTLE). */
export const REACH_SETTLE: Record<string, number> = { 'take-honey': 0.45, 'take-honey-left': 0.45 };
