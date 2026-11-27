// The fire-tempered steel set's own builders (tools/sculpt/garments/firesteel.mjs), on the plate kit (../platekit.mjs):
//
//   * the head's dome (`headDome`): the skull's field round the head's middle, and the polar angle of the brow.
//   * the torso's field (`torsoField`) and the heights its pieces are cut to (`torsoMarks`).
//   * a crack (`crackPath`): a jagged line wandering across a grid from one point to another, forking, as cooled lava
//     splits; laid on as a band (`crackOn`), its ember showing.
//   * a flame edge (`flameEdge`): an edge cut into licking tongues, each its own height and lean (a pauldron's foot, a
//     knee cop's wing, a cloak's hem).
//   * a ram's horn (`ramHorn`): a ribbed horn swept back from its root and curled down and forward round a centre.
//   * a spike (`spike`): a faceted cone on a point (a knuckle's, a spur's).
//   * a crust plate (`shard`): a jagged slab of cooled lava on a surface, thick, its facets tilted.
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, part } from '../metalkit.mjs';
import { skinSamples, domeWrap, ellipsoidReach, patch, solid, sweep, band, shareW, torsoMiddle, torsoWrap, face, roundProfile } from '../platekit.mjs';

export const PI = Math.PI, TAU = PI * 2;
export const frac = (x) => x - Math.floor(x);
/** A repeatable hash of a number, nought to one. */
export const hash = (x) => frac(Math.sin(x * 127.1 + 311.7) * 43758.5453);

/** How much of weights `w` are on the head and the jaw themselves. */
export const headW = (B, w) => w.reduce((t, [b, x]) => t + (B.bones[b].name === 'head' || B.bones[b].name === 'jaw' ? x : 0), 0);

/**
 * The head's dome: a field round a centre in the head (`D`, read `D.ta(theta / PI, azimuth)`: azimuth nought the face,
 * pi/2 the head's left), as far out as the skin reaches and `fit` more, never inside the ellipsoid `E` round it; with the
 * centre `c`, the polar angle of the brow `browTh`, and the head's reaches.
 */
export function headDome(B, o = {}) {
  const A = B.at, pick = (q) => headW(B, q.w) > 0.45, hs = skinSamples(B).filter(pick);
  const top = Math.max(...hs.map((q) => q.p[1])), bot = Math.min(...hs.map((q) => q.p[1]));
  const zf = Math.max(...hs.map((q) => q.p[2])), zb = Math.min(...hs.map((q) => q.p[2])), xw = Math.max(...hs.map((q) => q.p[0]));
  const c = [0, bot + 0.56 * (top - bot), (zf + zb) / 2];
  const fit = o.fit ?? (B.who === 'female' ? 0.11 : 0.16);
  const E = [xw + fit + (o.wide ?? 0), top - c[1] + fit + (o.rise ?? 0), (zf - zb) / 2 + fit + (o.wide ?? 0)];
  const D = domeWrap(B, { c, u: [0, 1, 0], f: [0, 0, 1], s: [1, 0, 0], pick, rows: o.rows ?? 30, cols: o.cols ?? 48, thMax: PI, cone: 0.3, smooth: 4, shape: (r, th, ph, d) => Math.max(r + fit - 0.02, ellipsoidReach(E, d)) });
  const thOf = (p) => Math.acos(clamp(unit(sub(p, c))[1], -1, 1));
  const browTh = thOf([0, A.head[1] + 0.62 * (top - A.head[1]) / 1.6, zf]);
  return { D, c, E, fit, browTh, top, bot, zf, zb, xw, thOf };
}

/* ---- the torso ----------------------------------------------------------------------------------------------------- */
export const TORSO_BONES = new Set(['root', 'pelvis', 'spine_01', 'spine_02', 'spine_03']);
/** The heights the torso's pieces are cut to: the necklines before and behind, the armpit, the waist, the hip. */
export function torsoMarks(B) {
  const A = B.at, sh = A.shoulder.l[1];
  return {
    neckF: lerp(A.neck, A.chest, 0.47)[1], neckB: lerp(A.neck, A.chest, 0.36)[1],
    pit: sh - 0.92, waist: lerp(A.spine1, A.pelvis, 0.45)[1], hip: A.hip.l[1],
    fauld: A.hip.l[1] - 0.05, tasset: lerp(A.hip.l, A.knee.l, 0.42)[1],
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

/* ---- cracks -------------------------------------------------------------------------------------------------------- */
/**
 * A jagged line across a grid from `[i0, j0]` to `[i1, j1]` (rows, columns) in `n` steps, each step thrown aside by up
 * to `jag` (in columns, square to the line) by the hash of `seed`: as cooled lava splits. Points as `[fi, fj]`.
 */
export function crackPath(from, to, n, jag, seed) {
  const out = [];
  const d = [to[0] - from[0], to[1] - from[1]], L = Math.hypot(d[0], d[1]) || 1, s = [-d[1] / L, d[0] / L];
  for (let k = 0; k <= n; k++) {
    const f = k / n, e = k === 0 || k === n ? 0 : (hash(seed * 13.1 + k * 7.7) * 2 - 1) * jag * Math.sin(PI * f) ** 0.5;
    out.push([from[0] + d[0] * f + s[0] * e, from[1] + d[1] * f + s[1] * e]);
  }
  return out;
}
/** A crack's path on a grid made a band: wider at its start, `wide` across, `high` proud, lifted `lift`. */
export function crackOn(G, pts, o) {
  const path = pts.map(([fi, fj]) => { const q = G.at(fi, fj); return { p: add(q.p, mul(q.n, o.lift ?? 0.01)), n: q.n }; });
  const n = path.length;
  return sweep(path, { ...o, closedProfile: true, profile: (k) => { const w = (o.wide / 2) * (1 - 0.6 * (k / (n - 1))) ** (o.taper ?? 1); const h = o.high ?? 0.015; return [[-w, -0.02], [w, -0.02], [w * 0.5, h], [-w * 0.5, h]]; } });
}

/* ---- flames -------------------------------------------------------------------------------------------------------- */
/**
 * A flame edge's height at `v` (nought to one along the edge): `n` tongues, each a sharp point rising out of round
 * hollows, each its own height (between `lo` and one) and leaning by `lean` toward one end, picked by `seed`.
 */
export function flameEdge(v, n, { lo = 0.55, lean = 0.25, seed = 1, sharp = 1.6 } = {}) {
  const x = clamp(v) * n, k = Math.min(n - 1, Math.floor(x)), f = x - k;
  const h = lo + (1 - lo) * hash(seed * 5.3 + k * 1.7);
  // (a tongue: its peak moved off centre by its lean, the sides falling to round hollows between)
  const peak = 0.5 + lean * (hash(seed * 2.9 + k * 3.1) - 0.3);
  const g = f < peak ? f / peak : (1 - f) / (1 - peak);
  return h * g ** sharp;
}

/* ---- the ram's horn ------------------------------------------------------------------------------------------------ */
/**
 * A ram's horn on side `sg` (+1 the body's left): from `root` (its foot on the skull, facing `n`) it rises and sweeps
 * back, then curls down and forward round a centre `back` behind and `drop` below the root, `turns` of a turn, `r0`
 * across its curl at first and closing to `r1`, drifting out `drift` from the head as it curls. Its section `rad` thick
 * at the root to a point, ribbed every `rib` steps; its rings in `mat(k)` (k along it). Every point weighted `w`.
 */
export function ramHorn(o) {
  const { root, sg, w } = o, steps = o.steps ?? 34, turns = o.turns ?? 1.15, r0 = o.r0, r1 = o.r1 ?? r0 * 0.45;
  // (the curl's plane: up and back, square to the head's side; the curl's centre behind and below the root)
  const up = [0, 1, 0], bk = unit([sg * (o.splay ?? 0), 0, -1]), outX = unit(cross(up, bk)[0] * sg > 0 ? cross(up, bk) : mul(cross(up, bk), -1));
  const th0 = PI * 0.62, C = sub(root, add(mul(up, Math.sin(th0) * r0), mul(bk, Math.cos(th0) * r0)));
  const path = [];
  for (let k = 0; k <= steps; k++) {
    const f = k / steps, th = th0 - turns * TAU * f, r = r0 + (r1 - r0) * f ** 0.9;
    const p = add(C, add(add(mul(up, Math.sin(th) * r), mul(bk, Math.cos(th) * r)), mul(outX, (o.drift ?? 0.3) * f ** 0.8 + (o.lift ?? 0) * Math.sin(PI * Math.min(1, f * 3)))));
    path.push({ p, n: outX });
  }
  // (the section: a rounded triangle, flattened against the head, thick at the root and drawn to a point; a rib every few rings)
  const rad = (k) => { const f = k / steps; return o.rad * (1 - f) ** 0.85 + 0.018; };
  const rib = o.rib ?? 2;
  const prof = (k) => {
    const r = rad(k) * (k % rib === 0 && k < steps - 2 ? 1.07 : 1);
    return [...Array(5).keys()].map((j) => { const a = (j / 5) * TAU; return [Math.cos(a) * r, Math.sin(a) * r * 0.8]; });
  };
  return sweep(path, { closedProfile: true, profile: prof, mat: o.mat, w: () => w });
}

/* ---- spikes and shards --------------------------------------------------------------------------------------------- */
/** A faceted cone `k` sided from a foot `r` across at `c`, `h` long along `d` to its point, every point weighted `w`. */
export function spike(c, d, o) {
  const P = part(), k = o.k ?? 4, nn = unit(d), w = o.w;
  const x = unit(cross(Math.abs(nn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], nn)), y = cross(nn, x);
  const put = (p) => { P.V.push(p); P.N.push(nn); P.W.push(w); return P.V.length - 1; };
  const foot = [...Array(k).keys()].map((j) => { const a = (j / k) * TAU + (o.turn ?? 0); return put(add(c, add(mul(nn, -(o.sink ?? 0.02)), add(mul(x, Math.cos(a) * o.r), mul(y, Math.sin(a) * o.r))))); });
  const tip = put(add(c, mul(nn, o.h)));
  for (let j = 0; j < k; j++) {
    const j1 = (j + 1) % k, m = mul(add(add(P.V[foot[j]], P.V[foot[j1]]), P.V[tip]), 1 / 3);
    face(P, [foot[j], foot[j1], tip], sub(m, c), o.tipMat && j % 2 ? o.tipMat : o.mat);
  }
  return P;
}
/**
 * A shard of crust on a surface (`at(u, v)`: { p, n } over its own square, nought to one each way): its outline a
 * jagged polygon of `k` corners round the square's middle (each its own reach, by `seed`), `thick` proud, its top
 * tilted (`tilt`: the far edge lifted), its top in `mat`, its sides in `side`, every point weighted `w(p)`.
 */
export function shard(at, o) {
  const P = part(), k = o.k ?? 7, seed = o.seed ?? 1;
  const put = (p, n) => { P.V.push(p); P.N.push(n); P.W.push(o.w(p)); return P.V.length - 1; };
  const corners = [...Array(k).keys()].map((j) => {
    const a = ((j + 0.35 * (hash(seed + j * 3.3) - 0.5)) / k) * TAU, r = 0.36 + 0.14 * hash(seed * 7.1 + j);
    return [0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r];
  });
  const lift = (u, v) => (o.thick ?? 0.06) + (o.tilt ?? 0) * u;
  const mid = at(0.5, 0.5), top = put(add(mid.p, mul(mid.n, lift(0.5, 0.5) + (o.dome ?? 0.03))), mid.n);
  const T = [], Bt = [];
  for (const [u, v] of corners) { const q = at(u, v); T.push(put(add(q.p, mul(q.n, lift(u, v))), q.n)); Bt.push(put(add(q.p, mul(q.n, -0.01)), q.n)); }
  for (let j = 0; j < k; j++) {
    const j1 = (j + 1) % k;
    face(P, [T[j], T[j1], top], mid.n, typeof o.mat === 'function' ? o.mat(j) : o.mat);
    const m = mul(add(P.V[T[j]], P.V[T[j1]]), 0.5);
    face(P, [Bt[j], Bt[j1], T[j1], T[j]], sub(m, P.V[top]), o.side);
  }
  P.outline = T.map((i) => P.V[i]);
  return P;
}
/**
 * A crust plate on a surface (`at(x, y)`: { p, n } over its own square, x across nought to one, y down it nought at its
 * head to one at its foot): its head straight (lapped under the row above), its sides drawn in toward its foot, its foot
 * cut to a point (or two, `points`), each its own length by `seed`; a ridge down its middle, its two halves facing apart
 * (`mat(side)` for each: 0 the left half, 1 the right), `thick` proud and its foot lifted `tilt` more; its edges walled
 * in `side`. Every point weighted `w(p)`.
 */
export function crustPlate(at, o) {
  const nu = o.nu ?? 3, nv = o.nv ?? 4, seed = o.seed ?? 1, pts = o.points ?? 1;
  const tipLen = (v) => {
    // (the foot: `pts` points, each its own depth, rising to notches between)
    const x = v * pts, k = Math.min(pts - 1, Math.floor(x)), f = x - k, deep = 0.72 + 0.28 * hash(seed + k * 2.3);
    return 0.62 + (deep - 0.62) * (1 - Math.abs(2 * f - 1)) ** 0.9;
  };
  const G = patch((u, v) => {
    const wid = 1 - (o.narrow ?? 0.35) * u ** 1.5, x = 0.5 + (v - 0.5) * wid, y = u * tipLen(v);
    const q = at(x, y), ridge = (o.ridge ?? 0.03) * (1 - Math.abs(2 * v - 1)) * (0.4 + 0.6 * u);
    return { p: add(q.p, mul(q.n, (o.thick ?? 0.05) + (o.tilt ?? 0) * u + ridge)), n: q.n };
  }, nu, nv);
  return solid(G, { w: (p) => o.w(p), thick: o.thick ?? 0.05, mat: (i, j) => o.mat(j < nv / 2 ? 0 : 1, i), inner: o.inner ?? o.side, edge: o.side });
}
export { roundProfile, band };
