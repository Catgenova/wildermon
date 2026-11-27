// The mithril set's own makings, on the plate kit (tools/sculpt/garments/platekit.mjs): leaves.
//
//   * a leaf (`leafOn`): a blade laid on any surface (`surf(u, x)`: its point and the way out at u along it, nought at
//     its stalk and one at its tip, x across it), as wide as `leafW` says at each u (widest a little below its middle,
//     drawn to a point at the tip), folded along its midrib (its halves rising to the rib: a V across), its tip curled
//     out; made a plate (`solid`), its midrib a bright cord and its outline a rolled edge, as geometry of their own.
//   * a leaf in the open (`leafFree`): a leaf on a frame of its own (a stalk point, the way it points, the way its face
//     looks), bent along its length: a wing, a tine, a brooch's leaf.
//   * a vine (`vine`): a cord wound along a path with small leaves set alternately off it: the set's tracery.
//   * the torso's field and the heights it is cut to (`torsoField`, `torsoMarks`), as the steel set lays its plates.
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, smooth, waistOf, merge } from '../metalkit.mjs';
import { shareW, torsoWrap, torsoMiddle, patch, solid, tube, sweep, colPath, roundProfile } from '../platekit.mjs';

const PI = Math.PI;

/** A leaf's half-width at u along it (nought to one, of one): widest at `peak`, a point at the tip, `base` at the stalk. */
export function leafW(u, o = {}) {
  const peak = o.peak ?? 0.4, a = Math.log(0.5) / Math.log(peak), base = o.base ?? 0.05;
  const k = Math.sin(PI * Math.pow(clamp(u, 0, 1), a)) ** (o.sharp ?? 0.85);
  return Math.max(k, base * (1 - u) ** 2);
}

/**
 * A leaf laid on a surface: `surf(u, x)` gives { p, n } at u along it and x across it (x in the surface's own units).
 * `long` and `wide` its length (to scale u, for the curl) and its greatest half-width; `fold` how far its rib stands
 * out over its edges; `curl` how far its tip lifts off; `nu` and `nv` its grid. Returns the parts (the blade, its rib,
 * its outline), each point weighted `w(p)`; `mat`, `rib` and `rim` their materials (`rib` or `rim` null: none).
 */
export function leafOn(surf, o) {
  const nu = o.nu ?? 8, nv = o.nv ?? 4, wide = o.wide, fold = o.fold ?? wide * 0.35, curl = o.curl ?? 0;
  const shape = o.shape ?? {};
  const at = (u, s) => {
    const hw = wide * leafW(u, shape), x = s * hw, q = surf(u, x);
    const lift = fold * (hw / wide) * (1 - Math.abs(s)) + curl * Math.max(0, (u - (o.curlFrom ?? 0.6)) / (1 - (o.curlFrom ?? 0.6))) ** 2 + (o.lift ?? 0);
    return { p: add(q.p, mul(q.n, lift)), n: q.n };
  };
  const G = patch((u, v) => at(u, -1 + 2 * v), nu, nv);
  const out = [];
  out.push(solid(G, { sheet: o.sheet ?? true, hollow: o.hollow, w: o.w, thick: o.thick ?? 0.03, mat: typeof o.mat === 'function' ? o.mat : () => o.mat, inner: o.inner, edge: o.edge ?? o.inner }));
  if (o.rib !== null && o.rib !== undefined) {
    const path = [];
    const r0 = o.ribFrom ?? 0.04, r1 = o.ribTo ?? 0.9, steps = o.ribSteps ?? 6;
    for (let k = 0; k <= steps; k++) { const q = at(r0 + ((r1 - r0) * k) / steps, 0); path.push({ p: add(q.p, mul(q.n, o.ribLift ?? 0.01)), n: q.n }); }
    out.push(tube(path, { r: o.ribR ?? 0.025, k: 3, mat: o.rib, w: o.w }));
  }
  if (o.rim !== null && o.rim !== undefined) {
    const path = [], steps = o.rimSteps ?? Math.max(3, Math.ceil(nu * 0.6));
    for (let k = 0; k <= steps; k++) { const q = at(k / steps, -1); path.push({ p: q.p, n: q.n }); }
    for (let k = steps - 1; k >= 1; k--) { const q = at(k / steps, 1); path.push({ p: q.p, n: q.n }); }
    out.push(tube(path, { r: o.rimR ?? 0.022, k: 3, mat: o.rim, w: o.w, closed: true }));
  }
  out.G = G; out.at = at;
  return out;
}

/**
 * A leaf in the open: from stalk `o0` along `dir` (bent toward `bend` by `bendK` over its length, an arc), its face
 * looking along `face`; `long` long, `wide` at its widest. As `leafOn` otherwise.
 */
export function leafFree(o0, dir, face, o) {
  const d0 = unit(dir), f0 = unit(sub(face, mul(d0, dot(face, d0))));
  const b0 = o.bend ? sub(o.bend, mul(d0, dot(o.bend, d0))) : f0, bp = len(b0) > 1e-6 ? unit(b0) : f0, bk = o.bendK ?? 0;
  // (the stalk-to-tip line: an arc in the plane of `dir` and `bend`, its direction turning by `bk` radians over its length)
  const stop = o.bendStop ?? 1, ang = (u) => bk * Math.min(u, stop) + (o.bendAfter ?? 0) * Math.max(0, u - stop);
  const dirAt = (u) => add(mul(d0, Math.cos(ang(u))), mul(bp, Math.sin(ang(u))));
  const spine = (u) => {
    const n = 12;
    let p = o0;
    for (let k = 0; k < n; k++) p = add(p, mul(dirAt(((k + 0.5) / n) * u), (o.long * u) / n));
    return p;
  };
  const tangent = (u) => unit(dirAt(u));
  const twist = o.twist ?? 0;
  const surf = (u, x) => {
    const p = spine(u), t = tangent(u);
    // (the face turned about the length by `twist` toward the tip)
    // (the face turned with the length as it bends: the rotation taking `dir` to the tangent here, in the bend's plane)
    const g = ang(u), beta = dot(f0, bp), rest = sub(f0, mul(bp, beta));
    let f = unit(add(rest, mul(add(mul(d0, -Math.sin(g)), mul(bp, Math.cos(g))), beta))), s = cross(t, f);
    const tw = twist * u; [f, s] = [add(mul(f, Math.cos(tw)), mul(s, Math.sin(tw))), add(mul(s, Math.cos(tw)), mul(f, -Math.sin(tw)))];
    // (cupped across: its edges drawn back by `cup`)
    return { p: add(add(p, mul(s, x)), mul(f, -(o.cup ?? 0) * (x / o.wide) ** 2)), n: f };
  };
  return leafOn(surf, o);
}

/**
 * A vine along a path (points `p` with the way out `n`): a cord `r` round, with small leaves set off it alternately
 * every `every` of its length, `leafLong` long, tilted forward along it by `tilt`; all in `mat` (leaves `leafMat`).
 */
export function vine(path, o) {
  const out = [tube(path, { r: o.r ?? 0.03, k: o.k ?? 3, mat: o.mat, w: o.w })];
  const L = [0];
  for (let k = 1; k < path.length; k++) L.push(L[k - 1] + len(sub(path[k].p, path[k - 1].p)));
  const total = L.at(-1), every = o.every ?? 0.35;
  let side = 1;
  for (let x = (o.start ?? every * 0.5); x < total - every * 0.3; x += every) {
    let k = 1;
    while (k < L.length - 1 && L[k] < x) k++;
    const g = clamp((x - L[k - 1]) / Math.max(1e-9, L[k] - L[k - 1])), p = lerp(path[k - 1].p, path[k].p, g), n = unit(lerp(path[k - 1].n, path[k].n, g));
    const t = unit(sub(path[k].p, path[k - 1].p)), sd = unit(cross(n, t));
    const dir = unit(add(mul(sd, side), mul(t, o.tilt ?? 0.8)));
    out.push(...leafFree(add(p, mul(n, 0.005)), dir, n, { long: o.leafLong ?? 0.18, wide: o.leafWide ?? 0.06, nu: 2, nv: 2, fold: 0.015, mat: o.leafMat ?? o.mat, rib: null, rim: null, w: o.w, sheet: true }));
    side = -side;
  }
  return out;
}

/* ---- the torso, as the plates are laid on it --------------------------------------------------------------------- */
const headOnlyW = (B, w) => w.reduce((t, [b, x]) => t + (B.bones[b].name === 'head' || B.bones[b].name === 'jaw' ? x : 0), 0);
export { headOnlyW };
/** The heights the torso's pieces are cut to. */
export function torsoMarks(B) {
  const A = B.at, sh = A.shoulder.l[1];
  return {
    neckF: lerp(A.neck, A.chest, 0.47)[1], neckB: lerp(A.neck, A.chest, 0.36)[1],
    pit: sh - 0.92, waist: waistOf(A), hip: A.hip.l[1],
  };
}
const FIELDS = new WeakMap();
/** The torso's skin as a field round its middle line, from mid-thigh to above the neck (as the steel set's). */
export function torsoField(B) {
  if (FIELDS.has(B)) return FIELDS.get(B);
  const A = B.at;
  const pick = (s) => shareW(B, s.w, 'torso', 'thigh', 'neck', 'head') > 0.8 && headOnlyW(B, s.w) < 0.15 && shareW(B, s.w, 'upperarm', 'shoulder', 'forearm', 'hand') < 0.05 && s.p[1] > lerp(A.hip.l, A.knee.l, 0.55)[1];
  const zc = torsoMiddle(B, (s) => shareW(B, s.w, 'torso', 'neck', 'head') > 0.8 && headOnlyW(B, s.w) < 0.15);
  const y0 = lerp(A.hip.l, A.knee.l, 0.5)[1], y1 = A.neck[1] + 0.5;
  const G = torsoWrap(B, y0, y1, zc, { pick, nt: 100, na: 64, closed: true, a: [-PI, PI], smooth: 5, shape: (r) => r });
  G.tOfY = (yy) => (yy - y0) / (y1 - y0);
  G.yOfT = (tt) => y0 + (y1 - y0) * tt;
  G.zc = zc;
  FIELDS.set(B, G);
  return G;
}
export { PI, merge, sweep, colPath, roundProfile, smooth };
