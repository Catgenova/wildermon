// The pewter set's own builders (tools/sculpt/garments/pewter.mjs), on the plate kit (../platekit.mjs):
//
//   * the head's dome (`headDome`) and the torso's field and marks (`torsoField`, `torsoMarks`), as the gold set's.
//   * a frame on a point (`frameAt`): out along a normal, its up along a way given.
//   * a scallop shell (`scallop`): a fluted fan from its hinge, its ribs raised, its rim scalloped, two ears at the hinge
//     (the hat's badge, the cape's scales, the knee cops, the scrip's flap, the brooch).
//   * an ampulla (`ampulla`): a little flask of holy water, its bulb in one material and its neck and lip in another.
//   * crossed keys (`keys`), a pilgrim's staff (`staff`), a round token (`token`): the badges of other shrines.
//   * a wrapped band (`wrapBand`): a strip wound round a limb in a spiral, each turn lapped over the last (puttees, the
//     forearms' wrappings).
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, merge } from '../metalkit.mjs';
import { skinSamples, domeWrap, ellipsoidReach, patch, solid, sweep, stud, tube, shareW, torsoMiddle, torsoWrap, roundProfile } from '../platekit.mjs';

const PI = Math.PI, TAU = PI * 2;

/** How much of weights `w` are on the head and the jaw themselves. */
export const headW = (B, w) => w.reduce((t, [b, x]) => t + (B.bones[b].name === 'head' || B.bones[b].name === 'jaw' ? x : 0), 0);

/** The head's dome (`D`, read `D.ta(theta / PI, azimuth)`), its centre, the polar angle of the brow and the head's reaches. */
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

/* ---- tokens and badges ------------------------------------------------------------------------------------------------ */
/** A frame on a point: `z` out along `n`, `y` along `up` made square to it, `x` across. */
export function frameAt(n, up) {
  const z = unit(n), y = unit(sub(up, mul(z, dot(up, z)))), x = cross(y, z);
  return { x, y, z };
}
const at3 = (c, F, x, y, z) => add(c, add(add(mul(F.x, x), mul(F.y, y)), mul(F.z, z)));

/**
 * A scallop shell, its hinge at `c`, facing `n`, its fan opening along `dir`: `R` from the hinge to the rim, `ribs` ribs
 * raised `rib` (of R), domed `dome` (of R), its fan `span` radians either side; its rim scalloped and in `rim`, its face in
 * `mat`, its ears at the hinge in `ears`. A sheet: the renderer draws it from both sides. Every point weighted `w`.
 */
export function scallop(c, n, dir, o) {
  const F = frameAt(n, dir), R = o.R, ribs = o.ribs ?? 7, span = o.span ?? 1.2, cols = ribs * 2, nu = o.nu ?? 3;
  const rib = (o.rib ?? 0.09) * R, dome = (o.dome ?? 0.28) * R;
  const G = patch((u, v) => {
    const th = (2 * v - 1) * span, ridge = 0.5 + 0.5 * Math.cos(PI * cols * v), side = Math.abs(th) / span;
    // (round at the shoulders, the rim pushed out a little at each rib: scalloped)
    const r = R * (0.1 + 0.9 * u) * (1 - 0.16 * side ** 3) * (1 + 0.06 * ridge * u);
    const h = dome * Math.sin(PI * Math.min(1, 0.15 + u * 0.95)) ** 0.7 * (1 - 0.45 * side * side) + rib * ridge * Math.sin(PI * Math.min(1, u * 1.15)) ** 0.5 + (o.tilt ?? 0) * R * u * u;
    return { p: at3(c, F, Math.sin(th) * r, Math.cos(th) * r, h), n: F.z };
  }, nu, cols);
  const out = [solid(G, { sheet: true, w: o.w, mat: (i, j) => (i === nu - 1 && o.rim ? o.rim : j % 2 === 1 && o.groove ? o.groove : o.mat) })];
  // (a pearl set at the fan's heart)
  if (o.pearl) out.push(stud(at3(c, F, 0, R * 0.3, dome * 0.9), F.z, { r: R * (o.pearlR ?? 0.2), h: R * (o.pearlR ?? 0.2) * 1.1, k: 6, mat: o.pearl, w: o.w }));
  // (the ears: a little wing either side of the hinge)
  if (o.ears !== false) {
    const ew = R * 0.42, eh = R * 0.2;
    const E = patch((u, v) => ({ p: at3(c, F, (2 * v - 1) * ew * (1 - 0.25 * u), -eh * 0.25 + eh * u, dome * 0.25 + 0.01), n: F.z }), 1, 2);
    out.push(solid(E, { sheet: true, w: o.w, mat: () => o.ears ?? o.mat }));
  }
  return merge(...out);
}

/**
 * An ampulla: a little flask from its foot at `c` up along `up`, facing `n`, `H` tall: a flattened bulb (in `glass`), a
 * neck and a lip (in `mat`), two loops for its cord at the shoulders. Every point weighted `w`.
 */
export function ampulla(c, n, up, o) {
  const F = frameAt(n, up), H = o.H, k = 8;
  // (its profile up the axis: radius at each step, the bulb from the foot to two thirds, the neck, the lip)
  const R = [0.02, 0.3, 0.4, 0.42, 0.36, 0.22, 0.11, 0.1, 0.16].map((r) => r * H);
  const path = R.map((_, i) => ({ p: at3(c, F, 0, (H * i) / k, 0), n: F.z }));
  const P = sweep(path, { closedProfile: true, w: o.w, mat: (i) => (i < 5 ? o.glass : o.mat), profile: (i) => roundProfile(R[i], 6).map(([x, y]) => [x, y * 0.6]) });
  // (a rim round the bulb's widest, and the two loops at its shoulders)
  const out = [P];
  out.push(tube([...Array(9).keys()].map((j) => { const a = (j / 8) * TAU; return { p: at3(c, F, Math.cos(a) * R[3] * 1.02, H * 3 / k, Math.sin(a) * R[3] * 0.62), n: F.z }; }), { r: H * 0.035, k: 3, mat: o.mat, w: o.w, closed: true }));
  for (const sg of [1, -1]) out.push(tube([0, 1, 2, 3].map((j) => { const a = (j / 3) * PI; return { p: at3(c, F, sg * (R[5] + Math.sin(a) * H * 0.14), H * (5.2 / k) + Math.cos(a) * H * 0.1, 0), n: F.z }; }), { r: H * 0.03, k: 3, mat: o.mat, w: o.w }));
  return merge(...out);
}

/** A pair of crossed keys at `c` facing `n`, `L` long, their bows up along `up` and out to either side. */
export function keys(c, n, up, o) {
  const F = frameAt(n, up), L = o.L, out = [];
  for (const sg of [1, -1]) {
    const d = [sg * Math.sin(0.62), Math.cos(0.62)], e = [-d[1] * sg, d[0] * sg];
    const pt = (s, t) => at3(c, F, d[0] * s + e[0] * t, d[1] * s + e[1] * t, 0.02 + 0.005 * sg);
    // (the shaft, the bow a ring at its top, the bit a notched flag at its foot)
    out.push(tube([{ p: pt(-L * 0.5, 0), n: F.z }, { p: pt(L * 0.28, 0), n: F.z }], { r: L * 0.045, k: 4, mat: o.mat, w: o.w }));
    const bow = [...Array(9).keys()].map((j) => { const a = (j / 8) * TAU; return { p: pt(L * 0.38 + Math.cos(a) * L * 0.11, Math.sin(a) * L * 0.11), n: F.z }; });
    out.push(tube(bow, { r: L * 0.04, k: 4, mat: o.mat, w: o.w, closed: true }));
    const bit = patch((u, v) => ({ p: pt(-L * 0.5 + u * L * 0.2, sg * (0.02 + v * L * 0.16) * (u > 0.4 && u < 0.6 && v > 0.5 ? 0.6 : 1)), n: F.z }), 2, 1);
    out.push(solid(bit, { thick: 0.025, w: o.w, mat: () => o.mat, edge: o.edge ?? o.mat }));
  }
  return merge(...out);
}

/** A pilgrim's staff at `c` along `up` (facing `n`), `L` long: a shaft, a knob at its top, a hook below the knob. */
export function staff(c, n, up, o) {
  const F = frameAt(n, up), L = o.L, out = [];
  const pt = (s, t = 0) => at3(c, F, t, s, 0.01);
  out.push(tube([{ p: pt(0), n: F.z }, { p: pt(L), n: F.z }], { r: o.r ?? L * 0.035, k: 4, mat: o.mat, w: o.w }));
  out.push(stud(pt(L), F.y, { r: L * 0.08, h: L * 0.12, k: 5, mat: o.knob ?? o.mat, w: o.w }));
  out.push(stud(pt(L * 0.78, 0), F.z, { r: L * 0.07, h: L * 0.06, k: 5, mat: o.knob ?? o.mat, w: o.w }));
  return merge(...out);
}

/** A round token (a shrine's medal) at `c` facing `n`: a disc `r` across, a raised rim, a boss in the middle. */
export function token(c, n, o) {
  const F = frameAt(n, o.up ?? [0, 1, 0]), r = o.r, out = [];
  const D = patch((u, v) => { const a = v * TAU, rr = r * (0.15 + 0.85 * u); return { p: at3(c, F, Math.cos(a) * rr, Math.sin(a) * rr, 0.02 * (1 - u)), n: F.z }; }, 1, 10, { closed: true });
  out.push(solid(D, { sheet: true, w: o.w, mat: () => o.mat }));
  out.push(tube([...Array(11).keys()].map((j) => { const a = (j / 10) * TAU; return { p: at3(c, F, Math.cos(a) * r, Math.sin(a) * r, 0.01), n: F.z }; }), { r: r * 0.14, k: 3, mat: o.rim ?? o.mat, w: o.w, closed: true }));
  out.push(stud(at3(c, F, 0, 0, 0.01), F.z, { r: r * 0.4, h: r * 0.35, k: 5, mat: o.boss ?? o.rim ?? o.mat, w: o.w }));
  return merge(...out);
}

/**
 * A band wound round a limb field `G` (read `G.ta(t, a)`): from `t0` to `t1` along it in `turns` turns, `wide` across
 * (along the limb), out `off(t, a)` off the skin, each turn's lower edge lapped out over the next; `steps` points a turn.
 * Its faces in `mat(k)` (k the point along it), every point weighted `w(p)`.
 */
export function wrapBand(G, o) {
  const n = Math.round(o.turns * (o.steps ?? 12)), out = [];
  const pts = [...Array(n + 1).keys()].map((k) => {
    const f = k / n, t = o.t0 + (o.t1 - o.t0) * f, a = (o.a0 ?? 0) + o.turns * TAU * f * (o.dir ?? 1), q = G.ta(t, a);
    return { t, a, q };
  });
  const dt = (o.t1 - o.t0) / o.turns, wide = o.wide ?? Math.abs(dt) * 1.25;
  // (a strip: across it along the limb, its leading edge (toward t1) under the last turn, its trailing edge out over it)
  const S = patch((u, v) => {
    const k = Math.min(n, Math.round(v * n)), { t, a } = pts[k], tt = t + (u - 0.5) * wide * Math.sign(o.t1 - o.t0), q = G.ta(tt, a);
    return { p: add(q.p, mul(q.n, o.off(tt, a) + (o.lap ?? 0.025) * (1 - u))), n: q.n };
  }, 1, n);
  out.push(solid(S, { sheet: true, w: o.w, mat: (i, j) => o.mat(j) }));
  if (o.edge) out.push(tube([...Array(n + 1).keys()].map((j) => { const q = S.at(0, j); return { p: add(q.p, mul(q.n, 0.005)), n: q.n }; }), { r: o.edgeR ?? 0.018, k: 3, mat: o.edge, w: o.w }));
  return merge(...out);
}
void len; void stud;
