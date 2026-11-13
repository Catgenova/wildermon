// The scale set's shared parts (the scale helm, cuirass & sleeves, leggings and boots: scalehelm.mjs, scalechest.mjs,
// scalelegs.mjs, scaleboots.mjs): its materials and looks, and the scales themselves, laid in courses over a base
// plate (a grid of points, platechest.mjs plateOf, or any shell of triangles).
//
//   scalesOn(G, base, o): courses of faceted scales on the base: each scale a shield (two top corners, its sides, a point
//     at the foot) with a ridge down its middle, stood off the base more at its point than at its top (so each course
//     laps over the top of the one below it), its lower edges turned back toward the base by the scale's thickness (the
//     dark `edge` under each course: the rows stepping down). Every vertex weighted as the base (`wt`).
//   compact(G, keep): the mesh without the polygons `keep` turns down and the vertices left unused.
//
// Units and axes are the body's: y up (the chin's underside 0), z forward, x the body's left.
import { sub, add, mul, dot, cross, unit, orient } from '../lowgarment.mjs';

/** Dragon scale's colour (src/render/figure.ts DRAGON, the flat figure's scale), red, green and blue nought to one. */
export const DRAGON = [98 / 255, 146 / 255, 128 / 255];
/**
 * The materials, shared by name and colour across the scale set, and with the other sets where they are the same colour
 * (the game gives each colour one slot, and has few): scale (a scale's face, the dragon's colour; the game draws it in
 * the set's material, src/sculpt/lowpoly.ts scaleMat), edge (a scale's turned-back edge and the plates' shadow side, as
 * much darker); leather (the bracers, the belt, the boots: the leather shawl's leather), under (the dark leather under
 * the scales, the soles, the insides: the plate set's under-layer), gold (the trim), core (the cores) and rune (the inlay
 * lines), the plate set's.
 */
export const MATS = {
  scale: DRAGON,
  edge: DRAGON.map((x) => x * 0.7),
  leather: [0x6a / 255, 0x39 / 255, 0x2d / 255],
  under: [0.29, 0.22, 0.2],
  gold: [0.96, 0.74, 0.4],
  core: [0.86, 0.62, 0.3],
  rune: [0.96, 0.74, 0.4],
};
/**
 * The two looks (lowgarment.mjs garmentAsset `looks`): plain, all lit as the plate set's (kind 2, by the light's
 * brightness); enchanted, the cores and the runes unlit at the sets' glow (kind 1, #FFE7A6).
 */
const GLOW = [1, 0.906, 0.651];
const KIND = { scale: 2, edge: 2, leather: 2, under: 2, gold: 2, core: 2, rune: 2 };
export const LOOKS = {
  plain: Object.fromEntries(Object.entries(MATS).map(([n, c]) => [n, { c, kind: KIND[n] }])),
  enchanted: Object.fromEntries(Object.entries(MATS).map(([n, c]) => [n, n === 'core' || n === 'rune' ? { c: GLOW, kind: 1 } : { c, kind: KIND[n] }])),
};

/** Where the line o + s d (s > 0) leaves triangles T (each three points): the furthest s, or 0. */
export function rayTris(T, o, d) {
  let best = 0;
  for (const [a, b, c] of T) {
    const e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
    if (Math.abs(det) < 1e-12) continue;
    const f = 1 / det, w = sub(o, a), u = f * dot(w, h);
    if (u < -1e-6 || u > 1 + 1e-6) continue;
    const q = cross(w, e1), v = f * dot(d, q);
    if (v < -1e-6 || u + v > 1 + 1e-6) continue;
    const s = f * dot(e2, q);
    if (s > best) best = s;
  }
  return best;
}
/** A grid of points (rows of points; `ring`, closed round) as triangles. */
export function gridTris(rows, ring) {
  const T = [], n = rows[0].length, C = ring ? n : n - 1;
  for (let r = 0; r + 1 < rows.length; r++) for (let k = 0; k < C; k++) {
    const k1 = (k + 1) % n;
    T.push([rows[r][k], rows[r][k1], rows[r + 1][k1]], [rows[r][k], rows[r + 1][k1], rows[r + 1][k]]);
  }
  return T;
}

/**
 * Courses of scales on a base. The base's surface is found along rays: cast(u, v) gives [origin, direction] for a point u
 * down the courses (a height, or a share along a limb) and v round them (degrees), and the scale's corner lies where that
 * ray leaves the base's triangles (`base.tris`), stood off it along the ray.
 *   o.us: each course's top (u, downward), o.h: a course's height (in u), o.v: [v0, v1] the span round (or o.ring: the
 *   whole way round from v0), o.n: scales a course (in the span: every other course set over by half a scale, one fewer
 *   when the span is open), o.ov: how far a scale's point laps over the course below (a share of h), o.lift: [at its
 *   top, at its point], o.ridge: its middle stood further out, o.thick: its lower edge turned back by this, o.out(p): the
 *   way out from the base at p (to wind the polygons), o.wt: every vertex's weights, o.tag, o.wtOf(u, v): weights per
 *   scale instead, o.skip(u, v): leave a scale out, o.width: a scale's width as a share of its column (1: edge to edge).
 * A scale whose top or sides miss the base is left out; one whose point runs past the base's foot keeps on past it
 * straight (a hem of points). Returns the number laid.
 */
export function scalesOn(G, base, o) {
  // (SCALE_BLOCKOUT: the bases alone, for the blockout's review render)
  if (process.env.SCALE_BLOCKOUT) return 0;
  const T = base.tris, h = o.h, ov = o.ov ?? 0.12, up = o.up ?? 0.8, [l0, l1] = o.lift ?? [0.012, 0.07], ridge = o.ridge ?? 0.025, thick = o.thick ?? 0.035, tag = o.tag ?? 'scales';
  const width = o.width ?? 1;
  const hit = (u, v) => { const [org, d] = o.cast(u, v), s = rayTris(T, org, d); return s > 0 ? { q: add(org, mul(d, s)), d } : null; };
  // (past the base's foot: the last point found on the way down, and on straight from it)
  const hitOn = (u, v, uFrom) => {
    const at = hit(u, v);
    if (at) return at;
    let lo = uFrom, hi = u;
    if (!hit(lo, v)) return null;
    for (let it = 0; it < 18; it++) { const m = (lo + hi) / 2; if (hit(m, v)) lo = m; else hi = m; }
    const a = hit(lo, v), b = hit(lo - h * 0.15, v);
    if (!a || !b) return null;
    const along = unit(sub(a.q, b.q)), dist = Math.hypot(...sub(a.q, b.q)) * (u - lo) / (h * 0.15);
    return { q: add(a.q, mul(along, dist)), d: a.d };
  };
  let laid = 0;
  o.us.forEach((u0, ci) => {
    const odd = (o.stagger ?? true) && ci % 2 === 1;
    // (each scale's span round, [left, right]: with `w`, as many as fit across where this course meets the base (the
    // longest run of v where its top and its sides both find it), else `n` across the span given; every other course
    // set over by half a scale, a half scale at either end of an open span)
    let spans;
    if (o.ring) {
      const step = 360 / o.n, v0 = (o.v?.[0] ?? 0) + (odd ? step / 2 : 0);
      spans = Array.from({ length: o.n }, (_, j) => [v0 + j * step, v0 + (j + 1) * step]);
    } else {
      // (with `w`, every run of v where this course meets the base, each its own span; else the span given, `n` across)
      let runs = [[...o.v, o.n]];
      if (o.w) {
        const [a0, a1] = o.v, uTop = ci === 0 ? u0 : u0 - up * h, uMid = u0 + 0.3 * h, sv = Math.sign(a1 - a0) || 1;
        const found = [];
        let run = null;
        for (let v = a0; sv * (a1 - v) >= -1e-9; v += sv) {
          if (hit(uTop, v) && hit(uMid, v)) run = run ? [run[0], v] : [v, v];
          else { if (run) found.push(run); run = null; }
        }
        if (run) found.push(run);
        runs = found.filter((r) => Math.abs(r[1] - r[0]) >= (o.minRun ?? 6)).map(([b0, b1]) => {
          const v0 = b0 + sv * 0.5, v1 = b1 - sv * 0.5;
          let len = 0, prev = null;
          for (let k = 0; k <= 16; k++) { const at = hit(uMid, v0 + ((v1 - v0) * k) / 16); if (at && prev) len += Math.hypot(...sub(at.q, prev.q)); prev = at ?? prev; }
          return [v0, v1, Math.max(1, Math.round(len / o.w))];
        });
      }
      spans = runs.flatMap(([v0, v1, n]) => {
        const step = (v1 - v0) / n;
        return !odd || n < 2 ? Array.from({ length: n }, (_, j) => [v0 + j * step, v0 + (j + 1) * step])
          : [[v0, v0 + step / 2], ...Array.from({ length: n - 1 }, (_, j) => [v0 + step / 2 + j * step, v0 + step / 2 + (j + 1) * step]), [v1 - step / 2, v1]];
      });
    }
    for (const [va, vb] of spans) {
      const vc = (va + vb) / 2, hw = ((vb - va) / 2) * width;
      if (o.skip?.(u0, vc)) continue;
      // (its top `up` of a course above its course's top, under the points of the course above, so what shows between
      // those points is this course's scales, not the base)
      const top = u0 - up * h, frac = (u) => (u - top) / ((1 + ov) * h + up * h);
      const pt = (u, v, extra = 0, from = null) => {
        const at = from == null ? hit(u, v) : hitOn(u, v, from);
        return at ? { p: add(at.q, mul(at.d, l0 + (l1 - l0) * frac(u) + extra)), d: at.d } : null;
      };
      const t0 = ci === 0 ? u0 : top;
      const TL = pt(t0, vc - hw), Tm = pt(t0, vc), TR = pt(t0, vc + hw);
      // (a rounded shield: its sides down to a quarter of the course, its shoulders in toward the point, the ridge's
      // highest a little under half way)
      const L = pt(u0 + 0.25 * h, vc - hw * 0.98, 0, u0), R = pt(u0 + 0.25 * h, vc + hw * 0.98, 0, u0), M = pt(u0 + 0.45 * h, vc, ridge, u0);
      const LL = pt(u0 + 0.78 * h, vc - hw * 0.66, 0, u0), RR = pt(u0 + 0.78 * h, vc + hw * 0.66, 0, u0);
      const tip = pt(u0 + (1 + ov) * h, vc, ridge * 0.4, u0);
      const all = [TL, Tm, TR, L, R, M, LL, RR, tip];
      if (all.some((x) => !x)) { if (process.env.SCALE_DEBUG) console.log(tag, 'miss', u0.toFixed(2), vc.toFixed(0), all.map((x) => (x ? 1 : 0)).join('')); continue; }
      const wt = o.wtOf ? o.wtOf(u0, vc) : o.wt;
      const V = (p) => { const i = G.vert(p, tag); G.wt[i] = wt; return i; };
      const back = (x, k = 1) => V(sub(x.p, mul(x.d, Math.min(thick * k, l0 + (l1 - l0) * 0.5 - 0.004))));
      const [iTL, iT, iTR, iL, iR, iM, iLL, iRR, iTip] = all.map((x) => V(x.p));
      const eL = back(L, 0.6), eLL = back(LL, 0.9), eTip = back(tip), eRR = back(RR, 0.9), eR = back(R, 0.6);
      G.tag = tag;
      const start = G.polys.length, m = o.mat ?? 'scale';
      G.poly([iTL, iT, iM, iL], m, tag);
      G.poly([iT, iTR, iR, iM], m, tag);
      G.poly([iL, iM, iLL], m, tag);
      G.poly([iM, iR, iRR], m, tag);
      G.poly([iLL, iM, iTip], m, tag);
      G.poly([iM, iRR, iTip], m, tag);
      G.poly([iL, iLL, eLL, eL], 'edge', tag);
      G.poly([iLL, iTip, eTip, eLL], 'edge', tag);
      G.poly([iTip, iRR, eRR, eTip], 'edge', tag);
      G.poly([iRR, iR, eR, eRR], 'edge', tag);
      orient({ verts: G.verts, polys: G.polys.slice(start) }, o.out);
      laid++;
    }
  });
  if (process.env.SCALE_DEBUG) console.log(tag, 'laid', laid, 'of', o.us.length, 'courses x', o.n, 'h', h.toFixed(3), 'v', o.v);
  return laid;
}

/**
 * The mesh without the polygons `keep(poly, index)` turns down, and without the vertices nothing then uses: its per-vertex
 * lists (`lists`, by name on G: part, wt, side, vw) and its triangles (G.tris, when it has them) renumbered.
 */
export function compact(G, keep, lists = ['part', 'wt', 'side', 'vw']) {
  const polyMap = new Map(), polys = [];
  G.polys.forEach((p, k) => { if (keep(p, k)) { polyMap.set(k, polys.length); polys.push(p); } });
  const used = new Map(), verts = [];
  for (const p of polys) for (const i of p.v) if (!used.has(i)) { used.set(i, verts.length); verts.push(G.verts[i]); }
  const old = [...used.keys()];
  for (const n of lists) if (Array.isArray(G[n])) G[n] = old.map((i) => G[n][i]);
  G.verts = verts;
  G.polys = polys.map((p) => ({ ...p, v: p.v.map((i) => used.get(i)) }));
  if (G.tris) G.tris = G.tris.filter((t) => polyMap.has(t.poly)).map((t) => ({ v: t.v.map((i) => used.get(i)), poly: polyMap.get(t.poly) }));
  return { polyMap, vertMap: used };
}

/** Course tops from `from` down to `to` (u growing downward), `h` apart: as many whole courses as fit, spread to fill. */
export function coursesOf(from, to, h) {
  const n = Math.max(1, Math.round((to - from) / h)), step = (to - from) / n;
  return { us: Array.from({ length: n }, (_, k) => from + k * step), h: step };
}

/**
 * The triangles of the polygons from p0 to p1 (G's own, cut as the mesh cuts them) whose material `face` accepts: a
 * base's face as it is drawn, for scalesOn's rays.
 */
export function polyTris(G, p0, p1 = G.polys.length, face = (m) => m !== 'gold') {
  const T = [];
  for (let k = p0; k < p1; k++) {
    const p = G.polys[k];
    if (!face(p.mat)) continue;
    for (let j = 1; j + 1 < p.v.length; j++) T.push([G.verts[p.v[0]], G.verts[p.v[j]], G.verts[p.v[j + 1]]]);
  }
  return T;
}

/**
 * The polygons `last` picks moved after all the others (their triangles renumbered with them): returns where they
 * start, a garment's `dropFrom` (src/sculpt/lowpoly.ts: left out while its GARMENTS entry's `drops` says).
 */
export function toEnd(G, last) {
  const order = [...G.polys.keys()].sort((a, b) => (last(G.polys[a], a) ? 1 : 0) - (last(G.polys[b], b) ? 1 : 0) || a - b);
  const at = new Map(order.map((k, n) => [k, n]));
  const from = order.findIndex((k) => last(G.polys[k], k));
  G.polys = order.map((k) => G.polys[k]);
  if (G.tris) G.tris = G.tris.map((t) => ({ v: t.v, poly: at.get(t.poly) })).sort((a, b) => a.poly - b.poly);
  return from < 0 ? G.polys.length : from;
}
