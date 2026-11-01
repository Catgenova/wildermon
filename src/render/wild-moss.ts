import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, DEG, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, orbAlong, paint,
  scale, shadowOf, smooth, sub, TAU, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { blade, cut } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The moss line: the Mossnib, a small round pill-bug of a beetle on six short dark legs tipped in cream and green, its domed
 * sage shell in overlapping plates each edged in cream and marked with cream swirls, a tuft of bright moss along its top, two
 * green leaf antennae curving up and back, and a small cream face with big dark olive eyes; which grows into the Mossshear,
 * bigger and longer, a hermit crab's stance on legs banded brown, cream and green, heavier moss along the ridge of its shell
 * and green leaf blades rising off its back, a cream head plate with leaf horns over olive eyes, and two forward pincers, each
 * a curved scissor blade, cream, mossy on top, serrated along its inside; and then the Mossreaver, big and heavy, its dome
 * deep in moss with small white flowers in it, a big cream swirl on its shell, tall leaf blades fanned up off its back and leaf
 * fins hanging under its rim, and two huge serrated scythes. The species is still `dulla` underneath, as saves and the database
 * know it: the moss cutter.
 *
 * All three are built by one set of functions from a description of the stage (`Moss`). Its front is `y`, its right `x`, up
 * `z`. Six legs, three a side, go in two sets of three by turns, as a beetle's do -- quick, a scuttle; each foot stays where it
 * was put while it is down.
 *
 * At its task it cuts the moss in front of it: the Mossnib bows its head to the patch and nips at it with its jaws, three
 * nips, and lifts its head with the cut tuft; the Mossshear and the Mossreaver put their blades down to the patch either side
 * of it, open, and shut them across each other as scissors do, twice, and lift the cut moss.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Three legs a side, front to back: hips across, up and along; each foot's turn from straight out (degrees, forward positive); the leg's two parts; how far out a foot stands; how thick. */
interface Legs { x: number; z: number; ys: number[]; fan: number[]; upper: number; lower: number; reach: number; thick: number }

/**
 * The shell: a dome along `y` from its back (`y0`) toward its front (`y1`, where it would come to its end), cut off open at
 * `cut` of that; `w` across and `h` high at its widest, its rim at `z0` on the body; its plates (`segs`), each standing proud of
 * the one behind it by `step`; how far under its waist the rim comes down (`lo`, radians) and flares out (`flare`); how square
 * its ends are (`p`).
 */
interface Shell { y0: number; y1: number; cut: number; w: number; h: number; z0: number; segs: number; step: number; lo: number; flare: number; p: number }

/** The scythes: the right shoulder on the body, the arm's two parts and how thick; how long the blade is; its teeth; and the wrist at rest (body frame, right side) and how the blade is turned. */
interface Scythes { at: V3; arm: [number, number]; thick: number; len: number; teeth: number; rest: { w: V3; pitch: number; yaw: number; roll: number } }

/** A leaf blade off its back: where on the shell (along, nought the back to one the front; round, radians from the top toward its right), how long and wide, how far it leans back and out (degrees). */
interface Fin { u: number; side: number; len: number; wide: number; back: number; out: number }

interface Moss {
  stage: 0 | 1 | 2;
  /** How high its middle is carried, standing. */
  high: number;
  shell: Shell;
  /** The body under it: dark brown, in rings. */
  belly: { c: V3; r: V3 };
  /** The head: its middle on the body, its half-sizes, the right eye's way out of it and its size. */
  head: { at: V3; r: V3; eye: V3; size: number };
  /** The Mossnib's two leaf antennae, from the top of its head (right one; head frame): root, bend, tip, and the leaf's width. */
  feelers: { root: V3; mid: V3; tip: V3; wide: number } | null;
  /** The bigger two's horns off the sides of the head, cream with green tips: right one (head frame), and how thick. */
  horns: { root: V3; mid: V3; tip: V3; w: number } | null;
  /** The moss along its top: from and to (along), how wide (radians either side of the top), how deep, how many clumps. */
  moss: { from: number; to: number; wide: number; deep: number; clumps: number };
  /** Small white flowers in the moss. */
  flowers: number;
  /** Cream swirls on its plates: how many, and how big the biggest. */
  swirls: { n: number; big: number };
  fins: Fin[];
  /** Leaf fins hanging under the rim. */
  skirt: number;
  legs: Legs;
  scythes: Scythes | null;
  gait: { sweep: [number, number]; duty: [number, number]; lift: [number, number]; bob: number; sway: number };
  /** How big the patch of moss it cuts is. */
  patch: number;
  size: number;
}

/** A Mossnib: small and round, a dome of four plates under a tuft of moss, two leaf antennae, a round cream face with big eyes, short legs. */
const MOSSNIB_LOOK: Moss = {
  stage: 0,
  high: 0.2,
  shell: { y0: -0.56, y1: 0.64, cut: 0.88, w: 0.5, h: 0.31, z0: 0.0, segs: 4, step: 0.045, lo: 0.26, flare: 0.55, p: 2.0 },
  belly: { c: [0, 0.02, -0.02], r: [0.32, 0.46, 0.15] },
  head: { at: [0, 0.52, -0.05], r: [0.22, 0.19, 0.17], eye: [0.36, 0.9, 0.1], size: 0.046 },
  feelers: { root: [0.09, -0.04, 0.17], mid: [0.17, 0.0, 0.46], tip: [0.2, -0.3, 0.68], wide: 0.13 },
  horns: null,
  moss: { from: 0.06, to: 0.82, wide: 0.44, deep: 0.11, clumps: 9 },
  flowers: 0,
  swirls: { n: 3, big: 0.085 },
  fins: [],
  skirt: 0,
  legs: { x: 0.28, z: -0.04, ys: [0.24, 0.0, -0.24], fan: [52, 6, -48], upper: 0.17, lower: 0.2, reach: 0.34, thick: 0.065 },
  scythes: null,
  gait: { sweep: [0.2, 0.28], duty: [0.58, 0.5], lift: [0.06, 0.08], bob: 0.018, sway: 3 },
  patch: 0.2,
  size: 5.4,
};

/** A Mossshear: longer, heavier moss along its ridge with two leaf blades up off its back, a pointed cream head plate with leaf horns, banded legs, and two scissor blades. */
const MOSSSHEAR_LOOK: Moss = {
  stage: 1,
  high: 0.3,
  shell: { y0: -0.86, y1: 0.92, cut: 0.88, w: 0.76, h: 0.5, z0: 0.02, segs: 4, step: 0.045, lo: 0.2, flare: 0.45, p: 2.1 },
  belly: { c: [0, 0.02, -0.05], r: [0.56, 0.7, 0.22] },
  head: { at: [0, 0.82, -0.02], r: [0.28, 0.3, 0.23], eye: [0.6, 0.7, -0.12], size: 0.058 },
  feelers: null,
  horns: { root: [0.18, 0.1, 0.0], mid: [0.32, 0.26, 0.2], tip: [0.27, 0.16, 0.38], w: 0.035 },
  moss: { from: 0.04, to: 0.92, wide: 0.6, deep: 0.13, clumps: 12 },
  flowers: 0,
  swirls: { n: 3, big: 0.14 },
  fins: [
    { u: 0.84, side: 0.06, len: 0.95, wide: 0.27, back: 30, out: 6 },
    { u: 0.6, side: -0.2, len: 0.82, wide: 0.25, back: 40, out: -16 },
    { u: 0.42, side: 0.26, len: 0.56, wide: 0.18, back: 48, out: 24 },
  ],
  skirt: 0,
  legs: { x: 0.44, z: -0.08, ys: [0.32, -0.06, -0.44], fan: [50, 4, -50], upper: 0.22, lower: 0.27, reach: 0.46, thick: 0.12 },
  scythes: { at: [0.3, 0.62, -0.12], arm: [0.28, 0.26], thick: 0.095, len: 0.85, teeth: 4, rest: { w: [0.56, 1.0, -0.02], pitch: -12, yaw: 4, roll: 0 } },
  gait: { sweep: [0.26, 0.36], duty: [0.6, 0.52], lift: [0.06, 0.09], bob: 0.022, sway: 2.5 },
  patch: 0.26,
  size: 5.0,
};

/** A Mossreaver: big and heavy, a dome deep in moss with flowers in it, a big cream swirl, tall leaf blades fanned off its back, fins under its rim, two huge scythes. */
const MOSSREAVER_LOOK: Moss = {
  stage: 2,
  high: 0.36,
  shell: { y0: -1.12, y1: 1.12, cut: 0.88, w: 1.0, h: 0.68, z0: 0.02, segs: 5, step: 0.05, lo: 0.2, flare: 0.45, p: 2.1 },
  belly: { c: [0, 0.02, -0.06], r: [0.74, 0.92, 0.27] },
  head: { at: [0, 1.04, -0.02], r: [0.34, 0.36, 0.27], eye: [0.6, 0.7, -0.12], size: 0.066 },
  feelers: null,
  horns: { root: [0.23, 0.12, 0.0], mid: [0.4, 0.32, 0.24], tip: [0.33, 0.2, 0.48], w: 0.045 },
  moss: { from: 0.03, to: 0.92, wide: 0.64, deep: 0.16, clumps: 15 },
  flowers: 4,
  swirls: { n: 1, big: 0.38 },
  fins: [
    { u: 0.64, side: -0.04, len: 1.4, wide: 0.36, back: 30, out: -4 },
    { u: 0.56, side: 0.24, len: 1.3, wide: 0.34, back: 38, out: 24 },
    { u: 0.54, side: -0.32, len: 1.22, wide: 0.33, back: 40, out: -30 },
    { u: 0.44, side: 0.44, len: 1.0, wide: 0.28, back: 48, out: 46 },
    { u: 0.42, side: -0.5, len: 0.95, wide: 0.27, back: 50, out: -50 },
  ],
  skirt: 7,
  legs: { x: 0.58, z: -0.1, ys: [0.42, -0.08, -0.6], fan: [50, 4, -50], upper: 0.27, lower: 0.33, reach: 0.58, thick: 0.16 },
  scythes: { at: [0.4, 0.8, -0.14], arm: [0.34, 0.32], thick: 0.125, len: 1.3, teeth: 6, rest: { w: [0.74, 1.28, -0.02], pitch: -12, yaw: 4, roll: 0 } },
  gait: { sweep: [0.3, 0.42], duty: [0.64, 0.54], lift: [0.07, 0.1], bob: 0.028, sway: 2 },
  patch: 0.34,
  size: 5.2,
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A bump from nought up to one at `c` and back, `r` either side of it, eased. */
const hump = (t: number, c: number, r: number): number => smooth(1 - Math.abs(t - c) / r);
const len3 = (v: V3): number => Math.hypot(v[0], v[1], v[2]);
const mixV = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

/** A frame from its three axes, as columns, at `t`. */
const frame = (X: V3, Y: V3, Z: V3, t: V3): Xf => ({ m: [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]], t });
/** A bone at `o` whose length runs along `dir`, its up as near `up` as is square to that. */
function aim(o: V3, dir: V3, up: V3): Xf {
  const Y = unit(dir);
  let Z = sub(up, scale(Y, dot(up, Y)));
  if (len3(Z) < 1e-5) Z = sub([0, 1, 0], scale(Y, Y[1]));
  Z = unit(Z);
  return frame(cross(Y, Z), Y, Z, o);
}
/** A bone at `o` whose length runs along `dir`, lying in the plane square to `normal`. */
function inPlane(o: V3, dir: V3, normal: V3): Xf {
  const Y = unit(dir), Z = unit(cross(normal, Y));
  return frame(cross(Y, Z), Y, Z, o);
}
/** Where the joint between two parts `a` and `b` long goes so the second ends at `goal`: always out on `pole`'s side. */
function kneeOf(root: V3, goal: V3, a: number, b: number, pole: V3): V3 {
  const d = sub(goal, root), L0 = Math.max(1e-6, len3(d)), u = scale(d, 1 / L0);
  const L = clamp(L0, Math.abs(a - b) + 1e-3, a + b - 1e-3);
  const along = (a * a - b * b + L * L) / (2 * L), up = Math.sqrt(Math.max(0, a * a - along * along));
  const p = unit(sub(pole, scale(u, dot(pole, u))));
  return add(add(root, scale(u, along)), scale(p, up));
}
/** Each face wound so it faces the way it is meant to, whichever way round it was listed. */
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
/** A flat painted shape from its corners, wound to face along `n`. */
function facing(pts: V3[], n: V3, m: Mat, lit?: boolean): Disc {
  let nx = 0, ny = 0, nz = 0;
  for (let c = 0; c < pts.length; c++) {
    const p = pts[c], r = pts[(c + 1) % pts.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nx * n[0] + ny * n[1] + nz * n[2] < 0 ? [...pts].reverse() : pts, m, lit };
}
/** A thin painted strip from `a` to `b` on a surface facing `n`. */
function strip(a: V3, b: V3, n: V3, w: number, m: Mat, lit?: boolean): Disc {
  const d = unit(sub(b, a)), side = scale(unit(cross(n, d)), w);
  return facing([add(a, side), add(b, side), sub(b, side), sub(a, side)], n, m, lit);
}
const mirroredMesh = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));
/** `v` turned about the unit axis `d` by `a` radians. */
const turned = (v: V3, d: V3, a: number): V3 => add(add(scale(v, Math.cos(a)), scale(cross(d, v), Math.sin(a))), scale(d, dot(d, v) * (1 - Math.cos(a))));

/* ---- the shell ------------------------------------------------------------------------- */

/** How far each plate's edges bow back toward the rim, as a share of the shell's length. */
const BOW = 0.11;
/** How far round the dome is at `u` along it (nought at its back, one at its front): a squared-off oval. */
function girth(S: Shell, u: number): number {
  const x = Math.abs(2 * u - 1);
  return Math.pow(Math.max(0, 1 - Math.pow(x, S.p)), 1 / S.p);
}
/** Which plate `u` is on, and how far along it from its back edge, nought to one. */
function plateAt(S: Shell, u: number): { j: number; f: number } {
  const L = S.cut / S.segs, j = clamp(Math.floor(u / L), 0, S.segs - 1);
  return { j, f: clamp((u - j * L) / L) };
}
/** How far under its waist the rim comes on plate `f` of the way along: lowest at each plate's back corner, so each ends in a point. */
const loAt = (S: Shell, f: number): number => S.lo * (1 + 0.9 * (1 - f) ** 4);
/**
 * A point on the shell, `u` along it on a plate `f` of the way from its back edge, `ph` round from its right rim (nought at
 * the waist on the right, pi on the left; under nought or over pi, the skirt below the waist, flaring out).
 */
function shellAt(S: Shell, u: number, f: number, ph: number): V3 {
  const g = girth(S, u) * (1 + S.step * (1 - f));
  const y = lerp(S.y0, S.y1, u);
  if (ph >= 0 && ph <= Math.PI) return [S.w * g * Math.cos(ph), y, S.z0 + S.h * g * Math.sin(ph)];
  const e = ph < 0 ? -ph : ph - Math.PI, sd = ph < 0 ? 1 : -1;
  return [sd * S.w * g * (1 + S.flare * e), y, S.z0 - S.h * g * Math.sin(e) * 0.6];
}
/** A point on the shell and the way out of it there, at `u` along and `ph` round. */
function onShell(S: Shell, u: number, ph: number): { p: V3; n: V3 } {
  const { f } = plateAt(S, u);
  const p = shellAt(S, u, f, ph), e = 0.004;
  const du = sub(shellAt(S, Math.min(S.cut, u + e), f, ph), shellAt(S, Math.max(0, u - e), f, ph));
  const dp = sub(shellAt(S, u, f, ph + e), shellAt(S, u, f, ph - e));
  let n = unit(cross(du, dp));
  const mid: V3 = [0, p[1], S.z0];
  if (dot(n, sub(p, mid)) < 0) n = scale(n, -1);
  return { p, n };
}

/**
 * The shell: plates in rings from its back to its front, each standing proud of the one behind, the edge it stands on a
 * darker cream lip; along each plate's back edge and down at its rim a band of cream, the rest green; its front edge, over
 * the head, cream too, and the inside of it there dark.
 */
function domeOf(S: Shell, n: number, fine: boolean): Mesh {
  const v: V3[] = [], f: Face[] = [];
  const fs = fine ? [0, 0.1, 0.22, 0.42, 0.62, 0.82, 1] : [0, 0.14, 0.45, 0.75, 1];
  const rings: Array<{ u: number; f: number; lip: boolean }> = [];
  for (let j = 0; j < S.segs; j++) {
    for (let q = 0; q < fs.length; q++) {
      const u = (j + fs[q]) * (S.cut / S.segs);
      rings.push({ u: Math.max(0.004, u), f: fs[q], lip: q === 0 && j > 0 });
    }
  }
  const cols = n + 1;
  for (const r of rings) {
    const lo = loAt(S, r.f);
    // Each plate's edges bowed back toward its rim, so they run round the dome in arcs.
    for (let c = 0; c < cols; c++) {
      const ph = lerp(-lo, Math.PI + lo, c / n);
      v.push(shellAt(S, Math.max(0.002, r.u - BOW * (1 - Math.max(0, Math.sin(ph)))), r.f, ph));
    }
  }
  for (let q = 0; q < rings.length - 1; q++) {
    const A = rings[q], B = rings[q + 1];
    const lip = B.lip;
    const fm = (A.f + (B.f || 1)) / 2;
    const last = plateAt(S, A.u).j === S.segs - 1 && !lip;
    for (let c = 0; c < n; c++) {
      const phm = lerp(-S.lo, Math.PI + S.lo, (c + 0.5) / n);
      const rim = phm < 0.04 + 0.1 * S.lo / 0.26 || phm > Math.PI - 0.04 - 0.1 * S.lo / 0.26;
      let m: Mat = 'coat';
      if (lip) m = 'shellDark';
      else if (fm < 0.19 || rim || (last && fm > 0.86)) m = 'mark';
      f.push({ i: [q * cols + c, q * cols + c + 1, (q + 1) * cols + c + 1, (q + 1) * cols + c], m });
    }
  }
  // Its back closed to a point; its front left open over the head, dark inside.
  const tail = v.length;
  v.push([0, lerp(S.y0, S.y1, 0.0), S.z0 + S.h * 0.08]);
  for (let c = 0; c < n; c++) f.push({ i: [c + 1, c, tail], m: 'coat' });
  const front = (rings.length - 1) * cols;
  f.push({ i: Array.from({ length: cols }, (_, c) => front + c), m: 'bark' });
  // Wound outward: each face's way out is away from the dome's axis, the lips' backward, the front's forward.
  const want: V3[] = f.map((face, q) => {
    const mid = scale(face.i.reduce((t, i) => add(t, v[i]), [0, 0, 0] as V3), 1 / face.i.length);
    if (q === f.length - 1) return [0, 1, 0.2];
    if (face.m === 'shellDark') return [mid[0] * 0.2, -1, (mid[2] - S.z0) * 0.2];
    return [mid[0], 0, mid[2] - S.z0 + 0.05];
  });
  return mesh(v, wound(v, f, want));
}

/** A swirl painted on the shell round `u`, `ph`: a curl of a turn and a quarter with a tail out of it, `R` across. */
function swirlOn(S: Shell, u0: number, ph0: number, R: number, w: number, turn: number, out: Disc[]): void {
  const c = onShell(S, u0, ph0);
  const du = len3(sub(onShell(S, u0 + 0.01, ph0).p, c.p)) / 0.01, dp = len3(sub(onShell(S, u0, ph0 + 0.01).p, c.p)) / 0.01;
  const pts: V3[] = [];
  const ns: V3[] = [];
  const N = 22;
  for (let q = 0; q <= N; q++) {
    const k = q / N, a = turn * (0.2 + k * TAU * 1.25), r = R * (0.12 + 0.88 * k);
    const at = onShell(S, clamp(u0 + (r * Math.cos(a)) / du, 0.02, S.cut - 0.01), ph0 + (r * Math.sin(a)) / dp);
    pts.push(add(at.p, scale(at.n, 0.012)));
    ns.push(at.n);
  }
  // And its tail, sweeping off from the outside of the curl.
  const last = N;
  for (let q = 1; q <= 5; q++) {
    const a = turn * (0.2 + TAU * 1.25 + q * 0.18), r = R * (1 + q * 0.22);
    const at = onShell(S, clamp(u0 + (r * Math.cos(a)) / du, 0.02, S.cut - 0.01), ph0 + (r * Math.sin(a)) / dp);
    pts.push(add(at.p, scale(at.n, 0.012)));
    ns.push(at.n);
  }
  for (let q = 0; q < pts.length - 1; q++) {
    const k = q / (pts.length - 1), ww = w * (0.5 + 0.7 * Math.min(1, k * 2)) * (q > last ? 1 - (q - last) / 6 : 1);
    out.push(strip(pts[q], pts[q + 1], unit(add(ns[q], ns[q + 1])), ww, 'mark'));
    if (q > 0) out.push(disc(pts[q], ns[q], ww, ww, 6, 'mark'));
  }
}

/** Its plates' markings: patches of a lighter green on each, and cream swirls; the Mossreaver's one big swirl on its flank. */
function shellMarks(s: Moss): Mesh {
  const S = s.shell, out: Disc[] = [];
  const L = S.cut / S.segs;
  // A lighter patch on each plate, each side, high on it.
  for (let j = 0; j < S.segs; j++) {
    for (const sd of [1, -1]) {
      const id = j * 7 + (sd > 0 ? 0 : 3);
      const u = (j + 0.55 + 0.1 * (jitter(id) - 0.5)) * L, ph = sd > 0 ? 0.62 + 0.25 * jitter(id + 1) : Math.PI - 0.62 - 0.25 * jitter(id + 1);
      const c = onShell(S, u, ph);
      const ring: V3[] = [];
      for (let q = 0; q < 8; q++) {
        const a = (q / 8) * TAU, rr = 0.75 + 0.45 * jitter(id * 5 + q);
        const at = onShell(S, clamp(u + Math.cos(a) * L * 0.26 * rr, j * L + L * 0.18, (j + 1) * L - 0.01), ph + Math.sin(a) * 0.2 * rr);
        ring.push(add(at.p, scale(at.n, 0.008)));
      }
      out.push(facing(ring, c.n, 'coatLight'));
    }
  }
  // The swirls: on the near plates' flanks, the biggest on the middle plate.
  const spots: Array<[number, number, number]> = s.stage === 2
    ? [[0.5, 0.62, 1], [0.5, Math.PI - 0.62, 1]]
    : [[0.45, 0.62, 1], [0.45, Math.PI - 0.62, 1], [0.72, 0.42, 0.75], [0.72, Math.PI - 0.42, 0.75], [0.2, 0.55, 0.7], [0.2, Math.PI - 0.55, 0.7]];
  for (const [uu, ph, k] of spots.slice(0, s.swirls.n * 2)) {
    const { j } = plateAt(S, uu * S.cut);
    const u = (j + 0.58) * L;
    swirlOn(S, u, ph, s.swirls.big * k, 0.016 + 0.01 * s.stage * k, ph < Math.PI / 2 ? 1 : -1, out);
  }
  return paint(out);
}

/** The body under the shell: dark brown, in creased rings. */
function bellyOf(s: Moss, n: number, k: number): Mesh {
  const B = s.belly;
  const m = orb(B.c, B.r, n + 2, k, 'bark');
  const out: Disc[] = [];
  for (let q = 0; q < 5; q++) {
    const y = B.c[1] + B.r[1] * lerp(-0.7, 0.6, q / 4);
    for (const sd of [1, -1]) {
      const e = onEgg(B.c, B.r, [sd * 0.9, (y - B.c[1]) / B.r[1], -0.25]);
      out.push(disc(add(e.p, scale(e.n, 0.008)), e.n, B.r[0] * 0.1, B.r[2] * 0.6, 6, 'hornDark'));
    }
  }
  return merge(m, paint(out));
}

/* ---- moss, leaves and flowers ----------------------------------------------------------------- */

/** A frond of moss: a short blade with a zigzag edge, from `root` along `dir`, lying on `face`. */
function frond(root: V3, dir: V3, face: V3, L: number, w: number, mat: Mat, fine: boolean): Mesh {
  const d = unit(dir);
  const steps = fine ? 9 : 5;
  const pts: V3[] = [], ws: number[] = [];
  for (let q = 0; q <= steps; q++) {
    const k = q / steps;
    pts.push(add(add(root, scale(d, L * k)), scale(face, -L * 0.3 * k * k)));
    // A stem with leaflets along it: wide at each leaflet, pinched to the stem between.
    ws.push(q === steps ? 0.004 : w * (1 - 0.5 * k) * (q % 2 ? 1 : 0.18));
  }
  return blade(pts, ws, face, { mat, rib: 'leafDark', fold: 0.15, thick: 0.008 });
}

/**
 * A clump of moss: a low lumpy mound, bright on top and darker round its foot, ringed with fronds lying out over the shell
 * around it.
 */
function clumpOf(c: V3, n: V3, R: number, id: number, fronds: number, fine: boolean, hang = false): Mesh {
  const z = unit(n);
  let x = cross([0, 1, 0], z);
  if (len3(x) < 1e-4) x = [1, 0, 0];
  x = unit(x);
  const y = cross(z, x);
  // A thin dark mat under it all, half sunk.
  const b = orbAlong([0, 0, 0], z, [R * 0.75, R * 0.68, R * 0.2], fine ? 8 : 6, 3, 'leafDark');
  const out: Mesh[] = [mesh(b.v.map((p, i) => add(c, scale(p, 0.88 + 0.24 * jitter(id * 31 + i))) as V3), b.f)];
  // Fern fronds out of it every way, lying low over the shell, the edge ones hanging over; bright yellow-green.
  for (let q = 0; q < fronds; q++) {
    const a = (q / fronds) * TAU + jitter(id + q) * 0.9;
    const out1 = add(scale(x, Math.cos(a)), scale(y, Math.sin(a)));
    const lean = hang ? lerp(1.3, 2.0, jitter(id * 5 + q)) : lerp(0.85, 1.4, jitter(id * 5 + q));
    const d = unit(add(scale(z, Math.cos(lean)), scale(out1, Math.sin(lean))));
    const face = unit(sub(z, scale(d, dot(z, d))));
    const root = add(c, add(scale(out1, R * 0.25 * jitter(id * 7 + q)), scale(z, R * 0.05)));
    const mat: Mat = jitter(id * 11 + q) < 0.45 ? 'leaf' : 'moss';
    out.push(frond(root, d, len3(face) > 1e-3 ? face : z, R * (0.85 + 0.45 * jitter(id * 3 + q)) * (hang ? 1.35 : 1), R * 0.42, mat, fine));
  }
  return merge(...out);
}

/** The moss along its top: clumps from `from` to `to`, the widest over its middle, set either side of the ridge by turns. */
function mossOf(s: Moss, fine: boolean): Mesh {
  const S = s.shell, M = s.moss, out: Mesh[] = [];
  // Rows across the top: the middle one along the ridge, and as many again either side out to `wide`; the bigger two's outer
  // rows further, hanging down over the shell's shoulders.
  const across = s.stage === 0 ? [-1, -0.5, 0, 0.5, 1] : [-1.35, -1, -0.66, -0.33, 0, 0.33, 0.66, 1, 1.35];
  for (let q = 0; q < M.clumps; q++) {
    const k = M.clumps > 1 ? q / (M.clumps - 1) : 0.5;
    const swell = Math.sin(Math.PI * clamp(lerp(0.1, 0.9, k)));
    across.forEach((a, j) => {
      const id = 70 + q * 11 + j;
      // Thinner toward its ends and its edges, and now and then a gap.
      if (Math.abs(a) > 0.6 + 0.6 * swell || jitter(id + 3) < 0.08) return;
      const u = clamp(lerp(M.from, M.to, k + (jitter(id) - 0.5) * 0.6 / M.clumps), 0.02, 0.98) * S.cut;
      const side = a * M.wide * (0.85 + 0.2 * jitter(id + 1)) * (0.65 + 0.35 * swell);
      const at = onShell(S, u, Math.PI / 2 - side);
      const edge = Math.abs(a) > 1.1;
      const R = M.deep * (0.75 + 0.5 * swell) * (0.8 + 0.4 * jitter(id + 2)) * (edge ? 0.85 : 1);
      out.push(clumpOf(add(at.p, scale(at.n, R * 0.04)), at.n, R, id, fine ? 12 : 7, fine, edge));
    });
  }
  return merge(...out);
}

/** Small white flowers in its moss: five round petals each about a yellow middle. */
function flowersOf(s: Moss): Mesh {
  const S = s.shell, out: Disc[] = [];
  const spots: Array<[number, number]> = [[0.42, 0.42], [0.55, 0.28], [0.48, -0.22], [0.66, -0.36], [0.3, 0.1]];
  for (let q = 0; q < s.flowers; q++) {
    const [uu, side] = spots[q];
    const at = onShell(S, uu * S.cut, Math.PI / 2 - side);
    const lift = s.moss.deep * 0.55;
    const c = add(at.p, scale(at.n, lift)), nn = unit(add(at.n, [0.25, 0.2, 0.3]));
    const r = 0.085;
    for (let e = 0; e < 5; e++) {
      const a = (e / 5) * TAU + q;
      let u = cross([0, 0, 1], nn);
      if (len3(u) < 1e-4) u = [1, 0, 0];
      u = unit(u);
      const w = cross(nn, u);
      const p = add(c, add(scale(u, Math.cos(a) * r * 0.62), scale(w, Math.sin(a) * r * 0.62)));
      out.push(disc(add(p, scale(nn, 0.004)), nn, r * 0.5, r * 0.5, 7, 'petal'));
    }
    out.push(disc(add(c, scale(nn, 0.01)), nn, r * 0.34, r * 0.34, 7, 'bloom'));
  }
  return paint(out);
}

/**
 * A leaf: a long blade from `root` up along `dir`, its tip swept back along `back`, `L` long and `W` wide at its widest; its
 * lower part cream and the rest green, a cream rib up its middle, its face turned toward `face`.
 */
function leafOf(root: V3, dir: V3, back: V3, face: V3, L: number, W: number, fine: boolean, base = 0.16): Mesh {
  const d = unit(dir), bk = unit(back);
  const N = fine ? 8 : 5;
  const pts: V3[] = [], ws: number[] = [];
  for (let q = 0; q <= N; q++) {
    const k = q / N;
    pts.push(add(add(root, scale(d, L * k)), scale(bk, L * 0.55 * k ** 2.2)));
    ws.push(q === N ? 0.004 : W * Math.sin(Math.PI * Math.min(1, 0.08 + k * 0.92)) ** 0.7 * (1 - 0.15 * k));
  }
  const cutAt = Math.max(1, Math.round(N * base));
  const low = blade(pts.slice(0, cutAt + 1), ws.slice(0, cutAt + 1), face, { mat: 'mark', rib: 'shellDark', fold: 0.24, thick: 0.012 });
  const high = blade(pts.slice(cutAt), ws.slice(cutAt), face, { mat: 'coat', rib: 'mark', fold: 0.24, thick: 0.012 });
  return merge(low, high);
}

/** The leaf blades up off its back, rooted in the moss. */
function finsOf(s: Moss, fine: boolean): Mesh {
  const S = s.shell, out: Mesh[] = [];
  for (const F of s.fins) {
    const at = onShell(S, F.u * S.cut, Math.PI / 2 - F.side);
    const up: V3 = turned([0, 0, 1], [0, 1, 0], F.out * DEG);
    const dir = unit(turned(up, [1, 0, 0], -F.back * 0.6 * DEG));
    const back = unit([0, -1, -0.25]);
    // Turned a little toward the front, each to its own side, so a leaf is seen broad from the front quarter as well as the side.
    const face = unit([F.side >= 0 ? 1 : -1, 0.9, 0.1]);
    out.push(leafOf(add(at.p, scale(at.n, -0.02)), dir, back, face, F.len, F.wide, fine, 0.12));
  }
  return merge(...out);
}

/** The Mossreaver's leaf fins hanging under its rim, dark green, from its flanks round its back. */
function skirtOf(s: Moss, fine: boolean): Mesh {
  const S = s.shell, out: Mesh[] = [];
  for (let q = 0; q < s.skirt; q++) {
    for (const sd of [1, -1]) {
      const k = q / Math.max(1, s.skirt - 1);
      const u = lerp(0.05, 0.62, k) * S.cut;
      const at = onShell(S, u, sd > 0 ? -S.lo * 0.7 : Math.PI + S.lo * 0.7);
      const outward = unit([sd, -0.5 * (1 - k), 0]);
      const dir = unit(add(outward, [0, -0.3, -1.3]));
      const L = 0.42 * (0.8 + 0.4 * jitter(q * 3 + (sd > 0 ? 1 : 2))) * (1 - 0.3 * k);
      const N = fine ? 5 : 3;
      const pts: V3[] = [], ws: number[] = [];
      for (let e = 0; e <= N; e++) {
        const t = e / N;
        pts.push(add(add(at.p, scale(dir, L * t)), scale(outward, L * 0.3 * t * t)));
        ws.push(e === N ? 0.004 : 0.09 * Math.sin(Math.PI * Math.min(1, 0.15 + t)) * (1 - 0.3 * t));
      }
      out.push(blade(pts, ws, unit(cross(dir, [0, 1, 0])), { mat: 'leafDark', rib: 'coatDark', fold: 0.2, thick: 0.01 }));
    }
  }
  return merge(...out);
}

/* ---- the head ------------------------------------------------------------------------- */

/** An eye at `p` looking out along `nn`, `sz` big: a dark rim, the olive of it, the dark middle and its glints. */
function eyeOf(p: V3, nn: V3, sz: number, out: Disc[], socket = false): void {
  if (socket) out.push(disc(p, nn, sz * 1.55, sz * 1.25, 10, 'hornDark', { up: [0, 0, 1] }));
  // A dark olive eye, lighter low in it, its middle dark.
  out.push(disc(add(p, scale(nn, 0.002)), nn, sz, sz * 1.06, 12, 'eye', { up: [0, 0, 1] }));
  out.push(disc(add(add(p, scale(nn, 0.004)), [0, 0, -sz * 0.18]), nn, sz * 0.72, sz * 0.66, 10, 'crystal', { up: [0, 0, 1] }));
  out.push(disc(add(add(p, scale(nn, 0.006)), [0, 0, sz * 0.06]), nn, sz * 0.5, sz * 0.52, 10, 'eye', { up: [0, 0, 1] }));
  const side = unit(cross([0, 0, 1], nn));
  out.push(disc(add(add(add(p, scale(nn, 0.009)), [0, 0, sz * 0.38]), scale(side, sz * 0.28)), nn, sz * 0.3, sz * 0.3, 6, 'glint', { lit: true, up: [0, 0, 1] }));
  out.push(disc(add(add(add(p, scale(nn, 0.009)), [0, 0, -sz * 0.36]), scale(side, -sz * 0.3)), nn, sz * 0.12, sz * 0.12, 5, 'glint', { lit: true, up: [0, 0, 1] }));
}

/**
 * The Mossnib's head: round and cream, a green patch over its brow, big round dark olive eyes either side of its face with a
 * glint in each, a little mouth.
 */
function roundHead(s: Moss, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, r = H.r, c: V3 = [0, 0, 0];
  const skull = orb(c, r, n + 2, k + 1, 'mark');
  const marks: Disc[] = [];
  const brow = onEgg(c, r, [0, 0.35, 1]);
  marks.push(disc(add(brow.p, scale(brow.n, 0.006)), brow.n, r[0] * 0.55, r[1] * 0.5, 9, 'coat', { up: [0, 1, 0] }));
  const brow2 = onEgg(c, r, [0, 0.75, 0.62]);
  marks.push(disc(add(brow2.p, scale(brow2.n, 0.008)), brow2.n, r[0] * 0.32, r[1] * 0.2, 7, 'coat'));
  for (const sd of [1, -1]) {
    const e = onEgg(c, r, [sd * H.eye[0], H.eye[1], H.eye[2]]);
    const p = add(e.p, scale(e.n, 0.008));
    if (shut) marks.push(disc(p, e.n, H.size * 1.1, H.size * 0.25, 8, 'hornDark', { up: [0, 0, 1] }));
    else eyeOf(p, e.n, H.size, marks);
  }
  // A small nose and mouth low on its face.
  const nose = onEgg(c, r, [0, 1, -0.35]);
  marks.push(disc(add(nose.p, scale(nose.n, 0.008)), nose.n, r[0] * 0.07, r[0] * 0.05, 5, 'hornDark'));
  const m0 = onEgg(c, r, [-0.16, 1, -0.62]), m1 = onEgg(c, r, [0, 1, -0.56]), m2 = onEgg(c, r, [0.16, 1, -0.62]);
  marks.push(strip(add(m0.p, scale(m0.n, 0.008)), add(m1.p, scale(m1.n, 0.008)), m1.n, 0.006, 'hornDark'), strip(add(m1.p, scale(m1.n, 0.008)), add(m2.p, scale(m2.n, 0.008)), m1.n, 0.006, 'hornDark'));
  return merge(skull, paint(marks));
}

/**
 * The bigger two's head: a dark brown face under a cream plate that comes down over its brow to a point at the front, a green
 * patch on top of the plate; olive eyes set deep under the brow either side.
 */
function plateHead(s: Moss, n: number, k: number, shut: boolean): Mesh {
  const H = s.head, r = H.r;
  const face = orb([0, -r[1] * 0.05, -r[2] * 0.15], [r[0] * 0.86, r[1] * 0.9, r[2] * 0.8], n + 2, k, 'bark');
  // The plate: an egg, its front pulled forward and down to a point, cut away under its eyes.
  const b = orb([0, 0, 0], [r[0], r[1], r[2]], n + 4, k + 2, 'mark');
  const v = b.v.map((p): V3 => {
    const d: V3 = [p[0] / r[0], p[1] / r[1], p[2] / r[2]];
    const fwd = Math.max(0, d[1]) ** 2 * Math.max(0, 1 - Math.abs(d[0]) * 1.4);
    return [p[0] * (1 - 0.2 * fwd), p[1] + r[1] * 0.42 * fwd, p[2] - r[2] * 0.62 * fwd * Math.max(0, 1 - d[2] * 0.3) + r[2] * 0.12 * Math.max(0, d[2])];
  });
  const kept: Face[] = [];
  for (const f of b.f) {
    const mid = scale(f.i.reduce((t, i) => add(t, b.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    const d: V3 = [mid[0] / r[0], mid[1] / r[1], mid[2] / r[2]];
    // Kept: its top, and its front down to the point; away under its eyes and below.
    if (d[2] < -0.3 && !(d[1] > 0.55 && Math.abs(d[0]) < 0.4)) continue;
    if (d[2] < 0.05 && Math.abs(d[0]) > 0.45 && d[1] > -0.2) continue;
    kept.push(f);
  }
  const plate = mesh(v, kept);
  const marks: Disc[] = [];
  const top = onEgg([0, 0, r[2] * 0.06], r, [0, 0.2, 1]);
  marks.push(disc(add(top.p, scale(top.n, 0.012)), top.n, r[0] * 0.48, r[1] * 0.42, 9, 'coat', { up: [0, 1, 0] }));
  const eyes: Disc[] = [];
  for (const sd of [1, -1]) {
    const e = onEgg([0, -r[1] * 0.05, -r[2] * 0.15], [r[0] * 0.86, r[1] * 0.9, r[2] * 0.8], [sd * H.eye[0], H.eye[1], H.eye[2]]);
    const p = add(e.p, scale(e.n, 0.01));
    if (shut) eyes.push(disc(p, e.n, H.size * 1.2, H.size * 0.3, 8, 'hornDark', { up: [0, 0, 1] }));
    else eyeOf(p, e.n, H.size, eyes, true);
  }
  return merge(face, paint(eyes), plate, paint(marks));
}

/** The Mossnib's antennae: a cream stalk out of the top of its head, curving up and back into a long green leaf. */
function feelersOf(s: Moss, n: number, fine: boolean): Mesh {
  const F = s.feelers!;
  const one = (): Mesh => {
    const stalk = tube(curve(F.root, add(F.root, [0.02, 0, 0.1]), mixV(F.root, F.mid, 0.6), 3), [0.026, 0.022, 0.02, 0.018], [0.026, 0.022, 0.02, 0.018], Math.max(5, n - 4), 'mark');
    const pts = curve(mixV(F.root, F.mid, 0.45), F.mid, F.tip, fine ? 7 : 4);
    const N = pts.length - 1;
    const ws = pts.map((_, q) => (q === N ? 0.004 : F.wide * Math.sin(Math.PI * Math.min(1, 0.1 + (q / N) * 0.95)) ** 0.7));
    const face = unit([0.22, 1, 0.3]);
    const lo = Math.max(1, Math.round(N * 0.18));
    const leaf = merge(
      blade(pts.slice(0, lo + 1), ws.slice(0, lo + 1), face, { mat: 'mark', rib: 'shellDark', fold: 0.25, thick: 0.01 }),
      blade(pts.slice(lo), ws.slice(lo), face, { mat: 'coat', rib: 'mark', fold: 0.25, thick: 0.01, twist: -0.4 }),
    );
    return merge(stalk, leaf);
  };
  const right = one();
  return merge(right, mirroredMesh(right));
}

/** The bigger two's horns: a cream horn off each side of the head curving up and out, its tip green. */
function hornsOf(s: Moss, n: number): Mesh {
  const H = s.horns!;
  const one = (): Mesh => {
    const pts = curve(H.root, H.mid, H.tip, 6);
    const ws = pts.map((_, q) => H.w * (1 - 0.82 * (q / 6) ** 1.2));
    const horn = tube(pts, ws, ws.map((x) => x * 0.85), Math.max(5, n - 3), (ring) => (ring >= 4 ? 'coat' : 'mark'));
    return horn;
  };
  const right = one();
  return merge(right, mirroredMesh(right));
}

/** The Mossnib's jaws: a small cream mandible either side under its face, curving in to a dark tip (right one, about its hinge). */
function jawOf(s: Moss, n: number): Mesh {
  const r = s.head.r;
  return tube(curve([0, 0, 0], [r[0] * 0.14, r[1] * 0.2, -r[2] * 0.04], [-r[0] * 0.1, r[1] * 0.3, -r[2] * 0.06], 3),
    [r[0] * 0.09, r[0] * 0.08, r[0] * 0.05, 0.006], [r[0] * 0.07, r[0] * 0.06, r[0] * 0.04, 0.006], Math.max(5, n - 4), (ring) => (ring >= 2 ? 'claw' : 'shellDark'));
}
/** Where the right jaw is hinged on the head. */
const jawAt = (s: Moss): V3 => [s.head.r[0] * 0.3, s.head.r[1] * 0.66, -s.head.r[2] * 0.66];

/* ---- legs and scythes --------------------------------------------------------------------- */

/** A leg's upper part, along `y` from its hip to its knee: dark brown; banded in cream at the knee on the bigger two. */
function upperOf(s: Moss): Mesh {
  const L = s.legs.upper, w = s.legs.thick;
  const bone = tube([[0, -w, 0], [0, L * 0.25, w * 0.08], [0, L * 0.55, w * 0.12], [0, L * 0.82, w * 0.06], [0, L + w * 0.2, 0]],
    [w * 0.9, w * 1.05, w * 1.1, w * 1.0, w * 0.85], [w * 0.85, w, w * 1.05, w * 0.95, w * 0.8], 8, 'bark', { seam: 'start' });
  const out: Mesh[] = [bone, orb([0, L, 0], w * 0.86, 8, 4, 'hornDark')];
  if (s.stage > 0) out.push(orbAlong([0, L * 0.52, w * 0.4], [0, 1, 0.2], [w * 1.1, w * 0.8, L * 0.32], 7, 3, 'mark'));
  return merge(...out);
}
/**
 * A leg's lower part, from the knee along `y` to the tip of its foot: a cream sheath with a green leaf patch on its outside,
 * then a dark brown claw curving to a point; the bigger two's banded brown, cream and green.
 */
function lowerOf(s: Moss): Mesh {
  const L = s.legs.lower, w = s.legs.thick * 0.95;
  const banded = s.stage > 0;
  const ys = [-w * 0.3, L * 0.12, L * 0.3, L * 0.5, L * 0.64, L * 0.8, L * 0.92, L - 0.004];
  const ws = [w * 0.9, w * 1.12, w * 1.22, w * 1.15, w * 0.92, w * 0.6, w * 0.32, 0.006];
  const mats: Mat[] = banded ? ['mark', 'mark', 'mark', 'mark', 'claw', 'claw', 'claw'] : ['mark', 'mark', 'mark', 'coat', 'claw', 'claw', 'claw'];
  const shin = tube(ys.map((y, q) => [0, y, q >= 5 ? -w * 0.12 * (q - 4) : w * 0.1] as V3), ws, ws.map((x) => x * 0.92), 7, (ring) => mats[Math.min(ring, mats.length - 1)]);
  // The green leaf patch over its outside, pointed down the leg.
  const patch: Disc[] = [];
  for (const sd of [1, -1]) {
    const c: V3 = [sd * w * 1.18, L * 0.36, w * 0.25];
    patch.push(facing([add(c, [0, -L * 0.16, 0.0]), add(c, [0, L * 0.02, w * 0.5]), add(c, [0, L * 0.2, w * 0.1]), add(c, [0, L * 0.06, -w * 0.45])], [sd, 0, 0.3], 'coat'));
  }
  return merge(shin, paint(patch));
}

/**
 * A scythe blade, in its hand's frame: from the wrist (the origin) along `y`, rising and arcing over forward and down to its
 * point, `L` long; its back a smooth curve, its inside a row of teeth. Cream, with moss and green over its top near the root,
 * a darker cream edge; a short brown wrist into it.
 */
interface Blade { outer: Array<[number, number]>; inner: Array<[number, number]> }
function bladeShape(L: number, teeth: number): Blade {
  const R = L * 0.5, E = 1, a0 = 176 * DEG, a1 = 322 * DEG, N = 20;
  const C: [number, number] = [-R * Math.cos(a0), -R * E * Math.sin(a0)];
  const outer: Array<[number, number]> = [], inner: Array<[number, number]> = [];
  for (let q = 0; q <= N; q++) {
    const k = q / N, a = lerp(a0, a1, k);
    const wout = R * 0.08 * (1 - k ** 2), win = R * (0.56 * Math.sin(Math.PI * (0.22 + 0.78 * k)) ** 0.7 + 0.01);
    const tooth = k > 0.2 && k < 0.88 ? frac(k * teeth * 1.35) : 0;
    const bite = win * (1 - 0.3 * tooth);
    outer.push([C[0] + (R + wout) * Math.cos(a), C[1] + (R + wout) * E * Math.sin(a)]);
    inner.push([C[0] + (R - bite) * Math.cos(a), C[1] + (R - bite) * E * Math.sin(a)]);
  }
  return { outer, inner };
}
function scytheOf(s: Moss, fine: boolean): Mesh {
  const SC = s.scythes!, L = SC.len, B = bladeShape(L, SC.teeth);
  const outline: Array<[number, number]> = [...B.outer, ...[...B.inner].reverse()];
  const n = outline.length, t = L * 0.05;
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  for (const [y, z] of outline) v.push([t / 2, y, z]);
  for (const [y, z] of outline) v.push([-t / 2, y, z]);
  // Its faces as strips across it, outer to inner, so the outline can be any shape.
  const M = B.outer.length;
  for (let q = 0; q < M - 1; q++) {
    const o0 = q, o1 = q + 1, i0 = n - 1 - q, i1 = n - 2 - q;
    f.push({ i: [o0, o1, i1, i0], m: 'mark' });
    want.push([1, 0, 0]);
    f.push({ i: [n + o0, n + o1, n + i1, n + i0], m: 'mark' });
    want.push([-1, 0, 0]);
  }
  // Its edge, each face of it out square to the outline, whichever way round the outline goes.
  let area = 0;
  for (let j = 0; j < n; j++) { const [y0, z0] = outline[j], [y1, z1] = outline[(j + 1) % n]; area += y0 * z1 - y1 * z0; }
  const turn = area > 0 ? 1 : -1;
  for (let j = 0; j < n; j++) {
    const j2 = (j + 1) % n;
    f.push({ i: [j, j2, n + j2, n + j], m: 'shellDark' });
    want.push([0, turn * (outline[j2][1] - outline[j][1]), -turn * (outline[j2][0] - outline[j][0])]);
  }
  const blade0 = mesh(v, wound(v, f, want));
  // Green and moss over its top near the root, on both faces.
  const marks: Disc[] = [];
  for (const sd of [1, -1]) {
    const x = sd * (t / 2 + 0.004);
    const span = s.stage === 2 ? 9 : 6;
    const top: V3[] = [], low: V3[] = [];
    for (let q = 0; q <= span; q++) {
      const [y0, z0] = B.outer[q], [y1, z1] = B.inner[q];
      const k = 0.45 + 0.25 * Math.sin(q * 1.7);
      top.push([x, y0 * 0.985, z0 * 0.985]);
      low.push([x, lerp(y0, y1, k), lerp(z0, z1, k)]);
    }
    marks.push(facing([...top, ...low.reverse()], [sd, 0, 0], 'coat'));
    // Patches of moss over the green, and a fleck or two further down.
    for (let q = 0; q < 4 + s.stage * 2; q++) {
      const at = Math.min(B.outer.length - 1, Math.floor(jitter(q * 5 + sd + 3) * span * 1.4));
      const [y0, z0] = B.outer[at], [y1, z1] = B.inner[at];
      const k = 0.15 + 0.35 * jitter(q * 7 + 1);
      marks.push(disc([x * 1.3, lerp(y0, y1, k), lerp(z0, z1, k)], [sd, 0, 0], L * (0.035 + 0.03 * jitter(q)), L * (0.03 + 0.02 * jitter(q + 9)), 6, q % 3 ? 'moss' : 'leaf', { up: [0, 1, 0] }));
    }
  }
  const tuft = clumpOf(add([0, B.outer[2][0], B.outer[2][1]], [0, 0, L * 0.02]), [0, -0.3, 1], L * (0.16 + 0.02 * s.stage), 300 + s.stage, fine ? 9 : 5, fine);
  const wrist = tube([[0, -L * 0.1, -L * 0.02], [0, L * 0.06, L * 0.02]], SC.thick * 1.05, SC.thick * 1.1, 6, 'bark');
  return merge(wrist, blade0, paint(marks), tube([[0, -L * 0.02, 0], [0, L * 0.04, 0]], SC.thick * 1.25, SC.thick * 1.25, 6, 'mark'), tuft);
}
/** Points along a scythe's blade, in its hand's frame, for keeping it off the ground. */
function bladePoints(s: Moss): V3[] {
  const B = bladeShape(s.scythes!.len, s.scythes!.teeth);
  return [...B.outer, ...B.inner].filter((_, q) => q % 3 === 0).map(([y, z]) => [0, y, z] as V3);
}
/** Where on a scythe its point is, in its hand's frame. */
const pointOf = (s: Moss): V3 => { const B = bladeShape(s.scythes!.len, s.scythes!.teeth); const [y, z] = B.outer[B.outer.length - 1]; return [0, y, z]; };

/* ---- the moss it cuts ------------------------------------------------------------------------ */

/** The patch of moss in front of it on the ground: a low mound of fronds, `R` across. */
function patchOf(R: number, fine: boolean): Mesh {
  const out: Mesh[] = [clumpOf([0, 0, R * 0.12], [0, 0, 1], R * 0.6, 500, fine ? 10 : 6, fine)];
  for (let q = 0; q < 3; q++) {
    const a = (q / 3) * TAU + 0.6;
    out.push(clumpOf([Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.45, R * 0.06], [0, 0, 1], R * 0.38, 510 + q, fine ? 7 : 4, fine));
  }
  return merge(...out);
}
/** A cut tuft, held. */
const tuftOf = (R: number, fine: boolean): Mesh => clumpOf([0, 0, 0], [0, 0, 1], R * 0.42, 520, fine ? 7 : 5, fine);

/* ---- its moves, in time ------------------------------------------------------------------- */

/** When each stage's strike lands, as a share of it: the Mossnib's nip, the Mossshear's snip, the Mossreaver's scissoring slash. */
export const MOSS_HITS: readonly number[] = [0.5, 0.56, 0.6];
/** When it is gathered for the blow, as a share of the strike. */
export const MOSS_STRIKE = { gather: 0.36 } as const;
/**
 * A go at its task, as shares of it: the Mossnib's nips at the patch; the bigger two's blades opened (`open`) and shut across
 * each other (`snips`); when it lifts the cut moss (`lift`) and when that is gone (`gone`). It loops, so a go and the next are
 * one.
 */
export const MOSS_WORK = { nips: [0.24, 0.42, 0.6] as const, open: [0.14, 0.44] as const, snips: [0.32, 0.62] as const, lift: 0.76, gone: 0.94 } as const;
/** When it looks itself over, standing about, in seconds into its loop. */
export const MOSS_LOOKS: readonly number[] = [5.2, 16.4];

/* ---- its pose ------------------------------------------------------------------------------- */

/** A scythe's pose: where its wrist is (body frame), how its blade is turned. */
interface Claw { w: V3; pitch: number; yaw: number; roll: number }
const mixClaw = (a: Claw, b: Claw, t: number): Claw => ({ w: mixV(a.w, b.w, t), pitch: lerp(a.pitch, b.pitch, t), yaw: lerp(a.yaw, b.yaw, t), roll: lerp(a.roll, b.roll, t) });
/**
 * How far a blade is rolled over from upright (degrees, the right one's): nearly flat, so it is held out like a scythe, its
 * back to the outside and its toothed edge in toward the other.
 */
const BLADE_ROLL = -78;
/** A scythe at rest, on its side (`sd` one the right). */
function restClaw(s: Moss, sd: number): Claw {
  const R = s.scythes!.rest;
  return { w: [sd * R.w[0], R.w[1], R.w[2]], pitch: R.pitch, yaw: sd * R.yaw, roll: sd * (BLADE_ROLL + R.roll) };
}
/** A scythe at `w` (right side's), turned so, on its side; `roll` over and above its flat. */
const clawAt = (sd: number, w: V3, pitch: number, yaw: number, roll: number): Claw => ({ w: [sd * w[0], w[1], w[2]], pitch, yaw: sd * yaw, roll: sd * (BLADE_ROLL + roll) });

interface Pose {
  /** The body over the ground: along, up, and its turns (degrees). */
  y: number; z: number; pitch: number; roll: number; yaw: number;
  /** The head's own turns on the body: pitch, yaw, roll. */
  head: [number, number, number];
  claws: [Claw, Claw] | null;
  /** The Mossnib's jaws open, nought shut. */
  jaw: number;
  /** How far forward the front feet are put, for a lunge, in leg lengths. */
  reach: number;
}

/** The standing pose: breathing, looking about, now and then looking itself over; the bigger two flexing their blades. */
function standPose(s: Moss, a: Anim): Pose {
  const t = a.t, still = 1 - a.go;
  const look = beat(t, MOSS_LOOKS as number[], 1.6) * still;
  const p: Pose = {
    y: 0, z: s.high + 0.008 * cyc(t, 6) + 0.006 * (a.breath - 0.5), pitch: 0.8 * cyc(t, 6, 1), roll: 0.6 * cyc(t, 3), yaw: 4 * drift(t) * still,
    head: [4 * cyc(t, 5) * still - 10 * look, 16 * drift(t, 1.3) * still * (1 - look) + 22 * look * Math.sin((t - MOSS_LOOKS[0]) * 2.4), 5 * drift(t, 2) * still],
    claws: s.scythes ? [restClaw(s, -1), restClaw(s, 1)] : null,
    jaw: 0.25 * beat(t, [3.1, 3.5, 11.8, 19.2], 0.35) * still,
    reach: 0,
  };
  if (p.claws) {
    // Now and then it opens its blades out and snaps them back, as if trying them.
    const flex = beat(t, [8.6, 20.2], 1.2) * still;
    for (let q = 0; q < 2; q++) p.claws[q] = { ...p.claws[q], yaw: p.claws[q].yaw - (q ? 1 : -1) * 22 * flex, roll: p.claws[q].roll + (q ? 1 : -1) * 8 * flex, w: add(p.claws[q].w, [0, 0, 0.05 * flex]) };
  }
  return p;
}

/** Going: bobbing a little at each set of three coming down, rolling over them; blades held in, the head forward. */
function goPose(s: Moss, p: Pose, a: Anim): void {
  const g = smooth(a.go), G = s.gait, w = frac(a.u), run = a.gait;
  if (g <= 0) return;
  p.z -= g * (G.bob * (0.5 + 0.5 * Math.cos(TAU * 2 * w - 0.6)) * (1 + 0.3 * run) + 0.02 * run);
  p.pitch += g * (-1.5 * run + 1 * Math.sin(TAU * 2 * w - 1.2));
  p.roll += g * G.sway * Math.sin(TAU * w);
  p.head = [lerp(p.head[0], -4 + 3 * Math.sin(TAU * 2 * w), g), lerp(p.head[1], 0, g), lerp(p.head[2], -3 * Math.sin(TAU * w), g)];
  if (p.claws) {
    for (let q = 0; q < 2; q++) {
      const sd = q ? 1 : -1, c = p.claws[q];
      const held: Claw = { ...c, w: add(c.w, [-sd * 0.04 * run, -0.06 * run + 0.03 * Math.sin(TAU * w + q * Math.PI), 0.05 + 0.04 * run]), pitch: c.pitch + 8 };
      p.claws[q] = mixClaw(c, held, g);
    }
  }
}

/** A strike, by stage: a nip of its jaws as it lunges; the bigger two rear with their blades open and slash them shut across each other. */
function strikePose(s: Moss, p: Pose, t: number): void {
  const hit = MOSS_HITS[s.stage], G = MOSS_STRIKE.gather;
  const gather = ramp(t, 0.02, G) * (1 - ramp(t, G, hit));
  const thrust = ramp(t, G, hit) * (1 - ramp(t, hit + 0.12, 0.98));
  if (!p.claws) {
    p.y += -0.06 * gather + 0.12 * thrust;
    p.z += -0.02 * gather + 0.02 * thrust;
    p.pitch += -5 * gather + 5 * thrust;
    p.head[0] += -16 * gather + 20 * thrust;
    p.jaw = Math.max(p.jaw, gather * 1.0 + (t < hit ? 0 : 0) - thrust * 0.5);
    if (t >= hit) p.jaw = 0;
    p.reach = 0.2 * thrust;
    return;
  }
  p.y += -0.05 * gather + 0.1 * thrust;
  p.z += 0.05 * gather - 0.02 * thrust;
  p.pitch += 9 * gather - 4 * thrust;
  p.head[0] += 8 * gather - 12 * thrust;
  p.reach = 0.1 * thrust;
  const c = p.claws;
  for (let q = 0; q < 2; q++) {
    const sd = q ? 1 : -1;
    const R = s.scythes!.rest.w;
    const up = clawAt(sd, [R[0] * 1.05, R[1] * 0.85, R[2] + 0.4], 24, -28, 0), shut = clawAt(sd, [R[0] * 0.3, R[1] * 1.15, R[2] + (q ? 0.04 : 0)], -6, 38, 0);
    c[q] = t < G ? mixClaw(c[q], up, gather) : t < hit ? mixClaw(up, shut, ramp(t, G, hit) ** 1.6) : mixClaw(shut, c[q], ramp(t, hit + 0.12, 0.98));
  }
}

/** How far into its task it is: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.08) * (1 - ramp(t, 0.92, 1)));

/**
 * A go at its task. The Mossnib bows its head to the patch in front of it and nips at it three times, jaws snapping, and lifts
 * its head with the tuft. The bigger two lower their blades either side of the patch, open them out, and shut them across each
 * other twice, scissoring, then lift the cut moss up before their face.
 */
function workPose(s: Moss, p: Pose, t: number, graze: number): void {
  const d = downOf(t, graze), W = MOSS_WORK;
  if (!p.claws) {
    const bow = ramp(t, 0.02, 0.16) * (1 - ramp(t, W.lift - 0.04, W.lift + 0.06));
    const nip = W.nips.reduce((k, c) => k + hump(t, c, 0.06), 0);
    const lift = hump(t, W.lift + 0.06, 0.12);
    p.pitch += d * (-7 * bow - 2 * nip + 3 * lift);
    p.z -= d * 0.02 * bow;
    p.head[0] += d * (-24 * bow - 8 * nip + 12 * lift);
    p.head[1] *= 1 - d;
    p.jaw = lerp(p.jaw, Math.max(0, 1 - nip * 1.6) * bow + 0.15 * lift, d);
    return;
  }
  const c = p.claws, down = ramp(t, 0.02, 0.14) * (1 - ramp(t, W.lift - 0.02, W.lift + 0.08));
  const opened = Math.max(hump(t, W.open[0] + 0.02, 0.12), hump(t, W.open[1], 0.1)) * down;
  const shut = W.snips.reduce((k, x) => k + hump(t, x + 0.02, 0.07), 0) * down;
  const lift = hump(t, W.lift + 0.08, 0.14);
  for (let q = 0; q < 2; q++) {
    const sd = q ? 1 : -1;
    const R = s.scythes!.rest.w;
    // Down to the patch, opened out, and shut across each other, the right blade riding over the left.
    const low = clawAt(sd, [R[0] * 0.8, R[1] + 0.04, -0.3], -6, 10, 0);
    const wide = clawAt(sd, [R[0] * 1.1, R[1], -0.3], -6, -26, 0);
    const cross = clawAt(sd, [R[0] * 0.32, R[1] + 0.1, -0.3 + (q ? 0.05 : 0)], -6, 40, 0);
    const up = clawAt(sd, [R[0] * 0.55, R[1], R[2] + 0.25], 18, 26, 0);
    let k = mixClaw(low, wide, opened);
    k = mixClaw(k, cross, clamp(shut));
    k = mixClaw(k, up, lift);
    c[q] = mixClaw(c[q], k, d * Math.max(down, lift));
  }
  p.head[0] += d * (-10 * down + 8 * lift);
  p.head[1] *= 1 - d;
  p.pitch += d * (-4 * down + 3 * lift);
  p.z -= d * 0.02 * down;
}

/** Evolving: crouched under the burst, drawn up tall at the turn, blades raised, a shake, and settled. */
function evolvePose(s: Moss, p: Pose, t: number): void {
  const crouch = ramp(t, 0, 0.1) * (1 - ramp(t, 0.14, 0.32)), up = ramp(t, 0.16, 0.46) * (1 - ramp(t, 0.62, 0.88)), shake = hump(t, 0.54, 0.1);
  p.z += -0.05 * crouch + 0.06 * up;
  p.pitch += 9 * up;
  p.roll += 3 * shake * Math.sin(t * 60);
  p.head[0] += -12 * crouch + 18 * up;
  p.jaw = Math.max(p.jaw, 0.6 * up);
  if (p.claws) {
    const R = s.scythes!.rest.w;
    for (let q = 0; q < 2; q++) p.claws[q] = mixClaw(p.claws[q], clawAt(q ? 1 : -1, [R[0], R[1] * 0.85, R[2] + 0.45], 26, -24, 0), up);
  }
}

function poseOf(s: Moss, a: Anim): Pose {
  const p = standPose(s, a);
  goPose(s, p, a);
  const act = a.act;
  if (act?.kind === 'strike') strikePose(s, p, act.t);
  else if (act?.kind === 'work') workPose(s, p, act.t, a.graze);
  else if (act?.kind === 'evolve') evolvePose(s, p, act.t);
  else if (a.graze > 0 && a.go < 1) workPose(s, p, 0.05, a.graze * (1 - a.go));
  return p;
}

/* ---- its bones ---------------------------------------------------------------------------- */

const hipOf = (s: Moss, i: number, sd: number): V3 => [sd * s.legs.x, s.legs.ys[i], s.legs.z];
/** Which of the two sets of three a leg is in: the front and back on one side with the middle on the other. */
const setOf = (i: number, sd: number): number => (i + (sd > 0 ? 0 : 1)) % 2;
/** How far over the ground the lowest of a blade put down is: touching it, never in it; and over how far the ground takes it. */
const FLOOR = 0.004;
const SOFT = 0.04;

/** Where a foot is on the ground: out from its hip and fanned round standing; going, swept back while down and brought forward while up. */
function footOf(s: Moss, i: number, sd: number, a: Anim, reach: number): V3 {
  const L = s.legs, fan = L.fan[i] * DEG, h = hipOf(s, i, sd);
  const rest: V3 = [h[0] + sd * Math.cos(fan) * L.reach, h[1] + Math.sin(fan) * L.reach + (i === 0 ? reach * (L.upper + L.lower) : 0), 0];
  if (a.go <= 0 || a.act) return rest;
  const G = s.gait, run = a.gait, g = smooth(a.go);
  const duty = lerp(G.duty[0], G.duty[1], run), sweep = lerp(G.sweep[0], G.sweep[1], run), high = lerp(G.lift[0], G.lift[1], run);
  const ph = frac(a.u + setOf(i, sd) * 0.5);
  let dy = 0, up = 0;
  if (ph < duty) dy = sweep * (0.5 - ph / duty);
  else {
    const u = (ph - duty) / (1 - duty);
    dy = sweep * (smooth(u) - 0.5);
    up = high * Math.sin(Math.PI * u);
  }
  return [rest[0], rest[1] + g * dy, g * up];
}

/** Where the patch of moss it cuts lies, in front of it, on the ground (body frame, along and across). */
const patchSpot = (s: Moss): V3 => [0, s.scythes ? s.scythes.rest.w[1] + s.scythes.len * 0.6 : s.head.at[1] + s.head.r[1] * 1.05 + s.patch * 0.35, 0];

function mossBones(s: Moss): (a: Anim) => Bones {
  const pts = s.scythes ? bladePoints(s) : [];
  return (a) => {
    const p = poseOf(s, a);
    const body = joint(ROOT, [0, p.y, p.z], p.pitch, p.roll, p.yaw);
    const b: Bones = { body };
    b.head = joint(body, s.head.at, p.head[0], p.head[2], p.head[1]);
    if (!s.scythes) {
      const J = jawAt(s);
      b.jaw1 = joint(b.head, J, 0, 0, 24 * p.jaw - 4);
      b.jaw0 = joint(b.head, [-J[0], J[1], J[2]], 0, 0, -(24 * p.jaw - 4));
    }
    b.shadow = shadowOf(body, Math.max(0, p.z - s.high) * 2);
    const up: V3 = [0, 0, 1];
    for (let q = 0; q < 2; q++) {
      const sd = q ? 1 : -1;
      for (let i = 0; i < 3; i++) {
        const hip = place(body, hipOf(s, i, sd)), foot = footOf(s, i, sd, a, p.reach);
        const kn = kneeOf(hip, foot, s.legs.upper, s.legs.lower, up);
        const N = cross(sub(foot, hip), up);
        const upper = inPlane(hip, sub(kn, hip), N), lower = inPlane(kn, sub(foot, kn), N);
        b[`leg${i}${q}0`] = upper;
        b[`leg${i}${q}1`] = lower;
        const tip: Xf = { m: lower.m, t: foot };
        if (i === 0) b[`f${sd > 0 ? 'r' : 'l'}2`] = tip;
        if (i === 2) b[`h${sd > 0 ? 'r' : 'l'}2`] = tip;
      }
      if (p.claws && s.scythes) {
        const C = s.scythes, c = p.claws[q];
        const hand0 = joint({ m: body.m, t: [0, 0, 0] }, [0, 0, 0], c.pitch, c.roll, c.yaw);
        const wrist = place(body, c.w);
        let lo = Infinity;
        for (const pt of pts) lo = Math.min(lo, place(hand0, pt)[2]);
        const dz = FLOOR - lo - wrist[2];
        wrist[2] += 0.5 * (dz + Math.sqrt(dz * dz + SOFT * SOFT));
        const hand: Xf = { m: hand0.m, t: wrist };
        const sh = place(body, [sd * C.at[0], C.at[1], C.at[2]]);
        const pole = sub(place(body, [sd * 1.0, -0.2, 0.6]), body.t);
        const [A1, A2] = C.arm, el = kneeOf(sh, wrist, A1, A2, pole);
        const plane = cross(sub(wrist, sh), pole);
        b[`arm${q}0`] = aim(sh, sub(el, sh), cross(plane, sub(el, sh)));
        b[`arm${q}1`] = aim(el, sub(wrist, el), cross(plane, sub(wrist, el)));
        b[`claw${q}`] = hand;
      }
    }
    // The patch of moss it cuts, in front of it, lower after each cut; the cut tuft lifted before its face and gone.
    const act = a.act, W = MOSS_WORK;
    const working = act?.kind === 'work' ? act.t : a.graze > 0 && a.go < 1 ? 0.05 : -1;
    const d = act?.kind === 'work' ? downOf(act.t, a.graze) : a.graze;
    if (working >= 0) {
      const t = working, there = smooth((d - 0.05) / 0.4);
      const cuts = s.scythes ? W.snips : W.nips;
      const trimmed = cuts.reduce((k, x) => k + ramp(t, x, x + 0.04), 0) / cuts.length;
      const k = there * (1 - 0.45 * trimmed) * (t > W.gone ? ramp(t, W.gone, 1) : 1) + (t > W.gone ? 0 : 0);
      const spot = place(joint(ROOT, [0, p.y, 0], 0, 0, p.yaw), patchSpot(s));
      if (k > 0.01) b.patch = { m: [there, 0, 0, 0, there, 0, 0, 0, Math.max(0.05, k)], t: [spot[0], spot[1], 0] };
      const lift = ramp(t, W.lift - 0.04, W.lift + 0.06) * (1 - ramp(t, W.gone - 0.06, W.gone));
      if (lift > 0.01) {
        const at = s.scythes ? mixV(place(b.claw0, [0, s.scythes.len * 0.35, s.scythes.len * 0.12]), place(b.claw1, [0, s.scythes.len * 0.35, s.scythes.len * 0.12]), 0.5)
          : place(b.head, [0, s.head.r[1] * 1.25, -s.head.r[2] * 0.55]);
        const g = lift * there;
        b.tuft = { m: [g, 0, 0, 0, g, 0, 0, 0, g], t: at };
      }
    }
    return b;
  };
}

/* ---- its pieces --------------------------------------------------------------------------- */

function mossBuild(s: Moss, lod: number): Piece[] {
  const n = cut(lod, 8, 11), k = cut(lod, 4, 6), nb = cut(lod, 16, 24), fine = lod > 0;
  const pieces: Piece[] = [];
  const S = s.shell;
  const shellSolid = { c: [0, lerp(S.y0, S.y1, S.cut / 2), S.z0] as V3, r: [S.w * 0.9, (S.y1 - S.y0) * 0.42, S.h * 0.88] as V3 };
  pieces.push({ key: 'shell', mesh: merge(domeOf(S, nb, fine), shellMarks(s)), bone: 'body', bias: 0 });
  pieces.push({ key: 'belly', mesh: bellyOf(s, n, k), bone: 'body', bias: -0.02, under: ['shell'] });
  pieces.push({ key: 'moss', mesh: mossOf(s, fine), bone: 'body', bias: 0.02, after: ['shell'], thin: true });
  if (s.flowers) pieces.push({ key: 'flowers', mesh: flowersOf(s), bone: 'body', bias: 0.03, after: ['moss'] });
  if (s.fins.length) pieces.push({ key: 'fins', mesh: finsOf(s, fine), bone: 'body', bias: 0.025, after: ['shell', 'moss'] });
  if (s.skirt) pieces.push({ key: 'skirt', mesh: skirtOf(s, fine), bone: 'body', bias: -0.01, under: ['shell'] });
  const headSolid = { c: [0, 0, 0] as V3, r: scale(s.head.r, 0.9) };
  if (s.scythes) {
    // A dark neck the head plate is set into, under the shell's front edge.
    const H = s.head;
    pieces.push({ key: 'neck', mesh: orb([0, H.at[1] - H.r[1] * 0.55, H.at[2] - H.r[2] * 0.15], [H.r[0] * 1.3, H.r[1] * 0.8, H.r[2] * 1.05], n + 2, k, 'bark'), bone: 'body', bias: 0.01, after: ['belly'], under: ['head'] });
    pieces.push({ key: 'head', mesh: plateHead(s, n, k, false), shut: plateHead(s, n, k, true), bone: 'head', bias: 0.04, front: [0, 1, 0], after: ['belly', 'neck'] });
  }
  else pieces.push({ key: 'head', mesh: roundHead(s, n, k, false), shut: roundHead(s, n, k, true), bone: 'head', bias: 0.04, front: [0, 1, 0], after: ['belly'] });
  if (s.feelers) pieces.push({ key: 'feelers', mesh: feelersOf(s, n, fine), bone: 'head', bias: 0.05, after: ['head', 'shell'], hide: [headSolid], hideIn: 'head' });
  if (s.horns) pieces.push({ key: 'horns', mesh: hornsOf(s, n), bone: 'head', bias: 0.05, after: ['head'], hide: [headSolid], hideIn: 'head' });
  if (!s.scythes) {
    const J = jawOf(s, n);
    pieces.push({ key: 'jaw1', mesh: J, bone: 'jaw1', bias: 0.045, after: ['head'], front: [0, 1, 0] });
    pieces.push({ key: 'jaw0', mesh: mirroredMesh(J), bone: 'jaw0', bias: 0.045, after: ['head'], front: [0, 1, 0] });
  }
  // Legs.
  const up = upperOf(s), low = lowerOf(s);
  for (let q = 0; q < 2; q++) {
    const sd = q ? 1 : -1;
    for (let i = 0; i < 3; i++) {
      const lf: V3 = [sd, 0, 0];
      pieces.push(
        { key: `leg${i}${q}0`, mesh: up, bone: `leg${i}${q}0`, bias: 0.01, after: 'belly', front: lf, hide: [shellSolid], hideIn: 'body' },
        { key: `leg${i}${q}1`, mesh: low, bone: `leg${i}${q}1`, bias: 0.015, after: [`leg${i}${q}0`, 'belly'], front: lf, hide: [shellSolid], hideIn: 'body', thin: s.stage === 0 },
      );
    }
  }
  if (s.scythes) {
    const C = s.scythes, T = C.thick, blade1 = scytheOf(s, fine);
    for (let q = 0; q < 2; q++) {
      const sd = q ? 1 : -1, front: V3 = [sd * 0.5, 1, 0];
      pieces.push(
        { key: `arm${q}0`, mesh: tube([[0, -T, 0], [0, C.arm[0] + T * 0.3, 0]], T, T, 6, 'bark', { seam: 'start' }), bone: `arm${q}0`, bias: 0.02, after: 'belly', front, hide: [shellSolid], hideIn: 'body' },
        { key: `arm${q}1`, mesh: merge(orb([0, 0, 0], T * 1.12, 6, 3, 'hornDark'), tube([[0, 0, 0], [0, C.arm[1] + T * 0.3, 0]], T * 1.05, T * 1.05, 6, (ring) => (ring === 0 ? 'bark' : 'bark')), orbAlong([0, C.arm[1] * 0.5, T * 0.3], [0, 1, 0], [T * 1.15, T * 0.8, C.arm[1] * 0.32], 6, 3, 'mark')), bone: `arm${q}1`, bias: 0.025, after: ['belly', `arm${q}0`], front },
        { key: `claw${q}`, mesh: q ? blade1 : mirroredMesh(blade1), bone: `claw${q}`, bias: 0.03, after: [`arm${q}1`, 'belly'], front },
      );
    }
  }
  // What it cuts.
  pieces.push({ key: 'patch', mesh: patchOf(s.patch, fine), bone: 'patch', bias: 0.06, shown: (a) => a.act?.kind === 'work' || (a.graze > 0 && a.go < 1) });
  pieces.push({ key: 'tuft', mesh: tuftOf(s.patch, fine), bone: 'tuft', bias: 0.07, shown: (a) => a.act?.kind === 'work' });
  return pieces;
}

/* ---- what it throws about ----------------------------------------------------------------- */

const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const MOSSY: readonly RGB[] = [[172, 190, 58], [128, 160, 52], [204, 214, 96]];
const CREAM: RGB = [240, 226, 196];
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;
const pxOf = (g: CanvasRenderingContext2D): number => { const tr = g.getTransform(); return 1 / (Math.hypot(tr.a, tr.b) || 1); };
const thrown = (p: V3, v: V3, t: number, fall = 9): V3 => [p[0] + v[0] * t, p[1] + v[1] * t, Math.max(0.02, p[2] + v[2] * t - 0.5 * fall * t * t)];

/** A snip of moss in the air: a small inked frond. */
function bit(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, c: RGB, al: number): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 1.4 * px);
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(-r, 0);
  g.lineTo(-r * 0.3, -r * 0.45);
  g.lineTo(0, -r * 0.1);
  g.lineTo(r * 0.35, -r * 0.5);
  g.lineTo(r, 0);
  g.lineTo(r * 0.2, r * 0.42);
  g.lineTo(-r * 0.4, r * 0.3);
  g.closePath();
  g.fillStyle = css(c, al);
  g.fill();
  g.lineWidth = Math.max(0.5 * px, r * 0.16);
  g.strokeStyle = css(mix(c, [40, 50, 20], 0.65), al * 0.9);
  g.stroke();
  g.restore();
}
/** A glint off a blade's edge as it shuts. */
function glint(g: CanvasRenderingContext2D, x: number, y: number, r: number, al: number): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 3 * px);
  g.save();
  g.beginPath();
  for (let q = 0; q < 8; q++) {
    const a = (q / 8) * TAU, k = q % 2 ? r * 0.2 : r;
    if (q) g.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k); else g.moveTo(x + Math.cos(a) * k, y + Math.sin(a) * k);
  }
  g.closePath();
  g.fillStyle = css([255, 252, 236], al);
  g.fill();
  g.restore();
}

/** Its task: snips of moss flying up off the patch at each nip or cut, a glint where the blades cross. */
function workBits(g: CanvasRenderingContext2D, view: View, s: Moss, b: Bones, a: Anim, t: number, front: boolean): void {
  const W = MOSS_WORK, T = ACT_SECS.work, mid = b.body.t, big = 0.6 + 0.3 * s.stage;
  const d = downOf(t, a.graze);
  if (d < 0.05 || !b.patch) return;
  const c = add(b.patch.t, [0, 0, s.patch * 0.3]);
  const cuts = s.scythes ? W.snips : W.nips;
  cuts.forEach((at, q) => {
    const since = (t - at) * T;
    if (since < 0 || since > 0.4) return;
    for (let e = 0; e < 5 + 2 * s.stage; e++) {
      const ang = jitter(q * 9 + e) * TAU, sp = (0.3 + 0.5 * jitter(q * 7 + e)) * big;
      const p = thrown(c, [Math.cos(ang) * sp, Math.sin(ang) * sp, (0.9 + 0.6 * jitter(e + q)) * big], since, 6);
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      bit(g, x, y, 0.04 * big, ang + since * 8, MOSSY[e % 3], 1 - since / 0.4);
    }
    if (s.scythes && front && since < 0.12) {
      const at2 = mixV(place(b.claw0, [0, s.scythes.len * 0.6, -s.scythes.len * 0.1]), place(b.claw1, [0, s.scythes.len * 0.6, -s.scythes.len * 0.1]), 0.5);
      const [x, y] = onScreen(view, at2);
      glint(g, x, y, 0.08 * big, 1 - since / 0.12);
    }
  });
}

/** A strike landing: snips of moss and cream chips off the blow, and a glint. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Moss, b: Bones, t: number, front: boolean): void {
  const since = (t - MOSS_HITS[s.stage]) * ACT_SECS.strike;
  if (since <= 0 || since > 0.45) return;
  const big = 0.6 + 0.35 * s.stage, mid = b.body.t;
  const at: V3 = s.scythes ? mixV(place(b.claw0, pointOf(s)), place(b.claw1, pointOf(s)), 0.5) : place(b.head, [0, s.head.r[1] * 1.3, -s.head.r[2] * 0.4]);
  for (let q = 0; q < 6 + 3 * s.stage; q++) {
    const ang = jitter(q + 11) * TAU, sp = (0.5 + 0.8 * jitter(q + 3)) * big;
    const p = thrown(at, [Math.cos(ang) * sp, Math.sin(ang) * sp + 0.3, (1.3 + jitter(q + 5)) * big], since, 9);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    bit(g, x, y, 0.04 * big, ang + since * 12, q % 4 === 0 ? CREAM : MOSSY[q % 3], 1 - smooth((since - 0.25) / 0.2));
  }
  if (front && since < 0.14) {
    const [x, y] = onScreen(view, at);
    glint(g, x, y, 0.14 * big, 1 - since / 0.14);
  }
}

/** Evolving: snips of moss and leaves swirling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Moss, b: Bones, t: number, front: boolean): void {
  const big = 0.7 + 0.35 * s.stage, mid = b.body.t, S = s.shell;
  const al = ramp(t, 0.06, 0.16) * (1 - ramp(t, 0.46, 0.52));
  if (al <= 0) return;
  const rx = S.w * 1.6 + 0.25 * big, ry = (S.y1 - S.y0) * 0.75 + 0.25 * big, high = (S.h + s.high) * 1.8 + 0.4 * big;
  for (let q = 0; q < 18; q++) {
    const u = clamp((t - 0.06 - 0.1 * jitter(q + 13)) / 0.36), ang = (q / 18) * TAU + u * TAU * 1.4, k = (1 - u) ** 1.2;
    const p = place(b.body, [Math.cos(ang) * rx * k, Math.sin(ang) * ry * k, u * high * 0.6 - s.high * 0.5]);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    bit(g, x, y, 0.05 * big * (1 - 0.4 * u), ang * 2, q % 4 === 0 ? CREAM : MOSSY[q % 3], al * ramp(u, 0, 0.15));
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

function mossKind(s: Moss): Kind {
  const bones = mossBones(s);
  return {
    bones,
    build: (lod) => mossBuild(s, lod),
    // The variant's coat is its shell's green and its markings the cream of its plates' edges and its face; its moss, its body's
    // brown and its eyes' olive the same on every variant.
    palette: (coat, mark) => {
      const shell = mix(coat, [50, 60, 10], 0.06), cream = mark;
      return coatPalette(coat, mark, {
        coat: shell,
        coatDark: mix(shell, [30, 50, 20], 0.35),
        coatLight: mix(shell, [196, 180, 72], 0.34),
        mark: cream,
        shellDark: mix(cream, [150, 120, 80], 0.32),
        belly: [70, 50, 36],
        bark: [104, 74, 52],
        hornDark: [72, 50, 36],
        claw: [92, 62, 42],
        moss: [166, 168, 30],
        leaf: [200, 194, 44],
        leafDark: [86, 98, 22],
        eye: [44, 40, 22],
        crystal: [150, 146, 46],
        glint: [255, 254, 244],
        petal: [252, 250, 242],
        bloom: [246, 200, 60],
        lid: mix(cream, [120, 96, 60], 0.4),
      } as Partial<ReturnType<Kind['palette']>>);
    },
    shadow: [(s.legs.ys[0] - s.legs.ys[2]) * 0.5 + s.legs.reach * 0.9 + 0.15, s.legs.x + s.legs.reach * 0.9],
    stride: 1.4,
    size: s.size,
    blinks: 5,
    acts: ['strike', 'work'],
    motes: [[176, 192, 64], [240, 226, 196]],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (act?.kind === 'work') workBits(g, view, s, b, a, act.t, front);
      else if (act?.kind === 'strike') strikeBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const MOSSNIB = mossKind(MOSSNIB_LOOK);
export const MOSSSHEAR = mossKind(MOSSSHEAR_LOOK);
export const MOSSREAVER = mossKind(MOSSREAVER_LOOK);
