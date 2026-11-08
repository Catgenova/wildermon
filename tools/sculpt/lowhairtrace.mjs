// The reference sheet's creases (the dark grooves between the swept-back hair's locks, found by
// tools/sculpt/lowhairmask.py in tools/sculpt/hairs/<style>-creases.json) lifted onto the carved hull
// (tools/sculpt/lowhairhull.mjs): each crease pixel to the hull's front-most surface under it in its view, then to its
// direction over the skull (over, out, as tools/sculpt/lowhair.mjs paths are written). The locks' paths are laid along
// them. Writes tools/sculpt/hairs/<style>-creases3d.json: { view: [[over, out, x, y, z], ...] }.
//
//   node tools/sculpt/lowhairtrace.mjs [--style swept]
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { carve, hullSurface, raster, bodyTris, CAMS, VIEWS, PIV, angOf } from './lowhairhull.mjs';
import { sub, unit } from './lowrig.mjs';

const DIR = new URL('.', import.meta.url).pathname;
const SPAN = { front: [40, 370], q3: [345, 660], profile: [650, 960], r3: [960, 1260], back: [1260, 1530] };

/** A sheet pixel and its depth under a camera back to the head's space. */
export function unproject(sx, sy, qz, c) {
  const a = (c.yaw * Math.PI) / 180, b = (c.pitch * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  const qx = (sx - c.cx) / c.s, qy = (c.cy - sy) / c.s;
  return [PIV[0] + qx * ca + qy * sb * sa - qz * cb * sa, PIV[1] + qy * cb + qz * sb, PIV[2] + qx * sa - qy * sb * ca + qz * cb * ca];
}

export function lift(style = 'swept', H = carve(style)) {
  const pts = JSON.parse(readFileSync(join(DIR, `hairs/${style}-creases.json`), 'utf8')).pts;
  const S = hullSurface(H, H.rig, 2), hair = S.tris.map(([a, b, c]) => [S.verts[a], S.verts[b], S.verts[c]]), body = bodyTris(H.rig.B);
  const W = 1536, Hh = 430, out = {};
  for (const v of VIEWS) {
    const c = CAMS[v], Z = new Float32Array(W * Hh).fill(-Infinity), id = new Uint8Array(W * Hh);
    raster(body, c, Z, W, Hh, id, 0);
    raster(hair, c, Z, W, Hh, id, 1);
    out[v] = [];
    for (const [x, y] of pts) {
      if (x < SPAN[v][0] || x >= SPAN[v][1]) continue;
      const i = y * W + x;
      if (id[i] !== 1) continue;
      const p = unproject(x + 0.5, y + 0.5, Z[i], c), [o, u] = angOf(unit(sub(p, H.C)));
      out[v].push([+o.toFixed(1), +u.toFixed(1), ...p.map((q) => +q.toFixed(3))]);
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
  const style = opt('style', 'swept'), out = lift(style);
  writeFileSync(join(DIR, `hairs/${style}-creases3d.json`), JSON.stringify(out));
  console.log('crease points lifted per view', Object.fromEntries(Object.entries(out).map(([v, l]) => [v, l.length])));
}
