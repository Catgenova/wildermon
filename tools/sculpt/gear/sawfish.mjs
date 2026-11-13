// The saw, the fishing rod and the fishing net (src/game/items.ts saw, fishing_rod, fishing_net) in the Runecut line of
// the hand tools (tools/sculpt/gear/handparts.mjs), and the sawhorse with its log that the saw clip's other hand presses
// on (src/sculpt/anim/clips/saw.ts), low-poly for the low-poly bodies (tools/sculpt/lowgear.mjs). Run on its own (or
// through tools/sculpt/gear/<id>.mjs), it writes src/sculpt/assets/<id>.json for each (gearAsset).
//
//   build(id, { enchanted }) -> { G, MATS, L, grip, fit, contact, ends, tris, all }
//
// Game units (the man 16.5 tall), each in its own frame as gearAsset takes it: y along the handle toward the thumb of
// the fist on it, x along the hand toward the knuckles, z = x × y.
//   saw: y up the grip bar of the closed handle; the blade runs out along +x from the handle's front post, its teeth
//     along the lower edge (-y), its spine skewed back to the toe. The fist on the grip bar (lead), the teeth's middle the
//     contact. Its blade in the saw's metal (metalFaces), the handle wood.
//   fishing_rod: y from the butt to the tip; the cork grip with the reel under it (+x: the knuckles' side, held below the
//     rod), the wooden blank tapering to the tip with gold wraps, a line hanging from the tip 78 degrees off the rod toward
//     +x to a float (straight down when the rod is held 12 degrees below level, as the fish clip waits). The fist on the
//     grip above the reel (lead); its wood in the rod's wood (`wood`, lowpoly.ts woodTint).
//   fishing_net: y from the butt to the hoop; the pole, gold collars, the hoop round in the y-z plane past the pole's end,
//     the net's bag hanging from it toward +x. The front fist (lead) a hand's span up from the rear's by the butt.
//   sawhorse: held flat under the left palm: its lead the palm's middle on the log's top, the log along y (the thumb's
//     way: the body's right), its middle down into +z (the palm's side), two X-trestles under it standing on the ground
//     SAWHORSE.ground below the palm, the kerf of the cut at y SAWHORSE.cut on the log's overhang, sawdust under it.
//     sawhorse_r the same mirrored (z negated) for the right palm, whose palm's side is -z.
// Enchanted: the medallions' stars and discs lit, glow added round them (the polygons from glowFrom on).

import { meshOf, trisOf, metalFaces, metalMats } from '../lowgear.mjs';
import { partsOf } from './handparts.mjs';
import { MATS_PLAIN as HAND_PLAIN, MATS_ENCHANTED as HAND_ENCHANTED, METAL } from './handparts.mjs';

export const MATS_PLAIN = {
  ...Object.fromEntries(Object.entries(HAND_PLAIN).filter(([k]) => !['head', 'head2', 'endgrain', 'core'].includes(k))),
  // the rod's cork grip, the net's mesh and hoop rope, the float's paint, the log's bark and end grain, the sawdust
  cork: { c: '#c9a477', vary: 0.03 },
  cork2: { c: '#b48d61', vary: 0.03 },
  net: { c: '#d8ccb0', vary: 0.04 },
  netD: { c: '#b5a586', vary: 0.04 },
  rope: { c: '#a88a5c', vary: 0.03 },
  line: { c: '#e8e2d2' },
  red: { c: '#c8402e' },
  white: { c: '#efe8da' },
  bark: { c: '#6e4f36', vary: 0.05 },
  bark2: { c: '#5a3f2b', vary: 0.05 },
  endgrain: { c: '#d6b98f' },
  rings: { c: '#b8936a' },
  kerf: { c: '#3a2618' },
  dust: { c: '#e2c89c' },
  core: { c: '#c9b28a' },
};
export const MATS_ENCHANTED = { ...MATS_PLAIN, ...Object.fromEntries(['rune', 'core', 'star', 'gem'].map((k) => [k, HAND_ENCHANTED[k]])) };
/** The rod's wood is the rod's own (`wood`: drawn in its wood, lowpoly.ts woodTint). */
const ROD_WOOD = ['wood', 'wood2', 'grain'];

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];

/** The common kit: the hand tools' parts, and a prism from an outline (points in the x-y plane) between two depths of z. */
function kit() {
  const G = meshOf(), parts = partsOf(G), { P, F } = parts;
  /** An outline in the x-y plane extruded from z0 to z1: front and back faces, its sides looking out from its middle. */
  const slab = (pts, z0, z1, mat, side = mat) => {
    const c = mul(pts.reduce((s, [x, y]) => add(s, [x, y, 0]), [0, 0, 0]), 1 / pts.length);
    const a = pts.map(([x, y]) => P([x, y, z0])), b = pts.map(([x, y]) => P([x, y, z1]));
    F(a, typeof mat === 'function' ? mat(-1) : mat, [0, 0, Math.sign(z0 - z1)]);
    F(b, typeof mat === 'function' ? mat(1) : mat, [0, 0, Math.sign(z1 - z0)]);
    for (let j = 0; j < pts.length; j++) { const k = (j + 1) % pts.length; F([a[j], a[k], b[k], b[j]], typeof side === 'function' ? side(j) : side, { from: [c[0], c[1], (z0 + z1) / 2] }); }
  };
  /** A box between two corners. */
  const box = (x0, y0, x1, y1, z0, z1, mat, side) => slab([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z0, z1, mat, side);
  /** An n-sided tube between rings (each { c, u, v, r }: its middle, the plane's axes, its radius), the bands' materials by (band, side). */
  const ringAt = (c, u, v, r, n = 8, rot = 0.5) => [...Array(n).keys()].map((j) => { const t = ((j + rot) * 2 * Math.PI) / n; return P(add(c, add(mul(u, r * Math.cos(t)), mul(v, r * Math.sin(t))))); });
  return { G, ...parts, slab, box, ringAt };
}
const done = (K, o) => {
  const { G } = K;
  for (let i = 0; i < G.V.length; i++) if (G.A[i] === undefined) G.A[i] = 1;
  return { G, MATS: o.enchanted ? MATS_ENCHANTED : MATS_PLAIN, all: trisOf(G).length, ...o };
};

/* ---- the saw ------------------------------------------------------------------------------------------------------- */
/** The saw's numbers: its grip bar (the fist's lead up it), the handle's front post, the blade's heel and toe. */
export const SAW = { r: 0.17, grip: [0, 1.3], lead: 0.65, post: [0.95, 1.2], toe: 7.4, teeth: -0.12, spine: [1.5, 0.62] };
function saw(enchanted) {
  const K = kit(), { G, P, F, oct, tube, cap, medal, glowDisc, slab, box } = K, S = SAW, X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  // the handle: the grip bar (eight-sided, gold rings at its ends), the bottom and the top with its horn back over the
  // fist, the front post the blade is set in
  const gr = (y, a) => oct([0, y, 0], X, Z, a, a * 0.85, a * 0.35);
  tube([gr(S.grip[0] + 0.02, S.r), gr(S.grip[0] + 0.14, S.r), gr(S.grip[1] - 0.14, S.r), gr(S.grip[1] - 0.02, S.r)], (i, j) => (i === 1 ? (j % 2 ? 'wood2' : 'wood') : 'gold'));
  const HZ = 0.16;
  box(-0.24, -0.24, S.post[1], 0.04, -HZ, HZ, 'wood', (j) => (j === 0 ? 'wood2' : 'wood'));
  slab([[-0.42, 1.62], [-0.3, 1.27], [S.post[1], 1.27], [S.post[1], 1.55], [0.2, 1.6]], -HZ, HZ, 'wood', (j) => (j % 2 ? 'wood2' : 'wood'));
  box(S.post[0], 0, S.post[1], 1.3, -HZ * 1.05, HZ * 1.05, 'wood2', 'wood');
  // the blade: a thin plate from the post to the toe, its spine skewed back, in the saw's metal; the teeth under it
  const bladeFrom = G.F.length, BZ = 0.035, x0 = S.post[0] + 0.05;
  const spine = [[x0, S.spine[0]], [2.6, 1.28], [4.4, 1.0], [6.2, 0.74], [S.toe, S.spine[1]]];
  const outline = [[x0, S.teeth], [S.toe, S.teeth], ...spine.slice().reverse()];
  slab(outline, -BZ, BZ, (s) => (s < 0 ? 'stoneM' : 'stoneLM'), (j) => (j === 0 ? 'bevelM' : j === 1 ? 'stoneBM' : 'bevelM'));
  const N = 24, step = (S.toe - 0.1 - (x0 + 0.1)) / N;
  for (let k = 0; k < N; k++) {
    const a = x0 + 0.1 + k * step, b = a + step, tip = [a + step * 0.7, S.teeth - 0.17];
    for (const z of [-BZ * 0.8, BZ * 0.8]) F([P([a, S.teeth + 0.01, z]), P([b, S.teeth + 0.01, z]), P([...tip, z])], 'bevelM', [0, 0, Math.sign(z)]);
  }
  // a crack over the blade's face near the heel
  for (const sz of [1, -1]) K.crack([0, 0, sz * (BZ + 0.002)], X, Y, [0, 0, sz], [[1.6, 0.35], [1.9, 0.5], [2.05, 0.42]], 0.02, 'crackM');
  metalFaces(G, [[bladeFrom, G.F.length]], METAL);
  // the blade's heel riveted to the post (gold), a rune line along the blade under the spine on each face
  for (const sz of [1, -1]) for (const y of [0.25, 0.75, 1.2]) {
    const c = [S.post[0] + 0.12, y, sz * (BZ + 0.004)], r = oct(c, X, Y, 0.055, 0.055, 0.02);
    F(r, 'gold', [0, 0, sz]);
  }
  for (const sz of [1, -1]) {
    const n = [0, 0, sz], c = [0, 0, sz * (BZ + 0.003)];
    K.line(c, X, Y, n, 1.9, 0.62, 3.3, 0.6, 0.07);
    K.line(c, X, Y, n, 3.6, 0.58, 5.6, 0.42, 0.07);
    K.diamond([3.45, 0.6, sz * (BZ + 0.003)], X, Y, n, 0.13, 0.13, 0.045);
  }
  // the handle's medallion on each face of the post
  for (const sz of [1, -1]) medal([(S.post[0] + S.post[1]) / 2, 0.65, sz * HZ * 1.05], [sz, 0, 0], [0, 0, sz], 0.11, 0.08, 'gem');
  // the top's horn capped in gold over the fist
  F(oct([-0.36, 1.45, 0], Y, Z, 0.07, 0.07, 0.025).map((i) => i), 'gold', [-1, 0.3, 0]);
  const tris = trisOf(G).length;
  if (enchanted) {
    for (const sz of [1, -1]) {
      glowDisc([(S.post[0] + S.post[1]) / 2, 0.65, sz * (HZ * 1.05 + 0.04)], X, Y, [0, 0, sz], 0.3, 0.3, 0.42);
      glowDisc([3.45, 0.6, sz * (BZ + 0.02)], X, Y, [0, 0, sz], 1.6, 0.3, 0.3);
    }
  }
  void cap;
  return done(K, {
    enchanted, L: S.toe, tris,
    grip: { axis: [0, 1, 0], lead: [0, S.lead, 0], second: [0, S.lead, 0], radius: S.r + 0.01, edge: [1, 0, 0], face: [0, 0, 1], from: S.grip[0], to: S.grip[1] },
    fit: { backMax: 0.3 },
    contact: [(x0 + S.toe) / 2, S.teeth - 0.17, 0],
    ends: [[S.toe, S.teeth - 0.17, 0]],
  });
}

/* ---- the fishing rod ----------------------------------------------------------------------------------------------- */
/**
 * The rod's numbers: the cork grip from its butt cap up, the fist on it, the reel's place along it, the blank to the tip;
 * the line off the tip (degrees from the rod toward +x) and its length to the float's middle.
 */
export const ROD = { grip: [0.18, 2.7], lead: 2.15, butt: 0.9, reel: 1.35, tip: 16, line: 78, lineLength: 6.6 };
function rod(enchanted) {
  const K = kit(), { G, P, F, oct, tube, cap, medal, glowDisc, ringAt } = K, R = ROD, X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  const rg = (y, a) => oct([0, y, 0], X, Z, a, a, a * 0.41);
  // the butt cap (gold, a gem on its end), the cork grip in bands, the reel seat's gold, the collar
  const b0 = rg(0, 0.12), b1 = rg(0.06, 0.19), b2 = rg(R.grip[0], 0.19);
  tube([b0, b1, b2], (i) => (i === 0 ? 'goldD' : 'gold'));
  cap(b0, 'gem', [0, -1, 0]);
  const ys = [R.grip[0], 0.7, 1.15, 1.2, 1.55, 1.6, 2.0, 2.45, R.grip[1]];
  const rs = [0.17, 0.18, 0.165, 0.18, 0.18, 0.165, 0.17, 0.165, 0.14];
  tube(ys.map((y, i) => rg(y, rs[i])), (i, j) => (i === 2 || i === 4 ? 'gold' : i === 3 ? 'goldD' : (i + j) % 2 ? 'cork2' : 'cork'));
  // the reel under the seat (+x): a drum across z on a foot, its crank's knob
  const RX = 0.42, RR = 0.3, RW = 0.17;
  const d0 = ringAt([RX, R.reel, -RW], X, Y, RR, 8), d1 = ringAt([RX, R.reel, RW], X, Y, RR, 8);
  tube([d0, d1], (i, j) => (j % 2 ? 'goldD' : 'gold'), () => [RX, R.reel, 0]);
  F(d0, 'stoneL', [0, 0, -1]); F(d1, 'stoneL', [0, 0, 1]);
  K.box(0.12, R.reel - 0.07, RX - RR + 0.04, R.reel + 0.07, -0.06, 0.06, 'goldD');
  const k0 = ringAt([RX + 0.12, R.reel + 0.12, RW], X, Y, 0.05, 4), k1 = ringAt([RX + 0.12, R.reel + 0.12, RW + 0.16], X, Y, 0.05, 4);
  tube([k0, k1], 'wood2', () => [RX + 0.12, R.reel + 0.12, RW + 0.08]);
  F(k1, 'wood', [0, 0, 1]);
  // the blank: tapering from the collar to the tip, its wood in two tones, gold wraps where the guides are
  const yb = [R.grip[1], 3.0, 6.0, 6.12, 9.6, 9.72, 13.0, 13.1, R.tip];
  const rb = [0.13, 0.115, 0.09, 0.09, 0.07, 0.07, 0.05, 0.05, 0.025];
  const bl = yb.map((y, i) => rg(y, rb[i] + (i === 3 || i === 5 || i === 7 ? 0.018 : 0)));
  tube(bl, (i, j) => (i === 0 ? 'goldD' : i === 2 || i === 4 || i === 6 ? 'gold' : j % 2 ? 'wood2' : 'wood'));
  cap(bl[bl.length - 1], 'gold', [0, 1, 0]);
  // the collar's medallions (front and back of the grip's top band)
  for (const sz of [1, -1]) medal([0, 2.28, sz * 0.17], [sz, 0, 0], [0, 0, sz], 0.1, 0.075, 'gem');
  // the line: off the tip toward +x, a thin cross of two strips, to the float (red over white, a double cone)
  const a = (R.line * Math.PI) / 180, dir = [Math.sin(a), Math.cos(a), 0], tip = [0, R.tip, 0], end = add(tip, mul(dir, R.lineLength));
  for (const w of [[0.03, 0, 0], [0, 0, 0.03]]) F([P(add(tip, w)), P(add(tip, mul(w, -1))), P(add(end, mul(w, -1))), P(add(end, w))], 'line', w[0] ? [0, 0, 1] : [1, 0, 0]);
  const fu = dir, fv = [0, 0, 1], fw = [-dir[1], dir[0], 0];
  const fr = [...Array(6).keys()].map((j) => { const t = (j * Math.PI) / 3; return P(add(end, add(mul(fv, 0.2 * Math.cos(t)), mul(fw, 0.2 * Math.sin(t))))); });
  const top = P(add(end, mul(fu, -0.32))), bot = P(add(end, mul(fu, 0.3)));
  for (let j = 0; j < 6; j++) { F([fr[j], fr[(j + 1) % 6], top], 'red', { from: end }); F([fr[j], fr[(j + 1) % 6], bot], 'white', { from: end }); }
  const tris = trisOf(G).length;
  if (enchanted) for (const sz of [1, -1]) glowDisc([0, 2.28, sz * 0.21], X, Y, [0, 0, sz], 0.3, 0.3, 0.42);
  return done(K, {
    enchanted, L: R.tip, tris,
    grip: { axis: [0, 1, 0], lead: [0, R.lead, 0], second: [0, R.butt, 0], radius: 0.18, edge: [1, 0, 0], face: [0, 0, 1], from: R.grip[0], to: R.grip[1] },
    fit: { backMax: 0.3 },
    contact: [0, R.tip, 0],
    ends: [end],
    wood: ROD_WOOD,
  });
}

/* ---- the fishing net ------------------------------------------------------------------------------------------------ */
/** The net's numbers: the pole from its butt, the fists on it (the front, lead; the rear by the butt), the hoop past its end. */
export const NET = { pole: 15, lead: 2.6, butt: 0.5, r: 0.16, hoop: 2.1, bag: 2.4 };
function net(enchanted) {
  const K = kit(), { G, P, F, oct, tube, cap, medal, glowDisc, ringAt } = K, N = NET, X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  const rg = (y, a) => oct([0, y, 0], X, Z, a, a, a * 0.41);
  // the pole: a gold butt cap, the wood in two tones with gold collars, tapering a little to the hoop's socket
  const ys = [0, 0.08, 0.3, 0.38, 3.0, 3.06, 6.2, 6.3, 10, 10.1, N.pole - 0.3, N.pole];
  const rs = [0.12, 0.19, 0.19, N.r, N.r, N.r + 0.02, N.r - 0.01, N.r + 0.01, N.r - 0.02, N.r, N.r - 0.03, N.r];
  const rings = ys.map((y, i) => rg(y, rs[i]));
  tube(rings, (i, j) => (i < 2 || i === 4 || i === 6 || i === 8 || i === 10 ? 'gold' : i === 2 ? 'goldD' : j % 2 ? 'wood2' : 'wood'));
  cap(rings[0], 'gem', [0, -1, 0]);
  cap(rings[rings.length - 1], 'goldD', [0, 1, 0]);
  for (const sz of [1, -1]) medal([0, 0.21, sz * 0.19], [sz, 0, 0], [0, 0, sz], 0.1, 0.075, 'gem');
  // the hoop: a rope ring in the y-z plane, its near side at the pole's end
  const HC = [0, N.pole + N.hoop, 0], n = 12, hoop = [];
  for (let j = 0; j < n; j++) { const t = (j * 2 * Math.PI) / n; hoop.push(add(HC, [0, -N.hoop * Math.cos(t), N.hoop * Math.sin(t)])); }
  for (let j = 0; j < n; j++) {
    const a = hoop[j], b = hoop[(j + 1) % n], ra = ringAt(a, X, [0, (a[1] - HC[1]) / N.hoop, (a[2] - HC[2]) / N.hoop], 0.09, 4, 0), rb = ringAt(b, X, [0, (b[1] - HC[1]) / N.hoop, (b[2] - HC[2]) / N.hoop], 0.09, 4, 0);
    // (each segment a square tube round the ring's way)
    const ta = [ra[0], ra[1], ra[2], ra[3]], tb = [rb[0], rb[1], rb[2], rb[3]];
    for (let k = 0; k < 4; k++) F([ta[k], ta[(k + 1) % 4], tb[(k + 1) % 4], tb[k]], 'rope', { from: add(mul(add(a, b), 0.5), mul(X, 0)) });
  }
  // the bag: from the hoop down toward +x, narrowing in two rings to a knot; the mesh's faces in two tones
  const mid = hoop.map((p) => P(add(add(mul(sub3(p, HC), 0.62), HC), [N.bag * 0.55, 0, 0]))), lo = hoop.map((p) => P(add(add(mul(sub3(p, HC), 0.26), HC), [N.bag * 0.92, 0, 0])));
  const rim = hoop.map((p) => P(p)), knot = P(add(HC, [N.bag, 0, 0]));
  for (let j = 0; j < n; j++) {
    const k = (j + 1) % n;
    F([rim[j], rim[k], mid[k], mid[j]], j % 2 ? 'netD' : 'net', { from: add(HC, [N.bag * 0.35, 0, 0]) });
    F([mid[j], mid[k], lo[k], lo[j]], j % 2 ? 'net' : 'netD', { from: add(HC, [N.bag * 0.7, 0, 0]) });
    F([lo[j], lo[k], knot], 'netD', { from: add(HC, [N.bag * 0.8, 0, 0]) });
  }
  const tris = trisOf(G).length;
  if (enchanted) for (const sz of [1, -1]) glowDisc([0, 0.21, sz * 0.23], X, Y, [0, 0, sz], 0.3, 0.3, 0.42);
  return done(K, {
    enchanted, L: N.pole + 2 * N.hoop, tris,
    grip: { axis: [0, 1, 0], lead: [0, N.lead, 0], second: [0, N.butt, 0], radius: N.r + 0.01, edge: [1, 0, 0], face: [0, 0, 1], from: 0.38, to: N.pole - 0.3 },
    fit: { backMax: 0.3 },
    contact: HC,
    ends: [add(HC, [N.bag, 0, 0])],
  });
}
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/* ---- the sawhorse and its log ------------------------------------------------------------------------------------------ */
/**
 * The sawhorse's numbers: the log's radius, its ends along y, the cut's place on its overhang, the trestles' places, the
 * ground below the palm (the log's top), how far out the legs stand.
 */
export const SAWHORSE = { r: 1.15, ends: [-4.2, 6.0], cut: 3.6, trestles: [-3.0, 1.9], ground: 6.93, spread: 2.3 };
function sawhorse(enchanted) {
  const K = kit(), { G, P, F, oct, tube, cap, slab } = K, S = SAWHORSE, X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  // the log: eight-sided rings along y round (0, y, r), a little uneven, its bark in two tones; its ends' grain and rings
  const lr = (y, r, dx = 0, dz = 0) => oct([dx, y, S.r + dz], X, Z, r, r, r * 0.41);
  const ly = [S.ends[0], -2.7, -1.0, 0.8, 2.6, S.cut - 0.08, S.cut + 0.08, 4.8, S.ends[1]];
  const lw = [1.08, 1.13, 1.16, 1.15, 1.14, 1.13, 1.13, 1.11, 1.06];
  const LR = ly.map((y, i) => lr(y, S.r * lw[i] / 1.15, i % 3 === 1 ? 0.04 : 0, i % 2 ? -0.03 : 0));
  tube(LR, (i, j) => (i === 5 ? (j >= 5 || j === 0 ? 'kerf' : j % 2 ? 'bark' : 'bark2') : (i + j) % 2 ? 'bark' : 'bark2'));
  for (const [r, d] of [[LR[0], -1], [LR[LR.length - 1], 1]]) {
    F(r, 'endgrain', [0, d, 0]);
    const y = d < 0 ? S.ends[0] - 0.01 : S.ends[1] + 0.01;
    F(oct([0, y, S.r], X, Z, 0.55, 0.55, 0.22), 'rings', [0, d, 0]);
    F(oct([0, y - d * 0.005, S.r], X, Z, 0.18, 0.18, 0.07), 'endgrain', [0, d, 0]);
  }
  // the trestles: two legs crossed under the log, standing on the ground out to each side, a gold peg where they cross
  const T = 0.17;
  for (const y0 of S.trestles) for (const sx of [1, -1]) {
    const top = [-sx * 1.35, 0.45], foot = [sx * S.spread, S.ground], d = [foot[0] - top[0], foot[1] - top[1]], l = Math.hypot(...d), n = [(-d[1] / l) * T, (d[0] / l) * T];
    const y = y0 + (sx > 0 ? -0.2 : 0.2);
    // (an outline in the x-z plane, extruded along y: its points as [x, z])
    const pts = [[top[0] - n[0], top[1] - n[1]], [foot[0] - n[0], foot[1] - n[1]], [foot[0] + n[0], foot[1] + n[1]], [top[0] + n[0], top[1] + n[1]]];
    const a = pts.map(([x, z]) => P([x, y - T, z])), b = pts.map(([x, z]) => P([x, y + T, z]));
    F(a, 'wood2', [0, -1, 0]); F(b, 'wood2', [0, 1, 0]);
    for (let j = 0; j < 4; j++) { const k = (j + 1) % 4; F([a[j], a[k], b[k], b[j]], j % 2 ? 'wood2' : 'wood', { from: [(top[0] + foot[0]) / 2, y, (top[1] + foot[1]) / 2] }); }
  }
  for (const y0 of S.trestles) {
    const zc = 0.45 + (1.35 / (1.35 + S.spread)) * (S.ground - 0.45);
    for (const sd of [1, -1]) F(oct([0, y0 + sd * 0.42, zc], X, Z, 0.12, 0.12, 0.05), 'gold', [0, sd, 0]);
  }
  // the stretcher between the trestles under the log
  const zs = 0.45 + (1.35 / (1.35 + S.spread)) * (S.ground - 0.45) + 0.35;
  tube([oct([0, S.trestles[0] - 0.3, zs], X, Z, 0.14, 0.14, 0.05), oct([0, S.trestles[1] + 0.3, zs], X, Z, 0.14, 0.14, 0.05)], (i, j) => (j % 2 ? 'wood' : 'wood2'), () => [0, 0, zs]);
  // the sawdust on the ground under the cut: a low heap
  const dc = [0.2, S.cut, S.ground], heap = [...Array(6).keys()].map((j) => { const t = (j * Math.PI) / 3; return P(add(dc, [0.75 * Math.cos(t), 0.55 * Math.sin(t), -0.01])); }), apex = P(add(dc, [0, 0, -0.22]));
  for (let j = 0; j < 6; j++) F([heap[j], heap[(j + 1) % 6], apex], 'dust', [0, 0, -1]);
  void slab; void cap; void Y;
  const tris = trisOf(G).length;
  return done(K, {
    enchanted, L: S.ends[1], tris,
    grip: { axis: [0, 1, 0], lead: [0, 0, 0], second: [0, 0, 0], radius: 0.05, edge: [1, 0, 0], face: [0, 0, 1], from: -0.5, to: 0.5 },
    fit: { backMax: 0.6 },
    contact: [0, S.cut, 0],
    ends: [[0, S.cut, 0]],
  });
}

const BUILD = { saw, fishing_rod: rod, fishing_net: net, sawhorse, sawhorse_r: sawhorse };
export const IDS = Object.keys(BUILD);
export function build(id, { enchanted = false } = {}) {
  const fn = BUILD[id];
  if (!fn) throw new Error(`sawfish: no prop ${id}`);
  const t = fn(enchanted);
  // the right palm's sawhorse: the left's mirrored across z (its palm's side is -z), each face turned back over
  if (id === 'sawhorse_r') { for (const v of t.G.V) v[2] = -v[2]; for (const f of t.G.F) f.v.reverse(); }
  return { id, ...t };
}

/* ---- the game's copies: node tools/sculpt/gear/sawfish.mjs [ids...] [--out <dir>] ------------------------------------ */
/**
 * The palm's middle on its skin (the sawhorse's sockets: the hand laid flat on the log, not closed on a grip) and the
 * fingers only a little curled over the bark.
 */
async function flatPalm(asset, rigs) {
  const { socketOf } = await import('../lowgear.mjs');
  const r5 = (x) => +x.toFixed(5);
  for (const [who, rig] of Object.entries(rigs)) for (const side of ['l', 'r']) {
    const s = socketOf(rig, side, 0, { back: 0.45, press: 0 });
    asset.sockets[who][side] = { bone: rig.bones[s.bone].name, o: s.o.map(r5), R: s.R.map(r5), curl: { fingers_01: [14, 0, 0], fingers_02: [18, 0, 0], thumb_01: [0, 0, 0], thumb_02: [6, 0, 0], thumb_03: [6, 0, 0] } };
  }
}
export async function writeAsset(id, outDir) {
  const { writeFileSync } = await import('node:fs');
  const { resolve, join } = await import('node:path');
  const { gearAsset } = await import('../lowgear.mjs');
  const { buildRig } = await import('../lowrig.mjs');
  const dir = resolve(outDir ?? new URL('../../../src/sculpt/assets', import.meta.url).pathname);
  const plain = build(id), lit = build(id, { enchanted: true }), rigs = { male: buildRig('male'), female: buildRig('female') };
  const a = await gearAsset(id, plain, lit, rigs);
  const r5 = (x) => +x.toFixed(5);
  a.units = 'game units; its own frame: y along the handle toward the thumb of the fist on it, x along the hand toward the knuckles, z = x × y (tools/sculpt/gear/sawfish.mjs)';
  a.contact = plain.contact.map(r5);
  a.ends = plain.ends.map((p) => p.map(r5));
  a.reach = r5(Math.hypot(...plain.contact.map((c, k) => c - plain.grip.lead[k])));
  a.rest = 0;
  // its wood drawn in the item's wood (lowpoly.ts woodTint)
  for (const w of plain.wood ?? []) { const i = a.mats.indexOf(w); if (i >= 0) { a.plain[i].wood = true; a.enchanted[i].wood = true; } }
  if (id.startsWith('sawhorse')) { a.hand = id === 'sawhorse' ? 'l' : 'r'; await flatPalm(a, rigs); }
  const out = join(dir, `${id}.json`);
  writeFileSync(out, JSON.stringify(a));
  console.log(`wrote ${out}: ${a.counts.tris} triangles (${a.counts.glowTris} more of glow), ${a.mats.length} materials, ${plain.L.toFixed(3)} long, lead ${a.grip.lead[1]}, contact ${a.contact}`);
  return a;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), at = args.indexOf('--out');
  const ids = args.filter((x, i) => !x.startsWith('--') && (at < 0 || i !== at + 1));
  for (const id of ids.length ? ids : IDS) await writeAsset(id, at < 0 ? undefined : args[at + 1]);
}
