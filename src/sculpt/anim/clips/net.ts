/**
 * F2, dragging a hand net: both hands on its pole (`./pole.ts`), the right ahead and the left behind it by the butt. The
 * hoop dipped into the water far out ahead, drawn back through it toward the bank (the drag, which takes up the go:
 * `Clip.stretch`), the trunk leaning back into the pull; lifted out, the pole raised and the bag hanging under the
 * hoop, shaken twice; swung back out and dipped again. The jobs done with a fishing net play it (`../routes.ts`
 * CLIP_OF_TOOL).
 *
 * Feet planted, the left ahead. The body faces the water: the renderer turns it to the spot the net goes into
 * (`../../../render/renderer.ts`). Played mirrored, left-handed, from the facings that turn the body's right side away from the viewer (`../index.ts`
 * LEFT_FACINGS).
 */
import type { Clip } from '../clip';
import { mirrorClip, poseToPose, type Beat, type KeyPose } from '../author';
import type { Euler } from '../math';
import { onHandle, type Hold } from './pole';

/** One drag, seconds: three to a go of the island's (src/game/fishing.ts drag_net baseTime 16). */
const LENGTH = 5.2;
/** The drag's end: the hoop drawn in to the bank, about to be lifted. */
export const DRAWN = 2.3;
/** The front fist and the rear: game units up the pole (tools/sculpt/gear/sawfish.mjs NET lead and butt), and apart over the man's height. */
const NET_LEAD = 2.6, NET_BUTT = 0.5;
const GAP = -(NET_LEAD - NET_BUTT) / 16.5;
/** The pole turned a little across the body to the left, so the front hand reaches it. */
const YAW = 8;

const HOLDS: Hold[] = [
  // dipped far out, then drawn back in through the water
  { t: 0, at: [-0.07, 0.52, 0.27], elev: -36, yaw: YAW, ease: 'out' },
  { t: 1.2, at: [-0.075, 0.51, 0.2], elev: -38, yaw: YAW, ease: 'linear' },
  { t: DRAWN, at: [-0.08, 0.5, 0.13], elev: -41, yaw: YAW, ease: 'inOut' },
  // lifted out, the bag hanging under the hoop, shaken twice
  { t: 2.95, at: [-0.08, 0.66, 0.19], elev: 28, yaw: YAW, ease: 'inOut' },
  { t: 3.15, at: [-0.08, 0.645, 0.195], elev: 22, yaw: YAW, ease: 'out' },
  { t: 3.32, at: [-0.08, 0.665, 0.19], elev: 31, yaw: YAW, ease: 'out' },
  { t: 3.5, at: [-0.08, 0.645, 0.195], elev: 23, yaw: YAW, ease: 'out' },
  { t: 3.7, at: [-0.08, 0.66, 0.19], elev: 28, yaw: YAW, ease: 'inOut' },
  // swung back out and down into the water
  { t: 4.5, at: [-0.06, 0.6, 0.27], elev: -8, yaw: YAW, ease: 'inOut' },
];

const ARMS: Record<string, Euler> = { upperarm_r: [10, 10, -20], lowerarm_r: [60, 0, 0], upperarm_l: [30, -10, 20], lowerarm_l: [60, 0, 0] };
const TRUNK = (o: { lean: number; turn: number; head: number; move: Euler }): KeyPose => ({
  rot: {
    pelvis: [o.lean * 0.55, o.turn * 0.4, 0], spine_01: [o.lean * 0.2, o.turn * 0.2, 0], spine_02: [o.lean * 0.15, o.turn * 0.2, 0], spine_03: [o.lean * 0.1, o.turn * 0.2, 0],
    neck_01: [-o.lean * 0.35, -o.turn * 0.4, 0], neck_02: [0, -o.turn * 0.2, 0], head: [o.head, -o.turn * 0.3, 0],
    ...ARMS,
  },
  move: o.move,
});
/** Reached out over the water, leant in; drawn in, leant back on the pull; lifted, upright. */
const OUT = TRUNK({ lean: 22, turn: 10, head: 12, move: [0.006, -0.03, 0.02] });
const IN = TRUNK({ lean: 10, turn: 4, head: 14, move: [-0.004, -0.035, -0.02] });
const UP = TRUNK({ lean: 4, turn: 0, head: -4, move: [0, -0.012, -0.006] });
export const BEATS: Beat[] = [
  { t: 0, pose: OUT, ease: 'inOut', stage: 'key', name: 'dipped' },
  { t: DRAWN, pose: IN, ease: 'inOut', stage: 'key', name: 'drawn in' },
  { t: 2.95, pose: UP, ease: 'inOut', stage: 'key', name: 'lifted' },
  { t: 3.7, pose: UP, ease: 'inOut', name: 'shaken' },
  { t: 4.5, pose: OUT, ease: 'inOut', name: 'swung out' },
];
export const LAG = { pelvis: 0.03, spine_01: 0.04, spine_02: 0.05, spine_03: 0.06, neck_01: 0.08, neck_02: 0.09, head: 0.1 };
const KEYS = poseToPose(BEATS, { length: LENGTH, loop: true, lag: LAG });
/** The front fist closed on the pole (no prop in it: its fingers curled here). */
const FIST = { fingers_01_l: [{ t: 0, v: [70, 0, 0] as Euler }], fingers_02_l: [{ t: 0, v: [80, 0, 0] as Euler }], thumb_02_l: [{ t: 0, v: [20, 0, 0] as Euler }] };

export const NET: Clip = {
  name: 'net',
  loop: true,
  length: LENGTH,
  mask: 'full',
  plant: { rot: { thigh_l: [10, -4, 6], thigh_r: [-8, 5, -6] } },
  breath: { count: 2, depth: 0.7 },
  ...KEYS,
  tracks: { ...KEYS.tracks, ...FIST },
  armsFree: true,
  hands: onHandle(HOLDS, GAP),
  tools: { r: 'fishing_net' },
  strike: { side: 'r', t: DRAWN },
  stretch: [[0, DRAWN]],
  bodies: { man: { armsOut: -3 }, woman: { armsOut: -3, add: { thigh_l: [0, 0, -6], thigh_r: [0, 0, 6], pelvis: [5, 0, 0] }, hands: { r: [0.015, 0, -0.06], l: [0.015, 0, -0.06] } } },
};
export const NET_LEFT: Clip = mirrorClip(NET, 'net-left');
