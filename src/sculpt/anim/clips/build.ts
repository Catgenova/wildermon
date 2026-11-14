/**
 * Building, lifting and taking apart: the clips of the jobs done to a placed piece, a building's side or a span with the
 * hands or a hammer (`../routes.ts` CLIP_OF_JOB).
 *
 * - `lift`, `lift-heavy` (taking a piece of furniture, a crate, a post, a smelter, a kiln or an anvil up): squatted down
 *   to it from the knees and the hips, the back kept flat and the head up, both palms on its sides; risen on the legs
 *   with it hugged before the chest, the elbows bent (the heavy: a strain at the bottom first, risen slower, carried
 *   lower, leant back over it). One a go.
 * - `set-down`, `set-down-heavy` (putting one down): the reverse, from the hug squatted down to set it on the ground, the
 *   hands let go, risen empty. One a go.
 * - `turn` (turning a piece): half squatted, both hands on its sides, a twist to the right (the right hand forward) with the
 *   chest turned after it, let go and gripped again.
 * - `pry`, `pry-low` (taking a wall, a column, a storey, a floor, a bridge or an aqueduct down): the hammer knocked into
 *   the work, its head kept there and its haft pulled back as a lever with the weight going onto the back foot, the other
 *   hand braced on the wall (`pry`) or on the knee (`pry-low`, squatted at the floor).
 * - `scrape` (taking paint off a wall): the trowel's blade pushed up the wall, drawn back off it, the next stroke beside,
 *   the other hand flat on the wall.
 * - `mark` (marking a side out, no plan): the right hand pointed down at the side ahead, held, let back. One a go.
 * - `pull-stake` (taking a side off the plan): squatted down, the right fist closed low ahead, the stake pulled up as the
 *   legs straighten. One a go.
 * - `work-out` (throwing a bridge across, leading an aqueduct, working on either): the strike at the bench (`./work.ts`)
 *   leant out from the hips over the span, the weight onto the front foot, the chisel held where the mallet's face then
 *   comes down (`OUT_HOLD`: lower and out).
 *
 * The feet stand where the idle stands them (`PLANT`; the pry's and the strike's the left ahead), so the fades in and out
 * keep them put. The hands are put on their places (`Clip.hands`: body heights across (the body's left), up from the
 * ground and forward, in the frame the feet stand in), the rest keyed. The handed clips are played mirrored, left-handed,
 * from the facings the flat figure works left-handed from (`../index.ts` LEFT_OF). Every reach is within the arm's
 * length on both bodies (`supabase/test/buildclips.ts`; her shorter reach brought nearer by her corrections).
 */
import type { Clip, HandReach, Key, Side } from '../clip';
import { merge, mirrorClip, poseToPose, type Beat, type KeyPose } from '../author';
import type { Euler } from '../math';
import { HOLD as CHISEL_AT, WORK } from './work';

/** The feet where the idle stands them (`./idle.ts`). */
const PLANT: NonNullable<Clip['plant']> = { rot: { thigh_l: [0, -3, 6], thigh_r: [0, 3, -6] } };
/** Hers closer together, as the idle stands them. */
const HER_FEET: Record<string, Euler> = { thigh_l: [0, 0, -6], thigh_r: [0, 0, 6] };
/** The left foot ahead, the right back: braced for a pull (as the strike at the bench stands, `./work.ts`). */
const BRACED: NonNullable<Clip['plant']> = { rot: { thigh_l: [9, -4, 6], thigh_r: [-5, 5, -6] } };

/** The fingers curled under what is held (a load's edge), closed on a stake, out flat (a hand braced, pointing). */
const CURL: Record<string, Euler> = { fingers_01_l: [40, 0, 0], fingers_02_l: [50, 0, 0], fingers_01_r: [40, 0, 0], fingers_02_r: [50, 0, 0] };
const FIST_R: Record<string, Euler> = { fingers_01_r: [70, 0, 0], fingers_02_r: [80, 0, 0], thumb_02_r: [20, 0, 0] };
const FLAT_L: Record<string, Euler> = { fingers_01_l: [6, 0, 0], fingers_02_l: [8, 0, 0] };
const FLAT_R: Record<string, Euler> = { fingers_01_r: [6, 0, 0], fingers_02_r: [8, 0, 0] };
const LOOSE: Record<string, Euler> = { fingers_01_l: [14, 0, 0], fingers_02_l: [20, 0, 0], fingers_01_r: [14, 0, 0], fingers_02_r: [20, 0, 0] };

/** The arms keyed before the reach: each elbow out and down, which side the reach keeps it on (`Clip.hands`). */
const ELBOWS: Record<string, Euler> = { upperarm_l: [20, 0, 12], lowerarm_l: [70, 0, 0], upperarm_r: [20, 0, -12], lowerarm_r: [70, 0, 0] };
/** An arm hanging at the side, a little forward. */
const HANG_L: Record<string, Euler> = { upperarm_l: [6, 0, 6], lowerarm_l: [22, 0, 0], hand_l: [0, -40, 0] };

/**
 * A squat: the hips let down between the knees (the knees out over the toes, the heels down), the trunk leant over the
 * thighs from the hips with the back kept flat (the spine turned back against the hips' lean), the head up to look
 * ahead; `deep` 1 at a load's height off the ground.
 */
const squat = (deep: number): KeyPose => ({
  rot: {
    pelvis: [50 * deep, 0, 0], spine_01: [-2 * deep, 0, 0], spine_02: [-3 * deep, 0, 0], spine_03: [-2 * deep, 0, 0],
    neck_01: [-10 * deep, 0, 0], neck_02: [-6 * deep, 0, 0], head: [6, 0, 0],
    thigh_l: [70 * deep, -8 * deep, 16 * deep], thigh_r: [70 * deep, 8 * deep, -16 * deep], calf_l: [-110 * deep, 0, 0], calf_r: [-110 * deep, 0, 0],
  },
  move: [0, -0.26 * deep, 0.02 * deep],
});
/** Stood, the trunk at rest. */
const STOOD: KeyPose = { rot: { pelvis: [0, 0, 0], spine_01: [0, 0, 0], spine_02: [0, 0, 0], spine_03: [0, 0, 0], neck_01: [0, 0, 0], neck_02: [0, 0, 0], head: [0, 0, 0] }, move: [0, 0, 0] };

/** A reached hand at a beat: where its grip is, and (where given) the grip's way and the knuckles' way. */
interface HandAt { at: Euler; way?: Euler; kn?: Euler }
/** A beat of a clip here: a key pose and its reached hands. */
interface HandBeat extends Beat { hands?: Partial<Record<Side, HandAt>> }
const ease = (b: Beat): { ease?: Beat['ease'] } => (b.ease ? { ease: b.ease } : {});
/** A side's reach from the beats that place it, its ways carried on from the last beat that gave them. */
function reachOf(beats: HandBeat[], s: Side, way: Euler): HandReach | undefined {
  const at = beats.filter((b) => b.hands?.[s]);
  if (!at.length) return undefined;
  const keyed = (pick: (h: HandAt) => Euler | undefined, first: Euler | undefined): Array<Key<Euler>> | undefined => {
    if (!at.some((b) => pick(b.hands?.[s] as HandAt))) return undefined;
    let last = first ?? pick(at.find((b) => pick(b.hands?.[s] as HandAt))?.hands?.[s] as HandAt) as Euler;
    return at.map((b) => { last = pick(b.hands?.[s] as HandAt) ?? last; return { t: b.t, v: last, ...ease(b) }; });
  };
  const ways = keyed((h) => h.way, way), knuckles = keyed((h) => h.kn, undefined);
  return { at: at.map((b) => ({ t: b.t, v: (b.hands?.[s] as HandAt).at, ...ease(b) })), way, ...(ways ? { ways } : {}), ...(knuckles ? { knuckles } : {}) };
}
/** A clip from its beats: the hands reached where the beats put them, her feet closer and her reach nearer. */
function buildClip(name: string, length: number, loop: boolean, beats: HandBeat[], way: Partial<Record<Side, Euler>>, o: Partial<Clip> & { lag?: Record<string, number> } = {}): Clip {
  const { lag, ...rest } = o;
  const keys = poseToPose(beats, { length, loop, lag });
  const hands: Partial<Record<Side, HandReach>> = {};
  for (const s of ['l', 'r'] as const) { const h = reachOf(beats, s, way[s] ?? [0, 1, 0]); if (h) hands[s] = h; }
  return {
    name, loop, length, mask: 'full', plant: PLANT, breath: { count: 1, depth: 0.5 }, armsFree: true,
    tracks: keys.tracks, move: keys.move, poses: keys.poses, hands,
    bodies: { woman: { add: HER_FEET } },
    ...rest,
  };
}
/** Her squats let further down (her shins longer for her height stand her hips higher over the same bend), her reach nearer. */
const HER_SQUAT: Clip['bodies'] = { woman: { add: HER_FEET, move: [1, 1.25, 1], hands: { l: [-0.005, 0.03, -0.035], r: [0.005, 0.03, -0.035] } } };

/* ---- L1 lift, L2 set down ---------------------------------------------------------------------------------------- */
/**
 * How a load is lifted, by its weight: how deep the squat, the seconds to the squat, the strain at the bottom and the
 * rise, where it is carried (up, forward), how far leant back under it, the knees left bent under it.
 */
interface Weight { deep: number; down: number; strain: number; rise: number; carry: [number, number]; back: number; soft: number }
const LIGHT: Weight = { deep: 0.9, down: 0.55, strain: 0.15, rise: 0.5, carry: [0.58, 0.19], back: 3, soft: 0.008 };
const HEAVY: Weight = { deep: 1, down: 0.75, strain: 0.55, rise: 0.85, carry: [0.54, 0.15], back: 6, soft: 0.022 };
/** The load's sides where the hands take it, squatted: half its width, up and forward. */
const LOAD: Euler = [0.11, 0.24, 0.3];
/** The hands on the load's sides, the thumbs forward, the backs of the hands out (the palms on it), squatted and hugged. */
const UNDER_L: Euler = [0, 0.25, 1], UNDER_R: Euler = [0, 0.25, 1];
const BACK_L: Euler = [1, -0.4, 0], BACK_R: Euler = [-1, -0.4, 0];
/** The arms at the sides, stood with nothing. */
const SIDE: Euler = [0.165, 0.52, 0.06];
const sides = (y = 0): Partial<Record<Side, HandAt>> => ({ l: { at: [SIDE[0], SIDE[1] + y, SIDE[2]], way: [0.1, 0.1, 1], kn: [1, -0.3, 0] }, r: { at: [-SIDE[0], SIDE[1] + y, SIDE[2]], way: [-0.1, 0.1, 1], kn: [-1, -0.3, 0] } });
const atLoad = (dy = 0): Partial<Record<Side, HandAt>> => ({ l: { at: [LOAD[0], LOAD[1] + dy, LOAD[2]], way: UNDER_L, kn: BACK_L }, r: { at: [-LOAD[0], LOAD[1] + dy, LOAD[2]], way: UNDER_R, kn: BACK_R } });
const hugged = (w: Weight): Partial<Record<Side, HandAt>> => ({ l: { at: [0.1, w.carry[0], w.carry[1]], way: UNDER_L, kn: BACK_L }, r: { at: [-0.1, w.carry[0], w.carry[1]], way: UNDER_R, kn: BACK_R } });
/** Squatted at the load: the hands on its sides. */
const down = (w: Weight): KeyPose => merge(squat(w.deep), { rot: { ...ELBOWS, ...CURL } });
/** The strain: the hips a touch up before the load leaves the ground, the chest lifted, the head up. */
const strained = (w: Weight): KeyPose => merge(down(w), { rot: { pelvis: [50 * w.deep - 2, 0, 0], spine_03: [-4, 0, 0], neck_01: [-12, 0, 0], head: [2, 0, 0] }, move: [0, -0.26 * w.deep + 0.005, 0.02 * w.deep] });
/** Half way up: the knees straightening under it, the back still flat. */
const rising = (w: Weight): KeyPose => merge(squat(w.deep * 0.45), { rot: { ...ELBOWS, ...CURL } });
/** Stood with it hugged: leant back a little under it, the knees soft. */
const carrying = (w: Weight): KeyPose => merge(STOOD, { rot: { ...ELBOWS, ...CURL, pelvis: [-w.back * 0.5, 0, 0], spine_01: [-w.back * 0.2, 0, 0], spine_02: [-w.back * 0.3, 0, 0], neck_01: [w.back * 0.4, 0, 0], head: [4, 0, 0] }, move: [0, -w.soft, -0.004] });
const empty = (): KeyPose => merge(STOOD, { rot: { ...ELBOWS, ...LOOSE } });

function liftBeats(w: Weight): HandBeat[] {
  const t1 = w.down, t2 = t1 + w.strain, t3 = t2 + w.rise * 0.45, t4 = t2 + w.rise;
  return [
    { t: 0, pose: empty(), ease: 'inOut', stage: 'key', name: 'stood', hands: sides() },
    { t: t1, pose: down(w), ease: 'inOut', stage: 'key', name: 'squatted, hands on it', hands: atLoad() },
    { t: t2, pose: strained(w), ease: 'inOut', name: 'strain', hands: atLoad(0.005) },
    { t: t3, pose: rising(w), ease: 'in', name: 'rising', hands: { l: { at: [0.11, 0.43, 0.24], way: UNDER_L, kn: BACK_L }, r: { at: [-0.11, 0.43, 0.24], way: UNDER_R, kn: BACK_R } } },
    { t: t4, pose: carrying(w), ease: 'out', stage: 'key', name: 'hugged', hands: hugged(w) },
    { t: t4 + 0.6, pose: carrying(w), ease: 'linear', name: 'held', hands: hugged(w) },
  ];
}
function setBeats(w: Weight): HandBeat[] {
  const t1 = 0.4, t2 = t1 + w.rise, t3 = t2 + 0.25, t4 = t3 + w.down;
  return [
    { t: 0, pose: carrying(w), ease: 'inOut', stage: 'key', name: 'hugged', hands: hugged(w) },
    { t: t1, pose: carrying(w), ease: 'linear', name: 'held', hands: hugged(w) },
    { t: t1 + w.rise * 0.55, pose: rising(w), ease: 'inOut', name: 'lowering', hands: { l: { at: [0.11, 0.43, 0.24], way: UNDER_L, kn: BACK_L }, r: { at: [-0.11, 0.43, 0.24], way: UNDER_R, kn: BACK_R } } },
    { t: t2, pose: down(w), ease: w === HEAVY ? 'in' : 'out', stage: 'key', name: 'set down', hands: atLoad() },
    { t: t3, pose: merge(down(w), { rot: LOOSE }), ease: 'out', name: 'let go', hands: { l: { at: [LOAD[0] + 0.03, LOAD[1] + 0.03, LOAD[2] - 0.02] }, r: { at: [-LOAD[0] - 0.03, LOAD[1] + 0.03, LOAD[2] - 0.02] } } },
    { t: t4, pose: empty(), ease: 'inOut', stage: 'key', name: 'stood', hands: sides() },
  ];
}
const LIFT_LAG = { neck_02: 0.04, head: 0.07, spine_03: 0.03 };
const liftClip = (name: string, beats: HandBeat[], hold: [number, number], length: number): Clip => buildClip(name, length, true, beats, { l: UNDER_L, r: UNDER_R }, {
  lag: LIFT_LAG, oneAGo: true, stretch: [hold], bodies: HER_SQUAT,
});
const LIFT_B = liftBeats(LIGHT), LIFT_HEAVY_B = liftBeats(HEAVY), SET_B = setBeats(LIGHT), SET_HEAVY_B = setBeats(HEAVY);
const holdOf = (b: HandBeat[], name: string): [number, number] => { const i = b.findIndex((x) => x.name === name); return [b[i - 1].t, b[i].t]; };
/** Seconds a run: the beats' and, for the lift, the arms let down again after the hold. */
export const LIFT = liftClip('lift', LIFT_B, holdOf(LIFT_B, 'held'), LIFT_B[LIFT_B.length - 1].t + 0.45);
export const LIFT_HEAVY = liftClip('lift-heavy', LIFT_HEAVY_B, holdOf(LIFT_HEAVY_B, 'held'), LIFT_HEAVY_B[LIFT_HEAVY_B.length - 1].t + 0.6);
export const SET_DOWN = liftClip('set-down', SET_B, holdOf(SET_B, 'held'), SET_B[SET_B.length - 1].t + 0.45);
export const SET_DOWN_HEAVY = liftClip('set-down-heavy', SET_HEAVY_B, holdOf(SET_HEAVY_B, 'held'), SET_HEAVY_B[SET_HEAVY_B.length - 1].t + 0.6);

/* ---- L3 turn: a grip and a twist --------------------------------------------------------------------------------- */
const TURN_LENGTH = 2;
/** The piece's middle the hands turn about, and half its width. */
const PIECE: Euler = [0, 0.4, 0.27], HALF = 0.13;
/** The hands on its sides turned `deg` about its middle (to the right, seen from above), lifted `dy` off it. */
const turned = (deg: number, dy = 0): Partial<Record<Side, HandAt>> => {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return {
    l: { at: [PIECE[0] + HALF * c, PIECE[1] + dy, PIECE[2] + HALF * s * -1], way: [s, 0.3, c] },
    r: { at: [PIECE[0] - HALF * c, PIECE[1] + dy, PIECE[2] + HALF * s], way: [-s, 0.3, c] },
  };
};
const TURN_BASE: KeyPose = merge(squat(0.5), { rot: { ...ELBOWS, ...CURL } });
const twist = (deg: number): KeyPose => merge(TURN_BASE, { rot: { pelvis: [32, deg * 0.3, 0], spine_02: [-1, deg * 0.25, 0], spine_03: [-1, deg * 0.2, 0], head: [8, -deg * 0.1, 0] }, move: [deg * 0.0005, -0.26 * 0.5, 0.012] });
const TURN_BEATS: HandBeat[] = [
  { t: 0, pose: twist(-12), ease: 'inOut', stage: 'key', name: 'gripped', hands: turned(-12) },
  { t: 0.75, pose: twist(20), ease: 'inOut', stage: 'key', name: 'twisted', hands: turned(20) },
  { t: 0.95, pose: twist(20), ease: 'linear', name: 'held', hands: turned(20) },
  { t: 1.3, pose: merge(twist(6), { rot: LOOSE }), ease: 'out', name: 'let go', hands: turned(10, 0.04) },
];
export const TURN = buildClip('turn', TURN_LENGTH, true, TURN_BEATS, { l: [0, 0.3, 1], r: [0, 0.3, 1] }, {
  lag: { head: 0.06, spine_03: 0.03 }, stretch: [[0.75, 0.95]],
  // her hands kept up off her knees (her squat deeper)
  bodies: { woman: { ...HER_SQUAT?.woman, hands: { l: [-0.005, 0.04, -0.04], r: [0.005, 0.04, -0.04] } } },
});

/* ---- D1 pry, D2 pry low: knocked in and levered back ------------------------------------------------------------- */
/** How long the hammer is from the fist to its head, body heights. */
const HAFT = 0.16;
/** A fist at `head` less the haft along `way`. */
const fistFor = (head: Euler, way: Euler): Euler => { const n = Math.hypot(...way); return [head[0] - (HAFT * way[0]) / n, head[1] - (HAFT * way[1]) / n, head[2] - (HAFT * way[2]) / n]; };
const PRY_LENGTH = 1.8, KNOCK = 0.42;
/** Where the hammer's head goes into the wall, and the left hand braced on it. */
const WALL: Euler = [-0.05, 0.78, 0.27], BRACE: Euler = [0.15, 0.8, 0.26];
const PRY_BASE: KeyPose = { rot: { ...ELBOWS, ...FLAT_L, ...FIST_R, spine_01: [3, -6, 0], spine_02: [3, -4, 0], spine_03: [2, -3, 0], head: [-2, -4, 0] }, move: [0, -0.012, 0.01] };
/** Wound up: the hammer back over the shoulder, the chest turned right after it. */
const PRY_UP: KeyPose = merge(PRY_BASE, { rot: { pelvis: [2, -10, 0], spine_02: [1, -8, 0], spine_03: [0, -6, 0], head: [-4, 0, 0] }, move: [-0.008, -0.01, 0.0] });
/** Knocked in: turned back square, the weight onto the front foot. */
const PRY_HIT: KeyPose = merge(PRY_BASE, { rot: { pelvis: [6, 2, 0], spine_02: [4, 0, 0], spine_03: [3, 0, 0], head: [2, 0, 0] }, move: [0.006, -0.02, 0.02] });
/** Levered back: leant back from the hips, the weight onto the back foot, the knees given. */
const PRY_BACK: KeyPose = merge(PRY_BASE, { rot: { pelvis: [-1, -2, 0], spine_01: [-1, -2, 0], spine_02: [-2, -2, 0], spine_03: [-2, -2, 0], head: [6, 0, 0] }, move: [-0.01, -0.028, -0.008] });
const UP_WAY: Euler = [-0.1, 0.5, -0.85], HIT_WAY: Euler = [0, 0.15, 1], BACK_WAY: Euler = [0, 0.9, 0.45];
const PRY_BEATS: HandBeat[] = [
  { t: 0, pose: PRY_UP, ease: 'inOut', stage: 'key', name: 'wound up', hands: { r: { at: [-0.2, 0.9, 0.08], way: UP_WAY, kn: [0, 0.6, 0.8] }, l: { at: BRACE } } },
  { t: KNOCK, pose: PRY_HIT, ease: 'in', stage: 'key', name: 'knocked in', hands: { r: { at: fistFor(WALL, HIT_WAY), way: HIT_WAY, kn: [0, -0.2, 1] }, l: { at: BRACE } } },
  { t: KNOCK + 0.12, pose: PRY_HIT, ease: 'linear', name: 'hooked', hands: { r: { at: fistFor(WALL, HIT_WAY), way: HIT_WAY, kn: [0, -0.2, 1] }, l: { at: BRACE } } },
  { t: 1.05, pose: PRY_BACK, ease: 'inOut', stage: 'key', name: 'levered back', hands: { r: { at: fistFor(WALL, BACK_WAY), way: BACK_WAY, kn: [0, -0.5, 0.9] }, l: { at: BRACE } } },
  { t: 1.3, pose: PRY_BACK, ease: 'linear', name: 'held', hands: { r: { at: fistFor(WALL, BACK_WAY), way: BACK_WAY, kn: [0, -0.5, 0.9] }, l: { at: BRACE } } },
];
export const PRY = buildClip('pry', PRY_LENGTH, true, PRY_BEATS, { l: [0, 1, 0], r: HIT_WAY }, {
  plant: BRACED, lag: { head: 0.05, neck_02: 0.03 }, tools: { r: 'hammer' }, strike: { side: 'r', t: KNOCK },
  events: [{ t: KNOCK, name: 'impact' }], stretch: [[1.05, 1.3]],
  bodies: { woman: { hands: { l: [-0.01, -0.02, -0.065], r: [0.01, -0.02, -0.065] } } },
});
/** At the floor: where the head goes in ahead, the left hand on the left knee. */
const FLOOR: Euler = [-0.05, 0.02, 0.32], KNEE_ON: Euler = [0.13, 0.21, 0.18];
const LOW_BASE: KeyPose = merge(squat(1), { rot: { ...ELBOWS, ...FLAT_L, ...FIST_R, pelvis: [46, -4, 0], spine_01: [4, -2, 0], spine_02: [6, -2, 0], spine_03: [6, 0, 0], neck_01: [-8, 0, 0], head: [10, 0, 0] } });
const LOW_UP: KeyPose = merge(LOW_BASE, { rot: { spine_02: [2, -8, 0], spine_03: [0, -6, 0] }, move: [-0.006, -0.25, 0.02] });
const LOW_HIT: KeyPose = merge(LOW_BASE, { rot: { spine_02: [9, 0, 0], spine_03: [8, 0, 0] }, move: [0.004, -0.265, 0.03] });
const LOW_BACK: KeyPose = merge(LOW_BASE, { rot: { pelvis: [46, -6, 0], spine_02: [4, -3, 0], spine_03: [3, -2, 0], head: [12, 0, 0] }, move: [-0.006, -0.25, 0.01] });
/** The haft wound up, upright onto the floor (knocked in), and levered back (the fist drawn back and down, the head kept in). */
const LOW_UP_WAY: Euler = [-0.1, 0.8, -0.2], LOW_HIT_WAY: Euler = [0, -0.9, 0.4], LOW_BACK_WAY: Euler = [0, -0.75, 0.65];
const PRY_LOW_BEATS: HandBeat[] = [
  { t: 0, pose: LOW_UP, ease: 'inOut', stage: 'key', name: 'wound up', hands: { r: { at: [-0.14, 0.4, 0.26], way: LOW_UP_WAY, kn: [0, 0.3, 1] }, l: { at: KNEE_ON } } },
  { t: KNOCK, pose: LOW_HIT, ease: 'in', stage: 'key', name: 'knocked in', hands: { r: { at: fistFor(FLOOR, LOW_HIT_WAY), way: LOW_HIT_WAY, kn: [0, -1, -0.3] }, l: { at: KNEE_ON } } },
  { t: KNOCK + 0.12, pose: LOW_HIT, ease: 'linear', name: 'hooked', hands: { r: { at: fistFor(FLOOR, LOW_HIT_WAY), way: LOW_HIT_WAY, kn: [0, -1, -0.3] }, l: { at: KNEE_ON } } },
  { t: 1.05, pose: LOW_BACK, ease: 'inOut', stage: 'key', name: 'levered back', hands: { r: { at: fistFor(FLOOR, LOW_BACK_WAY), way: LOW_BACK_WAY, kn: [0, -1, 0] }, l: { at: KNEE_ON } } },
  { t: 1.3, pose: LOW_BACK, ease: 'linear', name: 'held', hands: { r: { at: fistFor(FLOOR, LOW_BACK_WAY), way: LOW_BACK_WAY, kn: [0, -1, 0] }, l: { at: KNEE_ON } } },
];
export const PRY_LOW = buildClip('pry-low', PRY_LENGTH, true, PRY_LOW_BEATS, { l: [0, 0.2, 1], r: LOW_HIT_WAY }, {
  lag: { head: 0.05, neck_02: 0.03 }, tools: { r: 'hammer' }, strike: { side: 'r', t: KNOCK },
  events: [{ t: KNOCK, name: 'impact' }], stretch: [[1.05, 1.3]], bodies: HER_SQUAT,
});

/* ---- D3 scrape: paint off a wall --------------------------------------------------------------------------------- */
const SCRAPE_LENGTH = 1.6;
/** The two strokes up the wall, the second a hand's width toward the middle: from, to (up), forward. */
const SCRAPE_X = [-0.16, -0.09], SCRAPE_LOW = 0.6, SCRAPE_TOP = 0.82, SCRAPE_Z = 0.26;
/** The blade leant into the wall, its edge up. */
const BLADE: Euler = [0, 0.55, 0.85];
const SCRAPE_LOW_P: KeyPose = { rot: { ...ELBOWS, ...FLAT_L, ...FIST_R, pelvis: [6, -6, 0], spine_02: [4, -2, 0], spine_03: [3, -2, 0], head: [6, -4, 0] }, move: [0, -0.018, 0.02] };
const SCRAPE_TOP_P: KeyPose = merge(SCRAPE_LOW_P, { rot: { pelvis: [3, -6, 0], spine_02: [1, -2, 0], spine_03: [0, -2, 0], head: [-8, -6, 0] }, move: [0, -0.002, 0.03] });
const SCRAPE_ON: Euler = [0.14, 0.74, 0.33];
const scrapeAt = (k: number, top: boolean, off = 0): Partial<Record<Side, HandAt>> => ({ r: { at: [SCRAPE_X[k], top ? SCRAPE_TOP : SCRAPE_LOW, SCRAPE_Z - off], way: BLADE, kn: [0, -0.8, 0.5] }, l: { at: SCRAPE_ON } });
const SCRAPE_BEATS: HandBeat[] = [
  { t: 0, pose: SCRAPE_LOW_P, ease: 'inOut', stage: 'key', name: 'low, first stroke', hands: scrapeAt(0, false) },
  { t: 0.45, pose: SCRAPE_TOP_P, ease: 'in', stage: 'key', name: 'scraped up', hands: scrapeAt(0, true) },
  { t: 0.8, pose: SCRAPE_LOW_P, ease: 'inOut', name: 'drawn back down', hands: scrapeAt(1, false, 0.04) },
  { t: 0.85, pose: SCRAPE_LOW_P, ease: 'out', stage: 'key', name: 'low, second stroke', hands: scrapeAt(1, false) },
  { t: 1.3, pose: SCRAPE_TOP_P, ease: 'in', name: 'scraped up', hands: scrapeAt(1, true) },
  { t: 1.55, pose: SCRAPE_LOW_P, ease: 'inOut', name: 'drawn back across', hands: scrapeAt(0, false, 0.04) },
];
export const SCRAPE = buildClip('scrape', SCRAPE_LENGTH, true, SCRAPE_BEATS, { l: [0, 1, 0], r: BLADE }, {
  plant: BRACED, lag: { head: 0.06 }, tools: { r: 'trowel' },
  bodies: { woman: { hands: { l: [-0.01, -0.01, -0.075], r: [0.01, -0.01, -0.075] } } },
});

/* ---- M1 mark, M2 pull a stake ------------------------------------------------------------------------------------- */
const MARK_LENGTH = 1.2;
/** The right hand pointed down at the side ahead, the fingers out. */
const POINTED: KeyPose = merge(STOOD, { rot: { ...ELBOWS, ...HANG_L, ...FLAT_R, ...LOOSE, fingers_01_r: [4, 0, 0], fingers_02_r: [4, 0, 0], pelvis: [8, -4, 0], spine_02: [3, -4, 0], neck_01: [6, -4, 0], head: [12, -6, 0] }, move: [0, -0.01, 0.018] });
const MARK_BEATS: HandBeat[] = [
  { t: 0, pose: empty(), ease: 'inOut', stage: 'key', name: 'stood', hands: { r: { at: [-SIDE[0], SIDE[1], SIDE[2]], way: [-0.1, 0.1, 1], kn: [0, -1, 0.2] }, l: { at: SIDE } } },
  { t: 0.35, pose: POINTED, ease: 'out', stage: 'key', name: 'pointed', hands: { r: { at: [-0.12, 0.6, 0.29], way: [-0.2, 0.9, 0.1], kn: [0, -0.5, 1] }, l: { at: SIDE } } },
  { t: 0.8, pose: POINTED, ease: 'linear', name: 'held', hands: { r: { at: [-0.12, 0.595, 0.295], way: [-0.2, 0.9, 0.1], kn: [0, -0.5, 1] }, l: { at: SIDE } } },
];
export const MARK = buildClip('mark', MARK_LENGTH, true, MARK_BEATS, { l: [0.1, 0.1, 1], r: [0, 1, 0] }, {
  lag: { head: 0.06 }, oneAGo: true,
  // her arms shorter for her height: the hand pointed nearer
  bodies: { woman: { add: HER_FEET, hands: { l: [0, 0.01, 0], r: [0, 0.035, -0.06] } } }, stretch: [[0.35, 0.8]] });

const STAKE_LENGTH = 2;
const STAKE: Euler = [-0.06, 0.22, 0.24];
const STAKE_DOWN: KeyPose = merge(squat(0.9), { rot: { ...ELBOWS, ...FIST_R, ...LOOSE, fingers_01_r: [70, 0, 0], fingers_02_r: [80, 0, 0], pelvis: [42, -6, 0], spine_02: [2, -4, 0], head: [10, -4, 0] } });
const STAKE_TUG: KeyPose = merge(STAKE_DOWN, { rot: { pelvis: [36, -6, 0], spine_03: [-4, -2, 0], neck_01: [-10, 0, 0] }, move: [0, -0.26 * 0.9 + 0.02, 0.018] });
const STAKE_UP: KeyPose = merge(squat(0.15), { rot: { ...ELBOWS, ...FIST_R, ...LOOSE, fingers_01_r: [70, 0, 0], fingers_02_r: [80, 0, 0], spine_02: [-2, -4, 0], head: [6, -4, 0] } });
const KNEE: Euler = [0.12, 0.24, 0.17];
const STAKE_BEATS: HandBeat[] = [
  { t: 0, pose: empty(), ease: 'inOut', stage: 'key', name: 'stood', hands: { r: { at: [-SIDE[0], SIDE[1], SIDE[2]], way: [-0.1, 0.1, 1] }, l: { at: SIDE } } },
  { t: 0.6, pose: STAKE_DOWN, ease: 'inOut', stage: 'key', name: 'squatted, stake in hand', hands: { r: { at: STAKE, way: [0, 1, 0.1] }, l: { at: KNEE } } },
  { t: 0.8, pose: STAKE_TUG, ease: 'inOut', name: 'tug', hands: { r: { at: [STAKE[0], STAKE[1] + 0.045, STAKE[2]], way: [0, 1, 0.1] }, l: { at: KNEE } } },
  { t: 1.25, pose: STAKE_UP, ease: 'out', stage: 'key', name: 'pulled up', hands: { r: { at: [-0.1, 0.5, 0.2], way: [0, 1, 0.1] }, l: { at: [0.15, 0.48, 0.1] } } },
  { t: 1.6, pose: STAKE_UP, ease: 'linear', name: 'held', hands: { r: { at: [-0.1, 0.505, 0.2], way: [0, 1, 0.1] }, l: { at: [0.15, 0.48, 0.1] } } },
];
export const PULL_STAKE = buildClip('pull-stake', STAKE_LENGTH, true, STAKE_BEATS, { l: [0, 0, 1], r: [0, 1, 0] }, { lag: { head: 0.06, spine_03: 0.03 }, oneAGo: true, stretch: [[1.25, 1.6]], bodies: HER_SQUAT });

/* ---- W2 work-out: the strike leant out over a span ----------------------------------------------------------------- */
/**
 * The strike at the bench leant further out from the hips over the span (added to every beat: degrees on the hips and
 * the spine, the shift: further over the front foot, the knees given), and where the chisel is then held: where the
 * mallet's face comes down to with the lean (`tools/sculpt/lowbuildsolve.mjs`), body heights, his and hers.
 */
const LEAN: Record<string, Euler> = { pelvis: [10, 0, 0], spine_01: [3, 0, 0], spine_02: [2, 0, 0], neck_01: [-6, 0, 0], neck_02: [-4, 0, 0] };
const LEAN_MOVE: Euler = [0, -0.03, 0.025];
/** Further down through the wind-up (the rise to the strike, seconds), the knees given: the left fist kept on the chisel as the chest rises. */
const RISEN: [number, number] = [0.2, 0.68], RISEN_DOWN = -0.016;
export const OUT_HOLD: Euler = [0.108, 0.439, 0.288];
export const OUT_HOLD_WOMAN: Euler = [0.001, 0.024, -0.008];
const addKeys = (keys: Array<Key<Euler>>, d: Euler): Array<Key<Euler>> => keys.map((k) => ({ ...k, v: [k.v[0] + d[0], k.v[1] + d[1], k.v[2] + d[2]] }));
const SHIFT: Euler = [OUT_HOLD[0] - CHISEL_AT[0], OUT_HOLD[1] - CHISEL_AT[1], OUT_HOLD[2] - CHISEL_AT[2]];
export const WORK_OUT: Clip = {
  ...WORK,
  name: 'work-out',
  tracks: { ...WORK.tracks, ...Object.fromEntries(Object.entries(LEAN).map(([b, d]) => [b, addKeys(WORK.tracks[b] ?? [{ t: 0, v: [0, 0, 0] }], d)])) },
  move: addKeys(WORK.move ?? [{ t: 0, v: [0, 0, 0] }], LEAN_MOVE).map((k) => (k.t > RISEN[0] && k.t < RISEN[1] ? { ...k, v: [k.v[0], k.v[1] + RISEN_DOWN, k.v[2]] } : k)),
  hands: { ...WORK.hands, l: { ...(WORK.hands?.l as HandReach), at: addKeys((WORK.hands?.l as HandReach).at, SHIFT) } },
  bodies: { ...WORK.bodies, woman: { ...WORK.bodies?.woman, hands: { l: [(WORK.bodies?.woman?.hands?.l ?? [0, 0, 0])[0] + OUT_HOLD_WOMAN[0], (WORK.bodies?.woman?.hands?.l ?? [0, 0, 0])[1] + OUT_HOLD_WOMAN[1], (WORK.bodies?.woman?.hands?.l ?? [0, 0, 0])[2] + OUT_HOLD_WOMAN[2]] } } },
};

/** The clips here played left-handed from the facings the flat figure works left-handed from: the one-handed ones. */
const HANDED = [TURN, PRY, PRY_LOW, SCRAPE, MARK, PULL_STAKE, WORK_OUT];
/** Every clip here and the handed ones' mirrors, by name (`../index.ts` CLIPS, LEFT_OF). */
export const BUILD_CLIPS: Record<string, Clip> = Object.fromEntries([
  ...[LIFT, LIFT_HEAVY, SET_DOWN, SET_DOWN_HEAVY].map((c) => [c.name, c]),
  ...HANDED.flatMap((c) => [[c.name, c], [`${c.name}-left`, mirrorClip(c, `${c.name}-left`)]]),
]);
export const BUILD_LEFT: Record<string, string> = Object.fromEntries(HANDED.map((c) => [c.name, `${c.name}-left`]));
/** Seconds the fade into and out of the clips squatted throughout takes: down into the squat and up (`../index.ts` SETTLE). */
export const BUILD_SETTLE: Record<string, number> = { 'pry-low': 0.45, 'pry-low-left': 0.45, turn: 0.35, 'turn-left': 0.35 };
