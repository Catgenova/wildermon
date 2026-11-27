// The mithril set: the elven warden, built with the plate kit (tools/sculpt/garments/platekit.mjs) and the set's own
// leaves (tools/sculpt/garments/kit/mithril.mjs): moonlit silver in leaves over sage cloth, every leaf its own plate.
//
//   helm    a tall open helm drawn up and back to a leaf's point, a crest along its middle, a moonstone at the brow
//           where its edge dips between the eyes; two swept leaf wings at each temple, leaf cheek guards, a splay of
//           small leaves over the nape.
//   chest   a sage tunic; a silver yoke over the breast and the back cut to a leaf's point, a vine down the breastbone;
//           rows of leaf scales to a leather belt with a crossed-leaf clasp; leaf tassets over the thighs; pauldrons of
//           three folded leaves, two more down the upper arm, an elbow leaf, a bracer drawn to a point, a leaf on the hand.
//   mantle  two rings of silver leaves radiating from the neck over a sage cowl; a brooch at the throat (a crescent moon
//           cradling a moonstone over three fanned leaves); a long grey-green cloak lined white, split up the back into
//           two tails each cut and veined as a great leaf, its hem embroidered with a silver vine.
//   legs    sage hose ending in a silver-corded sleeve above the ankle; on each thigh a great veined leaf lapped over a
//           narrower one, a leaf over the knee and a swept leaf off its outside, a silver vine round the back of the
//           thigh; two silver leaves down the outside of the calf to the boot's top.
//   boots   slim dove-grey leather to mid-calf, seamed and laced, a cuff of standing silver-edged leaves; a long silver
//           leaf down the shin; the foot its own narrow shape drawn out to a long upturned point, a silver leaf over it,
//           another over the outer ankle.
//
// Enchanted, a few things light: the helm's moonstone and the line up its crest; the vine down the breastbone; the
// brooch's moon and stone; the midribs of the great leaves (the cloak's tails, the thighs, the shins and the toes).
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, smooth, merge, shell, on, nearestOf } from './metalkit.mjs';
import {
  skinSamples, boneW, wrapAngle, plateOn, solid, tube, band, rowPath, stud, gridOf, domeWrap, ellipsoidReach, shareW, nearSkinW, skinW, mixW, mixOf,
  limbWrap, along, coverHides, smoothWeights, torsoWrap, torsoMiddle, patch, colPath, pathOn,
} from './platekit.mjs';
import { leafOn, leafFree, vine, headOnlyW, torsoField, torsoMarks } from './kit/mithril.mjs';

const PI = Math.PI, TAU = 2 * PI;

export const MITHRIL_MATS = {
  // (the silver: a bright cool field, polished edges and ribs near white, blue-steel where plates step and recess)
  mi: { c: '#a0b3cf', kind: 3 },
  miM: { c: '#8396b4', kind: 3 },
  miL: { c: '#f6faff', kind: 3 },
  miB: { c: '#c2d2e9', kind: 3 },
  miS: { c: '#4a5b7a', kind: 3 },
  miD: { c: '#1f2a3e', kind: 3 },
  // (the glow: pale moon-silver inlay, lit in the enchantment's colour)
  rune: { c: '#d6e6fa', kind: 3, lit: { c: '#ffe7a6', kind: 1 } },
  moon: { c: '#f4f8ff', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  // (the cloth: deep sage, grey-green and moonlight white)
  sage: { c: '#62724f', kind: 0 },
  sageD: { c: '#45543f', kind: 0 },
  sageW: { c: '#6b7d62', kind: 0 },
  green: { c: '#4b5c48', kind: 0 },
  greenD: { c: '#33402f', kind: 0 },
  white: { c: '#dfe3d8', kind: 0 },
  cloak: { c: '#425649', kind: 0 },
  hose: { c: '#44533f', kind: 0 },
  hoseW: { c: '#44533f', kind: 0 },
  // (the boots: soft dove-grey leather, darker seams)
  leather: { c: '#666d72', kind: 2 },
  leatherD: { c: '#30363a', kind: 2 },
  sole: { c: '#2a2e30', kind: 2 },
};

/** A dome's grid with every point moved by `f(p, th)` (th its polar angle), read as the dome is (`ta`). */
function moveDome(D, f) {
  const rows = D.P.length - 1, cols = D.P[0].length;
  const P = D.P.map((row, i) => row.map((p) => f(p, (i / rows) * D.thMax)));
  const G = gridOf(P, { closed: true, out: (i, j) => D.N[i][j] });
  G.ta = (t, a) => G.at(t * rows, wrapAngle(a) / (TAU / cols));
  return G;
}

/* ---- the helm ---------------------------------------------------------------------------------------------------- */
export function mithrilHelm(B) {
  const A = B.at, out = [], wH = () => boneW(B, 'head'), fem = B.who === 'female';
  const pick = (q) => headOnlyW(B, q.w) > 0.45;
  const hs = skinSamples(B).filter(pick);
  const top = Math.max(...hs.map((q) => q.p[1])), bot = Math.min(...hs.map((q) => q.p[1]));
  const zf = Math.max(...hs.map((q) => q.p[2])), zb = Math.min(...hs.map((q) => q.p[2])), xw = Math.max(...hs.map((q) => q.p[0]));
  const c = [0, bot + 0.56 * (top - bot), (zf + zb) / 2];
  const fit = fem ? 0.07 : 0.08;
  const E = [xw + fit, top - c[1] + fit, (zf - zb) / 2 + fit];
  const D0 = domeWrap(B, { c, u: [0, 1, 0], f: [0, 0, 1], s: [1, 0, 0], pick, rows: 32, cols: 48, thMax: PI, cone: 0.3, smooth: 4, shape: (r, th, ph, d) => Math.max(r + fit - 0.02, ellipsoidReach(E, d)) });
  // (drawn up and back to a point, narrowed side to side as it rises: a leaf's tip standing over the crown)
  const H = fem ? 0.62 : 0.7, Hb = fem ? 0.55 : 0.62, T0 = 1.25;
  const rise = (th) => Math.max(0, 1 - th / T0) ** 2;
  const D = moveDome(D0, (p, th) => { const f = rise(th); return add([p[0] * (1 - 0.45 * f), p[1], p[2]], [0, H * f, -Hb * f]); });
  const thOf = (p) => Math.acos(clamp(unit(sub(p, c))[1], -1, 1));
  // (the brows' top: the helm's edge runs just above it)
  const browTop = Math.max(...B.A.polys.filter((pp) => pp[1] === 1).flatMap((pp) => pp[0]).map((i) => B.V[i][1]));
  const browTh = thOf([0, browTop, zf - 0.05]) - 0.06;
  const front = (ph) => Math.abs(wrapAngle(ph));
  // -- the skull: its edge along the brow before, dipping to a point between the eyes, sweeping down past the temple to the nape
  const nape = fem ? 2.25 : 2.32;
  const skBot = (ph) => {
    const f = front(ph), brow = browTh + 0.17 * Math.exp(-((f / 0.11) ** 2)) - 0.04 * smooth(0.3, 0.9, f);
    return lerp([brow, 0, 0], [nape, 0, 0], smooth(0.95, 1.6, f))[0];
  };
  const NV = 40;
  const skull = plateOn(D, { a0: -PI, a1: PI, closed: true, t0: () => 0, t1: (a) => skBot(a) / PI, nu: 14, nv: NV, off: () => 0 });
  out.push(solid(skull, { sheet: true, w: wH, thick: 0.05, mat: (i) => (i >= 12 ? 'miM' : 'mi'), inner: 'miD', edge: 'miS' }));
  // (its edge rolled bright, and a raised band above it: the circlet)
  out.push(tube(rowPath(skull, 14, 0, NV, NV / 2), { r: 0.045, k: 3, mat: 'miL', w: wH, closed: true }));
  out.push(band(rowPath(skull, 12.6, 0, NV, 28), { wide: 0.05, high: 0.025, mat: 'miL', w: wH, closed: true }));
  // -- the crest: a fin along the middle from the brow's dip over the point and down the back
  const crest = [];
  const cTh0 = skBot(0) - 0.12;
  for (let k = 0; k <= 30; k++) {
    const s = -cTh0 + ((cTh0 + 1.9) * k) / 30, th = Math.abs(s), q = D.ta(th / PI, s < 0 ? 0 : PI);
    crest.push({ p: q.p, n: q.n, th });
  }
  const finH = (k, q) => (0.05 + 0.13 * Math.exp(-((q.th / 0.9) ** 2))) * Math.min(1, 0.2 + k / 4) * Math.min(1, 0.2 + (30 - k) / 6);
  out.push(sweep2(crest, (k, q) => { const h = finH(k, q); return [[-0.035, -0.02], [0.035, -0.02], [0.012, h], [-0.012, h]]; }, 'mi', wH));
  // (the line up the crest's foot on each side, lit when enchanted)
  for (const sd of [-1, 1]) {
    const line = crest.slice(1, 22).map((q) => { const side = unit(cross(q.n, [0, 0, 1])); return { p: add(add(q.p, mul(side, sd * 0.06)), mul(q.n, 0.005)), n: q.n }; });
    out.push(band(line, { wide: 0.035, high: 0.015, mat: 'rune', w: wH }));
  }
  // -- an etched vine each side: from beside the moonstone back over the crown's flank and down behind the wing
  for (const sg of [1, -1]) {
    const pts = [[browTh - 0.12, 0.35], [browTh - 0.32, 0.85], [1.05, 1.6], [1.15, 2.2], [1.55, 2.6], [1.95, 2.75]];
    const path = [];
    for (let k = 0; k <= 22; k++) {
      const f = (k / 22) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), g = f - i;
      // (a smooth curve through the points: each span eased)
      const e = g * g * (3 - 2 * g), th = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * e, ph = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * g;
      const q = D.ta(th / PI, sg * ph);
      path.push({ p: add(q.p, mul(q.n, 0.012)), n: q.n });
    }
    out.push(...vine(path, { r: 0.022, k: 3, mat: 'miS', leafMat: 'miS', w: wH, every: 0.28, leafLong: 0.2, leafWide: 0.07, tilt: 0.7 }));
  }
  // -- the moonstone at the brow's dip, in a leaf-shaped setting
  const mq = D.ta((skBot(0) - 0.1) / PI, 0);
  out.push(...leafOn((u, x) => { const q = D.ta((skBot(0) - 0.02 - 0.42 * u) / PI, x / 0.9); return { p: add(q.p, mul(q.n, 0.03)), n: q.n }; }, { wide: 0.16, nu: 6, nv: 4, fold: 0.04, mat: 'miL', rib: null, rim: 'miS', rimR: 0.015, w: wH }));
  out.push(stud(add(mq.p, mul(mq.n, 0.07)), mq.n, { r: 0.11, h: 0.1, k: 6, mat: 'moon', w: wH }));
  // -- the wings: two leaves swept back from each temple, the upper the longer, curving up as they go
  const wingLen = fem ? 1.3 : 1.5;
  for (const sg of [1, -1]) {
    for (const [th, ph, dir, long, wide, bk, face] of [[1.12, 1.15, [0.62, 0.68, -0.38], wingLen, 0.25, 0.6, [0.7, 0.0, 0.7]], [1.4, 1.3, [0.7, 0.28, -0.65], wingLen * 0.7, 0.18, 0.5, [0.75, 0.2, 0.6]]]) {
      const q = D.ta(th / PI, sg * ph);
      const o0 = add(q.p, mul(q.n, -0.02)), d = [sg * dir[0], dir[1], dir[2]];
      out.push(...leafFree(o0, d, [sg * face[0], face[1], face[2]], { long, wide, bend: [-sg * 0.3, 0.3, -1], bendK: bk, twist: sg * 0.2, nu: 8, nv: 4, fold: 0.05, curl: 0.05, cup: 0.03, mat: 'mi', inner: 'mi', edge: 'miS', rib: 'miL', ribR: 0.025, rim: 'miL', rimR: 0.018, w: wH, shape: { peak: 0.3 } }));
    }
  }
  // -- the cheek guards: a leaf from each temple down over the cheek to a point at the jaw, flared off it below
  for (const sg of [1, -1]) {
    const th0 = 1.4, th1 = fem ? 2.2 : 2.28, p0 = 1.3, p1 = 1.05;
    out.push(...leafOn((u, x) => {
      const th = lerp([th0, 0, 0], [th1, 0, 0], u)[0], ph = sg * lerp([p0, 0, 0], [p1, 0, 0], u)[0], R = 1.0 * Math.max(0.4, Math.sin(th));
      const q = D.ta(th / PI, ph - sg * x / R);
      return { p: add(q.p, mul(q.n, 0.05 + 0.05 * u * u)), n: q.n };
    }, { wide: fem ? 0.28 : 0.32, nu: 7, nv: 4, fold: 0.04, mat: 'mi', inner: 'miD', edge: 'miS', rib: 'miL', ribR: 0.02, rim: 'miL', rimR: 0.022, w: wH, shape: { peak: 0.3, base: 0.9 } }));
  }
  // -- the nape: a long leaf down the back of the neck, a shorter at each side of it, lapped over it
  for (const [ph, long, wide, off] of [[PI - 0.55, 0.55, 0.2, 0.03], [PI + 0.55, 0.55, 0.2, 0.03], [PI, 0.75, 0.24, 0.07]]) {
    const q = D.ta((nape - 0.22) / PI, ph), out0 = unit([q.n[0], 0, q.n[2]]);
    out.push(...leafFree(add(q.p, mul(q.n, off)), add([0, -1, 0], mul(out0, 0.5)), out0, { long: long * (fem ? 0.85 : 1), wide, nu: 7, nv: 4, fold: 0.05, curl: 0.06, cup: 0.05, mat: 'mi', inner: 'miS', edge: 'miS', rib: 'miL', ribR: 0.02, rim: 'miL', rimR: 0.018, w: wH, shape: { peak: 0.35, base: 0.6 } }));
  }
  const P = merge(...out);
  // (the head's own polygons under the skull left out)
  const inside = (i) => { const v = sub(B.V[i], c), th = Math.acos(clamp(unit(v)[1], -1, 1)), ph = Math.atan2(v[0], v[2]); return th < skBot(ph) - 0.1; };
  B.A.polys.forEach(([v, m], pi) => { if (m !== 2 && v.every((i) => inside(i))) P.hides.add(pi); });
  return P;
}

/** A profile swept along a path, its profile `prof(k, q)`: a fin. */
function sweep2(path, prof, mat, w) {
  return sweepP(path, { closedProfile: true, profile: prof, mat, w });
}
import { sweep as sweepP } from './platekit.mjs';
void dot; void len; void TAU;

/* ---- chest & arms ------------------------------------------------------------------------------------------------ */
const TORSO_BONES = new Set(['root', 'pelvis', 'spine_01', 'spine_02', 'spine_03']);
const y = (p) => p[1];
/** The cuirass's yoke: where its plates' tops and feet run round the torso (heights at each angle, nought before). */
function yokeOf(B, M) {
  const fem = B.who === 'female';
  const side = PI / 2 + 0.04, aN = 0.72;
  const topF = (a) => { const ax = Math.abs(a), yC = M.neckF + 0.14; if (ax <= aN) return M.neckF + 0.14 * (ax / aN) ** 2; const k = clamp((ax - aN) / (side - aN)); return M.pit + (yC - M.pit) * Math.sqrt(Math.max(0, 1 - k * k)); };
  const bN = 0.6;
  const topB = (a) => { const bx = PI - Math.abs(wrapAngle(a)), yC = M.neckB + 0.1; if (bx <= bN) return M.neckB + 0.1 * (bx / bN) ** 2; const k = clamp((bx - bN) / (PI - side + 0.04 - bN)); return M.pit + (yC - M.pit) * Math.sqrt(Math.max(0, 1 - k * k)); };
  const dipF = fem ? 0.5 : 0.65, yokeF = (a) => M.pit + (fem ? 0.5 : 0.42) - dipF * Math.exp(-((a / 0.3) ** 2)) - 0.1 * Math.cos(a) ** 2;
  const yokeB = (a) => M.pit + (fem ? 0.45 : 0.38) - 0.35 * Math.exp(-((wrapAngle(a - PI) / 0.38) ** 2));
  return { side, topF, topB, yokeF, yokeB };
}
/** The tunic: the torso and the arms to the wrists, a little off the skin, the skin under it left out. */
export function tunic(B) {
  const A = B.at, M = torsoMarks(B), F = torsoField(B), Y = yokeOf(B, M);
  return shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i]; return on(B, i, 'torso', 'shoulder', 'upperarm', 'forearm', 'neck', 'head', 'thigh') > 0.6 && headOnly(B, i) < 0.05 && on(B, i, 'hand') < 0.35 && y(p) > M.hip - 0.25 && on(B, i, 'thigh') < 0.5 && y(p) < A.neck[1] - 0.02; },
    off: ({ p }) => 0.06 + 0.02 * smooth(M.waist, M.hip, y(p)) - 0.025 * smooth(A.neck[1] - 0.6, A.neck[1] - 0.1, y(p)),
    // (none under the yoke's plates nor the belt, where nothing shows)
    mat: ({ p, bv }) => {
      if (on(B, bv, 'torso') < 0.8) return 'sage';
      const yy = y(p), a = Math.atan2(p[0], p[2] - F.zc(yy)), front = Math.abs(a) < 0.9, back = Math.abs(a) > PI - 0.9;
      if (front && yy > Y.yokeF(a) + 0.12 && yy < Y.topF(a) - 0.2) return null;
      if (back && yy > Y.yokeB(a) + 0.12 && yy < Y.topB(a) - 0.2) return null;
      if (yy > M.waist + 0.02 - 0.1 && yy < M.waist + 0.02 + 0.05) return null;
      return 'sage';
    },
  });
}
const headOnly = (B, i) => headOnlyW(B, B.W[i]);

/** The cuirass: a yoke over the breast and the back from the neckline, rows of leaf scales below it to the belt, the belt. */
export function cuirass(B) {
  const A = B.at, M = torsoMarks(B), F = torsoField(B), t = F.tOfY, fem = B.who === 'female', out = [];
  const W = nearSkinW(B, (s) => shareW(B, s.w, 'torso') > 0.7, (n) => TORSO_BONES.has(n), 0.35);
  const { side, topF, topB, yokeF, yokeB } = yokeOf(B, M);
  const bulge = (yy, a) => (fem ? 0.04 : 0.08) * Math.exp(-(((yy - lerp(A.chest, [0, M.waist, 0], 0.35)[1]) / 0.9) ** 2)) * Math.max(0, Math.cos(a)) ** 1.5;
  // (the yoke's foot: a leaf's point down the breastbone before, a shallower one down the spine behind)
  const offY = (u, v, tt, a) => 0.2 + bulge(F.yOfT(tt), a) + 0.04 * (1 - u);
  const front = plateOn(F, { a0: -side, a1: side, t0: (a) => t(yokeF(a)), t1: (a) => t(topF(a)), nu: 8, nv: 22, off: offY });
  const back = plateOn(F, { a0: side - 0.06, a1: 2 * PI - side + 0.06, t0: (a) => t(yokeB(a)), t1: (a) => t(topB(a)), nu: 7, nv: 20, off: (u) => 0.19 + 0.04 * (1 - u) });
  out.push(solid(front, { sheet: true, w: W, mat: () => 'mi' }), solid(back, { sheet: true, w: W, mat: () => 'mi' }));
  for (const [G, nv] of [[front, 22], [back, 20]]) {
    const rows = G.P.length - 1;
    out.push(tube(rowPath(G, rows, 0, nv, 18), { r: 0.05, k: 3, mat: 'miL', w: W }));
    out.push(tube(rowPath(G, 0, 0, nv, 18), { r: 0.045, k: 3, mat: 'miL', w: W }));
    // (a raised band inside each edge)
    out.push(band(rowPath(G, rows - 0.9, 0.5, nv - 0.5, 16), { wide: 0.05, high: 0.02, mat: 'miS', w: W }));
  }
  // (the vine down the breastbone, from the neckline to the yoke's point, lit when enchanted)
  const vPath = [];
  for (let k = 0; k <= 10; k++) { const yy = lerp([0, M.neckF - 0.12, 0], [0, yokeF(0) + 0.14, 0], k / 10)[1], q = F.ta(t(yy), 0.04 * Math.sin(k * 1.3)); vPath.push({ p: add(q.p, mul(q.n, offY(0.5, 0, t(yy), 0) + 0.01)), n: q.n }); }
  out.push(...vine(vPath, { r: 0.028, mat: 'rune', w: W, every: 0.2, leafLong: 0.2, leafWide: 0.07, tilt: -0.9 }));
  // (an etched vine each way along the yoke's foot from its point, curling up toward the shoulder: as the helm's)
  for (const sd of [-1, 1]) {
    const path = [];
    for (let k = 0; k <= 16; k++) {
      const f = k / 16, a = sd * (0.14 + 1.15 * f), yy = Math.min(yokeF(a) + 0.15 + 0.05 * Math.sin(f * 10), topF(a) - 0.12);
      const q = F.ta(t(yy), a);
      path.push({ p: add(q.p, mul(q.n, offY(0.3, 0, t(yy), a) + 0.03)), n: q.n });
    }
    out.push(...vine(path, { r: 0.024, k: 3, mat: 'miL', w: W, every: 0.3, leafLong: 0.19, leafWide: 0.06, tilt: 0.6 }));
  }
  // -- the scales: rows of leaves from under the yoke to the belt, each row's set half a leaf round from the last, their
  // tips out over the row below
  const belt = M.waist + 0.02, span = Math.max(yokeF(PI / 2), yokeB(PI / 2)) + 0.05 - belt, nRow = Math.round(span / 0.3), rowH = span / (nRow - 0.3);
  const nAround = fem ? 18 : 20, step = TAU / nAround, Lg = rowH * 1.75;
  const rAt = (yy, a) => { const q = F.ta(t(yy), a).p; return Math.hypot(q[0], q[2] - F.zc(yy)); };
  for (let r = 0; r < nRow; r++) {
    const yTip = belt + rowH * r - 0.04, yTop = yTip + Lg;
    for (let k = 0; k < nAround; k++) {
      const a0 = wrapAngle(k * step + (r % 2) * step / 2);
      const yokeAt = Math.abs(a0) < PI / 2 + 0.1 ? yokeF(a0) : yokeB(a0);
      if (yTip > yokeAt - 0.12) continue;
      const top = Math.min(yTop, yokeAt + 0.05), L = top - yTip;
      if (L < rowH * 0.9) continue;
      // (under the arms, nearer the body)
      const pit = Math.exp(-(((Math.abs(a0) - PI / 2) / 0.35) ** 2));
      const surf = (u, x) => { const yy = top - u * L, q = F.ta(t(yy), a0 + x / rAt(yy, a0)); return { p: add(q.p, mul(q.n, 0.13 - 0.03 * pit + bulge(yy, a0) * 0.8 + (0.08 + 0.025 * r / nRow) * u)), n: q.n }; };
      out.push(...leafOn(surf, { wide: step * rAt(yTip + L / 2, a0) * 0.62, nu: 3, nv: 2, fold: 0.04, mat: (i, j) => (i < 1 ? 'miS' : i < 2 && j === 1 ? 'miS' : j === 0 ? 'mi' : 'miB'), rib: null, rim: null, w: W, shape: { peak: 0.42, base: 0.55, sharp: 0.7 } }));
    }
  }
  // -- the belt: a band of dark leather round the waist, silver leaves set along it, a leaf clasp before
  const bg = plateOn(F, { a0: -PI, a1: PI, closed: true, t0: () => t(belt - 0.16), t1: () => t(belt + 0.1), nu: 2, nv: 40, off: (u, v, tt, a) => 0.27 + bulge(F.yOfT(tt), a) * 0.5 });
  out.push(solid(bg, { hollow: true, w: W, thick: 0.05, mat: () => 'leatherD', edge: 'leatherD' }));
  out.push(tube(rowPath(bg, 0, 0, 40, 24), { r: 0.025, k: 3, mat: 'miS', w: W, closed: true }), tube(rowPath(bg, 2, 0, 40, 24), { r: 0.025, k: 3, mat: 'miS', w: W, closed: true }));
  for (let k = 1; k < 10; k++) {
    const j = k * 4, q = bg.at(1, j), dir = unit(sub(bg.at(1, j + 1).p, q.p));
    out.push(...leafFree(add(q.p, mul(q.n, 0.03)), dir, q.n, { long: 0.26, wide: 0.07, nu: 4, nv: 2, fold: 0.02, mat: 'mi', rib: null, rim: null, w: W }));
  }
  // (the clasp: two leaves crossed over a silver boss)
  const cq = bg.at(1, 0);
  for (const sd of [-1, 1]) out.push(...leafFree(add(cq.p, mul(cq.n, 0.05)), [sd * 0.8, -0.6, 0], cq.n, { long: 0.42, wide: 0.12, nu: 6, nv: 2, fold: 0.04, curl: 0.03, mat: 'mi', rib: 'miL', ribR: 0.018, rim: 'miL', rimR: 0.014, w: W }));
  out.push(stud(add(cq.p, mul(cq.n, 0.05)), cq.n, { r: 0.1, h: 0.08, k: 6, mat: 'miL', w: W }));
  // -- the tassets: long leaves hung from the belt over each thigh, fore, out and behind, swinging with it
  for (const sg of [1, -1]) {
    const s = sg > 0 ? 'l' : 'r', hp = A.hip[s], kn = A.knee[s];
    const pick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'thigh', 'torso') > 0.9 && q.p[1] < hp[1] + 0.6;
    const TH = limbWrap(B, hp, kn, sg, { t: [-0.2, 0.75], nt: 19, a: [-PI, PI], closed: true, na: 32, pick, smooth: 4, shape: (r) => r });
    const wT = skinW(B, (q) => q.p[0] * sg > 0.12 && shareW(B, q.w, 'thigh') > 0.6 && along(q.p, hp, kn) > 0.25 && along(q.p, hp, kn) < 0.8, (n) => n.endsWith(`_${s}`)), wP = boneW(B, 'pelvis');
    const tTop = along([hp[0], belt - 0.05, hp[2]], hp, kn), tBot = fem ? 0.5 : 0.55;
    const w = (p) => { const f = clamp((along(p, hp, kn) - tTop) / (tBot - tTop)); return mixW([[wP, 0.6 - 0.6 * f], [wT, 0.4 + 0.6 * f]]); };
    // (a skirt of sage cloth cut in leaves, edged in silver, and a silver leaf over each, shorter)
    for (const [a, long] of [[0.15, 1], [0.95, 0.94], [1.75, 0.88], [2.55, 0.82]]) {
      const tB = tTop + (tBot - tTop) * long, rr = 0.6;
      const surf = (lay) => (u, x) => { const tt = lerp([tTop, 0, 0], [tB, 0, 0], u)[0], q = TH.ta(tt, a + x / rr); return { p: add(q.p, mul(q.n, 0.3 - 0.07 * Math.sin(Math.min(PI, a)) + lay + 0.08 * u)), n: q.n }; };
      out.push(...leafOn(surf(0), { wide: 0.4, nu: 6, nv: 2, fold: 0.04, curl: 0.03, mat: 'green', rib: null, rim: 'miL', rimR: 0.016, rimSteps: 6, w, shape: { peak: 0.3, base: 0.85, sharp: 0.6 } }));
      const short = (u, x) => surf(0.05)(u * 0.62, x);
      out.push(...leafOn(short, { wide: 0.24, nu: 5, nv: 2, fold: 0.05, curl: 0.02, mat: 'mi', rib: 'miL', ribR: 0.018, ribSteps: 3, rim: null, w, shape: { peak: 0.35, base: 0.8 } }));
    }
  }
  return out;
}

/** One arm: folded-leaf pauldron, an armband, the elbow's leaf, the bracer and the leaf over the hand. */
export function armLeaves(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, sh = A.shoulder[s], el = A.elbow[s], wr = A.wrist[s], fem = B.who === 'female', out = [];
  const armB = (n) => n.endsWith(`_${s}`);
  // -- the pauldron: a broad leaf over the shoulder's ball (its rib from the shoulder's top over the ball's outside and
  // down, its halves wrapped round the front and the back), then two leaves down the upper arm's outside, each lapped
  // under the one above
  const cc = add(sh, [-sg * 0.08, -0.05, 0]), outA = [sg, 0, 0], upA = [0, 1, 0], zA = [0, 0, 1];
  const shPick = (q) => q.p[0] * sg > sh[0] * sg - 0.45 && shareW(B, q.w, 'shoulder', 'upperarm', 'torso') > 0.8 && shareW(B, q.w, 'neck', 'head') < 0.05 && len(sub(q.p, cc)) < 1.05;
  const SD = domeWrap(B, { c: cc, u: outA, f: zA, s: upA, pick: shPick, rows: 16, cols: 32, thMax: 1.7, cone: 0.32, smooth: 4, shape: (r) => Math.max(r, fem ? 0.5 : 0.58) });
  const onDome = (d) => { const th = Math.acos(clamp(dot(d, outA), -1, 1)), ph = Math.atan2(dot(d, upA), dot(d, zA)); return SD.ta(th / 1.7, ph); };
  const wTop = mixOf(B, [[`shoulder_${s}`, 0.45], [`clavicle_${s}`, 0.35], [`upperarm_${s}`, 0.2]]), wArm = mixOf(B, [[`shoulder_${s}`, 0.35], [`upperarm_${s}`, 0.55], [`clavicle_${s}`, 0.1]]);
  const wSh = (p) => mixW([[wTop, 1 - smooth(sh[1] + 0.1, sh[1] - 0.7, p[1])], [wArm, smooth(sh[1] + 0.1, sh[1] - 0.7, p[1])]]);
  // (three leaves fanned over the ball: the middle the broadest and on top, one over its front and one over its back
  // under it, shorter)
  const capAt = (psi, s0, s1, clear) => (u, x) => {
    const sgm = s0 + (s1 - s0) * u, o2 = add(mul(outA, Math.cos(psi)), mul(zA, Math.sin(psi))), z2 = sub(mul(zA, Math.cos(psi)), mul(outA, Math.sin(psi)));
    const b = add(mul(o2, Math.cos(sgm)), mul(upA, -Math.sin(sgm))), Rr = 0.7;
    const d = unit(add(mul(b, Math.cos(x / Rr)), mul(z2, Math.sin(x / Rr)))), q = onDome(d);
    return { p: add(q.p, mul(q.n, clear + 0.05 * u)), n: q.n };
  };
  const cl = fem ? 0.1 : 0.12;
  for (const [psi, s0, s1, clear, wide, mat] of [[0.78, -0.75, 0.75, cl - 0.02, 0.4, 'miM'], [-0.78, -0.75, 0.75, cl - 0.02, 0.4, 'miM'], [0, -1.1, 0.98, cl + 0.04, 0.5, 'mi']]) {
    out.push(...leafOn(capAt(psi, s0, s1, clear), { wide: wide * (fem ? 0.88 : 1), nu: 11, nv: 4, fold: 0.06, curl: 0.12, curlFrom: 0.7, mat, rib: 'miL', ribR: 0.026, ribFrom: 0.03, ribTo: 0.93, ribSteps: 5, rim: 'miL', rimR: 0.02, rimSteps: 7, w: wSh, shape: { peak: 0.42, base: 0.35, sharp: 0.7 } }));
  }
  // (an etched vein each side of the rib)
  const upPick = (q) => (s === 'l' ? q.p[0] > 0.15 : q.p[0] < -0.15) && shareW(B, q.w, 'upperarm', 'shoulder') > 0.6;
  const UA = limbWrap(B, sh, el, sg, { t: [0.0, 0.95], nt: 16, a: [-PI, PI], closed: true, na: 20, pick: upPick, smooth: 3, shape: (r) => r });
  const wUp = skinW(B, (q) => upPick(q) && along(q.p, sh, el) > 0.4 && along(q.p, sh, el) < 0.8, armB);
  const rUA = len(sub(UA.ta(0.5, PI / 2).p, lerp(sh, el, 0.5)));
  for (const [k, t0, t1, off, wide] of [[0, 0.2, 0.58, 0.16, 0.36], [1, 0.36, 0.72, 0.1, 0.3]]) {
    const w = k === 0 ? (p) => mixW([[wArm, 0.5], [wUp, 0.5]]) : () => wUp;
    out.push(...leafOn((u, x) => { const q = UA.ta(lerp([t0, 0, 0], [t1, 0, 0], u)[0], PI / 2 + x / (rUA + off)); return { p: add(q.p, mul(q.n, off + 0.05 * u)), n: q.n }; },
      { wide: wide * (fem ? 0.9 : 1), nu: 6, nv: 2, fold: 0.05, curl: 0.05, mat: 'miM', inner: 'miS', edge: 'miS', rib: 'miL', ribR: 0.02, rim: 'miL', rimR: 0.018, w, shape: { peak: 0.35, base: 0.6 } }));
  }
  // -- the upper arm's band: two silver rings below the pauldron
  for (const tt of [0.78, 0.85]) out.push(tube(rowPath({ at: (i, j) => UA.ta(tt, -PI + (TAU * j) / 14) }, 0, 0, 14, 14).map((q) => ({ p: add(q.p, mul(q.n, 0.07)), n: q.n })), { r: 0.03, k: 3, mat: 'miL', w: () => wUp, closed: true }));
  // -- the elbow: a leaf over its point, down the back of the forearm
  const ec = lerp(el, sh, 0.1), back = unit([0, -0.1, -1]);
  out.push(...leafFree(add(ec, mul(back, fem ? 0.32 : 0.38)), unit(sub(wr, el)), back, { long: fem ? 0.75 : 0.85, wide: 0.22, nu: 7, nv: 4, fold: 0.06, curl: 0.06, cup: 0.08, mat: 'mi', inner: 'miS', edge: 'miS', rib: 'miL', ribR: 0.02, rim: 'miL', rimR: 0.018, rimSteps: 7, w: () => boneW(B, `elbow_${s}`), shape: { peak: 0.3, base: 0.4 } }));
  // -- the bracer: round the forearm, drawn to a leaf's point toward the elbow on the outside, flared at the wrist
  const faPick = (q) => (s === 'l' ? q.p[0] > 0.15 : q.p[0] < -0.15) && shareW(B, q.w, 'forearm') > 0.6;
  const FA = limbWrap(B, el, wr, sg, { t: [0, 1.0], nt: 14, a: [-PI, PI], closed: true, na: 24, pick: faPick, smooth: 3, shape: (r) => r });
  const wFa = skinW(B, (q) => faPick(q) && along(q.p, el, wr) > 0.3 && along(q.p, el, wr) < 0.85, armB);
  const pt = (a) => Math.exp(-((wrapAngle(a - PI / 2) / 0.5) ** 2));
  const NV = 24;
  const br = plateOn(FA, { a0: -PI, a1: PI, closed: true, t0: (a) => 0.36 - 0.24 * pt(a), t1: () => 0.9, nu: 6, nv: NV, off: (u) => 0.09 + 0.02 * Math.sin(PI * u) + 0.06 * smooth(0.7, 1, u) });
  out.push(solid(br, { sheet: true, w: () => wFa, mat: () => 'mi' }));
  out.push(tube(rowPath(br, 0, 0, NV, NV), { r: 0.035, k: 3, mat: 'miL', w: () => wFa, closed: true }));
  out.push(tube(rowPath(br, 6, 0, NV, 16), { r: 0.035, k: 3, mat: 'miL', w: () => wFa, closed: true }));
  // (a leaf in relief down its outside)
  out.push(...leafOn((u, x) => { const q = FA.ta(lerp([0.3, 0, 0], [0.84, 0, 0], u)[0], PI / 2 + x / 0.42); return { p: add(q.p, mul(q.n, 0.13)), n: q.n }; }, { wide: 0.12, nu: 6, nv: 2, fold: 0.03, mat: 'miL', rib: 'miS', ribR: 0.012, rim: null, w: () => wFa }));
  // -- the leaf over the back of the hand, from the bracer's foot
  const hq = FA.ta(0.9, PI / 2), hd = unit(sub(wr, el));
  out.push(...leafFree(add(hq.p, mul(hq.n, 0.13)), add(hd, mul(hq.n, 0.12)), hq.n, { long: fem ? 0.42 : 0.48, wide: 0.16, nu: 6, nv: 4, fold: 0.04, curl: 0.04, cup: 0.04, mat: 'mi', rib: 'miL', ribR: 0.016, rim: 'miL', rimR: 0.016, w: () => boneW(B, `hand_${s}`), shape: { peak: 0.4, base: 0.6 } }));
  return out;
}

/** The chest piece's parts, before they are put together. */
const CHEST = new WeakMap();
function mithrilChestParts(B) {
  if (!CHEST.has(B)) CHEST.set(B, [smoothWeights(tunic(B), 2, (p) => p[1] < B.at.neck[1] - 0.6), ...cuirass(B), ...armLeaves(B, 'l'), ...armLeaves(B, 'r')]);
  return CHEST.get(B);
}
export function mithrilChest(B) {
  return coverHides(B, merge(...mithrilChestParts(B)), 0.5);
}

/* ---- the mantle -------------------------------------------------------------------------------------------------- */
/**
 * The mantle: a collar of silver leaves standing round the back and the sides of the neck and flaring out; below it
 * leaves cascading in tiers over the upper chest and down the back; a moon-and-leaf brooch at the throat; under the
 * back's leaves a long grey-green cloak lined in moonlight white, split up the back into two tails, each cut and veined
 * as a great leaf (its midrib lit when enchanted) and swinging with its thigh, its edge embroidered with a silver vine.
 */
export function mithrilMantle(B) {
  const A = B.at, M = torsoMarks(B), F = torsoField(B), t = F.tOfY, fem = B.who === 'female', out = [];
  const n = A.neck[1];
  const wNeck = mixOf(B, [['neck_01', 0.5], ['spine_03', 0.5]]);
  const pick = (q) => shareW(B, q.w, 'torso', 'neck', 'head') > 0.85 && headOnlyW(B, q.w) < 0.2 && q.p[1] > M.pit - 0.2 && Math.abs(q.p[0]) < 1.25;
  const W = nearSkinW(B, pick, (nm) => ['spine_03', 'spine_02', 'neck_01', 'clavicle_l', 'clavicle_r'].includes(nm), 0.35);
  const rAt = (yy, a) => { const q = F.ta(t(yy), a).p; return Math.hypot(q[0], q[2] - F.zc(yy)); };
  const leafSet = { nv: 2, fold: 0.05, rib: 'miL', ribR: 0.022, ribSteps: 3, rim: null };
  // -- the collar: two rings of leaves radiating from the neck's foot over the shoulders' slope, the breast and the back,
  // the upper ring shorter and set between the lower's; the brooch over their meeting at the throat
  const yC = n - (fem ? 0.14 : 0.18);
  for (const [ring, count, long, wide, lift, off] of [[0, 12, fem ? 0.9 : 1.02, fem ? 0.3 : 0.34, 0, 0.2], [1, 12, fem ? 0.62 : 0.7, fem ? 0.25 : 0.28, 0.09, 0.25]]) {
    for (let k = 0; k < count; k++) {
      const a = wrapAngle(((k + 0.5 * ring) * TAU) / count);
      if (Math.abs(a) < 0.3) continue;
      const q = F.ta(t(yC), a), hn = unit([q.n[0], 0, q.n[2]]);
      // (steeper over the breast and the back than over the shoulders' slope)
      const side = Math.abs(Math.sin(a)), beta = 0.55 - 0.25 * side - 0.12 * ring;
      const dir = add(mul(hn, Math.cos(beta)), [0, -Math.sin(beta), 0]), face = add(mul(hn, Math.sin(beta)), [0, Math.cos(beta), 0]);
      // (each kept short of the pauldrons: its tip no further out than the shoulder's joint)
      const o0 = add(add(q.p, mul(hn, off + 0.14 * Math.max(0, -Math.cos(a)))), [0, lift, 0]), xLim = A.shoulder.l[0] - 0.15 - Math.abs(o0[0]), L = Math.min(long * (1 - 0.2 * side), Math.abs(dir[0]) > 0.2 ? xLim / Math.abs(dir[0]) : 9);
      out.push(...leafFree(o0, dir, face, { ...leafSet, long: L, wide, bend: mul(face, -1), bendK: 0.35, nu: 5, curl: 0.1, cup: 0.09, mat: ring ? (Math.abs(a) < PI / 2 ? 'miB' : 'mi') : 'miM', inner: 'miS', edge: 'miS', w: W, shape: { peak: 0.42, base: 0.35, sharp: 0.7 } }));
    }
  }
  // -- the cowl: a roll of sage cloth round the back and the sides of the neck, under the leaves, its edge embroidered
  out.push(...cowl(B, F, t, n, fem, W));
  // -- the back: a row of long leaves cascading from under the collar down over the cloak's top
  const yB = n - (fem ? 0.5 : 0.6);
  [[PI - 0.6, 1.2], [PI + 0.6, 1.2], [PI - 0.2, 1.35], [PI + 0.2, 1.35]].forEach(([a, long], k) => {
    const L = long * (fem ? 0.85 : 1), lay = 0.4 + 0.04 * (k % 2);
    const surf = (u, x) => { const yy = yB - u * L, q = F.ta(t(yy), a + x / Math.max(0.4, rAt(yy, a))); return { p: add(q.p, mul(q.n, lay + 0.07 * u)), n: q.n }; };
    out.push(...leafOn(surf, { ...leafSet, wide: 0.26, nu: 5, curl: 0.07, mat: k % 2 ? 'mi' : 'miM', w: W, shape: { peak: 0.38, base: 0.45 } }));
  });
  // -- the brooch at the throat: a crescent moon cradling a moonstone, over three leaves fanned down from it
  const bq = F.ta(t(M.neckF + 0.1), 0), bo = unit(add(bq.n, [0, 0.3, 0])), bc = add(bq.p, mul(bq.n, 0.4));
  const bx = unit(cross([0, 1, 0], bo)), by = cross(bo, bx), wB = W(bc);
  for (const [sd, long] of [[-1, 0.62], [1, 0.62], [0, 0.72]]) out.push(...leafFree(add(bc, mul(bo, -0.02)), add(mul(bx, sd * 0.6), mul(by, -0.8)), bo, { ...leafSet, long: long * (fem ? 0.85 : 1), wide: 0.15, nu: 6, nv: 2, curl: 0.04, mat: sd ? 'mi' : 'miB', inner: 'miS', edge: 'miS', w: () => wB, shape: { peak: 0.4, base: 0.5 } }));
  const cres = [], cR = fem ? 0.27 : 0.31;
  for (let k = 0; k <= 14; k++) {
    // (a crescent: thickest at its middle below, its horns drawn to points above)
    const g = -PI * 0.82 + (PI * 1.64 * k) / 14;
    cres.push({ p: add(add(bc, mul(bo, 0.09)), add(mul(bx, Math.sin(g) * cR), mul(by, -Math.cos(g) * cR))), n: bo, th: 0.1 * Math.max(0.12, Math.cos(g / 1.7)) });
  }
  out.push(sweepP(cres, { closedProfile: true, mat: 'moon', w: () => wB, profile: (k, q) => [[-q.th, -0.04], [q.th, -0.04], [q.th * 0.6, 0.05], [-q.th * 0.6, 0.05]] }));
  // (the moonstone in its cradle, on a bright setting)
  out.push(stud(add(bc, mul(bo, 0.04)), bo, { r: 0.15, h: 0.05, k: 6, mat: 'miL', w: () => wB }), stud(add(bc, mul(bo, 0.08)), bo, { r: 0.1, h: 0.09, k: 6, mat: 'moon', w: () => wB }));
  out.push(...cloakOf(B, M));
  return coverHides(B, merge(...out), 0.6);
}

/** The mantle's cowl (see mithrilMantle): a soft roll round the neck, open at the throat. */
function cowl(B, F, t, n, fem, W) {
  const out = [], open = 0.95, NU = 5, NV = 24;
  const y0 = (a) => n - (fem ? 0.5 : 0.55) + 0.36 * Math.sin(a) ** 2, y1 = (a) => n - 0.03 - 0.12 * Math.cos(a / 2) ** 2;
  const G = patch((u, v) => {
    const a = open + (2 * PI - 2 * open) * v, yy = y0(a) + (y1(a) - y0(a)) * u, q = F.ta(t(yy), a);
    const hn = unit([q.n[0], 0, q.n[2]]);
    // (rolled: out most at its middle, and a soft fold every so often round it)
    const off = 0.1 - 0.04 * Math.sin(a) ** 2 + (0.12 - 0.06 * Math.sin(a) ** 2) * Math.sin(PI * Math.min(1, u * 1.15)) + 0.025 * Math.cos(a * 7) * u;
    return { p: add(q.p, mul(hn, off)), n: hn };
  }, NU, NV);
  out.push(solid(G, { sheet: true, w: W, thick: 0.03, mat: (i, j) => ((j % 6) === 0 ? 'sageD' : 'sage'), inner: 'white', edge: 'white' }));
  out.push(...vine(rowPath(G, NU, 0, NV, NV, 0.01), { r: 0.02, k: 3, mat: 'miL', w: W, every: 0.4, leafLong: 0.17, leafWide: 0.055, tilt: 0.6 }));
  return out;
}

/** The cloak under the mantle's leaves behind, split up the back into two leaf-cut tails (see mithrilMantle). */
function cloakOf(B, M) {
  const A = B.at, fem = B.who === 'female', out = [], n = A.neck[1];
  // (the shape it hangs over: the chest piece's and the skin's points behind, from the shoulder blades to the knee)
  const chest = mithrilChestParts(B), pts = [];
  const armW = (w) => w.some(([b, x]) => x > 0.25 && /(upperarm|lowerarm|elbow|hand|wrist|shoulder_)/.test(B.bones[b].name));
  for (const P of chest) P.V.forEach((p, i) => { if (!armW(P.W[i]) && p[2] < 0.6) pts.push(p); });
  for (const q of skinSamples(B)) if (shareW(B, q.w, 'torso', 'thigh') > 0.8 && headOnlyW(B, q.w) < 0.1 && shareW(B, q.w, 'upperarm', 'shoulder', 'forearm', 'hand') < 0.05) pts.push(q.p);
  const zc = torsoMiddle(B, (q) => shareW(B, q.w, 'torso', 'neck', 'head') > 0.8 && headOnlyW(B, q.w) < 0.15);
  const yTail = lerp(A.hip.l, A.knee.l, fem ? 0.78 : 0.76)[1], cy0 = yTail - 0.3, cy1 = n + 0.2, ct = (yy) => (yy - cy0) / (cy1 - cy0);
  const C = torsoWrap(B, cy0, cy1, zc, {
    points: pts, nt: 60, na: 64, closed: true, a: [-PI, PI], smooth: 3, minDa: 0.1, empty: 0.3,
    post: (R) => { for (let j = 0; j < R[0].length; j++) for (let i = R.length - 2; i >= 0; i--) R[i][j] = Math.max(R[i][j], R[i + 1][j]); },
    shape: (r, tt) => r + 0.12 + 0.12 * smooth(ct(M.waist), ct(M.hip - 0.3), tt) + 0.2 * smooth(ct(M.hip), ct(yTail), tt),
  });
  // (its top under the back's leaves; its sides out to the back of the hips; each tail a leaf: its point at `dt` round
  // from the middle, its inner edge up the split to the apex, its outer edge up to the hips)
  const yTop = n - (fem ? 0.45 : 0.55), half = fem ? 1.04 : 1.02, topHalf = 0.75;
  const apex = M.waist + (fem ? 0.05 : 0), yOuter = M.hip + (fem ? 0.05 : 0.1), dn = 0.26, dt = 0.48;
  const leafEdge = (f) => Math.sin((PI / 2) * clamp(f)) ** 1.3;
  const bot = (a) => {
    const d = Math.abs(wrapAngle(a - PI));
    if (d < dt) return yTail + (apex - yTail) * (1 - leafEdge(d / dt)) ** 0.9 * (d < dn ? 1 : 1);
    return yTail + (yOuter - yTail) * (1 - leafEdge((half - d) / (half - dt))) ** 0.9;
  };
  const NU = 22, NV = 26;
  const cape = patch((u, v) => {
    const a0 = PI + (-1 + 2 * v) * half, d = wrapAngle(a0 - PI);
    const yb = bot(a0), yy = yb + (yTop - yb) * u, widen = smooth(M.waist + 0.3, M.hip, yy);
    const a = PI + d * (topHalf / half + (1 - topHalf / half) * widen);
    // (folds down the cloth, deeper as they fall)
    const fold = 0.11 * (0.5 - 0.5 * Math.cos(d * 10)) * smooth(yTop - 0.3, M.hip, yy);
    const q = C.ta(ct(yy), a), edge = 0.1 * smooth(0.7, 1, Math.abs(d) / half) * widen;
    return { p: add(q.p, mul(q.n, fold - edge)), n: q.n };
  }, NU, NV);
  // (weights: the back above, the pelvis at the hips, each tail its thigh below)
  const Wt = nearSkinW(B, (q) => shareW(B, q.w, 'torso') > 0.8 && q.p[2] < 0.4, (nm) => ['spine_03', 'spine_02', 'spine_01', 'pelvis', 'clavicle_l', 'clavicle_r'].includes(nm), 0.35);
  const thOf = (s) => skinW(B, (q) => q.p[0] * (s === 'l' ? 1 : -1) > 0.12 && shareW(B, q.w, 'thigh') > 0.6 && along(q.p, A.hip[s], A.knee[s]) > 0.25 && along(q.p, A.hip[s], A.knee[s]) < 0.8, (nm) => nm.endsWith(`_${s}`));
  const thW = { l: thOf('l'), r: thOf('r') }, wP = boneW(B, 'pelvis');
  // (the back's weights blended by height down the spine's bones, so the cloth bends evenly as the body twists)
  const anchors = [[A.chest[1], 'spine_03'], [A.spine2[1], 'spine_02'], [A.spine1[1], 'spine_01'], [Math.min(A.pelvis[1], A.spine1[1] - 1.0), 'pelvis']];
  const spineW = (yy) => {
    if (yy >= anchors[0][0]) return boneW(B, anchors[0][1]);
    for (let k = 0; k < anchors.length - 1; k++) { const [y0, b0] = anchors[k], [y1, b1] = anchors[k + 1]; if (yy >= y1) { const f = smooth(y0, y1, yy); return mixW([[boneW(B, b0), 1 - f], [boneW(B, b1), f]]); } }
    return boneW(B, 'pelvis');
  };
  const wCl = (p) => {
    const f = smooth(M.hip, yTail, p[1]), g = smooth(M.waist + 0.4, M.hip, p[1]);
    const up = spineW(p[1]), side = p[0] >= 0 ? thW.l : thW.r; void g;
    return mixW([[up, 1 - f * 0.6], [side, f * 0.6]]);
  };
  // (the cloth, a little stiff: its weights smoothed so a fold bends evenly)
  const capeP = smoothWeights(solid(cape, { hollow: true, w: wCl, thick: 0.03, mat: () => 'cloak', edge: 'white' }), 7, (p) => Math.abs(p[0]) > 0.15 || p[1] > M.hip);
  out.push(capeP);
  const onCape = (p) => capeP.W[nearestOf(capeP.V, p)];
  // (a trim on the cloth weighted as the cloth is at its path's nearest point, so each ring of it moves as one)
  const alongCape = (path) => { const P = path.map((q) => q.p), Wp = P.map(onCape); return (p) => Wp[nearestOf(P, p)]; };
  const hemPath = rowPath(cape, 0, 0, NV, NV * 2, 0.02);
  // (the edge embroidered: a silver vine along the hem and up the split; the sides bound in silver)
  out.push(...vine(hemPath, { r: 0.026, k: 3, mat: 'miL', w: alongCape(hemPath), every: 0.5, leafLong: 0.22, leafWide: 0.07, tilt: 0.5 }));
  for (const j of [0, NV]) { const side = colPath(cape, j, 0, NU, NU, 0.01); out.push(tube(side, { r: 0.025, k: 3, mat: 'miL', w: alongCape(side) })); }
  // (each tail veined as a leaf: its midrib from under the leaves to its point, lit when enchanted, and veins off it)
  const at = (yy, d) => { const a0 = PI + d, yb = bot(a0), u = clamp((yy - yb) / (yTop - yb)); return cape.at(u * NU, (0.5 + d / (2 * half)) * NV); };
  for (const sd of [-1, 1]) {
    const rib = [], y0 = M.pit - 0.2, y1 = yTail + 0.12, dd = (yy) => sd * (dt * (0.55 + 0.45 * smooth(y0, M.waist, yy)));
    for (let k = 0; k <= 22; k++) { const yy = lerp([0, y0, 0], [0, y1, 0], k / 22)[1], q = at(yy, dd(yy)); rib.push({ p: add(q.p, mul(q.n, 0.03)), n: q.n }); }
    out.push(band(rib, { wide: 0.06, high: 0.02, mat: 'rune', w: alongCape(rib) }));
    for (let k = 1; k <= 3; k++) {
      const yy = lerp([0, M.waist - 0.1, 0], [0, y1 + 0.5, 0], (k - 1) / 2)[1];
      for (const side of [-1, 1]) {
        const vein = [];
        for (let m = 0; m <= 4; m++) { const f = m / 4, q = at(yy + f * 0.55, dd(yy) + side * f * 0.32); vein.push({ p: add(q.p, mul(q.n, 0.03)), n: q.n }); }
        out.push(band(vein, { wide: 0.035, high: 0.015, mat: 'miL', w: alongCape(vein) }));
      }
    }
  }
  return out;
}

/* ---- legs -------------------------------------------------------------------------------------------------------- */
const thighW = (B, s) => { const hp = B.at.hip[s], kn = B.at.knee[s], sg = s === 'l' ? 1 : -1; return skinW(B, (q) => q.p[0] * sg > 0.12 && shareW(B, q.w, 'thigh') > 0.6 && along(q.p, hp, kn) > 0.25 && along(q.p, hp, kn) < 0.8, (n) => n.endsWith(`_${s}`)); };
/** The hose: the hips and the legs to the ankles, close over the skin, the skin under it left out; its waist (`hoseW`) left out under a chest piece. */
function hose(B) {
  const A = B.at, M = torsoMarks(B);
  return shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'thigh', 'calf', 'torso') > 0.6 && on(B, i, 'foot') < 0.5 && on(B, i, 'upperarm', 'forearm', 'hand', 'shoulder') < 0.05 && y(p) < M.waist + 0.25 && y(p) > A.knee[s][1] - 0.75; },
    off: ({ p }) => 0.04 + 0.03 * smooth(M.hip - 0.2, M.hip + 0.3, y(p)),
    mat: ({ p }) => (y(p) > M.hip + 0.05 ? 'hoseW' : 'hose'),
  });
}
/**
 * One leg: a great leaf down the front of the thigh (its midrib lit when enchanted, its veins etched), a narrower one
 * lapped under it down the outside; over the knee a leaf drawn to a point above and below, a swept leaf off its outside.
 */
function legLeaves(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, hp = A.hip[s], kn = A.knee[s], an = A.ankle[s], fem = B.who === 'female', out = [];
  const thPick = (q) => (sg > 0 ? q.p[0] > 0.12 : q.p[0] < -0.12) && shareW(B, q.w, 'thigh') > 0.6;
  const TH = limbWrap(B, hp, kn, sg, { t: [0, 1.05], nt: 21, a: [-PI, PI], closed: true, na: 28, pick: thPick, smooth: 4, shape: (r) => r });
  const wTh = thighW(B, s);
  const rT = (tt, a) => len(sub(TH.ta(tt, a).p, lerp(hp, kn, tt)));
  // -- the thigh's leaves: each laid from its stalk above to its point at the knee, round the thigh by its width
  const thighLeaf = (ac, t0, t1, off, wide, mat, rib, nu) => leafOn((u, x) => {
    const tt = t0 + (t1 - t0) * u, q = TH.ta(tt, ac + (sg * x) / Math.max(0.3, rT(tt, ac) + off));
    return { p: add(q.p, mul(q.n, off + 0.03 * Math.sin(PI * u))), n: q.n };
  }, { wide, nu, nv: 4, fold: 0.07, curl: 0.03, curlFrom: 0.8, mat, inner: 'miS', edge: 'miS', rib, ribR: 0.032, ribFrom: 0.06, ribTo: 0.9, ribSteps: 8, rim: 'miL', rimR: 0.022, rimSteps: nu, w: () => wTh, shape: { peak: 0.42, base: 0.3, sharp: 0.75 } });
  // (the outer, under: down the outside of the thigh, shorter)
  out.push(...thighLeaf(1.4, 0.42, 0.88, 0.1, fem ? 0.32 : 0.36, 'miM', 'miL', 7));
  const big = thighLeaf(0.42, 0.36, 0.96, 0.15, fem ? 0.5 : 0.58, 'mi', 'rune', 8);
  out.push(...big);
  // (its veins etched off the midrib, toward the stalk as on a leaf)
  for (const u0 of [0.4, 0.57, 0.74]) for (const sd of [-1, 1]) {
    const path = [0, 1, 2, 3].map((k) => { const f = k / 3, q = big.at(u0 - 0.13 * f, sd * (0.08 + 0.72 * f)); return { p: add(q.p, mul(q.n, 0.005)), n: q.n }; });
    out.push(band(path, { wide: 0.03, high: 0.012, mat: 'miS', w: () => wTh }));
  }
  // -- a silver vine embroidered on the hose: from under the outer leaf round the back of the thigh to the knee's inside
  const wV = nearSkinW(B, (q) => (sg > 0 ? q.p[0] > 0.05 : q.p[0] < -0.05) && shareW(B, q.w, 'thigh', 'calf') > 0.7, (n) => n.endsWith(`_${s}`), 0.3);
  const vp = [];
  for (let k = 0; k <= 18; k++) { const f = k / 18, tt = 0.5 + 0.42 * f, a = 1.75 + 2.6 * f + 0.12 * Math.sin(f * 9), q = TH.ta(tt, a); vp.push({ p: add(q.p, mul(q.n, 0.05)), n: q.n }); }
  out.push(...vine(vp, { r: 0.022, k: 3, mat: 'miL', w: wV, every: 0.36, leafLong: 0.19, leafWide: 0.065, tilt: 0.6 }));
  const cPick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'calf') > 0.6;
  const SH = limbWrap(B, kn, an, sg, { t: [0, 1.04], nt: 20, a: [-PI, PI], closed: true, na: 24, pick: cPick, smooth: 4, shape: (r) => r });
  // (the hose's foot: a sleeve round the calf over the hose's end, its own clean edge above the ankle, corded in silver)
  const wSl = nearSkinW(B, (q) => (sg > 0 ? q.p[0] > 0.05 : q.p[0] < -0.05) && shareW(B, q.w, 'calf', 'thigh') > 0.8 && q.p[1] < kn[1] + 0.5, (n) => n.endsWith(`_${s}`), 0.3);
  const TS = 0.8, sleeve = plateOn(SH, { a0: -PI, a1: PI, closed: true, t0: () => 0.1, t1: () => TS, nu: 10, nv: 20, off: (u) => 0.045 + 0.02 * smooth(0.35, 0, u) });
  out.push(solid(sleeve, { sheet: true, w: wSl, mat: () => 'hose' }));
  out.push(tube(rowPath(sleeve, 10, 0, 20, 20), { r: 0.022, k: 3, mat: 'miL', w: wSl, closed: true }));
  // -- the calf: a silver leaf down its outside from under the knee, its point at the boot's top, a narrower one lapped
  // behind it, both veined
  const rC = (tt, a) => len(sub(SH.ta(tt, a).p, lerp(kn, an, tt)));
  for (const [ac, t1, wide, mat, off] of [[2.2, 0.33, 0.22, 'miM', 0.1], [1.5, 0.39, 0.3, 'mi', 0.13]]) {
    const calf = leafOn((u, x) => { const tt = 0.12 + (t1 - 0.12) * u, a = ac + x / (rC(tt, ac) + off); const q = SH.ta(tt, a); return { p: add(q.p, mul(q.n, off + 0.02 * Math.sin(PI * u))), n: q.n }; },
      { wide: wide * (fem ? 0.9 : 1), nu: 6, nv: 4, fold: 0.05, curl: 0.05, curlFrom: 0.75, mat, inner: 'miS', edge: 'miS', rib: 'miL', ribR: 0.022, ribSteps: 5, rim: 'miL', rimR: 0.02, rimSteps: 5, w: wSl, shape: { peak: 0.38, base: 0.45, sharp: 0.75 } });
    out.push(...calf);
  }
  // -- the knee: a leaf over it, pointed above and below, on the knee's own half-turning bone
  const kPick = (q) => (sg > 0 ? q.p[0] > 0.12 : q.p[0] < -0.12) && shareW(B, q.w, 'thigh', 'calf') > 0.8 && len(sub(q.p, kn)) < 0.9;
  const k0 = lerp(hp, kn, 0.8), k1 = lerp(kn, an, 0.16);
  const KN = limbWrap(B, k0, k1, sg, { t: [0, 1], nt: 10, a: [-PI, PI], closed: true, na: 28, pick: kPick, smooth: 4, shape: (r) => r });
  const wKn = boneW(B, `knee_${s}`);
  const kr = len(sub(KN.ta(0.5, 0).p, lerp(k0, k1, 0.5)));
  const cop = leafOn((u, x) => { const q = KN.ta(u, 0.1 + (sg * x) / (kr + 0.2)); return { p: add(q.p, mul(q.n, 0.2 + 0.1 * Math.sin(PI * u))), n: q.n }; },
    { wide: fem ? 0.4 : 0.46, nu: 6, nv: 4, fold: 0.08, mat: 'mi', inner: 'miS', edge: 'miS', rib: 'miL', ribR: 0.026, rim: 'miL', rimR: 0.024, w: () => wKn, shape: { peak: 0.5, base: 0.15, sharp: 0.8 } });
  out.push(...cop);
  // (the swept leaf: from the knee's outside back and up, curling out)
  const kc = KN.ta(0.5, PI / 2), ko = unit([kc.n[0], 0, kc.n[2]]);
  out.push(...leafFree(add(kc.p, mul(ko, 0.16)), unit(add([0, 0.75, -0.65], mul(ko, 0.15))), ko, { long: fem ? 0.6 : 0.7, wide: 0.17, bend: ko, bendK: 0.35, nu: 5, nv: 4, fold: 0.05, curl: 0.06, cup: 0.04, mat: 'mi', inner: 'miS', edge: 'miS', rib: 'miL', ribR: 0.02, rim: 'miL', rimR: 0.018, w: () => wKn, shape: { peak: 0.35, base: 0.4 } }));
  return out;
}
export function mithrilLegs(B) {
  return { P: coverHides(B, merge(smoothWeights(hose(B), 3, (p) => p[1] > B.at.knee.l[1] + 0.6), ...legLeaves(B, 'l'), ...legLeaves(B, 'r')), 0.5), dropAt: (f) => f.mat === 'hoseW' };
}

/* ---- boots ------------------------------------------------------------------------------------------------------- */
/**
 * One boot: slim leather to the calf, seamed down its sides and laced up its back, its top a cuff of standing leaves
 * edged in silver; a long silver leaf down the shin; the foot its own shape (not the skin's), narrow and drawn out to a
 * long point turned up a little at the tip, a silver leaf over it to the point, a silver leaf over the outer ankle.
 */
function boot(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, kn = A.knee[s], an = A.ankle[s], ball = A.ball[s], fem = B.who === 'female', out = [];
  const legB = (n) => n.endsWith(`_${s}`);
  const cPick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'calf') > 0.6;
  const SH = limbWrap(B, kn, an, sg, { t: [0, 1.04], nt: 20, a: [-PI, PI], closed: true, na: 24, pick: cPick, smooth: 4, shape: (r) => r });
  const wCa = skinW(B, (q) => cPick(q) && along(q.p, kn, an) > 0.2 && along(q.p, kn, an) < 0.85, legB);
  const wFoot = boneW(B, `foot_${s}`), wBall = boneW(B, `ball_${s}`);
  // -- the shaft: closed round the calf from its top to the ankle, close to it
  const T0 = BOOT_TOP, NV = 20;
  const shaft = plateOn(SH, { a0: -PI, a1: PI, closed: true, t0: () => 1.03, t1: (a) => T0 + 0.025 * Math.cos(a), nu: 7, nv: NV, off: (u) => 0.088 + 0.012 * smooth(0.8, 1, u) });
  const wSk = nearSkinW(B, (q) => (sg > 0 ? q.p[0] > 0.05 : q.p[0] < -0.05) && shareW(B, q.w, 'calf', 'thigh', 'foot') > 0.8 && q.p[1] < kn[1] + 0.5, legB, 0.3);
  out.push(solid(shaft, { sheet: true, w: wSk, thick: 0.03, mat: () => 'leather', inner: 'leatherD', edge: 'leatherD' }));
  // (its top rolled in silver; its seams down the inside and the outside, dark)
  out.push(tube(rowPath(shaft, 7, 0, NV, NV), { r: 0.026, k: 3, mat: 'miL', w: wSk, closed: true }));
  for (const a of [PI / 2, -PI / 2]) out.push(band(colPath(shaft, ((a + PI) / (2 * PI)) * NV, 0.2, 6.6, 5, 0.018), { wide: 0.035, high: 0.006, mat: 'leatherD', w: wSk }));
  // (the lacing up the back: a cord crossed between the seams' ends)
  const lace = [];
  for (let k = 0; k <= 10; k++) { const tt = 0.88 - (0.86 - T0) * (k / 10), a = PI + (k % 2 ? 0.2 : -0.2), q = SH.ta(tt, a); lace.push({ p: add(q.p, mul(q.n, 0.112)), n: q.n }); }
  out.push(tube(lace, { r: 0.02, k: 3, mat: 'leatherD', w: wSk }));
  // -- the cuff: leaves standing up round the top and flared out, each edged in silver; none before (the shin's leaf
  // rises there) nor on the outside (the leg's calf leaf comes down there)
  for (const a0 of [0.72, -0.8, -2.5, 2.75]) {
    const a = a0, inner = a0 < 0 ? 1 : 0;
    out.push(...leafOn((u, x) => { const tt = T0 + 0.05 - 0.24 * u, r = len(sub(SH.ta(Math.max(0, tt), a).p, lerp(kn, an, tt))), q = SH.ta(Math.max(0, tt), a + x / (r + 0.15)); return { p: add(q.p, mul(q.n, 0.13 - 0.015 * inner + (0.12 - 0.08 * inner) * u * u)), n: q.n }; },
      { wide: fem ? 0.19 : 0.22, nu: 4, nv: 2, fold: 0.05, curl: 0.05, curlFrom: 0.6, mat: 'leather', inner: 'leatherD', edge: 'leatherD', rib: null, rim: 'miL', rimR: 0.018, rimSteps: 5, w: () => wCa, shape: { peak: 0.38, base: 0.5, sharp: 0.7 } }));
  }
  // -- the shin's leaf: from its stalk at the instep up the shin to a point above the boot's top
  const rS = (tt, a) => len(sub(SH.ta(tt, a).p, lerp(kn, an, tt)));
  const shin = leafOn((u, x) => { const tt = 1.0 - (1.0 - (T0 - 0.14)) * u, q = SH.ta(tt, (sg * x) / (rS(tt, 0) + 0.15)); return { p: add(q.p, mul(q.n, 0.14 + 0.03 * Math.sin(PI * u))), n: q.n }; },
    { wide: fem ? 0.3 : 0.34, nu: 9, nv: 4, fold: 0.07, curl: 0.06, curlFrom: 0.85, mat: 'mi', inner: 'miS', edge: 'miS', rib: 'rune', ribR: 0.03, ribFrom: 0.03, ribTo: 0.9, ribSteps: 7, rim: 'miL', rimR: 0.024, w: (p) => (along(p, kn, an) > 0.9 ? mixW([[wCa, 0.7], [wFoot, 0.3]]) : wCa), shape: { peak: 0.45, base: 0.5, sharp: 0.75 } });
  out.push(...shin);
  for (const u0 of [0.35, 0.62]) for (const sd of [-1, 1]) {
    const path = [0, 1, 2].map((k) => { const f = k / 2, q = shin.at(u0 - 0.1 * f, sd * (0.1 + 0.7 * f)); return { p: add(q.p, mul(q.n, 0.005)), n: q.n }; });
    out.push(band(path, { wide: 0.028, high: 0.012, mat: 'miS', w: () => wCa }));
  }
  // -- the foot: a loft along the foot's line from behind the heel to a long point past the toes; each section a rounded
  // box (flat below, round above), its sole at the floor, its top from inside the shaft down the instep to the point
  const d = unit([ball[0] - an[0], 0, ball[2] - an[2]]), e = [d[2] * sg, 0, -d[0] * sg], L = len(sub([ball[0], 0, ball[2]], [an[0], 0, an[2]])), k = L / 0.9;
  const s0 = -0.95 * k, sTip = 2.2 * k, fl = A.floor, hw = (fem ? 0.29 : 0.32);
  const yTop = (sv) => sv < 0.2 * k ? an[1] + 0.3 : sv < 1.0 * k ? lerp([0, an[1] + 0.3, 0], [0, fl + 0.47, 0], smooth(0.2 * k, 1.0 * k, sv))[1] : lerp([0, fl + 0.47, 0], [0, fl + 0.2, 0], smooth(1.0 * k, sTip, sv))[1];
  const yBot = (sv) => fl + 0.2 * smooth(1.45 * k, sTip, sv) ** 2;
  const wid = (sv) => (sv > 1.0 * k ? hw * Math.max(0, (sTip - sv) / (sTip - 1.0 * k)) ** 0.8 : hw);
  const heel = (sv) => (sv < -0.6 * k ? Math.sqrt(Math.max(0, 1 - ((sv + 0.6 * k) / (s0 + 0.6 * k)) ** 2)) : 1);
  const NUF = 15, NVF = 12;
  const sec = (u) => { const sv = s0 + (sTip - s0) * u, hh = heel(sv), yb = yBot(sv), yt = yb + (yTop(sv) - yb) * Math.max(hh, sv < 0 ? 0.25 : 0); return { sv, c: add([an[0], 0, an[2]], mul(d, sv)), w: wid(sv) * hh, yb, yt }; };
  const foot = patch((u, v) => {
    const q = sec(u), ph = v * 2 * PI, sn = Math.sin(ph), cs = Math.cos(ph);
    // (round above, nearly flat below)
    const lat = Math.sign(sn) * Math.abs(sn) ** (cs < 0 ? 0.5 : 0.8), ver = cs >= 0 ? cs ** 0.9 : -((-cs) ** 0.35);
    const ym = q.yb + 0.08, up = q.yt - ym;
    const p = add(add(q.c, mul(e, lat * q.w)), [0, ym + (ver >= 0 ? up * ver : 0.08 * ver), 0]);
    return { p, n: unit(add(mul(e, sn), [0, cs, 0])) };
  }, NUF, NVF, { closed: true });
  const tOf = (p) => (dot(sub(p, [an[0], 0, an[2]]), d) - s0) / (sTip - s0);
  const tBall = (L - s0) / (sTip - s0);
  const wF = (p) => { const f = smooth(tBall - 0.15, tBall + 0.1, tOf(p)); return mixW([[wFoot, 1 - f], [wBall, f]]); };
  out.push(solid(foot, { sheet: true, w: wF, mat: (i, j) => { const ph = ((j + 0.5) / NVF) * 2 * PI; return Math.cos(ph) < -0.55 ? 'sole' : 'leather'; } }));
  // (the welt: a dark cord where the upper meets the sole, from heel round to the point)
  for (const sd of [1, -1]) {
    const path = [];
    for (let m = 0; m <= 12; m++) { const u = 0.04 + 0.93 * (m / 12), q = sec(u); path.push({ p: add(add(q.c, mul(e, sd * q.w * 1.0)), [0, q.yb + 0.08, 0]), n: mul(e, sd) }); }
    out.push(tube(path, { r: 0.025, k: 3, mat: 'leatherD', w: wF }));
  }
  // (the toe's leaf: silver over the instep to the point, its midrib lit as the shin's)
  const topAt = (u, x) => { const q = sec(u), xx = clamp(x / Math.max(0.05, q.w), -0.95, 0.95), y0 = q.yb + 0.08, up = q.yt - y0; return { p: add(add(q.c, mul(e, xx * q.w)), [0, y0 + up * Math.sqrt(1 - xx * xx) ** 0.9 + 0.025, 0]), n: unit(add(mul(e, xx), [0, 1, 0])) }; };
  const u0 = (0.45 * k - s0) / (sTip - s0);
  out.push(...leafOn((u, x) => topAt(u0 + (0.995 - u0) * u, x), { wide: fem ? 0.22 : 0.25, nu: 9, nv: 4, fold: 0.05, mat: 'mi', inner: 'miS', edge: 'miS', rib: 'rune', ribR: 0.026, ribFrom: 0.03, ribTo: 0.92, ribSteps: 6, rim: 'miL', rimR: 0.022, w: wF, shape: { peak: 0.3, base: 0.6, sharp: 0.8 } }));
  // -- the ankle's leaf: silver over the outer ankle, its point back and down toward the heel
  const ao = unit([sg, 0, -0.15]), ac = add(an, mul(ao, (fem ? 0.36 : 0.4)));
  out.push(...leafFree(add(ac, [0, 0.18, 0.12]), unit([0, -0.45, -1]), ao, { long: fem ? 0.5 : 0.56, wide: 0.15, bend: ao, bendK: 0.25, nu: 6, nv: 4, fold: 0.04, curl: 0.05, cup: 0.04, mat: 'mi', inner: 'miS', edge: 'miS', rib: 'miL', ribR: 0.018, ribSteps: 4, rim: 'miL', rimR: 0.018, rimSteps: 5, w: () => wFoot, shape: { peak: 0.35, base: 0.5 } }));
  return out;
}
const BOOT_TOP = 0.42;
export function mithrilBoots(B) {
  const A = B.at, P = merge(...boot(B, 'l'), ...boot(B, 'r'));
  // (the foot's skin under the boot left out: the boot's foot is its own shape, narrower than the skin's)
  const under = (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'foot', 'calf') > 0.6 && y(p) < A.ankle[s][1] + 0.3; };
  B.A.polys.forEach(([v, m], pi) => { if (m !== 1 && m !== 2 && v.every(under)) P.hides.add(pi); });
  P.soles = P.V.map((_, i) => i).filter((i) => P.V[i][1] < A.floor + 0.12);
  return coverHides(B, P, 0.5);
}
