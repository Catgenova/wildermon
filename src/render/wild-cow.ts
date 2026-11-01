import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, DEG, disc, dot, frac, lerp, lifted, merge, mix, onEgg, orb, orbAlong,
  paint, quadBonesOf, scale, shadowOf, smile, smooth, step, sub, TAU, tube, unit, type Anim, type Bones, type Disc, type Kind,
  type LegSpec, type Piece, type QuadPose, type QuadSpec,
} from './beasts';
import { blade, cut, quadPieces } from './beastkit';
import { joint, mesh, onScreen, place, type Face, type Mat, type Mesh, type RGB, type V3, type View } from './figure';

/**
 * The cow line: the Creamcalf, a small calf in a cream coat with dark
 * brown-grey patches, a fluffy cream tuft on its head, pink-lined ears, a pink
 * muzzle, big brown eyes, a little garland of leaves and white five-petal
 * flowers round its neck, a tufted tail and dark hooves; which grows into the
 * Milkmere, a grown cow in the same patched coat with short curved cream horns,
 * a crown of white blossoms and leaves, a long cream mane braided into a plait
 * down its neck, shaggy cream fur on its legs, a pink udder, a vine of leaves
 * and white flowers draped along its back and a long tufted tail; and then the
 * Lactisovereign, large and tall, with big crescent horns, its crown, a long
 * braided mane, a thick mantle of fern moss on its back with a stem of big
 * drooping white bells (lily of the valley) arching over it, golden tendrils
 * curling to a spiral down its shoulders, a heavy pink udder, shaggy legs and
 * a big plumed tail. The species is still `cudda` underneath, as saves and the
 * database know it: it is milked.
 *
 * Each is its variant's markings for its cream and its coat for the patches
 * on it; its horns, hooves, flowers, leaves, moss and gold are the same on
 * every variant. All three are built by one set of functions from a
 * description of the stage (`Cow`), on the four-legged body the goat line has
 * (`./wild-goat`): the Creamcalf skips along on the diagonals, bouncing; the
 * others walk the four beats of a cow's walk and trot when they run.
 *
 * It has no task. Standing, it chews its cud, flicks an ear and swishes its
 * tail; grazing, its head goes down to the grass. Its strike is a butt
 * (`COW_HITS`): the Creamcalf hops forward onto it, the bigger two drop their
 * heads and drive in with their horns.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Rings along a body: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

interface Cow {
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
  /** Each ear: held out to the side (degrees) and laid back, its tip drooping by `droop` of its length. */
  ear: { len: number; w: number; out: number; back: number; droop: number };
  /** Each horn, a crescent: how thick at the root, how long, how far back of upright it starts (degrees) and how far it turns forward again by its tip, how far out it flares. */
  /**
   * Each horn (the right one), a crescent: how thick at the root and how long; the way it sets out from the crown, the way it
   * runs at its middle, and the way its tip points, each turning smoothly into the next.
   */
  horn: { r: number; len: number; d: [V3, V3, V3] } | null;
  /** The fluffy tuft on its poll: how big. */
  tuft: number;
  /** The crown: how many flowers in it, and how big each is; none on the calf. */
  crown: { n: number; r: number } | null;
  /** The calf's garland round its neck: how many leaves round it, how long a leaf and how wide, and how many flowers at its front. */
  garland: { count: number; len: number; w: number; flowers: number } | null;
  /** The braid down each side of the neck: how long, how thick; and the loose mane over the crest and the throat, how long a lock. */
  braid: { len: number; w: number } | null;
  mane: number;
  /** Its shaggy cream fur: at the chest, and on each leg above the hoof (how long each tuft is). */
  shag: { chest: number; leg: number };
  /** Its darker patches: how far along the body (nought the rump, one the chest), how far round from the side (radians, up positive), how big. */
  patches: Array<[number, number, number]>;
  /** The udder: how big; nought for none. */
  udder: number;
  /** The vine draped along its back: how many leaves along it, and how many flowers. */
  vine: { leaves: number; flowers: number } | null;
  /** The mantle of fern moss on its back, from the withers to the hips: how many clumps along it, how big each; the lily of the valley over it, how many bells and how big; and its golden tendrils. */
  mantle: { clumps: number; r: number; bells: number; bell: number; arch: number } | null;
  /** The tail: how long, and how big the tuft at its end. */
  tail: { len: number; tuft: number; lift: number; curl: number };
  /**
   * How it goes: how much it bounces at a walk and at a run; how far it nods; how far its legs swing at a walk and a run and for
   * how much of a stride a foot is down; whether it skips on the diagonals at a walk (a calf) or walks the four beats.
   */
  gait: { bounce: [number, number]; nod: number; swing: [number, number]; duty: [number, number]; skip: boolean };
  /** Its strike: a hop and a butt, or a lowered drive with the horns. */
  strike: 0 | 1;
  size: number;
}

/** A head scaled by `k` about its neck, for a head drawn bigger or smaller against its body. */
const sized = (k: number, H: Cow['head']): Cow['head'] => ({
  skull: { c: scale(H.skull.c, k), r: scale(H.skull.r, k) }, muzzle: { c: scale(H.muzzle.c, k), dir: H.muzzle.dir, r: scale(H.muzzle.r, k) }, pitch: H.pitch,
});

/** A cow's head: a broad skull, a long face down to a broad round muzzle. */
const COW_HEAD = (pitch: number): Cow['head'] => ({
  skull: { c: [0, 0, 0.3], r: [0.45, 0.56, 0.42] },
  muzzle: { c: [0, 0.66, -0.1], dir: [0, 1, -0.55], r: [0.36, 0.25, 0.19] },
  pitch,
});

/** A Creamcalf: a small calf, a big head and eyes, a tuft on its poll, a garland of leaves and flowers round its neck. */
const CREAMCALF_LOOK: Cow = {
  stage: 0,
  body: { y: [-0.92, -0.8, -0.42, 0.02, 0.44, 0.74, 0.88], z: [0.2, 0.14, 0.1, 0.1, 0.12, 0.18, 0.24], w: [0.24, 0.44, 0.5, 0.52, 0.5, 0.44, 0.24], h: [0.28, 0.5, 0.56, 0.57, 0.57, 0.52, 0.3] },
  len: 1.5, legs: 1.0, thick: 0.4, hoof: 0.15,
  neck: { at: [0, 0.72, 0.36], len: 0.5, w: 0.38, lean: 36 },
  head: sized(1.3, COW_HEAD(-2)),
  eye: { dir: [0.62, 0.58, 0.42], size: 0.17, lid: 0 },
  ear: { len: 0.46, w: 0.18, out: 100, back: 8, droop: 0.16 },
  horn: null,
  tuft: 0.17,
  crown: null,
  garland: { count: 14, len: 0.2, w: 0.1, flowers: 3 },
  braid: null, mane: 0,
  shag: { chest: 0.12, leg: 0 },
  patches: [[0.1, 0.55, 0.36], [0.5, 0.95, 0.26], [0.36, 0.0, 0.22], [0.82, 0.55, 0.18]],
  udder: 0,
  vine: null,
  mantle: null,
  tail: { len: 0.82, tuft: 0.13, lift: -12, curl: -20 },
  gait: { bounce: [0.2, 0.28], nod: 6, swing: [28, 40], duty: [0.5, 0.36], skip: true },
  strike: 0,
  size: 1.9,
};

/** A Milkmere: a grown cow, short curved horns, a crown, a braided mane, a vine along its back, shaggy legs and an udder. */
const MILKMERE_LOOK: Cow = {
  stage: 1,
  body: { y: [-1.78, -1.6, -0.9, 0, 0.86, 1.46, 1.66], z: [0.22, 0.16, 0.06, 0.04, 0.1, 0.2, 0.28], w: [0.42, 0.68, 0.78, 0.8, 0.78, 0.7, 0.4], h: [0.46, 0.72, 0.8, 0.82, 0.82, 0.78, 0.48] },
  len: 3.0, legs: 1.6, thick: 0.56, hoof: 0.2,
  neck: { at: [0, 1.4, 0.32], len: 0.78, w: 0.62, lean: 48 },
  head: sized(1.38, COW_HEAD(4)),
  eye: { dir: [0.62, 0.58, 0.44], size: 0.13, lid: 0.12 },
  ear: { len: 0.46, w: 0.19, out: 100, back: 12, droop: 0.2 },
  horn: { r: 0.16, len: 0.95, d: [[0.8, -0.35, 0.45], [0.3, -0.3, 1], [-0.25, 0.6, 0.5]] },
  tuft: 0.16,
  crown: { n: 3, r: 0.27 },
  garland: null,
  braid: { len: 1.4, w: 0.24 }, mane: 0.32,
  shag: { chest: 0.3, leg: 0.34 },
  patches: [[0.1, 0.7, 0.5], [0.5, 1.05, 0.42], [0.42, 0.15, 0.36], [0.82, 0.5, 0.32]],
  udder: 0.62,
  vine: { leaves: 24, flowers: 7 },
  mantle: null,
  tail: { len: 1.5, tuft: 0.28, lift: -50, curl: -8 },
  gait: { bounce: [0.03, 0.26], nod: 4, swing: [22, 32], duty: [0.62, 0.4], skip: false },
  strike: 1,
  size: 2.1,
};

/** A Lactisovereign: large and tall, great crescent horns, a long braided mane, a mantle of fern moss with lily of the valley, gold tendrils. */
const LACTISOVEREIGN_LOOK: Cow = {
  stage: 2,
  body: { y: [-2.2, -2.0, -1.16, 0, 1.1, 1.84, 2.08], z: [0.22, 0.16, 0.06, 0.06, 0.16, 0.3, 0.4], w: [0.56, 0.92, 1.04, 1.08, 1.08, 0.98, 0.56], h: [0.6, 0.94, 1.04, 1.08, 1.1, 1.06, 0.62] },
  len: 3.8, legs: 2.1, thick: 0.72, hoof: 0.26,
  neck: { at: [0, 1.8, 0.5], len: 1.05, w: 0.86, lean: 40 },
  head: sized(1.9, COW_HEAD(8)),
  eye: { dir: [0.6, 0.6, 0.46], size: 0.13, lid: 0.2 },
  ear: { len: 0.5, w: 0.2, out: 96, back: 16, droop: 0.2 },
  horn: { r: 0.34, len: 2.6, d: [[0.35, -1, -0.1], [0.18, -0.2, 1.3], [-0.12, 1, -0.35]] },
  tuft: 0.15,
  crown: { n: 4, r: 0.25 },
  garland: null,
  braid: { len: 2.3, w: 0.32 }, mane: 0.9,
  shag: { chest: 0.7, leg: 0.5 },
  patches: [[0.1, 0.3, 0.66], [0.56, 0.25, 0.58], [0.34, -0.25, 0.4], [0.86, 0.55, 0.36]],
  udder: 0.9,
  vine: null,
  mantle: { clumps: 10, r: 0.46, bells: 5, bell: 0.4, arch: 1.9 },
  tail: { len: 2.1, tuft: 0.5, lift: -48, curl: -9 },
  gait: { bounce: [0, 0.28], nod: 2.5, swing: [18, 27], duty: [0.64, 0.42], skip: false },
  strike: 1,
  size: 2.3,
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each tuft, leaf and flower, nought to one, so a coat is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
const len3 = (a: V3): number => Math.hypot(a[0], a[1], a[2]);

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
const onBody = (s: Cow, y: number, th: number): { p: V3; n: V3 } => onRings(s.body, y, th);
/** Along the body, nought at the rump's ring and one at the chest's. */
const alongBody = (s: Cow, u: number): number => lerp(s.body.y[1], s.body.y[5], u);
const onSkull = (s: Cow, dir: V3): { p: V3; n: V3 } => onEgg(s.head.skull.c, s.head.skull.r, dir);
/** The muzzle's own frame: across it (to the left), up it, and along it. */
function muzzleFrame(s: Cow): [V3, V3, V3] {
  const z = unit(s.head.muzzle.dir), x = unit(cross([0, 0, 1], z));
  return [x, cross(z, x), z];
}
/** Where the way `dir` out of the middle of the muzzle, in its own frame, meets it, and the way out of it there. */
function onMuzzle(s: Cow, dir: V3): { p: V3; n: V3 } {
  const M = s.head.muzzle, [x, y, z] = muzzleFrame(s), q = onEgg([0, 0, 0], M.r, dir);
  const to = (v: V3): V3 => add(add(scale(x, v[0]), scale(y, v[1])), scale(z, v[2]));
  return { p: add(M.c, to(q.p)), n: unit(to(q.n)) };
}
/** The end of the muzzle, where the nose is. */
const noseOf = (s: Cow): V3 => add(s.head.muzzle.c, scale(unit(s.head.muzzle.dir), s.head.muzzle.r[2]));
const left = (q: { p: V3; n: V3 }): { p: V3; n: V3 } => ({ p: [-q.p[0], q.p[1], q.p[2]], n: [-q.n[0], q.n[1], q.n[2]] });

/** Solids the body is, in the trunk's frame, for what is on the far side of it to be hidden behind: its back half and its front. */
function bodySolids(s: Cow, k = 0.92): Array<{ c: V3; r: V3 }> {
  const B = s.body, h = (B.y[5] - B.y[1]) / 4;
  return [
    { c: [0, B.y[1] + h * 1.2, B.z[2] + 0.02], r: [B.w[2] * k, h * 1.5, B.h[2] * k] },
    { c: [0, B.y[5] - h * 1.2, B.z[4] + 0.02], r: [B.w[4] * k, h * 1.5, B.h[4] * k] },
  ];
}
const skullOf = (s: Cow): { c: V3; r: V3 } => ({ c: s.head.skull.c, r: scale(s.head.skull.r, 0.9) });
function muzzleOf(s: Cow): { c: V3; r: V3 } {
  const M = s.head.muzzle;
  return { c: M.c, r: [M.r[0] * 0.85, M.r[2] * 0.85, M.r[1] * 0.85] };
}

/** A frame square to `n`: two ways across it. */
function across(n: V3): [V3, V3] {
  const z = unit(n);
  let x = cross([0, 0, 1], z);
  if (len3(x) < 1e-3) x = [1, 0, 0];
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

/* ---- its legs and its stride ------------------------------------------------------------ */

/** Where each ear is rooted on the head (the right one): on the side of the skull, behind the eye. */
const earRoot = (s: Cow): V3 => onSkull(s, [0.9, -0.3, 0.32]).p;
/** Where the horns' root is on the skull (the right one): high on the crown toward the side, behind the eyes. */
const hornRoot = (s: Cow): V3 => onSkull(s, [0.55, -0.05, 0.83]).p;

/** How the legs hang from the body standing: the hips and shoulders, and each leg's two parts' pitch (degrees, forward positive). */
const FORE_REST: [number, number, number] = [-4, 8, 0], HIND_REST: [number, number, number] = [14, -26, 0];
const foreLen = (s: Cow): number => s.legs * 0.5;
/** How far down the barrel the shoulder and the hip are: lower the deeper the barrel, so a deep body stands on short legs. */
const foreAt = (s: Cow): number => -0.34 * s.body.h[4];
const hindAt = (s: Cow): number => -0.24 * s.body.h[2];
/** A hind leg long enough, bent as it stands, for its hoof to stand on the ground the fore hooves stand on. */
function hindLen(s: Cow): number {
  const c = (d: number): number => Math.cos(d * DEG);
  const reach = -foreAt(s) + foreLen(s) * (c(FORE_REST[0]) + c(FORE_REST[0] + FORE_REST[1]));
  return (reach + hindAt(s)) / (c(HIND_REST[0]) + c(HIND_REST[0] + HIND_REST[1]));
}

/** A stage's body on four hooves (`QuadSpec`). */
const specOf = (s: Cow): QuadSpec => ({
  high: s.legs + 0.6,
  fore: { at: [s.body.w[4] * 0.5, s.len * 0.44, foreAt(s)], len: [foreLen(s), foreLen(s), s.hoof], rest: FORE_REST, fold: [55, 90], toe: [s.thick * 0.7, s.thick * 0.3] },
  hind: { at: [s.body.w[2] * 0.5, -s.len * 0.4, hindAt(s)], len: [hindLen(s), hindLen(s), s.hoof], rest: HIND_REST, fold: [35, 60], toe: [s.thick * 0.7, s.thick * 0.3] },
  neck: { at: s.neck.at, len: s.neck.len, lean: s.neck.lean },
  head: { pitch: s.head.pitch },
  tail: { at: [0, s.body.y[0] + 0.08, s.body.z[0] + s.body.h[1] * 0.62], links: 4, len: s.tail.len / 4, lift: s.tail.lift, curl: s.tail.curl, sway: 10 },
  ears: { at: earRoot(s), out: s.ear.out, back: s.ear.back },
  swing: s.gait.swing,
  duty: s.gait.duty,
  // Grazing, the neck bowed forward and down past level, and the nose down toward the grass.
  graze: 104 - s.neck.lean,
  nose: 34,
  bow: 0,
  rock: 4,
});

/** Where each leg's foot is in a stride: a cow's four-beat walk, and the diagonals together, a trot or a calf's skip. */
const FOUR_BEAT = [0.25, 0.75, 0, 0.5];
const DIAGONALS = [0, 0.5, 0.5, 0];

/**
 * A leg's stride: standing, as `step` has it; swinging, its hoof lifted
 * straight off the grass, carried forward and set straight down on its mark,
 * the leg swung to whatever puts the hoof there, folded as it is.
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

/** How far through a strike each stage's blow lands: when its brow or its horns meet what it butts. */
export const COW_HITS = [0.5, 0.52, 0.56] as const;

/** How far the whole body is carried forward this moment, in its own units, as it strikes. Its legs are swung back by as much. */
function surge(s: Cow, a: Anim): number {
  const act = a.act;
  if (act?.kind !== 'strike') return 0;
  const t = act.t, hit = COW_HITS[s.stage];
  if (s.strike === 0) return s.len * (0.22 * ramp(t, 0.2, hit) * (1 - ramp(t, hit + 0.1, 1)) - 0.05 * ramp(t, 0.02, 0.2) * (1 - ramp(t, 0.2, 0.34)));
  return s.len * (0.16 * ramp(t, 0.3, hit) * (1 - ramp(t, hit + 0.12, 1)) - 0.08 * ramp(t, 0.03, 0.26) * (1 - ramp(t, 0.26, 0.44)));
}

/** A rebound after a blow that dies away, `t` through the strike. */
const settleOf = (t: number, hit: number): number => {
  const after = clamp((t - hit) / (1 - hit));
  return t > hit ? Math.sin(after * Math.PI * 2) * (1 - after) : 0;
};

/**
 * A stage's pose over the one a body on four legs has (`quadPose`): its own
 * gait, the Creamcalf's bouncing skip and the others' four-beat walk;
 * standing, an ear flicked, the tail swished and a chew of the cud; grazing;
 * and its moves -- the strike, and evolving.
 */
function cowPose(s: Cow, spec: QuadSpec, p: QuadPose, a: Anim, reach = 0): void {
  const g = smooth(a.go), G = s.gait;
  if (a.go > 0) {
    const duty = lerp(G.duty[0], G.duty[1], a.gait), amp = lerp(G.swing[0], G.swing[1], a.gait);
    const at = G.skip || a.gait >= 0.5 ? DIAGONALS : FOUR_BEAT;
    const quad = a.gait < 0.5 ? FOUR_BEAT : [0, 0.5, 0.5, 0];
    for (let i = 0; i < 4; i++) {
      const was = step(a.u + quad[i], lerp(spec.duty?.[0] ?? 0.64, spec.duty?.[1] ?? 0.4, a.gait), lerp(spec.swing[0], spec.swing[1], a.gait));
      const now = lifting(i < 2 ? spec.fore : spec.hind, a.u + at[i], duty, amp * sweepOf(spec, i < 2), G.skip ? 1.2 : 1);
      for (let k = 0; k < 3; k++) p.legs[i][k] += g * (now[k] - was[k]);
    }
    const w = frac(a.u);
    const over = (duty + 0.5) / 2;
    p.lift = g * lerp(G.bounce[0], G.bounce[1], a.gait) * (0.5 + 0.5 * Math.cos((w - over) * TAU * 2));
    p.head[0] += g * G.nod * Math.sin(w * TAU * 2 - 1.1);
    p.neck[0] += g * (3 + 3 * a.gait);
    // Its ears flapping a beat behind its nod, and its tail swinging.
    p.ears[0][0] += g * (1.5 * G.nod * Math.sin(w * TAU * 2 - 1.8) - 4);
    p.ears[1][0] += g * (1.5 * G.nod * Math.sin(w * TAU * 2 - 1.5) - 4);
    p.ears[0][1] += g * 8 * Math.sin(w * TAU * 2 - 2.0);
    p.ears[1][1] -= g * 8 * Math.sin(w * TAU * 2 - 1.7);
    p.tail[0] += g * (G.skip ? 14 : 4);
    p.tail[1] += g * 14 * Math.sin(w * TAU + 0.6);
    p.roll = lerp(p.roll, p.roll * a.gait + a.gait * 2 * Math.sin(w * TAU) + (1 - a.gait) * 1.5 * Math.sin(w * TAU), g);
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
    // Standing: an ear flicked now and then, the tail swished at a fly, and a chew of the cud in bursts.
    p.ears[0][0] += 18 * beat(a.t, [4.1, 15.3], 0.4);
    p.ears[1][0] += 18 * beat(a.t, [9.7, 20.2], 0.4);
    p.ears[1][1] += 12 * beat(a.t, [9.7, 20.2], 0.4);
    p.tail[1] += 26 * cyc(a.t, 36) * beat(a.t, [2.5, 11.4, 17.8], 1.4);
    p.tail[0] += 6 * beat(a.t, [2.5, 11.4, 17.8], 1.4);
    p.head[1] += 6 * cyc(a.t, 1, 0.7) * (1 - a.graze);
    const chew = beat(a.t, [0.6, 7.2, 13.6, 19.0], 3.2);
    p.jaw = Math.max(p.jaw, chew * (0.5 + 0.5 * cyc(a.t, 36)));
  }
  // Grazing: the fore legs kept under it and the chest let down on them, the neck bowed down and the face down, its nose at the grass.
  const gz = a.act ? 0 : a.graze * (1 - g);
  if (gz > 0) {
    p.legs[0][1] -= 0.6 * gz;
    p.legs[1][1] -= 0.6 * gz;
    tipped(spec, p, (4 + 8 * reach) * gz);
    p.neck[0] += Math.min(18, 14 * reach) * gz;
    p.head[0] -= 12 * reach * gz;
    p.jaw = Math.max(p.jaw, gz * (0.5 + 0.5 * cyc(a.t, 48)));
    p.tail[1] += 20 * gz * beat(a.t, [2.3, 7.9, 13.1, 19.4], 0.5);
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
  else if (act?.kind === 'evolve') {
    // Evolving: drawn up tall as the light gathers, then at the turn a shake of the head, ears flapping.
    const t = act.t, up = ramp(t, 0.1, 0.45) * (1 - ramp(t, 0.62, 0.85)), shake = hump(t, 0.56, 0.1);
    p.neck[0] -= 12 * up;
    p.head[0] += 14 * up;
    p.head[2] += 14 * shake * Math.sin(t * 70);
    p.ears[0][1] += 22 * shake * Math.sin(t * 70);
    p.ears[1][1] -= 22 * shake * Math.sin(t * 70);
    p.squash -= 0.04 * up;
    p.tail[1] += 25 * Math.sin(t * 30) * up;
  }
  if (act?.kind === 'strike' || act?.kind === 'evolve') grounded(spec, p);
}

/**
 * Each stage's strike. The Creamcalf crouches, hops forward and butts with its
 * brow as it lands; the Milkmere and the Lactisovereign stamp, draw back, drop
 * their heads with the horns forward and drive in, the Lactisovereign slower
 * and heavier.
 */
function strikePose(s: Cow, spec: QuadSpec, p: QuadPose, t: number): void {
  const hit = COW_HITS[s.stage], st = settleOf(t, hit);
  const flick = hump(t, hit + 0.02, 0.1);
  p.tail[0] += 34 * flick;
  p.tail[1] += 24 * flick * Math.sin(t * 60);
  if (s.strike === 0) {
    const crouch = ramp(t, 0.02, 0.18) * (1 - ramp(t, 0.16, 0.32));
    const hop = t > 0.18 && t < hit ? Math.sin(Math.PI * (t - 0.18) / (hit - 0.18)) ** 1.5 : 0;
    const butt = ramp(t, 0.36, hit) * (1 - ramp(t, hit + 0.12, 0.9));
    p.lift += 0.24 * hop;
    sunk(spec, p, 0.06 * crouch);
    tipped(spec, p, -10 * crouch, 'fore');
    p.tail[0] += 40 * hump(t, 0.2, 0.08);
    p.legs[0][0] += 8 * hop;
    p.legs[1][0] += 8 * hop;
    p.legs[2][0] -= 16 * hop;
    p.legs[3][0] -= 16 * hop;
    p.legs[2][1] += 0.25 * hop;
    p.legs[3][1] += 0.25 * hop;
    p.pitch += 6 * hop;
    settled(spec, p, 3 * st);
    tipped(spec, p, 8 * butt * (1 - hop), 'hind');
    p.neck[0] += 10 * crouch + 26 * butt - 6 * st;
    p.head[0] += -14 * crouch - 24 * butt + 6 * st;
    for (const e of p.ears) e[0] += 26 * crouch + 18 * hop - 10 * st;
    p.squash += 0.08 * hump(t, hit + 0.03, 0.07) - 0.05 * hop;
    return;
  }
  const heavy = s.stage === 2 ? 1 : 0;
  // A stamp of a fore hoof, then drawn back onto its haunches, the head dropped with the horns forward, and the drive.
  const stamp = hump(t, 0.12, 0.08);
  const back = ramp(t, 0.06, 0.28) * (1 - ramp(t, 0.28, 0.44));
  const drive = ramp(t, 0.3, hit) * (1 - ramp(t, hit + 0.14, 0.95));
  const toss = hump(t, hit + 0.08, 0.08);
  p.legs[1][2] = Math.max(p.legs[1][2], 0.5 * stamp);
  p.legs[1][1] += 0.5 * stamp;
  sunk(spec, p, (0.05 + 0.03 * heavy) * back);
  settled(spec, p, (5 + 2 * heavy) * back - 3 * st);
  tipped(spec, p, (6 + 3 * heavy) * drive, 'hind');
  p.neck[0] += (14 + 6 * heavy) * back + (20 + 8 * heavy) * drive - 6 * st;
  p.head[0] += -(18 + 4 * heavy) * back - (20 + 8 * heavy) * drive + 22 * toss + 6 * st;
  for (const e of p.ears) e[0] += 26 * back + 18 * drive;
  p.squash += (0.06 + 0.03 * heavy) * hump(t, hit + 0.03, 0.08);
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

/** The bones of a stage: a body on four hooves stood on the ones bearing its weight, and the collar its garland and braids hang from. */
function cowBones(s: Cow): (a: Anim) => Bones {
  const spec = specOf(s);
  let last: QuadPose | undefined, reach = 0, found = false;
  const posed = quadBonesOf(spec, (p, a) => { cowPose(s, spec, p, a, reach); last = p; });
  // How much further it bows for its nose to come down to the grass, found once for the stage by trying.
  const grass = 0.2 + 0.06 * s.stage;
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
  };
  return (a) => {
    if (!found) calibrate();
    const act = a.act;
    const graze = act ? 0 : a.graze;
    let b = posed({ ...a, graze });
    const p = last as QuadPose;
    if (!(graze > 0 && a.go < 1)) {
      const all = [0, 1, 2, 3];
      b = lifted(b, Math.max(-lowOf(spec, b, all, p, act ? 0 : a.go), -lowOf(spec, b, all)) + Math.max(0, p.lift));
      b.shadow = shadowOf(b.body, p.lift);
    }
    const d = surge(s, a);
    if (d) for (const k of Object.keys(b)) b[k] = { m: b[k].m, t: [b[k].t[0], b[k].t[1] + d, b[k].t[2]] };
    // The collar goes half as far as the neck does: its bone is the neck's, turned back by half the bow.
    b.collar = joint(b.neck, [0, 0, 0], spec.neck.lean + 0.5 * p.neck[0]);
    return b;
  };
}

/* ---- flowers, leaves, moss and bells ------------------------------------------------------ */

/**
 * A flower facing along `n`, `r` across: five round petals as one flat shape,
 * both sides of it, and a heart, a little dome drawn fine and a dab of colour
 * drawn small, which is all it comes to at a few pixels across.
 */
function flowerOf(c: V3, n: V3, r: number, fine: boolean, spin = 0): Mesh {
  const N = fine ? 25 : 15, d = unit(n), [u, w] = across(d), v: V3[] = [];
  for (const side of [1, -1]) {
    for (let q = 0; q < N; q++) {
      const a = spin + (q / N) * TAU, k = r * (0.36 + 0.64 * Math.abs(Math.cos(2.5 * (a - spin))) ** 0.5);
      v.push(add(add(c, scale(d, side * 0.008)), add(scale(u, Math.cos(a) * k), scale(w, Math.sin(a) * k))));
    }
  }
  const f: Face[] = [{ i: Array.from({ length: N }, (_, q) => q), m: 'petal' }, { i: Array.from({ length: N }, (_, q) => N + q), m: 'petal' }];
  const middle = fine
    ? orbAlong(add(c, scale(d, r * 0.06)), d, [r * 0.32, r * 0.32, r * 0.18], 5, 3, 'bloom')
    : paint([disc(add(c, scale(d, 0.02)), d, r * 0.36, r * 0.36, 6, 'bloom', { lit: true })]);
  return merge(mesh(v, wound(v, f, [d, scale(d, -1)])), middle);
}

/**
 * A leaf from `root` along `dir`, its upper side toward `face`, `len` long and
 * `w` across: two halves folded a little up along the midrib, light and
 * shaded, and its underside.
 */
function leafOf(root: V3, dir: V3, face: V3, len: number, w: number, mats: readonly [Mat, Mat, Mat] = ['leaf', 'leafDark', 'leafDark'], curl = 0.12, cup = 0.25): Mesh {
  const d = unit(dir), f = unit(sub(face, scale(d, dot(face, d)))), side = unit(cross(d, f));
  const K = 5;
  const rib: V3[] = [], L: V3[] = [], R: V3[] = [];
  for (let k = 0; k <= K; k++) {
    const u = k / K, bow = Math.sin(Math.PI * u) * len * curl;
    const p = add(add(root, scale(d, len * u)), scale(f, bow - len * curl * 0.6 * u * u));
    rib.push(p);
    if (k === 0 || k === K) continue;
    const ww = w * Math.sin(Math.PI * u ** 0.85);
    L.push(add(add(p, scale(side, -ww)), scale(f, -ww * cup)));
    R.push(add(add(p, scale(side, ww)), scale(f, -ww * cup)));
  }
  const v: V3[] = [...rib, ...L, ...R];
  const ribI = rib.map((_, q) => q), LI = L.map((_, q) => rib.length + q), RI = R.map((_, q) => rib.length + L.length + q);
  const halfL = [...ribI, ...[...LI].reverse()], halfR = [...ribI, ...[...RI].reverse()];
  const f4: Face[] = [{ i: halfL, m: mats[0] }, { i: [...halfR], m: mats[1] }, { i: [...halfL], m: mats[2] }, { i: [...halfR], m: mats[2] }];
  return mesh(v, wound(v, f4, [f, f, scale(f, -1), scale(f, -1)]));
}

/** A vine along a line of points: green with a darker band every few rings. */
const vine = (pts: readonly V3[], r: number, n: number): Mesh => tube(pts, r, r * 0.85, Math.max(4, n), (ring, j) => ((ring + j) % 3 === 0 ? 'leafDark' : 'stem'));

/** A puff of fluff: round, fine enough drawn big that its edge is a curve rather than steps. */
const puffOf = (c: V3, r: V3, n: number, m: Mat): Mesh => orb(c, r, n > 3 ? 11 : 5, n > 3 ? 6 : 3, m);

/** A lock of shaggy fur from `root` along `dir`, `len` long and `w` thick at its root, bowing toward `droop`. */
function tuftOf(root: V3, dir: V3, len: number, w: number, mat: Mat, droop: V3 = [0, 0, -1], n = 4): Mesh {
  // A soft lock rather than a spike: swelling a little from its root and rounding off at its tip.
  const d = unit(dir), at = (u: number, k: number): V3 => add(add(root, scale(d, len * u)), scale(droop, len * k));
  const ws = [w * 0.8, w, w * 0.9, w * 0.62, w * 0.2];
  return tube([root, at(0.3, 0.03), at(0.62, 0.1), at(0.88, 0.2), at(1, 0.28)], ws, ws, n, mat);
}

/** A frond of fern moss: a short blade with leaflets along it, from `root` along `dir`, lying on `face`. */
function frond(root: V3, dir: V3, face: V3, L: number, w: number, mat: Mat, fine: boolean, pinch = 0.6): Mesh {
  const d = unit(dir), steps = fine ? 9 : 5, pts: V3[] = [], ws: number[] = [];
  for (let q = 0; q <= steps; q++) {
    const k = q / steps;
    pts.push(add(add(root, scale(d, L * k)), scale(face, -L * 0.3 * k * k)));
    // A stem with leaflets along it: wide at each leaflet, pinched to the stem between.
    ws.push(q === steps ? 0.004 : w * (1 - 0.45 * k) * (q % 2 ? 1 : pinch));
  }
  return blade(pts, ws, face, { mat, rib: 'leafDark', fold: 0.15, thick: 0.01 });
}

/**
 * A clump of fern moss: a soft lumpy mound, dark at its foot, ringed with
 * fronds lying out over the back around it, bright at their tips, and the
 * edge ones hanging down over the flank (`hang`).
 */
function clumpOf(c: V3, n: V3, R: number, id: number, fronds: number, fine: boolean, hang = false): Mesh {
  const z = unit(n);
  let x = cross([0, 1, 0], z);
  if (len3(x) < 1e-4) x = [1, 0, 0];
  x = unit(x);
  const y = cross(z, x);
  const b = orbAlong([0, 0, 0], z, [R * 0.9, R * 0.84, R * 0.56], fine ? 8 : 6, 4, 'moss');
  const out: Mesh[] = [mesh(b.v.map((p, i) => add(c, scale(p, 0.88 + 0.24 * jitter(id * 31 + i))) as V3), b.f)];
  // A brighter crown on the mound, so it reads as a cushion lit from above and not a dark lump.
  out.push(orbAlong(add(c, scale(z, R * 0.18)), z, [R * 0.58, R * 0.54, R * 0.36], fine ? 7 : 5, 3, 'leaf'));
  for (let q = 0; q < fronds; q++) {
    const a = (q / fronds) * TAU + jitter(id + q) * 0.9;
    const out1 = add(scale(x, Math.cos(a)), scale(y, Math.sin(a)));
    const lean = hang ? lerp(1.4, 2.1, jitter(id * 5 + q)) : lerp(1.15, 1.55, jitter(id * 5 + q));
    const d = unit(add(scale(z, Math.cos(lean)), scale(out1, Math.sin(lean))));
    const face = unit(sub(z, scale(d, dot(z, d))));
    const root = add(c, add(scale(out1, R * 0.3 * jitter(id * 7 + q)), scale(z, R * 0.1)));
    const mat: Mat = jitter(id * 11 + q) < 0.6 ? 'leaf' : 'moss';
    out.push(frond(root, d, len3(face) > 1e-3 ? face : z, R * (0.75 + 0.35 * jitter(id * 3 + q)) * (hang ? 1.45 : 1), R * 0.46, mat, fine));
  }
  // And a few feathery fern tips standing out past the cushion's edge, bright.
  for (let q = 0; q < (fine ? 3 : 2); q++) {
    const a = jitter(id * 13 + q) * TAU;
    const out1 = add(scale(x, Math.cos(a)), scale(y, Math.sin(a)));
    const lean = hang ? 1.6 : lerp(1.05, 1.35, jitter(id * 17 + q));
    const d = unit(add(scale(z, Math.cos(lean)), scale(out1, Math.sin(lean))));
    const face = unit(sub(z, scale(d, dot(z, d))));
    out.push(frond(add(c, scale(out1, R * 0.4)), d, len3(face) > 1e-3 ? face : z, R * (1.25 + 0.3 * jitter(id * 19 + q)), R * 0.3, 'leaf', fine, 0.25));
  }
  return merge(...out);
}

/**
 * A bell of lily of the valley, hung from its bone at the top: a deep round
 * cup, white, its sides coming straight down from a domed top and its lip
 * flared out and curled up into six points tipped in pale green, and a little
 * green cap where its stalk meets it.
 */
function bellOf(r: number, n: number): Mesh {
  const N = Math.max(12, n * 2);
  const zs = [0, -r * 0.16, -r * 0.46, -r * 0.8, -r * 1.04, -r * 1.2, -r * 1.28];
  const ws = [r * 0.26, r * 0.74, r * 0.96, r * 0.96, r * 0.84, r * 1.06, r * 1.34];
  const cup = tube(zs.map((z) => [0, 0, z] as V3), ws, ws, N, (ring) => (ring >= 5 ? 'featherDark' : 'feather'), { end: false });
  // The lip: six corners of its last ring pulled out and curled up to points, so it is scalloped.
  const last = zs.length - 1;
  const v = cup.v.map((p, i): V3 => {
    const ring = Math.floor(i / N), j = i % N;
    if (ring !== last) return p;
    const tip = j % (N / 6) === 0, k = tip ? 1.24 : 0.9;
    return [p[0] * k, p[1] * k, p[2] + (tip ? r * 0.1 : -r * 0.04)];
  });
  return merge(mesh(v, cup.f), orb([0, 0, -r * 0.02], [r * 0.32, r * 0.32, r * 0.2], 6, 3, 'leaf'));
}

/* ---- the head ------------------------------------------------------------------------------- */

/** Where a point on a ring round the neck is, in the collar's frame: `t` up the neck, `th` round it (nought its right side, down negative), pushed out by `out`. */
function onNeck(s: Cow, t: number, th: number, out = 0): { p: V3; n: V3 } {
  const lean = s.neck.lean * DEG, A: V3 = [0, Math.sin(lean), Math.cos(lean)], v = cross(A, [1, 0, 0]);
  const n = add(scale([1, 0, 0], Math.cos(th)), scale(v, -Math.sin(th)));
  return { p: add(scale(A, t), scale(n, s.neck.w * 0.95 + out)), n };
}

/**
 * The eyes, open or shut: big, round and glossy brown with a dark middle, a
 * big glint and a small one, under a soft lid line, a calm lid coming down
 * over the bigger stages'.
 */
function eyesOf(s: Cow, shut: boolean): Mesh {
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
      out.push({ ...facing(lid, n, 'coatDark'), at });
      out.push(disc(add(add(p, scale(n, 0.02)), scale(up, cutAt - r * 0.06)), n, r * 1.1, r * 0.14, 8, 'lid', o));
    }
  }
  // Every corner laid onto the skull's curve, each layer a hair over the last.
  const S = s.head.skull;
  return paint(out.map((d, q) => ({ ...d, v: d.v.map((v) => { const e = onEgg(S.c, S.r, sub(v, S.c)); return add(e.p, scale(e.n, 0.008 + 0.002 * (q % 6))); }) })));
}

/**
 * The skull: cream down the middle of the face and over the brow, and its
 * patch's darker colour round each eye and ear and over the back of the head,
 * which is what the sheet's face is; and its eyes.
 */
function headOf(s: Cow, n: number, k: number, shut: boolean): Mesh {
  const S = s.head.skull;
  const skull = painted(orb(S.c, S.r, n + 5, k + 3, 'coat'), (c) => {
    const d = unit([(c[0] - S.c[0]) / S.r[0], (c[1] - S.c[1]) / S.r[1], (c[2] - S.c[2]) / S.r[2]]);
    // Cream, and the dark of its patch over each ear and the back of its poll -- on the calf -- and round each eye as well on
    // the bigger two.
    const ear = Math.abs(d[0]) * 0.9 - d[1] * 0.3 + d[2] * 0.32, eye = Math.abs(d[0]) * s.eye.dir[0] + d[1] * s.eye.dir[1] + d[2] * s.eye.dir[2];
    if (ear > 0.7 || (s.stage === 0 && d[1] < -0.25 && d[2] > 0.2)) return 'coatDark';
    if (s.stage > 0 && eye > 0.86 && d[0] > -0.2) return 'coatDark';
    return 'coat';
  });
  return merge(skull, eyesOf(s, shut));
}

/** The muzzle: a broad soft egg out of the front of the face, cream going to pink at its end, two nostrils and a smile. */
function muzzleMesh(s: Cow, n: number, k: number): Mesh {
  const M = s.head.muzzle;
  const [x, y, z] = muzzleFrame(s);
  const muzzle = painted(orbAlong(M.c, M.dir, M.r, n + 2, k + 1, 'muzzle'), (c) => (dot(sub(c, M.c), z) / M.r[2] < -0.55 ? 'coat' : 'muzzle'));
  // The long face between the eyes and the muzzle: a cream egg from the front of the skull down to it.
  const S = s.head.skull, from = add(S.c, [0, S.r[1] * 0.45, -S.r[2] * 0.15]), to = add(M.c, scale(z, -M.r[2] * 0.5));
  const bridge = orbAlong(scale(add(from, to), 0.5), sub(to, from), [M.r[0] * 1.02, M.r[1] * 1.15, len3(sub(to, from)) * 0.62], n + 2, k + 1, 'coat');
  const nostrils: Disc[] = [];
  for (const sd of [1, -1]) {
    const q = onMuzzle(s, [sd * 0.42, 0.3, 0.86]);
    nostrils.push(disc(add(q.p, scale(q.n, 0.012)), q.n, M.r[0] * 0.2, M.r[0] * 0.13, 7, 'nose', { up: add(y, scale(x, sd * 0.4)) }));
  }
  const mouth = onMuzzle(s, [0, -0.55, 0.8]);
  return merge(bridge, muzzle, paint(nostrils), smile(add(mouth.p, scale(mouth.n, -0.01)), mouth.n, M.r[0] * 0.7, 'nose'));
}

/** The chin, on the jaw's bone, so a chew shows: a small egg under the end of the muzzle. */
function chinOf(s: Cow, n: number, k: number): Mesh {
  const c = onMuzzle(s, [0, -0.75, 0.15]).p;
  return orbAlong(add(c, [0, -0.02, 0.05]), [0, 1, -0.3], [s.head.muzzle.r[0] * 0.62, s.head.muzzle.r[1] * 0.42, s.head.muzzle.r[2] * 0.5], n, k, 'muzzle');
}

/**
 * An ear: a broad soft leaf, the patch's dark outside and pink inside, built
 * upright facing forward and cupped so its lining shows; its tip drooping a
 * little, which, held out to the side, is a cow's ear.
 */
function earOf(s: Cow, n: number): Mesh {
  const { len, w, droop } = s.ear;
  const spine = curve([0, 0, 0], [len * droop * 0.2, 0.05, len * 0.5], [len * droop, -0.02, len * 0.95], 4);
  const ws = [w * 0.45, w * 0.95, w, w * 0.72, 0.03];
  const cup = (p: V3): V3 => [p[0], p[1] + 0.32 * w * (p[0] / w) ** 2, p[2]];
  const shell = tube(spine, ws, ws.map((x) => Math.max(0.025, x * 0.22)), n, 'coatDark', { up: [0, 1, 0], seam: 'start' });
  const edge = (sd: number): V3[] => [1, 2, 3].map((q) => cup([spine[q][0] + sd * ws[q] * 0.66, ws[q] * 0.22 + 0.016, spine[q][2]]));
  return merge(mesh(shell.v.map(cup), shell.f), paint([{ v: [cup([0, 0.03, len * 0.08]), ...edge(-1), cup([spine[4][0], 0.03, len * 0.9]), ...edge(1).reverse()], m: 'inner' }]));
}

/* ---- the horns ------------------------------------------------------------------------------ */

/**
 * The line of the right horn, in the head's frame, `N + 1` points from root to
 * tip: setting out from the side of the crown out and back, running up at its
 * middle and turning in and forward at its tip, so that it is a crescent seen
 * from in front, from either front corner and from the side; and its
 * thickness at each point, swelling a little past its root and tapering to the tip.
 */
function hornLine(s: Cow, N: number): { pts: V3[]; r: number[] } {
  const h = s.horn!, root = hornRoot(s), pts: V3[] = [], r: number[] = [];
  const [d0, d1, d2] = h.d.map(unit);
  let p: V3 = sub(root, [0.02, 0, 0.04]);
  for (let q = 0; q <= N; q++) {
    const u = q / N;
    pts.push(p);
    r.push(h.r * (1 + 0.2 * Math.sin(Math.PI * Math.min(1, u * 2.2))) * (1 - 0.88 * u ** 1.3));
    const w = (u + 0.5 / N);
    const d = unit(add(add(scale(d0, (1 - w) ** 2), scale(d1, 2 * w * (1 - w))), scale(d2, w * w)));
    p = add(p, scale(d, h.len / N));
  }
  return { pts, r };
}

/** Where it butts with, in the head's frame: the brow between the roots of its horns, a little ahead of it. */
const browOf = (s: Cow): V3 => add(onSkull(s, [0, 0.75, 0.66]).p, [0, 0.1, 0]);

/** The right horn: cream, ringed in gold at its root. The left is its mirror. */
function hornOf(s: Cow, n: number, fine: boolean): Mesh {
  const N = s.horn!.len > 1 ? (fine ? 22 : 14) : (fine ? 10 : 7), L = hornLine(s, N);
  return tube(L.pts, L.r, L.r, n, (ring) => (ring < 3 && ring % 2 === 0 ? 'hornDark' : 'horn'), { seam: 'start' });
}

/* ---- what it wears --------------------------------------------------------------------------- */

/** The fluffy tuft on its poll, in the head's frame: puffs of cream fluff between the ears, a few locks falling forward over the brow. */
function tuftMesh(s: Cow, n: number): Mesh {
  const T = s.tuft * (s.head.skull.r[0] / 0.72), out: Mesh[] = [];
  const spots: Array<[number, number, number, number]> = [[0, -0.25, 1, 1], [0.38, -0.3, 0.9, 0.82], [-0.38, -0.3, 0.9, 0.82], [0.2, 0.15, 0.95, 0.8], [-0.2, 0.15, 0.95, 0.8], [0, 0.32, 0.88, 0.72]];
  spots.forEach(([x, y, z, k], q) => {
    const e = onSkull(s, [x, y, z]), r = T * k * (0.85 + 0.25 * jitter(q + 2));
    out.push(puffOf(add(e.p, scale(e.n, r * 0.35)), [r, r, r * 0.85], n, q % 3 === 2 ? 'coatLight' : 'mark'));
  });
  for (let q = 0; q < 3; q++) {
    const sd = q - 1, e = onSkull(s, [sd * 0.22, 0.42, 0.85]);
    out.push(tuftOf(add(e.p, scale(e.n, T * 0.4)), [sd * 0.25, 1, 0.1], T * 1.3, T * 0.42, 'mark', [0, 0.3, -1], n));
  }
  return merge(...out);
}

/**
 * The crown, in the head's frame: white flowers and leaves on top of its head
 * between its horns, the middle one biggest, the leaves fanned out behind them.
 */
function crownOf(s: Cow, fine: boolean): Mesh {
  const C = s.crown!, out: Mesh[] = [];
  for (let q = 0; q < C.n; q++) {
    const f = C.n > 1 ? q / (C.n - 1) : 0.5, a = lerp(-1.05, 1.05, f);
    const dir: V3 = [Math.sin(a) * 0.9, -0.05 + 0.2 * Math.cos(a), 0.8 + 0.2 * Math.cos(a)];
    const e = onSkull(s, dir);
    const r = C.r * (0.9 + 0.2 * jitter(q + 3)) * (Math.abs(a) < 0.4 ? 1.18 : 1) * (s.head.skull.r[0] / 0.66);
    const nn = unit(add(e.n, [Math.sin(a) * 0.2, 0.6, 0.2]));
    out.push(flowerOf(add(e.p, scale(e.n, r * 0.7)), nn, r, fine, q * 0.9));
    const back = unit(add(scale(e.n, 0.4), [Math.sin(a) * 0.7, -0.8, 0.2]));
    out.push(leafOf(add(e.p, scale(e.n, r * 0.3)), back, e.n, r * 2.2, r * 0.75));
    if (q % 2 === 0) out.push(leafOf(add(e.p, scale(e.n, r * 0.3)), add(back, [Math.sin(a) * 0.9, 0.9, 0]), e.n, r * 1.6, r * 0.55, ['moss', 'leafDark', 'leafDark']));
  }
  return merge(...out);
}

/**
 * The calf's garland, in the collar's frame: a green vine round the root of
 * its neck with leaves along it lying back over the shoulders and hanging at
 * the throat, and white flowers at its front and sides.
 */
function garlandOf(s: Cow, fine: boolean, n: number): Mesh {
  const G = s.garland!, out: Mesh[] = [];
  const K = 16, at = (q: number): V3 => onNeck(s, -0.04 - 0.06 * Math.cos((q / K) * TAU + Math.PI / 2), (q / K) * TAU, 0.02).p;
  const pts = Array.from({ length: K + 1 }, (_, q) => at(q));
  out.push(vine([...pts, pts[1]], 0.03, n));
  for (let q = 0; q < G.count; q++) {
    const th = (q / G.count) * TAU + 0.2 * (jitter(q) - 0.5), e = onNeck(s, -0.04 - 0.06 * Math.cos(th + Math.PI / 2), th, 0.03);
    const front = Math.max(0, -Math.sin(th));
    const dir = unit(add(scale(e.n, 0.6), [0, -0.5 + 0.5 * front, -0.6]));
    out.push(leafOf(e.p, dir, add(e.n, [0, 0, 0.6]), G.len * (0.85 + 0.3 * jitter(q + 3)), G.w, q % 3 ? ['leaf', 'leafDark', 'leafDark'] : ['moss', 'leafDark', 'leafDark'], 0.1));
  }
  for (let q = 0; q < G.flowers; q++) {
    const f = G.flowers > 1 ? q / (G.flowers - 1) : 0.5, th = lerp(-0.35, -Math.PI + 0.35, f);
    const e = onNeck(s, -0.1, th, 0.06);
    out.push(flowerOf(e.p, add(e.n, [0, 0.3, 0.3]), G.w * 1.25, fine, q));
  }
  return merge(...out);
}

/**
 * A braid down one side of the neck, in the neck's frame: from behind the ear
 * down the side of the neck to the shoulder, a plait of cream locks crossing
 * over by turns, tied off in gold with a tuft below the tie; and the right
 * one built, the left its mirror. On the Lactisovereign, white flowers along
 * its lower half.
 */
function braidOf(s: Cow, fine: boolean, n: number): Mesh {
  const B = s.braid!, out: Mesh[] = [], w = s.neck.w, L = s.neck.len, lean = s.neck.lean * DEG;
  // Along the side of the neck from behind the ear to its root, then on down over the shoulder: a curve through four points.
  const down: V3 = [0, Math.sin(lean), -Math.cos(lean)];
  const P0: V3 = [w * 0.82, -w * 0.15, L * 1.0], P1: V3 = [w * 1.0 + B.w * 0.5, w * 0.05, L * 0.45];
  const P2: V3 = [w * 1.0 + B.w * 0.6, w * 0.3, -L * 0.1], P3: V3 = add(P2, scale(down, Math.max(0.1, B.len - L * 1.1)));
  const path = (u: number): V3 => {
    const v = 1 - u;
    return add(add(scale(P0, v * v * v), scale(P1, 3 * v * v * u)), add(scale(P2, 3 * v * u * u), scale(P3, u * u * u)));
  };
  const N = Math.max(5, Math.round(B.len / (B.w * 0.95)));
  for (let q = 0; q < N; q++) {
    const u0 = q / N, u1 = (q + 1) / N, a = path(u0), b = path(u1), d = unit(sub(b, a)), side = unit(cross(d, [1, 0, 0]));
    const alt = q % 2 ? 1 : -1, c = add(scale(add(a, b), 0.5), scale(side, alt * B.w * 0.32));
    const axis = unit(add(d, scale(side, -alt * 0.8)));
    const r = B.w * (1 - 0.25 * u0);
    out.push(orbAlong(c, axis, [r * 0.95, r * 0.7, len3(sub(b, a)) * 1.0], fine ? 8 : 6, 4, q % 2 ? 'mark' : 'belly'));
  }
  // The tie, and the tuft below it.
  const end = path(1), next = path(1.04), d = unit(sub(next, end));
  out.push(tube([add(end, scale(d, -B.w * 0.18)), add(end, scale(d, B.w * 0.18))], B.w * 0.6, B.w * 0.6, 7, (ring) => (ring ? 'metalLit' : 'metal')));
  for (let q = 0; q < 4; q++) {
    const a = (q / 4) * TAU;
    out.push(tuftOf(add(end, [Math.cos(a) * B.w * 0.18, Math.sin(a) * B.w * 0.18, 0]), add(d, [Math.cos(a) * 0.35, Math.sin(a) * 0.35, 0]), B.w * 2.2, B.w * 0.45, q % 2 ? 'mark' : 'coatLight', down, n));
  }
  if (s.stage === 2) {
    for (let q = 0; q < 3; q++) {
      const p = path(0.55 + 0.17 * q);
      out.push(flowerOf(add(p, [B.w * 0.7, 0.02, 0]), [1, 0.4 + 0.2 * q, 0.2], 0.15, fine, q * 1.3));
      out.push(leafOf(add(p, [B.w * 0.4, 0, 0]), [0.6, -0.3, -0.7], [1, 0, 0.2], 0.3, 0.1));
    }
  }
  return merge(...out);
}

/**
 * The loose mane, in the neck's frame: long cream locks down the crest of the
 * neck behind the braids and at the throat, longer toward the chest, on the
 * Lactisovereign long and flowing into the fur of its chest.
 */
function maneOf(s: Cow, n: number): Mesh {
  const out: Mesh[] = [], w = s.neck.w, len = s.neck.len, L = s.mane;
  const lean = s.neck.lean * DEG, down: V3 = [0, Math.sin(lean) + 0.2, -Math.cos(lean)];
  const rows = 3 + s.stage + (n > 3 ? 1 : 0);
  for (let r = 0; r < rows; r++) {
    const z = len * lerp(1.0, 0.1, r / (rows - 1));
    // Over the crest and down its sides, and at the throat.
    for (const th of [-Math.PI / 2 - 0.5, -Math.PI / 2, -Math.PI / 2 + 0.5, Math.PI / 2 - 0.3, Math.PI / 2 + 0.3, 0.25, Math.PI - 0.25]) {
      const x = Math.cos(th), y = Math.sin(th), id = r * 11 + Math.round(th * 10);
      const crest = y < -0.5;
      const root: V3 = [x * w * 0.85, y * w * 0.85, z];
      out.push(tuftOf(root, add(down, [x * 0.4, y * 0.3, 0]), L * (crest ? 0.8 : 1) * (0.6 + 0.3 * r / rows + 0.3 * jitter(id)), w * 0.3, jitter(id + 2) > 0.3 ? 'mark' : 'coatLight', down, n));
    }
  }
  return merge(...out);
}

/** The shaggy cream bib over the chest, in the collar's frame: round puffs of fluff, and soft locks hanging from under them. */
function chestOf(s: Cow, n: number): Mesh {
  const out: Mesh[] = [], L = s.shag.chest, N = 6 + s.stage * 2, P = L * 0.42 + 0.04;
  for (let q = 0; q < N; q++) {
    const f = N > 1 ? q / (N - 1) : 0.5, th = lerp(-0.3, -Math.PI + 0.3, f), front = Math.max(0, -Math.sin(th));
    const at = onNeck(s, -0.1 - 0.12 * front, th, P * 0.2);
    out.push(puffOf(at.p, [P * (0.9 + 0.3 * front), P * (0.9 + 0.3 * front), P * (0.8 + 0.2 * jitter(q))], n, jitter(q + 40) > 0.25 ? 'mark' : 'coatLight'));
    for (const r of n > 3 ? [0, 1] : [0]) {
      const lo = onNeck(s, -0.2 - r * L * 0.5 - 0.15 * front, th + 0.18 * r, -0.02);
      out.push(tuftOf(lo.p, add(scale(lo.n, 0.35), [0, 0.1, -1]), L * (0.8 + 0.4 * jitter(q * 3 + r)) * (0.7 + 0.5 * front), 0.06 + 0.04 * s.stage + 0.04 * front, 'mark', [0, 0.3, -1], n));
    }
  }
  return merge(...out);
}

/**
 * The shaggy fur on a lower leg, in its bone's frame: a fringe of long soft
 * locks down the back and sides of it from below the knee, hanging to the
 * hoof, and a ring of short ones round the top of the hoof; cream, a warmer
 * lock here and there. On the Lactisovereign the fringe starts higher.
 */
function legFur(s: Cow, lower: number, seed: number, n: number): Mesh {
  const out: Mesh[] = [], R = s.thick * 0.5, L = s.shag.leg;
  const fine = n > 3, back = fine ? 7 : 5, ring = fine ? 7 : 5;
  const from = s.stage === 2 ? 0.25 : 0.45;
  for (let q = 0; q < back; q++) {
    const id = seed + q, f = back > 1 ? q / (back - 1) : 0.5;
    // Round the back of the leg from one side to the other, the middle ones the longest and rooted highest.
    const th = -Math.PI / 2 + lerp(-1.5, 1.5, f), mid = 1 - Math.abs(2 * f - 1);
    const h = lerp(0.72, from, mid) + 0.06 * (jitter(id) - 0.5);
    const root: V3 = [Math.cos(th) * R * 0.92, Math.sin(th) * R * 0.92, -lower * h];
    const reach = (lower * (1 - h) + s.hoof * 0.2) * 0.95;
    out.push(tuftOf(root, [Math.cos(th) * 0.12, Math.sin(th) * 0.16 - 0.06, -1], reach * (0.95 + 0.1 * jitter(id + 3)), s.thick * 0.2, jitter(id + 5) > 0.3 ? 'mark' : 'belly', [0, -0.1, -1], n));
  }
  for (let q = 0; q < ring; q++) {
    const id = seed + 40 + q, th = (q / ring) * TAU + 0.5 * jitter(id);
    const root: V3 = [Math.cos(th) * R * 0.95, Math.sin(th) * R * 0.95, -lower * 0.8];
    out.push(tuftOf(root, [Math.cos(th) * 0.15, Math.sin(th) * 0.15, -1], L * (0.6 + 0.25 * jitter(id + 3)), s.thick * 0.2, jitter(id + 5) > 0.35 ? 'mark' : 'belly', [0, 0, -1], n));
  }
  return merge(...out);
}

/**
 * The udder, in the trunk's frame: a soft pink bag under the belly in front
 * of the hind legs, in two halves, and four teats under it.
 */
function udderOf(s: Cow, n: number, k: number): Mesh {
  const U = s.udder, y = alongBody(s, 0.3), e = onBody(s, y, -Math.PI / 2), c: V3 = [0, y, e.p[2] - U * 0.2];
  const out: Mesh[] = [
    orb(add(c, [U * 0.3, 0, 0]), [U * 0.55, U * 0.8, U * 0.62], n + 2, k + 1, 'shell'),
    orb(add(c, [-U * 0.3, 0, 0]), [U * 0.55, U * 0.8, U * 0.62], n + 2, k + 1, 'shell'),
  ];
  for (const sx of [1, -1]) {
    for (const sy of [1, -1]) {
      const top = add(c, [sx * U * 0.36, sy * U * 0.42, -U * 0.45]);
      out.push(tube([top, add(top, [sx * 0.02, sy * 0.02, -U * 0.42])], [U * 0.13, U * 0.1], [U * 0.13, U * 0.1], 6, 'shellDark'));
    }
  }
  return merge(...out);
}

/**
 * The Milkmere's vine, in the trunk's frame: a green vine along the top of
 * its back from the withers to the root of its tail, wandering a little from
 * side to side, its leaves lying down over its back and its flanks either side
 * and white flowers along it.
 */
function backVine(s: Cow, fine: boolean, n: number): Mesh {
  const V = s.vine!, B = s.body, out: Mesh[] = [];
  const y0 = B.y[5] - 0.05, y1 = B.y[1] + 0.05, K = 18;
  const on = (u: number): { p: V3; n: V3 } => onBody(s, lerp(y0, y1, u), Math.PI / 2 + 0.22 * Math.sin(u * 9.5));
  const pts = Array.from({ length: K + 1 }, (_, q) => { const e = on(q / K); return add(e.p, scale(e.n, 0.035)); });
  out.push(vine(pts, 0.05, n));
  for (let q = 0; q < V.leaves; q++) {
    const u = (q + 0.5) / V.leaves, e = on(u), sd = q % 2 ? 1 : -1;
    // Down the flank, back toward the tail a little.
    const side = onBody(s, e.p[1], Math.PI / 2 - sd * 0.9);
    const dir = unit(add(sub(side.p, e.p), [0, -0.15, 0]));
    const L = 0.46 * (0.85 + 0.3 * jitter(q + 7));
    out.push(leafOf(add(e.p, scale(e.n, 0.04)), dir, e.n, L, L * 0.4, q % 3 ? ['leaf', 'leafDark', 'leafDark'] : ['moss', 'leafDark', 'leafDark'], 0.05, 0.15));
  }
  for (let q = 0; q < V.flowers; q++) {
    const u = (q + 0.3) / V.flowers, e = on(u), sd = q % 2 ? 0.35 : -0.35;
    const at = onBody(s, e.p[1], Math.PI / 2 + 0.22 * Math.sin(u * 9.5) + sd);
    out.push(flowerOf(add(at.p, scale(at.n, 0.09)), add(at.n, [0, 0.2, 0.3]), 0.22, fine, q));
  }
  return merge(...out);
}

/**
 * A fern leaf along a run of points on a surface, each with the way out of
 * the surface there, `w` across at its widest: a broad blade whose edge is cut
 * into rounded lobes either side of its rib, dark at its root and bright toward
 * its tip, and its underside.
 */
function fernOf(rib: readonly V3[], ns: readonly V3[], w: number, fine: boolean): Mesh {
  const K = rib.length - 1, L: V3[] = [], R: V3[] = [];
  for (let k = 1; k < K; k++) {
    const u = k / K, d = unit(sub(rib[k + 1], rib[k - 1])), side = unit(cross(d, ns[k]));
    const lobe = fine ? (k % 2 ? 1 : 0.7) : 1, ww = w * Math.sin(Math.PI * Math.min(1, u * 1.12) ** 0.7) * (1 - 0.3 * u) * lobe;
    L.push(add(add(rib[k], scale(side, -ww)), scale(ns[k], -ww * 0.15)));
    R.push(add(add(rib[k], scale(side, ww)), scale(ns[k], -ww * 0.15)));
  }
  const v: V3[] = [...rib, ...L, ...R], n = rib.length, cutK = Math.max(1, Math.floor(K * 0.35));
  const edge = (side0: number, k: number): number => n + side0 * (K - 1) + (k - 1);
  const half = (side0: number): Face[] => [
    { i: [...Array.from({ length: cutK + 1 }, (_, k) => k), ...Array.from({ length: cutK }, (_, k) => edge(side0, cutK - k))], m: 'moss' },
    { i: [...Array.from({ length: K - cutK + 1 }, (_, k) => cutK + k), ...Array.from({ length: K - cutK }, (_, k) => edge(side0, K - 1 - k))], m: side0 ? 'leaf' : 'leafDark' },
  ];
  const under = (side0: number): Face => ({ i: [...Array.from({ length: n }, (_, k) => k), ...Array.from({ length: K - 1 }, (_, k) => edge(side0, K - 1 - k))], m: 'leafDark' });
  const mid = ns.reduce((t, x) => add(t, x), [0, 0, 0] as V3);
  const fs: Face[] = [...half(0), ...half(1), under(0), under(1)];
  return mesh(v, wound(v, fs, [mid, mid, mid, mid, scale(mid, -1), scale(mid, -1)]));
}

/**
 * The Lactisovereign's mantle, in the trunk's frame: a cape of big fern
 * leaves laid from the spine down either flank from its withers to its hips,
 * overlapping, each lying on the coat and its tip lifting off it past its
 * side; and soft cushions of moss down the spine over their roots.
 */
function mantleOf(s: Cow, fine: boolean): Mesh {
  const M = s.mantle!, B = s.body, out: Mesh[] = [];
  const y0 = B.y[5] - 0.1, y1 = B.y[1] + 0.2, F = fine ? 8 : 7, K = fine ? 11 : 6;
  for (const sd of [1, -1]) {
    for (let q = 0; q < F; q++) {
      const u = (q + 0.5 * (sd > 0 ? 0 : 1)) / F, id = 300 + q * 3 + (sd > 0 ? 0 : 1), y = lerp(y0, y1, u);
      const reach = (1.05 + 0.2 * jitter(id)) * (0.8 + 0.25 * Math.sin(Math.PI * lerp(0.1, 0.9, u)));
      const rib: V3[] = [], ns: V3[] = [];
      for (let k = 0; k <= K; k++) {
        const f = k / K, e = onBody(s, y - 0.3 * f, Math.PI / 2 - sd * (0.1 + reach * f));
        // Lying on the coat, and lifting off it toward its tip, which curls out.
        rib.push(add(e.p, scale(e.n, 0.05 + 0.12 * f * f)));
        ns.push(e.n);
      }
      out.push(fernOf(rib, ns, M.r * 1.0, fine));
    }
  }
  for (let q = 0; q < M.clumps; q++) {
    const u = q / (M.clumps - 1), y = lerp(y0 + 0.05, y1 - 0.05, u), swell = Math.sin(Math.PI * lerp(0.12, 0.88, u)), id = 200 + q * 7;
    const e = onBody(s, y, Math.PI / 2 + 0.25 * (jitter(id) - 0.5));
    const R = M.r * (0.55 + 0.3 * swell) * (0.85 + 0.3 * jitter(id + 2));
    out.push(clumpOf(add(e.p, scale(e.n, R * 0.2)), e.n, R, id, fine ? 6 : 4, fine, false));
  }
  return merge(...out);
}

/** Where the lily of the valley's stem rises from, in the trunk's frame: out of the mantle over the middle of the back. */
const lilyRoot = (s: Cow): V3 => { const e = onBody(s, alongBody(s, 0.66), Math.PI / 2); return add(e.p, [0, 0, s.mantle!.r * 0.4]); };

/** The stem's arch, in the trunk's frame: up out of the mantle and over backward toward the rump, coming down at its end, `u` nought to one along it. */
function lilyArch(s: Cow, u: number): V3 {
  const r = lilyRoot(s), R = s.mantle!.arch * 0.68, a = u * Math.PI * 0.8;
  return add(r, [0.06 * Math.sin(u * 3), -R * (1 - Math.cos(a)), R * Math.sin(a) * 1.05]);
}

/** Where each bell hangs from, in the trunk's frame: along the arch from a third of the way on, each a little apart. */
function bellsAt(s: Cow): V3[] {
  const M = s.mantle!;
  return Array.from({ length: M.bells }, (_, q) => {
    const u = 0.32 + 0.68 * (q / Math.max(1, M.bells - 1));
    const p = lilyArch(s, u), sd = q % 2 ? 1 : -1;
    return add(p, [sd * M.bell * 0.45, 0, -M.bell * 0.7]);
  });
}

/** A bell hung at `at`, tipped out toward its side by a third of a right angle so its mouth shows from the side. */
function hungAt(m: Mesh, at: V3, side: number): Mesh {
  const a = -side * 30 * DEG, c = Math.cos(a), sn = Math.sin(a);
  return mesh(m.v.map((p) => add([p[0] * c + p[2] * sn, p[1], -p[0] * sn + p[2] * c], at)), m.f);
}

/** The stem, its leaves and each bell's stalk, in the trunk's frame. */
function lilyStem(s: Cow, n: number): Mesh {
  const M = s.mantle!, out: Mesh[] = [];
  const pts = Array.from({ length: 13 }, (_, q) => lilyArch(s, q / 12));
  out.push(tube(pts, pts.map((_, q) => 0.075 * (1 - 0.5 * q / 12)), pts.map((_, q) => 0.075 * (1 - 0.5 * q / 12)), Math.max(5, n), 'stem'));
  bellsAt(s).forEach((b, q) => {
    const u = 0.32 + 0.68 * (q / Math.max(1, M.bells - 1)), from = lilyArch(s, u);
    out.push(tube(curve(from, add(scale(add(from, b), 0.5), [0, 0, M.bell * 0.45]), b, 3), 0.035, 0.035, 4, 'stem'));
  });
  return merge(...out);
}

/**
 * A golden tendril down one shoulder, in the trunk's frame (the right one;
 * the left its mirror): from the edge of the mantle down over the shoulder and
 * the flank, ending in a spiral curl laid on its side, and a second, shorter
 * one curling back toward the rump.
 */
function tendrilOf(s: Cow): Mesh {
  const out: Mesh[] = [];
  const trail = (from: number, to: number, th0: number, th1: number, curl: number, r: number, turns: number): void => {
    const pts: V3[] = [];
    const K = 14;
    for (let k = 0; k <= K; k++) {
      const u = k / K, e = onBody(s, lerp(from, to, u), lerp(th0, th1, smooth(u)));
      pts.push(add(e.p, scale(e.n, 0.035)));
    }
    // The spiral: round and in, on the flank where the trail ends.
    const end = onBody(s, to, th1), [ax, ay] = across(end.n), S = 22;
    for (let k = 1; k <= S; k++) {
      const u = k / S, a = u * turns * TAU, rr = curl * (1 - 0.85 * u);
      const p = add(add(end.p, scale(end.n, 0.035)), add(scale(ax, -Math.sin(a) * rr + 0), scale(ay, (1 - Math.cos(a)) * rr * 0.9 - 0)));
      pts.push(p);
    }
    out.push(tube(pts, pts.map((_, k) => r * (1 - 0.6 * k / pts.length)), pts.map((_, k) => r * (1 - 0.6 * k / pts.length)), 5, (ring) => (ring % 4 === 1 ? 'metalLit' : 'metal')));
  };
  trail(alongBody(s, 0.82), alongBody(s, 0.62), 1.05, 0.05, 0.3, 0.04, 1.4);
  trail(alongBody(s, 0.45), alongBody(s, 0.2), 0.95, 0.25, 0.2, 0.03, 1.2);
  return merge(...out);
}

/** The tail's tuft: a big soft brush of cream locks at its end, built pointing back along -y in its link's frame. */
function tailTuft(s: Cow, n: number, k: number): Mesh {
  const T = s.tail.tuft, L = s.tail.len / 4, out: Mesh[] = [];
  out.push(tube([[0, 0, 0], [0, -L * 0.6, 0]], 0.05 + 0.015 * s.stage, 0.05 + 0.015 * s.stage, 5, 'coat'));
  out.push(orbAlong([0, -L * 0.55 - T * 0.5, 0], [0, -1, 0], [T * 0.62, T * 0.62, T * 1.05], n, k, 'mark'));
  const locks = s.stage === 2 ? 9 : 6;
  for (let q = 0; q < locks; q++) {
    const a = (q / locks) * TAU;
    out.push(tuftOf([Math.cos(a) * T * 0.3, -L * 0.5 - T * 0.4, Math.sin(a) * T * 0.3], [Math.cos(a) * 0.35, -1, Math.sin(a) * 0.35], T * (1.7 + 0.4 * jitter(q)), T * 0.42, q % 3 ? 'mark' : 'coatLight', [0, -0.2, -0.3], n));
  }
  return merge(...out);
}

/* ---- its pieces -------------------------------------------------------------------------------- */

/** How its fur is drawn: no lines inside it, only round the whole, and a light rim along its top edge. */
const FLUFF = { lines: false, sheen: 'eyeWhite' as Mat };

/** Swaying, for what stands up over the back -- the lily of the valley: each corner moved across by as much as it is over `rim`, a slow few turns a loop. */
function swaying(rim: number, k: number): (v: readonly V3[], a: Anim) => V3[] {
  return (v, a) => {
    const g = smooth(a.go), sx = k * (cyc(a.t, 3) * (1 - g) + g * Math.sin(frac(a.u) * TAU * 2)), sy = k * 0.6 * cyc(a.t, 4, 1) * (1 - g) - g * k * 0.8;
    return v.map((p) => { const h = Math.max(0, p[2] - rim); return [p[0] + sx * h, p[1] + sy * h, p[2]]; });
  };
}

/** A stage's pieces: a cow's body (`quadPieces`) with its own head, and its horns, ears, flowers, braid, fur, moss and udder. */
function cowBuild(s: Cow, lod: number): Piece[] {
  const fine = lod > 0;
  const n = cut(lod, 7, 10), k = cut(lod, 5, 6), tn = cut(lod, 3, 6);
  const skull = skullOf(s);
  const B = s.body;
  const extras: Piece[] = [
    { key: 'muzzle', mesh: muzzleMesh(s, n, k), bone: 'head', bias: 0.205, after: ['head'], front: [0, 1, 0], lines: false },
    { key: 'chin', mesh: chinOf(s, n - 1, k - 1), bone: 'jaw', bias: 0.2, after: ['head'], under: ['muzzle'], lines: false },
    { key: 'tuft', mesh: tuftMesh(s, tn), bone: 'head', bias: 0.23, after: ['head', 'ear0', 'ear1'], hide: [skull], ...FLUFF },
  ];
  if (s.shag.chest) extras.push({ key: 'chest', mesh: chestOf(s, tn), bone: 'collar', bias: 0.075, after: ['neck', 'body'], front: [0, 1, -0.2], ...FLUFF });
  if (s.garland) {
    extras.push({ key: 'garland', mesh: garlandOf(s, fine, 4), bone: 'collar', bias: 0.085, after: ['neck', 'body', 'chest'], hide: [{ c: [0, s.neck.w * 0.2, s.neck.len * 0.25], r: [s.neck.w * 0.85, s.neck.w * 0.85, s.neck.len * 0.5] }], thin: true });
  }
  if (s.crown) extras.push({ key: 'crown', mesh: crownOf(s, fine), bone: 'head', bias: 0.24, after: ['head', 'horn0', 'horn1', 'tuft', 'muzzle'], hide: [skull], thin: true });
  if (s.mane) extras.push({ key: 'mane', mesh: maneOf(s, tn), bone: 'neck', bias: 0.012, after: ['neck'], under: ['head', 'muzzle'], hide: [{ c: [0, -s.neck.w * 0.2, s.neck.len * 0.5], r: [s.neck.w * 0.85, s.neck.w * 0.8, s.neck.len * 0.7] }], ...FLUFF });
  if (s.braid) {
    const braid = braidOf(s, fine, tn);
    extras.push(
      { key: 'braidR', mesh: braid, bone: 'neck', bias: 0.09, after: ['neck', 'mane', 'chest', 'body'], front: [1, 0.3, 0], hide: [{ c: [0, 0, s.neck.len * 0.5], r: [s.neck.w * 0.9, s.neck.w * 0.9, s.neck.len * 0.8] }], sheen: 'eyeWhite' },
      { key: 'braidL', mesh: mirrorX(braid), bone: 'neck', bias: 0.09, after: ['neck', 'mane', 'chest', 'body'], front: [-1, 0.3, 0], hide: [{ c: [0, 0, s.neck.len * 0.5], r: [s.neck.w * 0.9, s.neck.w * 0.9, s.neck.len * 0.8] }], sheen: 'eyeWhite' },
    );
  }
  if (s.udder) extras.push({ key: 'udder', mesh: udderOf(s, n, k), bone: 'trunk', bias: 0.005, after: ['body'], front: [0, 0, -1] });
  if (s.vine) extras.push({ key: 'vine', mesh: backVine(s, fine, 4), bone: 'trunk', bias: 0.05, after: ['body'], hide: bodySolids(s, 0.98), thin: true });
  if (s.mantle) {
    const t = tendrilOf(s);
    extras.push(
      { key: 'tendrilR', mesh: t, bone: 'trunk', bias: 0.045, after: ['body'], front: [1, 0, 0], hide: bodySolids(s, 0.99), thin: true },
      { key: 'tendrilL', mesh: mirrorX(t), bone: 'trunk', bias: 0.045, after: ['body'], front: [-1, 0, 0], hide: bodySolids(s, 0.99), thin: true },
      { key: 'mantle', mesh: mantleOf(s, fine), bone: 'trunk', bias: 0.06, after: ['body', 'tendrilR', 'tendrilL'], hide: bodySolids(s, 0.9), lines: false, sheen: 'leaf' },
      { key: 'lily', mesh: lilyStem(s, 5), bone: 'trunk', bias: 0.07, after: ['mantle'], thin: true, bent: swaying(lilyRoot(s)[2], 0.05) },
      ...bellsAt(s).map((b, q): Piece => ({
        key: `bell${q}`, mesh: hungAt(bellOf(s.mantle!.bell * (0.85 + 0.3 * jitter(q + 4)), fine ? 10 : 7), b, q % 2 ? 1 : -1),
        bone: 'trunk', bias: 0.075 + 0.001 * q, after: ['lily', 'mantle'], thin: true, bent: swaying(lilyRoot(s)[2], 0.05),
      })),
    );
  }
  // Each horn, after the head and over the ear; the far one under the head.
  if (s.horn) {
    const horn = hornOf(s, n, fine);
    extras.push(
      { key: 'horn1', mesh: horn, bone: 'head', bias: 0.22, after: ['head', 'tuft'], front: [1, 0, 0], hide: [skull] },
      { key: 'horn0', mesh: mirrorX(horn), bone: 'head', bias: 0.22, after: ['head', 'tuft'], front: [-1, 0, 0], hide: [skull] },
    );
  }
  const legs = (fore: boolean): { upper: [number, number, number, number]; lower: [number, number, number, number]; foot: Mesh; mat: Mat } => {
    const L = fore ? foreLen(s) : hindLen(s), w = s.thick;
    // The upper leg rooted well up inside the barrel and no wider than fits in it, so however it swings its top never shows past it.
    return { upper: [fore ? 0.22 : 0.2, -L, w * (fore ? 1.12 : 1.25), w * 0.92], lower: [0, -L, w * 0.8, w * 0.66], foot: cloven(w * 0.82, s.hoof, n), mat: 'coat' };
  };
  const tl = s.tail.len / 4, tr = 0.055 + 0.015 * s.stage;
  const link = (q: number): Mesh => tube([[0, 0.02, 0], [0, -tl, 0]], tr * (1 - 0.12 * q), tr * (1 - 0.12 * q), 5, 'coat', { seam: 'start' });
  const pieces = quadPieces({
    n, k,
    body: { ...B, belly: false },
    neck: { w: s.neck.w, h: s.neck.w * 1.08, len: s.neck.len, mat: 'coat' },
    head: { c: skull.c, r: skull.r, eye: { dir: [0.6, 0.6, 0.4], size: 0.01 } },
    ear: earOf(s, n),
    earTurn: -10,
    tail: [link(0), link(1), link(2), tailTuft(s, n - 1, k - 1)],
    fore: legs(true),
    hind: legs(false),
    breath: 0.03,
    extras,
  });
  // The shaggy fur on each lower leg.
  for (const [key, side, fore] of s.shag.leg ? [['fl', -1, true], ['fr', 1, true], ['hl', -1, false], ['hr', 1, false]] as Array<[string, number, boolean]> : []) {
    const lower = fore ? foreLen(s) : hindLen(s);
    pieces.push({ key: `${key}fur`, mesh: legFur(s, lower, key.charCodeAt(0) * 7 + key.charCodeAt(1), tn), bone: `${key}1`, bias: 0.04, after: [`${key}1`, 'body', 'udder'], front: [side * 0.7, fore ? 0.7 : -0.7, 0], ...FLUFF });
  }
  return pieces.map((pc) => {
    if (pc.key === 'head') return { ...pc, mesh: headOf(s, n, k, false), shut: headOf(s, n, k, true), hide: [skull, muzzleOf(s)] };
    if (pc.key === 'tail3') return { ...pc, ...FLUFF };
    if (pc.key === 'body') return { ...pc, mesh: bodyMesh(s, lod) };
    if (pc.key === 'ear0' || pc.key === 'ear1') return { ...pc, bias: 0.225, after: ['head', pc.key === 'ear0' ? 'horn0' : 'horn1'] };
    return pc;
  });
}

/**
 * The barrel: rings smoothed along it, round in the middle and drawn in to
 * each end, cream all over, and its darker patches laid on it, big ragged
 * rounds, each side its own.
 */
function bodyMesh(s: Cow, lod: number): Mesh {
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
  const barrel = tube(Y.map((y, q) => [0, y, Z[q]] as V3), Wd, H, N, 'coat');
  // The patches: a ragged round of the darker colour on each side, laid on the barrel; the left side's turned a little, so the
  // two sides are not one another's mirror.
  const patches: Disc[] = [];
  s.patches.forEach(([u, th0, r], q) => {
    for (const sd of [1, -1]) {
      const uu = sd > 0 ? u : clamp(u + 0.08 * (jitter(q + 50) - 0.5), 0.05, 0.95), y0 = alongBody(s, uu), pts: V3[] = [];
      const K = 14;
      for (let k2 = 0; k2 < K; k2++) {
        const a = (k2 / K) * TAU, rr = r * (0.72 + 0.42 * jitter(q * 17 + k2 + (sd > 0 ? 0 : 5)));
        const th = th0 + (Math.sin(a) * rr) / Math.max(0.3, B.h[3]), e = onBody(s, y0 + Math.cos(a) * rr * 1.25, th);
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

const WHITE: RGB = [255, 252, 244];
const YELLOW: RGB = [252, 214, 96];
const PINK: RGB = [246, 186, 196];
const GREEN: RGB = [128, 176, 84];
const INK: RGB = [90, 70, 80];
const PETALS: readonly RGB[] = [WHITE, WHITE, YELLOW, PINK];
const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;

/** Whether a point is on the viewer's side of a body whose middle is at `c`: drawn over the body if so, under it if not. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
/** How big a stage's things in the air are drawn, in the units of the screen they are drawn on. */
const bigness = (s: Cow): number => 2 * Math.max(0.9, (s.len / 2.15) ** 0.8);

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

/** The blow: a burst of petals and leaves off its crown or garland, and a sparkle; on the bigger stages more of them, further. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Cow, b: Bones, at: Bones, t: number, front: boolean): void {
  const hit = COW_HITS[s.stage], since = (t - hit) * ACT_SECS.strike;
  if (since <= 0) return;
  const big = bigness(s) * (1 + 0.12 * s.stage), far = big / 2, fade = 1 - ramp(t, hit + 0.18, 1);
  const impact = place(at.head, browOf(s)), mid = b.body.t;
  const count = 9 + 3 * s.stage;
  for (let q = 0; q < count; q++) {
    const th = (q / count) * TAU + jitter(q) * 0.6;
    const v: V3 = [Math.cos(th) * (4.4 + 2 * jitter(q + 3)) * far, (1.6 + 2.4 * jitter(q + 5)) * far, (5 + 4 * Math.max(0, Math.sin(th)) + 2.4 * jitter(q + 7)) * far];
    const p = flutter(impact, v, since, 3.2, 2.5 * far);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    petalAt(g, x, y, (0.2 + 0.08 * jitter(q + 9)) * big, q % 4 === 3 ? GREEN : PETALS[q % 4], fade, q + since * (6 + 4 * jitter(q)));
  }
  const flash = 1 - ramp(since, 0, 0.1);
  if (flash > 0 && nearSide(impact, mid, view) === front) {
    const [x, y] = onScreen(view, impact);
    sparkle(g, x, y, (0.3 + 0.2 * ramp(since, 0, 0.06)) * big, WHITE, flash, 0.3);
  }
}

/** Evolving: petals and leaves drawn in round it in a rising spiral, a burst of them at the turn, and a sparkle on its brow. */
function evolveFx(g: CanvasRenderingContext2D, view: View, s: Cow, b: Bones, t: number, front: boolean): void {
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
      petalAt(g, x, y, 0.22 * big, q % 3 === 2 ? GREEN : PETALS[q % 4], 1 - burst / 0.6, th + burst * 8);
    }
  }
  const flash = hump(t, 0.5, 0.08);
  if (flash > 0 && front) {
    const [x, y] = onScreen(view, place(b.head, [0, 0, s.head.skull.r[2] * 1.6]));
    sparkle(g, x, y, 0.7 * big * flash, WHITE, flash, t * 4);
  }
}

/** Light: a soft flash at the brow as the blow lands; and a warm glow on its crown at the turn of evolving. */
function cowGlow(s: Cow, b: Bones, a: Anim): Array<{ p: V3; r: number; c: RGB; a: number }> {
  const act = a.act;
  if (act?.kind === 'strike') {
    const k = hump(act.t, COW_HITS[s.stage] + 0.02, 0.1);
    return k > 0 ? [{ p: place(b.head, browOf(s)), r: 0.5 * bigness(s) + 0.4 * s.stage, c: [255, 246, 226], a: 0.4 * k }] : [];
  }
  if (act?.kind === 'evolve') {
    const k = hump(act.t, 0.5, 0.12);
    return k > 0 ? [{ p: place(b.head, [0, 0, s.head.skull.r[2] * 1.4]), r: 0.6 * bigness(s), c: [255, 244, 220], a: 0.45 * k }] : [];
  }
  return [];
}

/* ---- the kinds ----------------------------------------------------------------------------- */

/** A stage as a kind: its bones, pieces and colours, and what it throws about as it strikes and evolves. */
function cowKind(s: Cow): Kind {
  const bones = cowBones(s);
  const atHit = (a: Anim): Bones => bones({ ...a, act: { kind: 'strike', t: COW_HITS[s.stage] } });
  return {
    bones,
    build: (lod) => cowBuild(s, lod),
    // The variant's markings for its cream and its coat for the patches on it; everything it wears, and its horns, hooves, udder
    // and eyes, the same on every variant.
    palette: (coat0, mark0) => {
      const cream = mix(mark0, [255, 246, 236], 0.1), patch = mix(coat0, [90, 80, 80], 0.1);
      return coatPalette(coat0, mark0, {
        coat: cream,
        coatDark: patch,
        coatLight: mix(cream, [236, 214, 176], 0.5),
        mark: mix(cream, [255, 252, 246], 0.4),
        belly: [238, 214, 178],
        muzzle: [248, 212, 204],
        inner: [244, 176, 184],
        nose: [196, 120, 128],
        lid: mix(patch, [50, 36, 36], 0.5),
        water: [142, 92, 52],
        eye: [44, 26, 22],
        eyeWhite: [255, 255, 255],
        glint: [255, 255, 255],
        horn: [246, 232, 196],
        hornDark: [214, 176, 98],
        hoof: [82, 62, 54],
        shell: [246, 186, 190],
        shellDark: [232, 160, 168],
        leaf: [150, 190, 82],
        leafDark: [90, 132, 64],
        moss: [104, 140, 58],
        stem: [118, 158, 74],
        petal: [255, 253, 248],
        bloom: [250, 206, 70],
        feather: [253, 251, 240],
        featherDark: [222, 234, 168],
        metal: [226, 184, 84],
        metalLit: [255, 230, 150],
        metalDark: [176, 132, 60],
      }, 30);
    },
    shadow: [s.len * 0.75 + 0.2, s.body.w[4] + 0.25],
    stride: 1.3,
    size: s.size,
    blinks: 5,
    acts: ['strike'],
    // Evolving, the motes rising round it are the cream of its coat and the green of its leaves.
    motes: [[255, 248, 226], [170, 206, 110]],
    glow: (b, a) => cowGlow(s, b, a),
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (!act) return;
      if (act.kind === 'strike') strikeBurst(g, view, s, b, atHit(a), act.t, front);
      else if (act.kind === 'evolve') evolveFx(g, view, s, b, act.t, front);
    },
  };
}

export const CREAMCALF = cowKind(CREAMCALF_LOOK);
export const MILKMERE = cowKind(MILKMERE_LOOK);
export const LACTISOVEREIGN = cowKind(LACTISOVEREIGN_LOOK);
