// Fits the low-poly head (tools/sculpt/lowhead.mjs) to its reference sheet as a direct mirror: each view's camera, then
// the head's vertices, so its outline and its eyes and brows land where the reference's do in all seven views.
//
//   python3 tools/sculpt/lowmask.py tools/sculpt/ref/head-lowpoly.png /tmp/ref-male.json      # the reference, once
//   node tools/sculpt/lowfit.mjs --who male --ref /tmp/ref-male.json --stage camera|mesh|report [--rounds 3]
//
// Cameras are kept in tools/sculpt/lowcams.json ({ who: { view: { yaw, pitch, s, cx, cy, f } } }: degrees, pixels per
// head unit, the pivot [0, 1, 0.1] at sheet pixel (cx, cy), f the camera's distance in head units for a perspective
// view or 0 for orthographic); the fitted vertices are written back into the preset as tools/sculpt/lowfit-<who>.json,
// which lowhead.mjs reads over its own. The report prints, per view, the outline's distance from the reference's (mean
// and worst, as % of the head's height in the front view) and the eyes' and brows' distance, and the IoU.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildLowHead, PRESETS } from './lowhead.mjs';
import { CAMS_FILE as CAMS, DEFAULT_CAMS, PARTS, VIEWS, loadCams as camsOf, project } from './lowcam.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i < 0 ? d : args[i + 1]; };
const who = opt('who', 'male');
const stage = opt('stage', 'report');
const REF = JSON.parse(readFileSync(opt('ref'), 'utf8'));
const DIR = new URL('.', import.meta.url).pathname;
const K = REF.scale;
const HEAD_H = 2 * 136; // the front view's head height in sheet pixels, for the percentages

// How much the eyes and brows count against the outline: little while the cameras are fitted (the head's own errors
// would turn them), more once the vertices move.
const FW = { w: 0.6 };
/** The triangles a view sees: the parts it shows, cut at its clip plane with the cut's cap. */
function viewTris(mesh, view, cam) {
  const parts = PARTS[view] ?? ['head', 'neck', 'shoulders'];
  const out = [];
  const cut = [];
  for (const t of mesh.tris) {
    if (!parts.includes(t.part)) continue;
    const pts = t.v.map((i) => mesh.verts[i]);
    if (cam.clip == null) { out.push(pts); continue; }
    // keep the part above y = clip
    const poly = [];
    for (let i = 0; i < 3; i++) {
      const a = pts[i], b = pts[(i + 1) % 3];
      const ia = a[1] >= cam.clip, ib = b[1] >= cam.clip;
      if (ia) poly.push(a);
      if (ia !== ib) { const t2 = (cam.clip - a[1]) / (b[1] - a[1]); const q = [a[0] + (b[0] - a[0]) * t2, cam.clip, a[2] + (b[2] - a[2]) * t2]; poly.push(q); cut.push(q); }
    }
    for (let i = 1; i + 1 < poly.length; i++) out.push([poly[0], poly[i], poly[i + 1]]);
  }
  if (cut.length > 2) {
    const cx = cut.reduce((s, p) => s + p[0], 0) / cut.length, cz = cut.reduce((s, p) => s + p[2], 0) / cut.length;
    const ring = [...cut].sort((p, q) => Math.atan2(p[2] - cz, p[0] - cx) - Math.atan2(q[2] - cz, q[0] - cx));
    for (let i = 0; i < ring.length; i++) out.push([[cx, cam.clip, cz], ring[i], ring[(i + 1) % ring.length]]);
  }
  return out;
}

/** The view's silhouette at the reference's resolution, in its box. */
export function silhouette(mesh, view, cam, box) {
  const [x0, y0, x1, y1] = box;
  const w = Math.floor((x1 - x0) / K), h = Math.floor((y1 - y0) / K);
  const m = new Uint8Array(w * h);
  for (const tri of viewTris(mesh, view, cam)) {
    const p = tri.map((q) => { const s = project(q, cam); return [(s[0] - x0) / K - 0.5, (s[1] - y0) / K - 0.5]; });
    const area = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[1][1] - p[0][1]) * (p[2][0] - p[0][0]);
    if (Math.abs(area) < 1e-9) continue;
    const minx = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0]))), maxx = Math.min(w - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])));
    const miny = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1]))), maxy = Math.min(h - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
    for (let j = miny; j <= maxy; j++) for (let i = minx; i <= maxx; i++) {
      let inside = true;
      for (let e = 0; e < 3 && inside; e++) {
        const a = p[e], b = p[(e + 1) % 3];
        const c = (b[0] - a[0]) * (j - a[1]) - (b[1] - a[1]) * (i - a[0]);
        if (c * area < -1e-9) inside = false;
      }
      if (inside) m[j * w + i] = 1;
    }
  }
  return { m, w, h };
}

/** The outline's pixels (inside, with a neighbour outside, not counting the box's edge). */
function outline({ m, w, h }) {
  const o = [];
  for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
    if (!m[j * w + i]) continue;
    if (!m[j * w + i - 1] || !m[j * w + i + 1] || !m[(j - 1) * w + i] || !m[(j + 1) * w + i]) o.push(j * w + i);
  }
  return o;
}
/** Distance to the nearest outline pixel, in pixels at the mask's resolution (a two-pass 3-4 chamfer). */
function distanceTo(ol, w, h) {
  const d = new Float32Array(w * h).fill(1e6);
  for (const k of ol) d[k] = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i; let v = d[k];
    if (i > 0) v = Math.min(v, d[k - 1] + 1);
    if (j > 0) { v = Math.min(v, d[k - w] + 1); if (i > 0) v = Math.min(v, d[k - w - 1] + 1.414); if (i < w - 1) v = Math.min(v, d[k - w + 1] + 1.414); }
    d[k] = v;
  }
  for (let j = h - 1; j >= 0; j--) for (let i = w - 1; i >= 0; i--) {
    const k = j * w + i; let v = d[k];
    if (i < w - 1) v = Math.min(v, d[k + 1] + 1);
    if (j < h - 1) { v = Math.min(v, d[k + w] + 1); if (i < w - 1) v = Math.min(v, d[k + w + 1] + 1.414); if (i > 0) v = Math.min(v, d[k + w - 1] + 1.414); }
    d[k] = v;
  }
  return d;
}

// The reference's masks, outlines and distance fields, once.
const R = {};
for (const v of VIEWS) {
  const r = REF.views[v];
  const m = new Uint8Array(r.w * r.h);
  r.mask.forEach((row, j) => { for (let i = 0; i < r.w; i++) m[j * r.w + i] = row[i] === '1' ? 1 : 0; });
  const ol = outline({ m, w: r.w, h: r.h });
  R[v] = { ...r, m, ol, dt: distanceTo(ol, r.w, r.h) };
}

/** The features' centroids (each eye, each brow) on the sheet under a camera; the nearer first. */
function features(mesh, cam, mat) {
  const side = { 1: [], [-1]: [] };
  for (const t of mesh.tris) if (t.mat === mat) for (const i of t.v) side[mesh.verts[i][0] >= 0 ? 1 : -1].push(mesh.verts[i]);
  return [1, -1].map((s) => {
    const pts = side[s]; const c = [0, 1, 2].map((k) => pts.reduce((a, p) => a + p[k], 0) / pts.length);
    return project(c, cam);
  }).sort((a, b) => b[2] - a[2]);
}

/** One view's error: the outlines' mean symmetric distance and worst, the features' distance, the IoU. */
export function viewError(mesh, view, cam) {
  const r = R[view];
  const s = silhouette(mesh, view, cam, r.box);
  const ol = outline(s);
  let inter = 0, uni = 0;
  for (let k = 0; k < s.m.length; k++) { if (s.m[k] && r.m[k]) inter++; if (s.m[k] || r.m[k]) uni++; }
  if (!ol.length) return { mean: 1e3, worst: 1e3, feat: [], iou: 0, score: 1e6 };
  const dt = distanceTo(ol, s.w, s.h);
  let a = 0, wa = 0, b = 0, wb = 0;
  for (const k of ol) { a += r.dt[k]; wa = Math.max(wa, r.dt[k]); }
  for (const k of r.ol) { b += dt[k]; wb = Math.max(wb, dt[k]); }
  const mean = ((a / ol.length + b / r.ol.length) / 2) * K, worst = Math.max(wa, wb) * K;
  const feat = [];
  for (const [mat, list] of [['pupil', r.pupils], ['brow', r.brows]]) {
    if (!list.length) continue;
    const ours = features(mesh, cam, mat);
    for (const f of list) {
      const d = Math.min(...ours.map((o) => Math.hypot(o[0] - f[0], o[1] - f[1])));
      feat.push({ mat, d });
    }
  }
  const fmean = feat.length ? feat.reduce((x, f) => x + f.d, 0) / feat.length : 0;
  return { mean, worst, feat, iou: inter / uni, score: mean + 0.15 * worst + FW.w * fmean };
}

const loadCams = () => camsOf(who);
function saveCams(c) {
  const all = existsSync(CAMS) ? JSON.parse(readFileSync(CAMS, 'utf8')) : {};
  all[who] = c;
  writeFileSync(CAMS, JSON.stringify(all, null, 1));
}

/** Coordinate descent: each parameter up and down by its step while that lowers f; the steps halve when none do. */
function descend(params, f, rounds = 6) {
  let best = f();
  for (let r = 0; r < rounds; r++) {
    let moved = false;
    for (const p of params) {
      for (const dir of [1, -1]) {
        for (;;) {
          const old = p.get(); p.set(old + dir * p.step);
          const e = f();
          if (e < best - 1e-6) { best = e; moved = true; } else { p.set(old); break; }
        }
      }
    }
    if (!moved) for (const p of params) p.step /= 2;
  }
  return best;
}

// The views' angles stay near what their labels say: yaw within 10 degrees, pitch within 12 (the top and bottom views'
// pitch within 25 of their defaults); a camera that wanders further is fitting the head's errors, not the view.
function limit(v, k, x) {
  const d = DEFAULT_CAMS[v];
  if (k === 'f') return Math.max(2.5, x);
  if (k === 'yaw') return Math.min(d.yaw + 10, Math.max(d.yaw - 10, x));
  if (k === 'pitch') { const r = v === 'top' || v === 'bottom' ? 25 : 12; return Math.min(d.pitch + r, Math.max(d.pitch - r, x)); }
  return x;
}
const preset = structuredClone(PRESETS[who]);
let mesh = buildLowHead(who, preset);
const cams = loadCams();

function report(tag) {
  const rows = [];
  for (const v of VIEWS) {
    const e = viewError(mesh, v, cams[v]);
    const f = e.feat.length ? e.feat.map((x) => `${x.mat[0]}${((100 * x.d) / HEAD_H).toFixed(1)}`).join(' ') : '';
    rows.push(`${v.padEnd(8)} outline mean ${((100 * e.mean) / HEAD_H).toFixed(1)}% worst ${((100 * e.worst) / HEAD_H).toFixed(1)}%  IoU ${e.iou.toFixed(3)}  ${f ? 'features ' + f + ' (%)' : ''}`);
  }
  console.log(`${who} ${tag}\n` + rows.join('\n'));
}

if (stage === 'camera') {
  FW.w = 0.1;
  report('before');
  const persp = args.includes('--perspective');
  for (const v of VIEWS) {
    const c = cams[v];
    if (persp && !c.f) c.f = 12;
    const ps = [
      { k: 'cx', step: 8 }, { k: 'cy', step: 8 }, { k: 's', step: 6 }, { k: 'yaw', step: 6 }, { k: 'pitch', step: 6 },
      ...(c.clip != null ? [{ k: 'clip', step: 0.08 }] : []), ...(persp ? [{ k: 'f', step: 3 }] : []),
    ].filter((p) => !(v === 'front' && p.k === 's'));
    descend(ps.map((p) => ({ step: p.step, get: () => c[p.k], set: (x) => { c[p.k] = limit(v, p.k, x); } })), () => viewError(mesh, v, c).score, +opt('rounds', 8));
  }
  saveCams(cams);
  report('after');
}

if (stage === 'mesh') {
  report('before');
  const names = Object.keys(preset.V);
  const ps = [];
  for (const n of names) for (let k = 0; k < 3; k++) {
    if (k === 0 && preset.V[n][0] === 0) continue; // the centre line stays on it
    ps.push({ step: 0.04, get: () => preset.V[n][k], set: (x) => { preset.V[n][k] = x; } });
  }
  for (const k of [0, 1, 2]) ps.push({ step: 0.03, get: () => preset.ear.c[k], set: (x) => { preset.ear.c[k] = x; } });
  ps.push({ step: 0.05, get: () => preset.ear.s, set: (x) => { preset.ear.s = x; } });
  for (const k of ['x', 'y']) ps.push({ step: 0.02, get: () => preset.eye[k], set: (x) => { preset.eye[k] = x; } });
  // the brows move as a whole, up and down and out and in
  const shift = (key, d) => { preset.brow[key] = preset.brow[key].map((v) => v + d); };
  for (const key of ['x', 'yb']) { let at = 0; ps.push({ step: 0.02, get: () => at, set: (x) => { shift(key, x - at); at = x; } }); }
  const total = () => { mesh = buildLowHead(who, preset); return VIEWS.reduce((s, v) => s + viewError(mesh, v, cams[v]).score, 0); };
  const both = args.includes('--with-camera');
  const camPs = both ? VIEWS.flatMap((v) => ['cx', 'cy', ...(v === 'front' ? [] : ['s']), 'yaw', 'pitch'].map((k) => ({ step: k === 's' ? 2 : 2, get: () => cams[v][k], set: (x) => { cams[v][k] = limit(v, k, x); } }))) : [];
  for (let r = 0; r < +opt('rounds', 3); r++) {
    const e = descend([...ps, ...camPs], total, 1);
    console.log('sweep', r, e.toFixed(1));
  }
  mesh = buildLowHead(who, preset);
  writeFileSync(join(DIR, `lowfit-${who}.json`), JSON.stringify({ V: preset.V, ear: preset.ear, eye: preset.eye, brow: preset.brow }, null, 1));
  if (both) saveCams(cams);
  report('after');
}

// The head moved as a whole, not vertex by vertex: a lattice over it (three columns across, mirrored; GY rows up; GZ
// rows front to back) whose points move, and every vertex moves by the trilinear blend of its cell's corners. The
// head's own planes, nose, eyes and brows ride along unbroken; only its proportions change.
const GX = [-1, 0, 1], GY = [-1.2, -0.6, 0, 0.4, 0.8, 1.2, 1.6, 2.15], GZ = [-1, -0.35, 0.35, 1.2];
function lattice() { return GY.map(() => GZ.map(() => ({ c: [0, 0], s: [0, 0, 0] }))); }
function deform(p, L) {
  const at = (g, v) => { let i = 0; while (i < g.length - 2 && v > g[i + 1]) i++; return [i, Math.min(1, Math.max(0, (v - g[i]) / (g[i + 1] - g[i])))]; };
  const ax = Math.min(1, Math.abs(p[0])), sx = Math.sign(p[0]) || 1;
  const [j, ty] = at(GY, p[1]), [k, tz] = at(GZ, p[2]);
  const d = [0, 0, 0];
  for (const [jj, wy] of [[j, 1 - ty], [j + 1, ty]]) for (const [kk, wz] of [[k, 1 - tz], [k + 1, tz]]) {
    const n = L[jj][kk], w = wy * wz;
    // the centre column moves only up and down and back and forth; the sides are each other's mirror
    const side = [n.s[0] * sx, n.s[1], n.s[2]], mid = [0, n.c[0], n.c[1]];
    for (let q = 0; q < 3; q++) d[q] += w * (mid[q] * (1 - ax) + side[q] * ax);
  }
  return [p[0] + d[0], p[1] + d[1], p[2] + d[2]];
}
function deformed(L) {
  const P = structuredClone(PRESETS[who]);
  for (const n of Object.keys(P.V)) { const q = deform(P.V[n], L); P.V[n] = P.V[n][0] === 0 ? [0, q[1], q[2]] : q; }
  P.ear.c = deform(P.ear.c, L);
  return P;
}
/** How many of the head's triangles turned over against the hand-built head's. */
function folds(m, base) {
  let n = 0;
  for (let i = 0; i < m.tris.length; i++) {
    const t = m.tris[i].v.map((v) => m.verts[v]), u = base.tris[i].v.map((v) => base.verts[v]);
    const nt = cross3(sub3(t[1], t[0]), sub3(t[2], t[0])), nu = cross3(sub3(u[1], u[0]), sub3(u[2], u[0]));
    if (nt[0] * nu[0] + nt[1] * nu[1] + nt[2] * nu[2] < 0) n++;
  }
  return n;
}
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

if (stage === 'ffd') {
  report('before');
  const base = buildLowHead(who, PRESETS[who]);
  const L = lattice();
  const ps = [];
  for (const row of L) for (const n of row) {
    for (let q = 0; q < 2; q++) ps.push({ step: 0.05, get: () => n.c[q], set: (x) => { n.c[q] = x; } });
    for (let q = 0; q < 3; q++) ps.push({ step: 0.05, get: () => n.s[q], set: (x) => { n.s[q] = x; } });
  }
  const camPs = VIEWS.flatMap((v) => ['cx', 'cy', ...(v === 'front' ? [] : ['s']), 'yaw', 'pitch'].map((k) => ({ step: 1.5, get: () => cams[v][k], set: (x) => { cams[v][k] = limit(v, k, x); } })));
  let P = deformed(L);
  const total = () => {
    P = deformed(L); mesh = buildLowHead(who, P);
    return VIEWS.reduce((s, v) => s + viewError(mesh, v, cams[v]).score, 0) + 20 * folds(mesh, base);
  };
  for (let r = 0; r < +opt('rounds', 3); r++) console.log('sweep', r, descend([...ps, ...camPs], total, 1).toFixed(1));
  P = deformed(L); mesh = buildLowHead(who, P);
  console.log('folds', folds(mesh, base));
  writeFileSync(join(DIR, `lowfit-${who}.json`), JSON.stringify({ V: P.V, ear: P.ear }, null, 1));
  saveCams(cams);
  report('after');
}

if (stage === 'report') report('now');
