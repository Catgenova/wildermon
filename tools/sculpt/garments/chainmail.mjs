// The chain set's shared machinery (tools/sculpt/garments/chaincoif.mjs, chainchest.mjs, chainlegs.mjs, chainboots.mjs):
// its materials and looks, and the mail itself.
//
//   mailShell(G, rig, o) lays mail over a region of the body: the body's own triangles (those `keep` takes), cut between
//     the region's hems (`lo` and `hi` of a field over the body, its height by default) and across it into courses of
//     rings, `h` apart on one grid for the whole set, so a course runs on unbroken from piece to piece, and round into
//     links. Each course a ridge: out from the body by the base offset `c` at its top, by `c + d` at its crest (a zigzag
//     up and down each link), by `c + foot d` at its foot, the upper slope in the mail's face (plate), the lower in its
//     shade; under each course's foot a step back to the top of the course below (shade). The free edges turned in
//     toward the body (a lip).
//     Every vertex on the body's surface where it was cut, pushed out along the body's normal there, weighted as the body
//     there (the corners' weights blended along the edge it was cut on), so the mail moves as the skin under it.
//   band(G, rows, ...) a band of rows of points round an axis (ringAt: the body's reach that way and a clearance), its
//     edges turned in (the belt, the garters), weighted by a rule; stud(G, ...) a small raised plate (a buckle, a clasp)
//     with its gem; linksOf(rig, ...) the arc round the trunk's or a limb's axis the links are cut across.
//   coveredPolys(rig, ok) the body's polygons whose corners all pass `ok` (hidden while the piece is worn).
//
// Units and axes are the body's: y up (the chin's underside 0), z forward, x the body's left.
import { meshOf, trisOf, sub, add, mul, dot, cross, unit, lerp, newell } from '../lowgarment.mjs';

/**
 * The set's materials, by name (each piece uses these names and values, so the game gives each one slot, and the ones the
 * plate and leather sets have already take theirs): plate (the mail's face) and shade (its lower slopes and steps), drawn in
 * the metal it is smithed from (src/sculpt/lowpoly.ts PLATE_ROLE); gold (the brass rings at the hems and the buckles: the
 * plate set's gold), under (the padded gambeson where it shows: the plate set's under-layer), leather (straps, belts and
 * soles: the leather set's), core (the buckles' gems: the plate set's), rune (the lines engraved on the belts and the bands:
 * the gold's colour plain, glowing enchanted).
 */
export const MATS = {
  plate: [0.72, 0.74, 0.78],
  shade: [0.6, 0.62, 0.66],
  gold: [0.96, 0.74, 0.4],
  under: [0.29, 0.22, 0.2],
  leather: [0.416, 0.224, 0.176],
  core: [0.86, 0.62, 0.3],
  rune: [0.96, 0.74, 0.4],
};
const GLOWING = [1, 0.906, 0.651];
/** Plain, every material metal-lit (kind 2, as the plate set's); enchanted, the cores and the runes unlit at the glow (kind 1, blooming). */
export const LOOKS = {
  plain: Object.fromEntries(Object.entries(MATS).map(([n, c]) => [n, { c, kind: 2 }])),
  enchanted: { ...Object.fromEntries(Object.entries(MATS).map(([n, c]) => [n, { c, kind: 2 }])), core: { c: GLOWING, kind: 1 }, rune: { c: GLOWING, kind: 1 } },
};

/** A new garment: lowgarment.mjs meshOf with each vertex's weights ({ bone index: weight } over the body's bones). */
export function chainMesh() {
  const G = meshOf();
  G.w = [];
  G.add = (p, w, part) => { const i = G.vert(p, part); G.w[i] = w; return i; };
  return G;
}

/** The body's vertex normals (area-weighted), once per body. */
const NORMALS = new WeakMap();
export function normalsOf(B) {
  let N = NORMALS.get(B);
  if (N) return N;
  N = B.verts.map(() => [0, 0, 0]);
  for (const t of B.tris) { const [a, b, c] = t.v.map((i) => B.verts[i]), n = cross(sub(b, a), sub(c, a)); for (const i of t.v) N[i] = add(N[i], n); }
  N = N.map(unit);
  NORMALS.set(B, N);
  return N;
}
/** A body vertex's weights as { bone: w }. */
const wOf = (rig, i) => Object.fromEntries(rig.vw[i].map(([b, w]) => [b, w]));
/** Weights blended: (1 - t) a + t b. */
export const blendW = (a, b, t) => { const o = {}; for (const [k, w] of Object.entries(a)) o[k] = (o[k] ?? 0) + w * (1 - t); for (const [k, w] of Object.entries(b)) o[k] = (o[k] ?? 0) + w * t; return o; };
/** Weights by bone name ({ name: w }) as the mesh keeps them (bone index). */
export const named = (rig, w) => Object.fromEntries(Object.entries(w).map(([n, x]) => { const b = rig.at.get(n); if (b === undefined) throw new Error(`no bone ${n}`); return [b, x]; }));

/**
 * Mail over a region of the body (see the head). o: {
 *   keep(t): whether a body triangle is in the region; lo(t), hi(t): its hems, in the field (Infinity: none);
 *   field(p): the field the courses run across (the height, y, by default); h: the courses' spacing; crest, foot: the
 *   crest's place up a course and the foot's offset as a share of d; c(i, p): the base offset at a body point (its nearest
 *   corner i); d: the ridge's height; tag; mat(f, up, t, k): a piece's material at field f (its upper slope or not) on
 *   body triangle t in course k (its foot at k h), by default plate up, shade down; lip: the offset the free edges turn in to, lipMat;
 *   links: { around(p, i) → [the arc round the region's axis at a body point (its corner i), the arc once round there], w
 *   (a link's width), edge and centre (the crest's place up the course at a link's edges and at its middle) }: each
 *   course cut across into half links, every other course's half a link round, its crest a zigzag (high at a link's
 *   edges, low at its middle), so each link's upper slope is a tongue down into the course's shade and the courses read
 *   as rows of rings; each half link's upper and lower slope merged into one facet where the body's triangles cut it
 *   (a convex outline kept at its corners); normal(q): the way out at a point, the body's normal by default;
 *   edges(a, b, va, vb, out): the free edges given to the caller in place of the lips;
 * }. Returns { covered(i, m) (whether a body vertex is wholly under it, m inside its hems), faces, verts (its vertices) }.
 */
export function mailShell(G, rig, o) {
  const { B } = rig, N = normalsOf(B);
  const field = o.field ?? ((p) => p[1]), h = o.h, crest = o.crest ?? 0.45, foot = o.foot ?? 0.5, d = o.d;
  const tag = o.tag, mat = o.mat ?? ((f, up) => (up ? 'plate' : 'shade')), L = o.links;
  const F = B.verts.map((p) => field(p)), Gc = L ? B.verts.map((p, i) => L.around(p, i)) : null;
  const r6 = (x) => Math.round(x * 1e6);
  // a point on a body triangle by its barycentric weights: its key (a corner, a place on an edge, or inside), position,
  // normal, weights, field and arc (the triangle's corners' arcs unwrapped round it)
  const pointOf = (T, bc) => {
    const nz = [0, 1, 2].filter((k) => bc[k] > 1e-7), v = T.t.v;
    let key;
    if (nz.length === 1) key = `v${v[nz[0]]}`;
    else if (nz.length === 2) { const [x, y] = nz, [i, j] = v[x] < v[y] ? [x, y] : [y, x]; key = `e${v[i]}:${v[j]}:${r6(bc[j] / (bc[i] + bc[j]))}`; }
    else key = `t${T.ti}:${r6(bc[0])}:${r6(bc[1])}`;
    const sum3 = (A) => [0, 1, 2].reduce((s, k) => add(s, mul(A[v[k]], bc[k])), [0, 0, 0]);
    const w = {};
    for (let k = 0; k < 3; k++) if (bc[k] > 0) for (const [b, x] of rig.vw[v[k]]) w[b] = (w[b] ?? 0) + x * bc[k];
    const best = [0, 1, 2].reduce((m, k) => (bc[k] > bc[m] ? k : m), 0);
    return { key, bc, p: sum3(B.verts), n: unit(sum3(N)), w, f: bc[0] * F[v[0]] + bc[1] * F[v[1]] + bc[2] * F[v[2]], g: T.g ? bc[0] * T.g[0] + bc[1] * T.g[1] + bc[2] * T.g[2] : 0, i: v[best] };
  };
  // (cut by a field linear over the triangle: a property's name, or a function of the point)
  const cutAt = (T, poly, X, lev, keepAbove) => {
    const out = [], val = typeof X === 'function' ? X : (q) => q[X];
    for (let k = 0; k < poly.length; k++) {
      const a = poly[k], b = poly[(k + 1) % poly.length], va = val(a), vb = val(b), ia = keepAbove ? va >= lev : va <= lev, ib = keepAbove ? vb >= lev : vb <= lev;
      if (ia) out.push(a);
      if (ia !== ib && va !== lev && vb !== lev) { const t = (lev - va) / (vb - va); out.push(pointOf(T, a.bc.map((x, m) => x + (b.bc[m] - x) * t))); }
    }
    return out;
  };
  const courseOf = (f) => Math.floor(f / h + 1e-7);
  const shift = (k) => (k & 1 ? 0.5 : 0);
  // (with links: the crest's place up the course at a point, high at a link's edges and low at its middle, so each
  // link's upper slope is a tongue down into the course's shade, the rings' rows)
  const crestAt = (q, k) => { if (!L) return crest; const v = q.g / L.w - shift(k), x = v - Math.floor(v); return L.edge + (L.centre - L.edge) * (1 - Math.abs(2 * x - 1)); };
  // a garment vertex: a point in a course, out along the body's normal by the course's profile there
  const gv = new Map();
  const prof = (u, cr) => (u >= cr ? (1 - u) / (1 - cr) : foot + (1 - foot) * (u / cr));
  const vertOf = (q, k, off = null) => {
    const key = `${q.key}|${k}|${off ?? ''}`;
    if (gv.has(key)) return gv.get(key);
    const u = Math.max(0, Math.min(1, q.f / h - k)), out = off ?? o.c(q.i, q.p) + d * prof(u, crestAt(q, k));
    const vi = G.add(add(q.p, mul(o.normal ? o.normal(q) : q.n, out)), q.w, tag);
    gv.set(key, vi);
    return vi;
  };
  // each triangle kept, cut to its hems, across at every course's foot and crest, and round into its links
  const faces = [];
  B.tris.forEach((t, ti) => {
    if (!o.keep(t)) return;
    const lo = o.lo?.(t) ?? -Infinity, hi = o.hi?.(t) ?? Infinity;
    let g = null;
    // (unwrapped round the triangle: a corner more than half the way round from the highest taken once round, by the
    // corners' own arc once round)
    if (L) { const P = Math.max(...t.v.map((i) => Gc[i][1])); g = t.v.map((i) => Gc[i][0]); const m = Math.max(...g); g = g.map((x) => (m - x > P / 2 ? x + P : x)); }
    const T = { t, ti, g };
    let poly = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((bc) => pointOf(T, bc));
    if (poly.every((q) => q.f < lo) || poly.every((q) => q.f > hi)) return;
    if (lo > -Infinity) poly = cutAt(T, poly, 'f', lo, true);
    if (hi < Infinity) poly = cutAt(T, poly, 'f', hi, false);
    if (poly.length < 3) return;
    const fmin = Math.min(...poly.map((q) => q.f)), fmax = Math.max(...poly.map((q) => q.f)), levels = [];
    for (let k = Math.floor(fmin / h); k * h <= fmax; k++) for (const lv of L ? [k * h] : [k * h, (k + crest) * h]) if (lv > fmin + 1e-6 && lv < fmax - 1e-6) levels.push(lv);
    levels.sort((x, y) => x - y);
    const strips = [];
    let rest = poly;
    for (const lv of levels) { const below = cutAt(T, rest, 'f', lv, false); if (below.length >= 3) strips.push(below); rest = cutAt(T, rest, 'f', lv, true); }
    if (rest.length >= 3) strips.push(rest);
    for (const sp of strips) {
      if (!L) { faces.push(Object.assign(sp, { t, lo, hi })); continue; }
      const k = courseOf(sp.reduce((s, q) => s + q.f, 0) / sp.length), gmin = Math.min(...sp.map((q) => q.g)), gmax = Math.max(...sp.map((q) => q.g));
      // (round into half links, each cut along its crest: above it the upper slope, below the lower)
      const halves = [];
      let r2 = sp;
      for (let j = Math.floor(2 * (gmin / L.w - shift(k))); (j / 2 + shift(k)) * L.w < gmax; j++) {
        const lv = (j / 2 + shift(k)) * L.w;
        if (lv <= gmin + 1e-6 || lv >= gmax - 1e-6) continue;
        const left = cutAt(T, r2, 'g', lv, false);
        if (left.length >= 3) halves.push(left);
        r2 = cutAt(T, r2, 'g', lv, true);
      }
      if (r2.length >= 3) halves.push(r2);
      for (const hc of halves) {
        // (the crest is straight over a half link: the half's own line through its ends)
        const gm = hc.reduce((s2, q) => s2 + q.g, 0) / hc.length, jh = Math.floor(2 * (gm / L.w - shift(k))), v0 = jh / 2;
        const g0 = (v0 + shift(k)) * L.w, g1 = g0 + L.w / 2, c0 = crestAt({ g: g0 }, k), c1 = crestAt({ g: g1 }, k);
        const zl = (q) => q.f / h - k - (c0 + ((c1 - c0) * (q.g - g0)) / (g1 - g0));
        const lower = cutAt(T, hc, zl, 0, false), upper = cutAt(T, hc, zl, 0, true);
        if (lower.length >= 3) faces.push(Object.assign(lower, { t, lo, hi, up: false, cell: `${k}|${jh}|0` }));
        if (upper.length >= 3) faces.push(Object.assign(upper, { t, lo, hi, up: true, cell: `${k}|${jh}|1` }));
      }
    }
  });
  const onLevel = (q, lv) => Math.abs(q.f - lv) < 1e-6;
  // with links, each cell's pieces (a half link's upper or lower slope in a course, cut by the body's triangles) merged
  // into one facet: its outline the pieces' outer edges, kept only at the cell's corners (where two of its lines meet: a
  // course's foot or top, a half link's edge, the crest) and along the region's own edges; a cell that does not come
  // out as one convex outline keeps its pieces
  let polys = faces;
  if (L && o.merge !== false) {
    const ekey = (a, b) => (a.key < b.key ? `${a.key}#${b.key}` : `${b.key}#${a.key}`), count = new Map();
    for (const p of faces) p.forEach((q, n) => { const kk = ekey(q, p[(n + 1) % p.length]); count.set(kk, (count.get(kk) ?? 0) + 1); });
    const courseOfPiece = (p) => courseOf(p.reduce((s, q) => s + q.f, 0) / p.length);
    // (a point on the region's own edge: on an edge only one piece has, that is not along a course's foot or top)
    const free = new Set();
    for (const p of faces) {
      const k = courseOfPiece(p);
      p.forEach((q, n) => { const r = p[(n + 1) % p.length]; if (count.get(ekey(q, r)) === 1 && !((onLevel(q, k * h) && onLevel(r, k * h)) || (onLevel(q, (k + 1) * h) && onLevel(r, (k + 1) * h)))) { free.add(q.key); free.add(r.key); } });
    }
    const corner = (q, k) => {
      const onF = onLevel(q, k * h) || onLevel(q, (k + 1) * h), x = 2 * (q.g / L.w - shift(k)), onG = Math.abs(x - Math.round(x)) < 1e-5;
      const onZ = Math.abs(q.f / h - k - crestAt(q, k)) < 1e-5;
      return (onF ? 1 : 0) + (onG ? 1 : 0) + (onZ ? 1 : 0) >= 2;
    };
    // (each piece wound outward first, as the body under it faces)
    for (const p of faces) { const P = p.map((q) => q.p), n = p.reduce((s2, q) => add(s2, q.n), [0, 0, 0]); if (dot(newell(P, P.map((_, m) => m)), n) < 0) p.reverse(); }
    const cells = new Map();
    for (const p of faces) (cells.get(p.cell) ?? cells.set(p.cell, []).get(p.cell)).push(p);
    polys = [];
    // (a cell's pieces in their connected parts, by the edges they share: where the arc folds, two parts of the body)
    const parts = [];
    for (const list of cells.values()) {
      const at = new Map(), root = list.map((_, i) => i), find = (i) => (root[i] === i ? i : (root[i] = find(root[i])));
      list.forEach((p, i) => p.forEach((q, n) => { const kk = ekey(q, p[(n + 1) % p.length]); if (at.has(kk)) root[find(i)] = find(at.get(kk)); else at.set(kk, i); }));
      const by = new Map();
      list.forEach((p, i) => (by.get(find(i)) ?? by.set(find(i), []).get(find(i))).push(p));
      parts.push(...by.values());
    }
    // (each part's outline, the directed edges whose reverse none of its pieces has, chained; null where it is not one loop)
    const outline = (list) => {
      const dir = new Map(), has = new Set(), byKey = new Map();
      for (const p of list) p.forEach((q, n) => { const r = p[(n + 1) % p.length]; has.add(`${q.key}>${r.key}`); byKey.set(q.key, q); });
      for (const p of list) p.forEach((q, n) => { const r = p[(n + 1) % p.length]; if (!has.has(`${r.key}>${q.key}`)) dir.set(q.key, (dir.get(q.key) ?? []).concat([r.key])); });
      if (![...dir.values()].every((l) => l.length === 1)) return null;
      const loop = [], start = dir.keys().next().value;
      let cur = start;
      for (let n = 0; n <= dir.size; n++) { loop.push(byKey.get(cur)); cur = dir.get(cur)[0]; if (cur === start) break; }
      return loop.length === dir.size ? loop : null;
    };
    // (convex in the cell's own coordinates, the arc and the field)
    const convex = (P) => { let sg = 0; for (let n = 0; n < P.length; n++) { const a = P[n], b = P[(n + 1) % P.length], c = P[(n + 2) % P.length], cr = (b.g - a.g) * (c.f - b.f) - (b.f - a.f) * (c.g - b.g); if (Math.abs(cr) < 1e-9) continue; if (sg && Math.sign(cr) !== sg) return false; sg = Math.sign(cr); } return true; };
    const loops = parts.map((list) => (list.length === 1 && list[0].length <= 4 ? null : outline(list)));
    // (a merged cell keeps every point it shares with a cell that keeps its pieces, so the two meet edge to edge with no
    // gap and no lip between them; repeated while a cell that kept more points can no longer merge)
    const kept = new Set(), merged = parts.map((list, i) => !!loops[i]);
    for (let pass = 0; pass < 4; pass++) {
      kept.clear();
      parts.forEach((list, i) => { if (!merged[i]) for (const p of list) for (const q of p) kept.add(q.key); });
      let changed = false;
      parts.forEach((list, i) => {
        if (!merged[i]) return;
        const k = courseOfPiece(list[0]), out = loops[i].filter((q) => corner(q, k) || free.has(q.key) || kept.has(q.key));
        if (out.length < 3 || !convex(out)) { merged[i] = false; changed = true; }
      });
      if (!changed) break;
    }
    parts.forEach((list, i) => {
      if (!merged[i]) { polys.push(...list); return; }
      const k = courseOfPiece(list[0]), out = loops[i].filter((q) => corner(q, k) || free.has(q.key) || kept.has(q.key));
      polys.push(Object.assign(out, { t: list[0].t, lo: Math.max(...list.map((p) => p.lo)), hi: Math.min(...list.map((p) => p.hi)), up: list[0].up }));
    });
  }
  // (one point for one place: points cut in different triangles that land on the same place on the body are one)
  {
    const at = new Map(), q5 = (x) => Math.round(x * 2e4);
    polys = polys.map((p) => Object.assign(p.map((q) => { const key = `${q5(q.p[0])},${q5(q.p[1])},${q5(q.p[2])}`; if (!at.has(key)) at.set(key, q); return at.get(key); }), { t: p.t, lo: p.lo, hi: p.hi, up: p.up }));
  }
  // (where two neighbours cut the line between them at different places, as where a limb's links meet the trunk's or
  // their arc comes round, each takes the other's points along it, so they meet edge to edge: no gap, and no lip)
  {
    const ekey = (a, b) => (a.key < b.key ? `${a.key}#${b.key}` : `${b.key}#${a.key}`), count = new Map();
    for (const p of polys) p.forEach((q, n) => { const kk = ekey(q, p[(n + 1) % p.length]); count.set(kk, (count.get(kk) ?? 0) + 1); });
    const loose = new Map(), cell = 0.25, grid = new Map(), gk = (p) => p.map((x) => Math.floor(x / cell)).join(',');
    for (const p of polys) p.forEach((q, n) => { const r = p[(n + 1) % p.length]; if (count.get(ekey(q, r)) === 1) { loose.set(q.key, q); loose.set(r.key, r); } });
    for (const q of loose.values()) { const k2 = gk(q.p); (grid.get(k2) ?? grid.set(k2, []).get(k2)).push(q); }
    const near = (a, b) => {
      const lo = [0, 1, 2].map((j) => Math.floor(Math.min(a.p[j], b.p[j]) / cell)), hi = [0, 1, 2].map((j) => Math.floor(Math.max(a.p[j], b.p[j]) / cell)), out = [];
      for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) out.push(...(grid.get(`${x},${y},${z}`) ?? []));
      return out;
    };
    polys = polys.map((p) => {
      const out = [];
      p.forEach((q, n) => {
        out.push(q);
        const r = p[(n + 1) % p.length];
        if (count.get(ekey(q, r)) !== 1 || (Math.abs(q.f - r.f) < 1e-6 && Math.abs(q.f / h - Math.round(q.f / h)) < 1e-6)) return;
        const d = sub(r.p, q.p), L2 = dot(d, d);
        if (L2 < 1e-12) return;
        const on = near(q, r).filter((m) => m.key !== q.key && m.key !== r.key).map((m) => { const t = dot(sub(m.p, q.p), d) / L2, off = sub(sub(m.p, q.p), mul(d, t)); return { m, t, e: Math.hypot(...off) }; }).filter(({ t, e }) => t > 1e-4 && t < 1 - 1e-4 && e < 2e-4);
        on.sort((x, y) => x.t - y.t);
        for (const { m } of on) if (out[out.length - 1].key !== m.key) out.push(m);
      });
      return Object.assign(out, { t: p.t, lo: p.lo, hi: p.hi, up: p.up });
    });
  }
  // each piece in its course: its upper slope or its lower, by its middle
  const seen = new Map(), steps = [];
  G.tag = tag;
  for (const piece of polys) {
    const fm = piece.reduce((s, q) => s + q.f, 0) / piece.length, k = courseOf(fm), up = piece.up ?? fm / h - k >= crest;
    const v = facing(G, piece.map((q) => vertOf(q, k)), piece.reduce((s, q) => add(s, q.n), [0, 0, 0]));
    G.polys.push({ v, mat: mat(fm, up, piece.t, k), part: tag, tag });
    piece.forEach((q, n) => {
      const r = piece[(n + 1) % piece.length];
      // (an edge along the course's foot over more mail: a step down to the course below; along its top under more: none)
      if (onLevel(q, k * h) && onLevel(r, k * h) && k * h > piece.lo + 1e-6) { steps.push([q, r, k]); return; }
      if (onLevel(q, (k + 1) * h) && onLevel(r, (k + 1) * h) && (k + 1) * h < piece.hi - 1e-6) return;
      const key = q.key < r.key ? `${q.key}#${r.key}` : `${r.key}#${q.key}`;
      (seen.get(key) ?? seen.set(key, []).get(key)).push({ a: q, b: r, k, piece });
    });
  }
  // (none where the courses' feet sit on the body as their tops do: nothing between them to close)
  if (foot > 0) for (const [a, b, k] of steps) {
    const q = [vertOf(a, k), vertOf(b, k), vertOf(b, k - 1), vertOf(a, k - 1)];
    facing(G, q, o.down ?? [0, -1, 0]);
    G.polys.push({ v: q, mat: 'shade', part: tag, tag });
  }
  // the free edges turned in toward the body
  const lipTo = o.lip ?? 0.012;
  for (const list of seen.values()) {
    if (list.length !== 1) continue;
    const { a, b, k, piece } = list[0], c = mul(piece.reduce((s, q) => add(s, q.p), [0, 0, 0]), 1 / piece.length), m = mul(add(a.p, b.p), 0.5);
    if (o.edges) { o.edges(a, b, vertOf(a, k), vertOf(b, k), sub(m, c)); continue; }
    const q = [vertOf(a, k), vertOf(b, k), vertOf(b, k, lipTo), vertOf(a, k, lipTo)];
    facing(G, q, sub(m, c));
    G.polys.push({ v: q, mat: o.lipMat ?? 'shade', part: tag, tag: `${tag} lip` });
  }
  // a body vertex wholly under the mail: every triangle round it kept and inside its hems
  const tri = new Map();
  B.tris.forEach((t) => t.v.forEach((i) => (tri.get(i) ?? tri.set(i, []).get(i)).push(t)));
  const covered = (i, m = 0) => (tri.get(i) ?? []).every((t) => o.keep(t) && F[i] >= (o.lo?.(t) ?? -Infinity) + m && F[i] <= (o.hi?.(t) ?? Infinity) - m);
  return { covered, faces: polys.length, verts: new Set(gv.values()) };
}

/**
 * The brass row at a hem: the course the hem `lo` (or the top `hi`) cuts, and the next one in where that is cut to less
 * than four tenths of a course; its upper slopes in rune (the gold's colour plain, glowing enchanted), its lower in gold.
 */
export const hemRow = (h, { lo = -Infinity, hi = Infinity } = {}) => (k, up) => (k <= Math.floor((lo + 0.4 * h) / h + 1e-7) || k >= Math.floor((hi - 0.4 * h) / h + 1e-7) ? (up ? 'rune' : 'gold') : null);

/** A polygon's corners turned so its normal points along `want`. */
export function facing(G, v, want) { if (dot(newell(G.verts, v), want) < 0) v.reverse(); return v; }

/** The body's polygons whose every corner passes ok(i). */
export const coveredPolys = (rig, ok) => rig.B.polys.map((p, k) => (p.v.every(ok) ? k : -1)).filter((k) => k >= 0);

/**
 * A closed band of rows round an axis: rows[r][k] points (k round), each row's normals out from the axis point `axis(p)`;
 * its face quads in mat(r, k), its top and bottom edges turned in by `t` toward the axis (edgeMat). Every vertex weighted
 * w(p) ({ bone index: weight }). Returns the band's face polygons' range.
 */
export function band(G, rows, { axis, t = 0.03, mat = () => 'leather', edgeMat = 'leather', w, tag, closed = true, edges = [true, true] }) {
  const n = rows[0].length, C = closed ? n : n - 1;
  const ids = rows.map((row) => row.map((p) => G.add(p, w(p), tag)));
  const inn = (r) => rows[r].map((p) => { const a = axis(p), dir = unit(sub(p, a)); return G.add(sub(p, mul(dir, t)), w(p), tag); });
  G.tag = tag;
  const p0 = G.polys.length;
  for (let r = 0; r + 1 < rows.length; r++) for (let k = 0; k < C; k++) {
    const k1 = (k + 1) % n, q = [ids[r][k], ids[r][k1], ids[r + 1][k1], ids[r + 1][k]];
    const c = mul(q.reduce((s, i) => add(s, G.verts[i]), [0, 0, 0]), 0.25);
    facing(G, q, sub(c, axis(c)));
    G.polys.push({ v: q, mat: mat(r, k), part: tag, tag });
  }
  for (const [r, on] of [[0, edges[0]], [rows.length - 1, edges[1]]]) {
    if (!on) continue;
    const ii = inn(r);
    for (let k = 0; k < C; k++) {
      // (the edge faces away from the band: up at its top, down at its foot)
      const k1 = (k + 1) % n, q = [ids[r][k], ids[r][k1], ii[k1], ii[k]], away = sub(G.verts[ids[r][k]], G.verts[ids[r === 0 ? 1 : rows.length - 2][k]]);
      facing(G, q, away);
      G.polys.push({ v: q, mat: edgeMat, part: tag, tag });
    }
  }
  return [p0, G.polys.length];
}

/**
 * A small raised plate on the surface (a buckle, a stud): a quad of half-sizes (a, b) along u and v centred at p, standing
 * `h` out along n, its sides down to the surface; its face in mat, its sides in sideMat; optionally an inset (a gem or a
 * rune) of `inset` the size on its face in insetMat, standing a little proud.
 */
export function stud(G, p, n, u, { a, b, h, mat = 'gold', sideMat = 'gold', inset = 0, insetMat = 'core', w, tag, diamond = false }) {
  n = unit(n); u = unit(sub(u, mul(n, dot(u, n)))); const v = cross(n, u);
  const corner = (s, t, up, k = 1) => (diamond ? [[1, 0], [0, 1], [-1, 0], [0, -1]] : [[1, 1], [-1, 1], [-1, -1], [1, -1]]).map(([x, y]) => add(add(p, mul(n, up)), add(mul(u, x * a * k * s), mul(v, y * b * k * t))));
  const base = corner(1, 1, 0).map((q) => G.add(q, w, tag)), top = corner(0.85, 0.85, h).map((q) => G.add(q, w, tag));
  G.tag = tag;
  G.polys.push({ v: facing(G, top.slice(), n), mat, part: tag, tag });
  for (let k = 0; k < 4; k++) {
    const q = [base[k], base[(k + 1) % 4], top[(k + 1) % 4], top[k]], c = mul(q.reduce((s, i) => add(s, G.verts[i]), [0, 0, 0]), 0.25);
    G.polys.push({ v: facing(G, q, sub(c, p)), mat: sideMat, part: tag, tag });
  }
  if (inset > 0) {
    const g = corner(0.85 * inset, 0.85 * inset, h + 0.012).map((q) => G.add(q, w, tag)), tip = G.add(add(p, mul(n, h + 0.012 + Math.min(a, b) * inset * 0.35)), w, tag);
    for (let k = 0; k < 4; k++) G.polys.push({ v: facing(G, [g[k], g[(k + 1) % 4], tip], n), mat: insetMat, part: tag, tag });
  }
}

/** The mesh done: its triangles (fans), each vertex's weights as [[bone, w], ...] (the four largest, normalised). */
export function finish(G) {
  G.tris = trisOf(G);
  G.vw = G.w.map((w) => {
    const l = Object.entries(w).map(([b, x]) => [+b, x]).filter(([, x]) => x > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4), s = l.reduce((a, [, x]) => a + x, 0);
    return l.map(([b, x]) => [b, x / s]);
  });
  return G;
}

/** Writes a piece's game copy beside each body (lowgarment.mjs garmentAsset), with `hides` and `soles` and `dropFrom` where it has them. */
export async function writePiece(name, build, script) {
  const { writeFileSync } = await import('node:fs');
  const { buildRig } = await import('../lowrig.mjs');
  const { garmentAsset } = await import('../lowgarment.mjs');
  for (const who of ['male', 'female']) {
    const rig = buildRig(who), G = finish(build(rig));
    const file = new URL(`../../../src/sculpt/assets/low${name}-${who}.json`, import.meta.url);
    const A = { built: `node tools/sculpt/garments/${script} (tools/sculpt/lowgarment.mjs garmentAsset)`, ...garmentAsset(rig, G, MATS, LOOKS), hides: G.hides, ...(G.soles ? { soles: G.soles } : {}), ...(G.dropFrom !== undefined ? { dropFrom: G.dropFrom } : {}) };
    writeFileSync(file, JSON.stringify(A));
    console.log(who, `${G.verts.length} vertices, ${G.polys.length} polygons, ${G.tris.length} triangles, hides ${G.hides.length} body polygons: wrote`, file.pathname);
  }
}

/**
 * The links' arc round the body for mailShell (o.links): round the trunk's vertical axis (through z0, radius rT), and,
 * as much as a vertex is weighted to a limb's bones (`limbs`: [[side, bone names, axis(y) → [x, z], radius]]), round
 * that limb's axis instead: the arc the angle round the blended axis times the blended radius. `w` the links' width.
 */
export function linksOf(rig, { z0, rT, limbs = [], w, edge = 0.75, centre = 0.2 }) {
  const ramp = (x, a, b) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  const P = 2 * Math.PI * rT;
  return {
    w, edge, centre, P,
    around: (p, i) => {
      let cx = 0, cz = z0, r = rT;
      for (const [, bones, axis, ra] of limbs) {
        const share = rig.vw[i].reduce((s, [b, x]) => s + (bones.has(rig.bones[b].name) ? x : 0), 0), k = ramp(share, 0.25, 0.75);
        if (k <= 0) continue;
        const [ax, az] = axis(p[1]);
        cx += (ax - cx) * k; cz += (az - cz) * k; r += (ra - r) * k;
      }
      return [Math.atan2(p[0] - cx, p[2] - cz) * r, 2 * Math.PI * r];
    },
  };
}
/** A limb's axis at a height: along the line from a to b (body points), its x and z at y. */
export const axisThrough = (a, b) => (y) => { const t = (y - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t]; };
/** The arm chain's bones of a side (the arm's own and its helpers). */
export const armBones = (s) => new Set(['upperarm', 'lowerarm', 'hand', 'shoulder', 'upperarm_twist', 'elbow', 'lowerarm_twist_01', 'lowerarm_twist_02', 'wrist'].map((n) => `${n}_${s}`));
/** The leg chain's bones of a side. */
export const legBones = (s) => new Set(['thigh', 'calf', 'foot', 'ball', 'hip', 'knee', 'ankle', 'toes'].map((n) => `${n}_${s}`));

/**
 * A ring round a vertical axis through the body: at height y, n points round (0 the front, 90 the body's left), each the
 * reach of the samples S (points) within `dy` of y and `wedge` degrees of its way from the axis (ax, az), out by `c`.
 */
export function ringAt(S, ax, az, y, n, c, { dy = 0.12, wedge = 20, a0 = 0 } = {}) {
  const cw = Math.cos((wedge * Math.PI) / 180);
  return Array.from({ length: n }, (_, k) => {
    const a = ((a0 + (k * 360) / n) * Math.PI) / 180, d = [Math.sin(a), 0, Math.cos(a)];
    let r = 0;
    for (const p of S) {
      if (Math.abs(p[1] - y) > dy) continue;
      const vx = p[0] - ax, vz = p[2] - az, l = Math.hypot(vx, vz);
      if (l < 1e-6 || (vx * d[0] + vz * d[2]) / l < cw) continue;
      r = Math.max(r, l * ((vx * d[0] + vz * d[2]) / l));
    }
    return [ax + d[0] * (r + c), y, az + d[2] * (r + c)];
  });
}

/**
 * A core, as the plate set's (platechest.mjs coreOn): a gold ring of `sides` sides, radius r, standing on the surface at
 * p (its way out n, its first corner toward `up`) round a domed gem in core (glowing when enchanted).
 */
export function coreOn(G, p, n, up, { r, sides = 8, w, tag }) {
  n = unit(n); const u = unit(sub(up, mul(n, dot(up, n)))), v = cross(n, u), H = r * 0.32;
  const ring = (rad, lift) => Array.from({ length: sides }, (_, k) => { const a = (k / sides) * 2 * Math.PI; return G.add(add(add(p, mul(n, lift)), add(mul(u, Math.cos(a) * rad), mul(v, Math.sin(a) * rad))), w, tag); });
  const base = ring(r, 0.01), top = ring(r * 0.84, H), inner = ring(r * 0.68, H * 0.85), tip = G.add(add(p, mul(n, H * 1.45)), w, tag);
  G.tag = tag;
  const out = (q) => sub(mul(q.reduce((s, i) => add(s, G.verts[i]), [0, 0, 0]), 1 / q.length), p);
  for (let k = 0; k < sides; k++) {
    const j = (k + 1) % sides;
    for (const [q, mat] of [[[base[k], base[j], top[j], top[k]], 'gold'], [[top[k], top[j], inner[j], inner[k]], 'gold'], [[inner[k], inner[j], tip], 'core']]) G.polys.push({ v: facing(G, q, add(out(q), mul(n, 0.5))), mat, part: tag, tag });
  }
}
