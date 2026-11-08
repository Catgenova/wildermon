// The side braid updo (tools/sculpt/ref/hair-side-braid.png) for the low-poly bodies: the game's 'braid', "Braid". The
// sheet's five views (their hair silhouettes, tools/sculpt/lowbraidmask.py; their cameras, tools/sculpt/lowbraidcams.mjs)
// carved into a visual hull on her body, the hair built from it.
//
//   node tools/sculpt/lowbraid.mjs [--hull]   # the hull's size and its outline difference per view
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { project, raster } from './lowhairhull.mjs';
import { BRAID_VIEWS as VIEWS, BRAID_SPAN as SPAN } from './lowbraidcams.mjs';

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
function bodyInside(tris, lo, n, vox) {
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const t0 = Date.now(), H = carve({ vox: +opt('vox', 0.03), grow: +opt('grow', 3), need: +opt('need', 5) });
  let n = 0; for (const v of H.solid) n += v;
  const M = hullMesh(H);
  console.log('hull voxels', n, 'faces', M.polys.length, 'ms', Date.now() - t0);
  const tris = M.tris.map(([a, b, c]) => [M.verts[a], M.verts[b], M.verts[c]]);
  console.log('outline difference (sheet px):', Object.entries(outlineDiff(tris, bodyTris(H.rig.B))).map(([v, d]) => `${v} ${d.px} (bare ${d.bare}, over ${d.over})`).join(', '));
}
