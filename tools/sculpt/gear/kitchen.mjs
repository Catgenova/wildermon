// The kitchen props for the low-poly bodies (tools/sculpt/lowgear.mjs), drawn while the kitchen clips play
// (src/sculpt/anim/clips/kitchen.ts): the hand quern set down on the ground (`quern`, on the ground's own bone:
// src/sculpt/lowpoly.ts GROUND) and the peg its upper stone is turned by (`quern_handle`, in the turning fist); the wooden
// spoon (`wooden_spoon`) and the vessels stirred in (`clay_pot`, `clay_bowl`, `clay_jar`, each held by a lug on its side);
// the frying pan (`frying_pan`, its pan in the item's metal: lowgear.mjs metalMats, drawn mirrored in the left hand:
// PropAsset.mirror); the stick a piece is cooked on over the fire (`skewer`).
// Run on its own (or through tools/sculpt/gear/<id>.mjs), it writes src/sculpt/assets/<id>.json for each (gearAsset).
//
//   node tools/sculpt/gear/kitchen.mjs [ids...] [--out <dir>]
//
// Game units (the man 16.5 tall), each in its own frame as the hand tools are: y along what the fist closes on toward the
// thumb, x along the hand toward the knuckles, z = x × y; grip.lead the fist's point, contact what meets the work (the
// spoon's bowl, the vessel's mouth, the pan's middle, the cooked piece, the peg's foot on the stone). The quern's own frame
// is the ground's: y up, z forward of the body, its foot's middle at the origin.

import { meshOf, trisOf, metalFaces, metalMats } from '../lowgear.mjs';

const MATS = {
  wood: { c: '#a8693f', vary: 0.03 },
  wood2: { c: '#935a36', vary: 0.03 },
  grain: { c: '#74401f' },
  clay: { c: '#c27a4f', vary: 0.03 },
  clayL: { c: '#d08a5c', vary: 0.03 },
  clayD: { c: '#a5603c', vary: 0.03 },
  rim: { c: '#8f4e31' },
  inside: { c: '#5c3424' },
  broth: { c: '#9a6a36', vary: 0.04 },
  quern: { c: '#aaa197', vary: 0.035 },
  quernL: { c: '#bbb2a6', vary: 0.03 },
  quernD: { c: '#8d857b', vary: 0.03 },
  eye: { c: '#3d3833' },
  flour: { c: '#d8ccb4', vary: 0.02 },
  stick: { c: '#9b7b4c', vary: 0.04 },
  bark: { c: '#6f5434' },
  meat: { c: '#9a4e33', vary: 0.05 },
  meatD: { c: '#713624', vary: 0.04 },
  char: { c: '#4b2c1f' },
  stone: { c: '#8f8a86', vary: 0.03 },
  stoneB: { c: '#6f6a67', vary: 0.03 },
  bevel: { c: '#b4aea8', vary: 0.02 },
};
// the pan's iron in the item's metal (src/sculpt/lowpoly.ts metalTint: its face as much lighter or darker than `stoneM`)
Object.assign(MATS, metalMats(MATS, ['stone', 'stoneB', 'bevel']));

const TAU = Math.PI * 2;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const unit = (a) => mul(a, 1 / Math.hypot(...a)), cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function kit() {
  const G = meshOf();
  G.A = [];
  const P = (q) => G.p(q);
  const F = (v, mat, out) => { const w = v.filter((x, j) => x !== v[(j + 1) % v.length]); if (w.length >= 3) G.f(w, mat, out); };
  /**
   * A body of revolution about `axis` through `c` (u, v across it): a profile of [radius, height along the axis] from the
   * foot up, n sides; each band its material (mat(i, j)), the bottom and the top capped where their radius is not 0
   * (`caps`: false for an open top). Returns its rings.
   */
  const lathe = (c, axis, profile, n, mat, o = {}) => {
    const a = unit(axis), u = unit(Math.abs(a[1]) > 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0])), v = cross(a, u);
    const rot = o.rot ?? 0.5;
    const rings = profile.map(([r, h]) => [...Array(n).keys()].map((j) => { const t = ((j + rot) / n) * TAU; return P(add(add(c, mul(a, h)), add(mul(u, r * Math.cos(t)), mul(v, r * Math.sin(t))))); }));
    for (let i = 0; i + 1 < rings.length; i++) {
      const mid = add(c, mul(a, (profile[i][1] + profile[i + 1][1]) / 2)), inward = o.inner?.(i);
      for (let j = 0; j < n; j++) {
        const q = [rings[i][j], rings[i][(j + 1) % n], rings[i + 1][(j + 1) % n], rings[i + 1][j]];
        const m = typeof mat === 'function' ? mat(i, j) : mat;
        // (a band of the inside looks in, toward the axis)
        if (inward) { const pt = G.V[q[0]], d = add(mid, mul(pt, -1)); F(q, m, d); } else F(q, m, { from: mid });
      }
    }
    if (o.bottom !== false && profile[0][0] > 1e-6) F([...rings[0]].reverse(), o.bottomMat ?? (typeof mat === 'function' ? mat(0, 0) : mat), mul(a, -1));
    if (o.top && profile[profile.length - 1][0] > 1e-6) F([...rings[rings.length - 1]], o.top, a);
    return rings;
  };
  /** A rod along a polyline, n sides, radii per point; its ends capped. */
  const rod = (pts, radii, n, mat, o = {}) => {
    const rings = pts.map((p, i) => {
      const d = unit(add(pts[Math.min(pts.length - 1, i + 1)], mul(pts[Math.max(0, i - 1)], -1))), u = unit(Math.abs(d[0]) > 0.9 ? cross(d, [0, 0, 1]) : cross(d, [1, 0, 0])), v = cross(d, u);
      return [...Array(n).keys()].map((j) => { const t = ((j + 0.5) / n) * TAU; return P(add(p, add(mul(u, radii[i] * Math.cos(t)), mul(v, radii[i] * Math.sin(t))))); });
    });
    for (let i = 0; i + 1 < rings.length; i++) for (let j = 0; j < n; j++) F([rings[i][j], rings[i][(j + 1) % n], rings[i + 1][(j + 1) % n], rings[i + 1][j]], typeof mat === 'function' ? mat(i, j) : mat, { from: mul(add(pts[i], pts[i + 1]), 0.5) });
    if (o.caps !== false) {
      F([...rings[0]], o.capMat ?? (typeof mat === 'function' ? mat(0, 0) : mat), unit(add(pts[0], mul(pts[1], -1))));
      F([...rings[rings.length - 1]], o.capMat ?? (typeof mat === 'function' ? mat(0, 0) : mat), unit(add(pts[pts.length - 1], mul(pts[pts.length - 2], -1))));
    }
    return rings;
  };
  /** A box (a chunk of meat): centre, half sizes along its own axes x, y, z, its faces each a material. */
  const box = (c, ax, h, mats) => {
    const [X, Y, Z] = ax, corner = (sx, sy, sz) => P(add(c, add(add(mul(X, sx * h[0]), mul(Y, sy * h[1])), mul(Z, sz * h[2]))));
    const k = {}; for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) k[`${sx}${sy}${sz}`] = corner(sx, sy, sz);
    const f = (keys, m, out) => F(keys.map((x) => k[x]), m, out);
    f(['1-1-1', '11-1', '111', '1-11'], mats[0], X); f(['-1-1-1', '-1-11', '-111', '-11-1'], mats[1], mul(X, -1));
    f(['-11-1', '-111', '111', '11-1'], mats[2], Y); f(['-1-1-1', '1-1-1', '1-11', '-1-11'], mats[3], mul(Y, -1));
    f(['-1-11', '1-11', '111', '-111'], mats[4], Z); f(['-1-1-1', '-11-1', '11-1', '1-1-1'], mats[5], mul(Z, -1));
  };
  return { G, P, F, lathe, rod, box };
}

/** The fist's fit on the thin grips here (as the finetools': round the grip across the finger roots). */
const FIT = { backMax: 0.3 };
/** A handle's grip block: its axis y, the fist at `lead`, the grip's radius. */
const gripOf = (lead, r, from, to) => ({ axis: [0, 1, 0], lead: [0, lead, 0], second: [0, lead, 0], radius: r, edge: [1, 0, 0], face: [0, 0, 1], from, to });

/* ---- the wooden spoon: held as stirring holds it, the bowl down under the little finger (toward -y, away from the
   thumb), a straight eight-sided handle up through the fist, the bowl cupped toward +x ------------------------------ */
function spoon(K) {
  const { G, P, F, rod } = K;
  const L = 2.95, B1 = 0.95, BR = [0.34, 0.48];
  rod([[0, B1, 0], [0, 1.5, 0], [0, 2.2, 0], [0, L, 0]], [0.09, 0.105, 0.125, 0.12], 6, (i, j) => (j % 2 ? 'wood' : 'wood2'));
  // the bowl: an oval dish about its own middle, its hollow toward +x
  const c = [0.04, B1 - BR[1], 0], n = 10, rim = [], deep = [];
  for (let j = 0; j < n; j++) { const t = (j / n) * TAU; rim.push(P([c[0] + 0.03, c[1] + BR[1] * Math.cos(t), BR[0] * Math.sin(t)])); deep.push(P([c[0] - 0.09, c[1] + BR[1] * 0.55 * Math.cos(t), BR[0] * 0.55 * Math.sin(t)])); }
  const back = P([c[0] - 0.16, c[1], 0]), hollow = P([c[0] - 0.05, c[1], 0]);
  for (let j = 0; j < n; j++) {
    F([rim[j], rim[(j + 1) % n], deep[(j + 1) % n], deep[j]], j % 2 ? 'wood' : 'wood2', { from: [c[0] + 0.5, c[1], 0] });
    F([deep[j], deep[(j + 1) % n], hollow], 'grain', [1, 0, 0]);
  }
  // its back: the rim drawn round to a point behind the hollow
  for (let j = 0; j < n; j++) F([rim[(j + 1) % n], rim[j], back], j % 2 ? 'wood2' : 'wood', { from: [c[0] + 0.2, c[1], 0] });
  void G;
  return { L, grip: gripOf(2.2, 0.13, 1.6, 2.9), contact: [c[0], c[1], 0], parts: 'handle, bowl' };
}

/* ---- the peg the quern's upper stone is turned by: upright in the fist, its foot on the stone --------------------- */
function quernHandle(K) {
  const { rod, lathe } = K;
  // (its foot at 0, its knob at the top; the fist round its upper half, the thumb up)
  rod([[0, 0, 0], [0, 0.8, 0], [0, 2.1, 0]], [0.12, 0.13, 0.13], 6, (i, j) => (j % 2 ? 'wood' : 'wood2'));
  lathe([0, 2.1, 0], [0, 1, 0], [[0.13, 0], [0.2, 0.06], [0.2, 0.14], [0.08, 0.22]], 6, 'wood2', { top: 'grain' });
  return { L: 2.32, grip: gripOf(1.65, 0.14, 1.2, 2.05), contact: [0, 0, 0], parts: 'peg, knob' };
}

/**
 * A vessel held by a lug on its side (the fist round the lug, the thumb up): its axis up y, its middle out along +x from
 * the lug by its radius and the lug's reach, its mouth at `top`; filled to below the rim.
 */
function vessel(K, profile, o) {
  const { G, F, P, lathe, rod } = K;
  const R = Math.max(...profile.map(([r]) => r)), cx = o.lugAt + R, c = [cx, o.foot, 0], n = 12;
  // the outside, foot to rim; the rim's lip; the inside down to the contents
  const top = profile[profile.length - 1], inner = top[0] - 0.12;
  const out = lathe(c, [0, 1, 0], profile, n, (i, j) => (i === profile.length - 2 ? 'rim' : j % 3 === 0 ? 'clayD' : j % 3 === 1 ? 'clay' : 'clayL'), { bottomMat: 'clayD' });
  const lip = lathe(c, [0, 1, 0], [[top[0], top[1]], [inner, top[1]], [inner * 0.97, top[1] - o.fill]], n, (i) => (i === 0 ? 'rim' : 'inside'), { bottom: false, inner: (i) => i > 0 });
  void out; void lip;
  // the contents: a disc below the rim
  const ring = [...Array(n).keys()].map((j) => { const t = ((j + 0.5) / n) * TAU; return P([cx + inner * 0.97 * Math.cos(t), o.foot + top[1] - o.fill, inner * 0.97 * Math.sin(t)]); });
  F(ring, o.contents ?? 'broth', [0, 1, 0]);
  // the lug: a bar the fist closes on, joined to the side by a stub top and bottom
  const y0 = o.lug[0], y1 = o.lug[1], wall = (y) => { let r = profile[0][0]; for (let i = 0; i + 1 < profile.length; i++) { const [ra, ha] = profile[i], [rb, hb] = profile[i + 1]; if (y - o.foot >= ha && y - o.foot <= hb) r = ra + (rb - ra) * (y - o.foot - ha) / (hb - ha); } return cx - r; };
  rod([[0, y0, 0], [0, y1, 0]], [0.12, 0.12], 6, (i, j) => (j % 2 ? 'clay' : 'clayD'));
  rod([[0, y0 + 0.08, 0], [wall(y0 + 0.08) + 0.08, y0 + 0.08, 0]], [0.1, 0.1], 6, 'clayD', { caps: false });
  rod([[0, y1 - 0.08, 0], [wall(y1 - 0.08) + 0.08, y1 - 0.08, 0]], [0.1, 0.1], 6, 'clayD', { caps: false });
  void G;
  return { L: o.foot + top[1], grip: gripOf((y0 + y1) / 2, 0.13, y0, y1), contact: [cx, o.foot + top[1] - o.fill, 0], parts: 'body, rim, inside, contents, lug' };
}
const pot = (K) => vessel(K, [[0.62, 0], [0.98, 0.32], [1.08, 0.75], [0.92, 1.3], [0.86, 1.42], [0.96, 1.5]], { lugAt: 0.32, foot: -0.55, lug: [0.05, 0.75], fill: 0.4 });
const bowl = (K) => vessel(K, [[0.55, 0], [0.95, 0.18], [1.22, 0.52], [1.3, 0.8], [1.34, 0.86]], { lugAt: 0.3, foot: -0.3, lug: [0.0, 0.48], fill: 0.3 });
const jar = (K) => vessel(K, [[0.6, 0], [0.88, 0.4], [0.9, 1.0], [0.62, 1.55], [0.56, 1.72], [0.66, 1.82]], { lugAt: 0.3, foot: -0.8, lug: [0.1, 0.75], fill: 0.35, contents: 'meat' });

/**
 * The frying pan: the handle along y from its butt, the pan beyond its end, its inside looking along UP (in the handle's
 * frame, square to it: the way that is up while the clip holds it out over the fire); the pan in the item's metal.
 */
export const PAN_UP = [0.12, 0, -1];
function pan(K) {
  const { G, rod, lathe } = K;
  const up = unit(PAN_UP), H = 2.35, R = 1.35, c = [0, H + R * 0.95, 0];
  rod([[0, 0, 0], [0, 0.8, 0], [0, 1.6, 0]], [0.13, 0.14, 0.13], 6, (i, j) => (j % 2 ? 'wood' : 'wood2'));
  const ironFrom = G.F.length;
  // the iron tang from the handle to the rim, rising a little
  rod([[0, 1.55, 0], [0, H + 0.1, 0], add([0, H + 0.2, 0], mul(up, 0.3))], [0.08, 0.075, 0.075], 6, 'stoneB');
  // the pan: the outside from the bottom up to the rim, then the inside down to its floor
  const base = add(c, mul(up, -0.15));
  lathe(base, up, [[R * 0.78, 0], [R * 0.92, 0.12], [R, 0.42]], 14, (i, j) => (i === 1 ? 'bevel' : j % 2 ? 'stoneB' : 'stone'), { bottomMat: 'stoneB' });
  lathe(base, up, [[R, 0.42], [R - 0.08, 0.42], [R * 0.74, 0.1]], 14, (i) => (i === 0 ? 'bevel' : 'stone'), { bottom: false, inner: (i) => i > 0, top: undefined });
  const floor = lathe(add(base, mul(up, 0.1)), up, [[R * 0.74, 0]], 14, 'stoneB', { bottom: false });
  K.F([...floor[0]], 'stoneB', up);
  metalFaces(G, [[ironFrom, G.F.length]], ['stone', 'stoneB', 'bevel']);
  // two pieces of meat in it
  const across = unit(cross(up, [0, 1, 0]));
  K.box(add(add(c, mul(up, 0.08)), mul(across, 0.35)), [across, [0, 1, 0], up], [0.32, 0.42, 0.12], ['meat', 'meatD', 'meat', 'meatD', 'char', 'meatD']);
  K.box(add(add(c, mul(up, 0.08)), add(mul(across, -0.4), [0, 0.25, 0])), [across, [0, 1, 0], up], [0.3, 0.3, 0.12], ['meatD', 'meat', 'meatD', 'meat', 'meat', 'meatD']);
  return { L: H + 2 * R, grip: gripOf(0.75, 0.14, 0.15, 1.5), contact: c, mirror: true, parts: 'handle, tang, pan, meat' };
}

/* ---- the skewer: a peeled stick, three pieces on its far end ---------------------------------------------------- */
function skewer(K) {
  const { rod, box } = K;
  const L = 5.2;
  rod([[0, 0, 0], [0, 1.2, 0], [0, 3.2, 0], [0, L, 0]], [0.12, 0.11, 0.07, 0.035], 5, (i, j) => (i === 0 ? 'bark' : j % 2 ? 'stick' : 'bark'));
  const pieces = [[3.55, 0.3, 0], [4.1, 0.27, 40], [4.6, 0.24, 15]];
  for (const [y, h, a] of pieces) {
    const t = (a * Math.PI) / 180, X = [Math.cos(t), 0, Math.sin(t)], Z = [-Math.sin(t), 0, Math.cos(t)];
    box([0, y, 0], [X, [0, 1, 0], Z], [h, h * 0.8, h * 0.85], ['meat', 'meatD', 'char', 'char', 'meat', 'meatD']);
  }
  return { L, grip: gripOf(0.75, 0.13, 0.1, 1.6), contact: [0, 4.1, 0], parts: 'stick, three pieces' };
}

/* ---- the hand quern, set down: the bed stone, the runner on it with its eye and the peg's hole, flour round its foot -- */
export const QUERN = { R: 1.75, bed: 0.62, runner: 0.55, peg: 1.25 };
function quern(K) {
  const { P, F, lathe } = K;
  const { R, bed, runner } = QUERN, n = 14;
  // flour spilled round the foot
  lathe([0, 0, 0], [0, 1, 0], [[R * 1.18, 0.01], [R * 1.08, 0.06], [R * 1.01, 0.08]], n, 'flour', { bottom: false, rot: 0.25 });
  // the bed stone: bevelled at its foot and its top
  lathe([0, 0, 0], [0, 1, 0], [[R * 0.94, 0], [R, 0.08], [R, bed - 0.08], [R * 0.95, bed]], n, (i, j) => (i === 1 ? (j % 2 ? 'quern' : 'quernD') : 'quernD'), { top: 'quernD' });
  // the runner, a little narrower, its top dished toward the eye; the seam between them dark
  const y0 = bed + 0.02, r = R * 0.97;
  lathe([0, bed - 0.01, 0], [0, 1, 0], [[R * 0.96, 0], [r * 0.94, 0.04]], n, 'eye', { bottom: false });
  lathe([0, y0, 0], [0, 1, 0], [[r * 0.96, 0], [r, 0.06], [r, runner - 0.08], [r * 0.93, runner]], n, (i, j) => (i === 1 ? (j % 2 ? 'quernL' : 'quern') : 'quern'), { bottom: false });
  const top = y0 + runner, E = 0.38;
  const rimR = [...Array(n).keys()].map((j) => { const t = ((j + 0.5) / n) * TAU; return P([r * 0.93 * Math.cos(t), top, r * 0.93 * Math.sin(t)]); });
  const eyeR = [...Array(n).keys()].map((j) => { const t = ((j + 0.5) / n) * TAU; return P([E * Math.cos(t), top - 0.06, E * Math.sin(t)]); });
  for (let j = 0; j < n; j++) F([rimR[j], rimR[(j + 1) % n], eyeR[(j + 1) % n], eyeR[j]], j % 2 ? 'quernL' : 'quern', [0, 1, 0]);
  F([...eyeR], 'eye', [0, 1, 0]);
  // grain in the eye
  const g = [...Array(6).keys()].map((j) => { const t = (j / 6) * TAU; return P([E * 0.6 * Math.cos(t), top - 0.03, E * 0.6 * Math.sin(t)]); });
  F(g, 'flour', [0, 1, 0]);
  return { L: top, grip: gripOf(0, 0.2, 0, 0), contact: [0, top, 0], parts: 'flour, bed stone, runner, eye' };
}

const BUILD = { wooden_spoon: spoon, quern_handle: quernHandle, clay_pot: pot, clay_bowl: bowl, clay_jar: jar, frying_pan: pan, skewer, quern };
export const KITCHEN_IDS = Object.keys(BUILD);

export function build(id) {
  const fn = BUILD[id];
  if (!fn) throw new Error(`kitchen: no prop ${id}`);
  const K = kit(), r = fn(K), G = K.G;
  for (let i = 0; i < G.V.length; i++) if (G.A[i] === undefined) G.A[i] = 1;
  return { id, G, MATS, L: r.L, tris: trisOf(G).length, all: trisOf(G).length, parts: r.parts, grip: r.grip, fit: FIT, contact: r.contact, ends: [r.contact], mirror: r.mirror };
}

/**
 * Where the quern is set down in front of each body, in its rest, body heights (across, up from its floor, forward):
 * ahead of the knees knelt at it (src/sculpt/anim/clips/kitchen.ts QUERN_AT, her knees further forward than his).
 */
export const QUERN_AT = { male: [0, 0, 0.49], female: [0, 0, 0.555] };
/** The props drawn the same share of her height as of his (the quern and its peg: the clip turns it at the same places). */
const SAME_SHARE = new Set(['quern', 'quern_handle']);

/* ---- the game's copies --------------------------------------------------------------------------------------------- */
export async function writeAsset(id, outDir) {
  const { writeFileSync, readFileSync } = await import('node:fs');
  const { resolve, join } = await import('node:path');
  const { gearAsset } = await import('../lowgear.mjs');
  const { buildRig } = await import('../lowrig.mjs');
  const dir = resolve(outDir ?? new URL('../../../src/sculpt/assets', import.meta.url).pathname);
  const plain = build(id);
  const a = await gearAsset(id, plain, plain, { male: buildRig('male'), female: buildRig('female') });
  const r5 = (x) => +x.toFixed(5);
  a.built = `node tools/sculpt/gear/${id}.mjs (tools/sculpt/gear/kitchen.mjs, tools/sculpt/lowgear.mjs gearAsset)`;
  a.units = 'game units; its own frame: y along what the fist closes on toward the thumb, x along the hand toward the knuckles, z = x × y';
  a.contact = plain.contact.map(r5);
  a.ends = plain.ends.map((p) => p.map(r5));
  a.rest = 0;
  a.reach = r5(Math.hypot(...plain.contact.map((c, k) => c - plain.grip.lead[k])));
  if (plain.mirror) a.mirror = true;
  const assets = new URL('../../../src/sculpt/assets', import.meta.url).pathname;
  const meshOf = (who) => { const body = JSON.parse(readFileSync(join(assets, `low${who}.json`), 'utf8')); let top = -Infinity; for (let i = 1; i < body.verts.length; i += 3) top = Math.max(top, body.verts[i]); return { body, h: top - body.floor }; };
  // (the same share of her height as of his: her scale his, as much larger as her mesh is shorter)
  if (SAME_SHARE.has(id)) a.scale.female = r5(a.scale.male * meshOf('male').h / meshOf('female').h);
  if (id === 'quern') {
    // set down on the ground in front of the body (the ground's own bone): its frame the body's at rest, its foot's middle
    // QUERN_AT body heights from where the feet stand
    a.units = "game units; its own frame the ground's: y up, z forward of the body, its foot's middle at the origin";
    for (const who of ['male', 'female']) {
      const { body, h } = meshOf(who), at = QUERN_AT[who], o = [at[0] * h, body.floor + at[1] * h, at[2] * h].map(r5);
      const s = { bone: 'ground', o, R: [1, 0, 0, 0, 1, 0, 0, 0, 1], curl: {} };
      a.sockets[who] = { l: s, r: s };
    }
  }
  const out = join(dir, `${id}.json`);
  writeFileSync(out, JSON.stringify(a));
  console.log(`wrote ${out}: ${a.counts.tris} triangles, ${a.mats.length} materials, ${plain.L.toFixed(3)} long, lead ${a.grip.lead[1]}, contact ${a.contact}`);
  return a;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), at = args.indexOf('--out');
  const ids = args.filter((x, i) => !x.startsWith('--') && (at < 0 || i !== at + 1));
  for (const id of ids.length ? ids : KITCHEN_IDS) await writeAsset(id, at < 0 ? undefined : args[at + 1]);
}
