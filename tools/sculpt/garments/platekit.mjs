// The plate kit: armour built as hard parts of its own rather than the body pushed out (tools/sculpt/garments/metalkit.mjs
// shells), so each piece has a silhouette of its own and clean edges, and cannot tear.
//
//   * a wrap (`wrap`, `limbWrap`, `torsoWrap`, `headWrap`): a grid laid round an axis (a limb's bone, the spine, the head's
//     middle), each point as far out as the body's skin reaches that way (measured on points sampled over its triangles,
//     `skinSamples`), smoothed out and never in, plus the clearance and the shape the piece asks for (a ridge, a flare,
//     a bulge); a grid also any surface a function lays (`gridOf`). `G.at(i, j)` reads a grid between its rows and columns.
//   * a solid (`solid`): a grid made a closed plate: its outside, its inside `thick` in (a darker material: what is seen
//     under a plate's edge), and a wall round every open edge; a cell given no material is an opening (a sight, a gap
//     between lames). Its faces are quads, one shade each, so its colour edges follow its rows and columns.
//   * trims laid on a piece as geometry of their own, never painted face by face: a swept profile (`sweep`: a rolled
//     edge, `tube`; a raised band or an etched line, `band`) along a path on a grid (`rowPath`, `colPath`, `pathOn`), and
//     studs (`stud`, `studsAlong`: rivets, bosses).
//   * weights: one bone's (`boneW`), a fixed mix (`mixOf`), the skin's under a piece averaged into one set so the piece
//     moves as one (`skinW`), or the skin's at each point smoothed (`nearSkinW`).
//
// A part is metalkit's (`part()`): V, N, W, F ({ v: corners, three or four, mat }), hides, soles; parts are put together
// with metalkit's `merge` and written with its `assetOf`.
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, part } from './metalkit.mjs';

const TAU = Math.PI * 2;
/** An angle brought to -pi..pi. */
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/* ---- weights ---------------------------------------------------------------------------------------------------- */
/** Weights summed per bone, the heaviest four kept and made to sum to one. */
export function mixW(list) {
  const m = new Map();
  for (const [w, k] of list) for (const [b, x] of w) m.set(b, (m.get(b) ?? 0) + x * k);
  const top = [...m].filter(([, x]) => x > 1e-6).sort((a, b) => b[1] - a[1]).slice(0, 4), s = top.reduce((n, x) => n + x[1], 0) || 1;
  return top.map(([b, x]) => [b, x / s]);
}
/** All on one bone, by name. */
export const boneW = (B, name) => [[B.bi.get(name), 1]];
/** A fixed mix of bones by name: [[name, share], ...]. */
export const mixOf = (B, list) => mixW(list.map(([n, k]) => [[[B.bi.get(n), 1]], k]));
/** Only the bones `ok(name)` allows, the rest dropped and the weights made to sum to one again (none allowed: as given). */
export function keepBones(B, w, ok) {
  const kept = w.filter(([b]) => ok(B.bones[b].name));
  return kept.length ? mixW([[kept, 1]]) : w;
}

/* ---- the skin, sampled ------------------------------------------------------------------------------------------ */
const SAMPLES = new WeakMap();
/**
 * Points sampled over the body's skin (its eyes and brows left out), `k` steps along each triangle's edges: each its
 * point, normal and weights. The coarse body measured at its triangles' insides, not only at its corners.
 */
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
/** How much of weights `w` are on a part's bones (metalkit PARTS). */
export const shareW = (B, w, ...parts) => w.reduce((s, [b, x]) => s + (parts.includes(B.partOf.get(b)) ? x : 0), 0);
/**
 * One set of weights for a whole piece: the skin's weights at the samples `pick` chooses, averaged (only the bones `ok`
 * allows), so the piece moves as one with what is under it, as a plate strapped there would.
 */
export function skinW(B, pick, ok = () => true) {
  const S = skinSamples(B).filter(pick);
  return keepBones(B, mixW(S.map((s) => [s.w, 1 / S.length])), ok);
}
/**
 * Weights at a point: the skin's at the samples nearest it (within `reach` of the nearest), averaged, only the bones `ok`
 * allows: a piece that bends with the body under it as smoothly as its weights change there.
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

/* ---- grids: wraps round an axis --------------------------------------------------------------------------------- */
/** A frame: origin, axis u, front f (made square to u), side s = u x f unless given. */
const frameOf = (F) => { const u = unit(F.u), f = unit(sub(F.f, mul(u, dot(F.f, u)))), s = F.s ? unit(sub(sub(F.s, mul(u, dot(F.s, u))), mul(f, dot(F.s, f)))) : cross(u, f); return { o: F.o, u, f, s }; };
/** A grid's normals from its points, turned out along `out(i, j)` (a direction the outside faces). */
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
/** A grid read between its rows and columns: the point and normal at fractional row `fi` and column `fj`. */
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
/** A grid from points `P` (rows of columns; `closed`: its columns go round), its normals facing out along `out(i, j)`. */
export function gridOf(P, { closed = false, out }) {
  const G = { P, closed, N: normalsOf(P, closed, out) };
  G.at = readerOf(G);
  return G;
}
/**
 * A wrap round an axis: `nt` + 1 rows from t0 to t1 along it (`frame(t)`: its origin, axis `u`, front `f`, side `s`),
 * `na` columns round it (a full turn from `a[0]` when `closed`, else `a[0]` to `a[1]`; angle 0 the front, pi/2 the side
 * `s`). Each point as far out from the axis as the skin samples `pick` chooses reach there (`tOf(p)` placing a sample
 * along the axis; or the points `points` given, a piece's or several pieces': an envelope), `post(R, T, Aa)` changing
 * them as measured, smoothed out `smooth` times and never in, then `shape(r, t, a)` (its clearance, ridges and flares;
 * the radius it is given the skin's). The grid's rows also carry `T` and its columns `Aa`.
 */
export function wrap(B, o) {
  const nt = o.nt, closed = !!o.closed, na = o.na, cols = closed ? na : na + 1;
  const T = [...Array(nt + 1).keys()].map((i) => o.t[0] + ((o.t[1] - o.t[0]) * i) / nt);
  const Aa = [...Array(cols).keys()].map((j) => (closed ? o.a[0] + (TAU * j) / na : o.a[0] + ((o.a[1] - o.a[0]) * j) / na));
  const frames = T.map((t) => frameOf(o.frame(t)));
  const dt = (o.dt ?? 1.6) * Math.abs(o.t[1] - o.t[0]) / nt, da = Math.max(o.minDa ?? 0.14, (o.da ?? 1.6) * (closed ? TAU / na : Math.abs(o.a[1] - o.a[0]) / na));
  // (each sample placed once: along the axis, round it, how far out)
  const S = (o.points ? o.points.map((p) => ({ p })) : skinSamples(B).filter(o.pick)).map((s) => {
    const t = o.tOf(s.p), F = frameOf(o.frame(t)), r = sub(s.p, F.o), ru = sub(r, mul(F.u, dot(r, F.u)));
    return { t, a: Math.atan2(dot(ru, F.s), dot(ru, F.f)), r: len(ru) };
  });
  const R = T.map((t) => Aa.map((a) => {
    let r = 0;
    for (const s of S) if (Math.abs(s.t - t) < dt && Math.abs(wrapAngle(s.a - a)) < da && s.r > r) r = s.r;
    return r;
  }));
  // (a cell no sample reached: its neighbours' along the row, then the rows')
  const fill = () => {
    for (let pass = 0; pass < 40; pass++) {
      let left = 0;
      for (let i = 0; i <= nt; i++) for (let j = 0; j < cols; j++) {
        if (R[i][j] > 0) continue;
        const n = [];
        if (closed || j > 0) n.push(R[i][(j + cols - 1) % cols]);
        if (closed || j < cols - 1) n.push(R[i][(j + 1) % cols]);
        if (i > 0) n.push(R[i - 1][j]);
        if (i < nt) n.push(R[i + 1][j]);
        const got = n.filter((x) => x > 0);
        if (got.length) R[i][j] = got.reduce((x, y) => x + y, 0) / got.length; else left++;
      }
      if (!left) break;
    }
  };
  // (a cell nothing reached: its neighbours', or `empty` where given, so a hung cloth does not take a far neighbour's reach)
  if (o.empty !== undefined) for (const row of R) for (let j = 0; j < cols; j++) { if (row[j] <= 0) row[j] = o.empty; }
  else fill();
  // (the radii as measured, before smoothing, changed as the piece says: a cloth hung from what it lies over)
  if (o.post) o.post(R, T, Aa);
  for (let pass = 0; pass < (o.smooth ?? 3); pass++) {
    const Q = R.map((row) => row.slice());
    for (let i = 0; i <= nt; i++) for (let j = 0; j < cols; j++) {
      const n = [R[Math.max(0, i - 1)][j], R[Math.min(nt, i + 1)][j], R[i][closed ? (j + 1) % cols : Math.min(cols - 1, j + 1)], R[i][closed ? (j + cols - 1) % cols : Math.max(0, j - 1)]];
      Q[i][j] = Math.max(R[i][j], (n.reduce((x, y) => x + y, 0) + R[i][j]) / 5);
    }
    for (let i = 0; i <= nt; i++) R[i] = Q[i];
  }
  const P = T.map((t, i) => Aa.map((a, j) => {
    const F = frames[i], d = add(mul(F.f, Math.cos(a)), mul(F.s, Math.sin(a)));
    return add(F.o, mul(d, o.shape(R[i][j], t, a, i, j)));
  }));
  const G = gridOf(P, { closed, out: (i, j) => { const F = frames[i], a = Aa[j]; return add(mul(F.f, Math.cos(a)), mul(F.s, Math.sin(a))); } });
  // (read at a place along the axis and an angle round it, rather than a row and a column)
  const step = closed ? TAU / na : (o.a[1] - o.a[0]) / na;
  Object.assign(G, { T, Aa, R, frames, ta: (t, a) => G.at(((t - o.t[0]) / (o.t[1] - o.t[0])) * nt, closed ? wrapAngle(a - o.a[0]) / step : (a - o.a[0]) / step) });
  return G;
}
/**
 * A grid laid by a function: `nu` + 1 rows (u nought to one) of `nv` + 1 columns (v nought to one; `closed`, `nv` columns
 * going round, v short of one), each `fn(u, v)` a point and the way out there ({ p, n }).
 */
export function patch(fn, nu, nv, { closed = false } = {}) {
  const cols = closed ? nv : nv + 1, Q = [...Array(nu + 1).keys()].map((i) => [...Array(cols).keys()].map((j) => fn(i / nu, j / nv)));
  const G = gridOf(Q.map((row) => row.map((q) => q.p)), { closed, out: (i, j) => Q[i][j].n });
  G.U = [...Array(nu + 1).keys()].map((i) => i / nu); G.Vv = [...Array(cols).keys()].map((j) => j / nv);
  return G;
}
/**
 * A plate on a skin field (`G.ta(t, a)`, a wrap's): rows u from `t0(v)` to `t1(v)` along the axis, columns v from `a0`
 * to `a1` round it, each point out off the skin along its normal by `off(u, v, t, a)`. Its edges follow `t0` and `t1`
 * exactly, however they curve: a neckline, an armhole, a point. With `level`, out level with the ground rather than along
 * the normal; with `maxUp`, along it but climbing no steeper than that.
 */
export function plateOn(G, o) {
  return patch((u, v) => {
    const a = o.a0 + (o.a1 - o.a0) * v, t = o.t0(a, v) + (o.t1(a, v) - o.t0(a, v)) * u, q = G.ta(t, a);
    // (out along the skin's normal, or level with the ground where `level`: a collar that should not climb the neck)
    const d = o.level ? unit([q.n[0], 0, q.n[2]]) : o.maxUp !== undefined ? unit([q.n[0], Math.min(q.n[1], o.maxUp), q.n[2]]) : q.n;
    return { p: add(q.p, mul(d, o.off(u, v, t, a))), n: q.n };
  }, o.nu, o.nv, { closed: o.closed });
}
/** A torso's middle line's depth at each height: halfway between its front and its back there (the skin samples `pick` chooses), smoothed. */
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
/** Where a point is along a segment from `a` to `b`, nought to one. */
export const along = (p, a, b) => { const ab = sub(b, a); return dot(sub(p, a), ab) / dot(ab, ab); };
/**
 * A wrap round a limb from `a` to `b` (two of the body's joints), its front `front` (in the body's axes; its side the
 * limb's outer side, `out`: +1 the body's left, -1 its right), t along it nought at `a` and one at `b`.
 */
export function limbWrap(B, a, b, out, o) {
  const u = unit(sub(b, a)), f = o.front ?? [0, 0, 1];
  return wrap(B, { ...o, frame: (t) => ({ o: lerp(a, b, t), u, f, s: [out, 0, 0] }), tOf: (p) => along(p, a, b) });
}
/**
 * A wrap round the torso: rows from height y0 to y1 (t nought to one), round a line up the body's middle at depth
 * `zc(y)`, front +z, side +x (the body's left).
 */
export function torsoWrap(B, y0, y1, zc, o) {
  return wrap(B, { t: [0, 1], ...o, frame: (t) => { const yy = y0 + (y1 - y0) * t; return { o: [0, yy, zc(yy)], u: [0, 1, 0], f: [0, 0, 1], s: [1, 0, 0] }; }, tOf: (p) => (p[1] - y0) / (y1 - y0) });
}

/* ---- a plate: a grid made solid --------------------------------------------------------------------------------- */
const put = (P, p, n, w) => { P.V.push(p); P.N.push(n); P.W.push(w); return P.V.length - 1; };
/** A face (three or four corners) turned so its normal goes along `n`. */
export function face(P, v, n, mat) {
  let m = [0, 0, 0];
  for (let k = 0; k < v.length; k++) { const a = P.V[v[k]], b = P.V[v[(k + 1) % v.length]]; m = add(m, cross(a, b)); }
  // (turned by reversing all but the first corner: a quad keeps its diagonal, so a plate's inside never pokes through its outside)
  P.F.push({ v: dot(m, n) < 0 ? [v[0], ...v.slice(1).reverse()] : v, mat });
}
/**
 * A grid made a closed plate `thick` deep: each cell `mat(i, j)`'s material (null: an opening), its inside `inner`, a wall
 * round each open edge `edge` (its material, or `edge(i, j)` the cell's it closes). Every point weighted `w(p, i, j)`.
 * With `sheet`, its outside alone (the renderer draws a face from both sides): a plate whose edges a rolled edge hides
 * and whose inside is seldom seen, at half the faces; with `hollow`, its outside and its edges' walls (a lame, whose
 * edge's depth shows but whose inside does not).
 */
export function solid(G, o) {
  const P = part(), rows = G.P.length, cols = G.P[0].length, cl = G.closed;
  const th = typeof o.thick === 'function' ? o.thick : () => o.thick ?? 0.05;
  const O = G.P.map((row, i) => row.map((p, j) => put(P, p, G.N[i][j], o.w(p, i, j))));
  const I = o.sheet ? null : G.P.map((row, i) => row.map((p, j) => put(P, sub(p, mul(G.N[i][j], th(i, j))), G.N[i][j], P.W[O[i][j]])));
  const used = new Map(), cells = [];
  const key = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);
  for (let i = 0; i + 1 < rows; i++) for (let j = 0; j < (cl ? cols : cols - 1); j++) {
    const m = o.mat(i, j);
    if (m === null || m === undefined) continue;
    const j1 = (j + 1) % cols, q = [[i, j], [i, j1], [i + 1, j1], [i + 1, j]];
    const n = unit(q.reduce((s, [a, b]) => add(s, G.N[a][b]), [0, 0, 0]));
    face(P, q.map(([a, b]) => O[a][b]), n, m);
    if (I && !o.hollow) face(P, q.map(([a, b]) => I[a][b]), mul(n, -1), o.inner ?? m);
    cells.push({ q, n, i, j, m });
    for (let k = 0; k < 4; k++) { const e = key(O[q[k][0]][q[k][1]], O[q[(k + 1) % 4][0]][q[(k + 1) % 4][1]]); used.set(e, (used.get(e) ?? 0) + 1); }
  }
  if (I) for (const c of cells) for (let k = 0; k < 4; k++) {
    const [a, b] = [c.q[k], c.q[(k + 1) % 4]], oa = O[a[0]][a[1]], ob = O[b[0]][b[1]];
    if (used.get(key(oa, ob)) !== 1) continue;
    // (the wall faces away from the cell's middle)
    const mid = c.q.reduce((s, [x, y]) => add(s, G.P[x][y]), [0, 0, 0]), away = sub(lerp(G.P[a[0]][a[1]], G.P[b[0]][b[1]], 0.5), mul(mid, 0.25));
    const em = typeof o.edge === 'function' ? o.edge(c.i, c.j, c.m) : o.edge ?? c.m;
    face(P, [oa, ob, I[b[0]][b[1]], I[a[0]][a[1]]], away, em);
  }
  P.O = O;
  return P;
}

/* ---- trims: swept profiles and studs ---------------------------------------------------------------------------- */
/**
 * A profile swept along a path (points `p` with the surface's normal `n` there): each point's profile (its own [across,
 * up] pairs, `profile(k)`, or one for all) laid square to the path, `across` along the path's side and `up` along the
 * normal, every point weighted `w(p)`; its ends capped. A rolled edge, a raised band, an etched line, a cord.
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
    const mk = typeof o.mat === 'function' ? o.mat(Math.min(k, n - 2)) : o.mat;
    if (mk !== null) for (let j = 0; j < r.length; j++) face(P, [r[j], r[(j + 1) % r.length], c], mul(t, dir), mk);
  }
  return P;
}
/** A round profile of radius `r` in `k` steps, lifted `lift` off the path (three: a ridge, its point outward). */
export const roundProfile = (r, k = 6, lift = 0) => [...Array(k).keys()].map((j) => { const a = (j / k) * TAU + (k === 3 ? PI2 : 0); return [Math.cos(a) * r, lift + Math.sin(a) * r]; });
/** A tube (a rolled edge, a cord) along a path: `r` round, `k` sides (three, a ridge, unless given), lifted `lift` off it. */
export const tube = (path, o) => sweep(path, { ...o, profile: roundProfile(o.r, o.k ?? 3, o.lift ?? 0), closedProfile: true });
/** A flat band `wide` across and `high` proud of the path (sunk `sink` into it), its sides square. */
export const band = (path, o) => sweep(path, { ...o, closedProfile: true, profile: [[-o.wide / 2, -(o.sink ?? 0.02)], [o.wide / 2, -(o.sink ?? 0.02)], [o.wide / 2, o.high ?? 0.02], [-o.wide / 2, o.high ?? 0.02]] });
/** A grid's row `fi` from column `j0` to `j1` (fractional, `steps` points; going round where it is closed), lifted `lift` off it. */
export function rowPath(G, fi, j0, j1, steps, lift = 0) {
  return [...Array(steps + 1).keys()].map((k) => { const q = G.at(fi, j0 + ((j1 - j0) * k) / steps); return { p: add(q.p, mul(q.n, lift)), n: q.n }; });
}
/** A grid's column `fj` from row `i0` to `i1`, as `rowPath`. */
export function colPath(G, fj, i0, i1, steps, lift = 0) {
  return [...Array(steps + 1).keys()].map((k) => { const q = G.at(i0 + ((i1 - i0) * k) / steps, fj); return { p: add(q.p, mul(q.n, lift)), n: q.n }; });
}
/** A path on a grid through points given in its rows and columns (`[fi, fj]` each), lifted `lift` off it. */
export const pathOn = (G, pts, lift = 0) => pts.map(([fi, fj]) => { const q = G.at(fi, fj); return { p: add(q.p, mul(q.n, lift)), n: q.n }; });
/** A path's points resampled `steps` apart evenly along its length (a smoother band from few given points). */
export function resample(G, pts, steps, lift = 0) {
  const P0 = pts.map(([fi, fj]) => G.at(fi, fj).p), L = [0];
  for (let k = 1; k < P0.length; k++) L.push(L[k - 1] + len(sub(P0[k], P0[k - 1])));
  const out = [];
  for (let s = 0; s <= steps; s++) {
    const x = (L[L.length - 1] * s) / steps;
    let k = 1;
    while (k < L.length - 1 && L[k] < x) k++;
    const f = clamp((x - L[k - 1]) / Math.max(1e-9, L[k] - L[k - 1])), a = pts[k - 1], b = pts[k];
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return pathOn(G, out, lift);
}
/** A stud (a rivet's head, a boss): `k` sided, `r` across its foot, `h` high, its foot sunk `sink`, on point `c` facing `n`. */
export function stud(c, n, o) {
  const P = part(), k = o.k ?? 5, r = o.r, h = o.h ?? r * 0.8, nn = unit(n);
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
/** Studs along a path, `count` of them evenly from its start to its end (or between `from` and `to` of its length, nought to one). */
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
/** A part's every point moved (`f(p)`), its normals kept: a piece built in one place and set in another. */
export function moved(P, f) { P.V = P.V.map(f); return P; }
/** The polygon count a part will write (its faces): for a budget. */
export const facesOf = (P) => P.F.length;

/**
 * A dome round a centre `c`: rows of polar angle from its axis `u` (nought to `thMax`), columns of azimuth round it from
 * `f` (toward `s` = u x f unless given), each point as far out along its direction as the skin samples `pick` chooses
 * reach (those within `cone` of it), smoothed out and never in, then `shape(r, th, ph, d)` (d the direction). Read at (polar angle, azimuth)
 * fractions with `ta(th / thMax, ph)`. A helm's skull, a pauldron's cop.
 */
export function domeWrap(B, o) {
  const rows = o.rows ?? 20, cols = o.cols ?? 32, thMax = o.thMax ?? PI2, cone = Math.cos(o.cone ?? 0.4);
  const F = frameOf({ o: o.c, u: o.u, f: o.f, s: o.s });
  const dir = (th, ph) => add(mul(F.u, Math.cos(th)), mul(add(mul(F.f, Math.cos(ph)), mul(F.s, Math.sin(ph))), Math.sin(th)));
  const S = (o.points ? o.points.map((p) => ({ p })) : skinSamples(B).filter(o.pick)).map((s) => { const v = sub(s.p, o.c), L = len(v); return { v: L > 1e-6 ? mul(v, 1 / L) : [0, 0, 0], L }; });
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
  for (let pass = 0; pass < 40; pass++) {
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
  // (the pole's row all the one mean, so the top is not pinched)
  const pole = R[0].reduce((a, b) => a + b, 0) / cols;
  R[0] = R[0].map(() => pole);
  const shape = o.shape ?? ((r) => r);
  const P = R.map((row, i) => row.map((r, j) => { const th = (i / rows) * thMax, ph = (j / cols) * TAU, d = dir(th, ph); return add(o.c, mul(d, shape(r, th, ph, d))); }));
  const G = gridOf(P, { closed: true, out: (i, j) => dir((i / rows) * thMax, (j / cols) * TAU) });
  Object.assign(G, { R, F, dir, thMax, ta: (t, a) => G.at(t * rows, wrapAngle(a) / (TAU / cols)) });
  return G;
}
const PI2 = Math.PI / 2;
/** How far from its middle an ellipsoid of radii `r` (along the body's x, y, z) reaches along unit direction `d`: a cop, a skull. */
export const ellipsoidReach = (r, d) => 1 / Math.hypot(d[0] / r[0], d[1] / r[1], d[2] / r[2]);

/**
 * A part's weights smoothed over its faces `passes` times (each point's the mean of its own and its neighbours'), so a
 * soft layer stretches evenly across a fold rather than all at one edge (only the points `ok(p)` allows).
 */
export function smoothWeights(P, passes = 2, ok = () => true) {
  const nb = P.V.map(() => new Set());
  for (const f of P.F) for (let k = 0; k < f.v.length; k++) { const a = f.v[k], b = f.v[(k + 1) % f.v.length]; nb[a].add(b); nb[b].add(a); }
  for (let pass = 0; pass < passes; pass++) P.W = P.W.map((w, i) => (nb[i].size && ok(P.V[i]) ? mixW([[w, 1], ...[...nb[i]].map((j) => [P.W[j], 1 / nb[i].size])]) : w));
  return P;
}

/**
 * The body's polygons a part covers at rest left out under it (`hides`): each whose every corner, and its middle, sees
 * the part within `reach` straight out along its normal (only those `ok(pi)` allows). What a soft layer's own rule leaves
 * showing at its edges (a polygon with a corner on its rim) but a plate over it hides.
 */
export function coverHides(B, P, reach = 0.6, ok = () => true) {
  const T = [];
  for (const f of P.F) for (let k = 1; k + 1 < f.v.length; k++) T.push([P.V[f.v[0]], P.V[f.v[k]], P.V[f.v[k + 1]]]);
  const box = T.map((t) => [0, 1, 2].map((c) => [Math.min(t[0][c], t[1][c], t[2][c]), Math.max(t[0][c], t[1][c], t[2][c])]));
  const hit = (o, d) => {
    const e = add(o, mul(d, reach));
    const lo = [0, 1, 2].map((c) => Math.min(o[c], e[c])), hi = [0, 1, 2].map((c) => Math.max(o[c], e[c]));
    for (let k = 0; k < T.length; k++) {
      const b = box[k];
      if (b[0][1] < lo[0] || b[0][0] > hi[0] || b[1][1] < lo[1] || b[1][0] > hi[1] || b[2][1] < lo[2] || b[2][0] > hi[2]) continue;
      const [a, bb, c] = T[k], e1 = sub(bb, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
      if (Math.abs(det) < 1e-9) continue;
      const fi = 1 / det, s = sub(o, a), u = fi * dot(s, h);
      if (u < 0 || u > 1) continue;
      const q = cross(s, e1), v = fi * dot(d, q);
      if (v < 0 || u + v > 1) continue;
      const tt = fi * dot(e2, q);
      if (tt > 0 && tt < reach) return true;
    }
    return false;
  };
  B.A.polys.forEach(([v, m], pi) => {
    if (P.hides.has(pi) || m === 1 || m === 2 || !ok(pi)) return;
    const c = mul(v.reduce((s, i) => add(s, B.V[i]), [0, 0, 0]), 1 / v.length), n = unit(v.reduce((s, i) => add(s, B.N[i]), [0, 0, 0]));
    // (each corner's ray from a little inside the polygon, so it does not pass exactly through a soft layer's own corner)
    if (v.every((i) => hit(lerp(B.V[i], c, 0.03), B.N[i])) && hit(c, n)) P.hides.add(pi);
  });
  return P;
}
