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
//     (lowgarment.mjs garmentAsset, with `hides` and `glow`, the materials drawn unlit; loaded by src/sculpt/lowpoly.ts)
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

/**
 * The materials, shared with the rest of the plate set by name and colour (so the game gives each one slot): plate (the
 * cream stone, as it reads under the bodies' light), shade (a step darker), gold (the trim and the inlays), glow (the
 * cores, drawn unlit: GLOW), under (the dark under-layer).
 */
export const MATS = { plate: [0.91, 0.78, 0.74], shade: [0.8, 0.67, 0.63], gold: [0.851, 0.659, 0.353], glow: [1, 0.906, 0.651], under: [0.29, 0.22, 0.2] };
/** The materials drawn unlit (emissive, always lit, blooming as the enchanted sword's engraving). */
export const GLOW = ['glow'];

/**
 * The design per body. Heights are the body's y; az, azimuth round the torso (0 the front, 90 the body's left); θ round
 * a limb (0 forward, 90 out, 180 back); t along a limb's bone from its head. Lists by column are [front ... back] for a
 * symmetric piece, mirrored. `c` clearances off the body (the hull of its samples); rim { w, h, t }: the gold rim's width
 * and rise, the plate's thickness behind it.
 */
export const DESIGN = {
  male: {
    rim: { w: 0.11, h: 0.04, t: 0.05 },
    fit: { trunk: 0.07, lame: 0.05, fauld: 0.12, arm: 0.05 },
    collar: { cols: [[14, 62, 112], [108, 144, 180]], base: [-0.78, -0.78, -0.62], top: [-0.14, 0.02, 0.18], trim: 0.12, c: 0.16, flare: 0.05, wall: 0.07, foot: 0.02, spread: 0.3 },
    breast: { az: [0, 22, 46, 70, 94], top: [-0.62, -0.64, -0.68, -0.82, -1.95], bottom: [-3.1, -2.9, -2.65, -2.5, -2.45], rows: [0, 0.4, 0.75, 1], c: [0.1, 0.12, 0.14, 0.17], core: { y: -1.4, r: 0.4, n: 8 } },
    back: { az: [84, 110, 135, 158, 180], top: [-1.95, -0.78, -0.6, -0.56, -0.54], bottom: [-2.5, -2.8, -3.0, -3.12, -3.25], rows: [0, 0.45, 1], c: [0.09, 0.11, 0.14], ridge: 0.08 },
    lames: [
      { bone: { spine_02: 1 }, top: -2.35, bottom: -3.05, v: 0.12, c: [0.05, 0.12] },
      { bone: { spine_01: 1 }, top: -2.85, bottom: -3.5, v: 0.1, c: [0.05, 0.12] },
      { bone: { pelvis: 1 }, top: -3.3, bottom: -3.95, v: 0.08, c: [0.05, 0.11], mat: 'shade' },
    ],
    lameCols: 10,
    faulds: {
      top: -3.8, c: 0.16, flare: 0.1,
      plates: [
        { az: [-26, 0, 26], bottom: [-5.3, -5.75, -5.3], bone: { pelvis: 0.6, thigh_l: 0.2, thigh_r: 0.2 } },
        { az: [24, 50, 76], bottom: [-5.45, -5.6, -5.35], bone: { pelvis: 0.45, thigh_l: 0.55 }, mirror: true },
        { az: [140, 180, 220], bottom: [-5.25, -5.6, -5.25], bone: { pelvis: 0.7, thigh_l: 0.15, thigh_r: 0.15 } },
      ],
    },
    pauldron: {
      lift: 0.12, inset: 0.05, pole: 0.45, near: 1.0, cols: 8, phi0: 22, phi: [72, 82, 72, 66], rows: [0, 0.55, 1], c: [0.14, 0.16, 0.18], cone: 34,
      core: { psi: 90, f: 0.6, r: 0.27, n: 6 },
      lames: [{ t: [0.22, 0.6], c: [0.13, 0.2], th: [-40, 230] }, { t: [0.48, 0.86], c: [0.1, 0.17], th: [-30, 220] }],
    },
    rerebrace: { t: [0.95, 1.7], c: [0.07, 0.09], th: [-45, 228], cols: 5 },
    sleeve: { rings: [['jb', 0.04], ['uc', 0.05], ['el', 0.05], ['fa', 0.04]] },
    vambrace: { cols: 6, top: [0.42, 0.2, -0.32, 0.2], mid: 0.55, bottom: 1.3, c: [0.13, 0.08, 0.08], flare: 0.1, diamond: { t: 0.6, r: 0.14 } },
    cuff: { cols: 6, t: [-0.42, 0.06], c: [0.13, 0.17] },
    hand: { off: 0.045 },
  },
  female: {
    rim: { w: 0.095, h: 0.035, t: 0.045 },
    fit: { trunk: 0.06, lame: 0.045, fauld: 0.1, arm: 0.045 },
    collar: { cols: [[14, 62, 112], [108, 144, 180]], base: [-0.85, -0.78, -0.62], top: [-0.2, -0.05, 0.1], trim: 0.11, c: 0.13, flare: 0.04, wall: 0.06, foot: 0.02, spread: 0.25 },
    breast: { az: [0, 22, 46, 70, 94], top: [-0.7, -0.72, -0.76, -0.88, -1.85], bottom: [-2.6, -2.45, -2.25, -2.15, -2.1], rows: [0, 0.35, 0.7, 1], c: [0.08, 0.09, 0.1, 0.12], core: { y: -1.35, r: 0.33, n: 8 } },
    back: { az: [84, 110, 135, 158, 180], top: [-1.85, -0.9, -0.72, -0.64, -0.6], bottom: [-2.15, -2.4, -2.55, -2.65, -2.75], rows: [0, 0.45, 1], c: [0.07, 0.09, 0.11], ridge: 0.06 },
    lames: [
      { bone: { spine_02: 1 }, top: -2.0, bottom: -2.6, v: 0.1, c: [0.04, 0.1] },
      { bone: { spine_01: 1 }, top: -2.45, bottom: -3.0, v: 0.08, c: [0.04, 0.1] },
      { bone: { pelvis: 1 }, top: -2.8, bottom: -3.35, v: 0.06, c: [0.04, 0.09], mat: 'shade' },
    ],
    lameCols: 10,
    faulds: {
      top: -3.2, c: 0.14, flare: 0.1,
      plates: [
        { az: [-26, 0, 26], bottom: [-4.55, -4.95, -4.55], bone: { pelvis: 0.6, thigh_l: 0.2, thigh_r: 0.2 } },
        { az: [24, 50, 76], bottom: [-4.65, -4.8, -4.55], bone: { pelvis: 0.45, thigh_l: 0.55 }, mirror: true },
        { az: [140, 180, 220], bottom: [-4.45, -4.8, -4.45], bone: { pelvis: 0.7, thigh_l: 0.15, thigh_r: 0.15 } },
      ],
    },
    pauldron: {
      lift: 0.1, inset: 0.05, pole: 0.45, near: 0.85, cols: 8, phi0: 22, phi: [70, 80, 70, 64], rows: [0, 0.55, 1], c: [0.11, 0.12, 0.13], cone: 34,
      core: { psi: 90, f: 0.6, r: 0.22, n: 6 },
      lames: [{ t: [0.2, 0.52], c: [0.1, 0.16], th: [-40, 230] }, { t: [0.42, 0.74], c: [0.08, 0.13], th: [-30, 220] }],
    },
    rerebrace: { t: [0.82, 1.45], c: [0.06, 0.08], th: [-45, 228], cols: 5 },
    sleeve: { rings: [['jb', 0.035], ['uc', 0.04], ['el', 0.045], ['fa', 0.035]] },
    vambrace: { cols: 6, top: [0.38, 0.18, -0.28, 0.18], mid: 0.5, bottom: 1.2, c: [0.11, 0.07, 0.07], flare: 0.08, diamond: { t: 0.55, r: 0.12 } },
    cuff: { cols: 6, t: [-0.38, 0.05], c: [0.11, 0.15] },
    hand: { off: 0.04 },
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
function sectioner(S, { o, a, e1, e2, dt = 0.1, centred = false }) {
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
  const at = (t, th, c = 0) => {
    const { H, u0 } = hull(t), d = dirOf(th), r = rayHull(H, [u0, 0], d) + c;
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
function fitOut(rows, ring, out, S, c, passes = 4) {
  const R = rows.length - 1, n = rows[0].length, C = ring ? n : n - 1;
  for (let it = 0; it < passes; it++) {
    const need = rows.map((row) => row.map(() => 0)), dir = rows.map((row) => row.map(() => [0, 0, 0]));
    let moved = false;
    for (let r = 0; r < R; r++) for (let k = 0; k < C; k++) {
      const k1 = (k + 1) % n;
      for (const tri of [[[r, k], [r, k1], [r + 1, k1]], [[r, k], [r + 1, k1], [r + 1, k]]]) {
        const [a, b, cc] = tri.map(([i, j]) => rows[i][j]);
        let nn = unit(cross(sub(b, a), sub(cc, a)));
        const mid = mul(add(add(a, b), cc), 1 / 3);
        if (dot(nn, out(mid)) < 0) nn = mul(nn, -1);
        const lo = [0, 1, 2].map((j) => Math.min(a[j], b[j], cc[j]) - 0.3), hi = [0, 1, 2].map((j) => Math.max(a[j], b[j], cc[j]) + 0.3);
        let worst = 0;
        for (const p of S) {
          if (p[0] < lo[0] || p[0] > hi[0] || p[1] < lo[1] || p[1] > hi[1] || p[2] < lo[2] || p[2] > hi[2]) continue;
          const d = dot(sub(p, a), nn);
          if (d < -c || d > 0.6) continue;
          const [q, w] = closestOnTri(p, a, b, cc);
          if (Math.hypot(...sub(sub(p, q), mul(nn, dot(sub(p, q), nn)))) > 1e-3) continue;
          worst = Math.max(worst, d + c);
        }
        if (worst > 1e-4) { moved = true; for (const [i, j] of tri) { need[i][j] = Math.max(need[i][j], worst); dir[i][j] = add(dir[i][j], nn); } }
      }
    }
    if (!moved) break;
    rows.forEach((row, i) => row.forEach((p, j) => { if (need[i][j] > 0) { const d = unit(dir[i][j]); row[j] = add(p, mul(d, need[i][j])); } }));
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
  const kindOf = (s) => o.border?.[s] ?? 'trim';
  for (const L of loops) {
    const pts = L.map(({ r, c, sides }) => {
      const b = rows[r][c], nn = N[r][c];
      let d = [0, 0, 0];
      for (const s of sides) d = add(d, unit(sub(b, s === 'top' ? P(r + 1, c) : s === 'bottom' ? P(r - 1, c) : s === 'left' ? P(r, c + 1) : P(r, c - 1))));
      d = unit(sub(d, mul(nn, dot(d, nn))));
      const w = rim.w * (o.wScale?.(r, c) ?? 1);
      const trim = sides.some((s) => kindOf(s) === 'trim');
      const T = trim ? add(add(b, mul(d, w)), mul(nn, rim.h)) : b;
      const E = add(add(b, mul(d, trim ? w + 0.01 : 0.01)), mul(nn, -rim.t));
      return { b: id[r][c], T, E };
    });
    const lazy = (k, key) => { const x = pts[k]; if (x[key + 'i'] == null) x[key + 'i'] = V(x[key]); return x[key + 'i']; };
    for (let k = 0; k < L.length; k++) {
      const j = (k + 1) % L.length, kind = kindOf(L[k].seg);
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
  const plate = { faces, N, rows, tag, wt, out: o.out };
  G.plates.push(plate);
  return plate;
}

/** The polygons from `start` on, each connected piece wound consistently and outward (out(centroid), lowgarment.mjs orient). */
const piece = (G, start, out) => orient({ verts: G.verts, polys: G.polys.slice(start) }, out);

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
  const base = Array.from({ length: nSides }, (_, k) => ringAt(k, r, 0.006));
  const top = Array.from({ length: nSides }, (_, k) => ringAt(k, r * 0.84, H));
  const inner = Array.from({ length: nSides }, (_, k) => ringAt(k, r * 0.68, H * 0.85));
  const tip = V(add(c, mul(n, H * 1.45)));
  G.tag = tag;
  const start = G.polys.length;
  for (let k = 0; k < nSides; k++) {
    const j = (k + 1) % nSides;
    G.poly([base[k], base[j], top[j], top[k]], 'gold', tag);
    G.poly([top[k], top[j], inner[j], inner[k]], 'gold', tag);
    G.poly([inner[k], inner[j], tip], 'glow', tag);
  }
  piece(G, start, () => n);
}
/** An inlay: a gold strip of width w along points on a plate (each { q, n } from gridAt / onPlate), lifted off its face. */
function inlayOn(G, pl, pts, w, tag, mat = 'gold', lift = 0.012) {
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

/* ---- the pieces -------------------------------------------------------------------------------------------------------- */
const AZ = (deg) => deg;
/** A list by column for a symmetric piece ([centre ... side]) laid out from one side through the centre to the other. */
const mirrorCols = (L, neg = (x) => x) => [...L.slice(1).reverse().map(neg), ...L];

function torsoPieces(G, rig, D, S) {
  const { B } = rig, rim = D.rim;
  const parts = (names) => S.filter((s) => names.includes(s.part)).map((s) => s.p);
  const chest = sectioner(parts(['torso', 'neck']), { o: [0, 0, 0], a: [0, 1, 0], e1: [0, 0, 1], e2: [1, 0, 0], dt: 0.1, centred: true });
  const low = sectioner(parts(['torso', 'pelvis']), { o: [0, 0, 0], a: [0, 1, 0], e1: [0, 0, 1], e2: [1, 0, 0], dt: 0.1, centred: true });
  const outOf = (sec) => (p) => { const a = sec.axisAt(p[1]); return [p[0] - a[0], 0, p[2] - a[2]]; };
  const trunk = parts(['torso', 'neck', 'pelvis']), hipS = parts(['torso', 'pelvis', 'legs']).filter((p) => p[1] > D.faulds.top - 3);
  const grid = (sec, az, top, bottom, rows, c, extra = () => 0) => rows.map((f, r) => az.map((a, k) => {
    const y = top[k] + (bottom[k] - top[k]) * f;
    return sec.at(y, a, (Array.isArray(c) ? c[r] : c) + extra(r, k, a));
  }));

  // the breastplate (spine_03): columns from the right side through the front to the left
  const Bp = D.breast;
  const bAz = mirrorCols(Bp.az, (x) => -x), bTop = mirrorCols(Bp.top), bBot = mirrorCols(Bp.bottom);
  const breast = plateOf(G, grid(chest, bAz, bTop, bBot, Bp.rows, Bp.c), { tag: 'breast', bone: { spine_03: 1 }, rim, out: outOf(chest), fit: { S: trunk, c: D.fit.trunk } });
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
  for (const s of [-1, 1]) {
    const pts = [[fr(Bp.core.y) - 0.05, mid + s * 0.55], [fr(Bp.core.y) + 0.2, mid + s * 1.3], [fr(Bp.core.y) + 0.85, mid + s * 1.9], [R - 0.25, mid + s * 2.15]];
    inlayOn(G, breast, pts.map(([rf, cf]) => gridAt(breast, rf, cf)), 0.04, 'inlay');
    const pts2 = [[fr(Bp.core.y) + 0.45, mid + s * 0.45], [fr(Bp.core.y) + 1.1, mid + s * 0.85], [R - 0.2, mid + s * 1.0]];
    inlayOn(G, breast, pts2.map(([rf, cf]) => gridAt(breast, rf, cf)), 0.035, 'inlay');
  }

  // the back plate (spine_03): from the left side round the back to the right, a ridge down the middle
  const Kp = D.back;
  // (columns: 84 .. 180 .. 276)
  const kAzL = [...Kp.az, ...Kp.az.slice(0, -1).reverse().map((a) => 360 - a)];
  const kTop = [...Kp.top, ...Kp.top.slice(0, -1).reverse()], kBot = [...Kp.bottom, ...Kp.bottom.slice(0, -1).reverse()];
  const midK = Kp.az.length - 1;
  plateOf(G, grid(chest, kAzL, kTop, kBot, Kp.rows, Kp.c, (r, k) => (k === midK ? Kp.ridge : 0)), { tag: 'back', bone: { spine_03: 1 }, rim, out: outOf(chest), fit: { S: trunk, c: D.fit.trunk }, mat: (r, c) => (c === 0 || c === kAzL.length - 2 ? 'shade' : 'plate') });

  // the lames and the belt: rings round the waist, the top tucked under the plate above, the foot with a V at the front
  const K = D.lameCols, ringAz = Array.from({ length: K }, (_, k) => (k * 360) / K);
  for (const [li, L] of D.lames.entries()) {
    const sec = li === 0 ? chest : low;
    const rows = [0, 1].map((f) => ringAz.map((a) => {
      const yb = L.bottom - L.v * Math.max(0, Math.cos(a * Math.PI / 180)) ** 2, y = L.top + (yb - L.top) * f;
      return sec.at(y, a, L.c[f]);
    }));
    plateOf(G, rows, { tag: `lame ${li + 1}`, bone: L.bone, rim, out: outOf(sec), ring: true, fit: { S: trunk, c: D.fit.lame }, border: { top: 'open', bottom: 'trim' }, mat: L.mat ?? 'plate' });
  }

  // the faulds: plates hanging from the belt over the upper thigh, out by the clearance and flaring as they fall
  const F = D.faulds;
  const hips = sectioner(parts(['torso', 'pelvis', 'legs']), { o: [0, 0, 0], a: [0, 1, 0], e1: [0, 0, 1], e2: [1, 0, 0], dt: 0.12, centred: false });
  const fz = low.axisAt(F.top)[2];
  const fsec = sectioner(parts(['torso', 'pelvis', 'legs']).filter((p) => p[1] > F.top - 3.2), { o: [0, 0, fz], a: [0, 1, 0], e1: [0, 0, 1], e2: [1, 0, 0], dt: 0.12 });
  void hips;
  const faulds = [];
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
    const bone = s > 0 ? pl.bone : Object.fromEntries(Object.entries(pl.bone).map(([b, w]) => [b.replace(/_l$/, '_x').replace(/_r$/, '_l').replace(/_x$/, '_r'), w]));
    const pc = plateOf(G, rows, { tag: 'fauld', bone, rim, out: (p) => [p[0], 0, p[2] - fz], border: { top: 'open' }, fit: { S: hipS, c: D.fit.fauld } });
    // the V trim: a gold inlay from either top corner down to the middle of the foot
    const M = (az.length - 1) / 2;
    inlayOn(G, pc, [[0.12, 0.3], [0.55, M], [0.12, az.length - 1.3]].map(([rf, cf]) => gridAt(pc, rf, cf)), 0.07, 'fauld inlay');
    faulds.push(pc);
  }

  // the collar: segments round the neck (front left and right, the back), each a wall with a gold top and a dark inside,
  // standing out of the plates' top edge
  const Cd = D.collar;
  const neck = sectioner(parts(['neck']), { o: [0, 0, 0], a: [0, 1, 0], e1: [0, 0, 1], e2: [1, 0, 0], dt: 0.12, centred: true });
  const nz = neck.axisAt(-0.45)[2], nr = (a) => { const p = neck.at(-0.3, a, 0); return Math.hypot(p[0], p[2] - nz); };
  const r0n = Math.max(...[0, 45, 90, 135, 180].map(nr));
  const hAt = (L, a) => { const x = Math.abs(a) / 180; return x < 0.5 ? L[0] + (L[1] - L[0]) * x * 2 : L[1] + (L[2] - L[1]) * (x - 0.5) * 2; };
  const segs = [{ cols: Cd.cols[0], s: 1 }, { cols: Cd.cols[0], s: -1 }, { cols: [...Cd.cols[1], ...Cd.cols[1].slice(0, -1).reverse().map((a) => 360 - a)], s: 1 }];
  for (const sg of segs) {
    const az = sg.s > 0 ? sg.cols : sg.cols.slice().reverse().map((a) => -a);
    // (the foot stands on the plates' top edge: the chest's reach there, out past the plates' clearance, kept within
    // `spread` of the neck's ring; the top round the neck)
    const rTop = r0n + Cd.c;
    const rFoot = (a, y) => { const p = chest.at(y, a, Bp.c[0] + Cd.foot); return Math.max(rTop, Math.min(rTop + Cd.spread, Math.hypot(p[0], p[2] - nz))); };
    const P = (a, y, dr, f = 1, yb = y) => { const t = a * Math.PI / 180, rr = rFoot(a, yb) + (rTop - rFoot(a, yb)) * f + dr; return [Math.sin(t) * rr, y, nz + Math.cos(t) * rr]; };
    const wrap = (a) => ((a + 540) % 360) - 180;
    const yb = az.map((a) => hAt(Cd.base, wrap(a))), yt = az.map((a) => hAt(Cd.top, wrap(a)));
    const fr = (k, y) => (y - yb[k]) / (yt[k] - yb[k]);
    const outer = [az.map((a, k) => P(a, yb[k], 0, 0, yb[k])), az.map((a, k) => P(a, yt[k] - Cd.trim, Cd.flare * 0.8, fr(k, yt[k] - Cd.trim), yb[k])), az.map((a, k) => P(a, yt[k], Cd.flare, 1, yb[k]))];
    const inner = [az.map((a, k) => P(a, yt[k], Cd.flare - Cd.wall, 1, yb[k])), az.map((a, k) => P(a, yb[k] + 0.1, -Cd.wall, fr(k, yb[k] + 0.1), yb[k]))];
    const V = (p) => { const i = G.vert(p, 'collar'); G.wt[i] = { spine_03: 1 }; return i; };
    const io = outer.map((row) => row.map(V)), ii = inner.map((row) => row.map(V));
    const rowsAll = [...io, ...ii], mats = ['plate', 'gold', 'gold', 'under'];
    G.tag = 'collar';
    const start = G.polys.length;
    for (let r = 0; r + 1 < rowsAll.length; r++) for (let k = 0; k + 1 < az.length; k++) G.poly([rowsAll[r][k], rowsAll[r][k + 1], rowsAll[r + 1][k + 1], rowsAll[r + 1][k]], mats[r], 'collar');
    // the ends: gold, closed from the outside's foot to the inside's foot
    for (const k of [0, az.length - 1]) G.poly(rowsAll.map((row) => row[k]), 'gold', 'collar');
    piece(G, start, (c) => [c[0], 0, c[2] - nz]);
  }
  return { chest, low, faulds };
}

/* ---- the arm (built on the left, mirrored) ----------------------------------------------------------------------------- */
function armPieces(G, rig, D, S) {
  const { B, J } = rig, rim = D.rim;
  const UP = [0, 1, 0], FWD = [0, 0, 1];
  const frameOf = (o, tail) => {
    const a = unit(sub(tail, o)), e1 = unit(sub(FWD, mul(a, dot(FWD, a)))), e2 = cross(e1, a);
    return { o, a, e1, e2: dot(e2, [1, 0, 0]) >= 0 ? e2 : mul(e2, -1), len: Math.hypot(...sub(tail, o)) };
  };
  const armS = S.filter((s) => (s.part === 'arm' || s.part === 'joint') && s.p[0] > 0).map((s) => s.p);
  const up = frameOf(J.shoulder, J.elbow), fo = frameOf(J.elbow, J.wrist);
  const upper = sectioner(armS, { ...up, dt: 0.12 }), fore = sectioner(armS, { ...fo, dt: 0.12 });
  const outOf = (fr) => (p) => { const d = sub(p, fr.o), t = dot(d, fr.a); return sub(d, mul(fr.a, t)); };

  // the pauldron's cap (on the shoulder helper: half the upper arm's turn): a dome over the shoulder round a pole up and
  // out, each point the body's reach that way from the centre (over a cone) out by the clearance
  const Pd = D.pauldron;
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
  const psiN = Pd.cols, psis = Array.from({ length: psiN }, (_, k) => (k * 360) / psiN);
  // (φ's reach by ψ: [front, out, back, in] blended)
  const phiMax = (psi) => { const t = psi * Math.PI / 180, c = Math.cos(t), s = Math.sin(t); const [f, o, b, i] = Pd.phi; return (c > 0 ? f * c : b * -c) + (s > 0 ? o * s : i * -s) - (Math.abs(c) + Math.abs(s) - 1) * 40; };
  const dirAt = (psi, phi) => { const a = psi * Math.PI / 180, b = phi * Math.PI / 180; return unit(add(mul(pole, Math.cos(b)), mul(add(mul(q1, Math.cos(a)), mul(q2, Math.sin(a))), Math.sin(b)))); };
  // q2 = pole x q1: with q1 forward, ψ 90 is toward -x ... take ψ round so 90 is out
  const outSign = dot(q2, [1, 0, 0]) >= 0 ? 1 : -1;
  const capRows = Pd.rows.map((f, r) => psis.map((psi) => {
    const ps = psi * outSign, phi = Pd.phi0 + (phiMax(psi) - Pd.phi0) * f, d = dirAt(ps, phi);
    return add(centre, mul(d, reach(d) + Pd.c[r]));
  }));
  // (smoothed round each row: each point's distance the mean of its own and its neighbours', never further in than its own)
  for (const row of capRows) {
    const rr = row.map((p) => Math.hypot(...sub(p, centre)));
    row.forEach((p, k) => { const m = (rr[(k + psiN - 1) % psiN] + 2 * rr[k] + rr[(k + 1) % psiN]) / 4; row[k] = add(centre, mul(unit(sub(p, centre)), Math.max(m, rr[k] * 0.97))); });
  }
  const cap = plateOf(G, capRows, { tag: 'pauldron', bone: { shoulder_l: 1 }, rim, out: (p) => sub(p, centre), ring: true, fit: { S: near, c: D.fit.arm }, border: { top: 'open', bottom: 'trim' } });
  // (its top closed by one polygon)
  { const ids = capRows[0].map((p) => G.verts.findIndex((q) => q === p)); G.tag = 'pauldron'; G.poly(ids.slice().reverse(), 'plate', 'pauldron'); }
  // its core, on the outside
  const coreAt = add(centre, mul(dirAt(Pd.core.psi * outSign, Pd.phi0 + (phiMax(Pd.core.psi) - Pd.phi0) * Pd.core.f), 3));
  coreOn(G, cap, gridAt(cap, Pd.core.f * (Pd.rows.length - 1), (Pd.core.psi / 360) * psiN).q, { dir: UP, out: sub(coreAt, centre) }, Pd.core.r, Pd.core.n, 'pauldron core');
  // its lames under it down the upper arm (on the upper arm), open toward the body
  Pd.lames.forEach((L, li) => {
    const th = [L.th[0], (L.th[0] * 2 + L.th[1]) / 3, (L.th[0] + L.th[1] * 2) / 3, L.th[1]];
    const ths = [L.th[0], ...[1, 2, 3].map((k) => L.th[0] + ((L.th[1] - L.th[0]) * k) / 4), L.th[1]];
    void th;
    const rows = [0, 1].map((f) => ths.map((a) => upper.at(L.t[0] + (L.t[1] - L.t[0]) * f, a, L.c[f])));
    plateOf(G, rows, { tag: `pauldron lame ${li + 1}`, bone: li === 0 ? { shoulder_l: 0.5, upperarm_l: 0.5 } : { upperarm_l: 1 }, rim, out: outOf(up), fit: { S: armS, c: D.fit.arm }, border: { top: 'open' } });
  });
  // the rerebrace (the upper arm): open toward the body
  const Rr = D.rerebrace;
  const rTh = Array.from({ length: Rr.cols }, (_, k) => Rr.th[0] + ((Rr.th[1] - Rr.th[0]) * k) / (Rr.cols - 1));
  plateOf(G, [0, 1].map((f) => rTh.map((a) => upper.at(Rr.t[0] + (Rr.t[1] - Rr.t[0]) * f, a, Rr.c[f]))), { tag: 'rerebrace', bone: { upperarm_l: 1 }, rim, out: outOf(up), fit: { S: armS, c: D.fit.arm }, border: { top: 'open' } });

  // the vambrace (the forearm): an angular tube, its top flared and high over the elbow's point, low at its inside
  const Vb = D.vambrace, vTh = Array.from({ length: Vb.cols }, (_, k) => (k * 360) / Vb.cols + 360 / Vb.cols / 2);
  const tTop = (a) => { const t = a * Math.PI / 180, c = Math.cos(t), s = Math.sin(t); const [f, o, b, i] = Vb.top; return (c > 0 ? f * c * c : b * c * c) + (s > 0 ? o * s * s : i * s * s); };
  const vRows = [
    vTh.map((a) => fore.at(tTop(a), a, Vb.c[0] + Vb.flare)),
    vTh.map((a) => fore.at(Vb.mid, a, Vb.c[1])),
    vTh.map((a) => fore.at(Vb.bottom, a, Vb.c[2])),
  ];
  const vam = plateOf(G, vRows, { tag: 'vambrace', bone: { lowerarm_l: 0.5, lowerarm_twist_01_l: 0.5 }, rim, out: outOf(fo), ring: true, fit: { S: armS, c: D.fit.arm }, border: { bottom: 'open' }, mat: (r, c) => (Math.cos(vTh[c] * Math.PI / 180) < -0.3 && Math.sin(vTh[c] * Math.PI / 180) < 0.3 ? 'shade' : 'plate') });
  // its diamond on the outside (glowing, in a gold frame) and an inlay down from it
  {
    const cOut = vTh.reduce((best, a, k) => (Math.sin(a * Math.PI / 180) > Math.sin(vTh[best] * Math.PI / 180) ? k : best), 0);
    const h = gridAt(vam, 1 + (Vb.diamond.t - Vb.mid) / (Vb.bottom - Vb.mid) * 0, cOut + 0.5);
    const along = unit(fo.a), n = h.n, x = unit(cross(n, along)), r = Vb.diamond.r;
    const V = (q) => { const i = G.vert(q, 'diamond'); G.wt[i] = vam.wt; return i; };
    const c0 = add(h.q, mul(n, 0.015));
    const outer = [mul(along, -r * 1.5), mul(x, r), mul(along, r * 1.5), mul(x, -r)].map((d) => V(add(add(c0, d), mul(n, 0.0))));
    const innerP = [mul(along, -r * 0.9), mul(x, r * 0.55), mul(along, r * 0.9), mul(x, -r * 0.55)].map((d) => V(add(add(c0, d), mul(n, 0.035))));
    G.tag = 'diamond';
    for (let k = 0; k < 4; k++) G.poly([outer[k], outer[(k + 1) % 4], innerP[(k + 1) % 4], innerP[k]], 'gold', 'diamond', true);
    G.poly(innerP, 'glow', 'diamond', true);
    inlayOn(G, vam, [0.15, 0.7].map((rf) => gridAt(vam, rf, cOut + 0.5)), 0.035, 'vambrace inlay');
  }

  // the gauntlet's cuff (the wrist helper: half the hand's turn), flared over the vambrace's foot
  const Cf = D.cuff, cTh = Array.from({ length: Cf.cols }, (_, k) => (k * 360) / Cf.cols + 360 / Cf.cols / 2);
  const wr = frameOf(J.wrist, J.knuckle), wsec = sectioner(armS.concat(S.filter((s) => s.part === 'hand' && s.p[0] > 0).map((s) => s.p)), { ...fo, o: J.wrist, dt: 0.1 });
  void wr;
  plateOf(G, [0, 1].map((f) => cTh.map((a) => wsec.at(Cf.t[0] + (Cf.t[1] - Cf.t[0]) * f, a, Cf.c[1 - f]))), { tag: 'cuff', bone: { wrist_l: 1 }, rim, out: outOf({ ...fo, o: J.wrist }), ring: true, border: { top: 'edge' } });

  // the under-layer: a sleeve of the arm's own rings, pushed out from each ring's middle (skinned as those rings)
  const ringPts = (nm) => Array.from({ length: 8 }, (_, k) => B.index.get(`arm/${nm}${k}.L`));
  const rings = D.sleeve.rings.map(([nm, c]) => {
    const ids = ringPts(nm), m = mul(ids.reduce((a, i) => add(a, B.verts[i]), [0, 0, 0]), 1 / 8);
    return ids.map((i) => { const v = G.vert(add(B.verts[i], mul(unit(sub(B.verts[i], m)), c)), 'sleeve'); G.wt[v] = { $body: i }; return v; });
  });
  G.tag = 'sleeve';
  const sStart = G.polys.length;
  for (let r = 0; r + 1 < rings.length; r++) for (let k = 0; k < 8; k++) G.poly([rings[r][k], rings[r][(k + 1) % 8], rings[r + 1][(k + 1) % 8], rings[r + 1][k]], 'under', 'sleeve');
  piece(G, sStart, (c) => { const lines = [up, fo].map((fr) => { const d = sub(c, fr.o), t = Math.max(0, Math.min(fr.len, dot(d, fr.a))); return sub(d, mul(fr.a, t)); }); return Math.hypot(...lines[0]) < Math.hypot(...lines[1]) ? lines[0] : lines[1]; });

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
}

/* ---- the whole piece ---------------------------------------------------------------------------------------------------- */
const mirrorName = (n) => n.replace(/_l$/, '_r');
export function buildPlateChest(rig, design = DESIGN[rig.who]) {
  const D = design, { B } = rig;
  const G = meshOf();
  G.wt = []; G.plates = [];
  // the body's samples, each with its part
  const S = [];
  B.verts.forEach((p, i) => S.push({ p, part: B.part[i] }));
  for (const t of B.tris) {
    const [a, b, c] = t.v.map((i) => B.verts[i]), part = B.part[t.v[0]];
    const n = Math.max(1, Math.ceil(Math.max(Math.hypot(...sub(b, a)), Math.hypot(...sub(c, b)), Math.hypot(...sub(a, c))) / 0.08));
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) { const u = i / n, v = j / n, w = 1 - u - v; S.push({ p: [a[0] * w + b[0] * u + c[0] * v, a[1] * w + b[1] * u + c[1] * v, a[2] * w + b[2] * u + c[2] * v], part }); }
  }
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
  const cov = B.verts.map((p, i) => {
    if (B.part[i] === 'hand') return true;
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
    const A = { built: 'node tools/sculpt/garments/platechest.mjs (tools/sculpt/lowgarment.mjs garmentAsset)', ...garmentAsset(rig, G, MATS), glow: GLOW, hides: G.hides };
    writeFileSync(file, JSON.stringify(A));
    console.log(who, `${G.verts.length} vertices, ${G.tris.length} triangles, ${A.base} + ${A.bones.length} bones, hides ${G.hides.length} body polygons: wrote`, file.pathname);
  }
}
