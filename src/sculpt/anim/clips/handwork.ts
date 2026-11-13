/**
 * Handwork with a small tool in one fist and the work in the other, both fists reached to places in the world
 * (`Clip.hands`: body heights across (the body's left), up from the ground and forward, in the frame the feet stand in),
 * the trunk, the head and the elbows' sides keyed. The jobs each plays are routed in `../routes.ts` (`CLIP_OF_TOOL`,
 * `CLIP_OF_JOB`); each is played mirrored, left-handed, from the facings the flat figure works left-handed from
 * (`../index.ts` LEFT_OF). The props are tools/sculpt/gear/handwork.mjs's; the thread and the laid rope are tethers
 * between the two fists' props (`../../lowpoly.ts` PropAsset.tether), so they stretch as the hands part.
 *
 * - N1 `sew`: stood bowed over a piece of cloth held flat in the left fist at the belt, the needle in the right: the
 *   needle's point taken above the cloth, drawn up and out to the right at arm's length (the thread drawn taut from
 *   the cloth), held, brought back over and pushed down into the cloth for the next stitch.
 * - B1 `brush-wall`: stood square to a wall, the left foot ahead, the brush upright in the right fist, its bristles to
 *   the wall: a stroke down from head height to the chest and back up, then the next stroke beside it.
 * - B2 `brush-floor`: knelt as at the ground (`./ground.ts` KNELT), the left fist planted, the brush along the ground in
 *   the right: scrubbed forward and drawn back, twice, the second beside the first.
 * - B3 `brush-item`, `brush-cloth`: stood bowed as at the bench, the work held up in the left fist (a pot by its foot,
 *   or a piece of cloth), the brush stroked up and down its near side.
 * - R1 `rope`: stood, the strands in the left fist out to the left, the rope tool in the right: its crank turned two
 *   rounds (the twist), then the left hand run in along the laid rope toward the hook and drawn back out.
 */
import type { Clip, HandReach, Key } from '../clip';
import { merge, poseToPose, type Beat, type KeyPose } from '../author';
import type { Euler } from '../math';
import { KNELT, TOES } from './ground';

/** A track of places (or ways) keyed at times, each reached as its key says (`inOut` where not given). */
const keys = (pts: Array<[number, Euler, Key<Euler>['ease']?]>): Array<Key<Euler>> => pts.map(([t, v, ease]) => ({ t, v, ...(ease ? { ease } : {}) }));
/** A hand reached along places and ways keyed at times. */
const reach = (at: Array<[number, Euler, Key<Euler>['ease']?]>, ways: Array<[number, Euler, Key<Euler>['ease']?]>): HandReach => ({ at: keys(at), way: ways.length > 1 ? keys(ways) : ways[0][1] });
/** A place held still. */
const still = (at: Euler, way: Euler): HandReach => ({ at: [{ t: 0, v: at }], way });
const add3 = (a: Euler, b: Euler): Euler => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** Stood as the idle stands (the fade in and out of it keeps the feet put), feet a little apart and turned out. */
const STOOD = { rot: { thigh_l: [0, -3, 6] as Euler, thigh_r: [0, 3, -6] as Euler } };
/** Her feet closer together, as the idle stands them. */
const HER_FEET: Record<string, Euler> = { thigh_l: [0, 0, -6], thigh_r: [0, 0, 6] };
/** The fingers of an empty hand loosely closed. */
const LOOSE = (s: 'l' | 'r'): Record<string, Euler> => ({ [`fingers_01_${s}`]: [14, 0, 0], [`fingers_02_${s}`]: [20, 0, 0] });

/* ---- N1, sewing ------------------------------------------------------------------------------------------------------ */
const SEW_LENGTH = 2.4;
/** The beats, seconds: the point taken, the draw's end, the taut hold let go, coming back over, aimed, pushed in, the fist turned to take the point. */
const SEW_T = { take: 0, drawn: 0.8, taut: 1.15, over: 1.55, aim: 1.82, push: 2.02, turn: 2.24 };
/** The left fist on the cloth's corner (the cloth spread to the right of it and ahead), palm down. */
const CLOTH: Euler = [0.085, 0.61, 0.27];
const CLOTH_WAY: Euler = [-1, 0.12, 0.12];
/** The right fist: the needle's point taken over the stitch, the draw's end up and out to the right, back over the cloth, pushed in. */
const NEEDLE_AT: Record<keyof typeof SEW_T, Euler> = {
  take: [0, 0.665, 0.31], drawn: [-0.235, 0.84, 0.23], taut: [-0.245, 0.855, 0.22], over: [-0.08, 0.72, 0.35], aim: [-0.02, 0.68, 0.35], push: [-0.01, 0.65, 0.325], turn: [-0.01, 0.655, 0.325],
};
/** The needle's way (its point's): up out of the cloth, along the draw, turned over and down into it (kept across the forearm, a quarter turn at most a beat). */
const NEEDLE_WAY: Record<keyof typeof SEW_T, Euler> = {
  take: [-0.3, 0.9, 0.15], drawn: [-0.6, 0.75, 0], taut: [-0.6, 0.75, 0], over: [-0.95, 0.1, 0.2], aim: [-0.3, -0.92, 0.15], push: [-0.25, -0.95, 0.1], turn: [-0.9, 0.3, 0.2],
};
/** The trunk, head and elbows' sides at each beat: bowed over the cloth; the chest turned and opened after the draw, the head after the needle. */
const SEW_POSE: Record<keyof typeof SEW_T, KeyPose> = {
  take: {
    rot: {
      pelvis: [5, 0, 0], spine_01: [5, 0, 0], spine_02: [6, 0, 0], spine_03: [5, 0, 0], neck_01: [4, 0, 0], neck_02: [3, 0, 0], head: [16, -4, 0],
      upperarm_r: [30, -30, -15], lowerarm_r: [100, 0, 0], upperarm_l: [20, 15, 30], lowerarm_l: [100, 0, 0],
    },
    move: [0, -0.004, 0],
  },
  drawn: {
    rot: {
      pelvis: [3, -4, 0], spine_01: [3, -4, 0], spine_02: [3, -6, -2], spine_03: [2, -6, -2], neck_01: [2, -4, 0], neck_02: [1, -4, 0], head: [6, -14, -4],
      upperarm_r: [30, 60, -75], lowerarm_r: [50, 0, 0], upperarm_l: [20, 15, 30], lowerarm_l: [100, 0, 0],
    },
    move: [0.006, 0, -0.002],
  },
  taut: {
    rot: {
      pelvis: [3, -5, 0], spine_01: [3, -5, 0], spine_02: [3, -7, -2], spine_03: [2, -7, -2], neck_01: [2, -4, 0], neck_02: [1, -4, 0], head: [7, -15, -4],
      upperarm_r: [30, 60, -75], lowerarm_r: [48, 0, 0], upperarm_l: [20, 15, 30], lowerarm_l: [100, 0, 0],
    },
    move: [0.007, 0, -0.002],
  },
  over: {
    rot: {
      pelvis: [5, -1, 0], spine_01: [5, -1, 0], spine_02: [6, -2, 0], spine_03: [5, -2, 0], neck_01: [4, 0, 0], neck_02: [3, 0, 0], head: [13, -6, 0],
      upperarm_r: [40, 0, -30], lowerarm_r: [90, 0, 0], upperarm_l: [20, 15, 30], lowerarm_l: [100, 0, 0],
    },
    move: [0.002, -0.004, 0.002],
  },
  aim: {
    rot: {
      pelvis: [6, 0, 0], spine_01: [6, 0, 0], spine_02: [7, 0, 0], spine_03: [6, 0, 0], neck_01: [4, 0, 0], neck_02: [3, 0, 0], head: [17, -3, 0],
      upperarm_r: [35, -25, -20], lowerarm_r: [100, 0, 0], upperarm_l: [20, 15, 30], lowerarm_l: [100, 0, 0],
    },
    move: [0, -0.006, 0.003],
  },
  push: {
    rot: {
      pelvis: [6, 0, 0], spine_01: [6, 0, 0], spine_02: [8, 0, 0], spine_03: [6, 0, 0], neck_01: [4, 0, 0], neck_02: [3, 0, 0], head: [18, -3, 0],
      upperarm_r: [32, -30, -18], lowerarm_r: [105, 0, 0], upperarm_l: [20, 15, 30], lowerarm_l: [100, 0, 0],
    },
    move: [0, -0.008, 0.003],
  },
  turn: {
    rot: {
      pelvis: [6, 0, 0], spine_01: [6, 0, 0], spine_02: [8, 0, 0], spine_03: [6, 0, 0], neck_01: [4, 0, 0], neck_02: [3, 0, 0], head: [17, -4, 0],
      upperarm_r: [32, -30, -18], lowerarm_r: [105, 0, 0], upperarm_l: [20, 15, 30], lowerarm_l: [100, 0, 0],
    },
    move: [0, -0.008, 0.003],
  },
};
/** The cloth lifted a little to meet the push and let down a little as the thread is drawn taut. */
const CLOTH_SHIFT: Record<keyof typeof SEW_T, Euler> = { take: [0, 0, 0], drawn: [0.004, -0.008, 0], taut: [0.004, -0.01, 0], over: [0, 0, 0], aim: [0, 0.004, 0.004], push: [0, 0.008, 0.004], turn: [0, 0.006, 0.002] };
/** How each beat is reached: the draw fast away and slowing as the thread tightens; the push pressed in. */
const SEW_EASE: Record<keyof typeof SEW_T, Beat['ease']> = { take: 'inOut', drawn: 'out', taut: 'inOut', over: 'inOut', aim: 'inOut', push: 'in', turn: 'inOut' };
const SEW_ORDER = Object.keys(SEW_T) as Array<keyof typeof SEW_T>;
export const SEW_BEATS: Beat[] = SEW_ORDER.map((k) => ({ t: SEW_T[k], pose: merge({ rot: { ...LOOSE('l'), ...LOOSE('r') } }, SEW_POSE[k]), ease: SEW_EASE[k], stage: 'key', name: k }));
/** The head and neck trailing the chest. */
const LAG = { neck_02: 0.03, head: 0.06 };
const SEW_KEYS = poseToPose(SEW_BEATS, { length: SEW_LENGTH, loop: true, lag: LAG });

export const SEW: Clip = {
  name: 'sew',
  loop: true,
  length: SEW_LENGTH,
  mask: 'full',
  plant: STOOD,
  breath: { count: 1, depth: 0.5 },
  ...SEW_KEYS,
  armsFree: true,
  hands: {
    l: reach(SEW_ORDER.map((k) => [SEW_T[k], add3(CLOTH, CLOTH_SHIFT[k]), SEW_EASE[k]]), [[0, CLOTH_WAY]]),
    r: reach(SEW_ORDER.map((k) => [SEW_T[k], NEEDLE_AT[k], SEW_EASE[k]]), SEW_ORDER.map((k) => [SEW_T[k], NEEDLE_WAY[k], SEW_EASE[k]])),
  },
  tools: { r: 'needle', l: 'cloth_piece' },
  // a job's go fitted to its length by the taut hold
  stretch: [[SEW_T.drawn, SEW_T.taut]],
  bodies: {
    // her arms shorter for her height: the work nearer
    woman: { add: HER_FEET, hands: { l: [-0.01, 0.02, -0.02], r: [0.01, 0.02, -0.02] } },
  },
};

/* ---- B1, brushing a wall ----------------------------------------------------------------------------------------------- */
const WALL_LENGTH = 1.8;
/** The two strokes: each from the top down and back up, the second a hand's width toward the middle. */
const WALL_X = [-0.17, -0.1], WALL_TOP = 0.87, WALL_LOW = 0.66, WALL_Z = 0.3;
/** The brush upright, a little toward the wall at the top and away from it at the foot (the bristles kept on it). */
const WALL_WAY_TOP: Euler = [0.1, 0.95, 0.3], WALL_WAY_LOW: Euler = [0.05, 0.95, -0.1];
/** The trunk at the top of a stroke (stretched up, the head raised to the brush) and at its foot (the knees given, bent in to it). */
const WALL_UP: KeyPose = {
  rot: {
    pelvis: [5, -8, 0], spine_01: [4, -3, 0], spine_02: [3, -3, 0], spine_03: [2, -2, 0], neck_01: [-3, -2, 0], neck_02: [-3, -2, 0], head: [-8, -6, 0],
    upperarm_r: [60, 20, -70], lowerarm_r: [70, 0, 0], upperarm_l: [-4, 0, 12], lowerarm_l: [28, 0, 0], ...LOOSE('l'),
  },
  move: [0, 0.002, 0.03],
};
const WALL_DOWN: KeyPose = {
  rot: {
    pelvis: [7, -8, 0], spine_01: [5, -3, 0], spine_02: [5, -3, 0], spine_03: [4, -2, 0], neck_01: [2, -2, 0], neck_02: [1, -2, 0], head: [8, -4, 0],
    upperarm_r: [35, 0, -60], lowerarm_r: [95, 0, 0], upperarm_l: [-2, 0, 12], lowerarm_l: [32, 0, 0], ...LOOSE('l'),
  },
  move: [0, -0.008, 0.034],
};
/** Seconds: each stroke's top, its foot, back at its top; then the move across to the next. */
const WALL_T = [0, 0.38, 0.78, 0.9, 1.28, 1.68];
const wallBeat = (t: number, down: boolean, name: string): Beat => ({ t, pose: down ? WALL_DOWN : WALL_UP, ease: 'inOut', stage: 'key', name });
export const WALL_BEATS: Beat[] = [
  wallBeat(WALL_T[0], false, 'top, first stroke'), wallBeat(WALL_T[1], true, 'down'), wallBeat(WALL_T[2], false, 'up'),
  wallBeat(WALL_T[3], false, 'top, second stroke'), wallBeat(WALL_T[4], true, 'down'), wallBeat(WALL_T[5], false, 'up'),
];
const WALL_KEYS = poseToPose(WALL_BEATS, { length: WALL_LENGTH, loop: true, lag: LAG });
const wallAt = (x: number, top: boolean, dz = 0): Euler => [x, top ? WALL_TOP : WALL_LOW, WALL_Z + dz];

export const BRUSH_WALL: Clip = {
  name: 'brush-wall',
  loop: true,
  length: WALL_LENGTH,
  mask: 'full',
  // planted, the left foot ahead toward the wall, the right back
  plant: { rot: { thigh_l: [7, -4, 6], thigh_r: [-4, 5, -6] } },
  breath: { count: 1, depth: 0.5 },
  ...WALL_KEYS,
  armsFree: true,
  hands: {
    r: reach(
      [[WALL_T[0], wallAt(WALL_X[0], true)], [WALL_T[1], wallAt(WALL_X[0], false, 0.01)], [WALL_T[2], wallAt(WALL_X[0], true)],
        [WALL_T[3], wallAt(WALL_X[1], true)], [WALL_T[4], wallAt(WALL_X[1], false, 0.01)], [WALL_T[5], wallAt(WALL_X[1], true)]],
      [[WALL_T[0], WALL_WAY_TOP], [WALL_T[1], WALL_WAY_LOW], [WALL_T[2], WALL_WAY_TOP], [WALL_T[3], WALL_WAY_TOP], [WALL_T[4], WALL_WAY_LOW], [WALL_T[5], WALL_WAY_TOP]],
    ),
  },
  tools: { r: 'brush' },
  stretch: [[WALL_T[5], WALL_LENGTH], [WALL_T[2], WALL_T[3]]],
  bodies: {
    woman: { add: HER_FEET, hands: { r: [0.01, -0.03, -0.015] } },
  },
};

/* ---- B2, scrubbing a floor --------------------------------------------------------------------------------------------- */
const FLOOR_LENGTH = 1.4;
/** The brush's two scrubs, out to the right of the body: forward from beside the knees and drawn back, the second a little to the left. */
const FLOOR_T = { back: 0, fore: 0.32, drawn: 0.7, fore2: 1.02 };
const FLOOR_AT = { back: [-0.15, 0.075, 0.43] as Euler, fore: [-0.13, 0.07, 0.6] as Euler, back2: [-0.12, 0.075, 0.43] as Euler, fore2: [-0.1, 0.07, 0.6] as Euler };
/** The brush along the ground, its head ahead and a little to the left, the bristles down. */
const FLOOR_WAY: Euler = [0.25, -0.3, 0.92];
/** The left fist planted beside it, on its knuckles. */
const FLOOR_LEFT: Euler = [0.13, 0.07, 0.48];
/** Knelt (`KNELT`), the shoulders rolled down after the brush and forward with it as it scrubs, the head after it. */
const kneltAt = (yaw: number, lean: number): KeyPose => merge(KNELT, {
  rot: {
    spine_02: [11 + lean, yaw, 0], spine_03: [9 + lean, yaw, 0], head: [14, -6 + yaw, 0],
    upperarm_r: [15, -5, -30], lowerarm_r: [40, 0, 0], upperarm_l: [15, 10, 20], lowerarm_l: [40, 0, 0],
  },
});
export const FLOOR_BEATS: Beat[] = [
  { t: FLOOR_T.back, pose: kneltAt(2, 0), ease: 'inOut', stage: 'key', name: 'drawn back' },
  { t: FLOOR_T.fore, pose: kneltAt(4, 4), ease: 'inOut', stage: 'key', name: 'scrubbed forward' },
  { t: FLOOR_T.drawn, pose: kneltAt(2, 0), ease: 'inOut', stage: 'key', name: 'drawn back, beside' },
  { t: FLOOR_T.fore2, pose: kneltAt(5, 4), ease: 'inOut', stage: 'key', name: 'scrubbed forward, beside' },
];
const { footKeys: FLOOR_FEET, ...FLOOR_KEYS } = poseToPose(FLOOR_BEATS, { length: FLOOR_LENGTH, loop: true, lag: LAG });

export const BRUSH_FLOOR: Clip = {
  name: 'brush-floor',
  loop: true,
  length: FLOOR_LENGTH,
  mask: 'full',
  // the feet where the idle stands them (so the fade in and out of it keeps them put), rolled up onto the toes, as the ground's
  plant: STOOD,
  feet: { stride: 1, ...(FLOOR_FEET as NonNullable<typeof FLOOR_FEET>) },
  breath: { count: 1, depth: 0.5 },
  ...FLOOR_KEYS,
  armsFree: true,
  hands: {
    r: reach([[FLOOR_T.back, FLOOR_AT.back], [FLOOR_T.fore, FLOOR_AT.fore], [FLOOR_T.drawn, FLOOR_AT.back2], [FLOOR_T.fore2, FLOOR_AT.fore2]], [[0, FLOOR_WAY]]),
    l: still(FLOOR_LEFT, [-0.2, 0.1, 0.97]),
  },
  tools: { r: 'brush' },
  bodies: {
    // her shins longer for her height: further down and forward to put her knees on the ground (as the ground's); her feet
    // closer together; her hips higher, so bowed further at them, and her work nearer
    woman: { add: { ...HER_FEET, pelvis: [11, 0, 0], spine_02: [3, 0, 0], clavicle_l: [8, 0, 0], clavicle_r: [8, 0, 0], neck_01: [-20, 0, 0], neck_02: [-6, 0, 0] }, move: [1, 1.2421, 1.3066], hands: { l: [0, 0, 0.02], r: [0, 0, 0.02] } },
  },
};
void TOES;

/* ---- B3, brushing the work held in the other hand --------------------------------------------------------------------- */
const ITEM_LENGTH = 1.2;
/** The left fist holding the work up (the pot by its foot, upright; the cloth by its corner), the brush's fist at the stroke's top and foot. */
const ITEM_LEFT: Euler = [0.075, 0.61, 0.25];
const ITEM_LEFT_WAY: Euler = [-0.25, 0.95, 0.15];
const ITEM_TOP: Euler = [-0.017, 0.612, 0.255], ITEM_LOW: Euler = [-0.012, 0.552, 0.26];
/** The brush upright beside the work, its bristles looking across to it. */
const ITEM_WAY: Euler = [0.15, 0.97, 0.1];
const ITEM_T = [0, 0.3, 0.6, 0.9];
const ITEM_POSE = (lean: number, yaw: number): KeyPose => ({
  rot: {
    pelvis: [4, 0, 0], spine_01: [4, 0, 0], spine_02: [5 + lean, yaw, 0], spine_03: [4 + lean, yaw, 0], neck_01: [3, 0, 0], neck_02: [2, 0, 0], head: [16, 6, 0],
    upperarm_r: [35, -30, -40], lowerarm_r: [100, 0, 0], upperarm_l: [20, 15, 30], lowerarm_l: [100, 0, 0], ...LOOSE('r'), ...LOOSE('l'),
  },
  move: [0, -0.004 - lean * 0.002, 0],
});
export const ITEM_BEATS: Beat[] = [
  { t: ITEM_T[0], pose: ITEM_POSE(0, 2), ease: 'inOut', stage: 'key', name: 'top' },
  { t: ITEM_T[1], pose: ITEM_POSE(1.5, 4), ease: 'inOut', stage: 'key', name: 'stroked down' },
  { t: ITEM_T[2], pose: ITEM_POSE(0, 2), ease: 'inOut', stage: 'key', name: 'top' },
  { t: ITEM_T[3], pose: ITEM_POSE(1.5, 4), ease: 'inOut', stage: 'key', name: 'stroked down' },
];
const ITEM_KEYS = poseToPose(ITEM_BEATS, { length: ITEM_LENGTH, loop: true, lag: LAG });

export const BRUSH_ITEM: Clip = {
  name: 'brush-item',
  loop: true,
  length: ITEM_LENGTH,
  mask: 'full',
  plant: STOOD,
  breath: { count: 1, depth: 0.5 },
  ...ITEM_KEYS,
  armsFree: true,
  hands: {
    // the work turned a little between the strokes
    l: reach([[0, ITEM_LEFT], [ITEM_T[1], add3(ITEM_LEFT, [0, 0.004, 0])], [ITEM_T[2], ITEM_LEFT], [ITEM_T[3], add3(ITEM_LEFT, [0, 0.004, 0])]], [[0, ITEM_LEFT_WAY], [ITEM_T[1], [-0.3, 0.95, 0.05]], [ITEM_T[2], ITEM_LEFT_WAY], [ITEM_T[3], [-0.3, 0.95, 0.05]]]),
    r: reach([[ITEM_T[0], ITEM_TOP], [ITEM_T[1], ITEM_LOW], [ITEM_T[2], add3(ITEM_TOP, [-0.004, 0, 0.012])], [ITEM_T[3], add3(ITEM_LOW, [-0.004, 0, 0.012])]], [[0, ITEM_WAY]]),
  },
  tools: { r: 'brush', l: 'work_pot' },
  bodies: {
    woman: { add: HER_FEET, hands: { l: [0, 0.045, -0.05], r: [-0.008, 0.045, -0.05] } },
  },
};
/** The same with a piece of cloth in the left fist: dye scrubbed off. */
export const BRUSH_CLOTH: Clip = { ...BRUSH_ITEM, name: 'brush-cloth', tools: { r: 'brush', l: 'cloth_piece' } };

/* ---- R1, laying up a rope ----------------------------------------------------------------------------------------------- */
const ROPE_LENGTH = 2.4;
/** The twist: the crank's two rounds, seconds; then the run in along the rope and back out. */
const TWIST = 1.2, RUN_IN = 1.65, RUN_OUT = 2.15;
/** The right fist's round: its middle, its radius, across the rope's way (up and forward). */
const CRANK: Euler = [-0.11, 0.63, 0.26], CRANK_R = 0.034;
/** The left fist out to the left with the strands, pointing them at the hook; run in toward it. */
const STRANDS: Euler = [0.2, 0.64, 0.27], STRANDS_IN: Euler = [0.1, 0.66, 0.29], STRANDS_OUT: Euler = [0.22, 0.635, 0.275];
const STRANDS_WAY: Euler = [-1, 0.08, -0.1];
/** The crank's round, keyed every eighth of a turn at an even rate, from its top. */
const round = (): Array<[number, Euler, Key<Euler>['ease']]> => {
  const out: Array<[number, Euler, Key<Euler>['ease']]> = [], n = 16;
  for (let k = 0; k <= n; k++) {
    const a = (k / 8) * 2 * Math.PI;
    out.push([(k / n) * TWIST, [CRANK[0], CRANK[1] + CRANK_R * Math.cos(a), CRANK[2] + CRANK_R * Math.sin(a)], k === 0 ? 'inOut' : 'linear']);
  }
  return out;
};
const ROPE_POSE = (yaw: number, bow: number): KeyPose => ({
  rot: {
    pelvis: [3, 0, 0], spine_01: [3, yaw * 0.3, 0], spine_02: [4 + bow, yaw * 0.4, 0], spine_03: [3 + bow, yaw * 0.3, 0], neck_01: [3, 0, 0], neck_02: [2, 0, 0], head: [12, yaw * 2, 0],
    upperarm_r: [30, -25, -45], lowerarm_r: [95, 0, 0], upperarm_l: [25, 20, 45], lowerarm_l: [70, 0, 0],
  },
  move: [0, -0.004, 0],
});
export const ROPE_BEATS: Beat[] = [
  { t: 0, pose: ROPE_POSE(-2, 0), ease: 'inOut', stage: 'key', name: 'twist' },
  { t: TWIST, pose: ROPE_POSE(-2, 0), ease: 'inOut', stage: 'key', name: 'twisted' },
  { t: RUN_IN, pose: ROPE_POSE(4, 2), ease: 'inOut', stage: 'key', name: 'run in' },
  { t: RUN_OUT, pose: ROPE_POSE(2, 0), ease: 'out', stage: 'key', name: 'drawn out' },
];
const ROPE_KEYS = poseToPose(ROPE_BEATS, { length: ROPE_LENGTH, loop: true, lag: LAG });

export const ROPE: Clip = {
  name: 'rope',
  loop: true,
  length: ROPE_LENGTH,
  mask: 'full',
  plant: STOOD,
  breath: { count: 1, depth: 0.5 },
  ...ROPE_KEYS,
  armsFree: true,
  hands: {
    r: reach(round(), [[0, [0.05, 1, 0.1]]]),
    l: reach([[0, STRANDS], [TWIST, STRANDS], [RUN_IN, STRANDS_IN], [RUN_OUT, STRANDS_OUT, 'out']], [[0, STRANDS_WAY]]),
  },
  tools: { r: 'rope_tool', l: 'rope_strands' },
  stretch: [[RUN_OUT, ROPE_LENGTH]],
  bodies: {
    woman: { add: HER_FEET, hands: { l: [-0.02, 0.02, -0.03], r: [0.01, 0.02, -0.03] } },
  },
};
