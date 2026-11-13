/**
 * W1 and W2, in the water (`../../../render/figure.ts` swim): the breaststroke under way (`swim`) and treading water
 * stopped (`tread`), each a loop played on the flat figure's own clock (`../index.ts` clipFor), so the rings it leaves on
 * the water (its `ripple`) are made where this body's kick and hands are.
 *
 * The water's surface is at the floor's level: each clip lets the body down into it (`move`, body heights), and the body
 * is held there rather than stood on its soles (`../../lowpoly.ts` lowBones); the draw cuts it at the surface
 * (`SculptDraw.water`). The hands are put where they go in the water (`Clip.hands`: across, up from the surface,
 * forward), so they stay under it however the body leans or bobs over them; the arms' keyed turns only say which way the
 * elbows go.
 *
 * Each is keyed as a few key poses on its run and sampled smoothly between them (`sampled`: through each key at the pace
 * the keys either side of it set, as the flat figure's `loop`), every bone at even steps of the run.
 */
import type { Clip, HandReach, Key } from '../clip';
import type { Euler } from '../math';
import { TREAD_RATE } from '../../../render/figure';

const TAU = Math.PI * 2;
/** A key pose in the water: the bones' turns, the body's shift (body heights) and each hand's place (`Clip.hands`). */
interface WaterPose { rot: Record<string, Euler>; move: Euler; hands: { l: Euler; r: Euler } }
/** A key pose at a share of the run (0 to 1). */
interface At { at: number; pose: WaterPose }

/** The steps a run is sampled at: enough that the straight runs between them are not seen. */
const STEPS = 48;

/** Catmull-Rom through looped values at shares `ats` of the run: the value at share u. */
function spline(ats: number[], vs: number[], u: number): number {
  const n = ats.length, t = (i: number): number => ats[((i % n) + n) % n] + Math.floor(i / n), v = (i: number): number => vs[((i % n) + n) % n];
  let i = n - 1;
  while (i > 0 && ats[i] > u) i--;
  if (u < ats[0]) i = -1;
  const h = t(i + 1) - t(i), s = (u - t(i)) / h;
  const m0 = ((v(i + 1) - v(i - 1)) / (t(i + 1) - t(i - 1))) * h, m1 = ((v(i + 2) - v(i)) / (t(i + 2) - t(i))) * h;
  const s2 = s * s, s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * v(i) + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * v(i + 1) + (s3 - s2) * m1;
}

/**
 * Key poses on a run of `length` seconds as a clip's tracks, its shift and its hands: every channel of every bone named in
 * any of them sampled at `STEPS` even steps through the keys (`spline`), and reached linearly between the steps.
 */
function sampled(keys: At[], length: number, way: { l: Euler; r: Euler }): Pick<Clip, 'tracks' | 'move' | 'hands' | 'poses'> & { hands: NonNullable<Clip['hands']> } {
  const bones = [...new Set(keys.flatMap((k) => Object.keys(k.pose.rot)))], ats = keys.map((k) => k.at);
  const steps = Array.from({ length: STEPS }, (_, j) => j / STEPS);
  const curve = (get: (p: WaterPose) => Euler): Array<Key<Euler>> => steps.map((u) => ({
    t: +(u * length).toFixed(5), ease: 'linear' as const,
    v: [0, 1, 2].map((c) => +spline(ats, keys.map((k) => get(k.pose)[c]), u).toFixed(4)) as Euler,
  }));
  const tracks = Object.fromEntries(bones.map((b) => [b, curve((p) => p.rot[b] ?? [0, 0, 0])]));
  const hand = (s: 'l' | 'r'): HandReach => ({ at: curve((p) => p.hands[s]), way: way[s] });
  return { tracks, move: curve((p) => p.move), hands: { l: hand('l'), r: hand('r') }, poses: [] };
}

/** A pose's left side mirrored onto its right: the turns across the body (ry, rz) reversed; the hands across. */
function both(rot: Record<string, Euler>): Record<string, Euler> {
  const out: Record<string, Euler> = { ...rot };
  for (const [b, e] of Object.entries(rot)) if (b.endsWith('_l')) out[`${b.slice(0, -2)}_r`] = [e[0], -e[1], -e[2]];
  return out;
}
const hands = (at: Euler): { l: Euler; r: Euler } => ({ l: at, r: [-at[0], at[1], at[2]] });

/** The fingers together and flat, the hand a paddle. */
const PADDLE: Record<string, Euler> = { fingers_01_l: [6, 0, 0], fingers_02_l: [6, 0, 0], thumb_02_l: [6, 0, 0] };

/*
 * The breaststroke, from the glide (the flat figure's `BREAST`): lying along the water, the arms out ahead under the
 * surface and the legs out behind together; the hands sweep out wide and round, and in under the chin while the head and
 * shoulders come up to breathe; the knees draw up as the hands come in, the hands shoot forward, and the legs whip round
 * and together behind into the next glide. A stroke a run; the kick at RIPPLE_KICK (0.55) of it, where the flat figure's
 * ring is set going.
 */
/** Seconds a stroke takes at an unskilled swimmer's pace (the flat figure's): the clip's own units; the game plays it on the walk's phase. */
const STROKE = 1.25;
/** How far the body leans forward from upright at the glide (degrees at the hips), and at the breath. */
const LEAN = 42, LEAN_UP = 34;
/** How far the body is let down into the water at the glide, body heights: the tops of the shoulders at the surface. */
const DOWN = 0.775;
/** Degrees the neck is tipped back further at its root than looking ahead wants, lifting the head over the shoulders. */
const NECK_UP = 24;

/** The trunk at a lean, the back arched up by `arch` at each joint of the spine, the face kept looking ahead. */
const trunk = (lean: number, arch: number): Record<string, Euler> => {
  const back = lean - 3 * arch;
  // (the neck tipped back from its root further than the face needs, the head up over the shoulders, and the head
  // tipped forward again at the skull to look ahead)
  return {
    pelvis: [lean, 0, 0], spine_01: [-arch, 0, 0], spine_02: [-arch, 0, 0], spine_03: [-arch, 0, 0],
    neck_01: [-back * 0.5 - NECK_UP, 0, 0], neck_02: [-back * 0.3, 0, 0], head: [-back * 0.14 + NECK_UP * 0.8, 0, 0],
  };
};

const GLIDE: WaterPose = {
  rot: both({
    ...trunk(LEAN, 3), ...PADDLE,
    upperarm_l: [120, 0, 12], lowerarm_l: [12, 0, 0], hand_l: [0, 0, 0],
    thigh_l: [-14, 0, 3], calf_l: [-6, 0, 0], foot_l: [40, 0, 0],
  }),
  move: [0, -DOWN, 0],
  hands: hands([0.07, -0.13, 0.42]),
};
const CATCH: WaterPose = {
  rot: both({
    ...trunk(LEAN - 2, 3.5), ...PADDLE,
    upperarm_l: [112, 0, 26], lowerarm_l: [18, 0, 0],
    thigh_l: [-14, 0, 3], calf_l: [-8, 0, 0], foot_l: [40, 0, 0],
  }),
  move: [0, -DOWN + 0.006, 0],
  hands: hands([0.16, -0.13, 0.37]),
};
const PULL: WaterPose = {
  rot: both({
    ...trunk(LEAN - 8, 5), ...PADDLE,
    upperarm_l: [78, 0, 36], lowerarm_l: [60, 0, 0],
    thigh_l: [-10, 0, 4], calf_l: [-14, 0, 0], foot_l: [36, 0, 0],
  }),
  move: [0, -DOWN + 0.025, 0],
  hands: hands([0.2, -0.14, 0.28]),
};
const BREATH: WaterPose = {
  rot: both({
    ...trunk(LEAN_UP, 6), ...PADDLE,
    upperarm_l: [56, 0, 34], lowerarm_l: [112, 0, 0],
    thigh_l: [24, 0, 10], calf_l: [-70, 0, 0], foot_l: [20, 0, 0],
  }),
  move: [0, -DOWN + 0.02, 0],
  hands: hands([0.07, -0.13, 0.22]),
};
const SHOOT: WaterPose = {
  rot: both({
    ...trunk(LEAN - 6, 4), ...PADDLE,
    upperarm_l: [100, 0, 16], lowerarm_l: [62, 0, 0],
    thigh_l: [52, 0, 18], calf_l: [-122, 0, 0], foot_l: [-10, 0, 0],
  }),
  move: [0, -DOWN + 0.02, 0],
  hands: hands([0.05, -0.13, 0.32]),
};
const KICK: WaterPose = {
  rot: both({
    ...trunk(LEAN, 3), ...PADDLE,
    upperarm_l: [118, 0, 12], lowerarm_l: [14, 0, 0],
    thigh_l: [8, 0, 26], calf_l: [-34, 0, 0], foot_l: [10, 0, 0],
  }),
  move: [0, -DOWN + 0.004, 0],
  hands: hands([0.06, -0.13, 0.42]),
};

const SWIM_KEYS: At[] = [
  { at: 0, pose: GLIDE },
  { at: 0.14, pose: CATCH },
  { at: 0.28, pose: PULL },
  { at: 0.4, pose: BREATH },
  { at: 0.52, pose: SHOOT },
  { at: 0.64, pose: KICK },
  { at: 0.8, pose: GLIDE },
];
/** The key poses by name, for the sheets. */
const SWIM_NAMES = ['glide', 'catch', 'pull', 'breath', 'shoot', 'kick'];

export const SWIM: Clip = {
  name: 'swim',
  loop: true,
  length: STROKE,
  mask: 'full',
  armsFree: true,
  // (the thumbs in toward the middle: the palms down along the glide, out as the hands sweep out, back as they come in)
  ...sampled(SWIM_KEYS, STROKE, { l: [-1, 0, 0], r: [1, 0, 0] }),
  poses: SWIM_KEYS.slice(0, -1).map((k, i) => ({ t: +(k.at * STROKE).toFixed(4), name: SWIM_NAMES[i] })),
};

/*
 * Treading water (the flat figure's `tread`): upright, the hands sculling flat just under the surface out to the sides,
 * out and in, each a little behind the other; the legs turning over in turn under the body as a cyclist's; the body
 * rising on each sweep, out and in, and the head looking about over four sweeps.
 */
/** Seconds a sweep of the hands takes (the flat figure's, on the island's clock of six a second), and the sweeps a run. */
const SWEEP = TAU / TREAD_RATE / 6, SWEEPS = 4;
/** How far the body is let down into the water treading it, body heights: the root of the neck at the surface. */
const DEEP = 0.83;

/** Treading water `q` radians into a run of sweeps (a sweep each TAU, the left hand's out at a quarter of one). */
function treadAt(q: number): WaterPose {
  const s = Math.sin(q), c = Math.cos(q), look = 18 * Math.sin(q / SWEEPS);
  const rot: Record<string, Euler> = {
    pelvis: [8, -2 * s, 0], spine_01: [-1, 1 * s, 0], spine_02: [-1, 1 * s, 0], spine_03: [-2 - 1.5 * c, 2 * s, 0],
    neck_01: [-2, -2 * s + look * 0.3, 0], neck_02: [-1, look * 0.3, 0], head: [-3, -0.5 * s + look * 0.4, 0],
    clavicle_l: [0, 0, -3], clavicle_r: [0, 0, 3],
  };
  const out: { l: Euler; r: Euler } = { l: [0, 0, 0], r: [0, 0, 0] };
  for (const [side, k] of [['l', 0], ['r', 1]] as const) {
    const m = side === 'l' ? 1 : -1, o = Math.sin(q + k * 0.35);
    const w = Math.sin(q + k * Math.PI), knee = 64 + 26 * Math.sin(q + k * Math.PI + 1.2);
    rot[`upperarm_${side}`] = [-35, 0, m * 75];
    rot[`lowerarm_${side}`] = [70, 0, 0];
    rot[`thigh_${side}`] = [34 + 18 * w, 0, m * 10];
    rot[`calf_${side}`] = [-knee, 0, 0];
    rot[`foot_${side}`] = [10, 0, 0];
    rot[`fingers_01_${side}`] = [6, 0, 0];
    rot[`fingers_02_${side}`] = [6, 0, 0];
    // out to the side just under the surface, sweeping out and in, a little forward of the shoulder
    out[side] = [m * (0.25 + 0.05 * o), -0.13, 0.07 + 0.025 * c];
  }
  // up on each sweep, out and in, a little after the hands are going fastest
  return { rot, move: [0, -DEEP + 0.012 * Math.cos(2 * q - 0.6), 0], hands: out };
}
const TREAD_N = 8 * SWEEPS;
const TREAD_KEYS: At[] = Array.from({ length: TREAD_N }, (_, j) => ({ at: j / TREAD_N, pose: treadAt((j / TREAD_N) * TAU * SWEEPS) }));

export const TREAD: Clip = {
  name: 'tread',
  loop: true,
  length: SWEEP * SWEEPS,
  mask: 'full',
  armsFree: true,
  // (the thumbs forward: the palms flat on the water, the fingers out to the sides)
  ...sampled(TREAD_KEYS, SWEEP * SWEEPS, { l: [0, 0, 1], r: [0, 0, 1] }),
  poses: [0, 0.25, 0.5, 0.75].map((u) => ({ t: +(u * SWEEP).toFixed(4), name: `sweep ${u}` })),
  // her head set lower on her shoulders: let down a little less, so it stands as far out of the water as his
  bodies: { woman: { move: [1, 0.975, 1] } },
};
