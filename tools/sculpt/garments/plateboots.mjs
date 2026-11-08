// The plate boots of the second outfit, the sacred plate set (its sheet: tools/sculpt/ref/plate-boots.png, worn in
// tools/sculpt/ref/plate-lineup.png): a gold sole with a low blocky heel, a cream sabaton with a closed, rounded toe
// cap, a raised ankle band (a wrap, chevroned front and back, gold-edged), the greave up the shin with a raised gold
// centre rib, and the cuff under the knee: a second plate over the greave's top, gold along its chevroned foot, flared
// to two wings at the sides, rising in front to the knee crest (a diamond, gold-framed, its inset glowing). His broader
// and heavier, hers fitted to the leg. Fitted to each low-poly body from one design (DESIGN, per body), skinned to its
// rig's leg and foot bones (no bones of its own): the foot on the foot's bones, everything from the ankle band up rigid
// on the shin (calf) bone.
//
//   buildPlateBoots(rig) → { verts, polys: [{ v, mat, part, tag }], tris, side, rings, design, hides, soles }
//   plateBootWeights(rig, G) → per vertex [[bone, weight], ...] (the body's bones only)
//
//   node tools/sculpt/garments/plateboots.mjs
//     writes the game's copy beside each body: src/sculpt/assets/lowplateboots-male.json and lowplateboots-female.json
//     (lowgarment.mjs garmentAsset, plus `hides`, the body's polygons the boots cover, and `soles`, the boots' sole
//     vertices the body stands on; loaded by src/sculpt/lowpoly.ts; the material `glow` drawn emissive)
//
// The shape, per foot, in K = 10 columns round it, each a station on the foot's outline (f from the heel's back 0 to the
// toe's front 1, v off the foot's middle line, + out) and an angle round the leg (0 the shin's front, + out), each a
// polyline up from the ground, the rings joined round:
//   the sole: r0 its underside (the arch's columns lifted: the heel's block), r1 its top edge, r2 the welt (in by `lip`);
//   the foot: r3 the wall's top, r4 over the foot (the toe cap's dome, the heel), r5 the toe cap's back edge (raised
//   off the line from r4 to the band), r6 the seam behind it (sunk), then the instep up to the band;
//   the ankle band: a0 on the shaft, a2 out by its thickness at the gold strip's top (a gold bevel), a3 its top, a4
//   back on the shaft;
//   the greave: g1 at mid-shin, then c0 under the cuff's foot;
//   the cuff: c2 out by its thickness at the gold strip's top (a gold bevel), c3 its top (flared), c4 the rim's inside, c5 the lip
//   down inside it (the one open edge, round the leg).
// The shaft's rings are round the leg's axis, each column out from the leg's reach that way (the body's skin, the
// covered foot left out) by the clearance `clear` (room for the leggings), the reach the most over a window of heights
// so a plate between two rings clears the calf. The band's and the cuff's heights run round the leg as chevrons
// (lowest at the front and the back); the cuff's top per column (the crest's peak in front, the wings at the sides).
// Decals: the centre rib (a ridge up the greave's front column, from the band to the cuff) and the crest (a diamond on
// the cuff's front: a gold frame stood off it, its inset glowing).
//
// Heights: the foot's in the body's units over its floor (rig.J.floor); the band's in head heights H over the ground;
// the greave's and the cuff's as a share of the way from the ankle's ring (an) to the knee's joint (rig.J.knee), so the
// cuff ends under the knee on both bodies. The body stands on the boots' soles: the ground is the floor less the sole
// and `gap`.
import { meshOf, orient, trisOf, transferWeights, samplesOf, sub, add, mul, dot, cross, unit, lerp } from '../lowgarment.mjs';
import { footOf } from './boots.mjs';

/**
 * The materials, shared by the plate set's pieces (the same names and colours: the game shares the slots): the plate's
 * cream and its darker shade, the gold trim, the glowing inset (emissive), the dark under-layer.
 */
export const MATS = {
  plate: [0.82, 0.65, 0.54],
  shade: [0.68, 0.51, 0.41],
  gold: [0.96, 0.74, 0.4],
  glow: [1, 0.906, 0.651],
  under: [0.29, 0.22, 0.2],
};
/** The materials drawn emissive (always lit, glowing in the bloom). */
export const GLOW = ['glow'];

const ANG = [0, 36, 72, 108, 144, 180, -144, -108, -72, -36];
/**
 * The design per body. Lengths in the body's units; H the head's height.
 *   sole, gap, lip, margin: the sole's thickness, the gap under the body's sole, the welt, the outline past the body's
 *     foot at the toe and the heel (the sabaton runs well past the body's toes, as the sheet's side view: heel to toe
 *     about 0.48 of the sole to the cuff's top); arch: the sole's underside lifted under the arch's columns (the heel's
 *     block); spring: the toe's (front column, and the two beside it) lifted off the ground;
 *   cols: per column [f, v] on the foot; wall, top: r3's and r4's heights over the floor; lean, shrink: r3 and r4 in
 *     from the outline; mix: r4 the share of the way from the outline to the shaft;
 *   clear: the shaft off the leg; win: the window of heights its reach is taken over; fill: per column further out;
 *   band: { y, rise, w, gold } (head heights over the ground: the front's foot, the sides' rise, its height, the gold
 *     strip's), out (its thickness);
 *   dome: per column r4 moved back along the foot from the outline (the toe cap's dome set back from its tip);
 *   cap: the toe cap's back edge (r5): on its columns du back along the foot, h over the floor, `in` from the outline;
 *     the others t of the way from r4 to the band's foot; the seam behind it (r6) `seam` of the way on from r5 to the
 *     band's foot, sunk toward the leg by `sink`;
 *   mid: the greave's middle ring (share of ankle to knee);
 *   cuff: lo (its foot at the front and the back), rise (at the sides), gold (head heights), top (per column, share of
 *     ankle to knee), out (its thickness), flare (per column, out at the top), rim (the rim's inside off the leg), lip
 *     (the lip down inside, head heights);
 *   rib: { w, h } the centre rib's width and height; crest: { t, w, h, inset, lift } the diamond on the cuff's front
 *     (its middle's share of the way up the cuff's front, its half width, its half height, the inset's share, the stand-off).
 */
export const DESIGN = {
  male: {
    H: 2.06, sole: 0.24, gap: 0.012, lip: 0.05, margin: { toe: 0.48, heel: 0.04 }, arch: 0.1, spring: [0.06, 0.03],
    cols: [[1, 0], [0.9, 0.4], [0.62, 0.56], [0.3, 0.44], [0.06, 0.36], [0, 0], [0.06, -0.36], [0.3, -0.4], [0.62, -0.54], [0.9, -0.4]],
    wall: [0.22, 0.22, 0.22, 0.22, 0.22, 0.22, 0.22, 0.22, 0.22, 0.22],
    lean: [0.03, 0.03, 0.03, 0.02, 0.02, 0.02, 0.02, 0.02, 0.03, 0.03],
    dome: [0.14, 0.1, 0.03, 0, 0, 0, 0, 0, 0.03, 0.1],
    top: [0.38, 0.37, 0.42, 0.6, 0.62, 0.62, 0.62, 0.6, 0.42, 0.37],
    shrink: [0.08, 0.07, 0.05, 0.02, 0.02, 0.02, 0.02, 0.02, 0.05, 0.07],
    mix: [0, 0.05, 0.3, 0.8, 1, 1, 1, 0.8, 0.3, 0.05],
    clear: 0.12, win: 0.3, fill: [0.02, 0, 0, 0, 0.02, 0.03, 0.02, 0, 0, 0],
    cap: { du: [0.6, 0.5, 0.22, null, null, null, null, null, 0.22, 0.5], h: [0.42, 0.41, 0.46, 0, 0, 0, 0, 0, 0.46, 0.41], in: [0.1, 0.08, 0.06, 0, 0, 0, 0, 0, 0.06, 0.08], t: 0.35, seam: 0.12, sink: 0.05 },
    band: { y: 0.56, rise: 0.12, w: 0.22, gold: 0.09, out: 0.11 },
    mid: 0.4,
    cuff: { lo: 0.46, rise: 0.22, gold: 0.09, out: 0.13, top: [0.96, 0.86, 0.84, 0.8, 0.8, 0.8, 0.8, 0.8, 0.84, 0.86], flare: [0.2, 0.24, 0.42, 0.24, 0.16, 0.14, 0.16, 0.24, 0.42, 0.24], rim: 0.03, lip: 0.08 },
    rib: { w: 0.18, h: 0.06 },
    crest: { t: 0.52, w: 0.36, h: 0.56, inset: 0.68, lift: 0.045 },
  },
  female: {
    H: 2.07, sole: 0.2, gap: 0.012, lip: 0.04, margin: { toe: 0.3, heel: 0.02 }, arch: 0.09, spring: [0.05, 0.025],
    cols: [[1, 0], [0.9, 0.34], [0.62, 0.47], [0.3, 0.36], [0.06, 0.32], [0, 0], [0.06, -0.32], [0.3, -0.33], [0.62, -0.45], [0.9, -0.34]],
    wall: [0.18, 0.18, 0.18, 0.18, 0.18, 0.18, 0.18, 0.18, 0.18, 0.18],
    lean: [0.02, 0.02, 0.03, 0.02, 0.02, 0.02, 0.02, 0.02, 0.03, 0.02],
    dome: [0.13, 0.09, 0.03, 0, 0, 0, 0, 0, 0.03, 0.09],
    top: [0.32, 0.31, 0.36, 0.58, 0.6, 0.6, 0.6, 0.58, 0.36, 0.31],
    shrink: [0.07, 0.06, 0.04, 0.02, 0.02, 0.02, 0.02, 0.02, 0.04, 0.06],
    mix: [0, 0.05, 0.3, 0.8, 1, 1, 1, 0.8, 0.3, 0.05],
    clear: 0.1, win: 0.3, fill: [0.01, 0, 0, 0, 0.01, 0.02, 0.01, 0, 0, 0],
    cap: { du: [0.56, 0.46, 0.2, null, null, null, null, null, 0.2, 0.46], h: [0.36, 0.35, 0.4, 0, 0, 0, 0, 0, 0.4, 0.35], in: [0.09, 0.07, 0.05, 0, 0, 0, 0, 0, 0.05, 0.07], t: 0.35, seam: 0.12, sink: 0.045 },
    band: { y: 0.58, rise: 0.1, w: 0.19, gold: 0.08, out: 0.09 },
    mid: 0.4,
    cuff: { lo: 0.42, rise: 0.2, gold: 0.08, out: 0.11, top: [0.8, 0.72, 0.7, 0.68, 0.67, 0.67, 0.67, 0.68, 0.7, 0.72], flare: [0.16, 0.2, 0.34, 0.2, 0.12, 0.11, 0.12, 0.2, 0.34, 0.2], rim: 0.03, lip: 0.07 },
    rib: { w: 0.15, h: 0.05 },
    crest: { t: 0.52, w: 0.3, h: 0.48, inset: 0.68, lift: 0.038 },
  },
};

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

/** The body's polygons the boots cover whole: the foot's block, the ankle's band and the calf up to its widest ring (ca). */
const COVERED = /^(fc|ft|so|fb|an|cb|ca)\d\.[LR]$/;

export function buildPlateBoots(rig, design = DESIGN[rig.who]) {
  const { B } = rig, D = design, F = rig.J.floor, H = D.H, K = ANG.length;
  const ground = F - D.gap - D.sole, top = F - D.gap;
  const G = meshOf();
  G.side = []; G.rings = {}; G.hides = []; G.soles = []; G.foot = {};
  const hidden = (p) => p.v.every((i) => COVERED.test(B.names[i]));
  for (const side of ['L', 'R']) {
    const ft = footOf(B, side), axis = legAxis(B, side);
    const yAn = B.verts[B.index.get(`an0.${side}`)][1], yKnee = rig.J.knee[1];
    const leg = (u) => yAn + u * (yKnee - yAn);
    // the leg's skin on this side, the covered foot left out
    const footBlock = (p) => p.v.every((i) => /^(fc|ft|so|fb)\d\.[LR]$/.test(B.names[i]));
    const legPolys = B.polys.filter((p) => !footBlock(p) && p.v.every((i) => B.verts[i][1] < yKnee + 0.6 && Math.sign(B.verts[i][0]) === ft.sg));
    const S = samplesOf({ tris: legPolys.flatMap((p) => { const o = []; for (let k = 1; k + 1 < p.v.length; k++) o.push({ v: [p.v[0], p.v[k], p.v[k + 1]] }); return o; }) }, B.verts, 0.04)
      .filter((p) => p[1] < yKnee + 0.6 && Math.sign(p[0]) === ft.sg);
    // the outline: each column's station along the foot, v off the foot's middle line
    const uB = ft.u0 - D.margin.heel, uT = ft.L + D.margin.toe;
    const mH = ft.span(ft.u0).reduce((a, b) => (a + b) / 2), mT = ft.span(ft.L).reduce((a, b) => (a + b) / 2);
    const outline = D.cols.map(([f, v]) => { const u = uB + f * (uT - uB), t = (u - ft.u0) / (ft.L - ft.u0); return [u, mH + (mT - mH) * t + v]; });
    const cU = (uB + uT) * 0.45, cV = outline.reduce((s0, p) => s0 + p[1], 0) / K, centre = ft.at(cU, cV, 0);
    const onOutline = (k, y, inset = 0) => { const p = ft.at(outline[k][0], outline[k][1], y), d = unit([p[0] - centre[0], 0, p[2] - centre[2]]); return [p[0] - d[0] * inset, y, p[2] - d[2] * inset]; };
    // the shaft: each column at its angle round the leg, out from the leg's reach that way over the window of heights
    const ang = ANG.map((g) => { const t = g * Math.PI / 180; return unit(add(mul(ft.a, Math.cos(t)), mul(ft.b, Math.sin(t)))); });
    const half = 22, ch = Math.cos(half * Math.PI / 180);
    const reach = (k, y) => {
      let r = 0;
      for (const p of S) {
        if (Math.abs(p[1] - y) > D.win) continue;
        const c = axis(p[1]), w = [p[0] - c[0], p[2] - c[2]], l = Math.hypot(w[0], w[1]);
        if (l < 1e-9) continue;
        const cs = (w[0] * ang[k][0] + w[1] * ang[k][2]) / l;
        if (cs < ch) continue;
        r = Math.max(r, l * cs / ch);
      }
      return r;
    };
    const onShaft = (k, y, extra = 0) => { const c = axis(y), r = reach(k, y) + D.clear + (D.fill?.[k] ?? 0) + extra; return [c[0] + ang[k][0] * r, y, c[2] + ang[k][2] * r]; };
    // (a chevron's rise round the leg: nought at the front and the back, one from 45 degrees off them on, straight between)
    const chev = (k) => Math.min(1, Math.min(Math.abs(ANG[k]), 180 - Math.abs(ANG[k])) / 45);
    const R = {};
    const put = (key, pts) => { R[key] = pts.map((p) => { const i = G.vert(p, 'boot'); G.side[i] = side; return i; }); };
    const each = (f) => ANG.map((_, k) => f(k));
    // the sole and the foot
    // (the arch's columns lifted: the heel's block; the toe's sprung up a little)
    const lift0 = (k) => (Math.abs(ANG[k]) === 108 ? D.arch : ANG[k] === 0 ? D.spring?.[0] ?? 0 : Math.abs(ANG[k]) === 36 ? D.spring?.[1] ?? 0 : 0);
    put('r0', each((k) => onOutline(k, ground + lift0(k), -D.lip)));
    put('r1', each((k) => onOutline(k, top, -D.lip)));
    put('r2', each((k) => onOutline(k, top)));
    put('r3', each((k) => onOutline(k, F + D.wall[k], D.lean[k])));
    // (a column's outline point moved back along the foot by du, at height y, `inset` in toward the foot's middle)
    const onFoot = (k, du, y, inset) => { const q = onOutline(k, y, inset); return [q[0] - ft.a[0] * du, y, q[2] - ft.a[2] * du]; };
    put('r4', each((k) => lerp(onFoot(k, D.dome[k], F + D.top[k], D.shrink[k]), onShaft(k, F + D.top[k]), D.mix[k])));
    // the ankle band
    const bandLo = (k) => ground + (D.band.y + D.band.rise * chev(k)) * H, bandHi = (k) => bandLo(k) + D.band.w * H;
    put('a0', each((k) => onShaft(k, bandLo(k))));
    put('a2', each((k) => onShaft(k, bandLo(k) + D.band.gold * H, D.band.out)));
    put('a3', each((k) => onShaft(k, bandHi(k), D.band.out)));
    put('a4', each((k) => onShaft(k, bandHi(k) + 0.01)));
    // the toe cap's back edge and the seam: on the way from r4 to the band's foot, raised (`up`) or sunk toward the leg
    const between = (k, t, up, sink) => {
      const c = lerp(G.verts[R.r4[k]], G.verts[R.a0[k]], t), a = axis(c[1]), d = unit([c[0] - a[0], 0, c[2] - a[2]]);
      return [c[0] - d[0] * sink, c[1] + up, c[2] - d[2] * sink];
    };
    // (the toe cap's columns: its edge on the foot, `du` back from the outline at height h; the rest on the way up)
    put('r5', each((k) => (D.cap.du[k] != null ? onFoot(k, D.cap.du[k], F + D.cap.h[k], D.cap.in[k]) : between(k, D.cap.t, 0, 0))));
    put('r6', each((k) => { const c = lerp(G.verts[R.r5[k]], G.verts[R.a0[k]], D.cap.seam), a = axis(c[1]), d = unit([c[0] - a[0], 0, c[2] - a[2]]); return [c[0] - d[0] * D.cap.sink, c[1], c[2] - d[2] * D.cap.sink]; }));
    // the greave and the cuff
    const cuffLo = (k) => leg(D.cuff.lo) + D.cuff.rise * chev(k) * H, cuffTop = (k) => leg(D.cuff.top[k]);
    put('g1', each((k) => onShaft(k, lerp([0, bandHi(k), 0], [0, cuffLo(k), 0], D.mid)[1])));
    put('c0', each((k) => onShaft(k, cuffLo(k))));
    put('c2', each((k) => onShaft(k, cuffLo(k) + D.cuff.gold * H, D.cuff.out)));
    put('c3', each((k) => onShaft(k, cuffTop(k), D.cuff.out + D.cuff.flare[k])));
    put('c4', each((k) => onShaft(k, cuffTop(k), -D.clear + D.cuff.rim)));
    put('c5', each((k) => onShaft(k, cuffTop(k) - D.cuff.lip * H, -D.clear + D.cuff.rim)));
    G.rings[side] = R; G.foot[side] = ft;
    G.legOf = G.legOf ?? {}; G.legOf[side] = { axis, ang, onShaft, cuffLo, cuffTop, bandHi };
    // the polygons
    const band = (A, Bq, mat, tag) => { G.tag = tag; for (let k = 0; k < K; k++) { const j = (k + 1) % K; G.poly([A[k], A[j], Bq[j], Bq[k]], typeof mat === 'function' ? mat(k) : mat, 'boot'); } };
    const mid = mul(R.r0.reduce((a, i) => add(a, G.verts[i]), [0, 0, 0]), 1 / K), cI = G.vert(mid, 'boot');
    G.side[cI] = side; R.c = cI;
    G.tag = 'sole';
    for (let k = 0; k < K; k++) G.poly([R.r0[(k + 1) % K], R.r0[k], cI], 'under', 'boot');
    band(R.r0, R.r1, 'gold', 'sole edge');
    band(R.r1, R.r2, 'gold', 'welt');
    band(R.r2, R.r3, 'plate', 'wall');
    band(R.r3, R.r4, 'plate', 'over');
    band(R.r4, R.r5, 'plate', 'cap');
    band(R.r5, R.r6, 'shade', 'seam');
    band(R.r6, R.a0, 'plate', 'instep');
    band(R.a0, R.a2, 'gold', 'band gold');
    band(R.a2, R.a3, 'plate', 'band');
    band(R.a3, R.a4, 'gold', 'band top');
    band(R.a4, R.g1, 'plate', 'greave');
    band(R.g1, R.c0, 'plate', 'greave top');
    band(R.c0, R.c2, 'gold', 'cuff gold');
    band(R.c2, R.c3, 'plate', 'cuff');
    band(R.c3, R.c4, 'plate', 'rim');
    band(R.c4, R.c5, 'under', 'lip');
    G.soles.push(...R.r0, cI);
  }
  B.polys.forEach((p, pi) => { if (hidden(p)) G.hides.push(pi); });
  orient(G, (c) => { const s = c[0] > 0 ? 'L' : 'R', R = G.rings[s], m = mul(R.r4.reduce((a, i) => add(a, G.verts[i]), [0, 0, 0]), 1 / K), a = G.legOf[s].axis(c[1]); return c[1] > m[1] + 0.3 ? [c[0] - a[0], 0, c[2] - a[2]] : [c[0] - m[0], (c[1] - m[1]) * 0.3, c[2] - m[2]]; });
  G.decal = new Set();
  if (D.rib) for (const side of ['L', 'R']) ribOf(G, D, side);
  if (D.crest) for (const side of ['L', 'R']) crestOf(G, D, side);
  G.tris = trisOf(G);
  G.design = D; G.ground = ground;
  return G;
}

/** Where the line p + t d meets triangle T (t, or null). */
function rayTri(p, d, T) {
  const e1 = sub(T[1], T[0]), e2 = sub(T[2], T[0]), h = cross(d, e2), a = dot(e1, h);
  if (Math.abs(a) < 1e-12) return null;
  const f = 1 / a, q = sub(p, T[0]), u = f * dot(q, h); if (u < -1e-6 || u > 1 + 1e-6) return null;
  const r = cross(q, e1), v = f * dot(d, r); if (v < -1e-6 || u + v > 1 + 1e-6) return null;
  return f * dot(e2, r);
}
/** A decal's vertex: on side `side`, riding the calf. */
function decalVert(G, side, p) { const i = G.vert(p, 'boot'); G.side[i] = side; G.decal.add(i); return i; }
/** A quad wound so its normal points along `out`. */
function facing(G, q, mat, out) {
  const n = cross(sub(G.verts[q[1]], G.verts[q[0]]), sub(G.verts[q[3]], G.verts[q[0]]));
  G.poly(dot(n, out) >= 0 ? q : [...q].reverse(), mat, 'boot', true);
}

/** The centre rib: a gold ridge up the greave's front column from the band's top (a4) to under the cuff's foot (c0). */
function ribOf(G, D, side) {
  const R = G.rings[side], K = ANG.length, w = D.rib.w / 2, out = G.legOf[side].ang[0];
  G.tag = 'rib';
  const rows = ['a4', 'g1', 'c0'].map((r) => {
    const P = G.verts[R[r][0]], Lq = G.verts[R[r][K - 1]], Rq = G.verts[R[r][1]];
    const l = add(lerp(P, Lq, w / Math.hypot(...sub(Lq, P))), mul(out, 0.008)), rr = add(lerp(P, Rq, w / Math.hypot(...sub(Rq, P))), mul(out, 0.008));
    return [decalVert(G, side, l), decalVert(G, side, add(P, mul(out, D.rib.h))), decalVert(G, side, rr)];
  });
  for (let i = 0; i + 1 < rows.length; i++) for (let e = 0; e < 2; e++) facing(G, [rows[i][e], rows[i + 1][e], rows[i + 1][e + 1], rows[i][e + 1]], 'gold', out);
}

/**
 * The knee crest: a diamond on the cuff's front, its middle `t` of the way up the front column from the gold strip's
 * top (c2) to the cuff's top (c3): its foot ring on the cuff, its frame stood off by `lift` (gold), the inset (the
 * frame's `inset` share) sunk in it to 0.6 of that, glowing.
 */
function crestOf(G, D, side) {
  const R = G.rings[side], K = ANG.length, C = D.crest, out = G.legOf[side].ang[0];
  const P = (r, k) => G.verts[R[r][k]];
  // a point on the cuff's front: s across (- inner, + outer, a share of the way to the next column), t up it
  const at = (s, t) => {
    const k = s >= 0 ? 1 : K - 1, a = lerp(P('c2', 0), P('c2', k), Math.abs(s)), b = lerp(P('c3', 0), P('c3', k), Math.abs(s));
    return lerp(a, b, t);
  };
  const h0 = Math.hypot(...sub(P('c3', 0), P('c2', 0))), wk = Math.hypot(...sub(P('c2', 1), P('c2', 0)));
  const ts = C.h / h0, ss = C.w / wk;
  // (each point taken out along `out` to the cuff's outermost triangle there)
  const cuffTris = trisOf(G).filter((t) => G.polys[t.poly].tag === 'cuff' && G.side[t.v[0]] === side).map((t) => t.v.map((i) => G.verts[i]));
  const onCuff = (p) => { let best = -1; for (const T of cuffTris) { const t = rayTri(p, out, T); if (t !== null && t > best) best = t; } return add(p, mul(out, Math.max(best, 0))); };
  // the frame and the inset flat, in the plane through the front column's ridge (the cuff's most forward line): its
  // middle there, up along the ridge, across square to it
  const mid = onCuff(at(0, C.t)), up = unit(sub(P('c3', 0), P('c2', 0))), nrm = unit(cross(up, cross(out, up))), across = unit(cross(up, nrm));
  const sx = dot(across, sub(P('c2', 1), P('c2', 0))) >= 0 ? 1 : -1;
  const flat = (k, lift) => [[0, C.h * k], [C.w * k, 0], [0, -C.h * k], [-C.w * k, 0]].map(([x, y]) => decalVert(G, side, add(add(mid, add(mul(across, x * sx), mul(up, y))), mul(nrm, lift))));
  const onSurface = (k) => [[0, C.t + ts * k], [ss * k, C.t], [0, C.t - ts * k], [-ss * k, C.t]].map(([x, t]) => decalVert(G, side, add(onCuff(at(x, t)), mul(out, 0.004))));
  G.tag = 'crest';
  const foot = onSurface(1.1), frame = flat(1, C.lift), inset = flat(C.inset, C.lift * 0.6);
  for (let e = 0; e < 4; e++) {
    const f = (e + 1) % 4;
    facing(G, [foot[e], foot[f], frame[f], frame[e]], 'gold', out);
    facing(G, [frame[e], frame[f], inset[f], inset[e]], 'gold', out);
  }
  facing(G, inset, 'glow', out);
}

/**
 * The boots' weights: the foot (the sole, the wall, over the foot) the body's at the closest point of the leg's skin
 * below the knee, the bones taken onto the calf, the foot, the toes and the ball of its own side; the cap's edge and the
 * seam (r5, r6) a little toward the calf; the ankle band up (a0 on) and the decals rigid on the calf.
 */
export function plateBootWeights(rig, G, o = {}) {
  const { B } = rig, F = rig.J.floor;
  const near = B.verts.map((p) => p[1] < F + 2.2);
  const map = (n) => { if (/^(calf|foot|toes|ball)_(l|r)$/.test(n)) return n; const s = n.match(/_(l|r)$/)?.[1] ?? 'l'; return /^ankle/.test(n) ? `foot_${s}` : `calf_${s}`; };
  const vw = transferWeights(rig, G, { map, smooth: o.smooth ?? 2, keep: (i) => near[i], only: (i) => !G.decal?.has(i) });
  const at = new Map(rig.bones.map((b, i) => [b.name, i]));
  const rigid = o.rigid ?? { r5: 0.15, r6: 0.3, a0: 1, a2: 1, a3: 1, a4: 1, g1: 1, c0: 1, c2: 1, c3: 1, c4: 1, c5: 1 };
  for (const side of ['L', 'R']) {
    const R = G.rings[side], calf = at.get(`calf_${side === 'L' ? 'l' : 'r'}`);
    for (const [key, f] of Object.entries(rigid)) for (const i of R[key] ?? []) {
      const acc = new Map(vw[i].map(([b, w]) => [b, w * (1 - f)]));
      acc.set(calf, (acc.get(calf) ?? 0) + f);
      vw[i] = [...acc].filter(([, w]) => w > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
      const t = vw[i].reduce((a, [, w]) => a + w, 0); vw[i] = vw[i].map(([b, w]) => [b, w / t]);
    }
  }
  for (const i of G.decal ?? []) vw[i] = [[at.get(`calf_${G.side[i] === 'L' ? 'l' : 'r'}`), 1]];
  return vw;
}

/* ---- the game's copy ------------------------------------------------------------------------------------------------ */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync } = await import('node:fs');
  const { buildRig } = await import('../lowrig.mjs');
  const { garmentAsset } = await import('../lowgarment.mjs');
  for (const who of ['male', 'female']) {
    const rig = buildRig(who), G = buildPlateBoots(rig);
    G.vw = plateBootWeights(rig, G);
    const file = new URL(`../../../src/sculpt/assets/lowplateboots-${who}.json`, import.meta.url);
    const A = { built: 'node tools/sculpt/garments/plateboots.mjs (tools/sculpt/lowgarment.mjs garmentAsset)', ...garmentAsset(rig, G, MATS), glow: GLOW, hides: G.hides, soles: G.soles };
    writeFileSync(file, JSON.stringify(A));
    console.log(who, `${G.verts.length} vertices, ${G.tris.length} triangles, ${A.base} + ${A.bones.length} bones, hides ${G.hides.length} body polygons: wrote`, file.pathname);
  }
}
