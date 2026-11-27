// The zinc set: the sapper, the siege engineer who digs the mines under a wall, sets the charges and builds the
// engines; built with the plate kit (tools/sculpt/garments/platekit.mjs) and the zinc set's own builders
// (tools/sculpt/garments/kit/zinc.mjs). Its zinc galvanised: a cool blue-grey in patchy crystals (the spangle), its
// rivets and rolled edges polished bright; its leather and oilskin dark and plain.
//
//   helm    the sapper's helm: a round skull under a tall riveted comb, a short peak, a deep neck guard of three lames
//           sloped out behind; leather ear flaps with pierced zinc ear plates, a buckled chin strap; brass-rimmed goggles
//           pushed up on the brow on their strap.
//   chest   a dark leather work coat under a cuirass of four lames lapped down the front, a standing rolled collar, a
//           riveted yoke behind; the bandolier from the right shoulder to the left hip (a maul, two chisels, the slow
//           match coiled); the tool belt (the engineers' compass-and-square on its plate, box pouches), the apron split
//           for the legs and the coat's tails; spaulders with a riveted rib, couter cups, flared gauntlets with a splint.
//   mantle  the mantlet: a blast shield of darkened zinc slung on the back over a quilted oilskin pad, four lames under
//           three riveted ribs, two blast wings rising either side of the neck, a sighting slot under a hinged shutter,
//           a scroll case of siege plans across it; slung on tan straps to the sappers' badge on the breast (a pick and a
//           shovel crossed on a lozenge).
//   legs    heavy canvas breeches, full in the thigh and bloused over the knee, leather kneeling and seat patches, a
//           flapped thigh pocket; domed zinc knee pads with a slit, strapped half-greaves.
//   boots   hobnailed boots: a thick sole ringed with hobnails, a riveted zinc toe cap, a heel counter, a spade tread
//           across the instep, a turned-down cuff with the slow match tucked in it.
//
// Enchanted, these light and nothing else: the goggles' lenses, the bandolier's slow match, the mantlet's sighting
// slot, the knee pads' slits and the match ends in the boots' cuffs.
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, smooth, merge, shell, on } from './metalkit.mjs';
import {
  boneW, mixOf, mixW, shareW, skinW, nearSkinW, skinSamples, limbWrap, domeWrap, along, ellipsoidReach, wrapAngle, plateOn, patch, solid,
  rowPath, colPath, studsAlong, stud, sweep, roundProfile, smoothWeights, coverHides,
} from './platekit.mjs';
import { tube as tubeAll, band as bandAll } from './platekit.mjs';

/** A long trim's path thinned to every other point (its ends kept): a rolled edge or a strap needs no more to read. */
const thin = (path, closed) => (path.length <= 10 ? path : path.filter((_, k) => k % 2 === 0 || (!closed && k === path.length - 1)));
const tube = (path, o) => tubeAll(thin(path, o.closed), o);
const band = (path, o) => bandAll(thin(path, o.closed), o);
import { headDome, headW, torsoField, torsoMarks, TORSO_BONES, spangleOf, eyecup, discAt, frameAt, buckle, coil, pickAndShovel } from './kit/zinc.mjs';

const PI = Math.PI;

export const ZINC_MATS = {
  // (the zinc: a cool blue-grey; its spangle's lighter and darker crystals; its lames a shade darker; polished edges)
  zn: { c: '#5b6a75', kind: 3 },
  znA: { c: '#6f808b', kind: 3 },
  znB: { c: '#4a5761', kind: 3 },
  znM: { c: '#48545e', kind: 3 },
  znMA: { c: '#56646e', kind: 3 },
  znMB: { c: '#3c4750', kind: 3 },
  znL: { c: '#c3cdd4', kind: 3 },
  znS: { c: '#283037', kind: 3 },
  znD: { c: '#1c2227', kind: 3 },
  brass: { c: '#b48c3c', kind: 3 },
  brassD: { c: '#6e5222', kind: 3 },
  // (the mantlet's shell: the zinc weathered dark, so its bright ribs and rim stand out on it)
  sh: { c: '#3d4952', kind: 3 },
  shA: { c: '#4a5862', kind: 3 },
  shB: { c: '#323c44', kind: 3 },
  // (the goggles' lenses: smoked glass, lit when enchanted)
  lens: { c: '#24343b', kind: 3, lit: { c: '#ffe7a6', kind: 1 } },
  leather: { c: '#4a3324', kind: 2 },
  leatherD: { c: '#2e2018', kind: 2 },
  leatherL: { c: '#6b4b33', kind: 2 },
  // (the apron: a heavier, oiled leather, nearly black)
  apron: { c: '#3a2a20', kind: 2 },
  wood: { c: '#8a6440', kind: 2 },
  woodL: { c: '#a98256', kind: 2 },
  woodD: { c: '#4f3520', kind: 2 },
  // (the slow match: hemp cord; its lit end an ember, lit when enchanted)
  match: { c: '#7a6a4a', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  ember: { c: '#5a2c1a', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  // (the mantlet's sighting slot: dark, lit when enchanted)
  slot: { c: '#14191c', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  // (the oilskin: a dark green-black, its quilting a shade darker, its edge a sheen)
  oil: { c: '#26332f', kind: 2 },
  oilD: { c: '#1b2522', kind: 2 },
  oilL: { c: '#3f5049', kind: 2 },
  parch: { c: '#d8c9a0', kind: 2 },
  strap: { c: '#8a6646', kind: 2 },
  // (the breeches: heavy canvas, a dull olive-brown; its waist left out under a chest piece)
  canvas: { c: '#4f4a33', kind: 2 },
  sole: { c: '#211813', kind: 2 },
  canvasW: { c: '#4f4a34', kind: 2 },
  canvasD: { c: '#38341f', kind: 2 },
  parchD: { c: '#9c8a62', kind: 2 },
};

/* ---- the helm --------------------------------------------------------------------------------------------------- */
/**
 * The sapper's helm: a round skull from the brow to the nape under a riveted comb, a short peak out over the eyes, a
 * deep neck guard of three lames sloped out and down behind; leather ear flaps, each with a zinc ear plate pierced round
 * a rivet; the goggles pushed up on the brow (brass-rimmed eyecups, their lenses lit when enchanted) on a leather strap
 * round the skull. The face open under the peak. Rigid on the head.
 */
export function zincHelm(B) {
  const female = B.who === 'female', out = [];
  const H = headDome(B, { fit: female ? 0.1 : 0.13, rise: 0.02 }), D = H.D, c = H.c;
  const w = () => boneW(B, 'head');
  const front = (ph) => Math.abs(wrapAngle(ph));
  // -- the skull: its foot just over the brow before, over the ears' tops at the sides, low at the nape behind
  const bt = H.browTh;
  const rimTh = (ph) => { const f = front(ph); return bt - 0.1 + 0.32 * smooth(0.55, 1.5, f) + 0.2 * smooth(1.6, 2.6, f); };
  const NV = 40;
  const skull = plateOn(D, { a0: -PI, a1: PI, closed: true, t0: () => 0, t1: (a) => rimTh(a) / PI, nu: 12, nv: NV, off: () => 0 });
  out.push(solid(skull, { sheet: true, w, mat: spangleOf(skull, 'zn', 0.3) }));
  // (a band riveted round its foot, its edge rolled)
  out.push(band(rowPath(skull, 11.2, 0, NV, NV), { wide: 0.16, high: 0.03, mat: 'znM', w, closed: true }));
  out.push(tube(rowPath(skull, 12, 0, NV, NV), { r: 0.04, k: 4, mat: 'znL', w, closed: true }));
  out.push(...studsAlong(rowPath(skull, 11.2, 0, NV, NV * 2, 0.03), 16, { from: 0, to: 15 / 16, r: 0.045, h: 0.04, k: 4, mat: 'znL', w }));
  // -- the comb: a riveted ridge from over the brow over the crown to the nape, its top rolled
  const th0 = -(bt - 0.4), th1 = 2.2, Hc = female ? 0.24 : 0.3;
  const combAt = (s) => { const th = th0 + (th1 - th0) * s; return D.ta(Math.abs(th) / PI, th < 0 ? 0 : PI); };
  const combH = (s) => Hc * (0.3 + 0.7 * Math.sin(PI * Math.min(1, 0.1 + s * 1.05)) ** 0.5);
  const comb = patch((u, v) => { const q = combAt(u); return { p: add(q.p, add(mul(q.n, combH(u) * v - 0.04), [0.035, 0, 0])), n: [1, 0, 0] }; }, 20, 1);
  out.push(solid(comb, { w, thick: 0.07, mat: () => 'znM', inner: 'znM', edge: 'znS' }));
  const ridge = [...Array(21).keys()].map((k) => { const s = k / 20, q = combAt(s); return { p: add(q.p, mul(q.n, combH(s) - 0.01)), n: q.n }; });
  out.push(tube(ridge, { r: 0.045, k: 4, mat: 'znL', w }));
  // (rivets either side of its foot)
  for (const sg of [1, -1]) {
    const side = [...Array(13).keys()].map((k) => { const s = 0.06 + (0.88 * k) / 12, q = combAt(s); return { p: add(q.p, add(mul(q.n, combH(s) * 0.45), [sg * 0.075, 0, 0])), n: [sg, 0, 0] }; });
    out.push(...studsAlong(side, 6, { from: 0.08, to: 0.92, r: 0.045, h: 0.035, k: 4, mat: 'znL', w }));
  }
  // -- the peak: a short flat brim out over the eyes, dipped a little, its edge rolled
  const pW = 1.25, pL = female ? 0.36 : 0.42;
  const peak = patch((u, v) => {
    const a = -pW + 2 * pW * v, q = skull.at(12, ((a + PI) / (2 * PI)) * NV), h = unit([q.p[0] - c[0], 0, q.p[2] - c[2]]);
    const L = pL * Math.cos((a / pW) * (PI / 2)) ** 0.6;
    return { p: add(add(q.p, mul(h, L * u - 0.02)), [0, -0.12 * L * u - 0.02, 0]), n: unit(add([0, 1, 0], mul(h, 0.15))) };
  }, 3, 20);
  out.push(solid(peak, { w, thick: 0.045, mat: (i) => (i === 0 ? 'znM' : 'zn'), inner: 'znS', edge: 'znS' }));
  out.push(tube(rowPath(peak, 3, 0, 20, 20), { r: 0.04, k: 4, mat: 'znL', w }));
  // -- the neck guard: three lames hung from the skull's foot behind, sloping out and down, each over the next
  const gA = 1.8, NG = 20, lames = 3, gDrop = female ? 0.58 : 0.7;
  for (let k = 0; k < lames; k++) {
    const s0 = (gDrop / lames) * k - 0.04, s1 = (gDrop / lames) * (k + 1);
    const lame = patch((u, v) => {
      const a = gA + (2 * PI - 2 * gA) * v, q = skull.at(12, ((wrapAngle(a) + PI) / (2 * PI)) * NV), h = unit([q.p[0] - c[0], 0, q.p[2] - c[2]]);
      const s = s0 + (s1 - s0) * u, side = smooth(gA, gA + 0.5, a) * smooth(2 * PI - gA, 2 * PI - gA - 0.5, a);
      // (sloped out as it falls, the more toward the middle behind; shorter toward its ends)
      const d = s * (0.6 + 0.4 * side), out1 = 0.7 * d + 0.35 * d * d;
      return { p: add(add(q.p, mul(h, out1 - 0.03 * k + 0.02)), [0, -d, 0]), n: unit(add(h, [0, 0.6, 0])) };
    }, 2, NG);
    out.push(solid(lame, { hollow: true, w, thick: 0.04, mat: k === 0 ? spangleOf(lame, 'zn', 0.3) : spangleOf(lame, 'znM', 0.3), edge: 'znS' }));
    out.push(tube(rowPath(lame, 2, 0, NG, NG), { r: k === lames - 1 ? 0.045 : 0.035, k: 4, mat: k === lames - 1 ? 'znL' : 'znS', w }));
    if (k === lames - 1) out.push(...studsAlong(rowPath(lame, 1.2, 1, NG - 1, NG, 0.01), 7, { r: 0.04, h: 0.035, k: 4, mat: 'znL', w }));
  }
  // -- the ear flaps: leather from the skull's foot over each ear, rounded below, a zinc ear plate pierced round a rivet
  for (const sg of [1, -1]) {
    const a0 = sg * 1.0, a1 = sg * 1.95, NE = 8;
    const flap = plateOn(D, {
      a0: Math.min(a0, a1), a1: Math.max(a0, a1),
      t0: (a) => (rimTh(a) - 0.06) / PI,
      t1: (a, v) => (rimTh(a) + (female ? 0.66 : 0.74) * Math.sin(PI * (0.12 + 0.8 * v)) ** 0.6) / PI,
      nu: 6, nv: NE, off: (u) => 0.04 + 0.03 * u,
    });
    out.push(solid(flap, { w, thick: 0.035, mat: () => 'leather', inner: 'leatherD', edge: 'leatherD' }));
    out.push(tube(rowPath(flap, 6, 0, NE, NE), { r: 0.03, k: 4, mat: 'leatherL', w }));
    const ec = flap.at(3.6, NE / 2), en = ec.n;
    const ear = discAt(add(ec.p, mul(en, 0.01)), en, { rim: female ? 0.19 : 0.22, k: 12, rings: 2, r0: 0.2, dome: 0.02 });
    out.push(solid(ear, { sheet: true, w, mat: (i) => (i === 0 ? 'znMB' : 'znM') }));
    out.push(tube(rowPath(ear, 2, 0, 12, 12), { r: 0.025, k: 4, mat: 'zn', w, closed: true }));
    for (let j = 0; j < 6; j++) { const q = ear.at(1.2, j * 2); out.push(stud(q.p, q.n, { r: 0.03, h: 0.01, k: 4, mat: 'znD', w })); }
    out.push(stud(add(ec.p, mul(en, 0.05)), en, { r: 0.06, h: 0.05, k: 5, mat: 'znL', w }));
  }
  // -- the chin strap: from the foot of one ear flap under the chin to the other's, buckled on the left
  const chin = [...Array(17).keys()].map((k) => { const f = k / 16, ph = 1.45 - 2.9 * f, th = 2.05 + (female ? 0.52 : 0.58) * Math.sin(PI * f) ** 0.7, q = D.ta(th / PI, ph); return { p: add(q.p, mul(q.n, 0.02)), n: q.n }; });
  out.push(band(chin, { wide: 0.1, high: 0.03, mat: 'leather', w }));
  { const q = chin[3]; out.push(buckle(q.p, q.n, sub(chin[4].p, chin[2].p), { wd: 0.14, ht: 0.11, r: 0.02, mat: 'brass', w })); }
  // -- the goggles pushed up on the brow: a leather strap round the skull, two brass-rimmed eyecups on it
  const gTh = bt - (female ? 0.42 : 0.44);
  const strap = [...Array(NV + 1).keys()].map((k) => { const a = -PI + (2 * PI * k) / NV, q = D.ta(gTh / PI, a); return { p: add(q.p, mul(q.n, 0.03)), n: q.n }; });
  out.push(band(strap.slice(0, NV), { wide: 0.13, high: 0.03, mat: 'leather', w, closed: true }));
  const eR = female ? 0.19 : 0.215, eX = female ? 0.37 : 0.42;
  const cups = [];
  for (const sg of [1, -1]) {
    const q = D.ta(gTh / PI, sg * eX), n = unit(add(q.n, [0, 0.25, 0.1]));
    cups.push(add(q.p, mul(n, 0.12)));
    out.push(eyecup(add(q.p, mul(q.n, 0.02)), n, { r: eR, h: 0.17, k: 10, mat: 'leatherD', rimMat: 'brass', lens: 'lens', w, rimR: 0.045 }));
  }
  // (the bridge between the cups)
  out.push(tube([{ p: cups[0], n: [0, 0, 1] }, { p: lerp(cups[0], cups[1], 0.5), n: [0, 0, 1] }, { p: cups[1], n: [0, 0, 1] }].map((q, k) => ({ p: add(q.p, [0, k === 1 ? 0.04 : 0, k === 1 ? 0.02 : 0]), n: q.n })), { r: 0.035, k: 4, mat: 'brass', w }));
  const P = merge(...out);
  // (the head's own polygons under it left out: every corner inside the skull, short of its foot)
  const inside = (i) => { const v = sub(B.V[i], c), th = Math.acos(clamp(unit(v)[1], -1, 1)), ph = Math.atan2(v[0], v[2]); return th < rimTh(ph) - 0.12; };
  B.A.polys.forEach(([v], pi) => { if (v.every((i) => inside(i))) P.hides.add(pi); });
  return P;
}
void dot; void cross; void len; void lerp; void colPath; void sweep; void frameAt;

/* ---- chest & arms ------------------------------------------------------------------------------------------------ */
/** The arm's skin samples on side `s` ('l' or 'r'): of the parts given, more than `k` of their weight. */
const armPick = (B, s, parts, k = 0.6) => (q) => (s === 'l' ? q.p[0] > 0.15 : q.p[0] < -0.15) && shareW(B, q.w, ...parts) > k;
/** Weights kept to the bones of one side's arm (and the clavicle). */
const armBones = (s) => (n) => n.endsWith(`_${s}`);
/** The work coat: dark leather over the torso and the arms to the wrists, close over the skin, the skin under it left out. */
function coat(B) {
  const A = B.at, M = torsoMarks(B);
  return shell(B, {
    sub: 0, rim: null,
    keep: (i) => { const p = B.V[i]; return on(B, i, 'torso', 'shoulder', 'upperarm', 'forearm', 'neck', 'head', 'thigh') > 0.6 && headW(B, B.W[i]) < 0.05 && on(B, i, 'hand') < 0.35 && p[1] > M.waist - 0.3 && on(B, i, 'thigh') < 0.5 && p[1] < A.neck[1] - 0.02; },
    off: ({ p }) => 0.06 + 0.03 * smooth(M.waist, M.hip, p[1]) - 0.025 * smooth(A.neck[1] - 0.6, A.neck[1] - 0.1, p[1]),
    // (the sleeves' seams and the coat's: a darker leather on the arms below the elbow, under the gauntlets)
    mat: ({ bv }) => (shareW(B, B.W[bv], 'forearm') > 0.5 ? 'leatherD' : 'leather'),
  });
}

/**
 * The plates over the coat: a cuirass of four lames lapped down the front (each over the next, its foot rolled bright,
 * riveted to the coat at its ends), a leather collar rolled round the neck, a riveted zinc yoke across the shoulder blades;
 * the tool belt (a zinc belt plate, a box pouch on each hip); the bandolier from the right shoulder to the left hip with
 * chisels in its loops and the slow match coiled on it, its end lit (when enchanted); the engineers' badge, a compass
 * over a square, on the top lame; the apron split for the legs before and the coat's tails behind.
 */
function coatPlates(B) {
  const A = B.at, M = torsoMarks(B), F = torsoField(B), t = F.tOfY, out = [], female = B.who === 'female';
  const W = nearSkinW(B, (s) => shareW(B, s.w, 'torso') > 0.7, (n) => TORSO_BONES.has(n), 0.35);
  // -- the cuirass's front: from the waist up to a neckline cut square, its armholes round to the armpit
  const side = PI / 2 - 0.05, aN = 0.62;
  const topF = (a) => { const ax = Math.abs(a), yC = M.neckF + 0.04; if (ax <= aN) return M.neckF; const k = clamp((ax - aN) / (side - aN)); return M.pit + (yC - M.pit) * Math.sqrt(Math.max(0, 1 - k * k)); };
  const bust = (yy, a) => (female ? 0.05 : 0.06) * Math.exp(-(((yy - lerp(A.chest, [0, M.waist, 0], 0.3)[1]) / 0.8) ** 2)) * Math.max(0, Math.cos(a)) ** 1.5;
  const bot = M.waist - 0.12, NL = 4, NV = 22;
  // (the lames' feet: the top lame the deepest, down to the armpit; the rest even below it)
  const y1 = M.pit + 0.02;
  const lameTop = (k) => (k === 0 ? topF : () => y1 - ((y1 - bot) * (k - 1)) / (NL - 1) + 0.08);
  const lameBot = (k) => (k === 0 ? () => y1 : () => y1 - ((y1 - bot) * k) / (NL - 1));
  const lames = [];
  for (let k = 0; k < NL; k++) {
    const off = (u, v, tt, a) => 0.16 + 0.035 * (NL - k) + bust(F.yOfT(tt), a) + 0.04 * (1 - u) ** 2;
    const g = plateOn(F, { a0: -side, a1: side, t0: (a) => t(lameBot(k)(a)), t1: (a) => t(lameTop(k)(a)), nu: k === 0 ? 7 : 3, nv: NV, off });
    lames.push(g);
    out.push(solid(g, { sheet: k === 0, hollow: k !== 0, w: W, thick: 0.04, mat: spangleOf(g, k === 0 ? 'zn' : 'zn', 0.32), inner: 'znD', edge: 'znS' }));
    out.push(tube(rowPath(g, 0, 0, NV, NV), { r: 0.04, k: 4, mat: 'znL', w: W }));
    // (riveted at each end and down the middle)
    for (const j of [0.6, NV / 2, NV - 0.6]) { const q = g.at(1.1, j); out.push(stud(q.p, q.n, { r: 0.05, h: 0.045, k: 4, mat: 'znL', w: () => W(q.p) })); }
  }
  // (the top lame's neckline and armholes rolled)
  out.push(tube(rowPath(lames[0], 7, 0, NV, NV), { r: 0.045, k: 4, mat: 'znL', w: W }));
  // -- the leather collar standing round the neck, its top rolled over: lower before, higher behind
  const n = A.neck[1], behind = (a) => smooth(0.9, 2.3, Math.abs(wrapAngle(a)));
  const cTop = (a) => n - 0.02 - 0.24 * behind(a) - 0.3 * smooth(1.5, 0.3, Math.abs(wrapAngle(a)));
  const wNeck = mixOf(B, [['neck_01', 0.4], ['spine_03', 0.6]]);
  const collar = plateOn(F, { a0: -PI, a1: PI, closed: true, t0: (a) => t(cTop(a) - 0.22), t1: (a) => t(cTop(a)), nu: 3, nv: 28, maxUp: 0.3, off: (u) => 0.1 + 0.05 * (1 - u) });
  // (moving with the skin under it: the neck's and the shoulders' tops)
  const wC = nearSkinW(B, (q) => shareW(B, q.w, 'torso', 'neck') > 0.8 && headW(B, q.w) < 0.1 && q.p[1] > M.neckF - 0.6, (nn) => nn !== 'head' && nn !== 'jaw' && nn !== 'neck_02', 0.3);
  const wCol = (p) => mixW([[wC(p), 0.75], [wNeck, 0.25]]);
  out.push(smoothWeights(solid(collar, { w: wCol, thick: 0.04, mat: () => 'leather', inner: 'leatherD', edge: 'leatherD' }), 2));
  out.push(sweep(rowPath(collar, 3, 0, 28, 28, 0.04), { closed: true, closedProfile: true, profile: roundProfile(0.07, 5), mat: 'leatherL', w: wCol }));
  // -- the yoke behind: a riveted zinc plate across the shoulder blades
  const bN = 0.7;
  const topB = (a) => { const bx = PI - Math.abs(wrapAngle(a)), yC = M.neckB + 0.04; if (bx <= bN) return M.neckB; const k = clamp((bx - bN) / (PI - side - bN)); return M.pit + 0.1 + (yC - M.pit - 0.1) * Math.sqrt(Math.max(0, 1 - k * k)); };
  const yoke = plateOn(F, { a0: side + 0.05, a1: 2 * PI - side - 0.05, t0: () => t(M.pit - 0.25), t1: (a) => t(topB(a)), nu: 6, nv: 18, off: (u) => 0.15 + 0.04 * (1 - u) ** 2 });
  out.push(solid(yoke, { sheet: true, w: W, mat: spangleOf(yoke, 'zn', 0.32) }));
  out.push(tube(rowPath(yoke, 0, 0, 18, 18), { r: 0.04, k: 4, mat: 'znL', w: W }));
  out.push(tube(rowPath(yoke, 6, 0, 18, 18), { r: 0.04, k: 4, mat: 'znL', w: W }));
  out.push(...studsAlong(rowPath(yoke, 0.9, 0.5, 17.5, 18), 6, { r: 0.05, h: 0.045, k: 4, mat: 'znL', w: W }));
  // -- the belt: broad leather round the waist, a zinc belt plate before, a box pouch on each hip
  const bY = M.waist - 0.05, bH = 0.3;
  const belt = plateOn(F, { a0: -PI, a1: PI, closed: true, t0: () => t(bY - bH / 2), t1: () => t(bY + bH / 2), nu: 2, nv: 32, off: () => 0.2 });
  out.push(solid(belt, { sheet: true, w: W, mat: () => 'leatherD' }));
  out.push(tube(rowPath(belt, 0, 0, 32, 32), { r: 0.025, k: 4, mat: 'leatherL', w: W, closed: true }));
  out.push(tube(rowPath(belt, 2, 0, 32, 32), { r: 0.025, k: 4, mat: 'leatherL', w: W, closed: true }));
  const bp = plateOn(F, { a0: -0.36, a1: 0.36, t0: () => t(bY - bH / 2 - 0.08), t1: () => t(bY + bH / 2 + 0.08), nu: 2, nv: 6, off: () => 0.25 });
  out.push(solid(bp, { w: W, thick: 0.04, mat: () => 'znM', inner: 'znD', edge: 'znS' }));
  out.push(tube([...rowPath(bp, 0, 0, 6, 3), ...rowPath(bp, 2, 6, 0, 3)].map((q) => q), { r: 0.03, k: 4, mat: 'znL', w: W, closed: true }));
  for (const [i, j] of [[0.4, 0.5], [0.4, 5.5], [1.6, 0.5], [1.6, 5.5]]) { const q = bp.at(i, j); out.push(stud(q.p, q.n, { r: 0.04, h: 0.035, k: 4, mat: 'znL', w: () => W(q.p) })); }
  // (a box pouch on each hip: a block of leather under a zinc-edged flap)
  for (const sg of [1, -1]) {
    const a0 = sg * 1.05, a1 = sg * 1.6, pt = t(bY - bH / 2 - 0.36), pm = t(bY - bH / 2 + 0.02);
    const box = plateOn(F, { a0: Math.min(a0, a1), a1: Math.max(a0, a1), t0: () => pt, t1: () => pm, nu: 3, nv: 4, off: (u, v) => 0.22 + 0.07 * Math.sin(PI * Math.min(1, u * 1.2)) ** 0.3 * Math.sin(PI * v) ** 0.3 });
    out.push(solid(box, { w: W, thick: 0.03, mat: () => 'leather', inner: 'leatherD', edge: 'leatherD' }));
    const flap = plateOn(F, { a0: Math.min(a0, a1) - 0.03, a1: Math.max(a0, a1) + 0.03, t0: () => t(bY - bH / 2 - 0.2), t1: () => pm + 0.005, nu: 2, nv: 4, off: (u, v) => 0.31 + 0.02 * u });
    out.push(solid(flap, { sheet: true, w: W, mat: () => 'leatherD' }));
    out.push(tube(rowPath(flap, 0, 0, 4, 4), { r: 0.03, k: 4, mat: 'zn', w: W }));
    { const q = flap.at(0.4, 2); out.push(stud(q.p, q.n, { r: 0.045, h: 0.04, k: 4, mat: 'znL', w: () => W(q.p) })); }
  }
  // -- the apron before (split for the legs) and the coat's tails behind, each swinging with its thigh
  const legW = (s) => { const hp = A.hip[s], kn = A.knee[s], sgn = s === 'l' ? 1 : -1; return skinW(B, (q) => q.p[0] * sgn > 0.12 && shareW(B, q.w, 'thigh') > 0.6 && along(q.p, hp, kn) > 0.2 && along(q.p, hp, kn) < 0.7, (nn) => nn.endsWith(`_${s}`)); };
  const aBot = lerp(A.hip.l, A.knee.l, female ? 0.42 : 0.45)[1], wP = boneW(B, 'pelvis');
  for (const sg of [1, -1]) {
    const s = sg > 0 ? 'l' : 'r', wT = legW(s), top = bY - bH / 2 + 0.03;
    const w = (p) => { const f = clamp((top - p[1]) / (top - aBot)); return mixW([[wP, 1 - f], [wT, f]]); };
    for (const [c0, c1, lo, back] of [[0.05, 1.05, aBot, false], [PI - 1.0, PI - 0.06, lerp([0, M.hip, 0], [0, aBot, 0], 0.55)[1], true]]) {
      const a0 = sg > 0 ? c0 : -c1, a1 = sg > 0 ? c1 : -c0;
      const g = plateOn(F, { a0, a1, t0: (a) => t(lo - (back ? 0 : 0.08 * Math.sin(PI * (a - a0) / (a1 - a0)))), t1: () => t(top), nu: 6, nv: 6, off: (u) => 0.21 + 0.09 * (1 - u) ** 1.3 });
      out.push(solid(g, { w, thick: 0.035, mat: () => (back ? 'leather' : 'apron'), inner: 'leatherD', edge: 'leatherD' }));
      out.push(tube(rowPath(g, 0, 0, 6, 6), { r: 0.03, k: 4, mat: 'leatherL', w }));
      if (!back) { for (const j of [0.5, 5.5]) { const q = g.at(0.5, j); out.push(stud(q.p, q.n, { r: 0.045, h: 0.04, k: 4, mat: 'znL', w: () => w(q.p) })); } }
    }
  }
  // -- the bandolier: from over the right shoulder before, down across the breast to the left hip, and back up behind
  const bd = (y0, a0, y1, a1, k) => [...Array(k + 1).keys()].map((j) => { const f = j / k, a = a0 + (a1 - a0) * f, yy = y0 + (y1 - y0) * f, q = F.ta(t(yy), a); return { p: q.p, n: q.n, a, yy }; });
  const lift = (path, off) => path.map((q) => ({ p: add(q.p, mul(q.n, off(q))), n: q.n }));
  const bandOff = (q) => { let o = 0.28; for (let k = 0; k < NL; k++) { const lo = lameBot(k)(q.a), hi = lameTop(k)(q.a); if (q.yy > lo - 0.02 && q.yy < hi && Math.abs(q.a) < side) o = Math.max(o, 0.16 + 0.035 * (NL - k) + bust(q.yy, q.a) + 0.04 + 0.1); } return o; };
  const front = lift(bd(M.neckF - 0.16, -0.62, bY + bH / 2 - 0.02, 0.78, 14), (q) => bandOff(q) + 0.06 * smooth(M.neckF - 0.5, M.neckF - 0.16, q.yy));
  out.push(band(front, { wide: 0.36, high: 0.04, mat: 'strap', w: W }));
  for (const sd of [-0.18, 0.18]) out.push(tube(front.map((q, k) => { const d = unit(sub(front[Math.min(front.length - 1, k + 1)].p, front[Math.max(0, k - 1)].p)), sx = unit(cross(d, q.n)); return { p: add(add(q.p, mul(sx, sd)), mul(q.n, 0.04)), n: q.n }; }), { r: 0.022, k: 3, mat: 'leatherD', w: W }));
  out.push(...studsAlong(front, 9, { from: 0.04, to: 0.96, r: 0.035, h: 0.03, k: 4, mat: 'brass', w: W }));
  const backB = lift(bd(M.neckB - 0.1, -(PI - 0.65), bY + bH / 2 - 0.02, -(PI + 0.85), 12), (q) => (q.yy > M.pit - 0.3 ? 0.27 : 0.22));
  out.push(band(backB, { wide: 0.2, high: 0.03, mat: 'leatherL', w: W }));
  // (the sapper's tools in its loops: a mallet laid along it under the right shoulder, its head banded in zinc; two
  // chisels hung below it, their blades bright)
  const along3 = (k) => { const i = Math.round(k), q = front[i], d = unit(sub(front[Math.min(front.length - 1, i + 1)].p, front[Math.max(0, i - 1)].p)); return { ...q, d }; };
  const K = female ? 0.85 : 1;
  { const q0 = along3(5), q1 = along3(9), h0 = add(q0.p, mul(q0.n, 0.11)), h1 = add(q1.p, mul(q1.n, 0.11)), wq = () => W(q0.p);
    out.push(sweep([{ p: h0, n: q0.n }, { p: lerp(h0, h1, 0.5), n: unit(lerp(q0.n, q1.n, 0.5)) }, { p: h1, n: q1.n }], { closedProfile: true, profile: roundProfile(0.08, 4), mat: 'woodL', w: wq }));
    // (the head: a block across the handle's top end)
    const hx = unit(cross(q0.d, q0.n)), hc = add(h0, mul(q0.n, 0.06)), L = 0.5 * K, R = 0.23 * K;
    out.push(sweep([{ p: add(hc, mul(hx, -L)), n: q0.n }, { p: add(hc, mul(hx, -L * 0.6)), n: q0.n }, { p: add(hc, mul(hx, L * 0.6)), n: q0.n }, { p: add(hc, mul(hx, L)), n: q0.n }], { closedProfile: true, profile: roundProfile(R, 6), mat: 'woodL', w: wq }));
    for (const f of [-0.75, 0.75]) { const c2 = add(hc, mul(hx, f * L)), Fr = frameAt(c2, hx, q0.n); out.push(tube([...Array(6).keys()].map((j) => { const a = (j / 6) * 2 * PI, v = add(mul(Fr.x, Math.cos(a) * (R + 0.015)), mul(Fr.y, Math.sin(a) * (R + 0.015))); return { p: add(c2, v), n: unit(v) }; }), { r: 0.035, k: 3, mat: 'znS', w: wq, closed: true })); }
    for (const sgn of [-1, 1]) out.push(stud(add(hc, mul(hx, sgn * L)), mul(hx, sgn), { r: R, h: 0.03, k: 6, mat: 'woodD', w: wq }));
    // (its loop round the handle)
    out.push(band(lift(front.slice(7, 10), () => 0.13), { wide: 0.08, high: 0.03, mat: 'leatherD', w: W }));
  }
  for (const [k, Lb, Lh] of [[1.2, 0.34, 0.26], [2.5, 0.3, 0.24]]) {
    const q = along3(k), up = unit(sub([0, 1, 0], mul(q.n, dot([0, 1, 0], q.n)))), base = add(q.p, mul(q.n, 0.1)), side2 = unit(cross(up, q.n)), wq = () => W(q.p);
    // (the blade: a flat bar widening to its edge, polished)
    out.push(sweep([{ p: base, n: q.n }, { p: add(base, mul(up, -Lb * K * 0.8)), n: q.n }, { p: add(base, mul(up, -Lb * K)), n: q.n }], { closedProfile: true, profile: (j) => { const wd = [0.05, 0.06, 0.085][j] * K; return [[-wd, -0.025], [wd, -0.025], [wd, 0.025], [-wd, 0.025]]; }, mat: 'znL', w: wq }));
    out.push(sweep([{ p: base, n: q.n }, { p: add(base, mul(up, Lh * K)), n: q.n }], { closedProfile: true, profile: roundProfile(0.09 * K, 5), mat: 'woodD', w: wq }));
    out.push(stud(add(base, mul(up, Lh * K)), up, { r: 0.095 * K, h: 0.05, k: 5, mat: 'znL', w: wq }));
    out.push(band([{ p: add(base, mul(side2, -0.1)), n: q.n }, { p: add(base, mul(side2, 0.1)), n: q.n }].map((x) => ({ p: add(x.p, mul(q.n, 0.03)), n: x.n })), { wide: 0.06, high: 0.03, mat: 'leatherD', w: wq }));
  }
  // (the slow match coiled on the bandolier below the breast, its end hanging free and lit)
  { const q = along3(11.4), base = add(q.p, mul(q.n, 0.05)), cA = add(base, mul(q.n, -0.02)), cB = add(base, mul(q.n, 0.16));
    out.push(coil(cA, cB, { R: female ? 0.17 : 0.2, r: 0.045, turns: 3, mat: 'match', w: () => W(q.p), up: q.d }));
    const end0 = add(cB, mul(q.d, -(female ? 0.17 : 0.2))), end1 = add(end0, [0.02, -0.22, 0.04]);
    out.push(sweep([{ p: end0, n: q.n }, { p: lerp(end0, end1, 0.5), n: q.n }, { p: end1, n: q.n }], { closedProfile: true, profile: roundProfile(0.03, 4), mat: 'match', w: () => W(q.p) }));
    out.push(stud(end1, [0, -1, 0], { r: 0.06, h: 0.07, k: 5, mat: 'ember', w: () => W(q.p) }));
    // (a brass ring holding the coil to the bandolier)
    out.push(tube([...Array(8).keys()].map((j) => { const a = (j / 8) * 2 * PI, F2 = frameAt(base, q.n, q.d), d = add(mul(F2.x, Math.cos(a) * 0.08), mul(F2.y, Math.sin(a) * 0.08)); return { p: add(add(base, mul(q.n, 0.08)), d), n: q.n }; }), { r: 0.025, k: 4, mat: 'brass', w: () => W(q.p), closed: true }));
    // (and the match's lit core: the coil's top turn glowing through)
    out.push(stud(add(cB, mul(q.n, 0.01)), q.n, { r: 0.07, h: 0.03, k: 6, mat: 'ember', w: () => W(q.p) }));
  }
  // -- the engineers' badge on the belt plate: a square, a pair of compasses standing over it, in brass
  { const q = bp.at(1, 3), o = q.n, Fr = frameAt(q.p, o), base = add(q.p, mul(o, 0.03)), w = () => W(q.p), S = female ? 0.75 : 0.85;
    const P = (x, yy) => ({ p: add(base, add(mul(Fr.x, yy * S), mul(Fr.y, x * S * 1.2))), n: o });
    const flat = (pts, wd) => sweep(pts, { closedProfile: true, profile: [[-wd / 2, -0.01], [wd / 2, -0.01], [wd / 2, 0.025], [-wd / 2, 0.025]], mat: 'brass', w });
    // (the square: an L, its corner below)
    out.push(flat([P(-0.2, 0.0), P(0, -0.2), P(0.2, 0.0)], 0.05));
    // (the compasses: two legs from a hinge above, spread over the square)
    out.push(flat([P(0, 0.22), P(-0.15, -0.12)], 0.04), flat([P(0, 0.22), P(0.15, -0.12)], 0.04));
    out.push(stud(P(0, 0.22).p, o, { r: 0.045, h: 0.04, k: 5, mat: 'brass', w }));
  }
  return { parts: out, F, M, W, lames, NV, topF };
}

/** One arm: a spaulder of a cop and two lames over the shoulder, the leather sleeve, a couter cup, the gauntlet's flared cuff with a zinc splint strapped on. */
function armOf(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, sh = A.shoulder[s], el = A.elbow[s], wr = A.wrist[s], out = [], female = B.who === 'female';
  const upDir = unit(sub(el, sh)), foreDir = unit(sub(wr, el)), uaLen = len(sub(el, sh)), faLen = len(sub(wr, el));
  const upPick = armPick(B, s, ['upperarm', 'shoulder']);
  const UA = limbWrap(B, sh, el, sg, { t: [-0.05, 0.95], nt: 16, a: [-PI, PI], closed: true, na: 22, pick: upPick, smooth: 3, shape: (r) => r });
  const wSh = mixOf(B, [[`shoulder_${s}`, 0.45], [`upperarm_${s}`, 0.15], [`clavicle_${s}`, 0.4]]);
  const wUp = skinW(B, (q) => upPick(q) && along(q.p, sh, el) > 0.3 && along(q.p, sh, el) < 0.8, armBones(s));
  // -- the spaulder: a cop over the shoulder's ball, then two lames down the upper arm's outside, each stepped in
  const ax = unit([sg * 0.5, 0.87, 0]);
  const shPick = (q) => q.p[0] * sg > 0.78 * sh[0] * sg && shareW(B, q.w, 'shoulder', 'upperarm', 'torso') > 0.8 && shareW(B, q.w, 'neck', 'head') < 0.1 && len(sub(q.p, sh)) < 1.2 && q.p[1] > sh[1] - 0.9;
  const cc = add(sh, [sg * 0.02, -0.1, 0]);
  const near = skinSamples(B).filter(shPick).map((q) => sub(q.p, cc));
  const ex = Math.max(...near.map((v) => v[0] * sg)), ro = ex + 0.3, E = [ro * 1.0, ro * 0.6, ro * 0.95];
  const D = domeWrap(B, { c: cc, u: ax, f: [0, 0, 1], s: [0, 1, 0], pick: shPick, rows: 20, cols: 32, thMax: 2.0, cone: 0.35, smooth: 4, shape: (r, th, ph, d) => Math.max(r + 0.2, ellipsoidReach(E, d)) });
  const reach = (ph) => { const c = Math.cos(ph), sn = Math.sin(ph); return Math.max(0.6, (Math.abs(c) * 1.15 + Math.max(0, sn) * 0.5 + Math.max(0, -sn) * 1.25) / (Math.abs(c) + Math.abs(sn))); };
  const cop = plateOn(D, { a0: -PI, a1: PI, closed: true, t0: () => 0, t1: (a) => reach(a) / 2.0, nu: 7, nv: 24, off: (u) => 0.08 * u * u });
  out.push(solid(cop, { sheet: true, w: () => wSh, mat: spangleOf(cop, 'zn', 0.3) }));
  out.push(tube(rowPath(cop, 7, 0, 24, 24), { r: 0.045, k: 4, mat: 'znL', w: () => wSh, closed: true }));
  // (a raised riveted rib over its crown, out along the arm)
  // (a raised riveted rib over its crown, from its front over the top to its back)
  const ribP = [...Array(13).keys()].map((k) => { const f = k / 12, r2 = cop.at(6.2 * Math.abs(1 - 2 * f) + 0.01, f < 0.5 ? 12 : 0.001); return { p: r2.p, n: r2.n }; });
  out.push(band(ribP, { wide: 0.07, high: 0.04, mat: 'znM', w: () => wSh }));
  out.push(...studsAlong(ribP, 5, { from: 0.1, to: 0.9, r: 0.04, h: 0.04, k: 4, mat: 'znL', w: () => wSh }));
  for (let k = 0; k < 2; k++) {
    const t0 = 0.22 + 0.12 * k, t1 = t0 + 0.16;
    const g = plateOn(UA, { a0: PI / 2 - 1.9, a1: PI / 2 + 1.9, t0: () => t0, t1: () => t1, nu: 2, nv: 14, off: () => 0.19 - 0.03 * k });
    out.push(solid(g, { hollow: true, w: () => (k === 0 ? wSh : mixW([[wSh, 0.4], [wUp, 0.6]])), thick: 0.035, mat: spangleOf(g, 'znM', 0.3), edge: 'znS' }));
    out.push(tube(rowPath(g, 0, 0, 14, 14), { r: 0.035, k: 4, mat: 'znL', w: () => (k === 0 ? wSh : mixW([[wSh, 0.4], [wUp, 0.6]])) }));
  }
  // -- the couter: a small cup over the elbow, riveted to a leather wing
  const c0 = sub(el, mul(upDir, uaLen * 0.22)), c1 = add(el, mul(foreDir, faLen * 0.2));
  const elPick = (q) => armPick(B, s, ['upperarm', 'forearm'], 0.6)(q) && len(sub(q.p, el)) < 0.85;
  const EL = limbWrap(B, c0, c1, sg, { t: [0, 1], nt: 8, a: [-PI, PI], closed: true, na: 22, pick: elPick, smooth: 3, shape: (r) => r });
  const wEl = boneW(B, `elbow_${s}`);
  const cup = plateOn(EL, { a0: PI / 2 + 0.3, a1: 2 * PI - 0.9, t0: () => 0.08, t1: () => 0.92, nu: 6, nv: 12, off: (u, v) => 0.12 + 0.06 * Math.sin(PI * u) * Math.sin(PI * v) });
  out.push(solid(cup, { sheet: true, w: () => wEl, mat: spangleOf(cup, 'zn', 0.3) }));
  out.push(tube(rowPath(cup, 0, 0, 12, 12), { r: 0.03, k: 4, mat: 'znL', w: () => wEl }));
  out.push(tube(rowPath(cup, 6, 0, 12, 12), { r: 0.03, k: 4, mat: 'znL', w: () => wEl }));
  { const q = cup.at(3, 6); out.push(stud(q.p, q.n, { r: 0.06, h: 0.05, k: 5, mat: 'znL', w: () => wEl })); }
  // -- the gauntlet: a flared leather cuff from mid-forearm to the wrist, a zinc splint down the forearm's back, two straps
  const faPick = armPick(B, s, ['forearm'], 0.6);
  const FA = limbWrap(B, el, wr, sg, { t: [0, 1.06], nt: 15, a: [-PI, PI], closed: true, na: 22, pick: faPick, smooth: 3, shape: (r) => r });
  const wFa = skinW(B, (q) => faPick(q) && along(q.p, el, wr) > 0.25 && along(q.p, el, wr) < 0.85, armBones(s));
  const wWr = mixOf(B, [[`hand_${s}`, 0.35], [`wrist_${s}`, 0.3], [`lowerarm_${s}`, 0.35]]);
  const cuffW = (p) => { const f = clamp((along(p, el, wr) - 0.45) / 0.5); return mixW([[wFa, 1 - f * 0.7], [wWr, f * 0.7]]); };
  const cuff = plateOn(FA, { a0: -PI, a1: PI, closed: true, t0: () => 1.0, t1: () => 0.42, nu: 6, nv: 22, off: (u) => 0.1 + 0.12 * u ** 1.6 });
  out.push(solid(cuff, { w: cuffW, thick: 0.035, mat: () => 'leather', inner: 'leatherD', edge: 'leatherD' }));
  out.push(tube(rowPath(cuff, 6, 0, 22, 22), { r: 0.035, k: 4, mat: 'leatherL', w: cuffW, closed: true }));
  // (the splint: a zinc plate down the back of the forearm, the arm's outside)
  // (over the cuff where the cuff is, its flare followed)
  const spl = plateOn(FA, { a0: PI / 2 - 0.75, a1: PI / 2 + 0.75, t0: () => 0.9, t1: () => 0.2, nu: 6, nv: 6, off: (u, v, tt) => (tt > 0.42 ? 0.1 + 0.14 * ((0.97 - tt) / 0.55) ** 1.6 : 0.12) });
  out.push(solid(spl, { sheet: true, w: (p) => (along(p, el, wr) > 0.45 ? cuffW(p) : wFa), mat: spangleOf(spl, 'zn', 0.3) }));
  out.push(tube([...colPath(spl, 0, 0, 6, 6), ...rowPath(spl, 6, 0, 6, 6).slice(1), ...colPath(spl, 6, 6, 0, 6).slice(1), ...rowPath(spl, 0, 6, 0, 6).slice(1, -1)], { r: 0.03, k: 4, mat: 'znL', w: (p) => (along(p, el, wr) > 0.45 ? cuffW(p) : wFa), closed: true }));
  for (const tt of [0.32]) {
    const ring = [...Array(22).keys()].map((j) => { const a = -PI + (2 * PI * j) / 22, q = FA.ta(tt, a); return { p: add(q.p, mul(q.n, 0.12 + 0.03)), n: q.n }; });
    out.push(band(ring, { wide: 0.1, high: 0.03, mat: 'leatherD', w: () => wFa, closed: true }));
    const q = FA.ta(tt, PI / 2); out.push(buckle(add(q.p, mul(q.n, 0.16)), q.n, foreDir, { wd: 0.12, ht: 0.14, r: 0.02, mat: 'brass', w: () => wFa }));
  }
  return out;
}

export function zincChest(B) {
  const T = coatPlates(B);
  return coverHides(B, merge(smoothWeights(coat(B), 2, (p) => p[1] < B.at.neck[1] - 0.6), ...T.parts, ...armOf(B, 'l'), ...armOf(B, 'r')), 0.5);
}

/* ---- the mantle: the sapper's mantlet ----------------------------------------------------------------------------- */
/**
 * The mantlet: a blast shield of zinc slung on the back like a turtle's shell over a quilted oilskin pad: four lames
 * lapped down it, three riveted ribs over them, its rim rolled, a sighting slot under a hinged shutter near its top (lit
 * when enchanted); a scroll case of siege plans strapped across its lower half; slung by two straps over the shoulders to
 * a clasp on the breast: the sappers' badge, a pick and a shovel crossed on a lozenge. Rigid on the spine.
 */
export function zincMantle(B) {
  const A = B.at, M = torsoMarks(B), F = torsoField(B), t = F.tOfY, out = [], female = B.who === 'female';
  const n = A.neck[1];
  const wS = mixOf(B, [['spine_03', 0.6], ['spine_02', 0.4]]);
  // (its lames follow the spine down it, so its foot keeps its place over the small of the back as the body bends)
  const w2 = mixOf(B, [['spine_02', 0.7], ['spine_01', 0.3]]), w1 = mixOf(B, [['spine_01', 0.6], ['pelvis', 0.4]]);
  // (blended evenly over its whole height, so no edge of it is stretched where the spine bends)
  const w = (p) => { const f = clamp((p[1] - (M.waist + 0.1)) / (A.chest[1] - (M.waist + 0.1))); return mixW([[w1, Math.max(0, 0.5 - f) * 0.6], [w2, 1 - f], [wS, f]]); };
  const aw = female ? 0.81 : 0.94;
  const da = (a) => Math.abs(wrapAngle(a - PI));
  const yTop = n + (female ? -0.16 : -0.06), yBot = M.waist + 0.25, ySide = female ? -1.95 : -2.05;
  // (a shield's outline: its top a round arch, high behind the neck and down at its sides below the shoulders, where it
  // is widest; its foot rounded up at the corners)
  // (and two horns rising either side of the neck, seen over the shoulders from before)
  const top = (a) => yTop - (yTop - ySide) * clamp(da(a) / aw) ** 2 + (female ? 1.25 : 1.45) * Math.exp(-(((da(a) / aw - 0.78) / 0.13) ** 2));
  const foot = (a) => yBot + 0.35 * clamp(da(a) / aw) ** 3;
  const dome = (a, yy) => (female ? 0.28 : 0.34) * Math.cos(clamp(da(a) / aw) * (PI / 2)) ** 0.7 * Math.sin(PI * clamp((yy - foot(a)) / (top(a) - foot(a)))) ** 0.5;
  const off0 = female ? 0.47 : 0.44;
  // (its upper part leaning back off the shoulders, clear of the helm's neck guard)
  const offAt = (a, yy) => off0 + dome(a, yy) + (female ? 0.42 : 0.55) * smooth(n - 0.9, yTop, yy) ** 1.5 + 0.5 * clamp((yy - yTop) / 0.7);
  // -- the oilskin pad under it: a little larger, its foot scalloped, quilted in rows
  const pad = plateOn(F, { a0: PI - aw - 0.02, a1: PI + aw + 0.02, t0: (a) => t(foot(a) - 0.4 + 0.12 * Math.abs(Math.sin(((a - PI) / aw) * 2.5 * PI))), t1: (a) => t(Math.min(top(a), yTop - 0.05) + 0.07), nu: 12, nv: 18, off: (u, v, tt, a) => offAt(clamp(a, PI - aw, PI + aw), F.yOfT(tt)) - 0.035 });
  // (soft: its foot moving with the back under it, its top with the shell)
  const Wb = nearSkinW(B, (q) => shareW(B, q.w, 'torso') > 0.8, (nn) => TORSO_BONES.has(nn), 0.35);
  const wPad = (p) => w(p);
  void Wb;
  out.push(solid(pad, { sheet: true, w: wPad, mat: (i) => (i % 2 ? 'oil' : 'oilD') }));
  out.push(tube(rowPath(pad, 0, 0, 18, 36), { r: 0.03, k: 4, mat: 'oilL', w: wPad }));
  // -- the shell: four lames lapped down it, each over the one below, its foot rolled bright
  const NL = 4, NV = 24;
  const lames = [];
  for (let k = 0; k < NL; k++) {
    const f0 = k / NL, f1 = (k + 1) / NL + 0.04;
    const yAt = (a, f) => top(a) + (foot(a) - top(a)) * f;
    const g = plateOn(F, { a0: PI - aw, a1: PI + aw, t0: (a) => t(yAt(a, Math.min(1, f1))), t1: (a) => t(yAt(a, f0)), nu: 4, nv: NV, off: (u, v, tt, a) => offAt(a, F.yOfT(tt)) + 0.04 * (NL - k) - 0.03 * (1 - u) });
    lames.push(g);
    out.push(solid(g, { hollow: true, w, thick: 0.04, mat: spangleOf(g, 'sh', 0.34), inner: 'znD', edge: 'znS' }));
    out.push(tubeAll(rowPath(g, 0, 0, NV, NV), { r: 0.045, k: 3, mat: 'znL', w }));
  }
  // (the rim rolled up its sides and over its top)
  const rimL = [...Array(13).keys()].map((k) => { const f = k / 12, a = PI - aw, yy = top(a) + (foot(a) - top(a)) * f; const q = F.ta(t(yy), a); return { p: add(q.p, mul(q.n, offAt(a, yy) + 0.04 * (NL - Math.min(NL - 1, Math.floor(f * NL))))), n: q.n }; });
  const rimR = rimL.map((q) => ({ p: [-q.p[0], q.p[1], q.p[2]], n: [-q.n[0], q.n[1], q.n[2]] }));
  out.push(tubeAll(rimL, { r: 0.05, k: 4, mat: 'znL', w }), tubeAll(rimR, { r: 0.05, k: 4, mat: 'znL', w }));
  out.push(tubeAll(rowPath(lames[0], 4, 0, NV, NV), { r: 0.065, k: 4, mat: 'znL', w }));
  // (three riveted ribs down it, over the lames)
  for (const dd of [-0.62, 0, 0.62]) {
    const a = PI + dd * aw;
    const rib = [...Array(17).keys()].map((k) => { const f = k / 16, yy = top(a) + (foot(a) - top(a)) * f, q = F.ta(t(yy), a), kk = Math.min(NL - 1, Math.floor(f * NL)); return { p: add(q.p, mul(q.n, offAt(a, yy) + 0.04 * (NL - kk) + 0.03)), n: q.n }; });
    out.push(band(rib, { wide: dd === 0 ? 0.12 : 0.09, high: 0.04, mat: 'zn', w }));
    out.push(...studsAlong(rib, 5, { from: 0.06, to: 0.94, r: 0.05, h: 0.05, k: 4, mat: 'znL', w }));
  }
  // -- the sighting slot under its top: a lit slit in a riveted frame, a shutter hinged over it
  { const a = PI, yS = top(a) - (top(a) - foot(a)) * 0.16, q = F.ta(t(yS), a), o = q.n, base = add(q.p, mul(o, offAt(a, yS) + 0.04 * NL + 0.02));
    const Fr = frameAt(base, o), sw = female ? 0.36 : 0.42, sh = 0.07;
    const P = (x, yy, z = 0) => add(base, add(mul(Fr.y, x), add(mul(Fr.x, yy), mul(o, z))));
    const slit = patch((u, v) => ({ p: P((v - 0.5) * 2 * sw, (u - 0.5) * 2 * sh, 0.02), n: o }), 1, 4);
    out.push(solid(slit, { sheet: true, w, mat: () => 'slot' }));
    const frame = [P(-sw - 0.05, -sh - 0.05, 0.03), P(sw + 0.05, -sh - 0.05, 0.03), P(sw + 0.05, sh + 0.05, 0.03), P(-sw - 0.05, sh + 0.05, 0.03)].map((p) => ({ p, n: o }));
    out.push(tube(frame, { r: 0.04, k: 4, mat: 'znL', w, closed: true }));
    for (const x of [-sw - 0.05, sw + 0.05]) for (const yy of [-sh - 0.05, sh + 0.05]) out.push(stud(P(x, yy, 0.04), o, { r: 0.04, h: 0.04, k: 4, mat: 'brass', w }));
    // (the shutter, propped open above the slit on its hinge)
    const sht = patch((u, v) => ({ p: P((v - 0.5) * 2 * (sw + 0.04), sh + 0.08 + u * 0.16, 0.05 + u * 0.12), n: unit(add(o, mul(Fr.x, -0.6))) }), 1, 4);
    out.push(solid(sht, { w, thick: 0.03, mat: () => 'znM', inner: 'znS', edge: 'znS' }));
    out.push(tube([P(-sw - 0.04, sh + 0.08, 0.05), P(sw + 0.04, sh + 0.08, 0.05)].map((p) => ({ p, n: o })), { r: 0.035, k: 4, mat: 'brass', w }));
  }
  // -- the scroll case: a zinc tube strapped across the lower lames, capped in brass, the plans rolled out of one end
  { const yC = yBot + (yTop - yBot) * 0.16, aL = PI - aw * 0.7, aR = PI + aw * 0.7;
    const at = (a, yy) => { const q = F.ta(t(yy), a); return { p: add(q.p, mul(q.n, offAt(a, yy) + 0.04 * NL + 0.18)), n: q.n }; };
    const m0 = at(aL, yC), m1 = at(aR, yC), dd = unit(sub(m1.p, m0.p)), R = female ? 0.13 : 0.15, ext = female ? 0.1 : 0.1;
    const c0 = { p: sub(m0.p, mul(dd, ext)), n: m0.n }, c1 = { p: add(m1.p, mul(dd, ext)), n: m1.n }, d = dd;
    const path = [...Array(9).keys()].map((k) => { const f = k / 8; return { p: lerp(c0.p, c1.p, f), n: unit(lerp(c0.n, c1.n, f)) }; });
    out.push(sweep(path, { closedProfile: true, profile: roundProfile(R, 8), mat: (k) => (k === 0 || k === 7 ? 'brass' : 'zn'), w }));
    for (const f of [0.02, 0.98]) { const p = lerp(c0.p, c1.p, f); out.push(tube([...Array(8).keys()].map((j) => { const a = (j / 8) * 2 * PI, Fr = frameAt(p, d, c0.n), v = add(mul(Fr.x, Math.cos(a) * (R + 0.02)), mul(Fr.y, Math.sin(a) * (R + 0.02))); return { p: add(p, v), n: unit(v) }; }), { r: 0.03, k: 4, mat: 'znL', w, closed: true })); }
    // (the plans: a roll of parchment out of the right end)
    const e = add(c1.p, mul(d, 0.02)), e1 = add(e, mul(d, 0.16));
    out.push(sweep([{ p: e, n: c1.n }, { p: e1, n: c1.n }], { closedProfile: true, profile: roundProfile(R * 0.8, 6), mat: 'parch', w }));
    out.push(stud(e1, d, { r: R * 0.55, h: 0.02, k: 6, mat: 'parchD', w }));
    // (two straps round it to the shell)
    for (const f of [0.3, 0.7]) { const p = lerp(c0.p, c1.p, f), Fr = frameAt(p, d, c0.n); out.push(band([...Array(9).keys()].map((j) => { const a = (j / 8) * 2 * PI, v = add(mul(Fr.x, Math.cos(a) * (R + 0.02)), mul(Fr.y, Math.sin(a) * (R + 0.02))); return { p: add(p, v), n: unit(v) }; }).slice(0, 8), { wide: 0.08, high: 0.02, mat: 'leatherD', w, closed: true })); }
  }
  // -- the sling: a strap from each top corner of the shell over the shoulder to the clasp on the breast
  const lameOff = 0.16 + 0.035 * 4 + 0.05;
  const cY = M.neckF - (female ? 0.28 : 0.32);
  const clasp = (() => { const q = F.ta(t(cY), female ? 0.16 : 0.08); return { p: add(q.p, mul(q.n, lameOff + 0.14)), n: q.n }; })();
  const wFront = nearSkinW(B, (q) => shareW(B, q.w, 'torso') > 0.8 && headW(B, q.w) < 0.1, (nn) => TORSO_BONES.has(nn) || nn.startsWith('clavicle'), 0.35);
  for (const sg of [1, -1]) {
    // (through these, as angle round the body, height and how far off the skin: from the clasp up the breast, over the
    // shoulder's top beside the neck, down the back to the shell's top)
    const cA = sg * (PI - aw * 0.38), cYb = top(cA) - 0.1;
    const C = [[sg * 0.14, cY, lameOff + 0.14], [sg * 0.48, n - 0.62, lameOff + 0.06], [sg * 0.9, n - 0.3, 0.3], [sg * PI / 2, n - 0.12, 0.3], [sg * (PI - 0.95), n - 0.3, 0.34], [cA, cYb, offAt(cA, cYb) + 0.2]];
    const cr = (p0, p1, p2, p3, f) => 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
    const pts = [];
    for (let s2 = 0; s2 < C.length - 1; s2++) for (let k = 0; k < 4; k++) {
      if (s2 > 0 && k === 0 && pts.length) { /* (each segment's first point is the last's end) */ }
      const f = k / 4, P0 = C[Math.max(0, s2 - 1)], P1 = C[s2], P2 = C[s2 + 1], P3 = C[Math.min(C.length - 1, s2 + 2)];
      const v = [0, 1, 2].map((q) => cr(P0[q], P1[q], P2[q], P3[q], f)), q = F.ta(t(v[1]), v[0]);
      pts.push({ p: add(q.p, mul(q.n, v[2])), n: q.n });
    }
    { const L = C[C.length - 1], q = F.ta(t(L[1]), L[0]); pts.push({ p: add(q.p, mul(q.n, L[2])), n: q.n }); }
    const sw = (p) => { const k = smooth(-0.5, -1.0, p[2]); return mixW([[wFront(p), 1 - k], [w(p), k]]); };
    out.push(band(pts, { wide: female ? 0.19 : 0.22, high: 0.04, mat: 'strap', w: sw }));
    out.push(...studsAlong(pts.slice(0, 8), 3, { from: 0.2, to: 0.9, r: 0.04, h: 0.035, k: 4, mat: 'znL', w: sw }));
    // (its buckle at the shoulder's front)
    { const q = pts[6], dd = sub(pts[7].p, pts[5].p); out.push(buckle(q.p, q.n, dd, { wd: 0.2, ht: 0.18, r: 0.025, mat: 'znL', w: () => sw(q.p) })); }
  }
  // -- the clasp: the sappers' badge, a pick and a shovel crossed in brass on a riveted zinc lozenge
  out.push(pickAndShovel(add(clasp.p, mul(clasp.n, female ? 0.16 : 0.1)), clasp.n, { R: female ? 0.34 : 0.4, mat: 'brass', plate: 'leatherD', back: 'leatherD', rim: 'znL', w: (p) => mixW([[wFront(p), 0.7], [wS, 0.3]]) }));
  return coverHides(B, merge(...out), 0.6);
}

/* ---- legs: the mine breeches ------------------------------------------------------------------------------------- */
/**
 * How far the breeches stand off the skin: full through the thigh and bloused over the knee's top, gathered in at the
 * knee and close down the calf; less on the thigh's inside, where the legs pass.
 */
function breechOff(B, p, n) {
  const A = B.at, hp = A.hip.l[1], kn = A.knee.l[1];
  const full = smooth(hp + 0.1, hp - 0.9, p[1]) * smooth(kn - 0.15, kn + 0.35, p[1]) * (1 + 0.35 * Math.exp(-(((p[1] - kn - 0.45) / 0.3) ** 2)));
  const out = n ? clamp(0.45 + 0.55 * (n[0] * Math.sign(p[0] || 1) + 0.35)) : 1;
  return 0.035 + (B.who === 'female' ? 0.1 : 0.13) * full * out;
}
/** The breeches: heavy canvas over the hips and the legs to the ankles, close over the skin, the skin under it left out; its waist (`canvasW`) left out under any chest piece. */
function breeches(B) {
  const A = B.at, M = torsoMarks(B);
  return shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'thigh', 'calf', 'torso', 'foot') > 0.6 && (on(B, i, 'thigh', 'calf', 'torso') > 0.6 || p[1] > A.ankle[s][1] + 0.05) && (on(B, i, 'foot') < 0.5 || p[1] > A.ankle[s][1] + 0.05) && on(B, i, 'upperarm', 'forearm', 'hand', 'shoulder') < 0.05 && p[1] < M.waist + 0.25 && p[1] > A.ankle[s][1] - 0.05; },
    off: ({ p, n }) => breechOff(B, p, n),
    mat: ({ p }) => (p[1] > M.hip + 0.05 ? 'canvasW' : 'canvas'),
  });
}
/**
 * One leg: a leather seat-and-inseam patch over the canvas, a flapped pocket on the thigh's outside, a domed zinc knee
 * pad strapped round the knee (a slit in it lit when enchanted), a strapped half-greave down the shin.
 */
function legOf(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, hp = A.hip[s], kn = A.knee[s], an = A.ankle[s], out = [], female = B.who === 'female';
  const legBones = (n) => n.endsWith(`_${s}`);
  const thPick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'thigh') > 0.6;
  const TH = limbWrap(B, hp, kn, sg, { t: [0, 1.05], nt: 21, a: [-PI, PI], closed: true, na: 28, pick: thPick, smooth: 4, shape: (r) => r });
  const wTh = skinW(B, (q) => thPick(q) && along(q.p, hp, kn) > 0.3 && along(q.p, hp, kn) < 0.85, legBones);
  // -- the pocket: a leather box on the thigh's outside, its flap buckled
  const pk = plateOn(TH, { a0: PI / 2 - 0.7, a1: PI / 2 + 0.6, t0: () => 0.74, t1: () => 0.4, nu: 3, nv: 5, off: (u, v) => 0.17 + 0.08 * Math.sin(PI * Math.min(1, u * 1.15)) ** 0.4 * Math.sin(PI * v) ** 0.4 });
  out.push(solid(pk, { w: () => wTh, thick: 0.025, mat: () => 'leatherD', inner: 'leatherD', edge: 'leatherD' }));
  const fl = plateOn(TH, { a0: PI / 2 - 0.75, a1: PI / 2 + 0.65, t0: () => 0.53, t1: () => 0.39, nu: 2, nv: 5, off: () => 0.27 });
  out.push(solid(fl, { sheet: true, w: () => wTh, mat: () => 'leather' }));
  out.push(tube(rowPath(fl, 0, 0, 5, 5), { r: 0.025, k: 4, mat: 'leatherL', w: () => wTh }));
  { const q = fl.at(0.3, 2.5); out.push(buckle(add(q.p, mul(q.n, 0.01)), q.n, sub(kn, hp), { wd: 0.12, ht: 0.12, r: 0.02, mat: 'znL', w: () => wTh })); }
  // -- the knee pad: a dome over the knee, its rim rolled, riveted round, a slit across it; two straps round the knee
  const kPick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'thigh', 'calf') > 0.8 && len(sub(q.p, kn)) < 0.9;
  const k0 = lerp(hp, kn, 0.8), k1 = lerp(kn, an, 0.17);
  const KN = limbWrap(B, k0, k1, sg, { t: [0, 1], nt: 10, a: [-PI, PI], closed: true, na: 28, pick: kPick, smooth: 4, shape: (r) => r });
  const wKn = boneW(B, `knee_${s}`);
  // (an oval, deepest over the kneecap)
  const ov = (a) => Math.sqrt(Math.max(0, 1 - (a / 1.42) ** 2));
  const pad = plateOn(KN, { a0: -1.4, a1: 1.4, t0: (a) => 0.5 - 0.5 * ov(a) ** 0.6, t1: (a) => 0.5 + 0.5 * ov(a) ** 0.6, nu: 8, nv: 14, off: (u, v) => 0.18 + 0.22 * Math.sin(PI * u) ** 0.7 * Math.sin(PI * v) ** 0.7 });
  out.push(solid(pad, { sheet: true, w: () => wKn, mat: spangleOf(pad, 'zn', 0.3) }));
  const rim = [...rowPath(pad, 0, 0, 14, 14), ...rowPath(pad, 8, 14, 0, 14).slice(1, -1)];
  out.push(tube(rim, { r: 0.045, k: 4, mat: 'znL', w: () => wKn, closed: true }));
  out.push(...studsAlong(rowPath(pad, 1, 2, 12, 12), 3, { r: 0.05, h: 0.045, k: 4, mat: 'znL', w: () => wKn }));
  out.push(...studsAlong(rowPath(pad, 7, 2, 12, 12), 3, { r: 0.05, h: 0.045, k: 4, mat: 'znL', w: () => wKn }));
  // (the slit: a dark slot across the dome's crown in a raised frame, lit when enchanted)
  { const sl = patch((u, v) => { const q = pad.at(3.6 + 0.8 * u, 4 + 6 * v); return { p: add(q.p, mul(q.n, 0.025)), n: q.n }; }, 1, 6);
    out.push(solid(sl, { sheet: true, w: () => wKn, mat: () => 'slot' }));
    const fr = [...Array(7).keys()].map((j) => pad.at(3.3, 3.7 + j)).concat([...Array(7).keys()].map((j) => pad.at(4.7, 10.3 - j))).map((q) => ({ p: add(q.p, mul(q.n, 0.02)), n: q.n }));
    out.push(tube(fr, { r: 0.03, k: 4, mat: 'znM', w: () => wKn, closed: true })); }
  // (its straps: round the leg above and below the knee, buckled on the outside)
  for (const [tt, wq] of [[0.5, wKn]]) {
    const ring = [...Array(20).keys()].map((j) => { const a = -PI + (2 * PI * j) / 20, q = KN.ta(tt, a); return { p: add(q.p, mul(q.n, Math.abs(a) < 1.45 ? 0.19 + 0.22 * ov(a) ** 0.7 : 0.08)), n: q.n }; });
    out.push(band(ring, { wide: 0.12, high: 0.03, mat: 'leatherD', w: () => wq, closed: true }));
    const q = KN.ta(tt, PI / 2 + 0.2); out.push(buckle(add(q.p, mul(q.n, 0.1)), q.n, sub(an, kn), { wd: 0.12, ht: 0.14, r: 0.02, mat: 'znL', w: () => wq }));
  }
  // -- the half-greave: a zinc plate down the shin's front from under the pad, a ridge down it, two straps round the calf
  const cPick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'calf') > 0.6;
  const SH = limbWrap(B, kn, an, sg, { t: [0, 1.02], nt: 20, a: [-PI, PI], closed: true, na: 26, pick: cPick, smooth: 4, shape: (r) => r });
  const wCa = skinW(B, (q) => cPick(q) && along(q.p, kn, an) > 0.2 && along(q.p, kn, an) < 0.8, legBones);
  const ridge = (a) => 0.06 * Math.exp(-((a / 0.25) ** 2));
  const gr = plateOn(SH, { a0: -1.45, a1: 1.45, t0: () => 0.6, t1: () => 0.27, nu: 6, nv: 12, off: (u, v, t, a) => 0.13 + ridge(a) + 0.05 * smooth(0.45, 0.58, t) + 0.05 * smooth(0.36, 0.27, t) });
  out.push(solid(gr, { w: () => wCa, thick: 0.035, mat: spangleOf(gr, 'zn', 0.3), inner: 'znD', edge: 'znS' }));
  out.push(tube(rowPath(gr, 0, 0, 12, 12), { r: 0.04, k: 4, mat: 'znL', w: () => wCa }));
  out.push(tube(rowPath(gr, 6, 0, 12, 12), { r: 0.055, k: 4, mat: 'znL', w: () => wCa }));
  out.push(band(colPath(gr, 6, 0.3, 5.7, 6), { wide: 0.05, high: 0.03, mat: 'znM', w: () => wCa }));
  for (const tt of [0.44]) {
    const ring = [...Array(20).keys()].map((j) => { const a = -PI + (2 * PI * j) / 20, q = SH.ta(tt, a); return { p: add(q.p, mul(q.n, Math.abs(a) < 1.45 ? 0.17 + ridge(a) : 0.07)), n: q.n }; });
    out.push(band(ring, { wide: 0.08, high: 0.025, mat: 'leatherD', w: () => wCa, closed: true }));
    const q = SH.ta(tt, PI / 2 + 0.5); out.push(buckle(add(q.p, mul(q.n, 0.08)), q.n, sub(an, kn), { wd: 0.1, ht: 0.12, r: 0.018, mat: 'znL', w: () => wCa }));
  }
  // (the breeches reinforced in leather over the thigh's front, where the sapper kneels and crawls, its edge stitched)
  const rf = plateOn(TH, { a0: -1.15, a1: 0.95, t0: (a) => 0.84 - 0.05 * Math.cos(a * 2), t1: () => 0.47, nu: 5, nv: 8, off: (u, v, tt) => 0.02 + breechOff(B, TH.ta(tt, 0).p, null) });
  out.push(solid(rf, { sheet: true, w: () => wTh, mat: () => 'leatherD' }));
  out.push(tube([...colPath(rf, 0, 5, 0, 5), ...rowPath(rf, 0, 0, 8, 8).slice(1), ...colPath(rf, 8, 0, 5, 5).slice(1)], { r: 0.022, k: 3, mat: 'leatherL', w: () => wTh }));
  // (the breeches' outer seam piped in leather down the thigh and the calf)
  out.push(tube(colPath(TH, 21, 3, 15, 10).map((q) => ({ p: add(q.p, mul(q.n, breechOff(B, q.p, null) + 0.01)), n: q.n })), { r: 0.025, k: 3, mat: 'leatherD', w: () => wTh }));
  // (the canvas gathered over the knee's top: folds sagging round the leg where it is bloused)
  for (const [tt, amp] of [[0.66, 0.05], [0.75, 0.05], [0.84, 0.04], [0.92, 0.03]]) {
    const ring = [...Array(13).keys()].map((j) => { const a = -PI + (2 * PI * j) / 12, q = TH.ta(tt + amp * Math.sin(a * 3 + tt * 9), a); return { p: add(q.p, mul(q.n, breechOff(B, q.p, null) * (0.6 + 0.4 * Math.max(0, Math.cos(a - sg * 0.4))) + 0.005)), n: q.n }; });
    out.push(tubeAll(ring.slice(0, 12), { r: 0.04, k: 3, mat: 'canvasD', w: () => wTh, closed: true }));
  }
  void female;
  return out;
}
/** The seat: a leather patch over each buttock, from the waistband to the crease, each moving with its own side. */
function seat(B) {
  const A = B.at, M = torsoMarks(B), F = torsoField(B), t = F.tOfY, out = [];
  for (const sg of [1, -1]) {
    const side = (n) => !/_(l|r)$/.test(n) || n.endsWith(sg > 0 ? '_l' : '_r');
    const W = nearSkinW(B, (q) => shareW(B, q.w, 'torso', 'thigh') > 0.8 && q.p[1] < M.waist + 0.2 && q.p[0] * sg > 0.05, side, 0.3);
    const a0 = PI - sg * 0.2, a1 = PI - sg * 0.95;
    const bot = (a) => M.hip - 0.15 - 0.25 * Math.sin(PI * clamp((a - a0) / (a1 - a0))) ** 0.6;
    const g = plateOn(F, { a0: Math.min(a0, a1), a1: Math.max(a0, a1), t0: (a) => t(bot(a)), t1: () => t(M.waist - 0.26), nu: 6, nv: 8, off: () => 0.06 });
    out.push(smoothWeights(solid(g, { sheet: true, w: W, mat: () => 'leather' }), 2), tube([...colPath(g, 0, 6, 0, 6), ...rowPath(g, 0, 0, 8, 8).slice(1), ...colPath(g, 8, 0, 6, 6).slice(1)], { r: 0.025, k: 3, mat: 'leatherL', w: W }));
  }
  return out;
}
export function zincLegs(B) {
  return { P: merge(smoothWeights(breeches(B), 3, (p) => p[1] > B.at.knee.l[1] + 0.6), ...seat(B), ...legOf(B, 'l'), ...legOf(B, 'r')), dropAt: (f) => f.mat === 'canvasW' };
}

/* ---- boots: hobnailed mine boots ---------------------------------------------------------------------------------- */
/** The boot's leather over the foot and the ankle, close over the skin, on a thick sole; stood on. */
function bootShoe(B) {
  const A = B.at;
  const P = shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'foot', 'calf') > 0.6 && p[1] < A.ankle[s][1] + 0.4; },
    off: ({ n }) => 0.045 + (n[1] < -0.6 ? 0.14 : 0),
    mat: ({ n }) => (n[1] < -0.55 ? 'sole' : 'leather'),
  });
  P.soles = P.V.map((_, i) => i).filter((i) => P.V[i][1] < A.floor + 0.14);
  return P;
}
/**
 * One boot: the shaft up the calf to a turned-down cuff (a coil of slow match tucked in it, its end lit when enchanted),
 * a zinc toe cap riveted on, a zinc heel plate, a spade tread across the instep's foot for driving a spade, hobnails
 * round the sole's edge, two buckled straps over the instep and the ankle.
 */
function bootOf(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, kn = A.knee[s], an = A.ankle[s], ball = A.ball[s], out = [], female = B.who === 'female';
  const legBones = (n) => n.endsWith(`_${s}`);
  // -- the shaft: closed round the lower calf from the ankle to under the greave's foot, its top turned down in a cuff
  const cPick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'calf', 'foot') > 0.6;
  const SH = limbWrap(B, kn, an, sg, { t: [0.5, 1.1], nt: 12, a: [-PI, PI], closed: true, na: 22, pick: cPick, smooth: 4, shape: (r) => r });
  const wCa = skinW(B, (q) => cPick(q) && along(q.p, kn, an) > 0.55 && along(q.p, kn, an) < 0.95, legBones);
  const wAn = mixOf(B, [[`foot_${s}`, 0.5], [`calf_${s}`, 0.5]]);
  const wSh = (p) => { const f = clamp((along(p, kn, an) - 0.75) / 0.3); return mixW([[wCa, 1 - f], [wAn, f]]); };
  const shaft = plateOn(SH, { a0: -PI, a1: PI, closed: true, t0: () => 1.06, t1: () => 0.68, nu: 6, nv: 22, off: (u) => 0.085 + 0.02 * u });
  out.push(solid(shaft, { sheet: true, w: wSh, mat: () => 'leather' }));
  const cuff = plateOn(SH, { a0: -PI, a1: PI, closed: true, t0: () => 0.76, t1: () => 0.66, nu: 2, nv: 22, off: (u) => 0.13 + 0.06 * (1 - u) });
  out.push(solid(cuff, { w: wSh, thick: 0.03, mat: () => 'leatherL', inner: 'leatherD', edge: 'leatherD' }));
  out.push(tube(rowPath(cuff, 0, 0, 22, 22), { r: 0.03, k: 4, mat: 'leatherD', w: wSh, closed: true }));
  // (the slow match tucked in the cuff on the outside, its end lit)
  { const q = SH.ta(0.72, PI / 2 + 0.3), o = q.n, base = add(q.p, mul(o, 0.2)), d = unit(sub(an, kn));
    out.push(coil(add(base, mul(d, -0.12)), add(base, mul(d, 0.12)), { R: 0.08, r: 0.03, turns: 2.5, mat: 'match', w: () => wCa, up: o }));
    const e0 = add(base, mul(d, -0.12)), e1 = add(add(e0, mul(d, -0.14)), mul(o, 0.06));
    out.push(sweep([{ p: e0, n: o }, { p: e1, n: o }], { closedProfile: true, profile: roundProfile(0.03, 4), mat: 'match', w: () => wCa }));
    out.push(stud(e1, unit(sub(e1, e0)), { r: 0.05, h: 0.06, k: 5, mat: 'ember', w: () => wCa })); }
  // -- the straps: over the instep and round the ankle, buckled on the outside
  for (const tt of [0.86]) {
    const ring = [...Array(20).keys()].map((j) => { const a = -PI + (2 * PI * j) / 20, q = SH.ta(tt, a); return { p: add(q.p, mul(q.n, 0.13)), n: q.n }; });
    out.push(band(ring, { wide: 0.1, high: 0.03, mat: 'leatherD', w: wSh, closed: true }));
    const q = SH.ta(tt, PI / 2); out.push(buckle(add(q.p, mul(q.n, 0.15)), q.n, sub(kn, an), { wd: 0.12, ht: 0.14, r: 0.02, mat: 'znL', w: () => wSh(q.p) }));
  }
  // -- the foot: a wrap from the ankle's front to past the toes
  const fPick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'foot') > 0.6;
  const toes = skinSamples(B).filter(fPick);
  const tip = toes.reduce((b, q) => (q.p[2] > b[2] ? q.p : b), [0, 0, -9]);
  const from = [an[0], an[1] - 0.05, an[2] + 0.05], to = [tip[0], A.floor + 0.2, tip[2] + 0.03];
  const tBall = along(ball, from, to);
  const FT = limbWrap(B, from, to, sg, { front: [0, 1, 0], t: [0, 1.0], nt: 20, a: [-PI, PI], closed: true, na: 24, pick: fPick, smooth: 4, shape: (r, t) => r * (t > 0.93 ? Math.max(0.6, 1 - (t - 0.93) * 5) : 1) });
  const wFoot = boneW(B, `foot_${s}`), wBall = boneW(B, `ball_${s}`);
  // (the instep strap)
  { const ring = [...Array(14).keys()].map((j) => { const a = -1.9 + (3.8 * j) / 13, q = FT.ta(tBall * 0.62, a); return { p: add(q.p, mul(q.n, 0.1)), n: q.n }; });
    out.push(band(ring, { wide: 0.1, high: 0.03, mat: 'leatherD', w: () => wFoot }));
    const q = FT.ta(tBall * 0.62, sg * 1.2); out.push(buckle(add(q.p, mul(q.n, 0.12)), q.n, sub(to, from), { wd: 0.1, ht: 0.12, r: 0.018, mat: 'znL', w: () => wFoot })); }
  // -- the toe cap: zinc over the toes from the ball forward, its rim rolled, riveted
  const cap = plateOn(FT, { a0: -1.25, a1: 1.25, t0: () => tBall - 0.04, t1: () => 0.97, nu: 5, nv: 10, off: (u) => 0.065 + 0.01 * u });
  out.push(solid(cap, { sheet: true, w: () => wBall, mat: spangleOf(cap, 'znM', 0.25) }));
  out.push(tubeAll([...colPath(cap, 0, 5, 0, 5), ...rowPath(cap, 0, 0, 10, 10).slice(1), ...colPath(cap, 10, 0, 5, 5).slice(1)], { r: 0.035, k: 4, mat: 'znL', w: () => wBall }));
  out.push(...studsAlong(rowPath(cap, 0.7, 1, 9, 10), 3, { r: 0.04, h: 0.035, k: 4, mat: 'znL', w: () => wBall }));
  // -- the heel plate: zinc round the heel's back
  { const hc = plateOn(SH, { a0: PI - 1.1, a1: PI + 1.1, t0: () => 1.1, t1: () => 1.02, nu: 2, nv: 8, off: () => 0.13 });
    out.push(solid(hc, { w: () => wAn, thick: 0.03, mat: spangleOf(hc, 'zn', 0.25), inner: 'znD', edge: 'znS' }));
    out.push(tube(rowPath(hc, 2, 0, 8, 8), { r: 0.035, k: 4, mat: 'znL', w: () => wAn })); }
  // -- the spade tread: a zinc bar across under the instep, out past the sole each side
  { const q = FT.ta(tBall * 0.75, PI), y0 = A.floor + 0.06, c = [q.p[0], y0, q.p[2]], x = [1, 0, 0], L = female ? 0.36 : 0.42;
    out.push(sweep([{ p: add(c, mul(x, -L)), n: [0, 1, 0] }, { p: add(c, mul(x, L)), n: [0, 1, 0] }], { closedProfile: true, profile: [[-0.09, -0.04], [0.09, -0.04], [0.09, 0.04], [-0.09, 0.04]], mat: 'znM', w: () => wFoot }));
    for (const e of [-L, L]) out.push(stud(add(c, mul(x, e)), mul(x, Math.sign(e)), { r: 0.06, h: 0.03, k: 4, mat: 'znL', w: () => wFoot })); }
  // -- hobnails round the sole's edge
  for (const side of [1, -1]) {
    const path = [...Array(9).keys()].map((k) => { const t = 0.08 + 0.85 * (k / 8), q = FT.ta(t, side * (PI / 2 + 0.55)); return { p: [q.p[0], A.floor + 0.07, q.p[2]], n: unit([q.n[0], 0, q.n[2]]) }; });
    out.push(...studsAlong(path.map((q) => ({ p: add(q.p, mul(q.n, 0.15)), n: q.n })), 6, { r: 0.045, h: 0.04, k: 4, mat: 'znL', w: () => wFoot }));
  }
  void female;
  return out;
}
export function zincBoots(B) {
  return merge(bootShoe(B), ...bootOf(B, 'l'), ...bootOf(B, 'r'));
}
