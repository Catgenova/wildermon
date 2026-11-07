// The low-poly arms' cap (the deltoid's ball, tools/sculpt/lowarm.mjs) placed off the sheets' silhouettes, ring by
// ring: each of the cap's rings level, at a row of the Front view the table gives, its centre and its two radii (across
// and front to back) solved so it spans the reference's outline at that row in the Front, Three-Quarter and Profile
// views and less the Rear Three-Quarter and Back (least squares); its eight points at the angles the arm's first ring (ua) has round its own centre, so the band
// from ua up runs straight. The point on top (ct) where the
// table puts the ball's highest point in the Front, Three-Quarter and Profile views.
//
//   node tools/sculpt/lowacap.mjs --who female --ref /tmp/aref-female.json     # writes lowafit-<who>.json
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PRESETS } from './lowarm.mjs';
import { rotation } from './lowcam.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i < 0 ? d : args[i + 1]; };
const who = opt('who', 'female');
const DIR = new URL('.', import.meta.url).pathname;
const REF = JSON.parse(readFileSync(opt('ref'), 'utf8'));
const CAMS = JSON.parse(readFileSync(join(DIR, 'lowacams.json'), 'utf8'))[who];

// per sex: the Front view's rows of the cap's rings, the top's row; a ring's row may carry a scale on its two radii
// (the outline at a ring's row is the ball's widest there, the ring's corners a little inside it)
export const CAP = {
  female: { top: { front: [210, 65], q3: [403, 65], profile: [588, 62] }, rings: { cc: [76, 1.06], cb: [94, 1.14], ca: [124, 1.18] } },
  male: { top: { front: [178, 67], q3: [378, 67], profile: [568, 67] }, rings: { cc: [78], cb: [100], ca: [140] } },
};
const VIEWS = ['front', 'q3', 'profile', 'r3', 'back'], VW = { front: 1, q3: 1, profile: 1, r3: 0.7, back: 0.7 };

/** A view's row run on the reference: its left and right ends (sheet px). */
function run(v, Y) {
  const r = REF.views[v], K = REF.scale, j = Math.round((Y - r.box[1]) / K), row = r.mask[j] ?? '';
  const a = row.indexOf('1'), b = row.lastIndexOf('1');
  return a < 0 ? null : [r.box[0] + a * K, r.box[0] + (b + 1) * K];
}
/** The camera's world-to-sheet rows: X = cx + s (ax·(p - piv)), Y = cy - s (ay·(p - piv)). */
function rows(c) {
  const r = rotation(c), a = ((c.roll ?? 0) * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  const R0 = [r[0], r[1], r[2]], R1 = [r[3], r[4], r[5]];
  return { ax: R0.map((q, k) => ca * q - sa * R1[k]), ay: R0.map((q, k) => sa * q + ca * R1[k]) };
}
/** Least squares for a small dense system (normal equations). */
function solve(A, b) {
  const n = A[0].length, M = Array.from({ length: n }, () => new Array(n + 1).fill(0));
  A.forEach((row, i) => { for (let p = 0; p < n; p++) { for (let q = 0; q < n; q++) M[p][q] += row[p] * row[q]; M[p][n] += row[p] * b[i]; } });
  for (let p = 0; p < n; p++) {
    let m = p; for (let q = p + 1; q < n; q++) if (Math.abs(M[q][p]) > Math.abs(M[m][p])) m = q;
    [M[p], M[m]] = [M[m], M[p]];
    for (let q = 0; q < n; q++) if (q !== p) { const f = M[q][p] / M[p][p]; for (let k = p; k <= n; k++) M[q][k] -= f * M[p][k]; }
  }
  return M.map((row, p) => row[n] / row[p]);
}

const V = structuredClone(PRESETS[who].V);
const C = CAP[who], front = CAMS.front;
const ua = Array.from({ length: 8 }, (_, i) => V[`ua${i}`]);
const uc = [0, 1, 2].map((k) => ua.reduce((s, p) => s + p[k], 0) / 8);
const ex = Math.max(...ua.map((p) => Math.abs(p[0] - uc[0]))), ez = Math.max(...ua.map((p) => Math.abs(p[2] - uc[2])));
const ang = ua.map((p) => Math.atan2((p[2] - uc[2]) / ez, (p[0] - uc[0]) / ex));
/** A level ring at world height y: its centre (x, z) and radii from the views' runs at the rows where it falls. */
function ring(y, zGuess, xGuess) {
  const A = [], b = [], A2 = [], b2 = [];
  for (const v of VIEWS) {
    const c = CAMS[v], { ax, ay } = rows(c);
    const p = [xGuess - c.piv[0], y - c.piv[1], zGuess - c.piv[2]];
    const Y = c.cy - c.s * (ay[0] * p[0] + ay[1] * p[1] + ay[2] * p[2]);
    const r = run(v, Y); if (!r) continue;
    // the middle: X = cx + s (ax·(centre - piv))
    const w = VW[v];
    A.push([w * ax[0], w * ax[2]]); b.push(w * (((r[0] + r[1]) / 2 - c.cx) / c.s - ax[1] * (y - c.piv[1]) + ax[0] * c.piv[0] + ax[2] * c.piv[2]));
    // the half width: (h/s)^2 = rx^2 ax0^2 + rz^2 ax2^2
    A2.push([w * ax[0] ** 2, w * ax[2] ** 2]); b2.push(w * ((r[1] - r[0]) / 2 / c.s) ** 2);
  }
  const [x, z] = solve(A, b), [rx2, rz2] = solve(A2, b2);
  return { x, z, rx: Math.sqrt(Math.max(rx2, 1e-4)), rz: Math.sqrt(Math.max(rz2, 1e-4)) };
}
/** The world height whose ring centre falls on the Front view's row Y (the centre's x, z as guessed). */
function yAt(Y, x, z) {
  const { ay } = rows(front);
  return front.piv[1] + ((front.cy - Y) / front.s - ay[0] * (x - front.piv[0]) - ay[2] * (z - front.piv[2])) / ay[1];
}
let x = uc[0], z = uc[2];
const out = {};
for (const [name, [Y, k = 1]] of Object.entries(C.rings)) {
  let g = { x, z };
  for (let it = 0; it < 4; it++) { const y = yAt(Y, g.x, g.z); g = { ...ring(y, g.z, g.x), y }; }
  ang.forEach((a, i) => { V[`${name}${i}`] = [g.x + k * g.rx * Math.cos(a), g.y, g.z + k * g.rz * Math.sin(a)].map((q) => +q.toFixed(4)); });
  out[name] = g;
  console.log(name, 'y', g.y.toFixed(3), 'centre', g.x.toFixed(3), g.z.toFixed(3), 'radii', g.rx.toFixed(3), g.rz.toFixed(3));
}
// the top: the point the table gives in each view (the ball's highest point, read off the sheet), solved for
{
  const A = [], b = [];
  for (const [v, [X, Y]] of Object.entries(C.top)) {
    const c = CAMS[v], { ax, ay } = rows(c);
    A.push(ax); b.push((X - c.cx) / c.s + ax[0] * c.piv[0] + ax[1] * c.piv[1] + ax[2] * c.piv[2]);
    A.push(ay); b.push((c.cy - Y) / c.s + ay[0] * c.piv[0] + ay[1] * c.piv[1] + ay[2] * c.piv[2]);
  }
  V.ct = solve(A, b).map((q) => +q.toFixed(4));
  console.log('ct', V.ct.join(', '));
}
writeFileSync(join(DIR, `lowafit-${who}.json`), JSON.stringify({ V }, null, 1));
