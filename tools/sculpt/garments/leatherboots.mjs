// The leather boots of the third outfit, the leather set (its sheet: tools/sculpt/ref/leather-boots.png, worn in the
// set's lineups): high laced boots up the calf, a blocked heel and sole, a reinforced toe cap, an instep strap, X lacing
// up the shin's front between eyelets, and a layered cuff at the top: a chevroned band under a flared cuff, both V'd at
// the front and the back. Rivets on the strap, the band and the cuff. Enchanted, the lacing and the cuff's V (its two
// strokes and its top rim) glow, as the set's glow reference draws them. His and hers from one design (DESIGN, per
// body), fitted to each low-poly body's own foot (about 1.0 H heel to toe), skinned to its rig's leg and foot bones (no
// bones of its own).
//
//   buildLeatherBoots(rig, design?, { under }) → { verts, polys: [{ v, mat, part, tag }], tris, side, rings, design, hides, soles }
//   leatherBootWeights(rig, G) → per vertex [[bone, weight], ...] (the body's bones only)
//
//   node tools/sculpt/garments/leatherboots.mjs
//     writes the game's copy beside each body: src/sculpt/assets/lowleatherboots-male.json and lowleatherboots-female.json
//     (lowgarment.mjs garmentAsset with its looks plain and enchanted, plus `hides`, the body's polygons the boots cover,
//     and `soles`, the boots' sole vertices the body stands on; loaded by src/sculpt/lowpoly.ts); built over the leather
//     leggings' copy beside the body (lowleatherlegs-<who>.json) when there is one, or --under <dir>.
//
// The shape, per foot, in K = 16 columns round it (ANG: the angle round the leg, 0 the shin's front, + out), each a
// station on the foot's outline and a polyline up from the ground, the rings joined round:
//   the sole: r0 its underside (the arch's columns lifted: the heel's block), r1 its top edge, r2 the welt (in by `lip`);
//   the foot: r3 the wall's top, r4 over the foot (the toe box, the heel), r5 the toe cap's back edge (stood out), r6 the
//   seam behind it, then the instep up to the strap;
//   the strap: a0 its foot on the shaft, a1 out by its thickness (a trim bevel), a2 under its trim edge, a3 its top, a4
//   back on the shaft (lower in front, over the instep, rising round to the heel);
//   the shaft: g1 at its middle;
//   the band (the cuff's under layer): b0 its foot on the shaft, b1 out by its thickness (a trim bevel), b2 its top, b3
//   back toward the shaft (all the way where the shaft shows between it and the cuff, at the back; not at all where the
//   cuff overlaps it, in front);
//   the cuff: c0 its foot, c1 out by its thickness (a trim bevel), c2 under its rim, c3 its top (flared; notched at the
//   front), c4 the rim's inside, c5 the lip down inside it (the one open edge, round the leg).
// The shaft's rings are round the leg's axis, each column out from the leg's reach that way (the body's skin, the covered
// foot left out, and what the boots are worn over, `under`) by the clearance `clear`, the reach the most over a window
// of heights so a panel between two rings clears the calf. Heights from the strap up are shares of the boot's height
// `tall` (H) over the ground, per column. Decals laid on the shaft and the cuff (each vertex riding the boot's triangle
// under it): the lacing (rows of eyelets, ±`lace.a` degrees round the front, and a cord between each pair of rows
// crossing as an X, raised ridges), the cuff's V (two raised strokes from the rim to the cuff's front tip), the rivets
// (low six-sided domes) and the cuff's back badge.
//
// Heights: the foot's in the body's units over its floor (rig.J.floor); the body stands on the boots' soles: the ground
// is the floor less the sole and `gap`.
import { meshOf, orient, trisOf, transferWeights, samplesOf, crossPairs, sub, add, mul, dot, cross, unit, lerp } from '../lowgarment.mjs';

/** sRGB 0..255 to 0..1. */
const C = (r, g, b) => [r / 255, g / 255, b / 255];
/**
 * The materials, shared by the leather set's pieces (the same names and colours: the game shares the slots): the dark
 * brown, the leather, the light leather, the trim tan, and the rune (the lacing and the cuff's V: trim when plain, the
 * glow when enchanted). The sheet's swatches until the chest's measured values are relayed.
 */
export const MATS = {
  dark: C(81, 47, 44),
  leather: C(112, 60, 43),
  light: C(148, 81, 54),
  trim: C(222, 132, 79),
  rune: C(222, 132, 79),
};
export const GLOW = C(254, 202, 109);
/** The boots plain and enchanted (lowgarment.mjs garmentAsset `looks`): enchanted, the rune unlit at the glow. */
export const LOOKS = {
  plain: Object.fromEntries(Object.entries(MATS).map(([n, c]) => [n, { c, kind: 0 }])),
  enchanted: { ...Object.fromEntries(Object.entries(MATS).map(([n, c]) => [n, { c, kind: 0 }])), rune: { c: GLOW, kind: 1 } },
};

/** The design's columns (its per-column lists are given at these angles round the leg)... */
const BASE = [0, 36, 72, 108, 144, 180, -144, -108, -72, -36];
/** ...and the boot's: closer round the toe and the shin's front, the lists taken between the design's by angle. */
export const ANG = [0, 18, 36, 54, 72, 90, 108, 144, 180, -144, -108, -90, -72, -54, -36, -18];
const LISTS = ['cols', 'wall', 'lean', 'dome', 'top', 'shrink', 'mix', 'fill'];
const HLISTS = ['strap', 'band', 'bandTop', 'cuffLo', 'cuffTop', 'flare'];
/**
 * A design's per-column lists on the boot's columns: each the design's at its angle, or between the two design columns
 * either side by angle (a list's null where either is null); `bulge` per column, how far between (0 on a design column,
 * 1 half way), for the outline to round out there.
 */
function upsample(D) {
  const at = (a) => { const x = ((a % 360) + 360) % 360, i = Math.floor(x / 36) % 10; return [i, (i + 1) % 10, (x - 36 * i) / 36]; };
  const pos = BASE.map((a) => ((a % 360) + 360) % 360);
  const map = (L) => ANG.map((a) => {
    const [i, , t] = at(a), A = L[pos.indexOf(36 * i)], Bv = L[pos.indexOf((36 * (i + 1)) % 360)];
    if (t === 0) return A;
    if (A == null || Bv == null) return null;
    return Array.isArray(A) ? A.map((x, k) => x + (Bv[k] - x) * t) : A + (Bv - A) * t;
  });
  const o = { ...D, bulge: ANG.map((a) => { const t = at(a)[2]; return 4 * t * (1 - t); }), cap: { ...D.cap, du: map(D.cap.du), h: map(D.cap.h), in: map(D.cap.in) } };
  for (const k of LISTS) o[k] = map(D[k]);
  o.h = Object.fromEntries(HLISTS.map((k) => [k, map(D.h[k])]));
  return o;
}

/**
 * The design per body. Lengths in the body's units; H the head's height.
 *   sole, gap, lip, margin: the sole's thickness, the gap under the body's sole, the welt, the outline past the body's
 *     foot at the toe and the heel; arch: the sole's underside lifted under the arch's columns (the heel's block);
 *     spring: the toe lifted off the ground (at its front, and 36 degrees round); round: the columns between the
 *     design's pushed out from the foot's middle by this at most;
 *   cols: per column [f, v] on the foot (f from the heel's back 0 to the toe's front 1, v off the foot's middle line, +
 *     out); wall, top: r3's and r4's heights over the floor; lean, shrink: r3 and r4 in from the outline; dome: r4 back
 *     along the foot from the outline; mix: r4 the share of the way from the outline to the shaft;
 *   clear: the shaft off the leg; over: off what it is worn over (`under`: the leggings); win: the window of heights
 *     the reach is taken over; fill: per column further out;
 *   cap: the toe cap's back edge (r5): on its columns du back along the foot, h over the floor, `in` from the outline;
 *     the others t of the way from r4 to the strap's foot, stood out by `lip`; the seam behind it (r6) `seam` of the way
 *     on toward the strap's foot, sunk toward the leg by `sink`;
 *   tall: the boot's height over the ground (H); h: per column, shares of it: strap (the strap's foot), band and
 *     bandTop (the band's foot and top), cuffLo and cuffTop (the cuff's foot and top), flare (the cuff's top out, the
 *     body's units);
 *   strap: { w (its height), trim (its top edge's), out (its thickness) } in H but out; band, cuff: { out, trim, rim
 *     (the rim's height), lip (the lip down inside, H), gap (the lip's foot off the leg, a share of `clear`) };
 *   mid: the shaft's middle ring, a share of the way from the strap's top to the band's foot;
 *   lace: { a (the eyelets' angle off the front), rows, lo, hi (the lowest and the highest row, shares of `tall`), w
 *     (the cord's width), h (its rise), lift (the upper cord's rise where they cross) }; eyelet, rivet: { r, h };
 *   vee: { a (the strokes' angle off the front at the rim), w, h, down (how far under the rim they start, a share of
 *     the cuff's front) }; rivets: [[place, angle, share up it]].
 */
export const DESIGN = {
  male: {
    H: 2.06, sole: 0.24, gap: 0.012, lip: 0.05, margin: { toe: 0.05, heel: 0.04 }, arch: 0.16, spring: [0.05, 0.025], round: 0.08,
    cols: [[1, 0], [0.9, 0.4], [0.62, 0.56], [0.3, 0.44], [0.06, 0.36], [0, 0], [0.06, -0.36], [0.3, -0.4], [0.62, -0.54], [0.9, -0.4]],
    wall: [0.22, 0.22, 0.22, 0.22, 0.22, 0.22, 0.22, 0.22, 0.22, 0.22],
    lean: [0.03, 0.03, 0.03, 0.02, 0.02, 0.02, 0.02, 0.02, 0.03, 0.03],
    dome: [0.14, 0.1, 0.03, 0, 0, 0, 0, 0, 0.03, 0.1],
    top: [0.5, 0.48, 0.5, 0.56, 0.52, 0.5, 0.52, 0.56, 0.5, 0.48],
    shrink: [0.08, 0.07, 0.05, 0.02, 0.02, 0.02, 0.02, 0.02, 0.05, 0.07],
    mix: [0, 0.05, 0.3, 0.8, 1, 1, 1, 0.8, 0.3, 0.05],
    clear: 0.1, over: 0.035, win: 0.3, fill: [0.02, 0, 0, 0, 0.02, 0.03, 0.02, 0, 0, 0],
    cap: { du: [0.66, 0.56, 0.16, null, null, null, null, null, 0.16, 0.56], h: [0.54, 0.53, 0.56, 0, 0, 0, 0, 0, 0.56, 0.53], in: [0.1, 0.08, 0.06, 0, 0, 0, 0, 0, 0.06, 0.08], t: 0.3, lip: 0.03, seam: 0.12, sink: 0.04 },
    tall: 2.0,
    h: {
      strap: [0.27, 0.265, 0.25, 0.23, 0.215, 0.21, 0.215, 0.23, 0.25, 0.265],
      band: [0.6, 0.63, 0.67, 0.68, 0.65, 0.61, 0.65, 0.68, 0.67, 0.63],
      bandTop: [0.8, 0.8, 0.78, 0.77, 0.74, 0.71, 0.74, 0.77, 0.78, 0.8],
      cuffLo: [0.67, 0.72, 0.77, 0.79, 0.81, 0.82, 0.81, 0.79, 0.77, 0.72],
      cuffTop: [0.91, 0.95, 0.96, 0.98, 1, 1.01, 1, 0.98, 0.96, 0.95],
      flare: [0.2, 0.18, 0.18, 0.18, 0.16, 0.16, 0.16, 0.18, 0.18, 0.18],
    },
    strap: { w: 0.15, trim: 0.035, out: 0.06 },
    band: { out: 0.06, trim: 0.03 },
    cuff: { out: 0.08, trim: 0.03, rim: 0.035, lip: 0.12, gap: 0.5 },
    mid: 0.5,
    lace: { a: 22, rows: 4, lo: 0.37, hi: 0.6, w: 0.06, h: 0.025, base: 0.012, lift: 0.032 },
    eyelet: { r: 0.045, h: 0.03 },
    rivet: { r: 0.04, h: 0.025 },
    vee: { a: 30, w: 0.05, h: 0.02, down: 0.18 },
    rivets: [['strap', 80, 0.5], ['strap', -80, 0.5], ['band', 50, 0.45], ['band', -50, 0.45], ['band', 150, 0.45], ['band', -150, 0.45], ['cuff', 60, 0.3], ['cuff', -60, 0.3]],
    badge: { t: 0.55, w: 0.12, h: 0.16, lift: 0.025 },
  },
  female: {
    H: 2.07, sole: 0.2, gap: 0.012, lip: 0.04, margin: { toe: 0.05, heel: 0.02 }, arch: 0.14, spring: [0.05, 0.025], round: 0.06,
    cols: [[1, 0], [0.9, 0.34], [0.62, 0.47], [0.3, 0.36], [0.06, 0.32], [0, 0], [0.06, -0.32], [0.3, -0.33], [0.62, -0.45], [0.9, -0.34]],
    wall: [0.19, 0.19, 0.19, 0.19, 0.19, 0.19, 0.19, 0.19, 0.19, 0.19],
    lean: [0.02, 0.02, 0.03, 0.02, 0.02, 0.02, 0.02, 0.02, 0.03, 0.02],
    dome: [0.18, 0.13, 0.03, 0, 0, 0, 0, 0, 0.03, 0.13],
    top: [0.44, 0.42, 0.44, 0.52, 0.48, 0.46, 0.48, 0.52, 0.44, 0.42],
    shrink: [0.07, 0.06, 0.04, 0.02, 0.02, 0.02, 0.02, 0.02, 0.04, 0.06],
    mix: [0, 0.05, 0.3, 0.8, 1, 1, 1, 0.8, 0.3, 0.05],
    clear: 0.09, over: 0.03, win: 0.3, fill: [0.01, 0, 0, 0, 0.01, 0.02, 0.01, 0, 0, 0],
    cap: { du: [0.62, 0.52, 0.1, null, null, null, null, null, 0.1, 0.52], h: [0.48, 0.47, 0.5, 0, 0, 0, 0, 0, 0.5, 0.47], in: [0.09, 0.09, 0.08, 0, 0, 0, 0, 0, 0.08, 0.09], t: 0.3, lip: 0.025, seam: 0.14, sink: 0.03 },
    tall: 2.0,
    h: {
      strap: [0.27, 0.265, 0.25, 0.23, 0.215, 0.21, 0.215, 0.23, 0.25, 0.265],
      band: [0.6, 0.63, 0.67, 0.68, 0.65, 0.61, 0.65, 0.68, 0.67, 0.63],
      bandTop: [0.8, 0.8, 0.78, 0.77, 0.74, 0.71, 0.74, 0.77, 0.78, 0.8],
      cuffLo: [0.67, 0.72, 0.77, 0.79, 0.81, 0.82, 0.81, 0.79, 0.77, 0.72],
      cuffTop: [0.91, 0.95, 0.96, 0.98, 1, 1.01, 1, 0.98, 0.96, 0.95],
      flare: [0.17, 0.15, 0.15, 0.15, 0.14, 0.14, 0.14, 0.15, 0.15, 0.15],
    },
    strap: { w: 0.13, trim: 0.03, out: 0.05 },
    band: { out: 0.05, trim: 0.028 },
    cuff: { out: 0.07, trim: 0.028, rim: 0.03, lip: 0.11, gap: 0.5 },
    mid: 0.5,
    lace: { a: 22, rows: 4, lo: 0.37, hi: 0.6, w: 0.055, h: 0.022, base: 0.012, lift: 0.03 },
    eyelet: { r: 0.04, h: 0.026 },
    rivet: { r: 0.035, h: 0.022 },
    vee: { a: 30, w: 0.045, h: 0.018, down: 0.18 },
    rivets: [['strap', 80, 0.5], ['strap', -80, 0.5], ['band', 50, 0.45], ['band', -50, 0.45], ['band', 150, 0.45], ['band', -150, 0.45], ['cuff', 60, 0.3], ['cuff', -60, 0.3]],
    badge: { t: 0.55, w: 0.11, h: 0.15, lift: 0.022 },
  },
};

/** A foot's frame: the heel's back middle (the origin, on the floor), a (along the foot, heel to toe, level), b (across, outward), and its outline. */
export function footOf(B, side) {
  const P = (n) => B.verts[B.index.get(`${n}.${side}`)];
  const heel = lerp(P('ft3'), P('ft4'), 0.5), toe = lerp(P('ft0'), P('ft1'), 0.5);
  const a = unit([toe[0] - heel[0], 0, toe[2] - heel[2]]), sg = side === 'L' ? 1 : -1;
  let b = [a[2], 0, -a[0]];
  if (b[0] * sg < 0) b = mul(b, -1);
  const uv = (p) => [dot(sub(p, heel), a), dot(sub(p, heel), b)];
  const hex = ['ft0', 'ft1', 'ft2', 'ft3', 'ft4', 'ft5'].map((n) => uv(P(n)));
  const L = Math.max(...hex.map((p) => p[0])), u0 = Math.min(...hex.map((p) => p[0]));
  const span = (u) => {
    u = Math.max(u0 + 1e-3, Math.min(L - 1e-3, u));
    const vs = [];
    for (let k = 0; k < 6; k++) { const p = hex[k], q = hex[(k + 1) % 6]; if ((p[0] - u) * (q[0] - u) <= 0 && p[0] !== q[0]) vs.push(p[1] + (q[1] - p[1]) * (u - p[0]) / (q[0] - p[0])); }
    return [Math.min(...vs), Math.max(...vs)];
  };
  const at = (u, v, y) => [heel[0] + a[0] * u + b[0] * v, y, heel[2] + a[2] * u + b[2] * v];
  return { side, sg, heel, a, b, uv, span, L, u0, at };
}

/** The leg's axis at height y: the middles of its rings from the foot's (fc) to the knee's (kb), joined. */
function legAxis(B, side) {
  const ring = (r) => { const ps = []; for (let k = 0; k < 12; k++) { const i = B.index.get(`${r}${k}.${side}`); if (i !== undefined) ps.push(B.verts[i]); } return mul(ps.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / ps.length); };
  const pts = ['fc', 'an', 'cb', 'ca', 'kc', 'kb'].map(ring).sort((p, q) => p[1] - q[1]);
  return (y) => {
    if (y <= pts[0][1]) return pts[0];
    for (let i = 0; i + 1 < pts.length; i++) if (y <= pts[i + 1][1]) { const t = (y - pts[i][1]) / (pts[i + 1][1] - pts[i][1]); return lerp(pts[i], pts[i + 1], t); }
    return pts[pts.length - 1];
  };
}

/** The body's polygons the boots cover whole: the foot's block, the ankle's band and the shin up to the calf's lower ring (cb). */
const COVERED = /^(fc|ft|so|fb|an|cb)\d\.[LR]$/;

export function buildLeatherBoots(rig, design = DESIGN[rig.who], { under = [], parts = {} } = {}) {
  const { B } = rig, D = upsample(design), F = rig.J.floor, H = D.H, K = ANG.length;
  const P = { laces: true, vee: true, rivets: true, badge: true, ...parts };
  const ground = F - D.gap - D.sole, top = F - D.gap, tall = D.tall * H;
  const G = meshOf();
  G.side = []; G.rings = {}; G.hides = []; G.soles = []; G.foot = {}; G.legOf = {};
  const hidden = (p) => p.v.every((i) => COVERED.test(B.names[i]));
  for (const side of ['L', 'R']) {
    const ft = footOf(B, side), axis = legAxis(B, side);
    const yKnee = rig.J.knee[1];
    // the leg's skin on this side, the covered foot left out
    const footBlock = (p) => p.v.every((i) => /^(fc|ft|so|fb)\d\.[LR]$/.test(B.names[i]));
    const legPolys = B.polys.filter((p) => !footBlock(p) && p.v.every((i) => B.verts[i][1] < yKnee + 0.6 && Math.sign(B.verts[i][0]) === ft.sg));
    const S = samplesOf({ tris: legPolys.flatMap((p) => { const o = []; for (let k = 1; k + 1 < p.v.length; k++) o.push({ v: [p.v[0], p.v[k], p.v[k + 1]] }); return o; }) }, B.verts, 0.04)
      .filter((p) => p[1] < yKnee + 0.6 && Math.sign(p[0]) === ft.sg);
    // the outline: each column's station along the foot, v off the foot's middle line
    const uB = ft.u0 - D.margin.heel, uT = ft.L + D.margin.toe;
    const mH = ft.span(ft.u0).reduce((a, b) => (a + b) / 2), mT = ft.span(ft.L).reduce((a, b) => (a + b) / 2);
    const outline0 = D.cols.map(([f, v]) => { const u = uB + f * (uT - uB), t = (u - ft.u0) / (ft.L - ft.u0); return [u, mH + (mT - mH) * t + v]; });
    const mid0 = [(uB + uT) / 2, outline0.reduce((s0, p) => s0 + p[1], 0) / K];
    const outline = outline0.map(([u, v], k) => { const d = [u - mid0[0], v - mid0[1]], l = Math.hypot(...d) || 1, b = (D.round ?? 0) * D.bulge[k]; return [u + d[0] / l * b, v + d[1] / l * b]; });
    const cU = (uB + uT) * 0.45, cV = outline.reduce((s0, p) => s0 + p[1], 0) / K, centre = ft.at(cU, cV, 0);
    const onOutline = (k, y, inset = 0) => { const p = ft.at(outline[k][0], outline[k][1], y), d = unit([p[0] - centre[0], 0, p[2] - centre[2]]); return [p[0] - d[0] * inset, y, p[2] - d[2] * inset]; };
    // the shaft: each column at its angle round the leg, out from the leg's reach that way over the window of heights
    const dirOf = (g) => { const t = g * Math.PI / 180; return unit(add(mul(ft.a, Math.cos(t)), mul(ft.b, Math.sin(t)))); };
    const ang = ANG.map(dirOf);
    const half = 22, ch = Math.cos(half * Math.PI / 180);
    const SU = under.flatMap((m) => samplesOf(m, m.verts, 0.04)).filter((p) => p[1] < yKnee + 0.6 && Math.sign(p[0]) === ft.sg);
    const reach = (k, y, pts = S) => {
      let r = 0;
      for (const p of pts) {
        if (Math.abs(p[1] - y) > D.win) continue;
        const c = axis(p[1]), w = [p[0] - c[0], p[2] - c[2]], l = Math.hypot(w[0], w[1]);
        if (l < 1e-9) continue;
        const cs = (w[0] * ang[k][0] + w[1] * ang[k][2]) / l;
        if (cs < ch) continue;
        r = Math.max(r, l * cs / ch);
      }
      return r;
    };
    const base = (k, y) => Math.max(reach(k, y) + D.clear, SU.length ? reach(k, y, SU) + D.over : 0);
    const onShaft = (k, y, extra = 0) => { const c = axis(y), r = base(k, y) + (D.fill?.[k] ?? 0) + extra; return [c[0] + ang[k][0] * r, y, c[2] + ang[k][2] * r]; };
    const R = {};
    const put = (key, pts) => { R[key] = pts.map((p) => { const i = G.vert(p, 'boot'); G.side[i] = side; return i; }); };
    const each = (f) => ANG.map((_, k) => f(k));
    const hy = (key, k) => ground + D.h[key][k] * tall;
    // the sole and the foot
    // (the arch's columns lifted: the heel's block; the toe sprung up a little)
    const lift0 = (k) => { const a = Math.abs(ANG[k]); return a === 90 ? D.arch : a === 72 ? D.arch * 0.85 : a <= 36 ? (D.spring?.[0] ?? 0) + ((D.spring?.[1] ?? 0) - (D.spring?.[0] ?? 0)) * a / 36 : 0; };
    put('r0', each((k) => onOutline(k, ground + lift0(k), -D.lip)));
    put('r1', each((k) => onOutline(k, top, -D.lip)));
    put('r2', each((k) => onOutline(k, top)));
    put('r3', each((k) => onOutline(k, F + D.wall[k], D.lean[k])));
    const onFoot = (k, du, y, inset) => {
      const [u, v] = outline[k], back = D.cols.map((c, j) => j).filter((j) => j !== k && Math.sign(D.cols[j][1]) === Math.sign(D.cols[k][1]) && D.cols[j][0] < D.cols[k][0]).sort((a, b) => D.cols[b][0] - D.cols[a][0])[0];
      const q = back === undefined || !D.cols[k][1] ? [u - du, v] : (() => { const o = outline[back], t = Math.min(1, du / Math.max(1e-6, u - o[0])); return [u - du, v + (o[1] - v) * t * 0.6]; })();
      const p = ft.at(q[0], q[1], y), d = unit([p[0] - centre[0], 0, p[2] - centre[2]]);
      return [p[0] - d[0] * inset, y, p[2] - d[2] * inset];
    };
    put('r4', each((k) => lerp(onFoot(k, D.dome[k], F + D.top[k], D.shrink[k]), onShaft(k, F + D.top[k]), D.mix[k])));
    // the toe cap's back edge (r5) on its columns: on the foot, `du` back from the outline (the edge between the front
    // and the sides' columns straight across, each at its own height)
    const r4p = (k) => G.verts[R.r4[k]];
    const cap = each((k) => (D.cap.du[k] != null ? lerp(onFoot(k, D.cap.du[k], F + D.cap.h[k], D.cap.in[k]), onShaft(k, F + D.cap.h[k]), D.mix[k]) : null));
    const k0 = ANG.indexOf(0);
    ANG.forEach((a, k) => { if (a === 0 || Math.abs(a) >= 72 || !cap[k]) return; const s0 = cap[k0], s1 = cap[ANG.indexOf(72 * Math.sign(a))], t = Math.abs(a) / 72; cap[k] = [s0[0] + (s1[0] - s0[0]) * t, F + D.cap.h[k], s0[2] + (s1[2] - s0[2]) * t]; });
    // the upper over the instep: each column from its foot (the toe cap's edge, or r4) straight up to where it meets the
    // shaft (the ankle's ring's height in front, r4's own at the heel, by `mix`), the shaft above
    const yAn = B.verts[B.index.get(`an0.${side}`)][1];
    const yJ = (k) => Math.max(r4p(k)[1] + 0.05, yAn + (r4p(k)[1] - yAn) * D.mix[k]);
    const J = each((k) => onShaft(k, yJ(k)));
    const onUpper = (k, y, extra = 0) => {
      if (y >= yJ(k)) return onShaft(k, y, extra);
      const a = cap[k] ?? r4p(k), b = J[k], t = Math.max(0, Math.min(1, (y - a[1]) / (b[1] - a[1]))), p = lerp(a, b, t);
      // (out square to the slope, in the column's upright plane)
      const s0 = sub(b, a); let n = unit(add(mul(ang[k], s0[1]), [0, -dot(s0, ang[k]), 0]));
      if (dot(n, ang[k]) < 0) n = mul(n, -1);
      return add(p, mul(n, extra));
    };
    // the strap: its foot per column, its height `w`, its top edge `trim` (trim), stood out by `out`
    const sLo = (k) => hy('strap', k), sHi = (k) => sLo(k) + D.strap.w * H;
    put('a0', each((k) => onUpper(k, sLo(k))));
    put('a1', each((k) => onUpper(k, sLo(k) + 0.02, D.strap.out)));
    put('a2', each((k) => onUpper(k, sHi(k) - D.strap.trim * H, D.strap.out)));
    put('a3', each((k) => onUpper(k, sHi(k), D.strap.out)));
    put('a4', each((k) => onUpper(k, sHi(k) + 0.012)));
    // the toe cap's back edge on the other columns and the seam: on the way from r4 to the strap's foot, stood out or
    // sunk toward the leg
    const between = (k, t, up, sink) => {
      const c = lerp(r4p(k), G.verts[R.a0[k]], t), a = axis(c[1]), d = unit([c[0] - a[0], 0, c[2] - a[2]]);
      return [c[0] - d[0] * sink, c[1] + up, c[2] - d[2] * sink];
    };
    put('r5', each((k) => cap[k] ?? between(k, D.cap.t, D.cap.lip ?? 0, -(D.cap.lip ?? 0))));
    put('r6', each((k) => { const c = lerp(G.verts[R.r5[k]], G.verts[R.a0[k]], D.cap.seam), a = axis(c[1]), d = unit([c[0] - a[0], 0, c[2] - a[2]]); const sk = D.cap.du[k] != null ? D.cap.sink : D.cap.sink * 0.3; return [c[0] - d[0] * sk, c[1], c[2] - d[2] * sk]; }));
    // the shaft's middle, the band, the cuff
    const bLo = (k) => hy('band', k), cLo = (k) => hy('cuffLo', k), cTop = (k) => hy('cuffTop', k);
    // (the band's top: its own, or under the cuff's foot where the cuff overlaps it; f how far back toward the shaft its
    // top edge goes: all the way where the shaft shows above it, none where the cuff sits on it)
    const bTop = (k) => Math.min(hy('bandTop', k), cLo(k) - 0.025);
    const bBack = (k) => Math.max(0, Math.min(1, (hy('bandTop', k) - cLo(k)) > 0 ? 0 : (cLo(k) - hy('bandTop', k)) / 0.12));
    put('g1', each((k) => onUpper(k, sHi(k) + (bLo(k) - sHi(k)) * D.mid)));
    put('b0', each((k) => onShaft(k, bLo(k))));
    put('b1', each((k) => onShaft(k, bLo(k) + D.band.trim * H, D.band.out)));
    put('b2', each((k) => onShaft(k, bTop(k), D.band.out)));
    put('b3', each((k) => onShaft(k, bTop(k) + 0.012, D.band.out * (1 - bBack(k)))));
    const cIn = (k) => D.band.out * (1 - bBack(k));
    put('c0', each((k) => onShaft(k, cLo(k), cIn(k))));
    put('c1', each((k) => onShaft(k, cLo(k) + D.cuff.trim * H, cIn(k) + D.cuff.out)));
    put('c2', each((k) => onShaft(k, cTop(k) - D.cuff.rim * H, cIn(k) + D.cuff.out + D.h.flare[k] * 0.85)));
    put('c3', each((k) => onShaft(k, cTop(k), cIn(k) + D.cuff.out + D.h.flare[k])));
    put('c4', each((k) => onShaft(k, cTop(k) - 0.02, cIn(k) + D.h.flare[k] * 0.9)));
    put('c5', each((k) => { const y = cTop(k) - D.cuff.lip * H, c = axis(y), r = Math.max(reach(k, y) + D.clear * D.cuff.gap, SU.length ? reach(k, y, SU) + D.over * 0.5 : 0); return [c[0] + ang[k][0] * r, y, c[2] + ang[k][2] * r]; }));
    G.rings[side] = R; G.foot[side] = ft;
    G.legOf[side] = { axis, ang, dirOf, onShaft, onUpper, sLo, sHi, bLo, bTop, cLo, cTop };
    // the polygons
    const band = (A, Bq, mat, tag) => { G.tag = tag; for (let k = 0; k < K; k++) { const j = (k + 1) % K; G.poly([A[k], A[j], Bq[j], Bq[k]], typeof mat === 'function' ? mat(k) : mat, 'boot'); } };
    // the sole's underside: rungs across the foot between each column and its mirror (the toe's to the heel's), so the
    // arch's lifted columns leave the heel's block and the forefoot on the ground
    G.tag = 'sole';
    const mir = (k) => ANG.indexOf(-ANG[k] === -0 ? 0 : ANG[k] === 180 ? 180 : -ANG[k]);
    const half0 = ANG.map((a, k) => k).filter((k) => ANG[k] > 0 && ANG[k] < 180);
    G.poly([R.r0[k0], R.r0[half0[0]], R.r0[mir(half0[0])]], 'dark', 'boot');
    for (let i = 0; i + 1 < half0.length; i++) { const a = half0[i], b = half0[i + 1]; G.poly([R.r0[a], R.r0[b], R.r0[mir(b)], R.r0[mir(a)]], 'dark', 'boot'); }
    const kl = half0[half0.length - 1];
    G.poly([R.r0[kl], R.r0[ANG.indexOf(180)], R.r0[mir(kl)]], 'dark', 'boot');
    band(R.r0, R.r1, 'light', 'sole edge');
    band(R.r1, R.r2, 'trim', 'welt');
    band(R.r2, R.r3, 'leather', 'wall');
    band(R.r3, R.r4, 'leather', 'over');
    band(R.r4, R.r5, 'leather', 'cap');
    band(R.r5, R.r6, 'dark', 'seam');
    band(R.r6, R.a0, 'leather', 'instep');
    band(R.a0, R.a1, 'trim', 'strap foot');
    band(R.a1, R.a2, 'light', 'strap');
    band(R.a2, R.a3, 'trim', 'strap trim');
    band(R.a3, R.a4, 'trim', 'strap top');
    band(R.a4, R.g1, 'leather', 'shaft');
    band(R.g1, R.b0, 'leather', 'shaft top');
    band(R.b0, R.b1, 'trim', 'band trim');
    band(R.b1, R.b2, 'light', 'band');
    band(R.b2, R.b3, 'leather', 'band top');
    band(R.b3, R.c0, 'leather', 'under cuff');
    band(R.c0, R.c1, 'trim', 'cuff trim');
    band(R.c1, R.c2, 'light', 'cuff');
    band(R.c2, R.c3, 'rune', 'rim');
    band(R.c3, R.c4, 'trim', 'rim top');
    band(R.c4, R.c5, 'leather', 'lip');
    G.soles.push(...R.r0);
  }
  B.polys.forEach((p, pi) => { if (hidden(p)) G.hides.push(pi); });
  orient(G, (c) => { const s = c[0] > 0 ? 'L' : 'R', R = G.rings[s], m = mul(R.r4.reduce((a, i) => add(a, G.verts[i]), [0, 0, 0]), 1 / K), a = G.legOf[s].axis(c[1]); return c[1] > m[1] + 0.3 ? [c[0] - a[0], 0, c[2] - a[2]] : [c[0] - m[0], (c[1] - m[1]) * 0.3, c[2] - m[2]]; });
  G.tris = trisOf(G);
  G.design = D; G.ground = ground; G.tall = tall;
  G.decal = new Set(); G.host = [];
  for (const side of ['L', 'R']) {
    if (P.laces) lacingOf(G, D, side);
    if (P.vee) veeOf(G, D, side);
    if (P.rivets) for (const [where, a, t] of D.rivets) rivetOf(G, D, side, where, a, t);
    if (P.badge && D.badge) badgeOf(G, D, side);
  }
  G.tris = trisOf(G);
  // where a decal still meets the boot under it, its corners there go out from the leg's axis a little at a time
  for (let it = 0; it < 30; it++) {
    const move = new Set();
    for (const [i, j] of crossPairs(G.verts, G.tris)) {
      const a = G.tris[i].v, b = G.tris[j].v, da = a.some((v) => G.decal.has(v)), db = b.some((v) => G.decal.has(v));
      if (da !== db) for (const v of da ? a : b) if (G.decal.has(v)) move.add(v);
    }
    if (!move.size) break;
    for (const v of move) { const p = G.verts[v], c = G.legOf[G.side[v]].axis(p[1]); G.verts[v] = add(p, mul(unit([p[0] - c[0], 0, p[2] - c[2]]), 0.004)); }
  }
  return G;
}

/* ---- the decals ------------------------------------------------------------------------------------------------------ */
/** Where the line p + t d meets triangle T (t, or null). */
function rayTri(p, d, T) {
  const e1 = sub(T[1], T[0]), e2 = sub(T[2], T[0]), h = cross(d, e2), a = dot(e1, h);
  if (Math.abs(a) < 1e-12) return null;
  const f = 1 / a, q = sub(p, T[0]), u = f * dot(q, h); if (u < -1e-6 || u > 1 + 1e-6) return null;
  const r = cross(q, e1), v = f * dot(d, r); if (v < -1e-6 || u + v > 1 + 1e-6) return null;
  return f * dot(e2, r);
}
/**
 * The boot's surface (its triangles tagged `tags`, of one side) out from the leg's axis at angle g (degrees round the
 * leg) and height y: the outermost hit, its outward normal and the host triangle's corners with their shares.
 */
export function surfAt(G, side, tags, g, y) {
  const L = G.legOf[side], c = L.axis(y), d = L.dirOf(g);
  let best = null;
  for (const t of G.tris) {
    const poly = G.polys[t.poly];
    if (!tags.includes(poly.tag) || G.side[t.v[0]] !== side || G.decal?.has(t.v[0])) continue;
    const T = t.v.map((i) => G.verts[i]), s = rayTri(c, d, T);
    if (s === null || s < 0 || (best && s <= best.s)) continue;
    let n = unit(cross(sub(T[1], T[0]), sub(T[2], T[0])));
    if (dot(n, d) < 0) n = mul(n, -1);
    const q = add(c, mul(d, s));
    // (its shares: barycentric in T)
    const v0 = sub(T[1], T[0]), v1 = sub(T[2], T[0]), v2 = sub(q, T[0]), d00 = dot(v0, v0), d01 = dot(v0, v1), d11 = dot(v1, v1), d20 = dot(v2, v0), d21 = dot(v2, v1), den = d00 * d11 - d01 * d01;
    const wb = (d11 * d20 - d01 * d21) / den, wc = (d00 * d21 - d01 * d20) / den;
    best = { s, q, n, host: [[t.v[0], 1 - wb - wc], [t.v[1], wb], [t.v[2], wc]] };
  }
  return best;
}
/** A decal's vertex at p, riding the host's triangle. */
function decalVert(G, side, p, host) { const i = G.vert(p, 'boot'); G.side[i] = side; G.decal.add(i); G.host[i] = host; return i; }
/** A polygon wound so its normal points along `out`. */
function facing(G, q, mat, out) {
  const n = q.length === 3 ? cross(sub(G.verts[q[1]], G.verts[q[0]]), sub(G.verts[q[2]], G.verts[q[0]])) : cross(sub(G.verts[q[1]], G.verts[q[0]]), sub(G.verts[q[3]], G.verts[q[0]]));
  G.poly(dot(n, out) >= 0 ? q : [...q].reverse(), mat, 'boot', true);
}
/**
 * A raised ridge along points on the surface (each { q, n, host }): its two edges `w` apart at `base` off the surface,
 * its crest `h` higher (per point: base may be a list), end caps closing it.
 */
function ridge(G, side, pts, w, h, base, mat, tag) {
  G.tag = tag;
  const bs = (i) => (Array.isArray(base) ? base[i] : base);
  const rows = pts.map((p, i) => {
    const along = unit(sub(pts[Math.min(i + 1, pts.length - 1)].q, pts[Math.max(i - 1, 0)].q)), across = unit(cross(p.n, along));
    const o = add(p.q, mul(p.n, bs(i)));
    return [decalVert(G, side, add(o, mul(across, -w / 2)), p.host), decalVert(G, side, add(o, mul(p.n, h)), p.host), decalVert(G, side, add(o, mul(across, w / 2)), p.host)];
  });
  for (let i = 0; i + 1 < rows.length; i++) {
    const n = unit(add(pts[i].n, pts[i + 1].n));
    for (let e = 0; e < 2; e++) {
      const q = [rows[i][e], rows[i + 1][e], rows[i + 1][e + 1], rows[i][e + 1]];
      const side0 = unit(sub(G.verts[rows[i][e === 0 ? 0 : 2]], G.verts[rows[i][1]]));
      facing(G, q, mat, add(n, mul(side0, 0.8)));
    }
  }
  const a0 = unit(sub(pts[0].q, pts[1].q)), a1 = unit(sub(pts[pts.length - 1].q, pts[pts.length - 2].q));
  facing(G, rows[0], mat, add(a0, mul(pts[0].n, 0.3)));
  facing(G, rows[rows.length - 1], mat, add(a1, mul(pts[pts.length - 1].n, 0.3)));
}
/** A low six-sided dome (a rivet, an eyelet) at a surface point. */
function dome(G, side, p, r, h, mat, tag, base = 0.004) {
  G.tag = tag;
  const n = p.n, u = unit(cross(n, Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), v = cross(n, u);
  const o = add(p.q, mul(n, base));
  const ring = Array.from({ length: 6 }, (_, k) => { const t = (k / 6) * Math.PI * 2; return decalVert(G, side, add(o, add(mul(u, r * Math.cos(t)), mul(v, r * Math.sin(t)))), p.host); });
  const apex = decalVert(G, side, add(o, mul(n, h)), p.host);
  for (let k = 0; k < 6; k++) facing(G, [ring[k], ring[(k + 1) % 6], apex], mat, n);
}
const SHAFT = ['shaft', 'shaft top', 'strap top', 'band trim', 'instep'];
/**
 * The lacing: `rows` pairs of eyelets ±`a` round the shin's front, from `lo` to `hi` (shares of the boot's height),
 * and between each pair of rows a cord from each eyelet to the other side's above it, crossing as an X (the second
 * cord raised over the first where they cross); the cords end at the eyelets' rims.
 */
function lacingOf(G, D, side) {
  const Lc = D.lace, L = G.legOf[side], y0 = G.ground + Lc.lo * G.tall, y1 = G.ground + Lc.hi * G.tall;
  const ys = Array.from({ length: Lc.rows }, (_, i) => y0 + (y1 - y0) * i / (Lc.rows - 1));
  const sg = side === 'L' ? 1 : -1;
  for (let i = 0; i + 1 < ys.length; i++) {
    for (const s of [1, -1]) {
      // (a cord from (s a, ys[i]) to (-s a, ys[i+1]), its ends in from the eyelets by their radius)
      // (sampled between the eyelets' rims: t from t0 to 1 - t0 of the way, t0 the rim's share of the cord's length)
      const e0 = surfAt(G, side, SHAFT, s * Lc.a, ys[i]), e1 = surfAt(G, side, SHAFT, -s * Lc.a, ys[i + 1]);
      const t0 = Math.min(0.3, (D.eyelet.r * 1.05 + Lc.w * 0.35) / Math.hypot(...sub(e1.q, e0.q)));
      const n = 7, pts = [];
      for (let j = 0; j < n; j++) {
        const t = t0 + (1 - 2 * t0) * j / (n - 1), g = s * Lc.a * (1 - 2 * t), y = ys[i] + (ys[i + 1] - ys[i]) * t;
        pts.push(surfAt(G, side, SHAFT, g, y));
      }
      const up = s * sg > 0; // (which cord goes over: the same on both boots, mirrored)
      const base = pts.map((_, j) => Lc.base + (up ? Lc.lift * Math.sin(Math.PI * j / (n - 1)) : 0));
      ridge(G, side, pts, Lc.w, Lc.h, base, 'rune', 'lace');
    }
  }
  for (const y of ys) for (const s of [1, -1]) dome(G, side, surfAt(G, side, SHAFT, s * Lc.a, y), D.eyelet.r, D.eyelet.h, 'trim', 'eyelet');
}
const CUFF = ['cuff', 'cuff trim'];
/** The cuff's V: two raised strokes on the cuff's face from under the rim at ±`a` to the cuff's front tip. */
function veeOf(G, D, side) {
  const V = D.vee, L = G.legOf[side], k0 = ANG.indexOf(0);
  const yTip = L.cLo(k0) + D.cuff.trim * D.H + 0.03;
  for (const s of [1, -1]) {
    const kA = ANG.indexOf(s * 36), yTop = L.cTop(kA) - D.cuff.rim * D.H - V.down * (L.cTop(kA) - L.cLo(kA)) * 0.3;
    const n = 6, pts = [];
    for (let j = 0; j < n; j++) { const t = j / (n - 1); pts.push(surfAt(G, side, CUFF, s * V.a * (1 - t) + s * 2 * t, yTop + (yTip - yTop) * t)); }
    ridge(G, side, pts, V.w, V.h, 0.008, 'rune', 'vee');
  }
}
/** A rivet on the strap, the band or the cuff at angle a (degrees, signed by the side: + outer), t of the way up it. */
function rivetOf(G, D, side, where, a, t) {
  const L = G.legOf[side], k = ANG.reduce((b, g, j) => (Math.abs(g - a) < Math.abs(ANG[b] - a) ? j : b), 0);
  const [lo, hi, tags] = where === 'strap' ? [L.sLo(k) + 0.02, L.sHi(k) - D.strap.trim * D.H, ['strap']] : where === 'band' ? [L.bLo(k) + D.band.trim * D.H, L.bTop(k), ['band']] : [L.cLo(k) + D.cuff.trim * D.H, L.cTop(k) - D.cuff.rim * D.H, ['cuff']];
  const p = surfAt(G, side, tags, a, lo + (hi - lo) * t);
  if (p) dome(G, side, p, D.rivet.r, D.rivet.h, 'trim', 'rivet');
}
/** The cuff's back badge: a small pointed shield (trim) on the cuff's back, its point down. */
function badgeOf(G, D, side) {
  const Bd = D.badge, L = G.legOf[side], kb = ANG.indexOf(180), y = L.cLo(kb) + (L.cTop(kb) - L.cLo(kb)) * Bd.t;
  const c = surfAt(G, side, CUFF, 180, y);
  if (!c) return;
  G.tag = 'badge';
  const n = c.n, u = unit(cross([0, 1, 0], n)), v = unit(cross(n, u));
  const shape = [[0, 1], [0.8, 0.55], [0.8, -0.1], [0, -1], [-0.8, -0.1], [-0.8, 0.55]];
  const at = (x, yv, lift) => add(add(c.q, mul(n, lift)), add(mul(u, x * Bd.w), mul(v, yv * Bd.h)));
  const foot = shape.map(([x, yv]) => decalVert(G, side, at(x, yv, 0.006), c.host));
  const face = shape.map(([x, yv]) => decalVert(G, side, at(x * 0.82, yv * 0.85, Bd.lift), c.host));
  for (let e = 0; e < 6; e++) { const f = (e + 1) % 6; facing(G, [foot[e], foot[f], face[f], face[e]], 'trim', add(n, mul(unit(add(sub(G.verts[foot[e]], c.q), sub(G.verts[foot[f]], c.q))), 1))); }
  facing(G, face.slice(0, 3).concat([face[3]]), 'trim', n);
  facing(G, [face[3], face[4], face[5], face[0]], 'trim', n);
}

/**
 * The boots' weights: the foot (the sole, the wall, over the foot, the toe cap, the instep) the body's at the closest
 * point of the leg's skin below the knee, the bones taken onto the calf, the foot, the toes and the ball of its own
 * side; the strap part way to the calf (`rigid`); the shaft, the band and the cuff rigid on the calf; each decal vertex
 * the weights of the boot's triangle under it, by its shares.
 */
export function leatherBootWeights(rig, G, o = {}) {
  const { B } = rig, F = rig.J.floor;
  const near = B.verts.map((p) => p[1] < F + 2.2);
  const map = (n) => { if (/^(calf|foot|toes|ball)_(l|r)$/.test(n)) return n; const s = n.match(/_(l|r)$/)?.[1] ?? 'l'; return /^ankle/.test(n) ? `foot_${s}` : `calf_${s}`; };
  const vw = transferWeights(rig, G, { map, smooth: o.smooth ?? 2, keep: (i) => near[i], only: (i) => !G.decal?.has(i) });
  const at = new Map(rig.bones.map((b, i) => [b.name, i]));
  const rigid = o.rigid ?? { r6: 0.1, a0: 0.4, a1: 0.4, a2: 0.5, a3: 0.5, a4: 0.6, g1: 1, b0: 1, b1: 1, b2: 1, b3: 1, c0: 1, c1: 1, c2: 1, c3: 1, c4: 1, c5: 1 };
  for (const side of ['L', 'R']) {
    const R = G.rings[side], calf = at.get(`calf_${side === 'L' ? 'l' : 'r'}`);
    for (const [key, f] of Object.entries(rigid)) for (const i of R[key] ?? []) {
      const acc = new Map(vw[i].map(([b, w]) => [b, w * (1 - f)]));
      acc.set(calf, (acc.get(calf) ?? 0) + f);
      vw[i] = [...acc].filter(([, w]) => w > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
      const t = vw[i].reduce((a, [, w]) => a + w, 0); vw[i] = vw[i].map(([b, w]) => [b, w / t]);
    }
  }
  // the toe cap a rigid piece: its back edge (r5) on its dome's bones (r4's), the seam behind it (r6) half on the foot
  for (const side of ['L', 'R']) {
    const R = G.rings[side], foot = at.get(`foot_${side === 'L' ? 'l' : 'r'}`);
    G.design.cap.du.forEach((du, k) => {
      if (du == null) return;
      vw[R.r5[k]] = vw[R.r4[k]].map(([b, w]) => [b, w]);
      const acc = new Map(vw[R.r4[k]].map(([b, w]) => [b, w * 0.5]));
      acc.set(foot, (acc.get(foot) ?? 0) + 0.5);
      vw[R.r6[k]] = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4);
    });
  }
  // the decals ride the boot under them: their host triangle's corners' weights, by their shares
  G.host.forEach((h, i) => {
    if (!h) return;
    const acc = new Map();
    for (const [v, s] of h) for (const [b, w] of vw[v]) acc.set(b, (acc.get(b) ?? 0) + w * s);
    const l = [...acc].filter(([, w]) => w > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4), t = l.reduce((a, [, w]) => a + w, 0);
    vw[i] = l.map(([b, w]) => [b, w / t]);
  });
  return vw;
}

/** A garment asset (lowgarment.mjs garmentAsset, as the game loads it) as a surface to build over: its rest vertices and triangles. */
export function underOf(A) {
  const verts = []; for (let i = 0; i < A.verts.length; i += 3) verts.push([A.verts[i], A.verts[i + 1], A.verts[i + 2]]);
  const tris = []; for (let t = 0; t < A.tris.length; t += 4) tris.push({ v: [A.tris[t], A.tris[t + 1], A.tris[t + 2]] });
  return { verts, tris };
}

/* ---- the game's copy ------------------------------------------------------------------------------------------------ */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync, existsSync, readFileSync } = await import('node:fs');
  const { buildRig } = await import('../lowrig.mjs');
  const { garmentAsset } = await import('../lowgarment.mjs');
  for (const who of ['male', 'female']) {
    // (built over the leather leggings, the game's copy beside the body, or --under <dir>/lowleatherlegs-<who>.json)
    const i = process.argv.indexOf('--under'), legs = i > 0 ? `${process.argv[i + 1]}/lowleatherlegs-${who}.json` : new URL(`../../../src/sculpt/assets/lowleatherlegs-${who}.json`, import.meta.url).pathname;
    const under = existsSync(legs) ? [underOf(JSON.parse(readFileSync(legs, 'utf8')))] : [];
    const rig = buildRig(who), G = buildLeatherBoots(rig, DESIGN[who], { under });
    G.vw = leatherBootWeights(rig, G);
    console.log(who, under.length ? `over the leggings ${legs}` : 'over the bare legs');
    const file = new URL(`../../../src/sculpt/assets/lowleatherboots-${who}.json`, import.meta.url);
    const A = { built: 'node tools/sculpt/garments/leatherboots.mjs (tools/sculpt/lowgarment.mjs garmentAsset)', ...garmentAsset(rig, G, MATS, LOOKS), hides: G.hides, soles: G.soles };
    writeFileSync(file, JSON.stringify(A));
    console.log(who, `${G.verts.length} vertices, ${G.tris.length} triangles, ${A.base} + ${A.bones.length} bones, hides ${G.hides.length} body polygons: wrote`, file.pathname);
  }
}
