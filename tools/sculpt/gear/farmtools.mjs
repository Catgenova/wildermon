// The digging and field tools for the low-poly bodies in the Runecut line of the hand tools (tools/sculpt/gear/handparts.mjs):
// the shovel, the rake and the sickle (src/game/items.ts), each drawn in the hands while their jobs' clips play
// (src/sculpt/anim/clips/dig.ts). Run on its own (or through tools/sculpt/gear/<id>.mjs) it writes
// src/sculpt/assets/<id>.json for each (lowgear.mjs gearAsset).
//
//   build(id, { enchanted }) -> { G, MATS, L, grip, fit, contact, ends, tris, all }
//
// Game units (the man 16.5 tall), the hand tools' frame: y along the haft from its butt toward the working end (toward the
// thumb of the fist that holds it), x the way the hand's knuckles point (along the hand), z = x × y. grip.lead is the fist
// point of the hand the tool is drawn in (the hand socket's o: the shovel's upper hand under its T grip, the rake's by its
// butt; the other hand slides along the haft, `Clip.second`); contact the point that meets the ground: the shovel blade's
// tip, the rake's teeth's tips, the middle of the sickle's edge.
//
// Parts: the shovel, a wooden T grip (its crossbar along z, gold end caps), a gold collar, the straight-grained haft, the
// iron socket and a dished blade (its hollow toward -x, a tread folded over its shoulders, a gold-ringed star medallion on
// its back); the rake, the line's stone pommel, a long haft, a gold collar over the upper hand, the iron socket
// and a head of eleven teeth along -x; the sickle, the pommel, a short handle, a gold ferrule and a crescent blade in the
// x-y plane, its edge on the inside of the curve. Each one's iron (the blade, the socket, the head) in the item's metal
// (lowgear.mjs metalFaces: the stone's metal copies, src/sculpt/lowpoly.ts metalTint); wood and gold their own.
// Enchanted: the medallions' discs and stars and the pommels' gems lit, glow added round them.

import { meshOf, trisOf, metalFaces } from '../lowgear.mjs';
import { partsOf, haftOf, pommelOf, MATS_PLAIN, MATS_ENCHANTED, METAL } from './handparts.mjs';

const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];

/** A finished build: every point's glow alpha set. */
function done(G, enchanted, o) {
  for (let i = 0; i < G.V.length; i++) if (G.A[i] === undefined) G.A[i] = 1;
  return { G, MATS: enchanted ? MATS_ENCHANTED : MATS_PLAIN, ...o, all: trisOf(G).length };
}

/* ---- the shovel ------------------------------------------------------------------------------------------------------- */
/** The shovel's sizes: the T grip's crossbar (y, half-length, radius), the haft's radius and its top of wood, the blade's shoulders and tip, its dish. */
export const SHOVEL = { ty: 0.25, tl: 0.62, tr: 0.15, r: 0.19, wood: 7.7, sy: 8.75, tip: 11.4, dish: 0.16, t: 0.045, lead: 1.05 };

function shovel(enchanted) {
  const G = meshOf(), parts = partsOf(G), { P, F, oct, tube, cap, medal, crack, glowDisc } = parts;
  const S = SHOVEL;
  // the T grip: a crossbar along z, wood between gold end caps
  const bar = (z, r) => oct([0, S.ty, z], X, Y, r, r, r * 0.586);
  const TB = [bar(-S.tl - 0.06, S.tr * 0.8), bar(-S.tl, S.tr * 1.12), bar(-S.tl + 0.14, S.tr * 1.12), bar(-S.tl + 0.14, S.tr), bar(S.tl - 0.14, S.tr), bar(S.tl - 0.14, S.tr * 1.12), bar(S.tl, S.tr * 1.12), bar(S.tl + 0.06, S.tr * 0.8)];
  tube(TB, (i, j) => (i === 3 ? (j % 2 ? 'wood2' : 'wood') : i === 1 || i === 5 ? 'gold' : 'goldD'), (i) => [0, S.ty, ([-S.tl, -S.tl + 0.07, -S.tl + 0.14, 0, S.tl - 0.14, S.tl - 0.07, S.tl][i])]);
  cap(TB[0], 'goldD', [0, 0, -1]); cap(TB[7], 'goldD', Z);
  // the haft: a gold collar under the crossbar, the wood, a gold ring above the socket
  haftOf(parts, [[S.ty, S.r * 1.15, 'gold'], [S.ty + 0.22, S.r * 1.18, 'goldD'], [S.ty + 0.3, S.r, 'wood'], [S.wood, S.r, 'gold'], [S.wood, S.r * 1.2, 'gold'], [S.wood + 0.14, S.r * 1.2, 'gold'], [S.wood + 0.14, S.r * 1.05]], { grain: true });
  const metalFrom = G.F.length;
  // the socket: round at the haft, flattened out across z into the blade's top
  const so = (y, ax, az) => oct([0, y, 0], X, Z, ax, az, Math.min(ax, az) * 0.5);
  const SO = [so(S.wood + 0.14, S.r * 1.05, S.r * 1.05), so(S.wood + 0.5, S.r * 1.12, S.r * 1.2), so(S.sy - 0.18, 0.15, 0.36), so(S.sy + 0.05, S.dish + 0.08, 0.42)];
  tube(SO, (i, j) => (j === 0 || j === 4 ? 'stoneL' : j % 2 ? 'stone' : 'stoneB'));
  // the blade: rows across z from the shoulders to the tip, dished (its middle out toward +x: the hollow faces -x)
  const W = [[S.sy, 0.98], [S.sy + 0.45, 1.0], [S.sy + 1.2, 0.96], [S.sy + 1.8, 0.78], [S.sy + 2.25, 0.48], [S.tip, 0.07]];
  const U = [-1, -0.66, -0.33, 0, 0.33, 0.66, 1], xm = (u, k) => S.dish * (1 - u * u) * k;
  const front = [], back = [];
  W.forEach(([y, w], i) => {
    const k = 1 - i / (W.length - 1) * 0.6;
    front.push(U.map((u) => P([xm(u, k) + S.t, y, u * w])));
    back.push(U.map((u) => P([xm(u, k) - S.t, y, u * w])));
  });
  const n = U.length;
  for (let i = 0; i + 1 < W.length; i++) for (let j = 0; j + 1 < n; j++) {
    const mid = [0, (W[i][0] + W[i + 1][0]) / 2, 0];
    F([front[i][j], front[i][j + 1], front[i + 1][j + 1], front[i + 1][j]], j === 2 || j === 3 ? 'stoneL' : 'stone', X);
    F([back[i][j], back[i][j + 1], back[i + 1][j + 1], back[i + 1][j]], j === 2 || j === 3 ? 'stoneB' : 'stone', [-1, 0, 0]);
    void mid;
  }
  // its edges: down each side and round the tip, bevelled; the shoulders' top
  for (let i = 0; i + 1 < W.length; i++) for (const j of [0, n - 1]) F([front[i][j], front[i + 1][j], back[i + 1][j], back[i][j]], 'bevel', [0, 0, j ? 1 : -1]);
  const L = W.length - 1;
  for (let j = 0; j + 1 < n; j++) F([front[L][j], front[L][j + 1], back[L][j + 1], back[L][j]], 'bevel', Y);
  for (let j = 0; j + 1 < n; j++) F([front[0][j], front[0][j + 1], back[0][j + 1], back[0][j]], 'bevel', [0, -1, 0]);
  // the tread: a lip folded back over each shoulder toward +x, for the foot
  for (const sz of [1, -1]) {
    const z0 = sz * 0.36, z1 = sz * 0.98, y0 = S.sy - 0.01, y1 = S.sy + 0.12, x0 = xm(0.6, 1) - S.t, x1 = xm(0.6, 1) + 0.24;
    const c = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]].map(P);
    F([c[0], c[1], c[2], c[3]], 'stoneB', [0, -1, 0]); F([c[4], c[5], c[6], c[7]], 'stoneL', Y);
    F([c[1], c[2], c[6], c[5]], 'bevel', X); F([c[0], c[1], c[5], c[4]], 'stone', [0, 0, -sz]); F([c[2], c[3], c[7], c[6]], 'stone', [0, 0, sz]);
  }
  // veins over the back
  const backX = (u, y) => xm(u, 1 - (y - S.sy) / (S.tip - S.sy) * 0.6) + S.t;
  const veinsFrom = G.F.length;
  crack([backX(0.5, S.sy + 1.6) + 0.004, 0, 0], Z, Y, X, [[0.45, S.sy + 1.2], [0.52, S.sy + 1.5], [0.42, S.sy + 1.8]]);
  crack([backX(0.5, S.sy + 1.6) + 0.004, 0, 0], Z, Y, X, [[-0.5, S.sy + 0.9], [-0.42, S.sy + 1.25], [-0.55, S.sy + 1.55]]);
  metalFaces(G, [[metalFrom, G.F.length], [veinsFrom, G.F.length]], METAL);
  // the medallion on the back, under the socket
  const MY = S.sy + 0.75, mc = [backX(0, MY) + 0.005, MY, 0];
  medal(mc, [0, 0, -1], X, 0.2, 0.15);
  const tris = trisOf(G).length;
  if (enchanted) glowDisc(add(mc, mul(X, 0.06)), Z, Y, X, 0.42, 0.42, 0.42);
  return done(G, enchanted, {
    L: S.tip, tris,
    grip: { axis: [0, 1, 0], lead: [0, S.lead, 0], second: [0, S.lead, 0], radius: S.r + 0.01, edge: [1, 0, 0], face: [0, 0, 1], from: S.ty + 0.3, to: S.wood },
    fit: { backMax: 0.3 },
    contact: [xm(0, 0.4), S.tip, 0], ends: [[xm(0, 0.4), S.tip, 0]],
  });
}

/* ---- the rake --------------------------------------------------------------------------------------------------------- */
export const RAKE = { r: 0.16, wood: 12.9, hy: 13.45, half: 1.3, teeth: 11, tooth: 0.95, lead: 0.8, collar: 1.5 };

function rake(enchanted) {
  const G = meshOf(), parts = partsOf(G), { P, F, oct, tube, cap, medal, glowDisc } = parts;
  const K = RAKE;
  const pm = pommelOf(parts, { pr: 0.16, pt: 0.22, r: K.r });
  // the haft: a gold collar over where the upper hand holds it, the wood to the socket
  haftOf(parts, [[pm.wood, K.r, 'wood'], [K.collar, K.r, 'gold'], [K.collar, K.r * 1.14, 'gold'], [K.collar + 0.14, K.r * 1.14, 'wood'], [K.collar + 0.14, K.r, 'wood'],
    [K.wood, K.r, 'gold'], [K.wood, K.r * 1.2, 'gold'], [K.wood + 0.12, K.r * 1.2, 'gold'], [K.wood + 0.12, K.r * 1.05]], { grain: true });
  const metalFrom = G.F.length;
  // the socket: up into the head's back
  const so = (y, a, b) => oct([0, y, 0], X, Z, a, b, Math.min(a, b) * 0.5);
  tube([so(K.wood + 0.12, K.r * 1.05, K.r * 1.05), so(K.hy - 0.3, K.r * 1.2, K.r * 1.3), so(K.hy - 0.12, 0.2, 0.3)], (i, j) => (j % 2 ? 'stone' : 'stoneB'));
  // the head: a bar along z, its section eight-sided
  const hb = (z, s) => oct([0, K.hy, z], X, Y, s * 0.9, s, s * 0.45);
  const HB = [hb(-K.half, 0.13), hb(-K.half + 0.08, 0.17), hb(K.half - 0.08, 0.17), hb(K.half, 0.13)];
  tube(HB, (i, j) => (i === 1 ? (j < 2 || j > 5 ? 'stoneL' : j === 2 || j === 5 ? 'stone' : 'stoneB') : 'bevel'), (i) => [0, K.hy, [-K.half + 0.04, 0, K.half - 0.04][i]]);
  cap(HB[0], 'bevel', [0, 0, -1]); cap(HB[3], 'bevel', Z);
  // the teeth: square spikes from the bar along -x, tapering to their points
  for (let k = 0; k < K.teeth; k++) {
    const z = -K.half + 0.12 + (k * (2 * K.half - 0.24)) / (K.teeth - 1), b = 0.055;
    const r0 = [[-0.08, -b, -b], [-0.08, -b, b], [-0.08, b, b], [-0.08, b, -b]].map(([x, y, dz]) => P([x, K.hy + y, z + dz]));
    const tip = P([-K.tooth, K.hy - 0.08, z]);
    for (let j = 0; j < 4; j++) F([r0[j], r0[(j + 1) % 4], tip], j % 2 ? 'stone' : 'bevel', { from: [-0.08, K.hy, z] });
  }
  metalFaces(G, [[metalFrom, G.F.length]], METAL);
  // the medallion on the head's top (its +x face)
  const mc = [0.155, K.hy, 0];
  medal(mc, [0, 0, -1], X, 0.13, 0.095);
  const tris = trisOf(G).length;
  if (enchanted) { glowDisc(add(mc, mul(X, 0.05)), Z, Y, X, 0.3, 0.3, 0.42); pm.glow(); }
  return done(G, enchanted, {
    L: K.hy + 0.17, tris,
    grip: { axis: [0, 1, 0], lead: [0, K.lead, 0], second: [0, K.lead, 0], radius: K.r + 0.01, edge: [1, 0, 0], face: [0, 0, 1], from: pm.wood, to: K.wood },
    fit: { backMax: 0.3 },
    contact: [-K.tooth, K.hy - 0.08, 0], ends: [[-K.tooth, K.hy - 0.08, -K.half], [-K.tooth, K.hy - 0.08, K.half]],
  });
}

/* ---- the sickle ------------------------------------------------------------------------------------------------------- */
/** The sickle's handle (radius, top of the wood) and its blade's arc in the x-y plane: centre, radius, from and to (degrees), its width at the root. */
export const SICKLE = { r: 0.15, wood: 1.55, cx: 0.78, cy: 2.75, R: 1.02, a0: -128, a1: 152, w: 0.34, t: 0.04, lead: 0.82 };

function sickle(enchanted) {
  const G = meshOf(), parts = partsOf(G), { P, F, oct, tube, medal, glowDisc, crack } = parts;
  const K = SICKLE;
  const pm = pommelOf(parts, { pr: 0.16, pt: 0.2, r: K.r });
  haftOf(parts, [[pm.wood, K.r, 'wood'], [K.wood, K.r * 1.04, 'gold'], [K.wood, K.r * 1.18, 'gold'], [K.wood + 0.16, K.r * 1.18, 'goldD'], [K.wood + 0.2, K.r * 0.9]], { grain: true });
  const metalFrom = G.F.length;
  // the tang: from the ferrule into the blade's root
  const at = (a, r) => [K.cx + r * Math.cos(a * Math.PI / 180), K.cy + r * Math.sin(a * Math.PI / 180)];
  const root = at(K.a0, K.R);
  const tg = (y, s) => oct([0, y, 0], X, Z, s, s * 0.6, s * 0.4);
  tube([tg(K.wood + 0.2, K.r * 0.9), tg(root[1] - 0.02, 0.13)], (i, j) => (j % 2 ? 'stone' : 'stoneB'));
  // the blade: stations round the arc, each a six-point section: the edge (inside), the bevel's shoulders, the back (outside)
  const N = 12, rings = [];
  for (let k = 0; k <= N; k++) {
    const s = k / N, a = K.a0 + (K.a1 - K.a0) * s, w = K.w * Math.pow(1 - s, 0.55) + 0.025, t = K.t * (1 - 0.6 * s) + 0.008;
    const inner = at(a, K.R - w * 0.5), bev = at(a, K.R - w * 0.12), outer = at(a, K.R + w * 0.5);
    rings.push([P([inner[0], inner[1], 0]), P([bev[0], bev[1], t]), P([outer[0], outer[1], t * 0.8]), P([outer[0], outer[1], -t * 0.8]), P([bev[0], bev[1], -t]), P([inner[0], inner[1], 0])].filter((x, j) => j < 5));
  }
  const mats = ['bevel', 'stone', 'stoneB', 'stone', 'bevel'];
  for (let k = 0; k < N; k++) for (let j = 0; j < 5; j++) {
    const a = rings[k], b = rings[k + 1], j1 = (j + 1) % 5, s = (k + 0.5) / N, c = at(K.a0 + (K.a1 - K.a0) * s, K.R);
    F([a[j], a[j1], b[j1], b[j]], j === 1 ? 'stoneL' : j === 3 ? 'stoneB' : mats[j], { from: [c[0], c[1], 0] });
  }
  // the root's end and the tip closed
  F([...rings[0]], 'stoneB', { from: [K.cx, K.cy, 0] });
  const tipAt = at(K.a1 + 6, K.R), tip = P([tipAt[0], tipAt[1], 0]);
  for (let j = 0; j < 5; j++) F([rings[N][j], rings[N][(j + 1) % 5], tip], 'bevel', { from: [K.cx, K.cy, 0] });
  const veinsFrom = G.F.length;
  for (const sz of [1, -1]) {
    const v1 = at(-40, K.R + 0.05), v2 = at(-20, K.R + 0.08), v3 = at(0, K.R + 0.03);
    crack([0, 0, sz * (K.t + 0.004)], X, Y, [0, 0, sz], [v1, v2, v3]);
  }
  metalFaces(G, [[metalFrom, G.F.length], [veinsFrom, G.F.length]], METAL);
  // a medallion on each face of the blade's root
  const mc = at(-95, K.R + 0.02);
  for (const sz of [1, -1]) medal([mc[0], mc[1], sz * (K.t + 0.004)], [sz, 0, 0], [0, 0, sz], 0.11, 0.08);
  const tris = trisOf(G).length;
  if (enchanted) { for (const sz of [1, -1]) glowDisc([mc[0], mc[1], sz * (K.t + 0.05)], X, Y, [0, 0, sz], 0.26, 0.26, 0.42); pm.glow(); }
  const mid = at((K.a0 + K.a1) / 2, K.R - K.w * 0.25);
  return done(G, enchanted, {
    L: K.cy + K.R + K.w * 0.3, tris,
    grip: { axis: [0, 1, 0], lead: [0, K.lead, 0], second: [0, K.lead, 0], radius: K.r + 0.01, edge: [1, 0, 0], face: [0, 0, 1], from: pm.wood, to: K.wood },
    fit: { backMax: 0.3 },
    contact: [mid[0], mid[1], 0], ends: [[mid[0], mid[1], 0]],
  });
}

const BUILD = { shovel, rake, sickle };
export const FARM_IDS = Object.keys(BUILD);
export function build(id, { enchanted = false } = {}) {
  const fn = BUILD[id];
  if (!fn) throw new Error(`farmtools: no tool ${id}`);
  return fn(enchanted);
}

/* ---- the game's copies: node tools/sculpt/gear/farmtools.mjs [ids...] [--out <dir>] ------------------------------------ */
export async function writeAsset(id, outDir) {
  const { writeFileSync } = await import('node:fs');
  const { resolve, join } = await import('node:path');
  const { gearAsset } = await import('../lowgear.mjs');
  const { buildRig } = await import('../lowrig.mjs');
  const dir = resolve(outDir ?? new URL('../../../src/sculpt/assets', import.meta.url).pathname);
  const plain = build(id), lit = build(id, { enchanted: true });
  const a = await gearAsset(id, plain, lit, { male: buildRig('male'), female: buildRig('female') });
  const r5 = (x) => +x.toFixed(5);
  a.built = `node tools/sculpt/gear/${id}.mjs (tools/sculpt/gear/farmtools.mjs, lowgear.mjs gearAsset)`;
  a.units = 'game units; its own frame: y along the haft from the butt (0) toward the working end (toward the thumb of the fist that holds it), x along the hand toward the knuckles, z = x × y';
  a.contact = plain.contact.map(r5);
  a.reach = r5(Math.hypot(...plain.contact.map((c, k) => c - plain.grip.lead[k])));
  a.ends = plain.ends.map((p) => p.map(r5));
  a.rest = 0;
  const out = join(dir, `${id}.json`);
  writeFileSync(out, JSON.stringify(a));
  console.log(`wrote ${out}: ${a.counts.tris} triangles (${a.counts.glowTris} more of glow), ${a.mats.length} materials, ${plain.L.toFixed(3)} long, lead ${a.grip.lead[1]}, contact ${a.contact}`);
  return a;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), at = args.indexOf('--out');
  const ids = args.filter((x, i) => !x.startsWith('--') && (at < 0 || i !== at + 1));
  for (const id of ids.length ? ids : FARM_IDS) await writeAsset(id, at < 0 ? undefined : args[at + 1]);
}
