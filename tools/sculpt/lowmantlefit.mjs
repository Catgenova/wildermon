// The fur mantle's design fitted to its sheet: the mantle built on a body, seen through the sheet's registered cameras
// (tools/sculpt/lowmantlereg.mjs), measured against the sheet's own figure and its traced hems and clasps
// (tools/sculpt/lowmantle-sheetmasks.json, written by lowmantlesheet.py masks), its numbers moved one at a time (coordinate
// descent) while the misfit falls. The misfit, in sheet pixels, over the five views:
//   the outer outline (each row of the mantle's band, its leftmost and rightmost figure pixel against ours), the top
//   (each column beside the head, the sheet's topmost figure pixel against our mantle's), each layer's hem at the
//   traced points (our layer's lowest pixel in that column), the clasps' centres and radii; and any crossing of the
//   mantle with itself, heavily.
//
//   node tools/sculpt/lowmantlefit.mjs --who male [--rounds 3] [--out tools/sculpt/lowmantle-fit-male.json]
//     prints the misfit per view as it goes and writes the fitted numbers (merged over DESIGN by garments/mantle.mjs)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { crossPairs } from './lowgarment.mjs';
import { buildMantle, DESIGN } from './garments/mantle.mjs';
import { CAMS, BOXES, VIEWS, raster } from './lowmantlereg.mjs';

const DIR = new URL('.', import.meta.url).pathname;
const SM = JSON.parse(readFileSync(join(DIR, 'lowmantle-sheetmasks.json'), 'utf8'));
const LAY = { ring: 2, collar: 3, mid1: 4, mid2: 5, main: 6 };

const grid = (rows, W, H) => { const A = new Uint8Array(W * H); rows.forEach((r, y) => { for (let k = 0; k < r.length; k += 2) A.fill(1, y * W + r[k], y * W + r[k + 1]); }); return A; };
const SHEET = {};
for (const who of ['male', 'female']) {
  SHEET[who] = {};
  for (const v of VIEWS) { const d = SM.views[who][v], [, , W, H] = d.box; SHEET[who][v] = { box: d.box, fig: grid(d.fig, W, H), skin: grid(d.skin, W, H) }; }
}

/** The misfit of a built mantle on a body, per view and in all. */
export function misfit(who, rig, G) {
  const B = rig.B, bodyTris = B.tris.map((t) => t.v.map((i) => B.verts[i])), byLabel = {};
  for (const t of G.tris) { const part = G.polys[t.poly].part, l = part.startsWith('clasp') ? 7 : LAY[part]; (byLabel[l] ??= []).push(t.v.map((i) => G.verts[i])); }
  const [y0, y1] = SM.band[who], per = {};
  let total = 0;
  for (const v of VIEWS) {
    const c = CAMS[who][v], sh = SHEET[who][v], box = sh.box, [bx, by, W, H] = box, n = W * H;
    const Z = new Float32Array(n).fill(-Infinity), L = new Uint8Array(n);
    raster(bodyTris, c, box, Z, L, 1);
    for (const [l, tris] of Object.entries(byLabel)) raster(tris, c, box, Z, L, +l);
    const alone = {};
    const lone = (l) => (alone[l] ??= (() => { const Z2 = new Float32Array(n).fill(-Infinity), A = new Uint8Array(n); raster(byLabel[l] ?? [], c, box, Z2, A, 1); return A; })());
    // the outline
    let ol = 0, on = 0;
    for (let Y = y0; Y < y1; Y++) {
      const yy = Y - by; if (yy < 0 || yy >= H) continue;
      let fa = -1, fb = -1, oa = -1, ob = -1;
      for (let x = 0; x < W; x++) { const i = yy * W + x; if (sh.fig[i]) { if (fa < 0) fa = x; fb = x; } if (L[i]) { if (oa < 0) oa = x; ob = x; } }
      if (fa >= 0 && oa >= 0) { ol += Math.abs(fa - oa) + Math.abs(fb - ob); on += 2; }
    }
    // the top
    let tp = 0, tn = 0;
    for (let x = 0; x < W; x++) {
      let f = -1, o = -1;
      for (let y = 0; y < H; y++) if (sh.fig[y * W + x]) { f = y; break; }
      for (let y = 0; y < H; y++) if (L[y * W + x] >= 2) { o = y; break; }
      if (f < 0 || o < 0 || sh.skin[f * W + x] || f + by < y0 - 6) continue;
      tp += Math.abs(f - o); tn++;
    }
    const r = { outline: on ? ol / on : 0, top: tn ? tp / tn : 0 };
    let loss = r.outline + 0.7 * r.top;
    // the hems and the clasps
    for (const [lay, pts] of Object.entries(SM.trace[who][v] ?? {})) {
      if (lay === 'clasps') {
        const A = lone(7), mid = (pts[0][0] + pts[1][0]) / 2, ds = [];
        for (const [cx, cy, rr] of pts) {
          let sx = 0, sy = 0, cnt = 0;
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A[y * W + x] && ((x + bx < mid) === (cx < mid))) { sx += x; sy += y; cnt++; }
          if (!cnt) { ds.push(30); continue; }
          ds.push(Math.hypot(sx / cnt + bx - cx, sy / cnt + by - cy) + Math.abs(Math.sqrt(cnt / Math.PI) - rr));
        }
        r.clasps = ds.map((x) => +x.toFixed(1)); loss += 0.5 * ds.reduce((a, b) => a + b, 0) / ds.length;
        continue;
      }
      const A = lone(LAY[lay]), ds = [];
      for (const [X, Y] of pts) {
        const xx = X - bx; if (xx < 0 || xx >= W) continue;
        let low = -1; for (let y = 0; y < H; y++) if (A[y * W + xx]) low = y;
        ds.push(low < 0 ? 30 : low + by - Y);
      }
      r[lay] = ds; if (ds.length) loss += 0.8 * ds.reduce((a, b) => a + Math.abs(b), 0) / ds.length;
    }
    r.loss = +loss.toFixed(2); r.outline = +r.outline.toFixed(2); r.top = +r.top.toFixed(2);
    per[v] = r; total += loss;
  }
  const self = crossPairs(G.verts, G.tris).length;
  return { total: total / VIEWS.length + 3 * self, self, per };
}

/** A design with the value at path (a list of keys) set. */
const setAt = (o, path, val) => { const c = structuredClone(o); let t = c; for (const k of path.slice(0, -1)) t = t[k]; t[path[path.length - 1]] = val; return c; };
const getAt = (o, path) => path.reduce((t, k) => t[k], o);
const P0pin = new Set();

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const who = opt('who', 'male'), rounds = +opt('rounds', '3'), out = opt('out', join(DIR, `lowmantle-fit-${who}.json`));
  const rig = buildRig(who);
  let D = structuredClone(opt('from', null) ? JSON.parse(readFileSync(opt('from'), 'utf8')).design : DESIGN[who]);
  if (opt('pin', null)) for (const pth of opt('pin').split(',')) P0pin.add(pth);
  const P = [ [['dome', 'h', 1], 0.05], [['dome', 'h', 2], 0.05], [['dome', 'a', 1], 0.1], [['lean', 1], 0.04], [['raise', 1], 0.05], [['raise', 2], 0.05],
    ...[1, 2, 3, 4, 5].map((i) => [['tiers', 0, 'hem', i, 1], 0.15]), ...[1, 2, 3, 4, 5].map((i) => [['tiers', 1, 'hem', i, 1], 0.12]), ...[1, 2, 3, 4].map((i) => [['tiers', 2, 'hem', i, 1], 0.1]),
    [['collar', 'len', 1, 1], 0.1], [['collar', 'len', 2, 1], 0.1], [['collar', 'lean', 1], 4], [['clasp', 'at'], 2], [['clasp', 's'], 0.06], [['clasp', 'r'], 0.03],
  ];
  const evalD = (d) => { try { return misfit(who, rig, buildMantle(rig, d)); } catch (e) { return { total: 1e9, err: e.message }; } };
  let best = evalD(D);
  console.log('start', best.total.toFixed(2), JSON.stringify(best.per));
  const steps = P.map(([, s]) => s);
  for (let r = 0; r < rounds; r++) {
    let moved = false;
    P.forEach(([path], i) => {
      for (const sgn of [1, -1]) {
        const v0 = getAt(D, path), d2 = setAt(D, path, +(v0 + sgn * steps[i]).toFixed(4)), m = evalD(d2);
        if (m.total < best.total - 0.01) { D = d2; best = m; moved = true; console.log(`r${r} ${path.join('.')} ${v0} -> ${getAt(D, path)}: ${best.total.toFixed(2)}`); break; }
      }
    });
    writeFileSync(out, JSON.stringify({ design: D, misfit: best }, null, 1));
    if (!moved) steps.forEach((_, i) => { steps[i] /= 2; });
  }
  console.log('best', best.total.toFixed(2), JSON.stringify(best.per));
}
