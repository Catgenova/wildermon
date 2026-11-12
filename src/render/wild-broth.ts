import {
  ACT_SECS, add, beat, clamp, coatPalette, cross, curve, cyc, DEG, disc, dot, drift, frac, lerp, merge, mix, onEgg, orb, orbAlong,
  paint, scale, shadowOf, smooth, sub, TAU, trunkOf, tube, unit, type Anim, type Bones, type Disc, type Kind, type Piece,
} from './beasts';
import { css, cut, hump, jitter, mixV, nearSide, ramp } from './beastkit';
import { joint, mesh, onScreen, place, ROOT, type Face, type Mat, type Mesh, type RGB, type V3, type View, type Xf } from './figure';

/**
 * The broth line: the Brothlet, a small round toad sitting up, green with
 * darker green spots and a cream belly, golden eyes, a wide open smiling mouth
 * pink inside, a big cream pouch bulging under its chin, a little puffy white
 * chef's hat, a red neckerchief knotted at the back and a little white apron
 * trimmed red tied on its belly; which grows into the Stockbelly, bigger and
 * broader, a tall hat, its pouch now a great clear glass ball of orange broth
 * with diced vegetables and a sprig of herbs in it, its neckerchief knotted at
 * the front and its apron bigger; and then the Cauldronthroat, very large and
 * wide, head up and mouth open under a huge hat, an enormous ball of stew with
 * greens and two mushrooms, a big red cape over its shoulders tied in a bow,
 * a white leaf on it, a white cloth hanging at its side and an apron with a
 * crossed spoon and fork on it, on thick legs and splayed webbed feet. The
 * species is still `simma` underneath, as saves and the database know it: the
 * cook, that cooks from your stores at your lit campfires and ovens.
 *
 * Built the way the toad line is (`./wild-toad`): one set of functions from a
 * description of the stage (`Broth`), every foot given a point on the ground
 * to be at and its leg bent to reach it. The looks give the hips, the head and
 * the throat where they stand when it sits (`Stand`), and the body is tipped
 * up behind them, so it sits up as a cook does at its pot. It goes in squat
 * hops, at a walk and a run.
 *
 * Its broth is broth: the ball a clear glass skin, and in it a body of orange
 * broth deepening toward its middle whose top stays level in the world as the
 * toad rolls and pitches, sloshing as it goes, its bits of vegetable swaying
 * with it; a big soft highlight over the top. At its task it sits at a pot
 * set before it and stirs it round with a wooden spoon held in its right
 * forepaw, steam rising from the pot, the broth in its throat going round
 * with the spoon.
 */

/* ---- a stage, as numbers ------------------------------------------------------------- */

/** Rings along a body: where each is along it and how high, how wide and how deep. */
interface Rings { y: number[]; z: number[]; w: number[]; h: number[] }

/** A leg: its hip or shoulder, its two lengths, where its foot stands, its foot, how thick, how far its foot is turned out. */
interface Leg {
  hip: V3;
  len: [number, number];
  /** Where the ball of its foot stands, across and along, from under the body's middle. */
  at: [number, number];
  /** Heel (or wrist) to the ball of the foot; each toe's length; how many toes. */
  foot: number; toe: number; toes: number;
  /** How thick (a radius). */
  w: number;
  /** How far the foot is turned out from the way the body faces (degrees). */
  turn: number;
}

/**
 * A stage. Where it is marked `Stand`, a point is given where it is when the toad sits, across, forward and up from the
 * ground under the body's middle, and taken into the body's frame once (`brothKind`); the head's pitch likewise is its
 * pitch in the world, sitting.
 */
interface Broth {
  stage: 0 | 1 | 2;
  body: Rings;
  marks?: Rings;
  /** How high the body's middle is carried, and how far its front is tipped up (degrees): sitting up. */
  high: number;
  tilt: number;
  /**
   * The head: where it joins the body (`Stand`), how far forward and up its middle is from there, its half-sizes, how far the
   * mouth line is below its middle (a share of its height), how far its corners turn up, its pitch, and how far its mouth hangs
   * open (degrees).
   */
  head: { at: V3; fwd: number; up: number; r: V3; mouth: number; smile: number; pitch: number; gape: number };
  eye: { at: V3; dome: number; size: number; lid: number; round: number };
  /** Fore and hind legs, their hips `Stand`. */
  fore: Leg;
  hind: Leg;
  claws: boolean;
  /** Webbing between its toes: on the hind feet, or on all four. */
  webs: 0 | 1 | 2;
  /**
   * Its throat, a frog's sac swelled out from under its chin: its middle from the front of its chin, forward and up (its
   * top tucked under the jaw), carried level; a cream pouch, or a glass ball of broth and how full, and how many mushrooms in it.
   */
  orb: { c: V3; r: V3; glass: boolean; fill: number; mush: number };
  /** Its hat, in the head's frame: how far back on the skull, its band's radius and height, its top's radius and height, puffs round it. */
  hat: { back: number; lean: number; band: [number, number]; top: [number, number]; puffs: number };
  /** Its neckerchief: where along the body, how wide, and round where its knot is (radians from its right side, a quarter turn its back). */
  scarf: { y: number; w: number; knot: number } | null;
  /** Its cape over its shoulders, tied in a bow at its right shoulder, with a white cloth hanging under the bow. */
  cape: { y: [number, number]; drop: number } | null;
  /** Its apron: from and to along the body (its front and its foot), how far round either side (radians), its spoon and fork. */
  apron: { y: [number, number]; half: number; emblem: boolean };
  /** The pot it stirs (`Stand`, its middle on the ground), its radius and height, and the spoon's length. */
  pot: { at: [number, number]; r: number; h: number; spoon: number };
  gait: { hop: number; walk: number; swing: number; jiggle: number };
  size: number;
}

/** A Brothlet: small and round, sitting up, a big cream pouch under its chin, a little hat, a neckerchief knotted behind and a little apron. */
const BROTHLET_LOOK: Broth = {
  stage: 0,
  body: { y: [-0.46, -0.38, -0.18, 0, 0.18, 0.32, 0.4], z: [0.02, 0.02, 0.01, 0, 0, 0.02, 0.04], w: [0.74, 1.0, 1.04, 0.98, 0.86, 0.68, 0.42], h: [0.44, 0.58, 0.6, 0.56, 0.5, 0.42, 0.28] },
  high: 0.5, tilt: 40,
  head: { at: [0, 0.24, 0.98], fwd: 0.12, up: 0.08, r: [0.74, 0.52, 0.42], mouth: 0.12, smile: 0.16, pitch: 10, gape: 14 },
  eye: { at: [0.5, 0.3, 0.62], dome: 0.19, size: 0.18, lid: 0.04, round: 0.9 },
  fore: { hip: [0.54, 0.5, 0.2], len: [0.13, 0.12], at: [0.62, 0.72], foot: 0.06, toe: 0.1, toes: 4, w: 0.09, turn: 26 },
  hind: { hip: [0.72, -0.1, 0.28], len: [0.27, 0.25], at: [0.98, 0.22], foot: 0.1, toe: 0.12, toes: 4, w: 0.15, turn: 40 },
  claws: false,
  webs: 0,
  orb: { c: [0, 0.11, -0.2], r: [0.74, 0.52, 0.44], glass: false, fill: 0, mush: 0 },
  hat: { back: 0.4, lean: 14, band: [0.26, 0.12], top: [0.33, 0.28], puffs: 6 },
  scarf: { y: 0.04, w: 0.09, knot: Math.PI * 0.62 },
  cape: null,
  apron: { y: [0.12, -0.3], half: 0.62, emblem: false },
  pot: { at: [0.76, 0.84], r: 0.22, h: 0.24, spoon: 0.56 },
  gait: { hop: 0.55, walk: 0.38, swing: 0.3, jiggle: 0.07 },
  size: 3.4,
};

/** A Stockbelly: bigger and broader, sitting up, a tall hat, a great glass ball of broth under its chin, its neckerchief knotted in front, a bigger apron. */
const STOCKBELLY_LOOK: Broth = {
  stage: 1,
  body: { y: [-0.7, -0.58, -0.28, 0, 0.28, 0.48, 0.6], z: [0.02, 0.02, 0, 0, -0.02, 0, 0.02], w: [0.8, 1.18, 1.32, 1.3, 1.18, 0.96, 0.58], h: [0.62, 0.86, 0.92, 0.86, 0.76, 0.62, 0.4] },
  high: 0.84, tilt: 44,
  head: { at: [0, 0.35, 1.64], fwd: 0.16, up: 0.12, r: [0.98, 0.72, 0.54], mouth: 0.12, smile: 0.2, pitch: 10, gape: 13 },
  eye: { at: [0.5, 0.34, 0.62], dome: 0.25, size: 0.22, lid: 0.08, round: 0.9 },
  fore: { hip: [0.84, 0.72, 0.3], len: [0.24, 0.22], at: [1.0, 1.08], foot: 0.11, toe: 0.19, toes: 4, w: 0.15, turn: 26 },
  hind: { hip: [1.0, -0.25, 0.42], len: [0.48, 0.44], at: [1.4, 0.2], foot: 0.18, toe: 0.19, toes: 4, w: 0.25, turn: 40 },
  claws: false,
  webs: 1,
  orb: { c: [0, 0.16, -0.3], r: [1.18, 0.82, 0.64], glass: true, fill: 0.68, mush: 0 },
  hat: { back: 0.42, lean: 12, band: [0.44, 0.28], top: [0.58, 0.64], puffs: 8 },
  scarf: { y: 0.24, w: 0.08, knot: -0.25 },
  cape: null,
  apron: { y: [0.14, -0.5], half: 0.66, emblem: false },
  pot: { at: [1.15, 1.25], r: 0.36, h: 0.36, spoon: 0.86 },
  gait: { hop: 0.42, walk: 0.3, swing: 0.28, jiggle: 0.08 },
  size: 4.1,
};

/** A Cauldronthroat: very large and wide, head up, a huge hat, an enormous ball of stew, a red cape tied in a bow, a hanging cloth, an apron with a spoon and fork. */
const CAULDRONTHROAT_LOOK: Broth = {
  stage: 2,
  body: { y: [-1.0, -0.86, -0.42, 0, 0.42, 0.72, 0.88], z: [0.04, 0.04, 0.02, 0, 0, 0.02, 0.04], w: [1.1, 1.66, 1.9, 1.88, 1.72, 1.36, 0.8], h: [0.8, 1.1, 1.16, 1.06, 0.96, 0.8, 0.52] },
  high: 1.1, tilt: 42,
  head: { at: [0, 0.45, 2.3], fwd: 0.2, up: 0.12, r: [1.14, 0.84, 0.66], mouth: 0.12, smile: 0.22, pitch: 14, gape: 16 },
  eye: { at: [0.5, 0.36, 0.62], dome: 0.28, size: 0.25, lid: 0.16, round: 0.88 },
  fore: { hip: [1.2, 1.0, 0.4], len: [0.36, 0.32], at: [1.42, 1.5], foot: 0.15, toe: 0.24, toes: 4, w: 0.25, turn: 28 },
  hind: { hip: [1.4, -0.36, 0.55], len: [0.64, 0.58], at: [1.98, 0.2], foot: 0.24, toe: 0.27, toes: 4, w: 0.38, turn: 42 },
  claws: true,
  webs: 2,
  orb: { c: [0, 0.2, -0.38], r: [1.6, 1.04, 0.8], glass: true, fill: 0.7, mush: 2 },
  hat: { back: 0.42, lean: 10, band: [0.6, 0.34], top: [0.8, 0.86], puffs: 9 },
  scarf: null,
  cape: { y: [0.8, -0.86], drop: 0.95 },
  apron: { y: [0.1, -0.7], half: 0.62, emblem: true },
  pot: { at: [1.7, 1.75], r: 0.48, h: 0.5, spoon: 1.16 },
  gait: { hop: 0.28, walk: 0.2, swing: 0.24, jiggle: 0.08 },
  size: 4.7,
};

/* ---- helpers ------------------------------------------------------------------------- */

/** A ring dying away after a knock, `since` seconds after it. */
const ringOut = (since: number, k: number, f = 2.6, damp = 3): number => (since < 0 ? 0 : k * Math.exp(-since * damp) * Math.sin(since * TAU * f));
const SIDE = [-1, 1, -1, 1];
const LEGS4 = ['fl', 'fr', 'hl', 'hr'];
const len3 = (v: V3): number => Math.hypot(v[0], v[1], v[2]);

/** A point where it is when the toad sits (`Stand`), in the body's frame. */
function toBody(s: Pick<Broth, 'tilt' | 'high'>, p: V3): V3 {
  const a = s.tilt * DEG, c = Math.cos(a), sn = Math.sin(a), z = p[2] - s.high;
  return [p[0], p[1] * c + z * sn, -p[1] * sn + z * c];
}
/** A way in the world, sitting, in the body's frame. */
function dirToBody(s: Pick<Broth, 'tilt'>, d: V3): V3 {
  const a = s.tilt * DEG, c = Math.cos(a), sn = Math.sin(a);
  return [d[0], d[1] * c + d[2] * sn, -d[1] * sn + d[2] * c];
}

function onRings(R: Rings, y: number, th: number): { p: V3; n: V3 } {
  let k = 0;
  while (k < R.y.length - 2 && R.y[k + 1] < y) k++;
  const dy = R.y[k + 1] - R.y[k], f = clamp((y - R.y[k]) / dy);
  const w = lerp(R.w[k], R.w[k + 1], f), h = lerp(R.h[k], R.h[k + 1], f), z = lerp(R.z[k], R.z[k + 1], f);
  const c = Math.cos(th), s = Math.sin(th);
  const slope = -((c * c * (R.w[k + 1] - R.w[k])) / w + (s * (R.z[k + 1] - R.z[k])) / h + (s * s * (R.h[k + 1] - R.h[k])) / h) / dy;
  return { p: [w * c, y, z + h * s], n: unit([c / w, slope, s / h]) };
}
function ringAt(R: Rings, y: number): { w: number; h: number; z: number } {
  let k = 0;
  while (k < R.y.length - 2 && R.y[k + 1] < y) k++;
  const f = clamp((y - R.y[k]) / (R.y[k + 1] - R.y[k]));
  return { w: lerp(R.w[k], R.w[k + 1], f), h: lerp(R.h[k], R.h[k + 1], f), z: lerp(R.z[k], R.z[k + 1], f) };
}
/** A point on the body, `off` out from it. */
const onBody = (s: Broth, y: number, th: number, off: number): { p: V3; n: V3 } => { const q = onRings(s.body, y, th); return { p: add(q.p, scale(q.n, off)), n: q.n }; };

function frameOf(up: V3, fwd: V3): [V3, V3, V3] {
  const Z = unit(up);
  let Y = sub(fwd, scale(Z, dot(fwd, Z)));
  if (len3(Y) < 1e-4) Y = sub([0, 0, 1], scale(Z, Z[2]));
  Y = unit(Y);
  return [cross(Y, Z), Y, Z];
}
const xfOf = (X: V3, Y: V3, Z: V3, t: V3): Xf => ({ m: [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]], t });
const turn = (x: Xf, v: V3): V3 => { const m = x.m; return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; };
/** A frame scaled along its own three axes. */
const scaled = (x: Xf, k: V3): Xf => { const m = x.m; return { m: [m[0] * k[0], m[1] * k[1], m[2] * k[2], m[3] * k[0], m[4] * k[1], m[5] * k[2], m[6] * k[0], m[7] * k[1], m[8] * k[2]], t: x.t }; };

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

function facingDisc(pts: V3[], n: V3, m: Mat, o: { lit?: boolean } = {}): Disc {
  let nx = 0, ny = 0, nz = 0;
  for (let c = 0; c < pts.length; c++) {
    const p = pts[c], r = pts[(c + 1) % pts.length];
    nx += (p[1] - r[1]) * (p[2] + r[2]);
    ny += (p[2] - r[2]) * (p[0] + r[0]);
    nz += (p[0] - r[0]) * (p[1] + r[1]);
  }
  return { v: nx * n[0] + ny * n[1] + nz * n[2] < 0 ? [...pts].reverse() : pts, m, lit: o.lit };
}

/** A painted band along a run of points on a surface, `w` wide (half), each point's way out given. */
function lineOn(pts: ReadonlyArray<{ p: V3; n: V3 }>, w: number | readonly number[], m: Mat, lift = 0.012): Disc {
  const at = (k: number): number => (typeof w === 'number' ? w : w[Math.min(k, w.length - 1)]);
  const up = (q: { p: V3; n: V3 }, k: number, sd: number): V3 => {
    const K = pts.length, d = unit(sub(pts[Math.min(K - 1, k + 1)].p, pts[Math.max(0, k - 1)].p));
    const side = unit(cross(q.n, d));
    return add(add(q.p, scale(q.n, lift)), scale(side, sd * at(k)));
  };
  const v = [...pts.map((q, k) => up(q, k, 1)), ...[...pts].map((q, k) => up(q, k, -1)).reverse()];
  return facingDisc(v, pts.reduce((t, q) => add(t, q.n), [0, 0, 0] as V3), m);
}

/** A thin flat thing along a line of points -- a leaf, a ribbon's end -- `widths` across it, its face along `face`, folded a little down its middle. */
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
  return mesh(v, woundTo(v, f, want));
}

/** A sheet of quads over a grid of points (rows by columns), faces wound out along `out` and painted `mat(row, col)`. */
function gridMesh(rows: V3[][], out: (p: V3) => V3, mat: (r: number, c: number) => Mat): Mesh {
  const v: V3[] = [], f: Face[] = [], want: V3[] = [], C = rows[0].length;
  rows.forEach((row) => v.push(...row));
  for (let r = 0; r < rows.length - 1; r++) {
    for (let c = 0; c < C - 1; c++) {
      const a = r * C + c, b = a + 1, d = a + C, e = d + 1;
      f.push({ i: [a, b, e, d], m: mat(r, c) });
      want.push(out(scale(add(add(v[a], v[b]), add(v[d], v[e])), 0.25)));
    }
  }
  return mesh(v, woundTo(v, f, want));
}

/** A body's rings rounded off at its ends, as the end of an egg is. */
function rounded(R: Rings): Rings {
  const n = R.y.length, y0 = R.y[0], y1 = R.y[n - 1], mid = (y0 + y1) / 2, half = (y1 - y0) / 2;
  const core: Rings = { y: R.y.slice(1, n - 1), z: R.z.slice(1, n - 1), w: R.w.slice(1, n - 1), h: R.h.slice(1, n - 1) };
  const out: Rings = { y: [], z: [], w: [], h: [] }, N = 14, p = 2.4;
  for (let k = 0; k <= N; k++) {
    const u = -Math.cos((Math.PI * k) / N), y = mid + half * u, c = ringAt(core, clamp(y, core.y[0], core.y[core.y.length - 1]));
    const cap = Math.max(0.12, (1 - Math.abs(u) ** p) ** (1 / p));
    out.y.push(y);
    out.z.push(c.z);
    out.w.push(c.w * cap);
    out.h.push(c.h * cap);
  }
  return out;
}

function arc(a: V3, b: V3, u: number, up: number): V3 {
  const e = smooth(u);
  return [lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e) + up * Math.sin(Math.PI * clamp(u))];
}
/** A smooth run through keys (time, value), times nought to one in order, held at either end. */
function keysAt(keys: ReadonlyArray<readonly [number, number]>, u: number): number {
  if (u <= keys[0][0]) return keys[0][1];
  for (let q = 0; q < keys.length - 1; q++) {
    const [t0, v0] = keys[q], [t1, v1] = keys[q + 1];
    if (u <= t1) return lerp(v0, v1, smooth((u - t0) / Math.max(1e-6, t1 - t0)));
  }
  return keys[keys.length - 1][1];
}
/** A smooth loop through keys (time, value), times nought to one in order, wrapping round. */
function loopCurve(keys: ReadonlyArray<readonly [number, number]>, u: number): number {
  const w = frac(u), n = keys.length;
  let i = n - 1;
  for (let q = 0; q < n; q++) if (keys[q][0] <= w) i = q;
  const [t0, v0] = keys[i], [t1raw, v1] = keys[(i + 1) % n];
  const t1 = i + 1 < n ? t1raw : t1raw + 1, ww = w < t0 ? w + 1 : w;
  return lerp(v0, v1, smooth((ww - t0) / Math.max(1e-6, t1 - t0)));
}

/* ---- its moves, in time ---------------------------------------------------------------------- */

/** When each stage's strike lands, as a share of the strike: the Brothlet's bite, the bigger two's belly-slam. */
export const BROTH_HITS: readonly number[] = [0.5, 0.54, 0.56];
/** The Brothlet's mouth snapping open, and when the bigger two leave the ground, as shares of the strike. */
export const BROTH_STRIKE = { open: 0.38, rise: 0.26 } as const;
/**
 * A go at its task: the spoon goes once round the pot, starting at the near side; it scrapes the far side of the pot at
 * `scrape` and knocks the rim at `tap`, as shares of the go. It loops, so a go and the next are one.
 */
export const BROTH_WORK = { scrape: 0.5, tap: 0.94 } as const;
/** When it croaks as it sits about, in seconds into its loop, and for how long its throat swells. */
export const BROTH_CROAKS: readonly number[] = [5.4, 16.6];
export const BROTH_CROAK_LEN = 0.8;

/* ---- where its feet go ---------------------------------------------------------------- */

/**
 * A pose: where the ball of each foot is and how far its heel is lifted (degrees); how the body is carried; the head pitched
 * up, turned left and tilted; the jaw opened past its gape (degrees), and the throat swollen (nought to one).
 */
interface Plan {
  at: V3[]; foot: number[];
  H: number; surge: number; side: number; pitch: number; roll: number; yaw: number; squash: number;
  head: [number, number, number];
  jaw: number; throat: number;
}

interface Rest {
  hip: V3[]; ankle: V3[];
  legs: Array<[number, number]>;
  reach: number[];
  heel: number[];
}

const rests = new Map<Broth, Rest>();
const legOfI = (s: Broth, i: number): Leg => (i < 2 ? s.fore : s.hind);
function restOf(s: Broth): Rest {
  const had = rests.get(s);
  if (had) return had;
  const hip: V3[] = [], ankle: V3[] = [], reach: number[] = [], legs: Array<[number, number]> = [], heel: number[] = [];
  for (let i = 0; i < 4; i++) {
    const L = legOfI(s, i);
    hip.push([SIDE[i] * L.hip[0], L.hip[1], L.hip[2]]);
    ankle.push([SIDE[i] * L.at[0], L.at[1], 0]);
    reach.push(L.len[0] + L.len[1]);
    legs.push(L.len);
    heel.push(L.w * 0.5);
  }
  const R = { hip, ankle, legs, reach, heel };
  rests.set(s, R);
  return R;
}

function restPlan(s: Broth, R: Rest): Plan {
  return {
    at: R.ankle.map((a) => [...a] as V3), foot: [0, 0, 0, 0],
    H: s.high, surge: 0, side: 0, pitch: 0, roll: 0, yaw: 0, squash: 0,
    head: [0, 0, 0], jaw: 0, throat: 0,
  };
}

function mixPlan(a: Plan, b: Plan, k: number): Plan {
  const m = (x: number, y: number): number => lerp(x, y, k);
  return {
    at: a.at.map((x, i) => mixV(x, b.at[i], k)), foot: a.foot.map((x, i) => m(x, b.foot[i])),
    H: m(a.H, b.H), surge: m(a.surge, b.surge), side: m(a.side, b.side), pitch: m(a.pitch, b.pitch), roll: m(a.roll, b.roll), yaw: m(a.yaw, b.yaw), squash: m(a.squash, b.squash),
    head: [m(a.head[0], b.head[0]), m(a.head[1], b.head[1]), m(a.head[2], b.head[2])],
    jaw: m(a.jaw, b.jaw), throat: m(a.throat, b.throat),
  };
}

function shifted(p: Plan, to: Plan, from: Plan): Plan {
  const d = (x: number, a: number, b: number): number => x + a - b;
  return {
    at: p.at.map((x, i) => [d(x[0], to.at[i][0], from.at[i][0]), d(x[1], to.at[i][1], from.at[i][1]), d(x[2], to.at[i][2], from.at[i][2])] as V3),
    foot: p.foot.map((x, i) => d(x, to.foot[i], from.foot[i])),
    H: d(p.H, to.H, from.H), surge: d(p.surge, to.surge, from.surge), side: d(p.side, to.side, from.side), pitch: d(p.pitch, to.pitch, from.pitch),
    roll: d(p.roll, to.roll, from.roll), yaw: d(p.yaw, to.yaw, from.yaw), squash: d(p.squash, to.squash, from.squash),
    head: [d(p.head[0], to.head[0], from.head[0]), d(p.head[1], to.head[1], from.head[1]), d(p.head[2], to.head[2], from.head[2])],
    jaw: d(p.jaw, to.jaw, from.jaw), throat: d(p.throat, to.throat, from.throat),
  };
}

/** How big it is, front feet to hind: what its moves are measured in. */
const lenOf = (s: Broth): number => s.fore.at[1] - s.hind.at[1] + 0.3 * s.hind.at[0];

/** A hop, as shares of a stride: the hind feet down from nought to `HOP_LIFT`, the fore from `HOP_LAND` round to `HOP_UP`. */
const HOP_LIFT = 0.5, HOP_LAND = 0.72, HOP_UP = 0.25;

/**
 * Going, it hops, squat and heavy, at a walk and a run: crouched on all four, its hind legs heave it up and forward, it is in
 * the air a moment, hind legs trailing and its hat bobbing back, and it lands on its hands with a squash that runs through its
 * belly, its throat swinging, and draws its feet in under it. A walk is a lower hop than a run.
 */
function hopPlan(s: Broth, R: Rest, a: Anim): Plan {
  const G = s.gait, w = frac(a.u), L = lenOf(s), up = lerp(G.walk, G.hop, clamp(a.gait)) * s.high;
  const p = restPlan(s, R);
  for (let i = 0; i < 4; i++) {
    const fore = i < 2, reach = R.reach[i], half = reach * G.swing * (fore ? 0.7 : 1), A = R.ankle[i];
    const start = fore ? HOP_LAND : 0, duty = fore ? 1 - HOP_LAND + HOP_UP : HOP_LIFT;
    const ph = frac(w - start);
    if (ph < duty) {
      p.at[i] = [A[0], A[1] + half * (1 - (2 * ph) / duty), 0];
      p.foot[i] = fore ? 0 : 50 * ramp(ph / duty, 0.45, 1);
      continue;
    }
    const u = (ph - duty) / (1 - duty), R2 = reach;
    if (fore) {
      const y = keysAt([[0, A[1] - half], [0.3, A[1] + 0.1 * R2], [0.62, A[1] + half + 0.05 * R2], [0.7, A[1] + half], [1, A[1] + half]], u);
      p.at[i] = [A[0] * (1 - 0.08 * Math.sin(Math.PI * u)), y, up * keysAt([[0, 0], [0.3, 0.9], [0.62, 1.0], [0.84, 0.6], [1, 0]], u)];
      p.foot[i] = -14 * Math.sin(Math.PI * u);
    } else {
      const y = keysAt([[0, A[1] - half], [0.1, A[1] - half - 0.25 * R2], [0.32, A[1] - half - 0.9 * R2], [0.62, A[1] - 0.3 * R2], [1, A[1] + half]], u);
      p.at[i] = [A[0] * (1 - 0.06 * Math.sin(Math.PI * u)), y, up * keysAt([[0, 0], [0.1, 0.7], [0.32, 1.0], [0.6, 0.9], [0.86, 0.3], [1, 0]], u)];
      p.foot[i] = 50 * (1 - smooth(u / 0.5)) + 30 * hump(u, 0.3, 0.25) - 8 * hump(u, 0.8, 0.15);
    }
  }
  p.H = s.high + up * loopCurve([[0, -0.25], [0.24, -0.2], [0.46, 0.4], [0.58, 1], [0.7, 0.55], [0.78, -0.05], [0.88, -0.32]], w);
  p.pitch = loopCurve([[0, 2], [0.25, 3], [0.46, 10], [0.56, 2], [0.66, -6], [0.74, -9], [0.86, -4], [0.95, 0]], w);
  p.squash = G.jiggle * loopCurve([[0, 1.2], [0.12, 0.5], [0.3, 0.0], [0.46, -1], [0.56, -1.2], [0.68, -0.5], [0.76, 0.8], [0.82, 2], [0.9, 0.8]], w);
  p.surge = L * loopCurve([[0, -0.03], [0.4, 0.02], [0.6, 0.06], [0.8, 0.02]], w);
  p.head = [-0.6 * p.pitch + 2, 0, 0];
  p.jaw = -4 * hump(w, 0.82, 0.1);
  p.throat = 0.15 * hump(w, 0.84, 0.12);
  return p;
}

/** How far its throat swells this moment as it croaks sitting about, nought to one. */
function croakOf(t: number): number {
  let k = 0;
  for (const c of BROTH_CROAKS) {
    const u = (t - c) / BROTH_CROAK_LEN;
    if (u > -0.2 && u < 1.2) k = Math.max(k, ramp(u, 0, 0.25) * (1 - ramp(u, 0.75, 1)));
  }
  return k;
}

/**
 * Sitting about: breathing, its throat going in and out, looking about with its mouth open in a smile; twice a loop it
 * croaks, its throat swelling and its mouth opening wider; now and then it settles its weight, and smacks its lips.
 */
function stillPlan(s: Broth, R: Rest, a: Anim): Plan {
  const p = restPlan(s, R), t = a.t, L = lenOf(s);
  const look = drift(t);
  p.head = [2 * cyc(t, 5) + 2 * a.breath, 12 * look, 4 * drift(t, 2)];
  p.H += 0.012 * L * (a.breath - 0.5);
  p.squash = 0.02 * (0.5 - a.breath);
  p.throat = 0.06 + 0.06 * Math.max(0, Math.sin(t * TAU * 0.8));
  const croak = croakOf(t);
  p.throat = Math.max(p.throat, croak);
  p.squash -= 0.04 * croak;
  p.head[0] += 6 * croak;
  p.jaw = 8 * croak;
  const settle = beat(t, [3.4, 12.0, 21.0], 0.7);
  p.H -= 0.03 * L * settle;
  p.squash += 0.05 * settle;
  // Its lips smacked: the mouth shut and opened twice.
  const smack = beat(t, [9.2], 0.6);
  p.jaw -= s.head.gape * 0.8 * Math.abs(Math.sin(smack * Math.PI * 2)) * (smack > 0 ? 1 : 0);
  return p;
}

/* ---- its strike ------------------------------------------------------------------------------- */

/** The Brothlet's bite: drawn back into a crouch, a hop forward with its mouth wide, snapped shut on what is in front of it, and back. */
function lungeBite(s: Broth, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = BROTH_HITS[0], L = lenOf(s);
  const back = ramp(t, 0.04, 0.3) * (1 - ramp(t, 0.34, 0.44));
  const lunge = ramp(t, 0.34, 0.48) * (1 - ramp(t, 0.62, 0.96));
  const air = hump(t, 0.42, 0.08), jolt = hump(t, hit + 0.03, 0.06);
  p.surge = L * (-0.18 * back + 0.5 * lunge);
  p.H += L * (-0.1 * back + 0.3 * air);
  p.pitch = 6 * back - 14 * lunge + 6 * air;
  p.head = [8 * back - 4 * lunge, 0, 0];
  p.squash = 0.1 * back - 0.06 * air + 0.1 * jolt;
  p.jaw = 30 * ramp(t, BROTH_STRIKE.open, hit - 0.05) * (1 - ramp(t, hit - 0.03, hit)) - s.head.gape * hump(t, hit + 0.02, 0.05);
  for (const i of [0, 1]) {
    const A = R.ankle[i], fwd: V3 = [A[0], A[1] + L * 0.3, 0];
    const go = ramp(t, 0.36, hit), ret = ramp(t, 0.68 + 0.05 * i, 0.94);
    p.at[i] = t < 0.62 ? arc(A, fwd, go, R.reach[i] * 0.35) : arc(fwd, A, ret, R.reach[i] * 0.25);
  }
  for (const i of [2, 3]) p.foot[i] = 30 * hump(t, 0.4, 0.1);
  return p;
}

/** The bigger two's belly-slam: crouched, then a heavy hop up and forward, and down on its belly onto what is in front of it. */
function bellySlam(s: Broth, R: Rest, t: number): Plan {
  const p = restPlan(s, R), hit = BROTH_HITS[s.stage], L = lenOf(s);
  const crouch = ramp(t, 0.04, 0.24) * (1 - ramp(t, BROTH_STRIKE.rise, 0.34));
  const air = ramp(t, BROTH_STRIKE.rise, 0.42) * (1 - ramp(t, 0.44, hit));
  const slam = ramp(t, 0.44, hit) * (1 - ramp(t, hit + 0.12, 0.96));
  const jolt = hump(t, hit + 0.03, 0.07);
  p.surge = L * (-0.08 * crouch + 0.14 * air + 0.22 * slam);
  p.H += L * (-0.08 * crouch + 0.3 * air - 0.08 * slam);
  p.pitch = -4 * crouch + 10 * air - 14 * slam;
  p.head = [6 * crouch - 6 * air + 10 * slam, 0, 0];
  p.squash = 0.1 * crouch - 0.08 * air + 0.22 * jolt + 0.04 * slam;
  p.jaw = 12 * air;
  p.throat = 0.4 * air;
  for (let i = 0; i < 4; i++) {
    const A = R.ankle[i], fore = i < 2, out: V3 = [A[0] * 1.08, A[1] + L * (fore ? 0.26 : 0.14), 0];
    if (t < hit) p.at[i] = mixV(A, out, ramp(t, 0.3, hit - 0.02));
    else p.at[i] = arc(out, A, ramp(t, 0.7 + 0.05 * i, 0.94 + 0.01 * i), R.reach[i] * 0.2);
    p.at[i][2] += R.reach[i] * (fore ? 0.3 : 0.15) * air;
    p.foot[i] = fore ? -10 * air : 40 * hump(t, BROTH_STRIKE.rise + 0.04, 0.08);
  }
  return p;
}

/* ---- its task ----------------------------------------------------------------------------------- */

/** How far it is set to its task: eased in and out of a go played once, and held while it works on. */
const downOf = (t: number, graze: number): number => Math.max(graze, ramp(t, 0, 0.08) * (1 - ramp(t, 0.92, 1)));
/** Where the spoon is round the pot, in radians from its near side, going round the way a clock's hands do seen from above. */
const stirAngle = (t: number): number => -Math.PI / 2 - TAU * t;

/** The pot's middle on the ground (`Stand`, so sitting it is where it was put). */
const potAt = (s: Broth): V3 => [s.pot.at[0], s.pot.at[1], 0];
/** Where the bowl of the spoon is in the pot this moment: round in the broth, a little under its top. */
function bowlAt(s: Broth, t: number): V3 {
  const P = s.pot, a = stirAngle(t), r = P.r * 0.5, c = potAt(s);
  return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a), P.h * 0.62];
}
/** The way the spoon's handle runs up from its bowl through its forepaw: back toward the body, leant a little as it goes round. */
function handleDir(t: number): V3 {
  const a = stirAngle(t);
  return unit([-0.4 + 0.1 * Math.cos(a), -0.4 + 0.1 * Math.sin(a), 1]);
}
/** How far up the spoon from its bowl its forepaw holds it, as a share of its length: low, the handle standing up out of its paw. */
const GRIP = 0.36;
/** Where its right forepaw holds the spoon this moment. */
const gripAt = (s: Broth, t: number): V3 => add(bowlAt(s, t), scale(handleDir(t), s.pot.spoon * GRIP));

/**
 * A go at its task: sat at its pot, its right forepaw up holding the spoon in it and going round the pot, its body leaning
 * after it, its head bowed to the pot and turning a little as the spoon goes round; the broth in its throat goes round with it.
 */
function workPlan(s: Broth, R: Rest, t: number, down: number): Plan {
  const p = restPlan(s, R), a = stirAngle(t);
  const across = Math.cos(a), along = Math.sin(a);
  p.pitch = -5 + 2 * along;
  p.yaw = -10 - 4 * across;
  p.roll = 3 + 2 * across;
  p.side = 0.03 * lenOf(s) * across;
  p.head = [-16 + 3 * along, -6 - 6 * across, 3 * across];
  p.throat = 0.1;
  p.jaw = 4 * hump(t, BROTH_WORK.tap, 0.06);
  p.squash = 0.03 * hump(t, BROTH_WORK.scrape, 0.12);
  // Its weight on the other forepaw, a little further out.
  p.at[0] = add(R.ankle[0], [-0.04 * lenOf(s), 0.02 * lenOf(s), 0]);
  p.at[1] = gripAt(s, t);
  p.foot[1] = -20;
  return mixPlan(restPlan(s, R), p, down);
}

/** Evolving: hunched down small as the light gathers, then up tall at the turn with its throat swollen, a shake, and settled. */
function evolvePlan(s: Broth, R: Rest, t: number): Plan {
  const p = restPlan(s, R), L = lenOf(s);
  const hunch = ramp(t, 0.06, 0.36) * (1 - ramp(t, 0.36, 0.52)), up = ramp(t, 0.42, 0.58) * (1 - ramp(t, 0.72, 0.94));
  const shake = hump(t, 0.68, 0.1) * Math.sin(t * 60);
  p.H += L * (-0.06 * hunch + 0.06 * up);
  p.pitch = -6 * hunch + 6 * up;
  p.head = [-12 * hunch + 12 * up, 6 * shake, 10 * shake];
  p.roll = 4 * shake;
  p.squash = 0.1 * hunch - 0.06 * up + 0.08 * hump(t, 0.72, 0.05);
  p.throat = up;
  p.jaw = 10 * up - 10 * hunch;
  for (const i of [2, 3]) p.foot[i] = 20 * up;
  return p;
}

/** How much of a leg's reach any foot may take before the body is let down to it. */
const MOST_REACH = 0.94;

function heelOf(s: Broth, R: Rest, i: number, at: V3, lift: number): V3 {
  const L = legOfI(s, i), h = footHeading(i, L), F = L.foot, c = Math.cos(lift * DEG), sn = Math.sin(lift * DEG);
  return [at[0] - h[0] * F * c, at[1] - h[1] * F * c, at[2] + R.heel[i] + F * sn];
}
function footHeading(i: number, L: Leg): V3 {
  const a = SIDE[i] * -L.turn * DEG;
  return [-Math.sin(a), Math.cos(a), 0];
}

function seated(s: Broth, R: Rest, p: Plan): Plan {
  let drop = 0;
  const body = joint(ROOT, [p.side, p.surge, p.H], s.tilt + p.pitch, p.roll, p.yaw);
  const at = p.at.map((x) => [...x] as V3);
  for (let i = 0; i < 4; i++) {
    const hip = place(body, R.hip[i]), heel = heelOf(s, R, i, at[i], p.foot[i]), L = R.reach[i] * MOST_REACH;
    const d = sub(heel, hip), flat = d[0] * d[0] + d[1] * d[1], up = -d[2];
    if (flat + up * up <= L * L) continue;
    const need = up - Math.sqrt(Math.max(0, L * L - flat)), k = 1 - smooth(at[i][2] / (0.2 * R.reach[i]));
    drop = Math.max(drop, need * k);
  }
  const H = p.H - Math.max(0, drop);
  const body2 = joint(ROOT, [p.side, p.surge, H], s.tilt + p.pitch, p.roll, p.yaw);
  for (let i = 0; i < 4; i++) {
    const hip = place(body2, R.hip[i]), heel = heelOf(s, R, i, at[i], p.foot[i]), L = R.reach[i] * MOST_REACH;
    const d = sub(heel, hip), D = len3(d);
    if (D > L) at[i] = add(at[i], scale(d, L / D - 1));
  }
  return { ...p, at, H };
}

function posedOf(s: Broth, R: Rest, a: Anim): Plan {
  const act = a.act;
  const over = (p: Plan): Plan => shifted(p, stillPlan(s, R, a), restPlan(s, R));
  if (act?.kind === 'strike') return over((s.stage ? bellySlam : lungeBite)(s, R, act.t));
  if (act?.kind === 'work') return over(workPlan(s, R, act.t, downOf(act.t, a.graze)));
  if (act?.kind === 'evolve') return over(evolvePlan(s, R, act.t));
  if (a.graze > 0 && a.go <= 0) return over(workPlan(s, R, 0, a.graze));
  if (a.go <= 0) return stillPlan(s, R, a);
  const going = hopPlan(s, R, a);
  return a.go >= 1 ? going : mixPlan(stillPlan(s, R, a), going, smooth(a.go));
}

/**
 * The broth in its throat this moment: how far its top is tipped forward and to its left against level (degrees), how far
 * the ball is squashed (a wobble), and how far round its bits have been carried (radians). Sitting, it rocks a little; at
 * a hop it is thrown back as it leaves the ground and forward as it lands; struck or evolving, it sloshes after each knock;
 * stirring, it goes round after the spoon.
 */
function brothOf(s: Broth, a: Anim): { tilt: [number, number]; wobble: number; spin: number } {
  const act = a.act, big = [1, 0.85, 0.75][s.stage];
  let fwd = 3 * cyc(a.t, 4), left = 3 * cyc(a.t, 3, 1), wob = 0.012 * cyc(a.t, 9), spin = 0.15 * cyc(a.t, 2);
  const croak = croakOf(a.t);
  wob += 0.03 * croak * Math.sin(a.t * 20);
  if (a.go > 0 && !act) {
    const g = smooth(Math.min(1, a.go)), w = frac(a.u);
    const hopF = -14 * hump(w, 0.52, 0.16) + 18 * hump(w, 0.82, 0.14) - 6 * hump(w, 0.02, 0.1);
    const hopW = ringOut(frac(w - 0.74) * 0.5, 0.12, 4.2, 5) - 0.04 * hump(w, 0.55, 0.15);
    fwd = lerp(fwd, hopF, g);
    left = lerp(left, 4 * Math.sin(TAU * w), g);
    wob = lerp(wob, hopW, g);
  } else if (act?.kind === 'strike') {
    const since = (act.t - BROTH_HITS[s.stage]) * ACT_SECS.strike;
    fwd = -16 * hump(act.t, 0.3, 0.16) + ringOut(since, 26, 2.4);
    wob = ringOut(since, 0.18, 4, 4);
  } else if (act?.kind === 'work' || (a.graze > 0 && a.go <= 0)) {
    const t = act?.kind === 'work' ? act.t : 0, k = act?.kind === 'work' ? downOf(t, a.graze) : a.graze;
    // Going round after the spoon, a quarter of a turn behind it.
    const ang = stirAngle(t) - Math.PI / 2;
    fwd = lerp(fwd, 9 * Math.sin(ang), k);
    left = lerp(left, -9 * Math.cos(ang), k);
    wob = lerp(wob, 0.02 * Math.sin(t * TAU * 2), k);
    spin = lerp(spin, -TAU * t, k);
  } else if (act?.kind === 'evolve') {
    wob = 0.1 * hump(act.t, 0.7, 0.08) * Math.sin(act.t * 70) - 0.06 * hump(act.t, 0.3, 0.2);
    left = 18 * hump(act.t, 0.68, 0.1) * Math.sin(act.t * 60);
    spin = TAU * ramp(act.t, 0.2, 0.7);
  }
  return { tilt: [fwd * big, left * big], wobble: wob, spin };
}

/* ---- its bones ---------------------------------------------------------------------------------- */

/** A leg bent to put its heel (or wrist) at `ankle`: the hind leg's knee forward, out and up beside the body, the fore leg's elbow back and out. */
function legOf(s: Broth, R: Rest, body: Xf, i: number, ankle: V3, heading: V3, lift: number): [Xf, Xf, Xf] {
  const fore = i < 2, [l0, l1] = R.legs[i];
  const hip = place(body, R.hip[i]), fwd = turn(body, [0, 1, 0]);
  let d = sub(ankle, hip);
  const D = len3(d);
  const Dc = clamp(D, Math.abs(l0 - l1) + 0.05 * (l0 + l1), (l0 + l1) * 0.985);
  d = scale(d, 1 / (D || 1));
  const at = add(hip, scale(d, Dc));
  // The hint in the world, sitting: the elbow back and out, the knee forward, out and up.
  const hint = unit(fore ? [SIDE[i] * 0.75, -0.7, 0.1] : [SIDE[i] * 0.7, 0.75, 0.35]);
  const v = unit(sub(hint, scale(d, dot(hint, d))));
  const along = (l0 * l0 - l1 * l1 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, l0 * l0 - along * along));
  const knee = add(add(hip, scale(d, along)), scale(v, h));
  const [X0, Y0, Z0] = frameOf(sub(hip, knee), fwd), [X1, Y1, Z1] = frameOf(sub(knee, at), fwd);
  const [X2, Y2, Z2] = frameOf([0, 0, 1], heading);
  return [xfOf(X0, Y0, Z0, hip), xfOf(X1, Y1, Z1, knee), joint(xfOf(X2, Y2, Z2, at), [0, 0, 0], -lift)];
}

const skullAt = (s: Broth): V3 => [0, s.head.fwd, s.head.up];
const hingeAt = (s: Broth): V3 => { const H = s.head; return [0, H.fwd - H.r[1] * 0.8, H.up - H.r[2] * H.mouth]; };
/** The lower jaw's egg: the head's, narrower and flatter under the mouth line. */
const jawR = (s: Broth): V3 => [s.head.r[0] * 0.95, s.head.r[1], s.head.r[2] * 0.72];
/** The front of its chin, in the jaw's frame: where its throat swells out from. */
const chinAt = (s: Broth): V3 => sub(onEgg(skullAt(s), jawR(s), [0, 0.55, -0.84]).p, hingeAt(s));

/** The broth this moment, worked out once for an `Anim`. */
const posed = new WeakMap<Anim, { s: Broth; w: ReturnType<typeof brothOf> }>();
function brothNow(s: Broth, a: Anim): ReturnType<typeof brothOf> {
  const had = posed.get(a);
  if (had && had.s === s) return had.w;
  const w = brothOf(s, a);
  posed.set(a, { s, w });
  return w;
}

function brothBones(s: Broth): (a: Anim) => Bones {
  const R = restOf(s);
  const pose = (P: Plan, a: Anim): Bones => {
    const body = joint(ROOT, [P.side, P.surge, P.H], s.tilt + P.pitch, P.roll, P.yaw);
    const b: Bones = { body };
    b.trunk = P.squash >= 0 ? trunkOf(body, P.squash) : scaled(body, [1 + 0.35 * P.squash, 1 - 1.4 * P.squash, 1 + 0.35 * P.squash]);
    b.head = joint(body, s.head.at, s.head.pitch + P.head[0], P.head[2], P.head[1]);
    b.jaw = joint(b.head, hingeAt(s), -Math.max(0, s.head.gape + P.jaw));
    // The throat: hung from the front of its chin, so it goes where the head goes, but carried level in the world and turned
    // the way the body faces; swollen as it croaks and squashed as it wobbles.
    const W = brothNow(s, a), f = turn(body, [0, 1, 0]);
    const [X, Y, Z] = frameOf([0, 0, 1], [f[0], f[1], 0]), swell = 1 + (s.orb.glass ? 0.05 : 0.14) * P.throat;
    const c = add(place(b.jaw, chinAt(s)), add(scale(Y, s.orb.c[1]), scale(Z, s.orb.c[2] * swell)));
    b.orb = scaled(xfOf(X, Y, Z, c), [swell * (1 + W.wobble * 0.6), swell * (1 + W.wobble * 0.6), swell * (1 - W.wobble)]);
    for (let i = 0; i < 4; i++) {
      const L = legOfI(s, i), g = P.at[i];
      const heading = footHeading(i, L);
      const heel = heelOf(s, R, i, [g[0], g[1], Math.max(0, g[2])], P.foot[i]);
      const [u, l, ft] = legOf(s, R, body, i, heel, heading, P.foot[i]);
      b[`${LEGS4[i]}0`] = u;
      b[`${LEGS4[i]}1`] = l;
      b[`${LEGS4[i]}2`] = ft;
    }
    b.shadow = shadowOf(body, Math.max(0, P.H - s.high) * 2);
    return b;
  };
  return (a) => {
    const P = seated(s, R, posedOf(s, R, { ...a, go: a.act ? 0 : a.go }));
    const b = pose(P, a);
    const working = a.act?.kind === 'work' || (a.graze > 0 && a.go <= 0);
    if (working) {
      const t = a.act?.kind === 'work' ? a.act.t : 0, k = a.act?.kind === 'work' ? downOf(t, a.graze) : a.graze;
      const g = smooth((k - 0.03) / 0.5);
      if (g > 0.01) {
        b.site = { m: [g, 0, 0, 0, g, 0, 0, 0, g], t: potAt(s) };
        // The spoon in its right forepaw, its bowl down in the pot: from the paw toward where the bowl goes.
        const grip = place(b.fr2, [0, s.fore.foot * 0.9, 0]), to = bowlAt(s, t);
        const d = unit(sub(grip, to)), [X, Y, Z] = frameOf(d, [0, 1, 0]);
        b.spoon = scaled(xfOf(X, Y, Z, grip), [g, g, g]);
      }
    }
    return b;
  };
}

/* ---- what it is made of ------------------------------------------------------------------------- */

const marksOf = (s: Broth): Rings => s.marks ?? s.body;
/** How much a stage's small things are scaled, against the Stockbelly's. */
const bigOf = (s: Broth): number => s.body.w[Math.floor(s.body.w.length / 2)] / 1.24;

/** A painted blob lying on the body, every corner laid back onto the body's own curve. */
function blotOn(s: Broth, y: number, th: number, rx: number, ry: number, m: Mat, spin: number, id: number, sides = 9): Disc {
  const q = onRings(s.body, y, th), d = disc(add(q.p, scale(q.n, 0.01)), q.n, rx, ry, sides, m, { spin, up: [0, 0, 1] });
  return {
    ...d, v: d.v.map((v, k) => {
      const c = add(q.p, scale(sub(v, q.p), 0.82 + 0.3 * jitter(id * 13 + k)));
      const r = ringAt(s.body, c[1]), a = Math.atan2((c[2] - r.z) / r.h, c[0] / r.w);
      const e = onRings(s.body, c[1], a);
      return add(e.p, scale(e.n, 0.012 * bigOf(s)));
    }),
  };
}

/** Whether a point on the body is in its cream belly: under it (which, sitting up, is its front), and up its chest. */
function inBelly(s: Broth, c: V3): boolean {
  const M = marksOf(s), r = ringAt(s.body, c[1]), up = (c[2] - r.z) / r.h, front = (c[1] - M.y[3]) / (M.y[6] - M.y[3]);
  const across = Math.abs(c[0]) / r.w;
  return up < 0.05 - 0.35 * across * across || (front > 0 && across < 0.85 && up < 0.2 + 0.9 * front - 0.6 * across * across);
}

/** The body: green, cream down its front, spotted darker green over its back and flanks. */
function barrelOf(s: Broth, n: number): Mesh {
  const B = s.body;
  const m0 = tube(B.y.map((y, q) => [0, y, B.z[q]] as V3), B.w, B.h, n, 'coat');
  const body = mesh(m0.v, m0.f.map((f) => {
    const c = scale(f.i.reduce((t, i) => add(t, m0.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    return inBelly(s, c) ? { ...f, m: 'belly' as Mat } : f;
  }));
  const M = marksOf(s), spots: Disc[] = [];
  for (let q = 0; q < 30; q++) {
    const id = 300 + q * 7, sd = q % 2 ? 1 : -1;
    const y = lerp(M.y[1], M.y[5], jitter(id)), up = lerp(-0.05, 1.5, jitter(id + 1)), th = sd > 0 ? up : Math.PI - up;
    const r = ringAt(M, y), k = (0.05 + 0.1 * jitter(id + 2) ** 2) * r.w;
    if (inBelly(s, onRings(s.body, y, th).p)) continue;
    spots.push(blotOn(s, y, th, k * 1.25, k * 0.9, 'mark', jitter(id + 4) * 3, id));
  }
  // Small pale freckles.
  for (let q = 0; q < 8; q++) {
    const id = 700 + q * 5, sd = q % 2 ? 1 : -1;
    const y = lerp(M.y[1], M.y[5], jitter(id)), up = lerp(0.1, 1.3, jitter(id + 1)), th = sd > 0 ? up : Math.PI - up;
    const r = ringAt(M, y), k = (0.04 + 0.03 * jitter(id + 2)) * r.w;
    if (inBelly(s, onRings(s.body, y, th).p)) continue;
    spots.push(blotOn(s, y, th, k, k, 'coatLight', 0, id, 6));
  }
  const cream = paint(body.f.filter((f) => f.m === 'belly').map((f) => ({ v: f.i.map((i) => body.v[i]), m: 'belly' as Mat })));
  return merge(body, cream, paint(spots));
}

/* ---- the head ------------------------------------------------------------------------------- */

/** The height of the mouth line round the head at `phi` round from straight ahead (radians), in the head's frame: a wide smile. */
function mouthZ(s: Broth, phi: number): number {
  const H = s.head, k = clamp(Math.abs(phi) / 1.75);
  return H.up - H.r[2] * H.mouth + H.r[2] * (H.smile * k * k - 0.05 * (1 - k));
}

function eggBand(c: V3, r: V3, n: number, rows: number, top: (phi: number) => number, bottom: number, mat: (row: number, phi: number) => Mat, open: boolean): Mesh {
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  for (let k = 0; k <= rows; k++) {
    for (let j = 0; j < n; j++) {
      const phi = (j / n) * TAU - Math.PI;
      const z0 = clamp((top(phi) - c[2]) / r[2], -0.999, 0.999), th0 = Math.acos(z0), th = lerp(th0, Math.acos(bottom), k / rows);
      v.push([c[0] + r[0] * Math.sin(th) * Math.sin(phi), c[1] + r[1] * Math.sin(th) * Math.cos(phi), c[2] + r[2] * Math.cos(th)]);
    }
  }
  for (let k = 0; k < rows; k++) {
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n, a = k * n + j, b = k * n + j2, cc = (k + 1) * n + j2, d = (k + 1) * n + j;
      const mid = scale(add(add(v[a], v[b]), add(v[cc], v[d])), 0.25);
      f.push({ i: [a, b, cc, d], m: mat(k, ((j + 0.5) / n) * TAU - Math.PI) });
      want.push(sub(mid, c));
    }
  }
  if (!open) {
    f.push({ i: Array.from({ length: n }, (_, j) => j), m: mat(0, 0) });
    want.push([0, 0, 1]);
  }
  return mesh(v, woundTo(v, f, want));
}

/**
 * The head: a broad flat dome of green, spotted darker behind its eyes, two little nostrils and the line of its wide smile;
 * under the mouth line the roof of its mouth, pink, which shows as the jaw hangs open. Its eyes sit on low domes at the front
 * corners of the top of its head.
 */
function headOf(s: Broth, n: number, shut: boolean): Mesh {
  const H = s.head, C = skullAt(s);
  const top = eggBand(C, H.r, n + 4, 6, () => C[2] + H.r[2] * 0.999, -0.999, () => 'coat', true);
  const skull = mesh(top.v, top.f.map((f) => {
    const c = scale(f.i.reduce((t, i) => add(t, top.v[i]), [0, 0, 0] as V3), 1 / f.i.length);
    const phi = Math.atan2(c[0] - C[0], c[1] - C[1]);
    return c[2] < mouthZ(s, phi) - H.r[2] * 0.06 ? { ...f, m: 'inner' as Mat } : f;
  }));
  const out: Mesh[] = [skull], blots: Disc[] = [];
  for (const [x, y, z, k] of [[0.62, -0.5, 0.5, 0.15], [-0.62, -0.5, 0.5, 0.15], [0.35, 0.15, 0.88, 0.09], [-0.3, -0.1, 0.92, 0.08], [0.8, 0.0, 0.25, 0.08], [-0.8, 0.05, 0.25, 0.08]] as Array<[number, number, number, number]>) {
    const e = onEgg(C, H.r, [x, y, z]);
    blots.push(disc(add(e.p, scale(e.n, 0.008)), e.n, H.r[0] * k * 1.2, H.r[0] * k * 0.85, 8, 'mark', { spin: x * 2 }));
  }
  for (const sd of [1, -1]) {
    const e = onEgg(C, H.r, [sd * 0.17, 0.92, 0.38]);
    blots.push(disc(add(e.p, scale(e.n, 0.008)), e.n, H.r[0] * 0.04, H.r[0] * 0.028, 6, 'nose', { spin: sd * 0.5 }));
  }
  const lip = Array.from({ length: 15 }, (_, q) => {
    const phi = lerp(-1.8, 1.8, q / 14), z = mouthZ(s, phi) + H.r[2] * 0.02;
    const zz = clamp((z - C[2]) / H.r[2], -0.99, 0.99), sn = Math.sqrt(1 - zz * zz);
    return onEgg(C, H.r, [Math.sin(phi) * sn, Math.cos(phi) * sn, zz]);
  });
  blots.push(lineOn(lip, lip.map((_, q) => H.r[0] * 0.022 * (0.4 + 0.6 * Math.sin(Math.PI * (0.05 + 0.9 * q / 14)))), 'nose', 0.012));
  out.push(paint(blots));
  for (const sd of [1, -1]) {
    const dc = domeAt(s, sd), r = s.eye.dome;
    out.push(orb(dc, [r, r * 0.95, r * 0.85], n, 5, 'coat'));
    out.push(eyeOf(s, sd, shut));
  }
  return merge(...out);
}

const domeAt = (s: Broth, sd: number): V3 => { const H = s.head, E = s.eye, C = skullAt(s); return [sd * H.r[0] * E.at[0], C[1] + H.r[1] * E.at[1], C[2] + H.r[2] * E.at[2]]; };
/** The way an eye looks, out of its dome: out to its side, forward, and up a little. */
const eyeDir = (sd: number): V3 => unit([sd * 0.55, 0.78, 0.3]);

/** An eye: a big round golden iris, deeper toward its foot, a dark pupil and two glints, its lid of green a little way down over it. */
function eyeOf(s: Broth, sd: number, shut: boolean): Mesh {
  const E = s.eye, dc = domeAt(s, sd), R: V3 = [E.dome, E.dome * 0.95, E.dome * 0.85];
  const q = onEgg(dc, R, eyeDir(sd)), n = q.n, p = add(q.p, scale(n, 0.004));
  const up = unit(cross(cross(n, [0, 0, 1]), n)), across = unit(cross(up, n));
  const o = { at: add(q.p, scale(n, -E.dome * 0.08)), up: [0, 0, 1] as V3 };
  const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg(dc, R, sub(v, dc)); return add(e.p, scale(e.n, lift)); }) });
  const r = E.size, out: Disc[] = [];
  if (shut) {
    out.push(onto(disc(p, n, r * 1.15, r * 1.15, 10, 'coat', o), 0.006));
    out.push(onto(disc(add(p, scale(up, -r * 0.2)), n, r * 1.05, r * 0.14, 8, 'lid', o), 0.012));
    return paint(out);
  }
  out.push(onto(disc(p, n, r * 1.14, r * 1.14, 12, 'lid', o), 0.006));
  out.push(onto(disc(p, n, r, r, 12, 'bloom', o), 0.01));
  out.push(onto(disc(add(p, scale(up, -r * 0.34)), n, r * 0.78, r * 0.48, 10, 'billDark', o), 0.012));
  out.push(onto(disc(p, n, r * 0.46, r * 0.56 * E.round, 10, 'eye', o), 0.016));
  out.push(onto(disc(add(add(p, scale(up, r * 0.36)), scale(across, sd * r * 0.3)), n, r * 0.28, r * 0.28, 6, 'glint', { ...o, lit: true }), 0.022));
  out.push(onto(disc(add(add(p, scale(up, -r * 0.42)), scale(across, -sd * r * 0.26)), n, r * 0.1, r * 0.1, 5, 'glint', { ...o, lit: true }), 0.022));
  const hh = r * 0.8, edge = r * (1 - 2 * E.lid), c = add(p, scale(up, edge + hh));
  out.push(onto(disc(c, n, r * 1.32, hh, 10, 'coat', o), 0.024));
  out.push(onto(disc(add(p, scale(up, edge + r * 0.02)), n, r * 1.08 * Math.sqrt(Math.max(0.15, 1 - (edge / r) ** 2)), r * 0.09, 8, 'lid', o), 0.026));
  return paint(out);
}

function headSolids(s: Broth): Array<{ c: V3; r: V3 }> {
  const H = s.head, E = s.eye;
  return [{ c: skullAt(s), r: scale(H.r, 0.92) }, ...[1, -1].map((sd) => ({ c: domeAt(s, sd), r: [E.dome * 0.8, E.dome * 0.8, E.dome * 0.8] as V3 }))];
}

/**
 * The lower jaw, in its own frame from its hinge: the head's egg a little fuller under the mouth line, cream under its chin;
 * across its top the floor of its mouth, deep pink, and its tongue on it.
 */
function jawOf(s: Broth, n: number): Mesh {
  const H = s.head, C = skullAt(s), hg = hingeAt(s), N = n + 4;
  const r = jawR(s);
  const m = eggBand(C, r, N, 4, (phi) => mouthZ(s, phi), -0.98, (row, phi) => (Math.abs(phi) > 2.1 ? 'coat' : row === 0 ? 'muzzle' : 'belly'), true);
  // The floor: the jaw's open rim, drawn in a little, facing up.
  const rim: V3[] = m.v.slice(0, N).map((p) => [p[0] * 0.96, C[1] + (p[1] - C[1]) * 0.96, p[2] - H.r[2] * 0.04] as V3);
  const floor = mesh(rim, woundTo(rim, [{ i: rim.map((_, j) => j), m: 'inner' }], [[0, 0, 1]]));
  const tc: V3 = [0, C[1] + r[1] * 0.3, mouthZ(s, 0) - H.r[2] * 0.03];
  const tongue = paint([disc(tc, [0, 0.15, 1], H.r[0] * 0.38, r[1] * 0.42, 10, 'tongue'), disc(add(tc, [0, -r[1] * 0.05, 0.005]), [0, 0.15, 1], H.r[0] * 0.04, r[1] * 0.3, 6, 'inner')]);
  return flat(mesh([...m.v, ...floor.v, ...tongue.v].map((p) => sub(p, hg)), [
    ...m.f,
    ...floor.f.map((f) => ({ ...f, i: f.i.map((i) => i + m.v.length) })),
    ...tongue.f.map((f) => ({ ...f, i: f.i.map((i) => i + m.v.length + floor.v.length) })),
  ]));
}

/** A mesh with its own faces painted over it again, flat, so cream under a chin is cream from above. */
function flat(m: Mesh): Mesh {
  return merge(m, paint(m.f.filter((f) => !f.decal).map((f) => ({ v: f.i.map((i) => m.v[i]), m: f.m }))), mesh(m.v, m.f.filter((f) => f.decal)));
}

/* ---- the hat ---------------------------------------------------------------------------------- */

/**
 * Its chef's hat, in the head's frame: a band round the top of its head, and over it a puffed white cloud of a crown -- one
 * great puff on top and a ring of smaller ones round it, overhanging the band.
 */
function hatOf(s: Broth, n: number, k: number): Mesh {
  const H = s.head, C = skullAt(s), T = s.hat;
  const seat = onEgg(C, H.r, [0, -T.back, 1]);
  const up = unit([0, -Math.sin(T.lean * DEG), Math.cos(T.lean * DEG)]);
  const [X, Y] = frameOf(up, [0, 1, 0]);
  const [rb, hb] = T.band, [rt, ht] = T.top;
  const base = sub(seat.p, scale(up, hb * 0.35));
  const at = (x: number, y: number, z: number): V3 => add(base, add(add(scale(X, x), scale(Y, y)), scale(up, z)));
  const band = tube([at(0, 0, 0), at(0, 0, hb * 0.5), at(0, 0, hb * 1.05)], [rb, rb * 1.04, rb * 1.08], [rb, rb * 1.04, rb * 1.08], n + 2, 'clothDark', { up: Y });
  const parts: Mesh[] = [band];
  const crown = hb + ht * 0.5;
  // The top puff, and a ring of smaller ones round it.
  parts.push(orb(at(0, -rt * 0.05, crown + ht * 0.08), [rt * 0.78, rt * 0.78, ht * 0.56], n + 2, k + 1, 'cloth'));
  for (let q = 0; q < T.puffs; q++) {
    const a = (q / T.puffs) * TAU + 0.3, j = jitter(q * 3 + s.stage);
    const rr = rt * (0.46 + 0.08 * j), d = rt * 0.62;
    parts.push(orb(at(Math.cos(a) * d, Math.sin(a) * d, crown - ht * 0.12 + ht * 0.1 * j), [rr, rr, ht * (0.4 + 0.06 * j)], n, k, 'cloth'));
  }
  return merge(...parts);
}

/* ---- its throat ---------------------------------------------------------------------------------- */

/** The Brothlet's pouch, in its bone's frame: a big round cream bubble, its gloss a pale wash and a glint on its upper front. */
function pouchOf(s: Broth, n: number, k: number): Mesh {
  const r = s.orb.r;
  return merge(orb([0, 0, 0], r, n + 8, k + 4, 'muzzle'), shineOf(r, 1, 'eyeWhite', 1.3));
}

/**
 * The broth: the corners of a body of it inside the ball, its top cut level by a plane tipped forward and to the left
 * (degrees) at `fill` of the ball's height, then rings down round the inside of the ball to its foot. `k` is how big it is
 * against the skin: the broth just inside it, or the deep core of it, darker, that makes the middle deeper than its edges.
 */
const BROTH_N = 14, BROTH_ROWS = 4;
function brothMesh(r: V3, k: number, band: Mat, body: Mat): Mesh {
  const v: V3[] = [], f: Face[] = [], want: V3[] = [];
  v.push(...brothPos(r, 0.6, [0, 0], k));
  const N = BROTH_N;
  for (let q = 0; q < BROTH_ROWS; q++) {
    for (let j = 0; j < N; j++) {
      const j2 = (j + 1) % N, a = q * N + j, b = q * N + j2, c = (q + 1) * N + j2, d = (q + 1) * N + j;
      f.push({ i: [a, b, c, d], m: q === 0 ? band : body });
      want.push(scale(add(add(v[a], v[b]), add(v[c], v[d])), 0.25));
    }
  }
  f.push({ i: Array.from({ length: N }, (_, j) => j), m: body });
  want.push([0, 0, 1]);
  return mesh(v, woundTo(v, f, want));
}
function brothPos(r: V3, fill: number, tilt: [number, number], k = 0.985): V3[] {
  const N = BROTH_N, out: V3[] = [];
  const tf = tilt[0] * DEG, tl = tilt[1] * DEG;
  const up = unit([-Math.sin(tl), -Math.sin(tf), 1]);
  const nU = unit([up[0] * r[0], up[1] * r[1], up[2] * r[2]]);
  const h = clamp(fill * 2 - 1, -0.9, 0.92);
  const e1 = unit(cross([0, 1, 0], nU)), e2 = cross(nU, e1);
  const th0 = Math.acos(h);
  for (let q = 0; q <= BROTH_ROWS; q++) {
    const u = q === 0 ? 0 : 0.05 + 0.95 * ((q - 1) / (BROTH_ROWS - 1)) ** 1.2;
    const th = lerp(th0, Math.PI * 0.999, q === BROTH_ROWS ? 1 : u);
    for (let j = 0; j < N; j++) {
      const ph = (j / N) * TAU;
      const d = add(scale(nU, Math.cos(th)), scale(add(scale(e1, Math.cos(ph)), scale(e2, Math.sin(ph))), Math.sin(th)));
      out.push([d[0] * r[0] * k, d[1] * r[1] * k, d[2] * r[2] * k]);
    }
  }
  return out;
}

/**
 * A shine over a ball: a big soft highlight on its upper front -- a pale wash with a bright crescent and a spot in it -- and a
 * pale glint of light coming through low on its far side.
 */
function shineOf(r: V3, sd: number, wash: Mat, big = 1): Mesh {
  const out: Disc[] = [];
  const at = (d: V3, lift = 0.01): { p: V3; n: V3 } => { const e = onEgg([0, 0, 0], r, d); return { p: add(e.p, scale(e.n, lift)), n: e.n }; };
  const onto = (d: Disc, lift: number): Disc => ({ ...d, v: d.v.map((v) => { const e = onEgg([0, 0, 0], r, v); return add(e.p, scale(e.n, lift)); }) });
  const h = at([-0.3 * sd, 0.55, 0.62]);
  out.push(onto(disc(h.p, h.n, r[0] * 0.4 * big, r[0] * 0.28 * big, 10, wash, { up: [0, 0, 1], spin: -0.5 * sd }), 0.012));
  const arcPts = Array.from({ length: 7 }, (_, q) => { const a = lerp(-1, 1, q / 6); return at([-0.3 * sd + 0.32 * a, 0.62 + 0.08 * a * sd, 0.55 - 0.1 * a * a], 0.016); });
  const hw = r[0] * 0.07;
  out.push({ ...lineOn(arcPts, arcPts.map((_, q) => hw * Math.sin(Math.PI * (0.1 + 0.8 * q / 6)) ** 0.7), 'glint', 0.016), lit: true });
  const spot = at([0.08 * sd, 0.75, 0.46], 0.018);
  out.push(disc(spot.p, spot.n, r[0] * 0.08, r[0] * 0.08, 7, 'glint', { lit: true }));
  const low = at([0.55 * sd, 0.6, -0.4], 0.012);
  out.push(onto(disc(low.p, low.n, r[0] * 0.26, r[0] * 0.1, 8, wash, { up: [0, 0, 1], spin: 0.4 * sd }), 0.012));
  return paint(out);
}

/** A little cube of vegetable, `e` its half-size, turned about. */
function dice(c: V3, e: number, spin: number, top: Mat, side: Mat): Mesh {
  const cs = Math.cos(spin), sn = Math.sin(spin), tip = 0.5 * Math.sin(spin * 1.7);
  const v: V3[] = [];
  for (const z of [-1, 1]) for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const px = x * e, py = y * e, pz = z * e;
    const rx = px * cs - py * sn, ry = px * sn + py * cs;
    v.push([c[0] + rx, c[1] + ry * Math.cos(tip) - pz * Math.sin(tip), c[2] + ry * Math.sin(tip) + pz * Math.cos(tip)]);
  }
  const f: Face[] = [{ i: [0, 1, 2, 3], m: side }, { i: [4, 5, 6, 7], m: top }, { i: [0, 1, 5, 4], m: side }, { i: [1, 2, 6, 5], m: top }, { i: [2, 3, 7, 6], m: side }, { i: [3, 0, 4, 7], m: top }];
  const want: V3[] = f.map((face) => sub(scale(face.i.reduce((t, i) => add(t, v[i]), [0, 0, 0] as V3), 0.25), c));
  return mesh(v, woundTo(v, f, want));
}

/**
 * What is in its broth, in the ball's frame and inside it, under the broth's top: diced carrot and green beans, a sprig of
 * herbs near the top, and in the Cauldronthroat's two mushrooms, a white star on each cap. Kept off the far half of the ball,
 * where they would be seen through the body.
 */
function bitsOf(s: Broth, K: number): Mesh {
  const r = s.orb.r, top = (s.orb.fill * 2 - 1) * r[2], parts: Mesh[] = [];
  const count = s.stage === 2 ? 11 : 9;
  for (let q = 0; q < count; q++) {
    const j = jitter(q * 5 + 11), a = lerp(-1.1, 1.1, (q + 0.5 * j) / count), d = 0.5 + 0.25 * jitter(q * 7 + 3);
    const z = lerp(-0.62 * r[2], top - 0.2 * r[2], jitter(q * 3 + 7));
    const ring = Math.sqrt(Math.max(0.05, 1 - (z / r[2]) ** 2));
    const c: V3 = [Math.sin(a) * r[0] * d * ring, Math.cos(a) * r[1] * d * ring, z];
    const e = r[0] * (0.05 + 0.02 * jitter(q + 1));
    parts.push(q % 3 === 2 ? dice(c, e * 0.8, j * 6, 'leaf', 'leafDark') : dice(c, e, j * 6, 'crystal', 'crystalDark'));
  }
  // A sprig of herbs, just under the top at the front, its leaves up.
  const root: V3 = [r[0] * 0.15, r[1] * 0.45, top - 0.16 * r[2]];
  for (let q = 0; q < 4; q++) {
    const a = -0.9 + 0.6 * q, len = r[0] * (0.34 - 0.03 * Math.abs(q - 1.5));
    const dir = unit([Math.sin(a) * 0.8, -0.3, 0.6 + 0.2 * Math.cos(a)]), tip = add(root, scale(dir, len));
    const mid = add(add(root, scale(dir, len * 0.5)), [0, len * 0.12, 0]);
    parts.push(sheet(curve(root, mid, tip, K - 1), Array.from({ length: K }, (_, k) => Math.max(0.006, len * 0.32 * Math.sin(Math.PI * Math.min(0.999, (k / (K - 1)) ** 0.7)))), [0, 1, 0.3], 0.2, ['leaf', 'leaf', 'leafDark']));
  }
  for (let q = 0; q < s.orb.mush; q++) {
    const c: V3 = [r[0] * (q ? -0.3 : 0.32), r[1] * (q ? 0.42 : 0.3), top - r[2] * (q ? 0.34 : 0.22)];
    const cr = r[0] * (q ? 0.15 : 0.18), up = unit([q ? -0.25 : 0.2, 0.5, 0.85]);
    parts.push(orbAlong(c, up, [cr, cr, cr * 0.62], 8, 3, 'cap'));
    const e = add(c, scale(up, cr * 0.64));
    const star: Disc[] = [];
    for (let p = 0; p < 4; p++) star.push(disc(add(e, scale(up, 0.004)), up, cr * 0.5, cr * 0.1, 4, 'petal', { spin: (p * Math.PI) / 4 }));
    parts.push(paint(star));
  }
  return merge(...parts);
}

/* ---- what it wears ------------------------------------------------------------------------------ */

/**
 * Where along the body a point round it at `th` is as high off the ground as its point round it at `th0` along it at `y0` is,
 * sitting: so a band round it at `y0` goes round it level, as a neckerchief or a waist tie does, and not along its tipped rings.
 */
function levelY(s: Broth, y0: number, th0: number, th: number): number {
  const a = s.tilt * DEG, c = Math.cos(a), sn = Math.sin(a), M = s.body;
  const zOf = (y: number, t: number): number => { const q = onRings(M, y, t).p; return y * sn + q[2] * c; };
  const want = zOf(y0, th0);
  let lo = M.y[0] + 0.02, hi = M.y[M.y.length - 1] - 0.02;
  const up = zOf(hi, th) > zOf(lo, th);
  for (let k = 0; k < 24; k++) {
    const mid = (lo + hi) / 2;
    if ((zOf(mid, th) < want) === up) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** A band hugging the body round it, level, through its front at `y`, `w` wide, standing `off` off it: red. */
function bandRound(s: Broth, y: number, w: number, off: number, n: number, from = 0, to = TAU, mat: Mat = 'leather', th0 = -Math.PI / 2): Mesh {
  const rows: V3[][] = [];
  for (const dy of [-w, 0, w]) {
    const row: V3[] = [];
    for (let j = 0; j <= n; j++) {
      const th = lerp(from, to, j / n);
      row.push(onBody(s, levelY(s, y, th0, th) + dy, th, off * (dy ? 1 : 1.25)).p);
    }
    rows.push(row);
  }
  return gridMesh(rows, (p) => { const r = ringAt(s.body, p[1]); return [p[0], 0, p[2] - r.z]; }, () => mat);
}

/** A bow: two loops either side of a knot, and two ends hanging from it down the way `down` goes, all along `out`. */
function bowOf(c: V3, out: V3, down: V3, size: number, K: number, mats: readonly [Mat, Mat, Mat], ends = 1): Mesh {
  const o = unit(out), dn = unit(sub(down, scale(o, dot(down, o)))), side = unit(cross(dn, o));
  const parts: Mesh[] = [orbAlong(c, o, [size * 0.32, size * 0.32, size * 0.24], 7, 3, mats[0])];
  for (const sd of [-1, 1]) {
    parts.push(orbAlong(add(add(c, scale(side, sd * size * 0.6)), scale(dn, -size * 0.12)), side, [size * 0.38, size * 0.24, size * 0.5], 8, 3, mats[0]));
    const tip = add(add(c, scale(side, sd * size * 0.45)), scale(dn, size * 1.3 * ends)), mid = add(add(c, scale(side, sd * size * 0.15)), scale(dn, size * 0.7 * ends));
    parts.push(sheet(curve(add(c, scale(dn, size * 0.1)), mid, tip, K - 1), Array.from({ length: K }, (_, k) => size * (0.2 + 0.08 * k / (K - 1))), o, 0.1, mats));
  }
  return merge(...parts);
}

/** Its neckerchief: a red band round its neck, knotted round at `knot`, two ends hanging from the knot. */
function scarfOf(s: Broth, n: number, K: number): Mesh {
  const S = s.scarf!, off = 0.06 * bigOf(s);
  const band = bandRound(s, S.y, S.w * bigOf(s), off, n + 6, 0, TAU, 'leather', Math.PI / 2);
  const q = onBody(s, levelY(s, S.y, Math.PI / 2, S.knot), S.knot, off * 2), down = dirToBody(s, [0, -0.35, -1]);
  return merge(band, bowOf(q.p, q.n, down, 0.2 * bigOf(s), K, ['leather', 'leather', 'leatherDark'], 1.1));
}

/** A point on its apron: `u` across (-1 its right... to 1), `v` down (nought its top), on the body, standing a little off it. */
function apronPt(s: Broth, u: number, v: number, lift = 0): { p: V3; n: V3 } {
  const A = s.apron, y = lerp(A.y[0], A.y[1], v), th = -Math.PI / 2 + u * A.half;
  // It hangs off the curve of the belly rather than wrapping round it: drawn in toward a flat front at its sides.
  const q = onBody(s, y, th, (0.018 + lift) * bigOf(s) + 0.05 * bigOf(s) * u * u * (0.4 + v));
  return q;
}
/** How far across the apron goes at `v` down it: square to near its foot, then rounded off. */
const apronHalf = (v: number): number => (v < 0.68 ? 1 : 0.5 + 0.5 * Math.sqrt(Math.max(0, 1 - ((v - 0.68) / 0.32) ** 2)));

/** Its apron: white, a red band round its edge, its ties running round the body, and on the Cauldronthroat's a crossed spoon and fork. */
function apronOf(s: Broth, n: number): Mesh {
  const U = 8, V = 7, rows: V3[][] = [];
  for (let r = 0; r <= V; r++) {
    const v = r / V, h = apronHalf(v);
    rows.push(Array.from({ length: U + 1 }, (_, c) => apronPt(s, lerp(-h, h, c / U), v).p));
  }
  const cloth = gridMesh(rows, (p) => { const r = ringAt(s.body, p[1]); return [p[0], 0, p[2] - r.z]; }, () => 'cloth');
  const decals: Disc[] = [];
  // The trim, a little in from its edge: down its sides and round its foot.
  const edge: Array<{ p: V3; n: V3 }> = [];
  for (let q = 0; q <= 20; q++) {
    const w = q / 20, ang = lerp(-Math.PI, 0, w);
    // Round from the top of its right side, down, across the foot, and up its left.
    const u = Math.cos(ang) * -1, v = Math.min(1, -Math.sin(ang) * 1.3);
    const vv = clamp(v, 0.04, 0.93), hh = apronHalf(vv) * 0.86;
    edge.push(apronPt(s, clamp(u, -1, 1) * hh, vv, 0.006));
  }
  decals.push(lineOn(edge, 0.03 * bigOf(s), 'lining', 0.004));
  // The top hem.
  const hem = Array.from({ length: 9 }, (_, q) => apronPt(s, lerp(-0.9, 0.9, q / 8), 0.05, 0.006));
  decals.push(lineOn(hem, 0.022 * bigOf(s), 'lining', 0.004));
  if (s.apron.emblem) {
    // A crossed wooden spoon and fork.
    for (const sd of [1, -1]) {
      const a = apronPt(s, sd * 0.42, 0.78, 0.008), b = apronPt(s, -sd * 0.3, 0.3, 0.008);
      const stick = Array.from({ length: 6 }, (_, q) => apronPt(s, lerp(sd * 0.42, -sd * 0.3, q / 5), lerp(0.78, 0.3, q / 5), 0.008));
      decals.push(lineOn(stick, 0.028 * bigOf(s), 'woodDark', 0.006));
      const head = add(b.p, scale(sub(b.p, a.p), 0.1));
      if (sd > 0) decals.push(disc(add(head, scale(b.n, 0.01)), b.n, 0.09 * bigOf(s), 0.065 * bigOf(s), 9, 'woodDark', { up: sub(b.p, a.p) }));
      else for (const t of [-1, 0, 1]) {
        const tip = apronPt(s, -sd * 0.3 + 0.08 * t + 0.06, 0.16, 0.01), root = apronPt(s, -sd * 0.3 + 0.04 * t + 0.02, 0.3, 0.01);
        decals.push(lineOn([root, tip], 0.014 * bigOf(s), 'woodDark', 0.008));
      }
    }
  }
  // The ties: from its top corners round its sides to a little bow at each side.
  const parts: Mesh[] = [cloth, paint(decals)];
  const yT = lerp(s.apron.y[0], s.apron.y[1], 0.04);
  for (const sd of [1, -1]) {
    const from = -Math.PI / 2 + sd * s.apron.half, to = sd > 0 ? 0.05 : Math.PI - 0.05;
    parts.push(bandRound(s, yT, 0.022 * bigOf(s), 0.012 * bigOf(s), Math.max(3, Math.floor(n / 3)), Math.min(from, to), Math.max(from, to), 'lining'));
    const q = onBody(s, levelY(s, yT, -Math.PI / 2, to), to, 0.03 * bigOf(s));
    parts.push(bowOf(q.p, q.n, dirToBody(s, [0, -0.2, -1]), 0.09 * bigOf(s), 3, ['lining', 'lining', 'leatherDark'], 1));
  }
  return merge(...parts);
}

/**
 * The Cauldronthroat's cape: red over its shoulders and the top of its back, hanging down its flanks to a point at each side,
 * its edge a darker red; tied at its right shoulder in a bow, a white leaf on it there.
 */
function capeOf(s: Broth, n: number, K: number): { cape: Mesh; bow: Mesh } {
  const C = s.cape!, big = bigOf(s), U = n + 6, V = 6;
  const rows: V3[][] = [];
  for (let r = 0; r <= V; r++) {
    const v = r / V, row: V3[] = [];
    for (let c = 0; c <= U; c++) {
      const u = c / U, th = lerp(-0.55, Math.PI + 0.55, u);
      // Further down the flanks than down the back, to a point either side.
      const side = Math.abs(Math.cos(th)), point = Math.exp(-(((Math.abs(th - Math.PI / 2) - 1.95) / 0.3) ** 2));
      const y = lerp(C.y[0], Math.max(s.body.y[0] + 0.12 * big, C.y[1] - 0.25 * side * big - 0.35 * point * big), v);
      const drop = C.drop * 0.07 * big * v * v * side + 0.035 * big * v * (0.5 + 0.5 * Math.sin(th * 7));
      const q = onBody(s, y, th - 0.25 * v * v * Math.sign(Math.cos(th)) * side, 0.04 * big + drop);
      row.push(q.p);
    }
    rows.push(row);
  }
  const cape = gridMesh(rows, (p) => { const r = ringAt(s.body, p[1]); return [p[0], 0, p[2] - r.z]; }, (r) => (r === V - 1 ? 'leatherDark' : 'leather'));
  // A white leaf on it at its right side.
  const leaf: Disc[] = [], lc = onBody(s, lerp(C.y[0], C.y[1], 0.5), 0.05, 0.05 * big + 0.02);
  leaf.push(disc(lc.p, lc.n, 0.2 * big, 0.09 * big, 10, 'petal', { up: dirToBody(s, [0, 0.3, 1]), spin: 0.6 }));
  leaf.push(disc(add(lc.p, scale(lc.n, 0.004)), lc.n, 0.17 * big, 0.012 * big, 4, 'leather', { up: dirToBody(s, [0, 0.3, 1]), spin: 0.6 }));
  const bq = onBody(s, C.y[0] - 0.12 * big, 0.2, 0.1 * big);
  const bow = bowOf(bq.p, unit(add(bq.n, dirToBody(s, [0, 0.9, 0]))), dirToBody(s, [0, -0.1, -1]), 0.3 * big, K, ['leather', 'leather', 'leatherDark'], 1.5);
  return { cape: merge(cape, paint(leaf)), bow };
}

/** The white cloth hanging at its right side from under its bow, close down its flank: two red bands across its foot. */
function clothOf(s: Broth): Mesh {
  const big = bigOf(s), C = s.cape!, th = 0.12, y0 = C.y[0] - 0.2 * big;
  const top = onBody(s, y0, th, 0.09 * big);
  const down = unit(dirToBody(s, [0, -0.1, -1])), out = unit([top.n[0], top.n[1] * 0.3, top.n[2] * 0.3]), across = unit(cross(down, out));
  const rows: V3[][] = [], V = 6, len = 0.7 * big, w = 0.16 * big;
  for (let r = 0; r <= V; r++) {
    const v = r / V, c = add(add(top.p, scale(down, len * v)), scale(out, 0.04 * big * v));
    rows.push([-1, -0.33, 0.33, 1].map((x) => add(add(c, scale(across, x * w * (1 + 0.12 * v))), scale(out, -0.025 * big * x * x))));
  }
  const cloth = gridMesh(rows, () => out, () => 'cloth');
  // Its two red bands, painted across it near its foot.
  const bands: Disc[] = [];
  for (const v of [0.74, 0.84]) {
    const c = add(add(top.p, scale(down, len * v)), scale(out, 0.04 * big * v + 0.006));
    bands.push(facingDisc([-1, 1, 1, -1].map((x, k) => add(add(c, scale(across, x * w * (1 + 0.12 * v) * 0.98)), scale(down, (k < 2 ? -1 : 1) * 0.018 * big))), out, 'lining'));
  }
  return merge(cloth, paint(bands));
}

/* ---- legs and feet ------------------------------------------------------------------------------ */

/** A foot in its own frame from the heel along `+y`: the back of the foot, short thick toes splayed from the ball, round tips; webbed as the stage is. */
function footOf(s: Broth, L: Leg, heel: number, hind: boolean, n: number): Mesh {
  const F = L.foot, w = L.w, z0 = -heel, parts: Mesh[] = [];
  const ball: V3 = [0, F, z0 + w * 0.3];
  parts.push(tube([[0, -w * 0.25, 0], [0, F * 0.5, z0 * 0.5 + w * 0.18], ball], [w * 0.85, w * 0.78, w * 0.7], [w * 0.6, w * 0.5, w * 0.4], Math.max(5, n - 2), 'coat', { seam: 'start' }));
  const T = L.toes, spread = hind ? 1.45 : 1.25, tips: V3[] = [];
  for (let k = 0; k < T; k++) {
    const u = k / (T - 1), a = lerp(-spread * 0.5, spread * 0.5, u);
    const len = L.toe * (0.82 + 0.25 * Math.sin(Math.PI * u));
    const d: V3 = [Math.sin(a), Math.cos(a), 0];
    const tw = w * (hind ? 0.28 : 0.32);
    const tip: V3 = [ball[0] + d[0] * len, ball[1] + d[1] * len, z0 + tw * 0.75];
    tips.push(tip);
    parts.push(tube([add(ball, [0, 0, -w * 0.05]), tip], [tw * 1.15, tw], [tw * 0.85, tw * 0.75], 5, 'coat', { start: false }));
    parts.push(orb(add(tip, [d[0] * tw * 0.3, d[1] * tw * 0.3, -tw * 0.1]), [tw * 1.05, tw * 1.1, tw * 0.75], 6, 3, 'pad'));
    if (s.claws) parts.push(tube([add(tip, [d[0] * tw * 0.6, d[1] * tw * 0.6, 0]), add(tip, [d[0] * tw * 1.6, d[1] * tw * 1.6, -tw * 0.5])], [tw * 0.42, 0.004], [tw * 0.36, 0.004], 4, 'claw', { start: false }));
  }
  if (s.webs === 2 || (s.webs === 1 && hind)) {
    const web: Disc[] = [];
    for (let k = 0; k < T - 1; k++) {
      const a = tips[k], b = tips[k + 1], ma = mixV(ball, a, 0.9), mb = mixV(ball, b, 0.9);
      const notch = mixV(ball, mixV(a, b, 0.5), 0.68);
      web.push(facingDisc([add(ball, [0, 0, -w * 0.02]), ma, notch, mb], [0, 0, 1], 'membrane'));
    }
    parts.push(paint(web));
  }
  return merge(...parts);
}

/** The thigh (or upper arm), in its bone's frame: down `-z` from the hip, a fat haunch folded beside it, spotted. */
function upperOf(s: Broth, L: Leg, l0: number, hind: boolean, n: number, k: number): Mesh {
  const w = L.w, top = hind ? 2.0 : 1.2, low = hind ? 1.1 : 0.95, fat = hind ? [2.3, 2.2, 2.1][s.stage] : 1;
  const m = hind
    ? merge(orb([0, 0, -l0 * 0.48], [w * fat, w * fat * 0.95, l0 * 0.68], n + 1, k + 1, 'coat'), orb([0, 0, -l0], w * low, n, k, 'coat'))
    : merge(
      orb([0, 0, -l0 * 0.1], [w * top, w * top, w * top * 1.05], n, k, 'coat'),
      tube([[0, 0, 0], [0, 0, -l0 * 0.55], [0, 0, -l0]], [w * top * 0.95, w * (top + low) * 0.5, w * low], [w * top * 0.95, w * (top + low) * 0.5, w * low], n, 'coat', { seam: 'start' }),
      orb([0, 0, -l0], w * low, n, k, 'coat'),
    );
  const blots: Disc[] = [];
  const count = hind ? 5 : 2;
  for (let q = 0; q < count; q++) {
    const z = -l0 * (0.2 + 0.6 * (q / Math.max(1, count - 1))), a = (q / count) * TAU + jitter(q * 3 + (hind ? 9 : 2)) * 1.2;
    const rr = hind ? w * fat * 0.98 * Math.sqrt(Math.max(0.2, 1 - ((z + l0 * 0.48) / (l0 * 0.68)) ** 2)) : lerp(w * top * 0.95, w * low, -z / l0), nrm: V3 = [Math.cos(a), Math.sin(a), 0];
    blots.push(disc(add([nrm[0] * rr, nrm[1] * rr, z], scale(nrm, 0.01)), nrm, rr * 0.45, rr * 0.75, 8, 'mark', { up: [0, 0, 1] }));
  }
  const c: V3 = [0, 0, -l0 * 0.48], R: V3 = [w * fat, w * fat * 0.95, l0 * 0.68];
  const onto = (v: V3): V3 => {
    if (hind) { const e = onEgg(c, R, sub(v, c)); return add(e.p, scale(e.n, 0.008)); }
    const rz = clamp(-v[2] / l0), r = lerp(w * top * 0.95, w * low, rz) + 0.008, h = Math.hypot(v[0], v[1]) || 1;
    return [(v[0] / h) * r, (v[1] / h) * r, v[2]];
  };
  return merge(m, paint(blots.map((d) => ({ ...d, v: d.v.map(onto) }))));
}

/** The shin (or forearm), down `-z` from the knee to the heel: thick. */
function lowerOf(L: Leg, l1: number, hind: boolean, n: number): Mesh {
  const w = L.w, a = hind ? 1.0 : 0.95, b = hind ? 0.72 : 0.8;
  const m = tube([[0, 0, w * 0.5], [0, 0, -l1 * 0.55], [0, 0, -l1]], [w * a, w * (a + b) * 0.5, w * b], [w * a, w * (a + b) * 0.5, w * b], n, 'coat', { seam: 'start' });
  const blots: Disc[] = [];
  for (const [z, ang] of (hind ? [[0.35, 1.2], [0.7, -0.6]] : [[0.5, 0.5]]) as Array<[number, number]>) {
    const nrm: V3 = [Math.cos(ang), Math.sin(ang), 0], rr = lerp(w * a, w * b, z);
    blots.push(disc(add([nrm[0] * rr, nrm[1] * rr, -l1 * z], scale(nrm, 0.01)), nrm, rr * 0.5, rr * 0.9, 8, 'mark', { up: [0, 0, 1] }));
  }
  const onto = (v: V3): V3 => { const r = lerp(w * a, w * b, clamp(-v[2] / l1)) + 0.008, h = Math.hypot(v[0], v[1]) || 1; return [(v[0] / h) * r, (v[1] / h) * r, v[2]]; };
  return merge(m, paint(blots.map((d) => ({ ...d, v: d.v.map(onto) }))));
}

/** A leg's underside cream: every facet turned down more than `below` or in toward the body painted the belly's colour. */
function creamUnder(m: Mesh, xf: Xf, below: number, inward = 0.55): Mesh {
  const side = Math.sign(xf.t[0]) || 1;
  const faces = m.f.map((f) => {
    if (f.decal || f.m !== 'coat' || f.i.length < 3) return f;
    const a = m.v[f.i[0]], b = m.v[f.i[1]], c = m.v[f.i[2]], nl = unit(cross(sub(b, a), sub(c, a))), n = turn(xf, nl);
    return n[2] < -below || n[0] * side < -inward ? { ...f, m: 'belly' as Mat } : f;
  });
  const solid = faces.filter((f) => !f.decal), cream: Face[] = solid.filter((f) => f.m === 'belly').map((f) => ({ ...f, decal: true }));
  return mesh(m.v, [...solid, ...cream, ...faces.filter((f) => f.decal)]);
}

const mirroredMesh = (m: Mesh): Mesh => mesh(m.v.map((p) => [-p[0], p[1], p[2]] as V3), m.f.map((f) => ({ ...f, i: [...f.i].reverse() })));

/* ---- its pot and spoon ---------------------------------------------------------------------------- */

/** Its pot, on the ground with its middle at the origin: round-bellied iron, a lip, two little handles, broth in it. */
function potOf(s: Broth, n: number): Mesh {
  const { r: R, h } = s.pot, N = n + 4;
  const outer = tube([[0, 0, 0.02 * h], [0, 0, 0.16 * h], [0, 0, 0.55 * h], [0, 0, 0.9 * h], [0, 0, h]], [0.66 * R, 0.9 * R, R, 0.92 * R, 0.96 * R], [0.66 * R, 0.9 * R, R, 0.92 * R, 0.96 * R], N, (k) => (k === 3 ? 'metalLit' : 'metal'), { end: false });
  // Its inside: a wall facing in, down from the lip to the broth, and the broth's top.
  const rows: V3[][] = [];
  for (const [z, k] of [[h, 0.9], [h * 0.68, 0.88]] as const) rows.push(Array.from({ length: N + 1 }, (_, j) => { const a = (j / N) * TAU; return [Math.cos(a) * R * k, Math.sin(a) * R * k, z] as V3; }));
  const inner = gridMesh(rows, (p) => [-p[0], -p[1], 0], () => 'metalDark');
  const lip: V3[][] = [0.96, 0.9].map((k) => Array.from({ length: N + 1 }, (_, j) => { const a = (j / N) * TAU; return [Math.cos(a) * R * k, Math.sin(a) * R * k, h] as V3; }));
  const top = gridMesh(lip, () => [0, 0, 1], () => 'metalLit');
  const surf: V3[] = Array.from({ length: N }, (_, j) => { const a = (j / N) * TAU; return [Math.cos(a) * R * 0.88, Math.sin(a) * R * 0.88, h * 0.68] as V3; });
  const broth = mesh(surf, woundTo(surf, [{ i: surf.map((_, j) => j), m: 'water' }], [[0, 0, 1]]));
  const bits: Disc[] = [];
  for (let q = 0; q < 5; q++) {
    const a = jitter(q + 40) * TAU, d = R * 0.55 * jitter(q + 41);
    bits.push(disc([Math.cos(a) * d, Math.sin(a) * d, h * 0.68 + 0.004], [0, 0, 1], R * 0.09, R * 0.07, 4, q % 2 ? 'leaf' : 'crystal', { spin: q }));
  }
  const handles = [1, -1].map((sd) => tube(curve([sd * R * 0.9, 0, h * 0.82], [sd * R * 1.22, 0, h * 0.9], [sd * R * 0.92, 0, h * 0.98], 3), R * 0.06, R * 0.06, 5, 'metalDark'));
  return merge(outer, inner, top, broth, paint(bits), ...handles);
}

/** The wooden spoon, in its bone's frame: held in the paw at the origin, its handle standing up `+z` out of it and its bowl down in the pot. */
function spoonOf(s: Broth): Mesh {
  const L = s.pot.spoon, w = L * 0.04, b = -L * GRIP;
  const handle = tube([[0, 0, L * (1 - GRIP)], [0, 0, L * 0.2], [0, 0, b + w * 3]], [w * 1.25, w, w * 0.85], [w * 1.25, w, w * 0.85], 6, 'wood');
  const bowl = orbAlong([0, 0, b], [0, 0, 1], [w * 2.6, w * 1.4, w * 3.4], 8, 4, 'wood');
  return merge(handle, bowl, paint([disc([0, w * 1.42, b], [0, 1, 0], w * 2.0, w * 2.8, 8, 'woodDark')]));
}

/* ---- a stage's pieces --------------------------------------------------------------------------- */

const restBoneCache = new Map<Broth, Bones>();
function restBones(s: Broth): Bones {
  let b = restBoneCache.get(s);
  if (!b) restBoneCache.set(s, (b = brothBones(s)({ t: 0, u: 0, go: 0, gait: 0, graze: 0, blink: false, breath: 0.5, fleece: 1, seed: 0 })));
  return b;
}

const working = (a: Anim): boolean => a.act?.kind === 'work' || (a.graze > 0 && a.go <= 0 && !a.act);

function brothBuild(s: Broth, lod: number): Piece[] {
  const n = cut(lod, 8, 11), k = cut(lod, 5, 6), K = lod ? 4 : 3, R = restOf(s);
  const rest = restBones(s);
  const pieces: Piece[] = [];
  const M = marksOf(s), bodyHide = { c: [0, 0, 0] as V3, r: [M.w[3] * 0.9, (M.y[6] - M.y[0]) * 0.45, M.h[3] * 0.9] as V3 };
  pieces.push({ key: 'body', mesh: barrelOf(s, n + 3), bone: 'trunk', bias: 0, breathes: { c: [0, 0, 0], k: 0.03 } });
  const hide = headSolids(s);
  // Over what it wears round its neck and shoulders while its face is toward the viewer; under them from behind.
  pieces.push({ key: 'head', mesh: headOf(s, n, false), shut: headOf(s, n, true), bone: 'head', bias: 0.2, hide, after: ['scarf', 'cape', 'bow'], front: [0, 1, 0] });
  pieces.push({ key: 'jaw', mesh: jawOf(s, n), bone: 'jaw', bias: 0.19, after: ['head'], lines: false, hide: [{ c: skullAt(s), r: scale(s.head.r, 0.9) }], hideIn: 'head' });
  pieces.push({ key: 'hat', mesh: hatOf(s, n, k), bone: 'head', bias: 0.23, after: ['head'], lines: false });
  // Its throat, over its chest and under its chin: over the body and all it wears while it is toward the viewer, under them from behind.
  const onTop = { after: ['body', 'head', 'jaw', 'scarf', 'apron', 'cape', 'cloth', 'bow'], front: [0, 1, 0.2] as V3 };
  if (!s.orb.glass) pieces.push({ key: 'throat', mesh: pouchOf(s, n, k), bone: 'orb', bias: 0.18, ...onTop, lines: false });
  else {
    const r = s.orb.r;
    pieces.push({ key: 'throat', mesh: orb([0, 0, 0], r, n + 6, k + 3, 'shell'), bone: 'orb', bias: 0.18, ...onTop });
    const level = (kk: number) => (_v: readonly V3[], a: Anim): V3[] => brothPos(r, s.orb.fill, brothNow(s, a).tilt, kk);
    pieces.push({ key: 'brothW', mesh: brothMesh(r, 0.975, 'horn', 'water'), bone: 'orb', bias: 0.181, after: ['throat'], lines: false, bent: level(0.975) });
    pieces.push({ key: 'brothC', mesh: brothMesh(r, 0.66, 'shellDark', 'shellDark'), bone: 'orb', bias: 0.182, after: ['throat', 'brothW'], lines: false, bent: level(0.66) });
    // Its bits carried round after the broth's turn, and rocked with its top.
    pieces.push({
      key: 'bits', mesh: bitsOf(s, K), bone: 'orb', bias: 0.183, after: ['throat', 'brothW', 'brothC'], thin: true,
      bent: (v, a) => {
        const W = brothNow(s, a), c = Math.cos(W.spin * 0.35), sn = Math.sin(W.spin * 0.35), dx = -W.tilt[1] * 0.004 * r[0], dy = -W.tilt[0] * 0.004 * r[1];
        return v.map((p) => [p[0] * c - p[1] * sn + dx, p[0] * sn + p[1] * c + dy, p[2]] as V3);
      },
    });
    pieces.push({ key: 'shine', mesh: shineOf(r, 1, 'eyeWhite'), bone: 'orb', bias: 0.184, after: ['throat', 'brothW', 'brothC', 'bits'], lines: false });
  }
  if (s.scarf) pieces.push({ key: 'scarf', mesh: scarfOf(s, n, K), bone: 'trunk', bias: 0.05, after: ['body'], hide: [bodyHide] });
  pieces.push({ key: 'apron', mesh: apronOf(s, n), bone: 'trunk', bias: 0.03, after: ['body'], hide: [bodyHide] });
  if (s.cape) {
    const C = capeOf(s, n, K);
    pieces.push({ key: 'cape', mesh: C.cape, bone: 'trunk', bias: 0.05, after: ['body'] });
    pieces.push({ key: 'cloth', mesh: clothOf(s), bone: 'trunk', bias: 0.055, after: ['cape'], hide: [bodyHide] });
    pieces.push({ key: 'bow', mesh: C.bow, bone: 'trunk', bias: 0.06, after: ['cape', 'cloth'], hide: [bodyHide] });
  }
  for (let i = 0; i < 4; i++) {
    const key = LEGS4[i], fore = i < 2, side = SIDE[i], L = legOfI(s, i), [l0, l1] = R.legs[i];
    const foot = side > 0 ? footOf(s, L, R.heel[i], !fore, n) : mirroredMesh(footOf(s, L, R.heel[i], !fore, n));
    pieces.push(
      { key: `${key}0`, mesh: creamUnder(upperOf(s, L, l0, !fore, n, k), rest[`${key}0`], fore ? 0.8 : 0.45, fore ? 0.85 : 0.55), bone: `${key}0`, bias: fore ? 0.02 : 0.01 },
      { key: `${key}1`, mesh: creamUnder(lowerOf(L, l1, !fore, n), rest[`${key}1`], fore ? 0.8 : 0.35, fore ? 0.85 : 0.55), bone: `${key}1`, bias: 0.02 },
      { key: `${key}2`, mesh: foot, bone: `${key}2`, bias: 0.015 },
    );
  }
  pieces.push({ key: 'pot', mesh: potOf(s, n), bone: 'site', bias: 0 });
  pieces.push({ key: 'spoon', mesh: spoonOf(s), bone: 'spoon', bias: 0.03, after: ['pot'], shown: working });
  return pieces;
}

/* ---- what it throws about --------------------------------------------------------------- */

const DUST: RGB = [196, 180, 152], STEAM: RGB = [246, 244, 238];
const BITS_RGB: readonly RGB[] = [[240, 132, 44], [128, 172, 70], [248, 196, 96]];
const INK: RGB = [60, 40, 30];

const pxOf = (g: CanvasRenderingContext2D): number => { const tr = g.getTransform(); return 1 / (Math.hypot(tr.a, tr.b) || 1); };

/** A soft puff, `r` across, of `base` at `al`. */
function softPuff(g: CanvasRenderingContext2D, x: number, y: number, r: number, base: RGB, al: number): void {
  if (al <= 0.01 || r <= 0) return;
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, css(base, al));
  grad.addColorStop(0.55, css(base, al * 0.5));
  grad.addColorStop(1, css(base, 0));
  g.fillStyle = grad;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

/** A puff of dust off the ground. */
function puff(g: CanvasRenderingContext2D, view: View, at: V3, r: number, age: number, id = 0): void {
  if (r <= 0.02 || age < 0 || age >= 1) return;
  const [x, y] = onScreen(view, at);
  const al = 0.5 * smooth(age / 0.1) * (1 - age) ** 1.3, rr = r * (1 + 0.7 * age);
  const c = mix(DUST, [252, 246, 236], 0.2 + 0.35 * age);
  for (let q = 0; q < 3; q++) {
    const a = (q / 3) * TAU + jitter(id) * TAU, d = q ? rr * 0.42 : 0;
    softPuff(g, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6 - rr * 0.18 * age, rr * (q ? 0.72 : 1), c, al * (q ? 0.7 : 1));
  }
}

/** A bit of vegetable or a leaf in the air: a small inked lump. */
function chunk(g: CanvasRenderingContext2D, x: number, y: number, r: number, ang: number, c: RGB, al: number, leafy = false): void {
  if (al <= 0.02) return;
  const px = pxOf(g);
  r = Math.max(r, 1.3 * px);
  g.beginPath();
  if (leafy) g.ellipse(x, y, r, r * 0.45, ang, 0, TAU);
  else for (let q = 0; q < 4; q++) {
    const a = ang + (q / 4) * TAU, X = x + Math.cos(a) * r, Y = y + Math.sin(a) * r * 0.85;
    if (q) g.lineTo(X, Y); else g.moveTo(X, Y);
  }
  g.closePath();
  g.fillStyle = css(c, al);
  g.fill();
  g.strokeStyle = css(INK, al * 0.85);
  g.lineWidth = Math.max(0.6 * px, r * 0.22);
  g.stroke();
}

/** Steam rising off the pot as it stirs: soft white wisps going up and swaying, fading as they go; each on its side of the body. */
function steam(g: CanvasRenderingContext2D, view: View, s: Broth, b: Bones, a: Anim, k: number, front: boolean): void {
  if (k <= 0.05 || !b.site) return;
  const P = s.pot, c = add(potAt(s), [0, 0, P.h]), mid = b.body.t, T = 2.2;
  for (let q = 0; q < 6; q++) {
    const age = frac(a.t / T + q / 6), id = q * 7 + Math.floor(a.t / T + q / 6) * 3;
    const sway = Math.sin(age * 5 + jitter(id) * TAU) * P.r * 0.5 * age;
    const p: V3 = [c[0] + (jitter(id + 1) - 0.5) * P.r * 0.8 + sway, c[1] + (jitter(id + 2) - 0.5) * P.r * 0.8, c[2] + age * P.r * 4.5];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    const al = 0.85 * k * smooth(age / 0.12) * (1 - age) ** 1.1;
    softPuff(g, x, y, P.r * (0.55 + 1.0 * age), STEAM, al);
  }
}

/** What a strike throws: dust where it comes down, and from the bigger two a splash of broth-coloured bits off its throat. */
function strikeBurst(g: CanvasRenderingContext2D, view: View, s: Broth, b: Bones, t: number, front: boolean): void {
  const big = 0.5 + 0.5 * bigOf(s), mid = b.body.t, since = (t - BROTH_HITS[s.stage]) * ACT_SECS.strike;
  if (since <= 0) return;
  for (const leg of ['fl2', 'fr2']) {
    const f = place(b[leg], [0, 0, 0]);
    if (nearSide(f, mid, view) === front) puff(g, view, [f[0], f[1], 0.05], (0.2 + 0.15 * s.stage) * big, since / 0.45, leg === 'fl2' ? 3 : 4);
  }
}

/** Evolving: bits of vegetable, leaves of herbs and wisps of steam spiralling up round it and in, gone into it at the flash. */
function evolveSwirl(g: CanvasRenderingContext2D, view: View, s: Broth, b: Bones, t: number, front: boolean): void {
  const big = 0.5 + 0.5 * bigOf(s), mid: V3 = [b.body.t[0], b.body.t[1], b.body.t[2]], M = marksOf(s);
  const swirl = ramp(t, 0.06, 0.16) * (1 - ramp(t, 0.46, 0.52));
  if (swirl <= 0) return;
  const rx = M.w[3] * 1.6 + 0.3 * big, ry = M.w[3] * 1.4 + 0.3 * big, high = M.h[3] * 2.6 + 0.8 * big;
  for (let q = 0; q < 18; q++) {
    const u = clamp((t - 0.06 - 0.1 * jitter(q + 13)) / 0.36), ang = (q / 18) * TAU + u * TAU * 1.4, kk = (1 - u) ** 1.2;
    const p: V3 = [mid[0] + Math.cos(ang) * rx * kk, mid[1] + Math.sin(ang) * ry * kk, 0.1 + u * high];
    if (nearSide(p, mid, view) !== front) continue;
    const [x, y] = onScreen(view, p);
    if (q % 3 === 0) softPuff(g, x, y, 0.22 * big, STEAM, swirl * 0.5);
    else chunk(g, x, y, 0.07 * big * (1 - 0.4 * u), ang * 1.3, BITS_RGB[q % 3], swirl * ramp(u, 0, 0.15), q % 3 === 1);
  }
}

/* ---- the kinds ----------------------------------------------------------------------------- */

function brothKind(look: Broth): Kind {
  const s: Broth = {
    ...look,
    body: rounded(look.body), marks: look.body,
    fore: { ...look.fore, hip: toBody(look, look.fore.hip) },
    hind: { ...look.hind, hip: toBody(look, look.hind.hip) },
    head: { ...look.head, at: toBody(look, look.head.at), pitch: look.head.pitch - look.tilt },
  };
  const bones = brothBones(s);
  return {
    bones,
    build: (lod) => brothBuild(s, lod),
    // The variant's coat tints its green a little and its markings its spots; its cream, its whites and reds, its broth and
    // its golden eyes are the same on every variant, so every one is a green toad cook.
    palette: (coat, mark) => {
      const sat = (c: RGB): number => { const mx = Math.max(...c), mn = Math.min(...c); return mx ? (mx - mn) / mx : 0; };
      const green = mix([154, 178, 72], coat, 0.3 * clamp(sat(coat) / 0.3));
      const spots = mix([98, 128, 50], mark, 0.3 * clamp(sat(mark) / 0.3));
      return coatPalette(coat, mark, {
        coat: green,
        coatDark: mix(green, [44, 60, 34], 0.3),
        coatLight: mix(green, [244, 240, 200], 0.4),
        mark: spots,
        spot: mix(spots, [60, 90, 40], 0.3),
        belly: [248, 236, 206],
        muzzle: [252, 234, 208],
        inner: [226, 112, 112],
        tongue: [244, 150, 146],
        nose: [56, 72, 40],
        lid: [64, 50, 34],
        eye: [34, 24, 20],
        glint: [255, 254, 248],
        bloom: [240, 186, 54],
        billDark: [200, 132, 36],
        pad: [176, 196, 112],
        claw: [74, 58, 46],
        membrane: [120, 150, 70],
        cloth: [252, 250, 244],
        clothDark: [236, 230, 218],
        lining: [206, 58, 46],
        leather: [196, 60, 48],
        leatherDark: [146, 40, 36],
        shell: [246, 238, 222],
        water: [238, 156, 62],
        shellDark: [218, 116, 40],
        horn: [252, 210, 128],
        eyeWhite: [255, 250, 236],
        crystal: [240, 128, 40],
        crystalDark: [200, 92, 30],
        leaf: [112, 160, 64],
        leafDark: [76, 116, 46],
        cap: [150, 96, 58],
        petal: [252, 248, 236],
        wood: [196, 142, 84],
        woodDark: [132, 86, 50],
        metal: [186, 112, 72],
        metalDark: [116, 64, 42],
        metalLit: [232, 166, 112],
      } as Partial<ReturnType<Kind['palette']>>, 30);
    },
    shadow: [lenOf(s) * 0.62 + 0.1, s.hind.at[0] * 1.15],
    stride: 1.1,
    size: s.size,
    blinks: 5,
    acts: ['strike', 'work'],
    leaps: [true, true],
    motes: [[240, 160, 64], [150, 186, 86]],
    extra: (g, view, b, a, under) => {
      const act = a.act, front = !under;
      if (working(a)) {
        const t = act?.kind === 'work' ? act.t : 0, k = act?.kind === 'work' ? downOf(t, a.graze) : a.graze;
        steam(g, view, s, b, a, k, front);
      }
      if (act?.kind === 'strike') strikeBurst(g, view, s, b, act.t, front);
      else if (act?.kind === 'evolve') evolveSwirl(g, view, s, b, act.t, front);
    },
  };
}

export const BROTHLET = brothKind(BROTHLET_LOOK);
export const STOCKBELLY = brothKind(STOCKBELLY_LOOK);
export const CAULDRONTHROAT = brothKind(CAULDRONTHROAT_LOOK);
