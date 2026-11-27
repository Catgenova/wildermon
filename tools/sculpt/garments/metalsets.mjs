// The metal sets: for each metal with a set of its own, its helm, chest & arms, shawl, leggings and boots, on both
// low-poly bodies, made out of the body itself (tools/sculpt/garments/metalkit.mjs). Each piece's plates are `plate` and
// `shade` (drawn in the piece's metal: src/sculpt/lowpoly.ts plateMat), its glow `rune` (lit in the enchantment's colour).
//
//   node tools/sculpt/garments/metalsets.mjs [--set copper] [--only chest]
//     writes src/sculpt/assets/lowmetal<set><piece>-<who>.json for helm, chest, mantle, legs and boots.
import { writeFileSync } from 'node:fs';
import { STEEL_MATS, steelHelm, steelChest, steelMantle, steelLegs, steelBoots } from './steel.mjs';
import * as CU from './kit/copper.mjs';
import { ZINC_MATS, zincHelm, zincChest, zincMantle, zincLegs, zincBoots } from './zinc.mjs';
import { GOLD_MATS, goldHelm, goldChest, goldMantle, goldLegs, goldBoots } from './gold.mjs';
import { LEAD_MATS, leadHelm, leadChest, leadMantle, leadLegs, leadBoots } from './lead.mjs';
import * as TIN from './tin.mjs';
import { MITHRIL_MATS, mithrilHelm, mithrilChest, mithrilMantle, mithrilLegs, mithrilBoots } from './mithril.mjs';
import * as BRASS from './brass.mjs';
import * as GLIM from './glimmersteel.mjs';
import { chlamys, corinthianHelm, hopliteChest, hopliteLegs, krepides } from './kit/bronze.mjs';
import { PEWTER_MATS, pewterHelm, pewterChest, pewterMantle, pewterLegs, pewterBoots } from './pewter.mjs';
import { FIRESTEEL_MATS, firesteelHelm, firesteelChest, firesteelMantle, firesteelLegs, firesteelBoots } from './firesteel.mjs';
import * as AD from './adamantine.mjs';
import * as EL from './electrum.mjs';
import * as SERYLL from './seryll.mjs';
import * as FUR from './fur.mjs';
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

/* ==== iron: the early medieval huscarl (the Vendel and the Viking age): tools/sculpt/garments/kit/iron.mjs ======== */
import * as IRON from './kit/iron.mjs';
const IRON_MATS = {
  // blackened iron, its edges filed bright, its insides dark; gilt bronze fittings
  fe: { c: '#2c3036', kind: 3 },
  feM: { c: '#4b5159', kind: 3 },
  feL: { c: '#cfd5dc', kind: 3 },
  feD: { c: '#15171a', kind: 3 },
  gilt: { c: '#b48c3e', kind: 3 },
  mailD: { c: '#363b42', kind: 3 },
  // the glow, lit in the enchantment's colour: the helm's brows and crest, the chest's mirror ring, the mantle's brooch
  // and its bosses' rings, the knee discs' rings, the spurs' goads
  runeG: { c: '#b48c3e', kind: 3, lit: { c: '#ffe7a6', kind: 1 } },
  rune: { c: '#58281d', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  runeS: { c: '#8f979f', kind: 3, lit: { c: '#ffe7a6', kind: 1 } },
  // the gambeson (indigo), the lacing, the leather
  gam: { c: '#2f4a78', kind: 2 },
  gamD: { c: '#1f3157', kind: 2 },
  lace: { c: '#8a4630', kind: 2 },
  leather: { c: '#5a3a26', kind: 2 },
  leatherD: { c: '#3e281c', kind: 2 },
  sole: { c: '#2e211a', kind: 2 },
  soleH: { c: '#241913', kind: 2 },
  // the mantle: madder wool and its woven hem, the bear's fur
  wool: { c: '#7a2a22', kind: 2 },
  woolD: { c: '#4e1a16', kind: 2 },
  trim: { c: '#c49a3c', kind: 2 },
  trimD: { c: '#5e1d17', kind: 2 },
  fur: { c: '#4b3424', kind: 2 },
  furL: { c: '#80603f', kind: 2 },
  furD: { c: '#23180f', kind: 2 },
  // the trousers (their waist, left out under a chest piece) and the wraps
  hose: { c: '#6a3a28', kind: 2 },
  hoseW: { c: '#6a3a29', kind: 2 },
  hoseD: { c: '#43251a', kind: 2 },
  wrap: { c: '#a8977a', kind: 2 },
};
const ironChest = (B) => merge(...IRON.ironChestOf(B).parts);
const ironLegs = (B) => ({ P: merge(...IRON.ironLegsOf(B).parts), dropAt: (f) => f.mat === 'hoseW' });
const ironBoots = (B) => IRON.ironBootsOf(B);
const ironHelm = (B) => merge(...IRON.ironHelmOf(B).P);

const ironMantle = (B) => merge(...IRON.ironMantleOf(B).parts);

/* ==== bronze: the hoplite (Classical Greece) ======================================================================= */
const BRONZE_MATS = {
  // (hammered bronze, lit as metal: a warm orange-gold field, its rolled edges and raised work polished near white-gold,
  // its shade a deep olive brown; verdigris in the hollows of the key patterns)
  brz: { c: '#86521c', kind: 3 },
  brzM: { c: '#5e3e16', kind: 3 },
  brzL: { c: '#ffd890', kind: 3 },
  brzS: { c: '#3a3214', kind: 3 },
  brzG: { c: '#221a0a', kind: 3 },
  brzD: { c: '#140c05', kind: 2 },
  patina: { c: '#3f6e52', kind: 2 },
  // (the glow: the helm's eyes, the cuirass's key, the greaves' volutes, the brooch's rays, the boots' bosses)
  rune: { c: '#c99a48', kind: 3, lit: { c: '#ffe7a6', kind: 1 } },
  // (the leggings' pteruges: oxblood leather straps, their edges black)
  ox: { c: '#5e2414', kind: 2 },
  oxE: { c: '#1c1210', kind: 2 },
  strip: { c: '#86231a', kind: 2 },
  stripD: { c: '#4f140e', kind: 2 },
  hem: { c: '#c79a45', kind: 2 },
  linen: { c: '#ddd2b6', kind: 2 },
  linenW: { c: '#ddd2b7', kind: 2 },
  linenD: { c: '#b8aa88', kind: 2 },
  linenH: { c: '#cdbf9e', kind: 2 },
  crest: { c: '#a8261b', kind: 2 },
  crestD: { c: '#6a1610', kind: 2 },
  // (the chlamys, black-figure ware: near-black wool, its borders and its sun in terracotta)
  cloak: { c: '#2a2024', kind: 0 },
  cloakD: { c: '#120d0f', kind: 0 },
  // (the folds: their hollows a shade down, their crests a shade up)
  cloakM: { c: '#191215', kind: 0 },
  cloakL: { c: '#4e3e46', kind: 0 },
  terra: { c: '#b44a22', kind: 0 },
  goldD: { c: '#7a3a1a', kind: 0 },
  leather: { c: '#6a4026', kind: 2 },
  leatherD: { c: '#2c1b12', kind: 2 },
  sole: { c: '#2b1d16', kind: 2 },
  soleE: { c: '#4a3122', kind: 2 },
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
  return hopliteChest(B);
}

function bronzeLegs(B) {
  return hopliteLegs(B);
}

function bronzeBoots(B) {
  return krepides(B);
}

function bronzeHelm(B) {
  return corinthianHelm(B);
}

function bronzeMantle(B) {
  return chlamys(B);
}

/* ==== steel: the Milanese harness (tools/sculpt/garments/steel.mjs, built with the plate kit) ================== */

/* ==== fur: the tundra raider (a new armour class, between leather and chain: tools/sculpt/garments/fur.mjs) ====== */

/* ==== tin: the town militia (tools/sculpt/garments/tin.mjs) ==================================================== */

/* ==== zinc: the sapper (tools/sculpt/garments/zinc.mjs, built with the plate kit) ========================== */

/* ==== lead: the Wall (tools/sculpt/garments/lead.mjs, built with the plate kit) ================================== */

/* ==== pewter: the pilgrim (tools/sculpt/garments/pewter.mjs, built with the plate kit) =========================== */

/* ==== brass: the clockwork artificer (tools/sculpt/garments/brass.mjs, built with the plate kit) ========= */

/* ==== gold: the royal guard in parade armour (tools/sculpt/garments/gold.mjs, built with the plate kit) ========== */

/* ==== electrum: the Immortal (tools/sculpt/garments/electrum.mjs, built with the plate kit) ===================== */

/* ==== fire-tempered steel: the ember knight (built with the plate kit: tools/sculpt/garments/firesteel.mjs) ======== */

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

/* ==== adamantine: the dwarven hold-guard (tools/sculpt/garments/adamantine.mjs, built with the plate kit) ======== */

/* ==== glimmersteel: the starlit duellist (built with the plate kit: tools/sculpt/garments/glimmersteel.mjs) ======== */

/* ==== mithril: the elven warden (built with the plate kit: tools/sculpt/garments/mithril.mjs) ==================== */

/* ==== seryll: the tide-warden (built with the plate kit: tools/sculpt/garments/seryll.mjs) ===================== */

/* ==== the sets ===================================================================================================== */
const SETS = {
  copper: { MATS: COPPER_MATS, helm: copperHelm, chest: copperChest, mantle: copperMantle, legs: copperLegs, boots: copperBoots },
  iron: { MATS: IRON_MATS, helm: ironHelm, chest: ironChest, mantle: ironMantle, legs: ironLegs, boots: ironBoots },
  glimmersteel: { MATS: GLIM.GLIMMERSTEEL_MATS, helm: GLIM.glimmersteelHelm, chest: GLIM.glimmersteelChest, mantle: GLIM.glimmersteelMantle, legs: GLIM.glimmersteelLegs, boots: GLIM.glimmersteelBoots },
  adamantine: { MATS: AD.ADAMANTINE_MATS, helm: AD.adamantineHelm, chest: AD.adamantineChest, mantle: AD.adamantineMantle, legs: AD.adamantineLegs, boots: AD.adamantineBoots },
  mithril: { MATS: MITHRIL_MATS, helm: mithrilHelm, chest: mithrilChest, mantle: mithrilMantle, legs: mithrilLegs, boots: mithrilBoots },
  seryll: { MATS: SERYLL.SERYLL_MATS, helm: SERYLL.seryllHelm, chest: SERYLL.seryllChest, mantle: SERYLL.seryllMantle, legs: SERYLL.seryllLegs, boots: SERYLL.seryllBoots },
  gold: { MATS: GOLD_MATS, helm: goldHelm, chest: goldChest, mantle: goldMantle, legs: goldLegs, boots: goldBoots },
  electrum: { MATS: EL.ELECTRUM_MATS, helm: EL.electrumHelm, chest: EL.electrumChest, mantle: EL.electrumMantle, legs: EL.electrumLegs, boots: EL.electrumBoots },
  firesteel: { MATS: FIRESTEEL_MATS, helm: firesteelHelm, chest: firesteelChest, mantle: firesteelMantle, legs: firesteelLegs, boots: firesteelBoots },
  brass: { MATS: BRASS.BRASS_MATS, helm: BRASS.brassHelm, chest: BRASS.brassChest, mantle: BRASS.brassMantle, legs: BRASS.brassLegs, boots: BRASS.brassBoots },
  pewter: { MATS: PEWTER_MATS, helm: pewterHelm, chest: pewterChest, mantle: pewterMantle, legs: pewterLegs, boots: pewterBoots },
  lead: { MATS: LEAD_MATS, helm: leadHelm, chest: leadChest, mantle: leadMantle, legs: leadLegs, boots: leadBoots },
  zinc: { MATS: ZINC_MATS, helm: zincHelm, chest: zincChest, mantle: zincMantle, legs: zincLegs, boots: zincBoots },
  tin: { MATS: TIN.TIN_MATS, helm: TIN.tinHelm, chest: TIN.tinChest, mantle: TIN.tinMantle, legs: TIN.tinLegs, boots: TIN.tinBoots },
  fur: { MATS: FUR.FUR_MATS, helm: FUR.furHelm, chest: FUR.furChest, mantle: FUR.furMantle, legs: FUR.furLegs, boots: FUR.furBoots, file: 'lowfur' },
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
