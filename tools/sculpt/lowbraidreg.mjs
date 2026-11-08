// The side braid's sheet cameras registered to a body's head (tools/sculpt/hairs/braid-cams.json, read by
// tools/sculpt/lowbraid.mjs): the sheet a turntable, so one tilt, one height scale and one pivot row for all five views
// (its pupils sit on the same row in every view), and per view its turn, its column, its across scale, and a 2D
// correction (roll, shear sh: the sheet's face is drawn, not rendered from her), fitted so that
//   - her landmarks land on the sheet's (tools/sculpt/lowbraidsheet.py: the pupils, the nose's tip, the chin, the ears
//     across, the neck's sides across, the brow's ends), and
//   - her head and neck cover the sheet's skin and nothing of its background in the rows from the brows down to the chin
//     (ROWS; the views from behind: the jaw to the neck), the sheet's hair, which hides the skull, left out.
// Coordinate descent from the last fit; the priors keep the correction small (roll 0, ax 1, sh 0). Prints each
// landmark's residual (px) and the outline's mean distance (px). The sheet has no mouth, and her neck is shorter than the
// sheet's: the neck's sides count across only, at her own chin's distance.
//
//   node tools/sculpt/lowbraidreg.mjs [--rounds 7]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { project, raster } from './lowhairhull.mjs';

const DIR = new URL('.', import.meta.url).pathname;
export const VIEWS = ['front', 'q3', 'profile', 'r3', 'back'];
export const SPAN = { front: [40, 345], q3: [345, 650], profile: [650, 955], r3: [955, 1245], back: [1245, 1536] };
const ROWS = { front: [150, 250], q3: [150, 250], profile: [150, 246], r3: [185, 255], back: [200, 255] };
/** Each landmark's weight per square pixel off, [across, up]. */
const MARK_W = { pupil: [30, 30], 'brow end': [3, 6], nose: [8, 2], chin: [10, 10], ear: [12, 0], neck: [6, 0] };
const PRIOR = { roll: 40, ax: 3e3, sh: 4e4 };
/** The back's turn held near straight behind (it has the neck's one side only to go by): per square degree. */
const BACK_YAW = [180, 3];

export function sheetOf() {
  const S = JSON.parse(readFileSync(join(DIR, 'hairs/braid-sheet.json'), 'utf8'));
  const grid = (runs) => { const A = new Uint8Array(S.w * S.h); runs.forEach((r, y) => { for (let k = 0; k < r.length; k += 2) A.fill(1, y * S.w + r[k], y * S.w + r[k + 1]); }); return A; };
  return { ...S, F: grid(S.fig), Hm: grid(S.hair), Sk: grid(S.skin) };
}

/** The body's landmarks: the pupils, the brows' ends and middles, the nose's tip, the chin, the ears. */
export function bodyMarks(B) {
  const mid = (ps) => [0, 1, 2].map((k) => ps.reduce((a, q) => a + q[k], 0) / ps.length);
  const of = (mat, s) => [...new Set(B.polys.filter((p) => p.mat === mat).flatMap((p) => p.v))].map((i) => B.verts[i]).filter((q) => Math.sign(q[0]) === s);
  const out = { pupils: [], brows: [] };
  for (const s of [-1, 1]) {
    out.pupils.push(mid(of('pupil', s)));
    const b = of('brow', s), ax = b.map((q) => Math.abs(q[0])), lo = Math.min(...ax), hi = Math.max(...ax);
    out.brows.push({ inner: mid(b.filter((q) => Math.abs(q[0]) < lo + 0.02)), outer: mid(b.filter((q) => Math.abs(q[0]) > hi - 0.02)), mid: mid(b) });
  }
  out.nose = B.polys.filter((p) => p.part === 'head').flatMap((p) => p.v).map((i) => B.verts[i]).reduce((a, q) => (q[2] > a[2] ? q : a));
  out.chin = B.verts[B.index.get('ch0')];
  out.ears = ['L', 'R'].map((sd) => mid(B.names.map((n, i) => (n && n.startsWith('ear.' + sd) ? B.verts[i] : null)).filter(Boolean)));
  return out;
}

/** The head and neck as triangles. */
export const headTris = (B) => B.tris.filter((t) => ['head', 'neck'].includes(B.polys[t.poly].part)).map((t) => t.v.map((i) => B.verts[i]));

/** The landmark pairs of a view under a camera: [name, sheet [x, y], body point | (cov => [x, y])]. */
export function pairsOf(v, c, S, M) {
  const sm = S.marks[v] ?? {}, out = [], px = (p) => project(p, c);
  const near = (list, at) => list.reduce((a, q) => (Math.hypot(px(q.mid ?? q)[0] - at[0], px(q.mid ?? q)[1] - at[1]) < Math.hypot(px(a.mid ?? a)[0] - at[0], px(a.mid ?? a)[1] - at[1]) ? q : a));
  for (const p of sm.pupils ?? []) out.push(['pupil', p, near(M.pupils, p)]);
  for (const b of sm.brows ?? []) {
    const ours = near(M.brows, b.mid), ends = [ours.inner, ours.outer].sort((a, q) => px(a)[0] - px(q)[0]);
    out.push(['brow end', b.a, ends[0]], ['brow end', b.b, ends[1]]);
  }
  if (sm.nose) out.push(['nose', sm.nose, M.nose]);
  if (sm.chin) out.push(['chin', sm.chin, M.chin]);
  for (const e of sm.ears ?? []) out.push(['ear', e, M.ears.reduce((a, q) => (Math.abs(px(q)[0] - e[0]) < Math.abs(px(a)[0] - e[0]) ? q : a))]);
  return out;
}

/** The body's neck side nearest the sheet's at the sheet's distance under the chin (the views from behind: at its row):
 * the coverage's edge along that row. */
function neckSide(v, c, S, cov, M, at) {
  const sm = S.marks[v], dy = sm.chin ? at[1] - sm.chin[1] : 0;
  const y = Math.round(sm.chin ? project(M.chin, c)[1] + dy : at[1]), [lo, hi] = SPAN[v];
  let best = null;
  for (let x = lo + 1; x < hi; x++) {
    const a = cov[y * S.w + x - 1], b = cov[y * S.w + x];
    if (a !== b && (best === null || Math.abs(x - at[0]) < Math.abs(best - at[0]))) best = x;
  }
  return best ?? at[0] + 30;
}

/** A view's cost: the outline's misfit (the sheet's skin pixels the head leaves bare and the background it covers, in
 * ROWS, the hair left out) and the landmarks; and the outline's mean distance (px). */
export function viewFit(v, c, S, tris, M) {
  const [lo, hi] = SPAN[v], [y0, y1] = ROWS[v], Z = new Float32Array(S.w * S.h).fill(-Infinity), cov = new Uint8Array(S.w * S.h);
  raster(tris, c, Z, S.w, S.h, cov, 1);
  let bare = 0, over = 0, edge = 0;
  for (let y = y0; y < y1; y++) for (let x = lo; x < hi; x++) {
    const i = y * S.w + x;
    if (S.Hm[i]) continue;
    const f = S.F[i];
    if (f && !cov[i]) bare++; else if (!f && cov[i]) over++;
    if (f && (!S.F[i - 1] || !S.F[i + 1])) edge++;
  }
  const res = [];
  let m = 0;
  for (const [n, at, p] of pairsOf(v, c, S, M)) {
    const q = project(p, c), w = MARK_W[n];
    m += w[0] * (q[0] - at[0]) ** 2 + w[1] * (q[1] - at[1]) ** 2;
    res.push(n === 'ear' ? `ear across ${Math.abs(q[0] - at[0]).toFixed(2)}` : `${n} ${Math.hypot(q[0] - at[0], q[1] - at[1]).toFixed(2)}`);
  }
  for (const at of S.marks[v].neck ?? []) {
    const x = neckSide(v, c, S, cov, M, at);
    m += MARK_W.neck[0] * (x - at[0]) ** 2; res.push(`neck across ${Math.abs(x - at[0]).toFixed(2)}`);
  }
  const prior = (v === 'back' ? BACK_YAW[1] * (c.yaw - BACK_YAW[0]) ** 2 : 0) + PRIOR.roll * (c.roll ?? 0) ** 2 + PRIOR.ax * ((c.ax ?? 1) - 1) ** 2 + PRIOR.sh * (c.sh ?? 0) ** 2;
  return { cost: bare + over + m + prior, px: (bare + over) / Math.max(1, edge), res };
}

export function camsOf(g) {
  return Object.fromEntries(VIEWS.map((v) => { const p = g[v]; return [v, { yaw: p.yaw, pitch: g.pitch, s: g.sv, cx: p.cx, cy: g.cy, roll: p.roll, ax: p.sx / g.sv, ay: 1, sh: p.sh }]; }));
}

function fit(rounds, who = 'female') {
  const B = buildRig(who).B, M = bodyMarks(B), tris = headTris(B), S = sheetOf();
  const old = JSON.parse(readFileSync(join(DIR, 'hairs/braid-cams.json'), 'utf8'));
  const g = { pitch: old.front.pitch, sv: old.front.s * (old.front.ay ?? 1), cy: old.front.cy };
  for (const v of VIEWS) g[v] = { yaw: old[v].yaw, cx: old[v].cx, sx: old[v].s * (old[v].ax ?? 1), roll: old[v].roll ?? 0, sh: old[v].sh ?? 0 };
  const per = Object.fromEntries(VIEWS.map((v) => [v, viewFit(v, camsOf(g)[v], S, tris, M).cost]));
  let best = Object.values(per).reduce((a, q) => a + q, 0);
  const keys = [['pitch', 1], ['sv', 2], ['cy', 1.5], ...VIEWS.flatMap((v) => [[v + '.yaw', 2], [v + '.cx', 1.5], [v + '.sx', 2], [v + '.roll', 1], [v + '.sh', 0.03]])];
  const get = (k) => (k.includes('.') ? g[k.split('.')[0]][k.split('.')[1]] : g[k]);
  const set = (k, x) => { if (k.includes('.')) g[k.split('.')[0]][k.split('.')[1]] = x; else g[k] = x; };
  const tryIt = (k, x) => {
    const was = get(k); set(k, x);
    const cs = camsOf(g), views = k.includes('.') ? [k.split('.')[0]] : VIEWS, nv = {};
    for (const v of views) nv[v] = viewFit(v, cs[v], S, tris, M).cost;
    const tot = best - views.reduce((a, v) => a + per[v], 0) + views.reduce((a, v) => a + nv[v], 0);
    if (tot < best) { best = tot; Object.assign(per, nv); return true; }
    set(k, was); return false;
  };
  for (let r = 0; r < rounds; r++) for (const [k, st0] of keys) {
    const st = st0 / 2 ** r;
    for (let it = 0; it < 16; it++) if (!tryIt(k, get(k) + st) && !tryIt(k, get(k) - st)) break;
  }
  const out = camsOf(g);
  for (const v of VIEWS) {
    const c = out[v];
    for (const k of Object.keys(c)) c[k] = +c[k].toFixed(4);
    const f = viewFit(v, c, S, tris, M);
    console.log(v, JSON.stringify(c), `outline ${f.px.toFixed(2)} px; landmarks (px): ${f.res.join(', ')}`);
  }
  writeFileSync(join(DIR, 'hairs/braid-cams.json'), JSON.stringify(out, null, 1) + '\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  fit(+opt('rounds', 7));
}
