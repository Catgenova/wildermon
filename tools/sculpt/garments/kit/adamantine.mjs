// The adamantine set's own builders (tools/sculpt/garments/adamantine.mjs), on the plate kit (../platekit.mjs): plate cut
// as a gem is, in flat facets meeting at hard edges, rather than the smooth plates of the kit's wraps.
//
//   * a hull (`hull`): a convex polygon round points (a plan: [x, z] pairs), its sides square to the angles given, each
//     side as far out as the farthest point that way and a margin more; read round with `reachOf` (its radius at an
//     angle) so a grid laid on it keeps its sides flat.
//   * a facet grid (`facetGrid`): rows and columns each placed by a function on a hull (a height, an angle, a scale and
//     an offset), about an upright axis: a helm's skull, a cheek plate, a greave. Its quads lie flat on the hull's sides
//     wherever its columns fall on the hull's corners, so the light breaks on the corners and nowhere else.
//   * fitting (`fitScales`): the rows of a tower of one hull scaled out until every point given is inside it by a
//     margin (a helm round the head, nothing poking through).
//   * a gem (`gem`): a closed bipyramid or table cut (a finial, a bead, a boss, a stud of more than one facet).
//   * a fan (`fan`): a ring closed to a point (a tower's top).
//   * a zigzag (`zigzag`): a path's points thrown either side of it by turns (knotwork, as a gilt chevron band).
//   * a frame (`frameAt`, `inFrame`): a point and a facing made into axes, for pieces built flat and set on the body.
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, part } from '../metalkit.mjs';
import { gridOf, face, shareW, torsoMiddle, torsoWrap } from '../platekit.mjs';

export const PI = Math.PI, TAU = PI * 2;
/** How much of weights `w` are on the head and the jaw themselves. */
export const headW = (B, w) => w.reduce((t, [b, x]) => t + (B.bones[b].name === 'head' || B.bones[b].name === 'jaw' ? x : 0), 0);
/** A direction in the plan at angle `a` (nought the front, +z; toward +x, the body's left). */
export const dirOf = (a) => [Math.sin(a), 0, Math.cos(a)];

/**
 * A convex polygon in the plan round the points `pts` ([x, z] each, about the axis), `n` sides, the first corner at angle
 * `a0` (its sides square to the angles half a step either side of each corner), each side `margin(b)` out past the
 * farthest point along its normal b. Its corners, in turn, as [x, z].
 */
export function hull(pts, n, { a0 = 0, margin = () => 0, stretch = () => 1 } = {}) {
  const step = TAU / n, B = [...Array(n).keys()].map((k) => a0 + (k - 0.5) * step);
  const h = B.map((b) => Math.max(...pts.map(([x, z]) => x * Math.sin(b) + z * Math.cos(b))) * stretch(b) + margin(b));
  return B.map((b, k) => {
    const k1 = (k + 1) % n, b1 = B[k1], a1 = Math.sin(b), c1 = Math.cos(b), a2 = Math.sin(b1), c2 = Math.cos(b1), det = a1 * c2 - a2 * c1;
    return [(h[k] * c2 - h[k1] * c1) / det, (a1 * h[k1] - a2 * h[k]) / det];
  });
}
/** A polygon's radius at angle `a` from its middle (its corners [x, z] about the axis): where the ray that way leaves it. */
export function reachOf(C, a) {
  const d = [Math.sin(a), Math.cos(a)];
  let best = 0;
  for (let k = 0; k < C.length; k++) {
    const p = C[k], q = C[(k + 1) % C.length], e = [q[0] - p[0], q[1] - p[1]];
    // (p + t e = r d)
    const det = e[0] * -d[1] - e[1] * -d[0];
    if (Math.abs(det) < 1e-12) continue;
    const t = (-p[0] * -d[1] - -p[1] * -d[0]) / det, r = (e[0] * -p[1] - e[1] * -p[0]) / det;
    if (t >= -1e-9 && t <= 1 + 1e-9 && r > best) best = r;
  }
  return best;
}
/** A hull's corners' angles, from -pi to pi. */
export const cornersOf = (C) => C.map(([x, z]) => Math.atan2(x, z));

/**
 * A grid on hulls about an upright axis through `c` (x, z): `nu` + 1 rows (u nought to one) of `nv` + 1 columns (v nought
 * to one; `closed`: `nv` going round), each `fn(u, v)` its { a: angle, y: height, k: the hull's scale, off: out past it,
 * C: the hull (else `C` given) }; the point the hull's at that angle and height, scaled and pushed out. Its normals out
 * from the axis. `G.A` the columns' angles at the first row.
 */
export function facetGrid(c, nu, nv, fn, { C = null, closed = false } = {}) {
  const cols = closed ? nv : nv + 1;
  const Q = [...Array(nu + 1).keys()].map((i) => [...Array(cols).keys()].map((j) => {
    const q = fn(i / nu, j / nv), H = q.C ?? C, r = reachOf(H, q.a) * (q.k ?? 1) + (q.off ?? 0);
    return { p: [c[0] + Math.sin(q.a) * r, q.y, c[2] + Math.cos(q.a) * r], a: q.a };
  }));
  const G = gridOf(Q.map((row) => row.map((q) => q.p)), { closed, out: (i, j) => dirOf(Q[i][j].a) });
  G.A = Q[0].map((q) => q.a);
  return G;
}
/**
 * The scales of a tower's rows (heights `Y`, rising or falling; scales `K`) of the hull `C` about `c` made at least as
 * large as needed for every point `pts` between two rows to lie inside it by `margin` (each such point's need given to
 * the two rows either side, by how near it is to each). Returns the scales.
 */
export function fitScales(pts, c, C, Y, K, margin = 0.08) {
  const out = K.slice();
  for (let pass = 0; pass < 30; pass++) {
    let worst = 0;
    for (const p of pts) {
      const x = p[0] - c[0], z = p[2] - c[2], r = Math.hypot(x, z), a = Math.atan2(x, z), R = reachOf(C, a);
      for (let i = 0; i + 1 < Y.length; i++) {
        const lo = Math.min(Y[i], Y[i + 1]), hi = Math.max(Y[i], Y[i + 1]);
        if (p[1] < lo || p[1] > hi || hi - lo < 1e-6) continue;
        const f = (p[1] - Y[i]) / (Y[i + 1] - Y[i]), k = out[i] + (out[i + 1] - out[i]) * f, need = (r + margin) / R;
        if (need > k + 1e-4) { const d = need - k; out[i] += d; out[i + 1] += d; worst = Math.max(worst, d); }
      }
    }
    if (worst < 1e-4) break;
  }
  return out;
}

/** A ring of points closed to an apex: triangles from each edge of `ring` (point indices in `P`) to `apex`, facing `n`. */
export function fan(P, ring, apex, n, mat) {
  for (let k = 0; k < ring.length; k++) face(P, [ring[k], ring[(k + 1) % ring.length], apex], n, mat);
  return P;
}
const put = (P, p, n, w) => { P.V.push(p); P.N.push(n); P.W.push(w); return P.V.length - 1; };
/**
 * A gem on point `c` along `n`: `k` sided, its girdle `r` across at `h0` up, its crown rising to a table `r * table`
 * across at `h` (or a point: table nought), its pavilion going down to a point `below` under it (nought: a flat foot);
 * `twist` turns it round its axis. Each part its material: `mat`, `crown` (the facets above the girdle), `top` (the
 * table; the crown's unless given).
 */
export function gem(c, n, o) {
  const P = part(), k = o.k ?? 6, r = o.r, h = o.h ?? r, h0 = o.h0 ?? h * 0.35, tb = o.table ?? 0.45, below = o.below ?? 0, w = o.w(c);
  const nn = unit(n), x0 = unit(cross(Math.abs(nn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], nn)), y0 = cross(nn, x0);
  const tw = o.twist ?? 0, x = add(mul(x0, Math.cos(tw)), mul(y0, Math.sin(tw))), yv = cross(nn, x);
  const ring = (rr, hh) => [...Array(k).keys()].map((j) => { const a = (j / k) * TAU; return put(P, add(c, add(mul(nn, hh), add(mul(x, Math.cos(a) * rr * (o.sx ?? 1)), mul(yv, Math.sin(a) * rr)))), nn, w); });
  const foot = ring(r * (o.foot ?? 0.85), 0), girdle = ring(r, h0), top = tb > 0 ? ring(r * tb, h) : null;
  const mid = add(c, mul(nn, h * 0.5)), m = o.mat, cm = o.crown ?? m;
  const quad = (a, b, mat) => { for (let j = 0; j < k; j++) { const j1 = (j + 1) % k, v = [a[j], a[j1], b[j1], b[j]], q = mul(v.reduce((s, i) => add(s, P.V[i]), [0, 0, 0]), 0.25); face(P, v, sub(q, mid), mat); } };
  quad(foot, girdle, m);
  if (top) {
    quad(girdle, top, cm);
    const tc = put(P, add(c, mul(nn, h)), nn, w);
    fan(P, top, tc, nn, o.top ?? cm);
  } else fan(P, girdle, put(P, add(c, mul(nn, h)), nn, w), nn, cm);
  if (below > 0) fan(P, foot, put(P, add(c, mul(nn, -below)), mul(nn, -1), w), mul(nn, -1), m);
  return P;
}
/** A path (points `p` with normals `n`) thrown `amp` either side of itself by turns, `per` points to a turn: a zigzag. */
export function zigzag(path, amp, per = 1) {
  return path.map((q, k) => {
    const prev = path[Math.max(0, k - 1)].p, next = path[Math.min(path.length - 1, k + 1)].p, t = unit(sub(next, prev)), side = unit(cross(q.n, t));
    const s = Math.floor(k / per) % 2 === 0 ? 1 : -1;
    return { p: add(q.p, mul(side, amp * s)), n: q.n };
  });
}
/** Axes at a point facing `n`: x square to it (level where it can be: across the body), y up the face, n out. */
export function frameAt(c, n, x0 = [0, 1, 0]) {
  const nn = unit(n), x = unit(cross(Math.abs(dot(x0, nn)) < 0.95 ? x0 : [1, 0, 0], nn)), y = cross(nn, x);
  return { o: c, x, y, n: nn };
}
/** A point in a frame: `u` across, `v` up, `h` out. */
export const inFrame = (F, u, v, h = 0) => add(F.o, add(add(mul(F.x, u), mul(F.y, v)), mul(F.n, h)));
/**
 * A flat plate in a frame from an outline (`outline(v)`: [u, w] at v nought to one round it) closed to its middle,
 * `rings` rings in from its rim, dished `dish(f)` out at f of the way in (nought at the rim, one the middle): a plaque,
 * a boss's face. Returns a grid (rows from the middle out, closed columns).
 */
export function plaqueGrid(F, outline, nv, rings, dish = () => 0) {
  const P = [];
  for (let i = 0; i <= rings; i++) {
    const f = 1 - i / rings, row = [];
    for (let j = 0; j < nv; j++) { const [u, w] = outline(j / nv); row.push(inFrame(F, u * (1 - f * 0.999), w * (1 - f * 0.999), dish(f))); }
    P.push(row);
  }
  return gridOf(P, { closed: true, out: () => F.n });
}
export { lerp, clamp, len };

/* ---- the torso: its landmarks and its skin as a field ------------------------------------------------------------ */
export const TORSO_BONES = new Set(['root', 'pelvis', 'spine_01', 'spine_02', 'spine_03']);
/** The landmarks' heights the torso pieces are cut to. */
export function torsoMarks(B) {
  const A = B.at, sh = A.shoulder.l[1], waist = lerp(A.spine1, A.pelvis, 0.45)[1];
  return { neckF: lerp(A.neck, A.chest, 0.47)[1], neckB: lerp(A.neck, A.chest, 0.36)[1], pit: sh - 0.92, waist, hip: A.hip.l[1] };
}
const FIELDS = new WeakMap();
/** The torso's skin as a wrap round its middle line from mid-thigh to above the neck (platekit torsoWrap). */
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
/**
 * A rune drawn as strokes on a face: each stroke a pair of points in a frame's [u, v] (scaled by `s`), swept as a flat
 * band `wide` across and `high` proud, in `mat`. Algiz (the warding rune), othala (the hold), and the mountain.
 */
export const RUNES = {
  algiz: [[[0, -1], [0, 1]], [[0, 0.15], [-0.62, 0.85]], [[0, 0.15], [0.62, 0.85]]],
  othala: [[[-0.6, -1], [0.45, 0.05]], [[0.6, -1], [-0.45, 0.05]], [[-0.45, 0.05], [0, 0.62]], [[0.45, 0.05], [0, 0.62]], [[0, 0.62], [0, 0.62]]],
  mountain: [[[-0.9, -0.7], [-0.35, 0.55]], [[-0.35, 0.55], [0, 0]], [[0, 0], [0.4, 0.85]], [[0.4, 0.85], [0.9, -0.7]]],
  gate: [[[-0.9, -0.7], [-0.35, 0.55]], [[-0.35, 0.55], [0, 0.1]], [[0, 0.1], [0.4, 0.85]], [[0.4, 0.85], [0.9, -0.7]], [[-0.25, -1], [-0.25, -0.35]], [[0.25, -1], [0.25, -0.35]], [[-0.25, -0.35], [0.25, -0.35]]],
  dagaz: [[[-0.7, -0.9], [-0.7, 0.9]], [[0.7, -0.9], [0.7, 0.9]], [[-0.7, 0.9], [0.7, -0.9]], [[-0.7, -0.9], [0.7, 0.9]]],
  ingwaz: [[[0, -1], [0.6, -0.4]], [[0.6, -0.4], [0, 0.2]], [[0, 0.2], [-0.6, -0.4]], [[-0.6, -0.4], [0, -1]], [[0, 0.2], [0.6, 0.8]], [[0, 0.2], [-0.6, 0.8]]],
};
export function runeOn(F, name, s, o) {
  const out = [];
  for (const [a, b] of RUNES[name]) {
    if (a[0] === b[0] && a[1] === b[1]) continue;
    const pa = inFrame(F, a[0] * s, a[1] * s, 0), pb = inFrame(F, b[0] * s, b[1] * s, 0), d = unit(sub(pb, pa));
    const ext = (o.wide ?? 0.05) * 0.4;
    out.push(o.sweep([{ p: sub(pa, mul(d, ext)), n: F.n }, { p: add(pb, mul(d, ext)), n: F.n }], { closedProfile: true, mat: o.mat, w: o.w, profile: [[-(o.wide ?? 0.05) / 2, -(o.sink ?? 0.01)], [(o.wide ?? 0.05) / 2, -(o.sink ?? 0.01)], [(o.wide ?? 0.05) / 2, o.high ?? 0.02], [-(o.wide ?? 0.05) / 2, o.high ?? 0.02]] }));
  }
  return out;
}
