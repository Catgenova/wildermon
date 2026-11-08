// The leather chest sheet (tools/sculpt/ref/leather-chest.png) registered to the low-poly bodies (cameras, review pose and
// body map as tools/sculpt/lowleatherchestview.mjs draws them):
//
//   node tools/sculpt/lowleatherchestreg.mjs --out <dir> [--tag <name>]
//     1. each body's cameras (one scale and row, a column per view, the turns of q3, side and r3), the review pose
//        (the arms' abd, flex, elbow; the arms' lengths la kept at 1, so the arms set the scale) fitted by least squares
//        to the landmarks (tools/sculpt/lowleatherchestmarks.json):
//        elbows and wrists (both arms where the view shows them), the neck's column, the collar's top (front and back:
//        the sheet's highest collar row, ours COLLAR_TOP, just under the chin, the high collar's reach);
//        then each view's own arms (dp: abd, flex, elbow, fadd added, held near nought; dl: its arm lengths, held near 1) to
//        that view's elbows and wrists: the sheet's views are drawn one by one, their arms not quite alike;
//     2. the sheet's trunk against ours, row by row, where the sheet shows the trunk's own edge (its pieces' outline
//        against the background, not under an arm or a pauldron): the width (front, back) gives sx(y), the depth
//        (side: the whole figure between the armpit and the belt, the arm hanging within the trunk's depth) sz(y), each the sheet's over ours (ours the body's reach plus the plates' clearance), binned and held;
//     3. 1 again with the map; written to tools/sculpt/lowleatherchestcams.json.
//   leatherchest-<tag>-reg.png: the body's wire over each view (2x) with the landmarks (green the sheet's, red ours) and
//   each one's miss in px; printed: the misses, the map's knots.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { TORSO_RING } from './lowarm.mjs';
import { DESIGN } from './garments/leatherchest.mjs';
import { VIEWS, YAW0, DIR, CAMS_FILE, K, reviewVerts, reviewJoints, proj, sheetLabels, sheetCanvas, line, savePNG, mkdir, PIECES } from './lowleatherchestview.mjs';

const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const out = mkdir(resolve(opt('out', 'tmp/lowleatherchest'))), tag = opt('tag', 'x');
const MARKS = JSON.parse(readFileSync(join(DIR, 'lowleatherchestmarks.json'), 'utf8'));
const CLEAR = 0.07, COLLAR_TOP = -0.3;
const COLLAR = new Set(['collar'].map((n) => PIECES.indexOf(n) + 1));
const TRUNK = new Set(['chest', 'back', 'side.l', 'side.r', 'belt'].map((n) => PIECES.indexOf(n) + 1));

/** Nelder-Mead: the x minimising f, from x0 with steps d. */
function nm(f, x0, d, it = 3000) {
  const n = x0.length;
  let P = [x0, ...x0.map((_, i) => x0.map((x, j) => (i === j ? x + d[j] : x)))].map((x) => ({ x, f: f(x) }));
  for (let k = 0; k < it; k++) {
    P.sort((a, b) => a.f - b.f);
    const c = P[0].x.map((_, j) => P.slice(0, n).reduce((s, p) => s + p.x[j], 0) / n), w = P[n];
    const at = (t) => { const x = c.map((cj, j) => cj + t * (w.x[j] - cj)); return { x, f: f(x) }; };
    const r = at(-1);
    if (r.f < P[0].f) { const e = at(-2); P[n] = e.f < r.f ? e : r; }
    else if (r.f < P[n - 1].f) P[n] = r;
    else { const ct = at(0.5); if (ct.f < w.f) P[n] = ct; else P = P.map((p, i) => (i === 0 ? p : { x: p.x.map((x, j) => P[0].x[j] + (x - P[0].x[j]) / 2), f: 0 })).map((p, i) => (i === 0 ? p : { x: p.x, f: f(p.x) })); }
  }
  P.sort((a, b) => a.f - b.f);
  return P[0].x;
}

const cams = {}, report = {};
for (const who of ['male', 'female']) {
  const rig = buildRig(who), { B, J } = rig;
  const neckZ = B.verts.filter((_, i) => B.part[i] === 'neck').reduce((s, p, _, a) => s + p[2] / a.length, 0);
  // (ours: the shoulder's top, the deltoid's highest point over the joint)
  const M = MARKS[who];
  const collarTop = Object.fromEntries(['front', 'back'].map((v) => { const S = sheetLabels(who, v); for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) if (COLLAR.has(S.L[y * S.W + x])) return [v, S.y0 + y]; return [v, null]; }));
  let C = { s: 38, cy: who === 'male' ? 119 : 457, views: Object.fromEntries(VIEWS.map((v) => [v, { yaw: YAW0[v], cx: M[v].neck }])), pose: { abd: 0, flex: 0, elbow: 0 }, sx: null, sz: null };
  const pack = (C) => [C.s, C.cy, ...VIEWS.map((v) => C.views[v].cx), C.views.q3.yaw, C.views.side.yaw, C.views.r3.yaw, C.pose.abd, C.pose.flex, C.pose.elbow, ...(C.la ?? [1, 1])];
  const unpack = (x, C) => ({ ...C, s: x[0], cy: x[1], views: Object.fromEntries(VIEWS.map((v, i) => [v, { ...C.views[v], cx: x[2 + i], yaw: v === 'q3' ? x[7] : v === 'side' ? x[8] : v === 'r3' ? x[9] : YAW0[v] }])), pose: { abd: x[10], flex: x[11], elbow: x[12] }, la: [x[13], x[14]] });
  const misses = (C) => {
    const R = [];
    for (const v of VIEWS) {
      const joints = reviewJoints(rig, C, v);
      for (const k of ['elbow', 'wrist']) for (const [s, m] of Object.entries(M[v][k])) { const q = proj(joints[k][s], C, v); R.push({ v, k: `${k}.${s}`, du: q[0] - m[0], dv: q[1] - m[1], m, q }); }
      const q = proj([0, -0.5, neckZ], C, v); R.push({ v, k: 'neck', du: q[0] - M[v].neck, dv: 0, m: [M[v].neck, q[1]], q });
      // (the collar's top: the sheet's highest collar row, ours COLLAR_TOP under the chin, the high collar's reach)
      if (v === 'front' || v === 'back') { const qq = proj([0, COLLAR_TOP, neckZ], C, v); R.push({ v, k: 'collar top', du: 0, dv: qq[1] - collarTop[v], m: [qq[0], collarTop[v]], q: qq }); }
    }
    return R;
  };
  // the sheet's trunk over ours, row by row: { y, k } where the sheet's trunk pieces meet the background on both sides
  const DES = DESIGN[who], neckS = B.verts.filter((_, i) => B.part[i] === 'neck');
  const trunkS = [];
  for (const t of B.tris) if (['torso', 'pelvis'].includes(B.part[t.v[0]])) { const [a, b, c] = t.v.map((i) => B.verts[i]); for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4 - i; j++) { const u = i / 4, w = j / 4, x = 1 - u - w; trunkS.push([a[0] * x + b[0] * u + c[0] * w, a[1] * x + b[1] * u + c[1] * w, a[2] * x + b[2] * u + c[2] * w]); } }
  // the trunk's heights: the armpit (ours the lowest of the ring where the arm meets the torso; the sheet's the first
  // row, front and back, with background between the trunk and each arm) and the waist (ours the narrowest torso
  // between the armpit and the hip; the sheet's the narrowest row of its trunk pieces below the armpit)
  const armpitY = Math.min(...TORSO_RING.map((n) => B.verts[B.index.get(`${n}.L`)][1]));
  const widthAt = (y) => { const sl = trunkS.filter((p) => Math.abs(p[1] - y) < 0.05); return Math.max(...sl.map((p) => p[0])) - Math.min(...sl.map((p) => p[0])); };
  let waistY = armpitY - 0.3; for (let y = armpitY - 0.3; y > J.hip[1] + 0.3; y -= 0.05) if (widthAt(y) < widthAt(waistY)) waistY = y;
  const sheetRows = {};
  for (const v of ['front', 'back']) {
    const S = sheetLabels(who, v), arm = new Set(PIECES.map((n, i) => (/^(sleeve|bracer|plame)/.test(n) ? i + 1 : 0)).filter(Boolean));
    let pit = null, waist = null, wmin = 1e9;
    for (let y = 0; y < S.H; y++) {
      const row = Array.from(S.L.subarray(y * S.W, (y + 1) * S.W)), tr = row.map((k, x) => (TRUNK.has(k) ? x : -1)).filter((x) => x >= 0);
      if (!tr.length) continue;
      const a = Math.min(...tr), b = Math.max(...tr);
      const gapL = row.slice(0, a).some((k) => arm.has(k)) && row[a - 1] === 0, gapR = row.slice(b + 1).some((k) => arm.has(k)) && row[b + 1] === 0;
      if (pit === null && gapL && gapR) pit = y;
      if (pit !== null && y > pit + 10 && row.some((k) => k === PIECES.indexOf('chest') + 1 || k === PIECES.indexOf('back') + 1) && b - a < wmin) { wmin = b - a; waist = y; }
    }
    sheetRows[v] = { pit: S.y0 + pit + 0.5, waist: S.y0 + waist + 0.5 };
  }
  const trunkMiss = (c) => ['front', 'back'].flatMap((v) => [['armpit', armpitY, sheetRows[v].pit], ['waist', waistY, sheetRows[v].waist]].map(([k, y, row]) => ({ v, k, du: 0, dv: c.cy - c.s * y - row, m: [0, row], q: [0, c.cy - c.s * y] })));
  const fitCams = () => {
    const f = (x) => { const c = unpack(x, C); return misses(c).reduce((s, r) => s + r.du * r.du + r.dv * r.dv, 0) + 0.02 * (c.views.q3.yaw - 45) ** 2 + 0.02 * (c.views.side.yaw - 270) ** 2 + 0.02 * (c.views.r3.yaw - 225) ** 2 ; };
    C = unpack(nm(f, pack(C), [1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 0, 0]), C);
  };
  // (each view's own arms: its correction to the pose, [abd, flex, elbow], fitted to that view's elbows and wrists alone,
  // held near nought)
  const fitViews = () => {
    for (const v of VIEWS) {
      const f = (d) => { const c = { ...C, views: { ...C.views, [v]: { ...C.views[v], dp: d.slice(0, 4), dl: d.slice(4) } } }, J = reviewJoints(rig, c, v); let e = 0; for (const k of ['elbow', 'wrist']) for (const [s, m] of Object.entries(M[v][k])) { const q = proj(J[k][s], c, v); e += (q[0] - m[0]) ** 2 + (q[1] - m[1]) ** 2; } return e + 0.01 * (d[0] ** 2 + d[1] ** 2 + d[2] ** 2 + d[3] ** 2) + 300 * ((d[4] - 1) ** 2 + (d[5] - 1) ** 2); };
      const x = nm(f, [...(C.views[v].dp ?? [0, 0, 0, 0]), ...(C.views[v].dl ?? [1, 1])], [3, 3, 3, 3, 0.04, 0.04], 800);
      C.views[v].dp = x.slice(0, 4).map((y) => +y.toFixed(2)); C.views[v].dl = x.slice(4).map((y) => +y.toFixed(3));
    }
  };
  // the depth from the side view: per row between the armpit and the belt, the sheet's whole figure (the arm hangs within
  // the trunk's depth there) over the trunk's depth plus the plates' clearance
  const depthRatios = () => {
    const S = sheetLabels(who, 'side'), pts = [];
    for (let y = 0; y < S.H; y++) {
      let x0 = -1, x1 = -1;
      for (let x = 0; x < S.W; x++) if (S.L[y * S.W + x]) { if (x0 < 0) x0 = x; x1 = x; }
      if (x0 <= 0) continue;
      const by = (C.cy - (S.y0 + y + 0.5)) / C.s;
      if (by > armpitY - 0.2 || by < waistY + 0.2) continue;
      const sl = trunkS.filter((p) => Math.abs(p[1] - by) < 0.05);
      if (sl.length < 6) continue;
      const ours = Math.max(...sl.map((p) => p[2])) - Math.min(...sl.map((p) => p[2])) + 2 * CLEAR, k = (x1 - x0 + 1) / C.s / ours;
      if (k > 0.5 && k < 1.5) pts.push([by, k]);
    }
    if (!pts.length) return C.sx;
    const ys = [], ks = [];
    for (let y = Math.ceil(Math.max(...pts.map((p) => p[0])) * 2) / 2; y > Math.min(...pts.map((p) => p[0])) - 0.5; y -= 0.5) {
      const bin = pts.filter((p) => p[0] <= y + 0.25 && p[0] > y - 0.25).map((p) => p[1]).sort((a, b) => a - b);
      if (bin.length >= 3) { ys.push(+y.toFixed(2)); ks.push(+bin[Math.floor(bin.length / 2)].toFixed(3)); }
    }
    return { y: ys, k: ks };
  };
  const ratios = (axis, views) => {
    const pts = [];
    for (const v of views) {
      const S = sheetLabels(who, v);
      for (let y = 0; y < S.H; y++) {
        let x0 = -1, x1 = -1;
        // (the trunk's pieces, or the collar's where only the collar is in the row: ours then the neck's reach plus
        // the collar's standing off it, `collar.c` and its flare)
        let collar = false;
        for (let x = 0; x < S.W; x++) if (TRUNK.has(S.L[y * S.W + x])) { if (x0 < 0) x0 = x; x1 = x; }
        if (x0 < 0) { collar = true; for (let x = 0; x < S.W; x++) if (COLLAR.has(S.L[y * S.W + x])) { if (x0 < 0) x0 = x; x1 = x; } }
        if (x0 <= 0 || x1 >= S.W - 1 || S.L[y * S.W + x0 - 1] !== 0 || S.L[y * S.W + x1 + 1] !== 0) continue;
        const by = (C.cy - (S.y0 + y + 0.5)) / C.s;
        const sl = (collar ? neckS : trunkS).filter((p) => Math.abs(p[1] - (collar ? Math.max(by, -0.5) : by)) < 0.05);
        if (sl.length < 6) continue;
        const ours = Math.max(...sl.map((p) => p[axis])) - Math.min(...sl.map((p) => p[axis])) + 2 * (collar ? DES.collar.c + DES.collar.flare : CLEAR), sheet = (x1 - x0 + 1) / C.s;
        // (rows where the sheet's run is a sliver, a piece's edge against a gap, left out)
        if (sheet / ours > 0.5 && sheet / ours < 1.5) pts.push([by, sheet / ours]);
      }
    }
    // (binned 0.5 apart, each bin's median; held beyond)
    pts.sort((a, b) => b[0] - a[0]);
    if (!pts.length) return null;
    const ys = [], ks = [];
    for (let y = Math.ceil(pts[0][0] * 2) / 2; y > pts[pts.length - 1][0] - 0.5; y -= 0.5) {
      const bin = pts.filter((p) => p[0] <= y + 0.25 && p[0] > y - 0.25).map((p) => p[1]).sort((a, b) => a - b);
      if (bin.length >= 3) { ys.push(+y.toFixed(2)); ks.push(+bin[Math.floor(bin.length / 2)].toFixed(3)); }
    }
    return { y: ys, k: ks };
  };
  fitCams(); fitViews();
  C.sx = ratios(0, ['front', 'back']); C.sz = depthRatios();
  fitCams(); fitViews();
  C.sx = ratios(0, ['front', 'back']); C.sz = depthRatios();
  fitCams(); fitViews();
  C.s = +C.s.toFixed(4); C.cy = +C.cy.toFixed(3);
  for (const v of VIEWS) C.views[v] = { yaw: +C.views[v].yaw.toFixed(2), cx: +C.views[v].cx.toFixed(3), dp: C.views[v].dp, dl: C.views[v].dl };
  C.pose = Object.fromEntries(Object.entries(C.pose).map(([k, x]) => [k, +x.toFixed(2)])); C.la = C.la.map((x) => +x.toFixed(3));
  cams[who] = C;
  const R = misses(C);
  const TR = trunkMiss(C);
  console.log('  armpit', armpitY.toFixed(2), 'waist', waistY.toFixed(2), JSON.stringify(sheetRows));
  report[who] = { rms: +Math.sqrt(R.reduce((s, r) => s + r.du * r.du + r.dv * r.dv, 0) / R.length).toFixed(2), byView: Object.fromEntries(VIEWS.map((v) => { const rr = R.filter((r) => r.v === v); return [v, +Math.sqrt(rr.reduce((s, r) => s + r.du * r.du + r.dv * r.dv, 0) / rr.length).toFixed(2)]; })), misses: R.map((r) => `${r.v} ${r.k} ${Math.hypot(r.du, r.dv).toFixed(1)} (${r.du.toFixed(1)},${r.dv.toFixed(1)})`), trunkCheck: TR.map((r) => `${r.v} ${r.k} ${r.dv.toFixed(1)}`) };
  console.log(who, 'pose', JSON.stringify(C.pose), 'la', C.la, 's', C.s, 'rms', report[who].rms, JSON.stringify(report[who].byView));
  console.log('  sx', JSON.stringify(C.sx), '\n  sz', JSON.stringify(C.sz));
  console.log('  views', JSON.stringify(C.views));
}
writeFileSync(CAMS_FILE, JSON.stringify(cams, null, 1));
writeFileSync(join(out, `leatherchest-${tag}-reg.json`), JSON.stringify(report, null, 1));

// the picture: the body's wire over each view, the landmarks
const rows = [];
for (const who of ['male', 'female']) {
  const rig = buildRig(who), C = cams[who], row = [];
  const M = MARKS[who];
  for (const v of VIEWS) {
    const { PB, joints } = reviewVerts(rig, null, C, v);
    const S = sheetLabels(who, v), R = sheetCanvas(out, [S.x0, S.y0, S.x0 + S.W, S.y0 + S.H]);
    const P = PB.map((p) => { const q = proj(p, C, v); return [(q[0] - S.x0) * K, (q[1] - S.y0) * K]; });
    for (const t of rig.B.tris) for (let k = 0; k < 3; k++) line(R, P[t.v[k]], P[t.v[(k + 1) % 3]], [90, 200, 255]);
    const dot = (p, rgb, r = 3) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) { const x = Math.round(p[0] + dx), y = Math.round(p[1] + dy); if (x >= 0 && y >= 0 && x < R.W && y < R.H) R.c.set(rgb, (y * R.W + x) * 3); } };
    for (const k of ['elbow', 'wrist']) for (const [s, m] of Object.entries(M[v][k])) {
      const q = proj(joints[k][s], C, v);
      dot([(m[0] - S.x0) * K, (m[1] - S.y0) * K], [0, 255, 0], 4); dot([(q[0] - S.x0) * K, (q[1] - S.y0) * K], [255, 40, 40], 2);
    }
    row.push({ R, label: `${who} ${v} yaw ${C.views[v].yaw} rms ${report[who].byView[v]}px` });
  }
  rows.push(row);
}
savePNG(join(out, `leatherchest-${tag}-reg.png`), rows, { title: `leather chest ${tag}: the body (review pose, the sheet's body map) over the sheet; landmarks green the sheet's, red ours` });
console.log('wrote', join(out, `leatherchest-${tag}-reg.png`));
