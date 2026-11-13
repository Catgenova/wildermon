// The handwork props for the low-poly bodies (the sewing, brushing and rope-making clips, src/sculpt/anim/clips/handwork.ts),
// each held in one fist: the needle (src/game/items.ts needle) and the piece of cloth it is drawn through; the brush
// (brush); the rope tool (rope_tool) and the strands it twists; and the pot a brush glazes. Written to
// src/sculpt/assets/<id>.json (tools/sculpt/lowgear.mjs gearAsset) by this file or tools/sculpt/gear/<id>.mjs.
//
//   node tools/sculpt/gear/handwork.mjs [ids...] [--out <dir>]
//
// The frame (as tools/sculpt/gear/handparts.mjs, game units, the man 16.5 tall): y along the grip from its butt toward
// the thumb of the fist on it; x along the hand toward the knuckles (the brush's bristles and the rope tool's crank look
// down +x); z = x × y. Every part lies in or across the x-y plane, so a prop sits alike in either fist (the clips' left-
// handed mirrors swap the hands).
//
// A tether (`tether`) is a strand from a point on one prop to a point on the prop in the other fist, drawn by
// src/sculpt/lowpoly.ts with each end on its own hand, so it stretches as the hands part: the needle's thread to the
// cloth, the laid rope from the rope tool's hook to the strands.
//
// Enchanted (a needle, a brush or a rope tool of the island's enchanting): the gem lit.

import { meshOf, trisOf } from '../lowgear.mjs';
import { partsOf } from './handparts.mjs';

export const MATS_PLAIN = {
  // the needle (carved from bone) and its thread
  bone: { c: '#efe3c8' }, boneL: { c: '#f8f0de' }, boneD: { c: '#d3bf98' }, eye: { c: '#4c3b2b' },
  thread: { c: '#c23b2a' },
  // the cloth: linen, its hem and the stitches along it
  linen: { c: '#e2d3ae' }, linenD: { c: '#cbb88f' }, hem: { c: '#b5a079' },
  // wood, the line's gold and gem
  wood: { c: '#a8693f' }, wood2: { c: '#935a36' }, head: { c: '#7c4a2a' }, gold: { c: '#d49a4f' }, goldD: { c: '#b98238' }, gem: { c: '#d4b47a' },
  // the brush's bristles
  bristle: { c: '#e0c48c' }, bristleD: { c: '#b99a62' },
  // iron (the rope tool's crank and hook)
  iron: { c: '#8d8a88' }, ironD: { c: '#6c6967' },
  // rope: the strands' two tones
  rope: { c: '#c9ad78' }, ropeD: { c: '#a68a58' },
  // the pot: fired clay, the glaze over its top, the dark of its mouth
  clay: { c: '#c46a42' }, clayD: { c: '#a75534' }, glaze: { c: '#3f8a8f' }, glazeL: { c: '#5aa6a8' }, mouth: { c: '#3a2620' },
};
export const MATS_ENCHANTED = { ...MATS_PLAIN, gem: { c: '#ffa847', emit: true } };

const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];

/** Rings round the y axis of n sides (radius r, flattened along z by zk), joined. */
function lathe(parts, rows, mat, n = 8, zk = 1) {
  const { P, tube } = parts;
  const rings = rows.map(([y, r, x0 = 0]) => [...Array(n).keys()].map((j) => { const a = (j + 0.5) * 2 * Math.PI / n; return P([x0 + r * Math.cos(a), y, r * zk * Math.sin(a)]); }));
  tube(rings, mat);
  return rings;
}
/** A tube of n sides along a polyline of points (radius r), its ends capped. */
function pipe(parts, pts, r, mat, n = 6, capped = true) {
  const { P, F, tube } = parts;
  const rings = pts.map((p, j) => {
    const a = pts[Math.max(0, j - 1)], b = pts[Math.min(pts.length - 1, j + 1)], d = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    const u = norm(cross(d, Math.abs(d[2]) > 0.9 ? X : Z)), v = cross(d, u);
    return [...Array(n).keys()].map((k) => { const t = (k + 0.5) * 2 * Math.PI / n; return P([p[0] + r * (u[0] * Math.cos(t) + v[0] * Math.sin(t)), p[1] + r * (u[1] * Math.cos(t) + v[1] * Math.sin(t)), p[2] + r * (u[2] * Math.cos(t) + v[2] * Math.sin(t))]); });
  });
  tube(rings, mat);
  if (capped) { const e0 = pts[0], e1 = pts[pts.length - 1], d0 = sub(pts[0], pts[1]), d1 = sub(e1, pts[pts.length - 2]); F(rings[0], typeof mat === 'function' ? mat(0, 0) : mat, d0); F(rings[rings.length - 1], typeof mat === 'function' ? mat(0, 0) : mat, d1); void e0; }
  return rings;
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
/** A box from lo to hi, each face its material (by its outward axis: px, nx, py, ny, pz, nz). */
function box(parts, lo, hi, mat) {
  const { P, F } = parts;
  const c = (i, j, k) => P([[lo[0], hi[0]][i], [lo[1], hi[1]][j], [lo[2], hi[2]][k]]);
  const v = [[c(0, 0, 0), c(0, 0, 1), c(0, 1, 1), c(0, 1, 0)], [c(1, 0, 0), c(1, 1, 0), c(1, 1, 1), c(1, 0, 1)]];
  const m = (k) => (typeof mat === 'string' ? mat : mat[k]);
  F(v[0], m('nx'), [-1, 0, 0]); F(v[1], m('px'), [1, 0, 0]);
  F([c(0, 0, 0), c(1, 0, 0), c(1, 0, 1), c(0, 0, 1)], m('ny'), [0, -1, 0]); F([c(0, 1, 0), c(0, 1, 1), c(1, 1, 1), c(1, 1, 0)], m('py'), [0, 1, 0]);
  F([c(0, 0, 0), c(0, 1, 0), c(1, 1, 0), c(1, 0, 0)], m('nz'), [0, 0, -1]); F([c(0, 0, 1), c(1, 0, 1), c(1, 1, 1), c(0, 1, 1)], m('pz'), [0, 0, 1]);
}
/** A gem on both broad faces (±z) at (x, y), half-size s, standing off the face at depth d. */
function gems(parts, x, y, d, s) {
  const { P, F } = parts;
  for (const sz of [1, -1]) F([P([x + s, y, sz * d]), P([x, y + s * 1.3, sz * d]), P([x - s, y, sz * d]), P([x, y - s * 1.3, sz * d])], 'gem', [0, 0, sz]);
}

/* ---- the needle: a bone needle, its eye at the butt (y 0), its point past the thumb; the thread from the eye ---------- */
function needle(parts) {
  const { P, F, tube } = parts;
  const rows = [[0, 0.055], [0.06, 0.08], [0.24, 0.075], [0.36, 0.056], [1.45, 0.05], [1.78, 0.03]];
  const rings = lathe(parts, rows, (i, j) => (j % 3 === 0 ? 'boneL' : j % 3 === 1 ? 'bone' : 'boneD'), 6, 0.6);
  F(rings[0], 'bone', [0, -1, 0]);
  const tip = P([0, 2.02, 0]);
  rings[rings.length - 1].forEach((v, j, r) => F([v, r[(j + 1) % 6], tip], j % 2 ? 'bone' : 'boneD', { from: [0, 1.8, 0] }));
  // the eye: a dark slot through the flats
  for (const sz of [1, -1]) F([P([0.022, 0.08, sz * 0.05]), P([0, 0.2, sz * 0.05]), P([-0.022, 0.08, sz * 0.05]), P([0, 0.06, sz * 0.05])], 'eye', [0, 0, sz]);
  // the thread's tail out of the eye, falling back along the needle
  pipe(parts, [[0, 0.13, 0.06], [0.03, 0.05, 0.1], [0.06, -0.12, 0.08], [0.08, -0.32, 0.03]], 0.04, 'thread', 4);
  void tube;
  return {
    L: 2.02, lead: 0.62, radius: 0.07, contact: [0, 2.02, 0], fit: { backMax: 0.35 },
    // the thread from the eye to the cloth's middle, where the stitch is drawn from
    tether: { at: [0, 0.13, 0], to: { id: 'cloth_piece', at: [-0.1, 2.16, 0] }, r: 0.05, mat: 'thread' },
  };
}

/* ---- the cloth: a piece of linen gathered in the fist, the sheet spread past the thumb, hemmed and stitched ---- */
function cloth(parts) {
  const { P, F } = parts;
  // the rolled corner through the fist
  pipe(parts, [[0, 0, 0], [0, 0.55, 0], [0.02, 1.0, 0]], 0.1, (i, j) => (j % 2 ? 'linen' : 'linenD'), 6);
  // the sheet: gathered past the thumb and spread across z (either side of the grip alike, so it sits the same in either
  // fist), its face looking down ±x (along the hand), waved along x
  const NU = 4, NV = 4, T = 0.025, Y0 = 0.95, Y1 = 3.05;
  const at = (u, v) => {
    const hw = 0.22 + 0.93 * Math.min(1, v / 0.4) ** 0.7, y = Y0 + (Y1 - Y0) * v + 0.12 * Math.sin(Math.PI * u) * v;
    const z = (2 * u - 1) * hw, x = 0.1 * Math.sin(u * Math.PI * 1.7 + v * 2.4) * Math.min(1, v * 3) + 0.05 * Math.sin(v * Math.PI * 2.2);
    return [x, y, z];
  };
  const top = [], bot = [];
  for (let i = 0; i <= NU; i++) { top.push([]); bot.push([]); for (let j = 0; j <= NV; j++) { const p = at(i / NU, j / NV); top[i].push(P([p[0] + T, p[1], p[2]])); bot[i].push(P([p[0] - T, p[1], p[2]])); } }
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    const m = (i + j) % 2 ? 'linen' : 'linenD';
    F([top[i][j], top[i + 1][j], top[i + 1][j + 1], top[i][j + 1]], m, [1, 0, 0]);
    F([bot[i][j], bot[i][j + 1], bot[i + 1][j + 1], bot[i + 1][j]], m, [-1, 0, 0]);
  }
  // its edges: the hem round it
  const ring = [];
  for (let i = 0; i < NU; i++) ring.push([i, 0]);
  for (let j = 0; j < NV; j++) ring.push([NU, j]);
  for (let i = NU; i > 0; i--) ring.push([i, NV]);
  for (let j = NV; j > 0; j--) ring.push([0, j]);
  const mid = at(0.5, 0.5);
  ring.forEach(([i, j], k) => { const [i2, j2] = ring[(k + 1) % ring.length]; F([top[i][j], top[i2][j2], bot[i2][j2], bot[i][j]], 'hem', { from: [0, mid[1], mid[2]] }); });
  // stitches along the far edge, both faces: the seam being sewn
  for (let k = 0; k < 5; k++) {
    const u0 = 0.1 + k * 0.17, u1 = u0 + 0.1;
    for (const sx of [1, -1]) {
      const a = at(u0, 0.9), b = at(u1, 0.9), c = at(u1, 0.85), d = at(u0, 0.85);
      F([a, b, c, d].map((p) => P([p[0] + sx * (T + 0.006), p[1], p[2]])), 'thread', [sx, 0, 0]);
    }
  }
  return { L: Y1 + 0.12, lead: 0.55, radius: 0.1, contact: at(0.5, 0.55), fit: { backMax: 0.4 } };
}

/* ---- the brush: a wooden handle, a gold ferrule and the stock, its bristles looking down +x ----------------------------- */
function brush(parts) {
  const { F } = parts;
  const r = lathe(parts, [[0, 0.1], [0.06, 0.15], [0.5, 0.15], [1.0, 0.16], [1.55, 0.13]], (i, j) => (j % 2 ? 'wood' : 'wood2'), 8);
  F(r[0], 'goldD', [0, -1, 0]);
  lathe(parts, [[1.55, 0.15], [1.7, 0.15]], 'gold', 8);
  // the stock: a block across z, the bristles set in its +x face
  box(parts, [-0.17, 1.7, -0.32], [0.07, 2.72, 0.32], { px: 'head', nx: 'head', py: 'wood2', ny: 'wood2', pz: 'head', nz: 'head' });
  gems(parts, -0.05, 2.21, 0.325, 0.07);
  // the bristles in tufts, alternate rows paler
  for (let k = 0; k < 5; k++) {
    const y0 = 1.76 + k * 0.19;
    box(parts, [0.07, y0, -0.29], [0.33, y0 + 0.18, 0.29], k % 2 ? 'bristleD' : 'bristle');
  }
  return { L: 2.72, lead: 0.72, radius: 0.15, contact: [0.33, 2.21, 0], fit: { backMax: 0.35 } };
}

/* ---- the rope tool: a wooden handle, a gold collar and an iron crank to a hook; the laid rope from the hook ------------ */
function ropeTool(parts) {
  const { F } = parts;
  const r = lathe(parts, [[0, 0.11], [0.06, 0.16], [0.6, 0.16], [1.05, 0.175], [1.5, 0.15]], (i, j) => (j % 2 ? 'wood' : 'wood2'), 8);
  F(r[0], 'goldD', [0, -1, 0]);
  lathe(parts, [[1.5, 0.17], [1.66, 0.17], [1.72, 0.1]], (i) => (i === 0 ? 'gold' : 'goldD'), 8);
  gems(parts, 0, 1.58, 0.172, 0.06);
  // the crank: up the handle's line, over along +x, down to the hook
  pipe(parts, [[0, 1.7, 0], [0, 2.25, 0], [0.12, 2.42, 0], [0.55, 2.42, 0], [0.68, 2.3, 0], [0.68, 2.0, 0]], 0.06, (i, j) => (j % 2 ? 'iron' : 'ironD'), 6);
  // the hook: curled back under
  pipe(parts, [[0.68, 2.0, 0], [0.62, 1.88, 0], [0.5, 1.88, 0], [0.47, 1.98, 0]], 0.045, 'ironD', 6);
  return {
    L: 2.48, lead: 0.72, radius: 0.16, contact: [0.6, 1.9, 0], fit: { backMax: 0.35 },
  };
}

/* ---- the strands: a short length of rope through the fist, its tail out the little finger's side, its end past the thumb */
function strands(parts) {
  const pts = [[0, 0, 0], [0, 0.6, 0], [0, 1.3, 0], [0, 2.15, 0]];
  pipe(parts, pts, 0.12, (i, j) => ((i + j) % 2 ? 'rope' : 'ropeD'), 6);
  // three loose ends of the unlaid strands, splayed past the end
  for (const [dx, dz] of [[0.09, 0], [-0.05, 0.08], [-0.05, -0.08]]) pipe(parts, [[dx * 0.5, 2.1, dz * 0.5], [dx * 2.2, 2.45, dz * 2.2], [dx * 3, 2.7, dz * 3]], 0.045, 'rope', 4);
  return {
    L: 2.7, lead: 0.8, radius: 0.12, contact: [0, 2.15, 0], fit: { backMax: 0.4 },
    // the laid rope from the strands' end to the rope tool's hook in the other fist
    tether: { at: [0, 2.15, 0], to: { id: 'rope_tool', at: [0.57, 1.9, 0] }, r: 0.1, mat: 'rope', sides: 6, alt: 'ropeD' },
  };
}

/* ---- the pot a brush glazes: held by its foot, the pot standing past the thumb, its top half glazed ------------------- */
function pot(parts) {
  const { P, F } = parts;
  const foot = lathe(parts, [[0, 0.16], [0.05, 0.2], [0.85, 0.16], [0.95, 0.24]], (i, j) => (j % 2 ? 'clay' : 'clayD'), 8);
  F(foot[0], 'clayD', [0, -1, 0]);
  const body = lathe(parts, [[0.95, 0.24], [1.05, 0.46], [1.32, 0.62], [1.62, 0.6], [1.88, 0.42], [2.0, 0.3], [2.12, 0.36]], (i, j) => (i < 2 ? (j % 2 ? 'clay' : 'clayD') : j % 2 ? 'glaze' : 'glazeL'), 10);
  const top = body[body.length - 1], c = P([0, 2.06, 0]);
  top.forEach((v, j) => F([v, top[(j + 1) % 10], c], 'mouth', [0, 1, 0]));
  return { L: 2.12, lead: 0.45, radius: 0.18, contact: [0.6, 1.5, 0], fit: { backMax: 0.35 } };
}

export const BUILD = { needle, cloth_piece: cloth, brush, rope_tool: ropeTool, rope_strands: strands, work_pot: pot };
export const IDS = Object.keys(BUILD);

export function build(id, { enchanted = false } = {}) {
  const fn = BUILD[id];
  if (!fn) throw new Error(`handwork: no prop ${id}`);
  const G = meshOf(), parts = partsOf(G);
  const r = fn(parts);
  for (let i = 0; i < G.V.length; i++) if (G.A[i] === undefined) G.A[i] = 1;
  return {
    id, G, MATS: enchanted ? MATS_ENCHANTED : MATS_PLAIN, L: r.L, tris: trisOf(G).length, all: trisOf(G).length,
    grip: { axis: [0, 1, 0], lead: [0, r.lead, 0], second: [0, r.lead, 0], radius: r.radius, edge: [1, 0, 0], face: [0, 0, 1], from: Math.max(0, r.lead - 0.4), to: r.lead + 0.4 },
    fit: r.fit, contact: r.contact, ends: [r.contact], tether: r.tether,
  };
}

/* ---- the game's copies --------------------------------------------------------------------------------------------- */
export async function writeAsset(id, outDir) {
  const { writeFileSync } = await import('node:fs');
  const { resolve, join } = await import('node:path');
  const { gearAsset } = await import('../lowgear.mjs');
  const { buildRig } = await import('../lowrig.mjs');
  const dir = resolve(outDir ?? new URL('../../../src/sculpt/assets', import.meta.url).pathname);
  const plain = build(id), lit = build(id, { enchanted: true });
  const a = await gearAsset(id, plain, lit, { male: buildRig('male'), female: buildRig('female') });
  const r5 = (x) => +x.toFixed(5);
  a.built = `node tools/sculpt/gear/handwork.mjs ${id} (tools/sculpt/lowgear.mjs gearAsset)`;
  a.units = 'game units; its own frame: y along the grip from its butt (0) toward the thumb of the fist that holds it, x along the hand toward the knuckles (bristles, crank: +x), z = x × y';
  a.contact = plain.contact.map(r5);
  a.ends = plain.ends.map((p) => p.map(r5));
  a.rest = 0;
  // (no glow: every polygon drawn, plain and enchanted)
  if (a.glowFrom < 0) a.glowFrom = a.polys.length;
  // a strand to the other fist's prop (src/sculpt/lowpoly.ts PropAsset.tether): its material by index in this one's
  if (plain.tether) {
    const t = plain.tether;
    a.tether = { at: t.at.map(r5), to: { id: t.to.id, at: t.to.at.map(r5) }, r: t.r, sides: t.sides ?? 4, mat: a.mats.indexOf(t.mat), ...(t.alt ? { alt: a.mats.indexOf(t.alt) } : {}) };
    if (a.tether.mat < 0 || a.tether.alt === -1) throw new Error(`handwork: ${id}'s tether's material is not one of its own`);
  }
  const out = join(dir, `${id}.json`);
  writeFileSync(out, JSON.stringify(a));
  console.log(`wrote ${out}: ${a.counts.tris} triangles, ${a.mats.length} materials, ${plain.L.toFixed(3)} long, lead ${a.grip.lead[1]}`);
  return a;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), at = args.indexOf('--out');
  const ids = args.filter((x, i) => !x.startsWith('--') && (at < 0 || i !== at + 1));
  for (const id of ids.length ? ids : IDS) await writeAsset(id, at < 0 ? undefined : args[at + 1]);
}
