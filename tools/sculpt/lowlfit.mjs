// Fits the low-poly pelvis and legs (tools/sculpt/lowlegs.mjs) to their references as a direct mirror, as
// tools/sculpt/lowtfit.mjs fits the torsos: each view's camera, then the rows as wholes (each ring's height, width and
// depth: the coarse fit, the rows kept as the topology panel draws them), then single vertices chosen by hand, so the outline and the landmarks land where the references' do. The torso's hip cut ring (bt0..bt8)
// never moves: it is the torso's.
//
//   python3 tools/sculpt/lowlmask.py male /tmp/lref-male.json      # once
//   node tools/sculpt/lowlfit.mjs --who male --ref /tmp/lref-male.json --stage camera|rings|mesh|report [--rounds 3]
//
// The silhouette is the torso and the legs together (tools/sculpt/lowlegs.mjs buildLowLower), compared from the belt's
// lower edge down (the mask's 'top'), and nowhere inside the loincloth or over the hands (the mask's 'cloth' polygons).
// Cameras: tools/sculpt/lowlcams.json (tools/sculpt/lowlcam.mjs); the fitted vertices: tools/sculpt/lowlfit-<who>.json,
// which lowlegs.mjs reads over its own. Landmarks: tools/sculpt/lowlmarks.json, { who: { view: { name: [x, y, vertex] } } }
// (a name with ' the body's right side's vertex, a list the mean of its vertices). The report prints per view the outline's
// distance from the reference's (mean and worst) and the worst landmark, as % of that view's leg height (the belt's lower
// edge to the floor), and the IoU.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildLowLegs, buildLowLower, PRESETS, WAIST } from './lowlegs.mjs';
import { buildLowTorso } from './lowtorso.mjs';
import { loadLegCams, saveLegCams, projectL, PIVOT, DEFAULTS } from './lowlcam.mjs';
import { outline, distanceTo, descend } from './lowsil.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i < 0 ? d : args[i + 1]; };
const who = opt('who', 'male');
const stage = opt('stage', 'report');
const REF = JSON.parse(readFileSync(opt('ref'), 'utf8'));
const DIR = new URL('.', import.meta.url).pathname;
const PIV = PIVOT[who];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// the user's order: the front, profile and three-quarter most (and the full-body front, which holds the proportions
// against the sheet's free vertical scale, more),
// the back and the rear three-quarter next, the topology panel's small views least
export const WEIGHT = { front: 1, q3: 1, profile: 1, body: 2.5, r3: 0.6, back: 0.6, tfront: 0.15, tq3: 0.15, tprofile: 0.15, tr3: 0.15, tback: 0.15 };
const VIEWS = Object.keys(WEIGHT).filter((v) => REF.views[v]);
const MARKS_FILE = join(DIR, 'lowlmarks.json');
const MARKS = existsSync(MARKS_FILE) ? (JSON.parse(readFileSync(MARKS_FILE, 'utf8'))[who] ?? {}) : {};
const LW = +opt('lw', '0.5');

const inPoly = (x, y, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
/** Rows above the top take the top row's pixels (no edge along the cut); the outline kept only below it and outside the
 * skipped polygons. */
function prep(m, r) {
  for (let j = 0; j < r.jt; j++) for (let i = 0; i < r.w; i++) m[j * r.w + i] = m[r.jt * r.w + i];
  return outline({ m, w: r.w, h: r.h }).filter((k) => Math.floor(k / r.w) > r.jt && !r.skip[k]);
}
const R = {};
for (const v of VIEWS) {
  const r = { ...REF.views[v] };
  const K = r.K, [x0, y0] = r.box;
  r.m = new Uint8Array(r.w * r.h);
  r.mask.forEach((row, j) => { for (let i = 0; i < r.w; i++) r.m[j * r.w + i] = row[i] === '1' ? 1 : 0; });
  r.jt = Math.max(0, Math.round((r.top - y0) / K));
  r.skip = new Uint8Array(r.w * r.h);
  for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) if (r.cloth.some((p) => inPoly(x0 + (i + 0.5) * K, y0 + (j + 0.5) * K, p))) r.skip[j * r.w + i] = 1;
  let last = 0; for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) if (r.m[j * r.w + i]) last = j;
  r.HT = (last - r.jt) * K; // the leg height in sheet pixels
  r.ol = prep(r.m, r);
  r.dt = distanceTo(r.ol, r.w, r.h);
  R[v] = r;
}

const { sy: SY0, cams } = loadLegCams(who);
let SY = SY0;
function raster(tris, cam, r) {
  const [x0, y0] = r.box, K = r.K, w = r.w, h = r.h, m = new Uint8Array(w * h);
  for (const tri of tris) {
    const p = tri.map((q) => { const s = projectL(q, cam, SY, PIV); return [(s[0] - x0) / K - 0.5, (s[1] - y0) / K - 0.5]; });
    const area = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[1][1] - p[0][1]) * (p[2][0] - p[0][0]);
    if (Math.abs(area) < 1e-9) continue;
    const minx = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0]))), maxx = Math.min(w - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])));
    const miny = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1]))), maxy = Math.min(h - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
    for (let j = miny; j <= maxy; j++) for (let i = minx; i <= maxx; i++) {
      let inside = true;
      for (let e = 0; e < 3 && inside; e++) { const a = p[e], b = p[(e + 1) % 3]; if (((b[0] - a[0]) * (j - a[1]) - (b[1] - a[1]) * (i - a[0])) * area < -1e-9) inside = false; }
      if (inside) m[j * w + i] = 1;
    }
  }
  return m;
}
function markAt(mesh, names, cam) {
  const list = Array.isArray(names) ? names : [names];
  const pts = list.map((n) => { const side = n.endsWith("'") ? -1 : 1, k = n.replace("'", ''); return mesh.verts[mesh.ids[side][k]]; });
  const c = [0, 1, 2].map((k) => pts.reduce((a, p) => a + p[k], 0) / pts.length);
  return projectL(c, cam, SY, PIV);
}
// the torso above the legs, for the silhouette: only its rows that reach below the belt's top matter, so its lower half
const torsoTris = (() => { const t = buildLowTorso(who); return t.tris.filter((x) => x.part === 'torso').map((x) => x.v.map((i) => t.verts[i])).filter((tr) => tr.some((p) => p[1] < -2.6)); })();
const viewTris = (legs) => [...torsoTris, ...legs.tris.map((t) => t.v.map((i) => legs.verts[i]))];

export function viewError(legs, view, cam, tris = viewTris(legs)) {
  const r = R[view];
  const m = raster(tris, cam, r);
  const ol = prep(m, r);
  let inter = 0, uni = 0;
  for (let k = r.jt * r.w; k < m.length; k++) { if (r.skip[k]) continue; if (m[k] && r.m[k]) inter++; if (m[k] || r.m[k]) uni++; }
  if (!ol.length) return { mean: 1e3, worst: 1e3, marks: [], iou: 0, score: 1e6 };
  const dt = distanceTo(ol, r.w, r.h);
  let a = 0, wa = 0, b = 0, wb = 0;
  for (const k of ol) { a += r.dt[k]; wa = Math.max(wa, r.dt[k]); }
  for (const k of r.ol) { b += dt[k]; wb = Math.max(wb, dt[k]); }
  const pc = (px) => (100 * px) / r.HT;
  const mean = pc(((a / ol.length + b / r.ol.length) / 2) * r.K), worst = pc(Math.max(wa, wb) * r.K);
  const marks = Object.entries(MARKS[view] ?? {}).map(([name, [x, y, v]]) => { const p = markAt(legs, v, cam); return { name, d: pc(Math.hypot(p[0] - x, p[1] - y)) }; });
  const mmean = marks.length ? marks.reduce((t, q) => t + q.d, 0) / marks.length : 0;
  return { mean, worst, marks, iou: inter / uni, score: WEIGHT[view] * (mean + 0.15 * worst + LW * mmean) };
}

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
function folds(m, base) {
  let n = 0;
  for (let i = 0; i < m.tris.length; i++) {
    const t = m.tris[i].v.map((v) => m.verts[v]), u = base.tris[i].v.map((v) => base.verts[v]);
    const nt = cross3(sub3(t[1], t[0]), sub3(t[2], t[0])), nu = cross3(sub3(u[1], u[0]), sub3(u[2], u[0]));
    if (nt[0] * nu[0] + nt[1] * nu[1] + nt[2] * nu[2] < 0) n++;
  }
  return n;
}
// the views' angles held near what they look like: yaw within 30 degrees of the default (the front and the back 6),
// pitch within 8
function limit(v, k, x) {
  const d = DEFAULTS[who].views[v];
  if (k === 'yaw') { const r = /front|back|body/.test(v) ? 6 : 30; return Math.min(d.yaw + r, Math.max(d.yaw - r, x)); }
  if (k === 'pitch') return Math.min(8, Math.max(-8, x));
  return x;
}

const preset = structuredClone(PRESETS[who]);
const base0 = buildLowLegs(who, PRESETS[who]);
let mesh = buildLowLegs(who, preset);
const r4 = (x) => (typeof x === 'number' ? +x.toFixed(4) : Array.isArray(x) ? x.map(r4) : Object.fromEntries(Object.entries(x).map(([k, v]) => [k, r4(v)])));
const save = () => writeFileSync(join(DIR, `lowlfit-${who}.json`), JSON.stringify({ R: r4(preset.R), D: r4(preset.D ?? {}), V: r4(preset.V ?? {}) }, null, 1));

function report(tag) {
  const rows = [];
  let tot = 0;
  for (const v of VIEWS) {
    const e = viewError(mesh, v, cams[v]);
    tot += e.score;
    const wm = e.marks.length ? e.marks.reduce((a, b) => (b.d > a.d ? b : a)) : null;
    rows.push(`${v.padEnd(8)} outline mean ${e.mean.toFixed(1)}% worst ${e.worst.toFixed(1)}%  IoU ${e.iou.toFixed(3)}  ${wm ? `worst landmark ${wm.name} ${wm.d.toFixed(1)}%  (mean ${(e.marks.reduce((a, m) => a + m.d, 0) / e.marks.length).toFixed(1)}%, ${e.marks.length})` : ''}`);
  }
  console.log(`${who} ${tag} (score ${tot.toFixed(2)}, warp ${(1000 * warp(mesh)).toFixed(1)}e-3, folds ${folds(mesh, base0)}, triangles ${mesh.tris.length}, sheet sy ${SY.toFixed(3)})\n` + rows.join('\n'));
}
const only = opt('views', '') ? opt('views').split(',') : VIEWS;
const score = () => { const t = viewTris(mesh); return only.reduce((s, v) => s + viewError(mesh, v, cams[v], t).score, 0); };
const camParams = (views, step = 2) => views.flatMap((v) => ['cx', 'cy', 's', 'yaw', 'pitch'].map((k) => ({ step: k === 's' ? step / 2 : k === 'yaw' || k === 'pitch' ? step * 1.5 : step, get: () => cams[v][k], set: (x) => { cams[v][k] = limit(v, k, x); } })));
const syParam = { step: 0.02, get: () => SY, set: (x) => { SY = Math.max(0.4, Math.min(1.2, x)); } };

if (stage === 'camera') {
  report('before');
  for (let round = 0; round < +opt('rounds', 2); round++) {
    for (const v of only) {
      const c = cams[v];
      const ps = [{ k: 'cx', step: 6 }, { k: 'cy', step: 6 }, { k: 's', step: 3 }, { k: 'yaw', step: 6 }, { k: 'pitch', step: 4 }];
      descend(ps.map((p) => ({ step: p.step, get: () => c[p.k], set: (x) => { c[p.k] = limit(v, p.k, x); } })), () => viewError(mesh, v, c).score, 6);
    }
    // the sheet's one vertical scale, over all its views at once
    const sheetViews = only.filter((v) => v !== 'body');
    if (sheetViews.length && !args.includes('--keep-sy')) descend([syParam, ...camParams(sheetViews, 1).filter((_, i) => i % 5 === 1)], () => sheetViews.reduce((s, v) => s + viewError(mesh, v, cams[v]).score, 0), 4);
  }
  saveLegCams(who, SY, cams);
  report('after');
}

// The rings as wholes: each row's numbers (tools/sculpt/lowlegs.mjs R: its height, its inside and outside, its back and
// front; the hip row's height, half-width, front and back; the ankle's; the foot's), so the rows stay the rows the
// topology panel draws and only their proportions move.
if (stage === 'rings') {
  report('before');
  const sel = opt('names', '').split(',').filter(Boolean);
  const ps = [];
  for (const [k, val] of Object.entries(preset.R)) {
    if (sel.length && !sel.includes(k)) continue;
    if (k === 'gD') continue;
    // P.fixed: the numbers set by hand where the references show no outline to fit to (under the loincloth, the foot's
    // block heights off the topology panel)
    const fixed = new Set(preset.fixed ?? []);
    if (k === 'foot') { for (const q of Object.keys(val)) if (!fixed.has(`foot.${q}`)) ps.push({ step: q === 'turn' ? 3 : 0.04, get: () => preset.R.foot[q], set: (x) => { preset.R.foot[q] = x; } }); continue; }
    val.forEach((_, i) => { if ((k === 'cx' && i === 0) || fixed.has(`${k}.${i}`)) return; ps.push({ step: 0.04, get: () => preset.R[k][i], set: (x) => { preset.R[k][i] = x; } }); });
  }
  // each ring's points' own drops (the thigh's top ring down the buttock's fold at the back, the kneecap's top and bottom)
  for (const [k, arr] of Object.entries(preset.D ?? {})) if (!sel.length || sel.includes('D')) arr.forEach((_, i) => ps.push({ step: 0.04, get: () => preset.D[k][i], set: (x) => { preset.D[k][i] = x; } }));
  // the rows kept in their order, at least 0.25 apart (a row may not slide into the next and fold the surface)
  const order = ['gl', 'th', 'tm', 'ka', 'kb', 'kc', 'ca', 'cb', 'an'];
  const spacing = () => { let t = 0; for (let i = 0; i + 1 < order.length; i++) t += Math.max(0, 0.25 - (preset.R[order[i]][0] - preset.R[order[i + 1]][0])) ** 2; return 1000 * t; };
  const total = () => { mesh = buildLowLegs(who, preset); return score() + 2 * folds(mesh, base0) + +opt('flat', '20') * warp(mesh) + spacing(); };
  for (let r = 0; r < +opt('rounds', 2); r++) console.log('sweep', r, descend(ps, total, 1).toFixed(2));
  mesh = buildLowLegs(who, preset); save();
  report('after');
}

// Single vertices by hand-chosen name (--names a,b*), placed over what the rings make, flatness held (--flat).
if (stage === 'mesh') {
  report('before');
  const sel = opt('names', '').split(',').filter(Boolean);
  if (!sel.length) throw new Error('--names: which vertices');
  const names = Object.keys(mesh.V).filter((n) => !WAIST.includes(n) && mesh.ids[1][n] !== undefined && sel.some((o) => n === o || (o.endsWith('*') && n.startsWith(o.slice(0, -1)))));
  preset.V = preset.V ?? {};
  for (const n of names) preset.V[n] = preset.V[n] ?? [...mesh.V[n]];
  const ps = [];
  for (const n of names) for (let k = 0; k < 3; k++) {
    if (k === 0 && preset.V[n][0] === 0) continue;
    if (n.startsWith('so') && k === 1) continue;
    ps.push({ step: +opt('step', '0.03'), get: () => preset.V[n][k], set: (x) => { preset.V[n][k] = x; } });
  }
  const flatW = +opt('flat', '100');
  const total = () => { mesh = buildLowLegs(who, preset); return score() + 2 * folds(mesh, base0) + flatW * warp(mesh); };
  for (let r = 0; r < +opt('rounds', 2); r++) console.log('sweep', r, descend(ps, total, 1).toFixed(2));
  mesh = buildLowLegs(who, preset); save();
  report('after');
}

if (stage === 'report') report('now');
if (opt('marks', '')) {
  const out = {};
  for (const v of VIEWS) out[v] = Object.entries(MARKS[v] ?? {}).map(([name, [x, y, n]]) => ({ name, ref: [x, y], ours: markAt(mesh, n, cams[v]).slice(0, 2) }));
  writeFileSync(opt('marks'), JSON.stringify(out));
}
export { buildLowLower };
