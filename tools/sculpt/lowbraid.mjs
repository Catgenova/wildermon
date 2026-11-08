// The side braid updo (tools/sculpt/ref/hair-side-braid.png) for the low-poly bodies: the game's 'braid', "Braid". The
// sheet's five views (their hair silhouettes, tools/sculpt/lowbraidsheet.py; their cameras, tools/sculpt/lowbraidreg.mjs)
// carved into a visual hull on her body (carve), the hair built from it (buildBraid) as the style says
// (tools/sculpt/hairs/braid.mjs): the crown's clumps between border lines traced on the sheet and lifted onto the hull
// (tools/sculpt/lowbraidcrown.mjs), the braid's hearts, tie and tip on a spine triangulated from the sheet and settled on
// the body (tools/sculpt/lowbraidbraid.mjs), the face strands along their paths.
//
// Weights: the crown and the strands on the head; the braid from the head at its root through the neck to the chest and
// the right clavicle (weightOf).
//
//   node tools/sculpt/lowbraid.mjs [--hull] [--who female,male]   # counts, checks and the outline difference per view
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig, add, sub, mul, dot, cross, unit, lerp, posed, skin } from './lowrig.mjs';
import { project, raster, skullTable, centreOf, dirOf, angOf } from './lowhairhull.mjs';
import { shadeOf, openEdges, crossings, skinHair } from './lowhair.mjs';
import BRAID from './hairs/braid.mjs';
import { BRAID_VIEWS as VIEWS, BRAID_SPAN as SPAN } from './lowbraidcams.mjs';
import { addCrown, skullMap, thickMap, composeLines } from './lowbraidcrown.mjs';
import { addBraid, addCrownBraids } from './lowbraidbraid.mjs';
import { dirOfMap } from './lowbraidlift.mjs';
const SPINE = JSON.parse(readFileSync(new URL('./hairs/braid-spine.json', import.meta.url), 'utf8'));

const DIR = new URL('.', import.meta.url).pathname;
export const CAMS = JSON.parse(readFileSync(join(DIR, 'hairs/braid-cams.json'), 'utf8'));
export { VIEWS, SPAN };

/** The sheet's hair silhouettes: inside(x, y) for a sheet pixel, grown by `grow` pixels (a disc). */
export function maskOf(grow = 0) {
  const M = JSON.parse(readFileSync(join(DIR, 'hairs/braid-mask.json'), 'utf8'));
  const A = new Uint8Array(M.w * M.h);
  M.runs.forEach((r, y) => { for (let k = 0; k < r.length; k += 2) A.fill(1, y * M.w + r[k], y * M.w + r[k + 1]); });
  let G = A;
  if (grow > 0) {
    G = new Uint8Array(A.length);
    for (let y = 0; y < M.h; y++) for (let x = 0; x < M.w; x++) {
      if (!A[y * M.w + x]) continue;
      for (let dy = -grow; dy <= grow; dy++) for (let dx = -grow; dx <= grow; dx++) {
        if (dx * dx + dy * dy > grow * grow) continue;
        const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < M.w && Y < M.h) G[Y * M.w + X] = 1;
      }
    }
  }
  const f = (x, y) => { const X = Math.floor(x), Y = Math.floor(y); return X >= 0 && Y >= 0 && X < M.w && Y < M.h && G[Y * M.w + X] === 1; };
  f.raw = A; f.w = M.w; f.h = M.h;
  return f;
}

/** A body's head, neck and torso as triangles (three points each): what hides the hair in the sheet's views. */
export const bodyTris = (B, P = B.verts) => B.tris.filter((t) => ['head', 'neck', 'torso'].includes(B.polys[t.poly].part)).map((t) => t.v.map((i) => P[i]));

/**
 * How well a mesh's outline meets the sheet's hair silhouettes, per view: the sheet's hair pixels the mesh leaves bare,
 * the mesh's pixels outside it, and their sum over the silhouette's own outline length (a mean distance between the two
 * outlines, in sheet pixels). The hair counts only where it stands in front of the body (her head, neck and torso).
 */
export function outlineDiff(tris, body) {
  const m = maskOf(), out = {};
  for (const v of VIEWS) {
    const c = CAMS[v], Z = new Float32Array(m.w * m.h).fill(-Infinity), cov = new Uint8Array(m.w * m.h);
    raster(body, c, Z, m.w, m.h, cov, 0);
    raster(tris, c, Z, m.w, m.h, cov, 1);
    const [lo, hi] = SPAN[v];
    let bare = 0, over = 0, edge = 0;
    for (let y = 0; y < m.h; y++) for (let x = lo; x < hi; x++) {
      const i = y * m.w + x, a = m.raw[i];
      if (a && !cov[i]) bare++;
      if (!a && cov[i]) over++;
      if (a && (!m.raw[i - 1] || !m.raw[i + 1] || !m.raw[i - m.w] || !m.raw[i + m.w])) edge++;
    }
    out[v] = { bare, over, px: +((bare + over) / Math.max(1, edge)).toFixed(2) };
  }
  return out;
}

/**
 * The visual hull on a body (her by default): voxels `vox` apart in a box round the head, the neck and the chest, kept
 * where at least `need` of the five views keep them (inside the view's hair silhouette grown by `grow` pixels, or hidden
 * there behind the body, which that view cannot carve) and outside the body. Returns the voxels as a grid
 * (solid[i + nx (j + ny k)]) with its box.
 */
export function carve({ who = 'female', vox = 0.03, grow = 3, need = 5, rig = buildRig(who) } = {}) {
  const B = rig.B, body = bodyTris(B), inside = maskOf(grow), W = inside.w, Hh = inside.h;
  const cams = VIEWS.map((v) => CAMS[v]);
  const zbuf = cams.map((c) => { const Z = new Float32Array(W * Hh).fill(-Infinity); raster(body, c, Z, W, Hh); return Z; });
  // the body's inside, by its depth from the front and from the back along z (x, y columns at the voxels' spacing)
  const lo = [-1.4, -2.2, -1.3], hi = [1.4, 2.5, 1.5];
  const n = lo.map((a, k) => Math.ceil((hi[k] - a) / vox));
  const [nx, ny, nz] = n, solid = new Uint8Array(nx * ny * nz);
  const inBody = bodyInside(body, lo, n, vox);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const idx = i + nx * (j + ny * k);
    if (inBody[idx]) continue;
    const p = [lo[0] + (i + 0.5) * vox, lo[1] + (j + 0.5) * vox, lo[2] + (k + 0.5) * vox];
    let kept = 0;
    for (let c = 0; c < cams.length; c++) {
      const s = project(p, cams[c]);
      if (inside(s[0], s[1])) { kept++; continue; }
      const X = Math.floor(s[0]), Y = Math.floor(s[1]);
      if (X >= 0 && Y >= 0 && X < W && Y < Hh && s[2] < zbuf[c][Y * W + X] - 0.02) kept++;
      else break;
    }
    if (kept >= need) solid[idx] = 1;
  }
  return { solid, lo, n, vox, rig };
}

/** Which voxel centres lie inside the body's closed triangles: per (x, y) column the crossings along z, inside between
 * pairs. */
export function bodyInside(tris, lo, n, vox) {
  const [nx, ny, nz] = n, out = new Uint8Array(nx * ny * nz);
  const cols = new Map();
  for (const [a, b, c] of tris) {
    const x0 = Math.max(0, Math.ceil((Math.min(a[0], b[0], c[0]) - lo[0]) / vox - 0.5)), x1 = Math.min(nx - 1, Math.floor((Math.max(a[0], b[0], c[0]) - lo[0]) / vox - 0.5));
    const y0 = Math.max(0, Math.ceil((Math.min(a[1], b[1], c[1]) - lo[1]) / vox - 0.5)), y1 = Math.min(ny - 1, Math.floor((Math.max(a[1], b[1], c[1]) - lo[1]) / vox - 0.5));
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
      const px = lo[0] + (i + 0.5) * vox, py = lo[1] + (j + 0.5) * vox;
      const d = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(d) < 1e-12) continue;
      const u = ((px - a[0]) * (c[1] - a[1]) - (py - a[1]) * (c[0] - a[0])) / d, w = ((b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0])) / d;
      if (u < 0 || w < 0 || u + w > 1) continue;
      const z = a[2] + u * (b[2] - a[2]) + w * (c[2] - a[2]), key = i + nx * j;
      (cols.get(key) ?? cols.set(key, []).get(key)).push(z);
    }
  }
  for (const [key, zs] of cols) {
    zs.sort((p, q) => p - q);
    const i = key % nx, j = (key - i) / nx;
    for (let m = 0; m + 1 < zs.length; m += 2) {
      const k0 = Math.max(0, Math.ceil((zs[m] - lo[2]) / vox - 0.5)), k1 = Math.min(nz - 1, Math.floor((zs[m + 1] - lo[2]) / vox - 0.5));
      for (let k = k0; k <= k1; k++) out[i + nx * (j + ny * k)] = 1;
    }
  }
  return out;
}

/** The hull's surface as a mesh, for a look: surface nets (a vertex in each cell of eight voxel centres the surface passes
 * through, at the mean of its crossings; a quad across each solid-empty pair of neighbours), smoothed `smooth` times. */
export function hullMesh(H, smooth = 2) {
  const { solid, lo, n: [nx, ny, nz], vox } = H, verts = [], id = new Int32Array((nx + 1) * (ny + 1) * (nz + 1)).fill(-1);
  const at = (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz && solid[i + nx * (j + ny * k)] === 1;
  const cell = (i, j, k) => i + (nx + 1) * (j + (ny + 1) * k);
  // a cell (i, j, k) has the voxel centres (i-1..i, j-1..j, k-1..k) at its corners
  const V = (i, j, k) => {
    const c = cell(i, j, k);
    if (id[c] < 0) id[c] = verts.push([lo[0] + i * vox, lo[1] + j * vox, lo[2] + k * vox]) - 1;
    return id[c];
  };
  const polys = [];
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = at(i, j, k);
    // the face toward +x, +y, +z: the four cells round that face's middle edge
    if (a !== at(i + 1, j, k)) { const q = [V(i + 1, j, k), V(i + 1, j + 1, k), V(i + 1, j + 1, k + 1), V(i + 1, j, k + 1)]; polys.push({ v: a ? q : q.reverse() }); }
    if (a !== at(i, j + 1, k)) { const q = [V(i, j + 1, k), V(i, j + 1, k + 1), V(i + 1, j + 1, k + 1), V(i + 1, j + 1, k)]; polys.push({ v: a ? q : q.reverse() }); }
    if (a !== at(i, j, k + 1)) { const q = [V(i, j, k + 1), V(i + 1, j, k + 1), V(i + 1, j + 1, k + 1), V(i, j + 1, k + 1)]; polys.push({ v: a ? q : q.reverse() }); }
  }
  // (the -x, -y, -z faces of the first layer are the box's edge: the hull never reaches it)
  const nb = verts.map(() => new Set());
  for (const p of polys) p.v.forEach((a, m) => { const b = p.v[(m + 1) % 4]; nb[a].add(b); nb[b].add(a); });
  let P = verts;
  for (let it = 0; it < smooth; it++) P = P.map((p, i) => { const s = [...nb[i]]; if (!s.length) return p; const m = s.reduce((acc, j) => acc.map((x, c) => x + P[j][c] / s.length), [0, 0, 0]); return p.map((x, c) => x * 0.4 + m[c] * 0.6); });
  const tris = [];
  polys.forEach((p, pi) => tris.push([p.v[0], p.v[1], p.v[2], pi], [p.v[0], p.v[2], p.v[3], pi]));
  return { verts: P, polys, tris, pieces: [{ id: 'hull', polys: [0, polys.length] }], shave: [] };
}

/* ---- the hair ----------------------------------------------------------------------------------------------------- */
/** The hull's thickness over her skull: per direction from her skull's centre (over, out) how far past the skin the hull
 * runs on without a break (head units), as a table read back bilinearly. */
export function thickOf(H) {
  const B = H.rig.B, C = centreOf(B), skull = skullTable(B, C), { solid, lo, n: [nx, ny, nz], vox } = H;
  const at = (p) => { const i = Math.floor((p[0] - lo[0]) / vox), j = Math.floor((p[1] - lo[1]) / vox), k = Math.floor((p[2] - lo[2]) / vox); return i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz && solid[i + nx * (j + ny * k)] === 1; };
  const step = 2, no = 361 / step + 1 | 0, nu = 181 / step + 1 | 0, T = new Float64Array(no * nu);
  for (let a = 0; a < no; a++) for (let b = 0; b < nu; b++) {
    const o = -60 + a * step, u = -90 + b * step, d = dirOf(o, u), r0 = skull.at(o, u);
    let first = -1, last = 0;
    for (let t = 0; t < 1; t += 0.01) {
      if (at(add(C, mul(d, r0 + t)))) { if (first < 0) first = t; last = t; } else if (first >= 0 && t - last > 0.04) break;
    }
    T[a * nu + b] = first < 0 || first > 0.1 ? 0 : last;
  }
  return (o, u) => {
    const x = Math.min(no - 1.001, Math.max(0, (o + 60) / step)), y = Math.min(nu - 1.001, Math.max(0, (u + 90) / step)), i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const v = (a, b) => T[a * nu + b];
    return v(i, j) * (1 - fx) * (1 - fy) + v(i + 1, j) * fx * (1 - fy) + v(i, j + 1) * (1 - fx) * fy + v(i + 1, j + 1) * fx * fy;
  };
}

/** Catmull-Rom through points (arrays of numbers), at u in [0, 1] over the whole run. */
function spline(pts, u) {
  const n = pts.length - 1, x = Math.min(n - 1e-9, Math.max(0, u * n)), i = Math.floor(x), t = x - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  return p1.map((_, k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t));
}
/** A spline resampled at `n` points evenly along its length. */
function even(pts, n) {
  const fine = Array.from({ length: 201 }, (_, i) => spline(pts, i / 200));
  const len = [0]; for (let i = 1; i < fine.length; i++) len.push(len[i - 1] + Math.hypot(...fine[i].map((x, k) => x - fine[i - 1][k])));
  return Array.from({ length: n }, (_, i) => {
    const want = (len[200] * i) / (n - 1); let j = 1; while (j < 200 && len[j] < want) j++;
    const f = (want - len[j - 1]) / Math.max(1e-9, len[j] - len[j - 1]);
    return fine[j - 1].map((x, k) => x + (fine[j][k] - x) * f);
  });
}

const MIN_H = 0.03, NAPE = 248, SINK = 0.04, LIFT = 0.05, CACHE = new WeakMap(), MAPS = new WeakMap();

/**
 * The side braid on a body: { verts, polys: [{ v, piece, valley? }], tris: [[a, b, c, poly]], weights, pieces: [{ id,
 * polys, verts, kind }], shave: [], centre }. The crown's clumps rigid on the head; the braid from the head at its root
 * to the neck, the chest and the right clavicle along its length; the strands on the head.
 */
export function buildBraid(rig, style = BRAID, H = carve(), { clear = true } = {}) {
  const B = rig.B, C = centreOf(B);
  // (the skull's table and the hull's thickness, once per body and hull)
  if (!CACHE.has(B)) CACHE.set(B, skullTable(B, C));
  if (!CACHE.has(H)) CACHE.set(H, thickOf(H));
  const skull = CACHE.get(B), thick = CACHE.get(H);
  // the body's skull against hers (the hull is carved on hers), for its thickness and the braid's and strands' places
  const P = (n) => B.verts[B.index.get(n)], Pf = (n) => H.rig.B.verts[H.rig.B.index.get(n)];
  const k = (P('f3.L')[0] + P('t0')[2] - P('bk')[2]) / (Pf('f3.L')[0] + Pf('t0')[2] - Pf('bk')[2]);
  const Cf = centreOf(H.rig.B), toBody = (q) => add(C, mul(sub(q, Cf), k));
  const verts = [], polys = [], pieces = [], role = [];
  // (a root sinks into the scalp; over the face, the temples and the brow, it sits on the skin instead)
  const onHull = (o, u, share) => {
    // (no lower at the nape than the braid's root; a direction there that misses this body's skull, his, raised until it
    // meets it)
    o = Math.min(o, NAPE);
    while (skull.at(o, u) < 0.3 && o > 150) o -= 2;
    const d = dirOf(o, u), r = skull.at(o, u);
    if (share !== 'root') return add(C, mul(d, r + Math.max(isFace(add(C, mul(d, r))) ? 2 * MIN_H : MIN_H, share * thick(o, u)) * k));
    const f = faceShare(add(C, mul(d, r)));
    return add(C, mul(d, r + (-SINK + (SINK + LIFT) * f) * k));
  };
  // how far into the face a skin point is (0 the scalp, 1 in front of the temple below the forehead's hairline)
  // (and low at the nape, where the skin is the neck's as much as the head's, as far as it is below the skull's middle)
  const faceShare = (p) => Math.max(p[1] < C[1] + 0.4 * k ? Math.min(1, Math.max(0, (p[2] - C[2] - 0.05 * k) / (0.35 * k))) : 0, Math.min(1, Math.max(0, (C[1] - 0.3 * k - p[1]) / (0.25 * k))));
  const isFace = (p) => faceShare(p) > 0.5;
  const piece = (id, kind, fn) => { const p0 = polys.length, v0 = verts.length; fn(); pieces.push({ id, kind, polys: [p0, polys.length], verts: [v0, verts.length] }); };
  const V = (p, r = 0) => { role.push(r); return verts.push(p) - 1; };

  // the crown's clumps (tools/sculpt/lowbraidcrown.mjs): her hull's thickness over this body's skull, by k
  if (!MAPS.has(H)) MAPS.set(H, thickMap(H, centreOf(H.rig.B), skullMap(H.rig.B, centreOf(H.rig.B))));
  if (!MAPS.has(B)) MAPS.set(B, skullMap(B, C));
  addCrown(style.crown, { V, poly: (v, sh) => polys.push({ v, piece: pieces.length, ...sh }), piece, skull: MAPS.get(B), thick: MAPS.get(H), C, k, face: faceShare });

  // the crown's two braids down the back (tools/sculpt/lowbraidbraid.mjs addCrownBraids): along the seam from a point on
  // the part through the chevrons' tips to its end
  if (style.crownBraids) {
    const { lines: CL, seam: SM } = composeLines(style.crown), cb = style.crownBraids, P = CL.part, x = cb.start * (P.length - 1);
    const path = [P[Math.floor(x)], ...SM];
    const surf = (m, lift) => { const d = dirOfMap(m); return add(C, mul(d, MAPS.get(B).at(m) + (Math.max(0.05, MAPS.get(H).at(m)) + lift) * k)); };
    addCrownBraids(cb, path, { V, poly: (v, sh) => polys.push({ v, piece: pieces.length, ...sh }), piece, surf, k });
  }
  // the braid (tools/sculpt/lowbraidbraid.mjs): its root on the crown's seam end, on this body
  const seamEnd = composeLines(style.crown).seam.at(-1), dR = dirOfMap(seamEnd), skR = MAPS.get(B).at(seamEnd);
  if (!MAPS.has(rig.B.verts)) {
    const lo = [-1.6, -2.4, -1.4], vox = 0.03, n = [Math.ceil(3.2 / vox), Math.ceil(4.2 / vox), Math.ceil(3 / vox)];
    MAPS.set(rig.B.verts, { lo, vox, n, I: bodyInside(bodyTris(B), lo, n, vox) });
  }
  const BI = MAPS.get(rig.B.verts), inside = (p) => {
    // (inside the body or within a voxel and a half of its skin)
    for (const d of [[0, 0, 0], [1.5, 0, 0], [-1.5, 0, 0], [0, 0, 1.5], [0, 0, -1.5], [0, 1.5, 0], [0, -1.5, 0]]) {
      const i = Math.floor((p[0] - BI.lo[0]) / BI.vox + d[0]), j = Math.floor((p[1] - BI.lo[1]) / BI.vox + d[1]), kk = Math.floor((p[2] - BI.lo[2]) / BI.vox + d[2]);
      if (i >= 0 && j >= 0 && kk >= 0 && i < BI.n[0] && j < BI.n[1] && kk < BI.n[2] && BI.I[i + BI.n[0] * (j + BI.n[1] * kk)]) return true;
    }
    return false;
  };
  addBraid(style.braid, { ...SPINE, rows: [...SPINE.rows] }, { inside, V, poly: (v, sh) => polys.push({ v, piece: pieces.length, ...sh }), piece, toBody, k, sheetScale: CAMS.front.s,
    root: add(C, mul(dR, skR + 0.5 * MAPS.get(H).at(seamEnd) * k)) });

  // the face strands: a flat lock along a wavy path, its tip a point
  // (and the locks over the sides behind the ears: the same, broader, a hexagon round their path, on the head)
  for (const st of style.strands) piece(st.id, st.lock ? 'clump' : 'strand', () => {
    const pts = even(st.path.map(toBody), st.n ?? 7), ring = [];
    const sec = st.lock ? [0, 60, 120, 180, 240, 300].map((a) => [Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)]) : [[1, 0], [0, 1], [-1, 0], [0, -1]];
    pts.forEach((p, i) => {
      if (i === pts.length - 1) { ring.push([V(p)]); return; }
      const T = unit(sub(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)]));
      let N = unit(sub([p[0], 0, p[2] + 0.1], mul(T, dot([p[0], 0, p[2] + 0.1], T)))); const X = cross(T, N);
      const f = 1 - (i / (pts.length - 1)) ** (st.lock ? 2.5 : 1.5), w = st.w * f * k, t = st.t * Math.max(0.4, f) * k;
      ring.push(sec.map(([x, y]) => V(add(p, add(mul(X, x * w), mul(N, y * t))))));
    });
    capped([[V(add(pts[0], mul(sub(pts[0], pts[1]), 0.3)))], ...ring], sec.length, (j, f) => (st.lock && j === 3 ? shadeOf(0.6 * Math.sin(Math.PI * f)) : {}));
  });

  /** Faces of a run of rings (the first and the last single points) round `m` corners. */
  function capped(rings, m, shade) {
    const R = rings.length;
    for (let i = 0; i + 1 < R; i++) for (let j = 0; j < m; j++) {
      const a = rings[i], b = rings[i + 1], f = (i + 0.5) / (R - 1);
      const v = a.length === 1 ? [a[0], b[(j + 1) % m], b[j]] : b.length === 1 ? [a[j], a[(j + 1) % m], b[0]] : [a[j], a[(j + 1) % m], b[(j + 1) % m], b[j]];
      polys.push({ v, piece: pieces.length, ...shade(j, f) });
    }
  }
  function tube(rings, m, shade) { capped(rings, m, shade); }

  orient(verts, polys, pieces);
  const tris = [];
  const triangulate = () => {
    tris.length = 0;
  polys.forEach((p, pi) => {
    if (p.v.length === 3) tris.push([...p.v, pi]);
    else { const [a, b, c, d] = p.v; if (Math.hypot(...sub(verts[a], verts[c])) <= Math.hypot(...sub(verts[b], verts[d]))) tris.push([a, b, c, pi], [a, c, d, pi]); else tris.push([a, b, d, pi], [b, c, d, pi]); }
  });
  };
  triangulate();
  // the crown and the strands clear of the face and the neck: a face of theirs through the face's skin (in front of the
  // temples, below the forehead's hairline, or an ear) or the neck's has its corners moved out from the skull's centre a little at a time
  const notFace = B.polys.map((p, i) => i).filter((i) => { const p = B.polys[i]; if (p.part !== 'head') return p.part !== 'neck' && p.part !== 'torso'; if (p.ear) return false; const c = p.v.reduce((a, v) => add(a, mul(B.verts[v], 1 / p.v.length)), [0, 0, 0]); return !isFace(c); });
  for (let it = 0; clear && it < 90; it++) {
    const hits = crossings(rig, { verts, polys, tris, scalp: notFace }, B.verts, verts).hits.filter(([hp]) => pieces[polys[hp].piece].kind === 'clump' || pieces[polys[hp].piece].kind === 'strand');
    if (!hits.length) break;
    for (const v of new Set(hits.flatMap(([hp]) => polys[hp].v))) verts[v] = add(verts[v], mul(unit(sub(verts[v], C)), 0.005 * k));
  }
  const weights = verts.map((_, i) => weightOf(role[i], pieces.find((pc) => i >= pc.verts[0] && i < pc.verts[1]).kind));
  const scalp = scalpOf(B, C, verts, polys, tris, pieces);
  return { verts, polys, tris, weights, pieces, shave: scalp, scalp, centre: C, k };
}

/** The scalp: the head's skin polygons (not the ears) the crown's clumps cover, every corner, seen from the skull's
 * centre (the ray from it through the corner meets a clump). The clumps' roots sink into these by design: the crossing
 * checks leave them out. */
function scalpOf(B, C, verts, polys, tris, pieces) {
  const crown = tris.filter(([, , , pi]) => { const pc = pieces[polys[pi].piece]; return pc && pc.kind === 'clump'; }).map(([a, b, c]) => [verts[a], verts[b], verts[c]]);
  const covered = new Map();
  const under = (vi) => {
    if (covered.has(vi)) return covered.get(vi);
    const d = unit(sub(B.verts[vi], C));
    const hitAny = crown.some(([a, b, c]) => {
      const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
      if (Math.abs(det) < 1e-12) return false;
      const s = sub(C, a), u = dot(s, p) / det; if (u < 0 || u > 1) return false;
      const q = cross(s, e1), v = dot(d, q) / det; if (v < 0 || u + v > 1) return false;
      return dot(e2, q) / det > 0;
    });
    covered.set(vi, hitAny);
    return hitAny;
  };
  const out = [];
  B.polys.forEach((p, i) => { if (p.part === 'head' && p.mat === 'skin' && !p.ear && p.v.every(under)) out.push(i); });
  return out;
}

/**
 * The hair's crossings through the body (tools/sculpt/lowhair.mjs crossings: the scalp the clumps cover left out), by
 * where: the face (the head's skin in front of the temples below the forehead's hairline, the ears), the neck, the chest and shoulders (the torso), and
 * the scalp's edge (the head's skin behind the face the clumps' roots sink into at the hairline). P, Hv: the body's
 * and the hair's vertices (posed).
 */
export function crossReport(rig, hair, P = rig.B.verts, Hv = hair.verts) {
  const B = rig.B, r = crossings(rig, hair, P, Hv), out = { face: 0, neck: 0, torso: 0, edge: 0, byPiece: {} };
  for (const [hp, sp] of r.hits) {
    const poly = B.polys[sp], c = poly.v.reduce((a, i) => a.map((x, k) => x + B.verts[i][k] / poly.v.length), [0, 0, 0]);
    const where = poly.part === 'neck' ? 'neck' : poly.part === 'torso' ? 'torso' : poly.ear || (c[1] < hair.centre[1] + 0.4 * hair.k && c[2] > hair.centre[2] + 0.4 * hair.k) ? 'face' : 'edge';
    out[where]++;
    if (where !== 'edge') { const id = hair.pieces[hair.polys[hp].piece].id; out.byPiece[`${id}>${where}`] = (out.byPiece[`${id}>${where}`] ?? 0) + 1; }
  }
  return out;
}

/** Each piece's faces wound alike (each face turned to agree with a neighbour across a shared edge, from the first),
 * then turned outward (all turned over where they enclose a negative volume). */
function orient(verts, polys, pieces) {
  for (const pc of pieces) {
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
            // (a neighbour wound alike runs the shared edge the other way: b then a)
            if (w[(m + 1) % w.length] === b) w.reverse();
            done.add(n); q.push(n);
          }
        });
      }
    }
    let vol = 0;
    for (const i of ids) { const v = polys[i].v; for (let j = 1; j + 1 < v.length; j++) vol += dot(verts[v[0]], cross(verts[v[j]], verts[v[j + 1]])); }
    if (vol < 0) for (const i of ids) polys[i].v.reverse();
  }
}

/** A vertex's bones: the crown, the strands and the braid's root on the head; down the braid (s, its share of the
 * spine's length) the neck, then the chest and the right clavicle. */
export function weightOf(s, kind) {
  if (kind === 'clump' || kind === 'strand') return [['head', 1]];
  const ramp = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  const h = 1 - ramp(s, 0.2, 0.38), n2 = ramp(s, 0.2, 0.38) * (1 - ramp(s, 0.38, 0.54)), n1 = ramp(s, 0.38, 0.54) * (1 - ramp(s, 0.54, 0.7)), ch = ramp(s, 0.54, 0.7);
  return [['head', h], ['neck_02', n2], ['neck_01', n1], ['spine_03', ch * 0.6], ['clavicle_r', ch * 0.4]].filter(([, w]) => w > 1e-4);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const t0 = Date.now(), H = carve({ vox: +opt('vox', 0.03), grow: +opt('grow', 3), need: +opt('need', 5) });
  if (args.includes('--hull')) {
    let n = 0; for (const v of H.solid) n += v;
    const M = hullMesh(H), tris = M.tris.map(([a, b, c]) => [M.verts[a], M.verts[b], M.verts[c]]);
    console.log('hull voxels', n, 'faces', M.polys.length, 'ms', Date.now() - t0);
    console.log('outline difference (sheet px):', Object.entries(outlineDiff(tris, bodyTris(H.rig.B))).map(([v, d]) => `${v} ${d.px} (bare ${d.bare}, over ${d.over})`).join(', '));
  }
  for (const who of opt('who', 'female,male').split(',')) {
    const rig = who === 'female' ? H.rig : buildRig(who), hair = buildBraid(rig, BRAID, H);
    const rest = crossReport(rig, hair);
    console.log(who, 'tris', hair.tris.length, 'pieces', hair.pieces.length, hair.pieces.map((p) => `${p.id}:${p.polys[1] - p.polys[0]}`).join(' '), 'open edges', openEdges(hair), 'crossings at rest', JSON.stringify(rest));
    // the head turned 70 degrees each way and nodded 40 (tools/sculpt/lowhairshot.mjs's poses)
    const POSES = { 'turn left': { neck_01: [0, 16, 0], neck_02: [0, 16, 0], head: [0, 38, 0] }, 'turn right': { neck_01: [0, -16, 0], neck_02: [0, -16, 0], head: [0, -38, 0] }, nod: { neck_01: [12, 0, 0], neck_02: [14, 0, 0], head: [14, 0, 0] } };
    console.log(who, 'crossings posed', Object.entries(POSES).map(([n, pose]) => { const f = posed(rig, pose); const r = crossReport(rig, hair, skin(rig, f), skinHair(rig, hair, f)); return `${n} ${JSON.stringify({ face: r.face, neck: r.neck, torso: r.torso, ...r.byPiece })}`; }).join('; '));
    if (who === 'female') console.log('outline difference (sheet px):', Object.entries(outlineDiff(hair.tris.map(([a, b, c]) => [hair.verts[a], hair.verts[b], hair.verts[c]]), bodyTris(rig.B))).map(([v, d]) => `${v} ${d.px}`).join(', '));
  }
}
