// Garments for the low-poly bodies (tools/sculpt/lowarm.mjs buildArmBody, rigged by tools/sculpt/lowrig.mjs): the shared
// machinery a garment builder (tools/sculpt/garments/*.mjs) uses to fit cloth round one body and skin it to the rig.
//
//   the body's surface in a column: samplesOf (points on every triangle), envelope (the body's reach round a vertical
//   axis, in the half-plane of one azimuth, each point grown by a clearance) and drape (the cloth's line down from a point:
//   the concave majorant of that reach, as cloth hangs over a shoulder and falls);
//   the mesh: polygons with a material each, cut into triangles (fan, or the planar test planarOr), oriented outward as
//   one closed surface (orient), plus decals (separate pieces laid on it);
//   the weights: each garment vertex the weights at the closest point of the body's surface, its bones mapped by the
//   garment's own rule (cloth over the arm hangs from the shoulder, not the forearm), smoothed along the garment's edges
//   (transferWeights); skinGarment poses it as lowrig.mjs skin() poses the body (linear blend, the rig's bone frames);
//   a garment's own bones (G.bones: garmentBone, driven from the body's pose like the rig's helpers, garmentFrames),
//   appended after the body's; garmentAsset, the garment as the game would load it beside its body;
//   the checks: polygons out of plane, open and non-manifold edges, triangles crossing each other in the garment and
//   between garment and body (the crossing test of tools/sculpt/lowrigshot.mjs), and how deep body vertices sit inside it.
//
// Units and axes are the body's: y up (the chin's underside 0), z forward, x the body's left.

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
export const lerp = (a, b, t) => a.map((x, k) => x + (b[k] - x) * t);
const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];

/* ---- the body's reach round a vertical axis ------------------------------------------------------------------------ */
/** Points on the body's surface: its vertices and a grid on each triangle about `step` apart. */
export function samplesOf(B, P = B.verts, step = 0.06) {
  const out = P.map((p) => [...p]);
  for (const t of B.tris) {
    const [a, b, c] = t.v.map((i) => P[i]);
    const n = Math.max(1, Math.ceil(Math.max(Math.hypot(...sub(b, a)), Math.hypot(...sub(c, b)), Math.hypot(...sub(a, c))) / step));
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
      if ((i === 0 && j === 0) || (i === n && j === 0) || (i === 0 && j === n)) continue;
      const u = i / n, v = j / n, w = 1 - u - v;
      out.push([a[0] * w + b[0] * u + c[0] * v, a[1] * w + b[1] * u + c[1] * v, a[2] * w + b[2] * u + c[2] * v]);
    }
  }
  return out;
}

/** Azimuth about the vertical axis through (0, ·, z0): 0 toward +z (the front), 90 toward +x (the body's left). */
export const azimuth = (p, z0) => Math.atan2(p[0], p[2] - z0) * 180 / Math.PI;
export const dirOf = (deg) => [Math.sin(deg * Math.PI / 180), 0, Math.cos(deg * Math.PI / 180)];
/** The point at radius r and height y in the half-plane of azimuth deg. */
export const atRY = (deg, r, y, z0) => { const d = dirOf(deg); return [d[0] * r, y, z0 + d[2] * r]; };
const wrap = (d) => ((d + 540) % 360) - 180;

/**
 * The body's reach in the half-plane of azimuth `deg`: each sample within `half` degrees of it, as (r, y) with r its
 * distance from the axis grown by 1/cos(half) (so a chord between two columns `half` apart clears it), then grown by
 * `clear` all round (a half-disc of points outward), kept between heights lo and hi.
 */
export function envelope(S, z0, deg, half, clear, lo = -Infinity, hi = Infinity) {
  const k = 1 / Math.cos(half * Math.PI / 180), pts = [];
  for (const p of S) {
    if (p[1] < lo - clear || p[1] > hi + clear) continue;
    const d = Math.abs(wrap(azimuth(p, z0) - deg));
    if (d > half) continue;
    const r = Math.hypot(p[0], p[2] - z0) * k;
    for (let a = -90; a <= 90; a += 22.5) { const t = a * Math.PI / 180; pts.push([r + clear * Math.cos(t), p[1] + clear * Math.sin(t)]); }
  }
  return pts.filter(([, y]) => y >= lo && y <= hi);
}

/** The body's greatest reach r at height y in an envelope (points within dy of y), or 0. */
export function reachAt(E, y, dy = 0.03) { let r = 0; for (const [pr, py] of E) if (Math.abs(py - y) <= dy && pr > r) r = pr; return r; }

/**
 * Cloth hanging from A = [r, y] down to height yEnd over the points E ([r, y] grown by the clearance): the least concave
 * majorant of the reach r as a function of the depth below A (its upper hull), as a polyline [[r, y], ...] from A to yEnd.
 */
export function drape(E, A, yEnd) {
  const pts = [[0, A[0]]];
  let top = A[0];
  for (const [r, y] of E) if (y <= A[1] && y >= yEnd) { pts.push([A[1] - y, r]); top = Math.max(top, r); }
  pts.push([A[1] - yEnd, top]);
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  // the upper hull from the first point to the last, in (depth, r)
  const H = [];
  for (const p of pts) {
    while (H.length >= 2) { const [o, a] = [H[H.length - 2], H[H.length - 1]]; if ((a[0] - o[0]) * (p[1] - o[1]) - (a[1] - o[1]) * (p[0] - o[0]) >= 0) H.pop(); else break; }
    H.push(p);
  }
  return H.map(([u, r]) => [r, A[1] - u]);
}
/** A polyline's r at height y (the polyline running downward), and the point at arc length s from its start. */
export function rAtY(L, y) {
  for (let i = 0; i + 1 < L.length; i++) { const [a, b] = [L[i], L[i + 1]]; if (y <= a[1] && y >= b[1]) { const t = a[1] === b[1] ? 0 : (a[1] - y) / (a[1] - b[1]); return a[0] + (b[0] - a[0]) * t; } }
  return y > L[0][1] ? L[0][0] : L[L.length - 1][0];
}

/* ---- the mesh ------------------------------------------------------------------------------------------------------ */
/** Newell's normal of a polygon (not unit). */
export function newell(P, v) {
  let n = [0, 0, 0];
  for (let i = 0; i < v.length; i++) { const a = P[v[i]], b = P[v[(i + 1) % v.length]]; n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; }
  return n;
}
/** How far a polygon's corners lie off its own plane (Newell's normal through its centroid). */
export function offPlane(P, v) {
  if (v.length < 4) return 0;
  const n = unit(newell(P, v)), c = mul(v.reduce((s, i) => add(s, P[i]), [0, 0, 0]), 1 / v.length);
  return Math.max(...v.map((i) => Math.abs(dot(sub(P[i], c), n))));
}

/**
 * A garment under construction: verts, polys { v, mat, part }, and per vertex its part. poly() adds a polygon whole if
 * its corners lie within TOL of one plane, else cut into triangles (a quad along its shorter diagonal, more by a fan).
 */
export const TOL = 0.035;
export function meshOf() {
  const G = { verts: [], polys: [], part: [] };
  G.vert = (p, part) => { G.verts.push(p); G.part.push(part); return G.verts.length - 1; };
  G.poly = (v, mat, part, whole = false) => {
    if (v.some((x) => x == null)) return;
    v = v.filter((x, k) => v.indexOf(x) === k);
    if (v.length < 3) return;
    if (v.length === 3 || whole || offPlane(G.verts, v) <= TOL) { G.polys.push({ v, mat, part, tag: G.tag }); return; }
    if (v.length === 4) {
      const d02 = Math.hypot(...sub(G.verts[v[0]], G.verts[v[2]])), d13 = Math.hypot(...sub(G.verts[v[1]], G.verts[v[3]]));
      if (d02 <= d13) { G.polys.push({ v: [v[0], v[1], v[2]], mat, part, tag: G.tag }, { v: [v[0], v[2], v[3]], mat, part, tag: G.tag }); }
      else { G.polys.push({ v: [v[0], v[1], v[3]], mat, part, tag: G.tag }, { v: [v[1], v[2], v[3]], mat, part, tag: G.tag }); }
      return;
    }
    for (let k = 1; k + 1 < v.length; k++) G.polys.push({ v: [v[0], v[k], v[k + 1]], mat, part, tag: G.tag });
  };
  return G;
}
/** Triangles of the polygons (fans: every polygon is convex and flat). */
export function trisOf(G) { const t = []; G.polys.forEach((p, pi) => { for (let k = 1; k + 1 < p.v.length; k++) t.push({ v: [p.v[0], p.v[k], p.v[k + 1]], poly: pi }); }); return t; }

/**
 * Orient the polygons of each connected piece consistently (each shared edge run both ways) and outward: a closed piece
 * by its signed volume, an open one (a decal) so its normals point away from `inside(p)` (a point it should face from).
 */
export function orient(G, outward) {
  const edgeMap = new Map();
  G.polys.forEach((p, pi) => p.v.forEach((a, k) => { const b = p.v[(k + 1) % p.v.length]; const key = a < b ? `${a},${b}` : `${b},${a}`; (edgeMap.get(key) ?? edgeMap.set(key, []).get(key)).push(pi); }));
  const seen = new Array(G.polys.length).fill(false), dirOfEdge = (p, a, b) => { const k = p.v.indexOf(a); return p.v[(k + 1) % p.v.length] === b ? 1 : -1; };
  for (let s = 0; s < G.polys.length; s++) {
    if (seen[s]) continue;
    const piece = [s]; seen[s] = true;
    for (let q = 0; q < piece.length; q++) {
      const p = G.polys[piece[q]];
      p.v.forEach((a, k) => {
        const b = p.v[(k + 1) % p.v.length], key = a < b ? `${a},${b}` : `${b},${a}`;
        for (const o of edgeMap.get(key)) {
          if (seen[o]) continue;
          const po = G.polys[o];
          if (dirOfEdge(po, a, b) === dirOfEdge(p, a, b)) po.v.reverse();
          seen[o] = true; piece.push(o);
        }
      });
    }
    // closed: the signed volume; open: the normals against `outward`
    let vol = 0, face = 0;
    for (const pi of piece) {
      const v = G.polys[pi].v, P = G.verts;
      for (let k = 1; k + 1 < v.length; k++) vol += dot(P[v[0]], cross(P[v[k]], P[v[k + 1]]));
      const c = mul(v.reduce((s2, i) => add(s2, P[i]), [0, 0, 0]), 1 / v.length);
      face += dot(newell(P, v), outward(c));
    }
    const closed = piece.every((pi) => G.polys[pi].v.every((a, k, v) => { const b = v[(k + 1) % v.length]; return edgeMap.get(a < b ? `${a},${b}` : `${b},${a}`).length === 2; }));
    if ((closed ? vol : face) < 0) for (const pi of piece) G.polys[pi].v.reverse();
  }
  return G;
}

/* ---- the closest point on the body --------------------------------------------------------------------------------- */
/** The closest point to p on triangle abc: [point, [wa, wb, wc]] (Ericson, Real-Time Collision Detection 5.1.5). */
export function closestOnTri(p, a, b, c) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return [a, [1, 0, 0]];
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return [b, [0, 1, 0]];
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return [add(a, mul(ab, v)), [1 - v, v, 0]]; }
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return [c, [0, 0, 1]];
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return [add(a, mul(ac, w)), [1 - w, 0, w]]; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return [add(b, mul(sub(c, b), w)), [0, 1 - w, w]]; }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  return [add(a, add(mul(ab, v), mul(ac, w))), [1 - v - w, v, w]];
}
/** The closest point of the body (triangles `tris` of verts P, optionally only those passing `keep`) to p. */
export function closestOnBody(P, tris, p, keep = null) {
  let best = null;
  for (let k = 0; k < tris.length; k++) {
    if (keep && !keep[k]) continue;
    const [a, b, c] = tris[k].v.map((i) => P[i]);
    // a cheap bound: the distance to the triangle's bounding sphere
    const m = mul(add(add(a, b), c), 1 / 3), R = Math.max(Math.hypot(...sub(a, m)), Math.hypot(...sub(b, m)), Math.hypot(...sub(c, m)));
    if (best && Math.hypot(...sub(p, m)) - R > best.d) continue;
    const [q, w] = closestOnTri(p, a, b, c), d = Math.hypot(...sub(p, q));
    if (!best || d < best.d) best = { d, q, w, tri: k };
  }
  return best;
}

/* ---- weights and skinning ------------------------------------------------------------------------------------------ */
/**
 * Each garment vertex's weights: the body's at the closest point of its surface (the triangle's corners' weights
 * blended by the point's barycentric weights), each bone renamed by map(boneName, vertex) (a name, or [[name, share],
 * ...]), smoothed `smooth` times along the garment's edges (each vertex half its own, half its neighbours' mean), the
 * smallest dropped to keep four, normalised. Returns per vertex [[boneIndex, weight], ...].
 */
export function transferWeights(rig, G, { map = (n) => n, smooth = 2, keep = null, only = null } = {}) {
  const { B, bones, at, vw } = rig;
  const tris = B.tris;
  const keepTri = keep ? tris.map((t) => t.v.every((i) => keep(i))) : null;
  const W = G.verts.map((p, i) => {
    if (only && !only(i)) return null;
    const c = closestOnBody(B.verts, tris, p, keepTri);
    const acc = {};
    tris[c.tri].v.forEach((vi, k) => { for (const [bi, w] of vw[vi]) acc[bones[bi].name] = (acc[bones[bi].name] ?? 0) + w * c.w[k]; });
    const out = {};
    for (const [n, w] of Object.entries(acc)) {
      const m = map(n, i);
      const list = typeof m === 'string' ? [[m, 1]] : m;
      for (const [mn, s] of list) out[mn] = (out[mn] ?? 0) + w * s;
    }
    return out;
  });
  // neighbours along the garment's edges (within one part's connected surface)
  const nb = G.verts.map(() => new Set());
  for (const p of G.polys) p.v.forEach((a, k) => { const b = p.v[(k + 1) % p.v.length]; nb[a].add(b); nb[b].add(a); });
  let cur = W;
  for (let it = 0; it < smooth; it++) {
    cur = cur.map((w, i) => {
      if (!w) return w;
      const ns = [...nb[i]].filter((j) => cur[j]);
      if (!ns.length) return w;
      const o = {};
      for (const [n, x] of Object.entries(w)) o[n] = (o[n] ?? 0) + 0.5 * x;
      for (const j of ns) for (const [n, x] of Object.entries(cur[j])) o[n] = (o[n] ?? 0) + 0.5 * x / ns.length;
      return o;
    });
  }
  return cur.map((w) => {
    if (!w) return null;
    let l = Object.entries(w).filter(([, x]) => x > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const s = l.reduce((a, [, x]) => a + x, 0);
    return l.map(([n, x]) => [at.get(n), x / s]);
  });
}
/* ---- the garment's own bones ------------------------------------------------------------------------------------- */
import { quat, qmat, qpow, swingTwist } from './lowrig.mjs';

const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const mm3 = (a, b) => [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]));
const tr3 = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
/**
 * The 'lift' drive: the source bone's swing (its local turn less its twist about its own axis, Y); with `axis` ('x'
 * or 'z', the source's own) only the swing's part about that axis, taken `sign` (+1 or -1) as a raise and nothing when
 * the other way. Of its angle θ the drive turns g(θ) = a θ + (b - a) max(0, θ - knee), at most max (degrees): a share a
 * while the source swings little (a walk's arm), catching up past the knee (an arm raised under the cloth). `also`
 * ({ axis, a, max }) adds a share of the swing about the other axis, either way, at most max (the walk's swing).
 */
export function liftOf(Lsrc, { a, knee, b, max, axis = null, sign = 1, also = null }) {
  const { swing } = swingTwist(quat(Lsrc), [0, 1, 0]), s = swing[0] < 0 ? swing.map((x) => -x) : swing;
  const g = (th) => Math.min(max, a * th + (b - a) * Math.max(0, th - knee));
  if (!axis) {
    const th = 2 * Math.acos(Math.min(1, s[0])) * 180 / Math.PI;
    return th < 1e-6 ? I3 : qmat(qpow(s, g(th) / th));
  }
  // (the swing's part about a local axis, degrees, signed)
  const about = (ax) => { const k = ax === 'x' ? [1, 0, 0] : [0, 0, 1], { twist } = swingTwist(s, k); return [k, 2 * Math.atan2(twist[1] * k[0] + twist[3] * k[2], twist[0]) * 180 / Math.PI]; };
  const turn = (k, deg) => { const h = (deg / 2) * Math.PI / 180; return [Math.cos(h), k[0] * Math.sin(h), 0, k[2] * Math.sin(h)]; };
  const [k, th0] = about(axis), th = sign * th0;
  let q = th > 1e-6 ? turn(k, sign * g(th)) : [1, 0, 0, 0];
  // (and a share of the swing about the other axis, either way, at most also.max)
  if (also) { const [k2, t2] = about(also.axis); q = qmul(turn(k2, Math.max(-also.max, Math.min(also.max, also.a * t2))), q); }
  return qmat(q);
}
const qmul = (p, q) => [p[0] * q[0] - p[1] * q[1] - p[2] * q[2] - p[3] * q[3], p[0] * q[1] + p[1] * q[0] + p[2] * q[3] - p[3] * q[2], p[0] * q[2] - p[1] * q[3] + p[2] * q[0] + p[3] * q[1], p[0] * q[3] + p[1] * q[2] - p[2] * q[1] + p[3] * q[0]];
/**
 * A garment bone: parented to a body bone, its head at `head` and its rest frame R (columns X, Y, Z), driven from a
 * body bone (driver: { from, kind: 'lift', a, knee, b, max }).
 */
export const garmentBone = (name, parent, head, R, driver) => ({ name, parent, head, R, kind: 'helper', driver });
/** The body's frames (lowrig.mjs posed()) with the garment's own bones' appended, each driven from the body's pose. */
export function garmentFrames(rig, G, frames) {
  const GB = G.bones ?? [];
  if (!GB.length || frames.length > rig.bones.length) return frames;
  const out = frames.slice();
  for (const b of GB) {
    const pi = rig.at.get(b.parent), P = rig.bones[pi], pa = frames[pi];
    const Rrel = mm3(tr3(P.R), b.R), off = [0, 1, 2].map((i) => tr3(P.R).slice(i * 3, i * 3 + 3).reduce((s2, x, j) => s2 + x * (b.head[j] - P.head[j]), 0));
    const L = b.driver?.kind === 'lift' ? liftOf(frames[rig.at.get(b.driver.from)].L, b.driver) : I3;
    const W = mm3(pa.W, mm3(Rrel, L)), P2 = add(pa.P, mv(pa.W, off));
    out.push({ W, P: P2, S: mm3(W, tr3(b.R)), L });
  }
  return out;
}
/** All the bones a garment's weights index: the body's, then its own. */
export const bonesWith = (rig, G) => [...rig.bones, ...(G.bones ?? [])];

/** The garment's vertices in a pose (frames from lowrig.mjs posed(); its own bones driven from them), as skin() poses the body. */
export function skinGarment(rig, frames, G, vw = G.vw) {
  const bones = bonesWith(rig, G);
  frames = garmentFrames(rig, G, frames);
  return G.verts.map((v, i) => {
    let x = 0, y = 0, z = 0;
    for (const [bi, w] of vw[i]) {
      const f = frames[bi], q = add(mv(f.S, sub(v, bones[bi].head)), f.P);
      x += w * q[0]; y += w * q[1]; z += w * q[2];
    }
    return [x, y, z];
  });
}

/* ---- checks -------------------------------------------------------------------------------------------------------- */
/** Whether triangles A and B (three points each) cross: an edge of one through the face of the other. */
export function triTri(A, Bt) {
  const segTri = (p, q, T) => {
    const e1 = sub(T[1], T[0]), e2 = sub(T[2], T[0]), d = sub(q, p), h = cross(d, e2), a = dot(e1, h);
    if (Math.abs(a) < 1e-12) return false;
    const f = 1 / a, s = sub(p, T[0]), u = f * dot(s, h); if (u < 0 || u > 1) return false;
    const qv = cross(s, e1), v = f * dot(d, qv); if (v < 0 || u + v > 1) return false;
    const t = f * dot(e2, qv); return t > 1e-6 && t < 1 - 1e-6;
  };
  for (let k = 0; k < 3; k++) if (segTri(A[k], A[(k + 1) % 3], Bt) || segTri(Bt[k], Bt[(k + 1) % 3], A)) return true;
  return false;
}
const boxOf = (T) => [[0, 1, 2].map((j) => Math.min(T[0][j], T[1][j], T[2][j])), [0, 1, 2].map((j) => Math.max(T[0][j], T[1][j], T[2][j]))];
/**
 * Pairs [i, j] of triangles of set A (verts PA, tris TA) crossing triangles of set B; with B omitted, A against itself,
 * pairs sharing a vertex skipped.
 */
export function crossPairs(PA, TA, PB = null, TB = null) {
  const self = !PB;
  if (self) { PB = PA; TB = TA; }
  const cell = 0.2, grid = new Map(), out = [];
  const bb = TB.map((t) => boxOf(t.v.map((i) => PB[i])));
  bb.forEach(([lo, hi], k) => {
    for (let x = Math.floor(lo[0] / cell); x <= Math.floor(hi[0] / cell); x++) for (let y = Math.floor(lo[1] / cell); y <= Math.floor(hi[1] / cell); y++) for (let z = Math.floor(lo[2] / cell); z <= Math.floor(hi[2] / cell); z++) {
      const key = `${x},${y},${z}`; (grid.get(key) ?? grid.set(key, []).get(key)).push(k);
    }
  });
  const seen = new Set();
  TA.forEach((t, i) => {
    const A = t.v.map((v) => PA[v]), [lo, hi] = boxOf(A);
    for (let x = Math.floor(lo[0] / cell); x <= Math.floor(hi[0] / cell); x++) for (let y = Math.floor(lo[1] / cell); y <= Math.floor(hi[1] / cell); y++) for (let z = Math.floor(lo[2] / cell); z <= Math.floor(hi[2] / cell); z++) {
      for (const j of grid.get(`${x},${y},${z}`) ?? []) {
        if (self && j <= i) continue;
        const key = i * 100000 + j;
        if (seen.has(key)) continue;
        seen.add(key);
        if (self && TB[j].v.some((q) => t.v.includes(q))) continue;
        const [l2, h2] = bb[j];
        if (lo[0] > h2[0] || l2[0] > hi[0] || lo[1] > h2[1] || l2[1] > hi[1] || lo[2] > h2[2] || l2[2] > hi[2]) continue;
        if (triTri(A, TB[j].v.map((q) => PB[q]))) out.push([i, j]);
      }
    }
  });
  return out;
}
/** Open edges (one polygon) and non-manifold edges (three or more) of a mesh. */
export function edgesOf(G) {
  const m = new Map();
  for (const p of G.polys) p.v.forEach((a, k) => { const b = p.v[(k + 1) % p.v.length]; const key = a < b ? `${a},${b}` : `${b},${a}`; m.set(key, (m.get(key) ?? 0) + 1); });
  const open = [...m].filter(([, n]) => n === 1).map(([k]) => k), nonManifold = [...m].filter(([, n]) => n > 2).map(([k]) => k);
  return { open, nonManifold };
}
/**
 * The garment's checks at rest or in a pose: triangles, the worst polygon off its plane, open and non-manifold edges,
 * its own triangles crossing each other, its triangles crossing the body's, and the body's vertices inside it (deeper
 * than 0 behind the nearest garment face, among those within reach of it) with the deepest.
 */
const count = (l) => { const o = {}; for (const x of l) o[x] = (o[x] ?? 0) + 1; return o; };
export function checks(G, PG, body, PB) {
  const T = trisOf(G);
  const self = crossPairs(PG, T);
  const withBody = crossPairs(PG, T, PB, body.tris);
  return {
    tris: T.length,
    offPlane: +Math.max(...G.polys.map((p) => offPlane(PG, p.v))).toFixed(4),
    ...(() => { const e = edgesOf(G); return { open: e.open.length, nonManifold: e.nonManifold.length }; })(),
    self: self.length,
    body: withBody.length,
    bodyParts: count(withBody.map(([i, j]) => `${G.polys[T[i].poly].tag ?? G.polys[T[i].poly].part}×${body.part?.[body.tris[j].v[0]] ?? '?'}`)),
    selfParts: count(self.map(([i, j]) => [G.polys[T[i].poly].tag, G.polys[T[j].poly].tag].sort().join('×'))),
  };
}

/* ---- the game's copy ------------------------------------------------------------------------------------------------ */
/** The renderer's limit on bones a skinned mesh may use (src/sculpt/gl.ts MAX_BONES). */
export const MAX_BONES = 80;
/**
 * The garment as the game would load it beside its body (src/sculpt/assets/low<who>.json, lowrig.mjs gameAsset): the
 * vertices (the body's units and axes), the polygons (corners, material index into `mats`), the triangles, each
 * vertex's (bone, weight) list (bone indices: the body's, then the garment's own from `base` on), and its own bones as
 * the body's helpers are written (parent `p` and driver `from` the body's bone indices, rest head and frame R, `drive`
 * and its settings), so the game drives them from the body's pose as lowrig.mjs posed() drives its helpers. With
 * `looks` ({ plain, enchanted: { name: [r, g, b] or { c: [r, g, b], kind } }, glowFrom }: a piece that can be enchanted,
 * as the long sword), its materials plain and enchanted parallel to `mats` ({ c: '#rrggbb', kind: 0 lit, 1 unlit, 2 metal }, a
 * material a look leaves out its colour, lit) and the polygons from `glowFrom` on drawn only enchanted.
 */
export function garmentAsset(rig, G, mats, looks = null) {
  const r5 = (x) => +x.toFixed(5), names = Object.keys(mats), all = bonesWith(rig, G);
  if (all.length > MAX_BONES) throw new Error(`${all.length} bones: over the renderer's ${MAX_BONES}`);
  const hex = (c) => `#${c.map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('')}`;
  const look = (L) => names.map((n) => { const m = L?.[n] ?? mats[n]; return Array.isArray(m) ? { c: hex(m), kind: 0 } : { c: hex(m.c), kind: m.kind ?? 0 }; });
  return {
    ...(looks ? { plain: look(looks.plain), enchanted: look(looks.enchanted), ...(looks.glowFrom !== undefined ? { glowFrom: looks.glowFrom } : {}) } : {}),
    who: rig.who, base: rig.bones.length, mats: names, colours: names.map((n) => mats[n]),
    verts: G.verts.flat().map(r5),
    polys: G.polys.map((p) => [p.v, names.indexOf(p.mat)]),
    tris: G.tris.flatMap((t) => [...t.v, t.poly]),
    weights: G.vw.map((l) => l.flatMap(([b, w]) => [b, r5(w)])),
    bones: (G.bones ?? []).map((b) => {
      const { from, kind, ...set } = b.driver;
      return { name: b.name, p: rig.at.get(b.parent), kind: b.kind, head: b.head.map(r5), R: b.R.map(r5), from: rig.at.get(from), drive: kind, ...set };
    }),
  };
}
