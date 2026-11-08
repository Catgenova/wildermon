// The side braid's crown borders (tools/sculpt/hairs/braid.mjs lines) fitted to the sheet's creases: each line laid on
// the carved hull's surface (tools/sculpt/lowbraid.mjs carve, thickOf), seen in each of the five views where it faces
// the camera and nothing stands in front of it, and moved (its control points' over and out, the root it runs to
// fixed) until it lies along the creases there (tools/sculpt/hairs/braid-creases.json: per view a distance to the
// nearest crease pixel, a chamfer map capped at 12 px), all five views at once; kept smooth, near where it was drawn,
// and clear of the lines beside it (away from the part, where they all start, and the seam, where they end). Writes
// tools/sculpt/hairs/braid-lines.json { name: [[over, out], ...] }, which hairs/braid.mjs takes over its own.
//
//   node tools/sculpt/lowbraidlines.mjs [--rounds 4]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { project, raster, skullTable, centreOf, dirOf } from './lowhairhull.mjs';
import { carve, thickOf, hullMesh, bodyTris, CAMS, VIEWS, SPAN } from './lowbraid.mjs';
import { LINES } from './hairs/braid.mjs';

const DIR = new URL('.', import.meta.url).pathname;
const W = 1536, Hh = 410, CAP = 12;
/** Each view's weight (the profile and the back show the crown's creases best; the front's are mostly the hairline). */
const VW = { front: 0.6, q3: 0.8, profile: 1.4, r3: 1, back: 1.2 };
/** The bend penalty (per square degree of second difference), the pull back to the drawn line (per square degree) and
 * the least gap to the next line (degrees, over its whole run). */
const BEND = 0.02, HOME = 0.004, GAP = 7;

function chamfer(mask) {
  const D = new Float32Array(W * Hh).fill(1e9);
  for (let i = 0; i < D.length; i++) if (mask[i]) D[i] = 0;
  const a = 1, b = Math.SQRT2;
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; let d = D[i];
    if (x > 0) d = Math.min(d, D[i - 1] + a);
    if (y > 0) { d = Math.min(d, D[i - W] + a); if (x > 0) d = Math.min(d, D[i - W - 1] + b); if (x < W - 1) d = Math.min(d, D[i - W + 1] + b); }
    D[i] = d;
  }
  for (let y = Hh - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x; let d = D[i];
    if (x < W - 1) d = Math.min(d, D[i + 1] + a);
    if (y < Hh - 1) { d = Math.min(d, D[i + W] + a); if (x < W - 1) d = Math.min(d, D[i + W + 1] + b); if (x > 0) d = Math.min(d, D[i + W - 1] + b); }
    D[i] = d;
  }
  return D;
}

/** A polyline through control points, `n` samples per span (straight between; the build splines them). */
const samples = (pts, n = 6) => { const r = []; for (let i = 0; i + 1 < pts.length; i++) for (let j = 0; j < n; j++) { const f = j / n; r.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]); } r.push(pts[pts.length - 1]); return r; };

/** 40 points along a line, at even shares of its control points' run (so two lines' points pair up). */
const fixed = (L) => { const S = samples(L, 12); return Array.from({ length: 40 }, (_, i) => S[Math.round((i * (S.length - 1)) / 39)]); };

export function fitLines(rounds = 4) {
  const H = carve(), B = H.rig.B, C = centreOf(B), sk = skullTable(B, C), th = thickOf(H);
  const M = hullMesh(H), ht = M.tris.map(([a, b, c]) => [M.verts[a], M.verts[b], M.verts[c]]), bt = bodyTris(B);
  const pts = JSON.parse(readFileSync(join(DIR, 'hairs/braid-creases.json'), 'utf8')).pts;
  const views = VIEWS.map((v) => {
    const c = CAMS[v], Z = new Float32Array(W * Hh).fill(-Infinity), mask = new Uint8Array(W * Hh);
    raster(bt, c, Z, W, Hh); raster(ht, c, Z, W, Hh);
    for (const [x, y] of pts) if (x >= SPAN[v][0] && x < SPAN[v][1]) mask[y * W + x] = 1;
    return { v, c, Z, D: chamfer(mask) };
  });
  const surf = (o, u) => { const d = dirOf(o, u); return C.map((x, k) => x + d[k] * (sk.at(o, u) + th(o, u))); };
  const lineCost = (L) => {
    let cost = 0;
    const S = samples(L).map(([o, u]) => surf(o, u));
    for (const V of views) {
      let s = 0, n = 0;
      for (const p of S) {
        const q = project(p, V.c), X = Math.floor(q[0]), Y = Math.floor(q[1]);
        if (X < 0 || Y < 0 || X >= W || Y >= Hh || q[2] < V.Z[Y * W + X] - 0.05) continue;
        s += Math.min(CAP, V.D[Y * W + X]) ** 2; n++;
      }
      if (n) cost += VW[V.v] * s / n * Math.min(1, n / 8);
    }
    for (let i = 1; i + 1 < L.length; i++) for (const k of [0, 1]) cost += BEND * (L[i - 1][k] - 2 * L[i][k] + L[i + 1][k]) ** 2;
    return cost;
  };
  const names = Object.keys(LINES), out = structuredClone(LINES);
  // the lines beside each other (each side's order from the part out to the hairline)
  const order = [['crown', 'r1', 'r2', 'r3', 'r4'], ['crown', 'l1', 'l2', 'l3', 'l4']];
  const gapCost = (name, L) => {
    let c = 0;
    for (const ord of order) {
      const i = ord.indexOf(name); if (i < 0) continue;
      const side = ord[1][0] === 'r' ? -1 : 1;
      for (const [j, sg] of [[i - 1, 1], [i + 1, -1]]) {
        if (j < 0 || j >= ord.length) continue;
        const A = fixed(L), Bn = fixed(out[ord[j]]);
        // (out across the side, beyond the line inside it)
        for (let m = 10; m < 32; m++) { const g = sg * side * (Bn[m][1] - A[m][1]); if (g > -GAP) c += 0.5 * (g + GAP) ** 2; }
      }
    }
    return c;
  };
  for (let r = 0; r < rounds; r++) for (const name of names) {
    let L = out[name];
    const total = (Lx) => lineCost(Lx) + gapCost(name, Lx) + HOME * Lx.reduce((a, p, i) => a + (p[0] - LINES[name][i][0]) ** 2 + (p[1] - LINES[name][i][1]) ** 2, 0);
    let best = total(L);
    for (const st of [4, 2, 1].map((x) => x / (r + 1))) for (let i = 0; i + 1 < L.length; i++) for (const k of [0, 1]) for (const sg of [1, -1]) {
      for (let it = 0; it < 6; it++) {
        const T = L.map((p) => [...p]); T[i][k] += sg * st;
        const f = total(T);
        if (f < best) { best = f; L = T; } else break;
      }
    }
    out[name] = L.map(([o, u]) => [+o.toFixed(1), +u.toFixed(1)]);
    if (r === rounds - 1) console.log(name, 'cost', lineCost(L).toFixed(1));
  }
  writeFileSync(join(DIR, 'hairs/braid-lines.json'), JSON.stringify(out, null, 0) + '\n');
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  fitLines(+opt('rounds', 4));
}
