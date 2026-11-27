// The seryll set: the tide-warden, guardian of a drowned sea-temple, armoured in seryll (a sea-crystal grown like shell
// and coral), built with the plate kit (tools/sculpt/garments/platekit.mjs) and the set's own builders
// (tools/sculpt/garments/kit/seryll.mjs).
//
//   helm    the nautilus: an open helm whose skull is banded like a nautilus' shell in pearl and violet, its bands
//           swirling back from the crown; a crystal dorsal fin from the brow over the crown rolling down behind into
//           the nautilus' coil at the back of the head; finned cheek guards swept back; a band of sea-glass at the brow
//           with a drop of it in the middle, seed pearls round the sides.
//   chest   shell valves lapping down the torso (two before, two behind, two lobed hoops at the waist), each ribbed
//           from its hinge to its lobed rim, dark teal where it tucks under, violet nacre, pearl at its rim; conch
//           pauldrons wound in stepped whorls under a knobbed ridge to a spire; fluted rerebraces and vambraces, a
//           crystal fin on each vambrace with a sea-glass vein; deep teal sea-silk under it all.
//   mantle  the tide mantle: a pearl collar pinned at the throat by a nautilus coiled round the great pearl; a shell
//           valve over the shoulder blades from which two crystal fins fan up and out, veined in sea-glass; a cape
//           of kelp blades in two layers, waved and ribbed, a pearl float at each, to the knee.
//   legs    sea-green leggings; two shell valves down each thigh; a cockle over each knee with a sea-glass pearl at
//           its heart; greaves shaped to the calf, a great ribbed shell down the shin, a crystal fin down the outside.
//   boots   dark teal boots on thick soles; shell valves over the instep, a ribbed shell over the toes, a crystal fin
//           flaring from the ankle with a sea-glass bead at its root, a nautilus coiled at the heel.
//
// Enchanted, these light and nothing else: the brow's sea-glass, the throat's pearl, the fins' veins (the mantle's
// and the vambraces'), the knees' pearls and the ankles' beads.
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, smooth, merge, shell, on, nearestOf } from './metalkit.mjs';
import { boneW, solid, tube, band, rowPath, colPath, stud, studsAlong, wrapAngle, skinSamples, shareW, mixOf, mixW, nearSkinW, skinW, limbWrap, plateOn, patch, along, domeWrap, ellipsoidReach, smoothWeights, coverHides, sweep, roundProfile, torsoWrap } from './platekit.mjs';
import { headDome, headW, fieldPatch, fin, coil, conch, coral, tide, torsoField, torsoMarks, TORSO_BONES, frameAt } from './kit/seryll.mjs';

const PI = Math.PI;
/** A ridge along a path: a three-sided tube's top two faces only, its foot on the surface it lies on (a rib, a rolled edge). */
const rtube = (path, o) => (o.k === 3 ? sweep(path, { ...o, closedProfile: false, caps: false, profile: [[-o.r, -0.6 * o.r], [0, o.r], [o.r, -0.6 * o.r]] }) : tube(path, o));
const y = (p) => p[1];

export const SERYLL_MATS = {
  // (the seryll: a pearlescent sea-crystal, pale aqua-white, violet-pink in its shade, near white at its crests)
  pearl: { c: '#729f99', kind: 2 },
  pearlM: { c: '#527b7a', kind: 2 },
  pearlV: { c: '#7a659c', kind: 2 },
  deepT: { c: '#1e4d55', kind: 2 },
  nacreD: { c: '#5a5a86', kind: 2 },
  pearlR: { c: '#9ccbc2', kind: 2 },
  pearlH: { c: '#a8dccf', kind: 3 },
  nacreM: { c: '#77708f', kind: 2 },
  nacre: { c: '#8a74a6', kind: 2 },
  pearlL: { c: '#effbf7', kind: 3 },
  pearlS: { c: '#5f8f97', kind: 3 },
  pearlD: { c: '#24414a', kind: 3 },
  aqua: { c: '#1d5a62', kind: 2 },
  sheen: { c: '#b4e0d8', kind: 3 },
  // (its crystal: the fins, aqua and clear, their edges near white)
  crys: { c: '#3a9894', kind: 2 },
  crysF: { c: '#58bdb3', kind: 2 },
  crysL: { c: '#8cd9cf', kind: 3 },
  crysD: { c: '#1d4f53', kind: 2 },
  // (the glow: sea-glass, lit in the enchantment's colour)
  kelp: { c: '#0e464c', kind: 0 },
  kelpG: { c: '#1f5e48', kind: 0 },
  kelpT: { c: '#3f8a74', kind: 0 },
  kelpL: { c: '#5aa58e', kind: 2 },
  hose: { c: '#2a6f5c', kind: 0 },
  hoseW: { c: '#2a6f5d', kind: 0 },
  boot: { c: '#173f44', kind: 2 },
  sole: { c: '#0c2226', kind: 2 },
  rune: { c: '#62c6b6', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  // (coral: the filigree climbing the cuirass)
  coral: { c: '#d9786a', kind: 2 },
  coralL: { c: '#f2a894', kind: 2 },
  // (the sea-silk under it: deep teal, sea-green on the arms)
  sea: { c: '#0a363c', kind: 0 },
  seaD: { c: '#08323a', kind: 0 },
  seaG: { c: '#0e4640', kind: 0 },
};

/* ---- the helm ----------------------------------------------------------------------------------------------------- */
/**
 * The nautilus: the skull banded like a nautilus' shell (pearl and violet fields between raised septa, swirling back
 * from the crown), open from the brows down before; a crystal dorsal fin from the brow over the crown into the coil at
 * the back of the head, its chambers banded; a sea-glass band at the brow and a drop of it in the middle; finned cheek
 * guards swept back. Rigid on the head.
 */
export function seryllHelm(B) {
  const female = B.who === 'female', out = [];
  const H = headDome(B, { fit: female ? 0.12 : 0.16 });
  const { D, c, E, browTh } = H;
  const wH = boneW(B, 'head'), w = () => wH;
  const front = (a) => Math.abs(wrapAngle(a));
  // -- the skull: down to the brows before, over the ears, to the nape behind
  const skBot = (a) => {
    const f = front(a);
    const yy = lerp([0, browTh - 0.12, 0], [0, 2.0, 0], smooth(0.8, 1.35, f))[1];
    return lerp([0, yy, 0], [0, 2.12, 0], smooth(1.9, 2.6, f))[1];
  };
  // (its columns swirled back from the crown, as a shell's growth bands are)
  const NU = 12, NV = 36, swirl = 0.55;
  const skull = fieldPatch(D, NU, NV, (u, v) => {
    const a0 = -PI + 2 * PI * v, aa = a0 + swirl * u * Math.sign(Math.sin(a0)) * Math.abs(Math.sin(a0)) ** 0.3, t = (skBot(aa) / PI) * u;
    return { t, a: aa, off: 0.07 * smooth(0.75, 1, u) * smooth(0.9, 1.6, front(aa)) };
  }, { closed: true });
  // (fields of pearl and violet, three columns each)
  const field = (j) => (Math.floor(j / 3) % 2 === 0 ? 'pearl' : 'nacre');
  out.push(solid(skull, { sheet: true, w, mat: (i, j) => (i >= NU - 2 ? 'aqua' : field(j)) }));
  // (the septa: raised ridges between the fields, from the crown to the rim)
  for (let j = 0; j < NV; j += 3) out.push(rtube(colPath2(skull, j, 1.2, NU - 2, 4, 0.005), { r: 0.03, k: 3, mat: 'pearlL', w }));
  // (the rim rolled: bright, all round but the brow, where the sea-glass is)
  out.push(rtube(rowPath(skull, NU, 0, NV, NV), { r: 0.045, k: 3, mat: 'sheen', w, closed: true }));
  out.push(rtube(rowPath(skull, NU - 2, 0, NV, NV / 2, 0.005), { r: 0.028, k: 3, mat: 'pearlL', w, closed: true }));
  // -- the sea-glass at the brow: a band along the rim before, a drop in the middle
  const browAt = (a, lift) => { const q = D.ta((skBot(a) - 0.09) / PI, a); return { p: add(q.p, mul(q.n, lift)), n: q.n }; };
  const brow = [...Array(17).keys()].map((k) => browAt(-0.95 + (1.9 * k) / 16, 0.03));
  out.push(band(brow, { wide: 0.1, high: 0.035, mat: 'rune', w }));
  { const q = D.ta((skBot(0) - 0.24) / PI, 0); out.push(stud(add(q.p, mul(q.n, 0.02)), q.n, { r: 0.13, h: 0.14, k: 6, mat: 'rune', w })); out.push(rtube([...Array(13).keys()].map((k) => { const a2 = (k / 12) * 2 * PI; return { p: add(add(q.p, mul(q.n, 0.03)), add(mul([1, 0, 0], Math.cos(a2) * 0.16), mul([0, 1, 0], Math.sin(a2) * 0.19 + 0.02))), n: q.n }; }), { r: 0.03, k: 3, mat: 'pearlL', w, closed: true })); }
  // (seed pearls along the dark band, round the sides and the back)
  for (let k = 0; k < 18; k++) { const a = -PI + ((k + 0.5) / 18) * 2 * PI; if (front(a) < 1.05) continue; const q = D.ta((skBot(a) - 0.12) / PI, a); out.push(stud(add(q.p, mul(q.n, 0.06 * smooth(0.9, 1.6, front(a)))), q.n, { r: 0.05, h: 0.05, k: 3, mat: 'pearlL', w })); }
  // -- the dorsal fin: from above the brow over the crown to the coil behind, rising toward the back, swept back
  const thF = browTh - 0.45, thB = 1.55;
  const rootAt = (v) => { const s = -thF + (thF + thB) * v; return D.ta(Math.abs(s) / PI, s < 0 ? 0 : PI); };
  const finH = (v) => (female ? 0.85 : 1) * (0.16 + 0.5 * smooth(0, 0.55, v) - 0.16 * smooth(0.6, 0.85, v));
  out.push(fin({
    root: (v) => add(rootAt(v).p, mul(rootAt(v).n, -0.02)), up: (v) => rootAt(v).n, back: () => [0, -0.15, -1], side: () => [1, 0, 0],
    h: finH, sweep: 0.55, rays: 9, per: 3, nu: 4, spike: 0.35, thick: 0.05,
    mat: 'crys', sheet: true, ray: 'crysL', rayR: 0.025, rim: 'crysL', rimR: 0.025, w,
  }));
  // -- the coil: the nautilus' shell wound behind the head, its outer whorl from the crown, banded in its chambers
  const cc = [0, c[1] - (female ? 0.0 : 0.02), H.zb - 0.5];
  const r0 = female ? 0.68 : 0.74;
  out.push(coil(cc, [0, 1, 0], [0, 0, -1], { r0, grow: 3.2, turns: 1.55, steps: 15, thick: 0.46, flat: 0.62, k: 8, band: 0.11, mat: 'pearl', alt: 'pearlV', septum: 'pearlL', septumR: 0.022, septumK: 6, w }));
  // -- the cheek guards: fins from the skull's rim before the ears down past the jaw, their rays swept back to points
  for (const sg of [1, -1]) {
    // (a fin over the cheek from the rim before the ear to behind it, down to the jaw, its trailing edge cut into
    // three spines swept back; standing off more toward the back; its rays fanned from its root to the spines)
    const aF = 0.82, NR = 3, NU2 = 18, NV2 = 8;
    const spineAt = (u) => { const f = u * NR, d = 1 - Math.abs(f - Math.floor(f) - 0.5) * 2; return d ** 1.5; };
    const cheek = fieldPatch(D, NU2, NV2, (u, v) => {
      const aB = 1.45 + 0.35 * u + 0.75 * spineAt(u) * (0.6 + 0.4 * u), a = sg * (aF + (aB - aF) * v), thTop = skBot(sg * aF) - 0.14;
      const thBot = 2.3 - 0.06 * v;
      return { t: (thTop + (thBot - thTop) * u + 0.25 * v * v * spineAt(u)) / PI, a, off: 0.04 + 0.16 * u + 0.24 * v * v };
    });
    out.push(solid(cheek, { w, hollow: true, thick: 0.04, mat: (i, j) => (j < 3 ? 'pearl' : 'crys'), edge: 'crysD' }));
    for (let k = 0; k < NR; k++) {
      const ui = ((k + 0.5) / NR) * NU2, path = [];
      for (let q = 0; q <= 6; q++) { const f = q / 6, g = cheek.at(2 + (ui - 2) * f, 0.6 + (NV2 - 0.6) * f); path.push({ p: add(g.p, mul(g.n, 0.012)), n: g.n }); }
      out.push(rtube(path, { r: 0.032, k: 3, mat: 'crysL', w }));
    }
    out.push(rtube(colPath2(cheek, NV2, 0, NU2, NU2), { r: 0.022, k: 3, mat: 'crysL', w }));
    out.push(rtube(rowPath(cheek, NU2, 0, NV2, NV2), { r: 0.03, k: 3, mat: 'sheen', w }));
    out.push(rtube(colPath2(cheek, 0, 0, NU2, NU2), { r: 0.035, k: 3, mat: 'sheen', w }));
  }
  const P = merge(...out);
  // (the head's own polygons inside the skull left out: every corner inside it, short of its rim)
  const inside = (i) => { const v = sub(B.V[i], c), th = Math.acos(clamp(unit(v)[1], -1, 1)), ph = Math.atan2(v[0], v[2]); return th < skBot(ph) - 0.1; };
  B.A.polys.forEach(([v], pi) => { if (v.every((i) => inside(i))) P.hides.add(pi); });
  return P;
}
/** A grid's column `fj` from row `i0` to `i1`, lifted `lift` off it. */
function colPath2(G, fj, i0, i1, steps, lift = 0) {
  return [...Array(steps + 1).keys()].map((k) => { const q = G.at(i0 + ((i1 - i0) * k) / steps, fj); return { p: add(q.p, mul(q.n, lift)), n: q.n }; });
}

/* ---- chest & arms ------------------------------------------------------------------------------------------------ */
const headOnly = (B, i) => B.W[i].reduce((t, [b, x]) => t + (B.bones[b].name === 'head' || B.bones[b].name === 'jaw' ? x : 0), 0);
/** The sea-silk under the cuirass: the torso and the arms to the wrists, close over the skin, the skin under it left out. */
function seaSilk(B) {
  const A = B.at, M = torsoMarks(B);
  return shell(B, {
    sub: 0, rim: null,
    keep: (i) => { const p = B.V[i]; return on(B, i, 'torso', 'shoulder', 'upperarm', 'forearm', 'neck', 'head', 'thigh') > 0.6 && headOnly(B, i) < 0.05 && on(B, i, 'hand') < 0.35 && y(p) > M.hip - 0.25 && on(B, i, 'thigh') < 0.5 && y(p) < A.neck[1] - 0.02; },
    off: ({ p }) => 0.065 + 0.03 * smooth(M.waist, M.hip, y(p)) - 0.03 * smooth(A.neck[1] - 0.6, A.neck[1] - 0.1, y(p)),
    mat: ({ bv }) => (shareW(B, B.W[bv], 'shoulder', 'upperarm', 'forearm') > 0.35 ? 'seaG' : 'sea'),
  });
}
/**
 * The cuirass: shell plates lapping down the torso, each a shell's valve (its hinge at its top middle, its ribs fanned
 * from there to the lobes of its rim, its face dark where it tucks under the plate above and pearl toward its rim):
 * two over the breast and two behind, two hoops round the waist below, their rims lobed all round.
 */
function cuirass(B) {
  const A = B.at, M = torsoMarks(B), F = torsoField(B), t = F.tOfY;
  const W = nearSkinW(B, (s) => shareW(B, s.w, 'torso') > 0.7, (n) => TORSO_BONES.has(n), 0.35);
  const out = [];
  const aN = 0.78, side = PI / 2 + 0.04;
  const topF = (a) => { const ax = Math.abs(a), yC = M.neckF + 0.16; if (ax <= aN) return M.neckF + 0.16 * (ax / aN) ** 2; const k = clamp((ax - aN) / (side - aN)); return M.pit + (yC - M.pit) * Math.sqrt(Math.max(0, 1 - k * k)); };
  const bN = 0.62;
  const topB = (a) => { const bx = PI - Math.abs(wrapAngle(a)), yC = M.neckB + 0.1; if (bx <= bN) return M.neckB + 0.1 * (bx / bN) ** 2; const k = clamp((bx - bN) / (PI - side + 0.04 - bN)); return M.pit + (yC - M.pit) * Math.sqrt(Math.max(0, 1 - k * k)); };
  const bulge = (yy, a) => 0.1 * Math.exp(-(((yy - lerp(A.chest, [0, M.waist, 0], 0.4)[1]) / 0.9) ** 2)) * Math.max(0, Math.cos(a)) ** 1.5;
  const keel = (a) => 0.04 * Math.exp(-((a / 0.2) ** 2));
  // (a rim's lobes: x nought to one across it, `n` lobes, each round, hanging `L` below the rim's line at its middle)
  const lobes = (x, n, L) => { const f = x * n - Math.floor(x * n); return L * Math.sqrt(Math.max(0, Math.sin(PI * f))); };
  // (a valve's face: dark teal where it tucks under, violet nacre across its middle, pearl toward its rim)
  const face = (u) => (u > 0.72 ? 'deepT' : u > 0.42 ? 'nacreD' : u > 0.18 ? 'pearl' : 'pearlR');
  const valve = (o) => {
    const NU = 5, NV = o.n * 4;
    const g = plateOn(F, { a0: o.a0, a1: o.a1, closed: o.closed, t0: (a, v) => t(o.bot(a) - lobes(v, o.n, o.L)), t1: (a) => t(o.top(a)), nu: NU, nv: NV,
      off: (u, v, tt, a) => o.off + (o.front ? bulge(F.yOfT(tt), a) + keel(a) : 0) + 0.07 * Math.sin(PI * Math.min(1, u * 1.15)) * (1 - 0.3 * u) });
    out.push(solid(g, { sheet: !o.hollow, hollow: o.hollow, thick: 0.04, w: W, mat: (i) => face((i + 0.5) / NU), edge: 'deepT' }));
    // (its rim rolled in pearl, its ribs fanned from the hinge to each lobe)
    out.push(rtube(rowPath(g, 0, 0, NV, NV), { r: 0.035, k: 3, mat: 'pearlH', w: W, closed: o.closed }));
    for (let k = 0; k < o.n; k++) {
      const jc = (k + 0.5) * 4, j0 = o.closed ? jc : NV / 2 + (jc - NV / 2) * 0.22, path = [];
      for (let q = 0; q <= 3; q++) { const f = q / 3, gq = g.at(NU - 0.35 - (NU - 0.9) * f, j0 + (jc - j0) * f); path.push({ p: add(gq.p, mul(gq.n, 0.01)), n: gq.n }); }
      out.push(rtube(path, { r: 0.04 + 0.01 * (o.n < 7 ? 1 : 0), k: 3, mat: 'pearlH', w: W }));
    }
    return g;
  };
  // -- before: the breast's valve from the neckline, the belly's under it
  const yB0 = lerp(A.chest, [0, M.waist, 0], 0.42)[1], yB1 = M.waist + 0.25;
  const g0 = valve({ front: true, a0: -side, a1: side, n: 5, L: 0.2, top: topF, bot: () => yB0, off: 0.22 });
  valve({ front: true, a0: -side + 0.05, a1: side - 0.05, n: 5, L: 0.18, top: () => yB0 + 0.35, bot: () => yB1, off: 0.17 });
  // (the neckline rolled bright, barnacles along it)
  out.push(rtube(rowPath(g0, 5, 0, 20, 20), { r: 0.045, k: 3, mat: 'sheen', w: W }));
  out.push(...studsAlong(rowPath(g0, 4.4, 3, 17, 16), 7, { r: 0.05, h: 0.06, k: 5, mat: 'pearlH', capMat: 'deepT', w: W }));
  // -- behind: two valves down the back, a ridge down the spine between them
  const b0 = lerp(A.chest, [0, M.waist, 0], 0.45)[1];
  const gb = valve({ a0: side - 0.08, a1: 2 * PI - side + 0.08, n: 5, L: 0.2, top: topB, bot: () => b0, off: 0.2 });
  valve({ a0: side - 0.04, a1: 2 * PI - side + 0.04, n: 5, L: 0.18, top: () => b0 + 0.35, bot: () => M.waist + 0.3, off: 0.15 });
  out.push(rtube(rowPath(gb, 5, 0, 20, 20), { r: 0.045, k: 3, mat: 'sheen', w: W }));
  // -- the waist: two hoops, lobed all round, shorter behind
  const behind = (a) => smooth(1.6, 2.7, Math.abs(wrapAngle(a)));
  for (let k = 0; k < 2; k++) {
    const top = (a) => M.waist + 0.5 - 0.42 * k - 0.1 * behind(a), bot = (a) => top(a) - 0.5 + 0.12 * behind(a);
    valve({ closed: true, hollow: true, a0: -PI, a1: PI, n: 9, L: 0.16, top, bot, off: 0.12 + 0.06 * k });
  }
  return { parts: out, F, M, W };
}

/** The arm's skin samples on side `s`: of the parts given, more than `k` of their weight. */
const armPick = (B, s, parts, k = 0.6) => (q) => (s === 'l' ? q.p[0] > 0.15 : q.p[0] < -0.15) && shareW(B, q.w, ...parts) > k;
const armBones = (s) => (n) => n.endsWith(`_${s}`);
/**
 * One arm: a conch over the shoulder (its body whorl a cop banded in pearl and nacre, a ridge wound round it to a spire
 * standing up and out, knobs along the ridge), a rerebrace with a breaking-wave hem, a couter, a vambrace with a crystal
 * fin along its outside swept back to the elbow, a cuff whose rim breaks in waves.
 */
function armOf(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, sh = A.shoulder[s], el = A.elbow[s], wr = A.wrist[s], female = B.who === 'female';
  const out = [];
  const upDir = unit(sub(el, sh)), foreDir = unit(sub(wr, el)), uaLen = len(sub(el, sh)), faLen = len(sub(wr, el));
  // -- the rerebrace
  const upPick = armPick(B, s, ['upperarm', 'shoulder']);
  const UA = limbWrap(B, sh, el, sg, { t: [0.0, 0.92], nt: 16, a: [-PI, PI], closed: true, na: 24, pick: upPick, smooth: 3, shape: (r) => r });
  const wUp = skinW(B, (q) => upPick(q) && along(q.p, sh, el) > 0.3 && along(q.p, sh, el) < 0.8, armBones(s));
  const rere = plateOn(UA, { a0: -PI, a1: PI, closed: true, t0: (a) => 0.78 + 0.08 * tide(((a / (2 * PI)) + 1) % 1, 6), t1: (a) => 0.3 + 0.12 * (1 - Math.cos(a - PI / 2)) / 2, nu: 5, nv: 36, off: (u) => 0.1 + 0.02 * u });
  out.push(solid(rere, { sheet: true, w: () => wUp, mat: (i) => (i < 3 ? 'pearl' : i < 4 ? 'nacreD' : 'deepT') }));
  for (let k = 0; k < 6; k++) out.push(rtube(colPath(rere, k * 6 + 3, 0.2, 3.6, 3, 0.01), { r: 0.035, k: 3, mat: 'pearlH', w: () => wUp }));
  out.push(rtube(rowPath(rere, 0, 0, 36, 24), { r: 0.03, k: 3, mat: 'pearlH', w: () => wUp, closed: true }));
  // -- the conch: a cop over the shoulder's ball
  const wSh = mixOf(B, [[`shoulder_${s}`, 0.45], [`upperarm_${s}`, 0.15], [`clavicle_${s}`, 0.4]]);
  const ax = unit([sg * 0.5, 0.86, 0]);
  const shPick = (q) => q.p[0] * sg > 0.78 * sh[0] * sg && shareW(B, q.w, 'shoulder', 'upperarm', 'torso') > 0.8 && shareW(B, q.w, 'neck', 'head') < 0.1 && len(sub(q.p, sh)) < 1.25 && q.p[1] > sh[1] - 0.95;
  const cc = add(sh, [sg * 0.02, -0.12, 0]), near = skinSamples(B).filter(shPick).map((q) => sub(q.p, cc));
  const ex = Math.max(...near.map((v) => v[0] * sg)), ro = ex + 0.36, E = [ro * 1.05, ro * 0.62, ro * 0.98];
  const D = domeWrap(B, { c: cc, u: ax, f: [0, 0, 1], s: [0, 1, 0], pick: shPick, rows: 24, cols: 40, thMax: 2.2, cone: 0.35, smooth: 4, shape: (r, th, ph, d) => Math.max(r + 0.28 - 0.14 * Math.max(0, Math.sin(ph)), ellipsoidReach(E, d)) });
  const reach = (ph) => { const c = Math.cos(ph), sn = Math.sin(ph); return Math.max(0.6, (Math.abs(c) * 1.3 + Math.max(0, sn) * 0.36 + Math.max(0, -sn) * 1.4) / (Math.abs(c) + Math.abs(sn))); };
  const NC = 9, VC = 28;
  // (its whorls: each turn of the spiral standing proud of the one below it, bright under the ridge, dark where it tucks under)
  const phase = (u, v) => { const f = clamp(1 - (u * NC - 0.6) / (NC - 1.2)); return 2.2 * f + 0.1 - v; };
  const frac1 = (x) => x - Math.floor(x);
  const cop = plateOn(D, { a0: -PI, a1: PI, closed: true, t0: () => 0, t1: (a) => (reach(a) + 0.12 * tide(((a / (2 * PI)) + 1) % 1, 7)) / 2.2, nu: NC, nv: VC, off: (u, v) => 0.12 * u * u + 0.1 * (1 - frac1(phase(u, v))) * Math.min(1, u * 3) });
  out.push(solid(cop, { sheet: true, w: () => wSh, mat: (i, j) => { const f = frac1(phase((i + 0.5) / NC, (j + 0.5) / VC)); return f > 0.66 ? 'pearl' : f > 0.33 ? 'nacreD' : 'deepT'; } }));
  out.push(rtube(rowPath(cop, NC, 0, VC, VC), { r: 0.045, k: 3, mat: 'pearlH', w: () => wSh, closed: true }));
  // (the ridge wound round it from the rim to the top, two turns, knobs on it)
  const ridge = [];
  for (let k = 0; k <= 28; k++) { const f = k / 28, q = cop.at((NC - 1.2) * (1 - f) + 0.6, (((f * 2.2 + 0.1) % 1)) * VC); ridge.push({ p: add(q.p, mul(q.n, 0.02)), n: q.n }); }
  out.push(rtube(ridge, { r: 0.06, k: 3, mat: 'pearlH', w: () => wSh }));
    for (let k = 3; k < 26; k += 3) out.push(stud(add(ridge[k].p, mul(ridge[k].n, 0.04)), ridge[k].n, { r: 0.09 * (1 - k / 52), h: 0.2 * (1 - k / 52), k: 4, mat: 'pearlR', w: () => wSh }));
  // (the spire: up and out off the top)
  { const top = cop.at(0, 0), d = unit(add(ax, [sg * 0.25, 0, -0.1]));
    out.push(conch(add(top.p, mul(d, -0.06)), d, [0, 0, 1], { R: female ? 0.24 : 0.3, H: female ? 0.55 : 0.68, nu: 5, nv: 10, turns: 2.5, ridgeSteps: 12, taper: 1.1, step: 0.25, mat: 'pearl', matOf: (i) => (i % 2 ? 'nacre' : 'pearl'), ridge: 'sheen', ridgeR: 0.025, w: () => wSh })); }
  // -- the couter: a round cup over the elbow
  const c0 = sub(el, mul(upDir, uaLen * 0.22)), c1 = add(el, mul(foreDir, faLen * 0.2));
  const elPick = (q) => armPick(B, s, ['upperarm', 'forearm'], 0.6)(q) && len(sub(q.p, el)) < 0.9;
  const EL = limbWrap(B, c0, c1, sg, { t: [0, 1], nt: 10, a: [-PI, PI], closed: true, na: 24, pick: elPick, smooth: 3, shape: (r) => r });
  const wEl = boneW(B, `elbow_${s}`);
  const cup = plateOn(EL, { a0: 0.9, a1: 2 * PI - 0.9, t0: () => 0.06, t1: () => 0.94, nu: 6, nv: 16, off: (u, v) => 0.18 + 0.07 * Math.sin(PI * u) * Math.sin(PI * v) });
  out.push(solid(cup, { sheet: true, w: () => wEl, mat: (i) => (i < 2 || i > 3 ? 'nacreD' : 'pearl') }));
  out.push(rtube(rowPath(cup, 0, 0, 16, 8), { r: 0.03, k: 3, mat: 'pearlH', w: () => wEl }));
  out.push(rtube(rowPath(cup, 6, 0, 16, 8), { r: 0.03, k: 3, mat: 'pearlH', w: () => wEl }));
  // -- the vambrace and its fin
  const faPick = armPick(B, s, ['forearm'], 0.6);
  const FA = limbWrap(B, el, wr, sg, { t: [0, 1.0], nt: 14, a: [-PI, PI], closed: true, na: 24, pick: faPick, smooth: 3, shape: (r) => r });
  const wFa = skinW(B, (q) => faPick(q) && along(q.p, el, wr) > 0.25 && along(q.p, el, wr) < 0.85, armBones(s));
  const vamb = plateOn(FA, { a0: -PI, a1: PI, closed: true, t0: () => 0.16, t1: () => 0.82, nu: 6, nv: 24, off: (u) => 0.1 + 0.03 * Math.sin(PI * u) });
  out.push(solid(vamb, { sheet: true, w: () => wFa, mat: (i, j) => (i < 1 ? 'nacreD' : j % 4 === 1 || j % 4 === 2 ? 'pearl' : 'pearlR') }));
  for (let k = 0; k < 6; k++) if (k !== 1) out.push(rtube(colPath(vamb, k * 4, 0.6, 5.6, 3, 0.01), { r: 0.03, k: 3, mat: 'pearlH', w: () => wFa }));
  out.push(rtube(rowPath(vamb, 0, 0, 24, 12), { r: 0.035, k: 3, mat: 'pearlH', w: () => wFa, closed: true }));
  out.push(rtube(rowPath(vamb, 6, 0, 24, 12), { r: 0.03, k: 3, mat: 'pearlH', w: () => wFa, closed: true }));
  { const finA = PI / 2 + 0.25, rootAt = (v) => vamb.at(5.6 - 5 * v, ((finA + PI) / (2 * PI)) * 24);
    out.push(fin({ root: (v) => rootAt(v).p, up: (v) => rootAt(v).n, back: () => mul(foreDir, -1), h: (v) => (female ? 0.4 : 0.48) * (0.25 + 0.75 * Math.sin(PI * Math.min(1, 0.1 + v * 0.95)) ** 0.7), sweep: 0.8, rays: 5, per: 3, nu: 3, spike: 0.45, thick: 0.03, mat: 'crysF', sheet: true, oneSide: true, vein: (k) => k === 2, veinMat: 'rune', ray: 'crysL', rayR: 0.028, rim: 'sheen', rimR: 0.028, w: () => wFa })); }
  // -- the cuff: flared over the wrist, its rim breaking in waves
  const wWr = mixOf(B, [[`hand_${s}`, 0.5], [`wrist_${s}`, 0.25], [`lowerarm_${s}`, 0.25]]);
  const cuff = plateOn(FA, { a0: -PI, a1: PI, closed: true, t0: () => 0.76, t1: (a) => 0.97 + 0.05 * tide(((a / (2 * PI)) + 1) % 1, 6), nu: 3, nv: 36, off: (u) => 0.24 - 0.13 * u });
  out.push(solid(cuff, { hollow: true, w: () => wWr, thick: 0.035, mat: () => 'deepT', edge: 'pearlD' }));
  out.push(rtube(rowPath(cuff, 3, 0, 36, 24), { r: 0.03, k: 3, mat: 'pearlH', w: () => wWr, closed: true }));
  return out;
}

export function seryllChest(B) {
  const T = cuirass(B);
  return coverHides(B, merge(smoothWeights(seaSilk(B), 2, (p) => p[1] < B.at.neck[1] - 0.6), ...T.parts, ...armOf(B, 'l'), ...armOf(B, 'r')), 0.5);
}

/* ---- the mantle ---------------------------------------------------------------------------------------------------- */
/**
 * The tide mantle: a collar of pearl round the neck, its top lobed, lined dark, pinned at the throat by the pearl clasp
 * (a nautilus coiled round a great sea-glass pearl); a shell valve over the shoulder blades from which two crystal fins
 * rise up and out behind, their rays veined in sea-glass; from under the valve a cape of kelp blades in two layers,
 * deep teal and sea-green, each blade waved along its edges with a midrib, to the thigh.
 */
export function seryllMantle(B) {
  const A = B.at, M = torsoMarks(B), F = torsoField(B), t = F.tOfY, female = B.who === 'female', out = [];
  const n = A.neck[1];
  const wNeck = mixOf(B, [['neck_01', 0.55], ['spine_03', 0.45]]);
  const W = nearSkinW(B, (q) => shareW(B, q.w, 'torso') > 0.7, (nm) => TORSO_BONES.has(nm), 0.35);
  const lobes = (x, k, L) => { const f = x * k - Math.floor(x * k); return L * Math.sqrt(Math.max(0, Math.sin(PI * f))); };
  const behind = (a) => smooth(0.9, 2.3, Math.abs(wrapAngle(a)));
  // -- the collar: round the neck, low before, its top lobed
  const cTop = (a) => n + (female ? 0.17 : 0.2) + (female ? 0.16 : 0.3) * behind(a) - 0.27 * smooth(1.5, 0.3, Math.abs(wrapAngle(a)));
  const NVc = 36;
  const collar = plateOn(F, { a0: -PI, a1: PI, closed: true, t0: (a) => t(cTop(a) - (female ? 0.12 : 0.17) + 0.07 * Math.sin(Math.abs(wrapAngle(a))) ** 2), t1: (a, v) => t(cTop(a) + lobes(v, 12, 0.08)), nu: 3, nv: NVc, maxUp: 0.3, off: (u) => 0.1 + 0.04 * (1 - u) });
  out.push(solid(collar, { w: () => wNeck, thick: 0.04, mat: (i) => (i < 1 ? 'nacreD' : 'pearl'), inner: 'deepT', edge: 'deepT' }));
  out.push(rtube(rowPath(collar, 3, 0, NVc, NVc), { r: 0.035, k: 3, mat: 'pearlH', w: () => wNeck, closed: true }));
  out.push(rtube(rowPath(collar, 0, 0, NVc, NVc / 2), { r: 0.04, k: 3, mat: 'deepT', w: () => wNeck, closed: true }));
  // -- the clasp at the throat: a nautilus coiled round the great pearl
  { const yy = cTop(0) - (female ? 0.26 : 0.42), q = F.ta(t(yy), 0), c = add(q.p, mul(q.n, female ? 0.7 : 0.5)), Fr = frameAt(q.n, [0, 1, 0]), R = female ? 0.34 : 0.42;
    out.push(coil(c, Fr.y, mul(Fr.x, -1), { r0: R, grow: 2.6, turns: 1.1, steps: 14, thick: 0.42, flat: 0.7, k: 6, band: 0.25, mat: 'pearl', alt: 'nacreD', w: () => wNeck }));
    out.push(stud(add(c, mul(Fr.z, 0.02)), Fr.z, { r: R * 0.55, h: R * 0.6, k: 8, mat: 'rune', w: () => wNeck })); }
  // -- the valve over the shoulder blades
  const yTopY = n - 0.05, yBotY = lerp(A.chest, [0, M.waist, 0], 0.4)[1], half = female ? 0.8 : 0.95, NUy = 6, NVy = 30;
  const yoke = plateOn(F, { a0: PI - half, a1: PI + half, t0: (a, v) => t(yBotY - lobes(v, 5, 0.26) + 0.35 * ((a - PI) / half) ** 2), t1: (a) => t(yTopY - 0.2 * smooth(0.4, 0.95, Math.abs(a - PI))), nu: NUy, nv: NVy,
    off: (u, v) => 0.5 + 0.1 * Math.sin(PI * u) * Math.sin(PI * v) });
  const wFin = mixOf(B, [['spine_03', 0.75], ['spine_02', 0.25]]), wY = () => wFin;
  out.push(solid(yoke, { w: wY, hollow: true, thick: 0.05, mat: (i) => (i < 1 ? 'pearlR' : i < 2 ? 'pearl' : i < 4 ? 'nacreD' : 'deepT'), edge: 'deepT' }));
  out.push(rtube(rowPath(yoke, 0, 0, NVy, NVy), { r: 0.04, k: 3, mat: 'pearlH', w: wY }));
  for (let k = 0; k < 5; k++) { const jc = (k + 0.5) * 6, path = []; for (let q = 0; q <= 5; q++) { const f = q / 5, g = yoke.at(NUy - 0.4 - (NUy - 0.9) * f, NVy / 2 + (jc - NVy / 2) * (0.25 + 0.75 * f)); path.push({ p: add(g.p, mul(g.n, 0.01)), n: g.n }); } out.push(rtube(path, { r: 0.045, k: 3, mat: 'pearlH', w: wY })); }
  // -- the fins: up and out behind from the shoulder blades, veined in sea-glass
  for (const sg of [1, -1]) {
    const rootAt = (v) => { const g = yoke.at(NUy - 0.7 - 3.6 * v, NVy / 2 - sg * (3.2 + (female ? 3.0 : 3.8) * v)); return g; };
    const H = female ? 3.0 : 3.6;
    out.push(fin({
      root: (v) => add(rootAt(v).p, mul(rootAt(v).n, 0.04)), up: (v) => [sg * (0.8 + 0.9 * v), 1.0 - 0.4 * v, -0.2], back: () => [sg * 0.15, -0.2, -1],
      h: (v) => H * (1 - 0.5 * v ** 0.9), sweep: 0.2, rays: 7, per: 3, nu: 6, spike: 0.32, sharp: 1.3,
      mat: 'crysF', matOf: (i) => (i < 1 ? 'crys' : 'crysF'), sheet: true, ray: 'crysL', rayR: 0.035, vein: (k) => k === 1 || k === 3 || k === 5, veinMat: 'rune', veinR: 0.055, rim: 'sheen', rimR: 0.03, w: () => wFin,
    }));
  }
  out.push(...kelpCape(B, M, yBotY, F));
  return coverHides(B, merge(...out), 0.6);
}

/** The kelp cape: blades in two layers hung from under the shoulder valve, to the thigh behind, waved and ribbed. */
function kelpCape(B, M, yUnder, F) {
  const A = B.at, female = B.who === 'female', out = [], n = A.neck[1];
  const T = cuirass(B), pts = [];
  const armW = (w) => w.some(([b, x]) => x > 0.25 && /(upperarm|lowerarm|elbow|hand|wrist|shoulder_)/.test(B.bones[b].name));
  for (const P of [...T.parts, ...armOf(B, 'l'), ...armOf(B, 'r')]) P.V.forEach((p, i) => { if (!armW(P.W[i]) && p[2] < 0.6) pts.push(p); });
  for (const q of skinSamples(B)) if (shareW(B, q.w, 'torso', 'thigh') > 0.8 && headW(B, q.w) < 0.1 && shareW(B, q.w, 'upperarm', 'shoulder', 'forearm', 'hand') < 0.05) pts.push(q.p);
  const zc = F.zc;
  const yHem = lerp(A.hip.l, A.knee.l, female ? 0.82 : 0.8)[1], cy0 = yHem - 0.8, cy1 = n + 0.2, ct = (yy) => (yy - cy0) / (cy1 - cy0);
  const C = torsoWrap(B, cy0, cy1, zc, {
    points: pts, nt: 60, na: 64, closed: true, a: [-PI, PI], smooth: 3, minDa: 0.1, empty: 0.3,
    post: (R) => { for (let j = 0; j < R[0].length; j++) for (let i = R.length - 2; i >= 0; i--) R[i][j] = Math.max(R[i][j], R[i + 1][j]); },
    shape: (r, tt) => r + 0.14 + 0.1 * smooth(ct(M.waist), ct(M.hip - 0.3), tt) + 0.22 * smooth(ct(M.hip), ct(yHem), tt),
  });
  const thOf = (s) => skinW(B, (q) => q.p[0] * (s === 'l' ? 1 : -1) > 0.12 && shareW(B, q.w, 'thigh') > 0.6 && along(q.p, A.hip[s], A.knee[s]) > 0.25 && along(q.p, A.hip[s], A.knee[s]) < 0.8, (nm) => nm.endsWith(`_${s}`));
  const thW = { l: thOf('l'), r: thOf('r') };
  const anchors = [[A.chest[1], 'spine_03'], [A.spine2[1], 'spine_02'], [A.spine1[1], 'spine_01'], [Math.min(A.pelvis[1], A.spine1[1] - 1.0), 'pelvis']];
  const spineW = (yy) => {
    if (yy >= anchors[0][0]) return boneW(B, anchors[0][1]);
    for (let k = 0; k < anchors.length - 1; k++) { const [y0, b0] = anchors[k], [y1, b1] = anchors[k + 1]; if (yy >= y1) { const f = smooth(y0, y1, yy); return mixW([[boneW(B, b0), 1 - f], [boneW(B, b1), f]]); } }
    return boneW(B, 'pelvis');
  };
  const wCl = (p) => { const f = 0.5 * smooth(M.hip, yHem, p[1]), l = smooth(-0.7, 0.7, p[0]); return mixW([[spineW(p[1]), 1 - f], [thW.l, f * l], [thW.r, f * (1 - l)]]); };
  const yTop = yUnder + 0.3, NU = 14;
  // (each blade: its foot drawn to a point, its edges waved opposite ways so it twists as kelp does, a midrib up it)
  const layer = (K, span, hemOf, lift, mats) => {
    for (let k = 0; k < K; k++) {
      const ac = PI - span + (2 * span * (k + 0.5)) / K, wA = ((2 * span) / K) * 1.15, yb = hemOf(k);
      const G = patch((u, v) => {
        const yy = yb + (yTop - yb) * u, taper = Math.min(1, 0.08 + u * 4) ** 0.9, widen = 0.5 + 0.9 * Math.sin(PI * Math.min(1, u * 1.25)) ** 0.8;
        const a = ac + (v - 0.5) * wA * taper * widen, q = C.ta(ct(yy), a);
        const ruffle = 0.07 * Math.sin(u * 22 + k * 1.7) * (2 * v - 1) * smooth(0.95, 0.6, u);
        return { p: add(q.p, mul(q.n, lift + ruffle)), n: q.n };
      }, NU, 2);
      const m = mats[k % mats.length];
      const blade = smoothWeights(solid(G, { sheet: true, w: wCl, mat: (i) => (i < 3 ? 'kelpT' : m) }), 3);
      out.push(blade);
      { const q = G.at(NU - 1.2, 1); out.push(stud(q.p, q.n, { r: 0.09, h: 0.12, k: 5, mat: 'pearlR', w: () => blade.W[nearestOf(blade.V, q.p)] })); }
      out.push(rtube(colPath(G, 1, 0.4, NU - 0.5, NU, 0.012), { r: 0.025, k: 3, mat: 'kelpL', w: (p) => blade.W[nearestOf(blade.V, p)] }));
    }
  };
  const jit = (k) => 0.5 * Math.sin(k * 12.9898) * Math.sin(k * 4.1);
  const span = female ? 0.8 : 0.8;
  layer(7, span, (k) => yHem + 1.5 * Math.abs((k + 0.5) / 7 - 0.5) * 2 + 0.45 * jit(k + 1), 0.0, ['kelp', 'kelpG']);
  layer(5, span * 0.85, (k) => lerp(A.hip.l, A.knee.l, 0.42)[1] + 0.9 * Math.abs((k + 0.5) / 5 - 0.5) * 2 + 0.4 * jit(k + 7), 0.09, ['kelpG', 'kelp']);
  return out;
}

/* ---- the legs ------------------------------------------------------------------------------------------------------ */
const thighW = (B, s) => { const hp = B.at.hip[s], kn = B.at.knee[s], sg = s === 'l' ? 1 : -1; return skinW(B, (q) => q.p[0] * sg > 0.12 && shareW(B, q.w, 'thigh') > 0.6 && along(q.p, hp, kn) > 0.25 && along(q.p, hp, kn) < 0.8, (n) => n.endsWith(`_${s}`)); };
/** A valve laid on a limb's field `G`: `n` lobes at its foot, ribs fanned from its hinge, its face shaded dark to pearl. */
function limbValve(G, o) {
  const NU = o.nu ?? 4, NV = o.n * 4, out = [];
  const lobe = (v) => { const f = v * o.n - Math.floor(v * o.n); return o.L * Math.sqrt(Math.max(0, Math.sin(PI * f))); };
  const g = plateOn(G, { a0: o.a0, a1: o.a1, closed: o.closed, t0: (a, v) => o.t0 + lobe(v), t1: () => o.t1, nu: NU, nv: NV, off: (u, v) => o.off + o.dome * Math.sin(PI * Math.min(1, (1 - u) * 1.1)) * Math.sin(PI * v) ** 0.6 });
  // (rows run from its foot (row nought, at t0: down the limb) to its top)
  const face = (u) => (u > 0.72 ? 'pearlR' : u > 0.45 ? 'pearl' : u > 0.2 ? 'nacreD' : 'deepT');
  out.push(solid(g, { sheet: true, w: o.w, mat: (i) => face(1 - (i + 0.5) / NU) }));
  out.push(rtube(rowPath(g, 0, 0, NV, NV), { r: 0.03, k: 3, mat: 'pearlH', w: o.w, closed: o.closed }));
  for (let k = 0; k < o.n; k++) {
    const jc = (k + 0.5) * 4, j0 = o.closed ? jc : NV / 2 + (jc - NV / 2) * 0.2, path = [];
    for (let q = 0; q <= 3; q++) { const f = q / 3, gq = g.at(NU - 0.3 - (NU - 0.7) * f, j0 + (jc - j0) * f); path.push({ p: add(gq.p, mul(gq.n, 0.01)), n: gq.n }); }
    out.push(rtube(path, { r: o.ribR ?? 0.032, k: 3, mat: 'pearlH', w: o.w }));
  }
  out.G = g;
  return out;
}
/** One leg: three shell valves lapping down the thigh, a cockle over the knee with a lit pearl at its heart, a fluted greave with a crystal fin down its outside. */
function legOf(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, hp = A.hip[s], kn = A.knee[s], an = A.ankle[s], female = B.who === 'female', out = [];
  const legBones = (nm) => nm.endsWith(`_${s}`);
  const thPick = (q) => (sg > 0 ? q.p[0] > 0.12 : q.p[0] < -0.12) && shareW(B, q.w, 'thigh') > 0.6;
  const TH = limbWrap(B, hp, kn, sg, { t: [0, 1.05], nt: 21, a: [-PI, PI], closed: true, na: 28, pick: thPick, smooth: 4, shape: (r) => r });
  const wTh = thighW(B, s);
  out.push(...limbValve(TH, { a0: -0.95, a1: 2.15, t0: 0.5, t1: 0.17, n: 4, L: 0.09, nu: 4, off: 0.21, dome: 0.12, ribR: 0.042, w: () => wTh }));
  out.push(...limbValve(TH, { a0: -0.85, a1: 2.05, t0: 0.8, t1: 0.44, n: 4, L: 0.09, nu: 4, off: 0.16, dome: 0.11, ribR: 0.042, w: () => wTh }));
  // -- the knee's cockle: a valve over the knee, its hinge up, ribs fanned down to its lobes, a lit pearl at its heart
  const kPick = (q) => (sg > 0 ? q.p[0] > 0.12 : q.p[0] < -0.12) && shareW(B, q.w, 'thigh', 'calf') > 0.8 && len(sub(q.p, kn)) < 0.9;
  const k0 = lerp(hp, kn, 0.78), k1 = lerp(kn, an, 0.2);
  const KN = limbWrap(B, k0, k1, sg, { t: [0, 1], nt: 10, a: [-PI, PI], closed: true, na: 28, pick: kPick, smooth: 4, shape: (r) => r });
  const wKn = boneW(B, `knee_${s}`);
  const cock = limbValve(KN, { a0: -1.7, a1: 1.7, t0: 1.0, t1: 0.02, n: 5, L: 0.07, nu: 6, off: 0.24, dome: 0.17, ribR: 0.04, w: () => wKn });
  out.push(...cock);
  { const q = cock.G.at(3.4, 10); out.push(stud(add(q.p, mul(q.n, 0.01)), q.n, { r: female ? 0.15 : 0.17, h: 0.16, k: 6, mat: 'rune', w: () => wKn }));
    out.push(rtube([...Array(9).keys()].map((j) => { const g = cock.G.at(3.4 + 0.9 * Math.sin((j / 8) * 2 * PI), 10 + 1.9 * Math.cos((j / 8) * 2 * PI)); return { p: add(g.p, mul(g.n, 0.02)), n: g.n }; }), { r: 0.03, k: 3, mat: 'pearlH', w: () => wKn, closed: true })); }
  // -- the greave: closed round the calf, fluted, flared at its foot, a crystal fin down its outside
  const cPick = (q) => (sg > 0 ? q.p[0] > 0.12 : q.p[0] < -0.12) && shareW(B, q.w, 'calf') > 0.6;
  const SH = limbWrap(B, kn, an, sg, { t: [0, 1.02], nt: 20, a: [-PI, PI], closed: true, na: 24, pick: cPick, smooth: 4, shape: (r) => r });
  const wCa = skinW(B, (q) => cPick(q) && along(q.p, kn, an) > 0.2 && along(q.p, kn, an) < 0.85, legBones);
  const NVg = 24;
  const lob = (a, n, L) => { const f = ((a + PI) / (2 * PI)) * n; return L * Math.sqrt(Math.max(0, Math.sin(PI * (f - Math.floor(f))))); };
  const greave = plateOn(SH, { a0: -PI, a1: PI, closed: true, t0: (a) => 0.89 + 0.03 * smooth(1.6, 2.8, Math.abs(a)) + lob(a, 6, 0.03), t1: (a) => 0.15 - lob(a, 6, 0.05), nu: 8, nv: NVg, off: (u, v, t, a) => 0.09 + 0.04 * Math.exp(-((a / 0.3) ** 2)) + 0.1 * Math.exp(-(((t - 0.33) / 0.17) ** 2)) * Math.max(0, -Math.cos(a)) ** 1.5 + 0.1 * smooth(0.76, 0.92, t) ** 1.5 });
  out.push(solid(greave, { sheet: true, w: () => wCa, mat: (i) => (i < 2 ? 'deepT' : i > 6 ? 'nacreD' : 'pearlM') }));
  out.push(rtube(rowPath(greave, 8, 0, NVg, NVg / 2), { r: 0.04, k: 3, mat: 'pearlH', w: () => wCa, closed: true }));
  out.push(rtube(rowPath(greave, 0, 0, NVg, NVg), { r: 0.04, k: 3, mat: 'pearlH', w: () => wCa, closed: true }));
  // (the shin's shell: one great valve down the front of the greave, its hinge under the knee, its ribs fanned to its lobed foot)
  out.push(...limbValve(SH, { a0: -1.55, a1: 1.55, t0: 0.86, t1: 0.14, n: 5, L: 0.06, nu: 7, off: 0.15, dome: 0.1, ribR: 0.04, w: () => wCa }));
  { const finA = PI / 2 + 0.2, col = ((finA + PI) / (2 * PI)) * NVg, rootAt = (v) => greave.at(1.0 + 5.5 * v, col);
    out.push(fin({ root: (v) => rootAt(v).p, up: (v) => rootAt(v).n, back: () => unit(sub(an, kn)), h: (v) => (female ? 0.34 : 0.4) * (0.35 + 0.65 * Math.sin(PI * Math.min(1, 0.1 + v * 0.95)) ** 0.7), sweep: 0.7, rays: 5, per: 3, nu: 3, spike: 0.45, thick: 0.03, mat: 'crysF', sheet: true, oneSide: true, ray: 'crysL', rayR: 0.026, rim: 'sheen', rimR: 0.026, w: () => wCa })); }
  return out;
}
/** The leggings under them: sea-green, over the hips, the seat and the legs to the ankles; the waist (`hoseW`) left out under a chest piece. */
function hoseOf(B) {
  const A = B.at, M = torsoMarks(B);
  return shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'thigh', 'calf', 'torso') > 0.6 && on(B, i, 'foot') < 0.5 && on(B, i, 'upperarm', 'forearm', 'hand', 'shoulder') < 0.05 && y(p) < M.waist + 0.25 && y(p) > A.ankle[s][1] - 0.05; },
    off: () => 0.03,
    mat: ({ p }) => (y(p) > M.hip + 0.05 ? 'hoseW' : 'hose'),
  });
}
export function seryllLegs(B) {
  return { P: merge(smoothWeights(hoseOf(B), 3, (p) => p[1] > B.at.knee.l[1] + 0.6), ...legOf(B, 'l'), ...legOf(B, 'r')), dropAt: (f) => f.mat === 'hoseW' };
}

/* ---- the boots ------------------------------------------------------------------------------------------------------ */
/** One foot: two shell valves lapping over the instep, a ribbed shell over the toes, a crystal fin flaring from the ankle's outside with a sea-glass bead at its root. */
function bootOf(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, an = A.ankle[s], ball = A.ball[s], kn = A.knee[s], female = B.who === 'female', out = [];
  const fPick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'foot') > 0.6;
  const toes = skinSamples(B).filter(fPick);
  const tip = toes.reduce((b, q) => (q.p[2] > b[2] ? q.p : b), [0, 0, -9]);
  const from = [an[0], an[1] - 0.05, an[2] + 0.05], to = [tip[0], A.floor + 0.2, tip[2] + 0.3];
  const tBall = along(ball, from, to), tToe = along(tip, from, to);
  const FT = limbWrap(B, from, to, sg, { front: [0, 1, 0], t: [0, 1.0], nt: 20, a: [-PI, PI], closed: true, na: 20, pick: fPick, smooth: 4,
    shape: (r, t) => r * (t > tToe - 0.15 ? Math.max(0.05, 1 - (t - (tToe - 0.15)) / (1.01 - (tToe - 0.15))) : 1) });
  const wFoot = boneW(B, `foot_${s}`), wBall = boneW(B, `ball_${s}`);
  // (the instep's valves, each lapped over the next toward the toe)
  for (let k = 0; k < 2; k++) {
    const t1 = 0.22 + 0.15 * k, t0 = t1 + 0.22;
    out.push(...limbValve(FT, { a0: -1.7, a1: 1.7, t0, t1, n: 3, L: 0.04, nu: 3, off: 0.12 - 0.015 * k, dome: 0.05, w: () => wFoot }));
  }
  // (the toe cap: a valve from the ball to the point, its ribs fanned to the toe)
  out.push(...limbValve(FT, { a0: -1.85, a1: 1.85, t0: 0.99, t1: tBall - 0.08, n: 4, L: 0.0, nu: 5, off: 0.08, dome: 0.05, w: () => wBall }));
  // (the fin flaring from the ankle's outside, up and back, a sea-glass bead at its root)
  const SH = limbWrap(B, kn, an, sg, { t: [0.75, 1.0], nt: 6, a: [-PI, PI], closed: true, na: 20, pick: (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'calf', 'foot') > 0.6, smooth: 3, shape: (r) => r });
  const wAn = mixOf(B, [[`foot_${s}`, 0.7], [`calf_${s}`, 0.3]]);
  const rootAt = (v) => FT.ta(0.06 + 0.3 * v, PI / 2 + 0.15);
  out.push(fin({ root: (v) => add(rootAt(v).p, mul(rootAt(v).n, 0.1)), up: (v) => add(rootAt(v).n, [0, 0.8 - 0.6 * v, -0.7 + 0.3 * v]), back: () => [0, 0.3, -1], h: (v) => (female ? 0.78 : 0.9) * (1 - 0.45 * v), sweep: 0.5, rays: 4, per: 3, nu: 3, spike: 0.4, mat: 'crysF', sheet: true, oneSide: true, ray: 'crysL', rayR: 0.032, rim: 'crysL', rimR: 0.03, w: () => wAn }));
  { const q = rootAt(0.1); out.push(stud(add(q.p, mul(q.n, 0.12)), q.n, { r: 0.11, h: 0.11, k: 6, mat: 'rune', w: () => wAn })); }
  // (a nautilus coiled at the heel, as the helm's)
  { const hs = toes.filter((q) => q.p[1] < an[1] - 0.15), zb = Math.min(...hs.map((q) => q.p[2])), cc = [an[0], an[1] - 0.28, zb - 0.16], r0 = female ? 0.24 : 0.28;
    out.push(coil(cc, [0, 1, 0], [0, 0, -1], { r0, grow: 3.2, turns: 1.3, steps: 12, thick: 0.46, flat: 0.7, k: 6, band: 0.14, mat: 'pearl', alt: 'nacreD', w: () => wFoot })); }
  return out;
}
/** The boot under them: dark teal over the foot and the ankle, on a thick sole. */
function bootShell(B) {
  const A = B.at;
  const P = shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'foot', 'calf') > 0.6 && y(p) < A.ankle[s][1] + 0.3; },
    off: ({ n }) => 0.045 + (n[1] < -0.6 ? 0.06 : 0),
    mat: ({ n }) => (n[1] < -0.55 ? 'sole' : 'boot'),
  });
  P.soles = P.V.map((_, i) => i).filter((i) => P.V[i][1] < A.floor + 0.12);
  return P;
}
export function seryllBoots(B) {
  return merge(bootShell(B), ...bootOf(B, 'l'), ...bootOf(B, 'r'));
}
void dot; void cross; void len; void nearestOf; void mixW; void sweep; void roundProfile; void torsoWrap; void headW; void band;
