// The tin set: the town militia, a burgher's watchman on his town's walls, in his town's livery of mustard and teal,
// built with the plate kit (tools/sculpt/garments/platekit.mjs) and the tin set's own builders
// (tools/sculpt/garments/kit/tin.mjs).
//
//   helm    the chapel de fer: a pointed crown of six gores under riveted straps and a low rolled comb, a broad brim
//           riveted round its root, its lipped edge rolled; a mustard hatband, the town's plaque (a tin key on teal) and
//           a livery cockade; a leather chin strap.
//   chest   the jack, quilted mustard with a padded collar, under a lamed munition breastplate (an upper plate and three
//           lapped lames, rivet rows along each, the town's key raised on it), its straps crossed over the quilted back;
//           padded rolled sleeves in the livery (the left teal, the right mustard) under spaulders of four lames, round
//           couters, tin cuffs over leather gloves; a studded belt and eight quilted skirt panels, each side its sleeve's
//           colour.
//   mantle  the chaperon: a mustard collar, a teal shoulder cape cut in rounded dags counterchanged teal and mustard,
//           the mustard hood fallen back and its teal liripipe down the back to a tassel; at the throat the town's badge,
//           the watch bell raised on pewter over a livery rosette, a little tin bell hung under it.
//   legs    particoloured hose counterchanged against the sleeves, studded leather cuisses, poleyns with a rondel and a
//           boss and ring on the front, demi-greaves strapped round the calf with tin buckles.
//   boots   leather ankle boots: a turned-down cuff cut in dags in the livery, a tin toe cap and heel cup, an instep strap
//           with a tin buckle.
//
// Enchanted, five things light and nothing else: the hatband, the breastplate's key, the badge's bell, the poleyns'
// bosses and rings, and the boots' buckles.
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, smooth, merge, shell, on } from './metalkit.mjs';
import {
  boneW, mixOf, mixW, shareW, skinW, nearSkinW, limbWrap, along, plateOn, solid, tube, band, rowPath, colPath, pathOn, studsAlong, stud, patch, wrapAngle,
  smoothWeights, coverHides, skinSamples, sweep, gridOf, torsoWrap, domeWrap,
} from './platekit.mjs';
import { headDome, headW, torsoField, torsoMarks, TORSO_BONES, keyOf, cockade, frameAt, inFrame, roundP } from './kit/tin.mjs';

const PI = Math.PI;

export const TIN_MATS = {
  // (tin: a bright, slightly blue white, duller than steel; its lames a shade darker, its rolled edges polished near white)
  tn: { c: '#839cb1', kind: 3 },
  tnB: { c: '#5c6c7b', kind: 3 },
  tnM: { c: '#66707a', kind: 3 },
  tnL: { c: '#eef7fd', kind: 3 },
  tnS: { c: '#3f474f', kind: 3 },
  tnD: { c: '#30373d', kind: 3 },
  pewter: { c: '#4b535a', kind: 3 },
  // (the glows: plain, the livery cloth or the tin they are; lit in the enchantment's colour)
  rune: { c: '#cf981c', kind: 0, lit: { c: '#ffe7a6', kind: 1 } },
  runeK: { c: '#4c565e', kind: 3, lit: { c: '#ffe7a6', kind: 1 } },
  runeB: { c: '#d9e2e8', kind: 3, lit: { c: '#ffe7a6', kind: 1 } },
  runeP: { c: '#d9e2e8', kind: 3, lit: { c: '#ffe7a6', kind: 1 } },
  runeS: { c: '#d9e2e8', kind: 3, lit: { c: '#ffe7a6', kind: 1 } },
  mustardW: { c: '#cf981d', kind: 0 },
  tealW: { c: '#17807c', kind: 0 },
  // (the town's livery: mustard and teal)
  mustard: { c: '#cf981c', kind: 0 },
  mustardD: { c: '#8a5c0e', kind: 0 },
  teal: { c: '#17807b', kind: 0 },
  tealD: { c: '#0d4d4a', kind: 0 },
  leather: { c: '#6e4529', kind: 2 },
  leatherD: { c: '#3f281a', kind: 2 },
  sole: { c: '#2a1d16', kind: 2 },
};

/* ---- the helm ----------------------------------------------------------------------------------------------------- */
/**
 * The chapel de fer: a crown standing off the head to a point, of six gores each swelling a little between the
 * riveted straps over their seams, a low comb rolled along its top from the brow to the nape; a mustard hatband round its foot, the town's plaque (a key on
 * teal) on its front and a cockade in the livery on its left; a broad brim sloped down all round, riveted to the crown,
 * its edge rolled; a leather strap under the chin. The face open under the brim. Rigid on the head.
 */
export function tinHelm(B) {
  const female = B.who === 'female', out = [];
  const H = headDome(B, { fit: female ? 0.13 : 0.17, rise: female ? -0.08 : -0.1, wide: female ? 0.08 : 0.12 }), D = H.D, c = H.c;
  const wH = boneW(B, 'head'), w = () => wH;
  const front = (ph) => Math.abs(wrapAngle(ph));
  // -- the crown: its foot a little over the brow before, over the ears at the sides, over the nape behind
  const rimTh = (ph) => { const f = front(ph); return H.browTh - 0.3 + 0.42 * smooth(0.15, PI / 2, f) + 0.2 * smooth(PI / 2, PI - 0.2, f); };
  const NU = 9, NV = 36, GORES = 6;
  const peak = female ? 0.2 : 0.26;
  // (each gore swells between its seams; the crown drawn up to a point under its comb)
  const gore = (u, a) => 0.035 * Math.sin(PI * (((a + PI) / (TAU / GORES)) % 1)) ** 0.8 * Math.sin(PI * Math.min(1, u * 1.1)) ** 0.6;
  const crown = plateOn(D, { a0: -PI, a1: PI, closed: true, t0: () => 0, t1: (a) => rimTh(a) / PI, nu: NU, nv: NV, off: (u, v, tt, a) => peak * (1 - u) ** 2.6 + gore(u, a) });
  out.push(solid(crown, { sheet: true, w, mat: () => 'tn' }));
  // (the straps over the seams at the sides, from the hatband to the comb, each riveted down its length)
  for (let k = 0; k < GORES; k++) {
    const j = (k * NV) / GORES;
    if (j % (NV / 2) === 0) continue;
    const path = colPath(crown, j, 0.9, NU - 0.4, 8, 0.01);
    out.push(band(path, { wide: female ? 0.08 : 0.1, high: 0.03, mat: 'tnM', w }));
    out.push(...studsAlong(colPath(crown, j, 2.4, NU - 1.6, 12, 0.04), 3, { r: 0.04, h: 0.035, k: 4, mat: 'tnL', w }));
  }
  // -- the comb: a low keel standing up the middle from the brow over the point to the nape, its top rolled
  const combPts = [];
  const CN = 20, cI = NU - 3.4;
  for (let k = 0; k <= CN; k++) { const f = k / CN, i = f < 0.5 ? cI * (1 - 2 * f) : cI * (2 * f - 1), q = crown.at(Math.max(0.001, i), f < 0.5 ? NV / 2 : 0); combPts.push(q); }
  const Hc = female ? 0.17 : 0.22, combH = (f) => Hc * (0.3 + 0.7 * Math.sin(PI * f) ** 1.2);
  const comb = patch((u, v) => { const q = combPts[Math.round(u * CN)], f = u; return { p: add(q.p, mul(q.n, combH(f) * v - 0.04)), n: [1, 0, 0] }; }, CN, 1);
  out.push(solid(comb, { w, thick: 0.06, mat: () => 'tnM', inner: 'tnM', edge: 'tnS' }));
  out.push(tube(combPts.map((q, k) => ({ p: add(add(q.p, mul(q.n, combH(k / CN) - 0.01)), [-0.03, 0, 0]), n: q.n })), { r: 0.04, k: 3, mat: 'tnL', w }));
  // -- the hatband: mustard cloth round the crown's foot (lit when enchanted)
  out.push(band(rowPath(crown, NU - 0.75, 0, NV, NV), { wide: female ? 0.15 : 0.18, high: 0.035, mat: 'rune', w, closed: true }));
  // -- the brim: out from the crown's foot, sloped down, broad at the sides and behind, a little shorter before
  const bW = (ph) => { const f = front(ph); return (female ? 0.27 : 0.32) + (female ? 0.22 : 0.28) * smooth(0.2, 1.3, f); };
  const bDrop = (ph) => { const f = front(ph); return (female ? 0.05 : 0.06) + (female ? 0.17 : 0.2) * smooth(0.3, 1.3, f); };
  const BU = 4, BV = 36;
  const brimP = (u, v) => {
    const ph = v * 2 * PI - PI, q = crown.at(NU, v * NV), h = unit([q.p[0] - c[0], 0, q.p[2] - c[2]]);
    return { p: add(add(q.p, mul(h, bW(ph) * u - 0.03 + 0.03 * smooth(0.75, 1, u))), [0, -bDrop(ph) * u ** 1.4 + 0.01 + (female ? 0.05 : 0.06) * smooth(0.7, 1, u), 0]), n: unit(add([0, 1, 0], mul(h, 0.35))) };
  };
  const brim = patch(brimP, BU, BV, { closed: true });
  out.push(solid(brim, { w, thick: 0.05, mat: () => 'tnB', inner: 'tnD', edge: 'tnS' }));
  out.push(tube(rowPath(brim, BU, 0, BV, BV), { r: 0.055, k: 3, mat: 'tnL', w, closed: true }));
  // (a ring of rivets round the brim's root)
  out.push(...studsAlong(rowPath(brim, 0.55, 0, BV, BV * 2, 0.03), 16, { from: 0, to: 15 / 16, r: 0.04, h: 0.035, k: 4, mat: 'tnL', w }));
  // -- the plaque on the front: a heater shield of pewter on the hatband, its rim polished, a tin key on teal
  {
    const q = crown.at(NU - 2.3, NV / 2), F = frameAt(add(q.p, mul(q.n, 0.07)), q.n, [0, 1, 0]), s = female ? 1.35 : 1.6;
    const shield = patch((u, v) => {
      const a = v * 2 * PI, x = Math.sin(a), yv = Math.cos(a);
      // (straight top, round sides drawn to a point below)
      const sx = 0.2 * s * x * (yv < 0 ? 1 - 0.35 * (-yv) ** 2 : 1), sy = 0.2 * s * (yv > 0 ? 0.75 * Math.min(1, yv * 3) : 1.25 * yv);
      return { p: inFrame(F, sy * u, sx * u, 0.03 * (1 - u * u)), n: F.n };
    }, 2, 16, { closed: true });
    out.push(solid(shield, { w, thick: 0.03, mat: (i) => (i === 0 ? 'teal' : 'mustard'), inner: 'tnD', edge: 'tnS' }));
    out.push(tube(rowPath(shield, 2, 0, 16, 16), { r: 0.03, k: 3, mat: 'tnL', w, closed: true }));
    out.push(...keyOf(inFrame(F, -0.01 * s, 0, 0.02), F.n, { up: F.x, L: 0.25 * s, r: 0.03, h: 0.03, mat: 'tnL', w }));
  }
  // -- the cockade on the left of the hatband: teal pleats round mustard, a tin button
  {
    const q = crown.at(NU - 1.5, NV / 2 + NV * 0.2), o = unit(add(q.n, [0, 0.15, 0.1]));
    out.push(cockade(add(q.p, mul(o, 0.05)), o, { R: female ? 0.27 : 0.32, mat: 'teal', mat2: 'mustard', btn: 'tnL', w }));
  }
  // -- the chin strap: leather from under the brim at each side down the cheeks to under the chin
  {
    const pts = [];
    const n = 14;
    for (let k = 0; k <= n; k++) {
      const f = k / n, a = -PI / 2 + PI * f, side = Math.cos(a), sg = Math.sin(a);
      // (down each side, round under the chin: polar angle from the band's to under the jaw, azimuth from the side to the front)
      const th = lerp([rimTh(PI / 2) + 0.05, 0, 0], [female ? 2.62 : 2.68, 0, 0], side ** 0.6)[0], ph = (PI / 2) * sg * (1 - 0.35 * side ** 2) + 0 * side;
      const q = D.ta(th / PI, ph);
      pts.push({ p: add(q.p, mul(q.n, -0.02)), n: q.n });
    }
    out.push(band(pts, { wide: 0.07, high: 0.03, mat: 'leatherD', w }));
  }
  const P = merge(...out);
  // (the head's own polygons under it left out: every corner inside the crown, short of its foot)
  const inside = (i) => { const v = sub(B.V[i], c), th = Math.acos(clamp(unit(v)[1], -1, 1)), ph = Math.atan2(v[0], v[2]); return th < rimTh(ph) - 0.12; };
  B.A.polys.forEach(([v], pi) => { if (v.every((i) => inside(i))) P.hides.add(pi); });
  return P;
}

/* ---- chest & arms --------------------------------------------------------------------------------------------------- */
/** How much of a body point's weight is on the head and the jaw themselves. */
const headOnly = (B, i) => headW(B, B.W[i]);
/** The arm's skin samples on side `s`: of the parts given, more than `k` of their weight. */
const armPick = (B, s, parts, k = 0.6) => (q) => (s === 'l' ? q.p[0] > 0.15 : q.p[0] < -0.15) && shareW(B, q.w, ...parts) > k;
const armBones = (s) => (n) => n.endsWith(`_${s}`);
/** The livery: the body's left in mustard, its right in teal (the hose counterchanged). */
const LIVERY = { l: ['teal', 'tealD'], r: ['mustard', 'mustardD'] };

/** The jack under it all: padded mustard cloth over the torso and the arms to the wrists, the skin under it left out. */
function jack(B) {
  const A = B.at, M = torsoMarks(B);
  return shell(B, {
    sub: 0, rim: null,
    keep: (i) => { const p = B.V[i]; return on(B, i, 'torso', 'shoulder', 'upperarm', 'forearm', 'neck', 'head', 'thigh') > 0.6 && headOnly(B, i) < 0.05 && on(B, i, 'hand') < 0.35 && p[1] > M.waist - 0.3 && on(B, i, 'thigh') < 0.5 && p[1] < A.neck[1] - 0.02; },
    off: ({ p }) => 0.08 + 0.03 * smooth(M.waist, M.hip, p[1]) - 0.035 * smooth(A.neck[1] - 0.6, A.neck[1] - 0.1, p[1]),
    mat: () => 'mustard',
  });
}

/**
 * The breastplate: a rounded upper plate and three lames below it to the waist, each lapped under the one above, their
 * edges rolled and a row of tinned rivets along each; the town's key raised on it (lit when enchanted); no backplate,
 * but leather straps crossed over the jack's quilted back; a broad belt; the jack's skirt below in livery panels.
 */
function breastplate(B) {
  const A = B.at, M = torsoMarks(B), F = torsoField(B), t = F.tOfY, out = [], female = B.who === 'female';
  const W = nearSkinW(B, (s) => shareW(B, s.w, 'torso') > 0.7, (n) => TORSO_BONES.has(n), 0.35);
  const aN = 0.74, side = PI / 2 + 0.02;
  const topF = (a) => { const ax = Math.abs(a), yC = M.neckF + 0.14; if (ax <= aN) return M.neckF + 0.14 * (ax / aN) ** 2; const k = clamp((ax - aN) / (side - aN)); return M.pit + (yC - M.pit) * Math.sqrt(Math.max(0, 1 - k * k)); };
  const chestB = (yy, a) => (female ? 0.07 : 0.1) * Math.exp(-(((yy - lerp(A.chest, [0, M.waist, 0], 0.35)[1]) / 0.9) ** 2)) * Math.max(0, Math.cos(a)) ** 1.5;
  const keel = (a) => 0.04 * Math.exp(-((a / 0.2) ** 2));
  const base = (yy, a) => 0.17 + chestB(yy, a) + keel(a);
  const yS = lerp([0, M.pit, 0], [0, M.waist, 0], female ? 0.42 : 0.4)[1], yW = M.waist - 0.04;
  // -- the upper plate
  const NU = 10, NV = 22;
  const upper = plateOn(F, { a0: -side, a1: side, t0: () => t(yS), t1: (a) => t(topF(a)), nu: NU, nv: NV, off: (u, v, tt, a) => base(F.yOfT(tt), a) + 0.025 * smooth(0.12, 0, u) });
  out.push(solid(upper, { sheet: true, w: W, mat: () => 'tn' }));
  out.push(tube(rowPath(upper, NU, 0, NV, NV), { r: 0.055, k: 3, mat: 'tnL', w: W }));
  out.push(tube(rowPath(upper, 0, 0, NV, NV), { r: 0.045, k: 3, mat: 'tnL', w: W }));
  // (rivets inside the neckline and the armholes, and along its foot)
  out.push(...studsAlong(rowPath(upper, NU - 0.9, 0.6, NV - 0.6, 40, 0.01), 13, { r: 0.038, h: 0.035, k: 4, mat: 'tnL', w: W }));
  // -- the lames: three from the upper plate's foot to the waist, each lapped under the one above, a rivet row on each
  const L = 3, h = (yS - yW) / L;
  for (let k = 0; k < L; k++) {
    const y1 = yS - h * k + 0.07, y0 = yS - h * (k + 1);
    const g = plateOn(F, { a0: -side + 0.04 * k, a1: side - 0.04 * k, t0: () => t(y0), t1: () => t(y1), nu: 3, nv: NV, off: (u, v, tt, a) => base(F.yOfT(tt), a) - 0.012 * (k + 1) + 0.025 * smooth(0.35, 0, u) });
    out.push(solid(g, { hollow: true, w: W, thick: 0.035, mat: () => (k % 2 ? 'tn' : 'tnM'), edge: 'tnS' }));
    out.push(tube(rowPath(g, 0, 0, NV, NV), { r: 0.04, k: 3, mat: 'tnL', w: W }));
    out.push(...studsAlong(rowPath(g, 1.5, 0.5, NV - 0.5, 40, 0.01), 7, { r: 0.04, h: 0.035, k: 4, mat: 'tnL', w: W }));
  }
  // -- the key, raised on the upper plate over the lames (lit when enchanted)
  {
    const q = upper.at(NU * 0.36, NV / 2), o = unit(add(q.n, [0, 0.05, 0]));
    out.push(...keyOf(add(q.p, mul(o, 0.01)), o, { up: [0, 1, 0], L: female ? 0.72 : 0.86, r: 0.04, h: 0.04, mat: 'runeK', w: () => W(q.p) }));
  }
  // -- the skirts: eight panels of the jack below the belt, counterchanged teal and mustard, quilted, their hems bound
  const sTop = M.waist + 0.04, sBot = (a) => M.hip - (female ? 0.42 : 0.4) + (female ? 0.12 : 0.22) * Math.sin(a) ** 2 + 0.12 * smooth(1.5, 2.8, Math.abs(wrapAngle(a)));
  const PN = 8, gap = 0.035;
  const legW = (s) => skinW(B, (q) => q.p[0] * (s === 'l' ? 1 : -1) > 0.12 && shareW(B, q.w, 'thigh') > 0.6 && along(q.p, A.hip[s], A.knee[s]) > 0.15 && along(q.p, A.hip[s], A.knee[s]) < 0.5, armBones(s));
  const wP = mixOf(B, [['pelvis', 0.8], ['spine_01', 0.2]]), wL = legW('l'), wR = legW('r');
  for (let k = 0; k < PN; k++) {
    const a0 = -PI + (2 * PI * k) / PN + gap, a1 = -PI + (2 * PI * (k + 1)) / PN - gap, am = (a0 + a1) / 2;
    const thighSide = Math.sin(am), legSh = 0.5 * Math.max(0, Math.cos(am)) + 0.25;
    const g = plateOn(F, { a0, a1, t0: (a) => t(sBot(a)), t1: () => t(sTop), nu: 4, nv: 4, off: (u, v, tt, a) => 0.16 + (0.17 + 0.1 * Math.sin(a) ** 2) * (1 - u) ** 1.3 });
    const wPanel = (p) => { const f = clamp((sTop - p[1]) / (sTop - sBot(am))) ** 1.5 * legSh; return Math.abs(thighSide) < 0.2 ? mixW([[wP, 1 - f], [wL, f / 2], [wR, f / 2]]) : mixW([[wP, 1 - f], [thighSide > 0 ? wL : wR, f]]); };
    // (each side's panels its sleeve's colour, the hose counterchanged below)
    const [col, colD] = LIVERY[am > 0 ? 'l' : 'r'];
    out.push(solid(g, { w: wPanel, thick: 0.03, mat: () => col, inner: colD, edge: colD }));
    out.push(tube(rowPath(g, 0, 0, 4, 4, 0.005), { r: 0.04, k: 3, mat: colD, w: wPanel }));
    out.push(tube(colPath(g, 2, 0.4, 4, 4, 0.005), { r: 0.025, k: 3, mat: colD, w: wPanel }));
  }
  // -- the belt over the skirts' top: leather, a tin buckle before, tin studs round it
  const belt = plateOn(F, { a0: -PI, a1: PI, closed: true, t0: () => t(sTop - 0.22), t1: () => t(sTop - 0.02), nu: 1, nv: 32, off: () => 0.36 });
  out.push(solid(belt, { hollow: true, w: W, thick: 0.04, mat: () => 'leather', edge: 'leatherD' }));
  for (let k = 0; k < 12; k++) { const j = ((k + 0.5) / 12) * 32; if (Math.abs(j - 16) < 3) continue; const q = belt.at(0.5, j); out.push(stud(q.p, q.n, { r: 0.045, h: 0.035, k: 4, mat: 'tnL', w: () => W(q.p) })); }
  { const q = belt.at(0.5, 16), F2 = frameAt(add(q.p, mul(q.n, 0.02)), q.n, [0, 1, 0]), bx = 0.17, by = 0.13;
    const fr = [[-bx, -by], [bx, -by], [bx, by], [-bx, by], [-bx, -by]].map(([u, v]) => ({ p: inFrame(F2, v, u, 0.02), n: q.n }));
    out.push(sweep(fr, { closedProfile: true, profile: roundP(0.035, 4), mat: 'tnL', w: () => W(q.p) }));
    out.push(tube([{ p: inFrame(F2, 0, -bx, 0.04), n: q.n }, { p: inFrame(F2, 0, bx * 0.4, 0.05), n: q.n }], { r: 0.025, k: 4, mat: 'tnL', w: () => W(q.p) })); }
  // -- the jack's collar: a low padded band standing round the neck's foot, its top bound
  {
    const n = A.neck[1], cb = (a) => n - 0.4 + (female ? 0.16 : 0.2) * Math.sin(a) ** 2;
    const g = plateOn(F, { a0: -PI, a1: PI, closed: true, t0: (a) => t(cb(a)), t1: (a) => t(cb(a) + 0.17), nu: 2, nv: 28, maxUp: 0.2, off: (u, v, tt, a) => 0.09 + 0.03 * Math.max(0, Math.cos(a)) + 0.04 * Math.sin(a) ** 2 + 0.03 * (1 - u) });
    const wNs = nearSkinW(B, (q) => shareW(B, q.w, 'torso', 'neck') > 0.8 && headW(B, q.w) < 0.1 && q.p[1] > A.neck[1] - 0.9, (nm) => ['spine_03', 'neck_01', 'clavicle_l', 'clavicle_r'].includes(nm), 0.3), wN = (p) => wNs(p);
    out.push(smoothWeights(solid(g, { w: wN, thick: 0.03, mat: () => 'mustard', inner: 'mustardD', edge: 'mustardD' }), 2));
    out.push(tube(rowPath(g, 2, 0, 28, 28), { r: 0.035, k: 3, mat: 'mustardD', w: wN, closed: true }));
  }
  // -- the jack's back, quilted in channels down it, and the breastplate's straps crossed over it
  const back = [];
  for (let j = 0; j < 9; j++) {
    const a = PI / 2 + 0.35 + ((PI - 0.7) * j) / 8;
    const path = [...Array(7).keys()].map((k) => { const yy = M.waist + 0.15 + ((M.neckB - 0.35 - M.waist - 0.15) * k) / 6, q = F.ta(t(yy), a); return { p: add(q.p, mul(q.n, 0.1)), n: q.n }; });
    back.push(tube(path, { r: 0.028, k: 3, mat: 'mustardD', w: W }));
  }
  out.push(...back);
  for (const sg of [1, -1]) {
    const pts = [...Array(11).keys()].map((k) => { const f = k / 10, yy = lerp([0, M.pit + 0.25, 0], [0, M.waist + 0.08, 0], f)[1], a = PI - sg * (0.9 - 1.8 * f) * 0.62, q = F.ta(t(yy), a); return { p: add(q.p, mul(q.n, 0.14)), n: q.n }; });
    out.push(band(pts, { wide: 0.16, high: 0.035, mat: 'leather', w: W }));
    out.push(...studsAlong(pts, 3, { from: 0.15, to: 0.85, r: 0.04, h: 0.03, k: 4, mat: 'tnL', w: W }));
  }
  return { parts: out, W, F, M, upper };
}

/**
 * One arm: the quilted sleeve over the jack in rolls (the left teal, the right mustard), a spaulder of four tin lames
 * over the shoulder, a round couter at the elbow with its boss, a tin cuff at the wrist over a leather glove's cuff.
 */
function armOf(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, sh = A.shoulder[s], el = A.elbow[s], wr = A.wrist[s], out = [], female = B.who === 'female';
  const [col, colD] = LIVERY[s];
  const upPick = armPick(B, s, ['upperarm', 'shoulder']);
  const UA = limbWrap(B, sh, el, sg, { t: [-0.1, 1.0], nt: 22, a: [-PI, PI], closed: true, na: 24, pick: upPick, smooth: 3, shape: (r) => r });
  const wUp = skinW(B, (q) => upPick(q) && along(q.p, sh, el) > 0.3 && along(q.p, sh, el) < 0.8, armBones(s));
  const wSh = mixOf(B, [[`shoulder_${s}`, 0.5], [`upperarm_${s}`, 0.2], [`clavicle_${s}`, 0.3]]);
  const wArm = (p) => { const f = smooth(-0.05, 0.6, along(p, sh, el)); return mixW([[wSh, 1 - f], [wUp, f]]); };
  // -- the sleeve's rolls: padded, swelling most on the outside, a dark seam between each
  const outside = (a) => 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(a)) ** 0.8;
  const rolls = (W0, t0, t1, n, big, w) => {
    const hh = (t1 - t0) / n;
    for (let k = 0; k < n; k++) {
      const a0 = t0 + hh * k, a1 = a0 + hh;
      const g = plateOn(W0, { a0: -PI, a1: PI, closed: true, t0: () => a0, t1: () => a1, nu: 3, nv: 14, off: (u, v, tt, a) => 0.08 + big * Math.sin(PI * u) ** 0.7 * outside(a) });
      out.push(solid(g, { sheet: true, w, mat: () => col }));
      out.push(tube(rowPath(g, 0, 0, 14, 14, 0.0), { r: 0.025, k: 3, mat: colD, w, closed: true }));
    }
  };
  rolls(UA, 0.12, 0.84, 5, female ? 0.07 : 0.09, wArm);
  // -- the spaulder: four lames down the outside of the shoulder, each stepped out over the one below, riveted
  for (let k = 0; k < 4; k++) {
    const t0 = 0.0 + 0.085 * k, t1 = t0 + 0.14, off = 0.32 - 0.04 * k;
    const g = plateOn(UA, { a0: PI / 2 - 1.75 + 0.1 * k, a1: PI / 2 + 1.75 - 0.1 * k, t0: () => t0, t1: () => t1, nu: 2, nv: 14, off: () => off });
    out.push(solid(g, { sheet: true, w: () => wSh, mat: () => (k % 2 ? 'tnM' : 'tn') }));
    out.push(tube(rowPath(g, 0, 0, 14, 14), { r: 0.035, k: 3, mat: 'tnL', w: () => wSh }));
    out.push(...studsAlong(rowPath(g, 1, 0.8, 13.2, 14, 0.01), 2, { r: 0.04, h: 0.035, k: 4, mat: 'tnL', w: () => wSh }));
  }
  // (the cap over the shoulder's top under the lames)
  const cap = plateOn(UA, { a0: PI / 2 - 1.75, a1: PI / 2 + 1.75, t0: () => -0.1, t1: () => 0.06, nu: 2, nv: 14, off: (u) => 0.2 + 0.14 * u });
  out.push(solid(cap, { sheet: true, w: () => wSh, mat: () => 'tn' }));
  // -- the couter: a round plate on the elbow's point, its rim rolled, a boss in its middle
  const upDir = unit(sub(el, sh)), foreDir = unit(sub(wr, el)), uaLen = len(sub(el, sh)), faLen = len(sub(wr, el));
  const c0 = sub(el, mul(upDir, uaLen * 0.2)), c1 = add(el, mul(foreDir, faLen * 0.2));
  const elPick = (q) => armPick(B, s, ['upperarm', 'forearm'], 0.6)(q) && len(sub(q.p, el)) < 0.9;
  const EL = limbWrap(B, c0, c1, sg, { t: [0, 1], nt: 10, a: [-PI, PI], closed: true, na: 24, pick: elPick, smooth: 3, shape: (r) => r });
  const wEl = boneW(B, `elbow_${s}`);
  const cup = plateOn(EL, { a0: 1.1, a1: 2 * PI - 1.1, t0: () => 0.06, t1: () => 0.94, nu: 5, nv: 12, off: (u, v) => 0.17 + 0.06 * Math.sin(PI * u) * Math.sin(PI * v) });
  out.push(solid(cup, { sheet: true, w: () => wEl, mat: () => 'tnM' }));
  const ec = EL.ta(0.5, PI - 0.25 * sg), eo = unit(add(ec.n, mul(upDir, 0.0))), rR = female ? 0.22 : 0.28;
  const disc = patch((u, v) => { const a = v * 2 * PI, rr = rR * (0.1 + 0.9 * u); return { p: add(add(ec.p, mul(eo, 0.22 + 0.05 * (1 - u * u))), add(mul(unit(cross(eo, foreDir)), Math.cos(a) * rr), mul(unit(cross(eo, unit(cross(eo, foreDir)))), Math.sin(a) * rr))), n: eo }; }, 2, 14, { closed: true });
  out.push(solid(disc, { w: () => wEl, thick: 0.035, mat: () => 'tn', inner: 'tnD', edge: 'tnS' }));
  out.push(tube(rowPath(disc, 2, 0, 14, 14), { r: 0.035, k: 3, mat: 'tnL', w: () => wEl, closed: true }));
  out.push(stud(add(ec.p, mul(eo, 0.26)), eo, { r: 0.08, h: 0.07, k: 5, mat: 'tnL', w: () => wEl }));
  // -- the forearm's rolls, the leather glove's cuff and the tin cuff over it
  const faPick = armPick(B, s, ['forearm'], 0.6);
  const FA = limbWrap(B, el, wr, sg, { t: [0, 1.04], nt: 14, a: [-PI, PI], closed: true, na: 22, pick: faPick, smooth: 3, shape: (r) => r });
  const wFa = skinW(B, (q) => faPick(q) && along(q.p, el, wr) > 0.25 && along(q.p, el, wr) < 0.85, armBones(s));
  rolls(FA, 0.2, 0.66, 3, female ? 0.05 : 0.06, () => wFa);
  const wWr = mixOf(B, [[`hand_${s}`, 0.35], [`wrist_${s}`, 0.3], [`lowerarm_${s}`, 0.35]]);
  const glove = plateOn(FA, { a0: -PI, a1: PI, closed: true, t0: () => 0.64, t1: () => 0.99, nu: 3, nv: 18, off: (u) => 0.11 + 0.1 * u });
  out.push(solid(glove, { sheet: true, w: () => wWr, mat: () => 'leather' }));
  const cuff = plateOn(FA, { a0: -PI, a1: PI, closed: true, t0: () => 0.66, t1: () => 0.86, nu: 2, nv: 18, off: (u) => 0.15 + 0.05 * u });
  out.push(solid(cuff, { sheet: true, w: () => wFa, mat: () => 'tn' }));
  out.push(tube(rowPath(cuff, 2, 0, 18, 12), { r: 0.035, k: 3, mat: 'tnL', w: () => wFa, closed: true }));
  out.push(tube(rowPath(cuff, 0, 0, 18, 12), { r: 0.03, k: 3, mat: 'tnL', w: () => wFa, closed: true }));
  return out;
}

export function tinChest(B) {
  const T = breastplate(B);
  return coverHides(B, merge(smoothWeights(jack(B), 2, (p) => p[1] < B.at.neck[1] - 0.6), ...T.parts, ...armOf(B, 'l'), ...armOf(B, 'r')), 0.5);
}


/* ---- the shawl ------------------------------------------------------------------------------------------------------ */
/** A bell's outline: its half width at height `f` (nought its mouth, one its crown), as a fraction of its mouth's. */
const bellW = (f) => (f < 0.12 ? 1 - 0.25 * (f / 0.12) ** 0.6 : 0.75 - 0.3 * ((f - 0.12) / 0.88) ** 1.4 + 0.05 * Math.sin(PI * clamp((f - 0.12) / 0.88)));

/**
 * The chaperon: the militia's livery hood worn down. A standing collar of mustard round the neck; the shoulder cape of
 * teal lined in mustard over the spaulders, its hem cut into rounded dags counterchanged teal and mustard; the hood
 * fallen back as a roll behind the neck and its liripipe hanging down the back to a mustard tassel; at the throat the
 * town's badge, a pewter roundel ringed in tin rivets with the watch bell raised on it (lit when enchanted) and a
 * little tin bell hung under it.
 */
export function tinMantle(B) {
  const A = B.at, M = torsoMarks(B), F = torsoField(B), zc = F.zc, out = [], female = B.who === 'female';
  const n = A.neck[1];
  // (the envelope it is laid over: the chest piece's upper parts and the skin there, hung as cloth falls)
  const T = breastplate(B), L = armOf(B, 'l'), R = armOf(B, 'r'), J = jack(B);
  const lowArm = (w) => w.some(([b, x]) => x > 0.3 && /(lowerarm|elbow|hand|wrist)/.test(B.bones[b].name));
  const legW = (w) => w.some(([b, x]) => x > 0.2 && /(thigh|calf)/.test(B.bones[b].name));
  const pts = [];
  for (const P of [...T.parts, ...L, ...R, J]) P.V.forEach((p, i) => { if (!lowArm(P.W[i]) && !legW(P.W[i]) && p[1] > M.pit - 0.9) pts.push(p); });
  for (const q of skinSamples(B)) if (shareW(B, q.w, 'torso', 'neck', 'shoulder', 'upperarm') > 0.8 && headW(B, q.w) < 0.15 && q.p[1] > M.pit - 0.9) pts.push(q.p);
  const cy0 = M.waist + 0.2, cy1 = n + 0.35, ct = (yy) => (yy - cy0) / (cy1 - cy0);
  const C = torsoWrap(B, cy0, cy1, zc, {
    points: pts, nt: 70, na: 72, closed: true, a: [-PI, PI], smooth: 3, minDa: 0.1, empty: 0.3,
    post: (Rr) => { for (let j = 0; j < Rr[0].length; j++) for (let i = Rr.length - 2; i >= 0; i--) Rr[i][j] = Math.max(Rr[i][j], Rr[i + 1][j]); },
    shape: (r, t, a) => r + 0.08 - 0.05 * Math.max(0, Math.cos(a)) ** 2,
  });
  const W = nearSkinW(B, (q) => shareW(B, q.w, 'torso', 'neck') > 0.8 && headW(B, q.w) < 0.2 && q.p[1] > M.pit - 0.4, (nm) => ['spine_03', 'spine_02', 'neck_01', 'clavicle_l', 'clavicle_r'].includes(nm), 0.35);
  const shOf = (s) => mixOf(B, [[`shoulder_${s}`, 0.5], [`upperarm_${s}`, 0.2], [`clavicle_${s}`, 0.3]]);
  // (over the shoulders the spaulders' weights, toward the middle the torso's)
  const wTop = (p) => { const k = smooth(0.95, 1.9, Math.abs(p[0])); return mixW([[W(p), 1 - k], [shOf(p[0] > 0 ? 'l' : 'r'), k]]); };
  const front = (a) => Math.abs(wrapAngle(a));
  // -- the collar: a standing band of mustard round the neck's foot
  const cBot = n - 0.34, cBotA = (a) => cBot + (female ? 0.2 : 0.24) * Math.sin(a) ** 2, cTopA = (a) => cBotA(a) + 0.24 - 0.06 * Math.sin(a) ** 2;
  // -- the cape: from under the collar over the shoulders; its hem at the upper chest before, over the upper arm at the
  // sides, across the shoulder blades behind
  const DAGS = 18;
  const hem = (a) => { const f = front(a), sd = Math.sin(f) ** 2; return lerp([0, M.neckF - (female ? 0.26 : 0.22), 0], [0, M.neckB - (female ? 0.7 : 0.78), 0], smooth(0.3, 2.6, f))[1] - (female ? 0.1 : 0.16) * sd + shFront(a) * (female ? 0.22 : 0.3); };
  const shFront = (a) => Math.exp(-(((front(a) - 1.05) / 0.42) ** 2));
  const NU = 8, NV = 64;
  const capeOff = (u, v, tt, a) => 0.06 + 0.04 * (1 - u) + 0.07 * (1 - u) ** 1.5 * (0.5 - 0.5 * Math.cos(DAGS * a)) * (1 - 0.6 * Math.max(0, Math.cos(a)) ** 2);
  const cape = plateOn(C, { a0: -PI, a1: PI, closed: true, t0: (a) => ct(hem(a)), t1: (a) => ct(cBotA(a) + 0.05), nu: NU, nv: NV, off: capeOff });
  const capeP = smoothWeights(solid(cape, { sheet: true, w: wTop, mat: () => 'teal' }), 6);
  out.push(capeP);
  const onCape = (p) => capeP.W[nearestIn(capeP.V, p)];
  // (a cord along its hem, over the dags' roots)
  out.push(tube(rowPath(cape, 0.15, 0, NV, NV, 0.02), { r: 0.04, k: 3, mat: 'mustardD', w: onCape, closed: true }));
  // -- the dags: rounded leaves hung from the hem, counterchanged, each flared out a little more than the cape
  const dl = female ? 0.5 : 0.6;
  for (let k = 0; k < DAGS; k++) {
    const ac = -PI + (2 * PI * (k + 0.5)) / DAGS, hw = PI / DAGS * 0.98;
    const outline = (a) => { const x = clamp(Math.abs(a - ac) / hw); return Math.sqrt(Math.max(0, 1 - x ** 2)); };
    const g = plateOn(C, { a0: ac - hw, a1: ac + hw, t0: (a) => ct(hem(a) - dl * (1 - (female ? 0.3 : 0.15) * Math.sin(a) ** 2 - 0.12 * Math.max(0, Math.cos(a)) ** 2 - 0.3 * shFront(a)) * (0.25 + 0.75 * outline(a))), t1: (a) => ct(hem(a) + 0.08), nu: 3, nv: 6, off: (u, v, tt, a) => capeOff(0, 0, 0, a) + 0.015 + 0.08 * (1 - u) ** 1.5 });
    const col = k % 2 ? 'mustard' : 'teal', inner = k % 2 ? 'teal' : 'mustard';
    out.push(Math.cos(ac) > 0.3 ? solid(g, { sheet: true, w: onCape, mat: () => col }) : solid(g, { w: onCape, thick: 0.02, mat: () => col, inner, edge: k % 2 ? 'mustardD' : 'tealD' }));
  }
  // -- the collar
  const collar = plateOn(C, { a0: -PI, a1: PI, closed: true, t0: (a) => ct(cBotA(a)), t1: (a) => ct(cTopA(a)), nu: 2, nv: 32, maxUp: 0.2, off: (u, v, tt, a) => 0.15 + 0.06 * (1 - u) + 0.06 * Math.max(0, Math.cos(a)) ** 0.5 });
  const wNeck0 = mixOf(B, [['neck_01', 0.5], ['spine_03', 0.5]]);
  const wNeck = (p) => { const k = 0.45 * smooth(0.3, 1.0, Math.abs(p[0])); return mixW([[wNeck0, 1 - k], [mixOf(B, [[`clavicle_${p[0] > 0 ? 'l' : 'r'}`, 1]]), k]]); };
  out.push(solid(collar, { w: wNeck, thick: 0.03, mat: () => 'mustard', inner: 'mustardD', edge: 'mustardD' }));
  out.push(tube(rowPath(collar, 2, 0, 32, 32), { r: 0.04, k: 3, mat: 'tealD', w: wNeck, closed: true }));
  // -- the hood fallen back on the cape: a pointed bag lying down the back from the collar, puffed, a seam down its
  // middle, its face's opening a mustard roll round the back of the neck
  const hTop = cBot + 0.02, hLen = female ? 0.95 : 1.15, hHalf = female ? 0.78 : 0.85;
  const hw = (yy) => hHalf * clamp((yy - (hTop - hLen)) / hLen) ** 0.75;
  const hBot = (a) => { const x = clamp(Math.abs(wrapAngle(a - PI)) / hHalf); return hTop - hLen * (1 - x ** (1 / 0.75)); };
  const HU = 6, HV = 12;
  const hood = plateOn(C, { a0: PI - hHalf, a1: PI + hHalf, t0: (a) => ct(Math.min(hBot(a), hTop - 0.08)), t1: () => ct(hTop), nu: HU, nv: HV, off: (u, v, tt, a) => 0.15 + 0.05 * (1 - u) + (female ? 0.12 : 0.15) * Math.sin(PI * Math.min(1, u * 1.15)) ** 0.8 * Math.sin(PI * v) ** 0.6 });
  out.push(solid(hood, { w: (p) => onCape(p), thick: 0.025, mat: () => 'mustard', inner: 'teal', edge: 'mustardD' }));
  out.push(tube(colPath(hood, HV / 2, 0.2, HU - 0.3, 6, 0.01), { r: 0.03, k: 3, mat: 'mustardD', w: (p) => onCape(p) }));
  out.push(tube(rowPath(hood, HU, 0, HV, HV, 0.03), { r: female ? 0.07 : 0.08, k: 4, mat: 'teal', w: (p) => onCape(p) }));
  // -- the liripipe: from the hood's point down the back, hanging, tapering, to a mustard tassel
  const wSp = (p) => { const f = smooth(M.neckB - 0.6, M.waist - 0.2, p[1]); return mixW([[W(p), 1 - f], [mixOf(B, [['spine_02', 0.3], ['spine_01', 0.4], ['pelvis', 0.3]]), f]]); };
  const lip = [], LN = 10, yEnd = lerp([0, M.pit, 0], [0, M.waist, 0], female ? 0.2 : 0.62)[1];
  const hp = hood.at(0, HV / 2), start = add(hp.p, mul(hp.n, -0.02));
  // (hung straight down from the hood's point, as far out as keeps it and its tassel clear of the back below)
  let zEnd = start[2];
  for (let yy = start[1]; yy > yEnd - 0.55; yy -= 0.05) { const q = F.ta(F.tOfY(yy), PI); zEnd = Math.min(zEnd, q.p[2] - 0.36, q.p[2] + q.n[2] * 0.4 - 0.2); }
  const end = [0, yEnd, zEnd];
  for (let k = 0; k <= LN; k++) {
    const f = k / LN;
    let p = lerp(start, end, f ** 0.6);
    p = [p[0], start[1] + (yEnd - start[1]) * f, p[2]];
    // (never nearer the back than the jack and its straps allow)
    const q = F.ta(F.tOfY(p[1]), PI), d = dot(sub(p, q.p), q.n);
    if (d < 0.3) p = add(p, mul(q.n, 0.3 - d));
    lip.push({ p, n: [0, 0, -1] });
  }
  out.push(sweep(lip, { closedProfile: true, mat: 'teal', w: wSp, profile: (k) => roundP((female ? 0.15 : 0.18) * (1 - 0.4 * (k / LN)), 5) }));
  // (a mustard band and the tassel at its end)
  const tip = lip[LN].p, td = [0, -1, 0];
  out.push(stud(sub(tip, mul(td, 0.06)), td, { r: 0.1, h: 0.1, k: 5, mat: 'mustardD', w: () => wSp(tip) }));
  out.push(sweep([0, 1, 2, 3].map((k) => ({ p: add(tip, mul(td, 0.06 + 0.12 * k)), n: [0, 0, -1] })), { closedProfile: true, mat: 'mustard', w: () => wSp(tip), profile: (k) => roundP([0.06, 0.12, 0.14, 0.07][k], 5) }));
  // -- the town's badge at the throat, pinning the cape: a pewter roundel, its rim polished, a ring of rivets, the watch
  // bell raised on it (lit when enchanted); a little tin bell hung under it on a ring
  const bq = C.ta(ct(cBot - (female ? 0.24 : 0.27)), 0), bo = unit(add(bq.n, [0, 0.0, 0.25])), Fb = frameAt(add(bq.p, mul(bq.n, 0.29)), bo, [0, 1, 0]);
  const bR = female ? 0.36 : 0.44, wB = (p) => onCape(bq.p);
  // (behind it a rosette of livery ribbon, mustard round teal, so the badge reads from afar)
  out.push(cockade(inFrame(Fb, 0, 0, -0.03), bo, { R: bR * 1.45, pleats: 10, mat: 'mustard', mat2: 'mustard', btn: 'teal', w: wB }));
  const roundel = patch((u, v) => { const a = v * 2 * PI, rr = bR * (0.1 + 0.9 * u); return { p: inFrame(Fb, Math.cos(a) * rr, Math.sin(a) * rr, 0.05 * (1 - u * u)), n: bo }; }, 3, 20, { closed: true });
  out.push(solid(roundel, { w: wB, thick: 0.04, mat: () => 'pewter', inner: 'tnD', edge: 'tnS' }));
  out.push(tube(rowPath(roundel, 3, 0, 20, 20), { r: 0.045, k: 3, mat: 'tnL', w: wB, closed: true }));
  for (let k = 0; k < 6; k++) { const q = roundel.at(2.55, (k * 20) / 6 + 1.7); out.push(stud(q.p, q.n, { r: 0.035, h: 0.03, k: 3, mat: 'tnL', w: wB })); }
  // (the bell raised on it: its outline swept as a flat plate, its mouth's lip and its crown's loop)
  const bh = bR * 1.15, bw = bR * 0.5;
  const bell = patch((u, v) => { const f = u, x = (v * 2 - 1) * bw * bellW(f); return { p: inFrame(Fb, -bh * 0.5 + bh * 0.85 * f, x, 0.07 + 0.02 * Math.cos(PI * (v - 0.5))), n: bo }; }, 5, 4);
  out.push(solid(bell, { w: wB, thick: 0.03, mat: () => 'runeB', inner: 'tnD', edge: 'runeB' }));
  out.push(tube([...Array(7).keys()].map((k) => { const a = PI * (k / 6); return { p: inFrame(Fb, bh * 0.38 + Math.sin(a) * bw * 0.28, -Math.cos(a) * bw * 0.28, 0.08), n: bo }; }), { r: 0.022, k: 3, mat: 'runeB', w: wB }));
  out.push(tube([{ p: inFrame(Fb, -bh * 0.5, -bw * 1.05, 0.09), n: bo }, { p: inFrame(Fb, -bh * 0.5, bw * 1.05, 0.09), n: bo }], { r: 0.025, k: 3, mat: 'runeB', w: wB }));
  // (the little bell hung under the badge: a tin cup on a ring, mouth down, a clapper)
  const hb = inFrame(Fb, -bR - 0.07, 0, 0.02), hr = female ? 0.11 : 0.13;
  out.push(tube([...Array(7).keys()].map((k) => { const a = (k / 6) * TAU; return { p: add(hb, add(mul(Fb.x, Math.cos(a) * 0.05), mul(Fb.n, Math.sin(a) * 0.05))), n: Fb.x }; }), { r: 0.016, k: 3, mat: 'tnL', w: wB, closed: true }));
  const cupC = add(hb, mul(Fb.x, -0.07));
  const cup = patch((u, v) => { const a = v * TAU, f = 1 - u, rr = hr * bellW(f) * (u > 0.05 ? 1 : 0.2); return { p: add(add(cupC, mul(Fb.x, -hr * 1.7 * u)), add(mul(Fb.y, Math.cos(a) * rr), mul(Fb.n, Math.sin(a) * rr))), n: unit(add(mul(Fb.y, Math.cos(a)), mul(Fb.n, Math.sin(a)))) }; }, 4, 8, { closed: true });
  out.push(solid(cup, { sheet: true, w: wB, mat: (i) => (i === 3 ? 'tnL' : 'tn') }));
  out.push(stud(add(cupC, mul(Fb.x, -hr * 1.75)), mul(Fb.x, -1), { r: 0.035, h: 0.04, k: 4, mat: 'tnD', w: wB }));
  return coverHides(B, merge(...out), 0.6);
}
/** The nearest of points `V` to `p`: its index. */
const nearestIn = (V, p) => { let b = 0, d = Infinity; V.forEach((q, i) => { const x = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2; if (x < d) { d = x; b = i; } }); return b; };


/* ---- legs ----------------------------------------------------------------------------------------------------------- */
/** The hose: particoloured, the left leg mustard and the right teal, close over the hips and the legs to the ankles; its waist left out under any chest piece. */
function hose(B) {
  const A = B.at, M = torsoMarks(B);
  return shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'thigh', 'calf', 'torso', 'foot') > 0.6 && (on(B, i, 'thigh', 'calf', 'torso') > 0.6 || p[1] > A.ankle[s][1] + 0.05) && (on(B, i, 'foot') < 0.5 || p[1] > A.ankle[s][1] + 0.05) && on(B, i, 'upperarm', 'forearm', 'hand', 'shoulder') < 0.05 && p[1] < M.waist + 0.25 && p[1] > A.ankle[s][1] - 0.05; },
    off: () => 0.035,
    mat: ({ p }) => { const m = p[0] >= 0 ? HOSE.l : HOSE.r; return p[1] > M.hip + 0.05 ? `${m}W` : m; },
  });
}
/** The hose counterchanged against the sleeves. */
const HOSE = { l: 'mustard', r: 'teal' };

/**
 * One leg: the poleyn (a cop over the knee between a lame above and below, a rondel on its outside like the couters',
 * a boss on its front lit when enchanted), the demi-greave down the front of the shin (a ridge down it, its edges
 * rolled, riveted) strapped round the calf with two leather straps and tin buckles.
 */
function legOf(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, hp = A.hip[s], kn = A.knee[s], an = A.ankle[s], out = [], female = B.who === 'female';
  const legBones = (nm) => nm.endsWith(`_${s}`);
  // -- the poleyn
  const kPick = (q) => q.p[0] * sg > 0.12 && shareW(B, q.w, 'thigh', 'calf') > 0.8 && len(sub(q.p, kn)) < 0.9;
  const k0 = lerp(hp, kn, 0.8), k1 = lerp(kn, an, 0.16);
  const KN = limbWrap(B, k0, k1, sg, { t: [0, 1], nt: 10, a: [-PI, PI], closed: true, na: 28, pick: kPick, smooth: 4, shape: (r) => r });
  const wKn = boneW(B, `knee_${s}`);
  const cop = plateOn(KN, { a0: -1.55, a1: 1.55, t0: () => 0.2, t1: () => 0.8, nu: 6, nv: 12, off: (u, v) => 0.17 + 0.09 * Math.sin(PI * u) * Math.sin(PI * v) ** 0.7 });
  out.push(solid(cop, { sheet: true, w: () => wKn, mat: () => 'tn' }));
  out.push(tube(rowPath(cop, 0, 0, 12, 12), { r: 0.035, k: 3, mat: 'tnL', w: () => wKn }));
  out.push(tube(rowPath(cop, 6, 0, 12, 12), { r: 0.035, k: 3, mat: 'tnL', w: () => wKn }));
  // (a lame above and one below, each lapped under the cop)
  const wTh = skinW(B, (q) => q.p[0] * sg > 0.12 && shareW(B, q.w, 'thigh') > 0.6 && along(q.p, hp, kn) > 0.55 && along(q.p, hp, kn) < 0.9, legBones);
  const wCa = skinW(B, (q) => q.p[0] * sg > 0.12 && shareW(B, q.w, 'calf') > 0.6 && along(q.p, kn, an) > 0.1 && along(q.p, kn, an) < 0.4, legBones);
  for (const [t0, t1, w] of [[0.02, 0.24, wTh], [0.76, 0.98, wCa]]) {
    const g = plateOn(KN, { a0: -1.35, a1: 1.35, t0: () => t0, t1: () => t1, nu: 2, nv: 10, off: () => 0.15 });
    out.push(solid(g, { sheet: true, w: () => w, mat: () => 'tnM' }));
    out.push(tube(rowPath(g, t0 < 0.5 ? 0 : 2, 0, 10, 10), { r: 0.03, k: 3, mat: 'tnL', w: () => w }));
  }
  // (the boss on its front, lit when enchanted)
  const kc = cop.at(3, 6), ko = unit(add(kc.n, [0, 0.1, 0]));
  out.push(stud(add(kc.p, mul(ko, 0.0)), ko, { r: female ? 0.1 : 0.12, h: 0.08, k: 6, mat: 'runeP', w: () => wKn }));
  out.push(tube([...Array(11).keys()].map((k) => { const a = (k / 10) * TAU, F2 = frameAt(kc.p, ko), rr = female ? 0.19 : 0.22; return { p: inFrame(F2, Math.cos(a) * rr, Math.sin(a) * rr, 0.01), n: ko }; }), { r: 0.035, k: 3, mat: 'runeP', w: () => wKn, closed: true }));
  // (the rondel on its outside)
  const rq = KN.ta(0.5, PI / 2), ro = unit(add(rq.n, [0, 0, 0.25])), rR = female ? 0.22 : 0.26, Fr = frameAt(add(rq.p, mul(ro, 0.24)), ro, unit(sub(kn, hp)));
  const disc = patch((u, v) => { const a = v * 2 * PI, rr = rR * (0.1 + 0.9 * u); return { p: inFrame(Fr, Math.cos(a) * rr, Math.sin(a) * rr, 0.05 * (1 - u * u)), n: ro }; }, 2, 14, { closed: true });
  out.push(solid(disc, { w: () => wKn, thick: 0.035, mat: () => 'tn', inner: 'tnD', edge: 'tnS' }));
  out.push(tube(rowPath(disc, 2, 0, 14, 14), { r: 0.035, k: 3, mat: 'tnL', w: () => wKn, closed: true }));
  out.push(stud(inFrame(Fr, 0, 0, 0.05), ro, { r: 0.07, h: 0.06, k: 5, mat: 'tnL', w: () => wKn }));
  // -- the cuisse: studded leather over the front and outside of the thigh, from under the skirts to the poleyn, its
  // edges bound, tinned studs in rows on it, strapped behind
  {
    const thPick = (q) => q.p[0] * sg > 0.06 && shareW(B, q.w, 'thigh') > 0.7;
    const TH = limbWrap(B, hp, kn, sg, { t: [0.2, 1.0], nt: 12, a: [-PI, PI], closed: true, na: 24, pick: thPick, smooth: 4, shape: (r) => r });
    const wT = skinW(B, (q) => thPick(q) && along(q.p, hp, kn) > 0.3 && along(q.p, hp, kn) < 0.85, legBones);
    const CU = 6, CV = 10, a0 = -1.0, a1 = 1.9;
    const cu = plateOn(TH, { a0, a1, t0: () => 0.86, t1: (a) => 0.36 + 0.06 * Math.cos(a - 0.45), nu: CU, nv: CV, off: (u, v) => 0.08 + 0.025 * Math.sin(PI * v) });
    out.push(solid(cu, { sheet: true, w: () => wT, mat: () => 'leather' }));
    out.push(tube(pathOn(cu, [...[...Array(CU + 1).keys()].map((i) => [i, 0]), ...[...Array(CV + 1).keys()].map((j) => [CU, j]), ...[...Array(CU + 1).keys()].map((i) => [CU - i, CV]), ...[...Array(CV + 1).keys()].map((j) => [0, CV - j])], 0.005), { r: 0.035, k: 3, mat: 'leatherD', w: () => wT }));
    for (const fi of [1.5, 3, 4.5]) out.push(...studsAlong(rowPath(cu, fi, 1.2, CV - 1.2, 10, 0.01), 4, { r: 0.04, h: 0.035, k: 4, mat: 'tnL', w: () => wT }));
    const ring = [...Array(9).keys()].map((j) => { const a = a1 + ((2 * PI - (a1 - a0)) * j) / 8, q = TH.ta(0.62, a); return { p: add(q.p, mul(q.n, 0.07)), n: q.n }; });
    out.push(band(ring, { wide: 0.1, high: 0.025, mat: 'leatherD', w: () => wT }));
  }
  // -- the demi-greave down the front of the shin
  const cPick = (q) => q.p[0] * sg > 0.12 && shareW(B, q.w, 'calf') > 0.6;
  const SH = limbWrap(B, kn, an, sg, { t: [0, 1.02], nt: 20, a: [-PI, PI], closed: true, na: 26, pick: cPick, smooth: 4, shape: (r) => r });
  const wSh = skinW(B, (q) => cPick(q) && along(q.p, kn, an) > 0.2 && along(q.p, kn, an) < 0.85, legBones);
  const shin = (a) => 0.06 * Math.exp(-((a / 0.25) ** 2));
  const GU = 7, GV = 12, gT0 = 0.88, gT1 = 0.17;
  const greave = plateOn(SH, { a0: -1.6, a1: 1.6, t0: () => gT0, t1: () => gT1, nu: GU, nv: GV, off: (u, v, t, a) => 0.1 + shin(a) + 0.05 * smooth(0.7, 0.88, t) });
  out.push(solid(greave, { w: () => wSh, thick: 0.04, mat: () => 'tn', inner: 'tnD', edge: 'tnS' }));
  out.push(tube(rowPath(greave, GU, 0, GV, GV), { r: 0.04, k: 3, mat: 'tnL', w: () => wSh }));
  out.push(tube(rowPath(greave, 0, 0, GV, GV), { r: 0.04, k: 3, mat: 'tnL', w: () => wSh }));
  out.push(tube(colPath(greave, GV / 2, 0.3, GU - 0.3, GU, 0.01), { r: 0.03, k: 3, mat: 'tnL', w: () => wSh }));
  for (const fi of [0.8, GU - 0.8]) out.push(...studsAlong(rowPath(greave, fi, 1, GV - 1, 12, 0.01), 3, { r: 0.04, h: 0.035, k: 4, mat: 'tnL', w: () => wSh }));
  // (the straps round the calf behind, a tin buckle on the outside of each)
  for (const tt of [0.32, 0.72]) {
    const ring = [...Array(15).keys()].map((j) => { const a = 1.45 + ((2 * PI - 2.9) * j) / 14, q = SH.ta(tt, a); return { p: add(q.p, mul(q.n, 0.09)), n: q.n }; });
    out.push(band(ring, { wide: 0.13, high: 0.03, mat: 'leather', w: () => wSh }));
    const bq = SH.ta(tt, PI / 2 + 0.2), F2 = frameAt(add(bq.p, mul(bq.n, 0.13)), bq.n, unit(sub(an, kn)));
    const fr = [[-0.09, -0.08], [0.09, -0.08], [0.09, 0.08], [-0.09, 0.08], [-0.09, -0.08]].map(([u, v]) => ({ p: inFrame(F2, u, v), n: bq.n }));
    out.push(sweep(fr, { closedProfile: true, profile: roundP(0.025, 3), mat: 'tnL', w: () => wSh }));
  }
  return out;
}
export function tinLegs(B) {
  return { P: coverHides(B, merge(smoothWeights(hose(B), 6, (p) => p[1] > B.at.knee.l[1] + 0.6), ...legOf(B, 'l'), ...legOf(B, 'r')), 0.5), dropAt: (f) => f.mat.endsWith('W') };
}

/* ---- boots ---------------------------------------------------------------------------------------------------------- */
/**
 * One foot's ankle boot: the leather shoe's turned-down cuff, a tin toe cap riveted over the toes, a strap over the instep
 * with a tin buckle (lit when enchanted), a stacked heel.
 */
function bootOf(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, an = A.ankle[s], kn = A.knee[s], ball = A.ball[s], out = [], female = B.who === 'female';
  const fPick = (q) => q.p[0] * sg > 0.1 && shareW(B, q.w, 'foot') > 0.6;
  const toes = skinSamples(B).filter(fPick);
  const tip = toes.reduce((b, q) => (q.p[2] > b[2] ? q.p : b), [0, 0, -9]);
  const from = [an[0], an[1] - 0.05, an[2] + 0.05], to = [tip[0], A.floor + 0.22, tip[2] + 0.1];
  const tBall = along(ball, from, to);
  const FT = limbWrap(B, from, to, sg, { front: [0, 1, 0], t: [0, 1.0], nt: 24, a: [-PI, PI], closed: true, na: 24, pick: fPick, smooth: 4,
    shape: (r, t) => r * (t > 0.86 ? Math.max(0.05, Math.sqrt(Math.max(0, 1 - ((t - 0.86) / 0.145) ** 2))) : 1) });
  const wFoot = boneW(B, `foot_${s}`), wBall = boneW(B, `ball_${s}`);
  // -- the toe cap: a shell over the toes from the ball forward, its rim rolled, riveted, a ridge down its middle
  const tc = [tip[0], A.floor + 0.2, ball[2] + 0.05];
  const TD = domeWrap(B, { c: tc, u: unit([0, -0.15, 1]), f: [0, 1, 0], s: [sg, 0, 0], pick: (q) => fPick(q) && q.p[2] > ball[2] - 0.25, rows: 10, cols: 20, thMax: 1.75, cone: 0.35, smooth: 3, shape: (r) => r + 0.07 });
  const TU = 5, TV = 12;
  const toe = plateOn(TD, { a0: -1.95, a1: 1.95, t0: () => 0, t1: (a) => (1.45 - 0.2 * Math.abs(a) / 1.95) / 1.75, nu: TU, nv: TV, off: () => 0 });
  out.push(solid(toe, { sheet: true, w: () => wBall, mat: () => 'tnB' }));
  out.push(tube(rowPath(toe, TU, 0, TV, TV), { r: 0.04, k: 3, mat: 'tnL', w: () => wBall }));
  out.push(...studsAlong(rowPath(toe, TU - 0.7, 1.5, TV - 1.5, 12, 0.01), 3, { r: 0.04, h: 0.035, k: 4, mat: 'tnL', w: () => wBall }));
  out.push(tube(colPath(toe, TV / 2, 0.6, TU - 0.4, 5, 0.01), { r: 0.025, k: 3, mat: 'tnL', w: () => wBall }));
  // -- the strap over the instep, its buckle on the outside (lit when enchanted)
  const st = lerp([0.2, 0, 0], [tBall - 0.08, 0, 0], 0.45)[0];
  const ring = [...Array(13).keys()].map((j) => { const a = -1.9 + (3.8 * j) / 12, q = FT.ta(st, a); return { p: add(q.p, mul(q.n, 0.07)), n: q.n }; });
  out.push(band(ring, { wide: 0.14, high: 0.03, mat: 'leatherD', w: () => wFoot }));
  { const q = FT.ta(st, 1.15), F2 = frameAt(add(q.p, mul(q.n, 0.1)), q.n, unit(sub(to, from)));
    const fr = [[-0.1, -0.09], [0.1, -0.09], [0.1, 0.09], [-0.1, 0.09], [-0.1, -0.09]].map(([u, v]) => ({ p: inFrame(F2, u, v), n: q.n }));
    out.push(sweep(fr, { closedProfile: true, profile: roundP(0.035, 4), mat: 'runeS', w: () => wFoot }));
    out.push(tube([{ p: inFrame(F2, 0, -0.1, 0.02), n: q.n }, { p: inFrame(F2, 0, 0.06, 0.03), n: q.n }], { r: 0.025, k: 3, mat: 'runeS', w: () => wFoot })); }
  // -- the cuff turned down round the ankle: cut in six rounded dags like the chaperon's, in the livery counterchanged
  // against the hose, its fold rolled in leather
  const cPick = (q) => q.p[0] * sg > 0.12 && shareW(B, q.w, 'calf', 'foot') > 0.6;
  const AN = limbWrap(B, lerp(kn, an, 0.7), add(an, [0, -0.3, 0]), sg, { t: [0, 1], nt: 10, a: [-PI, PI], closed: true, na: 24, pick: cPick, smooth: 3, shape: (r) => r });
  const wAn = mixOf(B, [[`ankle_${s}`, 0.6], [`calf_${s}`, 0.25], [`foot_${s}`, 0.15]]);
  const [cc, ccD] = LIVERY[s];
  const cTop = 0.58, cDrop = 0.27, NDAG = 6;
  const dag = (a) => { const f = (((a + PI) / (2 * PI)) * NDAG) % 1, x = Math.abs(2 * f - 1); return Math.sqrt(Math.max(0, 1 - x ** 2)); };
  const cuff = plateOn(AN, { a0: -PI, a1: PI, closed: true, t0: (a) => cTop + cDrop * (0.4 + 0.6 * dag(a)), t1: () => cTop, nu: 3, nv: 36, off: (u, v, t, a) => 0.1 + 0.1 * (1 - u) ** 1.3 + 0.06 * Math.max(0, -Math.cos(a)) });
  out.push(solid(cuff, { w: () => wAn, thick: 0.03, mat: () => cc, inner: 'leatherD', edge: ccD }));
  out.push(tube(rowPath(cuff, 3, 0, 36, 24), { r: 0.05, k: 3, mat: 'leatherD', w: () => wAn, closed: true }));
  // -- the heel: a tin cup riveted over the back of the heel
  {
    const hPick = (q) => fPick(q) && q.p[2] < an[2] + 0.1 && q.p[1] < an[1] - 0.25;
    const hc = [an[0], A.floor + 0.28, an[2] + 0.2];
    const HD = domeWrap(B, { c: hc, u: [0, 0, -1], f: [0, 1, 0], s: [-sg, 0, 0], pick: hPick, rows: 8, cols: 16, thMax: 1.6, cone: 0.35, smooth: 3, shape: (r) => r + 0.12 });
    const wHeel = mixOf(B, [[`foot_${s}`, 0.75], [`ankle_${s}`, 0.25]]);
    const cup = plateOn(HD, { a0: -1.9, a1: 1.9, t0: () => 0, t1: (a) => (0.78 - 0.15 * Math.max(0, Math.cos(a))) / 1.6, nu: 4, nv: 10, off: () => 0 });
    out.push(solid(cup, { sheet: true, w: () => wHeel, mat: () => 'tnB' }));
    out.push(tube(rowPath(cup, 4, 0, 10, 10), { r: 0.035, k: 3, mat: 'tnL', w: () => wHeel }));
    out.push(...studsAlong(rowPath(cup, 3.2, 1.5, 8.5, 8, 0.01), 3, { r: 0.035, h: 0.03, k: 4, mat: 'tnL', w: () => wHeel }));
  }
  return out;
}
/** The leather shoe: the foot and the ankle, close over the skin, a thick sole stood on. */
function shoe(B) {
  const A = B.at;
  const P = shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'foot', 'calf') > 0.6 && p[1] < A.ankle[s][1] + 0.5; },
    off: ({ n }) => 0.05 + (n[1] < -0.6 ? 0.07 : 0),
    mat: ({ n }) => (n[1] < -0.55 ? 'sole' : 'leather'),
  });
  P.soles = P.V.map((_, i) => i).filter((i) => P.V[i][1] < A.floor + 0.12);
  return P;
}
export function tinBoots(B) {
  return merge(shoe(B), ...bootOf(B, 'l'), ...bootOf(B, 'r'));
}

const TAU = PI * 2;
