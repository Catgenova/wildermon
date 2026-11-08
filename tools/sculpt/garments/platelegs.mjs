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
// vertices and weights, in the dark under-material; the body's polygons it copies are hidden while it is worn, so it can
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
import { meshOf, orient, trisOf, samplesOf, lerp, sub, add, mul, unit, cross, dot } from '../lowgarment.mjs';

/** The plate set's materials, shared by name and colour with the set's other pieces: plate, its darker shade, gold, the glow (emissive), the base layer. */
export const MATS = {
  plate: [0.82, 0.65, 0.54],
  shade: [0.68, 0.51, 0.41],
  gold: [0.96, 0.74, 0.4],
  glow: [1, 0.906, 0.651],
  under: [0.29, 0.22, 0.2],
};
/** The emissive materials (unlit, glowing in the renderer's bloom). */
export const GLOW = ['glow'];

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
    clear: 0.04, gap: 0.02, t: 0.045, raise: 0.022, trim: 0.07, thigh: [0, 50, 91, 132, 180, 229, 271, 312],
    low: { clear: 0.025, gap: 0.01, t: 0.03, raise: 0.015, trim: 0.06 },
    band: { z0: -0.06, az: [0, 30, 70, 110, 150, 180], top: [-3.99, -3.97, -3.94, -3.94, -3.97, -3.99], bottom: [-5.45, -4.95, -4.6, -4.62, -4.74, -4.86] },
    lame: { rows: [{ y: tab([[0, -4.85], [91, -4.42], [180, -4.66], [229, -5.62], [271, -5.88], [312, -5.62]]), lvl: 0 }, { y: tab([[0, -5.45], [91, -5.25], [180, -5.3], [229, -5.85], [271, -6.0], [312, -5.85]]), lvl: 1 }, { y: [-6.05, -5.95, -6.0, -6.2], lvl: 1 }] },
    cuisse: { rows: [{ y: [-5.75, -5.68, -5.75, -6.05], lvl: 0 }, { y: -6.62, lvl: 0 }, { y: [-7.3, -7.12, -6.95, -7.05], lvl: 0 }] },
    knee: { top: -6.68, mid: -7.42, bottom: -8.1, wing: 84, lvl: 1.7, bulge: 0.12, inset: 0.24, ring: [0.33, 0.42] },
    shinUp: { az: [-92, -48, -6, 0, 6, 48, 92], rows: [{ y: [-7.72, -7.85, -7.85, -7.85], lvl: 0 }, { y: [-8.62, -8.58, -8.58, -8.58], lvl: 1 }] },
    shinLow: { az: [-92, -48, -6, 0, 6, 48, 92], rows: [{ y: -8.4, lvl: 0 }, { y: -10.36, lvl: 0.4 }] },
    calf: { az: [98, 139, 180, 221, 262], segs: [[-8.05, -8.9], [-8.75, -9.6], [-9.45, -10.36]], chevron: 0.18 },
  },
  female: {
    clear: 0.035, gap: 0.018, t: 0.04, raise: 0.02, trim: 0.06, thigh: [0, 38, 88, 143, 180, 218, 275, 325],
    low: { clear: 0.02, gap: 0.008, t: 0.026, raise: 0.012, trim: 0.05 },
    band: { z0: -0.38, az: [0, 30, 70, 110, 150, 180], top: [-3.63, -3.61, -3.58, -3.58, -3.61, -3.64], bottom: [-4.32, -3.98, -3.9, -3.95, -4.06, -4.16] },
    cuisse: { hip: 2, rows: [{ y: tab([[0, -3.95], [88, -3.76], [180, -3.98], [218, -4.4], [275, -4.75], [325, -4.45]]), lvl: 0 }, { y: tab([[0, -4.45], [88, -4.4], [180, -4.5], [218, -4.75], [275, -5.0], [325, -4.8]]), lvl: 0 }, { y: [-6.58, -6.45, -6.25, -6.35], lvl: 0 }] },
    knee: { top: -6.0, mid: -6.74, bottom: -7.42, wing: 82, lvl: 1.7, bulge: 0.1, inset: 0.24, ring: [0.33, 0.42] },
    shinUp: { az: [-92, -48, -6, 0, 6, 48, 92], rows: [{ y: [-7.02, -7.15, -7.15, -7.15], lvl: 0 }, { y: [-8.0, -7.95, -7.95, -7.95], lvl: 1 }] },
    shinLow: { az: [-92, -48, -6, 0, 6, 48, 92], rows: [{ y: -7.8, lvl: 0 }, { y: -10.5, lvl: 0.4 }] },
    calf: { az: [98, 139, 180, 221, 262], segs: [[-7.4, -8.4], [-8.25, -9.4], [-9.25, -10.5]], chevron: 0.2 },
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
  const T = bodyTris(B, new Set(['torso', 'pelvis', 'legs']), (p) => p[0] > -1e-6);
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

/* ---- a plate ------------------------------------------------------------------------------------------------------- */
/**
 * A plate as a grid of nodes (y, az, off) evaluated by `pt`: its rows (each a height and an outer offset per column),
 * its edges turned in by the thickness t (a lip) where `lip` says, a trimmed edge raised by `raise` over a band `trim`
 * wide (gold), an open plate turned in at its sides too (`sides`). Returns { nodes, pts, closed, mat(i, k) }.
 */
function shell(rows, az, pt, { t, raise, trim, closed = false, lipTop = true, trimTop = false, trimBottom = true, sides = true, mat = 'plate', lipMat = 'shade', inset = null }) {
  const R = rows.length;
  const node = (i, k, dOff = 0) => ({ y: rows[i].y[k], az: az[k], off: rows[i].off[k] + dOff });
  // (the node `trim` along the plate from row i toward row j, raised)
  const toward = (i, j, k) => { const a = rows[i], b = rows[j], f = Math.min(0.4, trim / (Math.abs(a.y[k] - b.y[k]) || 1)); return { y: a.y[k] + (b.y[k] - a.y[k]) * f, az: az[k], off: a.off[k] + (b.off[k] - a.off[k]) * f + raise }; };
  const N = [], band = [], up = [];
  const push = (row, m, r = false) => { N.push(row); band.push(m); up.push(r); };
  const C = az.length, cols = [...Array(C).keys()];
  if (trimTop) { push(cols.map((k) => node(0, k, -t)), 'gold'); push(cols.map((k) => node(0, k, raise)), 'gold', true); push(cols.map((k) => toward(0, 1, k)), null, true); }
  else { if (lipTop) push(cols.map((k) => node(0, k, -t)), lipMat); push(cols.map((k) => node(0, k)), null); }
  for (let i = 1; i < R - 1; i++) push(cols.map((k) => node(i, k)), null);
  if (trimBottom) { push(cols.map((k) => toward(R - 1, R - 2, k)), 'gold', true); push(cols.map((k) => node(R - 1, k, raise)), 'gold', true); push(cols.map((k) => node(R - 1, k, -t)), null); }
  else { push(cols.map((k) => node(R - 1, k)), lipMat); push(cols.map((k) => node(R - 1, k, -t)), null); }
  let nodes = N;
  const open = !closed && sides;
  if (open) nodes = N.map((row, i) => [{ ...row[0], off: row[0].off - t - (up[i] ? raise : 0) }, ...row, { ...row[C - 1], off: row[C - 1].off - t - (up[i] ? raise : 0) }]);
  const W = nodes[0].length;
  const m = (i, k) => {
    if (band[i]) return band[i];
    if (open && (k === 0 || k === W - 2)) return lipMat;
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
      for (const ring of F.ringY) {
        const ys = az.map((x) => ring.yAt(x));
        const inside = ys.filter((y, k) => y < a.y[k] - 0.08 && y > b.y[k] + 0.08).length;
        if (inside < az.length / 2) continue;
        const y = ys.map((y, k) => Math.min(a.y[k] - 0.05, Math.max(b.y[k] + 0.05, y)));
        more.push({ i, y, lvl: y.map((yy, k) => a.lvl[k] + (b.lvl[k] - a.lvl[k]) * (a.y[k] - yy) / (a.y[k] - b.y[k])) });
      }
    }
    for (const m of more.reverse()) rows.splice(m.i + 1, 0, { y: m.y, lvl: m.lvl });
    rows.sort((p, q) => q.y.reduce((s2, x) => s2 + x, 0) - p.y.reduce((s2, x) => s2 + x, 0));
    rows = rows.map((r) => ({ y: r.y, off: r.lvl.map((l, k) => offOf(S, l) + (o.ridge ? o.ridge(k) : 0)) }));
    // (each face across from one column to the next clear of the body as the columns are: where the body under it
    // bulges past the straight face, both columns out by as much)
    const closed = o.closed ?? false;
    for (const r of rows) { const base = r.off.slice(); chordOut(az, closed, r.off, (k, f) => {
      const j = (k + 1) % az.length, y = r.y[k] + (r.y[j] - r.y[k]) * f, a = az[k] + ((((az[j] - az[k]) % 360) + 540) % 360 - 180) * f;
      return { want: F.at(y, a, base[k] + (base[j] - base[k]) * f), p0: F.at(r.y[k], az[k], r.off[k]), p1: F.at(r.y[j], az[j], r.off[j]), c: F.axis(y) };
    }); }
    const P = shell(rows, az, (n) => F.at(n.y, n.az, n.off), { t: S.t, raise: S.raise, trim: S.trim, ...o });
    const ids = lay(G, P, tag);
    G.plates.push({ tag, bone, ids, side: 'l', rowW: o.rowW ?? null, nodes: P.nodes });
    return P;
  };
  const LOW = { ...D, ...D.low };
  // ---- the calf: three chevrons behind, each over the top of the one below it ---------------------------------------
  const C3 = D.calf, chev = (y, a) => y - C3.chevron * Math.max(0, -Math.cos(rad(a))) ** 2;
  C3.segs.forEach(([top, bot], s) => legPlate(`calf${s}`, 'calf', [{ y: (a) => chev(top, a), lvl: 0 }, { y: (a) => chev(bot, a), lvl: 1 }], C3.az, LOW, { lipTop: s === 0 }));
  // ---- the shin: the lower plate, the upper over its top; the centre line raised, gold either side of it -------------
  for (const [tag, d] of [['shinLow', D.shinLow], ['shinUp', D.shinUp]]) {
    const c = d.az.indexOf(0);
    legPlate(tag, 'calf', d.rows, d.az, LOW, { lipTop: false, ridge: (k) => (k === c ? 0.02 : 0), inset: (i, k) => (k === c - 1 || k === c ? 'gold' : null) });
  }
  // ---- the cuisse round the thigh, his lame over its top --------------------------------------------------------------
  legPlate('cuisse', 'thigh', D.cuisse.rows, D.thigh, D, { closed: true, lipTop: false });
  // ---- the knee guard ---------------------------------------------------------------------------------------------------
  kneeGuard(G, D, F);
  if (D.lame) legPlate('lame', 'hip', D.lame.rows, D.thigh, D, { closed: true });
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
 * turned in by the thickness; all round the knee's axis at its middle height.
 */
function kneeGuard(G, D, F) {
  const K = D.knee, c = F.axis(K.mid), base = D.clear + K.lvl * (D.t + D.gap) + D.t;
  const W = K.wing;
  const outline = [[0, K.top], [W * 0.55, (K.top + K.mid) / 2 + 0.05], [W, K.mid], [W * 0.55, (K.mid + K.bottom) / 2 - 0.03], [0, K.bottom], [-W * 0.55, (K.mid + K.bottom) / 2 - 0.03], [-W, K.mid], [-W * 0.55, (K.top + K.mid) / 2 + 0.05]];
  const at = (az, y, off) => F.at(y, az, off, c);
  // (the apex out by the bulge over the guard's base offset; a node f of the way from the outline in to the apex)
  const apexN = [0, K.mid, base + K.bulge];
  const toward = ([az, y], f, raise) => [az + (apexN[0] - az) * f, y + (apexN[1] - y) * f, base + (apexN[2] - base) * f + raise];
  const ptOf = ([az, y, off]) => at(az, y, off);
  const lip = outline.map(([az, y]) => at(az, y, base - D.t)), rim = outline.map(([az, y]) => at(az, y, base + D.raise));
  const rimIn = outline.map((o) => ptOf(toward(o, 0.16, D.raise)));
  // (the gold ring and the inset: diamonds, the outline's top, wings and bottom only)
  const dia = [0, 2, 4, 6].map((k) => outline[k]);
  const ring = dia.map((o) => ptOf(toward(o, 1 - K.ring[1], 0.012))), ringIn = dia.map((o) => ptOf(toward(o, 1 - K.ring[0], 0.012)));
  const inset = dia.map((o) => ptOf(toward(o, 1 - K.inset, 0.004))), apex = ptOf(apexN);
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
    G.poly([iInset[q], iInset[(q + 1) % 4], iApex], 'glow', tag);
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
  const Bd = D.band, z0 = Bd.z0;
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
    over[i][k] = rp > 0 && rp + D.gap + D.t > rb ? 1 : 0;
    return Math.max(rb, rp > 0 ? rp + D.gap + D.t : 0);
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
  // (each face between columns clear of the body and the plates under it, as the leg plates')
  const ptR = (y, a, r) => [Math.sin(rad(a)) * r, y, z0 + Math.cos(rad(a)) * r];
  R.forEach((row, i) => {
    const base = row.slice();
    chordOut(az, true, row, (k, f) => {
      const j = (k + 1) % az.length, y = ys[i][k] + (ys[i][j] - ys[i][k]) * f, a = az[k] + ((((az[j] - az[k]) % 360) + 540) % 360 - 180) * f;
      const rb = reachB(y, a) + D.clear + D.t, rpp = reachP(y, a), rw = Math.min(Math.max(rb, rpp > 0 ? rpp + D.gap + D.t : 0), Math.max(base[k], base[j]) + 0.15);
      return { want: ptR(y, a, rw), p0: ptR(ys[i][k], az[k], row[k]), p1: ptR(ys[i][j], az[j], row[j]), c: [0, z0] };
    });
  });
  // (the rows no tighter than the one below: the band stands as a band)
  for (let i = R.length - 2; i >= 0; i--) R[i] = R[i].map((r, k) => Math.max(r, R[i + 1][k] - 0.03));
  const pt = (n) => { const r = n.r; return [Math.sin(rad(n.az)) * r, n.y, z0 + Math.cos(rad(n.az)) * r]; };
  // (the shell's nodes as the band's: y, az, and the reach in `off`)
  const rows = ys.map((row, i) => ({ y: row, off: R[i] }));
  const P = shell(rows, az, (n) => pt({ y: n.y, az: n.az, r: n.off }), { t: D.t, raise: D.raise, trim: D.trim, closed: true, trimTop: true, trimBottom: true });
  for (const row of P.pts) row[0] = [0, row[0][1], row[0][2]];
  const ids = lay(G, P, 'band');
  G.plates.push({ tag: 'band', bone: 'pelvis', ids, side: 'c' });
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
    G.polys.push({ v, mat: 'under', part: 'base', tag: 'base' });
  }
  G.baseOf = map;
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
export function plateLegsWeights(rig, G) {
  const vw = new Array(G.verts.length).fill(null);
  const at = (n) => rig.at.get(n);
  for (const pl of G.plates) {
    const bone = pl.side === 'c' ? pl.bone : `${pl.bone}_${pl.side}`;
    for (const row of pl.ids) for (const i of row) vw[i] = [[at(bone), 1]];
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
    const A = { built: 'node tools/sculpt/garments/platelegs.mjs (tools/sculpt/lowgarment.mjs garmentAsset)', ...garmentAsset(rig, G, MATS), hides: G.hides, glow: GLOW.map((n) => Object.keys(MATS).indexOf(n)) };
    writeFileSync(file, JSON.stringify(A));
    console.log(who, `${G.verts.length} vertices, ${G.tris.length} triangles, ${A.base} + ${A.bones.length} bones, ${A.hides.length} body polygons hidden: wrote`, file.pathname);
  }
}
