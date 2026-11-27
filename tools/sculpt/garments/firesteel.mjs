// The fire-tempered steel set: the ember knight, built with the plate kit (tools/sculpt/garments/platekit.mjs) and the
// set's own makings (tools/sculpt/garments/kit/firesteel.mjs): gothic plate quenched black, its edges burned back to bright
// steel, the fire still alive under the crust (the plates' insides ember red where they part).
//
//   helm    a gothic sallet: a fluted skull with a keel from the brow to a long tail swept back to a point, its crown
//           crazed with cracks; two ribbed ram's horns curled down beside the cheeks; the visor's slit over a keeled
//           bevor closed under the chin, two embers for eyes in the slit's dark.
//
// Enchanted, a few things light and nothing else: the helm's eyes and its crown's cracks.
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, smooth, merge, shell, on, nearestOf } from './metalkit.mjs';
import {
  skinSamples, boneW, mixOf, mixW, shareW, skinW, nearSkinW, wrapAngle, plateOn, patch, solid, tube, band, rowPath, colPath, stud, gridOf, sweep,
  limbWrap, along, domeWrap, ellipsoidReach, coverHides, smoothWeights, torsoWrap, torsoMiddle, roundProfile, pathOn,
} from './platekit.mjs';
import { PI, TAU, hash, headW, headDome, torsoMarks, torsoField, TORSO_BONES, crackPath, crackOn, flameEdge, ramHorn, spike, crustPlate } from './kit/firesteel.mjs';

export const FIRESTEEL_MATS = {
  // (the steel quenched black, a warm oily sheen on it; its lames a shade lighter so their stacking reads; its edges
  // burned back to bright steel, a worn mid-tone between)
  fs: { c: '#332926', kind: 3 },
  fsM: { c: '#3a2e2a', kind: 3 },
  fsW: { c: '#6e5c52', kind: 3 },
  fsL: { c: '#cdb7a2', kind: 3 },
  fsB: { c: '#9a8574', kind: 3 },
  fsS: { c: '#1a1312', kind: 3 },
  fsD: { c: '#110c0b', kind: 3 },
  // (the horn: black, its ribs a shade lighter)
  horn: { c: '#221a18', kind: 3 },
  hornR: { c: '#3e322d', kind: 3 },
  // (the fire under the crust: dark ember red where plates part and in the cracks that do not glow)
  ember: { c: '#6e1c0c', kind: 2 },
  emberD: { c: '#3c0f08', kind: 2 },
  // (the sabatons' ember between their lames: as the rest plain, lit when enchanted)
  emberLit: { c: '#7a210d', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  // (the glow: the cracks and the eyes, a hot red plain, lit in the enchantment's colour)
  rune: { c: '#b13a14', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  slit: { c: '#0d0706', kind: 2 },
  // (the arming coat under the plate: charred oxblood)
  arming: { c: '#3e1a14', kind: 0 },
  armingD: { c: '#2a110d', kind: 0 },
  armingW: { c: '#3e1a15', kind: 0 },
  // (the mantle's crust: cooled lava, matte, its tops a shade lighter, its broken sides near black)
  crust: { c: '#2f2724', kind: 2 },
  crustL: { c: '#54453e', kind: 2 },
  crustS: { c: '#120d0c', kind: 2 },
  // (the cloak: smoke-dark wool, charred toward its hem, the hem's tatters still smouldering)
  smoke: { c: '#2c2928', kind: 3 },
  hemRed: { c: '#4e140b', kind: 2 },
  hemHot: { c: '#8a2a0f', kind: 2 },
  hemLit: { c: '#b4441a', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  // (the breast's fissures: hot red, unlit; only the heart glows)
  fissure: { c: '#a3331a', kind: 2 },
  smokeD: { c: '#2a1f1b', kind: 2 },
  char: { c: '#1a1312', kind: 2 },
  smoulder: { c: '#6a200e', kind: 2 },
  sole: { c: '#1b1311', kind: 2 },
  leather: { c: '#2e211c', kind: 2 },
};

/* ---- the helm ---------------------------------------------------------------------------------------------------- */
/**
 * The sallet: see the head of this file. Rigid on the head; the head's own polygons inside it left out.
 */
export function firesteelHelm(B) {
  const A = B.at, out = [], fem = B.who === 'female', wH = () => boneW(B, 'head');
  const H = headDome(B, { fit: fem ? 0.1 : 0.14, rows: 36, cols: 64 });
  const { D, c, browTh } = H;
  const sightA = browTh + 0.03, sightB = sightA + (fem ? 0.2 : 0.21);
  const front = (ph) => Math.abs(wrapAngle(ph));
  // (the tail: behind, the skull drawn down and out to a point over the nape, swept back clear of the neck)
  const tailTh = fem ? 2.55 : 2.6;
  const skBot = (ph) => {
    const f = front(ph), side = smooth(0.7, 1.35, f), sideTh = fem ? 2.05 : 2.1;
    const th = sightA * (1 - side) + sideTh * side;
    // (behind, straight down to the tail's point: a V over the nape)
    return (th + (tailTh - sideTh) * clamp((f - 1.7) / (PI - 1.7)) ** 1.15) / PI;
  };
  const sweepBack = (th, ph) => {
    const f = front(ph), k = smooth(1.3, PI, f) * smooth(1.85, tailTh, th);
    return { out: (fem ? 0.72 : 0.92) * k ** 1.1, down: 0 };
  };
  // (the flutes: sharp ridges from the crown down the sides and the back, none over the brow; the keel from brow to tail)
  const NFL = 7;
  const flute = (th, ph) => {
    const f = front(ph), fade = smooth(0.3, 0.75, th) * smooth(0.55, 1.1, f);
    return 0.045 * Math.max(0, Math.cos(NFL * ph)) ** 6 * fade;
  };
  const keel = (th, ph) => 0.07 * Math.exp(-((Math.sin(ph) / 0.06) ** 2)) * smooth(sightA - 0.1, 0.6, th);
  const NU = 10, NV = 56;
  const lay = (G, base) => gridOf(G.P.map((row, i) => row.map((p, j) => {
    const v = sub(p, c), th = Math.acos(clamp(unit(v)[1], -1, 1)), ph = Math.atan2(v[0], v[2]), s = sweepBack(th, ph);
    const h = unit([v[0], 0, v[2]]);
    return add(add(p, mul(G.N[i][j], base(th, ph))), mul(h, s.out));
  })), { closed: G.closed, out: (i, j) => G.N[i][j] });
  const skull = lay(plateOn(D, { a0: -PI, a1: PI, closed: true, t0: () => 0, t1: (a, v) => skBot(a) + (0.13 * flameEdge(v, 16, { seed: 17, lo: 0.45 }) * smooth(1.45, 1.95, front(a))) / PI, nu: NU, nv: NV, off: () => 0 }), (th, ph) => flute(th, ph) + keel(th, ph) + 0.05 * smooth(sightA + 0.2, 2.0, th));
  // (black with a worn sheen on the flutes' crests; the brow's lowest row burned bright)
  const crest = (j) => { const ph = -PI + (TAU * (j + 0.5)) / NV; return Math.max(0, Math.cos(NFL * ph)) ** 6 > 0.5 && front(ph) > 0.6; };
  out.push(solid(skull, { sheet: true, w: wH, mat: (i, j) => (crest(j) && i > 2 ? 'fsM' : 'fs') }));
  out.push(tube(rowPath(skull, NU, 0, NV, NV), { r: 0.045, k: 3, mat: 'fsL', w: wH, closed: true }));
  // (the keel's crest burned bright from brow to tail)
  out.push(tube(colPath(skull, NV / 2, 1, NU, 12, 0.0), { r: 0.03, k: 3, mat: 'fsL', w: wH }));
  out.push(tube(colPath(skull, 0, 1, NU, 10, 0.0), { r: 0.03, k: 3, mat: 'fsL', w: wH }));
  // -- the crown crazed: cracks from near the top down the skull between the flutes, forking, lit when enchanted
  const at = (th, ph) => [(th / PI) * 0 + 0, 0]; void at;
  const colOf = (ph) => ((wrapAngle(ph) + PI) / TAU) * NV;
  const rowOf = (th, ph) => (th / (skBot(ph) * PI)) * NU;
  const cracks = [
    [0.18, 0.5, 1.05, 0.95, 1], [0.22, -0.45, 1.15, -1.05, 2], [0.2, 2.5, 1.0, 2.15, 3], [0.25, -2.6, 0.95, -2.2, 4], [0.15, 1.6, 0.85, 1.4, 5],
  ];
  for (const [th0, ph0, th1, ph1, s] of cracks) {
    const pts = crackPath([rowOf(th0, ph0), colOf(ph0)], [rowOf(th1, ph1), colOf(ph1)], 9, 1.4, s);
    out.push(crackOn(skull, pts, { wide: 0.07, high: 0.02, lift: 0.0, mat: 'rune', w: wH }));
    // (a fork off its middle)
    const m = pts[4], e = [m[0] + 3.2, m[1] + (hash(s) > 0.5 ? 3.5 : -3.5)];
    out.push(crackOn(skull, crackPath(m, e, 4, 0.9, s + 10), { wide: 0.05, high: 0.018, lift: 0.0, mat: 'rune', w: wH }));
  }
  // -- the bevor: from the slit down over the mouth and closed under the chin, a keel down its middle, its foot flared
  const bvBot = (a) => (fem ? 2.5 : 2.55) - 0.12 * smooth(0.2, 1.2, Math.abs(a));
  const prow = (u, v) => (fem ? 0.16 : 0.22) * Math.exp(-(((v - 0.5) / 0.09) ** 2)) * (0.4 + 0.6 * Math.sin(PI * Math.min(1, 0.15 + u * 0.9)));
  const bevor = lay(plateOn(D, { a0: -1.62, a1: 1.62, t0: () => (sightB + 0.015) / PI, t1: (a) => bvBot(a) / PI, nu: 9, nv: 22, off: (u, v) => 0.03 + prow(u, v) + 0.06 * u * u }), () => 0);
  // (its rows lapped: a bright line at its top, its keel a worn crest)
  out.push(solid(bevor, { sheet: true, w: wH, mat: (i, j) => (j === 10 || j === 11 ? 'fsW' : 'fs') }));
  out.push(tube(rowPath(bevor, 0, 0, 22, 22), { r: 0.04, k: 3, mat: 'fsL', w: wH }));
  out.push(tube(rowPath(bevor, 9, 0, 22, 22), { r: 0.04, k: 3, mat: 'fsW', w: wH }));
  out.push(tube(colPath(bevor, 11, 0.3, 9, 10, 0.0), { r: 0.03, k: 3, mat: 'fsL', w: wH }));
  // (a lame across it, below the mouth)
  const lame = plateOn(D, { a0: -1.5, a1: 1.5, t0: () => (sightB + 0.42) / PI, t1: () => (sightB + 0.52) / PI, nu: 1, nv: 20, off: (u, v) => 0.06 + prow(0.5, v) + 0.03 });
  out.push(solid(lame, { hollow: true, w: wH, thick: 0.03, mat: () => 'fsM', edge: 'fsS' }));
  out.push(tube(rowPath(lame, 0, 0, 20, 20), { r: 0.03, k: 3, mat: 'fsW', w: wH }));
  // -- the slit's dark behind, and two embers for eyes in it, lit when enchanted
  const liner = plateOn(D, { a0: -1.1, a1: 1.1, t0: () => (sightA - 0.06) / PI, t1: () => (sightB + 0.06) / PI, nu: 2, nv: 18, off: () => -0.03 });
  out.push(solid(liner, { sheet: true, w: wH, mat: () => 'slit' }));
  for (const sg of [-1, 1]) {
    const eye = patch((u, v) => {
      const a = v * TAU, r = u, q = D.ta((sightA + (sightB - sightA) * (0.5 + 0.32 * Math.sin(a) * r)) / PI, sg * (0.36 + 0.2 * Math.cos(a) * r));
      return { p: add(q.p, mul(q.n, -0.015)), n: q.n };
    }, 1, 8, { closed: true });
    out.push(solid(eye, { sheet: true, w: wH, mat: () => 'rune' }));
  }
  // -- the horns: from the temples, swept back, curled down and forward beside the cheeks; ribbed, their points bright
  for (const sg of [-1, 1]) {
    const q = D.ta((fem ? 0.95 : 0.92) / PI, sg * 1.62), root = add(q.p, mul(q.n, -0.03));
    const steps = 32;
    out.push(ramHorn({
      root, sg, w: wH(), steps, r0: fem ? 0.58 : 0.7, r1: fem ? 0.2 : 0.24, turns: 1.12, drift: fem ? 0.5 : 0.6, lift: 0.15, splay: 0.75, rad: fem ? 0.21 : 0.25, rib: 2,
      mat: (k) => (k > steps - 5 ? 'fsL' : k > steps - 9 ? 'fsW' : k % 2 ? 'hornR' : 'horn'),
    }));
    // (a bright collar where the horn is riveted to the skull)
    out.push(stud(root, q.n, { r: fem ? 0.2 : 0.24, h: 0.08, k: 6, mat: 'fsM', capMat: 'fsL', w: wH }));
  }
  const P = merge(...out);
  // (the head's own polygons inside it left out, but for those the slit shows)
  const inside = (i) => { const v = sub(B.V[i], c), th = Math.acos(clamp(unit(v)[1], -1, 1)), ph = Math.atan2(v[0], v[2]); return th < Math.max(skBot(ph) * PI, Math.abs(wrapAngle(ph)) < 1.6 ? bvBot(ph) : 0) - 0.08; };
  B.A.polys.forEach(([v], pi) => { if (v.every((i) => headW(B, B.W[i]) > 0.6 || inside(i))) P.hides.add(pi); });
  return P;
}

/* ---- chest & arms ------------------------------------------------------------------------------------------------ */
const headOnly = (B, i) => headW(B, B.W[i]);
/** A thigh plate's weights (the tasset's foot): the thigh's skin's, averaged. */
const thighW = (B, s) => { const hp = B.at.hip[s], kn = B.at.knee[s], sg = s === 'l' ? 1 : -1; return skinW(B, (q) => q.p[0] * sg > 0.12 && shareW(B, q.w, 'thigh') > 0.6 && along(q.p, hp, kn) > 0.25 && along(q.p, hp, kn) < 0.8, (n) => n.endsWith(`_${s}`)); };
/** The arming coat: the torso and the arms to the wrists, close over the skin, the skin under it left out. */
function armingCoat(B) {
  const A = B.at, M = torsoMarks(B);
  return shell(B, {
    sub: 0, rim: null,
    keep: (i) => { const p = B.V[i]; return on(B, i, 'torso', 'shoulder', 'upperarm', 'forearm', 'neck', 'head', 'thigh') > 0.6 && headOnly(B, i) < 0.05 && on(B, i, 'hand') < 0.35 && p[1] > M.hip - 0.25 && on(B, i, 'thigh') < 0.5 && p[1] < A.neck[1] - 0.02; },
    off: ({ p }) => 0.065 + 0.03 * smooth(M.waist, M.hip, p[1]) - 0.03 * smooth(A.neck[1] - 0.6, A.neck[1] - 0.1, p[1]),
    mat: () => 'arming',
  });
}
/**
 * A lame cut along its foot into flame tongues: a plate on field `G` from `t0` to `t1` (along it) and `a0` to `a1`
 * (round it); its foot (`foot`: 't1' or 't0', the edge that hangs free) drawn out `amp` into `n` tongues; its head the
 * ember red where the lame above laps it (seen between that one's tongues). Returns the plate's grid.
 */
function flameLame(G, o) {
  const nv = o.nv, n = o.n, amp = o.amp, sd = o.seed ?? 1;
  const t0 = (a, v) => (o.foot === 't0' ? o.t0 - amp * flameEdge(v, n, { seed: sd, lo: o.lo ?? 0.55 }) : o.t0);
  const t1 = (a, v) => (o.foot === 't0' ? o.t1 : o.t1 + amp * flameEdge(v, n, { seed: sd, lo: o.lo ?? 0.55 }));
  return plateOn(G, { a0: o.a0, a1: o.a1, t0, t1, nu: o.nu ?? 3, nv, off: o.off, closed: o.closed });
}

function torsoPlates(B) {
  const A = B.at, M = torsoMarks(B), F = torsoField(B), t = F.tOfY, fem = B.who === 'female';
  const W = nearSkinW(B, (s) => shareW(B, s.w, 'torso') > 0.7, (n) => TORSO_BONES.has(n), 0.35);
  const pw = (p) => W(p), parts = [], out0 = [];
  // the breastplate: a high neckline dipping to a point at the throat, the armholes cut deep
  const aN = 0.78, side = PI / 2 + 0.04;
  const topF = (a) => {
    const ax = Math.abs(a), yC = M.neckF + 0.18;
    if (ax <= aN) return M.neckF + 0.04 + 0.14 * (ax / aN) ** 1.4 - 0.1 * Math.max(0, 1 - ax / 0.18);
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
  const chestY = lerp(A.chest, [0, M.waist, 0], 0.4)[1];
  const bulge = (yy, a) => 0.1 * Math.exp(-(((yy - chestY) / 0.9) ** 2)) * Math.max(0, Math.cos(a)) ** 1.5;
  // (the keel: a sharp ridge up the middle; the flutes: ridges fanning up and out from the waist's middle)
  const keel = (a) => 0.085 * Math.exp(-((a / 0.13) ** 2));
  const R = 1.25, y0f = M.waist - 0.35, PHI = [-1.12, -0.78, -0.42, 0.42, 0.78, 1.12];
  const fanAng = (yy, a) => Math.atan2(a * R, Math.max(0.05, yy - y0f));
  const flute = (yy, a, fade = 1) => 0.05 * PHI.reduce((m, f) => Math.max(m, Math.exp(-(((fanAng(yy, a) - f) / 0.07) ** 2))), 0) * smooth(M.waist + 0.1, M.waist + 0.6, yy) * fade;
  const offF = (u, v, tt, a) => { const yy = F.yOfT(tt); return 0.15 + bulge(yy, a) + keel(a) + flute(yy, a) + 0.035 * smooth(0.12, 0, u); };
  const NVb = 36;
  const breast = plateOn(F, { a0: -side, a1: side, t0: () => t(M.waist), t1: (a) => t(topF(a)), nu: 12, nv: NVb, off: offF });
  // (black, a worn sheen on each flute's crest)
  parts.push(solid(breast, { sheet: true, w: pw, mat: (i) => (i === 11 ? 'fsM' : 'fs') }));
  // (each flute's crest worn bright: a ridge laid along it from above the waist to the neckline)
  for (const f of PHI) {
    const pts = [];
    for (let k = 0; k <= 10; k++) {
      const yy = M.waist + 0.55 + (topF(0) - M.waist) * 0.9 * (k / 10), a = (Math.tan(f) * (yy - y0f)) / R;
      if (Math.abs(a) > side - 0.05 || yy > topF(a) - 0.12) break;
      pts.push([((t(yy) - t(M.waist)) / (t(topF(a)) - t(M.waist))) * 12, ((a + side) / (2 * side)) * NVb]);
    }
    if (pts.length > 2) parts.push(tube(pathOn(breast, pts, 0.0), { r: 0.032, k: 3, mat: 'fsL', w: pw }));
  }
  // the backplate: a keel up the spine, flutes fanning up and out from the small of the back
  const bA0 = side - 0.08, bA1 = 2 * PI - side + 0.08, NVk = 30;
  const bAng = (yy, a) => Math.atan2(wrapAngle(a - PI) * R, Math.max(0.05, yy - y0f));
  const PHB = [-1.0, -0.6, 0.6, 1.0];
  const bflute = (yy, a) => 0.05 * PHB.reduce((m, f) => Math.max(m, Math.exp(-(((bAng(yy, a) - f) / 0.07) ** 2))), 0) * smooth(M.waist + 0.1, M.waist + 0.6, yy);
  const back = plateOn(F, { a0: bA0, a1: bA1, t0: () => t(M.waist), t1: (a) => t(topB(a)), nu: 12, nv: NVk, off: (u, v, tt, a) => 0.13 + 0.035 * smooth(0.12, 0, u) + keel(wrapAngle(a - PI)) * 0.8 + bflute(F.yOfT(tt), a) });
  parts.push(solid(back, { sheet: true, w: pw, mat: (i) => (i === 11 ? 'fsM' : 'fs') }));
  const colK = (a) => ((a - bA0) / (bA1 - bA0)) * NVk, rowK = (yy, a) => ((t(yy) - t(M.waist)) / (t(topB(a)) - t(M.waist))) * 12;
  parts.push(tube(colPath(back, NVk / 2, 0.6, 11.2, 10, 0.0), { r: 0.032, k: 3, mat: 'fsL', w: pw }));
  for (const f of PHB) {
    const pts = [];
    for (let k = 0; k <= 10; k++) {
      const yy = M.waist + 0.55 + (topB(PI) - M.waist) * 0.9 * (k / 10), a = PI + (Math.tan(f) * (yy - y0f)) / R;
      if (a < bA0 + 0.05 || a > bA1 - 0.05 || yy > topB(a) - 0.12) break;
      pts.push([rowK(yy, a), colK(a)]);
    }
    if (pts.length > 2) parts.push(tube(pathOn(back, pts, 0.0), { r: 0.032, k: 3, mat: 'fsL', w: pw }));
  }
  // (fissures from the spine between the shoulder blades, out and down, dark ember: the fire showing, unlit)
  const fy = lerp(A.chest, A.spine2, 0.6)[1];
  for (const [sd, dy, L, sdd] of [[1, 0.35, 0.9, 61], [1, -0.45, 0.8, 62], [-1, 0.3, 0.95, 63], [-1, -0.5, 0.75, 64]]) {
    const a0 = PI + sd * 0.12, a1 = PI + sd * (0.25 + L * 0.85), y0 = fy, y1 = fy + dy * L;
    out0.push(crackOn(back, crackPath([rowK(y0, a0), colK(a0)], [rowK(y1, a1), colK(a1)], 7, 0.9, sdd), { wide: 0.1, high: 0.02, lift: 0.0, mat: 'ember', w: pw, taper: 1.4 }));
  }
  parts.push(...out0.splice(0));
  const rows = (G) => G.P.length - 1;
  parts.push(tube(rowPath(breast, rows(breast), 0, NVb, 20), { r: 0.05, k: 3, mat: 'fsL', w: pw }));
  parts.push(tube(rowPath(back, rows(back), 0, NVk, 18), { r: 0.05, k: 3, mat: 'fsL', w: pw }));
  // the plackart: from the waist up to a sharp point under the breast, its edges flame-cut into three tongues each side
  const peak = lerp(A.chest, [0, M.waist, 0], 0.22)[1], plw = 1.3;
  const cusp = (a, v) => { const ax = Math.abs(a); return peak - (peak - (M.waist + 0.3)) * smooth(0, plw, ax) ** 0.55 + 0.16 * flameEdge(Math.abs(v - 0.5) * 2, 3, { seed: 3, lo: 0.4 }) * smooth(0.1, 0.3, ax); };
  const placard = plateOn(F, { a0: -plw, a1: plw, t0: () => t(M.waist), t1: (a, v) => t(cusp(a, v)), nu: 6, nv: 30, off: (u, v, tt, a) => 0.21 + bulge(F.yOfT(tt), a) + keel(a) * 1.05 + 0.035 * smooth(0.12, 0, u) });
  parts.push(solid(placard, { sheet: true, w: pw, mat: () => 'fsM' }));
  parts.push(tube(rowPath(placard, rows(placard), 0, 30, 20), { r: 0.04, k: 3, mat: 'fsL', w: pw }));
  // -- the molten heart over the plackart's point: a cracked boss in a black socket, its fissures run out over the breast
  const { coreY, cR } = coreOf(B), cq = F.ta(t(coreY), 0);
  const co = unit(add(cq.n, [0, 0.1, 0])), cOff = 0.15 + bulge(coreY, 0) + keel(0);
  const cc = add(cq.p, mul(cq.n, cOff));
  const cx = unit(cross([0, 1, 0], co)), cy = cross(co, cx);
  const socket = patch((u, v) => { const a2 = v * TAU, rr = cR * (1.0 + 0.45 * u) * (1 + 0.1 * Math.cos(a2 * 5) * u); return { p: add(cc, add(mul(co, 0.07 * (1 - u) - 0.0), add(mul(cx, Math.cos(a2) * rr), mul(cy, Math.sin(a2) * rr)))), n: co }; }, 2, 20, { closed: true });
  parts.push(solid(socket, { w: pw, thick: 0.04, mat: (i) => (i === 0 ? 'fsS' : 'fs'), inner: 'fsD', edge: 'fsS' }));
  parts.push(tube(rowPath(socket, 0, 0, 20, 20), { r: 0.035, k: 4, mat: 'fsL', w: pw, closed: true }));
  // (the heart: a faceted dome of cooled crust split by glowing seams; its seams lit)
  const heart = patch((u, v) => { const a2 = v * TAU, rr = cR * 0.98 * Math.sin((PI / 2) * (1 - u)) * (1 + 0.12 * Math.cos(a2 * 3 + 1)); return { p: add(cc, add(mul(co, 0.05 + 0.13 * Math.cos((PI / 2) * (1 - u))), add(mul(cx, Math.cos(a2) * rr), mul(cy, Math.sin(a2) * rr)))), n: co }; }, 3, 12, { closed: true });
  parts.push(solid(heart, { sheet: true, w: pw, mat: (i, j) => (j % 4 === 0 || i === 2 ? 'rune' : 'ember') }));
  // (the fissures: jagged, forking, run out from the socket up and over the breast, two down onto the plackart)
  const colB = (a) => ((a + side) / (2 * side)) * NVb, rowB = (yy) => ((t(yy) - t(M.waist)) / (t(topF(0)) - t(M.waist))) * 12;
  // (four long ones out across the breast to the flanks, below the mantle's foot, above the plackart's shoulders)
  const fis = [[1, 0.2, 1.0, 1], [1, -0.4, 0.85, 2], [-1, 0.25, 1.05, 3], [-1, -0.38, 0.8, 4]];
  for (const [sd, dy, L, sdd] of fis) {
    const a0 = sd * (cR * 1.3) / 1.6, y0 = coreY + dy * cR, a1 = sd * (0.45 + L * 0.85), y1 = coreY + dy * L * 1.1;
    const pts = crackPath([rowB(y0), colB(a0)], [rowB(y1), colB(a1)], 9, 1.0, sdd);
    parts.push(crackOn(breast, pts, { wide: 0.1, high: 0.022, lift: 0.0, mat: 'fissure', w: pw, taper: 1.5 }));
    // (a short fork off each)
    const m = pts[4], e = [m[0] + (dy > 0 ? 1.6 : -1.4), m[1] + sd * 2.2];
    parts.push(crackOn(breast, crackPath(m, e, 4, 0.6, sdd + 20), { wide: 0.06, high: 0.018, lift: 0.0, mat: 'fissure', w: pw }));
  }
  // the faulds: three hoops below the waist, each flame-cut at its foot and lapped over the one below; shorter behind
  const behind = (a) => smooth(1.6, 2.7, Math.abs(wrapAngle(a)));
  const fBot = (a) => lerp([0, M.fauld, 0], [0, M.waist - 0.42, 0], behind(a))[1] + 0.22 * Math.exp(-(((Math.abs(wrapAngle(a)) - 0.9) / 0.38) ** 2));
  const hoop = (a) => (M.waist + 0.1 - fBot(a)) / 3;
  for (let k = 0; k < 3; k++) {
    const top = (a) => M.waist + 0.1 - hoop(a) * k, bot = (a) => top(a) - hoop(a) - 0.05;
    const g = plateOn(F, { a0: -PI, a1: PI, closed: true, t0: (a, v) => t(bot(a) - 0.08 * flameEdge(v, 10, { seed: 7 + k, lo: 0.3 }) * (1 - 0.6 * behind(a))), t1: (a) => t(top(a)), nu: 2, nv: 32, off: (u) => 0.13 + 0.06 * k + (0.1 + 0.04 * k) * (1 - u) });
    parts.push(solid(g, { sheet: true, w: pw, mat: (i) => (i === 1 && k > 0 ? 'ember' : 'fsM') }));
    parts.push(tube(rowPath(g, 0, 0, 32, 16), { r: 0.03, k: 3, mat: 'fsW', w: pw, closed: true }));
  }
  // the culet: a plate over the small of the back lapped over the hoops, its foot cut into three tongues
  {
    const g = plateOn(F, { a0: PI - 0.85, a1: PI + 0.85, t0: (a, v) => t(M.waist - (fem ? 0.4 : 0.48) - 0.14 * flameEdge(v, 3, { seed: 77, lo: 0.6 })), t1: () => t(M.waist + 0.05), nu: 4, nv: 18, off: (u, v, tt, a) => 0.36 + 0.08 * (1 - u) + keel(wrapAngle(a - PI)) * 0.5 });
    parts.push(solid(g, { w: pw, thick: 0.04, mat: (i) => (i === 3 ? 'fsM' : 'fs'), inner: 'ember', edge: 'fsS' }));
    parts.push(tube(rowPath(g, 0, 0, 18, 18), { r: 0.035, k: 3, mat: 'fsL', w: pw }));
    parts.push(tube(rowPath(g, 4, 0, 18, 18), { r: 0.03, k: 3, mat: 'fsW', w: pw }));
  }
  // the tassets: a long plate of two lames over each thigh's front, hung from the last hoop, its foot drawn to a point
  for (const sg of [1, -1]) {
    const s = sg > 0 ? 'l' : 'r', hp = A.hip[s], kn = A.knee[s];
    const pick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'thigh', 'torso') > 0.9 && q.p[1] < hp[1] + 0.6;
    const TH = limbWrap(B, hp, kn, sg, { t: [-0.15, 0.62], nt: 15, a: [-PI, PI], closed: true, na: 28, pick, smooth: 4, shape: (r) => r });
    const tTop = along([hp[0], M.fauld + 0.1, hp[2]], hp, kn), tBot = along([hp[0], M.tasset, hp[2]], hp, kn), h = (tBot - tTop) / 2;
    const wT = thighW(B, s), wP = boneW(B, 'pelvis');
    const w = (p) => { const f = clamp((along(p, hp, kn) - tTop) / (tBot - tTop)); return mixW([[wP, 0.55 - 0.55 * f], [wT, 0.45 + 0.55 * f]]); };
    for (let k = 0; k < 2; k++) {
      const t0 = tTop + h * k, t1 = t0 + h + 0.04;
      const point = (v) => (k === 1 ? 0.16 * Math.max(0, 1 - Math.abs(v - 0.45) / 0.45) ** 1.2 : 0.07 * flameEdge(v, 4, { seed: 11 + sg, lo: 0.5 }));
      const g = plateOn(TH, { a0: -0.4, a1: 1.35, t0: () => t0, t1: (a, v) => t1 + point(v), nu: 4, nv: 16, off: (u, v) => 0.38 + 0.05 * k + 0.08 * u + 0.06 * Math.sin(PI * v) + 0.03 * Math.exp(-(((v - 0.45) / 0.08) ** 2)) });
      parts.push(solid(g, { sheet: true, w, mat: (i) => (i === 0 && k === 1 ? 'ember' : 'fsM') }));
      parts.push(tube(rowPath(g, 4, 0, 16, 16), { r: 0.035, k: 3, mat: 'fsL', w }));
    }
  }
  return { parts, F, M, W };
}

/** The molten heart's height on the breast and its radius (the mantle's foot is cut clear of it). */
function coreOf(B) {
  const A = B.at, M = torsoMarks(B), fem = B.who === 'female', peak = lerp(A.chest, [0, M.waist, 0], 0.22)[1], cR = fem ? 0.3 : 0.36;
  return { coreY: peak + cR * 1.25, cR, top: peak + cR * 1.25 + cR * 1.5 };
}

/** The arm's skin samples on side `s` ('l' or 'r'): of the parts given, more than `k` of their weight. */
const armPick = (B, s, parts, k = 0.6) => (q) => (s === 'l' ? q.p[0] > 0.15 : q.p[0] < -0.15) && shareW(B, q.w, ...parts) > k;
const armBones = (s) => (n) => n.endsWith(`_${s}`);

/** One arm's harness: a flame-cut pauldron, rerebrace, couter and its flame, fluted vambrace, gauntlet with its knuckle spikes. */
function armHarness(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, sh = A.shoulder[s], el = A.elbow[s], wr = A.wrist[s], fem = B.who === 'female';
  const out = [];
  const upDir = unit(sub(el, sh)), foreDir = unit(sub(wr, el));
  const uaLen = len(sub(el, sh)), faLen = len(sub(wr, el));
  // -- the rerebrace
  const upPick = armPick(B, s, ['upperarm', 'shoulder']);
  const UA = limbWrap(B, sh, el, sg, { t: [0.0, 0.92], nt: 16, a: [-PI, PI], closed: true, na: 22, pick: upPick, smooth: 3, shape: (r) => r });
  const wUp = skinW(B, (q) => upPick(q) && along(q.p, sh, el) > 0.3 && along(q.p, sh, el) < 0.8, armBones(s));
  const rere = plateOn(UA, { a0: -PI, a1: PI, closed: true, t0: (a) => 0.15 + 0.12 * (1 - Math.cos(a - PI / 2)) / 2, t1: () => 0.9, nu: 4, nv: 22, off: (u) => 0.1 + 0.02 * u });
  out.push(solid(rere, { sheet: true, w: () => wUp, mat: () => 'fs' }));
  // -- the pauldron's lames down the outside of the upper arm, each flame-cut at its foot over the ember of the next
  const front = 1.7, backA = 1.95, sideA = PI / 2;
  const wSh = mixOf(B, [[`shoulder_${s}`, 0.45], [`upperarm_${s}`, 0.15], [`clavicle_${s}`, 0.4]]);
  for (let k = 0; k < 3; k++) {
    const t0 = 0.1 + 0.09 * k, t1 = t0 + 0.12, off = 0.28 - 0.035 * k;
    const g = flameLame(UA, { a0: sideA - backA, a1: sideA + front, t0, t1, foot: 't1', amp: 0.09, n: 4, seed: 20 + k + (sg > 0 ? 0 : 5), nu: 3, nv: 22, off: (u) => off + 0.02 * u });
    out.push(solid(g, { sheet: true, w: () => wSh, mat: (i) => (i === 0 ? 'ember' : 'fsM') }));
    out.push(tube(rowPath(g, 3, 0, 22, 14), { r: 0.03, k: 3, mat: k === 2 ? 'fsL' : 'fsW', w: () => wSh }));
  }
  // -- the cop: a dome over the shoulder's ball, its rim over the arm flame-cut
  const ax = unit([sg * 0.42, 0.91, 0]);
  const shPick = (q) => q.p[0] * sg > 0.78 * sh[0] * sg && shareW(B, q.w, 'shoulder', 'upperarm', 'torso') > 0.8 && shareW(B, q.w, 'neck', 'head') < 0.1 && len(sub(q.p, sh)) < 1.25 && q.p[1] > sh[1] - 0.95;
  const cc = add(sh, [sg * 0.02, -0.12, 0]), near = skinSamples(B).filter(shPick).map((q) => sub(q.p, cc));
  const ex = Math.max(...near.map((v) => v[0] * sg));
  const ro = ex + 0.36, E = [ro * 1.05, ro * 0.55, ro * 0.95];
  const D = domeWrap(B, { c: cc, u: ax, f: [0, 0, 1], s: [0, 1, 0], pick: shPick, rows: 24, cols: 40, thMax: 2.2, cone: 0.35, smooth: 4, shape: (r, th, ph, d) => Math.max(r + 0.3 - 0.14 * Math.max(0, Math.sin(ph)), ellipsoidReach(E, d)) });
  // (azimuth nought the front, pi/2 the top toward the neck, pi the back, -pi/2 down toward the armpit)
  const reach = (ph) => {
    const c = Math.cos(ph), sn = Math.sin(ph), fr = c > 0 ? 1.3 : 1.4;
    return Math.max(0.6, (Math.abs(c) * fr + Math.max(0, sn) * 0.48 + Math.max(0, -sn) * 1.45) / (Math.abs(c) + Math.abs(sn)));
  };
  // (the tongues: on the rim's lower half, over the arm, front and back; none up by the neck)
  const tongue = (ph, v) => 0.5 * flameEdge(v, 12, { seed: 31 + (sg > 0 ? 0 : 9), lo: 0.45 }) * smooth(0.1, -0.5, Math.sin(ph));
  const NVc = 36, copFl = (v) => 0.07 * Math.max(0, Math.cos(6 * (-PI + 2 * PI * v))) ** 6;
  const cop = plateOn(D, { a0: -PI, a1: PI, closed: true, t0: () => 0, t1: (a, v) => (reach(a) + tongue(a, v)) / 2.2, nu: 7, nv: NVc, off: (u, v) => (0.1 + 0.08 * Math.max(0, Math.cos(-PI + 2 * PI * v))) * u * u + copFl(v) * Math.sin(PI * Math.min(1, 0.15 + u)) });
  out.push(solid(cop, { sheet: true, w: () => wSh, mat: (i) => (i >= 6 ? 'fsM' : 'fs') }));
  out.push(tube(rowPath(cop, 7, 0, NVc, 24), { r: 0.04, k: 3, mat: 'fsL', w: () => wSh, closed: true }));
  // -- the couter: a cup over the elbow's point, a flame of three tongues swept up off its outside
  const c0 = sub(el, mul(upDir, uaLen * 0.24)), c1 = add(el, mul(foreDir, faLen * 0.22));
  const elPick = (q) => armPick(B, s, ['upperarm', 'forearm'], 0.6)(q) && len(sub(q.p, el)) < 0.9;
  const EL = limbWrap(B, c0, c1, sg, { t: [0, 1], nt: 10, a: [-PI, PI], closed: true, na: 24, pick: elPick, smooth: 3, shape: (r) => r });
  const wEl = boneW(B, `elbow_${s}`);
  const cup = plateOn(EL, { a0: 0.9, a1: 2 * PI - 0.9, t0: () => 0.04, t1: () => 0.96, nu: 6, nv: 14, off: (u, v) => 0.2 + 0.08 * Math.sin(PI * u) * Math.sin(PI * v) });
  out.push(solid(cup, { sheet: true, w: () => wEl, mat: () => 'fs' }));
  out.push(tube(rowPath(cup, 0, 0, 14, 10), { r: 0.035, k: 3, mat: 'fsW', w: () => wEl }));
  out.push(tube(rowPath(cup, 6, 0, 14, 10), { r: 0.035, k: 3, mat: 'fsW', w: () => wEl }));
  // (the flame: a blade of plate standing off the cup's outside, cut into three tongues licking up the arm)
  const ec = EL.ta(0.5, PI / 2), fo = unit(add(ec.n, mul([0, 0, -1], 0.3)));
  const fx = unit(sub(mul(upDir, -1), mul(fo, dot(mul(upDir, -1), fo)))), fy = cross(fo, fx);
  const fanC = add(ec.p, mul(fo, 0.2)), fR = (fem ? 0.5 : 0.62);
  const flame = patch((u, v) => {
    // (v across the blade, u from its foot at the cup out to the tongues' points, up the arm)
    const x = (v - 0.5) * 2, tip = 0.55 + 0.45 * flameEdge(v, 3, { seed: 41 + sg, lo: 0.6 });
    const along2 = fR * (0.15 + u * tip * 1.1), across = fR * 0.42 * x * (1 - 0.35 * u);
    return { p: add(fanC, add(mul(fx, along2), add(mul(fy, across), mul(fo, 0.08 * u * u - 0.04 * x * x)))), n: fo };
  }, 3, 12);
  out.push(solid(flame, { w: () => wEl, thick: 0.035, mat: (i) => (i === 0 ? 'fsS' : 'fs'), inner: 'ember', edge: 'fsL' }));
  out.push(stud(add(fanC, mul(fx, fR * 0.12)), fo, { r: 0.09, h: 0.07, k: 5, mat: 'fsM', capMat: 'fsL', w: () => wEl }));
  // -- the vambrace: closed round the forearm, a sharp ridge down its outside
  const faPick = armPick(B, s, ['forearm'], 0.6);
  const FA = limbWrap(B, el, wr, sg, { t: [0, 1.0], nt: 14, a: [-PI, PI], closed: true, na: 22, pick: faPick, smooth: 3, shape: (r) => r });
  const wFa = skinW(B, (q) => faPick(q) && along(q.p, el, wr) > 0.25 && along(q.p, el, wr) < 0.85, armBones(s));
  const ridge = (a) => 0.06 * Math.exp(-(((a - PI / 2) / 0.22) ** 2));
  const vamb = plateOn(FA, { a0: -PI, a1: PI, closed: true, t0: () => 0.15, t1: () => 0.8, nu: 5, nv: 22, off: (u, v, tt, a) => 0.1 + 0.03 * Math.sin(PI * u) + ridge(a) });
  out.push(solid(vamb, { sheet: true, w: () => wFa, mat: () => 'fs' }));
  out.push(tube(colPath(vamb, 16.5, 0, 5, 6, 0.0), { r: 0.025, k: 3, mat: 'fsW', w: () => wFa }));
  out.push(tube(rowPath(vamb, 0, 0, 22, 11), { r: 0.035, k: 3, mat: 'fsW', w: () => wFa, closed: true }));
  // -- the gauntlet's cuff, flared back over the vambrace's end, its top drawn to a point on the outside
  const wWr = mixOf(B, [[`hand_${s}`, 0.5], [`wrist_${s}`, 0.25], [`lowerarm_${s}`, 0.25]]);
  const cuffTop = (a) => 0.72 - 0.12 * Math.max(0, Math.cos(a - PI / 2)) ** 3;
  const cuff = plateOn(FA, { a0: -PI, a1: PI, closed: true, t0: (a) => cuffTop(a), t1: () => 0.99, nu: 2, nv: 22, off: (u) => 0.27 - 0.15 * u });
  out.push(solid(cuff, { hollow: true, w: () => wWr, thick: 0.035, mat: () => 'fsM', edge: 'fsS' }));
  out.push(tube(rowPath(cuff, 0, 0, 22, 22), { r: 0.035, k: 3, mat: 'fsL', w: () => wWr, closed: true }));
  // -- the hand's plate over its back, a row of knuckle spikes at its foot
  const hd = A.wrist[s], kn = B.head(`knuckles_${s}`) ?? hd;
  const hPick = (q) => (s === 'l' ? q.p[0] > 0.15 : q.p[0] < -0.15) && shareW(B, q.w, 'hand') > 0.7;
  const kd = unit(sub(kn, hd));
  const HN = limbWrap(B, hd, add(kn, mul(kd, 0.05)), sg, { t: [0, 1], nt: 8, a: [-PI, PI], closed: true, na: 20, pick: hPick, smooth: 3, shape: (r) => r });
  const wHd = boneW(B, `hand_${s}`);
  // (the back of the hand: the side away from the palm, out from the body at rest)
  const hb = PI / 2 - 0.2;
  const plate = plateOn(HN, { a0: -0.5, a1: hb + 1.25, t0: () => 0.05, t1: () => 0.97, nu: 4, nv: 10, off: (u) => 0.09 + 0.03 * Math.sin(PI * u) });
  out.push(solid(plate, { w: () => wHd, thick: 0.03, mat: (i) => (i === 3 ? 'fsM' : 'fs'), inner: 'fsD', edge: 'fsS' }));
  out.push(tube(rowPath(plate, 4, 0, 10, 10), { r: 0.03, k: 3, mat: 'fsL', w: () => wHd }));
  for (let k = 0; k < 4; k++) {
    const q = plate.at(3.6, 1.2 + k * 2.5), d = unit(add(mul(q.n, 0.7), mul(kd, 0.6)));
    out.push(spike(add(q.p, mul(q.n, 0.02)), d, { r: 0.055, h: fem ? 0.12 : 0.15, k: 4, mat: 'fsL', w: wHd }));
  }
  // (and over the fingers' first joints, a lame of its own, on them)
  const f0 = B.head(`fingers_01_${s}`), f1 = B.head(`fingers_02_${s}`), fd = unit(sub(f1, f0));
  const fPick = (q) => (s === 'l' ? q.p[0] > 0.15 : q.p[0] < -0.15) && shareW(B, q.w, 'hand') > 0.9 && along(q.p, f0, f1) > 0.1 && along(q.p, f0, f1) < 1.1;
  const FG = limbWrap(B, sub(f0, mul(fd, 0.05)), add(f1, mul(fd, 0.05)), sg, { t: [0, 1], nt: 6, a: [-PI, PI], closed: true, na: 20, pick: fPick, smooth: 3, shape: (r) => r });
  const fing = plateOn(FG, { a0: -0.2, a1: hb + 1.1, t0: () => 0.25, t1: () => 0.9, nu: 2, nv: 8, off: () => 0.09 });
  const wFg = skinW(B, (q) => fPick(q) && along(q.p, f0, f1) > 0.3 && along(q.p, f0, f1) < 0.9, armBones(s));
  out.push(solid(fing, { w: () => wFg, thick: 0.025, mat: () => 'fsM', inner: 'fsD', edge: 'fsS' }));
  return out;
}

export function firesteelChest(B) {
  const T = torsoPlates(B);
  return coverHides(B, merge(smoothWeights(armingCoat(B), 2, (p) => p[1] < B.at.neck[1] - 0.6), ...T.parts, ...armHarness(B, 'l'), ...armHarness(B, 'r')), 0.5);
}

/* ---- the mantle -------------------------------------------------------------------------------------------------- */
const CHEST = new WeakMap();
/** The chest piece's parts (built once for a body): what the mantle lies over. */
function chestParts(B) {
  if (!CHEST.has(B)) CHEST.set(B, { T: torsoPlates(B), L: armHarness(B, 'l'), R: armHarness(B, 'r') });
  return CHEST.get(B);
}
/**
 * The crust mantle: a standing gorget round the neck; over the shoulders, the upper breast and the upper back three rows
 * of cooled-lava plates lapped like tiles over a molten bed that shows (lit) in the seams between them; at the throat
 * the clasp, a forge-hot ring in a black bezel; from under the plates behind, a smoke-dark cloak to the thigh, its hem
 * torn into tongues and charred, smouldering at their points.
 */
export function firesteelMantle(B) {
  const A = B.at, M = torsoMarks(B), out = [], fem = B.who === 'female', n = A.neck[1];
  const F = torsoField(B), t = F.tOfY;
  const pick = (q) => shareW(B, q.w, 'torso', 'neck', 'head') > 0.85 && headW(B, q.w) < 0.2 && q.p[1] > M.pit - 0.2 && Math.abs(q.p[0]) < 1.25;
  const wNeck = mixOf(B, [['neck_01', 0.55], ['spine_03', 0.45]]);
  const W = nearSkinW(B, (q) => pick(q), (nm) => ['spine_03', 'spine_02', 'neck_01', 'clavicle_l', 'clavicle_r'].includes(nm), 0.35);
  // -- the gorget: a standing collar of two lames round the neck, higher behind
  const behind = (a) => smooth(0.9, 2.3, Math.abs(wrapAngle(a)));
  const cTop = (a) => n + 0.17 - 0.03 * behind(a) - 0.27 * smooth(1.5, 0.3, Math.abs(wrapAngle(a)));
  for (let k = 0; k < 1; k++) {
    const top = (a) => cTop(a) - 0.13 * k, bot = (a) => top(a) - 0.17;
    const g = plateOn(F, { a0: -PI, a1: PI, closed: true, t0: (a) => t(bot(a)), t1: (a) => t(top(a)), nu: 2, nv: 28, maxUp: 0.3, off: (u) => 0.1 + 0.035 * k + 0.03 * (1 - u) });
    out.push(solid(g, { hollow: true, w: () => wNeck, thick: 0.035, mat: () => (k ? 'fsM' : 'fs'), edge: 'fsS' }));
    out.push(tube(rowPath(g, 2, 0, 28, 28), { r: 0.035, k: 3, mat: k ? 'fsW' : 'fsL', w: () => wNeck, closed: true }));
  }
  // -- the field the mantle lies on: the chest piece's plates and the skin over the shoulders and the back
  const { T, L, R: Rr } = chestParts(B);
  const legW = (w) => w.some(([b, x]) => x > 0.2 && /(thigh|calf)/.test(B.bones[b].name));
  const lowArm = (w) => w.some(([b, x]) => x > 0.3 && /(lowerarm|elbow|hand|wrist|upperarm)/.test(B.bones[b].name));
  const pts = [];
  for (const P of [...T.parts, ...L, ...Rr]) P.V.forEach((p, i) => { if (!lowArm(P.W[i]) && !legW(P.W[i]) && p[1] > M.waist - 0.5) pts.push(p); });
  for (const q of skinSamples(B)) if (shareW(B, q.w, 'torso', 'neck', 'shoulder') > 0.8 && headW(B, q.w) < 0.15 && q.p[1] > M.waist - 0.5) pts.push(q.p);
  const zc = F.zc, cy0 = M.waist - 0.4, cy1 = n + 0.35, ct = (yy) => (yy - cy0) / (cy1 - cy0);
  const C = torsoWrap(B, cy0, cy1, zc, {
    points: pts, nt: 60, na: 72, closed: true, a: [-PI, PI], smooth: 3, minDa: 0.1, empty: 0.3,
    post: (Rd) => { for (let j = 0; j < Rd[0].length; j++) for (let i = Rd.length - 2; i >= 0; i--) Rd[i][j] = Math.max(Rd[i][j], Rd[i + 1][j]); },
    shape: (r) => r + 0.08,
  });
  // (the mantle's foot: over the upper breast before (clear of the heart), down the shoulder blades behind, onto the
  // pauldrons' tops at the sides; its head under the gorget's foot)
  const coreTop = coreOf(B).top;
  const yF = Math.max(coreTop + 0.08, M.neckF - 0.7), yB = A.chest[1] - (fem ? 0.35 : 0.5), ySide = A.shoulder.l[1] + (fem ? 0.08 : 0.1);
  const yBot = (a) => { const b = Math.abs(wrapAngle(a)), sd = Math.sin(b) ** 2; return b < PI / 2 ? lerp([0, yF, 0], [0, ySide, 0], sd)[1] : lerp([0, yB, 0], [0, ySide, 0], sd)[1]; };
  const yTop = (a) => cTop(a) - 0.25 - 0.18 * smooth(1.0, 0.2, Math.abs(wrapAngle(a)));
  const at = (u, a, off) => { const yy = yBot(a) + (yTop(a) - yBot(a)) * u, q = C.ta(ct(yy), a); return { p: add(q.p, mul(q.n, off)), n: q.n }; };
  // (the shoulders' weights over the pauldrons, the torso's between)
  const shW = { l: mixOf(B, [['shoulder_l', 0.45], ['upperarm_l', 0.15], ['clavicle_l', 0.4]]), r: mixOf(B, [['shoulder_r', 0.45], ['upperarm_r', 0.15], ['clavicle_r', 0.4]]) };
  const wM = (p) => { const k = smooth(0.6, 1.15, Math.abs(p[0])); return mixW([[mixW([[W(p), 0.6], [wNeck, 0.4 * smooth(n - 0.9, n - 0.2, p[1])]]), 1 - k], [p[0] > 0 ? shW.l : shW.r, k]]); };
  // -- the plates: three rows lapped like tiles (the higher over the lower), each a slab of crust cut to a point at its foot
  const ROWS = [{ u0: -0.04, u1: 0.6, n: 10, off: 0.08, seed: 100 }, { u0: 0.42, u1: 1.04, n: 8, off: 0.16, seed: 200 }];
  ROWS.forEach((r, k) => {
    for (let j = 0; j < r.n; j++) {
      const a0 = -PI + (TAU * (j + (k % 2) * 0.5)) / r.n, da = (TAU / r.n) * 1.28;
      // (each plate rigid: the weights at its middle, so it never stretches; the bed under it gives)
      const mid = at((r.u0 + r.u1) / 2, a0, r.off).p, kx = smooth(0.55, 0.9, Math.abs(mid[0])) * smooth(0.45, 0.8, Math.abs(Math.sin(a0))), lift = r.off + 0.15 * smooth(0.5, 1.1, Math.abs(mid[0]));
      const wPlate = mixW([[wM(mid), 1 - kx], [mid[0] > 0 ? shW.l : shW.r, kx]]);
      out.push(crustPlate((x, yy) => at(r.u1 - (r.u1 - r.u0) * yy, a0 - da / 2 + da * x, lift), {
        seed: r.seed + j * 3, points: 1, narrow: 0.12, thick: 0.05, tilt: 0.08, ridge: 0.06, nu: 3, nv: 4,
        w: () => wPlate, mat: (sd) => ((sd + j + k) % 2 ? 'crustL' : 'crust'), side: 'crustS',
      }));
      // (under each plate its molten bed, a little wider, seen lit in the seams; rigid with its plate)
      // (the lower row's only: its seams open over the plate below; the upper row's lie over the lower row's plates)
      if (k === 0) {
        const bed = patch((u, v) => at(r.u1 - (r.u1 - r.u0) * (0.45 + 0.5 * u), a0 - da * 0.53 + da * 1.06 * v, lift - 0.035), 2, 3);
        out.push(solid(bed, { sheet: true, w: () => wPlate, mat: () => 'rune' }));
      }
    }
  });
  // -- the crests: over each shoulder three blades of crust standing up and out as flames, the middle the tallest, a
  // molten seam up each (lit)
  for (const sg of [1, -1]) {
    [[1.15, 0.95, 1], [1.57, 1.45, 2], [2.0, 1.05, 3]].forEach(([am0, h0, k]) => {
      const am = sg * am0, base = at(0.55, am, 0.3), rad = unit([base.n[0], 0, base.n[2]]), up = unit(add([0, 1, 0], mul(rad, 0.42)));
      const across = unit(cross(up, rad)), h = h0 * (fem ? 0.82 : 1), wd = fem ? 0.4 : 0.48;
      const g = flameOn((x, yy) => ({ p: add(base.p, add(mul(across, (x - 0.5) * wd), mul(up, yy * h))), n: rad }), { n: 1, seed: 40 + k + (sg > 0 ? 0 : 5), lift: 0, nu: 4, nv: 6 });
      out.push(solid(g, { w: () => shW[sg > 0 ? 'l' : 'r'], thick: 0.06, mat: (i, j) => (j < 3 ? 'crustL' : 'crust'), inner: 'crustS', edge: 'fsW' }));
      out.push(band(colPath(g, 3, 0.3, 3.4, 5, 0.012), { wide: 0.05, high: 0.012, mat: 'rune', w: () => shW[sg > 0 ? 'l' : 'r'] }));
    });
  }
  // -- the clasp at the throat: a black bezel, a forge-hot ring in it, lit
  const cq = at(0.62, 0, 0.3), co = unit(add(cq.n, [0, 0.25, 0])), cx = unit(cross([0, 1, 0], co)), cy = cross(co, cx);
  const cR = fem ? 0.22 : 0.26, wC = mixOf(B, [['spine_03', 0.6], ['neck_01', 0.4]]);
  const bezel = patch((u, v) => { const a2 = v * TAU, rr = cR * (0.2 + 1.25 * u) * (1 + 0.12 * Math.cos(a2 * 6) * u); return { p: add(cq.p, add(mul(co, 0.05 * (1 - u)), add(mul(cx, Math.cos(a2) * rr), mul(cy, Math.sin(a2) * rr)))), n: co }; }, 2, 18, { closed: true });
  out.push(solid(bezel, { w: () => wC, thick: 0.04, mat: (i) => (i === 0 ? 'fsS' : 'fs'), inner: 'fsD', edge: 'fsS' }));
  const ringPath = [...Array(16).keys()].map((k) => { const a2 = (k / 16) * TAU; return { p: add(cq.p, add(mul(co, 0.09), add(mul(cx, Math.cos(a2) * cR), mul(cy, Math.sin(a2) * cR)))), n: co }; });
  out.push(sweep(ringPath, { closed: true, closedProfile: true, profile: roundProfile(0.065, 5), mat: 'rune', w: () => wC }));
  out.push(stud(add(cq.p, mul(co, 0.06)), co, { r: 0.09, h: 0.07, k: 5, mat: 'fsM', capMat: 'fsL', w: () => wC }));
  out.push(...cloakOf(B, M, yB));
  return coverHides(B, merge(...out), 0.6);
}

/** The cloak under the mantle's plates behind: smoke-dark, folded, its hem torn into tongues, charred and smouldering. */
function cloakOf(B, M, yUnder) {
  const A = B.at, fem = B.who === 'female', out = [], n = A.neck[1];
  const { T, L, R: Rr } = chestParts(B), pts = [];
  const armW = (w) => w.some(([b, x]) => x > 0.25 && /(upperarm|lowerarm|elbow|hand|wrist|shoulder_)/.test(B.bones[b].name));
  for (const P of [...T.parts, ...L, ...Rr]) P.V.forEach((p, i) => { if (!armW(P.W[i]) && p[2] < 0.6) pts.push(p); });
  for (const q of skinSamples(B)) if (shareW(B, q.w, 'torso', 'thigh') > 0.8 && headW(B, q.w) < 0.1 && shareW(B, q.w, 'upperarm', 'shoulder', 'forearm', 'hand') < 0.05) pts.push(q.p);
  const zc = torsoField(B).zc;
  const yHem = lerp(A.hip.l, A.knee.l, fem ? 0.6 : 0.58)[1], cy0 = yHem - 0.6, cy1 = n + 0.2, ct = (yy) => (yy - cy0) / (cy1 - cy0);
  const C = torsoWrap(B, cy0, cy1, zc, {
    points: pts, nt: 60, na: 64, closed: true, a: [-PI, PI], smooth: 3, minDa: 0.1, empty: 0.3,
    post: (R) => { for (let j = 0; j < R[0].length; j++) for (let i = R.length - 2; i >= 0; i--) R[i][j] = Math.max(R[i][j], R[i + 1][j]); },
    shape: (r, tt) => r + 0.16 + 0.1 * smooth(ct(M.waist), ct(M.hip - 0.3), tt) + 0.22 * smooth(ct(M.hip), ct(yHem), tt),
  });
  // (its top under the plates behind; its sides round to the back of the hips; its hem torn into tongues, longest behind)
  const yTop = yUnder + 0.3, half = fem ? 0.92 : 0.92, topHalf = 0.8;
  const NU = 16, NV = 30, NT = 9;
  const tear = (v) => 0.42 * flameEdge(v, NT, { seed: 51, lo: 0.35, sharp: 1.3 }) * (0.55 + 0.45 * Math.sin(PI * v));
  const cape = patch((u, v) => {
    const d = (-1 + 2 * v) * half, yb = yHem + 0.15 * (Math.abs(d) / half) ** 2 - tear(v), yy = yb + (yTop - yb) * u;
    const widen = smooth(M.waist + 0.3, M.hip, yy), a = PI + d * (topHalf / half + (1 - topHalf / half) * widen);
    const fold = 0.15 * (0.5 - 0.5 * Math.cos(d * 11)) * smooth(yTop - 0.3, M.hip, yy);
    const q = C.ta(ct(yy), a), edge = 0.1 * smooth(0.7, 1, Math.abs(d) / half) * widen;
    return { p: add(q.p, mul(q.n, fold - edge)), n: q.n };
  }, NU, NV);
  const Wt = nearSkinW(B, (q) => shareW(B, q.w, 'torso') > 0.8 && q.p[2] < 0.4, (nm) => ['spine_03', 'spine_02', 'spine_01', 'pelvis', 'clavicle_l', 'clavicle_r'].includes(nm), 0.35);
  void Wt;
  const thOf = (s) => skinW(B, (q) => q.p[0] * (s === 'l' ? 1 : -1) > 0.12 && shareW(B, q.w, 'thigh') > 0.6 && along(q.p, A.hip[s], A.knee[s]) > 0.25 && along(q.p, A.hip[s], A.knee[s]) < 0.8, (nm) => nm.endsWith(`_${s}`));
  const thW = { l: thOf('l'), r: thOf('r') };
  const anchors = [[A.chest[1], 'spine_03'], [A.spine2[1], 'spine_02'], [A.spine1[1], 'spine_01'], [Math.min(A.pelvis[1], A.spine1[1] - 1.0), 'pelvis']];
  const spineW = (yy) => {
    if (yy >= anchors[0][0]) return boneW(B, anchors[0][1]);
    for (let k = 0; k < anchors.length - 1; k++) { const [y0, b0] = anchors[k], [y1, b1] = anchors[k + 1]; if (yy >= y1) { const f = smooth(y0, y1, yy); return mixW([[boneW(B, b0), 1 - f], [boneW(B, b1), f]]); } }
    return boneW(B, 'pelvis');
  };
  const wCl = (p) => { const f = 0.5 * smooth(M.hip, yHem, p[1]), l = smooth(-0.7, 0.7, p[0]); return mixW([[spineW(p[1]), 1 - f], [thW.l, f * l], [thW.r, f * (1 - l)]]); };
  // (wool, charred over its last hand, its tongues' points smouldering)
  // (charcoal wool burning into its hem: dark red, then hot orange at the tongues, their very points lit; slits torn up
  // from three of the notches, and a few holes burned through higher up)
  const tipAt = (j) => tear((j + 0.5) / NV) > 0.27;
  const slit = new Set([[2, 10], [5, 20], [7, 23]].map(([k]) => Math.round((k * NV) / NT)));
  const HOLES = [[7, 6], [9, 17], [6, 24], [11, 11]];
  const open = (i, j) => (slit.has(j) && i >= 1 && i <= 3) || HOLES.some(([hi, hj]) => (i === hi || i === hi + 1) && j === hj);
  const nearOpen = (i, j) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => open(i + di, j + dj));
  const clothMat = (i, j) => (open(i, j) ? null : i === 0 ? (tipAt(j) ? 'hemLit' : 'hemHot') : i === 1 ? 'hemHot' : i === 2 ? 'hemRed' : i === 3 ? 'char' : nearOpen(i, j) ? 'char' : 'smoke');
  const capeP = smoothWeights(solid(cape, { hollow: true, w: wCl, thick: 0.03, mat: clothMat, edge: (i, j) => (nearOpen(i, j) ? 'hemRed' : 'char') }), 7, (p) => Math.abs(p[0]) > 0.15 || p[1] > M.hip);
  out.push(capeP);
  return out;
}

/* ---- legs -------------------------------------------------------------------------------------------------------- */
/**
 * A flame on a surface (`at(x, y)`: { p, n }, x across nought to one, y up it nought at its foot to one at its top): a
 * round foot rising into `n` licking tongues, the middle the tallest, `lift` proud. Its grid, to be made solid.
 */
function flameOn(at, o) {
  const n = o.n ?? 3, nu = o.nu ?? 4, nv = o.nv ?? 12;
  return patch((u, v) => {
    // (its outline: wide at the foot, drawn in as it rises; each column's top a tongue's)
    const top = 0.45 + 0.55 * (0.35 + 0.65 * flameEdge(v, n, { seed: o.seed ?? 1, lo: 0.5, sharp: 1.2 })) * (1 - 0.35 * Math.abs(2 * v - 1));
    const wide = 1 - 0.45 * u, x = 0.5 + (v - 0.5) * wide * (1 - 0.25 * (1 - Math.sin(PI * Math.min(1, u * 3)))), q = at(x, u * top);
    return { p: add(q.p, mul(q.n, o.lift ?? 0.03)), n: q.n };
  }, nu, nv);
}

/** One leg's harness: fluted cuisse and its flame-cut lames, a poleyn with its flame and wing, a ridged greave. */
function legHarness(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, hp = A.hip[s], kn = A.knee[s], an = A.ankle[s], out = [], fem = B.who === 'female';
  const legBones = (n) => n.endsWith(`_${s}`);
  // -- the cuisse: down the front and the outside of the thigh, three flutes down it, two flame-cut lames at its foot
  const thPick = (q) => (sg > 0 ? q.p[0] > 0.12 : q.p[0] < -0.12) && shareW(B, q.w, 'thigh') > 0.6;
  const TH = limbWrap(B, hp, kn, sg, { t: [0, 1.05], nt: 21, a: [-PI, PI], closed: true, na: 28, pick: thPick, smooth: 4, shape: (r) => r });
  const wTh = thighW(B, s);
  const FL = [0.05, 0.55, 1.05];
  const flute = (a) => 0.045 * FL.reduce((m, f) => Math.max(m, Math.exp(-(((a - f) / 0.13) ** 2))), 0);
  const a0 = -0.7, a1 = 2.15, NV = 20;
  const cuisse = plateOn(TH, { a0, a1, t0: () => 0.68, t1: (a) => 0.3 + 0.03 * smooth(0.6, 1.6, a), nu: 5, nv: NV, off: (u, v, t, a) => 0.13 + flute(a) + 0.02 * u });
  out.push(solid(cuisse, { sheet: true, w: () => wTh, mat: (i) => (i === 4 ? 'fsM' : 'fs') }));
  out.push(tube(rowPath(cuisse, 5, 0, NV, 12), { r: 0.04, k: 3, mat: 'fsL', w: () => wTh }));
  for (const f of FL) out.push(tube(colPath(cuisse, ((f - a0) / (a1 - a0)) * NV, 0.4, 4.7, 5, 0.0), { r: 0.028, k: 3, mat: 'fsL', w: () => wTh }));
  for (let k = 0; k < 2; k++) {
    const t0 = 0.67 + 0.09 * k, t1 = t0 + 0.1;
    const g = flameLame(TH, { a0: -0.65, a1: 2.0, t0, t1, foot: 't1', amp: 0.05, n: 4, seed: 90 + k + (sg > 0 ? 0 : 4), nu: 2, nv: 16, off: (u, v, t, a) => 0.15 - 0.012 * k + flute(a) * 0.6 + 0.03 * u });
    out.push(solid(g, { sheet: true, w: () => wTh, mat: (i) => (i === 0 ? 'ember' : 'fsM') }));
    out.push(tube(rowPath(g, 2, 0, 16, 10), { r: 0.03, k: 3, mat: 'fsW', w: () => wTh }));
  }
  // -- the poleyn: a cop over the knee, a flame inlaid on it (lit), and a wing off its outside cut as a flame
  const kPick = (q) => (sg > 0 ? q.p[0] > 0.12 : q.p[0] < -0.12) && shareW(B, q.w, 'thigh', 'calf') > 0.8 && len(sub(q.p, kn)) < 0.9;
  const k0 = lerp(hp, kn, 0.84), k1 = lerp(kn, an, 0.14);
  const KN = limbWrap(B, k0, k1, sg, { t: [0, 1], nt: 10, a: [-PI, PI], closed: true, na: 28, pick: kPick, smooth: 4, shape: (r) => r });
  const wKn = boneW(B, `knee_${s}`);
  const copOff = (u, v) => 0.2 + 0.12 * Math.sin(PI * u) * Math.sin(PI * v) ** 0.7 + 0.04 * Math.exp(-(((v - 0.5) / 0.08) ** 2)) * Math.sin(PI * u);
  const cop = plateOn(KN, { a0: -1.45, a1: 1.45, t0: () => 0.02, t1: () => 0.98, nu: 7, nv: 14, off: copOff });
  out.push(solid(cop, { sheet: true, w: () => wKn, mat: () => 'fs' }));
  out.push(tube(rowPath(cop, 0, 0, 14, 14), { r: 0.04, k: 3, mat: 'fsL', w: () => wKn }));
  out.push(tube(rowPath(cop, 7, 0, 14, 14), { r: 0.04, k: 3, mat: 'fsL', w: () => wKn }));
  // (the flame: up the cop's front from its foot, three tongues, set in a black rim)
  const kAt = (x, yy) => cop.at(7 * (0.92 - 0.82 * yy), 14 * (0.27 + 0.46 * x));
  const fl = flameOn(kAt, { n: 3, seed: 5 + (sg > 0 ? 0 : 1), lift: 0.035, nu: 4, nv: 12 });
  out.push(solid(fl, { sheet: true, w: () => wKn, mat: () => 'rune' }));
  out.push(tube(rowPath(fl, 4, 0, 12, 24, 0.0).concat(), { r: 0.025, k: 3, mat: 'fsS', w: () => wKn }));
  // (the wing: a plate standing off the outside of the knee cut into tongues licking up the thigh, its edge bright)
  const kc = KN.ta(0.5, PI / 2 - 0.25), wo = unit(add(kc.n, [0, 0, 0.35])), legUp = unit(sub(hp, an));
  const wx = unit(sub(legUp, mul(wo, dot(legUp, wo)))), wy = cross(wo, wx), wc = add(kc.p, mul(wo, 0.22));
  const wR = fem ? 0.75 : 0.9;
  const wing = patch((u, v) => {
    const x = (v - 0.5) * 2, tip = 0.5 + 0.5 * flameEdge(v, 3, { seed: 61 + sg, lo: 0.55 });
    const up2 = wR * (-0.35 + u * (0.35 + tip * 1.05)), across = wR * 0.5 * x * (1 - 0.3 * u);
    return { p: add(wc, add(mul(wx, up2), add(mul(wy, across), mul(wo, 0.07 * u * u - 0.05 * x * x)))), n: wo };
  }, 3, 12);
  out.push(solid(wing, { w: () => wKn, thick: 0.035, mat: (i) => (i === 0 ? 'fsS' : 'fs'), inner: 'ember', edge: 'fsL' }));
  out.push(stud(add(wc, mul(wo, 0.02)), wo, { r: 0.08, h: 0.07, k: 5, mat: 'fsM', capMat: 'fsL', w: () => wKn }));
  // -- the greave: closed round the calf, a sharp ridge down the shin, a flame-cut lame at its head, flared at its foot
  const cPick = (q) => (sg > 0 ? q.p[0] > 0.12 : q.p[0] < -0.12) && shareW(B, q.w, 'calf') > 0.6;
  const SH = limbWrap(B, kn, an, sg, { t: [0, 1.02], nt: 20, a: [-PI, PI], closed: true, na: 26, pick: cPick, smooth: 4, shape: (r) => r });
  const wCa = skinW(B, (q) => cPick(q) && along(q.p, kn, an) > 0.2 && along(q.p, kn, an) < 0.85, legBones);
  const shin = (a) => 0.11 * Math.exp(-((a / 0.2) ** 2));
  const side2 = (a) => 0.035 * Math.exp(-(((Math.abs(a) - 1.2) / 0.15) ** 2));
  const calf = (t, a) => 0.08 * Math.exp(-(((t - 0.33) / 0.17) ** 2)) * Math.max(0, -Math.cos(a)) ** 1.5;
  const NG = 22;
  const greave = plateOn(SH, { a0: -PI, a1: PI, closed: true, t0: (a) => 0.93 + 0.03 * smooth(1.6, 2.8, Math.abs(a)), t1: () => 0.16, nu: 7, nv: NG, off: (u, v, t, a) => 0.11 + shin(a) + side2(a) + calf(t, a) + 0.16 * smooth(0.78, 0.93, t) ** 1.5 });
  out.push(solid(greave, { sheet: true, w: () => wCa, mat: (i) => (i === 1 ? 'fsM' : 'fs') }));
  out.push(tube(rowPath(greave, 0, 0, NG, 16), { r: 0.045, k: 3, mat: 'fsL', w: () => wCa, closed: true }));
  for (const a of [0, 1.2, -1.2]) out.push(tube(colPath(greave, ((a + PI) / TAU) * NG, 0.8, 6.6, 6, 0.0), { r: a ? 0.024 : 0.03, k: 3, mat: a ? 'fsW' : 'fsL', w: () => wCa }));
  // (the lame at its head, under the poleyn, flame-cut at its foot over the ember of the greave's top)
  const gl = flameLame(SH, { a0: -1.9, a1: 1.9, t0: 0.08, t1: 0.17, foot: 't1', amp: 0.06, n: 5, seed: 81 + (sg > 0 ? 0 : 3), nu: 2, nv: 18, off: () => 0.16 });
  out.push(solid(gl, { sheet: true, w: () => wCa, mat: () => 'fsM' }));
  out.push(tube(rowPath(gl, 2, 0, 18, 12), { r: 0.03, k: 3, mat: 'fsW', w: () => wCa }));
  return out;
}
/** The arming hose: the hips and the legs to the ankles, close over the skin; its waist (`armingW`) left out under a chest piece. */
function hose(B) {
  const A = B.at, M = torsoMarks(B);
  return shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'thigh', 'calf', 'torso') > 0.6 && on(B, i, 'foot') < 0.5 && on(B, i, 'upperarm', 'forearm', 'hand', 'shoulder') < 0.05 && p[1] < M.waist + 0.25 && p[1] > A.ankle[s][1] - 0.05; },
    off: () => 0.03,
    mat: ({ p }) => (p[1] > M.hip + 0.05 ? 'armingW' : 'arming'),
  });
}
export function firesteelLegs(B) {
  return { P: merge(smoothWeights(hose(B), 3, (p) => p[1] > B.at.knee.l[1] + 0.6), ...legHarness(B, 'l'), ...legHarness(B, 'r')), dropAt: (f) => f.mat === 'armingW' };
}

/* ---- boots ------------------------------------------------------------------------------------------------------- */
/** One foot's sabaton: flame-cut lames over the instep to a long sharp toe, a spur at the heel, over a leather shoe. */
function sabaton(B, s) {
  const A = B.at, sg = s === 'l' ? 1 : -1, an = A.ankle[s], ball = A.ball[s], out = [], fem = B.who === 'female';
  const fPick = (q) => (sg > 0 ? q.p[0] > 0.1 : q.p[0] < -0.1) && shareW(B, q.w, 'foot') > 0.6;
  const toes = skinSamples(B).filter(fPick);
  const tip = toes.reduce((b, q) => (q.p[2] > b[2] ? q.p : b), [0, 0, -9]);
  const heel = toes.filter((q) => q.p[1] < an[1] - 0.25).reduce((b, q) => (q.p[2] < b[2] ? q.p : b), [0, 0, 9]);
  // (along the foot from the ankle's front to a point well past the toes, low: the gothic toe drawn out sharp)
  const from = [an[0], an[1] - 0.05, an[2] + 0.05], to = [tip[0] + sg * 0.06, A.floor + 0.12, tip[2] + (fem ? 0.95 : 1.15)];
  const tBall = along(ball, from, to), tToe = along(tip, from, to);
  const FT = limbWrap(B, from, to, sg, { front: [0, 1, 0], t: [0, 1.0], nt: 24, a: [-PI, PI], closed: true, na: 20, pick: fPick, smooth: 4,
    shape: (r, t) => r * (t > tToe - 0.4 ? Math.max(0.02, 1 - (t - (tToe - 0.4)) / (1.01 - (tToe - 0.4))) ** 1.1 : 1) });
  const wFoot = boneW(B, `foot_${s}`), wBall = boneW(B, `ball_${s}`);
  // (the lames: four over the instep, each flame-cut at its foot over the ember of the next, the last bright)
  const lames = 4, l0 = 0.27, l1 = tBall - 0.02, h = (l1 - l0) / lames;
  for (let k = 0; k < lames; k++) {
    const t0 = l0 + h * k, t1 = t0 + h + 0.035;
    const g = flameLame(FT, { a0: -1.75, a1: 1.75, t0, t1, foot: 't1', amp: 0.035, n: 3, seed: 130 + k + (sg > 0 ? 0 : 7), nu: 3, nv: 10, off: (u) => 0.12 - 0.008 * k + 0.03 * (1 - u) });
    out.push(solid(g, { sheet: true, w: () => wFoot, mat: (i) => (i === 0 && k > 0 ? 'emberLit' : 'fsM') }));
    out.push(tube(rowPath(g, 3, 0, 10, 8), { r: 0.035, k: 3, mat: k === lames - 1 ? 'fsL' : 'fsW', w: () => wFoot }));
  }
  // (the toe: a keeled shell to a sharp point, its keel and point burned bright)
  const toe = plateOn(FT, { a0: -1.85, a1: 1.85, t0: () => tBall - 0.04, t1: () => 1.0, nu: 8, nv: 12, off: (u, v) => (0.07 + 0.05 * Math.exp(-(((v - 0.5) / 0.1) ** 2))) * (1 - smooth(0.5, 1, u)) + 0.015 });
  out.push(solid(toe, { sheet: true, w: () => wBall, mat: (i) => (i >= 6 ? 'fsW' : 'fs') }));
  out.push(tube(rowPath(toe, 0, 0, 12, 8), { r: 0.035, k: 3, mat: 'fsL', w: () => wBall }));
  out.push(tube(colPath(toe, 6, 0.3, 8, 8), { r: 0.03, k: 3, mat: 'fsL', w: () => wBall }));
  const under = plateOn(FT, { a0: PI - 1.3, a1: PI + 1.3, t0: () => tBall - 0.04, t1: () => 1.0, nu: 5, nv: 6, off: (u) => 0.1 * (1 - smooth(0.6, 1, u)) + 0.02 });
  out.push(solid(under, { sheet: true, w: () => wBall, mat: () => 'sole' }));
  // (the spur: a yoke round the heel, its neck out behind, a rowel of six points at its end)
  const hc = add(heel, [0, 0.12, -0.08]), yoke = [];
  for (let k = 0; k <= 8; k++) {
    const a = -PI / 2 + (PI * k) / 8, d = [Math.sin(a) * sg * 0 + Math.cos(a) * 0, 0, 0]; void d;
    const side = Math.sin(a), back = Math.cos(a);
    yoke.push({ p: add(an, [side * (fem ? 0.4 : 0.46), hc[1] - an[1] - 0.02 * Math.abs(side), (hc[2] - an[2]) * back + 0.05 * (1 - back)]), n: [side, 0, -back] });
  }
  out.push(tube(yoke, { r: 0.04, k: 4, mat: 'fsM', w: () => wFoot }));
  const neck0 = add(hc, [0, 0, -0.02]), neck1 = add(hc, [0, -0.06, -(fem ? 0.4 : 0.48)]);
  out.push(tube([{ p: neck0, n: [0, 1, 0] }, { p: lerp(neck0, neck1, 0.5), n: [0, 1, 0] }, { p: neck1, n: [0, 1, 0] }], { r: 0.045, k: 4, mat: 'fsW', w: () => wFoot }));
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU, d = [0, Math.cos(a), -Math.sin(a)];
    out.push(spike(neck1, d, { r: 0.04, h: fem ? 0.18 : 0.21, k: 3, mat: 'fsL', w: wFoot }));
  }
  return out;
}
/** The leather shoe under the sabatons: the foot and the ankle's foot, close over the skin, stood on. */
function shoe(B) {
  const A = B.at;
  const P = shell(B, {
    sub: 1, rim: null,
    keep: (i) => { const p = B.V[i], s = p[0] >= 0 ? 'l' : 'r'; return on(B, i, 'foot', 'calf') > 0.6 && p[1] < A.ankle[s][1] + 0.3; },
    off: ({ n }) => 0.045 + (n[1] < -0.6 ? 0.06 : 0),
    mat: ({ n }) => (n[1] < -0.55 ? 'sole' : 'leather'),
  });
  P.soles = P.V.map((_, i) => i).filter((i) => P.V[i][1] < A.floor + 0.12);
  return P;
}
export function firesteelBoots(B) {
  return merge(shoe(B), ...sabaton(B, 'l'), ...sabaton(B, 'r'));
}
