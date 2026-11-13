/**
 * M1 to M3, eating and drinking stood, what is eaten or drunk from in the right fist (`Clip.tools`: `../../lowpoly.ts`
 * PROPS, `tools/sculpt/gear/vessels.mjs`), the left arm hanging; both feet planted where the idle stands them:
 * - eating (`eat`): the roll held before the chest, brought up to the mouth, the head leant in to it, bitten (the jaw
 *   shut on it), lowered, chewed (the jaw worked three times, the head nodding with it);
 * - drinking from a cup (`drink-cup`): held upright before the chest, raised to the lips and tipped, the head back,
 *   swallowed twice, lowered;
 * - drinking from a skin (`drink-skin`): held before the chest, raised over the mouth neck down and tipped, the head
 *   back, swallowed twice, lowered.
 * The fist is reached to its place and its grip turned its way at each key (`Clip.hands`); a go is fitted to its length
 * by the chewing or the drinking (`Clip.stretch`). Played mirrored, left-handed, from the facings the work is.
 */
import type { Clip, HandReach, Key } from '../clip';
import { merge, poseToPose, type Beat, type KeyPose } from '../author';
import type { Euler } from '../math';

/** The left arm hanging as the idle's, the right's elbow down at the side (the side the reached arm bends to). */
const ARMS: Record<string, Euler> = {
  upperarm_l: [-2, 0, 2], lowerarm_l: [12, 0, 0], hand_l: [0, -50, 0], fingers_01_l: [12, 0, 0], fingers_02_l: [18, 0, 0],
  upperarm_r: [20, 0, -14], lowerarm_r: [90, 0, 0],
};
/** The jaw shut and opened, degrees about its hinge. */
const SHUT = 0, OPEN = 9;

/** A beat: when, the trunk's and the head's turns, the jaw, and where the fist is and its grip's way. */
interface Bite { t: number; name?: string; rot: Record<string, Euler>; jaw: number; at: Euler; way: Euler; key?: boolean }
const poseOf = (b: Bite): KeyPose => merge({ rot: ARMS }, { rot: { ...b.rot, jaw: [b.jaw, 0, 0] } });

function clipOf(name: string, length: number, bites: Bite[], tool: string, stretch: Array<[number, number]>, her: Euler): Clip {
  const beats: Beat[] = bites.map((b) => ({ t: b.t, pose: poseOf(b), ease: 'inOut', ...(b.key ? { stage: 'key' as const } : {}), ...(b.name ? { name: b.name } : {}) }));
  const keys = poseToPose(beats, { length, loop: true, lag: { head: 0.04, neck_02: 0.02 } });
  const ease = { ease: 'inOut' as const };
  const r: HandReach = { at: bites.map((b): Key<Euler> => ({ t: b.t, v: b.at, ...ease })), way: bites[0].way, ways: bites.map((b): Key<Euler> => ({ t: b.t, v: b.way, ...ease })) };
  return {
    name, loop: true, length, mask: 'full',
    // stood as the idle stands, feet a little apart and turned out; hers closer together
    plant: { rot: { thigh_l: [0, -3, 6], thigh_r: [0, 3, -6] } },
    breath: { count: 1, depth: 0.6 },
    ...keys,
    armsFree: true,
    hands: { r },
    tools: { r: tool },
    stretch,
    bodies: {
      man: { armsOut: 0.08 },
      // her arms shorter for her height: what is held kept nearer
      woman: { armsOut: 0.07, add: { thigh_l: [0, 0, -6], thigh_r: [0, 0, 6] }, hands: { r: her } },
    },
  };
}

/* ---- eating ---------------------------------------------------------------------------------------------------- */

const HEAD: Record<string, Euler> = { spine_02: [2, 0, 0], neck_01: [2, 0, 0], head: [8, 0, 0] };
const LEANT: Record<string, Euler> = { spine_02: [3, 0, 0], spine_03: [2, 0, 0], neck_01: [6, 0, 0], head: [4, 0, 0] };
/** The roll before the chest, its end up and in; at the mouth, its end to the lips. */
const HELD: Pick<Bite, 'at' | 'way'> = { at: [-0.07, 0.6, 0.17], way: [0.4, 0.9, 0.2] };
const AT_MOUTH: Pick<Bite, 'at' | 'way'> = { at: [-0.03, 0.855, 0.12], way: [0.6, 0.3, -0.75] };
const LOWERED: Pick<Bite, 'at' | 'way'> = { at: [-0.065, 0.69, 0.16], way: [0.5, 0.8, 0.2] };
const chew = (t: number, open: boolean, name?: string): Bite => ({ t, name, rot: { ...HEAD, head: [open ? 9.5 : 8, 0, 0] }, jaw: open ? OPEN * 0.7 : SHUT, ...LOWERED });
const EAT_BITES: Bite[] = [
  { t: 0, name: 'held', key: true, rot: HEAD, jaw: SHUT, ...HELD },
  { t: 0.45, name: 'to the mouth', key: true, rot: LEANT, jaw: OPEN, ...AT_MOUTH },
  { t: 0.6, name: 'bitten', key: true, rot: { ...LEANT, head: [1, 0, 0] }, jaw: SHUT, at: [-0.035, 0.84, 0.13], way: AT_MOUTH.way },
  { t: 0.95, name: 'lowered', rot: HEAD, jaw: SHUT, ...LOWERED },
  chew(1.12, true, 'chewing'), chew(1.28, false), chew(1.44, true), chew(1.6, false), chew(1.76, true), chew(1.9, false),
];
export const EAT: Clip = clipOf('eat', 2, EAT_BITES, 'bread', [[0.95, 2]], [0.005, 0.02, -0.03]);

/* ---- drinking -------------------------------------------------------------------------------------------------- */

const UP: Record<string, Euler> = { neck_01: [-6, 0, 0], head: [-8, 0, 0] };
const BACK: Record<string, Euler> = { spine_03: [-3, 0, 0], neck_01: [-12, 0, 0], neck_02: [-6, 0, 0], head: [-12, 0, 0] };
/** A swallow: the head nodded back a little further. */
const GULP: Record<string, Euler> = { spine_03: [-3, 0, 0], neck_01: [-14, 0, 0], neck_02: [-7, 0, 0], head: [-14, 0, 0] };

const CUP_BITES: Bite[] = [
  { t: 0, name: 'held', key: true, rot: {}, jaw: SHUT, at: [-0.07, 0.62, 0.18], way: [0, 1, 0] },
  { t: 0.45, name: 'to the lips', key: true, rot: UP, jaw: SHUT, at: [-0.02, 0.84, 0.13], way: [0, 0.55, -0.85] },
  { t: 0.65, name: 'tipped', key: true, rot: BACK, jaw: SHUT, at: [-0.02, 0.87, 0.12], way: [0, 0.15, -1] },
  { t: 0.85, name: 'swallow', rot: GULP, jaw: SHUT, at: [-0.02, 0.875, 0.12], way: [0, 0.1, -1] },
  { t: 1.05, rot: BACK, jaw: SHUT, at: [-0.02, 0.875, 0.12], way: [0, 0.05, -1] },
  { t: 1.25, rot: GULP, jaw: SHUT, at: [-0.02, 0.88, 0.12], way: [0, 0, -1] },
  { t: 1.4, rot: BACK, jaw: SHUT, at: [-0.02, 0.87, 0.12], way: [0, 0.15, -1] },
  { t: 1.75, name: 'lowered', rot: {}, jaw: SHUT, at: [-0.07, 0.63, 0.18], way: [0, 1, 0.05] },
];
export const DRINK_CUP: Clip = clipOf('drink-cup', 2, CUP_BITES, 'cup', [[0.65, 1.4]], [0.005, 0.02, -0.035]);

const SKIN_BITES: Bite[] = [
  { t: 0, name: 'held', key: true, rot: {}, jaw: SHUT, at: [-0.07, 0.62, 0.17], way: [0.2, 1, 0.1] },
  { t: 0.5, name: 'raised', key: true, rot: UP, jaw: SHUT, at: [-0.03, 0.9, 0.14], way: [0.15, -0.2, -1] },
  { t: 0.7, name: 'tipped', key: true, rot: BACK, jaw: SHUT, at: [-0.02, 0.93, 0.12], way: [0.15, -0.5, -0.85] },
  { t: 0.9, name: 'swallow', rot: GULP, jaw: SHUT, at: [-0.02, 0.935, 0.12], way: [0.15, -0.55, -0.82] },
  { t: 1.1, rot: BACK, jaw: SHUT, at: [-0.02, 0.935, 0.12], way: [0.15, -0.55, -0.82] },
  { t: 1.3, rot: GULP, jaw: SHUT, at: [-0.02, 0.94, 0.12], way: [0.15, -0.6, -0.8] },
  { t: 1.45, rot: BACK, jaw: SHUT, at: [-0.02, 0.93, 0.12], way: [0.15, -0.5, -0.85] },
  { t: 1.8, name: 'lowered', rot: {}, jaw: SHUT, at: [-0.07, 0.63, 0.17], way: [0.2, 1, 0.1] },
];
export const DRINK_SKIN: Clip = clipOf('drink-skin', 2, SKIN_BITES, 'waterskin', [[0.7, 1.45]], [0.005, -0.01, -0.035]);
export const BEATS: Beat[] = EAT_BITES.map((b) => ({ t: b.t, pose: poseOf(b), name: b.name, ...(b.key ? { stage: 'key' as const } : {}) }));
