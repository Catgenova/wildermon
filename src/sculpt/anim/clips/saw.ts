/**
 * W2, sawing: a log on a sawhorse at thigh height ahead, the left palm laid flat on its top and pressing it down (the
 * sawhorse drawn under that palm, `Clip.tools`: tools/sculpt/gear/sawfish.mjs), the saw in the right fist cutting it on
 * its overhang to the right of the palm: long strokes forward and down along the blade and back, the blade's teeth kept
 * in the kerf. The clip of every job done with a saw (`../routes.ts` CLIP_OF_TOOL): sawing logs into planks and timbers.
 *
 * Feet planted, the left ahead; bowed over the log from the hips, the knees given, the head down on the cut. The push
 * (the cut) leans the trunk in behind the fist, the shoulders turned a little after it; the pull draws the elbow back
 * past the ribs, the trunk let back. The right fist is reached along the stroke (`Clip.hands`), the blade's way and the
 * knuckles' kept to it, so the teeth run along one line through the kerf; the left palm kept where it is on the log.
 * Played mirrored, left-handed, from the facings the flat figure works left-handed from (`../index.ts` lefty), the
 * sawhorse then under the right palm (`sawhorse_r`, its mirror).
 */
import type { Clip, Key } from '../clip';
import { mirrorClip, poseToPose, type Beat, type KeyPose } from '../author';
import type { Euler } from '../math';

/** One stroke forward and back, seconds. */
const LENGTH = 1.1;
/** The push's end: the most of the blade through the cut. */
export const PUSHED = 0.62;
const RAD = Math.PI / 180;

/** The log's top under the left palm (its middle, body heights: across, up, forward), the man's. */
export const PALM: Euler = [0.03, 0.42, 0.335];
/** The sawhorse's kerf: the cut, game units from the palm along the log toward the body's right (tools/sculpt/gear/sawfish.mjs SAWHORSE.cut). */
const CUT = 3.6;
/** The man's height and hers in game units (src/sculpt/lowpoly.ts: the man 16.5, she 0.85 of him). */
const MAN = 16.5, WOMAN = 16.5 * 0.85;
/** The log's top in game units over the ground (SAWHORSE.ground): her palm put as high in the game's units as his. */
const LOG_TOP = PALM[1] * MAN;
/** The stroke: the blade's way down from level, degrees; how far down from the fist the teeth run (game units, the saw's own SAW.lead to its teeth). */
const DOWN = 18, TEETH = 0.85;
/** How deep the kerf is cut, game units down from the log's top (the log 2.3 through). */
const KERF = 0.8;
/** The blade's reach from the fist to the kerf at the stroke's ends, game units along the blade (the blade from 1.0 to 7.4). */
const REACH: [number, number] = [2.2, 6.0];

/** The blade's way (the knuckles') and the grip's (the thumb's), straight ahead and down. */
const BLADE: Euler = [0, -Math.sin(DOWN * RAD), Math.cos(DOWN * RAD)];
const GRIP: Euler = [0, Math.cos(DOWN * RAD), Math.sin(DOWN * RAD)];
/** The right fist for a body (its height in game units), `s` game units of blade from it to the kerf. */
const fistAt = (height: number, palm: Euler, s: number): Euler => {
  const k: Euler = [palm[0] - CUT / height, palm[1] - KERF / height, palm[2]], d = TEETH / height, u = s / height;
  return [k[0], k[1] + d * GRIP[1] - u * BLADE[1], k[2] + d * GRIP[2] - u * BLADE[2]];
};
/** Her palm: on the same log, as high over the ground in the game's units. */
const HER_PALM: Euler = [PALM[0] + 0.04, LOG_TOP / WOMAN, 0.29];

/** The trunk and stance pulled back (the stroke's start) and pushed in (its end), the arms' turns only where their elbows go. */
const POSE: Record<string, KeyPose> = {
  pulled: {
    rot: {
      pelvis: [25, -6, 0], spine_01: [8, -3, 0], spine_02: [8, -3, 0], spine_03: [6, -4, 0],
      neck_01: [-14, 3, 0], neck_02: [-4, 2, 0], head: [16, 4, 0],
      clavicle_l: [6, 0, 0], clavicle_r: [-4, 0, -4],
      upperarm_r: [-20, 20, -30], lowerarm_r: [95, 0, 0], upperarm_l: [10, 0, 35], lowerarm_l: [40, 0, 0],
    },
    move: [-0.012, -0.05, -0.01],
  },
  pushed: {
    rot: {
      pelvis: [29, -2, 0], spine_01: [9, 1, 0], spine_02: [9, 1, 0], spine_03: [7, 0, 0],
      neck_01: [-15, 0, 0], neck_02: [-4, 0, 0], head: [17, 1, 0],
      clavicle_l: [6, 0, 0], clavicle_r: [8, 0, 2],
      upperarm_r: [30, 10, -30], lowerarm_r: [60, 0, 0], upperarm_l: [10, 0, 35], lowerarm_l: [40, 0, 0],
    },
    move: [0.004, -0.062, 0.018],
  },
};
/** The beats: pulled back, pushed through, drawn back. */
const beats = (): Beat[] => [
  { t: 0, pose: POSE.pulled, ease: 'inOut', stage: 'key', name: 'pulled back' },
  { t: PUSHED, pose: POSE.pushed, ease: 'inOut', stage: 'key', name: 'pushed through' },
];
export const BEATS: Beat[] = beats();
/** The trunk after the arm, the head after the trunk: seconds each bone's keys are late. */
export const LAG = { pelvis: 0.04, spine_01: 0.05, spine_02: 0.06, spine_03: 0.07, neck_01: 0.08, neck_02: 0.09, head: 0.1 };
const KEYS = poseToPose(BEATS, { length: LENGTH, loop: true, lag: LAG });

/** The right fist over a stroke for a body: back at the start, through at the push, back. */
const stroke = (height: number, palm: Euler): Array<Key<Euler>> => [
  { t: 0, v: fistAt(height, palm, REACH[1]), ease: 'inOut' },
  { t: PUSHED, v: fistAt(height, palm, REACH[0]), ease: 'inOut' },
];
const HIS = stroke(MAN, PALM), HERS = stroke(WOMAN, HER_PALM);
/**
 * Her fist's place less his (her hand correction is one place for the whole stroke: her stroke, as long in the game's
 * units, is a little longer in hers, which only runs the teeth a little further along their own line).
 */
const HER_FIST: Euler = [0, 1, 2].map((k) => (HERS[0].v[k] + HERS[1].v[k] - HIS[0].v[k] - HIS[1].v[k]) / 2) as Euler;

export const SAW: Clip = {
  name: 'saw',
  loop: true,
  length: LENGTH,
  mask: 'full',
  // planted, the left foot ahead toward the sawhorse, the right back
  plant: { rot: { thigh_l: [10, -4, 6], thigh_r: [-8, 5, -6] } },
  breath: { count: 1, depth: 0.5 },
  ...KEYS,
  armsFree: true,
  hands: {
    r: { at: HIS, way: GRIP, knuckles: [{ t: 0, v: BLADE }] },
    // the palm flat on the log's top: the fingers ahead over it, the thumb toward the cut
    l: { at: [{ t: 0, v: PALM }], way: [-1, 0, 0], knuckles: [{ t: 0, v: [0, 0, 1] }] },
  },
  tools: { r: 'saw', l: 'sawhorse' },
  strike: { side: 'r', t: PUSHED },
  bodies: {
    man: { armsOut: -3 },
    woman: { armsOut: -3, add: { thigh_l: [0, 0, -6], thigh_r: [0, 0, 6], pelvis: [7, 0, 0] }, hands: { l: [HER_PALM[0] - PALM[0], HER_PALM[1] - PALM[1], HER_PALM[2] - PALM[2]], r: HER_FIST } },
  },
};
/** Played left-handed: mirrored, the saw in the left fist and the sawhorse under the right palm (its mirror). */
export const SAW_LEFT: Clip = { ...mirrorClip(SAW, 'saw-left'), tools: { l: 'saw', r: 'sawhorse_r' } };
