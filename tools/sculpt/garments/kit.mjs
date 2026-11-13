// What is worn besides the sets, in the Runecut line of the plate set and the props (gold rims, gold-ringed cores, runes
// lit when enchanted), for the low-poly bodies, each as a garment of the game's (src/sculpt/lowpoly.ts GARMENTS) beside
// its body in src/sculpt/assets:
//
//   lowshieldwood-<who>.json   the wooden shield (src/game/gear.ts SHIELDS wooden_shield): round, five planks in the shield's
//                              wood, an iron rim and boss, four gold runes round the boss; on the left forearm
//   lowshieldmetal-<who>.json  the metal shield (metal_shield): a heater in its metal, a gold rim, a gold-ringed core at its
//                              middle and a gold rune line down it, its back dark; on the left forearm
//   lowbelt<over>-<who>.json   the tool belt (toolbelt): dark leather, a gold buckle with a core, three pouches and a loop
//                              round the hips, fitted over what is worn there: `cloth` (the tunic and whatever legs), `leather`
//                              (the leather chest), `plate` (the plate chest), `chain` (the hauberk), `scale` (the cuirass)
//   lowpendant<over>-<who>.json the pendant (jewelled_pendant): a gold-framed stone on a gold chain on the breastbone, over the
//                              cloth shawl (`cloth`), its copies over armour (`shawlover`, `shawloverslim`), the leather chest (`leather`) or
//                              the tunic (`tunic`); under the leather shawl, the mantle, plate, mail or scale it is not drawn
//   lowring-<who>.json         the ring (jewelled_ring): a gold band on the right hand's ring finger, its stone set on the back
//   lowcirclet<hair>-<who>.json the circlet (circlet): a thin gold band round the head over the hair, three settings; one fit
//                              for each hairstyle (`swept`, `braid`, `bob`) and for none (`bare`)
//
// The shields are rigid on the forearm's outer twist bone (lowerarm_twist_02_l), the face out from the arm's outside, the
// shield's height along the forearm (so it hangs upright at the side). The belt is skinned as the body under it is (the
// nearest body vertices' weights), its pouches rigid with the belt where they hang. The pendant is rigid on the chest
// (spine_03), the ring on the finger (fingers_01_r), the circlet on the head.
//
// Materials: those the sets already have where they can be (the gold, the dark under layer, the leather's trim, the
// cores, the runes, the glow), so they share the renderer's places; the rest tinted in the game (src/sculpt/lowpoly.ts
// kitMat): the wooden shield's wood in its wood (`wood`, `woodS`), its iron (`iron`), the metal shield's plates in its metal
// (`plate`, `shade`), a jewel's stone in its gem (`gem`), the circlet's settings in theirs (`stone1` to `stone3`).
//
//   node tools/sculpt/garments/kit.mjs [--out src/sculpt/assets] [--only pendant]  (--only: the pieces whose names start so)

import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { meshOf, trisOf, newell } from '../lowgear.mjs';

const ASSETS = new URL('../../../src/sculpt/assets/', import.meta.url).pathname;
const load = (f) => JSON.parse(readFileSync(join(ASSETS, f), 'utf8'));
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const DEG = Math.PI / 180;

/** The materials, plain and enchanted (kind 0 lit, 1 unlit and glowing, 2 lit by brightness as the sets' plates are). */
const MATS = {
  gold: { c: '#f5bd66', kind: 2 },
  under: { c: '#4a3833', kind: 2 },
  trim: { c: '#e88448', kind: 2 },
  core: { c: '#db9e4d', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  rune: { c: '#f5bd66', kind: 2, lit: { c: '#ffe7a6', kind: 1 } },
  wood: { c: '#b97a4c', kind: 2 },
  woodS: { c: '#94603b', kind: 2 },
  iron: { c: '#9aa3b2', kind: 2 },
  plate: { c: '#d6b5a1', kind: 2 },
  shade: { c: '#b89987', kind: 2 },
  gem: { c: '#d4b47a', kind: 2 },
  stone1: { c: '#d4b47a', kind: 2 },
  stone2: { c: '#d4b47a', kind: 2 },
  stone3: { c: '#d4b47a', kind: 2 },
  glow: { c: '#feca6d', kind: 1 },
};

/** A mesh with glow alpha per point, faces kept off degenerate corners and turned to face `out`. */
function mesher() {
  const G = meshOf();
  const P = (q) => G.p(q);
  const F = (v, mat, out) => { const w = v.filter((x, j) => x !== v[(j + 1) % v.length]); if (w.length >= 3) G.f(w, mat, out); };
  /** Rings lofted (the same count each), a material per (ring, facet), each face turned away from `centre(i)`. */
  const loft = (rings, mat, centre, closed = true) => {
    for (let i = 0; i + 1 < rings.length; i++) {
      const a = rings[i], b = rings[i + 1], n = a.length;
      for (let j = 0; j < (closed ? n : n - 1); j++) F([a[j], a[(j + 1) % n], b[(j + 1) % n], b[j]], typeof mat === 'function' ? mat(i, j) : mat, { from: centre(i, j) });
    }
  };
  return { G, P, F, loft };
}

/**
 * A garment asset (src/sculpt/lowpoly.ts GarmentAsset) from a mesh in the body's rest (mesh units) and each point's
 * weights: its faces as polygons (one off its plane split into its triangles, so each polygon is one flat facet), the
 * faces from `glowFrom` on drawn only enchanted.
 */
function garment(who, body, G, vw, glowFrom) {
  // (the glow's faces, from glowFrom on, left out: a garment's glow is drawn solid, so its runes and cores lit are its glow)
  const names = [...new Set(G.F.slice(0, glowFrom).map((f) => f.mat))].sort((a, b) => Object.keys(MATS).indexOf(a) - Object.keys(MATS).indexOf(b));
  const T = trisOf(G), polys = [], tris = [];
  let gFrom = -1;
  G.F.forEach((f, fi) => {
    if (fi >= glowFrom) return;
    const ts = T.filter((t) => t.face === fi), n = unit(newell(G.V, f.v)), flat = ts.every((t) => Math.abs(dot(t.n, n) - 1) < 1e-6);
    if (flat) { const pi = polys.length; polys.push([f.v, names.indexOf(f.mat)]); for (const t of ts) tris.push(...t.v, pi); }
    else for (const t of ts) { const pi = polys.length; polys.push([t.v, names.indexOf(f.mat)]); tris.push(...t.v, pi); }
  });
  if (glowFrom >= G.F.length || gFrom < 0) gFrom = polys.length;
  const r5 = (x) => +x.toFixed(5), hex = (h) => [1, 3, 5].map((i) => +(parseInt(h.slice(i, i + 2), 16) / 255).toFixed(4));
  return {
    built: 'node tools/sculpt/garments/kit.mjs', who, base: body.bones.length, mats: names, colours: names.map((n) => hex(MATS[n].c)),
    plain: names.map((n) => ({ c: MATS[n].c, kind: MATS[n].kind })), enchanted: names.map((n) => MATS[n].lit ?? { c: MATS[n].c, kind: MATS[n].kind }), glowFrom: gFrom,
    verts: G.V.flat().map(r5), polys, tris, weights: vw.map((l) => l.flatMap(([b, w]) => [b, r5(w)])), bones: [],
  };
}

/** A body's bone by name: its index, rest head and frame (row-major; columns X, Y along the bone, Z). */
const boneOf = (body, name) => { const i = body.bones.findIndex((b) => b.name === name); const b = body.bones[i]; return { i, head: b.head, R: b.R, X: [b.R[0], b.R[3], b.R[6]], Y: [b.R[1], b.R[4], b.R[7]], Z: [b.R[2], b.R[5], b.R[8]] }; };
const pts = (m) => { const o = []; for (let i = 0; i < m.verts.length; i += 3) o.push([m.verts[i], m.verts[i + 1], m.verts[i + 2]]); return o; };
/** A mesh's surface sampled: its points and points across each triangle about `step` apart. */
function surface(m, step = 0.05, keep = null) {
  const V = m.verts, T = m.tris, P = (i) => [V[i * 3], V[i * 3 + 1], V[i * 3 + 2]], out = keep ? pts(m).filter((_, i) => keep(i)) : pts(m);
  for (let t = 0; t < T.length; t += 4) {
    if (keep && !(keep(T[t]) && keep(T[t + 1]) && keep(T[t + 2]))) continue;
    const [a, b, c] = [P(T[t]), P(T[t + 1]), P(T[t + 2])];
    const n = Math.max(1, Math.ceil(Math.max(Math.hypot(...sub(b, a)), Math.hypot(...sub(c, b)), Math.hypot(...sub(a, c))) / step));
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) { const u = i / n, v = j / n, w = 1 - u - v; out.push([a[0] * w + b[0] * u + c[0] * v, a[1] * w + b[1] * u + c[1] * v, a[2] * w + b[2] * u + c[2] * v]); }
  }
  return out;
}

/* ---- the shields ------------------------------------------------------------------------------------------------------ */
/**
 * Where a shield sits on the left forearm at rest: its middle out from the forearm's outside, `along` of the way from the
 * elbow to the wrist; its frame U up along the forearm (toward the elbow), W out of its face (away from the body), V
 * across (forward).
 */
function shieldFrame(body, along = 0.6, out = 0.42) {
  const E = boneOf(body, 'lowerarm_l'), H = boneOf(body, 'hand_l');
  const U = unit(sub(E.head, H.head));
  // out of the forearm's outside: away from the body's middle, square to the forearm
  const away = [1, 0, 0], W = unit(sub(away, mul(U, dot(away, U)))), V = cross(W, U);
  const C = add(add(H.head, mul(sub(E.head, H.head), 1 - along)), mul(W, out));
  return { C, U, V, W, bone: boneOf(body, 'lowerarm_twist_02_l').i };
}

/** The wooden shield: a round of five planks, an iron rim and boss, four gold runes round the boss. */
function woodShield(body, R0 = 2.15) {
  const { G, P, F, loft } = mesher(), S = shieldFrame(body);
  const at = (u, v, w) => add(S.C, add(add(mul(S.U, u), mul(S.V, v)), mul(S.W, w)));
  const N = 20, DOME = 0.16, dome = (r) => DOME * (1 - (r / R0) ** 2);
  const ringAt = (r, w) => [...Array(N).keys()].map((j) => { const a = (j + 0.5) * 360 / N * DEG; return P(at(r * Math.cos(a), r * Math.sin(a), w + dome(r))); });
  // the planks: the face cut into five strips across V, each strip's polygons between the ring's chords
  const RF = R0 - 0.2, PL = 5, plankW = (2 * RF) / PL;
  for (let k = 0; k < PL; k++) {
    const v0 = -RF + k * plankW + 0.025, v1 = -RF + (k + 1) * plankW - 0.025, rows = 6;
    // (the strip's outline: down its two edges where they meet the circle, in rows)
    const edge = (v) => Math.sqrt(Math.max(0, RF * RF - v * v));
    const col = (v) => [...Array(rows + 1).keys()].map((i) => { const u = -edge(v) + (2 * edge(v) * i) / rows; return P(at(u, v, dome(Math.hypot(u, v)) + 0.01)); });
    const a = col(v0), b = col(v1);
    for (let i = 0; i < rows; i++) F([a[i], a[i + 1], b[i + 1], b[i]], k % 2 ? 'woodS' : 'wood', S.W);
  }
  // the seams between them, dark, a hair under the planks
  { const seam = ringAt(RF, 0); F([...seam].reverse(), 'under', S.W); }
  // the iron rim: a band round the edge, its outer face, its lip over the planks
  const r0 = ringAt(RF, 0.02), r1 = ringAt(R0, 0.06), r2 = ringAt(R0, -0.12), r3 = ringAt(R0 - 0.05, -0.16);
  loft([r0, r1], 'iron', () => at(0, 0, -1));
  loft([r1, r2], 'iron', () => at(0, 0, 0));
  // the back: the rim's underside and the back face of the planks (dark)
  loft([r2, r3], 'iron', () => at(0, 0, 1));
  F(r3, 'woodS', mul(S.W, -1));
  // the boss: an eight-sided dome, an iron flange round it
  const NB = 8, bAt = (r, w) => [...Array(NB).keys()].map((j) => { const a = (j * 45 + 22.5) * DEG; return P(at(r * Math.cos(a), r * Math.sin(a), w)); });
  const f0 = bAt(0.62, DOME + 0.02), f1 = bAt(0.62, DOME + 0.1), f2 = bAt(0.48, DOME + 0.12), d1 = bAt(0.4, DOME + 0.36), top = P(at(0, 0, DOME + 0.5));
  loft([f0, f1], 'iron', () => at(0, 0, DOME));
  loft([f1, f2], 'iron', () => at(0, 0, -2));
  loft([f2, d1], 'iron', () => at(0, 0, DOME));
  for (let j = 0; j < NB; j++) F([d1[j], d1[(j + 1) % NB], top], 'iron', { from: at(0, 0, DOME) });
  // gold studs round the rim and four gold runes round the boss
  for (let j = 0; j < 8; j++) {
    const a = (j * 45 + 22.5) * DEG, r = R0 - 0.1, c = [r * Math.cos(a), r * Math.sin(a)], s = 0.09, w = 0.1;
    F([P(at(c[0] + s, c[1], w)), P(at(c[0], c[1] + s, w)), P(at(c[0] - s, c[1], w)), P(at(c[0], c[1] - s, w))], 'gold', S.W);
  }
  const RUNES = [0, 90, 180, 270];
  for (const d of RUNES) {
    const a = d * DEG, r = 1.15, c = [r * Math.cos(a), r * Math.sin(a)], w = dome(r) + 0.035, t = [Math.cos(a), Math.sin(a)], n = [-t[1], t[0]];
    F([P(at(c[0] + t[0] * 0.3, c[1] + t[1] * 0.3, w)), P(at(c[0] + n[0] * 0.13, c[1] + n[1] * 0.13, w)), P(at(c[0] - t[0] * 0.3, c[1] - t[1] * 0.3, w)), P(at(c[0] - n[0] * 0.13, c[1] - n[1] * 0.13, w))], 'rune', S.W);
  }
  const glowFrom = G.F.length;
  for (const d of RUNES) { const a = d * DEG, r = 1.15, c = [r * Math.cos(a), r * Math.sin(a)], w = dome(r) + 0.06; disc(P, F, at, c, w, 0.48, S.W); }
  return { G, glowFrom, bone: S.bone };
}

/** A glow disc (its middle bright, its rim nothing) on a face at (u, v), `w` out. */
function disc(P, F, at, c, w, r, out, n = 10) {
  const G0 = P.G;
  const mid = P(at(c[0], c[1], w)), rim = [...Array(n).keys()].map((j) => P(at(c[0] + r * Math.cos(j * 2 * Math.PI / n), c[1] + r * Math.sin(j * 2 * Math.PI / n), w)));
  for (let j = 0; j < n; j++) F([mid, rim[j], rim[(j + 1) % n]], 'glow', out);
  return G0;
}

/** The metal shield: a heater in its metal, a gold rim, a gold-ringed core, a gold rune line down it. */
function metalShield(body, H0 = 2.35, W0 = 1.75) {
  const { G, P, F, loft } = mesher(), S = shieldFrame(body, 0.75);
  const at = (u, v, w) => add(S.C, add(add(mul(S.U, u), mul(S.V, v)), mul(S.W, w)));
  // u up along the forearm: the flat top (TOP), its shoulders rounded over SH, the sides curving in to the point (BOT)
  const TOP = H0 * 0.42, BOT = -H0 * 0.58, SH = 0.42, RIM = 0.16, R = 7;
  const half = (u) => (u >= TOP - SH ? W0 * (1 - 0.16 * ((u - (TOP - SH)) / SH) ** 2) : W0 * Math.max(0, Math.cos(((TOP - SH - u) / (TOP - SH - BOT)) * Math.PI / 2)) ** 0.75);
  // its face: bent back toward its edges (a cylinder's arc about U), raised along the middle (the ridge)
  const face = (u, v, wv) => 0.1 - 0.26 * (v / W0) ** 2 + 0.09 * (1 - Math.min(1, Math.abs(v) / Math.max(1e-6, wv)));
  // the outline at t (0 the top, 1 the point), the inner one (the plate's edge) RIM in from the outer (the rim's)
  const uOut = (t) => TOP + (BOT - TOP) * t, uIn = (t) => TOP - RIM + (BOT + RIM * 1.8 - (TOP - RIM)) * t;
  const wOut = (t) => (t >= 1 ? 0 : half(uOut(t))), wIn = (t) => (t >= 1 ? 0 : Math.max(0.04, half(uIn(t)) - RIM));
  const T = [...Array(R + 1).keys()].map((i) => (i / R) ** 0.9);
  // (the outline's points: across the top, down the +v side, the point, up the -v side; each [t, share of the width])
  const OUT = [[0, -1], [0, -0.5], [0, 0], [0, 0.5], [0, 1], ...T.slice(1, -1).map((t) => [t, 1]), [1, 0], ...T.slice(1, -1).reverse().map((t) => [t, -1])];
  const line = (inner, lift) => OUT.map(([t, s]) => { const u = inner ? uIn(t) : uOut(t), w = inner ? wIn(t) : wOut(t), v = s * w; return P(at(u, v, face(u, v, w) + lift)); });
  const o0 = line(false, 0.02), oT = line(false, 0.08), iT = line(true, 0.1), i0 = line(true, 0.035), back = line(false, -0.1), n = OUT.length;
  // the rim: gold, its outer wall, its top, its inner wall down to the plate
  for (let j = 0; j < n; j++) {
    const j1 = (j + 1) % n;
    F([back[j], back[j1], o0[j1], o0[j]], 'gold', { from: at(0, 0, 0) });
    F([o0[j], o0[j1], oT[j1], oT[j]], 'gold', { from: at(0, 0, 0) });
    F([oT[j], oT[j1], iT[j1], iT[j]], 'gold', S.W);
    F([iT[j], iT[j1], i0[j1], i0[j]], 'gold', { from: at(0, 0, 3) });
  }
  // the back, dark, facing into the arm
  F([...back].reverse(), 'under', mul(S.W, -1));
  // the plate: rows down it, five points across each (the edges, the halves' middles, the ridge); the +v half plate, the -v shade
  const rows = T.map((t) => { const u = uIn(t), w = wIn(t); return [-1, -0.5, 0, 0.5, 1].map((s) => P(at(u, s * w, face(u, s * w, w) + 0.035))); });
  for (let i = 0; i + 1 < rows.length; i++) for (let k = 0; k < 4; k++) F([rows[i][k], rows[i][k + 1], rows[i + 1][k + 1], rows[i + 1][k]], k < 2 ? 'shade' : 'plate', S.W);
  // the core: a gold ring round it a little above the middle, the rune line down from it to the point and up to the top
  const CU = 0.22, ro = 0.42, ri = 0.29, NC = 10, cw = face(CU, 0, half(CU)) + 0.035;
  const cr = (r, w) => [...Array(NC).keys()].map((j) => { const a = (j + 0.5) * 360 / NC * DEG; return P(at(CU + r * Math.cos(a), r * Math.sin(a), w)); });
  const c0 = cr(ro, cw - 0.06), c1 = cr(ro, cw + 0.07), c2 = cr(ri, cw + 0.07), c3 = cr(ri, cw + 0.04);
  loft([c0, c1], 'gold', () => at(CU, 0, 0)); loft([c1, c2], 'gold', () => at(CU, 0, -3)); loft([c2, c3], 'gold', () => at(CU, 0, 3));
  F(c3, 'core', S.W);
  const rl = (u0, u1) => { const w0 = face(u0, 0, half(u0)) + 0.06, w1 = face(u1, 0, half(u1)) + 0.06; F([P(at(u0, 0.06, w0)), P(at(u0, -0.06, w0)), P(at(u1, -0.035, w1)), P(at(u1, 0.035, w1))], 'rune', S.W); };
  rl(CU - ro - 0.06, uIn(1) + 0.3); rl(CU + ro + 0.06, TOP - RIM - 0.1);
  for (const v of [0.72, -0.72]) { const u = 0.5, s = 0.11, w = face(u, v, half(u)) + 0.06; F([P(at(u + s * 1.6, v, w)), P(at(u, v + s, w)), P(at(u - s * 1.6, v, w)), P(at(u, v - s, w))], 'rune', S.W); }
  // (lit when enchanted: its core and runes, as the plate set's; no glow of its own laid over them)
  return { G, glowFrom: G.F.length, bone: S.bone };
}

/* ---- the tool belt ------------------------------------------------------------------------------------------------- */
/** What each fit of the belt is worn over at the hips (src/sculpt/assets low<name>-<who>.json, the body always). */
const BELT_OVER = {
  cloth: ['tunic', 'trousers', 'leatherlegs', 'leatherlegsflaps', 'platelegs', 'chainlegs', 'scalelegs'],
  leather: ['leatherchest', 'leatherlegs', 'platelegs', 'chainlegs', 'scalelegs'],
  plate: ['platechest', 'leatherlegs', 'platelegs', 'chainlegs', 'scalelegs'],
  chain: ['chainchest', 'leatherlegs', 'platelegs', 'chainlegs', 'scalelegs'],
  scale: ['scalechest', 'leatherlegs', 'platelegs', 'chainlegs', 'scalelegs'],
};
/** Each body's belt line: its middle's height at the front and at the back (mesh units), its band's half height. */
const BELT_AT = { male: { front: -4.62, back: -4.38, half: 0.2 }, female: { front: -3.82, back: -3.6, half: 0.18 } };

/** The nearest `k` body vertices' weights at a point, summed, the heaviest four kept, as [bone, weight] pairs. */
function weightsAt(body, BP, p, k = 6, keep = null) {
  const near = BP.map((q, i) => [i, Math.hypot(...sub(q, p))]).filter(([i]) => !keep || keep(i)).sort((a, b) => a[1] - b[1]).slice(0, k);
  const sum = new Map();
  for (const [i, d] of near) { const w = body.weights[i], f = 1 / (d + 0.05); for (let j = 0; j < w.length; j += 2) sum.set(w[j], (sum.get(w[j]) ?? 0) + w[j + 1] * f); }
  const top = [...sum].sort((a, b) => b[1] - a[1]).slice(0, 4), tot = top.reduce((s, [, w]) => s + w, 0);
  return top.map(([b, w]) => [b, w / tot]);
}

function belt(who, body, over) {
  const { G, P, F, loft } = mesher();
  const B = BELT_AT[who], pel = boneOf(body, 'pelvis').head, z0 = pel[2] + 0.05;
  // (what is worn at the hips, the arms and hands hanging beside them, and their sleeves, left out)
  const ARM = /clavicle|upperarm|lowerarm|hand|thumb|fingers|shoulder|elbow|wrist|knuckles/;
  const offArms = (m) => (i) => { const w = m.weights[i]; let b = -1, top = 0; for (let j = 0; j < w.length; j += 2) if (w[j + 1] > top) { top = w[j + 1]; b = w[j]; } return !ARM.test(body.bones[b]?.name ?? ''); };
  const surf = [...surface(body, 0.08, offArms(body)), ...over.map((g) => load(`low${g}-${who}.json`)).flatMap((m) => surface(m, 0.06, offArms(m)))];
  const N = 28, yAt = (a) => B.front + (B.back - B.front) * (1 - Math.cos(a)) / 2;
  // the reach of what is worn round each way, over the band's height, the most of each way and its neighbours
  const reach = [...Array(N).keys()].map((j) => {
    const a = (j * 360) / N * DEG, d = [Math.sin(a), Math.cos(a)];
    let r = 0;
    for (const p of surf) {
      const y = yAt(a);
      if (p[1] < y - B.half - 0.12 || p[1] > y + B.half + 0.12) continue;
      const x = p[0], z = p[2] - z0, along = x * d[0] + z * d[1], across = Math.abs(-x * d[1] + z * d[0]);
      if (along > 0 && across < 0.22) r = Math.max(r, along);
    }
    return r;
  });
  const R = reach.map((_, j) => Math.max(reach[(j + N - 1) % N], reach[j], reach[(j + 1) % N]) + 0.05);
  const ring = (dy, dr) => R.map((r, j) => { const a = (j * 360) / N * DEG; return P([Math.sin(a) * (r + dr), yAt(a) + dy, z0 + Math.cos(a) * (r + dr)]); });
  const lo = ring(-B.half, 0.02), hi = ring(B.half, 0.02), loO = ring(-B.half, 0.1), hiO = ring(B.half, 0.1), loI = ring(-B.half + 0.02, -0.03), hiI = ring(B.half - 0.02, -0.03);
  const mid = (i, j) => [0, yAt((j * 360) / N * DEG), z0];
  // the band: its outer face dark leather, its edges stitched in the leather's trim
  const lo2 = ring(-B.half + 0.05, 0.1), hi2 = ring(B.half - 0.05, 0.1);
  loft([loO, lo2], 'trim', mid); loft([lo2, hi2], 'under', mid); loft([hi2, hiO], 'trim', mid);
  loft([hi, hiO], 'under', (i, j) => [0, -20, z0]);
  loft([loO, lo], 'under', (i, j) => [0, 20, z0]);
  loft([lo, loI], 'under', (i, j) => [0, 20, z0]); loft([hiI, hi], 'under', (i, j) => [0, -20, z0]);
  // the buckle at the front: a gold frame, its core
  const fr = (u, v, w) => { const r = R[0] + 0.1 + w; return [Math.sin(v / r) * r, yAt(0) + u, z0 + Math.cos(v / r) * r]; };
  const BH = B.half + 0.06, BW = 0.34;
  const bo = [[BH, BW], [BH, -BW], [-BH, -BW], [-BH, BW]], bi = bo.map(([u, v]) => [u * 0.62, v * 0.7]);
  const O = bo.map(([u, v]) => P(fr(u, v, 0.06))), I = bi.map(([u, v]) => P(fr(u, v, 0.06))), Ob = bo.map(([u, v]) => P(fr(u, v, -0.02)));
  for (let j = 0; j < 4; j++) { const j1 = (j + 1) % 4; F([O[j], O[j1], I[j1], I[j]], 'gold', [0, 0, 1]); F([Ob[j], Ob[j1], O[j1], O[j]], 'gold', { from: fr(0, 0, -0.5) }); }
  F(I.map((_, j) => P(fr(bi[j][0], bi[j][1], 0.03))), 'under', [0, 0, 1]);
  const cr = 0.12, core = [...Array(8).keys()].map((j) => { const a = (j * 45 + 22.5) * DEG; return P(fr(cr * Math.sin(a), cr * Math.cos(a), 0.09)); });
  F(core, 'core', [0, 0, 1]);
  const ringC = [...Array(8).keys()].map((j) => { const a = (j * 45 + 22.5) * DEG; return P(fr(0.17 * Math.sin(a), 0.17 * Math.cos(a), 0.075)); });
  for (let j = 0; j < 8; j++) F([ringC[j], ringC[(j + 1) % 8], core[(j + 1) % 8], core[j]], 'gold', [0, 0, 1]);
  const bandTo = G.F.length;
  // the pouches and the loop: hung over the band at the hips, each rigid where it hangs
  const hung = [];
  const pouch = (deg, w, h, d) => {
    const from = G.V.length, a = deg * DEG, j = Math.round(((deg + 360) % 360) / 360 * N) % N, r = R[j] + 0.12, y0 = yAt(a) + B.half - 0.02;
    const o = [Math.sin(a) * r, y0, z0 + Math.cos(a) * r], out = [Math.sin(a), 0, Math.cos(a)], side = [Math.cos(a), 0, -Math.sin(a)];
    const q = (s, u, t) => P(add(o, add(add(mul(side, s), [0, u, 0]), mul(out, t))));
    // the bag: a box, its front bowed out a little, a flap over its top half with a gold stud
    const b = [q(-w, -h, 0), q(w, -h, 0), q(w, -0.05, 0), q(-w, -0.05, 0)], f = [q(-w, -h, d), q(w, -h, d * 1.05), q(w, -0.05, d), q(-w, -0.05, d)];
    for (let k = 0; k < 4; k++) F([b[k], b[(k + 1) % 4], f[(k + 1) % 4], f[k]], k === 0 ? 'under' : 'under', { from: q(0, -h / 2, d / 2) });
    F(f, 'under', out);
    const fl = [q(-w - 0.02, -0.02, d + 0.02), q(w + 0.02, -0.02, d + 0.02), q(w * 0.9, -h * 0.55, d + 0.04), q(0, -h * 0.68, d + 0.05), q(-w * 0.9, -h * 0.55, d + 0.04)];
    F(fl, 'trim', out);
    F([q(0.07, -h * 0.5, d + 0.07), q(0, -h * 0.5 + 0.08, d + 0.07), q(-0.07, -h * 0.5, d + 0.07), q(0, -h * 0.5 - 0.08, d + 0.07)], 'gold', out);
    F([q(0.05, -h * 0.25, d + 0.065), q(0, -h * 0.25 + 0.07, d + 0.065), q(-0.05, -h * 0.25, d + 0.065), q(0, -h * 0.25 - 0.07, d + 0.065)], 'rune', out);
    hung.push({ from, to: G.V.length, at: o, out, side, h, d });
  };
  pouch(55, 0.28, 0.66, 0.24);
  pouch(-55, 0.24, 0.56, 0.22);
  pouch(150, 0.24, 0.5, 0.2);
  // the loop on the left hip: a leather strap hanging, a gold ring at its foot
  {
    const a = -128 * DEG, j = Math.round(((-128 + 360) % 360) / 360 * N) % N, r = R[j] + 0.12, o = [Math.sin(a) * r, yAt(a), z0 + Math.cos(a) * r], out = [Math.sin(a), 0, Math.cos(a)], side = [Math.cos(a), 0, -Math.sin(a)];
    const from = G.V.length, q = (s, u, t) => P(add(o, add(add(mul(side, s), [0, u, 0]), mul(out, t))));
    F([q(-0.08, B.half, 0), q(0.08, B.half, 0), q(0.08, -0.75, 0.02), q(-0.08, -0.75, 0.02)], 'under', out);
    const NR = 8, rc = [0, -0.85, 0.05], ringPts = (rr, t) => [...Array(NR).keys()].map((k) => { const aa = k * 2 * Math.PI / NR; return q(rr * Math.cos(aa), rc[1] + rr * Math.sin(aa), rc[2] + t); });
    const ro = ringPts(0.16, 0.03), ri = ringPts(0.1, 0.03), rb = ringPts(0.16, -0.03), rib = ringPts(0.1, -0.03);
    for (let k = 0; k < NR; k++) { const k1 = (k + 1) % NR; F([ro[k], ro[k1], ri[k1], ri[k]], 'gold', out); F([rb[k], rb[k1], rib[k1], rib[k]], 'gold', mul(out, -1)); F([ro[k], ro[k1], rb[k1], rb[k]], 'gold', { from: q(0, rc[1], 0) }); F([ri[k], ri[k1], rib[k1], rib[k]], 'gold', { from: q(0, rc[1] - 1, 0) }); }
    hung.push({ from, to: G.V.length, at: o });
  }
  const glowFrom = G.F.length;
  // the glow, enchanted: round the buckle's core and the pouches' runes
  {
    const c = P(fr(0, 0, 0.13)), rim = [...Array(12).keys()].map((k) => { const a = k * 30 * DEG; return P(fr(0.4 * Math.sin(a), 0.4 * Math.cos(a), 0.12)); });
    for (let k = 0; k < 12; k++) F([c, rim[k], rim[(k + 1) % 12]], 'glow', [0, 0, 1]);
    for (const h of hung.slice(0, 3)) {
      const base = add(h.at, add([0, -h.h * 0.25, 0], mul(h.out, h.d + 0.1))), mid = P(base), rr = [...Array(10).keys()].map((k) => { const a = k * 36 * DEG; return P(add(base, add(mul(h.side, 0.25 * Math.cos(a)), [0, 0.25 * Math.sin(a), 0]))); });
      for (let k = 0; k < 10; k++) F([mid, rr[k], rr[(k + 1) % 10]], 'glow', h.out);
    }
  }
  // the weights: the band's points as the body under them is; a pouch's (and its glow's) all as the band where it hangs
  const BP = pts(body), K = offArms(body), at6 = (p) => weightsAt(body, BP, p, 6, K), vw = G.V.map(at6);
  for (const h of hung) { const w = at6(h.at); for (let i = h.from; i < h.to; i++) vw[i] = w; }
  for (let i = hung[hung.length - 1].to; i < G.V.length; i++) { const own = hung.slice(0, 3).find((h) => Math.hypot(...sub(G.V[i], h.at)) < 1.2); vw[i] = own ? at6(own.at) : vw[i]; }
  // (the buckle and its glow rigid as the band's front)
  const front = at6(fr(0, 0, 0));
  G.V.forEach((p, i) => { if (Math.hypot(p[0], p[1] - yAt(0), p[2] - (z0 + R[0])) < 0.6 && (i < bandTo * 0 + G.V.length)) vw[i] = Math.abs(p[0]) < 0.5 && p[2] > z0 + R[0] - 0.05 ? front : vw[i]; });
  return { G, glowFrom, vw };
}

/* ---- the pendant ------------------------------------------------------------------------------------------------------ */
const PENDANT_OVER = { cloth: ['shawl'], shawlover: ['shawlover'], shawloverslim: ['shawloverslim'], leather: ['leatherchest'], tunic: ['tunic'] };
/** The pendant's height on the breastbone and where its chain goes under the collar, each body's (mesh units). */
const PENDANT_AT = { male: { y: -1.75, top: -0.55, side: 0.55 }, female: { y: -1.55, top: -0.6, side: 0.45 } };
function pendant(who, body, over) {
  const { G, P, F, loft } = mesher(), A = PENDANT_AT[who];
  const surf = over.flatMap((g) => surface(load(`low${g}-${who}.json`), 0.05));
  // the front of what is worn at (x, y): its most forward point near there
  const frontAt = (x, y, wide = 0.12) => { let z = -Infinity; for (const p of surf) if (Math.abs(p[0] - x) < wide && Math.abs(p[1] - y) < wide) z = Math.max(z, p[2]); return z; };
  const zc = frontAt(0, A.y, 0.16) + 0.1, C = [0, A.y, zc];
  // the stone: a gold frame, an eight-sided stone cut to a point, a gold bail over it
  const NS = 8, ring = (r, dz, k = 1.25) => [...Array(NS).keys()].map((j) => { const a = (j * 45 + 22.5) * DEG; return P([C[0] + r * Math.sin(a), C[1] + r * k * Math.cos(a), C[2] + dz]); });
  const o0 = ring(0.24, -0.04), o1 = ring(0.24, 0.05), i1 = ring(0.17, 0.07), g0 = ring(0.17, 0.05), apex = P([C[0], C[1], C[2] + 0.16]);
  loft([o0, o1], 'gold', () => [C[0], C[1], C[2] - 1]);
  loft([o1, i1], 'gold', () => [C[0], C[1], C[2] - 2]);
  for (let j = 0; j < NS; j++) F([g0[j], g0[(j + 1) % NS], apex], 'gem', { from: [C[0], C[1], C[2] - 1] });
  F([...o0].reverse(), 'gold', [0, 0, -1]);
  const bail = [P([C[0] - 0.06, C[1] + 0.3, C[2] + 0.03]), P([C[0] + 0.06, C[1] + 0.3, C[2] + 0.03]), P([C[0] + 0.05, C[1] + 0.42, C[2] + 0.02]), P([C[0] - 0.05, C[1] + 0.42, C[2] + 0.02])];
  F(bail, 'gold', [0, 0, 1]);
  // the chain: from the bail up either side over what is worn to under the collar, flat gold links a little proud of it
  for (const s of [1, -1]) {
    const n = 7, path = [...Array(n + 1).keys()].map((k) => { const t = k / n, x = s * (0.05 + (A.side - 0.05) * Math.sin(t * Math.PI / 2)), y = C[1] + 0.42 + (A.top - C[1] - 0.42) * t; return [x, y, frontAt(x, y) + 0.04]; });
    for (let k = 0; k < n; k++) {
      const a = path[k], b = path[k + 1], d = unit(sub(b, a)), w = mul(unit(cross(d, [0, 0, 1])), 0.03);
      F([P(sub(a, w)), P(add(a, w)), P(add(b, w)), P(sub(b, w))], k % 2 ? 'gold' : 'trim', [0, 0, 1]);
    }
  }
  const glowFrom = G.F.length;
  { const c = P([C[0], C[1], C[2] + 0.18]), rim = [...Array(12).keys()].map((k) => { const a = k * 30 * DEG; return P([C[0] + 0.5 * Math.sin(a), C[1] + 0.6 * Math.cos(a), C[2] + 0.12]); }); for (let k = 0; k < 12; k++) F([c, rim[k], rim[(k + 1) % 12]], 'glow', [0, 0, 1]); }
  const ch = boneOf(body, 'spine_03').i;
  return { G, glowFrom, vw: G.V.map(() => [[ch, 1]]) };
}

/* ---- the ring ------------------------------------------------------------------------------------------------------- */
function ringOf(body) {
  const { G, P, F, loft } = mesher(), f1 = boneOf(body, 'fingers_01_r'), f2 = boneOf(body, 'fingers_02_r');
  const axis = unit(sub(f2.head, f1.head)), len = Math.hypot(...sub(f2.head, f1.head));
  // the fingers' first segment: the vertices on its bone (the knuckles' line, on the back of the hand) and on the helpers
  // round it (the palm's side), across the hand (the bend axis, X) and through it (Z), a third of the way along it
  const own = [], seg = [];
  const near = new Set([f1.i, boneOf(body, 'knuckles_r').i, boneOf(body, 'fingers_mid_r').i]);
  body.weights.forEach((w, i) => {
    const p = [body.verts[i * 3], body.verts[i * 3 + 1], body.verts[i * 3 + 2]];
    let top = 0, b = -1; for (let j = 0; j < w.length; j += 2) if (w[j + 1] > top) { top = w[j + 1]; b = w[j]; }
    if (b === f1.i) own.push(p);
    if (near.has(b)) seg.push(p);
  });
  const across = f1.X, through = f1.Z, at = 0.36;
  const band = seg.filter((p) => Math.abs(dot(sub(p, f1.head), axis) - at * len) < 0.2);
  const xs = band.map((p) => dot(sub(p, f1.head), across)), x0 = Math.min(...xs), x1 = Math.max(...xs);
  // the ring finger: the quarter of the fingers' width on the little finger's side (away from the thumb)
  const th = boneOf(body, 'thumb_01_r'), thumbSide = Math.sign(dot(sub(th.head, f1.head), across)), wq = (x1 - x0) / 4;
  const xc = thumbSide > 0 ? x0 + wq * 1.5 : x1 - wq * 1.5;
  // the finger's surface there, sampled off the hand's triangles: its middle, and how far out it is each way round (the
  // ring's sides, toward the fingers either side, kept to the finger's own half width: inside the hand there)
  const handBones = new Set([...near, boneOf(body, 'hand_r').i, f2.i]);
  const keep = (i) => { const w = body.weights[i]; let top = 0, b = -1; for (let j = 0; j < w.length; j += 2) if (w[j + 1] > top) { top = w[j + 1]; b = w[j]; } return handBones.has(b); };
  const loc = (p) => { const d = sub(p, f1.head); return [dot(d, across), dot(d, axis) - at * len, dot(d, through)]; };
  const S0 = surface(body, 0.015, keep).map(loc).filter(([x, y]) => Math.abs(y) < 0.05 && Math.abs(x - xc) < wq * 0.6);
  const zlo = Math.min(...S0.map((q) => q[2])), zhi = Math.max(...S0.map((q) => q[2])), zc = (zlo + zhi) / 2;
  const centre = add(add(f1.head, mul(axis, at * len)), add(mul(across, xc), mul(through, zc)));
  const NR = 12, rOut = [...Array(NR).keys()].map((j) => {
    const a = (j + 0.5) * 2 * Math.PI / NR, d = [Math.cos(a), Math.sin(a)];
    let r = 0;
    for (const [x, , z] of S0) { const u = [x - xc, z - zc], along = u[0] * d[0] + u[1] * d[1], off = Math.abs(-u[0] * d[1] + u[1] * d[0]); if (along > 0 && off < 0.05) r = Math.max(r, along); }
    return Math.max(r, wq * 0.45) + 0.03;
  });
  const ring = (dy, k) => [...Array(NR).keys()].map((j) => { const a = (j + 0.5) * 2 * Math.PI / NR; return P(add(centre, add(mul(axis, dy), add(mul(across, rOut[j] * k * Math.cos(a)), mul(through, rOut[j] * k * Math.sin(a)))))); });
  const a = ring(-0.055, 1), b = ring(0.055, 1), ai = ring(-0.055, 0.8), bi = ring(0.055, 0.8);
  loft([a, b], 'gold', () => centre);
  loft([ai, a], 'gold', () => add(centre, mul(axis, 1))); loft([b, bi], 'gold', () => add(centre, mul(axis, -1)));
  // its stone on the back of the finger (the knuckles' side)
  const backSide = mul(through, Math.sign(dot(sub(own.reduce((s, p) => add(s, p), [0, 0, 0]).map((v) => v / own.length), centre), through)) || 1);
  const sc = add(centre, mul(backSide, Math.max(...rOut) + 0.01)), sq = (r, dd) => [...Array(6).keys()].map((j) => { const t = j * 60 * DEG; return P(add(sc, add(mul(backSide, dd), add(mul(axis, r * Math.cos(t)), mul(across, r * Math.sin(t)))))); });
  const s0 = sq(0.075, -0.02), s1 = sq(0.075, 0.02), top = P(add(sc, mul(backSide, 0.07)));
  loft([s0, s1], 'gold', () => sc);
  for (let j = 0; j < 6; j++) F([s1[j], s1[(j + 1) % 6], top], 'gem', backSide);
  const glowFrom = G.F.length;
  { const c = P(add(sc, mul(backSide, 0.09))), rim = [...Array(8).keys()].map((k) => { const t = k * 45 * DEG; return P(add(sc, add(mul(backSide, 0.06), add(mul(axis, 0.2 * Math.cos(t)), mul(across, 0.2 * Math.sin(t)))))); }); for (let k = 0; k < 8; k++) F([c, rim[k], rim[(k + 1) % 8]], 'glow', backSide); }
  return { G, glowFrom, vw: G.V.map(() => [[f1.i, 1]]) };
}

/* ---- the circlet ------------------------------------------------------------------------------------------------------ */
/** The band's middle at the front and at the back (above the head bone's head, mesh units), each body's. */
const CIRCLET_AT = { male: { front: 0.86, back: 1.2, half: 0.06 }, female: { front: 0.8, back: 1.12, half: 0.055 } };
/** The hairstyles a circlet is fitted over, one fit each (src/sculpt/assets/lowhair.json), and `bare` for none. */
export const CIRCLET_HAIR = ['bare', 'swept', 'braid', 'bob'];
function circlet(who, body, style) {
  const { G, P, F, loft } = mesher(), A = CIRCLET_AT[who], hd = boneOf(body, 'head'), H = hd.head;
  const hair = load('lowhair.json')[who][style], surf = [...surface(body, 0.05), ...(hair ? surface(hair, 0.04) : [])];
  const zc = H[2] + 0.05, N = 24, yAt = (a) => H[1] + A.front + (A.back - A.front) * (1 - Math.cos(a)) / 2;
  const reach = [...Array(N).keys()].map((j) => {
    const a = (j * 360) / N * DEG, d = [Math.sin(a), Math.cos(a)], y = yAt(a);
    let r = 0;
    for (const p of surf) { if (Math.abs(p[1] - y) > A.half + 0.08) continue; const x = p[0], z = p[2] - zc, along = x * d[0] + z * d[1], acr = Math.abs(-x * d[1] + z * d[0]); if (along > 0 && acr < 0.2) r = Math.max(r, along); }
    return r;
  });
  // (each way its own reach, not let in past nine tenths of its neighbours': a lock of hair standing out is gone round
  // where it stands, the band not pulled in and out by every lock)
  const R = reach.map((r, j) => Math.max(r, 0.9 * Math.max(reach[(j + N - 1) % N], reach[(j + 1) % N])) + 0.02);
  const ring = (dy, dr) => R.map((r, j) => { const a = (j * 360) / N * DEG; return P([Math.sin(a) * (r + dr), yAt(a) + dy, zc + Math.cos(a) * (r + dr)]); });
  const lo = ring(-A.half, 0.05), hi = ring(A.half, 0.05), loI = ring(-A.half, 0), hiI = ring(A.half, 0);
  const mid = (i, j) => [0, yAt((j * 360) / N * DEG), zc];
  loft([lo, hi], 'gold', mid);
  loft([hi, hiI], 'gold', () => [0, -20, zc]); loft([loI, lo], 'gold', () => [0, 20, zc]);
  // the settings: the middle one larger, at the brow; the others at the temples; each a gold rim round its stone
  const settings = [[0, 0.17, 'stone1'], [-38, 0.11, 'stone2'], [38, 0.11, 'stone3']];
  for (const [deg, r, m] of settings) {
    const a = deg * DEG, j = Math.round(((deg + 360) % 360) / 360 * N) % N, rr = R[j] + 0.1, out = [Math.sin(a), 0, Math.cos(a)], side = [Math.cos(a), 0, -Math.sin(a)];
    const o = [Math.sin(a) * rr, yAt(a) + (deg === 0 ? 0.04 : 0), zc + Math.cos(a) * rr], q = (s, u, t) => P(add(o, add(add(mul(side, s), [0, u, 0]), mul(out, t))));
    const NS = deg === 0 ? 8 : 6, rim = (k, t) => [...Array(NS).keys()].map((n) => { const aa = (n + 0.5) * 2 * Math.PI / NS; return q(r * k * Math.cos(aa), r * k * 1.25 * Math.sin(aa), t); });
    const r0 = rim(1.3, -0.04), r1 = rim(1.3, 0.04), r2 = rim(1, 0.05), apex = q(0, 0, 0.13);
    loft([r0, r1], 'gold', () => add(o, mul(out, -1))); loft([r1, r2], 'gold', () => add(o, mul(out, -2)));
    for (let n = 0; n < NS; n++) F([r2[n], r2[(n + 1) % NS], apex], m, out);
    if (deg === 0) for (const s of [1, -1]) F([q(s * 0.24, 0.02, 0.03), q(s * 0.4, 0, 0.02), q(s * 0.24, -0.02, 0.03), q(s * 0.2, 0, 0.04)], 'gold', out);
  }
  const glowFrom = G.F.length;
  for (const [deg, r] of settings) {
    const a = deg * DEG, j = Math.round(((deg + 360) % 360) / 360 * N) % N, rr = R[j] + 0.25, out = [Math.sin(a), 0, Math.cos(a)], side = [Math.cos(a), 0, -Math.sin(a)], o = [Math.sin(a) * rr, yAt(a), zc + Math.cos(a) * rr];
    const c = P(o), rim = [...Array(10).keys()].map((k) => { const t = k * 36 * DEG; return P(add(o, add(mul(side, r * 3 * Math.cos(t)), [0, r * 3 * Math.sin(t), 0]))); });
    for (let k = 0; k < 10; k++) F([c, rim[k], rim[(k + 1) % 10]], 'glow', out);
  }
  return { G, glowFrom, vw: G.V.map(() => [[hd.i, 1]]) };
}

/* ---- the game's copies ------------------------------------------------------------------------------------------------ */
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), at = args.indexOf('--out');
  const dir = resolve(at < 0 ? ASSETS : args[at + 1]);
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : '';
  const write = (name, who, body, built) => {
    if (!name.startsWith(only)) return;
    const vw = built.vw ?? built.G.V.map(() => [[built.bone, 1]]);
    const g = garment(who, body, built.G, vw, built.glowFrom), f = join(dir, `low${name}-${who}.json`);
    writeFileSync(f, JSON.stringify(g));
    console.log(`wrote ${f}: ${g.tris.length / 4} triangles, ${g.mats.length} materials (${g.mats.join(' ')})`);
  };
  for (const who of ['male', 'female']) {
    const body = load(`low${who}.json`);
    write('shieldwood', who, body, woodShield(body, who === 'female' ? 1.95 : 2.15));
    write('shieldmetal', who, body, metalShield(body, who === 'female' ? 2.8 : 3.1, who === 'female' ? 1.0 : 1.1));
    for (const [k, over] of Object.entries(BELT_OVER)) write(`belt${k}`, who, body, belt(who, body, over));
    for (const [k, over] of Object.entries(PENDANT_OVER)) write(`pendant${k}`, who, body, pendant(who, body, over));
    write('ring', who, body, ringOf(body));
    for (const style of CIRCLET_HAIR) write(`circlet${style}`, who, body, circlet(who, body, style));
  }
}
