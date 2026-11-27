// The glimmersteel set's own builders (tools/sculpt/garments/glimmersteel.mjs), on the plate kit (../platekit.mjs):
//
//   * star glints (`glint`, `starfield`): tiny four-pointed stars standing off a plate, scattered over a grid's cells
//     evenly but not in rows: the starlight held in the blued steel, as geometry of its own.
//   * a star plate (`starPlate`): a flat star of `points` points on a point facing a way (a brooch's star, a rowel, a
//     constellation's stars, the bowl's star-cut piercings).
//   * a crescent (`crescent`): a crescent moon's plate in a plane, its horns tapered to points, its inner edge the
//     deeper cut; `crescentEdge` its outer or inner edge as a path for a rolled edge or a glow line.
//   * the head's dome (`headDome`), the torso's field and its heights (`torsoField`, `torsoMarks`), a frame on a point
//     (`frameAt`), a disc (`discAt`).
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, part } from '../metalkit.mjs';
import { skinSamples, domeWrap, ellipsoidReach, patch, face, shareW, torsoMiddle, torsoWrap } from '../platekit.mjs';

const PI = Math.PI, TAU = PI * 2;
const hash = (x, y) => { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };

/* ---- frames and discs -------------------------------------------------------------------------------------------- */
/** A frame square to `n` on point `c`: x along `up` made square to n (or the world's up), y = n x x. */
export function frameAt(c, n, up = [0, 1, 0]) {
  const o = unit(n);
  let x = sub(up, mul(o, dot(up, o)));
  if (len(x) < 1e-4) x = sub([1, 0, 0], mul(o, dot([1, 0, 0], o)));
  x = unit(x);
  return { c, o, x, y: cross(o, x) };
}
/** A round plate on a point `c` facing `n`: rings from `r0` of its radius out to its rim (`rim(a)`), domed `dome` at its middle. */
export function discAt(c, n, o) {
  const F = frameAt(c, n, o.up), rings = o.rings ?? 2, k = o.k ?? 16, r0 = o.r0 ?? 0.15;
  const rim = typeof o.rim === 'function' ? o.rim : () => o.rim;
  return patch((u, v) => {
    const a = v * TAU, r = rim(a) * (r0 + (1 - r0) * u);
    return { p: add(c, add(mul(F.o, (o.dome ?? 0) * (1 - u * u)), add(mul(F.x, Math.cos(a) * r), mul(F.y, Math.sin(a) * r)))), n: F.o };
  }, rings, k, { closed: true });
}

/* ---- stars ------------------------------------------------------------------------------------------------------- */
/**
 * A star glint on point `c` facing `n`: a low pyramid on a star of `points` points (`r` to a point's tip, `inner` of that
 * to the notch between), its foot sunk `sink`, its top `h` proud, turned `turn`; in `mat`, weighted `w(c)`.
 */
export function glint(c, n, o) {
  const P = part(), k = o.points ?? 4, F = frameAt(c, n, o.up), w = o.w(c), turn = o.turn ?? 0, inner = o.inner ?? 0.3;
  const pt = (p) => { P.V.push(p); P.N.push(F.o); P.W.push(w); return P.V.length - 1; };
  const rim = [...Array(2 * k).keys()].map((j) => { const a = turn + (j * PI) / k, r = j % 2 ? o.r * inner : o.r; return pt(add(c, add(mul(F.o, -(o.sink ?? 0.01)), add(mul(F.x, Math.cos(a) * r), mul(F.y, Math.sin(a) * r))))); });
  const top = pt(add(c, mul(F.o, o.h ?? o.r * 0.4)));
  for (let j = 0; j < 2 * k; j++) face(P, [rim[j], rim[(j + 1) % (2 * k)], top], F.o, o.mat);
  return P;
}
/**
 * Star glints scattered over a grid's rows `i0`..`i1` and columns `j0`..`j1`: one in each of about `count` cells of a
 * jittered lattice (so they never bunch nor fall in rows), those `ok(fi, fj)` refuses left out; each `r` from `r[0]` to
 * `r[1]` (most small, a few large), lifted `lift` off the grid, `seed` choosing the scatter. The steel's held starlight.
 */
export function starfield(G, o) {
  const out = [], seed = o.seed ?? 1, di = o.i1 - o.i0, dj = o.j1 - o.j0;
  const ny = Math.max(1, Math.round(Math.sqrt((o.count * di) / Math.max(1e-6, dj * (o.aspect ?? 1))))), nx = Math.max(1, Math.round(o.count / ny));
  for (let a = 0; a < ny; a++) for (let b = 0; b < nx; b++) {
    const h1 = hash(a + seed * 13.1, b + seed * 7.7), h2 = hash(b + seed * 3.3, a + seed * 17.9), h3 = hash(a * 3.1 + b * 5.3, seed);
    const fi = o.i0 + ((a + 0.15 + 0.7 * h1) / ny) * di, fj = o.j0 + ((b + 0.15 + 0.7 * h2) / nx) * dj;
    if (o.ok && !o.ok(fi, fj)) continue;
    const q = G.at(fi, fj), r = o.r[0] + (o.r[1] - o.r[0]) * h3 ** 3;
    out.push(glint(add(q.p, mul(q.n, o.lift ?? 0)), q.n, { r, h: r * 0.45, points: 4, inner: 0.28, turn: (h1 - 0.5) * 0.5, mat: o.mat, w: o.w, sink: 0.015, up: o.up }));
  }
  return out;
}
/**
 * A flat star on point `c` facing `n`: `points` points `R` to their tips, `inner` of that to the notches, domed `dome`
 * at its middle, turned `turn` (nought: a point straight up `up`). A grid for `solid`: rows from its middle out.
 */
export function starPlate(c, n, o) {
  const F = frameAt(c, n, o.up), k = o.points ?? 5, inner = o.inner ?? 0.42, turn = o.turn ?? 0;
  return patch((u, v) => {
    const j = Math.round(v * 2 * k), a = turn + (j * PI) / k, r = o.R * (j % 2 ? inner : 1) * (0.08 + 0.92 * u);
    return { p: add(c, add(mul(F.o, (o.dome ?? 0) * (1 - u)), add(mul(F.x, Math.cos(a) * r), mul(F.y, Math.sin(a) * r)))), n: F.o };
  }, o.rings ?? 1, 2 * k, { closed: true });
}

/* ---- crescents --------------------------------------------------------------------------------------------------- */
/**
 * A crescent moon's plate in a frame (`F`: its middle `c`, face `o`, up `x`, side `y`): its back on a circle `R` round
 * the middle from angle `-span` to `span` (nought straight down the frame's -x, the belly; its horns rising either side),
 * `wide` across at the belly tapering to points at the horns, the deeper cut on the inside; domed `dome` along its spine.
 * Rows u from its inner edge (nought) to its outer (one), columns v from one horn to the other.
 */
export function crescent(F, o) {
  const span = o.span ?? 2.2, wide = o.wide, inner = o.inner ?? 0.78;
  return patch((u, v) => {
    const a = -span + 2 * span * v, taper = Math.sin(PI * v) ** (o.taper ?? 0.75), t = wide * taper;
    const rr = o.R + t * (u - inner), d = add(mul(F.y, Math.sin(a)), mul(F.x, -Math.cos(a)));
    return { p: add(F.c, add(mul(d, rr), mul(F.o, (o.dome ?? 0) * Math.sin(PI * u) * taper))), n: F.o };
  }, o.nu ?? 2, o.nv ?? 16);
}

/* ---- the head ---------------------------------------------------------------------------------------------------- */
/** How much of weights `w` are on the head and the jaw themselves. */
export const headW = (B, w) => w.reduce((t, [b, x]) => t + (B.bones[b].name === 'head' || B.bones[b].name === 'jaw' ? x : 0), 0);
/**
 * The head's dome: a field round a centre in the head (`D`, read `D.ta(theta / PI, azimuth)`: azimuth nought the face,
 * pi/2 the head's left), as far out as the skin reaches and `fit` more, never inside the ellipsoid round it; with the
 * centre `c` and the polar angle of the brow `browTh`.
 */
export function headDome(B, o = {}) {
  const A = B.at, pick = (q) => headW(B, q.w) > 0.45, hs = skinSamples(B).filter(pick);
  const top = Math.max(...hs.map((q) => q.p[1])), bot = Math.min(...hs.map((q) => q.p[1]));
  const zf = Math.max(...hs.map((q) => q.p[2])), zb = Math.min(...hs.map((q) => q.p[2])), xw = Math.max(...hs.map((q) => q.p[0]));
  const c = [0, bot + 0.56 * (top - bot), (zf + zb) / 2];
  const fit = o.fit ?? (B.who === 'female' ? 0.11 : 0.16);
  const E = [xw + fit, top - c[1] + fit + (o.rise ?? 0), (zf - zb) / 2 + fit];
  const D = domeWrap(B, { c, u: [0, 1, 0], f: [0, 0, 1], s: [1, 0, 0], pick, rows: 30, cols: 48, thMax: PI, cone: 0.3, smooth: 4, shape: (r, th, ph, d) => Math.max(r + fit - 0.02, ellipsoidReach(E, d)) });
  const thOf = (p) => Math.acos(clamp(unit(sub(p, c))[1], -1, 1));
  const browTh = thOf([0, A.head[1] + 0.62 * (top - A.head[1]) / 1.6, zf]);
  return { D, c, E, fit, browTh, top, bot, zf, zb, xw, thOf };
}

/* ---- the torso --------------------------------------------------------------------------------------------------- */
export const TORSO_BONES = new Set(['root', 'pelvis', 'spine_01', 'spine_02', 'spine_03']);
/** The heights the torso's pieces are cut to: the necklines before and behind, the armpit, the waist, the hip. */
export function torsoMarks(B) {
  const A = B.at, sh = A.shoulder.l[1];
  return {
    neckF: lerp(A.neck, A.chest, 0.47)[1], neckB: lerp(A.neck, A.chest, 0.36)[1],
    pit: sh - 0.92, waist: lerp(A.spine1, A.pelvis, 0.45)[1], hip: A.hip.l[1],
  };
}
const FIELDS = new WeakMap();
/** The torso's skin as a field round its middle line, from mid-thigh to over the neck (`F.ta(t, a)`, `F.tOfY`, `F.yOfT`). */
export function torsoField(B) {
  if (FIELDS.has(B)) return FIELDS.get(B);
  const A = B.at;
  const pick = (s) => shareW(B, s.w, 'torso', 'thigh', 'neck', 'head') > 0.8 && headW(B, s.w) < 0.15 && shareW(B, s.w, 'upperarm', 'shoulder', 'forearm', 'hand') < 0.05 && s.p[1] > lerp(A.hip.l, A.knee.l, 0.55)[1];
  const zc = torsoMiddle(B, (s) => shareW(B, s.w, 'torso', 'neck', 'head') > 0.8 && headW(B, s.w) < 0.15);
  const y0 = lerp(A.hip.l, A.knee.l, 0.5)[1], y1 = A.neck[1] + 0.5;
  const G = torsoWrap(B, y0, y1, zc, { pick, nt: 100, na: 64, closed: true, a: [-PI, PI], smooth: 5, shape: (r) => r });
  G.tOfY = (yy) => (yy - y0) / (y1 - y0);
  G.yOfT = (tt) => y0 + (y1 - y0) * tt;
  G.zc = zc;
  FIELDS.set(B, G);
  return G;
}
