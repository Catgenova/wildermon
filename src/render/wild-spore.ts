import {
  ACT_SECS, add, beat, bipedBones, blush, clamp, DEG, coatPalette, cross, curve, cyc, darker, disc, dot, eyes, frac, lerp, lighter, merge, mirrored, mix, moved, orb,
  orbAlong, paint, scale, smile, smooth, sub, taper, TAU, tube, unit, type Anim, type BipedPose, type BipedSpec, type Bones, type Disc, type Kind,
  type Piece,
} from './beasts';
import { cut, earMesh } from './beastkit';
import { joint, mesh, onScreen, place, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The spore line: the Sporeling, a round little cream thing sitting up under
 * a pink mushroom cap too big for it, with an acorn in its paws; which grows
 * into the Sporekin, up on its hind legs with its cap tipped back, a mantle
 * of leaves on its shoulders, a basket at its hip and a sprig of berries in
 * its paw; and then the Sporelord, a tall sage under a great broad-brimmed
 * cap hung with seed pods, in a long cloak of leaves, a basket on its back
 * and a gnarled staff in its paw. The species is still `vola` underneath, as
 * saves and the database know it.
 *
 * Each is cream fur with a blush of pink: a round head with big dark eyes, a
 * small pink nose and a smile; small round ears out from under the cap; a
 * fluffy tail tipped pink; pale feet with dark claws. The cap is the thing:
 * coral, spotted cream, cream gills under its brim, a sprig of leaves and
 * white flowers on it. All three are built by one set of functions from a
 * description of the stage (`Spore`), so a stage is its numbers. It
 * botanizes: it stoops, picks at the undergrowth with a paw, and puts what it
 * finds in its basket, or, the Sporeling, in its cheeks.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

interface Spore {
  /** Which it is, for the things a stage does its own way: what it carries, how it strikes, where it puts what it picks. */
  stage: 0 | 1 | 2;
  /** The legs: the hip on the right, thigh, shin and the drop to the sole, how they stand (thigh forward, knee), how thick at the thigh and the shin, and the foot's length. */
  leg: { at: V3; len: [number, number, number]; rest: [number, number]; w: [number, number]; foot: number };
  /** The seat: the hips' half-sizes across, along and up. */
  hips: V3;
  /** The chest's joint on the hips, and how far forward of upright it is carried. */
  chest: { at: V3; lean: number };
  /** The torso's rings in the chest's frame, bottom to top: how high, how far forward, how wide and how deep. */
  torso: { z: number[]; y: number[]; w: number[]; h: number[] };
  neck: { at: V3; len: number };
  /** The arms: the shoulder on the right, upper arm and forearm, how they hang (forward, out, elbow), how thick, and the paw's size. */
  arm: { at: V3; len: [number, number]; rest: [number, number, number]; w: [number, number]; paw: number };
  /** The head's egg in its own frame, how far nose-up it is carried; the eyes' size; the ears' length; and how long the fluff on its cheeks is (nought for none). */
  head: { c: V3; r: V3; pitch: number; eye: number; ear: number; tufts: number };
  /**
   * The cap: how far across from its middle to its rim, how high its dome, how far its brim curls down, how high over the
   * middle of the head its gills start, how far it is tipped back and to its left (degrees), how many spots, and how far
   * round its middle the head goes up into it.
   */
  cap: { r: number; h: number; droop: number; up: number; tilt: [number, number]; spots: number; stem: number };
  /** The leaves round its shoulders, in rows top to bottom: how many, how long, how far down they hang (nought out, one straight down), how high on the torso, and how far round its front they come (one: all the way). */
  mantle: Array<[number, number, number, number, number]>;
  /** The sprig on its cap: how many leaves, how long, and how many flowers. */
  sprig: { leaves: number; len: number; flowers: number };
  /** What hangs from its brim: nothing, red berries or brown seed pods; how many bunches, and how far they hang. */
  hang: { kind: 'none' | 'berry' | 'pod'; bunches: number; len: number };
  /** The tail: each of its three links' length, and how thick it is. */
  tail: { len: number; w: number };
  /** How it goes: the legs' swing at a walk and at a run, how far it rolls from foot to foot, how far its free arm swings, how much it bounces, and how far its head nods. */
  gait: { swing: [number, number]; waddle: number; armSwing: number; bounce: number; nod: number };
  size: number;
}

/** A Sporeling: round and small, sat up on its haunches under a cap wider than it is, an acorn held to its chest, a collar of leaves round its neck. */
const SPORELING_LOOK: Spore = {
  stage: 0,
  leg: { at: [0.46, 0.12, -0.08], len: [0.38, 0.28, 0.1], rest: [80, -115], w: [0.4, 0.24], foot: 0.5 },
  hips: [0.86, 0.78, 0.5],
  chest: { at: [0, 0, 0.18], lean: -6 },
  torso: { z: [-0.25, 0.05, 0.36, 0.56, 0.68], y: [0.04, 0.08, 0.06, 0.03, 0], w: [0.86, 0.88, 0.72, 0.5, 0.3], h: [0.76, 0.78, 0.62, 0.44, 0.26] },
  neck: { at: [0, 0.03, 0.6], len: 0.08 },
  arm: { at: [0.58, 0.18, 0.46], len: [0.28, 0.26], rest: [8, 6, 30], w: [0.17, 0.15], paw: 0.16 },
  head: { c: [0, 0.06, 0.6], r: [0.84, 0.78, 0.74], pitch: 0, eye: 0.17, ear: 0.36, tufts: 0.16 },
  cap: { r: 1.38, h: 0.74, droop: 0.32, up: 0.62, tilt: [12, 7], spots: 7, stem: 0.5 },
  mantle: [[12, 0.5, 0.5, 0.72, 1]],
  sprig: { leaves: 5, len: 0.62, flowers: 1 },
  hang: { kind: 'none', bunches: 0, len: 0 },
  tail: { len: 0.44, w: 0.42 },
  gait: { swing: [34, 44], waddle: 3, armSwing: 6, bounce: 0.05, nod: 4 },
  size: 1.62,
};

/** A Sporekin: up on its hind legs and taller, its cap bigger and tipped back and over, berries hanging from its brim, a mantle of leaves, a basket at its hip and a sprig of berries in its paw. */
const SPOREKIN_LOOK: Spore = {
  stage: 1,
  leg: { at: [0.38, 0.02, -0.12], len: [0.54, 0.5, 0.14], rest: [14, -28], w: [0.42, 0.26], foot: 0.62 },
  hips: [0.8, 0.7, 0.62],
  chest: { at: [0, 0, 0.2], lean: 6 },
  torso: { z: [-0.32, 0.14, 0.62, 1.06, 1.28], y: [0.02, 0.08, 0.08, 0.04, 0], w: [0.78, 0.82, 0.74, 0.55, 0.3], h: [0.66, 0.7, 0.62, 0.46, 0.26] },
  neck: { at: [0, 0.04, 1.18], len: 0.14 },
  arm: { at: [0.54, 0.1, 0.96], len: [0.48, 0.44], rest: [8, 8, 26], w: [0.16, 0.14], paw: 0.17 },
  head: { c: [0, 0.08, 0.58], r: [0.8, 0.76, 0.72], pitch: 2, eye: 0.165, ear: 0.4, tufts: 0.24 },
  cap: { r: 1.7, h: 0.9, droop: 0.38, up: 0.62, tilt: [16, 12], spots: 9, stem: 0.52 },
  mantle: [[13, 0.62, 0.62, 1.12, 0.8], [13, 0.66, 0.8, 0.82, 0.55]],
  sprig: { leaves: 6, len: 0.76, flowers: 2 },
  hang: { kind: 'berry', bunches: 3, len: 0.5 },
  tail: { len: 0.56, w: 0.44 },
  gait: { swing: [26, 38], waddle: 7, armSwing: 14, bounce: 0, nod: 3 },
  size: 1.66,
};

/**
 * A Sporelord: a tall, heavy, upright sage on big feet, under a huge cap with a broad brim, foliage and flowers on it and bunches of
 * seed pods hanging from it; a long cloak of leaves from its shoulders to its knees, a strap across its chest with a round wooden
 * buckle, a big basket on its back, and a gnarled staff in its paw.
 */
const SPORELORD_LOOK: Spore = {
  stage: 2,
  leg: { at: [0.48, 0.0, -0.14], len: [0.62, 0.56, 0.16], rest: [10, -22], w: [0.54, 0.34], foot: 0.78 },
  hips: [0.98, 0.84, 0.74],
  chest: { at: [0, 0, 0.26], lean: 4 },
  torso: { z: [-0.36, 0.2, 0.86, 1.46, 1.74], y: [0.04, 0.12, 0.1, 0.04, 0], w: [0.94, 0.98, 0.9, 0.7, 0.34], h: [0.78, 0.82, 0.74, 0.56, 0.3] },
  neck: { at: [0, 0.04, 1.6], len: 0.16 },
  arm: { at: [0.76, 0.1, 1.34], len: [0.62, 0.56], rest: [6, 10, 22], w: [0.22, 0.19], paw: 0.24 },
  head: { c: [0, 0.1, 0.62], r: [0.86, 0.8, 0.76], pitch: 2, eye: 0.155, ear: 0.44, tufts: 0.34 },
  cap: { r: 2.15, h: 0.98, droop: 0.48, up: 0.64, tilt: [10, 6], spots: 11, stem: 0.56 },
  mantle: [[16, 0.86, 0.62, 1.54, 0.72], [17, 1.04, 0.82, 1.16, 0.42], [17, 1.12, 0.9, 0.7, 0.3], [17, 1.16, 0.95, 0.22, 0.24]],
  sprig: { leaves: 8, len: 0.96, flowers: 3 },
  hang: { kind: 'pod', bunches: 3, len: 0.42 },
  tail: { len: 0.66, w: 0.56 },
  gait: { swing: [18, 28], waddle: 4, armSwing: 8, bounce: 0, nod: 2 },
  size: 1.72,
};

/** A number of its own for each leaf, nought to one, so a mantle is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);

/**
 * A value through a loop of a go, by keys of [where in the go, what], the first at nought: eased from each to the next, and
 * from the last back round to the first, so a go played over and over has no seam.
 */
function keyed(t: number, keys: ReadonlyArray<readonly [number, number]>): number {
  const u = frac(t);
  for (let i = 0; i < keys.length; i++) {
    const [t0, v0] = keys[i];
    const [t1, v1] = i + 1 < keys.length ? keys[i + 1] : [keys[0][0] + 1, keys[0][1]];
    if (u >= t0 && u < t1) return lerp(v0, v1, smooth((u - t0) / (t1 - t0)));
  }
  return keys[0][1];
}

/** A frame with its origin at `t`, its up along `z` and its forward as near `fwd` as is square to that. */
function frameAlong(t: V3, z: V3, fwd: V3): Xf {
  const Z = unit(z);
  let X = cross(fwd, Z);
  if (Math.hypot(X[0], X[1], X[2]) < 1e-4) X = [1, 0, 0];
  X = unit(X);
  const Y = cross(Z, X);
  return { m: [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]], t };
}

/* ---- the strike and the task, in time ---------------------------------------------------- */

/**
 * When each stage's blow lands, as a share of its strike: the Sporeling's cap on what it butts, the Sporekin's sprig let go
 * of at the top of its throw, the Sporelord's staff on the ground. The voice lands on these (`../audio/voice-spore`).
 */
export const SPORE_HITS: readonly number[] = [0.5, 0.46, 0.56];
/** How long the berries the Sporekin throws are in the air, from leaving the sprig to landing, as a share of the strike. */
export const BERRY_FLIGHT = 0.3;

/**
 * A go at its task, as shares of the go: the paw is down at the ground by `reach`, closes on what it has found and plucks it at
 * `pluck`, has it up and away by `lift`, and lets it go into the basket (the Sporeling: stuffs it into its cheek) at `drop`. The
 * same for every stage, so the voice's plucks and drops are where the pictures have them.
 */
export const SPORE_WORK = { reach: 0.3, pluck: 0.38, lift: 0.46, drop: 0.72 } as const;

/** How far through a go it is stooped to the ground: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.14) * (1 - ramp(t, 0.86, 1)));

/** The picking paw through a go: how far it is reaching down (nought up at the basket or the mouth, one at the ground) and how far closed on what it holds. */
function pickOf(t: number): { reach: number; grip: number; tug: number } {
  const W = SPORE_WORK;
  const reach = keyed(t, [[0, 0.8], [W.reach, 1], [W.pluck, 1], [W.lift + 0.06, 0.45], [W.drop - 0.06, 0], [W.drop + 0.06, 0]]);
  const grip = keyed(t, [[0, 0], [W.reach - 0.04, 0], [W.pluck, 1], [W.drop - 0.02, 1], [W.drop + 0.04, 0]]);
  const tug = hump(t, W.pluck + 0.02, 0.05);
  return { reach, grip, tug };
}

/** How far through a strike it has gathered itself (gone again by the blow), how hard the blow has just landed, and how settled it is after. */
function strikeOf(s: Spore, t: number): { gather: number; land: number; after: number } {
  const hit = SPORE_HITS[s.stage];
  const gather = ramp(t, 0.02, hit - 0.12) * (1 - ramp(t, hit - 0.08, hit));
  const land = t < hit ? ramp(t, hit - 0.09, hit) : Math.exp(-(t - hit) * 7) * (1 - ramp(t, 0.86, 1));
  const after = t > hit ? Math.sin(clamp((t - hit) / (1 - hit)) * Math.PI * 2) * (1 - clamp((t - hit) / (1 - hit))) : 0;
  return { gather, land, after };
}

/* ---- its bones -------------------------------------------------------------------------- */

/** A stage's body on two legs (`BipedSpec`). The tail is its own (`tailBones`). */
const specOf = (s: Spore): BipedSpec => ({
  high: s.leg.len[0] + s.leg.len[1] + s.leg.len[2],
  leg: { at: s.leg.at, len: s.leg.len, rest: s.leg.rest },
  chest: s.chest,
  neck: { at: s.neck.at, len: s.neck.len, lean: 0 },
  head: { pitch: s.head.pitch },
  arm: { at: s.arm.at, len: s.arm.len, rest: s.arm.rest },
  swing: s.gait.swing,
  waddle: s.gait.waddle,
  armSwing: s.gait.armSwing,
});

/**
 * How it holds its arms, standing or going, before anything it does: the Sporeling both paws together at its chest round its
 * acorn; the Sporekin its sprig up in its right paw; the Sporelord its staff out at its right side. Each arm: forward, out, elbow.
 */
const HOLD: ReadonlyArray<readonly [readonly [number, number, number] | null, readonly [number, number, number] | null]> = [
  [[24, -38, 56], [24, -38, 56]],
  [null, [26, 4, 72]],
  [null, [16, 14, 34]],
];

/**
 * A stage's pose over the one a body on two legs has (`bipedBones`): what it
 * holds and how; its gait -- the Sporeling's scamper, bouncing; the
 * Sporekin's waddle; the Sporelord's slow, level walk; and its moves -- the
 * strike, a go at its task, and evolving.
 */
function sporePose(s: Spore, p: BipedPose, a: Anim): void {
  const g = smooth(a.go), w = frac(a.u), G = s.gait;
  const hold = HOLD[s.stage];
  for (const k of [0, 1] as const) {
    const h = hold[k];
    if (!h) continue;
    // A held arm keeps its hold going, swinging only a little with the stride.
    const swing = p.arms[k][0] - (s.arm.rest[0] === 0 ? 0 : 0);
    p.arms[k] = [h[0] + 0.15 * (swing - (4 + 2 * a.breath)) * g, h[1], h[2]];
  }
  if (a.go > 0) {
    // A scamper bounces up off each foot, the head nodding a beat after; a waddle rolls further and keeps its head up; the big one
    // walks level, its head steady.
    // A run's leap between its strides (`bipedBones`) kept low: it is short in the leg, and a cap that size does not fly.
    p.lift *= 0.45;
    p.lift += g * G.bounce * Math.max(0, Math.sin(w * TAU * 2));
    p.head[0] += g * G.nod * Math.sin(w * TAU * 2 - 0.9);
    p.chest[0] -= g * (s.stage === 0 ? 2 : 4 + 6 * a.gait) * (s.stage === 2 ? 0.8 : 0.5);
    p.tail[1] += g * 3 * G.waddle * Math.sin(w * TAU + 1.2);
    if (s.stage === 0) {
      // Up off its haunches to scamper, crouched still, its steps short and quick.
      p.legs = p.legs.map((l) => [l[0] * 0.8 - 30 * g, l[1] - 0.45 * g, l[2]] as [number, number, number]);
    }
  } else {
    const t = a.t;
    // Standing: a look about now and then; the Sporeling nibbles at its acorn, the Sporekin sniffs its berries, the Sporelord
    // leans on its staff and nods slowly.
    const nibble = beat(t, [3.6, 11.4, 18.8], 1.4) * (1 - a.graze);
    if (s.stage === 0) {
      p.head[0] -= 10 * nibble;
      p.jaw = nibble * (0.5 + 0.5 * Math.sin(t * TAU * 5));
      p.arms[0][0] += 10 * nibble;
      p.arms[1][0] += 10 * nibble;
    } else if (s.stage === 1) {
      p.arms[1] = [p.arms[1][0] + 18 * nibble, p.arms[1][1] - 10 * nibble, p.arms[1][2] + 24 * nibble];
      p.head[0] -= 6 * nibble;
      p.head[1] -= 10 * nibble;
    } else {
      p.head[0] -= 6 * nibble;
      p.chest[0] += 2 * cyc(t, 3);
    }
  }
  const act = a.act;
  if (act?.kind === 'strike') strikePose(s, p, act.t);
  else if (act?.kind === 'work') workPose(s, p, act.t, a.graze);
  else if (act?.kind === 'evolve') {
    // Evolving: drawn up tall as the light gathers, arms out and the head up to it; at the turn a shake that sets the cap
    // wobbling; and settled.
    const t = act.t, up = ramp(t, 0.1, 0.45) * (1 - ramp(t, 0.62, 0.86)), shake = hump(t, 0.55, 0.1);
    p.chest[0] -= 10 * up;
    p.head[0] += 14 * up;
    p.head[2] += 12 * shake * Math.sin(t * 70);
    for (const k of [0, 1] as const) {
      if (s.stage === 2 && k === 1) continue;
      p.arms[k] = [lerp(p.arms[k][0], 40, up), p.arms[k][1] + 34 * up, lerp(p.arms[k][2], 20, up)];
    }
    crouch(s, p, -0.1 * up);
    p.tail[0] += 20 * up;
  }
}

/**
 * Each leg bent at the knee by `fold` more (as `bipedBones` folds a leg: the thigh forward twenty degrees and the knee back
 * fifty-five to each one of it) with the thigh brought forward or back by as much more as keeps the sole where it was, under
 * the hip: a crouch, or a stretch for a fold under nought, that never slides its feet over the ground.
 */
function crouch(s: Spore, p: BipedPose, fold: number): void {
  if (!fold) return;
  const [L1, L2] = s.leg.len, [lp, kp] = s.leg.rest;
  for (const l of p.legs) {
    const a0 = (lp + l[0] + 20 * l[1]) * DEG, b0 = (kp - 55 * l[1]) * DEG;
    const y0 = L1 * Math.sin(a0) + L2 * Math.sin(a0 + b0);
    const f = l[1] + fold, b = (kp - 55 * f) * DEG;
    // L1 sin a + L2 sin(a + b) = y0, for the thigh's a: R sin(a + phi) = y0.
    const A = L1 + L2 * Math.cos(b), B = L2 * Math.sin(b), R = Math.hypot(A, B), phi = Math.atan2(B, A);
    const a = Math.asin(clamp(y0 / R, -1, 1)) - phi;
    l[0] = a / DEG - lp - 20 * f;
    l[1] = f;
  }
}

/** Each stage's strike, over its pose. */
function strikePose(s: Spore, p: BipedPose, t: number): void {
  const k = strikeOf(s, t), hit = SPORE_HITS[s.stage];
  if (s.stage === 0) {
    // The cap-bonk: crouched down low with its head drawn up, then a spring up off both feet and a dive forward, head down, so
    // the crown of its cap leads; it butts, lands and rocks back.
    const hop = hump(t, hit - 0.04, 0.1);
    crouch(s, p, 0.45 * k.gather - 0.2 * hop);
    p.lift += 0.34 * hop - 0.04 * k.gather;
    p.chest[0] += -14 * k.gather + 46 * k.land - 10 * k.after;
    p.head[0] += 14 * k.gather - 36 * k.land + 6 * k.after;
    p.arms[0][0] -= 20 * k.land;
    p.arms[1][0] -= 20 * k.land;
    p.tail[0] += 30 * k.gather - 20 * k.land;
    return;
  }
  if (s.stage === 1) {
    // The toss: turned away and the sprig swung back low behind its hip, its weight back; then the arm swung through underarm,
    // the body turning into it, and the berries let go out of the top of the swing, out ahead of it and up -- under the brim, so
    // the swing is seen whichever way it is turned; and it follows through.
    const wind = k.gather, arc = ramp(t, hit - 0.1, hit + 0.04), through = ramp(t, hit - 0.04, hit + 0.12) * (1 - ramp(t, 0.66, 1));
    const back: [number, number, number] = [-62, 30, 24], out: [number, number, number] = [104, 0, 18];
    const arm = p.arms[1], held = 1 - Math.max(wind, through);
    p.arms[1] = [0, 1, 2].map((q) => arm[q] * held + lerp(back[q], out[q], arc) * (1 - held)) as [number, number, number];
    p.chest[2] += 24 * wind - 16 * through;
    p.chest[0] += 8 * wind + 6 * through;
    p.head[1] -= 12 * wind - 8 * through;
    p.arms[0] = [p.arms[0][0] + 26 * wind - 10 * through, p.arms[0][1] + 16 * wind, p.arms[0][2] + 20 * wind];
    // Sunk back on its haunches as it winds back, and down into the toss as it lets go.
    crouch(s, p, 0.16 * wind + 0.12 * through);
    p.tail[1] -= 20 * wind - 20 * through;
    return;
  }
  // The staff: raised high as it draws itself up tall, then driven down on the ground before it, the body dropping onto it with
  // the knees giving; a shake through it as it lands, and it rises.
  p.chest[0] += -10 * k.gather + 18 * k.land - 4 * k.after;
  p.head[0] += 10 * k.gather - 10 * k.land;
  crouch(s, p, 0.32 * k.land - 0.06 * k.gather);
  p.arms[1] = [p.arms[1][0] + 96 * k.gather + 26 * k.land, p.arms[1][1] - 12 * k.gather, p.arms[1][2] - 20 * k.gather + 10 * k.land];
  p.arms[0] = [p.arms[0][0] + 26 * k.gather + 20 * k.land, p.arms[0][1] + 20 * k.gather, p.arms[0][2] + 30 * k.gather];
  p.tail[0] += 16 * k.gather - 10 * k.land;
}

/**
 * A go at its task: stooped to the ground, a paw reaching down into the
 * undergrowth, plucking what it finds, and bringing it up -- the Sporeling to
 * its mouth, stuffing its cheek, its acorn kept in the other paw; the Sporekin
 * to the basket at its hip; the Sporelord over its shoulder to the basket on
 * its back, its staff kept in the other.
 */
function workPose(s: Spore, p: BipedPose, t: number, graze: number): void {
  const d = downOf(t, graze), k = pickOf(t), W = SPORE_WORK;
  // Stooped: the chest bowed, deepest as the paw is at the ground, the knees bent, and the head down at what it is picking.
  const deep = [54, 46, 38][s.stage], bow = deep * (0.5 + 0.5 * k.reach), knee = [0.3, 0.55, 0.5][s.stage] * (0.4 + 0.6 * k.reach);
  // The paw's reach down to the ground, against the chest bowed over it: straight down from the shoulder and a little ahead.
  const low = deep + 24;
  p.chest[0] += d * bow;
  p.chest[1] += d * 4 * k.tug;
  p.head[0] -= d * (bow * 0.45 + 10 * k.reach);
  crouch(s, p, d * knee);
  p.tail[1] += d * 14 * Math.sin(t * TAU * 2);
  if (s.stage === 0) {
    // The right paw down to the ground and up to its mouth; the left keeps its acorn at its chest; and the cheek it stuffs puffs
    // out and is chewed down again.
    const arm = p.arms[1];
    p.arms[1] = [lerp(arm[0], lerp(64, low, k.reach), d), lerp(arm[1], lerp(-30, 4, k.reach), d), lerp(arm[2], lerp(110, 8, k.reach), d)];
    p.arms[0] = [p.arms[0][0] + d * 12, p.arms[0][1], p.arms[0][2]];
    p.head[1] += d * 12 * (1 - k.reach);
    p.jaw = d * Math.max(0, Math.sin((t - W.drop) * TAU * 6)) * ramp(frac(t - W.drop), 0, 0.05) * (1 - ramp(frac(t - W.drop), 0.4, 0.55));
    return;
  }
  // The left paw from the ground to the basket: at the hip, back and out; on the back, up over the shoulder.
  const arm = p.arms[0];
  const basket: [number, number, number] = s.stage === 1 ? [-28, 30, 30] : [166, 22, 120];
  const ground: [number, number, number] = [lerp(low - 30, low, k.reach), 6, 8];
  const up = 1 - k.reach;
  p.arms[0] = [lerp(arm[0], lerp(ground[0], basket[0], up), d), lerp(arm[1], lerp(ground[1], basket[1], up), d), lerp(arm[2], lerp(ground[2], basket[2], up), d)];
  // Turned to the basket as the paw comes up to it.
  p.chest[2] += d * (s.stage === 1 ? 12 : -10) * up;
  p.head[1] += d * (s.stage === 1 ? 14 : 6) * up;
  if (s.stage === 1) p.arms[1] = [p.arms[1][0] - d * 10, p.arms[1][1], p.arms[1][2]];
}

/** The tail's bones: three links from the back of the hips, swept back low and curling up, swinging as it goes. */
function tailBones(s: Spore, body: Xf, a: Anim, p: { lift: number; sway: number }): Xf[] {
  const at: V3 = [0, -s.hips[1] * 0.82, -s.hips[2] * 0.42];
  const out: Xf[] = [];
  let prev = joint(body, at, 2 - p.lift * 0.4, 0, p.sway * 0.6);
  out.push(prev);
  for (const [q, curl] of [[1, -42], [2, -46]] as const) {
    prev = joint(prev, [0, -s.tail.len, 0], curl - p.lift * 0.3 * q, 0, p.sway * 0.3);
    out.push(prev);
  }
  void a;
  return out;
}

/** How far a stage's feet carry its body over the ground in a stride at a walk, in its own units: what its staff, planted, must keep pace with. */
function reachOf(spec: BipedSpec, own: (p: BipedPose, a: Anim) => void): number {
  const still: Anim = { t: 0, u: 0, go: 1, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 };
  const N = 48;
  const ys: number[] = [], zs: number[] = [];
  for (let q = 0; q <= N; q++) {
    const b = bipedBones(spec, { ...still, u: q / N }, own);
    const f = place(b.ll2, [0, 0, 0]);
    ys.push(f[1]);
    zs.push(f[2]);
  }
  const floor = Math.min(...zs) + 0.04;
  let back = 0, time = 0;
  for (let q = 0; q < N; q++) {
    if (zs[q] <= floor && ys[q + 1] < ys[q]) { back += ys[q] - ys[q + 1]; time += 1 / N; }
  }
  return time > 0 ? back / time : 1;
}

/** Where the Sporelord's staff stands on the ground standing, against its feet: out to its right and a little ahead. */
const STAFF_REST = (s: Spore): V3 => [s.arm.at[0] + 0.62, 0.72, 0];
/** The staff's length. */
const staffLen = (s: Spore): number => s.arm.at[2] + s.chest.at[2] + s.leg.len[0] + s.leg.len[1] + 1.4;
/** Where the end of the staff comes down as it strikes: further ahead, before its right foot. */
const STAFF_HIT = (s: Spore): V3 => [s.arm.at[0] + 0.3, 1.9, 0];

/**
 * The bones of a stage: a body on two legs (`bipedBones`) with its own pose
 * over it, its tail, the cap on its own bone on the head (wobbling as it goes
 * and as it strikes), the basket at its hip swinging, and the Sporelord's
 * staff, its end on the ground -- planted and left there while the body walks
 * past it, and swung forward to be planted again -- and its paw on it.
 */
function sporeBones(s: Spore): (a: Anim) => Bones {
  const spec = specOf(s);
  let reach: number | undefined;
  return (a) => {
    const act = a.act;
    // Striking or at its task it is posed from standing, its own stoop doing what grazing would; whether it was grazing is
    // what says the go is looping.
    const base = act && act.kind !== 'evolve' ? { ...a, graze: 0 } : a;
    const own = (p: BipedPose): void => sporePose(s, p, a);
    const b = bipedBones(spec, base, own);
    const g = smooth(a.go), w = frac(a.u);
    // The tail: swept along the ground behind, swinging with the waddle, lifted as it gathers itself and evolves.
    let lift = 0, sway = 10 * cyc(a.t, 4) * (1 - g) + g * 3 * s.gait.waddle * Math.sin(w * TAU + 1.4);
    if (act?.kind === 'strike') lift += 24 * strikeOf(s, act.t).gather;
    if (act?.kind === 'evolve') lift += 26 * ramp(act.t, 0.1, 0.45) * (1 - ramp(act.t, 0.62, 0.86));
    if (act?.kind === 'work') sway += 16 * downOf(act.t, a.graze) * Math.sin(act.t * TAU * 2);
    tailBones(s, b.body, a, { lift, sway }).forEach((x, q) => { b[`tail${q}`] = x; });
    // The cap on the head, tipped back and over, and wobbling a beat behind the head: at each bounce of a scamper, as it lands its
    // blow, and as it shakes evolving.
    const C = s.cap;
    let wob = 0, wobR = 0;
    if (a.go > 0) {
      wob += g * (s.stage === 0 ? 7 : 3) * Math.sin(w * TAU * 2 - 2.0);
      wobR += g * (s.stage === 1 ? 4 : 2) * Math.sin(w * TAU - 1.6);
    }
    if (act?.kind === 'strike') {
      const t = act.t, hit = SPORE_HITS[s.stage];
      wob += [14, 6, 9][s.stage] * Math.sin(clamp((t - hit) / 0.3) * Math.PI * 3) * (1 - clamp((t - hit) / 0.3)) * (t > hit ? 1 : 0);
    }
    if (act?.kind === 'evolve') wobR += 8 * hump(act.t, 0.6, 0.12) * Math.sin(act.t * 50);
    b.cap = joint(b.head, add(s.head.c, [0, 0, C.up]), C.tilt[0] + wob, -C.tilt[1] - wobR, 0);
    // The basket at its hip, hung from its strap: swinging fore and aft with the stride, out with the waddle.
    if (s.stage === 1) {
      const sw = g * (10 + 8 * a.gait) * Math.sin(w * TAU * 2 - 1.2), out = g * 6 * Math.sin(w * TAU - 1.5);
      b.basket = joint(b.body, [-s.hips[0] * 1.08, -0.08, s.hips[2] * 0.75], sw, 4 + out, -8);
    }
    if (s.stage === 2) {
      reach ??= reachOf(spec, (p, aa) => sporePose(s, p, aa));
      b.staff = staffOf(s, b, a, reach);
    }
    return b;
  };
}

/**
 * The Sporelord's staff as a bone: up from where its end is on the ground through its right paw. Standing, its end stands out to
 * the right; walking, it is planted as the left foot comes down and left where it is while the body walks past it -- as fast as
 * the feet carry it -- and then swung forward through the air to be planted again; striking, it is raised high and driven down
 * before it.
 */
function staffOf(s: Spore, b: Bones, a: Anim, reach: number): Xf {
  const rest = STAFF_REST(s), g = smooth(a.go), w = frac(a.u);
  // Planted for the first sixty hundredths of a stride, from as the left foot comes down.
  const plant = 0.6, D = reach;
  let tip = rest;
  if (g > 0) {
    const u = frac(w + 0.12);
    let y: number, z = 0;
    if (u < plant) y = rest[1] + D * (plant / 2 - u);
    else {
      const f = (u - plant) / (1 - plant);
      y = rest[1] + D * (-plant / 2 + plant * smooth(f));
      z = 0.5 * Math.sin(Math.PI * f) * (0.6 + 0.4 * a.gait);
    }
    tip = [rest[0], lerp(rest[1], y, g), z * g];
  }
  const act = a.act;
  if (act?.kind === 'strike') {
    const t = act.t, hit = SPORE_HITS[2], k = strikeOf(s, t);
    const high: V3 = [rest[0] - 0.25, 1.5, 2.6];
    const to = STAFF_HIT(s);
    const raise = ramp(t, 0.04, hit - 0.12), drive = ramp(t, hit - 0.1, hit), back = ramp(t, hit + 0.12, 0.98);
    const lifted: V3 = [lerp(rest[0], high[0], raise), lerp(rest[1], high[1], raise), lerp(0, high[2], raise)];
    const driven: V3 = [lerp(lifted[0], to[0], drive), lerp(lifted[1], to[1], drive), lerp(lifted[2], 0, drive)];
    tip = [lerp(driven[0], rest[0], back), lerp(driven[1], rest[1], back), Math.max(0, lerp(driven[2], 0, back) + 0.06 * k.after)];
  }
  const hand = place(b.hand1, [0, s.arm.paw * 0.3, -s.arm.paw * 0.6]);
  return frameAlong(tip, sub(hand, tip), [0, 1, 0]);
}

/* ---- leaves and flowers ---------------------------------------------------------------- */

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

/** The corners of a flat shape in the order that faces it out along `n`. */
function outward(v: V3[], n: V3): V3[] {
  let nx = 0, ny = 0, nz = 0;
  for (let q = 0; q < v.length; q++) {
    const a = v[q], b = v[(q + 1) % v.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return nx * n[0] + ny * n[1] + nz * n[2] < 0 ? [...v].reverse() : v;
}

/**
 * A thin flat thing along a line of points -- a leaf, a petal -- `widths`
 * across it (half-widths) at each, its face turned along `face`, its edges
 * lifted by `fold` of its width so it is a shallow V down its middle: the
 * half to its left in `mats[0]`, to its right in `mats[1]`, its underside in
 * `mats[2]`. No thickness: a top and an underside, whichever is turned to the
 * viewer drawn.
 */
function sheet(pts: readonly V3[], widths: readonly number[], face: V3, fold: number, mats: readonly [Mat, Mat, Mat]): Mesh {
  const K = pts.length, v: V3[] = [], f: Face[] = [], want: V3[] = [], ns: V3[] = [];
  for (let k = 0; k < K; k++) {
    const d = unit(sub(pts[Math.min(K - 1, k + 1)], pts[Math.max(0, k - 1)]));
    const n = unit(sub(face, scale(d, dot(face, d)))), side = unit(cross(d, n)), w = widths[Math.min(k, widths.length - 1)];
    const row: V3[] = [add(add(pts[k], scale(side, -w)), scale(n, fold * w)), pts[k], add(add(pts[k], scale(side, w)), scale(n, fold * w))];
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

/** The two colours a leaf comes in: sage green, or green blushed pink; each a top in two halves and an underside. */
type Tone = 'green' | 'pink';
const TONES: Record<Tone, readonly [Mat, Mat, Mat]> = { green: ['leaf', 'stem', 'leafDark'], pink: ['moss', 'membrane', 'tongue'] };
/** Which of the two colours a leaf is: mostly green, now and then blushed pink. */
const toneOf = (i: number, pink = 0.24): Tone => (jitter(i * 3 + 1) < pink ? 'pink' : 'green');

/**
 * A leaf: a pointed oval along a gentle arch from `root` in the way `dir`
 * goes, `len` long and `w` across at its widest, its face turned along
 * `face` and arched out that way; serrated along its edges when it is cut
 * finely enough to show it, as the leaves of a herb are.
 */
function leaf(root: V3, dir: V3, face: V3, len: number, w: number, K: number, tone: Tone, arch = 0.14): Mesh {
  const d = unit(dir), f = unit(sub(face, scale(d, dot(face, d))));
  const tip = add(root, scale(d, len)), mid = add(add(root, scale(d, len * 0.5)), scale(f, len * arch));
  const widths = Array.from({ length: K }, (_, k) => {
    const u = k / (K - 1);
    const saw = K > 5 && k > 0 && k < K - 1 ? (k % 2 ? 1.12 : 0.84) : 1;
    return Math.max(0.02, w * Math.sin(Math.PI * u ** 0.8) ** 0.9 * saw);
  });
  return sheet(curve(root, mid, tip, K - 1), widths, f, 0.25, TONES[tone]);
}

/**
 * A small five-petalled flower at `c`, facing along `n`, `r` across: white
 * petals round a yellow middle, each petal a sheet with its colour painted on
 * both faces always lit, so a flower turned from the light is still white.
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
  for (const sd of [1, -1]) paints.push(disc(add(c, scale(z, sd * r * 0.16)), scale(z, sd), r * 0.26, r * 0.26, 7, 'bloom', { lit: true }));
  return merge(...petals, orbAlong(add(c, scale(z, r * 0.14)), z, [r * 0.28, r * 0.28, r * 0.14], 6, 3, 'bloom'), paint(paints));
}

/** A berry: a round red ball with a glint on it, and a dark dot where its flower was. */
function berry(c: V3, r: number, n: number, mat: Mat = 'ember'): Mesh {
  return merge(orb(c, r, n, 4, mat), paint([disc(add(c, [-r * 0.35, -r * 0.3, r * 0.62]), [-0.4, -0.35, 0.85], r * 0.28, r * 0.28, 5, 'glint', { lit: true })]));
}

/** A seed pod: a brown teardrop hanging from its point, with a paler cap where it hangs and ribs down it. */
function pod(top: V3, len: number, n: number): Mesh {
  const r = len * 0.36;
  return merge(
    tube([add(top, [0, 0, 0]), add(top, [0, 0, -len * 0.3]), add(top, [0, 0, -len * 0.7]), add(top, [0, 0, -len])], [r * 0.4, r * 0.95, r, r * 0.3], [r * 0.4, r * 0.95, r, r * 0.3], n,
      (ring, j) => (ring === 0 ? 'horn' : j % 2 ? 'hornDark' : 'bark')),
  );
}

/** One leaf or flower of a piece of them: its mesh, the way it lifts when it rustles, and whether it is a flower, which pops open as it evolves. */
interface Frond { mesh: Mesh; out: V3; bloom?: boolean }
/** A mesh of leaves and flowers with, for each corner, how far out along its leaf it is, which way it lifts, and the middle of its flower. */
interface Fronds { mesh: Mesh; w: number[]; out: V3[]; mid: Array<V3 | null> }
function fronds(parts: readonly Frond[]): Fronds {
  const w: number[] = [], out: V3[] = [], mid: Array<V3 | null> = [];
  for (const p of parts) {
    const K = p.mesh.v.length / 6;
    const c = p.bloom ? scale(p.mesh.v.reduce((t, q) => add(t, q), [0, 0, 0] as V3), 1 / p.mesh.v.length) : null;
    p.mesh.v.forEach((_, i) => { w.push(p.bloom ? 0.5 : Math.floor(i / 6) / Math.max(1, K - 1)); out.push(p.out); mid.push(c); });
  }
  return { mesh: merge(...parts.map((p) => p.mesh)), w, out, mid };
}

/**
 * How far the leaves are lifted off it this moment, as a share of their
 * length, and how far they bounce: stirring now and then as it stands,
 * bouncing as it goes, lifted as it gathers itself to strike and shaken as
 * the blow lands, stirred as it stoops at its task, and lifted as it evolves.
 */
function rustle(s: Spore, a: Anim, phase: number): { lift: number; bounce: number } {
  let lift = 0.04 * beat(a.t, [4.6, 13.9, 21.2], 1.2) * (1 - a.go);
  let bounce = a.go > 0 ? smooth(a.go) * (0.05 + s.gait.bounce + 0.04 * a.gait) * Math.sin(frac(a.u) * TAU * 2 - 1.2 - phase) : 0;
  const act = a.act;
  if (act?.kind === 'strike') {
    const k = strikeOf(s, act.t);
    lift += 0.16 * k.gather + 0.12 * k.land;
    bounce += 0.08 * k.after;
  } else if (act?.kind === 'work') {
    const d = downOf(act.t, a.graze);
    lift += d * 0.06 * pickOf(act.t).tug;
    bounce += d * 0.04 * Math.sin(act.t * TAU * 2 - phase);
  } else if (act?.kind === 'evolve') {
    lift += 0.24 * hump(act.t, 0.5, 0.25);
    bounce += 0.05 * hump(act.t, 0.55, 0.12) * Math.sin(act.t * 70 - phase);
  }
  return { lift, bounce };
}

/** A piece of leaves that rustles (`rustle`): every corner moved by as far out along its leaf as it is; its flowers popping open as it evolves. */
function rustling(s: Spore, f: Fronds, len: number, phase: number, grows?: V3): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const { lift, bounce } = rustle(s, a, phase);
    const pop = a.act?.kind === 'evolve' ? 0.6 * hump(a.act.t, 0.55, 0.14) : 0;
    const k = grows && a.act?.kind === 'evolve' ? growOf(a.act.t) : 1;
    if (!lift && !bounce && !pop && k === 1) return v as V3[];
    return v.map((p, i) => {
      const u = f.w[i] * len, c = f.mid[i];
      let q: V3 = c && pop ? add(c, scale(sub(p, c), 1 + pop)) : p;
      q = [q[0] + f.out[i][0] * lift * u, q[1] + f.out[i][1] * lift * u, q[2] + f.out[i][2] * lift * u + bounce * u];
      return grows && k !== 1 ? add(grows, scale(sub(q, grows), k)) : q;
    });
  };
}

/**
 * How big the cap and all on it is, evolving, against its full size: from
 * well under it as the new body comes out of the spores, swelling up to it by
 * the flash, a little past it at the turn, and settling.
 */
const growOf = (t: number): number => 0.42 + 0.58 * ramp(t, 0.06, 0.5) + 0.14 * hump(t, 0.56, 0.08);

/* ---- the cap ------------------------------------------------------------------------------- */

/** Where a point on the top of the cap is, `u` from its crown (nought) to its rim (one) and `th` round it, and the way out of it there. */
function capTop(C: Spore['cap'], u: number, th: number): { p: V3; n: V3 } {
  const at = (uu: number): [number, number] => [C.r * Math.sin((clamp(uu) * Math.PI) / 2) ** 0.8, C.h * (1 - clamp(uu) ** 2.2) - C.droop * clamp(uu) ** 4];
  const [r, z] = at(u), e = 0.01;
  const [r1, z1] = at(u + e), [r0, z0] = at(u - e);
  const dr = r1 - r0, dz = z1 - z0;
  const c = Math.cos(th), s = Math.sin(th);
  // Square to the profile: out from the axis and up.
  const n = u < 0.02 ? [0, 0, 1] as V3 : unit([dz * c, dz * s, -dr]);
  return { p: [r * c, r * s, z], n: n[2] < 0 && u < 0.5 ? scale(n, -1) : n };
}
/** Where a point on its underside is, `v` from just in from the rim (nought) to where it goes into the head (one), and the way out of it, down. */
function capUnder(C: Spore['cap'], v: number, th: number): { p: V3; n: V3 } {
  const lip = C.droop * 0.22 + 0.06;
  const r = lerp(C.r * 0.95, C.stem, v), z = lerp(-C.droop - lip * 0.3, C.h * 0.08, smooth(v) ** 0.8);
  const c = Math.cos(th), s = Math.sin(th);
  return { p: [r * c, r * s, z], n: unit([c * 0.35, s * 0.35, -1]) };
}

/**
 * The cap: a dome of coral pink, its brim curling down at the edge, cream
 * spots of every size over it, a cream rim, and under it the gills, cream with
 * fine radial lines. Built in the cap's frame, its middle over the head and
 * its axis up; the gills' ring goes up into the head.
 */
function capOf(s: Spore, n: number, K: number): Mesh {
  const C = s.cap, v: V3[] = [], f: Face[] = [], want: V3[] = [];
  const N = n + 6;
  // The crown, then rings out to the rim along the top, then in under it to the head.
  v.push([0, 0, C.h]);
  const rows: Array<{ p: (th: number) => V3; top: boolean }> = [];
  for (let k = 1; k <= K; k++) rows.push({ p: (th) => capTop(C, k / K, th).p, top: true });
  for (let k = 0; k <= 3; k++) rows.push({ p: (th) => capUnder(C, k / 3, th).p, top: false });
  for (const row of rows) for (let j = 0; j < N; j++) v.push(row.p(((j + 0.5) / N) * TAU));
  const ring = (r: number, j: number): number => 1 + r * N + ((j + N) % N);
  const mid: V3 = [0, 0, -C.droop - C.h * 0.4];
  for (let j = 0; j < N; j++) {
    f.push({ i: [0, ring(0, j), ring(0, j + 1)], m: 'cap' });
    want.push([0, 0, 1]);
  }
  for (let r = 0; r < rows.length - 1; r++) {
    const top = rows[r].top, nextTop = rows[r + 1].top;
    // The band at the rim, from the last ring on top to the first under it, is the cream edge of the gills seen side on.
    const m: Mat = top && nextTop ? 'cap' : top ? 'shell' : 'shell';
    for (let j = 0; j < N; j++) {
      const idx = [ring(r, j), ring(r, j + 1), ring(r + 1, j + 1), ring(r + 1, j)];
      const c = scale(idx.reduce((t, i) => add(t, v[i]), [0, 0, 0] as V3), 0.25);
      f.push({ i: idx, m });
      want.push(top && nextTop ? unit(sub(c, mid)) : top ? unit([c[0], c[1], -0.4]) : unit([c[0] * 0.3, c[1] * 0.3, -1]));
    }
  }
  const body = mesh(v, wound(v, f, want));
  // The spots: cream, of every size, scattered over the top, the biggest toward the crown.
  const spots: Disc[] = [];
  for (let q = 0; q < C.spots; q++) {
    const u = Math.sqrt((q + 0.4) / C.spots) * 0.86, th = q * 2.39996 + 0.6;
    const at = capTop(C, u, th), r = C.r * (0.15 + 0.06 * jitter(q + 3)) * (1 - 0.35 * u);
    spots.push(disc(add(at.p, scale(at.n, 0.025)), at.n, r * (1.1 + 0.3 * jitter(q)), r * (0.8 + 0.2 * jitter(q + 9)), 9, 'spot', { spin: jitter(q + 5) * TAU }));
  }
  // The gills: fine lines out from the stem to the rim, a darker cream, faced down.
  const gills: Disc[] = [];
  const G = Math.round(N * 2.5);
  for (let q = 0; q < G; q++) {
    const th = (q / G) * TAU + 0.1, wv = 0.018 * C.r;
    const a = capUnder(C, 0.06, th), b = capUnder(C, 0.9, th), side: V3 = [-Math.sin(th) * wv, Math.cos(th) * wv, 0];
    const lo = (p: V3, nn: V3): V3 => add(p, scale(nn, 0.02));
    gills.push({ v: outward([add(lo(a.p, a.n), side), sub(lo(a.p, a.n), side), sub(lo(b.p, b.n), side), add(lo(b.p, b.n), side)], [0, 0, -1]), m: 'shellDark' });
  }
  return merge(body, paint(spots), paint(gills));
}

/**
 * The sprig on top of the cap toward its left front -- leaves fanned out from
 * a knot, white flowers in among them -- and what hangs from its brim: bunches
 * of red berries, or brown seed pods on their stalks. In the cap's frame.
 */
/** Where round the cap its sprig is: to its left and a little behind, clear of its face from either side. */
const SPRIG_TH = Math.PI * 1.08;

function capDeco(s: Spore, n: number, K: number): { sprig: Fronds; hang: Array<{ mesh: Mesh; dir: V3 }> } {
  const C = s.cap, S = s.sprig;
  const knot = capTop(C, 0.58, SPRIG_TH);
  const out: Frond[] = [];
  for (let q = 0; q < S.leaves; q++) {
    const f = S.leaves > 1 ? q / (S.leaves - 1) - 0.5 : 0, id = 700 + q;
    const fan = f * 2.2 + 0.3 * (jitter(id) - 0.5);
    // Fanned round the knot, lying back along the dome and lifted off it.
    const along = unit(add(scale([Math.cos(SPRIG_TH + fan), Math.sin(Math.PI * 0.78 + fan), 0], 1), scale(knot.n, 0.75 + 0.3 * jitter(id + 1))));
    const len = S.len * (1.2 + 0.35 * jitter(id + 2)) * (1 - 0.2 * Math.abs(f));
    out.push({ mesh: leaf(add(knot.p, scale(knot.n, 0.04)), along, add(knot.n, [0, 0, 0.3]), len, len * 0.42, K, q === S.leaves - 1 ? 'pink' : 'green', 0.12), out: knot.n });
  }
  for (let q = 0; q < S.flowers; q++) {
    const th = SPRIG_TH + (q - (S.flowers - 1) / 2) * 0.32;
    const at = capTop(C, 0.5 - 0.1 * (q % 2), th);
    out.push({ mesh: flower(add(at.p, scale(at.n, 0.2 + 0.06 * q)), add(at.n, [0.1, 0.25, 0.4]), 0.25 + 0.03 * s.stage, q * 0.9), out: at.n, bloom: true });
  }
  const sprig = fronds(out);
  if (s.hang.kind === 'none') return { sprig, hang: [] };
  // Bunches from under the brim on its left, round toward the back, each on a stalk hanging straight down.
  const bunches: Array<{ mesh: Mesh; dir: V3 }> = [];
  for (let q = 0; q < s.hang.bunches; q++) {
    const hang: Mesh[] = [];
    const th = Math.PI * (0.62 + 0.22 * q) + 0.1 * jitter(q);
    const at = capTop(C, 0.97, th), top = add(at.p, [0, 0, -0.05]);
    const L = s.hang.len * (0.8 + 0.4 * jitter(q + 4));
    const end = add(top, [0, 0, -L]);
    hang.push(taper([top, add(top, [0.03, 0, -L * 0.5]), end], 0.035, 0.025, 4, s.hang.kind === 'pod' ? 'hornDark' : 'stem'));
    if (s.hang.kind === 'berry') {
      for (let e = 0; e < 3; e++) {
        const a = e * 2.1 + q;
        hang.push(berry(add(end, [Math.cos(a) * 0.1, Math.sin(a) * 0.1, -0.08 * e]), 0.12 + 0.02 * jitter(q * 3 + e), n));
      }
    } else {
      for (let e = 0; e < 3; e++) {
        const a = e * 2.1 + q;
        const from = add(end, [Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0.1 * e]);
        hang.push(taper([add(end, [0, 0, 0.05]), from], 0.025, 0.02, 4, 'hornDark'), pod(from, 0.4 + 0.06 * jitter(q + e), n));
      }
    }
    bunches.push({ mesh: merge(...hang), dir: [Math.cos(th), Math.sin(th), 0] });
  }
  return { sprig, hang: bunches };
}

/* ---- the head ------------------------------------------------------------------------------- */

/**
 * The head: a round egg, a soft muzzle low at its front with a small pink
 * nose and a smile under it, a blush on each cheek, and big dark eyes set on
 * the curve of it, under the brim. Fluff out of each cheek on a grown one.
 */
function headOf(s: Spore, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, c = H.c, r = H.r;
  const skull = orb(c, r, n + 1, k + 1, 'coat');
  const muzzle = orbAlong(add(c, [0, r[1] * 0.74, -r[2] * 0.36]), [0, 1, -0.2], [r[0] * 0.42, r[1] * 0.3, r[2] * 0.32], n, k, 'muzzle');
  const noseAt = add(c, [0, r[1] * 1.0, -r[2] * 0.2]);
  const nose = orbAlong(noseAt, [0, 1, 0.2], [r[0] * 0.13, r[1] * 0.08, r[2] * 0.1], 6, 3, 'nose');
  const mouth = smile(add(c, [0, r[1] * 0.98, -r[2] * 0.46]), [0, 1, -0.35], r[0] * 0.3, 'lid');
  const cheeks = blush(c, r, [0.66, 0.6, -0.42], r[0] * 0.17);
  const look = eyes(c, r, [0.46, 0.84, -0.06], H.eye, { tall: 1.14, shut, rim: 0.08, glint: 0.4, at: true });
  // Fluff out of each cheek, swept back: a few short cones.
  const tufts = H.tufts > 0 && merge(...[1, -1].flatMap((sd) => [0, 1, 2].map((q) => {
    const root = add(c, [sd * r[0] * 0.86, r[1] * (0.05 - 0.2 * q), -r[2] * (0.3 + 0.12 * q)]);
    return taper([root, add(root, [sd * H.tufts * (0.8 - 0.15 * q), -H.tufts * 0.55, -H.tufts * (0.25 + 0.1 * q)])], 0.13, 0.01, 5, 'coat');
  })));
  return merge(skull, muzzle, nose, mouth, cheeks, tufts, look);
}

/** The cheek the Sporeling stuffs: a round pouch on its right cheek, swelling as it stuffs it. */
function cheekOf(s: Spore, n: number, k: number): { mesh: Mesh; c: V3 } {
  const H = s.head, c = add(H.c, [H.r[0] * 0.66, H.r[1] * 0.46, -H.r[2] * 0.36]);
  return { mesh: orb(c, [H.r[0] * 0.36, H.r[1] * 0.32, H.r[2] * 0.32], n, k, 'coat'), c };
}

/* ---- what it carries -------------------------------------------------------------------- */

/** An acorn: a round brown nut in a cap of darker scales, with a little stalk; `r` across, its point down along -z. */
function acornOf(r: number, n: number): Mesh {
  return merge(
    orbAlong([0, 0, -r * 0.2], [0, 0, 1], [r, r, r * 1.15], n, 5, 'crystal'),
    orbAlong([0, 0, r * 0.5], [0, 0, 1], [r * 1.08, r * 1.08, r * 0.52], n, 4, 'crystalDark'),
    taper([[0, 0, r * 0.95], [0, 0.04, r * 1.3]], r * 0.14, r * 0.08, 4, 'crystalDark'),
    paint([disc([r * 0.35, r * 0.45, r * 0.05], [0.4, 0.6, 0.3], r * 0.2, r * 0.3, 5, 'glint', { lit: true })]),
  );
}

/** Where the Sporekin's sprig is held in its paw, and how it is turned: out of the fist along the forearm. */
const SPRIG_AT = (s: Spore): V3 => [0, s.arm.paw * 0.2, -s.arm.paw * 0.7];
const SPRIG_PITCH = 168;
/** The middle of the bunch of berries at the end of the sprig, in the paw's frame: what is thrown. */
const sprigTip = (s: Spore): V3 => moved(mesh([[0, 0.14, 0.86]], []), SPRIG_AT(s), 0, SPRIG_PITCH, 0).v[0];

/** A sprig of berries held up by its stalk: a stalk with three leaves on it and a bunch of red berries on short stalks at its top, along +z. */
function berrySprig(n: number, K: number): { mesh: Mesh; tip: V3 } {
  const stalk = taper(curve([0, 0, -0.1], [0.05, 0.05, 0.4], [0, 0.12, 0.8], 3), 0.04, 0.025, 4, 'stem');
  const leaves = [0, 1, 2].map((q) => leaf([0.02, 0.06 + 0.02 * q, 0.3 + 0.18 * q], [q % 2 ? 0.8 : -0.8, 0.2, 0.6], [0, 1, 0.2], 0.42 - 0.06 * q, 0.15, K, 'green', 0.1));
  const tip: V3 = [0, 0.14, 0.86];
  const berries: Mesh[] = [];
  for (let q = 0; q < 6; q++) {
    const a = q * 2.4, h = 0.04 + 0.08 * (q % 3);
    const at = add(tip, [Math.cos(a) * 0.17, Math.sin(a) * 0.17, h]);
    berries.push(taper([tip, at], 0.02, 0.015, 3, 'stem'), berry(at, 0.12, n));
  }
  return { mesh: merge(stalk, ...leaves, ...berries), tip };
}

/**
 * The Sporelord's staff, along +z from its end on the ground: a gnarled
 * stick, kinked and knotted, thicker at its head, which hooks over; a vine
 * wound round it with leaves on it, and seed pods hanging from the hook.
 */
function staffMesh(len: number, n: number, K: number): Mesh {
  const pts: V3[] = Array.from({ length: 8 }, (_, q) => {
    const f = q / 7;
    return [0.06 * Math.sin(q * 2.1) * (q > 0 ? 1 : 0), 0.05 * Math.cos(q * 1.7) * (q > 0 ? 1 : 0), f * len];
  });
  const head: V3[] = [pts[7], add(pts[7], [0.05, 0.12, 0.2]), add(pts[7], [0.04, 0.32, 0.22]), add(pts[7], [0.02, 0.4, 0.06])];
  const stick = tube([...pts, ...head.slice(1)], [0.09, 0.095, 0.1, 0.095, 0.105, 0.11, 0.12, 0.13, 0.12, 0.1, 0.07], [0.09, 0.095, 0.1, 0.095, 0.105, 0.11, 0.12, 0.13, 0.12, 0.1, 0.07], 6,
    (ring, j) => ((ring + j) % 5 === 0 ? 'billDark' : 'bark'));
  const knots = [0.3, 0.55, 0.72].map((f, q) => orb([0.08 * (q % 2 ? 1 : -1), 0.02, f * len], [0.06, 0.06, 0.09], 5, 3, 'bark'));
  // The vine: a thin green line wound up it from a third of the way, with leaves off it.
  const vine = Array.from({ length: 22 }, (_, q): V3 => {
    const f = 0.35 + 0.62 * (q / 21), a = q * 1.15;
    return [Math.cos(a) * 0.11, Math.sin(a) * 0.11, f * len];
  });
  const vineLeaves = [0.45, 0.62, 0.8, 0.95].map((f, q) => {
    const a = q * 2.3 + 0.5, root: V3 = [Math.cos(a) * 0.11, Math.sin(a) * 0.11, f * len];
    return leaf(root, [Math.cos(a), Math.sin(a), 0.5], [Math.cos(a + 1.5), Math.sin(a + 1.5), 0.3], 0.34, 0.13, K, q === 2 ? 'pink' : 'green', 0.1);
  });
  // Pods on short stalks from the hook.
  const hook = head[2];
  const pods = [0, 1, 2].flatMap((q) => {
    const top = add(hook, [0.06 * (q - 1), 0.04 * q, -0.06]), L = 0.22 + 0.08 * q;
    return [taper([top, add(top, [0, 0, -L])], 0.018, 0.015, 3, 'stem'), pod(add(top, [0, 0, -L]), 0.3, n)];
  });
  return merge(stick, ...knots, tube(vine, 0.025, 0.025, 4, 'stem', { start: false, end: false }), ...vineLeaves, ...pods);
}

/**
 * A woven basket: a round-bottomed bowl of tan wicker, the weave in two
 * shades over and under, a thick rim, and full to the top -- leaves standing
 * up out of it, a flower, red berries. Its rim's middle at the origin, its
 * bottom down along -z, `R` across.
 */
function basketOf(R: number, H: number, n: number, K: number, flowers: number, seed: number): Mesh {
  const N = n + 2;
  const zs2 = [-H, -H * 0.86, -H * 0.66, -H * 0.46, -H * 0.26, -H * 0.08, 0], rs2 = [R * 0.42, R * 0.7, R * 0.88, R * 0.97, R, R * 1.01, R * 1.02];
  const bowl = tube(zs2.map((z) => [0, 0, z] as V3), rs2, rs2.map((r) => r * 0.86), N * 2, (ring, j) => ((ring + Math.floor(j / 2)) % 2 ? 'wood' : 'woodDark'), { up: [0, 1, 0], end: false });
  const rim = tube(Array.from({ length: N + 1 }, (_, q): V3 => [Math.cos((q / N) * TAU) * R * 1.04, Math.sin((q / N) * TAU) * R * 0.9, 0]), 0.07, 0.07, 4, 'woodDark', { start: false, end: false });
  // What is in it: a mound of green under the rim, and leaves, berries and flowers standing up out of it.
  const fill = orbAlong([0, 0, -0.02], [0, 0, 1], [R * 0.95, R * 0.82, R * 0.3], N, 3, 'leafDark');
  const leaves = Array.from({ length: 5 }, (_, q) => {
    const a = q * 1.3 + seed, root: V3 = [Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.45, 0.04];
    return leaf(root, [Math.cos(a) * 0.5, Math.sin(a) * 0.5, 1], [Math.cos(a), Math.sin(a), 0.2], R * (0.9 + 0.3 * jitter(q + seed)), R * 0.3, K, toneOf(q + seed * 7, 0.3), 0.1);
  });
  const berries = [0, 1, 2].map((q) => berry([Math.cos(q * 2 + seed) * R * 0.35, Math.sin(q * 2 + seed) * R * 0.3, R * 0.2], R * 0.16, 5));
  const blooms = Array.from({ length: flowers }, (_, q) => flower([Math.cos(q * 2.6 + seed + 1) * R * 0.3, Math.sin(q * 2.6 + seed + 1) * R * 0.3, R * 0.3], [0.2, 0.3, 1], R * 0.32, q));
  return merge(bowl, rim, fill, ...leaves, ...berries, ...blooms);
}

/* ---- the body ------------------------------------------------------------------------------- */

/** A paw: a soft round mitten, pale, a little forward of the wrist. */
const pawOf = (r: number, n: number): Mesh => orbAlong([0, r * 0.25, -r * 0.55], [0, 0.3, -1], [r * 0.9, r * 0.78, r], n, 4, 'muzzle');

/** A foot: a pale padded lump forward of the ankle with three dark claws at its toes. */
function footOf(w: number, len: number, n: number): Mesh {
  const drop = w * 0.55;
  const claws = [-1, 0, 1].map((q) => {
    const root: V3 = [q * w * 0.42, len * 0.82, -drop * 0.7];
    return taper([root, add(root, [q * w * 0.08, len * 0.2, -drop * 0.25])], w * 0.16, w * 0.03, 4, 'claw');
  });
  return merge(orbAlong([0, len * 0.35, -drop * 0.55], [0, 1, 0], [w, drop * 0.6, len * 0.6], n, 4, 'muzzle'), ...claws);
}

/** A fluffy link of tail, along -y: a fat tube whose rings are ruffled into tufts, its colour going to the pink of its tip. */
function tailLink(len: number, ws: [number, number, number], n: number, q: number): Mesh {
  const N = n + 4;
  const pts: V3[] = [[0, 0.12, 0], [0, -len * 0.5, 0], [0, -len, 0]];
  const t = tube(pts, ws, ws.map((w) => w * 0.9), N, (ring) => (q === 2 || (q === 1 && ring === 1) ? 'feather' : 'coat'), { start: q === 0, end: q === 2 });
  // Ruffled: every other corner round each ring pushed out, so its edge is tufts and not a smooth sleeve.
  const v = t.v.map((p, i): V3 => {
    const ring = Math.floor(i / N), j = i % N, k = j % 2 ? 1.16 : 0.9;
    const c = pts[ring];
    return [c[0] + (p[0] - c[0]) * k, p[1], c[2] + (p[2] - c[2]) * k];
  });
  return mesh(v, t.f);
}

/** The leaves round its shoulders, in rows, on the chest: a collar, a mantle or a cloak, standing out a little and hanging down. */
function mantleOf(s: Spore, K: number): Frond[] {
  const T = s.torso, out: Frond[] = [];
  // The torso's ring at a height: its middle, half-width and half-depth.
  const ringAt = (z: number): { y: number; w: number; h: number } => {
    let k = 0;
    while (k < T.z.length - 2 && T.z[k + 1] < z) k++;
    const f = clamp((z - T.z[k]) / (T.z[k + 1] - T.z[k]));
    return { y: lerp(T.y[k], T.y[k + 1], f), w: lerp(T.w[k], T.w[k + 1], f), h: lerp(T.h[k], T.h[k + 1], f) };
  };
  s.mantle.forEach(([count, L, hang, z, front], r) => {
    const R = ringAt(z);
    for (let q = 0; q < count; q++) {
      const id = r * 41 + q + s.stage * 300;
      const th = ((q + (r % 2) * 0.5) / count) * TAU + 0.2 * (jitter(id) - 0.5) - Math.PI / 2;
      // How far round to the front it is: nought at the back, one at the middle of the front. A cloak is open at the front below its top row.
      const toFront = 0.5 + 0.5 * Math.sin(th);
      if (toFront > 1 - (1 - front) * 0.5 && front < 1) continue;
      const pad = 0.04 + 0.03 * r;
      const n: V3 = unit([Math.cos(th) / R.w, Math.sin(th) / R.h, 0]);
      const root: V3 = [Math.cos(th) * (R.w + pad), R.y + Math.sin(th) * (R.h + pad), z];
      const len = L * (0.85 + 0.3 * jitter(id + 7)) * (1 - 0.25 * toFront * (r === 0 ? 0 : 1));
      const round = scale(unit(cross(n, [0, 0, 1])), q % 2 ? 1 : -1);
      const dir = unit(add(add(scale(n, 1 - hang), [0, 0, -hang - 0.1]), scale(round, 0.25 * jitter(id + 2))));
      const face = add(add(scale(n, 1), [0, 0, 0.2]), scale(round, 0.3));
      out.push({ mesh: leaf(root, dir, face, len, len * 0.46, K, toneOf(id, s.stage === 2 ? 0.2 : 0.16), 0.12), out: unit(add(n, [0, 0, 0.3])) });
    }
  });
  // And flowers at the throat: one at the front of the top row, and on a grown one one each side as well.
  const top = s.mantle[0], R = ringAt(top[3]);
  const sides = s.stage === 0 ? [0] : s.stage === 1 ? [-0.5, 0.45] : [-0.55, 0, 0.5];
  sides.forEach((a, q) => {
    const th = Math.PI / 2 + a, n: V3 = [Math.cos(th), Math.sin(th), 0];
    const at: V3 = [Math.cos(th) * (R.w + 0.12), R.y + Math.sin(th) * (R.h + 0.12), top[3] - 0.08];
    out.push({ mesh: flower(at, add(n, [0, 0.2, 0.45]), 0.2 + 0.04 * s.stage, q * 1.3), out: n, bloom: true });
  });
  return out;
}

/**
 * The strap across the chest: from the left hip up over the front to the
 * right shoulder and down the back, a band of leather lying on the torso; and
 * on the Sporelord a round wooden buckle where it crosses the chest.
 */
function strapOf(s: Spore, n: number): Mesh {
  const T = s.torso;
  const on = (z: number, th: number, lift: number): V3 => {
    let k = 0;
    while (k < T.z.length - 2 && T.z[k + 1] < z) k++;
    const f = clamp((z - T.z[k]) / (T.z[k + 1] - T.z[k]));
    const w = lerp(T.w[k], T.w[k + 1], f) + lift, h = lerp(T.h[k], T.h[k + 1], f) + lift, y = lerp(T.y[k], T.y[k + 1], f);
    return [Math.cos(th) * w, y + Math.sin(th) * h, z];
  };
  const zTop = T.z[T.z.length - 2] + 0.04, zLow = T.z[1] - 0.1;
  const lift = 0.05 + 0.02 * s.stage;
  // Across the front from low on the left to the right shoulder, over it, and back down across the back.
  const front = Array.from({ length: 7 }, (_, q) => {
    const f = q / 6;
    return on(lerp(zLow, zTop, f), lerp(Math.PI * 1.02, Math.PI * 0.08, f), lift);
  });
  const back = Array.from({ length: 6 }, (_, q) => {
    const f = (q + 1) / 6;
    return on(lerp(zTop, zLow, f), lerp(-Math.PI * 0.06, -Math.PI * 0.98, f), lift);
  });
  const w = 0.1 + 0.04 * s.stage;
  const band = tube([...front, ...back], w, 0.035, 4, (_r, j) => (j % 2 ? 'leatherDark' : 'leather'), { start: false, end: false });
  if (s.stage < 2) return band;
  const mid = front[3], nrm = unit([mid[0], mid[1] - T.y[2], 0.1]);
  return merge(
    band,
    orbAlong(add(mid, scale(nrm, 0.06)), nrm, [0.3, 0.3, 0.09], n, 3, 'bill'),
    paint([disc(add(mid, scale(nrm, 0.16)), nrm, 0.2, 0.2, 10, 'billDark'), disc(add(mid, scale(nrm, 0.17)), nrm, 0.11, 0.11, 8, 'bill')]),
  );
}

/** Arms and legs on the upright bones: an upper and a lower tube down each, a paw and a foot. */
function limbs(s: Spore, n: number): Piece[] {
  const out: Piece[] = [];
  const A = s.arm, L = s.leg;
  for (const [k, sd] of [[0, -1], [1, 1]] as Array<[number, number]>) {
    const front: V3 = [sd, 0.35, 0];
    out.push(
      { key: `arm${k}`, mesh: tube([[0, 0, 0.12], [0, 0, -A.len[0]]], [A.w[0], A.w[0] * 0.9], [A.w[0], A.w[0] * 0.9], n, 'coat', { seam: 'both' }), bone: `arm${k}`, bias: 0.03, after: 'body', front, convex: true },
      { key: `fore${k}`, mesh: tube([[0, 0, 0.05], [0, 0, -A.len[1]]], [A.w[1], A.w[1] * 0.9], [A.w[1], A.w[1] * 0.9], n, 'coat', { seam: 'both' }), bone: `elbow${k}`, bias: 0.035, after: 'body', front, convex: true },
      { key: `hand${k}`, mesh: pawOf(A.paw, n), bone: `hand${k}`, bias: 0.04, after: ['body', `fore${k}`], front },
    );
  }
  for (const [key, sd] of [['ll', -1], ['lr', 1]] as Array<[string, number]>) {
    const front: V3 = [sd * 0.8, 0.5, 0];
    const foot = footOf(L.w[1] * 1.05, L.foot, n);
    out.push(
      // The thigh, a round haunch at its top tapering to the knee.
      { key: `${key}0`, mesh: merge(
        tube([[0, 0, 0.14], [0, 0, -L.len[0] * 0.5], [0, 0, -L.len[0]]], [L.w[0], L.w[0] * 0.95, L.w[1] * 1.05], [L.w[0], L.w[0] * 0.95, L.w[1] * 1.05], n, 'coat', { seam: 'start' }),
        orbAlong([0, 0.02, -L.len[0] * 0.3], [0, 0, 1], [L.w[0] * 1.08, L.w[0] * 1.12, L.len[0] * 0.55 + L.w[0] * 0.3], n, 4, 'coat'),
      ), bone: `${key}0`, bias: 0.01, after: ['body', 'hips'], front },
      { key: `${key}1`, mesh: tube([[0, 0, 0.05], [0, 0, -L.len[1]]], [L.w[1], L.w[1] * 0.85], [L.w[1], L.w[1] * 0.85], n, 'coat', { seam: 'both' }), bone: `${key}1`, bias: 0.015, after: 'body', front, convex: true },
      { key: `${key}2`, mesh: sd < 0 ? mirrored(foot) : foot, bone: `${key}2`, bias: 0.02, after: 'body', front },
    );
  }
  return out;
}

/** A stage's pieces. */
function sporeBuild(s: Spore, lod: number): Piece[] {
  const n = cut(lod, 8, 11), k = cut(lod, 5, 6), K = lod ? 7 : 4;
  const T = s.torso, H = s.head;
  const torso = tube(T.z.map((z, q) => [0, T.y[q], z] as V3), T.w, T.h, n + 2,
    (ring, j) => (ring > 0 && ring < T.z.length - 2 && Math.abs(((j + 1) / (n + 2)) * TAU - Math.PI * 0.5) < 0.9 ? 'coatLight' : 'coat'), { up: [0, 1, 0] });
  // Solids the leaves round its shoulders and the strap are hidden behind: the torso, in the chest's frame.
  const zMid = (T.z[0] + T.z[T.z.length - 1]) / 2, zHalf = (T.z[T.z.length - 1] - T.z[0]) / 2;
  const torsoSolid = { c: [0, T.y[2], zMid] as V3, r: [Math.max(...T.w) * 0.92, Math.max(...T.h) * 0.92, zHalf * 0.98] as V3 };
  // The skull's solid, inside its surface: what of an eye, an ear or the cheek is round behind it is hidden by it.
  const headSolid = { c: H.c, r: scale(H.r, 0.7) };
  const mantle = fronds(mantleOf(s, K));
  const deco = capDeco(s, n, K);
  const capC: V3 = [0, 0, 0];
  // The cap's dome as a solid, in its own frame: what of the sprig on it is round the far side is hidden by it.
  const capSolid = { c: [0, 0, s.cap.h * 0.1] as V3, r: [s.cap.r * 0.9, s.cap.r * 0.9, s.cap.h * 0.8] as V3 };
  const ear = earMesh(H.ear, H.ear * 0.62, n, { mat: 'coat' });
  const ears = [1, -1].map((sd) => {
    const m = moved(ear, add(H.c, [sd * H.r[0] * 0.78, -H.r[1] * 0.15, H.r[2] * 0.42]), sd * -20, 22, sd * 64);
    return sd > 0 ? m : m;
  });
  const pieces: Piece[] = [
    { key: 'hips', mesh: orb([0, 0, 0], s.hips, n, k, 'coat'), bone: 'body', bias: 0 },
    { key: 'body', mesh: torso, bone: 'chest', bias: 0.005, breathes: { c: [0, 0, zMid], k: 0.04 } },
    { key: 'head', mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), bone: 'head', bias: 0.2, hide: [headSolid] },
    { key: 'ear0', mesh: ears[1], bone: 'head', bias: 0.19, hide: [headSolid] },
    { key: 'ear1', mesh: ears[0], bone: 'head', bias: 0.19, hide: [headSolid] },
    { key: 'cap', mesh: capOf(s, n, lod ? 8 : 6), bone: 'cap', bias: 0.26, after: ['head', 'ear0', 'ear1'], bent: grown(capC) },
    { key: 'sprig', mesh: deco.sprig.mesh, bone: 'cap', bias: 0.27, after: ['cap'], hide: [capSolid], thin: true, bent: rustling(s, deco.sprig, s.sprig.len, 0.4, capC) },
    { key: 'mantle', mesh: mantle.mesh, bone: 'chest', bias: 0.08, after: ['body', 'hips', 'arm0', 'arm1'], hide: [torsoSolid], thin: true, bent: rustling(s, mantle, s.mantle[0][1], 0) },
    ...[0, 1, 2].map((q): Piece => ({
      key: `tail${q}`, bone: `tail${q}`, bias: -0.05 + q * 0.01, chain: 'tail',
      mesh: tailLink(s.tail.len, q === 0 ? [s.tail.w * 0.42, s.tail.w * 0.8, s.tail.w * 0.95] : q === 1 ? [s.tail.w * 0.95, s.tail.w * 1.05, s.tail.w * 0.95] : [s.tail.w * 0.95, s.tail.w * 0.75, s.tail.w * 0.25], n, q),
    })),
    ...limbs(s, n),
  ];
  // Each bunch hanging from the brim over the cap while its side of it is toward the viewer, and under it from the far side.
  deco.hang.forEach((h, q) => pieces.push({ key: `hang${q}`, mesh: h.mesh, bone: 'cap', bias: 0.005, after: ['cap'], front: h.dir, bent: grown(capC) }));
  if (s.stage === 0) {
    // The acorn in its left paw, against its chest; and the right cheek, which it stuffs.
    const r = 0.19;
    pieces.push({ key: 'acorn', mesh: moved(acornOf(r, n), [0.27, s.arm.paw * 0.6, -s.arm.paw * 0.8], 0, -60, 0), bone: 'hand0', bias: 0.06, after: ['body', 'hand0', 'fore0', 'fore1'], front: [0.3, 1, 0] });
    const ch = cheekOf(s, n, k);
    pieces.push({ key: 'cheek', mesh: ch.mesh, bone: 'head', bias: 0.195, hide: [headSolid], bent: (v, a) => {
      const st = cheekStuffed(a);
      const kk = 0.3 + 0.9 * st;
      return v.map((p) => add(ch.c, scale(sub(p, ch.c), kk)));
    } });
  }
  if (s.stage === 1) {
    const sp = berrySprig(n, K);
    pieces.push({ key: 'sprigHeld', mesh: moved(sp.mesh, SPRIG_AT(s), 0, SPRIG_PITCH, 0), bone: 'hand1', bias: 0.06, after: ['hand1', 'body'], front: [1, 0.5, 0] });
    pieces.push({ key: 'basket', mesh: basketOf(0.56, 0.7, n, K, 1, 1.3), bone: 'basket', bias: 0.07, after: ['hips', 'body', 'll0'], front: [-1, 0.2, 0] });
    pieces.push({ key: 'strap', mesh: strapOf(s, n), bone: 'chest', bias: 0.07, after: ['body'], hide: [torsoSolid] });
  }
  if (s.stage === 2) {
    pieces.push({ key: 'staff', mesh: staffMesh(staffLen(s), n, K), bone: 'staff', bias: 0.05, after: ['hand1'], front: [0, 0, 0] });
    const back = basketOf(0.82, 1.1, n, K, 2, 2.1);
    pieces.push({ key: 'basket', mesh: moved(back, [-0.32, -T.h[2] - 0.62, T.z[3] + 0.18], 10, 14, -8), bone: 'chest', bias: 0.03, after: ['body', 'mantle'], front: [0, -1, 0] });
    pieces.push({ key: 'strap', mesh: strapOf(s, n), bone: 'chest', bias: 0.085, after: ['body', 'mantle'], hide: [torsoSolid] });
  }
  return pieces;
}

/** The cap and all on it grown as it evolves (`growOf`), about its own middle. */
const grown = (c: V3): ((v: readonly V3[], a: Anim) => V3[]) => (v, a) => {
  if (a.act?.kind !== 'evolve') return v as V3[];
  const k = growOf(a.act.t);
  return v.map((p) => add(c, scale(sub(p, c), k)));
};

/** How full the Sporeling's cheek is this moment: stuffed at each go's drop, and chewed down by the end of the next. */
function cheekStuffed(a: Anim): number {
  if (a.act?.kind !== 'work') return 0;
  const t = a.act.t, d = downOf(t, a.graze), W = SPORE_WORK;
  const since = frac(t - W.drop);
  // Played once from standing, nothing is in it before the first drop.
  if (t < W.drop && a.graze < 0.5) return 0;
  return d * ramp(since, 0, 0.06) * (1 - 0.6 * ramp(since, 0.08, 0.9));
}

/* ---- what it throws about --------------------------------------------------------------- */

const SPORE_PINK: RGB = [246, 160, 178];
const SPORE_CREAM: RGB = [255, 242, 220];
const LEAF: RGB = [132, 178, 98];
const LEAF_PINK: RGB = [236, 178, 176];
const PETAL: RGB = [255, 252, 246];
const BERRY: RGB = [214, 56, 60];
const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;

/** A leaf in the air, `len` long, turned `ang`: two-tone down its middle with a soft darker edge. */
function flyingLeaf(g: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, c: RGB, al: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(-len / 2, 0);
  g.quadraticCurveTo(0, -len * 0.36, len / 2, 0);
  g.quadraticCurveTo(0, len * 0.36, -len / 2, 0);
  g.fillStyle = css(c, al);
  g.fill();
  g.lineWidth = len * 0.07;
  g.strokeStyle = css(mix(c, [40, 50, 30], 0.35), al);
  g.stroke();
  g.beginPath();
  g.moveTo(-len / 2, 0);
  g.quadraticCurveTo(0, -len * 0.36, len / 2, 0);
  g.closePath();
  g.fillStyle = css(mix(c, [255, 255, 240], 0.22), al);
  g.fill();
  g.restore();
}

/** A petal in the air: a small white oval with a pink edge. */
function flyingPetal(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, al: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.ellipse(0, 0, r, r * 0.6, 0, 0, TAU);
  g.fillStyle = css(PETAL, al * 0.9);
  g.fill();
  g.lineWidth = r * 0.18;
  g.strokeStyle = css([226, 150, 166], al * 0.7);
  g.stroke();
  g.restore();
}

/** A spore in the air: a small round mote, pink or cream, with a brighter middle. */
function mote(g: CanvasRenderingContext2D, x: number, y: number, r0: number, c: RGB, al: number): void {
  // Drawn half again as big as asked: a spore has to be a dot at the size the island is played at.
  const r = r0 * 1.6;
  g.fillStyle = css(mix(c, [120, 70, 80], 0.25), al * 0.7);
  g.beginPath();
  g.arc(x, y, r * 1.25, 0, TAU);
  g.fill();
  g.fillStyle = css(c, al);
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.fillStyle = css([255, 255, 250], al * 0.8);
  g.beginPath();
  g.arc(x - r * 0.3, y - r * 0.3, r * 0.4, 0, TAU);
  g.fill();
}

/** A berry in the air: a red ball with a dark rim and a glint. */
function flyingBerry(g: CanvasRenderingContext2D, x: number, y: number, r: number, al: number): void {
  g.fillStyle = css(mix(BERRY, [60, 20, 30], 0.5), al);
  g.beginPath();
  g.arc(x, y, r * 1.18, 0, TAU);
  g.fill();
  g.fillStyle = css(BERRY, al);
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.fillStyle = css([255, 236, 230], al * 0.9);
  g.beginPath();
  g.arc(x - r * 0.35, y - r * 0.35, r * 0.32, 0, TAU);
  g.fill();
}

/** A puff of spores: a soft round cloud, pink or cream, brightest in its middle. */
function puff(g: CanvasRenderingContext2D, x: number, y: number, r0: number, c: RGB, al: number): void {
  const r = r0 * 1.35;
  if (al <= 0.003 || r <= 0) return;
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, css(mix(c, [255, 255, 255], 0.3), al));
  grad.addColorStop(0.55, css(c, al * 0.7));
  grad.addColorStop(1, css(c, 0));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

/** A glint: a small four-pointed star of light, as a thing found catches it. */
function glint(g: CanvasRenderingContext2D, x: number, y: number, r: number, al: number, c: RGB = [255, 250, 220]): void {
  if (al <= 0) return;
  g.fillStyle = css(c, al);
  g.beginPath();
  for (let e = 0; e < 8; e++) {
    const a = (e / 8) * TAU - Math.PI / 2, l = e % 2 ? r * 0.22 : r;
    if (e) g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); else g.moveTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
  }
  g.closePath();
  g.fill();
  g.fillStyle = css([255, 255, 255], al);
  g.beginPath();
  g.arc(x, y, r * 0.18, 0, TAU);
  g.fill();
}

/** A ring of spores going out over the ground from where the staff came down. */
function groundRing(g: CanvasRenderingContext2D, view: View, at: V3, r: number, al: number, w: number): void {
  if (al <= 0) return;
  g.strokeStyle = css(SPORE_PINK, al);
  g.lineWidth = w;
  g.beginPath();
  for (let q = 0; q <= 24; q++) {
    const a = (q / 24) * TAU, [x, y] = onScreen(view, [at[0] + Math.cos(a) * r, at[1] + Math.sin(a) * r, 0.05]);
    if (q) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.stroke();
}

/** Where something thrown from `p` with velocity `v` is `s` seconds on, falling slowly, as spores and leaves do; it lies where it lands. */
const thrown = (p: V3, v: V3, s: number, fall = 9): V3 => [p[0] + v[0] * s, p[1] + v[1] * s, Math.max(0.03, p[2] + v[2] * s - 0.5 * fall * s * s)];
/** Whether a point is on the viewer's side of a body whose middle is at `c`: drawn over the body if so, under it if not. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How big a stage's things in the air are drawn, against the Sporekin's. */
const bigness = (s: Spore): number => [0.8, 1, 1.25][s.stage];
/** The middle of the body, over the ground: what the near and far sides of it are sides of. */
const midOf = (b: Bones): V3 => [b.chest.t[0], b.chest.t[1], b.chest.t[2]];

/**
 * The strike. The Sporeling's cap bursts into a puff of spores where it
 * butts, pink and cream motes and a leaf or two flung up and out off it. The
 * Sporekin's berries fly off the sprig in an arc ahead of it, landing in a
 * patter, each with a little pink puff. The Sporelord's staff comes down in
 * a ring of spores over the ground and a cloud of them going up off it, motes
 * and leaves flung out all round.
 */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Spore, b: Bones, at: Bones, t: number, front: boolean): void {
  const hit = SPORE_HITS[s.stage], big = bigness(s), mid = midOf(b);
  const since = (t - hit) * ACT_SECS.strike;
  if (since < 0) return;
  const fade = 1 - ramp(t, 0.7, 1);
  if (s.stage === 0) {
    // Off the front of the cap, where it butts.
    const from = place(at.cap, [0, s.cap.r * 0.7, s.cap.h * 0.2]);
    for (let q = 0; q < 4; q++) {
      // Out ahead and to each side, and up over the cap, so the puff is seen past the body whichever way it is turned.
      const a = (q / 4) * TAU + 0.6;
      const c: V3 = add(from, [Math.cos(a) * since * 4, 0.3 + Math.sin(a) * since * 3 + since * 1.4, 0.2 + since * (4 + 1.5 * q)]);
      if (nearSide(c, mid, view) !== front) continue;
      const [x, y] = onScreen(view, c);
      puff(g, x, y, (1.0 + 4.2 * since) * big, q % 2 ? SPORE_CREAM : SPORE_PINK, 0.9 * fade * (1 - ramp(since, 0.06, 0.28)));
    }
    for (let q = 0; q < 14; q++) {
      const th = (q / 14) * TAU + jitter(q) * 0.5, sp = 2.4 + 2 * jitter(q + 9);
      const v: V3 = [Math.cos(th) * sp, 1.2 + Math.sin(th) * sp * 0.7, 3 + 2.4 * jitter(q + 2)];
      const p = thrown(from, v, since, 4);
      if ((nearSide(p, mid, view) || p[2] > s.cap.up + 3) !== front) continue;
      const [x, y] = onScreen(view, p);
      if (q % 5 === 4) flyingLeaf(g, x, y, 0.9 * big, q + since * 9, q % 2 ? LEAF : LEAF_PINK, fade);
      else mote(g, x, y, (0.2 + 0.1 * jitter(q + 1)) * big, q % 2 ? SPORE_PINK : SPORE_CREAM, fade);
    }
    return;
  }
  if (s.stage === 1) {
    // The berries, off the end of the sprig at the top of the throw, in an arc out ahead; each lands, bounces once and lies.
    const from = place(at.hand1, sprigTip(s));
    const land = BERRY_FLIGHT * ACT_SECS.strike;
    for (let q = 0; q < 5; q++) {
      const spread = (q - 2) * 0.34 + 0.12 * (jitter(q) - 0.5);
      const dist = 3.2 + 0.6 * jitter(q + 4), tq = land * (0.86 + 0.28 * jitter(q + 7));
      const fwd = unit([Math.sin(spread), Math.cos(spread), 0]);
      const end: V3 = [from[0] + fwd[0] * dist, from[1] + fwd[1] * dist, 0.08];
      // Thrown so it comes down at `end` after `tq` seconds.
      const vz = (end[2] - from[2] + 0.5 * 9 * tq * tq) / tq;
      const v: V3 = [(end[0] - from[0]) / tq, (end[1] - from[1]) / tq, vz];
      const p = since < tq ? thrown(from, v, since) : add(end, [fwd[0] * 0.3 * ramp(since, tq, tq + 0.1), fwd[1] * 0.3 * ramp(since, tq, tq + 0.1), 0.25 * Math.sin(clamp((since - tq) / 0.1) * Math.PI)]);
      if ((nearSide(p, mid, view) || p[2] > 3.2) === front) {
        const [x, y] = onScreen(view, p);
        flyingBerry(g, x, y, 0.3 * big, fade);
      }
      // A little pink puff where it lands.
      if (since > tq && nearSide(end, mid, view) === front) {
        const k = since - tq, [x, y] = onScreen(view, add(end, [0, 0, 0.2 + k * 1.2]));
        puff(g, x, y, (0.6 + 3.0 * k) * big, q % 2 ? SPORE_PINK : SPORE_CREAM, 0.7 * (1 - ramp(k, 0.03, 0.22)));
        for (let e = 0; e < 3; e++) {
          const pp = thrown(end, [Math.cos(e * 2.1 + q) * 1.2, Math.sin(e * 2.1 + q) * 1.2, 2.2], k, 5);
          const [mx, my] = onScreen(view, pp);
          mote(g, mx, my, 0.1 * big, e % 2 ? SPORE_PINK : SPORE_CREAM, fade * (1 - ramp(k, 0.15, 0.25)));
        }
      }
    }
    // A leaf shaken off the sprig as it is let go.
    for (let q = 0; q < 2; q++) {
      const p = thrown(from, [0.6 * (q ? 1 : -1), 1.8, 2.6], since, 5);
      if ((nearSide(p, mid, view) || p[2] > 3.2) !== front) continue;
      const [x, y] = onScreen(view, p);
      flyingLeaf(g, x, y, 0.8 * big, q * 2 + since * 8, LEAF, fade);
    }
    return;
  }
  // The staff's end on the ground, where it came down.
  const ground: V3 = [STAFF_HIT(s)[0], STAFF_HIT(s)[1], 0];
  const ringK = ramp(since, 0, 0.3);
  if (!front) groundRing(g, view, ground, (0.4 + 3.2 * ringK) * big, 0.8 * (1 - ringK), 0.18 * big);
  // The cloud going up off it, several puffs rising fast and spreading, up past its cap so it is seen from behind it too.
  const over = b.cap.t[2];
  for (let q = 0; q < 7; q++) {
    const a = (q / 7) * TAU + 0.4, k = since * (0.8 + 0.5 * jitter(q));
    // Every other one low along the ground, spreading out wide past the body; the rest going up fast, over the cap.
    const low = q % 2 === 0, out = low ? 0.6 + 7 * k : 0.4 + 2.6 * k;
    const c: V3 = add(ground, [Math.cos(a) * out, Math.sin(a) * out, low ? 0.4 + k : 0.3 + (6 + 2 * (q % 3)) * (1 - Math.exp(-k * 8))]);
    if ((nearSide(c, mid, view) || c[2] > over) !== front) continue;
    const [x, y] = onScreen(view, c);
    puff(g, x, y, (1.2 + 4.4 * k) * big, q % 2 ? SPORE_CREAM : SPORE_PINK, 0.75 * fade * (1 - ramp(since, 0.12, 0.34)));
  }
  for (let q = 0; q < 24; q++) {
    const th = (q / 24) * TAU + jitter(q) * 0.4, sp = 2.8 + 2.6 * jitter(q + 9), high = q % 3 === 0;
    const p = thrown(add(ground, [0, 0, 0.2]), [Math.cos(th) * sp, Math.sin(th) * sp, high ? 9 + 3 * jitter(q + 2) : 3.4 + 3 * jitter(q + 2)], since, 5);
    if ((nearSide(p, mid, view) || p[2] > over) !== front) continue;
    const [x, y] = onScreen(view, p);
    if (q % 4 === 3) flyingLeaf(g, x, y, 1.0 * big, q + since * 8, q % 3 ? LEAF : LEAF_PINK, fade);
    else mote(g, x, y, (0.18 + 0.1 * jitter(q + 1)) * big, q % 2 ? SPORE_PINK : SPORE_CREAM, fade);
  }
}

/**
 * At its task: as the paw closes on what it has found, a glint off it, and
 * small leaves and petals plucked up off the undergrowth, tumbling and
 * falling; and as it lets go into the basket, a leaf dropping into it (the
 * Sporeling: a petal puffing out of its cheek). A go played once, from
 * standing, throws nothing until its first pluck.
 */
function workSpray(g: CanvasRenderingContext2D, view: View, s: Spore, b: Bones, atPick: Bones, atDrop: Bones, a: Anim, t: number, front: boolean): void {
  const W = SPORE_WORK, big = bigness(s), mid = midOf(b);
  const hand = s.stage === 0 ? 'hand1' : 'hand0';
  const paw = place(atPick[hand], [0, 0, -s.arm.paw]);
  const ground: V3 = [paw[0], paw[1], 0.05];
  // The herb it picks at: a small tuft of leaves standing up off the ground at its paw, there while it is stooped to it, a white
  // flower at its top until it is plucked; the near half of it over the body and the far half under it.
  const d = downOf(t, a.graze);
  if (d > 0.05) {
    const tall = Math.max(0.6, Math.min(1.0, paw[2] * 0.9)) * Math.max(1, big);
    const picked = t >= W.pluck && t < W.drop + 0.1 ? 1 : 0;
    for (let q = 0; q < 6; q++) {
      const a2 = (q / 6) * TAU + 0.3, root: V3 = add(ground, [Math.cos(a2) * 0.12 * big, Math.sin(a2) * 0.12 * big, 0]);
      if (nearSide(root, ground, view) !== front) continue;
      const h = tall * (0.7 + 0.3 * jitter(q + 2));
      const [x0, y0] = onScreen(view, root), [x1, y1] = onScreen(view, add(root, [Math.cos(a2) * 0.25 * big, Math.sin(a2) * 0.25 * big, h]));
      flyingLeaf(g, (x0 + x1) / 2, (y0 + y1) / 2, Math.hypot(x1 - x0, y1 - y0), Math.atan2(y1 - y0, x1 - x0), q % 3 ? LEAF : mix(LEAF, [80, 120, 64], 0.4), d);
    }
    if (front && !picked) {
      const [x, y] = onScreen(view, add(ground, [0, 0, tall * 0.95]));
      flyingPetal(g, x - 0.1 * big, y, 0.2 * big, 0.3, d);
      flyingPetal(g, x + 0.1 * big, y, 0.2 * big, 2.1, d);
      g.fillStyle = css([248, 206, 64], d);
      g.beginPath();
      g.arc(x, y, 0.09 * big, 0, TAU);
      g.fill();
    }
  }
  if (!(t < W.pluck && a.graze < 0.5)) {
    const since = frac(t - W.pluck) * ACT_SECS.work;
    if (since < 0.6) {
      const fade = 1 - ramp(since, 0.3, 0.6);
      for (let q = 0; q < 6; q++) {
        const th = q * 1.9 + 0.4, v: V3 = [Math.cos(th) * 1.1, Math.sin(th) * 1.1, 2.4 + 1.4 * jitter(q + 3)];
        const p = thrown(add(ground, [0, 0, 0.1]), v, since, 7);
        if (nearSide(p, mid, view) !== front) continue;
        const [x, y] = onScreen(view, p);
        if (q % 3 === 2) flyingPetal(g, x, y, 0.2 * big, q + since * 9, fade);
        else flyingLeaf(g, x, y, 0.62 * big, q * 1.4 + since * 10, q % 2 ? LEAF : LEAF_PINK, fade);
      }
      // The glint off what it has found, at its paw.
      const gk = hump(since, 0.06, 0.14);
      const at = place(atPick[hand], [0, 0, -s.arm.paw * 0.6]);
      if (gk > 0 && (nearSide(at, mid, view) || at[2] > 1) === front) {
        const [x, y] = onScreen(view, add(at, [0, 0, 0.3]));
        glint(g, x, y, (0.8 + 0.4 * gk) * big, gk);
      }
    }
  }
  if (!(t < W.drop && a.graze < 0.5)) {
    const since = frac(t - W.drop) * ACT_SECS.work;
    if (since < 0.4) {
      const fade = 1 - ramp(since, 0.2, 0.4);
      const from = place(atDrop[hand], [0, 0, -s.arm.paw * 0.6]);
      if (s.stage === 0) {
        // A petal puffed out of its cheek as it stuffs it.
        for (let q = 0; q < 2; q++) {
          const p = thrown(add(from, [0, 0, 0.1]), [0.8 * (q ? 1 : -0.4), 0.8, 1.6], since, 4);
          if ((nearSide(p, mid, view) || p[2] > 2.6) !== front) continue;
          const [x, y] = onScreen(view, p);
          flyingPetal(g, x, y, 0.18 * big, q + since * 8, fade);
        }
      } else {
        // The herb let fall into the basket, and gone into it.
        const p = thrown(from, [0, 0, 0.4], since, 9);
        if ((nearSide(p, mid, view) || s.stage === 2) === front) {
          const [x, y] = onScreen(view, p);
          flyingLeaf(g, x, y, 0.7 * big, 1 + since * 6, LEAF, 1 - ramp(since, 0.1, 0.22));
        }
      }
    }
  }
}

/**
 * Evolving: at the start a cloud of spores bursting out of it, pink and
 * cream, thick enough to hide the change of body, with motes flung out of it;
 * thinning by a quarter of the way through. Then leaves and petals going up
 * round it in a spiral, and at the flash a ring of motes popping off the rim
 * of its cap, which has grown in over it.
 */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Spore, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid = midOf(b);
  const tall = b.cap.t[2] + s.cap.h;
  const since = t * ACT_SECS.evolve;
  const cloud = (1 - ramp(t, 0.06, 0.24)) * ramp(t, 0, 0.02);
  if (cloud > 0) {
    for (let q = 0; q < 9; q++) {
      const a = (q / 9) * TAU + 0.3, h = tall * (0.15 + 0.75 * jitter(q + 2));
      const r = (0.6 + 0.5 * jitter(q + 5)) * big + since * 1.4;
      const c: V3 = [Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, h + since * 1.2];
      if (nearSide(c, mid, view) !== front) continue;
      const [x, y] = onScreen(view, c);
      puff(g, x, y, (1.5 + 0.8 * jitter(q)) * big + since * 2.4, q % 2 ? SPORE_CREAM : SPORE_PINK, 0.85 * cloud);
    }
    for (let q = 0; q < 26; q++) {
      const th = (q / 26) * TAU * 2.3 + jitter(q) * 0.7, el = jitter(q + 40);
      const from: V3 = [Math.cos(th) * 0.5, Math.sin(th) * 0.5, tall * (0.2 + 0.6 * el)];
      const p = thrown(from, [Math.cos(th) * (2.6 + 2 * jitter(q + 3)), Math.sin(th) * (2.6 + 2 * jitter(q + 5)), 1.6 + 2.4 * jitter(q + 7)], since, 3);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      mote(g, x, y, (0.14 + 0.08 * jitter(q + 1)) * big, q % 2 ? SPORE_PINK : SPORE_CREAM, cloud);
    }
  }
  // The swirl: leaves and petals up round it, wide at its feet and gathering in as they rise.
  const fade = ramp(t, 0.1, 0.24) * (1 - ramp(t, 0.72, 0.95));
  const wide = 1.6 * big + 0.6;
  for (let q = 0; q < 16; q++) {
    const rise = frac(t * 1.2 + q / 16), ang = (q / 16) * TAU * 3 + t * TAU * 1.5;
    const r = wide * (1 - 0.45 * rise);
    const p: V3 = [Math.cos(ang) * r, Math.sin(ang) * r, rise * tall * 1.05];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    const al = fade * Math.sin(rise * Math.PI);
    if (q % 4 === 0) flyingPetal(g, x, y, 0.24 * big, ang * 2, al);
    else if (q % 4 === 2) mote(g, x, y, 0.14 * big, q % 8 ? SPORE_PINK : SPORE_CREAM, al);
    else flyingLeaf(g, x, y, 0.85 * big, ang * 1.5 + rise * 4, q % 4 === 1 ? LEAF : LEAF_PINK, al);
  }
  // At the flash, motes popping off round the rim of the cap.
  const pop = clamp((t - 0.5) / 0.22);
  if (pop > 0 && pop < 1) {
    for (let q = 0; q < 14; q++) {
      const th = (q / 14) * TAU;
      const rim = place(b.cap, [Math.cos(th) * s.cap.r, Math.sin(th) * s.cap.r, -s.cap.droop]);
      const out = sub(rim, b.cap.t);
      const p = add(rim, add(scale([out[0], out[1], 0], pop * 0.7), [0, 0, pop * 1.2 - pop * pop * 1.4]));
      if ((nearSide(p, mid, view) || p[2] > tall) !== front) continue;
      const [x, y] = onScreen(view, p);
      mote(g, x, y, 0.14 * big, q % 2 ? SPORE_PINK : SPORE_CREAM, 1 - pop);
    }
  }
}

/** Light: a soft pink flash where the blow lands, and a glow over the cap as it grows in, evolving. */
function sporeGlow(s: Spore, b: Bones, a: Anim, at: (a: Anim) => Bones): Array<{ p: V3; r: number; c: RGB; a: number }> {
  const act = a.act;
  if (act?.kind === 'strike') {
    const k = hump(act.t, SPORE_HITS[s.stage] + 0.03, 0.12);
    if (k <= 0) return [];
    const hb = at(a);
    const p = s.stage === 0 ? place(hb.cap, [0, s.cap.r * 0.7, 0]) : s.stage === 1 ? place(hb.hand1, sprigTip(s)) : [STAFF_HIT(s)[0], STAFF_HIT(s)[1], 0.4] as V3;
    return [{ p, r: [1.2, 1.4, 2.6][s.stage], c: [255, 214, 222], a: [0.35, 0.3, 0.5][s.stage] * k }];
  }
  if (act?.kind === 'evolve') {
    const k = 0.25 * ramp(act.t, 0.15, 0.45) * (1 - ramp(act.t, 0.6, 0.9)) + 0.3 * hump(act.t, 0.5, 0.08);
    if (k <= 0) return [];
    return [{ p: place(b.cap, [0, 0, s.cap.h * 0.3]), r: s.cap.r * 1.4, c: [255, 206, 214], a: k }];
  }
  return [];
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A colour pushed further from its own grey: a cap that reads as coral at the size it is played at, and not as a smudge of salmon. */
const richer = (c: RGB, k = 1.2): RGB => {
  const m = (c[0] + c[1] + c[2]) / 3;
  return c.map((x) => clamp(m + (x - m) * k, 0, 255)) as RGB;
};

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, botanizes and evolves. */
function sporeKind(s: Spore): Kind {
  const bones = sporeBones(s);
  // Where everything is at the moment the blow lands, as the paw plucks, and as it lets go into the basket.
  const atHit = (a: Anim): Bones => bones({ ...a, act: { kind: 'strike', t: SPORE_HITS[s.stage] } });
  const atPick = (a: Anim): Bones => bones({ ...a, graze: 1, act: { kind: 'work', t: SPORE_WORK.pluck } });
  const atDrop = (a: Anim): Bones => bones({ ...a, graze: 1, act: { kind: 'work', t: SPORE_WORK.drop } });
  return {
    bones,
    build: (lod) => sporeBuild(s, lod),
    // The variant's coat for its fur, made a little paler and warmer; its markings for its cap, as rich as they go. The pink of its
    // cheeks, its tail and its ears leans to the cap's colour; its leaves, flowers, berries, wood and wicker are the same on every
    // variant.
    palette: (coat, mark) => {
      const fur = mix(coat, [250, 238, 218], 0.25);
      const cap = richer(mix(mark, [255, 236, 230], 0.08), 1.15);
      const pink = mix([242, 168, 178], cap, 0.25);
      return coatPalette(coat, mark, {
        coat: fur,
        coatDark: darker(fur, 0.22),
        coatLight: lighter(fur, 0.55),
        muzzle: lighter(fur, 0.45),
        mark: cap,
        cap,
        spot: [255, 246, 228],
        shell: [248, 232, 208],
        shellDark: [214, 186, 160],
        inner: pink,
        feather: mix(fur, pink, 0.55),
        featherDark: mix(fur, pink, 0.8),
        nose: mix([222, 120, 136], cap, 0.2),
        lid: [92, 62, 66],
        eye: [40, 28, 38],
        eyeWhite: [255, 252, 246],
        claw: [104, 88, 92],
        leaf: [128, 176, 96],
        stem: [112, 160, 84],
        leafDark: [96, 136, 76],
        moss: [226, 172, 168],
        membrane: [208, 150, 150],
        tongue: [188, 136, 134],
        petal: [255, 253, 248],
        bloom: [248, 206, 64],
        ember: [216, 52, 56],
        horn: [190, 144, 96],
        hornDark: [128, 84, 52],
        bark: [140, 98, 66],
        bill: [196, 150, 100],
        billDark: [112, 78, 54],
        wood: [214, 170, 112],
        woodDark: [190, 144, 92],
        leather: [150, 102, 70],
        leatherDark: [118, 78, 54],
        crystal: [184, 122, 66],
        crystalDark: [124, 86, 54],
      }, 30);
    },
    shadow: [[1.1, 1.4, 1.9][s.stage], [1.1, 1.2, 1.6][s.stage]],
    stride: 1.4,
    size: s.size,
    blinks: 4,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are spores: pink and cream.
    motes: [SPORE_PINK, SPORE_CREAM],
    glow: (b, a) => sporeGlow(s, b, a, atHit),
    extra: (g, view, b, a, under) => {
      const act = a.act;
      if (!act) return;
      const front = !under;
      if (act.kind === 'strike') strikeBurst(g, view, s, b, atHit(a), act.t, front);
      else if (act.kind === 'work') workSpray(g, view, s, b, atPick(a), atDrop(a), a, act.t, front);
      else if (act.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const SPORELING = sporeKind(SPORELING_LOOK);
export const SPOREKIN = sporeKind(SPOREKIN_LOOK);
export const SPORELORD = sporeKind(SPORELORD_LOOK);
