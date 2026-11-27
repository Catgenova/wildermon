// The electrum set: the Immortal, the guard of an ancient Persian court, built with the plate kit
// (tools/sculpt/garments/platekit.mjs) and the set's own builders (tools/sculpt/garments/kit/electrum.mjs): the pale
// green-gold alloy of royal coinage over lapis-blue and saffron cloth and royal purple.
//
//   helm    the tiara: a fluted electrum cap with purple felt between its flutes, curled forward to a soft peak, rising
//           out of a crown of stepped merlons glazed in turquoise on a brow band of rosettes, the gem at its front; under
//           it a purple hood under a scale aventail, a saffron-bound chin wrap, the face open from the brow to the lip.
//   chest   a lapis robe with a standing collar, a corselet of electrum tongue scales from the hips to an electrum-bordered
//           neckline, a twisted torque with lions' heads, a purple sash with a rosette clasp and tasselled ends, the
//           robe's skirt split at each thigh, scale sleeves, armlets, banded cuffs and bracelets, an akinakes on the thigh.
//   mantle  the royal pectoral: an electrum crescent over the breast set with a band of turquoise glaze and rosettes,
//           drops along its foot, raised rosette clasps at its horns, a crescent pendant; behind, a glazed-brick panel
//           bordered in saffron with a merlon frieze, and over it the winged sun standing free of the back.
//   legs    purple anaxyrides, full over the shin, gathered at the ankle in saffron, a band of lozenges down each shin,
//           knee guards of electrum scales.
//   boots   soft tan ankle boots, the toe curled up and back under an electrum sheath, an electrum toe plate, saffron
//           lacing between electrum eyelets, an electrum ankle band.
//
// Enchanted, five things light: the tiara's gem, the torque's lions' eyes, the winged sun's disc, the knee guards' rims,
// the boots' ankle gems.
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, smooth, merge, shell, on } from './metalkit.mjs';
import {
  skinSamples, boneW, mixOf, mixW, wrapAngle, plateOn, solid, tube, band, rowPath, colPath, stud, studsAlong, gridOf, domeWrap, ellipsoidReach,
  shareW, sweep, coverHides, roundProfile, patch, nearSkinW, skinW, limbWrap, along, smoothWeights, torsoWrap, torsoMiddle,
} from './platekit.mjs';
import { headW, torsoField, torsoMarks, TORSO_BONES } from './kit/gold.mjs';
import { rosette, crescent, frameAt, merlon, scaleRows, torque, tassel } from './kit/electrum.mjs';

const PI = Math.PI, TAU = 2 * PI;

export const ELECTRUM_MATS = {
  // (the alloy: a pale green-gold field, polished crests near white-gold, olive shade where plates lap and recess)
  el: { c: '#b8a95a', kind: 3 },
  elB: { c: '#d3c57a', kind: 3 },
  elM: { c: '#8c7e3a', kind: 3 },
  elL: { c: '#efe9b4', kind: 3 },
  elS: { c: '#5e5326', kind: 3 },
  elD: { c: '#2e2812', kind: 3 },
  // (the gems: turquoise glaze, lit in the enchantment's colour)
  rune: { c: '#3aa6a8', kind: 3, lit: { c: '#ffe7a6', kind: 1 } },
  turq: { c: '#2f8f98', kind: 3 },
  glaze: { c: '#1f6e8c', kind: 2 },
  rune2: { c: '#2f8f98', kind: 3 },
  // (the cloth: lapis blue, saffron, royal purple)
  lapis: { c: '#16225c', kind: 2 },
  lapisD: { c: '#0d1438', kind: 2 },
  saffron: { c: '#e3a531', kind: 0 },
  saffronD: { c: '#a96e1b', kind: 0 },
  purple: { c: '#5d2569', kind: 0 },
  purpleD: { c: '#3b1544', kind: 0 },
  purpleL: { c: '#7d3a8a', kind: 0 },
  purpleW: { c: '#5d2569', kind: 0 },
  tan: { c: '#c08a4c', kind: 0 },
  tanD: { c: '#80562c', kind: 0 },
  sole: { c: '#2d2118', kind: 2 },
};

/* ---- the helm ---------------------------------------------------------------------------------------------------- */
/**
 * The tiara: a fluted cap of electrum over the skull, drawn up and curled forward to a soft peak; its brow band of
 * rosettes, rolled bright above and below, a crescent and the lit gem at the front. Under it the hood of purple cloth:
 * down over the ears, the nape and the neck, open before from the band to the lip; a saffron wrap wound across the
 * chin and the throat over it. Rigid on the head, the hood's foot going over to the neck.
 */
export function electrumHelm(B) {
  const A = B.at, fem = B.who === 'female', out = [];
  const pick = (q) => headW(B, q.w) > 0.45 || (shareW(B, q.w, 'neck', 'head') > 0.8 && q.p[1] > A.neck[1] && shareW(B, q.w, 'shoulder', 'upperarm', 'torso') < 0.02);
  const hs = skinSamples(B).filter((q) => headW(B, q.w) > 0.45);
  const top = Math.max(...hs.map((q) => q.p[1])), bot = Math.min(...hs.map((q) => q.p[1]));
  const zf = Math.max(...hs.map((q) => q.p[2])), zb = Math.min(...hs.map((q) => q.p[2])), xw = Math.max(...hs.map((q) => q.p[0]));
  const c = [0, bot + 0.56 * (top - bot), (zf + zb) / 2], fit = fem ? 0.08 : 0.1;
  const E = [xw + fit, top - c[1] + fit, (zf - zb) / 2 + fit];
  const D = domeWrap(B, { c, u: [0, 1, 0], f: [0, 0, 1], s: [1, 0, 0], pick, rows: 36, cols: 48, thMax: PI, cone: 0.28, smooth: 4, shape: (r, th, ph, d) => Math.max(r + fit - 0.02, th < 2.2 ? ellipsoidReach(E, d) : 0) });
  const thOf = (p) => Math.acos(clamp(unit(sub(p, c))[1], -1, 1));
  const browTh = thOf([0, A.head[1] + 0.62 * (top - A.head[1]) / 1.6, zf]);
  const wHead = boneW(B, 'head'), wNeck = mixOf(B, [['neck_02', 0.5], ['neck_01', 0.5]]);
  const w = () => wHead;
  // (the hood's foot goes over from the head to the neck as it falls, so it bends with the neck)
  const wHood = (p) => { const k = smooth(c[1] - 0.8 * E[1], A.neck[1] + 0.1, p[1]); return mixW([[wHead, 1 - k], [wNeck, k]]); };
  // -- where things run: the band (its foot just over the brows), the face's opening (to the lip), the hood's foot
  const bandLo = browTh - (fem ? 0.2 : 0.22), bandHi = bandLo - (fem ? 0.2 : 0.22);
  const phO = fem ? 0.74 : 0.8, lipTh = fem ? 2.3 : 2.33;
  const footTh = (ph) => { const f = Math.abs(wrapAngle(ph)); return (fem ? 2.74 : 2.76) - (fem ? 0.14 : 0.26) * smooth(0.9, 1.6, f) - (fem ? 0 : 0.06) * smooth(1.9, 2.8, f); };
  // -- the hood: purple cloth down from under the band, open before; soft folds down the nape
  const fold = (a, t) => 0.035 * Math.max(0, Math.cos(7 * a)) ** 2 * smooth(1.9, 2.6, t) * smooth(1.2, 2.2, Math.abs(wrapAngle(a)));
  const NH = 28;
  const hood = plateOn(D, { a0: phO, a1: TAU - phO, t0: () => (bandLo + 0.05) / PI, t1: (a) => footTh(a) / PI, nu: 10, nv: NH, off: (u, v, t, a) => 0.015 + 0.03 * smooth(0.5, 1, u) + fold(a, t * PI) });
  out.push(solid(hood, { sheet: true, w: (p) => wHood(p), mat: (i, j) => (i >= 9 ? 'saffron' : 'purpleD') }));
  // (its edges round the face, bound in saffron)
  for (const j of [0, NH]) out.push(tube(colPath(hood, j, 0, 7, 8, 0.01), { r: 0.035, k: 4, mat: 'saffron', w: (p) => wHood(p) }));
  out.push(tube(rowPath(hood, 10, 0, NH, NH, 0.0), { r: 0.03, k: 3, mat: 'saffronD', w: (p) => wHood(p) }));
  // -- the chin wrap: a broad band of the cloth wound over the hood across the chin and the throat, its top edge
  // rounded up into the cheeks, bound in saffron
  const cw = phO + 0.45;
  const wrapTop = (a) => lipTh - 0.28 * smooth(phO - 0.35, phO + 0.05, Math.abs(a)) - 0.3 * smooth(phO + 0.05, cw, Math.abs(a));
  const NC = 16;
  const chin = plateOn(D, { a0: -cw, a1: cw, t0: (a) => wrapTop(a) / PI, t1: (a) => (footTh(a) - 0.1) / PI, nu: 6, nv: NC, off: (u, v) => 0.045 + 0.03 * Math.sin(PI * v) * smooth(0.0, 0.4, u) });
  out.push(solid(chin, { sheet: true, w: (p) => wHood(p), mat: (i) => (i < 1 ? 'saffron' : 'purpleL') }));
  out.push(tube(rowPath(chin, 0, 0, NC, NC, 0.005), { r: 0.035, k: 4, mat: 'saffron', w: (p) => wHood(p) }));
  // (the wrap's turns: two folds across it)
  for (const f of [3.3]) out.push(tube(rowPath(chin, f, 1, NC - 1, NC - 2, 0.0), { r: 0.022, k: 3, mat: 'purpleD', w: (p) => wHood(p) }));
  // -- the band: round the brow, rolled bright above and below, rosettes round it
  const NB = 48;
  const bandG = plateOn(D, { a0: -PI, a1: PI, closed: true, t0: () => bandHi / PI, t1: () => bandLo / PI, nu: 2, nv: NB, off: () => 0.075 });
  out.push(solid(bandG, { hollow: true, thick: 0.06, w, mat: () => 'elM', edge: 'elS' }));
  out.push(tube(rowPath(bandG, 0, 0, NB, 32), { r: 0.035, k: 3, mat: 'elL', w, closed: true }));
  out.push(tube(rowPath(bandG, 2, 0, NB, 32), { r: 0.035, k: 3, mat: 'elL', w, closed: true }));
  const nR = fem ? 9 : 10;
  for (let k = 0; k < nR; k++) {
    const a = wrapAngle((TAU * k) / nR + PI / nR), q = bandG.at(1, ((a + PI) / TAU) * NB);
    out.push(...rosette(add(q.p, mul(q.n, 0.01)), q.n, { R: fem ? 0.1 : 0.115, petals: 8, fine: 2, mat: 'elB', heart: 'elS', heartR: 0.4, w, dome: 0.02, cup: 0.03 }));
  }
  // -- the crown: stepped merlons standing round the band's top, a gap between each
  const NW = 32, base = (j) => { const q = bandG.at(0, (j / NW) * NB); return { p: q.p, hz: unit([q.p[0] - c[0], 0, q.p[2] - c[2]]) }; };
  const rimAt = (v, lift = 0) => { const b = base(v * NW); return add(add(b.p, [0, lift, 0]), mul(b.hz, 0.035 * lift)); };
  const nM = fem ? 9 : 10, mH = fem ? 0.38 : 0.44, mW = 0.7 / nM;
  for (let k = 0; k < nM; k++) {
    const v0 = k / nM;
    out.push(merlon((x, yy) => { const v = v0 + (x - 0.5) * mW, b = base(v * NW); return { p: add(rimAt(v, mH * yy), mul(b.hz, 0.01 + 0.1 * yy)), n: b.hz }; }, { thick: 0.06, w, mat: (i) => (i === 0 ? 'elM' : 'turq'), back: 'elS', edge: 'elL' }));
  }
  // -- the cap: purple felt rising out of the crown, full, drawn up and curled forward into a soft peak; electrum
  // ribs up it from the crown to the peak's knop
  const ring = [...Array(NW).keys()].map((j) => sub(rimAt(j / NW, 0), mul(base(j).hz, 0.12)));
  const C0 = mul(ring.reduce((s2, p) => add(s2, p), [0, 0, 0]), 1 / NW), Lp = fem ? 1.05 : 1.2, bend = 1.9;
  // (its axis: up out of the crown, bending forward and over as it goes)
  const NS = 10, axis = [{ p: C0, th: 0 }];
  for (let k = 1; k <= NS; k++) { const th = bend * (k / NS) ** 1.7, pr = axis[k - 1]; axis.push({ p: add(pr.p, mul([0, Math.cos(th), Math.sin(th)], Lp / NS)), th }); }
  const axAt = (u) => { const f = u * NS, k = Math.min(NS - 1, Math.floor(f)), g = f - k; return { p: lerp(axis[k].p, axis[k + 1].p, g), th: axis[k].th + (axis[k + 1].th - axis[k].th) * g }; };
  const rot = (v, th) => [v[0], v[1] * Math.cos(th) - v[2] * Math.sin(th), v[1] * Math.sin(th) + v[2] * Math.cos(th)];
  const capR = (u) => (1 + 0.06 * Math.sin(PI * Math.min(1, u * 2.2))) * (1 - u) ** 0.9;
  const cap = patch((u, v) => {
    const j = v * NW, j0 = Math.floor(j) % NW, j1 = (j0 + 1) % NW, f = j - Math.floor(j), r0 = sub(lerp(ring[j0], ring[j1], f), C0), A2 = axAt(u);
    // (eight electrum flutes, each standing proud, the felt showing in the channel between)
    const g = (v * 8) % 1, flute = g < 0.74 ? (fem ? 0.05 : 0.06) * Math.sin(PI * Math.min(1, g / 0.74)) ** 0.6 : 0;
    const d0 = mul([r0[0], 0, r0[2]], capR(u)), dl0 = len(d0) || 1;
    const d = rot(mul(d0, (dl0 + flute * (1 - u) ** 0.5) / dl0), A2.th);
    // (never nearer the skull than a finger: out from the head's middle to clear the dome under it)
    const p = add(A2.p, d), dv = sub(p, c), dl = len(dv), dd = mul(dv, 1 / dl), th = Math.acos(clamp(dd[1], -1, 1)), need = len(sub(D.ta(th / PI, Math.atan2(dd[0], dd[2])).p, c)) + 0.05;
    return { p: dl < need ? add(c, mul(dd, need)) : p, n: unit(d) };
  }, NS, NW, { closed: true });
  out.push(solid(cap, { sheet: true, w, mat: (i, j) => ['elB', 'el', 'elM', 'purple'][j % 4] }));
  // (a bright line down each flute's crest)
  for (let k = 0; k < 8; k++) out.push(tube(colPath(cap, k * 4 + 1.5, 0.2, NS - 1.2, 5, 0.012), { r: 0.018, k: 3, mat: 'elL', w }));
  // -- the diadem's ties: two saffron ribbons from the band's back down the hood to the nape, their ends cut in a fork
  for (const sd of [-1, 1]) {
    const pts = [];
    for (let k = 0; k <= 8; k++) { const f = k / 8, a = PI + sd * (0.12 + 0.22 * f), th = bandLo + (footTh(a) - 0.12 - bandLo) * f, q = D.ta(th / PI, a); pts.push({ p: add(q.p, mul(q.n, 0.06 + 0.02 * f)), n: q.n }); }
    out.push(band(pts, { wide: fem ? 0.13 : 0.15, high: 0.012, sink: 0.012, mat: 'saffron', w: (p) => wHood(p) }));
  }
  out.push(stud(axAt(0.98).p, rot([0, 1, 0], bend), { r: 0.07, h: 0.1, k: 6, mat: 'elL', w }));
  // -- the aventail: rows of electrum scales over the hood from under the band round the sides and the back, the hood's
  // purple showing below them and round the face
  const avBot = (a) => footTh(a) - (fem ? 0.3 : 0.28);
  out.push(...scaleRows((yy, a) => D.ta(-yy / PI, a), {
    y0: -(fem ? 2.42 : 2.36), y1: -(bandLo + 0.04), rowH: fem ? 0.19 : 0.2, lap: 0.5, a0: phO + 0.12, a1: TAU - phO - 0.12,
    n: () => (fem ? 11 : 12), off: () => 0.06, climb: 0.01, wide: 0.6, tilt: 0.04, dome: 0.02, sheet: true,
    skip: (yTip, a) => -yTip > avBot(a) + 0.02, w: (p) => wHood(p), mat: 'el', matL: 'elB', matS: 'elS', edge: 'elS',
  }));
  // -- the front: the gem on the band under the front merlon, in a ring of petals
  const fq = bandG.at(1, NB / 2), fo = unit(add(fq.n, [0, 0.1, 0]));
  out.push(...rosette(add(fq.p, mul(fo, 0.02)), fo, { R: fem ? 0.23 : 0.26, petals: 12, fine: 2, mat: 'elB', mat2: 'el', heart: null, w, dome: 0.03, cup: 0.03 }));
  out.push(stud(add(fq.p, mul(fo, 0.06)), fo, { r: fem ? 0.15 : 0.17, h: 0.12, k: 6, mat: 'rune', w }));
  const P = merge(...out);
  // (the head's own polygons under the cap and the hood left out where the helm covers them)
  return coverHides(B, P, 0.45);
}

/* ---- chest & arms ------------------------------------------------------------------------------------------------ */
const y = (p) => p[1];
const headOnly = (B, i) => headW(B, B.W[i]);
/** Where the corselet runs: its neckline before and behind, cut round to the armpit at the sides. */
function corseletLine(B, M) {
  const side = PI / 2 + 0.04, aN = 0.62, bN = 0.6;
  const topF = (a) => { const ax = Math.abs(a), yC = M.neckF + 0.12; if (ax <= aN) return M.neckF - 0.1 + 0.22 * (ax / aN) ** 2; const k = clamp((ax - aN) / (side - aN)); return M.pit + (yC - M.pit) * Math.max(0, 1 - k) ** 0.9; };
  const topB = (a) => { const bx = PI - Math.abs(wrapAngle(a)), yC = M.neckB + 0.08; if (bx <= bN) return M.neckB - 0.06 + 0.14 * (bx / bN) ** 2; const k = clamp((bx - bN) / (PI - side + 0.04 - bN)); return M.pit + (yC - M.pit) * Math.max(0, 1 - k * k) ** 0.8; };
  const top = (a) => (Math.abs(wrapAngle(a)) < PI / 2 ? topF(wrapAngle(a)) : topB(a));
  // (its hem: over the hips, a little higher behind, clear of the seat)
  const hem = (a) => M.hip + 0.05 + 0.22 * smooth(1.7, 2.8, Math.abs(wrapAngle(a))) + 0.2 * Math.exp(-((wrapAngle(a) / 0.35) ** 2));
  return { side, topF, topB, top, hem };
}
/** The robe: lapis blue over the torso, the neck and the arms to the wrists, a little off the skin, the skin under it left out. */
function robe(B) {
  const A = B.at, M = torsoMarks(B), F = torsoField(B), L = corseletLine(B, M);
  return shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i]; return on(B, i, 'torso', 'shoulder', 'upperarm', 'forearm', 'neck', 'head', 'thigh') > 0.6 && headOnly(B, i) < 0.05 && on(B, i, 'hand') < 0.35 && y(p) > M.hip - 0.3 && on(B, i, 'thigh') < 0.5 && y(p) < A.neck[1] + 0.5; },
    // (closer in the armpit's fold, where the arm's skin meets the side's)
    off: ({ p }) => (0.055 + 0.02 * smooth(M.waist, M.hip, y(p)) + 0.03 * smooth(A.neck[1] - 0.6, A.neck[1] - 0.1, y(p))) * (1 + 0.8 * Math.exp(-(((y(p) - A.shoulder.l[1] + 0.6) / 0.3) ** 2)) * smooth(0.95, 1.2, Math.abs(p[0]))),
    // (none under the corselet, where nothing shows)
    mat: ({ p, n, bv }) => { const s2 = p[0] >= 0 ? 'l' : 'r', ua = along(p, A.shoulder[s2], A.elbow[s2]); if (on(B, bv, 'upperarm', 'shoulder') > 0.8 && ua > 0.08 && ua < 0.4 && n[0] * Math.sign(p[0]) > 0.2) return null; if (on(B, bv, 'torso') < 0.9) return 'lapis'; if (y(p) < M.hip - 0.1 && Math.abs(p[0]) < 0.45) return null; const a = Math.atan2(p[0], p[2] - F.zc(y(p))); return y(p) > L.hem(a) + 0.2 && y(p) < L.top(a) - 0.25 && Math.abs(p[0]) > 0.2 ? null : 'lapis'; },
  });
}

/** The corselet: rows of electrum scales from the hips to the neckline, a bordered neckline, the sash, the torque. */
function corselet(B) {
  const A = B.at, M = torsoMarks(B), F = torsoField(B), t = F.tOfY, fem = B.who === 'female', out = [];
  const W = nearSkinW(B, (q) => shareW(B, q.w, 'torso') > 0.7, (n) => TORSO_BONES.has(n), 0.35);
  const L = corseletLine(B, M);
  const at = (yy, a) => F.ta(t(yy), a);
  const bulge = (yy, a) => (fem ? 0.03 : 0.06) * Math.exp(-(((yy - lerp(A.chest, [0, M.waist, 0], 0.35)[1]) / 0.9) ** 2)) * Math.max(0, Math.cos(a)) ** 1.5;
  // (under the arms, nearer the body)
  const pit = (yy, a) => Math.exp(-(((Math.abs(wrapAngle(a)) - PI / 2) / 0.4) ** 2)) * smooth(M.pit - 0.9, M.pit, yy);
  const off = (yy, a) => 0.12 + bulge(yy, a) - 0.05 * pit(yy, a);
  const rowH = fem ? 0.35 : 0.39, y0 = M.hip + 0.05;
  out.push(...scaleRows(at, {
    y0, y1: Math.max(L.topF(0), L.topB(PI)), rowH, lap: 0.32, n: (yy) => (fem ? 15 : 16), off, climb: 0.006, wide: 0.6, tilt: 0.05, dome: 0.025, sheet: true,
    top: (a) => L.top(a) - 0.05, skip: (yTip, a) => yTip < L.hem(a) - 0.02, w: W, mat: 'el', matL: 'elB', matS: 'elS', nu: 3, nv: 2, tipW: 0.45,
  }));
  // -- the neckline: an electrum border along the corselet's top, rolled bright at both edges, round the armholes too
  const NV = 40, nk = plateOn(F, { a0: -PI, a1: PI, closed: true, t0: (a) => t(L.top(a) - 0.16), t1: (a) => t(L.top(a) + 0.02), nu: 2, nv: NV, off: (u, v, tt, a) => off(F.yOfT(tt), a) + 0.09 + 0.03 * u });
  out.push(solid(nk, { sheet: true, w: W, mat: () => 'elM' }));
  out.push(tube(rowPath(nk, 2, 0, NV, 40), { r: 0.035, k: 3, mat: 'elL', w: W, closed: true }));
  out.push(tube(rowPath(nk, 0, 0, NV, 40), { r: 0.03, k: 3, mat: 'el', w: W, closed: true }));
  // -- the sash: purple, wound round the waist over the scales, its edges saffron; knotted on the left before, a
  // rosette clasp over the knot, its two ends hung down the thigh with tassels
  const sy = M.waist - 0.05, sw = fem ? 0.2 : 0.22, NS = 32;
  const sash = plateOn(F, { a0: -PI, a1: PI, closed: true, t0: () => t(sy - sw), t1: () => t(sy + sw), nu: 2, nv: NS, off: (u, v, tt, a) => off(F.yOfT(tt), a) + 0.09 + 0.02 * Math.sin(PI * u) });
  out.push(solid(sash, { sheet: true, w: W, mat: (i) => 'purple' }));
  for (const r of [0, 2]) out.push(tube(rowPath(sash, r, 0, NS, 28, 0.0), { r: 0.04, k: 3, mat: 'saffron', w: W, closed: true }));
    const ka = fem ? 0.55 : 0.6, kq = sash.at(1, ((ka + PI) / TAU) * NS), ko = kq.n;
  out.push(...rosette(add(kq.p, mul(ko, 0.06)), ko, { R: fem ? 0.2 : 0.23, petals: 8, fine: 2, mat: 'elB', mat2: 'el', heart: 'elM', heartR: 0.38, w: W, dome: 0.04, cup: 0.04 }));
  out.push(stud(add(kq.p, mul(ko, 0.02)), ko, { r: fem ? 0.2 : 0.22, h: 0.06, k: 6, mat: 'purpleD', w: W }));
  // (its two ends hung from the knot down the thigh, each ending in a saffron tassel; on the thigh's bones as they fall)
  const hp = A.hip.l, kn = A.knee.l, wP = boneW(B, 'pelvis');
  const wT = skinW(B, (q) => q.p[0] > 0.12 && shareW(B, q.w, 'thigh') > 0.6 && along(q.p, hp, kn) > 0.25 && along(q.p, hp, kn) < 0.8, (n) => n.endsWith('_l'));
  const wEnd = (p) => { const f = smooth(sy - 0.1, sy - 0.8, p[1]); return mixW([[W(p), 1 - f], [mixW([[wP, 0.25], [wT, 0.75]]), f]]); };
  for (const [da, L2, sw2] of [[-0.12, fem ? 1.45 : 1.65, 0.16], [0.16, fem ? 1.2 : 1.35, 0.14]]) {
    const a = ka + da, top = add(kq.p, mul(ko, 0.05)), path = [];
    for (let k = 0; k <= 8; k++) { const f = k / 8, q = F.ta(t(sy - 0.1 - L2 * f), a + 0.12 * f); path.push({ p: add(q.p, mul(q.n, off(sy - L2 * f, a) + 0.3 + 0.04 * f)), n: q.n }); }
    path[0] = { p: top, n: ko };
    out.push(band(path, { wide: sw2 * 2, high: 0.015, sink: 0.015, mat: 'purple', w: wEnd }));
    out.push(tube(path.map((q) => ({ p: add(q.p, mul(q.n, 0.02)), n: q.n })), { r: 0.018, k: 3, mat: 'saffron', w: wEnd }));
    const e = path[8], d = unit(sub(path[8].p, path[7].p));
    out.push(...tassel(e.p, d, { L: 0.06, S: 0.32, r: 0.035, mat: 'saffron', knot: 'elB', w: () => wEnd(e.p) }));
  }
  // -- the collar: the robe's standing collar round the neck, from its foot up under the hood, its top edge saffron
  const n0 = [0, A.neck[1] - 0.6, A.neck[2] - 0.02], n1 = [0, A.neck[1] + 0.55, A.neck[2] + 0.08];
  const nPick = (q) => (shareW(B, q.w, 'neck', 'head') > 0.5 && headW(B, q.w) < 0.3) || (shareW(B, q.w, 'torso') > 0.5 && q.p[1] > A.neck[1] - 0.65 && Math.abs(q.p[0]) < 1.1 && shareW(B, q.w, 'shoulder', 'upperarm') < 0.05);
  const NK = limbWrap(B, n0, n1, 1, { t: [0, 1], nt: 16, a: [-PI, PI], closed: true, na: 24, pick: nPick, smooth: 4, shape: (r) => r });
  const wNk0 = mixOf(B, [['spine_03', 0.7], ['neck_01', 0.3]]), wNk1 = mixOf(B, [['neck_01', 0.6], ['neck_02', 0.4]]);
  const wCol = (p) => { const f = smooth(0.2, 0.75, along(p, n0, n1)); return mixW([[wNk0, 1 - f], [wNk1, f]]); };
  const colTop = (a) => (fem ? 0.6 : 0.62) - 0.06 * Math.cos(a);
  const NCo = 24, col = plateOn(NK, { a0: -PI, a1: PI, closed: true, t0: () => (fem ? 0.2 : 0.3), t1: colTop, nu: 4, nv: NCo, off: (u) => 0.06 + 0.02 * (1 - u) });
  out.push(solid(col, { sheet: true, w: wCol, mat: (i) => (i === 3 ? 'saffron' : 'lapis') }));
  out.push(tube(rowPath(col, 4, 0, NCo, NCo, 0.0), { r: 0.03, k: 3, mat: 'saffronD', w: wCol, closed: true }));
  // -- the torque: a twisted electrum ring round the collar's foot, open before, its ends two lions' heads, their eyes lit
  const wNk = mixOf(B, [['spine_03', 0.55], ['neck_01', 0.45]]);
  const ringAt = (s2) => { const a = 0.4 + (TAU - 0.8) * s2, tt = (fem ? 0.27 : 0.36) + 0.08 * (1 - Math.cos(a)) / 2, q = NK.ta(tt, a); return { p: add(q.p, mul(unit([q.n[0], 0, q.n[2]]), fem ? 0.17 : 0.19)), n: [0, 1, 0] }; };
  out.push(...torque(ringAt, { r: fem ? 0.07 : 0.08, steps: 30, twists: 9, head: fem ? 0.2 : 0.23, mat: 'elB', headMat: 'el', eye: 'rune', w: () => wNk }));
  return { out, L, F, W, off, sash, ka, NS };
}

/** The skirt of the robe: lapis panels from under the corselet's hem down each thigh, open on the inside, banded in saffron and purple at the hem. */
function robeSkirt(B, C) {
  const A = B.at, M = torsoMarks(B), fem = B.who === 'female', out = [];
  for (const sg of [1, -1]) {
    const s = sg > 0 ? 'l' : 'r', hp = A.hip[s], kn = A.knee[s];
    const pick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'thigh', 'torso') > 0.9 && q.p[1] < hp[1] + 0.6;
    const TH = limbWrap(B, hp, kn, sg, { t: [-0.25, 0.7], nt: 19, a: [-PI, PI], closed: true, na: 32, pick, smooth: 4, shape: (r) => r });
    const wT = skinW(B, (q) => q.p[0] * sg > 0.12 && shareW(B, q.w, 'thigh') > 0.6 && along(q.p, hp, kn) > 0.25 && along(q.p, hp, kn) < 0.8, (n) => n.endsWith(`_${s}`)), wP = boneW(B, 'pelvis');
    const tTop = along([hp[0], M.hip + 0.25, hp[2]], hp, kn), tBot = fem ? 0.6 : 0.62;
    const w = (p) => { const f = clamp((along(p, hp, kn) - tTop) / (tBot - tTop)); return mixW([[wP, 0.7 - 0.6 * f], [wT, 0.3 + 0.6 * f]]); };
    // (round the front, the outside and the back of the thigh; open on its inside)
    const a0 = -PI / 2 + (fem ? 1.25 : 1.2), a1 = 1.5 * PI - (fem ? 1.3 : 1.12), NV = 24, NU = 6;
    // (flared to its hem, pleated, fuller over the seat behind)
    const offP = (u, a) => 0.26 + 0.12 * smooth(1.6, 3.4, a) * u + 0.26 * (1 - u) ** 1.3 * (1 - 0.6 * Math.exp(-(((a - PI / 2) / 0.6) ** 2))) + 0.04 * Math.max(0, Math.cos(6 * (a - a0))) * (1 - u);
    const panel = plateOn(TH, { a0, a1, t0: () => tBot, t1: () => tTop, nu: NU, nv: NV, off: (u, v, tt, a) => offP(u, a) });
    out.push(solid(panel, { sheet: true, w, mat: (i) => (i === 0 ? 'saffron' : 'lapis') }));
    out.push(tube(rowPath(panel, 0, 0, NV, NV, 0.0), { r: 0.035, k: 3, mat: 'saffronD', w }));
    out.push(tube(rowPath(panel, 1.3, 0, NV, NV, 0.01), { r: 0.03, k: 3, mat: 'purple', w }));
    // (its open edges bound in saffron)
    for (const j of [0, NV]) out.push(tube(colPath(panel, j, 0, NU, NU, 0.0), { r: 0.03, k: 3, mat: 'saffron', w }));
    // -- the akinakes: the short sword in its electrum scabbard strapped down the right thigh's front, its hilt up
    // under the sash, the scabbard's side lobe at its mouth, a chape at its point
    if (sg > 0) continue;
    const ak = 0.55, along2 = (f) => { const tt = tTop - 0.12 + (tTop + 0.62 * (tBot - tTop) - (tTop - 0.12)) * f, u = clamp((tBot - tt) / (tBot - tTop)), q = TH.ta(tt, ak); return { p: add(q.p, mul(q.n, offP(u, ak) + 0.07)), n: q.n }; };
    const sp = [...Array(9).keys()].map((k) => along2(0.12 + 0.88 * (k / 8)));
    out.push(sweep(sp, { closedProfile: true, w, mat: 'el', profile: (k) => { const f = k / 8, wd = (fem ? 0.12 : 0.14) * (1 - 0.55 * f), th = 0.045; return [[-wd, 0], [-wd * 0.7, th], [wd * 0.7, th], [wd, 0], [wd * 0.7, -th], [-wd * 0.7, -th]]; } }));
    out.push(tube(sp.map((q) => ({ p: add(q.p, mul(q.n, 0.05)), n: q.n })), { r: 0.018, k: 3, mat: 'elL', w }));
    const tip = sp[8], tdir = unit(sub(sp[8].p, sp[7].p));
    out.push(stud(tip.p, tdir, { r: 0.07, h: 0.1, k: 5, mat: 'elB', w }));
    // (the mouth's lobe out to the side, the hilt above it: a grip, a heart-shaped guard, a bar pommel)
    const m = sp[0], sx = unit(cross(tdir, m.n));
    out.push(...rosette(add(add(m.p, mul(sx, -(fem ? 0.16 : 0.18))), mul(m.n, 0.02)), m.n, { R: fem ? 0.14 : 0.16, petals: 6, fine: 2, mat: 'el', heart: 'rune2', heartR: 0.4, w, dome: 0.03, cup: 0.02 }));
    const g0 = along2(0.1), g1 = along2(0.0), hilt = [g0, g1, { p: add(g1.p, mul(tdir, -0.22)), n: g1.n }];
    out.push(tube(hilt, { r: 0.045, k: 4, mat: 'saffronD', w }));
    out.push(sweep([{ p: add(hilt[2].p, mul(sx, -0.13)), n: g1.n }, { p: add(hilt[2].p, mul(sx, 0.13)), n: g1.n }], { closedProfile: true, profile: roundProfile(0.05, 4), mat: 'elB', w }));
    out.push(stud(add(g0.p, mul(g0.n, 0.0)), g0.n, { r: 0.1, h: 0.06, k: 6, mat: 'elB', w }));
  }
  return out;
}

/** One arm: scale sleeves over the shoulder and the upper arm's outside, an electrum armlet, the robe's banded cuff, a bracelet. */
function armOf(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, sh = A.shoulder[s], el = A.elbow[s], wr = A.wrist[s], fem = B.who === 'female', out = [];
  const armB = (n) => n.endsWith(`_${s}`);
  const upPick = (q) => (s === 'l' ? q.p[0] > 0.15 : q.p[0] < -0.15) && shareW(B, q.w, 'upperarm', 'shoulder') > 0.6;
  const UA = limbWrap(B, sh, el, sg, { t: [-0.2, 0.95], nt: 20, a: [-PI, PI], closed: true, na: 24, pick: upPick, smooth: 3, shape: (r) => r });
  const wUp = skinW(B, (q) => upPick(q) && along(q.p, sh, el) > 0.3 && along(q.p, sh, el) < 0.8, armB);
  const wTop = mixOf(B, [[`shoulder_${s}`, 0.45], [`clavicle_${s}`, 0.25], [`upperarm_${s}`, 0.3]]);
  const wS = (p) => { const f = smooth(-0.05, 0.3, along(p, sh, el)); return mixW([[wTop, 1 - f], [wUp, f]]); };
  // -- the sleeve's scales: from over the shoulder's ball down the outside of the upper arm, tips down
  out.push(...scaleRows((yy, a) => UA.ta(-yy, a), {
    y0: -0.5, y1: 0.08, rowH: fem ? 0.1 : 0.1, lap: 0.55, a0: 0.05, a1: PI + 0.45, n: () => (fem ? 8 : 8),
    off: (yy) => 0.11 + 0.08 * smooth(-0.15, 0.08, yy), climb: 0.008, wide: 0.6, tilt: 0.05, dome: 0.025, sheet: true,
    w: wS, mat: 'el', matL: 'elB', matS: 'elS', nu: 3, nv: 2,
  }));
  // -- the armlet: a ring of electrum under the sleeve
  const ring = (G, tt, off, n = 16) => [...Array(n + 1).keys()].map((j) => { const q = G.ta(tt, -PI + (TAU * j) / n); return { p: add(q.p, mul(q.n, off)), n: q.n }; });
  out.push(tube(ring(UA, 0.62, 0.08), { r: 0.05, k: 4, mat: 'elB', w: () => wUp, closed: true }));
  out.push(tube(ring(UA, 0.68, 0.075), { r: 0.03, k: 3, mat: 'elM', w: () => wUp, closed: true }));
  // -- the cuff: saffron and purple bands round the sleeve above the wrist, the bracelet at its foot
  const faPick = (q) => (s === 'l' ? q.p[0] > 0.15 : q.p[0] < -0.15) && shareW(B, q.w, 'forearm') > 0.6;
  const FA = limbWrap(B, el, wr, sg, { t: [0, 1.0], nt: 14, a: [-PI, PI], closed: true, na: 20, pick: faPick, smooth: 3, shape: (r) => r });
  const wFa = skinW(B, (q) => faPick(q) && along(q.p, el, wr) > 0.4 && along(q.p, el, wr) < 0.9, armB);
  for (const [t0, t1, m] of [[0.66, 0.76, 'saffron'], [0.76, 0.8, 'purple'], [0.8, 0.86, 'saffron']]) {
    const g = plateOn(FA, { a0: -PI, a1: PI, closed: true, t0: () => t0, t1: () => t1, nu: 1, nv: 16, off: () => 0.085 });
    out.push(solid(g, { hollow: true, thick: 0.03, w: () => wFa, mat: () => m, edge: m }));
  }
  out.push(tube(ring(FA, 0.92, 0.1), { r: 0.055, k: 4, mat: 'elB', w: () => wFa, closed: true }));
  out.push(tube(ring(FA, 0.92, 0.155), { r: 0.025, k: 3, mat: 'elL', w: () => wFa, closed: true }));
  return out;
}
const CHEST = new WeakMap();
function electrumChestParts(B) {
  if (CHEST.has(B)) return CHEST.get(B);
  const parts = [smoothWeights(robe(B), 2, (p) => p[1] < B.at.neck[1] - 0.6)];
  const C = corselet(B);
  const tag = (list, k) => list.map((P) => Object.assign(P, { tag: k }));
  parts[0].tag = 'robe';
  parts.push(...tag(C.out, 'corselet'), ...tag(robeSkirt(B, C), 'skirt'), ...tag(armOf(B, 'l'), 'arms'), ...tag(armOf(B, 'r'), 'arms'));
  CHEST.set(B, parts);
  return parts;
}
export const electrumChestPartsDbg = (B) => electrumChestParts(B);
export function electrumChest(B) {
  return coverHides(B, merge(...electrumChestParts(B)), 0.5);
}

/* ---- the shawl --------------------------------------------------------------------------------------------------- */
/**
 * The royal pectoral: a broad collar of electrum over the shoulders, the breast and the back in three stacked rings (a
 * rolled band of rosettes, a band of turquoise glaze, a broad band lobed into crescents along its foot with a drop
 * under each lobe), a crescent pendant at its front; under it behind, a short cape of glazed-brick blue to the middle
 * of the back, a frieze of stepped merlons along its saffron hem; on the cape, the winged sun: a disc with its sun lit
 * when enchanted, three tiers of feathers in each wing, a fanned tail.
 */
export function electrumMantle(B) {
  const A = B.at, M = torsoMarks(B), fem = B.who === 'female', out = [], n = A.neck[1];
  const W = nearSkinW(B, (q) => shareW(B, q.w, 'torso', 'neck') > 0.85 && headW(B, q.w) < 0.2 && q.p[1] > M.pit - 1.2, (nm) => ['spine_03', 'spine_02', 'spine_01', 'neck_01', 'clavicle_l', 'clavicle_r'].includes(nm), 0.35);
  // -- the envelope it lies on: the chest piece and the skin of the torso, the neck, the shoulders and the upper arms, hung
  const lowArm = (w) => w.some(([b, x]) => x > 0.3 && /(lowerarm|elbow|hand|wrist)/.test(B.bones[b].name));
  const legW = (w) => w.some(([b, x]) => x > 0.2 && /(thigh|calf)/.test(B.bones[b].name));
  const pts = [];
  for (const P of electrumChestParts(B)) P.V.forEach((p, i) => { if (!lowArm(P.W[i]) && !legW(P.W[i]) && p[1] > M.waist - 0.3) pts.push(p); });
  for (const q of skinSamples(B)) if (shareW(B, q.w, 'torso', 'neck', 'shoulder', 'upperarm') > 0.8 && headW(B, q.w) < 0.15 && q.p[1] > M.waist - 0.3) pts.push(q.p);
  const zc = torsoMiddle(B, (q) => shareW(B, q.w, 'torso', 'neck', 'head') > 0.8 && headW(B, q.w) < 0.15);
  const cy0 = M.waist - 0.3, cy1 = n + 0.3, ct = (yy) => (yy - cy0) / (cy1 - cy0);
  const C = torsoWrap(B, cy0, cy1, zc, {
    points: pts, nt: 60, na: 64, closed: true, a: [-PI, PI], smooth: 3, minDa: 0.1, empty: 0.3,
    post: (R) => { for (let j = 0; j < R[0].length; j++) for (let i = R.length - 2; i >= 0; i--) R[i][j] = Math.max(R[i][j], R[i + 1][j]); },
    shape: (r) => r + 0.04,
  });
  const at = (yy, a, h = 0) => { const q = C.ta(ct(yy), a); return { p: add(q.p, mul(q.n, h)), n: q.n }; };
  const shR = mixOf(B, [['shoulder_r', 0.45], ['upperarm_r', 0.15], ['clavicle_r', 0.4]]), shL = mixOf(B, [['shoulder_l', 0.45], ['upperarm_l', 0.15], ['clavicle_l', 0.4]]);
  // (the torso's weights in the middle, the shoulders' out over them)
  const clR = mixOf(B, [['clavicle_r', 0.6], ['spine_03', 0.4]]), clL = mixOf(B, [['clavicle_l', 0.6], ['spine_03', 0.4]]);
  const wM = (p) => { const k = smooth(0.4, 1.6, Math.abs(p[0])); return mixW([[W(p), 1 - k], [p[0] < 0 ? clR : clL, k]]); };
  // -- where it runs: its top round the neck's foot, its foot deeper before and behind than over the shoulders
  const back = (a) => smooth(0.4, 2.6, Math.abs(wrapAngle(a)));
  const yTop = (a) => n - (fem ? 0.42 : 0.46) + 0.12 * back(a);
  const side = (a) => Math.sin(Math.abs(wrapAngle(a))) ** 2;
  const depth = (a) => (fem ? 0.78 : 0.86) + 0.1 * back(a) - (fem ? 0.12 : 0.18) * side(a);
  const NV = 64;
  const ring = (y0, y1, h0, h1, nu = 2) => plateOn(C, { a0: -PI, a1: PI, closed: true, t0: (a) => ct(y1(a)), t1: (a) => ct(y0(a)), nu, nv: NV, off: (u) => h1 + (h0 - h1) * u });
  // -- the pectoral: a broad crescent of electrum over the breast from shoulder to shoulder, deepest at the middle, a
  // band of turquoise glaze set in it with rosettes along it, its foot rolled, a drop hung along it; behind, a band
  // round the back of the neck joining its horns
  const aP = fem ? 1.28 : 1.3, NP = 36, NPu = 6;
  const cres = (a) => Math.cos((PI / 2) * clamp(Math.abs(wrapAngle(a)) / aP)) ** 1.1;
  const pTop = (a) => yTop(a), pBot = (a) => yTop(a) - (fem ? 0.2 : 0.22) - (fem ? 0.62 : 0.72) * cres(a);
  const pect = plateOn(C, { a0: -aP, a1: aP, t0: (a) => ct(pBot(a)), t1: (a) => ct(pTop(a)), nu: NPu, nv: NP, off: (u) => 0.05 + 0.02 * Math.sin(PI * u) });
  out.push(solid(pect, { sheet: true, w: wM, mat: (i) => (i === 0 ? 'elM' : 'el') }));
  out.push(tube(rowPath(pect, 0, 0, NP, NP), { r: 0.045, k: 3, mat: 'elL', w: wM }));
  out.push(tube(rowPath(pect, NPu, 0, NP, 30), { r: 0.035, k: 3, mat: 'elB', w: wM }));
  // (the glaze: a crescent band within it, raised, edged bright, rosettes along it)
  const gB = (a) => lerp([0, pBot(a), 0], [0, pTop(a), 0], 0.32)[1], gT = (a) => lerp([0, pBot(a), 0], [0, pTop(a), 0], 0.62)[1];
  const gl = plateOn(C, { a0: -aP * 0.92, a1: aP * 0.92, t0: (a) => ct(gB(a)), t1: (a) => ct(gT(a)), nu: 2, nv: 32, off: () => 0.09 });
  out.push(solid(gl, { sheet: true, w: wM, mat: () => 'turq' }));
  for (const r of [0, 2]) out.push(tube(rowPath(gl, r, 0, 32, 24, 0.005), { r: 0.026, k: 3, mat: 'elB', w: wM }));
  const nRo = fem ? 9 : 11;
  for (let k = 0; k < nRo; k++) { const q = gl.at(1, ((k + 0.5) / nRo) * 32); out.push(...rosette(add(q.p, mul(q.n, 0.01)), q.n, { R: fem ? 0.085 : 0.095, petals: 8, fine: 2, mat: 'elB', heart: 'elM', heartR: 0.4, w: wM, dome: 0.02, cup: 0.02 })); }
  // (drops along its foot)
  const nD = fem ? 13 : 15;
  for (let k = 0; k < nD; k++) {
    const a = -aP * 0.9 + (2 * aP * 0.9 * (k + 0.5)) / nD, q = at(pBot(a) + 0.03, a, 0.07), d = unit(sub(at(pBot(a) - 0.2, a, 0.07).p, q.p));
    out.push(stud(q.p, d, { r: 0.045, h: 0.13, k: 4, mat: 'elB', w: () => wM(q.p) }));
  }
  // (behind: the band round the neck's back from horn to horn, rosettes on it)
  const bk = plateOn(C, { a0: fem ? 1.95 : 1.85, a1: TAU - (fem ? 1.95 : 1.85), t0: (a) => ct(pTop(a) - 0.26), t1: (a) => ct(pTop(a)), nu: 2, nv: 24, off: () => 0.1 });
  out.push(solid(bk, { sheet: true, w: wM, mat: () => 'el' }));
  for (const r of [0, 2]) out.push(tube(rowPath(bk, r, 0, 24, 18), { r: 0.035, k: 3, mat: r ? 'elL' : 'elB', w: wM }));
  for (let k = 0; k < 5; k++) { const q = bk.at(1, ((k + 0.5) / 5) * 24); out.push(...rosette(add(q.p, mul(q.n, 0.01)), q.n, { R: fem ? 0.08 : 0.09, petals: 8, fine: 2, mat: 'elB', heart: 'turq', heartR: 0.4, w: wM, dome: 0.02, cup: 0.02 })); }
  const r2b = (a) => pTop(a) - 0.2;
  // (the clasps at its horns over the shoulders, where the cape is fastened: great rosettes with turquoise hearts)
  for (const sd of [-1, 1]) { const a = sd * aP * 0.9, q = at(lerp([0, pTop(a), 0], [0, pBot(a), 0], 0.5)[1], a, 0.08); out.push(...rosette(add(q.p, mul(q.n, 0.06)), q.n, { R: fem ? 0.19 : 0.22, petals: 10, fine: 2, mat: 'elB', mat2: 'el', heart: 'turq', heartR: 0.4, heartH: 0.5, w: () => wM(q.p), dome: 0.08, cup: 0.04 })); out.push(stud(q.p, q.n, { r: fem ? 0.14 : 0.16, h: 0.08, k: 6, mat: 'elM', w: () => wM(q.p) })); }
  // -- the clasp: a crescent pendant hung from the pectoral's middle, horns up, a turquoise rosette in its cradle
  { const q = at(pBot(0) + 0.02, 0, 0.08), o = unit(add(q.n, [0, 0.05, 0]));
    out.push(...crescent(add(q.p, [0, -0.12, 0]), o, { R: fem ? 0.24 : 0.27, inner: 0.64, lift: 0.36, thick: 0.05, mat: 'el', edge: 'elS', back: 'elS', rim: 'elL', rimR: 0.025, w: () => W(q.p), up: [0, 1, 0] }));
    out.push(...rosette(add(q.p, [0, -0.07, 0.03]), o, { R: fem ? 0.12 : 0.13, petals: 8, fine: 2, mat: 'elB', heart: 'turq', heartR: 0.45, w: () => W(q.p), dome: 0.03, cup: 0.02 })); }
  // -- the cape: glazed-brick blue from under the collar behind, over the shoulders' backs, to the middle of the back
  const cA = fem ? 2.25 : 2.12, NC = 30, NCu = 8;
  // (a shield's outline: across the shoulder blades at its top, its sides drawn in to a rounded point low on the back)
  const hem = (a) => { const b = clamp((Math.abs(wrapAngle(a)) - cA) / (PI - cA)); return lerp([0, M.pit + 0.75, 0], [0, M.pit - (fem ? 0.75 : 0.95), 0], Math.sin((PI / 2) * b) ** 0.6)[1]; };
  const capeTop = (a) => pTop(a) - 0.02;
  const cape = plateOn(C, { a0: cA, a1: TAU - cA, t0: (a) => ct(hem(a)), t1: (a) => ct(capeTop(a)), nu: NCu, nv: NC, off: (u) => 0.03 + 0.03 * (1 - u) });
  const capeP = smoothWeights(solid(cape, { sheet: true, w: wM, mat: (i) => (i === 0 ? 'saffron' : 'glaze') }), 6);
  out.push(capeP);
  out.push(tube(rowPath(cape, 0, 0, NC, NC), { r: 0.04, k: 3, mat: 'saffronD', w: wM }));
  for (const j of [0, NC]) out.push(tube(colPath(cape, j, 0, NCu - 1, NCu, 0.0), { r: 0.035, k: 3, mat: 'saffron', w: wM }));
  // (the frieze: stepped merlons standing along the hem behind, turquoise framed in electrum)
  const onCape = (yy, a, h) => { const t0 = ct(hem(a)), t1 = ct(capeTop(a)); const q = cape.at(clamp((ct(yy) - t0) / (t1 - t0)) * NCu, ((a - cA) / (TAU - 2 * cA)) * NC); return { p: add(q.p, mul(q.n, h)), n: q.n }; };
  const nMf = fem ? 7 : 8, fa0 = PI - (fem ? 1.0 : 1.05), fa1 = PI + (fem ? 1.0 : 1.05), mHt = fem ? 0.24 : 0.27;
  for (let k = 0; k < nMf; k++) {
    const ac = fa0 + ((k + 0.5) / nMf) * (fa1 - fa0), wd = ((fa1 - fa0) / nMf) * 0.66;
    out.push(merlon((x, yy) => { const a = ac + (x - 0.5) * wd, b = hem(a) + 0.12; return onCape(b + mHt * yy, a, 0.025); }, { thick: 0.03, w: wM, mat: (i) => (i === 0 ? 'el' : 'turq'), back: 'elS', edge: 'elB' }));
  }
  // -- the winged sun: a freestanding plaque of electrum standing off the back, its wings spread across the shoulder
  // blades and curving forward at their tips; each wing a dark backing with three tiers of bright feathers on it, the
  // gaps between the tiers dark; a fanned tail under the disc; the disc great, its sun lit
  const sy = M.pit + (fem ? 0.5 : 0.62), Rz0 = len(sub(at(sy, PI).p, [0, sy, zc(sy)])) + 0.2, Rx0 = fem ? 1.36 : 1.68, thM = fem ? 0.88 : 1.02;
  const wB = mixOf(B, [['spine_03', 0.7], ['spine_02', 0.3]]), wW = () => wB;
  // (a point on the wings' sheet: round the back on an ellipse, theta from the spine toward the side `sd`, lifted `h`)
  // (never nearer the back than a hand off whatever is under it there)
  const wp = (sd, th, yy, h = 0) => {
    const zz = zc(yy), x = sd * Math.sin(th) * Rx0, z = -Math.cos(th) * Rz0, r = Math.hypot(x, z), a = Math.atan2(x, z);
    const q = C.ta(ct(yy), a).p, rC = Math.hypot(q[0], q[2] - zz) + 0.3, k = (Math.max(r, rC) + h) / r;
    return [x * k, yy, zz + z * k];
  };
  const wn = (sd, th) => unit([sd * Math.sin(th) / Rx0, 0.15, -Math.cos(th) / Rz0]);
  const dR = fem ? 0.4 : 0.46, th0 = (dR * 0.7) / Rz0;
  const lift = (f) => 0.22 * f * f;
  for (const sd of [-1, 1]) {
    // (the backing: the wing's whole outline in dark electrum, tapering to its tip)
    const hW = (f) => (fem ? 0.72 : 0.84) * (1 - 0.45 * f);
    const back2 = patch((u, v) => { const th = th0 + (thM - th0) * v, yy = sy + 0.3 + lift(v) - hW(v) * u; return { p: wp(sd, th, yy, 0), n: wn(sd, th) }; }, 5, 14);
    out.push(solid(back2, { sheet: true, w: wW, mat: () => 'elD' }));
    // (the tiers: coverts above, then two rows of long feathers, each a bright plate stepped out, its foot cut in feathers)
    for (let k = 0; k < 3; k++) {
      const f1 = [0.78, 0.9, 1.0][k], top = (f) => sy + 0.28 + lift(f) - k * 0.27 * (1 - 0.45 * f), h = (f) => [0.22, 0.24, 0.3][k] * (1 - 0.4 * f), nf = [6, 8, 9][k];
      const G = patch((u, v) => {
        const f = v * f1, th = th0 + (thM - th0) * f, serr = 0.1 * Math.abs(Math.sin(nf * PI * v)) ** 0.6, yy = top(f) - (h(f) - serr * (1 - 0.3 * f)) * u;
        return { p: wp(sd, th, yy, 0.05 + 0.025 * k), n: wn(sd, th) };
      }, 2, nf * 3);
      out.push(solid(G, { sheet: true, w: wW, mat: (i) => (i === 0 ? ['elL', 'elB', 'elB'][k] : ['elB', 'el', 'el'][k]) }));
      out.push(tube(rowPath(G, 0, 0, nf * 3, nf * 2, 0.005), { r: 0.022, k: 3, mat: 'elL', w: wW }));
    }
  }
  // (the tail: three tiers fanned down under the disc)
  for (let k = 0; k < 3; k++) {
    const wd = (fem ? 0.22 : 0.26) + 0.09 * k, top = sy - dR * 0.55 - 0.14 * k, h = 0.24, nf = 3 + k;
    const G = patch((u, v) => { const x = (v - 0.5) * 2 * wd * (1 + 0.25 * u), serr = 0.07 * Math.abs(Math.sin(nf * PI * v)) ** 0.7, yy = top - (h - serr) * u, th = x / Rz0;
      return { p: wp(Math.sign(th) || 1, Math.abs(th), yy, 0.05 + 0.025 * (2 - k)), n: wn(1, 0) }; }, 2, nf * 4);
    out.push(solid(G, { sheet: true, w: wW, mat: (i) => (i === 0 ? ['elB', 'el', 'elM'][k] : ['el', 'elM', 'elS'][k]) }));
  }
  // (the disc: a ring of petals, a bright ring, the sun in it lit)
  const dc = { p: wp(1, 0, sy, 0.14), n: wn(1, 0) };
  out.push(...rosette(dc.p, dc.n, { R: dR, petals: 16, fine: 2, mat: 'elB', mat2: 'el', heart: null, w: wW, dome: 0.05, cup: 0.04 }));
  out.push(stud(add(dc.p, mul(dc.n, 0.04)), dc.n, { r: dR * 0.55, h: 0.1, k: 8, mat: 'rune', capMat: 'rune', w: wW }));
  out.push(tube([...Array(17).keys()].map((k) => { const a2 = (TAU * k) / 16, F = frameAt(dc.p, dc.n); return { p: F.at(Math.cos(a2) * dR * 0.64, Math.sin(a2) * dR * 0.64, 0.07), n: dc.n }; }), { r: 0.03, k: 3, mat: 'elL', w: wW, closed: true }));
  return coverHides(B, merge(...out), 0.6);
}

/* ---- the legs ---------------------------------------------------------------------------------------------------- */
/**
 * The anaxyrides: loose trousers of royal purple from the waist to the ankle, full over the shin and gathered at the
 * ankle into a saffron cuff, soft folds down them; a saffron band of lozenges embroidered down each leg's front; over
 * each knee a guard of electrum scales, its rim lit when enchanted.
 */
export function electrumLegs(B) {
  const A = B.at, M = torsoMarks(B), fem = B.who === 'female', out = [];
  const legOf = (p) => (p[0] >= 0 ? 'l' : 'r');
  const T = shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s = legOf(p); return on(B, i, 'thigh', 'calf', 'torso', 'foot') > 0.6 && on(B, i, 'foot') < 0.75 && on(B, i, 'upperarm', 'forearm', 'hand', 'shoulder') < 0.05 && y(p) < M.waist + 0.2 && y(p) > A.ankle[s][1] - 0.1; },
    off: ({ p, n }) => {
      const s = legOf(p), kn = A.knee[s], an = A.ankle[s], hp = A.hip[s];
      const tS = along(p, kn, an), tT = along(p, hp, kn), sg = s === 'l' ? 1 : -1;
      // (full over the shin, gathered at the ankle; looser below the knee than over the thigh; soft folds round each leg)
      const a = Math.atan2(n[0] * sg, n[2]);
      const full = y(p) < kn[1] ? 0.06 + 0.16 * Math.sin(PI * clamp(tS / 0.95)) ** 0.7 : 0.02 + 0.04 * smooth(0.5, 1, tT);
      const fold = 0.035 * Math.max(0, Math.cos(5 * a + 1.3 * Math.sin(3 * y(p)))) * smooth(kn[1] + 0.8, kn[1], y(p));
      // (close in the crotch, under the robe's skirt)
      const crotch = Math.exp(-((p[0] / 0.45) ** 2)) * smooth(M.hip - 0.9, M.hip - 0.2, y(p));
      return (0.03 + full + fold) * (1 - 0.6 * crotch) - 0.09 * smooth(an[1] + 0.55, an[1] + 0.1, y(p));
    },
    mat: ({ p }) => (y(p) > M.hip + 0.15 ? 'purpleW' : 'purple'),
  });
  out.push(smoothWeights(T, 3, (p) => p[1] < B.at.hip.l[1]));
  for (const sg of [1, -1]) {
    const s = sg > 0 ? 'l' : 'r', hp = A.hip[s], kn = A.knee[s], an = A.ankle[s];
    const legB = (nm) => nm.endsWith(`_${s}`);
    // -- the cuff: a saffron band gathered round the ankle's top
    const cPick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'calf') > 0.6;
    const SH = limbWrap(B, kn, an, sg, { t: [0, 1.0], nt: 20, a: [-PI, PI], closed: true, na: 24, pick: cPick, smooth: 4, shape: (r) => r });
    const wCa = skinW(B, (q) => cPick(q) && along(q.p, kn, an) > 0.5 && along(q.p, kn, an) < 0.95, legB);
    const tc0 = along([an[0], an[1] + 0.44, an[2]], kn, an), tc1 = along([an[0], an[1] + 0.72, an[2]], kn, an);
    const cuff = plateOn(SH, { a0: -PI, a1: PI, closed: true, t0: () => tc0, t1: () => tc1, nu: 2, nv: 20, off: (u) => 0.2 - 0.02 * u });
    out.push(solid(cuff, { sheet: true, w: () => wCa, mat: () => 'saffron' }));
    out.push(tube(rowPath(cuff, 0, 0, 20, 20), { r: 0.03, k: 3, mat: 'saffronD', w: () => wCa, closed: true }));
    out.push(tube(rowPath(cuff, 2, 0, 20, 20), { r: 0.03, k: 3, mat: 'saffronD', w: () => wCa, closed: true }));
    // -- the embroidered band down the front: on the thigh and on the shin, lozenges along it
    const thPick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'thigh') > 0.6;
    const TH = limbWrap(B, hp, kn, sg, { t: [0, 1.0], nt: 20, a: [-PI, PI], closed: true, na: 24, pick: thPick, smooth: 4, shape: (r) => r });
    const wTh = (p) => mixW([[skinW(B, (q) => thPick(q) && along(q.p, hp, kn) > 0.3 && along(q.p, hp, kn) < 0.8, legB), 1]]);
    const wThC = wTh(null);
    const bandOn = (G, t0, t1, off, w) => {
      const path = [];
      for (let k = 0; k <= 10; k++) { const tt = t0 + (t1 - t0) * (k / 10), q = G.ta(tt, 0.15 * sg * 0); path.push({ p: add(q.p, mul(q.n, off(tt))), n: q.n }); }
      out.push(band(path, { wide: fem ? 0.26 : 0.3, high: 0.015, sink: 0.015, mat: 'saffron', w }));
      for (const e of [-1, 1]) out.push(tube(path.map((q) => { const d = unit(cross(sub(path[Math.min(10, path.indexOf(q) + 1)].p, path[Math.max(0, path.indexOf(q) - 1)].p), q.n)); return { p: add(add(q.p, mul(d, e * (fem ? 0.13 : 0.15))), mul(q.n, 0.02)), n: q.n }; }), { r: 0.025, k: 3, mat: 'purpleD', w }));
      // (lozenges: small diamonds along it, turquoise and electrum by turns)
      const nL = Math.round(len(sub(path[10].p, path[0].p)) / 0.32);
      for (let k = 0; k < nL; k++) {
        const f = (k + 0.5) / nL, i0 = Math.min(9, Math.floor(f * 10)), g = f * 10 - i0, c = lerp(path[i0].p, path[i0 + 1].p, g), nn = unit(lerp(path[i0].n, path[i0 + 1].n, g));
        out.push(stud(add(c, mul(nn, 0.01)), nn, { r: fem ? 0.1 : 0.115, h: 0.035, k: 4, mat: k % 2 ? 'turq' : 'elB', w }));
      }
    };
    bandOn(SH, 0.22, 0.78, (tt) => 0.15 + 0.16 * Math.sin(PI * clamp(tt / 0.95)) ** 0.7, () => wCa);
    // -- the knee guard: rows of electrum scales over the knee's front, its rim lit
    const kPick = (q) => (sg > 0 ? q.p[0] > 0.12 : q.p[0] < -0.12) && shareW(B, q.w, 'thigh', 'calf') > 0.8 && len(sub(q.p, kn)) < 0.9;
    const k0 = lerp(hp, kn, 0.78), k1 = lerp(kn, an, 0.18);
    const KN = limbWrap(B, k0, k1, sg, { t: [0, 1], nt: 12, a: [-PI, PI], closed: true, na: 28, pick: kPick, smooth: 4, shape: (r) => r });
    const wKn = boneW(B, `knee_${s}`);
    const kOff = (t) => 0.2 + 0.05 * Math.sin(PI * t);
    out.push(...scaleRows((yy, a) => KN.ta(-yy, a), {
      y0: -0.98, y1: -0.04, rowH: 0.16, lap: 0.4, a0: -1.45, a1: 1.45, n: () => 6, off: (yy) => kOff(-yy), climb: 0.012, wide: 0.6, tilt: 0.05, dome: 0.025, sheet: true,
      w: () => wKn, mat: 'el', matL: 'elB', matS: 'elS', nu: 3, nv: 2, tipW: 0.45,
    }));
    // (its rim: round its top and down its sides, lit when enchanted)
    const rim = [];
    for (let k = 0; k <= 16; k++) { const f = k / 16, a = -1.5 + 3 * f, tt = 0.04 + 0.6 * Math.abs(2 * f - 1) ** 3, q = KN.ta(tt, a); rim.push({ p: add(q.p, mul(q.n, kOff(tt) + 0.13)), n: q.n }); }
    out.push(tube(rim, { r: 0.05, k: 4, mat: 'rune', w: () => wKn }));
    { const q = KN.ta(0.05, 0); out.push(...rosette(add(q.p, mul(q.n, kOff(0.05) + 0.14)), q.n, { R: 0.12, petals: 8, fine: 2, mat: 'elB', heart: 'turq', heartR: 0.4, w: () => wKn, dome: 0.02, cup: 0.02 })); }
  }
  return { P: coverHides(B, merge(...out), 0.5), dropAt: (f) => f.mat === 'purpleW' };
}

/* ---- the boots --------------------------------------------------------------------------------------------------- */
/**
 * Soft ankle boots of saffron-tan leather on a dark sole, the toe drawn out and turned gently up to a knop; laced up
 * the instep in saffron cord between electrum eyelets; an electrum plate over the toe; an electrum band round the
 * ankle with a turquoise lit when enchanted; a saffron cuff at the top, under the trousers' gathered hem.
 */
const LEGS = new WeakMap();
export function electrumBoots(B) {
  const A = B.at, fem = B.who === 'female', out = [];
  // -- the boot: the foot and the ankle, close over the skin, stood on
  const P = shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'foot', 'calf') > 0.6 && y(p) < A.ankle[s][1] + 0.5; },
    off: ({ n, p }) => { const s = p[0] >= 0 ? 'l' : 'r'; return 0.045 + (n[1] < -0.6 ? 0.07 : 0) + 0.05 * smooth(A.ankle[s][1] - 0.3, A.ankle[s][1] + 0.05, y(p)); },
    mat: ({ n, p }) => { const s = p[0] >= 0 ? 'l' : 'r'; return n[1] < -0.55 ? 'sole' : y(p) > A.ankle[s][1] + 0.3 ? 'tanD' : 'tan'; },
  });
  P.soles = P.V.map((_, i) => i).filter((i) => P.V[i][1] < A.floor + 0.12);
  out.push(P);
  for (const sg of [1, -1]) {
    const s = sg > 0 ? 'l' : 'r', an = A.ankle[s], ball = A.ball[s], kn = A.knee[s];
    const fPick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'foot') > 0.6;
    const toes = skinSamples(B).filter(fPick), tip = toes.reduce((b, q) => (q.p[2] > b[2] ? q.p : b), [0, 0, -9]);
    const from = [an[0], an[1] - 0.05, an[2] + 0.05], to = [tip[0], A.floor + 0.2, tip[2] + 0.05];
    const tBall = along(ball, from, to);
    const FT = limbWrap(B, from, to, sg, { front: [0, 1, 0], t: [0, 1.0], nt: 18, a: [-PI, PI], closed: true, na: 20, pick: fPick, smooth: 4, shape: (r) => r });
    const wFoot = boneW(B, `foot_${s}`), wBall = boneW(B, `ball_${s}`);
    // -- the toe plate: electrum over the toes' top, rolled bright at its back edge
    // -- the toe plate: electrum over the front of the foot from the ball to the toe, a ridge down its middle, its back
    // edge rolled bright, a rosette on it
    const toe = plateOn(FT, { a0: -1.55, a1: 1.55, t0: () => tBall - 0.06, t1: () => 0.97, nu: 4, nv: 12, off: (u, v) => 0.08 - 0.02 * u + 0.03 * Math.exp(-(((v - 0.5) / 0.12) ** 2)) });
    out.push(solid(toe, { sheet: true, w: () => wBall, mat: (i, j) => (j === 5 || j === 6 ? 'elB' : i === 0 ? 'elM' : 'el') }));
    out.push(tube(rowPath(toe, 0, 0, 12, 12), { r: 0.035, k: 3, mat: 'elL', w: () => wBall }));
    { const q = toe.at(1.2, 6); out.push(...rosette(add(q.p, mul(q.n, 0.03)), q.n, { R: 0.09, petals: 8, fine: 2, mat: 'elB', heart: 'turq', heartR: 0.4, w: () => wBall, dome: 0.02, cup: 0.02 })); }
    // -- the curled point: from the toe's end, forward and curling up and back over itself, sheathed in electrum
    // toward its tip, a knop at its end
    const tq = FT.ta(0.95, 0), base = add(tq.p, mul(tq.n, -0.03)), fwd = unit([sub(to, from)[0] * 0.3, 0, sub(to, from)[2]]), up = [0, 1, 0];
    const L = fem ? 0.6 : 0.7, Rc = L / 2.6, NP = 9, path = [];
    for (let k = 0; k <= NP; k++) { const th = (2.6 * k) / NP; path.push({ p: add(base, add(mul(fwd, Rc * Math.sin(th)), mul(up, Rc * (1 - Math.cos(th))))), n: unit(add(mul(up, Math.cos(th)), mul(fwd, -Math.sin(th)))) }); }
    const r0 = fem ? 0.12 : 0.14;
    out.push(sweep(path, { closedProfile: true, w: () => wBall, mat: (k) => (k >= 5 ? 'el' : 'tan'), profile: (k) => { const f = k / NP, r = r0 * (1 - 0.78 * f ** 0.9), h = r * 0.75; return [...Array(6).keys()].map((j) => { const a = (j / 6) * TAU; return [Math.cos(a) * r, Math.sin(a) * h]; }); } }));
    out.push(tube([path[5], path[5]].map((q, i) => ({ p: add(q.p, mul(unit(sub(path[6].p, path[4].p)), (i - 0.5) * 0.04)), n: q.n })), { r: r0 * 0.62, k: 6, mat: 'elL', w: () => wBall }));
    out.push(stud(path[NP].p, unit(sub(path[NP].p, path[NP - 1].p)), { r: 0.055, h: 0.07, k: 5, mat: 'elB', w: () => wBall }));
    // -- the lacing up the instep: saffron cord criss-crossed between electrum eyelets
    const nX = 4, lace = [];
    for (let k = 0; k <= nX * 2; k++) { const f = k / (nX * 2), tt = 0.12 + (tBall - 0.18) * f, a = (k % 2 ? 1 : -1) * 0.38, q = FT.ta(tt, a); lace.push({ p: add(q.p, mul(q.n, 0.075)), n: q.n }); }
    out.push(tube(lace, { r: 0.022, k: 3, mat: 'saffron', w: () => wFoot }));
    for (const q of lace) out.push(stud(q.p, q.n, { r: 0.032, h: 0.025, k: 4, mat: 'elB', w: () => wFoot }));
    // -- the ankle band: electrum round the ankle's top, its turquoise lit
    const cPick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'calf', 'foot') > 0.6;
    const tA = along([an[0], an[1] + 0.12, an[2]], kn, [an[0], A.floor, an[2]]);
    const wAn = mixOf(B, [[`foot_${s}`, 0.6], [`calf_${s}`, 0.4]]);
    // (the shaft: soft leather round the ankle over the trousers' gathered foot, flaring a little to its top, a saffron
    // edge rolled round it)
    // (laid round the trousers' foot as they are there, and the skin under them)
    const trousers = (LEGS.get(B) ?? LEGS.set(B, electrumLegs(B).P).get(B)).V.filter((p) => p[0] * sg > 0.2 && p[1] > an[1] - 0.25 && p[1] < an[1] + 0.75);
    const SHo = limbWrap(B, kn, [an[0], A.floor, an[2]], sg, { t: [0.6, 1.0], nt: 12, a: [-PI, PI], closed: true, na: 20, points: [...trousers, ...skinSamples(B).filter((q) => cPick(q) && q.p[1] > an[1] - 0.1).map((q) => q.p)], smooth: 3, shape: (r) => r });
    const tS0 = along([an[0], an[1] + 0.0, an[2]], kn, [an[0], A.floor, an[2]]), tS1 = along([an[0], an[1] + 0.48, an[2]], kn, [an[0], A.floor, an[2]]);
    const shaft = plateOn(SHo, { a0: -PI, a1: PI, closed: true, t0: () => tS0, t1: () => tS1, nu: 4, nv: 20, off: (u) => 0.06 + 0.04 * u });
    const wFt = boneW(B, `foot_${s}`), wCf = boneW(B, `calf_${s}`), wSh = (p) => { const f = smooth(an[1] + 0.45, an[1] - 0.05, p[1]); return mixW([[wFt, 0.15 + 0.6 * f], [wCf, 0.85 - 0.6 * f]]); };
    out.push(smoothWeights(solid(shaft, { sheet: true, w: wSh, mat: (i) => (i === 3 ? 'saffron' : 'tan') }), 2));
    out.push(tube(rowPath(shaft, 4, 0, 20, 20), { r: 0.035, k: 3, mat: 'saffronD', w: wSh, closed: true }));
    const ringO = (tt, off) => [...Array(17).keys()].map((k) => { const q = SHo.ta(tt, -PI + (TAU * k) / 16); return { p: add(q.p, mul(q.n, off)), n: q.n }; });
    out.push(band(ringO(tA, 0.11), { wide: 0.13, high: 0.025, mat: 'el', w: () => wAn, closed: true }));
    out.push(tube(ringO(tA + 0.012, 0.135), { r: 0.022, k: 3, mat: 'elL', w: () => wAn, closed: true }));
    const gq = SHo.ta(tA, 0.5 * sg);
    out.push(...rosette(add(gq.p, mul(gq.n, 0.15)), gq.n, { R: 0.12, petals: 8, fine: 2, mat: 'elB', heart: 'rune', heartR: 0.45, heartH: 0.45, w: () => wAn, dome: 0.02, cup: 0.02 }));
  }
  return merge(...out);
}
void dot; void cross; void lerp; void sweep; void band; void studsAlong; void roundProfile; void patch; void frameAt; void mixOf; void skinW; void limbWrap; void along; void torque; void tassel;
