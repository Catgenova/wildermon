import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, darker, dot, drift, frac, lerp, lighter, merge, mirrored, mix, moved, orb, orbAlong,
  paint, pastel, scale, smile, smooth, sub, TAU, taper, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { blade, cut, under } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The mantis line: the Sprigmant, a small young mantis standing up on four
 * thin legs, big glossy pink eyes on a small three-cornered head, short
 * forelegs folded under it and a pair of pink-and-green wing buds on its
 * back; which grows into the Petalblade, taller, its four wings spread up
 * behind it like petals, green with pink panels, its long forelegs held up
 * with a pink petal of a blade on each; and then the Bloomreaper, tall and
 * long, its green wings long leaves swept up and back over pink feathery
 * hindwings with a touch of powder blue in them, and its forelegs great
 * leaf-blades edged pink, held up like scythes. All three are sage and lime
 * green with blush-pink edges, and have long thin feelers. The species is
 * still `grazza` underneath, as saves and the database know it: the grass
 * cutter, that cuts grass and moss and brings them home.
 *
 * All three are built by one set of functions from a description of the
 * stage (`Mantis`), so a stage is its numbers. Its body is a short waist the
 * walking legs hang from, a long abdomen behind it and a long neck of a
 * prothorax reared up in front, its head at the top and its raptorial
 * forelegs off the front of it: coxa, femur and tibia, each turned against a
 * level frame at the shoulder so a sweep of the arm is level over the
 * ground. Each walking foot is given a point on the ground and its leg bent
 * up to reach it, the knee high over the body as a mantis's is, so a planted
 * foot stays where it was put. It walks deliberately, the diagonals by
 * turns, rocking forward and back on its legs as a leaf does in the wind, its
 * forelegs folded and its head steady.
 *
 * At its task it scythes: crouched low, each bladed foreleg in turn swept
 * across the grass in front of it, the tufts there cut down and the
 * clippings thrown; then both forelegs drawn in together to gather what was
 * cut, the sheaf of grass and moss lifted to its chest and set down on its
 * heap. It strikes with the forelegs: the Sprigmant a quick snap, the
 * Petalblade the same with its wings flared, the Bloomreaper a scything slash
 * from high over its head.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** A walking leg: its hip along the waist (y), its femur and tibia, and where its foot stands, out from the hip and along. */
interface Walker { hipY: number; fe: number; ti: number; at: [number, number] }

/**
 * A wing: how long it reaches back from its root and how wide (half) at its widest; its look (a bud, a petal, a leaf, or a fan of
 * feathers); and how it is held: raised up over the back (degrees, its outer edge up), spread out from the body, and its tip
 * risen up from level.
 */
interface Wing { len: number; w: number; look: 'bud' | 'petal' | 'pink' | 'leaf' | 'fan'; lift: number; spread: number; rise: number }

/**
 * A raptorial foreleg: its coxa, femur and tibia; how thick; the femur's blade (half-widths to its inner side and its outer, and
 * whether it is a leaf edged pink or green with a pink panel); the tibia's (a scythe edged pink, a pink petal, or a fine pink
 * edge of spines).
 */
interface Raptor { coxa: number; fe: number; ti: number; w: number; blade: [number, number]; leaf: 'spine' | 'panel' | 'edged'; scythe: number; flap: 'spine' | 'petal' | 'scythe' }

/** A pose of a foreleg: the coxa's, femur's and tibia's pitch against level (degrees, up positive), how far it is swung out from straight ahead, and rolled. */
interface Arm { c: number; f: number; t: number; out: number; roll: number }

interface Mantis {
  stage: 0 | 1 | 2;
  /** How big it is drawn against how it is built (`Kind.size`). */
  size: number;
  /** How high its waist is over the ground, standing. */
  high: number;
  /** The waist's half-sizes. */
  waist: V3;
  /** The abdomen: long, wide (half), deep (half); tipped down from level (degrees), and curled up at its tip. */
  abd: { len: number; w: number; h: number; tilt: number; curl: number };
  /** The prothorax: how long, how thick, how far reared up from level (degrees), and where along it the forelegs are. */
  pro: { len: number; w: number; tilt: number; shoulder: number };
  /** The head's half-sizes (across, front to back, up), its eyes' radius, its feelers' length; how far its face is tipped down. */
  head: { r: V3; eye: number; ant: number; nod: number };
  rap: Raptor;
  /** Its forelegs as it stands. */
  rest: Arm;
  mid: Walker;
  hind: Walker;
  /** How thick its walking legs are. */
  legW: number;
  fore: Wing;
  hindWing: Wing;
  /**
   * How it goes: how far a foot sweeps back while it is down, at a walk and at a run; how much of a stride each is down; how high
   * a foot is lifted; how far it rocks forward and back as it goes.
   */
  gait: { sweep: [number, number]; duty: [number, number]; lift: [number, number]; rock: number };
}

/** A Sprigmant: small and upright, a big-eyed head on a short neck, short folded forelegs, wing buds, thin legs. */
const SPRIGMANT_LOOK: Mantis = {
  stage: 0,
  size: 3.0,
  high: 0.3,
  waist: [0.15, 0.2, 0.15],
  abd: { len: 0.72, w: 0.2, h: 0.18, tilt: -12, curl: 0.14 },
  pro: { len: 0.46, w: 0.085, tilt: 70, shoulder: 0.72 },
  head: { r: [0.34, 0.17, 0.25], eye: 0.2, ant: 0.8, nod: -10 },
  rap: { coxa: 0.24, fe: 0.32, ti: 0.26, w: 0.06, blade: [0.04, 0.012], leaf: 'spine', scythe: 0.035, flap: 'spine' },
  rest: { c: -64, f: 68, t: -116, out: 14, roll: 0 },
  mid: { hipY: 0.06, fe: 0.5, ti: 0.52, at: [0.4, 0.42] },
  hind: { hipY: -0.13, fe: 0.55, ti: 0.58, at: [0.44, -0.55] },
  legW: 0.034,
  fore: { len: 0.46, w: 0.15, look: 'bud', lift: 30, spread: 12, rise: 22 },
  hindWing: { len: 0.38, w: 0.13, look: 'bud', lift: 44, spread: 30, rise: 10 },
  gait: { sweep: [0.3, 0.42], duty: [0.68, 0.52], lift: [0.12, 0.16], rock: 0.035 },
};

/** A Petalblade: taller, four petal wings spread up behind, long forelegs held up with pink petals on them, long thin legs. */
const PETALBLADE_LOOK: Mantis = {
  stage: 1,
  size: 3.1,
  high: 0.45,
  waist: [0.17, 0.28, 0.17],
  abd: { len: 1.35, w: 0.24, h: 0.21, tilt: -16, curl: 0.12 },
  pro: { len: 0.82, w: 0.095, tilt: 50, shoulder: 0.76 },
  head: { r: [0.33, 0.17, 0.25], eye: 0.165, ant: 1.15, nod: -18 },
  rap: { coxa: 0.4, fe: 0.58, ti: 0.46, w: 0.06, blade: [0.1, 0.05], leaf: 'panel', scythe: 0.13, flap: 'petal' },
  rest: { c: -62, f: 50, t: -106, out: 10, roll: 0 },
  mid: { hipY: 0.1, fe: 0.98, ti: 0.96, at: [0.6, 0.7] },
  hind: { hipY: -0.18, fe: 1.08, ti: 1.06, at: [0.65, -1.0] },
  legW: 0.04,
  fore: { len: 1.9, w: 0.36, look: 'petal', lift: 60, spread: 18, rise: 50 },
  hindWing: { len: 1.75, w: 0.34, look: 'pink', lift: 70, spread: 32, rise: 18 },
  gait: { sweep: [0.46, 0.64], duty: [0.68, 0.5], lift: [0.16, 0.22], rock: 0.05 },
};

/** A Bloomreaper: tall and long, long leaf wings swept back over pink feather fans, great leaf-blade forelegs edged pink. */
const BLOOMREAPER_LOOK: Mantis = {
  stage: 2,
  size: 3.4,
  high: 0.6,
  waist: [0.21, 0.36, 0.21],
  abd: { len: 1.95, w: 0.3, h: 0.26, tilt: -18, curl: 0.1 },
  pro: { len: 1.18, w: 0.115, tilt: 54, shoulder: 0.78 },
  head: { r: [0.37, 0.19, 0.27], eye: 0.17, ant: 1.6, nod: -20 },
  rap: { coxa: 0.5, fe: 1.1, ti: 1.0, w: 0.08, blade: [0.34, 0.2], leaf: 'edged', scythe: 0.3, flap: 'scythe' },
  rest: { c: -45, f: 45, t: -125, out: 16, roll: 0 },
  mid: { hipY: 0.14, fe: 1.1, ti: 1.15, at: [0.75, 0.9] },
  hind: { hipY: -0.24, fe: 1.2, ti: 1.3, at: [0.8, -1.25] },
  legW: 0.048,
  fore: { len: 3.0, w: 0.38, look: 'leaf', lift: 52, spread: 8, rise: 30 },
  hindWing: { len: 2.3, w: 0.5, look: 'fan', lift: 60, spread: 28, rise: 8 },
  gait: { sweep: [0.56, 0.78], duty: [0.7, 0.52], lift: [0.2, 0.26], rock: 0.06 },
};

/* ---- its moves, in time ---------------------------------------------------------------- */

/** When each stage's strike lands, as a share of its strike: the forelegs shut on what is in front of it. */
export const MANTIS_HITS: readonly number[] = [0.46, 0.48, 0.54];
/**
 * A go at its task, as shares of the go: crouched low by `low`; three sweeps of the forelegs over the grass, right, left and right,
 * each from its start in `cuts` to `cuts[k] + SWEEP`; both forelegs drawn in to gather the cut from `gather`, the sheaf lifted to
 * its chest by `lift` and set down on its heap at `set`.
 */
export const MANTIS_WORK = { low: 0.1, cuts: [0.12, 0.27, 0.42] as readonly number[], gather: 0.57, lift: 0.74, set: 0.9 } as const;
/** How long a sweep of a foreleg over the grass takes, as a share of a go. */
const SWEEP = 0.12;

/* ---- small things -------------------------------------------------------------------- */

/** A number of its own for each thing, nought to one, so a fringe is not a pattern. */
const jitter = (i: number): number => frac(Math.sin(i * 12.9898 + 4.1) * 43758.5453);
/** A rise from nought to one between `a` and `b`, eased. */
const ramp = (t: number, a: number, b: number): number => smooth((t - a) / (b - a));
/** A smooth run through keys (time, value), times nought to one in order, held at either end. */
function keysAt(keys: ReadonlyArray<readonly [number, number]>, u: number): number {
  if (u <= keys[0][0]) return keys[0][1];
  for (let q = 0; q < keys.length - 1; q++) {
    const [t0, v0] = keys[q], [t1, v1] = keys[q + 1];
    if (u <= t1) return lerp(v0, v1, smooth((u - t0) / Math.max(1e-6, t1 - t0)));
  }
  return keys[keys.length - 1][1];
}
const len3 = (v: V3): number => Math.hypot(v[0], v[1], v[2]);
const css = (c: RGB, al: number): string => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(al).toFixed(3)})`;
const pxOf = (g: CanvasRenderingContext2D): number => { const tr = g.getTransform(); return 1 / (Math.hypot(tr.a, tr.b) || 1); };
/** Whether a point is on the viewer's side of a body whose middle is at `c`. */
const nearSide = (p: V3, c: V3, view: View): boolean => dot(sub(p, c), view.T) > 0;

/** A frame from its three axes, as columns, at `t`. */
const frame = (X: V3, Y: V3, Z: V3, t: V3): Xf => ({ m: [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]], t });
/** A bone at `o` whose length runs along `dir`, lying in the plane square to `normal`. */
function inPlane(o: V3, dir: V3, normal: V3): Xf {
  const Y = unit(dir), Z = unit(cross(normal, Y));
  return frame(cross(Y, Z), Y, Z, o);
}
/** Where the knee between two parts `a` and `b` long goes so the second ends at `goal` from `root`: out on the side `pole` is. */
function kneeOf(root: V3, goal: V3, a: number, b: number, pole: V3): V3 {
  const d = sub(goal, root), L0 = Math.max(1e-6, len3(d)), u = scale(d, 1 / L0);
  const L = clamp(L0, Math.abs(a - b) + 1e-3, a + b - 1e-3);
  const along = (a * a - b * b + L * L) / (2 * L), up = Math.sqrt(Math.max(0, a * a - along * along));
  const p = unit(sub(pole, scale(u, dot(pole, u))));
  return add(add(root, scale(u, along)), scale(p, up));
}

/** Faces wound so each looks the way it should, whichever way round its corners were listed. */
function woundTo(v: readonly V3[], f: Face[], want: readonly V3[]): Face[] {
  f.forEach((face, q) => {
    const idx = face.i;
    let nx = 0, ny = 0, nz = 0;
    for (let c = 0; c < idx.length; c++) {
      const p = v[idx[c]], r = v[idx[(c + 1) % idx.length]];
      nx += (p[1] - r[1]) * (p[2] + r[2]);
      ny += (p[2] - r[2]) * (p[0] + r[0]);
      nz += (p[0] - r[0]) * (p[1] + r[1]);
    }
    const w = want[q];
    if (nx * w[0] + ny * w[1] + nz * w[2] < 0) idx.reverse();
  });
  return f;
}

/* ---- flat things: a wing, a blade -------------------------------------------------------- */

type P2 = [number, number];

/** A closed smooth line through points (Catmull-Rom), `per` steps from each to the next. */
function closedSpline(pts: readonly P2[], per: number): P2[] {
  const out: P2[] = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let s = 0; s < per; s++) {
      const t = s / per, t2 = t * t, t3 = t2 * t;
      const at = (k: 0 | 1): number => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      out.push([at(0), at(1)]);
    }
  }
  return out;
}

/** How far a plate is bowed out of flat at a point on it. */
type Warp = (x: number, y: number) => number;
const flatWarp: Warp = () => 0;

/** A shape painted on both faces of a plate `th` thick, bowed as the plate is. */
function both(pts: readonly P2[], th: number, m: Mat, warp: Warp = flatWarp): Disc[] {
  const up: V3[] = pts.map(([x, y]) => [x, y, warp(x, y) + th / 2 + 0.004]);
  const down: V3[] = pts.map(([x, y]) => [x, y, warp(x, y) - th / 2 - 0.004]);
  const f = (v: V3[], nz: number): Disc => {
    let a = 0;
    for (let i = 0; i < v.length; i++) a += v[i][0] * v[(i + 1) % v.length][1] - v[(i + 1) % v.length][0] * v[i][1];
    return { v: (a > 0) === (nz > 0) ? v : [...v].reverse(), m };
  };
  return [f(up, 1), f(down, -1)];
}

/** A plate cut to an outline and bowed by `warp`: its two faces, each a fan from a hub in its middle, and its edge. */
function plate(outline: readonly P2[], th: number, top: Mat, bottom: Mat, edge: Mat, warp: Warp = flatWarp): Mesh {
  const n = outline.length, v: V3[] = [], f: Face[] = [], want: V3[] = [];
  const hub: P2 = [outline.reduce((t, p) => t + p[0], 0) / n, outline.reduce((t, p) => t + p[1], 0) / n];
  for (const [x, y] of outline) v.push([x, y, warp(x, y) + th / 2]);
  for (const [x, y] of outline) v.push([x, y, warp(x, y) - th / 2]);
  v.push([hub[0], hub[1], warp(hub[0], hub[1]) + th / 2], [hub[0], hub[1], warp(hub[0], hub[1]) - th / 2]);
  const H0 = 2 * n, H1 = 2 * n + 1;
  for (let k = 0; k < n; k++) {
    const k2 = (k + 1) % n, a = outline[k], b = outline[k2];
    f.push({ i: [H0, k, k2], m: top });
    want.push([0, 0, 1]);
    f.push({ i: [H1, n + k, n + k2], m: bottom });
    want.push([0, 0, -1]);
    f.push({ i: [k, k2, n + k2, n + k], m: edge });
    want.push([b[1] - a[1], a[0] - b[0], 0]);
  }
  return mesh(v, woundTo(v, f, want));
}

/** A vein: a narrowing line from `a` to `b`, `w0` wide (half) at its root and `w1` at its end, bowed `bow` of its length to its left. */
function vein(a: P2, b: P2, w0: number, w1: number, bow = 0): P2[] {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  const K = 5, left: P2[] = [], right: P2[] = [];
  for (let k = 0; k <= K; k++) {
    const u = k / K, w = lerp(w0, w1, u), off = bow * l * Math.sin(Math.PI * u);
    const x = a[0] + dx * u + nx * off, y = a[1] + dy * u + ny * off;
    left.push([x + nx * w, y + ny * w]);
    right.push([x - nx * w, y - ny * w]);
  }
  return [...left, ...right.reverse()];
}

/** A shape given in shares (along nought to one, across minus one to one), laid out `L` long along x and across y, the outer side `wo` wide and the inner `wi`. */
const laid = (pts: readonly P2[], L: number, wo: number, wi = wo): P2[] => pts.map(([u, v]) => [u * L, v * (v > 0 ? wo : wi)]);
/** The same shape drawn in toward its middle line and its ends, for a panel inside it. */
const inset = (pts: readonly P2[], k: number, u0: number, u1: number): P2[] => pts.map(([u, v]) => [lerp(u0, u1, u), v * k]);

/** A petal: narrow at its root, widest past its middle, to a soft point. Along nought to one, across minus one to one. */
const PETAL: readonly P2[] = [[0, 0.1], [0.18, 0.45], [0.45, 0.9], [0.72, 0.85], [0.92, 0.42], [1.0, 0], [0.92, -0.42], [0.72, -0.85], [0.45, -0.9], [0.18, -0.45], [0, -0.1]];
/** A long leaf: a slow swell from its root to its widest a third of the way out, then a long taper to its point, its tip turned up a little. */
const LEAF: readonly P2[] = [[0, 0.08], [0.12, 0.5], [0.35, 0.95], [0.62, 0.8], [0.86, 0.4], [1.0, 0.06], [0.86, -0.28], [0.62, -0.72], [0.35, -0.95], [0.12, -0.5], [0, -0.08]];
/** A scythe along a tibia: all to its inner side, swelling to its belly and curving to a hooked point past its end. */
const SCYTHE: readonly P2[] = [[0.02, 0.15], [0.3, 0.2], [0.65, 0.2], [0.95, 0.3], [1.08, 0.5], [1.02, -0.2], [0.85, -0.75], [0.55, -1.0], [0.25, -0.75], [0.05, -0.3]];

/**
 * A plate built in its own x-y with its faces along z, turned so its x runs along a bone's length (y), its y the bone's z, and its
 * faces look out along the bone's x: a blade on a leg, flat in the plane the leg bends in.
 */
const alongBone = (m: Mesh): Mesh => mesh(m.v.map(([x, y, z]) => [z, x, y] as V3), m.f);

/* ---- the body ------------------------------------------------------------------------------ */

/** The abdomen: long and tapering back along -y from the waist, ringed into segments, pink-bellied, its tip curled up a little. */
function abdMesh(s: Mantis, n: number): Mesh {
  const A = s.abd;
  const us = [0, 0.04, 0.16, 0.19, 0.32, 0.35, 0.48, 0.51, 0.64, 0.67, 0.79, 0.82, 0.92, 1];
  const r = (u: number): number => Math.max(0.1, Math.sin(Math.PI * (0.18 + 0.82 * u)) ** 0.55);
  const pts = us.map((u) => [0, -u * A.len, A.curl * A.len * u * u] as V3);
  const mat = (ring: number, j: number): Mat => (ring > 0 && under(n, j, 1.1) ? 'belly' : ring >= 2 && ring <= 12 && ring % 2 === 0 ? 'coatDark' : 'coat');
  const body = tube(pts, us.map((u) => A.w * r(u)), us.map((u) => A.h * r(u)), n, mat, { seam: 'start' });
  // Its cerci: two short points off the tip.
  const tip = pts[pts.length - 1], c = A.w * 0.12;
  const cerci = merge(...[1, -1].map((sd) => taper([add(tip, [sd * c, 0.04, 0]), add(tip, [sd * c * 2.4, -A.len * 0.07, A.h * 0.18])], c * 0.9, c * 0.3, 4, 'coatDark')));
  return merge(body, cerci);
}

/** The waist: a short round thorax the walking legs hang from. */
const waistMesh = (s: Mantis, n: number, k: number): Mesh => orb([0, 0, 0], s.waist, n, k, 'coat');

/** The prothorax: a long thin neck along +y from the waist, swelling at its shoulders where the forelegs are, and a collar under the head. */
function proMesh(s: Mantis, n: number): Mesh {
  const P = s.pro, w = P.w;
  const us = [-0.1, 0.12, 0.4, P.shoulder - 0.08, P.shoulder, P.shoulder + 0.08, 0.95, 1.04];
  const ws = [1.45, 1.05, 0.85, 1.05, 1.4, 1.2, 0.8, 0.55].map((k) => k * w);
  return tube(us.map((u) => [0, u * P.len, 0] as V3), ws, ws.map((x) => x * 0.95), n, (ring, j) => (under(n, j, 0.9) ? 'coatLight' : 'coat'), { seam: 'start' });
}

/**
 * Its head, looking along y with its top up: a three-cornered face, wide over the eyes and narrowing to the mouth, a small mouth at
 * the point, a crown between the eyes. Built round the neck joint at the origin. The eyes are pieces of their own (`eyeMesh`).
 */
function headMesh(s: Mantis, n: number, k: number): Mesh {
  const R = s.head.r, c: V3 = [0, R[1] * 0.4, R[2] * 0.55];
  const mouth: V3 = [0, c[1] + R[1] * 0.55, c[2] - R[2] * 1.15];
  return merge(
    orb(c, [R[0] * 0.92, R[1], R[2] * 0.7], n, k, 'coat'),
    // The face narrowing down to the mouth: a cone flattened front to back.
    taper(curve(add(c, [0, R[1] * 0.1, -R[2] * 0.05]), add(c, [0, R[1] * 0.35, -R[2] * 0.6]), mouth, 3), R[0] * 0.72, R[0] * 0.14, n, 'coat', 0.62),
    // The crown between the eyes, and the cheeks' paler plates.
    orbAlong(add(c, [0, R[1] * 0.15, R[2] * 0.55]), [0, 0.3, 1], [R[0] * 0.38, R[1] * 0.6, R[2] * 0.32], 7, 4, 'coatLight'),
    orbAlong(add(mouth, [0, -R[1] * 0.05, R[2] * 0.08]), [0, 1, -0.4], [R[0] * 0.18, R[0] * 0.14, R[0] * 0.12], 6, 3, 'muzzle'),
    smile(add(mouth, [0, R[1] * 0.08, R[2] * 0.1]), [0, 1, -0.2], R[0] * 0.2),
  );
}

/** Where its right eye sits on the head. */
const eyeAt = (s: Mantis): V3 => {
  const R = s.head.r;
  return [R[0] * 0.86, R[1] * 0.45, R[2] * 0.98];
};

/**
 * A right eye: a big glossy pink ball, a deeper pink iris looking forward and out with a dark middle, and a white glint high on it
 * with a small one under. Built round its own middle.
 */
function eyeMesh(s: Mantis, n: number, k: number): Mesh {
  const e = s.head.eye, look = unit([0.62, 0.78, 0.05]);
  const side = unit(cross([0, 0, 1], look)), up = cross(look, side);
  const on = (d: V3, out = 1.02): V3 => scale(unit(d), e * out);
  const discs: Disc[] = [
    { ...discOn(on(look), look, e * 0.62, e * 0.68, 'cap') },
    { ...discOn(on(look, 1.04), look, e * 0.3, e * 0.34, 'nose') },
  ];
  const g1 = unit(add(add(look, scale(up, 0.75)), scale(side, -0.35)));
  const g2 = unit(add(add(look, scale(up, -0.45)), scale(side, 0.4)));
  discs.push({ ...discOn(on(g1, 1.07), g1, e * 0.26, e * 0.22, 'glint'), lit: true }, { ...discOn(on(g2, 1.06), g2, e * 0.11, e * 0.1, 'glint'), lit: true });
  return merge(orb([0, 0, 0], e, n + 2, k + 1, 'bloom'), paint(discs));
}

/** A flat oval painted at `c`, facing along `d`. */
function discOn(c: V3, d: V3, rx: number, ry: number, m: Mat): Disc {
  let u = cross([0, 0, 1], d);
  if (len3(u) < 1e-4) u = [1, 0, 0];
  u = unit(u);
  const w = cross(d, u), v: V3[] = [];
  for (let j = 0; j < 10; j++) {
    const t = ((j + 0.5) / 10) * TAU;
    v.push(add(c, add(scale(u, Math.cos(t) * rx), scale(w, Math.sin(t) * ry))));
  }
  return { v, m };
}

/** A right feeler: a long thin line up out of the crown, arching back and out. Built from its root, up z. */
function antMesh(s: Mantis): Mesh {
  const L = s.head.ant;
  const pts = [...curve([0, 0, 0], [0.04 * L, 0.12 * L, 0.55 * L], [0.22 * L, -0.25 * L, 0.92 * L], 5), [0.3 * L, -0.5 * L, 0.98 * L] as V3];
  return taper(pts, 0.022 + 0.004 * s.stage, 0.008, 4, 'horn');
}

/* ---- the forelegs -------------------------------------------------------------------------- */

/** A coxa: a short thick segment from the shoulder, along y. */
const coxaMesh = (s: Mantis, n: number): Mesh => {
  const R = s.rap, w = R.w;
  return tube([[0, -w * 0.5, 0], [0, R.coxa * 0.5, 0], [0, R.coxa + w * 0.3, 0]], [w * 1.25, w * 1.15, w], [w * 1.25, w * 1.15, w], n, 'coat', { seam: 'start' });
};

/**
 * A femur: a thick segment along y, and its blade flat in the plane it bends in: a fine pink edge of spines on its inner side; or a
 * green leaf with a pink panel; or a big green leaf edged pink with a dark midrib and veins.
 */
function femurMesh(s: Mantis, n: number, lod: number): Mesh {
  const R = s.rap, L = R.fe, w = R.w, th = 0.02 + 0.008 * s.stage;
  const parts: Mesh[] = [tube([[0, -w * 0.3, 0], [0, L * 0.35, 0], [0, L * 0.8, 0], [0, L + w * 0.2, 0]], [w, w * 1.25, w * 1.05, w * 0.8], [w, w * 1.3, w * 1.1, w * 0.8], n, 'coat', { seam: 'start' })];
  const per = cut(lod, 3, 5);
  if (R.leaf === 'spine') {
    // A row of small pink spines along its inner edge.
    for (let q = 0; q < 4; q++) {
      const y = L * (0.3 + 0.17 * q);
      parts.push(taper([[0, y, -w * 0.7], [0, y - L * 0.04, -w * 0.7 - R.blade[0]]], w * 0.32, w * 0.06, 4, 'petal'));
    }
    return merge(...parts);
  }
  const out = closedSpline(laid(LEAF.map(([u, v]) => [lerp(0.04, 1.02, u), v] as P2), L, R.blade[1], R.blade[0]), per);
  const paints: Disc[] = [];
  if (R.leaf === 'panel') {
    paints.push(...both(closedSpline(laid(inset(LEAF, 0.6, 0.2, 0.92).map(([u, v]) => [u, v] as P2), L, R.blade[1], R.blade[0]), per), th, 'petal'));
    paints.push(...both(vein([L * 0.06, 0], [L * 0.95, 0], w * 0.3, w * 0.12), th, 'leafDark'));
    parts.push(alongBone(merge(plate(out, th, 'leaf', 'leaf', 'leafDark'), paint(paints))));
  } else {
    // A leaf edged pink: the pink plate with the green leaf painted over all but its rim, a midrib and veins off it.
    paints.push(...both(closedSpline(laid(inset(LEAF, 0.78, 0.07, 0.96), L, R.blade[1], R.blade[0]), per), th, 'leaf'));
    paints.push(...both(vein([L * 0.05, 0], [L * 0.98, 0.0], w * 0.35, w * 0.08), th, 'leafDark'));
    for (const u of [0.25, 0.42, 0.59, 0.76]) {
      paints.push(...both(vein([L * u, 0], [L * (u + 0.14), -R.blade[0] * 0.62 * (1.15 - u * 0.5)], w * 0.13, w * 0.05, 0.05), th, 'leafDark'));
      paints.push(...both(vein([L * u, 0], [L * (u + 0.12), R.blade[1] * 0.55 * (1.15 - u * 0.5)], w * 0.12, w * 0.05, -0.05), th, 'leafDark'));
    }
    parts.push(alongBone(merge(plate(out, th, 'petal', 'petal', 'petal'), paint(paints))));
  }
  return merge(...parts);
}

/**
 * A tibia: a thinner segment along y, a hooked claw at its end, and its blade along its inner side: a fine pink edge, a pink petal,
 * or a green scythe edged pink.
 */
function tibiaMesh(s: Mantis, n: number, lod: number): Mesh {
  const R = s.rap, L = R.ti, w = R.w * 0.75, th = 0.02 + 0.008 * s.stage;
  const parts: Mesh[] = [
    tube([[0, -w * 0.4, 0], [0, L * 0.5, -w * 0.1], [0, L, 0]], [w, w * 0.95, w * 0.7], [w, w * 0.95, w * 0.7], n, 'coat', { seam: 'start' }),
    // The claw at its end, hooked in toward the femur.
    taper(curve([0, L * 0.96, 0], [0, L + w * 2.2, -w * 0.4], [0, L + w * 2.6, -w * 2.2], 3), w * 0.62, w * 0.12, 4, 'claw'),
  ];
  const per = cut(lod, 3, 5);
  if (R.flap === 'spine') {
    for (let q = 0; q < 3; q++) parts.push(taper([[0, L * (0.25 + 0.22 * q), -w * 0.6], [0, L * (0.25 + 0.22 * q) + L * 0.05, -w * 0.6 - R.scythe]], w * 0.35, w * 0.06, 4, 'petal'));
    return merge(...parts);
  }
  const shape = R.flap === 'petal' ? PETAL.map(([u, v]) => [lerp(0.08, 0.98, u), v - 0.35] as P2) : SCYTHE.map(([u, v]) => [lerp(0.04, 0.98, u), v] as P2);
  const out = closedSpline(laid(shape, L, R.scythe * 0.6, R.scythe), per);
  const paints: Disc[] = [];
  if (R.flap === 'petal') {
    paints.push(...both(closedSpline(laid(inset(shape, 0.55, 0.22, 0.9), L, R.scythe * 0.6, R.scythe), per), th, 'membrane'));
    parts.push(alongBone(merge(plate(out, th, 'petal', 'petal', 'petal'), paint(paints))));
  } else {
    paints.push(...both(closedSpline(laid(SCYTHE.map(([u, v]) => [lerp(0.08, 0.86, u), v * 0.62 + 0.12] as P2), L, R.scythe * 0.6, R.scythe), per), th, 'leaf'));
    paints.push(...both(vein([L * 0.06, -R.scythe * 0.2], [L * 0.9, -R.scythe * 0.3], w * 0.25, w * 0.08, 0.04), th, 'leafDark'));
    parts.push(alongBone(merge(plate(out, th, 'petal', 'petal', 'petal'), paint(paints))));
  }
  return merge(...parts);
}

/* ---- the wings ----------------------------------------------------------------------------- */

/** A wing's bow: arched up across its middle and its tip cupped a little, so it is never seen as a stick edge on. */
const wingWarp = (L: number, W: number): Warp => (x, y) => {
  const v = clamp(Math.abs(x) / W), u = clamp(-y / L);
  return 0.12 * W * (1 - v * v) + 0.05 * L * u * u;
};

/**
 * A right wing, built back along -y from its root, out toward +x, its face up: a bud (green with a pink middle); a petal, green with
 * a pink panel and a dark midrib; a pink petal with a paler panel and a green root; a long leaf, green, a dark midrib and veins and
 * its trailing edge pink; or a fan of narrow pink feathers, one of them powder blue.
 */
function wingMesh(W: Wing, lod: number, inner = false): Mesh {
  const per = cut(lod, 3, 5), L = W.len, th = 0.025 + 0.01 * (L > 1 ? 1 : 0);
  if (W.look === 'fan') {
    // Feathers fanned out from the root, each a narrow blade, the outer ones shorter.
    const mats: Mat[] = ['membrane', 'petal', 'membrane', 'feather', 'petal', 'membrane', 'petal'];
    return merge(...mats.map((m, q) => {
      const a = (q - 2.5) * 0.17, l = L * (1 - 0.07 * Math.abs(q - 2.5)), d: V3 = [Math.sin(a) + 0.18, -Math.cos(a), 0];
      return blade(curve([0, 0, 0.02 * q], scale(d, l * 0.5), add(scale(d, l), [0.04 * l, 0, 0.06 * l]), 4), [0.02, W.w * 0.42, W.w * 0.4, W.w * 0.22, 0.01], [0, 0, 1],
        { mat: m, rib: m === 'feather' ? 'feather' : 'petal', fold: 0.12, thick: 0.02 });
    }));
  }
  // Shapes in shares turned to wing coordinates: along goes back (-y), across goes out (+x).
  const shape = W.look === 'leaf' ? LEAF : PETAL;
  const toWing = (pts: readonly P2[], wo: number, wi: number): P2[] => pts.map(([u, v]) => [v * (v > 0 ? wo : wi), -u * L]);
  const warp = wingWarp(L, W.w);
  const out = closedSpline(toWing(shape, W.w, W.w * 0.7), per);
  const paints: Disc[] = [];
  const add2 = (pts: P2[], m: Mat): void => { paints.push(...both(pts, th, m, warp)); };
  const rib = (w0: number): P2[] => vein([0, -L * 0.04], [W.w * 0.08, -L * 0.92], w0, w0 * 0.3, 0.02).map(([x, y]) => [x, y] as P2);
  let base: Mat = 'leaf';
  if (W.look === 'bud') {
    add2(closedSpline(toWing(inset(shape, 0.55, 0.15, 0.85), W.w, W.w * 0.7), per), 'petal');
  } else if (W.look === 'petal') {
    add2(closedSpline(toWing(inset(shape, 0.62, 0.2, 0.9), W.w, W.w * 0.7), per), 'petal');
    add2(closedSpline(toWing(inset(shape, 0.3, 0.32, 0.8), W.w, W.w * 0.7), per), 'membrane');
    add2(rib(W.w * 0.06), 'leafDark');
  } else if (W.look === 'pink') {
    base = 'petal';
    add2(closedSpline(toWing(inset(shape, 0.55, 0.25, 0.92), W.w, W.w * 0.7), per), 'membrane');
    add2(closedSpline(toWing([[0, 0.3], [0.1, 0.6], [0.24, 0.5], [0.3, 0], [0.24, -0.5], [0.1, -0.6], [0, -0.3]], W.w, W.w * 0.7), per), 'leaf');
    add2(rib(W.w * 0.05), 'petal');
  } else {
    // The leaf: its trailing (inner) edge pink, a dark midrib out to its tip and veins off it, leaning back.
    add2(closedSpline(toWing([[0.3, -0.62], [0.55, -0.92], [0.8, -0.62], [0.96, -0.12], [0.86, -0.2], [0.6, -0.6], [0.35, -0.5]], W.w, W.w * 0.7), per), 'petal');
    add2(rib(W.w * 0.07), 'leafDark');
    for (const u of [0.2, 0.36, 0.52, 0.68, 0.82]) {
      const m: P2 = [W.w * 0.08 * u, -L * u];
      add2(vein(m, [m[0] + W.w * 0.62 * (1.1 - u), m[1] - L * 0.12], W.w * 0.035, W.w * 0.012, -0.06), 'leafDark');
      add2(vein(m, [m[0] - W.w * 0.48 * (1.1 - u), m[1] - L * 0.1], W.w * 0.03, W.w * 0.012, 0.06), 'leafDark');
    }
  }
  const wing = merge(plate(out, th, base, base, W.look === 'pink' ? 'petal' : 'leafDark', warp), paint(paints));
  // A petal wing is a fan of two: a smaller petal under it, turned out from it, so the four wings open as a flower does.
  if ((W.look === 'petal' || W.look === 'pink') && !inner) return merge(wing, moved(wingMesh({ ...W, len: L * 0.8, w: W.w * 0.85 }, lod, true), [0, 0, -0.03], 24));
  return wing;
}

/* ---- a sheaf of cut grass --------------------------------------------------------------- */

/** What it gathers in its forelegs: a sheaf of cut grass held across, blade ends out either side, and clumps of moss in it. Round its middle. */
function sheafMesh(s: Mantis): Mesh {
  const k = 0.8 + 0.42 * s.stage, parts: Mesh[] = [];
  for (let q = 0; q < 11; q++) {
    const sd = q % 2 ? 1 : -1, a = (jitter(q + 3) - 0.5) * 0.9, l = k * (0.36 + 0.16 * jitter(q + 7));
    const d = unit([sd, Math.sin(a) * 0.5, 0.15 + 0.5 * jitter(q + 1)]);
    parts.push(blade([[0, 0, 0], scale(d, l * 0.5), add(scale(d, l), [0, 0, -0.05 * k])], [0.035 * k, 0.04 * k, 0.01], [0, 0.3, 1], { mat: q % 3 ? 'stem' : 'leaf', fold: 0.1, thick: 0.015 }));
  }
  parts.push(orbAlong([0, 0, 0], [1, 0, 0], [0.2 * k, 0.12 * k, 0.11 * k], 7, 4, 'stem'));
  for (let q = 0; q < 3; q++) parts.push(orb([(q - 1) * 0.12 * k, 0.06 * k * (q % 2 ? 1 : -1), 0.08 * k], 0.09 * k, 6, 3, 'moss'));
  return merge(...parts);
}

/* ---- its pieces ---------------------------------------------------------------------------- */

function mantisBuild(s: Mantis, lod: number): Piece[] {
  const n = cut(lod, 7, 10), k = cut(lod, 4, 6);
  const R = s.head.r;
  const headHide = [{ c: [0, R[1] * 0.4, R[2] * 0.55] as V3, r: [R[0] * 0.9, R[1], R[2] * 0.7] as V3 }];
  const eye = eyeMesh(s, n, k), ant = antMesh(s);
  const fore = wingMesh(s.fore, lod), hind = wingMesh(s.hindWing, lod);
  const coxa = coxaMesh(s, n), femur = femurMesh(s, n, lod), tibia = tibiaMesh(s, n, lod);
  const lw = s.legW;
  const femurW = tube([[0, -lw * 0.6, 0], [0, 0.5, 0], [0, 1, 0]], [lw * 1.15, lw, lw * 0.85], [lw * 1.15, lw, lw * 0.85], 5, 'coat', { seam: 'start' });
  const tibiaW = merge(
    orb([0, 0, 0], lw * 1.05, 5, 3, 'coatDark'),
    tube([[0, 0, 0], [0, 0.88, 0], [0, 1, 0]], [lw * 0.8, lw * 0.65, lw * 0.45], [lw * 0.8, lw * 0.65, lw * 0.45], 5, 'coat'),
  );
  const pieces: Piece[] = [
    { key: 'waist', mesh: waistMesh(s, n, k), bone: 'body', bias: 0, convex: true },
    { key: 'abd', mesh: abdMesh(s, n), bone: 'abd', bias: -0.01 },
    { key: 'pro', mesh: proMesh(s, n), bone: 'pro', bias: 0.02, after: 'waist' },
    { key: 'head', mesh: headMesh(s, n, k), bone: 'head', bias: 0.12, after: 'pro' },
    { key: 'ant0', mesh: mirrored(ant), bone: 'ant0', bias: 0.11, hide: headHide, hideIn: 'head', thin: true, airy: true },
    { key: 'ant1', mesh: ant, bone: 'ant1', bias: 0.11, hide: headHide, hideIn: 'head', thin: true, airy: true },
    { key: 'eye0', mesh: mirrored(eye), bone: 'eye0', bias: 0.13, after: 'head', front: [-1, 0.3, 0], convex: true },
    { key: 'eye1', mesh: eye, bone: 'eye1', bias: 0.13, after: 'head', front: [1, 0.3, 0], convex: true },
    // The sheaf, only while it has one, grown into its forelegs by `bent`.
    { key: 'sheaf', mesh: sheafMesh(s), bone: 'sheaf', bias: 0.09, airy: true, shown: (a) => sheafOf(a) > 0.02, bent: (v, a) => v.map((p) => scale(p, Math.max(0.001, sheafOf(a)))) },
  ];
  for (let q = 0; q < 2; q++) {
    const sd = q ? 1 : -1, side: V3 = [sd, 0, 0];
    const m = <T extends Mesh>(x: T): Mesh => (q ? x : mirrored(x));
    pieces.push(
      { key: `wf${q}`, mesh: m(fore), bone: `wf${q}`, bias: 0.01, after: ['abd', 'waist'], front: [sd, 0, 0.4] },
      { key: `wh${q}`, mesh: m(hind), bone: `wh${q}`, bias: 0.005, after: ['abd', 'waist'], front: [sd, 0, 0.4] },
      { key: `rc${q}`, mesh: m(coxa), bone: `rc${q}`, bias: 0.03, after: 'pro', front: [sd, 0.6, 0], convex: true },
      { key: `rf${q}`, mesh: m(femur), bone: `rf${q}`, bias: 0.04, after: [`rc${q}`, 'pro'], front: [sd, 0.6, 0] },
      { key: `rt${q}`, mesh: m(tibia), bone: `rt${q}`, bias: 0.045, after: `rf${q}`, front: [sd, 0.6, 0] },
    );
    for (const leg of ['f', 'h']) {
      const key = `${leg}${q ? 'r' : 'l'}`;
      pieces.push(
        { key: `${key}0`, mesh: femurW, bone: `${key}0`, bias: 0.01, after: 'waist', front: side, thin: true },
        { key: `${key}1`, mesh: tibiaW, bone: `${key}1`, bias: 0.015, after: `${key}0`, front: side, thin: true },
      );
    }
  }
  return pieces;
}

/* ---- the pose ----------------------------------------------------------------------------- */

/** Everything its bones are turned by, this moment. */
interface Pose {
  /** The body moved from where it stands, and turned: degrees, nose up, roll to its right, yaw to its left. */
  x: number; y: number; z: number; pitch: number; roll: number; yaw: number;
  /** The prothorax reared further up, turned left, and leant to its right. */
  pro: [number, number, number];
  /** The head's nod (up positive), turn (left positive) and tilt (to its right). */
  head: [number, number, number];
  /** Each feeler swung back and out past how it is carried. */
  ant: [[number, number], [number, number]];
  /** The abdomen lifted and swung left. */
  abd: [number, number];
  /** The wings raised further, spread further, and their tips risen further: fore, then hind. */
  wf: [number, number, number];
  wh: [number, number, number];
  arms: [Arm, Arm];
  /** How far its feet are spread out from where they stand. */
  splay: number;
  /** How much of a sheaf it holds, and how far it is set down on the ground in front of it. */
  sheaf: number; set: number;
}

const copyArm = (a: Arm): Arm => ({ ...a });
const mixArm = (a: Arm, b: Arm, t: number): Arm => ({ c: lerp(a.c, b.c, t), f: lerp(a.f, b.f, t), t: lerp(a.t, b.t, t), out: lerp(a.out, b.out, t), roll: lerp(a.roll, b.roll, t) });

/**
 * Standing about: swaying a little from side to side as a leaf does, its head turned and now and then tipped right over to one
 * side as a mantis's is, its feelers waving slowly, and every so often a foreleg drawn up to its mouth to be cleaned.
 */
function standPose(s: Mantis, a: Anim): Pose {
  const t = a.t, still = 1 - smooth(a.go);
  const tip = beat(t, [3.2, 11.6, 19.4], 1.6), tipSide = Math.sin(t * 1.7) > 0 ? 1 : -1;
  const groom = beat(t, [7.4, 16.6], 2.2) * (1 - a.graze), gs = t > 12 ? 1 : 0;
  const sway = cyc(t, 6) * 0.7 + cyc(t, 11, 1) * 0.3;
  const p: Pose = {
    x: 0.03 * sway * still * (1 + 0.3 * s.stage), y: 0.01 * cyc(t, 4, 0.5) * still, z: 0, pitch: 0, roll: 3 * sway * still, yaw: 0,
    pro: [2 * cyc(t, 3, 1) * still, 0, -4 * sway * still],
    head: [3 * cyc(t, 5, 0.6) * still - 12 * groom, 16 * drift(t, 0.7) * still + (gs ? -14 : 14) * groom, 26 * tip * tipSide * still + 4 * sway * still],
    ant: [[10 * cyc(t, 7, 0.2) * still, 6 * cyc(t, 5, 1) * still], [10 * cyc(t, 7, 1.4) * still, 6 * cyc(t, 5, 2.2) * still]],
    abd: [2 * cyc(t, 4, 0.3) * still, 3 * sway * still],
    wf: [3 * cyc(t, 8, 0.4) * still, 0, 0], wh: [3 * cyc(t, 8, 1.2) * still, 0, 0],
    arms: [copyArm(s.rest), copyArm(s.rest)],
    splay: 0,
    sheaf: 0, set: 0,
  };
  // Cleaning a foreleg: drawn up in front of its mouth, the tibia folded tight, the head bowed over it.
  if (groom > 0) {
    const g = smooth(groom), arm = p.arms[gs];
    arm.c = lerp(arm.c, -20, g);
    arm.f = lerp(arm.f, 96 + 8 * Math.sin(t * 14), g);
    arm.t = lerp(arm.t, -150, g);
    arm.out = lerp(arm.out, -4, g);
  }
  return p;
}

/** Going: the body rocking forward and back over its feet, a little roll, the forelegs folded and bobbing, the head held steady. */
function goPose(s: Mantis, p: Pose, a: Anim): void {
  const g = smooth(a.go);
  if (g <= 0) return;
  const run = a.gait, w = frac(a.u) * TAU;
  p.y += g * s.gait.rock * (1 + run) * Math.sin(w * 2);
  p.z += g * (-0.015 - 0.02 * run) * Math.abs(Math.sin(w * 2)) * (1 + s.stage * 0.5);
  p.roll += g * 2.5 * Math.sin(w);
  p.pitch += g * (-2 * run + 1.2 * Math.sin(w * 2));
  p.head[0] += g * -1.2 * Math.sin(w * 2);
  p.pro[0] += g * (-4 * run);
  p.abd[0] += g * (1.5 * Math.sin(w * 2 + 1) + 4 * run);
  p.abd[1] += g * 3 * Math.sin(w);
  // The forelegs tucked tighter at a run, bobbing a little at each step.
  for (const arm of p.arms) {
    arm.f += g * (4 * Math.sin(w * 2 + 0.8) + 6 * run);
    arm.t += g * (-10 * run);
  }
  p.wf[0] += g * (2 * Math.sin(w * 2) + 6 * run);
  p.wh[0] += g * (2 * Math.sin(w * 2 + 1) + 8 * run);
  // A wing's flutter at a run, on the two with wings to speak of.
  if (s.stage > 0 && run > 0) {
    p.wf[0] += run * g * 8 * Math.sin(w * 6);
    p.wh[0] += run * g * 10 * Math.sin(w * 6 + 1.2);
  }
}

/**
 * The strike. The Sprigmant draws back, forelegs cocked high, and snaps them out and shut on what is in front of it; the Petalblade
 * the same, its four wings flared up wide as it rears; the Bloomreaper rears up with its blades raised over its head and brings
 * them down in a scything slash across in front of it.
 */
function strikePose(s: Mantis, p: Pose, t: number): void {
  const hit = MANTIS_HITS[s.stage], k = smooth(t / 0.1) * (1 - ramp(t, 0.82, 1));
  // How far drawn back (one), and lunged at the blow (minus one).
  const w = keysAt([[0, 0], [hit - 0.2, 1], [hit - 0.03, -1], [hit + 0.14, -0.8], [1, 0]], t);
  const back = Math.max(0, w), lunge = Math.max(0, -w);
  const big = 1 + 0.4 * s.stage;
  p.y += (-0.08 * back + 0.16 * lunge) * big;
  p.z += (0.03 * back - 0.04 * lunge) * big;
  p.pitch += 4 * back - 6 * lunge;
  p.pro[0] += 14 * back - 22 * lunge;
  p.head[0] += -6 * back + 12 * lunge;
  p.abd[0] += 6 * back - 4 * lunge;
  if (s.stage > 0) {
    // The wings flared: raised and spread wide as it draws back, held through the blow.
    const flare = ramp(t, 0.05, hit - 0.12) * (1 - ramp(t, 0.72, 0.96));
    p.wf[0] += 26 * flare;
    p.wf[1] += 26 * flare;
    p.wf[2] += 18 * flare;
    p.wh[0] += 20 * flare;
    p.wh[1] += 32 * flare;
    p.wh[2] += 22 * flare;
  }
  for (let q = 0; q < 2; q++) {
    // Cocked: the femur up high, the tibia open a little. The blow: shot forward, the tibia flung open and snapped shut.
    const snap = ramp(t, hit, hit + 0.06);
    let target: Arm;
    if (s.stage < 2) {
      const cock: Arm = { c: -20, f: 105, t: -95, out: 10, roll: 0 };
      const shot: Arm = { c: 6, f: 6, t: lerp(-30, -158, snap), out: 2, roll: 0 };
      target = mixArm(mixArm(s.rest, cock, back), shot, lunge);
    } else {
      // The slash: both blades raised high and back, then swept down and across, the left a beat behind the right.
      const lag = q ? 0 : 0.035;
      const raise = ramp(t, 0.06, 0.34), sw = ramp(t, hit - 0.1 + lag, hit + 0.04 + lag);
      const cock: Arm = { c: 40, f: 138, t: 70, out: 24, roll: 0 };
      const down: Arm = { c: lerp(40, -20, sw), f: lerp(138, -30, sw), t: lerp(70, -12, sw), out: lerp(24, -26, sw), roll: 0 };
      target = mixArm(sw > 0 ? down : mixArm(s.rest, cock, raise), s.rest, ramp(t, 0.68, 0.95));
    }
    p.arms[q] = mixArm(p.arms[q], target, k);
  }
}

/** How far through each part of a go at its task it is: crouched, each sweep, gathered, lifted, set down. */
interface Work { low: number; sheaf: number; lift: number; set: number }
const works = new WeakMap<Anim, Work>();
function workOf(a: Anim): Work {
  const had = works.get(a);
  if (had) return had;
  const t = a.act?.kind === 'work' ? a.act.t : 0, W = MANTIS_WORK;
  const w: Work = {
    low: ramp(t, 0, W.low) * (1 - ramp(t, W.lift - 0.04, W.lift + 0.06) * 0.6) * (1 - ramp(t, 0.96, 1) * 0.4),
    sheaf: ramp(t, W.gather, W.gather + 0.12) * (1 - ramp(t, W.set + 0.05, 0.995)),
    lift: ramp(t, W.gather + 0.1, W.lift) * (1 - ramp(t, W.set - 0.04, W.set + 0.04)),
    set: ramp(t, W.set - 0.04, W.set + 0.05),
  };
  works.set(a, w);
  return w;
}
/** How much of a sheaf it holds this moment. */
const sheafOf = (a: Anim): number => (a.act?.kind === 'work' ? workOf(a).sheaf : 0);

/**
 * A foreleg's sweep over the grass: how far from out at its own side (nought) across to past the middle (one) it has come, at `t`;
 * minus one while it is not sweeping. Right sweeps first and third, left second.
 */
function sweepOf(q: number, t: number): number {
  const C = MANTIS_WORK.cuts;
  for (let k = 0; k < C.length; k++) if ((k % 2 === 0) === (q === 1) && t >= C[k] - 0.04 && t <= C[k] + SWEEP + 0.03) return clamp((t - C[k]) / SWEEP);
  return -1;
}

/**
 * At its task: crouched low and reaching forward, each foreleg in turn drawn out to its own side and swept across the grass low in
 * front of it, tibia open so its blade skims the ground; then both drawn in together under it to gather the cut, folded round the
 * sheaf and lifted to its chest, and the sheaf set down on the heap in front of it.
 */
function workPose(s: Mantis, p: Pose, a: Anim): void {
  const t = a.act?.t ?? 0, w = workOf(a), W = MANTIS_WORK;
  const low = w.low;
  p.z -= s.high * 0.24 * low;
  p.pitch -= 8 * low;
  p.pro[0] -= 18 * low;
  p.head[0] -= 16 * low * (1 - w.lift);
  p.head[2] *= 1 - low;
  p.head[1] *= 1 - low;
  p.splay = 0.18 * low;
  p.x *= 1 - low;
  p.roll *= 1 - low;
  // Reaching low: the tibia let down only as far as brings its claw to the grass, whatever the stage's reach and crouch.
  const R = s.rap, D = Math.PI / 180, proUp = (s.pro.tilt + p.pro[0]) * D + p.pitch * D;
  const shoulder = s.high + p.z + s.waist[2] * 0.3 + s.pro.len * s.pro.shoulder * Math.sin(proUp) - s.pro.w * 0.3;
  const above = shoulder + R.coxa * Math.sin(-38 * D) + R.fe * Math.sin(-28 * D) - 0.06 - R.w;
  const reach: Arm = { c: -38, f: -28, t: -Math.asin(clamp(above / (R.ti * 1.08), 0.15, 1)) / D, out: 0, roll: 0 };
  const ready: Arm = { c: -30, f: 30, t: -120, out: 40, roll: 0 };
  const gather: Arm = { c: -42, f: -36, t: -118, out: 8, roll: 0 };
  const hold: Arm = { c: -64, f: 46, t: -126, out: 12, roll: 0 };
  for (let q = 0; q < 2; q++) {
    const sd = q ? 1 : -1, sw = sweepOf(q, t);
    let arm: Arm;
    if (t < W.gather) {
      if (sw >= 0) {
        // The sweep: out at its own side, low, and across past the middle, the body twisting into it.
        const u = smooth(sw);
        arm = { ...reach, out: lerp(62, -22, u), c: reach.c + 6 * Math.sin(Math.PI * u), t: reach.t - 8 * Math.sin(Math.PI * u) };
        p.yaw += -sd * 9 * Math.sin(Math.PI * u) * low;
        p.pro[1] += -sd * 10 * (u - 0.5) * low;
        p.head[1] += -sd * 8 * (u - 0.5) * low;
      } else {
        // Between its sweeps: drawn back up out of the way at its own side, ready.
        arm = ready;
      }
    } else {
      // Gathering: both reach down and in, fold round the cut, and lift the sheaf to the chest; set down at the end.
      const gth = ramp(t, W.gather - 0.03, W.gather + 0.08);
      arm = mixArm(mixArm(ready, gather, gth), hold, w.lift);
      arm = mixArm(arm, { c: -40, f: -20, t: -90, out: 10, roll: 0 }, w.set * (1 - ramp(t, 0.97, 1)));
    }
    // Into and out of the crouch from how it stands.
    p.arms[q] = mixArm(p.arms[q], arm, ramp(t, 0, 0.08) * (1 - ramp(t, 0.97, 1) * 0.5));
  }
  p.sheaf = w.sheaf;
  p.set = w.set;
}

/** Evolving: its forelegs raised up together, its wings opened wide as the light gathers, and settling. */
function evolvePose(s: Mantis, p: Pose, t: number): void {
  const up = ramp(t, 0.05, 0.42) * (1 - ramp(t, 0.6, 0.92)), open = ramp(t, 0.42, 0.52) * (1 - ramp(t, 0.66, 0.94));
  p.pro[0] += 10 * up;
  p.head[0] += 14 * up;
  p.z += 0.06 * up;
  for (const arm of p.arms) {
    arm.c = lerp(arm.c, 10, up);
    arm.f = lerp(arm.f, 110, up);
    arm.t = lerp(arm.t, -150, up);
  }
  p.wf[0] += 30 * open + 10 * up;
  p.wf[1] += 30 * open;
  p.wh[0] += 24 * open;
  p.wh[1] += 36 * open;
  void s;
}

function poseOf(s: Mantis, a: Anim): Pose {
  const p = standPose(s, a);
  goPose(s, p, a);
  const act = a.act;
  if (act?.kind === 'strike') strikePose(s, p, act.t);
  else if (act?.kind === 'work') workPose(s, p, a);
  else if (act?.kind === 'evolve') evolvePose(s, p, act.t);
  else if (a.graze > 0 && a.go < 1) {
    // Foraging with no go at it: crouched and reaching low, as it is between sweeps.
    workPose(s, p, { ...a, act: { kind: 'work', t: MANTIS_WORK.low + 0.02 } });
  }
  return p;
}

/* ---- the bones ------------------------------------------------------------------------------ */

/** Where a walking leg's hip is on the waist, on the right. */
const hipOf = (s: Mantis, L: Walker): V3 => [s.waist[0] * 0.75, L.hipY, -s.waist[2] * 0.35];

/**
 * Where a foot is on the ground: standing, out from its hip; going, swept back evenly under the body while it is down and lifted and
 * brought forward again while it is not, a middle foot and the hind one on the other side together, by turns with the other two.
 */
function footOf(s: Mantis, L: Walker, hind: boolean, sd: number, a: Anim, splay: number): V3 {
  const h = hipOf(s, L);
  const rest: V3 = [sd * (h[0] + L.at[0] * (1 + splay)), h[1] + L.at[1] * (1 + splay * 0.5), 0];
  if (a.go <= 0) return rest;
  const G = s.gait, run = a.gait, g = smooth(a.go);
  const duty = lerp(G.duty[0], G.duty[1], run), sweep = lerp(G.sweep[0], G.sweep[1], run), high = lerp(G.lift[0], G.lift[1], run);
  const set = ((hind ? 1 : 0) + (sd > 0 ? 1 : 0)) % 2;
  const ph = frac(a.u + set * 0.5 + (hind ? 0.06 : 0));
  let dy = 0, up = 0;
  if (ph < duty) dy = sweep * (0.5 - ph / duty);
  else {
    const u = (ph - duty) / (1 - duty);
    dy = sweep * (smooth(u) - 0.5);
    up = high * Math.sin(Math.PI * u);
  }
  return [rest[0], rest[1] + g * dy, g * up];
}

function mantisBones(s: Mantis): (a: Anim) => Bones {
  return (a) => {
    const p = poseOf(s, a);
    const body = joint(ROOT, [p.x, p.y, s.high + p.z], p.pitch, p.roll, p.yaw);
    const b: Bones = { body };
    const W = s.waist;
    b.abd = joint(body, [0, -W[1] * 0.7, W[2] * 0.15], s.abd.tilt + p.abd[0], 0, p.abd[1]);
    const proTilt = s.pro.tilt + p.pro[0];
    b.pro = joint(body, [0, W[1] * 0.65, W[2] * 0.3], proTilt, p.pro[2], p.pro[1]);
    // The head at the top of the prothorax, turned back level so it looks ahead whatever the rear, then nodded, tipped and turned.
    const level = joint(b.pro, [0, s.pro.len, 0], -proTilt, 0, 0);
    b.head = joint(level, [0, 0, 0], s.head.nod + p.head[0], p.head[2], p.head[1]);
    const E = eyeAt(s), R = s.head.r;
    for (let q = 0; q < 2; q++) {
      const sd = q ? 1 : -1;
      b[`eye${q}`] = joint(b.head, [sd * E[0], E[1], E[2]], 0, 0, 0);
      b[`ant${q}`] = joint(b.head, [sd * R[0] * 0.2, R[1] * 0.75, R[2] * 1.12], -p.ant[q][0], -sd * 4, sd * (8 + p.ant[q][1]));
      // The wings off the top of the waist, raised, spread and risen as they are held.
      const wr: V3 = [sd * W[0] * 0.35, -W[1] * 0.2, W[2] * 0.85];
      const F = s.fore, H = s.hindWing;
      // Spread out about the up of the body, then risen, then raised about its own length, so raising never swings its tip in.
      const wing = (at: V3, w: Wing, add3: [number, number, number]): Xf =>
        joint(joint(joint(body, at, 0, 0, sd * (w.spread + add3[1])), [0, 0, 0], -(w.rise + add3[2]), 0, 0), [0, 0, 0], 0, -sd * (w.lift + add3[0]), 0);
      b[`wf${q}`] = wing(wr, F, p.wf);
      b[`wh${q}`] = wing(add(wr, [0, -W[1] * 0.25, -0.02]), H, p.wh);
      // A foreleg: off the shoulder of the prothorax, each part turned against a level frame there, so a sweep is level.
      const arm = p.arms[q], Rp = s.rap;
      const shoulder = place(b.pro, [sd * s.pro.w * 1.1, s.pro.len * s.pro.shoulder, -s.pro.w * 0.3]);
      const at: Xf = { m: body.m, t: shoulder };
      b[`rc${q}`] = joint(at, [0, 0, 0], arm.c, sd * arm.roll, -sd * arm.out);
      b[`rf${q}`] = joint(b[`rc${q}`], [0, Rp.coxa, 0], arm.f - arm.c);
      b[`rt${q}`] = joint(b[`rf${q}`], [0, Rp.fe, 0], arm.t - arm.f);
      // The walking legs: each reaching from its hip to its foot, its knee high over it and out.
      for (const [L, hind] of [[s.mid, false], [s.hind, true]] as Array<[Walker, boolean]>) {
        const key = `${hind ? 'h' : 'f'}${q ? 'r' : 'l'}`;
        const hp = hipOf(s, L), hip = place(body, [sd * hp[0], hp[1], hp[2]]), foot = footOf(s, L, hind, sd, a, p.splay);
        const pole: V3 = [sd * 0.3, hind ? -0.3 : 0.3, 1];
        const kn = kneeOf(hip, foot, L.fe, L.ti, pole);
        const N = cross(sub(kn, hip), sub(foot, kn));
        const nn = len3(N) > 1e-6 ? N : ([1, 0, 0] as V3);
        const up0 = inPlane(hip, sub(kn, hip), nn), lo = inPlane(kn, sub(foot, kn), nn);
        // Each part stretched along its length to reach, as it is built a unit long.
        b[`${key}0`] = stretched(up0, len3(sub(kn, hip)));
        b[`${key}1`] = stretched(lo, len3(sub(foot, kn)));
        b[`${key}2`] = { m: lo.m, t: foot };
      }
    }
    // The sheaf between the claws of its forelegs, held level and across; set down on the ground in front of it at the end.
    if (a.act?.kind === 'work') {
      const t0 = place(b.rt0, [0, s.rap.ti * 0.9, 0]), t1 = place(b.rt1, [0, s.rap.ti * 0.9, 0]);
      const held = scale(add(t0, t1), 0.5);
      const ground: V3 = [held[0], held[1] + 0.05, 0.06 + 0.04 * s.stage];
      const at = add(scale(held, 1 - p.set), scale(ground, p.set));
      b.sheaf = joint({ m: body.m, t: at }, [0, 0, 0], 0, 0, 0);
    }
    const sk = 1 - 0.1 * clamp(-p.z / 0.3);
    b.shadow = { m: [sk, 0, 0, 0, sk, 0, 0, 0, 1], t: [body.t[0], body.t[1] - s.abd.len * 0.25, 0] };
    return b;
  };
}

/** A bone stretched `k` along its length (y). */
const stretched = (x: Xf, k: number): Xf => ({ m: [x.m[0], x.m[1] * k, x.m[2], x.m[3], x.m[4] * k, x.m[5], x.m[6], x.m[7] * k, x.m[8]], t: x.t });

/* ---- what it throws about --------------------------------------------------------------- */

const GRASS: RGB = [132, 182, 78];
const GRASS_LIGHT: RGB = [196, 224, 118];
const MOSS: RGB = [100, 140, 66];
const BLADE_INK: RGB = [58, 88, 44];
const SWISH: RGB = [255, 238, 244];

/** The tip of a foreleg's tibia, in the ground's frame, posed at a moment of its task standing: kept, as a go is the same each time. */
const tips = new Map<string, V3>();
function tipAt(s: Mantis, kind: Kind, q: number, t: number): V3 {
  const key = `${s.stage}|${q}|${t.toFixed(3)}`;
  let p = tips.get(key);
  if (!p) {
    const b = kind.bones({ t: 0, u: 0, go: 0, gait: 0, graze: 1, blink: false, breath: 0.5, fleece: 1, seed: 0, act: { kind: 'work', t } });
    p = place(b[`rt${q}`], [0, s.rap.ti * 1.02, 0]);
    tips.set(key, p);
  }
  return p;
}

/** Blades of grass, each a short line from a point along a way, `w` wide, inked dark under so they show on grass. */
function blades(g: CanvasRenderingContext2D, view: View, list: ReadonlyArray<{ p: V3; d: V3; c: RGB }>, w: number, px: number, al: number): void {
  if (!list.length || al <= 0.01) return;
  const ends = list.map((l) => [onScreen(view, l.p), onScreen(view, add(l.p, l.d))]);
  // Inked only drawn big enough for a line along it to be less than the blade itself.
  if (w > 1.6 * px) {
    g.strokeStyle = css(BLADE_INK, al * 0.7);
    g.lineWidth = w + px;
    g.beginPath();
    for (const [a, b] of ends) { g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
    g.stroke();
  }
  g.lineWidth = w;
  list.forEach((l, i) => {
    g.strokeStyle = css(l.c, al);
    g.beginPath();
    g.moveTo(ends[i][0][0], ends[i][0][1]);
    g.lineTo(ends[i][1][0], ends[i][1][1]);
    g.stroke();
  });
}

/**
 * At its task: the tufts of grass in front of it, standing until a blade's sweep passes them and stubble after; and the clippings
 * thrown from the blade's tip as it passes, up and out the way it sweeps, tumbling and falling as they go.
 */
function mowing(g: CanvasRenderingContext2D, view: View, s: Mantis, kind: Kind, b: Bones, t: number, front: boolean): void {
  const px = pxOf(g), big = 0.75 + 0.35 * s.stage, mid = b.body.t, C = MANTIS_WORK.cuts;
  g.lineCap = 'round';
  // The tufts: in an arc in front of it where the blades sweep, each cut as the sweep that reaches it passes, and a fresh patch
  // grown in under it as it turns to the next.
  const fresh = ramp(t, 0.9, 1);
  const tufts: Array<{ p: V3; d: V3; c: RGB }> = [];
  for (let i = 0; i < 9; i++) {
    const k = i % 3, cutAt = C[k] + SWEEP * (0.15 + 0.7 * jitter(i + 11));
    const tip = tipAt(s, kind, k === 1 ? 0 : 1, cutAt);
    const base: V3 = [tip[0] + (jitter(i + 5) - 0.5) * 0.16 * big, tip[1] + (jitter(i + 9) - 0.5) * 0.14 * big, 0];
    if (nearSide(base, mid, view) !== front) continue;
    const cut0 = t >= cutAt && t < 0.9;
    const tall = (cut0 ? 0.07 : 0.42) * big * (t >= 0.9 ? fresh : 1);
    if (tall < 0.02) continue;
    for (let q = 0; q < 4; q++) {
      const lean = (q - 1.5) * 0.3 + (jitter(i * 3 + q) - 0.5) * 0.3;
      tufts.push({ p: add(base, [lean * 0.04 * big, 0, 0]), d: [lean * tall * 0.45, (jitter(i + q) - 0.5) * 0.12 * tall, tall * (0.75 + 0.35 * jitter(i * 7 + q))], c: q % 2 ? GRASS_LIGHT : GRASS });
    }
  }
  blades(g, view, tufts, Math.max(px, 0.045 * big), px, 1);
  // The clippings: each thrown at a moment of a sweep from the tip of the blade, carried on and falling, for a third of a second.
  const life = 0.32 / ACT_SECS.work;
  for (let k = 0; k < C.length; k++) {
    const q = k === 1 ? 0 : 1, sd = q ? 1 : -1;
    for (let j = 0; j < 10; j++) {
      const te = C[k] + SWEEP * (0.1 + 0.8 * (j / 9));
      const age = (t - te) / life;
      if (age < 0 || age > 1) continue;
      const p0 = tipAt(s, kind, q, te), sec = age * 0.32;
      const v: V3 = [-sd * (1.0 + 1.6 * jitter(j + k * 7)) * big, (0.3 + 1.0 * jitter(j + 3)) * big, (1.6 + 1.4 * jitter(j + 13)) * big];
      const p: V3 = [p0[0] + v[0] * sec, p0[1] + v[1] * sec, Math.max(0.02, p0[2] + v[2] * sec - 0.5 * 9 * sec * sec)];
      if (nearSide(p, mid, view) !== front) continue;
      const spin = (jitter(j + 21) * 6 + age * 14) * (j % 2 ? 1 : -1), l = (0.1 + 0.07 * jitter(j + 4)) * big;
      blades(g, view, [{ p, d: [Math.cos(spin) * l, 0, Math.sin(spin) * l], c: j % 3 === 0 ? MOSS : j % 3 === 1 ? GRASS_LIGHT : GRASS }], Math.max(px, 0.04 * big), px, 1 - age * age);
    }
  }
}

/** The strike's swish: a pale arc along the way the blades' tips have come, just before the blow and fading after it. */
function swish(g: CanvasRenderingContext2D, view: View, s: Mantis, kind: Kind, a: Anim, t: number): void {
  const hit = MANTIS_HITS[s.stage], al = ramp(t, hit - 0.1, hit - 0.02) * (1 - ramp(t, hit + 0.02, hit + 0.16));
  if (al <= 0.01) return;
  const px = pxOf(g);
  g.lineCap = 'round';
  for (let q = 0; q < 2; q++) {
    const pts: Array<[number, number]> = [];
    for (let k = 0; k <= 9; k++) {
      const tt = Math.min(t, hit + 0.05) - 0.12 + (0.12 * k) / 9;
      const b = kind.bones({ ...a, act: { kind: 'strike', t: tt } });
      pts.push(onScreen(view, place(b[`rt${q}`], [0, s.rap.ti, 0])));
    }
    for (let k = 1; k < pts.length; k++) {
      g.strokeStyle = css(SWISH, al * (k / pts.length));
      g.lineWidth = Math.max(px, (0.05 + 0.03 * s.stage) * (k / pts.length) * 3);
      g.beginPath();
      g.moveTo(pts[k - 1][0], pts[k - 1][1]);
      g.lineTo(pts[k][0], pts[k][1]);
      g.stroke();
    }
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

function mantisKind(s: Mantis): Kind {
  const kind: Kind = {
    bones: mantisBones(s),
    build: (lod) => mantisBuild(s, lod),
    // The variant's coat is its body, legs and wings' green; its markings are the pink of its wings' panels, its blades' edges and
    // its eyes. Its feelers, its hindwings' blue feather and the grass it carries are the same on every variant.
    palette: (coat, mark) => {
      const body = mix(pastel(coat, 90), coat, 0.75), pink = mix(pastel(mark, 330), mark, 0.4);
      return coatPalette(coat, mark, {
        coat: body,
        coatDark: darker(body, 0.18),
        coatLight: mix(lighter(body, 0.22), [236, 236, 170], 0.25),
        belly: mix(mix(body, pink, 0.32), [206, 172, 120], 0.3),
        muzzle: lighter(body, 0.3),
        nose: [120, 52, 78],
        leaf: mix(body, [176, 210, 120], 0.25),
        leafDark: darker(mix(body, [96, 140, 72], 0.4), 0.15),
        petal: pink,
        membrane: lighter(pink, 0.42),
        bloom: mix(pink, [246, 120, 168], 0.45),
        cap: mix(pink, [196, 52, 112], 0.6),
        glint: [255, 255, 255],
        feather: [176, 204, 238],
        horn: [206, 196, 128],
        claw: darker(pink, 0.15),
        stem: [156, 196, 92],
        moss: [112, 150, 74],
        lid: darker(body, 0.4),
      }, 90);
    },
    shadow: [s.abd.len * 0.55 + s.waist[1] + s.mid.at[1] * 0.5, s.waist[0] + s.hind.at[0] * 0.8],
    stride: 1.4,
    size: s.size,
    blinks: 0,
    acts: ['strike', 'work'],
    // Evolving, the motes rising round it are blush pink and leaf green.
    motes: [[246, 168, 190], [176, 212, 120]],
    extra: (g, view, b, a, under) => {
      const act = a.act;
      if (act?.kind === 'work') mowing(g, view, s, kind, b, act.t, !under);
      else if (act?.kind === 'strike' && !under) swish(g, view, s, kind, a, act.t);
    },
  };
  return kind;
}

export const SPRIGMANT = mantisKind(SPRIGMANT_LOOK);
export const PETALBLADE = mantisKind(PETALBLADE_LOOK);
export const BLOOMREAPER = mantisKind(BLOOMREAPER_LOOK);
