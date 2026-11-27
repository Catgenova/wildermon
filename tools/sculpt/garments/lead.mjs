// The lead set: the Wall, the front rank of a shield-line, built with the plate kit (tools/sculpt/garments/platekit.mjs)
// and the lead kit (tools/sculpt/garments/kit/lead.mjs). The figure is a castle: the helm its keep, the pauldrons its
// bastions, the back its gatehouse, the legs its pillars; lead's own work (seals, plumb-bobs, lead roofing) in the details.
//
//   helm    the keep: a great helm as a round tower, battered at its foot, coursed in ashlar, a ring of corbels under a
//           parapet stepped out over them, six merlons, a cone of lead roofing on rolls inside it; a riveted cross plate
//           on the face cut with a cross-shaped sight, breaths in crosses, a seal at the nape; a dark aventail inside its
//           foot round the nape and the sides, a throat curtain before.
//   chest   an oxblood gambeson under a cuirass of stepped courses, a mid-grey plinth course at the waist, a plain seal on
//           the breast stamped with the plumb-bob, its line down to a turned bob; a gorget of two lames; faulds battered
//           out like a wall's foot over an oxblood tunic hem split over each thigh; the bastions: oval drums on the
//           shoulders, corbelled, merlons outside, a lead-roofed cone, an arrow-loop with bright lips; a wall-walk of lead
//           over each shoulder's top; rerebraces, couters with a seal, vambraces in two courses with an arrow-loop, cuffs.
//   mantle  the curtain walls: behind, a deep crenellated wall between the bastions, its gate with the portcullis, two
//           swallow-tailed oxblood banners either side of it; before, two long oxblood banners down the breast, each hung
//           from a short crenellated wall with a gate-tower clasp, its gate lit, their tails swung out.
//   legs    slate hose under cuisses, poleyns with an arrow-loop and a crenellated wing, greaves as pillars: a capital
//           under the knee with corbels and three merlons outside, fluted, narrowing to the ankle, flared into a base.
//   boots   lead-clad shoes, two lames over the instep to a square box toe broader at its front, a seal on the instep,
//           a plinth of lead under each foot.
//
// Enchanted, the fortress is lit from within and nothing else: the helm's cross sight, the arrow-loops (bastions and
// poleyns), the gates (the back wall's and the banners' clasps), the seals' marks on the boots.
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, smooth, merge, shell, on, waistOf, nearestOf } from './metalkit.mjs';
import {
  skinSamples, shareW, boneW, mixOf, mixW, keepBones, nearSkinW, skinW, wrapAngle, torsoWrap, torsoMiddle, limbWrap, plateOn, patch, solid,
  tube, band, rowPath, colPath, pathOn, resample, stud, studsAlong, gridOf, domeWrap, along, ellipsoidReach, sweep, smoothWeights, coverHides, roundProfile,
} from './platekit.mjs';
import { anglesWith, tower, colAt, rowAt, merlons, block, seal, merlonsAlong, reachOf, joint, curtainWall } from './kit/lead.mjs';

const PI = Math.PI;

export const LEAD_MATS = {
  // (the lead: a dull blue-grey field with a soft sheen, its alternate courses a shade lighter, its string courses and
  // rolled bands mid-grey, its worn rims, parapet tops and loop lips soft and bright; its recesses and mortar a
  // weathered blue-black)
  pb: { c: '#5e6977', kind: 3 },
  pbM: { c: '#8a95a2', kind: 3 },
  pbC: { c: '#66717f', kind: 3 },
  pbL: { c: '#d8e0e8', kind: 3 },
  pbS: { c: '#1b2028', kind: 2 },
  pbB: { c: '#a3adb8', kind: 3 },
  pbD: { c: '#0e1115', kind: 2 },
  pbO: { c: '#cfd1c8', kind: 2 },
  roof: { c: '#55657b', kind: 2 },
  // (the light within: dark plain, lit in the enchantment's colour)
  sight: { c: '#0b0c0f', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  rune: { c: '#2a2d33', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  // (the cloth: oxblood wool, its hems darker, the gambeson's quilting oxblood; the hose and the aventail slate wool)
  wool: { c: '#7e2220', kind: 0 },
  woolD: { c: '#4a1414', kind: 0 },
  gam: { c: '#3a3f47', kind: 0 },
  gamD: { c: '#1e2124', kind: 0 },
  gamW: { c: '#3a3f48', kind: 0 },
  quilt: { c: '#4a1a1b', kind: 0 },
  leather: { c: '#2c2522', kind: 2 },
  sole: { c: '#1f1915', kind: 2 },
};

const fem = (B) => B.who === 'female';
const hdW = (B, w) => w.reduce((t, [b, x]) => t + (B.bones[b].name === 'head' || B.bones[b].name === 'jaw' ? x : 0), 0);

/* ---- the helm: the keep ------------------------------------------------------------------------------------------ */
export function leadHelm(B) {
  const A = B.at, out = [], fem = B.who === 'female';
  const hs = skinSamples(B).filter((q) => hdW(B, q.w) > 0.45);
  const top = Math.max(...hs.map((q) => q.p[1])), chin = Math.min(...hs.map((q) => q.p[1]));
  const zf = Math.max(...hs.map((q) => q.p[2])), zb = Math.min(...hs.map((q) => q.p[2]));
  const c = [0, 0, (zf + zb) / 2 - 0.02];
  // (the cross-section: a rounded oblong, flatter across the face, a keel down the middle of it)
  // (its half-width, its reach before and behind: the head's own, so a narrow head has a narrow helm)
  const fit = fem ? 0.13 : 0.13;
  const hx = Math.max(...hs.map((q) => Math.abs(q.p[0] - c[0]))), hf = zf - c[2], hbk = c[2] - zb;
  const sec0 = (a) => { const n = 2.5, ca = Math.abs(Math.cos(a)), sa = Math.abs(Math.sin(a)), fz = Math.cos(a) > 0 ? hf : hbk; return 1 / ((ca / fz) ** n + (sa / hx) ** n) ** (1 / n); };
  const keel = (a) => 0.07 * Math.exp(-((a / 0.2) ** 2));
  // (scaled out to clear the head everywhere by `fit`)
  let s = 0;
  for (const q of hs) { const dx = q.p[0] - c[0], dz = q.p[2] - c[2], a = Math.atan2(dx, dz); s = Math.max(s, (Math.hypot(dx, dz) + fit) / sec0(a)); }
  const sec = (a) => s * sec0(a) + keel(a);
  // (the eye's height; the sight's slit across it and its stem down the face and up the brow: a cross)
  const eyes = B.A.polys.filter((p) => p[1] === 2).flatMap((p) => p[0]).map((i) => B.V[i][1]);
  const ye = (Math.min(...eyes) + Math.max(...eyes)) / 2;
  const sl0 = ye - 0.06, sl1 = ye + 0.07, stem0 = ye - 0.6, stem1 = sl1 + 0.24, slA = fem ? 0.74 : 0.78, stemA = 0.075;
  const h0 = sl0 - 0.1, h1 = sl1 + 0.1, v0 = stem0 - 0.12, v1 = stem1 + 0.1, hA = slA + 0.13, vA = stemA + 0.12;
  const yT = top + (fem ? 0.02 : 0.03), yR = yT - 0.1, yB = chin - (fem ? 0.12 : 0.11), yC = yT - 0.2;
  // rows: the foot turned in under the jaw, the wall up to the corbel ring, the parapet stepped out, its walk, the roof
  const sp = fem ? 0.6 : 0.66, PK = fem ? 1.2 : 1.22;
  // (each row's scale no less than the head needs there)
  const need = (yy) => hs.reduce((m, q) => { if (Math.abs(q.p[1] - yy) > 0.2) return m; const dx = q.p[0] - c[0], dz = q.p[2] - c[2]; return Math.max(m, (Math.hypot(dx, dz) + fit) / sec(Math.atan2(dx, dz))); }, 0);
  const wall = (yy, k) => [yy, Math.max(k, need(yy))];
  // (the foot clear of the neck behind and the throat before, whatever the head does)
  const ns = skinSamples(B).filter((q) => hdW(B, q.w) < 0.45 && q.p[1] > yB - 0.2 && q.p[1] < chin + 0.4 && Math.abs(q.p[0]) < 1.1);
  const kb = fem ? 1.1 : 1.11;
  const needNa = (a) => ns.reduce((m, q) => { const dx = q.p[0] - c[0], dz = q.p[2] - c[2], qa = Math.atan2(dx, dz); return Math.abs(wrapAngle(qa - a)) < 0.25 && Math.abs(Math.cos(a)) > 0.55 ? Math.max(m, (Math.hypot(dx, dz) + 0.4) / sec(qa)) : m; }, 0);
  // (the foot higher behind, over the nape)
  const yBa = (a) => yB + 0.1 * Math.max(0, -Math.cos(a)) ** 1.5 + 0.08 * Math.sin(a) ** 2;
  // (the foot battered out before and behind, not at the sides, where the bastions stand; clear of the neck all round)
  const fl = (k) => (a) => Math.max(1 + (k - 1) * Math.abs(Math.cos(a)), needNa(a));
  const rows = [
    [yBa, fl(kb - 0.01), 0.06], [yBa, fl(kb)], [(a) => yBa(a) + 0.07, fl(kb)], wall(chin + 0.14, 1.0), wall(v0, 0.995), wall(stem0, 0.99), wall(h0, 0.985), wall(sl0, 0.98), wall(sl1, 0.975), wall(h1, 0.97), wall(stem1, 0.955), wall(v1, 0.945),
    wall(lerp([v1], [yC], 0.5)[0], 0.92), wall(yC, 0.895), [yC + 0.11, PK], [yT, PK],
    [yT, PK, 0.12], [yR, PK, 0.12], [yR, PK, 0.2], [yR + 0.2 * sp, 0.72], [yR + 0.42 * sp, 0.44], [yR + 0.62 * sp, 0.2], [yR + 0.72 * sp, 0.001],
  ];
  const ROW = { sl0: 8, stem0: 6, stem1: 11, step: 14, walk: 16 };
  const A0 = anglesWith(44, [-slA, slA, -stemA, stemA], 0.05);
  const G = tower(c, rows, A0, sec);
  const wH = boneW(B, 'head');
  const mid = (i, j) => [(G.Y[i] + G.Y[i + 1]) / 2, wrapAngle(A0[j] + wrapAngle((A0[(j + 1) % A0.length] - A0[j])) / 2)];
  const open = (ym, am) => (ym > sl0 && ym < sl1 && Math.abs(am) < slA) || (ym > stem0 && ym < stem1 && Math.abs(am) < stemA);
  const mat = (i, j) => { const [ym, am] = mid(i, j); return open(ym, am) ? null : i > ROW.walk + 1 ? 'roof' : i > ROW.walk ? 'pbS' : i === ROW.step ? 'pbB' : i === ROW.step - 1 || i === 0 ? 'pbS' : i === 1 ? 'pbB' : 'pb'; };
  out.push(solid(G, { hollow: true, thick: 0.06, w: () => wH, mat, edge: 'pbD' }));
  // (the liner behind the sight: dark, lit when enchanted)
  const LA = anglesWith(30, [-slA - 0.06, slA + 0.06]).filter((a) => Math.abs(a) <= slA + 0.061);
  const L = tower(c, [[stem0 - 0.03, 1, 0.05], [sl0, 1, 0.05], [sl1, 1, 0.05], [stem1 + 0.03, 1, 0.05]], LA, sec);
  out.push(solid(gridOf(L.P, { out: (i, j) => L.N[i][j] }), { sheet: true, w: () => wH, mat: () => 'sight' }));
  // (the cross: a plate laid over the face, the sight cut through it, its edges bright, riveted at its arms' ends)
  const CA = [...new Set([-hA, -slA, -vA, -stemA, stemA, vA, slA, hA, ...[...Array(13).keys()].map((k) => -hA + ((2 * hA) * k) / 12)].map((x) => +x.toFixed(4)))].sort((a, b) => a - b).filter((x, k, arr) => k === 0 || x - arr[k - 1] > 0.03);
  const CY = [v0, stem0, h0, sl0, sl1, h1, stem1, v1];
  const X = tower(c, CY.map((yy) => [yy, 1, -0.07]), CA, sec);
  const inX = (ym, am) => (ym > h0 && ym < h1 && Math.abs(am) < hA) || (ym > v0 && ym < v1 && Math.abs(am) < vA);
  const Xg = gridOf(X.P, { out: (i, j) => X.N[i][j] });
  out.push(solid(Xg, { hollow: true, thick: 0.07, w: () => wH, mat: (i, j) => { const ym = (CY[i] + CY[i + 1]) / 2, am = (CA[j] + CA[j + 1]) / 2; return inX(ym, am) && !open(ym, am) ? 'pbB' : null; }, edge: 'pbL' }));
  const at = (yy, a, lift = 0) => { const q = G.at(rowAt(G, yy), colAt(G, a)); return { p: add(q.p, mul(q.n, lift)), n: q.n }; };
  const rivet = (yy, a, r = 0.05) => { const q = at(yy, a, 0.075); out.push(stud(q.p, q.n, { r, h: r * 0.9, k: 5, mat: 'pbS', capMat: 'pbB', w: () => wH })); };
  for (const sg of [-1, 1]) {
    rivet((h0 + sl0) / 2, sg * (hA - 0.07)); rivet((h1 + sl1) / 2, sg * (hA - 0.07));
    rivet((h0 + sl0) / 2, sg * (vA + 0.1)); rivet((h1 + sl1) / 2, sg * (vA + 0.1));
    rivet((v0 + stem0) / 2, sg * (vA - 0.06)); rivet((v1 + stem1) / 2, sg * (vA - 0.06));
    rivet(lerp([stem0], [h0], 0.5)[0], sg * (vA - 0.06), 0.045);
    // (breaths: a cross of five holes either side of the keel)
    const by = lerp([stem0], [chin + 0.1], 0.35)[0], ba = sg * 0.52, dy = 0.11, da = 0.12;
    for (const [ddy, dda] of [[0, 0], [dy, 0], [-dy, 0], [0, da], [0, -da]]) { const q = at(by + ddy, ba + dda, 0.005); out.push(stud(q.p, q.n, { r: 0.045, h: 0.004, k: 4, sink: 0.0, mat: 'pbD', w: () => wH })); }
  }
  // (the aventail: a curtain of dark quilting hung from inside the foot behind and at the sides, down over the nape to
  // inside the gorget's collar; on the head, so it moves as the helm does)
  {
    const NSa = skinSamples(B).filter((q) => hdW(B, q.w) < 0.45 && q.p[1] > A.neck[1] - 0.2 && q.p[1] < yB + 0.1 && shareW(B, q.w, 'upperarm', 'shoulder') < 0.3).map((q) => ({ a: Math.atan2(q.p[0] - c[0], q.p[2] - c[2]), r: Math.hypot(q.p[0] - c[0], q.p[2] - c[2]) }));
    const NSk = skinSamples(B).filter((q) => hdW(B, q.w) < 0.45 && q.p[1] > A.neck[1] - 0.02 && q.p[1] < yB + 0.1 && shareW(B, q.w, 'neck') > 0.5).map((q) => ({ a: Math.atan2(q.p[0] - c[0], q.p[2] - c[2]), r: Math.hypot(q.p[0] - c[0], q.p[2] - c[2]) }));
    // (round the nape, clear of all the skin there; at the sides, of the neck's own, not the shoulders' slope)
    const reachIn = (S) => (a) => S.reduce((m, q) => (Math.abs(wrapAngle(q.a - a)) < 0.3 ? Math.max(m, q.r) : m), 0.5);
    const rAll = reachIn(NSa), rNk = reachIn(NSk), rN = (a) => { const k = Math.max(0, -Math.cos(a)) ** 2; return rNk(a) * (1 - k) + rAll(a) * k; };
    // (the skin's reach at a height, the shoulder's slope with it)
    const NSs = skinSamples(B).filter((q) => hdW(B, q.w) < 0.45 && q.p[1] > A.neck[1] - 0.5 && q.p[1] < yB + 0.1 && shareW(B, q.w, 'upperarm', 'shoulder', 'forearm', 'hand') < 0.2).map((q) => ({ a: Math.atan2(q.p[0] - c[0], q.p[2] - c[2]), r: Math.hypot(q.p[0] - c[0], q.p[2] - c[2]), y: q.p[1] }));
    const rAt = (a, yy) => NSs.reduce((m, q) => (Math.abs(wrapAngle(q.a - a)) < 0.25 && Math.abs(q.y - yy) < 0.12 ? Math.max(m, q.r) : m), 0.4);
    const av = patch((u, v) => {
      // (up close round the neck to over the collar's top, then out to inside the helm's foot)
      const a = PI - 1.85 + 3.7 * v, top = sec(a) * fl(kb)(a) - 0.16;
      const y0 = A.neck[1] - (fem ? 0.14 : 0.14) + (fem ? 0.1 : 0.27) * Math.sin(a) ** 8, bot = Math.max(rN(a) + (fem ? 0.18 : 0.22) - (fem ? 0.06 : 0.12) * Math.sin(a) ** 2, rAt(a, y0) + (fem ? 0.08 : 0.13)), ym = Math.min(Math.max(A.neck[1] + (fem ? 0.14 : 0.04), y0 + 0.06), yBa(a) - 0.02);
      const r = u < 0.5 ? bot : lerp([bot], [top], (u - 0.5) * 2)[0], yy = u < 0.5 ? lerp([y0], [ym], u * 2)[0] : lerp([ym], [yBa(a) + 0.04], (u - 0.5) * 2)[0];
      return { p: [c[0] + Math.sin(a) * r, yy, c[2] + Math.cos(a) * r], n: [Math.sin(a), 0, Math.cos(a)] };
    }, 8, 16);
    // (before, the throat's: hung from inside the helm's foot to just over the collar's top, close round the neck)
    const avF = patch((u, v) => {
      const a = -1.35 + 2.7 * v, top = sec(a) * fl(kb)(a) - 0.16, bot = rNk(a) + 0.05, y0 = A.neck[1] + (fem ? 0.2 : 0.1) + 0.06 * Math.sin(a) ** 2;
      const r = u < 0.5 ? bot : lerp([bot], [top], (u - 0.5) * 2)[0], yy = u < 0.5 ? lerp([y0], [Math.min(y0 + 0.08, yBa(a) - 0.02)], u * 2)[0] : lerp([Math.min(y0 + 0.08, yBa(a) - 0.02)], [yBa(a) + 0.04], (u - 0.5) * 2)[0];
      return { p: [c[0] + Math.sin(a) * r, yy, c[2] + Math.cos(a) * r], n: [Math.sin(a), 0, Math.cos(a)] };
    }, 6, 10);
    // (its top on the head, its hem on the neck, as cloth hangs between them)
    const wNk = mixOf(B, [['neck_01', 0.5], ['spine_03', 0.5]]), yTopAv = yB + 0.04, yLowAv = A.neck[1] - 0.05;
    for (const g of [av, avF]) out.push(solid(g, { sheet: true, w: (p) => { const f = clamp((yTopAv - p[1]) / (yTopAv - yLowAv)); return mixW([[wH, 1 - f], [wNk, f]]); }, mat: () => 'gamD' }));
  }
  // (the rolled foot, the lip of the parapet's step)
  out.push(tube(rowPath(G, 2, 0, A0.length, A0.length), { r: 0.05, k: 4, mat: 'pbL', w: () => wH, closed: true }));
  out.push(tube(rowPath(G, ROW.walk, 0, A0.length, A0.length), { r: 0.045, k: 4, mat: 'pbL', w: () => wH, closed: true }));
  // (courses of masonry round the sides and the back: joints sunk in the wall, staggered course to course)
  const cy = [chin + 0.12, lerp([chin + 0.12], [yC], 0.25)[0], lerp([chin + 0.12], [yC], 0.5)[0], lerp([chin + 0.12], [yC], 0.75)[0], yC];
  for (let k = 1; k < cy.length - 1; k++) out.push(joint(rowPath(G, rowAt(G, cy[k]), colAt(G, 1.25), colAt(G, -1.25) + A0.length, 24, 0.0), { wide: 0.045, high: 0.016, mat: 'pbS', w: () => wH }));
  for (let k = 0; k + 1 < cy.length; k++) for (let m = 0; m < 6; m++) {
    const a = 1.45 + (m + (k % 2 ? 0.5 : 0)) * ((2 * PI - 2.9) / 5.5);
    if (a > 2 * PI - 1.4) continue;
    out.push(joint(colPath(G, colAt(G, a), rowAt(G, cy[k]) + 0.02, rowAt(G, cy[k + 1]) - 0.02, 2, 0.0), { wide: 0.04, high: 0.016, mat: 'pbS', w: () => wH }));
  }
  // (the corbels under the parapet's step: a ring of them)
  const nC = 14;
  for (let k = 0; k < nC; k++) {
    const a = (TAU * (k + 0.5)) / nC, q = at(yC - 0.03, a), q2 = at(yC + 0.11, a), o = unit([Math.sin(a), 0, Math.cos(a)]), x = unit(cross([0, 1, 0], o));
    const dep = Math.hypot(q2.p[0] - q.p[0], q2.p[2] - q.p[2]) - 0.01;
    out.push(block(add(q.p, add(mul(o, dep / 2), [0, 0.0, 0])), mul(x, 0.07), [0, 0.13, 0], mul(o, dep / 2), { mat: 'pb', edge: 'pbS', w: () => wH }));
  }
  // (the roof inside the parapet: a cone of lead sheet on rolls, a knop at its point)
  const nR = G.P.length - 1;
  { const q = G.P[nR][0]; out.push(stud(add(q, [0, -0.03, 0]), [0, 1, 0], { r: 0.08, h: 0.2, k: 5, mat: 'pbL', w: () => wH })); }
  // (the roof's rolls: a seam of lead rolled over at each of eight places round it, dark)
  for (let m = 0; m < 8; m++) out.push(tube(colPath(G, colAt(G, (TAU * (m + 0.5)) / 8), ROW.walk + 2, nR - 0.4, 3, 0.012), { r: 0.03, k: 3, mat: 'pbS', w: () => wH }));
  // (the merlons: six on the parapet, one over the face)
  out.push(...merlons(c, { count: 6, a0: 0, frac: 0.58, y0: yT, h: fem ? 0.2 : 0.23, r: (a) => sec(a) * PK, thick: 0.12, mat: 'pb', edge: 'pbL', w: () => wH, cols: 2 }));
  // (white oxide blooming in the corners of the courses)
  // (a lead seal stamped on the back, at the nape's course)
  { const q = at(lerp([chin + 0.1], [yC], 0.37)[0], PI, 0.02); out.push(seal(q.p, q.n, { r: 0.2, thick: 0.05, mat: 'pbB', ring: 'pbL', mark: 'pbS', k: 10, w: () => wH })); }
  // (lead seals: one at the nape, hanging from its staple)
  const P = merge(...out);
  // (the head's own polygons inside it left out)
  B.A.polys.forEach(([v], pi) => { if (v.every((i) => hdW(B, B.W[i]) > 0.6 || (B.V[i][1] > yB + 0.1 && Math.hypot(B.V[i][0] - c[0], B.V[i][2] - c[2]) < sec(Math.atan2(B.V[i][0] - c[0], B.V[i][2] - c[2])) * 0.84 - 0.08))) P.hides.add(pi); });
  return P;
}
const TAU = PI * 2;

/* ---- the body's measures the set is laid out by ------------------------------------------------------------------ */
const TORSO_BONES = new Set(['root', 'pelvis', 'spine_01', 'spine_02', 'spine_03']);
const y = (p) => p[1];
/** The heights the torso pieces are cut to. */
function marks(B) {
  const A = B.at, sh = A.shoulder.l[1];
  return {
    neckF: lerp(A.neck, A.chest, 0.47)[1], neckB: lerp(A.neck, A.chest, 0.36)[1],
    pit: sh - 1.05, waist: waistOf(A), hip: A.hip.l[1], fauld: A.hip.l[1] - 0.05,
  };
}
/** The torso's skin as a field round its middle line, from below the hips to the neck. */
const FIELDS = new WeakMap();
function torsoField(B) {
  if (FIELDS.has(B)) return FIELDS.get(B);
  const A = B.at;
  const pick = (s) => shareW(B, s.w, 'torso', 'thigh', 'neck', 'head') > 0.8 && hdW(B, s.w) < 0.15 && shareW(B, s.w, 'upperarm', 'shoulder', 'forearm', 'hand') < 0.05 && s.p[1] > lerp(A.hip.l, A.knee.l, 0.55)[1];
  const zc = torsoMiddle(B, (s) => shareW(B, s.w, 'torso', 'neck', 'head') > 0.8 && hdW(B, s.w) < 0.15);
  const y0 = lerp(A.hip.l, A.knee.l, 0.5)[1], y1 = A.neck[1] + 0.5;
  const G = torsoWrap(B, y0, y1, zc, { pick, nt: 100, na: 64, closed: true, a: [-PI, PI], smooth: 5, shape: (r) => r });
  G.tOfY = (yy) => (yy - y0) / (y1 - y0);
  G.yOfT = (tt) => y0 + (y1 - y0) * tt;
  G.zc = zc;
  FIELDS.set(B, G);
  return G;
}
const headOnly = (B, i) => hdW(B, B.W[i]);

/* ---- chest & arms: the curtain and its bastions ------------------------------------------------------------------ */
/** The gambeson: the torso, the neck's foot and the arms to the wrists, close over the skin, quilted oxblood wool, the skin under it left out. */
function gambeson(B) {
  const A = B.at, M = marks(B);
  return shell(B, {
    sub: 0, rim: null,
    keep: (i) => { const p = B.V[i]; return on(B, i, 'torso', 'shoulder', 'upperarm', 'forearm', 'neck', 'head', 'thigh') > 0.6 && headOnly(B, i) < 0.05 && on(B, i, 'hand') < 0.35 && y(p) > M.hip - 0.25 && on(B, i, 'thigh') < 0.5 && (y(p) < A.neck[1] - 0.01 || (y(p) < A.neck[1] + 0.12 && on(B, i, 'neck') < 0.8)) && y(p) > M.waist - 0.2; },
    off: ({ p }) => 0.07 + 0.03 * smooth(M.waist, M.hip, y(p)) - 0.062 * smooth(A.neck[1] - 0.6, A.neck[1] - 0.2, y(p)),
    mat: () => 'quilt',
  });
}

/** The cuirass in courses: the breast and the back each of stepped courses like a wall's, their joints staggered. */
function cuirass(B) {
  const A = B.at, M = marks(B), F = torsoField(B), t = F.tOfY, out = [];
  const W = nearSkinW(B, (s) => shareW(B, s.w, 'torso') > 0.7, (n) => TORSO_BONES.has(n), 0.35);
  const aN = 0.8, side = PI / 2 + 0.04;
  const topF = (a) => {
    const ax = Math.abs(a), yC = M.neckF + 0.14;
    if (ax <= aN) return M.neckF + 0.14 * (ax / aN) ** 2;
    const k = clamp((ax - aN) / (side - aN));
    return M.pit + (yC - M.pit) * Math.sqrt(Math.max(0, 1 - k * k));
  };
  const bN = 0.66;
  const topB = (a) => {
    const bx = PI - Math.abs(wrapAngle(a)), yC = M.neckB + 0.1;
    if (bx <= bN) return M.neckB + 0.1 * (bx / bN) ** 2;
    const k = clamp((bx - bN) / (PI - side + 0.04 - bN));
    return M.pit + (yC - M.pit) * Math.sqrt(Math.max(0, 1 - k * k));
  };
  // (a broad chest, a flat face down the middle: lead is worn thick)
  const bulge = (yy, a) => 0.08 * Math.exp(-(((yy - lerp(A.chest, [0, M.waist, 0], 0.4)[1]) / 1.0) ** 2)) * Math.max(0, Math.cos(a)) ** 1.2;
  const n = 4, hC = (M.neckF + 0.14 - M.waist) / n;
  const courses = [];
  for (const back of [false, true]) {
    const topOf = back ? topB : topF, a0 = back ? side - 0.08 : -side, a1 = back ? 2 * PI - side + 0.08 : side;
    for (let k = 0; k < n; k++) {
      const yb = M.waist + hC * k - (k === 0 ? 0 : 0.05), yt = M.waist + hC * (k + 1);
      // (the arc this course reaches: where the cut above it is higher than its foot)
      let lo = a0, hi = a1;
      const ok = (a) => topOf(a) > yb + 0.12;
      if (k === n - 1 || !ok(a0) || !ok(a1)) {
        const S = 200; const good = [];
        for (let m = 0; m <= S; m++) { const a = a0 + ((a1 - a0) * m) / S; if (ok(a)) good.push(a); }
        if (!good.length) continue;
        lo = good[0]; hi = good[good.length - 1];
      }
      const nv = Math.max(4, Math.round(((hi - lo) / (a1 - a0)) * 22));
      const off = (u, v, tt, a) => 0.15 + 0.03 * k + (back ? 0 : bulge(F.yOfT(tt), a)) + 0.04 * (1 - u);
      const g = plateOn(F, { a0: lo, a1: hi, t0: () => t(yb), t1: (a) => t(Math.min(yt + 0.02, topOf(a))), nu: 3, nv, off });
      // (each stone in the course its own shade, a little darker or lighter, its joints sunk)
      const stones = back ? 5 : 6, jw = (a1 - a0) / stones, ph = (k % 2) * 0.5;
      const which = (j) => { const am = lo + ((hi - lo) * (j + 0.5)) / nv; return Math.floor((am - a0) / jw + ph); };
      out.push(solid(g, { hollow: true, w: (p) => W(p), thick: 0.05, mat: () => (k === 0 ? 'pbB' : k % 2 ? 'pbC' : 'pb'), edge: 'pbS' }));
      void which;
      courses.push({ g, k, back, nv, lo, hi, off });
    }
    // (the rolled edge round the neck and the armholes, over the courses' tops)
    const top = plateOn(F, { a0, a1, t0: (a) => t(topOf(a) - 0.12), t1: (a) => t(topOf(a)), nu: 1, nv: back ? 24 : 28, off: (u, v, tt, a) => 0.15 + 0.03 * (n - 1) + (back ? 0 : bulge(F.yOfT(tt), a)) + 0.04 });
    out.push(tube(rowPath(top, 1, 0, back ? 24 : 28, back ? 14 : 18), { r: 0.06, k: 4, mat: 'pbS', w: (p) => W(p) }));
  }
  // the great seal on the breast: a disc of lead stamped with the plumb-bob; from it the plumb line
  // down to the bob over the waist
  const courseOff = (yy) => { const k = clamp(Math.floor((yy - M.waist) / hC), 0, n - 1); return 0.15 + 0.03 * k + bulge(yy, 0) + 0.04 * (1 - clamp((yy - (M.waist + hC * k)) / hC)); };
  const sealY = A.chest[1] - (fem(B) ? 0.22 : 0.14), sR = fem(B) ? 0.34 : 0.4;
  {
    const q = F.ta(t(sealY), 0), o = unit([q.n[0], 0, q.n[2]]), x = unit(cross([0, 1, 0], o)), up = [0, 1, 0];
    const sc = add(q.p, mul(o, Math.max(courseOff(sealY + sR), courseOff(sealY - sR)) + 0.06));
    const disc = patch((u, v) => { const a = v * TAU, rr = sR * [0.001, 0.8, 0.86, 1][Math.round(u * 3)], h = [0.0, 0.0, 0.035, 0.0][Math.round(u * 3)]; return { p: add(add(sc, mul(o, h)), add(mul(x, Math.cos(a) * rr), mul(up, Math.sin(a) * rr))), n: o }; }, 3, 16, { closed: true });
    out.push(solid(disc, { w: (p) => W(p), thick: 0.08, mat: (i) => (i === 2 ? 'pbL' : i === 1 ? 'pbB' : 'pbM'), inner: 'pbS', edge: 'pbS' }));
    for (let k = 0; k < 8; k++) { const a = (TAU * (k + 0.5)) / 8, p = add(add(sc, mul(o, 0.02)), add(mul(x, Math.cos(a) * sR * 0.9), mul(up, Math.sin(a) * sR * 0.9))); out.push(stud(p, o, { r: 0.035, h: 0.035, k: 4, mat: 'pbS', capMat: 'pbB', w: (pp) => W(pp) })); }
    // (stamped with the plumb-bob, raised in pale lead)
    out.push(...plumbBob(add(sc, mul(o, 0.04)), o, x, sR * 2.2, (p) => W(p), 0.45));
  }
  const bobY = M.waist + hC * 0.62, cordTop = sealY - sR;
  const cord = [];
  for (let m = 0; m <= 12; m++) { const yy = cordTop + (bobY + 0.3 - cordTop) * (m / 12), q = F.ta(t(yy), 0); cord.push({ p: add(q.p, mul(q.n, courseOff(yy) + 0.03)), n: q.n }); }
  out.push(tube(cord, { r: 0.03, k: 3, mat: 'pbB', w: (p) => W(p) }));
  // (the bob: turned, its shoulder broad, its point down, set into the course)
  { const q = F.ta(t(bobY), 0), o = q.n, cc = add(q.p, mul(o, courseOff(bobY) + 0.08));
    const prof = [[0.3, 0.001], [0.27, 0.06], [0.2, 0.11], [0.1, 0.16], [-0.05, 0.17], [-0.2, 0.12], [-0.33, 0.04], [-0.38, 0.001]];
    const R = fem(B) ? 1.3 : 1.55;
    const bob = patch((u, v) => { const [dy, r] = prof[Math.round(u * 7)], a = v * TAU, d = [Math.sin(a) * r * R, dy * R, Math.cos(a) * r * R]; return { p: add(cc, d), n: unit([Math.sin(a), 0, Math.cos(a)]) }; }, 7, 8, { closed: true });
    out.push(solid(bob, { sheet: true, w: (p) => W(p), mat: (i) => (i === 3 ? 'pbS' : 'pbL') }));
  }
  return { parts: out, F, M, W, courses };
}

/** The faulds: two hoops below the waist, battered out like a wall's foot, the lower's hem cut in crenels; shorter behind. */
function faulds(B, W) {
  const M = marks(B), F = torsoField(B), t = F.tOfY, out = [];
  const behind = (a) => smooth(1.6, 2.7, Math.abs(wrapAngle(a)));
  const fBot = (a) => lerp([0, M.fauld - 0.1, 0], [0, M.waist - 0.5, 0], behind(a))[1] + 0.15 * Math.sin(a) ** 2;
  const mid = (a) => lerp([0, M.waist, 0], [0, fBot(a), 0], 0.45)[1];
  const NV = 40;
  const h0 = plateOn(F, { a0: -PI, a1: PI, closed: true, t0: (a) => t(mid(a) - 0.06), t1: () => t(M.waist + 0.12), nu: 3, nv: NV, off: (u) => 0.24 + 0.12 * (1 - u) });
  out.push(solid(h0, { hollow: true, w: (p) => W(p), thick: 0.05, mat: () => 'pb', edge: 'pbS' }));
  // (the lower hoop: its bottom row in merlons and crenels, eight before and behind)
  const nu = 2, notch = (j) => Math.floor(j / 2) % 2 === 1;
  const h1 = plateOn(F, { a0: -PI, a1: PI, closed: true, t0: (a) => t(fBot(a)), t1: (a) => t(mid(a) + 0.04), nu, nv: NV, off: (u, v, tt, a) => 0.34 + (0.16 + 0.1 * Math.sin(a) ** 2) * (1 - u) });
  out.push(solid(h1, { hollow: true, w: (p) => W(p), thick: 0.05, mat: () => 'pb', edge: 'pbS' }));
  void notch;
  out.push(tube(rowPath(h1, 0, 0, NV, 18), { r: 0.05, k: 4, mat: 'pbL', w: (p) => W(p), closed: true }));
  out.push(...studsAlong(rowPath(h1, 0.45, 0, NV, NV * 2), 8, { from: 0, to: 7 / 8, r: 0.05, h: 0.045, k: 5, mat: 'pbS', capMat: 'pbB', w: (p) => W(p) }));
  out.push(tube(rowPath(h1, 1.0, 0, NV, 18), { r: 0.035, k: 3, mat: 'pbS', w: (p) => W(p), closed: true }));
  // (the oxblood under-tunic's hem showing below the faulds, moving with the thighs as cloth does)
  const WL = nearSkinW(B, (q) => shareW(B, q.w, 'torso', 'thigh') > 0.8, (n) => TORSO_BONES.has(n) || n.startsWith('thigh_'), 0.35);
  const drop = (a) => (fem(B) ? 0.34 : 0.4) - 0.06 * Math.sin(a) ** 2 - 0.08 * Math.max(0, Math.cos(a));
  // (in two skirts, one over each thigh, slit before and behind, so each goes with its own leg)
  for (const [a0, a1] of [[0.34, PI - 0.22], [-PI + 0.22, -0.34]]) {
    const sk = plateOn(F, { a0, a1, t0: (a) => t(fBot(a) - drop(a)), t1: (a) => t(mid(a)), nu: 3, nv: NV / 2, off: (u, v, tt, a) => 0.22 + (0.1 + 0.08 * Math.sin(a) ** 2) * (1 - u) });
    out.push(smoothWeights(solid(sk, { sheet: true, w: (p) => WL(p), mat: () => 'wool' }), 3));
    out.push(tube(pathOn(sk, [[2.2, 0], [1, 0], [0, 0.15], ...[...Array(11).keys()].map((m) => [0, 1 + ((NV / 2 - 2) * m) / 10]), [0, NV / 2 - 0.15], [1, NV / 2], [2.2, NV / 2]], 0.01), { r: 0.035, k: 3, mat: 'woolD', w: (p) => WL(p) }));
  }
  return out;
}

/** The arm's skin samples on side `s` of the parts given, more than `k` of their weight. */
const armPick = (B, s, parts, k = 0.6) => (q) => (s === 'l' ? q.p[0] > 0.15 : q.p[0] < -0.15) && shareW(B, q.w, ...parts) > k;
const armBones = (s) => (n) => n.endsWith(`_${s}`);

/** The helm's plates' points (not its aventail): what the pieces under it keep clear of. */
const helmShell = (B) => { const H = leadHelm(B), keep = new Set(); H.F.forEach((f) => { if (f.mat !== 'gamD') f.v.forEach((i) => keep.add(i)); }); return { V: [...keep].map((i) => H.V[i]) }; };
const SIZES = new WeakMap();
function bastionSize(B) {
  if (SIZES.has(B)) return SIZES.get(B);
  const sh = B.at.shoulder.l, H = helmShell(B), hb = Math.min(...H.V.map((p) => p[1]));
  const helmSide = Math.max(...H.V.filter((p) => p[1] < hb + 0.45).map((p) => Math.abs(p[0])));
  const yBot = sh[1] - (fem(B) ? 0.62 : 0.72), clear = fem(B) ? 0.14 : 0.16;
  const S = skinSamples(B).filter((q) => q.p[0] > 0.15 && shareW(B, q.w, 'shoulder', 'upperarm') > 0.5 && q.p[1] > yBot - 0.1);
  // (from just outside the helm's foot, the roof kept under it there, out past the arm)
  const inX = helmSide + (fem(B) ? -0.04 : 0.04), outX = Math.max(...S.map((q) => q.p[0])) + clear;
  let cx = sh[0] + 0.12, Rx = cx - inX;
  if (cx + Rx < outX) { cx = (inX + outX) / 2; Rx = (outX - inX) / 2; }
  const cz = sh[2] + 0.02;
  let Rz = 0;
  for (const q of S) { const dx = (q.p[0] - cx) / Rx; if (Math.abs(dx) < 0.6) Rz = Math.max(Rz, (Math.abs(q.p[2] - cz) + clear) / Math.sqrt(1 - dx * dx)); }
  Rz = Math.min(Rz, Rx * (fem(B) ? 1.7 : 1.35));
  const T = skinSamples(B).filter((q) => Math.abs(q.p[0]) > inX + (fem(B) ? 0.02 : 0.25) && Math.abs(q.p[0]) < cx + Rx && Math.abs(q.p[2] - cz) < Rz && hdW(B, q.w) < 0.1);
  const skinTop = Math.max(...T.map((q) => q.p[1]));
  // (the height nothing of the bastion may rise above at a distance x out: a hand under the helm's foot)
  const low = H.V.map((p) => [Math.abs(p[0]), p[1]]);
  const capY = (x) => low.reduce((m, [hx, hy]) => (hx > x - 0.5 && hx < x + 0.12 ? Math.min(m, hy - 0.34 + 0.6 * Math.max(0, x - 0.32 - hx) - 0.5 * Math.max(0, hx - x + 0.12)) : m), 9);
  const D = { cx, cz, Rx, Rz, skinTop, yBot, capY };
  SIZES.set(B, D);
  return D;
}
/**
 * The bastion: a drum round the shoulder, open toward the body under the arm, its courses jointed, a ring of corbels
 * under its parapet, merlons on its outer half, a cone of lead roofing over it with a knop; an arrow-loop on its face.
 */
function bastion(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, sh = A.shoulder[s], out = [];
  const wSh = mixOf(B, [[`shoulder_${s}`, 0.5], [`upperarm_${s}`, 0.15], [`clavicle_${s}`, 0.35]]);
  const inner = -sg * PI / 2, gapA = 1.15;
  // (measured on the left and mirrored: an oval drum from a hand clear of the helm's foot out past the arm, deep enough
  // front to back to hold the shoulder; its roof clear of the skin under it)
  const D = bastionSize(B), c = [sg * D.cx, 0, D.cz], Rx = D.Rx, Rz = D.Rz, skinTop = D.skinTop, yBot = D.yBot, capped = (p) => [p[0], Math.min(p[1], D.capY(Math.abs(p[0]))), p[2]];
  const R = Math.max(Rx, Rz), sec = (a) => 1 / Math.hypot(Math.sin(a) / Rx, Math.cos(a) / Rz);
  const yWall = skinTop + 0.06, yPar = yWall + 0.22, yRoof = yPar - 0.04, hRoof = fem(B) ? 0.42 : 0.5;
  const A0 = anglesWith(28, [], 0.05).filter((a) => Math.abs(wrapAngle(a - inner)) >= gapA - 0.01);
  // (the columns from the open side's one edge round the outside to its other: an open grid)
  const start = wrapAngle(inner + gapA), cols = A0.map((a) => wrapAngle(a - start)).map((d) => (d < 0 ? d + TAU : d)).sort((x, y2) => x - y2).map((d) => start + d);
  cols.push(start + TAU - 2 * gapA);
  const rows = [[yBot, 1.04], [yBot + 0.08, 1.04], [yBot + 0.1, 1.0], [lerp([yBot], [yWall], 0.5)[0], 1.0], [yWall, 1.0], [yWall + 0.06, 1.09], [yPar, 1.09], [yPar, 1.09, 0.12], [yRoof, 1.09, 0.12]];
  const P = rows.map(([yy, k, ins = 0]) => cols.map((a) => capped([c[0] + Math.sin(a) * (sec(a) * k - ins), yy, c[2] + Math.cos(a) * (sec(a) * k - ins)])));
  const G = gridOf(P, { out: (i, j) => [Math.sin(cols[j]), 0, Math.cos(cols[j])] });
  G.Y = rows.map((r) => r[0]); G.A = cols;
  const nv = cols.length - 1;
  out.push(solid(G, { hollow: true, thick: 0.05, w: () => wSh, mat: (i) => (i === 0 ? 'pbS' : i === 1 ? 'pbB' : i === 4 ? 'pbS' : i >= 5 ? 'pbB' : 'pb'), edge: 'pbS' }));
  out.push(tube(rowPath(G, 1, 0, nv, Math.ceil(nv / 2)), { r: 0.045, k: 3, mat: 'pbS', w: () => wSh }));
  out.push(tube(rowPath(G, 6, 0, nv, Math.ceil(nv / 2)), { r: 0.04, k: 3, mat: 'pbL', w: () => wSh }));
  // (the course joints, staggered)
  for (let m = 0; m < 6; m++) for (const [i0, i1, ph] of [[2, 3, 0], [3, 4, 0.5]]) {
    const j = ((m + ph + 0.25) / 6) * nv;
    if (j < 0.6 || j > nv - 0.6) continue;
  }
  // (white oxide in the courses' corners)
  // (corbels under the parapet's step)
  for (let m = 0; m < 6; m++) {
    const j = ((m + 0.5) / 6) * nv, q = G.at(4 - 0.35, j), o = unit([q.n[0], 0, q.n[2]]), x = unit(cross([0, 1, 0], o));
    out.push(block(add(q.p, mul(o, 0.03)), mul(x, 0.05), [0, 0.07, 0], mul(o, 0.035), { mat: 'pbS', w: () => wSh }));
  }
  // (merlons over the outer half)
  const outer = sg * PI / 2;
  out.push(...merlons(c, { count: 8, a0: outer, frac: 0.55, y0: yPar, h: fem(B) ? 0.2 : 0.24, r: (a) => sec(a) * 1.09, thick: 0.1, mat: 'pb', edge: 'pbL', w: () => wSh, skip: (k) => k >= 3 && k <= 5 }));
  // (the roof: a cone of lead over it, from inside the parapet, its rolls down it)
  const cone = patch((u, v) => { const a = v * TAU, r = (sec(a) * 1.09 - 0.12) * (1 - u) + 0.001, yy = yRoof + hRoof * u ** 0.9; return { p: capped([c[0] + Math.sin(a) * r, yy, c[2] + Math.cos(a) * r]), n: unit([Math.sin(a), 0.6, Math.cos(a)]) }; }, 3, 16, { closed: true });
  out.push(solid(cone, { sheet: true, w: () => wSh, mat: () => 'roof' }));
  out.push(stud(sub(capped([c[0], yRoof + hRoof, c[2]]), [0, 0.03, 0]), [0, 1, 0], { r: 0.07, h: 0.13, k: 5, mat: 'pbL', w: () => wSh }));
  // (the arrow-loop on its face: a cross of dark slits, lit from within when enchanted, its lips bright)
  const la = outer - sg * 0.55, lj = cols.findIndex((a, j) => j + 1 < cols.length && Math.cos(a - la) > 0 && wrapAngle(la - a) >= 0 && wrapAngle(cols[j + 1] - la) >= 0) + 0.5;
  const ly = 2.75;
  // (its lips worn bright)
  out.push(band(colPath(G, lj, ly - 0.62, ly + 1.02, 4, 0.002), { wide: 0.15, high: 0.008, mat: 'pbL', w: () => wSh }));
  out.push(band(rowPath(G, ly + 0.45, lj - 1.0, lj + 1.0, 4, 0.002), { wide: 0.15, high: 0.008, mat: 'pbL', w: () => wSh }));
  out.push(band(colPath(G, lj, ly - 0.55, ly + 0.95, 4, 0.005), { wide: 0.08, high: 0.016, mat: 'rune', w: () => wSh }));
  out.push(band(rowPath(G, ly + 0.45, lj - 0.9, lj + 0.9, 4, 0.005), { wide: 0.08, high: 0.016, mat: 'rune', w: () => wSh }));
  out.bastion = { c, R, yRoof, hRoof, yBot, inner };
  return out;
}

/** One arm below the bastion: rerebrace, the couter with its seal, the vambrace in two courses, the gauntlet's cuff. */
function armHarness(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, sh = A.shoulder[s], el = A.elbow[s], wr = A.wrist[s], out = [];
  const upDir = unit(sub(el, sh)), foreDir = unit(sub(wr, el)), uaLen = len(sub(el, sh)), faLen = len(sub(wr, el));
  const upPick = armPick(B, s, ['upperarm', 'shoulder']);
  const UA = limbWrap(B, sh, el, sg, { t: [0.0, 0.92], nt: 16, a: [-PI, PI], closed: true, na: 20, pick: upPick, smooth: 3, shape: (r) => r });
  const wUp = skinW(B, (q) => upPick(q) && along(q.p, sh, el) > 0.3 && along(q.p, sh, el) < 0.8, armBones(s));
  const rere = plateOn(UA, { a0: -PI / 2 + 0.3, a1: (3 * PI) / 2 - 0.3, t0: () => 0.3, t1: () => 0.86, nu: 4, nv: 18, off: (u) => 0.15 + 0.02 * u });
  out.push(tube(rowPath(rere, 0, 0, 18, 12, 0.01), { r: 0.03, k: 3, mat: 'pbS', w: () => wUp }));
  out.push(solid(rere, { sheet: true, w: () => wUp, mat: () => 'pb' }));
  // -- the couter: a cup over the elbow, a great seal on its outside
  const c0 = sub(el, mul(upDir, uaLen * 0.22)), c1 = add(el, mul(foreDir, faLen * 0.22));
  const elPick = (q) => armPick(B, s, ['upperarm', 'forearm'], 0.6)(q) && len(sub(q.p, el)) < 0.9;
  const EL = limbWrap(B, c0, c1, sg, { t: [0, 1], nt: 10, a: [-PI, PI], closed: true, na: 22, pick: elPick, smooth: 3, shape: (r) => r });
  const wEl = boneW(B, `elbow_${s}`);
  const cup = plateOn(EL, { a0: 0.8, a1: 2 * PI - 0.8, t0: () => 0.04, t1: () => 0.96, nu: 6, nv: 16, off: (u, v) => 0.17 + 0.08 * Math.sin(PI * u) * Math.sin(PI * v) });
  out.push(solid(cup, { hollow: true, thick: 0.05, w: () => wEl, mat: () => 'pb', edge: 'pbS' }));

  const ec = EL.ta(0.5, PI / 2), so = unit(add(ec.n, [0, 0, -0.2]));
  out.push(seal(add(ec.p, mul(so, 0.26)), so, { r: fem(B) ? 0.27 : 0.32, thick: 0.08, mat: 'pbM', ring: 'pbB', mark: 'pbS', k: 10, w: () => wEl }));
  // -- the vambrace: two courses, the upper lapped over the lower
  const faPick = armPick(B, s, ['forearm'], 0.6);
  const FA = limbWrap(B, el, wr, sg, { t: [0, 1.0], nt: 14, a: [-PI, PI], closed: true, na: 20, pick: faPick, smooth: 3, shape: (r) => r });
  const wFa = skinW(B, (q) => faPick(q) && along(q.p, el, wr) > 0.25 && along(q.p, el, wr) < 0.85, armBones(s));
  for (const [t0, t1, off, m, loop] of [[0.5, 0.86, 0.1, 'pb', false], [0.16, 0.54, 0.14, 'pb', true]]) {
    const g = plateOn(FA, { a0: -PI, a1: PI, closed: true, t0: () => t0, t1: () => t1, nu: 3, nv: 20, off: (u) => off + 0.03 * (1 - u) });
    out.push(solid(g, { hollow: true, thick: 0.04, w: () => wFa, mat: () => m, edge: 'pbS' }));
    out.push(tube(rowPath(g, 3, 0, 20, 12), { r: 0.035, k: 3, mat: 'pbS', w: () => wFa, closed: true }));
    // (an arrow-loop on its outside, dark: the forearm a tower too)
    if (loop) { out.push(band(colPath(g, 15, 0.45, 2.6, 3, 0.004), { wide: 0.065, high: 0.012, sink: 0, mat: 'pbD', w: () => wFa })); out.push(band(rowPath(g, 1.75, 14.1, 15.9, 2, 0.004), { wide: 0.06, high: 0.012, sink: 0, mat: 'pbD', w: () => wFa })); }

  }
  // -- the gauntlet's cuff, flared back over the wrist
  const wWr = mixOf(B, [[`hand_${s}`, 0.5], [`wrist_${s}`, 0.25], [`lowerarm_${s}`, 0.25]]);
  const cuff = plateOn(FA, { a0: -PI, a1: PI, closed: true, t0: () => 0.78, t1: () => 1.05, nu: 3, nv: 20, off: (u) => 0.28 - 0.16 * u });
  out.push(solid(cuff, { hollow: true, thick: 0.04, w: () => wWr, mat: () => 'pb', edge: 'pbS' }));
  out.push(tube(rowPath(cuff, 0, 0, 20, 12), { r: 0.04, k: 3, mat: 'pbL', w: () => wWr, closed: true }));
  return out;
}

/**
 * The gorget: two lames round the neck's foot, the lower spread over the shoulders' tops to the bastions, the upper a
 * collar standing up under the helm's foot; rolled edges, rivets.
 */
function gorget(B) {
  const A = B.at, M = marks(B), F = torsoField(B), t = F.tOfY, out = [], n = A.neck[1];
  const wNeck = mixOf(B, [['neck_01', 0.5], ['spine_03', 0.5]]);
  const W = nearSkinW(B, (q) => shareW(B, q.w, 'torso', 'neck') > 0.8 && hdW(B, q.w) < 0.2 && q.p[1] > M.pit - 0.2, (nn) => ['spine_03', 'neck_01', 'clavicle_l', 'clavicle_r'].includes(nn), 0.35);
  const wMid = (p) => mixW([[wNeck, 0.45], [W(p), 0.55]]);
  const NV = 32;
  // (the lower lame: its foot low before and behind over the plates' necklines, high at the sides over the shoulders)
  const side = (a) => Math.sin(Math.abs(wrapAngle(a))) ** 2, behind = (a) => smooth(0.5, 2.6, Math.abs(wrapAngle(a)));
  const foot = (a) => lerp([0, M.neckF - 0.2, 0], [0, M.neckB - 0.2, 0], behind(a))[1] + (fem(B) ? 0.36 : 0.48) * side(a);
  const yTopL = (a) => n - 0.28 + (fem(B) ? 0.0 : 0.12) * side(a);
  const lo = plateOn(F, { a0: -PI, a1: PI, closed: true, t0: (a) => t(Math.min(foot(a), yTopL(a) - 0.12)), t1: (a) => t(yTopL(a)), nu: 3, nv: NV, maxUp: 0.35, off: (u, v, tt, a) => 0.2 + 0.08 * (1 - u) + 0.06 * side(a) });
  out.push(solid(lo, { hollow: true, thick: 0.05, w: (p) => wMid(p), mat: () => 'pb', edge: 'pbS' }));
  out.push(tube(rowPath(lo, 0, 0, NV, 20), { r: 0.04, k: 3, mat: 'pbL', w: (p) => wMid(p), closed: true }));
  out.push(...studsAlong(rowPath(lo, 0.8, 0, NV, NV), 8, { from: 0, to: 7 / 8, r: 0.04, h: 0.035, k: 4, mat: 'pbS', capMat: 'pbB', w: (p) => wMid(p) }));
  // (the collar)
  // (round the neck alone, not out over the shoulders' slope: as far out as the neck reaches and a hand more)
  const cy0 = (a) => n - 0.24 + (fem(B) ? 0.08 : 0.1) * side(a), cy1 = (a) => n + (fem(B) ? 0.1 : -0.03) - (fem(B) ? 0.04 : 0.07) * side(a) + (fem(B) ? 0.04 : 0.07) * behind(a);
  const NS = skinSamples(B).filter((q) => hdW(B, q.w) < 0.3 && shareW(B, q.w, 'upperarm', 'shoulder') < 0.2 && q.p[1] > n - 0.5 && q.p[1] < n + 0.25).map((q) => ({ p: q.p, a: Math.atan2(q.p[0], q.p[2] - F.zc(n)), r: Math.hypot(q.p[0], q.p[2] - F.zc(n)) }));
  const nreach = (a) => NS.reduce((m, q) => (Math.abs(wrapAngle(q.a - a)) < 0.3 && q.p[1] > cy0(a) - 0.1 && q.p[1] < cy1(a) + 0.05 ? Math.max(m, q.r) : m), 0);
  const colOf = (a0, a1) => patch((u, v) => { const a = a0 + (a1 - a0) * v, yy = lerp([cy0(a)], [cy1(a)], u)[0], r = nreach(a) + 0.2 + 0.17 * behind(a) + 0.04 * (1 - u); return { p: [Math.sin(a) * r, yy, F.zc(n) + Math.cos(a) * r], n: [Math.sin(a), 0, Math.cos(a)] }; }, 2, 10);
  for (const [a0, a1] of [[-0.92, 0.92], [PI - 1.25, PI + 1.25]]) {
    const col = colOf(a0, a1);
    out.push(solid(col, { hollow: true, thick: 0.05, w: () => wNeck, mat: () => 'pb', edge: 'pbS' }));
    out.push(tube(rowPath(col, 2, 0, 10, 10), { r: 0.04, k: 3, mat: 'pbS', w: () => wNeck }));
  }
  return out;
}

/**
 * The wall-walk over each shoulder: a sheet of lead laid on the top of the shoulder from the gorget out under the
 * bastion's roof, as near the skin as its highest point near each place and a hand more, its front edge rolled.
 */
function wallWalk(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, D = bastionSize(B), out = [];
  const S = skinSamples(B).filter((q) => q.p[0] * sg > 0.2 && q.p[1] > A.neck[1] - 0.9 && hdW(B, q.w) < 0.2 && shareW(B, q.w, 'upperarm', 'forearm', 'hand') < 0.3);
  const x0 = fem(B) ? 0.74 : 1.08, x1 = D.cx - D.Rx * 0.35, z0 = D.cz - D.Rz * 0.62, z1 = D.cz + D.Rz * 0.6;
  const yAt = (x, z) => S.reduce((m, q) => (Math.hypot(q.p[0] - x, q.p[2] - z) < 0.16 && q.p[0] * sg > x0 - 0.08 ? Math.max(m, q.p[1]) : m), -9);
  const W = nearSkinW(B, (q) => q.p[0] * sg > 0.2 && shareW(B, q.w, 'upperarm', 'forearm', 'hand') < 0.3 && q.p[1] > A.neck[1] - 1.2, (n) => ['spine_03', 'clavicle_' + s, 'shoulder_' + s, 'neck_01'].includes(n), 0.12);
  const G = patch((u, v) => { const x = sg * (x0 + (x1 - x0) * u), z = z0 + (z1 - z0) * v; return { p: [x, yAt(x, z) + 0.09 + 0.02 * u - 0.02 * (1 - v) * (1 - u), z], n: [0, 1, 0] }; }, 4, 6);
  // (smoothed across, so it lies as a sheet, not over every bump)
  for (let it = 0; it < 2; it++) G.P = G.P.map((row, i) => row.map((p, j) => { const nb = [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < G.P.length && b < row.length).map(([a, b]) => G.P[a][b][1]); return [p[0], Math.max(p[1], nb.reduce((t, x) => t + x, 0) / nb.length), p[2]]; }));
  out.push(solid(gridOf(G.P, { out: () => [0, 1, 0] }), { sheet: true, w: (p) => W(p), mat: () => 'pb' }));
  out.push(tube(colPath(gridOf(G.P, { out: () => [0, 1, 0] }), 6, 0, 4, 4, 0.01), { r: 0.03, k: 3, mat: 'pbS', w: (p) => W(p) }));
  return out;
}

export function leadChest(B) {
  const T = cuirass(B);
  const P = coverHides(B, merge(smoothWeights(gambeson(B), 2, (p) => p[1] < B.at.neck[1] - 0.6), ...T.parts, ...gorget(B), ...faulds(B, T.W), ...bastion(B, 'l'), ...bastion(B, 'r'), ...wallWalk(B, 'l'), ...wallWalk(B, 'r'), ...armHarness(B, 'l'), ...armHarness(B, 'r')), 0.5);
  return P;
}

/* ---- the mantle: the curtain walls, the gates and the banners ---------------------------------------------------- */
/** A plumb-bob in white lead laid flat on a face: centre `c`, facing `o`, across `x`, `sz` its size; its line up from it. */
function plumbBob(c, o, x, sz, w, line = 0.55) {
  const prof = [[0.2, 0.0], [0.17, 0.05], [0.1, 0.11], [0.0, 0.12], [-0.1, 0.09], [-0.2, 0.03], [-0.25, 0.0]], up = cross(o, x);
  const bob = patch((u, v) => { const [dy, r] = prof[Math.round(u * 6)]; return { p: add(c, add(mul(x, (2 * v - 1) * r * sz), mul(up, dy * sz * 1.2))), n: o }; }, 6, 1);
  return [solid(bob, { sheet: true, w, mat: () => 'pbO' }), band([{ p: add(c, mul(up, 0.24 * sz)), n: o }, { p: add(c, mul(up, line * sz)), n: o }], { wide: 0.025, high: 0.004, sink: 0, mat: 'pbO', w })];
}
/**
 * A gate on a wall's face (`at(x, y, lift)`): an arched opening `gW` across and `gH` to the spring of its arch from its
 * sill at `g0`, dark and lit from within when enchanted; its voussoirs in pale lead round it, a keystone, the bars of
 * its portcullis over it.
 */
function gateOn(at, g0, gW, gH, w, o = {}) {
  const out = [], arch = (x) => g0 + gH + Math.sqrt(Math.max(0, gW * gW - x * x));
  out.push(solid(patch((u, v) => { const x = -gW + 2 * gW * v; return at(x, g0 + (arch(x) - g0) * u, 0.012); }, 2, 10), { sheet: true, w, mat: () => 'rune' }));
  const rim = [];
  const nr = o.bars === false ? 8 : 14;
  for (let k = 0; k <= nr; k++) { const an = (PI * k) / nr; rim.push(at(Math.cos(an) * (gW + 0.045), g0 + gH + Math.sin(an) * (gW + 0.045))); }
  out.push(band([at(gW + 0.045, g0 - 0.02), ...rim, at(-gW - 0.045, g0 - 0.02)], { wide: o.rim ?? 0.1, high: 0.05, sink: 0, mat: 'pbL', w }));
  const ks = rim[nr / 2];
  out.push(stud(add(ks.p, mul(ks.n, 0.04)), ks.n, { r: 0.075, h: 0.05, k: 4, mat: 'pbB', w }));
  if (o.bars === false) return out;
  for (const x of [-gW * 0.5, 0, gW * 0.5]) out.push(band([at(x, g0 - 0.04, 0.012), at(x, arch(x) - 0.02, 0.012)], { wide: 0.045, high: 0.035, sink: 0, mat: 'pbS', w }));
  for (const f of [0.3, 0.6, 0.88]) { const yy = g0 + (gH + gW) * f, hw = yy > g0 + gH ? Math.sqrt(Math.max(0, gW * gW - (yy - g0 - gH) ** 2)) : gW; out.push(band([at(-hw + 0.02, yy, 0.012), at(hw - 0.02, yy, 0.012)], { wide: 0.04, high: 0.03, sink: 0, mat: 'pbS', w })); }
  return out;
}
/**
 * The mantle: the castle's curtain walls between the bastions. Before, a low wall across the top of the breast, its
 * merlons under the helm, a gate-tower at its middle (the clasp: its gate lit), and from its foot two oxblood banners
 * swallow-tailed to the waist, a plumb-bob on each; behind, a higher wall across the shoulders, its merlons, its gate
 * with the portcullis lit from within, an oxblood banner hung from the battlements over it.
 */
export function leadMantle(B) {
  const A = B.at, M = marks(B), out = [];
  const D = bastionSize(B), X = D.cx - D.Rx + (fem(B) ? 0.08 : 0.1);
  const CH = leadChest(B), pts = CH.V.filter((p, i) => shareW(B, CH.W[i], 'upperarm', 'forearm', 'hand') < 0.2 && (Math.abs(p[0]) < X + 0.1));
  const wF = mixOf(B, [['spine_03', 0.8], ['spine_02', 0.2]]), wG = mixOf(B, [['spine_03', 0.75], ['spine_02', 0.25]]);
  const WT = nearSkinW(B, (q) => shareW(B, q.w, 'torso') > 0.7, (n) => TORSO_BONES.has(n), 0.35);
  const mH = fem(B) ? 0.17 : 0.2;
  // -- before, two banners down the breast, out of the arms' way across it: each hung from a short crenellated wall of
  // its own (a gatehouse's front: a merlon at each end, the gate-tower between them its clasp, the gate lit), oxblood,
  // swallow-tailed, a plumb-bob on each
  const hw = fem(B) ? 0.3 : 0.37, bot = M.waist + (fem(B) ? 0.36 : -0.02), NB = 7, thF = 0.07;
  const yH1 = M.neckF - (fem(B) ? -0.35 : -0.35), yH0 = yH1 - (fem(B) ? 0.24 : 0.28), top = yH0 + 0.1;
  const chestZ = (x, yy) => pts.reduce((m, p) => (Math.abs(p[0] - x) < 0.14 && Math.abs(p[1] - yy) < 0.2 && p[2] > 0 ? Math.max(m, p[2]) : m), 0);
  for (const sg of [-1, 1]) {
    const xc = sg * (fem(B) ? 0.56 : 0.66), hx = hw + 0.05;
    const FW = curtainWall(pts, { face: 1, x0: xc - hx, x1: xc + hx, y0: yH0, y1: yH1, yReach: yH1 + 0.05, clear: 0.06, th: thF, w: () => wF, mat: () => 'pbM', edge: 'pbS', nv: 6, maxBend: 0 });
    out.push(FW.S);
    out.push(tube([...Array(5).keys()].map((k) => FW.at(xc - hx + (2 * hx * k) / 4, yH1, -0.005)), { r: 0.035, k: 4, mat: 'pbL', w: () => wF }));
    out.push(tube([...Array(5).keys()].map((k) => FW.at(xc - hx + (2 * hx * k) / 4, yH0 + 0.02, 0.01)), { r: 0.03, k: 3, mat: 'pbS', w: () => wF }));
    out.push(...merlonsAlong((x) => FW.at(x, yH1 - 0.01), { a0: xc - hx, a1: xc + hx, count: 3, frac: 0.6, h: mH * 0.8, thick: thF, mat: 'pbM', inner: 'pbS', edge: 'pbL', w: () => wF }).filter((_, k) => k !== 1));
    // (the clasp: a gate-tower between the merlons, standing over them, its gate lit)
    {
      const tw = fem(B) ? 0.15 : 0.17, ty0 = yH0 - 0.04, ty1 = yH1 + (fem(B) ? 0.1 : 0.12), dep = 0.05;
      const q0 = FW.at(xc, (ty0 + ty1) / 2, dep - 0.02), o = q0.n, x = [1, 0, 0], up = [0, 1, 0];
      out.push(block(q0.p, mul(x, tw), mul(up, (ty1 - ty0) / 2), mul(o, dep), { mat: 'pbB', edge: 'pbS', w: () => wF }));
      for (const dx of [-0.65, 0.65]) out.push(block(add(q0.p, add(mul(x, dx * tw), mul(up, (ty1 - ty0) / 2 + mH * 0.3))), mul(x, tw * 0.3), mul(up, mH * 0.3), mul(o, dep), { mat: 'pbB', edge: 'pbL', w: () => wF }));
      const face = q0.p[2] + dep, atG = (gx, gy, lift = 0) => ({ p: [xc + gx, gy, face + lift], n: [0, 0, 1] });
      const gW = tw * 0.55;
      out.push(...gateOn(atG, ty0 + 0.06, gW, (ty1 - ty0) * 0.55 - gW, () => wF, { rim: 0.05, bars: false }));
    }
    // (the banner: from behind the wall's foot, hung straight)
    const zRow = (yy, x) => Math.max(FW.z(x) - thF * 0.5, chestZ(x, yy) + (fem(B) ? 0.1 : 0.07));
    const ban = patch((u, v) => { const yy = lerp([bot], [top], u)[0], x = xc + hw * (2 * v - 1); return { p: [x, yy, zRow(yy, x) + 0.02 * Math.sin(PI * v)], n: [0, 0, 1] }; }, NB, 4);
    for (let i = NB - 1; i >= 0; i--) ban.P[i] = ban.P[i].map((p, j) => [p[0], p[1], Math.max(p[2], ban.P[i + 1][j][2] - 0.03)]);
    // (its tails swung out off the breast, so it shows its edge from the side)
    ban.P = ban.P.map((row, i) => row.map((p) => add(p, [0, 0, (fem(B) ? 0.1 : 0.13) * (1 - i / NB) ** 2])));
    ban.P[0] = ban.P[0].map((p, j) => { const v = j / 4, k = 1 - Math.abs(2 * v - 1); return add(p, [0, 0.4 * k, 0]); });
    const wB = (p) => { const k = 0.3 + 0.7 * smooth(bot, top, p[1]); return mixW([[wF, k], [WT(p), 1 - k]]); };
    out.push(solid(ban, { sheet: true, w: wB, mat: () => 'wool' }));
    for (const j of [0, 4]) out.push(tube(colPath(ban, j, 0, NB, NB * 2, 0.01), { r: 0.025, k: 3, mat: 'woolD', w: wB }));
    const eq = ban.at(NB * 0.55, 2);
    out.push(...plumbBob(add(eq.p, [0, 0, 0.015]), [0, 0, 1], [1, 0, 0], fem(B) ? 1.1 : 1.25, wB));
    for (const j of [0, 4]) { const q = ban.at(0, j); out.push(stud(add(q.p, [0, 0, 0.01]), [0, -1, 0.3], { r: 0.05, h: 0.09, k: 4, mat: 'pbS', capMat: 'pbB', w: wB })); }
  }
  // -- the back wall: higher, across the shoulders from bastion to bastion, its gate in the middle
  const y1B = A.neck[1] - (fem(B) ? 0.48 : 0.5), y0B = y1B - (fem(B) ? 1.22 : 1.42), thB = 0.24;
  const BW = curtainWall(pts, { face: -1, x0: -X, x1: X, y0: y0B, y1: y1B, yReach: y1B + mH + 0.1, clear: 0.08, th: thB, w: () => wG, mat: () => 'pbM', edge: 'pbS', nv: 18 });
  out.push(BW.S);
  out.push(tube([...Array(13).keys()].map((k) => BW.at(-X + (2 * X * k) / 12, y1B, -0.005)), { r: 0.04, k: 4, mat: 'pbL', w: () => wG }));
  out.push(tube([...Array(13).keys()].map((k) => BW.at(-X + (2 * X * k) / 12, y0B + 0.02, 0.01)), { r: 0.035, k: 3, mat: 'pbS', w: () => wG }));
  // (a string course across it under the battlements, mid-grey)
  out.push(band([...Array(13).keys()].map((k) => BW.at(-X + (2 * X * k) / 12, y1B - 0.14, 0)), { wide: 0.08, high: 0.03, sink: 0, mat: 'pbS', w: () => wG }));
  out.push(...merlonsAlong((x) => BW.at(x, y1B - 0.01), { a0: X - 0.02, a1: -X + 0.02, count: 5, frac: 0.55, h: mH + 0.07, thick: thB, mat: 'pbM', inner: 'pbS', edge: 'pbL', w: () => wG }));
  const gW = fem(B) ? 0.27 : 0.31, gH = fem(B) ? 0.5 : 0.6, g0 = y0B + 0.08;
  out.push(...gateOn(BW.at, g0, gW, gH, () => wG));
  // (two banners either side of the gate: oxblood, swallow-tailed, hung from rods under the battlements, down over the
  // wall's face and below its foot; the plumb-bob on each)
  for (const sg of [-1, 1]) {
    const bw = fem(B) ? 0.2 : 0.23, xc = sg * (gW + 0.14 + bw), b1 = y1B - 0.06, b0 = y0B - (fem(B) ? 0.42 : 0.5), NB = 9;
    const wBk = (p) => mixW([[wG, 0.5 + 0.5 * clamp((p[1] - y0B) / (b1 - y0B))], [WT(p), 0.5 - 0.5 * clamp((p[1] - y0B) / (b1 - y0B))]]);
    const ban = patch((u, v) => { const x = xc + bw * (2 * v - 1), yy = lerp([b0], [b1], u)[0], q = BW.at(x, Math.max(yy, y0B), 0.045 + 0.015 * Math.sin(PI * v)); return { p: [q.p[0], yy, q.p[2]], n: q.n }; }, NB, 4);
    ban.P = ban.P.map((row, i) => row.map((p) => (p[1] < y0B ? add(p, [0, 0, -0.14 * ((y0B - p[1]) / (y0B - b0)) ** 1.5]) : p)));
    ban.P[0] = ban.P[0].map((p, j) => { const v = j / 4, k = 1 - Math.abs(2 * v - 1); return add(p, [0, 0.3 * k, 0]); });
    out.push(solid(ban, { sheet: true, w: wBk, mat: () => 'wool' }));
    for (const j of [0, 4]) out.push(tube(colPath(ban, j, 0, NB, NB * 2, 0.01), { r: 0.025, k: 3, mat: 'woolD', w: wBk }));
    out.push(tube([BW.at(xc - bw - 0.06, b1 + 0.02, 0.065), BW.at(xc + bw + 0.06, b1 + 0.02, 0.065)], { r: 0.03, k: 4, mat: 'pbL', w: () => wG }));
    const q = ban.at(NB * 0.5, 2);
    out.push(...plumbBob(add(q.p, mul(q.n, 0.015)), q.n, [-1, 0, 0], fem(B) ? 0.75 : 0.85, wBk, 0.4));
    for (const j of [0, 4]) { const e = ban.at(0, j); out.push(stud(add(e.p, mul(e.n, 0.01)), [0, -1, -0.3], { r: 0.045, h: 0.08, k: 4, mat: 'pbS', capMat: 'pbB', w: wBk })); }
  }
  return coverHides(B, merge(...out), 0.6);
}

/* ---- legs: the pillars ------------------------------------------------------------------------------------------- */
/** A thigh plate's weights: the thigh's skin's, averaged. */
const thighW = (B, s) => { const hp = B.at.hip[s], kn = B.at.knee[s], sg = s === 'l' ? 1 : -1; return skinW(B, (q) => q.p[0] * sg > 0.12 && shareW(B, q.w, 'thigh') > 0.6 && along(q.p, hp, kn) > 0.25 && along(q.p, hp, kn) < 0.8, (n) => n.endsWith(`_${s}`)); };
/** One leg: cuisse in three courses, the poleyn a round turret with its arrow-loop and a crenellated wing, the greave a pillar battered at its foot. */
function legHarness(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, hp = A.hip[s], kn = A.knee[s], an = A.ankle[s], out = [];
  const legBones = (n) => n.endsWith(`_${s}`);
  // -- the cuisse: three courses down the front and outside of the thigh, each lapped over the one below
  const thPick = (q) => (sg > 0 ? q.p[0] > 0.12 : q.p[0] < -0.12) && shareW(B, q.w, 'thigh') > 0.6;
  const TH = limbWrap(B, hp, kn, sg, { t: [0, 1.05], nt: 21, a: [-PI, PI], closed: true, na: 28, pick: thPick, smooth: 4, shape: (r) => r });
  const wTh = thighW(B, s);
  // (one plate shaped to the thigh, broad at the hip, narrowing to the knee, a ridge down its front; a lame under it)
  const ridgeT = (a) => 0.035 * Math.exp(-(((a - 0.5) / 0.45) ** 2));
  const cu = plateOn(TH, { a0: -0.75, a1: 2.1, t0: () => 0.66, t1: () => 0.32, nu: 5, nv: 14, off: (u, v, t, a) => 0.13 + 0.06 * u + ridgeT(a) });
  out.push(solid(cu, { hollow: true, thick: 0.045, w: () => wTh, mat: () => 'pb', edge: 'pbS' }));
  const lm = plateOn(TH, { a0: -0.7, a1: 2.05, t0: () => 0.8, t1: () => 0.63, nu: 2, nv: 12, off: (u, v, t, a) => 0.135 + 0.025 * (1 - u) + ridgeT(a) * 0.6 });
  out.push(solid(lm, { hollow: true, thick: 0.045, w: () => wTh, mat: () => 'pb', edge: 'pbS' }));
  out.push(tube(rowPath(lm, 0, 0, 12, 10), { r: 0.035, k: 3, mat: 'pbS', w: () => wTh }));
  // -- the poleyn: a round cop over the knee on the knee's own bone, its loop lit, its wing crenellated
  const kPick = (q) => (sg > 0 ? q.p[0] > 0.12 : q.p[0] < -0.12) && shareW(B, q.w, 'thigh', 'calf') > 0.8 && len(sub(q.p, kn)) < 0.9;
  const k0 = lerp(hp, kn, 0.82), k1 = lerp(kn, an, 0.15);
  const KN = limbWrap(B, k0, k1, sg, { t: [0, 1], nt: 10, a: [-PI, PI], closed: true, na: 28, pick: kPick, smooth: 4, shape: (r) => r });
  const wKn = boneW(B, `knee_${s}`);
  const cop = plateOn(KN, { a0: -1.5, a1: 1.5, t0: () => 0.0, t1: () => 1.0, nu: 7, nv: 14, off: (u, v) => 0.21 + 0.1 * Math.sin(PI * u) * Math.sin(PI * v) ** 0.6 });
  out.push(solid(cop, { hollow: true, thick: 0.05, w: () => wKn, mat: () => 'pb', edge: 'pbS' }));
  out.push(tube(rowPath(cop, 0, 0, 14, 10), { r: 0.04, k: 3, mat: 'pbS', w: () => wKn }));
  // (the loop: a cross of dark slits on the cop's face, lit when enchanted)
  out.push(band(colPath(cop, 7, 1.6, 5.4, 4, 0.004), { wide: 0.06, high: 0.01, sink: 0, mat: 'rune', w: () => wKn }));
  out.push(band(rowPath(cop, 3.9, 5, 9, 4, 0.004), { wide: 0.06, high: 0.01, sink: 0, mat: 'rune', w: () => wKn }));
  // (the wing: a plate standing off the outside of the knee, its top edge in three merlons)
  {
    const kc = KN.ta(0.5, PI / 2 - 0.2), wo = unit(add(kc.n, [0, 0, 0.3])), legDir = unit(sub(an, hp));
    const wy = unit(sub(mul(legDir, -1), mul(wo, dot(mul(legDir, -1), wo)))), wx = cross(wy, wo), wc = add(kc.p, mul(wo, 0.26));
    const wW = fem(B) ? 0.34 : 0.4, wH = fem(B) ? 0.42 : 0.5;
    // (a shield: square above, round below; merlons stand on its top)
    const G = patch((u, v) => { const x = (2 * v - 1) * wW, yy = -wH + 2 * wH * u - (1 - u) * 0.0, round = u < 0.5 ? Math.sqrt(Math.max(0, 1 - ((0.5 - u) / 0.5) ** 2)) : 1; return { p: add(wc, add(mul(wx, x * round), add(mul(wy, yy), mul(wo, 0.06 * Math.cos(PI * (v - 0.5)))))), n: wo }; }, 5, 6);
    out.push(solid(G, { w: () => wKn, thick: 0.05, mat: () => 'pbM', inner: 'pbS', edge: 'pbL' }));
    out.push(...merlonsAlong((a) => ({ p: add(wc, add(mul(wx, a), add(mul(wy, wH - 0.005), mul(wo, 0.06 * Math.cos((PI * a) / (2 * wW)))))), n: wo }), { a0: -wW, a1: wW, count: 3, frac: 0.55, h: 0.13, thick: 0.05, mat: 'pbM', inner: 'pbS', edge: 'pbL', w: () => wKn }));
    out.push(stud(add(wc, mul(wo, 0.06)), wo, { r: 0.08, h: 0.07, k: 6, mat: 'pbS', capMat: 'pbB', w: () => wKn }));
  }
  // -- the greave: closed round the calf, a pillar: courses jointed on its outside, battered out at its foot
  const cPick = (q) => (sg > 0 ? q.p[0] > 0.12 : q.p[0] < -0.12) && shareW(B, q.w, 'calf') > 0.6;
  const SH = limbWrap(B, kn, an, sg, { t: [0, 1.02], nt: 20, a: [-PI, PI], closed: true, na: 24, pick: cPick, smooth: 4, shape: (r) => r });
  const wCa = skinW(B, (q) => cPick(q) && along(q.p, kn, an) > 0.2 && along(q.p, kn, an) < 0.85, legBones);
  // (a pillar: its section the leg's, evened out toward a round that narrows from the capital under the knee to the
  // ankle, where it flares out again into its base)
  const legU = unit(sub(an, kn)), rSk = (t, a) => { const d = sub(SH.ta(t, a).p, lerp(kn, an, t)); return len(sub(d, mul(legU, dot(d, legU)))); };
  const rMax = (t) => Math.max(...[...Array(16).keys()].map((k) => rSk(t, -PI + (TAU * k) / 16)));
  const Rtop = Math.max(...[0.15, 0.25, 0.35, 0.45].map(rMax)) + 0.02, Rank = rMax(0.8) + 0.02;
  const Rdes = (t) => Rtop + (Rank - Rtop) * smooth(0.12, 0.84, t);
  const inner = (a) => Math.max(0, -Math.sin(a));
  const gOff = (t, a) => { const rs = rSk(t, a); return Math.max(0.07, rs + (Rdes(t) - rs) * (fem(B) ? 0.35 : 0.75) * (1 - 0.5 * inner(a)) + (fem(B) ? 0.045 : 0.06) - rs) + 0.025 * Math.exp(-((a / 0.3) ** 2)); };
  const calf = () => 0;
  const NG = 24;
  const greave = plateOn(SH, { a0: -PI, a1: PI, closed: true, t0: (a) => 0.93 - 0.05 * Math.max(0, -Math.cos(a)) - 0.05 * Math.max(0, Math.cos(a)) ** 2, t1: () => 0.14, nu: 9, nv: NG, off: (u, v, t, a) => gOff(t, a) + (fem(B) ? 0.1 : 0.15) * smooth(0.84, 0.93, t) * (1 - 0.8 * Math.max(0, Math.cos(a))) * (1 - 0.7 * inner(a)) + 0.1 * Math.max(0, -Math.cos(a)) * smooth(0.72, 0.9, t) });
  out.push(solid(greave, { sheet: true, w: () => wCa, mat: (i) => (i === 0 ? 'pbM' : 'pb') }));
  out.push(tube(rowPath(greave, 0, 0, NG, 16), { r: 0.05, k: 4, mat: 'pbL', w: () => wCa, closed: true }));
  out.push(tube(rowPath(greave, 1, 0, NG, 16), { r: 0.03, k: 3, mat: 'pbS', w: () => wCa, closed: true }));
  // (its capital: a flared ring of pale lead under the knee, a ring of corbels under it)
  const cap = plateOn(SH, { a0: -PI, a1: PI, closed: true, t0: () => 0.25, t1: () => 0.1, nu: 2, nv: NG, off: (u, v, t, a) => gOff(t, a) + 0.04 + 0.13 * u * (1 - 0.6 * inner(a)) });
  out.push(solid(cap, { hollow: true, thick: 0.05, w: () => wCa, mat: () => 'pbB', edge: 'pbS' }));
  out.push(tube(rowPath(cap, 2, 0, NG, 16), { r: 0.045, k: 4, mat: 'pbL', w: () => wCa, closed: true }));
  out.push(tube(rowPath(cap, 0, 0, NG, 12), { r: 0.035, k: 3, mat: 'pbS', w: () => wCa, closed: true }));
  // (three merlons on its outside: the pillar's capital a tower's top)
  out.push(...merlonsAlong((a) => { const q = cap.at(2, ((a + PI) / TAU) * NG); return { p: q.p, n: unit([q.n[0], 0, q.n[2]]) }; }, { a0: 0.75, a1: 2.15, count: 3, frac: 0.55, h: fem(B) ? 0.1 : 0.12, thick: 0.06, mat: 'pbM', inner: 'pbS', edge: 'pbL', w: () => wCa, cols: 2 }));
  for (let m = 0; m < 7; m++) {
    const j = NG * (0.42 + 0.4 * (m / 6)), q = greave.at(7.7, j), o = unit(q.n), x = unit(cross([0, 1, 0], o));
    out.push(block(add(q.p, mul(o, 0.03)), mul(x, 0.05), [0, 0.07, 0], mul(o, 0.035), { mat: 'pbS', w: () => wCa }));
  }
  // (the courses' joints round its front and outside; fluted down the shin, the flutes bright)
  for (const da of [-0.42, 0, 0.42]) out.push(tube(colPath(greave, NG / 2 + (da / TAU) * NG, 0.9, 7.2, 4, 0.01), { r: 0.035, k: 3, mat: 'pbS', w: () => wCa }));
  // (the back of the thigh: three splints riveted down it over the hose)
  for (const [a0, a1] of [[PI - 0.8, PI - 0.32], [PI - 0.22, PI + 0.22], [PI + 0.32, PI + 0.8]]) {
    const g = plateOn(TH, { a0, a1, t0: () => 0.78, t1: () => 0.36, nu: 3, nv: 2, off: () => 0.09 });
    out.push(solid(g, { sheet: true, w: () => wTh, mat: () => 'pb' }));
    out.push(...studsAlong(colPath(g, 1, 0.4, 2.6, 2, 0.01), 2, { r: 0.035, h: 0.03, k: 4, mat: 'pbS', capMat: 'pbB', w: () => wTh }));
  }
  return out;
}
/** The hose: quilted slate-teal wool over the hips, the seat, the crotch and the legs to the ankles; its waist left out under a chest piece. */
function hose(B) {
  const A = B.at, M = marks(B);
  return shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'thigh', 'calf', 'torso') > 0.6 && on(B, i, 'foot') < 0.5 && on(B, i, 'upperarm', 'forearm', 'hand', 'shoulder') < 0.05 && y(p) < M.waist + 0.25 && y(p) > A.ankle[s][1] - 0.05; },
    off: () => 0.035,
    mat: ({ p }) => (y(p) > M.hip + 0.05 ? 'gamW' : 'gam'),
  });
}
export function leadLegs(B) {
  return { P: merge(smoothWeights(hose(B), 3, (p) => p[1] > B.at.knee.l[1] + 0.6), ...legHarness(B, 'l'), ...legHarness(B, 'r')), dropAt: (f) => f.mat === 'gamW' };
}

/* ---- boots: the footings ----------------------------------------------------------------------------------------- */
/** One foot's sabaton: two lames over the instep to a broad square toe-cap, a stamped seal on the instep (its mark lit), a plinth of lead under it all. */
function sabaton(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, an = A.ankle[s], ball = A.ball[s], out = [];
  const fPick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'foot') > 0.6;
  const toes = skinSamples(B).filter(fPick);
  const tip = toes.reduce((b, q) => (q.p[2] > b[2] ? q.p : b), [0, 0, -9]);
  const from = [an[0], an[1] - 0.05, an[2] + 0.05], to = [tip[0], A.floor + 0.3, tip[2] + 0.22];
  const tBall = along(ball, from, to), tToe = along(tip, from, to);
  // (square in section toward the toe: a box toe, its front cut square)
  const FT = limbWrap(B, from, to, sg, { front: [0, 1, 0], t: [0, 1.0], nt: 24, a: [-PI, PI], closed: true, na: 24, pick: fPick, smooth: 4,
    shape: (r, t, a) => { const sq = smooth(tBall - 0.2, tToe, t), k = 1 / ((Math.abs(Math.cos(a)) ** 4 + Math.abs(Math.sin(a)) ** 4) ** 0.25); return r * (1 + (k - 1) * sq * 0.8) * (t > 0.93 ? Math.max(0.15, 1 - (t - 0.93) / 0.07) : 1); } });
  const wFoot = boneW(B, `foot_${s}`), wBall = boneW(B, `ball_${s}`);
  const l0 = 0.27, l1 = tBall - 0.02, h = (l1 - l0) / 2;
  for (let k = 0; k < 2; k++) {
    const t0 = l0 + h * k, t1 = t0 + h + 0.04;
    const g = plateOn(FT, { a0: -1.75, a1: 1.75, t0: () => t0, t1: () => t1, nu: 2, nv: 10, off: (u) => 0.13 - 0.012 * k + 0.035 * (1 - u) });
    out.push(solid(g, { hollow: true, w: () => wFoot, thick: 0.04, mat: () => 'pb', edge: 'pbS' }));
    out.push(tube(rowPath(g, 2, 0, 10, 10), { r: 0.04, k: 3, mat: 'pbS', w: () => wFoot }));
  }
  // (the toe: a box of lead, square in section and square at its front, broader at its front than at the ball, like a
  // footing stone; its edges rolled bright)
  {
    const d = unit([tip[0] - ball[0], 0, tip[2] - ball[2]]), xs = cross([0, 1, 0], d);
    const near = toes.filter((q) => dot(sub(q.p, ball), d) > -0.3);
    const hw = Math.max(...near.map((q) => Math.abs(dot(sub(q.p, ball), xs)))) + (fem(B) ? 0.06 : 0.1), topB = Math.max(...near.map((q) => q.p[1])) + (fem(B) ? 0.16 : 0.12);
    const L0 = fem(B) ? 0.02 : -0.1, L1 = dot(sub(tip, ball), d) + 0.24, yb = A.floor + 0.03, rr = 0.07;
    // (square in section, its top falling to the front, its front edge bevelled down to a low lip; a lame line across
    // it, rolled bright, where the toe-cap laps the lame behind)
    const sect = (u) => { const w = hw * (1 + 0.06 * u), top = u > 0.9 ? lerp([A.floor + (fem(B) ? 0.27 : 0.3)], [yb + 0.11], (u - 0.9) / 0.1)[0] : lerp([topB], [A.floor + (fem(B) ? 0.27 : 0.3)], (u / 0.9) ** 1.2)[0]; return { wl: w, wr: w, top }; };
    const rr2 = 0.09;
    const prof = (v, wl, wr, top) => {
      const r2 = Math.min(rr2, (top - yb) * 0.45);
      const pts = [[-wl, yb], [-wl, top - r2], [-wl + r2 * 0.3, top - r2 * 0.3], [-wl + r2, top], [wr - r2, top], [wr - r2 * 0.3, top - r2 * 0.3], [wr, top - r2], [wr, yb]];
      const k = v * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(k)), f = k - i;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
    };
    const at = (u, x, yy) => add(add(ball, mul(d, L0 + (L1 - L0) * u)), add(mul(xs, x), [0, yy - ball[1], 0]));
    const US = [0, 0.22, 0.45, 0.47, 0.7, 0.9, 1];
    const box = gridOf(US.map((u) => [...Array(8).keys()].map((j) => { const { wl, wr, top } = sect(u), [x, yy] = prof(j / 7, wl, wr, top); return at(u, x, yy); })), { out: (i, j) => { const [x, yy] = prof(j / 7, 1, 1, 1); return unit(add(mul(xs, x), [0, Math.max(0, yy - 0.8) * 3, 0])); } });
    const uOf = (p) => clamp((dot(sub(p, ball), d) - L0) / (L1 - L0)), wBox = (p) => mixW([[wFoot, 1 - smooth(0.05, 0.45, uOf(p))], [wBall, smooth(0.05, 0.45, uOf(p))]]);
    // (the rear lame darker, the toe-cap paler, the bevel bright)
    out.push(solid(box, { sheet: true, w: (p) => wBox(p), mat: (i) => (i === 2 ? 'pbS' : i === 5 ? 'pbM' : 'pb') }));
    const { wl: fl0, top: tf } = sect(1);
    const front = patch((u, v) => ({ p: at(1, -fl0 + 2 * fl0 * v, yb + (tf - yb) * u), n: d }), 1, 2);
    out.push(solid(front, { sheet: true, w: (p) => wBox(p), mat: () => 'pb' }));
    out.push(tube([0, 1, 2, 3, 4, 5, 6, 7].map((j) => { const { wl, wr, top } = sect(1), [x, yy] = prof(j / 7, wl, wr, top); return { p: at(1, x, yy), n: d }; }), { r: 0.04, k: 4, mat: 'pbL', w: (p) => wBox(p) }));
    // (the lame line: a rolled edge over the box, a rivet at each end)
    const line = [0, 1, 2, 3, 4, 5, 6, 7].map((j) => { const { wl, wr, top } = sect(0.47), [x, yy] = prof(j / 7, wl, wr, top); return { p: at(0.47, x * 1.02, yy + 0.01), n: unit(add(mul(xs, x), [0, 0.5, 0])) }; });
    out.push(tube(line, { r: 0.045, k: 4, mat: 'pbS', w: (p) => wBox(p) }));
    for (const q of [line[1], line[6]]) out.push(stud(q.p, q.n, { r: 0.045, h: 0.04, k: 4, mat: 'pbS', capMat: 'pbB', w: (p) => wBox(p) }));
    // (the bevel's top edge, a ridge down the cap's middle)

  }
  // (the seal on the instep: stamped, its mark lit when enchanted)
  { const q = FT.ta(l0 + (l1 - l0) * 0.75, 0), o = unit(q.n); out.push(seal(add(q.p, mul(o, 0.2)), o, { r: fem(B) ? 0.17 : 0.2, thick: 0.06, mat: 'pbB', ring: 'pbL', mark: 'rune', k: 8, w: () => wFoot })); }
  return out;
}
/** The shoe under the sabatons, and the plinth: a slab of lead under each foot, its edge stepped out and bright. */
function shoe(B) {
  const A = B.at;
  const P = shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'foot', 'calf') > 0.6 && y(p) < A.ankle[s][1] + 0.3; },
    off: () => 0.05,
    mat: ({ n }) => (n[1] < -0.55 ? 'sole' : 'pb'),
  });
  return P;
}
function plinth(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, out = [];
  const S = skinSamples(B).filter((q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'foot') > 0.5 && q.p[1] < A.floor + 0.5);
  // (its outline: the foot's footprint, rounded out a hand and squared at the toe)
  const cx = S.reduce((m, q) => m + q.p[0], 0) / S.length, cz = S.reduce((m, q) => m + q.p[2], 0) / S.length;
  const N = 20, R = [...Array(N).keys()].map((j) => { const a = (TAU * j) / N; let r = 0; for (const q of S) { const dx = q.p[0] - cx, dz = q.p[2] - cz, d = Math.hypot(dx, dz); if (Math.abs(wrapAngle(Math.atan2(dx, dz) - a)) < 0.35) r = Math.max(r, d); } return r; });
  const sm = R.map((r, j) => Math.max(r, (R[(j + 1) % N] + R[(j + N - 1) % N] + r) / 3) + 0.1);
  const wF = mixOf(B, [[`foot_${s}`, 0.6], [`ball_${s}`, 0.4]]);
  const ring = (k, yy) => sm.map((r, j) => { const a = (TAU * j) / N; return [cx + Math.sin(a) * r * k, yy, cz + Math.cos(a) * r * k]; });
  const y0 = A.floor - 0.13, y1 = A.floor + 0.02, y2 = A.floor + 0.06;
  const rows = [ring(0.001, y0), ring(1, y0), ring(1, y1), ring(0.96, y1), ring(0.96, y2), ring(0.9, y2)];
  const G = gridOf(rows, { closed: true, out: (i, j) => { const a = (TAU * j) / N; return [Math.sin(a), 0, Math.cos(a)]; } });
  out.push(solid(G, { sheet: true, w: (p) => (p[2] > cz ? mixW([[wF, 1]]) : boneW(B, `foot_${s}`)), mat: (i) => (i === 0 ? 'sole' : i === 1 ? 'pbM' : i === 2 ? 'pbL' : 'pb') }));
  const P = merge(...out);
  P.soles = P.V.map((_, i) => i).filter((i) => P.V[i][1] < A.floor - 0.12);
  return P;
}
export function leadBoots(B) {
  return merge(shoe(B), ...sabaton(B, 'l'), ...sabaton(B, 'r'), plinth(B, 'l'), plinth(B, 'r'));
}
