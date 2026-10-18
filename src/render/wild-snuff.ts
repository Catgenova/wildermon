import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, DEG, disc, dot, frac, lerp, merge, mix, moved, onEgg, orbAlong, paint, quadBonesOf, scale,
  smile, smooth, step, sub, taper, TAU, tube, unit, type Anim, type Bones, type Kind, type Piece, type QuadPose, type QuadSpec,
} from './beasts';
import { cut, quadPieces } from './beastkit';
import { joint, mesh, onScreen, place, type Face, type Mat, type Mesh, type RGB, type V3, type View } from './figure';
import { trot } from './wild-paws';

/**
 * The snuff line: the Snufflet, a leafy piglet, which grows into the
 * Snuffroot, a long-legged young boar, and then the Snuffthorn, a heavy boar
 * with a tusk. The species is still `rabba` underneath, as saves and the
 * database know it.
 *
 * Each is a cream pig with soft pink patches, a big pointed ear each side
 * pink inside, a pink snout, cloven hooves under a cuff of leaves, and a
 * mane of overlapping leaves round its neck and shoulders with small white
 * flowers in it, which grows bigger and wilder at each stage and in the last
 * runs on down its back. All three are built by one set of functions from a
 * description of the stage (`Snuff`), so a stage is its numbers.
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
  /** The head's egg in the head's frame, and the eyes' size. */
  head: { c: V3; r: V3; eye: number };
  /** The snout: where it starts in front of the eyes, how long, how wide, and how far down the face. */
  snout: { at: number; len: number; r: number; z: number };
  /** Each ear: its root on the head (right side), its length and width, and how far it is splayed out and laid back. */
  ear: { at: V3; len: number; w: number; out: number; back: number };
  /** The mane's rows round the neck, front to back: how many leaves in each, and how long they are. */
  ruff: Array<[number, number]>;
  /** Pairs of leaves down the spine behind the mane: how many, and the longest. */
  back: [number, number];
  /** Leaves standing up on the crown between the ears, and how long. */
  crest: [number, number];
  /** Flowers in the mane down each side, on the crown, and along the ridge of the back. */
  flowers: [number, number, number];
  /** How long the leaves of the tail's tuft are, and of the cuffs round the lower legs. */
  tail: number;
  cuff: number;
  tusk: boolean;
  /** How wild the mane is: how much longer the leaves over the nape stand, and how far up they point. */
  wild: number;
  size: number;
}

/** A Snufflet: a round little piglet with a head too big for it, short legs, and a collar of leaves. */
const SNUFFLET_LOOK: Snuff = {
  body: { y: [-1.12, -0.96, -0.52, 0.08, 0.6, 0.92, 1.06], z: [0.14, 0.12, 0.1, 0.1, 0.12, 0.16, 0.18], w: [0.3, 0.78, 0.92, 0.94, 0.9, 0.78, 0.34], h: [0.3, 0.72, 0.84, 0.86, 0.84, 0.74, 0.32] },
  len: 2.0, legs: 0.72, thick: 0.26, hoof: 0.15,
  neck: { at: [0, 0.82, 0.2], len: 0.36, w: 0.64, lean: 42 },
  head: { c: [0, 0.3, 0.24], r: [0.9, 0.86, 0.84], eye: 0.2 },
  snout: { at: 0.92, len: 0.3, r: 0.27, z: -0.08 },
  ear: { at: [0.48, 0.1, 0.62], len: 0.95, w: 0.46, out: 32, back: 12 },
  ruff: [[13, 0.5], [15, 0.6], [15, 0.64]],
  back: [0, 0],
  crest: [4, 0.6],
  flowers: [1, 1, 0],
  tail: 0.82,
  cuff: 0.34,
  tusk: false,
  wild: 0,
  size: 1.55,
};

/** A Snuffroot: longer in the body and the leg, a longer snout, and a fuller mane sweeping back over the shoulders. */
const SNUFFROOT_LOOK: Snuff = {
  body: { y: [-1.56, -1.36, -0.76, 0, 0.76, 1.3, 1.5], z: [0.16, 0.12, 0.1, 0.1, 0.14, 0.2, 0.22], w: [0.32, 0.84, 0.98, 1.0, 1.02, 0.9, 0.4], h: [0.32, 0.78, 0.9, 0.92, 0.95, 0.86, 0.38] },
  len: 2.7, legs: 1.15, thick: 0.32, hoof: 0.18,
  neck: { at: [0, 1.22, 0.24], len: 0.42, w: 0.72, lean: 44 },
  head: { c: [0, 0.36, 0.24], r: [0.92, 0.95, 0.86], eye: 0.19 },
  snout: { at: 1.0, len: 0.6, r: 0.3, z: -0.1 },
  ear: { at: [0.5, 0.1, 0.62], len: 1.15, w: 0.52, out: 32, back: 14 },
  ruff: [[14, 0.58], [16, 0.72], [17, 0.82], [17, 0.86]],
  back: [0, 0],
  crest: [5, 0.7],
  flowers: [2, 1, 0],
  tail: 0.6,
  cuff: 0.42,
  tusk: false,
  wild: 0.3,
  size: 1.72,
};

/** A Snuffthorn: a heavy boar, deep and broad in the chest and humped at the shoulder, a tusk up from its jaw, the mane down its back. */
const SNUFFTHORN_LOOK: Snuff = {
  body: { y: [-1.86, -1.66, -1.0, -0.1, 0.8, 1.5, 1.78], z: [0.1, 0.1, 0.12, 0.2, 0.32, 0.36, 0.36], w: [0.36, 0.98, 1.1, 1.18, 1.3, 1.18, 0.5], h: [0.36, 0.9, 1.02, 1.12, 1.22, 1.1, 0.5] },
  len: 3.3, legs: 1.3, thick: 0.42, hoof: 0.24,
  neck: { at: [0, 1.5, 0.42], len: 0.46, w: 0.9, lean: 48 },
  head: { c: [0, 0.4, 0.2], r: [1.02, 1.08, 0.95], eye: 0.18 },
  snout: { at: 1.12, len: 0.74, r: 0.36, z: -0.14 },
  ear: { at: [0.55, 0.08, 0.66], len: 1.3, w: 0.58, out: 34, back: 16 },
  ruff: [[15, 0.74], [17, 0.92], [18, 1.05], [18, 1.1]],
  back: [5, 0.95],
  crest: [7, 0.85],
  flowers: [3, 1, 1],
  tail: 0.75,
  cuff: 0.5,
  tusk: true,
  wild: 0.65,
  size: 1.92,
};

/** A number of its own for each leaf, nought to one, so a mane is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);

/* ---- its bones ------------------------------------------------------------------------- */

/** A stage's body on four hooves (`QuadSpec`): its legs, neck, ears and tail from its numbers, and a pig's short quick stride. */
const specOf = (s: Snuff): QuadSpec => ({
  high: s.legs + 0.7,
  fore: { at: [s.body.w[4] * 0.52, s.len * 0.42, -0.42], len: [s.legs * 0.5, s.legs * 0.5, s.hoof], rest: [0, 0, 0], fold: [55, 85], toe: [s.thick * 0.85, s.thick * 0.35] },
  hind: { at: [s.body.w[2] * 0.56, -s.len * 0.42, -0.3], len: [s.legs * 0.54, s.legs * 0.54, s.hoof], rest: [14, -28, 0], fold: [42, 70], toe: [s.thick * 0.85, s.thick * 0.35] },
  neck: { at: s.neck.at, len: s.neck.len, lean: s.neck.lean },
  head: { pitch: -2 },
  tail: { at: [0, s.body.y[0] + 0.22, s.body.z[0] + s.body.h[1] * 0.55], links: 2, len: 0.22, lift: 18, curl: -26, sway: 12 },
  ears: { at: s.ear.at, out: s.ear.out, back: s.ear.back },
  swing: [24, 38],
  duty: [0.56, 0.36],
  graze: 34,
  nose: 20,
  bow: 14,
  rock: 5,
});

/** Where each leg's foot is in a stride at a walk as `quadPose` has it, a four-beat, and in a trot, the diagonals together. */
const FOUR_BEAT = [0.25, 0.75, 0, 0.5];
const DIAGONALS = [0, 0.5, 0.5, 0];

/** The strike: how far through it the wind-up is gathered, the snout goes in, and it has settled again. */
const STRIKE = { gather: 0.38, hit: 0.52, done: 1 };
/** How far into a strike the scrape of a fore hoof before the charge is over, from its start. */
const SCRAPE = 0.3;
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

/** How far the whole body is carried forward, in its own units, against how far its legs are swung back to keep the hooves put. */
function surge(s: Snuff, t: number): number {
  const k = strikeOf(t);
  return s.len * (0.16 * k.thrust - 0.06 * k.gather - 0.03 * k.settle);
}

/** A rooting go: how far its head is down at the ground (eased in and out of, when it is not already down), and the two nudges in it. */
function rootOf(t: number, graze: number): { down: number; push: number; flick: number } {
  const down = Math.max(graze, ramp(t, 0, 0.14) * (1 - ramp(t, 0.86, 1)));
  // Two shoves a go, each the snout driven in and then flicked up and out, which is what throws the earth.
  const w = frac(t * 2);
  const push = hump(w, 0.3, 0.3);
  const flick = hump(w, 0.68, 0.2);
  return { down, push, flick };
}

/**
 * A stage's pose over the one a body on four legs has (`quadPose`): a trot
 * at a walk as at a run, bouncing; a snuffle at the ground now and then
 * standing; and its two moves -- a strike, gathered, thrown forward snout
 * first and settled, with a hooked toss of the tusk on the Snuffthorn; and
 * rooting, the snout down in the ground.
 */
function snuffPose(s: Snuff, spec: QuadSpec, p: QuadPose, a: Anim): void {
  trot(p, a);
  const g = smooth(a.go);
  // A brisk trot at a walk too, the diagonals together, rather than the four-beat walk the pose is given: a pig on its hooves.
  if (a.go > 0 && a.gait < 0.5) {
    const duty = lerp(spec.duty?.[0] ?? 0.64, spec.duty?.[1] ?? 0.4, a.gait), amp = lerp(spec.swing[0], spec.swing[1], a.gait);
    for (let i = 0; i < 4; i++) {
      const was = step(a.u + FOUR_BEAT[i], duty, amp), now = step(a.u + DIAGONALS[i], duty, amp);
      for (let k = 0; k < 3; k++) p.legs[i][k] += g * (now[k] - was[k]);
    }
  }
  if (a.go > 0) {
    // Bouncing along: the body up off each pair of hooves, the head nodding and the ears flopping a beat after it, the tail going.
    const w = frac(a.u);
    p.lift += g * (0.06 + 0.1 * a.gait) * Math.max(0, Math.sin(w * TAU * 2));
    p.head[0] += g * 4 * Math.sin(w * TAU * 2 - 0.6);
    p.ears[0][0] += g * 12 * Math.sin(w * TAU * 2 - 1.4);
    p.ears[1][0] += g * 12 * Math.sin(w * TAU * 2 - 1.1);
    p.tail[1] += g * 18 * Math.sin(w * TAU + 0.4);
  } else {
    // Standing, now and then a snuffle at the ground in front of it, the snout working.
    const snuffle = beat(a.t, [7.4, 19.6], 1.6) * (1 - a.graze);
    p.neck[0] += 10 * snuffle;
    p.head[0] -= 10 * snuffle + 3 * snuffle * Math.sin(a.t * 30);
  }
  const act = a.act;
  if (act?.kind === 'strike') {
    const k = strikeOf(act.t), gore = s.tusk ? hump(act.t, 0.64, 0.14) : 0;
    // Gathered: back on its haunches, the fore hooves braced ahead, the head drawn in and down, the ears pinned back.
    p.pitch += 8 * k.gather - 11 * k.thrust + 3 * k.settle + 6 * gore;
    p.legs[2][1] += 0.3 * k.gather;
    p.legs[3][1] += 0.3 * k.gather;
    p.neck[0] += -18 * k.gather + 30 * k.thrust - 8 * k.settle - 16 * gore;
    p.head[0] += -20 * k.gather - 4 * k.thrust + 6 * k.settle + 50 * gore;
    // As it gathers, a fore hoof scraped once along the ground, as a boar does before it charges: lifted forward, put down,
    // and dragged back.
    const sc = clamp(act.t / SCRAPE), w = Math.sin(sc * TAU) * (act.t < SCRAPE ? 1 : 0);
    p.legs[1][0] += 22 * w;
    p.legs[1][1] += 0.7 * Math.max(0, w);
    p.legs[1][2] = Math.max(p.legs[1][2], Math.max(0, w));
    // Thrown forward snout first: the hind legs driving off their toes, the ears streaming back, and flopping forward as it settles.
    p.foot[2] -= 22 * k.thrust;
    p.foot[3] -= 22 * k.thrust;
    for (const e of p.ears) e[0] += 34 * k.gather + 48 * k.thrust - 22 * k.settle;
    p.tail[0] += 30 * k.thrust;
    p.squash += 0.06 * k.gather - 0.05 * k.thrust;
    // The legs swung back by as much as the body goes forward, so the hooves stay where they are while it lunges over them.
    const d = surge(s, act.t);
    for (let i = 0; i < 4; i++) {
      const L = (i < 2 ? spec.fore : spec.hind).len;
      const back = -Math.asin(clamp(d / (L[0] + L[1]), -0.9, 0.9)) / DEG;
      p.legs[i][0] += back - (8 * k.gather - 11 * k.thrust);
    }
  } else if (act?.kind === 'work') {
    const r = rootOf(act.t, a.graze);
    // Rooting: the snout driven down into the ground and flicked up out of it, twice a go; the body shoving behind it, an ear
    // flicked on each shove, and the tail going hard.
    p.neck[0] += r.down * (14 + 10 * r.push - 8 * r.flick);
    p.head[0] += r.down * (-8 - 14 * r.push + 20 * r.flick);
    p.pitch -= r.down * 2 * r.push;
    p.roll += r.down * 2 * Math.sin(act.t * TAU * 2);
    p.ears[0][0] += r.down * 30 * hump(act.t, 0.2, 0.1);
    p.ears[1][0] += r.down * 30 * hump(act.t, 0.7, 0.1);
    p.ears[0][1] += r.down * 10 * r.flick;
    p.ears[1][1] += r.down * 10 * r.flick;
    p.tail[1] += r.down * 26 * Math.sin(act.t * TAU * 4);
  }
}

/** The bones of a stage: a body on four hooves (`quadBonesOf`), carried forward through a strike, and a bone the front of the mane is on. */
function snuffBones(s: Snuff): (a: Anim) => Bones {
  const spec = specOf(s);
  const posed = quadBonesOf(spec, (p, a) => snuffPose(s, spec, p, a));
  return (a) => {
    const act = a.act;
    // Rooting, the head goes down to the ground as it does to graze, and the hind feet are kept down under it (`quadBonesOf`).
    const b = posed(act?.kind === 'work' ? { ...a, graze: rootOf(act.t, a.graze).down } : a);
    if (act?.kind === 'strike') {
      const d = surge(s, act.t);
      for (const k of Object.keys(b)) b[k] = { m: b[k].m, t: [b[k].t[0], b[k].t[1] + d, b[k].t[2]] };
    }
    // The front of the mane goes with the neck: its bone is the neck's, turned back to the body's carriage.
    b.ruff = joint(b.neck, [0, 0, 0], spec.neck.lean);
    return b;
  };
}

/* ---- its pieces ------------------------------------------------------------------------ */

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
  // Each face wound so it faces the way it is meant to, whichever way round it was listed.
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
  return mesh(v, f);
}

/** The two colours a leaf comes in: green, or the pale pink of a young leaf; each a top in two halves and an underside. */
type Tone = 'green' | 'pink';
const TONES: Record<Tone, readonly [Mat, Mat, Mat]> = { green: ['leaf', 'stem', 'leafDark'], pink: ['moss', 'shellDark', 'shell'] };

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

/** A small five-petalled flower at `c`, facing along `n`, `r` across: cream petals round a yellow middle. */
function flower(c: V3, n: V3, r: number, spin = 0): Mesh {
  const z = unit(n);
  let x = cross([0, 0, 1], z);
  if (Math.hypot(x[0], x[1], x[2]) < 1e-3) x = [1, 0, 0];
  x = unit(x);
  const y = cross(z, x);
  const petals = Array.from({ length: 5 }, (_, q) => {
    const t = spin + (q / 5) * TAU, d = add(scale(x, Math.cos(t)), scale(y, Math.sin(t)));
    const at = (k: number, lift: number): V3 => add(add(c, scale(d, r * k)), scale(z, r * lift));
    return sheet([at(0.12, 0.05), at(0.55, 0.12), at(0.95, 0.08)], [r * 0.2, r * 0.4, r * 0.18], z, 0.12, ['petal', 'petal', 'petal']);
  });
  return merge(...petals, orbAlong(add(c, scale(z, r * 0.14)), z, [r * 0.26, r * 0.26, r * 0.14], 6, 3, 'bloom'));
}

/** A mesh of leaves with, for each of its corners, how far out along its leaf it is and which way its leaf lifts: what a rustle moves. */
interface Fronds { mesh: Mesh; w: number[]; out: V3[] }
function fronds(parts: Array<{ mesh: Mesh; out: V3; stiff?: boolean }>): Fronds {
  const w: number[] = [], out: V3[] = [];
  for (const p of parts) {
    // A leaf's corners go six to a point along it, root to tip (`sheet`); anything else (a flower) moves as the middle of a leaf does.
    const K = p.mesh.v.length / 6;
    p.mesh.v.forEach((_, i) => { w.push(p.stiff ? 0.5 : Math.floor(i / 6) / Math.max(1, K - 1)); out.push(p.out); });
  }
  return { mesh: merge(...parts.map((p) => p.mesh)), w, out };
}

/**
 * How far the leaves are lifted off the body this moment, as a share of
 * their length, and how far they are thrown up: bristling as it gathers to
 * strike and at each shove of its rooting, bouncing as it trots, and
 * stirring now and then as it stands.
 */
function rustle(a: Anim, phase: number): { lift: number; bounce: number } {
  let lift = 0.03 * beat(a.t, [4.6, 13.9, 21.2], 1.2) * (1 - a.go);
  let bounce = a.go > 0 ? smooth(a.go) * (0.05 + 0.05 * a.gait) * Math.sin(frac(a.u) * TAU * 2 - 1.2 - phase) : 0;
  const act = a.act;
  if (act?.kind === 'strike') {
    const k = strikeOf(act.t);
    lift += 0.22 * k.gather + 0.12 * k.thrust;
    bounce += 0.08 * k.settle;
  } else if (act?.kind === 'work') {
    const r = rootOf(act.t, a.graze);
    lift += r.down * (0.06 + 0.12 * r.flick);
    bounce += r.down * 0.05 * Math.sin(act.t * TAU * 4 - phase);
  }
  return { lift, bounce };
}

/** A piece of leaves that rustles (`rustle`): every corner moved by as far out along its leaf as it is. */
function rustling(f: Fronds, len: number, phase: number): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const { lift, bounce } = rustle(a, phase);
    if (!lift && !bounce) return v as V3[];
    return v.map((p, i) => {
      const k = f.w[i] * len;
      return [p[0] + f.out[i][0] * lift * k, p[1] + f.out[i][1] * lift * k, p[2] + f.out[i][2] * lift * k + bounce * k];
    });
  };
}

/** Which of the two colours a leaf is: mostly green, and now and then the pale pink of a young leaf. */
const toneOf = (i: number, pink = 0.28): Tone => (jitter(i * 3 + 1) < pink ? 'pink' : 'green');

/** Where each row of the mane is rooted along the body: the first round the front of the chest, under the chin, and each after it back by under half its leaves. */
const rowY = (s: Snuff, r: number): number => s.body.y[5] - 0.05 - s.ruff.slice(0, r).reduce((t, [, L]) => t + L * 0.45, 0);

/**
 * The mane round the neck and shoulders, in the body's frame, in rows from
 * just behind the head back over the shoulders: each row a ring of leaves
 * rooted on the barrel and lying back and out over the one behind it -- the
 * front ones flared, the back ones lying flatter -- standing up off the
 * nape, longest down the sides, and shorter under the chin, where they are
 * a bib on the chest. With a flower or two down each side, laid on the
 * leaves.
 */
function ruffRows(s: Snuff, rows: number[], K: number, flowersOn: boolean): Array<{ mesh: Mesh; out: V3; stiff?: boolean }> {
  const out: Array<{ mesh: Mesh; out: V3; stiff?: boolean }> = [];
  const back: V3 = [0, -1, 0];
  for (const r of rows) {
    const [count, L] = s.ruff[r];
    const y = rowY(s, r), sweep = (18 + 12 * r) * DEG;
    for (let q = 0; q < count; q++) {
      const id = r * 37 + q;
      const th = ((q + (r % 2) * 0.5) / count) * TAU + 0.25 * (jitter(id) - 0.5);
      const { p, n } = onBarrel(s, y, th);
      // None under the belly, where only the legs would see them; shorter low down the sides, and over the nape the longest.
      const under = Math.max(0, -Math.sin(th));
      if (under > 0.55) continue;
      // A wilder mane stands up higher and longer over the nape.
      const nape = Math.max(0, Math.sin(th)) * s.wild;
      const len = L * (0.82 + 0.3 * jitter(id + 7)) * (1 - 0.3 * under) * (1 + 0.6 * nape);
      // Each turned a little round the ring, alternately one way and the other, so they fan and overlap like the leaves of a
      // spray, and are never all seen edge on at once.
      const round = scale(unit(cross(n, back)), q % 2 ? 1 : -1);
      const dir = unit(add(add(add(scale(n, Math.cos(sweep) + nape), scale(back, Math.sin(sweep))), [0, 0, -0.25 * Math.abs(Math.cos(th))]), scale(round, 0.3 * jitter(id + 2))));
      const face = add(add(scale(n, Math.sin(sweep)), scale(back, -Math.cos(sweep))), scale(round, 0.6));
      out.push({ mesh: leaf(add(p, scale(n, 0.02 - 0.05 * r)), dir, face, len, len * 0.36, K, toneOf(id), 0.18), out: unit(face) });
    }
  }
  if (flowersOn) {
    // Flowers down each side of the mane, a little out from the leaves they are laid on.
    const per = s.flowers[0];
    for (const sd of [1, -1]) {
      for (let q = 0; q < per; q++) {
        const r = Math.min(s.ruff.length - 1, q), y = rowY(s, r) - s.ruff[r][1] * 0.3;
        const th = (sd > 0 ? 0 : Math.PI) + sd * (0.45 - 0.6 * q + 0.2 * jitter(q + (sd > 0 ? 0 : 5)));
        const { p, n } = onBarrel(s, y, th);
        out.push({ mesh: flower(add(p, scale(n, s.ruff[r][1] * 0.3)), add(n, [0, 0.35, 0.2]), 0.17 + 0.03 * r, q * 0.7), out: n, stiff: true });
      }
    }
  }
  return out;
}

/**
 * A bib of leaves hanging from the throat down over the front of the chest
 * under the chin, in two layers, with a flower at the middle of it: in the
 * mane's front frame, at the neck's root, so it goes down with the head.
 */
function bibOf(s: Snuff, K: number): Array<{ mesh: Mesh; out: V3; stiff?: boolean }> {
  const lean = s.neck.lean * DEG, L = s.ruff[0][1], R = s.neck.w;
  const A: V3 = [0, Math.sin(lean), Math.cos(lean)], u: V3 = [1, 0, 0], v = cross(A, u);
  const out: Array<{ mesh: Mesh; out: V3; stiff?: boolean }> = [];
  for (const [layer, count] of [[0, 5], [1, 4]]) {
    for (let q = 0; q < count; q++) {
      const phi = ((q + 0.5) / count - 0.5) * 1.9, id = 900 + layer * 10 + q;
      const round = add(scale(v, Math.cos(phi)), scale(u, Math.sin(phi)));
      const root = add(scale(A, 0.12 - layer * 0.22), scale(round, R * 0.92));
      const dir = unit(add(add(scale(round, 0.45), [0, 0.15, -1]), scale(u, Math.sin(phi) * 0.4)));
      out.push({ mesh: leaf(root, dir, round, L * (1.0 - 0.1 * layer + 0.2 * jitter(id)), L * 0.38, K, toneOf(id), 0.16), out: round });
    }
  }
  const at = add(scale(A, 0.0), scale(v, R * 1.12));
  out.push({ mesh: flower(add(at, [0.06, 0, -0.12]), add(v, [0.1, 0, 0.3]), 0.22, 0.4), out: v, stiff: true });
  return out;
}

/** Leaves along the spine behind the mane, in pairs lying back and out over the flanks, shorter toward the rump. */
function backLeaves(s: Snuff, K: number): Array<{ mesh: Mesh; out: V3; stiff?: boolean }> {
  const [pairs, L] = s.back;
  const out: Array<{ mesh: Mesh; out: V3; stiff?: boolean }> = [];
  const top = (y: number): number => {
    const B = s.body;
    let k = 0;
    while (k < B.y.length - 2 && B.y[k + 1] < y) k++;
    const f = clamp((y - B.y[k]) / (B.y[k + 1] - B.y[k]));
    return lerp(B.z[k] + B.h[k], B.z[k + 1] + B.h[k + 1], f);
  };
  for (let q = 0; q < pairs; q++) {
    const y = s.neck.at[1] - 0.9 - q * ((s.len * 0.95) / pairs);
    const len = L * (1 - 0.5 * (q / pairs));
    for (const sd of [1, -1]) {
      const id = 300 + q * 2 + (sd > 0 ? 0 : 1);
      const root: V3 = [sd * 0.18, y, top(y) - 0.08];
      const dir = unit([sd * (0.55 + 0.2 * jitter(id)), -0.8, 0.12]);
      const face: V3 = [sd * 0.4, 0, 1];
      out.push({ mesh: leaf(root, dir, face, len * (0.85 + 0.25 * jitter(id + 3)), len * 0.38, K, toneOf(id), 0.2), out: unit(face) });
    }
    // A flower at every other pair, along the ridge, as many as it has.
    if (q % 2 === 0 && q / 2 < s.flowers[2]) out.push({ mesh: flower([0.32 * (q % 4 ? -1 : 1), y - 0.25, top(y) + 0.06], [0.3 * (q % 4 ? -1 : 1), -0.2, 1], 0.2, q), out: [0, 0, 1], stiff: true });
  }
  return out;
}

/** A pointed ear, big and soft, built upright facing forward: cream outside with a pink tip, a pink lining inside it with a vein down it. */
function earOf(len: number, w: number, n: number): Mesh {
  const line = curve([0, 0, 0], [0, -0.06, len * 0.5], [0, 0.06, len], 5);
  const ws = [w * 0.62, w * 0.95, w, w * 0.78, w * 0.42, 0.02];
  const shell = tube(line, ws, ws.map((x) => Math.max(0.03, x * 0.22)), n, (ring) => (ring >= 4 ? 'mark' : 'coat'), { up: [0, 1, 0], seam: 'start' });
  // The lining: the ear's own outline drawn in, on its front face, wound to face forward.
  const k = [1, 2, 3, 4];
  const side = (sd: number): V3[] => k.map((q) => [sd * ws[q] * 0.66, ws[q] * 0.24 + 0.012, line[q][2]] as V3);
  const lining = [[0, ws[0] * 0.2 + 0.012, line[0][2] + len * 0.1] as V3, ...side(-1), [0, 0.03, len * 0.93] as V3, ...side(1).reverse()];
  const vein = [[-0.025, 0.04, len * 0.16], [-0.02, 0.05, len * 0.7], [0.02, 0.05, len * 0.7], [0.025, 0.04, len * 0.16]] as V3[];
  return merge(shell, paint([{ v: lining, m: 'inner' }, { v: vein, m: 'shell' }]));
}

/** A cloven hoof: two dark toes side by side with a cleft between them, each a squat wedge longer forward than it is wide. */
function cloven(r: number, h: number, n: number): Mesh {
  return merge(...[-1, 1].map((sd) => tube([[sd * r * 0.42, r * 0.1, 0.04], [sd * r * 0.46, r * 0.22, -h * 0.5], [sd * r * 0.48, r * 0.32, -h]],
    [r * 0.42, r * 0.48, r * 0.5], [r * 0.62, r * 0.78, r * 0.86], n, 'hoof', { seam: 'start' })));
}

/** A cuff of leaves round the lower leg just over the hoof, tips up and out, like leg warmers; built on the lower leg's bone. */
function cuffOf(s: Snuff, lower: number, r: number, K: number, seed: number): Fronds {
  const count = 7;
  return fronds(Array.from({ length: count }, (_, q) => {
    const th = (q / count) * TAU + 0.4 * jitter(seed + q), rad: V3 = [Math.cos(th), Math.sin(th), 0];
    const root = add(scale(rad, r * 0.8), [0, 0, -lower * 0.92]);
    const dir = unit(add(scale(rad, 0.45), [0, 0, 1]));
    const len = s.cuff * (0.8 + 0.4 * jitter(seed + q + 11));
    const id = seed + q;
    return { mesh: leaf(root, dir, rad, len, len * 0.42, K, toneOf(id, 0.2), 0.1), out: rad };
  }));
}

/** Where a point on the barrel is, `y` along it and `th` round it from its right side (up positive), and the way out of it there. */
function onBarrel(s: Snuff, y: number, th: number): { p: V3; n: V3 } {
  const B = s.body;
  let k = 0;
  while (k < B.y.length - 2 && B.y[k + 1] < y) k++;
  const f = clamp((y - B.y[k]) / (B.y[k + 1] - B.y[k]));
  const w = lerp(B.w[k], B.w[k + 1], f), h = lerp(B.h[k], B.h[k + 1], f), z = lerp(B.z[k], B.z[k + 1], f);
  return { p: [w * Math.cos(th), y, z + h * Math.sin(th)], n: unit([Math.cos(th) / w, 0, Math.sin(th) / h]) };
}

/** Its soft pink patches: blotches of two or three overlapping spots, scattered along both flanks and over the rump. */
function patches(s: Snuff): Mesh {
  const out = [];
  const spots: Array<[number, number, number]> = [[-0.62, 0.25, 0.3], [-0.2, -0.35, 0.26], [0.22, 0.55, 0.22], [-0.85, 1.1, 0.24], [0.05, 0.05, 0.18]];
  for (const sd of [1, -1]) {
    for (let q = 0; q < spots.length; q++) {
      const [fy, th, r] = spots[q];
      const jy = fy + (sd > 0 ? 0 : 0.12 * (jitter(q) - 0.3)), y = jy * s.len * 0.5;
      const ang = sd > 0 ? th : Math.PI - th;
      for (let e = 0; e < 3; e++) {
        const { p, n } = onBarrel(s, y + (e - 1) * r * 0.55, ang + (e - 1) * 0.12 * (jitter(q + e) - 0.5));
        out.push(disc(add(p, scale(n, 0.03)), n, r * s.len * 0.22 * (0.7 + 0.3 * jitter(q * 3 + e)), r * s.len * 0.18, 7, 'mark', { spin: jitter(q + e * 7) }));
      }
    }
  }
  return paint(out);
}

/**
 * The snout: a short round barrel out in front of the eyes, pink, its flat
 * end a paler disc with two nostrils in it; and the bridge of the face it
 * grows out of, so a longer snout is a longer face rather than a peg.
 */
function snoutOf(s: Snuff, n: number, k: number): Mesh {
  const S = s.snout, y0 = S.at, y1 = S.at + S.len;
  const bridge = orbAlong([0, y0, S.z + S.r * 0.2], [0, 1, -0.1], [S.r * 1.2, S.r * 1.0, S.len * 0.75], n, k, 'coat');
  const barrel = tube([[0, y0 + S.len * 0.3, S.z + 0.02], [0, y0 + S.len * 0.7, S.z], [0, y1, S.z - 0.02]], [S.r * 1.04, S.r, S.r * 1.02], [S.r * 0.9, S.r * 0.84, S.r * 0.86], n, 'nose');
  const end: V3 = [0, y1 + 0.012, S.z - 0.02];
  const face = paint([
    disc(end, [0, 1, 0], S.r * 0.86, S.r * 0.72, 10, 'muzzle'),
    disc(add(end, [S.r * 0.34, 0.01, 0]), [0, 1, 0], S.r * 0.14, S.r * 0.24, 6, 'pad'),
    disc(add(end, [-S.r * 0.34, 0.01, 0]), [0, 1, 0], S.r * 0.14, S.r * 0.24, 6, 'pad'),
  ]);
  return merge(bridge, barrel, face);
}

/** A stage's pieces: a pig's body (`quadPieces`), and its face, ears, hooves, mane, bib, crest, cuffs, tail and patches. */
function snuffBuild(s: Snuff, lod: number): Piece[] {
  const n = cut(lod, 8, 10), k = cut(lod, 5, 6), K = lod ? 6 : 4;
  const H = s.head;
  // The face: the snout, a small smile at the corner of the mouth under it, and on the Snuffthorn a tusk up out of the lower jaw at
  // each side, curving up past the snout.
  const S = s.snout;
  const tusks = s.tusk ? merge(...[1, -1].map((sd) => taper(curve([sd * S.r * 0.8, S.at + S.len * 0.48, S.z - S.r * 0.72],
    [sd * S.r * 1.62, S.at + S.len * 0.66, S.z - S.r * 0.45], [sd * S.r * 1.32, S.at + S.len * 0.46, S.z + S.r * 1.2], 6), 0.16, 0.03, 6, 'tooth'))) : undefined;
  const mouth = merge(...[1, -1].map((sd) => smile([sd * S.r * 0.98, S.at + S.len * 0.32, S.z - S.r * 0.66], [sd * 0.75, 0.65, -0.2], S.r * 0.55, 'lid')));
  const snout = snoutOf(s, n, k);
  // A small pink patch on the brow, off to one side, as its flanks have.
  const brow = onEgg(H.c, H.r, [0.22, 0.5, 0.82]);
  const patch = paint([disc(add(brow.p, scale(brow.n, 0.02)), brow.n, H.r[0] * 0.17, H.r[0] * 0.12, 7, 'mark', { spin: 0.4 })]);
  const face = merge(snout, mouth, tusks, patch);
  // The crest: leaves standing up off the crown between the ears, fanned, swept a little back; and a flower or two at the foot of it.
  const crown = onEgg(H.c, H.r, [0, -0.05, 1]).p;
  const [crestN, crestL] = s.crest;
  const crestParts = Array.from({ length: crestN }, (_, q) => {
    const f = crestN > 1 ? q / (crestN - 1) - 0.5 : 0;
    const id = 500 + q;
    const root = add(crown, [f * H.r[0] * 0.7, -0.15 - 0.15 * Math.abs(f), -0.12]);
    const dir = unit([f * 1.4, -0.45 - 0.2 * jitter(id), 1]);
    return { mesh: leaf(root, dir, [0, 1, 0.2], crestL * (1 - 0.35 * Math.abs(f) * 2 + 0.15 * jitter(id + 1)), crestL * 0.36, K, toneOf(id), 0.12), out: [0, -0.3, 1] as V3 };
  });
  const crownFlowers = Array.from({ length: s.flowers[1] }, (_, q) => {
    const sd = q % 2 ? -1 : 1;
    const at = onEgg(H.c, H.r, [sd * 0.42, 0.1, 0.9]);
    return { mesh: flower(add(at.p, scale(at.n, 0.06)), add(at.n, [0, 0.5, 0]), 0.19, q), out: at.n, stiff: true };
  });
  const crest = fronds([...crestParts, ...crownFlowers]);
  // The tail: a short curl, and a tuft of leaves on the end of it fanned back and up.
  const tuft = fronds(Array.from({ length: 7 }, (_, q) => {
    const f = q / 6 - 0.5;
    const dir = unit([f * 1.3, -1, 0.35 + 0.4 * (0.5 - Math.abs(f))]);
    return { mesh: leaf([0, -0.04, 0], dir, [0, 0.2, 1], s.tail * (1 - 0.4 * Math.abs(f)), s.tail * 0.36, K, q % 2 ? 'pink' : 'green', 0.15), out: [0, 0, 1] as V3 };
  }));
  // The mane: its front rows on the neck's root (`ruff`), going down with the head; the rest, and the leaves down the back, on the body.
  const front = s.ruff.length > 2 ? [0, 1] : [0];
  const rest = s.ruff.map((_, r) => r).filter((r) => !front.includes(r));
  const ruff = fronds(ruffRows(s, front, K, false).map((p) => ({ ...p, mesh: moved(p.mesh, scale(s.neck.at, -1)) })));
  const mane = fronds([...ruffRows(s, rest, K, false), ...backLeaves(s, K)]);
  const bib = fronds(bibOf(s, K));
  const blooms = fronds(ruffRows(s, [], K, true));
  const ruffLen = s.ruff[s.ruff.length - 1][1];
  const legs = (fore: boolean): { upper: [number, number, number, number]; lower: [number, number, number, number]; foot: Mesh } => {
    const L = (fore ? 0.5 : 0.54) * s.legs, w = s.thick;
    return { upper: [0.35, -L, w * (fore ? 1.5 : 1.75), w * 1.05], lower: [0, -L, w, w * 0.86], foot: cloven(w * 0.95, s.hoof, n) };
  };
  const hindUpper = 0.54 * s.legs;
  const thigh = (sd: number): Mesh => paint([disc([sd * s.thick * 1.6, -0.05, -hindUpper * 0.2], [sd, -0.2, 0.1], s.thick * 0.9, s.thick * 1.1, 7, 'mark')]);
  const pieces = quadPieces({
    n, k,
    body: { ...s.body, belly: false },
    neck: { w: s.neck.w, h: s.neck.w * 0.92, len: s.neck.len },
    head: { c: H.c, r: H.r, face, eye: { dir: [0.6, 0.64, 0.4], size: H.eye, iris: 'bark', pupil: 0.72, rim: 0.08, tall: 1.12 }, blush: [[0.74, 0.5, -0.2], H.r[0] * 0.2] },
    ear: earOf(s.ear.len, s.ear.w, n),
    earTurn: 20,
    tail: [tube(curve([0, 0.04, 0], [0, -0.16, 0.08], [0, -0.24, -0.02], 3), 0.07, 0.07, 5, 'coat', { seam: 'start' }), tuft.mesh],
    fore: legs(true),
    hind: legs(false),
    breath: 0.04,
    extras: [
      { key: 'ruff', mesh: ruff.mesh, bone: 'ruff', bias: 0.16, after: ['neck', 'body'], thin: true, bent: rustling(ruff, s.ruff[0][1], 0) },
      { key: 'mane', mesh: mane.mesh, bone: 'trunk', bias: 0.12, after: ['body', 'neck'], thin: true, bent: rustling(mane, ruffLen, 0.6) },
      { key: 'bib', mesh: bib.mesh, bone: 'ruff', bias: 0.17, after: ['body', 'neck', 'fl0', 'fr0'], front: [0, 1, 0], thin: true, bent: rustling(bib, s.ruff[0][1], 0.3) },
      { key: 'blooms', mesh: blooms.mesh, bone: 'trunk', bias: 0.17, after: ['mane', 'ruff', 'body'], thin: true, bent: rustling(blooms, ruffLen, 0.6) },
      { key: 'crest', mesh: crest.mesh, bone: 'head', bias: 0.23, after: ['head', 'ear0', 'ear1'], hide: [{ c: H.c, r: H.r }], thin: true, bent: rustling(crest, crestL, 0.3) },
      { key: 'thighs', mesh: thigh(-1), bone: 'hl0', bias: 0.012, after: 'hl0' },
      { key: 'thighs1', mesh: thigh(1), bone: 'hr0', bias: 0.012, after: 'hr0' },
    ],
  });
  // The leaf cuffs on each lower leg, over the leg and drawn with it.
  for (const [key, side, fore] of [['fl', -1, true], ['fr', 1, true], ['hl', -1, false], ['hr', 1, false]] as Array<[string, number, boolean]>) {
    const lower = (fore ? 0.5 : 0.54) * s.legs;
    const c = cuffOf(s, lower, s.thick * 0.95, K, key.charCodeAt(0) * 7 + key.charCodeAt(1));
    pieces.push({ key: `${key}cuff`, mesh: c.mesh, bone: `${key}1`, bias: 0.025, after: [`${key}1`, `${key}2`, 'body'], front: [side * 0.7, fore ? 0.7 : -0.7, 0], thin: true, bent: rustling(c, s.cuff, fore ? 0 : 1) });
  }
  // The patches painted on the barrel; and the tail's tuft rustles as the mane does.
  return pieces.map((pc) => {
    if (pc.key === 'body') return { ...pc, mesh: merge(pc.mesh, patches(s)) };
    if (pc.key === 'tail1') return { ...pc, bent: rustling(tuft, s.tail, 1.5) };
    return pc;
  });
}

/* ---- what it throws about --------------------------------------------------------------- */

const LEAF: RGB = [150, 188, 104];
const LEAF_PINK: RGB = [238, 196, 192];
const PETAL: RGB = [253, 249, 240];
const EARTH: RGB = [132, 98, 72];
const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;

/** A leaf in the air, `len` long, turned `ang`, in its colour with a darker edge and rib. */
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
  g.strokeStyle = css(mix(c, [40, 50, 30], 0.45), al);
  g.stroke();
  g.beginPath();
  g.moveTo(-len * 0.4, 0);
  g.lineTo(len * 0.4, 0);
  g.stroke();
  g.restore();
}

/** A petal in the air: a small cream oval with a blush at its base. */
function flyingPetal(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, al: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.ellipse(0, 0, r, r * 0.6, 0, 0, TAU);
  g.fillStyle = css(PETAL, al);
  g.fill();
  g.lineWidth = r * 0.18;
  g.strokeStyle = css([226, 170, 176], al * 0.8);
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

/** Where something thrown from `p` with velocity `v` is `s` seconds on, falling; it lies where it lands. */
const thrown = (p: V3, v: V3, s: number, fall = 9): V3 => [p[0] + v[0] * s, p[1] + v[1] * s, Math.max(0.02, p[2] + v[2] * s - 0.5 * fall * s * s)];

/**
 * Dust kicked up by the hoof it scrapes as it gathers itself; and leaves and
 * petals torn off the mane as the snout goes in, flying up and out to the
 * sides, tumbling, and coming down.
 */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Snuff, b: Bones, at: Bones, t: number, front: boolean): void {
  // A little dust kicked up behind the scraping hoof as it drags back.
  const kick = hump(t, SCRAPE * 0.8, SCRAPE * 0.35);
  if (kick > 0 && front) {
    const foot = place(b.fr2, [0, -0.2, -s.hoof]);
    const [x, y] = onScreen(view, [foot[0], foot[1] - 0.3 * (1 - kick), 0.1]);
    const r = 0.6 + 1.2 * (t / SCRAPE);
    const dust = g.createRadialGradient(x, y, 0, x, y, r);
    dust.addColorStop(0, css([176, 146, 112], 0.45 * kick));
    dust.addColorStop(1, css([176, 146, 112], 0));
    g.fillStyle = dust;
    g.beginPath();
    g.ellipse(x, y - r * 0.2, r, r * 0.6, 0, 0, TAU);
    g.fill();
  }
  const since = (t - STRIKE.hit) * ACT_SECS.strike;
  if (since <= 0) return;
  const fade = 1 - ramp(t, 0.72, 1);
  const count = 6 + 3 * s.ruff.length;
  for (let q = 0; q < count; q++) {
    const th = (q / count) * TAU + jitter(q) * 0.6;
    const from = place(at.ruff, sub(onBarrel(s, rowY(s, 0), th).p, s.neck.at));
    const speed = 2.4 + 2.2 * jitter(q + 9);
    const v: V3 = [Math.cos(th) * speed, -0.6 + 1.4 * jitter(q + 4), 2.8 + 2.6 * jitter(q + 2) + Math.max(0, Math.sin(th)) * 1.5];
    const p = thrown(from, v, since, 6);
    // Drawn in front of the body or behind it by which side of it it is on.
    if (dot(sub(p, at.body.t), view.T) > 0 !== front) continue;
    const [x, y] = onScreen(view, p);
    const spin = q * 1.7 + since * (6 + 6 * jitter(q + 5)) * (q % 2 ? 1 : -1);
    if (q % 3 === 2) flyingPetal(g, x, y, 0.28 + 0.04 * s.ruff.length, spin, fade);
    else flyingLeaf(g, x, y, 0.9 + 0.14 * s.ruff.length, spin, jitter(q * 3 + 1) < 0.3 ? LEAF_PINK : LEAF, fade);
  }
}

/**
 * Rooting: a patch of turned earth on the ground under the snout, and at
 * each flick of it clods thrown up and out to the sides, with a petal and a
 * leaf shaken loose from the mane, and a low puff of dust where it went in.
 */
function rootSpray(g: CanvasRenderingContext2D, view: View, s: Snuff, b: Bones, a: Anim, t: number, front: boolean): void {
  const tip = place(b.head, [0, s.snout.at + s.snout.len, s.snout.z]);
  const ground: V3 = [tip[0], tip[1], 0.05];
  const big = 0.85 + 0.15 * s.ruff.length;
  if (!front) {
    // The turned earth: a dark patch with a lump or two on it, there as long as the snout is down at it.
    const down = rootOf(t, a.graze).down;
    const [x, y] = onScreen(view, ground);
    g.fillStyle = css(mix(EARTH, [60, 44, 34], 0.35), 0.55 * down);
    g.beginPath();
    g.ellipse(x, y, 1.3 * big, 0.6 * big, 0, 0, TAU);
    g.fill();
    for (let q = 0; q < 3; q++) clod(g, x + (q - 1) * 0.8 * big, y + (q % 2 ? 0.2 : -0.15) * big, 0.26 * big, q * 2.1, down);
    return;
  }
  for (const t0 of [0.29, 0.79]) {
    const since = frac(t - t0) * ACT_SECS.work;
    if (since > 0.55) continue;
    const fade = 1 - smooth(since / 0.55);
    for (let q = 0; q < 9; q++) {
      const id = q + t0 * 40;
      const side = (jitter(id) - 0.5) * 2.8;
      const v: V3 = [side, 0.1 + 1.0 * jitter(id + 3), 3.2 + 2.2 * jitter(id + 6)];
      const [x, y] = onScreen(view, thrown(ground, v, since));
      if (q === 7) flyingPetal(g, x, y, 0.32 * big, id + since * 8, fade);
      else if (q === 8) flyingLeaf(g, x, y, 0.95 * big, id + since * 7, LEAF, fade);
      else clod(g, x, y, (0.26 + 0.2 * jitter(id + 1)) * big, id, fade);
    }
    const [x, y] = onScreen(view, ground);
    const r = (0.9 + 2 * since) * big;
    const dust = g.createRadialGradient(x, y, 0, x, y, r);
    dust.addColorStop(0, css([176, 146, 112], 0.4 * fade));
    dust.addColorStop(1, css([176, 146, 112], 0));
    g.fillStyle = dust;
    g.beginPath();
    g.ellipse(x, y, r, r * 0.55, 0, 0, TAU);
    g.fill();
  }
}

/** Evolving: petals and leaves going up round it in a spiral, wider at the foot and gathering in as they rise. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Snuff, b: Bones, t: number, front: boolean): void {
  const fade = ramp(t, 0, 0.15) * (1 - ramp(t, 0.75, 1));
  const tall = s.legs + s.body.h[4] * 2 + s.head.r[2] * 2;
  const wide = s.len * 0.75;
  const count = 18;
  for (let q = 0; q < count; q++) {
    const rise = frac(t * 1.2 + q / count);
    const ang = (q / count) * TAU * 3 + t * TAU * 1.4;
    const r = wide * (1 - 0.45 * rise);
    const p: V3 = [Math.cos(ang) * r * 0.75, Math.sin(ang) * r, rise * tall];
    if (dot(sub(p, [0, 0, b.body.t[2]]), view.T) > 0 !== front) continue;
    const [x, y] = onScreen(view, p);
    const al = fade * Math.sin(rise * Math.PI);
    if (q % 3 === 0) flyingPetal(g, x, y, 0.32, ang * 2, al);
    else flyingLeaf(g, x, y, 0.95, ang * 1.5 + rise * 4, q % 3 === 1 ? LEAF : LEAF_PINK, al);
  }
}

/** Light: a soft flash at the snout as it strikes. */
function snuffGlow(s: Snuff, b: Bones, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  if (a.act?.kind !== 'strike') return [];
  const k = hump(a.act.t, STRIKE.hit + 0.02, 0.1);
  if (k <= 0) return [];
  return [{ p: place(b.head, [0, s.snout.at + s.snout.len + 0.2, s.snout.z + 0.1]), r: 1.2 + 0.4 * s.ruff.length, c: [255, 246, 220], a: 0.4 * k }];
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, roots and evolves. */
function snuffKind(s: Snuff): Kind {
  const bones = snuffBones(s);
  // Where everything is at the moment the snout goes in, for what is torn off then to fly from.
  const atHit = (a: Anim): Bones => bones({ ...a, act: { kind: 'strike', t: STRIKE.hit } });
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
      eye: [62, 34, 38],
      bark: [128, 70, 58],
      leaf: LEAF,
      stem: mix(LEAF, [92, 132, 76], 0.3),
      leafDark: [110, 150, 84],
      moss: LEAF_PINK,
      shellDark: mix(LEAF_PINK, [214, 140, 152], 0.35),
      shell: [216, 150, 160],
      petal: PETAL,
      bloom: [246, 210, 92],
      hoof: [98, 72, 64],
      tooth: [252, 248, 236],
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
      else if (act.kind === 'work') rootSpray(g, view, s, b, a, act.t, front);
      else if (act.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const SNUFFLET = snuffKind(SNUFFLET_LOOK);
export const SNUFFROOT = snuffKind(SNUFFROOT_LOOK);
export const SNUFFTHORN = snuffKind(SNUFFTHORN_LOOK);
