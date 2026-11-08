// The plate leggings of the sacred plate set (tools/sculpt/ref/plate-legs.png, worn in tools/sculpt/ref/plate-lineup.png):
// a low hip band with a V at the front down to the crotch, thigh plates (his split: an upper lame on the hip and the
// cuisse under it; hers one contoured plate), a diamond knee guard with a glowing gold diamond inset, layered tapered
// shin plates with a gold centre line, and three chevron calf plates behind, over a dark base layer. Fitted to each
// low-poly body from one design (DESIGN, per body), each plate rigid on one bone of the body's rig (no bones of its own).
//
//   buildPlateLegs(rig) → { verts, polys: [{ v, mat, part, tag }], tris, part, plates, design, hides }
//   plateLegsWeights(rig, G) → per vertex [[bone, weight], ...] (the body's bones only)
//
//   node tools/sculpt/garments/platelegs.mjs
//     writes the game's copy beside each body: src/sculpt/assets/lowplatelegs-<who>.json (lowgarment.mjs garmentAsset,
//     with `hides`, the body's polygons the base layer takes the place of, and `glow`, its emissive materials; loaded by
//     src/sculpt/lowpoly.ts behind the outfit switch `plateLegs`)
//
// The base layer: the body's own pelvis and leg polygons from the hip cut (bt) down to the ankle ring, on the body's own
// vertices and weights, in the plate's shade (it reads as plate where the plates part); the body's polygons it copies are hidden while it is worn, so it can
// neither cross the body nor show skin where the plates part at the joints.
//
// Each plate: a grid of points on rays out from an axis (the leg's centre at that height, or the hip's vertical axis for
// the band), rows top to bottom and columns round, each point at the body's reach in its wedge (lowgarment.mjs envelope's
// rule, as trousers.mjs ringRadii) plus the clearance, or, where it lies over plates laid before it (the layers: calf,
// shin, cuisse, knee guard, lame, band, inner first), their reach plus the gap; then out by the plate's thickness. Its
// edges are turned in by the thickness (a lip, so the plate shows its weight); a trimmed edge stands proud by `raise`
// over a band `trim` wide (the gold rim). One open shell a plate, rigid on its bone: the band on the pelvis, his lame on
// the hip helper (half the thigh's turn), the cuisse on the thigh, the knee guard on the knee helper (half the calf's
// turn), the shin and calf plates on the calf.
import { meshOf, orient, trisOf, lerp, sub, add, mul, unit, cross, dot, newell, transferWeights } from '../lowgarment.mjs';

/**
 * The plate set's materials, shared by name and colour with the set's other pieces (tools/sculpt ENCHANT spec): plate,
 * its darker shade (the edges turned in), the gold trim, the base layer; core, the knee guard's diamond inset (a gold-amber
 * gem when plain, glowing when enchanted); rune, the inlay lines set into the plate (the shins' centre lines: gold when
 * plain, lit when enchanted).
 */
export const MATS = {
  plate: [0.84, 0.71, 0.63],
  shade: [0.72, 0.6, 0.53],
  gold: [0.96, 0.74, 0.4],
  core: [0.86, 0.62, 0.3],
  rune: [0.96, 0.74, 0.4],
};
/**
 * The two looks (lowgarment.mjs garmentAsset `looks`): plain, every material metal (kind 2: lit by the light's brightness,
 * as the long sword); enchanted, the core and the runes unlit at the set's glow (kind 1, one shared slot).
 */
const GLOW = [1, 0.906, 0.651];
export const LOOKS = {
  plain: Object.fromEntries(Object.entries(MATS).map(([n, c]) => [n, { c, kind: 2 }])),
  enchanted: Object.fromEntries(Object.entries(MATS).map(([n, c]) => [n, n === 'core' || n === 'rune' ? { c: GLOW, kind: 1 } : { c, kind: 2 }])),
};

const rad = (d) => d * Math.PI / 180;

/** A height round the leg from a table [[azimuth, y], ...] (degrees nought to 360, in order), straight between entries. */
function tab(T) {
  return (az) => {
    const a = ((az % 360) + 360) % 360, L = [...T, [T[0][0] + 360, T[0][1]]];
    for (let k = 0; k + 1 < L.length; k++) if (a >= L[k][0] && a <= L[k + 1][0]) return L[k][1] + (L[k + 1][1] - L[k][1]) * (a - L[k][0]) / (L[k + 1][0] - L[k][0]);
    return T[0][1];
  };
}

/**
 * The design per body (heights the body's y; lengths its units; a height per column is [front, outside, back, inside]
 * blended round the leg). Each plate's rows: y and lvl, its layer there (0 on the body, 1 over a plate under it: the
 * plate's outer face at clear + lvl (t + gap) + t off the body).
 *   thigh: the thigh plates' columns (degrees round the leg from its front toward its outside: the body's own);
 *   clear: the least distance off the body; gap: off a plate under it; t: the plate's thickness; raise, trim: the gold
 *   rim's height over the plate and its width; low: the same for the plates under the boots (the shin and the calf,
 *   kept inside the boots' shaft: 0.12 off the skin on him, 0.10 on her);
 *   band: the hip band round the hip's axis z0, its columns az (CF to CB) with top and bottom heights;
 *   lame (his, on the hip helper), cuisse (on the thigh; hers blended to the hip helper over its top), knee (the
 *   guard: its top, middle and bottom heights, the wings' azimuth, the apex's bulge, the inset's and the ring's sizes as
 *   shares of the way out), shinUp and shinLow (their columns: the centre line's gold either side of 0), calf (three
 *   chevrons, each [top, bottom] at the sides, `chevron` lower at the back).
 */
export const DESIGN = {
  male: {
    sink: 0.06, clear: 0.015, gap: 0.012, t: 0.04, raise: 0.024, trim: 0.1, seam: 5, thigh: [0, 50, 91, 132, 180, 229, 271, 312],
    low: { clear: 0.012, gap: 0.01, t: 0.03, raise: 0.018, trim: 0.085 },
    band: { z0: -0.06, az: [0, 30, 70, 110, 150, 180], top: [-3.99, -3.97, -3.94, -3.94, -3.97, -3.99], bottom: [-5.45, -4.95, -4.6, -4.62, -4.74, -4.86], gap: 0.035 },
    cuisse: { stops: 'skin', ease: [], recess: { az: [20, 125], y: [-6.7, -4.5], by: 0.075 }, rows: [{ y: tab([[0, -4.85], [50, -4.6], [91, -4.42], [180, -4.66], [229, -5.7], [271, -6.3], [320, -5.6]]), lvl: 0.6 }, { y: -6.62, lvl: 0 }, { y: [-7.3, -7.12, -7.05, -7.05], lvl: 0 }] },
    knee: { top: -6.55, mid: -7.42, bottom: -8.25, wing: 92, flare: 0.1, lvl: 1, bulge: 0.2, inset: [14, 0.27], ringIn: [18, 0.34], ring: [25, 0.46] },
    shinUp: { az: [-94, -50, -8, 8, 50, 94], rows: [{ y: [-7.72, -7.85, -7.85, -7.85], lvl: 0 }, { y: tab([[0, -8.76], [50, -8.56], [94, -8.46], [180, -8.46], [266, -8.46], [310, -8.56]]), lvl: 1 }] },
    shinLow: { az: [-94, -50, -8, 8, 50, 94], rows: [{ y: -8.4, lvl: 0 }, { y: -10.36, lvl: 0.4 }] },
    kneeBack: { az: [118, 149, 180, 211, 242], y: [-6.85, -8.3] },
    calf: { az: [98, 139, 180, 221, 262], segs: [[-7.92, -8.9], [-8.75, -9.6], [-9.45, -10.36]], chevron: 0.3 },
  },
  female: {
    sink: 0.085, clear: 0.012, gap: 0.01, t: 0.036, raise: 0.022, trim: 0.085, seam: 5, thigh: [0, 38, 88, 143, 180, 218, 275, 325],
    low: { clear: 0.01, gap: 0.008, t: 0.026, raise: 0.016, trim: 0.075 },
    band: { z0: -0.38, az: [0, 30, 70, 110, 150, 180], top: [-3.63, -3.61, -3.58, -3.58, -3.61, -3.64], bottom: [-4.16, -3.98, -3.9, -3.95, -4.06, -4.16], gap: 0.035, ease: [[0.7, 0.2, 'pelvis']] },
    cuisse: { stops: 'skin', ease: [], rows: [{ y: tab([[0, -4.16], [50, -4.04], [88, -3.92], [180, -3.98], [218, -5.0], [275, -5.05], [325, -4.45]]), lvl: 0 }, { y: [-6.45, -6.45, -6.32, -6.35], lvl: 0 }] },
    knee: { top: -5.92, mid: -6.74, bottom: -7.56, wing: 90, flare: 0.08, lvl: 1, bulge: 0.17, inset: [13, 0.26], ringIn: [17, 0.33], ring: [24, 0.44] },
    shinUp: { az: [-94, -50, -8, 8, 50, 94], rows: [{ y: [-7.02, -7.15, -7.15, -7.15], lvl: 0 }, { y: tab([[0, -8.12], [50, -7.92], [94, -7.82], [180, -7.82], [266, -7.82], [310, -7.92]]), lvl: 1 }] },
    shinLow: { az: [-94, -50, -8, 8, 50, 94], rows: [{ y: -7.8, lvl: 0 }, { y: -10.5, lvl: 0.4 }] },
    kneeBack: { az: [118, 149, 180, 211, 242], y: [-6.15, -7.6] },
    calf: { az: [98, 139, 180, 221, 262], segs: [[-7.3, -8.4], [-8.25, -9.4], [-9.25, -10.5]], chevron: 0.3 },
  },
};

/** [front, outside, back, inside] blended round the leg by azimuth (degrees from its front toward its outside). */
const round4 = (v, az) => {
  if (typeof v === 'number') return v;
  if (typeof v === 'function') return v(az);
  const [f, o, b, i] = v, c = Math.cos(rad(az)), s = Math.sin(rad(az));
  return (c > 0 ? f * c * c : b * c * c) + (s > 0 ? o * s * s : i * s * s);
};
/** A value per column of the band's ring (CF, its columns a side, CB) at azimuth az round the hip's axis (either side). */
const roundBand = (az, A, v) => {
  const a = Math.abs(((az + 540) % 360) - 180);
  for (let k = 0; k + 1 < A.length; k++) if (a <= A[k + 1]) { const t = (a - A[k]) / (A[k + 1] - A[k]); return v[k] + (v[k + 1] - v[k]) * t; }
  return v[v.length - 1];
};

/* ---- the body's reach: horizontal rays out from an axis ------------------------------------------------------------- */
/** Where a ray o + s d (s > 0) leaves the triangles T (each three points): the furthest s, or 0. */
function rayOut(T, o, d, nearest = false) {
  let best = nearest ? Infinity : 0;
  for (const [a, b, c] of T) {
    const e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
    if (Math.abs(det) < 1e-12) continue;
    const f = 1 / det, w = sub(o, a), u = f * dot(w, h);
    if (u < -1e-6 || u > 1 + 1e-6) continue;
    const q = cross(w, e1), v = f * dot(d, q);
    if (v < -1e-6 || u + v > 1 + 1e-6) continue;
    const s = f * dot(e2, q);
    if (nearest ? s > 0 && s < best : s > best) best = s;
  }
  return best;
}
/** Triangles (as points) of the body's parts, those with every corner passing keep. */
const bodyTris = (B, parts, keep = () => true) => B.tris.filter((t) => t.v.every((i) => parts.has(B.part[i]) && keep(B.verts[i]))).map((t) => t.v.map((i) => B.verts[i]));

/**
 * The left leg's field: its axis (the middles of the body's leg rings, straight between them) and the body's reach out
 * from it: at (y, az, off) the point off the body's surface by `off` along the horizontal ray from the axis at height y.
 */
function legField(B) {
  const T = bodyTris(B, new Set(['torso', 'pelvis', 'legs'])).filter((t) => t[0][0] + t[1][0] + t[2][0] > 0);
  const names = ['th', 'tg', 'tm', 'tl', 'ka', 'kb', 'kc', 'ca', 'cb', 'an'].filter((r) => B.index.has(`${r}0.L`));
  const rings = names.map((r) => {
    const ps = B.names.map((n, i) => (new RegExp(`^${r}\\d\\.L$`).test(n) ? B.verts[i] : null)).filter(Boolean);
    return [ps.reduce((s, p) => s + p[1], 0) / ps.length, ps.reduce((s, p) => s + p[0], 0) / ps.length, ps.reduce((s, p) => s + p[2], 0) / ps.length];
  });
  const axis = (y) => {
    if (y >= rings[0][0]) return [rings[0][1], rings[0][2]];
    for (let i = 0; i + 1 < rings.length; i++) if (y >= rings[i + 1][0]) { const t = (rings[i][0] - y) / (rings[i][0] - rings[i + 1][0]); return [rings[i][1] + (rings[i + 1][1] - rings[i][1]) * t, rings[i][2] + (rings[i + 1][2] - rings[i][2]) * t]; }
    const l = rings[rings.length - 1]; return [l[1], l[2]];
  };
  const cache = new Map();
  const reach = (y, az, c = axis(y)) => {
    const key = `${y.toFixed(4)},${az.toFixed(3)},${c[0].toFixed(4)},${c[1].toFixed(4)}`;
    if (!cache.has(key)) cache.set(key, rayOut(T, [c[0], y, c[1]], [Math.sin(rad(az)), 0, Math.cos(rad(az))]));
    return cache.get(key);
  };
  // each ring's height round it: [mean y, y at azimuth az (between its vertices round its middle)]
  const ringY = names.map((r, n) => {
    const ps = B.names.map((nm, i) => (new RegExp(`^${r}\\d\\.L$`).test(nm) ? B.verts[i] : null)).filter(Boolean);
    const c = [rings[n][1], rings[n][2]], A = ps.map((p) => [((Math.atan2(p[0] - c[0], p[2] - c[1]) * 180 / Math.PI) + 360) % 360, p[1]]).sort((a, b) => a[0] - b[0]);
    const yAt = (az) => {
      const a = ((az % 360) + 360) % 360;
      for (let k = 0; k < A.length; k++) { const p = A[k], q = A[(k + 1) % A.length], span = ((q[0] - p[0]) + 360) % 360 || 360, d = ((a - p[0]) + 360) % 360; if (d <= span) return p[1] + (q[1] - p[1]) * d / span; }
      return rings[n][0];
    };
    return { name: r, y: rings[n][0], yAt };
  });
  const at = (y, az, off, c = axis(y)) => { const r = reach(y, az, c) + off; return [c[0] + Math.sin(rad(az)) * r, y, c[1] + Math.cos(rad(az)) * r]; };
  return { axis, reach, at, ringY };
}

/**
 * Push a row's columns out (its offsets `off`, in place) until each face between neighbours clears what lies under it:
 * at shares f of the way from column k to the next, seg(k, f) gives the point wanted (`want`), the face's ends (p0, p1)
 * and the axis there (c); where the face's straight line runs inside the point wanted, both ends go out by the shortfall.
 */
function chordOut(az, closed, off, seg, passes = 3) {
  const n = closed ? az.length : az.length - 1;
  for (let it = 0; it < passes; it++) {
    const bump = new Array(az.length).fill(0);
    for (let k = 0; k < n; k++) for (const f of [0.2, 0.4, 0.6, 0.8]) {
      const { want, p0, p1, c } = seg(k, f), q = lerp(p0, p1, f);
      const rw = Math.hypot(want[0] - c[0], want[2] - c[1]), rq = Math.hypot(q[0] - c[0], q[2] - c[1]);
      if (rq < rw) { const d = (rw - rq) * 1.05; const j = (k + 1) % az.length; bump[k] = Math.max(bump[k], d); bump[j] = Math.max(bump[j], d); }
    }
    if (bump.every((b) => b < 1e-4)) return;
    bump.forEach((b, k) => { off[k] += b; });
  }
}

/**
 * Push a grid's nodes out (radii R[i][k] from the axis at their heights Y[i][k], columns at azimuths az) until every cell
 * clears what lies under it: at points inside each cell (and along its edges) want(y, a, i, k, fy, fk) is the radius the
 * surface must reach there; where the cell's face (its corners blended) falls short, its four corners go out by as much.
 */
function cellOut(Y, az, R, closed, axis, want, passes = 4) {
  const N = az.length, n = closed ? N : N - 1, F = [0, 0.25, 0.5, 0.75, 1];
  const pt = (y, a, r) => { const c = axis(y); return [c[0] + Math.sin(rad(a)) * r, y, c[1] + Math.cos(rad(a)) * r]; };
  for (let it = 0; it < passes; it++) {
    const bump = R.map((row) => row.map(() => 0));
    for (let i = 0; i + 1 < Y.length; i++) for (let k = 0; k < n; k++) {
      const j = (k + 1) % N, P00 = pt(Y[i][k], az[k], R[i][k]), P01 = pt(Y[i][j], az[j], R[i][j]), P10 = pt(Y[i + 1][k], az[k], R[i + 1][k]), P11 = pt(Y[i + 1][j], az[j], R[i + 1][j]);
      let worst = 0;
      for (const fy of F) for (const fk of F) {
        if ((fy === 0 || fy === 1) && (fk === 0 || fk === 1)) continue;
        // (the face's point there: the corners blended, as the quad's two triangles hold it within a little)
        const q = lerp(lerp(P00, P01, fk), lerp(P10, P11, fk), fy);
        const c = axis(q[1]), dx = q[0] - c[0], dz = q[2] - c[1], a = Math.atan2(dx, dz) * 180 / Math.PI;
        const need = want(q[1], a, i, k, fy, fk), have = Math.hypot(dx, dz);
        if (need > have) worst = Math.max(worst, need - have);
      }
      if (worst > 1e-4) for (const [ii, kk] of [[i, k], [i, j], [i + 1, k], [i + 1, j]]) bump[ii][kk] = Math.max(bump[ii][kk], worst * 1.1 + 0.002);
    }
    if (bump.every((row) => row.every((b) => b < 1e-4))) return;
    bump.forEach((row, i) => row.forEach((b, k) => { R[i][k] += b; }));
  }
}

/* ---- a plate ------------------------------------------------------------------------------------------------------- */
/**
 * A plate as a grid of nodes (y, az, off) evaluated by `pt`: its rows (each a height and an outer offset per column),
 * its edges turned in by the thickness t (a lip) where `lip` says, a trimmed edge raised by `raise` over a band `trim`
 * wide (gold), an open plate turned in at its sides too (`sides`). Returns { nodes, pts, closed, mat(i, k) }.
 */
function shell(rows, az, pt, { t, raise, trim, closed = false, lipTop = true, lipBottom = true, trimTop = false, trimBottom = true, sides = true, trimSides = false, mat = 'plate', lipMat = 'shade', inset = null }) {
  const R = rows.length;
  const node = (i, k, dOff = 0) => ({ y: rows[i].y[k], az: az[k], off: rows[i].off[k] + dOff });
  // (the node `trim` along the plate from row i toward row j, raised)
  const toward = (i, j, k) => { const a = rows[i], b = rows[j], f = Math.min(0.4, trim / (Math.abs(a.y[k] - b.y[k]) || 1)); return { y: a.y[k] + (b.y[k] - a.y[k]) * f, az: az[k], off: a.off[k] + (b.off[k] - a.off[k]) * f + raise }; };
  const N = [], band = [], up = [], lipRow = [];
  const push = (row, m, r = false, l = false) => { N.push(row); band.push(m); up.push(r); lipRow.push(l); };
  const C = az.length, cols = [...Array(C).keys()];
  if (trimTop) { push(cols.map((k) => node(0, k, -t)), 'gold', false, true); push(cols.map((k) => node(0, k, raise)), 'gold', true); push(cols.map((k) => toward(0, 1, k)), null, true); }
  else { if (lipTop) push(cols.map((k) => node(0, k, -t)), lipMat, false, true); push(cols.map((k) => node(0, k)), null); }
  for (let i = 1; i < R - 1; i++) push(cols.map((k) => node(i, k)), null);
  if (trimBottom) { push(cols.map((k) => toward(R - 1, R - 2, k)), 'gold', true); push(cols.map((k) => node(R - 1, k, raise)), 'gold', true); push(cols.map((k) => node(R - 1, k, -t)), null, false, true); }
  else if (lipBottom) { push(cols.map((k) => node(R - 1, k)), lipMat); push(cols.map((k) => node(R - 1, k, -t)), null, false, true); }
  else push(cols.map((k) => node(R - 1, k)), null);
  let nodes = N;
  const open = !closed && sides;
  const sideIn = (i) => (lipRow[i] ? 0 : t + (up[i] ? raise : 0));
  if (open) nodes = N.map((row, i) => [{ ...row[0], off: row[0].off - sideIn(i) }, ...row, { ...row[C - 1], off: row[C - 1].off - sideIn(i) }]);
  const W = nodes[0].length;
  const m = (i, k) => {
    if (band[i]) return band[i];
    if (open && (k === 0 || k === W - 2)) return trimSides ? 'gold' : lipMat;
    return (inset && inset(i, open ? k - 1 : k)) || mat;
  };
  return { nodes, pts: nodes.map((row) => row.map(pt)), closed, mat: m };
}

/** Lay a plate's grid into the mesh: quads between rows, round (closed) or across (open). */
function lay(G, P, tag) {
  const ids = P.pts.map((row) => row.map((p) => G.vert(p, tag)));
  G.tag = tag;
  const C = ids[0].length, last = P.closed ? C : C - 1;
  for (let i = 0; i + 1 < ids.length; i++) for (let k = 0; k < last; k++) {
    const j = (k + 1) % C;
    const n0 = G.polys.length;
    G.poly([ids[i][k], ids[i][j], ids[i + 1][j], ids[i + 1][k]], P.mat(i, k), tag);
    for (let q = n0; q < G.polys.length; q++) G.polys[q].cell = [i, k];
  }
  return ids;
}

export function buildPlateLegs(rig, design = DESIGN[rig.who], { stage = 9 } = {}) {
  const { B } = rig, D = design, F = legField(B);
  const G = meshOf();
  G.plates = [];
  const offOf = (S, lvl) => S.clear + lvl * (S.t + S.gap) + S.t;
  // a leg plate: rows of { y, lvl }, columns az, on the leg's field; rigid on `bone` (or the rows' own `w`)
  const legPlate = (tag, bone, rowsIn, az, S, o = {}) => {
    let rows = rowsIn.map((r) => ({ y: az.map((a) => round4(r.y, a)), lvl: az.map(() => r.lvl) }));
    // (the body's own rings between two rows, each a row of its own at its heights round the leg: the plate follows the
    // body's bends there rather than cutting across them)
    const more = [];
    for (let i = 0; i + 1 < rows.length; i++) {
      const a = rows[i], b = rows[i + 1];
      for (const ring of o.rings === false ? [] : F.ringY) {
        const ys = az.map((x) => ring.yAt(x));
        const inside = ys.filter((y, k) => y < a.y[k] - 0.08 && y > b.y[k] + 0.08).length;
        if (inside < az.length / 2) continue;
        const y = ys.map((y, k) => Math.min(a.y[k] - 0.05, Math.max(b.y[k] + 0.05, y)));
        more.push({ i, y, lvl: y.map((yy, k) => a.lvl[k] + (b.lvl[k] - a.lvl[k]) * (a.y[k] - yy) / (a.y[k] - b.y[k])) });
      }
    }
    for (const m of more.reverse()) rows.splice(m.i + 1, 0, { y: m.y, lvl: m.lvl });
    rows.sort((p, q) => q.y.reduce((s2, x) => s2 + x, 0) - p.y.reduce((s2, x) => s2 + x, 0));
    // (each column's rows downward by at least 0.04; a ring row that would fold over a design row is dropped there)
    rows = rows.filter((r, i) => i === 0 || i === rows.length - 1 || r.y.every((y, k) => y < rows[i - 1].y[k] - 0.04 && y > rows[rows.length - 1].y[k] + 0.04));
    for (let i = 1; i < rows.length; i++) rows[i].y = rows[i].y.map((y, k) => Math.min(y, rows[i - 1].y[k] - 0.04));
    rows = rows.map((r) => ({ y: r.y, off: r.lvl.map((l, k) => offOf(S, l) + (o.ridge ? o.ridge(k) : 0)) }));
    // (a recess: in a window round the leg and up it, the plate nearer the body by `by`, the base layer sunk under it
    // leaving it room; where the arm's hand rests on the thigh)
    if (o.recess) { const W = o.recess; rows.forEach((r) => r.y.forEach((y, k) => { const a = ((az[k] % 360) + 360) % 360; if (a >= W.az[0] && a <= W.az[1] && y >= W.y[0] && y <= W.y[1]) r.off[k] -= W.by; })); }
    // (each face clear of the body by its offset, and of the plates laid under it by the gap and the thickness: sub-rays
    // inside each cell of the grid, the cell's corners out by any shortfall)
    const closed = o.closed ?? false;
    const soup = trisOf(G).map((t) => t.v.map((i) => G.verts[i]));
    const R = rows.map((r) => r.y.map((y, k) => F.reach(y, az[k]) + r.off[k]));
    const offAt = (i, k, fy, fk) => { const j = (k + 1) % az.length, a = rows[i], b = rows[i + 1]; return (a.off[k] * (1 - fk) + a.off[j] * fk) * (1 - fy) + (b.off[k] * (1 - fk) + b.off[j] * fk) * fy; };
    cellOut(rows.map((r) => r.y), az, R, closed, F.axis, (y, a, i, k, fy, fk) => {
      const c = F.axis(y), d = [Math.sin(rad(a)), 0, Math.cos(rad(a))];
      const rp = soup.length ? rayOut(soup, [c[0], y, c[1]], d) : 0;
      return Math.max(F.reach(y, a) + offAt(i, k, fy, fk), rp > 0 ? rp + S.gap + S.t + (o.ridge ? 0.01 : 0) : 0);
    });
    rows.forEach((r, i) => { r.off = r.y.map((y, k) => R[i][k] - F.reach(y, az[k])); });
    const P = shell(rows, az, (n) => F.at(n.y, n.az, n.off), { t: S.t, raise: S.raise, trim: S.trim, ...o });
    const ids = lay(G, P, tag);
    // (where the plate bridges a joint, its share down it per column, u from its top row (0) to its foot (1): the
    // weights' stops)
    const top = rows[0].y, bot = rows[rows.length - 1].y;
    const uOf = P.nodes.map((row) => row.map((n) => { const k = az.indexOf(n.az); return (top[k] - n.y) / (top[k] - bot[k]); }));
    G.plates.push({ tag, bone, ids, side: 'l', stops: o.stops ?? null, ease: o.ease ?? null, uOf });
    return P;
  };
  const LOW = { ...D, ...D.low };
  // ---- behind the knee: a plate on the knee helper (half the calf's turn), under the cuisse's foot and the calf's top --
  legPlate('kneeBack', 'knee', [{ y: D.kneeBack.y[0], lvl: 0 }, { y: D.kneeBack.y[1], lvl: 0 }], D.kneeBack.az, LOW, { trimBottom: false, lipTop: false, lipBottom: false, stops: 'skin' });
  // ---- the calf: three chevrons behind, each over the top of the one below it ---------------------------------------
  const C3 = D.calf, chev = (y, a) => y - C3.chevron * Math.max(0, -Math.cos(rad(a))) ** 2;
  [...C3.segs.keys()].reverse().forEach((s) => { const [top, bot] = C3.segs[s]; legPlate(`calf${s}`, 'calf', [{ y: (a) => chev(top, a), lvl: 0 }, { y: (a) => chev(bot, a), lvl: 1 }], C3.az, LOW, { lipTop: s === 0, sides: false }); });
  // ---- the shin: the lower plate, the upper over its top; the centre line raised, gold either side of it -------------
  for (const [tag, d] of [['shinLow', D.shinLow], ['shinUp', D.shinUp]]) {
    const c = d.az.indexOf(8);
    legPlate(tag, 'calf', d.rows, d.az, LOW, { rings: tag !== 'shinUp', lipTop: false, ridge: (k) => (k === c || k === c - 1 ? 0.015 : 0), inset: (i, k) => (k === c - 1 ? 'rune' : null) });
  }
  // ---- the cuisse round the thigh, his lame over its top --------------------------------------------------------------
  // (its seam down the front: the columns either side of it raised, the strip between them an inlay, rune)
  const cAz = [D.seam, ...D.thigh.slice(1), 360 - D.seam], seamK = cAz.length - 1;
  legPlate('cuisse', 'thigh', D.cuisse.rows, cAz, D, { closed: true, lipTop: false, stops: D.cuisse.stops, ease: D.cuisse.ease, recess: D.cuisse.recess, ridge: (k) => (k === 0 || k === seamK ? 0.012 : 0), inset: (i, k) => (k === seamK ? 'rune' : null) });
  // ---- the knee guard ---------------------------------------------------------------------------------------------------
  kneeGuard(G, D, F);
  // (his lame open on the inside: the thighs nearly meet under the crotch)
  if (D.lame) legPlate('lame', 'hip', D.lame.rows, D.lame.az, D, { sides: false, stops: D.lame.stops, ease: D.lame.ease });
  // ---- the right leg: the left's mirror ----------------------------------------------------------------------------
  const nL = G.verts.length, nP = G.polys.length;
  const mir = new Array(nL);
  for (let i = 0; i < nL; i++) mir[i] = G.vert([-G.verts[i][0], G.verts[i][1], G.verts[i][2]], G.part[i]);
  for (let q = 0; q < nP; q++) { const p = G.polys[q]; G.polys.push({ ...p, v: p.v.map((i) => mir[i]).reverse() }); }
  for (const pl of [...G.plates]) G.plates.push({ ...pl, side: 'r', ids: pl.ids.map((row) => row.map((i) => mir[i])) });
  // ---- the band: round the hip's axis, over everything ---------------------------------------------------------------
  hipBand(G, D, B);
  orient(G, (p) => [p[0], 0, p[2]]);
  G.tris = trisOf(G);
  G.design = D;
  return G;
}

/**
 * The knee guard: an apex out over the kneecap, the glowing diamond inset round it (tip up and down), a gold ring round
 * that, the plate out to its outline (the top point, the wings round the sides, the bottom point), raised at its rim and
 * turned in by the thickness; all round the knee's axis at its middle height. Its underside (the floor) clears the body
 * by the clearance and `lvl` layers, and the plates under it (the cuisse's foot, the upper shin's top) by the gap, over
 * the guard's whole span round each node (so its straight faces clear them too).
 */
function kneeGuard(G, D, F) {
  const K = D.knee, c = F.axis(K.mid), W = K.wing;
  const soup = trisOf(G).map((t) => t.v.map((i) => G.verts[i]));
  const ray = (y, az) => { const d = [Math.sin(rad(az)), 0, Math.cos(rad(az))]; return [F.reach(y, az, c), rayOut(soup, [c[0], y, c[1]], d)]; };
  const floor = (az, y) => {
    let r = 0;
    for (const da of [-22, -11, 0, 11, 22]) for (const dy of [-0.12, 0, 0.12]) {
      const [rb, rp] = ray(y + dy, az + da);
      r = Math.max(r, rb + D.clear + K.lvl * (D.t + D.gap), rp > 0 ? rp + D.gap : 0);
    }
    return r;
  };
  // (a straight face across W / 2 degrees between two nodes sags in by 1 - cos(W / 4) of their radius)
  const sag = 1 / Math.cos(rad(W / 4));
  const at = (az, y, extra) => { const r = floor(az, y) * sag + extra; return [c[0] + Math.sin(rad(az)) * r, y, c[1] + Math.cos(rad(az)) * r]; };
  const outline = [[0, K.top], [W * 0.5, (K.top + K.mid) / 2 + 0.05], [W, K.mid], [W * 0.5, (K.mid + K.bottom) / 2 - 0.03], [0, K.bottom], [-W * 0.5, (K.mid + K.bottom) / 2 - 0.03], [-W, K.mid], [-W * 0.5, (K.top + K.mid) / 2 + 0.05]];
  // (the outline's floor: each straight edge between two of its nodes clear of what lies under it too, by sub-rays)
  const fl = outline.map(([az, y]) => floor(az, y) * sag);
  const want = (az, y) => { const [rb, rp] = ray(y, az); return Math.max(rb + D.clear + K.lvl * (D.t + D.gap), rp > 0 ? rp + D.gap : 0); };
  for (let it = 0; it < 4; it++) {
    let moved = false;
    outline.forEach(([a0, y0], k) => {
      const j = (k + 1) % 8, [a1, y1] = outline[j];
      const p0 = [c[0] + Math.sin(rad(a0)) * fl[k], y0, c[1] + Math.cos(rad(a0)) * fl[k]], p1 = [c[0] + Math.sin(rad(a1)) * fl[j], y1, c[1] + Math.cos(rad(a1)) * fl[j]];
      for (const f of [0.2, 0.4, 0.6, 0.8]) {
        const q = lerp(p0, p1, f), dx = q[0] - c[0], dz = q[2] - c[1], need = want(Math.atan2(dx, dz) * 180 / Math.PI, q[1]), have = Math.hypot(dx, dz);
        if (need > have + 1e-4) { fl[k] += (need - have) * 1.1; fl[j] += (need - have) * 1.1; moved = true; }
      }
    });
    if (!moved) break;
  }
  // (the wings stand out from the leg by `flare`)
  if (K.flare) for (const k of [2, 6]) fl[k] += K.flare;
  const atO = (k, extra) => { const [az, y] = outline[k], r = fl[k] + extra; return [c[0] + Math.sin(rad(az)) * r, y, c[1] + Math.cos(rad(az)) * r]; };
  const lip = outline.map((_, k) => atO(k, 0)), rim = outline.map((_, k) => atO(k, D.t + D.raise));
  const rimIn = outline.map(([az, y]) => { const f = 0.16; return at(az * (1 - f), y + (K.mid - y) * f, D.t + D.raise + K.bulge * 0.1); });
  // (the gold ring and the glowing inset: upright diamonds round the apex, half widths in degrees and half heights)
  const dia = ([w, h], extra) => [[0, K.mid + h], [w, K.mid], [0, K.mid - h], [-w, K.mid]].map(([az, y]) => at(az, y, D.t + extra));
  const ring = dia(K.ring, K.bulge * 0.55 + 0.012), ringIn = dia(K.ringIn, K.bulge * 0.68 + 0.012), inset = dia(K.inset, K.bulge * 0.72 + 0.004);
  const apex = at(0, K.mid, D.t + K.bulge);
  const tag = 'knee';
  G.tag = tag;
  const id = (L) => L.map((p) => G.vert(p, tag));
  const [iLip, iRim, iRimIn, iRing, iRingIn, iInset] = [lip, rim, rimIn, ring, ringIn, inset].map(id), iApex = G.vert(apex, tag);
  for (let k = 0; k < 8; k++) {
    const j = (k + 1) % 8;
    G.poly([iLip[k], iLip[j], iRim[j], iRim[k]], 'gold', tag);
    G.poly([iRim[k], iRim[j], iRimIn[j], iRimIn[k]], 'gold', tag);
  }
  // (the plate from the rim in to the ring: each of the ring's corners to three of the rim's)
  for (let q = 0; q < 4; q++) {
    const k = q * 2, a = iRing[q], b = iRing[(q + 1) % 4];
    G.poly([iRimIn[k], iRimIn[k + 1], a], 'plate', tag);
    G.poly([iRimIn[k + 1], b, a], 'plate', tag);
    G.poly([iRimIn[k + 1], iRimIn[(k + 2) % 8], b], 'plate', tag);
    G.poly([iRing[q], iRing[(q + 1) % 4], iRingIn[(q + 1) % 4], iRingIn[q]], 'gold', tag);
    G.poly([iRingIn[q], iRingIn[(q + 1) % 4], iInset[(q + 1) % 4], iInset[q]], 'gold', tag);
    G.poly([iInset[q], iInset[(q + 1) % 4], iApex], 'core', tag);
  }
  G.plates.push({ tag, bone: 'knee', ids: [iLip, iRim, iRimIn, iRing, iRingIn, iInset, [iApex]], side: 'l' });
}

/**
 * The hip band: a ring round the hip's vertical axis (z0), its columns CF, D.band.az a side, CB; its top level, its
 * foot dipping to a V at the front down to the crotch (and a shallow one behind); off the body by the clearance, and off
 * the plates under it (his lames' tops, her cuisses') by the gap; flat at the front (no padding: no further forward than
 * the body's front there, the clearance and the thickness).
 */
function hipBand(G, D, B) {
  const Bd = D.band, z0 = Bd.z0, gapU = Bd.gap ?? D.gap;
  const az = [...Bd.az, ...Bd.az.slice(1, -1).map((a) => -a).reverse()];
  const body = bodyTris(B, new Set(['torso', 'pelvis', 'legs']));
  const plates = G.tris ? [] : trisOf(G).map((t) => t.v.map((i) => G.verts[i]));
  const yTop = az.map((a) => roundBand(a, Bd.az, Bd.top)), yBot = az.map((a) => roundBand(a, Bd.az, Bd.bottom));
  const ys = [yTop, yTop.map((y, k) => y + (yBot[k] - y) * 0.45), yBot];
  // (each node's outer offset: off the body by clear + t, off any plate by gap + t; the reach along its own ray)
  const reachB = (y, a) => rayOut(body, [0, y, z0], [Math.sin(rad(a)), 0, Math.cos(rad(a))]);
  const reachP = (y, a) => rayOut(plates, [0, y, z0], [Math.sin(rad(a)), 0, Math.cos(rad(a))]);
  const over = ys.map((row) => row.map(() => 0)), rp0 = (i, k) => over[i][k];
  const R = ys.map((row, i) => row.map((y, k) => {
    // (the plates under the band from this row's height down to the next's: the furthest)
    const rb = reachB(y, az[k]) + D.clear + D.t;
    // (the plates under the band anywhere from half way up to the row above to the row below)
    let rp = 0;
    const yHi = i > 0 ? (y + ys[i - 1][k]) / 2 : y + 0.04, yLo = i + 1 < ys.length ? ys[i + 1][k] : y - 0.12;
    for (let f = 0; f <= 1; f += 0.2) rp = Math.max(rp, reachP(yHi + (yLo - yHi) * f, az[k]));
    over[i][k] = rp > 0 && rp + gapU + D.t > rb ? 1 : 0;
    return Math.max(rb, rp > 0 ? rp + gapU + D.t : 0);
  }));
  // (flat at the front: no further forward than the body's own front there, the clearance and the thickness)
  // (the body's front at (x, y): the furthest forward of its surface within 0.1 across, by rays from in front)
  const frontZ = (x, y) => Math.max(...[-0.1, 0, 0.1].map((dx) => 5 - rayOut(body, [x + dx, y, 5], [0, 0, -1], true)));
  R.forEach((row, i) => row.forEach((r, k) => {
    const a = az[k];
    if (Math.abs(a) > 35) return;
    const x = Math.sin(rad(a)) * r, cap = (frontZ(x, ys[i][k]) + D.clear + D.t - z0) / Math.cos(rad(a));
    if (cap < r && rp0(i, k) === 0) row[k] = cap;
  }));
  // (the rows no tighter than the one below: the band stands as a band)
  for (let i = R.length - 2; i >= 0; i--) R[i] = R[i].map((r, k) => Math.max(r, R[i + 1][k] - 0.03));
  // (each cell of the band clear of the body and the plates under it, as the leg plates')
  cellOut(ys, az, R, true, () => [0, z0], (y, a) => { const rb = reachB(y, a) + D.clear + D.t, rpp = reachP(y, a); return Math.max(rb, rpp > 0 ? rpp + gapU + D.t : 0); });
  const pt = (n) => { const r = n.r; return [Math.sin(rad(n.az)) * r, n.y, z0 + Math.cos(rad(n.az)) * r]; };
  // (the shell's nodes as the band's: y, az, and the reach in `off`)
  const rows = ys.map((row, i) => ({ y: row, off: R[i] }));
  const P = shell(rows, az, (n) => pt({ y: n.y, az: n.az, r: n.off }), { t: D.t, raise: D.raise, trim: D.trim, closed: true, trimTop: true, trimBottom: true });
  for (const row of P.pts) row[0] = [0, row[0][1], row[0][2]];
  const ids = lay(G, P, 'band');
  // (on the pelvis, or where `Bd.ease` says, the skin's weights under its foot eased onto the pelvis toward its top)
  const uOf = P.nodes.map((row) => row.map((n) => { const k = az.indexOf(n.az); return (yTop[k] - n.y) / (yTop[k] - yBot[k]); }));
  G.plates.push({ tag: 'band', bone: 'pelvis', ids, side: 'c', stops: Bd.ease ? 'skin' : null, ease: Bd.ease ?? null, uOf });
}

/**
 * The base layer: the body's pelvis and leg polygons from the hip cut down to the ankle (every corner above the ankle
 * ring's lowest by `m`), on the body's own vertices: [polygon indices of the body].
 */
export function baseLayer(rig, m = 0.02) {
  const { B } = rig;
  const an = B.names.map((n, i) => (/^an\d\.[LR]$/.test(n) ? i : -1)).filter((i) => i >= 0);
  const ankle = Math.min(...an.map((i) => B.verts[i][1]));
  const parts = new Set(['pelvis', 'legs']);
  const ok = (i) => parts.has(B.part[i]) && B.verts[i][1] > ankle - m;
  return B.polys.map((p, k) => (p.v.every(ok) ? k : -1)).filter((k) => k >= 0);
}

/** The leggings with their base layer: the plates (buildPlateLegs) and, laid first, the body's own polygons it copies in the under-material. */
export function buildWithBase(rig, design, o) {
  const G = buildPlateLegs(rig, design, o);
  const { B } = rig, hides = baseLayer(rig);
  // (the base layer's vertices: the body's, each once)
  const map = new Map();
  const nP = G.polys.length;
  G.tag = 'base';
  for (const k of hides) {
    const v = B.polys[k].v.map((i) => { if (!map.has(i)) map.set(i, G.vert([...B.verts[i]], 'base')); return map.get(i); });
    G.polys.push({ v, mat: 'shade', part: 'base', tag: 'base' });
  }
  G.baseOf = map;
  // (pulled in under the plates: each vertex off the layer's edge in along its normal by `sink`, so the plates hug the
  // body's line while the body under them can swell a little as it bends; its edges, against the body, stay put)
  const sink = (design ?? DESIGN[rig.who]).sink ?? 0;
  if (sink > 0) {
    const edge = new Map();
    for (let q = nP; q < G.polys.length; q++) { const v = G.polys[q].v; v.forEach((a, k) => { const b = v[(k + 1) % v.length], key = a < b ? `${a},${b}` : `${b},${a}`; edge.set(key, (edge.get(key) ?? 0) + 1); }); }
    const rim = new Set();
    for (const [key, n] of edge) if (n === 1) for (const x of key.split(',')) rim.add(+x);
    const nrm = new Map();
    for (let q = nP; q < G.polys.length; q++) { const v = G.polys[q].v, n = newell(G.verts, v); for (const i of v) nrm.set(i, add(nrm.get(i) ?? [0, 0, 0], n)); }
    for (const [i, n] of nrm) if (!rim.has(i)) G.verts[i] = sub(G.verts[i], mul(unit(n), sink));
  }
  // (its triangles the body's own: a polygon off its plane cut as the body cuts it)
  const T = trisOf({ polys: G.polys.slice(0, nP) }), at = new Map(hides.map((k, n) => [k, nP + n]));
  for (const t of B.tris) if (at.has(t.poly)) T.push({ v: t.v.map((i) => map.get(i)), poly: at.get(t.poly) });
  G.tris = T;
  G.hides = hides;
  G.nPlatePolys = nP;
  return G;
}

/**
 * The weights: each plate rigid on its bone (the side's), the base layer the body's own at its vertices.
 */
const KEEP = +(process.env.KEEP ?? 2);
export function plateLegsWeights(rig, G) {
  const vw = new Array(G.verts.length).fill(null);
  const at = (n) => rig.at.get(n);
  // (a plate over a joint that follows the skin under it: the body's weights at the closest point of its pelvis and
  // legs, smoothed along the plate, the two largest kept)
  const skinned = new Set(G.plates.filter((p) => p.stops === 'skin').flatMap((p) => p.ids.flat()));
  const parts = new Set(['pelvis', 'legs', 'torso']);
  const skinW = skinned.size ? transferWeights(rig, G, { only: (i) => skinned.has(i), keep: (i) => parts.has(rig.B.part[i]), smooth: 2, map: (n) => (/^spine/.test(n) ? 'pelvis' : n) }).map((l) => {
    if (!l) return l;
    const two = [...l].sort((a, b) => b[1] - a[1]).slice(0, KEEP), t = two.reduce((a, [, w]) => a + w, 0);
    return two.map(([b, w]) => [b, w / t]);
  }) : [];
  for (const pl of G.plates) {
    const name = (b) => (pl.side === 'c' || b === 'pelvis' ? b : `${b}_${pl.side}`);
    pl.ids.forEach((row, i) => row.forEach((v, k) => {
      if (!pl.stops) { vw[v] = [[at(name(pl.bone)), 1]]; return; }
      if (pl.stops === 'skin') {
        // (the skin's weights, eased into one bone over a span of the plate's height where it lies under or over a
        // rigid plate: `ease`, [[u0, u1, bone], ...]; the two largest kept)
        const u = pl.uOf[i][k], m = new Map(skinW[v]);
        for (const [u0, u1, bone] of pl.ease ?? []) {
          const f = u0 < u1 ? Math.max(0, Math.min(1, (u - u0) / (u1 - u0))) : Math.max(0, Math.min(1, (u0 - u) / (u0 - u1)));
          if (f <= 0) continue;
          for (const [b, w] of m) m.set(b, w * (1 - f));
          const bi = at(name(bone)); m.set(bi, (m.get(bi) ?? 0) + f);
        }
        const two = [...m].sort((a, b) => b[1] - a[1]).slice(0, KEEP), t = two.reduce((a, [, w]) => a + w, 0);
        vw[v] = two.map(([b, w]) => [b, w / t]);
        return;
      }
      // (between two stops, their bones blended by the share down: two bones at most)
      const u = Math.max(0, Math.min(1, pl.uOf[i][k])), S = pl.stops;
      let w = [[at(name(S[S.length - 1][1])), 1]];
      for (let s = 0; s + 1 < S.length; s++) if (u >= S[s][0] && u <= S[s + 1][0]) {
        const f = S[s + 1][0] > S[s][0] ? (u - S[s][0]) / (S[s + 1][0] - S[s][0]) : 1, a = at(name(S[s][1])), b = at(name(S[s + 1][1]));
        w = a === b ? [[a, 1]] : [[a, 1 - f], [b, f]].filter(([, x]) => x > 1e-6);
        break;
      }
      vw[v] = w;
    }));
  }
  if (G.baseOf) for (const [b, g] of G.baseOf) vw[g] = rig.vw[b].map(([bi, w]) => [bi, w]);
  return vw.map((w) => w ?? [[at('pelvis'), 1]]);
}

/* ---- the game's copy ------------------------------------------------------------------------------------------------ */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync } = await import('node:fs');
  const { buildRig } = await import('../lowrig.mjs');
  const { garmentAsset } = await import('../lowgarment.mjs');
  for (const who of ['male', 'female']) {
    const rig = buildRig(who), G = buildWithBase(rig);
    G.vw = plateLegsWeights(rig, G);
    const file = new URL(`../../../src/sculpt/assets/lowplatelegs-${who}.json`, import.meta.url);
    const A = { built: 'node tools/sculpt/garments/platelegs.mjs (tools/sculpt/lowgarment.mjs garmentAsset)', ...garmentAsset(rig, G, MATS, LOOKS), hides: G.hides };
    writeFileSync(file, JSON.stringify(A));
    console.log(who, `${G.verts.length} vertices, ${G.tris.length} triangles, ${A.base} + ${A.bones.length} bones, ${A.hides.length} body polygons hidden: wrote`, file.pathname);
  }
}
