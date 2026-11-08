// The side braid's braid: its spine triangulated from the sheet (each row's middle of the braid in the front and the
// profile, the two views square to each other, solved for the one point both cameras put there; tools/sculpt/hairs/
// braid-cams.json), and on it the segments as the sheet's clump breakdown draws them: hearts, two lobes over a point,
// each tucked under the one above; the tie; the pointed tip.
//
//   spine   her body's points, root (behind her right ear, on the crown's seam) to tip, each with its sheet row
//           (tools/sculpt/hairs/braid-spine.json: { rows, pts }, written by `node tools/sculpt/lowbraidbraid.mjs`).
//   hearts  each a heart by its sheet rows [top, bottom] in the front view (her body's height there) and its width
//           there (sheet px): two lobes, the notch between them, the point under; DEPTH of its width deep, its face to
//           the front (away from her neck at the root, turning to the front by the chest).
//   tie     a band between two rows, its width; tip: a point from the tie's row to the last, its width.
//
//   node tools/sculpt/lowbraidbraid.mjs      # the spine triangulated, written; per row how far the five views' middles are off
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { add, sub, mul, cross, unit, dot } from './lowrig.mjs';
import { project } from './lowhairhull.mjs';

const DIR = new URL('.', import.meta.url).pathname;
const SPANS = { front: [40, 200], q3: [380, 540], profile: [690, 900], r3: [1080, 1245], back: [1380, 1536] };

/** The braid's middle and width in a view's sheet row (its hair pixels within the braid's columns). */
function middleOf(S, v, y) {
  const r = S.hair[y], [a, b] = SPANS[v]; let lo = 1e9, hi = -1;
  for (let k = 0; k < r.length; k += 2) { const x0 = Math.max(a, r[k]), x1 = Math.min(b, r[k + 1]); if (x1 > x0) { lo = Math.min(lo, x0); hi = Math.max(hi, x1); } }
  return hi < 0 ? null : [(lo + hi) / 2, hi - lo];
}

/** The spine: per sheet row from FROM to TO every STEP the point the front's and the profile's cameras both put on the
 * braid's middle there (least squares). */
export function triangulate(FROM = 215, TO = 395, STEP = 10) {
  const C = JSON.parse(readFileSync(join(DIR, 'hairs/braid-cams.json'), 'utf8')), S = JSON.parse(readFileSync(join(DIR, 'hairs/braid-sheet.json'), 'utf8'));
  const rows = [], pts = [], report = [];
  for (let y = FROM; y <= TO; y += STEP) {
    const f = middleOf(S, 'front', y), p = middleOf(S, 'profile', y);
    if (!f || !p) continue;
    const err = (q) => { const a = project(q, C.front), b = project(q, C.profile); return (a[0] - f[0]) ** 2 + (a[1] - y) ** 2 + (b[0] - p[0]) ** 2 + (b[1] - y) ** 2; };
    let X = pts.length ? [...pts[pts.length - 1]] : [-0.6, 0.4, -0.2];
    for (let it = 0; it < 3000; it++) { const e = err(X), g = [0, 1, 2].map((k) => { const q = [...X]; q[k] += 1e-4; return (err(q) - e) / 1e-4; }); X = X.map((x, k) => x - g[k] * 1e-5); }
    rows.push(y); pts.push(X.map((x) => +x.toFixed(4)));
    report.push(`${y}: ` + ['q3', 'r3', 'back'].map((v) => { const m = middleOf(S, v, y); return m ? `${v} ${(project(X, C[v])[0] - m[0]).toFixed(0)}` : `${v} -`; }).join(', '));
  }
  return { rows, pts, report };
}

/** A heart's outline, across (u, her right to her left as seen from the front: -0.5 to 0.5) and down (v: 0 its top, 1 its
 * point): the notch, the right lobe, its side, the point, the left. */
const OUTLINE = [[0, 0.13], [0.24, -0.02], [0.47, 0.18], [0.43, 0.48], [0.22, 0.8], [0, 1], [-0.22, 0.8], [-0.43, 0.48], [-0.47, 0.18], [-0.24, -0.02]];
const DEPTH = 0.42, INSIDE = 5, BEND = 60, HOME = 6;

/**
 * The braid added to a mesh being built. ctx: { V(p, s), poly(v, shade), piece(id, kind, fn), toBody(q) (her body's
 * point on this body), k, root (the crown's seam end on this body) }. Each vertex's s (its share down the braid, for
 * its weights) its row's.
 */
export function addBraid(br, spine, ctx) {
  const { V, poly, piece, toBody, k } = ctx;
  const { rows } = spine, P = spine.pts.map(toBody);
  // (the spine settled on the body: each point moved square to the spine, across and out (U, N), so that no heart, nor
  // the tie or the tip, has a corner inside the body or within a voxel and a half of its skin (INSIDE per corner),
  // the spine kept smooth (BEND per square unit of second difference) and near where the sheet puts it (HOME per square
  // unit). Coordinate descent.)
  const settle = () => {
    const P0 = P.map((p) => [...p]), parts = [...br.hearts, br.tie, br.tip];
    const cost = () => {
      let c = 0;
      for (const [top, bot, w] of parts) {
        const mid = (top + bot) / 2, { N, U, T } = frame(mid), cc = at(mid), H = Math.hypot(...sub(at(bot), at(top))) * br.stretch, Wd = scale(w);
        for (const [u, v] of [...OUTLINE, [0, 0.45], [0, 0.25], [0, 0.7]]) for (const ww of [-1.15, -0.5, 0, 1]) if (ctx.inside(add(cc, add(add(mul(U, u * Wd), mul(T, (v - 0.5) * H)), mul(N, ww * Wd * DEPTH))))) c += INSIDE;
      }
      for (let i = 1; i + 1 < P.length; i++) c += BEND * sub(add(P[i - 1], P[i + 1]), mul(P[i], 2)).reduce((a2, x) => a2 + x * x, 0);
      P.forEach((p, i) => { c += HOME * sub(p, P0[i]).reduce((a2, x) => a2 + x * x, 0); });
      return c;
    };
    let best = cost(); const c0 = best;
    for (const st of [0.1, 0.05, 0.025, 0.012]) for (let r = 0; r < 8; r++) for (let i = 0; i < P.length; i++) {
      const { N, U } = frame(rows[i]);
      for (const d of [N, U]) for (const sg of [1, -1]) {
        // (the point and its neighbours, by a bell three rows wide either side)
        const was = P.map((p) => p);
        for (let j = 0; j < P.length; j++) { const g = Math.exp(-(((j - i) / 2) ** 2)); if (g > 0.05) P[j] = add(P[j], mul(d, sg * st * k * g)); }
        const c = cost(); if (c < best) { best = c; } else was.forEach((p, j) => { P[j] = p; });
      }
    }
    if (process.env.BRAID_DEBUG) console.log('settle', c0.toFixed(1), '->', best.toFixed(1));
  };
  const r0 = rows[0], r1 = rows[rows.length - 1], share = (y) => Math.min(1, Math.max(0, (y - br.root[0]) / (r1 - br.root[0])));
  // the spine at a sheet row (linear between the triangulated rows; above the first, toward the root on the crown)
  const at = (y) => {
    if (y <= r0) { const f = (r0 - y) / Math.max(1e-9, r0 - br.root[0]); return add(P[0], mul(sub(ctx.root, P[0]), Math.min(1, f))); }
    let i = 0; while (i + 2 < rows.length && rows[i + 1] < y) i++;
    const f = Math.min(1, (y - rows[i]) / (rows[i + 1] - rows[i])); return add(P[i], mul(sub(P[i + 1], P[i]), f));
  };
  // the frame at a row: down the spine, the face's normal (out from her neck at the root, to the front by the chest)
  // square to it, and across
  const frame = (y) => {
    const T = unit(sub(at(y + 4), at(y - 4))), f = Math.min(1, Math.max(0, (y - br.face[0]) / (br.face[1] - br.face[0])));
    let N = unit(add(mul(br.faceFrom, 1 - f), mul(br.faceTo, f)));
    N = unit(sub(N, mul(T, dot(N, T))));
    return { T, N, U: cross(N, T) };
  };
  const scale = (px) => (px / ctx.sheetScale) * k;
  if (ctx.inside) settle();
  br.hearts.forEach(([top, bot, wpx], hi) => piece(`heart${hi + 1}`, 'braid', () => {
    const mid = (top + bot) / 2, { T, N, U } = frame(mid), c = at(mid), H = Math.hypot(...sub(at(bot), at(top))) * br.stretch, Wd = scale(wpx), D = Wd * DEPTH;
    const pt = (u, v, w) => add(c, add(add(mul(U, u * Wd), mul(T, (v - 0.5) * H)), mul(N, w * D)));
    const s = share(mid);
    const rim = OUTLINE.map(([u, v]) => V(pt(u, v, 0.2), s)), side = OUTLINE.map(([u, v]) => V(pt(u * 0.92, 0.05 + v * 0.92, -0.45), s));
    const Lp = V(pt(-0.23, 0.33, 1), s), Rp = V(pt(0.23, 0.33, 1), s), Cn = V(pt(0, 0.2, 0.62), s), Cm = V(pt(0, 0.62, 0.86), s), Bc = V(pt(0, 0.45, -0.95), s);
    const [o0, o1, o2, o3, o4, o5, o6, o7, o8, o9] = rim;
    // the face: each lobe a fan round its peak, the crease down the middle from the notch to the point (darker)
    for (const t of [[o0, o1, Rp], [o1, o2, Rp], [o2, o3, Rp], [o3, o4, Rp], [o4, Cm, Rp], [o0, o9, Lp], [o9, o8, Lp], [o8, o7, Lp], [o7, o6, Lp], [o6, Cm, Lp]]) poly(t, {});
    for (const t of [[o0, Rp, Cn], [Cn, Rp, Cm], [o0, Cn, Lp], [Cn, Cm, Lp], [o4, o5, Cm], [o5, o6, Cm]]) poly(t, { valley: 3 });
    // the side, and the back a fan
    for (let j = 0; j < 10; j++) { const a = rim[j], b = rim[(j + 1) % 10], c2 = side[(j + 1) % 10], d = side[j]; poly([a, b, c2, d], j === 0 || j === 9 ? { valley: 2 } : {}); }
    for (let j = 0; j < 10; j++) poly([side[j], side[(j + 1) % 10], Bc], { valley: 2 });
  }));
  // the tie: a hexagonal band; the tip: a six-sided point from under the tie
  const ring = (y, w, d, n = 6, twist = 0) => { const { N, U } = frame(y), c = at(y); return Array.from({ length: n }, (_, j) => { const a = ((j / n) * 360 + twist) * Math.PI / 180; return V(add(c, add(mul(U, Math.cos(a) * scale(w) / 2), mul(N, Math.sin(a) * scale(d) / 2))), share(y)); }); };
  const run = (rings, shade) => {
    for (let i = 0; i + 1 < rings.length; i++) {
      const a = rings[i], b = rings[i + 1], m = Math.max(a.length, b.length);
      for (let j = 0; j < m; j++) poly(a.length === 1 ? [a[0], b[(j + 1) % m], b[j]] : b.length === 1 ? [a[j], a[(j + 1) % m], b[0]] : [a[j], a[(j + 1) % m], b[(j + 1) % m], b[j]], shade(i, j));
    }
  };
  piece('tie', 'tie', () => {
    const [t0, t1, w] = br.tie;
    run([[V(at(t0), share(t0))], ring(t0, w, w * 0.8, 6, 30), ring(t1, w, w * 0.8, 6, 30), [V(at(t1), share(t1))]], () => ({}));
  });
  piece('tip', 'braid', () => {
    const [t0, t1, w] = br.tip, y = (f) => t0 + (t1 - t0) * f;
    run([[V(at(y(0) - 3), share(t0))], ring(y(0.02), w * 0.7, w * 0.6), ring(y(0.32), w, w * 0.8, 6, 30), ring(y(0.68), w * 0.7, w * 0.58), [V(at(t1), 1)]], (i) => (i === 3 ? { valley: 3 } : {}));
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const t = triangulate();
  writeFileSync(join(DIR, 'hairs/braid-spine.json'), JSON.stringify({ rows: t.rows, pts: t.pts }) + '\n');
  console.log(t.report.join('\n'));
}
