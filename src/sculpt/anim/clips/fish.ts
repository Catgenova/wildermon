/**
 * F1, fishing with a rod: one cast a go (`Clip.oneAGo`). Both hands on the rod, the right fist on the grip over the reel
 * and the left below the reel (`./pole.ts`) for the cast and the reeling, let go by the thigh over the wait. From the wait, the rod lifted and swung up and back over the right shoulder,
 * the trunk turned after it and the weight back onto the right foot; a moment's hold; flicked out over the water, fast,
 * the weight driven onto the left foot (the `cast` event), followed through down to the wait: the rod out over the water
 * a little below level, its line hanging from the tip to the float. The wait takes up the go (`Clip.stretch`), the rod
 * twitched now and then; then the strike, the rod snapped up, and the catch reeled in, the left hand at the reel's crank,
 * the rod let back down to the wait. The jobs done with a fishing rod play it (`../routes.ts` CLIP_OF_TOOL).
 *
 * Feet planted, the left ahead. The body faces the water: the renderer turns it to the spot the cast goes to
 * (`../../../render/renderer.ts`). Played mirrored, left-handed, from the facings that turn the body's right side away from the viewer (`../index.ts`
 * LEFT_FACINGS).
 */
import type { Clip } from '../clip';
import { mirrorClip, poseToPose, type Beat, type KeyPose } from '../author';
import type { Euler } from '../math';
import { onHandle, type Hold } from './pole';

/** One go, seconds, as the island's fishing takes it with no skill (src/game/fishing.ts baseTime). */
const LENGTH = 9;
/** The flick landed out over the water, and the wait's start and end (the stretched span). */
export const CAST = 1.6;
const WAIT: [number, number] = [2.0, 7.3];
/** The rod's fist and the other's below the reel: game units up the rod (tools/sculpt/gear/sawfish.mjs ROD lead and butt), and apart over the man's height. */
const ROD_LEAD = 2.15, ROD_BUTT = 0.9;
const GAP = -(ROD_LEAD - ROD_BUTT) / 16.5;
/** The wait: the rod 12 degrees below level, out over the water; the right fist ahead of the right hip. */
const WAIT_AT: Euler = [-0.15, 0.6, 0.2], WAIT_ELEV = -12;
/** The left hand let go of the rod over the wait, by the left thigh. */
const REST_L: Euler = [0.16, 0.56, 0.1];

/** The left fist round the reel's crank (under the rod, by the right fist), its two sides. */
const CRANK: [Euler, Euler] = [[-0.1, 0.62, 0.14], [-0.1, 0.66, 0.175]];
/** The keys of the right fist and the rod's way. */
const HOLDS: Hold[] = [
  { t: 0, at: WAIT_AT, elev: WAIT_ELEV, ease: 'inOut', left: REST_L },
  // lifted and swung back over the right shoulder, held there a moment
  { t: 0.5, at: [-0.12, 0.66, 0.22], elev: 25, ease: 'inOut' },
  { t: 0.85, at: [-0.16, 0.78, 0.14], elev: 75, yaw: -6, ease: 'in' },
  { t: 1.15, at: [-0.18, 0.84, 0.08], elev: 118, yaw: -10, ease: 'out' },
  { t: 1.32, at: [-0.18, 0.845, 0.075], elev: 120, yaw: -10, ease: 'linear' },
  // the flick: fast, out over the water, followed through and let down to the wait
  { t: 1.46, at: [-0.15, 0.8, 0.19], elev: 70, yaw: -4, ease: 'in' },
  { t: CAST, at: [-0.12, 0.7, 0.29], elev: 12, ease: 'linear' },
  { t: WAIT[0], at: WAIT_AT, elev: WAIT_ELEV, ease: 'out', left: REST_L },
  // the wait, twitched twice
  { t: 3.6, at: WAIT_AT, elev: WAIT_ELEV, ease: 'inOut', left: REST_L },
  { t: 3.75, at: [WAIT_AT[0], WAIT_AT[1] + 0.015, WAIT_AT[2]], elev: WAIT_ELEV + 7, ease: 'out', left: REST_L },
  { t: 4.0, at: WAIT_AT, elev: WAIT_ELEV, ease: 'inOut', left: REST_L },
  { t: 5.6, at: WAIT_AT, elev: WAIT_ELEV, ease: 'inOut', left: REST_L },
  { t: 5.72, at: [WAIT_AT[0], WAIT_AT[1] + 0.01, WAIT_AT[2]], elev: WAIT_ELEV + 5, ease: 'out', left: REST_L },
  { t: 5.9, at: WAIT_AT, elev: WAIT_ELEV, ease: 'inOut', left: REST_L },
  { t: WAIT[1], at: WAIT_AT, elev: WAIT_ELEV, ease: 'inOut', left: REST_L },
  // the strike: snapped up; then reeled in, the left hand at the crank, the rod held up
  { t: 7.5, at: [-0.12, 0.7, 0.18], elev: 55, ease: 'in' },
  { t: 7.75, at: [-0.12, 0.71, 0.17], elev: 50, ease: 'out', left: CRANK[0] },
  { t: 8.0, at: [-0.12, 0.705, 0.17], elev: 48, ease: 'inOut', left: CRANK[1] },
  { t: 8.2, at: [-0.12, 0.7, 0.175], elev: 46, ease: 'inOut', left: CRANK[0] },
  { t: 8.4, at: [-0.12, 0.695, 0.18], elev: 44, ease: 'inOut', left: CRANK[1] },
  { t: 8.6, at: [-0.12, 0.69, 0.185], elev: 40, ease: 'inOut', left: CRANK[0] },
];

/** The trunk at each beat (the stance's lean and turn), the arms' turns only where their elbows go. */
const ARMS: Record<string, Euler> = { upperarm_r: [20, 10, -45], lowerarm_r: [70, 0, 0], upperarm_l: [20, -10, 25], lowerarm_l: [80, 0, 0] };
const TRUNK = (o: { lean: number; turn: number; head: number; move: Euler; arms?: Record<string, Euler> }): KeyPose => ({
  rot: {
    pelvis: [o.lean * 0.5, o.turn * 0.4, 0], spine_01: [o.lean * 0.2, o.turn * 0.2, 0], spine_02: [o.lean * 0.2, o.turn * 0.2, 0], spine_03: [o.lean * 0.1, o.turn * 0.2, 0],
    neck_01: [-o.lean * 0.3, -o.turn * 0.4, 0], neck_02: [0, -o.turn * 0.2, 0], head: [o.head, -o.turn * 0.3, 0],
    ...ARMS, ...(o.arms ?? {}),
  },
  move: o.move,
});
const WAITING = TRUNK({ lean: 8, turn: 0, head: 10, move: [0.004, -0.012, 0.008] });
const BACK = TRUNK({ lean: -4, turn: -22, head: 2, move: [-0.018, -0.006, -0.01], arms: { upperarm_r: [10, 40, -60], lowerarm_r: [110, 0, 0] } });
const FLICK = TRUNK({ lean: 14, turn: 4, head: 6, move: [0.012, -0.02, 0.018] });
const STRIKE = TRUNK({ lean: -6, turn: -6, head: 0, move: [-0.01, -0.008, -0.006] });
const BEAT = (t: number, pose: KeyPose, ease: Beat['ease'], name?: string, stage?: Beat['stage']): Beat => ({ t, pose, ease, ...(name ? { name } : {}), ...(stage ? { stage } : {}) });
export const BEATS: Beat[] = [
  BEAT(0, WAITING, 'inOut', 'waiting', 'key'),
  BEAT(1.15, BACK, 'inOut', 'back over the shoulder', 'key'),
  BEAT(1.32, BACK, 'linear'),
  BEAT(CAST, FLICK, 'in', 'cast out', 'key'),
  BEAT(WAIT[0], WAITING, 'out', 'wait'),
  BEAT(WAIT[1], WAITING, 'inOut'),
  BEAT(7.5, STRIKE, 'in', 'strike', 'key'),
  BEAT(8.6, STRIKE, 'inOut', 'reeled in'),
];
/** The trunk after the arms, the head after the trunk: seconds each bone's keys are late. */
export const LAG = { pelvis: 0.03, spine_01: 0.04, spine_02: 0.05, spine_03: 0.06, neck_01: 0.08, neck_02: 0.09, head: 0.1 };
const KEYS = poseToPose(BEATS, { length: LENGTH, loop: true, lag: LAG });
const HANDS = onHandle(HOLDS, GAP);
/** The left fist closed on the butt (no prop in it: its fingers curled here). */
const FIST = { fingers_01_l: [{ t: 0, v: [70, 0, 0] as Euler }], fingers_02_l: [{ t: 0, v: [80, 0, 0] as Euler }], thumb_02_l: [{ t: 0, v: [20, 0, 0] as Euler }] };

export const FISH: Clip = {
  name: 'fish',
  loop: true,
  length: LENGTH,
  mask: 'full',
  // planted, the left foot ahead toward the water
  plant: { rot: { thigh_l: [8, -4, 6], thigh_r: [-6, 5, -6] } },
  breath: { count: 3, depth: 0.7 },
  ...KEYS,
  tracks: { ...KEYS.tracks, ...FIST },
  armsFree: true,
  hands: HANDS,
  tools: { r: 'fishing_rod' },
  strike: { side: 'r', t: CAST },
  events: [{ t: CAST, name: 'cast' }],
  stretch: [WAIT],
  oneAGo: true,
  bodies: { man: { armsOut: -3 }, woman: { armsOut: -3, add: { thigh_l: [0, 0, -6], thigh_r: [0, 0, 6] }, hands: { r: [0.01, -0.02, -0.055], l: [0.01, -0.02, -0.055] } } },
};
export const FISH_LEFT: Clip = mirrorClip(FISH, 'fish-left');
