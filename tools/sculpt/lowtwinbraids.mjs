// The twin braids for the low-poly bodies: the game's 'twinbraids', "Twin braids". Modelled from its description
// (tools/sculpt/hairs/twinbraids.mjs, no sheet), in the shape of the shoulder length (tools/sculpt/lowwarrior.mjs): one
// closed shell of locks over the skull, and a plait each side, fitted to each body's own head, neck and chest.
//
//   cap      per side the lock borders: each a path over the skull from the middle parting (forehead to nape) to a ring
//            round the gather below and behind the ear, the front edge along the hairline and behind the ear, the nape's
//            edge along the nape's hairline; per lock a ridge between its two borders stood out and the borders sunk, each
//            border a narrow crease in the valleys' shade. The two sides meet on the parting (its first row a groove in a
//            valley's shade); their edges and the ring each a rim in a darker shade. The inside sunk into the rigid scalp,
//            off the skin elsewhere (the ears, the nape, the neck).
//   plaits   from the gather down beside the neck, over the shoulder and down the front onto the upper chest: links
//            faceted as the side braid's (tools/sculpt/lowbraidbraid.mjs heartAt: two lobes over a point, each tucked
//            under the one above, the first widest over the gather), a small band, a short tuft. Each link rigid on its
//            own bones: the head at the gather, then the skin's under it (the neck's beside the neck, the shoulder's and
//            the chest's lower).
//
// Kept off the face, the ears, the neck, the chest, the shoulders and the arms at rest and in the game's clips' poses
// (tools/sculpt/hairs/twinbraids-poses-<who>.json, written by tools/sculpt/lowtwinbraidsanim.mjs --write): the cap's
// corners moved out from the skull (clearCap), the plaits' links moved off the body under them (clearPlaits).
//
//   node tools/sculpt/lowtwinbraids.mjs [--who female,male] [--raw]   # counts, open edges, crossings at rest and posed
//   (--raw: not cleared in the poses; TWIN_CACHE=<dir>: twinBraidsOf keeps each build there for the review scripts)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig, add, sub, mul, dot, cross, unit, lerp, posed, skin } from './lowrig.mjs';
import { openEdges, skinHair } from './lowhair.mjs';
import { crossReport, POSES } from './lowbob.mjs';
import { radiiOf, dirOf } from './lowwarrior.mjs';
import { heartAt } from './lowbraidbraid.mjs';
import { bodyInside, signedDistance } from './lowbraid.mjs';
import { triTri } from './lowgarment.mjs';
import TWIN from './hairs/twinbraids.mjs';

const DIR = new URL('.', import.meta.url).pathname;
const rad = (x) => (x * Math.PI) / 180, deg = (x) => (x * 180) / Math.PI;
const angOf = (d) => [deg(Math.atan2(d[0], d[2])), deg(Math.asin(Math.max(-1, Math.min(1, d[1]))))];
const ramp = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
/** The parts of the body the plaits are kept off. */
export const PLAIT_PARTS = ['head', 'neck', 'torso', 'joint', 'arm', 'hand'];

/** The furthest crossing of a ray from o along unit d with triangles ({ P: three points, poly }): { t, poly }. */
function farHit(tris, o, d) {
  let best = 0, poly = -1;
  for (const { P: [a, b, c], poly: pi } of tris) {
    const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
    if (Math.abs(det) < 1e-12) continue;
    const s = sub(o, a), u = dot(s, p) / det; if (u < -1e-7 || u > 1 + 1e-7) continue;
    const q = cross(s, e1), v = dot(d, q) / det; if (v < -1e-7 || u + v > 1 + 1e-7) continue;
    const t = dot(e2, q) / det; if (t > best) { best = t; poly = pi; }
  }
  return { t: best, poly };
}

/** Catmull-Rom through points, at u in [0, 1] over the whole run. */
function spline(pts, u) {
  const n = pts.length - 1, x = Math.min(n - 1e-9, Math.max(0, u * n)), i = Math.floor(x), t = x - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  return p1.map((_, k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t));
}
/** A polyline's points at shares `at` of its length. */
function alongOf(pts, at) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(...sub(pts[i], pts[i - 1])));
  return at.map((f) => {
    const w = f * L.at(-1); let i = 1; while (i < L.length - 1 && L[i] < w) i++;
    return lerp(pts[i - 1], pts[i], Math.min(1, Math.max(0, (w - L[i - 1]) / Math.max(1e-9, L[i] - L[i - 1]))));
  });
}
const slerp = (a, b, u) => { const w = Math.acos(Math.min(1, Math.max(-1, dot(a, b)))); if (w < 1e-6) return a; return add(mul(a, Math.sin((1 - u) * w) / Math.sin(w)), mul(b, Math.sin(u * w) / Math.sin(w))); };

/** The game's clips' poses the hair is kept clear in (tools/sculpt/hairs/twinbraids-poses-<who>.json), or none. */
function posesOf(who) {
  try { return JSON.parse(readFileSync(join(DIR, `hairs/twinbraids-poses-${who}.json`), 'utf8')); } catch { return []; }
}

/* ---- the cap ------------------------------------------------------------------------------------------------------ */

/** The middle line at a (0 the forehead's hairline, 1 the nape), a direction from the skull's middle. */
const midOf = (S, a) => { const s = rad(S.part[0] + a * (S.part[1] - S.part[0])); return [0, Math.sin(s), Math.cos(s)]; };
/** The ring round the gather (her left) at psi degrees round it (0 toward the back, 90 toward the crown). */
function ringOf(S, psi, r = S.gather.r) {
  const t = rad(S.gather.th), p = rad(S.gather.ph), G = dirOf(S.gather.th, S.gather.ph);
  const eT = [Math.cos(t), 0, -Math.sin(t)], eP = [-Math.sin(t) * Math.sin(p), Math.cos(p), -Math.cos(t) * Math.sin(p)];
  const q = rad(psi), s = Math.sin(rad(r));
  return unit(add(mul(G, Math.cos(rad(r))), mul(add(mul(eT, Math.cos(q)), mul(eP, Math.sin(q))), s)));
}
const psiOf = (S, a) => S.gather.psi[0] + a * (S.gather.psi[1] - S.gather.psi[0]);

/** A border's path over the skull (her left), at a in [0, 1]: its directions at the style's capRows. The straight way
 * (the great circle) from the parting to the ring, bent toward the front edge's curve near the front. */
function pathOf(S, a) {
  const M0 = midOf(S, 0), E0 = ringOf(S, psiOf(S, 0)), M = midOf(S, a), E = ringOf(S, psiOf(S, a));
  const N = 160, frontPts = [M0, ...S.front.map((p) => dirOf(...p)), E0];
  const fine = alongOf(Array.from({ length: N + 1 }, (_, i) => unit(spline(frontPts, i / N))), Array.from({ length: N + 1 }, (_, i) => i / N));
  const w = Math.max(0, 1 - a / S.frontBlend);
  const pts = Array.from({ length: N + 1 }, (_, i) => { const u = i / N; return unit(add(slerp(M, E, u), mul(sub(fine[i], slerp(M0, E0, u)), w))); });
  return alongOf(pts, S.capRows).map(unit);
}

/**
 * The cap: { verts, polys, grid, cols }. Her right's columns from the front edge back to the nape's edge, then her left's
 * from the nape's edge to the front edge; the parting's corners (each column's first) shared by the two sides.
 */
function buildCap(rig, S, verts, polys) {
  const B = rig.B, { C, body, polyAt } = radiiOf(rig);
  // the columns, her left: the front edge, then per lock its first border's crease edge, its ridge, its last border's;
  // the last lock's last the nape's edge
  const half = [{ a: 0, kind: 'edge' }];
  for (let i = 0; i + 1 < S.locks.length; i++) {
    const a0 = S.locks[i], a1 = S.locks[i + 1], last = i + 2 === S.locks.length;
    if (i > 0) half.push({ a: a0 + S.crease, kind: 'border', lock: i });
    half.push({ a: (a0 + a1) / 2, kind: 'ridge', lock: i });
    half.push(last ? { a: 1, kind: 'edge' } : { a: a1 - S.crease, kind: 'border', lock: i, crease: true });
  }
  const nh = half.length, cols = [...half.map((c) => ({ ...c, side: -1 })), ...half.slice().reverse().map((c) => ({ ...c, side: 1 }))];
  // (the strip from a column to the next: within a side; a border's valley between a lock's last border and the next's first)
  for (let j = 0; j + 1 < cols.length; j++) {
    const c = cols[j], n = cols[j + 1];
    c.next = j + 1 !== nh;
    c.creaseNext = c.next && ((c.side < 0 && c.crease === true) || (c.side > 0 && c.kind === 'border' && !c.crease && n.crease === true));
  }
  const nc = cols.length, KC = S.capRows.length;
  const mirror = (d, s) => [d[0] * s, d[1], d[2]];
  const paths = cols.map((c) => pathOf(S, c.a).map((d) => mirror(d, c.side)));
  // the outside's height off the skin: the parting's, over the skull, the gathered hair's toward the ring; a lock's
  // relief (none on the parting, its full share from a third of the way)
  const thickAt = (c, f) => {
    const base = c.kind === 'edge' ? S.edgeThick : S.capThick;
    return S.partThick + (base - S.partThick) * Math.min(1, f * 2.5) + (S.gather.thick - base) * ramp(f, 0.55, 1) ** 2;
  };
  const relOf = (c, f) => (c.kind === 'edge' ? 0 : S.relief * (c.kind === 'ridge' ? 1 : -0.6) * Math.min(1, 3 * f));
  const hairline = B.verts[B.index.get('t0')][1] - S.hairlineDrop;
  const rigid = (i) => rig.weights[B.names[i]].every(([bn, w]) => bn === 'head' || w < 1e-3);
  const offScalp = (pl) => pl && (pl.ear || pl.part === 'neck' || !pl.v.every(rigid));
  const notScalp = (d, rb) => {
    const p = add(C, mul(d, rb)), [th, ph] = angOf(d), e = S.offScalp;
    for (const [a, b] of [[0, 0], [e, 0], [-e, 0], [0, e], [0, -e], [e, e], [-e, e], [e, -e], [-e, -e]]) if (offScalp(B.polys[polyAt(dirOf(th + a, ph + b))])) return 1;
    return Math.max(ramp(p[2] - C[2], 0.05, 0.3) * ramp(hairline - p[1], 0, 0.08), ramp(C[1] - 0.35 - p[1], 0, 0.15));
  };
  const outer = [], inner = [];
  for (let j = 0; j < nc; j++) {
    const c = cols[j], o = [], n = [];
    // (an edge's inside off the skin by lip all along it: each corner raised until the straight edges either side of
    // it clear the skin under them)
    const edgeLift = (i) => {
      let need = 0;
      for (const k of [i - 1, i + 1]) {
        if (k < 0 || k >= KC) continue;
        for (let t = 0; t <= 1; t += 0.1) { const m = lerp(paths[j][i], paths[j][k], t); need = Math.max(need, (body(unit(m)) + S.lip) / Math.hypot(...m)); }
      }
      return need;
    };
    for (let i = 0; i < KC; i++) {
      const d = paths[j][i], rb = body(d), f = S.capRows[i], ns = notScalp(d, rb);
      let rr = rb + Math.max(S.minThick, thickAt(c, f) + relOf(c, f)), ri = rb - S.sink + (S.sink + S.capClear) * ns;
      if (c.kind === 'edge' && i > 0) { ri = Math.max(ri, rb + S.lip, edgeLift(i)); rr = Math.max(rr, ri + S.minThick); }
      ri = Math.min(ri, rr - S.minThick * 0.5);
      o.push(add(C, mul(d, rr))); n.push(add(C, mul(d, ri)));
    }
    outer.push(o); inner.push(n);
  }
  const V = (p) => verts.push(p) - 1, base = polys.length;
  const partO = new Map(), partI = new Map(), key = (a) => a.toFixed(5);
  const shared = (M, col, j) => col.map((p, i) => (i ? V(p) : M.get(key(cols[j].a)) ?? (M.set(key(cols[j].a), V(p)), M.get(key(cols[j].a)))));
  const oi = outer.map((col, j) => shared(partO, col, j)), ii = inner.map((col, j) => shared(partI, col, j));
  const poly = (v, sh = {}) => { const u = v.filter((x, k) => x !== v[(k + 1) % v.length]); if (u.length >= 3) polys.push({ v: u, piece: 0, ...sh }); };
  for (let j = 0; j + 1 < nc; j++) {
    if (!cols[j].next) continue;
    const k = j + 1, crease = cols[j].creaseNext ? { valley: S.creaseShade } : {};
    for (let i = 0; i + 1 < KC; i++) {
      poly([oi[j][i], oi[k][i], oi[k][i + 1], oi[j][i + 1]], i === 0 ? { valley: S.partShade } : crease);
      poly([ii[j][i], ii[j][i + 1], ii[k][i + 1], ii[k][i]], { valley: S.insideShade, inside: true });
    }
    // the ring's rim
    poly([oi[j][KC - 1], oi[k][KC - 1], ii[k][KC - 1], ii[j][KC - 1]], { valley: S.rimShade, rim: true });
  }
  // the edges' rims: each side's front edge and nape edge (the first column of a side's run, the last)
  for (const j of [0, nh - 1, nh, nc - 1]) for (let i = 0; i + 1 < KC; i++) {
    const q = [oi[j][i], oi[j][i + 1], ii[j][i + 1], ii[j][i]];
    poly(j === 0 || j === nh ? q : q.slice().reverse(), { valley: S.rimShade, rim: true });
  }
  const capPolys = polys.slice(base);
  let vol = 0;
  for (const p of capPolys) for (let j = 1; j + 1 < p.v.length; j++) vol += dot(sub(verts[p.v[0]], C), cross(sub(verts[p.v[j]], C), sub(verts[p.v[j + 1]], C)));
  if (vol < 0) for (const p of capPolys) p.v.reverse();
  coverSkin(B, C, verts, capPolys, S.cover);
  return { C, cols, grid: { outer: oi, inner: ii }, polys: [base, polys.length] };
}

/**
 * The cap's outside over the head's skin: a point of the skin (not the ears') under the cap and within `margin` of its
 * outside moves the outside's face there out along its corners' rays, until none is.
 */
function coverSkin(B, C, verts, polys, margin) {
  const skinV = [];
  for (const t of B.tris) {
    const p = B.polys[t.poly]; if (p.part !== 'head' || p.mat !== 'skin' || p.ear) continue;
    const [a, b, c] = t.v.map((i) => B.verts[i]);
    const n = Math.max(1, Math.ceil(Math.max(Math.hypot(...sub(b, a)), Math.hypot(...sub(c, a)), Math.hypot(...sub(c, b))) / 0.03));
    for (let i = 0; i <= n; i++) for (let j = 0; i + j <= n; j++) skinV.push(add(a, add(mul(sub(b, a), i / n), mul(sub(c, a), j / n))));
  }
  const cap = polys.filter((p) => !p.inside && !p.rim);
  for (let it = 0; it < 30; it++) {
    const T = trisOf(verts, cap).map(([a, b, c]) => ({ P: [verts[a], verts[b], verts[c]], poly: [a, b, c] }));
    const push = new Map();
    for (const v of skinV) {
      const w = sub(v, C), rv = Math.hypot(...w), h = farHit(T, C, mul(w, 1 / rv));
      if (h.t > 0 && h.t < rv + margin) for (const i of h.poly) push.set(i, Math.max(push.get(i) ?? 0, rv + margin - h.t));
    }
    if (!push.size) break;
    for (const [i, by] of push) { const w = sub(verts[i], C), l = Math.hypot(...w); verts[i] = add(C, mul(w, (l + by + 0.002) / l)); }
  }
}

/** Each polygon's triangles (a quad by its shorter diagonal, a larger polygon a fan). */
function trisOf(verts, polys, first = 0) {
  const tris = [];
  polys.forEach((p, k) => {
    const pi = first + k;
    if (p.v.length === 4) {
      const [a, b, c, d] = p.v;
      if (Math.hypot(...sub(verts[a], verts[c])) <= Math.hypot(...sub(verts[b], verts[d]))) tris.push([a, b, c, pi], [a, c, d, pi]); else tris.push([a, b, d, pi], [b, c, d, pi]);
    } else for (let j = 1; j + 1 < p.v.length; j++) tris.push([p.v[0], p.v[j], p.v[j + 1], pi]);
  });
  return tris;
}

/** The head's skin polygons (not the ears) under the cap's polygons that pass `keep`, seen from the skull's middle: with
 * `every` corner under it, or `some`. */
function scalpOf(B, C, hair, how, keep) {
  const T = hair.tris.filter(([, , , pi]) => keep(hair.polys[pi])).map(([a, b, c]) => ({ P: [hair.verts[a], hair.verts[b], hair.verts[c]], poly: 0 })), memo = new Map();
  const under = (vi) => { if (!memo.has(vi)) memo.set(vi, farHit(T, C, unit(sub(B.verts[vi], C))).t > 0); return memo.get(vi); };
  const out = [];
  B.polys.forEach((p, i) => { if (p.part === 'head' && p.mat === 'skin' && !p.ear && p.v[how](under)) out.push(i); });
  return out;
}

/* ---- the body's distance field (for laying the plaits on it) ------------------------------------------------------ */

const FIELDS = new Map();
/** The body's signed distance at rest (head, neck, torso; each closed shell's own inside), trilinear, and the way out. */
function fieldOf(rig) {
  if (FIELDS.has(rig.who)) return FIELDS.get(rig.who);
  const B = rig.B, lo = [-1.8, -2.4, -1.5], vox = 0.03, n = [Math.ceil(3.6 / vox), Math.ceil(4.8 / vox), Math.ceil(3.2 / vox)];
  const shells = B.tris.map((t) => { const p = B.polys[t.poly]; return ['head', 'neck', 'torso'].includes(p.part) ? (p.ear ? 'ear' : p.mat) : null; });
  const I = new Uint8Array(n[0] * n[1] * n[2]);
  for (const sh of new Set(shells.filter(Boolean))) {
    const g = bodyInside(B.tris.filter((_, i) => shells[i] === sh).map((t) => t.v.map((i) => B.verts[i])), lo, n, vox);
    for (let i = 0; i < I.length; i++) I[i] |= g[i];
  }
  const D = signedDistance(I, n, vox), [nx, ny] = n;
  const sdf = (p) => {
    const x = (p[0] - lo[0]) / vox - 0.5, y = (p[1] - lo[1]) / vox - 0.5, z = (p[2] - lo[2]) / vox - 0.5;
    const i = Math.max(0, Math.min(n[0] - 2, Math.floor(x))), j = Math.max(0, Math.min(n[1] - 2, Math.floor(y))), k = Math.max(0, Math.min(n[2] - 2, Math.floor(z)));
    const fx = Math.min(1, Math.max(0, x - i)), fy = Math.min(1, Math.max(0, y - j)), fz = Math.min(1, Math.max(0, z - k));
    let v = 0;
    for (const [a, b, c] of [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]]) v += D[i + a + nx * (j + b + ny * (k + c))] * (a ? fx : 1 - fx) * (b ? fy : 1 - fy) * (c ? fz : 1 - fz);
    return v;
  };
  const away = (p) => unit([0, 1, 2].map((c) => { const e = [0, 0, 0]; e[c] = 0.04; return sdf(add(p, e)) - sdf(sub(p, e)); }));
  const out = { sdf, away };
  FIELDS.set(rig.who, out);
  return out;
}

/* ---- the plaits --------------------------------------------------------------------------------------------------- */

/**
 * A plait's spine (side: 1 her left, -1 her right): from over the gather, down beside the neck, over the shoulder and
 * down the front; n + 1 points, each kept clear(i) off the body, smoothed.
 */
function spineOf(rig, S, side, C, body) {
  const P = S.plait, F = P[rig.who], { sdf, away } = fieldOf(rig), her = (x, y, z) => [x * side, y, z];
  const g = dirOf(S.gather.th, S.gather.ph), G = [g[0] * side, g[1], g[2]];
  const root = add(C, mul(G, body(G) + S.gather.thick + P.lift + 0.95 * P.depth * P.width * P.first));
  const clearAt = (f) => 0.95 * P.depth * widthOf(P, f * (F.n - 1)) + F.gap;
  const meet = (p, dir, c) => { let q = p; for (let t = 0; t < 600 && sdf(q) > c; t++) q = add(q, mul(dir, 0.005)); return q; };
  const N0 = her(...F.neck), Nq = meet(N0, unit(sub([0, N0[1], N0[2]], N0)), clearAt(0.2));
  const Sq = meet(her(F.shoulder[0], Nq[1], F.shoulder[1]), [0, -1, 0], clearAt(0.4));
  const Fq = F.chest.map(([x, y], j) => meet(her(x, y, 2), [0, 0, -1], clearAt(0.65 + 0.35 * (j / Math.max(1, F.chest.length - 1)))));
  const guide = [root, Nq, Sq, ...Fq];
  if (process.env.TWIN_DEBUG) console.log(rig.who, side, 'guide', guide.map((p) => `${p.map((x) => x.toFixed(2)).join(',')} sd ${sdf(p).toFixed(2)}`).join(' | '));
  const fine = Array.from({ length: 401 }, (_, i) => spline(guide, i / 400));
  const X = alongOf(fine, Array.from({ length: F.n + 1 }, (_, i) => i / F.n));
  for (let r = 0; r < 30; r++) {
    for (let i = 1; i <= F.n; i++) { const c = clearAt(i / F.n), sd = sdf(X[i]); if (sd < c) X[i] = add(X[i], mul(away(X[i]), c - sd)); }
    for (let i = 1; i < F.n; i++) X[i] = add(mul(X[i], 0.5), mul(add(X[i - 1], X[i + 1]), 0.25));
  }
  // (where along it the neck's guide and the shoulder's are: the bones change there)
  const near = (q) => X.reduce((b, p, i) => (Math.hypot(...sub(p, q)) < Math.hypot(...sub(X[b], q)) ? i : b), 0) / F.n;
  return { X, at: { neck: near(Nq), shoulder: near(Sq) } };
}
/** A link's width (link i of n, the first widest). */
const widthOf = (P, i) => P.width * (i < 1 ? P.first + (1 - P.first) * i : 1 + (P.end - 1) * Math.min(1, i / 10));

/** The skin's bones near a point: the neck's and the torso's `near` nearest corners' weights, by inverse distance. */
function skinBonesAt(rig, p, near = 6) {
  const B = rig.B, ids = [];
  B.verts.forEach((v, i) => { if (B.part[i] === 'neck' || B.part[i] === 'torso') ids.push([Math.hypot(...sub(v, p)), i]); });
  ids.sort((a, b) => a[0] - b[0]);
  const m = new Map(); let tot = 0;
  for (const [d, i] of ids.slice(0, near)) { const k = 1 / Math.max(1e-3, d); tot += k; for (const [bn, w] of rig.weights[B.names[i]]) m.set(bn, (m.get(bn) ?? 0) + w * k); }
  return [...m].map(([bn, w]) => [bn, w / tot]);
}
/** A link's bones (its share s down the plait, p the skin under its middle): on the head over the gather, then the skin's
 * there (the neck's beside the neck, the chest's and the shoulder's lower), blended from the first link's end to the
 * neck's guide; each link rigid on them. */
function weightAt(rig, at, n, s, p) {
  const h = 1 - ramp(s, 1 / n, Math.max(1.5 / n, at.neck)), m = new Map([['head', h]]);
  if (h < 1) for (const [bn, w] of skinBonesAt(rig, p)) m.set(bn, (m.get(bn) ?? 0) + w * (1 - h));
  const out = [...m].filter(([, w]) => w > 0.01), tot = out.reduce((a, [, w]) => a + w, 0);
  return out.map(([bn, w]) => [bn, w / tot]);
}

/** A plait's links, band and tuft on its spine X: into verts/polys (each piece's own polys), each vertex its share. */
function plaitMesh(rig, S, side, X, verts, polys, shares, pieces, tag) {
  const P = S.plait, n = X.length - 1, { away } = fieldOf(rig);
  // the faces' way out: off the body, a little to the front, smoothed down the plait
  let Ns = X.map((p) => unit(add(away(p), [0, 0, P.front])));
  for (let r = 0; r < 4; r++) Ns = Ns.map((d, i) => unit(add(mul(d, 2), add(Ns[Math.max(0, i - 1)], Ns[Math.min(n, i + 1)]))));
  const frame = (i0, i1) => {
    const T = unit(sub(X[i1], X[i0])); let N = unit(add(Ns[i0], Ns[i1])); N = unit(sub(N, mul(T, dot(N, T))));
    return { T, N, U: cross(N, T) };
  };
  const piece = (id, fn) => { const p0 = polys.length, v0 = verts.length; fn(); pieces.push({ id: `${tag}${id}`, kind: 'plait', side, polys: [p0, polys.length], verts: [v0, verts.length] }); };
  const V = (p, s) => { shares.push(s); return verts.push(p) - 1; };
  const poly = (v, sh) => polys.push({ v, piece: pieces.length, plait: side, ...sh });
  for (let i = 0; i < n; i++) piece(`link${i + 1}`, () => {
    const { T, N, U } = frame(i, i + 1), c = lerp(X[i], X[i + 1], 0.5), H = Math.hypot(...sub(X[i + 1], X[i])) * P.stretch;
    heartAt(V, poly, c, U, T, N, H, widthOf(P, i), (i + 0.5) / n, undefined, P.depth);
  });
  // the band and the tuft past the last link's point
  const { T, N, U } = frame(n - 1, n), w = widthOf(P, n - 1), end = add(X[n], mul(T, -0.15 * Math.hypot(...sub(X[n], X[n - 1]))));
  const ring = (c, wd, dp, m = 6, twist = 0) => Array.from({ length: m }, (_, j) => { const a = rad((j / m) * 360 + twist); return V(add(c, add(mul(U, (Math.cos(a) * wd) / 2), mul(N, (Math.sin(a) * dp) / 2))), 1); });
  const run = (rings, shade) => {
    for (let i = 0; i + 1 < rings.length; i++) {
      const a = rings[i], b = rings[i + 1], m = Math.max(a.length, b.length);
      for (let j = 0; j < m; j++) poly(a.length === 1 ? [a[0], b[(j + 1) % m], b[j]] : b.length === 1 ? [a[j], a[(j + 1) % m], b[0]] : [a[j], a[(j + 1) % m], b[(j + 1) % m], b[j]], shade(i, j));
    }
  };
  const at = (t) => add(end, mul(T, t));
  const bw = w * P.band.w, tw = w * P.tuft.w, d = P.depth * 2;
  piece('band', () => run([[V(at(-0.01), 1)], ring(at(0), bw, bw * d * 0.9, 6, 30), ring(at(P.band.len), bw, bw * d * 0.9, 6, 30), [V(at(P.band.len + 0.01), 1)]], () => ({ valley: P.bandShade })));
  piece('tuft', () => {
    const t0 = P.band.len * 0.5, L = P.tuft.len;
    run([[V(at(t0), 1)], ring(at(t0 + 0.02), bw * 0.9, bw * d * 0.8), ring(at(t0 + L * 0.45), tw, tw * d * 0.75, 6, 30), ring(at(t0 + L * 0.8), tw * 0.6, tw * d * 0.45), [V(at(t0 + L), 1)]], (i) => (i === 3 ? { valley: 3 } : {}));
  });
}

/** Each plait piece's faces wound alike (each turned to agree with a neighbour across a shared edge, from the first),
 * then turned outward (its volume about its own middle positive). */
function orientPieces(verts, polys, pieces) {
  for (const pc of pieces) {
    if (pc.kind !== 'plait') continue;
    const ids = []; for (let i = pc.polys[0]; i < pc.polys[1]; i++) ids.push(i);
    const byEdge = new Map(), key = (a, b) => (a < b ? a + ',' + b : b + ',' + a);
    for (const i of ids) polys[i].v.forEach((a, j) => { const b = polys[i].v[(j + 1) % polys[i].v.length], kk = key(a, b); (byEdge.get(kk) ?? byEdge.set(kk, []).get(kk)).push(i); });
    const done = new Set();
    for (const s0 of ids) {
      if (done.has(s0)) continue;
      done.add(s0); const q = [s0];
      while (q.length) {
        const i = q.pop(), v = polys[i].v;
        v.forEach((a, j) => {
          const b = v[(j + 1) % v.length];
          for (const n of byEdge.get(key(a, b))) {
            if (n === i || done.has(n)) continue;
            const w = polys[n].v, m = w.indexOf(a);
            if (w[(m + 1) % w.length] === b) w.reverse();
            done.add(n); q.push(n);
          }
        });
      }
    }
    const m = [0, 0, 0]; let nv = 0;
    for (let v = pc.verts[0]; v < pc.verts[1]; v++) { for (let k = 0; k < 3; k++) m[k] += verts[v][k]; nv++; }
    const c = mul(m, 1 / nv);
    let vol = 0;
    for (const i of ids) { const v = polys[i].v; for (let j = 1; j + 1 < v.length; j++) vol += dot(sub(verts[v[0]], c), cross(sub(verts[v[j]], c), sub(verts[v[j + 1]], c))); }
    if (vol < 0) for (const i of ids) polys[i].v.reverse();
  }
}

/* ---- the whole ---------------------------------------------------------------------------------------------------- */

/** The hair from a cap (kept) and the two spines: { verts, polys, tris, weights, pieces, ... }. */
function assemble(rig, S, cap, spines) {
  const verts = cap.verts.map((p) => [...p]), polys = cap.polys.map((p) => ({ ...p, v: [...p.v] })), pieces = [{ id: 'cap', kind: 'shell', polys: [0, polys.length], verts: [0, verts.length] }];
  const shares = verts.map(() => null);
  for (const sp of spines) {
    plaitMesh(rig, S, sp.side, sp.X, verts, polys, shares, pieces, sp.side > 0 ? 'L' : 'R');
  }
  orientPieces(verts, polys, pieces);
  const tris = trisOf(verts, polys);
  // (each plait piece rigid on the bones at its middle)
  const weights = verts.map(() => [['head', 1]]);
  for (const pc of pieces) {
    if (pc.kind !== 'plait') continue;
    const sp = spines.find((x) => x.side === pc.side), m = [0, 0, 0];
    for (let v = pc.verts[0]; v < pc.verts[1]; v++) for (let k = 0; k < 3; k++) m[k] += verts[v][k] / (pc.verts[1] - pc.verts[0]);
    // (the skin's bones where the link would rest on it: its middle carried back onto the body)
    const { sdf, away } = fieldOf(rig), W = weightAt(rig, sp.at, sp.X.length - 1, shares[pc.verts[0]], sub(m, mul(away(m), sdf(m))));
    for (let v = pc.verts[0]; v < pc.verts[1]; v++) weights[v] = W;
  }
  return { verts, polys, tris, weights, pieces, centre: cap.C, k: 1, grid: cap.grid, spines };
}

/** The states the hair is checked in: rest, the head's turns and nod (lowbob POSES), the clips' poses. */
function statesOf(rig) {
  const out = [{ P: rig.B.verts, f: null, clip: 'rest' }];
  for (const [name, pose] of Object.entries(POSES)) { const f = posed(rig, pose); out.push({ P: skin(rig, f), f, clip: name }); }
  for (const pose of posesOf(rig.who)) { const f = posed(rig, pose); out.push({ P: skin(rig, f), f, clip: pose.$clip }); }
  return out;
}

const bbOf = (pts) => [0, 1, 2].map((k) => [Math.min(...pts.map((p) => p[k])), Math.max(...pts.map((p) => p[k]))]);
/** The plaits' triangles through the body's (PLAIT_PARTS) in one state: [hair triangle's polygon, body polygon, posed
 * centre of the body triangle]. */
export function plaitHits(rig, hair, P, H, parts = PLAIT_PARTS) {
  const B = rig.B, hits = [];
  const mine = hair.tris.filter(([, , , pi]) => hair.polys[pi].plait);
  if (!mine.length) return hits;
  const all = bbOf(mine.flatMap(([a, b, c]) => [H[a], H[b], H[c]])).map(([lo, hi]) => [lo - 0.05, hi + 0.05]);
  const body = [];
  for (const t of B.tris) {
    if (!parts.includes(B.polys[t.poly].part)) continue;
    const T = t.v.map((i) => P[i]), bb = bbOf(T);
    if (bb.some(([lo, hi], k) => hi < all[k][0] || lo > all[k][1])) continue;
    body.push({ T, bb, poly: t.poly });
  }
  for (const [a, b, c, pi] of mine) {
    const A = [H[a], H[b], H[c]], ab = bbOf(A);
    for (const s of body) {
      if (ab.some(([lo, hi], k) => hi < s.bb[k][0] || lo > s.bb[k][1])) continue;
      if (triTri(A, s.T)) { hits.push([pi, s.poly, mul(add(add(s.T[0], s.T[1]), s.T[2]), 1 / 3)]); break; }
    }
  }
  return hits;
}

/**
 * The plaits off the body in every state: a link through the body has its two spine points moved `step` at a time
 * away from the body there (at rest the distance field's way out; in a pose, from the body's triangle toward the link,
 * turned back into the rest frame by the link's own bones), their neighbours with them by a bell, the spine smoothed,
 * until no link is. The gather's point stays.
 */
function clearPlaits(rig, S, cap, spines, states, step = 0.01) {
  const { away } = fieldOf(rig);
  for (const sp of spines) sp.X0 = sp.X.map((p) => [...p]);
  let hair = assemble(rig, S, cap, spines), live = states;
  const hitsIn = (h, st) => plaitHits(rig, h, st.P, st.f ? skinHair(rig, h, st.f) : h.verts);
  for (let it = 0; it < 120; it++) {
    let per = live.map((st) => hitsIn(hair, st));
    if (!per.some((x) => x.length) && live !== states) { live = states; per = live.map((st) => hitsIn(hair, st)); }
    if (!per.some((x) => x.length)) break;
    const push = new Map();
    per.forEach((hits, k) => {
      const st = live[k];
      for (const [pi, , q] of hits) {
        const pc = hair.pieces[hair.polys[pi].piece], sp = spines.find((s) => s.side === pc.side), m = /link(\d+)/.exec(pc.id), i = m ? +m[1] - 1 : sp.X.length - 2;
        const mid = lerp(sp.X[i], sp.X[i + 1], 0.5);
        let d = away(mid);
        if (st.f) {
          // (the link's middle posed by its bones; the way from the body's triangle to it, back in the rest frame)
          const W = hair.weights[pc.verts[0]], top = W.reduce((b, x) => (x[1] > b[1] ? x : b)), F = st.f[rig.at.get(top[0])], Sm = F.S;
          const pm = skinHair(rig, { verts: [mid], weights: [W] }, st.f)[0], wv = unit(sub(pm, q));
          d = unit(add([Sm[0] * wv[0] + Sm[3] * wv[1] + Sm[6] * wv[2], Sm[1] * wv[0] + Sm[4] * wv[1] + Sm[7] * wv[2], Sm[2] * wv[0] + Sm[5] * wv[1] + Sm[8] * wv[2]], mul(d, 0.5)));
        }
        for (const j of [i, i + 1]) if (j > 0) { const key = `${sp.side}:${j}`; push.set(key, add(push.get(key) ?? [0, 0, 0], d)); }
      }
    });
    live = live.filter((_, k) => per[k].length);
    // (each point moved with its neighbours by a bell two points wide either side, the gather's point held; then the
    // spine smoothed a little)
    for (const [key, d] of push) {
      const [side, j] = key.split(':').map(Number), sp = spines.find((s) => s.side === side), u = unit(d);
      for (let i = Math.max(1, j - 2); i < Math.min(sp.X.length, j + 3); i++) sp.X[i] = add(sp.X[i], mul(u, step * Math.exp(-(((i - j) / 1.2) ** 2))));
    }
    for (const sp of spines) for (let i = 1; i + 1 < sp.X.length; i++) sp.X[i] = add(mul(sp.X[i], 0.8), mul(add(sp.X[i - 1], sp.X[i + 1]), 0.1));
    // (no point further than maxMove from where it was laid on the body: what still crosses there is left)
    for (const sp of spines) sp.X.forEach((p, i) => { const d = sub(p, sp.X0[i]), l = Math.hypot(...d); if (l > S.plait.maxMove) sp.X[i] = add(sp.X0[i], mul(d, S.plait.maxMove / l)); });
    hair = assemble(rig, S, cap, spines);
  }
  hair.plaitHitsIn = states.map((st) => hitsIn(hair, st).length);
  return hair;
}

/**
 * The cap's triangles through the skin (the head, the neck, the torso; the scalp it covers, where rigid on the head, left
 * out), as lowhair.mjs crossings counts them: [hair polygon, body polygon]. `posed`: only the skin that does not move
 * with the head (what does is where it is at rest against the rigid cap).
 */
export function capHits(rig, hair, P, H, posed = false) {
  const B = rig.B, scalp = new Set(hair.scalp ?? hair.shave), hits = [];
  const rigid = (i) => rig.weights[B.names[i]].every(([bn, w]) => bn === 'head' || w < 1e-3);
  const mine = hair.tris.filter(([, , , pi]) => !hair.polys[pi].plait);
  const all = bbOf(mine.flatMap(([a, b, c]) => [H[a], H[b], H[c]]));
  const body = [];
  for (const t of B.tris) {
    const p = B.polys[t.poly];
    if (!['head', 'neck', 'torso'].includes(p.part)) continue;
    const still = t.v.every(rigid);
    if ((scalp.has(t.poly) && still) || (posed && still)) continue;
    const T = t.v.map((i) => P[i]), bb = bbOf(T);
    if (bb.some(([lo, hi], k) => hi < all[k][0] || lo > all[k][1])) continue;
    body.push({ T, bb, poly: t.poly });
  }
  for (const [a, b, c, pi] of mine) {
    const A = [H[a], H[b], H[c]], ab = bbOf(A);
    for (const s of body) {
      if (ab.some(([lo, hi], k) => hi < s.bb[k][0] || lo > s.bb[k][1])) continue;
      if (triTri(A, s.T)) { hits.push([pi, s.poly]); break; }
    }
  }
  return hits;
}

/**
 * The cap off the face, the ears and the neck in every state: a face of it through the skin that is not the scalp it
 * covers has its corners moved out `step` at a time from the skull's middle (through the torso, up), an inside corner's
 * outside one with it, until none is.
 */
function clearCap(rig, hair, S, states, step = 0.006) {
  const { verts, grid } = hair, C = hair.centre, mate = new Map();
  grid.inner.forEach((col, j) => col.forEach((v, i) => { if (v !== grid.outer[j][i]) mate.set(v, grid.outer[j][i]); }));
  const hitsIn = (st) => capHits(rig, hair, st.P, st.f ? skinHair(rig, hair, st.f) : verts, !!st.f);
  let live = states;
  for (let it = 0; it < 120; it++) {
    let per = live.map(hitsIn);
    if (!per.some((h) => h.length) && live !== states) { live = states; per = live.map(hitsIn); }
    if (!per.some((h) => h.length)) break;
    live = live.filter((_, k) => per[k].length);
    const hits = per.flat(), up = new Set(hits.filter(([, sp]) => rig.B.polys[sp].part === 'torso').flatMap(([hp]) => hair.polys[hp].v));
    for (const v of new Set(hits.flatMap(([hp]) => hair.polys[hp].v))) {
      const d = up.has(v) ? [0, 1, 0] : unit(sub(verts[v], C));
      verts[v] = add(verts[v], mul(d, step));
      const o = mate.get(v);
      if (o !== undefined) { const gap = dot(sub(verts[o], verts[v]), d); if (gap < S.minThick * 0.5) verts[o] = add(verts[o], mul(d, S.minThick * 0.5 - gap)); }
    }
  }
  return states.map(hitsIn).map((h) => h.length);
}

/**
 * The twin braids on a body: { verts, polys: [{ v, piece, valley?, inside?, rim?, plait? }], tris: [[a, b, c, poly]],
 * weights, pieces, shave, scalp, centre, k, grid, spines }.
 */
export function buildTwinBraids(rig, style = TWIN, { clear = true } = {}) {
  // (the gather this body's own where its plait says so)
  const S = { ...style, gather: { ...style.gather, ...style.plait[rig.who].gather } }, { body } = radiiOf(rig), verts = [], polys = [];
  const c = buildCap(rig, S, verts, polys);
  const cap = { verts, polys, C: c.C, grid: c.grid };
  const spines = [-1, 1].map((side) => ({ side, ...spineOf(rig, S, side, c.C, body) }));
  const states = clear ? statesOf(rig) : [];
  // (the cap first, on its own: the plaits are rebuilt over it)
  let hair = assemble(rig, S, cap, spines);
  // (the scalp the cap's inside sinks into, left out of its crossings)
  hair.scalp = scalpOf(rig.B, hair.centre, hair, 'some', (p) => !p.plait && !p.rim);
  const capLeft = clear ? clearCap(rig, hair, S, states) : null;
  cap.verts = hair.verts.slice(0, verts.length);
  hair = clear ? clearPlaits(rig, S, cap, spines, states) : assemble(rig, S, cap, spines);
  hair.capClearedIn = capLeft;
  hair.shave = scalpOf(rig.B, hair.centre, hair, 'every', (p) => !p.plait && !p.rim);
  hair.scalp = scalpOf(rig.B, hair.centre, hair, 'some', (p) => !p.plait && !p.rim);
  return hair;
}

/** The twin braids on a body, as the game takes them. TWIN_CACHE (a folder): kept there per body, style and pose
 * file, for the review scripts to share one build. */
export function twinBraidsOf(rig, style = TWIN) {
  const dir = process.env.TWIN_CACHE;
  if (!dir) return buildTwinBraids(rig, style);
  const src = [readFileSync(new URL(import.meta.url)), JSON.stringify(style), JSON.stringify(posesOf(rig.who).length)].join('|');
  let h = 0; for (let i = 0; i < src.length; i++) h = (h * 31 + src.charCodeAt(i)) | 0;
  const file = join(dir, `twinbraids-${rig.who}-${(h >>> 0).toString(16)}.json`);
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { /* built below */ }
  const hair = buildTwinBraids(rig, style);
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify(hair));
  return hair;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  for (const who of opt('who', 'female,male').split(',')) {
    const t0 = Date.now(), rig = buildRig(who), hair = buildTwinBraids(rig, TWIN, { clear: !args.includes('--raw') });
    const capT = hair.tris.filter(([, , , pi]) => !hair.polys[pi].plait).length;
    console.log(who, 'verts', hair.verts.length, 'polys', hair.polys.length, 'tris', hair.tris.length, `(cap ${capT}, plaits ${hair.tris.length - capT})`, 'open edges', openEdges(hair), 'scalp', hair.scalp.length, 'shave', hair.shave.length, 'ms', Date.now() - t0);
    console.log(who, 'neck/shoulder shares', hair.spines.map((s) => `${s.at.neck.toFixed(2)}/${s.at.shoulder.toFixed(2)}`).join(' '));
    console.log(who, 'crossings at rest', JSON.stringify(crossReport(rig, hair)), 'plait hits at rest', plaitHits(rig, hair, rig.B.verts, hair.verts).length);
    console.log(who, 'posed', Object.entries(POSES).map(([n, pose]) => { const f = posed(rig, pose), P = skin(rig, f), H = skinHair(rig, hair, f); return `${n} ${JSON.stringify(crossReport(rig, hair, P, H))} plait ${plaitHits(rig, hair, P, H).length}`; }).join('; '));
    if (hair.plaitHitsIn) console.log(who, 'plait hits left in the states', hair.plaitHitsIn.reduce((a, x) => a + x, 0), 'cap', JSON.stringify(hair.capClearedIn?.reduce((a, x) => a + x, 0)));
  }
}
