// The leather chest built from the approved trace: each view's face mesh (tools/sculpt/leather/mesh/facemesh.py --json:
// faces in sheet pixels, each its piece and the sheet's colour there) lifted onto the envelope (lowlchestenv.mjs):
// every face corner cast into its view onto the frontmost envelope triangle (its rest point by the hit's barycentric
// share; off the envelope, the nearest hit moved by the sheet's offset in the view's plane); each face kept from the
// view that faces its envelope triangle most squarely, so the views tile the surface; each piece out from the envelope
// by its layer, its face inside the bevel a little higher. Writes lift-<who>.json { verts, faces: [{ v, col, piece }] }.
//
//   node tools/sculpt/lowlchestlift.mjs --env <dir> --faces <dir> --out <dir> [--who male,female]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { VIEWS, loadCams } from './lowleatherchestview.mjs';
import { viewMapper, normals } from './lowlchestenv.mjs';

const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowlchestlift')); mkdirSync(out, { recursive: true });
/** How far each piece stands off the envelope (body units): the undershirt, the cores, the plates over them, the decals. */
export function layerOf(piece) {
  const p = piece ?? '';
  if (/^undershirt/.test(p)) return 0;
  if (/^(line:|rivet)/.test(p) || /ring|stripe|bring|emblem/.test(p)) return 0.1;
  if (/^(core|back\.(top|panel|low|side)|side|collar|notch|sleeve)/.test(p)) return 0.035;
  if (/^(belt)/.test(p)) return 0.05;
  return 0.07;
}
const KZ = 4;
for (const who of opt('who', 'male,female').split(',')) {
  const rig = buildRig(who), C = loadCams()[who];
  const E = JSON.parse(readFileSync(join(opt('env'), `env-${who}.json`), 'utf8')), V = E.V, T = E.T, N = normals(V, T);
  const Qv = {}, facing = {};
  for (const view of VIEWS) {
    const Q = viewMapper(rig, C, view)(V, E.W); Qv[view] = Q;
    facing[view] = T.map(([a, b, c]) => { const e1 = [Q[b][0] - Q[a][0], Q[b][1] - Q[a][1], Q[b][2] - Q[a][2]], e2 = [Q[c][0] - Q[a][0], Q[c][1] - Q[a][1], Q[c][2] - Q[a][2]]; const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; return -n[2] / (Math.hypot(...n) || 1); });
  }
  const best = T.map((_, t) => { let b = null, bf = 0.05; for (const v of VIEWS) if (facing[v][t] > bf) { bf = facing[v][t]; b = v; } return b; });
  const verts = [], faces = [];
  for (const view of VIEWS) {
    const F = JSON.parse(readFileSync(join(opt('faces'), `${who}-${view}.json`), 'utf8')), Q = Qv[view];
    const box = JSON.parse(readFileSync(new URL(`./leather/mesh/${who}-${view}.json`, import.meta.url), 'utf8')).box, [x0, y0, x1, y1] = box;
    const Wd = (x1 - x0) * KZ, Hd = (y1 - y0) * KZ, zb = new Float32Array(Wd * Hd).fill(-1e9), id = new Int32Array(Wd * Hd).fill(-1);
    T.forEach(([a, b, c], t) => {
      const p = [a, b, c].map((i) => [(Q[i][0] - x0) * KZ, (Q[i][1] - y0) * KZ, Q[i][2]]);
      const xa = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0]))), xb = Math.min(Wd - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])));
      const ya = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1]))), yb = Math.min(Hd - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
      const d = (p[1][1] - p[2][1]) * (p[0][0] - p[2][0]) + (p[2][0] - p[1][0]) * (p[0][1] - p[2][1]); if (Math.abs(d) < 1e-9) return;
      for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
        const l0 = ((p[1][1] - p[2][1]) * (x - p[2][0]) + (p[2][0] - p[1][0]) * (y - p[2][1])) / d, l1 = ((p[2][1] - p[0][1]) * (x - p[2][0]) + (p[0][0] - p[2][0]) * (y - p[2][1])) / d, l2 = 1 - l0 - l1;
        if (l0 < -1e-3 || l1 < -1e-3 || l2 < -1e-3) continue;
        const z = l0 * p[0][2] + l1 * p[1][2] + l2 * p[2][2], k = y * Wd + x; if (z > zb[k]) { zb[k] = z; id[k] = t; }
      }
    });
    const a = (C.views[view].yaw * Math.PI) / 180, right = [Math.cos(a), 0, Math.sin(a)];
    // (a sheet point on the envelope: its triangle and rest point and normal; off it, the nearest hit moved in the view's plane)
    const lift = (x, y, zc = null, tol = 0.3) => {
      const px = Math.round((x - x0) * KZ), py = Math.round((y - y0) * KZ);
      for (let r = 0; r <= 8 * KZ; r += 1) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const xx = px + dx, yy = py + dy; if (xx < 0 || yy < 0 || xx >= Wd || yy >= Hd) continue;
        const t = id[yy * Wd + xx]; if (t < 0) continue;
        if (zc !== null && Math.abs(zb[yy * Wd + xx] - zc) > tol) continue;
        const [i, j, k] = T[t], u = xx / KZ + x0, v = yy / KZ + y0, P = [Q[i], Q[j], Q[k]];
        const d = (P[1][1] - P[2][1]) * (P[0][0] - P[2][0]) + (P[2][0] - P[1][0]) * (P[0][1] - P[2][1]);
        const l0 = ((P[1][1] - P[2][1]) * (u - P[2][0]) + (P[2][0] - P[1][0]) * (v - P[2][1])) / d, l1 = ((P[2][1] - P[0][1]) * (u - P[2][0]) + (P[0][0] - P[2][0]) * (v - P[2][1])) / d, l2 = 1 - l0 - l1;
        const R = [0, 1, 2].map((q) => l0 * V[i][q] + l1 * V[j][q] + l2 * V[k][q]), n = [0, 1, 2].map((q) => l0 * N[i][q] + l1 * N[j][q] + l2 * N[k][q]);
        const ox = (x - u) / C.s, oy = -(y - v) / C.s;
        return { t, z: zb[yy * Wd + xx], p: [R[0] + ox * right[0], R[1] + oy, R[2] + ox * right[2]], n };
      }
      return null;
    };
    for (const f of F) {
      // (the face's centre first; its corners only onto the same surface, within the depth tolerance of the centre's)
      const cx = f.p.reduce((s, q) => s + q[0], 0) / f.p.length, cy = f.p.reduce((s, q) => s + q[1], 0) / f.p.length, lc = lift(cx, cy);
      if (!lc || best[lc.t] !== view) continue;
      const L = f.p.map(([x, y]) => lift(x, y, lc.z)); if (L.some((l) => !l)) continue;
      const off = layerOf(f.piece) + (f.kind === 'face' || f.kind === 'layer' ? 0.012 : 0);
      const base = verts.length;
      L.forEach((l) => { const nl = Math.hypot(...l.n) || 1; verts.push(l.p.map((q, d) => +(q + (l.n[d] / nl) * off).toFixed(4))); });
      faces.push({ v: L.map((_, k) => base + k), col: f.col, piece: f.piece, view, kind: f.kind });
    }
  }
  writeFileSync(join(out, `lift-${who}.json`), JSON.stringify({ who, verts, faces }));
  console.log(who, faces.length, 'faces', verts.length, 'corners');
}
