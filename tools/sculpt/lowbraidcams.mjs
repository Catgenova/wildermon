// The side braid's sheet cameras (tools/sculpt/ref/hair-side-braid.png, five views of a woman's bust): each view's turn,
// tilt, scale and centre fitted to the low-poly woman's head and neck, so they cover the sheet's skin there
// (tools/sculpt/hairs/braid-mask.json, its skin: lowbraidsheet.py) and nothing of the sheet's background, and her pupils,
// chin, nose and ears land on the sheet's (MARKS); each view's turn kept near its label, its tilt near level and its
// scale near the front's. Only the rows above the chin count in the views that show the face, above the neck's foot in
// the others (the sheet's neck is longer than hers). Coordinate descent from the labels' turns (or the last fit).
// Writes tools/sculpt/hairs/braid-cams.json, in the format of tools/sculpt/lowhaircams.json.
//
//   node tools/sculpt/lowbraidcams.mjs [--rounds 6] [--fresh]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRig } from './lowrig.mjs';
import { project, raster } from './lowhairhull.mjs';

const DIR = new URL('.', import.meta.url).pathname;
export const BRAID_VIEWS = ['front', 'q3', 'profile', 'r3', 'back'];
/** Each view's columns on the sheet, and the row its skin is compared down to (the shoulders' top). */
export const BRAID_SPAN = { front: [40, 345], q3: [345, 650], profile: [650, 955], r3: [955, 1245], back: [1245, 1536] };
const CUT = { front: 254, q3: 254, profile: 252, r3: 270, back: 270 };
/** The sheet's landmarks, sheet pixels: the pupils (the dark squares' middles, her left eye first), the chin's point,
 * the nose's tip and the ear's middle (her right in the profile, her left in the rear three-quarter). */
const MARKS = {
  front: { eyeL: [240.5, 162.5], eyeR: [177.5, 162.5], chin: [209, 251] },
  q3: { eyeL: [571, 162.5], eyeR: [515, 162.5], chin: [543, 250], nose: [557, 194] },
  profile: { eyeR: [853, 163.5], chin: [862, 249], nose: [888, 191], earR: [771, 176] },
  r3: { earL: [1030, 188] },
  back: {},
};
/** How much each counts (per square pixel off), and the priors: each view's turn near its label (per square degree),
 * its tilt near level, its scale near the front's (per square pixel per head unit). */
const MARK_W = { eyeL: 25, eyeR: 25, chin: 12, nose: 8, earL: 4, earR: 4 };
const LABEL = { front: 0, q3: 45, profile: 90, r3: 225, back: 180 }, YAW_W = 3, PITCH_W = 40, SCALE_W = 2;

/** The sheet's mask as rows of classes: 0 the background, 1 the skin, 2 the hair. */
export function sheetClasses() {
  const M = JSON.parse(readFileSync(join(DIR, 'hairs/braid-mask.json'), 'utf8')), A = new Uint8Array(M.w * M.h);
  for (const [key, val] of [['runs', 2], ['skin', 1]]) M[key].forEach((r, y) => { for (let k = 0; k < r.length; k += 2) A.fill(val, y * M.w + r[k], y * M.w + r[k + 1]); });
  return { A, w: M.w, h: M.h };
}

function fit(rounds = 6) {
  const rig = buildRig('female'), B = rig.B;
  const tris = B.tris.filter((t) => ['head', 'neck'].includes(B.polys[t.poly].part)).map((t) => t.v.map((i) => B.verts[i]));
  const mid = (ps) => [0, 1, 2].map((k) => ps.reduce((a, q) => a + q[k], 0) / ps.length);
  const pupil = (s) => mid(B.polys.filter((p) => p.mat === 'pupil').flatMap((p) => p.v.map((i) => B.verts[i])).filter((q) => Math.sign(q[0]) === s));
  const ear = (side) => mid(B.names.map((n, i) => (n && n.startsWith('ear.' + side) ? B.verts[i] : null)).filter(Boolean));
  const P = (n) => B.verts[B.index.get(n)];
  const nose = B.polys.filter((p) => p.part === 'head').flatMap((p) => p.v).map((i) => B.verts[i]).reduce((a, q) => (q[2] > a[2] ? q : a));
  const ours = { eyeL: pupil(1), eyeR: pupil(-1), chin: P('ch0'), nose, earL: ear('L'), earR: ear('R') };
  const { A, w, h } = sheetClasses();
  const start = { front: { yaw: 0, pitch: 0, s: 105, cx: 207, cy: 190 }, q3: { yaw: 40, pitch: 0, s: 105, cx: 525, cy: 190 },
    profile: { yaw: 90, pitch: 0, s: 105, cx: 790, cy: 190 }, r3: { yaw: 225, pitch: 0, s: 105, cx: 1080, cy: 190 }, back: { yaw: 180, pitch: 0, s: 105, cx: 1375, cy: 190 } };
  const old = args().includes('--fresh') ? null : (() => { try { return JSON.parse(readFileSync(join(DIR, 'hairs/braid-cams.json'), 'utf8')); } catch { return null; } })();
  const out = {};
  for (const v of BRAID_VIEWS) {
    const [lo, hi] = BRAID_SPAN[v], cut = CUT[v];
    const cost = (c) => {
      const Z = new Float32Array(w * h).fill(-Infinity), cov = new Uint8Array(w * h);
      raster(tris, c, Z, w, h, cov, 1);
      let miss = 0, extra = 0;
      for (let y = 0; y < cut; y++) for (let x = lo; x < hi; x++) {
        const i = y * w + x, a = A[i];
        if (a === 1 && !cov[i]) miss++;
        else if (a === 0 && cov[i]) extra++;
      }
      let marks = 0;
      for (const [m, p] of Object.entries(MARKS[v])) { const q = project(ours[m], c); marks += MARK_W[m] * ((q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2); }
      const dy = ((c.yaw - LABEL[v] + 540) % 360) - 180;
      return miss + extra + marks + YAW_W * dy * dy + PITCH_W * c.pitch * c.pitch + (v === 'front' ? 0 : SCALE_W * (c.s - out.front.s) ** 2);
    };
    let c = { ...(old?.[v] ?? start[v]) }, best = cost(c);
    const steps = { yaw: 4, pitch: 2, s: 4, cx: 4, cy: 4 };
    for (let r = 0; r < rounds; r++) {
      for (const [k, st0] of Object.entries(steps)) {
        let st = st0 / 2 ** r;
        for (let it = 0; it < 12; it++) {
          let moved = false;
          for (const sg of [1, -1]) {
            const t = { ...c, [k]: c[k] + sg * st }, f = cost(t);
            if (f < best) { best = f; c = t; moved = true; break; }
          }
          if (!moved) break;
        }
      }
    }
    for (const k of Object.keys(c)) c[k] = +c[k].toFixed(3);
    out[v] = c;
    const off = Object.entries(MARKS[v]).map(([m, p]) => `${m} ${Math.hypot(...project(ours[m], c).slice(0, 2).map((x, j) => x - p[j])).toFixed(1)}`);
    console.log(v, JSON.stringify(c), 'cost', best.toFixed(0), 'landmarks off (px):', off.join(', '));
  }
  writeFileSync(join(DIR, 'hairs/braid-cams.json'), JSON.stringify(out, null, 1) + '\n');
}

const args = () => process.argv.slice(2);
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  fit(+opt('rounds', 6));
}
