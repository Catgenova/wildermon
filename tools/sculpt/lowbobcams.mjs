// The bob's sheet cameras (tools/sculpt/ref/hair-bob.png, five views of a woman's bust) registered to each low-poly
// body's head: tools/sculpt/hairs/bob-cams-<who>.json, in the format of tools/sculpt/lowhaircams.json (read by
// tools/sculpt/lowhairhull.mjs project, after the body is stretched by kx across and kz front to back about the pivot:
// bodyAt). The sheet is a turntable: one scale, tilt, pivot row and stretch for all five views (the sheet's head is a
// little wider or deeper than the body's); per view its turn and its column. Fitted so
//   - the body's head and neck cover the sheet's skin and none of its background, in the rows from the fringe down to the
//     neck's foot (the sheet's hair, which hides the skull, left out of the count), and
//   - the body's pupils, nose tip and chin land on the sheet's (tools/sculpt/lowbobsheet.py), the chin weighted most:
//     the bob's ends are cut level with it.
// Each view's turn held near its label, the stretch near 1. In the views from behind only the neck's and the jaw's skin
// shows under the hair: those count a quarter (the bodies' necks are not the sheet's). The profile faces the viewer's left (the sheet's turn -90),
// the rear three-quarter shows her right (225). Coordinate descent from the labels (or the last fit).
//
//   node tools/sculpt/lowbobcams.mjs [--who female,male] [--rounds 6] [--fresh]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { project, raster, PIV } from './lowhairhull.mjs';

const DIR = new URL('.', import.meta.url).pathname;
export const BOB_VIEWS = ['front', 'q3', 'profile', 'r3', 'back'];
export const BOB_SPAN = { front: [30, 305], q3: [305, 590], profile: [590, 876], r3: [876, 1155], back: [1155, 1430] };
export const camsFile = (who) => join(DIR, `hairs/bob-cams-${who}.json`);
export const bobCams = (who) => JSON.parse(readFileSync(camsFile(who), 'utf8'));
/** The rows the skin is compared in: from the fringe's lower edge to the neck's foot. */
const ROWS = [200, 345];
const MARK_W = { pupil: 20, nose: 8, chin: 30 };
const LABEL = { front: 0, q3: 45, profile: -90, r3: 225, back: 180 }, YAW_W = 2, K_W = 4000, BEHIND = 0.25;

/** A body point stretched as the camera says (kx across, kz front to back, about the pivot). */
export const bodyAt = (c) => (p) => [PIV[0] + (p[0] - PIV[0]) * (c.kx ?? 1), p[1], PIV[2] + (p[2] - PIV[2]) * (c.kz ?? 1)];
/** A body point on the sheet under a view's camera. */
export const sheetAt = (p, c) => project(bodyAt(c)(p), c);

/** The sheet's mask as one class per pixel: 0 the background, 1 the skin, 2 the hair. */
export function sheetClasses() {
  const M = JSON.parse(readFileSync(join(DIR, 'hairs/bob-sheet.json'), 'utf8')), A = new Uint8Array(M.w * M.h);
  for (const [key, val] of [['hair', 2], ['skin', 1]]) M[key].forEach((r, y) => { for (let k = 0; k < r.length; k += 2) A.fill(val, y * M.w + r[k], y * M.w + r[k + 1]); });
  return { A, w: M.w, h: M.h, marks: M.marks };
}

/** A body's landmarks: the pupils, the nose's tip, the chin. */
export function marksOf(B) {
  const mid = (ps) => [0, 1, 2].map((k) => ps.reduce((a, q) => a + q[k], 0) / ps.length);
  const pupil = (s) => mid(B.polys.filter((p) => p.mat === 'pupil').flatMap((p) => p.v.map((i) => B.verts[i])).filter((q) => Math.sign(q[0]) === s));
  const nose = B.polys.filter((p) => p.part === 'head').flatMap((p) => p.v).map((i) => B.verts[i]).reduce((a, q) => (q[2] > a[2] ? q : a));
  return { pupils: [pupil(-1), pupil(1)], nose, chin: B.verts[B.index.get('ch0')] };
}

const camsOf = (g) => Object.fromEntries(BOB_VIEWS.map((v) => [v, { yaw: g[v].yaw, pitch: g.pitch, s: g.s, cx: g[v].cx, cy: g.cy, kx: g.kx, kz: g.kz }]));

export function fit(who, rounds = 6, fresh = false) {
  const rig = buildRig(who), B = rig.B, M = marksOf(B);
  const tris = B.tris.filter((t) => ['head', 'neck'].includes(B.polys[t.poly].part)).map((t) => t.v.map((i) => B.verts[i]));
  const { A, w, h, marks } = sheetClasses();
  const old = !fresh && existsSync(camsFile(who)) ? bobCams(who) : null;
  const g = old ? { pitch: old.front.pitch, s: old.front.s, cy: old.front.cy, kx: old.front.kx ?? 1, kz: old.front.kz ?? 1 } : { pitch: 0, s: 95, cy: 218, kx: 1, kz: 1 };
  for (const v of BOB_VIEWS) g[v] = old ? { yaw: old[v].yaw, cx: old[v].cx } : { yaw: LABEL[v], cx: (BOB_SPAN[v][0] + BOB_SPAN[v][1]) / 2 };
  const pairs = (v, c) => {
    const sm = marks[v] ?? {}, out = [], px = (p) => sheetAt(p, c);
    for (const p of sm.pupils ?? []) out.push(['pupil', p, M.pupils.reduce((a, q) => (Math.abs(px(q)[0] - p[0]) < Math.abs(px(a)[0] - p[0]) ? q : a))]);
    if (sm.nose) out.push(['nose', sm.nose, M.nose]);
    if (sm.chin) out.push(['chin', sm.chin, M.chin]);
    return out;
  };
  const viewCost = (v, c) => {
    const [lo, hi] = BOB_SPAN[v], Z = new Float32Array(w * h).fill(-Infinity), cov = new Uint8Array(w * h);
    const st = bodyAt(c);
    raster(tris.map((t) => t.map(st)), c, Z, w, h, cov, 1);
    let miss = 0, extra = 0;
    for (let y = ROWS[0]; y < ROWS[1]; y++) for (let x = lo; x < hi; x++) {
      const i = y * w + x, a = A[i];
      if (a === 1 && !cov[i]) miss++; else if (a === 0 && cov[i]) extra++;
    }
    let m = 0;
    for (const [n, at, p] of pairs(v, c)) { const q = sheetAt(p, c); m += MARK_W[n] * ((q[0] - at[0]) ** 2 + (q[1] - at[1]) ** 2); }
    const dy = ((c.yaw - LABEL[v] + 540) % 360) - 180;
    return (miss + extra) * (v === 'r3' || v === 'back' ? BEHIND : 1) + m + YAW_W * dy * dy + K_W * ((c.kx - 1) ** 2 + (c.kz - 1) ** 2) / 5;
  };
  const per = Object.fromEntries(BOB_VIEWS.map((v) => [v, viewCost(v, camsOf(g)[v])]));
  let best = Object.values(per).reduce((a, q) => a + q, 0);
  const keys = [['pitch', 2], ['s', 4], ['cy', 4], ['kx', 0.04], ['kz', 0.04], ...BOB_VIEWS.flatMap((v) => [[v + '.yaw', 4], [v + '.cx', 4]])];
  const get = (k) => (k.includes('.') ? g[k.split('.')[0]][k.split('.')[1]] : g[k]);
  const set = (k, x) => { if (k.includes('.')) g[k.split('.')[0]][k.split('.')[1]] = x; else g[k] = x; };
  const tryIt = (k, x) => {
    const was = get(k); set(k, x);
    const cs = camsOf(g), views = k.includes('.') ? [k.split('.')[0]] : BOB_VIEWS, nv = {};
    for (const v of views) nv[v] = viewCost(v, cs[v]);
    const tot = best - views.reduce((a, v) => a + per[v], 0) + views.reduce((a, v) => a + nv[v], 0);
    if (tot < best) { best = tot; Object.assign(per, nv); return true; }
    set(k, was); return false;
  };
  for (let r = 0; r < rounds; r++) for (const [k, st0] of keys) {
    const st = st0 / 2 ** r;
    for (let it = 0; it < 20; it++) if (!tryIt(k, get(k) + st) && !tryIt(k, get(k) - st)) break;
  }
  const out = camsOf(g);
  for (const v of BOB_VIEWS) {
    const c = out[v];
    for (const k of Object.keys(c)) c[k] = +c[k].toFixed(4);
    const res = pairs(v, c).map(([n, at, p]) => { const q = sheetAt(p, c); return `${n} ${Math.hypot(q[0] - at[0], q[1] - at[1]).toFixed(1)}`; });
    console.log(who, v, JSON.stringify(c), `cost ${per[v].toFixed(0)}; landmarks off (px): ${res.join(', ')}`);
  }
  writeFileSync(camsFile(who), JSON.stringify(out, null, 1) + '\n');
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  for (const who of opt('who', 'female,male').split(',')) fit(who, +opt('rounds', 6), args.includes('--fresh'));
}
