// Fits the low-poly torso (tools/sculpt/lowtorso.mjs) to its reference sheet as a direct mirror, as tools/sculpt/lowfit.mjs
// fits the heads: each view's camera, then a coarse mirrored lattice over the torso, then its vertices one by one, so its
// outline and its landmarks land where the reference's do in all eight views. The neck's foot (the head's nm0..nm5)
// never moves.
//
//   python3 tools/sculpt/lowmask.py tools/sculpt/ref/torso-lowpoly-male.png /tmp/tref-male.json --torso male   # once
//   node tools/sculpt/lowtfit.mjs --who male --ref /tmp/tref-male.json --stage camera|lattice|mesh|report [--rounds 3]
//
// Cameras are kept in tools/sculpt/lowcams.json under 'torso-<who>'; the fitted vertices in tools/sculpt/lowtfit-<who>.json,
// which lowtorso.mjs reads over its own. Landmarks: tools/sculpt/lowtmarks.json, { who: { view: { name: [x, y, vertex] } } },
// the reference's point on the sheet and the vertex that belongs there (a name with ' the torso's right side's, a list the
// mean of its vertices). The report prints per view the outline's distance from the reference's (mean and worst) and the
// worst landmark, as % of the torso's height in the reference's front view, and the IoU.
//
// The views count by the user's order: the front, profile and three-quarter most, the back and the rear three-quarter
// next, the top, bottom and under three-quarter least (WEIGHT).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildLowTorso, PRESETS, NECK_FOOT } from './lowtorso.mjs';
import { PRESETS as HEADS } from './lowhead.mjs';
import { CAMS_FILE, TORSO_CAMS, TORSO_VIEWS as VIEWS, loadCams, project, rotation } from './lowcam.mjs';
import { rasterSilhouette, outline, distanceTo, descend } from './lowsil.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i < 0 ? d : args[i + 1]; };
const who = opt('who', 'male');
const stage = opt('stage', 'report');
const REF = JSON.parse(readFileSync(opt('ref'), 'utf8'));
const DIR = new URL('.', import.meta.url).pathname;
const K = REF.scale;
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const WEIGHT = { front: 1, q3: 1, profile: 1, r3: 0.6, back: 0.6, top: 0.25, bottom: 0.25, under: 0.25 };
const MARKS_FILE = join(DIR, 'lowtmarks.json');
const MARKS = existsSync(MARKS_FILE) ? (JSON.parse(readFileSync(MARKS_FILE, 'utf8'))[who] ?? {}) : {};
const LW = +opt('lw', '0.5'); // a landmark's pixel counts this much against the outline's mean

// The reference's masks, outlines and distance fields, once; the torso's height in its front view, for the percentages.
const R = {};
for (const v of VIEWS) {
  const r = REF.views[v];
  const m = new Uint8Array(r.w * r.h);
  r.mask.forEach((row, j) => { for (let i = 0; i < r.w; i++) m[j * r.w + i] = row[i] === '1' ? 1 : 0; });
  const ol = outline({ m, w: r.w, h: r.h });
  R[v] = { ...r, m, ol, dt: distanceTo(ol, r.w, r.h) };
}
const HT = (() => { const f = R.front; let lo = 1e9, hi = -1; for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) if (f.m[j * f.w + i]) { lo = Math.min(lo, j); hi = Math.max(hi, j); } return (hi - lo + 1) * K; })();

const viewTris = (mesh) => mesh.tris.map((t) => t.v.map((i) => mesh.verts[i]));
/** Where a landmark's vertex (or the mean of a list of them) lands on the sheet under cam. */
function markAt(mesh, names, cam) {
  const list = Array.isArray(names) ? names : [names];
  const pts = list.map((n) => { const side = n.endsWith("'") ? -1 : 1, k = n.replace("'", ''); return mesh.verts[mesh.ids[side][k]]; });
  const c = [0, 1, 2].map((k) => pts.reduce((a, p) => a + p[k], 0) / pts.length);
  return project(c, cam);
}

/** One view's error: the outlines' mean symmetric distance and worst, the landmarks' distances, the IoU. */
export function viewError(mesh, view, cam, tris = viewTris(mesh)) {
  const r = R[view];
  const s = rasterSilhouette(tris, cam, r.box, K);
  const ol = outline(s);
  let inter = 0, uni = 0;
  for (let k = 0; k < s.m.length; k++) { if (s.m[k] && r.m[k]) inter++; if (s.m[k] || r.m[k]) uni++; }
  if (!ol.length) return { mean: 1e3, worst: 1e3, marks: [], iou: 0, score: 1e6 };
  const dt = distanceTo(ol, s.w, s.h);
  let a = 0, wa = 0, b = 0, wb = 0;
  for (const k of ol) { a += r.dt[k]; wa = Math.max(wa, r.dt[k]); }
  for (const k of r.ol) { b += dt[k]; wb = Math.max(wb, dt[k]); }
  const mean = ((a / ol.length + b / r.ol.length) / 2) * K, worst = Math.max(wa, wb) * K;
  const marks = Object.entries(MARKS[view] ?? {}).map(([name, [x, y, v]]) => { const p = markAt(mesh, v, cam); return { name, d: Math.hypot(p[0] - x, p[1] - y) }; });
  const mmean = marks.length ? marks.reduce((t, m) => t + m.d, 0) / marks.length : 0;
  return { mean, worst, marks, iou: inter / uni, score: WEIGHT[view] * (mean + 0.15 * worst + LW * mmean) };
}

/** How far the polygons of four or more corners are from flat (each corner's squared distance from the plane through the
 * polygon's centre along its Newell normal, summed). */
export function warp(m) {
  let t = 0;
  for (const p of m.polys) {
    if (p.v.length < 4) continue;
    const pts = p.v.map((i) => m.verts[i]); let n = [0, 0, 0];
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; }
    const l = Math.hypot(...n) || 1; n = n.map((x) => x / l);
    const c = [0, 1, 2].map((k) => pts.reduce((a, q) => a + q[k], 0) / pts.length);
    for (const q of pts) t += ((q[0] - c[0]) * n[0] + (q[1] - c[1]) * n[1] + (q[2] - c[2]) * n[2]) ** 2;
  }
  return t;
}
/** How many triangles turned over against the hand-set torso's. */
function folds(m, base) {
  let n = 0;
  for (let i = 0; i < m.tris.length; i++) {
    const t = m.tris[i].v.map((v) => m.verts[v]), u = base.tris[i].v.map((v) => base.verts[v]);
    const nt = cross3(sub3(t[1], t[0]), sub3(t[2], t[0])), nu = cross3(sub3(u[1], u[0]), sub3(u[2], u[0]));
    if (nt[0] * nu[0] + nt[1] * nu[1] + nt[2] * nu[2] < 0) n++;
  }
  return n;
}

const cams = loadCams(who, 'torso');
function saveCams(c) {
  const all = existsSync(CAMS_FILE) ? JSON.parse(readFileSync(CAMS_FILE, 'utf8')) : {};
  all[`torso-${who}`] = Object.fromEntries(Object.entries(c).map(([v, x]) => { const { piv, ...rest } = x; return [v, rest]; }));
  writeFileSync(CAMS_FILE, JSON.stringify(all, null, 1));
}
// The views' angles held near what they look like: yaw within 30 degrees of the default, pitch within 15 (the top, the
// bottom and the under three-quarter within 30); measured, not assumed, but not free to fit the torso's own errors.
function limit(v, k, x) {
  const d = TORSO_CAMS[v];
  if (k === 'yaw') { const r = v === 'front' || v === 'back' ? 6 : +opt('yawrange', '30'); return Math.min(d.yaw + r, Math.max(d.yaw - r, x)); }
  if (k === 'pitch') { const r = ['top', 'bottom', 'under'].includes(v) ? 30 : 15; return Math.min(d.pitch + r, Math.max(d.pitch - r, x)); }
  return x;
}

const preset = structuredClone(PRESETS[who]);
const base0 = buildLowTorso(who, PRESETS[who]);
let mesh = buildLowTorso(who, preset);

function report(tag) {
  const rows = [];
  let tot = 0;
  for (const v of VIEWS) {
    const e = viewError(mesh, v, cams[v]);
    tot += e.score;
    const wm = e.marks.length ? e.marks.reduce((a, b) => (b.d > a.d ? b : a)) : null;
    rows.push(`${v.padEnd(8)} outline mean ${((100 * e.mean) / HT).toFixed(1)}% worst ${((100 * e.worst) / HT).toFixed(1)}%  IoU ${e.iou.toFixed(3)}  ${wm ? `worst landmark ${wm.name} ${((100 * wm.d) / HT).toFixed(1)}%  (mean ${((100 * e.marks.reduce((a, m) => a + m.d, 0)) / e.marks.length / HT).toFixed(1)}%, ${e.marks.length})` : ''}`);
  }
  console.log(`${who} ${tag} (score ${tot.toFixed(1)}, warp ${(1000 * warp(mesh)).toFixed(1)}e-3, folds ${folds(mesh, base0)}, torso height ${HT}px)\n` + rows.join('\n'));
}
const camParams = (views, step = 2, keys = ['cx', 'cy', 's', 'yaw', 'pitch']) => views.flatMap((v) => keys.map((k) => ({ step: k === 's' ? step / 2 : step, get: () => cams[v][k], set: (x) => { cams[v][k] = limit(v, k, x); } })));
const only = opt('views', '') ? opt('views').split(',') : VIEWS;
const score = () => only.reduce((s, v) => s + viewError(mesh, v, cams[v]).score, 0);

if (stage === 'camera') {
  report('before');
  for (const v of only) {
    const c = cams[v];
    const ps = [{ k: 'cx', step: 8 }, { k: 'cy', step: 8 }, { k: 's', step: 4 }, { k: 'yaw', step: 6 }, { k: 'pitch', step: 6 }];
    descend(ps.map((p) => ({ step: p.step, get: () => c[p.k], set: (x) => { c[p.k] = limit(v, p.k, x); } })), () => viewError(mesh, v, c).score, +opt('rounds', 8));
  }
  saveCams(cams);
  report('after');
}

// The torso moved as a whole: a lattice over it (a centre column and a mirrored side column, GY rows down, GZ rows front to
// back), every vertex moved by the trilinear blend of its cell's corners; the planes ride along, only the proportions change.
const GX1 = 2.2, GY = [0.7, 0, -0.6, -1.2, -1.8, -2.4, -3.0, -3.6, -4.2], GZ = [-1.4, -0.5, 0.4, 1.3];
function deform(p, L) {
  const at = (g, v, desc) => { let i = 0; if (desc) { while (i < g.length - 2 && v < g[i + 1]) i++; } else { while (i < g.length - 2 && v > g[i + 1]) i++; } return [i, Math.min(1, Math.max(0, (v - g[i]) / (g[i + 1] - g[i])))]; };
  const ax = Math.min(1, Math.abs(p[0]) / GX1), sx = Math.sign(p[0]) || 1;
  const [j, ty] = at(GY, p[1], true), [k, tz] = at(GZ, p[2]);
  const d = [0, 0, 0];
  for (const [jj, wy] of [[j, 1 - ty], [j + 1, ty]]) for (const [kk, wz] of [[k, 1 - tz], [k + 1, tz]]) {
    const n = L[jj][kk], w = wy * wz;
    const side = [n.s[0] * sx, n.s[1], n.s[2]], mid = [0, n.c[0], n.c[1]];
    for (let q = 0; q < 3; q++) d[q] += w * (mid[q] * (1 - ax) + side[q] * ax);
  }
  return [p[0] + d[0], p[1] + d[1], p[2] + d[2]];
}
if (stage === 'lattice') {
  report('before');
  const L = GY.map(() => GZ.map(() => ({ c: [0, 0], s: [0, 0, 0] })));
  const ps = [];
  for (const row of L) for (const n of row) {
    for (let q = 0; q < 2; q++) ps.push({ step: 0.06, get: () => n.c[q], set: (x) => { n.c[q] = x; } });
    for (let q = 0; q < 3; q++) ps.push({ step: 0.06, get: () => n.s[q], set: (x) => { n.s[q] = x; } });
  }
  const P0 = PRESETS[who].V;
  const apply = () => { for (const n of Object.keys(P0)) { const q = deform(P0[n], L); preset.V[n] = P0[n][0] === 0 ? [0, q[1], q[2]] : q; } mesh = buildLowTorso(who, preset); };
  const camPs = args.includes('--with-camera') ? camParams(only, 1.5) : [];
  const total = () => { apply(); return score() + 20 * folds(mesh, base0); };
  for (let r = 0; r < +opt('rounds', 3); r++) console.log('sweep', r, descend([...ps, ...camPs], total, 1).toFixed(1));
  apply();
  writeFileSync(join(DIR, `lowtfit-${who}.json`), JSON.stringify({ V: preset.V }, null, 1));
  if (camPs.length) saveCams(cams);
  report('after');
}

if (stage === 'mesh') {
  report('before');
  // --names a,b*: only these vertices (a name ending in * every vertex it starts)
  const sel = opt('names', '').split(',').filter(Boolean);
  const names = Object.keys(preset.V).filter((n) => !NECK_FOOT.includes(n) && (!sel.length || sel.some((o) => n === o || (o.endsWith('*') && n.startsWith(o.slice(0, -1))))));
  const ps = [];
  for (const n of names) for (let k = 0; k < 3; k++) {
    if (k === 0 && preset.V[n][0] === 0) continue; // the centre line stays on it
    ps.push({ step: +opt('step', '0.04'), get: () => preset.V[n][k], set: (x) => { preset.V[n][k] = x; } });
  }
  // --flat w: a polygon off its own plane costs w per head unit squared; --reg r: each vertex's move from where it
  // started costs r per head unit squared
  // --foot: the neck's foot (the head's ring nm0..nm5) moves too, to the torso sheet's neck base; it is written back into
  // the head's own fit (tools/sculpt/lowfit-<who>.json), so head and torso still share it: only the head's neck
  // changes, down from its jaw
  const footFree = args.includes('--foot');
  if (footFree) {
    preset.foot = Object.fromEntries(NECK_FOOT.map((n) => [n, [...HEADS[who].V[n]]]));
    for (const n of NECK_FOOT) for (let k = 0; k < 3; k++) {
      if (k === 0 && preset.foot[n][0] === 0) continue;
      ps.push({ step: +opt('step', '0.04'), get: () => preset.foot[n][k], set: (x) => { preset.foot[n][k] = x; } });
    }
  }
  const flatW = +opt('flat', '200'), reg = +opt('reg', '0');
  const start = structuredClone(preset.V);
  const moved = () => { let t = 0; for (const n of names) for (let k = 0; k < 3; k++) t += (preset.V[n][k] - start[n][k]) ** 2; return t; };
  const camPs = args.includes('--with-camera') ? camParams(only, 1) : [];
  // --shift: the whole torso moved up and down and back and forth against the neck's foot (which never moves), free of
  // --reg; every camera moved with it, so only the neck's foot moves on the sheet
  const shift = [0, 0];
  const shiftPs = args.includes('--shift') ? [1, 2].map((k, q) => ({ step: 0.02, get: () => shift[q], set: (x) => {
    const d = x - shift[q]; shift[q] = x;
    for (const n of Object.keys(preset.V)) { if (NECK_FOOT.includes(n)) continue; preset.V[n][k] += d; if (start[n]) start[n][k] += d; }
    for (const v of VIEWS) { const c = cams[v], r = rotation(c); c.cx -= c.s * r[k] * d; c.cy += c.s * r[3 + k] * d; }
  } })) : [];
  const total = () => { mesh = buildLowTorso(who, preset); return score() + 20 * folds(mesh, base0) + reg * moved() + flatW * warp(mesh); };
  for (let r = 0; r < +opt('rounds', 3); r++) console.log('sweep', r, descend([...shiftPs, ...ps, ...camPs], total, 1).toFixed(1));
  if (shiftPs.length) console.log('shift', shift.map((x) => x.toFixed(3)).join(' '));
  mesh = buildLowTorso(who, preset);
  writeFileSync(join(DIR, `lowtfit-${who}.json`), JSON.stringify({ V: preset.V }, null, 1));
  if (footFree) {
    const hf = join(DIR, `lowfit-${who}.json`), head = JSON.parse(readFileSync(hf, 'utf8'));
    for (const n of NECK_FOOT) head.V[n] = preset.foot[n].map((x) => +x.toFixed(4));
    writeFileSync(hf, JSON.stringify(head, null, 1));
    console.log('neck foot written into', hf);
  }
  if (camPs.length || shiftPs.length) saveCams(cams);
  report('after');
}

if (stage === 'report') report('now');
// --marks out.json: each landmark's reference point and where its vertex lands, per view, for the overlays
if (opt('marks', '')) {
  const out = {};
  for (const v of VIEWS) out[v] = Object.entries(MARKS[v] ?? {}).map(([name, [x, y, n]]) => ({ name, ref: [x, y], ours: markAt(mesh, n, cams[v]).slice(0, 2) }));
  writeFileSync(opt('marks'), JSON.stringify(out));
}
