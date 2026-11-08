// The swept-back hair's creases, traced on the sheet (tools/sculpt/hairs/swept-lines.json: per crease its points in
// the views that show it best, front to back) and lifted onto the hull (liftLines) as scalp-map degrees (east: toward
// his right, north: toward the face, the distance from the middle the angle from straight up about the skull's
// centre; tools/sculpt/lowhairmap.py draws the map). Each line laid on the hull's outside (the male's skull plus the
// hull's thickness there); each tuft's run (its middle, halfway between its two creases, station by station) beside
// them. Writes
// tools/sculpt/hairs/swept-lines-map.json (each line's map points, for the style, tools/sculpt/hairs/swept.mjs),
// swept-lines3d.json (the lines and the tufts' runs, for the map) and swept-lines2d.json (each line
// projected into the sheet's five views, each point marked seen or hidden behind the hull or the head, for the
// overlays: tools/sculpt/lowhairmap.py --views).
//
//   node tools/sculpt/lowhairlines.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { carve, hullSurface, raster, bodyTris, CAMS, VIEWS, project, toViewer } from './lowhairhull.mjs';
import { add, mul, sub } from './lowrig.mjs';
import { unproject } from './lowhairtrace.mjs';

const DIR = new URL('.', import.meta.url).pathname;

/** A map point (east, north degrees) as a direction from the skull's centre. */
export function dirOfMap([e, n]) {
  const a = (Math.hypot(e, n) * Math.PI) / 180, t = Math.atan2(-e, n);
  return [Math.sin(a) * Math.sin(t), Math.cos(a), Math.sin(a) * Math.cos(t)];
}
/** A direction's (over, out) (tools/sculpt/lowhair.mjs dirOf) from map degrees. */
export function overOutOfMap(p) {
  const d = dirOfMap(p), out = (Math.asin(Math.max(-1, Math.min(1, d[0]))) * 180) / Math.PI;
  let over = (Math.atan2(d[1], d[2]) * 180) / Math.PI; if (over < -60) over += 360;
  return [over, out];
}
/** A polyline of map points resampled to n stations evenly along it (in map degrees). */
export function resample(pts, n) {
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return Array.from({ length: n }, (_, k) => {
    const w = (L[L.length - 1] * k) / (n - 1); let i = 1; while (i < pts.length - 1 && L[i] < w) i++;
    const f = (w - L[i - 1]) / Math.max(1e-9, L[i] - L[i - 1]);
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
  });
}
export const LINES = () => JSON.parse(readFileSync(join(DIR, 'hairs/swept-lines.json'), 'utf8'));

/** A direction's map degrees [east, north]. */
export function mapOfDir(d) {
  const a = (Math.acos(Math.max(-1, Math.min(1, d[1]))) * 180) / Math.PI, t = Math.atan2(d[0], d[2]);
  return [-a * Math.sin(t), a * Math.cos(t)];
}

/**
 * Each crease's map points, lifted from the sheet: its traces (src: [view, [[x, y], ...]] in the order they run, front
 * to back; a border's [view, 'edge', x from, x to]: the hair's lower edge there, tools/sculpt/lowhairsheet.py), each
 * point moved onto the nearest crease pixel within SNAP px and lifted onto the hull's outside there (a border's point,
 * 2 px over the hair's edge, onto the hull's lip there, so the rows keep their order over the skull; onto the skin
 * where the hull falls short) (its front-most surface under the pixel, the male's), as map degrees, where the scalp faces that view
 * (its direction from the skull's centre against the view's over FACE_MIN); the whorl (`from`) before them
 * and the back's centre line (east 0, north `to`) after.
 */
const SNAP = 2, FACE_MIN = 0.4, NEAR = 8;
export function liftLines(H, L) {
  const sheet = JSON.parse(readFileSync(join(DIR, 'hairs/swept-sheet.json'), 'utf8')), W = sheet.w, Hh = sheet.h;
  const strong = new Map(); for (const [x, y, d] of sheet.creases) strong.set(y * W + x, d);
  const S = hullSurface(H, H.rig, 2), hull = S.tris.map(([a, b, c]) => [S.verts[a], S.verts[b], S.verts[c]]), body = bodyTris(H.rig.B);
  const Z = {}, id = {};
  for (const v of VIEWS) { Z[v] = new Float32Array(W * Hh).fill(-Infinity); id[v] = new Uint8Array(W * Hh); raster(body, CAMS[v], Z[v], W, Hh, id[v], 0); raster(hull, CAMS[v], Z[v], W, Hh, id[v], 1); }
  const Zb = {};
  for (const v of VIEWS) { Zb[v] = new Float32Array(W * Hh).fill(-Infinity); raster(body, CAMS[v], Zb[v], W, Hh); }
  const lift = (v, x, y, snap, skin = false) => {
    if (snap) {
      let best = null, bd = -1;
      for (let dy = -SNAP; dy <= SNAP; dy++) for (let dx = -SNAP; dx <= SNAP; dx++) { const d = strong.get((Math.round(y) + dy) * W + Math.round(x) + dx) ?? -1; const w = d - 0.5 * Math.hypot(dx, dy); if (d > 0 && w > bd) { bd = w; best = [Math.round(x) + dx, Math.round(y) + dy]; } }
      if (best) [x, y] = best;
    }
    const X = Math.floor(x), Y = Math.min(Hh - 1, Math.floor(y)), i = Y * W + X;
    const z = (skin ? Zb : Z)[v][i];
    if (!(z > -Infinity)) return null;
    const p = unproject(X + 0.5, Y + 0.5, z, CAMS[v]), d = sub(p, H.C), u = mul(d, 1 / Math.hypot(...d)), t = toViewer(CAMS[v]);
    // (a point the view sees at a slant, the scalp turned away from it, is left to a view that faces it)
    return u[0] * t[0] + u[1] * t[1] + u[2] * t[2] < FACE_MIN ? null : mapOfDir(u);
  };
  for (const ln of L.lines) {
    // each view's run of points in its order; where one view's run takes over from the last's, it starts after its
    // point nearest the last's end (the two overlap at the seam); none within NEAR degrees of the whorl (each runs
    // straight out from it, in their order round it)
    const kept = [ln.from ?? L.whorl];
    for (const [v, a, x0, x1] of ln.src) {
      let run = [];
      if (a === 'edge') {
        const E = sheet.edge[v].filter(([x]) => (x - x0) * (x - x1) <= 0).sort((p, q) => (x1 - x0) * (p[0] - q[0]));
        E.forEach(([x, y], k) => { if (k % 4 === 0 || k === E.length - 1) { const m = lift(v, x, y - 2, false) ?? lift(v, x, y - 1, false, true); if (m) run.push(m); } });
      } else for (const [x, y] of a) { const m = lift(v, x, y, true); if (m) run.push(m); }
      run = run.filter((p) => Math.hypot(p[0] - kept[0][0], p[1] - kept[0][1]) >= NEAR);
      if (kept.length > 1 && run.length) {
        const e = kept[kept.length - 1]; let j = 0;
        run.forEach((p, k) => { if (Math.hypot(p[0] - e[0], p[1] - e[1]) < Math.hypot(run[j][0] - e[0], run[j][1] - e[1])) j = k; });
        run = run.slice(j + 1);
      }
      kept.push(...run);
    }
    kept.push([0, ln.to]);
    const sm = kept.map((p, k) => (k === 0 || k === kept.length - 1 ? p : [0, 1].map((c) => (kept[k - 1][c] + 2 * p[c] + kept[k + 1][c]) / 4)));
    ln.pts = sm.map((p) => p.map((q) => +q.toFixed(1)));
  }
  return L;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const H = carve('swept'), L = liftLines(H, LINES()), C = H.C;
  const on = (p) => { const [o, u] = overOutOfMap(p), d = dirOfMap(p); return add(C, mul(d, H.skull.at(o, u) + H.thick.at(o, u))); };
  const N = 24, out = [];
  const pal = (g, i) => (g === 'right' ? [[255, 150, 120], [255, 200, 90]][i % 2] : g === 'left' ? [[120, 200, 255], [160, 255, 200]][i % 2] : [255, 255, 255]);
  L.lines.forEach((ln, i) => out.push({ id: ln.id, label: ln.id, border: !!ln.border, col: pal(ln.group, i), pts: resample(ln.pts, N).map(on) }));
  // each tuft's run: halfway between its two creases, station by station, front to back
  for (const [a, b, name] of L.tufts) {
    const A = resample(L.lines.find((l) => l.id === a).pts, N), B = resample(L.lines.find((l) => l.id === b).pts, N);
    out.push({ id: name, label: name, arrow: true, col: [255, 255, 255], pts: A.map((p, k) => on([(p[0] + B[k][0]) / 2, (p[1] + B[k][1]) / 2])).slice(1, -1) });
  }
  writeFileSync(join(DIR, 'hairs/swept-lines3d.json'), JSON.stringify(out));
  // the lines' map points, for the style (tools/sculpt/hairs/swept.mjs)
  writeFileSync(join(DIR, 'hairs/swept-lines-map.json'), JSON.stringify(Object.fromEntries(L.lines.map((l) => [l.id, l.pts]))) + '\n');
  // per view: each line's points projected, seen (1) or hidden (0) behind the hull or the head
  const S = hullSurface(H, H.rig, 2), hull = S.tris.map(([a, b, c]) => [S.verts[a], S.verts[b], S.verts[c]]), body = bodyTris(H.rig.B), W = 1536, Hh = 430, two = {};
  for (const v of VIEWS) {
    const c = CAMS[v], Z = new Float32Array(W * Hh).fill(-Infinity);
    raster(body, c, Z, W, Hh); raster(hull, c, Z, W, Hh);
    two[v] = out.map((ln) => ({ id: ln.id, arrow: !!ln.arrow, col: ln.col, pts: ln.pts.map((p) => { const q = project(p, c), X = Math.floor(q[0]), Y = Math.floor(q[1]); const z = X >= 0 && Y >= 0 && X < W && Y < Hh ? Z[Y * W + X] : -Infinity; return [+q[0].toFixed(1), +q[1].toFixed(1), q[2] > z - 0.03 ? 1 : 0]; }) }));
  }
  writeFileSync(join(DIR, 'hairs/swept-lines2d.json'), JSON.stringify(two));
  console.log('lines', L.lines.length, 'tufts', L.tufts.length);
}
