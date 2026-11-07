// Fits the low-poly arms (tools/sculpt/lowarm.mjs) to their reference sheets as a direct mirror, as tools/sculpt/lowtfit.mjs
// fits the torsos: each view's camera, then a coarse lattice (each ring of the arm moved and widened as one, the hand
// placed as a block), then the vertices one by one with the polygons held flat; so the outline and the landmarks land
// where the references' do in the arm's five views, the hand's five, and the full body's front view (how the arm sits
// on the body, tools/sculpt/ref/body-<who>.png). The torso's ring (the arm's shoulder end) never moves.
//
//   python3 tools/sculpt/lowamask.py male /tmp/aref-male.json                                     # once
//   node tools/sculpt/lowafit.mjs --who male --ref /tmp/aref-male.json --stage init|camera|lattice|hand|mesh|report
//
// Cameras: tools/sculpt/lowacams.json, { who: { view: { yaw, pitch, roll (degrees), s, cx, cy, piv } } } (the body
// view's camera is the body reference's own scale, fixed: its shoulders' widest on the torso's). The fitted vertices:
// tools/sculpt/lowafit-<who>.json, which lowarm.mjs reads. Landmarks: tools/sculpt/lowamarks.json, { who: { view: {
// name: [x, y, vertex] } } }, the reference's point on the sheet and the vertex (or the mean of a list) that belongs
// there. The report prints per view the outline's distance from the reference's (mean and worst) and the worst
// landmark, as % of the arm's length in the reference's front view (the hand's views: % of the hand's length in its
// back view), and the IoU.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildLowArm, buildHandAlone, armFaces, torsoRing, TOPO, WRIST } from './lowarm.mjs';
import { buildLowBody } from './lowtorso.mjs';
import { rotation } from './lowcam.mjs';
import { outline, distanceTo, descend } from './lowsil.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i < 0 ? d : args[i + 1]; };
const who = opt('who', 'male');
const stage = opt('stage', 'report');
const DIR = new URL('.', import.meta.url).pathname;
const REF = JSON.parse(readFileSync(opt('ref'), 'utf8'));
const K = REF.scale;
export const ARM_VIEWS = ['front', 'q3', 'profile', 'r3', 'back'];
export const HAND_VIEWS = ['hback', 'hq3', 'hprofile', 'hr3', 'hpalm'];
const VIEWS = [...ARM_VIEWS, ...HAND_VIEWS, 'body'];
export const WEIGHT = { front: 1, q3: 1, profile: 1, r3: 0.7, back: 0.7, hback: 0.5, hq3: 0.5, hprofile: 0.5, hr3: 0.4, hpalm: 0.4, body: +opt('bodyw', '3') };
// The body reference's own camera: its pixels per head unit and where the chin's underside's middle falls, the scale
// set by the shoulders' widest (the torso's sd4), measured.
export const BODY_CAM = { male: { yaw: 0, pitch: 0, roll: 0, s: 128, cx: 433, cy: 322, piv: [0, 0, 0] }, female: { yaw: 0, pitch: 0, roll: 0, s: 124, cx: 437, cy: 328, piv: [0, 0, 0] } };
const CAMS_FILE = join(DIR, 'lowacams.json');
const MARKS_FILE = join(DIR, 'lowamarks.json');
const MARKS = existsSync(MARKS_FILE) ? (JSON.parse(readFileSync(MARKS_FILE, 'utf8'))[who] ?? {}) : {};
const LW = +opt('lw', '0.5');
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };

/** A point's sheet position and its depth toward the viewer: yaw and pitch as the heads' cameras, then the roll in the
 * picture's plane. */
export function aproject(p, c) {
  const r = rotation(c), pv = c.piv;
  const x = p[0] - pv[0], y = p[1] - pv[1], z = p[2] - pv[2];
  let qx = r[0] * x + r[1] * y + r[2] * z, qy = r[3] * x + r[4] * y + r[5] * z;
  const qz = r[6] * x + r[7] * y + r[8] * z;
  const a = ((c.roll ?? 0) * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  [qx, qy] = [ca * qx - sa * qy, sa * qx + ca * qy];
  return [c.cx + c.s * qx, c.cy - c.s * qy, qz];
}
export function loadACams(w = who) {
  const all = existsSync(CAMS_FILE) ? JSON.parse(readFileSync(CAMS_FILE, 'utf8')) : {};
  return { ...(all[w] ?? {}), body: { ...BODY_CAM[w] } };
}
function saveCams(c) {
  const all = existsSync(CAMS_FILE) ? JSON.parse(readFileSync(CAMS_FILE, 'utf8')) : {};
  const { body, ...rest } = c;
  all[who] = rest;
  writeFileSync(CAMS_FILE, JSON.stringify(all, null, 1));
}

function raster(triangles, cam, box) {
  const [x0, y0, x1, y1] = box;
  const w = Math.floor((x1 - x0) / K), h = Math.floor((y1 - y0) / K);
  const m = new Uint8Array(w * h);
  for (const tri of triangles) {
    const p = tri.map((q) => { const s = aproject(q, cam); return [(s[0] - x0) / K - 0.5, (s[1] - y0) / K - 0.5]; });
    const area = (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[1][1] - p[0][1]) * (p[2][0] - p[0][0]);
    if (Math.abs(area) < 1e-9) continue;
    const minx = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0]))), maxx = Math.min(w - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])));
    const miny = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1]))), maxy = Math.min(h - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])));
    for (let j = miny; j <= maxy; j++) for (let i = minx; i <= maxx; i++) {
      let inside = true;
      for (let e = 0; e < 3 && inside; e++) {
        const a = p[e], b = p[(e + 1) % 3];
        if (((b[0] - a[0]) * (j - a[1]) - (b[1] - a[1]) * (i - a[0])) * area < -1e-9) inside = false;
      }
      if (inside) m[j * w + i] = 1;
    }
  }
  return { m, w, h };
}

// The references' masks, outlines and distance fields; the arm's length (its front view's height) and the hand's (its
// back view's, from the stub's base: the stub is the sheet's cut, not the hand)
// Each view's box padded by PAD mask pixels all round (the reference empty there), so a silhouette that spills out of
// the reference's box counts against the fit instead of being clipped away.
const PAD = 110;
const R = {};
for (const v of VIEWS) {
  const r0 = REF.views[v], w = r0.w + 2 * PAD, h = r0.h + 2 * PAD;
  const m = new Uint8Array(w * h);
  r0.mask.forEach((row, j) => { for (let i = 0; i < r0.w; i++) m[(j + PAD) * w + i + PAD] = row[i] === '1' && (!r0.cut || i < r0.cut[j]) ? 1 : 0; });
  const cut = r0.cut ? Array.from({ length: h }, (_, j) => PAD + r0.cut[Math.max(0, Math.min(r0.h - 1, j - PAD))]) : null;
  const box = [r0.box[0] - PAD * K, r0.box[1] - PAD * K, r0.box[2] + PAD * K, r0.box[3] + PAD * K];
  const ol = outline({ m, w, h }).filter((k) => !cut || (k % w) < cut[Math.floor(k / w)] - 1);
  R[v] = { box, w, h, cut, m, ol, dt: distanceTo(ol, w, h) };
}
const extent = (v) => { const f = R[v]; let lo = 1e9, hi = -1; for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) if (f.m[j * f.w + i]) { lo = Math.min(lo, j); hi = Math.max(hi, j); } return [f.box[1] + lo * K, f.box[1] + (hi + 1) * K]; };
const AL = (() => { const [a, b] = extent('front'); return b - a; })();
const HL = (() => { const [a, b] = extent('hback'); return (b - a) * 0.8; })();
const BL = (() => { const [a, b] = extent('body'); return b - a; })();
const LEN = (v) => (v === 'body' ? BL : v.startsWith('h') ? HL : AL);

const preset = { V: structuredClone((await import('./lowarm.mjs')).PRESETS[who].V) };
const STATIC_BODY = (() => { const b = buildLowBody(who); return b.tris.filter((t) => !(b.polys[t.poly].name ?? '').startsWith('arm cut')).map((t) => t.v.map((i) => b.verts[i])); })();
let STUB = +opt('stub', '0');
function meshes() {
  const arm = buildLowArm(who, preset), open = buildLowArm(who, preset, { cap: false });
  if (!STUB) { const L = Math.hypot(...sub3(mean(arm.V, ['nb0', 'nb4', 'np0', 'np4']), mean(arm.V, WRIST))); STUB = L * (who === 'male' ? 0.26 : 0.29); }
  const hand = buildHandAlone(who, preset, STUB);
  const T = (m) => m.tris.map((t) => t.v.map((i) => m.verts[i]));
  return { arm, hand, armT: T(arm), handT: T(hand), bodyT: [...STATIC_BODY, ...T(open)] };
}
const mean = (V, names) => [0, 1, 2].map((k) => names.reduce((a, n) => a + V[n][k], 0) / names.length);
const trisFor = (M, v) => (v === 'body' ? M.bodyT : v.startsWith('h') ? M.handT : M.armT);

function markAt(V, names, cam) {
  const list = Array.isArray(names) ? names : [names];
  return aproject(mean(V, list), cam);
}
export function viewError(M, v, cam) {
  const r = R[v];
  const s = raster(trisFor(M, v), cam, r.box);
  if (r.cut) for (let j = 0; j < s.h; j++) for (let i = r.cut[j]; i < s.w; i++) s.m[j * s.w + i] = 0;
  let ol = outline(s);
  if (r.cut) ol = ol.filter((k) => (k % s.w) < r.cut[Math.floor(k / s.w)] - 1);
  let inter = 0, uni = 0;
  for (let k = 0; k < s.m.length; k++) { if (s.m[k] && r.m[k]) inter++; if (s.m[k] || r.m[k]) uni++; }
  if (!ol.length) return { mean: 1e3, worst: 1e3, marks: [], iou: 0, score: 1e6 };
  const dt = distanceTo(ol, s.w, s.h);
  let a = 0, wa = 0, b = 0, wb = 0;
  for (const k of ol) { a += r.dt[k]; wa = Math.max(wa, r.dt[k]); }
  for (const k of r.ol) { b += dt[k]; wb = Math.max(wb, dt[k]); }
  const mean_ = ((a / ol.length + b / r.ol.length) / 2) * K, worst = Math.max(wa, wb) * K;
  const V = v.startsWith('h') ? M.hand.V : M.arm.V;
  const marks = Object.entries(MARKS[v] ?? {}).map(([name, [x, y, n]]) => { const p = markAt(V, n, cam); return { name, d: Math.hypot(p[0] - x, p[1] - y) }; });
  const mm = marks.length ? marks.reduce((t, m) => t + m.d, 0) / marks.length : 0;
  // in % of the view's length, so the hand's views and the body's count as the arm's do
  const L = LEN(v) / 100;
  return { mean: mean_, worst, marks, iou: inter / uni, score: (WEIGHT[v] * (mean_ + 0.15 * worst + LW * mm)) / L };
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
/** How lumpy the arm is along its length: each ring's shape (its vertices less its centre) against the mean of the
 * rings above and below it, squared and summed, and the rings' centres' bends a tenth as much: the arm's rings ua down to
 * fd, the four-finger mass's three rows (knuckles, middle, tips) and the thumb's three rings. */
const FINGER = (p) => [`${p}b0`, `${p}b1`, `${p}b2`, `${p}b3`, `${p}b4`, `${p}p4`, `${p}p3`, `${p}p2`, `${p}p1`, `${p}p0`];
const CHAINS = () => [TOPO[who].rings.map((r) => Array.from({ length: 8 }, (_, i) => `${r}${i}`)), ['k', 'm', 'n'].map(FINGER), [['ta', 'tb', 'tc', 'td'], ['t1a', 't1b', 't1c', 't1d'], ['t2a', 't2b', 't2c', 't2d']]];
function lumps(V) {
  let t = 0;
  for (const ch of CHAINS()) {
    const C = ch.map((r) => mean(V, r));
    for (let k = 1; k + 1 < ch.length; k++) {
      for (let i = 0; i < ch[k].length; i++) {
        const d = (j) => sub3(V[ch[j][i]], C[j]);
        const a = d(k - 1), b = d(k), c = d(k + 1);
        for (let q = 0; q < 3; q++) t += (a[q] - 2 * b[q] + c[q]) ** 2;
      }
      for (let q = 0; q < 3; q++) t += (C[k - 1][q] - 2 * C[k][q] + C[k + 1][q]) ** 2;
    }
  }
  return t;
}
const SMOOTH = +opt('smooth', '30');
/** How far the rings have crossed: down the arm each ring's vertex below the one above it on its line, up the cap each
 * above the one below it (by 0.02 at least), squared and summed. */
function crossed(V) {
  const ring = torsoRing(who), at = (r, i) => (r === 'r' ? ring[`r${i}`] : r === 'ct' ? V.ct : V[`${r}${i}`]);
  let t = 0;
  const down = ['r', ...TOPO[who].rings], up = [TOPO[who].rings[0], ...TOPO[who].cap, 'ct'];
  for (let k = 1; k < down.length; k++) for (let i = 0; i < 8; i++) t += Math.max(0, at(down[k], i)[1] - at(down[k - 1], i)[1] + 0.04) ** 2;
  for (let k = 1; k < up.length; k++) for (let i = 0; i < 8; i++) t += Math.max(0, at(up[k - 1], i)[1] - at(up[k], i)[1] + 0.02) ** 2;
  return t;
}
function folds(m, base) {
  let n = 0;
  for (let i = 0; i < m.tris.length; i++) {
    const t = m.tris[i].v.map((v) => m.verts[v]), u = base.tris[i].v.map((v) => base.verts[v]);
    if (dot3(cross3(sub3(t[1], t[0]), sub3(t[2], t[0])), cross3(sub3(u[1], u[0]), sub3(u[2], u[0]))) < 0) n++;
  }
  return n;
}

/* ---- init: the arm measured off its sheet's front and profile views and placed on the body as the full body has it -- */
// Per sheet: the front view's rows (sheet y) of the cap's top, the cap's foot (where the torso's ring sits), the elbow,
// the wrist and the fingertips; each ring's row; the cap's rows. Per body: the elbow's, the wrist's and the fingertips'
// rows on the body reference (its pixels), measured.
const SHEET = {
  male: { top: 55, ball: 175, elbow: 240, wrist: 405, tip: 515, rows: { ua: 186, ub: 196, uc: 206, ud: 216, ue: 226, el: 242, fa: 258, fb: 278, fc: 300, fd: 322, fe: 345, ff: 365, fg: 387 }, cap: { ca: 150, cb: 118, cc: 88, ct: 66 } },
  female: { top: 50, ball: 145, elbow: 210, wrist: 332, tip: 422, rows: { ua: 156, ub: 168, uc: 180, ud: 192, ue: 202, el: 212, fa: 226, fb: 242, fc: 260, fd: 278, fe: 296, ff: 314 }, cap: { ca: 124, cb: 96, cc: 70, ct: 56 } },
};
const BODY_ROWS = { male: { elbow: 700, wrist: 875, tip: 1052 }, female: { elbow: 670, wrist: 857, tip: 993 } };
// The hand's vertices on a template measured off the male sheet's hand back and hand profile views (sheet pixels: u
// across toward the thumb from the stub's middle, v down from the wrist, w out of the back of the hand from the stub's
// middle), as shares of the hand's length (193 px); the female's sheet measures the same shares.
const HAND_T = {
  wk: [-39, 0, 0], wb0: [-20, 0, 32], wb1: [20, 0, 32], wt: [39, 0, 0], wp1: [20, 0, -32], wp0: [-20, 0, -32],
  kb0: [-63, 93, 40], kb1: [-36, 92, 48], kb2: [-9, 92, 50], kb3: [18, 92, 48], kb4: [45, 93, 40],
  kp4: [45, 100, -12], kp3: [18, 102, -16], kp2: [-9, 102, -16], kp1: [-36, 102, -14], kp0: [-63, 100, -8],
  mb0: [-55, 145, 38], mb1: [-31, 147, 44], mb2: [-7, 148, 46], mb3: [17, 147, 44], mb4: [39, 145, 38],
  mp4: [39, 140, -2], mp3: [17, 142, -6], mp2: [-7, 142, -6], mp1: [-31, 142, -6], mp0: [-55, 140, -2],
  nb0: [-30, 183, 22], nb1: [-12, 188, 24], nb2: [6, 190, 24], nb3: [22, 188, 22], nb4: [34, 183, 20],
  np4: [34, 176, 2], np3: [22, 180, 0], np2: [6, 182, 0], np1: [-12, 180, 0], np0: [-30, 176, 2],
  ta: [62, 55, 10], tb: [46, 94, 6], tc: [46, 96, -30], td: [58, 60, -34],
  t1a: [78, 104, -2], t1b: [48, 110, -2], t1c: [48, 112, -36], t1d: [78, 106, -36],
  t2a: [74, 126, -6], t2b: [52, 132, -6], t2c: [52, 134, -32], t2d: [74, 128, -32],
  pc: [0, 55, -30],
};
if (stage === 'init') {
  const S = SHEET[who], B = BODY_ROWS[who], bc = BODY_CAM[who];
  const ring = torsoRing(who), r0 = mean(ring, Object.keys(ring));
  // a row's run on a view (the nearest row below with any, at the cap's very top)
  const rows = (v, y) => { const r = REF.views[v]; let j = Math.max(0, Math.min(r.h - 1, Math.round((y - r.box[1]) / K))); while (j < r.h - 1 && r.mask[j].indexOf('1') < 0) j++; const row = r.mask[j]; const a = row.indexOf('1'), b = row.lastIndexOf('1'); return [r.box[0] + a * K, r.box[0] + (b + 1) * K]; };
  // the arm's own front run on the body reference's row (its lateral and medial edges), below the armpit
  const bodyRow = (Y) => { const r = REF.views.body, j = Math.round((Y - r.box[1]) / K); const row = r.mask[j]; const a = row.indexOf('1'); let b = row.indexOf('0', a); if (b < 0 || b > r.cut[j]) b = r.cut[j]; return [r.box[0] + a * K, r.box[0] + b * K]; };
  const yW = (Y) => (bc.cy - Y) / bc.s, xW = (X) => (X - bc.cx) / bc.s;
  const elbowY = yW(B.elbow), wristY = yW(B.wrist), tipY = yW(B.tip);
  // the sheet's px per head unit below the cap: its cap's foot to the fingertips over the body's ring to fingertips
  const k = (S.tip - S.ball) / (r0[1] - tipY);
  // sheet row -> world y: piecewise through the cap's foot (the ring), the elbow, the wrist, the fingertips
  const knots = [[S.ball, r0[1]], [S.elbow, elbowY], [S.wrist, wristY], [S.tip, tipY]];
  const yOf = (ys) => { for (let i = 0; i + 1 < knots.length; i++) { const [a, ya] = knots[i], [b, yb] = knots[i + 1]; if (ys <= b || i + 2 === knots.length) return ya + ((ys - a) / (b - a)) * (yb - ya); } };
  const [f0a, f0b] = rows('front', S.ball), [p0a, p0b] = rows('profile', S.ball);
  const c8 = Math.SQRT1_2;
  const ringAt = (c, a, b) => [[-a * c8, 0, b * c8], [-a, 0, 0], [-a * c8, 0, -b * c8], [0, 0, -b], [a * c8, 0, -b * c8], [a, 0, 0], [a * c8, 0, b * c8], [0, 0, b]].map((d) => [c[0] + d[0], c[1] + d[1], c[2] + d[2]]);
  const V = {};
  // the arm's rings: x and the width off the body where the arm stands clear of it, the depth and z off the sheet's
  // profile, kept in the sheet's own proportion of width to depth; above the armpit (the body there the torso's) x runs
  // straight from the torso's ring to the first clear ring and the width is the sheet's, scaled as that ring's
  const meas = Object.entries(S.rows).map(([name, ys]) => {
    const y = yOf(ys), [fa, fb] = rows('front', ys), [pa, pb] = rows('profile', ys);
    const aS = (fb - fa) / 2 / k, bS = (pb - pa) / 2 / k;
    const Y = bc.cy - y * bc.s, [ba, bb] = bodyRow(Y);
    const clear = Y > (who === 'male' ? 560 : 535);
    return { name, y, aS, bS, clear, a: (bb - ba) / 2 / bc.s, x: xW((ba + bb) / 2), z: r0[2] + ((pa + pb) / 2 - (p0a + p0b) / 2) / k };
  });
  const first = meas.find((m) => m.clear), fr = first.a / first.aS;
  for (const m of meas) {
    if (!m.clear) { m.a = m.aS * fr; m.x = r0[0] + ((first.x - r0[0]) * (m.y - r0[1])) / (first.y - r0[1]); }
    ringAt([m.x, m.y, m.z], m.a, m.bS * (m.a / m.aS)).forEach((p, i) => { V[`${m.name}${i}`] = p.map((q) => +q.toFixed(4)); });
  }
  // the cap: a dome over the torso's ring, level rings as wide and as deep as the sheet's cap at their rows, their
  // centres moved as the cap's middle moves on the sheet
  const nr = [0, 1, 0];
  // the cap's offsets measured from the arm's top ring (ua), so the ball hangs over the arm as the sheet's does: its outer
  // side in line with the arm's, its inner side over the torso; its lowest ring the torso's ring widened and raised, so
  // the ball runs down into the arm without a ledge
  const ua = mean(V, Array.from({ length: 8 }, (_, i) => `ua${i}`)), [uaa, uab] = rows('front', S.rows.ua), [upa, upb] = rows('profile', S.rows.ua);
  const RN = Array.from({ length: 8 }, (_, i) => V[`ua${i}`]), ru = ua;
  Object.entries(S.cap).forEach(([name, ys], ci) => {
    const h = (S.ball - ys) / k, [fa, fb] = rows('front', ys), [pa, pb] = rows('profile', ys);
    const off = [((fa + fb) / 2 - (uaa + uab) / 2) / k, 0, ((pa + pb) / 2 - (upa + upb) / 2) / k];
    const c = [ua[0] + off[0], r0[1] + h, ua[2] + off[2]];
    if (name === 'ct') { V.ct = c.map((q) => +q.toFixed(4)); return; }
    if (ci === 0) { const g = ((fb - fa) / 2 / k) / (Math.max(...RN.map((p) => Math.abs(p[0] - ru[0])))); RN.forEach((p, i) => { V[`${name}${i}`] = [0, 1, 2].map((q) => +((q === 1 ? Math.max(p[1] + 0.1, r0[1] + h * 0.6) : c[q] + (p[q] - ru[q]) * Math.min(g, 1.6))).toFixed(4)); }); return; }
    ringAt(c, (fb - fa) / 2 / k, (pb - pa) / 2 / k).forEach((p, i) => { V[`${name}${i}`] = p.map((q) => +q.toFixed(4)); });
  });
  // the hand: its frame at the wrist (x off the body, z off the sheet's profile), down toward the fingertips as the body
  // has them, the back of the hand forward; its length the body's wrist to fingertips
  const [wa, wb] = bodyRow(B.wrist), [ta, tb] = bodyRow(B.tip - 6);
  const [pwa, pwb] = rows('profile', S.wrist), [pta, ptb] = rows('profile', S.tip - 8);
  const O = [xW((wa + wb) / 2), wristY, r0[2] + ((pwa + pwb) / 2 - (p0a + p0b) / 2) / k];
  const tip = [xW((ta + tb) / 2), tipY, r0[2] + ((pta + ptb) / 2 - (p0a + p0b) / 2) / k];
  const v = unit(sub3(tip, O)), w = unit(sub3([0, 0, 1], v.map((x) => x * v[2]))), u = cross3(v, w);
  const L = Math.hypot(...sub3(tip, O)) / 193;
  const sgn = u[0] > 0 ? 1 : -1; // u toward the body's middle (+x for the right arm): the thumb
  for (const [n, [a, b, c]] of Object.entries(HAND_T)) V[n] = [0, 1, 2].map((q) => +(O[q] + L * (sgn * a * u[q] + b * v[q] + c * w[q])).toFixed(4));
  writeFileSync(join(DIR, `lowafit-${who}.json`), JSON.stringify({ V }, null, 1));
  console.log('init', who, 'px/unit', k.toFixed(1), 'ring', r0.map((x) => x.toFixed(2)).join(','), 'elbow y', elbowY.toFixed(2), 'wrist', O.map((x) => x.toFixed(2)).join(','), 'tip', tip.map((x) => x.toFixed(2)).join(','));
  // default cameras: each view's pivot the arm's (or the hand's) middle, its scale the sheet's
  const all = existsSync(CAMS_FILE) ? JSON.parse(readFileSync(CAMS_FILE, 'utf8')) : {};
  if (!all[who] || args.includes('--cams')) {
    const armC = mean(V, Object.keys(V).filter((n) => !n.startsWith('c'))), handC = mean(V, Object.keys(HAND_T));
    const c = {};
    const centre = (v) => { const r = R[v]; let sx = 0, sy = 0, n = 0; for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) if (r.m[j * r.w + i]) { sx += i; sy += j; n++; } return [r.box[0] + (sx / n + 0.5) * K, r.box[1] + (sy / n + 0.5) * K]; };
    ARM_VIEWS.forEach((v, i) => { const [cx, cy] = centre(v); c[v] = { yaw: i * 45, pitch: 0, roll: 0, s: +k.toFixed(2), cx, cy, piv: armC.map((x) => +x.toFixed(3)) }; });
    const kh = (who === 'male' ? 193 : 126) / Math.hypot(...sub3(tip, O));
    HAND_VIEWS.forEach((v, i) => { const [cx, cy] = centre(v); c[v] = { yaw: -i * 45, pitch: 0, roll: 0, s: +kh.toFixed(2), cx, cy, piv: handC.map((x) => +x.toFixed(3)) }; });
    all[who] = c;
    writeFileSync(CAMS_FILE, JSON.stringify(all, null, 1));
  }
  process.exit(0);
}

// --stage handinit: the hand put back on its template (HAND_T) where it hangs now: the wrist's centre, the line to the
// finger ends' middle, the back of the hand forward; the arm's rings kept
if (stage === 'handinit') {
  const V = structuredClone(preset.V), O = mean(V, WRIST), tip = mean(V, ['nb1', 'nb2', 'nb3', 'np1', 'np2', 'np3']);
  const span = Math.hypot(...sub3(tip, O)), L = span / 185;
  const v = unit(sub3(tip, O)), w = unit(sub3([0, 0, 1], v.map((x) => x * v[2]))), u = cross3(v, w), sgn = u[0] > 0 ? 1 : -1;
  for (const [n, [a, b, c]] of Object.entries(HAND_T)) if (!WRIST.includes(n)) V[n] = [0, 1, 2].map((q) => +(O[q] + L * (sgn * a * u[q] + b * v[q] + c * w[q])).toFixed(4));
  writeFileSync(join(DIR, `lowafit-${who}.json`), JSON.stringify({ V }, null, 1));
  process.exit(0);
}
const cams = loadACams();
for (const v of HAND_VIEWS) if (cams[v]) cams[v].piv = [0, -0.6, 0];
// The views' angles held near their labels (a turntable: the arm's five at 0, 45, 90, 135, 180 degrees, the hand's five
// turned the other way), within YAWR of them, the pitch within 12 degrees and the roll within 8: measured, not
// assumed, but not free to fit the arm's own errors.
const NOMINAL = { front: 0, q3: 45, profile: 90, r3: 135, back: 180, hback: 0, hq3: -45, hprofile: -90, hr3: -135, hpalm: -180 };
const YAWR = +opt('yawrange', '10');
function limit(v, k, x) {
  if (k === 'yaw') return Math.min(NOMINAL[v] + 40, Math.max(NOMINAL[v] - 40, x));
  if (k === 'pitch') return Math.min(15, Math.max(-15, x));
  if (k === 'roll') return Math.min(10, Math.max(-10, x));
  return x;
}
// A turntable: each group's views (the arm's five, the hand's five) share one pitch, one roll and one scale, and their
// yaws are the labels' turned by one offset (within 25 degrees), each view's own yaw off that by at most YAWR; the
// pictures' places (cx, cy) are each view's own.
const GROUPS = { arm: ARM_VIEWS, hand: HAND_VIEWS };
function groupParams(g, step = 1) {
  const vs = GROUPS[g].filter((v) => cams[v]);
  if (!vs.length) return [];
  const avg = (f) => vs.reduce((a, v) => a + f(cams[v]), 0) / vs.length;
  const G = { base: vs.reduce((a, v) => a + cams[v].yaw - NOMINAL[v], 0) / vs.length, pitch: avg((c) => c.pitch), roll: avg((c) => c.roll ?? 0), s: avg((c) => c.s) };
  const dev = Object.fromEntries(vs.map((v) => [v, Math.max(-YAWR, Math.min(YAWR, cams[v].yaw - NOMINAL[v] - G.base))]));
  const clamp = (x, r) => Math.max(-r, Math.min(r, x));
  const apply = () => vs.forEach((v) => { const c = cams[v]; c.yaw = NOMINAL[v] + G.base + dev[v]; c.pitch = G.pitch; c.roll = G.roll; c.s = G.s; });
  apply();
  return [
    { step: 4 * step, get: () => G.base, set: (x) => { G.base = clamp(x, 25); apply(); } },
    { step: 3 * step, get: () => G.pitch, set: (x) => { G.pitch = clamp(x, 15); apply(); } },
    { step: 2 * step, get: () => G.roll, set: (x) => { G.roll = clamp(x, 10); apply(); } },
    { step: 2 * step, get: () => G.s, set: (x) => { G.s = x; apply(); } },
    ...vs.flatMap((v) => [
      { step: 3 * step, get: () => dev[v], set: (x) => { dev[v] = clamp(x, YAWR); apply(); } },
      { step: 4 * step, get: () => cams[v].cx, set: (x) => { cams[v].cx = x; } },
      { step: 4 * step, get: () => cams[v].cy, set: (x) => { cams[v].cy = x; } },
    ]),
  ];
}

const base0 = buildLowArm(who, preset);
let M = meshes();
const only = opt('views', '') ? opt('views').split(',') : VIEWS;

function report(tag) {
  const rows = [];
  let tot = 0;
  for (const v of VIEWS) {
    const e = viewError(M, v, cams[v]);
    tot += e.score;
    const L = LEN(v) / 100;
    const wm = e.marks.length ? e.marks.reduce((a, b) => (b.d > a.d ? b : a)) : null;
    rows.push(`${v.padEnd(9)} outline mean ${(e.mean / L).toFixed(1)}% worst ${(e.worst / L).toFixed(1)}%  IoU ${e.iou.toFixed(3)}  ${wm ? `worst landmark ${wm.name} ${(wm.d / L).toFixed(1)}%  (mean ${(e.marks.reduce((a, m) => a + m.d, 0) / e.marks.length / L).toFixed(1)}%, ${e.marks.length})` : ''}`);
  }
  console.log(`${who} ${tag} (score ${tot.toFixed(1)}, warp ${(1000 * warp(M.arm)).toFixed(1)}e-3, lumps ${(1000 * lumps(preset.V)).toFixed(1)}e-3, crossed ${(1000 * crossed(preset.V)).toFixed(2)}e-3, folds ${folds(M.arm, base0)}; arm ${AL}px, hand ${HL.toFixed(0)}px, body arm ${BL}px)\n` + rows.join('\n'));
}
const score = (vs = only) => vs.reduce((s, v) => s + viewError(M, v, cams[v]).score, 0);

if (stage === 'camera') {
  report('before');
  for (const g of Object.keys(GROUPS)) {
    const vs = GROUPS[g].filter((v) => only.includes(v));
    if (!vs.length) continue;
    descend(groupParams(g, 1.5), () => score(vs), +opt('rounds', 8));
  }
  saveCams(cams);
  report('after');
}

// The lattice: each ring of the arm (and of the cap) moved, widened (across and front to back) and turned about the arm
// as one; the hand as a block (moved, turned, scaled about its wrist). The torso's ring never moves.
const T = TOPO[who];
const RINGS = [...T.cap, ...T.rings];
const HAND_NAMES = () => [...new Set(armFaces(who).filter((f) => f.part === 'hand').flatMap((f) => f.v))];
function ringFrame(V, r) {
  const names = r === 'ct' ? ['ct'] : Array.from({ length: 8 }, (_, i) => `${r}${i}`);
  return { names, c: mean(V, names) };
}
function applyLattice(P0, Lr, Lh) {
  const V = structuredClone(P0);
  for (const r of RINGS) {
    const q = Lr[r]; if (!q) continue;
    const { names, c } = ringFrame(P0, r);
    const a = q.t, ca = Math.cos(a), sa = Math.sin(a);
    for (const n of names) {
      const d = sub3(P0[n], c);
      const dx = d[0] * (1 + q.sx), dz = d[2] * (1 + q.sz);
      V[n] = [c[0] + q.d[0] + ca * dx + sa * dz, P0[n][1] + q.d[1], c[2] + q.d[2] - sa * dx + ca * dz];
    }
  }
  if (Lh) {
    const names = HAND_NAMES(), O = mean(P0, WRIST);
    const [rx, ry, rz] = Lh.r, cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
    for (const n of names) {
      let d = sub3(P0[n], O).map((x) => x * (1 + Lh.s));
      d = [d[0], cx * d[1] - sx * d[2], sx * d[1] + cx * d[2]];
      d = [cy * d[0] + sy * d[2], d[1], -sy * d[0] + cy * d[2]];
      d = [cz * d[0] - sz * d[1], sz * d[0] + cz * d[1], d[2]];
      V[n] = [O[0] + Lh.d[0] + d[0], O[1] + Lh.d[1] + d[1], O[2] + Lh.d[2] + d[2]];
    }
  }
  return V;
}
function saveV() { writeFileSync(join(DIR, `lowafit-${who}.json`), JSON.stringify({ V: Object.fromEntries(Object.entries(preset.V).map(([n, p]) => [n, p.map((x) => +x.toFixed(4))])) }, null, 1)); }
const camParams = (views, step = 1) => Object.keys(GROUPS).filter((g) => GROUPS[g].some((v) => views.includes(v))).flatMap((g) => groupParams(g, step / 2));

if (stage === 'lattice' || stage === 'hand') {
  report('before');
  const P0 = structuredClone(preset.V);
  const Lr = Object.fromEntries(RINGS.map((r) => [r, { d: [0, 0, 0], sx: 0, sz: 0, t: 0 }]));
  const Lh = { d: [0, 0, 0], r: [0, 0, 0], s: 0 };
  const ps = [];
  if (stage === 'lattice') for (const r of RINGS) {
    const q = Lr[r];
    for (let k = 0; k < 3; k++) ps.push({ step: 0.04, get: () => q.d[k], set: (x) => { q.d[k] = x; } });
    if (r !== 'ct') { ps.push({ step: 0.05, get: () => q.sx, set: (x) => { q.sx = x; } }, { step: 0.05, get: () => q.sz, set: (x) => { q.sz = x; } }, { step: 0.05, get: () => q.t, set: (x) => { q.t = x; } }); }
  }
  for (let k = 0; k < 3; k++) ps.push({ step: 0.04, get: () => Lh.d[k], set: (x) => { Lh.d[k] = x; } }, { step: 0.05, get: () => Lh.r[k], set: (x) => { Lh.r[k] = x; } });
  ps.push({ step: 0.04, get: () => Lh.s, set: (x) => { Lh.s = x; } });
  const camPs = args.includes('--with-camera') ? camParams(only, 1.5) : [];
  const total = () => { preset.V = applyLattice(P0, Lr, Lh); M = meshes(); return score() + 20 * folds(M.arm, base0) + SMOOTH * lumps(preset.V) + 1e4 * crossed(preset.V); };
  for (let r = 0; r < +opt('rounds', 3); r++) console.log('sweep', r, descend([...ps, ...camPs], total, 1).toFixed(1));
  total();
  saveV(); if (camPs.length) saveCams(cams);
  report('after');
}

if (stage === 'mesh') {
  report('before');
  const sel = opt('names', '').split(',').filter(Boolean);
  const names = Object.keys(preset.V).filter((n) => !sel.length || sel.some((o) => n === o || (o.endsWith('*') && n.startsWith(o.slice(0, -1)))));
  const ps = [];
  for (const n of names) for (let k = 0; k < 3; k++) ps.push({ step: +opt('step', '0.03'), get: () => preset.V[n][k], set: (x) => { preset.V[n][k] = x; } });
  const flatW = +opt('flat', '200'), reg = +opt('reg', '0');
  const start = structuredClone(preset.V);
  const moved = () => { let t = 0; for (const n of names) for (let k = 0; k < 3; k++) t += (preset.V[n][k] - start[n][k]) ** 2; return t; };
  const camPs = args.includes('--with-camera') ? camParams(only, 1) : [];
  const total = () => { M = meshes(); return score() + 20 * folds(M.arm, base0) + reg * moved() + flatW * warp(M.arm) + SMOOTH * lumps(preset.V) + 1e4 * crossed(preset.V); };
  for (let r = 0; r < +opt('rounds', 3); r++) console.log('sweep', r, descend([...ps, ...camPs], total, 1).toFixed(1));
  M = meshes();
  saveV(); if (camPs.length) saveCams(cams);
  report('after');
}

if (stage === 'report') report('now');
if (opt('marks', '')) {
  const out = {};
  for (const v of VIEWS) out[v] = Object.entries(MARKS[v] ?? {}).map(([name, [x, y, n]]) => ({ name, ref: [x, y], ours: markAt(v.startsWith('h') ? M.hand.V : M.arm.V, n, cams[v]).slice(0, 2) }));
  writeFileSync(opt('marks'), JSON.stringify(out));
}
