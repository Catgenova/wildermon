// The chest sheet's views (tools/sculpt/ref/plate-chest.png) as cameras on the low-poly bodies, shared by the
// registration (lowplatechestreg.mjs), the fit (lowplatechestfit.mjs) and their pictures:
//
//   each view an orthographic turntable: a point p at turn `yaw` goes to
//     u = cx + s (cos(yaw) x + sin(yaw) z),  v = cy - s y,  depth -sin(yaw) x + cos(yaw) z (the larger the nearer)
//   (s and cy one per body, as the sheet is drawn; cx and yaw per view: front 0, q3 45, side 90, r3 225 — the sheet's
//   rear three-quarter is turned the other way, its left side and back toward us — back 180);
//   the review pose: the sheet's arms (each upper arm out by `abd` and forward by `flex`, each elbow bent by `elbow`,
//   degrees, both sides alike);
//   the sheet's body: a 3D map on top of the pose, x by sx(y) and z by sz(y) (piecewise linear in the body's y) on the
//   trunk, each arm moved with its shoulder; a vertex takes each bone's map by its weight.
//
// Also a small rasteriser (flat-shaded triangles with depth, a piece label per pixel) and the sheet's pieces
// (tools/sculpt/plate/chest-masks.json) as label images per view.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { posed, skin, axisAngle, mm, tr } from './lowrig.mjs';
import { skinGarment } from './lowgarment.mjs';

export const DIR = new URL('.', import.meta.url).pathname;
export const VIEWS = ['front', 'q3', 'side', 'r3', 'back'];
export const YAW0 = { front: 0, q3: 45, side: 90, r3: 225, back: 180 };
export const MASKS = JSON.parse(readFileSync(join(DIR, 'plate/chest-masks.json'), 'utf8'));
export const PIECES = MASKS.pieces;
export const CAMS_FILE = join(DIR, 'lowplatechestcams.json');
export const K = 2;

/** The sheet's labels in a view's box: { x0, y0, W, H, L (Uint8Array, piece index + 1) }. */
export function sheetLabels(who, view) {
  const { box, runs } = MASKS.views[who][view], W = box[2] - box[0], H = box[3] - box[1], L = new Uint8Array(W * H);
  runs.forEach((r, y) => { for (let k = 0; k < r.length; k += 3) L.fill(r[k + 2], y * W + r[k], y * W + r[k + 1]); });
  return { x0: box[0], y0: box[1], W, H, L };
}
let SHEET_RGB = null;
/** The sheet's pixels (RGB bytes, 1536 x 1024), decoded once by python into the scratch directory given. */
export function sheetRGB(tmp) {
  if (SHEET_RGB) return SHEET_RGB;
  const f = join(tmp, '.sheet.rgb');
  if (!existsSync(f)) execFileSync('python3', ['-c', 'import sys; from PIL import Image; open(sys.argv[2], "wb").write(Image.open(sys.argv[1]).convert("RGB").tobytes())', join(DIR, 'ref/plate-chest.png'), f]);
  SHEET_RGB = { W: 1536, H: 1024, px: readFileSync(f) };
  return SHEET_RGB;
}

/* ---- the review pose and the sheet's body map ------------------------------------------------------------------- */
const X = [1, 0, 0], Z = [0, 0, 1];
export function reviewPose(rig, A = { abd: 0, flex: 0, elbow: 0 }) {
  const W = (bone, axis, deg) => { const R = rig.bones[rig.at.get(bone)].R; return mm(tr(R), mm(axisAngle(axis, deg), R)); };
  const p = {};
  for (const [s, k] of [['l', 1], ['r', -1]]) {
    const ax = (a) => [k * a[0], a[1], a[2]];
    p[`upperarm_${s}`] = mm(W(`upperarm_${s}`, ax(Z), k * A.abd), W(`upperarm_${s}`, ax(X), k * -A.flex));
    p[`lowerarm_${s}`] = W(`lowerarm_${s}`, ax(X), k * -A.elbow);
  }
  return p;
}
const ARM = /^(upperarm|lowerarm|hand|thumb|fingers|shoulder|elbow|wrist|knuckles)/;
/** piecewise linear through knots { y: [...] (descending), k: [...] }, held flat beyond the ends */
export function pw(m, y) {
  if (!m) return 1;
  const { y: Y, k } = m;
  if (y >= Y[0]) return k[0];
  for (let i = 0; i + 1 < Y.length; i++) if (y >= Y[i + 1]) { const t = (y - Y[i]) / (Y[i + 1] - Y[i]); return k[i] + (k[i + 1] - k[i]) * t; }
  return k[k.length - 1];
}
/** The map of a body (rig) for a camera set C ({ sx, sz }): per bone a function of a point. */
export function bodyMap(rig, C, f) {
  const trunk = (p) => [p[0] * pw(C.sx, p[1]), p[1], p[2] * pw(C.sz, p[1])];
  // (each arm moved with its shoulder; the forearm and hand further by the upper arm's length change, la[0] of it, and
  // the hand by the forearm's, la[1], along the posed bones)
  const la = C.la ?? [1, 1], P = (n) => f[rig.at.get(n)].P;
  const d = {};
  for (const s of ['l', 'r']) {
    const S = P(`upperarm_${s}`), E = P(`lowerarm_${s}`), W = P(`hand_${s}`), t = trunk(S), d0 = [t[0] - S[0], t[1] - S[1], t[2] - S[2]];
    const d1 = d0.map((x, k) => x + (la[0] - 1) * (E[k] - S[k])), d2 = d1.map((x, k) => x + (la[1] - 1) * (W[k] - E[k]));
    d[s] = { upper: d0, fore: d1, hand: d2 };
  }
  const seg = (n) => (/^(upperarm|shoulder)/.test(n) ? 'upper' : /^(lowerarm|elbow)/.test(n) ? 'fore' : 'hand');
  const per = rig.bones.map((b) => { const m = b.name.match(/_(l|r)$/); if (!(ARM.test(b.name) && m)) return trunk; const t = d[m[1]][seg(b.name)]; return (p) => [p[0] + t[0], p[1] + t[1], p[2] + t[2]]; });
  return (p, w) => { let x = 0, y = 0, z = 0; for (const [bi, ww] of w) { const q = per[bi](p); x += ww * q[0]; y += ww * q[1]; z += ww * q[2]; } return [x, y, z]; };
}
/** Body and armour in the review pose, mapped onto the sheet's body: { PB, PG, joints }. */
export function reviewVerts(rig, G, C) {
  const f = posed(rig, reviewPose(rig, C.pose));
  const map = bodyMap(rig, C, f);
  const PB = skin(rig, f).map((p, i) => map(p, rig.vw[i]));
  const PG = G ? skinGarment(rig, f, G).map((p, i) => map(p, G.vw[i])) : null;
  const J = (bone, s) => map(f[rig.at.get(`${bone}_${s}`)].P, [[rig.at.get(`${bone}_${s}`), 1]]);
  const joints = { elbow: { l: J('lowerarm', 'l'), r: J('lowerarm', 'r') }, wrist: { l: J('hand', 'l'), r: J('hand', 'r') } };
  return { PB, PG, joints };
}
export function proj(p, C, view) {
  const v = C.views[view], a = (v.yaw * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [v.cx + C.s * (c * p[0] + s * p[2]), C.cy - C.s * p[1], -s * p[0] + c * p[2]];
}

/* ---- a rasteriser ---------------------------------------------------------------------------------------------- */
export function canvas(W, H, bg = [0, 0, 0]) {
  const c = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i++) c.set(bg, i * 3);
  return { W, H, z: new Float32Array(W * H).fill(-1e9), c, l: new Uint8Array(W * H) };
}
/** A triangle (points [u, v, depth] in the canvas's pixels) filled where nearer, its colour rgb (0-255) and label. */
export function fillTri(R, a, b, c, rgb, lab = 0) {
  const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(R.W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(R.H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (Math.abs(den) < 1e-9) return;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x + 0.5, py = y + 0.5;
    const w0 = ((b[1] - c[1]) * (px - c[0]) + (c[0] - b[0]) * (py - c[1])) / den, w1 = ((c[1] - a[1]) * (px - c[0]) + (a[0] - c[0]) * (py - c[1])) / den, w2 = 1 - w0 - w1;
    if (w0 < 0 || w1 < 0 || w2 < 0) continue;
    const z = w0 * a[2] + w1 * b[2] + w2 * c[2], i = y * R.W + x;
    if (z <= R.z[i]) continue;
    R.z[i] = z; R.l[i] = lab; R.c[i * 3] = rgb[0]; R.c[i * 3 + 1] = rgb[1]; R.c[i * 3 + 2] = rgb[2];
  }
}
/** Flat shade of a colour (0-1) by a projected triangle's facing: lit from the front, a little from above left. */
export function shadeOf(col, a, b, c) {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  // (screen u right, v down, depth toward the viewer: the normal's toward-viewer part and its up-left part)
  let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  const l = Math.hypot(...n) || 1; n = n.map((x) => x / l);
  if (n[2] < 0) n = n.map((x) => -x);
  const k = 0.42 + 0.48 * n[2] + 0.18 * Math.max(0, -n[1] * 0.8 - n[0] * 0.4);
  return col.map((x) => Math.max(0, Math.min(255, Math.round(x * 255 * k))));
}
export function line(R, a, b, rgb) {
  const n = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))) + 1;
  for (let k = 0; k <= n; k++) {
    const x = Math.round(a[0] + ((b[0] - a[0]) * k) / n), y = Math.round(a[1] + ((b[1] - a[1]) * k) / n);
    if (x >= 0 && y >= 0 && x < R.W && y < R.H) R.c.set(rgb, (y * R.W + x) * 3);
  }
}
/** A sheet crop (its box) at K x into a new canvas. */
export function sheetCanvas(tmp, box) {
  const S = sheetRGB(tmp), W = (box[2] - box[0]) * K, H = (box[3] - box[1]) * K, R = canvas(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = ((box[1] + Math.floor(y / K)) * S.W + box[0] + Math.floor(x / K)) * 3; R.c[(y * W + x) * 3] = S.px[i]; R.c[(y * W + x) * 3 + 1] = S.px[i + 1]; R.c[(y * W + x) * 3 + 2] = S.px[i + 2]; }
  return R;
}
/**
 * Canvases laid out in a grid and written as a PNG (by python): rows of { R, label }; texts [[x, y, text, rgb]].
 */
export function savePNG(file, rows, { title = '', texts = [] } = {}) {
  const top = title ? 22 : 0, lab = 16;
  const W = Math.max(...rows.map((r) => r.reduce((s, c) => s + c.R.W, 0))), H = top + rows.reduce((s, r) => s + lab + Math.max(...r.map((c) => c.R.H)), 0);
  const out = new Uint8Array(W * H * 3).fill(28), T = [...texts];
  if (title) T.push([6, 4, title, [240, 225, 205]]);
  let y = top;
  for (const r of rows) {
    let x = 0;
    for (const c of r) {
      if (c.label) T.push([x + 4, y + 1, c.label, [230, 215, 190]]);
      for (let yy = 0; yy < c.R.H; yy++) out.set(c.R.c.subarray(yy * c.R.W * 3, (yy + 1) * c.R.W * 3), ((y + lab + yy) * W + x) * 3);
      x += c.R.W;
    }
    y += lab + Math.max(...r.map((c) => c.R.H));
  }
  const raw = file + '.rgb';
  writeFileSync(raw, out);
  writeFileSync(raw + '.json', JSON.stringify({ W, H, texts: T }));
  execFileSync('python3', ['-c', `
import sys, json, os
from PIL import Image, ImageDraw
m = json.load(open(sys.argv[2])); im = Image.frombytes('RGB', (m['W'], m['H']), open(sys.argv[1], 'rb').read()); d = ImageDraw.Draw(im)
for x, y, t, c in m['texts']: d.text((x, y), t, fill=tuple(c))
im.save(sys.argv[3]); os.remove(sys.argv[1]); os.remove(sys.argv[2])
`, raw, raw + '.json', file]);
}
export const loadCams = () => JSON.parse(readFileSync(CAMS_FILE, 'utf8'));
export const mkdir = (d) => { mkdirSync(d, { recursive: true }); return d; };
