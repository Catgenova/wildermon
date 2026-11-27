// The glimmersteel set: the starlit duellist, a court fencer who fights by moonlight; built with the plate kit
// (tools/sculpt/garments/platekit.mjs) and the set's own builders (tools/sculpt/garments/kit/glimmersteel.mjs). Its steel
// blued to a near-black midnight with a strong sheen, its edges polished silver-white, a field of tiny star glints set
// in it as geometry; its cloth rich violet, deep indigo and navy-black velvet, with silver-white silk and satin.
//
//   helm    the moon burgonet: a close skull of eight gores, alternately darker and lighter, silver seams, star-cut
//           piercings in its flanks and star glints over it; a high swept comb cut as a crescent moon, its horn trailing
//           behind the head; a silver crescent at the brow, horns up, the comb rising from its hollow; a short upturned
//           peak with a beak; crescent cheek plates hung over the ears; a flared neck guard of two lames. The face open.
//   chest   a slim cuirass cut high to a doublet's point, a silver keel, a starfield of glints, a silver crescent between
//           the shoulder blades; a tall standing collar open at the throat, lined violet; the violet doublet slashed over
//           silver silk (four slashes a sleeve, seven round the tabbed skirt), silver points; the fencing pauldron on the
//           sword arm (the right) with its crescent badge; small elbow cops, vambraces of three lames, black fencing mitts.
//   mantle  the duellist's capelet slung over the left shoulder: navy-black velvet sewn with silver stars, its hem turned
//           up in a broad band of silver-white lining that sweeps from the right shoulder blade down to a long point at
//           the left hip and up over the left shoulder; a silver-grey satin shoulder tier cut in star-tipped points; a
//           constellation of six stars on the back; the crescent brooch with its star at the shoulder.
//   legs    deep indigo hose piped silver down the outer seam; violet garters above the knees tied in bows; blued knee
//           cops, each with a crescent; slim greaves pointed at their foot, a silver ridge, star glints.
//   boots   black riding boots to mid-calf, their cuffs turned down to grey-violet suede and rolled silver; blued toe caps;
//           silver spurs, each with a six-pointed star rowel.
//
// Enchanted, these light and nothing else: the helm's crescents (the comb and the brow), the pauldron's crescent badge,
// the brooch's star and the cape's constellation, the knee crescents, the spurs' rowels.
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, smooth, merge, shell, on, nearestOf } from './metalkit.mjs';
import {
  boneW, mixOf, mixW, shareW, skinW, nearSkinW, skinSamples, limbWrap, along, wrapAngle, plateOn, patch, solid,
  rowPath, colPath, studsAlong, stud, sweep, roundProfile, smoothWeights, coverHides,
} from './platekit.mjs';
import { tube as tubeAll, band as bandAll } from './platekit.mjs';

/** A long trim's path thinned to every other point (its ends kept): a rolled edge or a binding needs no more to read. */
const thin = (path, closed) => (path.length <= 12 ? path : path.filter((_, k) => k % 2 === 0 || (!closed && k === path.length - 1)));
const tube = (path, o) => tubeAll(thin(path, o.closed), o);
const band = (path, o) => bandAll(thin(path, o.closed), o);
import { domeWrap, ellipsoidReach, torsoWrap } from './platekit.mjs';
import { headDome, headW, torsoField, torsoMarks, TORSO_BONES, frameAt, discAt, glint, starfield, starPlate, crescent } from './kit/glimmersteel.mjs';

const PI = Math.PI;

export const GLIMMERSTEEL_MATS = {
  // (the blued steel: a midnight blue-black field, its lighter gores, its lames a shade darker, the shade under an edge,
  // the dark inside of a plate; its rolled edges polished silver-white)
  gl: { c: '#0c0f2a', kind: 3 },
  glA: { c: '#151a40', kind: 3 },
  glM: { c: '#090b20', kind: 3 },
  glS: { c: '#05071a', kind: 3 },
  glD: { c: '#0a0d1e', kind: 3 },
  glL: { c: '#e2e8f8', kind: 3 },
  // (the lesser silver: bindings, points, the brooch's crescent)
  sil: { c: '#a9b3cf', kind: 3 },
  // (the star glints set in the steel)
  star: { c: '#f7f9ff', kind: 3 },
  // (a star-cut piercing: dark through the steel)
  pierce: { c: '#05060e', kind: 2 },
  // (the glow: the comb's crescent, the brooch's star, the cape's constellation, the knee crescents; pale silver-blue
  // plain, lit in the enchantment's colour)
  rune: { c: '#9fb2ea', kind: 3, lit: { c: '#ffe7a6', kind: 1 } },
  // (the doublet: deep violet velvet, a darker shade in its folds; the silk under its slashes silver-white)
  vio: { c: '#6a3aa8', kind: 0 },
  vioD: { c: '#4b2880', kind: 0 },
  silk: { c: '#b4b7da', kind: 0 },
  // (the capelet: midnight velvet, lined in silver-white satin)
  vel: { c: '#0b0d22', kind: 0 },
  velA: { c: '#151938', kind: 0 },
  lin: { c: '#d9dcf0', kind: 0 },
  // (the hose: deep indigo, its waist left out under a chest piece)
  ind: { c: '#1b1946', kind: 0 },
  indD: { c: '#121031', kind: 0 },
  indW: { c: '#1b1947', kind: 0 },
  // (the boots: black leather with a violet cast, the turned-down cuff's suede lining grey-violet, the sole)
  boot: { c: '#1a1626', kind: 2 },
  bootL: { c: '#6a6290', kind: 2 },
  sole: { c: '#0e0c14', kind: 2 },
  satin: { c: '#8e93c8', kind: 0 },
  satinD: { c: '#6d71a6', kind: 0 },
  // (the gloves: black kid with a violet cast)
  glove: { c: '#1c1729', kind: 2 },
  gloveL: { c: '#3a3150', kind: 2 },
};

/* ---- the helm --------------------------------------------------------------------------------------------------- */
/** Points on a circle through three points in a plane (the comb's spine): `at(s)` from the first (s nought) to the third (one). */
function arcThrough(p0, p1, p2) {
  const a = sub(p1, p0), b = sub(p2, p0), n = cross(a, b), nn = dot(n, n);
  const c = add(p0, mul(add(mul(cross(b, n), dot(a, a)), mul(cross(n, a), dot(b, b))), 1 / (2 * nn)));
  const R = len(sub(p0, c)), e0 = unit(sub(p0, c)), e1 = unit(cross(unit(n), e0));
  const ang = (p) => { const v = sub(p, c); return Math.atan2(dot(v, e1), dot(v, e0)); };
  let end = ang(p2);
  if (end < 0) end += 2 * PI;
  return { c, R, at: (s) => { const t = end * s, d = add(mul(e0, Math.cos(t)), mul(e1, Math.sin(t))); return { p: add(c, mul(d, R)), d }; } };
}

/**
 * The moon burgonet: a close skull of eight gores (alternately the field and a lighter blue), star-cut piercings in its
 * flanks and star glints over it, its foot rolled; the comb a crescent moon standing on the skull's middle line from the
 * brow, swelling over the crown and trailing in a horn behind the head, its flanks inlaid with the glow; a short
 * upturned peak drawn to a beak; crescent cheek plates hung over the ears; a neck guard of two flared lames. Rigid on
 * the head; the face open between the cheek plates.
 */
export function glimmersteelHelm(B) {
  const female = B.who === 'female', out = [];
  const H = headDome(B, { fit: female ? 0.1 : 0.13, rise: 0.02 }), D = H.D, c = H.c, E = H.E, bt = H.browTh;
  const w = () => boneW(B, 'head');
  const front = (ph) => Math.abs(wrapAngle(ph));
  // -- the skull: its foot just over the brow before, over the ears at the sides, at the nape behind
  const rimTh = (ph) => { const f = front(ph); return bt - 0.19 + 0.43 * smooth(0.6, 1.4, f) + 0.26 * smooth(1.7, 2.7, f); };
  const NV = 40, NU = 12;
  const skull = plateOn(D, { a0: -PI, a1: PI, closed: true, t0: () => 0, t1: (a) => rimTh(a) / PI, nu: NU, nv: NV, off: () => 0 });
  out.push(solid(skull, { sheet: true, w, mat: (i, j) => (Math.floor(j / (NV / 8)) % 2 ? 'glA' : 'gl') }));
  // (the gores' seams: fine silver ribs from the crown to the foot)
  for (let g = 0; g < 8; g++) { const j = g * (NV / 8); if (j === NV / 2) continue; out.push(tube(colPath(skull, j, 1.2, NU - 0.6, 8), { r: 0.022, k: 3, mat: 'sil', w })); }
  out.push(tube(rowPath(skull, NU, 0, NV, NV), { r: 0.045, k: 4, mat: 'glL', w, closed: true }));
  // (star glints over the skull, clear of the comb; and three star-cut piercings in each flank)
  out.push(...starfield(skull, { i0: 2.5, i1: NU - 1, j0: 0, j1: NV, count: 24, r: [0.05, 0.1], mat: 'star', w, ok: (fi, fj) => Math.abs(fj - NV / 2) > 2.2 && Math.abs(fj) > 0.8 }));
  for (const sg of [1, -1]) for (const [fi, dj, R] of [[6.2, 7.2, 0.1], [8.6, 9.6, 0.085], [5.2, 11.4, 0.075]]) {
    const q = skull.at(fi, NV / 2 + sg * dj);
    out.push(solid(starPlate(add(q.p, mul(q.n, 0.012)), q.n, { R, points: 5, inner: 0.45 }), { sheet: true, w, mat: () => 'pierce' }));
  }
  // -- the comb: a crescent moon standing on the middle line, from over the brow, swelling over the crown, its horn
  // trailing up and back behind the head
  const Hc = female ? 0.42 : 0.44, cw = female ? 0.095 : 0.11;
  const p0 = D.ta((bt - 0.28) / PI, 0).p, p1 = add(c, [0, E[1] + Hc * 0.75, 0.05]), p2 = add(c, [0, E[1] * 0.55 + Hc * 0.55, -E[2] - (female ? 0.5 : 0.42)]);
  const arc = arcThrough(add(p0, [0, -0.06, -0.04]), p1, p2);
  const W0 = female ? 0.5 : 0.52;
  const combW = (s) => W0 * Math.sin(PI * s) ** 0.7 * (0.75 + 0.25 * s);
  const combAt = (s, u) => { const q = arc.at(s), wd = combW(s); return add(q.p, mul(q.d, wd * (u - 0.72))); };
  const NC = 22;
  const comb = patch((u, v) => ({ p: add(combAt(v, u), [cw / 2, 0, 0]), n: [1, 0, 0] }), 2, NC);
  out.push(solid(comb, { w, thick: cw, mat: () => 'gl', inner: 'gl', edge: 'glL' }));
  // (its back rolled bright; its flanks inlaid with the glow along its spine, a crescent within the crescent)
  out.push(tube([...Array(NC + 1).keys()].map((k) => { const s = k / NC; return { p: combAt(s, 1), n: arc.at(s).d }; }), { r: 0.04, k: 4, mat: 'glL', w }));
  for (const sg of [1, -1]) {
    const path = [...Array(17).keys()].map((k) => { const s = 0.1 + (0.86 * k) / 16; return { p: add(combAt(s, 0.62), [sg * (cw / 2 + 0.005), 0, 0]), n: [sg, 0, 0], s }; });
    out.push(sweep(path, { closedProfile: true, w, mat: 'rune', profile: (k, q) => { const h = 0.35 * combW(q.s) * 0.5 + 0.012; return [[-h, -0.01], [h, -0.01], [h, 0.018], [-h, 0.018]]; } }));
  }
  // -- the crescent at the brow, horns up, the comb rising out of its hollow: silver, its inner edge the glow
  {
    const q = D.ta((bt - 0.3) / PI, 0), F = frameAt(add(q.p, mul(q.n, 0.05)), q.n), R = female ? 0.24 : 0.27;
    const Fc = { ...F, c: add(F.c, mul(F.x, R * 0.45)) };
    const cr = crescent(Fc, { R, wide: R * 0.55, inner: 0.7, span: 2.05, dome: 0.035, nu: 2, nv: 16 });
    out.push(solid(cr, { w, thick: 0.035, mat: () => 'sil', inner: 'glS', edge: 'glL' }));
    out.push(tube(rowPath(cr, 2, 0.5, 15.5, 15), { r: 0.032, k: 4, mat: 'glL', w }));
    out.push(tube(rowPath(cr, 0, 1.5, 14.5, 13, 0.005), { r: 0.034, k: 4, mat: 'rune', w }));
  }
  // -- the peak: short and upturned over the eyes, drawn to a beak at the middle, its edge rolled
  const pW = 1.2, pL = female ? 0.3 : 0.36, NP = 18;
  const peak = patch((u, v) => {
    const a = -pW + 2 * pW * v, q = skull.at(NU, ((a + PI) / (2 * PI)) * NV), h = unit([q.p[0] - c[0], 0, q.p[2] - c[2]]);
    const L = pL * Math.cos((a / pW) * (PI / 2)) ** 0.7 * (1 + 0.45 * Math.exp(-((a / 0.22) ** 2)));
    return { p: add(add(q.p, mul(h, L * u - 0.02)), [0, 0.18 * L * u * u - 0.03, 0]), n: unit(add([0, 1, 0], mul(h, 0.3))) };
  }, 3, NP);
  out.push(solid(peak, { w, thick: 0.04, mat: (i) => (i === 0 ? 'glM' : 'gl'), inner: 'glS', edge: 'glS' }));
  out.push(tube(rowPath(peak, 3, 0, NP, NP), { r: 0.038, k: 4, mat: 'glL', w }));
  // -- the cheek plates: hung from the skull's foot over each ear, each a crescent: its front edge cut back round the
  // cheekbone, drawn down to a point at the jaw
  for (const sg of [1, -1]) {
    const NE = 9, NR = 7, drop = female ? 0.62 : 0.72;
    const cp = plateOn(D, {
      a0: sg * 0.92, a1: sg * 1.95,
      t0: (a) => (rimTh(a) - 0.05) / PI,
      t1: (a, v) => (rimTh(a) + drop * (0.22 + 0.78 * Math.sin(PI * (0.1 + 0.75 * v)) ** 1.6)) / PI,
      nu: NR, nv: NE, off: (u) => 0.03 + 0.06 * u,
    });
    out.push(solid(cp, { sheet: true, w, mat: (i, j) => (j === 0 ? 'glM' : 'gl') }));
    out.push(tube([...colPath(cp, 0, 0.5, NR, NR), ...rowPath(cp, NR, 0, NE, NE).slice(1), ...colPath(cp, NE, NR, 0.5, NR).slice(1)], { r: 0.035, k: 4, mat: 'glL', w }));
    const q = cp.at(NR * 0.5, NE * 0.55);
    out.push(glint(q.p, q.n, { r: 0.1, h: 0.05, points: 4, mat: 'star', w }));
  }
  // -- the neck guard: two lames hung from the skull's foot behind, flared out and down
  const gA = 2.05, NG = 18, gDrop = female ? 0.32 : 0.38;
  for (let k = 0; k < 2; k++) {
    const s0 = (gDrop / 2) * k - 0.05, s1 = (gDrop / 2) * (k + 1);
    const lame = patch((u, v) => {
      const a = gA + (2 * PI - 2 * gA) * v, q = skull.at(NU, ((wrapAngle(a) + PI) / (2 * PI)) * NV), h = unit([q.p[0] - c[0], 0, q.p[2] - c[2]]);
      const s = s0 + (s1 - s0) * u, side = smooth(gA, gA + 0.6, a) * smooth(2 * PI - gA, 2 * PI - gA - 0.6, a);
      const d = s * (0.55 + 0.45 * side), o1 = 0.55 * d + 0.5 * d * d;
      return { p: add(add(q.p, mul(h, o1 - 0.025 * k + 0.02)), [0, -d, 0]), n: unit(add(h, [0, 0.5, 0])) };
    }, 2, NG);
    out.push(solid(lame, { hollow: true, w, thick: 0.035, mat: () => (k ? 'glM' : 'gl'), edge: 'glS' }));
    out.push(tube(rowPath(lame, 2, 0, NG, NG), { r: k ? 0.04 : 0.03, k: 4, mat: k ? 'glL' : 'glS', w }));
  }
  const P = merge(...out);
  // (the head's own polygons under it left out: every corner inside the skull, short of its foot)
  const inside = (i) => { const v = sub(B.V[i], c), th = Math.acos(clamp(unit(v)[1], -1, 1)), ph = Math.atan2(v[0], v[2]); return th < rimTh(ph) - 0.12; };
  B.A.polys.forEach(([v], pi) => { if (v.every((i) => inside(i))) P.hides.add(pi); });
  return P;
}

/* ---- chest & arms ------------------------------------------------------------------------------------------------ */
/** How much of a body point's weight is on the head and the jaw themselves. */
const headOnly = (B, i) => headW(B, B.W[i]);
/** The arm's skin samples on side `s`: of the parts given, more than `k` of their weight. */
const armPick = (B, s, parts, k = 0.6) => (q) => (s === 'l' ? q.p[0] > 0.15 : q.p[0] < -0.15) && shareW(B, q.w, ...parts) > k;
/** Weights kept to the bones of one side's arm (and the clavicle). */
const armBones = (s) => (n) => n.endsWith(`_${s}`);
/** A path's points lifted `d` along their normals. */
const lift = (path, d) => path.map((q) => ({ p: add(q.p, mul(q.n, d)), n: q.n }));

/**
 * The doublet: violet velvet over the torso and the arms to the wrists, close over the skin, the skin under it left
 * out.
 */
function doublet(B) {
  const A = B.at, M = torsoMarks(B);
  return shell(B, {
    sub: 0, rim: null,
    keep: (i) => { const p = B.V[i]; return on(B, i, 'torso', 'shoulder', 'upperarm', 'forearm', 'neck', 'head', 'thigh') > 0.6 && headOnly(B, i) < 0.05 && on(B, i, 'hand') < 0.35 && p[1] > M.hip - 0.25 && on(B, i, 'thigh') < 0.5 && p[1] < A.neck[1] - 0.02; },
    off: ({ p }) => 0.06 + 0.03 * smooth(M.waist, M.hip, p[1]) - 0.025 * smooth(A.neck[1] - 0.6, A.neck[1] - 0.1, p[1]),
    mat: () => 'vio',
  });
}

/**
 * The cuirass: a slim breastplate cut high, its waist drawn down to a point before as a doublet's is, a keel down its
 * middle, a starfield of glints over it; a backplate cut straight at the small of the back; both rolled silver at every
 * edge. Under it the doublet's skirt: violet tabs over silver silk round the hips, a silver point at each tab's foot.
 * The standing collar: tall, open at the throat, flared, lined in violet.
 */
function cuirass(B) {
  const A = B.at, M = torsoMarks(B), F = torsoField(B), t = F.tOfY, out = [], female = B.who === 'female';
  const W = nearSkinW(B, (s) => shareW(B, s.w, 'torso') > 0.7, (n) => TORSO_BONES.has(n), 0.35);
  // -- the breastplate: from its pointed waist up to a high neckline, its armholes cut round to the armpit
  const aN = 0.72, side = PI / 2 + 0.04;
  const topF = (a) => {
    const ax = Math.abs(a), yC = M.neckF + 0.18;
    if (ax <= aN) return M.neckF + 0.05 + 0.13 * (ax / aN) ** 2;
    const k = clamp((ax - aN) / (side - aN));
    return M.pit + (yC - M.pit) * Math.sqrt(Math.max(0, 1 - k * k));
  };
  const botF = (a) => M.waist + 0.38 - (female ? 0.5 : 0.62) * Math.exp(-((a / 0.62) ** 2));
  const bulge = (yy, a) => (female ? 0.05 : 0.09) * Math.exp(-(((yy - lerp(A.chest, [0, M.waist, 0], 0.55)[1]) / 0.8) ** 2)) * Math.max(0, Math.cos(a)) ** 1.5;
  const keel = (a) => 0.045 * Math.exp(-((a / 0.2) ** 2));
  const NF = 22, NUF = 12;
  const breast = plateOn(F, { a0: -side, a1: side, t0: (a) => t(botF(a)), t1: (a) => t(topF(a)), nu: NUF, nv: NF, off: (u, v, tt, a) => 0.14 + bulge(F.yOfT(tt), a) + keel(a) + 0.025 * smooth(0.12, 0, u) });
  out.push(solid(breast, { sheet: true, w: W, mat: (i, j) => (j === NF / 2 - 1 || j === NF / 2 ? 'glA' : 'gl') }));
  // -- the backplate: straight across the small of the back, its neckline low and round
  const bN = 0.6, NB = 20, NUB = 11;
  const topB = (a) => {
    const bx = PI - Math.abs(wrapAngle(a)), yC = M.neckB + 0.3;
    if (bx <= bN) return M.neckB + 0.2 + 0.1 * (bx / bN) ** 2;
    const k = clamp((bx - bN) / (PI - side + 0.04 - bN));
    return M.pit + (yC - M.pit) * Math.sqrt(Math.max(0, 1 - k * k));
  };
  const back = plateOn(F, { a0: side - 0.08, a1: 2 * PI - side + 0.08, t0: () => t(M.waist + 0.3), t1: (a) => t(topB(a)), nu: NUB, nv: NB, off: (u) => 0.13 + 0.025 * smooth(0.12, 0, u) });
  out.push(solid(back, { sheet: true, w: W, mat: () => 'gl' }));
  // (rolled silver at every edge; the keel a silver line; the starfield over both)
  out.push(tube(rowPath(breast, NUF, 0, NF, NF), { r: 0.05, k: 4, mat: 'glL', w: W }));
  out.push(tube(rowPath(breast, 0, 0, NF, NF), { r: 0.045, k: 4, mat: 'glL', w: W }));
  out.push(tube(rowPath(back, NUB, 0, NB, NB), { r: 0.045, k: 4, mat: 'glL', w: W }));
  out.push(tube(rowPath(back, 0, 0, NB, NB), { r: 0.045, k: 4, mat: 'glL', w: W }));
  out.push(tube(colPath(breast, NF / 2, 0.6, NUF - 0.8, 10, 0.01), { r: 0.03, k: 3, mat: 'sil', w: W }));
  out.push(band(rowPath(breast, NUF - 0.75, 0, NF, NF), { wide: 0.05, high: 0.012, mat: 'sil', w: W }));
  out.push(band(rowPath(breast, 0.7, 0, NF, NF), { wide: 0.05, high: 0.012, mat: 'sil', w: W }));
  out.push(...starfield(breast, { i0: 0.8, i1: NUF - 1.2, j0: 1, j1: NF - 1, count: 36, r: [0.05, 0.11], mat: 'star', w: W, seed: 3, ok: (fi, fj) => Math.abs(fj - NF / 2) > 1.2 }));
  out.push(...starfield(back, { i0: 0.8, i1: NUB - 1, j0: 1, j1: NB - 1, count: 24, r: [0.05, 0.1], mat: 'star', w: W, seed: 5, ok: (fi, fj) => Math.abs(fj - NB / 2) > 1.6 || fi < NUB - 4.2 }));
  // (on the backplate, high between the shoulder blades, a silver crescent, horns up, a star in its hollow; a silver line down the spine below it)
  { const q = back.at(NUB - 2.4, NB / 2), F = frameAt(add(q.p, mul(q.n, 0.02)), q.n), R = female ? 0.26 : 0.32;
    const cr = crescent({ ...F, c: add(F.c, mul(F.x, R * 0.3)) }, { R, wide: R * 0.55, inner: 0.7, span: 2.05, dome: 0.03, nu: 2, nv: 14 });
    out.push(solid(cr, { sheet: true, w: W, mat: () => 'sil' }));
    out.push(tube(rowPath(cr, 2, 0.5, 13.5, 13), { r: 0.03, k: 4, mat: 'glL', w: W }));
    out.push(glint(add(F.c, mul(F.x, R * 0.5)), q.n, { r: 0.13, h: 0.06, points: 4, mat: 'star', w: W }));
    out.push(tube(colPath(back, NB / 2, 0.6, NUB - 3.4, 8, 0.01), { r: 0.028, k: 3, mat: 'sil', w: W })); }
  // -- the doublet's skirt: a ring of silk, and over it violet tabs with a silver point at each foot, flared over the hips
  const WS = nearSkinW(B, (s) => shareW(B, s.w, 'torso', 'thigh') > 0.8 && s.p[1] < M.waist + 0.6, (n) => TORSO_BONES.has(n) || /^thigh_/.test(n), 0.35);
  const sTop = M.waist + 0.42, sBot = (a) => M.hip - (female ? 0.1 : 0.16) + 0.12 * smooth(1.2, 2.4, Math.abs(wrapAngle(a)));
  const TABS = 7, NS = TABS * 8;
  const offS = (u) => 0.1 + 0.17 * (1 - u) ** 1.3;
  const silkR = plateOn(F, { a0: -PI, a1: PI, closed: true, t0: (a) => t(sBot(a) + 0.04), t1: () => t(sTop), nu: 4, nv: NS, off: (u) => offS(u) - 0.01 });
  out.push(smoothWeights(solid(silkR, { sheet: true, w: WS, mat: () => 'silk' }), 2));
  const tabs = plateOn(F, { a0: -PI, a1: PI, closed: true, t0: (a) => t(sBot(a)), t1: () => t(sTop), nu: 4, nv: NS, off: (u) => offS(u) + 0.02 });
  out.push(smoothWeights(solid(tabs, { sheet: true, w: WS, mat: (i, j) => (j % 8 >= 6 ? null : i === 0 ? 'vioD' : 'vio') }), 2));
  for (let k = 0; k < TABS; k++) { const q = tabs.at(0.15, k * 8 + 3); out.push(glint(add(q.p, mul(q.n, 0.01)), q.n, { r: 0.06, h: 0.05, points: 4, inner: 0.45, mat: 'sil', w: WS })); }
  // -- the standing collar: tall, open at the throat, flared out to its top, lined in violet; silver at its edges
  const n = A.neck[1], wNeck = mixOf(B, [['neck_01', 0.55], ['spine_03', 0.45]]), NCo = 22, gap = 0.42;
  const cTop = (a) => n + (female ? 0.3 : 0.36) - 0.16 * smooth(2.5, 1.9, Math.abs(wrapAngle(a))) - 0.06 * smooth(1.2, 0.4, Math.abs(wrapAngle(a))), cBot = (a) => n - (female ? 0.06 : 0.0) + 0.06 * smooth(1.0, 2.0, Math.abs(wrapAngle(a))) + 0.14 * smooth(1.3, 2.2, Math.abs(wrapAngle(a)));
  // (laid round the neck itself: a wrap of the neck's skin, level, so it stands up from the shoulders rather than lying on them)
  const ny0 = n - 0.1, ny1 = n + 0.4, nt = (yy) => (yy - ny0) / (ny1 - ny0);
  const NK = torsoWrap(B, ny0, ny1, F.zc, { pick: (q) => shareW(B, q.w, 'neck') > 0.3 && headW(B, q.w) < 0.3 && q.p[1] > ny0 - 0.05 && q.p[1] < ny1 + 0.05, nt: 12, na: 32, closed: true, a: [-PI, PI], smooth: 3, shape: (r) => r });
  const collar = plateOn(NK, { a0: gap, a1: 2 * PI - gap, t0: (a) => nt(cBot(a)), t1: (a) => nt(cTop(a)), nu: 4, nv: NCo, level: true, off: (u) => 0.14 + 0.16 * u * u });
  out.push(solid(collar, { w: () => wNeck, thick: 0.035, mat: () => 'gl', inner: 'vio', edge: 'glS' }));
  out.push(tube(rowPath(collar, 4, 0, NCo, NCo), { r: 0.04, k: 4, mat: 'glL', w: () => wNeck }));
  out.push(...starfield(collar, { i0: 0.8, i1: 3.4, j0: 1, j1: NCo - 1, count: 10, r: [0.03, 0.06], mat: 'star', w: () => wNeck, seed: 9 }));
  return out;
}

/**
 * One arm. Both: the sleeve's violet panes slashed over silver silk down the upper arm, a silver point at each pane's
 * foot; a small cop over the elbow; a vambrace of three lames stepped down the forearm, star glints on them; a black kid
 * glove, its cuff flared back over the vambrace's foot. The sword arm (`fencer`, the right) also the fencing pauldron: a
 * cop over the shoulder and two lames below it, starred, rolled silver.
 */
function armOf(B, s, fencer) {
  const A = B.at, sg = s === 'l' ? 1 : -1, sh = A.shoulder[s], el = A.elbow[s], wr = A.wrist[s], out = [], female = B.who === 'female';
  const upDir = unit(sub(el, sh)), foreDir = unit(sub(wr, el)), uaLen = len(sub(el, sh)), faLen = len(sub(wr, el));
  // -- the sleeve's panes: eight round the upper arm, puffed, the silk showing between
  const upPick = armPick(B, s, ['upperarm', 'shoulder']);
  const UA = limbWrap(B, sh, el, sg, { t: [0.0, 0.92], nt: 16, a: [-PI, PI], closed: true, na: 24, pick: upPick, smooth: 3, shape: (r) => r });
  const wUp = skinW(B, (q) => upPick(q) && along(q.p, sh, el) > 0.3 && along(q.p, sh, el) < 0.8, armBones(s));
  const NPn = 4, pt0 = fencer ? 0.42 : 0.22, pt1 = 0.84;
  const under = plateOn(UA, { a0: -PI, a1: PI, closed: true, t0: () => pt0, t1: () => pt1, nu: 3, nv: 16, off: () => 0.075 });
  out.push(solid(under, { sheet: true, w: () => wUp, mat: () => 'silk' }));
  for (let k = 0; k < NPn; k++) {
    const a0 = -PI + (2 * PI * k) / NPn + 0.25 + 0.3, a1 = -PI + (2 * PI * (k + 1)) / NPn - 0.25 + 0.3;
    const pn = plateOn(UA, { a0, a1, t0: () => pt0, t1: () => pt1, nu: 4, nv: 4, off: (u, v) => 0.09 + 0.05 * Math.sin(PI * u) * Math.sin(PI * v) ** 0.5 });
    out.push(solid(pn, { sheet: true, w: () => wUp, mat: (i) => (i === 0 || i === 3 ? 'vioD' : 'vio') }));
    for (const fj of [0, 4]) { const q = pn.at(4, fj); out.push(glint(add(q.p, mul(q.n, 0.01)), q.n, { r: 0.05, h: 0.045, points: 4, inner: 0.45, mat: 'sil', w: () => wUp })); }
  }
  // (a violet band gathering the panes above the elbow, piped silver)
  const gb = plateOn(UA, { a0: -PI, a1: PI, closed: true, t0: () => pt1 - 0.02, t1: () => 0.94, nu: 1, nv: 20, off: () => 0.1 });
  out.push(solid(gb, { sheet: true, w: () => wUp, mat: () => 'vio' }));
  out.push(tube(rowPath(gb, 0, 0, 20, 20), { r: 0.025, k: 3, mat: 'sil', w: () => wUp, closed: true }));
  // (and the welt at the shoulder's seam: a violet roll round the armhole, piped)
  if (!fencer) {
    const welt = plateOn(UA, { a0: -PI, a1: PI, closed: true, t0: () => 0.12, t1: () => pt0 + 0.02, nu: 3, nv: 20, off: (u) => 0.1 + 0.07 * Math.sin(PI * u) });
    out.push(solid(welt, { sheet: true, w: () => wUp, mat: (i) => (i === 1 ? 'vio' : 'vioD') }));
    out.push(tube(rowPath(welt, 3, 0, 20, 20), { r: 0.025, k: 3, mat: 'sil', w: () => wUp, closed: true }));
  }
  // -- the fencing pauldron on the sword arm: two lames down the outside of the upper arm under a cop on the shoulder
  if (fencer) {
    const wSh = mixOf(B, [[`shoulder_${s}`, 0.45], [`upperarm_${s}`, 0.15], [`clavicle_${s}`, 0.4]]);
    for (let k = 0; k < 2; k++) {
      const t0 = 0.2 + 0.1 * k, t1 = t0 + 0.15, off = 0.24 - 0.04 * k;
      const g = plateOn(UA, { a0: PI / 2 - 1.75, a1: PI / 2 + 1.65, t0: () => t0, t1: () => t1, nu: 3, nv: 14, off: () => off });
      out.push(solid(g, { hollow: true, w: () => wSh, thick: 0.035, mat: () => (k ? 'glM' : 'gl'), edge: 'glS' }));
      out.push(tube(rowPath(g, k ? 3 : 0, 0, 14, 14), { r: 0.035, k: 4, mat: k ? 'glL' : 'glS', w: () => wSh }));
      if (k) out.push(...starfield(g, { i0: 0.6, i1: 2.4, j0: 1, j1: 13, count: 5, r: [0.035, 0.06], mat: 'star', w: () => wSh, seed: 21 }));
    }
    const shPick = (q) => q.p[0] * sg > 0.78 * sh[0] * sg && shareW(B, q.w, 'shoulder', 'upperarm', 'torso') > 0.8 && shareW(B, q.w, 'neck', 'head') < 0.1 && len(sub(q.p, sh)) < 1.2 && q.p[1] > sh[1] - 0.9;
    const cc = add(sh, [sg * 0.02, -0.12, 0]), near = skinSamples(B).filter(shPick).map((q) => sub(q.p, cc));
    const ex = Math.max(...near.map((v) => v[0] * sg)), ro = ex + 0.3, E = [ro * 1.05, ro * 0.6, ro * 0.95];
    const D = domeWrap(B, { c: cc, u: unit([sg * 0.42, 0.91, 0]), f: [0, 0, 1], s: [0, 1, 0], pick: shPick, rows: 20, cols: 32, thMax: 2.2, cone: 0.35, smooth: 4, shape: (r, th, ph, d) => Math.max(r + 0.22, ellipsoidReach(E, d)) });
    // (azimuth nought the front, pi/2 up toward the neck, pi the back, -pi/2 down to the armpit; its foot scalloped)
    const reach = (ph) => { const c = Math.cos(ph), sn = Math.sin(ph); return Math.max(0.6, (Math.abs(c) * 1.05 + Math.max(0, sn) * 0.5 + Math.max(0, -sn) * 1.3) / (Math.abs(c) + Math.abs(sn))); };
    const cop = plateOn(D, { a0: -PI, a1: PI, closed: true, t0: () => 0, t1: (a) => reach(a) / 2.2, nu: 7, nv: 24, off: (u) => 0.1 * u * u });
    out.push(solid(cop, { sheet: true, w: () => wSh, mat: (i, j) => (i < 2 ? 'glA' : 'gl') }));
    out.push(tube(rowPath(cop, 7, 0, 24, 24), { r: 0.045, k: 4, mat: 'glL', w: () => wSh, closed: true }));
    out.push(tube(rowPath(cop, 5.8, 0, 24, 24), { r: 0.025, k: 3, mat: 'sil', w: () => wSh, closed: true }));
    out.push(...starfield(cop, { i0: 1.5, i1: 5.3, j0: 0, j1: 24, count: 12, r: [0.035, 0.075], mat: 'star', w: () => wSh, seed: 13, ok: (fi, fj) => fi > 4 || Math.abs(fj - 1) > 3.5 }));
    // (a crescent on the cop's face, horns up, in the glow, a star glint in its hollow)
    { const q = cop.at(2.4, 1), F = frameAt(add(q.p, mul(q.n, 0.02)), q.n), R = female ? 0.2 : 0.24;
      const cr = crescent({ ...F, c: add(F.c, mul(F.x, R * 0.3)) }, { R, wide: R * 0.5, inner: 0.7, span: 2.0, dome: 0.03, nu: 2, nv: 12 });
      out.push(solid(cr, { sheet: true, w: () => wSh, mat: () => 'rune' }));
      out.push(tube(rowPath(cr, 2, 0.5, 11.5, 11), { r: 0.025, k: 4, mat: 'glL', w: () => wSh }));
      out.push(glint(add(F.c, mul(F.x, R * 0.45)), q.n, { r: 0.1, h: 0.06, points: 4, mat: 'star', w: () => wSh })); }
  }
  // -- the elbow's cop: a small cup over its point, rolled silver
  const c0 = sub(el, mul(upDir, uaLen * 0.2)), c1 = add(el, mul(foreDir, faLen * 0.2));
  const elPick = (q) => armPick(B, s, ['upperarm', 'forearm'], 0.6)(q) && len(sub(q.p, el)) < 0.9;
  const EL = limbWrap(B, c0, c1, sg, { t: [0, 1], nt: 10, a: [-PI, PI], closed: true, na: 24, pick: elPick, smooth: 3, shape: (r) => r });
  const wEl = boneW(B, `elbow_${s}`);
  const cup = plateOn(EL, { a0: 1.2, a1: 2 * PI - 1.2, t0: () => 0.1, t1: () => 0.9, nu: 6, nv: 12, off: (u, v) => 0.16 + 0.07 * Math.sin(PI * u) * Math.sin(PI * v) });
  out.push(solid(cup, { sheet: true, w: () => wEl, mat: () => 'gl' }));
  out.push(tube([...rowPath(cup, 0, 0, 12, 12), ...colPath(cup, 12, 0, 6, 6).slice(1), ...rowPath(cup, 6, 12, 0, 12).slice(1), ...colPath(cup, 0, 6, 0, 6).slice(1, -1)], { r: 0.03, k: 4, mat: 'glL', w: () => wEl, closed: true }));
  { const q = cup.at(3, 6); out.push(glint(q.p, q.n, { r: 0.09, h: 0.05, points: 4, mat: 'star', w: () => wEl })); }
  // -- the vambrace: three lames stepped down the forearm, each lapped over the next
  const faPick = armPick(B, s, ['forearm'], 0.6);
  const FA = limbWrap(B, el, wr, sg, { t: [0, 1.0], nt: 14, a: [-PI, PI], closed: true, na: 22, pick: faPick, smooth: 3, shape: (r) => r });
  const wFa = skinW(B, (q) => faPick(q) && along(q.p, el, wr) > 0.25 && along(q.p, el, wr) < 0.85, armBones(s));
  for (let k = 0; k < 3; k++) {
    const t0 = 0.24 + 0.15 * k, t1 = t0 + 0.19, off = 0.1 + 0.012 * k;
    const g = plateOn(FA, { a0: -PI, a1: PI, closed: true, t0: () => t0, t1: () => t1, nu: 2, nv: 18, off: (u) => off + 0.02 * u });
    out.push(solid(g, { hollow: true, w: () => wFa, thick: 0.03, mat: () => (k === 1 ? 'glA' : 'gl'), edge: 'glS' }));
    out.push(tube(rowPath(g, 2, 0, 18, 18), { r: 0.03, k: 4, mat: 'glL', w: () => wFa, closed: true }));
    out.push(...starfield(g, { i0: 0.4, i1: 1.6, j0: 0, j1: 18, count: 4, r: [0.03, 0.055], mat: 'star', w: () => wFa, seed: 31 + k }));
  }
  // -- the glove: black kid over the hand, its cuff flared back over the vambrace's foot, edged silver
  const wWr = mixOf(B, [[`hand_${s}`, 0.5], [`wrist_${s}`, 0.25], [`lowerarm_${s}`, 0.25]]);
  const cuff = plateOn(FA, { a0: -PI, a1: PI, closed: true, t0: () => 0.99, t1: () => 0.7, nu: 3, nv: 18, off: (u) => 0.07 + 0.1 * u ** 1.4 });
  out.push(solid(cuff, { w: () => wWr, thick: 0.03, mat: () => 'glove', inner: 'gloveL', edge: 'glove' }));
  out.push(tube(rowPath(cuff, 3, 0, 18, 18), { r: 0.03, k: 4, mat: 'sil', w: () => wWr, closed: true }));
  { const q = cuff.at(1.8, 9 + sg * 4.5); out.push(glint(add(q.p, mul(q.n, 0.01)), q.n, { r: 0.08, h: 0.05, points: 4, mat: 'star', w: () => wWr })); }
  void female;
  return out;
}
/** How much of a body point's weight is on the fingers' and the thumb's bones. */
const fingerW = (B, i) => B.W[i].reduce((t, [b, x]) => t + (/^(fingers|thumb)/.test(B.bones[b].name) ? x : 0), 0);
/** The gloves' kid over the backs and the palms of both hands to the knuckles, close over the skin (the fingers bare: a fencing mitt). */
function gloves(B) {
  return shell(B, {
    sub: 0, rim: null,
    keep: (i) => on(B, i, 'hand', 'forearm') > 0.6 && fingerW(B, i) < 0.15 && (on(B, i, 'hand') > 0.3 || along(B.V[i], B.at.elbow[B.side(i)], B.at.wrist[B.side(i)]) > 0.9),
    off: () => 0.03,
    mat: ({ bv }) => (on(B, bv, 'hand') > 0.5 ? 'glove' : 'glove'),
  });
}

export function glimmersteelChest(B) {
  return coverHides(B, merge(smoothWeights(doublet(B), 2, (p) => p[1] < B.at.neck[1] - 0.6), gloves(B), ...cuirass(B), ...armOf(B, 'l', false), ...armOf(B, 'r', true)), 0.5);
}

/* ---- the mantle: the duellist's capelet ---------------------------------------------------------------------------- */
const mix1 = (a, b, t) => a + (b - a) * t;
/**
 * The duellist's capelet, slung over the left shoulder (the sword arm's pauldron is the right's): midnight velvet lined
 * in silver-white satin, short over the arm and before, falling across the back to a long point behind the left hip and
 * cut on the slant up to the right shoulder blade; its hem scalloped, a steel star at each point, its slanted edge
 * turned back to show the lining. Over it a shoulder tier of silver-grey satin, its hem cut in points, each tipped with a
 * star, bound in velvet. On its back a constellation in the glow: six stars joined by lines. Its front edge turned back to
 * show the lining, pinned at the shoulder by the brooch: a silver crescent with a star in its hollow, in the glow.
 */
export function glimmersteelMantle(B) {
  const A = B.at, M = torsoMarks(B), out = [], female = B.who === 'female', n = A.neck[1];
  // -- what it hangs over: the cuirass, the arms' pieces and the skin, from the waist up (the collar left out: it stands inside)
  const legW = (w) => w.some(([b, x]) => x > 0.2 && /(thigh|calf)/.test(B.bones[b].name));
  const lowArm = (w) => w.some(([b, x]) => x > 0.3 && /(lowerarm|elbow|hand|wrist)/.test(B.bones[b].name));
  const neckW = (w) => w.some(([b, x]) => x > 0.5 && B.bones[b].name === 'neck_01');
  const pts = [];
  for (const P of [...cuirass(B), ...armOf(B, 'l', false), ...armOf(B, 'r', true)]) P.V.forEach((p, i) => { if (!lowArm(P.W[i]) && !legW(P.W[i]) && !neckW(P.W[i]) && p[1] > M.waist - 0.6) pts.push(p); });
  for (const q of skinSamples(B)) if (shareW(B, q.w, 'torso', 'neck', 'shoulder', 'upperarm') > 0.8 && headW(B, q.w) < 0.15 && q.p[1] > M.waist - 0.6 && q.p[1] < n) pts.push(q.p);
  const zc = torsoField(B).zc;
  // (and the seat and the backs of the thighs, which the long point falls past)
  for (const q of skinSamples(B)) if (shareW(B, q.w, 'torso', 'thigh') > 0.8 && q.p[1] > M.hip - 1.0 && q.p[1] <= M.waist - 0.6 && q.p[2] < zc(q.p[1]) - 0.1) pts.push(q.p);
  const cy0 = M.hip - 0.75, cy1 = n + 0.2, ct = (yy) => (yy - cy0) / (cy1 - cy0);
  const C = torsoWrap(B, cy0, cy1, zc, {
    points: pts, nt: 60, na: 64, closed: true, a: [-PI, PI], smooth: 3, minDa: 0.1, empty: 0.3,
    // (hung: no nearer the middle than anything above it, as cloth falls)
    post: (R) => { for (let j = 0; j < R[0].length; j++) for (let i = R.length - 2; i >= 0; i--) R[i][j] = Math.max(R[i][j], R[i + 1][j]); },
    shape: (r) => r + 0.1,
  });
  // -- its outline: from the brooch before the left shoulder, over it, across the back to the right shoulder blade
  const aF = female ? 1.05 : 1.0, aB = PI + 1.0, yTop = n - 0.12;
  const hemFront = M.pit + (female ? 0.95 : 0.7), hemSide = A.shoulder.l[1] - (female ? 0.12 : 0.34), hemDeep = M.hip - (female ? 0.4 : 0.55), hemEnd = yTop - (female ? 0.95 : 1.1);
  const hemBase = (a) => {
    if (a < PI / 2) return mix1(hemFront, hemSide, smooth(aF, PI / 2, a));
    if (a < 2.55) return mix1(hemSide, hemDeep, smooth(2.2, 2.55, a));
    return mix1(hemDeep, hemEnd, clamp((a - 2.55) / (aB - 2.55)) ** 0.9);
  };
  const NSC = 11, scal = (a) => { const f = ((a - aF) / (aB - aF)) * NSC; return Math.abs(2 * (f - Math.floor(f)) - 1); };
  const yBot = (a) => hemBase(a) - 0.12 * scal(a) ** 2;
  // (folds fanning down the back from the left shoulder, deeper toward the hem)
  const foldA0 = 2.0, ridges = 5;
  const fold = (u, a) => 0.14 * (0.5 - 0.5 * Math.cos((2 * PI * ridges * (a - foldA0)) / (aB - foldA0))) * smooth(foldA0, foldA0 + 0.35, a) * (1 - smooth(aB - 0.3, aB, a)) * (1 - u) ** 0.8;
  const NU = 10, NV = 48;
  // (flared out behind as it falls, so it stands clear of the back and the seat)
  const flare = (u, a) => (female ? 0.24 : 0.3) * (1 - u) ** 1.5 * smooth(1.9, 2.4, a);
  const cape = plateOn(C, { a0: aF, a1: aB, t0: (a) => ct(yBot(a)), t1: () => ct(yTop), nu: NU, nv: NV, off: (u, v, tt, a) => fold(u, a) + flare(u, a) + 0.07 * u * u + (female ? 0.17 : 0.1) * Math.exp(-(((a - PI / 2) / 0.9) ** 2)) });
  const F = torsoField(B), W = nearSkinW(B, (q) => shareW(B, q.w, 'torso', 'neck') > 0.85 && headW(B, q.w) < 0.2 && q.p[1] > M.pit - 0.6, (nm) => ['spine_03', 'spine_02', 'spine_01', 'neck_01', 'clavicle_l', 'clavicle_r'].includes(nm), 0.35);
  void F;
  const shL = mixOf(B, [['shoulder_l', 0.35], ['upperarm_l', 0.15], ['clavicle_l', 0.5]]);
  const wCape = (p) => { const k = smooth(0.9, 1.8, p[0]) * smooth(-1.5, -0.6, p[2] - zc(p[1])) * smooth(M.pit - 0.4, M.pit + 0.5, p[1]); return mixW([[W(p), 1 - k], [shL, k]]); };
  const capeP = smoothWeights(solid(cape, { w: (p) => wCape(p), thick: 0.016, mat: () => 'vel', inner: 'lin', edge: 'lin' }), 14);
  out.push(capeP);
  const onCape = (p) => capeP.W[nearestOf(capeP.V, p)];
  const wOn = (p) => onCape(p);
  const capeAt = (yy, a) => { const t0 = ct(yBot(a)), t1 = ct(yTop); return cape.at(((ct(yy) - t0) / (t1 - t0)) * NU, ((a - aF) / (aB - aF)) * NV); };
  // (the top edge rolled; the hem bound in silver, a steel star at each scallop's point)
  out.push(tube(rowPath(cape, NU, 0, NV, NV / 2), { r: 0.045, k: 4, mat: 'velA', w: wOn }));
  out.push(band(rowPath(cape, 0, 0, NV, NV * 2), { wide: 0.07, high: 0.02, mat: 'sil', w: wOn }));
  // (the lining turned up along the whole hem, a pale border that draws the cape's slant)
  const bandW = female ? 0.4 : 0.48, bandRows = (v) => { const a = aF + (aB - aF) * v; return Math.min(NU * 0.55, (bandW * NU) / (yTop - yBot(a))); };
  const revH = patch((u, v) => { const q = cape.at(u * bandRows(v), v * NV); return { p: add(q.p, mul(q.n, 0.022)), n: q.n }; }, 2, NV);
  out.push(solid(revH, { sheet: true, w: wOn, mat: () => 'lin' }));
  out.push(tubeAll(rowPath(revH, 2, 0, NV, NV, 0.01), { r: 0.028, k: 3, mat: 'sil', w: wOn }));
  for (let k = 1; k < NSC; k++) {
    const a = aF + ((aB - aF) * k) / NSC, q = capeAt(yBot(a) + Math.min(bandW + 0.14, 0.62 * (yTop - yBot(a))), a);
    out.push(glint(add(q.p, mul(q.n, 0.015)), q.n, { r: female ? 0.09 : 0.1, h: 0.05, points: 5, inner: 0.45, mat: 'glL', w: wOn }));
  }
  // (silver sequin stars scattered over the velvet)
  out.push(...starfield(cape, { i0: 1.1, i1: NU - 0.8, j0: 0.8, j1: NV - 0.8, count: 80, r: [0.05, 0.12], mat: 'star', w: wOn, lift: 0.012, seed: 41 }));
  // (the front edge turned back, the lining showing, piped silver)
  const revers = patch((u, v) => { const q = cape.at(u * NU, v * 5 * (1 - u) ** 0.5 + 0.02); return { p: add(q.p, mul(q.n, 0.03 + 0.05 * (1 - v))), n: q.n }; }, 8, 3);
  out.push(solid(revers, { sheet: true, w: wOn, mat: () => 'lin' }));
  out.push(tube(colPath(revers, 3, 0, 8, 8), { r: 0.03, k: 4, mat: 'sil', w: wOn }));
  // (and the slanted edge across the back turned back the same, wider toward the hem)
  const revB = patch((u, v) => { const q = cape.at(u * NU, NV - v * 3.5 * (1 - u) ** 0.5 - 0.02); return { p: add(q.p, mul(q.n, 0.03 + 0.05 * (1 - v))), n: q.n }; }, 8, 3);
  out.push(solid(revB, { sheet: true, w: wOn, mat: () => 'lin' }));
  out.push(tube(colPath(revB, 3, 0, 8, 8), { r: 0.03, k: 4, mat: 'sil', w: wOn }));
  // -- the shoulder tier: its hem cut in points, each tipped with a star, bound in silver
  const tA0 = aF + 0.12, tA1 = aB - 0.08, NP = 7, tL = female ? 0.48 : 0.56;
  const vand = (a) => { const f = ((a - tA0) / (tA1 - tA0)) * NP; return 1 - Math.abs(2 * (f - Math.floor(f)) - 1); };
  const tierBot = (a) => Math.max(yBot(a) + 0.3, yTop - tL - 0.26 * vand(a));
  const NT = NP * 4;
  const tier = plateOn(C, { a0: tA0, a1: tA1, t0: (a) => ct(tierBot(a)), t1: () => ct(yTop - 0.02), nu: 4, nv: NT, off: (u, v, tt, a) => 0.05 + 0.05 * (1 - u) + 0.4 * fold(0, a) * (1 - u) + flare(1 - 0.3 * (1 - u), a) + 0.07 });
  out.push(solid(tier, { w: wOn, thick: 0.016, mat: (i) => (i === 0 ? 'satinD' : 'satin'), inner: 'lin', edge: 'lin' }));
  out.push(band(rowPath(tier, 0, 0, NT, NT), { wide: 0.08, high: 0.02, mat: 'velA', w: wOn }));
  out.push(tube(rowPath(tier, 4, 0, NT, NT / 2), { r: 0.045, k: 4, mat: 'velA', w: wOn }));
  for (let k = 0; k < NP; k++) { const q = tier.at(0.15, (k + 0.5) * 4); out.push(glint(add(q.p, mul(q.n, 0.015)), q.n, { r: female ? 0.075 : 0.085, h: 0.045, points: 5, inner: 0.45, mat: 'glL', w: wOn })); }
  // -- the constellation on the back: five stars in a broken line down the back and a sixth off it, joined
  {
    const ac = PI + 0.12, yTopC = yTop - tL - 0.4, yTip = hemBase(ac) + 0.35, L = yTopC - yTip, gw = 0.36;
    const S = [[yTopC, ac + 0.3, 0.12], [yTopC - 0.24 * L, ac - 0.05, 0.15], [yTopC - 0.45 * L, ac + 0.22, 0.1], [yTopC - 0.7 * L, ac - 0.12, 0.13], [yTip, ac + 0.1, 0.11], [yTopC - 0.5 * L, ac - gw * 1.3, 0.09]];
    const lines = [[0, 1], [1, 2], [2, 3], [3, 4], [3, 5]];
    for (const [yy, a, R] of S) {
      const q = capeAt(yy, a);
      out.push(solid(starPlate(add(q.p, mul(q.n, 0.03)), q.n, { R: R * (female ? 0.9 : 1), points: 5, inner: 0.42, dome: 0.02 }), { sheet: true, w: wOn, mat: () => 'rune' }));
    }
    for (const [i, j] of lines) {
      const path = [...Array(7).keys()].map((k) => { const f = k / 6, q = capeAt(mix1(S[i][0], S[j][0], f), mix1(S[i][1], S[j][1], f)); return { p: add(q.p, mul(q.n, 0.02)), n: q.n }; });
      out.push(band(path, { wide: 0.04, high: 0.012, mat: 'rune', w: wOn }));
    }
  }
  // -- the brooch at the left shoulder's front: a silver crescent, horns up, a star in its hollow in the glow
  {
    const bq = tier.at(2.6, 0.6), bo = unit(add(bq.n, [0, 0.25, 0.9])), Fb = frameAt(add(bq.p, mul(bo, 0.05)), bo);
    const R = female ? 0.42 : 0.55, wB = () => onCape(bq.p);
    const cr = crescent({ ...Fb, c: add(Fb.c, mul(Fb.x, R * 0.25)) }, { R, wide: R * 0.62, inner: 0.7, span: 2.15, dome: 0.05, nu: 2, nv: 16 });
    out.push(solid(cr, { w: wB, thick: 0.04, mat: () => 'sil', inner: 'glS', edge: 'glL' }));
    out.push(tube(rowPath(cr, 2, 0.5, 15.5, 15), { r: 0.035, k: 4, mat: 'glL', w: wB }));
    const sc = add(Fb.c, add(mul(Fb.x, R * 0.42), mul(bo, 0.04)));
    out.push(solid(starPlate(sc, bo, { R: R * 0.62, points: 5, inner: 0.42, dome: 0.06, rings: 2 }), { w: wB, thick: 0.03, mat: () => 'rune', inner: 'glS', edge: 'sil' }));
    out.push(stud(add(sc, mul(bo, 0.06)), bo, { r: 0.06, h: 0.05, k: 5, mat: 'glL', w: wB }));
  }
  return coverHides(B, merge(...out), 0.6);
}

/* ---- legs: the hose ------------------------------------------------------------------------------------------------ */
/** The thigh's weights, its skin's averaged (side `s`). */
const thighW = (B, s) => { const hp = B.at.hip[s], kn = B.at.knee[s], sg = s === 'l' ? 1 : -1; return skinW(B, (q) => q.p[0] * sg > 0.1 && shareW(B, q.w, 'thigh') > 0.6 && along(q.p, hp, kn) > 0.25 && along(q.p, hp, kn) < 0.8, (nm) => nm.endsWith(`_${s}`)); };
/** The hose: deep indigo over the hips and the legs to the ankles, close over the skin; its waist (`indW`) left out under any chest piece. */
function hose(B) {
  const A = B.at, M = torsoMarks(B);
  return shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'thigh', 'calf', 'torso') > 0.6 && on(B, i, 'foot') < 0.5 && on(B, i, 'upperarm', 'forearm', 'hand', 'shoulder') < 0.05 && p[1] < M.waist + 0.25 && p[1] > A.ankle[s][1] - 0.05; },
    off: ({ p }) => 0.035 + 0.025 * smooth(M.hip - 0.6, M.hip + 0.1, p[1]) * smooth(0.3, 0.55, Math.abs(p[0])),
    mat: ({ p }) => (p[1] > M.hip + 0.05 ? 'indW' : 'ind'),
  });
}
/**
 * One leg: silver piping down the hose's outer seam to the ankle; the knee cop, a
 * small blued dome with a crescent on it in the glow; a slim greave down the shin's front from the knee, its foot drawn
 * to a point, a ridge down it, star glints set in it.
 */
function legOf(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, hp = A.hip[s], kn = A.knee[s], an = A.ankle[s], out = [], female = B.who === 'female';
  const legBones = (nm) => nm.endsWith(`_${s}`);
  const thPick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'thigh') > 0.6;
  const TH = limbWrap(B, hp, kn, sg, { t: [0, 1.05], nt: 21, a: [-PI, PI], closed: true, na: 28, pick: thPick, smooth: 4, shape: (r) => r });
  const wTh = thighW(B, s);
  // -- the outer seam piped silver, from the hip to the knee
  out.push(tube(colPath(TH, ((PI / 2 + PI) / (2 * PI)) * 28, 0.12 * 20, 0.93 * 20, 10, 0.045), { r: 0.028, k: 3, mat: 'sil', w: () => wTh }));
  // -- the garter above the knee: a violet ribbon round the leg, edged silver, tied in a bow on the outside
  {
    const gt = 0.8, NGt = 20;
    const gar = plateOn(TH, { a0: -PI, a1: PI, closed: true, t0: () => gt - 0.035, t1: () => gt + 0.035, nu: 1, nv: NGt, off: () => 0.07 });
    out.push(solid(gar, { sheet: true, w: () => wTh, mat: () => 'vio' }));
    out.push(tube(rowPath(gar, 0, 0, NGt, NGt), { r: 0.02, k: 3, mat: 'sil', w: () => wTh, closed: true }));
    out.push(tube(rowPath(gar, 1, 0, NGt, NGt), { r: 0.02, k: 3, mat: 'sil', w: () => wTh, closed: true }));
    const q = TH.ta(gt, PI / 2 + 0.15), Fb = frameAt(add(q.p, mul(q.n, 0.1)), q.n, sub(hp, kn)), L = female ? 0.15 : 0.18;
    for (const sd of [1, -1]) {
      const loop = [0, 0.25, 0.5, 0.75, 1].map((f) => { const a = f * 2 * PI; return { p: add(Fb.c, add(mul(Fb.y, sd * L * (0.5 - 0.5 * Math.cos(a))), add(mul(Fb.x, 0.07 * Math.sin(a)), mul(Fb.o, 0.02 * Math.sin(PI * f))))), n: Fb.o }; });
      out.push(sweep(loop, { closedProfile: true, profile: [[-0.035, -0.012], [0.035, -0.012], [0.035, 0.012], [-0.035, 0.012]], mat: 'vio', w: () => wTh }));
      out.push(sweep([{ p: Fb.c, n: Fb.o }, { p: add(Fb.c, add(mul(Fb.x, -0.26), mul(Fb.y, sd * 0.06))), n: Fb.o }], { closedProfile: true, profile: [[-0.03, -0.01], [0.03, -0.01], [0.03, 0.01], [-0.03, 0.01]], mat: 'vioD', w: () => wTh }));
    }
    out.push(glint(add(Fb.c, mul(Fb.o, 0.02)), Fb.o, { r: 0.06, h: 0.04, points: 4, inner: 0.45, mat: 'sil', w: () => wTh }));
  }
  // -- the knee cop: a small blued dome over the kneecap, rolled silver; on it a crescent, horns up, in the glow
  const kPick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'thigh', 'calf') > 0.8 && len(sub(q.p, kn)) < 0.9;
  const k0 = lerp(hp, kn, 0.84), k1 = lerp(kn, an, 0.14);
  const KN = limbWrap(B, k0, k1, sg, { t: [0, 1], nt: 10, a: [-PI, PI], closed: true, na: 28, pick: kPick, smooth: 4, shape: (r) => r });
  const wKn = boneW(B, `knee_${s}`);
  const ov = (a) => Math.sqrt(Math.max(0, 1 - (a / 1.3) ** 2));
  const cop = plateOn(KN, { a0: -1.28, a1: 1.28, t0: (a) => 0.5 - 0.5 * ov(a) ** 0.6, t1: (a) => 0.5 + 0.5 * ov(a) ** 0.6, nu: 7, nv: 12, off: (u, v) => 0.1 + 0.14 * Math.sin(PI * u) ** 0.7 * Math.sin(PI * v) ** 0.7 });
  out.push(solid(cop, { sheet: true, w: () => wKn, mat: () => 'gl' }));
  out.push(tube([...rowPath(cop, 0, 0, 12, 12), ...rowPath(cop, 7, 12, 0, 12).slice(1, -1)], { r: 0.035, k: 4, mat: 'glL', w: () => wKn, closed: true }));
  {
    const q = cop.at(3.5, 6), F = frameAt(add(q.p, mul(q.n, 0.02)), q.n, sub(hp, an)), R = female ? 0.24 : 0.28;
    const cr = crescent({ ...F, c: add(F.c, mul(F.x, R * 0.3)) }, { R, wide: R * 0.6, inner: 0.7, span: 2.1, dome: 0.03, nu: 2, nv: 12 });
    out.push(solid(cr, { sheet: true, w: () => wKn, mat: () => 'rune' }));
    out.push(tube(rowPath(cr, 2, 0.5, 11.5, 11), { r: 0.025, k: 4, mat: 'glL', w: () => wKn }));
    out.push(glint(add(F.c, mul(F.x, R * 0.5)), q.n, { r: 0.08, h: 0.05, points: 4, mat: 'star', w: () => wKn }));
  }
  // -- the greave: a slim plate down the shin's front, its foot drawn to a point, a ridge down its middle
  const cPick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'calf') > 0.6;
  const SH = limbWrap(B, kn, an, sg, { t: [0, 1.02], nt: 20, a: [-PI, PI], closed: true, na: 26, pick: cPick, smooth: 4, shape: (r) => r });
  const wCa = skinW(B, (q) => cPick(q) && along(q.p, kn, an) > 0.2 && along(q.p, kn, an) < 0.8, legBones);
  const ridge = (a) => 0.04 * Math.exp(-((a / 0.22) ** 2));
  const NG = 12, gA = 1.35;
  const gr = plateOn(SH, { a0: -gA, a1: gA, t0: (a) => 0.36 + 0.06 * Math.max(0, 1 - Math.abs(a) / gA) ** 1.5, t1: () => 0.15, nu: 7, nv: NG, off: (u, v, t, a) => 0.1 + ridge(a) + 0.02 * smooth(0.25, 0.17, t) });
  out.push(solid(gr, { sheet: true, w: () => wCa, mat: (i, j) => (j === NG / 2 - 1 || j === NG / 2 ? 'glA' : 'gl') }));
  out.push(tube([...colPath(gr, 0, 7, 0, 7), ...rowPath(gr, 0, 0, NG, NG).slice(1), ...colPath(gr, NG, 0, 7, 7).slice(1)], { r: 0.032, k: 4, mat: 'glL', w: () => wCa }));
  out.push(tube(rowPath(gr, 7, 0, NG, NG), { r: 0.035, k: 4, mat: 'glL', w: () => wCa }));
  out.push(tube(colPath(gr, NG / 2, 2.2, 6.6, 5, 0.01), { r: 0.025, k: 3, mat: 'sil', w: () => wCa }));
  out.push(...starfield(gr, { i0: 0.8, i1: 6.4, j0: 0.8, j1: NG - 0.8, count: 9, r: [0.04, 0.08], mat: 'star', w: () => wCa, seed: 51 + sg, ok: (fi, fj) => Math.abs(fj - NG / 2) > 0.9 }));
  // (the hose's seam piped on down the calf's outside)
  out.push(tube(colPath(SH, ((PI / 2 + PI) / (2 * PI)) * 26, 0.2 * 20, 0.4 * 20, 4, 0.045), { r: 0.025, k: 3, mat: 'sil', w: () => wCa }));
  return out;
}
export function glimmersteelLegs(B) {
  return { P: merge(smoothWeights(hose(B), 3, (p) => p[1] > B.at.knee.l[1] + 0.6), ...legOf(B, 'l'), ...legOf(B, 'r')), dropAt: (f) => f.mat === 'indW' };
}

/* ---- boots: tall riding boots ---------------------------------------------------------------------------------------- */
/** The boot's leather over the foot and the ankle, close over the skin, on a heeled sole; stood on. */
function bootShoe(B) {
  const A = B.at;
  const P = shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'foot', 'calf') > 0.6 && p[1] < A.ankle[s][1] + 0.4; },
    off: ({ n }) => 0.04 + (n[1] < -0.6 ? 0.07 : 0),
    mat: ({ n }) => (n[1] < -0.55 ? 'sole' : 'boot'),
  });
  P.soles = P.V.map((_, i) => i).filter((i) => P.V[i][1] < A.floor + 0.12);
  return P;
}
/**
 * One boot: the shaft fitted up the calf to below the knee, its top turned down in a deep cuff showing the grey-violet
 * suede, rolled silver; a blued steel cap over the toe, rolled silver; the spur: a silver strap round the ankle and over
 * the instep, a shank out behind the heel, a six-pointed star rowel on it.
 */
function bootOf(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, kn = A.knee[s], an = A.ankle[s], ball = A.ball[s], out = [], female = B.who === 'female';
  const legBones = (nm) => nm.endsWith(`_${s}`);
  // -- the shaft: closed round the calf from the ankle to below the knee, its top turned down in a cuff
  const cPick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'calf', 'foot') > 0.6;
  const SH = limbWrap(B, kn, an, sg, { t: [0.25, 1.1], nt: 17, a: [-PI, PI], closed: true, na: 22, pick: cPick, smooth: 4, shape: (r) => r });
  const wCa = skinW(B, (q) => cPick(q) && along(q.p, kn, an) > 0.35 && along(q.p, kn, an) < 0.9, legBones);
  const wAn = mixOf(B, [[`foot_${s}`, 0.5], [`calf_${s}`, 0.5]]);
  const wSh = (p) => { const f = clamp((along(p, kn, an) - 0.78) / 0.3); return mixW([[wCa, 1 - f], [wAn, f]]); };
  const NS = 22;
  const shaft = plateOn(SH, { a0: -PI, a1: PI, closed: true, t0: () => 1.06, t1: () => 0.44, nu: 9, nv: NS, off: (u) => 0.06 + 0.03 * u });
  out.push(solid(shaft, { sheet: true, w: wSh, mat: () => 'boot' }));
  // (the cuff: turned down from the top, flared, its suede showing; its top and its foot rolled)
  const cuff = plateOn(SH, { a0: -PI, a1: PI, closed: true, t0: () => 0.56, t1: () => 0.42, nu: 3, nv: NS, off: (u, v, t, a) => 0.12 + 0.12 * u ** 1.2 - 0.06 * Math.max(0, -Math.sin(a)) * u });
  out.push(solid(cuff, { w: wSh, thick: 0.03, mat: () => 'bootL', inner: 'boot', edge: 'boot' }));
  out.push(tube(rowPath(cuff, 3, 0, NS, NS), { r: 0.035, k: 4, mat: 'glL', w: wSh, closed: true }));
  // (a silver star on the cuff's outside)
  { const q = cuff.at(1.6, ((PI / 2 + PI) / (2 * PI)) * NS); out.push(glint(add(q.p, mul(q.n, 0.01)), q.n, { r: female ? 0.1 : 0.12, h: 0.05, points: 5, inner: 0.45, mat: 'glL', w: wSh })); }
  // -- the foot: a wrap from the ankle's front to past the toes
  const fPick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'foot') > 0.6;
  const toes = skinSamples(B).filter(fPick);
  const tip = toes.reduce((b, q) => (q.p[2] > b[2] ? q.p : b), [0, 0, -9]);
  const from = [an[0], an[1] - 0.05, an[2] + 0.05], to = [tip[0], A.floor + 0.2, tip[2] + 0.06];
  const tBall = along(ball, from, to);
  const FT = limbWrap(B, from, to, sg, { front: [0, 1, 0], t: [0, 1.0], nt: 20, a: [-PI, PI], closed: true, na: 24, pick: fPick, smooth: 4, shape: (r, t) => r * (t > 0.9 ? Math.max(0.55, 1 - (t - 0.9) * 4.5) : 1) });
  const wFoot = boneW(B, `foot_${s}`), wBall = boneW(B, `ball_${s}`);
  // -- the toe cap: blued steel from the ball forward, its edge rolled, a star glint on it
  const cap = plateOn(FT, { a0: -1.35, a1: 1.35, t0: () => tBall - 0.02, t1: () => 0.99, nu: 5, nv: 10, off: (u) => 0.065 + 0.01 * u });
  out.push(solid(cap, { sheet: true, w: () => wBall, mat: (i, j) => (j === 4 || j === 5 ? 'glA' : 'gl') }));
  out.push(tube([...colPath(cap, 0, 5, 0, 5), ...rowPath(cap, 0, 0, 10, 10).slice(1), ...colPath(cap, 10, 0, 5, 5).slice(1)], { r: 0.035, k: 4, mat: 'glL', w: () => wBall }));
  { const q = cap.at(2, 5); out.push(glint(add(q.p, mul(q.n, 0.01)), q.n, { r: 0.08, h: 0.05, points: 4, mat: 'star', w: () => wBall })); }
  // -- the spur: a strap round the ankle and over the instep, a shank behind the heel, a star rowel on it
  const ring = [...Array(16).keys()].map((j) => { const a = -PI + (2 * PI * j) / 16, q = FT.ta(0.16, a); return { p: add(q.p, mul(q.n, 0.09)), n: q.n }; });
  out.push(band(ring, { wide: 0.07, high: 0.025, mat: 'sil', w: () => wFoot, closed: true }));
  const heel = FT.ta(0.12, PI), back = unit([0, 0, -1]);
  const sp0 = add(heel.p, mul(heel.n, 0.08)), sp1 = add(sp0, add(mul(back, female ? 0.22 : 0.26), [0, -0.03, 0]));
  out.push(sweep([{ p: sp0, n: [0, 1, 0] }, { p: sp1, n: [0, 1, 0] }], { closedProfile: true, profile: roundProfile(0.03, 4), mat: 'sil', w: () => wFoot }));
  const rc = add(sp1, mul(back, 0.16)), RR = female ? 0.19 : 0.22;
  out.push(solid(starPlate(add(rc, [0.022, 0, 0]), [1, 0, 0], { R: RR, points: 6, inner: 0.42, up: [0, 1, 0] }), { w: () => wFoot, thick: 0.045, mat: () => 'rune', inner: 'rune', edge: 'sil' }));
  void tBall; void female;
  return out;
}
export function glimmersteelBoots(B) {
  return merge(bootShoe(B), ...bootOf(B, 'l'), ...bootOf(B, 'r'));
}
