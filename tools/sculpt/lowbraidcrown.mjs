// The side braid's crown: its border lines composed from the sheet's traced creases lifted onto the hull
// (tools/sculpt/hairs/braid-lifted.json, tools/sculpt/lowbraidlift.mjs) as the style lays them out
// (tools/sculpt/hairs/braid.mjs crown), and the clumps between them, on any body.
//
//   lines   each border a polyline over the scalp in map degrees (lowbraidlift.mjs mapOfDir: from straight up toward
//           its heading, her face north, her right east), from its anchors (a map point, a lifted line's points
//           (`line:view`: one view's), a point along a border composed before it (`line@u`, u its share of the way), a seam tip `V<k>`: the k-th chevron's tip, where the back's k-th borders of her left and her
//           right meet) through a smooth spline, resampled evenly along it.
//   clumps  each between an inner border (toward the crown) and an outer one, from the fan's point at the front (both
//           borders start there: a point) to the seam (blunt, its end across the seam between two chevrons' tips);
//           its section (SEC) a blade: from the groove at its inner border up a broad facet to a ridge, down a steeper
//           one to the groove at its outer border; its heights a share of the hull's thickness over the skull there (her hull's thickness on
//           this body's skull, scaled by k).
//
//   node tools/sculpt/lowbraidcrown.mjs [--map]      # --map: tools/sculpt/hairs/braid-map.json for lowbraidmap.py
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { add, sub, mul, dot, cross, unit } from './lowrig.mjs';
import { mapOfDir, dirOfMap } from './lowbraidlift.mjs';

const DIR = new URL('.', import.meta.url).pathname;
export const LIFTED = () => JSON.parse(readFileSync(join(DIR, 'hairs/braid-lifted.json'), 'utf8'));

/** A table over the map (east, north within R degrees, every `step`), read back bilinearly. */
export function mapTable(f, step = 2, R = 150) {
  const n = Math.round((2 * R) / step) + 1, T = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) T[i * n + j] = f([-R + i * step, -R + j * step]);
  const at = ([e, nn]) => {
    const x = Math.min(n - 1.001, Math.max(0, (e + R) / step)), y = Math.min(n - 1.001, Math.max(0, (nn + R) / step)), i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const v = (a, b) => T[a * n + b];
    return v(i, j) * (1 - fx) * (1 - fy) + v(i + 1, j) * fx * (1 - fy) + v(i, j + 1) * (1 - fx) * fy + v(i + 1, j + 1) * fx * fy;
  };
  return { T, at };
}

/** The skull's radius from its centre along each map direction (the head's skin, not the ears; the farthest crossing).
 * A direction that misses it (below the skull, into the neck) takes the nearest one above that meets it. */
export function skullMap(B, C) {
  const tris = B.tris.filter((t) => { const p = B.polys[t.poly]; return p.part === 'head' && p.mat === 'skin' && !p.ear; }).map((t) => t.v.map((i) => B.verts[i]));
  const ray = (d) => {
    let best = 0;
    for (const [a, b, c] of tris) {
      const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
      if (Math.abs(det) < 1e-12) continue;
      const s = sub(C, a), u = dot(s, p) / det; if (u < -1e-6 || u > 1 + 1e-6) continue;
      const q = cross(s, e1), v = dot(d, q) / det; if (v < -1e-6 || u + v > 1 + 1e-6) continue;
      const t = dot(e2, q) / det; if (t > best) best = t;
    }
    return best;
  };
  return mapTable((m) => {
    const a = Math.hypot(...m);
    for (let s = 1; s > 0.3; s -= 0.04) { const r = ray(dirOfMap([m[0] * s, m[1] * s])); if (r > 0.3) return r; }
    return ray(dirOfMap(m)) || 1;
  });
}

/** The hull's thickness over the skull along each map direction: from the skin out, the run of solid voxels that
 * starts within 0.1 of it (head units, her body). */
export function thickMap(Hl, C, skull) {
  const { solid, lo, n: [nx, ny, nz], vox } = Hl;
  const at = (p) => { const i = Math.floor((p[0] - lo[0]) / vox), j = Math.floor((p[1] - lo[1]) / vox), k = Math.floor((p[2] - lo[2]) / vox); return i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz && solid[i + nx * (j + ny * k)] === 1; };
  return mapTable((m) => {
    const d = dirOfMap(m), r0 = skull.at(m);
    let first = -1, last = 0;
    for (let t = 0; t < 0.9; t += vox / 3) {
      if (at(add(C, mul(d, r0 + t)))) { if (first < 0) first = t; last = t; } else if (first >= 0 && t - last > 0.05) break;
    }
    return first < 0 || first > 0.1 ? 0 : last;
  });
}

/** Catmull-Rom through points, resampled to n points evenly along its length. */
export function smoothRun(pts, n) {
  const P = pts.length < 2 ? [pts[0], pts[0]] : pts;
  const sp = (u) => {
    const m = P.length - 1, x = Math.min(m - 1e-9, Math.max(0, u * m)), i = Math.floor(x), t = x - i;
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(m, i + 2)];
    return p1.map((_, k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t));
  };
  const F = Array.from({ length: 401 }, (_, i) => sp(i / 400)), L = [0];
  for (let i = 1; i < F.length; i++) L.push(L[i - 1] + Math.hypot(F[i][0] - F[i - 1][0], F[i][1] - F[i - 1][1]));
  return Array.from({ length: n }, (_, k) => {
    const w = (L[400] * k) / (n - 1); let j = 1; while (j < 400 && L[j] < w) j++;
    const f = (w - L[j - 1]) / Math.max(1e-9, L[j] - L[j - 1]);
    return [F[j - 1][0] + (F[j][0] - F[j - 1][0]) * f, F[j - 1][1] + (F[j][1] - F[j - 1][1]) * f];
  });
}

/** A lifted run thinned to a point every `gap` degrees (and smoothed over 5), its two ends kept. */
function thin(pts, gap = 6) {
  if (!pts.length) return [];
  const sm = pts.map((p, i) => { const w = pts.slice(Math.max(0, i - 2), i + 3); return [w.reduce((a, q) => a + q[0], 0) / w.length, w.reduce((a, q) => a + q[1], 0) / w.length]; });
  const out = [sm[0]];
  for (const p of sm.slice(1, -1)) if (Math.hypot(p[0] - out[out.length - 1][0], p[1] - out[out.length - 1][1]) >= gap) out.push(p);
  out.push(sm[sm.length - 1]);
  return out;
}

/** The style's border lines as map polylines, N points each, and the seam's tips. */
export function composeLines(crown, L = LIFTED(), N = 48) {
  const end = (id) => L[id].pts[L[id].pts.length - 1];
  const V = crown.seam.map((pair) => (Array.isArray(pair[0]) || typeof pair[0] === 'number' ? pair : [0, 1].map((c) => pair.reduce((a, id) => a + end(id)[c], 0) / pair.length)));
  const out = {};
  for (const [name, anchors] of Object.entries(crown.lines)) {
    const pts = [];
    for (const a of anchors) {
      if (typeof a === 'string' && /^V\d+$/.test(a)) pts.push(V[+a.slice(1) - 1]);
      else if (typeof a === 'string' && a.includes('@')) {
        // ('line@u': the point a share u along a border composed before it)
        const [id, u] = a.split('@'), P = out[id], x = Math.min(P.length - 1.001, +u * (P.length - 1)), i = Math.floor(x), f = x - i;
        pts.push([P[i][0] + (P[i + 1][0] - P[i][0]) * f, P[i][1] + (P[i + 1][1] - P[i][1]) * f]);
      }
      else if (typeof a === 'string') {
        // ('line:view': that view's runs only)
        const [id, view] = a.split(':');
        let run = thin(view ? L[id].runs[view].flat().filter(Boolean) : L[id].pts);
        // (a run that overlaps what is there already starts after its point nearest the last one)
        if (pts.length) { const e = pts[pts.length - 1]; let j = -1, bd = Infinity; run.forEach((p, k) => { const dd = Math.hypot(p[0] - e[0], p[1] - e[1]); if (dd < bd) { bd = dd; j = k; } }); if (bd < 6) run = run.slice(j + 1); }
        pts.push(...run);
      } else pts.push(a);
    }
    // (points closer than 2 degrees merged)
    const P = [pts[0]]; for (const p of pts.slice(1)) if (Math.hypot(p[0] - P[P.length - 1][0], p[1] - P[P.length - 1][1]) > 2) P.push(p);
    out[name] = smoothRun(P, N);
  }
  return { lines: out, seam: V };
}

/** The clumps' section, inner border (0) to outer (1): [across, height share of the hull's thickness | 'root'] (a root
 * sunk into the scalp). As the sheet draws each blade: a broad upper facet from the groove at its inner border up to a
 * ridge past its middle, at the hull, and a steeper lower facet down to the groove at its outer border, where the next
 * blade's upper facet starts. */
const GROOVE = 0.5, EDGE = 0.12;
export const SEC = [[0.02, 'root'], [0, GROOVE], [0.32, 0.9], [0.62, 1], [1, GROOVE], [0.98, 'root']];
/**
 * The crown's clumps added to a mesh being built: for each clump `n` stations (by its length, every STATION degrees,
 * 5 to 12), the front a point, the back capped. ctx: { V(p, role), poly(v, shade), piece(id, kind, fn), skull, thick,
 * C, k, face(p) (0 the scalp, 1 the face: the roots stand on the skin there) }.
 */
const STATION = 16, OVER = 6, BROW = 0.14, SINK = 0.035, MIN_T = 0.05;
export function addCrown(crown, ctx, lines = composeLines(crown).lines) {
  const { V, poly, piece, skull, thick, C, k, face } = ctx;
  const at = (m, h) => {
    // (over the forehead no thicker than BROW: the sheet's hair meets the brow thin, and her forehead is further back
    // than the sheet's, which left the hull standing off it there)
    const brow = m[1] <= 35 ? Infinity : BROW + (35 - Math.min(60, m[1])) * -0 + (m[1] < 60 ? ((60 - m[1]) / 25) * 0.4 : 0);
    // (and lower under the braid's first links: ctx.dip)
    const d = dirOfMap(m), r0 = skull.at(m), t = Math.max(MIN_T, Math.min(brow, thick.at(m))) * k * (ctx.dip ? ctx.dip(m) : 1);
    if (h === 'root') { const p = add(C, mul(d, r0)); return add(C, mul(d, r0 + (face(p) > 0.5 ? 0.012 * k : -SINK * k))); }
    return add(C, mul(d, r0 + h * t));
  };
  for (const cl of crown.clumps) piece(cl.id, 'clump', () => {
    const A = lines[cl.inner], B = lines[cl.outer], edgeA = crown.edges?.includes(cl.inner), edgeB = crown.edges?.includes(cl.outer);
    const len = A.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - A[i - 1][0], p[1] - A[i - 1][1]) : 0), 0);
    const n = Math.max(5, Math.min(10, Math.round(len / STATION) + 1)), m = SEC.length;
    const As = smoothRun(A, n), Bs = smoothRun(B, n), rings = [];
    // (the back end carried OVER degrees past the seam along each border, so the two sides' ends overlap there)
    for (const S of [As, Bs]) { const a = S[n - 2], b = S[n - 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; S[n - 1] = [b[0] + ((b[0] - a[0]) / l) * OVER, b[1] + ((b[1] - a[1]) / l) * OVER]; }
    const pointed = Math.hypot(As[0][0] - Bs[0][0], As[0][1] - Bs[0][1]) < 3;
    // (a front that is not a point: capped at its middle)
    if (!pointed) rings.push([V(at([(As[0][0] + Bs[0][0]) / 2, (As[0][1] + Bs[0][1]) / 2], 0.35))]);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      if (i === 0 && pointed) { rings.push([V(at(As[0], 0.75))]); continue; }
      // (the heights toward the pointed front a little lower: the clumps' tips lie in the mass)
      const lift = pointed ? 0.7 + 0.3 * Math.min(1, u / 0.3) : 1;
      // (a border on the hairline lies on the skin: the hair's edge, not a groove)
      const hOf = (s, h) => (h === 'root' ? 'root' : h === GROOVE && ((s < 0.5 && edgeA) || (s > 0.5 && edgeB)) ? EDGE : h * lift);
      rings.push(SEC.map(([s, h]) => V(at([As[i][0] + (Bs[i][0] - As[i][0]) * s, As[i][1] + (Bs[i][1] - As[i][1]) * s], hOf(s, h)))));
    }
    // the back end on the seam: capped at its middle, sunk a little
    const e = [(As[n - 1][0] + Bs[n - 1][0]) / 2, (As[n - 1][1] + Bs[n - 1][1]) / 2];
    rings.push([V(at(e, 0.55))]);
    for (let i = 0; i + 1 < rings.length; i++) for (let j = 0; j < m; j++) {
      const a = rings[i], b = rings[i + 1];
      const v = a.length === 1 ? [a[0], b[(j + 1) % m], b[j]] : b.length === 1 ? [a[j], a[(j + 1) % m], b[0]] : [a[j], a[(j + 1) % m], b[(j + 1) % m], b[j]];
      // (the faces from the grooves down to the roots the groove's floor, the darkest)
      poly(v, j === 4 || j === 5 || j === 0 ? { valley: 1 } : {});
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const style = (await import('./hairs/braid.mjs')).default;
  const { lines, seam } = composeLines(style.crown);
  if (process.argv.includes('--map')) {
    const pal = [[255, 150, 120], [255, 200, 90], [255, 120, 200], [200, 255, 120]], pal2 = [[120, 200, 255], [160, 255, 200], [190, 160, 255], [120, 255, 255]];
    const clumps = style.crown.clumps.map((c, i) => ({ id: c.id, col: (c.id.startsWith('R') ? pal : pal2)[i % 4], run: smoothRun(lines[c.inner], 12).map((p, j) => { const q = smoothRun(lines[c.outer], 12)[j]; return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; }) }));
    writeFileSync(join(DIR, 'hairs/braid-map.json'), JSON.stringify({ lines, seam, clumps }));
  }
  console.log(Object.keys(lines).join(' '), 'seam', JSON.stringify(seam.map((p) => p.map((x) => +x.toFixed(1)))));
}
