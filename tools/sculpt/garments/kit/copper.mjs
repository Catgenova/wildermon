// The copper set's kit (tools/sculpt/garments/metalsets.mjs copper*): armour built as parts of its own on the body's
// bones rather than the body pushed out, so each piece has a silhouette of its own, clean edges, and cannot tear.
//
//   * the skin sampled (`skinSamples`) and weights read off it: one bone's (`boneW`), a fixed mix (`mixOf`), the skin's
//     under a piece averaged into one set so the piece moves as one (`skinW`), or the skin's near each point (`nearSkinW`).
//   * wraps: a grid laid round an axis (a limb, the spine; `wrap`, `limbWrap`, `torsoWrap`) or a centre (`domeWrap`), each
//     point as far out as the skin (and anything under the piece, `extra`) reaches that way, smoothed out and never in;
//     a plate cut from one along curved edges (`plateOn`), a grid laid by a function (`patch`).
//   * a solid (`solid`): a grid made a closed plate, its inside, a wall round every open edge.
//   * a soft wrap (`softWrap`): the body's own surface, subdivided and pushed out (metalkit `shell`), cut along a level
//     line (`level(p) = 0`) so its edges are smooth curves rather than the coarse body's polygon edges, its edges turned
//     in to a thickness, the skin it covers left out; its edge loops given back for trims.
//   * trims as geometry of their own: a swept profile along a path (`sweep`, `tube`, `band`), a coil round a limb
//     (`coil`), a flat spiral (`spiralPath`), studs (`stud`, `studsAlong`), a decal laid on a grid (`blob`).
//
// The plate kit's core (wrap, plateOn, solid, sweep, studs, domeWrap) follows the steel prototype's
// (tools/sculpt/garments/platekit.mjs there); copper keeps its own copy until that kit is shared.
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, part, assetOf, shell } from '../metalkit.mjs';

const TAU = Math.PI * 2;
export const PI = Math.PI;
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** Whether metalkit's assetOf writes a four-cornered face as one polygon (else faces are written as triangles). */
const QUADS = (() => {
  try {
    const P = part();
    for (const p of [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]) { P.V.push(p); P.N.push([0, 0, 1]); P.W.push([[0, 1]]); }
    P.F.push({ v: [0, 1, 2, 3], mat: 'm' });
    return assetOf({ who: 'x', bones: [] }, P, { m: { c: '#000000', kind: 0 } }).tris.length === 8;
  } catch { return false; }
})();

/* ---- weights ---------------------------------------------------------------------------------------------------- */
export function mixW(list) {
  const m = new Map();
  for (const [w, k] of list) for (const [b, x] of w) m.set(b, (m.get(b) ?? 0) + x * k);
  const top = [...m].filter(([, x]) => x > 1e-6).sort((a, b) => b[1] - a[1]).slice(0, 4), s = top.reduce((n, x) => n + x[1], 0) || 1;
  return top.map(([b, x]) => [b, x / s]);
}
export const boneW = (B, name) => [[B.bi.get(name), 1]];
export const mixOf = (B, list) => mixW(list.map(([n, k]) => [[[B.bi.get(n), 1]], k]));
export function keepBones(B, w, ok) {
  const kept = w.filter(([b]) => ok(B.bones[b].name));
  return kept.length ? mixW([[kept, 1]]) : w;
}

/* ---- the skin, sampled ------------------------------------------------------------------------------------------ */
const SAMPLES = new WeakMap();
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
      out.push({
        p: add(add(mul(B.V[a], w0), mul(B.V[b], u)), mul(B.V[c], v)),
        n: unit(add(add(mul(B.N[a], w0), mul(B.N[b], u)), mul(B.N[c], v))),
        w: mixW([[B.W[a], w0], [B.W[b], u], [B.W[c], v]]),
      });
    }
  }
  SAMPLES.set(B, out);
  return out;
}
/** A built part's points as samples (what a piece is laid over: the chest piece under a mantle). */
export const partSamples = (P) => P.V.map((p, i) => ({ p, n: P.N[i], w: P.W[i] }));
export const shareW = (B, w, ...parts) => w.reduce((s, [b, x]) => s + (parts.includes(B.partOf.get(b)) ? x : 0), 0);
export function skinW(B, pick, ok = () => true) {
  const S = skinSamples(B).filter(pick);
  return keepBones(B, mixW(S.map((s) => [s.w, 1 / S.length])), ok);
}
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

/* ---- grids ------------------------------------------------------------------------------------------------------ */
const frameOf = (F) => { const u = unit(F.u), f = unit(sub(F.f, mul(u, dot(F.f, u)))), s = F.s ? unit(sub(sub(F.s, mul(u, dot(F.s, u))), mul(f, dot(F.s, f)))) : cross(u, f); return { o: F.o, u, f, s }; };
function normalsOf(P, closed, out) {
  const rows = P.length, cols = P[0].length;
  return P.map((row, i) => row.map((p, j) => {
    const jm = closed ? (j + cols - 1) % cols : Math.max(0, j - 1), jp = closed ? (j + 1) % cols : Math.min(cols - 1, j + 1);
    const im = Math.max(0, i - 1), ip = Math.min(rows - 1, i + 1);
    let n = cross(sub(P[ip][j], P[im][j]), sub(row[jp], row[jm]));
    if (len(n) < 1e-9) n = out(i, j);
    n = unit(n);
    return dot(n, out(i, j)) < 0 ? mul(n, -1) : n;
  }));
}
function readerOf(G) {
  return (fi, fj) => {
    const rows = G.P.length, cols = G.P[0].length;
    fi = clamp(fi, 0, rows - 1);
    fj = G.closed ? ((fj % cols) + cols) % cols : clamp(fj, 0, cols - 1);
    const i0 = Math.min(rows - 2, Math.floor(fi)), j0 = G.closed ? Math.floor(fj) % cols : Math.min(cols - 2, Math.floor(fj));
    const j1 = G.closed ? (j0 + 1) % cols : j0 + 1, a = fi - i0, b = fj - Math.floor(fj) + (G.closed ? 0 : Math.floor(fj) - j0);
    const bl = (Q) => lerp(lerp(Q[i0][j0], Q[i0][j1], b), lerp(Q[i0 + 1][j0], Q[i0 + 1][j1], b), a);
    return { p: bl(G.P), n: unit(bl(G.N)) };
  };
}
export function gridOf(P, { closed = false, out }) {
  const G = { P, closed, N: normalsOf(P, closed, out) };
  G.at = readerOf(G);
  return G;
}
/** Smoothing a radius grid out (never in), its empty cells first filled from their neighbours. */
function fillSmooth(R, closed, passes) {
  const rows = R.length, cols = R[0].length;
  for (let pass = 0; pass < 60; pass++) {
    let left = 0;
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      if (R[i][j] > 0) continue;
      const n = [];
      if (closed || j > 0) n.push(R[i][(j + cols - 1) % cols]);
      if (closed || j < cols - 1) n.push(R[i][(j + 1) % cols]);
      if (i > 0) n.push(R[i - 1][j]);
      if (i < rows - 1) n.push(R[i + 1][j]);
      const got = n.filter((x) => x > 0);
      if (got.length) R[i][j] = got.reduce((x, y) => x + y, 0) / got.length; else left++;
    }
    if (!left) break;
  }
  for (let pass = 0; pass < passes; pass++) {
    const Q = R.map((row) => row.slice());
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const n = [R[Math.max(0, i - 1)][j], R[Math.min(rows - 1, i + 1)][j], R[i][closed ? (j + 1) % cols : Math.min(cols - 1, j + 1)], R[i][closed ? (j + cols - 1) % cols : Math.max(0, j - 1)]];
      Q[i][j] = Math.max(R[i][j], (n.reduce((x, y) => x + y, 0) + R[i][j]) / 5);
    }
    for (let i = 0; i < rows; i++) R[i] = Q[i];
  }
}
/**
 * A wrap round an axis: `nt` + 1 rows from t[0] to t[1] along it (`frame(t)`), `na` columns round it (closed: a full
 * turn from a[0]). Each point as far out as the samples `pick` chooses reach there (and `extra` samples, all of them),
 * smoothed out, then `shape(r, t, a)`. Read with `ta(t, a)`.
 */
export function wrap(B, o) {
  const nt = o.nt, closed = !!o.closed, na = o.na, cols = closed ? na : na + 1;
  const T = [...Array(nt + 1).keys()].map((i) => o.t[0] + ((o.t[1] - o.t[0]) * i) / nt);
  const Aa = [...Array(cols).keys()].map((j) => (closed ? o.a[0] + (TAU * j) / na : o.a[0] + ((o.a[1] - o.a[0]) * j) / na));
  const frames = T.map((t) => frameOf(o.frame(t)));
  const dt = (o.dt ?? 1.6) * Math.abs(o.t[1] - o.t[0]) / nt, da = Math.max(o.minDa ?? 0.14, (o.da ?? 1.6) * (closed ? TAU / na : Math.abs(o.a[1] - o.a[0]) / na));
  const S = [...skinSamples(B).filter(o.pick), ...(o.extra ?? [])].map((s) => {
    const t = o.tOf(s.p), F = frameOf(o.frame(t)), r = sub(s.p, F.o), ru = sub(r, mul(F.u, dot(r, F.u)));
    return { t, a: Math.atan2(dot(ru, F.s), dot(ru, F.f)), r: len(ru) };
  });
  const R = T.map((t) => Aa.map((a) => {
    let r = 0;
    for (const s of S) if (Math.abs(s.t - t) < dt && Math.abs(wrapAngle(s.a - a)) < da && s.r > r) r = s.r;
    return r;
  }));
  fillSmooth(R, closed, o.smooth ?? 3);
  const P = T.map((t, i) => Aa.map((a, j) => {
    const F = frames[i], d = add(mul(F.f, Math.cos(a)), mul(F.s, Math.sin(a)));
    return add(F.o, mul(d, o.shape ? o.shape(R[i][j], t, a, i, j) : R[i][j]));
  }));
  const G = gridOf(P, { closed, out: (i, j) => { const F = frames[i], a = Aa[j]; return add(mul(F.f, Math.cos(a)), mul(F.s, Math.sin(a))); } });
  const step = closed ? TAU / na : (o.a[1] - o.a[0]) / na;
  Object.assign(G, { T, Aa, R, frames, ta: (t, a) => G.at(((t - o.t[0]) / (o.t[1] - o.t[0])) * nt, closed ? wrapAngle(a - o.a[0]) / step : (a - o.a[0]) / step) });
  return G;
}
export function patch(fn, nu, nv, { closed = false } = {}) {
  const cols = closed ? nv : nv + 1, Q = [...Array(nu + 1).keys()].map((i) => [...Array(cols).keys()].map((j) => fn(i / nu, j / nv)));
  const G = gridOf(Q.map((row) => row.map((q) => q.p)), { closed, out: (i, j) => Q[i][j].n });
  G.U = [...Array(nu + 1).keys()].map((i) => i / nu); G.Vv = [...Array(cols).keys()].map((j) => j / nv);
  return G;
}
/** A plate on a field (`G.ta(t, a)`): rows u from `t0(a, v)` to `t1(a, v)`, columns from a0 to a1, out by `off(u, v, t, a)`. */
export function plateOn(G, o) {
  return patch((u, v) => {
    const a = o.a0 + (o.a1 - o.a0) * v, t = o.t0(a, v) + (o.t1(a, v) - o.t0(a, v)) * u, q = G.ta(t, a);
    return { p: add(q.p, mul(q.n, o.off(u, v, t, a))), n: q.n };
  }, o.nu, o.nv, { closed: o.closed });
}
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
export const along = (p, a, b) => { const ab = sub(b, a); return dot(sub(p, a), ab) / dot(ab, ab); };
export function limbWrap(B, a, b, out, o) {
  const u = unit(sub(b, a)), f = o.front ?? [0, 0, 1];
  return wrap(B, { ...o, frame: (t) => ({ o: lerp(a, b, t), u, f, s: [out, 0, 0] }), tOf: (p) => along(p, a, b) });
}
export function torsoWrap(B, y0, y1, zc, o) {
  return wrap(B, { t: [0, 1], ...o, frame: (t) => { const yy = y0 + (y1 - y0) * t; return { o: [0, yy, zc(yy)], u: [0, 1, 0], f: [0, 0, 1], s: [1, 0, 0] }; }, tOf: (p) => (p[1] - y0) / (y1 - y0) });
}
/**
 * A dome round a centre `c` (axis `u`, azimuth from `f`): rows of polar angle nought to `thMax`, each point as far out
 * as the samples reach along it (those within `cone`), smoothed out, then `shape(r, th, ph, d)`. Read with `ta(th/thMax, ph)`.
 */
export function domeWrap(B, o) {
  const rows = o.rows ?? 20, cols = o.cols ?? 32, thMax = o.thMax ?? PI / 2, cone = Math.cos(o.cone ?? 0.4);
  const F = frameOf({ o: o.c, u: o.u, f: o.f, s: o.s });
  const dir = (th, ph) => add(mul(F.u, Math.cos(th)), mul(add(mul(F.f, Math.cos(ph)), mul(F.s, Math.sin(ph))), Math.sin(th)));
  const S = [...skinSamples(B).filter(o.pick), ...(o.extra ?? [])].map((s) => { const v = sub(s.p, o.c), L = len(v); return { v: L > 1e-6 ? mul(v, 1 / L) : [0, 0, 0], L }; });
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
  fillSmooth(R, true, o.smooth ?? 3);
  const pole = R[0].reduce((a, b) => a + b, 0) / cols;
  R[0] = R[0].map(() => pole);
  const shape = o.shape ?? ((r) => r);
  const P = R.map((row, i) => row.map((r, j) => { const th = (i / rows) * thMax, ph = (j / cols) * TAU, d = dir(th, ph); return add(o.c, mul(d, shape(r, th, ph, d))); }));
  const G = gridOf(P, { closed: true, out: (i, j) => dir((i / rows) * thMax, (j / cols) * TAU) });
  Object.assign(G, { R, F, dir, thMax, rows, cols, ta: (t, a) => G.at(t * rows, (((a % TAU) + TAU) % TAU) / (TAU / cols)) });
  return G;
}
export const ellipsoidReach = (r, d) => 1 / Math.hypot(d[0] / r[0], d[1] / r[1], d[2] / r[2]);

/* ---- faces and solids ------------------------------------------------------------------------------------------- */
export const put = (P, p, n, w) => { P.V.push(p); P.N.push(n); P.W.push(w); return P.V.length - 1; };
/** A face (three or four corners) turned so its normal goes along `n`: a quad one polygon where the asset writer takes them. */
export function face(P, v, n, mat) {
  let m = [0, 0, 0];
  for (let k = 0; k < v.length; k++) { const a = P.V[v[k]], b = P.V[v[(k + 1) % v.length]]; m = add(m, cross(a, b)); }
  const vv = dot(m, n) < 0 ? [...v].reverse() : v;
  if (vv.length === 4 && !QUADS) { P.F.push({ v: [vv[0], vv[1], vv[2]], mat }, { v: [vv[0], vv[2], vv[3]], mat }); return; }
  P.F.push({ v: vv, mat });
}
/** A grid made a closed plate `thick` deep: cells in `mat(i, j)` (null: an opening), inside `inner`, walls `edge`. */
export function solid(G, o) {
  const P = part(), rows = G.P.length, cols = G.P[0].length, cl = G.closed;
  const th = typeof o.thick === 'function' ? o.thick : () => o.thick ?? 0.05;
  const O = G.P.map((row, i) => row.map((p, j) => put(P, p, G.N[i][j], o.w(p, i, j))));
  const I = G.P.map((row, i) => row.map((p, j) => put(P, sub(p, mul(G.N[i][j], th(i, j))), G.N[i][j], P.W[O[i][j]])));
  const used = new Map(), cells = [];
  const key = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);
  for (let i = 0; i + 1 < rows; i++) for (let j = 0; j < (cl ? cols : cols - 1); j++) {
    const m = o.mat(i, j);
    if (m === null || m === undefined) continue;
    const j1 = (j + 1) % cols, q = [[i, j], [i, j1], [i + 1, j1], [i + 1, j]];
    const n = unit(q.reduce((s, [a, b]) => add(s, G.N[a][b]), [0, 0, 0]));
    face(P, q.map(([a, b]) => O[a][b]), n, m);
    if (o.inner !== null) face(P, q.map(([a, b]) => I[a][b]), mul(n, -1), o.inner ?? m);
    // (inner null: one-sided, laid on something; its walls kept unless walls is false)
    cells.push({ q, n, i, j, m });
    for (let k = 0; k < 4; k++) { const e = key(O[q[k][0]][q[k][1]], O[q[(k + 1) % 4][0]][q[(k + 1) % 4][1]]); used.set(e, (used.get(e) ?? 0) + 1); }
  }
  if (o.walls !== false) for (const c of cells) for (let k = 0; k < 4; k++) {
    const [a, b] = [c.q[k], c.q[(k + 1) % 4]], oa = O[a[0]][a[1]], ob = O[b[0]][b[1]];
    if (used.get(key(oa, ob)) !== 1) continue;
    const mid = c.q.reduce((s, [x, y]) => add(s, G.P[x][y]), [0, 0, 0]), away = sub(lerp(G.P[a[0]][a[1]], G.P[b[0]][b[1]], 0.5), mul(mid, 0.25));
    const em = typeof o.edge === 'function' ? o.edge(c.i, c.j, c.m) : o.edge ?? c.m;
    face(P, [oa, ob, I[b[0]][b[1]], I[a[0]][a[1]]], away, em);
  }
  // (a pole: a row whose points all meet, its cells as triangles, so nothing degenerate is written)
  P.F = P.F.filter((f) => new Set(f.v.map((i) => P.V[i].map((x) => x.toFixed(6)).join())).size >= 3);
  for (const f of P.F) if (f.v.length === 4) {
    const keyOf = (i) => P.V[i].map((x) => x.toFixed(6)).join();
    const seen = new Set(), keep = [];
    for (const i of f.v) { const k = keyOf(i); if (!seen.has(k)) { seen.add(k); keep.push(i); } }
    f.v = keep;
  }
  P.O = O;
  return P;
}

/* ---- trims ------------------------------------------------------------------------------------------------------ */
/** A profile ([across, up] pairs, or `profile(k, q)`) swept along a path of {p, n}; weights `w(p, k)`; ends capped. */
export function sweep(path, o) {
  const P = part(), n = path.length, closed = !!o.closed;
  const rings = path.map((q, k) => {
    const prev = path[closed ? (k + n - 1) % n : Math.max(0, k - 1)].p, next = path[closed ? (k + 1) % n : Math.min(n - 1, k + 1)].p;
    const t = unit(sub(next, prev)), up = unit(sub(q.n, mul(t, dot(q.n, t)))), side = cross(t, up);
    const prof = typeof o.profile === 'function' ? o.profile(k, q) : o.profile;
    const w = o.w(q.p, k);
    return prof.map(([x, y]) => put(P, add(add(q.p, mul(side, x)), mul(up, y)), up, w));
  });
  for (let k = 0; k < (closed ? n : n - 1); k++) {
    const a = rings[k], b = rings[(k + 1) % n], c = lerp(path[k].p, path[(k + 1) % n].p, 0.5);
    const mk = typeof o.mat === 'function' ? o.mat(k) : o.mat;
    if (mk === null) continue;
    for (let j = 0; j < a.length; j++) {
      const j1 = (j + 1) % a.length;
      if (j1 === 0 && !o.closedProfile) continue;
      const v = [a[j], a[j1], b[j1], b[j]], mid = mul(v.reduce((s, i) => add(s, P.V[i]), [0, 0, 0]), 0.25);
      face(P, v, sub(mid, c), mk);
    }
  }
  if (!closed && o.caps !== false) for (const [k, dir] of [[0, -1], [n - 1, 1]]) {
    const r = rings[k], t = unit(sub(path[Math.min(n - 1, k + 1)].p, path[Math.max(0, k - 1)].p));
    const c = put(P, mul(r.reduce((s, i) => add(s, P.V[i]), [0, 0, 0]), 1 / r.length), t, P.W[r[0]]);
    const mk = o.capMat ?? (typeof o.mat === 'function' ? o.mat(Math.min(k, n - 2)) : o.mat);
    if (mk !== null) for (let j = 0; j < r.length; j++) face(P, [r[j], r[(j + 1) % r.length], c], mul(t, dir), mk);
  }
  return P;
}
export const roundProfile = (r, k = 6, lift = 0) => [...Array(k).keys()].map((j) => { const a = (j / k) * TAU; return [Math.cos(a) * r, lift + Math.sin(a) * r]; });
/** A tube along a path: radius `r` (or `r(k)`, tapering), `k` sides, lifted `lift`. */
export const tube = (path, o) => sweep(path, { ...o, profile: typeof o.r === 'function' ? (k, q) => roundProfile(o.r(k, q), o.k ?? 6, o.lift ?? 0) : roundProfile(o.r, o.k ?? 6, o.lift ?? 0), closedProfile: true });
/** A flat band `wide` across and `high` proud of the path (sunk `sink` into it). */
export const band = (path, o) => sweep(path, { ...o, closedProfile: true, profile: [[-o.wide / 2, -(o.sink ?? 0.02)], [o.wide / 2, -(o.sink ?? 0.02)], [o.wide / 2, o.high ?? 0.02], [-o.wide / 2, o.high ?? 0.02]] });
export function rowPath(G, fi, j0, j1, steps, lift = 0) {
  return [...Array(steps + 1).keys()].map((k) => { const q = G.at(fi, j0 + ((j1 - j0) * k) / steps); return { p: add(q.p, mul(q.n, lift)), n: q.n }; });
}
export function colPath(G, fj, i0, i1, steps, lift = 0) {
  return [...Array(steps + 1).keys()].map((k) => { const q = G.at(i0 + ((i1 - i0) * k) / steps, fj); return { p: add(q.p, mul(q.n, lift)), n: q.n }; });
}
/** A stud: `k` sided, `r` across, `h` high, on `c` facing `n`. */
export function stud(c, n, o) {
  const P = part(), k = o.k ?? 6, r = o.r, h = o.h ?? r * 0.8, nn = unit(n);
  const x = unit(cross(Math.abs(nn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], nn)), y = cross(nn, x), w = o.w(c);
  const ringAt = (rr, hh) => [...Array(k).keys()].map((j) => { const a = (j / k) * TAU; return put(P, add(c, add(mul(nn, hh), add(mul(x, Math.cos(a) * rr), mul(y, Math.sin(a) * rr)))), nn, w); });
  const r0 = ringAt(r, -(o.sink ?? 0.02)), r1 = ringAt(r * 0.72, h * 0.62), top = put(P, add(c, mul(nn, h)), nn, w);
  for (let j = 0; j < k; j++) {
    const j1 = (j + 1) % k, mid = add(c, mul(nn, h * 0.3));
    const v = [r0[j], r0[j1], r1[j1], r1[j]], m = mul(v.reduce((s, i) => add(s, P.V[i]), [0, 0, 0]), 0.25);
    face(P, v, sub(m, mid), o.mat);
    face(P, [r1[j], r1[j1], top], nn, o.capMat ?? o.mat);
  }
  return P;
}
export function studsAlong(path, count, o) {
  const L = [0];
  for (let k = 1; k < path.length; k++) L.push(L[k - 1] + len(sub(path[k].p, path[k - 1].p)));
  const out = [];
  for (let s = 0; s < count; s++) {
    const f = count === 1 ? 0.5 : (o.from ?? 0) + (((o.to ?? 1) - (o.from ?? 0)) * s) / (count - 1), x = f * L[L.length - 1];
    let k = 1;
    while (k < L.length - 1 && L[k] < x) k++;
    const g = clamp((x - L[k - 1]) / Math.max(1e-9, L[k] - L[k - 1]));
    out.push(stud(lerp(path[k - 1].p, path[k].p, g), unit(lerp(path[k - 1].n, path[k].n, g)), o));
  }
  return out;
}
/** A path's points evenly `step` apart along it (closed: round its loop). */
export function evenPath(path, step, closed = false) {
  const pts = closed ? [...path, path[0]] : path, L = [0];
  for (let k = 1; k < pts.length; k++) L.push(L[k - 1] + len(sub(pts[k].p, pts[k - 1].p)));
  const total = L[L.length - 1], n = Math.max(2, Math.round(total / step)), out = [];
  for (let s = 0; s < (closed ? n : n + 1); s++) {
    const x = (total * s) / n;
    let k = 1;
    while (k < L.length - 1 && L[k] < x) k++;
    const g = clamp((x - L[k - 1]) / Math.max(1e-9, L[k] - L[k - 1]));
    out.push({ p: lerp(pts[k - 1].p, pts[k].p, g), n: unit(lerp(pts[k - 1].n, pts[k].n, g)) });
  }
  return out;
}
/** A path smoothed `passes` times (its ends kept unless closed). */
export function smoothPath(path, passes = 2, closed = false) {
  let P = path;
  for (let k = 0; k < passes; k++) P = P.map((q, i) => {
    if (!closed && (i === 0 || i === P.length - 1)) return q;
    const a = P[(i + P.length - 1) % P.length], b = P[(i + 1) % P.length];
    return { p: add(mul(q.p, 0.5), mul(add(a.p, b.p), 0.25)), n: unit(add(mul(q.n, 0.5), mul(add(a.n, b.n), 0.25))) };
  });
  return P;
}
/**
 * A coil round an axis from `a` to `b` (a spiral armlet): `turns` turns, `per` points a turn, its radius `r(t)` (t nought
 * to one along it) from the axis, starting at angle `a0` from `front` (toward `side`). Points {p, n} (n out from the axis).
 */
export function coilPath(a, b, o) {
  const u = unit(sub(b, a)), f = unit(sub(o.front, mul(u, dot(o.front, u)))), s = cross(u, f), n = Math.round(o.turns * (o.per ?? 20));
  return [...Array(n + 1).keys()].map((k) => {
    const t = k / n, ang = (o.a0 ?? 0) + o.turns * TAU * t * (o.dir ?? 1), d = add(mul(f, Math.cos(ang)), mul(s, Math.sin(ang)));
    return { p: add(lerp(a, b, t), mul(d, o.r(t, ang))), n: d, t, ang };
  });
}
/**
 * A flat spiral (a wire's end coiled, a spiral inlay) in the plane at `c` facing `n` (its x along `x`): `turns` turns from
 * radius `r0` out to `r1`, `per` points a turn, `sense` its hand. Points {p, n}.
 */
export function spiralPath(c, n, x, o) {
  const nn = unit(n), xx = unit(sub(x, mul(nn, dot(x, nn)))), yy = cross(nn, xx), k = Math.round(o.turns * (o.per ?? 16));
  return [...Array(k + 1).keys()].map((i) => {
    const t = i / k, a = (o.a0 ?? 0) + (o.sense ?? 1) * o.turns * TAU * t, r = o.r0 + (o.r1 - o.r0) * t;
    return { p: add(c, add(mul(xx, Math.cos(a) * r), mul(yy, Math.sin(a) * r))), n: nn };
  });
}
/**
 * A decal on a grid (a dapple on a hide): a disc of rings round grid point (`fi`, `fj`), its radius `r(a)` in cells
 * (rows `kr` times as tall as the columns are wide), lifted `lift` off it: one-sided, in `mat`.
 */
export function blob(G, fi, fj, o) {
  const P = part(), k = o.k ?? 14, rings = o.rings ?? 2, kr = o.kr ?? 1;
  const at = (f, a) => { const r = o.r(a) * f; const q = G.at(fi + Math.sin(a) * r * kr, fj + Math.cos(a) * r); return put(P, add(q.p, mul(q.n, o.lift ?? 0.012)), q.n, o.w(q.p)); };
  const c0 = G.at(fi, fj), c = put(P, add(c0.p, mul(c0.n, o.lift ?? 0.012)), c0.n, o.w(c0.p));
  const R = [...Array(rings).keys()].map((ri) => [...Array(k).keys()].map((j) => at((ri + 1) / rings, (j / k) * TAU)));
  for (let j = 0; j < k; j++) face(P, [c, R[0][j], R[0][(j + 1) % k]], c0.n, o.mat);
  for (let ri = 0; ri + 1 < rings; ri++) for (let j = 0; j < k; j++) { const j1 = (j + 1) % k; face(P, [R[ri][j], R[ri][j1], R[ri + 1][j1], R[ri + 1][j]], c0.n, o.mat); }
  return P;
}
/** A part's every point moved (`f(p)`). */
export function moved(P, f) { P.V = P.V.map(f); return P; }

/* ---- the soft wrap: the body's surface cut along a level line ------------------------------------------------- */
/**
 * A soft wrap: metalkit's shell over the body points `keep` allows (subdivided `sub` times, out by `off(q)`), cut where
 * `level(p)` (p on the body under it) falls below nought, so its edges are smooth curves; each face in `mat(c)` (c its
 * middle on the body, `n` the normal). Its edges turned in `thick` (in `rim`), the body polygons it covers whole (every
 * point's level above `hideMargin`) left out. Gives back the part and its edge loops (each a closed or open list of
 * { p, n, w } along the edge, on the outside).
 */
export function softWrap(B, o) {
  const S = shell(B, { sub: o.sub ?? 2, keep: o.keep, off: o.off, mat: () => 'x', rim: null, hide: false, ...(o.keepTri ? { keepTri: o.keepTri } : {}), ...(o.move ? { move: o.move } : {}) });
  // (cut once along each level line in turn: a band between two lines is cut exactly, however coarse the mesh)
  const levels = Array.isArray(o.level) ? o.level : [o.level];
  const level = (p, w) => Math.min(...levels.map((f) => f(p, w)));
  const P = part();
  const Vs = S.V.map((p) => p), Ns = S.N.map((n) => n), Ws = S.W.map((w) => w);
  let tris = S.F.map((f) => f.v.slice());
  for (const f of levels) {
    const lv = new Map(), cut = new Map();
    const L = (i) => { if (!lv.has(i)) lv.set(i, f(Vs[i], Ws[i])); return lv.get(i); };
    const cutOf = (a, b) => {
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      if (!cut.has(key)) {
        const t = L(a) / (L(a) - L(b));
        Vs.push(lerp(Vs[a], Vs[b], t)); Ns.push(unit(lerp(Ns[a], Ns[b], t))); Ws.push(mixW([[Ws[a], 1 - t], [Ws[b], t]]));
        lv.set(Vs.length - 1, 0);
        cut.set(key, Vs.length - 1);
      }
      return cut.get(key);
    };
    const next = [];
    for (const t of tris) {
      const inn = t.map((i) => L(i) >= 0), n = inn.filter(Boolean).length;
      if (n === 0) continue;
      if (n === 3) { next.push(t); continue; }
      const r = [0, 1, 2].find((k) => (n === 1 ? inn[k] : !inn[k])), v = [t[r], t[(r + 1) % 3], t[(r + 2) % 3]];
      const ab = cutOf(v[0], v[1]), ac = cutOf(v[0], v[2]);
      if (n === 1) next.push([v[0], ab, ac]);
      else { next.push([ab, v[1], v[2]]); next.push([ab, v[2], ac]); }
    }
    tris = next;
  }
  const map = new Map(), vOf = (i) => { if (!map.has(i)) map.set(i, put(P, Vs[i], Ns[i], Ws[i])); return map.get(i); };
  tris = tris.map((t) => t.map(vOf));
  // (degenerate slivers where the line passes through a corner dropped)
  const area = (t) => len(cross(sub(P.V[t[1]], P.V[t[0]]), sub(P.V[t[2]], P.V[t[0]])));
  const kept = tris.filter((t) => area(t) > 1e-7);
  for (const t of kept) {
    const c = mul(add(add(P.V[t[0]], P.V[t[1]]), P.V[t[2]]), 1 / 3), n = unit(add(add(P.N[t[0]], P.N[t[1]]), P.N[t[2]]));
    const m = o.mat({ p: c, n });
    if (m === null) continue;
    const fn = cross(sub(P.V[t[1]], P.V[t[0]]), sub(P.V[t[2]], P.V[t[0]]));
    P.F.push({ v: dot(fn, n) < 0 ? [t[0], t[2], t[1]] : t, mat: m });
  }
  // (with `smoothW`, the weights smoothed over the wrap's own edges that many times: loose cloth spreads a bend, it does not tear)
  if (o.smoothW) {
    const nb = P.V.map(() => new Set());
    for (const f of P.F) for (let j = 0; j < 3; j++) { nb[f.v[j]].add(f.v[(j + 1) % 3]); nb[f.v[(j + 1) % 3]].add(f.v[j]); }
    for (let pass = 0; pass < o.smoothW; pass++) P.W = P.W.map((w, i) => (nb[i].size ? mixW([[w, 2], ...[...nb[i]].map((k) => [P.W[k], 2 / nb[i].size])]) : w));
  }
  // the edge loops
  const edgeN = new Map(), dirOf = new Map();
  for (const f of P.F) for (let j = 0; j < 3; j++) { const a = f.v[j], b = f.v[(j + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`; edgeN.set(key, (edgeN.get(key) ?? 0) + 1); dirOf.set(key, [a, b, f.mat]); }
  const next = new Map(), matOf = new Map();
  for (const [key, cnt] of edgeN) if (cnt === 1) { const [a, b, m] = dirOf.get(key); next.set(a, b); matOf.set(a, m); }
  const loops = [], seen = new Set();
  for (const s of next.keys()) {
    if (seen.has(s)) continue;
    const L = [];
    let v = s;
    while (v !== undefined && !seen.has(v)) { seen.add(v); L.push(v); v = next.get(v); }
    loops.push({ v: L, closed: v === s });
  }
  // the edges turned in
  const thick = o.thick ?? 0.04;
  if (o.rim !== null) {
    const inner = new Map(), inn = (i) => { if (!inner.has(i)) inner.set(i, put(P, sub(P.V[i], mul(P.N[i], thick)), P.N[i], P.W[i])); return inner.get(i); };
    for (const L of loops) for (let k = 0; k < (L.closed ? L.v.length : L.v.length - 1); k++) {
      if (o.rimSkip && o.rimSkip(L.v.map((i) => P.V[i]))) break;
      const a = L.v[k], b = L.v[(k + 1) % L.v.length];
      const rm = typeof o.rim === 'function' ? o.rim(matOf.get(a)) : o.rim ?? matOf.get(a);
      P.F.push({ v: [b, a, inn(a)], mat: rm }, { v: [b, inn(a), inn(b)], mat: rm });
    }
  }
  // the body's polygons under it whole left out
  // (with `hideLevel`, the body left out under a wider region than this part's own: where another part takes over)
  const hideLevel = o.hideLevel ? (p, w) => Math.min(...o.hideLevel.map((f) => f(p, w))) : level;
  if (o.hide !== false) {
    const all = new Map();
    for (const t of B.tris) all.set(t.poly, [...(all.get(t.poly) ?? []), ...t.v]);
    const m = o.hideMargin ?? 0.08;
    for (const [poly, vs] of all) if (B.A.polys[poly][1] !== 1 && B.A.polys[poly][1] !== 2 && vs.every((i) => o.keep(i) && hideLevel(B.V[i], B.W[i]) > m)) P.hides.add(poly);
  }
  P.loops = loops.filter((L) => L.v.length >= 6).map((L) => ({ closed: L.closed, path: L.v.map((i) => ({ p: P.V[i], n: P.N[i], w: P.W[i] })) }));
  return P;
}
/** A loop's points smoothed and evenly spaced (each put back on the surface the loop lay on: smoothing draws a loop in), lifted `lift` along their normals. */
export function loopPath(L, { step = 0.08, passes = 3, lift = 0 } = {}) {
  const sm = evenPath(smoothPath(L.path, passes, L.closed), step, L.closed);
  return sm.map((q) => {
    let b = L.path[0], bd = Infinity;
    for (const r of L.path) { const d = len(sub(r.p, q.p)); if (d < bd) { bd = d; b = r; } }
    const n = unit(b.n), p = sub(q.p, mul(n, dot(sub(q.p, b.p), n)));
    return { p: add(p, mul(n, lift)), n };
  });
}
/** The weights at the nearest of a list's points ({p, w}). */
export const nearestW = (list) => (p) => { let b = list[0], bd = Infinity; for (const q of list) { const d = len(sub(q.p, p)); if (d < bd) { bd = d; b = q; } } return b.w; };

/* ---- the torso, and discs laid on it -------------------------------------------------------------------------- */
/**
 * The torso as a field round its middle line, from `y0` up to `y1` (heights): the skin samples `pick` chooses and any
 * `extra` points under what is laid on it (a tunic). Read at a height with `tOfY`, back with `yOfT`.
 */
export function torsoField(B, { y0, y1, pick, extra = [], nt = 44, na = 64, smooth: sm = 5 }) {
  const zc = torsoMiddle(B, (s) => shareW(B, s.w, 'torso') > 0.8 && shareW(B, s.w, 'neck', 'head') < 0.25);
  const G = torsoWrap(B, y0, y1, zc, { pick, extra, nt, na, closed: true, a: [-PI, PI], smooth: sm });
  G.tOfY = (yy) => (yy - y0) / (y1 - y0);
  G.yOfT = (tt) => y0 + (y1 - y0) * tt;
  /** The angle round the torso at height `yy` where the field's x is `x`, on the front (or the back, `back`). */
  G.aAtX = (yy, x, back = false) => {
    const t = G.tOfY(yy);
    let lo = back ? PI : 0, hi = back ? PI / 2 : PI / 2;
    if (x < 0) { lo = back ? -PI : 0; hi = -PI / 2; }
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2, px = G.ta(t, m).p[0]; if (Math.abs(px) < Math.abs(x)) lo = m; else hi = m; }
    return (lo + hi) / 2;
  };
  return G;
}
/**
 * A disc laid on a torso field (`torsoField`) at height `yy` and across `x` (front, or `back`): `rings` rings out to
 * radius `r`, `segs` round, each point out off the field by `off(rho)` (rho nought to one), half straightened toward the
 * plane at its middle (a disc is stiffer than the body is round). A grid (rows the rings, a pole at the middle), its
 * middle `c`, normal `n` and in-plane axes `x`, `y` (up); `at(rho, phi)` reads it.
 */
export function discOn(F, o) {
  const back = !!o.back, a0 = F.aAtX(o.y, o.x, back), t0 = F.tOfY(o.y), q0 = F.ta(t0, a0);
  const n0 = q0.n, up = unit(sub([0, 1, 0], mul(n0, n0[1]))), side = unit(sub(sub([1, 0, 0], mul(n0, n0[0])), mul(up, dot([1, 0, 0], up))));
  // (the field's radius here, to turn a step across into an angle round)
  const R = Math.hypot(q0.p[0], q0.p[2] - F.frames[Math.round(t0 * (F.T.length - 1))].o[2]) || 1;
  const stiff = o.stiff ?? 0.5;
  const G = patch((u, v) => {
    const rho = u * o.r, phi = v * 2 * PI, dx = Math.cos(phi) * rho, dy = Math.sin(phi) * rho;
    // (the field's angle grows toward the body's left on the front, toward its right on the back)
    const sgn = back ? -1 : 1;
    const q = F.ta(F.tOfY(o.y + dy), a0 + (sgn * dx) / R), conf = add(q.p, mul(q.n, o.off(u)));
    const plane = add(add(q0.p, add(mul(side, dx), mul(up, dy))), mul(n0, o.off(u)));
    const push = Math.max(0, dot(sub(plane, conf), n0)) * stiff;
    return { p: add(conf, mul(n0, push)), n: unit(lerp(q.n, n0, stiff)) };
  }, o.rings, o.segs, { closed: true });
  const grid = G.at;
  Object.assign(G, { grid, c: add(q0.p, mul(n0, o.off(0))), n: n0, x: side, y: up, r: o.r, at: (rho, phi) => grid(rho * o.rings, (((phi % (2 * PI)) + 2 * PI) % (2 * PI)) / (2 * PI) * o.segs) });
  return G;
}
/** A ring path on a disc grid (`discOn`) at radius fraction `rho`, `steps` points, lifted `lift`. */
export const discRing = (G, rho, steps, lift = 0) => [...Array(steps).keys()].map((k) => { const q = G.at(rho, (k / steps) * 2 * PI); return { p: add(q.p, mul(q.n, lift)), n: q.n }; });

/**
 * A path laid over a surface (points with normals: a part's, `partSamples`): the given points joined, `step` apart, each
 * moved onto the plane of the surface's nearest point there and lifted `lift` off it, smoothed. A strap, a cord.
 */
export function drapePath(pts, surf, { step = 0.08, lift = 0.05, passes = 3 } = {}) {
  const raw = evenPath(pts.map((p) => ({ p, n: [0, 0, 1] })), step);
  const snap = (p) => {
    let b = surf[0], bd = Infinity;
    for (const q of surf) { const d = (q.p[0] - p[0]) ** 2 + (q.p[1] - p[1]) ** 2 + (q.p[2] - p[2]) ** 2; if (d < bd) { bd = d; b = q; } }
    const n = unit(b.n);
    return { p: add(sub(p, mul(n, dot(sub(p, b.p), n))), mul(n, lift)), n };
  };
  let P = raw.map((q) => snap(q.p));
  for (let k = 0; k < passes; k++) P = smoothPath(P, 1).map((q) => snap(sub(q.p, mul(q.n, lift))));
  return P;
}

/** On a dome (`domeWrap`) whose rows go down as they go out: the row fraction (nought to one) at azimuth `ph` where it is down to height `yy`. */
export function domeTAtY(D, ph, yy, lo = 0, hi = 1) {
  if (D.ta(hi, ph).p[1] > yy) return hi;
  for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (D.ta(m, ph).p[1] > yy) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
/** A small deterministic random stream (a dapple's place, a lock's length): the same every build. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
