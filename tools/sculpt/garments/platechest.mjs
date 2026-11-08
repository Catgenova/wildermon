// The chest & arms of the plate armour (the user's chest sheet, tools/sculpt/ref/plate-chest.png; worn in the plate
// lineup, tools/sculpt/ref/plate-lineup.png): a high segmented collar, a breastplate with a glowing core and gold inlays
// and a pointed V lower edge, a back plate with a ridge, two lames and a belt round the waist, the faulds (front, sides
// and back) over the upper thigh, layered pauldrons each with its own core, rerebraces, angular vambraces with a flared
// elbow, gauntlets with segmented fingers, and a dark under-layer at the armpit and the inner elbow. His broad, hers
// fitted. Worn over bare skin (the lineup's): the body's polygons it covers whole are hidden (`hides`).
//
//   buildPlateChest(rig, design?) → { verts, polys: [{ v, mat, part, tag }], tris, part, wt (per vertex { bone: w }),
//     pieces, design, hides }
//   plateChestWeights(rig, G) → per vertex [[bone, weight], ...] (the body's bones only: the armour has none of its own)
//
//   node tools/sculpt/garments/platechest.mjs
//     writes the game's copy beside each body: src/sculpt/assets/lowplatechest-male.json and lowplatechest-female.json
//     (lowgarment.mjs garmentAsset, with `hides` and the `plain` and `enchanted` looks; loaded by src/sculpt/lowpoly.ts)
//
// Every plate is rigid: all its vertices carry one weight list (one bone, or a fixed share of two at a joint), so it never
// stretches; plates at a joint overlap, the upper one outside, so no gap opens as the joint bends. Only the under-layer
// (a sleeve of the arm's own rings, pushed out) and the gauntlet (the hand's own polygons, pushed out along their normals,
// so the plates follow the fingers' curl) are skinned as the skin under them.
//
// A plate is a grid of points (rows down, columns round) on a section of the body: each point the body's reach in its
// column's direction (the convex hull of the body's samples in a slab across an axis, so a plate bridges the body's
// hollows) plus the row's clearance. Its face is the grid; round its border a raised gold rim (out by `w` and up by `h`)
// and the plate's edge (down by `t` behind the rim), or the edge alone, or nothing where the border is tucked under
// another plate. Cores (a gold ring standing on the plate round a glowing dome) and inlays (gold strips) lie on a plate.
//
// Units and axes are the body's: y up (the chin's underside 0), z forward, x the body's left.
import { meshOf, orient, trisOf, samplesOf, closestOnTri, sub, add, mul, dot, cross, unit, lerp } from '../lowgarment.mjs';
import { TORSO_RING } from '../lowarm.mjs';
import { existsSync, readFileSync } from 'node:fs';

/**
 * The materials, shared with the rest of the plate set by name (so the game gives each one slot): plate (the cream
 * stone), shade (a step darker), gold (the raised trim), under (the dark under-layer), core (the cores and the elbow
 * diamonds), rune (the engraved inlay lines). MATS: each one's colour as the shot tools draw it plain.
 */
export const MATS = { plate: [0.84, 0.71, 0.63], shade: [0.72, 0.6, 0.53], gold: [0.96, 0.74, 0.4], under: [0.29, 0.22, 0.2], core: [0.86, 0.62, 0.3], rune: [0.96, 0.74, 0.4] };
/**
 * The two looks (tools/sculpt/../ENCHANT spec, as the long sword's `plain` and `enchanted`): each material's colour and
 * kind (2 metal, lit by the light's brightness as the long sword; 1 unlit and blooming). Plain, the cores are an amber gem
 * and the runes the trim's gold; enchanted, the cores and the runes glow (#FFE7A6); the trim stays metal either way.
 */
const GLOWING = [1, 0.906, 0.651];
export const LOOKS = {
  plain: Object.fromEntries(Object.entries(MATS).map(([n, c]) => [n, { c, kind: 2 }])),
  enchanted: { ...Object.fromEntries(Object.entries(MATS).map(([n, c]) => [n, { c, kind: 2 }])), core: { c: GLOWING, kind: 1 }, rune: { c: GLOWING, kind: 1 } },
};

/**
 * The design per body. Heights are the body's y; az, azimuth round the torso (0 the front, 90 the body's left); θ round
 * a limb (0 forward, 90 out, 180 back); t along a limb's bone from its head. Lists by column are [front ... back] for a
 * symmetric piece, mirrored. `c` clearances off the body (the hull of its samples); rim { w, h, t }: the gold rim's width
 * and rise, the plate's thickness behind it.
 */
export const DESIGN = {
  male: {
    rim: { w: 0.11, h: 0.04, t: 0.035 },
    fit: { trunk: 0.045, lame: 0.025, fauld: 0.1, arm: 0.04, gap: 0.02 },
    legs: { top: -3.94, bottom: -5.45, c: [0.035, 0.095, 0.16, 0.29, 0.28, 0.27, 0.21] },
    wedge: 8,
    collar: { cols: [[14, 66, 118], [128, 154, 180]], base: [-0.78, -0.78, -0.62], top: [-0.06, 0.12, 0.19], lip: [55, -0.38], trim: 0.12, c: 0.38, flare: 0.05, wall: 0.07, spread: 0.12, sink: -0.1, open: 46, shrug: 0.4 },
    breast: { az: [0, 22, 46, 70, 94], top: [-0.62, -0.64, -0.68, -0.82, -1.95], bottom: [-4.05, -3.8, -3.45, -3.2, -3.1], rows: [0, 0.3, 0.55, 0.8, 1], c: [0.05, 0.05, 0.055, 0.06, 0.065], flat: 22, core: { y: -1.9, r: 0.44, n: 8 } },
    back: { az: [100, 118, 140, 160, 180], top: [-1.95, -0.78, -0.6, -0.56, -0.54], bottom: [-3.0, -3.2, -3.4, -3.55, -3.65], rows: [0, 0.45, 1], c: [0.045, 0.05, 0.055], ridge: 0.06, side: 0 },
    lames: [
      { piece: 'lame1', bone: { spine_01: 1 }, top: -2.9, bottom: -3.6, v: 0.1, c: [0.02, 0.06] },
      { piece: 'belt', bone: { pelvis: 1 }, top: -3.75, bottom: -4.3, v: 0.08, c: [0.02, 0.06], mat: 'shade' },
    ],
    lameCols: 10,
    faulds: {
      top: -4.15, c: 0.17, flare: 0.12,
      plates: [
        { az: [-22, 0, 22], bottom: [-5.7, -6.07, -5.7], bone: { pelvis: 0.4, thigh_l: 0.3, thigh_r: 0.3 } },
        { az: [28, 50, 72], bottom: [-5.6, -5.7, -5.45], bone: { pelvis: 0.25, thigh_l: 0.75 }, mirror: true },
        { az: [140, 180, 220], bottom: [-5.5, -5.85, -5.5], bone: { pelvis: 0.4, thigh_l: 0.3, thigh_r: 0.3 } },
      ],
    },
    pauldron: {
      lift: -0.08, inset: 0.0, pole: 0.5, near: 1.1, round: 0.2, inner: 0.3, cols: 8, phi0: 22, phi: [76, 88, 76, 46], rows: [0, 0.5, 1], c: [0.12, 0.26, 0.34], cone: 34,
      core: { psi: 55, f: 0.6, r: 0.3, n: 6 },
      lames: [{ t: [0.45, 1.05], c: [0.07, 0.11], th: [-35, 215] }],
    },
    rerebrace: { t: [1.25, 1.62], c: [0.035, 0.045], th: [-45, 228], cols: 5 },
    sleeve: { rings: [['ja', 0.035], ['jb', 0.04], ['uc', 0.045], ['el', 0.045], ['fa', 0.04]] },
    vambrace: { cols: 8, top: [0.42, 0.2, -0.32, 0.2], mid: 0.55, bottom: 1.3, c: [0.045, 0.035, 0.03], flare: 0.03, ridge: 0.08, diamond: { t: 0.6, r: 0.14 } },
    cuff: { cols: 8, t: [-0.42, 0.06], c: [0.04, 0.06] },
    hand: { off: 0.035 },
  },
  female: {
    rim: { w: 0.095, h: 0.035, t: 0.03 },
    fit: { trunk: 0.04, lame: 0.022, fauld: 0.09, arm: 0.035, gap: 0.018 },
    legs: { top: -3.58, bottom: -4.16, c: [0.05, 0.1, 0.14, 0.18, 0.17, 0.16, 0.11] },
    wedge: 8,
    collar: { cols: [[14, 66, 118], [128, 154, 180]], base: [-0.85, -0.78, -0.62], top: [-0.25, -0.1, 0.0], trim: 0.11, c: 0.28, flare: 0.04, wall: 0.06, spread: 0.1, sink: -0.05, open: 46, shrug: 0.35 },
    breast: { az: [0, 18, 36, 56, 76, 96], top: [-0.7, -0.71, -0.74, -0.8, -0.95, -1.85], bottom: [-3.55, -3.4, -3.2, -3.0, -2.85, -2.75], rows: [0, 0.23, 0.44, 0.56, 0.78, 1], c: [0.04, 0.04, 0.04, 0.045, 0.05, 0.055], flat: 18, bridge: [3], core: { y: -1.6, r: 0.38, n: 8 } },
    back: { az: [100, 118, 140, 160, 180], top: [-1.85, -0.9, -0.72, -0.64, -0.6], bottom: [-2.6, -2.8, -2.95, -3.05, -3.15], rows: [0, 0.45, 1], c: [0.04, 0.045, 0.05], ridge: 0.05, side: 0 },
    lames: [
      { piece: 'lame1', bone: { spine_01: 1 }, top: -2.5, bottom: -3.1, v: 0.1, c: [0.018, 0.05] },
      { piece: 'belt', bone: { pelvis: 1 }, top: -3.25, bottom: -3.75, v: 0.06, c: [0.018, 0.05], mat: 'shade' },
    ],
    lameCols: 10,
    faulds: {
      top: -3.6, c: 0.2, flare: 0.14,
      plates: [
        { az: [-22, 0, 22], bottom: [-4.7, -4.96, -4.7], bone: { pelvis: 0.2, thigh_l: 0.4, thigh_r: 0.4 } },
        { az: [30, 50, 70], bottom: [-4.8, -5.05, -4.7], bone: { pelvis: 0.1, thigh_l: 0.9 }, mirror: true },
        { az: [140, 180, 220], bottom: [-4.6, -4.9, -4.6], bone: { pelvis: 0.7, thigh_l: 0.15, thigh_r: 0.15 } },
      ],
    },
    pauldron: {
      lift: -0.06, inset: 0.0, pole: 0.5, near: 0.95, round: 0.2, inner: 0.3, cols: 8, phi0: 22, phi: [74, 86, 74, 46], rows: [0, 0.5, 1], c: [0.09, 0.19, 0.26], cone: 34,
      core: { psi: 55, f: 0.6, r: 0.25, n: 6 },
      lames: [{ t: [0.38, 0.85], c: [0.06, 0.1], th: [-35, 215] }],
    },
    rerebrace: { t: [1.05, 1.35], c: [0.03, 0.04], th: [-45, 228], cols: 5 },
    sleeve: { rings: [['ja', 0.03], ['jb', 0.035], ['uc', 0.04], ['el', 0.04], ['fa', 0.035]] },
    vambrace: { cols: 8, top: [0.38, 0.18, -0.28, 0.18], mid: 0.5, bottom: 1.2, c: [0.04, 0.03, 0.028], flare: 0.028, ridge: 0.07, diamond: { t: 0.55, r: 0.12 } },
    cuff: { cols: 8, t: [-0.38, 0.05], c: [0.045, 0.06] },
    hand: { off: 0.03 },
  },
};

/* ---- sections: the convex hull of the body's samples in a slab across an axis ------------------------------------ */
function hull2(P) {
  const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  hi.pop(); lo.pop();
  return lo.concat(hi);
}
/** How far from o along d the hull's boundary is (its furthest crossing). */
function rayHull(H, o, d) {
  let best = 0;
  for (let k = 0; k < H.length; k++) {
    const a = H[k], b = H[(k + 1) % H.length], e = [b[0] - a[0], b[1] - a[1]];
    const den = d[0] * e[1] - d[1] * e[0];
    if (Math.abs(den) < 1e-12) continue;
    const w = [a[0] - o[0], a[1] - o[1]], s = (w[0] * e[1] - w[1] * e[0]) / den, t = (w[0] * d[1] - w[1] * d[0]) / den;
    if (s >= 0 && t >= -1e-9 && t <= 1 + 1e-9) best = Math.max(best, s);
  }
  return best;
}
/**
 * A sectioner along an axis: o (a point), a (unit, t along it), e1 (θ 0) and e2 (θ 90), both across a. at(t, θ, c) is
 * the body's reach in the slab |t' - t| < dt in direction θ from the axis (or, `centred`, from the middle of the slab's
 * hull along e1), out by c; the samples S (points).
 */
export function sectioner(S, { o, a, e1, e2, dt = 0.1, centred = false, wedge = 0 }) {
  const proj = S.map((p) => { const d = sub(p, o); return [dot(d, a), dot(d, e1), dot(d, e2)]; });
  const cache = new Map();
  const hull = (t) => {
    const key = Math.round(t * 200);
    if (cache.has(key)) return cache.get(key);
    let pts = [];
    for (let w = dt; pts.length < 6 && w < 1.5; w *= 1.6) pts = proj.filter((q) => Math.abs(q[0] - t) < w).map((q) => [q[1], q[2]]);
    const H = hull2(pts);
    const u0 = centred ? (Math.min(...H.map((q) => q[0])) + Math.max(...H.map((q) => q[0]))) / 2 : 0;
    const out = { H, u0 };
    cache.set(key, out);
    return out;
  };
  const dirOf = (th) => [Math.cos(th * Math.PI / 180), Math.sin(th * Math.PI / 180)];
  // (with `wedge`, the body's own surface: the farthest sample of the slab within `wedge` degrees of the direction, as
  // the tunic reads it, so a plate hugs the body rather than its hull)
  const reachOf = (t, th, u0) => {
    const k = 1 / Math.cos(wedge * Math.PI / 180), ca = Math.cos(wedge * Math.PI / 180), d = dirOf(th);
    let r = 0;
    for (let w = dt; r === 0 && w < 1; w *= 1.6) for (const q of proj) {
      if (Math.abs(q[0] - t) > w) continue;
      const x = q[1] - u0, y = q[2], l = Math.hypot(x, y);
      if (l < 1e-9 || (x * d[0] + y * d[1]) / l < ca) continue;
      r = Math.max(r, l * k);
    }
    return r;
  };
  const at = (t, th, c = 0) => {
    const { H, u0 } = hull(t), d = dirOf(th), r = (wedge ? reachOf(t, th, u0) : rayHull(H, [u0, 0], d)) + c;
    return add(add(o, mul(a, t)), add(mul(e1, u0 + r * d[0]), mul(e2, r * d[1])));
  };
  const axisAt = (t) => { const { u0 } = hull(t); return add(add(o, mul(a, t)), mul(e1, u0)); };
  return { at, axisAt, hull };
}

/**
 * A grid pushed out until no body sample (points S) lies closer than c under its face: for each face triangle, the
 * samples over it (their foot inside it) less than c under it (or above it) move its corners out along its normal by
 * the shortfall; a few passes, each corner moved by the most any of its faces asks.
 */
function fitOut(rows, ring, out, S, c, passes = 4, reach = 0.3) {
  // (S may be layers [[points, clearance], ...]: the body's samples, and the surfaces of the pieces under this one)
  if (S.length && Array.isArray(S[0]) && Array.isArray(S[0][0])) { for (let it = 0; it < passes; it++) for (const [P, cc] of S) fitOut(rows, ring, out, P, cc, 1); return; }
  const R = rows.length - 1, n = rows[0].length, C = ring ? n : n - 1;
  for (let it = 0; it < passes; it++) {
    const need = rows.map((row) => row.map(() => 0)), dir = rows.map((row) => row.map(() => [0, 0, 0]));
    let moved = false;
    for (let r = 0; r < R; r++) for (let k = 0; k < C; k++) {
      const k1 = (k + 1) % n;
      // (both diagonals of the quad, so the fit holds whichever way it is cut, and the same on either side)
      for (const tri of [[[r, k], [r, k1], [r + 1, k1]], [[r, k], [r + 1, k1], [r + 1, k]], [[r, k], [r, k1], [r + 1, k]], [[r, k1], [r + 1, k1], [r + 1, k]]]) {
        const [a, b, cc] = tri.map(([i, j]) => rows[i][j]);
        let nn = unit(cross(sub(b, a), sub(cc, a)));
        const mid = mul(add(add(a, b), cc), 1 / 3);
        if (dot(nn, out(mid)) < 0) nn = mul(nn, -1);
        const lo = [0, 1, 2].map((j) => Math.min(a[j], b[j], cc[j]) - 0.3), hi = [0, 1, 2].map((j) => Math.max(a[j], b[j], cc[j]) + 0.3);
        for (const p of S) {
          if (p[0] < lo[0] || p[0] > hi[0] || p[1] < lo[1] || p[1] > hi[1] || p[2] < lo[2] || p[2] > hi[2]) continue;
          const d = dot(sub(p, a), nn);
          if (d < -c || d > reach) continue;
          const [q, w] = closestOnTri(p, a, b, cc);
          if (Math.hypot(...sub(sub(p, q), mul(nn, dot(sub(p, q), nn)))) > 1e-3) continue;
          // (the face lifted at the sample's foot by the shortfall: each corner by its share, the least movement that
          // does it, so a sample near one edge moves that edge's corners)
          const s2 = w[0] * w[0] + w[1] * w[1] + w[2] * w[2], need0 = d + c;
          tri.forEach(([i, j], m) => { const x = (need0 * w[m]) / s2; if (x > need[i][j]) { need[i][j] = x; moved = true; } });
        }
      }
    }
    if (!moved) break;
    // (each corner out along the way out from the body there, by the most any face asked of it)
    rows.forEach((row, i) => row.forEach((p, j) => { if (need[i][j] > 1e-4) row[j] = add(p, mul(unit(out(p)), Math.min(need[i][j], 0.25))); }));
  }
}

/* ---- the plate builder ----------------------------------------------------------------------------------------------- */
/**
 * A plate on G from a grid of points `rows` (R + 1 rows of C + 1 points; `ring`: C points, closed round). Its face the
 * grid's quads (mat(r, c), else `mat`), its border by side (top, bottom, left, right) 'trim' (the raised gold rim and the
 * edge behind it), 'edge' (the edge alone) or 'open'; every vertex weighted `bone` ({ name: share }). out(p): the way out
 * from the body at p. Returns { faces (its face triangles' points, for laying decals on), N (normals by grid point) }.
 */
function plateOf(G, rows, o) {
  if (o.fit) fitOut(rows, !!o.ring, o.out, o.fit.S, o.fit.c);
  const ring = !!o.ring, R = rows.length - 1, n = rows[0].length, C = ring ? n : n - 1, rim = o.rim;
  const tag = o.tag, wt = o.bone, mat = o.mat ?? 'plate';
  const V = (p) => { const i = G.vert(p, tag); G.wt[i] = wt; return i; };
  const id = rows.map((row) => row.map(V));
  const P = (r, c) => rows[Math.max(0, Math.min(R, r))][ring ? ((c % n) + n) % n : Math.max(0, Math.min(n - 1, c))];
  const N = rows.map((row, r) => row.map((p, c) => {
    let nn = unit(cross(sub(P(r, c + 1), P(r, c - 1)), sub(P(r + 1, c), P(r - 1, c))));
    if (dot(nn, o.out(p)) < 0) nn = mul(nn, -1);
    return nn;
  }));
  G.tag = tag;
  const faces = [], start = G.polys.length;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const c1 = (c + 1) % n, q = [id[r][c], id[r][c1], id[r + 1][c1], id[r + 1][c]];
    G.poly(q, o.mat?.call ? o.mat(r, c) : mat, tag);
    faces.push([rows[r][c], rows[r][c1], rows[r + 1][c1]], [rows[r][c], rows[r + 1][c1], rows[r + 1][c]]);
  }
  // the border: loops of { r, c, sides (of the vertex), seg (the side of the segment from it to the next) }
  const loops = [];
  if (ring) {
    loops.push(Array.from({ length: n }, (_, c) => ({ r: 0, c, sides: ['top'], seg: 'top' })));
    loops.push(Array.from({ length: n }, (_, c) => ({ r: R, c: n - 1 - c, sides: ['bottom'], seg: 'bottom' })));
  } else {
    const L = [];
    for (let c = 0; c < C; c++) L.push({ r: 0, c, sides: c === 0 ? ['top', 'left'] : ['top'], seg: 'top' });
    for (let r = 0; r < R; r++) L.push({ r, c: C, sides: r === 0 ? ['top', 'right'] : ['right'], seg: 'right' });
    for (let c = C; c > 0; c--) L.push({ r: R, c, sides: c === C ? ['bottom', 'right'] : ['bottom'], seg: 'bottom' });
    for (let r = R; r > 0; r--) L.push({ r, c: 0, sides: r === R ? ['bottom', 'left'] : ['left'], seg: 'left' });
    loops.push(L);
  }
  // (a side's kind, or a function of the grid point the segment starts at)
  const kindOf = (s, r, c) => { const k = o.border?.[s] ?? 'trim'; return typeof k === 'function' ? k(r, c) : k; };
  for (const L of loops) {
    const pts = L.map(({ r, c, sides }) => {
      const b = rows[r][c], nn = N[r][c];
      let d = [0, 0, 0];
      for (const s of sides) d = add(d, unit(sub(b, s === 'top' ? P(r + 1, c) : s === 'bottom' ? P(r - 1, c) : s === 'left' ? P(r, c + 1) : P(r, c - 1))));
      d = unit(sub(d, mul(nn, dot(d, nn))));
      const w = rim.w * (o.wScale?.(r, c) ?? 1);
      const trim = sides.some((s) => kindOf(s, r, c) === 'trim' || (s === 'top' && kindOf(s, r, c - 1) === 'trim') || (s === 'bottom' && kindOf(s, r, c + 1) === 'trim'));
      const T = trim ? add(add(b, mul(d, w)), mul(nn, rim.h)) : b;
      const E = add(add(b, mul(d, trim ? w + 0.01 : 0.01)), mul(nn, -rim.t));
      return { b: id[r][c], T, E };
    });
    const lazy = (k, key) => { const x = pts[k]; if (x[key + 'i'] == null) x[key + 'i'] = V(x[key]); return x[key + 'i']; };
    for (let k = 0; k < L.length; k++) {
      const j = (k + 1) % L.length, kind = kindOf(L[k].seg, L[k].r, L[k].c);
      if (kind === 'open') continue;
      if (kind === 'trim') {
        G.poly([pts[k].b, pts[j].b, lazy(j, 'T'), lazy(k, 'T')], 'gold', tag);
        G.poly([lazy(k, 'T'), lazy(j, 'T'), lazy(j, 'E'), lazy(k, 'E')], o.edgeMat ?? 'gold', tag);
      } else {
        G.poly([pts[k].b, pts[j].b, lazy(j, 'E'), lazy(k, 'E')], o.edgeMat ?? 'gold', tag);
      }
    }
  }
  piece(G, start, o.out);
  const plate = { faces, N, rows, tag, wt, out: o.out, p0: start, p1: G.polys.length };
  G.plates.push(plate);
  return plate;
}

/** The polygons from `start` on, each connected piece wound consistently and outward (out(centroid), lowgarment.mjs orient). */
const piece = (G, start, out) => orient({ verts: G.verts, polys: G.polys.slice(start) }, out);

/** Points on the polygons from p0 to p1 (their corners and a grid on each triangle about `step` apart). */
function surfOf(G, p0, p1 = G.polys.length, step = 0.07) {
  const out = [];
  for (let k = p0; k < p1; k++) {
    const v = G.polys[k].v;
    for (let j = 1; j + 1 < v.length; j++) {
      const [a, b, c] = [v[0], v[j], v[j + 1]].map((i) => G.verts[i]);
      const n = Math.max(1, Math.ceil(Math.max(Math.hypot(...sub(b, a)), Math.hypot(...sub(c, b)), Math.hypot(...sub(a, c))) / step));
      for (let i = 0; i <= n; i++) for (let jj = 0; jj <= n - i; jj++) { const u = i / n, w = jj / n, x = 1 - u - w; out.push([a[0] * x + b[0] * u + c[0] * w, a[1] * x + b[1] * u + c[1] * w, a[2] * x + b[2] * u + c[2] * w]); }
    }
  }
  return out;
}

/** The closest point on a plate's face to p, and the face's normal there (out). */
function onPlate(pl, p, out) {
  let best = null;
  for (const [a, b, c] of pl.faces) {
    const [q] = closestOnTri(p, a, b, c), d = Math.hypot(...sub(p, q));
    if (!best || d < best.d) { let n = unit(cross(sub(b, a), sub(c, a))); if (dot(n, out) < 0) n = mul(n, -1); best = { d, q, n }; }
  }
  return best;
}
/** A point on a plate's grid at fractional row rf and column cf (bilinear), laid on its face. */
function gridAt(pl, rf, cf) {
  const R = pl.rows.length - 1, n = pl.rows[0].length;
  const r0 = Math.max(0, Math.min(R - 1, Math.floor(rf))), c0 = Math.max(0, Math.min(n - 2, Math.floor(cf)));
  const u = rf - r0, v = cf - c0, P = pl.rows;
  const p = lerp(lerp(P[r0][c0], P[r0][c0 + 1], v), lerp(P[r0 + 1][c0], P[r0 + 1][c0 + 1], v), u);
  const nn = unit(lerp(lerp(pl.N[r0][c0], pl.N[r0][c0 + 1], v), lerp(pl.N[r0 + 1][c0], pl.N[r0 + 1][c0 + 1], v), u));
  return onPlate(pl, p, nn);
}

/**
 * A core on a plate: a gold ring (n sides, radius r) standing on it round a glowing dome. At p (on the plate's face),
 * `up` the way its first corner points.
 */
function coreOn(G, pl, p, up, r, nSides, tag) {
  const h0 = onPlate(pl, p, up.out ?? [0, 0, 1]), n = h0.n, c = h0.q;
  let u = sub(up.dir, mul(n, dot(up.dir, n))); u = unit(u);
  const v = cross(n, u);
  const V = (q) => { const i = G.vert(q, tag); G.wt[i] = pl.wt; return i; };
  const ringAt = (k, rad, lift) => {
    const a = (k / nSides) * 2 * Math.PI, q = add(c, add(mul(u, Math.cos(a) * rad), mul(v, Math.sin(a) * rad)));
    const h = onPlate(pl, q, n);
    return V(add(h.q, mul(h.n, lift)));
  };
  const H = r * 0.32;
  const base = Array.from({ length: nSides }, (_, k) => ringAt(k, r, 0.02));
  const top = Array.from({ length: nSides }, (_, k) => ringAt(k, r * 0.84, H));
  const inner = Array.from({ length: nSides }, (_, k) => ringAt(k, r * 0.68, H * 0.85));
  const tip = V(add(c, mul(n, H * 1.45)));
  G.tag = tag;
  const start = G.polys.length;
  for (let k = 0; k < nSides; k++) {
    const j = (k + 1) % nSides;
    G.poly([base[k], base[j], top[j], top[k]], 'gold', tag);
    G.poly([top[k], top[j], inner[j], inner[k]], 'gold', tag);
    G.poly([inner[k], inner[j], tip], 'core', tag);
  }
  piece(G, start, () => n);
}
/** An inlay: a gold strip of width w along points on a plate (each { q, n } from gridAt / onPlate), lifted off its face. */
function inlayOn(G, pl, pts0, w, tag, mat = 'rune', lift = 0.022) {
  // (each span split in four, the points between laid back on the plate's face, so the strip follows its curve)
  const pts = [];
  pts0.forEach((h, k) => {
    pts.push(h);
    const b = pts0[k + 1];
    if (b) for (const t of [0.25, 0.5, 0.75]) pts.push(onPlate(pl, lerp(h.q, b.q, t), unit(lerp(h.n, b.n, t))));
  });
  const V = (q) => { const i = G.vert(q, tag); G.wt[i] = pl.wt; return i; };
  const L = pts.map((h, k) => {
    const tan = unit(sub(pts[Math.min(k + 1, pts.length - 1)].q, pts[Math.max(k - 1, 0)].q)), x = unit(cross(h.n, tan));
    const base = add(h.q, mul(h.n, lift));
    return [V(add(base, mul(x, -w / 2))), V(add(base, mul(x, w / 2)))];
  });
  G.tag = tag;
  const start = G.polys.length;
  for (let k = 0; k + 1 < L.length; k++) G.poly([L[k][0], L[k + 1][0], L[k + 1][1], L[k][1]], mat, tag, true);
  piece(G, start, () => pts[0].n);
}

/** A table's value at azimuth a (its `az` over |a|, 0 the front to 180 the back), linear between its columns. */
export function tabAt(T, key, a) {
  const x = Math.abs(((a + 540) % 360) - 180), A = T.az, V = T[key];
  if (x <= A[0]) return V[0];
  for (let i = 0; i + 1 < A.length; i++) if (x <= A[i + 1]) return V[i] + ((V[i + 1] - V[i]) * (x - A[i])) / (A[i + 1] - A[i]);
  return V[V.length - 1];
}
/* ---- the pieces -------------------------------------------------------------------------------------------------------- */
const AZ = (deg) => deg;
/** A list by column for a symmetric piece ([centre ... side]) laid out from one side through the centre to the other. */
const mirrorCols = (L, neg = (x) => x) => [...L.slice(1).reverse().map(neg), ...L];

/** Where a horizontal ray from o along d (unit, level) meets a grid's face (its furthest crossing), or 0. */
function rayGrid(rows, ring, o, d) {
  const R = rows.length - 1, n = rows[0].length, C = ring ? n : n - 1;
  let best = 0;
  for (let r = 0; r < R; r++) for (let k = 0; k < C; k++) {
    const k1 = (k + 1) % n;
    for (const [a, b, c] of [[rows[r][k], rows[r][k1], rows[r + 1][k1]], [rows[r][k], rows[r + 1][k1], rows[r + 1][k]]]) {
      const e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
      if (Math.abs(det) < 1e-12) continue;
      const f = 1 / det, s0 = sub(o, a), u = f * dot(s0, h); if (u < -1e-6 || u > 1 + 1e-6) continue;
      const q = cross(s0, e1), v = f * dot(d, q); if (v < -1e-6 || u + v > 1 + 1e-6) continue;
      const t = f * dot(e2, q); if (t > best) best = t;
    }
  }
  return best;
}
/**
 * Shingled: each upper plate's foot row pushed out until every plate under it (lower) lies at least `gap` inside it
 * there, down to its rim's edge (`drop` below the foot): the upper plate's edge, turned in by the rim's thickness, then
 * clears the face of the one it overlaps. Radii about the trunk's axis (axisAt).
 */
function shingle(upper, lowers, axisAt, gap, drop) {
  const foot = upper.rows[upper.rows.length - 1];
  foot.forEach((p, j) => {
    const o0 = axisAt(p[1]), d = unit([p[0] - o0[0], 0, p[2] - o0[2]]);
    let need = 0;
    for (const y of [p[1], p[1] - drop / 2, p[1] - drop]) {
      const o = axisAt(y);
      for (const L of lowers) need = Math.max(need, rayGrid(L.rows, L.ring, [o[0], y, o[2]], d) + gap);
    }
    const r = Math.hypot(p[0] - o0[0], p[2] - o0[2]);
    if (need > r) {
      const push = need - r;
      foot[j] = add(p, mul(d, push));
      // (the row above it a share, so the plate keeps its line)
      if (upper.rows.length > 2) { const q = upper.rows[upper.rows.length - 2][j]; upper.rows[upper.rows.length - 2][j] = add(q, mul(d, push * 0.4)); }
    }
  });
}

function torsoPieces(G, rig, D, S) {
  const { B } = rig, rim = D.rim;
  // (one section of the trunk for every plate on it, so plates over one another are fitted to the same hull)
  const { chest, fsec, fz, parts } = trunkCharts(D, S);
  const low = chest;
  const outOf = (sec) => (p) => { const a = sec.axisAt(p[1]); return [p[0] - a[0], 0, p[2] - a[2]]; };
  const trunk = parts(['torso', 'neck', 'pelvis']), hipS = parts(['torso', 'pelvis', 'legs']).filter((p) => p[1] > D.faulds.top - 3);
  // the set's leggings under the belt and the faulds (D.legs: their hip band's top and foot and their outer face's
  // clearance off the body by row down it, held below): the body there pushed out by it, sideways from the thigh's axis
  // or the pelvis's, a surface the belt and the faulds clear by the rim's thickness and the gap
  let legS = null;
  if (D.legs) {
    const Lg = D.legs, hx = rig.J.hip[0], hz = rig.J.hip[2];
    const cl = (y) => { const f = (Lg.top - y) / (Lg.top - Lg.bottom) * (Lg.c.length - 1); if (f <= 0) return Lg.c[0]; if (f >= Lg.c.length - 1) return Lg.c[Lg.c.length - 1]; const i = Math.floor(f); return Lg.c[i] + (Lg.c[i + 1] - Lg.c[i]) * (f - i); };
    legS = S.filter((s0) => ['pelvis', 'legs'].includes(s0.part) && s0.p[1] < Lg.top + 0.05 && s0.p[1] > Lg.bottom - 2.2).map(({ p, part }) => {
      const o = part === 'legs' ? [Math.sign(p[0]) * hx, hz] : [0, hz], d = unit([p[0] - o[0], 0, p[2] - o[1]]);
      return add(p, mul(d, cl(p[1])));
    });
  }
  const grid = (sec, az, top, bottom, rows, c, extra = () => 0) => rows.map((f, r) => az.map((a, k) => {
    const y = top[k] + (bottom[k] - top[k]) * f;
    return sec.at(y, a, (Array.isArray(c) ? c[r] : c) + extra(r, k, a));
  }));

  const Cd = D.collar;
  // the breastplate (spine_03): columns from the right side through the front to the left
  const Bp = D.breast;
  const bAz = mirrorCols(Bp.az, (x) => -x), bTop = mirrorCols(Bp.top), bBot = mirrorCols(Bp.bottom);
  const bRows = grid(chest, bAz, bTop, bBot, Bp.rows, Bp.c);
  // drawn straight across between the breasts (the columns within `flat` of the front on the line between the two at
  // `flat`), never further in than the body; the bridged rows no further in than the mean of the rows either side
  const rad = (p) => { const a = chest.axisAt(p[1]); return Math.hypot(p[0] - a[0], p[2] - a[2]); };
  const setRad = (p, r) => { const a = chest.axisAt(p[1]), d = unit([p[0] - a[0], 0, p[2] - a[2]]); return [a[0] + d[0] * r, p[1], a[2] + d[2] * r]; };
  bRows.forEach((row, r) => {
    if (r === 0) return;
    const ia = bAz.indexOf(Bp.flat), ib = bAz.indexOf(-Bp.flat);
    if (ia < 0 || ib < 0) return;
    const A = row[ia], Bq = row[ib];
    for (let k = Math.min(ia, ib) + 1; k < Math.max(ia, ib); k++) {
      const t = (row[k][0] - Bq[0]) / (A[0] - Bq[0]), q = lerp(Bq, A, t);
      if (rad(q) > rad(row[k])) row[k] = setRad(row[k], rad(q));
    }
  });
  for (const r of Bp.bridge ?? []) bRows[r].forEach((p, k) => { const want = (rad(bRows[r - 1][k]) + rad(bRows[r + 1][k])) / 2; if (rad(p) < want) bRows[r][k] = setRad(p, want); });
  fitOut(bRows, false, outOf(chest), trunk, D.fit.trunk);
  // the back plate (spine_03): from the left side round the back to the right, a ridge down the middle, its sides tucked
  // under the breastplate's
  const Kp = D.back;
  // (columns: 84 .. 180 .. 276)
  const kAzL = [...Kp.az, ...Kp.az.slice(0, -1).reverse().map((a) => 360 - a)];
  const kTop = [...Kp.top, ...Kp.top.slice(0, -1).reverse()], kBot = [...Kp.bottom, ...Kp.bottom.slice(0, -1).reverse()];
  const midK = Kp.az.length - 1;
  const kRows = grid(chest, kAzL, kTop, kBot, Kp.rows, Kp.c, (r, k) => (k === midK ? Kp.ridge : k === 0 || k === kAzL.length - 1 ? -Kp.side : 0));
  fitOut(kRows, false, outOf(chest), trunk, D.fit.trunk);
  // the lames and the belt: rings round the waist, the top tucked under the plate above, the foot with a V at the front
  const K = D.lames.some((L) => L.edge) ? 24 : D.lameCols, ringAz = Array.from({ length: K }, (_, k) => (k * 360) / K);
  const lames = D.lames.map((L) => {
    // (its edges by azimuth: a table over |az| from the front, `edge`, or a level top and a foot with a V at the front)
    const rows = [0, 1].map((f) => ringAz.map((a) => {
      const yb = L.edge ? tabAt(L.edge, 'bottom', a) : L.bottom - L.v * Math.max(0, Math.cos(a * Math.PI / 180)) ** 2;
      const y = (L.edge ? tabAt(L.edge, 'top', a) : L.top) + (yb - (L.edge ? tabAt(L.edge, 'top', a) : L.top)) * f;
      return chest.at(y, a, L.c[f]);
    }));
    fitOut(rows, true, outOf(chest), trunk, D.fit.lame);
    return { rows, ring: true, L };
  });
  // the faulds: plates hanging from the belt over the upper thigh, out by the clearance and flaring as they fall
  const F = D.faulds;
  const fauldRows = [];
  for (const pl of F.plates) for (const s of pl.mirror ? [1, -1] : [1]) {
    const az = (s > 0 ? pl.az : pl.az.slice().reverse().map((a) => -a));
    const bottom = s > 0 ? pl.bottom : pl.bottom.slice().reverse();
    const nRows = 2, rows = [];
    for (let r = 0; r < nRows; r++) rows.push(az.map((a, k) => {
      const f = r / (nRows - 1), y = F.top + (bottom[k] - F.top) * f;
      // (the reach here, and never further in than the row above, flaring out as it falls)
      let p = fsec.at(y, a, F.c + F.flare * (F.top - y) / 2);
      if (r > 0) {
        const prev = rows[r - 1][k], d = unit([Math.sin(a * Math.PI / 180), 0, Math.cos(a * Math.PI / 180)]);
        const rp = dot(sub(prev, [0, prev[1], fz]), d), rc = dot(sub(p, [0, p[1], fz]), d);
        if (rc < rp) p = add([0, y, fz], mul(d, rp));
      }
      return p;
    }));
    fitOut(rows, false, (p) => [p[0], 0, p[2] - fz], legS ? [[hipS, D.fit.fauld], [legS, rim.t + D.fit.gap]] : hipS, D.fit.fauld);
    const bone = s > 0 ? pl.bone : Object.fromEntries(Object.entries(pl.bone).map(([b, w]) => [b.replace(/_l$/, '_x').replace(/_r$/, '_l').replace(/_x$/, '_r'), w]));
    fauldRows.push({ rows, ring: false, az, bone, name: pl.mirror ? (s > 0 ? 'fauld.l' : 'fauld.r') : Math.abs(az[(az.length - 1) / 2]) > 90 ? 'fauld.b' : 'fauld.f' });
  }
  // laid from the inside out, each fitted over the ones under it as well as the body (clear of their faces by the rim's
  // thickness and a gap): the faulds, the belt over their tops, each lame over the one under it, the back and breast
  // plates over the lames
  const gap = rim.t + D.fit.gap, under = legS ? [legS] : [];
  // (the front and back plates first, the side plates over them)
  fauldRows.sort((a, b) => /[lr]$/.test(a.name) - /[lr]$/.test(b.name));
  const fauldSurf = [];
  const faulds = fauldRows.map(({ rows, az, bone, name }) => {
    if (/[lr]$/.test(name)) fitOut(rows, false, (p) => [p[0], 0, p[2] - fz], [[hipS, D.fit.fauld], ...(legS ? [[legS, gap]] : []), ...fauldSurf.map((P) => [P, gap])]);
    const f0 = G.polys.length;
    const pc = plateOf(G, rows, { tag: 'fauld', bone, rim, out: (p) => [p[0], 0, p[2] - fz], border: { top: 'open' } });
    // the V trim: a gold inlay from either top corner down to the middle of the foot
    const M = (az.length - 1) / 2;
    inlayOn(G, pc, [[0.12, 0.3], [0.55, M], [0.12, az.length - 1.3]].map(([rf, cf]) => gridAt(pc, rf, cf)), 0.07, 'fauld inlay');
    for (let k = f0; k < G.polys.length; k++) G.polys[k].piece = name;
    if (!/[lr]$/.test(name)) fauldSurf.push(surfOf(G, f0));
    return pc;
  });
  under.push(surfOf(G, Math.min(...faulds.map((f) => f.p0))));
  for (let li = lames.length - 1; li >= 0; li--) {
    const { rows, L } = lames[li], p0 = G.polys.length;
    fitOut(rows, true, outOf(chest), [[trunk, D.fit.lame], ...under.map((P) => [P, gap])]);
    plateOf(G, rows, { tag: `lame ${li + 1}`, bone: L.bone, rim, out: outOf(chest), ring: true, border: { top: 'open', bottom: 'trim' }, mat: L.mat ?? 'plate' });
    for (let k = p0; k < G.polys.length; k++) G.polys[k].piece = L.piece;
    under.push(surfOf(G, p0));
  }
  fitOut(kRows, false, outOf(chest), [[trunk, D.fit.trunk], ...under.map((P) => [P, gap])]);
  fitOut(bRows, false, outOf(chest), [[trunk, D.fit.trunk], ...under.map((P) => [P, gap])]);

  G.trunkStart = G.polys.length;
  const breast = plateOf(G, bRows, { tag: 'breast', bone: { spine_03: 1 }, rim, out: outOf(chest), border: { top: (r, c) => (Math.abs(bAz[c]) <= Cd.open && Math.abs(bAz[c + 1] ?? 999) <= Cd.open ? 'open' : 'trim') } });
  // the core under the collar's notch, and the inlays from it: down the middle to the V, and out and down either side
  const mid = (bAz.length - 1) / 2, R = Bp.rows.length - 1;
  const coreP = chest.at(Bp.core.y, 0, Bp.c[1] + 0.02);
  coreOn(G, breast, coreP, { dir: [0, 1, 0], out: [0, 0, 1] }, Bp.core.r, Bp.core.n, 'breast core');
  const fr = (y) => { // the row fraction at height y down the middle column
    const t = (y - bTop[mid]) / (bBot[mid] - bTop[mid]);
    for (let r = 0; r < R; r++) if (t <= Bp.rows[r + 1]) return r + (t - Bp.rows[r]) / (Bp.rows[r + 1] - Bp.rows[r]);
    return R;
  };
  const r0 = fr(Bp.core.y - Bp.core.r * 1.05);
  inlayOn(G, breast, [r0, (r0 + R) / 2, R - 0.12].map((rf) => gridAt(breast, rf, mid)), 0.045, 'inlay');
  // (the side inlays by azimuth, `inlayAz` the columns' spacing they were drawn for, so they keep their place however
  // many columns the plate has)
  const colAt = (a) => { const s0 = Math.sign(a) || 1, x = Math.abs(a), A = Bp.az; let c = A.length - 1; for (let i = 0; i + 1 < A.length; i++) if (x <= A[i + 1]) { c = i + (x - A[i]) / (A[i + 1] - A[i]); break; } return mid + s0 * c; };
  const ia = Bp.inlayAz ?? 22;
  for (const s of [-1, 1]) {
    const pts = [[fr(Bp.core.y) - 0.05, 0.55], [fr(Bp.core.y) + 0.2, 1.3], [fr(Bp.core.y) + 0.85, 1.9], [R - 0.25, 2.15]];
    inlayOn(G, breast, pts.map(([rf, cf]) => gridAt(breast, rf, colAt(s * cf * ia))), 0.04, 'inlay');
    const pts2 = [[fr(Bp.core.y) + 0.45, 0.45], [fr(Bp.core.y) + 1.1, 0.85], [R - 0.2, 1.0]];
    inlayOn(G, breast, pts2.map(([rf, cf]) => gridAt(breast, rf, colAt(s * cf * ia))), 0.035, 'inlay');
  }

  const backTop = (r, c) => (Math.abs(180 - kAzL[c]) <= 45 && Math.abs(180 - (kAzL[c + 1] ?? 999)) <= 45 ? 'open' : 'trim');
  plateOf(G, kRows, { tag: 'back', bone: { spine_03: 1 }, rim, out: outOf(chest), border: { left: 'edge', right: 'edge', top: backTop },  mat: (r, c) => (c === 0 || c === kAzL.length - 2 ? 'shade' : 'plate') });
  G.trunkEnd = G.polys.length;

  // the collar: segments round the neck (front left and right, the back), each a wall with a gold top and a dark inside,
  // standing out of the plates' top edge
  const { nz, r0n } = collarFrame(D, S, B);
  // (heights by azimuth: the sheet's table `topTab` over |az|, or [front, side, back] blended)
  // (Cd.lip [az, y]: the front no higher than y within az of the middle, easing back by az + 20, so the helm's visor
  // clears it as the head nods)
  const lipCap = (a, y) => { if (!Cd.lip) return y; const x = Math.abs(((a + 540) % 360) - 180), [az, ly] = Cd.lip; return x <= az ? Math.min(y, ly) : x >= az + 20 ? y : Math.min(y, ly + ((y - ly) * (x - az)) / 20); };
  const hAt = (L, a) => { if (L === Cd.top && Cd.topTab) return lipCap(a, tabAt(Cd.topTab, 'top', a)); if (L === Cd.top) return lipCap(a, hAt0(L, a)); return hAt0(L, a); };
  const hAt0 = (L, a) => { const x = Math.abs(a) / 180; return x < 0.5 ? L[0] + (L[1] - L[0]) * x * 2 : L[1] + (L[2] - L[1]) * (x - 0.5) * 2; };
  // (the segments' columns: the front flaps from `seg.a0` to `seg.a1` either side, the back from a1 + gap round; or
  // the design's few)
  const span = (a, b, n) => Array.from({ length: n + 1 }, (_, k) => +(a + ((b - a) * k) / n).toFixed(2));
  const cols = Cd.seg ? [span(Cd.seg.a0, Cd.seg.a1, Math.max(2, Math.round((Cd.seg.a1 - Cd.seg.a0) / 12))), span(Cd.seg.a1 + Cd.seg.gap, 180, Math.max(2, Math.round((180 - Cd.seg.a1 - Cd.seg.gap) / 12)))] : Cd.cols;
  const segs = [{ cols: cols[0], s: 1, front: true }, { cols: cols[0], s: -1, front: true }, { cols: [...cols[1], ...cols[1].slice(0, -1).reverse().map((a) => 360 - a)], s: 1 }];
  for (const sg of segs) {
    const az = sg.s > 0 ? sg.cols : sg.cols.slice().reverse().map((a) => -a);
    // (the foot stands on the plates' top edge: the chest's reach there, out past the plates' clearance, kept within
    // `spread` of the neck's ring; the top round the neck)
    // (the wall's top round the neck: its own reach that way at any height the collar spans, out by the clearance; the
    // foot `spread` further out, set on the skin there: the highest of the trunk's samples at that radius and azimuth)
    const rTop = r0n + Cd.c;
    const rFoot = () => rTop + Cd.spread;
    const surfY = (a, at = rFoot()) => {
      let y = -Infinity;
      for (const p of trunk) {
        if (p[1] < -1.6) continue;
        const r = Math.hypot(p[0], p[2] - nz), d = Math.abs(((Math.atan2(p[0], p[2] - nz) * 180 / Math.PI - a + 540) % 360) - 180);
        if (d < 14 && Math.abs(r - at) < 0.1) y = Math.max(y, p[1]);
      }
      return y;
    };
    const P = (a, y, dr, f = 1, yb = y) => { const t = a * Math.PI / 180, rr = rFoot(a, yb) + (rTop - rFoot(a, yb)) * f + dr; return [Math.sin(t) * rr, y, nz + Math.cos(t) * rr]; };
    const wrap = (a) => ((a + 540) % 360) - 180;
    const yb = az.map((a) => Math.min(hAt(Cd.top, wrap(a)) - 0.3, Math.max(hAt(Cd.base, wrap(a)), surfY(a) - Cd.sink))), yt = az.map((a) => hAt(Cd.top, wrap(a)));
    const fr = (k, y) => (y - yb[k]) / (yt[k] - yb[k]);
    const outer = [az.map((a, k) => P(a, yb[k], 0, 0, yb[k])), az.map((a, k) => P(a, yt[k] - Cd.trim, Cd.flare * 0.8, fr(k, yt[k] - Cd.trim), yb[k])), az.map((a, k) => P(a, yt[k], Cd.flare, 1, yb[k]))];
    // (the inside's foot above the skin under it: the trapezius rises toward the neck)
    const yIn = az.map((a, k) => Math.min(yt[k] - 0.08, Math.max(yb[k] + 0.1, surfY(a, rTop - Cd.wall) + 0.04)));
    const inner = [az.map((a, k) => P(a, yt[k], Cd.flare - Cd.wall, 1, yb[k])), az.map((a, k) => P(a, yIn[k], -Cd.wall, fr(k, yIn[k]), yb[k]))];
    // (the front segments a fixed share on their side's clavicle, so they rise with the shoulder's shrug over the
    // trapezius; the back one on the chest alone)
    const cw = sg.front ? { spine_03: 1 - Cd.shrug, [`clavicle_${sg.s > 0 ? 'l' : 'r'}`]: Cd.shrug } : { spine_03: 1 };
    const V = (p) => { const i = G.vert(p, 'collar'); G.wt[i] = cw; return i; };
    const io = outer.map((row) => row.map(V)), ii = inner.map((row) => row.map(V));
    const rowsAll = [...io, ...ii], mats = ['plate', 'gold', 'gold', 'under'];
    G.tag = 'collar';
    const start = G.polys.length;
    for (let r = 0; r + 1 < rowsAll.length; r++) for (let k = 0; k + 1 < az.length; k++) G.poly([rowsAll[r][k], rowsAll[r][k + 1], rowsAll[r + 1][k + 1], rowsAll[r + 1][k]], mats[r], 'collar');
    // the ends: gold, closed from the outside's foot to the inside's foot
    for (const k of [0, az.length - 1]) G.poly(rowsAll.map((row) => row[k]), 'gold', 'collar');
    piece(G, start, (c) => [c[0], 0, c[2] - nz]);
    for (let k = start; k < G.polys.length; k++) G.polys[k].piece = sg.front ? (sg.s > 0 ? 'collar.l' : 'collar.r') : 'collar.back';
  }
  return { chest, low, faulds };
}

/**
 * The pauldron's frame on the left shoulder: its centre (the shoulder's joint, lifted), the direction at (ψ round the
 * pole, φ from it), the body's reach that way (over a cone, the samples near the shoulder), φ's foot by ψ.
 */
export function pauldronFrame(rig, D, S) {
  const { J } = rig, Pd = D.pauldron, UP = [0, 1, 0], FWD = [0, 0, 1];
  const centre = add(add(J.shoulder, mul(UP, Pd.lift)), [-Pd.inset, 0, 0]);
  const pole = unit(add(mul(UP, 1 - Pd.pole), mul([1, 0, 0], Pd.pole)));
  const q1 = unit(sub(FWD, mul(pole, dot(FWD, pole)))), q2 = cross(pole, q1);
  const near = S.filter((s) => ['joint', 'arm', 'torso'].includes(s.part) && Math.hypot(...sub(s.p, centre)) < Pd.near && s.p[0] > J.shoulder[0] * 0.55).map((s) => s.p);
  const reach = (dir) => {
    const cc = Math.cos(Pd.cone * Math.PI / 180);
    let r = 0;
    for (const p of near) { const d = sub(p, centre), l = Math.hypot(...d), cs = dot(d, dir) / (l || 1); if (cs > cc) r = Math.max(r, l * cs); }
    return r;
  };
  // (φ's reach by ψ: [front, out, back, in] blended)
  const phiMax = (psi) => { const t = psi * Math.PI / 180, c = Math.cos(t), s = Math.sin(t); const [f, o, b, i] = Pd.phi; return (c > 0 ? f * c : b * -c) + (s > 0 ? o * s : i * -s) - (Math.abs(c) + Math.abs(s) - 1) * 40; };
  const dirAt = (psi, phi) => { const a = psi * Math.PI / 180, b = phi * Math.PI / 180; return unit(add(mul(pole, Math.cos(b)), mul(add(mul(q1, Math.cos(a)), mul(q2, Math.sin(a))), Math.sin(b)))); };
  // (q2 = pole x q1: with q1 forward, ψ 90 is toward -x; ψ is taken round so that 90 is out)
  const outSign = dot(q2, [1, 0, 0]) >= 0 ? 1 : -1;
  return { centre, pole, dirAt, reach, near, outSign, phiMax };
}

/**
 * The left arm's sections: the upper arm's (t from the shoulder's joint toward the elbow), the forearm's (from the
 * elbow toward the wrist) and the wrist's (the forearm's axis from the wrist, with the hand); θ 0 forward, 90 out.
 */
export function armCharts(rig, S) {
  const { J } = rig, FWD = [0, 0, 1];
  const frameOf = (o, tail) => {
    const a = unit(sub(tail, o)), e1 = unit(sub(FWD, mul(a, dot(FWD, a)))), e2 = cross(e1, a);
    return { o, a, e1, e2: dot(e2, [1, 0, 0]) >= 0 ? e2 : mul(e2, -1), len: Math.hypot(...sub(tail, o)) };
  };
  const armS = S.filter((s) => (s.part === 'arm' || s.part === 'joint') && s.p[0] > 0).map((s) => s.p);
  const up = frameOf(J.shoulder, J.elbow), fo = frameOf(J.elbow, J.wrist);
  const upper = sectioner(armS, { ...up, dt: 0.12 }), fore = sectioner(armS, { ...fo, dt: 0.12 });
  const wsec = sectioner(armS.concat(S.filter((s) => s.part === 'hand' && s.p[0] > 0).map((s) => s.p)), { ...fo, o: J.wrist, dt: 0.1 });
  return { frameOf, armS, up, fo, upper, fore, wsec };
}

/* ---- the arm (built on the left, mirrored) ----------------------------------------------------------------------------- */
function armPieces(G, rig, D, S) {
  const { B, J } = rig, rim = D.rim;
  const UP = [0, 1, 0], FWD = [0, 0, 1];
  const { frameOf, armS, up, fo, upper, fore, wsec } = armCharts(rig, S);
  const outOf = (fr) => (p) => { const d = sub(p, fr.o), t = dot(d, fr.a); return sub(d, mul(fr.a, t)); };

  // the pauldron's cap (on the shoulder helper: half the upper arm's turn): a dome over the shoulder round a pole up and
  // out, each point the body's reach that way from the centre (over a cone) out by the clearance
  const Pd = D.pauldron;
  const { centre, dirAt, reach, near, outSign, phiMax } = pauldronFrame(rig, D, S);
  const psiN = Pd.hull ? Pd.hull.psi.length : Pd.cols, psis = Pd.hull ? Pd.hull.psi : Array.from({ length: psiN }, (_, k) => (k * 360) / psiN);
  let capRows;
  if (Pd.hull) {
    // (the sheet's dome: per column its radius from the centre down to its foot, `hull` { psi, f (rows, 0 the top to 1
    // the foot), phi (the foot's φ per column), r (radius per row and column) }, never closer than the body's reach
    // and the plate's clearance)
    const H = Pd.hull;
    capRows = H.f.map((f, r) => H.psi.map((psi, k) => {
      const phi = Pd.phi0 + (H.phi[k] - Pd.phi0) * f, d = dirAt(psi * outSign, phi);
      return add(centre, mul(d, Math.max(H.r[r][k], reach(d) + D.fit.arm + 0.02)));
    }));
    // (smoothed round each row and down each column, never in from its own: one shell over the deltoid's bumps)
    for (let it = 0; it < 3; it++) {
      const rr = capRows.map((row) => row.map((p) => Math.hypot(...sub(p, centre))));
      capRows = capRows.map((row, r) => row.map((p, k) => {
        const n = row.length, m = (rr[r][(k + n - 1) % n] + 2 * rr[r][k] + rr[r][(k + 1) % n] + rr[Math.max(0, r - 1)][k] + rr[Math.min(rr.length - 1, r + 1)][k]) / 6;
        return add(centre, mul(unit(sub(p, centre)), Math.max(m, rr[r][k])));
      }));
    }
  } else {
    capRows = Pd.rows.map((f, r) => psis.map((psi) => {
      const ps = psi * outSign, phi = Pd.phi0 + (phiMax(psi) - Pd.phi0) * f, d = dirAt(ps, phi);
      // (its clearance the row's on the outside, `inner` of that toward the front, the back and the neck: the sheet's
      // pauldron stands far out over the arm and close over the chest and the back)
      const out = Math.max(0, Math.sin(psi * Math.PI / 180)), k = Pd.inner + (1 - Pd.inner) * out;
      return add(centre, mul(d, reach(d) + Pd.c[r] * k));
    }));
    // (rounded toward a dome: each point's distance from the centre `round` of the way to the cap's farthest, so the
    // pauldron is a shell over the shoulder rather than a skin on the deltoid)
    const far = Math.max(...capRows.flat().map((p) => Math.hypot(...sub(p, centre))));
    capRows.forEach((row) => row.forEach((p, k) => { const l = Math.hypot(...sub(p, centre)); row[k] = add(centre, mul(sub(p, centre), (l + (far - l) * Pd.round) / l)); }));
    // (smoothed round each row: each point's distance the mean of its own and its neighbours', never further in than its own)
    for (const row of capRows) {
      const rr = row.map((p) => Math.hypot(...sub(p, centre)));
      row.forEach((p, k) => { const m = (rr[(k + psiN - 1) % psiN] + 2 * rr[k] + rr[(k + 1) % psiN]) / 4; row[k] = add(centre, mul(unit(sub(p, centre)), Math.max(m, rr[k] * 0.97))); });
    }
  }
  // (each piece fitted over the body and the pieces under it, laid from the inside out: the sleeve, the gauntlet, the
  // vambrace, the cuff over both, the rerebrace, the pauldron's lames, its cap)
  const gap = rim.t + D.fit.gap, lay = (p0) => surfOf(G, p0);
  // the under-layer: a sleeve of the arm's own rings, pushed out from each ring's middle (skinned as those rings)
  // (from the torso's ring where the arm meets it, `$torso`, over the armpit to the forearm inside the vambrace; each
  // ring's vertices pushed out along the body's normals there)
  const VN = B.verts.map(() => [0, 0, 0]);
  for (const t of B.tris) { const [a, b, c] = t.v.map((i) => B.verts[i]), n = cross(sub(b, a), sub(c, a)); for (const i of t.v) VN[i] = add(VN[i], n); }
  const ringPts = (nm) => (nm === '$torso' ? TORSO_RING.map((n) => B.index.get(`${n}.L`)) : Array.from({ length: 8 }, (_, k) => B.index.get(`arm/${nm}${k}.L`)));
  const rings = D.sleeve.rings.map(([nm, c]) => ringPts(nm).map((i) => { const v = G.vert(add(B.verts[i], mul(unit(VN[i]), c)), 'sleeve'); G.wt[v] = { $body: i }; return v; }));
  G.tag = 'sleeve';
  const sStart = G.polys.length;
  for (let r = 0; r + 1 < rings.length; r++) for (let k = 0; k < 8; k++) G.poly([rings[r][k], rings[r][(k + 1) % 8], rings[r + 1][(k + 1) % 8], rings[r + 1][k]], 'under', 'sleeve');
  piece(G, sStart, (c) => { const lines = [up, fo].map((fr) => { const d = sub(c, fr.o), t = Math.max(0, Math.min(fr.len, dot(d, fr.a))); return sub(d, mul(fr.a, t)); }); return Math.hypot(...lines[0]) < Math.hypot(...lines[1]) ? lines[0] : lines[1]; });

  const sleeveS = lay(sStart);
  // the gauntlet: the hand's own polygons, pushed out along the vertex normals (skinned as the hand, so it curls with
  // it): the back plate, the palm and the fingers' undersides a shade down, the knuckles' row gold
  const handPolys = B.polys.filter((p) => p.part === 'hand' && p.v.every((i) => B.verts[i][0] > 0));
  const hv = new Map(), nrm = new Map();
  for (const p of handPolys) {
    const n = unit(cross(sub(B.verts[p.v[1]], B.verts[p.v[0]]), sub(B.verts[p.v[2]], B.verts[p.v[0]])));
    for (const i of p.v) nrm.set(i, add(nrm.get(i) ?? [0, 0, 0], n));
  }
  // (the outward sense: away from the hand's middle)
  const hm = mul([...nrm.keys()].reduce((a, i) => add(a, B.verts[i]), [0, 0, 0]), 1 / nrm.size);
  const flip = [...nrm].reduce((s, [i, n]) => s + dot(n, sub(B.verts[i], hm)), 0) < 0 ? -1 : 1;
  for (const [i, n] of nrm) { const v = G.vert(add(B.verts[i], mul(unit(n), flip * D.hand.off)), 'gauntlet'); G.wt[v] = { $body: i }; hv.set(i, v); }
  G.tag = 'gauntlet';
  const gStart = G.polys.length;
  for (const p of handPolys) {
    const nm = p.name;
    const mat = /palm|thumb mound|web/.test(nm) ? 'shade' : 'plate';
    G.poly(p.v.map((i) => hv.get(i)), mat, 'gauntlet', true);
  }
  piece(G, gStart, (c) => sub(c, hm));
  const gauntS = lay(gStart);
  // the rerebrace (the upper arm): open toward the body
  const Rr = D.rerebrace;
  const rTh = Array.from({ length: Rr.cols }, (_, k) => Rr.th[0] + ((Rr.th[1] - Rr.th[0]) * k) / (Rr.cols - 1));
  const rStart = G.polys.length;
  plateOf(G, [0, 1].map((f) => rTh.map((a) => upper.at(Rr.t[0] + (Rr.t[1] - Rr.t[0]) * f, a, Rr.c[f]))), { tag: 'rerebrace', bone: { upperarm_l: 1 }, rim, out: outOf(up), fit: { S: [[armS, D.fit.arm], [sleeveS, gap]] }, border: { top: 'open' } });
  const underArm = [[armS, D.fit.arm], [sleeveS, gap], [lay(rStart), gap]];

  // the vambrace (the forearm): an angular tube, its top flared and high over the elbow's point, low at its inside
  // (columns from the front round, one straight out: there the plate's ridge stands `ridge` further off, the
  // sheet's angular outer face)
  const Vb = D.vambrace, vTh = Array.from({ length: Vb.cols }, (_, k) => (k * 360) / Vb.cols + (Vb.ridge ? 0 : 360 / Vb.cols / 2));
  const vR = (a) => (Vb.ridge ?? 0) * Math.max(0, Math.cos(((a - 90) * Math.PI) / 180)) ** 4;
  const tTop = (a) => { const t = a * Math.PI / 180, c = Math.cos(t), s = Math.sin(t); const [f, o, b, i] = Vb.top; return (c > 0 ? f * c * c : b * c * c) + (s > 0 ? o * s * s : i * s * s); };
  const vRows = [
    vTh.map((a) => fore.at(tTop(a), a, Vb.c[0] + Vb.flare + vR(a))),
    vTh.map((a) => fore.at(Vb.mid, a, Vb.c[1] + vR(a))),
    vTh.map((a) => fore.at(Vb.bottom, a, Vb.c[2] + vR(a) * 0.6)),
  ];
  const vStart = G.polys.length;
  const vam = plateOf(G, vRows, { tag: 'vambrace', bone: { lowerarm_l: 0.5, lowerarm_twist_01_l: 0.5 }, rim, out: outOf(fo), ring: true, fit: { S: [[armS, D.fit.arm], [sleeveS, gap], underArm[2]] }, border: { bottom: 'open' }, mat: (r, c) => (Math.cos(vTh[c] * Math.PI / 180) < -0.3 && Math.sin(vTh[c] * Math.PI / 180) < 0.3 ? 'shade' : 'plate') });
  // its diamond on the outside (glowing, in a gold frame) and an inlay down from it
  {
    const cOut = vTh.reduce((best, a, k) => (Math.sin(a * Math.PI / 180) > Math.sin(vTh[best] * Math.PI / 180) ? k : best), 0);
    const cD = Vb.ridge ? cOut : cOut + 0.5, h = gridAt(vam, 1.45, cD);
    const along = unit(fo.a), n = h.n, x = unit(cross(n, along)), r = Vb.diamond.r;
    const V = (q) => { const i = G.vert(q, 'diamond'); G.wt[i] = vam.wt; return i; };
    const c0 = add(h.q, mul(n, 0.015));
    const outer = [mul(along, -r * 1.5), mul(x, r), mul(along, r * 1.5), mul(x, -r)].map((d) => V(add(add(c0, d), mul(n, 0.0))));
    const innerP = [mul(along, -r * 0.9), mul(x, r * 0.55), mul(along, r * 0.9), mul(x, -r * 0.55)].map((d) => V(add(add(c0, d), mul(n, 0.035))));
    G.tag = 'diamond';
    for (let k = 0; k < 4; k++) G.poly([outer[k], outer[(k + 1) % 4], innerP[(k + 1) % 4], innerP[k]], 'gold', 'diamond', true);
    G.poly(innerP, 'core', 'diamond', true);
    inlayOn(G, vam, [0.2, 0.9].map((rf) => gridAt(vam, rf, cD)), 0.035, 'vambrace inlay', 'rune', 0.022);
  }

  // the gauntlet's cuff (the wrist helper: half the hand's turn), flared over the vambrace's foot
  const Cf = D.cuff, cTh = Array.from({ length: Cf.cols }, (_, k) => (k * 360) / Cf.cols + 360 / Cf.cols / 2);
  plateOf(G, [0, 1].map((f) => cTh.map((a) => wsec.at(Cf.t[0] + (Cf.t[1] - Cf.t[0]) * f, a, Cf.c[1 - f]))), { tag: 'cuff', bone: { wrist_l: 1 }, rim, out: outOf({ ...fo, o: J.wrist }), ring: true, border: { top: 'edge' }, fit: { S: [[surfOf(G, vStart), gap], [gauntS, gap]] } });

  // its lames under it down the upper arm (on the upper arm), open toward the body
  for (const [li, L] of [...Pd.lames.entries()].reverse()) {
    const th = [L.th[0], (L.th[0] * 2 + L.th[1]) / 3, (L.th[0] + L.th[1] * 2) / 3, L.th[1]];
    const ths = [L.th[0], ...[1, 2, 3].map((k) => L.th[0] + ((L.th[1] - L.th[0]) * k) / 4), L.th[1]];
    void th;
    const p0 = G.polys.length;
    const rows = [0, 1].map((f) => ths.map((a) => upper.at(L.t[0] + (L.t[1] - L.t[0]) * f, a, L.c[f])));
    plateOf(G, rows, { tag: `pauldron lame ${li + 1}`, bone: li === 0 ? { shoulder_l: 0.5, upperarm_l: 0.5 } : { upperarm_l: 1 }, rim, out: outOf(up), fit: { S: underArm }, border: { top: 'open' } });
    underArm.push([lay(p0), gap]);
  }
  // (over the breast and back plates too, where its inside edge lies on them)
  const trunkSurf = surfOf(G, G.trunkStart, G.trunkEnd).filter((p) => p[0] > 0);
  const cap = plateOf(G, capRows, { tag: 'pauldron', bone: { shoulder_l: 1 }, rim, out: (p) => sub(p, centre), ring: true, fit: { S: [[near, D.fit.arm], [trunkSurf, gap], ...underArm.slice(3)] }, border: { top: 'open', bottom: 'trim' } });
  // (its top closed by one polygon)
  { const ids = capRows[0].map((p) => G.verts.findIndex((q) => q === p)); G.tag = 'pauldron'; G.poly(ids.slice().reverse(), 'plate', 'pauldron'); }
  // its core, on the outside
  const footPhi = (psi) => (Pd.hull ? Pd.hull.phi[Math.round((psi / 360) * psiN) % psiN] : phiMax(psi));
  const coreAt = add(centre, mul(dirAt(Pd.core.psi * outSign, Pd.phi0 + (footPhi(Pd.core.psi) - Pd.phi0) * Pd.core.f), 3));
  const nRows = (Pd.hull ? Pd.hull.f : Pd.rows).length - 1;
  coreOn(G, cap, gridAt(cap, Pd.core.f * nRows, (Pd.core.psi / 360) * psiN).q, { dir: UP, out: sub(coreAt, centre) }, Pd.core.r, Pd.core.n, 'pauldron core');
}

/* ---- the whole piece ---------------------------------------------------------------------------------------------------- */
const mirrorName = (n) => n.replace(/_l$/, '_r');
/** The body's samples, each with its part: its vertices and a grid on each triangle about 0.08 apart. */
export function bodySamples(B) {
  const S = [];
  B.verts.forEach((p, i) => S.push({ p, part: B.part[i] }));
  for (const t of B.tris) {
    const [a, b, c] = t.v.map((i) => B.verts[i]), part = B.part[t.v[0]];
    const n = Math.max(1, Math.ceil(Math.max(Math.hypot(...sub(b, a)), Math.hypot(...sub(c, b)), Math.hypot(...sub(a, c))) / 0.08));
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) { const u = i / n, v = j / n, w = 1 - u - v; S.push({ p: [a[0] * w + b[0] * u + c[0] * v, a[1] * w + b[1] * u + c[1] * v, a[2] * w + b[2] * u + c[2] * v], part }); }
  }
  return S;
}
/**
 * The design as built: DESIGN[who] with the sheet's fit over it (tools/sculpt/plate/chest-fit.json, written by
 * tools/sculpt/lowplatechestsolve.mjs: each plate's outline read off the sheet), key by key.
 */
export function designOf(who) {
  const D = structuredClone(DESIGN[who]);
  const f = new URL('../plate/chest-fit.json', import.meta.url);
  if (!existsSync(f)) return D;
  const F = JSON.parse(readFileSync(f, 'utf8'))[who] ?? {};
  const over = (a, b) => { for (const [k, v] of Object.entries(b)) a[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) ? over(a[k], v) : v; return a; };
  return over(D, F);
}
/** The collar's frame: the neck's axis (its z) and reach (the furthest of the neck's samples round it). */
export function collarFrame(D, S, B) {
  // (the neck's own vertices: samples on triangles that only start at the neck reach out over the shoulders)
  const neck = sectioner(B.verts.filter((_, i) => B.part[i] === 'neck'), { o: [0, 0, 0], a: [0, 1, 0], e1: [0, 0, 1], e2: [1, 0, 0], dt: 0.12, centred: true });
  const nz = neck.axisAt(-0.45)[2], nr = (a) => Math.max(...[-0.5, -0.3, -0.1, 0.05].map((y) => { const p = neck.at(y, a, 0); return Math.hypot(p[0], p[2] - nz); }));
  const r0n = Math.max(...[0, 30, 60, 90, 120, 150, 180].map(nr));
  return { nz, r0n, rTop: r0n + D.collar.c };
}
/** The trunk's sections the plates are laid on: the chest's (the torso, neck and pelvis) and the faulds' (the hips). */
export function trunkCharts(D, S) {
  const parts = (names) => S.filter((s) => names.includes(s.part)).map((s) => s.p);
  const chest = sectioner(parts(['torso', 'neck', 'pelvis']), { o: [0, 0, 0], a: [0, 1, 0], e1: [0, 0, 1], e2: [1, 0, 0], dt: 0.06, centred: true, wedge: D.wedge });
  const F = D.faulds, fz = chest.axisAt(F.top)[2];
  const fsec = sectioner(parts(['torso', 'pelvis', 'legs']).filter((p) => p[1] > F.top - 3.2), { o: [0, 0, fz], a: [0, 1, 0], e1: [0, 0, 1], e2: [1, 0, 0], dt: 0.12 });
  // (a fauld's face at height y round az: the hips' reach out by the clearance, flaring as it falls)
  const fauldAt = (y, a) => fsec.at(y, a, F.c + F.flare * (F.top - y) / 2);
  return { chest, fsec, fz, fauldAt, parts };
}

export function buildPlateChest(rig, design = designOf(rig.who)) {
  const D = design, { B } = rig;
  const G = meshOf();
  G.wt = []; G.plates = [];
  const S = bodySamples(B);
  torsoPieces(G, rig, D, S);
  // the left arm, then mirrored onto the right
  const v0 = G.verts.length, p0 = G.polys.length;
  armPieces(G, rig, D, S);
  const v1 = G.verts.length, p1 = G.polys.length, map = new Map();
  for (let i = v0; i < v1; i++) {
    const p = G.verts[i], j = G.vert([-p[0], p[1], p[2]], G.part[i]);
    const w = G.wt[i];
    G.wt[j] = w.$body !== undefined ? { $body: B.index.get(B.names[w.$body].replace(/\.L$/, '.R')) } : Object.fromEntries(Object.entries(w).map(([b, x]) => [mirrorName(b), x]));
    map.set(i, j);
  }
  for (let k = p0; k < p1; k++) { const p = G.polys[k]; G.polys.push({ ...p, v: p.v.map((i) => map.get(i)).reverse() }); }
  G.side = G.verts.map((p) => (p[0] >= 0 ? 'L' : 'R'));
  G.tris = trisOf(G);
  G.design = D;
  G.hides = hiddenPolys(rig, G);
  return G;
}

/**
 * The armour's weights: each plate's own list (the same at every vertex), the sleeve's and the gauntlet's the body's
 * vertex they were pushed out from.
 */
export function plateChestWeights(rig, G) {
  return G.wt.map((w) => {
    if (w.$body !== undefined) return rig.vw[w.$body].map(([b, x]) => [b, x]);
    const l = Object.entries(w).map(([n, x]) => [rig.at.get(n), x]);
    if (l.some(([b]) => b === undefined)) throw new Error(`no bone in ${JSON.stringify(w)}`);
    return l;
  });
}

/**
 * The body's polygons the armour covers whole: a body vertex is covered when a ray out along its normal meets the
 * armour within `reach`, or it is the hand's (under the gauntlet); a polygon is hidden when all its corners are.
 */
export function hiddenPolys(rig, G, { reach = 0.6 } = {}) {
  const { B } = rig;
  const N = B.verts.map(() => [0, 0, 0]);
  for (const t of B.tris) { const [a, b, c] = t.v.map((i) => B.verts[i]), n = cross(sub(b, a), sub(c, a)); for (const i of t.v) N[i] = add(N[i], n); }
  const T = G.tris.map((t) => t.v.map((i) => G.verts[i]));
  const hit = (o, d) => {
    for (const [a, b, c] of T) {
      const e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
      if (Math.abs(det) < 1e-12) continue;
      const f = 1 / det, s = sub(o, a), u = f * dot(s, h); if (u < 0 || u > 1) continue;
      const q = cross(s, e1), v = f * dot(d, q); if (v < 0 || u + v > 1) continue;
      const t = f * dot(e2, q); if (t > 0 && t < reach) return true;
    }
    return false;
  };
  // (the arm and the shoulder's joint above the forearm's top ring all under the sleeve, the pauldron and its lames)
  const faY = Math.min(...Array.from({ length: 8 }, (_, k) => B.verts[B.index.get(`arm/fa${k}.L`)][1]));
  const cov = B.verts.map((p, i) => {
    if (B.part[i] === 'hand') return true;
    if ((B.part[i] === 'arm' || B.part[i] === 'joint') && p[1] > faY) return true;
    if (!['torso', 'arm', 'joint', 'neck', 'pelvis'].includes(B.part[i])) return false;
    return hit(p, unit(N[i]));
  });
  return B.polys.map((p, k) => (p.v.every((i) => cov[i]) ? k : -1)).filter((k) => k >= 0);
}

/* ---- the game's copy ------------------------------------------------------------------------------------------------ */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync } = await import('node:fs');
  const { buildRig } = await import('../lowrig.mjs');
  const { garmentAsset } = await import('../lowgarment.mjs');
  for (const who of ['male', 'female']) {
    const rig = buildRig(who), G = buildPlateChest(rig);
    G.vw = plateChestWeights(rig, G);
    const file = new URL(`../../../src/sculpt/assets/lowplatechest-${who}.json`, import.meta.url);
    const A = { built: 'node tools/sculpt/garments/platechest.mjs (tools/sculpt/lowgarment.mjs garmentAsset)', ...garmentAsset(rig, G, MATS, LOOKS), hides: G.hides };
    writeFileSync(file, JSON.stringify(A));
    console.log(who, `${G.verts.length} vertices, ${G.tris.length} triangles, ${A.base} + ${A.bones.length} bones, hides ${G.hides.length} body polygons: wrote`, file.pathname);
  }
}
