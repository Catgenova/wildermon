// The adamantine set: the dwarven hold-guard, the gate warden of a mountain fortress, built with the plate kit
// (tools/sculpt/garments/platekit.mjs) and the set's own builders (tools/sculpt/garments/kit/adamantine.mjs): plate cut
// in flat facets as a gem is, a near-black violet metal whose facets catch the light hard, gilt in its knotwork and
// runes.
//
//   helm    the hold-helm: a broad octagonal skull cut in two terraces to a gilt finial, gilt ribs on its four corners;
//           a massive gilt brow bar over the eyes with a rune channel along it, a broad nasal, deep faceted cheek plates
//           edged in gilt, and a flared neck guard.
//   chest   heavy mail under a cuirass cut as a gem (a keel, a ridge across the breast), gilt chevron knotwork, the
//           hexagonal rune boss on the breast, a broad belt with an octagonal gilt plaque; pauldrons stepped as mountain
//           terraces under a faceted cap; lamed rerebraces, faceted couters, octagonal vambraces, flared cuffs, knuckle
//           plates studded in gilt.
//   mantle  the gate-mantle: a faceted collar in two tiers, a yoke before and behind laid with hexagonal plates, a gilt
//           chain of office down to the gate clasp; between the shoulder blades the hold's runestone in a gilt frame,
//           crowned with five gilt mountain peaks standing above the shoulders, hung on gilt chains.
//   legs    mail chausses (rows of rings shown round the thighs), faceted tassets and a culet, ridged cuisses, knee cops
//           as faceted pyramids with a gilt rune hexagon and a hexagonal wing, octagonal greaves flared over the boots.
//   boots   squat sabatons cut as hexagonal prisms: two lames over the instep, a square box toe with a gilt band round
//           its back and a gilt rune plate on its top, a faceted heel cup, over a thick-soled shoe.
//
// Enchanted, five things light and nothing else: the brow channel, the breast boss's rune, the runestone's three runes,
// the knee runes and the toe plates' runes.
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, smooth, merge, part, shell, on } from './metalkit.mjs';
import {
  skinSamples, shareW, boneW, mixOf, mixW, nearSkinW, skinW, wrapAngle, limbWrap, plateOn, patch, solid, tube, band, rowPath, colPath, pathOn,
  stud, studsAlong, gridOf, sweep, along, smoothWeights, coverHides, torsoWrap,
} from './platekit.mjs';
import {
  PI, TAU, headW, dirOf, hull, reachOf, facetGrid, fitScales, fan, gem, zigzag, frameAt, inFrame, plaqueGrid, torsoMarks, torsoField, TORSO_BONES, runeOn,
} from './kit/adamantine.mjs';

export const ADAMANTINE_MATS = {
  // (the adamantine: a near-black violet-blue, its facets a shade apart so the cut reads, its polished edges near white
  // with a cold violet cast; its shadows and insides blacker)
  ad: { c: '#2f2c48', kind: 3 },
  adF: { c: '#3b3860', kind: 3 },
  adM: { c: '#232037', kind: 3 },
  adP: { c: '#8e8ac2', kind: 3 },
  adL: { c: '#b3aee0', kind: 3 },
  adS: { c: '#16141f', kind: 3 },
  adD: { c: '#0d0c13', kind: 3 },
  // (the gilt: a deep warm gold, its raised edges bright, its sunk work brown)
  gilt: { c: '#b8862c', kind: 3 },
  giltL: { c: '#f3d27a', kind: 3 },
  giltD: { c: '#6b4614', kind: 3 },
  // (the runes: cut channels, dark gold plain, lit in the enchantment's colour)
  rune: { c: '#5a3c12', kind: 3, lit: { c: '#ffe2a0', kind: 1 } },
  // (the hauberk under the plate: heavy mail, a cold grey; the belt and gloves dark leather)
  mail: { c: '#4a4e5f', kind: 3 },
  mailD: { c: '#34374a', kind: 3 },
  mailW: { c: '#4a4e60', kind: 3 },
  belt: { c: '#3b2618', kind: 2 },
  beltD: { c: '#24170e', kind: 2 },
  leather: { c: '#2e2119', kind: 2 },
  sole: { c: '#1c140f', kind: 2 },
  // (the runestone: a cold blue-grey granite, its bevels darker)
  stone: { c: '#6a7284', kind: 2 },
  stoneD: { c: '#3f4555', kind: 2 },
};

const PI2 = PI / 2;

/* ---- helm -------------------------------------------------------------------------------------------------------- */
/**
 * The hold-helm, rigid on the head: an octagonal skull (a corner before, so its brim comes to a point over the nose) in a
 * band, a ledge, two terraces of facets and a table under a gilt finial; gilt ribs on the corners before, behind and at
 * the sides; the brow bar in gilt with its rune channel; the nasal; the cheek plates; the neck guard.
 */
export function adamantineHelm(B) {
  const A = B.at, out = [], fem = B.who === 'female';
  const wH = boneW(B, 'head'), w = () => wH;
  const hs = skinSamples(B).filter((q) => headW(B, q.w) > 0.45);
  const eyeV = new Set(B.A.polys.filter((p) => p[1] === 2).flatMap((p) => p[0])), eyes = [...eyeV].map((i) => B.V[i]);
  const browV = new Set(B.A.polys.filter((p) => p[1] === 1).flatMap((p) => p[0])), brows = [...browV].map((i) => B.V[i]);
  const eyeTop = Math.max(...eyes.map((p) => p[1])), eyeBot = Math.min(...eyes.map((p) => p[1]));
  const browTop = Math.max(...brows.map((p) => p[1]));
  const top = Math.max(...hs.map((q) => q.p[1])), chin = Math.min(...hs.map((q) => q.p[1]));
  const nose = hs.reduce((b, q) => (q.p[2] > b[2] ? q.p : b), [0, 0, -9]);
  const zf = Math.max(...hs.map((q) => q.p[2])), zb = Math.min(...hs.map((q) => q.p[2]));
  const c = [0, 0, (zf + zb) / 2 - 0.04];
  // -- the skull's plan: an octagon round the head above the eyes, a corner at the front
  const upper = hs.filter((q) => q.p[1] > eyeBot).map((q) => q.p);
  const mg = fem ? 0.09 : 0.11;
  const C = hull(upper.map((p) => [p[0] - c[0], p[2] - c[2]]), 8, { margin: () => mg });
  const yB = eyeTop + (fem ? 0.13 : 0.15);
  // (the brim's foot: over the eyes before, lower at the temples and behind)
  const brimY = (a) => { const f = smooth(0.45, 1.25, Math.abs(a)), g = smooth(1.9, 2.8, Math.abs(a)); return yB - (fem ? 0.2 : 0.24) * f - 0.12 * g; };
  const yBand = browTop + (fem ? 0.2 : 0.24), yT1 = yBand + (fem ? 0.26 : 0.3), yT2 = top - 0.1, yTab = top + (fem ? 0.04 : 0.05);
  const Y = [yB - 0.25, yBand, yBand, yT1, yT2, yTab];
  let K = [1.04, 1.0, 0.9, 0.86, 0.72, 0.5];
  K = fitScales(upper, c, C, Y.slice(2), K.slice(2), mg).map((k, i) => k);
  const Kf = [1.1, Math.max(1.02, K[0] + 0.1), ...K];
  const rowY = [(a) => brimY(a), () => yBand, () => yBand, () => yT1, () => yT2, () => yTab];
  const NV = 48;
  const skull = facetGrid(c, 5, NV, (u, v) => { const i = Math.round(u * 5), a = -PI + TAU * v; return { a, y: rowY[i](a), k: Kf[i] }; }, { C, closed: true });
  // (the band and the terraces in the metal, the ledge between them polished bright)
  out.push(solid(skull, { sheet: true, w, mat: (i, j) => (i === 1 ? 'adL' : i === 0 ? 'adM' : i === 3 ? 'adF' : 'ad') }));
  // (the table closed under the finial)
  const tab = part();
  const ring = skull.P[5].map((p) => put(tab, p, [0, 1, 0], wH));
  fan(tab, ring, put(tab, [c[0], yTab + 0.02, c[2]], [0, 1, 0], wH), [0, 1, 0], 'ad');
  out.push(tab);
  out.push(gem([c[0], yTab - 0.02, c[2]], [0, 1, 0], { k: 8, r: reachOf(C, 0) * Kf[5] * 0.55, h: fem ? 0.16 : 0.2, h0: 0.07, table: 0.4, foot: 1.05, mat: 'gilt', crown: 'giltL', w }));
  // (the brim's foot rolled bright)
  out.push(tube(rowPath(skull, 0, 0, NV, NV), { r: 0.04, k: 4, mat: 'adS', w, closed: true }));
  // -- the ribs: gilt on the corners before, behind and at the sides, from the ledge to the table, riveted
  for (const j of [0, NV / 4, NV / 2, (3 * NV) / 4]) {
    const path = colPath(skull, j, 2, 5, 10);
    out.push(band(path, { wide: 0.09, high: 0.035, mat: 'gilt', w }));
    out.push(...studsAlong(path, 3, { from: 0.15, to: 0.75, r: 0.045, h: 0.075, k: 4, mat: 'giltL', w }));
  }
  // -- the brow bar: a massive gilt bar along the brim before, its face cut flat, the rune channel in it
  const aBrow = 1.3;
  const browPath = [];
  for (let k = 0; k <= 26; k++) {
    const a = -aBrow + (2 * aBrow * k) / 26, j = ((a + PI) / TAU) * NV, q0 = skull.at(0, j), q1 = skull.at(1, j);
    const p = lerp(q0.p, q1.p, fem ? 0.5 : 0.45), n = unit(dirOf(a));
    browPath.push({ p: add(p, mul(n, -0.01)), n: unit(add(n, [0, 0.05, 0])) });
  }
  const bw = fem ? 0.3 : 0.36, bh = fem ? 0.13 : 0.16;
  out.push(sweep(browPath, { closedProfile: true, mat: 'gilt', w, profile: (k) => { const e = Math.min(k, 26 - k) < 2 ? 0.7 : 1; return [[-bw / 2, 0], [bw / 2, 0], [bw * 0.36, bh * e], [-bw * 0.36, bh * e]]; } }));
  const chan = browPath.slice(2, 25).map((q) => ({ p: add(q.p, mul(q.n, bh - 0.008)), n: q.n }));
  out.push(band(chan, { wide: bw * 0.34, high: 0.018, sink: 0.01, mat: 'rune', w }));
  // (the channel cut into rune cells by gilt bars across it)
  for (let k = 3; k < 24; k += 3) {
    const q = browPath[k], t = unit(sub(browPath[k + 1].p, browPath[k - 1].p)), side = cross(t, q.n);
    const p0 = add(q.p, mul(q.n, bh)), a0 = add(p0, mul(side, bw * 0.24)), a1 = add(p0, mul(side, -bw * 0.24));
    out.push(sweep([{ p: a0, n: q.n }, { p: a1, n: q.n }], { closedProfile: true, mat: 'giltL', w, profile: [[-0.018, -0.01], [0.018, -0.01], [0.018, 0.03], [-0.018, 0.03]] }));
  }
  // (gilt bosses at its ends, on the temples)
  for (const k of [0, 26]) { const q = browPath[k]; out.push(gem(add(q.p, mul(q.n, 0.02)), q.n, { k: 6, r: fem ? 0.1 : 0.12, h: 0.09, h0: 0.03, table: 0.5, mat: 'gilt', crown: 'giltL', w })); }
  // -- the nasal: broad, faceted to a ridge, from the brow bar down past the nose's tip, edged in gilt
  const nTop = add(browPath[13].p, mul(browPath[13].n, bh * 0.4)), nBot = [nose[0] * 0, nose[1] - (fem ? 0.04 : 0.06), nose[2] + (fem ? 0.1 : 0.12)];
  const nW0 = fem ? 0.14 : 0.17, nW1 = fem ? 0.1 : 0.12;
  const nasal = patch((u, v) => {
    const p = lerp(nTop, nBot, u), half = nW0 + (nW1 - nW0) * u, x = (v - 0.5) * 2 * half;
    const ridge = 0.05 * (1 - Math.abs(v - 0.5) * 2);
    return { p: add(p, [x, 0, ridge - 0.03 * Math.abs(v - 0.5) * 2]), n: [0, 0.2, 1] };
  }, 3, 2);
  out.push(solid(nasal, { w, thick: 0.05, mat: () => 'ad', inner: 'adD', edge: 'adS' }));
  for (const v of [0, 2]) out.push(tube(colPath(nasal, v, 0, 3, 3), { r: 0.028, k: 4, mat: 'gilt', w }));
  out.push(tube(rowPath(nasal, 3, 0, 2, 2), { r: 0.032, k: 4, mat: 'giltL', w }));
  // -- the cheek plates: deep, cut in two facets (the upper standing out, the lower tucked in to the jaw), from under
  // the brim at the temples to below the jaw; their front edges cut back from the eyes and forward to the chin, edged in
  // gilt, a boss at the hinge
  const lower = hs.filter((q) => q.p[1] < yB && q.p[1] > chin - 0.05).map((q) => q.p);
  const Cl = hull(lower.map((p) => [p[0] - c[0], p[2] - c[2]]), 8, { margin: () => (fem ? 0.08 : 0.1) });
  const yC0 = (a) => brimY(a) + 0.08, yC1 = chin + (fem ? 0.12 : 0.06);
  for (const sg of [1, -1]) {
    const aF0 = 0.7, aF1 = 0.36, aBk = 2.0;
    // (rows: the top, the knee where the facets meet, the foot)
    const g = facetGrid(c, 2, 10, (u, v) => {
      const aF = aF0 + (aF1 - aF0) * u, a = sg * (aF + (aBk - aF) * v);
      const y0 = yC0(a), y1 = yC1 + 0.16 * smooth(0.2, 1, v), yy = u === 0 ? y0 : u === 1 ? lerp([0, y0, 0], [0, y1, 0], 0.5)[1] : y1;
      return { a, y: yy, k: u === 0.5 ? 1.08 : u === 0 ? 1.0 : 0.97, C: u === 0 ? C : u === 0.5 ? lerpHull(C, Cl, 0.6) : Cl };
    });
    out.push(solid(g, { sheet: true, w, mat: (i) => (i === 1 ? 'adF' : 'ad') }));
    out.push(tube(colPath(g, 0, 0, 2, 4), { r: 0.04, k: 4, mat: 'gilt', w }));
    out.push(tube(rowPath(g, 2, 0, 10, 10), { r: 0.035, k: 4, mat: 'giltD', w }));
    out.push(tube(rowPath(g, 1, 0.3, 10, 10), { r: 0.022, k: 3, mat: 'adL', w }));
    // (gilt knotwork: a chevron along the lower facet)
    out.push(band(zigzag(rowPath(g, 1.5, 1.2, 9.4, 10), 0.07), { wide: 0.045, high: 0.02, mat: 'gilt', w }));
    const hq = g.at(0.35, 7.5);
    out.push(gem(hq.p, hq.n, { k: 6, r: fem ? 0.08 : 0.1, h: 0.08, h0: 0.03, table: 0.5, mat: 'gilt', crown: 'giltL', w }));
  }
  // -- the neck guard: a flared plate behind in two facets, its foot edged in gilt
  const aNk = 1.9;
  {
    const y0 = brimY(PI) + 0.08, y1 = y0 - (fem ? 0.45 : 0.55);
    const g = facetGrid(c, 2, 16, (u, v) => { const a = aNk + (TAU - 2 * aNk) * v; return { a, y: y0 + (y1 - y0) * u, k: Kf[0] - 0.03 + 0.08 * u * u + 0.02 * u, C }; });
    out.push(solid(g, { sheet: true, w, mat: (i) => (i === 1 ? 'adF' : 'ad') }));
    out.push(tube(rowPath(g, 2, 0, 16, 16), { r: 0.035, k: 4, mat: 'gilt', w }));
    out.push(band(zigzag(rowPath(g, 1.3, 1, 15, 14), 0.08), { wide: 0.045, high: 0.02, mat: 'gilt', w }));
  }
  const P = merge(...out);
  // (the head's polygons it covers left out under it: those inside the skull, and those its pieces cover)
  const inside = (i) => { const p = B.V[i], a = Math.atan2(p[0] - c[0], p[2] - c[2]); return p[1] > brimY(a) + 0.05 && Math.abs(a) > 0.8 && headW(B, B.W[i]) > 0.6; };
  B.A.polys.forEach(([v, m], pi) => { if (m !== 2 && v.every((i) => inside(i))) P.hides.add(pi); });
  return coverHides(B, P, 0.5, (pi) => B.A.polys[pi][1] !== 2);
}
const put = (P, p, n, w) => { P.V.push(p); P.N.push(n); P.W.push(w); return P.V.length - 1; };
/** A hull between two (as many corners each), `f` of the way from the first to the second. */
const lerpHull = (C0, C1, f) => C0.map((p, k) => [p[0] + (C1[k][0] - p[0]) * f, p[1] + (C1[k][1] - p[1]) * f]);

/* ---- chest & arms ------------------------------------------------------------------------------------------------ */
/** How much of a body point's weight is on the head and the jaw themselves. */
const headOnly = (B, i) => headW(B, B.W[i]);
/** The hauberk: heavy mail over the torso and the arms to the wrists and down over the hips, the skin under it left out. */
function hauberk(B) {
  const A = B.at, M = torsoMarks(B);
  return shell(B, {
    sub: 0, rim: null,
    keep: (i) => { const p = B.V[i]; return on(B, i, 'torso', 'shoulder', 'upperarm', 'forearm', 'neck', 'head', 'thigh') > 0.6 && headOnly(B, i) < 0.05 && on(B, i, 'hand') < 0.35 && p[1] > M.hip - 0.3 && on(B, i, 'thigh') < 0.5 && p[1] < A.neck[1] - 0.02; },
    off: ({ p }) => 0.07 + 0.03 * smooth(M.waist, M.hip, p[1]) - 0.03 * smooth(A.neck[1] - 0.6, A.neck[1] - 0.1, p[1]),
    mat: () => 'mail',
  });
}
/**
 * The cuirass cut as a gem: the breastplate in six facets across (a keel down the middle), in rows that rise to a ridge
 * across the breast and fall back to the neck; the backplate the same behind; the rune boss on the breast; the belt
 * with its gilt plaque; knotwork bands along the necklines.
 */
function cuirass(B) {
  const A = B.at, M = torsoMarks(B), F = torsoField(B), t = F.tOfY, out = [], fem = B.who === 'female';
  const W = nearSkinW(B, (s) => shareW(B, s.w, 'torso') > 0.7, (n) => TORSO_BONES.has(n), 0.35), w = (p) => W(p);
  const aN = 0.6, side = PI2 + 0.04;
  const aA = fem ? 1.25 : 1.08;
  const topF = (a) => { const ax = Math.abs(a), yC = M.neckF + 0.1; if (ax <= aN) return M.neckF + 0.1 * (ax / aN) ** 2; const k = clamp((ax - aN) / (aA - aN)); return M.pit + 0.05 + (yC - M.pit - 0.05) * Math.sqrt(Math.max(0, 1 - k * k)); };
  const bN = 0.62;
  const topB = (a) => { const bx = PI - Math.abs(wrapAngle(a)); const yC = M.neckB + 0.1; if (bx <= bN) return M.neckB + 0.1 * (bx / bN) ** 2; const k = clamp((bx - bN) / (PI - side + 0.04 - bN)); return M.pit + (yC - M.pit) * Math.sqrt(Math.max(0, 1 - k * k)); };
  // (the breast's ridge: the rows' offsets a tent, out most across the breast, back to the waist and to the neck)
  const yRidge = lerp(A.chest, [0, M.waist, 0], fem ? 0.3 : 0.22)[1];
  const tent = (yy) => (yy > yRidge ? Math.max(0, 1 - (yy - yRidge) / (M.neckF + 0.3 - yRidge)) : Math.max(0, 1 - (yRidge - yy) / (yRidge - M.waist + 0.2)));
  const keel = (a) => 0.1 * Math.max(0, 1 - Math.abs(a) / 0.5);
  const yBot = M.waist - 0.02;
  const offF = (u, v, tt, a) => 0.17 + (fem ? 0.1 : 0.13) * tent(F.yOfT(tt)) * Math.max(0, Math.cos(a)) + keel(a) + 0.08 * smooth(0.55, 1, u) * smooth(0.4, 1.0, Math.abs(a));
  // (rows: the waist, the belly, the ridge, the upper breast, the neckline)
  const rowsF = (a, u) => { const top = topF(a), ys = [yBot, lerp([0, yBot, 0], [0, yRidge, 0], 0.5)[1], Math.min(yRidge, top - 0.15), lerp([0, Math.min(yRidge, top - 0.15), 0], [0, top, 0], 0.55)[1], top]; const k = u * 4, i = Math.min(3, Math.floor(k)); return ys[i] + (ys[i + 1] - ys[i]) * (k - i); };
  const breast = plateOn(F, { a0: -side, a1: side, t0: () => t(yBot), t1: (a) => t(topF(a)), nu: 4, nv: 8, off: offF });
  // (re-laid on the rows above, so the ridge falls on a row)
  const bG = gridOf(breast.P.map((row, i) => row.map((p, j) => { const a = -side + (2 * side * j) / 8, yy = rowsF(a, i / 4), q = F.ta(t(yy), a); return add(q.p, mul(q.n, offF(i / 4, j / 8, t(yy), a))); })), { out: (i, j) => breast.N[i][j] });
  out.push(solid(bG, { sheet: true, w, mat: (i) => (i === 0 ? 'adM' : i === 3 ? 'adF' : 'ad') }));
  const back = plateOn(F, { a0: side - 0.06, a1: 2 * PI - side + 0.06, t0: () => t(yBot), t1: (a) => t(topB(a)), nu: 4, nv: 8, off: (u, v, tt, a) => 0.15 + 0.05 * Math.max(0, 1 - Math.abs(wrapAngle(a - PI)) / 0.45) });
  out.push(solid(back, { sheet: true, w, mat: (i) => (i === 0 ? 'adM' : 'ad') }));
  // (the edges: the neckline and the armholes rolled bright, the foot dark; a gilt chevron of knotwork under the neckline)
  out.push(tube(rowPath(bG, 4, 1.75, 6.25, 18), { r: 0.055, k: 4, mat: 'adL', w }));
  out.push(tube(rowPath(back, 4, 0, 8, 24), { r: 0.05, k: 4, mat: 'adL', w }));
  out.push(band(zigzag(rowPath(bG, 3.45, 1.6, 6.4, 16), 0.07), { wide: 0.055, high: 0.025, mat: 'gilt', w }));
  out.push(band(rowPath(bG, 3.82, 1.2, 6.8, 16), { wide: 0.04, high: 0.02, mat: 'giltD', w }));
  out.push(band(zigzag(rowPath(back, 3.4, 1.8, 6.2, 14), 0.07), { wide: 0.055, high: 0.025, mat: 'gilt', w }));
  // (the keel's line in gilt from the boss to the belt)
  out.push(band(colPath(bG, 4, 0.2, 2.2, 6), { wide: 0.06, high: 0.03, mat: 'gilt', w }));
  // (the ridge across the breast polished; a chevron of knotwork along the foot over the belt)
  out.push(tube(rowPath(bG, 2, 0.3, 7.7, 16), { r: 0.025, k: 3, mat: 'adL', w }));
  out.push(band(zigzag(rowPath(bG, 0.75, 0.6, 7.4, 22), 0.06), { wide: 0.05, high: 0.025, mat: 'gilt', w }));
  // -- the rune boss: a gilt hexagon on the breast's ridge, a dark adamantine hexagon in it, algiz cut and lit, gilt
  // studs at its corners
  const bq = bG.at(2.4, 4), bn = unit(add(bq.n, [0, 0.15, 0])), bR = fem ? 0.36 : 0.44;
  const BF = frameAt(add(bq.p, mul(bn, -0.02)), bn);
  out.push(gem(BF.o, bn, { k: 6, r: bR, h: 0.08, h0: 0.04, table: 0.86, foot: 1, mat: 'giltD', crown: 'gilt', w, twist: PI / 6 }));
  out.push(gem(inFrame(BF, 0, 0, 0.05), bn, { k: 6, r: bR * 0.74, h: 0.06, h0: 0.03, table: 0.88, foot: 1, mat: 'adS', crown: 'adM', w, twist: PI / 6 }));
  out.push(...runeOn(frameAt(inFrame(BF, 0, 0, 0.11), bn), 'algiz', bR * 0.5, { sweep, wide: 0.06, high: 0.025, mat: 'rune', w }));
  for (let k = 0; k < 6; k++) { const a = PI / 6 + (k * PI) / 3; out.push(gem(inFrame(BF, Math.cos(a) * bR * 0.93, Math.sin(a) * bR * 0.93, 0.07), bn, { k: 4, r: 0.04, h: 0.05, h0: 0.02, table: 0, mat: 'giltL', w })); }
  // -- the belt: broad leather round the waist, gilt-edged, its plaque before
  const bTop = M.waist + 0.16, bLo = M.waist - (fem ? 0.22 : 0.28);
  const belt = plateOn(F, { a0: -PI, a1: PI, closed: true, t0: () => t(bLo), t1: () => t(bTop), nu: 2, nv: 24, off: (u) => 0.25 + 0.02 * u });
  out.push(solid(belt, { w, thick: 0.05, mat: () => 'belt', inner: 'beltD', edge: 'beltD' }));
  for (const i of [0, 2]) out.push(tube(rowPath(belt, i, 0, 24, 24), { r: 0.03, k: 4, mat: 'giltD', w, closed: true }));
  out.push(...[2.5, 5.5, 8.5, 15.5, 18.5, 21.5].map((j) => { const q = belt.at(1, j); return gem(q.p, q.n, { k: 4, r: 0.05, h: 0.05, h0: 0.02, table: 0, mat: 'gilt', w }); }));
  // (the plaque: a gilt plate cut with bevelled corners, a chevron of knotwork across it, a boss in its middle)
  const pq = belt.at(1, 12), PF = frameAt(add(pq.p, mul(pq.n, 0.03)), pq.n), pw = fem ? 0.3 : 0.36, ph = (bTop - bLo) * 0.82;
  const oct = (v) => { const pts = [[-pw, -ph * 0.6], [-pw * 0.7, -ph], [pw * 0.7, -ph], [pw, -ph * 0.6], [pw, ph * 0.6], [pw * 0.7, ph], [-pw * 0.7, ph], [-pw, ph * 0.6]]; const f = v * 8, k = Math.floor(f) % 8, g = f - Math.floor(f); return [pts[k][0] + (pts[(k + 1) % 8][0] - pts[k][0]) * g, pts[k][1] + (pts[(k + 1) % 8][1] - pts[k][1]) * g]; };
  const plaque = plaqueGrid(PF, oct, 16, 2, (f) => 0.05 * Math.min(1, f * 2));
  out.push(solid(plaque, { w, thick: 0.04, mat: (i) => (i === 0 ? 'gilt' : 'giltL'), inner: 'giltD', edge: 'giltD' }));
  out.push(gem(inFrame(PF, 0, 0, 0.05), PF.n, { k: 6, r: ph * 0.45, h: 0.07, h0: 0.03, table: 0.5, mat: 'giltD', crown: 'gilt', w, twist: PI / 6 }));
  for (const sx of [-1, 1]) out.push(band(zigzag([...Array(5).keys()].map((k) => ({ p: inFrame(PF, sx * (pw * 0.32 + k * pw * 0.13), 0, 0.05), n: PF.n })), ph * 0.28), { wide: 0.03, high: 0.015, mat: 'giltD', w }));
  return { out, F, M, W, bG, back };
}

/** The arm's skin samples on side `s`: of the parts given, more than `k` of their weight. */
const armPick = (B, s, parts, k = 0.6) => (q) => (s === 'l' ? q.p[0] > 0.15 : q.p[0] < -0.15) && shareW(B, q.w, ...parts) > k;
const armBones = (s) => (n) => n.endsWith(`_${s}`);
/**
 * One arm: the pauldron as three terraces stepping out and down from a faceted cap over the shoulder, its ledges
 * polished, the lowest edged in gilt knotwork; a rerebrace of three lames; a faceted couter with a gilt boss; an
 * octagonal vambrace with a gilt chevron; the gauntlet's flared cuff, its plate over the back of the hand and the heavy
 * knuckle bar studded in gilt.
 */
function armHarness(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, sh = A.shoulder[s], el = A.elbow[s], wr = A.wrist[s], out = [], fem = B.who === 'female';
  const upDir = unit(sub(el, sh)), foreDir = unit(sub(wr, el)), uaLen = len(sub(el, sh)), faLen = len(sub(wr, el));
  // -- the rerebrace: three lames down the upper arm, each lapped over the one below, octagonal
  const upPick = armPick(B, s, ['upperarm', 'shoulder']);
  const UA = limbWrap(B, sh, el, sg, { t: [0.0, 0.92], nt: 16, a: [-PI, PI], closed: true, na: 24, pick: upPick, smooth: 3, shape: (r) => r });
  const wUp = skinW(B, (q) => upPick(q) && along(q.p, sh, el) > 0.3 && along(q.p, sh, el) < 0.8, armBones(s));
  for (let k = 0; k < 3; k++) {
    const t0 = 0.3 + 0.19 * k, t1 = t0 + 0.23;
    const g = plateOn(UA, { a0: -PI + PI / 8, a1: PI + PI / 8, closed: true, t0: () => t0, t1: () => t1, nu: 1, nv: 8, off: (u) => 0.11 + 0.025 * (1 - u) + 0.012 * (2 - k) });
    out.push(solid(g, { hollow: true, w: () => wUp, thick: 0.04, mat: () => (k === 1 ? 'adF' : 'ad'), edge: 'adS' }));
    out.push(tube(rowPath(g, 0, 0, 8, 8), { r: 0.03, k: 4, mat: k === 2 ? 'gilt' : 'adS', w: () => wUp, closed: true }));
  }
  // -- the pauldron: a faceted cap over the shoulder's ball and three terraces under it round the arm's top, each wider
  // and lower, stepping out; open on the inside toward the neck
  const wSh = mixOf(B, [[`shoulder_${s}`, 0.45], [`upperarm_${s}`, 0.15], [`clavicle_${s}`, 0.4]]);
  const shPick = (q) => q.p[0] * sg > 0.78 * sh[0] * sg && shareW(B, q.w, 'shoulder', 'upperarm', 'torso') > 0.8 && shareW(B, q.w, 'neck', 'head') < 0.1 && len(sub(q.p, sh)) < 1.25 && q.p[1] > sh[1] - 0.95;
  const ax = unit([sg * 0.5, 0.87, 0]), cc = add(sh, [sg * 0.02, -0.15, 0]);
  const near = skinSamples(B).filter(shPick).map((q) => q.p);
  // (the plan round the arm's top: a hexagon round the shoulder's skin, about the axis tilted out from upright)
  const fx = [0, 0, 1], fs = mul(unit(cross(ax, fx)), sg), proj = (p) => { const d = sub(p, cc); return [dot(d, fs), dot(d, fx), dot(d, ax)]; };
  const pl = near.map(proj), H0 = hull(pl.map(([x, z]) => [x, z]), 6, { margin: () => 0.1 });
  const hTop = Math.max(...pl.map((q) => q[2]));
  const at3 = (x, z, h) => add(cc, add(add(mul(fs, x), mul(fx, z)), mul(ax, h)));
  // (tiers: [height along the axis at its top, at its foot, the plan's scale]; the inside toward the neck cut away)
  const big = fem ? 0.9 : 1;
  const tiers = [[hTop + 0.16, hTop - 0.14, 0.86], [hTop - 0.1, hTop - 0.44, 1.08], [hTop - 0.38, hTop - 0.74, 1.28], [hTop - 0.66, hTop - 1.06, 1.48]];
  // (the side toward the neck: angles round the axis, nought the front, toward fs: the inside lies at -sg of fs... the
  // plan's x along fs points away from the body's middle on both sides)
  const inner = (a) => Math.abs(wrapAngle(a + PI2 * 1)) < 0.9;
  void inner;
  tiers.forEach(([h0, h1, k], ti) => {
    const kk = k * big, lo = ti === 0 ? 0.5 : 0.9;
    const aIn = ti === 0 ? PI : 1.55 + 0.08 * ti;
    const g = patch((u, v) => {
      // (round the outside from the back to the front; the cap closed over the top)
      const a = -PI2 - aIn + (2 * aIn) * v + PI;
      const r = reachOf(H0, a) * (ti === 0 ? kk * (0.3 + 0.7 * Math.sqrt(u)) * (1 - 0.52 * Math.max(0, -Math.sin(a))) : kk + 0.05 * u), hh = h0 + (h1 - h0) * (ti === 0 ? u * u : u);
      const d = [Math.sin(a), Math.cos(a)];
      return { p: at3(d[0] * r, d[1] * r, hh), n: unit(add(mul(ax, 0.3 * (1 - u)), add(mul(fs, d[0]), mul(fx, d[1])))) };
    }, ti === 0 ? 2 : 1, 12);
    out.push(solid(g, { hollow: ti > 0, sheet: ti === 0, w: () => wSh, thick: 0.05, mat: (i) => (ti === 0 ? (i === 0 ? 'adF' : 'ad') : ti % 2 ? 'ad' : 'adF'), edge: 'adS' }));
    // (each tier's top a ledge stepping in to the tier above, polished)
    if (ti > 0) {
      const ledge = patch((u, v) => {
        const a = -PI2 - aIn + (2 * aIn) * v + PI, r = reachOf(H0, a) * (tiers[ti - 1][2] * big * (1 - u) + kk * u) - 0.03 * (1 - u), d = [Math.sin(a), Math.cos(a)];
        return { p: at3(d[0] * r, d[1] * r, h0 + 0.002), n: ax };
      }, 1, 12);
      out.push(solid(ledge, { sheet: true, w: () => wSh, mat: () => 'adF' }));
      out.push(tube(rowPath(ledge, 1, 0, 12, 12), { r: 0.022, k: 3, mat: 'adL', w: () => wSh }));
    }
    if (ti === 3) {
      out.push(tube(rowPath(g, 1, 0, 12, 12), { r: 0.04, k: 4, mat: 'gilt', w: () => wSh }));
      out.push(band(zigzag(rowPath(g, 0.5, 0.5, 11.5, 22), 0.08), { wide: 0.05, high: 0.025, mat: 'gilt', w: () => wSh }));
    }
  });
  // (a gilt gem on the cap's top)
  out.push(gem(at3(0, 0, hTop + 0.15), ax, { k: 6, r: 0.16, h: 0.12, h0: 0.05, table: 0.45, mat: 'gilt', crown: 'giltL', w: () => wSh }));
  // -- the couter: a faceted cup over the elbow, a gilt boss on its point
  const c0 = sub(el, mul(upDir, uaLen * 0.22)), c1 = add(el, mul(foreDir, faLen * 0.2));
  const elPick = (q) => armPick(B, s, ['upperarm', 'forearm'], 0.6)(q) && len(sub(q.p, el)) < 0.9;
  const EL = limbWrap(B, c0, c1, sg, { t: [0, 1], nt: 10, a: [-PI, PI], closed: true, na: 24, pick: elPick, smooth: 3, shape: (r) => r });
  const wEl = boneW(B, `elbow_${s}`);
  const cup = plateOn(EL, { a0: 0.85, a1: 2 * PI - 0.85, t0: () => 0.02, t1: () => 0.98, nu: 2, nv: 6, off: (u, v) => 0.15 + 0.09 * Math.sin(PI * u) * Math.sin(PI * v) });
  out.push(solid(cup, { sheet: true, w: () => wEl, mat: (i) => (i ? 'adF' : 'ad') }));
  for (const i of [0, 2]) out.push(tube(rowPath(cup, i, 0, 6, 12), { r: 0.03, k: 4, mat: 'adS', w: () => wEl }));
  const eq = EL.ta(0.5, PI), en = unit(eq.n);
  out.push(gem(add(eq.p, mul(en, 0.2)), en, { k: 6, r: fem ? 0.11 : 0.13, h: 0.1, h0: 0.04, table: 0.45, mat: 'gilt', crown: 'giltL', w: () => wEl }));
  // -- the vambrace: octagonal round the forearm, a ridge down its outside, a gilt chevron round its top
  const faPick = armPick(B, s, ['forearm'], 0.6);
  const FA = limbWrap(B, el, wr, sg, { t: [0, 1.0], nt: 14, a: [-PI, PI], closed: true, na: 24, pick: faPick, smooth: 3, shape: (r) => r });
  const wFa = skinW(B, (q) => faPick(q) && along(q.p, el, wr) > 0.25 && along(q.p, el, wr) < 0.85, armBones(s));
  const vamb = plateOn(FA, { a0: -PI + PI / 8, a1: PI + PI / 8, closed: true, t0: () => 0.17, t1: () => 0.8, nu: 2, nv: 8, off: (u) => 0.1 + 0.03 * Math.sin(PI * u) });
  out.push(solid(vamb, { sheet: true, w: () => wFa, mat: () => 'ad' }));
  out.push(tube(rowPath(vamb, 0, 0, 8, 8), { r: 0.035, k: 4, mat: 'adS', w: () => wFa, closed: true }));
  out.push(band(zigzag(rowPath(vamb, 0.45, 0, 8, 16), 0.05), { wide: 0.04, high: 0.02, mat: 'gilt', w: () => wFa, closed: true }));
  // -- the gauntlet's cuff, flared back over the vambrace's end, octagonal, gilt-edged
  const wWr = mixOf(B, [[`hand_${s}`, 0.5], [`wrist_${s}`, 0.25], [`lowerarm_${s}`, 0.25]]);
  const cuff = plateOn(FA, { a0: -PI + PI / 8, a1: PI + PI / 8, closed: true, t0: () => 0.74, t1: () => 0.99, nu: 1, nv: 8, off: (u) => 0.27 - 0.16 * u });
  out.push(solid(cuff, { hollow: true, w: () => wWr, thick: 0.035, mat: () => 'ad', edge: 'adS' }));
  out.push(tube(rowPath(cuff, 0, 0, 8, 8), { r: 0.04, k: 4, mat: 'gilt', w: () => wWr, closed: true }));
  // -- the hand: a plate over its back, the knuckle bar across it studded in gilt
  const hn = B.head(`hand_${s}`), kn = B.head(`fingers_01_${s}`) ?? add(hn, mul(foreDir, 0.5));
  const hPick = (q) => (s === 'l' ? q.p[0] > 0.3 : q.p[0] < -0.3) && shareW(B, q.w, 'hand') > 0.6 && len(sub(q.p, hn)) < len(sub(kn, hn)) + 0.15;
  const hs = skinSamples(B).filter(hPick);
  // (the back of the hand: the side of its samples out from the body, away from the palm)
  const hd = unit(sub(kn, hn));
  const back = unit(sub(mul([sg, 0, 0], 1), mul(hd, dot([sg, 0, 0], hd))));
  const reachB = (p0) => Math.max(...hs.map((q) => dot(sub(q.p, p0), back)));
  const wHand = boneW(B, `hand_${s}`);
  const side3 = unit(cross(hd, back));
  const HP = patch((u, v) => {
    const p0 = lerp(hn, kn, 0.1 + 0.85 * u), x = (v - 0.5) * 2 * (fem ? 0.2 : 0.24);
    const base = add(p0, mul(side3, x));
    return { p: add(base, mul(back, reachB(base) + 0.06 + 0.03 * (1 - Math.abs(v - 0.5) * 2))), n: back };
  }, 2, 2);
  out.push(solid(HP, { w: () => wHand, thick: 0.03, mat: (i, j) => ((i + j) % 2 ? 'ad' : 'adF'), inner: 'adD', edge: 'adS' }));
  const kq = HP.at(2, 1);
  out.push(sweep([0, 1, 2].map((j) => { const q = HP.at(1.9, j); return { p: add(q.p, mul(back, 0.01)), n: back }; }), { closedProfile: true, mat: 'adM', w: () => wHand, profile: [[-0.06, -0.02], [0.06, -0.02], [0.05, 0.05], [0, 0.07], [-0.05, 0.05]] }));
  for (const j of [0.2, 0.75, 1.25, 1.8]) { const q = HP.at(1.9, j); out.push(gem(add(q.p, mul(back, 0.07)), back, { k: 4, r: 0.04, h: 0.04, h0: 0.015, table: 0, mat: 'giltL', w: () => wHand })); }
  void kq;
  return out;
}
/** The gloves: leather over the hands, the fingers left bare where they bend. */
function gloves(B) {
  return shell(B, {
    sub: 0, rim: null,
    keep: (i) => on(B, i, 'hand', 'forearm') > 0.8 && on(B, i, 'hand') > 0.3 && !B.W[i].some(([b, x]) => x > 0.4 && /fingers_0[12]|thumb_0[123]|fingers_mid/.test(B.bones[b].name)),
    off: () => 0.025,
    mat: () => 'leather',
  });
}
export function adamantineChest(B) {
  const T = cuirass(B);
  return coverHides(B, merge(smoothWeights(hauberk(B), 2, (p) => p[1] < B.at.neck[1] - 0.6), gloves(B), ...T.out, ...armHarness(B, 'l'), ...armHarness(B, 'r')), 0.5);
}

/* ---- the mantle: the gate-mantle --------------------------------------------------------------------------------- */
/**
 * The gate-mantle: an octagonal collar of two faceted tiers standing round the neck, lower before,
 * gilt-rimmed; under it a yoke over the shoulders' tops, the upper chest and the upper back, laid with two courses of
 * hexagonal adamantine plates like a hold's gate; the gate clasp at the throat (a gilt hexagon, the mountain over the
 * gate on dark adamantine); and between the shoulder blades the hold's runestone: a tall hexagonal slab of grey stone
 * in a heavy gilt frame, three runes cut down it and lit, a gilt mountain of three peaks over it, hung from the yoke on
 * two gilt chains.
 */
export function adamantineMantle(B) {
  const A = B.at, M = torsoMarks(B), F = torsoField(B), t = F.tOfY, out = [], fem = B.who === 'female';
  const n = A.neck[1];
  const wNeck = mixOf(B, [['neck_01', 0.55], ['spine_03', 0.45]]);
  const pick = (q) => shareW(B, q.w, 'torso', 'neck', 'head') > 0.85 && headW(B, q.w) < 0.2 && q.p[1] > M.pit - 0.2 && Math.abs(q.p[0]) < 1.25;
  const W = nearSkinW(B, pick, (nm) => ['spine_03', 'spine_02', 'neck_01', 'clavicle_l', 'clavicle_r'].includes(nm), 0.35);
  const wMid = (p) => mixW([[wNeck, 0.4], [W(p), 0.6]]);
  // -- the collar's heights: a skirt tier flared over the yoke and a standing tier above it, lower before
  const zc = F.zc(n), c = [0, 0, zc], NV = 32;
  const front = (a) => smooth(1.1, 0.2, Math.abs(wrapAngle(a)));
  const yTop = (a) => n + (fem ? 0.2 : 0.24) - (fem ? 0.36 : 0.48) * front(a), yMid = (a) => n - 0.12 - 0.22 * front(a) + 0.24 * Math.abs(Math.sin(a)) ** 2, yFoot = (a) => { const k = Math.abs(Math.sin(a)) ** 2; return Math.min(yMid(a) - 0.1, (n - 0.34 - 0.2 * front(a)) * (1 - k) + (yMid(a) - 0.1) * k); };
  // -- the yoke: a plate from under the collar's skirt over the upper chest and the upper back, narrow over the
  // shoulders' tops (the pauldrons' place), laid on an envelope round the cuirass, the hauberk and the skin
  const yA = fem ? 0.72 : 0.78, yB = 0.98;
  const side = (a) => smooth(0.55, 0.92, Math.abs(Math.sin(a)));
  const yokeBot = (a) => { const b = Math.abs(wrapAngle(a)), bk = smooth(1.3, 1.9, b), full = lerp([0, M.neckF - (fem ? 0.3 : 0.36), 0], [0, M.neckB - (fem ? 0.45 : 0.55), 0], bk)[1]; const edge = Math.max(smooth(yA - 0.4, yA, b), smooth(PI - yB + 0.45, PI - yB, b)); return lerp([0, full, 0], [0, yFoot(a) - 0.16, 0], Math.max(side(a), edge * 0.75))[1]; };
  const NY = 36;
  const env = [];
  for (const P of [...cuirass(B).out, hauberk(B)]) P.V.forEach((p) => { if (p[1] > M.pit - 0.8 && Math.abs(p[0]) < 1.3) env.push(p); });
  for (const q of skinSamples(B)) if (pick(q)) env.push(q.p);
  const ey0 = M.pit - 0.8, ey1 = n + 0.3, et = (yy) => (yy - ey0) / (ey1 - ey0);
  const E = torsoWrap(B, ey0, ey1, F.zc, { points: env, nt: 40, na: 72, closed: true, a: [-PI, PI], smooth: 3, minDa: 0.1, shape: (r) => r + 0.1 });
  // (two halves, before and behind, the shoulders' tops between them left to the collar's skirt and the pauldrons)
  const yokes = [[-yA, yA], [PI - yB, PI + yB]].map(([a0, a1]) => plateOn(E, { a0, a1, t0: (a) => et(yokeBot(a)), t1: (a) => et(yFoot(a) + 0.1), nu: 3, nv: NY / 2, maxUp: 0.4, off: (u) => 0.02 + 0.04 * (1 - u) }));
  for (const y of yokes) out.push(solid(y, { sheet: true, w: (p) => wMid(p), mat: () => 'adM' }));
  const yoke = { at: (fi, j) => { const a = wrapAngle(-PI + TAU * (j / NY)), back = Math.abs(a) > PI2, G = yokes[back ? 1 : 0], a0 = back ? PI - yB : -yA, a1 = back ? PI + yB : yA, aa = back && a < 0 ? a + TAU : a; return G.at(fi, clamp((aa - a0) / (a1 - a0)) * (NY / 2)); }, P: yokes.flatMap((g) => g.P) };
  // (two courses of hexagonal plates on it, the lower between the upper's, each a cut gem lying flat; none over the
  // shoulders' tops)
  const courses = [[2.1, 0, fem ? 0.17 : 0.2, 0.72], [0.85, 0.5, fem ? 0.19 : 0.22, 0.6]];
  for (const [fi, off, r, lim] of courses) {
    const count = 18;
    for (let k = 0; k < count; k++) {
      const j = ((k + off) / count) * NY, q = yoke.at(fi, j), a = -PI + TAU * (j / NY);
      if (Math.abs(Math.sin(a)) > lim || (Math.abs(wrapAngle(a)) > yA - 0.15 && Math.abs(wrapAngle(a)) < PI - yB + 0.15)) continue;
      out.push(gem(add(q.p, mul(q.n, 0.02)), q.n, { k: 6, r, h: 0.07, h0: 0.035, table: 0.6, foot: 1, mat: fi < 1.5 ? 'gilt' : 'adS', crown: 'ad', top: 'adP', w: () => W(q.p), twist: PI / 6 }));
    }
  }
  for (const y of yokes) { out.push(tube(rowPath(y, 0, 0, NY / 2, NY / 2), { r: 0.04, k: 4, mat: 'gilt', w: (p) => wMid(p) })); for (const j of [0, NY / 2]) out.push(tube(colPath(y, j, 0, 3, 3), { r: 0.035, k: 4, mat: 'gilt', w: (p) => wMid(p) })); }
  // -- the collar: an octagon round the neck; its skirt's plan round the yoke's top and what is under it, its standing
  // tier's round the neck
  const neckPts = skinSamples(B).filter((q) => shareW(B, q.w, 'neck', 'torso', 'head') > 0.8 && headW(B, q.w) < 0.3 && q.p[1] < n + 0.35 && q.p[1] > n - 0.35 && (shareW(B, q.w, 'neck') > 0.25 || q.p[1] > n - 0.05)).map((q) => q.p);
  // (each column as far out as anything at its angle from its row's height up reaches, and a margin: the skirt clears
  // the trapezius' slope, the standing tier the neck)
  const cPts = [...env, ...yoke.P.flat(), ...skinSamples(B).filter((q) => shareW(B, q.w, 'neck', 'torso', 'head') > 0.8 && headW(B, q.w) < 0.3 && q.p[1] < n + 0.4).map((q) => q.p)].filter((p) => p[1] > n - 1.0 && Math.abs(p[0]) < (fem ? 0.85 : 1.02)).map((p) => ({ y: p[1], a: Math.atan2(p[0], p[2] - zc), r: Math.hypot(p[0], p[2] - zc) }));
  const reachAt = (a, y, y1) => { let r = 0; for (const q of cPts) if (q.y > y - 0.04 && q.y < y1 && Math.abs(wrapAngle(q.a - a)) < 0.22 && q.r > r) r = q.r; return r; };
  const NC = 16;
  const collar = facetGrid(c, 3, NC, (u, v) => {
    const a = -PI + TAU * v, i = Math.round(u * 3);
    const ys = [yFoot(a), yMid(a) - 0.04, yMid(a), yTop(a)];
    const r = [reachAt(a, ys[0] - 0.15, ys[1] + 0.02) + 0.1, reachAt(a, ys[1] - 0.1, yTop(a)) + 0.12, reachAt(a, ys[2], yTop(a) + 0.1) + 0.2 + 0.05 * front(a), reachAt(a, ys[3] - 0.1, yTop(a) + 0.2) + 0.17 + 0.05 * front(a)];
    r[1] = Math.max(r[1], r[2] + 0.02); r[0] = Math.max(r[0], r[1] + 0.06); if (Math.abs(Math.sin(a)) > 0.6) r[0] = Math.min(r[0], r[1] + 0.14);
    return { a, y: ys[i], k: 1, off: r[i] };
  }, { C: [[1e-6, 1e-6], [-1e-6, 1e-6], [-1e-6, -1e-6], [1e-6, -1e-6]], closed: true });
  out.push(solid(collar, { sheet: true, w: (p, i) => (i >= 2 ? wNeck : i === 1 ? mixW([[wNeck, 0.5], [wMid(p), 0.5]]) : wMid(p)), thick: 0.04, mat: (i) => (i === 0 ? 'ad' : i === 1 ? 'adL' : 'adF'), inner: 'adM', edge: 'adS' }));
  out.push(tube(rowPath(collar, 3, 0, NC, NC), { r: 0.045, k: 4, mat: 'gilt', w: () => wNeck, closed: true }));
  out.push(band(zigzag(rowPath(collar, 2.5, 0, NC, NC * 2), 0.05), { wide: 0.035, high: 0.02, mat: 'gilt', w: () => wNeck, closed: true }));
  // -- the chain of office: gilt hexagonal links in a sweep across the front of the yoke from shoulder to shoulder,
  // down to the gate clasp
  {
    const links = 9, aw = yA - 0.08;
    const at = (sx) => { const a = aw * sx, fi = 0.55 + 1.9 * sx * sx; return yoke.at(fi, ((a + PI) / TAU) * NY); };
    for (let k = 0; k < links; k++) {
      const sx = -1 + (2 * k) / (links - 1);
      if (Math.abs(sx) < 0.1) continue;
      const q = at(sx), q2 = at(sx + 0.02), d = unit(sub(q2.p, q.p));
      out.push(gem(add(q.p, mul(q.n, 0.08)), q.n, { k: 6, r: fem ? 0.12 : 0.15, h: 0.09, h0: 0.045, table: 0.55, foot: 1, mat: 'giltD', crown: 'gilt', top: 'giltL', w: () => W(q.p), twist: Math.atan2(dot(d, [0, 1, 0]), dot(d, [1, 0, 0])) }));
    }
    const path = [...Array(25).keys()].map((k) => { const q = at(-1 + k / 12); return { p: add(q.p, mul(q.n, 0.05)), n: q.n }; });
    out.push(tube(path, { r: 0.05, k: 4, mat: 'gilt', w: (p) => W(p) }));
  }
  // -- the gate clasp at the chain's foot
  const cq = yoke.at(0.35, NY / 2), cn = unit(add(cq.n, [0, 0.2, 0])), CF = frameAt(add(cq.p, mul(cn, 0.07)), cn), cR = fem ? 0.32 : 0.4;
  out.push(gem(CF.o, cn, { k: 6, r: cR, h: 0.07, h0: 0.035, table: 0.84, foot: 1, mat: 'giltD', crown: 'gilt', w: () => wMid(cq.p), twist: PI / 6 }));
  out.push(gem(inFrame(CF, 0, 0, 0.045), cn, { k: 6, r: cR * 0.72, h: 0.05, h0: 0.025, table: 0.9, foot: 1, mat: 'adS', crown: 'adS', w: () => wMid(cq.p), twist: PI / 6 }));
  out.push(...runeOn(frameAt(inFrame(CF, 0, cR * 0.05, 0.095), cn), 'gate', cR * 0.55, { sweep, wide: 0.055, high: 0.03, mat: 'giltL', w: () => wMid(cq.p) }));
  // -- the runestone between the shoulder blades
  const barY = n - (fem ? 0.55 : 0.5), yS1 = M.waist + (fem ? 0.55 : 0.6), yS0 = (barY - 0.19 * yS1) / 0.81, sw = fem ? 0.56 : 0.64;
  const back = skinSamples(B).filter((q) => shareW(B, q.w, 'torso') > 0.8 && q.p[2] < F.zc(q.p[1]) && Math.abs(q.p[0]) < sw + 0.2 && q.p[1] < yS0 + 0.2 && q.p[1] > yS1 - 0.2);
  const zBack = Math.min(...back.map((q) => q.p[2])) - (fem ? 0.68 : 0.8);
  const wS = skinW(B, (q) => shareW(B, q.w, 'torso') > 0.8 && q.p[2] < F.zc(q.p[1]) && Math.abs(q.p[0]) < 0.6 && q.p[1] < yS0 && q.p[1] > yS1, (nm) => TORSO_BONES.has(nm));
  const ws = () => wS;
  // (its outline: a tall hexagon, points above and below; leaning back a little at its top)
  const yM = (yS0 + yS1) / 2, hh = (yS0 - yS1) / 2, lean = fem ? 0.06 : 0.12;
  const SF = { o: [0, yM, zBack], x: [-1, 0, 0], y: unit([0, 1, -lean]), n: unit([0, lean, -1]) };
  const hexPt = (v) => { const P6 = [[0, hh], [-sw, hh * 0.62], [-sw, -hh * 0.62], [0, -hh], [sw, -hh * 0.62], [sw, hh * 0.62]]; const f = v * 6, k = Math.floor(f) % 6, g = f - Math.floor(f); return [P6[k][0] + (P6[(k + 1) % 6][0] - P6[k][0]) * g, P6[k][1] + (P6[(k + 1) % 6][1] - P6[k][1]) * g]; };
  const slab = plaqueGrid(SF, hexPt, 24, 2, (f) => 0.08 * Math.min(1, f * 3));
  out.push(solid(slab, { w: ws, thick: 0.2, mat: (i) => (i === 0 ? 'stoneD' : 'stone'), inner: 'stoneD', edge: 'stoneD' }));
  // (the frame: a heavy gilt band round its edge, gilt bosses at its corners)
  const rim = [...Array(25).keys()].map((k) => { const [u, v] = hexPt(k / 24); return { p: inFrame(SF, u * 1.02, v * 1.02, 0.02), n: SF.n }; });
  out.push(sweep(rim, { closed: true, closedProfile: true, mat: 'gilt', w: ws, profile: [[-0.07, -0.08], [0.07, -0.08], [0.06, 0.06], [0, 0.1], [-0.06, 0.06]] }));
  for (let k = 0; k < 6; k++) { const [u, v] = hexPt(k / 6); out.push(gem(inFrame(SF, u * 1.02, v * 1.02, 0.1), SF.n, { k: 6, r: 0.08, h: 0.07, h0: 0.03, table: 0.4, mat: 'gilt', crown: 'giltL', w: ws })); }
  // (three runes down it, cut and lit: the hold, the ward, the dawn)
  const rS = Math.min(sw * 0.42, hh * 0.22);
  [['othala', 0.52], ['algiz', 0], ['dagaz', -0.52]].forEach(([nm, f]) => out.push(...runeOn({ o: inFrame(SF, 0, f * hh, 0.1), x: SF.x, y: SF.y, n: SF.n }, nm, rS, { sweep, wide: fem ? 0.06 : 0.07, high: 0.03, mat: 'rune', w: ws })));
  // (the gilt mountain over it: three peaks, the middle the highest)
  // (the gilt mountains over it: a bar across its shoulders, five peaks on it, the middle the highest, standing above
  // the shoulders behind the head)
  const barV = hh * 0.62 - 0.02, barW = fem ? 1.08 : 1.3, hk = fem ? 0.85 : 1;
  out.push(sweep([-1, -0.5, 0, 0.5, 1].map((f) => ({ p: inFrame(SF, f * barW, barV, 0.02), n: SF.n })), { closedProfile: true, mat: 'gilt', w: ws, profile: [[-0.07, -0.1], [0.07, -0.1], [0.08, 0.04], [0, 0.09], [-0.08, 0.04]] }));
  for (const f of [-1, 1]) out.push(gem(inFrame(SF, f * barW, barV, 0.02), mul(SF.x, -f), { k: 6, r: 0.085, h: 0.12, h0: 0.04, table: 0, mat: 'gilt', crown: 'giltL', w: ws }));
  const peaks = [[-0.8, 0.85, 0.42], [-0.42, 1.15, 0.5], [0, 1.5, 0.6], [0.42, 1.15, 0.5], [0.8, 0.85, 0.42]];
  for (const [px, ph, pr] of peaks) {
    const base = inFrame(SF, px * barW, barV + 0.02, 0.02);
    out.push(gem(base, SF.y, { k: 4, r: sw * pr, h: ph * hk, h0: 0.05, table: 0, foot: 1, mat: 'gilt', crown: 'giltL', w: ws, sx: 0.22 }));
  }
  // (hung from the yoke's back on two gilt chains)
  for (const sx of [-1, 1]) {
    const top = yoke.at(0.9, (NY + sx * 2.0) % NY), bot = inFrame(SF, sx * sw * 0.45, hh * 0.62, 0.04);
    const pts = [...Array(6).keys()].map((k) => { const f = k / 5; return lerp(top.p, bot, f); });
    for (let k = 0; k < 5; k++) out.push(gem(pts[k + 1], unit(sub(pts[k], pts[k + 1])), { k: 4, r: 0.045, h: len(sub(pts[k], pts[k + 1])) * 1.1, h0: len(sub(pts[k], pts[k + 1])) * 0.5, table: 0, below: 0.02, foot: 0.4, mat: 'gilt', crown: 'giltL', w: (p) => mixW([[W(top.p), 1 - (k + 0.5) / 5], [wS, (k + 0.5) / 5]]), twist: (k * PI) / 2 }));
  }
  return coverHides(B, merge(...out), 0.6);
}

/* ---- legs -------------------------------------------------------------------------------------------------------- */
/** The thigh's plates' weights: the thigh's skin's, averaged. */
const thighW = (B, s) => { const hp = B.at.hip[s], kn = B.at.knee[s], sg = s === 'l' ? 1 : -1; return skinW(B, (q) => q.p[0] * sg > 0.12 && shareW(B, q.w, 'thigh') > 0.6 && along(q.p, hp, kn) > 0.25 && along(q.p, hp, kn) < 0.8, (n) => n.endsWith(`_${s}`)); };
/** The chausses: heavy mail over the hips and the legs to the ankles, the seat and the crotch with them; its waist dropped under any chest piece. */
function chausses(B) {
  const A = B.at, M = torsoMarks(B);
  return shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'thigh', 'calf', 'torso') > 0.6 && on(B, i, 'foot') < 0.5 && on(B, i, 'upperarm', 'forearm', 'hand', 'shoulder') < 0.05 && p[1] < M.waist + 0.25 && p[1] > A.ankle[s][1] - 0.05; },
    off: () => 0.035,
    mat: ({ p }) => (p[1] > M.hip + (B.who === 'female' ? 0.25 : 0.2) ? 'mailW' : 'mail'),
  });
}
/**
 * One leg: a tasset of three faceted lames hung from the belt over the thigh's front and outside, its foot edged in a
 * gilt chevron; a cuisse cut to a ridge; the knee cop as a faceted pyramid, a gilt hexagon on it with the rune lit, a
 * hexagonal wing on its outside; the greave octagonal round the calf, a ridge down the shin edged in gilt, flared
 * at its foot over the boot.
 */
function legHarness(B, s) {
  const A = B.at, M = torsoMarks(B), sg = s === 'l' ? 1 : -1, hp = A.hip[s], kn = A.knee[s], an = A.ankle[s], out = [], fem = B.who === 'female';
  const legBones = (n) => n.endsWith(`_${s}`);
  const thPick = (q) => (sg > 0 ? q.p[0] > 0.12 : q.p[0] < -0.12) && shareW(B, q.w, 'thigh') > 0.6;
  const TH = limbWrap(B, hp, kn, sg, { t: [-0.15, 1.05], nt: 24, a: [-PI, PI], closed: true, na: 28, pick: (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'thigh', 'torso') > 0.9 && q.p[1] < hp[1] + 0.6 || thPick(q), smooth: 4, shape: (r) => r });
  const wTh = thighW(B, s), wP = boneW(B, 'pelvis');
  // -- the tasset: three lames from the belt's foot to a third down the thigh, each lapped over the one below
  const tTop = along([hp[0], M.waist - (fem ? 0.5 : 0.32), hp[2]], hp, kn), tBot = fem ? 0.46 : 0.42, h = (tBot - tTop) / 3;
  for (let k = 0; k < 3; k++) {
    const t0 = tTop + h * k, t1 = t0 + h + 0.05;
    const w = (p) => { const f = clamp((along(p, hp, kn) - tTop) / (tBot - tTop)); return mixW([[wP, 0.6 - 0.6 * f], [wTh, 0.4 + 0.6 * f]]); };
    const g = plateOn(TH, { a0: -0.3, a1: 1.1, t0: () => t0, t1: () => t1, nu: 1, nv: 4, off: (u, v) => 0.3 + 0.05 * k + 0.06 * u + 0.05 * Math.max(0, 1 - Math.abs(v - 0.3) / 0.3) });
    out.push(solid(g, { hollow: true, w, thick: 0.045, mat: () => (k === 1 ? 'adF' : 'ad'), edge: 'adS' }));
    out.push(tube(rowPath(g, 1, 0, 4, 8), { r: 0.035, k: 4, mat: k === 2 ? 'gilt' : 'adS', w }));
    if (k === 2) out.push(band(zigzag(rowPath(g, 0.45, 0.2, 3.8, 14), 0.06), { wide: 0.045, high: 0.02, mat: 'gilt', w }));
    if (k === 0) for (const j of [0.4, 3.6]) { const q = g.at(0.25, j); out.push(gem(q.p, q.n, { k: 4, r: 0.05, h: 0.05, h0: 0.02, table: 0, mat: 'gilt', w: () => w(q.p) })); }
  }
  // -- the cuisse: from under the tasset to the knee, a ridge down its front
  const ridge = (a) => 0.06 * Math.max(0, 1 - Math.abs(a - 0.3) / 0.45);
  const cuisse = plateOn(TH, { a0: -0.75, a1: 2.0, t0: () => 0.88, t1: () => 0.4, nu: 2, nv: 6, off: (u, v, t, a) => 0.14 + ridge(a) + 0.02 * u });
  out.push(solid(cuisse, { sheet: true, w: () => wTh, mat: (i) => (i ? 'ad' : 'adF') }));
  out.push(tube(rowPath(cuisse, 0, 0, 6, 12), { r: 0.035, k: 4, mat: 'adL', w: () => wTh }));
  // -- the chausses' rings shown in rows round the thigh between the plates: dark zigzag courses on the mail
  for (let t0 = 0.3; t0 < 0.86; t0 += 0.07) {
    const ring = plateOn(TH, { a0: -PI, a1: PI, closed: true, t0: () => t0, t1: () => t0 + 0.001, nu: 1, nv: 20, off: () => 0.055 });
    out.push(band(zigzag(rowPath(ring, 0, 0, 20, 40), 0.025), { wide: 0.018, high: 0.012, sink: 0.004, mat: 'mailD', w: () => wTh, closed: true }));
  }
  // -- the knee cop: a faceted pyramid over the knee on its own half-turning bone, a gilt hexagon and the rune on it
  const kPick = (q) => (sg > 0 ? q.p[0] > 0.12 : q.p[0] < -0.12) && shareW(B, q.w, 'thigh', 'calf') > 0.8 && len(sub(q.p, kn)) < 0.9;
  const k0 = lerp(hp, kn, 0.82), k1 = lerp(kn, an, 0.16);
  const KN = limbWrap(B, k0, k1, sg, { t: [0, 1], nt: 10, a: [-PI, PI], closed: true, na: 28, pick: kPick, smooth: 4, shape: (r) => r });
  const wKn = boneW(B, `knee_${s}`);
  const cop = plateOn(KN, { a0: -1.5, a1: 1.5, t0: () => 0.0, t1: () => 1.0, nu: 2, nv: 4, off: (u, v) => 0.17 + 0.13 * (1 - Math.abs(2 * u - 1)) * (1 - Math.abs(2 * v - 1)) });
  out.push(solid(cop, { sheet: true, w: () => wKn, mat: (i, j) => ((i + j) % 2 ? 'ad' : 'adF') }));
  for (const i of [0, 2]) out.push(tube(rowPath(cop, i, 0, 4, 8), { r: 0.035, k: 4, mat: 'adL', w: () => wKn }));
  const kq = KN.ta(0.5, 0), kNn = unit(kq.n), KF = frameAt(add(kq.p, mul(kNn, 0.27)), kNn, unit(sub(hp, an)));
  const kR = fem ? 0.23 : 0.28;
  out.push(gem(KF.o, kNn, { k: 6, r: kR, h: 0.06, h0: 0.03, table: 0.82, foot: 1, mat: 'giltD', crown: 'gilt', w: () => wKn, twist: PI / 6 }));
  out.push(gem(inFrame(KF, 0, 0, 0.04), kNn, { k: 6, r: kR * 0.72, h: 0.04, h0: 0.02, table: 0.9, foot: 1, mat: 'adS', crown: 'adS', w: () => wKn, twist: PI / 6 }));
  out.push(...runeOn(frameAt(inFrame(KF, 0, 0, 0.085), kNn, unit(sub(hp, an))), 'ingwaz', kR * 0.55, { sweep, wide: 0.045, high: 0.02, mat: 'rune', w: () => wKn }));
  // (the wing: a hexagonal plate standing off the knee's outside, gilt-edged)
  const wq = KN.ta(0.5, PI2 - 0.2), wo = unit(add(wq.n, [0, 0, 0.3])), WF = frameAt(add(wq.p, mul(wo, 0.22)), wo, unit(sub(hp, an))), wR = fem ? 0.38 : 0.46;
  out.push(gem(WF.o, wo, { k: 6, r: wR, h: 0.06, h0: 0.035, table: 0.75, foot: 0.95, mat: 'adS', crown: 'ad', w: () => wKn }));
  const wrim = [...Array(7).keys()].map((k) => ({ p: inFrame(WF, Math.cos((k * PI) / 3) * wR * 0.98, Math.sin((k * PI) / 3) * wR * 0.98, 0.04), n: wo }));
  out.push(tube(wrim, { r: 0.03, k: 4, mat: 'gilt', w: () => wKn }));
  out.push(gem(inFrame(WF, 0, 0, 0.05), wo, { k: 6, r: 0.07, h: 0.07, h0: 0.03, table: 0.4, mat: 'gilt', crown: 'giltL', w: () => wKn }));
  // -- the greave: octagonal round the calf, a ridge down the shin, flared at its foot over the boot
  const cPick = (q) => (sg > 0 ? q.p[0] > 0.12 : q.p[0] < -0.12) && shareW(B, q.w, 'calf') > 0.6;
  const SH = limbWrap(B, kn, an, sg, { t: [0, 1.02], nt: 20, a: [-PI, PI], closed: true, na: 26, pick: cPick, smooth: 4, shape: (r) => r });
  const wCa = skinW(B, (q) => cPick(q) && along(q.p, kn, an) > 0.2 && along(q.p, kn, an) < 0.85, legBones);
  const shin = (a) => 0.09 * Math.max(0, 1 - Math.abs(wrapAngle(a)) / (PI / 4));
  const calf = (t, a) => 0.06 * Math.exp(-(((t - 0.33) / 0.17) ** 2)) * Math.max(0, -Math.cos(a)) ** 1.5;
  const greave = plateOn(SH, { a0: -PI, a1: PI, closed: true, t0: () => 0.87, t1: () => 0.15, nu: 3, nv: 8, off: (u, v, t, a) => 0.14 + shin(a) + calf(t, a) + 0.2 * smooth(0.68, 0.87, t) });
  out.push(solid(greave, { sheet: true, w: () => wCa, mat: (i) => (i === 0 ? 'adM' : 'ad') }));
  out.push(tube(rowPath(greave, 3, 0, 8, 16), { r: 0.04, k: 4, mat: 'adL', w: () => wCa, closed: true }));
  out.push(band(zigzag(rowPath(greave, 2.7, 0, 8, 24), 0.05), { wide: 0.04, high: 0.02, mat: 'gilt', w: () => wCa, closed: true }));
  out.push(tube(rowPath(greave, 0, 0, 8, 16), { r: 0.045, k: 4, mat: 'gilt', w: () => wCa, closed: true }));
  // (gilt down the shin's ridge)
  out.push(band(colPath(greave, 4, 0.4, 2.6, 8), { wide: 0.06, high: 0.025, mat: 'gilt', w: () => wCa }));
  // (the shin's flanking corners polished)
  for (const j of [3, 5]) out.push(tube(colPath(greave, j, 0.3, 2.6, 6), { r: 0.018, k: 3, mat: 'adL', w: () => wCa }));
  return out;
}
/** The culet: two faceted lames over the seat, hung from under the belt behind, the lower lapped over by the upper. */
function culet(B) {
  const M = torsoMarks(B), F = torsoField(B), t = F.tOfY, out = [], wP = boneW(B, 'pelvis');
  const y0 = M.waist - (B.who === 'female' ? 0.12 : 0.16), y1 = M.hip + (B.who === 'female' ? -0.05 : -0.12), h = (y0 - y1) / 2;
  for (let k = 0; k < 2; k++) {
    const top = y0 - h * k + 0.04, bot = top - h - 0.06;
    const g = plateOn(F, { a0: PI - 1.15, a1: PI + 1.15, t0: () => t(bot), t1: () => t(top), nu: 1, nv: 6, off: (u, v) => (k ? 0.22 : 0.13) + 0.12 * (1 - u) + 0.05 * (1 - u) * Math.max(0, 1 - Math.abs(v - 0.5) / 0.5) });
    out.push(solid(g, { hollow: true, w: () => wP, thick: 0.045, mat: () => (k ? 'ad' : 'adF'), edge: 'adS' }));
    out.push(tube(rowPath(g, 0, 0, 6, 12), { r: 0.035, k: 4, mat: k ? 'gilt' : 'adL', w: () => wP }));
    if (k) out.push(band(zigzag(rowPath(g, 0.5, 0.3, 5.7, 18), 0.06), { wide: 0.045, high: 0.02, mat: 'gilt', w: () => wP }));
  }
  return out;
}
export function adamantineLegs(B) {
  const P = merge(smoothWeights(chausses(B), 3, (p) => p[1] > B.at.knee.l[1] + 0.6), ...culet(B), ...legHarness(B, 'l'), ...legHarness(B, 'r'));
  return { P, dropAt: (f) => f.mat === 'mailW' };
}

/* ---- boots ------------------------------------------------------------------------------------------------------- */
/**
 * One foot's sabaton: broad and squat, two faceted lames over the instep and a box toe cut square and blunt, broader
 * than the foot, a gilt plate on the toe's top with a rune cut in it (lit); over a leather shoe on a thick sole.
 */
function sabaton(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, an = A.ankle[s], ball = A.ball[s], out = [], fem = B.who === 'female';
  const fPick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'foot') > 0.6;
  const toes = skinSamples(B).filter(fPick);
  const tip = toes.reduce((b, q) => (q.p[2] > b[2] ? q.p : b), [0, 0, -9]);
  const wFoot = boneW(B, `foot_${s}`), wBall = boneW(B, `ball_${s}`), wHinge = mixW([[wFoot, 0.55], [wBall, 0.45]]);
  // (the foot's own axes: d along it, level; sd out to its outer side; up)
  const d = unit([tip[0] - an[0], 0, tip[2] - an[2]]);
  let sd = unit([d[2], 0, -d[0]]);
  if (sd[0] * sg < 0) sd = mul(sd, -1);
  const o = [an[0], A.floor, an[2]], X = (p) => dot(sub(p, o), d), S = (p) => dot(sub(p, o), sd), Yh = (p) => p[1] - A.floor;
  const at3 = (x, sx, yy) => add(o, add(add(mul(d, x), mul(sd, sx)), [0, yy, 0]));
  const span = (x0, x1) => { const q = toes.filter((t) => X(t.p) > x0 - 0.05 && X(t.p) < x1 + 0.05); return { lo: Math.min(...q.map((t) => S(t.p))), hi: Math.max(...q.map((t) => S(t.p))), top: Math.max(...q.map((t) => Yh(t.p))) }; };
  // (a prism along the foot: rows at the stations given ([x, margin, scale of the top]), columns round a hexagonal
  // section: the sides standing, the top's corners cut, the top flat; open below)
  const yb = 0.16;
  const prism = (rows, sp) => {
    const P = rows.map(([x, m, kt = 1]) => {
      const c = (sp.lo + sp.hi) / 2, w = (sp.hi - sp.lo) / 2 + m, T = (sp.top + m) * kt;
      return [[c - w, yb], [c - w, yb + (T - yb) * 0.6], [c - w * 0.52, T], [c + w * 0.52, T], [c + w, yb + (T - yb) * 0.6], [c + w, yb]].map(([sx, yy]) => at3(x, sx, yy));
    });
    const c = (sp.lo + sp.hi) / 2;
    return gridOf(P, { out: (i, j) => unit(add(mul(sd, [-1, -1, -0.5, 0.5, 1, 1][j]), [0, [0, 0.6, 1, 1, 0.6, 0][j], 0])) });
  };
  const xAnk = X([an[0], 0, an[2]]) + 0.3, xBall = X(ball), xTip = X(tip);
  // -- two lames over the instep, each its own prism, its back edge flared and its foot rolled bright
  const lx = [xAnk, xAnk + (xBall - 0.12 - xAnk) * 0.55, xBall - 0.1];
  for (let k = 0; k < 2; k++) {
    const x0 = lx[k], x1 = lx[k + 1] + 0.05, sp = span(x0, x1), t0 = span(x0 - 0.06, x0 + 0.1).top, t1 = span(x1 - 0.12, x1 + 0.04).top;
    const g = prism([[x0, 0.17 + 0.012 * (1 - k), (t0 + 0.17) / (sp.top + 0.17)], [x0 + 0.04, 0.15 + 0.012 * (1 - k), (t0 + 0.15) / (sp.top + 0.15)], [x1, 0.14 + 0.012 * (1 - k), (t1 + 0.14) / (sp.top + 0.14)]], sp);
    out.push(solid(g, { sheet: true, w: () => wFoot, mat: (i, j) => (j === 2 ? 'adF' : 'ad') }));
    out.push(tube(rowPath(g, 0, 0, 5, 10), { r: 0.03, k: 4, mat: k ? 'adL' : 'gilt', w: () => wFoot }));
    for (const j of [2, 3]) out.push(tube(colPath(g, j, 1, 2, 2), { r: 0.018, k: 3, mat: 'adL', w: () => wFoot }));
  }
  // -- the box toe: a prism broader than the toes, a raised gilt band round its back, its top's corners polished, its
  // front cut square behind a bright bevel
  const x0 = xBall - 0.08, x1 = xTip + (fem ? 0.12 : 0.16), sp = span(xBall - 0.1, xTip), mt = fem ? 0.12 : 0.14;
  const box = prism([[x0, mt + 0.06], [x0 + 0.13, mt + 0.06], [x0 + 0.13, mt], [x1 - 0.07, mt, 1.0], [x1, mt - 0.07, 0.88]], sp);
  out.push(solid(box, { sheet: true, w: (p, i) => (i <= 1 ? wHinge : wBall), mat: (i, j) => (i === 0 ? 'gilt' : i === 1 ? 'giltD' : i === 3 ? 'adM' : j === 2 ? 'adF' : 'ad') }));
  out.push(tube(rowPath(box, 0, 0, 5, 10), { r: 0.03, k: 4, mat: 'giltL', w: () => wHinge }));
  for (const j of [2, 3]) out.push(tube(colPath(box, j, 2, 3, 3), { r: 0.022, k: 3, mat: 'adL', w: () => wBall }));
  // (its front face, and a sole under it)
  {
    const face = part(), ring = box.P[4].map((p) => put(face, p, d, wBall)), cpt = put(face, mul(box.P[4].reduce((a2, p) => add(a2, p), [0, 0, 0]), 1 / 6), d, wBall);
    fan(face, ring, cpt, d, 'ad');
    out.push(tube([...box.P[4], box.P[4][0]].slice(0, 6).map((p) => ({ p, n: d })), { r: 0.022, k: 3, mat: 'adL', w: () => wBall }));
    const under = part(), q = [box.P[0][0], box.P[0][5], box.P[4][5], box.P[4][0]].map((p) => put(under, add(p, [0, -0.01, 0]), [0, -1, 0], wBall));
    out.push(face);
    under.F.push({ v: q, mat: 'sole' }); out.push(under);
  }
  // (the gilt plate on the box's top, a rune cut in it)
  const gp = lerp(box.at(3, 2.5).p, box.at(2, 2.5).p, 0.45), gR = fem ? 0.17 : 0.2;
  const GF = frameAt(add(gp, [0, 0.01, 0]), [0, 1, 0], d);
  out.push(gem(GF.o, [0, 1, 0], { k: 6, r: gR, h: 0.05, h0: 0.025, table: 0.82, foot: 1, mat: 'giltD', crown: 'gilt', top: 'gilt', w: () => wBall, twist: PI / 6 }));
  out.push(...runeOn(frameAt(inFrame(GF, 0, 0, 0.055), [0, 1, 0], d), 'ingwaz', gR * 0.55, { sweep, wide: 0.045, high: 0.025, mat: 'rune', w: () => wBall }));
  // -- the heel cup: faceted plate round the back of the heel, gilt-edged at its top
  {
    const top = [an[0], an[1] - 0.1, an[2] - 0.05], bot = [an[0], A.floor + 0.05, an[2] - 0.15];
    const hPick = (q) => fPick(q) && q.p[2] < an[2] + 0.1;
    const HW = limbWrap(B, top, bot, sg, { t: [0, 1], nt: 8, a: [-PI, PI], closed: true, na: 24, pick: hPick, smooth: 3, shape: (r) => r });
    const cup = plateOn(HW, { a0: PI - 1.3, a1: PI + 1.3, t0: () => 0.04, t1: () => 0.9, nu: 2, nv: 6, off: (u) => 0.1 + 0.03 * u });
    out.push(solid(cup, { sheet: true, w: () => wFoot, mat: (i) => (i ? 'ad' : 'adF') }));
    out.push(tube(rowPath(cup, 0, 0, 6, 12), { r: 0.035, k: 4, mat: 'gilt', w: () => wFoot }));
  }
  return out;
}
/** The leather shoe under the sabatons: the foot and the ankle's foot, close over the skin, on a thick sole. */
function shoe(B) {
  const A = B.at;
  const P = shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'foot', 'calf') > 0.6 && p[1] < A.ankle[s][1] + 0.3; },
    off: ({ n }) => 0.05 + (n[1] < -0.6 ? 0.1 : 0),
    mat: ({ n }) => (n[1] < -0.55 ? 'sole' : 'leather'),
  });
  P.soles = P.V.map((_, i) => i).filter((i) => P.V[i][1] < A.floor + 0.14);
  return P;
}
export function adamantineBoots(B) {
  const P = merge(shoe(B), ...sabaton(B, 'l'), ...sabaton(B, 'r'));
  return P;
}
