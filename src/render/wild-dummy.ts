import {
  ACT_SECS, add, beat, bipedBones, blush, clamp, cross, cyc, DEG, coatPalette, darker, disc, dot, drift, eyes, frac, lerp, lighter, merge, mix, moved,
  onEgg, orb, orbAlong, paint, scale, smile, smooth, sub, TAU, tube, unit, type Anim, type BipedPose, type BipedSpec, type Bones, type Disc, type Kind,
  type Piece,
} from './beasts';
import { blade, cut } from './beastkit';
import { joint, mesh, onScreen, place, type Mat, type Mesh, type RGB, type V3, type View } from './figure';

/**
 * The dummy line: the Dummicub, a little round training dummy of a bear
 * cub, stitched out of straw-stuffed cloth, up on its hind legs with its paws
 * raised and a target sewn on its belly; which grows into the Dummibear, up
 * in a boxer's stance, a fringe of straw thatch on its shoulders, a rope
 * across its chest and pink cloth wrapped round its forearms and shins; and
 * then the Dummititan, a big heavy one under a thick straw mantle with a
 * straw skirt at its waist, a rope harness, and a huge target on its belly.
 * The species is still `sparra` underneath: the one you spar with.
 *
 * Each is caramel straw-fur with cream patches and bands: a round head with
 * dark eyes, a cream muzzle, a dark nose, rosy cheeks, a dark brown stripe
 * down a cream blaze on its forehead, round ears dark inside; dark brown pads
 * on its paws and soles; a pink-and-cream target on its belly with stitches
 * round it; and a collar of green leaves with one pink one. All three are
 * built by one set of functions from a description of the stage (`Dummy`),
 * so a stage is its numbers. It strikes with its paws -- a flailing swipe, a
 * one-two, a double-pawed slam -- and every blow jars it: it wobbles like the
 * stuffed thing it is, and straw puffs out of it.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** How an arm is held: forward, out to its side, the elbow bent, and the upper arm turned about itself (degrees). */
type Hold = readonly [number, number, number, number];

/** A row of straw strands: how many, how long, how far down they hang (nought straight out, one straight down), how high, and how far round from the back they come (one: all the way round). */
type Row = readonly [number, number, number, number, number];

interface Dummy {
  /** Which it is, for the things a stage does its own way: how it stands, how it strikes. */
  stage: 0 | 1 | 2;
  /** The legs: the hip on the right, thigh, shin and the drop to the sole, how they stand (thigh forward, knee), how thick at the thigh and the shin, and the foot's length. */
  leg: { at: V3; len: [number, number, number]; rest: [number, number]; w: [number, number]; foot: number };
  /** Standing: its left foot forward and its right back by `split` degrees, and its knees bent by `bend`: a boxer's stance. */
  stance: { split: number; bend: number };
  /** The seat: the hips' half-sizes across, along and up. */
  hips: V3;
  /** The chest's joint on the hips, and how far forward of upright it is carried. */
  chest: { at: V3; lean: number };
  /** The body: an egg in the chest's frame, its middle and its half-sizes; and how much narrower it draws in toward its top, a pear. */
  torso: { c: V3; r: V3; pear: number };
  /** How far round from its middle the target's outer ring comes on the belly (radians). */
  target: number;
  neck: { at: V3; len: number };
  /** The arms: the shoulder on the right, upper arm and forearm, how thick, and the paw's size. */
  arm: { at: V3; len: [number, number]; w: [number, number]; paw: number };
  /** How it holds its arms standing, left and right. */
  hold: readonly [Hold, Hold];
  /** The head's egg in its own frame and how far nose-up it is carried; the eyes' size; the ears' size; and whether its mouth is open in a grin. */
  head: { c: V3; r: V3; pitch: number; eye: number; ear: number; open: boolean };
  /** Straw thatch over its shoulders, row by row from the top (`Row`, high on the chest); and its straw skirt on the hips. */
  mantle: readonly Row[];
  skirt: readonly Row[];
  /** Pink cloth wrapped round its forearms and shins, and a pink patch on its left knee. */
  wraps: boolean;
  knee: boolean;
  /** Rope: none; round its neck and over its right shoulder; or round its neck and over both shoulders. */
  rope: 0 | 1 | 2;
  /** The collar of leaves round its neck: how many, how long, how wide. */
  collar: { count: number; len: number; w: number };
  /** How it goes: the legs' swing at a walk and at a run, how far it rolls from foot to foot, how far its arms swing, and how much it bobs. */
  gait: { swing: [number, number]; waddle: number; armSwing: number; bounce: number };
  size: number;
}

/** A Dummicub: small and round, a big head on a round body, up on short legs with both paws raised and a grin. */
const DUMMICUB_LOOK: Dummy = {
  stage: 0,
  leg: { at: [0.42, 0.02, -0.06], len: [0.14, 0.1, 0.15], rest: [6, -12], w: [0.4, 0.36], foot: 0.58 },
  stance: { split: 6, bend: 0 },
  hips: [0.68, 0.58, 0.42],
  chest: { at: [0, 0, 0.08], lean: -4 },
  torso: { c: [0, 0.04, 0.46], r: [0.88, 0.76, 0.7], pear: 0.15 },
  target: 0.86,
  neck: { at: [0, 0.08, 1.0], len: 0.04 },
  arm: { at: [0.74, 0.04, 0.8], len: [0.36, 0.26], w: [0.26, 0.27], paw: 0.31 },
  hold: [[10, 100, 62, 90], [10, 100, 62, 90]],
  head: { c: [0, 0.06, 0.7], r: [0.98, 0.74, 0.8], pitch: 12, eye: 0.24, ear: 0.3, open: true },
  mantle: [],
  skirt: [],
  wraps: false,
  knee: false,
  rope: 0,
  collar: { count: 9, len: 0.36, w: 0.16 },
  gait: { swing: [30, 40], waddle: 7, armSwing: 14, bounce: 0.35 },
  size: 3.0,
};

/** A Dummibear: up in a boxer's stance, its left paw out ahead and its right up by its chin, straw thatch on its shoulders. */
const DUMMIBEAR_LOOK: Dummy = {
  stage: 1,
  leg: { at: [0.62, 0.0, -0.12], len: [0.36, 0.32, 0.18], rest: [8, -16], w: [0.52, 0.46], foot: 0.72 },
  stance: { split: 20, bend: 0.36 },
  hips: [0.98, 0.66, 0.54],
  chest: { at: [0, 0, 0.12], lean: 6 },
  torso: { c: [0, 0.08, 0.72], r: [1.3, 1.04, 0.96], pear: 0.24 },
  target: 0.78,
  neck: { at: [0, 0.2, 1.56], len: 0.06 },
  arm: { at: [1.16, 0.22, 1.24], len: [0.48, 0.46], w: [0.34, 0.41], paw: 0.43 },
  hold: [[72, 8, 40, 0], [20, 46, 128, 56]],
  head: { c: [0, 0.08, 0.7], r: [0.92, 0.72, 0.8], pitch: 8, eye: 0.19, ear: 0.31, open: false },
  mantle: [[24, 0.42, 0.45, 1.5, 0.82], [18, 0.36, 0.68, 1.3, 0.62]],
  skirt: [],
  wraps: true,
  knee: true,
  rope: 1,
  collar: { count: 9, len: 0.44, w: 0.2 },
  gait: { swing: [24, 34], waddle: 6, armSwing: 6, bounce: 0.45 },
  size: 3.4,
};

/** A Dummititan: big and heavy, both paws raised, a thick straw mantle, a straw skirt with leaves at its waist, a rope harness. */
const DUMMITITAN_LOOK: Dummy = {
  stage: 2,
  leg: { at: [0.98, 0.0, -0.16], len: [0.46, 0.42, 0.22], rest: [4, -8], w: [0.72, 0.64], foot: 1.02 },
  stance: { split: 4, bend: 0.12 },
  hips: [1.5, 0.88, 0.7],
  chest: { at: [0, 0, 0.16], lean: 2 },
  torso: { c: [0, 0.12, 0.96], r: [1.84, 1.4, 1.24], pear: 0.26 },
  target: 0.76,
  neck: { at: [0, 0.3, 2.1], len: 0.08 },
  arm: { at: [1.74, 0.04, 1.66], len: [0.58, 0.52], w: [0.46, 0.52], paw: 0.54 },
  hold: [[34, 58, 92, 90], [34, 58, 92, 90]],
  head: { c: [0, 0.1, 0.82], r: [1.08, 0.84, 0.94], pitch: 8, eye: 0.2, ear: 0.37, open: false },
  mantle: [[30, 0.56, 0.42, 1.98, 0.84], [26, 0.56, 0.62, 1.74, 0.68]],
  skirt: [[26, 0.42, 0.86, 0.36, 1], [24, 0.42, 0.9, 0.14, 1]],
  wraps: true,
  knee: false,
  rope: 2,
  collar: { count: 11, len: 0.56, w: 0.25 },
  gait: { swing: [18, 26], waddle: 5, armSwing: 5, bounce: 0.4 },
  size: 4.0,
};

/** A number of its own for each strand or leaf, nought to one, so a fringe is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);

/* ---- the strike, in time ------------------------------------------------------------------- */

/**
 * When each stage's blows land, as shares of its strike: the Dummicub's two swipes, right then left; the Dummibear's jab and
 * then its cross; the Dummititan's two paws coming down together. The last is the blow that jars it. The voice lands on these
 * (`../audio/voice-dummy`).
 */
export const DUMMY_HITS: ReadonlyArray<readonly number[]> = [[0.4, 0.52], [0.28, 0.52], [0.56]];
/** When each stage gathers itself for its strike: the Dummicub's hop off the ground, the Dummibear's step in, the Dummititan's paws up high. */
export const DUMMY_GATHER: readonly number[] = [0.3, 0.16, 0.36];

/** The last blow of a stage's strike. */
const lastHit = (s: Dummy): number => DUMMY_HITS[s.stage][DUMMY_HITS[s.stage].length - 1];

/**
 * How it wobbles after its last blow, a stuffed thing jarred: a swing either way that dies away, nought before the blow; and
 * as it evolves, a shake at the turn.
 */
function wobbleOf(s: Dummy, a: Anim): number {
  const act = a.act;
  if (act?.kind === 'strike') {
    const hit = lastHit(s), u = (act.t - hit) / (1 - hit);
    if (u <= 0) return 0;
    return Math.sin(u * Math.PI * 3.5) * (1 - u) ** 1.4 * smooth(u * 8);
  }
  if (act?.kind === 'evolve') return 0.6 * hump(act.t, 0.6, 0.12) * Math.sin(act.t * 60);
  return 0;
}

/* ---- its bones -------------------------------------------------------------------------- */

/** A stage's body on two legs (`BipedSpec`). Its arms are its own (`armBones`). */
const specOf = (s: Dummy): BipedSpec => ({
  high: s.leg.len[0] + s.leg.len[1] + s.leg.len[2],
  leg: { at: s.leg.at, len: s.leg.len, rest: s.leg.rest },
  chest: s.chest,
  neck: { at: s.neck.at, len: s.neck.len, lean: 0 },
  head: { pitch: s.head.pitch },
  arm: { at: s.arm.at, len: s.arm.len, rest: [0, 0, 0] },
  swing: s.gait.swing,
  waddle: Math.min(2, s.gait.waddle),
  armSwing: s.gait.armSwing,
});

/** Its arms this moment, left and right: forward, out, elbow, turned (`Hold`). */
type Arms = [[number, number, number, number], [number, number, number, number]];

const toward = (a: readonly number[], b: readonly number[], k: number): [number, number, number, number] => [0, 1, 2, 3].map((q) => lerp(a[q], b[q], k)) as [number, number, number, number];

/**
 * A stage's pose over the one a body on two legs has (`bipedBones`), and its arms: how it stands -- the Dummicub bouncing on its
 * toes, the Dummibear bobbing in its stance, the Dummititan breathing slow and heavy; its waddle; and its moves -- the strike and
 * evolving.
 */
function dummyPose(s: Dummy, p: BipedPose, a: Anim, arms: Arms): void {
  const g = smooth(a.go), w = frac(a.u), G = s.gait, t = a.t;
  const stride = p.legs.map((l) => [...l] as [number, number, number]);
  arms[0] = [...s.hold[0]];
  arms[1] = [...s.hold[1]];
  // Its head a little turned to its right and tipped, as a toy is set on a shelf to look out at the room: its face reads at three
  // quarters.
  p.head[1] -= 16;
  p.head[2] += 5;
  // Its stance, standing: the left foot ahead, the right behind, the knees bent; let go of as it walks.
  const st = 1 - g;
  p.legs[0][0] += s.stance.split * st;
  p.legs[1][0] -= s.stance.split * st;
  stride[0][0] += s.stance.split * st;
  stride[1][0] -= s.stance.split * st;
  if (a.go > 0) {
    // A plush waddle: rolled from foot to foot, the chest swinging over each, the head kept nearly level; its arms held as they
    // are, swinging a little with the stride, the Dummicub's flapping.
    const roll = g * G.waddle * Math.sin(w * TAU);
    p.chest[1] += roll;
    p.head[2] -= roll * 0.7 + p.roll;
    p.chest[0] += g * a.gait * 8;
    const sw = G.armSwing * (1 + 0.6 * a.gait) * Math.sin(w * TAU) * g;
    arms[0][0] += sw;
    arms[1][0] -= sw;
    if (s.stage === 0) {
      const flap = 10 * g * Math.sin(w * TAU * 2);
      arms[0][1] += flap;
      arms[1][1] += flap;
    }
  } else {
    // Standing. The Dummicub bounces on its toes, now and then a little hop and a wave; the Dummibear bobs in its stance and
    // now and then throws a feint; the Dummititan breathes slow and heavy and rolls its shoulders.
    const look = drift(t);
    // Only a little of the body on two legs' look about: its face is kept toward what is in front of it.
    p.head[1] -= 13 * look;
    if (s.stage === 0) {
      const hop = beat(t, [2.4, 9.6, 16.8], 0.5) * (1 - a.graze);
      p.lift += 0.12 * hop;
      const wave = beat(t, [5.0, 19.2], 1.6) * (1 - a.graze);
      arms[1][2] += 26 * wave * Math.sin(t * TAU * 3);
      arms[1][1] += 12 * wave;
      p.head[2] += 8 * cyc(t, 6);
    } else if (s.stage === 1) {
      const feint = beat(t, [4.2, 13.8, 20.4], 0.5) * (1 - a.graze);
      arms[0] = toward(arms[0], [84, 4, 18, 0], feint);
      p.chest[2] -= 10 * feint;
      p.head[2] += 4 * cyc(t, 12);
    } else {
      p.chest[0] += 2 * cyc(t, 4);
      const roll = beat(t, [7.2, 18.0], 2.2) * (1 - a.graze);
      arms[0][0] += 10 * roll;
      arms[1][0] -= 10 * roll;
      p.chest[2] += 6 * roll * Math.sin(t * TAU * 0.6);
    }
  }
  // Grazing, its arms come down to what it is at, and it munches.
  if (a.graze > 0 && !a.act) {
    arms[0] = toward(arms[0], [56, 10, 40, 0], a.graze);
    arms[1] = toward(arms[1], [56, 10, 40, 0], a.graze);
    p.jaw = a.graze * Math.max(0, Math.sin(t * TAU * 2));
  }
  const act = a.act;
  if (act?.kind === 'strike') strikePose(s, p, act.t, arms);
  else if (act?.kind === 'evolve') {
    // Evolving: drawn up tall as the light gathers, both paws flung up to it, and at the turn a shake.
    const k = act.t, up = ramp(k, 0.1, 0.45) * (1 - ramp(k, 0.62, 0.86));
    p.chest[0] -= 10 * up;
    p.head[0] += 14 * up;
    arms[0] = toward(arms[0], [16, 150, 30, 0], up);
    arms[1] = toward(arms[1], [16, 150, 30, 0], up);
    crouch(s, p, -0.1 * up);
  }
  // Every blow jars it: a squashy wobble through its body, its head nodding the other way a beat behind.
  const wob = wobbleOf(s, a);
  if (wob) {
    p.chest[1] += 7 * wob;
    p.chest[0] += 4 * wob;
    p.head[2] -= 9 * wob;
    p.head[0] -= 5 * wob;
    arms[0][1] += 10 * wob;
    arms[1][1] -= 10 * wob;
  }
  if (a.go > 0) {
    planted(s, p, stride, a);
    // Its bob: the knees giving as each foot takes its weight.
    crouch(s, p, g * G.bounce * (0.5 + 0.5 * Math.cos(w * TAU * 2 - 0.5)) * (1 - 0.4 * a.gait));
  }
  // The stance's bent knees, and the Dummibear's bob in it.
  const bob = s.stage === 1 && a.go <= 0 ? 0.08 * (0.5 + 0.5 * cyc(t, 36)) : 0;
  crouch(s, p, (s.stance.bend + bob) * st);
}

/**
 * Each stage's strike, over its pose. The Dummicub hops in and flails both paws down at what it strikes, right then left. The
 * Dummibear steps in behind a jab with its left and throws its right across after it, its body turning into the punch. The
 * Dummititan raises both paws high over its head, leaning back, and brings them down together, bowing into the slam.
 */
function strikePose(s: Dummy, p: BipedPose, t: number, arms: Arms): void {
  const H = DUMMY_HITS[s.stage];
  if (s.stage === 0) {
    const gather = ramp(t, 0.02, 0.22) * (1 - ramp(t, 0.3, 0.42));
    const hop = hump(t, 0.36, 0.12);
    const after = ramp(t, 0.6, 0.95);
    crouch(s, p, 0.5 * gather);
    p.lift += 0.3 * hop;
    p.chest[0] += -8 * gather + 16 * hump(t, 0.46, 0.16) * (1 - after);
    p.head[0] += 8 * gather - 6 * hump(t, 0.46, 0.16);
    // Both paws up high as it gathers, then each swung down and out ahead in turn, the other coming back up.
    for (const k of [0, 1] as const) {
      const up: Hold = [5, 128, 40, 90];
      const swipe = hump(t, H[k === 1 ? 0 : 1], 0.09);
      const down: Hold = [96, 18, 6, 0];
      arms[k] = toward(toward(arms[k], up, gather + (1 - gather) * ramp(t, 0.3, 0.34) * (1 - after)), down, swipe);
    }
    return;
  }
  if (s.stage === 1) {
    // The jab: the left straight out and back; the cross: the right thrown across after it, the body turned into it.
    const jab = hump(t, H[0], 0.11), cross = ramp(t, H[1] - 0.12, H[1]) * (1 - ramp(t, H[1] + 0.12, 0.84));
    const step = ramp(t, 0.04, DUMMY_GATHER[1]) * (1 - ramp(t, 0.7, 0.95));
    arms[0] = toward(arms[0], [88, 2, 6, 0], jab);
    arms[1] = toward(arms[1], [86, -14, 10, 0], cross);
    // While the right is out, the left comes back up to guard its chin.
    arms[0] = toward(arms[0], [30, 16, 120, 0], cross);
    p.chest[2] += -14 * jab + 30 * cross;
    p.chest[0] += 8 * step + 12 * cross;
    // Stepping in: the lead foot further ahead, the back one further behind.
    p.legs[0][0] += 10 * step;
    p.legs[1][0] -= 10 * step;
    p.head[1] += 8 * jab - 14 * cross;
    crouch(s, p, 0.14 * step);
    return;
  }
  const raise = ramp(t, 0.04, DUMMY_GATHER[2]) * (1 - ramp(t, H[0] - 0.12, H[0]));
  const slam = ramp(t, H[0] - 0.12, H[0]) * (1 - ramp(t, 0.76, 0.98));
  arms[0] = toward(toward(arms[0], [10, 158, 30, 0], raise), [80, 10, 12, 0], slam);
  arms[1] = toward(toward(arms[1], [10, 158, 30, 0], raise), [80, 10, 12, 0], slam);
  p.chest[0] += -12 * raise + 30 * slam;
  p.head[0] += 12 * raise - 18 * slam;
  crouch(s, p, 0.42 * slam - 0.06 * raise);
}

/**
 * The feet on the ground kept where they were put (as the Sporeling's are, `./wild-spore`): each leg on the ground has its thigh
 * turned to put its foot where an even sweep from where it came down to where it comes up would have it at this moment.
 */
function planted(s: Dummy, p: BipedPose, stride: ReadonlyArray<readonly [number, number, number]>, a: Anim): void {
  const [L1, L2] = s.leg.len, [lp, kp] = s.leg.rest;
  const amp = lerp(s.gait.swing[0], s.gait.swing[1], a.gait), g = smooth(a.go);
  stride.forEach(([sw, fold, off], i) => {
    if (off > 0 || fold > 0 || amp <= 0) return;
    const l = p.legs[i], o = l[0] - sw, f = l[1], b = (kp - 55 * f) * DEG;
    const y = (deg: number): number => L1 * Math.sin(deg * DEG) + L2 * Math.sin(deg * DEG + b);
    const at = (x: number): number => lp + o + 20 * f + x;
    const want = lerp(y(at(-amp)), y(at(amp)), (sw + amp) / (2 * amp));
    const th = thighFor(L1, L2, b, want, at(sw) * DEG) / DEG;
    l[0] = lerp(l[0], th - lp - 20 * f, g);
  });
}

/**
 * Each leg bent at the knee by `fold` more, with the thigh brought forward or back by as much more as keeps the sole where it
 * was: a crouch, or a stretch for a fold under nought, that never slides its feet over the ground.
 */
function crouch(s: Dummy, p: BipedPose, fold: number): void {
  if (!fold) return;
  const [L1, L2] = s.leg.len, [lp, kp] = s.leg.rest;
  for (const l of p.legs) {
    const a0 = (lp + l[0] + 20 * l[1]) * DEG, b0 = (kp - 55 * l[1]) * DEG;
    const y0 = L1 * Math.sin(a0) + L2 * Math.sin(a0 + b0);
    const f = Math.max(0, l[1] + fold), b = (kp - 55 * f) * DEG;
    l[0] = thighFor(L1, L2, b, y0, a0) / DEG - lp - 20 * f;
    l[1] = f;
  }
}

/** The thigh's angle (radians, forward of straight down) that puts the foot of a leg `L1` and `L2` long, its knee bent `b`, `y` ahead of the hip: of the two that do, the one nearer `near`. */
function thighFor(L1: number, L2: number, b: number, y: number, near: number): number {
  const A = L1 + L2 * Math.cos(b), B = L2 * Math.sin(b), R = Math.hypot(A, B), phi = Math.atan2(B, A);
  const k = Math.asin(clamp(y / R, -1, 1)), one = k - phi, two = Math.PI - k - phi;
  const off = (x: number): number => Math.abs(Math.atan2(Math.sin(x - near), Math.cos(x - near)));
  return off(one) <= off(two) ? one : two;
}

/**
 * The bones of a stage: a body on two legs (`bipedBones`) with its own pose over it, and its arms, which are its own: each upper
 * arm can be turned about itself before the elbow bends, so a paw can be raised up beside the head with its pads to the front,
 * which the arms of a body on two legs cannot.
 */
function dummyBones(s: Dummy): (a: Anim) => Bones {
  const spec = specOf(s);
  const arms: Arms = [[0, 0, 0, 0], [0, 0, 0, 0]];
  return (a) => {
    const act = a.act;
    const base = act && act.kind !== 'evolve' ? { ...a, graze: 0 } : a;
    const b = bipedBones(spec, base, (p) => dummyPose(s, p, a, arms));
    for (const k of [0, 1] as const) {
      const sd = k ? 1 : -1, [fw, out, el, tw] = arms[k];
      const sh = joint(b.chest, [sd * s.arm.at[0], s.arm.at[1], s.arm.at[2]], fw, -sd * out, 0);
      const up = joint(sh, [0, 0, 0], 0, 0, -sd * tw);
      const elbow = joint(up, [0, 0, -s.arm.len[0]], el);
      b[`arm${k}`] = up;
      b[`elbow${k}`] = elbow;
      // The paw turned back about the forearm as far as the arm was turned, so its pads face the way the arm was facing.
      b[`hand${k}`] = joint(elbow, [0, 0, -s.arm.len[1]], 0, 0, -sd * tw);
    }
    return b;
  };
}

/* ---- painting on a round thing -------------------------------------------------------------- */

/** A face's corners turned so it faces `out`, whichever way round they were listed. */
function facing(v: V3[], out: V3): V3[] {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < v.length; i++) {
    const p = v[i], r = v[(i + 1) % v.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return nx * out[0] + ny * out[1] + nz * out[2] < 0 ? [...v].reverse() : v;
}

/** Two directions square to `d` and to each other, for going round it. */
function across(d: V3): [V3, V3] {
  let u = cross([0, 0, 1], d);
  if (Math.hypot(u[0], u[1], u[2]) < 1e-4) u = [1, 0, 0];
  u = unit(u);
  return [u, cross(d, u)];
}

/** The direction `ang` radians off `d`, `th` round it. */
const offFrom = (d: V3, u: V3, w: V3, ang: number, th: number): V3 =>
  add(scale(d, Math.cos(ang)), scale(add(scale(u, Math.cos(th)), scale(w, Math.sin(th))), Math.sin(ang)));

/** Where a direction out of the middle of an egg meets its shell, lifted off it by `lift`. */
const onShell = (c: V3, r: V3, dir: V3, lift: number): V3 => {
  const e = onEgg(c, r, dir);
  return add(e.p, scale(e.n, lift));
};

/** A round patch painted on an egg, `ang` radians across from its middle along `d`: a ring of a target, a cheek. */
function patch(c: V3, r: V3, d: V3, ang: number, sides: number, m: Mat, lift = 0.02): Disc {
  const D = unit(d), [u, w] = across(D);
  const v = Array.from({ length: sides }, (_, j) => onShell(c, r, offFrom(D, u, w, ang, (j / sides) * TAU), lift));
  return { v: facing(v, D), m };
}

/** Stitches across the edge of a round patch: `count` short dashes over the ring `ang` radians from its middle. */
function stitches(c: V3, r: V3, d: V3, ang: number, count: number, len: number, m: Mat, lift = 0.03): Disc[] {
  const D = unit(d), [u, w] = across(D), wide = len * 0.22;
  return Array.from({ length: count }, (_, q) => {
    const th = (q / count) * TAU + 0.2;
    const v = [[-len, -wide], [len, -wide], [len, wide], [-len, wide]].map(([da, dt]) => onShell(c, r, offFrom(D, u, w, ang + da, th + dt / Math.max(0.2, Math.sin(ang))), lift));
    return { v: facing(v, offFrom(D, u, w, ang, th)), m };
  });
}

/** A patch on an egg outlined by directions given as [yaw, pitch] pairs (radians): yaw round from the front, pitch up from level. */
function shaped(c: V3, r: V3, outline: ReadonlyArray<readonly [number, number]>, m: Mat, lift = 0.02): Disc {
  const dir = (y: number, p: number): V3 => [Math.sin(y) * Math.cos(p), Math.cos(y) * Math.cos(p), Math.sin(p)];
  const v = outline.map(([y, p]) => onShell(c, r, dir(y, p), lift));
  const mid = outline.reduce((acc, [y, p]) => add(acc, dir(y, p)), [0, 0, 0] as V3);
  return { v: facing(v, unit(mid)), m };
}

/** A flat cross stitched on: two thin bars crossed, centred at `c` on a surface facing `n`, `r` from the middle to each end. */
function crossStitch(c: V3, n: V3, r: number, m: Mat): Disc[] {
  const N = unit(n), [u, w] = across(N), th = r * 0.2;
  return [1, -1].map((sg) => {
    const a = unit(add(u, scale(w, sg))), b = unit(add(scale(u, -sg), w));
    const v = [add(c, add(scale(a, -r), scale(b, -th))), add(c, add(scale(a, r), scale(b, -th))), add(c, add(scale(a, r), scale(b, th))), add(c, add(scale(a, -r), scale(b, th)))]
      .map((p) => add(p, scale(N, 0.02)));
    return { v: facing(v, N), m };
  });
}

/* ---- the head ------------------------------------------------------------------------------- */

/**
 * The head: a round egg; a cream muzzle low at its front with a dark nose on it, and a grin (the Dummicub's open, the others' a
 * stitched smile); a blush on each cheek; dark eyes set wide over the muzzle; and a cream blaze up its forehead with a dark brown
 * stripe down it, stitched at its edges.
 */
function headOf(s: Dummy, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, c = H.c, r = H.r;
  const skull = orb(c, r, n + 2, k + 1, 'coat');
  const mc = add(c, [0, r[1] * 0.7, -r[2] * 0.28]), mr: V3 = [r[0] * 0.52, r[1] * 0.32, r[2] * 0.4];
  const muzzle = orbAlong(mc, [0, 1, -0.1], mr, n, k, 'muzzle');
  const nose = orbAlong(add(c, [0, r[1] * 1.0, -r[2] * 0.06]), [0, 1, 0.3], [r[0] * 0.17, r[1] * 0.11, r[2] * 0.12], 7, 3, 'nose');
  const mouth = H.open
    ? paint([
      disc(add(c, [0, r[1] * 1.03, -r[2] * 0.3]), [0, 1, -0.3], r[0] * 0.15, r[2] * 0.13, 9, 'lid', { spin: 0.18 }),
      disc(add(c, [0, r[1] * 1.045, -r[2] * 0.35]), [0, 1, -0.3], r[0] * 0.09, r[2] * 0.065, 7, 'tongue'),
    ])
    : smile(add(c, [0, r[1] * 1.04, -r[2] * 0.25]), [0, 1, -0.25], r[0] * 0.26, 'lid');
  const cheeks = blush(c, r, [0.62, 0.7, -0.1], r[0] * 0.15);
  // The blaze: cream up from between the eyes over the crown, the stripe down its middle, and stitches along each edge.
  const blaze = paint([
    shaped(c, r, [[-0.2, 0.5], [-0.3, 0.8], [-0.24, 1.1], [0, 1.2], [0.24, 1.1], [0.3, 0.8], [0.2, 0.5], [0, 0.44]], 'muzzle', 0.015),
    shaped(c, r, [[-0.07, 0.52], [-0.11, 0.8], [-0.08, 1.12], [0, 1.2], [0.08, 1.12], [0.11, 0.8], [0.07, 0.52], [0, 0.48]], 'bark', 0.02),
    ...[-1, 1].flatMap((sd) => [0.64, 0.92].map((pt) => shaped(c, r, [[sd * 0.27 - 0.02, pt - 0.04], [sd * 0.27 + 0.02, pt - 0.04], [sd * 0.27 + 0.02, pt + 0.04], [sd * 0.27 - 0.02, pt + 0.04]], 'claw', 0.025))),
  ]);
  const look = eyes(c, r, [0.44, 0.8, 0.32], H.eye, { tall: 1.2, shut, glint: 0.42 });
  return merge(skull, muzzle, nose, mouth, cheeks, blaze, look);
}

/** A round ear, flat and dark inside, built facing forward at its own middle. */
function earOf(e: number, n: number): Mesh {
  return merge(
    orb([0, 0, 0], [e, e * 0.42, e * 0.95], n, 4, 'coat'),
    paint([disc([0, e * 0.43, -e * 0.06], [0, 1, 0], e * 0.6, e * 0.56, 9, 'pad')]),
  );
}

/* ---- the body ------------------------------------------------------------------------------- */

/**
 * Everything laid on the egg of the body drawn in toward its top as the body is, a pear rather than an egg: its sides in, round
 * its middle, by more the higher it is over its widest.
 */
function peared(s: Dummy, m: Mesh): Mesh {
  const T = s.torso;
  return mesh(m.v.map((p) => {
    const u = clamp((p[2] - T.c[2]) / T.r[2], 0, 1.3), k = 1 - T.pear * u * u;
    return [p[0] * k, T.c[1] + (p[1] - T.c[1]) * k, p[2]] as V3;
  }), m.f);
}

/** The belly: the egg of the body, a cream patch on its front, and the target on that, ringed pink and cream and stitched round. */
function bodyOf(s: Dummy, n: number, k: number): Mesh {
  const T = s.torso, d: V3 = [0, 1, -0.08], A = s.target;
  const rings = [1, 0.78, 0.56, 0.35, 0.16].map((f, q) => patch(T.c, T.r, d, A * f, 18, q % 2 ? 'coatLight' : 'mark', 0.015 + q * 0.004));
  return merge(
    orb(T.c, T.r, n + 4, k + 2, 'coat'),
    paint([
      patch(T.c, T.r, d, A * 1.3, 18, 'belly', 0.01),
      ...rings,
      ...stitches(T.c, T.r, d, A * 1.3, 18, 0.05, 'claw'),
      ...stitches(T.c, T.r, d, A * 1.0, 16, 0.04, 'claw', 0.04),
    ]),
  );
}

/** How far into the egg of the body a stage's body is squashed this moment, its wobble: down and out, or up and in. */
const squashOf = (s: Dummy, a: Anim): number => 0.09 * wobbleOf(s, a) + (s.stage === 0 && a.go <= 0 ? 0.03 * beat(a.t, [2.4, 9.6, 16.8], 0.5) : 0);

/** Its body squashed about the bottom of its belly: shorter and fatter, or taller and thinner. */
const squashed = (s: Dummy): ((v: readonly V3[], a: Anim) => V3[]) => {
  const base = s.torso.c[2] - s.torso.r[2] * 0.8;
  return (v, a) => {
    const q = squashOf(s, a);
    if (!q) return v as V3[];
    return v.map((p) => [p[0] * (1 + q * 0.6), p[1] * (1 + q * 0.4), base + (p[2] - base) * (1 - q)]);
  };
};

/** A length of rope along a line of points: a thin tube, its twists picked out in two shades. */
function rope(pts: readonly V3[], w: number): Mesh {
  return tube(pts, w, w, 5, (ring) => (ring % 2 ? 'lace' : 'string'));
}

/** A loop of rope round the body: a circle on the egg of it, in the plane of `a` and `b`, lying on it. */
function ropeLoop(s: Dummy, a: V3, b: V3, w: number, steps: number, from = 0, to = TAU): Mesh {
  const T = s.torso, A = unit(a), B = unit(b);
  const pts = Array.from({ length: steps + 1 }, (_, q) => {
    const th = from + ((to - from) * q) / steps;
    return onShell(T.c, T.r, add(scale(A, Math.cos(th)), scale(B, Math.sin(th))), w * 0.6);
  });
  return rope(pts, w);
}

/** Where round the base of its neck, on the egg of the body a little under where the head sits on it, `yaw` round from the front: the collar of leaves and the rope under it. */
function neckAt(s: Dummy): (yaw: number, lift: number) => { p: V3; n: V3 } {
  const T = s.torso, elev = Math.asin(clamp((s.neck.at[2] - 0.1 * (1 + s.stage) - T.c[2]) / T.r[2], -0.99, 0.99));
  return (yaw, lift) => {
    const e = onEgg(T.c, T.r, [Math.sin(yaw) * Math.cos(elev), Math.cos(yaw) * Math.cos(elev), Math.sin(elev)]);
    return { p: add(e.p, scale(e.n, lift)), n: e.n };
  };
}

/**
 * The rope: round its neck under the leaves, and over its right shoulder and down its side (the Dummibear) or over both
 * (the Dummititan), clear of the target.
 */
function ropeOf(s: Dummy): Mesh | null {
  if (!s.rope) return null;
  const w = 0.05 + 0.02 * s.stage, at = neckAt(s);
  const neck = rope(Array.from({ length: 19 }, (_, q) => at((q / 18) * TAU, w * 0.6).p), w);
  // Over the shoulder and down its side, clear of the target on its belly.
  // From its back over the shoulder and down its front at the side to its waist, where it is tucked in.
  const side = (sd: number): Mesh => ropeLoop(s, [sd * 0.2, 0, 1], [sd * 0.92, 0.38, 0], w, 18, -0.45 * Math.PI, 0.62 * Math.PI);
  return s.rope === 1 ? merge(neck, side(1)) : merge(neck, side(-1), side(1));
}

/** A strand of straw: a narrow blade from `root` along `dir`, `len` long, its face toward `face`. */
function straw(root: V3, dir: V3, face: V3, len: number, wide: number, i: number): Mesh {
  const D = unit(dir), bend: V3 = [0, 0, -0.18 * len];
  const pts: V3[] = [root, add(add(root, scale(D, len * 0.5)), scale(bend, 0.3)), add(add(root, scale(D, len)), bend)];
  const pale = jitter(i * 5 + 2) < 0.3;
  return blade(pts, [wide, wide * 0.85, wide * 0.3], face, { mat: pale ? 'shell' : 'feather', rib: 'shell', thick: 0.02, fold: 0.15 });
}

/** A leaf: a blade from `root` along `dir`, green with a darker rib, or pink. */
function leaf(root: V3, dir: V3, face: V3, len: number, w: number, pink: boolean): Mesh {
  const D = unit(dir);
  const pts: V3[] = [root, add(root, scale(D, len * 0.3)), add(root, scale(D, len * 0.7)), add(root, scale(D, len))];
  return blade(pts, [w * 0.25, w, w * 0.8, w * 0.1], face, { mat: pink ? 'petal' : 'leaf', rib: pink ? 'bloom' : 'leafDark', thick: 0.025, fold: 0.25 });
}

/** The straw over its shoulders, row by row: strands standing out of the egg of the body and hanging down, all round its back and as far round its front as the row comes. */
function mantleOf(s: Dummy, K: number): Mesh {
  const T = s.torso;
  const out: Mesh[] = [];
  s.mantle.forEach(([count, len, droop, z, round], row) => {
    for (let q = 0; q < count; q++) {
      const i = row * 40 + q;
      // Round from the back (yaw π) both ways, as far as the row comes round the front.
      const u = (q + 0.5 * (row % 2)) / count, yaw = Math.PI + (u - 0.5) * 2 * Math.PI * round + (jitter(i) - 0.5) * 0.12;
      const elev = Math.asin(clamp((z - T.c[2]) / T.r[2], -0.99, 0.99));
      const dir: V3 = [Math.sin(yaw) * Math.cos(elev), Math.cos(yaw) * Math.cos(elev), Math.sin(elev)];
      const e = onEgg(T.c, scale(T.r, 1.02), dir);
      const n = e.n, hang = unit(add(scale(n, 1 - droop), [0, 0, -droop * 1.2]));
      const L = len * (0.82 + 0.36 * jitter(i + 3));
      out.push(straw(e.p, hang, n, L, [0.08, 0.13, 0.17][s.stage], i));
    }
  });
  void K;
  return merge(...out);
}

/** The straw skirt at its waist, on the hips: rows of strands hanging round it, and green leaves along its top, one pink. */
function skirtOf(s: Dummy): Mesh {
  const out: Mesh[] = [];
  const R: V3 = [s.hips[0] * 1.08, s.hips[1] * 1.12, s.hips[2]];
  s.skirt.forEach(([count, len, droop, z], row) => {
    for (let q = 0; q < count; q++) {
      const i = 300 + row * 40 + q;
      const yaw = ((q + 0.5 * (row % 2)) / count) * TAU + (jitter(i) - 0.5) * 0.1;
      const out2: V3 = [Math.sin(yaw), Math.cos(yaw), 0];
      const root: V3 = [out2[0] * R[0], out2[1] * R[1], z];
      const hang = unit(add(scale(out2, 1 - droop), [0, 0, -droop * 1.3]));
      out.push(straw(root, hang, out2, len * (0.85 + 0.3 * jitter(i + 1)), 0.15, i));
    }
  });
  // Leaves along the top of it.
  const top = s.skirt[0]?.[3] ?? 0;
  for (let q = 0; q < 12; q++) {
    const yaw = (q / 12) * TAU + 0.15, o: V3 = [Math.sin(yaw), Math.cos(yaw), 0];
    const root: V3 = [o[0] * R[0] * 1.02, o[1] * R[1] * 1.02, top + 0.08];
    out.push(leaf(root, unit(add(o, [0, 0, -0.55])), add(o, [0, 0, 0.6]), 0.4, 0.15, q === 2));
  }
  return merge(...out);
}

/** The collar of leaves round its neck, standing out and lying down over its shoulders, one of them pink. */
function collarOf(s: Dummy): Mesh {
  const C = s.collar, at = neckAt(s);
  const out: Mesh[] = [];
  for (let q = 0; q < C.count; q++) {
    // Round the front and the sides, and thinner at the back, which is under the head.
    const yaw = ((q + 0.5) / C.count - 0.5) * TAU * 0.62;
    const e = at(yaw, 0.03);
    const pink = q === Math.floor(C.count / 2);
    out.push(leaf(e.p, unit(add(e.n, [0, 0, -0.5])), e.n, C.len * (pink ? 1.1 : 0.9 + 0.2 * jitter(q + 40)), C.w, pink));
  }
  return merge(...out);
}

/* ---- the limbs ------------------------------------------------------------------------------ */

/**
 * A limb: a tube down its bone `len` long from `w0` across to `w1`, in bands: cream and caramel by turns; or, wrapped, pink cloth
 * over the middle of it, a little proud of it, a cross stitched on its front.
 */
function limbOf(len: number, w0: number, w1: number, n: number, o: { bands: number; wrap?: boolean; top?: number; side?: boolean }): Mesh {
  const top = o.top ?? 0.08;
  const B = Math.max(1, o.bands);
  const zs = [top, ...Array.from({ length: B }, (_, q) => -len * ((q + 1) / B))];
  const ws = zs.map((z) => lerp(w0, w1, clamp(-z / len)));
  if (o.wrap) {
    // The wrap over the middle rings, standing a little proud.
    const pts: V3[] = [];
    const wd: number[] = [];
    const rings = [top, -len * 0.14, -len * 0.18, -len * 0.5, -len * 0.82, -len * 0.86, -len];
    rings.forEach((z, q) => {
      pts.push([0, 0, z]);
      const ww = lerp(w0, w1, clamp(-z / len));
      wd.push(q >= 2 && q <= 4 ? ww * 1.1 : ww);
    });
    const body = tube(pts, wd, wd, n, (ring) => (ring >= 2 && ring <= 3 ? 'cloth' : ring === 1 || ring === 4 ? 'clothDark' : ring === 0 ? 'coat' : 'coatLight'), { seam: 'both' });
    const mid = -len * 0.5, wm = lerp(w0, w1, 0.5) * 1.1;
    return merge(body, paint([...crossStitch([0, wm, mid], [0, 1, 0], wm * 0.55, 'string'), ...(o.side === false ? [] : crossStitch([wm, 0, mid], [1, 0, 0], wm * 0.55, 'string'))]));
  }
  return tube(zs.map((z) => [0, 0, z] as V3), ws, ws, n, (ring) => (ring % 2 ? 'coatLight' : 'coat'), { seam: 'both' });
}

/** A paw: a soft round mitt, a dark pad on its palm and four dark toe beans over it. */
function pawOf(r: number, n: number): Mesh {
  const c: V3 = [0, 0, -r * 0.75], R: V3 = [r, r * 0.82, r * 1.05];
  const palm: V3 = [0, -1, -0.15];
  const beans = [-0.5, -0.17, 0.17, 0.5].map((x) => disc(onShell(c, R, [x * 0.9, -1, -0.95 + Math.abs(x) * 0.35], 0.01), unit([x * 0.9, -1, -0.95 + Math.abs(x) * 0.35]), r * 0.17, r * 0.19, 7, 'pad'));
  return merge(
    orb(c, R, n, 5, 'coat'),
    paint([disc(onShell(c, R, palm, 0.01), palm, r * 0.48, r * 0.44, 9, 'pad'), ...beans]),
  );
}

/** A foot: a big padded lump forward of the ankle, its sole on the ground, and four dark toe beans round its front. */
function footOf(w: number, len: number, sole: number, n: number): Mesh {
  const c: V3 = [0, len * 0.3, -sole * 0.35], R: V3 = [w, len * 0.62, sole * 0.65 + w * 0.15];
  const lump = orb(c, R, n, 5, 'coat');
  // Squashed flat underneath, so it stands on its sole.
  const flat = mesh(lump.v.map((p) => [p[0], p[1], Math.max(p[2], -sole)] as V3), lump.f);
  const beans = [-0.55, -0.2, 0.2, 0.55].map((x) => {
    const d = unit([x, 1, -0.05]);
    return disc(onShell(c, R, d, 0.01), d, w * 0.19, w * 0.21, 7, 'pad');
  });
  return merge(flat, paint(beans));
}

/** Its arms and legs. */
function limbs(s: Dummy, n: number): Piece[] {
  const out: Piece[] = [];
  const A = s.arm, L = s.leg;
  for (const [k, sd] of [[0, -1], [1, 1]] as Array<[number, number]>) {
    const front: V3 = [sd, 0.35, 0];
    const paw = pawOf(A.paw, n);
    out.push(
      { key: `arm${k}`, mesh: limbOf(A.len[0], A.w[0], A.w[0] * 0.95, n, { bands: 3, top: 0.12 }), bone: `arm${k}`, bias: 0.03, after: 'body', front, convex: true },
      { key: `fore${k}`, mesh: limbOf(A.len[1], A.w[1] * 0.95, A.w[1], n, { bands: 3, wrap: s.wraps, top: 0.06 }), bone: `elbow${k}`, bias: 0.035, after: 'body', front, convex: true },
      { key: `hand${k}`, mesh: paw, bone: `hand${k}`, bias: 0.04, after: ['body', `fore${k}`, 'collar', 'mantle'], front },
    );
  }
  for (const [key, sd] of [['ll', -1], ['lr', 1]] as Array<[string, number]>) {
    const front: V3 = [sd * 0.8, 0.5, 0];
    const foot = footOf(L.w[1] * 1.12, L.foot, L.len[2], n);
    // The Dummibear's legs kept plain under the patch on its knee: one wrap on each shin, one cross on its front.
    const plain = s.stage === 1;
    const shin = limbOf(L.len[1], L.w[1], L.w[1] * 0.92, n, { bands: 2, wrap: s.wraps, top: 0.05, side: !plain });
    // The Dummibear's patch on its left knee.
    const knee = s.knee && sd < 0 ? paint([
      disc([0, L.w[1] * 1.08, -0.02], [0, 1, 0.25], L.w[1] * 0.62, L.w[1] * 0.58, 10, 'cloth'),
      ...crossStitch([0, L.w[1] * 1.1, -0.02], [0, 1, 0.25], L.w[1] * 0.32, 'string'),
    ]) : null;
    out.push(
      { key: `${key}0`, mesh: merge(
        limbOf(L.len[0], L.w[0], L.w[1] * 1.05, n, { bands: plain ? 1 : 3, top: 0.14 }),
        orbAlong([0, 0.02, -L.len[0] * 0.3], [0, 0, 1], [L.w[0] * 1.06, L.w[0] * 1.1, L.len[0] * 0.5 + L.w[0] * 0.3], n, 4, 'coat'),
      ), bone: `${key}0`, bias: 0.01, after: ['body', 'hips'], front },
      { key: `${key}1`, mesh: merge(shin, knee), bone: `${key}1`, bias: 0.015, after: 'body', front, convex: true },
      { key: `${key}2`, mesh: foot, bone: `${key}2`, bias: 0.02, after: 'body', front },
    );
  }
  return out;
}

/** A stage's pieces. */
function dummyBuild(s: Dummy, lod: number): Piece[] {
  const n = cut(lod, 8, 11), k = cut(lod, 5, 6), K = lod ? 7 : 4;
  const T = s.torso, H = s.head;
  // Drawn in toward its top as the body is (`peared`), so what stands on its shoulders is not hidden inside it.
  const torsoSolid = { c: T.c, r: [T.r[0] * 0.94 * (1 - T.pear * 0.6), T.r[1] * 0.94 * (1 - T.pear * 0.6), T.r[2] * 0.94] as V3 };
  const headSolid = { c: H.c, r: scale(H.r, 0.72) };
  const ear = earOf(H.ear, n);
  const ears = [-1, 1].map((sd) => moved(ear, add(H.c, [sd * H.r[0] * 0.66, -H.r[1] * 0.1, H.r[2] * 0.74]), -sd * 18, 0, sd * 24));
  const pieces: Piece[] = [
    { key: 'hips', mesh: orb([0, 0, 0], s.hips, n + 2, k + 1, 'coat'), bone: 'body', bias: 0 },
    { key: 'body', mesh: peared(s, bodyOf(s, n, k)), bone: 'chest', bias: 0.005, breathes: { c: T.c, k: 0.035 }, bent: squashed(s) },
    { key: 'head', mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), bone: 'head', bias: 0.2, hide: [headSolid] },
    { key: 'ear0', mesh: ears[0], bone: 'head', bias: 0.19, hide: [headSolid] },
    { key: 'ear1', mesh: ears[1], bone: 'head', bias: 0.19, hide: [headSolid] },
    { key: 'collar', mesh: peared(s, collarOf(s)), bone: 'chest', bias: 0.09, after: ['body', 'mantle', 'rope'], hide: [torsoSolid], thin: true, lines: false, bent: squashed(s) },
    { key: 'tail0', mesh: orb([0, -s.hips[1] * 0.92, -s.hips[2] * 0.1], s.hips[0] * 0.24, n, 4, 'coatLight'), bone: 'body', bias: -0.02 },
    ...limbs(s, n),
  ];
  const r = ropeOf(s);
  if (r) pieces.push({ key: 'rope', mesh: peared(s, r), bone: 'chest', bias: 0.07, after: ['body'], hide: [torsoSolid], bent: squashed(s) });
  if (s.mantle.length) pieces.push({ key: 'mantle', mesh: peared(s, mantleOf(s, K)), bone: 'chest', bias: 0.08, after: ['body', 'arm0', 'arm1', 'rope'], hide: [torsoSolid], thin: true, lines: false, bent: squashed(s) });
  if (s.skirt.length) pieces.push({ key: 'skirt', mesh: skirtOf(s), bone: 'body', bias: 0.06, after: ['hips', 'body', 'll0', 'lr0', 'tail0'], hide: [{ c: [0, 0, 0] as V3, r: scale(s.hips, 0.95) }, { c: add(s.chest.at, T.c), r: torsoSolid.r }], thin: true, lines: false });
  return pieces;
}

/* ---- the straw it sheds --------------------------------------------------------------------- */

const STRAW: RGB = [232, 196, 120];
const STRAW_DARK: RGB = [196, 150, 84];
const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
/** Where something thrown from `p` with velocity `v` is `s` seconds on, falling slowly, as straw does; it lies where it lands. */
const thrown = (p: V3, v: V3, s: number, fall = 9): V3 => [p[0] + v[0] * s, p[1] + v[1] * s, Math.max(0.03, p[2] + v[2] * s - 0.5 * fall * s * s)];
/** Whether a point is on the viewer's side of a body whose middle is at `c`. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;

/**
 * Straw puffed out of it at each blow: wisps flung out of its body and its paw, turning as they fall; the more of them the bigger
 * it is. Drawn as two strokes, a pale and a darker, over the body for those on the viewer's side of it and under it for the rest.
 */
function strawBurst(g: CanvasRenderingContext2D, view: View, s: Dummy, b: Bones, t: number, front: boolean): void {
  const T = s.torso, mid = place(b.chest, T.c), big = [0.8, 1.05, 1.35][s.stage];
  const fade = 1 - ramp(t, 0.72, 1);
  if (fade <= 0) return;
  const paths = [new Path2D(), new Path2D()];
  DUMMY_HITS[s.stage].forEach((hit, h) => {
    const since = (t - hit) * ACT_SECS.strike;
    if (since < 0) return;
    const count = [7, 8, 14][s.stage];
    for (let q = 0; q < count; q++) {
      const i = h * 31 + q;
      const th = (q / count) * TAU + jitter(i) * 0.6, sp = (1.4 + 1.6 * jitter(i + 3)) * big;
      // Out of the front of its belly, and up over its shoulders.
      const from = onShell(T.c, T.r, [Math.cos(th) * 0.8, 0.7, Math.sin(th) * 0.8], 0.05);
      const p = thrown(place(b.chest, from), [Math.cos(th) * sp, 0.6 * sp, (1.6 + 2.4 * jitter(i + 7)) * big], since, 6);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      const ang = th + since * (6 + 6 * jitter(i + 1)), l = (0.32 + 0.2 * jitter(i + 2)) * big;
      const path = paths[q % 2];
      path.moveTo(x - Math.cos(ang) * l, y - Math.sin(ang) * l);
      path.lineTo(x + Math.cos(ang) * l, y + Math.sin(ang) * l);
    }
  });
  g.lineCap = 'round';
  g.lineWidth = 0.13 * big;
  g.strokeStyle = css(STRAW, 0.95 * fade);
  g.stroke(paths[0]);
  g.strokeStyle = css(STRAW_DARK, 0.95 * fade);
  g.stroke(paths[1]);
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and the straw it sheds as it strikes. */
function dummyKind(s: Dummy): Kind {
  const bones = dummyBones(s);
  return {
    bones,
    build: (lod) => dummyBuild(s, lod),
    // The variant's coat is its straw-fur, a little warmed; its markings the pink of its target and its wraps. The cream of its
    // patches and bands, its dark pads, its leaves and its rope are the same on every variant.
    palette: (coat, mark) => {
      const fur = mix(coat, [250, 236, 210], 0.12);
      const cream: RGB = mix([250, 238, 214], fur, 0.12);
      const pink = mix(mark, [255, 240, 236], 0.08);
      return coatPalette(coat, mark, {
        coat: fur,
        coatDark: darker(fur, 0.22),
        coatLight: cream,
        muzzle: lighter(cream, 0.2),
        belly: cream,
        mark: pink,
        cloth: mix(pink, fur, 0.12),
        clothDark: darker(mix(pink, fur, 0.12), 0.16),
        pad: [104, 66, 52],
        nose: [78, 50, 44],
        lid: [86, 52, 46],
        eye: [50, 32, 30],
        inner: mix([238, 140, 140], pink, 0.3),
        tongue: [232, 120, 128],
        bark: [128, 86, 60],
        claw: mix(fur, [80, 52, 40], 0.55),
        feather: mix(fur, [242, 214, 146], 0.75),
        featherDark: mix(fur, [214, 176, 108], 0.6),
        shell: mix(fur, [252, 236, 186], 0.8),
        string: [214, 184, 128],
        lace: [170, 136, 88],
        leaf: [150, 194, 112],
        leafDark: [120, 164, 90],
        petal: mix([236, 140, 150], pink, 0.3),
        bloom: darker(mix([236, 140, 150], pink, 0.3), 0.15),
      }, 30);
    },
    shadow: [[0.9, 1.3, 1.75][s.stage], [0.85, 1.1, 1.45][s.stage]],
    stride: 1.4,
    size: s.size,
    blinks: 4,
    acts: ['strike'],
    // Evolving, the motes rising round it are straw and the pink of its target.
    motes: [STRAW, [240, 150, 160]],
    extra: (g, view, b, a, under) => {
      if (a.act?.kind === 'strike') strawBurst(g, view, s, b, a.act.t, !under);
    },
  };
}

export const DUMMICUB = dummyKind(DUMMICUB_LOOK);
export const DUMMIBEAR = dummyKind(DUMMIBEAR_LOOK);
export const DUMMITITAN = dummyKind(DUMMITITAN_LOOK);
