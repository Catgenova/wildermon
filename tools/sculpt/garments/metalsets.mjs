// The metal sets: for each metal with a set of its own, its helm, chest & arms, shawl, leggings and boots, on both
// low-poly bodies, made out of the body itself (tools/sculpt/garments/metalkit.mjs). Each piece's plates are `plate` and
// `shade` (drawn in the piece's metal: src/sculpt/lowpoly.ts plateMat), its glow `rune` (lit in the enchantment's colour).
//
//   node tools/sculpt/garments/metalsets.mjs [--set copper] [--only chest]
//     writes src/sculpt/assets/lowmetal<set><piece>-<who>.json for helm, chest, mantle, legs and boots.
import { writeFileSync } from 'node:fs';
import { STEEL_MATS, steelHelm, steelChest, steelMantle, steelLegs, steelBoots } from './steel.mjs';
import * as CU from './kit/copper.mjs';
import {
  browTheta, chestFront, cloak, disc, feet, forearms, fromFront, gorget, helm, hips, shins, shoulderCaps, shoulders, torso, upperArms, waistOf as waistAt,
} from './metalkit.mjs';
import {
  add, assetOf, bodyOf, browsOf, dome, clamp, cross, dot, frameOf, len, lerp, likeBody, limbAt, loft, merge, mul, onBone, ring, shell, smooth, sub, unit,
} from './metalkit.mjs';

const args = process.argv.slice(2), opt = (n, f) => { const i = args.indexOf(`--${n}`); return i < 0 ? f : args[i + 1]; };
const ASSETS = new URL('../../../src/sculpt/assets/', import.meta.url);
const STUB = `// Written by tools/sculpt/garments/metalsets.mjs beside the mesh of the same name.\nimport type { GarmentAsset } from '../lowpoly';\ndeclare const asset: GarmentAsset;\nexport default asset;\n`;
const frac = (x) => x - Math.floor(x);
const y = (p) => p[1];

/** How far a point's weight is on these parts. */
const on = (B, i, ...parts) => parts.reduce((s, p) => s + B.share(i, p), 0);
/** Where a point is round the torso: radians from the front, toward the body's left. */
const roundTorso = (p) => Math.atan2(p[0], p[2]);
/** A limb's own frame for a point: along it and round it (from its front), on the side the point is on. */
const armAt = (B, p) => { const s = p[0] >= 0 ? 'l' : 'r'; return { s, up: limbAt(p, B.at.shoulder[s], B.at.elbow[s]), fore: limbAt(p, B.at.elbow[s], B.at.wrist[s]) }; };
const legAt = (B, p) => { const s = p[0] >= 0 ? 'l' : 'r'; return { s, thigh: limbAt(p, B.at.hip[s], B.at.knee[s]), shin: limbAt(p, B.at.knee[s], B.at.ankle[s]) }; };

/* ==== copper: the Bronze Age bull warrior (built with tools/sculpt/garments/kit/copper.mjs) ========================= */
const COPPER_MATS = {
  // (hammered copper, lit as metal: its face, its lit edges, its shade, the dark inside of a plate)
  cu: { c: '#8f3415', kind: 3 },
  cuL: { c: '#c75c26', kind: 3 },
  cuS: { c: '#5a1f0c', kind: 3 },
  cuD: { c: '#43200f', kind: 3 },
  // (verdigris in the hollows; the inlay that glows when enchanted is verdigris too)
  patina: { c: '#3f9a82', kind: 2 },
  rune: { c: '#4fa88e', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  linen: { c: '#2b3d5c', kind: 2 },
  linenD: { c: '#1a2638', kind: 2 },
  linenW: { c: '#2b3d5d', kind: 2 },
  cream: { c: '#e4d2a4', kind: 2 },
  creamD: { c: '#b49f72', kind: 2 },
  kilt: { c: '#2e4166', kind: 2 },
  kiltD: { c: '#1b2740', kind: 2 },
  kiltW: { c: '#2e4167', kind: 2 },
  trews: { c: '#a48a63', kind: 2 },
  trewsD: { c: '#6e5a3e', kind: 2 },
  leather: { c: '#5e3622', kind: 2 },
  leatherD: { c: '#3a2216', kind: 2 },
  leatherL: { c: '#8c5a36', kind: 2 },
  tusk: { c: '#efe4c4', kind: 2 },
  tuskS: { c: '#c8b48a', kind: 2 },
  plume: { c: '#b8321e', kind: 2 },
  plumeD: { c: '#7a1f12', kind: 2 },
  hide: { c: '#e6dcc4', kind: 2 },
  hideS: { c: '#b9ab8e', kind: 2 },
  dapple: { c: '#6b3520', kind: 2 },
  dappleD: { c: '#3e2015', kind: 2 },
  horn: { c: '#e2d6b8', kind: 2 },
  hornD: { c: '#4a3a2c', kind: 2 },
  sole: { c: '#2e211a', kind: 2 },
};
const waistOf = (A) => lerp(A.spine1, A.pelvis, 0.45)[1];


/**
 * Chest & arms: a woad linen tunic, its neck and short sleeves bound in cream; over it a three-disc cuirass front and
 * back (two discs over the breast and one below between them; one great disc behind), each disc low-domed and rimmed, the front's ringed with an
 * inlaid band that glows when enchanted; leather straps over the shoulders; a broad copper girdle studded with bosses
 * and clasped with two flat spirals; a spiral armlet coiled round each upper arm, its ends wound flat; a leather bracer
 * wound with copper wire on each forearm.
 */
function copperChest(B) {
  const A = B.at, waist = waistOf(A), PI = Math.PI, parts = [];
  const neckF = A.neck[1] - 0.62, neckB = A.neck[1] - 0.3, sleeveT = 0.4, foot = waist - 0.22;
  const zMid = (A.chest[2] + A.spine2[2]) / 2;
  // -- the tunic: close over the torso, the neck's foot and the arms to the sleeves' hems
  const tunic = CU.softWrap(B, {
    sub: 1,
    keep: (i) => on(B, i, 'torso', 'shoulder', 'upperarm', 'neck', 'head') > 0.6 && on(B, i, 'head') < 0.2 && on(B, i, 'forearm', 'hand') < 0.45 && on(B, i, 'thigh') < 0.5 && y(B.V[i]) > foot - 0.6,
    off: ({ w }) => 0.04 + 0.015 * CU.shareW(B, w, 'upperarm'),
    level: [
      (p) => lerp([0, neckB, 0], [0, neckF, 0], (1 + Math.cos(Math.atan2(p[0], p[2] - zMid))) / 2)[1] - y(p),
      (p) => y(p) - foot,
      (p, w) => (CU.shareW(B, w, 'upperarm', 'forearm', 'hand') > 0.5 ? (sleeveT - armAt(B, p).up.t) * 2 : 1),
    ],
    mat: () => 'linen', rim: 'linenD', thick: 0.03,
  });
  parts.push(tunic);
  // (the neck and the sleeves bound in cream: a flat band laid over each edge; the foot is under the girdle)
  for (const L of tunic.loops) {
    const yy = L.path.reduce((s, q) => s + q.p[1], 0) / L.path.length;
    if (yy < waist + 0.2) continue;
    const w = CU.nearestW(L.path);
    parts.push(CU.tube(CU.loopPath(L, { step: yy > A.shoulder.l[1] ? 0.07 : 0.12, passes: 4, lift: yy > A.shoulder.l[1] ? 0.05 : 0.03 }), { r: 0.048, k: 3, mat: 'cream', w, closed: L.closed }));
  }
  // -- the torso field, laid over the tunic
  const extra = CU.partSamples(tunic).filter((q) => Math.abs(q.p[0]) < A.shoulder.l[0] * 0.95);
  const tPick = (s) => CU.shareW(B, s.w, 'torso', 'thigh') > 0.8 && CU.shareW(B, s.w, 'upperarm', 'shoulder', 'forearm', 'hand') < 0.05 && CU.shareW(B, s.w, 'neck', 'head') < 0.25 && s.p[1] > waist - 0.8;
  const F = CU.torsoField(B, { y0: waist - 0.8, y1: A.neck[1] - 0.2, pick: tPick, extra });
  const TORSO = new Set(['root', 'pelvis', 'spine_01', 'spine_02', 'spine_03']);
  const W = CU.nearSkinW(B, (s) => CU.shareW(B, s.w, 'torso') > 0.7, (n) => TORSO.has(n), 0.35);
  // -- the discs: two over the breast, one below between them; the same behind
  const fem = B.who === 'female', ru = fem ? 0.38 : 0.44, rl = fem ? 0.44 : 0.62, xu = fem ? 0.42 : 0.48;
  const yu = A.chest[1] + (B.who === 'female' ? 0.06 : 0.16), yl = yu - Math.sqrt((ru + rl + 0.02) ** 2 - xu * xu);
  const discs = [];
  // (behind, one great disc between the shoulder blades' foot and the girdle, clear of the mantle and of the shoulders' play)
  const rb = fem ? 0.44 : 0.7, yb = (Math.min(waist + 0.27, yl - rl + 0.03) + A.shoulder.l[1] - (fem ? 0.6 : 0.75)) / 2 - (fem ? 0.04 : 0.06);
  for (const [back, x, yy, rr] of [[false, xu, yu, ru], [false, -xu, yu, ru], [false, 0, yl, rl], [true, 0, yb, rb]]) {
    const G = CU.discOn(F, { y: yy, x, back, r: rr, rings: 3, segs: 16, off: (u) => 0.035 + 0.05 * (1 - u * u), stiff: 0.6 });
    const w = W(G.c);
    discs.push({ G, w, back, x, yy, r: rr });
    // (copper, a dark hollow round the boss; a rolled rim; the front's ringed with inlay, the back's with a raised ring)
    parts.push(CU.solid(G, { w: () => w, thick: 0.045, mat: (i) => (i === 0 ? 'cuS' : 'cu'), inner: null, edge: 'cuS' }));
    parts.push(CU.tube(CU.discRing(G, 1, 20), { r: 0.045, k: 3, mat: 'cuL', w: () => w, closed: true }));
    parts.push(CU.band(CU.discRing(G, 0.6, 20, 0.0), { wide: back ? 0.05 : 0.07, high: 0.025, mat: back ? 'cuL' : 'rune', w: () => w, closed: true }));
    parts.push(CU.stud(G.c, G.n, { r: rr * 0.24, h: rr * 0.16, k: 6, mat: 'cuL', capMat: 'cu', w: () => w }));
    if (!back) parts.push(...CU.studsAlong(CU.discRing(G, 0.84, 36).concat([CU.discRing(G, 0.84, 36)[0]]), 6, { from: 0, to: 1 - 1 / 6, r: 0.045, h: 0.035, k: 4, mat: 'cuS', w: () => w }));
  }
  // -- the straps over the shoulders, each from an upper disc in front to the disc behind
  const strapSurf = CU.partSamples(tunic);
  const WS = CU.nearSkinW(B, (s) => CU.shareW(B, s.w, 'torso', 'shoulder') > 0.7, (n) => TORSO.has(n) || n.startsWith('clavicle'), 0.35);
  for (const sg of [1, -1]) {
    const f = discs.find((d) => !d.back && d.x * sg > 0), b = discs.find((d) => d.back);
    const top = (G) => G.at(1, PI / 2).p;
    // (over the trapezius, halfway from the neck to the shoulder's point)
    const sx = sg * lerp([Math.abs(A.neck[0]) + 0.45, 0, 0], [A.shoulder.l[0], 0, 0], 0.55)[0];
    const near = strapSurf.filter((q) => Math.abs(q.p[0] - sx) < 0.12);
    const over = near.reduce((m, q) => (q.p[1] > m[1] ? q.p : m), [sx, -99, 0]);
    const pf = top(f.G), pb = b.G.at(1, PI / 2 - sg * 0.75).p;
    const pts = [pf, lerp(pf, over, 0.5), add(over, [0, 0, 0.15]), over, add(over, [0, 0, -0.15]), lerp(pb, over, 0.5), pb];
    const path = CU.drapePath(pts, strapSurf, { step: 0.12, lift: 0.06, passes: 3 });
    parts.push(CU.band(path, { wide: 0.17, high: 0.035, sink: 0.01, mat: 'leather', w: WS }));
    parts.push(...CU.studsAlong(path, 2, { from: 0.08, to: 0.92, r: 0.05, h: 0.04, k: 4, mat: 'cuL', w: WS }));
  }
  // -- the girdle: a broad band of copper at the waist, rolled at both edges, a row of bosses round it
  const g0 = waist - 0.3, g1 = Math.min(waist + 0.27, yl - rl + 0.03);
  const girdle = CU.plateOn(F, { a0: -PI, a1: PI, closed: true, t0: () => F.tOfY(g0), t1: () => F.tOfY(g1), nu: 2, nv: 40, off: (u) => 0.06 + 0.02 * Math.sin(PI * u) });
  parts.push(CU.solid(girdle, { w: W, thick: 0.05, mat: () => 'cu', inner: null, edge: 'cuS' }));
  parts.push(CU.tube(CU.rowPath(girdle, 0, 0, 40, 32), { r: 0.048, k: 3, mat: 'cuL', w: W, closed: true }));
  parts.push(CU.tube(CU.rowPath(girdle, 2, 0, 40, 32), { r: 0.048, k: 3, mat: 'cuL', w: W, closed: true }));
  const bosses = 16;
  for (let k = 0; k < bosses; k++) {
    const j = ((k + 0.5) / bosses) * 40, q = girdle.at(1, j);
    if (Math.abs(CU.wrapAngle(-PI + (j / 40) * 2 * PI)) < 0.5) continue;
    parts.push(CU.stud(q.p, q.n, { r: 0.075, h: 0.06, k: 4, mat: 'cuL', capMat: 'cu', w: W }));
  }
  // (the clasp: two flat spirals of thick wire side by side on the girdle's front, joined)
  const front = girdle.at(1, 20), cn = front.n, cx = unit(cross([0, 1, 0], cn));
  for (const sg of [1, -1]) {
    const c = add(add(front.p, mul(cx, sg * 0.21)), mul(cn, 0.06));
    parts.push(CU.tube(CU.spiralPath(c, cn, mul(cx, sg), { r0: 0.03, r1: 0.2, turns: 2.4, per: 9, a0: 0, sense: sg }), { r: 0.04, k: 3, mat: 'cuL', w: W }));
    parts.push(CU.stud(c, cn, { r: 0.05, h: 0.04, k: 5, mat: 'patina', w: W }));
  }
  // -- the arms
  for (const sg of [1, -1]) {
    const s = sg > 0 ? 'l' : 'r', sh = A.shoulder[s], el = A.elbow[s], wr = A.wrist[s];
    const armBones = (n) => n.endsWith(`_${s}`);
    // the spiral armlet: a heavy wire coiled four times round the upper arm below the sleeve, its ends wound flat
    const upPick = (q) => (sg > 0 ? q.p[0] > 0.3 : q.p[0] < -0.3) && CU.shareW(B, q.w, 'upperarm', 'shoulder') > 0.6;
    const UA = CU.limbWrap(B, sh, el, sg, { t: [0.3, 0.95], nt: 13, a: [-PI, PI], closed: true, na: 24, pick: upPick, smooth: 3 });
    const wUp = CU.skinW(B, (q) => upPick(q) && CU.along(q.p, sh, el) > 0.45 && CU.along(q.p, sh, el) < 0.85, armBones);
    const c0 = 0.55, c1 = 0.77, turns = 3;
    const coil = [...Array(Math.round(turns * 12) + 1).keys()].map((k, _, arr) => {
      const t = c0 + ((c1 - c0) * k) / (arr.length - 1), ang = sg * 2 * PI * turns * (k / (arr.length - 1)) + PI / 2 * sg;
      const q = UA.ta(t, ang);
      return { p: add(q.p, mul(q.n, 0.09)), n: q.n };
    });
    parts.push(CU.tube(coil, { r: 0.052, k: 3, mat: 'cuL', w: () => wUp }));
    for (const [t, ang] of [[c0, PI / 2 * sg], [c1, PI / 2 * sg + sg * 2 * PI * turns]]) {
      const q = UA.ta(t, ang), up = unit(sub(sh, el));
      const c = add(q.p, mul(q.n, 0.1));
      parts.push(CU.tube(CU.spiralPath(c, q.n, t === c0 ? up : mul(up, -1), { r0: 0.025, r1: 0.16, turns: 2, per: 8, sense: sg }), { r: 0.038, k: 3, mat: 'cuL', w: () => wUp }));
    }
    // the bracer: leather close round the forearm, wound with copper wire from end to end
    const bracer = CU.softWrap(B, {
      sub: 1,
      keep: (i) => on(B, i, 'forearm', 'hand', 'upperarm') > 0.6 && on(B, i, 'hand') < 0.6 && (sg > 0 ? B.V[i][0] > 0.4 : B.V[i][0] < -0.4),
      off: () => 0.05,
      level: [(p) => CU.along(p, el, wr) - 0.38, (p) => 0.88 - CU.along(p, el, wr)],
      mat: () => 'leather', rim: 'leatherD', thick: 0.035,
    });
    parts.push(bracer);
    const faPick = (q) => (sg > 0 ? q.p[0] > 0.3 : q.p[0] < -0.3) && CU.shareW(B, q.w, 'forearm') > 0.6;
    const FA = CU.limbWrap(B, el, wr, sg, { t: [0.25, 0.97], nt: 14, a: [-PI, PI], closed: true, na: 24, pick: faPick, smooth: 3, extra: CU.partSamples(bracer) });
    const wFa = CU.skinW(B, (q) => faPick(q) && CU.along(q.p, el, wr) > 0.35 && CU.along(q.p, el, wr) < 0.9, armBones);
    const f0 = 0.46, f1 = 0.82, fturns = 3.5;
    const wire = [...Array(Math.round(fturns * 11) + 1).keys()].map((k, _, arr) => {
      const t = f0 + ((f1 - f0) * k) / (arr.length - 1), ang = -sg * 2 * PI * fturns * (k / (arr.length - 1));
      const q = FA.ta(t, ang);
      return { p: add(q.p, mul(q.n, 0.035)), n: q.n };
    });
    const wBr = CU.nearestW(CU.partSamples(bracer));
    parts.push(CU.tube(wire, { r: 0.04, k: 3, mat: 'cuL', w: wBr }));
    void wFa;
  }
  return merge(...parts);
}

/**
 * Leggings: a woad kilt to mid-thigh, its hem bordered in cream and studded with copper; under it linen leg-wraps to the
 * ankle, front and back, bound crosswise with leather thongs; copper greaves shaped to the calf, flared at the ankle,
 * keeled down the shin, rolled at their edges and laced across the calf behind; a domed copper disc over each knee with
 * a spiral of inlay round its boss that glows when enchanted.
 */
function copperLegs(B) {
  const A = B.at, waist = waistOf(A), PI = Math.PI, parts = [];
  const side = (p) => (p[0] >= 0 ? 'l' : 'r');
  const innerOf = (p, n) => dot(n, [-Math.sign(p[0]), 0, 0]);
  const drop = waist - 0.4;
  // -- the trews: every part of the legs from the waist to the ankle, the crotch and the backs of the knees
  const legKeep = (i) => { const p = B.V[i]; return on(B, i, 'thigh', 'calf', 'torso', 'foot') > 0.6 && y(p) < waist + 0.2 && on(B, i, 'torso') < 0.95 || (on(B, i, 'torso') > 0.5 && y(p) < waist + 0.2 && y(p) > A.hip.l[1] - 0.6); };
  const ankleTop = (p) => A.ankle[side(p)][1] + 0.45;
  const trewsOff = ({ p, n }) => 0.035 * (1 - 0.6 * smooth(0, 0.6, innerOf(p, n))) + 0.03 * (1 - smooth(A.ankle.l[1] + 0.45, A.ankle.l[1] + 1.4, y(p))) + 0.04 * Math.max(0, n[2]) * Math.exp(-(((y(p) - A.hip.l[1]) / 0.45) ** 2)) + 0.035 * Math.exp(-(((y(p) - drop) / 0.2) ** 2));
  const atDrop = (V) => V.every((p) => Math.abs(y(p) - drop) < 0.05);
  // -- the kilt: from the waist to mid-thigh, flared out at its hem except between the thighs
  const hipY = A.hip.l[1], hemBase = lerp(A.hip.l, A.knee.l, 0.42)[1];
  const hemY = (p) => { const s = side(p), a = Math.atan2(p[0] - A.hip[s][0], p[2] - A.hip[s][2]), front = Math.cos(a); return hemBase + 0.1 * Math.sin(a) ** 2 - 0.06 * Math.max(0, front) ** 2; };
  const kiltKeep = (i) => { const p = B.V[i]; return on(B, i, 'thigh', 'torso', 'calf') > 0.6 && y(p) < waist + 0.2 && y(p) > A.knee[side(p)][1] - 0.6; };
  // (flared out from the thigh's own axis at the hem, not along the coarse body's normals: a smooth bell; never between the thighs)
  const flare = (p, n) => 0.16 * smooth(hipY + 0.2, hemBase, y(p)) * (1 - smooth(-0.1, 0.5, innerOf(p, n)));
  const kiltOff = () => 0.075;
  const kiltMove = ({ p, n }) => { const s = side(p), ax = A.hip[s], d = [p[0] - ax[0], 0, p[2] - ax[2]]; return mul(unit(d), flare(p, n)); };
  const bandH = 0.26, onBand = (V) => V.every((p) => Math.abs(y(p) - hemY(p) - bandH) < 0.06);
  const kilt = CU.softWrap(B, { sub: 1, keep: kiltKeep, off: kiltOff, move: kiltMove, level: [(p) => y(p) - hemY(p) - bandH, (p) => drop - y(p)], mat: () => 'kilt', rim: 'kiltD', thick: 0.03, hide: false, smoothW: 4, rimSkip: (V) => atDrop(V) || onBand(V) });
  const kiltW = CU.softWrap(B, { sub: 1, keep: kiltKeep, off: kiltOff, move: kiltMove, level: [(p) => waist + 0.05 - y(p), (p) => y(p) - drop], mat: () => 'kiltW', rim: 'kiltW', thick: 0.03, hide: false, smoothW: 4, rimSkip: atDrop });
  parts.push(kilt, kiltW);
  // (from under the kilt to the ankle; the body left out from the kilt's top down, the kilt over the rest)
  // (fine over the thigh, where the hip bends it; coarse below the knee, laid under the fine part's foot)
  const kneeCut = (p) => A.knee[side(p)][1] + 0.1;
  const trewsLo = CU.softWrap(B, { sub: 1, keep: legKeep, off: (q) => trewsOff(q) - 0.008, level: [(p) => kneeCut(p) + 0.2 - y(p), (p) => y(p) - ankleTop(p)], hide: false, mat: () => 'trews', rim: null });
  parts.push(trewsLo);
  const trews = CU.softWrap(B, { sub: 2, keep: legKeep, off: trewsOff, level: [(p) => hemY(p) + bandH + 0.05 - y(p), (p) => y(p) - kneeCut(p)], hideLevel: [(p) => drop - y(p), (p) => y(p) - ankleTop(p)], mat: () => 'trews', rim: 'trewsD', thick: 0.015, hideMargin: 0.05, rimSkip: () => true });
  parts.push(trews);
  // (its border: a cream band along the hem, laid as a strip of its own over the kilt, studded with copper)
  const border = CU.softWrap(B, {
    sub: 1, keep: kiltKeep, off: () => kiltOff() + 0.012, move: kiltMove,
    level: [(p) => y(p) - hemY(p), (p) => bandH - (y(p) - hemY(p))],
    mat: () => 'cream', rim: 'creamD', thick: 0.03, hide: false, smoothW: 4,
  });
  parts.push(border);
  for (const L of border.loops) {
    // (the band's upper edge: copper studs along it)
    const path = CU.loopPath(L, { step: 0.05, passes: 2, lift: 0.0 });
    const hi = path.filter((q) => q.p[1] - hemY(q.p) > 0.18);
    if (hi.length < 4) continue;
    const w = CU.nearestW(L.path);
    for (let k = 0; k < hi.length; k += 4) { const q = hi[k], dn = [0, -0.11, 0]; parts.push(CU.stud(add(q.p, dn), q.n, { r: 0.065, h: 0.05, k: 4, mat: 'cuL', capMat: 'cu', w })); }
  }
  // -- the greaves, the knee discs and the laces
  for (const sg of [1, -1]) {
    const s = sg > 0 ? 'l' : 'r', kn = A.knee[s], an = A.ankle[s];
    const legBones = (n) => n.endsWith(`_${s}`);
    const cPick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && CU.shareW(B, q.w, 'calf') > 0.6;
    const mine = CU.partSamples(trews).filter((q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1));
    const CF = CU.limbWrap(B, kn, an, sg, { t: [-0.05, 1.0], nt: 21, a: [-PI, PI], closed: true, na: 28, pick: cPick, smooth: 3, extra: mine.filter((q) => q.p[1] < kn[1] + 0.2) });
    // (the leg-wraps' thongs: crossed round the thigh from the kilt's hem to the knee)
    const hp = A.hip[s], TF = CU.limbWrap(B, hp, kn, sg, { t: [0.3, 1.0], nt: 12, a: [-PI, PI], closed: true, na: 24, pick: () => false, extra: mine.filter((q) => q.p[1] < hemBase + 0.1 && q.p[1] > kn[1] - 0.2), smooth: 2 });
    const tTop = CU.along([hp[0], hemBase - 0.2, hp[2]], hp, kn), tBot = CU.along([kn[0], kn[1] + 0.35, kn[2]], hp, kn);
    const wT = () => CU.skinW(B, (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && CU.shareW(B, q.w, 'thigh') > 0.7 && q.p[1] < hemBase - 0.2 && q.p[1] > kn[1] + 0.3, legBones);
    const wTv = wT();
    for (const dir of [1, -1]) {
      const n = 18, path = [...Array(n + 1).keys()].map((k) => { const f = k / n, q = TF.ta(tTop + (tBot - tTop) * f, dir * f * 2 * PI * 1.5 + (dir > 0 ? 0 : PI)); return { p: add(q.p, mul(q.n, 0.03)), n: q.n }; });
      parts.push(CU.tube(path, { r: 0.032, k: 3, mat: 'leatherD', w: () => wTv }));
    }
    const wG = CU.skinW(B, (q) => cPick(q) && CU.along(q.p, kn, an) > 0.25 && CU.along(q.p, kn, an) < 0.85, legBones);
    // (front, round to the calf's sides; a little higher at the outside; the top edge dipped under the knee)
    // (its top rising to a point under the kneecap, its foot flared over the cuff; swelling over the calf at the sides, keeled down the shin)
    const gA = 2.15, g0 = (a) => 0.2 - 0.09 * Math.exp(-((a / 0.5) ** 2)) + 0.04 * (1 - Math.cos(a)), gEnd = (kn[1] - (an[1] + 0.78 + 0.2)) / (kn[1] - an[1]), g1 = () => gEnd;
    const gOff = (u, v, t, a) => 0.065 + 0.07 * Math.exp(-(((u - 0.32) / 0.22) ** 2)) * (0.4 + 0.6 * Math.sin(Math.abs(a)) ** 2) + 0.07 * smooth(0.7, 1, u) + 0.05 * Math.exp(-((a / 0.18) ** 2));
    const greave = CU.plateOn(CF, { a0: -gA, a1: gA, t0: (a) => g0(a), t1: g1, nu: 8, nv: 16, off: gOff });
    parts.push(CU.solid(greave, { w: () => wG, thick: 0.045, mat: () => 'cu', inner: null, edge: 'cuS' }));
    const rim = [...CU.colPath(greave, 0, 8, 0, 8), ...CU.rowPath(greave, 0, 0, 16, 24).slice(1), ...CU.colPath(greave, 16, 0, 8, 8).slice(1), ...CU.rowPath(greave, 8, 16, 0, 24).slice(1)];
    parts.push(CU.tube(CU.evenPath(rim, 0.14, true), { r: 0.045, k: 3, mat: 'cuL', w: () => wG, closed: true }));
    // (two engraved lines round it under the knee and above the flare, in verdigris)
    parts.push(CU.band(CU.rowPath(greave, 1.1, 0.5, 15.5, 16), { wide: 0.055, high: 0.02, mat: 'patina', w: () => wG }));
    // (the laces: crossed over the calf from one edge to the other, between eyelets)
    const crosses = 4, lace = [];
    for (let k = 0; k <= crosses * 2; k++) {
      const fi = 1 + (8 * k) / (crosses * 2), j = k % 2 ? 20 : 0, q = greave.at(fi, j);
      lace.push(q.p);
    }
    const lacePath = [];
    for (let k = 0; k + 1 < lace.length; k++) for (let m = 0; m < 6; m++) lacePath.push(lerp(lace[k], lace[k + 1], m / 6));
    // (each lace pulled round behind the calf rather than straight through it)
    const laceAround = lacePath.map((p) => {
      const tt = CU.along(p, kn, an), c = lerp(kn, an, tt), d = sub(p, c), u = unit(sub(an, kn)), dr = sub(d, mul(u, dot(d, u)));
      const ang = Math.atan2(dot(dr, [sg, 0, 0]), dot(dr, [0, 0, 1]));
      const q = CF.ta(tt, ang);
      return { p: add(q.p, mul(q.n, 0.07)), n: q.n };
    });
    parts.push(CU.tube(CU.evenPath(laceAround, 0.2), { r: 0.032, k: 3, mat: 'leatherD', w: () => wG }));
    // the knee disc: domed over the kneecap, a spiral of inlay round its boss
    const kPick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && len(sub(q.p, kn)) < 0.6 && q.p[2] > kn[2];
    const front = CU.partSamples(trews).filter(kPick).reduce((m, q) => (q.p[2] > m.p[2] ? q : m), { p: [0, 0, -9], n: [0, 0, 1] });
    const kc = add(front.p, [0, -0.02, 0.06]), kn2 = unit(add(front.n, [0, 0.1, 0.4]));
    const wK = CU.mixOf(B, [[`knee_${s}`, 0.7], [`calf_${s}`, 0.3]]);
    const kx = unit(cross([0, 1, 0], kn2)), ky = cross(kn2, kx);
    const kr = B.who === 'female' ? 0.3 : 0.34;
    const disc = CU.patch((u, v) => { const a = v * 2 * PI, rr = u * kr; return { p: add(kc, add(add(mul(kx, Math.cos(a) * rr), mul(ky, Math.sin(a) * rr)), mul(kn2, 0.12 * (1 - u * u)))), n: kn2 }; }, 3, 14, { closed: true });
    parts.push(CU.solid(disc, { w: () => wK, thick: 0.04, mat: () => 'cu', inner: null, edge: 'cuS' }));
    parts.push(CU.tube(CU.rowPath(disc, 3, 0, 14, 16), { r: 0.035, k: 4, mat: 'cuL', w: () => wK, closed: true }));
    parts.push(CU.stud(add(kc, mul(kn2, 0.11)), kn2, { r: 0.08, h: 0.06, k: 6, mat: 'cuL', w: () => wK }));
    const sp = CU.spiralPath(add(kc, mul(kn2, 0.1)), kn2, [0, 1, 0], { r0: 0.1, r1: kr * 0.8, turns: 1.6, per: 12, sense: sg });
    parts.push(CU.band(sp.map((q) => { const rr = len(sub(q.p, add(kc, mul(kn2, 0.1)))) / kr; return { p: add(q.p, mul(kn2, 0.12 * (1 - rr * rr) - 0.1 + 0.015)), n: q.n }; }), { wide: 0.045, high: 0.02, mat: 'rune', w: () => wK }));
  }
  return { P: merge(...parts), dropAt: (f) => f.mat === 'kiltW' };
}

/**
 * Boots: soft tan leather to above the ankle on a dark sole, the toe drawn out and curled up to a copper knob, a band of
 * inlay where it turns up that glows when enchanted; a welt up
 * the instep; a cuff of hide turned down over the top, a verdigris wave round it; a copper wire coiled round each
 * ankle.
 */
function copperBoots(B) {
  const A = B.at, PI = Math.PI, parts = [];
  const side = (p) => (p[0] >= 0 ? 'l' : 'r');
  const top = (p) => A.ankle[side(p)][1] + 0.78;
  const keep = (i) => on(B, i, 'foot', 'calf') > 0.5 && y(B.V[i]) < A.ankle[side(B.V[i])][1] + 2.4;
  const bootOff = ({ p, n }) => 0.06 + (n[1] < -0.6 ? 0.03 : 0) + 0.035 * smooth(A.ankle.l[1] + 0.2, A.ankle.l[1] + 0.6, y(p));
  const boot = CU.softWrap(B, {
    sub: 1, keep, off: bootOff, level: [(p) => top(p) - y(p)],
    mat: ({ n }) => (n[1] < -0.55 ? 'sole' : 'leatherL'), rim: 'leatherD', thick: 0.02, hideMargin: 0.05,
  });
  boot.soles = boot.V.map((_, i) => i).filter((i) => boot.V[i][1] < A.floor + 0.12);
  parts.push(boot);
  const bootSamples = CU.partSamples(boot);
  for (const sg of [1, -1]) {
    const s = sg > 0 ? 'l' : 'r', an = A.ankle[s], ball = A.ball[s];
    const mine = bootSamples.filter((q) => (sg > 0 ? q.p[0] > 0.2 : q.p[0] < -0.2));
    const wB = CU.nearestW(mine);
    // -- the cuff: dappled hide turned down over the boot's top, a wave of inlay round it
    const cuff = CU.softWrap(B, {
      sub: 1, keep: (i) => keep(i) && (sg > 0 ? B.V[i][0] > 0.2 : B.V[i][0] < -0.2), off: (q) => bootOff(q) + 0.05,
      level: [(p) => top(p) + 0.06 - y(p), (p) => y(p) - (top(p) - 0.3)],
      mat: () => 'hide', rim: 'hideS', thick: 0.05, hide: false,
    });
    parts.push(cuff);
    for (const L of cuff.loops) {
      const yy = L.path.reduce((t, q) => t + q.p[1], 0) / L.path.length;
      if (yy > top([sg, 0, 0]) - 0.15) continue;
      parts.push(CU.tube(CU.loopPath(L, { step: 0.12, passes: 3, lift: 0.0 }), { r: 0.04, k: 3, mat: 'hideS', w: CU.nearestW(L.path), closed: L.closed }));
    }
    // (the cuff's wave, laid round its middle)
    const CW = CU.limbWrap(B, add(an, [0, 0.3, 0]), add(an, [0, 1.0, 0]), sg, { t: [0, 1], nt: 10, a: [-PI, PI], closed: true, na: 32, pick: () => false, extra: CU.partSamples(cuff), smooth: 2 });
    const tMid = (top([sg, 0, 0]) - 0.13 - (an[1] + 0.3)) / 0.7;
    const wave = [...Array(28).keys()].map((k) => { const a = -PI + (k / 28) * 2 * PI, q = CW.ta(tMid + 0.06 * Math.sin(a * 7), a); return { p: add(q.p, mul(q.n, 0.005)), n: q.n }; });
    parts.push(CU.band(wave, { wide: 0.05, high: 0.02, mat: 'patina', w: wB, closed: true }));
    // -- the anklet: copper wire coiled round the ankle, below the cuff
    const AW = CU.limbWrap(B, add(an, [0, -0.1, 0]), add(an, [0, 0.6, 0]), sg, { t: [0, 1], nt: 10, a: [-PI, PI], closed: true, na: 28, pick: () => false, extra: mine, smooth: 2 });
    const turns = 2.5, coil = [...Array(Math.round(turns * 13) + 1).keys()].map((k, _, arr) => {
      const f = k / (arr.length - 1), q = AW.ta(0.36 + 0.22 * f, sg * f * turns * 2 * PI);
      return { p: add(q.p, mul(q.n, 0.045)), n: q.n };
    });
    parts.push(CU.tube(coil, { r: 0.045, k: 3, mat: 'cuL', w: wB }));
    // -- the seam up the instep: a raised welt from the toe to the cuff
    const front = mine.filter((q) => q.n[2] > 0.3 && q.p[1] < an[1] + 0.7);
    if (front.length) {
      const xc = front.reduce((t, q) => t + q.p[0], 0) / front.length;
      const pts = [[xc, A.floor + 0.3, ball[2] + 0.25], [xc, A.floor + 0.45, ball[2] - 0.1], [xc, an[1] + 0.1, an[2] + 0.45], [xc, an[1] + 0.4, an[2] + 0.38]];
      const path = CU.drapePath(pts, front, { step: 0.1, lift: 0.0, passes: 5 });
      parts.push(CU.band(path, { wide: 0.08, high: 0.03, mat: 'leatherD', w: wB }));
      parts.push(...CU.studsAlong(path, 3, { from: 0.25, to: 0.9, r: 0.05, h: 0.04, k: 4, mat: 'cuL', w: wB }));
    }
    // -- the toe: drawn out from the boot's tip and curled up, a copper knob at its end
    const tip = mine.filter((q) => q.p[1] < A.floor + 0.5).reduce((m, q) => (q.p[2] > m.p[2] ? q : m), { p: [0, 0, -9] });
    const xt = tip.p[0], zt = tip.p[2], h0 = A.floor + 0.2;
    const wT = CU.mixOf(B, [[`ball_${s}`, 0.8], [`foot_${s}`, 0.2]]);
    const pts = [[0, 0.02, -0.3], [0, 0.02, -0.02], [0, 0.07, 0.2], [0, 0.2, 0.36], [0, 0.38, 0.42], [0, 0.52, 0.35], [0, 0.57, 0.24]].map(([dx, dy, dz]) => ({ p: [xt + dx, h0 + dy, zt + dz], n: [0, 1, 0] }));
    const path = CU.evenPath(CU.smoothPath(pts, 2), 0.08), m = path.length - 1;
    parts.push(CU.tube(path, { r: (k) => 0.22 * (1 - 0.78 * (k / m) ** 1.3) + 0.02, k: 6, mat: 'leatherL', capMat: 'leatherL', w: () => wT }));
    // (a copper band where it turns up, and the knob)
    const at = (f) => path[Math.round(m * f)];
    const ringC = at(0.38), rt = unit(sub(at(0.42).p, at(0.34).p)), rx = unit(cross(rt, [1, 0, 0])), ry = cross(rt, rx);
    const rr = 0.22 * (1 - 0.78 * 0.38 ** 1.3) + 0.035;
    parts.push(CU.tube([...Array(10).keys()].map((k) => { const a = (k / 10) * 2 * PI, d = add(mul(rx, Math.cos(a)), mul(ry, Math.sin(a))); return { p: add(ringC.p, mul(d, rr)), n: d }; }), { r: 0.035, k: 4, mat: 'rune', w: () => wT, closed: true }));
    const end = path[m], kn = unit(sub(path[m].p, path[m - 2].p));
    parts.push(CU.sweep([{ p: sub(end.p, mul(kn, 0.04)), n: [0, 1, 0] }, { p: add(end.p, mul(kn, 0.04)), n: [0, 1, 0] }, { p: add(end.p, mul(kn, 0.12)), n: [0, 1, 0] }], { profile: (j) => CU.roundProfile([0.07, 0.09, 0.03][j], 6), closedProfile: true, mat: 'cuL', capMat: 'cu', w: () => wT }));
  }
  return merge(...parts);
}

/** Where a helm's dome is centred on a body: in the head, a little above its bone. */
const headCentre = (B) => [0, B.at.head[1] + 0.72 * (B.at.top - B.at.head[1]) / 1.6, B.at.head[2] + 0.05];
/** The head's points a helm is fitted over: the head and the top of the neck, not the eyes nor the brows. */
const headPts = (B) => { const eye = new Set(B.A.polys.filter((p) => p[1] === 2).flatMap((p) => p[0])); return (i) => !eye.has(i) && B.V[i][1] > B.at.neck[1] + 0.05 && on(B, i, 'head', 'neck') > 0.3; };
/** A direction's polar angle (from up) at a point seen from the head's centre. */
const thetaOf = (B, p) => { const c = headCentre(B), v = sub(p, c); return Math.acos(clamp(v[1] / len(v), -1, 1)); };

/**
 * The boar's-tusk helm: a cone of four rows of tusk plates on a leather cap, each row's plates bowed the other way to the
 * last, a copper hoop between the second row and the third; a copper brow band above the brows with a wave of inlay round
 * it and verdigris edges, the face open below it; copper cheek guards each with a spiral boss, a copper neck guard; a
 * finial on the crown from which a horsehair tail falls fanned behind. Its glow: the brow band's wave.
 */
function copperHelm(B) {
  const c = headCentre(B), head = () => CU.boneW(B, 'head'), browTh = browTheta(B), PI = Math.PI;
  const pick = (s) => CU.shareW(B, s.w, 'head') > 0.5 || (CU.shareW(B, s.w, 'head', 'neck') > 0.6 && s.p[1] > B.at.neck[1] + 0.05);
  const thMax = 2.55;
  const side = (ph) => Math.abs(CU.wrapAngle(ph));
  // (a cone drawn up to a blunt point above the crown, clear of the head all round; close over the brow, so the eyes show)
  const D = CU.domeWrap(B, {
    c, u: [0, 1, 0], f: [0, 0, 1], s: [1, 0, 0], pick, rows: 34, cols: 48, thMax, cone: 0.42, smooth: 4,
    shape: (r, th, ph) => r + 0.12 - 0.05 * smooth(1.0, 0.3, side(ph)) * smooth(browTh - 0.5, browTh - 0.1, th) + 0.36 * Math.max(0, 1 - th / 1.3) ** 2,
  });
  const T = (th) => th / thMax;
  // the helm's foot: above the brows in front, down over the ears, to the nape behind
  const foot = (ph) => { const s = side(ph); return browTh - 0.12 + 0.34 * smooth(0.45, 1.4, s) + 0.08 * smooth(2.2, 3.0, s); };
  const top = 0.2, bandH = 0.18, bandTop = (a) => foot(a) - bandH;
  const parts = [];
  const mk = (G, o) => CU.solid(G, { w: head, ...o });
  // the leather cap under the plates (one-sided: the head is under it)
  const cap = CU.plateOn(D, { a0: 0, a1: 2 * PI, closed: true, t0: () => T(top), t1: (a) => T(bandTop(a) + 0.02), nu: 6, nv: 32, off: () => 0 });
  parts.push(mk(cap, { thick: 0.04, mat: () => 'leatherD', inner: null, walls: false }));
  // the rows of tusk plates, from the crown down to the brow band, dark leather between the rows; a copper hoop at the middle
  const rows = 4, r0 = top + 0.02, gap = 0.07, rowH = (a) => (bandTop(a) - r0 - gap) / rows, rowAt = (a, r) => r0 + rowH(a) * r + (r >= 2 ? gap : 0);
  for (let r = 0; r < rows; r++) {
    const count = [6, 8, 9, 10][r], bow = r % 2 ? -1 : 1;
    for (let k = 0; k < count; k++) {
      const a0 = (k / count) * 2 * PI + (r % 2 ? PI / count : 0) + r * 0.2, w = (2 * PI) / count;
      const mid = (a) => rowAt(a, r) + rowH(a) * 0.5;
      // (a tusk's slice: a crescent bowed up or down, tapering to a point at each end)
      const arc = (v) => bow * 0.06 * (Math.sin(PI * v) - 0.5);
      const half = (a, v) => rowH(a) * 0.5 * (0.12 + 0.62 * Math.sin(PI * v) ** 0.5);
      const g = CU.plateOn(D, {
        a0: a0 - w * 0.04, a1: a0 + w * 1.0, nu: 1, nv: 3,
        t0: (a, v) => T(mid(a) - arc(v) - half(a, v)),
        t1: (a, v) => T(mid(a) - arc(v) + half(a, v)),
        off: (u, v) => 0.035 + 0.035 * Math.sin(PI * v) + 0.03 * u,
      });
      parts.push(mk(g, { thick: 0.045, mat: () => 'tusk', inner: null, edge: 'tuskS' }));
    }
  }
  const hoop = CU.plateOn(D, { a0: 0, a1: 2 * PI, closed: true, t0: (a) => T(rowAt(a, 2) - gap - 0.01), t1: (a) => T(rowAt(a, 2) + 0.01), nu: 1, nv: 32, off: () => 0.05 });
  parts.push(mk(hoop, { thick: 0.04, mat: () => 'cu', inner: null, edge: 'cuS' }));
  parts.push(CU.tube(CU.rowPath(hoop, 0.5, 0, 32, 40, 0.035), { r: 0.03, k: 4, mat: 'cuL', w: head, closed: true }));
  // the brow band: copper, a wave of inlay round it, rolled in verdigris at its top and its foot
  const brow = CU.plateOn(D, { a0: 0, a1: 2 * PI, closed: true, t0: (a) => T(bandTop(a)), t1: (a) => T(foot(a)), nu: 2, nv: 40, off: (u) => 0.05 + 0.02 * u });
  parts.push(mk(brow, { thick: 0.05, mat: () => 'cu', inner: null, edge: 'cuS' }));
  parts.push(CU.tube(CU.rowPath(brow, 2, 0, 40, 32), { r: 0.04, k: 4, mat: 'patina', w: head, closed: true }));
  parts.push(CU.tube(CU.rowPath(brow, 0, 0, 40, 32), { r: 0.034, k: 3, mat: 'patina', w: head, closed: true }));
  const wave = [...Array(64).keys()].map((k) => { const j = (k / 64) * 40, q = brow.at(1 + 0.55 * Math.sin((k / 64) * 2 * PI * 11), j); return { p: q.p, n: q.n }; });
  parts.push(CU.band(wave, { wide: 0.05, high: 0.022, mat: 'rune', w: head, closed: true }));
  // the cheek guards: copper, hung from the band behind each cheekbone, rounded at the foot, a spiral boss on each
  for (const sg of [1, -1]) {
    const mid = sg * 1.3, half = 0.36, drop = 0.42;
    const g = CU.plateOn(D, {
      a0: mid - half, a1: mid + half, nu: 3, nv: 6,
      t0: (a) => T(foot(a) - 0.06),
      t1: (a, v) => T(foot(a) + drop * Math.sqrt(Math.max(0.04, Math.sin(PI * v)))),
      off: (u) => 0.07 + 0.03 * u,
    });
    parts.push(mk(g, { thick: 0.045, mat: () => 'cu', inner: null, edge: 'cuS' }));
    const edgePath = [...CU.colPath(g, 0, 0, 3, 3), ...CU.rowPath(g, 3, 0, 6, 10).slice(1), ...CU.colPath(g, 6, 3, 0, 3).slice(1)];
    parts.push(CU.tube(edgePath, { r: 0.03, k: 4, mat: 'cuL', w: head }));
    const q = g.at(1.8, 3), bossC = add(q.p, mul(q.n, 0.02));
    parts.push(CU.stud(bossC, q.n, { r: 0.075, h: 0.065, k: 6, mat: 'cuL', w: head }));
    parts.push(CU.band(CU.spiralPath(bossC, q.n, [0, 1, 0], { r0: 0.1, r1: 0.19, turns: 1.3, per: 12, sense: sg }), { wide: 0.035, high: 0.02, mat: 'patina', w: head }));
  }
  // the neck guard: copper, flared out over the nape
  const ng = CU.plateOn(D, {
    a0: PI - 0.95, a1: PI + 0.95, nu: 3, nv: 8,
    t0: (a) => T(foot(a) - 0.06),
    t1: (a, v) => T(foot(a) + 0.3 * Math.sqrt(Math.max(0.05, Math.sin(PI * v)))),
    off: (u) => 0.07 + 0.1 * u * u,
  });
  parts.push(mk(ng, { thick: 0.045, mat: () => 'cu', inner: null, edge: 'cuS' }));
  parts.push(CU.tube(CU.rowPath(ng, 3, 0, 8, 14), { r: 0.03, k: 4, mat: 'cuL', w: head }));
  // the finial on the crown
  const crown = D.ta(0, 0).p;
  const lathe = (rs) => CU.sweep(rs.map(([h]) => ({ p: add(crown, [0, h, 0]), n: [0, 0, 1] })), { w: head, mat: (k) => rs[k][2], profile: (k) => CU.roundProfile(rs[k][1], 6), closedProfile: true, capMat: 'cuS' });
  parts.push(lathe([[-0.1, 0.2, 'cuS'], [0.0, 0.17, 'cu'], [0.06, 0.11, 'patina'], [0.12, 0.13, 'cu'], [0.2, 0.15, 'cuL'], [0.28, 0.07, 'cu']]));
  // the horsehair tail: locks from the finial, arched up and back and fanned wide as they fall clear behind the head
  const knot = add(crown, [0, 0.26, -0.02]), strands = 7;
  for (let k = 0; k < strands; k++) {
    const f = (k / (strands - 1)) * 2 - 1, long = 1 - 0.15 * f * f;
    const pts = [[0, 0], [0.36, -0.12], [0.48, -0.5], [0.32, -0.98], [-0.12, -1.38], [-0.72, -1.62], [-1.3, -1.72]];
    const path = pts.map(([yy, zz], j) => {
      const t = j / (pts.length - 1);
      return { p: add(knot, [f * (0.06 + 0.5 * t ** 1.4), yy * long - 0.15 * f * f * t, zz * long + 0.15 * f * f * t]), n: [0, 1, 0] };
    });
    const sm = CU.evenPath(CU.smoothPath(path, 2), 0.2);
    const rr = 0.14 - 0.035 * Math.abs(f);
    parts.push(CU.tube(sm, { r: (j) => rr * (1 - 0.72 * (j / (sm.length - 1)) ** 1.3) + 0.01, k: 4, mat: k % 3 === 1 ? 'plumeD' : 'plume', w: head }));
  }
  return merge(...parts);
}

/**
 * The bull-hide mantle: a dappled hide over the shoulders, its hem cut in tongues each tipped with a copper bead, longer
 * behind to a point between the shoulder blades; a copper lunula on the breast over it, its horns pinned at the shoulders
 * by two spiral brooches; a pair of bull's horns standing from the shoulders on copper sockets, tipped in copper. Its
 * glow: the lunula's engraved arcs and the brooches' spirals.
 */
function copperMantle(B) {
  const A = B.at, PI = Math.PI, fem = B.who === 'female', parts = [];
  const chest = copperChest(B);
  const sh = A.shoulder.l, neckY = A.neck[1];
  // -- the dome the hide is laid on: round the neck's foot, over the shoulders, the chest piece under it
  const c = [0, sh[1] + 0.05, A.chest[2] * 0.5 + A.spine2[2] * 0.5];
  const under = (q) => q.p[1] > sh[1] - 1.5 && q.p[1] < neckY - 0.1 && !(Math.abs(q.p[0]) > sh[0] * 0.8 && q.p[1] < sh[1] - 0.5);
  const pick = (s) => CU.shareW(B, s.w, 'head') < 0.3 && CU.shareW(B, s.w, 'torso', 'shoulder', 'upperarm', 'neck') > 0.8 && s.p[1] > sh[1] - 0.95 && s.p[1] < neckY + 0.05 && !(CU.shareW(B, s.w, 'upperarm') > 0.5 && armAt(B, s.p).up.t > 0.45);
  const D = CU.domeWrap(B, { c, u: [0, 1, 0], f: [0, 0, 1], s: [1, 0, 0], pick, extra: CU.partSamples(chest).filter(under), rows: 36, cols: 64, thMax: 2.45, cone: 0.3, smooth: 5 });
  // (its hem: down over the breast to above the discs, over the shoulders to the arm's top, longer behind; cut in tongues)
  const tongues = 18, discTop = A.chest[1] + (fem ? 0.06 : 0.16) + (fem ? 0.38 : 0.44);
  const hemY = (ph) => {
    const s = Math.abs(CU.wrapAngle(ph)), back = smooth(1.6, 2.9, s);
    const side = Math.exp(-(((s - PI / 2) / 0.55) ** 2));
    const base = lerp([0, discTop + 0.2, 0], [0, sh[1] - (fem ? 0.6 : 0.75), 0], back)[1] * (1 - side) + (sh[1] - (fem ? 0.06 : 0.08)) * side;
    const point = 0.3 * Math.max(0, 1 - (PI - s) / 0.55) ** 1.5;
    const tongue = 0.17 * Math.abs(Math.sin((tongues / 2) * ph)) ** 0.7;
    return base - point - tongue;
  };
  const tHem = (ph) => CU.domeTAtY(D, ph, hemY(ph), 0, 1);
  const collarY = (ph) => neckY - (fem ? 0.32 : 0.3) - 0.12 * (1 + Math.cos(ph)) / 2, tTopAt = (ph) => CU.domeTAtY(D, ph, collarY(ph), 0, 1), tTop = 0.24;
  const hideOff = (u) => 0.1 + 0.02 * u;
  // (standing further off over the shoulders' points, which rise into it as the arms are raised)
  const shoulderRoom = (a) => 0.07 * Math.exp(-(((Math.abs(CU.wrapAngle(a)) - PI / 2) / 0.6) ** 2));
  const hide = CU.plateOn(D, { a0: 0, a1: 2 * PI, closed: true, t0: (a) => tTopAt(a), t1: (a) => tHem(a), nu: 9, nv: 72, off: (u, v, t, a) => hideOff(u) + shoulderRoom(a) * u });
  const TORSOISH = (n) => !n.startsWith('head') && !n.startsWith('jaw') && !n.startsWith('neck_02');
  const W = CU.nearSkinW(B, (s) => CU.shareW(B, s.w, 'head') < 0.05 && CU.shareW(B, s.w, 'torso', 'shoulder', 'upperarm', 'neck') > 0.8 && s.p[1] > sh[1] - 1.2, TORSOISH, 0.3);
  let hw = hide.P.map((row) => row.map((p) => W(p)));
  // (the weights smoothed over the hide, so no edge spans a sharp change of bone: it bends, it does not tear)
  for (let pass = 0; pass < 40; pass++) hw = hw.map((row, i) => row.map((w, j) => CU.mixW([[w, 2], [hw[Math.max(0, i - 1)][j], 1], [hw[Math.min(hw.length - 1, i + 1)][j], 1], [row[(j + 1) % row.length], 1], [row[(j + row.length - 1) % row.length], 1]])));
  parts.push(CU.solid(hide, { w: (p, i, j) => hw[i][j], thick: 0.05, mat: () => 'hide', inner: null, edge: 'hideS' }));
  // (the dapples: dark patches of the hide, each its own ragged outline)
  const R = CU.rng(fem ? 7 : 5);
  const hwAt = (p) => { let b = null, bd = Infinity; hide.P.forEach((row, i) => row.forEach((q, j) => { const d = len(sub(q, p)); if (d < bd) { bd = d; b = hw[i][j]; } })); return b; };
  for (let k = 0; k < 14; k++) {
    const fi = 2 + R() * 5, fj = (k / 14) * 72 + R() * 3, base = 1.6 + R() * 1.4, ph1 = R() * 6, ph2 = R() * 6;
    parts.push(CU.blob(hide, fi, fj, { r: (a) => base * (1 + 0.3 * Math.sin(3 * a + ph1) + 0.15 * Math.sin(5 * a + ph2)), kr: 0.45, k: 10, rings: 1, lift: 0.012, mat: k % 3 ? 'dapple' : 'dappleD', w: hwAt }));
  }
  parts.push(CU.tube(CU.rowPath(hide, 0, 0, 72, 40, 0.02), { r: 0.085, k: 5, mat: 'dapple', w: hwAt, closed: true }));
  // (a copper bead at each tongue's tip)
  for (let k = 0; k < tongues; k++) {
    if (Math.abs(Math.abs(CU.wrapAngle(((k + 0.5) / tongues) * 2 * PI)) - PI / 2) < 0.7) continue;
    const ph = ((k + 0.5) / tongues) * 2 * PI, q = hide.at(9, (ph / (2 * PI)) * 72);
    const w = hwAt(q.p);
    const down = [0, -1, 0];
    const dn = unit(sub(hide.at(9, (ph / (2 * PI)) * 72).p, hide.at(7.2, (ph / (2 * PI)) * 72).p)), bq = add(q.p, mul(q.n, 0.03));
    parts.push(CU.sweep([{ p: add(bq, mul(dn, -0.03)), n: q.n }, { p: add(bq, mul(dn, 0.08)), n: q.n }, { p: add(bq, mul(dn, 0.19)), n: q.n }], { profile: (j) => CU.roundProfile([0.035, 0.07, 0.02][j], 4), closedProfile: true, mat: 'cuL', capMat: 'cu', w: () => w }));
    void down;
  }
  // -- the lunula: a copper crescent on the breast over the hide, its horns at the shoulders
  const lw = fem ? 0.34 : 0.4, span = 0.95, yTop = (a) => neckY - (fem ? 0.48 : 0.46) - 0.12 * (a / span) ** 2;
  const t0L = (a) => CU.domeTAtY(D, a, yTop(a), 0, 1);
  const t1L = (a) => CU.domeTAtY(D, a, Math.max(discTop + 0.06, yTop(a) - 0.05 - lw * Math.cos((a / span) * PI / 2) ** 1.6), 0, 1);
  const lun = CU.plateOn(D, { a0: -span, a1: span, t0: (a) => t0L(a), t1: (a) => t1L(a), nu: 3, nv: 24, off: (u) => hideOff(u) + 0.025 + 0.01 * Math.sin(PI * u) });
  const lunW = lun.P.map((row) => row.map((p) => hwAt(p)));
  parts.push(CU.solid(lun, { w: (p, i, j) => lunW[i][j], thick: 0.035, mat: () => 'cu', inner: null, edge: 'cuS' }));
  const lwAt = (p) => { let b = null, bd = Infinity; lun.P.forEach((row, i) => row.forEach((q, j) => { const d = len(sub(q, p)); if (d < bd) { bd = d; b = lunW[i][j]; } })); return b; };
  parts.push(CU.tube(CU.rowPath(lun, 0, 0, 24, 28), { r: 0.035, k: 4, mat: 'cuL', w: lwAt }));
  parts.push(CU.tube(CU.rowPath(lun, 3, 0, 24, 28), { r: 0.04, k: 4, mat: 'cuL', w: lwAt }));
  for (const fi of [1.0, 2.0]) parts.push(CU.band(CU.rowPath(lun, fi, 1, 23, 22), { wide: 0.05, high: 0.02, mat: 'rune', w: lwAt }));
  // (the brooches pinning its horns: a flat spiral of wire round a boss)
  for (const v of [0.15, 23.85]) {
    const q = lun.at(1.5, v), n = q.n, cc = add(q.p, mul(n, 0.04)), w = lwAt(q.p);
    parts.push(CU.stud(cc, n, { r: 0.1, h: 0.06, k: 6, mat: 'cuL', capMat: 'cu', w: () => w }));
    parts.push(CU.tube(CU.spiralPath(cc, n, [0, 1, 0], { r0: 0.12, r1: 0.25, turns: 1.6, per: 12, sense: v < 1 ? 1 : -1 }), { r: 0.036, k: 4, mat: 'rune', w: () => w }));
  }
  // -- the horns: standing from the shoulders on copper sockets, swept out and up, tipped in copper
  for (const sg of [1, -1]) {
    const s = sg > 0 ? 'l' : 'r';
    const wH = CU.mixOf(B, [[`clavicle_${s}`, 0.55], ['spine_03', 0.45]]);
    const ph = sg * (PI / 2 - 0.12);
    // (rooted on the shoulder's top, a little in from its point)
    const q = D.ta(CU.domeTAtY(D, ph, sh[1] + (fem ? 0.36 : 0.42), 0, 1), ph);
    const base = add(q.p, mul(q.n, hideOff(1) + 0.07));
    const n = unit(add(q.n, [0, 0.6, 0]));
    const out = [sg, 0, 0];
    const L = fem ? 1.15 : 1.35;
    const pts = [[0, 0, 0], [0.22, 0.1, 0.02], [0.5, 0.32, 0.04], [0.66, 0.66, 0.1], [0.66, 1.0, 0.22], [0.6, 1.26, 0.38], [0.48, 1.4, 0.5]].map(([o, u, f]) => add(base, add(add(mul(out, o * L), [0, u * L, 0]), [0, 0, f * L])));
    const path = CU.evenPath(CU.smoothPath(pts.map((p) => ({ p, n: [0, 0, 1] })), 2), 0.11);
    const m = path.length - 1, r0 = (fem ? 0.17 : 0.21);
    parts.push(CU.tube(path, { r: (k) => r0 * (1 - 0.88 * (k / m) ** 0.9) + 0.012, k: 6, mat: (k) => (k > m * 0.62 ? 'hornD' : 'horn'), w: () => wH }));
    // (the socket: a copper cup round the horn's root, studded)
    const sock = [{ p: add(base, mul(n, -0.06)), n: [0, 0, 1] }, { p: add(base, mul(n, 0.06)), n: [0, 0, 1] }, { p: add(base, mul(n, 0.16)), n: [0, 0, 1] }];
    parts.push(CU.sweep(sock, { profile: (j) => CU.roundProfile([0.26, 0.24, 0.19][j] * (fem ? 0.88 : 1), 8), closedProfile: true, mat: (j) => (j === 0 ? 'cu' : 'cuL'), capMat: 'cuS', w: () => wH }));
    // (the tip: a copper cap, ringed with inlay)
    const tip = path.slice(Math.round(m * 0.86));
    parts.push(CU.tube(tip, { r: (k) => 0.05 * (1 - k / tip.length) + 0.015, k: 5, mat: 'cuL', w: () => wH }));
    const ringAt = path[Math.round(m * 0.84)];
    const tdir = unit(sub(path[Math.round(m * 0.88)].p, path[Math.round(m * 0.8)].p));
    const rx = unit(cross(tdir, [0, 0, 1]));
    const ring = [...Array(10).keys()].map((k) => { const a = (k / 10) * 2 * PI, d = add(mul(rx, Math.cos(a)), mul(cross(tdir, rx), Math.sin(a))); return { p: add(ringAt.p, mul(d, r0 * 0.4)), n: d }; });
    parts.push(CU.tube(ring, { r: 0.03, k: 4, mat: 'cuL', w: () => wH, closed: true }));
  }
  return merge(...parts);
}

/* ==== iron: the early medieval foot soldier (the Norman and the Norseman) ========================================== */
const IRON_MATS = {
  hoseW: { c: '#5a4637', kind: 2 },
  fe: { c: '#7d8590', kind: 3 },
  feS: { c: '#4d535c', kind: 3 },
  rivet: { c: '#a9b0ba', kind: 3 },
  rune: { c: '#5f7f9a', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  mail: { c: '#6f7680', kind: 3 },
  mailD: { c: '#3f444b', kind: 3 },
  gam: { c: '#3f5677', kind: 2 },
  gamD: { c: '#2a3a52', kind: 2 },
  wool: { c: '#4f6247', kind: 2 },
  woolD: { c: '#34412f', kind: 2 },
  hose: { c: '#5a4636', kind: 2 },
  hoseD: { c: '#3c2e24', kind: 2 },
  leather: { c: '#6b4630', kind: 2 },
  leatherD: { c: '#3e281c', kind: 2 },
  sole: { c: '#2e211a', kind: 2 },
};
/** The iron coat's depth: the gambeson under it, the lamellar over the chest and the back, a step at each row's foot. */
const ironRow = (A) => (A.chest[1] + 0.35 - waistOf(A)) / 5;
const ironCoat = (A, p) => { const r = frac((A.chest[1] + 0.35 - y(p)) / ironRow(A)); return y(p) < A.chest[1] + 0.35 && y(p) > waistOf(A) - 0.6 ? 0.19 + 0.03 * r + 0.09 * smooth(A.chest[1] - 0.2, A.chest[1] + 0.35, y(p)) : y(p) > waistOf(A) ? 0.13 : 0.09; };

function ironChest(B) {
  const A = B.at, waist = waistOf(A), R = ironRow(A), top = A.chest[1] + 0.35;
  // the gambeson to the hips, the iron coat of lames over it from the chest down, a belt at the waist
  const coat = torso(B, {
    from: waist - 0.6,
    off: (p) => ironCoat(A, p) + (Math.abs(y(p) - waist) < 0.1 ? 0.05 : 0),
    mat: (p) => {
      if (Math.abs(y(p) - waist) < 0.1) return Math.abs(p[0]) < 0.12 && p[2] > 0 ? 'rivet' : 'leatherD';
      if (y(p) >= top || y(p) < waist - 0.6) return frac((p[0] + y(p)) * 2.2) < 0.15 || frac((p[0] - y(p)) * 2.2) < 0.15 ? 'gamD' : 'gam';
      const r = frac((top - y(p)) / R), col = frac((roundTorso(p) / (2 * Math.PI)) * 26);
      if (r > 0.86) return 'feS';
      if (r < 0.2 && col > 0.4 && col < 0.6) return 'rune';
      if (col < 0.07) return 'feS';
      return 'fe';
    },
    rim: 'feS',
    caps: { off: () => 0.15, mat: (p) => (frac((p[0] + y(p)) * 2.2) < 0.15 ? 'gamD' : 'gam') },
  });
  // square shoulder plates, two lames
  const pl = shoulders(B, {
    off: (t) => (t < 0.12 ? 0.3 : 0.33),
    mat: (t) => (t > 0.1 && t < 0.15 ? 'feS' : t > 0.3 ? 'feS' : frac(t * 9) < 0.15 ? 'rivet' : 'fe'),
  });
  // the gambeson's long sleeves, quilted
  // (the armpit's front fold, and the arm's inner side where it faces front or back, on his body only: hers lies against
  // the arm and crosses it in the walk)
  const sleeves = upperArms(B, { from: -0.35, to: 1.05, pit: B.who === 'male', inner: -0.3, innerZ: 0.2, thick: 0.02, off: (t, p, n) => (t < 0.45 && n[0] * Math.sign(p[0]) < -0.3 ? 0.03 : 0.09), mat: (u, p) => (frac(u.t * 7) < 0.18 ? 'gamD' : 'gam') });
  // the vambraces: iron bands over the sleeve's end, a glowing band at the wrist
  const vamb = forearms(B, { from: -0.15, to: 0.93, elbow: true, off: (f) => 0.1 + (f.t > 0.3 ? 0.04 : 0), mat: (f) => { if (f.t < 0.3) return frac(f.t * 8) < 0.2 ? 'gamD' : 'gam'; if (f.t > 0.8) return 'rune'; return frac(f.t * 7) < 0.25 ? 'feS' : 'fe'; } });
  return merge(coat, pl, sleeves, vamb);
}

function ironLegs(B) {
  const A = B.at, waist = waistOf(A);
  // wool trousers, the waist left out under a chest piece
  const hose = hips(B, { closed: true, top: waist + 0.25, foot: (s) => lerp(A.hip[s], A.knee[s], 1)[1], off: (p) => 0.11 + 0.08 * smooth(A.hip.l[1] - 0.4, A.knee.l[1], y(p)) + (p[2] > 0.1 && y(p) < Math.min(A.hip.l[1] + 0.3, waist - 0.75) ? 0.13 : 0), mat: (p) => (y(p) > waist - (B.who === 'female' ? 0.75 : 0.5) ? 'hoseW' : frac(y(p) * 1.4) < 0.1 ? 'hoseD' : 'hose'), rim: 'hoseD' });
  // the knee cops and the splints down the shin, a glowing rim round each cop
  const shin = shins(B, {
    from: -0.18, to: 0.85, round: 1.35,
    off: (g) => (g.t < 0.12 ? 0.2 + 0.08 * Math.cos(g.a) * (1 - Math.abs(g.t) * 5) : 0.13),
    mat: (g) => { if (g.t < 0.12) return g.t < -0.11 || g.t > 0.1 ? 'rune' : 'fe'; if (g.t < 0.17) return 'leatherD'; const k = frac((g.a + 1.35) / 2.7 * 4); return k < 0.12 ? 'hoseD' : frac(g.t * 6) < 0.1 ? 'rivet' : 'fe'; },
    rim: 'feS',
  });
  // the trousers' shins under the splints
  const calves = shins(B, { from: 0.12, to: 0.9, round: 3.2, off: () => 0.07, mat: () => 'hose', rim: 'hoseD' });
  return { P: merge(hose, calves, shin), dropAt: (f) => f.mat === 'hoseW' };
}

function ironBoots(B) {
  const A = B.at;
  return feet(B, {
    up: 0.75,
    off: (p, n, top) => (y(p) > top - 0.22 ? 0.03 : 0),
    mat: (p, n, top) => {
      const s = p[0] >= 0 ? 'l' : 'r';
      if (y(p) > top - 0.22) return y(p) > top - 0.08 ? 'fe' : 'rune';
      if (Math.abs(y(p) - (A.ankle[s][1] - 0.05)) < 0.06) return 'feS';
      return p[2] > A.ball[s][2] + 0.2 ? 'leatherD' : 'leather';
    },
    rim: 'leatherD',
  });
}

function ironHelm(B) {
  const browTh = browTheta(B), top0 = 0.5;
  return helm(B, {
    rim: 'feS', down: 2.22,
    margin: ({ th }) => 0.1 + 0.42 * Math.max(0, 1 - th / 1.2) ** 1.6,
    mat: (d, { th, ph }) => {
      const s = fromFront(ph);
      // the face open below the brow but for the nasal; the mail falling round the sides and the back
      if (th > browTh && s < 0.95 && !(s < 0.12 && th < browTh + 0.55)) return null;
      if (th > browTh + 0.08) { if (s < 0.12) return 'fe'; return frac(th * 18 + (Math.floor(ph * 10) % 2) * 0.5) < 0.5 ? 'mail' : 'mailD'; }
      if (th > browTh - 0.12) return frac(ph * 12 / (2 * Math.PI)) < 0.25 ? 'rune' : 'feS';
      // the four ribs of the frame, riveted
      const rib = frac(ph / (Math.PI / 2) + 0.5);
      if (rib < 0.08 || rib > 0.92) return th > top0 && frac(th * 6) < 0.25 ? 'rivet' : 'feS';
      return 'fe';
    },
  });
}

function ironMantle(B) {
  const A = B.at, sx = A.shoulder.l[0];
  // a wool cloak over both shoulders and down the back to the seat, its edge and its lining darker; a square iron pin at
  // the right shoulder
  const cloth = cloak(B, {
    start: (x) => lerp([2.1, 0, 0], [1.2, 0, 0], smooth(0.7, 1.1, Math.abs(x)))[0],
    wide: (s) => lerp([0.88 * sx, 0, 0], [0.74 * sx, 0, 0], smooth(0, 0.5, s))[0],
    over: [ironChest(B)],
    off: () => 0.18, thick: 0.04,
    hang: lerp(A.spine1, A.pelvis, 0.8)[1], folds: 7, fold: 0.12,
    mat: (p, u, s) => (Math.abs(u) > 0.93 || s > 0.96 ? 'woolD' : frac(s * 9) < 0.08 ? 'woolD' : 'wool'),
    rim: 'woolD',
  });
  // (the pin on the cloak's front edge over the right shoulder)
  const at = cloth.V.filter((p) => p[0] < -0.95 && p[0] > -1.25).reduce((b, p) => (p[2] > b[2] ? p : b), [0, 0, -9]);
  const pin = disc(B, add(at, [0, 0.03, 0.02]), [0, 0.85, 0.5], [[0.2, 0, 'feS'], [0.2, 0.05, 'fe'], [0.15, 0.06, 'rune'], [0.1, 0.06, 'feS'], [0.06, 0.1, 'fe']]);
  return merge(cloth, pin);
}

/* ==== bronze: the hoplite (Classical Greece) ======================================================================= */
const BRONZE_MATS = {
  brz: { c: '#8f7330', kind: 3 },
  brzS: { c: '#4d3a16', kind: 3 },
  brzL: { c: '#c4a552', kind: 3 },
  rune: { c: '#8a6a3a', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  linen: { c: '#e6dcc4', kind: 2 },
  linenD: { c: '#b8aa88', kind: 2 },
  linenW: { c: '#e6dcc5', kind: 2 },
  crest: { c: '#a3261c', kind: 2 },
  crestD: { c: '#2a2220', kind: 2 },
  red: { c: '#8e2a1f', kind: 2 },
  redD: { c: '#5c1913', kind: 2 },
  leather: { c: '#5a3a26', kind: 2 },
  leatherD: { c: '#35231a', kind: 2 },
  sole: { c: '#2b1d16', kind: 2 },
};
/** The muscle cuirass's depth: the chest's two pectorals and the belly's six, raised; the foot flared over the hips. */
const bronzeCuirassOff = (A, p) => {
  const ax = Math.abs(p[0]), waist = waistOf(A);
  const pec = 0.07 * Math.exp(-(((ax - 0.48) / 0.32) ** 2) - (((y(p) - (A.chest[1] + 0.25)) / 0.32) ** 2));
  const absRow = frac((A.chest[1] - 0.35 - y(p)) / 0.42), inAbs = y(p) < A.chest[1] - 0.3 && y(p) > waist + 0.05 && ax < 0.42;
  const abs = inAbs && p[2] > 0 ? 0.035 * Math.sin(Math.PI * absRow) * Math.cos((ax / 0.42) * Math.PI * 0.5) : 0;
  return 0.16 + (p[2] > 0 ? pec + abs : 0) + 0.12 * smooth(waist + 0.35, waist - 0.25, y(p));
};

function bronzeChest(B) {
  const A = B.at, waist = waistOf(A);
  // the muscle cuirass, to the hips; its pectorals and belly raised and outlined; a glowing line round its foot
  const coat = torso(B, {
    from: waist - 0.5,
    off: (p) => bronzeCuirassOff(A, p),
    mat: (p) => {
      const ax = Math.abs(p[0]);
      if (y(p) < waist - 0.32) return y(p) < waist - 0.42 ? 'brzS' : 'rune';
      if (p[2] > 0) {
        // (the pectorals' foot, the line down the breastbone, the belly's rows)
        const pecFoot = A.chest[1] - 0.05 - 0.25 * (1 - Math.min(1, ax / 0.75));
        if (Math.abs(y(p) - pecFoot) < 0.05 && ax < 0.8) return 'brzS';
        if (ax < 0.04 && y(p) < A.chest[1] + 0.3) return 'brzS';
        if (y(p) < A.chest[1] - 0.3 && y(p) > waist + 0.05 && ax < 0.42 && frac((A.chest[1] - 0.35 - y(p)) / 0.42) < 0.1) return 'brzS';
        if (Math.abs(ax - 0.48) < 0.18 && Math.abs(y(p) - (A.chest[1] + 0.3)) < 0.12) return 'brzL';
      }
      return 'brz';
    },
    rim: 'brzS',
    caps: { off: () => 0.2, mat: (p) => (frac(p[2] * 2.2) < 0.12 ? 'linenD' : 'linen') },
  });
  // the chiton's short sleeves, linen
  const sleeves = upperArms(B, { from: -0.35, to: 0.5, pit: B.who === 'male', inner: -0.3, innerZ: 0.2, thick: 0.02, off: (t, p, n) => (t < 0.45 && n[0] * Math.sign(p[0]) < -0.3 ? 0.03 : 0.09), mat: (u) => (u.t > 0.44 ? 'linenD' : 'linen') });
  // the bracers: leather, a bronze band at each end, a glowing line between
  const bracer = forearms(B, { from: 0.35, to: 0.93, off: (f) => 0.09 + (f.t < 0.42 || f.t > 0.86 ? 0.04 : 0), mat: (f) => (f.t < 0.42 || f.t > 0.86 ? 'brz' : Math.abs(f.t - 0.64) < 0.03 ? 'rune' : 'leather') });
  return merge(coat, sleeves, bracer);
}

function bronzeLegs(B) {
  const A = B.at, waist = waistOf(A);
  const skirtFoot = (s) => lerp(A.hip[s], A.knee[s], 0.5)[1];
  // the chiton's hem under: the hips and the thighs' tops, its waist left out under a chest piece
  const chiton = hips(B, { inner: -0.05, top: waist + 0.25, foot: (s) => lerp(A.hip[s], A.knee[s], 0.4)[1], off: (p) => 0.09 + 0.05 * smooth(A.hip.l[1], skirtFoot('l'), y(p)), mat: (p) => (y(p) > waist - 0.1 ? 'linenW' : 'linen'), rim: 'linenD' });
  // the pteruges: two rows of linen strips from the waist, each edged, a glowing line round the upper row's foot
  const strips = shell(B, {
    sub: 2, hide: false,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; if (y(p) > waist - 0.32 || y(p) < skirtFoot(s) - 0.05) return false; if (on(B, i, 'thigh', 'torso') < 0.6) return false; const inner = dot(B.N[i], [-Math.sign(p[0]), 0, 0]); return !(inner > 0.35 && y(p) < A.hip[s][1] + 0.1) && !(Math.abs(p[0]) < 0.32 && y(p) < A.hip[s][1] - 0.1); },
    // (from under the cuirass's foot, inside its rim, flaring out below it)
    off: ({ p }) => { const s = p[0] >= 0 ? 'l' : 'r'; return 0.11 + 0.17 * smooth(waist - 0.5, skirtFoot(s), y(p)); },
    mat: ({ p }) => {
      const s = p[0] >= 0 ? 'l' : 'r', a = (roundTorso(p) + Math.PI) / (2 * Math.PI), mid = lerp([waist, 0, 0], [skirtFoot(s), 0, 0], 0.45)[0];
      const k = frac(a * 22 + (y(p) < mid ? 0.5 : 0));
      if (k < 0.08) return null;
      if (Math.abs(y(p) - mid) < 0.06) return 'rune';
      return k < 0.2 || k > 0.9 ? 'linenD' : 'linen';
    },
    rim: 'linenD', thick: 0.04,
  });
  // the greaves: bronze, shaped to the knee and the calf, sprung round the leg, open behind; a glowing spiral on the knee
  const greaves = shins(B, {
    from: -0.16, to: 0.9, round: 2.5,
    off: (g) => 0.12 + 0.07 * Math.exp(-(((g.t - 0.32) / 0.2) ** 2)) * (Math.abs(g.a) > 0.6 ? 1 : 0.4) + (g.t < 0.08 ? 0.06 * Math.cos(g.a) : 0),
    mat: (g) => {
      if (g.t < 0.08) { const r = Math.hypot(g.t + 0.04, g.a * 0.25); return frac(r * 14 - Math.atan2(g.a, g.t + 0.04) / (2 * Math.PI)) < 0.25 ? 'rune' : 'brzL'; }
      if (g.t > 0.84 || Math.abs(g.a) > 2.3) return 'brzS';
      if (Math.abs(g.a) < 0.05) return 'brzS';
      return 'brz';
    },
    rim: 'brzS',
  });
  return { P: merge(chiton, strips, greaves), dropAt: (f) => f.mat === 'linenW' };
}

function bronzeBoots(B) {
  const A = B.at;
  // the endromides: dark leather laced up the front in linen, a turned-down flap at the top over a glowing band
  return feet(B, {
    up: 0.85,
    off: (p, n, top) => (y(p) > top - 0.18 ? 0.05 : 0),
    mat: (p, n, top) => {
      const s = p[0] >= 0 ? 'l' : 'r';
      if (y(p) > top - 0.18) return y(p) > top - 0.06 ? 'leatherD' : 'leather';
      if (y(p) > top - 0.27) return 'rune';
      const fwd = p[2] - A.ankle[s][2], across = p[0] - A.ankle[s][0];
      if (fwd > 0.15 && y(p) > A.floor + 0.35 && Math.abs(across) < 0.3) { const l = frac((y(p) * 3 + across * 3.2)), r = frac((y(p) * 3 - across * 3.2)); if (l < 0.18 || r < 0.18) return 'linen'; }
      return p[2] > A.ball[s][2] + 0.2 ? 'leatherD' : 'leather';
    },
    rim: 'leatherD',
  });
}

function bronzeHelm(B) {
  const browTh = browTheta(B);
  const P = helm(B, {
    rim: 'brzS', down: 2.2,
    // (a crest-box down the middle, front to back, raised as a ridge)
    margin: ({ th, ph }) => { const mid = Math.min(fromFront(ph), Math.PI - fromFront(ph)); return 0.1 + (th < 1.35 && mid < 0.2 ? 0.45 * (1 - mid / 0.2) ** 0.4 * Math.min(1, (1.35 - th) / 0.3) : 0) + 0.12 * Math.max(0, 1 - th / 1.1); },
    mat: (d, { th, ph }) => {
      const s = fromFront(ph), mid = Math.min(s, Math.PI - s);
      if (th < 1.35 && mid < 0.2) return mid < 0.06 ? 'crestD' : 'crest';
      // the Corinthian face: closed but for the eyes and the slit down the mouth, the nasal between the eyes
      if (th > browTh + 0.02 && th < browTh + 0.3 && s > 0.1 && s < 0.6) return null;
      if (th > browTh + 0.45 && s < 0.09) return null;
      if (Math.abs(th - browTh) < 0.06) return s < 1.3 ? 'rune' : 'brzS';
      if (th > browTh && (Math.abs(s - 0.1) < 0.03 || Math.abs(s - 0.6) < 0.04) && th < browTh + 0.32) return 'brzS';
      return th > 2.15 ? 'brzS' : 'brz';
    },
  });
  return P;
}

function bronzeMantle(B) {
  const A = B.at, sx = A.shoulder.l[0];
  // the chlamys: red wool over both shoulders and down the back, a key-pattern border at its foot and its sides; a bronze
  // disc pinning it over the right shoulder
  const cloth = cloak(B, {
    start: (x) => lerp([2.1, 0, 0], [1.2, 0, 0], smooth(0.7, 1.1, Math.abs(x)))[0],
    wide: (s) => lerp([0.88 * sx, 0, 0], [0.7 * sx, 0, 0], smooth(0, 0.5, s))[0],
    over: [bronzeChest(B)],
    off: () => 0.18, thick: 0.04,
    hang: lerp(A.spine1, A.pelvis, 0.85)[1], folds: 5, fold: 0.15,
    mat: (p, u, s) => {
      if (s > 0.88 || Math.abs(u) > 0.9) { const k = frac(u * 10) < 0.5 !== frac(s * 30) < 0.5; return s > 0.97 || Math.abs(u) > 0.97 ? 'redD' : k ? 'linenD' : 'redD'; }
      return 'red';
    },
    rim: 'redD',
  });
  const at = cloth.V.filter((p) => p[0] < -0.95 && p[0] > -1.25).reduce((b, p) => (p[2] > b[2] ? p : b), [0, 0, -9]);
  const pin = disc(B, add(at, [0, 0.03, 0.02]), [0, 0.85, 0.5], [[0.22, 0, 'brzS'], [0.22, 0.05, 'brz'], [0.17, 0.06, 'rune'], [0.11, 0.06, 'brzL'], [0.06, 0.1, 'brz']]);
  return merge(cloth, pin);
}

/* ==== steel: the Milanese harness (tools/sculpt/garments/steel.mjs, built with the plate kit) ================== */

/* ==== fur: the tundra raider (a new armour class, between leather and chain) ========================================= */
const FUR_MATS = {
  fur: { c: '#7a5a3c', kind: 2 },
  furL: { c: '#a68761', kind: 2 },
  furD: { c: '#4a3423', kind: 2 },
  furW: { c: '#d9d2c2', kind: 2 },
  furWD: { c: '#aea694', kind: 2 },
  leather: { c: '#5b3b26', kind: 2 },
  leatherD: { c: '#36231a', kind: 2 },
  leatherW: { c: '#5b3b27', kind: 2 },
  bone: { c: '#e2d6b8', kind: 2 },
  rune: { c: '#8b7d62', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  sole: { c: '#2b1d16', kind: 2 },
};
/** A pelt's tufts: a hash of where a point is, smooth enough to read as clumps. */
// (streaks down the pelt, the hair's fall: fine across, long down)
const tuft = (p) => { const h = Math.sin(p[0] * 19 + p[2] * 17 + 2.2 * Math.sin(p[1] * 2.3)) + 0.7 * Math.sin(p[0] * 31 - p[2] * 23 + p[1] * 1.3 + 1.1) + 0.4 * Math.sin(p[1] * 4.1 + p[0] * 3); return h / 2.1; };
const pelt = (p, light = 'furL', dark = 'furD') => { const h = tuft(p); return h > 0.62 ? light : h < -0.68 ? dark : 'fur'; };

function furChest(B) {
  const A = B.at, waist = waistOf(A);
  // the vest: a pelt to the hips, shaggy, its shoulders' fur raised; two leather straps crossed over the chest with bone toggles
  const strap = (p) => p[2] > 0 && y(p) < A.chest[1] + 0.55 && y(p) > waist + 0.1 && Math.min(Math.abs(p[0] - (y(p) - A.chest[1]) * 0.9), Math.abs(p[0] + (y(p) - A.chest[1]) * 0.9)) < 0.11;
  const coat = torso(B, {
    from: waist - 0.45,
    off: (p) => 0.2 + 0.04 * tuft(p) + (strap(p) ? 0.04 : 0) + 0.06 * smooth(waist, waist - 0.4, y(p)),
    mat: (p) => {
      if (strap(p)) return Math.abs(Math.abs(p[0]) - 0.32) < 0.05 && Math.abs(y(p) - (A.chest[1] + 0.2)) < 0.4 ? 'bone' : 'leather';
      if (y(p) < waist - 0.33) return 'furW';
      if (Math.abs(y(p) - (waist + 0.02)) < 0.07) return p[2] > 0 && Math.abs(p[0]) < 0.1 ? 'rune' : 'leatherD';
      return pelt(p);
    },
    rim: 'furD',
    caps: { off: (p) => 0.3 + 0.05 * tuft(p), mat: (p) => pelt(p, 'furW', 'fur') },
  });
  // the arms: leather wraps from the elbow to the wrist, a fur cuff at the elbow, a glowing bead line at the wrist
  const wraps = forearms(B, {
    from: -0.1, to: 0.93, elbow: true,
    off: (f) => 0.08 + (f.t < 0.2 ? 0.12 + 0.03 * Math.sin(f.a * 5) : 0),
    mat: (f, p) => { if (f.t < 0.2) return pelt(p, 'furW', 'fur'); if (f.t > 0.85) return f.t > 0.89 ? 'leatherD' : 'rune'; return frac(f.t * 7 + f.a * 0.3) < 0.18 ? 'leatherD' : 'leather'; },
  });
  return merge(coat, wraps);
}

function furLegs(B) {
  const A = B.at, waist = waistOf(A);
  // the leggings: a pelt over the hips and thighs, its waist left out under a chest piece
  const hose = hips(B, { closed: true, top: waist + 0.05, foot: (s) => lerp(A.hip[s], A.knee[s], 1)[1], off: (p) => 0.13 + 0.03 * tuft(p) + 0.06 * smooth(A.hip.l[1] - 0.4, A.knee.l[1], y(p)) + (p[2] > 0.1 && y(p) < Math.min(A.hip.l[1] + 0.3, waist - 0.75) ? 0.12 : 0), mat: (p) => (y(p) > waist - (B.who === 'female' ? 0.6 : 0.5) ? 'leatherW' : pelt(p)), rim: (m) => (m === 'leatherW' ? 'leatherW' : 'furD') });
  // the shins: fur wrapped round, bound with leather cross-garters, a glowing bead line under the knee
  const shin = shins(B, {
    from: -0.08, to: 0.9, round: 2.6,
    off: (g, p) => 0.12 + 0.02 * tuft(p) + (frac(g.t * 6 + g.a * 0.5) < 0.16 || frac(g.t * 6 - g.a * 0.5) < 0.16 ? 0.03 : 0),
    mat: (g, p) => { if (g.t < 0.34 && Math.abs(g.a) > 1.7) return null; if (g.t < 0.17) return 'rune'; if (frac(g.t * 6 + g.a * 0.5) < 0.16 || frac(g.t * 6 - g.a * 0.5) < 0.16) return 'leatherD'; return pelt(p); },
    rim: 'furD',
  });
  return { P: merge(hose, shin), dropAt: (f) => f.mat === 'leatherW' };
}

function furBoots(B) {
  const A = B.at;
  // the boots: leather to the ankle, a deep white fur cuff above it over a glowing bead line
  return feet(B, {
    up: 0.85,
    off: (p, n, top) => (y(p) > top - 0.45 ? 0.1 + 0.03 * tuft(p) : 0.02),
    mat: (p, n, top) => {
      const s = p[0] >= 0 ? 'l' : 'r';
      if (y(p) > top - 0.45) return pelt(p, 'furW', 'furWD') === 'fur' ? 'furW' : pelt(p, 'furW', 'furWD');
      if (y(p) > top - 0.53) return 'rune';
      return p[2] > A.ball[s][2] + 0.2 ? 'leatherD' : 'leather';
    },
    rim: 'leatherD',
  });
}

function furHelm(B) {
  const browTh = browTheta(B);
  // the hood: a wolf's pelt over the head, its ears up, a pale ruff round the face; a glowing bead band at the brow
  return helm(B, {
    rim: 'furD', down: 2.1,
    margin: ({ th, ph }) => {
      const s = fromFront(ph), ear = Math.exp(-(((th - 0.62) / 0.16) ** 2) - (((s - 0.85) / 0.22) ** 2));
      return 0.17 + 0.05 * Math.sin(ph * 9 + th * 7) + 0.45 * ear + (th > browTh - 0.1 && s < 1.2 ? 0.08 : 0);
    },
    mat: (d, { th, ph, p }) => {
      const s = fromFront(ph);
      if (th > browTh + 0.05 && s < 0.95) return null;
      if (th > browTh - 0.12 && s < 1.25) return Math.abs(th - (browTh - 0.04)) < 0.065 && s < 1.1 ? 'rune' : 'furW';
      const ear = Math.exp(-(((th - 0.62) / 0.16) ** 2) - (((s - 0.85) / 0.22) ** 2));
      if (ear > 0.5) return ear > 0.8 ? 'furD' : 'furL';
      return pelt(p);
    },
  });
}

function furMantle(B) {
  const A = B.at, sx = A.shoulder.l[0];
  // the cloak: a heavy pelt over the shoulders and down past the seat, a white ruff at the collar, a bone clasp on the right
  const cloth = cloak(B, {
    start: (x) => lerp([2.1, 0, 0], [1.2, 0, 0], smooth(0.7, 1.1, Math.abs(x)))[0],
    wide: (s) => lerp([0.9 * sx, 0, 0], [0.72 * sx, 0, 0], smooth(0.1, 0.55, s))[0],
    over: [furChest(B)],
    off: () => 0.22, thick: 0.06,
    hang: lerp(A.spine1, A.pelvis, 0.9)[1], folds: 6, fold: 0.16,
    mat: (p, u, s) => (s < 0.12 ? pelt(p, 'furW', 'furWD') : s > 0.95 ? 'furD' : pelt(p)),
    rim: 'furD',
  });
  const at = cloth.V.filter((p) => p[0] < -0.95 && p[0] > -1.25).reduce((b, p) => (p[2] > b[2] ? p : b), [0, 0, -9]);
  const pin = disc(B, add(at, [0, 0.03, 0.02]), [0, 0.85, 0.5], [[0.18, 0, 'bone'], [0.18, 0.05, 'bone'], [0.12, 0.06, 'rune'], [0.07, 0.08, 'bone']]);
  return merge(cloth, pin);
}

/* ==== tin: the town militia ======================================================================================== */
const TIN_MATS = {
  tn: { c: '#868c90', kind: 3 },
  tnS: { c: '#52575b', kind: 3 },
  rune: { c: '#7d8a8f', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  jack: { c: '#a8873c', kind: 2 },
  jackD: { c: '#755d27', kind: 2 },
  drab: { c: '#5d6650', kind: 2 },
  drabD: { c: '#3f4636', kind: 2 },
  hose: { c: '#6a4a3a', kind: 2 },
  hoseD: { c: '#47312a', kind: 2 },
  hoseW: { c: '#6a4a3b', kind: 2 },
  leather: { c: '#5e3f2a', kind: 2 },
  leatherD: { c: '#3a271c', kind: 2 },
  sole: { c: '#2b1f18', kind: 2 },
};
/** The jack's quilting: a diamond lattice. */
const quilt = (p, a = 'jack', b = 'jackD') => (frac((p[0] + y(p)) * 2.4) < 0.12 || frac((p[0] - y(p)) * 2.4) < 0.12 ? b : a);

function tinChest(B) {
  const A = B.at, waist = waistOf(A);
  // the padded jack to the hips, quilted; a tin breastplate over its front, a glowing line round the breastplate's foot
  const front = (p) => p[2] > 0.1 && y(p) > waist - 0.05 && y(p) < A.chest[1] + 0.55 && Math.abs(p[0]) < 0.95;
  const coat = torso(B, {
    from: waist - 0.5,
    off: (p) => 0.13 + (front(p) ? 0.1 : 0) + 0.05 * smooth(waist, waist - 0.45, y(p)),
    mat: (p) => {
      if (front(p)) { if (y(p) < waist + 0.08) return 'rune'; if (Math.abs(p[0]) > 0.85 || y(p) > A.chest[1] + 0.47) return 'tnS'; return 'tn'; }
      if (Math.abs(y(p) - waist) < 0.07) return 'leatherD';
      return quilt(p);
    },
    rim: 'jackD',
    caps: { off: () => 0.15, mat: (p) => quilt(p) },
  });
  const sleeves = upperArms(B, { from: -0.35, to: 1.05, pit: B.who === 'male', inner: -0.3, innerZ: 0.2, thick: 0.02, off: (t, p, n) => (t < 0.45 && n[0] * Math.sign(p[0]) < -0.3 ? 0.03 : 0.1), mat: (u, p) => quilt(p) });
  const cuffs = forearms(B, { from: -0.15, to: 0.93, elbow: true, off: (f) => 0.1 + (f.t > 0.78 ? 0.03 : 0), mat: (f, p) => (f.t > 0.78 ? (f.t > 0.86 ? 'leatherD' : 'leather') : quilt(p)) });
  return merge(coat, sleeves, cuffs);
}

function tinLegs(B) {
  const A = B.at, waist = waistOf(A);
  const hose = hips(B, { closed: true, top: waist + 0.05, foot: (s) => lerp(A.hip[s], A.knee[s], 1)[1], off: (p) => 0.11 + 0.08 * smooth(A.hip.l[1] - 0.4, A.knee.l[1], y(p)) + (p[2] > 0.1 && y(p) < Math.min(A.hip.l[1] + 0.3, waist - 0.75) ? 0.13 : 0), mat: (p) => (y(p) > waist - (B.who === 'female' ? 0.6 : 0.5) ? 'hoseW' : frac(y(p) * 1.4) < 0.08 ? 'hoseD' : 'hose'), rim: (m) => (m === 'hoseW' ? 'hoseW' : 'hoseD') });
  const calves = shins(B, { from: 0.12, to: 0.9, round: 3.2, off: () => 0.07, mat: () => 'hose', rim: 'hoseD' });
  // the knee cops: tin, a glowing rim round each
  const cops = shins(B, {
    from: -0.18, to: 0.16, round: 1.4,
    off: (g) => 0.16 + 0.07 * Math.cos(g.a) * (1 - Math.abs(g.t) * 4),
    mat: (g) => (g.t < -0.13 || g.t > 0.12 ? 'rune' : Math.abs(g.a) > 1.2 ? 'tnS' : 'tn'),
    rim: 'tnS',
  });
  return { P: merge(hose, calves, cops), dropAt: (f) => f.mat === 'hoseW' };
}

function tinBoots(B) {
  const A = B.at;
  // ankle boots, a tin toe cap, a strap at the ankle over a glowing band
  return feet(B, {
    up: 0.6,
    off: (p, n, top) => { const s = p[0] >= 0 ? 'l' : 'r'; return (p[2] > A.ball[s][2] + 0.15 ? 0.03 : 0) + (y(p) > top - 0.2 ? 0.02 : 0); },
    mat: (p, n, top) => {
      const s = p[0] >= 0 ? 'l' : 'r';
      if (y(p) > top - 0.12) return 'leatherD';
      if (y(p) > top - 0.22) return 'rune';
      return p[2] > A.ball[s][2] + 0.15 ? 'tn' : 'leather';
    },
    rim: 'leatherD',
  });
}

function tinHelm(B) {
  const browTh = browTheta(B);
  // the kettle hat: a round crown and a wide brim all round, a glowing band where they meet
  return helm(B, {
    rim: 'tnS', down: browTh + 0.25,
    margin: ({ th }) => 0.12 + 0.05 * Math.max(0, 1 - th / 1.0) + (th > browTh - 0.12 ? 0.5 * smooth(browTh - 0.12, browTh + 0.15, th) : 0),
    mat: (d, { th }) => {
      if (th > browTh - 0.12) return th > browTh + 0.08 ? 'tnS' : 'tn';
      if (th > browTh - 0.22) return 'rune';
      return frac(th * 5) < 0.06 ? 'tnS' : 'tn';
    },
  });
}

function tinMantle(B) {
  const A = B.at, sx = A.shoulder.l[0];
  // a short hooded cape, drab wool, to the shoulder blades' foot, its hood lying at the back
  const cloth = cloak(B, {
    start: (x) => lerp([2.1, 0, 0], [1.0, 0, 0], smooth(0.7, 1.1, Math.abs(x)))[0],
    wide: (s) => lerp([0.82 * sx, 0, 0], [0.62 * sx, 0, 0], smooth(0.15, 0.55, s))[0],
    over: [tinChest(B)],
    off: () => 0.18, thick: 0.04,
    hang: A.spine2[1] - 0.2, rowsDown: 5, folds: 7, fold: 0.06,
    mat: (p, u, s) => (s > 0.92 || Math.abs(u) > 0.94 ? 'drabD' : 'drab'),
    rim: 'drabD',
  });
  // the hood down the back: a fold of the same wool, a glowing toggle at its point
  const head = onBone(B, 'spine_03');
  const back = cloth.V.reduce((b, p) => (Math.abs(p[0]) < 0.15 && p[2] < b[2] ? p : b), [0, 0, 9]);
  const hood = loft([ring(10, 0, 0.55, 0.22), ring(10, -0.35, 0.45, 0.2), ring(10, -0.7, 0.25, 0.14), ring(10, -0.85, 0.06, 0.06)],
    (c, i) => (i >= 2 ? 'rune' : 'drab'), { o: add(back, [0, 0.05, -0.12]), X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] }, head);
  return merge(cloth, hood);
}

/* ==== zinc: the sapper (the siege engineer) ======================================================================= */
const ZINC_MATS = {
  zn: { c: '#76858f', kind: 3 },
  znS: { c: '#48535b', kind: 3 },
  rivet: { c: '#c9d2d8', kind: 3 },
  rune: { c: '#5f8da0', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  lens: { c: '#3b5560', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  coat: { c: '#6b4a31', kind: 2 },
  coatD: { c: '#44301f', kind: 2 },
  canvas: { c: '#5c5a3c', kind: 2 },
  canvasD: { c: '#3f3e29', kind: 2 },
  canvasW: { c: '#5c5a3d', kind: 2 },
  oil: { c: '#2f4a4a', kind: 2 },
  oilD: { c: '#1f3333', kind: 2 },
  leatherD: { c: '#33241a', kind: 2 },
  sole: { c: '#241a14', kind: 2 },
};
/** The zinc panels sewn into the coat: a grid of plates, each riveted at its corners. */
const znPanel = (p, rows = 3.2, cols = 2.6) => { const u = frac(p[0] * cols + 0.5), v = frac(y(p) * rows); if (u < 0.08 || v < 0.08) return 'coatD'; if ((u < 0.18 || u > 0.9) && (v < 0.18 || v > 0.9)) return 'rivet'; return 'zn'; };

function zincChest(B) {
  const A = B.at, waist = waistOf(A);
  // the work coat: leather to the hips, zinc panels riveted over the chest and the back, a tool belt with a glowing buckle
  const panelled = (p) => y(p) > waist + 0.12 && y(p) < A.chest[1] + 0.5;
  const coat = torso(B, {
    from: waist - 0.55,
    off: (p) => 0.14 + (panelled(p) ? 0.06 : 0) + (Math.abs(y(p) - waist) < 0.1 ? 0.07 : 0) + 0.05 * smooth(waist, waist - 0.5, y(p)),
    mat: (p) => {
      if (Math.abs(y(p) - waist) < 0.1) { const a = frac((roundTorso(p) + Math.PI) / (2 * Math.PI) * 8); return p[2] > 0 && Math.abs(p[0]) < 0.12 ? 'rune' : a < 0.2 ? 'coatD' : 'leatherD'; }
      if (panelled(p)) return znPanel(p);
      return y(p) < waist - 0.45 ? 'coatD' : 'coat';
    },
    rim: 'coatD',
    caps: { off: () => 0.16, mat: () => 'coat' },
  });
  // zinc shoulder pads, the sleeves rolled to the elbow, heavy gauntlet cuffs
  const pads = shoulders(B, { off: () => 0.3, mat: (t) => (t > 0.28 ? 'znS' : frac(t * 8) < 0.12 ? 'rivet' : 'zn') });
  const sleeves = upperArms(B, { from: -0.35, to: 0.95, pit: B.who === 'male', inner: -0.3, innerZ: 0.2, thick: 0.02, off: (t, p, n) => (t < 0.45 && n[0] * Math.sign(p[0]) < -0.3 ? 0.03 : t > 0.8 ? 0.14 : 0.09), mat: (u) => (u.t > 0.8 ? 'coatD' : 'coat') });
  const cuffs = forearms(B, { from: 0.45, to: 0.93, off: (f) => 0.11 + 0.05 * smooth(0.45, 0.6, f.t), mat: (f) => (f.t > 0.86 ? 'rune' : frac(f.t * 6) < 0.12 ? 'znS' : 'leatherD') });
  return merge(coat, pads, sleeves, cuffs);
}

function zincLegs(B) {
  const A = B.at, waist = waistOf(A);
  const trousers = hips(B, { closed: true, top: waist + 0.05, foot: (s) => lerp(A.hip[s], A.knee[s], 1)[1], off: (p) => 0.11 + 0.08 * smooth(A.hip.l[1] - 0.4, A.knee.l[1], y(p)) + (p[2] > 0.1 && y(p) < Math.min(A.hip.l[1] + 0.3, waist - 0.75) ? 0.13 : 0), mat: (p) => (y(p) > waist - (B.who === 'female' ? 0.6 : 0.5) ? 'canvasW' : frac(y(p) * 1.3) < 0.07 ? 'canvasD' : 'canvas'), rim: (m) => (m === 'canvasW' ? 'canvasW' : 'canvasD') });
  const calves = shins(B, { from: 0.12, to: 0.9, round: 3.2, off: () => 0.07, mat: () => 'canvas', rim: 'canvasD' });
  // a zinc plate strapped over each thigh's front, and the knee: a glowing rivet line down each
  const plates = shell(B, {
    sub: 2,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; const g = legAt(B, p).thigh; return on(B, i, 'thigh') > 0.7 && g.t > 0.35 && g.t < 0.97 && B.N[i][2] > 0.35 && !(Math.abs(p[0]) < 0.32 && y(p) < A.hip[s][1] - 0.1); },
    off: () => 0.27,
    mat: ({ p }) => { const g = legAt(B, p).thigh; return Math.abs(g.a) < 0.08 ? 'rune' : g.t < 0.42 || g.t > 0.9 ? 'znS' : 'zn'; },
    rim: 'znS', thick: 0.05,
  });
  const knees = shins(B, { from: -0.12, to: 0.14, round: 1.3, off: (g) => 0.15 + 0.06 * Math.cos(g.a), mat: (g) => (Math.abs(g.a) > 1.1 ? 'znS' : 'zn'), rim: 'znS' });
  return { P: merge(trousers, calves, plates, knees), dropAt: (f) => f.mat === 'canvasW' };
}

function zincBoots(B) {
  const A = B.at;
  // heavy work boots: a zinc toe cap, two buckled straps up the shaft, a glowing band at the top
  return feet(B, {
    up: 0.85,
    off: (p, n, top) => { const s = p[0] >= 0 ? 'l' : 'r'; const strap = Math.abs(y(p) - (A.ankle[s][1] + 0.15)) < 0.07 || Math.abs(y(p) - (A.ankle[s][1] + 0.45)) < 0.07; return 0.02 + (p[2] > A.ball[s][2] + 0.1 ? 0.03 : 0) + (strap ? 0.03 : 0); },
    mat: (p, n, top) => {
      const s = p[0] >= 0 ? 'l' : 'r';
      if (y(p) > top - 0.1) return 'rune';
      if (Math.abs(y(p) - (A.ankle[s][1] + 0.15)) < 0.07 || Math.abs(y(p) - (A.ankle[s][1] + 0.45)) < 0.07) return Math.abs(p[0] - A.ankle[s][0]) > 0.25 && p[0] * (s === 'l' ? 1 : -1) > 0 ? 'rivet' : 'leatherD';
      return p[2] > A.ball[s][2] + 0.1 ? 'zn' : 'coat';
    },
    rim: 'leatherD',
  });
}

function zincHelm(B) {
  const browTh = browTheta(B);
  // a riveted zinc skullcap with a leather neck flap; goggles pushed up on the brow, their lenses glowing
  return helm(B, {
    rim: 'znS', down: 2.2,
    margin: ({ th, ph }) => { const s = fromFront(ph); const lens = th > browTh - 0.32 && th < browTh - 0.05 && Math.abs(s - 0.32) < 0.2 && s < 0.6; return 0.09 + (lens ? 0.12 : 0) + (Math.abs(th - (browTh - 0.18)) < 0.15 && s < 1.6 ? 0.04 : 0); },
    mat: (d, { th, ph }) => {
      const s = fromFront(ph);
      if (th > browTh && s < 0.95) return null;
      if (th > browTh - 0.32 && th < browTh - 0.05 && Math.abs(s - 0.32) < 0.2 && s < 0.6) return Math.abs(s - 0.32) < 0.13 && Math.abs(th - (browTh - 0.18)) < 0.09 ? 'lens' : 'znS';
      if (Math.abs(th - (browTh - 0.18)) < 0.15 && s < 1.6) return 'leatherD';
      if (th > browTh - 0.05) return th > 2.0 ? 'coatD' : 'coat';
      const rib = frac(ph / (Math.PI / 3));
      return rib < 0.05 ? 'rivet' : 'zn';
    },
  });
}

function zincMantle(B) {
  const A = B.at, sx = A.shoulder.l[0];
  // an oilskin capelet over the shoulders, to the chest's foot behind, a zinc buckle with a glowing stud
  const cloth = cloak(B, {
    start: (x) => lerp([2.1, 0, 0], [0.95, 0, 0], smooth(0.7, 1.1, Math.abs(x)))[0],
    wide: (s) => lerp([0.86 * sx, 0, 0], [0.64 * sx, 0, 0], smooth(0.15, 0.55, s))[0],
    over: [zincChest(B)],
    off: () => 0.17, thick: 0.04,
    hang: A.spine2[1] - 0.45, rowsDown: 6, folds: 8, fold: 0.05,
    mat: (p, u, s) => (s > 0.93 ? 'oilD' : frac(s * 7) < 0.06 ? 'oilD' : 'oil'),
    rim: 'oilD',
  });
  const at = cloth.V.filter((p) => p[0] < -0.95 && p[0] > -1.25).reduce((b, p) => (p[2] > b[2] ? p : b), [0, 0, -9]);
  const pin = disc(B, add(at, [0, 0.03, 0.02]), [0, 0.85, 0.5], [[0.2, 0, 'znS'], [0.2, 0.05, 'zn'], [0.1, 0.06, 'rune'], [0.05, 0.09, 'rivet']]);
  return merge(cloth, pin);
}

/* ==== lead: the Wall (the shield-line's front rank) ================================================================ */
const LEAD_MATS = {
  pb: { c: '#666b73', kind: 3 },
  pbS: { c: '#40444a', kind: 3 },
  pbL: { c: '#8c929a', kind: 3 },
  rune: { c: '#6b6f86', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  tabard: { c: '#5a1f1c', kind: 2 },
  tabardD: { c: '#3a1412', kind: 2 },
  tabardL: { c: '#b39a5a', kind: 2 },
  gam: { c: '#4b4038', kind: 2 },
  gamD: { c: '#302823', kind: 2 },
  gamW: { c: '#4b4039', kind: 2 },
  sole: { c: '#211915', kind: 2 },
};

function leadChest(B) {
  const A = B.at, waist = waistOf(A);
  // a slab of a cuirass, thick and square-fronted, three broad bands, a glowing line along each band's foot
  const band = (yy) => (A.chest[1] + 0.6 - yy) / ((A.chest[1] + 0.6 - (waist - 0.55)) / 3);
  const coat = torso(B, {
    from: waist - 0.55,
    // (thinner down the sides, where the arms pass)
    off: (p, n) => (0.24 + 0.05 * frac(band(y(p))) + (p[2] > 0 ? 0.05 * Math.max(0, 1 - Math.abs(p[0]) / 0.9) : 0)) * (1 - 0.45 * smooth(0.5, 0.85, Math.abs(n[0])) * smooth(waist - 0.2, A.chest[1] - 0.3, y(p))),
    mat: (p) => { const f = frac(band(y(p))); if (f > 0.93) return 'rune'; if (f > 0.85) return 'pbS'; return Math.abs(p[0]) < 0.05 && p[2] > 0 ? 'pbS' : 'pb'; },
    rim: 'pbS',
    caps: { off: () => 0.2, mat: () => 'pbS' },
  });
  // great round pauldrons, a raised rim
  const pauldrons = shoulders(B, { from: -0.35, to: 0.36, off: (t) => 0.34 + 0.03 * smooth(-0.35, 0.1, t) - 0.06 * smooth(0.15, 0.36, t), mat: (t) => (t > 0.29 ? 'pbL' : t < -0.3 ? 'pbS' : 'pb') });
  const arms = upperArms(B, { from: -0.35, to: 1.05, pit: B.who === 'male', inner: -0.3, innerZ: 0.2, thick: 0.02, off: (t, p, n) => (t < 0.45 && n[0] * Math.sign(p[0]) < -0.3 ? 0.03 : 0.13), mat: (u, p, n) => (n[0] * Math.sign(p[0]) < -0.3 ? 'gamD' : frac(u.t * 4) < 0.1 ? 'pbS' : 'pb') });
  const vamb = forearms(B, { from: -0.15, to: 0.93, elbow: true, off: (f) => 0.15 + (f.t < 0.12 ? 0.07 : 0), mat: (f) => (f.t > 0.86 ? 'rune' : f.t < 0.12 ? 'pbL' : frac(f.t * 4) < 0.1 ? 'pbS' : 'pb') });
  // a gorget up the neck, over the cuirass's collar
  const cut = A.neck[1] - 0.3;
  const neck = gorget(B, { top: (p, n) => (n[2] < -0.2 ? 9 : cut + 0.3), off: (p, n) => 0.38 - 0.24 * smooth(cut - 0.05, cut + 0.55, y(p)) - 0.2 * smooth(0.2, 0.7, n[2]) * smooth(cut - 0.2, cut + 0.1, y(p)), mat: (p) => (y(p) > cut + 0.45 ? 'pbS' : 'pb'), rim: 'pbS' });
  return merge(coat, pauldrons, arms, vamb, neck);
}

function leadLegs(B) {
  const A = B.at, waist = waistOf(A);
  const under = hips(B, { closed: true, top: waist + 0.25, foot: (s) => lerp(A.hip[s], A.knee[s], 1)[1], off: (p) => 0.11 + 0.08 * smooth(A.hip.l[1] - 0.4, A.knee.l[1], y(p)) + (p[2] > 0.1 && y(p) < Math.min(A.hip.l[1] + 0.3, waist - 0.75) ? 0.13 : 0), mat: (p) => (y(p) > waist - (B.who === 'female' ? 0.6 : 0.5) ? 'gamW' : 'gam'), rim: 'gamD' });
  // thick lead greaves closed round the shin, a heavy knee boss with a glowing ring
  const greaves = shins(B, {
    from: -0.2, to: 0.9, round: 3.2,
    off: (g, p) => (g.t < 0.12 ? (-g.a * Math.sign(p[0]) < -0.6 ? 0.16 : 0.26 + 0.06 * Math.cos(g.a)) : 0.17),
    mat: (g, p) => { if (g.t < 0.16 && -g.a * Math.sign(p[0]) < -0.8) return null; if (g.t < 0.12) return Math.abs(g.t) > 0.1 ? 'rune' : 'pbL'; if (g.t < 0.16) return 'pbS'; return frac(g.t * 3.5) < 0.08 ? 'pbS' : 'pb'; },
    rim: 'pbS',
  });
  return { P: merge(under, greaves), dropAt: (f) => f.mat === 'gamW' };
}

function leadBoots(B) {
  const A = B.at;
  // broad sabatons, square-toed, a glowing band at the ankle
  return feet(B, {
    up: 0.55,
    off: (p, n, top) => 0.06 + (n[1] < -0.3 ? 0 : 0.02),
    mat: (p, n, top) => (y(p) > top - 0.12 ? 'pbS' : y(p) > top - 0.22 ? 'rune' : n[1] < -0.3 ? 'gamD' : frac(p[2] * 3) < 0.1 ? 'pbS' : 'pb'),
    rim: 'pbS',
  });
}

function leadHelm(B) {
  const browTh = browTheta(B), c = headCentre(B), keep = headPts(B);
  let H = 0, R = 0;
  B.V.forEach((p, i) => { if (!keep(i)) return; const v = sub(p, c); H = Math.max(H, v[1]); R = Math.max(R, Math.hypot(v[0], v[2])); });
  H += 0.2; R += 0.14;
  // a great helm: flat-topped, its sides straight down to the shoulders, a cross slit before the eyes, breaths below
  return helm(B, {
    rim: 'pbS', down: 2.05,
    // (out to a cylinder round the head, its crown flat: the head's own reach up and out, measured, and a hand more)
    margin: ({ th, r }) => Math.max(0.12, Math.min(R / Math.max(0.05, Math.sin(th)), th < Math.PI / 2 ? H / Math.max(0.05, Math.cos(th)) : 9) - r),
    mat: (d, { th, ph }) => {
      const s = fromFront(ph);
      if (Math.abs(th - (browTh + 0.12)) < 0.045 && s < 0.7) return null;
      if (s < 0.04 && th > browTh && th < browTh + 0.45) return null;
      // (the slits' lips, darker, and a raised strip down the face between the breaths)
      if (Math.abs(th - (browTh + 0.12)) < 0.1 && s < 0.78) return 'pbS';
      if (s < 0.1 && th > browTh - 0.05 && th < browTh + 0.5) return 'pbS';
      if (s < 0.09 && th > browTh + 0.5) return 'pbL';
      if (th > browTh + 0.5 && th < browTh + 0.8 && s < 0.5 && frac(s * 10) < 0.35 && frac(th * 12) < 0.4) return 'pbS';
      if (Math.abs(th - (browTh - 0.12)) < 0.04) return 'rune';
      if (th < 0.35) return 'pbS';
      return s < 0.03 ? 'pbL' : 'pb';
    },
  });
}

function leadMantle(B) {
  const A = B.at, sx = A.shoulder.l[0];
  // a heavy tabard-cloak, dark red, a pale tower down its middle, to below the seat
  const cloth = cloak(B, {
    start: (x) => lerp([2.1, 0, 0], [1.15, 0, 0], smooth(0.7, 1.1, Math.abs(x)))[0],
    wide: (s) => lerp([0.84 * sx, 0, 0], [0.66 * sx, 0, 0], smooth(0.1, 0.5, s))[0],
    over: [leadChest(B)],
    off: () => 0.2, thick: 0.06,
    hang: lerp(A.spine1, A.pelvis, 0.9)[1], folds: 3, fold: 0.06,
    mat: (p, u, s) => (s > 0.95 || Math.abs(u) > 0.94 ? 'tabardD' : Math.abs(u) < 0.2 && s > 0.35 && s < 0.85 ? (s < 0.42 ? 'tabardL' : frac(s * 12) < 0.2 ? 'tabardD' : 'tabardL') : 'tabard'),
    rim: 'tabardD',
  });
  const at = cloth.V.filter((p) => p[0] < -0.95 && p[0] > -1.3).reduce((b, p) => (p[2] > b[2] ? p : b), [0, 0, -9]);
  const pin = disc(B, add(at, [0, 0.03, 0.02]), [0, 0.85, 0.5], [[0.24, 0, 'pbS'], [0.24, 0.06, 'pb'], [0.16, 0.07, 'rune'], [0.08, 0.1, 'pbL']]);
  return merge(cloth, pin);
}

/* ==== pewter: the pilgrim ========================================================================================== */
const PEWTER_MATS = {
  pw: { c: '#9b9b93', kind: 3 },
  pwS: { c: '#65655f', kind: 3 },
  rune: { c: '#7f8a80', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  felt: { c: '#4e3d2e', kind: 2 },
  feltD: { c: '#33281e', kind: 2 },
  wool: { c: '#6f6656', kind: 2 },
  woolD: { c: '#4a4438', kind: 2 },
  woolW: { c: '#6f6657', kind: 2 },
  cloak: { c: '#3e3a35', kind: 2 },
  cloakD: { c: '#27241f', kind: 2 },
  leather: { c: '#5b3e29', kind: 2 },
  leatherD: { c: '#38261b', kind: 2 },
  sole: { c: '#261c15', kind: 2 },
};
/** A pewter badge's place: a scallop shell's disc at `c`, radius r (its ribs fanned from its foot). */
const scallop = (p, c, r) => { const dx = p[0] - c[0], dy = y(p) - c[1], d = Math.hypot(dx, dy); if (d > r) return null; return d > r * 0.82 ? 'pwS' : frac((Math.atan2(dx, dy + r) + Math.PI) * 2.2) < 0.25 ? 'pwS' : 'pw'; };

function pewterChest(B) {
  const A = B.at, waist = waistOf(A);
  // a wool tunic to the hips, a leather scrip strap over the left shoulder, a pewter scallop on the breast with a glowing
  // ring round it, a rope girdle
  const strap = (p) => Math.abs(p[0] - (0.25 - (y(p) - A.chest[1]) * 0.75)) < 0.12 && y(p) > waist - 0.1;
  const badge = [-0.45, A.chest[1] + 0.25];
  const coat = torso(B, {
    from: waist - 0.6,
    off: (p) => 0.12 + (strap(p) ? 0.04 : 0) + (p[2] > 0 && Math.hypot(p[0] - badge[0], y(p) - badge[1]) < 0.24 ? 0.05 : 0) + 0.06 * smooth(waist, waist - 0.55, y(p)),
    mat: (p) => {
      if (p[2] > 0) { const sc = scallop(p, badge, 0.22); if (sc) return sc; if (Math.hypot(p[0] - badge[0], y(p) - badge[1]) < 0.27) return 'rune'; }
      if (strap(p)) return 'leather';
      if (Math.abs(y(p) - waist) < 0.06) return 'leatherD';
      return frac(p[0] * 3.5) < 0.06 ? 'woolD' : 'wool';
    },
    rim: 'woolD',
    caps: { off: () => 0.13, mat: () => 'wool' },
  });
  const sleeves = upperArms(B, { from: -0.35, to: 1.05, pit: B.who === 'male', inner: -0.3, innerZ: 0.2, thick: 0.02, off: (t, p, n) => (t < 0.45 && n[0] * Math.sign(p[0]) < -0.3 ? 0.03 : 0.09), mat: () => 'wool' });
  const cuffs = forearms(B, { from: -0.15, to: 0.93, elbow: true, off: (f) => 0.09 + (f.t > 0.8 ? 0.03 : 0), mat: (f) => (f.t > 0.86 ? 'pw' : f.t > 0.8 ? 'woolD' : 'wool') });
  return merge(coat, sleeves, cuffs);
}

function pewterLegs(B) {
  const A = B.at, waist = waistOf(A);
  const hose = hips(B, { closed: true, top: waist + 0.05, foot: (s) => lerp(A.hip[s], A.knee[s], 1)[1], off: (p) => 0.11 + 0.08 * smooth(A.hip.l[1] - 0.4, A.knee.l[1], y(p)) + (p[2] > 0.1 && y(p) < Math.min(A.hip.l[1] + 0.3, waist - 0.75) ? 0.13 : 0), mat: (p) => (y(p) > waist - (B.who === 'female' ? 0.75 : 0.5) ? 'woolW' : 'woolD'), rim: (m) => (m === 'woolW' ? 'woolW' : 'woolD') });
  // the hose below the knee, cross-tied, a pewter boss at each knee with a glowing rim
  const calves = shins(B, { from: -0.1, to: 0.9, round: 2.7, off: (g) => (g.t < 0.12 ? 0.13 + 0.05 * Math.cos(g.a) : 0.08), mat: (g, p) => { if (g.t < 0.12 && Math.abs(g.a) < 0.9) return g.t < -0.06 || g.t > 0.08 ? 'rune' : 'pw'; if (g.t < 0.2 && Math.abs(g.a) > 1.7) return null; return frac(g.t * 7 + g.a * 0.4) < 0.12 || frac(g.t * 7 - g.a * 0.4) < 0.12 ? 'leatherD' : 'woolD'; }, rim: 'woolD' });
  return { P: merge(hose, calves), dropAt: (f) => f.mat === 'woolW' };
}

function pewterBoots(B) {
  const A = B.at;
  // pilgrim's boots to the ankle's top, a pewter buckle on the outside, a glowing band at the top
  return feet(B, {
    up: 0.7,
    off: (p, n, top) => (y(p) > top - 0.15 ? 0.03 : 0),
    mat: (p, n, top) => {
      const s = p[0] >= 0 ? 'l' : 'r';
      if (y(p) > top - 0.15) return y(p) > top - 0.06 ? 'leatherD' : 'rune';
      if (Math.abs(y(p) - (A.ankle[s][1] + 0.1)) < 0.08) return (p[0] - A.ankle[s][0]) * (s === 'l' ? 1 : -1) > 0.2 ? 'pw' : 'leatherD';
      return 'leather';
    },
    rim: 'leatherD',
  });
}

function pewterHelm(B) {
  const browTh = browTheta(B);
  // the pilgrim's hat: a round felt crown and a broad brim turned up at the front, a pewter scallop on the turn-up
  return helm(B, {
    rim: 'feltD', down: browTh + 0.18,
    margin: ({ th, ph }) => { const s = fromFront(ph); const brim = 0.75 * smooth(browTh - 0.2, browTh + 0.1, th); return 0.13 + brim * (s < 0.8 ? 0.55 + 0.45 * (s / 0.8) : 1) + (s < 0.8 && th > browTh - 0.2 ? -0.2 * smooth(browTh - 0.1, browTh + 0.18, th) * (1 - s / 0.8) : 0); },
    mat: (d, { th, ph }) => {
      const s = fromFront(ph);
      if (th > browTh - 0.2 && s < 0.35 && th < browTh + 0.05) return Math.abs(s) < 0.2 && th > browTh - 0.15 ? 'pw' : 'rune';
      if (Math.abs(th - (browTh - 0.26)) < 0.04) return 'leatherD';
      return th > browTh - 0.2 ? 'feltD' : 'felt';
    },
  });
}

function pewterMantle(B) {
  const A = B.at, sx = A.shoulder.l[0];
  // the long pilgrim's cloak, dark wool, its hood lying down the back; a pewter clasp on the right shoulder
  const cloth = cloak(B, {
    start: (x) => lerp([2.2, 0, 0], [1.15, 0, 0], smooth(0.75, 1.1, Math.abs(x)))[0],
    wide: (s) => lerp([0.82 * sx, 0, 0], [0.68 * sx, 0, 0], smooth(0.1, 0.5, s))[0],
    over: [pewterChest(B)],
    off: () => 0.18, thick: 0.05,
    hang: lerp(A.spine1, A.pelvis, 0.95)[1], folds: 6, fold: 0.13,
    mat: (p, u, s) => (s > 0.96 ? 'cloakD' : 'cloak'),
    rim: 'cloakD',
  });
  const head = onBone(B, 'spine_03');
  const back = cloth.V.reduce((b, p) => (Math.abs(p[0]) < 0.15 && p[2] < b[2] && y(p) > A.chest[1] ? p : b), [0, 0, 9]);
  const hood = loft([ring(10, 0, 0.5, 0.2), ring(10, -0.3, 0.42, 0.18), ring(10, -0.62, 0.22, 0.12), ring(10, -0.75, 0.05, 0.05)], (c, i) => (i >= 2 ? 'cloakD' : 'cloak'), { o: add(back, [0, 0.05, -0.1]), X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] }, head);
  const at = cloth.V.filter((p) => p[0] < -0.95 && p[0] > -1.25).reduce((b, p) => (p[2] > b[2] ? p : b), [0, 0, -9]);
  const pin = disc(B, add(at, [0, 0.03, 0.02]), [0, 0.85, 0.5], [[0.18, 0, 'pwS'], [0.18, 0.05, 'pw'], [0.12, 0.06, 'rune'], [0.07, 0.08, 'pw']]);
  return merge(cloth, hood, pin);
}

/* ==== brass: the clockwork artificer ============================================================================== */
const BRASS_MATS = {
  br: { c: '#9c7a36', kind: 3 },
  brS: { c: '#5a4419', kind: 3 },
  cu: { c: '#9a5a32', kind: 3 },
  rune: { c: '#7d6a40', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  lens: { c: '#3d4b52', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  coat: { c: '#4a2f24', kind: 2 },
  coatD: { c: '#2e1d17', kind: 2 },
  coatW: { c: '#4a2f25', kind: 2 },
  sole: { c: '#221813', kind: 2 },
};
/** A gear's face at `c` (x, y) of radius r: its teeth round the rim, spokes inside, a glowing hub. */
const gear = (p, c, r, teeth = 10) => {
  const dx = p[0] - c[0], dy = y(p) - c[1], d = Math.hypot(dx, dy), a = Math.atan2(dx, dy);
  if (d > r * 1.15) return null;
  if (d > r) return frac(a / (2 * Math.PI) * teeth) < 0.5 ? 'br' : null;
  if (d < r * 0.25) return 'rune';
  if (d > r * 0.8) return 'br';
  return frac(a / (2 * Math.PI) * 5) < 0.25 ? 'br' : 'brS';
};

function brassChest(B) {
  const A = B.at, waist = waistOf(A);
  // a cuirass of overlapping brass segments, copper rivet lines, a great gear on the breast with a glowing hub
  const G = [0, A.chest[1] + 0.15];
  const coat = torso(B, {
    from: waist - 0.5,
    off: (p) => 0.18 + 0.04 * frac((A.chest[1] + 0.7 - y(p)) / 0.36) + (p[2] > 0 && gear(p, G, 0.42) ? 0.06 : 0),
    mat: (p) => {
      if (p[2] > 0) { const g = gear(p, G, 0.42); if (g) return g; }
      const f = frac((A.chest[1] + 0.7 - y(p)) / 0.36);
      if (f > 0.86) return 'brS';
      if (f < 0.1 && frac(roundTorso(p) * 2.5) < 0.2) return 'cu';
      return 'br';
    },
    rim: 'brS',
    caps: { off: () => 0.16, mat: () => 'coat' },
  });
  // shoulder cops of nested brass rings; leather sleeves with brass bands; vambraces with a glowing dial at the wrist
  const cops = shoulders(B, { off: (t) => 0.3 + 0.03 * frac((t + 0.3) / 0.12), mat: (t) => (frac((t + 0.3) / 0.12) > 0.8 ? 'brS' : 'br') });
  const sleeves = upperArms(B, { from: -0.35, to: 1.05, pit: B.who === 'male', inner: -0.3, innerZ: 0.2, thick: 0.02, off: (t, p, n) => (t < 0.45 && n[0] * Math.sign(p[0]) < -0.3 ? 0.03 : 0.09 + (frac(t * 4) < 0.15 ? 0.03 : 0)), mat: (u) => (frac(u.t * 4) < 0.15 ? 'br' : 'coat') });
  const vamb = forearms(B, { from: -0.15, to: 0.93, elbow: true, off: (f) => 0.12 + (f.t < 0.12 ? 0.06 : 0), mat: (f) => (f.t > 0.84 ? (Math.abs(f.a) < 0.6 ? 'lens' : 'brS') : f.t < 0.12 ? 'cu' : frac(f.t * 5) < 0.12 ? 'brS' : 'br') });
  return merge(coat, cops, sleeves, vamb);
}

function brassLegs(B) {
  const A = B.at, waist = waistOf(A);
  const under = hips(B, { closed: true, top: waist + 0.25, foot: (s) => lerp(A.hip[s], A.knee[s], 1)[1], off: (p) => 0.11 + 0.08 * smooth(A.hip.l[1] - 0.4, A.knee.l[1], y(p)) + (p[2] > 0.1 && y(p) < Math.min(A.hip.l[1] + 0.3, waist - 0.75) ? 0.13 : 0), mat: (p) => (y(p) > waist - (B.who === 'female' ? 0.6 : 0.5) ? 'coatW' : frac(y(p) * 1.5) < 0.08 ? 'coatD' : 'coat'), rim: 'coatD' });
  // the knee: a brass joint, a gear on its outside with a glowing hub; brass splints down the shin
  const knees = shins(B, {
    from: -0.18, to: 0.88, round: 2.4,
    off: (g, p) => (g.t < 0.12 ? (-g.a * Math.sign(p[0]) < -0.6 ? 0.14 : 0.2) : 0.13),
    mat: (g, p) => { if (g.t < 0.16 && -g.a * Math.sign(p[0]) < -0.8) return null; if (g.t < 0.12) { const out = -g.a * Math.sign(p[0]); return out > 0.9 && out < 1.6 && Math.abs(g.t) < 0.07 ? 'rune' : 'br'; } if (frac((g.a + 2.4) / 4.8 * 5) < 0.12) return 'cu'; return 'br'; },
    rim: 'brS',
  });
  return { P: merge(under, knees), dropAt: (f) => f.mat === 'coatW' };
}

function brassBoots(B) {
  const A = B.at;
  // leather boots plated in brass over the foot, a gear at the ankle's outside with a glowing hub
  return feet(B, {
    up: 0.75,
    off: (p, n, top) => (n[1] < -0.3 ? 0 : 0.03),
    mat: (p, n, top) => {
      const s = p[0] >= 0 ? 'l' : 'r', out = (p[0] - A.ankle[s][0]) * (s === 'l' ? 1 : -1);
      if (out > 0.2 && Math.abs(y(p) - A.ankle[s][1]) < 0.18 && Math.abs(p[2] - A.ankle[s][2]) < 0.18) return Math.hypot(y(p) - A.ankle[s][1], p[2] - A.ankle[s][2]) < 0.07 ? 'rune' : 'cu';
      if (y(p) > top - 0.12) return 'brS';
      return p[2] > A.ankle[s][2] + 0.1 ? 'br' : 'coat';
    },
    rim: 'brS',
  });
}

function brassHelm(B) {
  const browTh = browTheta(B);
  // a domed brass helm, closed, a round glowing lens before each eye, copper ribs, a ridge of rivets
  return helm(B, {
    rim: 'brS', down: 2.05,
    margin: ({ th, ph }) => { const s = fromFront(ph); return 0.12 + 0.1 * Math.max(0, 1 - th / 0.9) + (Math.hypot(th - (browTh + 0.15), Math.abs(s) - 0.3) < 0.14 ? 0.07 : 0); },
    mat: (d, { th, ph }) => {
      const s = fromFront(ph), e = Math.hypot(th - (browTh + 0.15), s - 0.3);
      if (s < 0.6 && e < 0.1) return 'lens';
      if (s < 0.6 && e < 0.14) return 'cu';
      if (th > browTh + 0.45 && s < 0.4 && frac(th * 14) < 0.4 && frac(s * 10) < 0.35) return 'brS';
      if (frac(ph / (Math.PI / 4)) < 0.05 && th < browTh) return 'cu';
      return th > 2.0 ? 'brS' : 'br';
    },
  });
}

function brassMantle(B) {
  const A = B.at, sx = A.shoulder.l[0];
  // a leather coat-tail cape, split at the back, brass-edged; a gear clasp on the right shoulder
  const cloth = cloak(B, {
    start: (x) => lerp([2.1, 0, 0], [1.15, 0, 0], smooth(0.7, 1.1, Math.abs(x)))[0],
    wide: (s) => lerp([0.88 * sx, 0, 0], [0.7 * sx, 0, 0], smooth(0.1, 0.55, s))[0],
    over: [brassChest(B)],
    off: () => 0.18, thick: 0.05,
    hang: lerp(A.spine1, A.pelvis, 0.9)[1], folds: 4, fold: 0.08,
    mat: (p, u, s) => (s > 0.7 && Math.abs(u) < 0.05 ? null : s > 0.95 || Math.abs(u) > 0.94 ? 'br' : 'coat'),
    rim: 'coatD',
  });
  const at = cloth.V.filter((p) => p[0] < -0.95 && p[0] > -1.25).reduce((b, p) => (p[2] > b[2] ? p : b), [0, 0, -9]);
  const pin = disc(B, add(at, [0, 0.03, 0.02]), [0, 0.85, 0.5], [[0.24, 0, 'brS'], [0.24, 0.05, 'br'], [0.18, 0.05, 'brS'], [0.12, 0.06, 'rune'], [0.06, 0.09, 'cu']]);
  return merge(cloth, pin);
}

/* ==== gold: the royal guard ======================================================================================== */
const GOLD_MATS = {
  au: { c: '#d0a43a', kind: 3 },
  auS: { c: '#86651b', kind: 3 },
  rune: { c: '#a3803a', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  red: { c: '#9b1f23', kind: 2 },
  redD: { c: '#651417', kind: 2 },
  redW: { c: '#9b1f24', kind: 2 },
  white: { c: '#e6e0d4', kind: 2 },
  whiteD: { c: '#b9b2a4', kind: 2 },
  ermine: { c: '#1f1b1a', kind: 2 },
  sole: { c: '#2a1f18', kind: 2 },
};

function goldChest(B) {
  const A = B.at, waist = waistOf(A);
  // a fluted gold breastplate over a red velvet doublet; a glowing line round the breastplate's neck and foot
  const plate = (p) => p[2] > -0.05 && y(p) > waist - 0.05 && y(p) < A.chest[1] + 0.62;
  const coat = torso(B, {
    from: waist - 0.5,
    off: (p) => 0.13 + (plate(p) ? 0.1 + 0.02 * Math.cos(p[0] * 14) : 0) + 0.05 * smooth(waist, waist - 0.45, y(p)),
    mat: (p) => {
      if (plate(p)) { if (y(p) < waist + 0.07 || y(p) > A.chest[1] + 0.54) return 'rune'; return Math.cos(p[0] * 14) < -0.7 ? 'auS' : 'au'; }
      return y(p) < waist - 0.42 ? 'au' : frac(y(p) * 2.5) < 0.06 ? 'redD' : 'red';
    },
    rim: 'auS',
    caps: { off: () => 0.17, mat: () => 'red' },
  });
  // puffed sleeves slashed red over white, gold bands at the shoulder and the elbow; gold cuffs
  const sleeves = upperArms(B, { from: -0.35, to: 1.05, pit: B.who === 'male', inner: -0.3, innerZ: 0.2, thick: 0.02, off: (t, p, n) => (t < 0.45 && n[0] * Math.sign(p[0]) < -0.3 ? 0.03 : 0.1 + 0.06 * Math.sin(Math.PI * clamp(t)) ), mat: (u) => (u.t < 0.05 || u.t > 0.92 ? 'au' : frac(u.a * 1.3) < 0.3 ? 'white' : 'red') });
  const cuffs = forearms(B, { from: -0.15, to: 0.93, elbow: true, off: (f) => 0.1 + (f.t > 0.78 ? 0.04 : 0), mat: (f) => (f.t > 0.86 ? 'rune' : f.t > 0.78 ? 'au' : 'red') });
  return merge(coat, sleeves, cuffs);
}

function goldLegs(B) {
  const A = B.at, waist = waistOf(A);
  // hose striped red and white, gold knee cops with a glowing rim
  const hose = hips(B, { closed: true, top: waist + 0.05, foot: (s) => lerp(A.hip[s], A.knee[s], 1)[1], off: (p) => 0.11 + 0.08 * smooth(A.hip.l[1] - 0.4, A.knee.l[1], y(p)) + (p[2] > 0.1 && y(p) < Math.min(A.hip.l[1] + 0.3, waist - 0.75) ? 0.13 : 0), mat: (p) => (y(p) > waist - (B.who === 'female' ? 0.6 : 0.5) ? 'redW' : frac(roundTorso(p) / (2 * Math.PI) * 10 + (p[0] > 0 ? 0.5 : 0)) < 0.5 ? 'red' : 'white'), rim: (m) => (m === 'redW' ? 'redW' : 'redD') });
  const calves = shins(B, { from: 0.12, to: 0.9, round: 3.2, off: () => 0.07, mat: (g) => (frac(g.a / (2 * Math.PI) * 8) < 0.5 ? 'red' : 'white'), rim: 'redD' });
  const cops = shins(B, { from: -0.18, to: 0.16, round: 1.4, off: (g) => 0.16 + 0.07 * Math.cos(g.a) * (1 - Math.abs(g.t) * 4), mat: (g) => (g.t < -0.13 || g.t > 0.12 ? 'rune' : Math.abs(g.a) > 1.2 ? 'auS' : 'au'), rim: 'auS' });
  return { P: merge(hose, calves, cops), dropAt: (f) => f.mat === 'redW' };
}

function goldBoots(B) {
  const A = B.at;
  // white leather boots to the calf, a gold cuff over a glowing band, a gold toe
  return feet(B, {
    up: 0.95,
    off: (p, n, top) => (y(p) > top - 0.18 ? 0.05 : 0),
    mat: (p, n, top) => {
      const s = p[0] >= 0 ? 'l' : 'r';
      if (y(p) > top - 0.18) return 'au';
      if (y(p) > top - 0.27) return 'rune';
      if (p[2] > A.ball[s][2] + 0.25) return 'au';
      return 'white';
    },
    rim: 'whiteD',
  });
}

function goldHelm(B) {
  const browTh = browTheta(B);
  // a gilded burgonet: a high comb front to back, a peak over the eyes, cheek pieces, a white plume from its crown
  const P = helm(B, {
    rim: 'auS', down: 2.2,
    margin: ({ th, ph }) => { const s = fromFront(ph), mid = Math.min(s, Math.PI - s); return 0.11 + (th < 1.3 && mid < 0.1 ? 0.28 * (1 - mid / 0.1) * Math.min(1, (1.3 - th) / 0.4) : 0) + (Math.abs(th - browTh + 0.02) < 0.12 && s < 0.9 ? 0.18 * smooth(browTh - 0.14, browTh + 0.1, th) : 0); },
    mat: (d, { th, ph }) => {
      const s = fromFront(ph), mid = Math.min(s, Math.PI - s);
      if (th > browTh + 0.1 && s < 0.85) return null;
      if (th < 1.3 && mid < 0.1) return 'auS';
      if (Math.abs(th - (browTh - 0.12)) < 0.04) return 'rune';
      return frac(ph / (Math.PI / 6)) < 0.04 ? 'auS' : 'au';
    },
  });
  const head = onBone(B, 'head');
  const top = P.V.reduce((b, p) => (p[1] > b[1] ? p : b), [0, -99, 0]);
  const plume = [];
  for (let k = 0; k < 5; k++) {
    const sx = (k - 2) * 0.07, base = add(top, [sx, 0.05, -0.1]), long = 1 - Math.abs(k - 2) * 0.12;
    const path = [[0, 0, 0], [0, 0.35, -0.15], [0, 0.45, -0.55], [0, 0.2, -0.95], [0, -0.25, -1.15]].map((q) => [q[0] + sx * (q[2] < 0 ? -q[2] : 0), q[1] * long, q[2] * long]);
    const rings = path.map((q, j) => { const w = 0.12 * (1 - j / 5) + 0.04; return [add(q, [-w, 0, 0]), add(q, [0, w * 0.8, 0]), add(q, [w, 0, 0]), add(q, [0, -w * 0.5, 0])]; });
    plume.push(loft(rings, (cc, i) => (i >= 3 ? 'whiteD' : 'white'), { o: base, X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] }, head));
  }
  return merge(P, ...plume);
}

function goldMantle(B) {
  const A = B.at, sx = A.shoulder.l[0];
  // the royal cape: red, an ermine collar over the shoulders, gold-edged; a gold clasp with a glowing stone
  const cloth = cloak(B, {
    start: (x) => lerp([2.1, 0, 0], [1.15, 0, 0], smooth(0.7, 1.1, Math.abs(x)))[0],
    wide: (s) => lerp([0.84 * sx, 0, 0], [0.68 * sx, 0, 0], smooth(0.1, 0.5, s))[0],
    over: [goldChest(B)],
    off: () => 0.2, thick: 0.05,
    hang: lerp(A.spine1, A.pelvis, 0.95)[1], folds: 6, fold: 0.13,
    mat: (p, u, s) => { if (s < 0.3) return frac(u * 7 + s * 13) < 0.08 && frac(s * 11) < 0.3 ? 'ermine' : 'white'; if (s > 0.96 || Math.abs(u) > 0.95) return 'au'; return 'red'; },
    rim: 'redD',
  });
  const at = cloth.V.filter((p) => p[0] < -0.95 && p[0] > -1.25).reduce((b, p) => (p[2] > b[2] ? p : b), [0, 0, -9]);
  const pin = disc(B, add(at, [0, 0.03, 0.02]), [0, 0.85, 0.5], [[0.22, 0, 'auS'], [0.22, 0.05, 'au'], [0.14, 0.06, 'rune'], [0.09, 0.1, 'au']]);
  return merge(cloth, pin);
}

/* ==== electrum: the Immortal (the Achaemenid guard) ================================================================ */
const ELECTRUM_MATS = {
  el: { c: '#c5bd93', kind: 3 },
  elS: { c: '#7e774f', kind: 3 },
  rune: { c: '#8f8a6a', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  blue: { c: '#2f4f86', kind: 2 },
  blueD: { c: '#1f355c', kind: 2 },
  saffron: { c: '#d09a35', kind: 2 },
  purple: { c: '#5b2c5e', kind: 2 },
  purpleD: { c: '#3b1c3d', kind: 2 },
  purpleW: { c: '#5b2c5f', kind: 2 },
  cloth: { c: '#e2d9bf', kind: 2 },
  clothD: { c: '#b3a98c', kind: 2 },
  tan: { c: '#b58a4f', kind: 2 },
  tanD: { c: '#7a5a32', kind: 2 },
  sole: { c: '#2b2018', kind: 2 },
};
/** A coat of scales: rows of rounded scales, each row half a scale over from the one above, the edge of each darker. */
const scales = (p, a = 'el', b = 'elS', k = 6.5) => { const row = Math.floor(y(p) * k), u = frac(p[0] * k * 0.9 + (row % 2) * 0.5 + p[2] * 2), v = frac(y(p) * k); return v < 0.18 || Math.hypot(u - 0.5, v - 0.2) > 0.62 ? b : a; };

function electrumChest(B) {
  const A = B.at, waist = waistOf(A);
  // a scale corselet to the hips over a blue tunic, a saffron band at its foot with a glowing line
  const coat = torso(B, {
    from: waist - 0.6,
    off: (p) => 0.15 + 0.06 * smooth(waist, waist - 0.55, y(p)),
    mat: (p) => {
      if (y(p) < waist - 0.45) return y(p) < waist - 0.52 ? 'saffron' : 'rune';
      if (y(p) < waist - 0.05) return frac(p[0] * 4) < 0.5 ? 'blue' : 'blueD';
      return scales(p);
    },
    rim: 'elS',
    caps: { off: () => 0.16, mat: (p) => scales(p) },
  });
  // the tunic's long sleeves, blue with saffron bands, electrum cuffs with a glowing line
  const sleeves = upperArms(B, { from: -0.35, to: 1.05, pit: B.who === 'male', inner: -0.3, innerZ: 0.2, thick: 0.02, off: (t, p, n) => (t < 0.45 && n[0] * Math.sign(p[0]) < -0.3 ? 0.03 : 0.1), mat: (u) => (frac(u.t * 4) < 0.12 ? 'saffron' : 'blue') });
  const cuffs = forearms(B, { from: -0.15, to: 0.93, elbow: true, off: (f) => 0.1 + (f.t > 0.75 ? 0.03 : 0), mat: (f) => (f.t > 0.75 ? (Math.abs(f.t - 0.84) < 0.03 ? 'rune' : 'el') : frac(f.t * 4) < 0.12 ? 'saffron' : 'blue') });
  return merge(coat, sleeves, cuffs);
}

function electrumLegs(B) {
  const A = B.at, waist = waistOf(A);
  // trousers in purple, a lozenge pattern down them; electrum scales over the knees with a glowing line
  const trousers = hips(B, { closed: true, top: waist + 0.05, foot: (s) => lerp(A.hip[s], A.knee[s], 1)[1], off: (p) => 0.11 + 0.08 * smooth(A.hip.l[1] - 0.4, A.knee.l[1], y(p)) + (p[2] > 0.1 && y(p) < Math.min(A.hip.l[1] + 0.3, waist - 0.75) ? 0.13 : 0), mat: (p) => (y(p) > waist - (B.who === 'female' ? 0.6 : 0.5) ? 'purpleW' : (frac((p[0] + y(p)) * 2.5) < 0.05 || frac((p[0] - y(p)) * 2.5) < 0.05) ? 'saffron' : 'purple'), rim: (m) => (m === 'purpleW' ? 'purpleW' : 'purpleD') });
  const calves = shins(B, { from: 0.12, to: 0.88, round: 3.2, off: () => 0.07, mat: () => 'purple', rim: 'purpleD' });
  const knees = shins(B, { from: -0.16, to: 0.2, round: 1.5, off: () => 0.14, mat: (g, p) => (g.t < -0.1 ? 'rune' : scales(p)), rim: 'elS' });
  return { P: merge(trousers, calves, knees), dropAt: (f) => f.mat === 'purpleW' };
}

function electrumBoots(B) {
  const A = B.at;
  // soft tan shoes, laced across the instep, an electrum toe, a glowing band at the ankle
  return feet(B, {
    up: 0.55,
    off: (p, n, top) => 0.0,
    mat: (p, n, top) => {
      const s = p[0] >= 0 ? 'l' : 'r';
      if (y(p) > top - 0.1) return 'rune';
      if (p[2] > A.ball[s][2] + 0.25) return 'el';
      if (frac((p[2] - A.ankle[s][2]) * 4) < 0.15 && y(p) > A.floor + 0.2) return 'tanD';
      return 'tan';
    },
    rim: 'tanD',
  });
}

function electrumHelm(B) {
  const browTh = browTheta(B);
  // the tiara: a soft felt cap rising to a rounded crown, its cloth wound down round the cheeks and the chin, an electrum
  // band at the brow with a glowing line
  return helm(B, {
    rim: 'clothD', down: 2.2,
    margin: ({ th }) => 0.13 + 0.3 * Math.max(0, 1 - th / 0.9),
    mat: (d, { th, ph }) => {
      const s = fromFront(ph);
      if (th > browTh && s < 0.75 && th < browTh + 0.62) return null;
      if (th > browTh - 0.18 && th < browTh) return Math.abs(th - (browTh - 0.09)) < 0.055 ? 'rune' : 'el';
      return frac(ph * 3 / Math.PI + th * 2) < 0.1 ? 'clothD' : 'cloth';
    },
  });
}

function electrumMantle(B) {
  const A = B.at, sx = A.shoulder.l[0];
  // the kandys: a long purple coat worn over the shoulders, its sleeves empty, a saffron border of rosettes; an
  // electrum clasp
  const cloth = cloak(B, {
    start: (x) => lerp([2.1, 0, 0], [1.0, 0, 0], smooth(0.7, 1.1, Math.abs(x)))[0],
    wide: (s) => lerp([0.84 * sx, 0, 0], [0.7 * sx, 0, 0], smooth(0.1, 0.5, s))[0],
    over: [electrumChest(B)],
    off: () => 0.19, thick: 0.05,
    hang: lerp(A.spine1, A.pelvis, 1.0)[1], folds: 7, fold: 0.12,
    mat: (p, u, s) => (s > 0.9 || Math.abs(u) > 0.88 ? (frac(u * 9 + s * 9) < 0.3 ? 'saffron' : 'purpleD') : 'purple'),
    rim: 'purpleD',
  });
  const at = cloth.V.filter((p) => p[0] < -0.95 && p[0] > -1.25).reduce((b, p) => (p[2] > b[2] ? p : b), [0, 0, -9]);
  const pin = disc(B, add(at, [0, 0.03, 0.02]), [0, 0.85, 0.5], [[0.2, 0, 'elS'], [0.2, 0.05, 'el'], [0.13, 0.06, 'rune'], [0.07, 0.09, 'el']]);
  return merge(cloth, pin);
}

/* ==== fire-tempered steel: the ember knight ======================================================================== */
const FIRESTEEL_MATS = {
  fs: { c: '#3d3735', kind: 3 },
  fsS: { c: '#221e1d', kind: 3 },
  fsL: { c: '#5c5250', kind: 3 },
  vein: { c: '#7a2b12', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  rune: { c: '#8a3a17', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  smoke: { c: '#3a3433', kind: 2 },
  smokeD: { c: '#221d1c', kind: 2 },
  ash: { c: '#5a2a1a', kind: 2 },
  ashD: { c: '#3c1c12', kind: 2 },
  ashW: { c: '#5a2a1b', kind: 2 },
  sole: { c: '#1d1715', kind: 2 },
};
/** The fire still in the steel: veins wandering over the plate, as cooled cracks. */
const veins = (p) => { const h = Math.sin(p[0] * 9.3 + Math.sin(y(p) * 4.1) * 1.8) + Math.sin(y(p) * 7.7 + p[2] * 5.3 + Math.cos(p[0] * 3.1)); return Math.abs(h) < 0.09; };

function firesteelChest(B) {
  const A = B.at, waist = waistOf(A);
  // gothic plate, blackened, fluted, its fire showing in veins; a pointed plackart; faulds below the waist
  const coat = torso(B, {
    from: waist - 0.55,
    off: (p) => 0.18 + (p[2] > 0 ? 0.04 * Math.max(0, 1 - Math.abs(p[0]) / 0.3) : 0) + 0.02 * Math.cos(p[0] * 11) + (y(p) <= waist - 0.05 ? 0.06 + 0.03 * frac((waist - 0.05 - y(p)) / 0.17) : 0),
    mat: (p) => { if (veins(p)) return 'vein'; if (y(p) <= waist - 0.05) return frac((waist - 0.05 - y(p)) / 0.17) > 0.82 ? 'fsS' : 'fs'; if (p[2] > 0 && Math.abs(Math.abs(p[0]) - (A.chest[1] - y(p)) * 0.5) < 0.04 && y(p) < A.chest[1]) return 'rune'; return Math.cos(p[0] * 11) < -0.8 ? 'fsS' : 'fs'; },
    rim: 'fsS',
    caps: { off: () => 0.14, mat: () => 'fsS' },
  });
  // swept, spiked pauldrons; rerebraces; couters; gauntlet cuffs, all veined
  const pauldrons = shoulders(B, { from: -0.35, to: 0.36, off: (t) => 0.32 + 0.04 * frac((t + 0.35) / 0.18), mat: (t, p) => (veins(p) ? 'vein' : frac((t + 0.35) / 0.18) > 0.82 ? 'fsS' : 'fsL') });
  const rere = upperArms(B, { from: -0.35, to: 0.85, pit: B.who === 'male', inner: -0.3, innerZ: 0.2, thick: 0.02, off: (t, p, n) => (t < 0.45 && n[0] * Math.sign(p[0]) < -0.3 ? 0.03 : 0.12), mat: (u, p) => (veins(p) ? 'vein' : frac(u.t * 5) < 0.12 ? 'fsS' : 'fs') });
  const vamb = forearms(B, { from: -0.15, to: 0.93, elbow: true, off: (f) => 0.12 + (f.t < 0.15 ? 0.08 * Math.max(0, 1 - Math.abs(f.t) / 0.15) : 0) + (f.t > 0.82 ? 0.05 : 0), mat: (f, p) => (f.t > 0.82 ? (f.t > 0.88 ? 'fsS' : 'rune') : veins(p) ? 'vein' : 'fs') });
  return merge(coat, pauldrons, rere, vamb);
}

function firesteelLegs(B) {
  const A = B.at, waist = waistOf(A);
  const hose = hips(B, { closed: true, top: waist + 0.05, foot: (s) => lerp(A.hip[s], A.knee[s], 1)[1], off: (p) => 0.11 + 0.08 * smooth(A.hip.l[1] - 0.4, A.knee.l[1], y(p)) + (p[2] > 0.1 && y(p) < Math.min(A.hip.l[1] + 0.3, waist - 0.75) ? 0.13 : 0), mat: (p) => (y(p) > waist - (B.who === 'female' ? 0.6 : 0.5) ? 'ashW' : 'ash'), rim: (m) => (m === 'ashW' ? 'ashW' : 'ashD') });
  const cuisse = shell(B, {
    sub: 2,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; const g = legAt(B, p).thigh; return on(B, i, 'thigh') > 0.6 && g.t > 0.2 && g.t < 0.95 && dot(B.N[i], [Math.sign(p[0]) * 0.6, 0, 0.8]) > -0.1 && !(Math.abs(p[0]) < 0.32 && y(p) < A.hip[s][1] - 0.1); },
    off: ({ p }) => 0.24 + 0.03 * smooth(0.6, 0.95, legAt(B, p).thigh.t),
    mat: ({ p }) => (veins(p) ? 'vein' : 'fs'),
    rim: 'fsS', thick: 0.05,
  });
  const greaves = shins(B, {
    from: -0.2, to: 0.9, round: 3.0,
    off: (g, p) => (g.t < 0.12 ? (-g.a * Math.sign(p[0]) < -0.6 ? 0.15 : 0.22 + 0.06 * Math.cos(g.a)) + (-g.a * Math.sign(p[0]) > 0.9 && g.t < 0.06 ? 0.1 : 0) : 0.14),
    mat: (g, p) => { if (g.t < 0.16 && -g.a * Math.sign(p[0]) < -0.8) return null; if (g.t < 0.12) return Math.abs(g.t) > 0.1 ? 'rune' : 'fsL'; if (veins(p)) return 'vein'; return Math.abs(g.a) < 0.04 ? 'fsS' : 'fs'; },
    rim: 'fsS',
  });
  return { P: merge(hose, cuisse, greaves), dropAt: (f) => f.mat === 'ashW' };
}

function firesteelBoots(B) {
  const A = B.at;
  // pointed gothic sabatons, lamed, a glowing band at the ankle
  return feet(B, {
    up: 0.6,
    off: (p, n, top) => { const s = p[0] >= 0 ? 'l' : 'r'; return 0.05 + 0.02 * frac((p[2] - A.ankle[s][2]) * 3.5) + 0.12 * smooth(A.ball[s][2], A.ball[s][2] + 0.6, p[2]) * (n[1] > -0.3 ? 1 : 0); },
    mat: (p, n, top) => { const s = p[0] >= 0 ? 'l' : 'r'; if (y(p) > top - 0.12) return 'fsS'; if (y(p) > top - 0.22) return 'rune'; if (n[1] < -0.3) return 'ashD'; return frac((p[2] - A.ankle[s][2]) * 3.5) > 0.82 ? 'fsS' : 'fs'; },
    rim: 'fsS',
  });
}

function firesteelHelm(B) {
  const browTh = browTheta(B);
  // a sallet with a long tail behind and two short horns swept back, its visor slit glowing
  const P = helm(B, {
    rim: 'fsS', down: 2.15,
    margin: ({ th, ph }) => { const s = fromFront(ph); return 0.12 + (s > 2.2 ? 0.25 * smooth(1.5, 2.1, th) : 0) + 0.06 * Math.max(0, 1 - th / 0.8); },
    mat: (d, { th, ph, p }) => {
      const s = fromFront(ph);
      if (Math.abs(th - (browTh + 0.1)) < 0.035 && s < 0.75) return 'rune';
      if (veins(p)) return 'vein';
      return th > 2.0 ? 'fsS' : 'fs';
    },
  });
  const head = onBone(B, 'head');
  const c = headCentre(B);
  const horn = (side) => loft([ring(8, 0, 0.14, 0.14), ring(8, 0.25, 0.1, 0.1), ring(8, 0.5, 0.06, 0.06), ring(8, 0.72, 0.015, 0.015)], (cc, i) => (i >= 2 ? 'fsL' : 'fsS'),
    { o: add(c, [side * 0.75, 0.75, 0.1]), X: [1, 0, 0], Y: unit([side * 0.55, 0.6, -0.6]), Z: unit(cross([1, 0, 0], unit([side * 0.55, 0.6, -0.6]))) }, head);
  return merge(P, horn(1), horn(-1));
}

function firesteelMantle(B) {
  const A = B.at, sx = A.shoulder.l[0];
  // a ragged cloak, smoke-grey, its hem burnt and glowing at the edges; a blackened clasp
  const cloth = cloak(B, {
    start: (x) => lerp([2.2, 0, 0], [1.15, 0, 0], smooth(0.75, 1.1, Math.abs(x)))[0],
    wide: (s) => lerp([0.84 * sx, 0, 0], [0.68 * sx, 0, 0], smooth(0.1, 0.5, s))[0],
    over: [firesteelChest(B)],
    off: () => 0.19, thick: 0.05,
    hang: lerp(A.spine1, A.pelvis, 0.95)[1], folds: 6, fold: 0.13,
    mat: (p, u, s) => { const tear = 0.86 + 0.1 * Math.abs(Math.sin(u * 17)); if (s > tear) return null; if (s > tear - 0.05) return 'rune'; return frac(s * 5 + u * 0.7) < 0.06 ? 'smokeD' : 'smoke'; },
    rim: 'smokeD',
  });
  const at = cloth.V.filter((p) => p[0] < -0.95 && p[0] > -1.25).reduce((b, p) => (p[2] > b[2] ? p : b), [0, 0, -9]);
  const pin = disc(B, add(at, [0, 0.03, 0.02]), [0, 0.85, 0.5], [[0.2, 0, 'fsS'], [0.2, 0.05, 'fs'], [0.12, 0.06, 'rune'], [0.06, 0.09, 'fsL']]);
  return merge(cloth, pin);
}

/* ==== the moonmetals' shared makings ============================================================================== */
/** A full harness of plate on the kit's components, in a set's own materials and patterns: a moonmetal's base. */
function moonChest(B, o) {
  const A = B.at, waist = waistOf(A);
  const coat = torso(B, {
    from: waist - 0.55,
    off: (p, n) => 0.17 + (o.bulge ? o.bulge(p) : 0) + (y(p) <= waist - 0.05 ? 0.06 + 0.03 * frac((waist - 0.05 - y(p)) / 0.17) : 0),
    mat: (p) => (y(p) <= waist - 0.05 ? (frac((waist - 0.05 - y(p)) / 0.17) > 0.82 ? o.dark : o.skirt ? o.skirt(p) : o.metal) : o.chest(p)),
    rim: o.dark,
    caps: { off: () => 0.14, mat: () => o.dark },
  });
  const pauldrons = shoulders(B, { from: -0.35, to: 0.36, off: (t) => 0.31 + 0.04 * frac((t + 0.35) / 0.18), mat: (t, p) => (o.shoulder ? o.shoulder(t, p) : frac((t + 0.35) / 0.18) > 0.82 ? o.dark : o.metal) });
  const rere = upperArms(B, { from: -0.35, to: 0.85, pit: B.who === 'male', inner: -0.3, innerZ: 0.2, thick: 0.02, off: (t, p, n) => (t < 0.45 && n[0] * Math.sign(p[0]) < -0.3 ? 0.03 : 0.12), mat: (u, p, n) => (n[0] * Math.sign(p[0]) < -0.3 ? o.dark : o.arm ? o.arm(u.t, p) : frac(u.t * 5) < 0.12 ? o.dark : o.metal) });
  const vamb = forearms(B, { from: -0.15, to: 0.93, elbow: true, off: (f) => 0.12 + (f.t < 0.15 ? 0.07 * Math.max(0, 1 - Math.abs(f.t) / 0.15) : 0) + (f.t > 0.82 ? 0.04 : 0), mat: (f, p) => (f.t > 0.82 ? (f.t > 0.88 ? o.dark : 'rune') : o.arm ? o.arm(f.t + 1, p) : o.metal) });
  return merge(coat, pauldrons, rere, vamb);
}
function moonLegs(B, o) {
  const A = B.at, waist = waistOf(A);
  const hose = hips(B, { closed: true, top: waist + 0.05, foot: (s) => lerp(A.hip[s], A.knee[s], 1)[1], off: (p) => 0.11 + 0.08 * smooth(A.hip.l[1] - 0.4, A.knee.l[1], y(p)) + (p[2] > 0.1 && y(p) < Math.min(A.hip.l[1] + 0.3, waist - 0.75) ? 0.13 : 0), mat: (p) => (y(p) > waist - 0.75 ? o.underW : o.under), rim: (m) => (m === o.underW ? o.underW : o.underD) });
  const cuisse = shell(B, {
    sub: 2,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; const g = legAt(B, p).thigh; return on(B, i, 'thigh') > 0.6 && g.t > 0.2 && g.t < 0.95 && dot(B.N[i], [Math.sign(p[0]) * 0.6, 0, 0.8]) > -0.1 && !(Math.abs(p[0]) < 0.32 && y(p) < A.hip[s][1] - 0.1); },
    off: ({ p }) => 0.24 + 0.03 * smooth(0.6, 0.95, legAt(B, p).thigh.t),
    mat: ({ p }) => (o.thigh ? o.thigh(p) : o.metal),
    rim: o.dark, thick: 0.05,
  });
  const greaves = shins(B, {
    from: -0.2, to: 0.9, round: 3.0,
    off: (g, p) => (g.t < 0.12 ? (-g.a * Math.sign(p[0]) < -0.6 ? 0.15 : 0.22 + 0.06 * Math.cos(g.a)) + (-g.a * Math.sign(p[0]) > 0.9 && g.t < 0.06 ? 0.08 : 0) : 0.14),
    mat: (g, p) => { if (g.t < 0.16 && -g.a * Math.sign(p[0]) < -0.8) return null; if (g.t < 0.12) return Math.abs(g.t) > 0.1 ? 'rune' : o.light ?? o.metal; if (g.t < 0.16) return o.dark; return o.shin ? o.shin(g, p) : o.metal; },
    rim: o.dark,
  });
  return { P: merge(hose, cuisse, greaves), dropAt: (f) => f.mat === o.underW };
}
function moonBoots(B, o) {
  const A = B.at;
  return feet(B, {
    up: o.up ?? 0.65,
    off: (p, n, top) => { const s = p[0] >= 0 ? 'l' : 'r'; return 0.05 + 0.02 * frac((p[2] - A.ankle[s][2]) * 3.5) + (o.point ? 0.1 * smooth(A.ball[s][2], A.ball[s][2] + 0.6, p[2]) * (n[1] > -0.3 ? 1 : 0) : 0); },
    mat: (p, n, top) => { const s = p[0] >= 0 ? 'l' : 'r'; if (y(p) > top - 0.12) return o.dark; if (y(p) > top - 0.22) return 'rune'; if (n[1] < -0.3) return o.sole ?? 'sole'; return o.foot ? o.foot(p, s) : frac((p[2] - A.ankle[s][2]) * 3.5) > 0.82 ? o.dark : o.metal; },
    rim: o.dark,
  });
}
function moonMantle(B, chest, o) {
  const A = B.at, sx = A.shoulder.l[0];
  const cloth = cloak(B, {
    start: o.start ?? ((x) => lerp([2.2, 0, 0], [1.15, 0, 0], smooth(0.75, 1.1, Math.abs(x)))[0]),
    wide: o.wide ?? ((s) => lerp([0.84 * sx, 0, 0], [0.68 * sx, 0, 0], smooth(0.1, 0.5, s))[0]),
    over: [chest],
    off: () => 0.19, thick: 0.05,
    hang: o.hang ?? lerp(A.spine1, A.pelvis, 0.95)[1], folds: o.folds ?? 6, fold: o.fold ?? 0.13, rowsDown: o.rowsDown,
    mat: o.mat, rim: o.rim,
  });
  const at = cloth.V.filter((p) => p[0] < -0.95 && p[0] > -1.25).reduce((b, p) => (p[2] > b[2] ? p : b), [0, 0, -9]);
  const pin = disc(B, add(at, [0, 0.03, 0.02]), [0, 0.85, 0.5], o.pin);
  return merge(cloth, pin);
}

/* ==== adamantine: the dwarven hold-guard =========================================================================== */
const ADAMANTINE_MATS = {
  ad: { c: '#3d4a43', kind: 3 },
  adS: { c: '#202824', kind: 3 },
  adL: { c: '#5b6b62', kind: 3 },
  gilt: { c: '#c49a3a', kind: 3 },
  rune: { c: '#7a6a3a', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  wool: { c: '#4a2a22', kind: 2 },
  woolD: { c: '#2f1b16', kind: 2 },
  woolW: { c: '#4a2a23', kind: 2 },
  hide: { c: '#4b3a2c', kind: 2 },
  hideD: { c: '#2e231a', kind: 2 },
  sole: { c: '#1f1813', kind: 2 },
};
/** Knotwork in gilt: lines at angles over the plate, every so often a knot. */
const knot = (p, k = 3) => frac((p[0] + y(p)) * k) < 0.07 || frac((p[0] - y(p)) * k) < 0.07;
const adOpts = { metal: 'ad', dark: 'adS', light: 'adL', under: 'wool', underD: 'woolD', underW: 'woolW',
  chest: (p) => (Math.abs(p[0]) < 0.06 && p[2] > 0 ? 'gilt' : knot(p) && p[2] > 0 ? 'gilt' : 'ad'), bulge: (p) => (p[2] > 0 ? 0.04 * Math.max(0, 1 - Math.abs(p[0]) / 0.6) : 0),
  shoulder: (t, p) => (frac((t + 0.35) / 0.18) > 0.82 ? 'gilt' : 'ad'), thigh: (p) => (knot(p, 2.5) ? 'gilt' : 'ad'), shin: (g, p) => (Math.abs(g.a) < 0.05 ? 'gilt' : 'ad') };
const adamantineChest = (B) => moonChest(B, adOpts);
const adamantineLegs = (B) => moonLegs(B, adOpts);
const adamantineBoots = (B) => moonBoots(B, { ...adOpts, up: 0.8, foot: (p, s) => (p[2] > B.at.ball[s][2] + 0.2 ? 'gilt' : 'ad') });
function adamantineHelm(B) {
  const browTh = browTheta(B);
  // a round dwarven helm, a heavy brow ridge in gilt with a glowing rune line, a broad nasal and cheek guards
  return helm(B, {
    rim: 'adS', down: 2.2,
    margin: ({ th, ph }) => { const s = fromFront(ph); return 0.13 + (Math.abs(th - (browTh - 0.08)) < 0.1 && s < 1.4 ? 0.07 : 0); },
    mat: (d, { th, ph }) => {
      const s = fromFront(ph);
      if (th > browTh && s < 0.9 && !(s < 0.14 && th < browTh + 0.55) && !(s > 0.55 && th > browTh + 0.25)) return null;
      if (Math.abs(th - (browTh - 0.08)) < 0.1 && s < 1.4) return Math.abs(th - (browTh - 0.08)) < 0.06 ? 'rune' : 'gilt';
      if (s < 0.14 && th > browTh) return 'gilt';
      return frac(ph / (Math.PI / 4)) < 0.04 ? 'adS' : 'ad';
    },
  });
}
const adamantineMantle = (B) => moonMantle(B, adamantineChest(B), {
  hang: lerp(B.at.spine1, B.at.pelvis, 0.85)[1], folds: 4, fold: 0.08,
  mat: (p, u, s) => (s < 0.22 ? 'hide' : s > 0.9 ? (frac(u * 8) < 0.5 ? 'gilt' : 'woolD') : 'wool'), rim: 'woolD',
  pin: [[0.24, 0, 'adS'], [0.24, 0.06, 'gilt'], [0.16, 0.07, 'rune'], [0.09, 0.1, 'gilt']],
});

/* ==== glimmersteel: the starlit duellist =========================================================================== */
const GLIMMERSTEEL_MATS = {
  gl: { c: '#3b4170', kind: 3 },
  glS: { c: '#22264a', kind: 3 },
  star: { c: '#e8ecff', kind: 3 },
  rune: { c: '#6a70a8', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  night: { c: '#1d2240', kind: 2 },
  nightD: { c: '#11142a', kind: 2 },
  nightW: { c: '#1d2241', kind: 2 },
  silk: { c: '#cfd3e8', kind: 2 },
  boot: { c: '#2a2430', kind: 2 },
  sole: { c: '#16121a', kind: 2 },
};
/** Stars scattered over the metal: a few points in each patch. */
const starAt = (p) => { const h = Math.sin(p[0] * 41.3 + y(p) * 17.1) * Math.sin(y(p) * 37.7 - p[2] * 29.3) * Math.sin(p[2] * 23.9 + p[0] * 11.7); return h > 0.78; };
const glOpts = { metal: 'gl', dark: 'glS', light: 'star', under: 'night', underD: 'nightD', underW: 'nightW',
  chest: (p) => (starAt(p) ? 'star' : 'gl'),
  skirt: (p) => (starAt(p) ? 'star' : 'gl'), thigh: (p) => (starAt(p) ? 'star' : 'gl'), shin: (g, p) => (starAt(p) ? 'star' : 'gl'), arm: (t, p) => (starAt(p) ? 'star' : 'gl') };
const glimmersteelChest = (B) => moonChest(B, glOpts);
const glimmersteelLegs = (B) => moonLegs(B, glOpts);
const glimmersteelBoots = (B) => moonBoots(B, { ...glOpts, up: 0.7, foot: (p, s) => (p[2] > B.at.ball[s][2] + 0.2 ? 'gl' : 'boot') });
function glimmersteelHelm(B) {
  const browTh = browTheta(B);
  // an open cap close over the skull, a crescent standing at the brow, its inner edge glowing; stars over the cap
  const P = helm(B, {
    rim: 'glS', down: 2.05,
    margin: () => 0.1,
    mat: (d, { th, ph, p }) => { const s = fromFront(ph); if (th > browTh - 0.05 && s < 1.0) return null; return starAt(p) ? 'star' : th > browTh - 0.15 ? 'glS' : 'gl'; },
  });
  const head = onBone(B, 'head'), c = headCentre(B);
  const pts = [...Array(9).keys()].map((k) => { const a = -1.1 + (2.2 * k) / 8; return [Math.sin(a) * 0.38, Math.cos(a) * 0.38 - 0.1, 0]; });
  const crescent = loft(pts.map((q, k) => { const w = 0.07 * Math.cos((k / 8 - 0.5) * Math.PI) + 0.015; return [add(q, [0, 0, -0.04]), add(q, [0, 0, 0.04]), add(q, [0, w, 0.04]), add(q, [0, w, -0.04])]; }),
    (cc, i) => (i === 4 ? 'rune' : 'star'), { o: add(c, [0, 1.05, 0.75]), X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] }, head, { closed: true });
  return merge(P, crescent);
}
// (a half-cape over the left shoulder only, as a duellist wears it)
// (a short cape to the small of the back, its hem cut on the slant, a silk edge)
const glimmersteelMantle = (B) => moonMantle(B, glimmersteelChest(B), {
  hang: lerp(B.at.spine1, B.at.pelvis, 0.6)[1], folds: 5, fold: 0.1,
  mat: (p, u, s) => (s > 0.78 + 0.14 * u ? null : s > 0.72 + 0.14 * u || Math.abs(u) > 0.94 ? 'silk' : starAt(p) ? 'star' : 'night'), rim: 'nightD',
  pin: [[0.18, 0, 'glS'], [0.18, 0.05, 'gl'], [0.11, 0.06, 'rune'], [0.06, 0.08, 'star']],
});

/* ==== mithril: the elven warden ===================================================================================== */
const MITHRIL_MATS = {
  mi: { c: '#a4b3c2', kind: 3 },
  miS: { c: '#5d6b7a', kind: 3 },
  miL: { c: '#dfe8ef', kind: 3 },
  rune: { c: '#8ea6b8', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  leaf: { c: '#4f6a4a', kind: 2 },
  leafD: { c: '#34482f', kind: 2 },
  leafW: { c: '#4f6a4b', kind: 2 },
  cloak: { c: '#5d6e5a', kind: 2 },
  cloakD: { c: '#3d4a3b', kind: 2 },
  sole: { c: '#22261e', kind: 2 },
};
/** Leaf scales: pointed leaves overlapping down the plate, each with its midrib. */
const leafAt = (p, k = 3.6) => { const row = Math.floor(y(p) * k), u = frac(p[0] * k * 0.7 + (row % 2) * 0.5 + p[2]), v = frac(y(p) * k); if (Math.abs(u - 0.5) < 0.04 && v > 0.25) return 'miS'; return Math.abs(u - 0.5) > 0.5 * v + 0.05 ? 'miS' : 'mi'; };
const miOpts = { metal: 'mi', dark: 'miS', light: 'miL', under: 'leaf', underD: 'leafD', underW: 'leafW',
  chest: (p) => leafAt(p), skirt: (p) => leafAt(p, 4.5), thigh: (p) => leafAt(p, 4), shin: (g, p) => leafAt(p, 4), arm: (t, p) => (t > 1 ? 'mi' : leafAt(p, 4)),
  shoulder: (t, p) => leafAt(p, 4.5) };
const mithrilChest = (B) => moonChest(B, miOpts);
const mithrilLegs = (B) => moonLegs(B, miOpts);
const mithrilBoots = (B) => moonBoots(B, { ...miOpts, up: 0.7, point: true, foot: (p, s) => (y(p) > B.at.ankle[s][1] + 0.3 ? leafAt(p, 4.5) : 'mi') });
function mithrilHelm(B) {
  const browTh = browTheta(B);
  // a tall helm drawn up to a leaf's point, open-faced, swept wings over the ears, a glowing vine round the brow
  return helm(B, {
    rim: 'miS', down: 2.05,
    margin: ({ th, ph }) => { const s = fromFront(ph); const wing = Math.exp(-(((th - 1.35) / 0.25) ** 2) - (((s - 1.5) / 0.3) ** 2)); return 0.1 + 0.38 * Math.max(0, 1 - th / 0.85) ** 1.5 + 0.35 * wing; },
    mat: (d, { th, ph }) => {
      const s = fromFront(ph);
      if (th > browTh + 0.05 && s < 1.0) return null;
      if (Math.abs(th - (browTh - 0.05)) < 0.045 && s < 1.3) return 'rune';
      const wing = Math.exp(-(((th - 1.35) / 0.25) ** 2) - (((s - 1.5) / 0.3) ** 2));
      if (wing > 0.4) return frac(th * 9) < 0.2 ? 'miS' : 'miL';
      return frac(ph / (Math.PI / 2) + 0.5) < 0.04 ? 'miS' : 'mi';
    },
  });
}
const mithrilMantle = (B) => moonMantle(B, mithrilChest(B), {
  hang: lerp(B.at.spine1, B.at.pelvis, 1.0)[1], folds: 8, fold: 0.15,
  mat: (p, u, s) => (s > 0.94 ? 'leafD' : frac(s * 6 + Math.abs(u) * 2) < 0.05 ? 'cloakD' : 'cloak'), rim: 'cloakD',
  pin: [[0.2, 0, 'miS'], [0.2, 0.05, 'mi'], [0.13, 0.06, 'rune'], [0.07, 0.09, 'miL']],
});

/* ==== seryll: the tide-warden (sea crystal) ========================================================================= */
const SERYLL_MATS = {
  se: { c: '#3fa6a4', kind: 3 },
  seS: { c: '#1d5c5e', kind: 3 },
  seL: { c: '#9fe0d8', kind: 3 },
  rune: { c: '#4f8f9a', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  coral: { c: '#d0705a', kind: 2 },
  sea: { c: '#1f4a5a', kind: 2 },
  seaD: { c: '#13303c', kind: 2 },
  seaW: { c: '#1f4a5b', kind: 2 },
  foam: { c: '#d8ece8', kind: 2 },
  sole: { c: '#102026', kind: 2 },
};
/** Crystal facets: the plate broken into angled planes, light and dark. */
const facet = (p, k = 2.4) => { const a = Math.floor(p[0] * k + y(p) * k * 0.6), b = Math.floor(p[0] * k * 0.6 - y(p) * k + p[2] * 2); const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; const f = h - Math.floor(h); return f > 0.85 ? 'seL' : f < 0.15 ? 'seS' : 'se'; };
const seOpts = { metal: 'se', dark: 'seS', light: 'seL', under: 'sea', underD: 'seaD', underW: 'seaW',
  chest: (p) => facet(p), skirt: (p) => facet(p, 3.5), thigh: (p) => facet(p, 3), shin: (g, p) => facet(p, 3), arm: (t, p) => facet(p, 3), shoulder: (t, p) => facet(p, 3.5) };
const seryllChest = (B) => moonChest(B, seOpts);
const seryllLegs = (B) => moonLegs(B, seOpts);
const seryllBoots = (B) => moonBoots(B, { ...seOpts, up: 0.75, foot: (p) => facet(p, 3.5) });
function seryllHelm(B) {
  const browTh = browTheta(B);
  // a crown of crystal spires rising from the helm, open-faced, a glowing line of sea-glass at the brow
  return helm(B, {
    rim: 'seS', down: 2.05,
    margin: ({ th, ph }) => { const s = fromFront(ph); const spire = Math.max(0, Math.cos(ph * 7)) ** 6 * Math.max(0, 1 - Math.abs(th - 0.85) / 0.4); return 0.11 + 0.4 * spire * (s < 2.6 ? 1 : 0.5); },
    mat: (d, { th, ph, p }) => {
      const s = fromFront(ph);
      if (th > browTh + 0.05 && s < 1.0) return null;
      if (Math.abs(th - (browTh - 0.05)) < 0.045 && s < 1.3) return 'rune';
      const spire = Math.max(0, Math.cos(ph * 7)) ** 6 * Math.max(0, 1 - Math.abs(th - 0.85) / 0.4);
      return spire > 0.3 ? 'seL' : facet(p, 3.5);
    },
  });
}
const seryllMantle = (B) => moonMantle(B, seryllChest(B), {
  hang: lerp(B.at.spine1, B.at.pelvis, 0.95)[1], folds: 7, fold: 0.14,
  mat: (p, u, s) => { const crest = 0.9 + 0.05 * Math.sin(u * 14); if (s > crest + 0.05) return null; if (s > crest) return 'foam'; return s > 0.6 ? 'sea' : 'seaD'; }, rim: 'seaD',
  pin: [[0.2, 0, 'seS'], [0.2, 0.05, 'se'], [0.13, 0.06, 'rune'], [0.07, 0.1, 'seL']],
});

/* ==== the sets ===================================================================================================== */
const SETS = {
  copper: { MATS: COPPER_MATS, helm: copperHelm, chest: copperChest, mantle: copperMantle, legs: copperLegs, boots: copperBoots },
  iron: { MATS: IRON_MATS, helm: ironHelm, chest: ironChest, mantle: ironMantle, legs: ironLegs, boots: ironBoots },
  adamantine: { MATS: ADAMANTINE_MATS, helm: adamantineHelm, chest: adamantineChest, mantle: adamantineMantle, legs: adamantineLegs, boots: adamantineBoots },
  glimmersteel: { MATS: GLIMMERSTEEL_MATS, helm: glimmersteelHelm, chest: glimmersteelChest, mantle: glimmersteelMantle, legs: glimmersteelLegs, boots: glimmersteelBoots },
  mithril: { MATS: MITHRIL_MATS, helm: mithrilHelm, chest: mithrilChest, mantle: mithrilMantle, legs: mithrilLegs, boots: mithrilBoots },
  seryll: { MATS: SERYLL_MATS, helm: seryllHelm, chest: seryllChest, mantle: seryllMantle, legs: seryllLegs, boots: seryllBoots },
  gold: { MATS: GOLD_MATS, helm: goldHelm, chest: goldChest, mantle: goldMantle, legs: goldLegs, boots: goldBoots },
  electrum: { MATS: ELECTRUM_MATS, helm: electrumHelm, chest: electrumChest, mantle: electrumMantle, legs: electrumLegs, boots: electrumBoots },
  firesteel: { MATS: FIRESTEEL_MATS, helm: firesteelHelm, chest: firesteelChest, mantle: firesteelMantle, legs: firesteelLegs, boots: firesteelBoots },
  brass: { MATS: BRASS_MATS, helm: brassHelm, chest: brassChest, mantle: brassMantle, legs: brassLegs, boots: brassBoots },
  pewter: { MATS: PEWTER_MATS, helm: pewterHelm, chest: pewterChest, mantle: pewterMantle, legs: pewterLegs, boots: pewterBoots },
  lead: { MATS: LEAD_MATS, helm: leadHelm, chest: leadChest, mantle: leadMantle, legs: leadLegs, boots: leadBoots },
  zinc: { MATS: ZINC_MATS, helm: zincHelm, chest: zincChest, mantle: zincMantle, legs: zincLegs, boots: zincBoots },
  tin: { MATS: TIN_MATS, helm: tinHelm, chest: tinChest, mantle: tinMantle, legs: tinLegs, boots: tinBoots },
  fur: { MATS: FUR_MATS, helm: furHelm, chest: furChest, mantle: furMantle, legs: furLegs, boots: furBoots, file: 'lowfur' },
  steel: { MATS: STEEL_MATS, helm: steelHelm, chest: steelChest, mantle: steelMantle, legs: steelLegs, boots: steelBoots },
  bronze: { MATS: BRONZE_MATS, helm: bronzeHelm, chest: bronzeChest, mantle: bronzeMantle, legs: bronzeLegs, boots: bronzeBoots },
};

const only = opt('only', null);
for (const [id, S] of Object.entries(SETS)) {
  if (opt('set', id) !== id) continue;
  for (const who of ['male', 'female']) {
    const B = bodyOf(who);
    for (const piece of ['helm', 'chest', 'mantle', 'legs', 'boots']) {
      if (only && only !== piece) continue;
      const made = S[piece](B), P = made.P ?? made;
      const asset = assetOf(B, P, S.MATS, { dropAt: made.dropAt });
      const name = `${S.file ?? `lowmetal${id}`}${piece}-${who}`;
      writeFileSync(new URL(`${name}.json`, ASSETS), JSON.stringify(asset));
      // (and its type, so the typechecker reads this rather than inferring one from every number in the mesh)
      writeFileSync(new URL(`${name}.d.json.ts`, ASSETS), STUB);
      console.log(`${S.file ?? `lowmetal${id}`}${piece}-${who}.json: ${asset.verts.length / 3} points, ${asset.polys.length} faces, ${asset.hides.length} hidden, mats ${asset.mats.join(' ')}`);
    }
  }
}
