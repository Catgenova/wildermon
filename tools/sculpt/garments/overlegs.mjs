// Each chest piece's waist and skirt fitted over every legs piece worn under it (garments/chestlegs.mjs LEGS_ITEMS: the
// items' legs garments as the game wears them under that chest, their game copies at rest), so no legs piece shows
// through the chest or in its gaps, and the skirt moves with the thighs. Called by each chest's builder once its
// weights (`vw`) are set, before its game copy is written:
//
//   overLegs(rig, G, chestKey, o = OVER_LEGS[chestKey][who]) → G (chestKey: chestlegs.mjs CHESTS' key)
//
// 1. The follow (o.follow: { top, full }): the lower part's weights (not the arms') blended toward the body's under it
//    (lowgarment.mjs transferWeights), none at `top`, wholly from `full` down, so the skirt moves with the thighs.
// 2. The fit: the chest's lower part (below the legs pieces' top, and `top` above it) sampled (its vertices and points
//    across each triangle `step` apart); at each point the chest is outermost (no more of it out along the body's normal,
//    nor tilted to either side or up toward the camera), the most any legs piece stands out past it, out along the
//    body's normal from the point's closest point on the body (within `near` past it) or out from the hips' vertical
//    axis, plus `clr`, is its need; each vertex is pushed out from the axis by the most need near it, less `slope` a
//    unit of distance, so each plate with its rim and edge moves together. Again (`rounds`) until none is left.
// 3. The liner (o.liner: { top, low, mat, arc }): a band round the hips (or, `arc`, at the sides only) in the chest's own under-layer (`mat`) from `top` down
//    to `low` (a height, or heights by azimuth), at the reach of the body and every legs piece round the axis (the hull of
//    their points in a slab) out by `clr`, but never out past the chest's innermost layer there (less `eps`), nor in to
//    the body. Under the plates it is out of sight; in the chest's gaps (between its plates and panels, at its back's
//    waist) it is what is seen, not the legs or the skin. Skinned as the body under it. Laid once the chest is fitted;
//    the fit (2) then made again with it.
//
// Units and axes are the body's: y up (the chin's underside 0), z forward, x the body's left.
import { closestOnBody, transferWeights, ramp, add, sub, mul, dot, cross, unit } from '../lowgarment.mjs';
import { LEGS, LEGS_ITEMS, assetOf } from './chestlegs.mjs';

const TRUNK = new Set(['torso', 'pelvis', 'legs']);
const ARM = /^(clavicle|shoulder|upperarm|upperarm_twist|elbow|lowerarm|lowerarm_twist_0\d|wrist|hand|knuckles|thumb_0\d|fingers_0\d|fingers_mid)_[lr]$/;

/** The convex hull of points in a plane (as platechest.mjs's), and how far from o along d its boundary is. */
function hull2(P) {
  const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  hi.pop(); lo.pop();
  return lo.concat(hi);
}
function rayHull(H, o, d) {
  let best = 0;
  for (let k = 0; k < H.length; k++) {
    const a = H[k], b = H[(k + 1) % H.length], e = [b[0] - a[0], b[1] - a[1]], den = d[0] * e[1] - d[1] * e[0];
    if (Math.abs(den) < 1e-12) continue;
    const w = [a[0] - o[0], a[1] - o[1]], s = (w[0] * e[1] - w[1] * e[0]) / den, t = (w[0] * d[1] - w[1] * d[0]) / den;
    if (s >= 0 && t >= -1e-9 && t <= 1 + 1e-9) best = Math.max(best, s);
  }
  return best;
}
/** Triangles (three points each) binned in a grid of `cell`; along(o, d, reach) those in the cells a segment passes. */
function binned(T, cell = 0.25) {
  const grid = new Map(), key = (x, y, z) => `${x},${y},${z}`;
  T.forEach((t, k) => {
    const lo = [0, 1, 2].map((j) => Math.floor(Math.min(t[0][j], t[1][j], t[2][j]) / cell)), hi = [0, 1, 2].map((j) => Math.floor(Math.max(t[0][j], t[1][j], t[2][j]) / cell));
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) (grid.get(key(x, y, z)) ?? grid.set(key(x, y, z), []).get(key(x, y, z))).push(k);
  });
  const along = (o, d, reach) => {
    const out = new Set();
    for (let s = -cell; s <= reach + cell; s += cell / 2) { const c = add(o, mul(d, s)).map((x) => Math.floor(x / cell)); for (const k of grid.get(key(...c)) ?? []) out.add(k); }
    return [...out].map((k) => T[k]);
  };
  return { T, along };
}
/** Every distance along o + t d (t in (lo, hi)) at which it meets one of T (meeting it at no flatter than `cos` to it). */
function hits(T, o, d, lo, hi, cos = 0) {
  const out = [];
  for (const [a, b, c] of T) {
    const e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
    if (Math.abs(det) < 1e-12 || Math.abs(det) < cos * Math.hypot(...cross(e1, e2))) continue;
    const f = 1 / det, s = sub(o, a), u = f * dot(s, h); if (u < 0 || u > 1) continue;
    const q = cross(s, e1), v = f * dot(d, q); if (v < 0 || u + v > 1) continue;
    const t = f * dot(e2, q); if (t > lo && t < hi) out.push(t);
  }
  return out;
}
// (the legs met along a line out: not those it only grazes)
const furthest = (B, o, d, lo, hi) => { const t = hits(B.along(o, d, hi), o, d, lo, hi, 0.25); return t.length ? Math.max(...t) : -Infinity; };
const nearest = (B, o, d, lo, hi) => { const t = hits(B.along(o, d, hi), o, d, lo, hi); return t.length ? Math.min(...t) : Infinity; };

/** The legs garments worn under the chest by any legs item: [key, its asset, whether its `dropFrom` on is left out]. */
export function legsWorn(rig, chestKey) {
  const worn = new Map();
  for (const li of Object.keys(LEGS_ITEMS)) for (const [k, drops] of LEGS_ITEMS[li](chestKey)) worn.set(k, drops);
  return [...worn].map(([k, drops]) => [k, assetOf(LEGS[k], rig.who), drops]);
}
/** A legs asset's triangles drawn (not its glow, nor from `dropFrom` on when left out): three points each. */
function legsTris(A, drops) {
  const end = Math.min(A.glowFrom ?? Infinity, drops && A.dropFrom !== undefined ? A.dropFrom : Infinity), T = [];
  for (let i = 0; i < A.tris.length; i += 4) if (A.tris[i + 3] < end) T.push([0, 1, 2].map((j) => [A.verts[A.tris[i + j] * 3], A.verts[A.tris[i + j] * 3 + 1], A.verts[A.tris[i + j] * 3 + 2]]));
  return T;
}

/** The body's trunk, hips and legs: p → its closest point there and the body's normal at it. */
export function bodyFrame(rig) {
  const { B } = rig, keep = B.tris.map((t) => t.v.every((i) => TRUNK.has(B.part[i])));
  const N = B.verts.map(() => [0, 0, 0]);
  for (const t of B.tris) { const [a, b, c] = t.v.map((i) => B.verts[i]), n = cross(sub(b, a), sub(c, a)); for (const i of t.v) N[i] = add(N[i], n); }
  const U = N.map(unit);
  return (p) => { const c = closestOnBody(B.verts, B.tris, p, keep), v = B.tris[c.tri].v; return { q: c.q, n: unit(v.reduce((s, j, k) => add(s, mul(U[j], c.w[k])), [0, 0, 0])) }; };
}
/** Per vertex, whether it is on an arm (its heaviest bone). */
const armOf = (rig, G) => G.vw.map((w) => { let b = -1, m = -1; for (const [bi, x] of w) if (x > m) { m = x; b = bi; } return ARM.test(rig.bones[b]?.name ?? ''); });

/** The hips' vertical axis (x 0): its z, halfway between the body's front and back at the hips' joint. */
function hipsAxis(rig) {
  const y = rig.bones[rig.at.get('pelvis')].head[1], z = rig.B.verts.filter((p, i) => TRUNK.has(rig.B.part[i]) && Math.abs(p[1] - y) < 0.3).map((p) => p[2]);
  return (Math.min(...z) + Math.max(...z)) / 2;
}

/* ---- 3. the liner -------------------------------------------------------------------------------------------------- */
function addLiner(rig, G, chestKey, arm, { top, low, mat, arc = null, cols = 72, step = 0.08, clr = 0.04, eps = 0.025, tag = 'liner' }) {
  // (`low`: a height, or [[azimuth, height], ...] by the azimuth's size (0 the front, 180 the back), between them in line)
  const lowAt = Array.isArray(low) ? (az) => { const a = Math.abs(((az + 540) % 360) - 180); let k = 0; while (k + 2 < low.length && low[k + 1][0] < a) k++; const [[a0, y0], [a1, y1]] = [low[k], low[k + 1]]; return y0 + (y1 - y0) * Math.min(1, Math.max(0, (a - a0) / (a1 - a0))); } : () => low, z0 = hipsAxis(rig);
  const dir = (az) => [Math.sin(az * Math.PI / 180), 0, Math.cos(az * Math.PI / 180)];
  // the points the hull is of: the body's trunk, hips and legs, and every legs piece worn under the chest
  const S = rig.B.verts.filter((p, i) => TRUNK.has(rig.B.part[i]));
  // (points across each legs triangle no further apart than 0.05, so a long triangle through a slab is in it)
  for (const [, A, drops] of legsWorn(rig, chestKey)) for (const [a, b, c] of legsTris(A, drops)) {
    const k = Math.max(1, Math.ceil(Math.max(Math.hypot(...sub(b, a)), Math.hypot(...sub(c, b)), Math.hypot(...sub(a, c))) / 0.05));
    for (let u = 0; u <= k; u++) for (let v = 0; u + v <= k; v++) S.push(add(a, add(mul(sub(b, a), u / k), mul(sub(c, a), v / k))));
  }
  const body = rig.B.verts.filter((p, i) => TRUNK.has(rig.B.part[i]));
  const reach = (P, y, az) => {
    let pts = [];
    for (let w = 0.05; pts.length < 6 && w < 1; w *= 1.5) pts = P.filter((p) => Math.abs(p[1] - y) < w).map((p) => [p[0], p[2] - z0]);
    const d = dir(az);
    return rayHull(hull2(pts), [0, 0], [d[0], d[2]]);
  };
  // the chest's own lower part (not its arms), for its innermost layer round the axis
  const CT = G.tris.filter((t) => !t.v.some((i) => arm[i]) && t.v.some((i) => G.verts[i][1] < top + 0.6)).map((t) => t.v.map((i) => G.verts[i]));
  const C = binned(CT, 0.2);
  const lows = Array.from({ length: cols }, (_, j) => lowAt((j * 360) / cols));
  const rows = Math.max(2, Math.ceil((top - Math.min(...lows)) / step) + 1);
  const ys = (j) => Array.from({ length: rows }, (_, r) => top + ((lows[j] - top) * r) / (rows - 1));
  const inner = Array.from({ length: cols }, (_, j) => ys(j).map((y) => { const az = (j * 360) / cols; return nearest(C, [0, y, z0], dir(az), 0, 2.5); }));
  // (`arc`: [a0, a1], only between a0 and a1 degrees from the front, either side)
  const inArc = (j) => { const a = Math.abs((((j * 360) / cols + 540) % 360) - 180); return !arc || (a >= arc[0] - 1e-9 && a <= arc[1] + 1e-9); };
  const kept = Array.from({ length: cols }, (_, j) => j).filter(inArc), at = new Map(kept.map((j, k) => [j, k]));
  const base = G.verts.length, idx = (j, r) => base + at.get(j % cols) * rows + r;
  for (const j of kept) {
    const az = (j * 360) / cols, d = dir(az);
    ys(j).forEach((y, r) => {
      // (the chest's innermost layer, the least near: a column either side, a row above and below)
      let cin = Infinity;
      for (let dj = -1; dj <= 1; dj++) for (let dr = -1; dr <= 1; dr++) { const v = inner[(j + dj + cols) % cols][Math.min(rows - 1, Math.max(0, r + dr))]; if (v < cin) cin = v; }
      const R = Math.max(Math.min(reach(S, y, az) + clr, cin - eps), reach(body, y, az) + 0.015);
      G.verts.push([d[0] * R, y, z0 + d[2] * R]);
      if (G.part) G.part.push(tag);
    });
  }
  const p0 = G.polys.length;
  for (let j = 0; j < cols; j++) for (let r = 0; r + 1 < rows; r++) {
    if (!inArc(j) || !inArc(j + 1)) continue;
    // (outward: a, b round the axis toward the body's left, then down)
    const a = idx(j, r), b = idx(j + 1, r), c = idx(j + 1, r + 1), e = idx(j, r + 1);
    G.polys.push({ v: [a, e, c], mat, part: tag, tag }, { v: [a, c, b], mat, part: tag, tag });
  }
  // (each polygon facing out from the axis)
  for (let k = p0; k < G.polys.length; k++) {
    const v = G.polys[k].v, [A, B, Cc] = v.map((i) => G.verts[i]), n = cross(sub(B, A), sub(Cc, A)), m = mul(add(add(A, B), Cc), 1 / 3);
    if (dot(n, [m[0], 0, m[2] - z0]) < 0) v.reverse();
  }
  for (let k = p0; k < G.polys.length; k++) G.tris.push({ v: [...G.polys[k].v], poly: k });
  // skinned as the body under it
  const only = new Set(Array.from({ length: G.verts.length - base }, (_, i) => base + i));
  const W = transferWeights(rig, G, { only: (i) => only.has(i), smooth: 3, keep: (i) => TRUNK.has(rig.B.part[i]) });
  for (const i of only) G.vw[i] = W[i];
  return { from: base, polys: [p0, G.polys.length] };
}

/* ---- 2. the fit ---------------------------------------------------------------------------------------------------- */
function fit(rig, G, chestKey, arm, frame, { top, clr = 0.04, slope = 0.35, rounds = 4, reach = 0.7, near = 0.25, step = 0.1, outer = 0.5 }) {
  const moved = G.verts.map(() => 0), z0 = hipsAxis(rig);
  const out = (p) => unit([p[0], 0, p[2] - z0]);
  // (the body's reach round the axis at a height: the hull of its trunk, hips and legs in a slab)
  const body = rig.B.verts.filter((p, i) => TRUNK.has(rig.B.part[i])), hulls = new Map();
  const bodyReach = (p) => {
    const key = Math.round(p[1] * 50);
    if (!hulls.has(key)) { let pts = []; for (let w = 0.05; pts.length < 6 && w < 1; w *= 1.5) pts = body.filter((b) => Math.abs(b[1] - p[1]) < w).map((b) => [b[0], b[2] - z0]); hulls.set(key, hull2(pts)); }
    const d = out(p);
    return rayHull(hulls.get(key), [0, 0], [d[0], d[2]]);
  };
  // (every legs piece worn under the chest, whole: what of it is left out under the chest is not known until it is fitted)
  const L = binned(legsWorn(rig, chestKey).flatMap(([, A, drops]) => legsTris(A, drops)));
  for (let round = 0; round < rounds; round++) {
    // (the chest's surface sampled: its vertices, and points across each triangle no further apart than `step`, a
    // point's need its triangle's corners' too; not the chest's inside: a vertex under the body's surface or inside its
    // reach round the axis, or a triangle with one)
    const need = [], pts = [], inside = G.verts.map((p, i) => !arm[i] && p[1] <= top + 0.5 && (dot(sub(p, frame(p).q), frame(p).n) < -0.02 || Math.hypot(p[0], p[2] - z0) < bodyReach(p) - 0.05));
    G.verts.forEach((p, i) => { if (!arm[i] && !inside[i] && p[1] <= top) pts.push([p, [p]]); });
    for (const t of G.tris) {
      if (t.v.some((i) => arm[i] || inside[i]) || t.v.every((i) => G.verts[i][1] > top)) continue;
      const C = t.v.map((i) => G.verts[i]), [a, b, c] = C, k = Math.ceil(Math.max(Math.hypot(...sub(b, a)), Math.hypot(...sub(c, b)), Math.hypot(...sub(a, c))) / step);
      if (k < 2) continue;
      for (let u = 0; u <= k; u++) for (let v = 0; u + v <= k; v++) if (!((u === 0 && v === 0) || u === k || v === k)) pts.push([add(a, add(mul(sub(b, a), u / k), mul(sub(c, a), v / k))), C]);
    }
    // (only where the chest is outermost: what of the legs crosses its layers under that is out of sight)
    const C = binned(G.tris.filter((t) => !t.v.some((i) => arm[i])).map((t) => t.v.map((i) => G.verts[i])), 0.2);
    for (const [p, at] of pts) {
      if (p[1] > top) continue;
      // (out along the body's normal from its closest point, and out from the hips' axis)
      const { q, n } = frame(p), o = [0, p[1], z0], d = out(p);
      // (covered: the chest met out along the normal, tilted to either side and up toward the camera)
      const side = unit(cross([0, 1, 0], n));
      if ([n, unit(add(n, mul(side, 0.6))), unit(sub(n, mul(side, 0.6))), unit(add(n, [0, 0.4, 0]))].every((r) => nearest(C, p, r, 0.008, outer) < outer)) continue;
      // (the legs met no further out than `near` past the chest along the normal; and out from the axis, all of them)
      const h = dot(sub(p, q), n), need1 = furthest(L, q, n, -0.05, Math.min(reach, h + near)) + clr - h, need2 = furthest(L, o, d, 0, 3) + clr - dot(sub(p, o), d);
      const x = Math.max(need1, need2);
      if (x > 1e-3) for (const c of at) need.push([c, x]);
    }
    if (!need.length) break;
    // (spread: each vertex pushed out from the hips' axis by the most of any need near it, less `slope` a unit of distance)
    const push = G.verts.map((p, i) => { if (arm[i]) return 0; let D = 0; for (const [q, x] of need) { const y = x - slope * Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); if (y > D) D = y; } return D; });
    G.verts.forEach((p, i) => { if (!push[i]) return; G.verts[i] = add(p, mul(out(p), push[i])); moved[i] += push[i]; });
  }
  return moved;
}

/* ---- 1. the follow ------------------------------------------------------------------------------------------------- */
function follow(rig, G, arm, { top, full, smooth = 2, arc = null }) {
  // (`arc`: [a0, a1], wholly within a0 degrees of the front, none past a1: the back left as the chest has it)
  const z0 = hipsAxis(rig), round = (p) => (arc ? ramp(-Math.abs(Math.atan2(p[0], p[2] - z0) * 180 / Math.PI), -arc[1], -arc[0]) : 1);
  const sel = (i) => !arm[i] && G.verts[i][1] < top;
  const W = transferWeights(rig, G, { only: sel, smooth, keep: (i) => TRUNK.has(rig.B.part[i]) });
  G.verts.forEach((p, i) => {
    if (!sel(i)) return;
    const s = ramp(-p[1], -top, -full) * round(p), acc = new Map();
    for (const [b, w] of G.vw[i]) acc.set(b, (acc.get(b) ?? 0) + w * (1 - s));
    for (const [b, w] of W[i]) acc.set(b, (acc.get(b) ?? 0) + w * s);
    const l = [...acc].filter(([, w]) => w > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4), sum = l.reduce((a, [, w]) => a + w, 0);
    G.vw[i] = l.map(([b, w]) => [b, w / sum]);
  });
}

/**
 * Each chest's fit per body: how far down its weights follow the body's (from the hips' joint to the thighs), and its
 * liner (in the chest's own under-layer: the jerkin's dark leather, the breastplate's and the cuirass's padding) where it
 * has gaps at the waist or between its skirt's plates; heights in the body's units.
 */
const FOLLOW = { male: { top: -5.0, full: -5.8 }, female: { top: -3.8, full: -4.5 } };
export const OVER_LEGS = {
  // (her tunic as it was: fitted, it crossed the plate and scale leggings more when sat and hopping)
  tunic: { male: { follow: FOLLOW.male }, female: null },
  leatherChest: {
    male: { liner: { top: -4.1, low: -4.95, mat: 'dark' }, follow: FOLLOW.male },
    // (her jerkin's weights as they were: following her thighs, it crossed the plate leggings' faulds more when sat)
    female: { liner: { top: -3.9, low: -4.55, mat: 'dark', arc: [45, 125] }, follow: { top: -4.1, full: -5.0 } },
  },
  plateChest: {
    male: { liner: { top: -3.9, low: -4.75, mat: 'under' }, follow: FOLLOW.male },
    female: { liner: { top: -3.2, low: -4.5, mat: 'under' }, follow: FOLLOW.female },
  },
  scaleChest: {
    male: { liner: { top: -3.9, low: -4.9, mat: 'under' }, follow: FOLLOW.male },
    female: { liner: { top: -3.2, low: -4.4, mat: 'under' }, follow: FOLLOW.female },
  },
  // (his hauberk's back as it was: following his thighs, its hem crossed his calves kneeling)
  chainChest: { male: { follow: { ...FOLLOW.male, arc: [80, 130] } }, female: { follow: FOLLOW.female } },
};

/** The chest G (its verts, polys, tris and weights `vw`) fitted over every legs piece worn under it (as above). */
export function overLegs(rig, G, chestKey, o = OVER_LEGS[chestKey][rig.who]) {
  if (!o) return G;
  const arm = armOf(rig, G), frame = bodyFrame(rig);
  const top = o.top ?? Math.max(...legsWorn(rig, chestKey).flatMap(([, A, drops]) => legsTris(A, drops).flatMap((t) => t.map((p) => p[1])))) + 0.3;
  if (o.follow) follow(rig, G, arm, o.follow);
  // (the chest fitted first, then its liner under it as fitted, then the two again)
  const moved = fit(rig, G, chestKey, arm, frame, { top, ...(o.fit ?? {}) });
  if (o.liner) {
    addLiner(rig, G, chestKey, arm, o.liner);
    while (arm.length < G.verts.length) arm.push(false);
    fit(rig, G, chestKey, arm, frame, { top, ...(o.fit ?? {}) }).forEach((x, i) => { moved[i] = (moved[i] ?? 0) + x; });
  }
  G.overLegs = { most: Math.max(...moved), moved: moved.filter((x) => x > 1e-3).length };
  return G;
}
