// The reference sheet's creases (the dark grooves between the swept-back hair's tufts, found by
// tools/sculpt/lowhairsheet.py in tools/sculpt/hairs/<style>-sheet.json) lifted onto the carved hull
// (tools/sculpt/lowhairhull.mjs): each crease pixel to the hull's front-most surface under it in its view. Writes
// tools/sculpt/hairs/<style>-creases3d.json: { view: [[x, y, z, depth, facing, sheet x, sheet y], ...] } (facing: the
// hull's normal against the view's direction there), for the scalp map (tools/sculpt/lowhairmap.py).
//
//   node tools/sculpt/lowhairtrace.mjs [--style swept]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { carve, hullSurface, raster, bodyTris, CAMS, VIEWS, PIV, toViewer } from './lowhairhull.mjs';
import { sub, unit, cross, dot } from './lowrig.mjs';

const DIR = new URL('.', import.meta.url).pathname;
const SPAN = { front: [40, 370], q3: [345, 660], profile: [650, 960], r3: [960, 1260], back: [1260, 1530] };

/** A sheet pixel and its depth under a camera back to the head's space. */
export function unproject(sx, sy, qz, c) {
  const a = (c.yaw * Math.PI) / 180, b = (c.pitch * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  let qx = (sx - c.cx) / c.s, qy = (c.cy - sy) / c.s;
  if (c.roll || c.ax || c.ay || c.sh) {
    // (project's correction undone: the shear and stretch, then the roll)
    const ry = qy / (c.ay ?? 1), rx = qx / (c.ax ?? 1) - (c.sh ?? 0) * ry, r = ((c.roll ?? 0) * Math.PI) / 180, cr = Math.cos(r), sr = Math.sin(r);
    qx = cr * rx + sr * ry; qy = -sr * rx + cr * ry;
  }
  return [PIV[0] + qx * ca + qy * sb * sa - qz * cb * sa, PIV[1] + qy * cb + qz * sb, PIV[2] + qx * sa - qy * sb * ca + qz * cb * ca];
}

export function lift(style = 'swept', H = carve(style)) {
  const sheet = JSON.parse(readFileSync(join(DIR, `hairs/${style}-sheet.json`), 'utf8')), pts = sheet.creases;
  const S = hullSurface(H, H.rig, 2), hair = S.tris.map(([a, b, c]) => [S.verts[a], S.verts[b], S.verts[c]]), body = bodyTris(H.rig.B);
  const nrm = hair.map(([a, b, c]) => { const n = unit(cross(sub(b, a), sub(c, a))); return dot(n, sub(a, H.C)) < 0 ? n.map((x) => -x) : n; });
  const W = 1536, Hh = 430, out = {};
  for (const v of VIEWS) {
    const c = CAMS[v], Z = new Float32Array(W * Hh).fill(-Infinity), id = new Int32Array(W * Hh), view = toViewer(c);
    raster(body, c, Z, W, Hh, id, -1);
    hair.forEach((t, k) => raster([t], c, Z, W, Hh, id, k + 1));
    out[v] = [];
    for (const [x, y, depth] of pts) {
      if (x < SPAN[v][0] || x >= SPAN[v][1]) continue;
      const i = y * W + x;
      if (id[i] < 1) continue;
      const p = unproject(x + 0.5, y + 0.5, Z[i], c);
      // (how squarely the hull faces the view there: a crease seen at a slant is placed less surely)
      out[v].push([...p.map((q) => +q.toFixed(4)), depth, +dot(nrm[id[i] - 1], view).toFixed(2), x, y]);
    }
    // the hair's lower edge (the sheet's, tools/sculpt/lowhairsheet.py) on whatever is in front there, the hull or the skin
    out['edge-' + v] = (sheet.edge[v] ?? []).map(([x, y]) => {
      const X = Math.floor(x), Y = Math.min(Hh - 1, Math.floor(y)), i = Y * W + X;
      return Z[i] > -Infinity ? unproject(X + 0.5, Y + 0.5, Z[i], c).map((q) => +q.toFixed(4)) : null;
    }).filter(Boolean);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const style = opt('style', 'swept'), out = lift(style);
  writeFileSync(join(DIR, `hairs/${style}-creases3d.json`), JSON.stringify(out));
  console.log('crease points lifted per view', Object.fromEntries(Object.entries(out).map(([v, l]) => [v, l.length])), 'centre', JSON.stringify(carve(style).C));
}
