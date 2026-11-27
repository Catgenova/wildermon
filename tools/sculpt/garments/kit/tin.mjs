// The tin set's own builders (tools/sculpt/garments/tin.mjs), on the plate kit (../platekit.mjs):
//
//   * the head's dome (`headDome`): the skull's field round the head's middle, and the polar angle of the brow.
//   * the torso's field (`torsoField`) and the heights its pieces are cut to (`torsoMarks`).
//   * a key (`keyOf`): a flat key, its bow a ring and its bit notched, laid on a point facing a way (the civic badge,
//     the breastplate's arms).
//   * a cockade (`cockade`): a pleated rosette of ribbon in two colours, a button at its middle (the hat's livery).
//   * a ring of dags (`dagged`): a hem cut into rounded leaves, each its own colour (the chaperon's edge).
import { add, sub, mul, dot, cross, len, unit, lerp, clamp } from '../metalkit.mjs';
import { skinSamples, domeWrap, ellipsoidReach, patch, solid, sweep, shareW, torsoMiddle, torsoWrap } from '../platekit.mjs';

const PI = Math.PI, TAU = PI * 2;

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
  const D = domeWrap(B, { c, u: [0, 1, 0], f: [0, 0, 1], s: [1, 0, 0], pick, rows: 30, cols: 48, thMax: PI, cone: 0.3, smooth: 4, shape: (r, th, ph, d) => Math.max(r + fit - 0.02, ellipsoidReach(E, d)) });
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

/* ---- emblems ------------------------------------------------------------------------------------------------------- */
/** A frame on point `c` facing `n`, its x along `x` (made square to n), y = n x x. */
export function frameAt(c, n, x0) {
  const nn = unit(n), xx = x0 ?? (Math.abs(nn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
  const x = unit(sub(xx, mul(nn, dot(xx, nn))));
  return { o: c, n: nn, x, y: cross(nn, x) };
}
/** A point in a frame: `u` along its x, `v` along its y, `h` out along its normal. */
export const inFrame = (F, u, v, h = 0) => add(F.o, add(add(mul(F.x, u), mul(F.y, v)), mul(F.n, h)));

/**
 * A key on point `c` facing `n`, its shank along `up` (bow up, bit down), `L` long; raised `h` off the point, its parts
 * swept bars (`r` thick) in `mat`, every point weighted `w`. The bow a ring with a hole, the shank, the bit two wards.
 */
export function keyOf(c, n, o) {
  const F = frameAt(c, n, o.up), L = o.L, r = o.r ?? L * 0.07, h = o.h ?? 0.03, out = [];
  const bar = (pts) => sweep(pts.map(([u, v]) => ({ p: inFrame(F, u, v, h), n: F.n })), { closedProfile: true, profile: [[-r, -r * 0.6], [r, -r * 0.6], [r, r], [-r, r]], mat: o.mat, w: o.w });
  // (the bow: a ring at the top, an open middle)
  const bowR = L * 0.2, bc = L * 0.32, ring = [];
  for (let k = 0; k <= 10; k++) { const a = (k / 10) * TAU; ring.push([bc + Math.cos(a) * bowR, Math.sin(a) * bowR * 0.9]); }
  out.push(bar(ring));
  // (the shank down from the bow; the bit: two wards out to one side at the foot)
  out.push(bar([[bc - bowR, 0], [-L * 0.5, 0]]));
  out.push(bar([[-L * 0.5 + r, 0], [-L * 0.5 + r, -L * 0.2], [-L * 0.36, -L * 0.2], [-L * 0.36, 0]]));
  out.push(bar([[-L * 0.27, 0], [-L * 0.27, -L * 0.14]]));
  return out;
}

/**
 * A cockade on point `c` facing `n`: a disc of `pleats` pleats `R` across in `mat`, an inner ring in `mat2`, a button
 * `btn` in the middle; every point weighted `w`.
 */
export function cockade(c, n, o) {
  const F = frameAt(c, n), R = o.R, pl = o.pleats ?? 12;
  const G = patch((u, v) => {
    const a = v * TAU, rr = R * (0.08 + 0.92 * u) * (1 + 0.1 * Math.cos(a * pl) * u);
    return { p: inFrame(F, Math.cos(a) * rr, Math.sin(a) * rr, 0.04 * (1 - u * u) + 0.025 * Math.cos(a * pl) * u), n: F.n };
  }, 3, pl * 2, { closed: true });
  const P = solid(G, { sheet: true, w: o.w, mat: (i) => (i < 1 ? o.btn : i < 2 ? o.mat2 : o.mat) });
  return P;
}

/** A round profile of radius `r`, `k` sides, turned so a flat lies on the path. */
export const roundP = (r, k = 4) => [...Array(k).keys()].map((j) => { const a = (j / k) * TAU + PI / k; return [Math.cos(a) * r, Math.sin(a) * r]; });
void len; void lerp;
