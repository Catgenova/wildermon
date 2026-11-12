import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, DEG, disc, dot, drift, frac, lerp, merge, mirrored, mix, onEgg, orb, orbAlong,
  paint, quadBonesOf, scale, smile, smooth, step, sub, TAU, taper, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
  type QuadPose, type QuadSpec,
} from './beasts';
import { blade, css, cut, hump, jitter, mixV, nearSide, ramp } from './beastkit';
import { joint, mesh, onScreen, place, type Face, type Mat, type Mesh, type RGB, type V3, type View } from './figure';
import { clumpOf } from './wild-moss';

/**
 * The spiral line: the Spiralcalf, a small woolly elephant calf, its hide grey-lavender under a thick cream shaggy coat over
 * its shoulders, back and legs (cream tufts at its knees and feet), a moss tuft and small brown spikes on its crown, big round
 * ears grey outside and dusky pink in, amber eyes, a short trunk curled into a tight spiral, a cream spiral on its haunch, and
 * short stout legs with cream toenails; which grows into the Spiraltrunk, a bigger young mammoth with short ivory tusks and a
 * long trunk curled into a big spiral, the spiral and the trunk's underside ribbed in light carved wood, in armour of carved
 * wood -- a crested headpiece with brown spikes, plates on its shoulders, bracers trimmed in gold-green on all four legs --
 * moss and fern along its back; and then the Spiralphant, a huge armoured mammoth with two cut logs strapped across its back
 * under moss and ferns, a great carved-wood helm with spikes over its head, long curved tusks and a second smaller pair, a
 * massive wood-ringed trunk in a spiral, and heavy carved-wood plates with swirls on its shoulders, flanks and legs. The
 * species is still `awla` underneath, as saves and the database know it: it carves logs into shafts.
 *
 * All three are built by one set of functions from a description of the stage (`Spiral`), on the four-legged body
 * (`quadBonesOf`): columns of legs, the lateral four-beat of an elephant's walk at every pace -- hind then fore on one side,
 * then the other -- the body rolling over each foot as it comes down, the head nodding and the trunk swinging with the step.
 * The trunk is a chain of links in the plane of the head, each bent against the last (`trunkPts`): at rest each bends more
 * than the one before, so it curls down, back and up into a spiral; at its task the last links wrap a log.
 *
 * At its task it carves a log it holds in the coil of its trunk, across its chest (`SPIRAL_WORK`): the log turned in the coil,
 * then twice a jerk of the head and the trunk, a shaft split off the log's end and dropped onto the pile on the ground before
 * it, shavings curling off the log; the Spiralphant drives the log up onto its tusks for each split.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** One pair of legs: the right one's root on the body, its upper, its lower and its foot's drop to the sole; how thick each is. */
interface Leg { at: V3; len: [number, number, number]; w: [number, number, number] }

/**
 * The trunk: its root on the face (head frame) and the way it leaves it (degrees, from forward, up positive); its links, how
 * long the first is and each after it against the one before; how thick at its root and its tip; how far it bends, all told,
 * curled at rest (degrees); and how round the coil it holds a log in is.
 */
interface Trunk { root: V3; phi: number; segs: number; len: number; ratio: number; w: [number, number]; curl: number; hook: number }

/** A tusk, the right one, in the head's frame: its root, a bend, its tip; how thick at the root. */
interface Tusk { root: V3; mid: V3; tip: V3; r: number }

interface Spiral {
  stage: 0 | 1 | 2;
  /**
   * The barrel's rings, rump to chest: where each is along it and up, how wide and how deep (halves); and how high its back
   * is domed over its shoulders, as a share of its depth (its rump slopes down to its tail by a set share).
   */
  body: { y: number[]; z: number[]; w: number[]; h: number[]; hump: number };
  fore: Leg;
  hind: Leg;
  neck: { at: V3; len: number; lean: number; w: number };
  /** The dome of the skull, and the lower face the trunk comes out of, in the head's frame. */
  skull: { c: V3; r: V3 };
  face: { c: V3; r: V3 };
  /** The way out of the skull to the right eye, and how big. */
  eye: { dir: V3; size: number };
  /** The ear: the way out of the skull to its root, how long down and how wide back, how far it is spread out (degrees). */
  ear: { dir: V3; len: number; w: number; out: number };
  trunk: Trunk;
  tusks: Tusk[];
  /** The calf's shaggy cream coat. */
  coat: boolean;
  /** Its crown: a moss tuft and spikes (0), a crested headpiece (1), a great helm (2). */
  crown: 0 | 1 | 2;
  /** Its armour: none (0), shoulder plates and bracers (1), heavy plates on shoulders, flanks and legs (2). */
  armour: 0 | 1 | 2;
  /** The moss along its back: along it from and to (nought the rump, one the withers), how wide (radians each side of the top), how deep, how many rows; ferns hanging off its sides. */
  moss: { from: number; to: number; wide: number; deep: number; rows: number; ferns: number };
  /** Two logs strapped on its back: how thick and how long. */
  logs: { r: number; len: number } | null;
  /** The cream spiral on its haunch: along, round from the side (radians), how big. */
  mark: { y: number; th: number; r: number };
  tail: { links: number; len: number; w: number; tuft: number };
  gait: { swing: [number, number]; duty: [number, number]; roll: number };
  /** The log it carves: how thick and how long. */
  log: { r: number; len: number };
  size: number;
}

/** A Spiralcalf: small and round under a shaggy cream coat, a big head with big ears, a short trunk in a tight spiral, short stout legs. */
const SPIRALCALF_LOOK: Spiral = {
  stage: 0,
  body: { y: [-0.38, -0.25, -0.12, 0, 0.14, 0.26, 0.39], z: [0.03, 0.04, 0.05, 0.06, 0.07, 0.07, 0.07], w: [0.06, 0.34, 0.37, 0.38, 0.37, 0.33, 0.1], h: [0.06, 0.3, 0.32, 0.32, 0.33, 0.3, 0.12], hump: 0.08 },
  fore: { at: [0.18, 0.21, -0.1], len: [0.14, 0.13, 0.07], w: [0.15, 0.13, 0.145] },
  hind: { at: [0.17, -0.2, -0.08], len: [0.15, 0.13, 0.07], w: [0.155, 0.13, 0.145] },
  neck: { at: [0, 0.32, 0.03], len: 0.12, lean: 70, w: 0.26 },
  skull: { c: [0, 0.04, 0.08], r: [0.27, 0.27, 0.28] },
  face: { c: [0, 0.2, -0.06], r: [0.17, 0.18, 0.17] },
  eye: { dir: [0.56, 0.78, 0.2], size: 0.05 },
  ear: { dir: [0.86, -0.22, 0.34], len: 0.46, w: 0.4, out: 34 },
  trunk: { root: [0, 0.34, -0.06], phi: 18, segs: 10, len: 0.13, ratio: 0.87, w: [0.12, 0.035], curl: 480, hook: 0.1 },
  tusks: [],
  coat: true,
  crown: 0,
  armour: 0,
  moss: { from: 0.42, to: 0.95, wide: 0.3, deep: 0.07, rows: 6, ferns: 0 },
  logs: null,
  mark: { y: -0.17, th: 0.02, r: 0.14 },
  tail: { links: 3, len: 0.08, w: 0.03, tuft: 0.06 },
  gait: { swing: [16, 22], duty: [0.7, 0.58], roll: 3 },
  log: { r: 0.055, len: 0.5 },
  size: 7,
};

/** A Spiraltrunk: a bigger young mammoth, short tusks, a long trunk in a big spiral, a crested headpiece, bracers, moss and fern on its back. */
const SPIRALTRUNK_LOOK: Spiral = {
  stage: 1,
  body: { y: [-0.76, -0.5, -0.28, 0, 0.3, 0.52, 0.72], z: [0.02, 0.05, 0.08, 0.1, 0.13, 0.14, 0.14], w: [0.08, 0.48, 0.53, 0.55, 0.54, 0.48, 0.14], h: [0.08, 0.45, 0.49, 0.5, 0.52, 0.49, 0.18], hump: 0.16 },
  fore: { at: [0.25, 0.4, -0.2], len: [0.27, 0.24, 0.09], w: [0.23, 0.21, 0.22] },
  hind: { at: [0.25, -0.38, -0.18], len: [0.28, 0.24, 0.09], w: [0.24, 0.21, 0.22] },
  neck: { at: [0, 0.6, 0.08], len: 0.16, lean: 72, w: 0.36 },
  skull: { c: [0, 0.04, 0.1], r: [0.3, 0.3, 0.31] },
  face: { c: [0, 0.22, -0.08], r: [0.2, 0.2, 0.2] },
  eye: { dir: [0.6, 0.74, 0.22], size: 0.05 },
  ear: { dir: [0.88, -0.24, 0.3], len: 0.66, w: 0.54, out: 36 },
  trunk: { root: [0, 0.38, -0.16], phi: 0, segs: 12, len: 0.26, ratio: 0.9, w: [0.165, 0.05], curl: 440, hook: 0.13 },
  tusks: [{ root: [0.13, 0.32, -0.2], mid: [0.2, 0.62, -0.44], tip: [0.15, 0.82, -0.22], r: 0.05 }],
  coat: false,
  crown: 1,
  armour: 1,
  moss: { from: 0.1, to: 1.0, wide: 0.85, deep: 0.1, rows: 6, ferns: 5 },
  logs: null,
  mark: { y: -0.4, th: 0.1, r: 0.2 },
  tail: { links: 3, len: 0.12, w: 0.04, tuft: 0.08 },
  gait: { swing: [15, 21], duty: [0.72, 0.6], roll: 3.5 },
  log: { r: 0.075, len: 0.75 },
  size: 7,
};

/** A Spiralphant: huge, logs strapped on its back under moss, a great helm, long tusks and a second pair, heavy plates. */
const SPIRALPHANT_LOOK: Spiral = {
  stage: 2,
  body: { y: [-1.12, -0.78, -0.42, 0, 0.46, 0.78, 1.08], z: [0.06, 0.1, 0.15, 0.2, 0.26, 0.28, 0.28], w: [0.1, 0.74, 0.82, 0.85, 0.85, 0.76, 0.2], h: [0.1, 0.68, 0.74, 0.76, 0.8, 0.74, 0.26], hump: 0.16 },
  fore: { at: [0.4, 0.6, -0.3], len: [0.42, 0.36, 0.13], w: [0.47, 0.43, 0.45] },
  hind: { at: [0.38, -0.56, -0.28], len: [0.43, 0.36, 0.13], w: [0.48, 0.43, 0.45] },
  neck: { at: [0, 0.95, 0.2], len: 0.2, lean: 72, w: 0.5 },
  skull: { c: [0, 0.04, 0.16], r: [0.52, 0.52, 0.54] },
  face: { c: [0, 0.34, -0.12], r: [0.31, 0.31, 0.31] },
  eye: { dir: [0.62, 0.72, 0.24], size: 0.06 },
  ear: { dir: [0.88, -0.22, 0.3], len: 1.05, w: 0.86, out: 38 },
  trunk: { root: [0, 0.6, -0.26], phi: 12, segs: 14, len: 0.36, ratio: 0.9, w: [0.28, 0.08], curl: 420, hook: 0.17 },
  tusks: [
    { root: [0.24, 0.44, -0.3], mid: [0.56, 1.0, -0.95], tip: [0.52, 1.45, -0.42], r: 0.085 },
    { root: [0.28, 0.34, -0.36], mid: [0.5, 0.62, -0.8], tip: [0.52, 0.8, -1.02], r: 0.05 },
  ],
  coat: false,
  crown: 2,
  armour: 2,
  moss: { from: 0.05, to: 1.0, wide: 1.0, deep: 0.13, rows: 7, ferns: 6 },
  logs: { r: 0.3, len: 1.3 },
  mark: { y: -0.6, th: 0.1, r: 0.26 },
  tail: { links: 4, len: 0.15, w: 0.055, tuft: 0.11 },
  gait: { swing: [14, 19], duty: [0.74, 0.62], roll: 4 },
  log: { r: 0.1, len: 1.0 },
  size: 7,
};

/* ---- helpers ------------------------------------------------------------------------- */


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
function facing(pts: V3[], n: V3, m: Mat): Disc {
  let nx = 0, ny = 0, nz = 0;
  for (let c = 0; c < pts.length; c++) {
    const p = pts[c], r = pts[(c + 1) % pts.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nx * n[0] + ny * n[1] + nz * n[2] < 0 ? [...pts].reverse() : pts, m };
}
/** A thin painted strip from `a` to `b` on a surface facing `n`. */
function strip(a: V3, b: V3, n: V3, w: number, m: Mat): Disc {
  const d = unit(sub(b, a)), side = scale(unit(cross(n, d)), w);
  return facing([add(a, side), add(b, side), sub(b, side), sub(a, side)], n, m);
}
/** A grid of corners, rows by columns, as a surface of quads, each wound to face out along `out(row, col)`. */
function sheet(pts: V3[][], mat: (r: number, c: number) => Mat, out: (r: number, c: number) => V3): Mesh {
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  const R = pts.length, C = pts[0].length;
  for (const row of pts) v.push(...row);
  for (let r = 0; r < R - 1; r++) {
    for (let c = 0; c < C - 1; c++) {
      f.push({ i: [r * C + c, r * C + c + 1, (r + 1) * C + c + 1, (r + 1) * C + c], m: mat(r, c) });
      want.push(out(r, c));
    }
  }
  return mesh(v, wound(v, f, want));
}

/* ---- the body's surface -------------------------------------------------------------- */

/**
 * The barrel at `y` along it: its middle's height, its half-width and half-depth; between its rings eased, and over its first
 * and its last span rounded off as a dome, so its rump and its chest are round and not cut square.
 */
function ringAt(s: Spiral, y: number): { z: number; w: number; h: number } {
  const B = s.body, Y = B.y, n = Y.length - 1;
  if (y <= Y[0]) return { z: B.z[0], w: B.w[0], h: B.h[0] };
  for (let q = 1; q <= n; q++) {
    if (y <= Y[q]) {
      const k = (y - Y[q - 1]) / (Y[q] - Y[q - 1]);
      const e = q === 1 ? Math.sqrt(1 - (1 - k) ** 2) : q === n ? 1 - Math.sqrt(Math.max(0, 1 - k * k)) : smooth(k);
      return { z: lerp(B.z[q - 1], B.z[q], k), w: lerp(B.w[q - 1], B.w[q], e), h: lerp(B.h[q - 1], B.h[q], e) };
    }
  }
  return { z: B.z[n], w: B.w[n], h: B.h[n] };
}
/**
 * A point on the barrel at `y` along it and `th` round it (nought at the right waist, a quarter turn the top): its top domed up
 * over its shoulders and let down over its rump, its lower half a little wider than its upper, as an elephant's belly is.
 */
function surf(s: Spiral, y: number, th: number): V3 {
  const R = ringAt(s, y), B = s.body, n = B.y.length - 2;
  const u = clamp((y - B.y[1]) / (B.y[n] - B.y[1]));
  const sn = Math.sin(th);
  const up = sn > 0 ? 1 + B.hump * Math.exp(-(((u - 0.8) / 0.26) ** 2)) - 0.12 * smooth(1 - u / 0.4) : 1;
  return [R.w * Math.cos(th) * (1 + 0.1 * Math.max(0, -sn)), y, R.z + R.h * sn * up];
}
/** A point on the barrel and the way out of it there, `out` off it. */
function onBody(s: Spiral, y: number, th: number, out = 0): { p: V3; n: V3 } {
  const e = 0.004, p = surf(s, y, th);
  const dy = sub(surf(s, y + e, th), surf(s, y - e, th)), dth = sub(surf(s, y, th + e), surf(s, y, th - e));
  let n = unit(cross(dth, dy));
  if (dot(n, [Math.cos(th), 0, Math.sin(th)]) < 0) n = scale(n, -1);
  return { p: add(p, scale(n, out)), n };
}
/** Along the barrel, nought its rump to one its chest. */
const alongBody = (s: Spiral, u: number): number => lerp(s.body.y[1], s.body.y[s.body.y.length - 2], u);

/* ---- the trunk ------------------------------------------------------------------------ */

/** How the trunk is held this moment: each link's bend (degrees, curling down positive), how far up the root is lifted, swung aside, and how far its coil drifts to the side. */
interface TrunkPose { bends: number[]; lift: number; sway: number; side: number }

/** Its links' lengths. */
const linksOf = (T: Trunk): number[] => Array.from({ length: T.segs }, (_, i) => T.len * T.ratio ** i);
/** At rest, curled: each link bent more than the last, so it curls down, back and up into a spiral that tightens to its tip. */
function restBends(T: Trunk): number[] {
  const w = Array.from({ length: T.segs }, (_, i) => (i + 4) ** 0.3);
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => (T.curl * x) / sum);
}
/** How many links at its tip wrap a log, and how far each of those bends to go round it (`hook`). */
function hookOf(T: Trunk): { from: number; bends: number[] } {
  const L = linksOf(T), R = T.hook;
  let arc = 0, from = T.segs;
  // Round the log five sixths of a turn.
  while (from > 2 && arc < R * TAU * 0.86) arc += L[--from];
  return { from, bends: L.map((l, i) => (i >= from ? (l / R) / DEG : 0)) };
}
/** Holding a log: curled as it is at rest, forward, down, back and up, and its tip wrapped round the log in the middle of the coil. */
function gripBends(T: Trunk): number[] {
  const H = hookOf(T), rest = restBends(T);
  return H.bends.map((b, i) => (i >= H.from ? b : rest[i] * 0.92));
}
/** Its links' corners, in the head's frame, from the root out, for a pose; and where the coil's middle is. */
function trunkPts(T: Trunk, p: TrunkPose): { pts: V3[]; dirs: number[] } {
  const L = linksOf(T);
  const pts: V3[] = [T.root];
  const dirs: number[] = [];
  let phi = (T.phi + p.lift) * DEG, arc = 0;
  const total = L.reduce((a, b) => a + b, 0);
  const cs = Math.cos(p.sway * DEG), sn = Math.sin(p.sway * DEG);
  for (let i = 0; i < T.segs; i++) {
    phi -= p.bends[i] * DEG * (i === 0 ? 0.5 : 1);
    dirs.push(phi);
    const last = pts[pts.length - 1];
    arc += L[i];
    const k = arc / total;
    // In the head's plane, drifting a little to the side toward its tip, so its coil is round from the front quarter as well.
    const ny = L[i] * Math.cos(phi), nz = L[i] * Math.sin(phi), dx = p.side * L[i] * k * 1.4;
    const rel: V3 = [last[0] - T.root[0] + dx, last[1] - T.root[1] + ny, last[2] - T.root[2] + nz];
    pts.push([T.root[0] + rel[0], T.root[1] + rel[1], T.root[2] + rel[2]]);
  }
  // Swung aside about its root.
  return {
    pts: pts.map((q) => {
      const x = q[0] - T.root[0], y = q[1] - T.root[1];
      return [T.root[0] + x * cs - y * sn, T.root[1] + x * sn + y * cs, q[2]] as V3;
    }),
    dirs,
  };
}
/** Where the log it holds is, in the head's frame: the middle of the circle its tip links go round. */
function hookCentre(T: Trunk, p: TrunkPose): V3 {
  const H = hookOf(T), { pts, dirs } = trunkPts(T, p);
  const j = H.from, a = pts[j], phi = dirs[j] ?? dirs[dirs.length - 1];
  // The coil's middle is to the right of the way it goes (it turns clockwise, seen from its right side).
  const c: V3 = [a[0], a[1] + T.hook * Math.sin(phi), a[2] - T.hook * Math.cos(phi)];
  const cs = Math.cos(p.sway * DEG), sn = Math.sin(p.sway * DEG);
  const x = c[0] - T.root[0], y = c[1] - T.root[1];
  return [T.root[0] + x * cs - y * sn, T.root[1] + x * sn + y * cs, c[2]];
}

/** Rings along the trunk: how many to a link. */
const RINGS = 4;
/** The trunk's line, its links' corners smoothed into rings, and how thick at each: ridged where one ring of it meets the next. */
function trunkLine(T: Trunk, pts: readonly V3[]): { line: V3[]; w: number[] } {
  const line: V3[] = [], w: number[] = [];
  const N = pts.length - 1;
  for (let i = 0; i < N; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[i + 1], d = pts[Math.min(N, i + 2)];
    for (let q = 0; q < RINGS; q++) {
      const t = q / RINGS, t2 = t * t, t3 = t2 * t;
      // Catmull-Rom through the corners.
      const P: V3 = [0, 1, 2].map((k) => 0.5 * (2 * b[k] + (-a[k] + c[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t2 + (-a[k] + 3 * b[k] - 3 * c[k] + d[k]) * t3)) as V3;
      line.push(P);
    }
  }
  line.push(pts[N]);
  const M = line.length - 1;
  for (let k = 0; k <= M; k++) {
    const u = k / M;
    const base = lerp(T.w[0], T.w[1], u ** 0.85);
    // A ridge at every ring, the tip rounded off.
    const rib = k % RINGS === 0 ? 1.08 : 0.97;
    w.push(k === M ? base * 0.55 : base * rib);
  }
  return { line, w };
}
/** The trunk as a tube: grey over its top, its underside (the inside of its coil) ribbed in light wood on the bigger two, a lighter grey on the calf. */
function trunkMesh(s: Spiral, pts: readonly V3[], n: number): Mesh {
  const { line, w } = trunkLine(s.trunk, pts);
  const inner: Mat = s.stage ? 'wood' : 'coatLight', innerDark: Mat = s.stage ? 'woodDark' : 'coat', outerDark: Mat = 'coatDark';
  return tube(line, w, w, n, (k, j) => {
    const t = ((j + 0.5) / n) * TAU, under = Math.sin(t) < (s.stage ? 0.2 : -0.18);
    const crease = k % RINGS === RINGS - 1;
    if (under) return crease ? innerDark : inner;
    return crease && s.stage > 0 ? outerDark : 'coat';
  });
}

/* ---- its moves, in time --------------------------------------------------------------- */

/** When each stage's strike lands, as a share of it. */
export const SPIRAL_HITS: readonly number[] = [0.5, 0.52, 0.55];
/**
 * A go at its task, as shares of it: the log turned in the coil of its trunk (`turn`), then two splits (`splits`), each a jerk
 * of the head and the trunk with a shaft off the log's end, which falls onto the pile by `land` after it; shavings curl off the
 * log at each split. It loops, so a go and the next are one.
 */
export const SPIRAL_WORK = { turn: [0.04, 0.24] as const, splits: [0.36, 0.66] as const, land: 0.2 } as const;
/** When it lifts its trunk and flaps its ears, standing about, in seconds into its loop. */
export const SPIRAL_LOOKS: readonly number[] = [5.6, 17.2];

/** How far into its task it is: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.06) * (1 - ramp(t, 0.94, 1)));

/** Its whole pose this moment, beyond what the four-legged body has: the trunk, the ears, the log. */
interface Own { trunk: TrunkPose; ears: [number, number]; earTilt: number; work: number; press: number; spin: number }

/** The trunk at rest, breathing its coil a little tighter and looser, swinging, and now and then lifted. */
function ownOf(s: Spiral, a: Anim): Own {
  const T = s.trunk, t = a.t, still = 1 - smooth(a.go);
  const rest = restBends(T);
  const lift = beat(t, SPIRAL_LOOKS as number[], 2.2) * still;
  const breathe = 1 + 0.05 * cyc(t, 4) * still - 0.22 * lift;
  const w = frac(a.u), g = smooth(a.go);
  const tp: TrunkPose = {
    bends: rest.map((b) => b * breathe),
    lift: 24 * lift + 3 * cyc(t, 3) * still + g * 3 * Math.sin(TAU * 2 * w),
    sway: 5 * drift(t, 0.7) * still + g * 7 * Math.sin(TAU * w),
    side: 0.12,
  };
  // Ears: a slow flap now and then standing, and with every step going.
  const flap = beat(t, [2.4, 9.8, 14.2, 21.0], 0.9) * still + 0.35 * lift;
  const ears: [number, number] = [14 * flap + g * 7 * Math.max(0, Math.sin(TAU * w)), 14 * beat(t, [3.0, 9.9, 14.4, 21.6], 0.9) * still + 0.35 * lift * 14 + g * 7 * Math.max(0, -Math.sin(TAU * w))];
  return { trunk: tp, ears, earTilt: 0, work: 0, press: 0, spin: 0 };
}

/**
 * At its task: the coil opened round the log and holding it across its chest; turning it (`turn`), then at each split a jerk of
 * the head down and the coil drawn tight, the Spiralphant's lifted up onto its tusks.
 */
function workOwn(s: Spiral, o: Own, p: QuadPose, t: number, graze: number): void {
  const d = downOf(t, graze), W = SPIRAL_WORK;
  const grip = gripBends(s.trunk);
  o.work = d;
  o.trunk.bends = o.trunk.bends.map((b, i) => lerp(b, grip[i], d));
  o.trunk.sway *= 1 - d;
  o.trunk.side *= 1 - d;
  const turn = ramp(t, W.turn[0], W.turn[1]);
  const split = W.splits.reduce((k, c) => k + hump(t, c, 0.07), 0);
  const gather = W.splits.reduce((k, c) => k + hump(t, c - 0.08, 0.06), 0);
  o.press = d * split;
  o.spin = d * (turn * 50 + W.splits.reduce((k, c) => k + ramp(t, c - 0.04, c + 0.04) * 30, 0));
  // The log brought up before its chest, and for each split drawn up (onto the tusks, on the Spiralphant) and jerked.
  o.trunk.lift += d * ((s.stage === 2 ? 4 : 8) - 6 * gather + (s.stage === 2 ? 30 : 12) * split);
  p.head[0] += d * (-6 + 6 * gather - (s.stage === 2 ? 12 : 9) * split);
  p.neck[0] += d * (4 + 4 * split);
  p.pitch += d * (-1.5 * split);
  p.head[1] *= 1 - d;
  p.neck[1] *= 1 - d;
  o.ears = [o.ears[0] * (1 - d) + d * 8 * split, o.ears[1] * (1 - d) + d * 8 * split];
}

/** A strike: rearing a little, the trunk raised, then the head swung down and forward, tusks first, the trunk lashing down. */
function strikeOwn(s: Spiral, o: Own, p: QuadPose, t: number): void {
  const hit = SPIRAL_HITS[s.stage];
  const gather = ramp(t, 0.02, 0.36) * (1 - ramp(t, 0.36, hit));
  const thrust = ramp(t, 0.36, hit) * (1 - ramp(t, hit + 0.12, 0.98));
  p.pitch += 6 * gather - 3 * thrust;
  p.head[0] += 18 * gather - 22 * thrust;
  p.neck[0] += -6 * gather + 8 * thrust;
  o.trunk.lift += 60 * gather - 30 * thrust;
  o.trunk.bends = o.trunk.bends.map((b) => b * (1 - 0.7 * gather));
  o.ears = [o.ears[0] + 26 * gather, o.ears[1] + 26 * gather];
}

/** Evolving: crouched under the burst, then up on its hind legs at the turn, trunk raised straight up to trumpet, and down. */
function evolveOwn(s: Spiral, o: Own, p: QuadPose, t: number): void {
  const crouch = ramp(t, 0, 0.1) * (1 - ramp(t, 0.14, 0.3)), up = ramp(t, 0.18, 0.44) * (1 - ramp(t, 0.66, 0.9));
  p.lift += -0.03 * crouch;
  p.pitch += 14 * up;
  p.legs[0][0] += 22 * up;
  p.legs[1][0] += 22 * up;
  p.legs[0][1] += 0.5 * up;
  p.legs[1][1] += 0.5 * up;
  p.head[0] += -8 * crouch + 16 * up;
  o.trunk.lift += 95 * up;
  o.trunk.bends = o.trunk.bends.map((b, i) => lerp(b, i > s.trunk.segs - 4 ? -20 : -4, up));
  o.ears = [o.ears[0] + 34 * up, o.ears[1] + 34 * up];
}

/* ---- its bones ---------------------------------------------------------------------- */

/** The lateral four-beat of an elephant's walk, at every pace: left hind, left fore, right hind, right fore. */
const AMBLE = [0.25, 0.75, 0, 0.5];

function specOf(s: Spiral): QuadSpec {
  const leg = (L: Leg): QuadSpec['fore'] => ({ at: L.at, len: L.len, rest: [0, 0, 0], fold: [30, 50], toe: [L.w[2] * 0.9, L.w[2] * 0.8] });
  return {
    high: s.fore.len[0] + s.fore.len[1] + s.fore.len[2] - s.fore.at[2],
    fore: leg(s.fore),
    hind: leg(s.hind),
    neck: { at: s.neck.at, len: s.neck.len, lean: s.neck.lean },
    head: { pitch: 0 },
    tail: { at: [0, s.body.y[1] + 0.02, s.body.z[1] + s.body.h[1] * 0.45], links: s.tail.links, len: s.tail.len, lift: -62, curl: 6, sway: 10 },
    swing: s.gait.swing,
    duty: s.gait.duty,
    rock: 1.5,
  };
}

/** The four-legged pose with its own laid over it: the amble, a heavy roll and nod, and its acts. */
function poseOwn(s: Spiral, p: QuadPose, a: Anim, o: Own): void {
  const g = smooth(a.go);
  if (g > 0) {
    const G = s.gait, duty = lerp(G.duty[0], G.duty[1], a.gait), amp = lerp(G.swing[0], G.swing[1], a.gait), w = frac(a.u);
    p.legs = AMBLE.map((at) => step(a.u + at, duty, amp).map((x) => x * g) as [number, number, number]);
    // Rolled over the side whose feet are down, nodding twice a stride, the body let down a little onto each foot.
    p.roll = lerp(p.roll, G.roll * Math.sin(TAU * w + 0.6), g);
    p.pitch = lerp(p.pitch, 0.8 * Math.sin(TAU * 2 * w), g);
    p.head = [lerp(p.head[0], -2 + 3 * Math.sin(TAU * 2 * w + 0.8), g), lerp(p.head[1], 2 * Math.sin(TAU * w), g), lerp(p.head[2], -2 * Math.sin(TAU * w), g)];
    p.neck = [lerp(p.neck[0], 2 * Math.sin(TAU * 2 * w + 0.4), g), lerp(p.neck[1], 0, g)];
    p.lift -= g * 0.012 * (s.stage + 1) * (0.5 + 0.5 * Math.cos(TAU * 2 * w));
  }
  const act = a.act;
  if (act?.kind === 'work') workOwn(s, o, p, act.t, a.graze);
  else if (act?.kind === 'strike') strikeOwn(s, o, p, act.t);
  else if (act?.kind === 'evolve') evolveOwn(s, o, p, act.t);
  else if (a.graze > 0 && a.go < 1) workOwn(s, o, p, 0.02, a.graze * (1 - a.go));
}

/** The trunk's corners for this moment, worked out once for its bones and its tube. */
const TRUNKS = new WeakMap<Anim, V3[]>();

/** Where the pile of shafts it has made lies, on the ground before it (body frame). */
const pileSpot = (s: Spiral): V3 => [s.fore.at[0] + s.fore.w[2] * 1.6, s.fore.at[1] + s.trunk.len * 2.6, 0];

function spiralBones(s: Spiral): (a: Anim) => Bones {
  const spec = specOf(s);
  let own: Own | null = null, cur: Anim | null = null;
  // Posed with its graze taken out, as it is no grazer: standing at its task, its graze is the log held in its trunk.
  const quad = quadBonesOf(spec, (p) => { own = ownOf(s, cur!); poseOwn(s, p, cur!, own); });
  return (a) => {
    cur = a;
    own = null;
    const b = quad(a.graze ? { ...a, graze: 0 } : a);
    const o = own ?? ownOf(s, a);
    const T = s.trunk;
    TRUNKS.set(a, trunkPts(T, o.trunk).pts);
    // Its ears, spread out from the sides of its skull and flapped forward.
    for (let k = 0; k < 2; k++) {
      const sd = k ? 1 : -1;
      const e = onEgg(s.skull.c, s.skull.r, [sd * s.ear.dir[0], s.ear.dir[1], s.ear.dir[2]]);
      b[`ear${k}`] = joint(b.head, [e.p[0] - sd * s.skull.r[0] * 0.12, e.p[1], e.p[2]], 4, 0, sd * (s.ear.out + o.ears[k]));
    }
    // The log in the coil of its trunk, across its chest, turned in it; the shafts off it and their pile.
    if (o.work > 0.01) {
      const c = place(b.head, hookCentre(T, o.trunk));
      const turned = joint({ m: b.body.m, t: [0, 0, 0] }, [0, 0, 0], o.spin, 0, 0);
      b.log = { m: turned.m, t: c };
      const pile = place(joint(b.body, [0, 0, 0]), pileSpot(s));
      b.pile = { m: b.body.m, t: [pile[0], pile[1], 0] };
      const t = a.act?.kind === 'work' ? a.act.t : -1;
      SPIRAL_WORK.splits.forEach((at, q) => {
        const u = t - at;
        if (u < -0.02 || u > SPIRAL_WORK.land + 0.04) return;
        // Split off the log's right end, along it, and dropped: thrown out a little and falling onto the pile.
        const off = place(b.log, [s.log.len * 0.32, 0, s.log.r * 0.7]);
        if (u < 0.05) {
          const slide = ramp(u, -0.02, 0.05);
          b[`shaft${q}`] = { m: b.body.m, t: add(off, scale([b.body.m[0], b.body.m[3], b.body.m[6]], slide * s.log.len * 0.25)) };
        } else {
          const f = clamp((u - 0.05) / (SPIRAL_WORK.land - 0.05));
          const from = add(off, scale([b.body.m[0], b.body.m[3], b.body.m[6]], s.log.len * 0.25));
          const to: V3 = [pile[0], pile[1], s.log.r * 0.4];
          const at3 = mixV(from, to, f);
          at3[2] += 4 * s.log.len * 0.3 * f * (1 - f) * 0.6;
          const spin = f * 140 * (q ? -1 : 1);
          b[`shaft${q}`] = joint({ m: b.body.m, t: at3 }, [0, 0, 0], 0, 0, spin);
        }
      });
    }
    return b;
  };
}

/* ---- its pieces -------------------------------------------------------------------- */

/** The barrel, grey. */
function bodyMesh(s: Spiral, n: number): Mesh {
  // Its rings closer together toward its ends, where it rounds off; round each, from under its belly up and over.
  const Y = s.body.y, rows = 22, ys = Array.from({ length: rows + 1 }, (_, q) => lerp(Y[0], Y[Y.length - 1], 0.5 - 0.5 * Math.cos((Math.PI * q) / rows)));
  const ths = Array.from({ length: n + 1 }, (_, c) => -Math.PI / 2 + (c / n) * TAU);
  const grid = ys.map((y) => ths.map((th) => surf(s, y, th)));
  const side = sheet(grid, () => 'coat', (r, c) => onBody(s, (ys[r] + ys[r + 1]) / 2, (ths[c] + ths[c + 1]) / 2).n);
  // Its two ends closed.
  const caps = [0, rows].map((r) => {
    const v = grid[r].slice(0, n), want: V3 = [0, r ? 1 : -1, 0];
    return mesh(v, wound(v, [{ i: v.map((_, k) => k), m: 'coat' }], [want]));
  });
  return merge(side, ...caps);
}

/** A swirl painted on a surface about `c`, facing `nn`, `R` across: a curl of a turn and a half from its middle out, cream. */
function swirl(c: V3, nn: V3, up: V3, R: number, w: number, turn: number, m: Mat = 'mark'): Disc[] {
  const u = unit(sub(up, scale(nn, dot(up, nn)))), v = cross(nn, u);
  const out: Disc[] = [];
  const pts: V3[] = [];
  const N = 26;
  for (let q = 0; q <= N; q++) {
    const k = q / N, a = turn * (0.4 + k * TAU * 1.55), r = R * (0.08 + 0.92 * k);
    pts.push(add(c, add(scale(u, r * Math.cos(a)), scale(v, r * Math.sin(a)))));
  }
  for (let q = 0; q < N; q++) {
    const k = q / N, ww = w * (0.55 + 0.65 * k);
    out.push(strip(pts[q], pts[q + 1], nn, ww, m));
    if (q > 0) out.push(disc(pts[q], nn, ww, ww, 6, m));
  }
  out.push(disc(pts[0], nn, w * 0.7, w * 0.7, 6, m));
  return out;
}

/** The cream spiral on each haunch. */
function haunchMarks(s: Spiral): Mesh {
  const out: Disc[] = [];
  for (const sd of [1, -1]) {
    const M = s.mark, e = onBody(s, M.y, sd > 0 ? M.th : Math.PI - M.th, 0.008);
    out.push(...swirl(e.p, e.n, [0, 0, 1], M.r, M.r * 0.11, sd));
  }
  return paint(out);
}

/**
 * The calf's coat: a thick shag of cream over its shoulders and back, down its flanks in front and only along its top behind,
 * one piece, its hem and its back edge cut in a zigzag of tufts lying down over the grey, shadowed there; and a bib under its
 * chin.
 */
function coatMesh(s: Spiral, fine: boolean): Mesh {
  const Y0 = alongBody(s, 0.12), Y1 = s.body.y[s.body.y.length - 2] + 0.03;
  const rows = fine ? 16 : 10, cols = fine ? 12 : 8;
  // How far down its flanks the coat comes along it: to below the waist at the shoulder, only the top at the rump.
  const lo = (u: number): number => lerp(0.8, -0.55, smooth(u * 1.35));
  const H = s.body.h[3], thick = H * 0.045;
  const shag = (r: number, c: number): number => thick * (0.8 + 0.4 * jitter(r * 31 + c));
  // The hem's tufts, a point at every other row, and the back edge's, a point at every other column.
  const hem = (r: number): number => (r % 2 ? 0.55 : 0.1) * (0.75 + 0.5 * jitter(r * 3 + 1));
  const tail = (c: number): number => (c % 2 ? 0.2 : 0.03) * H * (0.8 + 0.4 * jitter(c * 5 + 2));
  const ths = (u: number, r: number): number[] => {
    const l = lo(u), hm = hem(r);
    return [l - hm, ...Array.from({ length: cols + 1 }, (_, c) => lerp(l, Math.PI - l, c / cols)), Math.PI - l + hm];
  };
  const grid: V3[][] = [];
  // The back edge's row of points, out over the rump.
  {
    const row: V3[] = [];
    ths(0, 1).forEach((th, c) => row.push(add(onBody(s, Y0 - tail(c), th, thick * 0.4).p, [0, 0, -tail(c) * 0.3])));
    grid.push(row);
  }
  for (let r = 0; r <= rows; r++) {
    const u = r / rows, y = lerp(Y0, Y1, u);
    // The hem's points lie down close on the grey; the rest stands off it, shaggy.
    grid.push(ths(u, r).map((th, c) => onBody(s, y, th, c === 0 || c === cols + 2 ? thick * 0.3 : shag(r, c)).p));
  }
  const thMid = (r: number, c: number): number => { const u = clamp((r - 0.5) / rows); return ths(u, Math.max(0, r - 1))[c] * 0.5 + ths(u, Math.max(0, r - 1))[c + 1] * 0.5; };
  // Cream over its top, a shadowed cream down its hem and its back edge, where the shag hangs.
  const tone = (r: number, c: number): Mat => (r === 0 || c <= 1 || c >= cols + 1 ? 'belly' : 'mark');
  const out: Mesh[] = [sheet(grid, tone, (r, c) => onBody(s, lerp(Y0, Y1, clamp((r - 0.5) / rows)), thMid(r, c)).n)];
  // The bib over its chest, under its chin.
  const B = s.body, n5 = B.y.length - 2;
  out.push(orb([0, lerp(B.y[n5], B.y[n5 + 1], 0.4), B.z[n5] - B.h[n5] * 0.25], [B.w[n5] * 0.78, (B.y[n5 + 1] - B.y[n5]) * 0.62, B.h[n5] * 0.62], fine ? 11 : 8, 5, 'mark'));
  return merge(...out);
}

/**
 * A ruff of cream fur round a leg at `z` (the leg's own frame): a short band standing a little off it, its lower edge a zigzag
 * of tufts hanging `drop` below.
 */
function cuff(c: V3, r: number, z: number, drop: number, n: number): Mesh {
  const N = n * 2, grid: V3[][] = [[], [], []];
  for (let j = 0; j <= N; j++) {
    const a = (j / N) * TAU, d: V3 = [Math.cos(a), Math.sin(a), 0];
    const hang = drop * (j % 2 ? 1 : 0.3) * (0.85 + 0.3 * jitter(j + 7));
    grid[0].push(add(c, add(scale(d, r * 1.0), [0, 0, z + drop * 0.25])));
    grid[1].push(add(c, add(scale(d, r * 1.16), [0, 0, z - drop * 0.1])));
    grid[2].push(add(c, add(scale(d, r * 1.12 + hang * 0.15), [0, 0, z - hang])));
  }
  return sheet(grid, () => 'mark', (_q, j) => { const a = ((j + 0.5) / N) * TAU; return [Math.cos(a), Math.sin(a), 0]; });
}

/**
 * A cushion of moss: a low soft mound, dark olive, lumpy, half sunk into what it grows on, ringed with a few short fronds lying
 * out over it with bright yellow-green tips.
 */
function cushion(c: V3, n: V3, R: number, id: number, fine: boolean): Mesh {
  const z = unit(n);
  let x = cross([0, 1, 0], z);
  if (Math.hypot(x[0], x[1], x[2]) < 1e-4) x = [1, 0, 0];
  x = unit(x);
  const y = cross(z, x);
  const b = orbAlong([0, 0, 0], z, [R * 1.15, R * 1.0, R * 0.36], fine ? 9 : 7, 4, 'moss');
  const out: Mesh[] = [mesh(b.v.map((p, i) => add(c, scale(p, 0.85 + 0.3 * jitter(id * 31 + i))) as V3), b.f)];
  const fronds = fine ? 5 : 3;
  for (let q = 0; q < fronds; q++) {
    const a = (q / fronds) * TAU + jitter(id + q) * 1.2;
    const o = add(scale(x, Math.cos(a)), scale(y, Math.sin(a)));
    const d = unit(add(scale(o, 1), scale(z, 0.08)));
    out.push(fern(add(c, add(scale(o, R * 0.7), scale(z, R * 0.14))), d, z, R * (0.7 + 0.3 * jitter(id * 3 + q)), R * 0.34, fine, id * 7 + q));
  }
  return merge(...out);
}

/**
 * A cluster of broad fern leaves: a small dark cushion of moss at its heart and leaves radiating out of it in two layers, the
 * inner ones shorter and lifted, each olive to a bright yellow-green tip.
 */
function leafCluster(c: V3, n: V3, R: number, id: number, fine: boolean): Mesh {
  const z = unit(n);
  let x = cross([0, 1, 0], z);
  if (Math.hypot(x[0], x[1], x[2]) < 1e-4) x = [1, 0, 0];
  x = unit(x);
  const y = cross(z, x);
  const out: Mesh[] = [orbAlong(c, z, [R * 0.5, R * 0.45, R * 0.28], fine ? 8 : 6, 3, 'moss')];
  for (const [count, len, rise, lift] of [[6, 1.3, -0.05, 0.05], [4, 0.85, 0.22, 0.16]] as Array<[number, number, number, number]>) {
    for (let q = 0; q < count; q++) {
      const a = (q / count) * TAU + jitter(id + q + count) * 0.8 + (count === 4 ? 0.5 : 0);
      const o = add(scale(x, Math.cos(a)), scale(y, Math.sin(a)));
      const d = unit(add(o, scale(z, rise)));
      const face = unit(sub(z, scale(d, dot(z, d))));
      out.push(fern(add(c, scale(z, R * lift)), d, face, R * len * (0.85 + 0.3 * jitter(id * 3 + q)), R * len * 0.36, fine, id * 7 + q, -0.12));
    }
  }
  return merge(...out);
}

/** Moss along its back: soft low cushions with bright fern tips, set either side of its spine by turns; fern leaves off its sides. */
function mossMesh(s: Spiral, fine: boolean): Mesh {
  const M = s.moss, out: Mesh[] = [];
  const across = s.stage === 0 ? [-0.6, 0.6] : [-0.85, 0, 0.85];
  for (let q = 0; q < M.rows; q++) {
    const k = M.rows > 1 ? q / (M.rows - 1) : 0.5;
    across.forEach((x, j) => {
      const id = 40 + q * 7 + j;
      if (jitter(id + 5) < 0.08) return;
      const u = lerp(M.from, M.to, k + (jitter(id) - 0.5) * 0.6 / M.rows);
      const side = x * M.wide * (0.8 + 0.25 * jitter(id + 1)) + (q % 2 ? 0.06 : -0.06);
      const at = onBody(s, alongBody(s, u), Math.PI / 2 - side, -M.deep * 0.25);
      const R = M.deep * (s.stage ? 1.35 : 0.6) * (0.85 + 0.3 * jitter(id + 2)) * (1 - 0.2 * Math.abs(x));
      out.push(s.stage ? leafCluster(at.p, at.n, R, id, fine) : cushion(at.p, at.n, R, id, fine));
    });
  }
  // Fern fronds off the edge of the moss, drooping down over its sides and its shoulders, two to a step, long and short.
  for (let q = 0; q < M.ferns * 2; q++) {
    for (const sd of [1, -1]) {
      const id = 300 + q * 5 + (sd > 0 ? 0 : 2);
      const u = lerp(M.from + 0.04, M.to, (q + 0.2 + 0.6 * jitter(id)) / (M.ferns * 2));
      const y = alongBody(s, u), th = sd > 0 ? Math.PI / 2 - M.wide * 0.95 : Math.PI / 2 + M.wide * 0.95;
      const at = onBody(s, y, th, M.deep * 0.15);
      // Down the side along its surface, a little out from it and back or forward by turns.
      const down = unit(sub(onBody(s, y, th + (sd > 0 ? -0.2 : 0.2)).p, onBody(s, y, th).p));
      const dir = unit(add(add(down, scale(at.n, 0.25)), [0, (jitter(id + 1) - 0.5) * 0.5, 0]));
      const L = s.body.h[3] * (s.stage === 2 ? 0.5 : 0.44) * (q % 2 ? 0.7 : 1) * (0.85 + 0.3 * jitter(id + 3));
      out.push(fern(at.p, dir, at.n, L, L * 0.34, fine, id, 0.12));
    }
  }
  // Brown spikes standing up along its spine out of the moss, swept back.
  if (s.stage === 1) {
    for (let q = 0; q < 2; q++) {
      const at = onBody(s, alongBody(s, lerp(0.85, 0.6, q)), Math.PI / 2 + (q % 2 ? 0.16 : -0.16), M.deep * 0.2);
      out.push(spike(at.p, add(at.n, [0, -0.9, 0]), s.body.h[3] * (0.5 - 0.1 * q), s.body.h[3] * 0.16, 7));
    }
  }
  return merge(...out);
}

/** A fern leaf from `root` along `dir`, its face toward `face`: a stem with leaflets either side, darker at its root, bright to its tip. */
function fern(root: V3, dir: V3, face: V3, L: number, W: number, fine: boolean, id: number, curl = -0.2): Mesh {
  const d = unit(dir);
  const N = fine ? 9 : 5;
  const pts: V3[] = [], ws: number[] = [];
  for (let q = 0; q <= N; q++) {
    const k = q / N;
    pts.push(add(add(root, scale(d, L * k)), scale(face, L * curl * k * k)));
    ws.push(q === N ? 0.003 : W * Math.sin(Math.PI * Math.min(1, 0.12 + k * 0.92)) * (q % 2 ? 1 : 0.6));
  }
  const half = Math.round(N * 0.6);
  return merge(
    blade(pts.slice(0, half + 1), ws.slice(0, half + 1), face, { mat: jitter(id) < 0.3 ? 'leafDark' : 'moss', rib: 'leafDark', fold: 0.2, thick: 0.008 }),
    blade(pts.slice(half), ws.slice(half), face, { mat: 'leaf', rib: 'moss', fold: 0.2, thick: 0.008 }),
  );
}

/** Rows across a plate or a band: thin ones at its edges for its trim. */
const TRIMMED = [0, 0.13, 0.32, 0.5, 0.68, 0.87, 1];
const trimmedAt = (q: number): boolean => q === 0 || q === TRIMMED.length - 2;

/**
 * A plate of carved wood lying on the body over `y0`..`y1` along it and `th0`..`th1` round it, standing `lift` proud of it, its
 * lower edge cut to a point in the middle (`point`), trimmed in gold-green along its edges; and a swirl carved in it.
 */
function plateOn(s: Spiral, y0: number, y1: number, th0: number, th1: number, lift: number, point: number, swirlR: number, right: boolean): Mesh {
  const C = TRIMMED.length - 1;
  const grid: V3[][] = [];
  // From its top edge down to its low edge, cut down to a point in its middle.
  const thOf = (r: number, c: number): number => {
    const k = TRIMMED[Math.min(c, C)], dip = point * (1 - Math.abs(2 * k - 1));
    const top = right ? th1 : th0, low = right ? th0 - dip : th1 + dip;
    return lerp(top, low, TRIMMED[Math.min(r, C)]);
  };
  for (let r = 0; r <= C; r++) {
    const row: V3[] = [];
    // Bowed out more in its middle, so it stands off the body as a plate does.
    for (let c = 0; c <= C; c++) row.push(onBody(s, lerp(y0, y1, TRIMMED[c]), thOf(r, c), lift * (1 + 0.8 * Math.sin(Math.PI * TRIMMED[c]) * Math.sin(Math.PI * TRIMMED[r]))).p);
    grid.push(row);
  }
  const m = sheet(grid, (r, c) => (trimmedAt(r) || trimmedAt(c) ? 'fitting' : 'wood'), (r, c) => onBody(s, lerp(y0, y1, TRIMMED[c]), thOf(r, c)).n);
  if (!swirlR) return m;
  const mid = onBody(s, (y0 + y1) / 2, thOf(3, 3), lift * 1.8 + 0.006);
  // Cream, as the swirl on its haunch, edged in dark wood so it stands off the pale plate.
  return merge(m, paint([...swirl(mid.p, mid.n, [0, 0, 1], swirlR, swirlR * 0.2, right ? 1 : -1, 'woodDark'), ...swirl(add(mid.p, scale(mid.n, 0.004)), mid.n, [0, 0, 1], swirlR, swirlR * 0.12, right ? 1 : -1, 'mark')]));
}

/** Its armour on the body: plates over its shoulders, and on the Spiralphant over its flanks too. */
function armourMesh(s: Spiral): Mesh {
  if (!s.armour) return merge();
  const out: Mesh[] = [];
  const Yf = s.body.y[s.body.y.length - 2], H = s.body.h[3], lift = H * 0.05, big = s.armour === 2;
  for (const right of [true, false]) {
    const T = (a: number): number => (right ? a : Math.PI - a);
    // The shoulder: over the fore leg, from high on its side down to a point over the elbow.
    const lo = T(big ? -0.2 : 0.0), hi = T(big ? 1.0 : 1.0);
    out.push(plateOn(s, Yf - H * (big ? 0.95 : 0.7), Yf + 0.04, Math.min(lo, hi), Math.max(lo, hi), lift, 0.45, big ? H * 0.26 : 0, right));
    if (big) {
      // Over the top of it a second, smaller plate, overlapping it as a pauldron's lames do.
      const t0 = T(0.62), t1 = T(1.22);
      out.push(plateOn(s, Yf - H * 0.72, Yf + 0.1, Math.min(t0, t1), Math.max(t0, t1), lift * 2.6, 0.3, 0, right));
      // The flank, over its ribs, and the haunch above its spiral.
      const f0 = T(-0.3), f1 = T(0.7);
      out.push(plateOn(s, alongBody(s, 0.42), alongBody(s, 0.66), Math.min(f0, f1), Math.max(f0, f1), lift, 0.35, H * 0.17, right));
      const h0 = T(0.35), h1 = T(0.95);
      out.push(plateOn(s, alongBody(s, 0.02), alongBody(s, 0.3), Math.min(h0, h1), Math.max(h0, h1), lift, 0.3, 0, right));
    }
  }
  return merge(...out);
}

/** A band round a leg, from `z0` down to `z1` on it (the leg's own frame), cut to a point at its front top; carved wood, gold-green at its edges. */
function bracer(r: number, z0: number, z1: number, point: number, n: number, emblem: boolean): Mesh {
  const R = TRIMMED.length - 1, grid: V3[][] = [];
  for (let q = 0; q <= R; q++) {
    const row: V3[] = [];
    for (let j = 0; j <= n; j++) {
      const a = (j / n) * TAU, front = Math.max(0, Math.cos(a - Math.PI / 2)) ** 3;
      const top = z0 + point * front, bot = z1 - point * 0.6 * front;
      const k = TRIMMED[q], z = lerp(top, bot, k), rr = r * (1.13 + 0.07 * Math.sin(k * Math.PI));
      row.push([rr * Math.cos(a), rr * Math.sin(a), z]);
    }
    grid.push(row);
  }
  const m = sheet(grid, (q) => (trimmedAt(q) ? 'fitting' : 'wood'), (_q, j) => { const a = ((j + 0.5) / n) * TAU; return [Math.cos(a), Math.sin(a), 0]; });
  if (!emblem) return m;
  // A swirl carved on its front over a patch of moss.
  const z = lerp(z0, z1, 0.5), nn: V3 = [0, 1, 0];
  return merge(m, paint([disc([0, r * 1.21, z], nn, r * 0.46, (z0 - z1) * 0.34, 8, 'moss'), ...swirl([0, r * 1.22, z], nn, [0, 0, 1], r * 0.32, r * 0.05, 1, 'fitting')]));
}

/** A plate of carved wood over the front of a knee, from `z0` down to `z1` (the shin's own frame), cut to a point below; gold-green at its edges. */
function kneePlate(r: number, z0: number, z1: number, wide: number): Mesh {
  const C = TRIMMED.length - 1, grid: V3[][] = [];
  for (let q = 0; q <= C; q++) {
    const row: V3[] = [];
    for (let j = 0; j <= C; j++) {
      const k = TRIMMED[j], a = Math.PI / 2 + lerp(-wide, wide, k), mid = 1 - Math.abs(2 * k - 1);
      const top = z0 + r * 0.5 * mid, bot = z1 + r * 0.6 - r * 1.7 * mid;
      const kz = TRIMMED[q], rr = r * (1.2 + 0.28 * Math.sin(kz * Math.PI) * mid);
      row.push([rr * Math.cos(a), rr * Math.sin(a), lerp(top, bot, kz)]);
    }
    grid.push(row);
  }
  return sheet(grid, (q, j) => (trimmedAt(q) || trimmedAt(j) ? 'fitting' : 'wood'), (_q, j) => { const a = Math.PI / 2 + lerp(-wide, wide, TRIMMED[j]); return [Math.cos(a), Math.sin(a), 0]; });
}

/** A column of a leg, grey: the calf's with a shaggy cream fringe over its foot; plates and bracers on the bigger two. */
function legMeshes(s: Spiral, L: Leg, fore: boolean, n: number): { upper: Mesh; lower: Mesh; foot: Mesh } {
  const [u, l, f] = L.len, [wu, wl, wf] = L.w;
  // A column, widest where it goes up into the body, narrowing to the knee and down the shin, out again at the foot.
  const uw = [wu * 1.16, wu * 1.12, wu * 1.0, wl * 1.04], lw = [wl * 1.02, wl * 0.94, wl * 0.92, wf * 0.98];
  // Its top a round mass of thigh or shoulder going up into the body, so where it shows past the barrel it is round.
  const upper = merge(tube([[0, 0, 0.0], [0, 0, -u * 0.25], [0, 0, -u * 0.6], [0, 0, -u - wl * 0.3]], uw, uw, n, 'coat', { seam: 'both' }), orb([0, 0, -u * 0.05], [wu * 1.16, wu * 1.16, wu * 1.3], n, 4, 'coat'));
  const shin = tube([[0, 0, wl * 0.6], [0, 0, -l * 0.35], [0, 0.004, -l * 0.75], [0, 0.005, -l - 0.01]], lw, lw, n, 'coat', { seam: 'both' });
  const parts: Mesh[] = [shin];
  if (s.armour) {
    const r = wl, big = s.armour === 2;
    // A plate over the knee, moss under its point, and a band round the shin below it.
    parts.push(kneePlate(r, r * 0.9, -l * 0.22, big ? 1.3 : 1.2));
    parts.push(bracer(r, -l * 0.42, -l * (big ? 0.76 : 0.7), r * 0.45, n + 2, big));
    parts.push(cushion([0, r * 1.14, -l * 0.36], [0, 1, 0.2], r * 0.36, 61, false), cushion([r * 0.95, r * 0.55, -l * 0.38], [1, 0.4, 0.2], r * 0.3, 63, false));
  }
  // The foot: a round pad spread wider at the ground, cream toenails round its front; the calf's in a shaggy fringe of cream.
  const foot = tube([[0, 0.01, 0.02], [0, 0.015, -f * 0.55], [0, 0.02, -f]], [wf, wf * 1.1, wf * 1.16], [wf, wf * 1.1, wf * 1.16], n, 'coat', { seam: 'start' });
  const nails: Mesh[] = [];
  for (const a of [-0.6, 0, 0.6]) {
    const d: V3 = [Math.sin(a), Math.cos(a), 0];
    nails.push(orbAlong(add(scale(d, wf * 1.1), [0, 0.01, -f * 0.66]), d, [wf * 0.36, wf * 0.28, wf * 0.24], 6, 3, 'claw'));
  }
  if (s.armour === 2) nails.push(bracer(wf * 0.98, f * 1.4, f * 0.1, wf * 0.3, n + 2, false));
  // The calf's in a fringe of cream fur.
  if (s.coat) nails.push(cuff([0, 0.01, 0], wf * 0.98, f * 1.9, f * 1.6, 8));
  return { upper, lower: merge(...parts), foot: merge(foot, ...nails) };
}

/** An eye at `p` looking out along `nn`: a dark rim, the amber of it, a dark middle and its glints. */
function eyeOf(p: V3, nn: V3, sz: number, out: Disc[]): void {
  out.push(disc(p, nn, sz * 1.18, sz * 1.22, 12, 'lid', { up: [0, 0, 1] }));
  out.push(disc(add(p, scale(nn, 0.002)), nn, sz, sz * 1.04, 12, 'cap', { up: [0, 0, 1] }));
  out.push(disc(add(add(p, scale(nn, 0.004)), [0, 0, -sz * 0.05]), nn, sz * 0.52, sz * 0.6, 10, 'eye', { up: [0, 0, 1] }));
  const side = unit(cross([0, 0, 1], nn));
  out.push(disc(add(add(add(p, scale(nn, 0.007)), [0, 0, sz * 0.38]), scale(side, sz * 0.3)), nn, sz * 0.32, sz * 0.32, 6, 'glint', { lit: true, up: [0, 0, 1] }));
  out.push(disc(add(add(add(p, scale(nn, 0.007)), [0, 0, -sz * 0.4]), scale(side, -sz * 0.28)), nn, sz * 0.13, sz * 0.13, 5, 'glint', { lit: true, up: [0, 0, 1] }));
}

/** The head: a domed skull and the face below it down to where the trunk comes out, amber eyes, a small smiling mouth. */
function headMesh(s: Spiral, n: number, k: number, shut: boolean): Mesh {
  const S = s.skull, F = s.face;
  const skull = orb(S.c, S.r, n + 8, k + 5, 'coat');
  const face = orbAlong(F.c, [0, 0.7, -0.7], [F.r[0], F.r[2], F.r[1]], n + 6, k + 3, 'coat');
  const marks: Disc[] = [];
  for (const sd of [1, -1]) {
    const e = onEgg(S.c, S.r, [sd * s.eye.dir[0], s.eye.dir[1], s.eye.dir[2]]);
    const p = add(e.p, scale(e.n, 0.006));
    if (shut) marks.push(disc(p, e.n, s.eye.size * 1.15, s.eye.size * 0.3, 8, 'lid', { up: [0, 0, 1] }));
    else eyeOf(p, e.n, s.eye.size, marks);
    // A fold of brow over the eye.
    const b0 = onEgg(S.c, S.r, [sd * (s.eye.dir[0] - 0.1), s.eye.dir[1], s.eye.dir[2] + 0.36]), b1 = onEgg(S.c, S.r, [sd * (s.eye.dir[0] + 0.12), s.eye.dir[1] - 0.25, s.eye.dir[2] + 0.3]);
    marks.push(strip(add(b0.p, scale(b0.n, 0.006)), add(b1.p, scale(b1.n, 0.006)), b0.n, s.eye.size * 0.14, 'coatDark'));
  }
  // The mouth, under the trunk's root: a little smile.
  const mo = onEgg(F.c, F.r, [0, 0.55, -0.85]);
  return merge(skull, face, paint(marks), smile(add(mo.p, scale(mo.n, -0.02)), mo.n, F.r[0] * 0.55, 'nose'));
}

/** An ear: big and round, a pointed lobe at its foot; grey outside and round its rim, dusky pink within (its right one, in its own frame: its face out along x, its length down, its width back). */
function earMesh(s: Spiral): Mesh {
  const E = s.ear, L = E.len, W = E.w, th = W * 0.06;
  // Its outline: from the root along its top, round its back and down to the lobe, and up its front edge.
  const out: Array<[number, number]> = [[0.02, 0.06], [0.22, 0.17], [0.5, 0.2], [0.78, 0.1], [0.96, -0.12], [1.0, -0.4], [0.9, -0.66], [0.72, -0.84], [0.5, -0.94], [0.3, -1.02], [0.18, -0.88], [0.08, -0.6], [0, -0.3]];
  const P = out.map(([u, v]) => [0, -u * W, v * L] as V3);
  const v: V3[] = [...P.map((p) => [th / 2, p[1], p[2]] as V3), ...P.map((p) => [-th / 2, p[1], p[2]] as V3)];
  const N = P.length;
  const f: Face[] = [{ i: P.map((_, q) => q), m: 'coat' }, { i: P.map((_, q) => N + q), m: 'coat' }];
  const want: V3[] = [[1, 0, 0], [-1, 0, 0]];
  for (let q = 0; q < N; q++) {
    const q2 = (q + 1) % N;
    f.push({ i: [q, q2, N + q2, N + q], m: 'coat' });
    const d = sub(P[q2], P[q]);
    want.push([0, d[2], -d[1]]);
  }
  // Pink within: the face less a rim of grey, lighter low in it where the light catches.
  const mid: V3 = [0, -W * 0.5, -L * 0.42];
  const inner = facing(P.map((p) => add(mixV(mid, p, 0.8), [th / 2 + 0.003, 0, 0])), [1, 0, 0], 'inner');
  const low = facing(P.slice(7, 12).map((p) => add(mixV(mid, p, 0.72), [th / 2 + 0.005, 0, 0])).concat([add(mid, [th / 2 + 0.005, W * 0.05, -L * 0.1])]), [1, 0, 0], s.coat ? 'mark' : 'muzzle');
  return merge(mesh(v, wound(v, f, want)), paint([inner, low]));
}

/** A tusk: ivory, from its root on the face curving out, down and up to its point (the right one, head frame). */
function tuskMesh(K: Tusk, n: number): Mesh {
  const pts = curve(K.root, K.mid, K.tip, 7);
  return tube(pts, pts.map((_, q) => K.r * (1 - 0.85 * (q / 7) ** 1.3)), pts.map((_, q) => K.r * (1 - 0.85 * (q / 7) ** 1.3)), n, (q) => (q === 0 ? 'hornDark' : 'tooth'));
}

/** A spike: a wooden root and a brown point, from `at` along `d`, `len` long and `r` thick at its root. */
function spike(at: V3, d: V3, len: number, r: number, n: number): Mesh {
  const dd = unit(d), bend = add(add(at, scale(dd, len * 0.6)), [0, -len * 0.12, 0]);
  return merge(
    taper([add(at, scale(dd, -r * 0.4)), add(at, scale(dd, len * 0.3))], r, r * 0.86, n, 'wood'),
    tube(curve(add(at, scale(dd, len * 0.28)), bend, add(add(at, scale(dd, len)), [0, -len * 0.22, 0]), 4), [r * 0.86, r * 0.62, r * 0.36, r * 0.14, 0.003], [r * 0.86, r * 0.62, r * 0.36, r * 0.14, 0.003], n, 'bark'),
  );
}

/** Its crown: the calf's cream shag with a moss cushion and small brown spikes; the Spiraltrunk's crested headpiece; the Spiralphant's helm. */
function crownMesh(s: Spiral, n: number, fine: boolean): Mesh {
  const S = s.skull, out: Mesh[] = [];
  if (s.crown === 0) {
    // A small tuft low on its forehead: a few cream puffs, a cushion of moss, two tiny brown spikes; its head grey round it.
    const R: V3 = scale(S.r, 1.02);
    for (let q = 0; q < 4; q++) {
      const a = (q / 4) * TAU + 0.4, e = onEgg(S.c, R, [Math.cos(a) * 0.2, 0.42 + Math.sin(a) * 0.16, 0.9]);
      out.push(orbAlong(add(e.p, scale(e.n, S.r[2] * 0.03)), [Math.cos(a) * 0.3, -0.6, 0.8], [S.r[0] * 0.13, S.r[0] * 0.12, S.r[0] * (0.2 + 0.05 * jitter(q + 5))], 7, 3, q % 2 ? 'belly' : 'mark'));
    }
    const m0 = onEgg(S.c, R, [0, 0.3, 1]);
    out.push(cushion(add(m0.p, scale(m0.n, S.r[2] * 0.06)), m0.n, S.r[0] * 0.2, 11, fine));
    for (const [x, len] of [[0.14, 0.24], [-0.14, 0.2]] as Array<[number, number]>) {
      const e = onEgg(S.c, R, [x, 0.38, 0.95]);
      out.push(spike(add(e.p, scale(e.n, S.r[2] * 0.08)), add(e.n, [x * 0.5, -0.4, 0.2]), S.r[2] * len, S.r[0] * 0.06, 6));
    }
    return merge(...out);
  }
  // A headpiece of carved light wood over the top of the skull, gold-green round its edge, coming to a point over the brow.
  const big = s.crown === 2;
  const R: V3 = scale(S.r, 1.07);
  const cap = orb(S.c, R, n + 6, 7, 'wood');
  const kept: Face[] = [];
  for (const f of cap.f) {
    const mid = scale(f.i.reduce((t, i) => add(t, cap.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    const d: V3 = [(mid[0] - S.c[0]) / R[0], (mid[1] - S.c[1]) / R[1], (mid[2] - S.c[2]) / R[2]];
    // Down to its brow in front, to a point between the eyes.
    const brow = (big ? 0.2 : 0.32) - 0.5 * Math.max(0, 1 - Math.abs(d[0]) * 2.6) * Math.max(0, d[1]);
    if (d[2] > brow) kept.push({ ...f, m: d[2] < brow + 0.13 ? 'fitting' : 'wood' });
  }
  out.push(mesh(cap.v, kept));
  // A swirl carved in its brow.
  const brow = onEgg(S.c, R, [0, 0.75, 0.62]);
  out.push(paint(swirl(add(brow.p, scale(brow.n, 0.008)), brow.n, [0, -0.3, 1], S.r[0] * (big ? 0.22 : 0.18), S.r[0] * 0.035, 1, 'woodDark')));
  // Spikes in a crest along its middle from the brow back over its neck, the front ones tallest, swept back.
  const spikes = 3;
  for (let q = 0; q < spikes; q++) {
    const k = q / (spikes - 1);
    const e = onEgg(S.c, R, [0, lerp(0.4, -0.85, k), 1]);
    const len = S.r[2] * (big ? 1.15 : 0.85) * (1 - 0.4 * k);
    out.push(spike(add(e.p, scale(e.n, -0.01)), add(e.n, [0, -0.55 - 0.3 * k, 0.1]), len, S.r[0] * (big ? 0.22 : 0.18) * (1 - 0.25 * k), 7));
  }
  // And two either side of the crest, shorter, splayed out.
  for (const sd of [1, -1]) {
    const e = onEgg(S.c, R, [sd * 0.62, -0.05, 0.8]);
    out.push(spike(e.p, add(e.n, [sd * 0.3, -0.6, 0.2]), S.r[2] * (big ? 0.85 : 0.6), S.r[0] * (big ? 0.18 : 0.15), 7));
  }
  if (big) {
    // A tall crest plate standing up off its brow, swept back, a spiral carved in gold on each face; gold at its edge.
    const at = onEgg(S.c, R, [0, 0.45, 0.9]).p, up = unit([0, -0.35, 1]), Lc = S.r[2] * 1.15, Wc = S.r[0] * 0.42;
    const cp: V3[] = [], cw: number[] = [];
    for (let q = 0; q <= 6; q++) {
      const k = q / 6;
      cp.push(add(add(at, scale(up, Lc * k)), [0, -Lc * 0.25 * k * k, 0]));
      cw.push(q === 6 ? 0.004 : Wc * Math.sin(Math.PI * Math.min(1, 0.25 + k * 0.85)) ** 0.8);
    }
    const th = S.r[0] * 0.06;
    out.push(blade(cp, cw, [1, 0, 0], { mat: 'wood', rib: 'fitting', fold: 0.05, thick: th }));
    const mid = cp[3];
    for (const sd of [1, -1]) {
      const nn: V3 = [sd, 0, 0];
      out.push(paint([disc(add(mid, [sd * (th * 0.5 + 0.004), 0, 0]), nn, Wc * 0.62, Wc * 0.62, 12, 'fitting', { up: [0, 0, 1] }),
        ...swirl(add(mid, [sd * (th * 0.5 + 0.008), 0, 0]), nn, [0, 0, 1], Wc * 0.5, Wc * 0.07, sd, 'woodDark')]));
    }
    // A plate down the root of its trunk between its tusks, gold-studded.
    const F = s.face, fe = onEgg(F.c, F.r, [0, 0.85, 0.35]);
    out.push(orbAlong(fe.p, fe.n, [F.r[0] * 0.5, F.r[0] * 0.42, F.r[0] * 0.16], n, 3, 'wood'));
    out.push(paint([disc(add(fe.p, scale(fe.n, F.r[0] * 0.17)), fe.n, F.r[0] * 0.18, F.r[0] * 0.18, 8, 'fitting', { up: [0, 0, 1] })]));
  }
  // Moss on the headpiece, behind the crest.
  for (const [x, y, z, id] of [[0.42, -0.55, 0.72, 21], [-0.45, -0.5, 0.7, 23], [0.0, -0.2, 1, 25]] as Array<[number, number, number, number]>) {
    const e = onEgg(S.c, R, [x, y, z]);
    out.push(clumpOf(e.p, e.n, S.r[0] * 0.26, id, fine ? 7 : 5, fine));
  }
  return merge(...out);
}

/** Two cut logs strapped along its back either side of its spine, under the moss, a band of wood over them and round under it. */
function logsMesh(s: Spiral, n: number, fine: boolean): Mesh {
  const L = s.logs!, out: Mesh[] = [];
  // Two logs lying across its back, one behind the other, sunk a little into the moss; their cut ends out over its sides.
  const y0 = alongBody(s, 0.5), ys = [y0 - L.r * 1.04, y0 + L.r * 1.04];
  const zs = ys.map((y) => surf(s, y, Math.PI / 2)[2] + L.r * 0.38);
  // The front one tilted a little, as it was thrown up there.
  ys.forEach((y, q) => out.push(logMesh(L.r, L.len, [q ? L.len * 0.06 : -L.len * 0.04, y, zs[q]], n, fine, q ? 3 : 9, q ? [1, 0.14, 0.09] : [1, 0, 0])));
  // Moss grown over their middles, fern fronds hanging off it down their sides and over their ends.
  ys.forEach((y, q) => {
    const c: V3 = [q ? 0.06 : -0.04, y, zs[q] + L.r * 0.92];
    out.push(leafCluster(c, [0, q ? 0.2 : -0.2, 1], L.r * 1.05, 700 + q * 13, fine));
    for (let e = 0; e < 4; e++) {
      const sd = e % 2 ? 1 : -1, x = sd * L.len * (0.12 + 0.12 * Math.floor(e / 2));
      out.push(fern([x, y, zs[q] + L.r * 0.95], [sd * 0.5, q ? 0.5 : -0.5, -1], [sd * 0.3, q ? 0.8 : -0.8, 0.5], L.r * 1.5, L.r * 0.5, fine, 720 + q * 9 + e, 0.1));
    }
  });
  // Two straps, front to back over both logs and down onto its back either side of them.
  for (const x of [-L.len * 0.27, L.len * 0.27]) {
    const pts: V3[] = [];
    for (let q = 0; q <= 24; q++) {
      const y = lerp(ys[0] - L.r * 2.2, ys[1] + L.r * 2.2, q / 24), Rg = ringAt(s, y);
      const back = onBody(s, y, Math.acos(clamp(x / Math.max(1e-3, Rg.w), -1, 1)), s.moss.deep * 0.5).p;
      let z = back[2];
      ys.forEach((yc, k) => {
        const dy = y - yc, over = L.r * 1.06;
        if (Math.abs(dy) < over) z = Math.max(z, zs[k] + Math.sqrt(over * over - dy * dy));
      });
      pts.push([x, y, z]);
    }
    out.push(tube(pts, L.r * 0.3, L.r * 0.07, 4, 'stem', { up: [1, 0, 0] }));
  }
  return merge(...out);
}

/** A log: bark round it, its cut ends pale with rings. */
function logMesh(r: number, len: number, at: V3, n: number, fine: boolean, id: number, along: V3 = [0, 1, 0]): Mesh {
  const d = unit(along), h = len / 2;
  const bark = tube([add(at, scale(d, -h)), add(at, scale(d, h))], [r, r], [r, r], n + 4, (_k, j) => (j % 5 === 0 ? 'woodDark' : 'bark'), { start: false, end: false });
  const ends: Mesh[] = [];
  for (const sd of [-1, 1]) {
    const c = add(at, scale(d, sd * h)), nn = scale(d, sd);
    const cap = disc(c, nn, r, r, n + 2, 'shell');
    ends.push(mesh(cap.v, wound(cap.v, [{ i: cap.v.map((_, k) => k), m: 'shell' }], [nn])));
    const rings: Disc[] = [];
    const ks: Array<[number, Mat]> = fine ? [[0.78, 'shellDark'], [0.7, 'shell'], [0.5, 'shellDark'], [0.43, 'shell'], [0.22, 'shellDark'], [0.15, 'shell']] : [[0.66, 'shellDark'], [0.55, 'shell'], [0.25, 'shellDark'], [0.15, 'shell']];
    ks.forEach(([k, m], q) => rings.push(disc(add(c, scale(nn, 0.003 * (q + 1))), nn, r * k, r * k * (0.95 + 0.08 * jitter(id + q)), fine ? 14 : 9, m)));
    ends.push(paint(rings));
  }
  return merge(bark, ...ends);
}

/** The tail: a short rope, a tuft at its end. */
function tailMeshes(s: Spiral, n: number): Mesh[] {
  const T = s.tail, out: Mesh[] = [];
  for (let q = 0; q < T.links; q++) {
    const w = T.w * (1 - 0.25 * (q / T.links));
    const link = tube([[0, 0.01, 0], [0, -T.len - 0.01, 0]], w, w, Math.max(5, n - 4), 'coat');
    out.push(q === T.links - 1 ? merge(link, taper([[0, -T.len * 0.6, 0], [0, -T.len - T.tuft, 0]], T.tuft * 0.45, 0.004, 6, s.coat ? 'mark' : 'bark')) : link);
  }
  return out;
}

/** A shaft: a straight thin rod of pale wood. */
const shaftMesh = (s: Spiral): Mesh => tube([[-s.log.len * 0.32, 0, 0], [s.log.len * 0.32, 0, 0]], s.log.r * 0.26, s.log.r * 0.26, 5, 'wood', { up: [0, 0, 1] });
/** The pile of shafts it has made, crossed on the ground. */
function pileMesh(s: Spiral): Mesh {
  const L = s.log.len * 0.32, r = s.log.r * 0.24, out: Mesh[] = [];
  const lay: Array<[number, number, number]> = [[0, 0, 20], [0.02, r * 1.8, -15], [-0.03, r * 3.4, 40], [0.01, r * 1.6, 75]];
  lay.forEach(([dy, dz, yaw]) => {
    const c = Math.cos(yaw * DEG), sn = Math.sin(yaw * DEG);
    out.push(tube([[-L * c, dy - L * sn, r + dz], [L * c, dy + L * sn, r + dz]], r, r, 5, 'wood', { up: [0, 0, 1] }));
  });
  return merge(...out);
}

function spiralBuild(s: Spiral, lod: number): Piece[] {
  const n = cut(lod, 8, 11), k = cut(lod, 4, 6), fine = lod > 0;
  const pieces: Piece[] = [];
  const B = s.body;
  const bodySolid = { c: [0, (B.y[1] + B.y[5]) / 2, B.z[3]] as V3, r: [B.w[3] * 0.92, (B.y[5] - B.y[1]) * 0.5, B.h[3] * 0.9] as V3 };
  pieces.push({ key: 'body', mesh: merge(bodyMesh(s, n * 2 + 2), haunchMarks(s)), bone: 'trunk', bias: 0, breathes: { c: [0, 0, 0], k: 0.03 } });
  if (s.coat) pieces.push({ key: 'coat', mesh: coatMesh(s, fine), bone: 'trunk', bias: 0.01, after: 'body' });
  if (s.armour) pieces.push({ key: 'armour', mesh: armourMesh(s), bone: 'trunk', bias: 0.012, after: 'body' });
  pieces.push({ key: 'moss', mesh: mossMesh(s, fine), bone: 'trunk', bias: 0.02, after: s.coat ? ['body', 'coat'] : ['body', 'armour'], thin: true });
  if (s.logs) pieces.push({ key: 'logs', mesh: logsMesh(s, n, fine), bone: 'trunk', bias: 0.015, after: ['body'] });
  // The neck: short and thick, into the back of the head.
  pieces.push({ key: 'neck', mesh: tube([[0, 0, -0.25 * s.neck.w], [0, 0.02, s.neck.len * 0.6], [0, 0.04, s.neck.len + s.skull.r[2] * 0.2]], s.neck.w, s.neck.w * 1.05, n, 'coat', { seam: 'both' }), bone: 'neck', bias: 0, under: 'head', convex: true });
  const headSolid = { c: s.skull.c, r: scale(s.skull.r, 0.92) };
  pieces.push({ key: 'head', mesh: headMesh(s, n, k, false), shut: headMesh(s, n, k, true), bone: 'head', bias: 0.2 });
  pieces.push({ key: 'crown', mesh: crownMesh(s, n, fine), bone: 'head', bias: 0.21, after: 'head', thin: s.crown === 0 });
  // Ears: the near one over the head and the shoulder, the far one behind them.
  const ear = earMesh(s);
  pieces.push(
    { key: 'ear0', mesh: mirrored(ear), bone: 'ear0', bias: 0.22, after: ['head', 'body'], front: [-1, 0, 0], hide: [headSolid], hideIn: 'head' },
    { key: 'ear1', mesh: ear, bone: 'ear1', bias: 0.22, after: ['head', 'body'], front: [1, 0, 0], hide: [headSolid], hideIn: 'head' },
  );
  // The trunk, bent to its pose every frame.
  const T = s.trunk, tn = n + 4;
  const rest = trunkMesh(s, trunkPts(T, { bends: restBends(T), lift: 0, sway: 0, side: 0.12 }).pts, tn);
  pieces.push({
    key: 'trunk', mesh: rest, bone: 'head', bias: 0.24, after: 'head', front: [0, 1, 0],
    bent: (_v, a) => trunkMesh(s, TRUNKS.get(a) ?? trunkPts(T, ownOf(s, a).trunk).pts, tn).v,
  });
  if (s.tusks.length) {
    const tusks = merge(...s.tusks.map((K) => tuskMesh(K, Math.max(5, n - 3))));
    pieces.push({ key: 'tusks', mesh: merge(tusks, mirrored(tusks)), bone: 'head', bias: 0.25, after: ['head', 'trunk'], hide: [headSolid], hideIn: 'head' });
  }
  // Legs.
  for (const [key, side, fore] of [['fl', -1, true], ['fr', 1, true], ['hl', -1, false], ['hr', 1, false]] as Array<[string, number, boolean]>) {
    const L = fore ? s.fore : s.hind, m = legMeshes(s, L, fore, n + 6);
    const front: V3 = [side * 0.7, fore ? 0.7 : -0.7, 0];
    const flip = (x: Mesh): Mesh => (side < 0 ? mirrored(x) : x);
    pieces.push(
      { key: `${key}0`, mesh: m.upper, bone: `${key}0`, bias: 0.01, under: 'body', hide: [bodySolid], hideIn: 'body' },
      { key: `${key}1`, mesh: flip(m.lower), bone: `${key}1`, bias: 0.02, after: 'body', front },
      { key: `${key}2`, mesh: flip(m.foot), bone: `${key}2`, bias: 0.03, after: ['body', `${key}1`], front },
    );
  }
  tailMeshes(s, n).forEach((m, q) => pieces.push({ key: `tail${q}`, mesh: m, bone: `tail${q}`, bias: -0.05 + q * 0.01, chain: 'tail' }));
  // What it works: the log in two halves (so its near end is in front of the coil round it and its far end behind), the shafts.
  const working = (a: Anim): boolean => a.act?.kind === 'work' || (a.graze > 0 && a.go < 1);
  for (const sd of [-1, 1]) {
    const half = logMesh(s.log.r, s.log.len / 2, [sd * s.log.len / 4, 0, 0], n, fine, sd > 0 ? 31 : 37, [1, 0, 0]);
    pieces.push({ key: `log${sd > 0 ? 'R' : 'L'}`, mesh: half, bone: 'log', bias: 0.26, shown: working });
  }
  pieces.push({ key: 'pile', mesh: pileMesh(s), bone: 'pile', bias: 0.05, shown: working });
  for (let q = 0; q < 2; q++) pieces.push({ key: `shaft${q}`, mesh: shaftMesh(s), bone: `shaft${q}`, bias: 0.27 });
  return pieces;
}

/* ---- what it throws about ----------------------------------------------------------------- */

const SHAVINGS: readonly RGB[] = [[240, 214, 162], [226, 190, 132], [248, 232, 196]];
const MOSSY: readonly RGB[] = [[172, 196, 64], [128, 160, 52]];
const pxOf = (g: CanvasRenderingContext2D): number => { const tr = g.getTransform(); return 1 / (Math.hypot(tr.a, tr.b) || 1); };

/** A shaving in the air: a small curl of pale wood, inked. */
function curl(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, c: RGB, al: number): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 1.5 * px);
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.arc(0, 0, r, 0.3, Math.PI * 1.7);
  g.lineWidth = Math.max(0.9 * px, r * 0.55);
  g.strokeStyle = css(mix(c, [90, 60, 36], 0.6), al);
  g.stroke();
  g.lineWidth = Math.max(0.5 * px, r * 0.32);
  g.strokeStyle = css(c, al);
  g.stroke();
  g.restore();
}

/** Its task: shavings curling off the log at each split and falling, and a puff of them as the log is turned. */
function workBits(g: CanvasRenderingContext2D, view: View, s: Spiral, b: Bones, t: number, front: boolean): void {
  if (!b.log) return;
  const T = ACT_SECS.work, big = 0.7 + 0.35 * s.stage, mid = b.body.t;
  const end = place(b.log, [s.log.len * 0.3, 0, s.log.r]);
  SPIRAL_WORK.splits.forEach((at, q) => {
    const since = (t - at) * T;
    if (since < -0.02 || since > 0.5) return;
    for (let e = 0; e < 10 + 3 * s.stage; e++) {
      const ang = jitter(q * 13 + e) * TAU, sp = (0.3 + 0.5 * jitter(q * 7 + e)) * big;
      const u = Math.max(0, since);
      const from = add(end, [(jitter(e + 3) - 0.5) * s.log.len * 0.5, 0, 0]);
      const p: V3 = [from[0] + Math.cos(ang) * sp * u, from[1] + Math.sin(ang) * sp * u, Math.max(0.02, from[2] + (0.6 + 0.5 * jitter(e)) * big * u - 3.2 * u * u)];
      if (nearSide(p, mid, view) !== front) continue;
      const [x, y] = onScreen(view, p);
      curl(g, x, y, s.log.r * (0.5 + 0.4 * jitter(e + 9)), ang + since * 9, SHAVINGS[e % 3], 1 - smooth((since - 0.3) / 0.2));
    }
  });
}

/** A strike landing: a puff of dust and bits of moss off the blow. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Spiral, b: Bones, t: number, front: boolean): void {
  const since = (t - SPIRAL_HITS[s.stage]) * ACT_SECS.strike;
  if (since <= 0 || since > 0.45) return;
  const big = 0.7 + 0.4 * s.stage, mid = b.body.t;
  const at = place(b.head, [0, s.trunk.root[1] + s.trunk.len * 2, s.trunk.root[2] - s.trunk.len * 2]);
  for (let q = 0; q < 6 + 3 * s.stage; q++) {
    const ang = jitter(q + 11) * TAU, sp = (0.4 + 0.7 * jitter(q + 3)) * big;
    const p: V3 = [at[0] + Math.cos(ang) * sp * since, at[1] + Math.sin(ang) * sp * since, Math.max(0.02, at[2] + (1 + jitter(q + 5)) * big * since - 4.5 * since * since)];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    curl(g, x, y, 0.04 * big, ang + since * 12, q % 3 ? SHAVINGS[q % 3] : MOSSY[q % 2], 1 - smooth((since - 0.25) / 0.2));
  }
}

/** Evolving: shavings and moss swirling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Spiral, b: Bones, t: number, front: boolean): void {
  const big = 0.7 + 0.4 * s.stage, mid = b.body.t, B = s.body;
  const al = ramp(t, 0.06, 0.16) * (1 - ramp(t, 0.46, 0.52));
  if (al <= 0) return;
  const rx = B.w[3] * 1.8 + 0.2 * big, ry = (B.y[5] - B.y[1]) * 0.75 + 0.2 * big, high = B.h[3] * 4 + 0.4 * big;
  for (let q = 0; q < 18; q++) {
    const u = clamp((t - 0.06 - 0.1 * jitter(q + 13)) / 0.36), ang = (q / 18) * TAU + u * TAU * 1.4, k = (1 - u) ** 1.2;
    const p = place(b.body, [Math.cos(ang) * rx * k, Math.sin(ang) * ry * k, u * high * 0.6 - B.h[3]]);
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    curl(g, x, y, 0.045 * big * (1 - 0.4 * u), ang * 2, q % 3 ? SHAVINGS[q % 3] : MOSSY[q % 2], al * ramp(u, 0, 0.15));
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

function spiralKind(s: Spiral): Kind {
  return {
    bones: spiralBones(s),
    build: (lod) => spiralBuild(s, lod),
    // The variant's coat is its hide's grey-lavender and its markings the cream of its coat and spiral; the wood, the gold-green,
    // the moss, the pink of its ears and the amber of its eyes the same on every variant.
    palette: (coat, mark) => {
      const hide = coat, cream = mix(mark, [214, 160, 100], 0.22);
      return coatPalette(coat, mark, {
        coat: hide,
        coatDark: mix(hide, [60, 50, 72], 0.3),
        coatLight: mix(hide, [236, 226, 236], 0.32),
        mark: cream,
        belly: mix(cream, [168, 126, 86], 0.3),
        muzzle: mix(cream, [222, 170, 160], 0.45),
        inner: [206, 150, 150],
        lid: [70, 56, 66],
        eye: [40, 26, 20],
        cap: [222, 146, 44],
        glint: [255, 253, 246],
        nose: [92, 70, 84],
        claw: mix(cream, [255, 250, 236], 0.3),
        tooth: [248, 238, 214],
        hornDark: [206, 188, 160],
        wood: [232, 196, 140],
        woodDark: [176, 128, 86],
        bark: [128, 88, 62],
        stem: [134, 94, 62],
        shell: [244, 210, 156],
        shellDark: [204, 156, 102],
        fitting: [214, 186, 84],
        moss: [102, 130, 40],
        leaf: [172, 198, 58],
        leafDark: [66, 90, 28],
      } as Partial<ReturnType<Kind['palette']>>);
    },
    shadow: [(s.body.y[5] - s.body.y[1]) * 0.55 + 0.1, s.body.w[3] * 1.2],
    stride: 1.4,
    size: s.size,
    blinks: 5,
    acts: ['strike', 'work'],
    motes: [[232, 196, 140], [182, 206, 62]],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (act?.kind === 'work') workBits(g, view, s, b, act.t, front);
      else if (act?.kind === 'strike') strikeBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const SPIRALCALF = spiralKind(SPIRALCALF_LOOK);
export const SPIRALTRUNK = spiralKind(SPIRALTRUNK_LOOK);
export const SPIRALPHANT = spiralKind(SPIRALPHANT_LOOK);
