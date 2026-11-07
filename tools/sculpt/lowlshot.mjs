// The low-poly pelvis and legs' sheet (tools/sculpt/LEGS_SPEC.md, LEGS_SPEC_FEMALE.md): the mesh from
// tools/sculpt/lowlegs.mjs drawn through each view's camera fitted to its reference (tools/sculpt/lowlcams.json), on a
// page the size of the reference sheet, the views where the reference has them: the top row (the torso's hips above them,
// cut at the belt's top), the leg planes front and back in their regions, the topology panel's five wireframes; and the
// whole body (head, torso, legs; the arms are another piece) on a page the size of the full-body reference.
//
//   node tools/sculpt/lowlshot.mjs --who male|female --out /some/dir [--ref /tmp/lref-male.json]
//
// writes <dir>/sheet-legs-<who>.png and <dir>/body-<who>.png; with --ref (tools/sculpt/lowlmask.py's views), each view's
// polygon ids over its box, <dir>/ids-legs-<who>.bin (+ .json: the boxes and the polygons' names), for the shape-only
// comparison (tools/sculpt/lowlshape.py). Software rasterised, two samples a pixel each way; flat shading, one normal a
// polygon, never smoothed across an edge, with the soft gradient over each face toward the key light; the light is the
// heads' shared light (tools/sculpt/lowlight-<who>.json), fixed to the camera. Shape is what is scored, not the light.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { buildLowLegs, buildLowLower } from './lowlegs.mjs';
import { buildLowBody } from './lowtorso.mjs';
import { rotation } from './lowcam.mjs';
import { loadLegCams, projectL, PIVOT } from './lowlcam.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i < 0 ? d : args[i + 1]; };
const who = opt('who', 'male');
const out = resolve(opt('out', 'tmp/lowlegs'));
mkdirSync(out, { recursive: true });
const female = who === 'female';
const PIV = PIVOT[who];
const { sy: SY, cams } = loadLegCams(who);
const legs = buildLowLegs(who);
const lower = buildLowLower(who, legs);
console.log(who, 'legs triangles', legs.tris.length, JSON.stringify(legs.counts));

/* ---- a mesh's drawable polygons: the vertices, one normal each (Newell, outward) ---- */
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
function polysOf(m, keep = () => true) {
  return m.polys.filter(keep).map((p) => {
    const pts = p.v.map((i) => m.verts[i]);
    let n = [0, 0, 0];
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; n = [n[0] + (a[1] - b[1]) * (a[2] + b[2]), n[1] + (a[2] - b[2]) * (a[0] + b[0]), n[2] + (a[0] - b[0]) * (a[1] + b[1])]; }
    const l = Math.hypot(...n) || 1;
    return { pts, n: n.map((x) => x / l), c: pts.reduce((a, q) => add(a, q), [0, 0, 0]).map((x) => x / pts.length), region: p.region, mat: p.mat, name: p.name, part: p.part };
  });
}
// the polygon's own triangles, as the mesh's
function polyTris(m, keep = () => true) {
  const P = polysOf(m, keep), idx = new Map(); let k = 0;
  m.polys.forEach((p, i) => { if (keep(p)) idx.set(i, k++); });
  return { P, T: m.tris.filter((t) => idx.has(t.poly)).map((t) => ({ pts: t.v.map((i) => m.verts[i]), poly: idx.get(t.poly) })) };
}

/* ---- the light: the heads' fitted spherical harmonics over the facet's normal in view space ---- */
const LIGHT = JSON.parse(readFileSync(new URL(`./lowlight-${who}.json`, import.meta.url), 'utf8'));
const SHC = LIGHT.global;
function light(nv) {
  const [x, y, z] = nv, nb = [-0.95, 0.25, -0.2], l = Math.hypot(...nb);
  const B = [1, x, y, z, x * y, y * z, 3 * z * z - 1, x * z, x * x - y * y, y * (3 * x * x - y * y), x * y * z, y * (5 * z * z - 1), z * (5 * z * z - 3), x * (5 * z * z - 1), z * (x * x - y * y), x * (x * x - 3 * y * y),
    Math.pow(Math.max(0, (x * nb[0] + y * nb[1] + z * nb[2]) / l), 8), Math.max(-x, 0) * Math.pow(1 - Math.max(z, 0), 3), Math.max(x, 0) * Math.pow(1 - Math.max(z, 0), 3)];
  return [0, 1, 2].map((ch) => B.reduce((s, b, k) => s + b * SHC[ch][k], 0));
}
const GRAD = female ? 0.05 : -0.05;
const CAP = [139, 100, 84];
const REGION_COL = { pelvis: [158, 154, 154], thigh: [232, 196, 156], knee: [222, 168, 132], calf: [204, 150, 140], foot: [190, 136, 128], shoulder: [158, 154, 154], chest: [158, 154, 154], abdomen: [158, 154, 154] };

/* ---- the page ---- */
function page(W, H, bg) {
  const S = 2, w = W * S, h = H * S;
  const col = new Float32Array(w * h * 3), z = new Float32Array(w * h).fill(-1e9);
  for (let k = 0; k < w * h; k++) col.set(bg, k * 3);
  return { W, H, S, w, h, col, z, ids: new Map() };
}
/** One view: the polygons through cam (sy the vertical scale), the pixels above clipY in world y left out; mode 'shade',
 * 'planes' (the regions' colours) ; wire: the polygons' edges drawn over, where seen; ids: a box to record polygon ids in. */
function view(pg, mesh, cam, { sy = SY, piv = PIV, mode = 'shade', wire = false, clipY = 99, keep, idsKey = null, box = null } = {}) {
  const { P, T } = polyTris(mesh, keep);
  const R = rotation(cam), S = pg.S;
  const rot = (v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];
  const cen = rot([0, PIV[1] + 0.0 - piv[1], 0]);
  const colours = P.map((p) => {
    let nv = rot(p.n);
    if (mode === 'planes') { const base = REGION_COL[p.region] ?? [180, 140, 130]; const l = 0.82 + 0.18 * Math.max(0, (-0.4 * nv[0] + 0.5 * nv[1] + 0.8 * nv[2]) / 1.02); return () => base.map((c) => c * l); }
    const L = light(nv);
    const Lg = [0.45, 0.55, 0.7].map((x) => x / Math.hypot(0.45, 0.55, 0.7));
    const dn = Lg[0] * nv[0] + Lg[1] * nv[1] + Lg[2] * nv[2], tg = Lg.map((x, i) => x - nv[i] * dn);
    return (q) => { const d = [q[0] - cen[0], q[1] - cen[1], q[2] - cen[2]]; const g = 1 + GRAD * (d[0] * tg[0] + d[1] * tg[1] + d[2] * tg[2]); return L.map((c) => Math.max(0, c) * g); };
  });
  const facing = P.map((p) => rot(p.n)[2] > 0);
  let idbuf = null;
  if (idsKey && box) { idbuf = new Int32Array((box[2] - box[0]) * (box[3] - box[1])).fill(-1); pg.ids.set(idsKey, { box, buf: idbuf, names: P.map((p) => p.name) }); }
  const zid = new Float32Array(idbuf ? idbuf.length : 0).fill(-1e9);
  for (const t of T) {
    const pr = t.pts.map((q) => projectL(q, cam, sy, piv));
    const vq = t.pts.map((q) => rot([q[0] - piv[0], q[1] - piv[1], q[2] - piv[2]]));
    const sp = pr.map((p) => [p[0] * S, p[1] * S]);
    const area = (sp[1][0] - sp[0][0]) * (sp[2][1] - sp[0][1]) - (sp[1][1] - sp[0][1]) * (sp[2][0] - sp[0][0]);
    if (Math.abs(area) < 1e-9) continue;
    const minx = Math.max(0, Math.floor(Math.min(...sp.map((p) => p[0])))), maxx = Math.min(pg.w - 1, Math.ceil(Math.max(...sp.map((p) => p[0]))));
    const miny = Math.max(0, Math.floor(Math.min(...sp.map((p) => p[1])))), maxy = Math.min(pg.h - 1, Math.ceil(Math.max(...sp.map((p) => p[1]))));
    const shade = colours[t.poly];
    for (let j = miny; j <= maxy; j++) for (let i = minx; i <= maxx; i++) {
      const x = i + 0.5, y = j + 0.5;
      const b0 = ((sp[1][0] - x) * (sp[2][1] - y) - (sp[1][1] - y) * (sp[2][0] - x)) / area;
      const b1 = ((sp[2][0] - x) * (sp[0][1] - y) - (sp[2][1] - y) * (sp[0][0] - x)) / area;
      const b2 = 1 - b0 - b1;
      if (b0 < 0 || b1 < 0 || b2 < 0) continue;
      const wy = b0 * t.pts[0][1] + b1 * t.pts[1][1] + b2 * t.pts[2][1];
      if (wy > clipY) continue;
      const zz = b0 * pr[0][2] + b1 * pr[1][2] + b2 * pr[2][2];
      const k = j * pg.w + i;
      if (zz > pg.z[k]) {
        pg.z[k] = zz;
        const q = [0, 1, 2].map((c) => b0 * vq[0][c] + b1 * vq[1][c] + b2 * vq[2][c]);
        // a facet seen from behind is the inside, seen through the cut at clipY: a flat cap
        pg.col.set(facing[t.poly] ? shade(q) : CAP, k * 3);
      }
      if (idbuf) {
        const bx = Math.floor(i / S) - box[0], by = Math.floor(j / S) - box[1];
        if (bx >= 0 && by >= 0 && bx < box[2] - box[0] && by < box[3] - box[1] && (i % S === 0) && (j % S === 0)) {
          const kk = by * (box[2] - box[0]) + bx;
          if (zz > zid[kk]) { zid[kk] = zz; idbuf[kk] = t.poly; }
        }
      }
    }
  }
  if (wire) {
    const seen = new Set();
    for (const p of P) for (let a = 0; a < p.pts.length; a++) {
      const A = p.pts[a], B = p.pts[(a + 1) % p.pts.length];
      const key = [A, B].map((q) => q.map((x) => x.toFixed(4)).join(',')).sort().join('|');
      if (seen.has(key) || (A[1] > clipY && B[1] > clipY)) continue;
      seen.add(key);
      const pa = projectL(A, cam, sy, piv), pb = projectL(B, cam, sy, piv);
      const n = Math.ceil(Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) * S * 2) + 1;
      for (let s = 0; s <= n; s++) {
        const t = s / n, x = (pa[0] + (pb[0] - pa[0]) * t) * S, y = (pa[1] + (pb[1] - pa[1]) * t) * S, zz = pa[2] + (pb[2] - pa[2]) * t;
        if (A[1] + (B[1] - A[1]) * t > clipY) continue;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          const i = Math.round(x) + dx, j = Math.round(y) + dy;
          if (i < 0 || j < 0 || i >= pg.w || j >= pg.h) continue;
          const k = j * pg.w + i;
          if (zz >= pg.z[k] - 0.03) pg.col.set(mode === 'planes' ? [118, 88, 84] : [252, 238, 222], k * 3);
        }
      }
    }
  }
}
// labels: a tiny 5x7 font is not worth it; the sheet carries its views only, the comparison sheets name them
function png(pg, file) {
  const { W, H, S, w } = pg, raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0;
    for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
      let s = 0; for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) s += pg.col[((y * S + b) * w + x * S + a) * 3 + c];
      raw[y * (W * 3 + 1) + 1 + x * 3 + c] = Math.max(0, Math.min(255, Math.round(s / (S * S))));
    }
  }
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  console.log('wrote', file);
}

const REF = opt('ref', '') ? JSON.parse(readFileSync(opt('ref'), 'utf8')).views : {};
const boxOf = (v) => REF[v]?.box ?? null;
// the sheet: the torso's hips above the legs, cut at the belt's top (the leg sheet's top), as the references' views start
const [SW, SH] = female ? [1448, 1086] : [1536, 1024];
const sheet = page(SW, SH, [51, 39, 44]);
const beltTop = female ? -3.6 : -3.62;
const torsoKeep = (p) => p.part !== 'neck';
for (const v of ['front', 'q3', 'profile', 'r3', 'back']) view(sheet, lower, cams[v], { clipY: beltTop, keep: torsoKeep, idsKey: v, box: boxOf(v) });
for (const v of ['tfront', 'tq3', 'tprofile', 'tr3', 'tback']) view(sheet, lower, cams[v], { clipY: beltTop, keep: torsoKeep, wire: true, idsKey: v, box: boxOf(v) });
// the leg planes, front and back, where the reference has its panel
// (one leg and its half of the pelvis, as the panel draws it, turned in the picture's plane so the leg stands straight
// as the panel's does: about the thigh's top, by the angle from the thigh's top to the ankle; placed by hand, the panel's
// own proportions: sy)
const half = (p) => p.name.endsWith(':L');
const ringC = (names) => names.map((n) => legs.V[n]).reduce((a, q) => [a[0] + q[0] / names.length, a[1] + q[1] / names.length], [0, 0]);
const hip = ringC(Array.from({ length: 8 }, (_, j) => `th${j}`)), ank = ringC(Array.from({ length: 6 }, (_, j) => `an${j}`));
const th = Math.atan2(ank[0] - hip[0], hip[1] - ank[1]), ct = Math.cos(th), st = Math.sin(th);
const straight = { ...legs, verts: legs.verts.map(([x, y, z]) => { const dx = x - hip[0], dy = y - hip[1]; return [hip[0] + ct * dx + st * dy, hip[1] - st * dx + ct * dy, z]; }) };
const PL = female ? { s: 55, sy: 0.52, cy: 592, at: [[1191, 0], [1399, 180]] } : { s: 52, sy: 0.63, cy: 586, at: [[1258, 0], [1469, 180]] };
for (const [cx, yaw] of PL.at) view(sheet, straight, { yaw, pitch: 0, s: PL.s, cx, cy: PL.cy }, { sy: PL.sy, mode: 'planes', keep: half, wire: true });
png(sheet, join(out, `sheet-legs-${who}.png`));

// the whole body at the full-body reference's size, through the body view's camera: head, torso and legs
const body = buildLowBody(who);
const bodyPg = page(887, 1774, [61, 47, 53]);
view(bodyPg, body, cams.body, { sy: 1 });
view(bodyPg, legs, cams.body, { sy: 1, idsKey: 'body', box: boxOf('body') ? [Math.floor(boxOf('body')[0]), boxOf('body')[1], boxOf('body')[2], boxOf('body')[3]] : null });
png(bodyPg, join(out, `body-${who}.png`));

if (opt('ref', '')) {
  // the body's ids are only the legs' own; mark the torso's pixels too from its own pass so the comparison sees the hips
  const meta = {}, bufs = [];
  let off = 0;
  for (const [k, { box, buf, names }] of sheet.ids) { meta[k] = { box, off, names }; bufs.push(Buffer.from(buf.buffer)); off += buf.length; }
  for (const [k, { box, buf, names }] of bodyPg.ids) { meta[k] = { box, off, names }; bufs.push(Buffer.from(buf.buffer)); off += buf.length; }
  writeFileSync(join(out, `ids-legs-${who}.bin`), Buffer.concat(bufs));
  writeFileSync(join(out, `ids-legs-${who}.json`), JSON.stringify(meta));
}
