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
/** Catmull-Rom through points, at u in [0, 1] over the whole run. */
function spline(pts, u) {
  const n = pts.length - 1, x = Math.min(n - 1e-9, Math.max(0, u * n)), i = Math.floor(x), t = x - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  return p1.map((_, c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t * t + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t * t * t));
}
const DEPTH = 0.5, DEPTH0 = DEPTH, INSIDE = 5, BEND = 60, HOME = 25;

/** One heart: centred at c, across U, down T, its face out N, H long and Wd wide (DEPTH of that deep); each vertex's
 * share down the braid s. (at(u, v, w): a corner's point in place of the flat heart's, for one bent onto the crown.) */
export function heartAt(V, poly, c, U, T, N, H, Wd, s, at, depth = DEPTH) {
  const D = Wd * depth, pt = at ?? ((u, v, w) => add(c, add(add(mul(U, u * Wd), mul(T, (v - 0.5) * H)), mul(N, w * D))));
  const rim = OUTLINE.map(([u, v]) => V(pt(u, v, 0.2), s)), side = OUTLINE.map(([u, v]) => V(pt(u * 0.92, 0.05 + v * 0.92, -0.45), s));
  const Lp = V(pt(-0.23, 0.33, 1), s), Rp = V(pt(0.23, 0.33, 1), s), Cn = V(pt(0, 0.2, 0.62), s), Cm = V(pt(0, 0.62, 0.86), s), Bc = V(pt(0, 0.45, -0.95), s);
  const [o0, o1, o2, o3, o4, o5, o6, o7, o8, o9] = rim;
  // the face: each lobe a fan round its peak, the crease down the middle from the notch to the point (darker)
  for (const t of [[o0, o1, Rp], [o1, o2, Rp], [o2, o3, Rp], [o3, o4, Rp], [o4, Cm, Rp], [o0, o9, Lp], [o9, o8, Lp], [o8, o7, Lp], [o7, o6, Lp], [o6, Cm, Lp]]) poly(t, {});
  for (const t of [[o0, Rp, Cn], [Cn, Rp, Cm], [o0, Cn, Lp], [Cn, Cm, Lp], [o4, o5, Cm], [o5, o6, Cm]]) poly(t, { valley: 3 });
  // the side, and the back a fan
  for (let j = 0; j < 10; j++) { const a = rim[j], b = rim[(j + 1) % 10], c2 = side[(j + 1) % 10], d = side[j]; poly([a, b, c2, d], j === 0 || j === 9 ? { valley: 2 } : {}); }
  for (let j = 0; j < 10; j++) poly([side[j], side[(j + 1) % 10], Bc], { valley: 2 });
}

/**
 * The braid's first links (the user's: the braid starts high on the back of the head, its links largest there): hearts
 * along the crown's seam (path: this body's points over the hull, from a point on the part through the chevrons' tips
 * to the seam's end, where the hanging braid's first heart starts), each `links[i]` = [from, to, width px] as shares of
 * the path's length, each tucked under the one above, the last over the hanging braid's first heart. Each lies on the
 * crown: every corner carried out from the skull's centre onto the hull (place(d, w): this body's point on the hull in
 * the direction d, w head units past it), its face out from the skull, `depth` of its width deep, `lift` over the hull.
 * Each its own piece, on the head.
 */
export function addCrownLinks(cl, path, ctx) {
  const { V, poly, piece, place, C, k, sheetScale, names } = ctx;
  const L = [0]; for (let i = 1; i < path.length; i++) L.push(L[i - 1] + Math.hypot(...sub(path[i], path[i - 1])));
  const along = (f) => { const w = Math.min(1, Math.max(0, f)) * L[L.length - 1]; let i = 1; while (i < L.length - 1 && L[i] < w) i++; const g = (w - L[i - 1]) / Math.max(1e-9, L[i] - L[i - 1]); return add(path[i - 1], mul(sub(path[i], path[i - 1]), g)); };
  cl.links.forEach(([f0, f1, wpx], i) => piece(names[i], 'braid', () => {
    const top = along(f0), bot = along(f1), mid = along((f0 + f1) / 2), N = unit(sub(mid, C));
    const T = unit(sub(sub(bot, top), mul(N, dot(sub(bot, top), N)))), U = cross(N, T);
    const H = Math.hypot(...sub(bot, top)) * cl.stretch, Wd = (wpx / sheetScale) * k, D = Wd * cl.depth;
    const c = add(top, mul(sub(bot, top), 0.5));
    heartAt(V, poly, null, U, T, N, H, Wd, 0, (u, v, w) => {
      const q = add(c, add(mul(U, u * Wd), mul(T, (v - 0.5) * H))), d = unit(sub(q, C));
      return place(d, cl.lift * k + (w - cl.sink) * D);
    });
  }));
}

/**
 * The braid added to a mesh being built. ctx: { V(p, s), poly(v, shade), piece(id, kind, fn), toBody(q) (her body's
 * point on this body), k, root (the crown's seam end on this body) }. Each vertex's s (its share down the braid, for
 * its weights) its row's.
 */
export function addBraid(br, spine, ctx) {
  const { V, poly, piece, toBody, k } = ctx;
  const { rows } = spine, P = spine.pts.map(toBody), DEPTH = br.depth ?? DEPTH0;
  // (the spine settled on the body: each point moved square to the spine, across and out (U, N), so that no heart, nor
  // the tie or the tip, has a corner inside the body or within a voxel and a half of its skin, at rest or with the head
  // turned or nodded (INSIDE per corner and pose; ctx.inside(p, s) counts the poses),
  // the spine kept smooth (BEND per square unit of second difference) and near where the sheet puts it (HOME per square
  // unit). Coordinate descent.)
  const settle = () => {
    const P0 = P.map((p) => [...p]), parts = [...br.hearts, br.tie, br.tip];
    const cost = () => {
      let c = 0;
      for (const [top, bot, w] of parts) {
        const mid = (top + bot) / 2, { N, U, T } = frame(mid), cc = at(mid), H = Math.hypot(...sub(at(bot), at(top))) * br.stretch, Wd = scale(w);
        for (const [u, v] of [...OUTLINE, ...[-0.3, 0, 0.3].flatMap((uu) => [0.2, 0.45, 0.7].map((vv) => [uu, vv]))]) for (const ww of [-1.15, -0.5, 0, 0.5, 1]) c += INSIDE * ctx.inside(add(cc, add(add(mul(U, u * Wd), mul(T, (v - 0.5) * H)), mul(N, ww * Wd * DEPTH))), share(mid));
      }
      for (const y of [br.tip[1], br.tip[1] - 8]) c += 4 * INSIDE * ctx.inside(at(y), share(y));
      for (let i = 1; i + 1 < P.length; i++) c += BEND * sub(add(P[i - 1], P[i + 1]), mul(P[i], 2)).reduce((a2, x) => a2 + x * x, 0);
      P.forEach((p, i) => { c += HOME * sub(p, P0[i]).reduce((a2, x) => a2 + x * x, 0); });
      return c;
    };
    let best = cost(); const c0 = best;
    for (const st of [0.4, 0.2, 0.1, 0.05, 0.025, 0.012]) for (let r = 0; r < 8; r++) for (let i = 0; i < P.length; i++) {
      const { N, U } = frame(rows[i]);
      for (const d of [N, U]) for (const sg of [1, -1]) {
        // (the point and its neighbours, by a bell three rows wide either side)
        const was = P.map((p) => p);
        // (the root, on the crown, stays)
        // (and, draped, the first `pin` points after it held too, so the hanging braid stays joined to the crown's link)
        for (let j = br.drape ? 1 + (br.drape.pin ?? 0) : 0; j < P.length; j++) { const g = Math.exp(-(((j - i) / 2) ** 2)); if (g > 0.05) P[j] = add(P[j], mul(d, sg * st * k * g)); }
        const c = cost(); if (c < best) { best = c; } else was.forEach((p, j) => { P[j] = p; });
      }
    }
    if (process.env.BRAID_DEBUG) {
      const by = parts.map(([top, bot, w]) => { const mid = (top + bot) / 2, { N, U, T } = frame(mid), cc = at(mid), H = Math.hypot(...sub(at(bot), at(top))) * br.stretch, Wd = scale(w); let n = 0; for (const [u, v] of OUTLINE) for (const ww of [-1.15, -0.5, 0, 0.5, 1]) n += ctx.inside(add(cc, add(add(mul(U, u * Wd), mul(T, (v - 0.5) * H)), mul(N, ww * Wd * DEPTH))), share(mid)); return n; });
      { const y = br.tip[1], { N, U } = frame(y), p = at(y); console.log('tip end', p.map((x) => x.toFixed(2)), 'N', N.map((x) => x.toFixed(2)), [-0.4, -0.2, 0, 0.2, 0.4, 0.6].map((t) => t + ':' + ctx.inside(add(p, mul(N, t)), share(y)) + '/' + ctx.inside(add(p, mul(U, t)), share(y))).join(' ')); }
      console.log('settle', c0.toFixed(1), '->', best.toFixed(1), 'inside per part', by.join(' '), 'tip', [br.tip[1], br.tip[1] - 8].map((y) => ctx.inside(at(y), share(y))).join(' '));
    }
  };
  // (the spine draped on the body (br.drape): from the root on the crown, first `lead` on along the last crown link's
  // length (ctx.rootDir), down onto the shoulder (her point over it, `shoulder` [x, z], let down until its heart's back, 0.95 of
  // its depth and `gap`, meets the body: ctx.sdf) and over its front down the chest (each `chest` [x, y] brought back
  // from in front of her until it meets it), a curve through them in `n` links, each point then kept that far off the
  // body (ctx.away), smoothed; its rows spread evenly from the root to the tip's)
  if (br.drape && ctx.sdf) {
    const d = br.drape, end = br.tip[1], R = ctx.root;
    const rowOf = (f) => br.root[0] + f * (end - br.root[0]);
    const wAt = (y) => { let w = 0; for (const [t, b, px] of [...br.hearts, br.tie, br.tip]) if (y >= t && y <= b) w = Math.max(w, px); return ((w || br.tip[2]) / ctx.sheetScale) * k; };
    const clearAt = (f) => 0.95 * DEPTH * wAt(rowOf(f)) + d.gap * k;
    const meet = (p, dir, c) => { let q = p; for (let t = 0; t < 400 && ctx.sdf(q) > c; t++) q = add(q, mul(dir, 0.01 * k)); return q; };
    const her = (x, y, z) => ctx.toBody([x, y, z]);
    const S = meet(her(d.shoulder[0], d.shoulder[2], d.shoulder[1]), [0, -1, 0], clearAt(d.at[0]));
    const F = d.chest.map(([x, y], j) => meet(her(x, y, 2), [0, 0, -1], clearAt(d.at[j + 1])));
    // (`neck`: points [x, y, z] behind and beside her neck, each brought in toward the neck's axis until it meets it, so
    // the braid runs down close along the back of the neck from behind the ear to the shoulder)
    const N = (d.neck ?? []).map(([x, y, z], j) => {
      const p = her(x, y, z), ax = her(0, y, 0), c = clearAt(d.neckAt?.[j] ?? d.at[0] * (j + 1) / (d.neck.length + 1));
      let q = meet(p, unit(sub(ax, p)), c);
      // (and out from the axis, by up to `overHair`, until the braid's back is clear of the hair's mass)
      const out = unit(sub(q, ax));
      if (ctx.inHull && d.overHair) for (let t = 0; t < d.overHair * 100 && ctx.inHull(add(q, mul(out, -c))); t++) q = add(q, mul(out, 0.01 * k));
      return q;
    });
    const G = [R, ...(d.lead ? [add(R, mul(ctx.rootDir ?? [0, -1, 0], d.lead * k))] : []), ...N, S, ...F];
    if (process.env.BRAID_DEBUG) { const inv = (q) => q.map((v, i) => ((v - ctx.toBody([0, 0, 0])[i]) / k).toFixed(2)); console.log('guide (her units)', G.map(inv).join(' | ')); }
    const fine = Array.from({ length: 401 }, (_, i) => spline(G, i / 400)), Lf = [0];
    for (let i = 1; i < fine.length; i++) Lf.push(Lf[i - 1] + Math.hypot(...sub(fine[i], fine[i - 1])));
    const X = Array.from({ length: d.n + 1 }, (_, i) => { const w = (Lf[400] * i) / d.n; let j = 1; while (j < 400 && Lf[j] < w) j++; return add(fine[j - 1], mul(sub(fine[j], fine[j - 1]), (w - Lf[j - 1]) / Math.max(1e-9, Lf[j] - Lf[j - 1]))); });
    for (let r = 0; r < 30; r++) {
      for (let i = 1; i <= d.n; i++) { const c = clearAt(i / d.n), sd = ctx.sdf(X[i]); if (sd < c) X[i] = add(X[i], mul(ctx.away(X[i]), c - sd)); }
      for (let i = 2; i < d.n; i++) X[i] = add(mul(X[i], 0.5), mul(add(X[i - 1], X[i + 1]), 0.25));
    }
    P.length = 0; P.push(...X); rows.length = 0; rows.push(...X.map((_, i) => rowOf(i / d.n)));
    if (process.env.BRAID_DEBUG) console.log('drape', X.map((p, i) => `${i}:${p.map((x) => x.toFixed(2)).join(',')} sd ${ctx.sdf(p).toFixed(2)}/${clearAt(i / d.n).toFixed(2)}`).join(' | '));
  }
  const r0 = rows[0], r1 = rows[rows.length - 1], share = (y) => Math.min(1, Math.max(0, (y - br.root[0]) / (r1 - br.root[0])));
  // the spine at a sheet row (linear between the triangulated rows; above the first, toward the root on the crown)
  const at = (y) => {
    if (y <= r0) { const f = (r0 - y) / Math.max(1e-9, r0 - br.root[0]); return add(P[0], mul(sub(ctx.root, P[0]), Math.min(1, f))); }
    let i = 0; while (i + 2 < rows.length && rows[i + 1] < y) i++;
    const f = Math.min(1, (y - rows[i]) / (rows[i + 1] - rows[i])); return add(P[i], mul(sub(P[i + 1], P[i]), f));
  };
  // the frame at a row: down the spine, the face's normal (out from her neck at the root, to the front by the chest;
  // draped, from out of her neck at the root to out from the body under it, a little to the front) square to it, and
  // across
  const frame = (y) => {
    const T = unit(sub(at(y + 4), at(y - 4))), f = Math.min(1, Math.max(0, (y - br.face[0]) / (br.face[1] - br.face[0])));
    let N = br.drape && ctx.away ? unit(add(mul(unit(br.faceFrom), 1 - f), mul(unit(add(ctx.away(at(y)), mul(unit(br.faceTo), br.drape.front))), f))) : unit(add(mul(br.faceFrom, 1 - f), mul(br.faceTo, f)));
    N = unit(sub(N, mul(T, dot(N, T))));
    return { T, N, U: cross(N, T) };
  };
  const scale = (px) => (px / ctx.sheetScale) * k;
  if (ctx.inside) settle();
  br.hearts.forEach(([top, bot, wpx], hi) => piece(`heart${hi + 1 + (ctx.first ?? 0)}`, 'braid', () => {
    const mid = (top + bot) / 2, { T, N, U } = frame(mid), H = Math.hypot(...sub(at(bot), at(top))) * br.stretch;
    heartAt(V, poly, at(mid), U, T, N, H, scale(wpx), share(mid), undefined, DEPTH);
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
