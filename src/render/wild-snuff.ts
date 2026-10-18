import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, DEG, disc, dot, frac, lerp, merge, mix, orb, orbAlong, paint, quadBonesOf, scale,
  smooth, step, sub, TAU, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece, type QuadPose, type QuadSpec,
} from './beasts';
import { cut, quadPieces } from './beastkit';
import { joint, mesh, onScreen, place, type Face, type Mat, type Mesh, type RGB, type V3, type View } from './figure';
import { trot } from './wild-paws';

/**
 * The snuff line: the Snufflet, a leafy piglet, which grows into the
 * Snuffroot, a long-legged young boar, and then the Snuffthorn, a heavy boar
 * with tusks. The species is still `rabba` underneath, as saves and the
 * database know it.
 *
 * Each is a cream pig with soft pink patches: a boar's wedge of a head with
 * full cheeks, a muzzle ending in a pink snout and small warm eyes; a big
 * pointed ear each side, pink inside; cloven hooves under a cuff of leaves;
 * and a mane of overlapping leaves puffed round its neck and swept back over
 * its shoulders, with small white flowers in it, which grows bigger and
 * wilder at each stage and in the last cascades on down its back. All three
 * are built by one set of functions from a description of the stage
 * (`Snuff`), so a stage is its numbers.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Snuff {
  /** The barrel's rings, rump to chest: where each is along the body and how high, how wide and how deep. */
  body: { y: number[]; z: number[]; w: number[]; h: number[] };
  /** Shoulder to hip, and the legs: how long, how thick at the top, and how tall the hoof is. */
  len: number;
  legs: number;
  thick: number;
  hoof: number;
  /** The neck's root on the body, its length, width and how far forward of upright it is carried (degrees). */
  neck: { at: V3; len: number; w: number; lean: number };
  /**
   * The head's rings in its own frame, from the back of the skull to the end of the snout: where each is along it and how
   * high, how wide and how deep. The widest are the cheeks; from the eyes on it narrows into the muzzle, and the last three
   * are the snout, pink. How far its nose is carried up, in degrees.
   */
  head: { y: number[]; z: number[]; w: number[]; h: number[]; pitch: number };
  /** The eyes: how far along the head, how far up its side from level (radians), how big across, and how heavy a ridge of brow is over each (nought for a piglet's smooth brow). */
  eye: { y: number; up: number; size: number; brow: number };
  /** Each ear: its length and width, and how far it is splayed out and laid back (degrees). */
  ear: { len: number; w: number; out: number; back: number };
  /** The mane's rows, front to back: how many leaves in each, how long they are, and how far back they are swept (degrees). */
  ruff: Array<[number, number, number]>;
  /** How far the leaves down its sides hang down rather than standing out. */
  hang: number;
  /** Pairs of leaves cascading down the back behind the mane: how many, and the longest. */
  back: [number, number];
  /** Leaves standing up on the crown between the ears: how many, how long, and how wide they are fanned. */
  crest: [number, number, number];
  /** Flowers in the mane down each side, on the crown, and along the ridge of the back. */
  flowers: [number, number, number];
  /** How long the leaves of the tail's tuft are, and of the cuffs round the lower legs. */
  tail: number;
  cuff: number;
  /** How big its tusks are; nought for none. */
  tusk: number;
  /** How far it hooks its head up at the end of a strike, in degrees. */
  toss: number;
  /** How wild the mane is: how much longer the leaves over the nape stand, and how far up they point. */
  wild: number;
  /** How it goes: a trot at a walk too or a four-beat walk, how much it bounces and nods, and how far its legs swing at a walk and a run. */
  gait: { trot: boolean; bounce: number; nod: number; swing: [number, number] };
  size: number;
}

/** A Snufflet: a round little piglet with a domed head too big for it, big eyes, the shortest snout, short legs, and a wide puff of leaves round its neck. */
const SNUFFLET_LOOK: Snuff = {
  body: { y: [-1.12, -0.96, -0.52, 0.08, 0.6, 0.92, 1.06], z: [0.14, 0.12, 0.1, 0.1, 0.12, 0.16, 0.18], w: [0.45, 0.8, 0.92, 0.94, 0.9, 0.78, 0.34], h: [0.42, 0.74, 0.84, 0.86, 0.84, 0.74, 0.32] },
  len: 2.0, legs: 0.78, thick: 0.26, hoof: 0.15,
  neck: { at: [0, 0.82, 0.2], len: 0.36, w: 0.64, lean: 40 },
  head: {
    y: [-0.48, -0.3, 0.05, 0.42, 0.68, 0.86, 0.96, 1.1, 1.15], z: [0.38, 0.38, 0.32, 0.22, 0.13, 0.07, 0.06, 0.05, 0.05],
    w: [0.3, 0.72, 0.86, 0.72, 0.5, 0.36, 0.35, 0.31, 0.26], h: [0.32, 0.8, 0.88, 0.66, 0.46, 0.34, 0.32, 0.29, 0.24], pitch: -2,
  },
  eye: { y: 0.4, up: 0.3, size: 0.16, brow: 0 },
  ear: { len: 1.2, w: 0.5, out: 55, back: 22 },
  ruff: [[22, 0.82, 14], [22, 0.92, 28], [20, 0.8, 44]],
  hang: 0.3,
  back: [0, 0],
  crest: [4, 0.5, 1],
  flowers: [1, 1, 0],
  tail: 0.5,
  cuff: 0.3,
  tusk: 0,
  toss: 0,
  wild: 0.1,
  gait: { trot: true, bounce: 0.06, nod: 4, swing: [24, 38] },
  size: 1.55,
};

/** A Snuffroot: a young boar, longer in the leg and the body, its head carried higher on a longer muzzle, and the mane swept back over its shoulders. */
const SNUFFROOT_LOOK: Snuff = {
  body: { y: [-1.56, -1.36, -0.76, 0, 0.76, 1.3, 1.5], z: [0.16, 0.12, 0.1, 0.1, 0.14, 0.2, 0.22], w: [0.5, 0.86, 1.0, 1.02, 1.04, 0.92, 0.4], h: [0.46, 0.75, 0.86, 0.88, 0.9, 0.84, 0.4] },
  len: 2.7, legs: 1.35, thick: 0.37, hoof: 0.18,
  neck: { at: [0, 1.22, 0.26], len: 0.46, w: 0.72, lean: 36 },
  head: {
    y: [-0.45, -0.28, 0.05, 0.42, 0.82, 1.18, 1.34, 1.5, 1.55], z: [0.34, 0.32, 0.26, 0.2, 0.1, 0.02, 0.0, -0.01, -0.01],
    w: [0.28, 0.66, 0.8, 0.64, 0.44, 0.33, 0.32, 0.28, 0.23], h: [0.28, 0.68, 0.74, 0.58, 0.42, 0.31, 0.3, 0.27, 0.22], pitch: 2,
  },
  eye: { y: 0.44, up: 0.3, size: 0.145, brow: 0.7 },
  ear: { len: 1.5, w: 0.6, out: 55, back: 30 },
  ruff: [[24, 0.82, 14], [24, 0.92, 28], [26, 1.05, 46], [26, 1.1, 50], [24, 1.1, 54]],
  hang: 0.5,
  back: [0, 0],
  crest: [5, 0.62, 1.4],
  flowers: [2, 1, 0],
  tail: 0.55,
  cuff: 0.36,
  tusk: 0,
  toss: 20,
  wild: 0.35,
  gait: { trot: true, bounce: 0.045, nod: 3, swing: [22, 34] },
  size: 1.72,
};

/**
 * A Snuffthorn: a big heavy boar, deep and broad in the chest and humped at the shoulder, its head carried high on the
 * longest, heaviest muzzle and deepest jaw, a stubby crescent tusk each side, and a huge mane of leaves standing up over its
 * withers, framing its head and hanging to its knees, and cascading on down its back.
 */
const SNUFFTHORN_LOOK: Snuff = {
  body: { y: [-1.86, -1.66, -1.0, -0.1, 0.8, 1.5, 1.78], z: [0.1, 0.1, 0.12, 0.2, 0.32, 0.36, 0.36], w: [0.55, 1.0, 1.14, 1.22, 1.34, 1.2, 0.5], h: [0.55, 0.99, 1.12, 1.23, 1.34, 1.21, 0.55] },
  len: 3.3, legs: 1.55, thick: 0.5, hoof: 0.24,
  neck: { at: [0, 1.5, 0.5], len: 0.5, w: 0.9, lean: 25 },
  head: {
    y: [-0.5, -0.3, 0.08, 0.5, 0.98, 1.44, 1.66, 1.86, 1.92], z: [0.36, 0.32, 0.24, 0.16, 0.04, -0.06, -0.08, -0.09, -0.09],
    w: [0.32, 0.76, 0.9, 0.72, 0.52, 0.4, 0.4, 0.35, 0.29], h: [0.32, 0.8, 0.86, 0.7, 0.54, 0.44, 0.39, 0.35, 0.29], pitch: 8,
  },
  eye: { y: 0.5, up: 0.3, size: 0.14, brow: 1 },
  ear: { len: 1.9, w: 0.72, out: 55, back: 30 },
  ruff: [[28, 0.95, 14], [28, 1.05, 26], [26, 1.1, 46], [26, 1.2, 50], [24, 1.3, 52], [24, 1.3, 55], [22, 1.25, 58]],
  hang: 0.7,
  back: [6, 1.1],
  crest: [5, 0.78, 2.2],
  flowers: [3, 1, 2],
  tail: 0.7,
  cuff: 0.42,
  tusk: 1,
  toss: 32,
  wild: 0.5,
  gait: { trot: false, bounce: 0.03, nod: 2, swing: [16, 26] },
  size: 1.92,
};

/** A number of its own for each leaf, nought to one, so a mane is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);

/** Where a point on a body of rings is, `y` along it and `th` round it from its right side (up positive), and the way out of it there. */
function onRings(R: { y: number[]; z: number[]; w: number[]; h: number[] }, y: number, th: number): { p: V3; n: V3 } {
  let k = 0;
  while (k < R.y.length - 2 && R.y[k + 1] < y) k++;
  const dy = R.y[k + 1] - R.y[k], f = clamp((y - R.y[k]) / dy);
  const w = lerp(R.w[k], R.w[k + 1], f), h = lerp(R.h[k], R.h[k + 1], f), z = lerp(R.z[k], R.z[k + 1], f);
  const c = Math.cos(th), s = Math.sin(th);
  // Square to the surface, the rings' narrowing along it and all: a face narrowing into a muzzle looks forward as well as out.
  const slope = -((c * c * (R.w[k + 1] - R.w[k])) / w + (s * (R.z[k + 1] - R.z[k])) / h + (s * s * (R.h[k + 1] - R.h[k])) / h) / dy;
  return { p: [w * c, y, z + h * s], n: unit([c / w, slope, s / h]) };
}
const onBarrel = (s: Snuff, y: number, th: number): { p: V3; n: V3 } => onRings(s.body, y, th);
const onHead = (s: Snuff, y: number, th: number): { p: V3; n: V3 } => onRings(s.head, y, th);
/** The same point and way out, on the left side. */
const left = (q: { p: V3; n: V3 }): { p: V3; n: V3 } => ({ p: [-q.p[0], q.p[1], q.p[2]], n: [-q.n[0], q.n[1], q.n[2]] });

/** Where the end of the snout is, in the head's frame, and how wide it is there. */
function noseOf(s: Snuff): { tip: V3; r: number } {
  const H = s.head, last = H.y.length - 1;
  return { tip: [0, H.y[last], H.z[last]], r: H.w[last - 1] };
}

/** Where each ear is rooted on the head (the right one): high on the side of the skull, behind the cheeks. */
function earRoot(s: Snuff): V3 {
  const H = s.head, q = onHead(s, lerp(H.y[1], H.y[2], 0.45), 1.02);
  return sub(q.p, scale(q.n, 0.12));
}

/* ---- its bones ------------------------------------------------------------------------- */

/** A stage's body on four hooves (`QuadSpec`): its legs, neck, ears and tail from its numbers, and a pig's short quick stride. */
const specOf = (s: Snuff): QuadSpec => ({
  high: s.legs + 0.7,
  fore: { at: [s.body.w[4] * 0.52, s.len * 0.42, -0.42], len: [s.legs * 0.5, s.legs * 0.5, s.hoof], rest: [-6, 10, 0], fold: [55, 85], toe: [s.thick * 0.85, s.thick * 0.35] },
  hind: { at: [s.body.w[2] * 0.54, -s.len * 0.38, -0.2], len: [s.legs * 0.54, s.legs * 0.54, s.hoof], rest: [14, -28, 0], fold: [35, 55], toe: [s.thick * 0.85, s.thick * 0.35] },
  neck: { at: s.neck.at, len: s.neck.len, lean: s.neck.lean },
  head: { pitch: s.head.pitch },
  tail: { at: [0, s.body.y[0] + 0.2, s.body.z[0] + s.body.h[1] * 0.5], links: 2, len: 0.22, lift: 18, curl: -26, sway: 12 },
  ears: { at: earRoot(s), out: s.ear.out, back: s.ear.back },
  swing: s.gait.swing,
  duty: [0.56, 0.36],
  // Grazing, the neck bowed far enough down from however upright it is carried for the snout to reach the ground.
  graze: 118 - s.neck.lean,
  nose: 30,
  bow: 6,
  rock: 5,
});

/** Where each leg's foot is in a stride at a walk as `quadPose` has it, a four-beat, and in a trot, the diagonals together. */
const FOUR_BEAT = [0.25, 0.75, 0, 0.5];
const DIAGONALS = [0, 0.5, 0.5, 0];

/** The strike: how far through it the wind-up is gathered, the snout goes in, and it has settled again. */
const STRIKE = { gather: 0.38, hit: 0.52, done: 1 };
/** How far into a strike the scrape of a fore hoof before the charge is over, from its start. */
const SCRAPE = 0.32;
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);

/** How far through a strike it has gathered itself (nought to one and gone again by the hit) and thrown itself forward. */
function strikeOf(t: number): { gather: number; thrust: number; settle: number } {
  const gather = ramp(t, 0, STRIKE.gather) * (1 - ramp(t, STRIKE.gather, STRIKE.hit));
  const thrust = ramp(t, STRIKE.gather - 0.02, STRIKE.hit) * (1 - ramp(t, STRIKE.hit + 0.04, STRIKE.done));
  // After the hit, a little rebound that dies away: the body coming back past where it stood and settling.
  const after = clamp((t - STRIKE.hit) / (STRIKE.done - STRIKE.hit));
  const settle = t > STRIKE.hit ? Math.sin(after * Math.PI * 2) * (1 - after) : 0;
  return { gather, thrust, settle };
}

/** A rooting go: how far its head is down at the ground (eased in and out of, when it is not already down), and the two nudges in it. */
function rootOf(t: number, graze: number): { down: number; push: number; flick: number } {
  const down = Math.max(graze, ramp(t, 0, 0.12) * (1 - ramp(t, 0.88, 1)));
  // Two shoves a go, each the snout driven in and then flicked up and out, which is what throws the earth.
  const w = frac(t * 2);
  const push = hump(w, 0.3, 0.3);
  const flick = hump(w, 0.68, 0.2);
  return { down, push, flick };
}

/**
 * How far the whole body is carried forward this moment, in its own units:
 * drawn back as it gathers to strike and thrown forward as it lunges, and
 * shoved forward behind the snout at each push of its rooting. Its legs are
 * swung back by as much, so its hooves stay where they are.
 */
function surge(s: Snuff, a: Anim): number {
  const act = a.act;
  if (act?.kind === 'strike') {
    const k = strikeOf(act.t);
    return s.len * (0.24 * k.thrust - 0.1 * k.gather - 0.04 * k.settle);
  }
  if (act?.kind === 'work') {
    const r = rootOf(act.t, a.graze);
    return s.len * 0.05 * r.down * (r.push - 0.4 * r.flick);
  }
  return 0;
}

/**
 * A stage's pose over the one a body on four legs has (`quadPose`): its own
 * gait, bouncing; a snuffle at the ground now and then standing; and its
 * moves -- a strike, gathered, thrown forward snout first and settled, with
 * a hooked toss of the head as it grows; rooting, the snout down in the
 * ground; and evolving, its mane bristling and a shake of its head.
 */
function snuffPose(s: Snuff, spec: QuadSpec, p: QuadPose, a: Anim): void {
  trot(p, a);
  const g = smooth(a.go);
  // A brisk trot at a walk too, the diagonals together, rather than the four-beat walk the pose is given: a pig on its hooves. A
  // big boar keeps to its walk.
  if (s.gait.trot && a.go > 0 && a.gait < 0.5) {
    const duty = lerp(spec.duty?.[0] ?? 0.64, spec.duty?.[1] ?? 0.4, a.gait), amp = lerp(spec.swing[0], spec.swing[1], a.gait);
    for (let i = 0; i < 4; i++) {
      const was = step(a.u + FOUR_BEAT[i], duty, amp), now = step(a.u + DIAGONALS[i], duty, amp);
      for (let k = 0; k < 3; k++) p.legs[i][k] += g * (now[k] - was[k]);
    }
  }
  if (a.go > 0) {
    // Bouncing along: the body up off each pair of hooves, the head nodding and the ears flopping a beat after it, the tail going.
    const w = frac(a.u);
    p.lift += g * (s.gait.bounce + 0.08 * a.gait) * Math.max(0, Math.sin(w * TAU * 2));
    p.head[0] += g * s.gait.nod * Math.sin(w * TAU * 2 - 0.6);
    p.ears[0][0] += g * 3 * s.gait.nod * Math.sin(w * TAU * 2 - 1.4);
    p.ears[1][0] += g * 3 * s.gait.nod * Math.sin(w * TAU * 2 - 1.1);
    p.tail[1] += g * 18 * Math.sin(w * TAU + 0.4);
  } else {
    // Standing, now and then a snuffle at the ground in front of it, the snout working.
    const snuffle = beat(a.t, [7.4, 19.6], 1.6) * (1 - a.graze);
    p.neck[0] += 10 * snuffle;
    p.head[0] -= 10 * snuffle + 3 * snuffle * Math.sin(a.t * 30);
  }
  // Head down at the ground, the fore legs kept straight under the chest rather than folded, as a pig roots: it reaches down with
  // its neck, not by kneeling.
  const down = a.graze * (1 - g);
  p.legs[0][1] -= 0.8 * down;
  p.legs[1][1] -= 0.8 * down;
  const act = a.act;
  if (act?.kind === 'strike') {
    const k = strikeOf(act.t), toss = s.toss * hump(act.t, 0.64, 0.14);
    // Gathered: crouched back on its haunches, the head drawn in and down, the ears pinned back.
    p.pitch += 8 * k.gather - 11 * k.thrust + 3 * k.settle + 0.12 * toss;
    p.lift -= 0.08 * k.gather;
    p.legs[2][1] += 0.3 * k.gather;
    p.legs[3][1] += 0.3 * k.gather;
    p.neck[0] += -20 * k.gather + 32 * k.thrust - 8 * k.settle - 0.15 * toss;
    p.head[0] += -22 * k.gather - 4 * k.thrust + 6 * k.settle + toss;
    // As it gathers, a fore hoof scraped once along the ground, as a boar does before it charges: lifted forward, put down, and
    // dragged back along the ground.
    const sc = clamp(act.t / SCRAPE), w = Math.sin(sc * TAU) * (act.t < SCRAPE ? 1 : 0);
    p.legs[1][0] += 35 * w;
    p.legs[1][1] += 0.8 * Math.max(0, w);
    p.legs[1][2] = Math.max(p.legs[1][2], Math.max(0, w));
    // Thrown forward snout first: the hind legs driving off their toes, the ears streaming back, and flopping forward as it settles.
    p.foot[2] -= 22 * k.thrust;
    p.foot[3] -= 22 * k.thrust;
    // As it tosses its head up the ears are brought up as far as the head goes back, so they stay upright and not laid over its face.
    for (const e of p.ears) e[0] += 34 * k.gather + 40 * k.thrust - 22 * k.settle - 1.1 * toss;
    p.tail[0] += 30 * k.thrust;
    p.squash += 0.06 * k.gather - 0.05 * k.thrust;
    // The legs kept upright against the body's pitch.
    for (const l of p.legs) l[0] -= 8 * k.gather - 11 * k.thrust;
  } else if (act?.kind === 'work') {
    const r = rootOf(act.t, a.graze);
    // Rooting: the snout driven down into the ground and flicked up out of it, twice a go; the body shoving behind it, an ear
    // flicked on each shove, and the tail going hard.
    p.neck[0] += r.down * (14 + 12 * r.push - 6 * r.flick);
    p.head[0] += r.down * (-8 - 22 * r.push + 16 * r.flick);
    p.pitch -= r.down * 2 * r.push;
    p.roll += r.down * 3 * Math.sin(act.t * TAU * 2);
    p.ears[0][0] += r.down * 34 * hump(act.t, 0.2, 0.1);
    p.ears[1][0] += r.down * 34 * hump(act.t, 0.7, 0.1);
    p.ears[0][1] += r.down * 14 * r.flick;
    p.ears[1][1] += r.down * 14 * r.flick;
    p.tail[1] += r.down * 30 * Math.sin(act.t * TAU * 4);
  } else if (act?.kind === 'evolve') {
    // Evolving: drawn up tall as the light gathers, then at the turn a shake of the head, ears flapping, and the tail going.
    const up = ramp(act.t, 0.1, 0.45) * (1 - ramp(act.t, 0.62, 0.85)), shake = hump(act.t, 0.55, 0.12);
    p.neck[0] -= 12 * up;
    p.head[0] += 14 * up;
    p.head[2] += 18 * shake * Math.sin(act.t * 70);
    p.ears[0][0] += 30 * shake * Math.sin(act.t * 70) - 15 * up;
    p.ears[1][0] -= 30 * shake * Math.sin(act.t * 70) + 15 * up;
    p.tail[1] += 25 * Math.sin(act.t * 30) * up;
  }
  // However far the body is carried forward, the legs swung back by as much, so the hooves stay where they are.
  const d = surge(s, a);
  if (d) {
    for (let i = 0; i < 4; i++) {
      const L = (i < 2 ? spec.fore : spec.hind).len;
      p.legs[i][0] -= Math.asin(clamp(d / (L[0] + L[1]), -0.9, 0.9)) / DEG;
    }
  }
}

/** The bones of a stage: a body on four hooves (`quadBonesOf`), carried forward as it strikes and roots, and a bone the front of the mane is on. */
function snuffBones(s: Snuff): (a: Anim) => Bones {
  const spec = specOf(s);
  const posed = quadBonesOf(spec, (p, a) => snuffPose(s, spec, p, a));
  return (a) => {
    const act = a.act;
    // Rooting, the head goes down to the ground as it does to graze, and the hind feet are kept down under it (`quadBonesOf`).
    const b = posed(act?.kind === 'work' ? { ...a, graze: rootOf(act.t, a.graze).down } : a);
    const d = surge(s, a);
    if (d) for (const k of Object.keys(b)) b[k] = { m: b[k].m, t: [b[k].t[0], b[k].t[1] + d, b[k].t[2]] };
    // The front of the mane goes with the neck: its bone is the neck's, turned back to the body's carriage.
    b.ruff = joint(b.neck, [0, 0, 0], spec.neck.lean);
    return b;
  };
}

/* ---- leaves and flowers ---------------------------------------------------------------- */

/**
 * A thin flat thing along a line of points -- a leaf, a petal -- `widths`
 * across it (half-widths) at each, its face turned along `face`, its edges
 * lifted by `fold` of its width so it is a shallow V down its middle: the
 * half to its left in `mats[0]` and to its right in `mats[1]`, so the fold
 * reads as a rib, and its underside in `mats[2]`. No thickness, so a top
 * and an underside, of three corners a point each, whichever is turned to
 * the viewer drawn: a leaf as `blade` makes it has more than twice the
 * facets, and a mane is a hundred leaves.
 */
function sheet(pts: readonly V3[], widths: readonly number[], face: V3, fold: number, mats: readonly [Mat, Mat, Mat]): Mesh {
  const K = pts.length, v: V3[] = [], f: Face[] = [], want: V3[] = [], ns: V3[] = [];
  for (let k = 0; k < K; k++) {
    const d = unit(sub(pts[Math.min(K - 1, k + 1)], pts[Math.max(0, k - 1)]));
    const n = unit(sub(face, scale(d, dot(face, d)))), side = unit(cross(d, n)), w = widths[Math.min(k, widths.length - 1)];
    const row: V3[] = [add(add(pts[k], scale(side, -w)), scale(n, fold * w)), pts[k], add(add(pts[k], scale(side, w)), scale(n, fold * w))];
    // The top's corners and the underside's, apart, so neither shares an edge with the other and only the outline is inked.
    v.push(...row, ...row);
    ns.push(n);
  }
  for (let k = 0; k < K - 1; k++) {
    const A = k * 6, B = A + 6, n = unit(add(ns[k], ns[k + 1]));
    for (const j of [0, 1]) {
      f.push({ i: [A + j, A + j + 1, B + j + 1, B + j], m: mats[j] });
      want.push(n);
      f.push({ i: [B + 3 + j, B + 4 + j, A + 4 + j, A + 3 + j], m: mats[2] });
      want.push(scale(n, -1));
    }
  }
  return mesh(v, wound(v, f, want));
}

/** Each face wound so it faces the way it is meant to (`want`), whichever way round it was listed. */
function wound(v: readonly V3[], f: Face[], want: readonly V3[]): Face[] {
  f.forEach((face, q) => {
    const idx = face.i;
    let nx = 0, ny = 0, nz = 0;
    for (let c = 0; c < idx.length; c++) {
      const p = v[idx[c]], r = v[idx[(c + 1) % idx.length]];
      nx += (p[1] - r[1]) * (p[2] + r[2]);
      ny += (p[2] - r[2]) * (p[0] + r[0]);
      nz += (p[0] - r[0]) * (p[1] + r[1]);
    }
    if (nx * want[q][0] + ny * want[q][1] + nz * want[q][2] < 0) idx.reverse();
  });
  return f;
}

/** The two colours a leaf comes in: green, or the pale pink of a young leaf; each a top in two halves and an underside. */
type Tone = 'green' | 'pink';
const TONES: Record<Tone, readonly [Mat, Mat, Mat]> = { green: ['leaf', 'stem', 'leafDark'], pink: ['moss', 'shellDark', 'shell'] };
/** Which of the two colours a leaf is: mostly green, and now and then the pale pink of a young leaf. */
const toneOf = (i: number, pink = 0.26): Tone => (jitter(i * 3 + 1) < pink ? 'pink' : 'green');

/**
 * A leaf: a pointed oval along a gentle arch from `root` in the way `dir`
 * goes, `len` long and `w` across at its widest, its face turned along
 * `face` and arched out that way, in one of its two colours.
 */
function leaf(root: V3, dir: V3, face: V3, len: number, w: number, K: number, tone: Tone, arch = 0.14): Mesh {
  const d = unit(dir), f = unit(sub(face, scale(d, dot(face, d))));
  const tip = add(root, scale(d, len)), mid = add(add(root, scale(d, len * 0.5)), scale(f, len * arch));
  const widths = Array.from({ length: K }, (_, k) => {
    const u = k / (K - 1);
    return Math.max(0.02, w * Math.sin(Math.PI * u ** 0.8) ** 0.9);
  });
  return sheet(curve(root, mid, tip, K - 1), widths, f, 0.25, TONES[tone]);
}

/**
 * A small five-petalled flower at `c`, facing along `n`, `r` across: cream
 * petals round a yellow middle. Each petal is a sheet, for its outline and
 * its shape, with its colour painted on both its faces always lit, so a
 * flower turned from the light is cream and not the grey-lilac a shaded
 * cream goes.
 */
function flower(c: V3, n: V3, r: number, spin = 0): Mesh {
  const z = unit(n);
  let x = cross([0, 0, 1], z);
  if (Math.hypot(x[0], x[1], x[2]) < 1e-3) x = [1, 0, 0];
  x = unit(x);
  const y = cross(z, x);
  const paints: Disc[] = [];
  const petals = Array.from({ length: 5 }, (_, q) => {
    const t = spin + (q / 5) * TAU, d = add(scale(x, Math.cos(t)), scale(y, Math.sin(t)));
    const at = (k: number, lift: number): V3 => add(add(c, scale(d, r * k)), scale(z, r * lift));
    for (const sd of [1, -1]) paints.push(disc(add(at(0.55, 0.11), scale(z, sd * 0.012)), scale(z, sd), r * 0.36, r * 0.3, 7, 'petal', { up: cross(z, d), lit: true }));
    return sheet([at(0.12, 0.05), at(0.55, 0.12), at(0.95, 0.08)], [r * 0.2, r * 0.42, r * 0.2], z, 0.12, ['petal', 'petal', 'petal']);
  });
  for (const sd of [1, -1]) paints.push(disc(add(c, scale(z, sd * r * 0.16)), scale(z, sd), r * 0.24, r * 0.24, 7, 'bloom', { lit: true }));
  return merge(...petals, orbAlong(add(c, scale(z, r * 0.14)), z, [r * 0.26, r * 0.26, r * 0.14], 6, 3, 'bloom'), paint(paints));
}

/** One leaf or flower of a piece of them: its mesh, the way it lifts when it rustles, and whether it is a flower, which pops as it evolves. */
interface Frond { mesh: Mesh; out: V3; bloom?: boolean }
/** A mesh of leaves and flowers with, for each corner, how far out along its leaf it is, which way it lifts, and the middle of its flower. */
interface Fronds { mesh: Mesh; w: number[]; out: V3[]; mid: Array<V3 | null> }
function fronds(parts: readonly Frond[]): Fronds {
  const w: number[] = [], out: V3[] = [], mid: Array<V3 | null> = [];
  for (const p of parts) {
    // A leaf's corners go six to a point along it, root to tip (`sheet`); a flower moves as the middle of a leaf does.
    const K = p.mesh.v.length / 6;
    const c = p.bloom ? scale(p.mesh.v.reduce((t, q) => add(t, q), [0, 0, 0] as V3), 1 / p.mesh.v.length) : null;
    p.mesh.v.forEach((_, i) => { w.push(p.bloom ? 0.5 : Math.floor(i / 6) / Math.max(1, K - 1)); out.push(p.out); mid.push(c); });
  }
  return { mesh: merge(...parts.map((p) => p.mesh)), w, out, mid };
}

/**
 * How far the leaves are lifted off the body this moment, as a share of
 * their length, and how far they are thrown up: bristling as it gathers to
 * strike, at each shove of its rooting and as it evolves, bouncing as it
 * goes, and stirring now and then as it stands.
 */
function rustle(s: Snuff, a: Anim, phase: number): { lift: number; bounce: number } {
  let lift = 0.03 * beat(a.t, [4.6, 13.9, 21.2], 1.2) * (1 - a.go);
  let bounce = a.go > 0 ? smooth(a.go) * (s.gait.bounce + 0.05 * a.gait) * Math.sin(frac(a.u) * TAU * 2 - 1.2 - phase) : 0;
  const act = a.act;
  if (act?.kind === 'strike') {
    const k = strikeOf(act.t);
    lift += 0.22 * k.gather + 0.12 * k.thrust;
    bounce += 0.08 * k.settle;
  } else if (act?.kind === 'work') {
    const r = rootOf(act.t, a.graze);
    lift += r.down * (0.06 + 0.14 * r.flick);
    bounce += r.down * 0.06 * Math.sin(act.t * TAU * 4 - phase);
  } else if (act?.kind === 'evolve') {
    lift += 0.24 * hump(act.t, 0.5, 0.25);
    bounce += 0.05 * hump(act.t, 0.55, 0.12) * Math.sin(act.t * 70 - phase);
  }
  return { lift, bounce };
}

/** A piece of leaves that rustles (`rustle`): every corner moved by as far out along its leaf as it is; and its flowers, popping open as it evolves. */
function rustling(s: Snuff, f: Fronds, len: number, phase: number): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const { lift, bounce } = rustle(s, a, phase);
    const pop = a.act?.kind === 'evolve' ? 0.6 * hump(a.act.t, 0.55, 0.14) : 0;
    if (!lift && !bounce && !pop) return v as V3[];
    return v.map((p, i) => {
      const k = f.w[i] * len, c = f.mid[i];
      const q: V3 = c && pop ? add(c, scale(sub(p, c), 1 + pop)) : p;
      return [q[0] + f.out[i][0] * lift * k, q[1] + f.out[i][1] * lift * k, q[2] + f.out[i][2] * lift * k + bounce * k];
    });
  };
}

/* ---- the mane ------------------------------------------------------------------------------ */

/** How many of the mane's rows go round the neck; the rest are on the body. */
const NECK_ROWS = 2;
/** Where each row of the mane on the body is rooted along it: the first round the front of the chest, and each after it back by under half its leaves. */
const rowY = (s: Snuff, r: number): number => s.body.y[5] - 0.05 - s.ruff.slice(NECK_ROWS, Math.max(NECK_ROWS, r)).reduce((t, [, L]) => t + L * 0.45, 0);

/**
 * Where a point on a ring round the neck is, in the frame at the neck's root carried as the body is (the `ruff` bone): `t`
 * up the neck from its root, `th` round it from its right side (up positive), and the way out of it there.
 */
function onNeck(s: Snuff, t: number, th: number): { p: V3; n: V3 } {
  const lean = s.neck.lean * DEG, A: V3 = [0, Math.sin(lean), Math.cos(lean)], v = cross(A, [1, 0, 0]);
  const n = add(scale([1, 0, 0], Math.cos(th)), scale(v, -Math.sin(th)));
  return { p: add(scale(A, t), scale(n, s.neck.w * 0.95)), n };
}

/**
 * The mane, in rows from just behind the head back over the shoulders, each
 * a ring of leaves: the front rows round the neck, in the frame at its root
 * (`onNeck`), standing out from it in a puff; the rest rooted on the barrel
 * in the body's frame and swept back over the shoulders. Each row's leaves
 * stand up off the nape (the more, the wilder it is) and are shorter low on
 * the sides; there are none under the belly, where only the legs would see
 * them.
 */
function ruffRows(s: Snuff, rows: number[], K: number): Frond[] {
  const out: Frond[] = [];
  const lean = s.neck.lean * DEG, A: V3 = [0, Math.sin(lean), Math.cos(lean)];
  for (const r of rows) {
    const [count, L, swept] = s.ruff[r];
    const neck = r < NECK_ROWS, sweep = swept * DEG;
    const back: V3 = neck ? scale(A, -1) : [0, -1, 0];
    for (let q = 0; q < count; q++) {
      const id = r * 37 + q;
      const th = ((q + (r % 2) * 0.5) / count) * TAU + 0.25 * (jitter(id) - 0.5);
      const under = Math.max(0, -Math.sin(th));
      if (under > (neck ? 0.8 : 0.55)) continue;
      const { p, n } = neck ? onNeck(s, s.neck.len * 0.7 - r * L * 0.45, th) : onBarrel(s, rowY(s, r), th);
      const nape = Math.max(0, Math.sin(th)) * s.wild;
      const len = L * (0.82 + 0.3 * jitter(id + 7)) * (1 - 0.3 * under) * (1 + 0.6 * nape);
      // Each turned a little round the ring, alternately one way and the other, so they fan and overlap like the leaves of a
      // spray, and are never all seen edge on at once.
      const round = scale(unit(cross(n, back)), q % 2 ? 1 : -1);
      const dir = unit(add(add(add(scale(n, Math.cos(sweep) + nape), scale(back, Math.sin(sweep))), [0, 0, -s.hang * Math.abs(Math.cos(th))]), scale(round, 0.3 * jitter(id + 2))));
      const face = add(add(scale(n, Math.sin(sweep)), scale(back, -Math.cos(sweep))), scale(round, 0.6));
      out.push({ mesh: leaf(add(p, scale(n, 0.02 - 0.04 * r)), dir, face, len, len * 0.45, K, toneOf(id), 0.18), out: unit(face) });
    }
  }
  return out;
}

/** The flowers down each side of the mane, laid on the leaves of its rows a little out from the barrel. */
function maneFlowers(s: Snuff): Frond[] {
  const out: Frond[] = [];
  for (const sd of [1, -1]) {
    for (let q = 0; q < s.flowers[0]; q++) {
      // The first in the puff round the neck, the rest further back on the shoulders.
      const r = Math.min(s.ruff.length - 1, q + 1), L = s.ruff[r][1];
      const th = (sd > 0 ? 0 : Math.PI) + sd * (0.45 - 0.6 * q + 0.2 * jitter(q + (sd > 0 ? 0 : 5)));
      const { p, n } = r < NECK_ROWS ? onNeck(s, s.neck.len * 0.7 - r * L * 0.45, th) : onBarrel(s, rowY(s, r) - L * 0.25, th);
      const at = add(add(p, scale(n, L * 0.45)), r < NECK_ROWS ? s.neck.at : [0, 0, 0]);
      out.push({ mesh: flower(at, add(n, [0, 0.35, 0.2]), 0.26 + 0.02 * r, q * 0.7), out: n, bloom: true });
    }
  }
  return out;
}

/**
 * A bib of leaves at the throat, pointing forward and down over the top of
 * the chest under the chin, with a flower at the middle of it: in the mane's
 * front frame, at the neck's root, so it goes down with the head.
 */
function bibOf(s: Snuff, K: number): Frond[] {
  const lean = s.neck.lean * DEG, L = s.ruff[0][1] * 1.2, R = s.neck.w;
  const A: V3 = [0, Math.sin(lean), Math.cos(lean)], u: V3 = [1, 0, 0], v = cross(A, u);
  const out: Frond[] = [];
  for (const [layer, count] of [[0, 6], [1, 5]]) {
    for (let q = 0; q < count; q++) {
      const phi = ((q + 0.5) / count - 0.5) * 2.1, id = 900 + layer * 10 + q;
      const round = add(scale(v, Math.cos(phi)), scale(u, Math.sin(phi)));
      const root = add(scale(A, 0.15 - layer * 0.2), scale(round, R * 0.94));
      const dir = unit(add(add(scale(round, 0.5), [0, 0.5, -0.8]), scale(u, Math.sin(phi) * 0.3)));
      out.push({ mesh: leaf(root, dir, round, L * (0.6 - 0.05 * layer + 0.12 * jitter(id)), L * 0.26, K, toneOf(id), 0.16), out: round });
    }
  }
  const at = scale(v, R * 1.15);
  out.push({ mesh: flower(add(at, [0.08, 0.05, -0.05]), add(v, [0.1, 0.3, 0.3]), 0.28, 0.4), out: v, bloom: true });
  return out;
}

/** Leaves cascading down the back behind the mane: along the ridge and down each flank in three layers, standing off it, shorter toward the rump. */
function backLeaves(s: Snuff, K: number): Frond[] {
  const [pairs, L] = s.back;
  const out: Frond[] = [];
  for (let q = 0; q < pairs; q++) {
    const y = lerp(rowY(s, s.ruff.length - 1) - 0.3, s.body.y[1] + 0.35, q / Math.max(1, pairs - 1));
    const len = L * (1 - 0.4 * (q / pairs));
    for (const sd of [1, -1]) {
      // Three layers, ridge to flank, each standing off the back at about thirty degrees and the lower ones hanging further.
      for (const [lay, th] of [[0, 1.45], [1, 1.05], [2, 0.65]]) {
        const id = 300 + q * 6 + (sd > 0 ? 0 : 3) + lay;
        const at = onBarrel(s, y - lay * 0.15, sd > 0 ? th : Math.PI - th);
        const dir = unit(add(scale(at.n, 0.5), [0, -0.87, -0.3 * lay * s.hang]));
        out.push({ mesh: leaf(add(at.p, scale(at.n, 0.02)), dir, at.n, len * (0.85 + 0.25 * jitter(id + 3)) * (1 - 0.1 * lay), len * 0.45, K, toneOf(id, 0.2), 0.2), out: at.n });
      }
    }
    // A flower at every other pair, along the ridge, as many as it has.
    if (q % 2 === 0 && q / 2 < s.flowers[2]) {
      const at = onBarrel(s, y - 0.25, Math.PI / 2 + (q % 4 ? 0.35 : -0.35));
      out.push({ mesh: flower(add(at.p, scale(at.n, 0.3)), add(at.n, [0, 0.2, 0]), 0.28, q), out: at.n, bloom: true });
    }
  }
  return out;
}

/* ---- the head ------------------------------------------------------------------------------- */

/** A thin painted line along a run of points on a surface, `w` wide, each point's way out given: a mouth's line, a lid. */
function line(pts: ReadonlyArray<{ p: V3; n: V3 }>, w: number, m: Mat): Disc {
  const up = (q: { p: V3; n: V3 }, k: number): V3 => {
    const d = unit(cross(q.n, [1, 0, 0]));
    return add(add(q.p, scale(q.n, 0.025)), scale(d, k * w));
  };
  const v = [...pts.map((q) => up(q, 1)), ...[...pts].reverse().map((q) => up(q, -1))];
  // Wound to face out of the surface, as a disc is.
  const n = pts.reduce((t, q) => add(t, q.n), [0, 0, 0] as V3);
  let nx = 0, ny = 0, nz = 0;
  for (let c = 0; c < v.length; c++) {
    const p = v[c], r = v[(c + 1) % v.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nx * n[0] + ny * n[1] + nz * n[2] < 0 ? v.reverse() : v, m };
}

/**
 * The eyes, open or shut, set on the sides of the head where it narrows into
 * the muzzle and looking forward as much as out: each small, round and warm
 * brown with one glint, a soft lid line over it and a brow over that. All of
 * an eye goes out of sight together when the muzzle or the skull is between
 * it and the viewer (`at`), so the far one is hidden round the muzzle rather
 * than painted over it.
 */
function eyesOf(s: Snuff, shut: boolean): Mesh {
  const E = s.eye, out: Disc[] = [];
  for (const side of [1, -1]) {
    const q0 = onHead(s, E.y, E.up), q = side > 0 ? q0 : left(q0);
    const n = unit(add(q.n, [0, 0.12, 0.05])), p = add(q.p, scale(n, 0.01)), at = add(p, scale(n, 0.03));
    const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
    const o = { at, up: [0, 0, 1] as V3 };
    const r = E.size;
    if (shut) {
      out.push(disc(add(p, scale(up, -r * 0.15)), n, r * 1.08, r * 0.3, 8, 'lid', o));
      continue;
    }
    out.push(disc(add(p, scale(up, r * 0.16)), n, r * 1.12, r * 1.08, 10, 'lid', o));
    out.push(disc(p, n, r, r, 12, 'bark', o));
    out.push(disc(add(p, scale(n, 0.005)), n, r * 0.52, r * 0.55, 10, 'eye', o));
    out.push(disc(add(add(add(p, scale(n, 0.01)), scale(up, r * 0.36)), scale(across, side * r * 0.3)), n, r * 0.28, r * 0.28, 6, 'glint', { ...o, lit: true }));
  }
  return paint(out);
}

/**
 * The head: a boar's wedge, built as rings from the back of the skull to
 * the snout (`Snuff.head`) -- a flat brow sloping forward into the muzzle in
 * one line, narrow over the crown -- with full jowls low at the back of it,
 * wider than the brow, a small chin under the muzzle, a ridge over each eye,
 * and the snout's flat pink end with its nostrils. A smile runs back along
 * each side of the muzzle; there is a blush on each cheek and a pink patch on
 * the brow; and on the Snuffthorn a crescent tusk out of the upper jaw on
 * each side, curving out and up past the snout.
 */
function headOf(s: Snuff, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, last = H.y.length - 1, snout = last - 2;
  const skull = tube(H.y.map((y, q) => [0, y, H.z[q]] as V3), H.w, H.h, n, (ring) => (ring >= snout ? 'nose' : 'coat'));
  const tip = noseOf(s);
  const end: V3 = [0, tip.tip[1] + 0.012, tip.tip[2]], er = H.w[last], eh = H.h[last];
  const disk = paint([
    disc(end, [0, 1, 0], er * 0.95, eh * 0.95, 12, 'muzzle'),
    ...[1, -1].map((sd) => disc(add(end, [sd * er * 0.38, 0.01, 0]), [0, 1, 0], er * 0.16, eh * 0.32, 6, 'pad')),
  ]);
  // Jowls low at the back of the head, a little wider than the skull, and a small chin under the muzzle.
  const jowls = merge(...[1, -1].map((sd) => orb([sd * H.w[2] * 0.5, H.y[2] + 0.04, H.z[2] - H.h[2] * 0.38], [H.w[2] * 0.56, (H.y[3] - H.y[1]) * 0.42, H.h[2] * 0.52], n, k, 'coat')));
  const chin = orb([0, lerp(H.y[4], H.y[5], 0.5), H.z[5] - H.h[5] * 0.7], [H.w[5] * 0.62, (H.y[6] - H.y[4]) * 0.4, H.h[5] * 0.42], n, k, 'coat');
  // A ridge over each eye, along the slope of the brow, the heavier the older it is; a piglet's brow is smooth.
  const E = s.eye;
  const brows = E.brow > 0 && merge(...[1, -1].map((sd) => {
    const q0 = onHead(s, E.y - E.size * 0.2, E.up + E.size * 3), q = sd > 0 ? q0 : left(q0);
    return orbAlong(sub(q.p, scale(q.n, E.size * (1.05 - 0.45 * E.brow))), [0, 1, -0.45], [E.size * 1.1, E.size * 1.0, E.size * 2], 7, 4, 'coat');
  }));
  // The smile: from low on the side of the muzzle near the snout back to the corner of the mouth under the cheek, turned up there.
  const mouth = paint([1, -1].map((sd) => line(Array.from({ length: 6 }, (_, q) => {
    const f = q / 5, y = lerp(H.y[snout] - 0.04, lerp(H.y[4], H.y[5], 0.2), f), th = -0.6 + 0.08 * f + 0.22 * f ** 3;
    const at = onHead(s, y, th);
    return sd > 0 ? at : left(at);
  }), H.w[2] * 0.03, 'lid')));
  const cheek = onHead(s, lerp(H.y[2], H.y[3], 0.55), -0.2), brow = onHead(s, lerp(H.y[1], H.y[2], 0.8), 1.15);
  const marks = paint([
    ...[cheek, left(cheek)].map((q) => disc(add(q.p, scale(q.n, 0.02)), q.n, H.w[2] * 0.2, H.h[2] * 0.12, 8, 'inner')),
    disc(add(brow.p, scale(brow.n, 0.02)), brow.n, H.w[2] * 0.2, H.w[2] * 0.14, 7, 'mark', { spin: 0.4 }),
  ]);
  // The tusks: out of the upper jaw beside the snout, a stubby crescent curving out and then up to the top of the snout.
  const tusks = s.tusk ? merge(...[1, -1].map((sd) => {
    const r = H.w[snout], y = H.y[snout], z = H.z[snout];
    const h = H.h[snout], pts = curve([sd * r * 0.8, y - 0.08, z - h * 0.4], [sd * r * 1.8, y + 0.04, z - h * 0.35], [sd * r * 1.3, y - 0.08, z + h * 0.9], 5);
    const rr = pts.map((_, q) => lerp(h * 0.35, h * 0.12, q / 5) * s.tusk);
    return tube(pts, rr, rr, 6, 'tooth');
  })) : undefined;
  return merge(skull, jowls, chin, brows, tusks, disk, mouth, marks, eyesOf(s, shut));
}

/** Solids inside the head that hide what is round the far side of them (`Piece.hide`): the skull and the muzzle. */
function headSolids(s: Snuff): Array<{ c: V3; r: V3 }> {
  const H = s.head;
  return [
    { c: [0, H.y[2], H.z[2]], r: [H.w[2] * 0.85, (H.y[3] - H.y[0]) * 0.5, H.h[2] * 0.85] },
    { c: [0, (H.y[4] + H.y[7]) / 2, H.z[5]], r: [H.w[5] * 0.85, (H.y[7] - H.y[4]) / 2, H.h[5] * 0.85] },
  ];
}

/** A pointed ear, big and soft, built upright facing forward and cupped so its lining looks forward and out: cream outside with a pink tip, pink inside with a vein down it. */
function earOf(len: number, w: number, n: number): Mesh {
  const line0 = curve([0, 0, 0], [0, -0.06, len * 0.5], [0, 0.06, len], 5);
  const ws = [w * 0.62, w * 0.95, w, w * 0.78, w * 0.42, 0.02];
  // Cupped: its edges brought forward of its middle, the more the further out they are.
  const cup = (p: V3): V3 => [p[0], p[1] + 0.4 * w * (p[0] / w) ** 2, p[2]];
  const shell = tube(line0, ws, ws.map((x) => Math.max(0.03, x * 0.22)), n, (ring) => (ring >= 4 ? 'mark' : 'coat'), { up: [0, 1, 0], seam: 'start' });
  const cupped = { ...shell, v: shell.v.map(cup) };
  const side = (sd: number): V3[] => [1, 2, 3, 4].map((q) => cup([sd * ws[q] * 0.66, ws[q] * 0.24 + 0.012, line0[q][2]]));
  const lining = [cup([0, ws[0] * 0.2 + 0.012, line0[0][2] + len * 0.1]), ...side(-1), cup([0, 0.03, len * 0.93]), ...side(1).reverse()];
  const vein = [[-0.025, 0.04, len * 0.16], [-0.02, 0.05, len * 0.7], [0.02, 0.05, len * 0.7], [0.025, 0.04, len * 0.16]] as V3[];
  return merge(mesh(cupped.v, cupped.f), paint([{ v: lining, m: 'inner' }, { v: vein, m: 'shell' }]));
}

/* ---- the rest of it -------------------------------------------------------------------------- */

/** A cloven hoof: two dark toes side by side with a cleft between them, each a squat wedge longer forward than it is wide. */
function cloven(r: number, h: number, n: number): Mesh {
  return merge(...[-1, 1].map((sd) => tube([[sd * r * 0.42, r * 0.1, 0.04], [sd * r * 0.46, r * 0.22, -h * 0.5], [sd * r * 0.48, r * 0.32, -h]],
    [r * 0.42, r * 0.48, r * 0.5], [r * 0.62, r * 0.78, r * 0.86], n, 'hoof', { seam: 'start' })));
}

/**
 * A cuff of leaves round the lower leg over the hoof, like leg warmers, in
 * two rings, tips up and out, covering the lower part of the leg; built on
 * the lower leg's bone, `w` thick at its top and tapering to 0.7 of that.
 */
function cuffOf(s: Snuff, lower: number, w: number, K: number, seed: number): Fronds {
  const out: Frond[] = [];
  for (const [ring, count, at] of [[0, 6, 0.93], [1, 5, 0.7]]) {
    for (let q = 0; q < count; q++) {
      const id = seed + ring * 10 + q;
      const th = ((q + 0.5 * ring) / count) * TAU + 0.3 * jitter(id), rad: V3 = [Math.cos(th), Math.sin(th), 0];
      const root = add(scale(rad, w * (1 - 0.3 * at) * 0.85), [0, 0, -lower * at]);
      const len = s.cuff * (0.85 + 0.3 * jitter(id + 11)) * (1 - 0.15 * ring);
      out.push({ mesh: leaf(root, unit(add(scale(rad, 0.35), [0, 0, 1])), rad, len, len * 0.5, K, toneOf(id, 0.15), 0.1), out: rad });
    }
  }
  return fronds(out);
}

/** Its soft pink patches: blotches of two or three overlapping spots, scattered along both flanks and over the rump. */
function patches(s: Snuff): Mesh {
  const out: Disc[] = [];
  const spots: Array<[number, number, number]> = [[-0.62, 0.25, 0.3], [-0.2, -0.35, 0.26], [0.22, 0.55, 0.22], [-0.85, 1.1, 0.24], [0.05, 0.05, 0.18]];
  for (const sd of [1, -1]) {
    for (let q = 0; q < spots.length; q++) {
      const [fy, th, r] = spots[q];
      const y = (fy + (sd > 0 ? 0 : 0.12 * (jitter(q) - 0.3))) * s.len * 0.5;
      const ang = sd > 0 ? th : Math.PI - th;
      for (let e = 0; e < 3; e++) {
        const { p, n } = onBarrel(s, y + (e - 1) * r * 0.55, ang + (e - 1) * 0.12 * (jitter(q + e) - 0.5));
        out.push(disc(add(p, scale(n, 0.03)), n, r * s.len * 0.22 * (0.7 + 0.3 * jitter(q * 3 + e)), r * s.len * 0.18, 7, 'mark', { spin: jitter(q + e * 7) }));
      }
    }
  }
  return paint(out);
}

/** A stage's pieces: a pig's body (`quadPieces`) with its own head, and its ears, hooves, mane, bib, crest, cuffs, tail and patches. */
function snuffBuild(s: Snuff, lod: number): Piece[] {
  const n = cut(lod, 8, 12), k = cut(lod, 5, 6), K = lod ? 6 : 3;
  const H = s.head, skull = headSolids(s)[0];
  // The crest: leaves standing up off the crown between the ears, fanned out and swept a little back; and a flower at its foot.
  const crown = onHead(s, lerp(H.y[1], H.y[2], 0.4), Math.PI / 2).p;
  const [crestN, crestL, spread] = s.crest;
  const crest = fronds([
    ...Array.from({ length: crestN }, (_, q): Frond => {
      const f = crestN > 1 ? q / (crestN - 1) - 0.5 : 0, id = 500 + q;
      const root = add(crown, [f * H.w[1] * 0.5 * Math.min(spread, 1.5), -0.12 - 0.1 * Math.abs(f), -0.1]);
      const dir = unit([f * 1.3 * spread, -0.45 - 0.2 * jitter(id), 1]);
      return { mesh: leaf(root, dir, [0, 1, 0.2], crestL * (1 - 0.5 * Math.abs(f) + 0.15 * jitter(id + 1)), crestL * 0.38, K, toneOf(id, 0.2), 0.08), out: [0, -0.3, 1] };
    }),
    ...Array.from({ length: s.flowers[1] }, (_, q): Frond => {
      const at = onHead(s, lerp(H.y[1], H.y[2], 0.8), Math.PI / 2 - (q % 2 ? -0.5 : 0.5));
      return { mesh: flower(add(at.p, scale(at.n, 0.08)), add(at.n, [0, 0.5, 0]), 0.25, q), out: at.n, bloom: true };
    }),
  ]);
  // The tail: a short curl, and a tuft of leaves on the end of it fanned out back and up, mostly green.
  const tuft = fronds(Array.from({ length: 7 }, (_, q): Frond => {
    const f = q / 6 - 0.5;
    const dir = unit([f * 2.2, -1, 0.35 + 0.4 * (0.5 - Math.abs(f))]);
    return { mesh: leaf([0, -0.04, 0], dir, [0, 0.2, 1], s.tail * (1 - 0.35 * Math.abs(f)), s.tail * 0.4, K, q === 3 ? 'pink' : 'green', 0.15), out: [0, 0, 1] };
  }));
  // The mane: its front rows round the neck (`ruff`), going down with the head; the rest, and the leaves down the back, on the body.
  const rows = s.ruff.map((_, r) => r);
  const ruff = fronds(ruffRows(s, rows.filter((r) => r < NECK_ROWS), K));
  const mane = fronds([...ruffRows(s, rows.filter((r) => r >= NECK_ROWS), K), ...backLeaves(s, K)]);
  const bib = fronds(bibOf(s, K));
  const blooms = fronds(maneFlowers(s));
  const ruffLen = s.ruff[s.ruff.length - 1][1];
  const legs = (fore: boolean): { upper: [number, number, number, number]; lower: [number, number, number, number]; foot: Mesh } => {
    const L = (fore ? 0.5 : 0.54) * s.legs, w = s.thick;
    return { upper: [fore ? 0.3 : 0.05, -L, w * (fore ? 2.0 : 1.5), w * 1.05], lower: [0, -L, w, w * 0.7], foot: cloven(w * 0.8, s.hoof, n) };
  };
  // A heavy boar's quarters, part of the barrel: a ham bulging out of the rump over each hind leg, with a pink patch on it, and a
  // mass of shoulder over each fore leg, both reaching down to where the leg comes out from under the body.
  const spec = specOf(s), w = s.thick;
  const quarters = merge(...[1, -1].flatMap((sd) => {
    const hip = spec.hind.at, sh = spec.fore.at, ham: V3 = [sd * (hip[0] + w * 0.15), hip[1] - 0.05, hip[2] + 0.22];
    const hr: V3 = [w * 1.15 + 0.12, w * 1.6 + 0.15, s.body.h[2] * 0.55];
    return [
      orb(ham, hr, n, k, 'coat'),
      orb([sd * (sh[0] + w * 0.1), sh[1], sh[2] + 0.25], [w * 1.0 + 0.12, w * 1.35 + 0.12, s.body.h[4] * 0.5], n, k, 'coat'),
      paint([disc(add(ham, [sd * (hr[0] + 0.02), 0, -0.05]), [sd, -0.15, 0], hr[1] * 0.45, hr[2] * 0.45, 8, 'mark')]),
    ];
  }));
  const pieces = quadPieces({
    n, k,
    body: { ...s.body, belly: false },
    neck: { w: s.neck.w, h: s.neck.w * 0.92, len: s.neck.len },
    // The head is its own (`headOf`): this egg is only where it stands for the ears to go behind.
    head: { c: skull.c, r: skull.r, eye: { dir: [0.6, 0.6, 0.4], size: 0.01 } },
    ear: earOf(s.ear.len, s.ear.w, n),
    earTurn: -45,
    tail: [tube(curve([0, 0.04, 0], [0, -0.16, 0.08], [0, -0.24, -0.02], 3), 0.07, 0.07, 5, 'coat', { seam: 'start' }), tuft.mesh],
    fore: legs(true),
    hind: legs(false),
    breath: 0.04,
    extras: [
      { key: 'ruff', mesh: ruff.mesh, bone: 'ruff', bias: 0.16, after: ['neck', 'body'], thin: true, bent: rustling(s, ruff, s.ruff[0][1], 0) },
      { key: 'mane', mesh: mane.mesh, bone: 'trunk', bias: 0.12, after: ['body', 'neck'], thin: true, bent: rustling(s, mane, ruffLen, 0.6) },
      { key: 'bib', mesh: bib.mesh, bone: 'ruff', bias: 0.17, after: ['body', 'neck', 'fl0', 'fr0'], front: [0, 1, 0], thin: true, bent: rustling(s, bib, s.ruff[0][1], 0.3) },
      { key: 'blooms', mesh: blooms.mesh, bone: 'trunk', bias: 0.17, after: ['mane', 'ruff', 'body'], thin: true, bent: rustling(s, blooms, ruffLen, 0.6) },
      { key: 'crest', mesh: crest.mesh, bone: 'head', bias: 0.23, after: ['head', 'ear0', 'ear1'], hide: [skull], thin: true, bent: rustling(s, crest, crestL, 0.3) },
    ],
  });
  // The leaf cuffs on each lower leg, over the leg and drawn with it.
  for (const [key, side, fore] of [['fl', -1, true], ['fr', 1, true], ['hl', -1, false], ['hr', 1, false]] as Array<[string, number, boolean]>) {
    const lower = (fore ? 0.5 : 0.54) * s.legs;
    const c = cuffOf(s, lower, s.thick, K, key.charCodeAt(0) * 7 + key.charCodeAt(1));
    pieces.push({ key: `${key}cuff`, mesh: c.mesh, bone: `${key}1`, bias: 0.025, after: [`${key}1`, `${key}2`, 'body'], front: [side * 0.7, fore ? 0.7 : -0.7, 0], thin: true, bent: rustling(s, c, s.cuff, fore ? 0 : 1) });
  }
  // Its own head, eyes and all, in place of the egg; the patches painted on the barrel; and the tail's tuft rustling as the mane does.
  return pieces.map((pc) => {
    if (pc.key === 'head') return { ...pc, mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), hide: headSolids(s) };
    if (pc.key === 'body') return { ...pc, mesh: merge(pc.mesh, quarters, patches(s)) };
    if (pc.key === 'tail1') return { ...pc, bent: rustling(s, tuft, s.tail, 1.5) };
    return pc;
  });
}

/* ---- what it throws about --------------------------------------------------------------- */

const LEAF: RGB = [150, 188, 104];
const LEAF_PINK: RGB = [238, 196, 192];
const PETAL: RGB = [250, 226, 228];
const EARTH: RGB = [132, 98, 72];
const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;

/**
 * A leaf in the air, `len` long, turned `ang`: two-tone down its middle, with
 * a soft edge in a darker shade of itself, and its rib only when it is drawn
 * big enough for a rib to be more than a smudge.
 */
function flyingLeaf(g: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, c: RGB, al: number): void {
  const t = g.getTransform(), px = len * Math.hypot(t.a, t.b);
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(-len / 2, 0);
  g.quadraticCurveTo(0, -len * 0.36, len / 2, 0);
  g.quadraticCurveTo(0, len * 0.36, -len / 2, 0);
  g.fillStyle = css(c, al);
  g.fill();
  g.lineWidth = len * 0.06;
  g.strokeStyle = css(mix(c, [40, 50, 30], 0.25), al);
  g.stroke();
  g.beginPath();
  g.moveTo(-len / 2, 0);
  g.quadraticCurveTo(0, -len * 0.36, len / 2, 0);
  g.closePath();
  g.fillStyle = css(mix(c, [255, 255, 240], 0.22), al);
  g.fill();
  if (px > 9) {
    g.beginPath();
    g.moveTo(-len * 0.4, 0);
    g.lineTo(len * 0.4, 0);
    g.stroke();
  }
  g.restore();
}

/** A petal in the air: a small pale pink oval, half see-through. */
function flyingPetal(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, al: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.ellipse(0, 0, r, r * 0.6, 0, 0, TAU);
  g.fillStyle = css(PETAL, al * 0.75);
  g.fill();
  g.lineWidth = r * 0.16;
  g.strokeStyle = css([226, 160, 170], al * 0.6);
  g.stroke();
  g.restore();
}

/** A clod of earth in the air: a lumpy dark brown pebble. */
function clod(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, al: number): void {
  g.beginPath();
  for (let q = 0; q < 6; q++) {
    const t = ang + (q / 6) * TAU, k = r * (0.8 + 0.25 * Math.sin(q * 2.3 + ang));
    if (q) g.lineTo(x + Math.cos(t) * k, y + Math.sin(t) * k * 0.85);
    else g.moveTo(x + Math.cos(t) * k, y + Math.sin(t) * k * 0.85);
  }
  g.closePath();
  g.fillStyle = css(EARTH, al);
  g.fill();
  g.lineWidth = r * 0.25;
  g.strokeStyle = css([82, 58, 44], al);
  g.stroke();
}

/** A soft puff of dust on the ground at a point, `r` across. */
function dust(g: CanvasRenderingContext2D, view: View, at: V3, r: number, al: number): void {
  const [x, y] = onScreen(view, at);
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, css([176, 146, 112], al));
  grad.addColorStop(1, css([176, 146, 112], 0));
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(x, y - r * 0.15, r, r * 0.58, 0, 0, TAU);
  g.fill();
}

/** Where something thrown from `p` with velocity `v` is `s` seconds on, falling; it lies where it lands. */
const thrown = (p: V3, v: V3, s: number, fall = 9): V3 => [p[0] + v[0] * s, p[1] + v[1] * s, Math.max(0.02, p[2] + v[2] * s - 0.5 * fall * s * s)];
/** Whether a point is on the viewer's side of a body whose middle is at `c`: drawn over the body if so, under it if not. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How big a stage's things in the air are drawn, against the Snuffroot's. */
const bigness = (s: Snuff): number => s.len / 2.7;

/**
 * Dust kicked up by the hoof it scrapes as it gathers itself; and leaves and
 * petals torn off the outside of its mane as the snout goes in, flying up and
 * back and out to the sides, tumbling, and coming down.
 */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Snuff, b: Bones, at: Bones, t: number, front: boolean): void {
  const kick = hump(t, SCRAPE * 0.8, SCRAPE * 0.35);
  if (kick > 0 && front) {
    const foot = place(b.fr2, [0, -0.2, -s.hoof]);
    dust(g, view, [foot[0], foot[1] - 0.3 * (1 - kick), 0.1], (0.7 + 1.4 * (t / SCRAPE)) * bigness(s), 0.5 * kick);
  }
  const since = (t - STRIKE.hit) * ACT_SECS.strike;
  if (since <= 0) return;
  const fade = 1 - ramp(t, 0.72, 1), big = bigness(s), L = s.ruff[0][1];
  const count = 6 + 3 * s.ruff.length;
  for (let q = 0; q < count; q++) {
    const th = (q / count) * TAU + jitter(q) * 0.6;
    const root = onNeck(s, s.neck.len * 0.7, th);
    const from = place(at.ruff, add(root.p, scale(root.n, 0.6 * L)));
    const speed = 2.4 + 2.2 * jitter(q + 9);
    const v: V3 = [Math.cos(th) * speed, -1.2 + 0.8 * jitter(q + 4), 2.8 + 2.6 * jitter(q + 2) + Math.max(0, Math.sin(th)) * 1.5];
    const p = thrown(from, v, since, 6);
    if (nearSide(p, at.body.t, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    const spin = q * 1.7 + since * (6 + 6 * jitter(q + 5)) * (q % 2 ? 1 : -1);
    if (q % 3 === 2) flyingPetal(g, x, y, 0.2 * big, spin, fade);
    else flyingLeaf(g, x, y, 1.05 * big, spin, jitter(q * 3 + 1) < 0.3 ? LEAF_PINK : LEAF, fade);
  }
}

/**
 * Rooting: a patch of turned earth on the ground under the snout, and at
 * each flick of it clods thrown up and out to the sides, with a petal and a
 * leaf shaken loose from the mane, and a low puff of dust where it went in.
 * A go played once, from standing, throws nothing until its first flick.
 */
function rootSpray(g: CanvasRenderingContext2D, view: View, s: Snuff, b: Bones, at: Bones, a: Anim, t: number, front: boolean): void {
  // Where the snout goes in at the bottom of a shove, which is where the earth is turned, whatever the snout is doing now.
  const tip = place(at.head, noseOf(s).tip);
  const ground: V3 = [tip[0], tip[1], 0.05];
  const big = bigness(s) * 1.2;
  if (!front) {
    // The turned earth: a dark patch with a lump or two on it, there as long as the snout is down at it.
    const down = rootOf(t, a.graze).down;
    const [x, y] = onScreen(view, ground);
    g.fillStyle = css(mix(EARTH, [60, 44, 34], 0.35), 0.55 * down);
    g.beginPath();
    g.ellipse(x, y, 1.3 * big, 0.6 * big, 0, 0, TAU);
    g.fill();
    for (let q = 0; q < 3; q++) clod(g, x + (q - 1) * 0.8 * big, y + (q % 2 ? 0.2 : -0.15) * big, 0.26 * big, q * 2.1, down);
  }
  for (const t0 of [0.29, 0.79]) {
    if (t < t0 && a.graze < 0.5) continue;
    const since = frac(t - t0) * ACT_SECS.work;
    if (since > 0.55) continue;
    const fade = 1 - smooth(since / 0.55);
    for (let q = 0; q < 9; q++) {
      const id = q + t0 * 40;
      const v: V3 = [(jitter(id) - 0.5) * 2.8, 0.1 + 1.0 * jitter(id + 3), 3.2 + 2.2 * jitter(id + 6)];
      const p = thrown(ground, v, since);
      if (nearSide(p, b.body.t, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      if (q === 7) flyingPetal(g, x, y, 0.24 * big, id + since * 8, fade);
      else if (q === 8) flyingLeaf(g, x, y, 0.95 * big, id + since * 7, LEAF, fade);
      else clod(g, x, y, (0.26 + 0.2 * jitter(id + 1)) * big, id, fade);
    }
    if (front) dust(g, view, ground, (0.9 + 2 * since) * big, 0.4 * fade);
  }
}

/**
 * Evolving: at the start a burst of leaves and petals popping out of it,
 * which covers the moment it changes into its new body; then petals and
 * leaves going up round it in a spiral, wider at the foot and gathering in
 * as they rise.
 */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Snuff, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid: V3 = [0, 0, b.body.t[2]];
  // Popping out from the middle of the body, growing to full size as they go, and gone by a quarter of the way through.
  const burst = ramp(t, 0, 0.025) * (1 - ramp(t, 0.08, 0.26)), grow = 0.4 + 0.6 * ramp(t, 0, 0.06);
  if (burst > 0) {
    const since = t * ACT_SECS.evolve;
    for (let q = 0; q < 34; q++) {
      const th = (q / 34) * TAU * 2.6 + jitter(q) * 0.7, el = (jitter(q + 40) - 0.3) * 1.6;
      const from: V3 = [Math.cos(th) * s.body.w[3] * 0.25, s.body.y[3] + Math.sin(th) * s.len * 0.2, b.body.t[2] + el * s.body.h[3] * 0.3];
      const v: V3 = [Math.cos(th) * (3 + 2.5 * jitter(q + 3)), Math.sin(th) * (3 + 2.5 * jitter(q + 5)), 2 + 3 * jitter(q + 7)];
      const p = thrown(from, v, since, 4);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      if (q % 3 === 0) flyingPetal(g, x, y, 0.36 * big * grow, q + since * 6, burst);
      else flyingLeaf(g, x, y, 1.35 * big * grow, q * 1.3 + since * 7, q % 3 === 1 ? LEAF : LEAF_PINK, burst);
    }
  }
  const fade = ramp(t, 0.1, 0.25) * (1 - ramp(t, 0.75, 1));
  const tall = s.legs + s.body.h[4] * 2 + s.head.h[2] * 2;
  const wide = s.len * 0.75;
  for (let q = 0; q < 18; q++) {
    const rise = frac(t * 1.2 + q / 18);
    const ang = (q / 18) * TAU * 3 + t * TAU * 1.4;
    const r = wide * (1 - 0.45 * rise);
    const p: V3 = [Math.cos(ang) * r * 0.75, Math.sin(ang) * r, rise * tall];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    const al = fade * Math.sin(rise * Math.PI);
    if (q % 3 === 0) flyingPetal(g, x, y, 0.3 * big, ang * 2, al);
    else flyingLeaf(g, x, y, 0.95 * big, ang * 1.5 + rise * 4, q % 3 === 1 ? LEAF : LEAF_PINK, al);
  }
}

/** Light: a small warm flash at the snout as it strikes. */
function snuffGlow(s: Snuff, b: Bones, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  if (a.act?.kind !== 'strike') return [];
  const k = hump(a.act.t, STRIKE.hit + 0.02, 0.1);
  if (k <= 0) return [];
  return [{ p: place(b.head, add(noseOf(s).tip, [0, 0.15, 0.05])), r: 0.8 * bigness(s) + 0.4, c: [255, 236, 200], a: 0.35 * k }];
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, roots and evolves. */
function snuffKind(s: Snuff): Kind {
  const bones = snuffBones(s);
  // Where everything is at the moment the snout goes in, for what is torn off then to fly from.
  const atHit = (a: Anim): Bones => bones({ ...a, act: { kind: 'strike', t: STRIKE.hit } });
  // And where it is at the bottom of a shove of its rooting, head right down, for where the earth it turns is.
  const atRoot = (a: Anim): Bones => bones({ ...a, graze: 1, act: { kind: 'work', t: 0.3 } });
  return {
    bones,
    build: (lod) => snuffBuild(s, lod),
    // The variant's coat, and its patches in the markings; the pinks of its ears and snout leaning to the patches' colour, so a
    // dun has a dusky snout; and the leaves, flowers and hooves its own, the same on every variant. A white coat's greys warm.
    palette: (coat, mark) => coatPalette(coat, mark, {
      inner: mix([240, 160, 172], mark, 0.3),
      nose: mix([236, 150, 162], mark, 0.2),
      muzzle: mix([246, 184, 190], mark, 0.15),
      pad: [168, 92, 104],
      lid: [120, 70, 72],
      eye: [58, 30, 34],
      bark: [150, 82, 62],
      leaf: LEAF,
      stem: mix(LEAF, [92, 132, 76], 0.3),
      leafDark: [128, 166, 96],
      moss: LEAF_PINK,
      shellDark: mix(LEAF_PINK, [214, 140, 152], 0.3),
      shell: [236, 200, 198],
      petal: [253, 249, 240],
      bloom: [246, 210, 92],
      hoof: [98, 72, 64],
      tooth: [244, 232, 200],
    }, 20),
    shadow: [s.len * 0.75, s.body.w[4] * 0.95],
    stride: 1.3,
    size: s.size,
    acts: ['strike', 'work'],
    glow: (b, a) => snuffGlow(s, b, a),
    extra: (g, view, b, a, under) => {
      const act = a.act;
      if (!act) return;
      const front = !under;
      if (act.kind === 'strike') strikeBurst(g, view, s, b, atHit(a), act.t, front);
      else if (act.kind === 'work') rootSpray(g, view, s, b, atRoot(a), a, act.t, front);
      else if (act.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const SNUFFLET = snuffKind(SNUFFLET_LOOK);
export const SNUFFROOT = snuffKind(SNUFFROOT_LOOK);
export const SNUFFTHORN = snuffKind(SNUFFTHORN_LOOK);
