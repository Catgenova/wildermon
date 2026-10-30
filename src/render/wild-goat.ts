import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, DEG, disc, dot, frac, lerp, lifted, merge, mix, onEgg, orb, orbAlong,
  paint, pastel, quadBonesOf, scale, shadowOf, smile, smooth, step, sub, TAU, tube, unit, type Anim, type Bones, type Disc, type Kind,
  type LegSpec, type Piece, type QuadPose, type QuadSpec,
} from './beasts';
import { cut, quadPieces } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The goat line: the Briarling, a small fluffy kid -- tan with darker brown
 * patches and cream on its face, chest and legs, big glossy brown eyes, long
 * floppy ears lined in pink, small curved horns, a crown of white, pink and
 * yellow flowers, a shawl of leaves and daisies on its shoulders over a
 * braided vine collar, and a little tufted tail held up; which grows into the
 * Meadowtide, a taller, leggier young goat with long ridged horns swept back,
 * a beard of leaves under its chin, a leafy mantle, shaggy cream fur at its
 * chest and legs, and a woven basket on its back in a vine harness crossing
 * its chest, full of lavender and flowers; and then the Floracrux, a big
 * majestic goat, its long ridged horns wound with vines and flowers, a long
 * flowing cream beard, a shaggy cream coat down to its hocks, a trailing
 * cloak of big leaves down each flank, a big basket heaped with lavender,
 * flowers and fern fronds, chains of wisteria hanging along its sides and its
 * neck, vines wound round its legs and a small bell at its throat. The
 * species is still `petta` underneath, as saves and the database know it: it
 * picks wildflowers.
 *
 * Each is its variant's coat for its tan and the darker patches on it, and
 * its markings for the cream of its face, chest and legs; its horns, hooves,
 * leaves, flowers, basket and vines are the same on every variant. All three
 * are built by one set of functions from a description of the stage (`Goat`),
 * on the four-legged body the cloud line has (`./wild-cloud`): the Briarling
 * skips along on the diagonals, bouncing, and the others walk the four beats
 * of a goat's walk and trot when they run.
 *
 * At its task it picks a wildflower (`GOAT_WORK`): its head down to a clump
 * of them at its feet, a nibble or two, a pluck, and its head flicked up to
 * toss the flower up into its collar, or back over its shoulder into its
 * basket, where it lands; then down again for the next.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Rings along a body: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

interface Goat {
  stage: 0 | 1 | 2;
  /** The barrel's rings, rump to chest. */
  body: Rings;
  /** Shoulder to hip; the legs, how long, how thick at the top; how tall the hoof is. */
  len: number;
  legs: number;
  thick: number;
  hoof: number;
  /** The neck's root on the body, its length, width and how far forward of upright it is carried (degrees). */
  neck: { at: V3; len: number; w: number; lean: number };
  /** The skull, an egg; the muzzle out of the front of it (its middle, the way it points, its half-sizes across, up and along); how far nose-up it is carried. */
  head: { skull: { c: V3; r: V3 }; muzzle: { c: V3; dir: V3; r: V3 }; pitch: number };
  /** The way out of the skull to the right eye, how big, and how far a calm lid comes down over it. */
  eye: { dir: V3; size: number; lid: number };
  /** Each ear: long and floppy, held out to the side (degrees) and laid back, its tip drooping by `droop` of its length. */
  ear: { len: number; w: number; out: number; back: number; droop: number };
  /**
   * Each horn: how thick at the root, how long, how far back of upright it starts (degrees) and how far further back it sweeps by
   * its tip, how far out it flares, and whether vines and flowers are wound round it.
   */
  horn: { r: number; len: number; rise: number; sweep: number; flare: number; wound: boolean };
  /** The crown: how many flowers in it, and how big each is. */
  crown: { n: number; r: number };
  /** Under its chin: a beard of leaves (how long), and a long cream one (how long). */
  leafBeard: number;
  beard: number;
  /** Its shaggy cream fur: at the chest, on each leg, and the skirt of it hanging down its flanks (how long each tuft is). */
  shag: { chest: number; leg: number; skirt: number };
  /** How far up its sides its cream comes (sine of the height round the barrel), at the rump and at the chest. */
  cream: [number, number];
  /** Its darker patches: how far along the body (nought the rump, one the chest), how far round from the side (radians, up positive), how big. */
  patches: Array<[number, number, number]>;
  /** The leaves round its shoulders: rows, how many round, how long a leaf and how wide, and how many flowers among them. */
  collar: { rows: number; count: number; len: number; w: number; flowers: number };
  /** The basket on its back: how far along the body, how wide, how deep, how high its heap stands, and what is in it. */
  basket: { y: number; R: number; H: number; heap: number; lavender: number; flowers: number; ferns: number } | null;
  /** The cloak of big leaves down each flank: how many along it, and how long a leaf. */
  cloak: { n: number; len: number } | null;
  /** Chains of wisteria: how many from the collar, how many down each side from the basket, and how long. */
  chains: { neck: number; side: number; len: number };
  /** The bell at its throat, how big; nought for none. */
  bell: number;
  /** Vines wound round its lower legs. */
  wraps: boolean;
  /**
   * How it goes: how much it bounces at a walk and at a run; how far it nods; how far its legs swing at a walk and a run and for
   * how much of a stride a foot is down; whether it skips on the diagonals at a walk (a kid) or walks the four beats.
   */
  gait: { bounce: [number, number]; nod: number; swing: [number, number]; duty: [number, number]; skip: boolean };
  /** Its strike: a hop and a butt, a rearing butt, or a rearing slam. */
  strike: 0 | 1 | 2;
  size: number;
}

/** A head scaled by `k` about its neck, for a head drawn bigger or smaller against its body. */
const sized = (k: number, H: Goat['head']): Goat['head'] => ({
  skull: { c: scale(H.skull.c, k), r: scale(H.skull.r, k) }, muzzle: { c: scale(H.muzzle.c, k), dir: H.muzzle.dir, r: scale(H.muzzle.r, k) }, pitch: H.pitch,
});

/** A Briarling: a small kid, a big head and eyes, long floppy ears, small horns, a shawl of leaves and daisies. */
const BRIARLING_LOOK: Goat = {
  stage: 0,
  body: { y: [-0.74, -0.62, -0.32, 0.02, 0.36, 0.6, 0.72], z: [0.18, 0.12, 0.08, 0.08, 0.1, 0.16, 0.22], w: [0.24, 0.48, 0.57, 0.6, 0.58, 0.5, 0.24], h: [0.28, 0.54, 0.62, 0.65, 0.65, 0.6, 0.32] },
  len: 1.3, legs: 0.96, thick: 0.27, hoof: 0.15,
  neck: { at: [0, 0.62, 0.42], len: 0.34, w: 0.32, lean: 24 },
  head: sized(1.6, { skull: { c: [0, 0, 0.3], r: [0.52, 0.5, 0.47] }, muzzle: { c: [0, 0.38, 0.12], dir: [0, 1, -0.3], r: [0.2, 0.15, 0.17] }, pitch: -4 }),
  eye: { dir: [0.6, 0.64, 0.4], size: 0.215, lid: 0 },
  ear: { len: 0.8, w: 0.19, out: 98, back: 12, droop: 0.32 },
  horn: { r: 0.12, len: 0.74, rise: 12, sweep: 125, flare: 0.1, wound: false },
  crown: { n: 5, r: 0.19 },
  leafBeard: 0, beard: 0,
  shag: { chest: 0.24, leg: 0.17, skirt: 0.15 },
  cream: [-0.88, 0.0],
  patches: [[0.22, 0.75, 0.3], [0.62, 1.05, 0.26], [0.42, 0.25, 0.2]],
  collar: { rows: 2, count: 13, len: 0.36, w: 0.13, flowers: 5 },
  basket: null,
  cloak: null,
  chains: { neck: 0, side: 0, len: 0 },
  bell: 0,
  wraps: false,
  gait: { bounce: [0.22, 0.3], nod: 6, swing: [28, 40], duty: [0.5, 0.36], skip: true },
  strike: 0,
  size: 1.55,
};

/** A Meadowtide: taller and leggier, long swept-back horns, a beard of leaves, a leafy mantle, a basket of flowers on its back. */
const MEADOWTIDE_LOOK: Goat = {
  stage: 1,
  body: { y: [-1.1, -0.96, -0.56, 0, 0.54, 0.9, 1.06], z: [0.18, 0.12, 0.08, 0.1, 0.14, 0.22, 0.28], w: [0.32, 0.6, 0.68, 0.7, 0.7, 0.62, 0.32], h: [0.36, 0.68, 0.78, 0.82, 0.84, 0.78, 0.42] },
  len: 1.95, legs: 1.42, thick: 0.29, hoof: 0.17,
  neck: { at: [0, 0.98, 0.66], len: 0.58, w: 0.46, lean: 24 },
  head: sized(1.38, { skull: { c: [0, 0, 0.3], r: [0.5, 0.5, 0.45] }, muzzle: { c: [0, 0.37, 0.1], dir: [0, 1, -0.34], r: [0.235, 0.17, 0.2] }, pitch: 0 }),
  eye: { dir: [0.6, 0.64, 0.42], size: 0.18, lid: 0.1 },
  ear: { len: 0.76, w: 0.2, out: 96, back: 14, droop: 0.28 },
  horn: { r: 0.13, len: 1.45, rise: 6, sweep: 140, flare: 0.16, wound: false },
  crown: { n: 6, r: 0.16 },
  leafBeard: 0.34, beard: 0,
  shag: { chest: 0.4, leg: 0.24, skirt: 0.2 },
  cream: [-0.85, 0.2],
  patches: [[0.15, 0.8, 0.34], [0.55, 1.2, 0.3]],
  collar: { rows: 2, count: 14, len: 0.58, w: 0.19, flowers: 6 },
  basket: { y: -0.12, R: 0.9, H: 0.62, heap: 0.95, lavender: 8, flowers: 22, ferns: 0 },
  cloak: null,
  chains: { neck: 0, side: 0, len: 0 },
  bell: 0,
  wraps: false,
  gait: { bounce: [0.04, 0.3], nod: 4, swing: [24, 34], duty: [0.62, 0.4], skip: false },
  strike: 1,
  size: 1.72,
};

/** A Floracrux: big and stately, great vine-wound horns, a long beard and coat, a cloak of leaves, a heaped basket and wisteria. */
const FLORACRUX_LOOK: Goat = {
  stage: 2,
  body: { y: [-1.5, -1.34, -0.82, -0.04, 0.76, 1.26, 1.46], z: [0.18, 0.14, 0.1, 0.14, 0.22, 0.32, 0.38], w: [0.5, 0.88, 1.02, 1.06, 1.06, 0.94, 0.5], h: [0.5, 0.92, 1.08, 1.16, 1.22, 1.14, 0.6] },
  len: 2.7, legs: 1.56, thick: 0.4, hoof: 0.22,
  neck: { at: [0, 1.36, 0.98], len: 0.86, w: 0.64, lean: 18 },
  head: sized(2.08, { skull: { c: [0, 0, 0.32], r: [0.48, 0.52, 0.44] }, muzzle: { c: [0, 0.44, 0.1], dir: [0, 1, -0.34], r: [0.2, 0.17, 0.28] }, pitch: 6 }),
  eye: { dir: [0.58, 0.66, 0.44], size: 0.215, lid: 0.2 },
  ear: { len: 0.72, w: 0.22, out: 86, back: 18, droop: 0.2 },
  horn: { r: 0.2, len: 2.6, rise: 24, sweep: 140, flare: 0.5, wound: true },
  crown: { n: 7, r: 0.17 },
  leafBeard: 0, beard: 1.0,
  shag: { chest: 0.75, leg: 0.4, skirt: 0.95 },
  cream: [0.05, 0.65],
  patches: [[0.25, 1.15, 0.36]],
  collar: { rows: 2, count: 14, len: 0.7, w: 0.24, flowers: 6 },
  basket: { y: -0.22, R: 1.22, H: 0.78, heap: 1.25, lavender: 11, flowers: 30, ferns: 7 },
  cloak: { n: 5, len: 1.8 },
  chains: { neck: 2, side: 3, len: 1.35 },
  bell: 0.13,
  wraps: true,
  gait: { bounce: [0, 0.32], nod: 2.5, swing: [18, 27], duty: [0.64, 0.42], skip: false },
  strike: 2,
  size: 1.78,
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each tuft, leaf and flower, nought to one, so a coat is not a pattern. */
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
const onBody = (s: Goat, y: number, th: number): { p: V3; n: V3 } => onRings(s.body, y, th);
/** Along the body, nought at the rump's ring and one at the chest's. */
const alongBody = (s: Goat, u: number): number => lerp(s.body.y[1], s.body.y[5], u);
const onSkull = (s: Goat, dir: V3): { p: V3; n: V3 } => onEgg(s.head.skull.c, s.head.skull.r, dir);
/** The muzzle's own frame: across it (to the left), up it, and along it. */
function muzzleFrame(s: Goat): [V3, V3, V3] {
  const z = unit(s.head.muzzle.dir), x = unit(cross([0, 0, 1], z));
  return [x, cross(z, x), z];
}
/** Where the way `dir` out of the middle of the muzzle, in its own frame, meets it, and the way out of it there. */
function onMuzzle(s: Goat, dir: V3): { p: V3; n: V3 } {
  const M = s.head.muzzle, [x, y, z] = muzzleFrame(s), q = onEgg([0, 0, 0], M.r, dir);
  const to = (v: V3): V3 => add(add(scale(x, v[0]), scale(y, v[1])), scale(z, v[2]));
  return { p: add(M.c, to(q.p)), n: unit(to(q.n)) };
}
/** The end of the muzzle, where the nose is. */
const noseOf = (s: Goat): V3 => add(s.head.muzzle.c, scale(unit(s.head.muzzle.dir), s.head.muzzle.r[2]));
/** Where it holds a flower: the corner of its mouth, under the end of the muzzle. */
const mouthOf = (s: Goat): V3 => onMuzzle(s, [0.25, -0.55, 0.78]).p;
const left = (q: { p: V3; n: V3 }): { p: V3; n: V3 } => ({ p: [-q.p[0], q.p[1], q.p[2]], n: [-q.n[0], q.n[1], q.n[2]] });

/** Solids the body is, in the trunk's frame, for what is on the far side of it to be hidden behind: its back half and its front. */
function bodySolids(s: Goat, k = 0.92): Array<{ c: V3; r: V3 }> {
  const B = s.body, h = (B.y[5] - B.y[1]) / 4;
  return [
    { c: [0, B.y[1] + h * 1.2, B.z[2] + 0.02], r: [B.w[2] * k, h * 1.5, B.h[2] * k] },
    { c: [0, B.y[5] - h * 1.2, B.z[4] + 0.02], r: [B.w[4] * k, h * 1.5, B.h[4] * k] },
  ];
}
const skullOf = (s: Goat): { c: V3; r: V3 } => ({ c: s.head.skull.c, r: scale(s.head.skull.r, 0.9) });
function muzzleOf(s: Goat): { c: V3; r: V3 } {
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

/** A thin painted line along a run of points on a surface, `w` wide, each point's way out given: a mouth, a lid. */
function line(pts: ReadonlyArray<{ p: V3; n: V3 }>, w: number, m: Mat): Disc {
  const up = (q: { p: V3; n: V3 }, k: number): V3 => {
    const d = unit(cross(q.n, [1, 0, 0]));
    return add(add(q.p, scale(q.n, 0.02)), scale(d, k * w));
  };
  const v = [...pts.map((q) => up(q, 1)), ...[...pts].reverse().map((q) => up(q, -1))];
  return facing(v, pts.reduce((t, q) => add(t, q.n), [0, 0, 0] as V3), m);
}

const mirrorX = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));

/* ---- its legs and its stride ------------------------------------------------------------ */

/** Where each ear is rooted on the head (the right one): on the side of the skull, under the horn. */
const earRoot = (s: Goat): V3 => onSkull(s, [0.86, -0.22, 0.4]).p;
/** Where the horns' root is on the skull (the right one): high on the crown toward the side, behind the eyes. */
const hornRoot = (s: Goat): V3 => onSkull(s, [0.36, 0.05, 0.93]).p;

/** How the legs hang from the body standing: the hips and shoulders, and each leg's two parts' pitch (degrees, forward positive). */
const FORE_REST: [number, number, number] = [-4, 8, 0], HIND_REST: [number, number, number] = [16, -30, 0];
const foreLen = (s: Goat): number => s.legs * 0.5;
/** How far down the barrel the shoulder and the hip are: lower the deeper the barrel, so a deep body stands on short legs. */
const foreAt = (s: Goat): number => -0.34 * s.body.h[4];
const hindAt = (s: Goat): number => -0.24 * s.body.h[2];
/** A hind leg long enough, bent as it stands, for its hoof to stand on the ground the fore hooves stand on. */
function hindLen(s: Goat): number {
  const c = (d: number): number => Math.cos(d * DEG);
  const reach = -foreAt(s) + foreLen(s) * (c(FORE_REST[0]) + c(FORE_REST[0] + FORE_REST[1]));
  return (reach + hindAt(s)) / (c(HIND_REST[0]) + c(HIND_REST[0] + HIND_REST[1]));
}

/** A stage's body on four hooves (`QuadSpec`). */
const specOf = (s: Goat): QuadSpec => ({
  high: s.legs + 0.6,
  fore: { at: [s.body.w[4] * 0.46, s.len * 0.44, foreAt(s)], len: [foreLen(s), foreLen(s), s.hoof], rest: FORE_REST, fold: [55, 90], toe: [s.thick * 0.7, s.thick * 0.3] },
  hind: { at: [s.body.w[2] * 0.46, -s.len * 0.4, hindAt(s)], len: [hindLen(s), hindLen(s), s.hoof], rest: HIND_REST, fold: [35, 60], toe: [s.thick * 0.7, s.thick * 0.3] },
  neck: { at: s.neck.at, len: s.neck.len, lean: s.neck.lean },
  head: { pitch: s.head.pitch },
  tail: { at: [0, s.body.y[0] + 0.1, s.body.z[0] + s.body.h[1] * 0.6], links: 2, len: 0.1 + 0.04 * s.stage, lift: 52 - 8 * s.stage, curl: -14, sway: 10 },
  ears: { at: earRoot(s), out: s.ear.out, back: s.ear.back },
  swing: s.gait.swing,
  duty: s.gait.duty,
  // Grazing, the neck bowed forward and down a little past level, and the nose down past it toward the grass: a goat nibbling
  // reaches forward of its fore hooves rather than down between them.
  graze: 102 - s.neck.lean,
  nose: 40,
  bow: 0,
  rock: 4,
});

/** Where each leg's foot is in a stride: a goat's four-beat walk, and the diagonals together, a trot or a kid's skip. */
const FOUR_BEAT = [0.25, 0.75, 0, 0.5];
const DIAGONALS = [0, 0.5, 0.5, 0];

/**
 * A leg's stride: standing, as `step` has it; swinging, its hoof lifted
 * straight off the grass, carried forward and set straight down on its mark,
 * the leg swung to whatever puts the hoof there, folded as it is (as the
 * cloud line's are, `./wild-cloud`).
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

/** How far through a strike each stage's blow lands: when its horns meet what it butts. */
export const GOAT_HITS = [0.5, 0.52, 0.54] as const;

/**
 * A go at its task, picking a wildflower: its head down at the clump
 * (`down`, from standing when played once), a nibble at each of `bites`, the
 * flower plucked (`pluck`), its head up (`up`) and the flower tossed
 * (`toss`) up into its collar or over its shoulder into its basket, where it
 * lands (`land`); and, looping, its head back down (`back`) to the next.
 */
export const GOAT_WORK = { down: [0, 0.16], bites: [0.12, 0.22], pluck: 0.3, up: [0.34, 0.5], toss: 0.53, land: 0.7, back: [0.7, 0.97] } as const;

/** How far its head is down at the clump, `t` through a go: looping (`graze` one) it starts and ends down; played once, up. */
function headDown(t: number, graze: number): number {
  const W = GOAT_WORK;
  const lift = ramp(t, W.up[0], W.up[1]);
  const loop = 1 - lift + ramp(t, W.back[0], W.back[1]);
  const once = ramp(t, W.down[0], W.down[1]) * (1 - lift);
  return clamp(lerp(once, Math.min(1, loop), clamp(graze)));
}

/** How far into a nibble it is, `t` through a go, and how hard the pluck tugs. */
function biteOf(t: number): number {
  let b = 0;
  for (const x of GOAT_WORK.bites) b = Math.max(b, hump(t, x, 0.04));
  return Math.max(b, hump(t, GOAT_WORK.pluck, 0.035));
}

/** The toss: its head flicked up and back, the moment the flower leaves its mouth. */
const tossOf = (t: number): number => ramp(t, GOAT_WORK.up[0] + 0.06, GOAT_WORK.toss) * (1 - ramp(t, GOAT_WORK.toss + 0.02, GOAT_WORK.back[0] + 0.08));

/** How far the whole body is carried forward this moment, in its own units, as it strikes. Its legs are swung back by as much. */
function surge(s: Goat, a: Anim): number {
  const act = a.act;
  if (act?.kind !== 'strike') return 0;
  const t = act.t, hit = GOAT_HITS[s.strike];
  if (s.strike === 0) return s.len * (0.22 * ramp(t, 0.2, hit) * (1 - ramp(t, hit + 0.1, 1)) - 0.05 * ramp(t, 0.02, 0.2) * (1 - ramp(t, 0.2, 0.34)));
  return s.len * (0.12 * ramp(t, 0.36, hit) * (1 - ramp(t, hit + 0.12, 1)) - 0.06 * ramp(t, 0.03, 0.25) * (1 - ramp(t, 0.25, 0.47)));
}

/** How far up it is reared, `t` through its strike. */
const rearOf = (t: number): number => ramp(t, 0.03, 0.27) * (1 - ramp(t, 0.27, 0.5));
/** How far up each stage rears, in degrees, over its hind hooves. */
const REAR = [0, 20, 17];

/** How far the whole body is moved along as it rears, so its hind hooves stay put as it tips over them. */
function rocked(spec: QuadSpec, s: Goat, a: Anim): number {
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
 * gait, the Briarling's bouncing skip and the others' four-beat walk;
 * standing, an ear flicked, the tail flicked and a chew of the cud; and its
 * moves -- the strike, picking a flower, and evolving.
 */
function goatPose(s: Goat, spec: QuadSpec, p: QuadPose, a: Anim, reach = 0): void {
  const g = smooth(a.go), G = s.gait;
  if (a.go > 0) {
    // Its own stride for each leg, in place of the pose's: the Briarling on the diagonals at a walk too, the others the four
    // beats at a walk and the diagonals at a run, each hoof lifted straight up and set straight down.
    const duty = lerp(G.duty[0], G.duty[1], a.gait), amp = lerp(G.swing[0], G.swing[1], a.gait);
    const at = G.skip || a.gait >= 0.5 ? DIAGONALS : FOUR_BEAT;
    const quad = a.gait < 0.5 ? FOUR_BEAT : [0, 0.5, 0.5, 0];
    for (let i = 0; i < 4; i++) {
      const was = step(a.u + quad[i], lerp(spec.duty?.[0] ?? 0.64, spec.duty?.[1] ?? 0.4, a.gait), lerp(spec.swing[0], spec.swing[1], a.gait));
      const now = lifting(i < 2 ? spec.fore : spec.hind, a.u + at[i], duty, amp * sweepOf(spec, i < 2), G.skip ? 1.2 : 1);
      for (let k = 0; k < 3; k++) p.legs[i][k] += g * (now[k] - was[k]);
    }
    const w = frac(a.u);
    // The kid's skip, up off each pair of hooves even at a walk; the others barely off the grass at a walk and springing at a run,
    // highest as the pairs change over.
    const over = (duty + 0.5) / 2;
    p.lift = g * lerp(G.bounce[0], G.bounce[1], a.gait) * (0.5 + 0.5 * Math.cos((w - over) * TAU * 2));
    p.head[0] += g * G.nod * Math.sin(w * TAU * 2 - 1.1);
    p.neck[0] += g * (3 + 3 * a.gait);
    // Its ears flopping a beat behind its nod, and its tail up and going.
    p.ears[0][0] += g * (2.5 * G.nod * Math.sin(w * TAU * 2 - 1.8) - 6);
    p.ears[1][0] += g * (2.5 * G.nod * Math.sin(w * TAU * 2 - 1.5) - 6);
    p.ears[0][1] += g * 10 * Math.sin(w * TAU * 2 - 2.0);
    p.ears[1][1] -= g * 10 * Math.sin(w * TAU * 2 - 1.7);
    p.tail[0] += g * 10;
    p.tail[1] += g * 16 * Math.sin(w * TAU + 0.6);
    p.roll = lerp(p.roll, p.roll * a.gait + a.gait * 2 * Math.sin(w * TAU), g);
    // A swinging hoof curled back as it lifts and flat again before it comes down.
    for (let i = 0; i < 4; i++) {
      const L = i < 2 ? spec.fore : spec.hind, rest = L.rest ?? [0, 0, 0], folds = L.fold ?? [45, 75];
      const [sw, fold, off] = p.legs[i];
      if (!off) continue;
      const flat = -(p.pitch + rest[0] + sw + rest[1] - fold * lerp(folds[0], folds[1], clamp(Math.abs(sw) / 40)));
      const had = clamp(off * 3), want = clamp(off * 3) * smooth((1 - off) * 4);
      p.foot[i] += (had - want) * (0.6 * flat + 35 * fold);
    }
  } else {
    // Standing: an ear flicked now and then, the tail flicked, and a chew of the cud in bursts, a chew to each four stills.
    p.ears[0][0] += 22 * beat(a.t, [4.1, 15.3], 0.4);
    p.ears[1][0] += 22 * beat(a.t, [9.7, 20.2], 0.4);
    p.ears[1][1] += 14 * beat(a.t, [9.7, 20.2], 0.4);
    p.tail[1] += 22 * cyc(a.t, 40) * beat(a.t, [2.5, 11.4, 17.8], 1.2);
    p.tail[0] += 8 * beat(a.t, [2.5, 11.4, 17.8], 1.2);
    const chew = beat(a.t, [0.6, 7.2, 13.6, 19.0], 3.2);
    p.jaw = Math.max(p.jaw, chew * (0.5 + 0.5 * cyc(a.t, 36)));
  }
  // At its task with its head down: the fore legs kept under it, and the chest let down on them, the neck bowed on toward
  // hanging straight down and the face down, its nose at the flowers.
  const gz = a.act?.kind === 'work' ? a.graze : a.act ? 0 : a.graze * (1 - g);
  if (gz > 0) {
    p.legs[0][1] -= 0.85 * gz;
    p.legs[1][1] -= 0.85 * gz;
    tipped(spec, p, (6 + 10 * reach) * gz);
    p.neck[0] += Math.min(18, 14 * reach) * gz;
    p.head[0] -= 14 * reach * gz;
    p.tail[0] += 26 * gz * beat(a.t, [2.3, 7.9, 13.1, 19.4], 0.3);
  }
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
  const act = a.act;
  if (act?.kind === 'strike') strikePose(s, spec, p, act.t);
  else if (act?.kind === 'work') {
    const t = act.t, bite = biteOf(t) * gz, toss = tossOf(t);
    // A nibble at each bite, the jaw working, and a tug up at the pluck; its tail flicked at each, which is what shows from behind.
    p.head[0] -= bite * 6;
    p.head[0] += 9 * hump(t, GOAT_WORK.pluck + 0.02, 0.04) * gz;
    p.jaw = Math.max(p.jaw, bite);
    p.tail[0] += 24 * bite;
    // The toss: the nose flicked up, the neck kept where it is, so the face stays clear of the basket; the ears thrown back.
    p.neck[0] -= 4 * toss;
    p.head[0] += 16 * toss;
    p.ears[0][0] += 30 * toss;
    p.ears[1][0] += 30 * toss;
    p.squash -= 0.04 * hump(t, GOAT_WORK.toss, 0.06);
  } else if (act?.kind === 'evolve') {
    // Evolving: drawn up tall as the light gathers, then at the turn a shake of the head, ears flapping.
    const t = act.t, up = ramp(t, 0.1, 0.45) * (1 - ramp(t, 0.62, 0.85)), shake = hump(t, 0.56, 0.1);
    p.neck[0] -= 12 * up;
    p.head[0] += 12 * up;
    p.head[2] += 16 * shake * Math.sin(t * 70);
    p.ears[0][1] += 25 * shake * Math.sin(t * 70);
    p.ears[1][1] -= 25 * shake * Math.sin(t * 70);
    p.squash -= 0.04 * up;
    p.tail[1] += 25 * Math.sin(t * 30) * up;
  }
  if (act?.kind === 'strike' || act?.kind === 'evolve') grounded(spec, p);
}

/**
 * Each stage's strike. The Briarling crouches, hops forward and butts with
 * its little horns as it lands; the Meadowtide and the Floracrux rear up on
 * their hind legs, as goats do, and come down driving their horns forward, the
 * Floracrux slower and heavier.
 */
function strikePose(s: Goat, spec: QuadSpec, p: QuadPose, t: number): void {
  const hit = GOAT_HITS[s.strike], st = settleOf(t, hit);
  const flick = hump(t, hit + 0.02, 0.1);
  p.tail[0] += 40 * flick;
  p.tail[1] += 24 * flick * Math.sin(t * 60);
  if (s.strike === 0) {
    const crouch = ramp(t, 0.02, 0.18) * (1 - ramp(t, 0.16, 0.32));
    const hop = t > 0.18 && t < hit ? Math.sin(Math.PI * (t - 0.18) / (hit - 0.18)) ** 1.5 : 0;
    const butt = ramp(t, 0.36, hit) * (1 - ramp(t, hit + 0.12, 0.9));
    p.lift += 0.26 * hop;
    sunk(spec, p, 0.06 * crouch);
    tipped(spec, p, -11 * crouch, 'fore');
    p.tail[0] += 48 * hump(t, 0.2, 0.08);
    p.legs[0][0] += 8 * hop;
    p.legs[1][0] += 8 * hop;
    p.legs[2][0] -= 16 * hop;
    p.legs[3][0] -= 16 * hop;
    p.legs[2][1] += 0.25 * hop;
    p.legs[3][1] += 0.25 * hop;
    p.pitch += 6 * hop;
    settled(spec, p, 3 * st);
    tipped(spec, p, 8 * butt * (1 - hop), 'hind');
    p.neck[0] += 10 * crouch + 30 * butt - 6 * st;
    p.head[0] += -16 * crouch - 26 * butt + 6 * st;
    for (const e of p.ears) e[0] += 30 * crouch + 20 * hop - 10 * st;
    p.squash += 0.08 * hump(t, hit + 0.03, 0.07) - 0.05 * hop;
    return;
  }
  const rear = rearOf(t), heavy = s.strike === 2 ? 1 : 0;
  const drive = ramp(t, 0.36, hit) * (1 - ramp(t, hit + 0.14, 0.95));
  const down = ramp(t, 0.44, hit + 0.04) * (1 - ramp(t, hit + 0.14, 0.95));
  // Reared up over its hind hooves, sat down on them, its fore legs folded up under its chest and its chin tucked so the horns
  // face forward; then down again, driving in, its chest let down over its fore hooves and its rump up.
  sunk(spec, p, (0.17 + 0.06 * heavy) * rear);
  for (const i of [0, 1]) p.legs[i][2] = Math.max(p.legs[i][2], rear);
  tipped(spec, p, -REAR[s.strike] * rear, 'hind');
  for (const i of [0, 1]) {
    p.legs[i][0] += 26 * rear;
    p.legs[i][1] = Math.max(p.legs[i][1], 0.6 * rear);
  }
  settled(spec, p, 3 * st);
  tipped(spec, p, (7 + 4 * heavy) * down, 'hind');
  p.neck[0] += -14 * rear + (28 + 20 * heavy) * drive - 6 * st;
  p.head[0] += -22 * rear - (22 + 16 * heavy) * drive + 6 * st;
  for (const e of p.ears) e[0] += 26 * rear + 18 * drive;
  p.squash += (0.07 + 0.03 * heavy) * hump(t, hit + 0.03, 0.08);
  p.tail[0] -= 30 * rear;
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

/** A chain of wisteria, or the bell: where it hangs from, on which bone, how long it is, and which side it is on. */
interface Drop { bone: 'collar' | 'trunk'; at: V3; len: number; r: number; side: number; id: number; bell?: boolean }

/** Where the basket sits on the back, in the trunk's frame: the middle of its rim. */
function basketAt(s: Goat): V3 {
  const K = s.basket!, top = onBody(s, alongBody(s, 0.5 + K.y * 0.5), Math.PI / 2).p;
  return [0, top[1], top[2] + K.H * 0.6];
}

/** Where its flowers go when tossed, in the frame of the bone they land on: the heap in the basket, or the collar at its shoulder. */
function landingOf(s: Goat): { bone: 'trunk' | 'collar'; at: V3 } {
  if (s.basket) {
    const c = basketAt(s);
    return { bone: 'trunk', at: [s.basket.R * 0.25, c[1] + s.basket.R * 0.15, c[2] + s.basket.heap * 0.45] };
  }
  const q = onNeck(s, -0.05, 0.25, s.neck.w * 0.35);
  return { bone: 'collar', at: q.p };
}

/** The bones of a stage: a body on four hooves stood on the ones bearing its weight, its chains and bell hanging, and the flower it picks. */
function goatBones(s: Goat, drops: readonly Drop[]): (a: Anim) => Bones {
  const spec = specOf(s);
  let last: QuadPose | undefined, reach = 0, found = false;
  const posed = quadBonesOf(spec, (p, a) => { goatPose(s, spec, p, a, reach); last = p; });
  // How much further it bows for its nose to come down to the flowers, found once for the stage by trying; and where the clump
  // stands on the grass, under its nose.
  const grass = 0.22 + 0.06 * s.stage;
  let clump: V3 = [0, s.len, 0];
  const noseAt = (extra: number): number => {
    reach = extra;
    const b = posed({ t: 0, u: 0, go: 0, gait: 0, graze: 1, blink: false, breath: 0.5, fleece: 1, seed: 0 });
    return place(b.head, noseOf(s))[2];
  };
  const calibrate = (): void => {
    found = true;
    let lo = 0, best = 0, low = noseAt(0);
    for (let x = 0.1; x <= 1.6 + 1e-9; x += 0.1) {
      const z = noseAt(x);
      if (z <= grass) {
        let hi = x;
        for (let q = 0; q < 12; q++) {
          const mid = (lo + hi) / 2;
          if (noseAt(mid) > grass) lo = mid;
          else hi = mid;
        }
        reach = hi;
        best = -1;
        break;
      }
      if (z < low) { low = z; best = x; }
      lo = x;
    }
    if (best >= 0) reach = best;
    const b = posed({ t: 0, u: 0, go: 0, gait: 0, graze: 1, blink: false, breath: 0.5, fleece: 1, seed: 0 });
    const tip = place(b.head, mouthOf(s));
    clump = [tip[0] * 0.5, tip[1] + 0.04, 0];
  };
  const land = landingOf(s);
  return (a) => {
    if (!found) calibrate();
    const act = a.act;
    const graze = act?.kind === 'work' ? headDown(act.t, a.graze) : act ? 0 : a.graze;
    let b = posed({ ...a, graze });
    const p = last as QuadPose;
    if (!(graze > 0 && a.go < 1)) {
      const all = [0, 1, 2, 3];
      b = lifted(b, Math.max(-lowOf(spec, b, all, p, act ? 0 : a.go), -lowOf(spec, b, all)) + Math.max(0, p.lift));
      b.shadow = shadowOf(b.body, p.lift);
    }
    const d = surge(s, a) + rocked(spec, s, a);
    if (d) for (const k of Object.keys(b)) b[k] = { m: b[k].m, t: [b[k].t[0], b[k].t[1] + d, b[k].t[2]] };
    // The collar goes half as far as the neck does: its bone is the neck's, turned back by half the bow.
    b.collar = joint(b.neck, [0, 0, 0], spec.neck.lean + 0.5 * p.neck[0]);
    drops.forEach((dr, q) => {
      const at = place(b[dr.bone], dr.at);
      const [pitch, roll] = swingOf(s, a, dr, q);
      b[`drop${q}`] = joint({ m: ROOT.m, t: at }, [0, 0, 0], pitch, roll, 0);
    });
    if (act?.kind === 'work') {
      b.clump = { m: ROOT.m, t: clump };
      b.pick = pickOf(s, b, act.t, clump, land);
    }
    return b;
  };
}

/** A frame made `k` times bigger, nought for a thing not there. */
const scaled = (x: Xf, k: number): Xf => { const q = Math.max(0.001, k), m = x.m; return { m: [m[0] * q, m[1] * q, m[2] * q, m[3] * q, m[4] * q, m[5] * q, m[6] * q, m[7] * q, m[8] * q], t: x.t }; };

/**
 * Where the flower it picks is, `t` through a go: standing in the clump,
 * nodding at each nibble; held by its stem at the corner of its mouth, its
 * bloom out to the side, from the pluck; flung up in an arc, turning over,
 * from its mouth to the basket or the collar at the toss; sinking into the
 * heap as it lands; and a new one growing in the clump for the next go.
 */
function pickOf(s: Goat, b: Bones, t: number, clump: V3, land: { bone: 'trunk' | 'collar'; at: V3 }): Xf {
  const W = GOAT_WORK;
  const stand: V3 = [clump[0] + 0.02, clump[1] + 0.03, 0];
  if (t < W.pluck) {
    const nod = biteOf(t) * 9;
    return joint({ m: ROOT.m, t: stand }, [0, 0, 0], -nod, 4 * Math.sin(t * 40), 0);
  }
  if (t < W.toss) {
    // Held at the corner of its mouth, its stem across and its bloom out to the side.
    return joint(b.head, mouthOf(s), 0, 80, 0);
  }
  const target = place(b[land.bone], land.at);
  if (t < W.land) {
    // Flown up from where it left the mouth to where it lands, over in an arc, turning; the mouth's place at the toss itself.
    const u = (t - W.toss) / (W.land - W.toss), from = place(b.head, mouthOf(s));
    const p = mixV(from, target, u);
    p[2] += (0.6 + 0.5 * s.stage) * Math.sin(Math.PI * u);
    return joint({ m: ROOT.m, t: p }, [0, 0, 0], 360 * u, 80 - 60 * u, 90 * u);
  }
  // Landed: it sinks into the heap and is gone, and the next grows in the clump.
  const sink = 1 - ramp(t, W.land, W.land + 0.06);
  if (sink > 0) return scaled(joint({ m: ROOT.m, t: target }, [0, 0, 0], 20, 20, 0), sink);
  const grow = ramp(t, W.back[0] + 0.06, 1);
  return scaled({ m: ROOT.m, t: stand }, grow);
}

/** How far a chain or the bell swings this moment, fore and aft and from side to side, in degrees. */
function swingOf(s: Goat, a: Anim, dr: Drop, q: number): [number, number] {
  const g = smooth(a.go), w = frac(a.u), ph = 0.35 * jitter(dr.id);
  // Stirring as it stands, each its own way: a few turns a loop.
  let pitch = 4 * cyc(a.t, 2 + (q % 3), dr.id) * (1 - g);
  let roll = 4 * cyc(a.t, 3 + (q % 2), dr.id * 2) * (1 - g);
  pitch += g * (8 + 10 * a.gait) * Math.sin(w * TAU * 2 - 2.0 - ph) + g * (6 + 8 * a.gait);
  roll += g * 7 * Math.sin(w * TAU - 1.6 - ph);
  const act = a.act;
  if (!act) pitch -= 8 * a.graze * (1 - g);
  if (act?.kind === 'strike') {
    const t = act.t, hit = GOAT_HITS[s.strike];
    const ring = t > hit ? Math.sin((t - hit) * 26 + ph) * Math.exp(-(t - hit) * 5) : 0;
    pitch += -14 * ramp(t, 0.05, 0.3) * (1 - ramp(t, 0.3, hit)) + 18 * ramp(t, 0.32, hit) * (1 - ramp(t, hit, hit + 0.06)) + 30 * ring;
    roll += 10 * ring * dr.side;
  } else if (act?.kind === 'work') {
    const t = act.t, toss = tossOf(t);
    pitch += -10 * headDown(t, a.graze) + 14 * toss + 8 * Math.sin(t * 30 + ph) * hump(t, GOAT_WORK.toss + 0.06, 0.12);
    roll += 6 * Math.sin(t * TAU * 2 + ph);
  } else if (act?.kind === 'evolve') {
    const t = act.t, k = hump(t, 0.56, 0.12);
    roll += 24 * k * Math.sin(t * 70 + ph);
    pitch += 12 * k * Math.sin(t * 50 + ph);
  }
  return [pitch, roll];
}

/* ---- flowers, leaves and vines ---------------------------------------------------------- */

/** The flowers it wears and picks: white, pink and yellow, each with its own heart. */
const BLOOMS: ReadonlyArray<readonly [Mat, Mat]> = [['petal', 'bloom'], ['cap', 'spot'], ['bloom', 'spot'], ['petal', 'spot'], ['feather', 'bloom']];

/**
 * A flower facing along `n`, `r` across: five round petals as one flat shape,
 * both sides of it, and a heart, a little dome drawn fine and a dab of colour
 * drawn small, which is all it comes to at a few pixels across.
 */
function flowerOf(c: V3, n: V3, r: number, petal: Mat, heart: Mat, fine: boolean, spin = 0): Mesh {
  const N = fine ? 25 : 15, d = unit(n), [u, w] = across(d), v: V3[] = [];
  for (const side of [1, -1]) {
    for (let q = 0; q < N; q++) {
      const a = spin + (q / N) * TAU, k = r * (0.32 + 0.68 * Math.abs(Math.cos(2.5 * (a - spin))) ** 0.55);
      v.push(add(add(c, scale(d, side * 0.008)), add(scale(u, Math.cos(a) * k), scale(w, Math.sin(a) * k))));
    }
  }
  const f: Face[] = [{ i: Array.from({ length: N }, (_, q) => q), m: petal }, { i: Array.from({ length: N }, (_, q) => N + q), m: petal }];
  const middle = fine
    ? orbAlong(add(c, scale(d, r * 0.06)), d, [r * 0.3, r * 0.3, r * 0.16], 5, 3, heart)
    : paint([disc(add(c, scale(d, 0.02)), d, r * 0.34, r * 0.34, 6, heart, { lit: true })]);
  return merge(mesh(v, wound(v, f, [d, scale(d, -1)])), middle);
}

/**
 * A leaf from `root` along `dir`, its upper side toward `face`, `len` long and
 * `w` across: two halves folded a little up along the midrib, light and
 * shaded, and its underside; its edge toothed when `teeth` says so, for the
 * big serrated leaves of a cloak. Four faces, however fine its edge.
 */
function leafOf(root: V3, dir: V3, face: V3, len: number, w: number, mats: readonly [Mat, Mat, Mat] = ['leaf', 'leafDark', 'leafDark'], teeth = 0, curl = 0.12, vein?: Mat, cup = 0.25): Mesh {
  const d = unit(dir), f = unit(sub(face, scale(d, dot(face, d)))), side = unit(cross(d, f));
  const K = teeth ? 2 + teeth * 2 : 5;
  const rib: V3[] = [], L: V3[] = [], R: V3[] = [];
  for (let k = 0; k <= K; k++) {
    const u = k / K, bow = Math.sin(Math.PI * u) * len * curl;
    const p = add(add(root, scale(d, len * u)), scale(f, bow - len * curl * 0.6 * u * u));
    rib.push(p);
    if (k === 0 || k === K) continue;
    const tooth = teeth ? (k % 2 ? 1.08 : 0.82) : 1, ww = w * Math.sin(Math.PI * u ** 0.85) * tooth;
    L.push(add(add(p, scale(side, -ww)), scale(f, -ww * cup)));
    R.push(add(add(p, scale(side, ww)), scale(f, -ww * cup)));
  }
  const v: V3[] = [...rib, ...L, ...R];
  const ribI = rib.map((_, q) => q), LI = L.map((_, q) => rib.length + q), RI = R.map((_, q) => rib.length + L.length + q);
  const halfL = [...ribI, ...[...LI].reverse()], halfR = [...ribI, ...[...RI].reverse()];
  const f4: Face[] = [{ i: halfL, m: mats[0] }, { i: [...halfR], m: mats[1] }, { i: [...halfL], m: mats[2] }, { i: [...halfR], m: mats[2] }];
  const blade = mesh(v, wound(v, f4, [f, f, scale(f, -1), scale(f, -1)]));
  if (!vein) return blade;
  // A pale vein down its middle, painted along the midrib, narrowing to the tip.
  const vw = w * 0.07, strip = [...rib.map((p, k) => add(add(p, scale(side, vw * (1 - k / K))), scale(f, 0.012))), ...[...rib].reverse().map((p, k) => add(add(p, scale(side, -vw * (k / K))), scale(f, 0.012)))];
  return merge(blade, paint([facing(strip, f, vein)]));
}

/** A braided vine along a line of points: two strands' worth of green and brown in bands, so it reads as plaited. */
const vine = (pts: readonly V3[], r: number, n: number): Mesh => tube(pts, r, r * 0.85, Math.max(4, n), (ring, j) => ((ring + j) % 3 === 0 ? 'bark' : 'stem'));

/** A spike of lavender from `root` up along `dir`: a thin stem, and the spike of purple buds along its top in light and dark bands. */
function lavenderOf(root: V3, dir: V3, len: number, r: number, n: number): Mesh {
  // Bowing out the way it leans as it goes up, as a stem does under the weight of its buds.
  const d = unit(dir), out = unit([d[0], d[1], 0.0001]), K = 6, pts: V3[] = [], ws: number[] = [];
  const at = (u: number): V3 => add(add(root, scale(d, len * u)), scale(out, len * 0.22 * u * u));
  for (let k = 0; k <= K; k++) {
    const u = k / K;
    pts.push(at(0.42 + 0.58 * u));
    ws.push(r * [0.75, 1.1, 1.15, 1.05, 0.9, 0.65, 0.3][k]);
  }
  // Each band of buds knobbled out by turns, so the spike is soft and not a rod.
  const t = tube(pts, ws, ws, n, (ring) => (ring % 2 ? 'crystal' : 'crystalDark'));
  const v = t.v.map((p, i): V3 => {
    const ring = Math.min(K, Math.floor(i / n)), j = i % n, c = pts[ring], k = (ring + j) % 2 ? 1.25 : 0.85;
    return [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k, p[2]];
  });
  return merge(tube([root, at(0.22), pts[0]], r * 0.22, r * 0.22, 3, 'stem', { start: false }), mesh(v, t.f));
}

/** A fern frond from `root` along `dir`, its face toward `face`: a curved rib with leaflets either side, shortening to the tip. */
function frondOf(root: V3, dir: V3, face: V3, len: number, pairs: number): Mesh {
  const d = unit(dir), f = unit(sub(face, scale(d, dot(face, d)))), side = unit(cross(d, f));
  const pts = Array.from({ length: pairs + 2 }, (_, k): V3 => {
    const u = k / (pairs + 1);
    return add(add(root, scale(d, len * u)), scale(f, -len * 0.3 * u * u));
  });
  const out: Mesh[] = [tube(pts, 0.018, 0.018, 3, 'stem')];
  for (let k = 1; k <= pairs; k++) {
    const u = k / (pairs + 1), L = len * 0.32 * (1 - 0.7 * u);
    for (const sd of [1, -1]) {
      const p = pts[k], tip = add(add(p, scale(side, sd * L)), scale(d, L * 0.45)), back = add(p, scale(d, -len * 0.05));
      const fwd = add(p, scale(d, len * 0.08));
      const v: V3[] = [back, tip, fwd];
      const fs: Face[] = [{ i: [0, 1, 2], m: 'moss' }, { i: [0, 1, 2], m: 'leafDark' }];
      out.push(mesh(v, wound(v, fs, [f, scale(f, -1)])));
    }
  }
  return merge(...out);
}

/**
 * A chain of wisteria, hung from its bone at the top: a short vine and a
 * raceme of buds hanging down from it, full at the top and tapering to a
 * point, in bands of deep purple, lilac and white, each band's buds standing
 * out by turns so it is knobbled and not a cone.
 */
function wisteriaOf(len: number, r: number, n: number): Mesh {
  const K = 7, top = len * 0.16, pts: V3[] = [], ws: number[] = [];
  for (let k = 0; k <= K; k++) {
    const u = k / K;
    pts.push([0, 0, -top - (len - top) * u]);
    ws.push(r * (k === K ? 0.08 : (1 - 0.72 * u) * (k === 0 ? 0.7 : 1)));
  }
  const MATS: readonly Mat[] = ['crystalDark', 'crystal', 'crystal', 'gem', 'crystal', 'gem', 'petal', 'petal'];
  const t = tube(pts, ws, ws, n, (ring) => MATS[Math.min(MATS.length - 1, ring)]);
  const v = t.v.map((p, i): V3 => {
    const ring = Math.floor(i / n), j = i % n, k = (ring + j) % 2 ? 1.22 : 0.86;
    return [p[0] * k, p[1] * k, p[2]];
  });
  return merge(tube([[0, 0, 0.02], [0, 0, -top]], 0.022, 0.022, 3, 'stem'), mesh(v, t.f));
}

/** A small bell, hung from its bone at the top: a gold cup with a flared lip, a bright band and its clapper under it. */
function bellOf(r: number, n: number): Mesh {
  const zs = [-0.02, -r * 0.4, -r * 1.0, -r * 1.55, -r * 1.75], ws = [r * 0.2, r * 0.55, r * 0.75, r * 1.0, r * 1.08];
  return merge(
    tube([[0, 0, 0.02], [0, 0, -0.04]], r * 0.22, r * 0.22, 4, 'bark'),
    tube(zs.map((z) => [0, 0, z] as V3), ws, ws, n, (ring) => (ring === 3 ? 'metalLit' : ring === 2 ? 'metal' : 'metalDark'), { end: false }),
    orb([0, 0, -r * 1.8], r * 0.28, 5, 3, 'metalDark'),
  );
}

/** A puff of fluff: round, fine enough drawn big that its edge is a curve rather than steps, as the cloud line's fleece is. */
const puffOf = (c: V3, r: V3, n: number, m: Mat): Mesh => orb(c, r, n > 3 ? 11 : 5, n > 3 ? 6 : 3, m);

/** A tuft of shaggy fur from `root` along `dir`, `len` long and `w` thick at its root, bowing toward `droop`. */
function tuftOf(root: V3, dir: V3, len: number, w: number, mat: Mat, droop: V3 = [0, 0, -1], n = 4): Mesh {
  // A soft lock rather than a spike: swelling a little from its root and rounding off at its tip.
  const d = unit(dir), at = (u: number, k: number): V3 => add(add(root, scale(d, len * u)), scale(droop, len * k));
  const ws = [w * 0.8, w, w * 0.9, w * 0.62, w * 0.18];
  return tube([root, at(0.3, 0.03), at(0.62, 0.1), at(0.88, 0.2), at(1, 0.28)], ws, ws, n, mat);
}

/* ---- the head ------------------------------------------------------------------------------- */

/** Where a point on a ring round the neck is, in the collar's frame: `t` up the neck, `th` round it (nought its right side, down negative), pushed out by `out`. */
function onNeck(s: Goat, t: number, th: number, out = 0): { p: V3; n: V3 } {
  const lean = s.neck.lean * DEG, A: V3 = [0, Math.sin(lean), Math.cos(lean)], v = cross(A, [1, 0, 0]);
  const n = add(scale([1, 0, 0], Math.cos(th)), scale(v, -Math.sin(th)));
  return { p: add(scale(A, t), scale(n, s.neck.w * 0.95 + out)), n };
}

/**
 * The eyes, open or shut: big, round and glossy brown with a dark middle, a
 * big glint and a small one, under a soft lid line, a calm lid coming down
 * over the bigger stages'. All of an eye goes out of sight together when the
 * skull or the muzzle is between it and the viewer (`at`).
 */
function eyesOf(s: Goat, shut: boolean): Mesh {
  const E = s.eye, out: Disc[] = [];
  for (const side of [1, -1]) {
    const q0 = onSkull(s, E.dir), q = side > 0 ? q0 : left(q0);
    const n = unit(add(q.n, [0, 0.1, 0.04])), p = add(q.p, scale(n, 0.005));
    const at = onSkull(s, add(scale(q.n, 1), [side * 0.75, -0.25, 0])).p;
    const up = unit(cross(cross(n, [0, 0, 1]), n)), side3 = unit(cross(up, n));
    const o = { at, up: [0, 0, 1] as V3 };
    const r = E.size;
    if (shut) {
      out.push(line(Array.from({ length: 5 }, (_, k) => {
        const f = k / 4 - 0.5, pt = add(add(p, scale(side3, f * r * 2.1)), scale(up, -r * 0.1 + r * 0.35 * (1 - 4 * f * f)));
        return { p: pt, n };
      }), r * 0.2, 'lid'));
      continue;
    }
    out.push(disc(add(p, scale(up, r * 0.06)), n, r * 1.14, r * 1.18, 12, 'lid', o));
    out.push(disc(add(p, scale(n, 0.004)), n, r, r * 1.06, 12, 'water', o));
    out.push(disc(add(add(p, scale(n, 0.008)), scale(up, -r * 0.04)), n, r * 0.6, r * 0.66, 10, 'eye', o));
    out.push(disc(add(add(add(p, scale(n, 0.012)), scale(up, r * 0.34)), scale(side3, -side * r * 0.28)), n, r * 0.34, r * 0.34, 7, 'glint', { ...o, lit: true }));
    out.push(disc(add(add(add(p, scale(n, 0.012)), scale(up, -r * 0.42)), scale(side3, side * r * 0.32)), n, r * 0.14, r * 0.14, 5, 'glint', { ...o, lit: true }));
    if (E.lid > 0) {
      const lid: V3[] = [];
      for (let k = 0; k <= 8; k++) {
        const th = Math.PI * (k / 8);
        lid.push(add(add(add(p, scale(n, 0.016)), scale(side3, Math.cos(th) * r * 1.16)), scale(up, Math.sin(th) * r * 1.22)));
      }
      const cutAt = r * (1.2 - 2.3 * E.lid);
      for (let k = 8; k >= 0; k--) {
        const th = Math.PI * (k / 8);
        lid.push(add(add(add(p, scale(n, 0.016)), scale(side3, Math.cos(th) * r * 1.16)), scale(up, cutAt - Math.sin(th) * r * 0.12)));
      }
      out.push({ ...facing(lid, n, 'mark'), at });
      out.push(disc(add(add(p, scale(n, 0.02)), scale(up, cutAt - r * 0.06)), n, r * 1.1, r * 0.14, 8, 'lid', o));
    }
  }
  // Every corner laid onto the skull's curve, each layer a hair over the last.
  const S = s.head.skull;
  return paint(out.map((d, q) => ({ ...d, v: d.v.map((v) => { const e = onEgg(S.c, S.r, sub(v, S.c)); return add(e.p, scale(e.n, 0.008 + 0.002 * (q % 6))); }) })));
}

/**
 * The skull: cream, with the tan of its coat over the crown and down between
 * the eyes to the muzzle, which is what the sheet's face is; and its eyes.
 */
function headOf(s: Goat, n: number, k: number, shut: boolean): Mesh {
  const S = s.head.skull;
  // Tan over the crown, the back of the head and down the brow in a light brown blaze; cream round the eyes and the cheeks.
  const skull = painted(orb(S.c, S.r, n + 5, k + 3, 'coat'), (c) => {
    const d = unit([(c[0] - S.c[0]) / S.r[0], (c[1] - S.c[1]) / S.r[1], (c[2] - S.c[2]) / S.r[2]]);
    if (Math.abs(d[0]) < 0.3 && d[1] > 0.45 && d[2] > 0.05) return 'belly';
    return d[1] > -0.1 && d[2] < 0.42 ? 'mark' : 'coat';
  });
  return merge(skull, eyesOf(s, shut));
}

/** A mesh with each face given its stuff by where its middle is. */
function painted(m: Mesh, by: (c: V3) => Mat): Mesh {
  return mesh(m.v, m.f.map((f) => {
    const c: V3 = [0, 0, 0];
    for (const i of f.i) { c[0] += m.v[i][0] / f.i.length; c[1] += m.v[i][1] / f.i.length; c[2] += m.v[i][2] / f.i.length; }
    return { ...f, m: by(c) };
  }));
}

/** The muzzle: an egg out of the front of the skull, cream, a light brown blaze down its top, a small nose and a smile. */
function muzzleMesh(s: Goat, n: number, k: number): Mesh {
  const M = s.head.muzzle;
  const [x, y] = muzzleFrame(s);
  // The blaze: light brown along the top of the muzzle.
  const muzzle = painted(orbAlong(M.c, M.dir, M.r, n + 2, k + 1, 'mark'), (c) => {
    const d = sub(c, M.c), up = dot(d, y) / M.r[1], sd = dot(d, x) / M.r[0];
    return up > 0.55 && Math.abs(sd) < 0.6 ? 'belly' : 'mark';
  });
  const tip = onMuzzle(s, [0, 0.35, 1]), nr = M.r[0] * 0.38;
  const nose = paint([facing([0, 1, 2, 3, 4, 5, 6].map((q) => {
    const t = Math.PI / 2 + (q / 7) * TAU;
    return add(add(add(tip.p, scale(tip.n, 0.014)), scale(x, Math.cos(t) * nr * (1 - 0.38 * Math.max(0, Math.sin(t))))), scale(y, Math.sin(t) * nr * 0.8 * (Math.sin(t) > 0 ? 0.55 : 1)));
  }), tip.n, 'nose')]);
  const mouth = onMuzzle(s, [0, -0.45, 0.9]);
  return merge(muzzle, nose, smile(add(mouth.p, scale(mouth.n, -0.01)), mouth.n, M.r[0] * 0.75, 'lid'));
}

/** The chin, on the jaw's bone, so a chew shows: a small egg under the end of the muzzle. */
function chinOf(s: Goat, n: number, k: number): Mesh {
  const c = onMuzzle(s, [0, -0.7, 0.2]).p;
  return orbAlong(add(c, [0, -0.02, 0.06]), [0, 1, -0.3], [s.head.muzzle.r[0] * 0.6, s.head.muzzle.r[1] * 0.42, s.head.muzzle.r[2] * 0.5], n, k, 'mark');
}

/**
 * An ear: a long soft leaf, tan outside and pink inside, built upright facing
 * forward and cupped so its lining shows; its tip drooping, which, held out
 * to the side, hangs it down as a kid's floppy ear.
 */
function earOf(s: Goat, n: number): Mesh {
  const { len, w, droop } = s.ear;
  const spine = curve([0, 0, 0], [len * droop * 0.2, 0.05, len * 0.5], [len * droop, -0.02, len * 0.95], 4);
  const ws = [w * 0.5, w * 0.95, w, w * 0.78, 0.03];
  const cup = (p: V3): V3 => [p[0], p[1] + 0.32 * w * (p[0] / w) ** 2, p[2]];
  const shell = tube(spine, ws, ws.map((x) => Math.max(0.025, x * 0.22)), n, 'coat', { up: [0, 1, 0], seam: 'start' });
  const edge = (sd: number): V3[] => [1, 2, 3].map((q) => cup([spine[q][0] + sd * ws[q] * 0.62, ws[q] * 0.22 + 0.016, spine[q][2]]));
  return merge(mesh(shell.v.map(cup), shell.f), paint([{ v: [cup([0, 0.03, len * 0.08]), ...edge(-1), cup([spine[4][0], 0.03, len * 0.88]), ...edge(1).reverse()], m: 'inner' }]));
}

/* ---- the horns ------------------------------------------------------------------------------ */

/**
 * The line of the right horn, in the head's frame, `N + 1` points from root to
 * tip: up out of the crown, sweeping back in an arc over the neck as a
 * goat's does, flaring out from the head as it goes; and its thickness at each
 * point, tapering to the tip.
 */
function hornLine(s: Goat, N: number): { pts: V3[]; r: number[] } {
  const h = s.horn, root = hornRoot(s), pts: V3[] = [], r: number[] = [];
  let p: V3 = sub(root, [0.02, 0, 0.05]);
  for (let q = 0; q <= N; q++) {
    const u = q / N;
    pts.push(p);
    r.push(h.r * (1 - 0.78 * u ** 1.1));
    const th = (h.rise + h.sweep * u ** 1.25) * DEG, step = h.len / N;
    p = add(p, [h.flare / N * (1 + u), -Math.sin(th) * step, Math.cos(th) * step]);
  }
  return { pts, r };
}

/** Where a point `u` along the horn is, how thick, and which way it runs. */
function hornAt(line: { pts: V3[]; r: number[] }, u: number): { p: V3; r: number; d: V3 } {
  const N = line.pts.length - 1, x = clamp(u) * N, k = Math.min(N - 1, Math.floor(x)), f = x - k;
  const p: V3 = add(line.pts[k], scale(sub(line.pts[k + 1], line.pts[k]), f));
  return { p, r: lerp(line.r[k], line.r[k + 1], f), d: unit(sub(line.pts[k + 1], line.pts[k])) };
}

/** Where it butts with, in the head's frame: the brow between the roots of its horns, a little ahead of it. */
const browOf = (s: Goat): V3 => add(onSkull(s, [0, 0.75, 0.66]).p, [0, s.horn.r + 0.1, 0]);

/**
 * The right horn: brown, ridged -- every other ring swollen and darker -- and
 * on the Floracrux a vine wound round it with leaves and flowers on it. The
 * left is its mirror.
 */
function hornOf(s: Goat, n: number, fine: boolean): Mesh {
  const N = s.horn.len > 1 ? (fine ? 20 : 14) : (fine ? 8 : 6), line = hornLine(s, N);
  const rs = line.r.map((r, q) => r * (q % 2 && q < N ? 1.1 : 1));
  const horn = tube(line.pts, rs, rs, n, (ring) => (ring % 2 ? 'hornDark' : 'horn'), { seam: 'start' });
  if (!s.horn.wound) return horn;
  // The vine round it: a helix from near the root to two thirds along, a leaf here and there and three flowers.
  const turns = 3.2, K = fine ? 40 : 24, helix: V3[] = [], out: Mesh[] = [];
  for (let k = 0; k <= K; k++) {
    const u = 0.06 + 0.62 * (k / K), a = hornAt(line, u), [x, y] = across(a.d), th = (k / K) * turns * TAU;
    helix.push(add(a.p, add(scale(x, Math.cos(th) * a.r * 1.05), scale(y, Math.sin(th) * a.r * 1.05))));
  }
  out.push(vine(helix, 0.028, 3));
  for (let q = 0; q < 4; q++) {
    const u = 0.14 + 0.16 * q, a = hornAt(line, u), [x, y] = across(a.d), th = q * 2.1 + 0.6;
    const o = add(scale(x, Math.cos(th)), scale(y, Math.sin(th)));
    const at = add(a.p, scale(o, a.r * 1.08));
    if (q % 2 === 0) {
      const [pm, hm] = BLOOMS[(q / 2 + 1) % BLOOMS.length];
      out.push(flowerOf(add(at, scale(o, 0.04)), add(o, [0, 0, 0.4]), 0.13, pm, hm, fine, q));
    }
    out.push(leafOf(at, add(o, scale(a.d, 0.6)), add(o, [0, 0, 0.5]), 0.22, 0.07));
  }
  return merge(horn, ...out);
}

/* ---- what it wears --------------------------------------------------------------------------- */

/**
 * The crown, in the head's frame: an arc of small flowers -- white, pink and
 * yellow in turn -- over the brow from one side of its head to the other, in
 * front of its horns, each with a leaf or two behind it.
 */
function crownOf(s: Goat, fine: boolean): Mesh {
  const C = s.crown, out: Mesh[] = [];
  for (let q = 0; q < C.n; q++) {
    const f = C.n > 1 ? q / (C.n - 1) : 0.5, a = lerp(-1.25, 1.25, f);
    const dir: V3 = [Math.sin(a) * 0.95, 0.1 + 0.1 * Math.cos(a), 0.75 + 0.25 * Math.cos(a)];
    const e = onSkull(s, dir);
    const r = C.r * (0.85 + 0.3 * jitter(q + 3)) * (Math.abs(a) < 0.5 ? 1.12 : 1);
    const [pm, hm] = BLOOMS[q % 3];
    const n = unit(add(e.n, [0, 0.55, 0.15]));
    out.push(flowerOf(add(e.p, scale(e.n, r * 0.45)), n, r, pm, hm, fine, q * 0.9));
    const back = unit(add(scale(e.n, 0.5), [0, -1, 0.25]));
    out.push(leafOf(add(e.p, scale(e.n, r * 0.2)), add(back, [Math.sin(a) * 0.6, 0, 0]), e.n, r * 2.3, r * 0.7));
  }
  return merge(...out);
}

/** The beard: on the Meadowtide a tuft of leaves under its chin, on the Floracrux a long flowing cream beard; in the jaw's frame. */
function beardOf(s: Goat, n: number): Mesh | null {
  const chin = onMuzzle(s, [0, -0.85, 0.2]).p, out: Mesh[] = [];
  if (s.leafBeard) {
    for (let q = 0; q < 5; q++) {
      const sd = (q - 2) / 2;
      out.push(leafOf(add(chin, [sd * 0.08, -0.04 * Math.abs(sd), 0]), [sd * 0.3, -0.25, -1], [sd * 0.4, 1, 0.1], s.leafBeard * (1 - 0.25 * Math.abs(sd)), s.leafBeard * 0.24, q % 2 ? ['leafDark', 'leaf', 'leafDark'] : ['leaf', 'leafDark', 'leafDark']));
    }
  }
  if (s.beard) {
    const L = s.beard;
    for (let q = 0; q < 9; q++) {
      const sd = ((q % 5) - 2) / 2, row = q < 5 ? 0 : 1;
      const root = add(chin, [sd * 0.12, -0.14 * row - 0.05 * Math.abs(sd), 0.02]);
      out.push(tuftOf(root, [sd * 0.18, -0.35 - 0.1 * row, -1], L * (1 - 0.3 * Math.abs(sd)) * (row ? 0.82 : 1), 0.1 - 0.02 * row, q % 3 ? 'mark' : 'muzzle', [0, -0.6, -0.4], n));
    }
  }
  return out.length ? merge(...out) : null;
}

/**
 * The leaves round its shoulders, in the collar's frame: rows of leaves round
 * the root of its neck, lying back and down over the shoulders and the top
 * of the chest, longer the further down; and flowers among them, mostly at
 * the front and the sides.
 */
function collarOf(s: Goat, fine: boolean): Mesh {
  const C = s.collar, out: Mesh[] = [];
  for (let r = 0; r < C.rows; r++) {
    for (let q = 0; q < C.count; q++) {
      const id = r * 41 + q, th = ((q + 0.5 * r) / C.count) * TAU + 0.2 * (jitter(id) - 0.5);
      // Each row further down and further back over the shoulders and the withers, the leaves on the back and the sides lying
      // back along it, those at the front hanging down over the chest.
      const back = Math.max(0, Math.sin(th)), at = onNeck(s, 0.08 - r * C.len * 0.32, th, -0.04 + r * 0.07);
      const root = add(at.p, [0, -r * C.len * 0.42 * (0.3 + 0.7 * back), r * C.len * 0.12 * back]);
      // At the front they stand out round the throat as a collar does rather than hanging down the chest as a bib.
      const front = Math.max(0, -Math.sin(th));
      const dn = unit(add(scale(at.n, 0.5 + 0.5 * front), [0, -0.3 - 0.75 * back, -0.7 + 0.3 * back + 0.25 * front]));
      const L = C.len * (0.8 + 0.25 * jitter(id + 3)) * (1 + 0.2 * r) * (1 - 0.4 * front);
      out.push(leafOf(root, dn, add(at.n, [0, 0, 0.8]), L, C.w * (0.9 + 0.2 * jitter(id + 5)), id % 3 ? ['leaf', 'leafDark', 'leafDark'] : ['moss', 'leafDark', 'leafDark'], 0, 0.1));
    }
  }
  for (let q = 0; q < C.flowers; q++) {
    // Round the front and the sides; none on the back of the neck, where the mane is.
    const f = C.flowers > 1 ? q / (C.flowers - 1) : 0.5, th = lerp(0.15, -Math.PI - 0.15, f) + 0.15 * (jitter(q + 70) - 0.5);
    const at = onNeck(s, -C.len * 0.25 - 0.08 * (q % 2), th, 0.02 + C.w * 0.3);
    const r = C.w * (0.85 + 0.25 * jitter(q + 9)) * (s.stage ? 0.9 : 1.05);
    const [pm, hm] = BLOOMS[(q + 1) % BLOOMS.length];
    out.push(flowerOf(at.p, add(at.n, [0, 0.35, 0.35]), r, pm, hm, fine, q));
  }
  return merge(...out);
}

/** The braided vine round the root of its neck, under the leaves, in the collar's frame. */
function collarVine(s: Goat, n: number): Mesh {
  const K = 14, pts = Array.from({ length: K + 1 }, (_, q) => onNeck(s, -0.02 - 0.04 * Math.cos((q / K) * TAU + Math.PI / 2), (q / K) * TAU, 0.02).p);
  return vine([...pts, pts[1]], 0.035 + 0.01 * s.stage, n);
}

/**
 * The straps across its chest, in the trunk's frame: two braided vines from
 * either side of its withers, crossing over the front of its chest and going
 * back under its belly behind its fore legs -- on the Briarling its collar's
 * straps, on the others the basket's harness.
 */
function strapsOf(s: Goat, n: number): Mesh {
  const out: Mesh[] = [], C = chestEgg(s);
  const K = 12, r = 0.032 + 0.012 * s.stage;
  for (const sd of [1, -1]) {
    const pts: V3[] = [];
    for (let k = 0; k <= K; k++) {
      const u = k / K;
      // From the top of one shoulder across the front of the chest, crossing the other in the middle, to low on the other side.
      const dir: V3 = [sd * lerp(0.85, -0.85, u), 0.3 + 0.8 * Math.sin(Math.PI * u), lerp(0.6, -0.55, u)];
      const e = onEgg(C.c, C.r, dir);
      pts.push(add(e.p, scale(e.n, r + 0.01)));
    }
    out.push(vine(pts, r, n));
  }
  return merge(...out);
}

/** The front of the chest as an egg, in the trunk's frame: what the straps lie on. */
function chestEgg(s: Goat): { c: V3; r: V3 } {
  const B = s.body;
  return { c: [0, B.y[5] - 0.12, B.z[5] + 0.04], r: [B.w[5] * 1.0, (B.y[6] - B.y[4]) * 0.5, B.h[5] * 0.92] };
}

/**
 * The basket on its back, in the trunk's frame: a round-bottomed bowl of
 * brown wicker woven over and under, a thick rim, sitting on its back with its
 * bottom down into the coat.
 */
function basketOf(s: Goat, n: number): Mesh {
  const K = s.basket!, c = basketAt(s), N = n + 4, R = K.R, H = K.H;
  const zs = [-H, -H * 0.9, -H * 0.76, -H * 0.6, -H * 0.44, -H * 0.28, -H * 0.13, 0], rs = [R * 0.46, R * 0.7, R * 0.86, R * 0.95, R, R * 1.02, R * 1.03, R * 1.04];
  const bowl = tube(zs.map((z) => add(c, [0, 0, z])), rs, rs.map((x) => x * 0.88), N * 2, (ring, j) => ((ring + j) % 2 ? 'wood' : 'woodDark'), { end: false });
  const rim = tube(Array.from({ length: N + 1 }, (_, q): V3 => add(c, [Math.cos((q / N) * TAU) * R * 1.06, Math.sin((q / N) * TAU) * R * 0.94, 0.01])), 0.06 + 0.02 * s.stage, 0.06 + 0.02 * s.stage, 4, (ring) => (ring % 2 ? 'wood' : 'woodDark'), { start: false, end: false });
  return merge(bowl, rim);
}

/** The basket's girth, in the trunk's frame: a braided vine round the barrel under the basket's middle. */
function girthOf(s: Goat): Mesh {
  const c = basketAt(s), G = 14, pts = Array.from({ length: G + 1 }, (_, q) => {
    const th = (q / G) * TAU, e = onBody(s, c[1] + s.basket!.R * 0.1, th);
    return add(e.p, scale(e.n, 0.03));
  });
  return vine(pts, 0.035 + 0.01 * s.stage, 4);
}

/**
 * What is in the basket, heaped over its rim: a mound of green, spikes of
 * lavender standing up and leaning out, flowers -- yellow, pink and white --
 * all over the top of it, and on the Floracrux fern fronds curling out over
 * the rim. In the trunk's frame, with the rim's middle at `basketAt`.
 */
function heapOf(s: Goat, fine: boolean, n: number): Mesh {
  const K = s.basket!, c = basketAt(s), R = K.R, out: Mesh[] = [];
  out.push(orbAlong(add(c, [0, 0, K.heap * 0.06]), [0, 0, 1], [R * 0.98, R * 0.9, K.heap * 0.44], n + 2, 3, 'leafDark'));
  for (let q = 0; q < K.lavender; q++) {
    const a = q * 2.399 + 0.4, rr = R * (0.25 + 0.6 * jitter(q + 11));
    const root = add(c, [Math.cos(a) * rr, Math.sin(a) * rr * 0.9, K.heap * 0.15]);
    const lean = 0.2 + 0.5 * (rr / R);
    out.push(lavenderOf(root, [Math.cos(a) * lean, Math.sin(a) * lean * 0.8 - 0.25, 1], K.heap * (0.5 + 0.45 * jitter(q + 13)), 0.036 + 0.01 * s.stage, fine ? 5 : 4));
  }
  // Drawn small, fewer flowers, each a little bigger.
  const F = fine ? K.flowers : Math.round(K.flowers * 0.75), big = fine ? 1 : 1.12;
  for (let q = 0; q < F; q++) {
    // Over the whole top of the heap, the outermost spilling over the rim.
    const a = q * 2.399 + 1.7, rr = R * (0.15 + 0.98 * Math.sqrt((q + 0.5) / F));
    const h = K.heap * (0.5 - 0.42 * (rr / R) ** 2) + 0.05 * jitter(q + 21);
    const at = add(c, [Math.cos(a) * rr, Math.sin(a) * rr * 0.92, h]);
    const out3: V3 = [Math.cos(a) * 0.6 * (rr / R), Math.sin(a) * 0.6 * (rr / R), 1];
    const [pm, hm] = BLOOMS[q % BLOOMS.length];
    out.push(flowerOf(at, out3, big * (0.13 + 0.035 * s.stage) * (0.85 + 0.3 * jitter(q + 31)), pm, hm, fine, q));
    if (q % 3 === 0) out.push(leafOf(at, [Math.cos(a), Math.sin(a), 0.2], [0, 0, 1], 0.24 + 0.06 * s.stage, 0.08 + 0.02 * s.stage));
  }
  for (let q = 0; q < K.ferns; q++) {
    const a = (q / K.ferns) * TAU + 0.5, root = add(c, [Math.cos(a) * R * 0.75, Math.sin(a) * R * 0.7, K.heap * 0.1]);
    out.push(frondOf(root, [Math.cos(a) * 1.0, Math.sin(a) * 1.0, 0.75], [Math.cos(a) * 0.4, Math.sin(a) * 0.4, 1], 1.05, fine ? 7 : 4));
  }
  return merge(...out);
}

/**
 * The cloak of big leaves down one flank, `side` its side, in the trunk's
 * frame: two rows of big toothed leaves laid along the top of its back from
 * the shoulder to past the rump, hanging down its side and trailing back,
 * the last ones out behind it.
 */
function cloakOf(s: Goat, side: number): Mesh {
  const C = s.cloak!, out: Mesh[] = [];
  for (let r = 0; r < 2; r++) {
    for (let q = 0; q < C.n; q++) {
      const u = (q + 0.5 * r) / C.n, y = lerp(s.body.y[4] - 0.05, s.body.y[1] - 0.1, u);
      const th = 1.25 - 0.45 * r, e = onBody(s, y, th), root = add(e.p, scale(e.n, 0.08 + 0.03 * r));
      // Laid down the flank and back toward the tail, the hindmost trailing out behind.
      const dir: V3 = [0.16, -0.45 - 1.1 * u * u, -1];
      const L = C.len * (0.7 + 0.5 * u) * (r ? 0.82 : 1);
      const m: readonly [Mat, Mat, Mat] = (q + r) % 2 ? ['leafDark', 'leaf', 'leafDark'] : ['leaf', 'leafDark', 'leafDark'];
      const leaf = leafOf(root, dir, [1, 0, 0.1], L, L * 0.3, m, 4, 0.14, 'moss', 0.4);
      out.push(side > 0 ? leaf : mirrorX(leaf));
    }
  }
  return merge(...out);
}

/** The cuffs of shaggy fur round a lower leg, below the knee, in its bone's frame, and a vine wound down it on the Floracrux. */
function legFur(s: Goat, lower: number, seed: number, n: number): Mesh {
  const out: Mesh[] = [], R = s.thick * 0.55, L = s.shag.leg;
  // The trousers: a ring of round puffs at the top of the lower leg, and soft locks hanging from under them.
  const top = n > 3 ? 6 : 4, low = n > 3 ? 5 : 3;
  for (let q = 0; q < (L ? top + low : 0); q++) {
    const ring = q < top ? 0 : 1, k = ring ? q - top : q, m = ring ? low : top;
    const id = seed + q, th = ((k + 0.5 * ring) / m) * TAU + 0.4 * jitter(id);
    if (!ring) {
      const r = L * (0.42 + 0.12 * jitter(id + 3));
      out.push(puffOf([Math.cos(th) * R * 0.85, Math.sin(th) * R * 0.85, lower * 0.04], [r, r, r * 1.15], n, 'mark'));
      continue;
    }
    const root: V3 = [Math.cos(th) * R * 0.9, Math.sin(th) * R * 0.9, -lower * 0.1];
    out.push(tuftOf(root, [Math.cos(th) * 0.35, Math.sin(th) * 0.35, -1], L * (0.75 + 0.3 * jitter(id + 3)), s.thick * 0.42, 'mark', [0, 0, -1], n));
  }
  if (s.wraps) {
    const K = 16, pts: V3[] = [];
    for (let k = 0; k <= K; k++) {
      const u = k / K, th = u * 2.5 * TAU + seed;
      pts.push([Math.cos(th) * R * 1.32, Math.sin(th) * R * 1.32, -lower * (0.4 + 0.5 * u)]);
    }
    out.push(vine(pts, 0.026, 3), leafOf(pts[4], [Math.cos(seed) * 0.6, 0.4, -0.6], [Math.cos(seed), Math.sin(seed), 0.3], 0.2, 0.07));
  }
  return merge(...out);
}

/**
 * The shaggy cream fur: a fringe down each flank under the belly line --
 * long, to the hocks, on the Floracrux -- and a bib of it over the chest.
 * `side` one side's fringe, nought the chest's bib (in the collar's frame).
 */
function shagOf(s: Goat, side: number, n: number): Mesh {
  const out: Mesh[] = [], B = s.body;
  if (side === 0) {
    // Round puffs of fluff over the front of the chest, and soft locks hanging from under them.
    const L = s.shag.chest, N = 6 + s.stage * 2, P = L * 0.45 + 0.04;
    for (let q = 0; q < N; q++) {
      const f = N > 1 ? q / (N - 1) : 0.5, th = lerp(-0.3, -Math.PI + 0.3, f), front = Math.max(0, -Math.sin(th));
      const at = onNeck(s, -0.1 - 0.12 * front, th, P * 0.2);
      out.push(puffOf(at.p, [P * (0.9 + 0.3 * front), P * (0.9 + 0.3 * front), P * (0.8 + 0.2 * jitter(q))], n, jitter(q + 40) > 0.2 ? 'mark' : 'muzzle'));
      for (const r of n > 3 ? [0, 1] : [0]) {
        const lo = onNeck(s, -0.2 - r * L * 0.5 - 0.15 * front, th + 0.18 * r, -0.02);
        out.push(tuftOf(lo.p, add(scale(lo.n, 0.35), [0, 0.1, -1]), L * (0.8 + 0.4 * jitter(q * 3 + r)) * (0.7 + 0.5 * front), 0.06 + 0.04 * s.stage + 0.04 * front, 'mark', [0, 0.3, -1], n));
      }
    }
    return merge(...out);
  }
  // The kid and the young goat: a fringe of round puffs of fluff along the belly, overlapping, cream, a tan one here and there.
  if (s.stage < 2) {
    const N = 12 + 2 * s.stage, P = s.shag.skirt;
    for (let q = 0; q < N; q++) {
      const id = q * 5 + (side > 0 ? 0 : 2), y = lerp(B.y[1] + 0.05, B.y[5] - 0.1, q / (N - 1)) + 0.06 * (jitter(id) - 0.5);
      const th = -0.5 - 0.3 * jitter(id + 4) + 0.1 * (jitter(id + 1) - 0.5), e = onBody(s, y, th);
      const r = P * (0.8 + 0.5 * jitter(id + 2));
      const puff = puffOf(add(e.p, scale(e.n, r * 0.15)), [r * 0.9, r * 1.2, r * 0.82], n, jitter(id + 3) > 0.25 ? 'mark' : 'muzzle');
      out.push(side > 0 ? puff : mirrorX(puff));
    }
    return merge(...out);
  }
  const L = s.shag.skirt, N = n > 3 ? 12 : 10, rows = 3;
  for (let r = 0; r < rows; r++) {
    for (let q = 0; q < N; q++) {
      const id = q * 7 + r * 31 + (side > 0 ? 0 : 3), y = lerp(B.y[1] + 0.05, B.y[5] - 0.05, (q + 0.5 * (r % 2)) / Math.max(1, N - 1));
      // The top row highest on the flank, the rest under it toward the belly, each a little shorter.
      const th = 0.15 - 0.32 * r + 0.1 * (jitter(id) - 0.5), e = onBody(s, Math.min(B.y[5] - 0.1, y), th);
      const root = add(e.p, scale(e.n, -0.03));
      // Short at the chest, so the fore legs and the chest read; longest at the flank and the rump, to the hocks; the hem uneven.
      const along = clamp((y - B.y[1]) / (B.y[5] - B.y[1])), reach = lerp(1.15, 0.42, smooth(along));
      const len = L * reach * (0.6 + 0.65 * jitter(id + 1)) * (1 - 0.15 * r);
      // Tan on the top row, as the coat it grows from, going to cream under it.
      const mat: Mat = r === 0 ? (jitter(id + 2) > 0.6 ? 'coat' : 'belly') : r === 1 ? (jitter(id + 2) > 0.8 ? 'belly' : 'mark') : jitter(id + 2) > 0.3 ? 'mark' : 'muzzle';
      const tuft = tuftOf(root, [0.3 - 0.08 * r, -0.12, -1], len, 0.21 * (0.85 + 0.3 * jitter(id + 4)), mat, [0, -0.25, -1], n);
      out.push(side > 0 ? tuft : mirrorX(tuft));
    }
  }
  return merge(...out);
}

/**
 * The mane down the front and sides of the neck, in the neck's frame: cream
 * fur hanging from it, longer toward the chest, on the Meadowtide short and
 * on the Floracrux long and flowing into its beard and its chest.
 */
function maneOf(s: Goat, n: number): Mesh {
  const out: Mesh[] = [], w = s.neck.w, len = s.neck.len, L = s.shag.chest * 0.9;
  const lean = s.neck.lean * DEG, down: V3 = [0, Math.sin(lean) + 0.25, -Math.cos(lean)];
  const rows = 2 + s.stage + (n > 3 ? 1 : 0);
  for (let r = 0; r < rows; r++) {
    const z = len * lerp(0.85, 0.12, r / (rows - 1));
    for (let q = 0; q < 5; q++) {
      const th = lerp(-0.25, Math.PI + 0.25, q / 4) + 0.2 * (r % 2), x = Math.cos(th), y = Math.sin(th);
      const root: V3 = [x * w * 0.85, y * w * 0.85, z];
      const id = r * 11 + q;
      out.push(tuftOf(root, add(scale(down, 1), [x * 0.35, y * 0.2, 0]), L * (0.6 + 0.25 * r / rows + 0.3 * jitter(id)), w * 0.32, jitter(id + 2) > 0.25 ? 'mark' : 'muzzle', down, n));
    }
  }
  return merge(...out);
}

/** A clump of wildflowers on the grass where it works: a few blooms on stems among leaves. Its bone is on the grass. */
function clumpOf(s: Goat, fine: boolean): Mesh {
  const out: Mesh[] = [], k = 0.75 + 0.25 * s.stage;
  for (let q = 0; q < 5; q++) {
    const a = q * 2.4 + 0.3, rr = 0.1 + 0.12 * jitter(q + 2);
    const root: V3 = [Math.cos(a) * rr * k, Math.sin(a) * rr * k, 0];
    out.push(leafOf(root, [Math.cos(a), Math.sin(a), 1.4], [Math.cos(a), Math.sin(a), 0.3], 0.26 * k, 0.07 * k));
  }
  for (let q = 0; q < 3; q++) {
    const a = q * 2.1 + 1.4, root: V3 = [Math.cos(a) * 0.14 * k, Math.sin(a) * 0.12 * k, 0], top = add(root, [Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0.24 * k]);
    const [pm, hm] = BLOOMS[(q + 2) % BLOOMS.length];
    out.push(tube([root, top], 0.016, 0.016, 3, 'stem'), flowerOf(top, [Math.cos(a) * 0.4, Math.sin(a) * 0.4 + 0.3, 1], 0.1 * k, pm, hm, fine, q));
  }
  return merge(...out);
}

/** The flower it picks, on its stem: built standing up its bone, the bloom at the top facing forward and up. */
function pickedOf(s: Goat, fine: boolean): Mesh {
  const k = 0.8 + 0.3 * s.stage, top: V3 = [0, 0.02, 0.26 * k];
  return merge(tube([[0, 0, 0], top], 0.022, 0.022, 3, 'stem'), leafOf([0, 0, 0.1 * k], [0.6, 0.2, 0.8], [1, 0, 0.3], 0.14 * k, 0.05 * k), flowerOf(top, [0, 0.6, 1], 0.2 * k, 'bloom', 'spot', fine, 0.3));
}

/* ---- its pieces -------------------------------------------------------------------------------- */

/** Where its chains of wisteria and its bell hang, each from its own bone (`goatBones`): from the collar and from the basket's rim. */
function dropsOf(s: Goat): Drop[] {
  const out: Drop[] = [];
  const C = s.chains;
  for (let q = 0; q < C.neck; q++) {
    const sd = q % 2 ? -1 : 1, at = onNeck(s, -0.05, sd > 0 ? -0.6 : -Math.PI + 0.6, s.neck.w * 0.3).p;
    out.push({ bone: 'collar', at, len: C.len * 0.7, r: 0.13, side: sd, id: out.length + 1 });
  }
  if (s.basket && C.side) {
    const c = basketAt(s), R = s.basket.R;
    for (const sd of [1, -1]) {
      for (let q = 0; q < C.side; q++) {
        const a = lerp(-0.85, 0.85, C.side > 1 ? q / (C.side - 1) : 0.5);
        const at: V3 = [sd * Math.cos(a) * R * 1.02, c[1] + Math.sin(a) * R * 0.92, c[2] - 0.04];
        out.push({ bone: 'trunk', at, len: C.len * (1 - 0.25 * Math.abs(a)), r: 0.15, side: sd, id: out.length + 1 });
      }
    }
  }
  if (s.bell) out.push({ bone: 'collar', at: onNeck(s, -0.08, -Math.PI / 2, 0.04).p, len: s.bell * 1.8, r: s.bell, side: 0, id: out.length + 1, bell: true });
  return out;
}

/** A stage's pieces: a goat's body (`quadPieces`) with its own head, and its horns, ears, flowers, leaves, fur and what it carries. */
function goatBuild(s: Goat, drops: readonly Drop[], lod: number): Piece[] {
  const fine = lod > 0;
  const n = cut(lod, 7, 10), k = cut(lod, 5, 6), tn = cut(lod, 3, 6);
  const skull = skullOf(s);
  const B = s.body;
  const extras: Piece[] = [
    { key: 'muzzle', mesh: muzzleMesh(s, n, k), bone: 'head', bias: 0.205, after: ['head'], front: [0, 1, 0], lines: false },
    { key: 'chin', mesh: chinOf(s, n - 1, k - 1), bone: 'jaw', bias: 0.2, after: ['head'], under: ['muzzle'], lines: false },
    { key: 'crown', mesh: crownOf(s, fine), bone: 'head', bias: 0.24, after: ['head', 'horn0', 'horn1', 'muzzle'], hide: [skull], thin: true },
    { key: 'collarVine', mesh: collarVine(s, 4), bone: 'collar', bias: 0.07, after: ['neck', 'body'], hide: [{ c: [0, 0, 0.05], r: [s.neck.w * 0.9, s.neck.w * 0.9, s.neck.w] }], thin: true },
    { key: 'collar', mesh: collarOf(s, fine), bone: 'collar', bias: 0.085, after: ['neck', 'body', 'collarVine', 'straps', 'chest'], hide: [{ c: [0, s.neck.w * 0.2, s.neck.len * 0.25], r: [s.neck.w * 0.85, s.neck.w * 0.85, s.neck.len * 0.5] }], thin: true },
    { key: 'chest', mesh: shagOf(s, 0, tn), bone: 'collar', bias: 0.075, after: ['neck', 'body'], front: [0, 1, -0.2], ...FLUFF },
    { key: 'straps', mesh: strapsOf(s, 4), bone: 'trunk', bias: 0.06, after: ['body', 'chest'], front: [0, 1, 0], hide: bodySolids(s, 0.98), thin: true },
  ];
  for (const [side, key] of s.shag.skirt ? [[1, 'skirtR'], [-1, 'skirtL']] as const : []) {
    extras.push({ key, mesh: shagOf(s, side, tn), bone: 'trunk', bias: 0.04, after: ['body'], front: [side, 0, 0], hide: bodySolids(s, 0.96), ...FLUFF, bent: hanging(B.z[3], 0.05) });
  }
  if (s.stage) extras.push({ key: 'mane', mesh: maneOf(s, tn), bone: 'neck', bias: 0.012, after: ['neck'], under: ['head', 'muzzle'], hide: [{ c: [0, -s.neck.w * 0.2, s.neck.len * 0.5], r: [s.neck.w * 0.85, s.neck.w * 0.8, s.neck.len * 0.7] }], ...FLUFF });
  const beard = beardOf(s, tn);
  if (beard) extras.push({ key: 'beard', mesh: beard, bone: 'jaw', bias: 0.19, after: ['chest', 'collar', 'neck'], under: ['muzzle', 'chin'], front: [0, 1, 0], ...(s.beard ? FLUFF : {}) });
  if (s.basket) {
    extras.push(
      { key: 'girth', mesh: girthOf(s), bone: 'trunk', bias: 0.05, after: ['body', 'straps'], hide: bodySolids(s, 0.98), thin: true },
      { key: 'basket', mesh: basketOf(s, n), bone: 'trunk', bias: 0.06, after: ['body', 'straps', 'girth'] },
      { key: 'heap', mesh: heapOf(s, fine, n), bone: 'trunk', bias: 0.065, after: ['basket'], thin: true, bent: swaying(basketAt(s)[2], 0.06) },
    );
  }
  if (s.cloak) {
    for (const [side, key] of [[1, 'cloakR'], [-1, 'cloakL']] as const) {
      extras.push({ key, mesh: cloakOf(s, side), bone: 'trunk', bias: 0.055, after: ['body', `skirt${side > 0 ? 'R' : 'L'}`, 'straps', 'basket'], front: [side, 0, 0.2], hide: bodySolids(s, 1.05), thin: true });
    }
  }
  // Each horn, after the head and over the ear; the far one under the head.
  const horn = hornOf(s, n, fine);
  extras.push(
    { key: 'horn1', mesh: horn, bone: 'head', bias: 0.22, after: ['head'], front: [1, 0, 0], hide: [skull] },
    { key: 'horn0', mesh: mirrorX(horn), bone: 'head', bias: 0.22, after: ['head'], front: [-1, 0, 0], hide: [skull] },
  );
  // The chains and the bell, each on its own bone, hanging; over what they hang from on their own side and under it on the far.
  extras.push(...drops.map((dr, q): Piece => ({
    key: `drop${q}`, mesh: dr.bell ? bellOf(dr.r, n) : wisteriaOf(dr.len, dr.r, fine ? 6 : 5), bone: `drop${q}`, bias: dr.bone === 'collar' ? 0.1 : 0.07,
    after: dr.bone === 'collar' ? ['collar', 'chest', 'neck'] : ['basket', 'heap', `cloak${dr.side > 0 ? 'R' : 'L'}`, 'body'],
    front: dr.bone === 'collar' ? [dr.side * 0.6, 1, 0.2] : [dr.side, 0, 0.3], thin: true,
  })));
  // The flower clump at its feet and the flower it picks, only while it is at its task.
  const working = (a: Anim): boolean => a.act?.kind === 'work' && a.go < 0.5;
  extras.push(
    { key: 'clump', mesh: clumpOf(s, fine), bone: 'clump', bias: 0.02, shown: working, thin: true },
    { key: 'pick', mesh: pickedOf(s, fine), bone: 'pick', bias: 0.25, shown: working, thin: true },
  );
  const legs = (fore: boolean): { upper: [number, number, number, number]; lower: [number, number, number, number]; foot: Mesh; mat: Mat } => {
    const L = fore ? foreLen(s) : hindLen(s), w = s.thick;
    // The upper leg rooted well up inside the barrel and no wider than fits in it, so however it swings its top never shows past it.
    return { upper: [fore ? 0.22 : 0.2, -L, w * (fore ? 1.12 : 1.22), w * 0.95], lower: [0, -L, w * 0.82, w * 0.62], foot: cloven(w * 0.78, s.hoof, n), mat: 'mark' };
  };
  const T = 0.11 + 0.03 * s.stage;
  const tailTuft = merge(orbAlong([0, -T * 0.7, 0.02], [0, -1, 0.4], [T * 0.75, T * 0.7, T * 1.1], n - 1, k - 1, 'coat'), ...[0, 1, 2, 3, 4].map((q) => {
    const a = (q / 5) * TAU;
    return tuftOf([Math.cos(a) * T * 0.4, -T * 0.9, Math.sin(a) * T * 0.4], [Math.cos(a) * 0.5, -1, 0.5 + Math.sin(a) * 0.5], T * 1.5, T * 0.4, q % 2 ? 'mark' : 'coat', [0, 0, 1], tn);
  }));
  const pieces = quadPieces({
    n, k,
    body: { ...B, belly: false },
    neck: { w: s.neck.w, h: s.neck.w * 1.05, len: s.neck.len, mat: 'coat' },
    head: { c: skull.c, r: skull.r, eye: { dir: [0.6, 0.6, 0.4], size: 0.01 } },
    ear: earOf(s, n),
    earTurn: -10,
    tail: [tube(curve([0, 0.04, 0], [0, -0.06, 0.02], [0, -0.1, 0], 2), 0.06 + 0.01 * s.stage, 0.06 + 0.01 * s.stage, 5, 'coat', { seam: 'start' }), tailTuft],
    fore: legs(true),
    hind: legs(false),
    breath: 0.03,
    extras,
  });
  // The fur at each knee, and the vines wound down the Floracrux's legs.
  for (const [key, side, fore] of s.shag.leg || s.wraps ? [['fl', -1, true], ['fr', 1, true], ['hl', -1, false], ['hr', 1, false]] as Array<[string, number, boolean]> : []) {
    const lower = fore ? foreLen(s) : hindLen(s);
    pieces.push({ key: `${key}fur`, mesh: legFur(s, lower, key.charCodeAt(0) * 7 + key.charCodeAt(1), tn), bone: `${key}1`, bias: 0.04, after: [`${key}1`, 'body'], front: [side * 0.7, fore ? 0.7 : -0.7, 0], ...FLUFF });
  }
  return pieces.map((pc) => {
    if (pc.key === 'head') return { ...pc, mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), hide: [skull, muzzleOf(s)] };
    if (pc.key === 'tail1') return { ...pc, ...FLUFF };
    if (pc.key === 'body') return { ...pc, mesh: bodyMesh(s, lod) };
    if (pc.key === 'ear0' || pc.key === 'ear1') return { ...pc, bias: 0.225, after: ['head', pc.key === 'ear0' ? 'horn0' : 'horn1'] };
    return pc;
  });
}

/** How its fur is drawn, as the cloud line's fleece is: no lines inside it, only round the whole, and a light rim along its top edge. */
const FLUFF = { lines: false, sheen: 'eyeWhite' as Mat };

/** Swaying, for what hangs down from the body -- its long coat: each corner moved by as much as it is under `top`, a slow few turns a loop, and back as it goes. */
function hanging(top: number, k: number): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const g = smooth(a.go), sx = k * (cyc(a.t, 3) * (1 - g) + 0.6 * g * Math.sin(frac(a.u) * TAU * 2)), sy = k * 0.5 * cyc(a.t, 2, 1) * (1 - g) - g * k * 1.2;
    return v.map((p) => { const h = Math.max(0, top - p[2]); return [p[0] + sx * h, p[1] + sy * h, p[2]]; });
  };
}

/** Swaying, for what stands up out of the basket: each corner moved across by as much as it is over the rim, a slow few turns a loop. */
function swaying(rim: number, k: number): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const g = smooth(a.go), sx = k * (cyc(a.t, 3) * (1 - g) + g * Math.sin(frac(a.u) * TAU * 2)), sy = k * 0.6 * cyc(a.t, 4, 1) * (1 - g) - g * k * 0.8;
    return v.map((p) => { const h = Math.max(0, p[2] - rim); return [p[0] + sx * h, p[1] + sy * h, p[2]]; });
  };
}

/**
 * The barrel: rings smoothed along it, round in the middle and drawn in to
 * each end, tan over the back and cream under it, the cream coming higher at
 * the chest; and its darker patches, laid on it.
 */
function bodyMesh(s: Goat, lod: number): Mesh {
  const B = s.body, cap = [[-0.07, 0.72], [-0.12, 0.32]] as const;
  const ys = [...cap.map(([dy]) => B.y[0] + dy).reverse(), ...B.y], zs = [B.z[0], B.z[0], ...B.z];
  const ws = [...cap.map(([, k2]) => B.w[0] * k2).reverse(), ...B.w], hs = [...cap.map(([, k2]) => B.h[0] * k2).reverse(), ...B.h];
  const cr = (v: readonly number[], q: number, f: number): number => {
    const a = v[Math.max(0, q - 1)], b = v[q], c = v[q + 1], d = v[Math.min(v.length - 1, q + 2)];
    return b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)));
  };
  const Y: number[] = [], Z: number[] = [], Wd: number[] = [], H: number[] = [];
  for (let q = 0; q < ys.length - 1; q++) {
    for (let k2 = 0; k2 < 3; k2++) {
      const f = k2 / 3, y = cr(ys, q, f), mid = clamp((y - B.y[1]) / (B.y[5] - B.y[1])), swell = 1 + 0.07 * Math.sin(Math.PI * mid);
      Y.push(y); Z.push(cr(zs, q, f)); Wd.push(cr(ws, q, f) * swell); H.push(cr(hs, q, f) * swell);
    }
  }
  Y.push(ys[ys.length - 1]); Z.push(zs[zs.length - 1]); Wd.push(ws[ws.length - 1]); H.push(hs[hs.length - 1]);
  const N = cut(lod, 10, 14);
  // Each facet cream below a height round the barrel that rises from the rump to the chest, a little ragged.
  const mat = (ring: number, j: number): Mat => {
    const t = ((j + 1) / N) * TAU, up = Math.sin(t), y = Y[Math.min(Y.length - 1, ring)];
    const along = clamp((y - B.y[1]) / (B.y[5] - B.y[1]));
    const level = lerp(s.cream[0], s.cream[1], smooth(along)) + 0.12 * (jitter(ring * 3 + j) - 0.5) + (y > B.y[5] ? 0.4 : 0);
    return up < level ? 'mark' : 'coat';
  };
  const barrel = tube(Y.map((y, q) => [0, y, Z[q]] as V3), Wd, H, N, mat);
  // The patches: a ragged round of the darker brown on each side, laid on the barrel.
  const patches: Disc[] = [];
  s.patches.forEach(([u, th0, r], q) => {
    for (const sd of [1, -1]) {
      const y0 = alongBody(s, u), pts: V3[] = [];
      for (let k2 = 0; k2 < 10; k2++) {
        const a = (k2 / 10) * TAU, rr = r * (0.75 + 0.4 * jitter(q * 17 + k2 + (sd > 0 ? 0 : 5)));
        const th = th0 + (Math.sin(a) * rr) / Math.max(0.3, B.h[3]), e = onBody(s, y0 + Math.cos(a) * rr * 1.2, th);
        pts.push(add(e.p, scale(e.n, 0.012)));
      }
      const mid = onBody(s, y0, th0);
      const d = facing(pts, mid.n, 'coatDark');
      patches.push(sd > 0 ? d : { ...d, v: d.v.map((p) => [-p[0], p[1], p[2]] as V3).reverse() });
    }
  });
  return merge(barrel, paint(patches));
}

/** A cloven hoof: two dark toes side by side with a cleft between them. */
function cloven(r: number, h: number, n: number): Mesh {
  return merge(...[-1, 1].map((sd) => tube([[sd * r * 0.42, r * 0.1, 0.04], [sd * r * 0.46, r * 0.2, -h * 0.5], [sd * r * 0.48, r * 0.3, -h]],
    [r * 0.42, r * 0.48, r * 0.5], [r * 0.6, r * 0.74, r * 0.82], n, 'hoof', { seam: 'start' })));
}

/* ---- what it throws about --------------------------------------------------------------- */

const WHITE: RGB = [255, 250, 240];
const PINK: RGB = [246, 170, 198];
const YELLOW: RGB = [252, 214, 96];
const LILAC: RGB = [196, 160, 236];
const GREEN: RGB = [128, 170, 92];
const INK: RGB = [90, 70, 80];
const PETALS: readonly RGB[] = [WHITE, PINK, YELLOW, LILAC];
const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;

/** Whether a point is on the viewer's side of a body whose middle is at `c`: drawn over the body if so, under it if not. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How big a stage's things in the air are drawn, in the units of the screen they are drawn on. */
const bigness = (s: Goat): number => 2 * Math.max(0.9, (s.len / 2.15) ** 0.8);

/** A petal in the air at (x, y), `r` long, turning: a little oval of colour with a soft dark edge; a leaf, pointed, when green. */
function petalAt(g: CanvasRenderingContext2D, x: number, y: number, r: number, c: RGB, al: number, spin: number): void {
  if (al <= 0.01 || r <= 0.05) return;
  g.save();
  g.translate(x, y);
  g.rotate(spin);
  g.beginPath();
  if (c === GREEN) {
    g.moveTo(-r, 0);
    g.quadraticCurveTo(0, -r * 0.6, r, 0);
    g.quadraticCurveTo(0, r * 0.6, -r, 0);
  } else g.ellipse(0, 0, r, r * 0.55 * (0.6 + 0.4 * Math.abs(Math.cos(spin * 1.7))), 0, 0, TAU);
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

/** Where something let go of at `p` with velocity `v` is `s` seconds on, slowing in the air and falling: a petal. */
const flutter = (p: V3, v: V3, s: number, drag = 2.4, fall = 1.2): V3 => {
  const k = (1 - Math.exp(-drag * s)) / drag;
  return [p[0] + v[0] * k, p[1] + v[1] * k, p[2] + v[2] * k - fall * s * s];
};

/** The blow: a burst of petals and leaves from its horns, and a sparkle; on the bigger stages more of them, further. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Goat, b: Bones, at: Bones, t: number, front: boolean): void {
  const hit = GOAT_HITS[s.strike], since = (t - hit) * ACT_SECS.strike;
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
    petalAt(g, x, y, (0.2 + 0.08 * jitter(q + 9)) * big, q % 5 === 4 ? GREEN : PETALS[q % 4], fade, q + since * (6 + 4 * jitter(q)));
  }
  const flash = 1 - ramp(since, 0, 0.1);
  if (flash > 0 && nearSide(impact, mid, view) === front) {
    const [x, y] = onScreen(view, impact);
    sparkle(g, x, y, (0.3 + 0.2 * ramp(since, 0, 0.06)) * big, WHITE, flash, 0.3);
  }
}

/** Its task: two bits of leaf flung off at the pluck, and a little puff of petals where the flower lands. */
function workBits(g: CanvasRenderingContext2D, view: View, s: Goat, b: Bones, a: Anim, t: number, front: boolean): void {
  const big = bigness(s), far = big / 2, mid = b.body.t, W = GOAT_WORK;
  const sincePluck = (t - W.pluck) * ACT_SECS.work;
  if (sincePluck > 0 && sincePluck < 0.35 && b.clump) {
    for (let q = 0; q < 2; q++) {
      const p = flutter(add(b.clump.t, [0, 0, 0.15]), [(q ? 1 : -1) * 1.2 * far, 0.4 * far, 2.2 * far], sincePluck, 3, 2 * far);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      petalAt(g, x, y, 0.16 * big, GREEN, 1 - sincePluck / 0.35, q * 2 + sincePluck * 12);
    }
  }
  // A glitter round the flower as it flies.
  if (t > W.toss && t < W.land && b.pick) {
    const u = (t - W.toss) / (W.land - W.toss);
    for (let q = 0; q < 3; q++) {
      const p = add(b.pick.t, [0.12 * Math.cos(q * 2.1 + u * 9), 0.12 * Math.sin(q * 2.1 + u * 9), -0.1 - 0.12 * q]);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      sparkle(g, x, y, (0.16 - 0.03 * q) * big, q % 2 ? YELLOW : WHITE, 0.9 - 0.25 * q, u * 6 + q);
    }
  }
  const sinceLand = (t - W.land) * ACT_SECS.work;
  if (sinceLand > 0 && sinceLand < 0.4) {
    const L = landingOf(s), at = place(b[L.bone], L.at);
    for (let q = 0; q < 5; q++) {
      const th = (q / 5) * TAU + 0.5;
      const p = flutter(at, [Math.cos(th) * 1.3 * far, Math.sin(th) * 1.3 * far, 1.8 * far], sinceLand, 3.5, 1.6 * far);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      petalAt(g, x, y, 0.13 * big, PETALS[q % 4], 1 - sinceLand / 0.4, q + sinceLand * 10);
    }
  }
}

/** Evolving: petals and leaves drawn in round it in a rising spiral, a burst of them at the turn, and sparkles on its flowers. */
function evolveFx(g: CanvasRenderingContext2D, view: View, s: Goat, b: Bones, t: number, front: boolean): void {
  const big = bigness(s), mid: V3 = [0, 0, b.body.t[2]];
  const rise = ramp(t, 0.05, 0.25) * (1 - ramp(t, 0.7, 1));
  const tall = s.legs + s.body.h[3] * 2 + 1.2;
  if (rise > 0) {
    for (let q = 0; q < 14; q++) {
      const u = frac(t * 1.2 + q / 14), ang = (q / 14) * TAU * 2 + t * TAU * 1.5;
      const r = s.len * 0.75 * (1 - 0.4 * u);
      const p: V3 = [Math.cos(ang) * r * 0.8, Math.sin(ang) * r, u * tall];
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      petalAt(g, x, y, 0.2 * big, q % 4 === 3 ? GREEN : PETALS[q % 4], rise * Math.sin(u * Math.PI), ang * 2);
    }
  }
  const burst = (t - 0.5) * ACT_SECS.evolve;
  if (burst > 0 && burst < 0.6) {
    for (let q = 0; q < 12; q++) {
      const th = (q / 12) * TAU;
      const p = flutter([0, 0, tall * 0.55], [Math.cos(th) * 3 * big / 2, Math.sin(th) * 3 * big / 2, 2 * big / 2], burst, 2.5, big);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      petalAt(g, x, y, 0.22 * big, PETALS[q % 4], 1 - burst / 0.6, th + burst * 8);
    }
  }
  const flash = hump(t, 0.5, 0.08);
  if (flash > 0 && front) {
    const [x, y] = onScreen(view, place(b.head, [0, 0, s.head.skull.r[2] * 1.6]));
    sparkle(g, x, y, 0.7 * big * flash, WHITE, flash, t * 4);
  }
}

/** Light: a soft flash at the horns as the blow lands; and a warm glow on its crown at the turn of evolving. */
function goatGlow(s: Goat, b: Bones, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  const act = a.act;
  if (act?.kind === 'strike') {
    const k = hump(act.t, GOAT_HITS[s.strike] + 0.02, 0.1);
    return k > 0 ? [{ p: place(b.head, browOf(s)), r: 0.5 * bigness(s) + 0.4 * s.strike, c: [255, 246, 226], a: 0.4 * k }] : [];
  }
  if (act?.kind === 'evolve') {
    const k = hump(act.t, 0.5, 0.12);
    return k > 0 ? [{ p: place(b.head, [0, 0, s.head.skull.r[2] * 1.4]), r: 0.6 * bigness(s), c: [255, 236, 214], a: 0.45 * k }] : [];
  }
  return [];
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes, works and evolves. */
function goatKind(s: Goat): Kind {
  const drops = dropsOf(s);
  const bones = goatBones(s, drops);
  const atHit = (a: Anim): Bones => bones({ ...a, act: { kind: 'strike', t: GOAT_HITS[s.strike] } });
  return {
    bones,
    build: (lod) => goatBuild(s, drops, lod),
    // The variant's coat for its tan and the darker brown of its patches, and its markings for its cream; everything it wears,
    // and its horns, hooves and eyes, the same on every variant.
    palette: (coat0, mark0) => {
      const coat = mix(pastel(coat0), coat0, 0.55), mark = mix(pastel(mark0), [255, 252, 244], 0.2);
      return coatPalette(coat0, mark0, {
        coat,
        coatDark: mix(coat, [96, 60, 40], 0.42),
        coatLight: mix(coat, mark, 0.5),
        mark,
        belly: mix(coat, mark, 0.45),
        muzzle: mix(mark, coat, 0.18),
        inner: [242, 172, 182],
        nose: [200, 132, 128],
        lid: mix(coat, [70, 44, 40], 0.7),
        water: [138, 86, 46],
        eye: [44, 26, 22],
        eyeWhite: [255, 255, 255],
        glint: [255, 255, 255],
        horn: [150, 106, 72],
        hornDark: [124, 86, 58],
        hoof: [84, 58, 46],
        leaf: [134, 176, 92],
        leafDark: [96, 140, 74],
        moss: [156, 186, 96],
        stem: [118, 150, 74],
        bark: [128, 100, 64],
        petal: [255, 251, 242],
        bloom: [252, 210, 82],
        spot: [236, 156, 66],
        cap: [244, 162, 194],
        feather: [250, 196, 214],
        crystal: [176, 136, 226],
        crystalDark: [132, 96, 196],
        gem: [214, 192, 244],
        wood: [178, 128, 80],
        woodDark: [146, 100, 62],
        metal: [232, 192, 96],
        metalLit: [255, 236, 168],
        metalDark: [176, 132, 60],
      }, 30);
    },
    shadow: [s.len * 0.75 + 0.2, s.body.w[4] + 0.25 + (s.cloak ? 0.35 : 0)],
    stride: 1.3,
    size: s.size,
    blinks: 4,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are the pink and lilac of its flowers.
    motes: [[250, 200, 222], [190, 156, 236]],
    glow: (b, a) => goatGlow(s, b, a),
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (!act) return;
      if (act.kind === 'strike') strikeBurst(g, view, s, b, atHit(a), act.t, front);
      else if (act.kind === 'work') workBits(g, view, s, b, a, act.t, front);
      else if (act.kind === 'evolve') evolveFx(g, view, s, b, act.t, front);
    },
  };
}

export const BRIARLING = goatKind(BRIARLING_LOOK);
export const MEADOWTIDE = goatKind(MEADOWTIDE_LOOK);
export const FLORACRUX = goatKind(FLORACRUX_LOOK);
