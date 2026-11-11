// The leather chest's envelope: the armour's outer surface as the sheet's five views bound it (a visual hull): the body
// cut finer (each triangle split SUB times at its edges' middles, weights averaged), each vertex pushed out along its
// normal for as long as the point stays inside the armour's outline (every traced piece, the undershirt's layer, the
// rings) in all five registered views (lowleatherchestview.mjs: the review pose of the view and its body map; a point
// off the skin moves with the vertex it grew from). The pushes smoothed over the armour's vertices; the rest (the
// head, the hands, the legs below the skirt) left on the skin. Writes the envelope (rest vertices, triangles, weights,
// the push) and per view its outline against the sheet's for lowlchestenv.py.
//
//   node tools/sculpt/lowlchestenv.mjs --out <dir> [--who male,female] [--sub 2] [--tmax 1.4] [--dt 0.02]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig, posed } from './lowrig.mjs';
import { skinGarment } from './lowgarment.mjs';
import { VIEWS, loadCams, reviewPose, poseOf, bodyMap, proj, DIR } from './lowleatherchestview.mjs';

const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = resolve(opt('out', 'tmp/lowlchestenv')), SUB = +opt('sub', '2'), TMAX = +opt('tmax', '1.4'), DT = +opt('dt', '0.02');
mkdirSync(out, { recursive: true });

/** The body cut finer: each edge's middle a new vertex (weights the two ends' mean), each triangle four. */
export function subdivide(verts, tris, vw, times) {
  let V = verts.map((p) => [...p]), T = tris.map((t) => [...t]), W = vw.map((l) => l.map(([b, w]) => [b, w]));
  for (let s = 0; s < times; s++) {
    const mid = new Map(), m = (a, b) => {
      const k = a < b ? a * 1e6 + b : b * 1e6 + a; if (mid.has(k)) return mid.get(k);
      V.push(V[a].map((x, d) => (x + V[b][d]) / 2));
      const o = new Map(); for (const [bi, w] of [...W[a], ...W[b]]) o.set(bi, (o.get(bi) ?? 0) + w / 2);
      W.push([...o].sort((x, y) => y[1] - x[1]).slice(0, 4).map(([bi, w], _, l) => [bi, w / l.reduce((q, [, x]) => q + x, 0)]));
      mid.set(k, V.length - 1); return V.length - 1;
    };
    const T2 = [];
    for (const [a, b, c] of T) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); T2.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]); }
    T = T2;
  }
  return { V, T, W };
}
export function normals(V, T) {
  const N = V.map(() => [0, 0, 0]);
  for (const [a, b, c] of T) { const e1 = V[b].map((x, d) => x - V[a][d]), e2 = V[c].map((x, d) => x - V[a][d]); const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; for (const i of [a, b, c]) for (let d = 0; d < 3; d++) N[i][d] += n[d]; }
  return N.map((n) => { const l = Math.hypot(...n) || 1; return n.map((x) => x / l); });
}
/** A view's armour outline as a mask (KZ pixels a sheet pixel): every traced piece, ellipse and the undershirt's layer. */
export function armourMask(who, view, KZ = 4) {
  const T = JSON.parse(readFileSync(join(DIR, `leather/mesh/${who}-${view}.json`), 'utf8'));
  const [x0, y0, x1, y1] = T.box, W = (x1 - x0) * KZ, H = (y1 - y0) * KZ, M = new Uint8Array(W * H);
  const fillPoly = (P) => {
    const Q = P.map(([x, y]) => [(x - x0) * KZ, (y - y0) * KZ]), ya = Math.max(0, Math.floor(Math.min(...Q.map((q) => q[1])))), yb = Math.min(H - 1, Math.ceil(Math.max(...Q.map((q) => q[1]))));
    for (let y = ya; y <= yb; y++) {
      const xs = []; for (let i = 0, j = Q.length - 1; i < Q.length; j = i++) { const [xi, yi] = Q[i], [xj, yj] = Q[j]; if ((yi > y) !== (yj > y)) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi)); }
      xs.sort((a, b) => a - b); for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k])); x <= Math.min(W - 1, Math.floor(xs[k + 1])); x++) M[y * W + x] = 1;
    }
  };
  for (const v of Object.values(T.pieces)) {
    if (Array.isArray(v)) fillPoly(v);
    else { const [cx, cy, rx, ry] = v.ellipse; fillPoly(Array.from({ length: 24 }, (_, i) => [cx + rx * Math.cos((i * Math.PI) / 12), cy + ry * Math.sin((i * Math.PI) / 12)])); }
  }
  // (closed a little: the slits between the traced pieces are the armour's)
  const D = new Uint8Array(M), R = 2 * KZ;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (M[y * W + x]) for (let dy = -R; dy <= R; dy += KZ) for (let dx = -R; dx <= R; dx += KZ) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) D[yy * W + xx] = 1; }
  const E = new Uint8Array(D);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!D[y * W + x]) for (let dy = -R; dy <= R; dy += KZ) for (let dx = -R; dx <= R; dx += KZ) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) E[yy * W + xx] = 0; }
  for (let i = 0; i < M.length; i++) E[i] = E[i] | M[i];
  return { box: T.box, W, H, KZ, M: E, at: (u, v) => { const x = Math.round((u - x0) * KZ), y = Math.round((v - y0) * KZ); return x >= 0 && y >= 0 && x < W && y < H ? E[y * W + x] : 0; } };
}
/** A view's whole figure outline (silhouettes.json, from the sheet): the hull is the figure's; the paint says which of it
 * is armour. */
const SIL = JSON.parse(readFileSync(join(DIR, 'leather/mesh/silhouettes.json'), 'utf8'));
export function figureMask(who, view) {
  const S = SIL[who][view], [x0, y0] = S.box;
  return { box: S.box, at: (u, v) => { const r = S.runs[Math.round(v) - y0]; if (!r) return 0; const x = Math.round(u); for (const [a, b] of r) if (x >= a && x < b) return 1; return 0; } };
}
/** Rest points (with weights) into a view's sheet pixels. */
export function viewMapper(rig, C, view) {
  const f = posed(rig, reviewPose(rig, poseOf(C, view))), map = bodyMap(rig, C, f, view);
  return (P, W) => { const G = { verts: P, vw: W }; const S = skinGarment(rig, f, G, W); return S.map((p, i) => proj(map(p, W[i]), C, view)); };
}

if (import.meta.url === `file://${process.argv[1]}`) for (const who of opt('who', 'male,female').split(',')) {
  const rig = buildRig(who), C = loadCams()[who], B = rig.B;
  const { V, T, W } = subdivide(B.verts, B.tris.map((t) => t.v), rig.vw, SUB), N = normals(V, T);
  const masks = Object.fromEntries(VIEWS.map((v) => [v, figureMask(who, v)])), maps = Object.fromEntries(VIEWS.map((v) => [v, viewMapper(rig, C, v)]));
  // (the march: every vertex a step at a time; alive while every view has it inside the armour)
  const t = new Float32Array(V.length).fill(-1), alive = new Uint8Array(V.length).fill(1);
  // (each vertex judged only by the views that have its skin inside the figure: where a view's registration puts the
  // body a little outside the sheet's figure, the body wins; a vertex no view has inside, the head and the legs below
  // the crop, stays on the skin)
  const valid = VIEWS.map((v) => { const Q = maps[v](V, W); return Q.map((q) => masks[v].at(q[0], q[1])); });
  for (let i = 0; i < V.length; i++) if (!valid.some((a) => a[i])) alive[i] = 0;
  for (let k = 0, s = 0; s <= TMAX + 1e-9; k++, s = k * DT) {
    const idx = []; for (let i = 0; i < V.length; i++) if (alive[i]) idx.push(i);
    if (!idx.length) break;
    const P = idx.map((i) => V[i].map((x, d) => x + N[i][d] * s)), Wi = idx.map((i) => W[i]);
    const ok = new Uint8Array(idx.length).fill(1);
    VIEWS.forEach((v, vi) => { const Q = maps[v](P, Wi), M = masks[v]; Q.forEach((q, j) => { if (ok[j] && valid[vi][idx[j]] && !M.at(q[0], q[1])) ok[j] = 0; }); });
    idx.forEach((i, j) => { if (ok[j]) t[i] = s; else alive[i] = 0; });
  }
  // (smoothed over the armour's vertices: each the mean of itself and its neighbours, a few passes)
  const nb = V.map(() => new Set()); for (const [a, b, c] of T) { nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
  let tt = Array.from(t);
  for (let p = 0; p < +opt('smooth', '4'); p++) tt = tt.map((x, i) => { if (x < 0) return x; let s2 = x, n = 1; for (const j of nb[i]) if (tt[j] >= 0) { s2 += tt[j]; n++; } return s2 / n; });
  const E = V.map((p, i) => (tt[i] >= 0 ? p.map((x, d) => x + N[i][d] * tt[i]) : p));
  // per view: the envelope's triangles (armour only) and the body's on the sheet
  const views = {};
  for (const v of VIEWS) { const Q = maps[v](E, W); views[v] = { box: masks[v].box, tris: T.filter((tr) => tr.every((i) => tt[i] >= 0)).map((tr) => tr.map((i) => [+Q[i][0].toFixed(2), +Q[i][1].toFixed(2)])) }; }
  writeFileSync(join(out, `env-${who}.json`), JSON.stringify({ who, V: E.map((p) => p.map((x) => +x.toFixed(4))), T, W, push: tt.map((x) => +x.toFixed(3)), views }));
  const arm = tt.filter((x) => x >= 0);
  console.log(who, V.length, 'vertices', arm.length, 'on the armour; push mean', (arm.reduce((a, b) => a + b, 0) / arm.length).toFixed(3), 'max', Math.max(...arm).toFixed(2));
}
