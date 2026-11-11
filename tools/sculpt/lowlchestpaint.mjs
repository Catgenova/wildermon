// The leather chest's pieces painted onto the body from the approved trace (tools/sculpt/leather/mesh/<who>-<view>.json):
// the body's triangles cut finer (each split into 4^SUB), each small triangle projected into the sheet's five views
// (the registered cameras and review poses, lowleatherchestview.mjs), kept where nothing of the body is in front of
// it, and given the traced piece its centre falls inside in the view that faces it most squarely (votes weighted by
// the facing squared; none where it falls on no piece). Writes the painted body (per small triangle its rest corners
// and its piece) and, per view, its triangles on the sheet for lowlchestpaint.py to draw beside the sheet.
//
//   node tools/sculpt/lowlchestpaint.mjs --out <dir> [--who male,female] [--sub 2]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { VIEWS, loadCams, reviewVerts, proj, DIR } from './lowleatherchestview.mjs';
import { viewMapper } from './lowlchestenv.mjs';

const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowlchestpaint')), SUB = +opt('sub', '2');
mkdirSync(out, { recursive: true });
const SIDE_VIEW = { side: 'l' };
/** A traced piece's name made the same across the views. */
export function canon(n, view) {
  if (/^(ring|ring\.hole|stripe1|stripe2|stripes)$/.test(n)) return 'emblem';
  if (view === 'side' && n === 'bring') return `brune.${SIDE_VIEW.side}`;
  if (/^bring/.test(n)) return n.replace('bring', 'brune');
  if (n === 'notch') return 'collar';
  if (/^(core\.top|core\.right|core\.low|core\.side)$/.test(n)) return 'core';
  if (/^collar/.test(n)) return 'collar';
  if (n === 'side.r') return 'core';
  if (view === 'side') {
    const m = { plate1: 'belt', plate2: 'belt', plate3: 'skirtU.l', plate4: 'skirtL.l', plate5: 'skirtL.l', plate6: 'skirtL.l', plate7: 'skirtL.l', 'skirt.b': 'skirt.b' };
    if (m[n]) return m[n];
    if (!/\.(l|r)$/.test(n) && /^(captop|capband|lame1|lame2|sleeve|bracer|bracer\.cuff|brune|band)$/.test(n)) return `${n}.${SIDE_VIEW.side}`;
  }
  if (/^belt\.(l|r|mid)$/.test(n)) return 'belt';
  if (/^skirt\.mid/.test(n)) return 'skirt.b';
  if (/^back\.(side)/.test(n)) return 'back.side';
  if (n === 'undershirt' || n === 'undershirt.layer') return 'undershirt';
  return n;
}
const inPoly = (P, x, y) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const inEll = (e, x, y) => { const [cx, cy, rx, ry] = e.ellipse; return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1; };
/** The piece at a sheet point: the decals first (rings, holes, stripes), then the plates, the undershirt's layer last. */
function pieceAt(T, view, x, y) {
  const P = T.pieces, order = Object.keys(P).sort((a, b) => rank(a) - rank(b));
  for (const k of order) { const v = P[k]; if (Array.isArray(v) ? inPoly(v, x, y) : inEll(v, x, y)) return canon(k, view); }
  return null;
}
const rank = (k) => (/hole/.test(k) ? 0 : /ring|bring|stripe/.test(k) ? 1 : k === 'undershirt.layer' ? 9 : 5);

for (const who of opt('who', 'male,female').split(',')) {
  const rig = buildRig(who), C = loadCams()[who];
  // (--env <dir>: painted on the envelope, lowlchestenv.mjs, not the skin: the plates that stand off the body keep their area)
  const ENV = opt('env', null) ? JSON.parse(readFileSync(join(opt('env'), `env-${who}.json`), 'utf8')) : null;
  const B = ENV ? { verts: ENV.V, tris: ENV.T.map((v) => ({ v })) } : rig.B;
  // the small triangles: barycentric corners in each body triangle
  const bary = [];
  const n = 2 ** SUB;
  for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) {
    const a = [i / n, j / n], b = [(i + 1) / n, j / n], c = [i / n, (j + 1) / n];
    bary.push([a, b, c]);
    if (i + j < n - 1) bary.push([b, [(i + 1) / n, (j + 1) / n], c]);
  }
  const at = (P, t, w) => { const [A, Bq, Cq] = t.v.map((k) => P[k]); const u = w[0], v = w[1], s = 1 - u - v; return [0, 1, 2].map((d) => s * A[d] + u * Bq[d] + v * Cq[d]); };
  const small = [];
  B.tris.forEach((t, ti) => { for (const q of bary) small.push({ ti, q }); });
  const votes = small.map(() => new Map());
  const perView = {};
  for (const view of VIEWS) {
    const T = JSON.parse(readFileSync(join(DIR, `leather/mesh/${who}-${view}.json`), 'utf8'));
    let PB, Q;
    if (ENV) { Q = viewMapper(rig, C, view)(ENV.V, ENV.W); PB = Q.map((q) => [q[0], -q[1], q[2]]); }
    else { PB = reviewVerts(rig, null, C, view).PB; Q = PB.map((p) => proj(p, C, view)); }
    const [x0, y0, x1, y1] = T.box, Kz = 4, W = (x1 - x0) * Kz, H = (y1 - y0) * Kz, zb = new Float32Array(W * H).fill(-1e9);
    const tri3 = small.map(({ ti, q }) => q.map((w) => at(Q, B.tris[ti], w)));
    // (the depth buffer over the body's small triangles)
    const raster = (t, f) => {
      const p = t.map((a) => [(a[0] - x0) * Kz, (a[1] - y0) * Kz, a[2]]);
      const xa = Math.max(0, Math.floor(Math.min(...p.map((a) => a[0])))), xb = Math.min(W - 1, Math.ceil(Math.max(...p.map((a) => a[0]))));
      const ya = Math.max(0, Math.floor(Math.min(...p.map((a) => a[1])))), yb = Math.min(H - 1, Math.ceil(Math.max(...p.map((a) => a[1]))));
      const d = (p[1][1] - p[2][1]) * (p[0][0] - p[2][0]) + (p[2][0] - p[1][0]) * (p[0][1] - p[2][1]);
      if (Math.abs(d) < 1e-9) return;
      for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
        const l0 = ((p[1][1] - p[2][1]) * (x - p[2][0]) + (p[2][0] - p[1][0]) * (y - p[2][1])) / d, l1 = ((p[2][1] - p[0][1]) * (x - p[2][0]) + (p[0][0] - p[2][0]) * (y - p[2][1])) / d, l2 = 1 - l0 - l1;
        if (l0 < -1e-3 || l1 < -1e-3 || l2 < -1e-3) continue;
        f(x, y, l0 * p[0][2] + l1 * p[1][2] + l2 * p[2][2]);
      }
    };
    tri3.forEach((t) => raster(t, (x, y, z) => { const k = y * W + x; if (z > zb[k]) zb[k] = z; }));
    const yaw = (C.views[view].yaw * Math.PI) / 180, dirv = [-Math.sin(yaw), 0, Math.cos(yaw)];
    const rows = [];
    small.forEach(({ ti, q }, s) => {
      const t = tri3[s], c = [0, 1, 2].map((d) => (t[0][d] + t[1][d] + t[2][d]) / 3);
      // (facing: the small triangle's normal in the review pose against the view's direction, from the posed body)
      const P3 = q.map((w) => at(PB, B.tris[ti], w)), e1 = P3[1].map((x, d) => x - P3[0][d]), e2 = P3[2].map((x, d) => x - P3[0][d]);
      const nn = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], L = Math.hypot(...nn) || 1;
      const face = ENV ? nn[2] / L : (nn[0] * dirv[0] + nn[2] * dirv[2]) / L;
      const px = Math.round((c[0] - x0) * Kz), py = Math.round((c[1] - y0) * Kz);
      if (px < 0 || py < 0 || px >= W || py >= H) return;
      const vis = c[2] >= zb[py * W + px] - 0.08;
      if (!vis || Math.abs(face) < 0.15) return;
      const lab = pieceAt(T, view, c[0], c[1]) ?? '-';
      const w = face * face, m = votes[s];
      m.set(lab, (m.get(lab) ?? 0) + w);
      rows.push([s, t.map((a) => [+a[0].toFixed(2), +a[1].toFixed(2)])]);
    });
    perView[view] = { box: T.box, tris: rows };
  }
  const restTri = small.map(({ ti, q }) => q.map((w) => at(B.verts, B.tris[ti], w).map((x) => +x.toFixed(4))));
  // (the labels smoothed: each small triangle its own votes, normalised, plus LAMBDA for each neighbour (sharing an edge)
  // with a label, a few passes, so a border follows the views' agreement, not one view's stray pixel)
  const key = (p) => p.map((x) => x.toFixed(3)).join(','), edges = new Map(), nb = small.map(() => []);
  restTri.forEach((t, s) => { for (let k = 0; k < 3; k++) { const a = key(t[k]), b = key(t[(k + 1) % 3]), e = a < b ? a + '|' + b : b + '|' + a; const o = edges.get(e); if (o === undefined) edges.set(e, s); else { nb[s].push(o); nb[o].push(s); } } });
  const norm = votes.map((m) => { let t = 0; for (const w of m.values()) t += w; const o = new Map(); for (const [k, w] of m) o.set(k, w / (t || 1)); return o; });
  let label = norm.map((m) => { let b = '-', bw = 0; for (const [k, w] of m) if (w > bw) { bw = w; b = k; } return b; });
  const LAMBDA = +opt('lambda', '0.35');
  for (let pass = 0; pass < +opt('passes', '8'); pass++) label = label.map((_, s) => {
    const sc = new Map(norm[s]); for (const o of nb[s]) sc.set(label[o], (sc.get(label[o]) ?? 0) + LAMBDA);
    let b = label[s], bw = -1; for (const [k, w] of sc) if (w > bw) { bw = w; b = k; } return b;
  });
  writeFileSync(join(out, `paint-${who}.json`), JSON.stringify({ who, sub: SUB, labels: label, rest: restTri, parent: small.map((s) => s.ti), views: perView }));
  const count = {}; for (const l of label) count[l] = (count[l] ?? 0) + 1;
  console.log(who, small.length, 'small triangles', JSON.stringify(count));
}
