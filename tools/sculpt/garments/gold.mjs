// The gold set: the royal guard in parade armour, built with the plate kit (tools/sculpt/garments/platekit.mjs) and
// the gold set's own builders (tools/sculpt/garments/kit/gold.mjs).
//
//   helm    the comb morion: a high skull under a roped comb with a sunburst each side and one on the brow, its brim
//           swept up to points before and behind, an etched band of acanthus scrolls, rosette rivets, a plume of crimson
//           and white ostrich feathers.
//   chest   a crimson doublet under a peascod cuirass (polished medial ridge, dark etched bands carrying raised scrolls,
//           a flared fauld, a jewelled girdle); puffed sleeves of crimson panes slashed to white satin, scalloped gold
//           wings at the shoulders, couters with sunbursts, etched vambraces, lace ruffs at the wrists.
//   mantle  the royal mantle: an ermine tippet round the shoulders, the chain of office over it with the great sunburst
//           medallion on blue enamel at the throat, and a stiff crimson cloak lined in royal blue standing off the back,
//           bordered in ermine and gold, a gold crown on it.
//   legs    paned trunk hose (crimson panes over puffs of cloth of gold), crimson canions braided in gold, poleyns with
//           sunbursts, demi-greaves with an etched band over crimson stockings, the blue Garter below the left knee.
//   boots   bear-paw sabatons: lapped instep lames, a broad fluted toe with a ruby rosette, a gold heel cup, a spur strap
//           and a star-rowelled spur, over crimson velvet shoes.
//
// Enchanted, five things light and nothing else: the morion's suns, the medallion's sun, the couters' suns, the
// poleyns' suns and the crown on the cloak.
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, smooth, merge, shell, on } from './metalkit.mjs';
import {
  boneW, mixOf, mixW, shareW, skinW, nearSkinW, limbWrap, along, plateOn, solid, tube, band, rowPath, colPath, pathOn, studsAlong, stud, patch, wrapAngle,
  smoothWeights, coverHides, skinSamples, torsoWrap, domeWrap,
} from './platekit.mjs';
import { headDome, headW, sunburst, rope, feather, scroll, torsoField, torsoMarks, TORSO_BONES } from './kit/gold.mjs';

const PI = Math.PI;

export const GOLD_MATS = {
  // (the gold: a warm yellow, its shade a deep orange, its polished edges near white; lit as metal)
  au: { c: '#d8961e', kind: 3 },
  auM: { c: '#a8620e', kind: 3 },
  auL: { c: '#ffe8a0', kind: 3 },
  auS: { c: '#6e2c06', kind: 3 },
  auD: { c: '#5e2a08', kind: 3 },
  auE: { c: '#7c3a06', kind: 3 },
  // (the glow: the suns, lit in the enchantment's colour; plain, a bright gold)
  rune: { c: '#ffd25e', kind: 3, lit: { c: '#ffe7a6', kind: 1 } },
  crimson: { c: '#a3122a', kind: 0 },
  crimsonD: { c: '#68091a', kind: 0 },
  white: { c: '#f2ede2', kind: 2 },
  satin: { c: '#f6f1e6', kind: 0 },
  ruby: { c: '#b0102c', kind: 3 },
  // (the sabatons' rosette ruby, lit when enchanted: the boots' glow)
  rubyLit: { c: '#b0102c', kind: 3, lit: { c: '#ffe7a6', kind: 1 } },
  royal: { c: '#1f3c8f', kind: 0 },
  goldcloth: { c: '#e8b83c', kind: 0 },
  crimsonW: { c: '#68091b', kind: 0 },
  sole: { c: '#2a1d16', kind: 2 },
  ermine: { c: '#f5f2ea', kind: 0 },
  ermineT: { c: '#161214', kind: 2 },
  enamel: { c: '#1a3796', kind: 3 },
  whiteD: { c: '#c9c0ae', kind: 2 },
  plumeR: { c: '#b5132c', kind: 2 },
  plumeW: { c: '#f4efe4', kind: 2 },
};

/* ---- the helm ----------------------------------------------------------------------------------------------------- */
/**
 * The comb morion: a high skull from the brow before to the nape behind, a roped comb standing tall over it from front
 * to back with a sunburst on each side, a brim round its foot swept up to points before and behind and down over the
 * ears, acanthus scrolls raised on the skull's sides, rosette rivets round its foot, and a plume of ostrich feathers,
 * crimson and white, from a socket behind the comb. The face left open under the brim. Rigid on the head.
 */
export function goldHelm(B) {
  const female = B.who === 'female', out = [];
  const H = headDome(B, { rise: female ? 0.02 : 0.04 }), D = H.D, c = H.c;
  const wH = boneW(B, 'head'), w = () => wH;
  const front = (ph) => Math.abs(wrapAngle(ph));
  // -- the skull: its foot just over the brow before, over the tops of the ears at the sides, at the nape behind
  const dSide = female ? 0.36 : 0.42, dBack = female ? 0.72 : 0.8;
  const rimTh = (ph) => { const f = front(ph); return H.browTh - 0.16 + 0.1 * smooth(0.3, 0.9, f) + (f < PI / 2 ? dSide * smooth(0.5, PI / 2, f) : dSide + (dBack - dSide) * smooth(PI / 2, PI - 0.3, f)); };
  const NV = 32;
  const skull = plateOn(D, { a0: -PI, a1: PI, closed: true, t0: () => 0, t1: (a) => rimTh(a) / PI, nu: 10, nv: NV, off: () => 0 });
  out.push(solid(skull, { sheet: true, w, mat: () => 'au' }));
  // (a band round its foot, a rolled edge under it, rosette rivets on the band)
  out.push(band(rowPath(skull, 9.3, 0, NV, NV), { wide: 0.12, high: 0.025, mat: 'auM', w, closed: true }));
  out.push(...studsAlong(rowPath(skull, 9.3, 0, NV, NV * 2, 0.02), 12, { from: 0, to: 11 / 12, r: 0.06, h: 0.05, k: 4, mat: 'auL', w }));
  // -- the brim: out from the skull's foot, level at the sides and over the ears, swept up to a point before and behind
  const bW = (ph) => { const k = Math.abs(Math.cos(ph)); return (female ? 0.3 : 0.36) + (female ? 0.36 : 0.44) * k ** 8; };
  const bUp = (ph) => { const k = Math.abs(Math.cos(ph)); return (female ? 0.66 : 0.8) * k ** 5 - 0.1 * Math.sin(ph) ** 2; };
  const brimP = (u, v) => {
    const ph = v * 2 * PI, q = skull.at(10, v * NV), h = unit([q.p[0] - c[0], 0, q.p[2] - c[2]]);
    return { p: add(add(q.p, mul(h, bW(ph) * u - 0.02)), [0, bUp(ph) * u ** 1.8 + 0.02 * u, 0]), n: unit(add([0, 1, 0], mul(h, 0.3))) };
  };
  const brim = patch(brimP, 3, 36, { closed: true });
  out.push(solid(brim, { w, thick: 0.05, mat: () => 'au', inner: 'auM', edge: 'auS' }));
  out.push(tube(rowPath(brim, 3, 0, 36, 36), { r: 0.055, k: 3, mat: 'auL', w, closed: true }));
  // -- the comb: a thin plate standing up the middle from over the brow to the back of the crown, roped along its top
  const th0 = -0.95, th1 = female ? 1.15 : 1.2, Hc = female ? 0.5 : 0.62;
  const combAt = (s) => { const th = th0 + (th1 - th0) * s, q = D.ta(Math.abs(th) / PI, th < 0 ? 0 : PI); return q; };
  const combH = (s) => Hc * Math.sin(PI * s) ** 0.65;
  const comb = patch((u, v) => { const q = combAt(u); return { p: add(q.p, add(mul(q.n, combH(u) * v - 0.05), [0.04, 0, 0])), n: [1, 0, 0] }; }, 18, 2);
  out.push(solid(comb, { w, thick: 0.08, mat: () => 'auM', inner: 'auM', edge: 'auS' }));
  const ridge = [...Array(25).keys()].map((k) => { const s = 0.01 + (0.98 * k) / 24, q = combAt(s); return { p: add(q.p, mul(q.n, combH(s) - 0.02)), n: q.n }; });
  out.push(rope(ridge, { r: 0.06, k: 4, twist: 1.6, mat: 'auL', w }));
  // (a sunburst on each side of the comb, lit when enchanted)
  for (const sg of [1, -1]) {
    const q = combAt(0.47), at = add(q.p, add(mul(q.n, combH(0.47) * 0.5), [sg * 0.05, 0, 0]));
    const S = sunburst(at, [sg, 0, 0], { R: Hc * 0.62, rays: 12, inner: 0.4, short: 0.65, dome: 0.03, mat: 'rune', w });
    out.push(S, stud(add(at, [sg * 0.02, 0, 0]), [sg, 0, 0], { r: Hc * 0.13, h: 0.06, k: 6, mat: 'auL', w }));
  }
  // (a sunburst boss on the brow, at the comb's foot)
  { const q = combAt(0.05), at = add(q.p, mul(q.n, 0.02)), o = unit(add(q.n, [0, 0, 0.3]));
    out.push(sunburst(at, o, { R: female ? 0.27 : 0.32, rays: 12, inner: 0.42, short: 0.62, dome: 0.03, mat: 'rune', w }), stud(add(at, mul(o, 0.02)), o, { r: 0.09, h: 0.07, k: 6, mat: 'ruby', w })); }
  // -- acanthus scrolls raised on each side of the skull, between the comb and the band
  for (const sg of [1, -1]) {
    const tm = () => (female ? 0.31 : 0.32) + 0.04, ph0 = sg * 0.55, ph1 = sg * (PI - 0.6);
    // (on an etched band, darker, as the breastplate's)
    const etch = [...Array(15).keys()].map((k) => { const q = D.ta(tm(), ph0 + ((ph1 - ph0) * k) / 14); return { p: q.p, n: q.n }; });
    out.push(band(etch, { wide: female ? 0.26 : 0.3, high: 0.015, mat: 'auE', w }));
    out.push(...scroll((t, a) => D.ta(t, a), { a0: ph0 + sg * 0.1, a1: ph1 - sg * 0.1, tm, amp: 0.03, waves: 2, curl: 0.035, aScale: (sg * PI) / Math.sin(PI * 0.36), turns: 1.25, r: 0.026, k: 3, mat: 'auL', w, lift: 0.03, steps: 16 }));
  }
  // -- the plume: ostrich feathers from a socket on the comb's foot behind, rising and curling over backward
  const sq = D.ta((female ? 1.05 : 1.12) / PI, PI - 0.28), sockTop = add(sq.p, add(mul(sq.n, 0.14), [0, 0.12, 0]));
  out.push(tube([{ p: add(sq.p, mul(sq.n, -0.03)), n: [0, 0, -1] }, { p: sockTop, n: [0, 0, -1] }], { r: 0.075, k: 6, mat: 'auL', w }));
  out.push(stud(sockTop, [0, 1, 0], { r: 0.11, h: 0.06, k: 6, mat: 'auM', w }));
  const k0 = female ? 0.85 : 1;
  for (const [dx, lean, L, mat, tip] of [[0, 0.0, 2.7, 'plumeW', 'plumeW'], [0.06, 0.3, 2.35, 'plumeR', 'plumeW'], [-0.06, -0.25, 2.3, 'plumeR', 'plumeW'], [0.1, 0.6, 1.75, 'plumeW', 'plumeR'], [-0.1, -0.55, 1.7, 'plumeW', 'plumeR']]) {
    out.push(feather(add(sockTop, [dx, 0.02, 0]), { L: L * k0, dir: unit([lean * 0.3 - 0.1, 1, -0.12]), toward: unit([lean * 0.6 - 0.15, -0.1, -1]), bend: 1.7, W: 0.2 * k0, thick: 0.035, face: unit([1, 0, lean * 0.4]), mat, tip, tipAt: 0.72, w, n: 9 }));
  }
  const P = merge(...out);
  // (the head's own polygons under it left out: every corner inside the skull, short of its foot)
  const inside = (i) => { const v = sub(B.V[i], c), th = Math.acos(clamp(unit(v)[1], -1, 1)), ph = Math.atan2(v[0], v[2]); return th < rimTh(ph) - 0.12; };
  B.A.polys.forEach(([v], pi) => { if (v.every((i) => inside(i))) P.hides.add(pi); });
  return P;
}

/* ---- chest & arms --------------------------------------------------------------------------------------------------- */
/** How much of a body point's weight is on the head and the jaw themselves. */
const headOnly = (B, i) => headW(B, B.W[i]);
/** The doublet: crimson velvet over the torso and the arms to the wrists, close over the skin, the skin under it left out. */
function doublet(B) {
  const A = B.at, M = torsoMarks(B);
  return shell(B, {
    sub: 0, rim: null,
    keep: (i) => { const p = B.V[i]; return on(B, i, 'torso', 'shoulder', 'upperarm', 'forearm', 'neck', 'head', 'thigh') > 0.6 && headOnly(B, i) < 0.05 && on(B, i, 'hand') < 0.35 && p[1] > M.waist - 0.28 && on(B, i, 'thigh') < 0.5 && p[1] < A.neck[1] - 0.02; },
    off: ({ p }) => 0.065 + 0.03 * smooth(M.waist, M.hip, p[1]) - 0.03 * smooth(A.neck[1] - 0.6, A.neck[1] - 0.1, p[1]),
    mat: () => 'crimson',
  });
}

/**
 * The cuirass: a peascod breastplate (its belly drawn down to a point over the girdle, a ridge down its middle, a panel
 * of acanthus scrolls raised either side of the ridge), the backplate, a flared fauld at the waist and the jewelled
 * girdle round it; every edge rolled bright.
 */
function cuirass(B) {
  const A = B.at, M = torsoMarks(B), F = torsoField(B), t = F.tOfY, out = [];
  const W = nearSkinW(B, (s) => shareW(B, s.w, 'torso') > 0.7, (n) => TORSO_BONES.has(n), 0.35);
  const female = B.who === 'female';
  const aN = 0.78, side = PI / 2 + 0.04;
  const topF = (a) => { const ax = Math.abs(a), yC = M.neckF + 0.16; if (ax <= aN) return M.neckF + 0.16 * (ax / aN) ** 2; const k = clamp((ax - aN) / (side - aN)); return M.pit + (yC - M.pit) * Math.sqrt(Math.max(0, 1 - k * k)); };
  const bN = 0.62;
  const topB = (a) => { const bx = PI - Math.abs(wrapAngle(a)), yC = M.neckB + 0.1; if (bx <= bN) return M.neckB + 0.1 * (bx / bN) ** 2; const k = clamp((bx - bN) / (PI - side + 0.04 - bN)); return M.pit + (yC - M.pit) * Math.sqrt(Math.max(0, 1 - k * k)); };
  // (the peascod: the belly full and low, drawn down to a point at the middle over the girdle)
  const point = female ? 0.36 : 0.5;
  const botF = (a) => M.waist - 0.06 - point * Math.exp(-((a / 0.42) ** 2));
  const chestB = (yy, a) => (female ? 0.06 : 0.08) * Math.exp(-(((yy - lerp(A.chest, [0, M.waist, 0], 0.3)[1]) / 0.8) ** 2)) * Math.max(0, Math.cos(a)) ** 1.5;
  const pea = (yy, a) => (female ? 0.12 : 0.22) * Math.exp(-(((yy - (M.waist + 0.15)) / 0.75) ** 2)) * Math.max(0, Math.cos(a)) ** 2.5;
  const keel = (a) => 0.06 * Math.exp(-((a / 0.16) ** 2));
  const offF = (u, v, tt, a) => 0.15 + chestB(F.yOfT(tt), a) + pea(F.yOfT(tt), a) + keel(a) + 0.03 * smooth(0.1, 0, u);
  const NU = 12, NV = 20;
  const breast = plateOn(F, { a0: -side, a1: side, t0: (a) => t(botF(a)), t1: (a) => t(topF(a)), nu: NU, nv: NV, off: offF });
  const back = plateOn(F, { a0: side - 0.08, a1: 2 * PI - side + 0.08, t0: () => t(M.waist - 0.06), t1: (a) => t(topB(a)), nu: 12, nv: 20, off: (u, v, tt, a) => 0.13 + 0.04 * Math.exp(-((wrapAngle(a - PI) / 0.14) ** 2)) + 0.03 * smooth(0.1, 0, u) });
  out.push(solid(breast, { sheet: true, w: W, mat: () => 'au' }));
  out.push(solid(back, { sheet: true, w: W, mat: () => 'au' }));
  // (rolled edges round the neck, the armholes and the foot; an etched border inside them)
  out.push(tube(rowPath(breast, NU, 0, NV, NV), { r: 0.055, k: 3, mat: 'auL', w: W }));
  out.push(tube(rowPath(breast, 0, 0, NV, NV), { r: 0.05, k: 3, mat: 'auL', w: W }));
  out.push(tube(rowPath(back, 12, 0, 20, 20), { r: 0.05, k: 3, mat: 'auL', w: W }));
  out.push(band(rowPath(breast, NU - 1, 0, NV, NV), { wide: 0.16, high: 0.012, mat: 'auE', w: W }));
  out.push(band(rowPath(back, 12 - 1, 0, 20, 20), { wide: 0.16, high: 0.012, mat: 'auE', w: W }));
  // (the etched bands either side of the ridge, darker, the scrolls raised bright on them; two down the back)
  for (const sg of [1, -1]) {
    out.push(band(colPath(breast, NV / 2 + sg * 4.2, 0.6, NU - 1.4, NU), { wide: 0.34, high: 0.012, mat: 'auE', w: W }));
    for (const e of [2.9, 5.5]) out.push(tube(colPath(breast, NV / 2 + sg * e, 0.6, NU - 1.4, 8, 0.01), { r: 0.025, k: 3, mat: 'auL', w: W }));
    out.push(band(colPath(back, 10 + sg * 3.2, 0.5, 12 - 1.4, 12), { wide: 0.3, high: 0.012, mat: 'auE', w: W }));
  }
  // (the ridge down the middle, polished)
  out.push(tube(colPath(breast, NV / 2, 0.3, NU - 0.6, NU), { r: 0.04, k: 3, mat: 'auL', w: W }));
  // (the acanthus: a scroll running up each side of the ridge, raised)
  for (const sg of [1, -1]) {
    const at = (x, s) => breast.at(s * NU, NV / 2 + sg * x * NV);
    out.push(...scroll(at, { a0: 0.08, a1: 0.86, tm: () => 4.2 / NV, amp: 0.03, waves: 2, curl: 0.04, aScale: 0.9 * (sg), turns: 1.25, r: 0.04, k: 3, mat: 'auL', w: W, lift: 0.03, steps: 16 }));
  }
  // -- the fauld: one hoop flared out from under the breastplate's foot, round the hips; the girdle over its top
  const fTop = M.waist + 0.04, fBot = (a) => M.waist - (female ? 0.42 : 0.5) + (female ? 0.0 : 0.12) * smooth(1.8, 2.8, Math.abs(wrapAngle(a)));
  const fauld = plateOn(F, { a0: -PI, a1: PI, closed: true, t0: (a) => t(fBot(a)), t1: () => t(fTop), nu: 3, nv: 32, off: (u) => 0.16 + 0.14 * (1 - u) });
  out.push(solid(fauld, { hollow: true, w: W, thick: 0.04, mat: () => 'auM', edge: 'auS' }));
  out.push(tube(rowPath(fauld, 0, 0, 32, 20), { r: 0.045, k: 3, mat: 'auL', w: W, closed: true }));
  // (the girdle: a crimson belt with gold plaques and jewels, over the fauld's top, under the peascod's point)
  const girdle = plateOn(F, { a0: -PI, a1: PI, closed: true, t0: () => t(fTop - 0.2), t1: () => t(fTop - 0.02), nu: 1, nv: 32, off: () => 0.23 });
  out.push(solid(girdle, { hollow: true, w: W, thick: 0.04, mat: () => 'crimson', edge: 'crimsonD' }));
  for (let k = 0; k < 10; k++) {
    const q = girdle.at(0.5, (k + 0.5) * 3.2);
    if (Math.abs(wrapAngle(-PI + (2 * PI * (k + 0.5)) / 10)) < 0.3) continue;
    out.push(stud(q.p, q.n, { r: 0.1, h: 0.04, k: 4, mat: 'au', w: () => W(q.p) }));
    out.push(stud(add(q.p, mul(q.n, 0.03)), q.n, { r: 0.035, h: 0.04, k: 4, mat: 'ruby', w: () => W(q.p) }));
  }
  return { parts: out, W, F, M, breast, back };
}

/** The arm's skin samples on side `s`: of the parts given, more than `k` of their weight. */
const armPick = (B, s, parts, k = 0.6) => (q) => (s === 'l' ? q.p[0] > 0.15 : q.p[0] < -0.15) && shareW(B, q.w, ...parts) > k;
const armBones = (s) => (n) => n.endsWith(`_${s}`);

/**
 * One arm: the puffed sleeve (white satin puffed out between crimson panes, gathered into gold bands at the shoulder
 * and above the elbow, a gold aiglet on each pane), a scalloped gold wing over the shoulder's seam, the couter with its
 * rosette, the vambrace with a scroll down its back, and the lace ruff at the wrist.
 */
function armOf(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, sh = A.shoulder[s], el = A.elbow[s], wr = A.wrist[s], out = [];
  const female = B.who === 'female';
  const upPick = armPick(B, s, ['upperarm', 'shoulder']);
  const UA = limbWrap(B, sh, el, sg, { t: [-0.1, 1.0], nt: 22, a: [-PI, PI], closed: true, na: 24, pick: upPick, smooth: 3, shape: (r) => r });
  const wUp = skinW(B, (q) => upPick(q) && along(q.p, sh, el) > 0.3 && along(q.p, sh, el) < 0.8, armBones(s));
  const wSh = mixOf(B, [[`shoulder_${s}`, 0.5], [`upperarm_${s}`, 0.2], [`clavicle_${s}`, 0.3]]);
  const wArm = (p) => { const f = smooth(-0.05, 0.6, along(p, sh, el)); return mixW([[wSh, 1 - f], [wUp, f]]); };
  // -- the puff: out most at the middle and on the outside, little on the inside toward the body
  const t0 = 0.08, t1 = 0.8, big = female ? 0.23 : 0.34;
  const swell = (tt, a) => big * Math.sin(PI * clamp((tt - t0) / (t1 - t0))) ** 0.8 * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(a)) ** 0.8);
  const offP = (u, v, tt, a) => 0.07 + swell(tt, a);
  // (the panes: crimson strips down the puff; the satin puffed out through the slits between them)
  const panes = 8, hw = (PI / panes) * 0.74;
  const slit = (tt, a) => 0.075 * Math.max(0, Math.cos(panes * (a + PI))) ** 6 * Math.sin(PI * clamp((tt - t0) / (t1 - t0))) ** 0.5;
  const puff = plateOn(UA, { a0: -PI, a1: PI, closed: true, t0: () => t0, t1: () => t1, nu: 8, nv: 32, off: (u, v, tt, a) => offP(u, v, tt, a) + slit(tt, a) });
  out.push(solid(puff, { sheet: true, w: wArm, mat: () => 'satin' }));
  for (let k = 0; k < panes; k++) {
    const ac = -PI + (2 * PI * (k + 0.5)) / panes;
    const g = plateOn(UA, { a0: ac - hw, a1: ac + hw, t0: () => t0, t1: () => t1, nu: 8, nv: 2, off: (u, v, tt, a) => offP(u, v, tt, a) + 0.035 + 0.02 * Math.sin(PI * v) });
    out.push(solid(g, { sheet: true, w: wArm, mat: () => 'crimson' }));
    const q = g.at(5, 1);
    out.push(stud(q.p, q.n, { r: 0.05, h: 0.05, k: 4, mat: 'au', w: () => wArm(q.p) }));
  }
  // (gathered into gold bands at each end)
  for (const [tt, r] of [[t0 + 0.02, 0.06], [t1 - 0.01, 0.06]]) {
    const ring = [...Array(17).keys()].map((j) => { const a = -PI + (2 * PI * j) / 16, q = UA.ta(tt, a); return { p: add(q.p, mul(q.n, offP(0, 0, tt, a) + 0.03)), n: q.n }; });
    out.push(tube(ring, { r, k: 3, mat: 'au', w: wArm, closed: true }));
  }
  // -- the wing over the shoulder's seam: a scalloped gold plate, its scallops rolled
  const wing = plateOn(UA, { a0: PI / 2 - 1.75, a1: PI / 2 + 1.75, t0: () => -0.1, t1: (a) => 0.13 + 0.07 * Math.abs(Math.sin(2.5 * (a - PI / 2 + 1.75) / 1.75 * PI / 2)), nu: 4, nv: 20, off: (u) => 0.16 + 0.12 * u });
  out.push(solid(wing, { sheet: true, w: () => wSh, mat: () => 'au' }));
  out.push(tube(rowPath(wing, 4, 0, 20, 18), { r: 0.045, k: 3, mat: 'auL', w: () => wSh }));
  // -- the couter: a cup over the elbow with a gold rosette
  const upDir = unit(sub(el, sh)), foreDir = unit(sub(wr, el)), uaLen = len(sub(el, sh)), faLen = len(sub(wr, el));
  const c0 = sub(el, mul(upDir, uaLen * 0.2)), c1 = add(el, mul(foreDir, faLen * 0.2));
  const elPick = (q) => armPick(B, s, ['upperarm', 'forearm'], 0.6)(q) && len(sub(q.p, el)) < 0.9;
  const EL = limbWrap(B, c0, c1, sg, { t: [0, 1], nt: 10, a: [-PI, PI], closed: true, na: 24, pick: elPick, smooth: 3, shape: (r) => r });
  const wEl = boneW(B, `elbow_${s}`);
  const cup = plateOn(EL, { a0: 1.0, a1: 2 * PI - 1.0, t0: () => 0.05, t1: () => 0.95, nu: 6, nv: 14, off: (u, v) => 0.16 + 0.07 * Math.sin(PI * u) * Math.sin(PI * v) });
  out.push(solid(cup, { sheet: true, w: () => wEl, mat: () => 'au' }));
  out.push(tube(rowPath(cup, 0, 0, 14, 9), { r: 0.035, k: 3, mat: 'auL', w: () => wEl }));
  out.push(tube(rowPath(cup, 6, 0, 14, 9), { r: 0.035, k: 3, mat: 'auL', w: () => wEl }));
  const ec = cup.at(3, 7);
  out.push(sunburst(add(ec.p, mul(ec.n, 0.02)), ec.n, { R: female ? 0.25 : 0.3, rays: 10, inner: 0.45, short: 0.7, dome: 0.04, mat: 'rune', w: () => wEl }));
  out.push(stud(add(ec.p, mul(ec.n, 0.03)), ec.n, { r: 0.08, h: 0.07, k: 5, mat: 'auL', w: () => wEl }));
  // -- the vambrace: closed round the forearm, a scroll down its back
  const faPick = armPick(B, s, ['forearm'], 0.6);
  const FA = limbWrap(B, el, wr, sg, { t: [0, 1.04], nt: 14, a: [-PI, PI], closed: true, na: 22, pick: faPick, smooth: 3, shape: (r) => r });
  const wFa = skinW(B, (q) => faPick(q) && along(q.p, el, wr) > 0.25 && along(q.p, el, wr) < 0.85, armBones(s));
  const vamb = plateOn(FA, { a0: -PI, a1: PI, closed: true, t0: () => 0.17, t1: () => 0.88, nu: 6, nv: 16, off: (u) => 0.09 + 0.03 * Math.sin(PI * u) + 0.06 * u * u });
  out.push(solid(vamb, { sheet: true, w: () => wFa, mat: () => 'au' }));
  out.push(tube(rowPath(vamb, 0, 0, 16, 16), { r: 0.035, k: 3, mat: 'auL', w: () => wFa, closed: true }));
  out.push(tube(rowPath(vamb, 6, 0, 16, 16), { r: 0.045, k: 3, mat: 'auL', w: () => wFa, closed: true }));
  out.push(band(rowPath(vamb, 5.2, 0, 16, 16), { wide: 0.1, high: 0.015, mat: 'auS', w: () => wFa, closed: true }));
  // (an etched band down the outside of the forearm, a polished rib each side of it)
  out.push(band(colPath(vamb, 12, 0.3, 5.6, 6), { wide: 0.22, high: 0.012, mat: 'auE', w: () => wFa }));
  for (const e of [11.35, 12.65]) out.push(tube(colPath(vamb, e, 0.3, 5.6, 6, 0.01), { r: 0.022, k: 3, mat: 'auL', w: () => wFa }));
  // -- the ruff at the wrist: white lace frilled round the vambrace's foot
  const wWr = mixOf(B, [[`hand_${s}`, 0.35], [`wrist_${s}`, 0.3], [`lowerarm_${s}`, 0.35]]);
  const ruff = patch((u, v) => { const a = -PI + 2 * PI * v, q = FA.ta(0.9 + 0.1 * u, a), fr = 0.5 + 0.5 * Math.cos(a * 9); return { p: add(q.p, mul(q.n, 0.09 + (0.07 + 0.06 * fr) * u)), n: q.n }; }, 2, 18, { closed: true });
  out.push(solid(ruff, { sheet: true, w: () => wWr, mat: (i) => (i === 0 ? 'whiteD' : 'white') }));
  return out;
}

export function goldChest(B) {
  const T = cuirass(B);
  return coverHides(B, merge(smoothWeights(doublet(B), 2, (p) => p[1] < B.at.neck[1] - 0.6), ...T.parts, ...armOf(B, 'l'), ...armOf(B, 'r')), 0.5);
}

/* ---- the mantle ------------------------------------------------------------------------------------------------------ */
/**
 * The royal mantle: an ermine tippet closed round the shoulders (white, its black tails in staggered rows), a crimson
 * cloak lined in royal blue hung from under it down the back to the thighs in deepening pleats, its edges bound in gold
 * and a gold crown on its back; over the ermine the chain of office, its links gold and jewelled, and from its foot on
 * the breast the great sunburst medallion (lit when enchanted).
 */
export function goldMantle(B) {
  const A = B.at, M = torsoMarks(B), F = torsoField(B), zc = F.zc, out = [], female = B.who === 'female';
  const n = A.neck[1];
  // (the envelope it is laid over: the chest piece's upper parts and the skin there, hung as cloth falls)
  const T = cuirass(B), L = armOf(B, 'l'), R = armOf(B, 'r');
  const legW = (w) => w.some(([b, x]) => x > 0.2 && /(thigh|calf)/.test(B.bones[b].name));
  const lowArm = (w) => w.some(([b, x]) => x > 0.3 && /(lowerarm|elbow|hand|wrist)/.test(B.bones[b].name));
  const pts = [], back = [];
  for (const P of [...T.parts, ...L, ...R]) P.V.forEach((p, i) => { if (!lowArm(P.W[i]) && !legW(P.W[i]) && p[1] > M.waist - 0.6) pts.push(p); });
  // (the cloak's own: the torso's pieces and the skin, the arms left out, so it hangs from the back between them)
  for (const P of T.parts) P.V.forEach((p, i) => { if (!legW(P.W[i])) back.push(p); });
  for (const q of skinSamples(B)) if (shareW(B, q.w, 'torso', 'neck') > 0.85 && headW(B, q.w) < 0.15 && q.p[1] > M.hip - 0.3) back.push(q.p);
  // (and behind, the trunk hose, so the cloak's skirt hangs clear of it)
  for (const P of [...legOf(B, 'l'), ...legOf(B, 'r')]) P.V.forEach((p) => { if (p[2] < A.hip.l[2] - 0.2 && p[1] > M.hip - 1.4) back.push(p); });
  for (const q of skinSamples(B)) if (shareW(B, q.w, 'torso', 'neck', 'shoulder', 'upperarm') > 0.8 && headW(B, q.w) < 0.15 && q.p[1] > M.waist - 0.6) pts.push(q.p);
  const cy0 = M.hip - (female ? 1.7 : 1.9), cy1 = n + 0.35, ct = (yy) => (yy - cy0) / (cy1 - cy0);
  const C = torsoWrap(B, cy0, cy1, zc, {
    points: pts, nt: 90, na: 72, closed: true, a: [-PI, PI], smooth: 3, minDa: 0.1, empty: 0.3,
    post: (Rr) => { for (let j = 0; j < Rr[0].length; j++) for (let i = Rr.length - 2; i >= 0; i--) Rr[i][j] = Math.max(Rr[i][j], Rr[i + 1][j]); },
    shape: (r) => r + 0.08,
  });
  const C2 = torsoWrap(B, cy0, cy1, zc, {
    points: back, nt: 90, na: 72, closed: true, a: [-PI, PI], smooth: 3, minDa: 0.1, empty: 0.3,
    post: (Rr) => { for (let j = 0; j < Rr[0].length; j++) for (let i = Rr.length - 2; i >= 0; i--) Rr[i][j] = Math.max(Rr[i][j], Rr[i + 1][j]); },
    shape: (r) => r + 0.08,
  });
  const W = nearSkinW(B, (q) => shareW(B, q.w, 'torso', 'neck') > 0.8 && headW(B, q.w) < 0.2 && q.p[1] > M.pit - 0.4, (nm) => ['spine_03', 'spine_02', 'neck_01', 'clavicle_l', 'clavicle_r'].includes(nm), 0.35);
  const shOf = (s) => mixOf(B, [[`shoulder_${s}`, 0.3], [`upperarm_${s}`, 0.05], [`clavicle_${s}`, 0.65]]);
  // (over the shoulders the arms', toward the middle the torso's)
  const wTop = (p) => { const k = smooth(0.55, 1.5, Math.abs(p[0])); return mixW([[W(p), 1 - k], [shOf(p[0] > 0 ? 'l' : 'r'), k]]); };
  // -- the ermine tippet: from the neck's foot to the upper chest before, over the shoulders' caps, the shoulder blades behind
  const front = (a) => Math.abs(wrapAngle(a));
  const eTop = (a) => n - 0.1 + 0.08 * smooth(0.8, 2.6, front(a));
  const eBot = (a) => { const f = front(a), sd = Math.sin(f) ** 2; return lerp([0, M.neckF - (female ? 0.42 : 0.46), 0], [0, M.pit + 0.15, 0], smooth(0.5, 2.4, f))[1] + (female ? 0.4 : 0.28) * Math.sin(f) ** 1.5 + (female ? 0.3 : 0.1) * Math.exp(-(((f - 2.1) / 0.45) ** 2)); };
  const NV = 48, NU = 7;
  const tippet = plateOn(C, { a0: -PI, a1: PI, closed: true, t0: (a) => ct(eBot(a)), t1: (a) => ct(eTop(a)), nu: NU, nv: NV, off: (u, v, tt, a) => 0.04 + 0.06 * Math.min(1, Math.abs(wrapAngle(a)) / 1.2) + (0.14 * Math.sin(a) ** 2 + 0.1 * Math.exp(-(((Math.abs(wrapAngle(a)) - 2.1) / 0.5) ** 2))) * (1 - u) + 0.05 * Math.sin(PI * Math.min(1, u * 1.2)) });
  const tip = smoothWeights(solid(tippet, { sheet: true, w: wTop, mat: () => 'ermine' }), 6);
  out.push(tip);
  const onTip = (p) => { let b = 0, d = Infinity; tip.V.forEach((q, i) => { const x = len(sub(q, p)); if (x < d) { d = x; b = i; } }); return tip.W[b]; };
  // (a soft roll along its hem and round the neck)
  out.push(tube(rowPath(tippet, 0, 0, NV, NV), { r: 0.07, k: 3, mat: 'ermine', w: onTip, closed: true }));
  out.push(tube(rowPath(tippet, NU, 0, NV, NV, 0.02), { r: 0.08, k: 3, mat: 'ermine', w: onTip, closed: true }));
  // (the tails: black, in staggered rows)
  for (const [fi, k0] of [[1.8, 0], [4.4, 0.5], [6.9, 0]]) for (let k = 0; k < 15; k++) {
    const q = tippet.at(fi, ((k + k0) / 15) * NV);
    out.push(stud(add(q.p, mul(q.n, 0.03)), q.n, { r: 0.075, h: 0.04, k: 3, mat: 'ermineT', w: () => onTip(q.p) }));
  }
  // -- the cloak: hung from under the tippet down the back in pleats deepening as they fall, flared clear of the legs
  // (from under the tippet down the back, standing off it more the further it falls, as a stiff cloak does; at each
  // height no wider than keeps its edges behind where the arms swing back, its hem rounded)
  const awT = female ? 0.75 : 0.85, PL = 5;
  const cTop = (a) => eBot(a) + 0.35;
  const deep = M.hip - (female ? 1.45 : 1.7), yEdge = M.hip + 0.2;
  const hem = (d) => deep + (yEdge - deep) * smooth(0.45, 1.0, d) ** 1.2;
  const pleat = (f, a) => (0.06 + 0.12 * f) * (0.5 - 0.5 * Math.cos(PL * (a - PI) * 2)) * smooth(0, 0.35, f);
  const stand = (f) => 0.03 + (female ? 0.62 : 0.72) * f ** 1.1;
  const xArm = female ? 0.95 : 1.15;
  const zArm = (yy) => (female ? [1.3, 1.5] : [1.5, 1.8]).reduce((x0, x1) => x0 + (x1 - x0) * smooth(M.pit + 0.3, A.elbow.l[1], yy));
  const fOf = (yy) => clamp((cTop(PI) - yy) / (cTop(PI) - deep));
  // (the widest it may be at a height: its edge, with its border, inside the arms' reach across or behind their swing)
  const edgeAt = (yy, a) => { const q = C2.ta(ct(yy), a), o = unit([q.n[0], 0, q.n[2]]); return add(add(q.p, mul(q.n, pleat(fOf(yy), a))), mul(o, stand(fOf(yy)))); };
  const HALF = new Map();
  const half = (yy) => {
    const key = Math.round(yy * 50);
    if (!HALF.has(key)) { let h = awT; for (; h > 0.2; h -= 0.02) { const p = edgeAt(yy, PI + h); if (Math.abs(p[0]) + 0.13 <= xArm || p[2] - zc(yy) <= -zArm(yy) - 0.13) break; } HALF.set(key, h); }
    return HALF.get(key);
  };
  const CU = 10, CV = 32;
  const cloakAt = (u, v) => {
    const d = Math.abs(2 * v - 1), an = PI + (2 * v - 1) * awT, y1 = cTop(an), y0 = hem(d), yy = y0 + (y1 - y0) * u, a = PI + (2 * v - 1) * half(yy);
    const q = C2.ta(ct(yy), a), f = fOf(yy), out = unit([q.n[0], 0, q.n[2]]);
    return { p: add(add(q.p, mul(q.n, pleat(f, a))), mul(out, stand(f))), n: q.n };
  };
  const cloak = patch(cloakAt, CU, CV);
  const wHem = mixOf(B, [['spine_02', 0.45], ['spine_01', 0.35], ['pelvis', 0.2]]);
  const wCloak = (p) => { const k = clamp((M.pit - 0.2 - p[1]) / (M.pit - 0.2 - deep)); return mixW([[W(p), 1 - k], [wHem, k]]); };
  const cloakP = smoothWeights(solid(cloak, { w: wCloak, thick: 0.03, mat: () => 'crimson', inner: 'royal', edge: 'royal' }), 8);
  out.push(cloakP);
  const onCl = (p) => { let b = 0, d = Infinity; cloakP.V.forEach((q, i) => { const x = len(sub(q, p)); if (x < d) { d = x; b = i; } }); return cloakP.W[b]; };
  // (its hem and its sides bound in gold)
  // (its hem and its sides bordered in ermine, a gold galloon inside the border)
  const rim = [...[...Array(CU).keys()].map((i) => [CU - 1 - i, 0]), ...[...Array(CV + 1).keys()].map((j) => [0, j]), ...[...Array(CU).keys()].map((i) => [i, CV])];
  out.push(tube(pathOn(cloak, rim, 0.02), { r: 0.11, k: 3, mat: 'ermine', w: onCl }));
  out.push(band(pathOn(cloak, rim.map(([i, j]) => [Math.max(i, 0.9), Math.min(CV - 0.9, Math.max(0.9, j))]), 0.0), { wide: 0.07, high: 0.03, mat: 'au', w: onCl }));
  rim.forEach(([i, j], k) => { if (k % 3 !== 1) return; const q = cloak.at(i, j); out.push(stud(add(q.p, mul(q.n, 0.1)), q.n, { r: 0.065, h: 0.04, k: 3, mat: 'ermineT', w: () => onCl(q.p) })); });
  // (the crown on its back, in gold: a band of jewels under five points, a pearl on each)
  const cAt = (yy, a) => { const v = 0.5 + (a - PI) / (2 * half(yy)), y1 = cTop(PI + (2 * v - 1) * awT), y0 = hem(Math.abs(2 * v - 1)); return cloak.at(((yy - y0) / (y1 - y0)) * CU, v * CV); };
  const cy = lerp([0, M.pit, 0], [0, M.waist, 0], 0.9)[1], Rr = len(sub(cAt(cy, PI).p, [0, cy, zc(cy)])), cw = female ? 0.66 : 0.88, ch = female ? 0.32 : 0.4;
  const crown = patch((u, v) => { const x = (v - 0.5) * 2 * cw, pk = (1 - Math.abs(Math.cos(v * 4 * PI)) ** 0.5) * 0, top = ch + ch * 1.4 * Math.max(0, Math.cos(v * 4 * PI)) ** 6 + pk; const q = cAt(cy + u * top, PI - x / Rr); return { p: add(q.p, mul(q.n, 0.05)), n: q.n }; }, 4, 32);
  out.push(solid(crown, { sheet: true, w: onCl, mat: () => 'rune' }));
  for (let k = 0; k <= 4; k++) { const x = (k / 4 - 0.5) * 2 * cw, q = cAt(cy + ch * 2.4 + 0.02, PI - x / Rr); out.push(stud(add(q.p, mul(q.n, 0.05)), q.n, { r: 0.07, h: 0.07, k: 5, mat: 'white', w: () => onCl(q.p) })); }
  for (let k = 0; k < 3; k++) { const x = ((k + 0.5) / 3 - 0.5) * 2 * cw, q = cAt(cy + ch * 0.45, PI - x / Rr); out.push(stud(add(q.p, mul(q.n, 0.07)), q.n, { r: 0.06, h: 0.05, k: 4, mat: 'ruby', w: () => onCl(q.p) })); }
  // -- the chain of office: over the tippet from shoulder to shoulder, down to the medallion on the breast and across the back
  const tipAt = (yy, a) => { const t0 = ct(eBot(a)), t1 = ct(eTop(a)); return tippet.at(clamp((ct(yy) - t0) / (t1 - t0)) * NU, ((wrapAngle(a) + PI) / (2 * PI)) * NV); };
  const chY = (a) => { const f = front(a); const yF = M.neckF - (female ? 0.14 : 0.16), yB = M.neckB - 0.55, ySh = eTop(a) - 0.14; return f < PI / 2 ? lerp([0, yF, 0], [0, ySh, 0], smooth(0, 1.35, f) ** 1.3)[1] : lerp([0, ySh, 0], [0, yB, 0], smooth(1.6, PI, f))[1]; };
  const chainPt = (a) => { const yy = chY(a); const q = yy > eBot(a) ? tipAt(yy, a) : C.ta(ct(yy), a); return { p: add(q.p, mul(q.n, yy > eBot(a) ? 0.12 : 0.14)), n: q.n }; };
  const links = 56, cp = [...Array(links).keys()].map((k) => chainPt(-PI + (2 * PI * k) / links));
  const wCh = (p) => onTip(p);
  out.push(tube(cp, { r: 0.04, k: 3, mat: 'auS', w: wCh, closed: true }));
  cp.forEach((q, k) => {
    if (Math.abs(wrapAngle(-PI + (2 * PI * k) / links)) < 0.12) return;
    out.push(k % 2 ? stud(q.p, q.n, { r: 0.065, h: 0.07, k: 4, mat: k % 4 === 1 ? 'ruby' : 'auL', w: () => wCh(q.p) }) : stud(q.p, q.n, { r: 0.11, h: 0.05, k: 4, mat: 'au', w: () => wCh(q.p) }));
  });
  // -- the medallion: a great sunburst hung from the chain's foot, a ruby at its heart
  const mq = chainPt(0), mo = unit(add(mq.n, [0, 0.1, 0.1])), mR = female ? 0.42 : 0.5;
  const mc = add(mq.p, add(mul(mo, 0.0), [0, -mR * 0.62, 0.02]));
  const wM = () => wCh(mq.p);
  out.push(tube([{ p: mq.p, n: mo }, { p: add(mc, [0, mR * 0.55, 0]), n: mo }], { r: 0.04, k: 4, mat: 'au', w: wM }));
  const sun = sunburst(add(mc, mul(mo, 0.03)), mo, { R: mR * 0.95, rays: 16, inner: 0.36, short: 0.72, dome: 0.03, mat: 'rune', w: wM });
  out.push(sun);
  // (behind the rays a disc of blue enamel, so the gold reads against it)
  const enamel = patch((u, v) => { const a = v * 2 * PI, rr = mR * 1.02 * u; return { p: add(mc, add(mul(mo, -0.02), add(mul(sun.frame.x, Math.cos(a) * rr), mul(sun.frame.y, Math.sin(a) * rr)))), n: mo }; }, 1, 16, { closed: true });
  out.push(solid(enamel, { sheet: true, w: wM, mat: () => 'enamel' }));
  out.push(tube([...Array(17).keys()].map((k) => { const a = (k / 16) * 2 * PI; return { p: add(mc, add(mul(mo, -0.02), add(mul(sun.frame.x, Math.cos(a) * mR * 1.04), mul(sun.frame.y, Math.sin(a) * mR * 1.04)))), n: mo }; }), { r: 0.045, k: 3, mat: 'auL', w: wM, closed: true }));
    out.push(stud(add(mc, mul(mo, 0.05)), mo, { r: mR * 0.26, h: 0.08, k: 6, mat: 'ruby', w: wM }));
  return coverHides(B, merge(...out), 0.6);
}

/* ---- legs ------------------------------------------------------------------------------------------------------------ */
/** The hose: the hips and the legs to the ankles, close over the skin, the skin under it left out; its waist (`crimsonW`) left out under any chest piece. */
function hose(B) {
  const A = B.at, M = torsoMarks(B);
  return shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'thigh', 'calf', 'torso', 'foot') > 0.6 && (on(B, i, 'thigh', 'calf', 'torso') > 0.6 || p[1] > A.ankle[s][1] + 0.05) && (on(B, i, 'foot') < 0.5 || p[1] > A.ankle[s][1] + 0.05) && on(B, i, 'upperarm', 'forearm', 'hand', 'shoulder') < 0.05 && p[1] < M.waist + 0.25 && p[1] > A.ankle[s][1] - 0.05; },
    off: () => 0.03,
    mat: ({ p }) => (p[1] > M.hip + 0.05 ? 'crimsonW' : 'crimson'),
  });
}
/**
 * One leg: the trunk hose (crimson panes over puffs of cloth of gold, swelling out from a gold waistband to a band
 * round the thigh), the cuisse on the thigh's lower half under it, the poleyn with its sun (lit when enchanted), the
 * greave with its etched band down the shin, and on the left the garter, blue, buckled in gold.
 */
function legOf(B, s) {
  const A = B.at, M = torsoMarks(B), sg = s === 'l' ? 1 : -1, hp = A.hip[s], kn = A.knee[s], an = A.ankle[s], out = [];
  const female = B.who === 'female';
  const legBones = (nm) => nm.endsWith(`_${s}`);
  const thPick = (q) => q.p[0] * sg > 0.06 && shareW(B, q.w, 'thigh', 'torso') > 0.85 && q.p[1] < M.waist + 0.1 && along(q.p, hp, kn) < 0.8;
  const tW = along([hp[0], M.waist - (female ? 0.34 : 0.48), hp[2]], hp, kn);
  const TH = limbWrap(B, hp, kn, sg, { t: [tW - 0.02, 1.02], nt: 26, a: [-PI, PI], closed: true, na: 32, pick: thPick, smooth: 4, shape: (r) => r });
  const wT = skinW(B, (q) => q.p[0] * sg > 0.12 && shareW(B, q.w, 'thigh') > 0.6 && along(q.p, hp, kn) > 0.25 && along(q.p, hp, kn) < 0.8, legBones);
  const wP = boneW(B, 'pelvis');
  const wHose = (p) => { const g = clamp((along(p, hp, kn) - tW + 0.05) / (0.56 - tW)); return mixW([[wP, 1 - g], [wT, g]]); };
  // -- the trunk hose: swelling out most on the outside and behind, little on the inside, gathered at both ends
  const h0 = tW + 0.06, h1 = 0.48, big = female ? 0.24 : 0.26;
  const swell = (tt, a) => { const f = clamp((tt - h0) / (h1 - h0)); return big * Math.sin(PI * f) ** 0.75 * smooth(0, 0.3, f) ** 0.5 * (0.2 + 0.8 * (0.5 + 0.5 * Math.cos(a - 2.0)) ** 0.7) * (1 + 0.15 * smooth(0.3, 1, f)); };
  const offH = (u, v, tt, a) => 0.08 + swell(tt, a);
  const panes = 10, hw = (PI / panes) * 0.64;
  const slit = (tt, a) => 0.09 * Math.max(0, Math.cos(panes * (a + PI))) ** 3 * Math.sin(PI * clamp((tt - h0) / (h1 - h0))) ** 0.35;
  const puff = plateOn(TH, { a0: -PI, a1: PI, closed: true, t0: () => h0, t1: () => h1, nu: 8, nv: 30, off: (u, v, tt, a) => offH(u, v, tt, a) + slit(tt, a) });
  out.push(solid(puff, { sheet: true, w: wHose, mat: () => 'goldcloth' }));
  for (let k = 0; k < panes; k++) {
    const ac = -PI + (2 * PI * (k + 0.5)) / panes;
    const g = plateOn(TH, { a0: ac - hw, a1: ac + hw, t0: () => h0, t1: () => h1, nu: 8, nv: 2, off: (u, v, tt, a) => offH(u, v, tt, a) + 0.035 + 0.02 * Math.sin(PI * v) });
    out.push(solid(g, { sheet: true, w: wHose, mat: () => 'crimson' }));
  }
  for (const [tt, r] of [[h1 - 0.01, 0.065]]) {
    const ring = [...Array(21).keys()].map((j) => { const a = -PI + (2 * PI * j) / 20, q = TH.ta(tt, a); return { p: add(q.p, mul(q.n, offH(0, 0, tt, a) + 0.03)), n: q.n }; });
    out.push(tube(ring, { r, k: 3, mat: 'au', w: wHose, closed: true }));
  }
  // -- the canion: fitted crimson from the hose's foot to the knee, three gold braids down it
  const can = plateOn(TH, { a0: -PI, a1: PI, closed: true, t0: () => h1 - 0.04, t1: () => 0.9, nu: 4, nv: 20, off: () => 0.09 });
  out.push(solid(can, { sheet: true, w: () => wT, mat: () => 'crimson' }));
  for (const j of [3, 7, 11]) out.push(tube(colPath(can, j, 0.3, 4, 4, 0.005), { r: 0.04, k: 3, mat: 'au', w: () => wT }));
  // -- the poleyn: a cop over the knee, a sunburst on its front
  const kPick = (q) => q.p[0] * sg > 0.12 && shareW(B, q.w, 'thigh', 'calf') > 0.8 && len(sub(q.p, kn)) < 0.9;
  const k0 = lerp(hp, kn, 0.84), k1 = lerp(kn, an, 0.14);
  const KN = limbWrap(B, k0, k1, sg, { t: [0, 1], nt: 10, a: [-PI, PI], closed: true, na: 28, pick: kPick, smooth: 4, shape: (r) => r });
  const wKn = boneW(B, `knee_${s}`);
  const cop = plateOn(KN, { a0: -1.6, a1: 1.6, t0: () => 0.0, t1: () => 1.0, nu: 7, nv: 14, off: (u, v) => 0.18 + 0.1 * Math.sin(PI * u) * Math.sin(PI * v) ** 0.7 });
  out.push(solid(cop, { sheet: true, w: () => wKn, mat: () => 'au' }));
  out.push(tube(rowPath(cop, 0, 0, 14, 14), { r: 0.04, k: 3, mat: 'auL', w: () => wKn }));
  out.push(tube(rowPath(cop, 7, 0, 14, 14), { r: 0.04, k: 3, mat: 'auL', w: () => wKn }));
  const kc = cop.at(3.5, 7), ko = unit(add(kc.n, [0, 0.1, 0]));
  out.push(sunburst(add(kc.p, mul(ko, 0.02)), ko, { R: female ? 0.3 : 0.34, rays: 12, inner: 0.45, short: 0.6, dome: 0.04, mat: 'rune', w: () => wKn }));
  out.push(stud(add(kc.p, mul(ko, 0.04)), ko, { r: 0.09, h: 0.08, k: 6, mat: 'auL', w: () => wKn }));
  // -- the greave: closed round the calf from under the poleyn to the ankle, a ridge down the shin and an etched band on it
  const cPick = (q) => q.p[0] * sg > 0.12 && shareW(B, q.w, 'calf') > 0.6;
  const SH = limbWrap(B, kn, an, sg, { t: [0, 1.02], nt: 20, a: [-PI, PI], closed: true, na: 26, pick: cPick, smooth: 4, shape: (r) => r });
  const wCa = skinW(B, (q) => cPick(q) && along(q.p, kn, an) > 0.2 && along(q.p, kn, an) < 0.85, legBones);
  const shin = (a) => 0.07 * Math.exp(-((a / 0.25) ** 2));
  const calf = (t, a) => 0.08 * Math.exp(-(((t - 0.33) / 0.17) ** 2)) * Math.max(0, -Math.cos(a)) ** 1.5;
  const GU = 7, GV = 14;
  const greave = plateOn(SH, { a0: -1.95, a1: 1.95, t0: () => 0.91, t1: () => 0.13, nu: GU, nv: GV, off: (u, v, t, a) => 0.11 + shin(a) + calf(t, a) + 0.08 * smooth(0.78, 0.91, t) ** 1.5 });
  out.push(solid(greave, { w: () => wCa, thick: 0.04, mat: () => 'au', inner: 'auD', edge: 'auS' }));
  out.push(tube(rowPath(greave, GU, 0, GV, GV), { r: 0.045, k: 3, mat: 'auL', w: () => wCa }));
  out.push(tube(rowPath(greave, 0, 0, GV, GV), { r: 0.045, k: 3, mat: 'auL', w: () => wCa }));
  for (const j of [0, GV]) out.push(tube(colPath(greave, j, 0, GU, GU), { r: 0.04, k: 3, mat: 'auL', w: () => wCa }));
  out.push(band(colPath(greave, GV / 2, 0.8, GU - 0.6, GU), { wide: 0.3, high: 0.015, mat: 'auE', w: () => wCa }));
  out.push(...scroll((x, sAl) => greave.at(GU - 0.8 - sAl * (GU - 1.6), GV / 2 + x * GV), { a0: 0.05, a1: 0.95, tm: () => 0, amp: 0.02, waves: 2, curl: 0.035, aScale: 0.28, turns: 1.2, r: 0.03, k: 3, mat: 'auL', w: () => wCa, lift: 0.03, steps: 14 }));
  // (the garter below the left knee: royal blue, a gold buckle, its end hanging)
  if (s === 'l') {
    const gt = 0.16, ring = [...Array(27).keys()].map((j) => { const a = -PI + (2 * PI * j) / 26, q = SH.ta(gt, a); return { p: add(q.p, mul(q.n, 0.17 + shin(a) + calf(gt, a))), n: q.n }; });
    out.push(band(ring, { wide: 0.14, high: 0.035, mat: 'royal', w: () => wCa, closed: true }));
    const bq = SH.ta(gt, 1.1), bo = bq.n, bp = add(bq.p, mul(bo, 0.2 + calf(gt, 1.1)));
    out.push(stud(bp, bo, { r: 0.09, h: 0.05, k: 4, mat: 'auL', w: () => wCa }));
    const tail = [0, 1, 2, 3].map((k) => ({ p: add(bp, add(mul(bo, 0.03), [0, -0.12 * k, 0.02 * k])), n: bo }));
    out.push(band(tail, { wide: 0.1, high: 0.02, mat: 'royal', w: () => wCa }));
  }
  return out;
}
export function goldLegs(B) {
  return { P: coverHides(B, merge(smoothWeights(hose(B), 6, (p) => p[1] > B.at.knee.l[1] + 0.6), ...legOf(B, 'l'), ...legOf(B, 'r')), 0.5), dropAt: (f) => f.mat === 'crimsonW' };
}

/* ---- boots ------------------------------------------------------------------------------------------------------------ */
/** One foot's bear-paw sabaton: lames over the instep to a broad square toe, fluted, over a crimson velvet shoe; a spur behind. */
function sabaton(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, an = A.ankle[s], ball = A.ball[s], out = [];
  const female = B.who === 'female';
  const fPick = (q) => q.p[0] * sg > 0.1 && shareW(B, q.w, 'foot') > 0.6;
  const toes = skinSamples(B).filter(fPick);
  const tip = toes.reduce((b, q) => (q.p[2] > b[2] ? q.p : b), [0, 0, -9]);
  const from = [an[0], an[1] - 0.05, an[2] + 0.05], to = [tip[0], A.floor + 0.22, tip[2] + 0.12];
  const tBall = along(ball, from, to), tToe = along(tip, from, to);
  // (broad at the toes: wider than the foot across, the end square and rounded)
  const FT = limbWrap(B, from, to, sg, { front: [0, 1, 0], t: [0, 1.0], nt: 26, a: [-PI, PI], closed: true, na: 24, pick: fPick, smooth: 4,
    shape: (r, t, a) => r * (1 + 0.22 * smooth(tBall - 0.15, tToe, t) * Math.sin(a) ** 2 - 0.32 * smooth(tBall - 0.2, tToe, t) * Math.max(0, Math.cos(a)) ** 2) * (t > 0.86 ? Math.max(0.05, Math.sqrt(Math.max(0, 1 - ((t - 0.86) / 0.145) ** 2))) : 1) });
  const wFoot = boneW(B, `foot_${s}`), wBall = boneW(B, `ball_${s}`);
  const lames = 3, l0 = 0.17, l1 = tBall - 0.04, h = (l1 - l0) / lames;
  for (let k = 0; k < lames; k++) {
    const t0 = l0 + h * k, t1 = t0 + h + 0.04;
    const g = plateOn(FT, { a0: -1.85, a1: 1.85, t0: () => t0, t1: () => t1, nu: 2, nv: 12, off: (u) => 0.09 - 0.01 * k + 0.03 * (1 - u) });
    out.push(solid(g, { hollow: true, w: () => wFoot, thick: 0.035, mat: () => 'auM', edge: 'auS' }));
    out.push(tube(rowPath(g, 2, 0, 12, 8), { r: 0.04, k: 3, mat: 'auL', w: () => wFoot }));
  }
  const TU = 8, TV = 14;
  const toe = plateOn(FT, { a0: -1.95, a1: 1.95, t0: () => tBall - 0.08, t1: () => 0.995, nu: TU, nv: TV, off: (u) => 0.06 * (1 - smooth(0.6, 1, u)) + 0.02 });
  out.push(solid(toe, { sheet: true, w: () => wBall, mat: () => 'au' }));
  out.push(tube(rowPath(toe, 0, 0, TV, TV), { r: 0.04, k: 3, mat: 'auL', w: () => wBall }));
  // (a rosette on the instep where the lames meet the toe, a ruby in it)
  { const q = toe.at(1.2, TV / 2), o = unit(add(q.n, [0, 0.4, 0]));
    out.push(sunburst(add(q.p, mul(o, 0.02)), o, { R: female ? 0.15 : 0.18, rays: 8, inner: 0.45, short: 0.7, dome: 0.03, mat: 'auL', w: () => wBall }), stud(add(q.p, mul(o, 0.04)), o, { r: 0.06, h: 0.06, k: 4, mat: 'rubyLit', w: () => wBall })); }
  // (its flutes: four raised ridges fanning to the toe)
  for (const j of [4.2, 7, 9.8]) out.push(tube(colPath(toe, j, 0.5, TU - 0.6, 5, 0.01), { r: 0.035, k: 3, mat: 'auL', w: () => wBall }));
  const under = plateOn(FT, { a0: PI - 1.2, a1: PI + 1.2, t0: () => tBall - 0.08, t1: () => 0.995, nu: 5, nv: 6, off: (u) => 0.06 * (1 - smooth(0.6, 1, u)) + 0.02 });
  out.push(solid(under, { sheet: true, w: () => wBall, mat: () => 'sole' }));
  // -- the heel cup: a gold shell over the back of the heel, its rim rolled
  {
    const hPick = (q) => fPick(q) && q.p[2] < an[2] + 0.1 && q.p[1] < an[1] + 0.25;
    const hc = [an[0], an[1] - 0.3, an[2] + 0.1];
    const HD = domeWrap(B, { c: hc, u: [0, -0.35, -1], f: [0, 1, 0], s: [sg, 0, 0], pick: hPick, rows: 8, cols: 16, thMax: 1.5, cone: 0.35, smooth: 3, shape: (r) => r + 0.08 });
    const cup = plateOn(HD, { a0: -PI, a1: PI, closed: true, t0: () => 0, t1: (a) => 0.55 + 0.08 * Math.max(0, -Math.cos(a)), nu: 4, nv: 16, off: () => 0 });
    out.push(solid(cup, { sheet: true, w: () => wFoot, mat: () => 'au' }));
    out.push(tube(rowPath(cup, 4, 0, 16, 10), { r: 0.035, k: 3, mat: 'auL', w: () => wFoot, closed: true }));
  }
  // -- the spur: a neck out behind the heel, a gold rowel at its end
  const heel = toes.reduce((b, q) => (q.p[2] < b[2] && q.p[1] < an[1] - 0.2 ? q.p : b), [0, 0, 9]);
  const sp0 = add(heel, [0, 0.16, -0.05]), sp1 = add(sp0, [0, -0.1, female ? -0.42 : -0.5]);
  out.push(tube([{ p: sp0, n: [0, 1, 0] }, { p: sp1, n: [0, 1, 0] }], { r: 0.04, k: 4, mat: 'au', w: () => wFoot }));
  const strap = [...Array(17).keys()].map((j) => { const a = -PI + (2 * PI * j) / 16, q = FT.ta(0.07, a); return { p: add(q.p, mul(q.n, 0.09)), n: q.n }; });
  out.push(band(strap, { wide: 0.16, high: 0.04, mat: 'au', w: () => wFoot, closed: true }));
  out.push(sunburst(sp1, [sg, 0, 0], { R: female ? 0.22 : 0.26, rays: 8, inner: 0.3, short: 1, dome: 0, mat: 'auL', w: () => wFoot }));
  return out;
}
/** The crimson velvet shoe under the sabatons: the foot and the ankle's foot, close over the skin, stood on. */
function shoe(B) {
  const A = B.at;
  const P = shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'foot', 'calf') > 0.6 && p[1] < A.ankle[s][1] + 0.3; },
    off: ({ n }) => 0.045 + (n[1] < -0.6 ? 0.06 : 0),
    mat: ({ n }) => (n[1] < -0.55 ? 'sole' : 'crimsonD'),
  });
  P.soles = P.V.map((_, i) => i).filter((i) => P.V[i][1] < A.floor + 0.12);
  return P;
}
export function goldBoots(B) {
  return merge(shoe(B), ...sabaton(B, 'l'), ...sabaton(B, 'r'));
}
