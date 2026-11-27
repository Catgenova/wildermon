// The bronze set's kit (tools/sculpt/garments/metalsets.mjs, the hoplite): hard parts made as surfaces of their own
// rather than the body pushed out, cut to clean outlines, with their trims as geometry.
//
//   * a field (`field`): how far the skin reaches from an axis, at each place along it and angle round it, measured on
//     points sampled over the body's triangles (`skinSamples`), smoothed out and never in, and read anywhere between its
//     samples (a smooth interpolation), so a surface laid by it has no facets of the body's own.
//   * a sheet (`sheet`): a surface given as a function of (u, v), sampled on a grid and cut by a mask (`keep(u, v)`,
//     kept where it is above nought): every cell clipped exactly along the mask's nought line, the crossing found on the
//     surface itself, so an outline (an eye, a hem, a strip's rounded end) is as smooth as the grid is fine, not stepped
//     by its cells. Made solid `thick` deep, a wall round its outline, and its outline handed back as loops (`loops`)
//     for the trims to follow.
//   * trims: a profile swept along a path (`sweep`: a rolled edge, `tube`; a flat raised strip, `strip`), studs (`stud`),
//     and a key pattern (`meander`) laid along a band of a sheet as raised strips of its own.
//   * weights: one bone's (`boneW`), a fixed mix (`mixOf`), or the skin's near a point averaged (`nearSkinW`).
//
// Faces are triangles, wound so the right hand's turn from the first corner faces out; parts are metalkit's `part()`.
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, part } from '../metalkit.mjs';

export const PI = Math.PI, TAU = 2 * Math.PI;
// The pieces' measures, mesh units (a foot each) unless an angle: the cuirass's armholes (ARM_*), the back plate's rise
// (BACK_UP), the shoulder flaps (FLAP_*), the front's give for the arms (PRESS_*), the chlamys (CAPE_*, PANEL_*, FOLD_*,
// SUN_*), the hip's pteruges (HIP_*), the leggings' tiers and straps (TUCK, LEVEL, RING_*, STRAP_*) and chiton (UNDER_*).
const ARM_F = 0.86, ARM_B = 2.34, ARM_BD = 0, ARM_Y0 = 0.8, ARM_Y1 = 1.5;
const BACK_UP = 0.14;
const CHITON_MIN = 0.035;
const FLAP_BACK = 0.5;
const FLAP_X1M = 0.85, FLAP_X1F = 0.8;
const PRESS_A = 0.09, PRESS_X0 = 0.4, PRESS_X1 = 1.1, PRESS_Y = 0.45, PRESS_H = 0.7;
const CLAV = 0;
const FLAP_FRONT = 0.55;
const LIP = 0.1;
const HANG = true;
const BACK_DIP = 0;
const SUN_AT = 0.42, SUN_R = 0.95;
const CAPE_TOP = 0.11;
const TUCK = -0.075;
const SKIRT_TUCK = 0;
const PEC = 0.28, ABS = 0.17;
const HIP_SWING = [0], HIP_BACK = 0.22;
const HIP_FRONT = 0.3, HIP_SPAN = 3.1416, HIP_PT = 0.15, SH_PT0 = 0.02, SH_PT1 = 0.52, SH_PT_OFF = 0.2;
const HIP_TAPER = 0.03;
const HIP_TUCK = 0.5;
const HIP_SIDE = 0.5;
const LEG_DROP = 0.85;
const PANEL_NOTCH = 0;
const FOLD_A = 0.3;
const FOLD_W = 0.9;
const EDGE_OUT = -0.1;
const CROTCH_X = 0.22, CROTCH_Y = 0.5, UNDER_LO = 0.35, UNDER_OFF = 0.06;
const RING_FLARE = 0.03;
const LEVEL = 0.45;
const STRAP_W0 = 0.3, STRAP_W1 = 0.4, RW_UP = 0, RING_NU_F = 5;
const STRAP_BEND = 0.3, STRAP_MIN = 0, STRAP_OFF = 0.2, STRAP_OFFB = 0.19;
const PANEL_W = 1.12;
const FLAP_ROOM = 0.08;
/** (a tally of a builder's parts' faces, when a probe asks for one: `globalThis.TALLY`) */
const tally = (name, ...ps) => { if (globalThis.TALLY) globalThis.TALLY.push([name, ps.reduce((s, P) => s + P.F.length, 0)]); return ps; };
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
/** A smooth maximum of a and b, `k` wide. */
export const smax = (a, b, k = 0.05) => { const h = clamp(0.5 + (0.5 * (b - a)) / k); return a * (1 - h) + b * h + k * h * (1 - h); };
export const smin = (a, b, k = 0.05) => -smax(-a, -b, k);

/* ---- weights ---------------------------------------------------------------------------------------------------- */
/** Weights summed per bone, the heaviest four kept and made to sum to one. */
export function mixW(list) {
  const m = new Map();
  for (const [w, k] of list) for (const [b, x] of w) m.set(b, (m.get(b) ?? 0) + x * k);
  const top = [...m].filter(([, x]) => x > 1e-6).sort((a, b) => b[1] - a[1]).slice(0, 4), s = top.reduce((n, x) => n + x[1], 0) || 1;
  return top.map(([b, x]) => [b, +(x / s).toFixed(5)]);
}
/** All on one bone, by name. */
export const boneW = (B, name) => [[B.bi.get(name), 1]];
/** A fixed mix of bones by name: [[name, share], ...]. */
export const mixOf = (B, list) => mixW(list.filter(([, k]) => k > 0).map(([n, k]) => [[[B.bi.get(n), 1]], k]));
/** Only the bones `ok(name)` allows (none allowed: as given). */
export function keepBones(B, w, ok) { const kept = w.filter(([b]) => ok(B.bones[b].name)); return kept.length ? mixW([[kept, 1]]) : w; }
/** How much of weights `w` are on a part's bones (metalkit PARTS). */
export const shareW = (B, w, ...parts) => w.reduce((s, [b, x]) => s + (parts.includes(B.partOf.get(b)) ? x : 0), 0);

/* ---- the skin, sampled ------------------------------------------------------------------------------------------ */
const SAMPLES = new WeakMap();
/** Points sampled over the body's skin (not its eyes nor brows), `k` steps along each triangle's edges: point, normal, weights. */
export function skinSamples(B, k = 4) {
  const had = SAMPLES.get(B);
  if (had) return had;
  const out = [];
  for (const t of B.tris) {
    const m = B.A.polys[t.poly][1];
    if (m === 1 || m === 2) continue;
    const [a, b, c] = t.v;
    for (let i = 0; i <= k; i++) for (let j = 0; j <= k - i; j++) {
      const u = i / k, v = j / k, w0 = 1 - u - v;
      out.push({ p: add(add(mul(B.V[a], w0), mul(B.V[b], u)), mul(B.V[c], v)), n: unit(add(add(mul(B.N[a], w0), mul(B.N[b], u)), mul(B.N[c], v))), w: mixW([[B.W[a], w0], [B.W[b], u], [B.W[c], v]]) });
    }
  }
  SAMPLES.set(B, out);
  return out;
}
/**
 * Weights at a point: the skin's at the samples nearest it (within `reach` of the nearest), averaged and only the bones
 * `ok` allows: a piece that bends with the body under it as smoothly as the body's weights change there.
 */
export function nearSkinW(B, pick = () => true, ok = () => true, reach = 0.45) {
  const S = skinSamples(B).filter(pick);
  return (p) => {
    let best = Infinity;
    const d = S.map((s) => { const x = len(sub(s.p, p)); if (x < best) best = x; return x; });
    const list = [];
    S.forEach((s, k) => { if (d[k] < best + reach) list.push([s.w, 1 / (0.05 + d[k] - best)]); });
    return keepBones(B, mixW(list), ok);
  };
}

/* ---- fields: the skin's reach round an axis -------------------------------------------------------------------- */
/** Catmull-Rom between b and c (a before, d after), at f. */
const cr = (a, b, c, d, f) => b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)));
/** A grid of numbers read smoothly between its rows (clamped) and columns (going round when `closed`). */
export function smoothRead(R, closed) {
  const rows = R.length, cols = R[0].length;
  const at = (i, j) => R[clamp(i, 0, rows - 1)][closed ? ((j % cols) + cols) % cols : clamp(j, 0, cols - 1)];
  return (fi, fj) => {
    fi = clamp(fi, 0, rows - 1);
    if (!closed) fj = clamp(fj, 0, cols - 1);
    const i = Math.min(rows - 2, Math.floor(fi)), j = Math.floor(fj), a = fi - i, b = fj - j;
    const row = (ii) => cr(at(ii, j - 1), at(ii, j), at(ii, j + 1), at(ii, j + 2), b);
    return cr(row(i - 1), row(i), row(i + 1), row(i + 2), a);
  };
}
/**
 * How far the skin reaches from an axis: `frame(t)` its origin `o`, axis `u` and front `f` (side `s` = u x f unless
 * given) at t along it, `tOf(p)` a skin point's t; rows `nt` + 1 from t[0] to t[1], `na` columns a full turn (angle
 * nought the front, pi/2 the side). Each cell the farthest of the samples `pick` chooses within its window, empty cells
 * filled from their neighbours, smoothed `smooth` times out and never in. `r(t, a)` reads it anywhere; `dir(t, a)` the
 * way out; `at(t, a, off)` the point `off` beyond the skin.
 */
export function field(B, o) {
  const nt = o.nt, na = o.na, t0 = o.t[0], t1 = o.t[1];
  const fr = (t) => { const F = o.frame(t), u = unit(F.u), f = unit(sub(F.f, mul(u, dot(F.f, u)))); const s = F.s ? unit(sub(sub(F.s, mul(u, dot(F.s, u))), mul(f, dot(F.s, f)))) : cross(u, f); return { o: F.o, u, f, s }; };
  const T = [...Array(nt + 1).keys()].map((i) => t0 + ((t1 - t0) * i) / nt);
  const dt = (o.dt ?? 1.5) * Math.abs(t1 - t0) / nt, da = Math.max(o.minDa ?? 0.12, (o.da ?? 1.5) * (TAU / na));
  const S = (o.samples ?? skinSamples(B).filter(o.pick)).map((s) => {
    const t = o.tOf(s.p), F = fr(t), r = sub(s.p, F.o), ru = sub(r, mul(F.u, dot(r, F.u)));
    return { t, a: Math.atan2(dot(ru, F.s), dot(ru, F.f)), r: len(ru) };
  });
  const R = T.map((t) => [...Array(na).keys()].map((j) => {
    const a = (TAU * j) / na;
    let r = 0;
    for (const s of S) if (Math.abs(s.t - t) < dt && Math.abs(wrapAngle(s.a - a)) < da && s.r > r) r = s.r;
    return r;
  }));
  for (let pass = 0; pass < 60; pass++) {
    let left = 0;
    for (let i = 0; i <= nt; i++) for (let j = 0; j < na; j++) {
      if (R[i][j] > 0) continue;
      const got = [R[i][(j + 1) % na], R[i][(j + na - 1) % na], i > 0 ? R[i - 1][j] : 0, i < nt ? R[i + 1][j] : 0].filter((x) => x > 0);
      if (got.length) R[i][j] = got.reduce((x, y) => x + y, 0) / got.length; else left++;
    }
    if (!left) break;
  }
  for (let pass = 0; pass < (o.smooth ?? 3); pass++) {
    const Q = R.map((row) => row.slice());
    for (let i = 0; i <= nt; i++) for (let j = 0; j < na; j++) {
      const n = [R[Math.max(0, i - 1)][j], R[Math.min(nt, i + 1)][j], R[i][(j + 1) % na], R[i][(j + na - 1) % na]];
      Q[i][j] = Math.max(R[i][j], (n.reduce((x, y) => x + y, 0) + R[i][j]) / 5);
    }
    for (let i = 0; i <= nt; i++) R[i] = Q[i];
  }
  // (then relaxed: plain means, the bumps of the coarse body evened out; a little in at the most convex)
  for (let pass = 0; pass < (o.relax ?? 0); pass++) {
    const Q = R.map((row) => row.slice());
    for (let i = 0; i <= nt; i++) for (let j = 0; j < na; j++) {
      const n = [R[Math.max(0, i - 1)][j], R[Math.min(nt, i + 1)][j], R[i][(j + 1) % na], R[i][(j + na - 1) % na]];
      Q[i][j] = (n.reduce((x, y) => x + y, 0) + 2 * R[i][j]) / 6;
    }
    for (let i = 0; i <= nt; i++) R[i] = Q[i];
  }
  const read = smoothRead(R, true);
  const r = (t, a) => read(((t - t0) / (t1 - t0)) * nt, (((a % TAU) + TAU) % TAU) / (TAU / na));
  const frame = (t) => { const F = fr(t); return F; };
  const dir = (t, a) => { const F = fr(t); return add(mul(F.f, Math.cos(a)), mul(F.s, Math.sin(a))); };
  const at = (t, a, off = 0) => { const F = fr(t), d = add(mul(F.f, Math.cos(a)), mul(F.s, Math.sin(a))); return add(F.o, mul(d, r(t, a) + off)); };
  return { r, dir, at, frame, R, T };
}

/* ---- a sheet: a surface cut to a mask and made solid ---------------------------------------------------------- */
const put = (P, p, n, w) => { P.V.push(p); P.N.push(n); P.W.push(w); return P.V.length - 1; };
/** A triangle (corners `v`) turned so its normal goes along `n`. */
export function tri(P, v, n, mat) {
  const [a, b, c] = v.map((i) => P.V[i]), m = cross(sub(b, a), sub(c, a));
  P.F.push({ v: dot(m, n) < 0 ? [v[0], v[2], v[1]] : [v[0], v[1], v[2]], mat });
}
/** A quad as two triangles, turned along `n`. */
export function quad(P, v, n, mat) { tri(P, [v[0], v[1], v[2]], n, mat); tri(P, [v[0], v[2], v[3]], n, mat); }

/**
 * A sheet: the surface `S(u, v)` (a point; u nought to one over `nu` rows, v nought to one over `nv` columns, going round
 * when `closed`), its outside the way `out(u, v)` points, cut to where `keep(u, v)` > 0 (exactly along its nought line),
 * each triangle in `mat(u, v)` (at its middle; null leaves it out). Made solid `thick` (or `thick(u, v)`) deep, its inside
 * in `inner` (false: none, only the wall), a wall round its outline in `edge`; each point weighted `w(p, u, v)`. With `open`, a single surface (no inside, no wall).
 * Handed back with `loops`: its outline, each a closed list of { p, n, u, v, w } on the outside surface.
 */
export function sheet(S, o) {
  const P = part(), nu = o.nu, nv = o.nv, closed = !!o.closed, cols = closed ? nv : nv + 1;
  const keep = o.keep ?? (() => 1), eps = 1e-4;
  const th = typeof o.thick === 'function' ? o.thick : () => o.thick ?? 0.05;
  const vw = (v) => (closed ? ((v % 1) + 1) % 1 : v);
  const normal = (u, v) => {
    const ua = Math.max(0, u - eps), ub = Math.min(1, u + eps);
    const va = closed ? v - eps : Math.max(0, v - eps), vb = closed ? v + eps : Math.min(1, v + eps);
    let n = cross(sub(S(ub, vw(v)), S(ua, vw(v))), sub(S(u, vw(vb)), S(u, vw(va))));
    const want = o.out(u, vw(v));
    if (len(n) < 1e-12) return unit(want);
    n = unit(n);
    return dot(n, want) < 0 ? mul(n, -1) : n;
  };
  // the points: each grid point and each crossing of the mask on a grid edge, once (keyed), with their (u, v)
  const at = new Map(), UV = [];
  const vert = (key, u, v) => {
    if (at.has(key)) return at.get(key);
    const p = S(u, vw(v)), n = normal(u, v), i = put(P, p, n, o.w(p, u, vw(v)));
    UV[i] = [u, vw(v)];
    at.set(key, i);
    return i;
  };
  const K = [...Array(nu + 1).keys()].map((i) => [...Array(nv + 1).keys()].map((j) => keep(i / nu, vw(j / nv))));
  const gp = (i, j) => ({ key: `g${i},${closed ? j % nv : j}`, u: i / nu, v: j / nv, k: K[i][j] });
  const crossing = (a, b) => {
    // (found on the mask itself, by halving: the outline as smooth as the mask, not as the grid)
    let lo = 0, hi = 1, kl = a.k;
    for (let s = 0; s < 22; s++) { const m = (lo + hi) / 2, km = keep(a.u + (b.u - a.u) * m, vw(a.v + (b.v - a.v) * m)); if ((km > 0) === (kl > 0)) { lo = m; kl = km; } else hi = m; }
    const m = (lo + hi) / 2, key = a.key < b.key ? `x${a.key}|${b.key}` : `x${b.key}|${a.key}`;
    return { key, u: a.u + (b.u - a.u) * m, v: a.v + (b.v - a.v) * m, k: 0 };
  };
  const faces = [];
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    if (!closed && j >= nv) continue;
    const c = [gp(i, j), gp(i, j + 1), gp(i + 1, j + 1), gp(i + 1, j)];
    // (the diagonal the shorter way across the cell)
    const diag = len(sub(S(c[0].u, vw(c[0].v)), S(c[2].u, vw(c[2].v)))) <= len(sub(S(c[1].u, vw(c[1].v)), S(c[3].u, vw(c[3].v))));
    const tris = diag ? [[c[0], c[1], c[2]], [c[0], c[2], c[3]]] : [[c[0], c[1], c[3]], [c[1], c[2], c[3]]];
    for (const t of tris) {
      // (clipped to the mask: Sutherland-Hodgman against keep > 0)
      const poly = [];
      for (let k = 0; k < 3; k++) {
        const a = t[k], b = t[(k + 1) % 3];
        if (a.k > 0) poly.push(a);
        if ((a.k > 0) !== (b.k > 0)) poly.push(crossing(a, b));
      }
      if (poly.length < 3) continue;
      const ids = poly.map((q) => vert(q.key, q.u, q.v));
      const mu = poly.reduce((s, q) => s + q.u, 0) / poly.length, mv = poly.reduce((s, q) => s + q.v, 0) / poly.length;
      const m = o.mat(mu, vw(mv));
      if (m === null || m === undefined) continue;
      for (let k = 1; k + 1 < ids.length; k++) {
        const v3 = [ids[0], ids[k], ids[k + 1]], q3 = [poly[0], poly[k], poly[k + 1]];
        // (wound by the grid's own turn, so every face turns the same way; the whole turned over below if need be)
        const area = (q3[1].v - q3[0].v) * (q3[2].u - q3[0].u) - (q3[1].u - q3[0].u) * (q3[2].v - q3[0].v);
        if (Math.abs(area) < 1e-14) continue;
        const n = unit(add(add(P.N[v3[0]], P.N[v3[1]]), P.N[v3[2]]));
        const A = P.V[v3[0]], Bq = P.V[v3[1]], C = P.V[v3[2]];
        faces.push({ v: area < 0 ? [v3[0], v3[2], v3[1]] : v3, mat: m, n, geo: dot(cross(sub(area < 0 ? C : Bq, A), sub(area < 0 ? Bq : C, A)), n) });
      }
    }
  }
  // (turned over if most faces face in)
  if (faces.reduce((t, f) => t + Math.sign(f.geo), 0) < 0) for (const f of faces) f.v = [f.v[0], f.v[2], f.v[1]];
  for (const f of faces) P.F.push({ v: f.v, mat: f.mat });
  // the outline: edges of one face only, chained into loops in the faces' own turn
  const ekey = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);
  const count = new Map();
  for (const f of faces) for (let k = 0; k < 3; k++) { const e = ekey(f.v[k], f.v[(k + 1) % 3]); count.set(e, (count.get(e) ?? 0) + 1); }
  const next = new Map(), edgeMat = new Map();
  for (const f of faces) for (let k = 0; k < 3; k++) { const a = f.v[k], b = f.v[(k + 1) % 3]; if (count.get(ekey(a, b)) === 1) { next.set(a, b); edgeMat.set(a, f.mat); } }
  const loops = [], seen = new Set();
  for (const s of next.keys()) {
    if (seen.has(s)) continue;
    const L = [];
    let c = s;
    while (c !== undefined && !seen.has(c)) { seen.add(c); L.push(c); c = next.get(c); }
    if (L.length > 2) loops.push(L);
  }
  P.loops = loops.map((L) => L.map((i) => ({ p: P.V[i], n: P.N[i], u: UV[i][0], v: UV[i][1], w: P.W[i], i })));
  if (o.open) return P;
  // the inside, `thick` in, and the wall round the outline
  const inner = new Map();
  const inn = (i) => { if (!inner.has(i)) inner.set(i, put(P, sub(P.V[i], mul(P.N[i], th(UV[i][0], UV[i][1]))), P.N[i], P.W[i])); return inner.get(i); };
  if (o.inner !== false) for (const f of faces) P.F.push({ v: [inn(f.v[0]), inn(f.v[2]), inn(f.v[1])], mat: o.inner ?? f.mat });
  if (o.wall !== false) for (const [a, b] of next) {
    const ia = inn(a), ib = inn(b), m = typeof o.edge === 'function' ? o.edge(edgeMat.get(a)) : o.edge ?? edgeMat.get(a);
    // (outward: away from the face the edge bounds, i.e. the edge's direction crossed with the normal)
    const n = cross(sub(P.V[b], P.V[a]), P.N[a]);
    quad(P, [a, b, ib, ia], n, m);
  }
  return P;
}

/* ---- trims ------------------------------------------------------------------------------------------------------ */
/**
 * A profile swept along a path (each point { p, n }: where, and the surface's way out there): the profile's [across, up]
 * pairs laid square to the path, `across` along its side and `up` along the normal; `closed` a loop. Its ends capped.
 * Each point weighted `w(p, k)`; each segment in `mat` (or `mat(k)`; null leaves it out).
 */
export function sweep(path, o) {
  const P = part(), n = path.length, closed = !!o.closed;
  const rings = path.map((q, k) => {
    const prev = path[closed ? (k + n - 1) % n : Math.max(0, k - 1)].p, next = path[closed ? (k + 1) % n : Math.min(n - 1, k + 1)].p;
    const t = unit(sub(next, prev)), up = unit(sub(q.n, mul(t, dot(q.n, t)))), side = cross(t, up);
    const prof = typeof o.profile === 'function' ? o.profile(k, q) : o.profile;
    const w = o.w(q.p, k);
    return prof.map(([x, y]) => put(P, add(add(q.p, mul(side, x)), mul(up, y)), up, w));
  });
  const m = prof0Len(o.profile, path);
  for (let k = 0; k < (closed ? n : n - 1); k++) {
    const a = rings[k], b = rings[(k + 1) % n], c = lerp(path[k].p, path[(k + 1) % n].p, 0.5), up = unit(add(path[k].n, path[(k + 1) % n].n));
    const mk = typeof o.mat === 'function' ? o.mat(k) : o.mat;
    if (mk === null) continue;
    for (let j = 0; j < m; j++) {
      const j1 = (j + 1) % m;
      if (j1 === 0 && o.openProfile) continue;
      const v = [a[j], a[j1], b[j1], b[j]], mid = mul(v.reduce((s, i) => add(s, P.V[i]), [0, 0, 0]), 0.25);
      // (out from the profile's own middle, lifted as the profile is)
      const centre = add(c, mul(up, o.centreUp ?? 0));
      quad(P, v, sub(mid, centre), typeof o.matOf === 'function' ? o.matOf(k, j) : mk);
    }
  }
  if (!closed && o.caps !== false) for (const [k, dir] of [[0, -1], [n - 1, 1]]) {
    const r = rings[k], t = unit(sub(path[Math.min(n - 1, k + 1)].p, path[Math.max(0, k - 1)].p));
    const c = put(P, mul(r.reduce((s, i) => add(s, P.V[i]), [0, 0, 0]), 1 / r.length), t, P.W[r[0]]);
    const mk = typeof o.mat === 'function' ? o.mat(Math.min(k, n - 2)) : o.mat;
    if (mk !== null) for (let j = 0; j < r.length; j++) tri(P, [r[j], r[(j + 1) % r.length], c], mul(t, dir), mk);
  }
  return P;
}
const prof0Len = (profile, path) => (typeof profile === 'function' ? profile(0, path[0]).length : profile.length);
/** A round profile `r` across in `k` sides, its middle lifted `lift`. */
export const roundProfile = (r, k = 6, lift = 0, squash = 1) => [...Array(k).keys()].map((j) => { const a = (j / k) * TAU + PI / k; return [Math.cos(a) * r, lift + Math.sin(a) * r * squash]; });
/** A tube along a path: `r` round, `k` sides, lifted `lift`. */
export const tube = (path, o) => sweep(path, { ...o, profile: roundProfile(o.r, o.k ?? 6, o.lift ?? 0, o.squash ?? 1), centreUp: o.lift ?? 0 });
/** A flat strip `wide` across and `high` proud of the path (its foot sunk `sink`), its sides bevelled `bevel`. */
export const strip = (path, o) => {
  const w = o.wide / 2, h = o.high ?? 0.02, s = o.sink ?? 0.02, b = o.bevel ?? Math.min(w * 0.4, h);
  return sweep(path, { ...o, profile: [[-w, -s], [w, -s], [w, h - b], [w - b, h], [-w + b, h], [-w, h - b]], centreUp: (h - s) / 2 });
};
/** A loop of a sheet's outline (`sheet(...).loops[k]`) as a path, its points `lift` out along the normal and `inset` in toward the sheet. */
export function loopPath(L, { lift = 0, inset = 0, step = 1 } = {}) {
  const n = L.length, out = [];
  for (let k = 0; k < n; k += step) {
    const q = L[k], prev = L[(k + n - 1) % n].p, next = L[(k + 1) % n].p, t = unit(sub(next, prev));
    // (toward the sheet: the faces turn so their outline runs with the sheet on its left looking down the normal)
    const inward = unit(cross(q.n, t));
    out.push({ p: add(add(q.p, mul(q.n, lift)), mul(inward, inset)), n: q.n, w: q.w, u: q.u, v: q.v });
  }
  return out;
}
/** A path resampled evenly along its length, `count` points (a loop when `closed`), each point's normal and fields kept from the nearer. */
export function resamplePath(path, count, closed = false) {
  const pts = closed ? [...path, path[0]] : path, L = [0];
  for (let k = 1; k < pts.length; k++) L.push(L[k - 1] + len(sub(pts[k].p, pts[k - 1].p)));
  const total = L[L.length - 1], out = [];
  for (let s = 0; s < count; s++) {
    const x = (total * s) / (closed ? count : count - 1);
    let k = 1;
    while (k < L.length - 1 && L[k] < x) k++;
    const f = clamp((x - L[k - 1]) / Math.max(1e-9, L[k] - L[k - 1])), a = pts[k - 1], b = pts[k];
    out.push({ ...(f < 0.5 ? a : b), p: lerp(a.p, b.p, f), n: unit(lerp(a.n, b.n, f)) });
  }
  return out;
}
/** A path's length (round a loop when `closed`). */
export const pathLength = (path, closed = false) => { let s = 0; for (let k = 1; k < path.length + (closed ? 1 : 0); k++) s += len(sub(path[k % path.length].p, path[k - 1].p)); return s; };
/** Smoothed along its length (`passes` of neighbour averaging; a loop when `closed`). */
export function smoothPath(path, passes = 2, closed = true) {
  let q = path;
  for (let s = 0; s < passes; s++) q = q.map((x, k) => {
    const n = q.length; if (!closed && (k === 0 || k === n - 1)) return x;
    const a = q[(k + n - 1) % n], b = q[(k + 1) % n];
    return { ...x, p: lerp(x.p, lerp(a.p, b.p, 0.5), 0.5), n: unit(add(add(a.n, b.n), mul(x.n, 2))) };
  });
  return q;
}
/** A stud (a rivet's head, a boss): `k` sided, `r` across its foot, `h` high (domed), its foot sunk `sink`, at `c` facing `n`. */
export function stud(c, n, o) {
  const P = part(), k = o.k ?? 6, r = o.r, h = o.h ?? r * 0.7, nn = unit(n);
  const x = unit(cross(Math.abs(nn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], nn)), y = cross(nn, x), w = o.w(c);
  const ringAt = (rr, hh) => [...Array(k).keys()].map((j) => { const a = (j / k) * TAU; return put(P, add(c, add(mul(nn, hh), add(mul(x, Math.cos(a) * rr), mul(y, Math.sin(a) * rr)))), nn, w); });
  const r0 = ringAt(r, -(o.sink ?? 0.02)), r1 = ringAt(r * (o.waist ?? 0.75), h * 0.6), top = put(P, add(c, mul(nn, h)), nn, w);
  for (let j = 0; j < k; j++) {
    const j1 = (j + 1) % k, mid = add(c, mul(nn, h * 0.2));
    const v = [r0[j], r0[j1], r1[j1], r1[j]], m = mul(v.reduce((s, i) => add(s, P.V[i]), [0, 0, 0]), 0.25);
    quad(P, v, sub(m, mid), o.mat);
    tri(P, [r1[j], r1[j1], top], nn, o.capMat ?? o.mat);
  }
  return P;
}
/** `count` studs evenly along a path (between `from` and `to` of its length), each `o`. */
export function studsAlong(path, count, o, closed = false) {
  const pts = resamplePath(path, closed ? count : count, closed);
  const L = closed ? pts : (() => {
    const from = o.from ?? 0, to = o.to ?? 1, all = resamplePath(path, 400, false);
    return [...Array(count).keys()].map((s) => all[Math.round((from + ((to - from) * (count === 1 ? 0.5 : s / (count - 1)))) * 399)]);
  })();
  return L.map((q) => stud(add(q.p, mul(q.n, o.lift ?? 0)), q.n, o));
}

/**
 * A key pattern (the Greek meander) along a band of a surface: `at(s, h)` the point and its normal at s along the band
 * (nought to one) and h across it (nought its foot, one its head); `count` keys, each a run of raised strips `wide`
 * (as a share of the band's height) and `high` proud, in `mat`. Returns a part.
 */
export function meander(at, o) {
  const P = [], n = o.count, wd = o.wide ?? 0.16;
  // (one key, in units of the band: a line along the foot, up, over, down, in, up a little: the classic running key)
  const key = [[0, 0], [1, 0], [1, 1], [0.25, 1], [0.25, 0.4], [0.6, 0.4], [0.6, 0.65]];
  const segs = [];
  for (let k = 0; k < n; k++) {
    const pts = key.map(([s, h]) => [(k + s * 0.8 + 0.1) / n, h]);
    // (the foot line joins the next key's foot)
    segs.push([[k / n, 0], [(k + 1) / n, 0]]);
    for (let q = 1; q + 1 < pts.length; q++) segs.push([pts[q], pts[q + 1]]);
    segs.push([pts[0], pts[1]]);
  }
  for (const [a, b] of segs) {
    const steps = Math.max(1, Math.ceil(Math.hypot((b[0] - a[0]) * (o.len ?? 1) * n, b[1] - a[1]) * (o.fine ?? 1.2)));
    const path = [...Array(steps + 1).keys()].map((k) => { const s = a[0] + ((b[0] - a[0]) * k) / steps, h = a[1] + ((b[1] - a[1]) * k) / steps; return at(s, h * (1 - wd) + wd / 2); });
    // (lengthened at each end by half the strip's width, so two strips meet square at a corner)
    const ext = (q, r) => { const d = unit(sub(q.p, r.p)); return { ...q, p: add(q.p, mul(d, (o.band * wd) / 2)) }; };
    if (path.length > 1) { path[0] = ext(path[0], path[1]); path[path.length - 1] = ext(path[path.length - 1], path[path.length - 2]); }
    const hw = (o.band * wd) / 2, hh = o.high ?? 0.025, sk = o.sink ?? 0.02;
    // (\`open\`: no underside, where it lies on what it is laid on)
    P.push(sweep(path, o.open ? { profile: [[-hw, -sk], [-hw, hh], [hw, hh], [hw, -sk]], openProfile: true, centreUp: (hh - sk) / 2, caps: false, mat: o.mat, w: o.w } : { profile: [[-hw, -sk], [hw, -sk], [hw, hh], [-hw, hh]], centreUp: (hh - sk) / 2, caps: false, mat: o.mat, w: o.w }));
  }
  return P;
}

/**
 * How far the skin reaches from a centre `c`, each way: polar angle th from up (nought to `thMax`) and azimuth ph from
 * the front toward the body's left; the samples `pick` chooses within `cone` of each way, smoothed `smooth` times out
 * and never in. `r(th, ph)` reads it anywhere, `dir(th, ph)` the way.
 */
export function sphereField(B, o) {
  const rows = o.rows ?? 24, cols = o.cols ?? 48, thMax = o.thMax ?? PI, cone = Math.cos(o.cone ?? 0.3), c = o.c;
  const dir = (th, ph) => [Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph)];
  const S = skinSamples(B).filter(o.pick).map((s) => { const v = sub(s.p, c), L = len(v); return { v: L > 1e-6 ? mul(v, 1 / L) : [0, 1, 0], L }; });
  const R = [];
  for (let i = 0; i <= rows; i++) {
    const row = [];
    for (let j = 0; j < cols; j++) {
      const d = dir((i / rows) * thMax, (j / cols) * TAU);
      let r = 0;
      for (const s of S) { const k = dot(s.v, d); if (k > cone && s.L * k > r) r = s.L * k; }
      row.push(r);
    }
    R.push(row);
  }
  for (let pass = 0; pass < 60; pass++) {
    let left = 0;
    for (let i = 0; i <= rows; i++) for (let j = 0; j < cols; j++) {
      if (R[i][j] > 0) continue;
      const got = [R[i][(j + 1) % cols], R[i][(j + cols - 1) % cols], i > 0 ? R[i - 1][j] : 0, i < rows ? R[i + 1][j] : 0].filter((x) => x > 0);
      if (got.length) R[i][j] = got.reduce((a, b) => a + b, 0) / got.length; else left++;
    }
    if (!left) break;
  }
  for (let pass = 0; pass < (o.smooth ?? 3); pass++) {
    const Q = R.map((row) => row.slice());
    for (let i = 0; i <= rows; i++) for (let j = 0; j < cols; j++) {
      const n = [R[Math.max(0, i - 1)][j], R[Math.min(rows, i + 1)][j], R[i][(j + 1) % cols], R[i][(j + cols - 1) % cols]];
      Q[i][j] = Math.max(R[i][j], (n.reduce((a, b) => a + b, 0) + R[i][j]) / 5);
    }
    for (let i = 0; i <= rows; i++) R[i] = Q[i];
  }
  const pole = R[0].reduce((a, b) => a + b, 0) / cols;
  R[0] = R[0].map(() => pole);
  const read = smoothRead(R, true);
  return { R, dir, r: (th, ph) => read((th / thMax) * rows, ((((ph % TAU) + TAU) % TAU) / TAU) * cols) };
}

/** A sheet's open outlines closed, each with a fan from its middle (a tube's ends), in `mat`. */
export function capLoops(P, mat) {
  const Q = part(), mid = mul(P.V.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / P.V.length);
  for (const L of P.loops) {
    const ids = L.map((q) => put(Q, q.p, q.n, q.w)), cc = mul(L.reduce((s, q) => add(s, q.p), [0, 0, 0]), 1 / L.length), ci = put(Q, cc, [0, 0, 0], L[0].w);
    const n = sub(cc, mid);
    for (let k = 0; k < ids.length; k++) tri(Q, [ids[k], ids[(k + 1) % ids.length], ci], n, mat);
  }
  return Q;
}

/* ==== the hoplite's pieces ======================================================================================== */
import { headCentre, merge } from '../metalkit.mjs';

/**
 * The Corinthian helm: one raised bowl rigid on the head, its face closed but for the almond eyes and the slit down to
 * the chin either side of the nasal, its cheek guards down to the jaw, a notch behind them, the neck guard flared out
 * at the nape; its skull keeled from the cheeks and the neck guard at the brow's height. A rolled edge round its foot,
 * the face's outline rolled in `rune` (lit, the eyes and the slit burn). A fore-and-aft horsehair crest on a bronze stilt.
 */
export function corinthianHelm(B, M) {
  const c = headCentre(B), head = B.bi.get('head'), W = () => [[head, 1]];
  const pick = (s) => s.p[1] > B.at.neck[1] - 0.05 && shareW(B, s.w, 'head', 'neck') > 0.5;
  const F = sphereField(B, { c, pick, rows: 36, cols: 72, thMax: 3.0, cone: 0.22, smooth: 3 });
  const Fs = sphereField(B, { c, pick, rows: 36, cols: 72, thMax: 3.0, cone: 0.22, smooth: 14 });
  // the eyes' height, seen from the centre
  const eyeP = B.A.polys.filter((p) => p[1] === 2).flatMap((p) => p[0]).map((i) => B.V[i]);
  const eyeC = mul(eyeP.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / eyeP.length);
  const thOfP = (p) => { const v = sub(p, c); return Math.acos(clamp(v[1] / len(v), -1, 1)); };
  const E = thOfP([0, eyeC[1], eyeC[2]]), thC = E - 0.12;
  const thMax = 2.95, nu = 26, nv = 48;
  const thOf = (u) => u * thMax;
  /** The bottom edge's polar angle at an azimuth's distance `a` from the front: the chin, the notch, the nape. */
  const thbDesign = (a) => lerp([2.7, 0, 0], [2.32, 0, 0], smoothstep(1.3, 2.6, a))[0] - 0.3 * Math.exp(-(((a - 1.8) / 0.28) ** 2));
  // (kept above what is under it and outside: the trapezius, the collar bones, the neck's foot, with room to nod)
  const NL = 72, lim = new Array(NL).fill(9);
  const shape0 = (th, ph) => radius0(th, ph);
  for (const sm of skinSamples(B)) {
    if (shareW(B, sm.w, 'head') > 0.5 || sm.p[1] > c[1]) continue;
    const v = sub(sm.p, c), r = len(v), th = Math.acos(clamp(v[1] / r, -1, 1)), ph = Math.atan2(v[0], v[2]);
    if (th < 1.9) continue;
    const R = shape0(th, ph);
    if (r < R - 0.24 || r > R + 0.25) continue;
    for (let j = 0; j < NL; j++) { const pj = (j / NL) * TAU; if (Math.abs(wrapAngle(pj - ph)) < 0.12) lim[j] = Math.min(lim[j], th - 0.1); }
  }
  // (and above the cuirass's shoulder flaps, with room for the head to turn and nod over them in a swing)
  for (const p of muscleCuirass(B).flaps.V) {
    const v = sub(p, c), r = len(v), th = Math.acos(clamp(v[1] / r, -1, 1)), ph = Math.atan2(v[0], v[2]);
    if (th < 1.9 || r > shape0(th, ph) + 0.5) continue;
    for (let j = 0; j < NL; j++) { const pj = (j / NL) * TAU; if (Math.abs(wrapAngle(pj - ph)) < 0.2) lim[j] = Math.min(lim[j], th - FLAP_ROOM); }
  }
  for (let pass = 0; pass < 3; pass++) { const q = lim.slice(); for (let j = 0; j < NL; j++) lim[j] = Math.min(q[j], q[(j + 1) % NL], q[(j + NL - 1) % NL]); }
  { const q = lim.slice(); for (let j = 0; j < NL; j++) lim[j] = Math.min(q[j], q[(NL - j) % NL]); }
  for (let pass = 0; pass < 4; pass++) { const q = lim.slice(); for (let j = 0; j < NL; j++) lim[j] = Math.min(q[j], q[(j + 1) % NL], q[(j + NL - 1) % NL]); }
  for (let pass = 0; pass < 30; pass++) { const q = lim.slice(); for (let j = 0; j < NL; j++) lim[j] = (q[(j + 1) % NL] + q[(j + NL - 1) % NL] + 2 * q[j]) / 4; }
  const limAt = (ph) => { const f = ((((ph % TAU) + TAU) % TAU) / TAU) * NL, j = Math.floor(f) % NL, k = f - Math.floor(f); return lim[j] * (1 - k) + lim[(j + 1) % NL] * k; };
  const thb = (a, ph = a) => smin(thbDesign(a), limAt(ph), 0.08);
  /** The radius each way: the skin's (the face's the envelope's) and the shape: clearance, the keel, the neck's flare. */
  function radius0(th, ph) {
    const a = Math.abs(wrapAngle(ph)), face = smoothstep(1.1, 0.5, a) * smoothstep(E - 0.4, E, th);
    const skin = lerp([F.r(th, ph), 0, 0], [Fs.r(th, ph), 0, 0], 0.35 + 0.65 * face)[0];
    const keel = 0.1 * smoothstep(thC - 0.015, thC + 0.035, th) * smoothstep(0.45, 1.05, a);
    const flare = 0.3 * smoothstep(2.0, 2.55, th) ** 1.5 * smoothstep(2.0, 2.8, a);
    const cheek = 0.06 * smoothstep(E, E + 0.6, th) * smoothstep(1.6, 0.6, a);
    const low = 0.12 * smoothstep(1.95, 2.5, th) * smoothstep(0.3, 1.1, a) + 0.07 * Math.exp(-(((a - 1.8) / 0.45) ** 2)) * smoothstep(1.85, 2.2, th);
    return skin + 0.1 + keel + flare + cheek + low;
  }
  const radius = radius0;
  const S = (u, v) => { const th = thOf(u), ph = v * TAU; return add(c, mul(F.dir(th, ph), radius(th, ph))); };
  // the openings: two almond eyes, the slit from them to the chin, the nasal left standing between
  const eye = (a, th) => {
    const x = a - 0.33, ra = 0.3, y = th - (E + 0.015) - 0.2 * x * (x < 0 ? 1.3 : 0.45), rb = 0.11 * Math.max(0.3, 1 - 0.3 * (x / ra) ** 2);
    return (Math.sqrt((x / ra) ** 2 + (y / rb) ** 2) - 1) * Math.min(ra, rb);
  };
  const thN = E + 0.34;
  const sw = (th) => (th < thN + 0.05 ? 0.15 : 0.1 + 0.09 * smoothstep(thb(0) - 0.35, thb(0), th));
  const slit = (a, th) => Math.max(a - sw(th), E + 0.03 - th);
  const nasal = (a, th) => Math.max(a - 0.085 * (1 - 0.25 * smoothstep(E, thN, th)), th - thN);
  const openD = (a, th) => Math.max(smin(eye(a, th), slit(a, th), 0.06), -nasal(a, th));
  const keep = (u, v) => { const th = thOf(u), ph = v * TAU, a = Math.abs(wrapAngle(ph)); return Math.min(openD(a, th), thb(a, ph) - th); };
  const bowl = sheet(S, { nu, nv, closed: true, keep, mat: () => 'brz', thick: 0.06, inner: false, wall: false, w: W, out: (u, v) => F.dir(thOf(u), v * TAU) });
  // the lining: dark, unbroken over the face, so the eyes and the slit are black
  const liner = sheet((u, v) => { const th = thOf(u), ph = v * TAU; return add(c, mul(F.dir(th, ph), radius(th, ph) - 0.075)); }, {
    nu: 10, nv: 18, closed: true, open: true, keep: (u, v) => thb(Math.abs(wrapAngle(v * TAU)), v * TAU) - 0.06 - thOf(u), mat: () => 'brzD', w: W, out: (u, v) => F.dir(thOf(u), v * TAU),
  });
  const parts = [bowl, liner];
  // the rolled edges: round the foot in plain bronze, round the face in the glow; an incised line inside the face's
  for (const L of bowl.loops) {
    const path = smoothPath(resamplePath(loopPath(L, { lift: -0.03 }), Math.max(16, Math.round(pathLength(L, true) / 0.12)), true), 2, true);
    const onFoot = (q) => { const th = thOf(q.u), a = Math.abs(wrapAngle(q.v * TAU)); return Math.abs(th - thb(a, q.v * TAU)) < 0.03; };
    parts.push(tube(path, { r: 0.05, k: 5, closed: true, w: W, mat: (k) => (onFoot(path[k]) && onFoot(path[(k + 1) % path.length]) ? 'brzL' : 'rune') }));
  }
  // the lining's rivets: a row of small bright heads round the foot, a hand above its rolled edge
  for (let k = 0; k < 30; k++) {
    const ph = ((k + 0.5) / 30) * TAU, a = Math.abs(wrapAngle(ph)), th = thb(a, ph) - 0.15;
    if (a < 0.45 || keep(th / thMax, ph / TAU) < 0.04) continue;
    parts.push(stud(S(th / thMax, ph / TAU), F.dir(th, ph), { r: 0.04, h: 0.035, k: 4, sink: 0.01, mat: 'brzL', w: W }));
  }
  // the brows: a raised arch over each eye, meeting over the nasal
  for (const sg of [1, -1]) {
    const path = [...Array(17).keys()].map((k) => { const a = 0.0 + (0.72 * k) / 16, th = E - 0.135 - 0.06 * Math.sin(PI * Math.min(1, a / 0.66)) + 0.1 * smoothstep(0.5, 0.72, a); const ph = sg * a; return { p: S(th / thMax, ph / TAU), n: F.dir(th, ph) }; });
    // (each brow run on past the eye and rolled up into a scroll at the temple)
    const [aE, tE] = [0.72, E - 0.035], ca = aE, ct = tE - 0.14;
    for (let k = 1; k <= 14; k++) { const t = k / 14, phi = PI / 2 - t * 2.4 * PI, r = 0.14 * (1 - 0.7 * t); const a = ca + r * Math.cos(phi), th = ct + r * Math.sin(phi); path.push({ p: S(th / thMax, (sg * a) / TAU), n: F.dir(th, sg * a) }); }
    parts.push(tube(path, { r: 0.05, k: 4, squash: 0.55, w: W, mat: 'brzL' }));
  }
  // the band round the skull over the keel, temple to temple behind: a running key, inlaid dark
  {
    const ph0 = 1.12, ph1 = TAU - 1.12, tTop = thC - 0.2, tBot = thC - 0.035;
    const at = (sv, h) => { const ph = ph0 + (ph1 - ph0) * sv, th = tBot + (tTop - tBot) * h, n = F.dir(th, ph); return { p: add(S(th / thMax, ph / TAU), mul(n, 0.004)), n }; };
    // (framed: a fillet along its head and round each end; its foot is the keel)
    parts.push(tube([...[...Array(4).keys()].map((k) => at(0, k / 4)), ...[...Array(23).keys()].map((k) => at(k / 22, 1)), ...[...Array(4).keys()].reverse().map((k) => at(1, k / 4))], { r: 0.032, k: 3, w: W, mat: 'brzL' }));
    parts.push(...meander((sv, h) => at(sv, 0.1 + 0.8 * h), { count: 14, band: (tBot - tTop) * 1.25 * 0.8, wide: 0.2, high: 0.012, sink: 0.012, mat: 'patina', w: W, open: true, fine: 0.95 }));
  }
  parts.push(...hopliteCrest(B, c, (th, ph) => add(c, mul(F.dir(th, ph), radius(th, ph))), F.dir, W));
  const P = merge(...parts.map((q, k) => (tally('helm' + k, q), q)));
  // the head's polygons inside it, left out (the lining is all that shows through the face)
  const heads = new Map(), jaw = B.bi.get('jaw');
  for (const t of B.tris) heads.set(t.poly, [...(heads.get(t.poly) ?? []), ...t.v]);
  for (const [poly, vs] of heads) {
    if (vs.every((i) => { const v = sub(B.V[i], c), th = Math.acos(clamp(v[1] / len(v), -1, 1)), a = Math.abs(Math.atan2(v[0], v[2])); const hj = B.W[i].reduce((t, [b, x]) => t + (b === head || b === jaw ? x : 0), 0); return (hj > 0.99 || (hj >= 0.25 && a < 1.3)) && th < thb(a, Math.atan2(v[0], v[2])) + 0.03; })) P.hides.add(poly);
  }
  for (const [poly, p] of B.A.polys.entries()) if (p[1] === 1) P.hides.add(poly);
  void M;
  return P;
}

/**
 * The crest: horsehair on a bronze stilt, fore and aft along the skull's middle from the brow over the crown and down
 * behind, deep at the crown, its strands in two reds; the stilt a raised bronze ridge under it. `at(th, ph)` the helm's
 * surface, `dir(th, ph)` the way out.
 */
function hopliteCrest(B, c, at, dir, W) {
  const parts = [];
  // (the path: the polar angle over the front (ph 0) and down the back (ph pi), as one angle s: -0.75 at the brow to 2.25 at the nape)
  const base = (s) => (s < 0 ? at(-s, 0) : at(s, PI));
  const out = (s) => (s < 0 ? dir(-s, 0) : dir(s, PI));
  const s0 = -0.62, s1 = 2.3, nu = 22;
  // (the hair's height over the stilt: rising from the brow, deepest behind the crown, tapering down the back to a tail)
  const H = (s) => 0.12 + 0.95 * Math.sin(PI * smoothstep(s0, 1.25, s)) ** 0.7 * (1 - 0.55 * smoothstep(0.9, s1, s)) + 0.18 * smoothstep(1.4, s1, s);
  const stilt = 0.16;
  const S = (u, v) => {
    const s = s0 + (s1 - s0) * u, o = add(base(s), mul(out(s), stilt)), n = out(s);
    // (the section: a flame, narrow at the stilt and full at the top; v round it from the foot)
    const a = v * TAU, h = H(s) * (1 - Math.cos(a)) / 2, wide = (0.05 + 0.24 * smoothstep(0, 0.55, h / H(s)) * (1 - 0.35 * smoothstep(0.85, 1, h / H(s)))) * (0.6 + 0.4 * smoothstep(s0, s0 + 0.4, s)) * (1 - 0.4 * smoothstep(1.2, s1, s));
    const x = Math.sin(a) * wide * (1 + 0.08 * Math.cos(a * 8));
    return add(add(o, mul(n, h)), [x, 0, 0]);
  };
  const hair = sheet(S, {
    nu, nv: 12, closed: true, open: true, w: W,
    out: (u, v) => { const s = s0 + (s1 - s0) * u, a = v * TAU; return add(mul([1, 0, 0], Math.sin(a)), mul(out(s), -Math.cos(a) * 0.3)); },
    mat: (u, v) => (Math.floor(v * 12) % 3 === 1 || (v > 0.42 && v < 0.58) ? 'crestD' : 'crest'),
  });
  parts.push(hair, capLoops(hair, 'crestD'));
  // the stilt: a bronze ridge from the brow to the nape under the hair
  const path = [...Array(19).keys()].map((k) => { const s = s0 + 0.02 + ((s1 - s0 - 0.04) * k) / 18; return { p: base(s), n: out(s) }; });
  parts.push(strip(path, { wide: 0.1, high: stilt + 0.03, sink: 0.02, bevel: 0.02, mat: 'brzS', w: W }));
  return parts;
}

/* ---- a skin wrap: soft layers (linen, leather) close over the body, cut clean ---------------------------------- */
const pnMid = (a, b, na, nb) => {
  const w1 = dot(sub(b, a), na), w2 = dot(sub(a, b), nb);
  const b210 = mul(sub(add(mul(a, 2), b), mul(na, w1)), 1 / 3), b120 = mul(sub(add(mul(b, 2), a), mul(nb, w2)), 1 / 3);
  const pn = mul(add(add(a, b), mul(add(b210, b120), 3)), 1 / 8);
  const lin = mul(add(a, b), 0.5), n = unit(add(na, nb));
  return add(lin, mul(n, Math.max(0, dot(sub(pn, lin), n))));
};
/**
 * A skin wrap: the body's triangles whose corners `keep(i)` allows (generously: the cut comes after), subdivided `sub`
 * times on curved midpoints, each point out along its normal by `off(p, n, w)` (p its rest point on the body), then cut
 * exactly where `mask(p, n, w)` crosses nought (kept above), each triangle in `mat(p, n)` at its middle. Its outline
 * handed back as `loops` (each point { p, n, w, rest }); with `rim`, the outline turned back toward the skin by `rimIn`
 * in that material. The body's polygons under it whole, every corner `hideMargin` inside the mask, left out.
 */
export function skinWrap(B, o) {
  const P = part();
  const keepV = new Set(B.V.map((_, i) => i).filter((i) => o.keep(i)));
  const tris = B.tris.filter((t) => t.v.every((i) => keepV.has(i)) && B.A.polys[t.poly][1] !== 2 && B.A.polys[t.poly][1] !== 1);
  const S = { p: [], n: [], w: [] }, from = new Map();
  const vOf = (i) => { if (!from.has(i)) { from.set(i, S.p.length); S.p.push(B.V[i]); S.n.push(B.N[i]); S.w.push(B.W[i]); } return from.get(i); };
  let T = tris.map((t) => t.v.map(vOf));
  for (let k = 0; k < (o.sub ?? 2); k++) {
    const mid = new Map();
    const m = (a, b) => {
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      if (!mid.has(key)) { mid.set(key, S.p.length); S.p.push(pnMid(S.p[a], S.p[b], S.n[a], S.n[b])); S.n.push(unit(add(S.n[a], S.n[b]))); S.w.push(mixW([[S.w[a], 0.5], [S.w[b], 0.5]])); }
      return mid.get(key);
    };
    T = T.flatMap(([a, b, c]) => { const ab = m(a, b), bc = m(b, c), ca = m(c, a); return [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]]; });
  }
  // (one pass more where `refine` asks, its neighbours split to meet it: no crack between)
  for (let rp = 0; o.refine && rp < (o.refinePasses ?? 1); rp++) {
    const mid = new Map(), key = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);
    const m = (a, b) => { const k = key(a, b); if (!mid.has(k)) { mid.set(k, S.p.length); S.p.push(pnMid(S.p[a], S.p[b], S.n[a], S.n[b])); S.n.push(unit(add(S.n[a], S.n[b]))); S.w.push(mixW([[S.w[a], 0.5], [S.w[b], 0.5]])); } return mid.get(k); };
    const R = T.map((t) => o.refine(mul(add(add(S.p[t[0]], S.p[t[1]]), S.p[t[2]]), 1 / 3)));
    T.forEach((t, k) => { if (R[k]) { m(t[0], t[1]); m(t[1], t[2]); m(t[2], t[0]); } });
    T = T.flatMap((t) => {
      const [a, b, c] = t, ab = mid.get(key(a, b)), bc = mid.get(key(b, c)), ca = mid.get(key(c, a)), n = [ab, bc, ca].filter((x) => x !== undefined).length;
      if (n === 0) return [t];
      if (n === 3) return [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]];
      if (n === 1) { if (ab !== undefined) return [[a, ab, c], [ab, b, c]]; if (bc !== undefined) return [[a, b, bc], [a, bc, c]]; return [[a, b, ca], [ca, b, c]]; }
      if (ab === undefined) return [[a, b, bc], [a, bc, ca], [ca, bc, c]];
      if (bc === undefined) return [[a, ab, ca], [ab, b, c], [ab, c, ca]];
      return [[a, ab, bc], [ab, b, bc], [a, bc, c]];
    });
  }
  const N2 = S.p.map(() => [0, 0, 0]);
  for (const [a, b, c] of T) { const n = cross(sub(S.p[b], S.p[a]), sub(S.p[c], S.p[a])); for (const i of [a, b, c]) N2[i] = add(N2[i], n); }
  S.n = N2.map((n, i) => (dot(n, S.n[i]) < 0 || len(n) < 1e-12 ? S.n[i] : unit(add(unit(n), S.n[i]))));
  const mask = o.mask ?? (() => 1);
  const K = S.p.map((p, i) => mask(p, S.n[i], S.w[i]));
  // the points: each subdivided point kept, and each crossing of the mask on an edge (its rest point found by halving)
  const at = new Map(), REST = [];
  const vert = (key, p, n, w) => {
    if (at.has(key)) return at.get(key);
    const q = add(p, mul(n, o.off(p, n, w)));
    const i = put(P, q, n, o.weights ? o.weights(p, w) : w); REST[i] = p; at.set(key, i); return i;
  };
  const crossing = (a, b) => {
    let lo = 0, hi = 1;
    const ka = K[a];
    for (let s = 0; s < 18; s++) { const m = (lo + hi) / 2, p = lerp(S.p[a], S.p[b], m), n = unit(lerp(S.n[a], S.n[b], m)); if ((mask(p, n, S.w[a]) > 0) === (ka > 0)) lo = m; else hi = m; }
    const m = (lo + hi) / 2;
    return { key: a < b ? `x${a},${b}` : `x${b},${a}`, p: lerp(S.p[a], S.p[b], m), n: unit(lerp(S.n[a], S.n[b], m)), w: mixW([[S.w[a], 1 - m], [S.w[b], m]]), k: 0 };
  };
  const faces = [];
  for (const t of T) {
    const c = t.map((i) => ({ key: `g${i}`, p: S.p[i], n: S.n[i], w: S.w[i], k: K[i], i }));
    const poly = [];
    for (let k = 0; k < 3; k++) {
      const a = c[k], b = c[(k + 1) % 3];
      if (a.k > 0) poly.push(a);
      if ((a.k > 0) !== (b.k > 0)) poly.push(crossing(a.i, b.i));
    }
    if (poly.length < 3) continue;
    const ids = poly.map((q) => vert(q.key, q.p, q.n, q.w));
    const mp = mul(poly.reduce((s, q) => add(s, q.p), [0, 0, 0]), 1 / poly.length), mn = unit(poly.reduce((s, q) => add(s, q.n), [0, 0, 0]));
    const m = o.mat(mp, mn);
    if (m === null || m === undefined) continue;
    for (let k = 1; k + 1 < ids.length; k++) {
      const v3 = [ids[0], ids[k], ids[k + 1]], [A, Bq, C] = v3.map((i) => P.V[i]), cr = cross(sub(Bq, A), sub(C, A));
      if (len(cr) < 1e-10) continue;
      faces.push({ v: dot(cr, mn) < 0 ? [v3[0], v3[2], v3[1]] : v3, mat: m });
    }
  }
  P.F.push(...faces);
  // the outline
  const ekey = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`), count = new Map();
  for (const f of faces) for (let k = 0; k < 3; k++) { const e = ekey(f.v[k], f.v[(k + 1) % 3]); count.set(e, (count.get(e) ?? 0) + 1); }
  const next = new Map(), edgeMat = new Map();
  for (const f of faces) for (let k = 0; k < 3; k++) { const a = f.v[k], b = f.v[(k + 1) % 3]; if (count.get(ekey(a, b)) === 1) { next.set(a, b); edgeMat.set(a, f.mat); } }
  const loops = [], seen = new Set();
  for (const s0 of next.keys()) { if (seen.has(s0)) continue; const L = []; let c = s0; while (c !== undefined && !seen.has(c)) { seen.add(c); L.push(c); c = next.get(c); } if (L.length > 2) loops.push(L); }
  P.loops = loops.map((L) => L.map((i) => ({ p: P.V[i], n: P.N[i], w: P.W[i], rest: REST[i], i })));
  if (o.rim) {
    const inner = new Map();
    const inn = (i) => { if (!inner.has(i)) inner.set(i, put(P, add(REST[i], mul(P.N[i], o.rimIn ?? 0.01)), P.N[i], P.W[i])); return inner.get(i); };
    for (const [a, b] of next) { const m = typeof o.rim === 'function' ? o.rim(edgeMat.get(a), REST[a]) : o.rim; if (m === null) continue; const n = cross(sub(P.V[b], P.V[a]), P.N[a]); quad(P, [a, b, inn(b), inn(a)], n, m); }
  }
  if (o.hide !== false) {
    const byPoly = new Map(), all = new Map();
    for (const t of tris) byPoly.set(t.poly, [...(byPoly.get(t.poly) ?? []), ...t.v]);
    for (const t of B.tris) all.set(t.poly, [...(all.get(t.poly) ?? []), ...t.v]);
    const hm = o.hideMargin ?? 0.05;
    for (const [poly, vs] of byPoly) if ((all.get(poly) ?? []).length === vs.length && !(o.showPoly && o.showPoly(vs)) && vs.every((i) => mask(B.V[i], B.N[i], B.W[i]) > (o.hideMarginAt ? o.hideMarginAt(i) : hm) && (!o.hideOk || o.hideOk(i)))) P.hides.add(poly);
  }
  return P;
}

/** A torso's middle line's depth at each height: halfway between its front and back (the samples `pick` chooses, within 0.35 of the middle), smoothed. */
export function torsoMiddle(B, pick) {
  const S = skinSamples(B).filter(pick), ys = S.map((s) => s.p[1]), lo = Math.min(...ys), hi = Math.max(...ys), n = 40;
  const Z = [...Array(n + 1).keys()].map((k) => {
    const y = lo + ((hi - lo) * k) / n, near = S.filter((s) => Math.abs(s.p[1] - y) < (hi - lo) / n && Math.abs(s.p[0]) < 0.35);
    return near.length ? (Math.min(...near.map((s) => s.p[2])) + Math.max(...near.map((s) => s.p[2]))) / 2 : null;
  });
  for (let k = 0; k <= n; k++) if (Z[k] === null) Z[k] = Z.slice(0, k).reverse().find((z) => z !== null) ?? Z.find((z) => z !== null) ?? 0;
  for (let pass = 0; pass < 4; pass++) for (let k = 1; k < n; k++) Z[k] = (Z[k - 1] + 2 * Z[k] + Z[k + 1]) / 4;
  return (y) => { const f = clamp(((y - lo) / (hi - lo)) * n, 0, n), k = Math.min(n - 1, Math.floor(f)); return Z[k] + (Z[k + 1] - Z[k]) * (f - k); };
}
const TORSO_BONES = new Set(['root', 'pelvis', 'spine_01', 'spine_02', 'spine_03']);
import { waistOf } from '../metalkit.mjs';

/**
 * The muscle cuirass: one bronze shell round the torso, front and back, sculpted (the chest, the belly's six, the
 * spine's groove and the shoulder blades), its foot flared out over the hips and dipping over the belly, a wide neck and
 * deep armholes leaving straps over the shoulders; rolled edges round every opening; a key pattern round its foot over a
 * dark band, in `rune`; studs where the straps meet the chest and down each side's hinge.
 */
export function muscleCuirass(B) {
  const A = B.at, male = B.who === 'male', waist = waistOf(A), sx = A.shoulder.l[0];
  const pick = (s) => shareW(B, s.w, 'torso', 'shoulder', 'thigh', 'neck') > 0.8 && shareW(B, s.w, 'shoulder') < 0.25 && shareW(B, s.w, 'upperarm') < 0.03 && shareW(B, s.w, 'head') < 0.1;
  const zc = torsoMiddle(B, (s) => shareW(B, s.w, 'torso') > 0.8 && shareW(B, s.w, 'neck', 'head') < 0.25);
  const y0 = A.hip.l[1] - 0.7, y1 = A.neck[1] - 0.05;
  // the shoulders' tops: the highest of the torso's skin out over them
  const plateau = Math.max(...skinSamples(B).filter((s) => pick(s) && Math.abs(s.p[0]) > 0.62 * sx && Math.abs(s.p[0]) < 0.78 * sx).map((s) => s.p[1]));
  // (the shoulders' tops left out of the field: the plates stop under them, so their walls go straight up there)
  const F = field(B, { pick: (s) => pick(s) && s.p[1] < plateau - 0.15, nt: 80, na: 72, t: [0, 1], smooth: 4, relax: 6, dt: 0.7, frame: (t) => { const yy = y0 + (y1 - y0) * t; return { o: [0, yy, zc(yy)], u: [0, 1, 0], f: [0, 0, 1], s: [1, 0, 0] }; }, tOf: (p) => (p[1] - y0) / (y1 - y0) });
  const tOf = (yy) => (yy - y0) / (y1 - y0);
  // the outline: the foot, the neck; the armholes are holes under the straps
  const ySide = waist - 0.3, yFront = A.hip.l[1] - (male ? 0.15 : 0.05), yBack = A.hip.l[1] + (male ? 0.2 : 0.1);
  const yb = (a) => { const c = Math.cos(a); return ySide - (ySide - yFront) * Math.max(0, c) ** 1.6 - (ySide - yBack) * Math.max(0, -c) ** 2; };
  // (the plates stop under the shoulders' tops: front and back are joined over them by the shoulder flaps)
  const yS = plateau - 0.16;
  const yTop = (a) => {
    const x = Math.abs(wrapAngle(a));
    const dF = (male ? 0.34 : 0.38) * Math.max(0, 1 - (x / 0.7) ** 2) ** 0.5;
    // (the back plate up to the trapezius under the flaps, a shallow dip at the spine)
    const uB = 0.14 * smoothstep(1.9, 2.4, x) + BACK_UP * smoothstep(2.3, 2.9, x) - 0.05 * Math.max(0, 1 - ((PI - x) / 0.35) ** 2) ** 0.5;
    return yS - dF + uB;
  };
  const yArm = A.shoulder.l[1] - (male ? 1.15 : 1.0), yAT = plateau + 0.6, ac = ARM_F + (ARM_B - ARM_F) / 2;
  // (the armhole's back edge in over the shoulder blade, out again behind the arm where it hangs)
  const arm = (a, yy) => { const ab = ARM_B - ARM_BD * smoothstep(yArm + ARM_Y0, yArm + ARM_Y1, yy), c0 = (ARM_F + ab) / 2, w0 = (ab - ARM_F) / 2, x = (Math.abs(wrapAngle(a)) - c0) / w0, z = (yy - (yArm + yAT) / 2) / ((yAT - yArm) / 2); return (Math.abs(x) ** 2.4 + Math.abs(z) ** 2.4) ** (1 / 2.4) - 1; };
  // the shape: clearance over the chiton, the flare, the sculpting
  const chestY = A.chest[1];
  const bump = (dx, dy, rx, ry) => { const d = (dx / rx) ** 2 + (dy / ry) ** 2; return d >= 1 ? 0 : (1 - d) ** 1.6; };
  const sculpt = (p, a, yy) => {
    const x = p[0], ax = Math.abs(x), front = Math.max(0, Math.cos(a)), back = Math.max(0, -Math.cos(a));
    let o = 0;
    if (male) {
      // (the pectorals, their foot a clear shelf)
      const foot = chestY - 0.32 + 0.22 * Math.min(1, ax / (0.75 * sx));
      o += PEC * bump(ax - 0.5 * sx / 1.59, yy - (chestY + 0.1), 0.5, 0.5) * smoothstep(foot - 0.05, foot + 0.06, yy) * front;
    }
    // (the belly's six: three rows of two, the line down the middle between)
    const abTop = chestY - (male ? 0.5 : 0.75), abBot = waist + 0.05, h = (abTop - abBot) / 3;
    if (yy < abTop && yy > abBot && ax < 0.42) {
      const r = Math.floor((abTop - yy) / h), cy = abTop - h * (r + 0.5);
      o += (male ? ABS : 0.6 * ABS) * bump(ax - 0.19, yy - cy, 0.18, h * 0.6) * front;
    }
    // (the back: the spine's groove, the shoulder blades)
    o -= 0.07 * Math.exp(-((ax / 0.13) ** 2)) * back * smoothstep(yb(a) + 0.2, yb(a) + 0.6, yy);
    o += 0.16 * bump(ax - 0.55 * sx / 1.59, yy - (chestY + 0.3), 0.5, 0.7) * back;
    o += 0.07 * bump(ax - 0.3, yy - (waist + 0.45), 0.26, 0.6) * back;
    // (the front pressed in a little where the forearms cross it in a swing)
    o -= PRESS_A * front * smoothstep(PRESS_X1, PRESS_X0, ax) * Math.exp(-(((yy - (chestY - PRESS_Y)) / PRESS_H) ** 2));
    return o;
  };
  const radius = (t, a) => {
    const yy = y0 + (y1 - y0) * t, base = F.r(t, a);
    const flare = (0.2 * smoothstep(waist + 0.3, yb(a) - 0.05, yy) * (0.6 + 0.4 * Math.abs(Math.sin(a))) + 0.07 * smoothstep(yb(a) + 0.5, yb(a), yy)) * (1 - 0.5 * Math.max(0, -Math.cos(a)));
    // (the armholes' edges stood off further, clear of the shoulder blades and the chest as the arms move)
    const lip = LIP * smoothstep(0.45, 0.0, arm(a, yy)) * smoothstep(yArm + 0.3, yArm + 0.8, yy) * smoothstep(yTop(a) - 0.05, yTop(a) - 0.4, yy) + 0.05 * smoothstep(yTop(a) - 0.4, yTop(a), yy) * smoothstep(1.2, 0.6, Math.abs(Math.cos(a)) < 0 ? 0 : 1 - Math.abs(Math.sin(a)));
    return base + 0.15 + flare + lip;
  };
  const Sb = (u, a) => add(F.frame(u).o, mul(F.dir(u, a), F.r(u, a)));
  const nOf = (u, a) => { const e = 0.004, du = sub(Sb(Math.min(1, u + e), a), Sb(Math.max(0, u - e), a)), dv = sub(Sb(u, a + e * 3), Sb(u, a - e * 3)); const n = unit(cross(dv, du)); return len(n) > 0 ? n : F.dir(u, a); };
  const S = (u, v) => { const a = v * TAU, F0 = F.frame(u), d = F.dir(u, a), n = nOf(u, a), p0 = Sb(u, a), up = 0.15 + 0.07 * smoothstep(plateau - 0.35, plateau, F0.o[1]), p = add(add(p0, mul(n, up)), mul(d, radius(u, a) - F.r(u, a) - 0.15)); return add(p, mul(d, sculpt(p, a, F0.o[1]))); };
  // (the straps end over the shoulders short of the joint, cut fore and aft)
  const xLim = (male ? 0.72 : 0.8) * sx;
  const keep = (u, v) => { const a = v * TAU, yy = y0 + (y1 - y0) * u; return Math.min(yy - yb(a), yTop(a) - yy, arm(a, yy) * 0.4); };
  const W = CLAV === 2 ? nearSkinW(B, (s) => shareW(B, s.w, 'torso', 'shoulder', 'upperarm') > 0.8 && shareW(B, s.w, 'head', 'neck') < 0.1, (n) => TORSO_BONES.has(n) || n.startsWith('clavicle') || n.startsWith('upperarm'), 0.35) : nearSkinW(B, (s) => shareW(B, s.w, 'torso') > 0.7, (n) => TORSO_BONES.has(n) || (CLAV && n.startsWith('clavicle')), 0.35);
  const shellP = sheet(S, { nu: 30, nv: 48, closed: true, keep, mat: () => 'brz', thick: 0.06, inner: false, wall: false, w: (p) => W(p), out: (u, v) => F.dir(u, v * TAU) });
  const parts = [shellP];
  for (const L of shellP.loops) {
    const path = smoothPath(resamplePath(loopPath(L, { lift: -0.025 }), Math.max(16, Math.round(pathLength(L, true) / 0.21)), true), 2, true);
    parts.push(tube(path, { r: 0.055, k: 4, closed: true, w: (p) => W(p), mat: 'brzL' }));
  }
  // the key pattern round the foot, raised over a dark band that follows the foot's curve
  const bandAt = (s, h) => { const a = -PI + TAU * s, yy = yb(a) + 0.16 + 0.34 * h, u = tOf(yy), v = (((a / TAU) % 1) + 1) % 1, p = S(u, v); return { p, n: F.dir(u, a) }; };
  const mid = [...Array(49).keys()].map((k) => bandAt(k / 48, 0.5)).slice(0, 48);
  parts.push(sweep(mid, { closed: true, profile: [[-0.2, -0.02], [0.2, -0.02], [0.2, 0.012], [-0.2, 0.012]], w: (p) => W(p), mat: 'patina', openProfile: false }));
  parts.push(...meander((s, h) => { const q = bandAt(s, h); return { p: add(q.p, mul(q.n, 0.012)), n: q.n }; }, { count: 13, band: 0.34, wide: 0.2, high: 0.03, sink: 0.01, mat: 'rune', w: (p) => W(p) }));
  // the nipples' studs (a man's), the straps' studs at the front, the hinge's down each side
  const on = (yy, a, lift = 0) => { const u = tOf(yy), v = (((a / TAU) % 1) + 1) % 1, p = S(u, v); return { p: add(p, mul(F.dir(u, a), lift)), n: F.dir(u, a) }; };
  const atX = (x, yy) => { let best = 0, bd = 9; for (let k = -40; k <= 40; k++) { const a = (k / 40) * 1.4, q = on(yy, a); if (Math.abs(q.p[0] - x) < bd) { bd = Math.abs(q.p[0] - x); best = a; } } return best; };
  if (male) for (const sg of [1, -1]) { const q = on(chestY + 0.02, atX(sg * 0.52 * sx / 1.59, chestY + 0.02)); parts.push(stud(q.p, q.n, { r: 0.06, h: 0.04, k: 6, mat: 'brzL', w: (p) => W(p) })); }
  for (const sg of [1, -1]) {
    for (let k = 0; k < 3; k++) { const yy = lerp([yArm - 0.25, 0, 0], [yb(sg * PI / 2) + 0.75, 0, 0], k / 2)[0], q = on(yy, sg * ac); parts.push(stud(q.p, q.n, { r: 0.065, h: 0.05, k: 6, mat: 'brzL', w: (p) => W(p) })); }
  }
  // the anatomy's lines on the front, raised and polished: the pectorals' foot (a man's), the girdle over the hips
  {
    const ridge = (pts) => { const path = smoothPath(pts.map(([x, yy]) => { const q = on(yy, atX(x, yy), -0.006); return { p: q.p, n: q.n }; }), 1, false); parts.push(tube(path, { r: 0.034, k: 4, squash: 0.6, w: (p) => W(p), mat: 'brzL' })); };
    const kx = sx / 1.59;
    for (const sg of [1, -1]) {
      if (male) ridge([...Array(11).keys()].map((k) => { const ax = (0.07 + (k / 10) * 0.86) * kx; return [sg * ax, chestY - 0.34 + 0.22 * Math.min(1, ax / (0.75 * sx)) + 0.22 * smoothstep(0.6 * kx, 0.93 * kx, ax)]; }));
      ridge([...Array(11).keys()].map((k) => { const t = k / 10; return [sg * (0.82 - 0.64 * t) * kx, waist + (male ? 0.2 : 0.3) + (yb(0) + 0.6 - waist - (male ? 0.2 : 0.3)) * t - 0.1 * Math.sin(PI * t)]; }));
    }
  }
  // the front's furrows, incised dark: down the middle from the breastbone, between the belly's rows and round its sides
  {
    const groove = (pts) => { const path = pts.map(([x, yy]) => { const q = on(yy, atX(x, yy), 0.006); return { p: q.p, n: q.n }; }); parts.push(sweep(path, { profile: [[-0.07, -0.012], [-0.03, 0.006], [0.03, 0.006], [0.07, -0.012]], openProfile: true, caps: false, mat: 'brzM', w: (p) => W(p) })); };
    const abTop = chestY - (male ? 0.5 : 0.75), abBot = waist + 0.05, h = (abTop - abBot) / 3;
    groove([...Array(9).keys()].map((k) => [0, (male ? chestY + 0.15 : abTop + 0.05) - (((male ? chestY + 0.15 : abTop + 0.05) - abBot) * k) / 8]));
    for (let r = 1; r <= 2; r++) groove([...Array(7).keys()].map((k) => { const x = -0.36 + (0.72 * k) / 6; return [x, abTop - h * r + 0.04 * (1 - (x / 0.36) ** 2)]; }));
    for (const sg of [1, -1]) groove([...Array(7).keys()].map((k) => [sg * (0.37 + 0.03 * Math.sin((PI * k) / 6)), abTop + 0.05 - ((abTop + 0.05 - abBot) * k) / 6]));
  }
  // the back: each shoulder blade's outline and the spine's groove incised, dark
  {
    const atXB = (x, yy) => { let best = PI, bd = 9; for (let k = -40; k <= 40; k++) { const a = PI + (k / 40) * 1.4, q = on(yy, a); if (Math.abs(q.p[0] - x) < bd) { bd = Math.abs(q.p[0] - x); best = a; } } return best; };
    const line = (pts) => { const path = pts.map(([x, yy]) => { const q = on(yy, atXB(x, yy), 0.006); return { p: q.p, n: q.n }; }); parts.push(sweep(path, { profile: [[-0.03, -0.012], [-0.03, 0.01], [0.03, 0.01], [0.03, -0.012]], openProfile: true, caps: false, mat: 'brzS', w: (p) => W(p) })); };
    for (const sg of [1, -1]) {
      const cx = 0.55 * sx / 1.59, cy = chestY + 0.3, rx = 0.44, ry = 0.62;
      line([...Array(15).keys()].map((k) => { const t = 0.45 * PI + (k / 14) * 1.3 * PI; return [sg * (cx + rx * Math.cos(t)), cy + ry * Math.sin(t)]; }));
    }
    line([...Array(11).keys()].map((k) => [0, yTop(PI) - 0.12 - ((yTop(PI) - 0.12 - (yb(PI) + 0.45)) * k) / 10]));
  }
  const flapParts = [1, -1].flatMap((sg) => shoulderFlap(B, sg, plateau, zc, { plate: [shellP, ...parts.slice(1, 1 + shellP.loops.length)], W }));
  parts.push(...flapParts);
  const P = merge(...parts.map((q, k) => (tally('cuirass' + k, q), q)));
  // the body's polygons well inside it, left out
  const aOf = (p) => Math.atan2(p[0], p[2] - zc(p[1]));
  const inside = (i) => { const p = B.V[i], a = aOf(p); return B.share(i, 'torso') > 0.9 && p[1] > yb(a) + 0.15 && p[1] < yTop(a) - 0.15 && arm(a, p[1]) > -0.12; };
  const polys = new Map();
  for (const t of B.tris) polys.set(t.poly, [...(polys.get(t.poly) ?? []), ...t.v]);
  for (const [poly, vs] of polys) if (vs.every(inside)) P.hides.add(poly);
  return { P, yb, yTop, F, S, tOf, W, arm, aOf, yArm, yAT, zc, plateau, flaps: merge(...flapParts) };
}

/**
 * A shoulder flap: the stiff bronze strap that ties the back plate to the front over each shoulder, laid round a line
 * across the shoulder (the body's x): from low on the back plate, close over it, over the shoulder's top and down onto
 * the chest, close over the front plate, its front end a rounded tongue fixed by a boss; a rib down its middle, rolled
 * edges. On the plates it moves with them (`o.W`); over the shoulder's top with the skin there, the collar bone's too.
 */
export function shoulderFlap(B, sg, plateau, zc, o) {
  const A = B.at, sx = A.shoulder.l[0], s = sg > 0 ? 'l' : 'r', male = B.who === 'male';
  const x0 = (male ? 0.44 : 0.43) * sx, x1 = (male ? FLAP_X1M : FLAP_X1F) * sx;
  const yc = plateau - 0.55, zc0 = zc(plateau - 0.4);
  const inBand = (p) => p[0] * sg > x0 - 0.25 && p[0] * sg < x1 + 0.25 && p[1] > plateau - 1.8;
  const pick = (q) => inBand(q.p) && shareW(B, q.w, 'torso', 'shoulder', 'neck') > 0.85 && shareW(B, q.w, 'upperarm') < 0.05 && shareW(B, q.w, 'head') < 0.05;
  // (what it lies over: the skin with room for the chiton, the plates and their rolled edges with room to slide)
  const samples = [...skinSamples(B).filter(pick).map((q) => ({ p: add(q.p, mul(q.n, 0.12)) }))];
  for (const P of o.plate) P.V.forEach((p, i) => { if (inBand(p)) samples.push({ p: add(p, mul(P.N[i], 0.07)) }); });
  const frame = (t) => ({ o: [sg * (x0 + (x1 - x0) * t), yc, zc0], u: [sg, 0, 0], f: [0, 0, 1], s: [0, 1, 0] });
  const SF = field(B, { samples, nt: 8, na: 64, t: [-0.3, 1.3], smooth: 2, relax: 1, frame, tOf: (p) => (p[0] * sg - x0) / (x1 - x0) });
  // (angle: nought the front, pi/2 straight up, pi the back; the field's side s is up on both sides)
  const a0 = -FLAP_FRONT, a1 = PI + FLAP_BACK;
  const rib = (u) => 0.025 * Math.exp(-(((u - 0.5) / 0.14) ** 2));
  const aOf = (v) => a0 + (a1 - a0) * v;
  const S = (u, v) => { const a = aOf(v), d = SF.dir(u, a); return add(SF.frame(u).o, mul(d, SF.r(u, a) + 0.04 + rib(u))); };
  // (the tongue: its front end rounded, its back end square under the back's rolled edge)
  const tongue = (u, v) => (v - 0.1 * (1 - Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2)))) * 3;
  const Wskin = nearSkinW(B, pick, (n) => TORSO_BONES.has(n) || n === `clavicle_${s}`, 0.35);
  const W = (p, u, v) => { const a = aOf(v), k = smoothstep(0.55, 1.05, Math.abs(a - PI / 2)); return k >= 1 ? o.W(p) : k <= 0 ? Wskin(p) : mixW([[o.W(p), k], [Wskin(p), 1 - k]]); };
  const flap = sheet(S, { nu: 4, nv: 22, keep: (u, v) => tongue(u, v), mat: () => 'brzM', thick: 0.06, inner: false, edge: 'brzS', w: (p, u, v) => W(p, u, v), out: (u, v) => SF.dir(u, aOf(v)) });
  const parts = [flap];
  for (const L of flap.loops) {
    const path = smoothPath(resamplePath(loopPath(L, { lift: -0.02 }), Math.max(12, Math.round(pathLength(L, true) / 0.24)), true), 1, true);
    parts.push(tube(path, { r: 0.055, k: 4, closed: true, w: (p, k) => path[k].w, mat: 'brzL' }));
  }
  // (the boss that fixes its tongue to the chest)
  const vb = 0.1, q = S(0.5, vb), n = SF.dir(0.5, aOf(vb));
  parts.push(stud(q, n, { r: 0.13, h: 0.09, k: 8, mat: 'brzL', w: () => W(q, 0.5, vb) }));
  return parts;
}

/** Where a point is along the upper arm (`up`) and the forearm (`fore`), on its side: t nought at the joint above, one at the one below. */
const limbT = (p, a, b) => { const ab = sub(b, a); return dot(sub(p, a), ab) / dot(ab, ab); };

/**
 * The chest & arms: the linen chiton under all (its collar showing above the bronze, its short sleeves to the biceps,
 * each hemmed in a red border), the muscle cuirass, a coiled bronze armlet on each upper arm, and bronze forearm
 * guards shaped to the forearm, ridged, rolled at both ends, a glowing volute at the wrist.
 */
export function hopliteChest(B, o = {}) {
  const A = B.at, C = muscleCuirass(B), sx = A.shoulder.l[0];
  const armShare = (w) => shareW(B, w, 'upperarm', 'shoulder', 'forearm');
  const tUp = (p) => { const s = p[0] >= 0 ? 'l' : 'r'; return limbT(p, A.shoulder[s], A.elbow[s]); };
  const hem = (p) => { const s = p[0] >= 0 ? 'l' : 'r', out = dot(unit(sub(p, A.shoulder[s])), [Math.sign(p[0]), 0, 0]); return 0.4 + 0.08 * out; };
  const ARM = skinSamples(B, 2).filter((q) => shareW(B, q.w, 'upperarm') > 0.5);
  const chiton = skinWrap(B, {
    sub: 1,
    keep: (i) => { const p = B.V[i], a = C.aOf(p); return on3(B, i, 'torso', 'shoulder', 'upperarm', 'neck') > 0.5 && B.share(i, 'head') < 0.05 && B.share(i, 'forearm') + B.share(i, 'hand') < 0.3 && p[1] > C.yArm - 0.9 && tUp(p) < 0.7 && (p[1] > C.yTop(a) - 0.65 || C.arm(a, p[1]) < 0.85 || armShare(B.W[i]) > 0.12); },
    mask: (p, n, w) => {
      const a = C.aOf(p), k = armShare(w);
      const sleeve = (hem(p) - tUp(p)) * 2 + (1 - Math.min(1, k * 2.5)) * 2;
      // (only where it can be seen: the collar, round the armholes, the sleeves; the rest is under the bronze)
      const seen = Math.max(p[1] - Math.min(C.yTop(a) - 0.25, C.plateau - 0.45), Math.min(0.5 - C.arm(a, p[1]), p[1] - (C.yArm - 0.1)), k * 4 - 1);
      return Math.min(sleeve, C.yTop(a) + 0.07 - p[1], p[1] - (C.yArm - 0.7), seen);
    },
    off: (p, n, w) => {
      const k = armShare(w), o = 0.07 + 0.04 * smoothstep(C.plateau - 0.25, C.plateau + 0.1, p[1]) + 0.05 * smoothstep(0.1, 0.45, tUp(p)) * Math.min(1, k * 2) + 0.05 * Math.max(0, 1 - Math.abs(2 * k - 1));
      // (thin where the arm and the flank press together under the armpit)
      if (k > 0.5) return o;
      let d = 9; for (const q of ARM) if (q.p[0] * p[0] > 0) d = Math.min(d, len(sub(q.p, p)));
      return Math.min(o, Math.max(CHITON_MIN, d * 0.3));
    },
    mat: () => 'linen', hideMargin: 0.02,
    // (and under the arm, where the sleeve's inside meets the arm, a little beyond its hem: never seen)
    hideMarginAt: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return armShare(B.W[i]) > 0.5 && dot(B.N[i], [Math.sign(p[0]), 0, 0]) < -0.2 && tUp(p) < 0.6 ? -0.5 : 0.02; },
  });
  const parts = [C.P, chiton];
  for (const L of chiton.loops) {
    // (the sleeves' hems: a red border; the collar: a rolled linen hem)
    const sleeve = L.filter((q) => armShare(q.w) > 0.6).length > L.length * 0.8;
    const collar = !sleeve && L.filter((q) => q.rest[1] > C.yTop(C.aOf(q.rest)) + 0.05).length > L.length * 0.5;
    if (!sleeve) continue;
    const path = smoothPath(resamplePath(loopPath(L, { lift: sleeve ? 0 : 0.02 }), Math.max(12, Math.round(pathLength(L, true) / 0.15)), true), 2, true);
    parts.push(tube(path, { r: sleeve ? 0.045 : 0.03, k: 4, squash: 0.7, closed: true, w: (p, k) => path[k].w, mat: 'hem' }));
  }
  for (const s of ['l', 'r']) parts.push(...hopliteArm(B, s), ...shoulderPteruges(B, s));
  if (!o.noHip) parts.push(...hipPteruges(B, C, o.hipMinA ?? 0));
  return merge(...parts.map((q, k) => (tally('chest' + k, q), q)));
}
const on3 = (B, i, ...parts) => parts.reduce((t, p) => t + B.share(i, p), 0);
/** The body's weights at its nearest skin sample to `p`. */
const nearW = (B, p) => { let best = null, bd = Infinity; for (const s of skinSamples(B)) { const d = len(sub(s.p, p)); if (d < bd) { bd = d; best = s; } } return best.w; };

/** A stiff hanging strip: a sheet `S(u, v)` (u down it, v across), leather, its foot rounded, a bronze stud at its foot. */
function strap(S, out, w, o = {}) {
  const P = sheet(S, { nu: o.nu ?? 3, nv: 1, keep: (u, v) => (1 - u) * 6 + 0.35 - 0.35 * Math.sqrt(Math.max(0, 1 - (2 * v - 1) ** 2)) - 0.0001, mat: () => o.mat ?? 'leather', thick: 0.03, inner: false, edge: o.edge ?? 'leatherD', w, out });
  const c = S(0.8, 0.5), n = unit(out(0.8, 0.5));
  return [P, stud(add(c, mul(n, 0.01)), n, { r: o.stud ?? 0.06, h: 0.045, k: 4, mat: 'brzL', w: () => w(c) })];
}
/** The curtain the leggings' tiers hang on: at each height and angle round the hips, the farthest the skin there or below reaches. */
const CURTAINS = new WeakMap();
export function legsCurtain(B, C) {
  if (CURTAINS.has(B)) return CURTAINS.get(B);
  const A = B.at, waist = waistOf(A);
  const pick = (q) => shareW(B, q.w, 'torso', 'thigh') > 0.85 && q.p[1] > A.knee.l[1] && q.p[1] < waist + 0.6;
  const zc = C.zc, y0 = lerp(A.hip.l, A.knee.l, 0.8)[1], y1 = waist + 0.6;
  const F = field(B, { pick, nt: 40, na: 72, t: [0, 1], smooth: 2, relax: 2, frame: (t) => { const yy = y0 + (y1 - y0) * t; return { o: [0, yy, zc(yy)], u: [0, 1, 0], f: [0, 0, 1], s: [1, 0, 0] }; }, tOf: (p) => (p[1] - y0) / (y1 - y0) });
  const tOf = (yy) => (yy - y0) / (y1 - y0);
  const NT = 40, NA = 72, CUR = [...Array(NT + 1).keys()].map((i) => [...Array(NA).keys()].map((j) => F.r(i / NT, (j / NA) * TAU)));
  for (let i = NT - 1; i >= 0; i--) for (let j = 0; j < NA; j++) CUR[i][j] = Math.max(CUR[i][j], CUR[i + 1][j]);
  for (let pass = 0; pass < 3; pass++) for (let i = 0; i <= NT; i++) { const r = CUR[i].slice(); for (let j = 0; j < NA; j++) CUR[i][j] = Math.max(r[j], (r[(j + 1) % NA] + r[(j + NA - 1) % NA] + r[j]) / 3); }
  const cur = smoothRead(CUR, true), curR = (t, a) => cur(t * NT, ((((a % TAU) + TAU) % TAU) / TAU) * NA);
  const out = { F, tOf, curR };
  CURTAINS.set(B, out);
  return out;
}
/** How far out the leggings' straps hang at an angle round the hips (their widest down their length). */
export function strapR(B, C, a) {
  const A = B.at, { tOf, curR } = legsCurtain(B, C), top = Math.max(C.yb(a), C.yb(PI / 2) - LEVEL), len = 0.5 * (A.hip.l[1] - A.knee.l[1]);
  return Math.max(...[0, 0.25, 0.5, 0.75, 1].map((u) => curR(tOf(top - len * u), a))) + STRAP_OFFB + (STRAP_OFF - STRAP_OFFB) * Math.max(0, Math.cos(a));
}
/** Where the hip's pteruges hang: their length, and at each angle round the hips their distance from the middle. */
export function hipRing(B, C) {
  const A = B.at, len0 = HIP_PT * (A.hip.l[1] - A.knee.l[1]);
  // (clear of the hips and the thighs under it)
  const yLo = A.hip.l[1] - len0 - 0.6, pts = [];
  for (const q of skinSamples(B)) {
    if (shareW(B, q.w, 'torso', 'thigh') < 0.9 || q.p[1] < yLo || q.p[1] > C.yb(PI / 2) + 0.2) continue;
    pts.push(q.p);
  }
  const reach = (a) => { let r = 0; for (const p of pts) { const x = p[0], z = p[2] - C.zc(p[1]), L = Math.hypot(x, z); if (L > 1e-6 && (x * Math.sin(a) + z * Math.cos(a)) / L > Math.cos(0.2)) r = Math.max(r, L); } return r; };
  const NA = 72, RR = [...Array(NA).keys()].map((j) => { const a = (j / NA) * TAU, t = C.tOf(C.yb(a) + 0.05), pc = C.S(t, j / NA), rc = Math.hypot(pc[0], pc[2] - C.zc(pc[1])); return Math.max(strapR(B, C, a) + 0.12 + 0.16 * Math.max(0, Math.cos(a)) ** 3, rc - HIP_TUCK, reach(a) + HIP_BACK * (HIP_SIDE + (1 - HIP_SIDE) * Math.max(0, -Math.cos(a)) ** 2) + HIP_FRONT * Math.max(0, Math.cos(a))); });
  const R = (a) => { const f = ((((a / TAU) % 1) + 1) % 1) * NA, j = Math.floor(f) % NA, g = f - Math.floor(f); return RR[j] * (1 - g) + RR[(j + 1) % NA] * g; };
  return { len0, R };
}
/**
 * The hip's pteruges: stiff leather strips hung straight from under the cuirass's foot all round, a bronze stud at each
 * foot, over the leggings' linen; each bends a little with the thigh it hangs over.
 */
function hipPteruges(B, C, minA = 0) {
  const n = B.who === 'male' ? 15 : 14, parts = [], { len0, R } = hipRing(B, C);
  for (let k = 0; k < n; k++) {
    const ac = -HIP_SPAN + (2 * HIP_SPAN * (k + 0.5)) / n, half = ((2 * HIP_SPAN) / n) * 0.42, side = Math.sin(ac) >= 0 ? 'l' : 'r', sgn = side === 'l' ? 1 : -1;
    const Wn = nearSkinW(B, (q) => shareW(B, q.w, 'torso', 'thigh') > 0.9 && q.p[0] * sgn > 0.05, (nm) => nm === 'pelvis' || nm === `thigh_${side}`, 0.4);
    const yt = C.yb(ac) + 0.02, yB = yt - len0, mid = false;
    const W = (p) => { const f = mid ? 0 : 0.15 + 0.35 * smoothstep(yt, yB, p[1]); return f <= 0 ? mixOf(B, [['pelvis', 1]]) : mixW([[[[B.bi.get('pelvis'), 1]], 1 - f], [Wn(p), f]]); };
    // (at the cuirass's foot, just inside its rim, out a little as it falls)
    const at = (a, yy, u) => add([0, yy, C.zc(yy)], mul([Math.sin(a), 0, Math.cos(a)], R(a) + HIP_TAPER * u));
    const S = (u, v) => { const a = ac - half + 2 * half * v; return at(a, C.yb(a) + 0.02 - len0 * u, u); };
    const out = (u, v) => { const a = ac - half + 2 * half * v; return [Math.sin(a), 0, Math.cos(a)]; };
    if (Math.abs(ac) >= minA) parts.push(...strap(S, out, (p) => W(p)));
  }
  return parts;
}
/** The shoulder's pteruges: a tier of leather strips hung over the outside of the upper arm from the shoulder, moving with it. */
function shoulderPteruges(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, sh = A.shoulder[s], el = A.elbow[s], parts = [];
  const pickU = (q) => (sg > 0 ? q.p[0] > 0.3 : q.p[0] < -0.3) && shareW(B, q.w, 'upperarm', 'shoulder') > 0.7;
  const UA = field(B, { pick: pickU, nt: 10, na: 24, t: [-0.1, 0.6], smooth: 3, relax: 2, frame: (t) => ({ o: lerp(sh, el, t), u: sub(el, sh), f: [0, 0, 1], s: [sg, 0, 0] }), tOf: (p) => limbT(p, sh, el) });
  const Wu = mixOf(B, [[`upperarm_${s}`, 0.8], [`clavicle_${s}`, 0.2]]);
  const n = 5, span = 2.4;
  for (let k = 0; k < n; k++) {
    const ac = PI / 2 - span / 2 + (span * (k + 0.5)) / n, half = (span / n) * 0.42;
    const S = (u, v) => { const a = ac - half + 2 * half * v, t = SH_PT0 + (SH_PT1 - SH_PT0) * u; return add(UA.frame(t).o, mul(UA.dir(t, a), UA.r(t, a) + SH_PT_OFF + 0.04 * u)); };
    const out = (u, v) => UA.dir(SH_PT0 + (SH_PT1 - SH_PT0) * u, ac - half + 2 * half * v);
    parts.push(...strap(S, out, () => Wu, { stud: 0.05 }));
  }
  return parts;
}

/** One arm's bronze: the coiled armlet round the biceps, the forearm guard. */
function hopliteArm(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, sh = A.shoulder[s], el = A.elbow[s], wr = A.wrist[s];
  const parts = [];
  const fore = ['lowerarm', 'lowerarm_twist_01', 'lowerarm_twist_02', 'elbow'].map((n) => `${n}_${s}`);
  const pickF = (q) => (sg > 0 ? q.p[0] > 0.2 : q.p[0] < -0.2) && shareW(B, q.w, 'forearm') > 0.6 && shareW(B, q.w, 'hand') < 0.2;
  const FA = field(B, { pick: pickF, nt: 20, na: 28, t: [0, 1.05], smooth: 3, relax: 3, frame: (t) => ({ o: lerp(el, wr, t), u: sub(wr, el), f: [0, 0, 1], s: [sg, 0, 0] }), tOf: (p) => limbT(p, el, wr) });
  const Wf = nearSkinW(B, pickF, (n) => fore.includes(n) || n === `wrist_${s}`, 0.3);
  // the forearm guard: round the outside and the back of the forearm from below the elbow to the wrist, flared at the wrist; a ridge down its middle
  const t0 = 0.3, t1 = 0.96;
  const gS = (u, v) => {
    const t = t0 + (t1 - t0) * u, a = -2.3 + 4.6 * v, F0 = FA.frame(t), d = FA.dir(t, a + PI / 2);
    const ridge = 0.04 * Math.exp(-((a / 0.22) ** 2));
    const r = FA.r(t, a + PI / 2) + 0.09 + 0.08 * smoothstep(0.75, 1, u) ** 2 + 0.04 * Math.sin(PI * u) + ridge;
    return add(F0.o, mul(d, r));
  };
  const guard = sheet(gS, { nu: 9, nv: 14, closed: false, mat: () => 'brz', thick: 0.04, inner: false, edge: 'brzS', w: (p) => Wf(p), out: (u, v) => FA.dir(t0 + (t1 - t0) * u, -2.3 + 4.6 * v + PI / 2) });
  parts.push(guard);
  for (const L of guard.loops) {
    const path = smoothPath(resamplePath(loopPath(L, { lift: -0.02 }), Math.max(12, Math.round(pathLength(L, true) / 0.16)), true), 1, true);
    parts.push(tube(path, { r: 0.04, k: 4, closed: true, w: (p) => Wf(p), mat: 'brzL' }));
  }
  // the armlet: a bronze coil, two and a half turns round the biceps below the sleeve
  {
    const up = ['upperarm', 'upperarm_twist'].map((n) => `${n}_${s}`);
    const pickU = (q) => (sg > 0 ? q.p[0] > 0.3 : q.p[0] < -0.3) && shareW(B, q.w, 'upperarm') > 0.7;
    const UA = field(B, { pick: pickU, nt: 12, na: 24, t: [0.3, 0.9], smooth: 3, relax: 2, frame: (t) => ({ o: lerp(sh, el, t), u: sub(el, sh), f: [0, 0, 1], s: [sg, 0, 0] }), tOf: (p) => limbT(p, sh, el) });
    const Wu = nearSkinW(B, pickU, (n) => up.includes(n), 0.3);
    const path = [];
    for (let k = 0; k <= 26; k++) { const f = k / 26, t = 0.58 + 0.13 * f, a = f * 2.5 * TAU; const F0 = UA.frame(t), d = UA.dir(t, a); path.push({ p: add(F0.o, mul(d, UA.r(t, a) + 0.07)), n: d }); }
    parts.push(tube(path, { r: 0.045, k: 4, w: (p) => Wu(p), mat: 'brzL' }));
  }
  return parts;
}

/* ---- the legs ----------------------------------------------------------------------------------------------------- */
/**
 * The legs: the linen under all (the hips, the seat, the crotch and the thighs, down over the knees to the calves' tops,
 * close over the skin), the pteruges over it (two rows of stiff strips hanging from under the cuirass's foot, the outer
 * row shorter, each strip white with a red hem, bending with the thigh it hangs over), and the greaves (bronze, sprung
 * round the shin and the calf from over the kneecap to the ankle, shaped to the knee and the calf's two heads, laced shut
 * behind; a glowing volute on each kneecap).
 */
export function hopliteLegs(B) {
  const A = B.at, waist = waistOf(A), male = B.who === 'male';
  const C = muscleCuirass(B);
  const parts = [];
  // the pteruges: broad tabs hanging from under the cuirass's foot, each as a curtain falls: never in from the widest
  // of the body above it
  const { F, tOf, curR } = legsCurtain(B, C), zc = C.zc;
  const thighLen = A.hip.l[1] - A.knee.l[1], HR = hipRing(B, C);
  // (the female's hips bend further in a swing: her tiers in more rows, the weights' change along them spread finer)
  const RING_NU = B.who === 'female' ? RING_NU_F : 3;
  /** A ring of `n` tabs (`half` of each's share of the round wide), `len` long from just under the cuirass's foot, `off` off the curtain at the front and `offB` behind. */
  const ring = (o) => {
    for (let k = 0; k < o.n; k++) {
      const ac = ((k + 0.5 + (o.shift ?? 0)) / o.n) * TAU - PI, half = (TAU / o.n) * o.half;
      const tk = (a) => (o.tuck ? TUCK + (o.tuck + 0.075) * Math.max(0, Math.cos(a)) ** 3 : TUCK), ytA = (a) => Math.max(C.yb(a), C.yb(PI / 2) - LEVEL) + tk(a) - (o.drop ?? 0), lenT = o.len, yt = ytA(ac), yB = yt - lenT;
      const side = Math.sin(ac) >= 0 ? 'l' : 'r', sgn = side === 'l' ? 1 : -1;
      const Wn = nearSkinW(B, (q) => shareW(B, q.w, 'torso', 'thigh') > 0.9 && q.p[0] * sgn > 0.05, (nm) => nm === 'pelvis' || nm === `thigh_${side}`, 0.4);
      const W = (p) => { const f = STRAP_W0 + STRAP_W1 * smoothstep(yt + RW_UP * (yt - yB), yB, p[1]); return mixW([[[[B.bi.get('pelvis'), 1]], 1 - f], [Wn(p), f]]); };
      const S = (u, v) => {
        const a = ac - half + 2 * half * v, yy = ytA(a) - (lenT + tk(a) - TUCK) * u, t = tOf(yy), d = F.dir(t, a), front = Math.max(0, Math.cos(a));
        let r = curR(t, a) + o.offB + (o.off - o.offB) * front + (o.straps ? 0.01 : 0.02 + RING_FLARE * front) * u + (o.straps ? 0 : 0.03 * Math.sin(PI * v));
        // (tucked inside the cuirass where they hang from under it)
        const oo = F.frame(t).o, pc = C.S(C.tOf(yy), (((a / TAU) % 1) + 1) % 1), rc = Math.hypot(pc[0] - oo[0], pc[2] - oo[2]);
        const inside = smoothstep(C.yb(a) - 0.35, C.yb(a) - 0.07, yy);
        r = r * (1 - inside) + Math.max(Math.min(r, rc - 0.1, curR(t, a) + 0.13), curR(t, a) + 0.06) * inside;
        // (under the cuirass's pteruges where they hang over it)
        { const hr = HR.R(a) - 0.15, k = smoothstep(C.yb(a) - HR.len0 - 0.4, C.yb(a) - HR.len0 - 0.12, yy); r = Math.max(Math.min(r, hr * k + r * (1 - k)), Math.min(r, curR(t, a) + 0.08)); }
        // (a strap hangs straight: as far out all down its length as the most it must clear, the hip strips over it its limit)
        if (o.straps) { r = Math.max(r, curR(t, a) + 0.1); r = r + (strapR(B, C, a) - r) * smoothstep(0, STRAP_BEND, u); }
        return add(oo, mul(d, r));
      };
      const outR = (u, v) => F.dir(tOf(yt), ac - half + 2 * half * v);
      if (o.straps) parts.push(...strap(S, outR, (p) => W(p), { mat: o.mat, edge: o.edge, stud: 0.065, nu: RING_NU }));
      else parts.push(sheet(S, { nu: RING_NU, nv: 2, mat: (u) => (u > 0.67 ? o.hem : o.mat), thick: 0.035, inner: false, edge: o.edge, w: (p) => W(p), out: outR }));
    }
  };
  // the chiton's skirt under: cream linen panels lapped all round, a hand longer than the pteruges
  ring({ n: 12, half: 0.56, len: 0.5 * thighLen + 0.35 - LEG_DROP * HR.len0, off: 0.16, offB: 0.1, mat: 'linen', hem: 'linenH', edge: 'linenD', shift: 0, drop: 0.02 + LEG_DROP * HR.len0, tuck: SKIRT_TUCK });
  // the pteruges over it: crimson tabs, an ochre hem
  ring({ n: 16, half: 0.4, straps: true, len: 0.5 * thighLen + 0.12 - LEG_DROP * HR.len0, off: STRAP_OFF, offB: STRAP_OFFB, mat: 'ox', hem: 'ox', edge: 'oxE', drop: LEG_DROP * HR.len0 });
  for (const s of ['l', 'r']) parts.push(...greave(B, s));
  // the chiton's skirt close over the hips, the seat, the crotch and the thighs' tops, under the tiers: linen; its waist
  // (under the cuirass, left out when a chest piece is worn) last
  const aOf = (p) => Math.atan2(p[0], p[2] - C.zc(p[1])), yLo = (p) => { const s = p[0] >= 0 ? 'l' : 'r'; return lerp(A.hip[s], A.knee[s], UNDER_LO)[1]; };
  const under = (lo, hi, mat) => skinWrap(B, {
    sub: 1,
    keep: (i) => { const p = B.V[i]; return on3(B, i, 'torso', 'thigh') > 0.6 && B.share(i, 'upperarm') + B.share(i, 'forearm') + B.share(i, 'hand') < 0.05 && p[1] < waist + 0.45 && p[1] > yLo(p) - 0.4; },
    // (and short of the crotch's underside, where the thighs close on it)
    mask: (p, n) => Math.min(hi(p) - p[1], p[1] - lo(p), (Math.abs(p[0]) < CROTCH_X && p[1] < A.hip.l[1] - CROTCH_Y ? -1 : 1)) * 4,
    off: () => UNDER_OFF, mat: () => mat, hideMargin: 0.02,
  });
  const cut = (p) => C.yb(aOf(p)) - 0.1;
  parts.push(under(yLo, cut, 'linen'));
  // (the body's polygons in the crotch, under the linen, left out: where the thighs meet its folds would show through)
  { const byPoly = new Map(); for (const t of B.tris) byPoly.set(t.poly, [...(byPoly.get(t.poly) ?? []), ...t.v]);
    for (const [poly, vs] of byPoly) if (vs.every((i) => { const p = B.V[i]; return Math.abs(p[0]) < 0.75 && p[1] > yLo(p) + 0.15 && p[1] < A.hip.l[1] + 0.3 && B.share(i, 'hand') + B.share(i, 'forearm') < 0.01; })) parts[parts.length - 1].hides.add(poly); }
  for (const L of parts[parts.length - 1].loops) {
    // (its hem round each thigh: a rolled edge)
    if (L.filter((q) => q.rest[1] < A.hip.l[1] - 0.2).length < L.length * 0.8) continue;
    const path = smoothPath(resamplePath(loopPath(L, { lift: 0.035 }), Math.max(10, Math.round(pathLength(L, true) / 0.18)), true), 2, true);
    parts.push(tube(path, { r: 0.035, k: 4, squash: 0.7, closed: true, w: (p, k) => path[k].w, mat: (k) => (Math.abs(path[k].p[0]) < 0.35 && path[k].p[1] < A.hip.l[1] - 0.35 ? null : 'linenD') }));
  }
  parts.push(under(cut, () => waist + 0.3, 'linenW'));
  return { P: merge(...parts.map((q, k) => (tally('legs' + k, q), q))), dropAt: (f) => f.mat === 'linenW' };
}

/** One greave: bronze round the shin and the calf, shaped, laced behind, a glowing volute on the kneecap. */
function greave(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, kn = A.knee[s], an = A.ankle[s];
  const pick = (q) => (sg > 0 ? q.p[0] > 0.15 : q.p[0] < -0.15) && shareW(B, q.w, 'calf', 'thigh') > 0.7 && shareW(B, q.w, 'foot') < 0.1;
  const L = field(B, { pick, nt: 24, na: 32, t: [-0.15, 1.05], smooth: 3, relax: 3, frame: (t) => ({ o: lerp(kn, an, t), u: sub(an, kn), f: [0, 0, 1], s: [sg, 0, 0] }), tOf: (p) => limbT(p, kn, an) });
  const calfB = [`calf_${s}`, `knee_${s}`];
  const W = nearSkinW(B, (q) => pick(q) && limbT(q.p, kn, an) > 0.05, (n) => calfB.includes(n), 0.3);
  const t0 = -0.08, t1 = 0.9, aw = 2.75;
  // (the shape: the kneecap's dome, the calf's two heads, the shin's ridge, the flare at the ankle)
  const shape = (t, a) => {
    const knee = 0.09 * Math.exp(-((t / 0.09) ** 2)) * Math.max(0, Math.cos(a)) ** 2;
    const calf = 0.12 * Math.exp(-(((t - 0.3) / 0.17) ** 2)) * Math.max(0, -Math.cos(a)) ** 0.7;
    const ridge = 0.025 * Math.exp(-((a / 0.18) ** 2));
    const flare = 0.08 * smoothstep(0.75, t1, t) ** 2;
    return 0.11 + knee + calf + ridge + flare;
  };
  const S = (u, v) => { const t = t0 + (t1 - t0) * u, a = -aw + 2 * aw * v, F0 = L.frame(t), d = L.dir(t, a); return add(F0.o, mul(d, L.r(t, a) + shape(t, a))); };
  // (its top: up over the kneecap in front, down behind clear of the knee's bend)
  const keep = (u, v) => { const t = t0 + (t1 - t0) * u, a = -aw + 2 * aw * v; return (t - (t0 + 0.22 * smoothstep(0.6, 2.2, Math.abs(a)))) * 4; };
  const shell = sheet(S, { nu: 12, nv: 18, keep, mat: (u, v) => (Math.abs(-aw + 2 * aw * v) > 1.75 ? 'brzM' : 'brz'), thick: 0.04, inner: false, edge: 'brzS', w: (p) => W(p), out: (u, v) => L.dir(t0 + (t1 - t0) * u, -aw + 2 * aw * v) });
  const parts = [shell];
  for (const Lp of shell.loops) {
    const path = smoothPath(resamplePath(loopPath(Lp, { lift: -0.02 }), Math.max(12, Math.round(pathLength(Lp, true) / 0.2)), true), 1, true);
    parts.push(tube(path, { r: 0.045, k: 4, closed: true, w: (p) => W(p), mat: 'brzL' }));
  }
  // the shin's ridge, polished: down the front from under the kneecap to the flare
  {
    const path = [...Array(11).keys()].map((k) => { const t = 0.16 + (0.56 * k) / 10, u = (t - t0) / (t1 - t0); return { p: S(u, 0.5), n: L.dir(t, 0) }; });
    parts.push(tube(path, { r: 0.03, k: 4, squash: 0.7, w: (p) => W(p), mat: 'brzL' }));
  }
  // the volute on the kneecap: a raised spiral, glowing
  {
    const path = [];
    for (let k = 0; k <= 30; k++) { const f = k / 30, ang = f * 2.25 * TAU, rr = 0.025 + 0.2 * (1 - f); const t = 0.03 + rr * Math.cos(ang) * 0.45 / len(sub(an, kn)) * 3, a = rr * Math.sin(ang) * 1.6; const u = (t - t0) / (t1 - t0), v = (a + aw) / (2 * aw); path.push({ p: S(u, v), n: L.dir(t, a) }); }
    parts.push(sweep(path, { profile: [[-0.035, -0.015], [0.035, -0.015], [0.035, 0.028], [-0.035, 0.028]], centreUp: 0.006, mat: 'rune', w: (p) => W(p) }));
  }
  // the lacing behind: a cord zigzag across the gap
  {
    const path = [];
    for (let k = 0; k <= 10; k++) { const t = 0.24 + (0.6 * k) / 10, a = (k % 2 ? 1 : -1) * (aw - 0.06); const u = (t - t0) / (t1 - t0), v = (a + aw) / (2 * aw); path.push({ p: S(u, v), n: L.dir(t, a) }); }
    for (let k = 0; k < path.length; k++) path[k] = { ...path[k], p: add(path[k].p, mul(path[k].n, 0.01)) };
    parts.push(tube(path, { r: 0.025, k: 4, w: (p) => W(p), mat: 'leatherD' }));
  }
  return parts;
}

/* ---- the shawl: the chlamys ---------------------------------------------------------------------------------------- */
/** A point turned about the axis through `c` along x (the body's left) by `ang` (forward positive: z toward +y... a swing). */
const swingX = (p, c, ang) => { const y = p[1] - c[1], z = p[2] - c[2], cs = Math.cos(ang), sn = Math.sin(ang); return [p[0], c[1] + y * cs - z * sn, c[2] + y * sn + z * cs]; };

/**
 * How cloth hangs down a column from its top: `raw` its obstacles' reach at each height ([r, y], y falling; r nought
 * where there is none), the cloth taut from each widest point to the next below it (their least concave majorant) and
 * never in again below the widest: a profile as a hung cloth's, not the steps of what is under it.
 */
export function hang(raw) {
  const pts = raw.filter((q, k) => k === 0 || q[0] > 0), H = [];
  for (const q of pts) {
    while (H.length >= 2) { const a = H[H.length - 2], b = H[H.length - 1], t = (b[1] - a[1]) / (q[1] - a[1]); if (a[0] + (q[0] - a[0]) * t >= b[0]) H.pop(); else break; }
    H.push(q);
  }
  let k = 0, top = 0;
  return raw.map(([, y]) => {
    while (k + 1 < H.length && H[k + 1][1] > y) k++;
    const a = H[k], b = H[Math.min(H.length - 1, k + 1)], r = b === a || y <= b[1] ? (y <= b[1] ? b[0] : a[0]) : a[0] + (b[0] - a[0]) * ((y - a[1]) / (b[1] - a[1]));
    top = Math.max(top, r);
    return [top, y];
  });
}

/**
 * The chlamys: a crimson cloak pinned on the right shoulder with a bronze sun of sixteen rays (lit, they blaze), thrown
 * over the left shoulder and down the back. Long behind and longest at its weighted left corner, short over the left
 * arm, rising to the pin; an ochre overfold along its top, an ochre border round its foot and its edges, bronze weights
 * at its two corners. Hung as cloth falls: each column down from the neck's foot over the widest of what is under it
 * (the cuirass and its flaps, the arms and the thighs as far as they swing in a walk), never in.
 */
export function chlamys(B) {
  const A = B.at, male = B.who === 'male', C = muscleCuirass(B), zc = C.zc, plateau = C.plateau;
  const sh = A.shoulder, thighLen = A.hip.l[1] - A.knee.l[1];
  // what it hangs over: the chest piece (not its forearms), the skin, the arms and thighs swung as far as a walk takes them
  // (the hip's pteruges only where the cloak hangs behind: those at the sides would widen its edges by the arms)
  const chest = hopliteChest(B, { hipMinA: 1.95 }), legs = hopliteLegs(B).P;
  const pts = [], high = [];
  // (an arm swung fore and aft and a little out, a thigh swung back: as far as a walk and the idle take them)
  const swungArm = (p, side) => { const out = []; for (const g of [-0.46, -0.3, -0.15, 0, 0.15, 0.3, 0.46]) { const q = swingX(p, sh[side], g); out.push(q); const sg = side === 'l' ? 1 : -1, dx = q[0] - sh[side][0], dy = q[1] - sh[side][1], c = Math.cos(0.24), sn = Math.sin(0.24) * sg; out.push([sh[side][0] + dx * c - dy * sn, sh[side][1] + dx * sn + dy * c, q[2]]); } return out; };
  const add1 = (p, w) => {
    const side = p[0] >= 0 ? 'l' : 'r';
    if (shareW(B, w, 'shoulder') > 0.15) pts.push(add(p, [side === 'l' ? 0.08 : -0.08, 0.16, 0]));
    if (shareW(B, w, 'upperarm', 'forearm', 'hand') > 0.4) { if (p[1] > sh[side][1] - 1.1) pts.push(...swungArm(p, side)); return; }
    if (shareW(B, w, 'thigh') > 0.4 && p[1] < A.hip[side][1]) { for (const g of [-0.45, -0.22, 0]) pts.push(swingX(p, A.hip[side], g)); return; }
    pts.push(p);
  };
  const trunk = [];
  chest.V.forEach((p, k) => { add1(p, chest.W[k]); if (p[1] > plateau + 0.2) high.push(p); if (shareW(B, chest.W[k], 'upperarm', 'forearm', 'hand', 'shoulder') < 0.2) trunk.push(p); });
  legs.V.forEach((p, k) => { add1(p, legs.W[k]); trunk.push(p); });
  for (const s of skinSamples(B)) {
    if (shareW(B, s.w, 'head') > 0.05 || shareW(B, s.w, 'foot', 'calf') > 0.3) continue;
    add1(s.p, s.w);
    if (shareW(B, s.w, 'upperarm', 'forearm', 'hand', 'shoulder') < 0.2) { const side = s.p[0] >= 0 ? 'l' : 'r'; if (shareW(B, s.w, 'thigh') > 0.4 && s.p[1] < A.hip[side][1]) { for (const g of [-0.45, -0.22, 0]) trunk.push(swingX(s.p, A.hip[side], g)); } else trunk.push(s.p); }
  }
  // the columns: from the right edge (behind the right arm) round the back and over the left shoulder to its front
  const aR = -0.8, aL = 0.85, span = TAU - (aL - aR), nv = 50, nu = 18;
  const aOfV = (v) => aR - span * v;
  const vOfA = (a) => { let d = aR - a; while (d < 0) d += TAU; return d / span; };
  const yTop = plateau + 0.2;
  // (its top edge dipped across the back, under the helm's neck guard: the cuirass's top shows above it)
  const yTopAt = (a) => yTop - BACK_DIP * smoothstep(1.2, 0.2, Math.abs(wrapAngle(a - PI)));
  const longY = A.hip.l[1] - (male ? 1.05 : 1.25);
  /** The foot's height along the cloak (v nought at the pin, on the right shoulder's front, one at the left shoulder's front). */
  /** The capelet's foot (v nought at the pin, on the right shoulder's front, one at the left shoulder's front): short over the arms, a shallow point down the middle of the back. */
  const capY = (v) => {
    const a = aOfV(v), fromBack = Math.abs(wrapAngle(a - PI));
    const over = lerp([sh.l[1] - 0.25, 0, 0], [sh.l[1] - 0.05, 0, 0], smoothstep(1.2, 0.8, fromBack))[0];
    const back = A.chest[1] - 0.15 - 0.35 * smoothstep(0.7, 0, fromBack);
    return lerp([over, 0, 0], [back, 0, 0], smoothstep(0.85, 0.55, fromBack))[0];
  };
  const hemY = capY;
  const reachAt = (a, yy) => {
    const d = [Math.sin(a), Math.cos(a)];
    let r = 0;
    for (const p of pts) {
      if (Math.abs(p[1] - yy) > 0.07) continue;
      const x = p[0], z = p[2] - zc(yy), L = Math.hypot(x, z); if (L < 1e-6) continue;
      if ((x * d[0] + z * d[1]) / L > Math.cos(0.13)) r = Math.max(r, L);
    }
    return r;
  };
  const cols = [];
  let yLow = Infinity;
  for (let j = 0; j <= nv; j++) yLow = Math.min(yLow, hemY(j / nv));
  for (let j = 0; j <= nv; j++) {
    const v = j / nv, a = aOfV(v), yH = hemY(v);
    // (down the column: each height the widest of everything there and above it, folds deepening toward the foot;
    // every column as long as the longest, the cloth cut at its own foot after)
    const raw = [];
    // (starting clear of what stands above its top: the shoulder flaps)
    let r0 = 0;
    { const d = [Math.sin(a), Math.cos(a)]; for (const p of high) { const x = p[0], z = p[2] - zc(p[1]), L = Math.hypot(x, z); if (L > 1e-6 && (x * d[0] + z * d[1]) / L > Math.cos(0.13)) r0 = Math.max(r0, L); } }
    const yT = yTopAt(a);
    for (let yy = yT; yy >= yLow - 0.3; yy -= 0.05) raw.push([yy >= yH - 0.05 ? Math.max(reachAt(a, yy), yy > yT - 0.3 ? r0 : 0) : 0, yy]);
    const hung = HANG ? hang(raw) : raw.map((q) => q.slice());
    if (!HANG) for (let k = 1; k < hung.length; k++) hung[k][0] = Math.max(hung[k][0], hung[k - 1][0]);
    const depth = (yy) => smoothstep(plateau - 0.3, longY, yy);
    const fold = (yy) => (0.02 + 0.2 * depth(yy)) * (0.5 + 0.5 * Math.cos(a * 10)) ** 1.5 * smoothstep(vOfA(2.6), vOfA(2.4), v) * smoothstep(vOfA(-2.3), vOfA(-2.5), v);
    const shoulderTop = Math.max(0, Math.abs(Math.sin(a)) - 0.6) * 2.5;
    const line = hung.map(([r, yy]) => [r + 0.15 + 0.04 * depth(yy) + 0.07 * smoothstep(A.hip.l[1] + 0.7, A.hip.l[1], yy) + (HANG ? CAPE_TOP + CAPE_TOP * shoulderTop : 0.14 + 0.18 * shoulderTop) * smoothstep(yT - 1.0, yT, yy) + fold(yy), yy]);
    // (the roof over each shoulder lifted off it: each point out along the line's own normal)
    for (let pass = 0; pass < 4; pass++) for (let k = 1; k + 1 < line.length; k++) line[k] = [Math.max(line[k][0], (line[k - 1][0] + line[k][0] + line[k + 1][0]) / 3), line[k][1]];
    const L = [0];
    for (let k = 1; k < line.length; k++) L.push(L[k - 1] + Math.hypot(line[k][0] - line[k - 1][0], line[k][1] - line[k - 1][1]));
    const at = (sArc) => { const x = sArc; let k = 1; while (k < L.length - 1 && L[k] < x) k++; const f = clamp((x - L[k - 1]) / Math.max(1e-9, L[k] - L[k - 1])); return [line[k - 1][0] + (line[k][0] - line[k - 1][0]) * f, line[k - 1][1] + (line[k][1] - line[k - 1][1]) * f]; };
    // (the arc length down to its foot)
    let sH = L[L.length - 1];
    for (let k = 1; k < line.length; k++) if (line[k][1] <= yH) { sH = L[k - 1] + (L[k] - L[k - 1]) * (line[k - 1][1] - yH) / Math.max(1e-9, line[k - 1][1] - line[k][1]); break; }
    cols.push({ a, at, sH, len: L[L.length - 1] });
  }
  const Smax = Math.min(...cols.map((c) => c.len));
  const sHat = (v) => { const f = v * nv, j = Math.min(nv - 1, Math.floor(f)), g = f - j; return cols[j].sH * (1 - g) + cols[j + 1].sH * g; };
  const P3 = (sArc, v) => {
    const f = v * nv, j = Math.min(nv - 1, Math.floor(f)), g = f - j;
    const P0 = cols[j].at(sArc), P1 = cols[j + 1].at(sArc), a0 = cols[j].a, a1 = cols[j + 1].a;
    const p0 = [Math.sin(a0) * P0[0], P0[1], zc(P0[1]) + Math.cos(a0) * P0[0]], p1 = [Math.sin(a1) * P1[0], P1[1], zc(P1[1]) + Math.cos(a1) * P1[0]];
    return lerp(p0, p1, g);
  };
  const S = (u, v) => P3(u * Smax, v);
  const out = (u, v) => { const a = aOfV(v); return [Math.sin(a), 0.3, Math.cos(a)]; };
  // (weights by height alone, down the spine: smooth however far the cloth hangs off the back)
  const yHi = A.chest[1] + 0.3, yLo = A.hip.l[1] - 0.5, chain = ['spine_03', 'spine_02', 'spine_01', 'pelvis'];
  const Wt = (p) => {
    const f = clamp((yHi - p[1]) / (yHi - yLo)) * 3, k = Math.min(2, Math.floor(f)), g = f - k;
    return mixOf(B, [[chain[k], 1 - g], [chain[k + 1], g]]);
  };
  const parts = [];
  const bandW = 0.26, NU = Math.round(Smax / 0.28);
  const cloth = sheet(S, {
    nu: NU, nv, keep: (u, v) => sHat(v) - bandW - u * Smax, mat: (u, v) => { if (v < 1 / nv || v > 1 - 1 / nv) return 'terra'; const a = aOfV(v), c = (0.5 + 0.5 * Math.cos(a * 10)) ** 1.5, k = smoothstep(0.3, 0.6, (u * Smax) / Math.max(0.5, sHat(v))) * smoothstep(vOfA(2.6), vOfA(2.4), v) * smoothstep(vOfA(-2.3), vOfA(-2.5), v); return k < 0.5 ? 'cloak' : c < 0.08 ? 'cloakM' : c > 0.75 ? 'cloakL' : 'cloak'; }, thick: 0.04, inner: false, wall: false, edge: 'cloakD', w: (p) => Wt(p), out,
  });
  parts.push(cloth);
  // the border round its foot: an ochre band laid along it exactly, a dark line at its head
  {
    const fine = [...Array(401).keys()].map((k) => { const v = k / 400; return { p: P3(sHat(v) - bandW / 2 - 0.01, v), n: unit(out(0, v)) }; });
    const path = smoothPath(resamplePath(fine, Math.max(16, Math.round(pathLength(fine) / 0.21))), 1, false);
    parts.push(sweep(path, { profile: [[-bandW / 2 - 0.01, -0.012], [bandW / 2 + 0.01, -0.012], [bandW / 2 + 0.01, 0.022], [-bandW / 2 - 0.01, 0.022]], centreUp: 0.005, mat: 'terra', w: (p) => Wt(p) }));
    // (a running key on it, crimson: the band read by its length along and its height across)
    const sides = path.map((q, k) => unit(cross(unit(sub(path[Math.min(path.length - 1, k + 1)].p, path[Math.max(0, k - 1)].p)), q.n)));
    const bandAt = (sv, h) => { const f = clamp(sv) * (path.length - 1), k = Math.min(path.length - 2, Math.floor(f)), g = f - k, q = lerp(path[k].p, path[k + 1].p, g), sd = unit(lerp(sides[k], sides[k + 1], g)), n = unit(lerp(path[k].n, path[k + 1].n, g)); return { p: add(add(q, mul(sd, (h - 0.5) * bandW * 0.92)), mul(n, 0.022)), n }; };
    const Lp = pathLength(path);
    // (round the back and the shoulders' backs only: in front, over the arms, the band is plain)
    const backIdx = path.map((q, k) => [k, Math.abs(wrapAngle(Math.atan2(q.p[0], q.p[2] - zc(q.p[1])) - PI))]).filter(([, d]) => d < 1.45).map(([k]) => k);
    const sA = backIdx[0] / (path.length - 1), sB = backIdx[backIdx.length - 1] / (path.length - 1);
    parts.push(...meander((sv, h) => bandAt(sA + (sB - sA) * sv, h), { count: Math.round((Lp * (sB - sA)) / (bandW * 1.25)), band: bandW * 0.92, wide: 0.17, high: 0.02, sink: 0.012, mat: 'cloakD', w: (p) => Wt(p), open: true, fine: 0.95 }));
  }
  // the overfold: a band of the cloth turned down along its top, ochre, its foot rolled
  const sf = 0.9, uf = sf / Smax;
  const fold = sheet((u, v) => { const p = S(u * uf, v), n = unit(out(u * uf, v)); return add(p, mul(n, 0.045 + 0.02 * u)); }, {
    nu: 3, nv, mat: () => 'terra', thick: 0.035, inner: false, edge: 'goldD', w: (p) => Wt(p), out,
  });
  // the cloak behind: hung from under the capelet, widening to its foot, longest at its weighted left corner
  {
    const top2 = A.chest[1] + 0.25, halfW = (yy, left) => lerp([0.72, 0, 0], [PANEL_W + (left ? 0.04 : 0), 0, 0], smoothstep(top2, longY, yy))[0] - PANEL_NOTCH * Math.exp(-(((yy - (A.hip.l[1] - 0.35)) / 0.55) ** 2));
    // (its folds fanned from a point over the right shoulder blade: the cloth hung from the pin; each crest hangs lower than the hollows beside it)
    const apA = PI + 0.75, apY = top2 + 0.9, NF = 20;
    const phiAt = (a, yy) => NF * Math.atan2((a - apA) * 1.15, Math.max(0.3, apY - yy));
    const hem0 = (a) => { const d = wrapAngle(a - PI); return longY + 0.28 - 0.55 * smoothstep(-1.2, 1.25, d); };
    // (the sun across its middle lies on a calm field: the folds die away under it)
    const sunY = lerp([A.chest[1] - 0.5, 0, 0], [hem0(PI), 0, 0], male ? SUN_AT : SUN_AT - 0.08)[0], sunR = SUN_R * (male ? 1 : 0.85);
    const calm = (a, yy) => Math.exp(-((Math.hypot(wrapAngle(a - PI) * 1.5, yy - sunY) / (sunR * 1.25)) ** 4));
    const crest = (a, yy) => (0.5 + 0.5 * Math.cos(phiAt(a, yy))) ** 1.5 * (1 - calm(a, yy));
    const hem2 = (a) => hem0(a) - 0.26 * crest(a, hem0(a)) * smoothstep(1.3, 0.9, Math.abs(wrapAngle(a - PI)));
    const pts2 = trunk.filter((p) => p[1] < top2 + 0.3);
    const reach2 = (a, yy) => { const d = [Math.sin(a), Math.cos(a)]; let r = 0; for (const p of pts2) { if (Math.abs(p[1] - yy) > 0.07) continue; const x = p[0], z = p[2] - zc(yy), L = Math.hypot(x, z); if (L > 1e-6 && (x * d[0] + z * d[1]) / L > Math.cos(0.13)) r = Math.max(r, L); } return r; };
    const nv2 = 30, a0 = PI - 1.45, a1 = PI + 1.45, yBot = longY - 0.7;
    const cols2 = [];
    for (let j = 0; j <= nv2; j++) {
      const a = a0 + ((a1 - a0) * j) / nv2, R = [];
      for (let yy = top2; yy >= yBot - 1e-9; yy -= 0.05) R.push([reach2(a, yy), yy]);
      if (HANG) R.splice(0, R.length, ...hang(R)); else for (let k = 1; k < R.length; k++) R[k][0] = Math.max(R[k][0], R[k - 1][0]);
      const depth = (yy) => smoothstep(top2, longY, yy);
      cols2.push(R.map(([r, yy]) => [r + 0.12 + 0.08 * depth(yy) + EDGE_OUT * smoothstep(0.55, 1.05, Math.abs(wrapAngle(a - PI))) * Math.exp(-(((yy - (A.hip.l[1] - 0.3)) / 0.7) ** 2)) + (0.03 + FOLD_A * depth(yy)) * crest(a, yy) * smoothstep(FOLD_W, FOLD_W - 0.4, Math.abs(wrapAngle(a - PI))), yy]));
    }
    const nR = cols2[0].length - 1;
    const P2 = (u, v) => {
      const fi = u * nR, i = Math.min(nR - 1, Math.floor(fi)), g = fi - i, fj = v * nv2, j = Math.min(nv2 - 1, Math.floor(fj)), h = fj - j;
      const pt = (jj) => { const a = a0 + ((a1 - a0) * jj) / nv2, A0 = cols2[jj][i], A1 = cols2[jj][i + 1], r = A0[0] + (A1[0] - A0[0]) * g, yy = A0[1] + (A1[1] - A0[1]) * g; return [Math.sin(a) * r, yy, zc(yy) + Math.cos(a) * r]; };
      return lerp(pt(j), pt(j + 1), h);
    };
    const keep2 = (u, v) => { const a = a0 + (a1 - a0) * v, p = P2(u, v), d = wrapAngle(a - PI); return Math.min((halfW(p[1], d > 0) - Math.abs(d)) * 1.5, p[1] - hem2(a)); };
    const out2 = (u, v) => { const a = a0 + (a1 - a0) * v; return [Math.sin(a), 0, Math.cos(a)]; };
    const foldMat = (u, v) => { const a = a0 + (a1 - a0) * v, yy = P2(u, v)[1], c = crest(a, yy), k = smoothstep(1.15, 0.8, Math.abs(wrapAngle(a - PI))) * smoothstep(top2 - 0.2, top2 - 1.0, yy); return k < 0.3 ? 'cloak' : c < 0.2 ? 'cloakM' : c > 0.7 ? 'cloakL' : 'cloak'; };
    const panel = sheet(P2, { nu: Math.round((top2 - yBot) / 0.22), nv: nv2, keep: keep2, mat: foldMat, thick: 0.04, inner: false, wall: false, edge: 'cloakD', w: (p) => Wt(p), out: out2 });
    parts.push(panel);
    // (the house's sun across its middle: sixteen rays, long and short, round a disc, in gold laid on the cloth)
    {
      const nR = cols2[0].length - 1, uOfY = (yy) => clamp((top2 - yy) / (top2 - yBot)), yc = sunY;
      const R = sunR, disc = 0.26 * R, du = (R * 1.15) / (top2 - yBot), dvv = (R * 1.15) / (1.3 * (a1 - a0));
      const uc = uOfY(yc);
      const at = (us, vs) => { const u = uc - du + 2 * du * us, v = 0.5 - dvv + 2 * dvv * vs; return { u, v, p: P2(u, v) }; };
      const star = (p) => {
        const x = p[0], yy = p[1] - yc, rho = Math.hypot(x, yy), th = Math.atan2(x, yy);
        const k = Math.round((th / TAU) * 16), d = Math.abs(wrapAngle(th - (k * TAU) / 16)) * rho, long = k % 2 === 0, L = (long ? 1 : 0.72) * R;
        const ray = (long ? 0.13 : 0.1) * R * (1 - (rho - disc) / (L - disc)) - d;
        return Math.max(disc - rho, rho < L ? ray : L - rho);
      };
      const sun = sheet((us, vs) => { const q = at(us, vs); return add(q.p, mul(unit(out2(q.u, q.v)), 0.05)); }, {
        nu: 26, nv: 26, keep: (us, vs) => star(at(us, vs).p), open: true, mat: (us, vs) => (Math.hypot(at(us, vs).p[0], at(us, vs).p[1] - yc) < disc * 0.75 ? 'brz' : 'terra'), w: (q) => Wt(q), out: (us, vs) => { const q = at(us, vs); return out2(q.u, q.v); },
      });
      parts.push(sun);
      const q = at(0.5, 0.5), n = unit(out2(q.u, q.v));
      parts.push(stud(add(q.p, mul(n, 0.03)), n, { r: disc * 0.55, h: 0.06, k: 8, mat: 'brzL', w: () => Wt(q.p) }));
    }
    // (its border: an ochre band round its sides and foot)
    for (const L of panel.loops) {
      const path = smoothPath(resamplePath(loopPath(L, { inset: 0.12, lift: 0.012 }), Math.max(16, Math.round(pathLength(L, true) / 0.24)), true), 1, true);
      parts.push(sweep(path, { closed: true, profile: [[-0.13, -0.012], [0.13, -0.012], [0.13, 0.022], [-0.13, 0.022]], centreUp: 0.005, mat: 'terra', w: (p) => Wt(p) }));
      // (a running key along its foot, short of the corners)
      const aOfP = (q) => Math.atan2(q[0], q[2] - zc(q[1])), onFoot = (q) => { const a = aOfP(q), d = wrapAngle(a - PI); return q[1] < hem2(((a % TAU) + TAU) % TAU) + 0.35 && Math.abs(d) < halfW(q[1], d > 0) - 0.3; };
      const flags = path.map((q) => onFoot(q.p)), nP = path.length;
      let best = null;
      for (let k = 0; k < nP; k++) if (flags[k] && !flags[(k + nP - 1) % nP]) { let m = 0; while (m < nP && flags[(k + m) % nP]) m++; if (!best || m > best[1]) best = [k, m]; }
      if (best && best[1] > 4) {
        const run = [...Array(best[1]).keys()].map((m) => path[(best[0] + m) % nP]);
        const sides = run.map((q, k) => unit(cross(unit(sub(run[Math.min(run.length - 1, k + 1)].p, run[Math.max(0, k - 1)].p)), q.n)));
        const at2 = (sv, h) => { const f = clamp(sv) * (run.length - 1), k = Math.min(run.length - 2, Math.floor(f)), g = f - k, q = lerp(run[k].p, run[k + 1].p, g), sd = unit(lerp(sides[k], sides[k + 1], g)), n = unit(lerp(run[k].n, run[k + 1].n, g)); return { p: add(add(q, mul(sd, (h - 0.5) * 0.24)), mul(n, 0.022)), n }; };
        parts.push(...meander(at2, { count: Math.max(3, Math.round(pathLength(run) / 0.32)), band: 0.24, wide: 0.17, high: 0.02, sink: 0.012, mat: 'cloakD', w: (p) => Wt(p), open: true, fine: 0.95 }));
      }
    }
    // (the weights at its two lower corners: bronze drops)
    for (const sgn of [-1, 1]) {
      const a = PI + sgn * halfW(hem2(PI + sgn), sgn > 0) * 0.97, yy = hem2(a), c0 = add([Math.sin(a) * 0, 0, 0], P2(clamp((top2 - yy) / (top2 - yBot)), (a - a0) / (a1 - a0))), down = [0, -1, 0], o = [Math.sin(a), 0, Math.cos(a)];
      const ring = (rr, dy) => [...Array(6).keys()].map((k) => { const t = (k / 6) * TAU; return add(add(c0, mul(down, dy)), add(mul([Math.cos(t), 0, Math.sin(t)], rr), mul(o, 0.03))); });
      const Q = part();
      const prof = [[0.02, 0.0], [0.08, 0.09], [0.1, 0.18], [0.07, 0.27], [0.0, 0.32]];
      const rings = prof.map(([rr, dy]) => ring(rr, dy).map((pp) => put(Q, pp, down, Wt(c0))));
      for (let i = 0; i + 1 < rings.length; i++) for (let k = 0; k < 6; k++) { const k1 = (k + 1) % 6, v4 = [rings[i][k], rings[i][k1], rings[i + 1][k1], rings[i + 1][k]]; quad(Q, v4, sub(mul(v4.reduce((ss, x) => add(ss, Q.V[x]), [0, 0, 0]), 0.25), add(c0, mul(down, prof[i][1]))), 'brzL'); }
      parts.push(Q);
    }
  }
  // the pin: a bronze sun of sixteen rays on the right shoulder
  {
    const c0 = add(P3(0.55, 0.03), mul(unit(out(0, 0.03)), 0.2)), n = unit(add(unit(out(0, 0.03)), [0, 0.7, 0.9])), Wp = Wt(c0);
    const x = unit(cross([0, 1, 0.2], n)), y = cross(n, x), Q = part();
    const at = (r, t, h) => add(add(c0, mul(n, h)), add(mul(x, Math.cos(t) * r), mul(y, Math.sin(t) * r)));
    // (the disc, its rim raised)
    const k = 16, R0 = male ? 0.42 : 0.36;
    const ringI = (r, h) => [...Array(k).keys()].map((i) => put(Q, at(r, (i / k) * TAU, h), n, Wp));
    const r0 = ringI(R0, 0.0), r1 = ringI(R0, 0.07), r2 = ringI(R0 * 0.8, 0.09), r3 = ringI(R0 * 0.35, 0.12), top = put(Q, add(c0, mul(n, 0.16)), n, Wp);
    const band = (a, b, m) => { for (let i = 0; i < k; i++) { const i1 = (i + 1) % k, v4 = [a[i], a[i1], b[i1], b[i]]; quad(Q, v4, sub(mul(v4.reduce((s, z) => add(s, Q.V[z]), [0, 0, 0]), 0.25), c0), m); } };
    band(r0, r1, 'brzS'); band(r1, r2, 'brzL'); band(r2, r3, 'brz');
    for (let i = 0; i < k; i++) tri(Q, [r3[i], r3[(i + 1) % k], top], n, 'brzL');
    // (the rays: eight long and eight short, raised over the disc and past its rim)
    for (let i = 0; i < k; i++) {
      const t = (i / k) * TAU + PI / k, long = i % 2 === 0, rr = long ? R0 * 1.75 : R0 * 1.35, wd = long ? 0.1 : 0.08;
      const base = [at(R0 * 0.38, t - wd * 1.4, 0.1), at(R0 * 0.38, t + wd * 1.4, 0.1)], tip = at(rr, t, 0.05);
      const lift = mul(n, 0.035);
      const v = [...base, tip].map((p) => put(Q, p, n, Wp)), w = [...base, tip].map((p) => put(Q, add(p, lift), n, Wp));
      tri(Q, w, n, 'rune'); tri(Q, v, mul(n, -1), 'brzS');
      for (let e = 0; e < 3; e++) { const e1 = (e + 1) % 3, mid = mul(add(Q.V[v[e]], Q.V[v[e1]]), 0.5), cc = mul(add(add(Q.V[v[0]], Q.V[v[1]]), Q.V[v[2]]), 1 / 3); quad(Q, [v[e], v[e1], w[e1], w[e]], sub(mid, cc), 'rune'); }
    }
    parts.push(Q);
  }
  return merge(...parts.map((q, k) => (tally('mantle' + k, q), q)));
}

/* ---- the boots: krepides ----------------------------------------------------------------------------------------- */
/**
 * The krepides: open-work leather boots, the toes bare: a thick sole under the foot, the upper a lattice of leather cut
 * clean into diamonds over the instep and round the heel up under the greave, a rolled cuff at its top, a strap over
 * the toes, a bronze boss on the outer ankle.
 */
export function krepides(B) {
  const A = B.at, parts = [], floor = A.floor;
  for (const s of ['l', 'r']) {
    const sg = s === 'l' ? 1 : -1, an = A.ankle[s], ba = A.ball[s];
    const footB = [`foot_${s}`, `ball_${s}`, `ankle_${s}`, `toes_${s}`];
    const topY = an[1] + 0.4;
    // the boot's own last: sections from the heel to a rounded toe, each a rounded box over the foot's slice there
    const FS = skinSamples(B).filter((q) => q.p[0] * sg > 0.3 && shareW(B, q.w, 'foot') > 0.5 && q.p[1] < an[1] - 0.12);
    const z0 = Math.min(...FS.map((q) => q.p[2])) - 0.06, z1 = Math.max(...FS.map((q) => q.p[2])) + 0.12;
    const NS = 24, sec = [...Array(NS + 1).keys()].map((k) => {
      const z = z0 + ((z1 - z0) * k) / NS, near = FS.filter((q) => Math.abs(q.p[2] - z) < 0.12);
      const xs = near.map((q) => q.p[0]), ys = near.map((q) => q.p[1]);
      return near.length ? { x0: Math.min(...xs), x1: Math.max(...xs), yt: Math.max(...ys) } : null;
    });
    for (let k = 0; k <= NS; k++) if (!sec[k]) sec[k] = sec[k - 1] ?? sec.find((x) => x);
    for (let pass = 0; pass < 3; pass++) for (let k = 1; k < NS; k++) for (const key of ['x0', 'x1', 'yt']) sec[k][key] = (sec[k - 1][key] + 2 * sec[k][key] + sec[k + 1][key]) / 4;
    const secAt = (u) => { const f = u * NS, k = Math.min(NS - 1, Math.floor(f)), g = f - k, A0 = sec[k], A1 = sec[k + 1]; return { x0: A0.x0 + (A1.x0 - A0.x0) * g, x1: A0.x1 + (A1.x1 - A0.x1) * g, yt: A0.yt + (A1.yt - A0.yt) * g }; };
    const spow = (x, e) => Math.sign(x) * Math.abs(x) ** e;
    // (in plan: a circle's arc round the toe, a gentler one round the heel)
    const zL = z1 - z0, uT = 1 - Math.min(0.32, 0.36 / zL), uH = Math.min(0.2, 0.3 / zL);
    const plan = (u) => {
      const q = secAt(u), tt = Math.max(0, (u - uT) / (1 - uT)), th = Math.max(0, (uH - u) / uH);
      const toe = Math.max(0.25, 1 - tt ** 2.5) ** 0.4, heel = Math.sqrt(Math.max(0.16, 1 - th * th));
      return { cx: (q.x0 + q.x1) / 2, wx: ((q.x1 - q.x0) / 2 + 0.08) * Math.min(toe, heel), toe, yt: q.yt, z: z0 + zL * u };
    };
    const LS = (u, v) => {
      const q = plan(u), ph = v * TAU, c = spow(Math.cos(ph), 0.75), sn = spow(Math.sin(ph), 0.75);
      // (a rounded D in section: the sides drawn in over the instep)
      const yb = floor - 0.04, yt = q.yt + 0.05 + 0.04 * smoothstep(0.75, 0.55, u);
      const hy = ((yt - yb) / 2) * (0.5 + 0.5 * q.toe ** 1.5), ym = yb + hy;
      return [q.cx + q.wx * c * (1 - 0.3 * Math.max(0, sn)), ym + hy * sn, q.z];
    };
    const Wl = (p) => { const f = smoothstep(ba[2] - 0.3, ba[2] - 0.05, p[2]), g = smoothstep(ba[2] - 0.02, ba[2] + 0.12, p[2]); return mixOf(B, [[`foot_${s}`, 1 - f], [`ball_${s}`, f * (1 - g)], [`toes_${s}`, f * g]]); };
    const nuL = 18, kc = Math.round(((ba[2] + 0.08 - z0) / (z1 - z0)) * nuL);
    const last = sheet(LS, { nu: nuL, nv: 14, closed: true, mat: (u) => (u > kc / nuL ? 'brz' : 'leather'), thick: 0.03, inner: false, wall: false, w: (p) => Wl(p), out: (u, v) => { const ph = v * TAU; return [Math.cos(ph), Math.sin(ph), (u - 0.5) * 0.5]; } });
    // (its ends closed)
    const capE = (u) => { const Q = part(), ring = [...Array(16).keys()].map((j) => { const p = LS(u, j / 16); return put(Q, p, [0, 0, u > 0.5 ? 1 : -1], Wl(p)); }), c = mul(ring.reduce((t, i) => add(t, Q.V[i]), [0, 0, 0]), 1 / 16), ci = put(Q, c, [0, 0, 1], Wl(c)); for (let j = 0; j < 16; j++) tri(Q, [ring[j], ring[(j + 1) % 16], ci], [0, 0, u > 0.5 ? 1 : -1], u > 0.5 ? 'brz' : 'leather'); return Q; };
    parts.push(last, capE(0), capE(1));
    // (the toe cap's edge rolled)
    parts.push(tube([...Array(16).keys()].map((j) => { const p = LS(kc / nuL, j / 16), ph = (j / 16) * TAU; return { p, n: unit([Math.cos(ph), Math.sin(ph), 0]) }; }), { r: 0.04, k: 4, closed: true, w: (p) => Wl(p), mat: 'brzL' }));
    // the shaft: round the ankle from inside the last up under the greave, a rolled cuff at its top
    const SH = field(B, { pick: (q) => q.p[0] * sg > 0.3 && shareW(B, q.w, 'foot', 'calf') > 0.6 && q.p[1] > an[1] - 0.6 && q.p[1] < topY + 0.3, nt: 8, na: 20, t: [an[1] - 0.4, topY], smooth: 3, relax: 2, frame: (t) => ({ o: [an[0], t, an[2] + 0.05], u: [0, 1, 0], f: [0, 0, 1], s: [sg, 0, 0] }), tOf: (p) => p[1] });
    const nsw = nearSkinW(B, (q) => q.p[0] * sg > 0.3 && shareW(B, q.w, 'foot', 'calf') > 0.6 && q.p[1] > an[1] - 0.5, () => true, 0.2), Wsh = (p) => (p[1] < an[1] - 0.25 ? mixOf(B, [[`foot_${s}`, 1]]) : nsw(p));
    const topA = (a) => topY - 0.26 * Math.max(0, -SH.dir(topY, a)[2]) ** 1.2, shS = (u, v) => { const a = v * TAU, t = an[1] - 0.4 + (topA(a) - an[1] + 0.4) * u; return add(SH.frame(t).o, mul(SH.dir(t, a), SH.r(t, a) + 0.03 + 0.05 * smoothstep(an[1] + 0.05, an[1] - 0.3, t) + 0.07 * Math.max(0, -SH.dir(t, a)[2]) ** 1.5)); };
    parts.push(sheet(shS, { nu: 5, nv: 18, closed: true, mat: () => 'leather', thick: 0.03, inner: false, wall: false, w: (p) => Wsh(p), out: (u, v) => SH.dir(0, v * TAU) }));
    // (the shaft's top is under the greave and the cuff's tabs: no rim)
    // the sole: the last's outline let out a little, a thick slab, its heel deeper
    {
      const Q = part(), NU = 16, yT = floor - 0.05, rows = [];
      const Wsole = (p) => Wl(p), us = [...Array(NU + 1).keys()].map((k) => k / NU);
      for (const u of us) {
        const q = plan(u), w = q.wx + 0.06, z = q.z + (u === 1 ? 0.06 : u === 0 ? -0.05 : 0), yB = floor - 0.17 - 0.08 * smoothstep(uH + 0.12, uH + 0.06, u);
        const pts = [[q.cx - w, yB, z], [q.cx + w, yB, z], [q.cx + w, yT, z], [q.cx - w, yT, z]];
        rows.push(pts.map((p, k) => put(Q, p, k < 2 ? [0, -1, 0] : [0, 1, 0], Wsole(p))));
      }
      for (let k = 0; k < NU; k++) {
        const A0 = rows[k], A1 = rows[k + 1];
        quad(Q, [A0[0], A0[1], A1[1], A1[0]], [0, -1, 0], 'sole'); quad(Q, [A0[3], A1[3], A1[2], A0[2]], [0, 1, 0], 'sole');
        quad(Q, [A0[1], A0[2], A1[2], A1[1]], [1, 0, 0], 'soleE'); quad(Q, [A0[0], A1[0], A1[3], A0[3]], [-1, 0, 0], 'soleE');
      }
      quad(Q, [rows[0][0], rows[0][3], rows[0][2], rows[0][1]], [0, 0, -1], 'soleE'); quad(Q, [rows[NU][0], rows[NU][1], rows[NU][2], rows[NU][3]], [0, 0, 1], 'soleE');
      Q.soles = rows.flatMap((r) => [r[0], r[1]]);
      parts.push(Q);
    }
    // the lacing up the instep: linen thongs crossed between bronze eyelets; crimson straps down each side to the sole
    {
      const nOf = (v) => { const ph = v * TAU; return unit([Math.cos(ph), Math.sin(ph), 0]); };
      const on = (u, v, lift) => add(LS(u, v), mul(nOf(v), lift));
      const uA = Math.max(0.3, (kc - 1) / nuL), uB = 0.26, NE = 5, dv = 0.105, prof = [[-0.045, -0.015], [0.045, -0.015], [0.045, 0.03], [-0.045, 0.03]];
      const eye = (k, side) => { const u = uA + ((uB - uA) * k) / (NE - 1); return [u, 0.25 + side * dv]; };
      for (let k = 0; k < NE; k++) for (const side of [-1, 1]) {
        const [u, v] = eye(k, side);
        parts.push(stud(on(u, v, 0.015), nOf(v), { r: 0.045, h: 0.035, k: 4, mat: 'brzL', w: Wl }));
        if (k < NE - 1) { const [u2, v2] = eye(k + 1, -side), path = [0, 0.5, 1].map((f) => { const uu = u + (u2 - u) * f, vv = v + (v2 - v) * f; return { p: on(uu, vv, 0.03 + 0.012 * Math.sin(f * Math.PI)), n: nOf(vv) }; }); parts.push(sweep(path, { profile: prof, mat: 'linen', w: Wl })); }
        // (a strap from each eyelet down and back to the sole's edge)
        if (k === 1 || k === 3) { const path = [0, 0.25, 0.5, 0.75, 1].map((f) => { const vv = v + (0.25 + side * 0.36 - v) * f, uu = u - 0.09 * f; return { p: on(uu, vv, 0.025), n: nOf(vv) }; }); parts.push(sweep(path, { profile: [[-0.055, -0.015], [0.055, -0.015], [0.055, 0.03], [-0.055, 0.03]], mat: 'ox', w: Wl })); }
      }
      // (and up the shaft's front, crossed)
      const path = [];
      for (let j = 0; j <= 4; j++) { const u = 0.38 + (0.27 * j) / 4, v = (j % 2 ? 0.07 : -0.07), d = SH.dir(0, v * TAU); path.push({ p: add(shS(u, (v + 1) % 1), mul(d, 0.03)), n: d }); }
      parts.push(sweep(path, { profile: prof, mat: 'linen', w: (p) => Wsh(p) }));
    }
    // the cuff's tabs: a ring of little pteruges round the boot's top, crimson, hemmed in ochre
    {
      const AF = field(B, { pick: (q) => q.p[0] * sg > 0.3 && shareW(B, q.w, 'foot', 'calf') > 0.6 && Math.abs(q.p[1] - (topY - 0.2)) < 0.5, nt: 6, na: 24, t: [topY - 0.5, topY + 0.1], smooth: 3, relax: 2, frame: (t) => ({ o: [an[0], t, an[2] + 0.1], u: [0, 1, 0], f: [0, 0, 1], s: [sg, 0, 0] }), tOf: (p) => p[1] });
      const Wc = nearSkinW(B, (q) => q.p[0] * sg > 0.3 && shareW(B, q.w, 'foot', 'calf') > 0.6, (n) => n === `foot_${s}` || n === `calf_${s}` || n === `ankle_${s}`, 0.3);
      const nT = 9;
      for (let j = 0; j < nT; j++) {
        const gb = A.knee[s][1] + 0.9 * (an[1] - A.knee[s][1]), ac = (j / nT) * TAU, half = (TAU / nT) * 0.42, yTp = gb - 0.05, yBt = yTp - 0.3;
        const S = (u, v) => { const a = ac - half + 2 * half * v, yy = yTp + (yBt - yTp) * u; return add([an[0], yy, an[2] + 0.1], mul(AF.dir(yy, a), AF.r(yy, a) + 0.11 + 0.07 * u)); };
        parts.push(sheet(S, { nu: 2, nv: 1, mat: (u) => (u > 0.5 ? 'hem' : 'ox'), thick: 0.03, inner: false, edge: 'oxE', w: (p) => Wc(p), out: (u, v) => AF.dir(yTp, ac - half + 2 * half * v) }));
      }
    }
    // the boss on the toe cap's crown, its heart the boots' glow
    {
      const ub = Math.min(0.93, kc / nuL + 0.45 * (1 - kc / nuL)), p = LS(ub, 0.25), n = unit([0, 1, 0.35]);
      parts.push(stud(add(p, mul(n, 0.01)), n, { r: 0.1, h: 0.07, k: 6, mat: 'brzL', capMat: 'rune', w: Wl }));
    }
    void footB;
  }
  const P = merge(...parts.map((q, k) => (tally('boots' + k, q), q)));
  // (the feet's undersides, on the soles, left out)
  const polys = new Map();
  for (const t of B.tris) polys.set(t.poly, [...(polys.get(t.poly) ?? []), ...t.v]);
  for (const [poly, vs] of polys) if (vs.every((i) => on3(B, i, 'foot', 'ankle', 'calf', 'ball', 'toes') > 0.6 && B.V[i][1] < A.ankle[B.V[i][0] >= 0 ? 'l' : 'r'][1] + 0.4)) P.hides.add(poly);
  return P;
}
