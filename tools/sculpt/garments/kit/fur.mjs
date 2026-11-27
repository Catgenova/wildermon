// The fur set's own builders (tools/sculpt/garments/fur.mjs), on the plate kit (../platekit.mjs):
//
//   * the head's dome (`headDome`), the torso's field and marks (`torsoField`, `torsoMarks`), a frame on a point (`frameAt`).
//   * locks of fur (`locks`): a fringe hung from a path, each lock a pointed tuft, its root in one tone and its tip in
//     another, falling along the way given and curling out from the surface; laid in lapped rows over a field (`pelt`)
//     they make a shaggy coat whose dark undercoat shows between pale tips.
//   * a cone (`cone`): a fang, a claw, a tooth, a tusk, a horn tip; a bead (`bead`): a small faceted ball.
//   * sinew stitching (`stitch`): a cord laced in a zigzag across a seam.
//   * a rosette (`rosette`): the snow leopard's broken ring of dark spots round a fawn middle, laid on a surface.
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, merge, part } from '../metalkit.mjs';
import { skinSamples, domeWrap, ellipsoidReach, shareW, torsoMiddle, torsoWrap, tube, face } from '../platekit.mjs';

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
  return { D, c, E, fit, browTh, top, bot, zf, zb, xw, thOf, hs };
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

/** A frame on a point: `z` out along `n`, `y` along `up` made square to it, `x` across. */
export function frameAt(n, up) {
  const z = unit(n), y = unit(sub(up, mul(z, dot(up, z)))), x = cross(y, z);
  return { x, y, z };
}

/* ---- fur ----------------------------------------------------------------------------------------------------------- */
/** A small hash of an integer pair, nought to one: each lock's own length and tone. */
export const hash = (a, b = 0) => { const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); };
/** A path's points resampled evenly along its length: `n` + 1 of them, each with its normal. */
export function even(path, n, closed = false) {
  const P = closed ? [...path, path[0]] : path, L = [0];
  for (let k = 1; k < P.length; k++) L.push(L[k - 1] + len(sub(P[k].p, P[k - 1].p)));
  const out = [];
  for (let s = 0; s <= n; s++) {
    const x = (L[L.length - 1] * s) / n;
    let k = 1;
    while (k < L.length - 1 && L[k] < x) k++;
    const f = clamp((x - L[k - 1]) / Math.max(1e-9, L[k] - L[k - 1]));
    out.push({ p: lerp(P[k - 1].p, P[k].p, f), n: unit(lerp(P[k - 1].n, P[k].n, f)), ...(P[k].d ? { d: unit(lerp(P[k - 1].d ?? P[k].d, P[k].d, f)) } : {}) });
  }
  return closed ? out.slice(0, n) : out;
}
/** A path read at a fraction of its length (`closed`: going round): the point, its normal and its fall there. */
export function sampler(path, closed = false) {
  const P = closed ? [...path, path[0]] : path, L = [0];
  for (let k = 1; k < P.length; k++) L.push(L[k - 1] + len(sub(P[k].p, P[k - 1].p)));
  const total = L[L.length - 1];
  const at = (f) => {
    const x = (closed ? ((f % 1) + 1) % 1 : clamp(f)) * total;
    let k = 1;
    while (k < L.length - 1 && L[k] < x) k++;
    const g = clamp((x - L[k - 1]) / Math.max(1e-9, L[k] - L[k - 1])), A = P[k - 1], Bq = P[k];
    return { p: lerp(A.p, Bq.p, g), n: unit(lerp(A.n, Bq.n, g)), ...(A.d || Bq.d ? { d: unit(lerp(A.d ?? Bq.d, Bq.d ?? A.d, g)) } : {}) };
  };
  at.total = total;
  return at;
}
/**
 * Locks of fur hung from a path (points `p` with the surface's normal `n` there, and the way the locks fall `d`, or
 * `down` for all): `count` locks side by side (going round where `closed`; started `phase` of a lock along), each a
 * pointed tuft from two points on the path to a tip `len(k)` along the fall, curling out `curl(k)` off the surface at its
 * tip and `lift` at its root; its root half in `mat(k)[0]`, its tip in `mat(k)[1]` (or `root`/`tip` for all), the tip
 * from `split` of its length. Every point weighted `w(p)`. Each lock three triangles: a sheet (the renderer draws it
 * from both sides).
 */
export function locks(path, o) {
  const P = part(), n = o.count, closed = !!o.closed, S = sampler(path, closed), ph = o.phase ?? 0;
  const put = (p, nn, w) => { P.V.push(p); P.N.push(nn); P.W.push(w); return P.V.length - 1; };
  const split = o.split ?? 0.6;
  const rootAt = new Map();
  const root = (f) => {
    const key = Math.round(f * 1e6);
    if (!rootAt.has(key)) { const q = S(f), p = add(q.p, mul(q.n, o.lift ?? 0)); rootAt.set(key, { q: { ...q, p }, i: put(p, q.n, o.w(p)) }); }
    return rootAt.get(key);
  };
  for (let k = closed ? 0 : -1; k < n; k++) {
    let fa = (k + ph) / n, fb = (k + 1 + ph) / n;
    if (!closed) { fa = Math.max(0, fa); fb = Math.min(1, fb); if (fb - fa < 0.35 / n) continue; }
    const ra = root(fa), rb = root(fb), a = ra.q, b = rb.q;
    const nn = unit(add(a.n, b.n)), mid = lerp(a.p, b.p, 0.5);
    let d = unit(a.d ?? b.d ?? o.down ?? [0, -1, 0]);
    // (the fall laid along the surface, then curled out)
    if (!o.stand) d = unit(sub(d, mul(nn, dot(d, nn))));
    const kk = k + 1000;
    const L = typeof o.len === 'function' ? o.len(kk, mid) : o.len, c = typeof o.curl === 'function' ? o.curl(kk, mid) : o.curl ?? 0.04;
    const lean = (o.lean ?? 0.25) * (hash(kk, 7) - 0.5) * L;
    const side = unit(sub(b.p, a.p));
    const tip = add(add(mid, mul(d, L)), add(mul(nn, c), mul(side, lean)));
    // (its tip weighted as the pelt where the tip hangs, so a lock hung over the neck goes with the neck)
    const w = o.w(lerp(mid, tip, o.tipW ?? 0.7));
    const ma = add(lerp(a.p, tip, split), mul(nn, c * split * 0.5)), mb = add(lerp(b.p, tip, split), mul(nn, c * split * 0.5));
    const ja = put(ma, nn, w), jb = put(mb, nn, w), jt = put(tip, nn, w);
    const tones = o.mat ? o.mat(kk, mid) : [o.root, o.tip];
    if (tones.length === 3) {
      // (three tones: the dark root, the guard hair's middle band, the pale tip; the band narrowed toward the tip)
      const [mr, mm, mt] = tones, s2 = 0.82;
      const na = put(add(lerp(ma, tip, (s2 - split) / (1 - split)), mul(nn, c * 0.1)), nn, w), nb = put(add(lerp(mb, tip, (s2 - split) / (1 - split)), mul(nn, c * 0.1)), nn, w);
      if (mr !== null) face(P, [ra.i, rb.i, jb, ja], nn, mr);
      if (mm !== null) face(P, [ja, jb, nb, na], nn, mm);
      if (mt !== null) face(P, [na, nb, jt], nn, mt);
    } else {
      const [mr, mt] = tones;
      if (mr !== null) face(P, [ra.i, rb.i, jb, ja], nn, mr);
      if (mt !== null) face(P, [ja, jb, jt], nn, mt);
    }
  }
  return P;
}
/**
 * A shaggy pelt over a field (a wrap: `G.ta(t, a)`): rows of locks from `t1` down to `t0` (the field's own way along,
 * `rows` of them), each row between `a0(t)` and `a1(t)` round it (or all round where `closed`), `per` locks to a unit of
 * length, each lock long enough to lap the row below (`lap`), off the field by `off(t, a)`. The rows staggered; the
 * tones `mat(k, row, p)`: [root, tip]. The lowest row hangs past `t0` (its fringe). Every point weighted `w(p)`.
 */
export function pelt(G, o) {
  const out = [], down = Math.sign(o.t0 - o.t1);
  for (let r = 0; r < o.rows; r++) {
    const tr = o.t1 + ((o.t0 - o.t1) * r) / o.rows, a0 = o.a0 ? o.a0(tr) : -PI, a1 = o.a1 ? o.a1(tr) : PI;
    const steps = Math.max(4, Math.round(Math.abs(a1 - a0) * 8));
    let path = [...Array(steps + 1).keys()].map((j) => {
      const a = a0 + ((a1 - a0) * j) / steps, q = G.ta(tr, a), q2 = G.ta(tr + (o.t0 - o.t1) / o.rows * 1.2, a), d = unit(add(sub(q2.p, q.p), mul(q.n, 0.02)));
      return { p: add(q.p, mul(q.n, o.off(tr, a))), n: q.n, d: o.fall ? unit(o.fall(q.p, d, q.n)) : d };
    });
    let L = 0;
    for (let k = 1; k < path.length; k++) L += len(sub(path[k].p, path[k - 1].p));
    const count = Math.max(3, Math.round(L * o.per));
    if (o.closed) path = path.slice(0, -1);
    // (a row's step along the field, as a length: its locks reach past the row below by `lap`)
    const am = (a0 + a1) / 2, dy = len(sub(G.ta(tr, am).p, G.ta(tr + (o.t0 - o.t1) / o.rows, am).p));
    out.push(locks(path, {
      count, closed: !!o.closed, w: o.w, lift: 0, phase: (r % 2) * -0.5 + (hash(r, 11) - 0.5) * 0.2,
      len: (k, p) => Math.min(o.maxLen ? o.maxLen(p) : Infinity, dy * (1 + (o.lap ?? 0.6)) * (r === o.rows - 1 ? (0.6 + 0.8 * hash(k + 31 * r, r)) * (o.fringe ?? 1.3) : 0.7 + 0.6 * hash(k + 31 * r, r))),
      curl: (k) => (o.curl ?? 0.05) * (0.6 + 0.8 * hash(k, r + 3)),
      mat: (k, p) => o.mat(k, r, p),
      lean: o.lean, split: o.split, tipW: o.tipW,
    }));
  }
  return merge(...out);
}

/* ---- bone, horn, sinew --------------------------------------------------------------------------------------------- */
/** A cone from a base round `c` (radius `r`, `k` sides, square to `dir`) to a point `L` along `dir`, bent `bend` toward `toward`. */
export function cone(c, dir, o) {
  const P = part(), k = o.k ?? 4, d = unit(dir), up = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const x = unit(cross(up, d)), y = cross(d, x), w = o.w(c);
  const put = (p) => { P.V.push(p); P.N.push(d); P.W.push(w); return P.V.length - 1; };
  const bend = o.toward ? mul(unit(o.toward), (o.bend ?? 0.3) * o.L) : [0, 0, 0];
  const mid = add(add(c, mul(d, o.L * 0.5)), mul(bend, 0.35));
  const r0 = [...Array(k).keys()].map((j) => { const a = (j / k) * TAU + (o.turn ?? 0); return put(add(c, add(mul(x, Math.cos(a) * o.r), mul(y, Math.sin(a) * o.r)))); });
  const r1 = [...Array(k).keys()].map((j) => { const a = (j / k) * TAU + (o.turn ?? 0); return put(add(mid, add(mul(x, Math.cos(a) * o.r * 0.6), mul(y, Math.sin(a) * o.r * 0.6)))); });
  const tip = put(add(add(c, mul(d, o.L)), bend));
  for (let j = 0; j < k; j++) {
    const j1 = (j + 1) % k, m = mul(add(add(P.V[r0[j]], P.V[r0[j1]]), add(P.V[r1[j]], P.V[r1[j1]])), 0.25);
    face(P, [r0[j], r0[j1], r1[j1], r1[j]], sub(m, add(c, mul(d, o.L * 0.25))), o.mat);
    face(P, [r1[j], r1[j1], tip], sub(lerp(P.V[r1[j]], P.V[tip], 0.5), mid), o.tipMat ?? o.mat);
  }
  if (o.cap) { const cc = put(c); for (let j = 0; j < k; j++) face(P, [r0[j], r0[(j + 1) % k], cc], mul(d, -1), o.mat); }
  return P;
}
/** A bead: a small ball of `k` sides and three rings, `r` round, on `c`, its axis along `ax`. */
export function bead(c, ax, o) {
  const P = part(), k = o.k ?? 5, d = unit(ax), up = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const x = unit(cross(up, d)), y = cross(d, x), w = o.w(c), r = o.r, h = o.h ?? r;
  const put = (p) => { P.V.push(p); P.N.push(unit(sub(p, c))); P.W.push(w); return P.V.length - 1; };
  const ringAt = (z, rr) => [...Array(k).keys()].map((j) => { const a = (j / k) * TAU; return put(add(add(c, mul(d, z)), add(mul(x, Math.cos(a) * rr), mul(y, Math.sin(a) * rr)))); });
  const top = put(add(c, mul(d, h))), bot = put(add(c, mul(d, -h)));
  const mid = ringAt(0, r);
  for (let j = 0; j < k; j++) {
    const j1 = (j + 1) % k;
    face(P, [mid[j], mid[j1], top], sub(lerp(P.V[mid[j]], P.V[top], 0.5), c), o.mat);
    face(P, [mid[j1], mid[j], bot], sub(lerp(P.V[mid[j]], P.V[bot], 0.5), c), o.mat);
  }
  return P;
}
/**
 * Sinew stitching along a seam (a path with its normals): a cord laced in a zigzag `wide` across it, `count` stitches,
 * lifted `lift` off it.
 */
export function stitch(path, o) {
  const E = even(path, o.count * 2);
  const pts = E.map((q, k) => {
    const nx = E[Math.min(E.length - 1, k + 1)].p, pv = E[Math.max(0, k - 1)].p, t = unit(sub(nx, pv)), s = unit(cross(q.n, t));
    return { p: add(add(q.p, mul(q.n, o.lift ?? 0.02)), mul(s, (k % 2 ? 1 : -1) * o.wide * 0.5)), n: q.n };
  });
  return tube(pts, { r: o.r ?? 0.022, k: 3, mat: o.mat, w: o.w });
}
/**
 * A rosette laid on a surface (`at(x, y)`: the point and normal `x` across and `y` up from its middle): a broken ring of
 * `spots` dark spots `R` round, each its own sheet, and a fawn middle; lifted `lift` off the surface.
 */
export function rosette(at, o) {
  const P = part(), R = o.R, lift = o.lift ?? 0.02, put = (p, n, w) => { P.V.push(p); P.N.push(n); P.W.push(w); return P.V.length - 1; };
  const spot = (cx, cy, rx, ry, rot, mat, k = 5) => {
    const c = at(cx, cy), w = o.w(c.p), ci = put(add(c.p, mul(c.n, lift)), c.n, w);
    const ring = [...Array(k).keys()].map((j) => { const a = (j / k) * TAU, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry, x = ex * Math.cos(rot) - ey * Math.sin(rot), y = ex * Math.sin(rot) + ey * Math.cos(rot), q = at(cx + x, cy + y); return put(add(q.p, mul(q.n, lift)), q.n, w); });
    for (let j = 0; j < k; j++) face(P, [ring[j], ring[(j + 1) % k], ci], c.n, mat);
  };
  const n = o.spots ?? 5, gap = o.gap ?? 0.5;
  if (o.middle) spot(0, 0, R * 0.72, R * 0.62, 0, o.middle, 7);
  for (let s = 0; s < n; s++) {
    if (o.open && s === n - 1) continue;
    const a = o.turn + (s / n) * TAU, arc = (TAU / n) * (1 - gap);
    spot(Math.cos(a) * R, Math.sin(a) * R, arc * R * 0.62, R * (o.thick ?? 0.34), a + PI / 2, o.mat, 6);
  }
  return P;
}

/**
 * A part kept clear of the skin: each point nearer the skin samples `pick` chooses than `margin` (measured along the
 * nearest sample's normal) moved out along it to that margin. Locks whose tips would dip into the body under them.
 */
export function clear(B, P, margin = 0.06, pick = () => true) {
  const S = skinSamples(B).filter(pick);
  const cell = 0.4, grid = new Map(), key = (x, y, z) => `${x},${y},${z}`;
  for (const s of S) { const k = key(Math.floor(s.p[0] / cell), Math.floor(s.p[1] / cell), Math.floor(s.p[2] / cell)); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(s); }
  P.V = P.V.map((p) => {
    const cx = Math.floor(p[0] / cell), cy = Math.floor(p[1] / cell), cz = Math.floor(p[2] / cell);
    let best = null, bd = Infinity;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) for (const s of grid.get(key(cx + i, cy + j, cz + k)) ?? []) { const d = len(sub(s.p, p)); if (d < bd) { bd = d; best = s; } }
    if (!best) return p;
    const h = dot(sub(p, best.p), best.n);
    return h < margin ? add(p, mul(best.n, margin - h)) : p;
  });
  return P;
}
