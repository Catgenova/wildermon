// The pewter set: the pilgrim, armoured for the long road to a far shrine and carrying the tokens of every shrine
// passed, built with the plate kit (tools/sculpt/garments/platekit.mjs) and the set's own builders
// (tools/sculpt/garments/kit/pewter.mjs).
//
//   helm    the pilgrim's war hat: a riveted pewter bowl for its crown, a broad felt brim bound in pewter, drooping at
//           the sides and behind, its front turned up crisp and crowded with cast badges (the great ribbed scallop with
//           its pearl, an ampulla, crossed keys, small shells), small badges round its leather band, a staff token; under
//           it the hood of undyed wool round the face, over the neck to the shoulders' tops, its edges ringed in pewter.
//   chest   a russet brigandine jerkin, quilted, its front set with rows of lapped pewter plates riveted at their heads,
//           a quilted skirt, a belt with a pewter buckle; undyed wool sleeves under padded russet rerebraces studded in
//           pewter, round elbow cops, the forearms wound in linen under splinted pewter vambraces; the scrip on its strap
//           across the body with a scallop on its flap, and an ampulla of holy water on the left hip.
//   mantle  the pellegrina: a short cape of dark leather lined in russet over the shoulders, open below the throat, a
//           point behind; two rows of cast pewter scallops on it as scales, a deep russet collar studded in pewter, a
//           great scallop alone on the back, the great scallop brooch with its pearl at the throat.
//   legs    brown wool hose over the hips, the seat and the legs; padded russet cuisses studded in pewter, pewter knee
//           cops strapped on with a ribbed scallop and a pearl on each, leather garters, linen puttees wound down the
//           shins.
//   boots   brown road boots on hobnailed soles, a broad turned-down cuff of suede, pewter toe caps and heel plates, an
//           instep strap buckled in pewter round a pearl.
//
// Enchanted, these light and nothing else: the hat's scallop pearl and ampulla, the hip's ampulla, the brooch's pearl,
// the knee cops' pearls and the boots' buckle pearls.
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, smooth, merge, nearestOf, shell, on } from './metalkit.mjs';
import { boneW, patch, solid, tube, band, rowPath, studsAlong, stud, wrapAngle, domeWrap, skinSamples, shareW, wrap, plateOn, nearSkinW, smoothWeights, coverHides, colPath, limbWrap, skinW, along, mixOf, mixW, torsoWrap, pathOn } from './platekit.mjs';
import { headDome, headW, scallop, ampulla, keys, staff, token, frameAt, torsoField, torsoMarks, TORSO_BONES, wrapBand } from './kit/pewter.mjs';

const PI = Math.PI;

export const PEWTER_MATS = {
  // (the pewter: a soft warm grey, its shade darker in the crevices, its cast edges polished bright)
  pw: { c: '#5f5b52', kind: 3 },
  pwM: { c: '#4a4740', kind: 3 },
  pwL: { c: '#bdb8aa', kind: 3 },
  pwS: { c: '#3a3832', kind: 3 },
  pwC: { c: '#706b62', kind: 3 },
  pwD: { c: '#2b2925', kind: 3 },
  // (the glow: the pilgrim's holy water and pearls, milky plain, lit in the enchantment's colour)
  rune: { c: '#d9dccd', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  felt: { c: '#4b3626', kind: 2 },
  feltD: { c: '#2e2118', kind: 2 },
  feltL: { c: '#5c4430', kind: 2 },
  bead: { c: '#5e3820', kind: 2 },
  cord: { c: '#a88d5c', kind: 2 },
  hood: { c: '#94805f', kind: 0 },
  wool: { c: '#94805f', kind: 0 },
  russet: { c: '#7a3a20', kind: 0 },
  russetD: { c: '#4b2212', kind: 0 },
  leather: { c: '#5a3a22', kind: 2 },
  scrip: { c: '#8c6440', kind: 2 },
  capeL: { c: '#3a2a1e', kind: 2 },
  hose: { c: '#4f3c2b', kind: 0 },
  boot: { c: '#5e3f27', kind: 2 },
  suede: { c: '#8a6a48', kind: 0 },
  sole: { c: '#261c15', kind: 2 },
  hoseW: { c: '#4f3c2c', kind: 0 },
  capeD: { c: '#24190f', kind: 2 },
  linen: { c: '#c4b48f', kind: 0 },
  linenD: { c: '#8f7e5c', kind: 0 },
  leatherD: { c: '#3a2618', kind: 2 },
};

/* ---- the helm ----------------------------------------------------------------------------------------------------- */
/**
 * The pilgrim's war hat: a riveted pewter bowl for its crown (four polished ribs to a boss), a dark leather band round
 * its foot set with small badges, a broad felt brim from the band bound in pewter, drooping at the sides and behind, its
 * front turned up crisp against the bowl and crowded with cast badges (the great ribbed scallop with a pearl at its
 * heart, an ampulla, crossed keys, two small shells), a pewter staff token stood in the band. Under it the pilgrim's hood
 * of undyed wool, open round the face, closed under the chin and falling over the neck to the tops of the shoulders,
 * its edges ringed in pewter. The hat rigid on the head; the hood on the head, the neck and the shoulders' tops.
 */
export function pewterHelm(B) {
  const A = B.at, M = torsoMarks(B), female = B.who === 'female', out = [];
  const H0 = headDome(B, { fit: female ? 0.14 : 0.17 });
  // (the bowl a full round dome, its top flattened a little, never nearer the skin than the fit)
  const Ec = [H0.xw + (female ? 0.22 : 0.26), H0.top - H0.c[1] + (female ? 0.12 : 0.14), (H0.zf - H0.zb) / 2 + (female ? 0.2 : 0.22)];
  const H = { ...H0, D: domeWrap(B, { c: H0.c, u: [0, 1, 0], f: [0, 0, 1], s: [1, 0, 0], pick: (q) => headW(B, q.w) > 0.45, rows: 30, cols: 48, thMax: PI, cone: 0.3, smooth: 4, shape: (r, th, ph, d) => Math.max(r + H0.fit + 0.06, 1 / (Math.abs(d[0] / Ec[0]) ** 2.6 + Math.abs(d[1] / Ec[1]) ** 2.6 + Math.abs(d[2] / Ec[2]) ** 2.6) ** (1 / 2.6)) }) };
  const D = H.D, c = H.c;
  const wH = boneW(B, 'head'), w = () => wH;
  const front = (ph) => Math.abs(wrapAngle(ph));
  // -- the bowl: its foot a ring tilted back, over the brows before (the face open), over the ears, at the occiput behind
  const yF = H.top - (female ? 0.7 : 0.66), yB = H.top - (female ? 0.92 : 0.9);
  const yFoot = (ph) => lerp([0, yF, 0], [0, yB, 0], (1 - Math.cos(ph)) / 2)[1];
  const FOOT = new Map();
  const footTh = (ph) => {
    const key = Math.round(ph * 200);
    if (!FOOT.has(key)) { let th = 0.2; while (th < PI * 0.9 && D.ta(th / PI, ph).p[1] > yFoot(ph)) th += 0.01; FOOT.set(key, th); }
    return FOOT.get(key);
  };
  const NU = 10, NV = 32;
  const colOf = (ph) => (((ph + PI) / (2 * PI)) * NV + NV) % NV;
  const crown = plateOn2(D, { t1: (a) => footTh(a) / PI, nu: NU, nv: NV });
  out.push(solid(crown, { sheet: true, w, mat: () => 'pw' }));
  // (four polished ribs from the foot to a boss on the top; a row of rivets above the band)
  for (const ph of [0, PI / 2, PI, -PI / 2]) out.push(tube([...Array(NU).keys()].map((i) => { const q = crown.at(NU - 1.2 - i * ((NU - 1.4) / (NU - 1)), colOf(ph)); return { p: q.p, n: q.n }; }), { r: 0.045, k: 3, mat: 'pwL', w }));
  out.push(stud(crown.at(0, 0).p, [0, 1, 0], { r: 0.13, h: 0.09, k: 6, mat: 'pwL', w }));
  out.push(...studsAlong(rowPath(crown, NU - 1.55, 0, NV, NV * 2, 0.0), 20, { from: 0, to: 19 / 20, r: 0.035, h: 0.035, k: 4, mat: 'pwL', w }));
  // (the band round its foot: dark leather)
  out.push(band(rowPath(crown, NU - 0.6, 0, NV, NV), { wide: 0.2, high: 0.045, mat: 'leatherD', w, closed: true }));
  // -- the brim: out from the band's foot, broad, drooping at the sides and behind, the front turned up crisp
  const lift = (ph) => { const f = front(ph); return 1.36 * smooth(1.08, 0.8, f) - 0.3 * smooth(1.0, 1.9, f); };
  const reach = (ph) => { const f = front(ph); return lerp([female ? 0.66 : 0.78, 0, 0], [female ? 0.92 : 1.1, 0, 0], smooth(0.7, 1.4, f))[0]; };
  const BU = 3, BV = 44;
  const brimAt = (u, v) => {
    const ph = -PI + v * 2 * PI, q = crown.at(NU, v * NV), h = unit([q.p[0] - c[0], 0, q.p[2] - c[2]]);
    const L = lift(ph) * (0.35 + 0.65 * Math.min(1, u * 1.6)), r = reach(ph) * u + 0.03;
    // (the brim curving down as it goes out at the sides and behind; the turned-up front standing up off the band)
    const d = add(mul(h, Math.cos(L)), [0, Math.sin(L), 0]);
    return { p: add(add(q.p, mul(h, 0.02)), mul(d, r)), n: add(mul([0, 1, 0], Math.cos(L)), mul(h, -Math.sin(L))) };
  };
  const brim = patch(brimAt, BU, BV, { closed: true });
  out.push(solid(brim, { w, thick: 0.05, mat: () => 'felt', inner: 'felt', edge: 'feltD' }));
  out.push(tube(rowPath(brim, BU, 0, BV, BV), { r: 0.05, k: 4, mat: 'pw', w, closed: true }));
  // -- the badges on the turned-up front, pinned out of its face
  const badge = (u, ph) => {
    const q = brim.at(u * BU, ((ph + PI) / (2 * PI)) * BV), L = lift(ph);
    const h = unit([q.p[0] - c[0], 0, q.p[2] - c[2]]), n = unit(add(mul(h, Math.sin(L)), mul([0, 1, 0], -Math.cos(L))));
    return { p: add(q.p, mul(n, 0.035)), n };
  };
  const k = female ? 0.86 : 1;
  { const q = badge(0.08, 0); out.push(scallop(q.p, q.n, [0, 1, 0], { R: 0.64 * k, ribs: 9, span: 1.2, rib: 0.12, mat: 'pw', groove: 'pwS', rim: 'pwL', ears: 'pwM', pearl: 'rune', pearlR: 0.22, w })); }
  { const q = badge(0.1, 0.58); out.push(ampulla(q.p, q.n, [0, 1, 0], { H: 0.66 * k, glass: 'rune', mat: 'pwL', w })); }
  { const q = badge(0.42, -0.56); out.push(keys(q.p, q.n, [0, 1, 0], { L: 0.58 * k, mat: 'pwL', edge: 'pwM', w })); }
  for (const ph of [0.86, -0.86]) { const q = badge(0.3, ph); out.push(scallop(q.p, q.n, [0, 1, 0], { R: 0.22 * k, ribs: 5, span: 1.1, mat: 'pw', groove: 'pwS', rim: 'pwL', ears: false, w })); }
  // -- small badges round the band at the sides and behind: shells and medals
  for (const [ph, kind] of [[PI / 2, 's'], [-PI / 2, 's'], [PI, 's'], [2.25, 't'], [-2.25, 't']]) {
    const q = crown.at(NU - 0.6, colOf(ph)), n = unit(add(q.n, [0, -0.2, 0])), p = add(q.p, mul(n, 0.06));
    out.push(kind === 's' ? scallop(add(p, [0, -0.1, 0]), n, [0, 1, 0], { R: 0.22 * k, ribs: 5, span: 1.1, mat: 'pw', groove: 'pwS', rim: 'pwL', ears: false, w }) : token(p, n, { r: 0.1 * k, mat: 'pwM', rim: 'pwL', w }));
  }
  // -- the staff token stood in the band on the left, leaning back
  { const q = crown.at(NU - 0.8, colOf(1.25)), up = unit([0.25, 1, -0.45]);
    out.push(staff(add(q.p, mul(q.n, 0.06)), q.n, up, { L: female ? 0.62 : 0.72, r: 0.03, mat: 'pwL', knob: 'pw', w })); }
  const hat = merge(...out);
  // (the head's own polygons under the bowl left out: every corner inside it, short of its foot)
  const inside = (i) => { const v = sub(B.V[i], c), th = Math.acos(clamp(unit(v)[1], -1, 1)), ph = Math.atan2(v[0], v[2]); return th < footTh(ph) - 0.12; };
  B.A.polys.forEach(([v], pi) => { if (v.every((i) => inside(i))) hat.hides.add(pi); });
  return merge(hat, hood(B, { H, M, yFoot }));
}

/**
 * The pilgrim's hood: undyed wool round the head under the hat, open round the face (from the brow to the chin, the
 * cheeks to either side), closed under the chin, falling from the jaw over the neck to the tops of the shoulders, its
 * hem low before and behind and high over the shoulders' balls; the face's edge and the hem ringed in pewter.
 */
function hood(B, { H, M }) {
  const A = B.at, female = B.who === 'female', out = [];
  const zc = torsoField(B).zc, c = H.c;
  const front = (a) => Math.abs(wrapAngle(a));
  const hs = skinSamples(B).filter((q) => headW(B, q.w) > 0.45);
  const chinY = hs.filter((q) => Math.abs(q.p[0]) < 0.25 && q.p[2] > H.zf - 0.75).reduce((b, q) => Math.min(b, q.p[1]), 9);
  const yHem = (a) => { const f = front(a), yf = M.neckF - (female ? 0.0 : 0.05), ys = A.shoulder.l[1] + (female ? 0.42 : 0.4), yb = M.neckB - 0.32; return f < PI / 2 ? lerp([0, yf, 0], [0, ys, 0], smooth(0, PI / 2, f) ** 0.8)[1] : lerp([0, ys, 0], [0, yb, 0], smooth(PI / 2, PI, f))[1]; };
  const y0 = Math.min(M.neckF, M.neckB - 0.32) - 0.25, y1 = H.top + 0.1;
  const zAt = (yy) => lerp([0, 0, zc(yy)], [0, 0, c[2]], smooth(A.neck[1] - 0.2, A.head[1] + 0.2, yy))[2];
  const pick = (q) => shareW(B, q.w, 'head', 'neck', 'torso', 'shoulder') > 0.85 && shareW(B, q.w, 'upperarm') < 0.05 && q.p[1] > y0 - 0.4;
  const tOf = (p) => (p[1] - y0) / (y1 - y0), tChin = tOf([0, chinY, 0]);
  const G = wrap(B, {
    t: [0, 1], nt: 30, closed: true, na: 48, a: [-PI, PI], pick, smooth: 3, frame: (t) => { const yy = y0 + (y1 - y0) * t; return { o: [0, yy, zAt(yy)], u: [0, 1, 0], f: [0, 0, 1], s: [1, 0, 0] }; }, tOf,
    // (from the jaw down it hangs: never nearer the middle than anything above it)
    post: (R, T) => { for (let i = R.length - 2; i >= 0; i--) if (T[i] < tChin) for (let j = 0; j < R[i].length; j++) R[i][j] = Math.max(R[i][j], R[i + 1][j]); },
    shape: (r, t) => r + (female ? 0.07 : 0.08) + (female ? 0.22 : 0.2) * smooth(tChin, tChin - 0.3, t),
  });
  const ty = (yy) => (yy - y0) / (y1 - y0);
  const W1 = nearSkinW(B, pick, (n) => ['head', 'neck_01', 'neck_02', 'spine_03', 'clavicle_l', 'clavicle_r'].includes(n), 0.35);
  const W2 = nearSkinW(B, pick, (n) => ['neck_01', 'spine_03', 'clavicle_l', 'clavicle_r'].includes(n), 0.35);
  // (below the jaw the hood moves as the shoulders under it do, as the cape over it does)
  const shOf = (s) => mixOf(B, [[`shoulder_${s}`, 0.3], [`upperarm_${s}`, 0.05], [`clavicle_${s}`, 0.65]]);
  const W = (p) => { const kk = smooth(chinY - 0.1, A.neck[1] - 0.35, p[1]), ks = kk * smooth(0.55, 1.5, Math.abs(p[0])); return mixW([[W1(p), 1 - kk], [W2(p), kk - ks], [shOf(p[0] > 0 ? 'l' : 'r'), ks]]); };
  // (the face's opening: its sides at the cheeks, its foot under the chin)
  const half = female ? 0.9 : 0.95, top = 1.0;
  const main = plateOn(G, { a0: half, a1: 2 * PI - half, t0: (a) => ty(yHem(a)), t1: () => top, nu: 12, nv: 26, off: () => 0 });
  const bibTop = (a) => chinY - 0.02 + (female ? 0.24 : 0.28) * smooth(0.1, half, front(a)) ** 1.5;
  const bib = plateOn(G, { a0: -half - 0.12, a1: half + 0.12, t0: (a) => ty(yHem(a)), t1: (a) => ty(bibTop(a)), nu: 8, nv: 12, off: () => -0.02 });
  const hoodP = smoothWeights(merge(solid(main, { sheet: true, w: W, mat: () => 'hood' }), solid(bib, { sheet: true, w: W, mat: () => 'hood' })), 4);
  out.push(hoodP);
  const onH = (p) => hoodP.W[nearestOf(hoodP.V, p)];
  // (the pewter rings: a polished cord round the face's edge and the hem, rings set along them)
  const lift = (q, d) => ({ p: add(q.p, mul(q.n, d)), n: q.n });
  const faceEdge = [];
  const yTopEdge = H.top - (female ? 0.55 : 0.5);
  for (let k = 0; k <= 10; k++) faceEdge.push(lift(G.ta(ty(yTopEdge + (bibTop(half) - yTopEdge) * (k / 10)), half), 0.02));
  for (let k = 1; k < 12; k++) { const a = half - (2 * half * k) / 12; faceEdge.push(lift(G.ta(ty(bibTop(a)), a), 0.0)); }
  for (let k = 0; k <= 10; k++) faceEdge.push(lift(G.ta(ty(bibTop(half) + (yTopEdge - bibTop(half)) * (k / 10)), -half), 0.02));
  out.push(tube(faceEdge, { r: 0.04, k: 4, mat: 'pw', w: onH }));
  out.push(...studsAlong(faceEdge, 13, { from: 0.08, to: 0.92, r: 0.05, h: 0.04, k: 5, mat: 'pwL', w: onH }));
  const hem = [...Array(49).keys()].map((j) => { const a = -PI + (2 * PI * j) / 48; return lift(G.ta(ty(yHem(a)) + 0.004, a), 0.01); });
  out.push(tube(hem, { r: 0.045, k: 4, mat: 'pw', w: onH, closed: true }));
  out.push(...studsAlong(hem, 18, { from: 0, to: 17 / 18, r: 0.06, h: 0.045, k: 5, mat: 'pwL', w: onH }));
  return coverHides(B, merge(...out), 0.45);
}
/** A cap on the head's dome from its top to `t1(a)` (a fraction of pi), all the way round. */
function plateOn2(D, o) {
  return patch((u, v) => { const a = -PI + 2 * PI * v, q = D.ta(o.t1(a) * u, a); return { p: q.p, n: q.n }; }, o.nu, o.nv, { closed: true });
}
void dot; void cross; void len; void lerp; void frameAt;

/* ---- chest & arms --------------------------------------------------------------------------------------------------- */
/** How much of a body point's weight is on the head and the jaw themselves. */
const headOnly = (B, i) => headW(B, B.W[i]);
/** The gown: undyed wool over the torso and the arms to the wrists, close over the skin, the skin under it left out. */
function gown(B) {
  const A = B.at, M = torsoMarks(B);
  return shell(B, {
    sub: 0, rim: null,
    keep: (i) => { const p = B.V[i]; return on(B, i, 'torso', 'shoulder', 'upperarm', 'forearm', 'neck', 'head', 'thigh') > 0.6 && headOnly(B, i) < 0.05 && on(B, i, 'hand') < 0.35 && p[1] > M.waist - 0.3 && on(B, i, 'thigh') < 0.5 && p[1] < A.neck[1] - 0.02; },
    off: ({ p }) => 0.06 + 0.03 * smooth(M.waist, M.hip, p[1]) - 0.03 * smooth(A.neck[1] - 0.6, A.neck[1] - 0.1, p[1]),
    mat: () => 'wool',
  });
}

/**
 * The brigandine jerkin: russet wool quilted in channels over the torso, its front set with rows of pewter plates each
 * riveted at its head (the lower row under the upper, as a brigandine's), a quilted skirt flared over the hips, a leather
 * belt with a pewter buckle; the neckline and the armholes rolled.
 */
function jerkin(B) {
  const A = B.at, M = torsoMarks(B), F = torsoField(B), t = F.tOfY, out = [], female = B.who === 'female';
  const W = nearSkinW(B, (s) => shareW(B, s.w, 'torso') > 0.7, (n) => TORSO_BONES.has(n), 0.35);
  const aN = 0.8, side = PI / 2 + 0.04;
  const neckF = M.neckF - 0.12;
  const topF = (a) => { const ax = Math.abs(a), yC = neckF + 0.22; if (ax <= aN) return neckF + 0.22 * (ax / aN) ** 2; const k2 = clamp((ax - aN) / (side - aN)); return M.pit + (yC - M.pit) * Math.sqrt(Math.max(0, 1 - k2 * k2)); };
  const bN = 0.62;
  const topB = (a) => { const bx = PI - Math.abs(wrapAngle(a)), yC = M.neckB + 0.06; if (bx <= bN) return M.neckB - 0.04 + 0.1 * (bx / bN) ** 2; const k2 = clamp((bx - bN) / (PI - side + 0.04 - bN)); return M.pit + (yC - M.pit) * Math.sqrt(Math.max(0, 1 - k2 * k2)); };
  const bulge = (yy, a) => (female ? 0.03 : 0.06) * Math.exp(-(((yy - lerp(A.chest, [0, M.waist, 0], 0.4)[1]) / 0.9) ** 2)) * Math.max(0, Math.cos(a)) ** 1.5;
  const offF = (u, v, tt, a) => 0.12 + bulge(F.yOfT(tt), a);
  const NU = 12, NV = 22;
  const breast = plateOn(F, { a0: -side, a1: side, t0: () => t(M.waist - 0.06), t1: (a) => t(topF(a)), nu: NU, nv: NV, off: offF });
  const back = plateOn(F, { a0: side - 0.08, a1: 2 * PI - side + 0.08, t0: () => t(M.waist - 0.06), t1: (a) => t(topB(a)), nu: NU, nv: 20, off: () => 0.12 });
  out.push(solid(breast, { sheet: true, w: W, mat: () => 'russet' }));
  out.push(solid(back, { sheet: true, w: W, mat: () => 'russet' }));
  // (the neckline and the armholes rolled)
  out.push(tube(rowPath(breast, NU, 0, NV, NV), { r: 0.055, k: 4, mat: 'russetD', w: W }));
  out.push(tube(rowPath(back, NU, 0, 20, 20), { r: 0.055, k: 4, mat: 'russetD', w: W }));
  // (quilted channels down the back and the front's sides)
  for (let j = 2.5; j <= 17.5; j += 2.5) out.push(tube(colPath(back, j, 0.3, NU - 0.8, 8, 0.012), { r: 0.022, k: 3, mat: 'russetD', w: W }));
  for (const j of [1.5, NV - 1.5]) out.push(tube(colPath(breast, j, 0.3, NU - 1.4, 8, 0.012), { r: 0.022, k: 3, mat: 'russetD', w: W }));
  // -- the brigandine's plates: rows from the waist to the chest, each row lapped over the one below, a rivet at each head
  const rows = female ? 4 : 5, cols = 6, a0 = -1.12, a1 = 1.12, yb0 = M.waist + 0.04, yb1 = lerp([0, M.pit, 0], [0, neckF, 0], female ? 0.25 : 0.45)[1];
  const hgt = (yb1 - yb0) / rows, wd = (a1 - a0) / cols;
  for (let r = 0; r < rows; r++) for (let cI = 0; cI < cols; cI++) {
    const ya = yb0 + hgt * r - 0.06, yz = yb0 + hgt * (r + 1), aa = a0 + wd * cI + 0.015, az = aa + wd - 0.03;
    const g = plateOn(F, { a0: aa, a1: az, t0: () => t(ya), t1: () => t(yz), nu: 2, nv: 3, off: (u, v, tt, a) => offF(u, v, tt, a) + 0.035 + 0.016 * r + 0.012 * Math.sin(PI * v) });
    out.push(solid(g, { hollow: true, w: W, thick: 0.03, mat: () => 'pw', edge: 'pwS' }));
    const q = g.at(1.6, 1.5);
    out.push(stud(add(q.p, mul(q.n, 0.01)), q.n, { r: 0.045, h: 0.04, k: 4, mat: 'pwL', w: () => W(q.p) }));
  }
  // (a polished rim round the plated panel)
  // -- the skirt: quilted, flared over the hips, shorter behind
  const behind = (a) => smooth(1.6, 2.7, Math.abs(wrapAngle(a)));
  const fBot = (a) => lerp([0, M.hip + (female ? 0.12 : 0.02), 0], [0, M.waist - (female ? 0.42 : 0.5), 0], behind(a))[1];
  const SV = 32;
  const skirt = plateOn(F, { a0: -PI, a1: PI, closed: true, t0: (a) => t(fBot(a)), t1: () => t(M.waist + 0.02), nu: 4, nv: SV, off: (u) => 0.13 + 0.14 * (1 - u) ** 1.3 });
  out.push(solid(skirt, { hollow: true, w: W, thick: 0.04, mat: () => 'russet', edge: 'russetD' }));
  out.push(tube(rowPath(skirt, 0, 0, SV, SV), { r: 0.045, k: 4, mat: 'russetD', w: W, closed: true }));
  for (let j = 0; j < SV; j += 2) out.push(tube(colPath(skirt, j + 1, 0.15, 3.6, 4, 0.012), { r: 0.02, k: 3, mat: 'russetD', w: W }));
  // -- the belt: leather round the waist, a pewter buckle before, a pewter tongue tip hanging
  const belt = plateOn(F, { a0: -PI, a1: PI, closed: true, t0: () => t(M.waist - 0.08), t1: () => t(M.waist + 0.08), nu: 1, nv: SV, off: () => 0.21 + (female ? 0.0 : 0.0) });
  out.push(solid(belt, { hollow: true, w: W, thick: 0.04, mat: () => 'leather', edge: 'leatherD' }));
  {
    const q = belt.at(0.5, SV / 2), fr = frameAt(q.n, [0, 1, 0]), bc = add(q.p, mul(q.n, 0.04));
    const rect = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, yy]) => ({ p: add(bc, add(mul(fr.x, x * 0.16), mul(fr.y, yy * 0.13))), n: q.n }));
    out.push(tube(rect, { r: 0.035, k: 4, mat: 'pwL', w: () => W(q.p), closed: true }));
    out.push(tube([{ p: add(bc, mul(fr.y, -0.12)), n: q.n }, { p: add(bc, add(mul(fr.y, 0.12), mul(q.n, 0.02))), n: q.n }], { r: 0.025, k: 3, mat: 'pw', w: () => W(q.p) }));
  }
  return { parts: out, W, F, M, breast, back, belt, topF, yb1 };
}

/** The arm's skin samples on side `s`: of the parts given, more than `k` of their weight. */
const armPick = (B, s, parts, k = 0.6) => (q) => (s === 'l' ? q.p[0] > 0.15 : q.p[0] < -0.15) && shareW(B, q.w, ...parts) > k;
const armBones = (s) => (n) => n.endsWith(`_${s}`);

/**
 * One arm: a round pewter cop over the elbow's point with a boss; the forearm wound in linen from the elbow to the
 * wrist, and over the wrappings a splinted vambrace: three pewter splints down the forearm's back, riveted, held by two
 * leather straps buckled in pewter.
 */
function armOf(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, sh = A.shoulder[s], el = A.elbow[s], wr = A.wrist[s], out = [];
  const female = B.who === 'female';
  const upDir = unit(sub(el, sh)), foreDir = unit(sub(wr, el)), uaLen = len(sub(el, sh)), faLen = len(sub(wr, el));
  // -- the padded rerebrace: russet quilted over the upper arm's outside, studded in rows as the jerkin's plates are
  const upPick = armPick(B, s, ['upperarm', 'shoulder']);
  const UA = limbWrap(B, sh, el, sg, { t: [0, 1.0], nt: 16, a: [-PI, PI], closed: true, na: 22, pick: upPick, smooth: 3, shape: (r) => r });
  const wUp = skinW(B, (q) => upPick(q) && along(q.p, sh, el) > 0.3 && along(q.p, sh, el) < 0.8, armBones(s));
  const RU = 5, RV = 8;
  const rere = plateOn(UA, { a0: PI / 2 - 1.5, a1: PI / 2 + 1.5, t0: () => 0.86, t1: () => (female ? 0.54 : 0.46), nu: RU, nv: RV, off: (u, v) => 0.1 + 0.04 * Math.sin(PI * v) ** 0.7 });
  out.push(solid(rere, { w: () => wUp, thick: 0.045, mat: () => 'russet', inner: 'russetD', edge: 'russetD' }));
  out.push(tube(rowPath(rere, 0, 0, RV, RV), { r: 0.035, k: 4, mat: 'russetD', w: () => wUp }));
  out.push(tube(rowPath(rere, RU, 0, RV, RV), { r: 0.035, k: 4, mat: 'russetD', w: () => wUp }));
  for (let i = 1; i < RU; i++) out.push(...studsAlong(rowPath(rere, i, 0.8, RV - 0.8, RV * 2, 0.01), 4, { r: 0.04, h: 0.04, k: 4, mat: 'pwL', w: () => wUp }));
  // -- the forearm's wrappings: a linen band wound from the elbow to the wrist
  const faPick = armPick(B, s, ['forearm'], 0.6);
  const FA = limbWrap(B, el, wr, sg, { t: [0, 1.04], nt: 16, a: [-PI, PI], closed: true, na: 24, pick: faPick, smooth: 3, shape: (r) => r });
  const wFa = nearSkinW(B, (q) => armPick(B, s, ['forearm', 'hand'], 0.5)(q), (n) => armBones(s)(n) && !/^(hand|thumb|fingers|knuckles)/.test(n), 0.3);
  out.push(wrapBand(FA, { t0: 0.95, t1: 0.12, turns: 5.5, steps: 8, off: () => 0.075, lap: 0.03, w: wFa, mat: () => 'linen', edge: 'linenD', edgeR: 0.02 }));
  // -- the splints down the forearm's back, over the wrappings
  const wFaR = skinW(B, (q) => faPick(q) && along(q.p, el, wr) > 0.25 && along(q.p, el, wr) < 0.85, armBones(s));
  for (const da of [-0.55, 0, 0.55]) {
    const ac = PI / 2 + da, g = plateOn(FA, { a0: ac - 0.2, a1: ac + 0.2, t0: () => 0.2, t1: () => 0.84, nu: 5, nv: 3, off: (u, v) => 0.14 + 0.03 * Math.sin(PI * v) });
    out.push(solid(g, { w: () => wFaR, thick: 0.035, mat: () => 'pw', inner: 'pwS', edge: 'pwS' }));
    out.push(tube(colPath(g, 1.5, 0.3, 4.7, 4, 0.03), { r: 0.022, k: 3, mat: 'pwL', w: () => wFaR }));
    for (const fi of [0.5, 4.5]) { const q = g.at(fi, 1.5); out.push(stud(q.p, q.n, { r: 0.04, h: 0.035, k: 4, mat: 'pwL', w: () => wFaR })); }
  }
  for (const tt of [0.3, 0.74]) {
    const ring = [...Array(17).keys()].map((j) => { const a = -PI + (2 * PI * j) / 16, q = FA.ta(tt, a); return { p: add(q.p, mul(q.n, 0.1 + 0.075 * Math.max(0, Math.cos(a - PI / 2)) ** 0.5)), n: q.n }; });
    out.push(band(ring, { wide: 0.09, high: 0.03, mat: 'leather', w: () => wFaR, closed: true }));
    const q = FA.ta(tt, PI / 2 + 0.95), bo = q.n;
    out.push(stud(add(q.p, mul(bo, 0.15)), bo, { r: 0.055, h: 0.04, k: 4, mat: 'pwL', w: () => wFaR }));
  }
  // -- the cop over the elbow's point, a boss on it
  const c0 = sub(el, mul(upDir, uaLen * 0.2)), c1 = add(el, mul(foreDir, faLen * 0.2));
  const elPick = (q) => armPick(B, s, ['upperarm', 'forearm'], 0.6)(q) && len(sub(q.p, el)) < 0.9;
  const EL = limbWrap(B, c0, c1, sg, { t: [0, 1], nt: 10, a: [-PI, PI], closed: true, na: 24, pick: elPick, smooth: 3, shape: (r) => r });
  const wEl = boneW(B, `elbow_${s}`);
  const cup = plateOn(EL, { a0: 1.3, a1: 2 * PI - 1.3, t0: () => 0.08, t1: () => 0.92, nu: 6, nv: 12, off: (u, v) => 0.12 + 0.08 * Math.sin(PI * u) * Math.sin(PI * v) });
  out.push(solid(cup, { sheet: true, w: () => wEl, mat: () => 'pw' }));
  out.push(tube(rowPath(cup, 0, 0, 12, 12), { r: 0.035, k: 3, mat: 'pwL', w: () => wEl }));
  out.push(tube(rowPath(cup, 6, 0, 12, 12), { r: 0.035, k: 3, mat: 'pwL', w: () => wEl }));
  const ec = cup.at(3, 6);
  out.push(stud(add(ec.p, mul(ec.n, 0.01)), ec.n, { r: female ? 0.08 : 0.1, h: 0.08, k: 6, mat: 'pwL', w: () => wEl }));
  return out;
}

/**
 * The scrip: a leather satchel on the right hip, its flap closed by a pewter scallop, hung from a strap that crosses the
 * breast from the left shoulder and the back; and on the left hip an ampulla of holy water on a cord from the belt.
 */
function scrip(B, J) {
  const A = B.at, M = J.M, F = J.F, t = F.tOfY, out = [], female = B.who === 'female';
  const W = J.W;
  const wHip = mixOf(B, [['pelvis', 0.7], ['spine_01', 0.3]]);
  // -- the satchel on the right hip, standing off the skirt
  const sy = M.waist - (female ? 0.42 : 0.56), sa = female ? -1.3 : -1.12, q0 = F.ta(t(sy), sa);
  const n = unit([q0.n[0], 0, q0.n[2]]), fr = frameAt(n, [0, 1, 0]), Wd = female ? 0.86 : 1.0, Ht = female ? 0.74 : 0.84, Dp = 0.24;
  const base = add(q0.p, mul(n, 0.3));
  const body = patch((u, v) => ({ p: add(base, add(add(mul(fr.x, (v - 0.5) * Wd), mul(fr.y, (u - 0.5) * Ht)), mul(n, Dp + 0.04 * Math.sin(PI * u) * Math.sin(PI * v)))), n }), 3, 4);
  out.push(solid(body, { w: () => wHip, thick: Dp, mat: () => 'scrip', inner: 'leatherD', edge: 'leatherD' }));
  // (the flap over its top and down its face, rounded at its foot)
  const flap = patch((u, v) => {
    const x = (v - 0.5) * Wd * 1.04, foot = -Ht * 0.08 - Ht * 0.2 * Math.cos(PI * (v - 0.5)) ** 2;
    // (from the back's top edge over the top and down the face to its rounded foot)
    const top = Ht / 2 + 0.02, d = Dp + 0.05;
    const p = u < 0.3 ? add(add(base, mul(fr.y, top)), add(mul(fr.x, x), mul(n, (u / 0.3) * d))) : add(add(base, mul(n, d)), add(mul(fr.x, x), mul(fr.y, top - ((u - 0.3) / 0.7) * (top - foot))));
    return { p, n: u < 0.3 ? fr.y : n };
  }, 5, 6);
  out.push(solid(flap, { sheet: true, w: () => wHip, mat: () => 'leather' }));
  out.push(tube([...Array(9).keys()].map((j) => { const q = flap.at(5, j * 0.75); return { p: add(q.p, mul(n, 0.01)), n }; }), { r: 0.025, k: 3, mat: 'pw', w: () => wHip }));
  const fq = add(base, add(mul(n, Dp + 0.08), mul(fr.y, -Ht * 0.05)));
  out.push(scallop(add(fq, mul(fr.y, -0.2)), n, [0, 1, 0], { R: female ? 0.34 : 0.4, ribs: 7, span: 1.15, rib: 0.12, mat: 'pw', groove: 'pwS', rim: 'pwL', ears: 'pwM', w: () => wHip }));
  // -- the strap: from the satchel's back corner up across the breast to the left shoulder, over it and down the back
  const ends = [add(base, add(mul(fr.x, Wd * 0.45), mul(fr.y, Ht / 2))), add(base, add(mul(fr.x, -Wd * 0.45), mul(fr.y, Ht / 2)))];
  const keyF = [[sy + Ht / 2 + 0.05, sa + 0.45], [M.waist + 0.4, -0.75], [lerp([0, M.pit, 0], [0, M.waist, 0], 0.15)[1], 0.0], [M.pit + 0.35, 0.55], [J.topF(0.9) - 0.22, 0.95]];
  const keyB = [[J.topF(0.9) - 0.22, 0.95], [M.pit + 0.2, 2.1], [lerp([0, M.pit, 0], [0, M.waist, 0], 0.5)[1], PI], [M.waist + 0.4, 3.9], [sy + Ht / 2 + 0.05, 2 * PI + sa - 0.45]];
  const strapPath = (keys2) => {
    const pts = [];
    for (let k2 = 0; k2 < keys2.length - 1; k2++) for (let m = 0; m < 4; m++) { const f = m / 4, [ya, aa] = keys2[k2], [yz, az] = keys2[k2 + 1]; pts.push([ya + (yz - ya) * f, aa + (az - aa) * f]); }
    pts.push(keys2[keys2.length - 1]);
    return pts.map(([yy, a]) => { const q = F.ta(t(yy), a); const fr2 = Math.abs(wrapAngle(a)) < 1.2 ? smooth(J.yb1 + 0.25, J.yb1 - 0.05, yy) : 0; return { p: add(q.p, mul(q.n, 0.17 + 0.14 * fr2 + 0.06 * smooth(M.waist + 0.6, M.waist + 0.2, yy))), n: q.n }; });
  };
  const sF = strapPath(keyF), sB = strapPath(keyB);
  sF[0] = { p: ends[1], n }; sB[sB.length - 1] = { p: ends[0], n };
  out.push(band(sF, { wide: 0.17, high: 0.035, mat: 'scrip', w: (p) => W(p) }));
  out.push(band(sB, { wide: 0.17, high: 0.035, mat: 'scrip', w: (p) => W(p) }));
  // (a pewter buckle on the strap at the breast)
  { const q = sF[9], o = unit(q.n); out.push(stud(add(q.p, mul(o, 0.04)), o, { r: 0.09, h: 0.05, k: 4, mat: 'pwL', w: () => W(q.p) })); }
  // -- the ampulla on the left hip, on a cord from the belt: lit when enchanted
  const aq = J.belt.at(0, (((female ? 1.3 : 1.15) + PI) / (2 * PI)) * 32), an = unit([aq.n[0], 0, aq.n[2]]);
  const ab = add(aq.p, add(mul(an, 0.3), [0, -(female ? 0.66 : 0.82), 0]));
  out.push(ampulla(ab, an, [0, 1, 0], { H: female ? 0.7 : 0.8, glass: 'rune', mat: 'pwL', w: () => wHip }));
  out.push(tube([{ p: add(aq.p, mul(an, 0.04)), n: an }, { p: add(ab, [0, (female ? 0.7 : 0.8) * 0.75, 0]), n: an }], { r: 0.022, k: 3, mat: 'cord', w: () => wHip }));
  return out;
}

export function pewterChest(B) {
  const J = jerkin(B);
  return coverHides(B, merge(smoothWeights(gown(B), 2, (p) => p[1] < B.at.neck[1] - 0.6), ...J.parts, ...scrip(B, J), ...armOf(B, 'l'), ...armOf(B, 'r')), 0.5);
}

/* ---- the shawl: the pilgrim's cape ----------------------------------------------------------------------------------- */
/**
 * The pellegrina: a short cape of dark leather over the shoulders, to the breast before, the upper arms at the sides
 * and the shoulder blades behind, lined in russet, open below the throat; sewn all over with rows of cast pewter
 * scallop shells lapped as scales, the lowest row's shells hung over the hem so its edge is scalloped; a deep collar of
 * russet wool turned down over its top, its edge studded in pewter; a great scallop on the back below the collar; at
 * the throat the great scallop brooch with its pearl (lit when enchanted), and from it a string of pewter tokens.
 */
export function pewterMantle(B) {
  const A = B.at, M = torsoMarks(B), F = torsoField(B), zc = F.zc, out = [], female = B.who === 'female';
  const n = A.neck[1], k = female ? 0.88 : 1;
  // (the envelope it is laid over: the chest piece's upper parts, the hood, and the skin there, hung as cloth falls)
  const J = jerkin(B), L = armOf(B, 'l'), R = armOf(B, 'r'), hd = pewterHelm(B);
  const legW = (w) => w.some(([b, x]) => x > 0.2 && /(thigh|calf)/.test(B.bones[b].name));
  const lowArm = (w) => w.some(([b, x]) => x > 0.3 && /(lowerarm|elbow|hand|wrist)/.test(B.bones[b].name));
  const pts = [];
  for (const P of [...J.parts, ...L, ...R, ...scrip(B, J)]) P.V.forEach((p, i) => { if (!lowArm(P.W[i]) && !legW(P.W[i]) && p[1] > M.waist - 0.6) pts.push(p); });
  // (the hood's points below the head)
  hd.V.forEach((p, i) => { if (headW(B, hd.W[i]) < 0.6 && p[1] < A.neck[1] + 0.3) pts.push(p); });
  for (const q of skinSamples(B)) if (shareW(B, q.w, 'torso', 'neck', 'shoulder', 'upperarm') > 0.8 && headW(B, q.w) < 0.15 && q.p[1] > M.waist - 0.6) pts.push(q.p);
  const cy0 = M.pit - 1.2, cy1 = n + 0.6, ct = (yy) => (yy - cy0) / (cy1 - cy0);
  const C = torsoWrap(B, cy0, cy1, zc, {
    points: pts, nt: 70, na: 72, closed: true, a: [-PI, PI], smooth: 3, minDa: 0.1, empty: 0.3,
    post: (Rr) => { for (let j = 0; j < Rr[0].length; j++) for (let i = Rr.length - 2; i >= 0; i--) Rr[i][j] = Math.max(Rr[i][j], Rr[i + 1][j]); },
    shape: (r, t, a) => r + 0.1 + 0.21 * smooth(ct(n - 1.2), ct(n - 0.4), t) - 0.06 * Math.max(0, Math.cos(a)) ** 2 * smooth(ct(n - 0.5), ct(n - 1.2), t),
  });
  const W = nearSkinW(B, (q) => shareW(B, q.w, 'torso', 'neck') > 0.8 && headW(B, q.w) < 0.2 && q.p[1] > M.pit - 0.4, (nm) => ['spine_03', 'spine_02', 'neck_01'].includes(nm), 0.35);
  const shOf = (s) => mixOf(B, [[`shoulder_${s}`, 0.3], [`upperarm_${s}`, 0.05], [`clavicle_${s}`, 0.65]]);
  const armOfS = (s) => mixOf(B, [[`shoulder_${s}`, 0.45], [`upperarm_${s}`, 0.35], [`clavicle_${s}`, 0.2]]);
  // (over the shoulders the arms', toward the middle the torso's; low over the upper arm more of the arm's own)
  const wTop = (p) => { const kk = smooth(0.4, 1.7, Math.abs(p[0])), ka = smooth(A.shoulder.l[1] + 0.2, A.shoulder.l[1] - 0.25, p[1]) * smooth(1.0, 1.5, Math.abs(p[0])), s = p[0] > 0 ? 'l' : 'r'; return mixW([[W(p), 1 - kk], [shOf(s), kk * (1 - ka)], [armOfS(s), kk * ka]]); };
  // -- the cape: round from the throat, open below it before, its hem low before and behind, over the upper arms
  const front = (a) => Math.abs(wrapAngle(a));
  const gap = 0.42, aL = gap, aR = 2 * PI - gap;
  const yTop = (a) => n - 0.12 + 0.06 * smooth(0.5, 2.5, front(a));
  const yBot = (a) => { const f = front(a); const yf = M.pit + (female ? 1.02 : 0.86), ys = A.shoulder.l[1] + (female ? 0.24 : 0.24), yb = M.pit - (female ? 0.25 : 0.35); return (f < PI / 2 ? lerp([0, yf, 0], [0, ys, 0], smooth(0.3, PI / 2, f))[1] : lerp([0, ys, 0], [0, yb, 0], smooth(PI / 2 + 0.3, PI - 0.15, f))[1]) + (female ? 0.4 : 0.5) * smooth(0.85, 0.12, f) ** 1.3; };
  const NU = 8, NV = 44;
  const cape = plateOn(C, { a0: aL, a1: aR, t0: (a) => ct(yBot(a)), t1: (a) => ct(yTop(a)), nu: NU, nv: NV, off: (u) => 0.02 * u });
  const capeP = smoothWeights(solid(cape, { w: wTop, thick: 0.035, mat: () => 'capeL', inner: 'russetD', edge: 'capeD' }), 18);
  out.push(capeP);
  const onCape = (p) => capeP.W[nearestOf(capeP.V, p)];
  const capeAt = (yy, a) => { const t0 = ct(yBot(a)), t1 = ct(yTop(a)); return cape.at(clamp((ct(yy) - t0) / (t1 - t0)) * NU, ((a - aL) / (aR - aL)) * NV); };
  // (the hem and the front edges bound in dark leather)
  const rim = [...[...Array(NU).keys()].map((i) => [NU - i, 0]), ...[...Array(NV + 1).keys()].map((j) => [0, j]), ...[...Array(NU).keys()].map((i) => [i + 1, NV])];
  out.push(tube(pathOn(cape, rim, 0.01), { r: 0.04, k: 4, mat: 'capeD', w: onCape }));
  // -- the collar: russet wool turned down over the cape's top, deep, its edge studded in pewter
  const cDeep = (a) => (female ? 0.34 : 0.4) + 0.08 * smooth(1.2, PI, front(a)) - 0.12 * smooth(0.7, 0.15, front(a));
  const collar = plateOn(C, { a0: aL - 0.02, a1: aR + 0.02, t0: (a) => ct(yTop(a) - cDeep(a)), t1: (a) => ct(yTop(a) + 0.04), nu: 3, nv: 40, off: (u) => 0.12 + 0.04 * (1 - u) });
  out.push(solid(collar, { w: onCape, thick: 0.04, mat: () => 'russet', inner: 'russetD', edge: 'russetD' }));
  out.push(tube(rowPath(collar, 0, 0, 40, 40, 0.01), { r: 0.04, k: 4, mat: 'russetD', w: onCape }));
  out.push(...studsAlong(rowPath(collar, 0.5, 0.5, 39.5, 40, 0.02), 18, { r: 0.045, h: 0.04, k: 5, mat: 'pwL', w: onCape }));
  // -- the scales: rows of pewter scallops from under the collar to the hem, hinge up, each row staggered and lapped
  // over the one below; the lowest hung over the hem
  const rows = 2, sR = (female ? 0.42 : 0.5);
  for (let r = 0; r < rows; r++) {
    const f = r / (rows - 1);
    // (spaced round at the hem's width, the rows evenly from under the collar down past the hem)
    const per = Math.round((female ? 9 : 10) * (0.85 + 0.15 * f)), off = r % 2 ? 0.5 : 0;
    for (let m = 0; m < per; m++) {
      const a = aL + 0.08 + ((aR - aL - 0.16) * (m + off)) / per;
      // (none where the great scallop lies on the back)
      if (r < rows - 1 && Math.abs(a - PI) < 0.5) continue;
      if (front(a) < 0.62) continue;
      const yy = lerp([0, yTop(a) - cDeep(a) + 0.08, 0], [0, yBot(a) + sR * 0.65, 0], f)[1];
      const q = capeAt(yy, a), dn = unit(sub([0, -1, 0], mul(q.n, dot([0, -1, 0], q.n))));
      out.push(scallop(add(q.p, mul(q.n, 0.03 + 0.012 * (rows - r))), q.n, dn, { R: sR, ribs: 7, span: 1.2, rib: 0.15, dome: 0.3, tilt: 0.28, mat: 'pwC', groove: 'pwS', rim: 'pwL', ears: 'pwM', nu: 3, w: () => onCape(q.p) }));
    }
  }
  // -- the great scallop on the back, below the collar
  { const yy = lerp([0, yTop(PI) - cDeep(PI), 0], [0, yBot(PI), 0], 0.18)[1], q = capeAt(yy, PI);
    out.push(scallop(add(q.p, mul(q.n, 0.1)), q.n, [0, -1, 0], { R: 0.74 * k, ribs: 9, span: 1.2, rib: 0.14, dome: 0.3, mat: 'pwC', groove: 'pwS', rim: 'pwL', ears: 'pwL', w: () => onCape(q.p) })); }
  // -- the brooch at the throat: a great scallop, hinge down, a pearl at its heart; from it a string of tokens
  const bq = C.ta(ct(yTop(0) - 0.32), 0), bo = unit(add(bq.n, [0, 0.25, 0])), bc = add(bq.p, mul(bo, 0.17));
  const wB = () => onCape(capeAt(yTop(0.15) - 0.25, aL + 0.02).p);
  out.push(scallop(add(bc, [0, -0.4 * k, 0]), bo, [0, 1, 0], { R: 0.68 * k, ribs: 9, span: 1.25, rib: 0.15, mat: 'pwL', groove: 'pwS', rim: 'pwL', ears: 'pwC', pearl: 'rune', pearlR: 0.28, w: wB }));
  // (a ring of rivets round its fan, as a cast badge's border)
  out.push(tube([...Array(11).keys()].map((m) => { const th = -1.25 + (2.5 * m) / 10, fr = frameAt(bo, [0, 1, 0]); return { p: add(add(bc, [0, -0.4 * k, 0]), add(add(mul(fr.x, Math.sin(th) * 0.86 * k), mul(fr.y, Math.cos(th) * 0.75 * k)), mul(bo, -0.02))), n: bo }; }), { r: 0.04, k: 3, mat: 'pwM', w: wB }));
  return coverHides(B, merge(...out), 0.6);
}

/* ---- legs ------------------------------------------------------------------------------------------------------------ */
/** The hose: brown wool over the hips, the seat and the legs to the ankles, close over the skin; its waist (`hoseW`) left out under any chest piece. */
function hose(B) {
  const A = B.at, M = torsoMarks(B);
  return shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'thigh', 'calf', 'torso', 'foot') > 0.6 && (on(B, i, 'thigh', 'calf', 'torso') > 0.6 || p[1] > A.ankle[s][1] + 0.05) && (on(B, i, 'foot') < 0.5 || p[1] > A.ankle[s][1] + 0.05) && on(B, i, 'upperarm', 'forearm', 'hand', 'shoulder') < 0.05 && p[1] < M.waist + 0.25 && p[1] > A.ankle[s][1] - 0.05; },
    off: () => 0.03,
    mat: ({ p }) => (p[1] > M.hip + 0.05 ? 'hoseW' : 'hose'),
  });
}
/**
 * One leg: a padded russet cuisse down the thigh's front and outside, studded in rows of pewter rivets as the jerkin's
 * plates are; a domed pewter knee cop with a ribbed scallop raised on it and a pearl at its heart (lit when enchanted);
 * a leather garter under the knee buckled in pewter; and the shin wound in linen puttees from the garter to the ankle.
 */
function legOf(B, s) {
  const A = B.at, M = torsoMarks(B), sg = s === 'l' ? 1 : -1, hp = A.hip[s], kn = A.knee[s], an = A.ankle[s], out = [];
  const female = B.who === 'female';
  const legBones = (nm) => nm.endsWith(`_${s}`);
  // -- the cuisse
  const thPick = (q) => q.p[0] * sg > 0.08 && shareW(B, q.w, 'thigh') > 0.6;
  const TH = limbWrap(B, hp, kn, sg, { t: [0, 1.02], nt: 20, a: [-PI, PI], closed: true, na: 28, pick: thPick, smooth: 4, shape: (r) => r });
  const wT = skinW(B, (q) => thPick(q) && along(q.p, hp, kn) > 0.25 && along(q.p, hp, kn) < 0.8, legBones);
  const tTop = along([hp[0], M.hip - (female ? 0.1 : 0.0), hp[2]], hp, kn) + 0.2;
  const CU = 6, CV = 8;
  const cuisse = plateOn(TH, { a0: -0.75, a1: 1.95, t0: () => 0.78, t1: (a) => tTop + 0.04 * smooth(0.6, 1.6, a), nu: CU, nv: CV, off: (u, v) => 0.08 + 0.05 * Math.sin(PI * v) ** 0.7 });
  out.push(solid(cuisse, { w: () => wT, thick: 0.05, mat: () => 'russet', inner: 'russetD', edge: 'russetD' }));
  out.push(tube(rowPath(cuisse, 0, 0, CV, CV), { r: 0.04, k: 4, mat: 'russetD', w: () => wT }));
  for (const j of [0, CV]) out.push(tube(colPath(cuisse, j, 0, CU, CU), { r: 0.035, k: 3, mat: 'russetD', w: () => wT }));
  for (let i = 1; i < CU; i++) out.push(...studsAlong(rowPath(cuisse, i, 0.7, CV - 0.7, CV * 2, 0.01), 5, { r: 0.04, h: 0.04, k: 4, mat: 'pwL', w: () => wT }));
  // (a pewter-studded strap down the back of the thigh, from the seat to the knee)
  const backStrap = [...Array(9).keys()].map((m) => { const q = TH.ta(0.22 + 0.58 * (m / 8), PI); return { p: add(q.p, mul(q.n, 0.13)), n: q.n }; });
  out.push(band(backStrap, { wide: 0.14, high: 0.035, mat: 'scrip', w: () => wT }));
  out.push(...studsAlong(backStrap, 6, { from: 0.08, to: 0.92, r: 0.045, h: 0.04, k: 4, mat: 'pwL', w: () => wT }));
  // -- the knee cop
  const kPick = (q) => q.p[0] * sg > 0.1 && shareW(B, q.w, 'thigh', 'calf') > 0.8 && len(sub(q.p, kn)) < 0.9;
  const k0 = lerp(hp, kn, 0.84), k1 = lerp(kn, an, 0.14);
  const KN = limbWrap(B, k0, k1, sg, { t: [0, 1], nt: 10, a: [-PI, PI], closed: true, na: 28, pick: kPick, smooth: 4, shape: (r) => r });
  const wKn = boneW(B, `knee_${s}`);
  const cop = plateOn(KN, { a0: -1.55, a1: 1.55, t0: () => 0.0, t1: () => 1.0, nu: 7, nv: 14, off: (u, v) => 0.16 + 0.1 * Math.sin(PI * u) * Math.sin(PI * v) ** 0.7 });
  out.push(solid(cop, { sheet: true, w: () => wKn, mat: () => 'pwM' }));
  out.push(tube(rowPath(cop, 0, 0, 14, 14), { r: 0.04, k: 4, mat: 'pwL', w: () => wKn }));
  out.push(tube(rowPath(cop, 7, 0, 14, 14), { r: 0.04, k: 4, mat: 'pwL', w: () => wKn }));
  // (the cop's two straps round the back of the knee, studded where they meet it)
  const wKs = nearSkinW(B, kPick, (nm) => legBones(nm), 0.3);
  for (const tt of [0.12, 0.9]) {
    const ring = [...Array(17).keys()].map((j) => { const a = -PI + (2 * PI * j) / 16, q = KN.ta(tt, a); return { p: add(q.p, mul(q.n, 0.17 + 0.05 * Math.max(0, Math.cos(a)) ** 0.5)), n: q.n }; });
    out.push(band(ring, { wide: 0.1, high: 0.03, mat: 'leather', w: wKs, closed: true }));
    for (const a of [1.5, -1.5]) { const q = KN.ta(tt, a); out.push(stud(add(q.p, mul(q.n, 0.2)), q.n, { r: 0.045, h: 0.04, k: 4, mat: 'pwL', w: wKs })); }
  }
  // (the garter straps crossed behind the knee, a pewter stud where they cross)
  for (const sgn of [1, -1]) {
    const path = [...Array(9).keys()].map((m) => { const f = m / 8, q = KN.ta(0.08 + 0.84 * f, PI + sgn * (0.85 - 1.7 * f)); return { p: add(q.p, mul(q.n, 0.21 + 0.015 * sgn)), n: q.n }; });
    out.push(band(path, { wide: 0.1, high: 0.03, mat: 'scrip', w: wKs }));
  }
  { const q = KN.ta(0.5, PI); out.push(stud(add(q.p, mul(q.n, 0.25)), q.n, { r: 0.06, h: 0.05, k: 5, mat: 'pwL', w: wKs })); }
  const kc = cop.at(4.6, 7), ko = unit(add(kc.n, [0, 0.15, 0]));
  out.push(scallop(add(kc.p, add(mul(ko, 0.03), [0, -0.3 * (female ? 0.9 : 1), 0])), ko, [0, 1, 0], { R: female ? 0.48 : 0.54, ribs: 7, span: 1.2, rib: 0.16, dome: 0.26, mat: 'pwL', groove: 'pwS', rim: 'pwL', ears: 'pwL', pearl: 'rune', pearlR: 0.22, w: () => wKn }));
  // -- the shin: the garter and the puttees
  const cPick = (q) => q.p[0] * sg > 0.1 && shareW(B, q.w, 'calf') > 0.6;
  const SH = limbWrap(B, kn, an, sg, { t: [0, 1.02], nt: 20, a: [-PI, PI], closed: true, na: 24, pick: cPick, smooth: 4, shape: (r) => r });
  const wCa = nearSkinW(B, (q) => cPick(q) || (q.p[0] * sg > 0.1 && shareW(B, q.w, 'calf', 'foot') > 0.6 && q.p[1] > an[1] - 0.1), (nm) => legBones(nm) && !/^(ball|toes)/.test(nm), 0.3);
  out.push(wrapBand(SH, { t0: 0.86, t1: 0.2, turns: 6.5, steps: 8, a0: PI / 2, dir: sg, off: () => 0.07, lap: 0.035, w: wCa, mat: () => 'linen', edge: 'linenD', edgeR: 0.022 }));
  const gt = 0.16, ring = [...Array(17).keys()].map((j) => { const a = -PI + (2 * PI * j) / 16, q = SH.ta(gt, a); return { p: add(q.p, mul(q.n, 0.155)), n: q.n }; });
  out.push(band(ring, { wide: 0.13, high: 0.035, mat: 'leather', w: wCa, closed: true }));
  { const q = SH.ta(gt, 1.2), bp = add(q.p, mul(q.n, 0.2)), fr = frameAt(q.n, [0, 1, 0]);
    out.push(tube([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, yy]) => ({ p: add(bp, add(mul(fr.x, x * 0.08), mul(fr.y, yy * 0.08))), n: q.n })), { r: 0.025, k: 3, mat: 'pwL', w: wCa, closed: true })); }
  return out;
}
export function pewterLegs(B) {
  return { P: coverHides(B, merge(smoothWeights(hose(B), 6, (p) => p[1] > B.at.knee.l[1] + 0.6), ...legOf(B, 'l'), ...legOf(B, 'r')), 0.5), dropAt: (f) => f.mat === 'hoseW' };
}

/* ---- boots ------------------------------------------------------------------------------------------------------------ */
/**
 * One foot's road boot: brown leather over the foot to above the ankle on a thick hobnailed sole, its top turned down in
 * a broad cuff of rough suede; a cast pewter toe cap riveted over the toes, a pewter heel plate, and a strap over the
 * instep buckled in pewter round a pearl (lit when enchanted).
 */
function roadBoot(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, an = A.ankle[s], ball = A.ball[s], out = [];
  const female = B.who === 'female';
  const fPick = (q) => q.p[0] * sg > 0.1 && shareW(B, q.w, 'foot') > 0.6;
  const toes = skinSamples(B).filter(fPick);
  const tip = toes.reduce((b, q) => (q.p[2] > b[2] ? q.p : b), [0, 0, -9]);
  const from = [an[0], an[1] - 0.05, an[2] + 0.05], to = [tip[0], A.floor + 0.22, tip[2] + 0.1];
  const tBall = along(ball, from, to), tToe = along(tip, from, to);
  const FT = limbWrap(B, from, to, sg, { front: [0, 1, 0], t: [0, 1.0], nt: 26, a: [-PI, PI], closed: true, na: 24, pick: fPick, smooth: 4,
    shape: (r, t) => r * (t > 0.86 ? Math.max(0.05, Math.sqrt(Math.max(0, 1 - ((t - 0.86) / 0.145) ** 2))) : 1) });
  const wFoot = boneW(B, `foot_${s}`), wBall = boneW(B, `ball_${s}`);
  // -- the toe cap: pewter over the toes from the ball, its edge rolled, rivets along it
  const TU = 6, TV = 12;
  const toe = plateOn(FT, { a0: -1.75, a1: 1.75, t0: () => 0.9, t1: () => 0.99, nu: 2, nv: TV, off: () => 0.035 });
  out.push(solid(toe, { sheet: true, w: () => wBall, mat: () => 'pw' }));
  out.push(tube(rowPath(toe, 0, 0, TV, TV, 0.01), { r: 0.03, k: 3, mat: 'pwL', w: () => wBall }));
  out.push(...studsAlong(rowPath(toe, 0.6, 1, TV - 1, TV, 0.01), 5, { r: 0.035, h: 0.03, k: 4, mat: 'pwL', w: () => wBall }));
  // -- the instep strap and its buckle round a pearl
  const sT = (tBall + 0.12) / 2;
  const strap = [...Array(13).keys()].map((j) => { const a = -1.75 + (3.5 * j) / 12, q = FT.ta(sT, a); return { p: add(q.p, mul(q.n, 0.1)), n: q.n }; });
  out.push(band(strap, { wide: 0.14, high: 0.035, mat: 'leatherD', w: () => wFoot }));
  { const q = FT.ta(sT, 0.75 * sg), o = unit(add(q.n, [0, 0.3, 0])), bp = add(q.p, mul(o, 0.14)), fr = frameAt(o, unit(sub(to, from)));
    out.push(tube([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, yy]) => ({ p: add(bp, add(mul(fr.x, x * 0.09), mul(fr.y, yy * 0.12))), n: o })), { r: 0.03, k: 3, mat: 'pwL', w: () => wFoot, closed: true }));
    out.push(stud(bp, o, { r: 0.1, h: 0.1, k: 6, mat: 'rune', w: () => wFoot })); }
  // -- the heel strip: a narrow riveted pewter strap up the back of the heel
  {
    const heel = toes.filter((q) => Math.abs(q.p[0] - an[0]) < 0.25);
    const pts = [...Array(6).keys()].map((m) => { const yy = A.floor + 0.14 + (an[1] - 0.05 - A.floor - 0.14) * (m / 5), near = heel.filter((q) => Math.abs(q.p[1] - yy) < 0.12); const q = near.reduce((b2, x) => (x.p[2] < b2.p[2] ? x : b2), near[0] ?? heel[0]); return { p: add(q.p, mul([0, 0, -1], 0.07)), n: [0, 0, -1] }; });
    out.push(band(pts, { wide: 0.12, high: 0.03, mat: 'pw', w: () => wFoot }));
    out.push(...studsAlong(pts, 3, { from: 0.15, to: 0.85, r: 0.035, h: 0.03, k: 4, mat: 'pwL', w: () => wFoot }));
  }
  // -- the cuff: the boot's top turned down, broad, flared, over the puttees' foot
  const cPick = (q) => q.p[0] * sg > 0.1 && shareW(B, q.w, 'calf', 'foot') > 0.7 && q.p[1] > an[1] - 0.25 && q.p[1] < an[1] + 0.9;
  const kn = A.knee[s];
  const SH = limbWrap(B, kn, an, sg, { t: [0.75, 1.05], nt: 8, a: [-PI, PI], closed: true, na: 20, pick: cPick, smooth: 3, shape: (r) => r });
  const wC = nearSkinW(B, cPick, (nm) => nm.endsWith(`_${s}`) && !/^(ball|toes)/.test(nm), 0.3);
  const cTop = 0.85, cBot = 0.97;
  const cuff = plateOn(SH, { a0: -PI, a1: PI, closed: true, t0: () => cBot, t1: () => cTop, nu: 3, nv: 20, off: (u) => 0.24 + 0.08 * (1 - u) });
  out.push(solid(cuff, { w: wC, thick: 0.04, mat: () => 'suede', inner: 'leatherD', edge: 'leatherD' }));
  out.push(tube(rowPath(cuff, 0, 0, 20, 20), { r: 0.04, k: 4, mat: 'leatherD', w: wC, closed: true }));
  return out;
}
/** The boot's leather over the foot and the ankle, close over the skin, on a thick hobnailed sole. */
function bootShell(B) {
  const A = B.at;
  const P = shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'foot', 'calf') > 0.6 && p[1] < A.ankle[s][1] + 0.4; },
    off: ({ n, p }) => { const s = p[0] >= 0 ? 'l' : 'r'; return 0.035 + (n[1] < -0.6 ? 0.07 : 0); },
    mat: ({ n }) => (n[1] < -0.55 ? 'sole' : 'boot'),
  });
  P.soles = P.V.map((_, i) => i).filter((i) => P.V[i][1] < A.floor + 0.12);
  return P;
}
export function pewterBoots(B) {
  const A = B.at, out = [bootShell(B)];
  // (hobnails round the sole's edge, seen from the side)
  for (const s of ['l', 'r']) {
    const sg = s === 'l' ? 1 : -1, wF = boneW(B, `foot_${s}`), wB = boneW(B, `ball_${s}`);
    const rim = skinSamples(B).filter((q) => q.p[0] * sg > 0.1 && shareW(B, q.w, 'foot') > 0.6 && q.p[1] < A.floor + 0.25 && Math.abs(q.n[1]) < 0.5);
    rim.filter((_, i) => i % Math.max(1, Math.floor(rim.length / 14)) === 0).slice(0, 14).forEach((q) => out.push(stud(add(q.p, mul(q.n, 0.06)), q.n, { r: 0.035, h: 0.03, k: 4, mat: 'pwL', w: () => (q.p[2] > A.ball[s][2] - 0.1 ? wB : wF) })));
    out.push(...roadBoot(B, s));
  }
  return merge(...out);
}
