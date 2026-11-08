// The helm (tools/sculpt/garments/helm.mjs) against the helm sheet's silhouettes (tools/sculpt/lowhelmmask.py,
// tools/sculpt/plate/helm-masks.json), view by view: each body's helm at rest drawn under the sheet's camera for that
// view (orthographic, its turn 0, 45, 90, 135 or 180; one scale and height for the five views, each view's column
// fitted: REG), filled, the body hiding what it covers, against the sheet's: the pixels each leaves bare, their overlap over their union, and the mean
// distance between the two outlines in sheet pixels.
//
//   node tools/sculpt/lowhelmfit.mjs [--out <dir>]     # per view the numbers; with --out an overlay per body
//     (sheet only red, ours only cyan, both white), three times the sheet's size
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { buildHelm } from './garments/helm.mjs';

const DIR = new URL('.', import.meta.url).pathname;
const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const MASKS = JSON.parse(readFileSync(join(DIR, 'plate/helm-masks.json'), 'utf8'));
export const YAWS = [0, 45, 90, 135, 180];

const unpack = (m) => { const A = new Uint8Array(m.w * m.h); m.runs.forEach((r, y) => { for (let k = 0; k < r.length; k += 2) A.fill(1, y * m.w + r[k], y * m.w + r[k + 1]); }); return A; };
/** A point under a view's camera: [screen x, screen y, toward the viewer] in the view's own pixels. */
const proj = (p, yaw, cam) => { const a = yaw * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a); return [cam.cx + cam.s * (p[0] * c - p[2] * sn), cam.cy - cam.s * p[1], p[0] * sn + p[2] * c]; };
/** Meshes filled under a camera with a depth buffer: per pixel the index of the mesh in front (0 none, k+1 mesh k). */
function rasterDepth(meshes, yaw, cam, w, h) {
  const Z = new Float32Array(w * h).fill(-Infinity), ID = new Uint8Array(w * h);
  meshes.forEach(({ P, tris }, mi) => {
    const Q = P.map((p) => proj(p, yaw, cam));
    for (const t of tris) {
      const [a, b, c] = t.map((i) => Q[i]), d = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(d) < 1e-9) continue;
      const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
      const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const u = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / d, v = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / d, wq = 1 - u - v;
        if (u < 0 || v < 0 || wq < 0) continue;
        const z = u * a[2] + v * b[2] + wq * c[2], i = y * w + x;
        if (z > Z[i]) { Z[i] = z; ID[i] = mi + 1; }
      }
    }
  });
  return ID;
}
/** The helm's pixels in front of the body under a camera, holes filled (as the sheet's). */
function raster(G, yaw, cam, w, h, body = null) {
  const ID = rasterDepth([{ P: G.verts, tris: G.tris.map((t) => t.v) }, ...(body ? [body] : [])], yaw, cam, w, h);
  const A = new Uint8Array(w * h);
  for (let i = 0; i < A.length; i++) A[i] = ID[i] === 1 ? 1 : 0;
  // (holes filled: what the border cannot reach)
  const R = new Uint8Array(w * h), st = [];
  for (let x = 0; x < w; x++) st.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
  while (st.length) { const i = st.pop(); if (R[i] || A[i]) continue; R[i] = 1; const x = i % w, y = (i - x) / w; if (x > 0) st.push(i - 1); if (x < w - 1) st.push(i + 1); if (y > 0) st.push(i - w); if (y < h - 1) st.push(i + w); }
  for (let i = 0; i < A.length; i++) if (!R[i] && ID[i] !== 2) A[i] = 1;
  return A;
}
const edge = (A, w, h) => { const E = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!A[i]) continue; if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || !A[i - 1] || !A[i + 1] || !A[i - w] || !A[i + w]) E.push([x, y]); } return E; };
function compare(S, O, w, h) {
  let both = 0, s = 0, o = 0;
  for (let i = 0; i < S.length; i++) { if (S[i] && O[i]) both++; else if (S[i]) s++; else if (O[i]) o++; }
  const ES = edge(S, w, h), EO = edge(O, w, h);
  const near = (E, F) => E.reduce((acc, [x, y]) => { let b = Infinity; for (const [u, v] of F) { const d = (u - x) ** 2 + (v - y) ** 2; if (d < b) b = d; } return acc + Math.sqrt(b); }, 0) / Math.max(1, E.length);
  return { iou: both / (both + s + o), sheetOnly: s, oursOnly: o, outline: (near(ES, EO) + near(EO, ES)) / 2 };
}
const bbox = (A, w, h) => { let x0 = w, x1 = -1, y0 = h, y1 = -1; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (A[y * w + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { x0, x1, y0, y1 }; };

/**
 * The registration (the sheet has no face to register by: the head is under the helm): the scale s, sheet pixels a unit,
 * set by the width the head needs (the band round the ears); the front view's faceplate foot at height `bot`; in profile
 * the faceplate's front at z `zf` at height `yref` (where it passes the nose); the front and back views centred on the
 * helm's own middle, the three-quarter views each moved across to the best overlap.
 */
export const REG = { male: { s: 49.5, bot: -0.22, yref: 0.73, zf: 1.26 }, female: { s: 47, bot: -0.18, yref: 0.75, zf: 1.07 } };
/** Each body's cameras and per view the comparison (the body in front of the helm hiding it, as the sheet's neck does). */
export function fit(who, G, rig) {
  const M = MASKS[who].map((m) => ({ ...m, A: unpack(m) })), R = REG[who];
  const hide = new Set(G.hides ?? []), body = { P: rig.B.verts, tris: rig.B.tris.filter((t) => !hide.has(t.poly)).map((t) => t.v) };
  const fb = bbox(M[0].A, M[0].w, M[0].h), s = R.s, cy = fb.y1 + s * R.bot;
  const sideRow = Math.round(cy - s * R.yref), sr = M[2].runs[sideRow], cxSide = sr[0] + s * R.zf;
  return M.map((m, i) => {
    const yaw = YAWS[i], mb = bbox(m.A, m.w, m.h);
    const cands = i === 2 ? [cxSide] : i === 0 || i === 4 ? [(mb.x0 + mb.x1 + 1) / 2] : Array.from({ length: 81 }, (_, k) => m.w * 0.3 + k * m.w * 0.005);
    let best = null;
    for (const cx of cands) {
      const cam = { s, cx, cy }, O = raster(G, yaw, cam, m.w, m.h, body);
      let both = 0, un = 0; for (let k = 0; k < O.length; k++) { if (O[k] && m.A[k]) both++; if (O[k] || m.A[k]) un++; }
      if (!best || both / un > best.iou0) best = { cam, O, iou0: both / un };
    }
    return { yaw, cam: best.cam, box: [m.x0, m.y0], O: best.O, S: m.A, w: m.w, h: m.h, ...compare(m.A, best.O, m.w, m.h) };
  });
}

/** The sheet's pieces traced by hand (tools/sculpt/plate/helm-pieces.json), per body and view. */
const PIECES = JSON.parse(readFileSync(join(DIR, 'plate/helm-pieces.json'), 'utf8'));
/** A traced piece filled in a view's own pixels (polygons, or circles [cx, cy, r]), from the sheet's pixels. */
function tracedMask(list, x0, y0, w, h) {
  const A = new Uint8Array(w * h);
  for (const P of list) {
    if (typeof P[0] === 'number') { const [cx, cy, r] = P; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x + x0 + 0.5 - cx) ** 2 + (y + y0 + 0.5 - cy) ** 2 <= r * r) A[y * w + x] = 1; continue; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const px = x + x0 + 0.5, py = y + y0 + 0.5;
      let inside = false;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside; }
      if (inside) A[y * w + x] = 1;
    }
  }
  return A;
}
/**
 * Per piece (the sheet's traced pieces, where a view has them): our piece's pixels seen in front (the helm's polygons
 * labelled `piece` by garments/helm.mjs) against the traced outline, overlap and outline distance.
 */
export function piecesFit(who, G, rig, R) {
  const hide = new Set(G.hides ?? []), body = { P: rig.B.verts, tris: rig.B.tris.filter((t) => !hide.has(t.poly)).map((t) => t.v) };
  const out = {};
  for (const [vi, pieces] of Object.entries(PIECES[who] ?? {})) {
    const v = R[+vi], names = Object.keys(pieces);
    // (each piece its own mesh in the depth buffer, the body last)
    const ours = (n) => n.split('+'), all = names.flatMap(ours);
    const meshes = names.map((n) => ({ P: G.verts, tris: G.tris.filter((t) => ours(n).includes(G.polys[t.poly].piece)).map((t) => t.v) }));
    const rest = { P: G.verts, tris: G.tris.filter((t) => !all.includes(G.polys[t.poly].piece)).map((t) => t.v) };
    const ID = rasterDepth([...meshes, rest, body], v.yaw, v.cam, v.w, v.h);
    out[vi] = names.map((n, k) => {
      const O = new Uint8Array(v.w * v.h); for (let i = 0; i < O.length; i++) O[i] = ID[i] === k + 1 ? 1 : 0;
      const S = tracedMask(pieces[n], v.box[0], v.box[1], v.w, v.h);
      return { piece: n, S, O, ...compare(S, O, v.w, v.h) };
    });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = opt('out', null);
  if (out) mkdirSync(out, { recursive: true });
  const { PNG } = await import('pngjs').catch(() => ({ PNG: null }));
  for (const who of ['male', 'female']) {
    const rig = buildRig(who), G = buildHelm(rig), R = fit(who, G, rig);
    console.log(who, R.map((r) => `${r.yaw}: iou ${r.iou.toFixed(3)} outline ${r.outline.toFixed(2)} px (sheet only ${r.sheetOnly}, ours only ${r.oursOnly})`).join(' | '));
    for (const [vi, L] of Object.entries(piecesFit(who, G, rig, R))) console.log('  view', YAWS[vi], L.map((p) => `${p.piece} ${(p.iou * 100).toFixed(0)}% ${p.outline.toFixed(1)}px`).join(', '));
    if (out) writeFileSync(join(out, `helmfit-${who}.json`), JSON.stringify(R.map(({ yaw, w, h, S, O }) => ({ yaw, w, h, S: [...S].join(''), O: [...O].join('') }))));
  }
}
