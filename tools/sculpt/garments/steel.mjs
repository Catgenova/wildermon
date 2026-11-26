// The steel set: the Milanese harness (Italy, the fifteenth century), built with the plate kit
// (tools/sculpt/garments/platekit.mjs): hard parts of its own on the body's bones over a soft arming layer, its trims
// (rolled edges, rivets, gilt lines) laid on as geometry of their own.
//
//   helm    the armet: a rounded skull with a low comb, a visor with its prow, its sight and breaths, cheek plates
//           closed under the chin, the rondel on its stalk behind, a plume of three feathers.
//   chest   the arming doublet (mail where it shows, crimson below) under a globose breastplate and its pointed placard,
//           the backplate, faulds and two tassets; pauldrons (the left the larger) with blued haute-pieces standing by
//           the neck, rerebraces, couters with their fans (the left's the larger), vambraces and gauntlet cuffs.
//   mantle  the half-mantle: blue velvet lined in crimson over the right shoulder and down the back in folds, its hem
//           bound in brass, a band over the left pauldron to a great brooch; a heraldic star on the back and on the
//           shoulder; under it the gorget's collar and lames and the mail pixane behind.
//   legs    the arming hose under cuisses, winged poleyns and closed greaves.
//   boots   sabatons of lames to a blunt point over a leather shoe.
//
// Enchanted, four things light and nothing else: the armet's sight, the placard's ogee line, the mantle's stars and
// the brooch's gem, and the gilt line down each shin to the toe's point.
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, smooth, merge, shell, on, waistOf, nearestOf } from './metalkit.mjs';
import {
  skinSamples, shareW, boneW, mixOf, mixW, keepBones, nearSkinW, skinW, wrapAngle, torsoWrap, torsoMiddle, limbWrap, plateOn, patch, solid,
  tube, band, rowPath, colPath, resample, stud, studsAlong, gridOf, domeWrap, along, ellipsoidReach, sweep, smoothWeights, coverHides, roundProfile,
} from './platekit.mjs';
import {
  browTheta, cloak, disc, feet, fromFront, helm, hips, shins, legAt,
} from './metalkit.mjs';

const PI = Math.PI;
const y = (p) => p[1];
const frac = (x) => x - Math.floor(x);

export const STEEL_MATS = {
  // (the plate a cool blued grey, its rolled edges polished bright, its lames a shade darker so their stacking reads)
  st: { c: '#56606d', kind: 3 },
  stM: { c: '#414955', kind: 3 },
  stL: { c: '#d3d9e0', kind: 3 },
  stS: { c: '#2c3239', kind: 3 },
  stD: { c: '#1a1e23', kind: 3 },
  brass: { c: '#c29a43', kind: 3 },
  // (the etching: gilt lines and bosses on the steel, lit in the enchantment's colour)
  rune: { c: '#a7843c', kind: 3, lit: { c: '#ffe7a6', kind: 1 } },
  // (the same gilt where it does not glow: the set's lesser trim)
  gilt: { c: '#a7843c', kind: 3 },
  // (the armet's sight: dark, lit when enchanted)
  sight: { c: '#07080b', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  mail: { c: '#5d646c', kind: 3 },
  blued: { c: '#2d3b5c', kind: 3 },
  mailD: { c: '#3b4046', kind: 3 },
  velvet: { c: '#2a3f7a', kind: 0 },
  lining: { c: '#8e2128', kind: 0 },
  enamel: { c: '#a01c2c', kind: 3 },
  plume: { c: '#e9e4d6', kind: 2 },
  velvetD: { c: '#1b2a55', kind: 0 },
  arming: { c: '#7a2420', kind: 2 },
  armingD: { c: '#521714', kind: 2 },
  armingW: { c: '#7a2421', kind: 2 },
  leather: { c: '#4a3021', kind: 2 },
  sole: { c: '#2a1e17', kind: 2 },
};

/* ---- the body's measures the set is laid out by ------------------------------------------------------------------ */
const TORSO_BONES = new Set(['root', 'pelvis', 'spine_01', 'spine_02', 'spine_03']);
/** The landmarks' heights the torso pieces are cut to. */
function torsoMarks(B) {
  const A = B.at, sh = A.shoulder.l[1];
  return {
    neckF: lerp(A.neck, A.chest, 0.47)[1], neckB: lerp(A.neck, A.chest, 0.36)[1],
    pit: sh - 0.92, waist: waistOf(A), hip: A.hip.l[1],
    fauld: A.hip.l[1] - 0.05, tasset: lerp(A.hip.l, A.knee.l, 0.4)[1],
  };
}
/** The torso's skin as a field round its middle line, from below the hips to the neck: the shape every torso plate is laid on. */
const FIELDS = new WeakMap();
function torsoField(B) {
  if (FIELDS.has(B)) return FIELDS.get(B);
  const A = B.at;
  const pick = (s) => shareW(B, s.w, 'torso', 'thigh', 'neck', 'head') > 0.8 && headW(B, s.w) < 0.15 && shareW(B, s.w, 'upperarm', 'shoulder', 'forearm', 'hand') < 0.05 && s.p[1] > lerp(A.hip.l, A.knee.l, 0.55)[1];
  const zc = torsoMiddle(B, (s) => shareW(B, s.w, 'torso', 'neck', 'head') > 0.8 && headW(B, s.w) < 0.15);
  const y0 = lerp(A.hip.l, A.knee.l, 0.5)[1], y1 = A.neck[1] + 0.5;
  const G = torsoWrap(B, y0, y1, zc, { pick, nt: 100, na: 64, closed: true, a: [-PI, PI], smooth: 5, shape: (r) => r });
  G.tOfY = (yy) => (yy - y0) / (y1 - y0);
  G.yOfT = (tt) => y0 + (y1 - y0) * tt;
  FIELDS.set(B, G);
  return G;
}
/** How much of weights `w` are on the head and the jaw themselves. */
/** A thigh plate's weights (the cuisse's, and the tassets' feet, so the two move as one): the thigh's skin's, averaged. */
const thighW = (B, s) => { const hp = B.at.hip[s], kn = B.at.knee[s], sg = s === 'l' ? 1 : -1; return skinW(B, (q) => q.p[0] * sg > 0.12 && shareW(B, q.w, 'thigh') > 0.6 && along(q.p, hp, kn) > 0.25 && along(q.p, hp, kn) < 0.8, (n) => n.endsWith(`_${s}`)); };
const headW = (B, w) => w.reduce((t, [b, x]) => t + (B.bones[b].name === 'head' || B.bones[b].name === 'jaw' ? x : 0), 0);

/* ---- chest & arms ------------------------------------------------------------------------------------------------ */
/** How much of a body point's weight is on the head and the jaw themselves (not the neck's top, which metalkit counts with the head). */
const headOnly = (B, i) => B.W[i].reduce((t, [b, x]) => t + (B.bones[b].name === 'head' || B.bones[b].name === 'jaw' ? x : 0), 0);
/** The arming doublet: the torso and the arms to the wrists, close over the skin, the skin under it left out. */
function doublet(B) {
  const A = B.at, M = torsoMarks(B);
  return shell(B, {
    sub: 0, rim: null,
    keep: (i) => { const p = B.V[i]; return on(B, i, 'torso', 'shoulder', 'upperarm', 'forearm', 'neck', 'head', 'thigh') > 0.6 && headOnly(B, i) < 0.05 && on(B, i, 'hand') < 0.35 && y(p) > M.hip - 0.25 && on(B, i, 'thigh') < 0.5 && y(p) < A.neck[1] - 0.02; },
    off: ({ p }) => 0.065 + 0.03 * smooth(M.waist, M.hip, y(p)) - 0.03 * smooth(A.neck[1] - 0.6, A.neck[1] - 0.1, y(p)),
    // (mail where it shows between the plates: the shoulders, the armpits and the arms; the arming cloth below)
    mat: ({ p, bv }) => (shareW(B, B.W[bv], 'shoulder', 'upperarm', 'forearm') > 0.35 || y(p) > M.pit - 0.2 ? 'mail' : 'arming'),
  });
}

function torsoPlates(B) {
  const A = B.at, M = torsoMarks(B), F = torsoField(B), t = F.tOfY;
  const W = nearSkinW(B, (s) => shareW(B, s.w, 'torso') > 0.7, (n) => TORSO_BONES.has(n), 0.35);
  // the breastplate: from the waist up to a high neckline, its armholes cut round to the armpit
  const aN = 0.78, side = PI / 2 + 0.04;
  const topF = (a) => {
    const ax = Math.abs(a), yC = M.neckF + 0.16;
    if (ax <= aN) return M.neckF + 0.16 * (ax / aN) ** 2;
    const k = clamp((ax - aN) / (side - aN));
    return M.pit + (yC - M.pit) * Math.sqrt(Math.max(0, 1 - k * k));
  };
  const bN = 0.62;
  const topB = (a) => {
    const bx = PI - Math.abs(wrapAngle(a)), yC = M.neckB + 0.1;
    if (bx <= bN) return M.neckB + 0.1 * (bx / bN) ** 2;
    const k = clamp((bx - bN) / (PI - side + 0.04 - bN));
    return M.pit + (yC - M.pit) * Math.sqrt(Math.max(0, 1 - k * k));
  };
  const bulge = (yy, a) => 0.1 * Math.exp(-(((yy - lerp(A.chest, [0, M.waist, 0], 0.4)[1]) / 0.9) ** 2)) * Math.max(0, Math.cos(a)) ** 1.5;
  const keel = (a) => 0.05 * Math.exp(-((a / 0.22) ** 2));
  const offF = (u, v, tt, a) => 0.15 + bulge(F.yOfT(tt), a) + keel(a) + 0.035 * smooth(0.12, 0, u);
  const breast = plateOn(F, { a0: -side, a1: side, t0: () => t(M.waist), t1: (a) => t(topF(a)), nu: 12, nv: 22, off: offF });
  const back = plateOn(F, { a0: side - 0.08, a1: 2 * PI - side + 0.08, t0: () => t(M.waist), t1: (a) => t(topB(a)), nu: 12, nv: 20, off: (u) => 0.13 + 0.035 * smooth(0.12, 0, u) });
  // the placard over the breastplate's lower half: its top rising to a point at the middle, as an ogee
  const cusp = (a) => { const ax = Math.abs(a); return lerp(A.chest, [0, M.waist, 0], 0.18)[1] - 0.95 * smooth(0, 1.15, ax) ** 0.8; };
  const plw = 1.25;
  const placard = plateOn(F, { a0: -plw, a1: plw, t0: () => t(M.waist), t1: (a) => t(cusp(a)), nu: 8, nv: 20, off: (u, v, tt, a) => 0.2 + bulge(F.yOfT(tt), a) + keel(a) + 0.035 * smooth(0.12, 0, u) });
  const pw = (p) => W(p);
  const parts = [
    solid(breast, { sheet: true, w: pw, thick: 0.05, mat: () => 'st', inner: 'stD', edge: 'stS' }),
    solid(back, { sheet: true, w: pw, thick: 0.05, mat: () => 'st', inner: 'stD', edge: 'stS' }),
    solid(placard, { sheet: true, w: pw, thick: 0.05, mat: () => 'st', inner: 'stD', edge: 'stS' }),
  ];
  // rolled edges round the neck and the armholes; the placard's top rolled too, and an etched line inside it
  const rows = (G) => G.P.length - 1;
  parts.push(tube(rowPath(breast, rows(breast), 0, 22, 22, 0.0), { r: 0.055, mat: 'stL', w: pw }));
  parts.push(tube(rowPath(back, rows(back), 0, 20, 20, 0.0), { r: 0.05, mat: 'stL', w: pw }));
  parts.push(tube(rowPath(placard, rows(placard), 0, 20, 20, 0.0), { r: 0.045, mat: 'stL', w: pw }));
  // (gilt borders inside the rolled necklines)
  parts.push(band(rowPath(breast, rows(breast) - 0.7, 0, 22, 22), { wide: 0.07, high: 0.015, mat: 'gilt', w: pw }));
  parts.push(band(rowPath(back, rows(back) - 0.7, 0, 20, 20), { wide: 0.07, high: 0.015, mat: 'gilt', w: pw }));
  parts.push(band(rowPath(placard, rows(placard) - 1.1, 1, 19, 30, 0.0), { wide: 0.09, high: 0.025, mat: 'rune', w: pw }));
  // brass rivets along the breastplate's waist
  parts.push(...studsAlong(rowPath(breast, 0.9, 1, 21, 30), 7, { r: 0.055, h: 0.045, mat: 'brass', w: pw }));
  // the faulds: three hoops below the waist, each flared and lapped over the one below; shorter behind, clear of the seat
  const behind = (a) => smooth(1.6, 2.7, Math.abs(wrapAngle(a)));
  const fBot = (a) => lerp([0, M.fauld, 0], [0, M.waist - 0.42, 0], behind(a))[1];
  const hoop = (a) => (M.waist + 0.1 - fBot(a)) / 3;
  for (let k = 0; k < 3; k++) {
    const top = (a) => M.waist + 0.1 - hoop(a) * k, bot = (a) => top(a) - hoop(a) - 0.07;
    const g = plateOn(F, { a0: -PI, a1: PI, closed: true, t0: (a) => t(bot(a)), t1: (a) => t(top(a)), nu: 3, nv: 24, off: (u) => 0.13 + 0.06 * k + 0.1 * (1 - u) });
    parts.push(solid(g, { hollow: true, w: pw, thick: 0.04, mat: () => 'stM', edge: 'stS' }));
    if (k === 2) parts.push(tube(rowPath(g, 0, 0, 24, 24), { r: 0.035, mat: 'stL', w: pw, closed: true }));
    if (k === 2) parts.push(...studsAlong(rowPath(g, 1.6, 0, 24, 48), 10, { from: 0, to: 0.9, r: 0.05, h: 0.04, mat: 'brass', w: pw }));
  }
  // the tassets: a plate of three lames over each thigh's front, hung from the last hoop, swinging with the thigh
  for (const sg of [1, -1]) {
    const s = sg > 0 ? 'l' : 'r', hp = A.hip[s], kn = A.knee[s];
    const pick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'thigh', 'torso') > 0.9 && q.p[1] < hp[1] + 0.6;
    const TH = limbWrap(B, hp, kn, sg, { t: [-0.15, 0.6], nt: 15, a: [-PI, PI], closed: true, na: 28, pick, smooth: 4, shape: (r) => r });
    const tTop = along([hp[0], M.fauld + 0.1, hp[2]], hp, kn), tBot = along([hp[0], M.tasset, hp[2]], hp, kn), h = (tBot - tTop) / 3;
    for (let k = 0; k < 3; k++) {
      const t0 = tTop + h * k, t1 = t0 + h + 0.04;
      const wT = thighW(B, s), wP = boneW(B, 'pelvis');
      const w = (p) => { const f = clamp((along(p, hp, kn) - tTop) / (tBot - tTop)); return mixW([[wP, 0.55 - 0.55 * f], [wT, 0.45 + 0.55 * f]]); };
      const g = plateOn(TH, { a0: -0.35, a1: 1.3, t0: () => t0, t1: () => t1, nu: 3, nv: 12, off: (u, v) => 0.38 + 0.05 * k + 0.08 * u + 0.05 * Math.sin(PI * v) });
      parts.push(solid(g, { hollow: true, w, thick: 0.04, mat: () => 'stM', edge: 'stS' }));
      if (k === 2) parts.push(tube(rowPath(g, 3, 0, 12, 12), { r: 0.035, mat: 'stL', w }));
      if (k === 2) parts.push(band(rowPath(g, 2.1, 0.6, 11.4, 8), { wide: 0.08, high: 0.02, mat: 'gilt', w }));
    }
  }
  return { parts, F, M, W };
}

/** The arm's skin samples on side `s` ('l' or 'r'): of the parts given, more than `k` of their weight. */
const armPick = (B, s, parts, k = 0.6) => (q) => (s === 'l' ? q.p[0] > 0.15 : q.p[0] < -0.15) && shareW(B, q.w, ...parts) > k;
/** Weights kept to the bones of one side's arm (and the clavicle). */
const armBones = (s) => (n) => n.endsWith(`_${s}`);

/** One arm's harness: pauldron (`big`: the left's, with its haute-piece), rerebrace, couter and fan, vambrace, gauntlet. */
function armHarness(B, s, big) {
  const A = B.at, sg = s === 'l' ? 1 : -1, sh = A.shoulder[s], el = A.elbow[s], wr = A.wrist[s];
  const out = [];
  const upDir = unit(sub(el, sh)), foreDir = unit(sub(wr, el));
  const uaLen = len(sub(el, sh)), faLen = len(sub(wr, el));
  // -- the rerebrace: a closed tube down the upper arm under the pauldron's lames, into the couter
  const upPick = armPick(B, s, ['upperarm', 'shoulder']);
  const UA = limbWrap(B, sh, el, sg, { t: [0.0, 0.92], nt: 16, a: [-PI, PI], closed: true, na: 22, pick: upPick, smooth: 3, shape: (r) => r });
  const wUp = skinW(B, (q) => upPick(q) && along(q.p, sh, el) > 0.3 && along(q.p, sh, el) < 0.8, armBones(s));
  const rere = plateOn(UA, { a0: -PI, a1: PI, closed: true, t0: (a) => 0.15 + 0.12 * (1 - Math.cos(a - PI / 2)) / 2, t1: () => 0.9, nu: 4, nv: 22, off: (u) => 0.1 + 0.02 * u });
  out.push(solid(rere, { sheet: true, w: () => wUp, thick: 0.04, mat: () => 'st', inner: 'stD', edge: 'stS' }));
  // -- the pauldron's lames down the outside of the upper arm, each stepped out over the one below
  const front = big ? 1.95 : 1.55, backA = 1.95, sideA = PI / 2;
  const wSh = mixW2(B, [[`shoulder_${s}`, 0.45], [`upperarm_${s}`, 0.15], [`clavicle_${s}`, 0.4]]);
  const lames = [];
  for (let k = 0; k < 3; k++) {
    const t0 = 0.1 + 0.085 * k, t1 = t0 + 0.13, off = 0.27 - 0.035 * k;
    const g = plateOn(UA, { a0: sideA - backA, a1: sideA + front, t0: () => t0, t1: () => t1, nu: 3, nv: 18, off: () => off });
    lames.push(g);
    out.push(solid(g, { hollow: true, w: () => wSh, thick: 0.04, mat: () => 'stM', edge: 'stS' }));
    if (k === 2) out.push(tube(rowPath(g, 0, 0, 18, 18), { r: 0.035, mat: 'stL', w: () => wSh }));
  }
  // -- the cop: a dome over the shoulder's ball, out along the arm's top, wide over the chest and the back
  const ax = unit([sg * 0.42, 0.91, 0]);
  const shPick = (q) => q.p[0] * sg > 0.78 * sh[0] * sg && shareW(B, q.w, 'shoulder', 'upperarm', 'torso') > 0.8 && shareW(B, q.w, 'neck', 'head') < 0.1 && len(sub(q.p, sh)) < 1.25 && q.p[1] > sh[1] - 0.95;
  // (a round shell: an ellipsoid about the joint as wide as the shoulder's skin reaches and more, never nearer the skin than `clear`)
  const cc = add(sh, [sg * 0.02, -0.12, 0]), near = skinSamples(B).filter(shPick).map((q) => sub(q.p, cc));
  const ex = Math.max(...near.map((v) => v[0] * sg)), ey = Math.max(...near.filter((v) => Math.abs(v[0]) < 0.45).map((v) => v[1]));
  const ez = Math.max(...near.filter((v) => Math.abs(v[1]) < 0.4).map((v) => Math.abs(v[2])));
  const ro = ex + (big ? 0.46 : 0.4), E = [ro * 1.08, ro * 0.62, ro * 0.98];
  void ey; void ez;
  const D = domeWrap(B, { c: cc, u: ax, f: [0, 0, 1], s: [0, 1, 0], pick: shPick, rows: 24, cols: 40, thMax: 2.2, cone: 0.35, smooth: 4, shape: (r, th, ph, d) => Math.max(r + 0.3 - 0.14 * Math.max(0, Math.sin(ph)), ellipsoidReach(E, d)) });
  // (azimuth nought the front, pi/2 the top toward the neck, pi the back, -pi/2 down toward the armpit)
  const reach = (ph) => {
    const c = Math.cos(ph), sn = Math.sin(ph);
    const fr = c > 0 ? (big ? 1.45 : 1.2) : 1.4;
    return Math.max(0.6, (Math.abs(c) * fr + Math.max(0, sn) * 0.48 + Math.max(0, -sn) * 1.45) / (Math.abs(c) + Math.abs(sn)));
  };
  const cop = plateOn(D, { a0: -PI, a1: PI, closed: true, t0: () => 0, t1: (a) => reach(a) / 2.2, nu: 8, nv: 28, off: (u, v) => (0.12 + 0.08 * Math.max(0, Math.cos(-PI + 2 * PI * v))) * u * u });
  out.push(solid(cop, { sheet: true, w: () => wSh, mat: () => 'st' }));
  out.push(tube(rowPath(cop, 8, 0, 28, 28), { r: 0.05, mat: 'stL', w: () => wSh, closed: true }));
  out.push(band(rowPath(cop, 7.4, 0, 28, 28), { wide: 0.07, high: 0.015, mat: 'gilt', w: () => wSh, closed: true }));
  // (the haute-piece: a flange standing up off the cop beside the neck, flared out a little as it rises, its top rolled
  // and a gilt line along it; the left's the taller)
  const hH = (big ? 0.78 : 0.62) * (B.who === 'female' ? 0.72 : 1), base = [];
  for (let k = 0; k <= 14; k++) { const ph = 0.7 + (PI - 1.4) * (k / 14); base.push(cop.at(6.95, (ph / (2 * PI) + 0.5) * 28).p); }
  // (blued, its top edge rolled in brass and cusped, a gilt line within it; flared out as it rises)
  const hTop = (v) => hH * (0.18 + 0.82 * Math.sin(PI * v) ** 0.55) * (1 + 0.12 * Math.cos(5 * PI * v) * Math.sin(PI * v));
  const hp = patch((u, v) => {
    const k = v * 14, k0 = Math.min(13, Math.floor(k)), b = lerp(base[k0], base[k0 + 1], k - k0), up = unit([sg * (0.2 + 0.35 * u), 1, 0]);
    return { p: add(b, mul(up, hTop(v) * u - 0.05)), n: [sg, 0, 0] };
  }, 3, 18);
  out.push(solid(hp, { w: () => wSh, thick: 0.04, mat: () => 'blued', inner: 'stD', edge: 'stD' }));
  out.push(tube(rowPath(hp, 3, 0, 18, 18), { r: 0.05, mat: 'brass', w: () => wSh }));
  out.push(band(rowPath(hp, 2.1, 1.3, 16.7, 9, 0.02), { wide: 0.06, high: 0.015, mat: 'gilt', w: () => wSh }));
  out.haute = hp;
  // -- the couter: a cup over the elbow's point, its fan out on the outside (the left's the larger)
  const c0 = sub(el, mul(upDir, uaLen * 0.24)), c1 = add(el, mul(foreDir, faLen * 0.22));
  const elPick = (q) => armPick(B, s, ['upperarm', 'forearm'], 0.6)(q) && len(sub(q.p, el)) < 0.9;
  const EL = limbWrap(B, c0, c1, sg, { t: [0, 1], nt: 10, a: [-PI, PI], closed: true, na: 24, pick: elPick, smooth: 3, shape: (r) => r });
  const wEl = boneW(B, `elbow_${s}`);
  const cup = plateOn(EL, { a0: 0.9, a1: 2 * PI - 0.9, t0: () => 0.04, t1: () => 0.96, nu: 8, nv: 18, off: (u, v) => 0.2 + 0.08 * Math.sin(PI * u) * Math.sin(PI * v) });
  out.push(solid(cup, { sheet: true, w: () => wEl, thick: 0.04, mat: () => 'st', inner: 'stD', edge: 'stS' }));
  out.push(tube(rowPath(cup, 0, 0, 18, 18), { r: 0.035, mat: 'stL', w: () => wEl }));
  // (the fan: a fluted shell standing off the cup's outside)
  const fanR = (big ? 0.72 : 0.56) * (B.who === 'female' ? 0.8 : 1);
  const ec = EL.ta(0.5, PI / 2), fo = unit(add(ec.n, mul([0, 0, -1], 0.25)));
  const fx = unit(sub(upDir, mul(fo, dot(upDir, fo)))), fy = cross(fo, fx);
  const fanC = add(ec.p, mul(fo, 0.22));
  const fan = patch((u, v) => {
    const a = v * 2 * PI, rr = fanR * (0.12 + 0.88 * u) * (1 + 0.07 * Math.cos(a * 7) * u);
    const dish = 0.12 * u * u - 0.03 * Math.cos(a * 7) * u;
    return { p: add(fanC, add(mul(fo, dish), add(mul(fx, Math.cos(a) * rr * 1.1), mul(fy, Math.sin(a) * rr)))), n: fo };
  }, 4, 20, { closed: true });
  out.push(solid(fan, { hollow: true, w: () => wEl, thick: 0.04, mat: (i) => (i === 0 ? 'stS' : 'st'), edge: 'stS' }));
  out.push(tube(rowPath(fan, 4, 0, 20, 20), { r: 0.045, mat: 'gilt', w: () => wEl, closed: true }));
  out.push(stud(add(fanC, mul(fo, 0.01)), fo, { r: 0.09, h: 0.08, mat: 'brass', w: () => wEl }));
  // -- the vambrace: closed round the forearm from the couter to the wrist
  const faPick = armPick(B, s, ['forearm'], 0.6);
  const FA = limbWrap(B, el, wr, sg, { t: [0, 1.0], nt: 14, a: [-PI, PI], closed: true, na: 22, pick: faPick, smooth: 3, shape: (r) => r });
  const wFa = skinW(B, (q) => faPick(q) && along(q.p, el, wr) > 0.25 && along(q.p, el, wr) < 0.85, armBones(s));
  const vamb = plateOn(FA, { a0: -PI, a1: PI, closed: true, t0: () => 0.15, t1: () => 0.84, nu: 6, nv: 22, off: (u) => 0.1 + 0.03 * Math.sin(PI * u) });
  out.push(solid(vamb, { sheet: true, w: () => wFa, thick: 0.04, mat: () => 'st', inner: 'stD', edge: 'stS' }));
  out.push(tube(rowPath(vamb, 0, 0, 22, 14), { r: 0.035, mat: 'stL', w: () => wFa, closed: true }));
  // -- the gauntlet's cuff, flared back over the vambrace's end; an etched band round it
  const wWr = mixW2(B, [[`hand_${s}`, 0.5], [`wrist_${s}`, 0.25], [`lowerarm_${s}`, 0.25]]);
  const cuff = plateOn(FA, { a0: -PI, a1: PI, closed: true, t0: () => 0.74, t1: () => 0.99, nu: 3, nv: 22, off: (u) => 0.26 - 0.15 * u });
  out.push(solid(cuff, { hollow: true, w: () => wWr, thick: 0.035, mat: () => 'stM', edge: 'stS' }));
  out.push(tube(rowPath(cuff, 0, 0, 22, 16), { r: 0.04, mat: 'stL', w: () => wWr, closed: true }));
  out.push(band(rowPath(cuff, 1.3, 0, 22, 12), { wide: 0.08, high: 0.02, mat: 'gilt', w: () => wWr, closed: true }));
  return out;
}
const mixW2 = (B, list) => mixOf(B, list);

export function steelChest(B) {
  const T = torsoPlates(B);
  return coverHides(B, merge(smoothWeights(doublet(B), 2, (p) => p[1] < B.at.neck[1] - 0.6), ...T.parts, ...armHarness(B, 'l', true), ...armHarness(B, 'r', false)), 0.5);
}

/* ---- legs and boots --------------------------------------------------------------------------------------------- */
/** One leg's harness: cuisse, winged poleyn, greave. */
function legHarness(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, hp = A.hip[s], kn = A.knee[s], an = A.ankle[s], out = [];
  const legBones = (n) => n.endsWith(`_${s}`);
  // -- the cuisse: down the front and the outside of the thigh, a ridge down its middle, two lames at its foot
  const thPick = (q) => (sg > 0 ? q.p[0] > 0.12 : q.p[0] < -0.12) && shareW(B, q.w, 'thigh') > 0.6;
  const TH = limbWrap(B, hp, kn, sg, { t: [0, 1.05], nt: 21, a: [-PI, PI], closed: true, na: 28, pick: thPick, smooth: 4, shape: (r) => r });
  const wTh = thighW(B, s);
  const ridge = (a) => 0.045 * Math.exp(-(((a - 0.25) / 0.25) ** 2));
  const cuisse = plateOn(TH, { a0: -0.7, a1: 2.15, t0: () => 0.66, t1: (a) => 0.32 + 0.03 * smooth(0.6, 1.6, a), nu: 6, nv: 14, off: (u, v, t, a) => 0.13 + ridge(a) + 0.02 * u });
  out.push(solid(cuisse, { sheet: true, w: () => wTh, thick: 0.04, mat: () => 'st', inner: 'stD', edge: 'stS' }));
  out.push(tube(rowPath(cuisse, 6, 0, 14, 14), { r: 0.04, mat: 'stL', w: () => wTh }));
  for (let k = 0; k < 2; k++) {
    const t1 = 0.68 + 0.09 * k, t0 = t1 + 0.12;
    const g = plateOn(TH, { a0: -0.65, a1: 2.0, t0: () => t0, t1: () => t1, nu: 2, nv: 12, off: (u, v, t, a) => 0.15 - 0.012 * k + ridge(a) * 0.6 + 0.03 * u });
    out.push(solid(g, { hollow: true, w: () => wTh, thick: 0.04, mat: () => 'stM', edge: 'stS' }));
  }
  // -- the poleyn: a cop over the knee, its wing out on the outside, on the knee's own half-turning bone
  const kPick = (q) => (sg > 0 ? q.p[0] > 0.12 : q.p[0] < -0.12) && shareW(B, q.w, 'thigh', 'calf') > 0.8 && len(sub(q.p, kn)) < 0.9;
  const k0 = lerp(hp, kn, 0.84), k1 = lerp(kn, an, 0.14);
  const KN = limbWrap(B, k0, k1, sg, { t: [0, 1], nt: 10, a: [-PI, PI], closed: true, na: 28, pick: kPick, smooth: 4, shape: (r) => r });
  const wKn = boneW(B, `knee_${s}`);
  const cop = plateOn(KN, { a0: -1.45, a1: 1.45, t0: () => 0.02, t1: () => 0.98, nu: 7, nv: 14, off: (u, v) => 0.2 + 0.1 * Math.sin(PI * u) * Math.sin(PI * v) ** 0.7 });
  out.push(solid(cop, { sheet: true, w: () => wKn, mat: () => 'st' }));
  out.push(tube(rowPath(cop, 0, 0, 14, 14), { r: 0.04, mat: 'stL', w: () => wKn }));
  out.push(tube(rowPath(cop, 7, 0, 14, 14), { r: 0.04, mat: 'stL', w: () => wKn }));
  out.push(band(rowPath(cop, 3.5, 2, 12, 14), { wide: 0.08, high: 0.025, mat: 'gilt', w: () => wKn }));
  // (the wing: a heart-shaped plate standing off the outside of the knee, its lobes up and down, fluted)
  const kc = KN.ta(0.5, PI / 2 - 0.25), wo = unit(add(kc.n, [0, 0, 0.35])), legDir = unit(sub(an, hp));
  const wx = unit(sub(legDir, mul(wo, dot(legDir, wo)))), wy = cross(wo, wx), wc = add(kc.p, mul(wo, 0.24));
  const wR = B.who === 'female' ? 0.54 : 0.62;
  const wing = patch((u, v) => {
    const a = v * 2 * PI, heart = 1 + 0.25 * Math.cos(2 * a) - 0.12 * Math.cos(a), rr = wR * (0.12 + 0.88 * u) * heart;
    const dish = 0.1 * u * u - 0.025 * Math.cos(a * 6) * u;
    return { p: add(wc, add(mul(wo, dish), add(mul(wx, Math.cos(a) * rr), mul(wy, Math.sin(a) * rr * 0.8)))), n: wo };
  }, 3, 16, { closed: true });
  out.push(solid(wing, { hollow: true, w: () => wKn, thick: 0.035, mat: (i) => (i === 0 ? 'stS' : 'st'), edge: 'stS' }));
  out.push(tube(rowPath(wing, 3, 0, 16, 16), { r: 0.045, mat: 'gilt', w: () => wKn, closed: true }));
  out.push(stud(add(wc, mul(wo, 0.01)), wo, { r: 0.08, h: 0.07, mat: 'brass', w: () => wKn }));
  // -- the greave: closed round the calf from under the poleyn to the ankle, a ridge down the shin, flared at its foot
  const cPick = (q) => (sg > 0 ? q.p[0] > 0.12 : q.p[0] < -0.12) && shareW(B, q.w, 'calf') > 0.6;
  const SH = limbWrap(B, kn, an, sg, { t: [0, 1.02], nt: 20, a: [-PI, PI], closed: true, na: 26, pick: cPick, smooth: 4, shape: (r) => r });
  const wCa = skinW(B, (q) => cPick(q) && along(q.p, kn, an) > 0.2 && along(q.p, kn, an) < 0.85, legBones);
  // (a sharp ridge down the shin, the calf swelling behind, the foot flared)
  const shin = (a) => 0.1 * Math.exp(-((a / 0.22) ** 2));
  const calf = (t, a) => 0.08 * Math.exp(-(((t - 0.33) / 0.17) ** 2)) * Math.max(0, -Math.cos(a)) ** 1.5;
  const greave = plateOn(SH, { a0: -PI, a1: PI, closed: true, t0: (a) => 0.93 + 0.03 * smooth(1.6, 2.8, Math.abs(a)), t1: () => 0.12, nu: 9, nv: 16, off: (u, v, t, a) => 0.11 + shin(a) + calf(t, a) + 0.17 * smooth(0.78, 0.93, t) ** 1.5 });
  out.push(solid(greave, { sheet: true, w: () => wCa, thick: 0.04, mat: () => 'st', inner: 'stD', edge: 'stS' }));
  out.push(tube(rowPath(greave, 9, 0, 16, 16), { r: 0.045, mat: 'stL', w: () => wCa, closed: true }));
  out.push(band(rowPath(greave, 8.4, 0, 16, 16), { wide: 0.07, high: 0.015, mat: 'gilt', w: () => wCa, closed: true }));
  out.push(tube(rowPath(greave, 0, 0, 16, 16), { r: 0.045, mat: 'stL', w: () => wCa, closed: true }));
  // (the etched line down the shin's ridge)
  out.push(band(colPath(greave, 8, 0.9, 8.1, 9, 0.0), { wide: 0.09, high: 0.025, mat: 'rune', w: () => wCa }));
  return out;
}
/** The arming hose: the hips and the legs to the ankles, close over the skin, the skin under it left out; its waist (`armingW`) left out under any chest piece. */
function hose(B) {
  const A = B.at, M = torsoMarks(B);
  return shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'thigh', 'calf', 'torso') > 0.6 && on(B, i, 'foot') < 0.5 && on(B, i, 'upperarm', 'forearm', 'hand', 'shoulder') < 0.05 && y(p) < M.waist + 0.25 && y(p) > A.ankle[s][1] - 0.05; },
    off: () => 0.03,
    mat: ({ p }) => (y(p) > M.hip + 0.05 ? 'armingW' : 'arming'),
  });
}
export function steelLegs(B) {
  return { P: merge(smoothWeights(hose(B), 3, (p) => p[1] > B.at.knee.l[1] + 0.6), ...legHarness(B, 'l'), ...legHarness(B, 'r')), dropAt: (f) => f.mat === 'armingW' };
}
/** One foot's sabaton: lames over the instep to a rounded toe cap, over a leather shoe on a thick sole. */
function sabaton(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, an = A.ankle[s], ball = A.ball[s], out = [];
  const fPick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'foot') > 0.6;
  const toes = skinSamples(B).filter(fPick);
  const tip = toes.reduce((b, q) => (q.p[2] > b[2] ? q.p : b), [0, 0, -9]);
  // (along the foot from the ankle's front to a point a hand past the toes: the toe drawn out to a blunt point)
  const from = [an[0], an[1] - 0.05, an[2] + 0.05], to = [tip[0], A.floor + 0.22, tip[2] + 0.62];
  const tBall = along(ball, from, to), tToe = along(tip, from, to);
  const FT = limbWrap(B, from, to, sg, { front: [0, 1, 0], t: [0, 1.0], nt: 26, a: [-PI, PI], closed: true, na: 24, pick: fPick, smooth: 4,
    shape: (r, t) => r * (t > tToe - 0.2 ? Math.max(0.03, 1 - (t - (tToe - 0.2)) / (1.01 - (tToe - 0.2))) : 1) });
  const wFoot = boneW(B, `foot_${s}`), wBall = boneW(B, `ball_${s}`);
  const lames = 3, l0 = 0.13, l1 = tBall - 0.02, h = (l1 - l0) / lames;
  // (each lame lapped over the next toward the toe, its edge bright)
  for (let k = 0; k < lames; k++) {
    const t0 = l0 + h * k, t1 = t0 + h + 0.04;
    const g = plateOn(FT, { a0: -1.8, a1: 1.8, t0: () => t0, t1: () => t1, nu: 2, nv: 10, off: (u) => 0.12 - 0.01 * k + 0.03 * (1 - u) });
    out.push(solid(g, { hollow: true, w: () => wFoot, thick: 0.035, mat: () => 'stM', edge: 'stS' }));
    out.push(tube(rowPath(g, 2, 0, 10, 10), { r: 0.042, mat: 'stL', w: () => wFoot }));
  }
  const toe = plateOn(FT, { a0: -1.9, a1: 1.9, t0: () => tBall - 0.04, t1: () => 1.0, nu: 8, nv: 12, off: (u) => 0.1 * (1 - smooth(0.5, 1, u)) + 0.02 });
  out.push(solid(toe, { sheet: true, w: () => wBall, mat: () => 'st' }));
  out.push(tube(rowPath(toe, 0, 0, 12, 12), { r: 0.035, mat: 'stL', w: () => wBall }));
  // (the gilt line down the shin carried on along the toe's ridge to its point, lit when enchanted)
  out.push(band(colPath(toe, 6, 0.4, 6.6, 8), { wide: 0.08, high: 0.02, mat: 'rune', w: () => wBall }));
  // (and under the point, a sole of leather closing it)
  const under = plateOn(FT, { a0: PI - 1.3, a1: PI + 1.3, t0: () => tBall - 0.04, t1: () => 1.0, nu: 5, nv: 6, off: (u) => 0.1 * (1 - smooth(0.5, 1, u)) + 0.02 });
  out.push(solid(under, { sheet: true, w: () => wBall, mat: () => 'sole' }));
  return out;
}
/** The leather shoe under the sabatons: the foot and the ankle's foot, close over the skin, stood on. */
function shoe(B) {
  const A = B.at;
  const P = shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'foot', 'calf') > 0.6 && y(p) < A.ankle[s][1] + 0.3; },
    off: ({ n }) => 0.045 + (n[1] < -0.6 ? 0.06 : 0),
    mat: ({ n }) => (n[1] < -0.55 ? 'sole' : 'leather'),
  });
  P.soles = P.V.map((_, i) => i).filter((i) => P.V[i][1] < A.floor + 0.12);
  return P;
}
export function steelBoots(B) {
  return merge(shoe(B), ...sabaton(B, 'l'), ...sabaton(B, 'r'));
}
/**
 * The armet: a round skull with a low comb and the rondel on its stalk behind; under its brow the sight, lined in the
 * `sight` material (dark plain, lit when enchanted); the visor's prow below it, its breaths cut on the right; cheek
 * plates closed under the chin; a plume of three feathers from a brass socket behind the comb. Rigid on the head.
 */
export function steelHelm(B) {
  const A = B.at, out = [];
  const hd = (q) => q.w.reduce((t, [b, x]) => t + (B.bones[b].name === 'head' || B.bones[b].name === 'jaw' ? x : 0), 0);
  const pick = (q) => hd(q) > 0.45;
  const hs = skinSamples(B).filter(pick);
  const top = Math.max(...hs.map((q) => q.p[1])), bot = Math.min(...hs.map((q) => q.p[1]));
  const zf = Math.max(...hs.map((q) => q.p[2])), zb = Math.min(...hs.map((q) => q.p[2])), xw = Math.max(...hs.map((q) => q.p[0]));
  const c = [0, bot + 0.56 * (top - bot), (zf + zb) / 2];
  const fit = B.who === 'female' ? 0.11 : 0.17;
  const E = [xw + fit, top - c[1] + fit - 0.01, (zf - zb) / 2 + fit];
  const wH = boneW(B, 'head');
  const D = domeWrap(B, { c, u: [0, 1, 0], f: [0, 0, 1], s: [1, 0, 0], pick, rows: 30, cols: 48, thMax: PI, cone: 0.3, smooth: 4, shape: (r, th, ph, d) => Math.max(r + fit - 0.02, ellipsoidReach(E, d)) });
  const thOf = (p) => Math.acos(clamp(unit(sub(p, c))[1], -1, 1));
  const browTh = thOf([0, A.head[1] + 0.62 * (top - A.head[1]) / 1.6, zf]);
  const sightA = browTh + 0.02, sightB = sightA + 0.3;
  const front = (ph) => Math.abs(wrapAngle(ph));
  // -- the skull: down to the sight before, to the nape behind
  const skBot = (ph) => { const f = smooth(0.75, 1.5, front(ph)); return (sightA * (1 - f) + (B.who === 'female' ? 2.34 : 2.45) * f) / PI; };
  const flare = (G) => gridOf(G.P.map((row) => row.map((p) => { const k = (B.who === 'female' ? 0.06 : 0.12) * smooth(c[1] - 0.55 * E[1], c[1] - 0.95 * E[1], p[1]), h = unit([p[0] - c[0], 0, p[2] - c[2]]); return add(p, mul(h, k)); })), { closed: G.closed, out: (i, j) => G.N[i][j] });
  const skull = flare(plateOn(D, { a0: -PI, a1: PI, closed: true, t0: () => 0, t1: skBot, nu: 10, nv: 28, off: () => 0 }));
  out.push(solid(skull, { sheet: true, w: () => wH, thick: 0.05, mat: () => 'st', inner: 'stD', edge: 'stS' }));
  out.push(tube(rowPath(skull, 10, 0, 28, 28), { r: 0.04, mat: 'stL', w: () => wH, closed: true }));
  // (the comb, low, from the brow over the crown to the nape)
  const comb = [];
  for (let k = 0; k <= 24; k++) { const th = -(sightA - 0.15) + ((sightA - 0.15) + 2.2) * (k / 24), q = D.ta(Math.abs(th) / PI, th < 0 ? 0 : PI); comb.push({ p: q.p, n: q.n }); }
  out.push(band(comb, { wide: 0.04, high: 0.15, sink: 0.03, mat: 'st', w: () => wH }));
  out.push(tube(comb.map((q) => ({ p: add(q.p, mul(q.n, 0.15)), n: q.n })), { r: 0.035, mat: 'stL', w: () => wH }));
  // -- the cheek plates: round the face from below the sight to under the chin, under the visor
  const cheek = flare(plateOn(D, { a0: -1.75, a1: 1.75, t0: (a) => lerp([0, sightB - 0.03, 0], [0, sightA - 0.06, 0], smooth(1.0, 1.25, Math.abs(a)))[1] / PI, t1: (a) => (2.42 - 0.24 * smooth(0.12, 0.55, Math.abs(a)) + 0.1 * smooth(1.2, 1.7, Math.abs(a))) / PI, nu: 8, nv: 18, off: (u, v) => 0.02 + 0.03 * Math.sin(PI * v) }));
  out.push(solid(cheek, { sheet: true, w: () => wH, thick: 0.05, mat: () => 'st', inner: 'stD', edge: 'stS' }));
  out.push(tube(rowPath(cheek, 8, 0, 18, 18), { r: 0.045, mat: 'stL', w: () => wH }));
  // (the sight's lining: lit when enchanted, as a gaze)
  const liner = plateOn(D, { a0: -1.05, a1: 1.05, t0: () => (sightA - 0.03) / PI, t1: () => (sightB + 0.03) / PI, nu: 2, nv: 16, off: () => -0.02 });
  out.push(solid(liner, { sheet: true, w: () => wH, mat: () => 'sight' }));
  // -- the visor: from the sight down over the mouth, its prow out before the face, its breaths on the right
  const prow = (u, v) => (B.who === 'female' ? 0.3 : 0.4) * Math.max(0, 1 - Math.abs(v - 0.5) / 0.5) ** 1.25 * Math.sin(PI * Math.min(1, 0.1 + u * 1.05)) ** 0.7;
  const visor = plateOn(D, { a0: -1.2, a1: 1.2, t0: () => sightB / PI, t1: () => (sightB + 0.68) / PI, nu: 9, nv: 18, off: (u, v) => 0.08 + prow(u, v) });
  const breath = (i, j) => j >= 2 && j <= 6 && i >= 3 && i <= 6 && i % 2 === 1 && j % 3 !== 1;
  out.push(solid(visor, { w: () => wH, thick: 0.045, mat: (i, j) => (breath(i, j) ? null : 'st'), inner: 'stD', edge: (i, j, m) => (m ? 'stS' : 'stD') }));
  out.push(tube(rowPath(visor, 0, 0, 18, 18), { r: 0.035, mat: 'stL', w: () => wH }));
  out.push(tube(rowPath(visor, 9, 0, 18, 18), { r: 0.04, mat: 'stL', w: () => wH }));
  out.push(...studsAlong(rowPath(visor, 0.2, 0, 18, 18), 2, { from: 0.02, to: 0.98, r: 0.07, h: 0.06, mat: 'brass', w: () => wH }));
  // -- the rondel on its stalk at the nape
  const nape = D.ta(2.25 / PI, PI), ro = unit(add(nape.n, [0, -0.1, 0]));
  const rc = add(nape.p, mul(ro, 0.24));
  out.push(tube([{ p: nape.p, n: [0, 1, 0] }, { p: rc, n: [0, 1, 0] }], { r: 0.05, mat: 'stS', w: () => wH }));
  const rx = unit(cross([0, 1, 0], ro)), ry = cross(ro, rx);
  const rondel = patch((u, v) => { const a2 = v * 2 * PI, rr = 0.36 * (0.15 + 0.85 * u); return { p: add(rc, add(mul(ro, 0.04 * (1 - u * u)), add(mul(rx, Math.cos(a2) * rr), mul(ry, Math.sin(a2) * rr)))), n: ro }; }, 3, 20, { closed: true });
  out.push(solid(rondel, { w: () => wH, thick: 0.035, mat: (i) => (i === 1 ? 'gilt' : 'st'), inner: 'stD', edge: 'stS' }));
  out.push(stud(add(rc, mul(ro, 0.05)), ro, { r: 0.07, h: 0.06, mat: 'brass', w: () => wH }));
  // -- the plume: three feathers from a brass socket behind the comb, arched back
  const sock = D.ta(1.05 / PI, PI), so = sock.n;
  out.push(tube([{ p: add(sock.p, mul(so, -0.02)), n: [0, 0, -1] }, { p: add(sock.p, add(mul(so, 0.16), [0, 0.12, 0])), n: [0, 0, -1] }], { r: 0.075, mat: 'brass', w: () => wH }));
  const root = add(sock.p, add(mul(so, 0.16), [0, 0.12, 0]));
  for (const [dx, m, k] of [[0, 'plume', 1.0], [-0.13, 'velvet', 0.9], [0.13, 'velvet', 0.9], [-0.26, 'plume', 0.74], [0.26, 'plume', 0.74]]) {
    const path = [];
    for (let q = 0; q <= 10; q++) {
      const f = q / 10, a2 = PI * 0.08 + PI * 0.95 * f;
      // (up out of the socket, over in an arc and down behind, spreading)
      path.push({ p: add(root, [dx * (0.3 + 1.4 * f), (Math.sin(a2) - Math.sin(PI * 0.08)) * 1.0 * k + 0.3 * f, -(Math.cos(PI * 0.08) - Math.cos(a2)) * 1.05 * k]), n: [0, 1, 0] });
    }
    out.push(sweep(path, { closedProfile: true, mat: m, w: () => wH, profile: (q) => { const f = q / 10, r = 0.25 * Math.sin(PI * (0.15 + 0.85 * f)) ** 0.6 * (1 - 0.4 * f) + 0.02; return [[-r * 1.4, 0], [0, r * 0.7], [r * 1.4, 0], [0, -r * 0.7]]; } }));
  }
  const P = merge(...out);
  // (the head's own polygons inside it left out: none of it shows through)
  // (and the neck's inside it: every corner within the helm's reach, short of its rim)
  const inside = (i) => { const v = sub(B.V[i], c), th = Math.acos(clamp(unit(v)[1], -1, 1)), ph = Math.atan2(v[0], v[2]); return th < (Math.abs(wrapAngle(ph)) < 1.6 ? Math.max(skBot(ph) * PI, 2.44) : skBot(ph) * PI) - 0.08; };
  B.A.polys.forEach(([v], pi) => { if (v.every((i) => headW(B, B.W[i]) > 0.6 || inside(i))) P.hides.add(pi); });
  return P;
}
/**
 * The mantle: the gorget (a standing collar lined in blue velvet, two lames before and behind) with the mail pixane
 * under it behind, and over all the half-mantle (see within).
 */
export function steelMantle(B) {
  const A = B.at, M = torsoMarks(B), out = [];
  const hd = (q) => q.w.reduce((t, [b, x]) => t + (B.bones[b].name === 'head' || B.bones[b].name === 'jaw' ? x : 0), 0);
  const pick = (q) => shareW(B, q.w, 'torso', 'neck', 'head') > 0.85 && hd(q) < 0.2 && q.p[1] > M.pit - 0.2 && Math.abs(q.p[0]) < 1.25;
  const F = torsoField(B), t = F.tOfY;
  const wNeck = mixOf(B, [['neck_01', 0.55], ['spine_03', 0.45]]);
  const W = nearSkinW(B, (q) => pick(q), (n) => ['spine_03', 'spine_02', 'neck_01', 'clavicle_l', 'clavicle_r'].includes(n), 0.35);
  const wMid = (p) => mixW([[wNeck, 0.5], [W(p), 0.5]]);
  // (the lowest lame's foot: over the breastplate's neckline before, the backplate's behind, the shoulder's top at the sides)
  const behind = (a) => smooth(0.9, 2.3, Math.abs(wrapAngle(a))), side = (a) => Math.sin(Math.abs(wrapAngle(a))) ** 2;
  const n = A.neck[1];
  // the collar: a standing lame round the neck, lined in blue velvet, higher behind
  const cTop = (a) => n + 0.17 - 0.03 * behind(a) - 0.27 * smooth(1.5, 0.3, Math.abs(wrapAngle(a)));
  const collar = plateOn(F, { a0: -PI, a1: PI, closed: true, t0: (a) => t(cTop(a) - 0.17), t1: (a) => t(cTop(a)), nu: 3, nv: 28, maxUp: 0.3, off: (u) => 0.11 + 0.03 * (1 - u) });
  out.push(solid(collar, { w: () => wNeck, thick: 0.04, mat: () => 'st', inner: 'velvet', edge: 'stS' }));
  out.push(tube(rowPath(collar, 3, 0, 28, 28), { r: 0.045, mat: 'stL', w: () => wNeck, closed: true }));
  out.push(tube(rowPath(collar, 0, 0, 28, 28), { r: 0.035, mat: 'stS', w: () => wNeck, closed: true }));
  // the bibs before and behind: two lames each, their feet curved down to a point at the middle, clear of the pauldrons
  for (const [mid, half, deep] of [[0, 0.72, M.neckF - 0.32], [PI, 0.7, M.neckB - 0.34]]) {
    const c = (a) => Math.cos((PI / 2) * clamp(Math.abs(wrapAngle(a - mid)) / half)) ** 0.7;
    const foot = (a) => n - 0.08 - (n - 0.08 - deep) * c(a), lift = mid === 0 ? 0.1 : 0.09;
    const L = [
      { top: () => n - 0.2, bot: (a) => Math.min(n - 0.34, lerp([0, n - 0.2, 0], [0, foot(a), 0], 0.5)[1]), off: (u) => 0.2 + 0.06 * (1 - u) + lift },
      { top: (a) => Math.min(n - 0.34, lerp([0, n - 0.2, 0], [0, foot(a), 0], 0.5)[1]) + 0.07, bot: (a) => Math.min(n - 0.4, foot(a)), off: (u) => 0.28 + 0.1 * (1 - u) + lift },
    ];
    L.forEach((l, k) => {
      const g = plateOn(F, { a0: mid - half, a1: mid + half, t0: (a) => t(l.bot(a)), t1: (a) => t(l.top(a)), nu: 3, nv: 18, maxUp: 0.3, off: l.off });
      out.push(solid(g, { hollow: true, w: (p) => wMid(p), thick: 0.04, mat: () => 'stM', edge: 'stS' }));
      out.push(tube(rowPath(g, 0, 0, 18, 18), { r: 0.04, mat: k === 1 ? 'stL' : 'stS', w: (p) => wMid(p) }));
      if (k === 1) out.push(...studsAlong(rowPath(g, 0.8, 1.5, 16.5, 15), 5, { r: 0.05, h: 0.045, mat: 'brass', w: (p) => wMid(p) }));
    });
    // the pixane under the lower lame behind (before, the arms cross it): mail, its hem cut in points, ringed in brass,
    // a gilt boss at each point
    if (mid === 0) continue;
    const pts = 7, c0 = mid - half * 0.8, c1 = mid + half * 0.8;
    const vand = (a) => { const f = ((a - c0) / (c1 - c0)) * pts; return 1 - Math.abs(2 * (f - Math.floor(f)) - 1); };
    const top = (a) => foot(a) + 0.12, bot = (a) => foot(a) - (mid === 0 ? 0.12 + 0.18 * vand(a) : 0.22 + 0.24 * vand(a)) * c(a) ** 0.5;
    const g = plateOn(F, { a0: c0, a1: c1, t0: (a) => t(bot(a)), t1: (a) => t(top(a)), nu: 4, nv: pts * 4, off: () => 0.33 + lift });
    out.push(solid(g, { hollow: true, w: (p) => W(p), thick: 0.03, mat: () => 'mail', edge: 'mailD' }));
    out.push(band(rowPath(g, 0, 0, pts * 4, pts * 2), { wide: 0.07, high: 0.03, mat: 'brass', w: (p) => W(p) }));
    for (let k = 0; k < pts; k++) { const q = g.at(0, (k + 0.5) * 4); out.push(stud(q.p, q.n, { r: 0.06, h: 0.05, mat: 'brass', w: () => W(q.p) })); }
  }
  // ---- the half-mantle: blue velvet lined in crimson, over the right shoulder and the back, its hem dagged and bound in
  // brass, its left end a band over the left shoulder (inside the haute-piece) to a great brooch on the breast
  const L = armHarness(B, 'l', true), Rr = armHarness(B, 'r', false), torsoP = torsoPlates(B).parts;
  const legW = (w) => w.some(([b, x]) => x > 0.2 && /(thigh|calf)/.test(B.bones[b].name));
  const lowArm = (w) => w.some(([b, x]) => x > 0.3 && /(lowerarm|elbow|hand|wrist)/.test(B.bones[b].name));
  const pts = [];
  for (const P of [...torsoP, ...L, ...Rr, merge(...out)]) P.V.forEach((p, i) => { if (!lowArm(P.W[i]) && !legW(P.W[i]) && p[1] > M.waist - 0.5) pts.push(p); });
  for (const q of skinSamples(B)) if (shareW(B, q.w, 'torso', 'neck', 'shoulder', 'upperarm') > 0.8 && headW(B, q.w) < 0.15 && q.p[1] > M.waist - 0.5) pts.push(q.p);
  const zc = torsoMiddle(B, (q) => shareW(B, q.w, 'torso', 'neck', 'head') > 0.8 && headW(B, q.w) < 0.15);
  const cy0 = M.waist - 0.4, cy1 = n + 0.35, ct = (yy) => (yy - cy0) / (cy1 - cy0);
  const C = torsoWrap(B, cy0, cy1, zc, {
    points: pts, nt: 70, na: 72, closed: true, a: [-PI, PI], smooth: 3, minDa: 0.1, empty: 0.3,
    // (hung: no nearer the middle than anything above it, as cloth falls)
    post: (R) => { for (let j = 0; j < R[0].length; j++) for (let i = R.length - 2; i >= 0; i--) R[i][j] = Math.max(R[i][j], R[i + 1][j]); },
    shape: (r) => r + 0.1,
  });
  // (over each shoulder its top lies outboard of the haute-piece: where the cloth first stands out past it)
  const finOf = (H) => Math.max(...H.P.flat().map((p) => Math.hypot(p[0], p[2] - zc(p[1])))) + 0.08;
  const finL = finOf(L.haute), finR = finOf(Rr.haute);
  const outboard = (a) => { const fr = Math.sin(a) > 0 ? finL : finR; for (let yy = n; yy > M.pit; yy -= 0.02) if (len(sub(C.ta(ct(yy), a).p, [0, yy, zc(yy)])) > fr) return yy; return M.pit; };
  // (from the brooch on the left pauldron's front, a band over that pauldron, the back, and the right shoulder whole)
  const aL = 0.95, aR = 2 * PI - 0.4;
  const yTop = (a) => { const o = outboard(a), b = Math.abs(wrapAngle(a)); return lerp([0, o, 0], [0, n - 0.02, 0], smooth(2.3, 2.9, b))[1]; };
  const strapW = (a) => 0.3;
  const hemBack = A.spine2[1] - 0.1, hemSide = A.shoulder.l[1] - (B.who === 'female' ? 0.28 : 0.45), hemFront = A.shoulder.l[1] - 0.4;
  // (its folds: hung from the back of the right shoulder and fanning down from it, deeper the further they fall, each
  // ridge hanging lower at the hem; none on the band over the left shoulder nor over the right shoulder's front)
  const pivA = 2 * PI - PI / 2 - 0.5, pivY = n - 0.2, Rref = 1.35, ridges = 7.5;
  const foldMask = (a) => smooth(2.3, 2.85, a) * (1 - 0.5 * smooth(4.4, 5.0, a)) * (1 - smooth(5.4, 5.8, a));
  const ridgeAt = (yy, a) => { const dx = (a - pivA) * Rref, dy = yy - pivY, phi = Math.atan2(dx, -dy); return { r: (0.5 - 0.5 * Math.cos(2 * ridges * phi)) ** 0.75, d: Math.hypot(dx, dy) }; };
  const yBot = (a) => {
    // (the band over the left shoulder; across the back a long diagonal, deepest behind the right shoulder; the right
    // short over the arm, rising to the front)
    const strap = yTop(a) - strapW(a), deep = M.waist + 0.35;
    let yy = lerp([0, strap, 0], [0, deep, 0], smooth(2.2, 3.0, a))[1];
    yy = lerp([0, yy, 0], [0, hemSide, 0], smooth(3.4, 3.9, a))[1];
    yy = lerp([0, yy, 0], [0, hemFront, 0], smooth(4.5, aR, a))[1];
    return yy - 0.3 * ridgeAt(yy, a).r * smooth(2.3, 2.85, a) * (1 - smooth(3.3, 3.75, a));
  };
  const fold = (yy, a) => { const g = ridgeAt(yy, a); return 0.3 * g.r * smooth(0.2, 1.6, g.d) * foldMask(a); };
  const NU = 9, NV = 46;
  const cape = plateOn(C, { a0: aL, a1: aR, t0: (a) => ct(yBot(a)), t1: (a) => ct(yTop(a)), nu: NU, nv: NV, off: (u, v, tt, a) => fold(cy0 + (cy1 - cy0) * tt, a) });
  const shR = mixOf(B, [['shoulder_r', 0.45], ['upperarm_r', 0.15], ['clavicle_r', 0.4]]), shL = mixOf(B, [['shoulder_l', 0.45], ['upperarm_l', 0.15], ['clavicle_l', 0.4]]);
  // (the torso's behind, the pauldrons' over the shoulders)
  const wCape = (p) => {
    const k = smooth(0.5, 1.5, Math.abs(p[0])) * (p[0] > 0 ? 1 : smooth(M.pit - 0.6, M.pit + 0.4, p[1]));
    return mixW([[W(p), 1 - k], [p[0] < 0 ? shR : shL, k]]);
  };
  const capeP = smoothWeights(solid(cape, { w: (p) => wCape(p), thick: 0.016, mat: () => 'velvet', inner: 'lining', edge: 'lining' }), 14);
  out.push(capeP);
  // (what is laid on it takes its weights where it lies, so the two move as one)
  const onCape = (p) => capeP.W[nearestOf(capeP.V, p)];
  // (the hem bound in brass; the top edge rolled)
  out.push(band(rowPath(cape, 0, 0, NV, NV), { wide: 0.1, high: 0.03, mat: 'brass', w: (p) => onCape(p) }));
  out.push(tube(rowPath(cape, NU, 0, NV, NV / 2), { r: 0.04, mat: 'velvetD', w: (p) => onCape(p) }));
  // (a gilt tassel at the foot of each fold behind, where the hem hangs lowest)
  for (let j = 1; j < NV; j++) {
    const a = aL + ((aR - aL) * j) / NV, da = (aR - aL) / NV;
    if (a < 2.4 || a > 3.75 || !(yBot(a) < yBot(a - da) && yBot(a) <= yBot(a + da))) continue;
    const q = cape.at(0, j), d = unit(add(mul(q.n, 0.3), [0, -1, 0]));
    const tip = add(add(q.p, mul(q.n, 0.02)), mul(d, 0.3));
    out.push(sweep([{ p: add(q.p, mul(q.n, 0.02)), n: q.n }, { p: lerp(q.p, tip, 0.5), n: q.n }, { p: tip, n: q.n }], { closedProfile: true, mat: 'brass', w: () => onCape(q.p), profile: (k) => roundProfile([0.04, 0.07, 0.1][k], 4) }));
    out.push(stud(tip, d, { r: 0.07, h: 0.06, k: 4, mat: 'brass', w: () => onCape(q.p) }));
  }
  // (its crimson lining turned back along the front edge over the right shoulder)
  const revers = patch((u, v) => { const q = cape.at(u * NU, NV - v * 4.5 * (1 - u) ** 0.7 - 0.01); return { p: add(q.p, mul(q.n, 0.03 + 0.06 * (1 - v))), n: q.n }; }, 8, 3);
  out.push(solid(revers, { sheet: true, w: (p) => onCape(p), mat: () => 'lining' }));
  out.push(tube(colPath(revers, 3, 0, 8, 8), { r: 0.03, mat: 'brass', w: (p) => onCape(p) }));
  // (on the back, the heraldic star in gilt: an eight-pointed star, lit when enchanted)
  const capeAt = (yy, a) => { const t0 = ct(yBot(a)), t1 = ct(yTop(a)); return cape.at(((ct(yy) - t0) / (t1 - t0)) * NU, ((a - aL) / (aR - aL)) * NV); };
  const starAt = (sy, sa, sR) => {
    const Rr0 = len(sub(capeAt(sy, sa).p, [0, sy, zc(sy)]));
    const star = patch((u, v) => {
      const th = v * 2 * PI, r = sR * u * (0.36 + 0.64 * Math.abs(Math.cos(4 * th)) ** 4) * (Math.abs(Math.cos(2 * th)) > 0.7 ? 1 : 0.78);
      const q = capeAt(sy + Math.sin(th) * r, sa - (Math.cos(th) * r) / Rr0);
      return { p: add(q.p, mul(q.n, 0.05)), n: q.n };
    }, 2, 32, { closed: true });
    out.push(solid(star, { sheet: true, w: (p) => onCape(p), mat: () => 'rune' }));
  };
  const big = B.who === 'female' ? 0.85 : 1;
  starAt(lerp(A.chest, A.spine2, 0.3)[1], PI + 0.1, 0.62 * big);
  // (and a smaller one on the shoulder, seen from before)
  starAt(lerp([0, n, 0], A.chest, 0.62)[1], 2 * PI - 1.05, 0.3 * big);
  // ---- the brooch pinning the band on the left breast: a steel rim, red enamel, a ring of gilt bosses, the gem in the middle
  const bq = cape.at(NU * 0.48, NV * 0.017), bo = unit(add(bq.n, [0, 0.1, 0.35])), bx = unit(cross([0, 1, 0], bo)), by = cross(bo, bx);
  const bc = add(bq.p, mul(bo, 0.03)), bR = B.who === 'female' ? 0.3 : 0.34, wB = shL;
  const disc2 = patch((u, v) => { const a2 = v * 2 * PI, rr = bR * (0.12 + 0.88 * u) * (1 + 0.06 * Math.cos(a2 * 8) * u); return { p: add(bc, add(mul(bo, 0.06 * (1 - u * u)), add(mul(bx, Math.cos(a2) * rr), mul(by, Math.sin(a2) * rr)))), n: bo }; }, 3, 24, { closed: true });
  out.push(solid(disc2, { w: () => wB, thick: 0.04, mat: (i) => (i >= 2 ? 'st' : i === 2 ? 'enamel' : 'enamel'), inner: 'stD', edge: 'stS' }));
  out.push(tube(rowPath(disc2, 3, 0, 24, 24), { r: 0.035, mat: 'stL', w: () => wB, closed: true }));
  for (let k = 0; k < 6; k++) { const q = disc2.at(2.1, k * 4); out.push(stud(q.p, q.n, { r: 0.035, h: 0.03, mat: 'brass', w: () => wB })); }
  out.push(stud(add(bc, mul(bo, 0.06)), bo, { r: 0.19, h: 0.17, k: 8, mat: 'rune', w: () => wB }));
  return coverHides(B, merge(...out), 0.6);
}
