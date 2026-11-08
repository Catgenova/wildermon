// The fur mantle's sheet (mantle-sheet.png) against the low-poly bodies, through the sheet's ten worn views registered to
// the bodies (tools/sculpt/lowmantlecams.json): what the bodies and the mantle look like in each view, in the sheet's own
// pixels, for tools/sculpt/lowmantlesheet.py to lay over the sheet and to measure against its masks.
//
//   node tools/sculpt/lowmantlereg.mjs --out <dir> [--design '{...}'] [--tag <name>]
//     <dir>/proj<tag>.json: per body and view, its box on the sheet, the label map (run-length rows; 1 the body, 2 the
//     ring, 3 the collar, 4 mid1, 5 mid2, 6 main, 7 the clasps: whichever is in front), the body's front-facing polygon
//     edges and the mantle's (2D segments), and each layer's own silhouette alone (run-length rows)
//
// project(p, c): screen x = cx + s ax (cos yaw x + sin yaw z), y = cy + dy - s y (orthographic, the body's units and axes;
// yaw 0 the front, the sheet's three-quarter +45 (his face toward the sheet's right), its side -90 (toward the left), its
// back 180, its rear three-quarter -135).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { buildMantle, DESIGN } from './garments/mantle.mjs';

const DIR = new URL('.', import.meta.url).pathname;
export const CAMS = JSON.parse(readFileSync(join(DIR, 'lowmantlecams.json'), 'utf8'));
export const VIEWS = ['front', 'q3', 'side', 'back', 'r3'];
/** Each view's box on the sheet (x, y, w, h), per body: the sheet's worn figures. */
export const BOXES = {
  male: { front: [20, 95, 195, 245], q3: [215, 95, 185, 245], side: [398, 95, 122, 245], back: [515, 95, 150, 245], r3: [668, 95, 147, 245] },
  female: { front: [20, 438, 195, 225], q3: [215, 438, 185, 225], side: [395, 438, 122, 225], back: [515, 438, 150, 225], r3: [668, 438, 147, 225] },
};
export const LABELS = { body: 1, ring: 2, collar: 3, mid1: 4, mid2: 5, main: 6, clasp: 7 };

export function project(p, c) {
  const a = (c.yaw * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  return [c.cx + c.s * (c.ax ?? 1) * (ca * p[0] + sa * p[2]), c.cy + (c.dy ?? 0) - c.s * p[1], -sa * p[0] + ca * p[2]];
}
/** Triangles (three points each) into a depth buffer over a box (larger depth toward the viewer); where one is in front, ids takes id. */
export function raster(tris, c, box, Z, ids, id) {
  const [bx, by, W, H] = box;
  for (const t of tris) {
    const p = t.map((q) => { const r = project(q, c); return [r[0] - bx, r[1] - by, r[2]]; });
    const ar = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[1][1] - p[0][1]) * (p[2][0] - p[0][0]);
    if (Math.abs(ar) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])));
    const y0 = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((p[1][0] - px) * (p[2][1] - py) - (p[1][1] - py) * (p[2][0] - px)) / ar, w1 = ((p[2][0] - px) * (p[0][1] - py) - (p[2][1] - py) * (p[0][0] - px)) / ar, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * p[0][2] + w1 * p[1][2] + w2 * p[2][2], i = y * W + x;
      if (z > Z[i]) { Z[i] = z; ids[i] = id; }
    }
  }
}
const rle = (A, W, H, f = (v) => v) => Array.from({ length: H }, (_, y) => { const r = []; let x = 0; while (x < W) { const v = f(A[y * W + x]); let e = x; while (e < W && f(A[e + y * W]) === v) e++; if (v) r.push(x, e, v); x = e; } return r; });
const labelOf = (part) => (part.startsWith('clasp') ? LABELS.clasp : LABELS[part]);

/** One body's and its mantle's projection into every view. */
export function projectAll(who, G, rig) {
  const B = rig.B, out = {};
  const bodyTris = B.tris.map((t) => t.v.map((i) => B.verts[i]));
  const byLabel = {};
  for (const t of G.tris) { const l = labelOf(G.polys[t.poly].part); (byLabel[l] ??= []).push(t.v.map((i) => G.verts[i])); }
  for (const v of VIEWS) {
    const c = CAMS[who][v], box = BOXES[who][v], [, , W, H] = box, n = W * H;
    const Z = new Float32Array(n).fill(-Infinity), ids = new Uint8Array(n);
    raster(bodyTris, c, box, Z, ids, LABELS.body);
    for (const [l, tris] of Object.entries(byLabel)) raster(tris, c, box, Z, ids, +l);
    // each layer alone (its silhouette, whatever is in front of it)
    const alone = {};
    { const Z2 = new Float32Array(n).fill(-Infinity), A = new Uint8Array(n); raster(bodyTris, c, box, Z2, A, 1); alone[LABELS.body] = rle(A, W, H); }
    for (const [l, tris] of Object.entries(byLabel)) { const Z2 = new Float32Array(n).fill(-Infinity), A = new Uint8Array(n); raster(tris, c, box, Z2, A, 1); alone[l] = rle(A, W, H); }
    // the body's and the mantle's edges of polygons facing the viewer
    const a = (c.yaw * Math.PI) / 180, view = [-Math.sin(a), 0, Math.cos(a)];
    const edges = (P, polys, keep = () => true) => {
      const seg = [];
      for (const p of polys) {
        if (!keep(p)) continue;
        let nx = 0, ny = 0, nz = 0;
        for (let k = 0; k < p.v.length; k++) { const A = P[p.v[k]], Bq = P[p.v[(k + 1) % p.v.length]]; nx += (A[1] - Bq[1]) * (A[2] + Bq[2]); ny += (A[2] - Bq[2]) * (A[0] + Bq[0]); nz += (A[0] - Bq[0]) * (A[1] + Bq[1]); }
        if (nx * view[0] + ny * view[1] + nz * view[2] <= 0) continue;
        for (let k = 0; k < p.v.length; k++) { const A = project(P[p.v[k]], c), Bq = project(P[p.v[(k + 1) % p.v.length]], c); seg.push([+(A[0] - box[0]).toFixed(2), +(A[1] - box[1]).toFixed(2), +(Bq[0] - box[0]).toFixed(2), +(Bq[1] - box[1]).toFixed(2)]); }
      }
      return seg;
    };
    // each clump on its own (front-most), id = layer label * 64 + clump + 1, for the per-clump overlays
    const Zc = new Float32Array(n).fill(-Infinity), Cl = new Uint16Array(n);
    raster(bodyTris, c, box, Zc, Cl, 1);
    for (const t of G.tris) { const p = G.polys[t.poly], l = labelOf(p.part); raster([t.v.map((i) => G.verts[i])], c, box, Zc, Cl, p.clump == null ? l * 64 : l * 64 + p.clump + 1); }
    out[v] = { box, labels: rle(ids, W, H), clumps: rle(Cl, W, H), alone, body: edges(B.verts, B.polys.map((p) => ({ v: p.nv ?? p.v }))), mantle: edges(G.verts, G.polys) };
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const out = resolve(opt('out', 'tmp/lowmantlereg')), over = JSON.parse(opt('design', '{}')), tag = opt('tag', '');
  mkdirSync(out, { recursive: true });
  const all = {};
  for (const who of ['male', 'female']) { const rig = buildRig(who), G = buildMantle(rig, { ...DESIGN[who], ...over }); all[who] = projectAll(who, G, rig); }
  writeFileSync(join(out, `proj${tag}.json`), JSON.stringify(all));
  console.log('wrote', join(out, `proj${tag}.json`));
}
