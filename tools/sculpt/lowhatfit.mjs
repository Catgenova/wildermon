// The feathered cap (tools/sculpt/garments/hat.mjs) against the hat sheet's silhouettes (tools/sculpt/lowhatmask.py,
// tools/sculpt/leather/hat-masks.json), view by view: each body's hat at rest drawn under the sheet's camera for that view
// (orthographic: turn, tilt, scale and centre REG), filled, against the sheet's: their overlap over their union and the
// mean distance between the two outlines in sheet pixels.
//
// The registration. The equipped views are registered to the body by the face: the scale from the chin to the eyes'
// line (his 62 px for 1.03, hers 56 px for 0.97: 60 and 58 px a unit; the brows land at 1.15 and 1.17, the body's at
// 1.13-1.24 and 1.18-1.29), the chin's underside at the sheet's chin (his y 287, hers 301); the turn from where the
// near eye lies between the face's front and the ear (his 0.49 of the way, hers 0.50: the body's at 24 and 27 degrees;
// his ear 1.45 behind the face's front at that scale, the body's 1.46; hers 1.55, the body's 1.41, her sheet face 10%
// wider); the tilt and the across position are searched. The turnaround's views show the hat alone: one scale for the six
// (searched), each view's centre, turn (within 10 degrees of its label) and tilt searched. The body and the hair hide the
// hat where they are in front of it (the equipped views); the turnaround is drawn without them.
//
//   node tools/sculpt/lowhatfit.mjs [--out <dir>]     # per view the numbers; with --out the registration as JSON
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { buildHat, hairMesh } from './garments/hat.mjs';

const DIR = new URL('.', import.meta.url).pathname;
const MASKS = JSON.parse(readFileSync(join(DIR, 'leather/hat-masks.json'), 'utf8'));
export const VIEWS = ['eq', 'front', 'q45', 'side', 'rq', 'back', 'top'];
/** Each view's label turn and tilt (the renderer's: a positive tilt looks from below). */
export const NOMINAL = { eq: [28, 0], front: [0, -14], q45: [45, -14], side: [90, -14], rq: [135, -14], back: [180, -14], top: [0, -90] };
/** Each view's bounds on the searched turn and tilt. */
export const BOUNDS = { eq: [[12, 42], [-12, 12]], front: [[-10, 10], [-30, 0]], q45: [[35, 55], [-30, 0]], side: [[80, 100], [-30, 0]], rq: [[125, 145], [-30, 0]], back: [[170, 190], [-30, 0]], top: [[-20, 20], [-90, -70]] };
export const FACE = { male: { s: 60, chin: 287, yaw: 24 }, female: { s: 58, chin: 301, yaw: 27 } };

const unpack = (m) => { const A = new Uint8Array(m.w * m.h); m.runs.forEach((r, y) => { for (let k = 0; k < r.length; k += 2) A.fill(1, y * m.w + r[k], y * m.w + r[k + 1]); }); return A; };
/** A point under a camera { s, cx, cy, yaw, pitch }: [screen x, screen y, toward the viewer]. */
export const proj = (p, c) => {
  const a = c.yaw * Math.PI / 180, b = c.pitch * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  const X = p[0] * ca - p[2] * sa, Y = p[1], Z = p[0] * sa + p[2] * ca;
  return [c.cx + c.s * X, c.cy - c.s * (cb * Y + sb * Z), -sb * Y + cb * Z];
};
/** Meshes filled under a camera with a depth buffer: per pixel the index of the mesh in front (0 none, k+1 mesh k). */
export function rasterDepth(meshes, cam, w, h) {
  const Z = new Float32Array(w * h).fill(-Infinity), ID = new Uint8Array(w * h);
  meshes.forEach(({ P, tris }, mi) => {
    const Q = P.map((p) => proj(p, cam));
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
/** The hat's pixels in front of the occluders, holes filled where no occluder shows. */
export function raster(hat, occ, cam, w, h) {
  const ID = rasterDepth([hat, ...occ], cam, w, h), A = new Uint8Array(w * h);
  for (let i = 0; i < A.length; i++) A[i] = ID[i] === 1 ? 1 : 0;
  const R = new Uint8Array(w * h), st = [];
  for (let x = 0; x < w; x++) st.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
  while (st.length) { const i = st.pop(); if (R[i] || A[i]) continue; R[i] = 1; const x = i % w, y = (i - x) / w; if (x > 0) st.push(i - 1); if (x < w - 1) st.push(i + 1); if (y > 0) st.push(i - w); if (y < h - 1) st.push(i + w); }
  for (let i = 0; i < A.length; i++) if (!R[i] && ID[i] < 2) A[i] = 1;
  return A;
}
const edge = (A, w, h) => { const E = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!A[i]) continue; if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || !A[i - 1] || !A[i + 1] || !A[i - w] || !A[i + w]) E.push([x, y]); } return E; };
export function compare(S, O, w, h) {
  let both = 0, s = 0, o = 0;
  for (let i = 0; i < S.length; i++) { if (S[i] && O[i]) both++; else if (S[i]) s++; else if (O[i]) o++; }
  const ES = edge(S, w, h), EO = edge(O, w, h);
  const near = (E, F) => E.reduce((acc, [x, y]) => { let b = Infinity; for (const [u, v] of F) { const d = (u - x) ** 2 + (v - y) ** 2; if (d < b) b = d; } return acc + Math.sqrt(b); }, 0) / Math.max(1, E.length);
  return { iou: both / Math.max(1, both + s + o), sheetOnly: s, oursOnly: o, outline: (near(ES, EO) + near(EO, ES)) / 2 };
}
const iouOf = (S, O) => { let b = 0, u = 0; for (let i = 0; i < S.length; i++) { if (S[i] && O[i]) b++; if (S[i] || O[i]) u++; } return b / Math.max(1, u); };
const bbox = (A, w, h) => { let x0 = w, x1 = -1, y0 = h, y1 = -1; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (A[y * w + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { x0, x1, y0, y1 }; };

/** A pattern search over the named camera settings (steps halving), from `cam`, for the best overlap. */
function search(score0, cam, steps, rounds = 5, bounds = null) {
  const score = (c) => (bounds && (c.yaw < bounds[0][0] || c.yaw > bounds[0][1] || c.pitch < bounds[1][0] || c.pitch > bounds[1][1]) ? -1 : score0(c));
  if (bounds) cam = { ...cam, yaw: Math.max(bounds[0][0], Math.min(bounds[0][1], cam.yaw)), pitch: Math.max(bounds[1][0], Math.min(bounds[1][1], cam.pitch)) };
  let best = { cam: { ...cam }, v: score(cam) };
  for (let r = 0; r < rounds; r++) {
    let moved = true;
    while (moved) {
      moved = false;
      for (const [k, st] of Object.entries(steps)) for (const sg of [1, -1]) {
        const c = { ...best.cam, [k]: best.cam[k] + sg * st / 2 ** r }, v = score(c);
        if (v > best.v + 1e-6) { best = { cam: c, v }; moved = true; }
      }
    }
  }
  return best;
}

/** The head's, neck's and hair's triangles (the occluders in the equipped views). */
function occluders(rig) {
  const B = rig.B, H = hairMesh(rig.who);
  return [{ P: B.verts, tris: B.tris.filter((t) => t.v.every((i) => B.verts[i][1] > -1.6)).map((t) => t.v) }, { P: H.verts, tris: H.tris.map((t) => t.v) }];
}
/**
 * Per view the registration and the comparison. `prev` (a previous fit's cameras) starts the search there; `fixed`
 * keeps the cameras as they are (the review renders draw under the registration as it was searched).
 */
export function fit(who, G, rig, { prev = null, fixed = false } = {}) {
  const hat = { P: G.verts, tris: G.tris.map((t) => t.v) }, occ = occluders(rig), Fc = FACE[who];
  const out = {};
  // the turnaround's shared scale: searched with the front and side views, then held for all six
  let sT = prev?.front?.cam?.s ?? 34;
  const camsT = {};
  const turnScore = (s) => {
    let tot = 0;
    for (const v of ['front', 'side', 'back']) {
      const m = MASKS[v], A = unpack(m), [yaw, pitch] = NOMINAL[v], mb = bbox(A, m.w, m.h);
      const c0 = prev?.[v]?.cam ? { ...prev[v].cam, s } : { s, cx: (mb.x0 + mb.x1) / 2, cy: mb.y1 - 0.2 * s, yaw, pitch };
      const b = search((c) => iouOf(A, raster(hat, [], c, m.w, m.h)), c0, { cx: 4, cy: 4, ...(fixed ? {} : { pitch: 4 }) }, 3, BOUNDS[v]);
      camsT[v] = b.cam; tot += b.v;
    }
    return tot;
  };
  if (!fixed) { let best = [sT, turnScore(sT)]; for (const ds of [-4, 4, -2, 2, -1, 1]) { const v = turnScore(best[0] + ds); if (v > best[1]) best = [best[0] + ds, v]; } sT = best[0]; }
  for (const v of VIEWS) {
    const key = v === 'eq' ? (who === 'male' ? 'eqm' : 'eqf') : v, m = MASKS[key], A = unpack(m), [yaw, pitch] = NOMINAL[v], mb = bbox(A, m.w, m.h);
    const eq = v === 'eq', oc = eq ? occ : [];
    let cam;
    if (fixed && prev?.[v]) cam = prev[v].cam;
    else if (eq) {
      const c0 = prev?.eq?.cam ?? { s: Fc.s, cx: (mb.x0 + mb.x1) / 2, cy: Fc.chin - m.y0, yaw, pitch };
      cam = search((c) => iouOf(A, raster(hat, oc, c, m.w, m.h)), { ...c0, s: Fc.s, cy: Fc.chin - m.y0, yaw: Fc.yaw }, { cx: 6, pitch: 6 }, 4, BOUNDS.eq).cam;
    } else {
      const c0 = prev?.[v]?.cam ? { ...prev[v].cam, s: sT } : { s: sT, cx: (mb.x0 + mb.x1) / 2, cy: mb.y1 - 0.2 * sT, yaw, pitch };
      cam = search((c) => iouOf(A, raster(hat, oc, c, m.w, m.h)), c0, { cx: 4, cy: 4, yaw: 6, pitch: 4 }, 4, BOUNDS[v]).cam;
    }
    const O = raster(hat, oc, cam, m.w, m.h);
    out[v] = { key, cam, box: [m.x0, m.y0], w: m.w, h: m.h, S: A, O, ...compare(A, O, m.w, m.h) };
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), o = args.indexOf('--out'), outDir = o < 0 ? null : args[o + 1];
  if (outDir) mkdirSync(outDir, { recursive: true });
  const reg = {};
  for (const who of ['male', 'female']) {
    const rig = buildRig(who), G = buildHat(rig), R = fit(who, G, rig);
    reg[who] = Object.fromEntries(Object.entries(R).map(([v, r]) => [v, { cam: Object.fromEntries(Object.entries(r.cam).map(([k, x]) => [k, +x.toFixed(2)])), iou: +r.iou.toFixed(3), outline: +r.outline.toFixed(2) }]));
    console.log(who, Object.entries(R).map(([v, r]) => `${v} ${(r.iou * 100).toFixed(1)}% ${r.outline.toFixed(1)}px [yaw ${r.cam.yaw.toFixed(0)} pitch ${r.cam.pitch.toFixed(0)} s ${r.cam.s.toFixed(1)}]`).join(' | '));
  }
  if (outDir) writeFileSync(join(outDir, 'hat-reg.json'), JSON.stringify(reg, null, 1));
}
