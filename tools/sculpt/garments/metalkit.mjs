// The kit the metal sets and the fur set are built with (tools/sculpt/garments/metalsets.mjs): armour made out of the
// low-poly body itself, so it bends where the body bends and as the body does.
//
//   * a shell (`shell`): the body's own polygons in a region (by the bones that carry each point, and where it is),
//     subdivided with curved midpoints (a PN triangle's edge midpoint, from its corners' normals) so it is rounder than
//     the body under it, every point pushed out along its normal by as much as the piece says there (raised bands,
//     plates, a flare: `off`), each point carrying the body's own weights there. Its open edges are turned back to the
//     skin (a rim), and the body's polygons it covers whole are left out under it (`hides`), so no skin shows through.
//   * a hung piece (`hang`): a strip or a panel laid from points on a shell and hung down from them (a skirt's strips, a
//     cape), each row carrying the weights of the body point it hangs over.
//   * a rigid piece (`rigid`): a solid made in a bone's frame (a crest, a disc, a boss), on that bone alone.
//
// Materials are named; `plate` and `shade` are drawn in the piece's metal (src/sculpt/lowpoly.ts plateMat), `rune` is a
// glow: drawn plain as the set says, lit when enchanted in the enchantment's colour (lowpoly.ts KitTints.glow).
import { readFileSync } from 'node:fs';

const ASSETS = new URL('../../../src/sculpt/assets/', import.meta.url);
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;

/** The bones of each part of the body, by name. */
export const PARTS = {
  head: ['head', 'jaw', 'neck_02'],
  neck: ['neck_01'],
  torso: ['pelvis', 'spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r', 'root'],
  shoulder: ['shoulder_l', 'shoulder_r'],
  upperarm: ['upperarm_l', 'upperarm_r', 'upperarm_twist_l', 'upperarm_twist_r'],
  forearm: ['lowerarm_l', 'lowerarm_r', 'elbow_l', 'elbow_r', 'lowerarm_twist_01_l', 'lowerarm_twist_01_r', 'lowerarm_twist_02_l', 'lowerarm_twist_02_r', 'wrist_l', 'wrist_r'],
  hand: ['hand_l', 'hand_r', 'thumb_01_l', 'thumb_02_l', 'thumb_03_l', 'thumb_01_r', 'thumb_02_r', 'thumb_03_r', 'fingers_01_l', 'fingers_02_l', 'fingers_01_r', 'fingers_02_r', 'knuckles_l', 'knuckles_r', 'fingers_mid_l', 'fingers_mid_r'],
  thigh: ['thigh_l', 'thigh_r', 'hip_l', 'hip_r'],
  calf: ['calf_l', 'calf_r', 'knee_l', 'knee_r'],
  foot: ['foot_l', 'foot_r', 'ball_l', 'ball_r', 'ankle_l', 'ankle_r', 'toes_l', 'toes_r'],
};

/** A body (src/sculpt/assets/low<who>.json) read for building on: points, normals, weights, bones, landmarks. */
export function bodyOf(who) {
  const A = JSON.parse(readFileSync(new URL(`low${who}.json`, ASSETS), 'utf8'));
  const V = [];
  for (let i = 0; i < A.verts.length; i += 3) V.push([A.verts[i], A.verts[i + 1], A.verts[i + 2]]);
  const W = A.weights.map((w) => { const o = []; for (let j = 0; j < w.length; j += 2) o.push([w[j], w[j + 1]]); return o; });
  const tris = [];
  for (let t = 0; t < A.tris.length; t += 4) tris.push({ v: [A.tris[t], A.tris[t + 1], A.tris[t + 2]], poly: A.tris[t + 3] });
  const N = V.map(() => [0, 0, 0]);
  // (from the skin's triangles alone: the brows and the eyes stand off it at their own angles)
  for (const t of tris) { if (A.polys[t.poly][1] === 1 || A.polys[t.poly][1] === 2) continue; const [a, b, c] = t.v.map((i) => V[i]), n = cross(sub(b, a), sub(c, a)); for (const i of t.v) N[i] = add(N[i], n); }
  const bi = new Map(A.bones.map((b, i) => [b.name, i]));
  const partOf = new Map();
  for (const [part, names] of Object.entries(PARTS)) for (const n of names) if (bi.has(n)) partOf.set(bi.get(n), part);
  const dom = W.map((w) => w.reduce((b, x) => (x[1] > b[1] ? x : b), [0, -1])[0]);
  /** How much of a point's weight is on a part's bones. */
  const share = (i, part) => W[i].reduce((s, [b, w]) => s + (partOf.get(b) === part ? w : 0), 0);
  const head = (n) => A.bones[bi.get(n)].head;
  const B = {
    who, A, V, N: N.map(unit), W, tris, bones: A.bones, bi, dom, partOf, share, head,
    part: (i) => partOf.get(dom[i]),
    side: (i) => (V[i][0] >= 0 ? 'l' : 'r'),
    /** Landmarks: heights and points the sets are laid out by. */
    at: {
      top: Math.max(...V.map((p) => p[1])), floor: A.floor,
      head: head('head'), neck: head('neck_01'), chest: head('spine_03'), spine2: head('spine_02'), spine1: head('spine_01'), pelvis: head('pelvis'),
      shoulder: { l: head('upperarm_l'), r: head('upperarm_r') }, elbow: { l: head('lowerarm_l'), r: head('lowerarm_r') }, wrist: { l: head('hand_l'), r: head('hand_r') },
      hip: { l: head('thigh_l'), r: head('thigh_r') }, knee: { l: head('calf_l'), r: head('calf_r') }, ankle: { l: head('foot_l'), r: head('foot_r') }, ball: { l: head('ball_l'), r: head('ball_r') },
    },
  };
  return B;
}

/** Where a point is along a limb (0 at `from`, 1 at `to`) and round it (radians from `front`, toward the body's left). */
export function limbAt(p, from, to, front = [0, 0, 1]) {
  const ax = sub(to, from), L = len(ax), u = mul(ax, 1 / L);
  const t = dot(sub(p, from), u) / L;
  const r = sub(sub(p, from), mul(u, t * L));
  const f = unit(sub(front, mul(u, dot(front, u)))), s = cross(u, f);
  return { t, a: Math.atan2(dot(r, s), dot(r, f)), r: len(r) };
}

/** A part being built: points, their normals and weights, faces (corners and a material), body polygons hidden. */
export function part() { return { V: [], N: [], W: [], F: [], hides: new Set(), soles: [] }; }
const pnMid = (a, b, na, nb) => {
  const w1 = dot(sub(b, a), na), w2 = dot(sub(a, b), nb);
  const b210 = mul(sub(add(mul(a, 2), b), mul(na, w1)), 1 / 3), b120 = mul(sub(add(mul(b, 2), a), mul(nb, w2)), 1 / 3);
  const pn = mul(add(add(a, b), mul(add(b210, b120), 3)), 1 / 8);
  // (out from the straight edge where the surface bulges, never in from it where it is hollow: a hollow's flat body
  // triangle would stand in front of the shell)
  const lin = mul(add(a, b), 0.5), n = unit(add(na, nb));
  return add(lin, mul(n, Math.max(0, dot(sub(pn, lin), n))));
};
const mixW = (ws) => {
  const m = new Map();
  for (const [w, k] of ws) for (const [b, x] of w) m.set(b, (m.get(b) ?? 0) + x * k);
  const top = [...m].sort((a, b) => b[1] - a[1]).slice(0, 4), s = top.reduce((n, x) => n + x[1], 0);
  return top.map(([b, x]) => [b, x / s]);
};

/**
 * A shell over the body's points `keep` says (a body polygon is in when all its points are), subdivided `sub` times, each
 * point out along its normal by `off(q)` (q: its rest point `p` on the body's surface, normal `n`, weights `w`, the body
 * point it is nearest `bv`), each face its material `mat(c)` (c the same of its middle). Its open edges turned back in
 * to `rimIn` off the skin in `rim`'s material (none: left open).
 */
export function shell(B, o) {
  const P = part();
  const keepV = new Set(B.V.map((_, i) => i).filter((i) => o.keep(i)));
  // (the skin and the undergarment only: never the eyes nor the brows, which stand off the face)
  const tris = B.tris.filter((t) => t.v.every((i) => keepV.has(i)) && B.A.polys[t.poly][1] !== 2 && B.A.polys[t.poly][1] !== 1 && (!o.keepTri || o.keepTri(t)));
  // the mesh before pushing out: points on the body, curved between
  const S = { p: [], n: [], w: [], bv: [] };
  const from = new Map();
  const vOf = (i) => { if (!from.has(i)) { from.set(i, S.p.length); S.p.push(B.V[i]); S.n.push(B.N[i]); S.w.push(B.W[i]); S.bv.push(i); } return from.get(i); };
  let T = tris.map((t) => t.v.map(vOf));
  for (let k = 0; k < (o.sub ?? 1); k++) {
    const mid = new Map();
    const m = (a, b) => {
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      if (!mid.has(key)) {
        mid.set(key, S.p.length);
        S.p.push(pnMid(S.p[a], S.p[b], S.n[a], S.n[b]));
        S.n.push(unit(add(S.n[a], S.n[b])));
        S.w.push(mixW([[S.w[a], 0.5], [S.w[b], 0.5]]));
        S.bv.push(len(sub(S.p[a], S.p[S.p.length - 1])) < len(sub(S.p[b], S.p[S.p.length - 1])) ? S.bv[a] : S.bv[b]);
      }
      return mid.get(key);
    };
    T = T.flatMap(([a, b, c]) => { const ab = m(a, b), bc = m(b, c), ca = m(c, a); return [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]]; });
  }
  // (each point's normal anew from the curved mesh, so the push out is smooth)
  const N2 = S.p.map(() => [0, 0, 0]);
  for (const [a, b, c] of T) { const n = cross(sub(S.p[b], S.p[a]), sub(S.p[c], S.p[a])); for (const i of [a, b, c]) N2[i] = add(N2[i], n); }
  S.n = N2.map((n, i) => (dot(n, S.n[i]) < 0 ? S.n[i] : unit(add(unit(n), S.n[i]))));
  const q = (i) => ({ p: S.p[i], n: S.n[i], w: S.w[i], bv: S.bv[i] });
  // (out along the normal, then moved by `move` where the piece says: a cape let straight down behind)
  const out = S.p.map((p, i) => { const r = add(p, mul(S.n[i], o.off(q(i)))); return o.move ? add(r, o.move(q(i))) : r; });
  const base = P.V.length;
  P.V.push(...out); P.N.push(...S.n); P.W.push(...S.w);
  for (const t of T) {
    const c = { p: mul(add(add(S.p[t[0]], S.p[t[1]]), S.p[t[2]]), 1 / 3), n: unit(add(add(S.n[t[0]], S.n[t[1]]), S.n[t[2]])), bv: S.bv[t[0]], at: t.map((i) => q(i)) };
    const name = o.mat(c);
    if (name === null) continue;
    const f = t.map((i) => base + i);
    const fn = cross(sub(out[t[1]], out[t[0]]), sub(out[t[2]], out[t[0]]));
    P.F.push({ v: dot(fn, c.n) < 0 ? [f[0], f[2], f[1]] : f, mat: name });
  }
  // the open edges (a face's edge no other face has), turned back to the skin
  const kept = P.F;
  const edgeN = new Map();
  for (const f of kept) for (let j = 0; j < 3; j++) { const a = f.v[j], b = f.v[(j + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`; edgeN.set(key, (edgeN.get(key) ?? 0) + 1); }
  const open = new Set();
  if (o.rim !== null) {
    const inner = new Map();
    // (turned back to `rimIn` off the skin, or, with `thick`, only so far in from the outside: a hanging edge)
    const inn = (i) => { if (!inner.has(i)) { inner.set(i, P.V.length); const s = i - base; const th = o.thickAt?.(S.p[s]) ?? o.thick; P.V.push(th ? sub(P.V[i], mul(S.n[s], th)) : add(S.p[s], mul(S.n[s], o.rimIn ?? 0.01))); P.N.push(S.n[s]); P.W.push(S.w[s]); } return inner.get(i); };
    for (const f of [...kept]) for (let j = 0; j < 3; j++) {
      const a = f.v[j], b = f.v[(j + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`;
      if (edgeN.get(key) !== 1) continue;
      open.add(S.bv[a - base]); open.add(S.bv[b - base]);
      const ia = inn(a), ib = inn(b);
      P.F.push({ v: [b, a, ia], mat: o.rim ?? f.mat }, { v: [b, ia, ib], mat: o.rim ?? f.mat });
    }
  } else for (const f of kept) for (let j = 0; j < 3; j++) { const a = f.v[j], b = f.v[(j + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`; if (edgeN.get(key) === 1) { open.add(S.bv[a - base]); open.add(S.bv[b - base]); } }
  // the body's polygons under it whole, none of whose points is at its edge, left out
  if (o.hide !== false) {
    const byPoly = new Map();
    for (const t of tris) byPoly.set(t.poly, [...(byPoly.get(t.poly) ?? []), ...t.v]);
    const all = new Map();
    for (const t of B.tris) all.set(t.poly, [...(all.get(t.poly) ?? []), ...t.v]);
    for (const [poly, vs] of byPoly) if ((all.get(poly) ?? []).length === vs.length && !vs.some((i) => open.has(i))) P.hides.add(poly);
  }
  return P;
}

/** The brows (the body's polygons of material 1), hidden under a helm that comes down over them. */
export const browsOf = (B) => B.A.polys.map((p, i) => [p, i]).filter(([p]) => p[1] === 1).map(([, i]) => i);

/** Parts put together into one. */
export function merge(...parts) {
  const P = part();
  for (const Q of parts) {
    const at = P.V.length;
    P.V.push(...Q.V); P.N.push(...Q.N); P.W.push(...Q.W);
    for (const f of Q.F) P.F.push({ v: f.v.map((i) => i + at), mat: f.mat });
    for (const h of Q.hides) P.hides.add(h);
    for (const s of Q.soles ?? []) P.soles.push(s + at);
  }
  return P;
}

/** The nearest of a part's points (or the body's) to `p`: its index. */
export function nearestOf(pts, p, ok = () => true) {
  let best = -1, bd = Infinity;
  pts.forEach((q, i) => { if (!ok(i)) return; const d = len(sub(q, p)); if (d < bd) { bd = d; best = i; } });
  return best;
}

/**
 * A solid made in a frame and put on the body: `rings` (each a list of points in the frame, the same count each, lofted
 * one to the next, the ends capped), placed at `o` with axes `X`, `Y`, `Z` (columns), every point weighted as `w(p)` says
 * (one bone's [[b, 1]], or a body point's).
 */
export function loft(rings, mat, place, w, { capA = true, capB = true, closed = true } = {}) {
  const P = part(), at = (r) => add(place.o, add(add(mul(place.X, r[0]), mul(place.Y, r[1])), mul(place.Z, r[2])));
  const idx = rings.map((ring) => ring.map((r) => { const p = at(r); P.V.push(p); P.N.push([0, 0, 0]); P.W.push(w(p)); return P.V.length - 1; }));
  const mid = (ring) => mul(ring.reduce((s, i) => add(s, P.V[i]), [0, 0, 0]), 1 / ring.length);
  const centre = mul(idx.flat().reduce((s, i) => add(s, P.V[i]), [0, 0, 0]), 1 / idx.flat().length);
  const face = (v, m, from) => { const n = cross(sub(P.V[v[1]], P.V[v[0]]), sub(P.V[v[2]], P.V[v[0]])), c = mul(v.reduce((s, i) => add(s, P.V[i]), [0, 0, 0]), 1 / v.length); P.F.push({ v: dot(n, sub(c, from)) < 0 ? [...v].reverse() : v, mat: typeof m === 'function' ? m(c) : m }); };
  for (let i = 0; i + 1 < idx.length; i++) {
    const a = idx[i], b = idx[i + 1], n = a.length, axis = lerp(mid(a), mid(b), 0.5);
    for (let j = 0; j < (closed ? n : n - 1); j++) {
      const q = [a[j], a[(j + 1) % n], b[(j + 1) % n], b[j]];
      face([q[0], q[1], q[2]], typeof mat === 'function' ? (c) => mat(c, i, j) : mat, axis);
      face([q[0], q[2], q[3]], typeof mat === 'function' ? (c) => mat(c, i, j) : mat, axis);
    }
  }
  const cap = (ring, other) => { const c = P.V.length; P.V.push(mid(ring)); P.N.push([0, 0, 0]); P.W.push(w(mid(ring))); for (let j = 0; j < ring.length; j++) face([ring[j], ring[(j + 1) % ring.length], c], typeof mat === 'function' ? (cc) => mat(cc, -1, j) : mat, add(mid(ring), sub(mid(ring), mid(other)))); };
  if (closed && capA && idx.length > 1) cap(idx[0], idx[1]);
  if (closed && capB && idx.length > 1) cap(idx[idx.length - 1], idx[idx.length - 2]);
  void centre;
  return P;
}
/** A ring of `n` points round the frame's Y at height `y`: radii `rx` (X) and `rz` (Z), turned by `turn`. */
export const ring = (n, y, rx, rz = rx, turn = 0, f = () => 1) => [...Array(n).keys()].map((j) => { const a = turn + (j / n) * TAU, k = f(a); return [Math.sin(a) * rx * k, y, Math.cos(a) * rz * k]; });

/** A bone's rest frame (columns X, Y along the bone, Z) at its head, or moved to `o`. */
export function frameOf(B, name, o) {
  const b = B.bones[B.bi.get(name)];
  return { o: o ?? b.head, X: [b.R[0], b.R[3], b.R[6]], Y: [b.R[1], b.R[4], b.R[7]], Z: [b.R[2], b.R[5], b.R[8]] };
}
/** A frame in the body's own axes (X left, Y up, Z forward) at `o`. */
export const worldFrame = (o) => ({ o, X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] });
/** Weights: all on one bone. */
export const onBone = (B, name) => { const b = B.bi.get(name); return () => [[b, 1]]; };
/** Weights: a body point's, the nearest to where the point is among those `ok` allows. */
export const likeBody = (B, ok = () => true) => (p) => B.W[nearestOf(B.V, p, ok)];

/**
 * The garment asset (src/sculpt/lowpoly.ts GarmentAsset) of a built part: its faces as triangle polygons in its materials
 * (`MATS`: name -> { c, kind, lit? }), the faces from `dropFrom` (a face index) on left out under a chest piece.
 */
export function assetOf(B, P, MATS, { built = 'node tools/sculpt/garments/metalsets.mjs', dropAt } = {}) {
  const names = Object.keys(MATS).filter((n) => P.F.some((f) => f.mat === n));
  const order = dropAt ? [...P.F.keys()].sort((a, b) => (dropAt(P.F[a]) ? 1 : 0) - (dropAt(P.F[b]) ? 1 : 0)) : [...P.F.keys()];
  const polys = [], tris = [];
  let dropFrom;
  for (const fi of order) {
    const f = P.F[fi];
    if (dropAt && dropFrom === undefined && dropAt(f)) dropFrom = polys.length;
    const pi = polys.length;
    polys.push([f.v, names.indexOf(f.mat)]);
    tris.push(...f.v, pi);
  }
  const r5 = (x) => +x.toFixed(5), hex = (h) => [1, 3, 5].map((i) => +(parseInt(h.slice(i, i + 2), 16) / 255).toFixed(4));
  return {
    built, who: B.who, base: B.bones.length, mats: names, colours: names.map((n) => hex(MATS[n].c)),
    plain: names.map((n) => ({ c: MATS[n].c, kind: MATS[n].kind })), enchanted: names.map((n) => MATS[n].lit ?? { c: MATS[n].c, kind: MATS[n].kind }),
    verts: P.V.flat().map(r5), polys, tris, weights: P.W.map((w) => w.flatMap(([b, x]) => [b, r5(x)])), bones: [],
    hides: [...P.hides].sort((a, b) => a - b), ...(P.soles.length ? { soles: P.soles } : {}), ...(dropFrom !== undefined ? { dropFrom } : {}),
  };
}

/**
 * A dome over the head (a helm's shell), rigid on the head bone: a grid of directions from `c` (polar angle from up, 0 to
 * `down`; azimuth from the front, toward the left), each at the farthest the head reaches that way (its points within
 * `cone` of it, `keep` saying which) and `margin(d)` more, smoothed and never pulled in. A face at each grid cell in
 * `mat(d, q)`'s material (null: an opening); its open edges turned in by `thick`.
 */
export function dome(B, o) {
  const c = o.c, rows = o.rows ?? 22, cols = o.cols ?? 32, down = o.down ?? 2.3, cone = Math.cos(o.cone ?? 0.45);
  const pts = B.V.filter((_, i) => o.keep(i));
  const dir = (th, ph) => [Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph)];
  const R = [];
  for (let i = 0; i <= rows; i++) {
    const th = (i / rows) * down, row = [];
    for (let j = 0; j < cols; j++) {
      const ph = (j / cols) * TAU, d = dir(th, ph);
      let r = 0;
      for (const p of pts) { const v = sub(p, c), L = len(v); if (L < 1e-6) continue; const k = dot(v, d) / L; if (k > cone) r = Math.max(r, L * k); }
      row.push(r);
    }
    R.push(row);
  }
  // (smoothed out, never in: each cell the most of its own and its neighbours' mean)
  for (let pass = 0; pass < (o.smooth ?? 3); pass++) {
    const S = R.map((row) => row.slice());
    for (let i = 0; i <= rows; i++) for (let j = 0; j < cols; j++) {
      const n = [R[Math.max(0, i - 1)][j], R[Math.min(rows, i + 1)][j], R[i][(j + 1) % cols], R[i][(j + cols - 1) % cols]];
      S[i][j] = Math.max(R[i][j], (n.reduce((a, b) => a + b, 0) + R[i][j]) / 5);
    }
    for (let i = 0; i <= rows; i++) R[i] = S[i];
  }
  const P = part(), w = onBone(B, o.bone ?? 'head');
  const at = [];
  for (let i = 0; i <= rows; i++) {
    const th = (i / rows) * down, row = [];
    for (let j = 0; j < cols; j++) {
      const ph = (j / cols) * TAU, d = dir(th, ph), q = { th, ph, d, r: R[i][j] };
      P.V.push(add(c, mul(d, R[i][j] + o.margin(q)))); P.N.push(d); P.W.push(w());
      row.push(P.V.length - 1);
    }
    at.push(row);
  }
  const faces = [];
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const th = ((i + 0.5) / rows) * down, ph = ((j + 0.5) / cols) * TAU, d = dir(th, ph);
    const m = o.mat(d, { th, ph, i, j, p: add(c, mul(d, R[i][j])) });
    if (m === null) continue;
    const a = at[i][j], b = at[i][(j + 1) % cols], cc = at[i + 1][(j + 1) % cols], dd = at[i + 1][j];
    // (each quad as two triangles facing out)
    const tri = (v) => { const n = cross(sub(P.V[v[1]], P.V[v[0]]), sub(P.V[v[2]], P.V[v[0]])); faces.push({ v: dot(n, d) < 0 ? [v[0], v[2], v[1]] : v, mat: m }); };
    if (i > 0) tri([a, b, cc]);
    tri([a, cc, dd]);
  }
  P.F.push(...faces);
  // the open edges turned in
  const edgeN = new Map();
  for (const f of faces) for (let k = 0; k < 3; k++) { const a = f.v[k], b = f.v[(k + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`; edgeN.set(key, (edgeN.get(key) ?? 0) + 1); }
  const inner = new Map(), inn = (i) => { if (!inner.has(i)) { inner.set(i, P.V.length); P.V.push(sub(P.V[i], mul(P.N[i], o.thick ?? 0.07))); P.N.push(P.N[i]); P.W.push(w()); } return inner.get(i); };
  for (const f of faces) for (let k = 0; k < 3; k++) {
    const a = f.v[k], b = f.v[(k + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`;
    if (edgeN.get(key) !== 1) continue;
    const ia = inn(a), ib = inn(b);
    P.F.push({ v: [b, a, ia], mat: o.rim ?? f.mat }, { v: [b, ia, ib], mat: o.rim ?? f.mat });
  }
  return P;
}

/* ==== the pieces' parts, each kept to the rules found fitting the copper set ======================================== */
/** How far a point's weight is on these parts of the body. */
export const on = (B, i, ...parts) => parts.reduce((s, p) => s + B.share(i, p), 0);
const yOf = (p) => p[1];
/** Round the torso: radians from the front, toward the body's left. */
export const roundTorso = (p) => Math.atan2(p[0], p[2]);
export const armAt = (B, p) => { const s = p[0] >= 0 ? 'l' : 'r'; return { s, up: limbAt(p, B.at.shoulder[s], B.at.elbow[s]), fore: limbAt(p, B.at.elbow[s], B.at.wrist[s]) }; };
export const legAt = (B, p) => { const s = p[0] >= 0 ? 'l' : 'r'; return { s, thigh: limbAt(p, B.at.hip[s], B.at.knee[s]), shin: limbAt(p, B.at.knee[s], B.at.ankle[s]) }; };
export const waistOf = (A) => lerp(A.spine1, A.pelvis, 0.45)[1];
export const neckCutOf = (A) => A.neck[1] - 0.3;
const frac = (x) => x - Math.floor(x);

/**
 * The torso's shell, from `from` (a height) up to the collar: never the shoulder joint (left to the shoulder plates) nor
 * the top of the arm, its back corners kept low (they cross the trapezius as the neck turns), its collar raised all
 * round. `off(p, n)` is added to the collar's rise; `mat(p, n)` its material.
 */
/** How far the torso piece's collar rises off the body at a point (`torso`): a cape reckons what it covers with it. */
export const collarRise = (A, p) => { const neckCut = neckCutOf(A); return yOf(p) > neckCut - 0.05 && Math.abs(p[0]) < 0.75 ? 0.06 : 0.12 * smooth(neckCut - 0.35, neckCut + 0.1, yOf(p)); };
/** Whether a body point is the shoulder's top (`shoulderCaps`): the arm's outer and upper side near the joint, the neck's side of the trapezius, never the armpit. */
const capRule = (B, i, o = {}) => { const p = B.V[i]; const a = armAt(B, p); return on(B, i, 'shoulder', 'upperarm', 'torso') > 0.6 && (on(B, i, 'shoulder') > 0.08 || on(B, i, 'upperarm') > 0.02) && a.up.t < (o.to ?? 0.15) && Math.abs(p[0]) > (o.inner ?? 0.2) * B.at.shoulder.l[0] && yOf(p) > B.at.chest[1] + 0.2 && yOf(p) < neckCutOf(B.at) + 0.1 && on(B, i, 'neck', 'head') < 0.2 && dot(B.N[i], unit([Math.sign(p[0]), 0.35, 0])) > (o.outer ?? -0.15) && !(Math.abs(p[0]) > 0.62 * B.at.shoulder.l[0] && yOf(p) < B.at.chest[1] + 0.75 && !(B.N[i][2] > 0.5 && yOf(p) > B.at.chest[1] + 0.3)); };
export function torso(B, o) {
  const A = B.at, neckCut = neckCutOf(A);
  // (the pectoral's outer edge, in front of and behind the armpit below the caps: the coat thinned there toward the arm)
  const side = (i) => { const p = B.V[i]; return on(B, i, 'shoulder') < 0.4 && yOf(p) < A.chest[1] + 0.75 && Math.abs(p[0]) < 0.85 * A.shoulder.l[0] && Math.abs(B.N[i][2]) > 0.55; };
  const own = (i) => { const p = B.V[i]; const mid = Math.abs(p[0]) < (o.mid ?? 0.6) * A.shoulder.l[0]; return on(B, i, 'torso', 'shoulder', 'neck') > 0.55 && (on(B, i, 'upperarm') < 0.02 || (mid && on(B, i, 'upperarm') < 0.25)) && (on(B, i, 'shoulder') < 0.12 || mid || side(i)) && yOf(p) > o.from - 0.05 && yOf(p) < neckCut + (Math.abs(p[0]) > 0.5 ? (B.N[i][2] < -0.3 && Math.abs(p[0]) > 0.6 ? 0.02 : 0.3) : 0.12) && (!o.keep || o.keep(i)); };
  // (with `caps`, the shoulders' tops in the same shell, so no body triangle between the two is left uncovered)
  const cap = (i) => !!o.caps && !own(i) && capRule(B, i, o.caps);
  return shell(B, {
    sub: o.sub ?? 2,
    keep: (i) => own(i) || cap(i),
    off: ({ p, n, bv }) => {
      if (cap(bv)) return o.caps.off(p, n);
      const thin = 1 - 0.6 * smooth(0.06, 0.3, B.share(bv, 'shoulder'));
      const collar = yOf(p) > neckCut - 0.05 && Math.abs(p[0]) < 0.75 ? 0.06 : 0.12 * smooth(neckCut - 0.35, neckCut + 0.1, yOf(p));
      return thin * o.off(p, n) + (o.collar ?? 1) * collar;
    },
    mat: ({ p, n, bv }) => (cap(bv) ? o.caps.mat(p, n) : o.mat(p, n)),
    rim: o.rim, thick: o.thick ?? 0.08,
  });
}
/** A shoulder plate over each shoulder: the arm's outer side only, from `from` to `to` along the upper arm, off its front's foot and its back's top. */
export function shoulders(B, o) {
  return shell(B, {
    sub: 2, hide: false,
    keep: (i) => { const p = B.V[i]; if (Math.abs(p[0]) < 0.95 * B.at.shoulder.l[0] * 0.62) return false; const a = armAt(B, p); return on(B, i, 'upperarm', 'shoulder') > 0.35 && a.up.t < (o.to ?? 0.36) && a.up.t > (o.from ?? -0.3) && dot(B.N[i], unit([Math.sign(p[0]), 0.5, 0])) > (o.outer ?? 0.15) && !(B.N[i][2] < -0.35 && a.up.t < 0.1) && !(B.N[i][2] > 0.45 && a.up.t > 0.12); },
    off: ({ p }) => o.off(armAt(B, p).up.t, p),
    mat: ({ p, n }) => o.mat(armAt(B, p).up.t, p, n),
    rim: o.rim, thick: o.thick ?? 0.08,
  });
}
/** The upper arm from `from` to `to` (a sleeve): its inner side open near the armpit. */
export function upperArms(B, o) {
  return shell(B, {
    sub: o.sub ?? 1,
    keep: (i) => {
      const p = B.V[i]; const t = armAt(B, p).up.t;
      // (with \`pit\`, the armpit's front fold as well, under the shoulder's front: the sleeve's own seam there)
      if (o.pit && on(B, i, 'shoulder', 'upperarm') > 0.3 && on(B, i, 'neck') < 0.05 && B.N[i][2] > 0.45 && Math.abs(p[0]) > 0.75 * B.at.shoulder.l[0] && yOf(p) < B.at.shoulder.l[1] && yOf(p) > B.at.chest[1] + 0.2) return true;
      // (the elbow's own points, on the forearm's bones, counted in where a sleeve comes down to it)
      return on(B, i, 'upperarm', 'shoulder') + (t > 0.7 ? on(B, i, 'forearm') : 0) > 0.5 && t > (o.from ?? 0.12) && t < (o.to ?? 0.6) && Math.abs(p[0]) > 0.5 * B.at.shoulder.l[0] && !(t < 0.4 && dot(B.N[i], [Math.sign(p[0]), 0, 0]) < (o.inner ?? -0.2) && B.N[i][2] < (o.innerZ ?? 9) && !(o.faces && Math.abs(B.N[i][2]) > o.faces)); },
    off: ({ p, n }) => o.off(armAt(B, p).up.t, p, n),
    mat: ({ p, n }) => o.mat(armAt(B, p).up, p, n),
    rim: o.rim, thick: o.thick ?? 0.04,
  });
}
/** The forearm from `from` to `to` (a bracer, a vambrace, a sleeve's end). */
export function forearms(B, o) {
  return shell(B, {
    sub: o.sub ?? 2,
    keep: (i) => { const p = B.V[i]; const t = armAt(B, p).fore.t; return on(B, i, 'forearm', o.elbow ? 'upperarm' : 'forearm') > 0.5 && t > (o.from ?? 0.4) && t < (o.to ?? 0.93); },
    off: ({ p }) => o.off(armAt(B, p).fore, p),
    mat: ({ p, n }) => o.mat(armAt(B, p).fore, p, n),
    rim: o.rim, thick: o.thick ?? 0.05,
  });
}
/** The hips and thighs from `top` (a height) down to `foot(s)`, open on the inner side below the hip and at the middle below the crotch. */
export function hips(B, o) {
  const A = B.at;
  return shell(B, {
    sub: o.sub ?? 1, hide: o.hide,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; const inner = dot(B.N[i], [-Math.sign(p[0]), 0, 0]); return on(B, i, 'thigh', 'torso') > 0.6 && on(B, i, 'calf') < 0.3 && yOf(p) < o.top && yOf(p) > o.foot(s) - 0.05 && !(inner > 0.35 && yOf(p) < A.hip[s][1] + 0.1) && !(inner > (o.inner ?? -0.05) && yOf(p) < A.hip[s][1] - 0.35) && !(Math.abs(p[0]) < 0.32 && yOf(p) < A.hip[s][1] - 0.1); },
    off: ({ p }) => o.off(p),
    mat: ({ p, n }) => o.mat(p, n),
    rim: o.rim, thick: o.thick ?? 0.04,
  });
}
/** The shin from the knee (`from`, along knee to ankle) to `to`, round to `round` radians either side of its front (less round the knee). */
export function shins(B, o) {
  return shell(B, {
    sub: 2,
    keep: (i) => { const p = B.V[i]; const g = legAt(B, p).shin; return on(B, i, 'calf', 'thigh') > 0.5 && g.t > (o.from ?? -0.12) && g.t < (o.to ?? 0.88) && Math.abs(g.a) < (g.t < 0.18 ? Math.min(1.7, o.round ?? 2.35) : o.round ?? 2.35); },
    off: ({ p }) => o.off(legAt(B, p).shin, p),
    mat: ({ p, n }) => o.mat(legAt(B, p).shin, p, n),
    rim: o.rim, thick: o.thick ?? 0.05,
  });
}
/** The foot and the ankle to `up` above it: a boot (its points under the soles stood on). `off` and `mat` are given the boot's top height too. */
export function feet(B, o) {
  const A = B.at;
  const keepB = (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'foot', 'calf') > 0.5 && yOf(p) < A.ankle[s][1] + (o.up ?? 0.75); };
  const top = Math.max(...B.V.filter((_, i) => keepB(i)).map((p) => p[1]));
  const P = shell(B, { sub: 2, keep: keepB, off: ({ p, n }) => 0.075 + (n[1] < -0.6 ? 0.04 : 0) + o.off(p, n, top), mat: ({ p, n }) => (n[1] < -0.55 ? o.sole ?? 'sole' : o.mat(p, n, top)), rim: o.rim, thick: o.thick ?? 0.04 });
  P.soles = P.V.map((_, i) => i).filter((i) => P.V[i][1] < A.floor + 0.12);
  return P;
}
/**
 * A cape: from the shoulders' top down the back to `hang` (a height), as wide as `wide(y)` (never past the shoulder
 * joint less a margin), let straight back onto a plane behind the body below the shoulder blades; over the front of the
 * shoulders to `front` (a height) where `frontSide(x)` allows. `under(p)` is how far out what it covers is (the chest piece
 * it goes over); `rim` its edge, `thick` its edge's thickness.
 */
export function cape(B, o) {
  const A = B.at, hang = o.hang;
  const backZ = Math.min(...B.V.filter((p) => p[1] < A.chest[1] && p[1] > A.pelvis[1] - 0.6).map((p) => p[2])) - (o.clear ?? 0.42);
  const most = Math.min(A.shoulder.l[0] * 0.76, A.shoulder.l[0] - 0.5);
  return shell(B, {
    sub: 2, hide: false,
    keep: (i) => {
      const p = B.V[i], n = B.N[i];
      if (on(B, i, 'torso', 'shoulder', 'neck') < 0.6 || on(B, i, 'upperarm') > 0.02 || on(B, i, 'shoulder') > 0.5) return false;
      if (yOf(p) > A.neck[1] + 0.05) return false;
      const wide = Math.min(most, o.wide ? o.wide(yOf(p), most) : most - 0.3 * A.shoulder.l[0] * smooth(A.chest[1], hang, yOf(p)));
      if (n[2] < 0.1) return yOf(p) > hang + (o.slant ? o.slant(p) : 0) && Math.abs(p[0]) < wide && n[2] < -0.2 + (yOf(p) > A.spine2[1] ? 0.3 : 0);
      return Math.abs(p[0]) < wide && yOf(p) > (o.front ?? A.chest[1] - 0.05) && (o.frontSide ? o.frontSide(p[0]) : true);
    },
    off: ({ p, n }) => o.under(p) + collarRise(A, p) + 0.16 + 0.05 * clamp(-n[2]) + (Math.abs(p[0]) > 0.6 && yOf(p) > A.chest[1] ? 0.12 : 0),
    move: ({ p, n }) => (n[2] >= 0.1 ? [0, 0, 0] : [0, 0, -smooth(A.chest[1] + 0.1, A.spine2[1] - 0.2, yOf(p)) * Math.max(0, p[2] - backZ) * 0.8]),
    mat: ({ p, n }) => o.mat(p, n),
    rim: o.rim, thick: o.thick ?? 0.06,
  });
}
/** A disc (a brooch, a boss) on the chest at `at` facing out along `toward`, rigid on spine_03: rings of radius and height, each its material. */
export function disc(B, at, toward, rings) {
  const Z = unit(toward), X = unit(cross([0, 1, 0], Z)), Y = cross(Z, X);
  return loft(rings.map(([r, h]) => ring(12, h, r, r)), (c, i) => rings[Math.min(rings.length - 1, Math.max(0, i))][2], { o: at, X, Y: Z, Z: Y }, onBone(B, 'spine_03'));
}
/** Where on the chest's front a point is, at height `yy` and `x` across: the body's foremost point there. */
export const chestFront = (B, x, yy) => B.V.reduce((b, p, i) => (B.N[i][2] > 0.5 && Math.abs(p[0] - x) < 0.25 && Math.abs(p[1] - yy) < 0.3 && p[2] > b[2] ? p : b), [x, yy, -9]);
/** A helm's centre in the head, the head's points it is fitted over, and a direction's polar angle from there. */
export const headCentre = (B) => [0, B.at.head[1] + 0.72 * (B.at.top - B.at.head[1]) / 1.6, B.at.head[2] + 0.05];
export const headPts = (B) => { const eye = new Set(B.A.polys.filter((p) => p[1] === 2).flatMap((p) => p[0])); return (i) => !eye.has(i) && B.V[i][1] > B.at.neck[1] + 0.05 && on(B, i, 'head', 'neck') > 0.3; };
export const thetaOf = (B, p) => { const c = headCentre(B), v = sub(p, c); return Math.acos(clamp(v[1] / len(v), -1, 1)); };
/** The brow's polar angle: just above the brows, seen from the helm's centre. */
export const browTheta = (B) => thetaOf(B, [0, B.at.head[1] + 0.62, B.at.head[2] + 0.9]);
/** An azimuth's distance from the front, nought to pi. */
export const fromFront = (ph) => Math.abs(Math.atan2(Math.sin(ph), Math.cos(ph)));
/** A helm on the dome (`dome`): the brows hidden under it. */
export function helm(B, o) {
  const P = dome(B, { c: headCentre(B), keep: headPts(B), cone: 0.6, rows: 26, cols: 36, thick: 0.08, ...o });
  for (const b of browsOf(B)) P.hides.add(b);
  return P;
}
export { frac };
/**
 * The top of each shoulder, between the torso piece (which stops short of the joint) and the arm: what a gambeson, a
 * tunic or a coat has there, under any shoulder plate. The arm's outer and upper side down to `to` along the upper arm,
 * the neck's side of the trapezius, never the armpit.
 */
export function shoulderCaps(B, o) {
  return shell(B, {
    sub: 2,
    keep: (i) => { const p = B.V[i]; const a = armAt(B, p); return on(B, i, 'shoulder', 'upperarm', 'torso') > 0.6 && (on(B, i, 'shoulder') > 0.08 || on(B, i, 'upperarm') > 0.02) && a.up.t < (o.to ?? 0.15) && Math.abs(p[0]) > (o.inner ?? 0.2) * B.at.shoulder.l[0] && yOf(p) > B.at.chest[1] + 0.2 && yOf(p) < neckCutOf(B.at) + 0.1 && on(B, i, 'neck', 'head') < 0.2 && dot(B.N[i], unit([Math.sign(p[0]), 0.35, 0])) > (o.outer ?? -0.15); },
    off: ({ p, n }) => o.off(p, n),
    mat: ({ p, n }) => o.mat(p, n),
    rim: o.rim, thick: o.thick ?? 0.04,
  });
}

/**
 * A cloak: a sheet over the shoulders and down the back, two layers with their edges closed. Each of its `cols` columns
 * (across, to `wide(s)` either side, s nought at the top and one at the hem) follows the body's outline in that column's
 * upright slice: from `start(x)` (radians from the front, up over the shoulder) to straight back, as far out as the body's
 * torso, neck and shoulders reach that way and `off(p)` more (`p` the body's point there), smoothed and never pulled in;
 * then straight down to `hang`, never nearer the back (or the seat) than `off` more. Its points carry the body's weights
 * at the nearest point of the torso and the shoulders (on the hanging part, of the torso alone). Faces in `mat(p, u, s)`
 * (u across, -1 to 1), its edges and its inside in `rim`.
 */
export function cloak(B, o) {
  const A = B.at, cols = o.cols ?? 24, top = o.rowsTop ?? 10, down = o.rowsDown ?? 10, thick = o.thick ?? 0.05;
  const cy = A.chest[1] - 0.2, cz = 0;
  const ok = (i) => on(B, i, 'head', 'upperarm', 'forearm', 'hand', 'thigh', 'calf', 'foot') < 0.1 && on(B, i, 'neck') < 0.1;
  const torsoOnly = (i) => on(B, i, 'torso') > 0.95;
  const pts = B.V.map((p, i) => [p, i]).filter(([, i]) => ok(i));
  // (and the points of what it is worn over, \`over\`: the chest piece, but for its arms)
  const armShare = (w, p) => w.reduce((t, [b, x]) => t + (['forearm', 'hand', 'head'].includes(B.partOf.get(b)) || (B.partOf.get(b) === 'upperarm' && p[1] < A.shoulder.l[1] - 0.5) ? x : 0), 0);
  for (const Q of o.over ?? []) Q.V.forEach((p, k) => { if (armShare(Q.W[k], p) < 0.1) pts.push([p, -1]); });
  /** The body's outline in the slice at x, the way (dy, dz) from the slice's centre: the farthest point, and its distance. */
  const reach = (x, a) => {
    const d = [Math.sin(a), Math.cos(a)];
    let r = 0, at = -1, bp = null;
    for (const [p, i] of pts) {
      if (Math.abs(p[0] - x) > 0.22) continue;
      const v = [p[1] - cy, p[2] - cz], L = Math.hypot(v[0], v[1]); if (L < 1e-6) continue;
      const k = (v[0] * d[0] + v[1] * d[1]) / L;
      if (k > Math.cos(0.22) && L * k > r) { r = L * k; at = i; bp = p; }
    }
    return { r, at: at >= 0 || !bp ? at : nearestOf(B.V, bp, ok) };
  };
  const P = part();
  const put = (p, n, w) => { P.V.push(p); P.N.push(n); P.W.push(w); return P.V.length - 1; };
  // (the yoke's rows at the same angles in every column, from the first column's start to straight back; a column's
  // cells before its own start left out)
  const a0 = Math.min(...[...Array(cols + 1).keys()].map((j) => o.start((-1 + (2 * j) / cols) * o.wide(0))));
  const angle = (i) => a0 + (Math.PI - a0) * (i / top);
  const grid = [];
  for (let j = 0; j <= cols; j++) {
    const u = -1 + (2 * j) / cols, x0 = u * o.wide(0), col = [];
    const R = [];
    for (let i = 0; i <= top; i++) { const a = angle(i); R.push({ x: x0, a, ...reach(x0, a), s: i / (top + down) }); }
    // (smoothed out along the column, never in)
    for (let pass = 0; pass < 3; pass++) for (let i = 1; i < top; i++) R[i].r = Math.max(R[i].r, (R[i - 1].r + R[i].r + R[i + 1].r) / 3);
    for (const q of R) {
      const d = [0, Math.sin(q.a), Math.cos(q.a)];
      const base = q.at >= 0 ? B.V[q.at] : [q.x, cy, cz];
      const p = [q.x, cy + d[1] * q.r, cz + d[2] * q.r];
      col.push({ p: add(p, mul(d, o.off(base))), n: d, w: B.W[q.at >= 0 ? q.at : nearestOf(B.V, p, ok)], u, s: q.s, a: q.a, on: q.a >= o.start(x0) - 1e-9 });
    }
    // straight down the back
    const last = col[col.length - 1];
    for (let i = 1; i <= down; i++) {
      const s = (top + i) / (top + down), x = u * o.wide(s), y = last.p[1] + (o.hang - last.p[1]) * (i / down);
      let z = last.p[2] - (o.flare ?? 0.15) * (i / down);
      for (const [p] of pts) if (Math.abs(p[0] - x) < 0.3 && Math.abs(p[1] - y) < 0.3 && p[2] < 0) z = Math.min(z, p[2] - o.off(p));
      // (its folds: \`folds\` across, \`fold\` deep at the hem, out from the back only)
      const fz = (o.fold ?? 0) * (0.5 + 0.5 * Math.cos(u * Math.PI * (o.folds ?? 0))) * (i / down);
      col.push({ p: [x, y, z], fz, n: [0, 0, -1], w: B.W[nearestOf(B.V, [x, y, z + o.off([x, y, z]) + 0.3], torsoOnly)], u, s, on: true });
    }
    grid.push(col);
  }
  // (the hanging part kept from folding back in under the shoulder: each row no nearer than the one above)
  for (const col of grid) for (let i = top + 1; i < col.length; i++) col[i].p[2] = Math.min(col[i].p[2], col[i - 1].p[2]);
  for (const col of grid) for (const q of col) if (q.fz) q.p[2] -= q.fz;
  const O = grid.map((col) => col.map((q) => put(q.p, q.n, q.w)));
  const I = grid.map((col) => col.map((q) => put(sub(q.p, mul(q.n, thick)), q.n, q.w)));
  const tri = (t, n, m) => { const nn = cross(sub(P.V[t[1]], P.V[t[0]]), sub(P.V[t[2]], P.V[t[0]])); const v = dot(nn, n) < 0 ? [t[0], t[2], t[1]] : t; P.F.push({ v, mat: m }); return v; };
  const outer = [];
  const nOf = (j, i) => grid[j][i].n;
  for (let j = 0; j < cols; j++) for (let i = 0; i + 1 < grid[j].length; i++) {
    if (!grid[j][i].on || !grid[j + 1][i].on) continue;
    const n = unit(add(add(nOf(j, i), nOf(j + 1, i)), add(nOf(j, i + 1), nOf(j + 1, i + 1))));
    const c = mul(add(add(P.V[O[j][i]], P.V[O[j + 1][i]]), add(P.V[O[j][i + 1]], P.V[O[j + 1][i + 1]])), 0.25);
    const u = -1 + (2 * (j + 0.5)) / cols, s = (i + 0.5) / (grid[j].length - 1), m = o.mat(c, u, s);
    outer.push({ v: tri([O[j][i], O[j + 1][i], O[j + 1][i + 1]], n, m), n }, { v: tri([O[j][i], O[j + 1][i + 1], O[j][i + 1]], n, m), n });
    tri([I[j][i], I[j + 1][i], I[j + 1][i + 1]], mul(n, -1), o.rim); tri([I[j][i], I[j + 1][i + 1], I[j][i + 1]], mul(n, -1), o.rim);
  }
  // the open edges closed, outer to inner
  const innerOf = new Map(O.flatMap((col, j) => col.map((v, i) => [v, I[j][i]])));
  const edgeN = new Map();
  for (const f of outer) for (let k = 0; k < 3; k++) { const a = f.v[k], b = f.v[(k + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`; edgeN.set(key, (edgeN.get(key) ?? 0) + 1); }
  for (const f of outer) for (let k = 0; k < 3; k++) {
    const a = f.v[k], b = f.v[(k + 1) % 3], key = a < b ? `${a},${b}` : `${b},${a}`;
    if (edgeN.get(key) !== 1) continue;
    const ia = innerOf.get(a), ib = innerOf.get(b);
    P.F.push({ v: [b, a, ia], mat: o.rim }, { v: [b, ia, ib], mat: o.rim });
  }
  return P;
}
