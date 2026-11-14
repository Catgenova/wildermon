/**
 * S1 to S5, sat driving (`../../../render/figure.ts` Seat), each a held pose with breathing: on a cart's or a wagon's box
 * at the reins (`seat-reins`); at a rowing boat's oars, sat on the thwart facing aft (`seat-oars`); at a sailing boat's
 * tiller, the right hand on it and the left on its thigh (`seat-tiller`; on the other side of it, its mirror); astride a
 * mount, the legs down its flanks (`saddle`), and drawn up, the thighs forward along its back and the shins folded back
 * (`saddle-tuck`: a small mount, `Seat.tuck`, blended between the two by how far).
 *
 * The trunk, the legs and where the elbows go are the clip's; the rest is the seat's (`../index.ts` seatedLocal): the hips
 * put down on the seat, the feet on the floor (the knees bent to reach it), the fists on what they hold (`Seat.grip`: the
 * reins, the oars' handles, the tiller's end, where the flat figure's are), and the trunk swayed as the flat figure's is
 * (balanced against a hull's heel, rocked on a cart going).
 */
import type { Clip } from '../clip';
import { mirrorClip, poseToPose, type Beat, type KeyPose } from '../author';
import { axisAngle, euler, mm, type Euler } from '../math';

/**
 * A pair of thighs, left then right: the left turned `rot` (the clip's turns, `euler`: z · x · y) and then
 * swung `out` degrees out about the upright (its own length at rest), the right its mirror. A thigh flexed forward is not
 * spread by its own z, which turns it about its length: the shin swings out and the knee stays in front of the crotch.
 */
function apart(rot: Euler, out: number): { thigh_l: Euler; thigh_r: Euler } {
  const m = mm(axisAngle([0, 1, 0], -out), euler(rot)), deg = 180 / Math.PI;
  const l: Euler = [Math.asin(Math.max(-1, Math.min(1, m[7]))) * deg, Math.atan2(-m[6], m[8]) * deg, Math.atan2(-m[1], m[4]) * deg];
  return { thigh_l: l, thigh_r: [l[0], -l[1], -l[2]] };
}
/**
 * How far the knees are parted sat on a bench or a thwart, each thigh's swing out, degrees: on a seat as low as a cart's
 * box or a thwart the knees come up as high as the hips or higher, and together they hide the lap and the crotch from in front
 * (the camera looks down at a body only some twenty degrees); parted, the crotch shows between them.
 */
export const KNEES_OUT = 25;
/** At the tiller, sat back at ease: the knees parted further, the near shin clear of the crotch from the front quarters. */
export const KNEES_EASED = 35;

/** Seconds a run: one breath's slow wander of the head and the shoulders, as the idle's. */
const LENGTH = 6;

/** The fingers closed on what they hold. */
const FISTS: KeyPose['rot'] = {
  fingers_01_l: [70, 0, 0], fingers_02_l: [80, 0, 0], fingers_01_r: [70, 0, 0], fingers_02_r: [80, 0, 0],
  thumb_02_l: [20, 0, 0], thumb_02_r: [20, 0, 0],
};

/** A held pose with a slow look about: the head turned `look` degrees to its left and back to its right over the run. */
function held(name: string, pose: KeyPose, look: number): { clip: Clip } {
  const turn = (y: number): KeyPose => ({ rot: { ...pose.rot, neck_02: [(pose.rot.neck_02?.[0] ?? 0), y * 0.4, 0], head: [(pose.rot.head?.[0] ?? 0), y * 0.6, 0] }, move: pose.move });
  const beats: Beat[] = [
    { t: 0, pose: turn(0), ease: 'inOut', stage: 'key', name: 'ahead' },
    { t: 1.6, pose: turn(look), ease: 'inOut', name: 'looked left' },
    { t: 2.6, pose: turn(look), ease: 'inOut' },
    { t: 3.6, pose: turn(-look * 0.6), ease: 'inOut', name: 'looked right' },
    { t: 4.5, pose: turn(-look * 0.6), ease: 'inOut' },
  ];
  const keys = poseToPose(beats, { length: LENGTH, loop: true });
  return {
    clip: { name, loop: true, length: LENGTH, mask: 'full', armsFree: true, breath: { count: 2, depth: 0.8 }, tracks: keys.tracks, move: keys.move, poses: keys.poses },
  };
}

/**
 * On the box: sat square on the bench, the thighs along it, the knees parted (`KNEES_OUT`), the shins down to the
 * boards a little ahead of the knees; leant back a touch from the hips, the head up over the team; the forearms out over
 * the knees, the elbows in at the sides.
 */
export const REINS_POSE: KeyPose = {
  rot: {
    ...FISTS,
    pelvis: [-6, 0, 0], spine_01: [4, 0, 0], spine_02: [4, 0, 0], spine_03: [2, 0, 0], neck_01: [2, 0, 0], neck_02: [0, 0, 0], head: [2, 0, 0],
    ...apart([84, 0, 7], KNEES_OUT), calf_l: [-100, 0, 0], calf_r: [-100, 0, 0], foot_l: [10, 0, 0], foot_r: [10, 0, 0],
    upperarm_l: [26, 0, 10], upperarm_r: [26, 0, -10], lowerarm_l: [60, 0, 0], lowerarm_r: [60, 0, 0],
  },
};

/**
 * At the oars: sat low on the thwart, the legs out along the boards to the stretcher and the knees up and parted
 * (`KNEES_OUT`), the back upright and the head up looking over the stern; the arms forward, the elbows down by the ribs.
 */
export const OARS_POSE: KeyPose = {
  rot: {
    ...FISTS,
    pelvis: [-4, 0, 0], spine_01: [3, 0, 0], spine_02: [3, 0, 0], spine_03: [2, 0, 0], neck_01: [2, 0, 0], head: [2, 0, 0],
    ...apart([70, 0, 10], KNEES_OUT), calf_l: [-50, 0, 0], calf_r: [-50, 0, 0], foot_l: [-14, 0, 0], foot_r: [-14, 0, 0],
    upperarm_l: [30, 0, 12], upperarm_r: [30, 0, -12], lowerarm_l: [50, 0, 0], lowerarm_r: [50, 0, 0],
  },
};

/**
 * At the tiller: sat aft on the stern sheets beside it, the thighs along the seat, the knees parted (`KNEES_EASED`) and
 * the shins straight down; the right hand out to it at its side, the left flat on its thigh half way to the knee.
 */
export const TILLER_POSE: KeyPose = {
  rot: {
    pelvis: [-4, 0, 0], spine_01: [4, 0, 0], spine_02: [4, 0, 0], spine_03: [2, 0, 0], neck_01: [2, 0, 0], head: [2, 0, 0],
    ...apart([84, 0, 9], KNEES_EASED), calf_l: [-86, 0, 0], calf_r: [-86, 0, 0],
    upperarm_r: [20, 0, -22], lowerarm_r: [50, 0, 0], fingers_01_r: [70, 0, 0], fingers_02_r: [80, 0, 0], thumb_02_r: [20, 0, 0],
    upperarm_l: [22, 0, 8], lowerarm_l: [48, 0, 0], hand_l: [12, -70, 0], fingers_01_l: [6, 0, 0], fingers_02_l: [8, 0, 0],
  },
};

/** Astride, the legs down the flanks: the thighs forward and out over its barrel, the knees bent, the shins down under them, the heels down. */
export const SADDLE_POSE: KeyPose = {
  rot: {
    ...FISTS,
    pelvis: [-2, 0, 0], spine_01: [4, 0, 0], spine_02: [3, 0, 0], spine_03: [2, 0, 0], neck_01: [2, 0, 0], head: [2, 0, 0],
    thigh_l: [72, 8, 28], thigh_r: [72, -8, -28], calf_l: [-100, 0, 0], calf_r: [-100, 0, 0], foot_l: [22, 0, 0], foot_r: [22, 0, 0],
    upperarm_l: [28, 0, 10], upperarm_r: [28, 0, -10], lowerarm_l: [62, 0, 0], lowerarm_r: [62, 0, 0],
  },
};
/** Astride with the legs drawn up: the thighs forward along its back, the knees high and the shins folded back along its flanks. */
export const TUCK_POSE: KeyPose = {
  rot: {
    ...SADDLE_POSE.rot,
    thigh_l: [92, 6, 32], thigh_r: [92, -6, -32], calf_l: [-140, 0, 0], calf_r: [-140, 0, 0], foot_l: [30, 0, 0], foot_r: [30, 0, 0],
  },
};

const REINS = held('seat-reins', REINS_POSE, 24), OARS = held('seat-oars', OARS_POSE, 30), TILLER = held('seat-tiller', TILLER_POSE, 26);
const SADDLE = held('saddle', SADDLE_POSE, 20), TUCK = held('saddle-tuck', TUCK_POSE, 20);
export const SEAT_REINS: Clip = REINS.clip;
export const SEAT_OARS: Clip = OARS.clip;
export const SEAT_TILLER: Clip = TILLER.clip;
/** At a tiller on the other side: the left hand on it. */
export const SEAT_TILLER_LEFT: Clip = mirrorClip(TILLER.clip, 'seat-tiller-left');
export const SEAT_SADDLE: Clip = SADDLE.clip;
export const SEAT_TUCK: Clip = TUCK.clip;
