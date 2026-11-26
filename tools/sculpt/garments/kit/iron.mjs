// The iron set's kit (tools/sculpt/garments/metalsets.mjs iron*): hard parts made as solids of their own on the body's
// bones rather than the body pushed out, trims and fittings as geometry of their own, so every edge is clean.
//
//   * the skin sampled over its triangles (`skinSamples`) and measured round an axis (`reach`): how far out the body goes
//     at each place along the axis and angle round it, smoothed, never in; a piece laid on that (`onReach`) fits both
//     bodies with the clearance it asks for.
//   * a grid of points (`grid`: rows u, columns v, `closed` going round) made a solid (`slab`): its outside, its inside
//     `thick` in (or none, closed down onto what is under it), a wall round every open edge; a cell given no material an
//     opening.
//   * trims swept along a path (`sweep`, `tube`, `strap`) and studs (`stud`, `studs`): rivets, bosses, lacing, rims.
//   * weights: one bone's (`boneW`), a mix (`mixOf`), the skin's under a piece averaged into one (`skinW`: it moves as
//     one), or the skin's near each point smoothed (`nearW`: it bends as the body under it does).
//
// Faces are triangles only (metalkit's `assetOf` writes three corners a face). Every face is turned out along the way
// it was given.
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, smooth, part, headCentre, on as onPart, waistOf, shell as bodyShell, feet as bodyFeet, merge } from '../metalkit.mjs';

export const TAU = Math.PI * 2;
export const PI = Math.PI;
/** An angle brought to -pi..pi. */
export const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/* ---- weights ------------------------------------------------------------------------------------------------------ */
/** Weights summed per bone, the heaviest four kept, made to sum to one. */
export function mixW(list) {
  const m = new Map();
  for (const [w, k] of list) for (const [b, x] of w) m.set(b, (m.get(b) ?? 0) + x * k);
  const top = [...m].filter(([, x]) => x > 1e-6).sort((a, b) => b[1] - a[1]).slice(0, 4), s = top.reduce((n, x) => n + x[1], 0) || 1;
  return top.map(([b, x]) => [b, x / s]);
}
export const boneW = (B, name) => [[B.bi.get(name), 1]];
/** A mix of bones by name: [[name, share], ...]. */
export const mixOf = (B, list) => mixW(list.filter(([, k]) => k > 0).map(([n, k]) => [[[B.bi.get(n), 1]], k]));
/** Only the bones `ok(name)` allows (none allowed: as given). */
export function keepBones(B, w, ok) {
  const kept = w.filter(([b]) => ok(B.bones[b].name));
  return kept.length ? mixW([[kept, 1]]) : w;
}

/* ---- the skin, sampled -------------------------------------------------------------------------------------------- */
const SAMPLES = new WeakMap();
/** Points over the body's skin (its eyes and brows left out), `k` steps along each triangle's edges: point, normal, weights. */
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
/** How much of weights `w` are on these parts' bones (metalkit PARTS). */
export const shareW = (B, w, ...parts) => w.reduce((s, [b, x]) => s + (parts.includes(B.partOf.get(b)) ? x : 0), 0);
/** One set of weights for a whole piece: the skin's at the samples `pick` chooses, averaged, only bones `ok` allows. */
export function skinW(B, pick, ok = () => true) {
  const S = skinSamples(B).filter(pick);
  return keepBones(B, mixW(S.map((s) => [s.w, 1 / S.length])), ok);
}
/** Weights at a point: the skin's at the samples nearest it (within `reach` of the nearest), averaged; only bones `ok` allows. */
export function nearW(B, pick = () => true, ok = () => true, reach = 0.4) {
  const S = skinSamples(B).filter(pick), memo = new Map();
  return (p) => {
    const key = p.map((x) => x.toFixed(3)).join(',');
    if (memo.has(key)) return memo.get(key);
    let best = Infinity;
    const d = S.map((s) => { const x = len(sub(s.p, p)); if (x < best) best = x; return x; });
    const list = [];
    S.forEach((s, k) => { if (d[k] < best + reach) list.push([s.w, 1 / (0.05 + d[k] - best)]); });
    const w = keepBones(B, mixW(list), ok);
    memo.set(key, w);
    return w;
  };
}

/* ---- the body measured round an axis ------------------------------------------------------------------------------ */
/** A frame square to axis `u` with front `f` (made square to it); side `s` = u x f. */
export const frame = (o, u, f) => { const uu = unit(u), ff = unit(sub(f, mul(uu, dot(f, uu)))); return { o, u: uu, f: ff, s: cross(uu, ff) }; };
/** The way out at angle `a` round a frame (nought its front, pi/2 its side). */
export const dirOf = (F, a) => add(mul(F.f, Math.cos(a)), mul(F.s, Math.sin(a)));
/**
 * How far out the skin samples `pick` chooses reach round an axis: `frame(t)` its frame at t (t0 to t1, `nt` steps;
 * `tOf(p)` a sample's t), `na` angles round. Each bin the farthest sample in it, the empty ones filled from their
 * neighbours, smoothed `smooth` times out and never in. Returns r(t, a), read between the bins.
 */
export function reach(B, o) {
  const nt = o.nt ?? 24, na = o.na ?? 32, [t0, t1] = o.t;
  const R = [...Array(nt + 1)].map(() => new Array(na).fill(0));
  const dt = (t1 - t0) / nt, da = TAU / na;
  for (const s of o.points ?? skinSamples(B)) {
    if (!o.pick(s)) continue;
    const t = o.tOf(s.p), fi = (t - t0) / dt;
    if (fi < -0.6 || fi > nt + 0.6) continue;
    const F = o.frame(clamp(t, t0, t1)), r = sub(s.p, F.o), ru = sub(r, mul(F.u, dot(r, F.u)));
    const a = Math.atan2(dot(ru, F.s), dot(ru, F.f)), rr = len(ru);
    const i = clamp(Math.round(fi), 0, nt), j = ((Math.round(a / da) % na) + na) % na;
    // (a sample counts in its bin and the two beside it round the axis, so a thin limb's bins are not left empty)
    for (const jj of [j, (j + 1) % na, (j + na - 1) % na]) if (rr > R[i][jj] * (jj === j ? 1 : 1.04)) R[i][jj] = jj === j ? rr : Math.max(R[i][jj], rr * 0.96);
  }
  for (let pass = 0; pass < 60; pass++) {
    let left = 0;
    for (let i = 0; i <= nt; i++) for (let j = 0; j < na; j++) {
      if (R[i][j] > 0) continue;
      const n = [R[i][(j + 1) % na], R[i][(j + na - 1) % na], i > 0 ? R[i - 1][j] : 0, i < nt ? R[i + 1][j] : 0].filter((x) => x > 0);
      if (n.length) R[i][j] = n.reduce((a, b) => a + b, 0) / n.length; else left++;
    }
    if (!left) break;
  }
  // (dilated: each bin the farthest of it and its neighbours, so a surface laid on it clears sharp edges between bins)
  for (let pass = 0; pass < (o.dilate ?? 0); pass++) {
    const Q = R.map((row) => row.slice());
    for (let i = 0; i <= nt; i++) for (let j = 0; j < na; j++) Q[i][j] = Math.max(R[i][j], R[Math.max(0, i - 1)][j], R[Math.min(nt, i + 1)][j], R[i][(j + 1) % na], R[i][(j + na - 1) % na]);
    for (let i = 0; i <= nt; i++) R[i] = Q[i];
  }
  for (let pass = 0; pass < (o.smooth ?? 3); pass++) {
    const Q = R.map((row) => row.slice());
    for (let i = 0; i <= nt; i++) for (let j = 0; j < na; j++) {
      const n = [R[Math.max(0, i - 1)][j], R[Math.min(nt, i + 1)][j], R[i][(j + 1) % na], R[i][(j + na - 1) % na]];
      Q[i][j] = Math.max(R[i][j], (n.reduce((a, b) => a + b, 0) + R[i][j] * 2) / 6);
    }
    for (let i = 0; i <= nt; i++) R[i] = Q[i];
  }
  const r = (t, a) => {
    const fi = clamp((t - t0) / dt, 0, nt), i0 = Math.min(nt - 1, Math.floor(fi)), x = fi - i0;
    const fj = (((wrapA(a) / da) % na) + na) % na, j0 = Math.floor(fj) % na, j1 = (j0 + 1) % na, y = fj - Math.floor(fj);
    return lerp([R[i0][j0], 0, 0], [R[i0][j1], 0, 0], y)[0] * (1 - x) + lerp([R[i0 + 1][j0], 0, 0], [R[i0 + 1][j1], 0, 0], y)[0] * x;
  };
  return { r, frame: o.frame, t: o.t, R };
}
/** The skin's point (and normal) nearest `p0` among the samples `pick` chooses, its normal smoothed over those within `reach`. */
export function onSkin(B, pick, p0, reach0 = 0.18) {
  const S = skinSamples(B);
  let best = null, bd = Infinity;
  for (const s of S) { if (!pick(s)) continue; const d = len(sub(s.p, p0)); if (d < bd) { bd = d; best = s; } }
  let n = [0, 0, 0];
  for (const s of S) if (pick(s) && len(sub(s.p, best.p)) < reach0) n = add(n, s.n);
  return { p: best.p, n: unit(n) };
}
/** A point at t along a reach's axis, angle a round it, `off` out past the skin. */
export const onReach = (Rc, t, a, off = 0) => { const F = Rc.frame(t); return add(F.o, mul(dirOf(F, a), Rc.r(t, a) + off)); };

/* ---- building faces ----------------------------------------------------------------------------------------------- */
export const put = (P, p, w, n = [0, 0, 0]) => { P.V.push(p); P.N.push(n); P.W.push(w); return P.V.length - 1; };
/** A triangle turned so it faces along `out`. */
export function tri(P, a, b, c, mat, out) {
  const n = cross(sub(P.V[b], P.V[a]), sub(P.V[c], P.V[a]));
  if (len(n) < 1e-12) return;
  P.F.push({ v: out && dot(n, out) < 0 ? [a, c, b] : [a, b, c], mat });
}
/** A four-cornered face as two triangles (split along its shorter diagonal), turned along `out`. */
export function quad(P, a, b, c, d, mat, out) {
  if (len(sub(P.V[a], P.V[c])) <= len(sub(P.V[b], P.V[d]))) { tri(P, a, b, c, mat, out); tri(P, a, c, d, mat, out); } else { tri(P, a, b, d, mat, out); tri(P, b, c, d, mat, out); }
}

/**
 * A grid: `nu` + 1 rows of `nv` + 1 columns (`closed`: `nv` columns going round), each `fn(u, v)` a point, nought to one.
 * Its normals from its neighbours, turned along `out(u, v, p)`.
 */
export function grid(fn, nu, nv, { closed = false, out } = {}) {
  const cols = closed ? nv : nv + 1;
  const U = [...Array(nu + 1).keys()].map((i) => i / nu), Vv = [...Array(cols).keys()].map((j) => j / nv);
  const P = U.map((u) => Vv.map((v) => fn(u, v)));
  const N = P.map((row, i) => row.map((p, j) => {
    const jm = closed ? (j + cols - 1) % cols : Math.max(0, j - 1), jp = closed ? (j + 1) % cols : Math.min(cols - 1, j + 1);
    const im = Math.max(0, i - 1), ip = Math.min(nu, i + 1);
    let n = unit(cross(sub(P[ip][j], P[im][j]), sub(row[jp], row[jm])));
    const o = out ? out(U[i], Vv[j], p) : n;
    if (len(n) < 1e-9) n = unit(o);
    return dot(n, o) < 0 ? mul(n, -1) : n;
  }));
  return { P, N, U, V: Vv, closed, rows: nu + 1, cols };
}
/**
 * A grid made solid: its outside in `mat(i, j)` (a cell's; null an opening), its inside `thick(i, j)` in along the
 * normals in `inner` (null: none, the walls closed down onto what is under it), a wall round every open edge in `edge`.
 * Every point weighted `w(p, i, j)`.
 */
export function slab(G, o) {
  const P = part(), { rows, cols, closed } = G;
  const th = typeof o.thick === 'function' ? o.thick : () => o.thick ?? 0.05;
  const mat = typeof o.mat === 'function' ? o.mat : () => o.mat;
  const O = G.P.map((row, i) => row.map((p, j) => put(P, p, o.w(p, i, j))));
  const I = G.P.map((row, i) => row.map((p, j) => put(P, sub(p, mul(G.N[i][j], th(i, j))), P.W[O[i][j]])));
  const used = new Map(), cells = [];
  const key = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);
  for (let i = 0; i + 1 < rows; i++) for (let j = 0; j < (closed ? cols : cols - 1); j++) {
    const m = mat(i, j);
    if (m === null || m === undefined) continue;
    const j1 = (j + 1) % cols, q = [[i, j], [i, j1], [i + 1, j1], [i + 1, j]];
    const n = unit(q.reduce((s, [a, b]) => add(s, G.N[a][b]), [0, 0, 0]));
    quad(P, ...q.map(([a, b]) => O[a][b]), m, n);
    if (o.inner !== null) quad(P, ...q.map(([a, b]) => I[a][b]), o.inner ?? m, mul(n, -1));
    cells.push({ q, i, j, m });
    for (let k = 0; k < 4; k++) { const e = key(O[q[k][0]][q[k][1]], O[q[(k + 1) % 4][0]][q[(k + 1) % 4][1]]); used.set(e, (used.get(e) ?? 0) + 1); }
  }
  if (o.edge !== null) for (const c of cells) for (let k = 0; k < 4; k++) {
    const a = c.q[k], b = c.q[(k + 1) % 4], oa = O[a[0]][a[1]], ob = O[b[0]][b[1]];
    if (used.get(key(oa, ob)) !== 1) continue;
    const mid = mul(c.q.reduce((s, [x, y]) => add(s, G.P[x][y]), [0, 0, 0]), 0.25), away = sub(lerp(G.P[a[0]][a[1]], G.P[b[0]][b[1]], 0.5), mid);
    const em = typeof o.edge === 'function' ? o.edge(c.i, c.j, c.m, k) : o.edge ?? c.m;
    if (em === null) continue;
    quad(P, oa, ob, I[b[0]][b[1]], I[a[0]][a[1]], em, away);
  }
  return P;
}
/** A grid read between its rows and columns: the point and normal at fractional row `fi`, column `fj`. */
export function gridAt(G, fi, fj) {
  const { rows, cols, closed } = G;
  fi = clamp(fi, 0, rows - 1);
  fj = closed ? ((fj % cols) + cols) % cols : clamp(fj, 0, cols - 1);
  const i0 = Math.min(rows - 2, Math.floor(fi)), j0 = closed ? Math.floor(fj) % cols : Math.min(cols - 2, Math.floor(fj));
  const j1 = closed ? (j0 + 1) % cols : j0 + 1, a = fi - i0, b = fj - j0;
  const bl = (Q) => lerp(lerp(Q[i0][j0], Q[i0][j1], b), lerp(Q[i0 + 1][j0], Q[i0 + 1][j1], b), a);
  return { p: bl(G.P), n: unit(bl(G.N)) };
}
/** A path along a grid's row `fi` from column `j0` to `j1` in `steps`, lifted `lift` off it. */
export const rowPath = (G, fi, j0, j1, steps, lift = 0) => [...Array(steps + 1).keys()].map((k) => { const q = gridAt(G, fi, j0 + ((j1 - j0) * k) / steps); return { p: add(q.p, mul(q.n, lift)), n: q.n }; });
/** A path down a grid's column `fj` from row `i0` to `i1`. */
export const colPath = (G, fj, i0, i1, steps, lift = 0) => [...Array(steps + 1).keys()].map((k) => { const q = gridAt(G, i0 + ((i1 - i0) * k) / steps, fj); return { p: add(q.p, mul(q.n, lift)), n: q.n }; });

/** A part's weights smoothed over its own mesh `iters` times where `ok(p)` says (each point's the mean of it and its
 *  neighbours'): a skin-tight piece over a crease then stretches over many edges a little rather than over one a lot. */
export function smoothWeights(P, iters, ok = () => true) {
  const nb = P.V.map(() => new Set());
  for (const f of P.F) for (let k = 0; k < f.v.length; k++) { const a = f.v[k], b = f.v[(k + 1) % f.v.length]; nb[a].add(b); nb[b].add(a); }
  // (points at the same place, a rim's and its face's, kept as one)
  for (let it = 0; it < iters; it++) {
    const W2 = P.W.map((w, i) => (ok(P.V[i]) && nb[i].size ? mixW([[w, 1], ...[...nb[i]].map((j) => [P.W[j], 1])]) : w));
    P.W = W2;
  }
  return P;
}

/* ---- trims -------------------------------------------------------------------------------------------------------- */
/**
 * A profile swept along a path (points `p`, the way out `n` at each): the profile's [across, out] pairs laid square to
 * the path at each point (`profile(k)` or one for all), its ends capped unless `closed`. Weighted `w(p, k)`; material
 * `mat` (or `mat(k)`, a segment's; null leaves it out).
 */
export function sweep(path, o) {
  const P = part(), n = path.length, closed = !!o.closed;
  const rings = path.map((q, k) => {
    const prev = path[closed ? (k + n - 1) % n : Math.max(0, k - 1)].p, next = path[closed ? (k + 1) % n : Math.min(n - 1, k + 1)].p;
    const t = unit(sub(next, prev)), up = unit(sub(q.n, mul(t, dot(q.n, t)))), side = cross(t, up);
    const prof = typeof o.profile === 'function' ? o.profile(k, q) : o.profile;
    const w = o.w(q.p, k);
    return prof.map(([x, y]) => put(P, add(add(q.p, mul(side, x)), mul(up, y)), w));
  });
  for (let k = 0; k < (closed ? n : n - 1); k++) {
    const a = rings[k], b = rings[(k + 1) % n];
    const mk = typeof o.mat === 'function' ? o.mat(k) : o.mat;
    if (mk === null) continue;
    const c = lerp(path[k].p, path[(k + 1) % n].p, 0.5);
    for (let j = 0; j < a.length; j++) {
      const j1 = (j + 1) % a.length;
      if (j1 === 0 && !o.round) continue;
      const v = [a[j], a[j1], b[j1], b[j]], mid = mul(v.reduce((s, i) => add(s, P.V[i]), [0, 0, 0]), 0.25);
      quad(P, ...v, typeof o.faceMat === 'function' ? o.faceMat(k, j) ?? mk : mk, sub(mid, c));
    }
  }
  if (!closed && o.caps !== false) for (const [k, dir] of [[0, -1], [n - 1, 1]]) {
    const r = rings[k], t = unit(sub(path[Math.min(n - 1, k + 1)].p, path[Math.max(0, k - 1)].p));
    const mk = typeof o.mat === 'function' ? o.mat(Math.min(k, n - 2)) : o.mat;
    if (mk === null) continue;
    const c = put(P, mul(r.reduce((s, i) => add(s, P.V[i]), [0, 0, 0]), 1 / r.length), P.W[r[0]]);
    for (let j = 0; j < r.length; j++) tri(P, r[j], r[(j + 1) % r.length], c, mk, mul(t, dir));
  }
  return P;
}
/** A round profile `r` across in `k` steps, its middle `lift` out. */
export const roundProfile = (r, k = 6, lift = 0, flat = 1) => [...Array(k).keys()].map((j) => { const a = (j / k) * TAU; return [Math.cos(a) * r, lift + Math.sin(a) * r * flat]; });
/** A tube along a path (a rolled rim, a cord, a lace). */
export const tube = (path, o) => sweep(path, { ...o, profile: roundProfile(o.r, o.k ?? 6, o.lift ?? 0, o.flat ?? 1), round: true });
/** A flat strap `wide` across, `high` proud of the path (its foot sunk `sink`), its edges bevelled. */
export const strap = (path, o) => {
  const w = o.wide / 2, h = o.high ?? 0.03, s = o.sink ?? 0.02, b = Math.min(w * 0.3, h * 0.6);
  return sweep(path, { ...o, round: true, profile: [[-w, -s], [w, -s], [w, h - b], [w - b, h], [-w + b, h], [-w, h - b]] });
};
/** A stud (a rivet, a boss): `k` sided, `r` across its foot, `h` high, its foot sunk `sink`, on `c` facing `n`. */
export function stud(c, n, o) {
  const P = part(), k = o.k ?? 5, r = o.r, h = o.h ?? r * 0.8, nn = unit(n);
  const x = unit(cross(Math.abs(nn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], nn)), y = cross(nn, x), w = o.w(c);
  const ringAt = (rr, hh) => [...Array(k).keys()].map((j) => { const a = (j / k) * TAU + (o.turn ?? 0); return put(P, add(c, add(mul(nn, hh), add(mul(x, Math.cos(a) * rr), mul(y, Math.sin(a) * rr)))), w); });
  const r0 = ringAt(r, -(o.sink ?? 0.02)), r1 = ringAt(r * (o.shoulder ?? 0.72), h * 0.62), top = put(P, add(c, mul(nn, h)), w);
  for (let j = 0; j < k; j++) {
    const j1 = (j + 1) % k, mid = add(c, mul(nn, -h));
    const v = [r0[j], r0[j1], r1[j1], r1[j]], m = mul(v.reduce((s, i) => add(s, P.V[i]), [0, 0, 0]), 0.25);
    quad(P, ...v, o.mat, sub(m, mid));
    tri(P, r1[j], r1[j1], top, o.capMat ?? o.mat, nn);
  }
  return P;
}
/** Studs along a path: `count` evenly from `from` to `to` of its length (nought to one). */
export function studs(path, count, o) {
  const L = [0];
  for (let k = 1; k < path.length; k++) L.push(L[k - 1] + len(sub(path[k].p, path[k - 1].p)));
  const out = [];
  for (let s = 0; s < count; s++) {
    const f = count === 1 ? (o.from ?? 0.5) : (o.from ?? 0) + (((o.to ?? 1) - (o.from ?? 0)) * s) / (count - 1), x = f * L[L.length - 1];
    let k = 1;
    while (k < L.length - 1 && L[k] < x) k++;
    const g = clamp((x - L[k - 1]) / Math.max(1e-9, L[k] - L[k - 1]));
    out.push(stud(lerp(path[k - 1].p, path[k].p, g), unit(lerp(path[k - 1].n, path[k].n, g)), o));
  }
  return out;
}
/** A path's point at a share `f` of its length: { p, n, t } (t its way along). */
export function pathAt(path, f) {
  const L = [0];
  for (let k = 1; k < path.length; k++) L.push(L[k - 1] + len(sub(path[k].p, path[k - 1].p)));
  const x = clamp(f) * L[L.length - 1];
  let k = 1;
  while (k < L.length - 1 && L[k] < x) k++;
  const g = clamp((x - L[k - 1]) / Math.max(1e-9, L[k] - L[k - 1]));
  return { p: lerp(path[k - 1].p, path[k].p, g), n: unit(lerp(path[k - 1].n, path[k].n, g)), t: unit(sub(path[k].p, path[k - 1].p)) };
}
/** A solid of revolution-like loft: rings of points (same count), each ring's points given, lofted and capped; turned out from each ring's middle. */
export function loftRings(rings, o) {
  const P = part(), n = rings[0].length;
  const idx = rings.map((ring, i) => ring.map((p) => put(P, p, o.w(p, i))));
  const mid = (r) => mul(r.reduce((s, i) => add(s, P.V[i]), [0, 0, 0]), 1 / r.length);
  for (let i = 0; i + 1 < idx.length; i++) {
    const a = idx[i], b = idx[i + 1], c = lerp(mid(a), mid(b), 0.5);
    const m = typeof o.mat === 'function' ? o.mat(i) : o.mat;
    for (let j = 0; j < n; j++) {
      const j1 = (j + 1) % n, v = [a[j], a[j1], b[j1], b[j]], fm = mul(v.reduce((s, x) => add(s, P.V[x]), [0, 0, 0]), 0.25);
      quad(P, ...v, m, sub(fm, c));
    }
  }
  if (o.caps !== false) for (const [k, other] of [[0, 1], [idx.length - 1, idx.length - 2]]) {
    const r = idx[k], c = put(P, mid(r), P.W[r[0]]), m = typeof o.mat === 'function' ? o.mat(k === 0 ? 0 : idx.length - 2) : o.mat;
    for (let j = 0; j < n; j++) tri(P, r[j], r[(j + 1) % n], c, o.capMat ?? m, sub(mid(r), mid(idx[other])));
  }
  return P;
}
/** A ring of `k` points round centre `c` in the plane of `x`, `y`, radii `rx`, `ry`. */
export const ringAt = (c, x, y, rx, ry, k, turn = 0) => [...Array(k).keys()].map((j) => { const a = turn + (j / k) * TAU; return add(c, add(mul(x, Math.cos(a) * rx), mul(y, Math.sin(a) * ry))); });
/** A torus (a ring, a chain's link) round centre `c`, its axis `ax`: radius `R`, its wire `r`. */
export function torus(c, ax, R, r, o) {
  const a = unit(ax), x = unit(cross(Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], a)), y = cross(a, x), ku = o.ku ?? 10, kv = o.kv ?? 5;
  const Rx = R * (o.stretch ?? 1);
  const path = [...Array(ku).keys()].map((j) => { const t = (j / ku) * TAU, d = add(mul(x, Math.cos(t) * Rx), mul(y, Math.sin(t) * R)); return { p: add(c, d), n: a }; });
  return sweep(path, { ...o, closed: true, round: true, profile: roundProfile(r, kv) });
}

/* ==== the iron set's pieces ======================================================================================== */
const Y = (p) => p[1];
const frac = (x) => x - Math.floor(x);

/* ---- the helm: a pointed spangenhelm of four plates on riveted bands, a brow band, a spectacle guard and nasal, glowing
   brows, a mail aventail round the sides and the back --------------------------------------------------------------- */
/** The helm's measures: its centre, the rim's height, the skull's half widths at the rim, its apex. */
export function helmMarks(B) {
  const A = B.at, c = headCentre(B), H = skinSamples(B).filter((s) => shareW(B, s.w, 'head') > 0.5);
  const yR = A.head[1] + 0.79 * (A.top - A.head[1]) / 1.6 + (B.who === 'female' ? 0.02 : 0);
  // (the skull's ellipse at the rim: wide enough for every point of the head above the rim, with clearance)
  const zc = c[2] - 0.04;
  let ax = 0, az = 0;
  for (const s of H) if (Y(s.p) > yR - 0.12) { ax = Math.max(ax, Math.abs(s.p[0])); az = Math.max(az, Math.abs(s.p[2] - zc)); }
  return { c, yR, zc, ax: ax + 0.12, az: az + 0.1, top: A.top };
}
/** The skull's profile: its scale at h (nought at the rim, one at the apex), a rounded cone drawn to a point. */
const skullS = (h) => { const k = clamp(h); return Math.pow(1 - k * k, 0.74) * (1 + 0.04 * Math.sin(PI * k)); };
export function ironHelmOf(B, o = {}) {
  const M = helmMarks(B), wH = () => boneW(B, 'head');
  // the skull's height: as tall over the top of the head as it must be, and a point over it
  const H = (M.top - M.yR) * 1.0 + 0.4;
  // (the skull grown until every head point above the rim is inside it with clearance)
  const HS = skinSamples(B).filter((s) => shareW(B, s.w, 'head') > 0.5 && Y(s.p) > M.yR);
  let k = 1;
  for (const s of HS) {
    const h = (Y(s.p) - M.yR) / H, sc = skullS(h);
    const e = Math.hypot(s.p[0] / M.ax, (s.p[2] - M.zc) / M.az);
    if (sc > 0.05) k = Math.max(k, (e + 0.09 / M.ax) / sc);
  }
  const ax = M.ax * k, az = M.az * k;
  const skullAt = (h, ph, off = 0) => { const s = skullS(h); return [(ax + off) * s * Math.sin(ph), M.yR + h * H, M.zc + (az + off) * s * Math.cos(ph)]; };
  const NU = 8, NV = 24;
  const skull = grid((u, v) => skullAt(u * 0.985, v * TAU), NU, NV, { closed: true, out: (u, v, p) => sub(p, [0, M.yR + 0.3 * H, M.zc]) });
  const parts = [];
  // the four plates, lapped under the bands; their insides dark
  parts.push(slab(skull, { w: wH, thick: 0.05, mat: 'fe', inner: null, edge: 'feD' }));
  // the apex's cap and finial: a little gilt knob
  const apex = skullAt(1, 0);
  parts.push(loftRings([
    ringAt(add(apex, [0, -0.1, 0]), [1, 0, 0], [0, 0, 1], 0.12, 0.12, 8),
    ringAt(add(apex, [0, 0.0, 0]), [1, 0, 0], [0, 0, 1], 0.14, 0.14, 8),
    ringAt(add(apex, [0, 0.08, 0]), [1, 0, 0], [0, 0, 1], 0.07, 0.07, 8),
    ringAt(add(apex, [0, 0.2, 0]), [1, 0, 0], [0, 0, 1], 0.03, 0.03, 8),
  ], { w: wH, mat: 'gilt' }));
  // the bands: front, back and over the ears, each riveted
  const bandAt = (ph) => [...Array(NU + 1).keys()].map((i) => { const h = Math.min(0.97, (i / NU) * 0.98); const q = gridAt(skull, h * NU / 0.985, (ph / TAU) * NV); return q; });
  for (const ph of [PI / 2, -PI / 2]) {
    const path = bandAt(((ph % TAU) + TAU) % TAU).slice(1);
    parts.push(strap(path, { wide: 0.2, high: 0.045, mat: 'feM', w: wH, faceMat: (kk, j) => (j === 2 || j === 4 ? 'feL' : 'feM') }));
    parts.push(...studs(path.map((q) => ({ p: add(q.p, mul(q.n, 0.04)), n: q.n })), 3, { from: 0.12, to: 0.7, r: 0.045, h: 0.04, mat: 'feL', k: 4, w: wH }));
  }
  // the crest: a raised comb from the brow over the top to the nape, a gilt line inlaid along its spine
  {
    const fr = bandAt(0).slice(1), bk = bandAt(PI).slice(1).reverse();
    const path = [...fr, ...bk.slice(1)];
    const n = path.length, hi = (kk) => 0.07 + 0.05 * Math.sin((PI * kk) / (n - 1));
    parts.push(sweep(path, { round: true, mat: 'feM', w: wH, faceMat: (kk, j) => (j === 2 || j === 4 ? 'feL' : 'feM'), profile: (kk) => { const h = hi(kk); return [[-0.1, -0.02], [0.1, -0.02], [0.08, h - 0.02], [0.03, h + 0.01], [-0.03, h + 0.01], [-0.08, h - 0.02]]; } }));
    parts.push(sweep(path.map((q, kk) => ({ p: add(q.p, mul(q.n, hi(kk) + 0.01)), n: q.n })), { round: true, mat: 'runeG', w: wH, profile: [[-0.026, -0.012], [0.026, -0.012], [0.014, 0.014], [-0.014, 0.014]] }));
    parts.push(...studs(fr.map((q) => ({ p: add(q.p, mul(q.n, 0.0)), n: q.n })), 2, { from: 0.15, to: 0.45, r: 0.05, h: 0.045, mat: 'feL', k: 4, w: wH }).map((P) => P));
  }
  // the brow band round the rim, riveted between the bands
  const rim = (lift, hh) => [...Array(NV + 1).keys()].map((j) => { const q = gridAt(skull, hh * NU / 0.985, j); return { p: add(q.p, mul(q.n, lift)), n: q.n }; });
  const hb = 0.2 / H;
  parts.push(strap(rim(0, hb / 2).slice(0, NV), { wide: 0.26, high: 0.05, mat: 'feM', closed: true, w: wH, faceMat: (kk, j) => (j === 2 || j === 4 ? 'feL' : 'feM') }));
  for (const [f0, f1] of [[1 / 32, 7 / 32], [25 / 32, 31 / 32]]) parts.push(...studs(rim(0.05, hb / 2).slice(0), 4, { from: f0, to: f1, r: 0.04, h: 0.035, mat: 'feL', k: 4, w: wH }));
  // -- the face: the spectacle guard over the eyes and the nasal down the nose, in front of the face
  const FR = reach(B, { t: [0.2, M.yR + 0.1], nt: 14, na: 48, smooth: 2, frame: (t) => frame([0, t, M.zc], [0, 1, 0], [0, 0, 1]), tOf: (p) => Y(p), pick: (s) => shareW(B, s.w, 'head', 'neck') > 0.5 });
  const faceAt = (yy, ph, off) => onReach(FR, yy, ph, off);
  const faceN = (yy, ph) => unit(sub(faceAt(yy, ph, 0.1), faceAt(yy, ph, 0)));
  const eyes = B.A.polys.filter((p) => p[1] === 2).flatMap((p) => p[0]).filter((i) => B.V[i][0] > 0).map((i) => B.V[i]);
  const eye = mul(eyes.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / eyes.length);
  const ePh = Math.atan2(eye[0], eye[2] - M.zc), eY = Y(eye);
  const rimY = M.yR, ringTop = rimY + 0.02;
  // (each ring an oval round the eye on the face's surface, its top run into the brow band)
  const ringR = { ph: 0.36, y: (ringTop - eY) };
  for (const sg of [1, -1]) {
    // (each eye guarded by a round arch from the nasal over the eye and down its outer side, gilt along its inner edge;
    // under the eye left open, so the face reads from the front)
    const arch = (inset, lift) => [...Array(11).keys()].map((kk) => {
      const t = 2.62 - (2.97 * kk) / 10, ph = sg * (ePh + ringR.ph * 1.08 * Math.cos(t)), yy = eY + ringR.y * 1.02 * Math.sin(t);
      const ph2 = sg * (ePh + (ringR.ph * 1.08 - inset) * Math.cos(t)), yy2 = eY + (ringR.y * 1.02 - inset) * Math.sin(t);
      const q = inset ? faceAt(yy2, ph2, 0.16 + lift) : faceAt(yy, ph, 0.16 + lift);
      return { p: q, n: faceN(inset ? yy2 : yy, inset ? ph2 : ph) };
    });
    parts.push(sweep(arch(0, 0), { round: true, mat: 'fe', w: wH, faceMat: (kk, j) => (j === 2 ? 'feL' : 'fe'), profile: (kk) => { const wd = 0.1 * (1 - 0.45 * (kk / 10) ** 2); return [[-wd, -0.02], [wd, -0.02], [wd * 0.75, 0.05], [-wd * 0.75, 0.05]]; } }));
    parts.push(tube(arch(0.075, 0.045), { r: 0.018, k: 3, mat: 'gilt', w: wH }));
    // the brows: gilt arches along the band's foot over each eye, lit when it is enchanted
    const brow = [...Array(13).keys()].map((kk) => {
      const f = kk / 12, ph = sg * (0.07 + (ePh + 0.36 - 0.07) * f), yy = rimY + 0.07 + 0.06 * Math.sin(PI * Math.pow(f, 0.8));
      const q = gridAt(skull, ((yy - M.yR) / H) * NU / 0.985, ((((ph % TAU) + TAU) % TAU) / TAU) * NV);
      return { p: add(q.p, mul(q.n, 0.05)), n: q.n };
    });
    // (a gilt boar's-head knob at each brow's outer end)
    parts.push(stud(add(brow[12].p, mul(brow[12].n, 0.02)), brow[12].n, { r: 0.055, h: 0.06, k: 5, mat: 'gilt', w: wH }));
    parts.push(sweep(brow, { round: true, mat: 'runeG', w: wH, profile: (kk) => { const t = Math.sin(PI * Math.min(1, (kk / 12) * 1.15)); const wd = 0.03 + 0.035 * t; return [[-wd, 0], [wd, 0], [wd * 0.6, 0.03 + 0.01 * t], [-wd * 0.6, 0.03 + 0.01 * t]]; } }));
  }
  // the nasal: down from the band to the nose's tip, flared at its foot, a gilt line down it
  const noseY = B.V.reduce((b, p, i) => (onPart(B, i, 'head') > 0.5 && p[2] > b[2] ? p : b), [0, 0, -9]);
  const nasal = [...Array(9).keys()].map((kk) => { const yy = rimY + 0.05 - (rimY + 0.05 - (Y(noseY) - 0.06)) * (kk / 8); return { p: faceAt(yy, 0, 0.14 + 0.02 * (kk / 8)), n: faceN(yy, 0) }; });
  parts.push(sweep(nasal, { mat: 'fe', round: true, w: wH, faceMat: (kk, j) => (j === 3 || j === 4 ? 'feL' : null), profile: (kk) => { const f = kk / 8, wd = 0.065 + 0.04 * Math.pow(f, 3); return [[-wd, -0.03], [wd, -0.03], [wd, 0.03], [wd * 0.4, 0.06], [-wd * 0.4, 0.06], [-wd, 0.03]]; } }));
  parts.push(sweep(nasal.slice(0, 8).map((q) => ({ p: add(q.p, mul(q.n, 0.07)), n: q.n })), { mat: 'runeG', round: true, w: wH, profile: [[-0.022, -0.01], [0.022, -0.01], [0.012, 0.012], [-0.012, 0.012]] }));
  // -- the cheek guards and the neck guard: a plate down each side of the face, and iron splints hung side by side from
  // the rim round the back over a mail curtain, each riveted at its head
  const AR = reach(B, { t: [-0.6, M.yR], nt: 20, na: 48, smooth: 3, frame: (t) => frame([0, t, M.zc], [0, 1, 0], [0, 0, 1]), tOf: (p) => Y(p), pick: (s) => shareW(B, s.w, 'head', 'neck') > 0.5 || (shareW(B, s.w, 'torso') > 0.3 && Y(s.p) > B.at.neck[1] - 0.2) });
  const rimR = (ph) => { const r0 = skullAt(0, ph, 0); return Math.hypot(r0[0], r0[2] - M.zc); };
  // (a point round the head at height yy, angle ph: as far out as the rim there, or the head and neck and `clear`, and `flare`)
  const hang = (yy, ph, clear, flare) => { const r = Math.max(rimR(ph) - 0.01, AR.r(yy, ph) + clear) + flare; return [Math.sin(ph) * r, yy, M.zc + Math.cos(ph) * r]; };
  const top0 = M.yR + 0.05, nape = o.nape ?? (B.at.neck[1] + 0.56), jaw = eY - 0.62;
  for (const sg of [1, -1]) {
    const phB = 2.0, frontAt = (u) => 1.04 + 0.34 * Math.pow(u, 2.2), botAt = (v) => lerp([0, jaw, 0], [0, eY - 0.3, 0], Math.pow(v, 1.4))[1];
    const G = grid((u, v) => { const ph = lerp([frontAt(u), 0, 0], [phB, 0, 0], v)[0], yy = lerp([top0, 0, 0], [botAt(v), 0, 0], u)[0]; return hang(yy, sg * ph, 0.12, 0.05 + 0.07 * u * Math.sin(PI * v)); }, 6, 8, { out: (u, v, p) => sub(p, [0, Y(p), M.zc]) });
    parts.push(slab(G, { w: wH, thick: 0.045, mat: 'feM', inner: 'feD', edge: 'feD' }));
    // (its rim rolled bright all round)
    const rimP = [...rowPath(G, 0, 0, 8, 8), ...colPath(G, 8, 0, 6, 6).slice(1), ...rowPath(G, 6, 8, 0, 8).slice(1), ...colPath(G, 0, 6, 0, 6).slice(1, -1)];
    parts.push(tube(rimP.filter((_, kk) => kk % 2 === 0), { r: 0.035, k: 4, mat: 'feL', closed: true, w: wH }));
    // (rivets along its front edge and its foot)
    parts.push(...studs(colPath(G, 0.6, 0.6, 5.6, 10, 0.03), 3, { r: 0.04, h: 0.035, mat: 'feL', k: 4, w: wH }));
    parts.push(...studs(rowPath(G, 5.4, 1.5, 7.4, 10, 0.03), 3, { r: 0.04, h: 0.035, mat: 'feL', k: 4, w: wH }));
  }
  const nS = o.splints ?? 9, ph0 = 1.86, ph1 = TAU - 1.86, span = (ph1 - ph0) / nS;
  const footAt = (ph) => { const b = Math.abs(wrapA(ph)); return lerp([0, eY - 0.5, 0], [0, nape, 0], Math.pow(smooth(1.86, PI, b), 0.6))[1]; };
  // (the curtain behind the splints, mail, so their gaps show dark)
  const cur = grid((u, v) => { const ph = ph0 - 0.05 + v * (ph1 - ph0 + 0.1), yy = lerp([top0, 0, 0], [footAt(ph) + 0.06, 0, 0], u)[0]; return hang(yy, ph, 0.08, 0.2 * Math.pow(u, 1.4) - 0.03); }, 3, 14, { out: (u, v, p) => sub(p, [0, Y(p), M.zc]) });
  // (the neck guard's foot bends a little with the neck, so it rides over the collar as the head goes back)
  const wN = (p) => { const f = clamp((top0 - Y(p)) / (top0 - nape)) ** 1.5; return mixOf(B, [['head', 1 - 0.45 * f], ['neck_01', 0.45 * f]]); };
  parts.push(slab(cur, { w: wN, thick: 0.03, mat: 'mailD', inner: null, edge: 'mailD' }));
  for (let k = 0; k < nS; k++) {
    const a0 = ph0 + span * (k + 0.07), a1 = ph0 + span * (k + 0.93);
    const G = grid((u, v) => {
      const ph = lerp([a0, 0, 0], [a1, 0, 0], v)[0], ft = footAt((a0 + a1) / 2), round = 0.05 * (1 - Math.sin(PI * v));
      const yy = lerp([top0, 0, 0], [ft + round, 0, 0], u)[0];
      return hang(yy, ph, 0.12, 0.2 * Math.pow(u, 1.4) + 0.03 * Math.sin(PI * v));
    }, 4, 2, { out: (u, v, p) => sub(p, [0, Y(p), M.zc]) });
    parts.push(slab(G, { w: wN, thick: 0.04, mat: 'fe', inner: 'feD', edge: (i, j, m, e) => (i === 3 && e === 2 ? 'feL' : 'feD') }));
    const head = gridAt(G, 0.5, 1);
    parts.push(stud(add(head.p, mul(head.n, 0.02)), head.n, { r: 0.04, h: 0.035, mat: 'feL', k: 4, w: wH }));
  }
  // (a leather keeper across the splints, riveted to each)
  const keepAt = (ph) => { const f = 0.5, yy = lerp([top0, 0, 0], [footAt(ph), 0, 0], f)[0]; return hang(yy, ph, 0.12, 0.2 * Math.pow(f, 1.4) + 0.035); };
  const keeper = [...Array(15).keys()].map((kk) => { const ph = ph0 + 0.02 + ((ph1 - ph0 - 0.04) * kk) / 14, p = keepAt(ph); return { p, n: unit(sub(p, [0, Y(p), M.zc])) }; });
  parts.push(strap(keeper, { wide: 0.12, high: 0.03, mat: 'leather', w: wN }));
  parts.push(...studs(keeper.map((q) => ({ p: add(q.p, mul(q.n, 0.03)), n: q.n })), nS, { from: 0.5 / nS, to: 1 - 0.5 / nS, r: 0.03, h: 0.025, mat: 'feL', w: wN }));
  return { P: parts, M };
}

/* ---- chest & arms: a quilted gambeson under a lamellar coat, laced in rows, a broad studded belt, a lamellar skirt in
   four panels, lamellar shoulder guards, splinted vambraces over the sleeves --------------------------------------- */
const TORSO_BONES = new Set(['root', 'pelvis', 'spine_01', 'spine_02', 'spine_03']);
/** The torso's heights the coat is cut to, and its middle line's depth. */
export function torsoMarks(B) {
  const A = B.at, sh = A.shoulder.l[1];
  const S = skinSamples(B).filter((s) => shareW(B, s.w, 'torso') > 0.8 && shareW(B, s.w, 'neck', 'head') < 0.25);
  const ys = S.map((s) => Y(s.p)), lo = Math.min(...ys), hi = Math.max(...ys), n = 40;
  const Z = [...Array(n + 1).keys()].map((k) => { const yy = lo + ((hi - lo) * k) / n, near = S.filter((s) => Math.abs(Y(s.p) - yy) < (hi - lo) / n && Math.abs(s.p[0]) < 0.35); return near.length ? (Math.min(...near.map((s) => s.p[2])) + Math.max(...near.map((s) => s.p[2]))) / 2 : null; });
  for (let k = 0; k <= n; k++) if (Z[k] === null) Z[k] = Z.slice(0, k).reverse().find((z) => z !== null) ?? Z.find((z) => z !== null) ?? 0;
  for (let pass = 0; pass < 4; pass++) for (let k = 1; k < n; k++) Z[k] = (Z[k - 1] + 2 * Z[k] + Z[k + 1]) / 4;
  const zc = (yy) => { const f = clamp(((yy - lo) / (hi - lo)) * n, 0, n), k = Math.min(n - 1, Math.floor(f)); return Z[k] + (Z[k + 1] - Z[k]) * (f - k); };
  return { zc, pit: sh - 0.9, waist: waistOf(A), hip: A.hip.l[1], topF: A.chest[1] + (B.who === 'female' ? 0.42 : 0.5), neck: A.neck[1] };
}
/** The torso (and the hips) measured round its middle line: r(y, a), a from the front toward the body's left. */
export function torsoReach(B, M, y0, y1, pick) {
  return reach(B, { t: [y0, y1], nt: 40, na: 64, smooth: 4, frame: (t) => frame([0, t, M.zc(t)], [0, 1, 0], [0, 0, 1]), tOf: (p) => Y(p), pick });
}
/**
 * A row of lamellae round an axis: `lam` lamellae from angle `a0`, each `da` wide, between heights `y0` (its foot, each
 * lamella's corners rounded up by `round`) and `y1` (its head, tucked `tuck` up under the row above). `at(yy, a, off)`
 * the point there that far out, `out(p)` the way out there; `off` a lamella's stand off, more at its foot (`lap`) and
 * across it (`shingle`: each lapped over the next, away from angle `mid`). Laced across at `lace` of its height.
 */
export function lamRow(o) {
  const parts = [], nu = 1, nv = 3, mid = o.mid ?? 0;
  const lace = [];
  for (let l = 0; l < o.lam; l++) {
    const a0 = o.a0 + l * o.da, a1 = a0 + o.da * 1.06, away = wrapA((a0 + a1) / 2 - mid) >= 0;
    const G = grid((u, v) => {
      const a = lerp([a0, 0, 0], [a1, 0, 0], v)[0], sc = 1 - Math.sqrt(Math.max(0, 1 - (2 * v - 1) ** 2));
      const yy = u === 0 ? o.y0 + o.round * sc : lerp([o.y0, 0, 0], [o.y1 + o.tuck, 0, 0], u)[0];
      const sh = away ? v : 1 - v;
      return o.at(yy, a, o.off + o.lap * (1 - u) + o.shingle * sh + o.bulge * Math.sin(PI * v), u);
    }, nu, nv, { out: (u, v, p) => o.out(p) });
    // (its foot's edge bright, its sides dark, its head under the row above left open)
    // (a lamella is a plate: all of it on its middle's weights)
    const wL = o.w(gridAt(G, nu / 2, nv / 2).p), wl = () => wL;
    parts.push(slab(G, { w: wl, thick: o.thick ?? 0.065, mat: o.mat ?? 'fe', inner: null, edge: (i, j, m, k) => (k === 0 && i === 0 ? o.foot ?? 'feL' : k === 2 && i === nu - 1 ? null : 'feD') }));
    if (o.lace) { const fi = nu * ((o.lace * (o.y1 - o.y0)) / (o.y1 + o.tuck - o.y0)); for (const j of [0.45, nv - 0.45]) { const q = gridAt(G, fi, j); lace.push({ p: add(q.p, mul(q.n, 0.012)), n: q.n }); } }
  }
  // (the lace: a flat thong across the row, in and out of the lamellae)
  if (o.lace) parts.push(sweep(lace, { profile: [[-(o.laceR ?? 0.042), 0.016], [o.laceR ?? 0.042, 0.016]], mat: 'lace', w: (p) => o.w(p), closed: !!o.closed, caps: false }));
  return { parts };
}
/** The neckline round the neck's foot: as low as the body there is no wider than the neck and a little; lower at the front and the back. */
export function necklineOf(B, M) {
  const zN = B.at.neck[2] + 0.05;
  const NR = reach(B, { t: [M.neck - 1.3, M.neck + 0.1], nt: 52, na: 40, smooth: 2, frame: (t) => frame([0, t, zN], [0, 1, 0], [0, 0, 1]), tOf: (p) => Y(p), pick: (s2) => shareW(B, s2.w, 'neck', 'torso', 'shoulder') > 0.8 && shareW(B, s2.w, 'head', 'upperarm') < 0.08 && shareW(B, s2.w, 'shoulder') < 0.5 });
  const NL = [...Array(40).keys()].map((k) => { const a = (k / 40) * TAU, r0 = NR.r(M.neck, a); let yy = M.neck; while (yy > M.neck - 0.5 && NR.r(yy - 0.02, a) < r0 + 0.22) yy -= 0.02; return yy; });
  for (let pass = 0; pass < 3; pass++) for (let k = 0; k < 40; k++) NL[k] = (NL[(k + 39) % 40] + 2 * NL[k] + NL[(k + 1) % 40]) / 4;
  const yC = (a) => { const f = (((a / TAU) * 40) % 40 + 40) % 40, k = Math.floor(f) % 40; return lerp([NL[k], 0, 0], [NL[(k + 1) % 40], 0, 0], f - Math.floor(f))[0] - 0.12 * Math.max(0, Math.cos(a)) ** 2 - 0.14 * Math.max(0, -Math.cos(a)) ** 2; };
  return { zN, NR, yC };
}
export function ironChestOf(B, o = {}) {
  const A = B.at, M = torsoMarks(B), parts = [];
  // -- the gambeson: the torso, the shoulders and the arms to the wrists, the neck's foot, close over the skin
  // (cut round the neck at the collar's roll: `yC` below, found before the collar is laid)
  const zN0 = A.neck[2] + 0.05;
  const NK = necklineOf(B, M), neckCut = (a) => NK.yC(a) + 0.06;
  const headOnly = (i) => B.W[i].reduce((t, [b, x]) => t + (B.bones[b].name === 'head' || B.bones[b].name === 'jaw' ? x : 0), 0);
  parts.push(bodyShell(B, {
    sub: 1, rim: 'gamD', thick: 0.03,
    keep: (i) => { const p = B.V[i]; return onPart(B, i, 'torso', 'shoulder', 'upperarm', 'forearm', 'neck', 'head', 'thigh') > 0.6 && headOnly(i) < 0.05 && onPart(B, i, 'hand') < 0.35 && (Y(p) > M.waist - 0.3 || onPart(B, i, 'upperarm', 'forearm') > 0.5) && onPart(B, i, 'thigh') < 0.5 && Y(p) < A.neck[1] + 0.15; },
    off: ({ p }) => 0.05 + 0.06 * smooth(M.neck - 0.6, M.neck - 0.2, Y(p)),
    mat: (c) => (Y(c.p) > neckCut(Math.atan2(c.p[0], c.p[2] - zN0)) ? null : 'gam'),
  }));
  // -- the coat of lamellae: rows from the waist up, round the body below the armpits, front and back above them
  const pick = (s) => shareW(B, s.w, 'torso') > 0.75 && shareW(B, s.w, 'upperarm', 'shoulder') < 0.12 && shareW(B, s.w, 'neck', 'head') < 0.2;
  const TR = torsoReach(B, M, M.hip - 1.4, M.neck, pick);
  const W = nearW(B, (s) => shareW(B, s.w, 'torso') > 0.7, (n) => TORSO_BONES.has(n), 0.35);
  const at = (yy, a, off) => onReach(TR, yy, a, off);
  const out = (p) => sub(p, [0, Y(p), M.zc(Y(p))]);
  const nRows = Math.max(4, Math.round((M.topF - M.waist) / 0.44)), rh = (M.topF - M.waist) / nRows;
  const nLam = o.lam ?? 18, da = TAU / nLam;
  for (let k = 0; k < nRows; k++) {
    const y0 = M.waist + k * rh, y1 = y0 + rh, top = k === nRows - 1;
    const common = { da, y0, y1, tuck: top ? 0 : 0.12, round: 0.1, off: 0.15 + 0.012 * k, lap: 0.08, shingle: 0.035, bulge: 0.015, at, out, w: W, lace: 0.62, foot: 'feL' };
    if (y1 <= M.pit - 0.2) parts.push(...lamRow({ ...common, a0: -PI + da / 2, lam: nLam, closed: true }).parts);
    else {
      // (above the armpits: a front and a back, the arms free between)
      const nF = Math.round((2 * 1.05) / da), nB = Math.round((2 * 0.92) / da);
      parts.push(...lamRow({ ...common, a0: -(nF * da) / 2, lam: nF }).parts);
      parts.push(...lamRow({ ...common, a0: PI - (nB * da) / 2, lam: nB, mid: PI }).parts);
    }
  }
  // -- the mirror: a round iron plate on the chest over the lamellae, a gilt boss in a ring that is lit when enchanted
  {
    const yM = M.topF - (B.who === 'female' ? 0.98 : 0.62), rM = Math.max(...[-0.5, -0.25, 0, 0.25, 0.5].map((a2) => TR.r(yM, a2) * Math.cos(a2))) - TR.r(yM, 0), c0 = at(yM, 0, 0.27 + Math.max(0, rM)), n = unit(out(c0)), ex = [1, 0, 0], ey = unit(cross(n, ex));
    const R = o.mirror ?? (B.who === 'female' ? 0.36 : 0.46);
    const rings = [[1, 0, 'feL'], [1, 0.035, 'feL'], [0.9, 0.06, 'fe'], [0.62, 0.075, 'fe'], [0.58, 0.075, 'fe']];
    parts.push(loftRings(rings.map(([k, h]) => ringAt(add(c0, mul(n, h)), ex, ey, R * k, R * k, 20)), { w: W, mat: (i) => (i === 0 ? 'feL' : i === 1 ? 'feM' : 'fe') }));
    parts.push(tube([...Array(20).keys()].map((k) => { const a = (k / 20) * TAU; return { p: add(add(c0, mul(n, 0.085)), add(mul(ex, Math.cos(a) * R * 0.5), mul(ey, Math.sin(a) * R * 0.5))), n }; }), { r: 0.03, k: 4, closed: true, mat: 'rune', w: W }));
    parts.push(stud(add(c0, mul(n, 0.07)), n, { r: R * 0.32, h: 0.1, k: 8, mat: 'gilt', w: W }));
    // (riveted round its rim)
    for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU + PI / 6, p = add(add(c0, mul(n, 0.05)), add(mul(ex, Math.cos(a) * R * 0.78), mul(ey, Math.sin(a) * R * 0.78))); parts.push(stud(p, n, { r: 0.04, h: 0.03, k: 4, mat: 'feL', w: W })); }
  }
  // -- the collar: a quilted roll standing round the neck's foot, lower at the front
  const { zN, NR, yC } = necklineOf(B, M);
  const wY = nearW(B, (s2) => shareW(B, s2.w, 'torso', 'neck') > 0.7, (n) => !/upperarm|lowerarm|hand|elbow|wrist|twist/.test(n), 0.3);
  const wY2 = nearW(B, (s2) => shareW(B, s2.w, 'torso') > 0.7, (n) => TORSO_BONES.has(n) || n.startsWith('clavicle'), 0.3);
  // -- the gambeson's yoke over the chest and the back above the coat: smooth, quilted in upright channels
  {
    const pickY = (s2) => shareW(B, s2.w, 'torso', 'neck', 'shoulder') > 0.8 && shareW(B, s2.w, 'upperarm', 'head') < 0.1 && shareW(B, s2.w, 'shoulder') < 0.4;
    const YR = reach(B, { t: [M.topF - 0.5, M.neck], nt: 24, na: 64, smooth: 4, frame: (t) => frame([0, t, M.zc(Math.min(t, M.neck - 0.6))], [0, 1, 0], [0, 0, 1]), tOf: (p) => Y(p), pick: pickY });
    for (const back of [false, true]) {
      const mid = back ? PI : 0, yTop = (a) => yC(a) + 0.02 - (back ? 0.12 : 0), y0 = M.topF - 0.3;
      const half = (u) => lerp([back ? 0.9 : 1.02, 0, 0], [0.74, 0, 0], u)[0];
      const G = grid((u, v) => { const a = mid + (2 * v - 1) * half(u), yy = lerp([y0, 0, 0], [yTop(a), 0, 0], u)[0]; return onReach(YR, yy, a, 0.12 + 0.1 * u * u + 0.02 * Math.sin(PI * v)); }, 6, 24, { out: (u, v, p) => sub(p, [0, Y(p), M.zc(Math.min(Y(p), M.neck - 0.6))]) });
      parts.push(slab(G, { w: wY, thick: 0.05, mat: 'gam', inner: null, edge: 'gamD' }));
      // (the quilting: upright channels, sewn)
      for (let k = 1; k < 6; k++) parts.push(tube(colPath(G, k * 4, 0.3, 6, 4, 0.004), { r: 0.024, k: 3, mat: 'gamD', w: wY }));
      for (const j of [0, 24]) parts.push(tube(colPath(G, j, 0, 6, 5, 0.0), { r: 0.04, k: 3, mat: 'gamD', w: wY }));
    }
  }
  {
    const wC = nearW(B, (s2) => shareW(B, s2.w, 'neck', 'torso') > 0.7 && Y(s2.p) > M.neck - 1.0, (n) => n === 'neck_01' || n === 'spine_03' || n === 'spine_02' || n.startsWith('clavicle'), 0.3);
    // (two quilted rolls, one on the other, round the neckline: on the skin as it slopes there)
    const pickN = (s2) => shareW(B, s2.w, 'neck', 'torso', 'shoulder') > 0.8 && shareW(B, s2.w, 'head', 'upperarm') < 0.08;
    for (const [dy, r, off] of [[0, 0.1, 0.21], [0.12, 0.06, 0.2]]) {
      const ring = [...Array(24).keys()].map((k) => { const a = (k / 24) * TAU, yy = yC(a) + dy, b0 = onReach(NR, yy, a, 0), q = onSkin(B, pickN, b0, 0.4); return { p: add(b0, mul(q.n, off + 0.04 * Math.max(0, Math.cos(a)) + 0.09 * Math.max(0, -Math.cos(a)) ** 0.7)), n: [0, 1, 0] }; });
      parts.push(sweep(ring, { closed: true, round: true, mat: dy ? 'gam' : 'gamD', w: wC, profile: roundProfile(r, 6, 0, 1.25).map(([x2, y2]) => [x2 * 1.25, y2]) }));
    }
  }
  // -- the coat's shoulder straps: leather over each shoulder from the front's head to the back's, riveted at each end
  for (const sg of [1, -1]) {
    const xs = sg * A.shoulder.l[0] * 0.56, yc = M.topF + 0.15, zc0 = M.zc(M.topF);
    const SRc = reach(B, { t: [xs - 0.25, xs + 0.25], nt: 2, na: 48, smooth: 2, frame: (t) => frame([t, yc, zc0], [1, 0, 0], [0, 0, 1]), tOf: (p) => p[0], pick: (s2) => shareW(B, s2.w, 'torso', 'neck') > 0.7 && shareW(B, s2.w, 'upperarm', 'shoulder', 'head') < 0.1 && Y(s2.p) > yc - 1.2 });
    const ang = (p) => Math.atan2(-(Y(p) - yc), p[2] - zc0);
    const fP = onReach(TR, M.topF - 0.05, sg * 0.62, 0.2), bP = onReach(TR, M.topF - 0.05, sg > 0 ? PI - 0.62 : -PI + 0.62, 0.2);
    const aF = ang(fP), aB0 = ang(bP), aB = aB0 > 0 ? aB0 - TAU : aB0;
    const path = [...Array(15).keys()].map((k) => { const a = lerp([aF, 0, 0], [aB, 0, 0], k / 14)[0], F = SRc.frame(xs); const p = add(F.o, mul(dirOf(F, a), SRc.r(xs, a) + 0.19)); return { p, n: dirOf(F, a) }; });
    parts.push(strap(path, { wide: 0.2, high: 0.05, mat: 'leather', w: wY2, faceMat: (k, j) => (j === 2 || j === 4 ? 'leatherD' : 'leather') }));
    for (const f2 of [0.04, 0.96]) { const q = pathAt(path, f2); parts.push(stud(add(q.p, mul(q.n, 0.05)), q.n, { r: 0.055, h: 0.045, k: 6, mat: 'feL', w: wY2 })); }
  }
  // -- the belt: broad leather at the waist, iron studs round it, a square iron buckle and its end hanging down
  const yB = M.waist + 0.04, offB = 0.26;
  const beltAt = (a, lift = 0) => onReach(TR, yB, a, offB + lift);
  const beltPath = [...Array(32).keys()].map((k) => { const a = (k / 32) * TAU - PI, p = beltAt(a); return { p, n: unit(out(p)) }; });
  parts.push(strap(beltPath, { wide: 0.36, high: 0.06, closed: true, mat: 'leather', w: W, faceMat: (k, j) => (j === 2 || j === 4 ? 'leatherD' : 'leather') }));
  parts.push(...studs(beltPath.map((q) => ({ p: add(q.p, mul(q.n, 0.06)), n: q.n })), 13, { from: 1.5 / 14, to: 1 - 1.5 / 14, r: 0.075, h: 0.05, k: 4, turn: PI / 4, mat: 'feL', capMat: 'fe', w: W }));
  {
    const c = beltAt(0, 0.1), n = unit(out(c)), x = [1, 0, 0], yv = cross(n, x);
    const frameR = (w, h) => [[-w, -h], [w, -h], [w, h], [-w, h]].map(([a, b]) => ({ p: add(add(c, mul(x, a)), mul(yv, b)), n }));
    const ring = [];
    const R = frameR(0.2, 0.24);
    for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) { const p = lerp(R[k].p, R[(k + 1) % 4].p, j / 3); ring.push({ p, n }); }
    parts.push(sweep(ring, { closed: true, round: true, mat: 'feM', w: W, faceMat: (k, j) => (j === 1 ? 'feL' : null), profile: [[-0.045, -0.03], [0.045, -0.03], [0.045, 0.04], [-0.045, 0.04]] }));
    parts.push(stud(add(c, mul(n, 0.02)), n, { r: 0.07, h: 0.07, k: 6, mat: 'gilt', w: W }));
    // (the belt's end through the buckle and hanging down, a gilt strap end at its tip)
    const hang = [0, 1, 2, 3, 4, 5].map((k) => { const yy = yB - 0.05 - k * 0.12, p = onReach(TR, yy, -0.16, offB + 0.12 + 0.03 * k); return { p, n: unit(out(p)) }; });
    parts.push(strap(hang, { wide: 0.17, high: 0.04, mat: 'leather', w: W }));
    const tip = hang[5];
    parts.push(strap([hang[4], tip, { p: add(tip.p, [0, -0.16, 0.01]), n: tip.n }], { wide: 0.2, high: 0.06, mat: 'gilt', w: W }));
  }
  // -- the skirt: four panels of lamellae below the belt, each over a thigh's front or back, swinging with it
  {
    const pickS = (s2) => shareW(B, s2.w, 'torso', 'thigh') > 0.85 && shareW(B, s2.w, 'upperarm', 'forearm', 'hand') < 0.05;
    const SR = torsoReach(B, M, M.hip - 1.6, M.waist + 0.4, pickS);
    const len0 = o.skirt ?? (B.who === 'female' ? 1.45 : 1.6), nR = 3, h = len0 / nR, top = yB + 0.08;
    for (const sg of [1, -1]) for (const back of [false, true]) {
      const sd = sg > 0 ? 'l' : 'r';
      const wS = (p) => { const f = clamp((top - Y(p)) / len0); return mixOf(B, [['pelvis', 1 - 0.3 * f], [`thigh_${sd}`, 0.3 * f]]); };
      const aA = back ? 1.5 : 0.04, aB = back ? PI : 1.64, nL = Math.max(3, Math.round((aB - aA) / 0.36)), dA = (aB - aA) / nL;
      for (let k = 0; k < nR; k++) {
        const y1 = top - k * h, y0 = y1 - h;
        const atS = (yy, a, off) => { const f = clamp((top - yy) / len0); const F = SR.frame(yy); let r = 0; for (let q = 0; q <= 10; q++) for (const da2 of [-0.12, 0, 0.12]) r = Math.max(r, SR.r(top - ((top - yy) * q) / 10, a + da2)); const side = 0.35 + 0.65 * Math.cos(a) ** 2; return add(F.o, mul(dirOf(F, a), r + off * (0.75 + 0.25 * side) + ((back ? 0.1 : 0.1) * f * f + 0.05 * f) * side)); };
        parts.push(...lamRow({ da: dA, y0, y1, tuck: k === 0 ? 0 : 0.12, round: 0.1, off: 0.2 + 0.015 * k + (back ? 0.05 : 0), lap: 0.05, shingle: 0.03, bulge: 0.015, a0: sg > 0 ? aA : -aB, lam: nL, mid: back ? sg * PI : 0, at: atS, out, w: wS, lace: 0.62 }).parts);
      }
      // (the gambeson's quilted skirt hanging a hand below the lamellae, in the same four panels)
      {
        const atS2 = (yy, a, off) => { const f = clamp((top - yy) / len0, 0, 1.3); const F = SR.frame(yy); let r = 0; for (let q = 0; q <= 10; q++) for (const da2 of [-0.12, 0, 0.12]) r = Math.max(r, SR.r(top - ((top - yy) * q) / 10, a + da2)); const side = 0.35 + 0.65 * Math.cos(a) ** 2; return add(F.o, mul(dirOf(F, a), r + off * (0.75 + 0.25 * side) + (0.1 * f * f + 0.05 * f) * side)); };
        const yA = top - len0 + 0.15, yZ = top - len0 - (o.hem ?? 0.2), a0 = sg > 0 ? aA : -aB, a1 = sg > 0 ? aB : -aA;
        const GQ = grid((u, v) => atS2(lerp([yA, 0, 0], [yZ, 0, 0], u)[0], lerp([a0, 0, 0], [a1, 0, 0], v)[0], 0.22 + 0.12 * u + (back ? 0.06 : 0)), 2, nL * 2, { out: (u, v, p) => out(p) });
        const wQ = mixOf(B, [['pelvis', 0.62], [`thigh_${sd}`, 0.38]]);
        parts.push(slab(GQ, { w: () => wQ, thick: 0.05, mat: (i, j) => (j % 2 ? 'gam' : 'gamD'), inner: null, edge: 'gamD' }));
        parts.push(tube(rowPath(GQ, 2, 0, nL * 2, nL * 2, 0.0), { r: 0.035, k: 3, mat: 'gamD', w: () => wQ }));
      }
    }
  }
  // -- each arm: lamellar shoulder guards, quilted rolls on the sleeve, an iron disc on the elbow, splinted vambraces
  for (const sg of [1, -1]) {
    const sd = sg > 0 ? 'l' : 'r', sh = A.shoulder[sd], el = A.elbow[sd], wr = A.wrist[sd];
    const L = len(sub(el, sh)), uDir = unit(sub(el, sh));
    const armPick = (parts2, k = 0.6) => (s2) => (sg > 0 ? s2.p[0] > 0.2 : s2.p[0] < -0.2) && shareW(B, s2.w, ...parts2) > k;
    const tAlong = (a0, b0) => (p) => dot(sub(p, a0), sub(b0, a0)) / dot(sub(b0, a0), sub(b0, a0));
    const UA = reach(B, { t: [-0.3, 1.0], nt: 18, na: 32, smooth: 3, frame: (t) => frame(lerp(sh, el, t), uDir, [0, 0, 1]), tOf: tAlong(sh, el), pick: armPick(['upperarm', 'shoulder']) });
    // (the frame's side, u x f, is the body's left for the left arm: the outside; on the right arm the outside is its other way)
    const outA = (a) => (sg > 0 ? -a : a);
    const wSh = mixOf(B, [[`shoulder_${sd}`, 0.6], [`upperarm_${sd}`, 0.25], [`clavicle_${sd}`, 0.15]]);
    const atU = (yy, a, off) => onReach(UA, -yy / L, outA(a), off);
    const outU = (p) => { const t = tAlong(sh, el)(p), c = lerp(sh, el, t); return sub(p, c); };
    const pr = [[-0.14, 0.12], [0.08, 0.3], [0.25, 0.48]];
    pr.forEach(([t0, t1], k) => {
      const wK = mixOf(B, [[`shoulder_${sd}`, 0.55 - 0.15 * k], [`upperarm_${sd}`, 0.3 + 0.15 * k], [`clavicle_${sd}`, 0.15]]);
      const y1 = -t0 * L, y0 = -t1 * L, aA = 0.05 - 0.17 * k, aB = PI - 0.3 + 0.12 * k, nL = Math.round((aB - aA) / 0.36), dA = (aB - aA) / nL;
      parts.push(...lamRow({ da: dA, y0, y1, tuck: k === 0 ? 0 : 0.1, round: 0.08, off: 0.17 + 0.05 * k, lap: 0.06, shingle: 0.03, bulge: 0.015, a0: aA, lam: nL, mid: PI / 2, at: (yy, a, off) => atU(yy, a, off + 0.12 * smooth(1.15, 1.75, Math.abs(a - PI / 2)) * (1 - 0.4 * k)), out: outU, w: () => wK, lace: 0.62, laceR: 0.022 }).parts);
    });
    // (the guard's head: a leather binding over the shoulder's top)
    const capPath = [...Array(13).keys()].map((k) => { const a = 0.25 + ((PI - 0.6) * k) / 12, p = atU(0.2 * L, a, 0.17); return { p, n: unit(outU(p)) }; });
    // (the sleeve below the guard quilted in rolls)
    const wSl = nearW(B, armPick(['upperarm', 'forearm'], 0.7), (n) => n.endsWith(`_${sd}`) || n.startsWith('clavicle'), 0.3);
    for (const t of [0.6, 0.76]) {
      const ring = [...Array(12).keys()].map((j) => { const a = (j / 12) * TAU, p = onReach(UA, t, a, 0.085); return { p, n: unit(outU(p)) }; });
      parts.push(tube(ring, { r: 0.03, k: 3, closed: true, mat: 'gamD', w: wSl }));
    }
    // -- the forearm: splints of iron down its outside, laced on at two places; the elbow's disc
    const fDir = unit(sub(wr, el)), FL = len(sub(wr, el));
    const FA = reach(B, { t: [-0.1, 1.05], nt: 16, na: 28, smooth: 3, frame: (t) => frame(lerp(el, wr, t), fDir, [0, 0, 1]), tOf: tAlong(el, wr), pick: armPick(['forearm']) });
    const wFa = skinW(B, (s2) => armPick(['forearm'])(s2) && tAlong(el, wr)(s2.p) > 0.2 && tAlong(el, wr)(s2.p) < 0.85, (n) => n.endsWith(`_${sd}`));
    const atF = (t, a, off) => onReach(FA, t, outA(a), off);
    const outF = (p) => { const t = tAlong(el, wr)(p), c = lerp(el, wr, t); return sub(p, c); };
    const nSp = 5, wSp = nearW(B, armPick(['forearm', 'hand'], 0.7), (n) => n.endsWith(`_${sd}`), 0.3);
    for (let k = 0; k < nSp; k++) {
      const a = -0.55 + (k * 2.6) / (nSp - 1);
      const path = [...Array(7).keys()].map((j) => { const t = 0.16 + (0.62 * j) / 6, p = atF(t, a, 0.12); return { p, n: unit(outF(p)) }; });
      parts.push(sweep(path.filter((_, j) => j % 2 === 0 || j === 6), { round: true, mat: 'fe', w: wSp, faceMat: (kk, j) => (j === 2 ? 'feM' : j === 1 ? 'feL' : 'fe'), profile: [[-0.075, -0.02], [0.075, -0.02], [0.055, 0.045], [-0.055, 0.045]] }));
      for (const f of [0.06, 0.94]) { const q = pathAt(path, f); parts.push(stud(add(q.p, mul(q.n, 0.045)), q.n, { r: 0.035, h: 0.03, k: 4, mat: 'feL', w: wSp })); }
    }
    for (const t of [0.3, 0.68]) {
      const ring = [...Array(12).keys()].map((j) => { const a = (j / 12) * TAU, p = atF(t, a, 0.15 + 0.035 * Math.max(0, Math.cos(a - 0.75)) ** 0.5); return { p, n: unit(outF(p)) }; });
      parts.push(tube(ring, { r: 0.032, k: 3, closed: true, mat: 'lace', w: wSp }));
    }
    // (the sleeve's cuff at the wrist, rolled)
    const wCu = nearW(B, armPick(['forearm', 'hand'], 0.8), (n) => n.endsWith(`_${sd}`), 0.3);
    const cuff = [...Array(12).keys()].map((j) => { const a = (j / 12) * TAU, p = atF(0.9, a, 0.11); return { p, n: unit(outF(p)) }; });
    parts.push(tube(cuff, { r: 0.05, k: 4, closed: true, mat: 'gamD', w: wCu }));
    // (the elbow: a round iron disc with a gilt boss, on its point)
    const wEl = mixOf(B, [[`elbow_${sd}`, 0.6], [`lowerarm_${sd}`, 0.4]]);
    const eq = atF(-0.02, PI * 0.82, 0.16), en = unit(outF(eq));
    const ex = unit(cross(en, fDir)), ey = cross(en, ex);
    parts.push(loftRings([0.21, 0.2, 0.15, 0.05].map((r, k) => ringAt(add(eq, mul(en, [0, 0.04, 0.07, 0.085][k])), ex, ey, r, r, 12)), { w: () => wEl, mat: (i) => (i === 0 ? 'feL' : 'fe') }));
    parts.push(stud(add(eq, mul(en, 0.08)), en, { r: 0.06, h: 0.06, k: 6, mat: 'gilt', w: () => wEl }));
  }
  return { parts, M, TR, W, yC, NR, zN };
}

/* ---- the shawl: the jarl's bear mantle. A madder wool shoulder-cape under a bear's pelt laid over both shoulders, its
   fur in shaggy layered tufts and a ruff standing round the neck; the bear's forepaws hang down the chest, their iron
   claws lit when enchanted; an iron chain slung between two ringed bosses clasps it --------------------------------- */
/** A deterministic number nought to one for an integer pair. */
const hash = (a, b) => { const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); };
export function ironMantleOf(B, o = {}) {
  const A = B.at, C = ironChestOf(B), M = C.M, parts = [];
  // (what the mantle lies over: the skin of the torso, the shoulders and the top of the arms, and the chest piece's outside there)
  const pts = [];
  for (const s of skinSamples(B)) if (shareW(B, s.w, 'torso', 'shoulder', 'upperarm', 'neck') > 0.8 && shareW(B, s.w, 'head') < 0.2 && Y(s.p) > M.topF - 1.6) pts.push({ p: s.p, w: s.w });
  for (const P of C.parts) P.V.forEach((p, i) => { if (Y(p) > M.topF - 1.6 && shareW(B, P.W[i], 'forearm', 'hand') < 0.2) pts.push({ p, w: P.W[i] }); });
  const zAx = (yy) => M.zc(Math.min(yy, M.neck - 0.6));
  const MR = reach(B, { points: pts, pick: () => true, t: [M.topF - 1.8, M.neck + 0.2], nt: 44, na: 72, smooth: 5, dilate: 2, frame: (t) => frame([0, t, zAx(t)], [0, 1, 0], [0, 0, 1]), tOf: (p) => Y(p) });
  const out = (p) => sub(p, [0, Y(p), zAx(Y(p))]);
  const Wt = nearW(B, (s) => shareW(B, s.w, 'torso', 'shoulder', 'neck') > 0.8 && Y(s.p) > M.topF - 1.8 && shareW(B, s.w, 'head') < 0.1 && shareW(B, s.w, 'shoulder') < 0.5, (n) => TORSO_BONES.has(n) || n.startsWith('clavicle') || n === 'neck_01', 0.6);
  // (out over each shoulder it goes with the shoulder guard under it, as that guard's top row does; between, blended over a hand's breadth)
  const Wsh = { l: mixOf(B, [['shoulder_l', 0.55], ['upperarm_l', 0.3], ['clavicle_l', 0.15]]), r: mixOf(B, [['shoulder_r', 0.55], ['upperarm_r', 0.3], ['clavicle_r', 0.15]]) };
  const xs = A.shoulder.l[0];
  const W = Wt;
  const neckY = (a) => C.yC(a) - 0.02 + (o.neckUp ?? 0.14) * Math.max(0, Math.cos(a)) ** 2;
  // the hem: over the collarbones at the front, down over the shoulders to the arm's middle, behind drawn down the spine
  // to a point (the pelt's back)
  const side = A.shoulder.l[1] - (o.side ?? (B.who === 'female' ? 0.2 : 0.42)), front = M.topF + (o.front ?? 1.0), back = M.topF - 0.25, tail = o.tail ?? (B.who === 'female' ? 0.75 : 0.9);
  const hem1 = (a) => { const c = Math.cos(a), sn = Math.abs(Math.sin(a)); const fb = c > 0 ? front : back; const h = (fb * Math.abs(c) ** 1.5 + side * sn ** 1.5) / (Math.abs(c) ** 1.5 + sn ** 1.5); return h - tail * Math.max(0, 1 - Math.abs(PI - Math.abs(wrapA(a))) / 0.9) ** 1.6; };
  // (never out over the shoulder's ball: the arm goes up free of it)
  const xLim = A.shoulder.l[0] + (o.clearX ?? 9), HM = [...Array(73).keys()].map((k) => { const a = -PI + (k / 72) * TAU; let yy = neckY(a) - 0.05; const h = hem1(a); while (yy > h && Math.abs(onReach(MR, yy, a, 0.3)[0]) < xLim) yy -= 0.02; return Math.max(h, yy); });
  for (let pass = 0; pass < 4; pass++) for (let k = 0; k < 72; k++) HM[k] = Math.max(HM[k], (HM[(k + 71) % 72] + 2 * HM[k] + HM[(k + 1) % 72]) / 4);
  const hem = (a) => { const f = ((wrapA(a) + PI) / TAU) * 72, k = Math.min(71, Math.floor(f)); return lerp([HM[k], 0, 0], [HM[k + 1], 0, 0], f - k)[0]; };
  // (u along the surface by its length, not by height: over the shoulder's top the surface runs out more than down)
  const yOfU = (a, u, y0f = neckY, y1f = hem) => {
    const y0 = y0f(a), y1 = y1f(a), N = 40, L = [0], Ys = [y0];
    for (let k = 1; k <= N; k++) { const ya = y0 + ((y1 - y0) * (k - 1)) / N, yb = y0 + ((y1 - y0) * k) / N; L.push(L[k - 1] + Math.hypot(yb - ya, MR.r(yb, a) - MR.r(ya, a))); Ys.push(yb); }
    const x = clamp(u) * L[N]; let k = 1; while (k < N && L[k] < x) k++;
    return Ys[k - 1] + (Ys[k] - Ys[k - 1]) * clamp((x - L[k - 1]) / Math.max(1e-9, L[k] - L[k - 1]));
  };
  // (belled out over the arms toward the hem, so the guards under it swing free)
  // (out over the arms: where the surface is over the shoulder guards, by how far out it is across the body)
  const xsA = A.shoulder.l[0], flareAt = (yy, a) => { const x = Math.abs(onReach(MR, yy, a, 0)[0]); return (o.flare ?? (B.who === 'female' ? 0.5 : 0.34)) * smooth(xsA - 1.1, xsA - 0.2, x) * smooth(M.topF + 0.7, M.topF - 0.1, yy); };
  const flare = (u, a) => flareAt(yOfU(a, u), a);
  const at = (u, a, off) => { const yy = yOfU(a, u); return onReach(MR, yy, a, off + flareAt(yy, a)); };
  // -- the wool cape under the pelt: a madder band below its hem, edged in tablet weave whose figures are lit when enchanted
  // (the cape and the pelt's lower rows in four pieces: the front and the back on the torso, and over each shoulder a piece
  // that goes with the shoulder guard under it, the arm's share of it the more the lower the row; each piece rigid in
  // itself and lapped a little over its neighbours, so the arm going up lifts the piece over it and nothing tears)
  const aF = o.aFront ?? 0.95, aB = o.aBack ?? 2.25, lap = 0.06;
  const SEG = [[-aF - lap, aF + lap, null], [aF - lap, aB + lap, 'l'], [aB - lap, TAU - aB + lap, null], [-aB - lap, -aF + lap, 'r']];
  // (the shoulder guard's rows: its head on the shoulder, its foot more on the arm)
  const guardW = (sd, k) => mixOf(B, [[`shoulder_${sd}`, 0.55 - 0.15 * k], [`upperarm_${sd}`, 0.3 + 0.15 * k], [`clavicle_${sd}`, 0.15]]);
  const segW = (seg, f, p0, k = 0) => { if (!seg[2] && (f <= 0 || Math.abs(wrapA((seg[0] + seg[1]) / 2)) < 1)) return Wt; if (!seg[2]) { const w = Wt(p0); return () => w; } const w = mixW([[Wt(p0), 1 - f], [guardW(seg[2], k), f]]); return () => w; };
  // -- the wool cape under the pelt: a madder band below its hem, edged in tablet weave whose figures are lit when enchanted
  const ext = 0.34;
  const woolAt = (u, a) => { const yy = lerp([yOfU(a, 0.62), 0, 0], [hem(a) - ext * (1 - 0.85 * smooth(xsA - 1.2, xsA - 0.4, Math.abs(onReach(MR, hem(a), a, 0)[0]))) * (1 - 0.8 * smooth(0.1, 0.6, Math.cos(a))), 0, 0], u)[0]; return onReach(MR, yy, a, 0.16 + 0.04 * u + flareAt(yy, a)); };
  for (const seg of SEG) {
    const nv = Math.max(4, Math.round((60 * (seg[1] - seg[0])) / TAU));
    const G = grid((u, v) => woolAt(u, lerp([seg[0], 0, 0], [seg[1], 0, 0], v)[0]), 4, nv, { out: (u, v, p) => out(p) });
    const wS = segW(seg, 1, woolAt(0.5, (seg[0] + seg[1]) / 2), 2);
    parts.push(slab(G, { w: wS, thick: 0.04, mat: 'wool', inner: null, edge: 'woolD' }));
    parts.push(strap(rowPath(G, 3.6, 0, nv, nv, 0.0), { wide: 0.13, high: 0.025, mat: 'trimD', w: wS, faceMat: (k, j) => (j === 3 ? (k % 2 ? 'trim' : 'trimD') : 'trimD') }));
  }
  // -- the pelt: rows of shaggy fringe, each lapped over the row below, longer toward the hem; the last row's locks longest
  const rows = 5, ARM = o.arm ?? [0.3, 0.5, 0.75, 0.95, 1], GK = [0, 0, 0.6, 1.4, 2];
  for (let r = 0; r < rows; r++) {
    const u0 = r / rows - (r ? 0.07 : 0), u1 = (r + 1) / rows, n = Math.round(20 + 4 * r), last = r === rows - 1;
    const tipOf = (k) => (0.09 + 0.07 * r / rows + (last ? 0.07 : 0)) * (0.7 + 0.7 * hash(r, k));
    const pieces = ARM[r] > 0 ? SEG : [[-PI, PI, null, true]];
    for (const seg of pieces) {
      const span = seg[1] - seg[0], nt = Math.max(2, Math.round((n * span) / TAU)), closed = !!seg[3];
      const G = grid((u, v) => {
        const kk = v * nt * 2, k = Math.floor(kk / 2) + Math.round((seg[0] / TAU) * n), isTip = Math.round(kk) % 2 === 1, a = seg[0] + v * span + (r % 2) * (PI / n);
        const uu = lerp([u0, 0, 0], [u1, 0, 0], u)[0], p = at(uu, a, (0.2 + 0.035 * r + 0.06 * u + (isTip ? 0.02 : 0) + 0.025 * (hash(k, r + 11) - 0.5) + (seg[2] ? 0.012 : 0)) * (1 - 0.35 * Math.max(0, Math.cos(a)) ** 3));
        return u === 1 && isTip ? add(p, [0, -tipOf(k) * (last ? 1 - 0.45 * Math.sin(a) ** 2 : 1), 0]) : u === 1 ? add(p, [0, 0.03, 0]) : p;
      }, 2, nt * 2, { closed, out: (u, v, p) => out(p) });
      const wS = segW(seg, ARM[r], at((u0 + u1) / 2, (seg[0] + seg[1]) / 2, 0.2), GK[r]);
      parts.push(slab(G, { w: wS, thick: 0.05, mat: (i, j) => { const k = Math.floor(j / 2) + Math.round((seg[0] / TAU) * n), h = hash(k, r * 5 + 1); return h > 0.7 ? 'furL' : h < 0.22 ? 'furD' : 'fur'; }, inner: null, edge: (i, j, m, e) => (i === 1 || (!closed && (e === 1 || e === 3)) ? 'furD' : null) }));
    }
  }
  // -- the ruff: a thick roll of fur round the neck, shaggy locks standing out of it
  {
    const nrm = (u, a) => { const du = sub(at(u + 0.02, a, 0), at(Math.max(0, u - 0.02), a, 0)), dA = sub(at(u, a + 0.02, 0), at(u, a - 0.02, 0)), n0 = unit(cross(dA, du)); return dot(n0, out(at(u, a, 0))) < 0 ? mul(n0, -1) : n0; };
    const lift = (a) => (o.ruffLift ?? (B.who === 'female' ? 0.36 : 0.16)) * Math.max(0, -Math.cos(a)) ** 2;
    const n = 40, ring = [...Array(n).keys()].map((k) => { const a = -PI + (k / n) * TAU, nn = nrm(0.06, a); return { p: add(add(at(0.06, a, 0.06), mul(nn, 0.34 - 0.17 * Math.max(0, Math.cos(a)) ** 2)), [0, lift(a), 0]), n: nn, a }; });
    parts.push(sweep(ring, { closed: true, round: true, w: W, mat: 'fur', faceMat: (k, j) => (j >= 5 ? 'furD' : (k + j) % 4 === 0 ? 'furL' : 'fur'), profile: (k) => roundProfile(0.25 * (1 - 0.45 * Math.max(0, Math.cos(ring[k].a)) ** 2), 7, 0, 0.72) }));
    const nT = 32;
    const G = grid((u, v) => {
      const kk = v * nT * 2, k = Math.floor(kk / 2), isTip = Math.round(kk) % 2 === 1, a = -PI + v * TAU;
      const fr = Math.max(0, Math.cos(a)) ** 2, nn = nrm(0.06, a), p0 = add(add(at(0.06, a, 0.06), mul(nn, 0.5 - 0.25 * fr)), [0, lift(a), 0]), L = (0.2 + 0.16 * hash(k, 77)) * (isTip ? 1 : 0.3) * (1 - 0.5 * fr);
      return add(p0, mul(unit(add(nn, [0, 0.5, 0])), L * u));
    }, 1, nT * 2, { closed: true, out: (u, v, p) => add(out(p), [0, 0.9, 0]) });
    parts.push(slab(G, { w: W, thick: 0.05, mat: (i, j) => (hash(Math.floor(j / 2), 5) > 0.5 ? 'furL' : 'fur'), inner: 'furD', edge: 'furD' }));
  }
  // -- the brooch at the throat: a great penannular ring of iron, thistle knobs at its ends, its long pin through the pelt;
  // an inlaid line round the ring lit when enchanted
  {
    const nn0 = (() => { const du = sub(at(0.08, 0, 0), at(0.04, 0, 0)), dA = sub(at(0.06, 0.02, 0), at(0.06, -0.02, 0)), n0 = unit(cross(dA, du)); return dot(n0, out(at(0.06, 0, 0))) < 0 ? mul(n0, -1) : n0; })();
    const c0 = add(add(at(0.06, 0, 0.06), mul(nn0, 0.34 - 0.08 + 0.16)), [0, 0.0, 0]), n = unit(add(out(c0), [0, 0.2, 0])), ex = [1, 0, 0], ey = unit(cross(n, ex));
    const R = o.brooch ?? (B.who === 'female' ? 0.22 : 0.25), gap = 0.55;
    const arc = (r0, lift) => [...Array(17).keys()].map((k) => { const t = -PI / 2 + gap / 2 + ((TAU - gap) * k) / 16; return { p: add(add(c0, mul(n, lift)), add(mul(ex, Math.cos(t) * r0), mul(ey, Math.sin(t) * r0))), n }; });
    parts.push(sweep(arc(R, 0), { round: true, w: W, mat: 'fe', faceMat: (k, j) => (j === 1 || j === 2 ? 'feL' : 'fe'), profile: roundProfile(0.07, 6) }));
    parts.push(sweep(arc(R, 0.065), { round: true, w: W, mat: 'runeG', profile: [[-0.035, -0.01], [0.035, -0.01], [0.02, 0.016], [-0.02, 0.016]] }));
    // (the thistles: a knob at each end of the ring)
    for (const sg of [1, -1]) {
      const t = -PI / 2 + sg * (gap / 2 + 0.02), k0 = add(c0, add(mul(ex, Math.cos(t) * R), mul(ey, Math.sin(t) * R)));
      parts.push(loftRings([[0.06, -0.02], [0.11, 0.04], [0.12, 0.1], [0.09, 0.17], [0.025, 0.21]].map(([r0, h]) => ringAt(add(k0, mul(ey, -h)), ex, n, r0, r0, 8)), { w: W, mat: (i) => (i === 2 ? 'feL' : 'gilt') }));
    }
    // (the pin: from above the ring on the left down through it to the right, its head a knob)
    const pin0 = add(c0, add(mul(ex, -R * 1.25), mul(ey, R * 0.9))), pin1 = add(c0, add(mul(ex, R * 1.35), mul(ey, -R * 0.95)));
    const pinPath = [0, 0.5, 1].map((t) => ({ p: add(lerp(pin0, pin1, t), mul(n, 0.06)), n }));
    parts.push(sweep(pinPath, { w: W, mat: 'feL', round: true, profile: (k) => roundProfile(k === 2 ? 0.006 : 0.032, 5) }));
    parts.push(stud(add(pin0, mul(n, 0.04)), n, { r: 0.075, h: 0.08, k: 6, mat: 'gilt', w: W }));
  }
  // -- two ringed bosses pinning the pelt at the collarbones, their rings lit when enchanted
  {
    for (const sg of [1, -1]) {
      const a = sg * (o.bossA ?? 0.78), u = o.bossU ?? 0.22, c = at(u, a, 0.46), nn = unit(out(c)), ex = unit(cross([0, 1, 0], nn)), ey = unit(cross(nn, ex)), R = 0.17;
      parts.push(loftRings([[1, 0], [1, 0.04], [0.85, 0.07], [0.55, 0.09], [0.5, 0.09]].map(([kk, h]) => ringAt(add(c, mul(nn, h)), ex, ey, R * kk, R * kk, 14)), { w: W, mat: (i) => (i === 0 ? 'feL' : 'fe') }));
      parts.push(tube([...Array(14).keys()].map((kk) => { const t = (kk / 14) * TAU; return { p: add(add(c, mul(nn, 0.1)), add(mul(ex, Math.cos(t) * R * 0.66), mul(ey, Math.sin(t) * R * 0.66))), n: nn }; }), { r: 0.028, k: 4, closed: true, mat: 'rune', w: W }));
      parts.push(stud(add(c, mul(nn, 0.09)), nn, { r: R * 0.36, h: 0.09, k: 8, mat: 'gilt', w: W }));
    }
  }
  return { parts };
}

/* ---- the legs: russet wool trousers, full and bloused over the knee, the shins wound in pale wraps cross-gartered in
   leather, splinted greaves strapped over them, a domed iron disc on each knee with a ring lit when enchanted -------- */
export function ironLegsOf(B, o = {}) {
  const A = B.at, M = torsoMarks(B), parts = [];
  const waist = M.waist;
  // -- the trousers: the hips, the seat, the crotch and both legs whole, front and back, down to the ankle
  const legT = (p) => { const s = p[0] >= 0 ? 'l' : 'r'; return { s, t: along3(p, A.hip[s], A.knee[s]), c: along3(p, A.knee[s], A.ankle[s]) }; };
  const skirtFoot = lerp(A.hip.l, A.knee.l, B.who === 'female' ? 0.52 : 0.45)[1];
  parts.push(bodyShell(B, {
    sub: 1, thick: 0.03,
    keep: (i) => { const p = B.V[i]; return onPart(B, i, 'thigh', 'calf', 'torso') > 0.6 && onPart(B, i, 'foot') < 0.5 && Y(p) < waist + 0.25 && Y(p) > Math.min(A.ankle.l[1], A.ankle.r[1]) + 0.1 && onPart(B, i, 'upperarm', 'forearm', 'hand') < 0.1; },
    off: ({ p }) => {
      const L = legT(p), knee = A.knee[L.s][1];
      // (close under the skirt, bloused out over the knee, close again under the wraps)
      const blouse = smooth(skirtFoot + 0.2, skirtFoot - 0.6, Y(p)) * smooth(knee - 0.42, knee + 0.05, Y(p));
      return 0.05 + 0.12 * blouse + 0.03 * smooth(waist - 0.65, waist - 0.45, Y(p));
    },
    mat: ({ p }) => (Y(p) > waist - 0.25 ? 'hoseW' : 'hose'),
    rim: (m) => (m === 'hoseW' ? 'hoseW' : 'hoseD'),
  }));
  // (its weights eased over the hips and the tops of the thighs, where the walk folds it)
  smoothWeights(parts[0], o.ease ?? 10, (p) => Y(p) < waist - 0.55 && Y(p) > A.knee.l[1] + 0.35);
  for (const sg of [1, -1]) {
    const s = sg > 0 ? 'l' : 'r', kn = A.knee[s], an = A.ankle[s], L = len(sub(an, kn)), u = unit(sub(an, kn));
    const pick = (q) => (sg > 0 ? q.p[0] > 0.05 : q.p[0] < -0.05) && shareW(B, q.w, 'calf') > 0.6 && Y(q.p) > Y(an) + 0.05;
    const SR = reach(B, { t: [-0.1, 1.0], nt: 22, na: 28, smooth: 3, frame: (t) => frame(lerp(kn, an, t), u, [0, 0, 1]), tOf: (p) => along3(p, kn, an), pick });
    const outS = (p) => { const t = along3(p, kn, an), c = lerp(kn, an, t); return sub(p, c); };
    const wC = nearW(B, pick, (n) => n.endsWith(`_${s}`), 0.2);
    // -- a tablet-woven braid down the trousers' outer seam, from under the skirt to the knee
    {
      const hp0 = A.hip[s], kn0 = A.knee[s], uT = unit(sub(kn0, hp0));
      const TR3 = reach(B, { t: [0.2, 1.05], nt: 12, na: 24, smooth: 2, dilate: 1, frame: (t) => frame(lerp(hp0, kn0, t), uT, [0, 0, 1]), tOf: (p) => along3(p, hp0, kn0), pick: (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'thigh', 'calf') > 0.7 });
      const wT = nearW(B, (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'thigh', 'calf') > 0.7, (n) => n.endsWith(`_${s}`) || TORSO_BONES.has(n), 0.3);
      const braid = [...Array(8).keys()].map((k) => { const t = 0.55 + 0.43 * (k / 7), a = -sg * PI / 2 + sg * 0.15, F = TR3.frame(t), knee = Y(kn0), yy = Y(lerp(hp0, kn0, t)), blouse = smooth(skirtFoot + 0.2, skirtFoot - 0.6, yy) * smooth(knee - 0.42, knee + 0.05, yy); const p = add(F.o, mul(dirOf(F, a), TR3.r(t, a) + 0.075 + 0.12 * blouse)); return { p, n: unit(sub(p, F.o)) }; });
      parts.push(strap(braid, { wide: 0.13, high: 0.025, mat: 'trimD', w: wT, faceMat: (k, j) => (j === 3 ? 'trim' : 'trimD') }));
    }
    // -- the wraps: a band wound from under the knee to the ankle, each turn lapped over the last
    const t0 = 0.13, t1 = (Y(an) + 0.8 - Y(kn)) / (Y(an) - Y(kn)), turns = o.turns ?? 6, nP = turns * 10;
    const wrapPath = [...Array(nP + 1).keys()].map((k) => { const f = k / nP, t = t0 + (t1 - t0) * f, a = sg * (f * turns * TAU), p = onReach(SR, t, a, 0.12 + 0.02 * frac(f * turns)); return { p, n: unit(outS(p)) }; });
    const pitch = ((t1 - t0) * L) / turns;
    parts.push(sweep(wrapPath, { profile: [[-pitch * 0.62, 0.0], [pitch * 0.62, 0.035]], mat: 'wrap', w: wC, caps: false }));
    // (the trousers gathered in a ruched roll where the wraps begin)
    parts.push(sweep([...Array(24).keys()].map((j) => { const a = (j / 24) * TAU, p = onReach(SR, t0 - 0.06, a, 0.17 + 0.045 * Math.max(0, Math.sin(a * 6)) ** 0.7); return { p, n: [0, 1, 0] }; }), { closed: true, round: true, mat: 'hose', w: wC, faceMat: (k, j) => (j >= 3 ? 'hoseD' : 'hose'), profile: roundProfile(0.09, 5, 0, 1.2) }));
    // (the wraps' head bound with a leather garter)
    parts.push(strap([...Array(12).keys()].map((j) => { const a = (j / 12) * TAU, p = onReach(SR, t0 - 0.005, a, 0.14); return { p, n: unit(outS(p)) }; }), { wide: 0.1, high: 0.035, closed: true, mat: 'leatherD', w: wC }));
    // -- the cross-gartering: two thongs wound the other ways, crossing over the front of the shin
    for (const dir of [1, -1]) {
      const g = [...Array(29).keys()].map((k) => { const f = k / 28, t = 0.1 + (t1 - 0.14) * f, a = dir * sg * (f * 2.5 * TAU) + PI, p = onReach(SR, t, a, 0.2); return { p, n: unit(outS(p)) }; });
      parts.push(sweep(g, { profile: [[-0.03, 0.0], [0.03, 0.02]], mat: 'leatherD', w: wC, caps: false }));
    }
    // -- the greave: three iron splints down the front of the shin, riveted, strapped on above and below
    const wG = skinW(B, (q) => pick(q) && along3(q.p, kn, an) > 0.15 && along3(q.p, kn, an) < 0.8, (n) => n.endsWith(`_${s}`));
    for (const a of [-0.42, 0, 0.42]) {
      const path = [0.13, 0.33, 0.53, 0.73].map((t) => { const p = onReach(SR, t, sg * a, 0.21); return { p, n: unit(outS(p)) }; });
      parts.push(sweep(path, { round: true, mat: 'fe', w: () => wG, faceMat: (kk, j) => (j === 2 ? 'feM' : j === 1 ? 'feL' : 'fe'), profile: [[-0.085, -0.02], [0.085, -0.02], [0.06, 0.045], [-0.06, 0.045]] }));
      for (const f of [0.05, 0.95]) { const q = pathAt(path, f); parts.push(stud(add(q.p, mul(q.n, 0.045)), q.n, { r: 0.04, h: 0.03, k: 4, mat: 'feL', w: () => wG })); }
    }
    for (const t of [0.24, 0.64]) {
      const ring = [...Array(12).keys()].map((j) => { const a = (j / 12) * TAU, p = onReach(SR, t, a, 0.2 + 0.06 * Math.max(0, Math.cos(a)) ** 0.5 + 0.1 * Math.max(0, -Math.cos(a))); return { p, n: unit(outS(p)) }; });
      parts.push(strap(ring, { wide: 0.07, high: 0.025, closed: true, mat: 'leather', w: () => wG }));
    }
    // -- the knee: a domed iron disc, a gilt boss, a ring lit when enchanted
    const wK = mixOf(B, [[`knee_${s}`, 0.5], [`calf_${s}`, 0.3], [`thigh_${s}`, 0.2]]);
    const kq = onReach(SR, -0.02, 0, 0.18 + 0.11), kn0 = unit(add(outS(kq), [0, 0.15, 0])), ex = unit(cross([0, 1, 0], kn0)), ey = unit(cross(kn0, ex)), R = o.knee ?? 0.27;
    parts.push(loftRings([[1, 0], [1, 0.03], [0.85, 0.08], [0.55, 0.12], [0.5, 0.12]].map(([k, h]) => ringAt(add(kq, mul(kn0, h)), ex, ey, R * k, R * k * 1.1, 14)), { w: () => wK, mat: (i) => (i === 0 ? 'feL' : 'fe') }));
    parts.push(tube([...Array(14).keys()].map((k) => { const a = (k / 14) * TAU; return { p: add(add(kq, mul(kn0, 0.12)), add(mul(ex, Math.cos(a) * R * 0.68), mul(ey, Math.sin(a) * R * 0.75))), n: kn0 }; }), { r: 0.028, k: 3, closed: true, mat: 'rune', w: () => wK }));
    parts.push(stud(add(kq, mul(kn0, 0.12)), kn0, { r: R * 0.34, h: 0.08, k: 6, mat: 'gilt', w: () => wK }));
  }
  return { parts };
}
/** Where a point is along a segment from `a` to `b`, nought to one. */
const along3 = (p, a, b) => { const ab = sub(b, a); return dot(sub(p, a), ab) / dot(ab, ab); };

/* ---- the boots: a shape of their own over the foot, not the foot pushed out. A boxy turnshoe vamp drawn to a blunt
   point at the toe, a thick sole and a stacked heel, a shaft to over the ankle with its top turned down in a cuff, a
   strap and iron toggle over the instep, and an iron prick spur at the heel whose goad glows when enchanted ---------- */
export function ironBootsOf(B, o = {}) {
  const A = B.at, parts = [], floor = A.floor, P0 = part();
  const soleT = o.sole ?? 0.15, heelT = o.heel ?? 0.22;
  for (const sg of [1, -1]) {
    const s = sg > 0 ? 'l' : 'r', an = A.ankle[s], kn = A.knee[s];
    const footPick = (q) => (sg > 0 ? q.p[0] > 0.05 : q.p[0] < -0.05) && shareW(B, q.w, 'foot') > 0.5;
    const FS = skinSamples(B).filter(footPick);
    // (the foot's long axis on the ground: from its heel's back to its toe's tip)
    const heel = FS.reduce((b, q) => (q.p[2] < b[2] ? q.p : b), [0, 0, 9]), toe = FS.reduce((b, q) => (q.p[2] > b[2] ? q.p : b), [0, 0, -9]);
    const fwd = unit([toe[0] - heel[0], 0, toe[2] - heel[2]]), side = unit(cross([0, 1, 0], fwd)), L0 = dot(sub(toe, heel), fwd);
    const o0 = [heel[0], floor, heel[2]];
    const tOf = (p) => dot(sub(p, o0), fwd) / L0;
    // (the foot measured along it: its widest either side and its highest, in bins, smoothed)
    const nB = 16, wL = new Array(nB + 1).fill(0), wR = new Array(nB + 1).fill(0), hT = new Array(nB + 1).fill(0);
    for (const q of FS) { const t = tOf(q.p), i = clamp(Math.round(t * nB), 0, nB), x = dot(sub(q.p, o0), side), yy = Y(q.p) - floor; if (yy > Y(an) - floor + 0.2) continue; wL[i] = Math.max(wL[i], x); wR[i] = Math.min(wR[i], x); hT[i] = Math.max(hT[i], yy); }
    for (let pass = 0; pass < 3; pass++) for (let i = 0; i <= nB; i++) { const n = [Math.max(0, i - 1), Math.min(nB, i + 1)]; wL[i] = Math.max(wL[i], (wL[n[0]] + wL[i] + wL[n[1]]) / 3); wR[i] = Math.min(wR[i], (wR[n[0]] + wR[i] + wR[n[1]]) / 3); hT[i] = Math.max(hT[i], (hT[n[0]] + hT[i] + hT[n[1]]) / 3); }
    const at = (t) => { const f = clamp(t, 0, 1) * nB, i = Math.min(nB - 1, Math.floor(f)), g = f - i; return { l: wL[i] + (wL[i + 1] - wL[i]) * g, r: wR[i] + (wR[i + 1] - wR[i]) * g, h: hT[i] + (hT[i + 1] - hT[i]) * g }; };
    const wFoot = mixOf(B, [[`foot_${s}`, 0.85], [`ankle_${s}`, 0.15]]), wToe = mixOf(B, [[`foot_${s}`, 0.55], [`ball_${s}`, 0.45]]);
    const ballT = tOf(A.ball[s]);
    const wAt = (p) => { const f = smooth(ballT - 0.1, ballT + 0.15, tOf(p)); return mixW([[wFoot, 1 - f], [wToe, f]]); };
    // -- the vamp: a rounded box section round the foot, its top no higher than over the instep, drawn to the toe
    const ankleH = Y(an) - floor, top = (t) => Math.min(at(t).h + 0.1, ankleH - 0.12);
    const sect = (t, ph) => {
      const m = at(t), end = t > 0.82 ? Math.sqrt(Math.max(0, 1 - ((t - 0.82) / 0.24) ** 2)) : t < 0.06 ? Math.sqrt(Math.max(0, 1 - ((0.06 - t) / 0.1) ** 2)) : 1;
      const W = ((m.l - m.r) / 2 + 0.08) * (0.25 + 0.75 * end), cx = (m.l + m.r) / 2, bot = soleT, H = Math.max(0.2, top(t) - bot) * (0.35 + 0.65 * end);
      const c = Math.cos(ph), sn = Math.sin(ph), e = 2 / 3;
      const x = cx + W * Math.sign(c) * Math.abs(c) ** e, yy = bot + H * Math.max(0, sn) ** 0.8;
      return add(add(o0, mul(fwd, t * L0)), add(mul(side, x), [0, sn < 0 ? bot : yy, 0]));
    };
    const G = grid((u, v) => sect(-0.04 + 1.1 * u, v * PI), 14, 8, { out: (u, v, p) => { const t = -0.04 + 1.1 * u, m = at(t); return sub(p, add(add(o0, mul(fwd, t * L0)), add(mul(side, (m.l + m.r) / 2), [0, soleT, 0]))); } });
    parts.push(slab(G, { w: (p) => wAt(p), thick: 0.04, mat: (i, j) => (i > 11 ? 'leatherD' : 'leather'), inner: null, edge: 'leatherD' }));
    // (a seam down the vamp's middle, from the instep to the toe)
    parts.push(tube(colPath(G, 4, 5, 13.5, 6, 0.0), { r: 0.022, k: 3, mat: 'leatherD', w: (p) => wAt(p) }));
    // -- the sole and the heel: a thick slab under it all, the heel stacked higher at the back
    // (a flat slab: its top under the vamp's edge, its bottom on the ground, its rim a band round it)
    const outline = [];
    for (let k = 0; k <= 18; k++) outline.push(sect(-0.04 + (1.1 * k) / 18, 0));
    for (let k = 18; k >= 0; k--) outline.push(sect(-0.04 + (1.1 * k) / 18, PI));
    const cen = mul(outline.reduce((a2, p) => add(a2, p), [0, 0, 0]), 1 / outline.length);
    const soleTop = outline.map((p) => { const t = tOf(p); return [p[0] + (p[0] - cen[0]) * 0.07, floor + (t < 0.26 ? heelT : soleT) + 0.005, p[2] + (p[2] - cen[2]) * 0.05]; });
    const soleBot = outline.map((p) => { const t = tOf(p); return [p[0] + (p[0] - cen[0]) * 0.05, floor + (t < 0.26 && t > 0.0 ? 0 : 0.015), p[2] + (p[2] - cen[2]) * 0.04]; });
    const SP = part(), n = outline.length;
    const iT = soleTop.map((p) => put(SP, p, wAt(p))), iB = soleBot.map((p) => put(SP, p, wAt(p)));
    const cT = put(SP, [cen[0], floor + soleT + 0.005, cen[2]], wFoot), cB = put(SP, [cen[0], floor, cen[2]], wFoot);
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n, outD = sub(lerp(soleTop[k], soleTop[k1], 0.5), cen);
      quad(SP, iT[k], iT[k1], iB[k1], iB[k], tOf(soleTop[k]) < 0.26 ? 'soleH' : 'sole', [outD[0], 0, outD[2]]);
      tri(SP, iT[k], iT[k1], cT, 'sole', [0, 1, 0]);
      tri(SP, iB[k], iB[k1], cB, 'sole', [0, -1, 0]);
    }
    SP.soles = [...iB, cB];
    parts.push(SP);
    // -- the shaft: from under the ankle to over it, round the leg, its top turned down in a cuff
    const sk = (q) => (sg > 0 ? q.p[0] > 0.05 : q.p[0] < -0.05) && shareW(B, q.w, 'calf', 'foot') > 0.6;
    const SR = reach(B, { t: [Y(an) - 0.35, Y(an) + 0.7], nt: 14, na: 24, smooth: 2, dilate: 2, frame: (t) => frame([lerp(kn, an, (t - Y(kn)) / (Y(an) - Y(kn)))[0], t, lerp(kn, an, (t - Y(kn)) / (Y(an) - Y(kn)))[2]], [0, 1, 0], [0, 0, 1]), tOf: (p) => Y(p), pick: sk });
    const wSh = nearW(B, sk, (nm) => nm.endsWith(`_${s}`), 0.3);
    const yTop = Y(an) + (o.cuff ?? 0.44), yLow = Y(an) - 0.22;
    const SH = grid((u, v) => { const yy = lerp([yLow, 0, 0], [yTop, 0, 0], u)[0], a = v * TAU; return onReach(SR, yy, a, 0.13 + 0.03 * u + 0.08 * Math.max(0, -Math.cos(a)) * (1 - u)); }, 5, 14, { closed: true, out: (u, v, p) => { const F = SR.frame(Y(p)); return sub(p, F.o); } });
    const wShaft = (p) => { const f = smooth(Y(an) - 0.1, Y(an) + 0.25, Y(p)); return f >= 1 ? wSh(p) : mixW([[wFoot, 1 - f], [wSh(p), f]]); };
    parts.push(slab(SH, { w: wShaft, thick: 0.04, mat: 'leather', inner: null, edge: 'leatherD' }));
    const cuff = [...Array(16).keys()].map((k) => { const a = (k / 16) * TAU, p = onReach(SR, yTop - 0.06, a, 0.23); return { p, n: unit(sub(p, SR.frame(Y(p)).o)) }; });
    parts.push(sweep(cuff, { closed: true, round: true, mat: 'fur', w: wSh, faceMat: (k, j) => (j >= 4 ? 'furD' : (k + j) % 3 === 0 ? 'furL' : 'fur'), profile: roundProfile(0.12, 6, 0.04, 0.8) }));
    // (the cuff's fur in locks round its foot)
    const FC = grid((u, v) => { const kk = v * 32, isTip = Math.round(kk) % 2 === 1, a = v * TAU, p = onReach(SR, yTop - 0.1, a, 0.3); return u === 1 ? add(p, [0, -(isTip ? 0.14 + 0.06 * hash(Math.floor(kk), 3) : 0.04), 0]) : p; }, 1, 32, { closed: true, out: (u, v, p) => sub(p, SR.frame(Y(p)).o) });
    parts.push(slab(FC, { w: wSh, thick: 0.04, mat: (i, j) => (hash(Math.floor(j / 2), 9) > 0.6 ? 'furL' : 'fur'), inner: null, edge: (i, j, m, k) => (k === 2 ? 'furD' : null) }));
    // -- iron plates over the toe and round the heel, riveted, their edges filed bright
    const capOff = (t, ph, d) => { const p = sect(t, ph), c0 = add(add(o0, mul(fwd, t * L0)), add(mul(side, (at(t).l + at(t).r) / 2), [0, soleT + 0.05, 0])); return add(p, mul(unit(sub(p, c0)), d)); };
    const toeG = grid((u, v) => capOff(0.76 + 0.3 * u, 0.12 + (PI - 0.24) * v, 0.045), 3, 8, { out: (u, v, p) => sub(p, add(add(o0, mul(fwd, (0.76 + 0.3 * u) * L0)), [0, soleT, 0])) });
    parts.push(slab(toeG, { w: () => wToe, thick: 0.035, mat: 'fe', inner: null, edge: (i, j, m, k) => (k === 2 && i === 0 ? 'feL' : 'feD') }));
    parts.push(...studs(rowPath(toeG, 0.35, 1, 7, 6, 0.03), 3, { r: 0.035, h: 0.03, k: 4, mat: 'feL', w: () => wToe }));
    const hp = [...Array(9).keys()].map((k) => { const ph = 0.1 + ((PI - 0.2) * k) / 8, t = 0.2 * (1 - Math.sin(ph)) - 0.02, p = capOff(Math.max(-0.03, t), ph, 0.04); return { p: [p[0], floor + heelT + 0.12, p[2]], n: unit(sub(p, add(add(o0, mul(fwd, 0.15 * L0)), [0, Y(p) - floor, 0]))) }; });
    parts.push(strap(hp, { wide: 0.16, high: 0.035, mat: 'fe', w: () => wFoot, faceMat: (k, j) => (j === 2 || j === 4 ? 'feL' : 'fe') }));
    parts.push(...studs(hp.map((q) => ({ p: add(q.p, mul(q.n, 0.035)), n: q.n })), 3, { from: 0.2, to: 0.8, r: 0.03, h: 0.025, k: 4, mat: 'feL', w: () => wFoot }));
    // -- straps crossed up the shaft over the front of the ankle
    for (const dir of [1, -1]) {
      const g = [...Array(17).keys()].map((k) => { const f = k / 16, yy = Y(an) - 0.1 + 0.5 * f, a = dir * (f * 1.5 * TAU) + PI, p = onReach(SR, yy, a, 0.21); return { p, n: unit(sub(p, SR.frame(Y(p)).o)) }; });
      parts.push(sweep(g, { profile: [[-0.035, 0.0], [0.035, 0.02]], mat: 'leatherD', w: wShaft, caps: false }));
    }
    // -- the strap over the instep, an iron toggle on it
    const tI = ballT - 0.32, ins = [...Array(7).keys()].map((k) => { const ph = 0.15 + ((PI - 0.3) * k) / 6, p = add(sect(tI, ph), mul(unit(sub(sect(tI, ph), add(add(o0, mul(fwd, tI * L0)), [0, soleT + 0.1, 0]))), 0.03)); return { p, n: unit(sub(p, add(add(o0, mul(fwd, tI * L0)), [0, soleT + 0.1, 0]))) }; });
    parts.push(strap(ins, { wide: 0.1, high: 0.03, mat: 'leatherD', w: () => wFoot }));
    const tq = pathAt(ins, 0.5 - 0.2 * sg);
    parts.push(stud(add(tq.p, mul(tq.n, 0.03)), tq.n, { r: 0.065, h: 0.05, k: 4, turn: PI / 4, mat: 'feL', w: () => wFoot }));
    // -- the prick spur: an iron yoke round the heel, a goad behind lit when enchanted
    const wS = mixOf(B, [[`foot_${s}`, 0.8], [`ankle_${s}`, 0.2]]);
    const yk = [...Array(9).keys()].map((k) => { const ph = (k / 8) * PI, x = Math.cos(ph), back = Math.sin(ph); const m = at(0.05), W = (m.l - m.r) / 2 + 0.13, cx = (m.l + m.r) / 2; return { p: add(add(o0, mul(fwd, (0.18 - 0.2 * back) * L0)), add(mul(side, cx + W * x), [0, heelT + 0.24, 0])), n: [0, 1, 0] }; });
    parts.push(tube(yk, { r: 0.04, k: 4, mat: 'fe', w: () => wS }));
    const hb = yk[4].p, back = mul(fwd, -1);
    parts.push(loftRings([ringAt(add(hb, mul(back, -0.02)), side, [0, 1, 0], 0.065, 0.065, 5), ringAt(add(hb, mul(back, 0.1)), side, [0, 1, 0], 0.075, 0.075, 5), ringAt(add(hb, mul(back, 0.2)), side, [0, 1, 0], 0.045, 0.045, 5), ringAt(add(hb, mul(back, 0.36)), side, [0, 1, 0], 0.008, 0.008, 5)], { w: () => wS, mat: 'runeS' }));
    // (the foot's own skin under the boot left out)
    B.tris.forEach((t) => { if (t.v.every((i) => (sg > 0 ? B.V[i][0] > 0.05 : B.V[i][0] < -0.05) && onPart(B, i, 'foot', 'calf') > 0.5 && Y(B.V[i]) < Y(an) + 0.3)) P0.hides.add(t.poly); });
  }
  const P = merge(P0, ...parts);
  return P;
}
