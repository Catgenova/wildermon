// The fur set: the tundra raider, a hunter-warrior of the frozen north who wears what he has hunted, built with the
// plate kit (tools/sculpt/garments/platekit.mjs) and the set's own builders (tools/sculpt/garments/kit/fur.mjs): every
// pelt laid as locks of fur (a dark undercoat, pale tips), bone, horn and amber as hard parts of their own, sinew and
// thongs as cords.
//
//   helm    the wolf's head worn as a hood: the grey wolf's skull over the crown, its muzzle out over the brow with the
//           upper jaw's fangs, the eyes dark hollows, the ears up; its pelt round the face and down over the neck and
//           the shoulders' tops in shaggy locks; a thong of bone and amber beads across the brow.
//   chest   a coat of grey wolf to the hips in shaggy locks (a dark saddle behind, a ragged hem), a white arctic fox
//           collar, a breast panel of glossy seal leather sewn in with sinew, a bone breastplate of ribs lashed to a
//           sternum bar set with three amber runes, a belt hung with claws and teeth; seal sleeves under a mane of wolf
//           over each shoulder, bone wrist guards lashed on, fox cuffs.
//   mantle  a snow leopard's whole pelt: a shaggy mane round the neck and over the shoulders, the hide down the back to
//           the knees (smoky, rosetted, a fawn wash and a dark stripe down the spine), its hind legs as lappets with bone
//           charms, its ringed tail; the forelegs knotted at the throat over a bone clasp with a great amber, the paws
//           hanging on the breast.
//   legs    hide breeches under reindeer fur worn fur out to mid-calf, leather knee pads sewn in a zigzag with a bone
//           disc, thongs crossed down the shins, a grey wolf loincloth before and behind with an amber charm.
//   boots   mukluks: soft hide on a thick sole sewn round its welt, reindeer fur to mid-calf, a deep fox cuff, a string
//           of amber beads under it, a thong round the ankle tied with bone toggles.
//
// Enchanted, these light and nothing else: the amber beads across the brow and at the temples, the breastplate's runes,
// the clasp's amber, the loincloth's charm and the boots' beads.
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, smooth, merge, nearestOf, shell, on, part, loft } from './metalkit.mjs';
import {
  boneW, patch, solid, tube, band, rowPath, colPath, studsAlong, stud, wrapAngle, skinSamples, shareW, wrap, plateOn, nearSkinW, smoothWeights,
  coverHides, limbWrap, skinW, along, mixOf, mixW, torsoWrap, pathOn, sweep, roundProfile, face,
} from './platekit.mjs';
import { headDome, headW, torsoField, torsoMarks, frameAt, locks, pelt, cone, bead, stitch, rosette, hash, even, clear, TORSO_BONES } from './kit/fur.mjs';

const PI = Math.PI;

export const FUR_MATS = {
  // (the grey wolf: a dark undercoat, grey-brown guard hairs, pale tips, cream at the cheeks and throat)
  wolfD: { c: '#4a4038', kind: 2 },
  wolf: { c: '#857868', kind: 2 },
  wolfL: { c: '#bcb09b', kind: 2 },
  wolfW: { c: '#ddd5c5', kind: 2 },
  // (the wolf's muzzle: its nose and lips black, its palate dark, its eye hollows darker still; its inner ear pale)
  nose: { c: '#171313', kind: 2 },
  mouth: { c: '#4a1d1a', kind: 2 },
  hollow: { c: '#0c0a0a', kind: 2 },
  earIn: { c: '#b89a88', kind: 2 },
  // (the arctic fox: white with a cool grey shade)
  fox: { c: '#ece6da', kind: 2 },
  foxS: { c: '#b9b2a6', kind: 2 },
  // (seal leather, dark and oiled: its face, its seams' shade, its sheen)
  seal: { c: '#5b4232', kind: 2 },
  sealD: { c: '#2a1d17', kind: 3 },
  sealL: { c: '#6e533f', kind: 3 },
  // (the snow leopard: smoke-white, its shade grey, its rosettes charcoal round fawn)
  snow: { c: '#cbc3b4', kind: 2 },
  snowS: { c: '#958d80', kind: 2 },
  snowF: { c: '#c2b090', kind: 2 },
  snowD: { c: '#6f665b', kind: 2 },
  spot: { c: '#35312e', kind: 2 },
  fawn: { c: '#c4ad86', kind: 2 },
  // (the reindeer: warm brown with pale tips and a dark undercoat)
  deer: { c: '#6f533b', kind: 2 },
  deerL: { c: '#b09474', kind: 2 },
  deerD: { c: '#3a2a1f', kind: 2 },
  // (the hide under the fur, and its waist: left out under a chest piece)
  hide: { c: '#4a3628', kind: 2 },
  hideW: { c: '#4a3629', kind: 2 },
  // (the mukluks' soft hide, pale and smoked)
  tan: { c: '#8c6c4d', kind: 2 },
  tanD: { c: '#5e4632', kind: 2 },
  // (bone and ivory, polished and shaded; horn)
  bone: { c: '#e4d8ba', kind: 2 },
  boneS: { c: '#a89878', kind: 2 },
  // (amber: honey plain, lit in the enchantment's colour)
  rune: { c: '#c4852c', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  // (the thongs and the seal leather)
  leather: { c: '#5b3b26', kind: 2 },
  leatherD: { c: '#36231a', kind: 2 },
  sinew: { c: '#cdbb92', kind: 2 },
  sole: { c: '#2b1d16', kind: 2 },
};
const female = (B) => B.who === 'female';

/* ---- the helm: the wolf's head ------------------------------------------------------------------------------------ */
/**
 * The wolf hood: the grey wolf's pelt round the head and the face, closed under the chin and falling over the neck to
 * the shoulders' tops and the upper back in shaggy locks; over the crown the wolf's skull, its muzzle out over the brow
 * (black nose and lips, the upper jaw's fangs and teeth), its eyes dark hollows under a brow ridge, its ears standing;
 * across the brow a thong strung with bone beads and amber (lit when enchanted). The head's part rigid on the head; the
 * pelt below the jaw on the neck and the shoulders.
 */
export function furHelm(B) {
  const A = B.at, M = torsoMarks(B), F = female(B), k = F ? 0.86 : 1, out = [];
  const H = headDome(B, { fit: F ? 0.13 : 0.16 });
  const zc = torsoField(B).zc, c = H.c;
  const front = (a) => Math.abs(wrapAngle(a));
  const hs = H.hs;
  const chinY = hs.filter((q) => Math.abs(q.p[0]) < 0.25 && q.p[2] > H.zf - 0.75).reduce((b, q) => Math.min(b, q.p[1]), 9);
  // (the face's top: over the brows, so the eyes and the brows show under the wolf's jaw)
  const browY = B.A.polys.filter(([, m]) => m === 1).flatMap(([v]) => v.map((i) => B.V[i][1])).reduce((a, b) => Math.max(a, b), -9) + (F ? 0.06 : 0.05);
  // -- the hood's field: round the head and down over the neck, hung below the jaw
  const yHem = (a) => {
    const f = front(a), yf = M.neckF - (F ? 0.28 : 0.34), ys = A.shoulder.l[1] + (F ? 0.4 : 0.36), yb = M.neckB - (F ? 0.6 : 0.7);
    // (its edge tufted: uneven tongues of pelt)
    const tuft = 0.1 * Math.sin(a * 7 + 0.6) + 0.07 * Math.sin(a * 13 + 2.1);
    return (f < PI / 2 ? lerp([0, yf, 0], [0, ys, 0], smooth(0, PI / 2, f) ** 0.8)[1] : lerp([0, ys, 0], [0, yb, 0], smooth(PI / 2 + 0.55, PI, f))[1]) + tuft;
  };
  const y0 = Math.min(M.neckF - 0.4, M.neckB - 0.75) - 0.25, y1 = H.top + 0.25;
  const zAt = (yy) => lerp([0, 0, zc(yy)], [0, 0, c[2]], smooth(A.neck[1] - 0.2, A.head[1] + 0.2, yy))[2];
  const pick = (q) => shareW(B, q.w, 'head', 'neck', 'torso', 'shoulder') > 0.85 && shareW(B, q.w, 'upperarm') < 0.05 && q.p[1] > y0 - 0.4;
  const tOf = (p) => (p[1] - y0) / (y1 - y0), ty = (yy) => (yy - y0) / (y1 - y0), tChin = tOf([0, chinY, 0]);
  // (laid over the skin and over the coat's neck and shoulders, so the hood lies on the coat when both are worn)
  const coatPts = [];
  for (const P of [...coat(B).parts, ...armOf(B, 'l'), ...armOf(B, 'r')]) P.V.forEach((p) => { if (p[1] > Math.max(y0 - 0.2, A.shoulder.l[1] - 0.35) && p[1] < A.neck[1] + 0.1) coatPts.push(p); });
  const G = wrap(B, {
    t: [0, 1], nt: 34, closed: true, na: 48, a: [-PI, PI], points: [...skinSamples(B).filter(pick).map((q) => q.p), ...coatPts], smooth: 3, tOf,
    frame: (t) => { const yy = y0 + (y1 - y0) * t; return { o: [0, yy, zAt(yy)], u: [0, 1, 0], f: [0, 0, 1], s: [1, 0, 0] }; },
    // (from the jaw down it hangs: never nearer the middle than anything above it)
    // (hung only from the jaw over the throat; below that it lies on the neck and the shoulders, draped)
    post: (R, T) => { for (let i = R.length - 2; i >= 0; i--) if (T[i] < tChin && T[i] > ty(chinY - 0.55)) for (let j = 0; j < R[i].length; j++) R[i][j] = Math.max(R[i][j], R[i + 1][j]); },
    // (over the head thick, as a skull under a pelt; standing off the neck and the shoulders below the jaw)
    shape: (r, t) => r + (F ? 0.1 : 0.12) + 0.06 * smooth(ty(browY), ty(H.top - 0.4), t) + (F ? 0.3 : 0.32) * smooth(ty(chinY + 0.1), ty(chinY - 0.2), t) - 0.04 * smooth(ty(chinY - 0.55), ty(chinY - 1.1), t),
  });
  // (weights: on the head above the jaw, the neck's below it, the shoulders' at the sides low down)
  // (nearSkinW gives back the skin's own weights where none of the bones asked for is near: the neck's there instead)
  const W2n = nearSkinW(B, pick, (n) => ['neck_01', 'spine_03', 'clavicle_l', 'clavicle_r'].includes(n), 0.35), wNeck = mixOf(B, [['neck_01', 0.6], ['spine_03', 0.4]]);
  const W2 = (p) => { const w = W2n(p); return w.every(([b]) => ['neck_01', 'spine_03', 'clavicle_l', 'clavicle_r'].includes(B.bones[b].name)) ? w : wNeck; };
  const wH = boneW(B, 'head');
  const Wt = nearSkinW(B, (q) => shareW(B, q.w, 'torso') > 0.7, (n) => TORSO_BONES.has(n), 0.35);
  const shOf = (s) => mixOf(B, [[`shoulder_${s}`, 0.3], [`upperarm_${s}`, 0.05], [`clavicle_${s}`, 0.65]]);
  const W = (p) => {
    const kh = smooth(chinY + 0.3, chinY - 0.05, p[1]), ks = smooth(chinY - 0.1, A.neck[1] - 0.45, p[1]) * smooth(0.55, 1.5, Math.abs(p[0]));
    const kt = smooth(A.neck[1] - 0.2, A.neck[1] - 0.75, p[1]) * (1 - ks);
    return mixW([[wH, 1 - kh], [W2(p), Math.max(0, kh - ks - kt)], [Wt(p), kt], [shOf(p[0] > 0 ? 'l' : 'r'), ks]]);
  };
  // -- the pelt: round the sides and the back from the hem to the crown; over the brow; under the chin to the hem
  const half = F ? 0.88 : 0.92;
  const NU = 14, NV = 30;
  const main = plateOn(G, { a0: half, a1: 2 * PI - half, t0: (a) => ty(yHem(a)), t1: () => 1, nu: NU, nv: NV, off: () => 0 });
  const brow = plateOn(G, { a0: -half - 0.06, a1: half + 0.06, t0: () => ty(browY), t1: () => 1, nu: 6, nv: 10, off: () => 0 });
  const bibTop = (a) => chinY - 0.16 + (F ? 0.4 : 0.44) * smooth(0.1, half, front(a)) ** 1.5;
  const bib = plateOn(G, { a0: -half - 0.06, a1: half + 0.06, t0: (a) => ty(yHem(a)), t1: (a) => ty(bibTop(a)), nu: 6, nv: 10, off: () => 0.06 });
  const hoodP = smoothWeights(merge(solid(main, { sheet: true, w: W, mat: () => 'wolfD' }), solid(brow, { sheet: true, w: W, mat: () => 'wolf' }), solid(bib, { sheet: true, w: W, mat: () => 'wolfD' })), 8);
  out.push(hoodP);
  const onH = (p) => hoodP.W[nearestOf(hoodP.V, p)];
  // -- its fur: rows of locks from the crown down the back and the sides, pale at the cheeks and under the chin
  const tone = (k2, r, p) => {
    // (none on the neck's sides under the jaw, where the head turns against the shoulders)
    if (Math.abs(p[0]) > 0.4 && Math.abs(p[0]) < 1.2 && p[1] < chinY + 0.5 && p[1] > chinY - 0.8 && p[2] > c[2] - 0.45) return [null, null];
    const h = hash(k2 * 3 + r, r * 7 + 1), cheek = Math.abs(p[0]) < 0.75 && p[2] > c[2] + 0.2 && p[1] < browY;
    if (cheek) return h > 0.5 ? ['wolf', 'wolfL', 'wolfW'] : ['wolfD', 'wolf', 'wolfL'];
    // (a dark saddle down the crown and the back, grey with pale tips at the sides)
    const saddle = Math.abs(p[0]) < 0.45 && p[2] < c[2] + 0.5;
    return saddle ? (h < 0.6 ? ['wolfD', 'wolfD', 'wolf'] : ['wolfD', 'wolf', 'wolf']) : h < 0.2 ? ['wolfD', 'wolf', 'wolf'] : h < 0.65 ? ['wolfD', 'wolf', 'wolfL'] : ['wolf', 'wolfL', 'wolfL'];
  };
  // (each row only where the pelt is: round from the back as far as the hem is below it)
  const reachA = (yy, from, to) => { for (let m = 0; m <= 60; m++) { const a = from + ((to - from) * m) / 60; if (yHem(a) <= yy + 0.02) return a; } return to; };
  // (below the shoulders' tops only behind, clear of the arms)
  const sideA = (yy) => Math.max(reachA(yy, PI / 2, PI) > PI / 2 + 0.01 ? reachA(yy, half - 0.05, PI) : half - 0.05, yy < A.shoulder.l[1] + 0.2 ? PI / 2 + 0.8 : 0);
  const eyeY = browY + (F ? 0.56 : 0.62), tCrown = ty(eyeY + 0.16);
  // (the crown all round, down to over the wolf's eyes; then the sides and the back to the hem)
  // (on the crown the fur lies back from the muzzle over the skull)
  out.push(pelt(G, { t1: ty(H.top - 0.12), t0: tCrown, rows: 3, closed: true, per: 2.3, off: () => 0.015, lap: 0.7, curl: 0.035, fringe: 1, fall: (p, d, n) => sub([0, -0.25, -1], mul(n, dot([0, -0.25, -1], n))), mat: tone, w: onH }));
  out.push(pelt(G, { t1: tCrown, t0: ty(yHem(PI)) + 0.005, rows: 8, a0: (t) => sideA(y0 + (y1 - y0) * t), a1: (t) => 2 * PI - sideA(y0 + (y1 - y0) * t), per: 2.2, off: () => 0.02, lap: 0.7, curl: 0.07, fringe: 1.25, lean: 0.6, maxLen: (p) => Math.max(0.12, p[1] - yHem(Math.atan2(p[0], p[2] - zAt(p[1]))) + (Math.abs(p[0]) > 1.0 ? 0.08 : 0.3)), fall: (p, d, n) => add(d, mul(n, 0.3)), tipW: 0.3, mat: tone, w: W }));
  // (the sides' lower rows round the face down to the hem before, and the bib's)
  out.push(pelt(G, { t1: ty(chinY - 0.14), t0: ty(yHem(0.4)) + 0.01, rows: 3, a0: () => -half - 0.05, a1: () => half + 0.05, per: 3, off: () => 0.14, lap: 0.55, curl: 0.26, tipW: 0.2, fringe: 1.1, fall: (p, d, n) => add(d, mul(n, 0.45)), mat: (k2, r, p) => (hash(k2, r) > 0.5 ? ['wolf', 'wolfL', 'wolfW'] : ['wolfD', 'wolf', 'wolfL']), w: onH }));
  // (a ruff of pale locks round the face's edge, standing out a little)
  const faceEdge = [];
  for (let s = 0; s <= 8; s++) faceEdge.push(G.ta(ty(browY + (bibTop(half) - browY) * (s / 8)), half));
  for (let s = 1; s < 10; s++) { const a = half - (2 * half * s) / 10; faceEdge.push(G.ta(ty(bibTop(a)), a)); }
  for (let s = 0; s <= 8; s++) faceEdge.push(G.ta(ty(bibTop(half) + (browY - bibTop(half)) * (s / 8)), -half));
  const ruffPath = faceEdge.map((q) => ({ p: add(q.p, mul(q.n, 0.02)), n: q.n, d: unit(add(q.n, mul(unit([q.p[0], 0, 0.0001]), 0.4))) }));
  // (outward from the face, so they frame it rather than cover it)
  out.push(locks(ruffPath.map((q) => ({ ...q, d: unit(sub(q.d, mul(q.n, 0))) })), { count: 15, w: (p) => (p[1] > chinY - 0.3 ? wH : onH(p)), len: 0.2 * k, curl: 0.1, split: 0.45, mat: (k2) => (hash(k2, 2) > 0.5 ? ['wolf', 'wolfL', 'wolfW'] : ['wolfD', 'wolf', 'wolfL']) }));
  // -- the wolf's head over the crown: the muzzle out over the brow
  const fq = G.ta(ty(browY + (F ? 0.3 : 0.33)), 0), ax = unit([0, -0.06, 1]), sx = [1, 0, 0], sy = unit(cross(ax, sx));
  const root = add(fq.p, mul(ax, -0.14)), L = (F ? 0.86 : 1.0);
  // (rings along the muzzle: half-width, height over its axis, depth under it; its bottom flat, its top rounded)
  const st = [[0, 0.44, 0.32, 0.1], [0.25, 0.42, 0.3, 0.17], [0.5, 0.34, 0.24, 0.19], [0.8, 0.28, 0.2, 0.17], [1.05, 0.24, 0.18, 0.15], [1.2, 0.2, 0.15, 0.12], [1.28, 0.13, 0.1, 0.08]];
  const NR = 12;
  const ringAt = ([s, hw, up, dn]) => {
    const o = add(root, mul(ax, (s * (L + 0.14)) / 1.28)), pts = [];
    for (let j = 0; j < NR; j++) {
      const th = (j / NR) * 2 * PI, cs = Math.cos(th), sn = Math.sin(th);
      // (round over its top and sides, flat beneath)
      const x = hw * k * Math.sign(sn) * Math.abs(sn) ** 0.5, yy = cs > 0 ? up * k * cs ** 0.7 : -dn * k * Math.abs(cs) ** 0.3;
      pts.push(add(o, add(mul(sx, x), mul(sy, yy))));
    }
    return pts;
  };
  const rings = st.map(ringAt);
  const muz = part();
  const vi = rings.map((rr) => rr.map((p) => { muz.V.push(p); muz.N.push([0, 1, 0]); muz.W.push(wH); return muz.V.length - 1; }));
  const axisAt = (i) => add(root, mul(ax, (st[i][0] * (L + 0.14)) / 1.28));
  for (let i = 0; i + 1 < rings.length; i++) for (let j = 0; j < NR; j++) {
    const j1 = (j + 1) % NR, q = [vi[i][j], vi[i][j1], vi[i + 1][j1], vi[i + 1][j]];
    const m = mul(q.reduce((s, x) => add(s, muz.V[x]), [0, 0, 0]), 0.25), under = dot(sub(m, axisAt(i)), sy) < -0.06 * k;
    // (the palate under it dark, the lips black along its lower edge, the nose black at its end, the bridge pale-tipped)
    const tipSeg = i >= rings.length - 2;
    // (pale down its sides to the lips, a darker saddle along its bridge from the brow)
    const ux = Math.abs(dot(sub(m, axisAt(i)), sx)) / (st[i][1] * k), uy = dot(sub(m, axisAt(i)), sy);
    const mat = under ? 'mouth' : tipSeg ? 'nose' : ux > 0.55 ? (uy < 0.02 ? 'wolfW' : 'wolfL') : i < 2 ? 'wolfD' : 'wolf';
    face(muz, q, sub(m, lerp(axisAt(i), axisAt(i + 1), 0.5)), mat);
  }
  { const tipC = axisAt(rings.length - 1), ci = muz.V.push(add(tipC, mul(ax, 0.02))) - 1; muz.N.push(ax); muz.W.push(wH); for (let j = 0; j < NR; j++) face(muz, [vi[rings.length - 1][j], vi[rings.length - 1][(j + 1) % NR], ci], ax, 'nose'); }
  out.push(muz);
  // (the nose's leather: a black pad on the tip; the lips along the muzzle's lower edge)
  const tipA = axisAt(rings.length - 1);
  out.push(stud(add(tipA, add(mul(sy, 0.06 * k), mul(ax, -0.03))), unit(add(ax, mul(sy, 0.5))), { r: 0.13 * k, h: 0.08, k: 6, mat: 'nose', w: () => wH }));
  for (const sg of [1, -1]) {
    const lip = [];
    for (let i = 1; i < rings.length; i++) { const [s, hw, , dn] = st[i]; lip.push({ p: add(axisAt(i), add(mul(sx, sg * hw * k * 0.92), mul(sy, -dn * k * 0.85))), n: unit(add(mul(sx, sg), mul(sy, -0.3))) }); }
    out.push(tube(lip, { r: 0.035, k: 3, mat: 'nose', w: () => wH }));
    // (the canine at the front of the jaw, long and curved back; a cheek tooth behind it)
    const fA = lerp(axisAt(4), axisAt(5), 0.3), fc = add(fA, add(mul(sx, sg * 0.21 * k), mul(sy, -0.14 * k)));
    out.push(cone(fc, [0, -1, 0.12], { r: 0.065 * k, L: 0.4 * k, k: 4, mat: 'bone', tipMat: 'bone', toward: [0, 0, -1], bend: 0.25, w: () => wH }));
    const mA = axisAt(3), mc = add(mA, add(mul(sx, sg * 0.27 * k), mul(sy, -0.15 * k)));
    out.push(cone(mc, [0, -1, 0], { r: 0.035 * k, L: 0.12 * k, k: 3, mat: 'bone', w: () => wH }));
  }
  // (the front teeth between the canines)
  for (let m = 0; m < 4; m++) {
    const x = (-0.12 + 0.08 * m) * k, tc = add(lerp(axisAt(5), axisAt(6), 0.4), add(mul(sx, x), mul(sy, -0.12 * k)));
    out.push(cone(tc, [0, -1, 0.1], { r: 0.025 * k, L: 0.09 * k, k: 3, mat: 'bone', w: () => wH }));
  }
  // -- the brow ridges over the eyes and the eye hollows under them, where the muzzle meets the skull
  for (const sg of [1, -1]) {
    const ea = sg * (F ? 0.4 : 0.42), ey = eyeY, eq = G.ta(ty(ey), ea);
    const n = eq.n, fr = frameAt(n, [0, 1, 0]), ec = add(eq.p, mul(n, 0.045));
    // (an almond: its outer corner higher, as a wolf's)
    const eye = patch((u, v) => {
      const th = v * 2 * PI, rx = 0.21 * k * u, ry = 0.105 * k * u, x = Math.cos(th) * rx, yy = Math.sin(th) * ry + 0.05 * sg * Math.cos(th) * rx * (sg > 0 ? 1 : -1);
      return { p: add(ec, add(add(mul(fr.x, x), mul(fr.y, yy)), mul(n, -0.012 * (1 - u)))), n };
    }, 2, 10, { closed: true });
    out.push(solid(eye, { sheet: true, w: () => wH, mat: () => 'hollow' }));
    // (the ridge over it: a lock of dark fur)
    const ridge = [...Array(6).keys()].map((m) => { const f = m / 5, q = G.ta(ty(ey + 0.12 + 0.04 * Math.sin(PI * f)), ea + sg * (-0.24 + 0.48 * f)); return { p: add(q.p, mul(q.n, 0.05)), n: q.n }; });
    out.push(tube(ridge, { r: 0.05 * k, k: 3, mat: 'wolfD', w: () => wH }));
    // (the pale mask round it and the pale spot over it, as a wolf's)
    const mask = patch((u, v) => { const th = v * 2 * PI, q = G.ta(ty(ey + 0.05 + Math.sin(th) * 0.15 * k * u), ea + sg * 0.04 + Math.cos(th) * 0.3 * k * u); return { p: add(q.p, mul(q.n, 0.015)), n: q.n }; }, 2, 12, { closed: true });
    out.push(solid(mask, { sheet: true, w: () => wH, mat: () => 'wolfW' }));
  }
  // -- the ears, standing at the crown's sides, a little out and back: pelt outside, pale within
  for (const sg of [1, -1]) {
    const eq = G.ta(ty(H.top - (F ? 0.32 : 0.36)), sg * 0.95), up = unit(add([0, 1, 0], add(mul([sg, 0, 0], 0.32), [0, 0, -0.12])));
    const fwd = unit(sub([0, 0, 1], mul(up, up[2]))), side = unit(cross(up, fwd));
    const b0 = add(eq.p, mul(up, -0.06)), bw = 0.27 * k, bd = 0.14 * k, hh = 1.12 * k;
    const ear = part(), put = (p) => { ear.V.push(p); ear.N.push(up); ear.W.push(wH); return ear.V.length - 1; };
    const fl = put(add(b0, add(mul(side, -bw), mul(fwd, bd)))), frn = put(add(b0, add(mul(side, bw), mul(fwd, bd)))), bl = put(add(b0, add(mul(side, -bw * 0.8), mul(fwd, -bd)))), br = put(add(b0, add(mul(side, bw * 0.8), mul(fwd, -bd))));
    const tip = put(add(b0, add(mul(up, hh), mul(fwd, -0.05))));
    // (the inner ear a hollow: its middle sunk back from the front's rim)
    const cupC = put(add(b0, add(mul(up, hh * 0.35), mul(fwd, bd * 0.1))));
    face(ear, [fl, cupC, tip], fwd, 'earIn'); face(ear, [cupC, frn, tip], fwd, 'earIn'); face(ear, [fl, frn, cupC], fwd, 'earIn');
    face(ear, [frn, br, tip], side, 'wolfD'); face(ear, [bl, fl, tip], mul(side, -1), 'wolfD'); face(ear, [br, bl, tip], mul(fwd, -1), 'wolfD');
    out.push(ear);
    // (a pale tuft at the ear's root before)
    out.push(locks([{ p: add(b0, add(mul(side, -bw), mul(fwd, bd + 0.01))), n: fwd }, { p: add(b0, add(mul(side, bw), mul(fwd, bd + 0.01))), n: fwd }], { count: 3, down: up, len: 0.2 * k, curl: 0.05, root: 'wolfL', tip: 'wolfW', w: () => wH }));
  }
  // -- the brow thong: across the brow from temple to temple, strung with bone beads and amber (lit when enchanted)
  const thong = [];
  for (let s = 0; s <= 12; s++) { const a = -half - 0.02 + ((2 * half + 0.04) * s) / 12, q = G.ta(ty(browY + 0.03), a); thong.push({ p: add(q.p, mul(q.n, 0.04)), n: q.n }); }
  out.push(tube(thong, { r: 0.03, k: 3, mat: 'leatherD', w: () => wH }));
  const TE = even(thong, 10);
  TE.forEach((q, m) => {
    if (m === 0 || m === 10) return;
    const amber = m % 2 === 1 && m >= 3 && m <= 7;
    const ax2 = unit(sub(TE[Math.min(10, m + 1)].p, TE[m - 1].p));
    out.push(bead(add(q.p, mul(q.n, 0.03)), ax2, { r: amber ? 0.115 * k : 0.075 * k, h: amber ? 0.09 * k : 0.09 * k, k: 5, mat: amber ? 'rune' : 'bone', w: () => wH }));
  });
  // (from each temple a strand hung down beside the cheek: bone, amber, bone, and a wolf's fang at its end)
  for (const sg of [1, -1]) {
    const q = G.ta(ty(browY + 0.03), sg * (half + 0.02)), top = add(q.p, mul(q.n, 0.1)), n = q.n;
    const dn = unit(sub([0, -1, 0], mul(n, dot([0, -1, 0], n))));
    const at = (f) => add(top, add(mul(dn, f), mul(n, 0.03 * f)));
    const len2 = F ? 0.62 : 0.72;
    out.push(tube([{ p: top, n }, { p: at(len2), n }], { r: 0.02, k: 3, mat: 'leatherD', w: (p) => W(p) }));
    [['bone', 0.12, 0.07], ['rune', 0.33, 0.15], ['bone', 0.55, 0.07]].forEach(([m, f, r]) => out.push(bead(at(f * len2 / 0.72), dn, { r: r * k, h: (m === 'rune' ? 0.12 : 0.08) * k, k: 5, mat: m, w: (p) => W(p) })));
    out.push(cone(at(len2), dn, { r: 0.04 * k, L: 0.2 * k, k: 4, mat: 'bone', toward: n, bend: 0.3, w: (p) => W(p) }));
  }
  // (the hood's locks below the jaw kept off the neck and the shoulders)
  const P = clear(B, merge(...out), 0.3, (q) => headW(B, q.w) < 0.3);
  return coverHides(B, P, 0.5);
}

/* ---- chest & arms: the hunter's coat ----------------------------------------------------------------------------- */
const headOnly = (B, i) => headW(B, B.W[i]);
/** The seal-leather tunic under it all: the torso and the arms to the wrists, close over the skin, the skin under it left out. */
function tunic(B) {
  const A = B.at, M = torsoMarks(B);
  return shell(B, {
    sub: 0, rim: null,
    keep: (i) => { const p = B.V[i]; return on(B, i, 'torso', 'shoulder', 'upperarm', 'forearm', 'neck', 'head', 'thigh') > 0.6 && headOnly(B, i) < 0.05 && on(B, i, 'hand') < 0.35 && p[1] > M.hip - 0.25 && on(B, i, 'thigh') < 0.5 && p[1] < A.neck[1] - 0.02; },
    off: ({ p }) => 0.06 + 0.03 * smooth(M.waist, M.hip, p[1]) - 0.03 * smooth(A.neck[1] - 0.6, A.neck[1] - 0.1, p[1]),
    mat: () => 'seal',
  });
}
/** Where along a row a region reaches: from `from` toward `to`, the last angle `ok(a)` still holds. */
const reachTo = (from, to, ok) => { let last = from; for (let m = 0; m <= 48; m++) { const a = from + ((to - from) * m) / 48; if (!ok(a)) break; last = a; } return last; };

/**
 * The coat: grey wolf over the torso to the hips, fur out, shaggy, its hem a fringe of long locks; a panel of dark seal
 * leather down the breast, sewn in with sinew in a zigzag down each edge; a collar of white arctic fox standing round the
 * neck; a bone breastplate of carved ribs lashed to a sternum bar on the panel, three amber runes set in the bar (lit
 * when enchanted); a belt of dark leather hung with bear claws and wolf teeth, a bone toggle at its buckle.
 */
function coat(B) {
  const A = B.at, M = torsoMarks(B), F = torsoField(B), t = F.tOfY, out = [], Fm = female(B), k = Fm ? 0.88 : 1;
  const W = nearSkinW(B, (q) => shareW(B, q.w, 'torso') > 0.7, (n) => TORSO_BONES.has(n), 0.35);
  const aN = 0.8, side = PI / 2 + 0.04, neckF = M.neckF - 0.1;
  const topF = (a) => { const ax = Math.abs(wrapAngle(a)), yC = neckF + 0.24; if (ax <= aN) return neckF + 0.24 * (ax / aN) ** 2; const q = clamp((ax - aN) / (side - aN)); return M.pit + (yC - M.pit) * Math.sqrt(Math.max(0, 1 - q * q)); };
  const bN = 0.62;
  const topB = (a) => { const bx = PI - Math.abs(wrapAngle(a)), yC = M.neckB + 0.06; if (bx <= bN) return M.neckB - 0.04 + 0.1 * (bx / bN) ** 2; const q = clamp((bx - bN) / (PI - side + 0.04 - bN)); return M.pit + (yC - M.pit) * Math.sqrt(Math.max(0, 1 - q * q)); };
  const hem = M.hip + (Fm ? 0.22 : 0.14);
  const bulge = (yy, a) => (Fm ? 0.04 : 0.06) * Math.exp(-(((yy - lerp(A.chest, [0, M.waist, 0], 0.4)[1]) / 0.9) ** 2)) * Math.max(0, Math.cos(a)) ** 1.5;
  const flare = (yy) => 0.14 * smooth(M.waist + 0.2, hem, yy);
  const off = (yy, a) => 0.17 + bulge(yy, a) + flare(yy);
  const NU = 14, NV = 22;
  const breast = plateOn(F, { a0: -side, a1: side, t0: () => t(hem), t1: (a) => t(topF(a)), nu: NU, nv: NV, off: (u, v, tt, a) => off(F.yOfT(tt), a) });
  const back = plateOn(F, { a0: side - 0.08, a1: 2 * PI - side + 0.08, t0: () => t(hem), t1: (a) => t(topB(a)), nu: NU, nv: 20, off: (u, v, tt, a) => off(F.yOfT(tt), a) });
  out.push(solid(breast, { sheet: true, w: W, mat: () => 'wolf' }));
  // (the saddle down the spine dark under the locks)
  out.push(solid(back, { sheet: true, w: W, mat: () => 'wolfD' }));
  // -- the seal panel down the breast, proud of the fur's roots, its edges sewn in sinew
  const pw = Fm ? 0.46 : 0.5;
  const panel = plateOn(F, { a0: -pw, a1: pw, t0: () => t(hem + 0.02), t1: (a) => t(topF(a)), nu: 10, nv: 8, off: (u, v, tt, a) => off(F.yOfT(tt), a) + 0.03 });
  out.push(solid(panel, { sheet: true, w: W, mat: (i, j) => (j === 0 || j === 7 ? 'sealL' : 'sealD') }));
  for (const j of [0, 8]) out.push(stitch(colPath(panel, j, 0.3, 9.7, 20, 0.0), { count: 11, wide: 0.11, lift: 0.025, r: 0.022, mat: 'sinew', w: W }));
  out.push(tube(rowPath(panel, 10, 0, 8, 8), { r: 0.04, k: 4, mat: 'sealD', w: W }));
  // -- the wolf's fur over the rest: rows of locks on the breast's sides and all round the back, the hem a long fringe
  // (three tones a lock: a dark saddle down the spine, grey with pale tips at the sides, pale toward the belly)
  const tone = (k2, r, p) => { const h = hash(k2 * 5 + r, r + 2), spine = Math.abs(p[0]) < 0.35 && p[2] < F.zc(p[1]), belly = p[2] > F.zc(p[1]) + 0.2; if (spine) return h < 0.5 ? ['wolfD', 'wolf', 'wolf'] : ['wolfD', 'wolf', 'wolfL']; if (belly) return h < 0.5 ? ['wolf', 'wolfL', 'wolfW'] : ['wolfD', 'wolf', 'wolfL']; return h < 0.2 ? ['wolfD', 'wolf', 'wolf'] : h < 0.7 ? ['wolfD', 'wolf', 'wolfL'] : ['wolf', 'wolfL', 'wolfL']; };
  // (the hem's fringe short over the thighs before and at the sides, long behind)
  const maxLen = (p) => { const a = Math.abs(Math.atan2(p[0], p[2] - F.zc(p[1]))); return Math.max(0.1, p[1] - (M.hip - (a > 2.3 ? 0.75 : a > 1.4 ? 0.1 : -0.04))); };
  const rowsTop = Math.max(...[...Array(9).keys()].map((m) => topB(PI + (m - 4) * 0.1)));
  for (const sg of [1, -1]) {
    const a0 = (tt) => sg * (pw - 0.02), a1 = (tt) => sg * reachTo(pw, side, (a) => topF(a) >= F.yOfT(tt) + 0.04);
    out.push(pelt(F, { t1: t(topF(aN) - 0.3), t0: t(hem) + 0.003, rows: 7, a0: sg > 0 ? a0 : a1, a1: sg > 0 ? a1 : a0, per: 2.5, off: (tt, a) => off(F.yOfT(tt), a) + 0.012, lap: 0.8, curl: 0.2, fringe: 1.8, lean: 0.6, maxLen, tipW: 0.3, mat: tone, w: W }));
  }
  out.push(pelt(F, {
    t1: t(rowsTop - 0.04), t0: t(hem) + 0.003, rows: 8,
    a0: (tt) => PI - reachTo(0, PI - side + 0.08, (b) => topB(PI - b) >= F.yOfT(tt) + 0.04) - 0.02, a1: (tt) => PI + reachTo(0, PI - side + 0.08, (b) => topB(PI + b) >= F.yOfT(tt) + 0.04) + 0.02,
    per: 2.5, off: (tt, a) => off(F.yOfT(tt), a) + 0.012, lap: 0.8, curl: 0.2, fringe: 1.8, lean: 0.6, maxLen, tipW: 0.3, mat: tone, w: W,
  }));
  // (the fur's edge round the armholes and the panel's sides: a seam of dark leather)
  for (const sg of [1, -1]) out.push(tube([...Array(13).keys()].map((m) => { const a = sg * (aN + (side - aN) * (m / 12)), q = F.ta(t(topF(a)), a); return { p: add(q.p, mul(q.n, off(q.p[1], a) + 0.01)), n: q.n }; }), { r: 0.045, k: 4, mat: 'sealD', w: W }));
  // -- the arctic fox collar: white locks round the neckline before, laid out over the breast (behind, the hood's pelt lies)
  for (const [mid, half2, top] of [[0, aN + 0.05, topF]]) {
    const tall = mid === 0 ? 1 : 0.6;
    const ring = [...Array(17).keys()].map((m) => { const a = mid - half2 + (2 * half2 * m) / 16, yy = top(a), q = F.ta(t(yy) - 0.006, a); return { p: add(q.p, mul(q.n, off(yy, a) + 0.02)), n: q.n, d: unit(add([0, -0.9, 0], mul(q.n, 0.45))) }; });
    out.push(tube(ring.map((q) => ({ p: add(q.p, mul(q.n, 0.05)), n: q.n })), { r: 0.085 * k, k: 5, mat: 'fox', w: W }));
    for (const [lift2, ln, cnt] of [[0, 0.32, 12], [0.07, 0.24, 11]]) out.push(locks(ring.map((q) => ({ ...q, p: add(q.p, mul(q.n, lift2)) })), { count: cnt, stand: true, phase: lift2 ? 0.5 : 0, len: (k2) => tall * ln * k * (0.8 + 0.4 * hash(k2, 9)), curl: 0.08, split: 0.45, lean: 0.4, w: W, mat: (k2) => (hash(k2, lift2 ? 4 : 5) > 0.35 ? ['foxS', 'fox', 'fox'] : ['fox', 'fox', 'fox']) }));
  }
  // (the neckline rolled in dark seal before, under the hood)
  for (const [mid, half2, top] of [[0, aN, topF]]) out.push(tube([...Array(17).keys()].map((m) => { const a = mid - half2 + (2 * half2 * m) / 16, yy = top(a), q = F.ta(t(yy) - 0.004, a); return { p: add(q.p, mul(q.n, off(yy, a))), n: q.n }; }), { r: 0.045, k: 4, mat: 'sealD', w: W }));
  // -- the bone breastplate: a sternum bar down the panel, ribs curving out and down from it, lashed in sinew
  const lift = (yy, a, d) => { const q = F.ta(t(yy), a); return { p: add(q.p, mul(q.n, off(yy, a) + 0.03 + d)), n: q.n }; };
  const sTop = neckF - (Fm ? 0.3 : 0.28), sBot = M.waist + (Fm ? 0.3 : 0.35);
  const bar = [...Array(9).keys()].map((m) => lift(sTop + (sBot - sTop) * (m / 8), 0, 0.02));
  out.push(band(bar, { wide: 0.3 * k, high: 0.08, mat: 'bone', w: W }));
  for (const sx of [-1, 1]) out.push(tube(bar.map((q) => ({ p: add(add(q.p, mul(q.n, 0.07)), [sx * 0.13 * k, 0, 0]), n: q.n })), { r: 0.025, k: 3, mat: 'boneS', w: W }));
  // (the runes: three amber chips set down the bar)
  for (const f of [0.22, 0.5, 0.78]) { const q = lift(sTop + (sBot - sTop) * f, 0, 0.11); out.push(stud(q.p, q.n, { r: 0.18 * k, h: 0.08, k: 4, mat: 'rune', w: () => W(q.p) })); }
  const ribs = Fm ? 4 : 5;
  for (let r = 0; r < ribs; r++) {
    const y0r = sTop - 0.12 - r * ((sTop - sBot - 0.1) / ribs), span = (Fm ? 0.88 : 1.0) - 0.06 * r;
    for (const sg of [1, -1]) {
      const path = [...Array(8).keys()].map((m) => { const f = m / 7, a = sg * (0.1 + span * f); return lift(y0r - 0.32 * f ** 1.4 * k + (Fm && r === 0 ? 0.04 : 0), a, 0.01 + 0.02 * Math.sin(PI * f)); });
      out.push(sweep(path, { closedProfile: true, mat: 'bone', w: W, profile: (m) => { const wd = (0.1 - 0.04 * (m / 7)) * k; return [[-wd, -0.02], [wd, -0.02], [wd * 0.7, 0.06], [-wd * 0.7, 0.06]]; } }));
      // (the lashing where the rib meets the bar)
      const q = path[0];
      out.push(stitch([q, path[1]], { count: 2, wide: 0.14, lift: 0.04, r: 0.02, mat: 'sinew', w: W }));
    }
  }
  // -- the belt, hung with claws and teeth, a bone toggle at its buckle
  const bY = M.waist - 0.06, BV = 32;
  const belt = plateOn(F, { a0: -PI, a1: PI, closed: true, t0: () => t(bY - 0.11), t1: () => t(bY + 0.11), nu: 1, nv: BV, off: (u, v, tt, a) => off(bY, a) + 0.05 });
  out.push(solid(belt, { hollow: true, w: W, thick: 0.04, mat: () => 'leatherD', edge: 'leatherD' }));
  for (let m = 0; m < 11; m++) {
    const a = -1.45 + (2.9 * m) / 10;
    if (Math.abs(a) < 0.2) continue;
    const q = belt.at(0, ((a + PI) / (2 * PI)) * BV), d = unit(add([0, -1, 0], mul(q.n, 0.35)));
    out.push(tube([{ p: add(q.p, mul(q.n, 0.02)), n: q.n }, { p: add(add(q.p, mul(q.n, 0.03)), mul(d, 0.08)), n: q.n }], { r: 0.018, k: 3, mat: 'sinew', w: () => W(q.p) }));
    const claw = m % 2 === 0;
    out.push(cone(add(add(q.p, mul(q.n, 0.04)), mul(d, 0.08)), d, { r: (claw ? 0.075 : 0.05) * k, L: (claw ? 0.46 : 0.3) * k, k: 4, mat: claw ? 'boneS' : 'bone', tipMat: claw ? 'leatherD' : 'bone', toward: q.n, bend: claw ? 0.5 : 0.2, w: () => W(q.p), cap: true }));
  }
  { const q = belt.at(0.5, BV / 2), bx = unit(cross([0, 1, 0], q.n));
    out.push(tube([{ p: add(add(q.p, mul(q.n, 0.08)), mul(bx, -0.2 * k)), n: q.n }, { p: add(add(q.p, mul(q.n, 0.08)), mul(bx, 0.2 * k)), n: q.n }], { r: 0.06 * k, k: 5, mat: 'bone', w: () => W(q.p) })); }
  return { parts: out, W, F, M, topF, topB, hem, off };
}

/** The arm's skin samples on side `s`: of the parts given, more than `k` of their weight. */
const armPick = (B, s, parts, k = 0.6) => (q) => (s === 'l' ? q.p[0] > 0.15 : q.p[0] < -0.15) && shareW(B, q.w, ...parts) > k;
const armBones = (s) => (n) => n.endsWith(`_${s}`);
/**
 * One arm: the wolf's fur over the shoulder's ball and down the upper arm's outside in a shaggy cap; the seal sleeve
 * below; a bone guard on the forearm (four splints of ivory lashed on with sinew bands) and a cuff of white fox at the
 * wrist.
 */
function armOf(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, sh = A.shoulder[s], el = A.elbow[s], wr = A.wrist[s], out = [], Fm = female(B), k = Fm ? 0.88 : 1;
  // -- the shoulder's fur
  const upPick = armPick(B, s, ['upperarm', 'shoulder'], 0.6);
  const UA = limbWrap(B, sh, el, sg, { t: [-0.12, 1.0], nt: 18, a: [-PI, PI], closed: true, na: 24, pick: upPick, smooth: 3, shape: (r) => r });
  // (the cap's weights change only down the arm, never round it: the shoulder's at its top, the upper arm's below)
  const wTop = mixOf(B, [[`shoulder_${s}`, 0.45], [`clavicle_${s}`, 0.2], [`upperarm_${s}`, 0.35]]);
  const wArm = skinW(B, (q) => upPick(q) && along(q.p, sh, el) > 0.3 && along(q.p, sh, el) < 0.8, armBones(s));
  const wU = (p) => mixW([[wTop, 1 - smooth(0.05, 0.5, along(p, sh, el))], [wArm, smooth(0.05, 0.5, along(p, sh, el))]]);
  const capA = 1.6, c0 = -0.05, c1 = Fm ? 0.56 : 0.62;
  const cap = plateOn(UA, { a0: PI / 2 - capA, a1: PI / 2 + capA, t0: () => c0, t1: () => c1, nu: 6, nv: 12, off: (u) => 0.1 + 0.05 * (1 - u) });
  out.push(solid(cap, { sheet: true, w: wU, mat: () => 'wolfD' }));
  out.push(pelt(UA, { t1: c0 + 0.02, t0: c1, rows: 5, a0: () => PI / 2 - capA - 0.05, a1: () => PI / 2 + capA * 0.55, per: 3.4, off: (tt) => 0.13 + 0.06 * smooth(c1, c0, tt), lap: 0.85, curl: 0.15, fringe: 1.6, lean: 0.6, w: wU,
    mat: (k2, r) => { const h = hash(k2 * 3 + r, r + 5); return h < 0.35 ? ['wolfD', 'wolf', 'wolf'] : ['wolfD', 'wolf', 'wolfL']; } }));
  // (the mane over the shoulder: long locks standing up and out along the cap's top)
  { const top = [...Array(13).keys()].map((m) => { const a = PI / 2 - capA * 0.8 + ((capA * 0.8 + 0.5) * m) / 12, q = UA.ta(c0 + 0.05, a); return { p: add(q.p, mul(q.n, 0.16)), n: q.n, d: unit(add(mul(q.n, 1.0), mul(unit(sub(el, sh)), 0.35))) }; });
    out.push(locks(top, { count: 7, stand: true, len: (k2) => (0.38 + 0.18 * hash(k2, 5)) * k, curl: 0.1, split: 0.45, lean: 0.5, w: wU, mat: (k2) => (hash(k2, 9) > 0.4 ? ['wolfD', 'wolf', 'wolfL'] : ['wolfD', 'wolf', 'wolf']) })); }
  // (a seam of sinew down the sleeve's outside, from under the fur to the bone guard)
  {
    const seam = [...Array(7).keys()].map((m) => { const q = UA.ta(c1 - 0.02 + (0.98 - c1) * (m / 6), PI / 2 + 0.3); return { p: add(q.p, mul(q.n, 0.07)), n: q.n }; });
    out.push(stitch(seam, { count: 6, wide: 0.08, lift: 0.0, r: 0.02, mat: 'sinew', w: wU })); }
  // -- the forearm's bone guard
  const faPick = armPick(B, s, ['forearm'], 0.6);
  const FA = limbWrap(B, el, wr, sg, { t: [0, 1.04], nt: 16, a: [-PI, PI], closed: true, na: 24, pick: faPick, smooth: 3, shape: (r) => r });
  const wF = skinW(B, (q) => faPick(q) && along(q.p, el, wr) > 0.3 && along(q.p, el, wr) < 0.85, armBones(s));
  for (let m = 0; m < 4; m++) {
    const ac = PI / 2 - 0.9 + 0.6 * m, g = plateOn(FA, { a0: ac - 0.22, a1: ac + 0.22, t0: () => 0.22, t1: () => 0.8, nu: 5, nv: 2, off: (u, v) => 0.1 + 0.04 * Math.sin(PI * v) + 0.02 * Math.sin(PI * u) });
    out.push(solid(g, { w: () => wF, thick: 0.035, mat: () => 'bone', inner: 'boneS', edge: 'boneS' }));
  }
  for (const tt of [0.3, 0.72]) {
    const ring = [...Array(17).keys()].map((j) => { const a = -PI + (2 * PI * j) / 16, q = FA.ta(tt, a); return { p: add(q.p, mul(q.n, 0.16 * (Math.cos(a - PI / 2) > -0.3 ? 1 : 0.6) + 0.0)), n: q.n }; });
    out.push(band(ring, { wide: 0.08, high: 0.03, mat: 'sinew', w: () => wF, closed: true }));
  }
  // -- the fox cuff at the wrist
  const wWr = nearSkinW(B, (q) => armPick(B, s, ['forearm', 'hand'], 0.5)(q) && along(q.p, el, wr) > 0.7, (n) => armBones(s)(n) && !/^(thumb|fingers|knuckles)/.test(n), 0.3);
  const cuffP = [...Array(16).keys()].map((j) => { const a = -PI + (2 * PI * j) / 16, q = FA.ta(0.83, a), q2 = FA.ta(0.9, a); return { p: add(q.p, mul(q.n, 0.1)), n: q.n, d: unit(sub(q2.p, q.p)) }; });
  out.push(locks(cuffP, { count: 12, closed: true, len: 0.24 * k, curl: 0.08, split: 0.45, w: wWr, mat: (k2) => (hash(k2, 3) > 0.35 ? ['foxS', 'fox'] : ['fox', 'fox']) }));
  out.push(locks(cuffP.map((q) => ({ ...q, p: add(q.p, mul(q.n, 0.03)) })), { count: 12, closed: true, phase: 0.5, len: 0.18 * k, curl: 0.1, split: 0.45, w: wWr, mat: () => ['fox', 'fox'] }));
  return out;
}

export function furChest(B) {
  const C = coat(B);
  const P = merge(smoothWeights(tunic(B), 2, (p) => p[1] < B.at.neck[1] - 0.6), ...C.parts, ...armOf(B, 'l'), ...armOf(B, 'r'));
  return coverHides(B, clear(B, P, 0.05, (q) => headW(B, q.w) < 0.3 && shareW(B, q.w, 'hand') < 0.3), 0.5);
}

/* ---- the shawl: the snow leopard's pelt ---------------------------------------------------------------------------- */
/**
 * The trophy cloak: a snow leopard's whole pelt over the shoulders and down the back, smoke-white with charcoal rosettes,
 * its hem shaped as the hide is (the hind legs hanging as lappets either side, the long ringed tail between them, a
 * fringe of locks along it), bone charms on cords at the lappets' feet; round the neck a mane of long pale locks standing
 * up and out; its forelegs brought over the shoulders and knotted at the throat over a clasp of carved bone set with a
 * great amber (lit when enchanted), the paws hanging below with their claws.
 */
export function furMantle(B) {
  const A = B.at, M = torsoMarks(B), F = torsoField(B), zc = F.zc, out = [], Fm = female(B), k = Fm ? 0.88 : 1;
  const n = A.neck[1];
  // (the envelope it is laid over: the coat's and the arms' upper parts, the hood below the head, and the skin there)
  const C0 = coat(B), L = armOf(B, 'l'), R = armOf(B, 'r'), hd = furHelm(B);
  const legW = (w) => w.some(([b, x]) => x > 0.35 && /(calf|foot)/.test(B.bones[b].name));
  const lowArm = (w) => w.some(([b, x]) => x > 0.3 && /(lowerarm|elbow|hand|wrist)/.test(B.bones[b].name));
  const pts = [];
  for (const P of [...C0.parts, ...L, ...R, ...loincloth(B)]) P.V.forEach((p, i) => { if (!lowArm(P.W[i]) && !legW(P.W[i])) pts.push(p); });
  hd.V.forEach((p, i) => { if (headW(B, hd.W[i]) < 0.6 && p[1] < A.neck[1] + 0.3) pts.push(p); });
  for (const q of skinSamples(B)) if (shareW(B, q.w, 'torso', 'neck', 'shoulder', 'upperarm', 'thigh') > 0.8 && headW(B, q.w) < 0.15 && q.p[1] > A.knee.l[1] - 0.3) pts.push(q.p);
  const cy0 = A.knee.l[1] - 0.6, cy1 = n + 0.6, ct = (yy) => (yy - cy0) / (cy1 - cy0);
  const C = torsoWrap(B, cy0, cy1, zc, {
    points: pts, nt: 80, na: 72, closed: true, a: [-PI, PI], smooth: 3, minDa: 0.1, empty: 0.3,
    post: (Rr) => { for (let j = 0; j < Rr[0].length; j++) for (let i = Rr.length - 2; i >= 0; i--) Rr[i][j] = Math.max(Rr[i][j], Rr[i + 1][j]); },
    // (standing off what it lies over, more as it falls: a heavy hide hangs clear of the seat)
    shape: (r, t) => r + 0.1 + 0.2 * smooth(ct(M.pit), ct(n - 0.3), t) + 0.25 * smooth(ct(M.waist + 0.3), ct(M.hip - 0.8), t) + 0.22 * smooth(ct(M.hip - 0.8), ct(A.knee.l[1]), t),
  });
  const Wn = nearSkinW(B, (q) => shareW(B, q.w, 'torso', 'neck') > 0.8 && headW(B, q.w) < 0.2 && q.p[1] > M.pit - 0.4, (nm) => ['spine_03', 'spine_02', 'neck_01'].includes(nm), 0.35), wN = mixOf(B, [['spine_03', 0.7], ['neck_01', 0.3]]);
  const W = (p) => { const w = Wn(p); return w.every(([b]) => ['spine_03', 'spine_02', 'neck_01'].includes(B.bones[b].name)) ? w : wN; };
  const shOf = (s2) => mixOf(B, [[`shoulder_${s2}`, 0.35], [`upperarm_${s2}`, 0.1], [`clavicle_${s2}`, 0.55]]);
  const wLow = mixOf(B, [['spine_01', 0.35], ['pelvis', 0.45], ['thigh_l', 0.1], ['thigh_r', 0.1]]), wMid = mixOf(B, [['spine_02', 0.5], ['spine_01', 0.5]]);
  const wCape = (p) => {
    const ks = smooth(0.15, 2.0, Math.abs(p[0])) * smooth(M.pit - 0.3, M.pit + 0.5, p[1]), s2 = p[0] > 0 ? 'l' : 'r';
    const kl = smooth(M.pit - 0.2, M.waist - 0.4, p[1]), kp = smooth(M.waist + 0.4, M.hip - 1.0, p[1]);
    return mixW([[W(p), (1 - ks) * (1 - kl)], [shOf(s2), ks * (1 - kl)], [wMid, kl * (1 - kp)], [wLow, kl * kp]]);
  };
  // -- the hide: from the neck over the shoulders, open before, its hem the leopard's shape
  const front = (a) => Math.abs(wrapAngle(a));
  const gap = Fm ? 0.62 : 0.58, aL = gap, aR = 2 * PI - gap;
  const yTop = (a) => n - 0.08 + 0.05 * smooth(0.5, 2.5, front(a)) - 0.25 * smooth(1.3, 0.6, front(a));
  // (to the backs of the knees)
  const hemB = A.knee.l[1] + (Fm ? 0.55 : 0.45);
  const lobe = (f, at, wd) => Math.exp(-(((f - at) / wd) ** 2));
  const yf = M.pit + 0.35, ys = A.shoulder.l[1] - (Fm ? 0.12 : 0.18);
  // (the shoulders' part: over the shoulders and round to the front; its hem low before, at the shoulders' tops at the
  // sides, a little lower behind where it laps over the back's part)
  const yU = (a) => { const f = front(a); return f < 1.25 ? lerp([0, yf, 0], [0, ys, 0], smooth(0.6, 1.25, f))[1] : ys - 0.22 * smooth(2.0, 2.5, f); };
  // (the back's part: the hide down the back, its sides straight, its hem the hind legs as lappets either side of the
  // tail and scalloped up between them)
  const wB = Fm ? 0.6 : 0.56, yJ = ys - 0.02;
  const yL = (a) => { const f = PI - Math.abs(a - PI); return hemB - (Fm ? 0.95 : 1.15) * lobe(f, PI - 0.42, 0.1) + 0.45 * lobe(f, PI - 0.19, 0.1) + 0.25 * lobe(f, PI - wB, 0.08); };
  const NU = 8, NV = 56, LU = 26, LV = 26;
  const cape = plateOn(C, { a0: aL, a1: aR, t0: (a) => ct(yU(a)), t1: (a) => ct(yTop(a)), nu: NU, nv: NV, off: () => 0.03 });
  const back = plateOn(C, { a0: PI - wB, a1: PI + wB, t0: (a) => ct(yL(a)), t1: () => ct(yJ), nu: LU, nv: LV, off: () => 0 });
  const capeP = smoothWeights(solid(cape, { w: wCape, thick: 0.04, mat: () => 'snow', inner: 'snowS', edge: 'snowS' }), 30);
  // (a fawn wash down the spine, a dark stripe along it)
  const backP = smoothWeights(solid(back, { w: wCape, thick: 0.04, mat: (i, j) => (Math.abs(j + 0.5 - LV / 2) < 0.6 && i % 3 !== 2 ? 'snowD' : Math.abs(j + 0.5 - LV / 2) < 3.5 ? 'snowF' : 'snow'), inner: 'snowS', edge: 'snowS' }), 14);
  out.push(capeP, backP);
  const allP = merge(capeP, backP);
  const onCape = (p) => allP.W[nearestOf(allP.V, p)];
  const capeAt = (yy, a) => {
    if (yy < yJ + 0.05 && Math.abs(a - PI) < wB) { const t0 = ct(yL(a)), t1 = ct(yJ); return back.at(clamp((ct(yy) - t0) / (t1 - t0)) * LU, ((a - PI + wB) / (2 * wB)) * LV); }
    const t0 = ct(yU(a)), t1 = ct(yTop(a)); return cape.at(clamp((ct(yy) - t0) / (t1 - t0)) * NU, ((a - aL) / (aR - aL)) * NV);
  };
  // (the hems' fringes: short locks of white fur all along them, grey-tipped)
  const fringe = (path, count) => out.push(locks(path, { count, tipW: 0, len: (k2) => (0.2 + 0.12 * hash(k2, count)) * k, curl: 0.05, split: 0.55, w: onCape, mat: (k2) => (hash(k2, 8) > 0.5 ? ['snow', 'snowS'] : ['snow', 'snow']) }));
  fringe([...Array(NV + 1).keys()].map((j) => { const q = cape.at(0.15, j); return { p: add(q.p, mul(q.n, 0.03)), n: q.n, d: [0, -1, 0] }; }), Fm ? 64 : 72);
  fringe([...Array(LV + 1).keys()].map((j) => { const q = back.at(0.15, j); return { p: add(q.p, mul(q.n, 0.03)), n: q.n, d: [0, -1, 0] }; }), Fm ? 16 : 18);
  // -- the rosettes: charcoal broken rings round fawn, larger down the spine, small spots toward the edges
  const Rr0 = (yy, a) => len(sub(capeAt(yy, a).p, [0, yy, zc(yy)]));
  const putRosette = (yy, a, R2, spots, turn) => {
    const r0 = Rr0(yy, a);
    out.push(rosette((x, yv) => { const q = capeAt(yy + yv, a - x / r0); return { p: q.p, n: q.n }; }, { R: R2 * k, spots, turn, gap: 0.3, thick: 0.22, mat: 'spot', middle: 'fawn', lift: 0.025, w: onCape }));
  };
  const span2 = (n - hemB - 1.0) / 4;
  const rows = [[n - 1.0, [PI - 0.8, PI + 0.8]], [n - 1.0 - span2, [PI - 0.38, PI + 0.38]], [n - 1.0 - 2 * span2, [PI - 0.36, PI + 0.36]], [n - 1.0 - 3 * span2, [PI - 0.32, PI + 0.32]], [n - 1.0 - 3.8 * span2, [PI - 0.3, PI + 0.3]]];
  rows.forEach(([yy0, as], r) => as.forEach((a, m) => {
    const yy = yy0 * 1 + (Fm ? 0.25 + 0.06 * r : 0) + 0.12 * (hash(r, m) - 0.5);
    const yb = Math.abs(a - PI) < wB - 0.15 ? yL(a) : yU(a); if (yy < yb + 0.35 || yy > yTop(a) - 0.4 || (Math.abs(a - PI) > wB - 0.2 && yy < yJ)) return;
    putRosette(yy, a + 0.1 * (hash(m, r) - 0.5), 0.44 + 0.08 * hash(m + 3, r), 5, hash(r, m + 9) * 6);
  }));
  // (over the shoulders, smaller)
  for (const a of [1.35, 2 * PI - 1.35, 1.05, 2 * PI - 1.05]) { const yy = A.shoulder.l[1] + (a === 1.05 || a === 2 * PI - 1.05 ? 0.25 : 0.0); if (yy < yU(a) + 0.2) continue; putRosette(yy, a, 0.2, 4, a * 3); }
  // -- the tail: from the hem's middle, hanging and swinging out, thick, ringed in charcoal to its dark tip
  {
    const q0 = back.at(0.6, LV / 2), out0 = unit([q0.n[0], 0, q0.n[2]]), Lt = Fm ? 1.5 : 1.75;
    const path = [...Array(11).keys()].map((m) => { const f = m / 10; return { p: add(add(q0.p, mul(out0, 0.06 + 0.3 * f * f)), [0.28 * f * f + 0.06 * Math.sin(f * 4), -Lt * f, 0]), n: out0 }; });
    const wT = (p) => mixW([[onCape(q0.p), 1]]);
    out.push(sweep(path, { closedProfile: true, w: wT, mat: (m) => (m >= 8 || m === 5 || m === 2 ? 'spot' : 'snow'), profile: (m) => roundProfile((0.17 - 0.05 * (m / 10)) * k, 6) }));
  }
  // (bone charms on sinew cords at each lappet's foot)
  for (const sg of [1, -1]) {
    const a = PI + sg * 0.42, j = ((a - PI + wB) / (2 * wB)) * LV, q = back.at(0, j), o2 = unit([q.n[0], 0, q.n[2]]);
    const top = add(q.p, mul(o2, 0.03));
    out.push(tube([{ p: top, n: o2 }, { p: add(top, [0, -0.38, 0]), n: o2 }], { r: 0.018, k: 3, mat: 'sinew', w: () => onCape(q.p) }));
    out.push(bead(add(top, [0, -0.17, 0]), [0, 1, 0], { r: 0.055 * k, h: 0.07 * k, mat: 'bone', w: () => onCape(q.p) }));
    out.push(cone(add(top, [0, -0.36, 0]), [0, -1, 0], { r: 0.05 * k, L: 0.26 * k, k: 4, mat: 'bone', toward: o2, bend: 0.3, w: () => onCape(q.p) }));
  }
  // -- the mane round the neck: long pale locks standing up and out, three rows
  for (const [i0, ln, cnt, ph, tones] of [[NU - 0.3, 0.46, 52, 0, ['snowS', 'snow', 'fox']], [NU - 1.4, 0.42, 48, 0.5, ['snowS', 'snow', 'fox']], [NU - 2.6, 0.38, 44, 0, ['snowS', 'snow', 'snow']], [NU - 3.9, 0.34, 40, 0.5, ['snowD', 'snowS', 'snow']], [NU - 5.2, 0.3, 40, 0, ['snowS', 'snow', 'snowF']]]) {
    const path = [...Array(NV + 1).keys()].map((j) => { const q = cape.at(i0, j); return { p: add(q.p, mul(q.n, 0.03)), n: q.n, d: unit(add([0, -0.35 + 0.15 * Math.sin(j * 2.3), 0], mul(q.n, 0.8))) }; });
    out.push(locks(path, { count: Math.round(cnt * (Fm ? 0.9 : 1)), stand: true, phase: ph, len: (k2) => ln * k * (0.6 + 0.7 * hash(k2, i0 * 3)), curl: 0.1, split: 0.45, lean: 0.7, tipW: 0, w: onCape, mat: (k2) => (hash(k2, i0) > 0.3 ? tones : hash(k2, i0 + 1) > 0.5 ? ['wolf', 'wolfL', 'fox'] : ['snowS', 'wolfL', 'snow']) }));
  }
  // -- the forelegs over the shoulders to the throat, knotted over the clasp; the paws below it
  const cy = M.neckF - (Fm ? 0.2 : 0.28), cc = C.ta(ct(cy), 0), co = unit(add(cc.n, [0, 0.15, 0]));
  const clasp = add(cc.p, mul(co, 0.16));
  const wC = mixOf(B, [['spine_03', 0.7], ['neck_01', 0.3]]);
  for (const sg of [1, -1]) {
    const a = sg > 0 ? aL + 0.04 : aR - 0.04, j = ((a - aL) / (aR - aL)) * NV, q = cape.at(NU - 1.2, j);
    const ym = lerp([0, q.p[1], 0], [0, cy + 0.1, 0], 0.6)[1], am = a * 0.45 + (sg > 0 ? 0 : 2 * PI) * 0.55, qm = C.ta(ct(ym), am), mid = add(qm.p, mul(qm.n, 0.1));
    const path = [{ p: q.p, n: q.n }, { p: mid, n: qm.n }, { p: add(clasp, [sg * 0.12, 0.04, -0.04]), n: co }, { p: add(clasp, [-sg * 0.1, -0.14, 0.02]), n: co }, { p: add(clasp, [-sg * 0.22, -0.5 * k, 0.07]), n: co }];
    const E = even(path, 8);
    const wLeg = mixOf(B, [['spine_03', 0.65], [`clavicle_${sg > 0 ? 'l' : 'r'}`, 0.25], ['neck_01', 0.1]]);
    out.push(sweep(E, { closedProfile: true, w: (p) => mixW([[wC, smooth(0.5, 0.15, Math.abs(p[0]))], [wLeg, 1 - smooth(0.5, 0.15, Math.abs(p[0]))]]), mat: (m) => (m === 3 ? 'spot' : 'snow'), profile: (m) => { const wd = (0.13 - 0.02 * (m / 8)) * k; return [[-wd, -0.04], [wd, -0.04], [wd * 0.8, 0.06], [-wd * 0.8, 0.06]]; } }));
    // (the paw: a pad, its claws curled down)
    const pc = add(clasp, [-sg * 0.22, -0.62 * k, 0.08]);
    out.push(bead(pc, [0, 1, 0], { r: 0.2 * k, h: 0.15 * k, k: 6, mat: 'snowS', w: () => wC }));
    for (const dx of [-0.11, 0, 0.11]) out.push(cone(add(pc, [dx * k, -0.1 * k, 0.1]), [0, -1, 0.3], { r: 0.045 * k, L: 0.2 * k, k: 3, mat: 'bone', toward: [0, 0, -1], bend: 0.4, w: () => wC }));
  }
  // -- the clasp: a disc of carved bone, notched round its rim, a ring of dark horn, the great amber in its middle
  {
    const fr = frameAt(co, [0, 1, 0]), R2 = 0.5 * k;
    const disc = patch((u, v) => { const th = v * 2 * PI, rr = R2 * (0.15 + 0.85 * u) * (1 + 0.08 * Math.cos(th * 10) * u); return { p: add(clasp, add(mul(co, 0.05 * (1 - u * u)), add(mul(fr.x, Math.cos(th) * rr), mul(fr.y, Math.sin(th) * rr)))), n: co }; }, 3, 20, { closed: true });
    out.push(solid(disc, { w: () => wC, thick: 0.05, mat: (i) => (i === 1 ? 'leatherD' : 'bone'), inner: 'boneS', edge: 'boneS' }));
    out.push(stud(add(clasp, mul(co, 0.05)), co, { r: 0.3 * k, h: 0.22, k: 7, mat: 'rune', w: () => wC }));
  }
  const P = clear(B, merge(...out), 0.06, (q) => headW(B, q.w) < 0.3 && shareW(B, q.w, 'hand', 'forearm') < 0.3);
  return coverHides(B, P, 0.6);
}

/* ---- legs: fur-out leggings -------------------------------------------------------------------------------------------- */
/** The hide breeches under the fur: the hips, the seat, the crotch and the legs to the ankles, close over the skin; the waist (`hideW`) left out under any chest piece. */
function breeches(B) {
  const A = B.at, M = torsoMarks(B);
  return shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s2 = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'thigh', 'calf', 'torso', 'foot') > 0.6 && (on(B, i, 'thigh', 'calf', 'torso') > 0.6 || p[1] > A.ankle[s2][1] + 0.05) && (on(B, i, 'foot') < 0.5 || p[1] > A.ankle[s2][1] + 0.05) && on(B, i, 'upperarm', 'forearm', 'hand', 'shoulder') < 0.05 && p[1] < M.waist + 0.25 && p[1] > A.ankle[s2][1] - 0.05; },
    off: ({ p }) => 0.035 - 0.015 * smooth(A.knee.l[1] - 1.2, A.ankle.l[1] + 0.3, p[1]),
    mat: ({ p }) => (p[1] > M.hip + 0.05 ? 'hideW' : 'hide'),
  });
}
/**
 * One leg: reindeer fur worn fur out from the hip to the ankle in shaggy rows, brown with pale tips; a knee pad of dark
 * leather sewn on with a sinew zigzag round its edge, a bone disc at its middle; the shin bound with thongs crossed down
 * it.
 */
function legOf(B, s) {
  const A = B.at, M = torsoMarks(B), sg = s === 'l' ? 1 : -1, hp = A.hip[s], kn = A.knee[s], an = A.ankle[s], out = [], Fm = female(B), k = Fm ? 0.88 : 1;
  const legBones = (nm) => nm.endsWith(`_${s}`);
  const tone = (k2, r) => { const h = hash(k2 * 7 + r, r + 13); return h < 0.3 ? ['deerD', 'deer', 'deer'] : h < 0.8 ? ['deerD', 'deer', 'deerL'] : ['deer', 'deerL', 'deerL']; };
  // -- the thigh's fur, all round below the coat's hem
  const thPick = (q) => q.p[0] * sg > 0.05 && shareW(B, q.w, 'thigh') > 0.6;
  const TH = limbWrap(B, hp, kn, sg, { t: [0, 1.05], nt: 20, a: [-PI, PI], closed: true, na: 26, pick: thPick, smooth: 4, shape: (r) => r });
  const wT = nearSkinW(B, (q) => thPick(q) || (q.p[0] * sg > 0.05 && shareW(B, q.w, 'thigh', 'calf') > 0.6 && along(q.p, hp, kn) > 0.6), (nm) => legBones(nm) && !/foot|ball|toes|ankle/.test(nm), 0.3);
  const t0 = Fm ? 0.12 : 0.18, t1 = 0.8;
  const thigh = plateOn(TH, { a0: -PI, a1: PI, closed: true, t0: () => t1, t1: () => t0, nu: 8, nv: 20, off: () => 0.11 });
  out.push(solid(thigh, { sheet: true, w: wT, mat: () => 'deerD' }));
  out.push(pelt(TH, { t1: t0 + 0.01, t0: t1 - 0.02, rows: 5, closed: true, per: 2.7, off: () => 0.12, lap: 0.65, curl: 0.13, fringe: 1.2, lean: 0.55, tipW: 0.3, mat: tone, w: wT }));
  // -- the knee pad
  const kPick = (q) => q.p[0] * sg > 0.05 && shareW(B, q.w, 'thigh', 'calf') > 0.8 && len(sub(q.p, kn)) < 0.9;
  const k0 = lerp(hp, kn, 0.82), k1 = lerp(kn, an, 0.16);
  const KN = limbWrap(B, k0, k1, sg, { t: [0, 1], nt: 10, a: [-PI, PI], closed: true, na: 26, pick: kPick, smooth: 4, shape: (r) => r });
  const wKn = mixOf(B, [[`knee_${s}`, 0.7], [`calf_${s}`, 0.3]]);
  const pad = plateOn(KN, { a0: -1.45, a1: 1.45, t0: () => -0.06, t1: () => 1.02, nu: 6, nv: 10, off: (u, v) => 0.19 + 0.08 * Math.sin(PI * u) * Math.sin(PI * v) });
  out.push(solid(pad, { w: () => wKn, thick: 0.04, mat: () => 'tan', inner: 'leatherD', edge: 'tanD' }));
  const rim = [...[...Array(6).keys()].map((i) => [i, 0]), ...[...Array(10).keys()].map((j) => [6, j]), ...[...Array(6).keys()].map((i) => [6 - i, 10]), ...[...Array(11).keys()].map((j) => [0, 10 - j])];
  out.push(stitch(pathOn(pad, rim.map(([i, j]) => [clamp(i, 0.35, 5.65), clamp(j, 0.4, 9.6)])), { count: 18, wide: 0.08, lift: 0.025, r: 0.02, mat: 'leatherD', w: () => wKn }));
  { const q = pad.at(3, 5); out.push(stud(add(q.p, mul(q.n, 0.01)), q.n, { r: 0.13 * k, h: 0.06, k: 7, mat: 'bone', w: () => wKn })); out.push(stud(add(q.p, mul(q.n, 0.05)), q.n, { r: 0.06 * k, h: 0.04, k: 5, mat: 'boneS', w: () => wKn })); }
  // -- the shin's fur and its crossed thongs
  const cPick = (q) => q.p[0] * sg > 0.05 && shareW(B, q.w, 'calf') > 0.6;
  const SH = limbWrap(B, kn, an, sg, { t: [0, 1.02], nt: 20, a: [-PI, PI], closed: true, na: 24, pick: cPick, smooth: 4, shape: (r) => r });
  const wCa = nearSkinW(B, (q) => cPick(q) || (q.p[0] * sg > 0.05 && shareW(B, q.w, 'calf', 'foot') > 0.6 && q.p[1] > an[1] - 0.1), (nm) => legBones(nm) && !/^(ball|toes)/.test(nm), 0.3);
  // (to the boots' cuffs at mid-calf)
  const shin = plateOn(SH, { a0: -PI, a1: PI, closed: true, t0: () => (Fm ? 0.44 : 0.5), t1: () => 0.12, nu: 5, nv: 18, off: () => (Fm ? 0.06 : 0.08) });
  out.push(solid(shin, { sheet: true, w: wCa, mat: () => 'deerD' }));
  out.push(pelt(SH, { t1: 0.13, t0: Fm ? 0.37 : 0.43, rows: 4, closed: true, per: 3, off: () => (Fm ? 0.07 : 0.09), lap: 0.5, curl: 0.05, fringe: 1.0, lean: 0.4, tipW: 0.3, mat: tone, w: wCa }));
  for (const dir of [1, -1]) {
    const path = [...Array(17).keys()].map((m) => { const f = m / 16, a = dir * (f * 2 * PI * 1.25) + (dir > 0 ? 0 : PI), q = SH.ta(0.18 + 0.27 * f, a); return { p: add(q.p, mul(q.n, 0.2 + 0.01 * dir)), n: q.n }; });
    out.push(band(path, { wide: 0.08, high: 0.035, mat: 'leatherD', w: wCa }));
  }
  return out;
}
/**
 * The loincloth: a flap of reindeer pelt hung before and behind from a thong at the hips, its foot a fringe of locks; an
 * amber charm bound in sinew at the knot before (lit when enchanted), a fang either side of it.
 */
function loincloth(B) {
  const A = B.at, M = torsoMarks(B), F = torsoField(B), t = F.tOfY, out = [], Fm = female(B), k = Fm ? 0.88 : 1;
  const wTop = mixOf(B, [['pelvis', 1]]), wFoot = mixOf(B, [['pelvis', 0.6], ['thigh_l', 0.2], ['thigh_r', 0.2]]);
  const wP = (p) => mixW([[wTop, smooth(M.hip - 1.1, M.hip - 0.2, p[1])], [wFoot, 1 - smooth(M.hip - 1.1, M.hip - 0.2, p[1])]]);
  // (below the coat's hem: before, under its short fringe; behind, under its long one)
  for (const [mid, half2, drop, top] of [[0, Fm ? 0.36 : 0.4, Fm ? 1.1 : 1.2, M.hip - 0.1], [PI, Fm ? 0.5 : 0.48, Fm ? 0.9 : 0.95, M.hip - 0.5]]) {
    const q0 = F.ta(t(top), mid);
    const nv = 6, nu = 6, W0 = (F.ta(t(top), mid + half2).p[0] - F.ta(t(top), mid - half2).p[0]);
    const out0 = unit([q0.n[0], 0, q0.n[2]]), side = unit(cross([0, 1, 0], out0));
    // (hung straight down from the thong, standing off the crotch and the seat, a little wider at its foot)
    const reachAt = (yy) => { let m = 0; for (const x of [-0.25, 0, 0.25]) { const q = F.ta(t(yy), mid + x); m = Math.max(m, dot(sub(q.p, q0.p), out0)); } return m; };
    let push = 0; const prof = [...Array(nu + 1).keys()].map((i) => { const yy = top - drop * (i / nu); push = Math.max(push, reachAt(yy)); return push; });
    const flap = patch((u, v) => {
      const yy = top - drop * u, i = Math.round(u * nu), x = (v - 0.5) * Math.abs(W0) * (1 + 0.15 * u);
      const p = add(add(q0.p, mul(side, x * (mid === 0 ? 1 : -1))), add([0, yy - q0.p[1], 0], mul(out0, prof[i] + 0.25 + 0.04 * u)));
      return { p, n: out0 };
    }, nu, nv);
    out.push(solid(flap, { w: wP, thick: 0.035, mat: (i) => (i === 0 ? 'leatherD' : 'wolf'), inner: 'hide', edge: 'wolfD' }));
    const hemP = [...Array(nv + 1).keys()].map((j) => { const q = flap.at(nu - 0.2, j); return { p: add(q.p, mul(out0, 0.02)), n: out0, d: [0, -1, 0] }; });
    out.push(locks(hemP, { count: 6, len: (k2) => (0.34 + 0.16 * hash(k2, mid)) * k, curl: 0.08, split: 0.45, w: wP, mat: (k2) => (hash(k2, 3) > 0.4 ? ['wolfD', 'wolf', 'wolfL'] : ['wolfD', 'wolf', 'wolfW']) }));
    // (rows of locks down its face)
    for (let r = 1; r < 5; r++) { const row = [...Array(nv + 1).keys()].map((j) => { const q = flap.at(r * 1.2, j); return { p: add(q.p, mul(out0, 0.015)), n: out0, d: [0, -1, 0] }; }); out.push(locks(row, { count: 5, phase: (r % 2) * 0.5, len: 0.32 * k, curl: 0.05, w: wP, mat: (k2) => (hash(k2, r) > 0.5 ? ['wolfD', 'wolf', 'wolfL'] : ['wolfD', 'wolf', 'wolf']) })); }
    if (mid === 0) {
      const c = add(flap.at(0.6, nv / 2).p, mul(out0, 0.06));
      out.push(bead(c, out0, { r: 0.24 * k, h: 0.16, k: 6, mat: 'rune', w: wP }));
      for (const sx of [1, -1]) out.push(cone(add(c, mul(side, sx * 0.26 * k)), [0, -1, 0], { r: 0.055 * k, L: 0.32 * k, k: 4, mat: 'bone', toward: out0, bend: 0.25, w: wP }));
      out.push(stitch([{ p: add(c, mul(side, -0.16)), n: out0 }, { p: add(c, mul(side, 0.16)), n: out0 }], { count: 3, wide: 0.12, lift: 0.04, r: 0.018, mat: 'sinew', w: wP }));
    }
  }
  return out;
}
export function furLegs(B) {
  const P = merge(smoothWeights(breeches(B), 6, (p) => p[1] > B.at.knee.l[1] + 0.6), ...legOf(B, 'l'), ...legOf(B, 'r'), ...loincloth(B));
  return { P: coverHides(B, clear(B, P, 0.03, (q) => shareW(B, q.w, 'thigh', 'calf', 'torso') > 0.6), 0.5), dropAt: (f) => f.mat === 'hideW' };
}

/* ---- boots: mukluks ------------------------------------------------------------------------------------------------- */
/** The mukluk's soft hide over the foot and the ankle on a thick sewn sole, close over the skin, stood on. */
function mukShell(B) {
  const A = B.at;
  const P = shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s2 = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'foot', 'calf') > 0.6 && p[1] < A.ankle[s2][1] + 0.5; },
    off: ({ n }) => 0.09 + (n[1] < -0.6 ? 0.08 : 0),
    mat: ({ n }) => (n[1] < -0.55 ? 'sole' : 'tan'),
  });
  P.soles = P.V.map((_, i) => i).filter((i) => P.V[i][1] < A.floor + 0.14);
  return P;
}
/**
 * One mukluk: soft smoked hide over the foot on a thick sole, its welt sewn round in white sinew, a seam stitched up the
 * instep; reindeer fur from the ankle to mid-calf; a deep cuff of white fox at its top, a string of amber beads under it
 * (lit when enchanted); a thong wound twice round the ankle and tied before with two bone toggles.
 */
function mukluk(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, kn = A.knee[s], an = A.ankle[s], out = [], Fm = female(B), k = Fm ? 0.88 : 1;
  const legBones = (nm) => nm.endsWith(`_${s}`);
  const cPick = (q) => q.p[0] * sg > 0.05 && shareW(B, q.w, 'calf', 'foot') > 0.6 && q.p[1] > an[1] - 0.35;
  const SH = limbWrap(B, kn, an, sg, { t: [0.3, 1.06], nt: 14, a: [-PI, PI], closed: true, na: 22, pick: cPick, smooth: 4, shape: (r) => r });
  const wC = nearSkinW(B, cPick, (nm) => legBones(nm) && !/^(ball|toes)/.test(nm), 0.3);
  const tone = (k2, r) => { const h = hash(k2 * 3 + r, r + 21); return h < 0.3 ? ['deerD', 'deer'] : h < 0.8 ? ['deer', 'deerL'] : ['deer', 'deer']; };
  // -- the fur leg, from the ankle to mid-calf
  const tTop = Fm ? 0.58 : 0.52, tBot = 0.86;
  const fat = Fm ? 0.7 : 1;
  const legP = plateOn(SH, { a0: -PI, a1: PI, closed: true, t0: () => tBot, t1: () => tTop, nu: 6, nv: 18, off: (u) => (0.16 + 0.04 * u) * fat });
  out.push(solid(legP, { sheet: true, w: wC, mat: () => 'deerD' }));
  out.push(pelt(SH, { t1: tTop + 0.04, t0: tBot - 0.02, rows: 5, closed: true, per: 3, off: (tt) => 0.17 * fat, lap: 0.5, curl: 0.05 * fat, fringe: 1.0, lean: 0.3, mat: tone, w: wC }));
  // -- the fox cuff at its top: two rows of white locks, the outer standing out and falling
  for (const [lift, ln, cnt, ph] of [[0, 0.42, 14, 0], [0.05, 0.34, 13, 0.5]]) {
    const ring = [...Array(16).keys()].map((j) => { const a = -PI + (2 * PI * j) / 16, q = SH.ta(tTop - 0.03, a), q2 = SH.ta(tTop + 0.1, a); const inner = smooth(0.2, -0.9, Math.sin(a)) * (Fm ? 1 : 0.6); return { p: add(q.p, mul(q.n, (0.29 + lift - 0.08 * inner) * fat)), n: q.n, d: unit(add(sub(q2.p, q.p), mul(q.n, 0.25 * (1 - inner)))), inner }; });
    out.push(locks(ring, { count: Math.round(cnt * (Fm ? 0.9 : 1)), closed: true, phase: ph, len: (k2, p) => ln * k * (0.8 + 0.4 * hash(k2, lift * 100 + 1)) * (1 - 0.55 * smooth(0.0, -0.6 * sg, sg * (p[0] - an[0]))), curl: (k2, p) => 0.1 * (1 - smooth(0.0, -0.6 * sg, sg * (p[0] - an[0]))), split: 0.5, lean: 0.3, w: wC, mat: (k2, p) => (Fm && sg * (p[0] - an[0]) < -0.12 ? [null, null] : hash(k2, 7 + lift * 10) > 0.3 ? ['foxS', 'fox'] : ['fox', 'fox']) }));
  }
  // (the cuff's top rolled in fox, standing a little)
  // (all round for him; for her, whose calves pass close in her stride, round the front and the outside only)
  const rollA = Fm ? [-0.3, PI + 0.35] : [-PI, PI];
  out.push(tube([...Array(17).keys()].map((j) => { const a = rollA[0] + ((rollA[1] - rollA[0]) * j) / 16, q = SH.ta(tTop - 0.035, a); return { p: add(q.p, mul(q.n, 0.29 * fat)), n: q.n }; }).slice(0, Fm ? 17 : 16), { r: 0.075 * fat, k: 4, mat: 'fox', w: wC, closed: !Fm }));
  // -- the amber beads strung round under the cuff
  const bt = tTop + 0.14, ringB = [...Array(17).keys()].map((j) => { const a = -PI + (2 * PI * j) / 16, q = SH.ta(bt, a); return { p: add(q.p, mul(q.n, 0.23 * fat)), n: q.n }; });
  out.push(tube(ringB, { r: 0.018, k: 3, mat: 'leatherD', w: wC, closed: true }));
  const EB = even(ringB, 12, true);
  EB.forEach((q, m) => { const nx = EB[(m + 1) % EB.length].p; out.push(bead(q.p, sub(nx, q.p), { r: (m % 3 === 0 ? 0.07 : 0.085) * k, h: 0.07 * k, k: 5, mat: m % 3 === 0 ? 'bone' : 'rune', w: wC })); });
  // -- the foot: the welt's stitching round the sole, a seam up the instep, the ankle's thong and toggles
  const fPick = (q) => q.p[0] * sg > 0.05 && shareW(B, q.w, 'foot') > 0.6;
  const wF = boneW(B, `foot_${s}`), wB = boneW(B, `ball_${s}`);
  const rim = skinSamples(B).filter((q) => fPick(q) && q.p[1] < A.floor + 0.3 && q.p[1] > A.floor + 0.12 && Math.abs(q.n[1]) < 0.6);
  // (round the foot in order of the angle about its middle)
  const fc = rim.reduce((a2, q) => add(a2, mul(q.p, 1 / rim.length)), [0, 0, 0]);
  const ang = (q) => Math.atan2(q.p[0] - fc[0], q.p[2] - fc[2]);
  const ord = rim.slice().sort((a2, b2) => ang(a2) - ang(b2));
  const bins = 28, welt = [];
  for (let b2 = 0; b2 < bins; b2++) {
    const lo = -PI + (2 * PI * b2) / bins, hi = lo + (2 * PI) / bins, inBin = ord.filter((q) => ang(q) >= lo && ang(q) < hi);
    if (!inBin.length) continue;
    const q = inBin.reduce((m2, x) => (len(sub(x.p, fc)) > len(sub(m2.p, fc)) ? x : m2), inBin[0]), nn = unit([q.n[0], 0, q.n[2]]);
    welt.push({ p: add([q.p[0], A.floor + 0.2, q.p[2]], mul(nn, 0.08)), n: nn, z: q.p[2] });
  }
  const wW = (p) => (p[2] > A.ball[s][2] - 0.15 ? wB : wF);
  out.push(stitch([...welt, welt[0]], { count: 22, wide: 0.07, lift: 0.0, r: 0.02, mat: 'sinew', w: wW }));
  out.push(tube([...welt, welt[0]].map((q) => ({ p: add(q.p, [0, -0.06, 0]), n: q.n })), { r: 0.045, k: 4, mat: 'tanD', w: wW }));
  // (the instep seam: from the toe up to the ankle)
  const tip = skinSamples(B).filter(fPick).reduce((b2, q) => (q.p[2] > b2[2] ? q.p : b2), [0, 0, -9]);
  const seam = [...Array(7).keys()].map((m) => { const f = m / 6, base = lerp([tip[0], A.floor + 0.35, tip[2] - 0.05], [an[0], an[1] - 0.1, an[2] + 0.35], f), near = skinSamples(B).filter(fPick).reduce((b2, q) => (len(sub(q.p, base)) < len(sub(b2.p, base)) ? q : b2)); return { p: add(near.p, mul(near.n, 0.07)), n: near.n }; });
  out.push(stitch(seam, { count: 7, wide: 0.07, lift: 0.0, r: 0.018, mat: 'sinew', w: (p) => wW(p) }));
  // (the ankle thong, twice round, two bone toggles at its knot before)
  for (const tt of [0.91, 0.96]) {
    const ring = [...Array(17).keys()].map((j) => { const a = -PI + (2 * PI * j) / 16, q = SH.ta(tt, a); return { p: add(q.p, mul(q.n, (0.21 + 0.02 * Math.max(0, Math.cos(a))) * fat)), n: q.n }; });
    out.push(band(ring, { wide: 0.06, high: 0.03, mat: 'leatherD', w: wC, closed: true }));
  }
  { const q = SH.ta(0.935, 0.25 * sg), o = q.n, ac = unit(sub(SH.ta(0.935, 0.25 * sg + 0.5).p, q.p));
    for (const dy of [0.07, -0.08]) { const c = add(add(q.p, mul(o, 0.27 * fat)), [0, dy, 0]); out.push(tube([{ p: add(c, mul(ac, -0.14 * k)), n: o }, { p: add(c, mul(ac, 0.14 * k)), n: o }], { r: 0.05 * k, k: 5, mat: 'bone', w: wC })); }
    out.push(tube([{ p: add(q.p, mul(o, 0.25)), n: o }, { p: add(add(q.p, mul(o, 0.3)), [0, -0.3 * k, 0]), n: o }], { r: 0.018, k: 3, mat: 'leatherD', w: wC })); }
  return out;
}
export function furBoots(B) {
  const P = merge(mukShell(B), ...mukluk(B, 'l'), ...mukluk(B, 'r'));
  return coverHides(B, P, 0.4);
}
