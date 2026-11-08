// The side braid's traced lines (tools/sculpt/hairs/braid-traced.json, tools/sculpt/lowbraidtrace.py: each line's runs
// in the views that show it, snapped onto the sheet's creases) lifted onto the carved hull (tools/sculpt/lowbraid.mjs
// carve, on her body): each point's ray from its view's camera into the hull, the first solid voxel it meets, as a
// direction from her skull's centre as scalp-map degrees (mapOfDir), kept where the hull there faces
// the view (its direction against the view's over FACE_MIN). A line's runs joined in their order, each run after the
// first starting after its point nearest the last one's end (where two views overlap). Writes
// tools/sculpt/hairs/braid-lifted.json { line: { pts: [[east, north], ...], runs: { view: [[east, north] | null, ...] } } }.
//
//   node tools/sculpt/lowbraidlift.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sub, mul } from './lowrig.mjs';
import { PIV, toViewer, centreOf } from './lowhairhull.mjs';
import { carve, CAMS } from './lowbraid.mjs';

const DIR = new URL('.', import.meta.url).pathname;
const FACE_MIN = 0.25;

/** A direction's scalp-map degrees [east, north]: its angle from straight up, laid off toward its heading seen from
 * above (east her right, north her face): the map round the crown, with no seam but straight down. */
export function mapOfDir(d) {
  const a = (Math.acos(Math.max(-1, Math.min(1, d[1]))) * 180) / Math.PI, t = Math.atan2(d[0], d[2]);
  return [-a * Math.sin(t), a * Math.cos(t)];
}
/** A map point as a direction from the skull's centre. */
export function dirOfMap([e, n]) {
  const a = (Math.hypot(e, n) * Math.PI) / 180, t = Math.atan2(-e, n);
  return [Math.sin(a) * Math.sin(t), Math.cos(a), Math.sin(a) * Math.cos(t)];
}

/** A sheet pixel and a depth (toward the viewer) back into the head's space under a camera (project undone). */
export function unproject(sx, sy, qz, c) {
  const a = (c.yaw * Math.PI) / 180, b = (c.pitch * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  let qx = (sx - c.cx) / c.s, qy = (c.cy - sy) / c.s;
  if (c.roll || c.ax || c.ay || c.sh) {
    const ry = qy / (c.ay ?? 1), rx = qx / (c.ax ?? 1) - (c.sh ?? 0) * ry, r = ((c.roll ?? 0) * Math.PI) / 180, cr = Math.cos(r), sr = Math.sin(r);
    qx = cr * rx + sr * ry; qy = -sr * rx + cr * ry;
  }
  return [PIV[0] + qx * ca + qy * sb * sa - qz * cb * sa, PIV[1] + qy * cb + qz * sb, PIV[2] + qx * sa - qy * sb * ca + qz * cb * ca];
}

/** The hull's front-most point under a sheet pixel in a view, or null. */
export function hitOf(Hl, c, x, y) {
  const { solid, lo, n: [nx, ny, nz], vox } = Hl;
  for (let z = 2.5; z > -2.5; z -= vox / 3) {
    const p = unproject(x, y, z, c), i = Math.floor((p[0] - lo[0]) / vox), j = Math.floor((p[1] - lo[1]) / vox), k = Math.floor((p[2] - lo[2]) / vox);
    if (i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz && solid[i + nx * (j + ny * k)]) return p;
  }
  return null;
}

export function liftAll(Hl = carve()) {
  const T = JSON.parse(readFileSync(join(DIR, 'hairs/braid-traced.json'), 'utf8')), C = centreOf(Hl.rig.B), out = {};
  for (const [id, views] of Object.entries(T)) {
    const runs = {}, pts = [];
    for (const [v, list] of Object.entries(views)) for (const run of list) {
      const c = CAMS[v], t = toViewer(c);
      const lifted = run.map(([x, y]) => {
        const p = hitOf(Hl, c, x, y); if (!p) return null;
        const d = sub(p, C), l = Math.hypot(...d), u = mul(d, 1 / l);
        return u[0] * t[0] + u[1] * t[1] + u[2] * t[2] < FACE_MIN ? null : mapOfDir(u).map((q) => +q.toFixed(2));
      });
      (runs[v] ??= []).push(lifted);
      let keep = lifted.filter(Boolean);
      if (pts.length && keep.length) {
        const e = pts[pts.length - 1]; let j = 0;
        keep.forEach((p, k) => { if (Math.hypot(p[0] - e[0], p[1] - e[1]) < Math.hypot(keep[j][0] - e[0], keep[j][1] - e[1])) j = k; });
        keep = keep.slice(j + 1);
      }
      pts.push(...keep);
    }
    out[id] = { pts, runs };
  }
  writeFileSync(join(DIR, 'hairs/braid-lifted.json'), JSON.stringify(out));
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now(), L = liftAll();
  for (const [id, l] of Object.entries(L)) console.log(id, l.pts.length, 'points', Object.entries(l.runs).map(([v, r]) => `${v} ${r.flat().filter(Boolean).length}/${r.flat().length}`).join(', '));
  console.log('ms', Date.now() - t0);
}
