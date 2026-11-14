/**
 * The emotes after the wave, the hop and the 6 7 (`../../../game/emotes.ts`), each played once over its own length, its
 * time the emote's (`FigurePose.emoteT`, `../index.ts` clipFor), stood as the idle stands at both ends so it fades in
 * from the idle and out to it without a jump:
 * - E4, the bow (`BOW`): the right hand to the chest, bowed from the hips, held, up, the hand down;
 * - E5, the cheer (`CHEER`): a dip, both arms thrown up in fists, pumped twice on the knees' bounce, down;
 * - E6, the point (`POINT`): the right arm out straight ahead where the body faces, the trunk and head turned after it,
 *   held with a jab, lowered; with the left (its mirror) from the facings `pointsLeft` says;
 * - E7, the clap (`CLAP`): the hands up before the chest, four claps a `CLAP_EVERY` apart, down; one clap a run of `CLAP_LOOP`;
 * - E8, sat on the ground (`SIT`, a loop): got down onto it by its own way (`SIT_DOWN`, `../down.ts`), sat with the knees
 *   up and the hands on the ground behind, a slow breath and a look round a run; held until the body moves.
 */
import type { Clip, HandReach, Key } from '../clip';
import { merge, mirror, mirrorClip, poseToPose, type Beat, type KeyPose } from '../author';
import type { Euler } from '../math';
import { downInto, type Down } from '../down';
import { EMOTE_BY_ID } from '../../../game/emotes';

/** Seconds from one clap to the next, in the clap emote. */
const CLAP_EVERY = 0.3;
/**
 * The facings the point is made with the left arm (its mirror, `point-left`) from: those where the right arm, out ahead and a
 * little to its side, would point straight at the viewer or straight away (three-quarters on).
 */
const POINT_LEFT: readonly number[] = [1, 5];
/** Whether a point at `facing` is made with the left arm (`POINT_LEFT`). */
const pointsLeft = (facing: number): boolean => POINT_LEFT.includes(((Math.round(facing) % 8) + 8) % 8);

/** Seconds each emote runs: the game's. */
const secs = (id: string, or: number): number => EMOTE_BY_ID.get(id)?.seconds ?? or;
/** Stood as the idle stands: feet a little apart and turned out, flat; hers closer together (`./idle.ts`). */
const STANCE: Record<string, Euler> = { thigh_l: [0, -3, 6], thigh_r: [0, 3, -6] };
const PLANT: Clip['plant'] = { rot: STANCE };
const HER_STANCE: Record<string, Euler> = { thigh_l: [0, 0, -6], thigh_r: [0, 0, 6] };
/** The arms hanging, the hands loose (the idle's), each a little out from the side (`./emote.ts` HANG). */
const HANG: Record<string, Euler> = {
  upperarm_l: [-2, 0, 7], upperarm_r: [-2, 0, -7],
  lowerarm_l: [12, 0, 0], lowerarm_r: [12, 0, 0],
  hand_l: [0, -50, 0], hand_r: [0, 50, 0],
  fingers_01_l: [12, 0, 0], fingers_01_r: [12, 0, 0],
  fingers_02_l: [18, 0, 0], fingers_02_r: [18, 0, 0],
  thumb_01_l: [0, 0, 0], thumb_01_r: [0, 0, 0],
  clavicle_l: [0, 0, 0], clavicle_r: [0, 0, 0],
};
/** The trunk upright, the head level. */
const UPRIGHT: Record<string, Euler> = {
  pelvis: [0, 0, 0], spine_01: [0, 0, 0], spine_02: [0, 0, 0], spine_03: [0, 0, 0], neck_01: [0, 0, 0], neck_02: [0, 0, 0], head: [0, 0, 0],
};
const STOOD: KeyPose = { rot: { ...UPRIGHT, ...STANCE, ...HANG }, move: [0, 0, 0] };
/** A pose stood, these bones changed. */
const stood = (rot: Record<string, Euler>, move?: Euler): KeyPose => merge(STOOD, { rot, move: move ?? [0, 0, 0] });

/* ---- E4, the bow ------------------------------------------------------------------------------------------------- */

const BOW_LENGTH = secs('bow', 2.2);
/** The right hand flat on the chest, over the heart, solved on him: the elbow down and forward, the fingers to the left. */
const HEART: Record<string, Euler> = {
  clavicle_r: [0, 0, 0], upperarm_r: [35.2, -56.7, 10.1], lowerarm_r: [112.5, 1, -10.5], hand_r: [9.2, 126.5, -7.5],
  fingers_01_r: [4, 0, 0], fingers_02_r: [4, 0, 0], thumb_01_r: [0, 0, 0],
};
/** Bowed from the hips, the legs kept straight under them (the thighs back as far as the pelvis tips), the head in line with the back. */
const BENT: Record<string, Euler> = {
  pelvis: [24, 0, 0], spine_01: [7, 0, 0], spine_02: [7, 0, 0], spine_03: [5, 0, 0], neck_01: [3, 0, 0], neck_02: [3, 0, 0], head: [5, 0, 0],
  thigh_l: [-24, -3, 6], thigh_r: [-24, 3, -6],
  // the free arm kept at the side as the trunk goes down
  upperarm_l: [4, 0, 6],
};
const BOW_BEATS: Beat[] = [
  { t: 0, pose: STOOD, ease: 'inOut', name: 'stood' },
  { t: 0.42, pose: stood(HEART), ease: 'inOut', stage: 'key', name: 'hand to chest' },
  { t: 0.95, pose: stood({ ...HEART, ...BENT }, [0, 0, -0.008]), ease: 'inOut', stage: 'key', name: 'bowed' },
  { t: 1.4, pose: stood({ ...HEART, ...BENT, pelvis: [27, 0, 0], thigh_l: [-27, -3, 6], thigh_r: [-27, 3, -6] }, [0, 0, -0.01]), ease: 'inOut', name: 'held' },
  { t: 1.85, pose: stood(HEART), ease: 'inOut', stage: 'key', name: 'up' },
  { t: BOW_LENGTH, pose: STOOD, ease: 'inOut', name: 'stood' },
];
export const BOW: Clip = {
  name: 'bow', loop: false, length: BOW_LENGTH, mask: 'full', plant: PLANT, armsFree: true,
  ...poseToPose(BOW_BEATS, { length: BOW_LENGTH, loop: false, lag: { head: 0.05, neck_01: 0.03, upperarm_l: 0.06, lowerarm_l: 0.08 } }),
  bodies: { woman: { add: HER_STANCE } },
};

/* ---- E5, the cheer ----------------------------------------------------------------------------------------------- */

const CHEER_LENGTH = secs('cheer', 1.8);
/** Fists. */
const FISTS: Record<string, Euler> = {
  fingers_01_l: [80, 0, 0], fingers_01_r: [80, 0, 0], fingers_02_l: [90, 0, 0], fingers_02_r: [90, 0, 0], thumb_01_l: [20, 0, -20], thumb_01_r: [20, 0, 20],
};
/** Both arms thrown up and out, a little ahead, the elbows nearly straight, the fists closed; the head up. */
const ARMS_UP: Record<string, Euler> = {
  ...FISTS,
  clavicle_l: [0, 0, 10], clavicle_r: [0, 0, -10],
  upperarm_l: [-6, -90, 135], upperarm_r: [-6, 90, -135], lowerarm_l: [14, 0, 0], lowerarm_r: [14, 0, 0], hand_l: [0, -20, 0], hand_r: [0, 20, 0],
  spine_02: [-3, 0, 0], spine_03: [-4, 0, 0], neck_01: [-6, 0, 0], head: [-8, 0, 0],
};
/** Pumped: the elbows bent, the fists brought down beside the head. */
const PUMPED: Record<string, Euler> = {
  ...ARMS_UP,
  upperarm_l: [-6, -90, 100], upperarm_r: [-6, 90, -100], lowerarm_l: [95, 0, 0], lowerarm_r: [95, 0, 0],
  head: [-4, 0, 0],
};
/** The dip before: the knees bent, the arms back. */
const DIP: Record<string, Euler> = { ...FISTS, upperarm_l: [-25, 0, 10], upperarm_r: [-25, 0, -10], lowerarm_l: [25, 0, 0], lowerarm_r: [25, 0, 0], spine_02: [5, 0, 0], head: [4, 0, 0] };
const KNEES = (d: number): Euler => [0, -d, 0];
const CHEER_BEATS: Beat[] = [
  { t: 0, pose: STOOD, ease: 'inOut', name: 'stood' },
  { t: 0.22, pose: stood(DIP, KNEES(0.035)), ease: 'inOut', name: 'dipped' },
  { t: 0.42, pose: stood(ARMS_UP, [0, 0.004, 0]), ease: 'back', back: 0.12, stage: 'key', name: 'arms up' },
  { t: 0.68, pose: stood(PUMPED, KNEES(0.022)), ease: 'inOut', name: 'pumped' },
  { t: 0.88, pose: stood(ARMS_UP, [0, 0.002, 0]), ease: 'back', back: 0.1, stage: 'key', name: 'up' },
  { t: 1.12, pose: stood(PUMPED, KNEES(0.02)), ease: 'inOut', name: 'pumped' },
  { t: 1.32, pose: stood(ARMS_UP), ease: 'back', back: 0.1, name: 'up' },
  { t: CHEER_LENGTH, pose: STOOD, ease: 'inOut', name: 'stood' },
];
export const CHEER: Clip = {
  name: 'cheer', loop: false, length: CHEER_LENGTH, mask: 'full', plant: PLANT, armsFree: true,
  ...poseToPose(CHEER_BEATS, { length: CHEER_LENGTH, loop: false, lag: { lowerarm_l: 0.03, lowerarm_r: 0.03, head: 0.05 } }),
  bodies: { woman: { add: HER_STANCE } },
};

/* ---- E6, the point ----------------------------------------------------------------------------------------------- */

const POINT_LENGTH = secs('point', 2.2);
/**
 * The right arm out straight ahead at the shoulder's height, a little out from the body so it reads from in front, the
 * hand flat in line with it, the thumb in; the trunk turned a little after it, the head along it.
 */
const POINTED: Record<string, Euler> = {
  clavicle_r: [0, 0, -4], upperarm_r: [59.8, 60.1, -91.5], lowerarm_r: [3, 0, 0], hand_r: [3.8, 41.4, 2.4],
  fingers_01_r: [0, 0, 0], fingers_02_r: [0, 0, 0], thumb_01_r: [10, 0, 20],
  spine_02: [0, -4, 0], spine_03: [1, -6, 0], neck_01: [0, -4, 0], head: [-2, -6, 0],
  upperarm_l: [-4, 0, 8],
};
/** The jab in the hold: the arm pushed out a little further, the head after it. */
const JAB: Record<string, Euler> = { ...POINTED, clavicle_r: [-6, 0, -4], spine_03: [3, -8, 0], head: [0, -6, 0] };
const POINT_BEATS: Beat[] = [
  { t: 0, pose: STOOD, ease: 'inOut', name: 'stood' },
  { t: 0.45, pose: stood(POINTED, [0, 0, 0.006]), ease: 'back', back: 0.1, stage: 'key', name: 'pointed' },
  { t: 0.8, pose: stood(JAB, [0, 0, 0.012]), ease: 'out', name: 'jab' },
  { t: 1.05, pose: stood(POINTED, [0, 0, 0.006]), ease: 'inOut', name: 'held' },
  { t: 1.6, pose: stood(POINTED, [0, 0, 0.006]), ease: 'inOut', name: 'held' },
  { t: POINT_LENGTH, pose: STOOD, ease: 'inOut', name: 'stood' },
];
export const POINT: Clip = {
  name: 'point', loop: false, length: POINT_LENGTH, mask: 'full', plant: PLANT, armsFree: true,
  ...poseToPose(POINT_BEATS, { length: POINT_LENGTH, loop: false, lag: { hand_r: 0.03, head: 0.06, spine_03: 0.03 } }),
  bodies: { woman: { add: HER_STANCE } },
};

/* ---- E7, the clap ------------------------------------------------------------------------------------------------ */

const CLAP_LENGTH = secs('clap', 2.0);
/**
 * The right hand before the chest, solved on him: together, its wrist a hand's breadth in from the middle at the
 * chest's height and an arm's length ahead, the palm to the left; apart, a forearm's breadth out.
 */
const TOGETHER: Record<string, Euler> = { upperarm_r: [54.7, -57.3, 19.5], lowerarm_r: [79.2, -2, -7.7], hand_r: [4.1, 84.9, 53.1] };
const APART: Record<string, Euler> = { upperarm_r: [35.9, -11, -27.3], lowerarm_r: [107.7, 1.2, -10.8], hand_r: [16.5, 88.1, 52.2] };
const FLAT: Record<string, Euler> = { fingers_01_r: [0, 0, 0], fingers_02_r: [0, 0, 0], thumb_01_r: [0, 0, 0] };
const both = (r: Record<string, Euler>, rest: Record<string, Euler> = {}): KeyPose => merge(STOOD, { rot: { ...rest } }, { rot: r }, mirror({ rot: r }), { rot: rest });
const CLAP_TRUNK: Record<string, Euler> = { spine_02: [2, 0, 0], neck_01: [2, 0, 0], head: [3, 0, 0] };
const IN = both({ ...TOGETHER, ...FLAT }, CLAP_TRUNK), OUT = both({ ...APART, ...FLAT }, CLAP_TRUNK);
/** The claps' times: the hands together at each. */
const CLAPS = [0.42, 0.42 + CLAP_EVERY, 0.42 + 2 * CLAP_EVERY, 0.42 + 3 * CLAP_EVERY];
const CLAP_BEATS: Beat[] = [
  { t: 0, pose: STOOD, ease: 'inOut', name: 'stood' },
  { t: 0.28, pose: OUT, ease: 'inOut', stage: 'key', name: 'hands up' },
  ...CLAPS.flatMap((t, i): Beat[] => [
    { t, pose: IN, ease: 'in', stage: 'key', name: 'clap' },
    ...(i < CLAPS.length - 1 ? [{ t: t + CLAP_EVERY / 2, pose: OUT, ease: 'out' as const, name: 'apart' }] : []),
  ]),
  { t: CLAPS[CLAPS.length - 1] + 0.12, pose: IN, ease: 'inOut', name: 'held' },
  { t: CLAP_LENGTH, pose: STOOD, ease: 'inOut', name: 'stood' },
];
/** Her hands brought in to meet: each upper arm turned in further while the hands are up (her shoulders narrower for her height). */
const HER_IN: Euler = [4, -6, 0];
const herIn = (keys: Array<[number, number]>): Record<string, Array<Key<Euler>>> => {
  const k = (s: number): Array<Key<Euler>> => keys.map(([t, w]) => ({ t, v: [HER_IN[0] * w, s * HER_IN[1] * w, s * HER_IN[2] * w] as Euler, ease: 'inOut' as const }));
  return { upperarm_r: k(1), upperarm_l: k(-1) };
};
export const CLAP: Clip = {
  name: 'clap', loop: false, length: CLAP_LENGTH, mask: 'full', plant: PLANT, armsFree: true,
  ...poseToPose(CLAP_BEATS, { length: CLAP_LENGTH, loop: false }),
  bodies: { woman: { add: HER_STANCE, tracks: herIn([[0, 0], [0.28, 1], [CLAPS[CLAPS.length - 1] + 0.12, 1], [CLAP_LENGTH, 0]]) } },
};
/** Clapping on and on: one clap a run, from the same two poses. */
export const CLAP_LOOP: Clip = {
  name: 'clap-loop', loop: true, length: CLAP_EVERY, mask: 'full', plant: PLANT, armsFree: true,
  ...poseToPose([{ t: 0, pose: IN, ease: 'in', stage: 'key', name: 'clap' }, { t: CLAP_EVERY / 2, pose: OUT, ease: 'out', name: 'apart' }], { length: CLAP_EVERY, loop: true }),
  bodies: { woman: { add: HER_STANCE, tracks: herIn([[0, 1]]) } },
};

/* ---- E8, sat on the ground --------------------------------------------------------------------------------------- */

/** One run sat: a slow breath, and a look round to the left and back. */
const SIT_RUN = 6;
/** Crouched over the feet on the way down: the hips let down and back, the trunk over the knees, the arms ahead (`./rest.ts`'s). */
const CROUCH: KeyPose = {
  rot: {
    ...HANG,
    pelvis: [30, 0, 0], spine_01: [8, 0, 0], spine_02: [8, 0, 0], spine_03: [6, 0, 0], neck_01: [-14, 0, 0], neck_02: [-6, 0, 0], head: [0, 0, 0],
    thigh_l: [95, -3, 12], thigh_r: [95, 3, -12], calf_l: [-130, 0, 0], calf_r: [-130, 0, 0],
    upperarm_l: [55, 0, 14], upperarm_r: [55, 0, -14], lowerarm_l: [40, 0, 0], lowerarm_r: [40, 0, 0], hand_l: [0, -40, 0], hand_r: [0, 40, 0],
  },
  move: [0, -0.3, -0.1],
};
/** Sat on the ground behind the feet, the knees up, leant back onto the hands on the ground behind the hips. */
const SAT: KeyPose = {
  rot: {
    ...HANG,
    pelvis: [-24, 0, 0], spine_01: [6, 0, 0], spine_02: [6, 0, 0], spine_03: [4, 0, 0], neck_01: [5, 0, 0], neck_02: [3, 0, 0], head: [7, 0, 0],
    thigh_l: [100, -12, 26], thigh_r: [100, 12, -26], calf_l: [-100, 0, -6], calf_r: [-100, 0, 6], foot_l: [10, 0, -8], foot_r: [10, 0, 8],
    upperarm_l: [-30, 0, 18], upperarm_r: [-30, 0, -18], lowerarm_l: [6, 0, 0], lowerarm_r: [6, 0, 0], hand_l: [0, -60, 0], hand_r: [0, 60, 0],
    fingers_01_l: [4, 0, 0], fingers_01_r: [4, 0, 0], fingers_02_l: [6, 0, 0], fingers_02_r: [6, 0, 0],
  },
  move: [0, -0.41, -0.24],
};
/** The hands' places sat: on the ground behind the hips and out from them, his, body heights across, up and forward. */
const BEHIND: Euler = [0.17, 0.012, -0.42];
const behind = (keys: Array<[number, number]>): Partial<Record<'l' | 'r', HandReach>> => {
  const k = (s: number): Array<Key<Euler>> => keys.map(([t, dz]) => ({ t, v: [s * BEHIND[0], BEHIND[1], BEHIND[2] + dz] as Euler, ease: 'inOut' as const }));
  return { l: { at: k(1), way: [0, 0, 1] }, r: { at: k(-1), way: [0, 0, 1] } };
};
const SIT_BEATS: Beat[] = [{ t: 0, pose: SAT, ease: 'inOut', stage: 'key', name: 'sat' }];
export const SIT: Clip = {
  name: 'sit', loop: true, length: SIT_RUN, mask: 'full',
  ...poseToPose(SIT_BEATS, { length: SIT_RUN, loop: true }),
  breath: { count: 1, depth: 1.4 },
  armsFree: true,
  // the look round: to the left, held, back
  accents: {
    neck_01: [{ t: 0, v: [0, 0, 0] }, { t: 2.2, v: [0, 0, 0] }, { t: 2.7, v: [0, 22, 0], ease: 'inOut' }, { t: 3.9, v: [0, 22, 0] }, { t: 4.5, v: [0, 0, 0], ease: 'inOut' }],
    head: [{ t: 0, v: [0, 0, 0] }, { t: 2.25, v: [0, 0, 0] }, { t: 2.75, v: [-2, 10, 0], ease: 'inOut' }, { t: 3.95, v: [-2, 10, 0] }, { t: 4.55, v: [0, 0, 0], ease: 'inOut' }],
  },
  hands: behind([[0, 0]]),
  bodies: { woman: { move: [1, 1.22, 1] } },
};
const SIT_DOWN_BEATS: Beat[] = [
  { t: 0, pose: STOOD, ease: 'inOut', name: 'stood' },
  { t: 0.55, pose: CROUCH, ease: 'inOut', name: 'crouched' },
  { t: 1.0, pose: merge(SAT, { rot: { pelvis: [-8, 0, 0], upperarm_l: [10, 0, 18], upperarm_r: [10, 0, -18] }, move: [0, -0.41, -0.22] }), ease: 'inOut', name: 'sat' },
  { t: 1.4, pose: SAT, ease: 'inOut', name: 'leant back' },
];
/** The way down: stood, crouched over the feet, sat down behind them, leant back onto the hands. */
export const SIT_DOWN: Down = {
  name: 'sit-down', loop: false, length: 1.4, mask: 'full', armsFree: true,
  ...poseToPose(SIT_DOWN_BEATS, { length: 1.4, loop: false }),
  plant: PLANT,
  planted: [{ t: 0, v: 1 }, { t: 1.0, v: 1 }, { t: 1.3, v: 0.6 }],
  bodies: { woman: { move: [1, 1.22, 1] } },
};

downInto('sit', SIT_DOWN);

/** These clips by name, for `../index.ts` CLIPS. */
export const EMOTES2: Record<string, Clip> = {
  bow: BOW, cheer: CHEER, point: POINT, 'point-left': mirrorClip(POINT, 'point-left'), clap: CLAP, 'clap-loop': CLAP_LOOP, sit: SIT, 'sit-down': SIT_DOWN,
};
/** The clip each of these emotes plays at `facing`, by the emote's id (`../index.ts` emoteClipOf): the point with the left arm where it says (`pointsLeft`). */
export function emote2Clip(id: string, facing: number): string | undefined {
  if (id === 'point') return pointsLeft(facing) ? 'point-left' : 'point';
  return id === 'bow' || id === 'cheer' || id === 'clap' || id === 'sit' ? id : undefined;
}
