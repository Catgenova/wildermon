import {
  ACT_SECS, add, beat, clamp, cross, curve, cyc, DEG, disc, dot, frac, lerp, lifted, merge, mix, onEgg, orb, orbAlong,
  coatPalette, paint, quadBonesOf, scale, shadowOf, smile, smooth, step, sub, TAU, tube, unit, type Anim, type Bones, type Disc, type Kind,
  type LegSpec, type Piece, type QuadPose, type QuadSpec,
} from './beasts';
import { cut, quadPieces } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The giraffe line: the Saplingreach, a small fawn of a browser -- cream,
 * dappled soft green and peach over its back, neck and haunches, a big head
 * with big dark eyes and an orange-peach muzzle, big ears lined with leaves,
 * a crest of leaves down the back of its neck, a twig for an antler on each
 * side of its crown with new leaves on it, green leaf tufts round its lower
 * legs over dark hooves, and for a tail a long leafy branch; which grows into
 * the Canopyshaper, taller and leggier, a long giraffe's neck, more dapples, a
 * bigger mane of leaves running on down its back with orange among the
 * green, forked twig antlers, vines hanging down its flanks, and a longer
 * branch for a tail, its leaves drooping; and then the Grovemaster, a big
 * heavy giraffe of a beast, its antlers grown into whole bonsai trees with
 * flat canopies, more of them growing off its shoulders and its back, mossy
 * vines draped over it, and a thick branch for a tail ending in clumps of
 * leaves. The species is still `snedda` underneath, as saves and the
 * database know it: it prunes trees.
 *
 * Each is its variant's coat for its cream and its markings for the green of
 * its dapples; the peach dapples, the leaves, the bark, the antlers and the
 * hooves are the same on every variant. All three are built by one set of
 * functions from a description of the stage (`Reach`), on the four-legged
 * body the goat line has (`./wild-goat`), its shoulders carried higher than
 * its hips: each hoof lifted straight off the grass and set straight down,
 * the four beats of a walk, the diagonals at a run.
 *
 * At its task it prunes a tree before it (`REACH_WORK`): its neck stretched
 * up, its nose to a dead twig sticking out of the trunk, two nips at it, the
 * twig snapped off and pulled away in its mouth, its head turned aside to let
 * it fall to the grass, where it lies; and its head down again to where it
 * started, a new dead twig on the trunk for the next go.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Rings along a body: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

/** A tree grown out of it: where on it (along the body nought the rump to one the chest, round from the side), which way, how long, its canopies. */
interface Grown { u: number; th: number; dir: V3; len: number; r: number; pads: number; pad: number; side: number; ways?: V3[] }

interface Reach {
  stage: 0 | 1 | 2;
  /** The barrel's rings, rump to chest. */
  body: Rings;
  /** Shoulder to hip; the legs, how long, how thick at the top; how tall the hoof is. */
  len: number;
  legs: number;
  thick: number;
  hoof: number;
  /** The neck's root on the body, its length, how wide at its root and at the head, and how far forward of upright it is carried (degrees). */
  neck: { at: V3; len: number; w: [number, number]; lean: number };
  /** The skull, an egg; the muzzle out of the front of it (its middle, the way it points, its half-sizes across, up and along); how far nose-up it is carried. */
  head: { skull: { c: V3; r: V3 }; muzzle: { c: V3; dir: V3; r: V3 }; pitch: number };
  /** The way out of the skull to the right eye, how big, and how far a calm lid comes down over it. */
  eye: { dir: V3; size: number; lid: number };
  /** Each ear: how long and wide, held out to the side and laid back (degrees); how many leaves line its root. */
  ear: { len: number; w: number; out: number; back: number; leaves: number };
  /**
   * Its antlers: a twig with new leaves (0), a forked twig (1), or a whole tree with flat canopies (2); how long, how thick at
   * the root, how far out from upright they lean, and how big a leaf or a canopy on them is.
   */
  antler: { kind: 0 | 1 | 2; len: number; r: number; out: number; leaf: number };
  /** The crest of leaves down the back of its neck: how many, how long and wide a leaf, how far on along its back (nought the withers, one the rump), how many in ten are orange. */
  crest: { n: number; len: number; w: number; back: number; orange: number };
  /** Its dapples: how many down each side of the body, how big, and how many up the neck. */
  dapples: { n: number; r: number; neck: number };
  /** Its tail, a branch: its links and their length, how thick at the root, leaves along it and how long, how far they droop, the clumps at its end. */
  tail: { links: number; len: number; r: number; lift: number; curl: number; leaves: number; leaf: number; droop: number; clumps: number };
  /** The leaf tufts round each lower leg: how many round, how long a leaf; and another ring at the knee. */
  cuffs: { n: number; len: number; knee: boolean };
  /** Vines: how many draped over each flank, and how long they hang below it; moss patches on its back. */
  vines: { n: number; len: number };
  moss: number;
  /** Trees grown out of its shoulders and back. */
  trees: Grown[];
  /** How it goes: how much it bounces at a walk and a run; how far it nods; how far its legs swing and for how much of a stride a hoof is down. */
  gait: { bounce: [number, number]; nod: number; swing: [number, number]; duty: [number, number] };
  /** Its strike: a hop and a butt, a rearing stamp, or a rearing slam. */
  strike: 0 | 1 | 2;
  size: number;
}

/** A head scaled by `k` about its neck, for a head drawn bigger or smaller against its body. */
const sized = (k: number, H: Reach['head']): Reach['head'] => ({
  skull: { c: scale(H.skull.c, k), r: scale(H.skull.r, k) }, muzzle: { c: scale(H.muzzle.c, k), dir: H.muzzle.dir, r: scale(H.muzzle.r, k) }, pitch: H.pitch,
});

/** A Saplingreach: a slim fawn, a slender head, big leafy ears, a twig antler each side, a leafy branch for a tail. */
const SAPLINGREACH_LOOK: Reach = {
  stage: 0,
  // High at the withers and sloping to the rump, the chest the deepest of it.
  body: { y: [-0.72, -0.62, -0.33, 0.02, 0.36, 0.6, 0.72], z: [0.02, 0.0, -0.01, 0.05, 0.14, 0.24, 0.3], w: [0.16, 0.29, 0.35, 0.37, 0.37, 0.34, 0.16], h: [0.17, 0.3, 0.34, 0.37, 0.42, 0.42, 0.24] },
  len: 1.25, legs: 1.15, thick: 0.13, hoof: 0.11,
  neck: { at: [0, 0.6, 0.45], len: 0.85, w: [0.21, 0.12], lean: 32 },
  head: sized(1.02, { skull: { c: [0, 0, 0.15], r: [0.26, 0.31, 0.25] }, muzzle: { c: [0, 0.39, 0.0], dir: [0, 1, -0.42], r: [0.12, 0.115, 0.34] }, pitch: -2 }),
  eye: { dir: [0.66, 0.58, 0.42], size: 0.066, lid: 0.18 },
  ear: { len: 0.48, w: 0.2, out: 66, back: 26, leaves: 3 },
  antler: { kind: 0, len: 0.5, r: 0.035, out: 12, leaf: 0.2 },
  crest: { n: 54, len: 0.25, w: 0.12, back: 0.45, orange: 1 },
  dapples: { n: 90, r: 0.05, neck: 46 },
  tail: { links: 3, len: 0.4, r: 0.045, lift: 0, curl: -22, leaves: 2, leaf: 0.26, droop: 1, clumps: 0 },
  cuffs: { n: 6, len: 0.12, knee: true },
  vines: { n: 0, len: 0 },
  moss: 0,
  trees: [],
  gait: { bounce: [0.03, 0.22], nod: 5, swing: [24, 36], duty: [0.62, 0.4] },
  strike: 0,
  size: 1.75,
};

/** A Canopyshaper: taller, a long giraffe's neck, a mane of green and orange leaves, forked twig antlers, vines on its flanks. */
const CANOPYSHAPER_LOOK: Reach = {
  stage: 1,
  body: { y: [-0.98, -0.86, -0.46, 0.02, 0.5, 0.83, 0.98], z: [0.02, 0.0, 0.0, 0.09, 0.22, 0.36, 0.44], w: [0.2, 0.38, 0.45, 0.48, 0.49, 0.46, 0.21], h: [0.21, 0.38, 0.44, 0.5, 0.58, 0.58, 0.32] },
  len: 1.7, legs: 1.75, thick: 0.17, hoof: 0.14,
  neck: { at: [0, 0.83, 0.65], len: 1.9, w: [0.33, 0.16], lean: 20 },
  head: sized(1.12, { skull: { c: [0, 0, 0.15], r: [0.26, 0.32, 0.25] }, muzzle: { c: [0, 0.35, 0.0], dir: [0, 1, -0.4], r: [0.13, 0.12, 0.3] }, pitch: 0 }),
  eye: { dir: [0.66, 0.58, 0.42], size: 0.066, lid: 0.2 },
  ear: { len: 0.55, w: 0.22, out: 74, back: 26, leaves: 4 },
  antler: { kind: 1, len: 0.85, r: 0.05, out: 14, leaf: 0.26 },
  crest: { n: 96, len: 0.36, w: 0.19, back: 0.65, orange: 3 },
  dapples: { n: 150, r: 0.062, neck: 110 },
  tail: { links: 4, len: 0.5, r: 0.065, lift: 4, curl: -16, leaves: 3, leaf: 0.4, droop: 1.3, clumps: 0 },
  cuffs: { n: 7, len: 0.16, knee: true },
  vines: { n: 2, len: 0.3 },
  moss: 0,
  trees: [],
  gait: { bounce: [0.02, 0.26], nod: 4, swing: [20, 30], duty: [0.64, 0.42] },
  strike: 1,
  size: 1.8,
};

/** A Grovemaster: big and heavy, bonsai trees for antlers and on its back, mossy vines over it, clumps of leaves on its tail. */
const GROVEMASTER_LOOK: Reach = {
  stage: 2,
  // A broad deep chest and heavy shoulders, the back sloping away to the rump.
  body: { y: [-1.5, -1.32, -0.72, 0, 0.8, 1.3, 1.52], z: [0.06, 0.0, 0.0, 0.16, 0.38, 0.6, 0.72], w: [0.46, 0.88, 1.06, 1.12, 1.16, 1.1, 0.54], h: [0.4, 0.78, 0.92, 1.02, 1.14, 1.12, 0.6] },
  len: 2.75, legs: 2.15, thick: 0.48, hoof: 0.27,
  neck: { at: [0, 1.3, 1.16], len: 2.2, w: [0.7, 0.3], lean: 20 },
  head: sized(1.38, { skull: { c: [0, 0, 0.15], r: [0.26, 0.33, 0.25] }, muzzle: { c: [0, 0.36, -0.01], dir: [0, 1, -0.38], r: [0.14, 0.13, 0.31] }, pitch: 2 }),
  eye: { dir: [0.66, 0.58, 0.42], size: 0.066, lid: 0.24 },
  ear: { len: 0.6, w: 0.22, out: 76, back: 30, leaves: 4 },
  antler: { kind: 2, len: 2.4, r: 0.18, out: 18, leaf: 0.7 },
  crest: { n: 114, len: 0.48, w: 0.26, back: 0.95, orange: 3 },
  dapples: { n: 220, r: 0.085, neck: 150 },
  tail: { links: 4, len: 0.72, r: 0.16, lift: 12, curl: -10, leaves: 3, leaf: 0.55, droop: 1.5, clumps: 2 },
  cuffs: { n: 8, len: 0.26, knee: true },
  vines: { n: 3, len: 0.3 },
  moss: 14,
  trees: [
    // Lower and smaller than the antlers' trees: out of its near shoulder, up and out forward; and out of the far side of its back,
    // up and back.
    { u: 0.86, th: 1.15, dir: [0.4, 0.3, 1], len: 1.6, r: 0.15, pads: 3, pad: 0.48, side: 1, ways: [[0.7, 0.8, 0]] },
    { u: 0.22, th: 1.3, dir: [-0.2, -0.3, 1], len: 1.4, r: 0.14, pads: 3, pad: 0.44, side: -1, ways: [[-0.4, -1, 0]] },
  ],
  gait: { bounce: [0, 0.26], nod: 2.5, swing: [16, 25], duty: [0.65, 0.44] },
  strike: 2,
  size: 2.2,
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each leaf and dapple, nought to one, so a coat is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
const mixV = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

/** Where a point on a body of rings is, `y` along it and `th` round it from its right side (up positive), and the way out of it there. */
function onRings(R: Rings, y: number, th: number): { p: V3; n: V3 } {
  let k = 0;
  while (k < R.y.length - 2 && R.y[k + 1] < y) k++;
  const dy = R.y[k + 1] - R.y[k], f = clamp((y - R.y[k]) / dy);
  const w = lerp(R.w[k], R.w[k + 1], f), h = lerp(R.h[k], R.h[k + 1], f), z = lerp(R.z[k], R.z[k + 1], f);
  const c = Math.cos(th), s = Math.sin(th);
  const slope = -((c * c * (R.w[k + 1] - R.w[k])) / w + (s * (R.z[k + 1] - R.z[k])) / h + (s * s * (R.h[k + 1] - R.h[k])) / h) / dy;
  return { p: [w * c, y, z + h * s], n: unit([c / w, slope, s / h]) };
}
const onBody = (s: Reach, y: number, th: number): { p: V3; n: V3 } => onRings(s.body, y, th);
/** Along the body, nought at the rump's ring and one at the chest's. */
const alongBody = (s: Reach, u: number): number => lerp(s.body.y[1], s.body.y[5], u);
const onSkull = (s: Reach, dir: V3): { p: V3; n: V3 } => onEgg(s.head.skull.c, s.head.skull.r, dir);
/** The muzzle's own frame: across it (to the left), up it, and along it. */
function muzzleFrame(s: Reach): [V3, V3, V3] {
  const z = unit(s.head.muzzle.dir), x = unit(cross([0, 0, 1], z));
  return [x, cross(z, x), z];
}
/** Where the way `dir` out of the middle of the muzzle, in its own frame, meets it, and the way out of it there. */
function onMuzzle(s: Reach, dir: V3): { p: V3; n: V3 } {
  const M = s.head.muzzle, [x, y, z] = muzzleFrame(s), q = onEgg([0, 0, 0], M.r, dir);
  const to = (v: V3): V3 => add(add(scale(x, v[0]), scale(y, v[1])), scale(z, v[2]));
  return { p: add(M.c, to(q.p)), n: unit(to(q.n)) };
}
/** Where it bites with: the front of its lips, under the end of the muzzle. */
const mouthOf = (s: Reach): V3 => onMuzzle(s, [0, -0.35, 0.94]).p;
const left = (q: { p: V3; n: V3 }): { p: V3; n: V3 } => ({ p: [-q.p[0], q.p[1], q.p[2]], n: [-q.n[0], q.n[1], q.n[2]] });

/** Solids the body is, in the trunk's frame, for what is on the far side of it to be hidden behind: its back half and its front. */
function bodySolids(s: Reach, k = 0.92): Array<{ c: V3; r: V3 }> {
  const B = s.body, h = (B.y[5] - B.y[1]) / 4;
  return [
    { c: [0, B.y[1] + h * 1.2, B.z[2] + 0.02], r: [B.w[2] * k, h * 1.5, B.h[2] * k] },
    { c: [0, B.y[5] - h * 1.2, B.z[4] + 0.02], r: [B.w[4] * k, h * 1.5, B.h[4] * k] },
  ];
}
const skullOf = (s: Reach): { c: V3; r: V3 } => ({ c: s.head.skull.c, r: scale(s.head.skull.r, 0.9) });
function muzzleOf(s: Reach): { c: V3; r: V3 } {
  const M = s.head.muzzle;
  return { c: M.c, r: [M.r[0] * 0.85, M.r[2] * 0.85, M.r[1] * 0.85] };
}

/** A frame square to `n`: two ways across it. */
function across(n: V3): [V3, V3] {
  const z = unit(n);
  let x = cross([0, 0, 1], z);
  if (Math.hypot(x[0], x[1], x[2]) < 1e-3) x = [1, 0, 0];
  x = unit(x);
  return [x, cross(z, x)];
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

/** A painted shape of corners `v`, wound so it faces out along `n` as a disc does. */
function facing(v: V3[], n: V3, m: Mat, at?: V3): Disc {
  let nx = 0, ny = 0, nz = 0;
  for (let c = 0; c < v.length; c++) {
    const p = v[c], r = v[(c + 1) % v.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nx * n[0] + ny * n[1] + nz * n[2] < 0 ? v.reverse() : v, m, at };
}

/** A thin painted line along a run of points on a surface, `w` wide, each point's way out given: a lid. */
function line(pts: ReadonlyArray<{ p: V3; n: V3 }>, w: number, m: Mat): Disc {
  const up = (q: { p: V3; n: V3 }, k: number): V3 => {
    const d = unit(cross(q.n, [1, 0, 0]));
    return add(add(q.p, scale(q.n, 0.02)), scale(d, k * w));
  };
  const v = [...pts.map((q) => up(q, 1)), ...[...pts].reverse().map((q) => up(q, -1))];
  return facing(v, pts.reduce((t, q) => add(t, q.n), [0, 0, 0] as V3), m);
}

const mirrorX = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));

/** A mesh with each face given its stuff by where its middle is. */
function painted(m: Mesh, by: (c: V3) => Mat): Mesh {
  return mesh(m.v, m.f.map((f) => {
    const c: V3 = [0, 0, 0];
    for (const i of f.i) { c[0] += m.v[i][0] / f.i.length; c[1] += m.v[i][1] / f.i.length; c[2] += m.v[i][2] / f.i.length; }
    return { ...f, m: by(c) };
  }));
}

/** A ragged round blotch on a surface at `c`, facing `n`, `r` across, its edge uneven by `seed`: a dapple, a patch of moss. */
function blotch(c: V3, n: V3, r: number, seed: number, m: Mat, stretch = 1): Disc {
  const [u, w] = across(n), pts: V3[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU, rr = r * (0.86 + 0.22 * jitter(seed * 13 + k));
    pts.push(add(add(c, scale(u, Math.cos(a) * rr * stretch)), scale(w, Math.sin(a) * rr)));
  }
  return facing(pts, n, m);
}

/* ---- its legs and its stride ------------------------------------------------------------ */

/** Where each ear is rooted on the head (the right one): on the side of the crown, behind the eyes. */
const earRoot = (s: Reach): V3 => onSkull(s, [0.74, -0.42, 0.52]).p;
/** Where the antlers' root is on the skull (the right one): on top of the crown, inside the ears. */
const antlerRoot = (s: Reach): V3 => onSkull(s, [0.34, -0.22, 0.92]).p;

/** How the legs hang from the body standing: each leg's two parts' pitch (degrees, forward positive). */
const FORE_REST: [number, number, number] = [-3, 6, 0], HIND_REST: [number, number, number] = [14, -26, 0];
const foreLen = (s: Reach): number => s.legs * 0.5;
/** How far down the barrel the shoulder and the hip are, from the chest's ring and the rump's: the shoulder higher, as a giraffe's is. */
const foreAt = (s: Reach): number => s.body.z[4] - 0.3 * s.body.h[4];
const hindAt = (s: Reach): number => s.body.z[2] - 0.28 * s.body.h[2];
/** A hind leg long enough, bent as it stands, for its hoof to stand on the ground the fore hooves stand on. */
function hindLen(s: Reach): number {
  const c = (d: number): number => Math.cos(d * DEG);
  const reach = -foreAt(s) + foreLen(s) * (c(FORE_REST[0]) + c(FORE_REST[0] + FORE_REST[1]));
  return (reach + hindAt(s)) / (c(HIND_REST[0]) + c(HIND_REST[0] + HIND_REST[1]));
}

/** A stage's body on four hooves (`QuadSpec`). */
const specOf = (s: Reach): QuadSpec => ({
  high: s.legs + 0.6,
  fore: { at: [s.body.w[4] * 0.42, s.len * 0.44, foreAt(s)], len: [foreLen(s), foreLen(s), s.hoof], rest: FORE_REST, fold: [55, 90], toe: [s.thick * 0.7, s.thick * 0.3] },
  hind: { at: [s.body.w[2] * 0.44, -s.len * 0.42, hindAt(s)], len: [hindLen(s), hindLen(s), s.hoof], rest: HIND_REST, fold: [35, 60], toe: [s.thick * 0.7, s.thick * 0.3] },
  neck: { at: s.neck.at, len: s.neck.len, lean: s.neck.lean },
  head: { pitch: s.head.pitch },
  tail: { at: [0, s.body.y[0] + 0.06, s.body.z[0] + s.body.h[1] * 0.5], links: s.tail.links, len: s.tail.len, lift: s.tail.lift, curl: s.tail.curl, sway: 8 },
  ears: { at: earRoot(s), out: s.ear.out, back: s.ear.back },
  swing: s.gait.swing,
  duty: s.gait.duty,
  // Grazing, the long neck bowed right down to the grass, the nose down past level, the chest let down a little.
  graze: 96 - s.neck.lean + 6 * s.stage,
  nose: 30,
  bow: 8,
  rock: 3,
});

/** Where each leg's foot is in a stride: the four beats of a walk, and the diagonals together at a run. */
const FOUR_BEAT = [0.25, 0.75, 0, 0.5];
const DIAGONALS = [0, 0.5, 0.5, 0];

/**
 * A leg's stride: standing, as `step` has it; swinging, its hoof lifted
 * straight off the grass, carried forward and set straight down on its mark,
 * the leg swung to whatever puts the hoof there, folded as it is (as the
 * goat line's are, `./wild-goat`).
 */
const REACHED = 0.88, LIFTED = 0.26;
function lifting(L: LegSpec, u: number, duty: number, amp: number, high = 1): [number, number, number] {
  const [sw0, , off] = step(u, duty, amp);
  if (!off) return [sw0, 0, 0];
  const e = smooth((off - LIFTED) / (REACHED - LIFTED)), fold = high * Math.sin(Math.PI * off);
  const from = ankleOf(L, -amp, 0)[0], to = ankleOf(L, amp, 0)[0], want = lerp(from, to, e);
  let lo = -amp - 70, hi = amp + 70;
  for (let q = 0; q < 18; q++) {
    const mid = (lo + hi) / 2;
    if (ankleOf(L, mid, fold)[0] < want) lo = mid;
    else hi = mid;
  }
  return [(lo + hi) / 2, fold, off];
}

/** How far a fore leg or a hind leg swings against the other, for their hooves to sweep back over the grass equally fast. */
function sweepOf(spec: QuadSpec, fore: boolean): number {
  const r = (L: LegSpec): number => { const [y, z] = ankleOf(L, 0, 0); return Math.hypot(y - L.at[1], z - L.at[2]); };
  const f = r(spec.fore), h = r(spec.hind), mid = (f + h) / 2;
  return mid / (fore ? f : h);
}

/** The swing and the fold that put a leg's ankle at a point in the body's own frame, the knee its own way round. */
function legTo(L: LegSpec, y: number, z: number, elbow: boolean, stretch = 0.999): [number, number] {
  const rest = L.rest ?? [0, 0, 0], folds = L.fold ?? [45, 75];
  const L0 = L.len[0], L1 = L.len[1];
  const dy = y - L.at[1], dz = z - L.at[2];
  const d = Math.min((L0 + L1) * stretch, Math.max(Math.abs(L0 - L1) + 1e-3, Math.hypot(dy, dz)));
  const knee = Math.acos(clamp((L0 * L0 + d * d - L1 * L1) / (2 * L0 * d), -1, 1));
  const a1 = Math.atan2(dy, -dz) + (elbow ? -knee : knee);
  const ky = L.at[1] + L0 * Math.sin(a1), kz = L.at[2] - L0 * Math.cos(a1);
  let a2 = Math.atan2(y - ky, kz - z) - a1;
  while (a2 > Math.PI) a2 -= TAU;
  while (a2 < -Math.PI) a2 += TAU;
  const sw = a1 / DEG - rest[0];
  return [sw, (rest[1] - a2 / DEG) / lerp(folds[0], folds[1], clamp(Math.abs(sw) / 40))];
}

/** Where a leg's ankle is in the body's own frame (`y`, `z`), swung and folded as the pose has it. */
function ankleOf(L: LegSpec, sw: number, fold: number): [number, number] {
  const rest = L.rest ?? [0, 0, 0], folds = L.fold ?? [45, 75];
  const a1 = (rest[0] + sw) * DEG, a2 = (rest[1] - fold * lerp(folds[0], folds[1], clamp(Math.abs(sw) / 40))) * DEG;
  return [L.at[1] + L.len[0] * Math.sin(a1) + L.len[1] * Math.sin(a1 + a2), L.at[2] - L.len[0] * Math.cos(a1) - L.len[1] * Math.cos(a1 + a2)];
}

/** A leg turned `deg` degrees about its hip, its knee bent as it was. */
function turned(spec: QuadSpec, p: QuadPose, i: number, deg: number): void {
  if (!deg) return;
  const L = i < 2 ? spec.fore : spec.hind, [sw0, fold0, off] = p.legs[i], w = 1 - smooth(off * 3);
  const [y, z] = ankleOf(L, sw0, fold0), vy = y - L.at[1], vz = z - L.at[2], c = Math.cos(deg * DEG), s = Math.sin(deg * DEG);
  const [sw, fold] = w > 0 ? legTo(L, L.at[1] + vy * c - vz * s, L.at[2] + vy * s + vz * c, i < 2) : [sw0 + deg, fold0];
  p.legs[i][0] = lerp(sw0 + deg, sw, w);
  p.legs[i][1] = lerp(fold0, fold, w);
}

/** Every hoof bearing weight brought `dz` nearer the body, its leg bent to reach it; a leg swinging tucked up by as much. */
function sunk(spec: QuadSpec, p: QuadPose, dz: number): void {
  if (!dz) return;
  for (let i = 0; i < 4; i++) {
    const L = i < 2 ? spec.fore : spec.hind, [sw0, fold0, off] = p.legs[i];
    const [y, z] = ankleOf(L, sw0, fold0);
    if (off > 0) {
      let lo = fold0, hi = fold0 + 1.5;
      for (let k = 0; k < 16; k++) {
        const mid = (lo + hi) / 2;
        if (ankleOf(L, sw0, mid)[1] < z + dz) lo = mid;
        else hi = mid;
      }
      p.legs[i][1] = hi;
      continue;
    }
    const [sw, fold] = legTo(L, y, z + dz, i < 2);
    p.legs[i][0] = sw;
    p.legs[i][1] = fold;
  }
}

/** The body tipped `deg` degrees nose-down (or up, negative) over one pair of hooves, the other pair kept on the grass where it is. */
function tipped(spec: QuadSpec, p: QuadPose, deg: number, keep: 'fore' | 'hind' = 'hind'): void {
  if (!deg) return;
  const P0 = p.pitch * DEG, P1 = (p.pitch - deg) * DEG;
  const kept = keep === 'fore' ? [0, 1] : [2, 3], moved = keep === 'fore' ? [2, 3] : [0, 1];
  const K = keep === 'fore' ? spec.fore : spec.hind, M = keep === 'fore' ? spec.hind : spec.fore;
  const worldZ = (y: number, z: number, P: number): number => y * Math.sin(P) + z * Math.cos(P);
  const foot = ankleOf(K, p.legs[kept[0]][0], p.legs[kept[0]][1]), hip = K.at;
  const ground0 = worldZ(foot[0], foot[1], P0);
  const ground1 = worldZ(hip[1], hip[2], P1) + worldZ(foot[0] - hip[1], foot[1] - hip[2], P0);
  const along0 = (y: number, z: number, P: number): number => y * Math.cos(P) - z * Math.sin(P);
  const shift = along0(hip[1], hip[2], P1) - along0(hip[1], hip[2], P0);
  p.pitch -= deg;
  for (const i of moved) {
    const [sw0, fold0, off] = p.legs[i], w = 1 - smooth(off * 1.5);
    if (w <= 0) continue;
    const [y, z] = ankleOf(M, sw0, fold0);
    const over = worldZ(y, z, P0) - ground0, along = along0(y, z, P0) + shift;
    const wz = ground1 + over;
    const ty = along * Math.cos(P1) + wz * Math.sin(P1), tz = -along * Math.sin(P1) + wz * Math.cos(P1);
    const [sw, fold] = legTo(M, ty, tz, i < 2);
    p.legs[i][0] = lerp(sw0, sw, w);
    p.legs[i][1] = lerp(fold0, fold, w);
  }
  for (const i of kept) turned(spec, p, i, deg);
}
const settled = (spec: QuadSpec, p: QuadPose, deg: number): void => tipped(spec, p, -deg, deg > 0 ? 'fore' : 'hind');

/** Every hoof that is down brought onto the ground the lowest of them stands on, so a body tipped by a move keeps all of them on it. */
function grounded(spec: QuadSpec, p: QuadPose): void {
  const P = p.pitch * DEG;
  const air = 1 - smooth(p.lift / 0.1);
  const at = [0, 1, 2, 3].map((i) => {
    const L = i < 2 ? spec.fore : spec.hind, [y, z] = ankleOf(L, p.legs[i][0], p.legs[i][1]);
    return { i, L, w: 1 - smooth(p.legs[i][2] * 2.5), wz: y * Math.sin(P) + z * Math.cos(P), along: y * Math.cos(P) - z * Math.sin(P) };
  });
  const ground = Math.min(...at.map((f) => f.wz + (1 - f.w)));
  for (const f of at) {
    const want = ground + (1 - f.w) * (f.wz - ground);
    const ty = f.along * Math.cos(P) + want * Math.sin(P), tz = -f.along * Math.sin(P) + want * Math.cos(P);
    const [y0, z0] = ankleOf(f.L, p.legs[f.i][0], p.legs[f.i][1]), now = Math.hypot(y0 - f.L.at[1], z0 - f.L.at[2]) / (f.L.len[0] + f.L.len[1]);
    const [sw, fold] = legTo(f.L, ty, tz, f.i < 2, Math.max(0.985, Math.min(0.999, now)));
    p.legs[f.i][0] = lerp(p.legs[f.i][0], sw, f.w * air);
    p.legs[f.i][1] = lerp(p.legs[f.i][1], fold, f.w * air);
  }
}

/* ---- its moves ---------------------------------------------------------------------------- */

/** How far through a strike each stage's blow lands. */
export const REACH_HITS = [0.5, 0.52, 0.55] as const;

/**
 * A go at its task, pruning: its neck stretched up to the dead twig (`up`),
 * a nip at it at each of `nips`, the twig snapped off (`snap`) and pulled
 * away (`pull`), its head turned aside and the twig let fall (`drop`) to the
 * grass (`land`), and its head back down to where it started (`back`).
 */
export const REACH_WORK = { up: [0, 0.24], nips: [0.27, 0.35], snap: 0.43, pull: [0.43, 0.56], drop: 0.6, land: 0.76, back: [0.62, 0.94] } as const;

/** How far up it is stretched to the twig, `t` through a go. */
const reachOf = (t: number): number => ramp(t, REACH_WORK.up[0], REACH_WORK.up[1]) * (1 - ramp(t, REACH_WORK.back[0], REACH_WORK.back[1]));
/** How far into a nip it is, `t` through a go, and the tug of the snap. */
function nipOf(t: number): number {
  let b = 0;
  for (const x of REACH_WORK.nips) b = Math.max(b, hump(t, x, 0.035));
  return Math.max(b, hump(t, REACH_WORK.snap, 0.03));
}
/** The pull: the twig drawn back and down in its mouth, and its head turned aside to let it go. */
const pullOf = (t: number): number => ramp(t, REACH_WORK.pull[0], REACH_WORK.pull[1]) * (1 - ramp(t, REACH_WORK.drop + 0.02, REACH_WORK.back[1]));

/** How far the whole body is carried forward this moment, in its own units, as it strikes. Its legs are swung back by as much. */
function surge(s: Reach, a: Anim): number {
  const act = a.act;
  if (act?.kind !== 'strike') return 0;
  const t = act.t, hit = REACH_HITS[s.strike];
  if (s.strike === 0) return s.len * (0.22 * ramp(t, 0.2, hit) * (1 - ramp(t, hit + 0.1, 1)) - 0.05 * ramp(t, 0.02, 0.2) * (1 - ramp(t, 0.2, 0.34)));
  return s.len * (0.1 * ramp(t, 0.36, hit) * (1 - ramp(t, hit + 0.12, 1)) - 0.05 * ramp(t, 0.03, 0.25) * (1 - ramp(t, 0.25, 0.47)));
}

/** How far up it is reared, `t` through its strike. */
const rearOf = (t: number): number => ramp(t, 0.03, 0.27) * (1 - ramp(t, 0.27, 0.5));
/** How far up each stage rears, in degrees, over its hind hooves. */
const REAR = [0, 16, 12];

/** How far the whole body is moved along as it rears, so its hind hooves stay put as it tips over them. */
function rocked(spec: QuadSpec, s: Reach, a: Anim): number {
  if (a.act?.kind !== 'strike' || s.strike === 0) return 0;
  const P = REAR[s.strike] * rearOf(a.act.t) * DEG, [, y, z] = spec.hind.at;
  return -(y * (Math.cos(P) - 1) - z * Math.sin(P));
}

/** A rebound after a blow that dies away, `t` through the strike. */
const settleOf = (t: number, hit: number): number => {
  const after = clamp((t - hit) / (1 - hit));
  return t > hit ? Math.sin(after * Math.PI * 2) * (1 - after) : 0;
};

/**
 * A stage's pose over the one a body on four legs has (`quadPose`): its own
 * gait, the four beats of a walk and the diagonals at a run; standing, an ear
 * flicked, the branch of its tail swaying, a chew and now and then a stretch
 * up to browse; and its moves -- the strike, pruning, and evolving.
 */
function reachPose(s: Reach, spec: QuadSpec, p: QuadPose, a: Anim): void {
  const g = smooth(a.go), G = s.gait;
  if (a.go > 0) {
    const duty = lerp(G.duty[0], G.duty[1], a.gait), amp = lerp(G.swing[0], G.swing[1], a.gait);
    const at = a.gait >= 0.5 ? DIAGONALS : FOUR_BEAT;
    const quad = a.gait < 0.5 ? FOUR_BEAT : [0, 0.5, 0.5, 0];
    for (let i = 0; i < 4; i++) {
      const was = step(a.u + quad[i], lerp(spec.duty?.[0] ?? 0.64, spec.duty?.[1] ?? 0.4, a.gait), lerp(spec.swing[0], spec.swing[1], a.gait));
      const now = lifting(i < 2 ? spec.fore : spec.hind, a.u + at[i], duty, amp * sweepOf(spec, i < 2), 1);
      for (let k = 0; k < 3; k++) p.legs[i][k] += g * (now[k] - was[k]);
    }
    const w = frac(a.u);
    const over = (duty + 0.5) / 2;
    p.lift = g * lerp(G.bounce[0], G.bounce[1], a.gait) * (0.5 + 0.5 * Math.cos((w - over) * TAU * 2));
    // The long neck swung forward and back with each stride, as a giraffe's is, and the head kept nearly level against it.
    p.neck[0] += g * (G.nod * 1.4 * Math.sin(w * TAU * 2 - 1.1) + 2 + 4 * a.gait);
    p.head[0] -= g * G.nod * 0.9 * Math.sin(w * TAU * 2 - 1.1);
    p.ears[0][0] += g * (1.5 * G.nod * Math.sin(w * TAU * 2 - 1.8) + 6);
    p.ears[1][0] += g * (1.5 * G.nod * Math.sin(w * TAU * 2 - 1.5) + 6);
    p.tail[0] += g * (4 + 8 * a.gait);
    p.tail[1] += g * 10 * Math.sin(w * TAU + 0.6);
    p.roll = lerp(p.roll, p.roll * a.gait + a.gait * 1.5 * Math.sin(w * TAU), g);
    // A swinging hoof curled back as it lifts and flat again before it comes down.
    for (let i = 0; i < 4; i++) {
      const L = i < 2 ? spec.fore : spec.hind, rest = L.rest ?? [0, 0, 0], folds = L.fold ?? [45, 75];
      const [sw, fold, off] = p.legs[i];
      if (!off) continue;
      const flat = -(p.pitch + rest[0] + sw + rest[1] - fold * lerp(folds[0], folds[1], clamp(Math.abs(sw) / 40)));
      const had = clamp(off * 3), want = clamp(off * 3) * smooth((1 - off) * 4);
      p.foot[i] += (had - want) * (0.6 * flat + 35 * fold);
    }
  } else if (!a.act) {
    // Standing: an ear flicked now and then, the branch of its tail stirring, a chew in bursts, and twice a loop a stretch up to
    // nip at something over its head.
    p.ears[0][0] += 22 * beat(a.t, [4.1, 15.3], 0.4);
    p.ears[1][0] += 22 * beat(a.t, [9.7, 20.2], 0.4);
    p.ears[1][1] += 12 * beat(a.t, [9.7, 20.2], 0.4);
    p.tail[1] += 10 * cyc(a.t, 3) + 6 * cyc(a.t, 7, 1);
    p.tail[0] += 4 * cyc(a.t, 2);
    const chew = beat(a.t, [0.6, 7.2, 19.0], 2.6);
    p.jaw = Math.max(p.jaw, chew * (0.5 + 0.5 * cyc(a.t, 36)));
    const up = beat(a.t, [11.5, 22.0], 2.4) * (1 - a.graze);
    p.neck[0] -= 12 * up;
    p.head[0] += 18 * up;
    p.jaw = Math.max(p.jaw, up * (0.5 + 0.5 * cyc(a.t, 48)));
  }
  const act = a.act;
  const d = surge(s, a);
  if (d) {
    const P = p.pitch * DEG;
    for (let i = 0; i < 4; i++) {
      const L = i < 2 ? spec.fore : spec.hind, [y, z] = ankleOf(L, p.legs[i][0], p.legs[i][1]);
      const vy = y - L.at[1], vz = z - L.at[2];
      const wy = vy * Math.cos(P) - vz * Math.sin(P), wz = vy * Math.sin(P) + vz * Math.cos(P), r = Math.hypot(wy, wz);
      const was = Math.atan2(wy, -wz), now = Math.asin(clamp(Math.sin(was) - d / r, -0.95, 0.95));
      turned(spec, p, i, (1 - smooth(p.legs[i][2] * 3)) * (now - was) / DEG);
    }
  }
  if (act?.kind === 'strike') strikePose(s, spec, p, act.t);
  else if (act?.kind === 'work') workPose(s, spec, p, act.t);
  else if (act?.kind === 'evolve') {
    // Evolving: drawn up tall as the light gathers, then at the turn a shake of the head, ears flapping, the tail tossed.
    const t = act.t, up = ramp(t, 0.1, 0.45) * (1 - ramp(t, 0.62, 0.85)), shake = hump(t, 0.56, 0.1);
    p.neck[0] -= 10 * up;
    p.head[0] += 14 * up;
    p.head[2] += 14 * shake * Math.sin(t * 70);
    p.ears[0][1] += 22 * shake * Math.sin(t * 70);
    p.ears[1][1] -= 22 * shake * Math.sin(t * 70);
    p.squash -= 0.04 * up;
    p.tail[1] += 20 * Math.sin(t * 30) * up;
    p.tail[0] += 12 * up;
  }
  if (act?.kind === 'strike' || act?.kind === 'evolve' || act?.kind === 'work') grounded(spec, p);
}

/**
 * A go at its task: the neck stretched up toward upright and the nose lifted
 * to the twig, the chest drawn up a little off the fore hooves; a nip at each
 * of `nips`, the jaw working; at the snap a tug back, then the twig pulled
 * down and away and the head turned aside to let it fall; and down again.
 */
function workPose(s: Reach, spec: QuadSpec, p: QuadPose, t: number): void {
  const up = reachOf(t), nip = nipOf(t) * up, pull = pullOf(t);
  const stretch = [26, 22, 18][s.stage], nose = [36, 38, 32][s.stage];
  tipped(spec, p, -(6 + s.stage) * up, 'hind');
  p.neck[0] -= stretch * up - 6 * pull;
  p.head[0] += nose * up - 4 * nip - 12 * pull + 6 * hump(t, REACH_WORK.snap + 0.02, 0.04);
  p.head[1] += 28 * pull * ramp(t, REACH_WORK.pull[0] + 0.04, REACH_WORK.drop);
  p.neck[1] += 10 * pull;
  p.jaw = Math.max(p.jaw, nip, 0.35 * ramp(t, REACH_WORK.snap, REACH_WORK.snap + 0.04) * (1 - ramp(t, REACH_WORK.drop - 0.02, REACH_WORK.drop + 0.03)));
  p.ears[0][0] += 18 * up;
  p.ears[1][0] += 18 * up;
  p.squash -= 0.04 * up;
  p.tail[0] += 10 * hump(t, REACH_WORK.snap + 0.03, 0.08);
  p.tail[1] += 14 * Math.sin(t * TAU * 2);
}

/**
 * Each stage's strike. The Saplingreach crouches, hops forward and butts with
 * its little twigs as it lands; the Canopyshaper and the Grovemaster rear up
 * on their hind legs and come down stamping, the neck swung down after,
 * driving the antlers forward; the Grovemaster slower and heavier.
 */
function strikePose(s: Reach, spec: QuadSpec, p: QuadPose, t: number): void {
  const hit = REACH_HITS[s.strike], st = settleOf(t, hit);
  const flick = hump(t, hit + 0.02, 0.1);
  p.tail[0] += 26 * flick;
  p.tail[1] += 18 * flick * Math.sin(t * 60);
  if (s.strike === 0) {
    const crouch = ramp(t, 0.02, 0.18) * (1 - ramp(t, 0.16, 0.32));
    const hop = t > 0.18 && t < hit ? Math.sin(Math.PI * (t - 0.18) / (hit - 0.18)) ** 1.5 : 0;
    const butt = ramp(t, 0.36, hit) * (1 - ramp(t, hit + 0.12, 0.9));
    p.lift += 0.22 * hop;
    sunk(spec, p, 0.06 * crouch);
    tipped(spec, p, -9 * crouch, 'fore');
    p.legs[0][0] += 8 * hop;
    p.legs[1][0] += 8 * hop;
    p.legs[2][0] -= 14 * hop;
    p.legs[3][0] -= 14 * hop;
    p.legs[2][1] += 0.25 * hop;
    p.legs[3][1] += 0.25 * hop;
    p.pitch += 5 * hop;
    settled(spec, p, 3 * st);
    tipped(spec, p, 6 * butt * (1 - hop), 'hind');
    p.neck[0] += 8 * crouch + 26 * butt - 6 * st;
    p.head[0] += -14 * crouch - 24 * butt + 6 * st;
    for (const e of p.ears) e[0] += 26 * crouch + 18 * hop - 10 * st;
    p.squash += 0.07 * hump(t, hit + 0.03, 0.07) - 0.05 * hop;
    return;
  }
  const rear = rearOf(t), heavy = s.strike === 2 ? 1 : 0;
  const drive = ramp(t, 0.36, hit) * (1 - ramp(t, hit + 0.14, 0.95));
  const down = ramp(t, 0.44, hit + 0.04) * (1 - ramp(t, hit + 0.14, 0.95));
  // Reared up over its hind hooves, its fore legs folded up under its chest and its neck drawn back; then down again, stamping,
  // the neck swung down after it and the antlers driven forward.
  sunk(spec, p, (0.14 + 0.05 * heavy) * rear);
  for (const i of [0, 1]) p.legs[i][2] = Math.max(p.legs[i][2], rear);
  tipped(spec, p, -REAR[s.strike] * rear, 'hind');
  for (const i of [0, 1]) {
    p.legs[i][0] += 30 * rear;
    p.legs[i][1] = Math.max(p.legs[i][1], 0.7 * rear);
  }
  settled(spec, p, 3 * st);
  tipped(spec, p, (5 + 3 * heavy) * down, 'hind');
  p.neck[0] += -18 * rear + (30 + 12 * heavy) * drive - 6 * st;
  p.head[0] += -10 * rear - (22 + 10 * heavy) * drive + 6 * st;
  for (const e of p.ears) e[0] += 24 * rear + 16 * drive;
  p.squash += (0.06 + 0.03 * heavy) * hump(t, hit + 0.03, 0.08);
  p.tail[0] -= 16 * rear;
  p.tail[1] += 10 * rear * Math.sin(t * 40);
}

const LEG_KEYS = ['fl', 'fr', 'hl', 'hr'];
/** How low the lowest sole of `feet` is, each counted as higher than it is by how far it is into being lifted. */
function lowOf(spec: QuadSpec, b: Bones, feet: readonly number[], p?: QuadPose, go = 0): number {
  let low = Infinity;
  for (const i of feet) {
    const L = i < 2 ? spec.fore : spec.hind, [ahead, behind] = L.toe ?? [0.3, 0.3];
    const s = p ? p.legs[i][2] : 0, off = p ? 0.8 * smooth(s * 4) * lerp(1, smooth((1 - s) * 4), smooth(go)) : 0;
    for (const y of [ahead, -behind]) low = Math.min(low, place(b[`${LEG_KEYS[i]}2`], [0, y, -L.len[2]])[2] + off);
  }
  return low;
}

/* ---- its bones --------------------------------------------------------------------------- */

/** A vine hanging off it: where it hangs from on the trunk, how long, which side, and its own number. */
interface Drop { at: V3; len: number; side: number; id: number }

/** The tree it prunes and the twig, in the world: where the trunk stands, how tall, how thick; the twig's root on it and its tip at the mouth. */
interface Pruned { foot: V3; tall: number; r: number; root: V3; tip: V3 }

/** The bones of a stage: a body on four hooves stood on the ones bearing its weight, its vines hanging, and the tree and the twig it prunes. */
function reachBones(s: Reach, drops: readonly Drop[]): { bones: (a: Anim) => Bones; tree: () => Pruned } {
  const spec = specOf(s);
  let last: QuadPose | undefined, tree: Pruned | undefined;
  const posed = quadBonesOf(spec, (p, a) => { reachPose(s, spec, p, a); last = p; });
  const stand = (b: Bones, a: Anim, p: QuadPose): Bones => {
    const all = [0, 1, 2, 3];
    const out = lifted(b, Math.max(-lowOf(spec, b, all, p, a.act ? 0 : a.go), -lowOf(spec, b, all)) + Math.max(0, p.lift));
    out.shadow = shadowOf(out.body, p.lift);
    return out;
  };
  // Where the tree is, found once for the stage from where its mouth is stretched up to: the twig sticks straight back out of the
  // trunk to just past its lips, and the trunk stands far enough on that its face is clear of it.
  const treeOf = (): Pruned => {
    if (tree) return tree;
    const a: Anim = { t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0, act: { kind: 'work', t: REACH_WORK.nips[0] - 0.04 } };
    const b0 = posed(a), b = stand(b0, a, last as QuadPose);
    const tip = place(b.head, mouthOf(s));
    const r = 0.1 + 0.05 * s.stage, gap = 0.55 + 0.28 * s.stage;
    const foot: V3 = [tip[0], tip[1] + gap + r, 0];
    tree = { foot, tall: tip[2] + 0.75 + 0.45 * s.stage, r, root: [tip[0], tip[1] + gap, tip[2]], tip: add(tip, [0, -0.06, 0]) };
    return tree;
  };
  const bones = (a: Anim): Bones => {
    const act = a.act;
    const graze = act ? 0 : a.graze;
    let b = posed({ ...a, graze });
    const p = last as QuadPose;
    if (!(graze > 0 && a.go < 1)) b = stand(b, a, p);
    const d = surge(s, a) + rocked(spec, s, a);
    if (d) for (const k of Object.keys(b)) b[k] = { m: b[k].m, t: [b[k].t[0], b[k].t[1] + d, b[k].t[2]] };
    drops.forEach((dr, q) => {
      const at = place(b.trunk, dr.at);
      const [pitch, roll] = swingOf(a, dr, q);
      b[`drop${q}`] = joint({ m: ROOT.m, t: at }, [0, 0, 0], pitch, roll, 0);
    });
    if (act?.kind === 'work') {
      const T = treeOf();
      b.tree = { m: ROOT.m, t: T.foot };
      b.twig = twigOf(s, b, act.t, T);
    }
    return b;
  };
  return { bones, tree: treeOf };
}

/** A frame made `k` times bigger, nought for a thing not there. */
const scaled = (x: Xf, k: number): Xf => { const q = Math.max(0.001, k), m = x.m; return { m: [m[0] * q, m[1] * q, m[2] * q, m[3] * q, m[4] * q, m[5] * q, m[6] * q, m[7] * q, m[8] * q], t: x.t }; };

/**
 * Where the dead twig is, `t` through a go, by where its tip is (its mesh is
 * built about its tip, `deadTwig`): sticking out of the trunk, bobbing at each
 * nip; from the snap held at its tip in the mouth; let go, falling to the
 * grass, turning over; lying there; and a new one grown out of the trunk for
 * the next go, from its root.
 */
function twigOf(s: Reach, b: Bones, t: number, T: Pruned): Xf {
  const W = REACH_WORK;
  if (t < W.snap) {
    const nip = nipOf(t);
    return joint({ m: ROOT.m, t: add(T.tip, [0, 0, -0.03 * nip]) }, [0, 0, 0], -6 * nip, 0, 0);
  }
  const mouth = place(b.head, mouthOf(s));
  if (t < W.drop) return joint({ m: ROOT.m, t: mouth }, [0, 0, 0], 10 * ramp(t, W.snap, W.pull[1]), 0, 0);
  const ground: V3 = [T.tip[0] + 0.35 + 0.15 * s.stage, T.tip[1] - 0.15, 0.04];
  if (t < W.land) {
    const u = (t - W.drop) / (W.land - W.drop), p = mixV(mouth, ground, u * u);
    return joint({ m: ROOT.m, t: p }, [0, 0, 0], 50 * u, 25 * Math.sin(u * 5), 70 * u);
  }
  const fade = 1 - ramp(t, 0.88, 0.94);
  if (fade > 0) return scaled(joint({ m: ROOT.m, t: ground }, [0, 0, 0], 0, 0, 70), fade);
  // Grown back out of the trunk: its root kept where it is as it grows.
  const k = ramp(t, 0.94, 1);
  return scaled({ m: ROOT.m, t: add(T.root, scale(sub(T.tip, T.root), k)) }, k);
}

/** How far a vine swings this moment, fore and aft and from side to side, in degrees. */
function swingOf(a: Anim, dr: Drop, q: number): [number, number] {
  const g = smooth(a.go), w = frac(a.u), ph = 0.35 * jitter(dr.id);
  let pitch = 4 * cyc(a.t, 2 + (q % 3), dr.id) * (1 - g);
  let roll = 3 * cyc(a.t, 3 + (q % 2), dr.id * 2) * (1 - g);
  pitch += g * (6 + 8 * a.gait) * Math.sin(w * TAU * 2 - 2.0 - ph) + g * (6 + 8 * a.gait);
  roll += g * 6 * Math.sin(w * TAU - 1.6 - ph);
  const act = a.act;
  if (act?.kind === 'strike') {
    const t = act.t, ring = t > 0.5 ? Math.sin((t - 0.5) * 26 + ph) * Math.exp(-(t - 0.5) * 5) : 0;
    pitch += -12 * ramp(t, 0.05, 0.3) * (1 - ramp(t, 0.3, 0.5)) + 24 * ring;
    roll += 8 * ring * dr.side;
  } else if (act?.kind === 'work') {
    const t = act.t;
    pitch += -8 * reachOf(t) + 6 * Math.sin(t * 30 + ph) * hump(t, REACH_WORK.snap + 0.04, 0.1);
    roll += 4 * Math.sin(t * TAU * 2 + ph);
  } else if (act?.kind === 'evolve') {
    const t = act.t, k = hump(t, 0.56, 0.12);
    roll += 20 * k * Math.sin(t * 70 + ph);
    pitch += 10 * k * Math.sin(t * 50 + ph);
  }
  return [pitch, roll];
}

/* ---- leaves, twigs and trees ------------------------------------------------------------- */

/** The greens it grows: light and shaded, and its moss; and the orange of its turning leaves. */
type Leafy = readonly [Mat, Mat, Mat];
const GREEN: Leafy = ['leaf', 'leafDark', 'leafDark'];
const GREEN2: Leafy = ['leafDark', 'leaf', 'leafDark'];
const MOSSY: Leafy = ['moss', 'leaf', 'leafDark'];
const ORANGE: Leafy = ['cap', 'bloom', 'bloom'];
/** A green leaf turning: one half orange. */
const TINT: Leafy = ['moss', 'cap', 'leafDark'];
const greens = (id: number): Leafy => (id % 3 === 0 ? MOSSY : id % 3 === 1 ? GREEN : GREEN2);

/**
 * A leaf from `root` along `dir`, its upper side toward `face`, `len` long and
 * `w` across: two halves folded a little up along the midrib, light and
 * shaded, and its underside; a full oval, as a young beech leaf is. Four faces.
 */
function leafOf(root: V3, dir: V3, face: V3, len: number, w: number, mats: Leafy = GREEN, curl = 0.12, cup = 0.25): Mesh {
  const d = unit(dir), f = unit(sub(face, scale(d, dot(face, d)))), side = unit(cross(d, f));
  const K = 7;
  const rib: V3[] = [], L: V3[] = [], R: V3[] = [];
  for (let k = 0; k <= K; k++) {
    const u = k / K, bow = Math.sin(Math.PI * u) * len * curl;
    const p = add(add(root, scale(d, len * u)), scale(f, bow - len * curl * 0.6 * u * u));
    rib.push(p);
    if (k === 0 || k === K) continue;
    // Full and round-ended, narrowing to its stalk: an oval leaf, as the sheet draws them.
    const ww = w * Math.sin(Math.PI * u ** 0.8) ** 0.55;
    L.push(add(add(p, scale(side, -ww)), scale(f, -ww * cup)));
    R.push(add(add(p, scale(side, ww)), scale(f, -ww * cup)));
  }
  const v: V3[] = [...rib, ...L, ...R];
  const ribI = rib.map((_, q) => q), LI = L.map((_, q) => rib.length + q), RI = R.map((_, q) => rib.length + L.length + q);
  const halfL = [...ribI, ...[...LI].reverse()], halfR = [...ribI, ...[...RI].reverse()];
  const f4: Face[] = [{ i: halfL, m: mats[0] }, { i: [...halfR], m: mats[1] }, { i: [...halfL], m: mats[2] }, { i: [...halfR], m: mats[2] }];
  return mesh(v, wound(v, f4, [f, f, scale(f, -1), scale(f, -1)]));
}

/** A spray of leaves at the end of a twig at `at`, fanned about `dir`, `n` of them. */
function sprayOf(at: V3, dir: V3, len: number, n: number, seed: number, orange = 0): Mesh {
  const d = unit(dir), [u, w] = across(d), out: Mesh[] = [];
  for (let q = 0; q < n; q++) {
    const a = (q / n) * TAU + jitter(seed + q) * 0.8, spread = 0.75;
    const o = unit(add(d, add(scale(u, Math.cos(a) * spread), scale(w, Math.sin(a) * spread))));
    const mats = q < orange ? ORANGE : greens(seed + q);
    out.push(leafOf(at, o, add(scale(d, 0.4), [0, 0, 1]), len * (0.8 + 0.35 * jitter(seed + q + 7)), len * 0.46, mats));
  }
  return merge(...out);
}

/** A twig of bark from `pts`, thinning from `r0` to `r1`: a branch, an antler, a tail. */
const twig = (pts: readonly V3[], r0: number, r1: number, n: number, mat: Mat = 'bark'): Mesh =>
  tube(pts, pts.map((_, k) => lerp(r0, r1, k / Math.max(1, pts.length - 1))), pts.map((_, k) => lerp(r0, r1, k / Math.max(1, pts.length - 1))), n, mat, { seam: 'start' });

/**
 * A flat canopy, as a bonsai's is clipped, and as the conifers' boughs are
 * (`../trees3d`): a broad lens of leaves, much wider than it is deep, in the
 * canopies' own greens (`feather`), lit on top and a deep shade under it
 * (`featherDark`); tufts over its top and round its rim, lit where they face
 * up; and dark lumps along the under side of its rim, so its underside is
 * ragged. `R` across, `T` deep.
 */
function padOf(c: V3, R: number, T: number, seed: number, fine: boolean): Mesh {
  const lit = (z: number, top: Mat): ((p: V3) => Mat) => (p) => (p[2] > c[2] + z ? top : 'featherDark');
  const out: Mesh[] = [painted(orbAlong(c, [0, 0, 1], [R, R * 0.84, T * 0.5], fine ? 16 : 10, 5, 'featherDark'), lit(T * 0.12, 'feather'))];
  const N = fine ? 10 : 7;
  for (let q = 0; q < N; q++) {
    const a = (q / N) * TAU + jitter(seed + q) * 0.4, rr = R * (0.72 + 0.1 * jitter(seed + q + 1)), k = R * 0.3 * (0.85 + 0.3 * jitter(seed + q + 3));
    out.push(painted(orb(add(c, [Math.cos(a) * rr, Math.sin(a) * rr * 0.84, T * (0.02 + 0.1 * jitter(seed + q + 5))]), [k, k, T * 0.36], fine ? 7 : 5, 3, 'feather'), lit(T * 0.16, q % 3 ? 'feather' : 'leaf')));
  }
  for (let q = 0; q < (fine ? 6 : 4); q++) {
    const a = (q / 6) * TAU + 0.5 + jitter(seed + q + 9) * 0.6, rr = R * 0.38 * jitter(seed + q + 11), k = R * 0.26;
    out.push(painted(orb(add(c, [Math.cos(a) * rr, Math.sin(a) * rr * 0.84, T * 0.3]), [k, k, T * 0.3], fine ? 6 : 5, 3, 'feather'), lit(T * 0.4, q % 2 ? 'feather' : 'leaf')));
  }
  for (let q = 0; q < (fine ? 7 : 5); q++) {
    const a = (q / 7) * TAU + 0.2 + jitter(seed + q + 21) * 0.5, rr = R * (0.55 + 0.2 * jitter(seed + q + 23)), k = R * (0.2 + 0.08 * jitter(seed + q + 25));
    out.push(orb(add(c, [Math.cos(a) * rr, Math.sin(a) * rr * 0.84, -T * 0.3]), [k, k, T * 0.28], fine ? 6 : 5, 3, 'featherDark'));
  }
  return merge(...out);
}

/**
 * A bonsai grown out of it, as the sheet draws them: a thick bark limb out of
 * `root` that rises only a little along `dir` before it sweeps out near level
 * the way of `ways[0]`, twisting to one side and back as it goes, and runs on
 * past its last canopy to a bare tip. Off it, `pads` branches, each to a
 * canopy (`padOf`) of its own, in tiers at heights of their own and out to
 * either side, apart enough that the bark carrying each shows between them.
 */
function bonsaiOf(root: V3, dir: V3, len: number, r: number, pads: number, pad: number, seed: number, fine: boolean, n: number, ways?: readonly V3[]): Mesh {
  const up = unit(dir), sweep = unit(ways?.[0] ? [ways[0][0], ways[0][1], 0.0001] : [up[0], up[1], 0.0001]);
  const side = unit(cross([0, 0, 1], sweep)), out: Mesh[] = [], twist = jitter(seed) > 0.5 ? 1 : -1;
  const a1 = add(root, add(scale(up, len * 0.14), add(scale(sweep, -len * 0.02), scale(side, twist * len * 0.08))));
  const a2 = add(root, add(scale(up, len * 0.24), add(scale(sweep, len * 0.3), scale(side, -twist * len * 0.16))));
  const a3 = add(root, add(scale(up, len * 0.36), add(scale(sweep, len * 0.62), scale(side, twist * len * 0.14))));
  const tip = add(root, add(scale(up, len * 0.5), add(scale(sweep, len * 0.92), scale(side, -twist * len * 0.04))));
  const limb = [...curve(root, a1, a2, fine ? 5 : 3), ...curve(a2, add(a2, scale(sub(a2, a1), 0.5)), a3, fine ? 5 : 3).slice(1), ...curve(a3, mixV(a3, tip, 0.5), tip, 2).slice(1)];
  out.push(twig(limb, r, r * 0.3, n + 1, 'bark'));
  // Each tier: a branch off the limb, up and out to one side, a canopy on it; low and high by turns, so they stand apart.
  for (let q = 0; q < pads; q++) {
    const u = pads > 1 ? q / (pads - 1) : 1, at = limb[Math.round(lerp(limb.length * 0.22, limb.length * 0.82, u))];
    const sd = q % 2 ? 1 : -1, high = q % 2 === (jitter(seed) > 0.5 ? 1 : 0);
    const off = len * (0.22 + 0.08 * jitter(seed + q + 3)), rise = len * (high ? 0.26 : 0.06) * (0.9 + 0.2 * jitter(seed + q + 5));
    const end = add(at, add(scale(side, sd * off), [0, 0, rise]));
    out.push(twig(curve(at, add(mixV(at, end, 0.5), [0, 0, -rise * 0.15]), end, 3), r * 0.62, r * 0.4, Math.max(4, n - 1), 'bark'));
    const R = pad * (0.85 + 0.25 * jitter(seed + q + 7));
    out.push(padOf(add(end, [0, 0, R * 0.12]), R, R * 0.3, seed + q * 13, fine));
  }
  return merge(...out);
}

/* ---- the head ------------------------------------------------------------------------------- */

/**
 * The eyes, open or shut: almond-shaped and glossy, dark amber with a darker
 * middle, a big glint and a small one, under a lash line, a calm lid coming
 * down over the bigger stages'. All of an eye goes out of sight together when
 * the skull is between it and the viewer (`at`).
 */
function eyesOf(s: Reach, shut: boolean): Mesh {
  const E = s.eye, out: Disc[] = [];
  for (const side of [1, -1]) {
    const q0 = onSkull(s, E.dir), q = side > 0 ? q0 : left(q0);
    const n = unit(add(q.n, [0, 0.1, 0.04])), p = add(q.p, scale(n, 0.005));
    const at = onSkull(s, add(scale(q.n, 1), [side * 0.75, -0.25, 0])).p;
    const up = unit(cross(cross(n, [0, 0, 1]), n)), side3 = unit(cross(up, n));
    const o = { at, up: [0, 0, 1] as V3 };
    const r = E.size * s.head.skull.r[0] / 0.3;
    if (shut) {
      out.push(line(Array.from({ length: 5 }, (_, k) => {
        const f = k / 4 - 0.5, pt = add(add(p, scale(side3, f * r * 2.1)), scale(up, -r * 0.1 + r * 0.35 * (1 - 4 * f * f)));
        return { p: pt, n };
      }), r * 0.2, 'lid'));
      continue;
    }
    out.push(disc(add(p, scale(up, r * 0.06)), n, r * 1.3, r * 0.98, 12, 'lid', o));
    out.push(disc(add(p, scale(n, 0.004)), n, r * 1.14, r * 0.86, 12, 'water', o));
    out.push(disc(add(add(p, scale(n, 0.008)), scale(up, -r * 0.04)), n, r * 0.7, r * 0.66, 10, 'eye', o));
    out.push(disc(add(add(add(p, scale(n, 0.012)), scale(up, r * 0.34)), scale(side3, -side * r * 0.28)), n, r * 0.34, r * 0.34, 7, 'glint', { ...o, lit: true }));
    out.push(disc(add(add(add(p, scale(n, 0.012)), scale(up, -r * 0.42)), scale(side3, side * r * 0.32)), n, r * 0.14, r * 0.14, 5, 'glint', { ...o, lit: true }));
    const lid: V3[] = [];
    const cutAt = r * (1.2 - 2.3 * E.lid);
    for (let k = 0; k <= 8; k++) {
      const th = Math.PI * (k / 8);
      lid.push(add(add(add(p, scale(n, 0.016)), scale(side3, Math.cos(th) * r * 1.18)), scale(up, Math.sin(th) * r * 1.26)));
    }
    for (let k = 8; k >= 0; k--) {
      const th = Math.PI * (k / 8);
      lid.push(add(add(add(p, scale(n, 0.016)), scale(side3, Math.cos(th) * r * 1.18)), scale(up, cutAt - Math.sin(th) * r * 0.12)));
    }
    if (E.lid > 0) out.push({ ...facing(lid, n, 'coat'), at });
    out.push(disc(add(add(p, scale(n, 0.02)), scale(up, cutAt - r * 0.06)), n, r * 1.16, r * 0.15, 8, 'lid', o));
  }
  // Every corner laid onto the skull's curve, each layer a hair over the last.
  const S = s.head.skull;
  return paint(out.map((d, q) => ({ ...d, v: d.v.map((v) => { const e = onEgg(S.c, S.r, sub(v, S.c)); return add(e.p, scale(e.n, 0.008 + 0.002 * (q % 6))); }) })));
}

/** The skull: cream, the sage wash over its crown and the back of its head, a dapple or two on the brow; and its eyes. */
function headOf(s: Reach, n: number, k: number, shut: boolean): Mesh {
  const S = s.head.skull;
  const skull = painted(orb(S.c, S.r, n + 5, k + 3, 'coat'), (c) => {
    const d = unit([(c[0] - S.c[0]) / S.r[0], (c[1] - S.c[1]) / S.r[1], (c[2] - S.c[2]) / S.r[2]]);
    if (d[2] > 0.4 && d[1] < 0.5) return 'coatDark';
    if (d[1] < -0.55) return 'coatDark';
    return d[2] < -0.35 ? 'belly' : 'coat';
  });
  const spots: Disc[] = [];
  for (const sd of [1, -1]) {
    for (let q = 0; q < 2; q++) {
      const e = onSkull(s, [sd * (0.62 + 0.15 * q), -0.5 + 0.4 * q, 0.42 - 0.12 * q]);
      spots.push(blotch(add(e.p, scale(e.n, 0.006)), e.n, S.r[0] * (0.16 - 0.03 * q), 50 + q + (sd > 0 ? 0 : 7), q ? 'spot' : 'mark'));
    }
  }
  return merge(skull, paint(spots), eyesOf(s, shut));
}

/** The muzzle: a long egg out of the front of the skull, cream, its end orange-peach, a smile under it. */
function muzzleMesh(s: Reach, n: number, k: number): Mesh {
  const M = s.head.muzzle;
  const [, , z] = muzzleFrame(s);
  const muzzle = painted(orbAlong(M.c, M.dir, M.r, n + 2, k + 1, 'coat'), (c) => {
    const along = dot(sub(c, M.c), z) / M.r[2];
    return along > 0.3 ? 'nose' : 'coat';
  });
  const mouth = onMuzzle(s, [0, -0.5, 0.85]);
  const nostrils = [1, -1].map((sd) => {
    const q = onMuzzle(s, [sd * 0.45, 0.25, 0.86]);
    return disc(add(q.p, scale(q.n, 0.008)), q.n, M.r[0] * 0.12, M.r[0] * 0.08, 6, 'lid');
  });
  return merge(muzzle, paint(nostrils), smile(add(mouth.p, scale(mouth.n, -0.01)), mouth.n, M.r[0] * 0.7, 'lid'));
}

/** The chin, on the jaw's bone, so a chew or a nip shows: a small egg under the end of the muzzle. */
function chinOf(s: Reach, n: number, k: number): Mesh {
  const c = onMuzzle(s, [0, -0.7, 0.35]).p;
  return orbAlong(add(c, [0, -0.01, 0.03]), [0, 1, -0.4], [s.head.muzzle.r[0] * 0.62, s.head.muzzle.r[1] * 0.42, s.head.muzzle.r[2] * 0.5], n, k, 'muzzle');
}

/**
 * An ear: big and leaf-shaped, narrow at its root and drawn to a point, cream
 * outside and pink inside, built upright facing forward and cupped deep so its
 * lining shows.
 */
function earOf(s: Reach, n: number): Mesh {
  const { len, w } = s.ear;
  const spine = curve([0, 0, 0], [0.02, 0.05, len * 0.5], [0.05, -0.02, len], 4);
  // Narrow at its root, broadest a third of the way up, drawn to a point: a leaf.
  const ws = [w * 0.34, w * 0.9, w * 0.86, w * 0.5, 0.004];
  const cup = (p: V3): V3 => [p[0], p[1] + 0.75 * w * (p[0] / w) ** 2, p[2]];
  const shell = tube(spine, ws, ws.map((x) => Math.max(0.015, x * 0.18)), n, 'coatLight', { up: [0, 1, 0], seam: 'start' });
  const edge = (sd: number): V3[] => [1, 2, 3].map((q) => cup([spine[q][0] + sd * ws[q] * 0.68, ws[q] * 0.18 + 0.016, spine[q][2]]));
  return merge(mesh(shell.v.map(cup), shell.f), paint([{ v: [cup([0, 0.03, len * 0.06]), ...edge(-1), cup([spine[4][0], 0.03, len * 0.94]), ...edge(1).reverse()], m: 'inner' }]));
}

/** The leaves round the root of each ear, on the head: a few standing up behind it and fanned out round its back. */
function earLeaves(s: Reach, fine: boolean): Mesh {
  const out: Mesh[] = [], N = s.ear.leaves, L = s.ear.len * 0.62;
  for (const sd of [1, -1]) {
    const r0 = earRoot(s), root: V3 = [sd * r0[0], r0[1] - 0.02, r0[2] - 0.02];
    for (let q = 0; q < N; q++) {
      const a = lerp(-0.6, 0.9, N > 1 ? q / (N - 1) : 0.5);
      const dir: V3 = [sd * (0.75 + 0.2 * Math.cos(a)), -0.55 - 0.35 * Math.sin(a), 0.45 + 0.6 * Math.sin(a)];
      const mats = s.stage && q === N - 1 ? ORANGE : greens(q + (sd > 0 ? 0 : 1));
      out.push(leafOf(root, dir, [sd * 0.3, 0.2, 1], L * (0.8 + 0.3 * jitter(q + 4 + (sd > 0 ? 0 : 9))), L * 0.44, mats));
    }
  }
  void fine;
  return merge(...out);
}

/**
 * The tuft of leaves on its crown, between its antlers: a few standing up and
 * back off the top of its head, the front of the crest down its neck.
 */
function crownLeaves(s: Reach): Mesh {
  const out: Mesh[] = [], L = s.crest.len * 0.9;
  for (let q = 0; q < 5; q++) {
    const f = (q - 2) / 2, e = onSkull(s, [f * 0.4, -0.35 - 0.15 * Math.abs(f), 0.92]);
    const mats = q === 4 && s.stage ? ORANGE : greens(q + 2);
    out.push(leafOf(e.p, [f * 0.5, -0.65, 0.8], [f * 0.4, 0.3, 1], L * (1 - 0.18 * Math.abs(f)), L * 0.36, mats));
  }
  return merge(...out);
}

/* ---- the antlers ----------------------------------------------------------------------------- */

/**
 * The right antler, in the head's frame; the left is its mirror. The
 * Saplingreach's a slender twig up out of its crown, leaning back and out,
 * with a spray of new leaves at its tip and a side shoot with two more; the
 * Canopyshaper's a forked twig, a tine forward and the beam on back and up, a
 * spray of leaves on each point and a few along it; the Grovemaster's a whole
 * bonsai tree with a flat canopy (`bonsaiOf`), the right one leaning forward
 * and the left one back.
 */
function antlerOf(s: Reach, fine: boolean, n: number, side = 1): Mesh {
  const A = s.antler, root = antlerRoot(s), out = A.out * DEG;
  const up: V3 = [Math.sin(out), -0.22, Math.cos(out)];
  // The Grovemaster's: on the right a tree leaning forward over its face, on the left one leaning back over its neck (the left is
  // built as a right one and mirrored), each a bark branch curving out from the head with a broad flat canopy on it, leaning in a
  // little across the head so the two stand apart three quarters round as well as side on.
  if (A.kind === 2) {
    const fwd = side > 0;
    return bonsaiOf(sub(root, [0, 0, 0.04]), [Math.sin(out) * 0.3, fwd ? 0.35 : -0.45, 1], A.len * (fwd ? 1 : 0.94), A.r, 4, A.leaf * (fwd ? 1 : 0.94), fwd ? 11 : 17, fine, n, [[-0.12, fwd ? 1 : -1, 0]]);
  }
  const tip = add(root, add(scale(up, A.len), [0.04, -A.len * 0.12, 0]));
  const mid = add(root, add(scale(up, A.len * 0.55), [0.06, A.len * 0.06, 0]));
  const pts = curve(sub(root, [0, 0, 0.04]), mid, tip, fine ? 5 : 3);
  const parts: Mesh[] = [twig(pts, A.r, A.r * 0.5, Math.max(4, n - 2))];
  if (A.kind === 0) {
    parts.push(sprayOf(tip, add(up, [0.1, -0.1, 0.3]), A.leaf, 4, 3));
    const from = pts[Math.round(pts.length * 0.55)], shoot = add(from, [A.len * 0.25, A.len * 0.18, A.len * 0.16]);
    parts.push(twig([from, shoot], A.r * 0.6, A.r * 0.35, 4), sprayOf(shoot, [0.6, 0.6, 0.6], A.leaf * 0.85, 2, 9));
    return merge(...parts);
  }
  // The fork: a tine forward and up from a third of the way, and the beam's own tip forked again.
  const f1 = pts[Math.round(pts.length * 0.4)], tine = add(f1, [A.len * 0.18, A.len * 0.32, A.len * 0.3]);
  const f2 = pts[Math.round(pts.length * 0.75)], tine2 = add(f2, [A.len * 0.26, -A.len * 0.2, A.len * 0.12]);
  parts.push(
    twig(curve(f1, add(f1, [A.len * 0.06, A.len * 0.2, A.len * 0.12]), tine, 3), A.r * 0.7, A.r * 0.35, 4),
    twig([f2, tine2], A.r * 0.55, A.r * 0.3, 4),
    sprayOf(tip, add(up, [0.15, -0.2, 0.3]), A.leaf, 5, 21, s.stage),
    sprayOf(tine, [0.3, 0.7, 0.6], A.leaf * 0.9, 4, 33),
    sprayOf(tine2, [0.6, -0.3, 0.5], A.leaf * 0.85, 3, 45),
  );
  return merge(...parts);
}

/* ---- the crest, the dapples and what grows on it ------------------------------------------ */

/** The neck's width at `z` along it, from its root's to the head's. */
const neckW = (s: Reach, z: number): number => lerp(s.neck.w[0], s.neck.w[1], clamp(z / s.neck.len) ** 0.8);

/**
 * The neck, in its own frame: a tube thick at the shoulders narrowing to the
 * head, cream, dappled green and peach up its back and sides, the throat left
 * cream.
 */
function neckMesh(s: Reach, n: number): Mesh {
  const L = s.neck.len, K = 6, pts: V3[] = [], ws: number[] = [], hs: number[] = [];
  for (let k = 0; k <= K; k++) {
    const z = lerp(-0.3, L, k / K);
    pts.push([0, 0.04 * (z / L) ** 2, z]);
    ws.push(neckW(s, Math.max(0, z)) * 0.92);
    hs.push(neckW(s, Math.max(0, z)) * 1.04);
  }
  // The wash of green down the back of the neck, the throat cream.
  const neck = tube(pts, ws, hs, n + 2, (ring, j) => (Math.sin(((j + 0.5) / (n + 2)) * TAU) < 0.3 - 0.3 * jitter(ring * 7 + j) ? 'coatDark' : 'coat'), { seam: 'both' });
  const spots: Disc[] = [];
  for (let q = 0; q < s.dapples.neck; q++) {
    const z = L * (0.04 + 0.86 * ((q + 0.5) / s.dapples.neck)) + 0.05 * (jitter(q + 100) - 0.5);
    // Round the back and the sides: nought the right side, half a turn the left, the back of the neck between (y negative).
    const th = lerp(-0.45, Math.PI + 0.45, jitter(q * 3 + 101)), w = neckW(s, z);
    const nrm: V3 = [Math.cos(th), -Math.sin(th) * 1.04, 0];
    const c: V3 = [Math.cos(th) * w * 0.92, -Math.sin(th) * w * 1.04 + 0.04 * (z / L) ** 2, z];
    const r = s.dapples.r * (0.7 + 0.5 * jitter(q + 102)) * (0.75 + 0.35 * w / s.neck.w[0]);
    spots.push(blotch(add(c, scale(unit(nrm), 0.008)), unit(nrm), r, q + 300, jitter(q + 103) > 0.38 ? 'mark' : 'spot', 0.85));
  }
  return merge(neck, paint(spots));
}

/** A crest leaf's colours: green mostly, on the bigger stages some turning orange and a few all orange. */
const crestMats = (s: Reach, q: number): Leafy => {
  const k = (q * 7 + 3) % 10;
  if (!s.stage) return k < s.crest.orange ? TINT : greens(q);
  return k < s.crest.orange - 2 ? ORANGE : k < s.crest.orange ? TINT : greens(q);
};

/**
 * The crest of leaves down the back of its neck, in the neck's frame: tufts
 * of round leaves standing up off the ridge of the nape and swept back, three
 * or so leaves fanned in each, every tuft its own size and lean, longer
 * toward the shoulders; some splayed a little to either side.
 */
function crestOf(s: Reach): Mesh {
  const C = s.crest, L = s.neck.len, out: Mesh[] = [], tufts = Math.round(C.n / 3);
  for (let t = 0; t < tufts; t++) {
    const u = (t + 0.5) / tufts, z = lerp(L * 1.0, -0.08, u) + 0.04 * (jitter(t + 61) - 0.5), w = neckW(s, Math.max(0, z));
    const sd = t % 2 ? 1 : -1, th = sd * 0.3 * jitter(t + 64);
    const root: V3 = [Math.sin(th) * w * 0.85, -Math.cos(th) * w * 0.85, z];
    const size = C.len * (0.85 + 0.6 * jitter(t + 62)) * (0.85 + 0.45 * u);
    for (let q = 0; q < 3; q++) {
      const id = t * 3 + q, fan = (q - 1) * 0.45 + 0.2 * (jitter(id + 65) - 0.5);
      // Up off the ridge and swept back: square to the neck (back, -y) and along it toward the head (+z), fanned across.
      const dir: V3 = [Math.sin(fan) * 0.9 + sd * 0.15, -0.8, 0.55 + 0.25 * Math.cos(fan)];
      const len = size * (q === 1 ? 1 : 0.78);
      out.push(leafOf(root, dir, [1, 0, 0.1], len, len * 0.38, crestMats(s, id), 0.18, 0.3));
    }
  }
  return merge(...out);
}

/** The crest carried on along the top of its back from the withers, in the trunk's frame: round leaves along the spine and splayed off it. */
function spineCrest(s: Reach): Mesh | null {
  const C = s.crest;
  if (C.back <= 0.3) return null;
  const out: Mesh[] = [], N = Math.round(C.n * C.back * 0.8);
  for (let q = 0; q < N; q++) {
    const u = 1 - ((q + 0.5) / N) * C.back, ridge = q % 3 === 0, sd = q % 2 ? 1 : -1;
    const j = jitter(q + 80), j2 = jitter(q + 82), k = 0.7 + 0.6 * jitter(q + 81);
    const e = onBody(s, alongBody(s, u), Math.PI / 2 - sd * (ridge ? 0.15 : 0.45 + 0.25 * j));
    const len = C.len * k * (1.1 - 0.35 * (1 - u));
    // Standing up off the spine and swept back, a few splayed out to its sides.
    const dir: V3 = ridge ? [sd * 0.3 * j, -0.75, 0.7 + 0.3 * (j2 - 0.5)] : [sd * (0.55 + 0.3 * j), -0.65 - 0.2 * j2, 0.6 + 0.3 * (j2 - 0.5)];
    out.push(leafOf(add(e.p, scale(e.n, -0.02)), dir, ridge ? [sd, 0, 0.6] : [sd * 0.35, 0, 1], len, len * 0.44, crestMats(s, q + 5), 0.16, 0.3));
  }
  return merge(...out);
}

/**
 * The barrel: rings smoothed along it, cream, a little lighter under the
 * belly, dappled green and peach over its back and down its sides, thinning
 * out toward the belly; on the Grovemaster patches of moss over its back.
 */
function bodyMesh(s: Reach, lod: number): Mesh {
  const B = s.body, cap = [[-0.06, 0.72], [-0.1, 0.32]] as const;
  const ys = [...cap.map(([dy]) => B.y[0] + dy).reverse(), ...B.y], zs = [B.z[0], B.z[0], ...B.z];
  const ws = [...cap.map(([, k2]) => B.w[0] * k2).reverse(), ...B.w], hs = [...cap.map(([, k2]) => B.h[0] * k2).reverse(), ...B.h];
  const cr = (v: readonly number[], q: number, f: number): number => {
    const a = v[Math.max(0, q - 1)], b = v[q], c = v[q + 1], d = v[Math.min(v.length - 1, q + 2)];
    return b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)));
  };
  const Y: number[] = [], Z: number[] = [], Wd: number[] = [], H: number[] = [];
  for (let q = 0; q < ys.length - 1; q++) {
    for (let k2 = 0; k2 < 3; k2++) {
      const f = k2 / 3, y = cr(ys, q, f), mid = clamp((y - B.y[1]) / (B.y[5] - B.y[1])), swell = 1 + 0.06 * Math.sin(Math.PI * mid);
      Y.push(y); Z.push(cr(zs, q, f)); Wd.push(cr(ws, q, f) * swell); H.push(cr(hs, q, f) * swell);
    }
  }
  Y.push(ys[ys.length - 1]); Z.push(zs[zs.length - 1]); Wd.push(ws[ws.length - 1]); H.push(hs[hs.length - 1]);
  const N = cut(lod, 10, 14);
  // A wash of the dapples' green over its back and the top of its flanks, ragged at its edge; cream below, paler under the belly.
  const barrel = tube(Y.map((y, q) => [0, y, Z[q]] as V3), Wd, H, N, (ring, j) => {
    const up = Math.sin(((j + 1) / N) * TAU);
    return up < -0.6 ? 'belly' : up > -0.38 + 0.26 * jitter(ring * 5 + j) ? 'coatDark' : 'coat';
  });
  const spots: Disc[] = [];
  const D = s.dapples;
  for (const sd of [1, -1]) {
    for (let q = 0; q < D.n; q++) {
      const id = q * 2 + (sd > 0 ? 0 : 1);
      // Spread along the body evenly, each at its own height round it: most over the back and the upper flank, fewer lower down.
      const u = (q + 0.5) / D.n + 0.04 * (jitter(id + 1) - 0.5);
      const th = lerp(-0.85, 1.5, jitter(id + 2) ** 0.8);
      const e = onBody(s, alongBody(s, lerp(-0.04, 1.04, u)), th);
      const r = D.r * (0.75 + 0.45 * jitter(id + 3)) * (th < 0 ? 0.8 : 1);
      const m: Mat = jitter(id + 4) > 0.4 ? 'mark' : 'spot';
      const d = blotch(add(e.p, scale(e.n, 0.01)), e.n, r, id + 500, m, 1.1);
      spots.push(sd > 0 ? d : { ...d, v: d.v.map((p) => [-p[0], p[1], p[2]] as V3).reverse() });
    }
  }
  for (let q = 0; q < s.moss; q++) {
    const u = 0.1 + 0.8 * ((q + 0.5) / s.moss), th = Math.PI / 2 + (jitter(q + 600) - 0.5) * 1.6;
    const e = onBody(s, alongBody(s, u), th);
    spots.push(blotch(add(e.p, scale(e.n, 0.016)), e.n, D.r * (1.6 + 0.8 * jitter(q + 601)), q + 700, 'moss', 1.3));
  }
  return merge(barrel, paint(spots));
}

/**
 * An upper leg's half-width across and fore and aft at `f` down it (nought its
 * top, one the knee or the hock): a forearm or a gaskin, thick and muscled at
 * the top and narrowing to the joint, a gaskin deeper fore and aft.
 */
function upperW(s: Reach, fore: boolean, f: number): [number, number] {
  const k = fore ? [1.25, 1.08, 0.6] : [1.3, 1.12, 0.58], x = clamp(f);
  const a = x < 0.5 ? lerp(k[0], k[1], x / 0.5) : lerp(k[1], k[2], (x - 0.5) / 0.5);
  return [s.thick * a, s.thick * a * (fore ? 1.12 : 1.4)];
}

/**
 * A leg's two parts, each down its own bone: the upper, up into the body and
 * muscled, narrowing to the knee or the hock (`upperW`); and the lower, a knob
 * of a knee at its top -- on a hind leg the hock, standing out behind -- a
 * narrow cannon, the fetlock swelling over the hoof and the pastern under it.
 */
function legMeshes(s: Reach, fore: boolean, n: number): { upper: Mesh; lower: Mesh } {
  const L = fore ? foreLen(s) : hindLen(s), w = s.thick;
  const fs = [-0.14, 0, 0.3, 0.62, 0.88, 1];
  const upper = tube(fs.map((f): V3 => [0, (fore ? 0.12 : -0.22) * w * Math.sin(Math.PI * clamp(f)), -L * f]),
    fs.map((f) => upperW(s, fore, f)[0]), fs.map((f) => upperW(s, fore, f)[1]), n + 2, 'coat', { seam: 'both' });
  const ls = [-0.08, 0, 0.1, 0.5, 0.8, 0.9, 1];
  const xs = [0.66, 0.72, 0.58, 0.48, 0.5, 0.58, 0.5], ys = fore ? [0.72, 0.8, 0.62, 0.52, 0.55, 0.62, 0.54] : [0.9, 1.0, 0.68, 0.54, 0.56, 0.62, 0.54];
  const back = fore ? [0.04, 0.05, 0.02, 0, 0, 0.02, 0.04] : [-0.22, -0.26, -0.1, 0, 0, 0.02, 0.04];
  const lower = tube(ls.map((f, q): V3 => [0, back[q] * w, -L * f]), xs.map((x) => x * w), ys.map((y) => y * w), n + 2, 'coat', { seam: 'start' });
  return { upper, lower };
}

/** Dapples down the outside of an upper leg, in its bone's frame, fewer and smaller toward the knee; moss on the Grovemaster's. */
function legDapples(s: Reach, fore: boolean, seed: number): Mesh {
  const L = fore ? foreLen(s) : hindLen(s), out: Disc[] = [];
  const N = 8 + 4 * s.stage;
  for (let q = 0; q < N; q++) {
    const f = 0.05 + 0.7 * ((q + 0.5) / N), [wx, wy] = upperW(s, fore, f);
    const th = (fore ? -0.8 : -1.4) + 2.8 * jitter(seed * 5 + q), nrm = unit([Math.cos(th) / wx, Math.sin(th) / wy, 0]);
    const c: V3 = [Math.cos(th) * wx * 1.01, Math.sin(th) * wy * 1.01 + (fore ? 0.12 : -0.22) * s.thick * Math.sin(Math.PI * f), -L * f];
    const r = s.dapples.r * (1 - 0.45 * f) * (0.8 + 0.4 * jitter(seed + q * 3));
    const mat: Mat = s.stage === 2 && q % 4 === 1 ? 'moss' : jitter(seed + q * 7) > 0.45 ? 'mark' : 'spot';
    out.push(blotch(c, nrm, mat === 'moss' ? r * 1.8 : r, seed * 3 + q, mat, 0.9));
  }
  return paint(out);
}

/** A few small dapples down the outside of a lower leg, in its bone's frame, between the knee or hock and the fetlock. */
function cannonDapples(s: Reach, fore: boolean, seed: number): Mesh {
  const L = fore ? foreLen(s) : hindLen(s), w = s.thick * 0.5, out: Disc[] = [];
  for (let q = 0; q < 3 + s.stage; q++) {
    const f = 0.2 + 0.45 * ((q + 0.5) / (3 + s.stage)), th = (fore ? -0.6 : -1.2) + 2.4 * jitter(seed * 7 + q + 1), nrm: V3 = [Math.cos(th), Math.sin(th), 0];
    out.push(blotch([Math.cos(th) * w * 1.02, Math.sin(th) * w * 1.04, -L * f], nrm, s.dapples.r * 0.55, seed * 5 + q, jitter(seed + q * 3) > 0.45 ? 'mark' : 'spot', 0.9));
  }
  return paint(out);
}

/** The leaf tufts round a lower leg, in its bone's frame: a ring of leaves pointing down and out over the hoof; a second at the knee on the Grovemaster. */
function cuffOf(s: Reach, lower: number, seed: number): Mesh {
  const out: Mesh[] = [], C = s.cuffs, R = s.thick * 0.4;
  const rings: Array<[number, number]> = [[lower * 0.7, 1]];
  if (C.knee) rings.push([lower * 0.06, s.stage === 2 ? 0.8 : 0.6]);
  // A thin lumpy ring of moss round each, under the leaves.
  {
    for (const [z0] of rings) {
      const pts = Array.from({ length: 11 }, (_, q): V3 => { const a = (q / 10) * TAU; return [Math.cos(a) * R * 1.05, Math.sin(a) * R * 1.05, -z0 + 0.02 * Math.sin(a * 3 + seed)]; });
      out.push(tube(pts, R * 0.28, R * 0.22, 5, (ring, j) => ((ring + j) % 3 ? 'moss' : 'leafDark'), { start: false, end: false }));
    }
  }
  // A ragged cuff of narrow leaves wrapping the leg all the way round, overlapping, each hanging down close against it at its own
  // length and a little tilt of its own; the hoof clear under it.
  rings.forEach(([z0, k], ring) => {
    const N = C.n + 4;
    for (let q = 0; q < N; q++) {
      const id = seed + q + ring * 41, th = (q / N) * TAU + 0.35 * jitter(id);
      const o: V3 = [Math.cos(th), Math.sin(th), 0], tilt = 0.4 * (jitter(id + 6) - 0.5);
      const root: V3 = [o[0] * R * 0.95, o[1] * R * 0.95, -z0 + C.len * 0.35 * jitter(id + 5)];
      const len = C.len * k * (0.6 + 0.6 * jitter(id + 3));
      out.push(leafOf(root, [o[0] * 0.3 - o[1] * tilt, o[1] * 0.3 + o[0] * tilt, -1], [o[0], o[1], 0], len, len * 0.3, greens(id), 0.08, 0.15));
    }
  });
  return merge(...out);
}

/** Where a draped vine starts along the body: over the shoulders, the first nearest the neck. */
const drapeY = (s: Reach, q: number): number => alongBody(s, lerp(0.95, 0.62, s.vines.n > 1 ? q / (s.vines.n - 1) : 0) + 0.04 * (jitter(q + 900) - 0.5));
/** Where along the body a draped vine is `f` of the way down it: running diagonally back across the shoulder and the flank. */
const drapeAt = (s: Reach, y0: number, f: number, q: number): number => y0 - s.len * 0.32 * f + 0.05 * Math.sin(f * 4 + q);

/**
 * The vines draped over one flank, in the trunk's frame: from the top of its
 * back over the shoulder, diagonally down and back across its side to under
 * its belly line, each one a braid of green with small leaves along it, laid
 * on the coat.
 */
function drapedOf(s: Reach, side: number): Mesh {
  const out: Mesh[] = [], V = s.vines;
  for (let q = 0; q < V.n; q++) {
    const y0 = drapeY(s, q), K = 10, pts: V3[] = [];
    for (let k = 0; k <= K; k++) {
      const f = k / K, th = lerp(1.45, -0.5, f), e = onBody(s, drapeAt(s, y0, f, q), th);
      pts.push(add(e.p, scale(e.n, 0.035)));
    }
    out.push(tube(pts, 0.03 + 0.012 * s.stage, 0.03 + 0.012 * s.stage, 4, (ring, j) => ((ring + j) % 3 === 0 ? 'leafDark' : s.stage === 2 ? 'moss' : 'stem')));
    for (let k = 2; k < K; k += 2) {
      const e = onBody(s, drapeAt(s, y0, k / K, q), lerp(1.45, -0.5, k / K));
      out.push(leafOf(add(e.p, scale(e.n, 0.04)), add(scale(e.n, 0.6), [0, (k % 4 ? 0.5 : -0.5), -0.6]), e.n, 0.16 + 0.04 * s.stage, 0.06 + 0.015 * s.stage, greens(q + k)));
    }
  }
  const m = merge(...out);
  return side > 0 ? m : mirrorX(m);
}

/** A vine hanging from its bone at the top: a thin stem swaying down, leaves along it by turns and a spray at its end. */
function hangingVine(len: number, stage: number, seed: number): Mesh {
  const K = 6, pts: V3[] = [];
  for (let k = 0; k <= K; k++) pts.push([0.03 * Math.sin(k * 1.7 + seed), 0.03 * Math.cos(k * 1.3 + seed), -len * (k / K)]);
  const out: Mesh[] = [tube(pts, 0.024 + 0.006 * stage, 0.024 + 0.006 * stage, 4, (ring) => (ring % 2 ? 'stem' : 'leafDark'))];
  for (let k = 1; k < K; k++) {
    const sd = k % 2 ? 1 : -1;
    out.push(leafOf(pts[k], [sd * 0.8, 0.3, -0.5], [sd * 0.4, 1, 0.2], 0.15 + 0.04 * stage, 0.06 + 0.015 * stage, greens(seed + k)));
  }
  out.push(sprayOf(pts[K], [0, 0.2, -1], 0.16 + 0.04 * stage, 3, seed + 5));
  return merge(...out);
}

/** A drooping cluster of big leaves at `at`, hanging down and fanned out round it, `n` of them, `orange` of them turning. */
function clusterOf(at: V3, len: number, n: number, seed: number, orange = 0, down = 1): Mesh {
  const out: Mesh[] = [];
  for (let q = 0; q < n; q++) {
    const a = (q / n) * TAU + jitter(seed + q) * 0.6, spread = 0.55 + 0.45 * jitter(seed + q + 1);
    const dir: V3 = [Math.cos(a) * spread, Math.sin(a) * spread * 0.8 - 0.2, -down * (0.55 + 0.45 * jitter(seed + q + 2))];
    const root = add(at, [Math.cos(a) * len * 0.3 * jitter(seed + q + 7), Math.sin(a) * len * 0.3 * jitter(seed + q + 7), -len * 0.25 * jitter(seed + q + 8)]);
    const l = len * (0.8 + 0.4 * jitter(seed + q + 3));
    out.push(leafOf(root, dir, [Math.cos(a), Math.sin(a), 0.6], l, l * 0.5, q < orange ? TINT : greens(seed + q), 0.18, 0.3));
  }
  return merge(...out);
}

/**
 * Its tail, a woody branch, link by link, each built pointing back along -y:
 * bark thinning to the tip, a leaf or two along it, a side twig off each
 * middle link (one each side on the later stages) bent down with a drooping
 * cluster of leaves on its end, and a big drooping cluster at the tip; on the Grovemaster two flat canopies on
 * twigs up off its last link, leaves hanging under them.
 */
function tailOf(s: Reach, fine: boolean, n: number): Mesh[] {
  const T = s.tail, out: Mesh[] = [], full = s.stage > 0;
  for (let l = 0; l < T.links; l++) {
    const r0 = T.r * (1 - 0.55 * (l / T.links)), r1 = T.r * (1 - 0.55 * ((l + 1) / T.links));
    const parts: Mesh[] = [twig([[0, 0.03, 0], [0.01 * Math.sin(l * 2), -T.len * 0.5, 0.01], [0, -T.len - 0.02, 0]], r0, r1, Math.max(4, n - 2))];
    const last = l === T.links - 1;
    for (let q = 0; q < T.leaves; q++) {
      const id = l * 19 + q, sd = (q + l) % 2 ? 1 : -1, y = -T.len * ((q + 0.5) / T.leaves);
      parts.push(leafOf([sd * r0 * 0.6, y, 0], [sd * 0.8, -0.35, -T.droop * 0.6], [sd * 0.3, 0, 1], T.leaf * (0.7 + 0.3 * jitter(id)), T.leaf * 0.35, greens(id)));
    }
    // Side twigs out and down, each with a big cluster hanging off its end: one a link on the Saplingreach, one each side on the
    // later stages, which is what makes theirs a full drooping fan.
    for (const sd of l === 0 ? [] : full ? [1, -1] : [l % 2 ? 1 : -1]) {
      const at = -T.len * (sd > 0 ? 0.3 : 0.6), to: V3 = [sd * T.len * 0.55, at - T.len * 0.42, -T.len * 0.2 * T.droop];
      parts.push(twig(curve([0, at, 0], [sd * T.len * 0.28, at - T.len * 0.2, T.len * 0.06], to, 3), r0 * 0.6, r0 * 0.3, 4),
        clusterOf(to, T.leaf * (full ? 0.85 : 0.72), fine ? (full ? 16 : 13) : (full ? 12 : 10), l * 7 + (sd > 0 ? 1 : 4), 0, T.droop));
    }
    if (last) {
      parts.push(clusterOf([0, -T.len - 0.02, 0], T.leaf * (full ? 0.9 : 0.72), fine ? 20 : 14, 61, 0, T.droop));
      for (let q = 0; q < T.clumps; q++) {
        const sd = q % 2 ? -1 : 1, from: V3 = [0, -T.len * (0.2 + 0.45 * q), 0], at: V3 = [sd * T.len * 0.45, -T.len * (0.45 + 0.5 * q), T.len * 0.5];
        const R = s.antler.leaf * (0.85 - 0.1 * q);
        parts.push(twig(curve(from, [sd * T.len * 0.2, -T.len * (0.35 + 0.45 * q), T.len * 0.3], at, 3), r1 * 0.8, r1 * 0.5, 4), padOf(add(at, [0, 0, R * 0.12]), R, R * 0.32, 70 + q * 13, fine), clusterOf(add(at, [0, 0, -R * 0.08]), T.leaf * 0.7, fine ? 14 : 10, 80 + q * 9, 0, 1.4));
      }
    }
    out.push(merge(...parts));
  }
  return out;
}

/* ---- the tree it prunes ----------------------------------------------------------------- */

/**
 * The tree it prunes, drawn only at its task, its foot at its bone: a young
 * trunk of grey-brown bark flaring into roots at the grass, a living limb or
 * two with leaves, a round head of leaves over the twig, and the pale scar of
 * the last twig pruned.
 */
function treeMesh(s: Reach, T: Pruned, fine: boolean, n: number): Mesh {
  const out: Mesh[] = [], H = T.tall, r = T.r;
  out.push(tube([[0, 0, -0.02], [0, 0, H * 0.08], [0.02, 0, H * 0.5], [-0.02, 0, H]], [r * 1.35, r * 1.05, r, r * 0.7], [r * 1.35, r * 1.05, r, r * 0.7], n + 2, (_ring, j) => (j % 3 === 0 ? 'hornDark' : 'bark'), { end: false }));
  for (let q = 0; q < 4; q++) {
    const a = (q / 4) * TAU + 0.6, d: V3 = [Math.cos(a), Math.sin(a), 0];
    out.push(twig([add(scale(d, r * 0.6), [0, 0, H * 0.06]), add(scale(d, r * 1.4), [0, 0, 0.02]), add(scale(d, r * 2.0), [0, 0, 0])], r * 0.36, r * 0.1, 4));
  }
  // The scar of the last twig taken, a little under where this one comes out, on the side toward it.
  const twigZ = T.root[2];
  out.push(paint([disc([0, -r * 0.98, twigZ - 0.28], [0, -1, 0], r * 0.32, r * 0.36, 7, 'muzzle'), disc([0, -r * 1.0, twigZ - 0.28], [0, -1, 0], r * 0.16, r * 0.18, 6, 'hornDark')]));
  // Living limbs out to the sides, and the head of leaves.
  for (const [sd, z, k] of [[1, 0.84, 0.8], [-1, 0.76, 0.85]] as const) {
    const from: V3 = [0, 0, H * z], to: V3 = [sd * H * 0.22 * k, H * 0.08, H * (z + 0.12)];
    out.push(twig([from, add(from, [sd * H * 0.12 * k, 0, H * 0.04]), to], r * 0.5, r * 0.28, 5));
    out.push(padOf(to, H * 0.13 * k, H * 0.1 * k, 90 + sd * 7, fine));
  }
  out.push(padOf([0, 0.02, H * 0.98], H * 0.2, H * 0.12, 77, fine), padOf([0.02, 0, H * 1.1], H * 0.13, H * 0.09, 79, fine));
  void s;
  return merge(...out);
}

/**
 * The dead twig, built about its tip, where the mouth takes it: a grey,
 * leafless stick running from the tip forward to its root in the trunk, a
 * fork or two on it, and a dry curled leaf hanging on.
 */
function deadTwig(s: Reach, T: Pruned, n: number): Mesh {
  const L = Math.max(0.2, T.root[1] - T.tip[1] + T.r * 0.5), r = 0.03 + 0.012 * s.stage;
  const out: Mesh[] = [tube([[0, -0.06, 0], [0.01, L * 0.5, 0.02], [0, L, 0]], [r * 0.6, r * 0.85, r], [r * 0.6, r * 0.85, r], Math.max(4, n - 3), (ring) => (ring % 2 ? 'horn' : 'hornDark'))];
  out.push(
    tube([[0, L * 0.45, 0.01], [0.08, L * 0.28, 0.14], [0.1, L * 0.18, 0.2]], [r * 0.6, r * 0.45, r * 0.3], [r * 0.6, r * 0.45, r * 0.3], 4, 'horn'),
    tube([[0, L * 0.7, 0.01], [-0.1, L * 0.62, -0.08]], [r * 0.55, r * 0.3], [r * 0.55, r * 0.3], 4, 'hornDark'),
  );
  out.push(leafOf([0.1, L * 0.18, 0.2], [0.3, 0.2, -1], [1, 0, 0.2], 0.14 + 0.03 * s.stage, 0.05 + 0.01 * s.stage, ['bloom', 'hornDark', 'hornDark'], 0.3, 0.4));
  return merge(...out);
}

/* ---- its pieces -------------------------------------------------------------------------------- */

/** Where its vines hang, each from its own bone (`reachBones`): off the lower end of each draped vine on its flanks. */
function dropsOf(s: Reach): Drop[] {
  const out: Drop[] = [], V = s.vines;
  for (const sd of [1, -1]) {
    for (let q = 0; q < V.n; q++) {
      // Only the first draped vine on each side hangs on below the flank; more were a curtain over the legs.
      if (q) continue;
      const e = onBody(s, drapeAt(s, drapeY(s, q), 1, q), -0.5);
      const p = add(e.p, scale(e.n, 0.03));
      out.push({ at: [sd * p[0], p[1], p[2]], len: V.len * (0.7 + 0.5 * jitter(q + 950 + (sd > 0 ? 0 : 3))), side: sd, id: out.length + 1 });
    }
  }
  return out;
}

/** How its leaves are drawn: thin, as the goat line's are. */
const LEAVES = { thin: true };

/** A stage's pieces: a body on four hooves with its own head, and its antlers, ears, crest, dapples, vines, trees and its tail. */
function reachBuild(s: Reach, drops: readonly Drop[], T: () => Pruned, lod: number): Piece[] {
  const fine = lod > 0;
  const n = cut(lod, 7, 10), k = cut(lod, 5, 6);
  const skull = skullOf(s);
  const extras: Piece[] = [
    { key: 'muzzle', mesh: muzzleMesh(s, n, k), bone: 'head', bias: 0.205, after: ['head'], front: [0, 1, 0], lines: false },
    { key: 'chin', mesh: chinOf(s, n - 1, k - 1), bone: 'jaw', bias: 0.2, after: ['head'], under: ['muzzle'], lines: false },
    { key: 'crown', mesh: crownLeaves(s), bone: 'head', bias: 0.215, after: ['head', 'neck', 'crest'], hide: [skull], ...LEAVES },
    { key: 'earLeaves', mesh: earLeaves(s, fine), bone: 'head', bias: 0.212, after: ['head', 'crest'], hide: [skull], ...LEAVES },
    { key: 'crest', mesh: crestOf(s), bone: 'neck', bias: 0.03, after: ['neck', 'body'], under: ['head'], hide: [{ c: [0, 0, s.neck.len * 0.5], r: [s.neck.w[1] * 0.9, s.neck.w[1] * 0.9, s.neck.len * 0.55] }], ...LEAVES },
  ];
  const spine = spineCrest(s);
  if (spine) extras.push({ key: 'spine', mesh: spine, bone: 'trunk', bias: 0.05, after: ['body'], hide: bodySolids(s, 0.96), ...LEAVES });
  if (s.vines.n) {
    for (const [side, key] of [[1, 'drapeR'], [-1, 'drapeL']] as const) {
      extras.push({ key, mesh: drapedOf(s, side), bone: 'trunk', bias: 0.04, after: ['body'], front: [side, 0, 0], hide: bodySolids(s, 0.98), ...LEAVES });
    }
  }
  extras.push(...drops.map((dr, q): Piece => ({
    key: `drop${q}`, mesh: hangingVine(dr.len, s.stage, dr.id * 3), bone: `drop${q}`, bias: 0.045,
    after: ['body', dr.side > 0 ? 'drapeR' : 'drapeL'], front: [dr.side, 0, 0.3], ...LEAVES,
  })));
  s.trees.forEach((G, q) => {
    const e = onBody(s, alongBody(s, G.u), G.th), root: V3 = [G.side * e.p[0], e.p[1], e.p[2] - 0.05];
    const dir: V3 = [G.dir[0], G.dir[1], G.dir[2]];
    extras.push({ key: `tree${q}`, mesh: bonsaiOf(root, dir, G.len, G.r, G.pads, G.pad, 31 + q * 17, fine, n, G.ways), bone: 'trunk', bias: 0.08, after: ['body', 'spine', 'drapeR', 'drapeL'], front: [G.side, 0, 1], ...LEAVES });
  });
  // Each antler after the head and over the ears; the far one under the head.
  const antler = antlerOf(s, fine, n);
  extras.push(
    { key: 'antler1', mesh: antler, bone: 'head', bias: 0.22, after: ['head', 'crown', 'earLeaves'], front: [1, 0, 0], hide: [skull], ...LEAVES },
    { key: 'antler0', mesh: mirrorX(antlerOf(s, fine, n, -1)), bone: 'head', bias: 0.22, after: ['head', 'crown', 'earLeaves'], front: [-1, 0, 0], hide: [skull], ...LEAVES },
  );
  // The tree and the twig, only while it is at its task.
  const working = (a: Anim): boolean => a.act?.kind === 'work' && a.go < 0.5;
  extras.push(
    { key: 'tree', mesh: treeMesh(s, T(), fine, n), bone: 'tree', bias: 0.02, shown: working },
    { key: 'twig', mesh: deadTwig(s, T(), n), bone: 'twig', bias: 0.25, shown: working, thin: true },
  );
  const legs = (fore: boolean): { upper: [number, number, number, number]; lower: [number, number, number, number]; foot: Mesh; mat: Mat } => {
    const L = fore ? foreLen(s) : hindLen(s), w = s.thick;
    return { upper: [fore ? 0.2 : 0.18, -L, w * (fore ? 1.15 : 1.3), w * 0.86], lower: [0, -L, w * 0.74, w * 0.56], foot: cloven(w * 0.66, s.hoof, n), mat: 'coat' };
  };
  const pieces = quadPieces({
    n, k,
    body: { ...s.body, belly: false },
    neck: { w: s.neck.w[0], h: s.neck.w[0], len: s.neck.len, mat: 'coat' },
    head: { c: skull.c, r: skull.r, eye: { dir: [0.6, 0.6, 0.4], size: 0.01 } },
    ear: earOf(s, n),
    earTurn: -12,
    tail: tailOf(s, fine, n),
    fore: legs(true),
    hind: legs(false),
    breath: 0.03,
    extras,
  });
  // The leaf tufts round each lower leg, over the hoof.
  for (const [key, side, fore] of [['fl', -1, true], ['fr', 1, true], ['hl', -1, false], ['hr', 1, false]] as Array<[string, number, boolean]>) {
    const lower = fore ? foreLen(s) : hindLen(s);
    pieces.push({ key: `${key}cuff`, mesh: cuffOf(s, lower, key.charCodeAt(0) * 7 + key.charCodeAt(1)), bone: `${key}1`, bias: 0.04, after: [`${key}1`, `${key}2`, 'body'], front: [side * 0.7, fore ? 0.7 : -0.7, 0], ...LEAVES });
  }
  return pieces.map((pc) => {
    if (pc.key === 'head') return { ...pc, mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), hide: [skull, muzzleOf(s)] };
    if (pc.key === 'neck') return { ...pc, mesh: neckMesh(s, n) };
    if (pc.key === 'body') return { ...pc, mesh: bodyMesh(s, lod) };
    if (pc.key.startsWith('tail')) return { ...pc, ...LEAVES };
    if (pc.key === 'ear0' || pc.key === 'ear1') return { ...pc, bias: 0.214, after: ['head', 'earLeaves'] };
    if (/^[fh][lr]0$/.test(pc.key)) return { ...pc, mesh: merge(legMeshes(s, pc.key[0] === 'f', n).upper, legDapples(s, pc.key[0] === 'f', pc.key.charCodeAt(1))) };
    if (/^[fh][lr]1$/.test(pc.key)) return { ...pc, mesh: merge(legMeshes(s, pc.key[0] === 'f', n).lower, cannonDapples(s, pc.key[0] === 'f', pc.key.charCodeAt(1))) };
    return pc;
  });
}

/** A cloven hoof: two dark toes side by side with a cleft between them. */
function cloven(r: number, h: number, n: number): Mesh {
  return merge(...[-1, 1].map((sd) => tube([[sd * r * 0.42, r * 0.1, 0.04], [sd * r * 0.46, r * 0.2, -h * 0.5], [sd * r * 0.48, r * 0.3, -h]],
    [r * 0.42, r * 0.48, r * 0.5], [r * 0.6, r * 0.74, r * 0.82], n, 'hoof', { seam: 'start' })));
}

/* ---- what it throws about --------------------------------------------------------------- */

const LEAF: RGB = [136, 182, 90];
const LEAF_LIGHT: RGB = [178, 208, 112];
const AMBER: RGB = [236, 150, 84];
const PEACH: RGB = [246, 196, 150];
const BARK: RGB = [140, 112, 86];
const WHITE: RGB = [255, 250, 240];
const INK: RGB = [70, 64, 52];
const BITS: readonly RGB[] = [LEAF, LEAF_LIGHT, AMBER, LEAF, PEACH];
const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;

/** Whether a point is on the viewer's side of a body whose middle is at `c`: drawn over the body if so, under it if not. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How big a stage's things in the air are drawn, in the units of the screen they are drawn on. */
const bigness = (s: Reach): number => 2 * Math.max(0.9, (s.len / 1.8) ** 0.8);

/** A leaf in the air at (x, y), `r` long, turning: pointed, with a soft dark edge; a chip of bark, when brown. */
function leafAt(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: RGB, al: number, spin: number): void {
  if (al <= 0.01 || r <= 0.05) return;
  g.save();
  g.translate(x, y);
  g.rotate(spin);
  g.beginPath();
  if (c === BARK) g.rect(-r * 0.6, -r * 0.2, r * 1.2, r * 0.4);
  else {
    const k = 0.45 + 0.25 * Math.abs(Math.cos(spin * 1.7));
    g.moveTo(-r, 0);
    g.quadraticCurveTo(0, -r * k, r, 0);
    g.quadraticCurveTo(0, r * k, -r, 0);
  }
  g.fillStyle = css(c, al);
  g.fill();
  g.lineWidth = Math.max(0.15, r * 0.16);
  g.strokeStyle = css(mix(c, INK, 0.45), al);
  g.stroke();
  g.restore();
}

/** A four-pointed sparkle at (x, y), `r` from its middle to its points. */
function sparkle(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: RGB, al: number, spin = 0): void {
  if (al <= 0.01 || r <= 0) return;
  g.save();
  g.translate(x, y);
  g.rotate(spin);
  g.beginPath();
  for (let q = 0; q < 8; q++) {
    const t = (q / 8) * TAU, k = q % 2 ? r * 0.22 : r;
    if (q) g.lineTo(Math.cos(t) * k, Math.sin(t) * k);
    else g.moveTo(Math.cos(t) * k, Math.sin(t) * k);
  }
  g.closePath();
  g.fillStyle = css(c, al);
  g.fill();
  g.restore();
}

/** Where something let go of at `p` with velocity `v` is `s` seconds on, slowing in the air and falling: a leaf. */
const flutter = (p: V3, v: V3, s: number, drag = 2.4, fall = 1.2): V3 => {
  const k = (1 - Math.exp(-drag * s)) / drag;
  return [p[0] + v[0] * k, p[1] + v[1] * k, p[2] + v[2] * k - fall * s * s];
};

/** Where it strikes with, in the head's frame: the brow between its antlers, a little ahead. */
const browOf = (s: Reach): V3 => add(onSkull(s, [0, 0.7, 0.7]).p, [0, 0.1, 0]);

/** The blow: a burst of leaves off it, and a sparkle; on the bigger stages more of them, further. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Reach, b: Bones, at: Bones, t: number, front: boolean): void {
  const hit = REACH_HITS[s.strike], since = (t - hit) * ACT_SECS.strike;
  if (since <= 0) return;
  const big = bigness(s) * (1 + 0.12 * s.strike), far = big / 2, fade = 1 - ramp(t, hit + 0.18, 1);
  const impact = place(at.head, browOf(s)), mid = b.body.t;
  const count = 9 + 4 * s.strike;
  for (let q = 0; q < count; q++) {
    const th = (q / count) * TAU + jitter(q) * 0.6;
    const v: V3 = [Math.cos(th) * (4.4 + 2 * jitter(q + 3)) * far, (1.6 + 2.4 * jitter(q + 5)) * far, (5 + 4 * Math.max(0, Math.sin(th)) + 2.4 * jitter(q + 7)) * far];
    const p = flutter(impact, v, since, 3.2, 2.5 * far);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    leafAt(g, x, y, (0.2 + 0.08 * jitter(q + 9)) * big, BITS[q % BITS.length], fade, q + since * (6 + 4 * jitter(q)));
  }
  const flash = 1 - ramp(since, 0, 0.1);
  if (flash > 0 && nearSide(impact, mid, view) === front) {
    const [x, y] = onScreen(view, impact);
    sparkle(g, x, y, (0.3 + 0.2 * ramp(since, 0, 0.06)) * big, WHITE, flash, 0.3);
  }
}

/** Its task: chips of bark and a leaf or two off the trunk at the snap, and a little puff of leaves where the twig lands. */
function workBits(g: CanvasRenderingContext2D, view: View, s: Reach, b: Bones, T: Pruned, t: number, front: boolean): void {
  const big = bigness(s), far = big / 2, mid = b.body.t, W = REACH_WORK;
  const sinceSnap = (t - W.snap) * ACT_SECS.work;
  if (sinceSnap > 0 && sinceSnap < 0.4) {
    for (let q = 0; q < 4; q++) {
      const th = q * 1.7 + 0.4;
      const p = flutter(add(T.root, [0, -0.05, 0]), [Math.cos(th) * 1.2 * far, -0.8 * far, (1.4 + jitter(q)) * far], sinceSnap, 3, 2.4 * far);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      leafAt(g, x, y, (q % 2 ? 0.1 : 0.14) * big, q % 2 ? BARK : q === 2 ? AMBER : LEAF, 1 - sinceSnap / 0.4, q * 2 + sinceSnap * 14);
    }
    const flash = 1 - ramp(sinceSnap, 0, 0.08);
    if (flash > 0 && front) {
      const [x, y] = onScreen(view, T.root);
      sparkle(g, x, y, 0.22 * big, WHITE, flash * 0.9, 0.4);
    }
  }
  const sinceLand = (t - W.land) * ACT_SECS.work;
  if (sinceLand > 0 && sinceLand < 0.35 && b.twig) {
    for (let q = 0; q < 4; q++) {
      const th = (q / 4) * TAU + 0.5;
      const p = flutter(b.twig.t, [Math.cos(th) * 1.1 * far, Math.sin(th) * 1.1 * far, 1.3 * far], sinceLand, 3.5, 1.6 * far);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      leafAt(g, x, y, 0.1 * big, q % 2 ? BARK : LEAF_LIGHT, 1 - sinceLand / 0.35, q + sinceLand * 10);
    }
  }
}

/** Evolving: leaves drawn in round it in a rising spiral, a burst of them at the turn, and a sparkle over its crown. */
function evolveFx(g: CanvasRenderingContext2D, view: View, s: Reach, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid: V3 = [0, 0, b.body.t[2]];
  const rise = ramp(t, 0.05, 0.25) * (1 - ramp(t, 0.7, 1));
  const tall = s.legs + s.neck.len * 0.8 + 1;
  if (rise > 0) {
    for (let q = 0; q < 14; q++) {
      const u = frac(t * 1.2 + q / 14), ang = (q / 14) * TAU * 2 + t * TAU * 1.5;
      const r = s.len * 0.8 * (1 - 0.4 * u);
      const p: V3 = [Math.cos(ang) * r * 0.8, Math.sin(ang) * r, u * tall];
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      leafAt(g, x, y, 0.2 * big, BITS[q % BITS.length], rise * Math.sin(u * Math.PI), ang * 2);
    }
  }
  const burst = (t - 0.5) * ACT_SECS.evolve;
  if (burst > 0 && burst < 0.6) {
    for (let q = 0; q < 12; q++) {
      const th = (q / 12) * TAU;
      const p = flutter([0, 0, tall * 0.55], [Math.cos(th) * 3 * big / 2, Math.sin(th) * 3 * big / 2, 2 * big / 2], burst, 2.5, big);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      leafAt(g, x, y, 0.22 * big, BITS[q % BITS.length], 1 - burst / 0.6, th + burst * 8);
    }
  }
  const flash = hump(t, 0.5, 0.08);
  if (flash > 0 && front) {
    const [x, y] = onScreen(view, place(b.head, [0, 0, s.head.skull.r[2] * 2.2]));
    sparkle(g, x, y, 0.7 * big * flash, WHITE, flash, t * 4);
  }
}

/** Light: a soft flash at its brow as the blow lands; and a warm green glow over its crown at the turn of evolving. */
function reachGlow(s: Reach, b: Bones, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  const act = a.act;
  if (act?.kind === 'strike') {
    const k = hump(act.t, REACH_HITS[s.strike] + 0.02, 0.1);
    return k > 0 ? [{ p: place(b.head, browOf(s)), r: 0.5 * bigness(s) + 0.4 * s.strike, c: [246, 255, 226], a: 0.4 * k }] : [];
  }
  if (act?.kind === 'evolve') {
    const k = hump(act.t, 0.5, 0.12);
    return k > 0 ? [{ p: place(b.head, [0, 0, s.head.skull.r[2] * 2]), r: 0.6 * bigness(s), c: [226, 250, 200], a: 0.45 * k }] : [];
  }
  return [];
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, works and evolves. */
function reachKind(s: Reach): Kind {
  const drops = dropsOf(s);
  const { bones, tree } = reachBones(s, drops);
  const atHit = (a: Anim): Bones => bones({ ...a, act: { kind: 'strike', t: REACH_HITS[s.strike] } });
  return {
    bones,
    build: (lod) => reachBuild(s, drops, tree, lod),
    // The variant's coat for its cream and its markings for the green of its dapples; the peach dapples, its leaves, bark,
    // antlers, hooves and eyes the same on every variant.
    palette: (coat0, mark0) => {
      // The sheet's own colours, unsoftened: a warm cream, a strong sage wash over its topline, neck and upper flanks, and over it
      // dapples of a deeper green and of peach; only the belly, the muzzle and the insides of its legs pale.
      // Its cream a shade deeper than drawn, as the light lifts it: lit, it comes out the sheet's cream and never white.
      const coat = mix(coat0, [214, 182, 128], 0.22), wash = mix(mark0, coat0, 0.22), mark = mix(mark0, [62, 92, 36], 0.18);
      return coatPalette(coat0, mark0, {
        coat,
        coatDark: wash,
        // The outsides of its ears: the cream warmed toward peach.
        coatLight: mix(coat, [233, 164, 106], 0.42),
        mark,
        belly: mix(coat, [246, 230, 196], 0.35),
        muzzle: mix(coat, [246, 228, 194], 0.3),
        nose: [232, 146, 84],
        spot: [233, 164, 106],
        inner: [240, 172, 168],
        lid: [70, 46, 34],
        water: [120, 76, 36],
        eye: [34, 22, 16],
        eyeWhite: [255, 255, 255],
        glint: [255, 255, 255],
        horn: [164, 146, 124],
        hornDark: [120, 100, 82],
        hoof: [66, 46, 36],
        leaf: [128, 176, 72],
        leafDark: [80, 128, 58],
        moss: [166, 196, 84],
        stem: [110, 146, 62],
        bark: [132, 94, 60],
        cap: [236, 140, 70],
        bloom: [204, 108, 56],
        // The canopies' own greens: the sheet's mid green lit, and a deep shade under them.
        feather: [127, 160, 74],
        featherDark: [79, 110, 50],
      });
    },
    shadow: [s.len * 0.8 + 0.25, s.body.w[4] + 0.25 + 0.2 * s.stage],
    stride: 1.2,
    size: s.size,
    blinks: 4,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are the greens of its leaves.
    motes: [[196, 230, 140], [246, 200, 150]],
    glow: (b, a) => reachGlow(s, b, a),
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (!act) return;
      if (act.kind === 'strike') strikeBurst(g, view, s, b, atHit(a), act.t, front);
      else if (act.kind === 'work') workBits(g, view, s, b, tree(), act.t, front);
      else if (act.kind === 'evolve') evolveFx(g, view, s, b, act.t, front);
    },
  };
}

export const SAPLINGREACH = reachKind(SAPLINGREACH_LOOK);
export const CANOPYSHAPER = reachKind(CANOPYSHAPER_LOOK);
export const GROVEMASTER = reachKind(GROVEMASTER_LOOK);
