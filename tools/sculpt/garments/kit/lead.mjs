// The lead set's own builders (tools/sculpt/garments/lead.mjs), on the plate kit (../platekit.mjs):
//
//   * a tower (`tower`): a body of revolution about an upright axis, its rows a profile of heights and scales of one
//     cross-section (`section(a)`: its reach at angle a round the axis, nought the front), its rows and columns at the
//     heights and angles given (so an opening's edges fall on them); a great helm, a bastion.
//   * merlons (`merlons`): blocks standing on a ring (a parapet's top), each a closed solid over its arc.
//   * a curtain wall (`curtainWall`): a level wall across the front or back of the body, its plan a parabola fitted
//     round the points it must clear; its face to lay a gate, merlons and banners on.
//   * a block (`block`): a box from a centre and three half-axes, as a solid (a corbel, a seal's tab, a stone).
//   * courses (`coursesOn`): the vertical joints of a course of stones on a plate grid, staggered course to course, as
//     sunken bands laid on it.
import { add, sub, mul, unit, cross, lerp, len } from '../metalkit.mjs';
import { patch, gridOf, solid, band, stud, sweep } from '../platekit.mjs';

const TAU = Math.PI * 2;
/** Angles from -pi to pi, `n` even steps with `keep` inserted (each kept exactly; a step nearer than `gap` to one dropped). */
export function anglesWith(n, keep = [], gap = 0.03) {
  const base = [...Array(n).keys()].map((j) => -Math.PI + (TAU * j) / n).filter((a) => keep.every((k) => Math.abs(a - k) > gap));
  return [...base, ...keep].sort((a, b) => a - b);
}
/**
 * A tower about the axis through `c` (x, z) going up y: rows `rows` ([y, scale, inset] each: its height, the
 * cross-section's scale there, and how far in from it), columns at the angles `A` (nought the front +z, toward +x),
 * each point at `section(a) * scale - inset` from the axis. Its grid (closed round) with `Y`, `A` kept.
 */
export function tower(c, rows, A, section) {
  const P = rows.map(([yy, k, inset = 0]) => A.map((a) => { const r = Math.max(0, section(a) * (typeof k === 'function' ? k(a) : k) - inset); return [c[0] + Math.sin(a) * r, typeof yy === 'function' ? yy(a) : yy, c[2] + Math.cos(a) * r]; }));
  const G = gridOf(P, { closed: true, out: (i, j) => [Math.sin(A[j]), 0, Math.cos(A[j])] });
  G.Y = rows.map((r) => (typeof r[0] === 'function' ? r[0](0) : r[0])); G.A = A;
  return G;
}
/** The column of a grid at angle `a` (its columns `G.A`), fractional. */
export function colAt(G, a) {
  const A = G.A, n = A.length;
  const x = Math.atan2(Math.sin(a), Math.cos(a));
  for (let j = 0; j < n; j++) {
    const a0 = A[j], a1 = j + 1 < n ? A[j + 1] : A[0] + TAU;
    const xx = x < a0 ? x + TAU : x;
    if (xx >= a0 && xx <= a1) return j + (xx - a0) / (a1 - a0);
  }
  return 0;
}
/** The row of a grid at height `yy` (its rows `G.Y`, going up), fractional. */
export function rowAt(G, yy) {
  const Y = G.Y;
  for (let i = 0; i + 1 < Y.length; i++) if ((yy - Y[i]) * (yy - Y[i + 1]) <= 0 && Y[i] !== Y[i + 1]) return i + (yy - Y[i]) / (Y[i + 1] - Y[i]);
  return yy < Y[0] ? 0 : Y.length - 1;
}
/**
 * Merlons on a ring: `count` blocks round the axis through `c`, centred from angle `a0`, each `frac` of its share of the
 * turn wide, from height `y0` up `h`, from radius `r(a)` in `thick`; `skip(k)` leaves one out. Solids in `mat`, edges `edge`.
 */
export function merlons(c, o) {
  const out = [];
  for (let k = 0; k < o.count; k++) {
    if (o.skip?.(k)) continue;
    const mid = (o.a0 ?? 0) + (TAU * k) / o.count, half = (Math.PI / o.count) * (o.frac ?? 0.55);
    const G = patch((u, v) => {
      const a = mid - half + 2 * half * v, yy = o.y0 + o.h * u, r = o.r(a);
      return { p: [c[0] + Math.sin(a) * r, yy, c[2] + Math.cos(a) * r], n: [Math.sin(a), 0, Math.cos(a)] };
    }, 1, o.cols ?? 2);
    out.push(solid(G, { w: o.w, thick: o.thick, mat: () => o.mat, inner: o.inner ?? o.mat, edge: o.edge ?? o.mat }));
  }
  return out;
}
/**
 * A box: centre `c`, half-axes `X`, `Y`, `Z` (vectors), a solid in `mat` with its sides `edge` (Y the box's "up": its top
 * and bottom are the faces along Y... all six closed).
 */
export function block(c, X, Y, Z, o) {
  const G = patch((u, v) => {
    const p = add(add(c, mul(Y, 2 * u - 1)), add(mul(X, 2 * v - 1), Z));
    return { p, n: unit(Z) };
  }, 1, 1);
  return solid(G, { w: o.w, thick: 2 * len(Z), mat: () => o.mat, inner: o.inner ?? o.mat, edge: o.edge ?? o.mat });
}
/**
 * A seal: a round disc facing `n` at `c`, radius `r`, `thick` deep, its face sunk in a ring (`ring` its rim's material)
 * and an impression in its middle (`mark`), `k` sides.
 */
export function seal(c, n, o) {
  const nn = unit(n), x = unit(cross(Math.abs(nn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], nn)), y = cross(nn, x), k = o.k ?? 8;
  const G = patch((u, v) => {
    const a = v * TAU, rr = o.r * [0.001, 0.45, 0.78, 1][Math.round(u * 3)], h = [0.0, 0.0, -0.015, 0][Math.round(u * 3)];
    return { p: add(add(c, mul(nn, h)), add(mul(x, Math.cos(a) * rr), mul(y, Math.sin(a) * rr))), n: nn };
  }, 3, k, { closed: true });
  return solid(G, { w: o.w, thick: o.thick ?? 0.06, mat: (i) => (i === 0 ? o.mark : i === 1 ? o.mat : o.ring ?? o.mat), inner: o.mat, edge: o.ring ?? o.mat });
}
export { lerp, sub, band, stud };
/**
 * Merlons along a wall's top: `count` blocks between angles `a0` and `a1` (`top(a)`: the wall's top there, { p, n } with
 * n its outward horizontal), each `frac` of its share wide, `h` high, `thick` deep (inward from the face).
 */
export function merlonsAlong(top, o) {
  const out = [], step = (o.a1 - o.a0) / o.count;
  for (let k = 0; k < o.count; k++) {
    const mid = o.a0 + step * (k + 0.5), half = (step / 2) * (o.frac ?? 0.55);
    const G = patch((u, v) => { const q = top(mid - half + 2 * half * v); return { p: add(q.p, [0, o.h * u, 0]), n: q.n }; }, 1, o.cols ?? 2);
    out.push(solid(G, { w: o.w, thick: o.thick, mat: () => o.mat, inner: o.inner ?? o.mat, edge: o.edge ?? o.mat }));
  }
  return out;
}
/** How far from the axis through (0, z0) the points `pts` reach at angle `a` (within `da` of it; nought the front, toward +x). */
export function reachOf(pts, z0, da = 0.18) {
  const P = pts.map((p) => ({ a: Math.atan2(p[0], p[2] - z0), r: Math.hypot(p[0], p[2] - z0) }));
  return (a) => P.reduce((m, q) => (Math.abs(Math.atan2(Math.sin(q.a - a), Math.cos(q.a - a))) < da && q.r > m ? q.r : m), 0);
}
/** A joint between stones: a strip `wide` across standing `high` off a path, its underside and ends left open (nothing sees them). */
export const joint = (path, o) => sweep(path, { ...o, caps: false, profile: [[-o.wide / 2, -0.01], [-o.wide / 2, o.high], [o.wide / 2, o.high], [o.wide / 2, -0.01]] });
/** A bloom of white oxide: a flat irregular patch `r` across lying on `c` facing `n` (lifted `lift`), in `mat`. */
export function bloom(c, n, o) {
  const nn = unit(n), x = unit(cross(Math.abs(nn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], nn)), y = cross(nn, x), k = 7, seed = o.seed ?? 1;
  const G = patch((u, v) => {
    const a = v * Math.PI * 2, j = Math.round(v * k), rr = o.r * u * (0.65 + 0.35 * Math.abs(Math.sin(j * 2.3 + seed * 1.7))) * (o.sx ?? 1);
    return { p: add(add(c, mul(nn, o.lift ?? 0.012)), add(mul(x, Math.cos(a) * rr), mul(y, Math.sin(a) * rr * (o.sy ?? 1)))), n: nn };
  }, 1, k, { closed: true });
  return solid(G, { sheet: true, w: o.w, mat: () => o.mat ?? 'pbO' });
}
/**
 * A curtain wall across the front (`face` 1, facing +z) or the back (`face` -1) of the body: level, from `x0` to `x1`,
 * from height `y0` to `y1`, its plan a parabola z(x) = a - face * b * x * x fitted round the points `pts` (as near as
 * `clear` to the farthest of them anywhere along it, its inside face too), `th` thick (inward). Returns the wall's solid, its grid, `z(x)` and
 * `at(x, y, lift)` ({ p, n } on its face).
 */
export function curtainWall(pts, o) {
  const face = o.face, N = 24, xs = [...Array(N + 1).keys()].map((k) => o.x0 + ((o.x1 - o.x0) * k) / N);
  // (the farthest point out at each x, within the wall's height)
  const need = xs.map((x) => pts.reduce((m, p) => (Math.abs(p[0] - x) < 0.12 && p[1] > o.y0 - 0.05 && p[1] < o.yReach && p[2] * face > 0 ? Math.max(m, p[2] * face) : m), -9)).map((z, k) => [xs[k], z]).filter(([, z]) => z > -9);
  // (the curve: its bend fitted to how the body falls away at the sides, never bending outward)
  const mx = need.reduce((s, [x]) => s + x * x, 0) / need.length, mz = need.reduce((s, [, z]) => s + z, 0) / need.length;
  const cov = need.reduce((s, [x, z]) => s + (x * x - mx) * (z - mz), 0), vr = need.reduce((s, [x]) => s + (x * x - mx) ** 2, 0) || 1;
  const b = Math.max(0, Math.min(o.maxBend ?? 0.4, -(cov / vr) * (o.bend ?? 0.8)));
  const a = Math.max(...need.map(([x, z]) => z + b * x * x)) + o.clear + o.th;
  const z = (x) => face * (a - b * x * x), dz = (x) => -face * 2 * b * x;
  const nrm = (x) => unit([-dz(x) * face, 0, face]);
  const G = patch((u, v) => { const x = o.x0 + (o.x1 - o.x0) * v; return { p: [x, o.y0 + (o.y1 - o.y0) * u, z(x)], n: nrm(x) }; }, o.nu ?? 2, o.nv ?? 16);
  const S = solid(G, { w: o.w, thick: o.th, mat: o.mat, inner: o.inner ?? 'pbS', edge: o.edge ?? 'pbS' });
  const at = (x, yy, lift = 0) => ({ p: add([x, yy, z(x)], mul(nrm(x), lift)), n: nrm(x) });
  return { S, G, z, at, a, b };
}
