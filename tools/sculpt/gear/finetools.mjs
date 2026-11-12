// Five hand tools for the low-poly bodies in the Runecut line of the long sword, the Runestone Warhammer and the Runestone
// Pickaxe (tools/sculpt/gear/long_sword.mjs, warhammer.mjs, pickaxe.mjs): the awl, the carving knife, the trowel, the file
// and the whetstone (src/game/items.ts), each held in one fist at the bench (the work clip, src/sculpt/anim/clips/work.ts).
// Run on its own (or through tools/sculpt/gear/<id>.mjs), it writes src/sculpt/assets/<id>.json for each (gearAsset).
//
//   build(id, { enchanted }) -> { G (meshOf: V, F with a material each, A: glow alpha per point), MATS, L, grip, fit,
//   contact, ends, tris (the count, the glow's apart), all, parts }
//
// The frame (the work clip's, as the mallet's: game units, the man 16.5 tall): origin on the handle's axis at the butt; y
// along the handle toward the working end, which is toward the thumb of the fist that holds it; x the way the blow goes
// (along the hand toward the knuckles): a blade's edge and the file's and the whetstone's working face look down +x; z = x
// × y. grip.lead is the fist point (the hand socket's o), contact the point that meets the work: the tip (awl, carving
// knife), the middle of the blade's +x edge (trowel, file), the middle of the honing face (whetstone).
//
// The line's parts on each: a faceted pale-stone pommel (an eight-sided block, bevelled at both ends) with a gold-ringed
// star medallion on both faces, a gold collar, a straight-grained wooden handle (eight-sided, its facets in two tones, a
// darker grain line down each broad face), a gold ferrule; the working part in the line's pale stone, faceted and veined,
// with a gold-ringed rune star and a rune line. Built at life size, drawn at game-prop scale (SCALE). The working part
// of each tool the game makes in a metal (the carving knife and the trowel from a cast blade, the file cast whole:
// src/game/recipes.ts, src/game/metal.ts MOULDS) takes copies of the stone's materials with a metal role (lowgear.mjs
// metalFaces, metalMats), drawn in the item's metal by src/sculpt/lowpoly.ts metalTint (iron for none: the starter kit's file has none). The awl (carved from bone, make_awl) and the whetstone
// (shaped from rock shards, make_whetstone) are never metal: their stone keeps its own colours.
// Enchanted: the runes, the medallions' discs and stars lit (unlit, full bright; the game's bloom), and glow added round
// them (the polygons from glowFrom on: drawn by the authoring renders, left out by the game).

import { meshOf, trisOf, metalFaces, metalMats } from '../lowgear.mjs';
import { add, sub, mul, unit, cross } from '../lowrig.mjs';

export const MATS_PLAIN = {
  stone: { c: '#dcc8bd', vary: 0.035 },
  stoneL: { c: '#e6d5ca', vary: 0.03 },
  stoneB: { c: '#d0bbb0', vary: 0.035 },
  bevel: { c: '#c0a59a', vary: 0.03 },
  crack: { c: '#b09489' },
  gold: { c: '#d9a04f' },
  goldD: { c: '#b98238' },
  wood: { c: '#a8693f', vary: 0.03 },
  wood2: { c: '#935a36', vary: 0.03 },
  grain: { c: '#74401f' },
  rune: { c: '#93889f' },
  star: { c: '#e2cfa4' },
  gem: { c: '#d4b47a' },
  glow: { c: '#ff9a35', glow: 1 },
};
/** The working part's stone, drawn in the metal it is smithed from (`metalFaces`) on a tool the game makes in a metal. */
const METAL = ['stone', 'stoneL', 'stoneB', 'bevel', 'crack'];
Object.assign(MATS_PLAIN, metalMats(MATS_PLAIN, METAL));
export const MATS_ENCHANTED = {
  ...MATS_PLAIN,
  rune: { c: '#ffa83a', emit: true },
  star: { c: '#fff6d8', emit: true },
  gem: { c: '#ffa847', emit: true },
};

/** The tools, by item id: whether the game makes the working part in a metal, and the label. */
export const TOOLS = {
  awl: { metal: false, name: 'Awl' },
  carving_knife: { metal: true, name: 'Carving knife' },
  trowel: { metal: true, name: 'Trowel' },
  file: { metal: true, name: 'File' },
  whetstone: { metal: false, name: 'Whetstone' },
};
export const TOOL_IDS = Object.keys(TOOLS);

const DEG = Math.PI / 180;
/** An eight-sided section's corners (x, z) round (cx, cz), half-widths hx, hz, its corners cut by c: corners 1-2 the +x face, 3-4 the -z, 5-6 the -x, 7-0 the +z. */
const oct = (cx, cz, hx, hz, c) => [[cx + hx - c, cz + hz], [cx + hx, cz + hz - c], [cx + hx, cz - hz + c], [cx + hx - c, cz - hz], [cx - hx + c, cz - hz], [cx - hx, cz - hz + c], [cx - hx, cz + hz - c], [cx - hx + c, cz + hz]];
/** The faces of an eight-sided section: 1 +x, 3 -z, 5 -x, 7 +z; the even ones the cut corners. */
const FACE = { px: 1, nz: 3, nx: 5, pz: 7 };

function kit(enchanted) {
  const G = meshOf();
  G.A = [];
  const P = (x, y, z, a) => { const i = G.p([x, y, z]); if (a !== undefined) G.A[i] = a; return i; };
  const F = (v, mat, out) => { const w = v.filter((x, j) => x !== v[(j + 1) % v.length]); if (w.length >= 3) G.f(w, mat, out); };
  /** A ring of the eight-sided section at height y. */
  const ring = (y, hx, hz, c, cx = 0, cz = 0) => ({ y, s: hx + hz, cx, cz, r: oct(cx, cz, hx, hz, c).map(([x, z]) => P(x, y, z)) });
  /** Rings joined, each band its material (or mats(i, j)); a step at one height faces up or down. */
  const loft = (rings, mat) => {
    for (let i = 0; i + 1 < rings.length; i++) for (let j = 0; j < 8; j++) {
      const a = rings[i], b = rings[i + 1], m = typeof mat === 'function' ? mat(i, j) : mat;
      const flat = Math.abs(a.y - b.y) < 1e-9;
      F([a.r[j], a.r[(j + 1) % 8], b.r[(j + 1) % 8], b.r[j]], m, flat ? (b.s > a.s ? [0, -1, 0] : [0, 1, 0]) : { from: [(a.cx + b.cx) / 2, (a.y + b.y) / 2, (a.cz + b.cz) / 2] });
    }
  };
  const cap = (rg, mat, dir) => F([...rg.r], mat, dir);
  /** An n-sided disc or ring's points on a face (its plane at z, x and y across it, or turned by `onX` onto a +x / -x face). */
  const at = (cx, cy, z, r, n, rot, side = 'z') => [...Array(n).keys()].map((j) => { const a = (90 + rot + j * 360 / n) * DEG, u = cx + r * Math.cos(a), v = cy + r * Math.sin(a); return side === 'z' ? P(u, v, z) : P(z, v, u); });
  /**
   * A gold-ringed medallion on a face (z the face's plane, sz which way it looks): a gold ring standing off the face, the
   * disc inside it (gem), the star on the disc (eight points, the long ones up, down and across).
   */
  const medallion = (cx, cy, z, sz, ro, ri, side = 'z', n = 6) => {
    const out = side === 'z' ? [0, 0, sz] : [sz, 0, 0], h = ro * 0.22, rot = 90 / n;
    const ob = at(cx, cy, z - sz * 0.01, ro, n, rot, side), ot = at(cx, cy, z + sz * h, ro, n, rot, side), it = at(cx, cy, z + sz * h, ri, n, rot, side);
    const disc = at(cx, cy, z + sz * h * 0.85, ri, n, rot, side);
    for (let j = 0; j < n; j++) {
      const j1 = (j + 1) % n;
      F([ob[j], ob[j1], ot[j1], ot[j]], 'goldD', { from: side === 'z' ? [cx, cy, z] : [z, cy, cx] });
      F([ot[j], ot[j1], it[j1], it[j]], 'gold', out);
    }
    F(disc, 'gem', out);
    const zs = z + sz * h * 0.85 + sz * 0.005, c = side === 'z' ? P(cx, cy, zs + sz * 0.004) : P(zs + sz * 0.004, cy, cx), pts = [];
    for (let j = 0; j < 8; j++) { const a = (90 + j * 45) * DEG, r = j % 2 ? ri * 0.32 : ri * 0.95; pts.push(side === 'z' ? P(cx + r * Math.cos(a), cy + r * Math.sin(a), zs) : P(zs, cy + r * Math.sin(a), cx + r * Math.cos(a))); }
    for (let j = 0; j < 8; j++) F([c, pts[j], pts[(j + 1) % 8]], 'star', out);
  };
  /** A strip of width w along a polyline of (x, y) on a plane z(x, y), its ends pointed (rune lines, grain, veins). */
  const strip = (pts, w, zOf, mat, out, pointed = false) => {
    const n = pts.length, L = [], R = [];
    for (let j = 0; j < n; j++) {
      const a = pts[Math.max(0, j - 1)], b = pts[Math.min(n - 1, j + 1)], d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...d), nx = -d[1] / l * w / 2, ny = d[0] / l * w / 2;
      const [x, y] = pts[j];
      L.push(P(x - nx, y - ny, zOf(x - nx, y - ny))); R.push(P(x + nx, y + ny, zOf(x + nx, y + ny)));
    }
    for (let j = 0; j + 1 < n; j++) F([L[j], R[j], R[j + 1], L[j + 1]], mat, out);
    if (pointed) for (const [j, k] of [[0, 1], [n - 1, n - 2]]) {
      const [x, y] = pts[j], [x2, y2] = pts[k], d = [x - x2, y - y2], l = Math.hypot(...d), tx = x + d[0] / l * w * 1.4, ty = y + d[1] / l * w * 1.4;
      F([L[j], R[j], P(tx, ty, zOf(tx, ty))], mat, out);
    }
  };
  /** A rune diamond: an outline of width w round (cx, cy), half-height r, and its centre. */
  const diamond = (cx, cy, r, w, zOf, out) => {
    const pts = [[cx, cy + r], [cx - r * 0.62, cy], [cx, cy - r], [cx + r * 0.62, cy]], s = 1 - w / r;
    const o = pts.map(([x, y]) => P(x, y, zOf(x, y))), i = pts.map(([x, y]) => { const u = cx + (x - cx) * s, v = cy + (y - cy) * s; return P(u, v, zOf(u, v)); });
    for (let j = 0; j < 4; j++) F([o[j], o[(j + 1) % 4], i[(j + 1) % 4], i[j]], 'rune', out);
    const q = 0.36;
    F(pts.map(([x, y]) => { const u = cx + (x - cx) * q, v = cy + (y - cy) * q; return P(u, v, zOf(u, v) + (out[2] || 0) * 0.001); }), 'rune', out);
  };
  /** A rune star (eight points) on a face. */
  const runeStar = (cx, cy, r, zOf, out) => {
    const c = P(cx, cy, zOf(cx, cy) + (out[2] || 0) * 0.002), pts = [];
    for (let j = 0; j < 8; j++) { const a = (90 + j * 45) * DEG, rr = j % 2 ? r * 0.36 : r; pts.push(P(cx + rr * Math.cos(a), cy + rr * Math.sin(a), zOf(cx + rr * Math.cos(a), cy + rr * Math.sin(a)))); }
    for (let j = 0; j < 8; j++) F([c, pts[j], pts[(j + 1) % 8]], 'rune', out);
  };
  /** Glow, enchanted: a disc fanned from a bright middle to nothing at its rim, facing `out`. */
  const glowDisc = (c, r, a, out, n = 8) => {
    const o = unit(out), u = unit(Math.abs(o[1]) > 0.9 ? cross(o, [1, 0, 0]) : cross(o, [0, 1, 0])), v = cross(o, u);
    const m = P(...c, a), rim = [...Array(n).keys()].map((j) => P(...add(c, add(mul(u, r * Math.cos(j * 2 * Math.PI / n)), mul(v, r * Math.sin(j * 2 * Math.PI / n)))), 0));
    for (let j = 0; j < n; j++) F([m, rim[j], rim[(j + 1) % n]], 'glow', o);
  };
  /** Glow along a line on a face: a strip bright at its middle line, nothing at its sides. */
  const glowLine = (pts, w, zOf, a, out) => {
    for (let j = 0; j + 1 < pts.length; j++) {
      const [x0, y0] = pts[j], [x1, y1] = pts[j + 1], l = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / l * w, ny = (x1 - x0) / l * w;
      const m0 = P(x0, y0, zOf(x0, y0), a), m1 = P(x1, y1, zOf(x1, y1), a);
      const l0 = P(x0 - nx, y0 - ny, zOf(x0, y0), 0), l1 = P(x1 - nx, y1 - ny, zOf(x1, y1), 0), r0 = P(x0 + nx, y0 + ny, zOf(x0, y0), 0), r1 = P(x1 + nx, y1 + ny, zOf(x1, y1), 0);
      F([l0, m0, m1, l1], 'glow', out); F([m0, r0, r1, m1], 'glow', out);
    }
  };
  return { G, P, F, ring, loft, cap, medallion, strip, diamond, runeStar, glowDisc, glowLine, enchanted };
}

/**
 * The line's handle, from the butt up: the pommel (an eight-sided pale-stone block, bevelled at both ends, a medallion on
 * each broad face), the gold collar, the wooden handle (eight-sided, swelling to `swell` at `mid`, its broad faces one
 * tone and its corners the other, a grain line down each broad face), the gold ferrule. Returns where things are.
 */
function handle(K, o) {
  const { ring, loft, cap, medallion, strip } = K;
  const ZK = o.zk ?? 0.9, pr = o.pommel ?? 0.19, PT = o.pt ?? 0.3, w0 = PT + 0.07, w1 = o.top, r0 = o.r0, rs = o.swell, r1 = o.r1;
  // the pommel: the foot's bevel, the block, the shoulder
  const pm = [ring(0, pr * 0.6, pr * 0.6 * ZK, pr * 0.18), ring(0.06, pr, pr * ZK, pr * 0.3), ring(PT - 0.06, pr, pr * ZK, pr * 0.3), ring(PT - 0.02, r0 * 1.14, r0 * 1.14 * ZK, r0 * 0.34)];
  cap(pm[0], 'bevel', [0, -1, 0]);
  loft(pm, (i, j) => (i === 1 ? (j % 2 ? 'stone' : j === 2 || j === 4 ? 'stoneB' : 'stoneL') : 'bevel'));
  // its medallions, on the broad faces (+z and -z)
  const mc = (PT) / 2 + 0.005, zf = pr * ZK;
  for (const sz of [1, -1]) medallion(0, mc, sz * zf, sz, pr * 0.62, pr * 0.46);
  // the collar: a gold band standing proud of the pommel's shoulder and the handle's foot
  const gc = [pm[3], ring(w0, r0 * 1.14, r0 * 1.14 * ZK, r0 * 0.34), ring(w0, r0, r0 * ZK, r0 * 0.3)];
  loft(gc, (i) => (i === 0 ? 'gold' : 'goldD'));
  // the wood
  const mid = o.mid ?? (w0 + w1) / 2;
  const wd = [gc[2], ring(mid, rs, rs * ZK, rs * 0.3), ring(w1, r1, r1 * ZK, r1 * 0.3)];
  loft(wd, (i, j) => (j % 2 ? 'wood' : 'wood2'));
  // the grain: a line down each broad face, a little off its middle
  for (const sz of [1, -1]) {
    const zAt = (x, y) => { const t = y < mid ? (y - w0) / (mid - w0) : (y - mid) / (w1 - mid), r = y < mid ? r0 + (rs - r0) * t : rs + (r1 - rs) * t; return sz * (r * ZK + 0.003); };
    strip([[-0.035 * sz, w0 + 0.03], [-0.035 * sz, mid], [-0.03 * sz, w1 - 0.03]], 0.018, zAt, 'grain', [0, 0, sz]);
  }
  // the ferrule: a gold band stepped out from the wood
  const fr = o.ferrule ?? 0.13, rf = Math.max(r1, o.rf ?? r1) * 1.12;
  const fe = [wd[2], ring(w1, rf, rf * ZK, rf * 0.3), ring(w1 + fr, rf, rf * ZK, rf * 0.3)];
  loft(fe, (i) => (i === 0 ? 'goldD' : 'gold'));
  return { PT, w0, w1, mid, top: w1 + fr, rf, last: fe[fe.length - 1], ZK };
}

/* ---- the awl: a pear-shaped handle and a long eight-sided bone point ---------------------------------------------- */
function awl(K) {
  const { G, P, F, ring, loft, cap, diamond, glowDisc, glowLine, enchanted } = K;
  const h = handle(K, { r0: 0.13, swell: 0.162, mid: 0.66, r1: 0.12, top: 1.12, pommel: 0.17, zk: 1 });
  // the bolster: a gold-stepped stone block the point rises from, a rune diamond on each broad face
  const B0 = h.top, B1 = B0 + 0.2, bh = 0.11;
  const bo = [h.last, ring(B0, bh, bh, bh * 0.32), ring(B1 - 0.04, bh, bh, bh * 0.32), ring(B1, 0.088, 0.088, 0.028)];
  cap({ r: h.last.r }, 'goldD', [0, 1, 0]);
  loft(bo.slice(1), (i, j) => (i === 0 ? (j % 2 ? 'stone' : 'stoneL') : 'bevel'));
  // the point: eight-sided, waisted a little and drawn to the tip
  const TIP = 2.16, sp = [bo[3], ring(1.62, 0.07, 0.07, 0.022), ring(1.95, 0.042, 0.042, 0.014)];
  loft(sp, (i, j) => (j % 2 ? (j === 1 || j === 7 ? 'stoneL' : 'stone') : 'stoneB'));
  const tip = P(0, TIP, 0);
  for (let j = 0; j < 8; j++) F([sp[2].r[j], sp[2].r[(j + 1) % 8], tip], j % 2 ? 'stone' : 'bevel', { from: [0, 1.9, 0] });
  // a vein up the point's front and back
  const zOf = (sz) => (x, y) => sz * (y < 1.62 ? 0.088 + (0.07 - 0.088) * (y - B1) / (1.62 - B1) : 0.07 + (0.042 - 0.07) * (y - 1.62) / 0.33) * 0.93 + sz * 0.003;
  for (const sz of [1, -1]) K.strip([[0.012 * sz, B1 + 0.05], [-0.01 * sz, 1.5], [0.008 * sz, 1.78]], 0.011, zOf(sz), 'crack', [0, 0, sz]);
  for (const sz of [1, -1]) K.medallion(0, (B0 + B1 - 0.04) / 2 + 0.005, sz * bh, sz, 0.085, 0.064);
  const tris = trisOf(G).length;
  if (enchanted) {
    for (const sz of [1, -1]) {
      glowDisc([0, h.PT / 2, sz * 0.2], 0.3, 0.45, [0, 0, sz]);
      glowDisc([0, (B0 + B1) / 2, sz * (bh + 0.012)], 0.2, 0.45, [0, 0, sz]);
      glowLine([[0, B1 + 0.02], [0, 1.9]], 0.05, zOf(sz), 0.25, [0, 0, sz]);
    }
  }
  return { tris, L: TIP, lead: 0.72, radius: 0.145, contact: [0, TIP, 0], parts: 'pommel, collar, handle, ferrule, bolster, point' };
}

/* ---- the carving knife: a short single-edged blade, the edge leading along +x ---------------------------------------- */
function carvingKnife(K) {
  const { G, P, F, ring, loft, cap, strip, diamond, glowDisc, glowLine, enchanted } = K;
  const h = handle(K, { r0: 0.13, swell: 0.148, r1: 0.13, top: 1.08, zk: 0.86, pommel: 0.17 });
  // the bolster: a gold guard, wider across the blade's way
  const g0 = h.top, g1 = g0 + 0.07;
  const gd = [ring(g0, 0.2, 0.12, 0.05), ring(g1, 0.2, 0.12, 0.05), ring(g1, 0.13, 0.06, 0.03)];
  cap({ r: h.last.r }, 'goldD', [0, 1, 0]);
  cap(gd[0], 'goldD', [0, -1, 0]);
  loft(gd, (i, j) => (i === 0 ? (j % 2 ? 'gold' : 'goldD') : 'goldD'));
  const bladeFrom = G.F.length;
  // stations from the guard to the tip: y, the spine's x, where the edge's bevel starts, the edge's x, the half-thickness
  // at the face and at the spine
  const ST = [[g1, -0.085, 0.07, 0.17, 0.042, 0.03], [1.45, -0.088, 0.085, 0.19, 0.042, 0.03], [1.78, -0.085, 0.08, 0.185, 0.038, 0.027], [2.02, -0.072, 0.06, 0.15, 0.032, 0.022], [2.2, -0.045, 0.03, 0.095, 0.024, 0.016]];
  const TIP = [0.0, 2.38];
  const rs = ST.map(([y, xs, xb, xe, t, te]) => [P(xs, y, te), P(xb, y, t), P(xe, y, 0), P(xb, y, -t), P(xs, y, -te)]);
  const BM = ['stone', 'bevel', 'bevel', 'stone', 'stoneB'];
  for (let i = 0; i + 1 < rs.length; i++) for (let j = 0; j < 5; j++) F([rs[i][j], rs[i][(j + 1) % 5], rs[i + 1][(j + 1) % 5], rs[i + 1][j]], j === 0 || j === 3 ? (i % 2 ? 'stoneL' : 'stone') : BM[j], { from: [(ST[i][1] + ST[i][3]) / 2, (ST[i][0] + ST[i + 1][0]) / 2, 0] });
  const tip = P(TIP[0], TIP[1], 0), last = rs[rs.length - 1];
  for (let j = 0; j < 5; j++) F([last[j], last[(j + 1) % 5], tip], BM[j], { from: [0, 2.2, 0] });
  F([...rs[0]], 'stoneB', [0, -1, 0]);
  /** The blade's face at (x, y): its z (the face between the spine and the bevel), a hair proud. */
  const face = (sz) => (x, y) => {
    let i = 0; while (i + 2 < ST.length && ST[i + 1][0] < y) i++;
    const a = ST[i], b = ST[i + 1], t = Math.min(1, Math.max(0, (y - a[0]) / (b[0] - a[0]))), L = (k) => a[k] + (b[k] - a[k]) * t;
    const u = Math.min(1, Math.max(0, (x - L(1)) / (L(2) - L(1))));
    return sz * (L(5) + (L(4) - L(5)) * u + 0.003);
  };
  const veinsFrom = G.F.length;
  for (const sz of [1, -1]) strip([[0.06 * sz + 0.02, 1.25], [0.03, 1.42], [0.05, 1.55]], 0.012, face(sz), 'crack', [0, 0, sz]);
  metalFaces(G, [[bladeFrom, G.F.length]], METAL);
  // the runes: a line along the blade near its spine, pointed at both ends, and a diamond at its foot
  const STAR = 1.4, LINE = [[-0.02, 1.53], [-0.02, 1.98], [-0.025, 2.1]];
  for (const sz of [1, -1]) {
    strip(LINE, 0.026, face(sz), 'rune', [0, 0, sz], true);
    K.medallion(0, STAR, face(sz)(0, STAR) - sz * 0.003, sz, 0.078, 0.058);
  }
  void veinsFrom;
  const tris = trisOf(G).length;
  if (enchanted) for (const sz of [1, -1]) {
    glowDisc([0, h.PT / 2, sz * 0.19], 0.3, 0.45, [0, 0, sz]);
    glowLine(LINE, 0.09, (x, y) => face(sz)(x, y) + sz * 0.004, 0.4, [0, 0, sz]);
    glowDisc([0, STAR, face(sz)(0, STAR) + sz * 0.025], 0.2, 0.5, [0, 0, sz]);
  }
  return { tris, L: TIP[1], lead: 0.7, radius: 0.135, contact: [TIP[0], TIP[1], 0], parts: 'pommel, collar, handle, ferrule, guard, blade' };
}

/* ---- the trowel: a pointed leaf blade on a cranked neck, its flat across z, its edge leading along +x ---------------- */
function trowel(K) {
  const { G, P, F, ring, loft, cap, strip, diamond, glowDisc, glowLine, enchanted } = K;
  const h = handle(K, { r0: 0.14, swell: 0.16, r1: 0.14, top: 1.1, zk: 0.95, pommel: 0.175 });
  cap({ r: h.last.r }, 'goldD', [0, 1, 0]);
  const neckFrom = G.F.length;
  // the neck: a six-sided rod from the ferrule up and over to the blade's heel, offset down -z (the blade under the handle)
  const ZB = -0.3, path = [[0, h.top - 0.02, 0], [0, h.top + 0.1, -0.02], [0, h.top + 0.22, ZB + 0.02]], rr = [0.05, 0.047, 0.05];
  const rings = path.map((p, i) => {
    const d = unit(sub(path[Math.min(path.length - 1, i + 1)], path[Math.max(0, i - 1)])), u = [1, 0, 0], v = unit(cross(d, u));
    return [...Array(6).keys()].map((j) => { const a = (j + 0.5) * Math.PI / 3; return P(...add(p, add(mul(u, rr[i] * Math.cos(a)), mul(v, rr[i] * Math.sin(a))))); });
  });
  for (let i = 0; i + 1 < rings.length; i++) for (let j = 0; j < 6; j++) F([rings[i][j], rings[i][(j + 1) % 6], rings[i + 1][(j + 1) % 6], rings[i + 1][j]], j % 2 ? 'stoneB' : 'bevel', { from: mul(add(path[i], path[i + 1]), 0.5) });
  // the blade: the outline (the +x half, heel to tip), its faces inset from the edge by the bevel, a ridge down its middle
  const Y0 = h.top + 0.2, TIPY = Y0 + 1.42, T = 0.022, RIDGE = 0.014;
  const HALF = [[0.06, Y0], [0.27, Y0 + 0.025], [0.345, Y0 + 0.12], [0.35, Y0 + 0.3], [0.25, Y0 + 0.75], [0.14, Y0 + 1.08], [0.0, TIPY]];
  const outline = [...HALF, ...HALF.slice(0, -1).reverse().map(([x, y]) => [-x, y])];
  const inset = outline.map(([x, y], j) => {
    if (j === HALF.length - 1) return [0, y - 0.07];
    const s = Math.sign(x) || 1;
    return [x - s * 0.045 * (y > Y0 + 0.2 ? 1 : 0.8), Math.max(Y0 + 0.035, y + (y < Y0 + 0.05 ? 0.035 : 0))];
  });
  const bladeFrom = G.F.length;
  const edge = outline.map(([x, y]) => P(x, y, ZB));
  const top = inset.map(([x, y]) => P(x, y, ZB + T)), bot = inset.map(([x, y]) => P(x, y, ZB - T));
  const n = outline.length;
  for (let j = 0; j < n; j++) {
    const j1 = (j + 1) % n, from = [outline[j][0] * 0.5, (outline[j][1] + outline[j1][1]) / 2 - 0.05, ZB];
    F([edge[j], edge[j1], top[j1], top[j]], 'bevel', { from: [from[0], from[1], ZB - 0.2] });
    F([edge[j], edge[j1], bot[j1], bot[j]], 'bevel', { from: [from[0], from[1], ZB + 0.2] });
  }
  // the faces: each half its own facet, meeting on a ridge down the middle (the heel's middle to the tip's inset)
  const iT = HALF.length - 1;
  for (const [sz, ring2] of [[1, top], [-1, bot]]) {
    // the ridge: the heel's middle and a point two thirds up, raised; each half of the face in two facets either side of it
    const hr = P(0, Y0 + 0.035, ZB + sz * (T + RIDGE)), mr = P(0, Y0 + 0.75, ZB + sz * (T + RIDGE * 0.6)), k = 4;
    F([hr, ...ring2.slice(0, k + 1), mr], 'stoneL', [0, 0, sz]);
    F([mr, ...ring2.slice(k, iT + 1)], 'stone', [0, 0, sz]);
    F([mr, ...ring2.slice(iT, n - k)], 'stoneB', [0, 0, sz]);
    F([hr, mr, ...ring2.slice(n - k - 1)], 'stone', [0, 0, sz]);
  }
  /** The blade's face at (x, y), a hair proud: the ridge's slope across it. */
  const face = (sz) => (x, y) => ZB + sz * (T + RIDGE * Math.max(0, 1 - Math.abs(x) / 0.3) * (y < Y0 + 0.75 ? 1 : 0.6) + 0.004);
  for (const sz of [1, -1]) strip([[0.2, Y0 + 0.25], [0.14, Y0 + 0.4], [0.17, Y0 + 0.55]], 0.014, face(sz), 'crack', [0, 0, sz]);
  metalFaces(G, [[neckFrom, G.F.length]], METAL);
  // the runes: a line down the ridge, a diamond at the heel
  const LINE = [[0, Y0 + 0.4], [0, Y0 + 1.05]];
  for (const sz of [1, -1]) {
    strip(LINE, 0.03, (x, y) => face(sz)(x, y) + sz * 0.002, 'rune', [0, 0, sz], true);
    K.medallion(0, Y0 + 0.2, face(sz)(0, Y0 + 0.2) - sz * 0.004, sz, 0.105, 0.078);
  }
  const tris = trisOf(G).length;
  if (enchanted) for (const sz of [1, -1]) {
    glowDisc([0, h.PT / 2, sz * 0.2], 0.3, 0.45, [0, 0, sz]);
    glowLine(LINE, 0.1, (x, y) => face(sz)(x, y) + sz * 0.006, 0.4, [0, 0, sz]);
    glowDisc([0, Y0 + 0.2, face(sz)(0, Y0 + 0.2) + sz * 0.03], 0.24, 0.5, [0, 0, sz]);
  }
  // the contact: the +x edge's middle
  const cy = Y0 + 0.62, ce = (() => { for (let j = 0; j + 1 < HALF.length; j++) { const [x0, y0] = HALF[j], [x1, y1] = HALF[j + 1]; if (cy >= y0 && cy <= y1) return x0 + (x1 - x0) * (cy - y0) / (y1 - y0); } return 0; })();
  return { tris, L: TIPY, lead: 0.72, radius: 0.15, contact: [ce, cy, ZB], parts: 'pommel, collar, handle, ferrule, neck, blade' };
}

/* ---- the file: a long flat bar cut in slanting rows of teeth, its narrow toothed edge leading along +x ------------- */
function file(K) {
  const { G, P, F, ring, loft, cap, diamond, glowDisc, enchanted } = K;
  const h = handle(K, { r0: 0.13, swell: 0.14, r1: 0.125, top: 1.04, zk: 0.92, pommel: 0.17 });
  cap({ r: h.last.r }, 'goldD', [0, 1, 0]);
  const bodyFrom = G.F.length;
  // a box section (its faces: 0 +x, 1 -z, 2 -x, 3 +z), its rows slanted across the width so the cuts run diagonally
  const HX = 0.115, HZ = 0.05, Y0 = h.top, H1 = Y0 + 0.3, TIP = 2.86;
  const box = (y, k = 1, kz = 1, slant = 0) => ({ y, r: [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => P(a * HX * k, y + slant * a, b * HZ * kz)) });
  const join = (rows, mat) => { for (let i = 0; i + 1 < rows.length; i++) for (let j = 0; j < 4; j++) { const a = rows[i], b = rows[i + 1]; F([a.r[j], a.r[(j + 1) % 4], b.r[(j + 1) % 4], b.r[j]], mat(i, j), { from: [0, (a.y + b.y) / 2, 0] }); } };
  // the shoulder off the ferrule and the smooth heel (its runes)
  const sh = [box(Y0, 0.5, 0.7), box(Y0 + 0.06), box(H1)];
  F([...sh[0].r], 'stoneB', [0, -1, 0]);
  join(sh, (i, j) => (i === 0 ? 'bevel' : j % 2 ? 'stone' : 'stoneL'));
  // the rows of teeth, the faces alternating tones a row; tapering over its last third
  const ROWS = 8, T0 = TIP - 0.62, rows = [sh[2]];
  for (let i = 1; i <= ROWS; i++) {
    const y = H1 + (TIP - 0.04 - H1) * i / ROWS, k = y < T0 ? 1 : 1 - 0.55 * (y - T0) / (TIP - T0), kz = y < T0 ? 1 : 1 - 0.35 * (y - T0) / (TIP - T0);
    rows.push(box(y, k, kz, i < ROWS ? 0.055 : 0));
  }
  join(rows, (i, j) => (j % 2 ? (i % 2 ? 'stoneB' : 'stone') : (i % 2 ? 'bevel' : 'stoneL')));
  const tipR = box(TIP, 0.4, 0.55);
  join([rows[ROWS], tipR], () => 'bevel');
  F([...tipR.r], 'stoneB', [0, 1, 0]);
  metalFaces(G, [[bodyFrom, G.F.length]], METAL);
  // the heel's runes: a diamond on each broad face
  for (const sz of [1, -1]) K.medallion(0, (Y0 + 0.05 + H1) / 2 + 0.01, sz * HZ, sz, 0.09, 0.068);
  const tris = trisOf(G).length;
  if (enchanted) for (const sz of [1, -1]) {
    glowDisc([0, h.PT / 2, sz * 0.2], 0.3, 0.45, [0, 0, sz]);
    glowDisc([0, (Y0 + 0.05 + H1) / 2 + 0.01, sz * (HZ + 0.03)], 0.22, 0.5, [0, 0, sz]);
  }
  const cy = (H1 + T0) / 2;
  return { tris, L: TIP, lead: 0.69, radius: 0.135, contact: [HX, cy, 0], parts: 'pommel, collar, handle, ferrule, heel, toothed body, tip' };
}

/* ---- the whetstone: a veined stone bar, gold-banded, its honing face leading along +x ------------------------------- */
function whetstone(K) {
  const { G, P, F, ring, loft, cap, strip, medallion, runeStar, glowDisc, enchanted } = K;
  const HX = 0.18, HZ = 0.12, C = 0.045, L = 1.86, ZK = HZ / HX;
  const sec = (y, k = 1) => ring(y, HX * k, HZ * k, C * k);
  // the foot: a gold cap and band; the bar; the gold band over the fist; the bar; the top's gold cap
  const goldBand = (y0, y1) => {
    const g = [sec(y0, 1), sec(y0, 1.1), sec(y1, 1.1), sec(y1, 1)];
    loft(g, (i) => (i === 1 ? 'gold' : 'goldD'));
  };
  const foot = [sec(0, 0.82), sec(0.035, 1.1), sec(0.12, 1.1), sec(0.12, 1)];
  cap(foot[0], 'goldD', [0, -1, 0]);
  loft(foot, (i) => (i === 0 ? 'goldD' : i === 1 ? 'gold' : 'goldD'));
  const B0 = 0.12, BAND = [0.98, 1.07], T0 = L - 0.12;
  const barMat = (i, j) => (j === FACE.px ? 'stoneL' : j === FACE.nx ? 'stoneB' : j % 2 ? 'stone' : 'bevel');
  loft([sec(B0), sec(BAND[0])], (i, j) => barMat(i, j));
  goldBand(...BAND);
  loft([sec(BAND[1]), sec(T0)], (i, j) => barMat(i, j));
  const top = [sec(T0, 1), sec(T0, 1.1), sec(L - 0.035, 1.1), sec(L, 0.82)];
  loft(top, (i) => (i === 1 ? 'gold' : 'goldD'));
  cap(top[3], 'goldD', [0, 1, 0]);
  // a gem on the top's cap (its end, seen from above)
  {
    const g = [...Array(8).keys()].map((j) => { const a = (j + 0.5) * Math.PI / 4; return P(0.07 * Math.cos(a), L + 0.006, 0.07 * ZK * 1.3 * Math.sin(a)); });
    F(g, 'gem', [0, 1, 0]);
  }
  // veins over the stone: the honing face and the broad faces
  const zFace = (sz) => () => sz * (HZ + 0.003);
  for (const sz of [1, -1]) {
    strip([[-0.12 * sz, 0.2], [-0.05 * sz, 0.42], [-0.11 * sz, 0.62], [-0.06 * sz, 0.85]], 0.012, zFace(sz), 'crack', [0, 0, sz]);
    strip([[0.1 * sz, 1.62], [0.05 * sz, 1.7], [0.1 * sz, 1.76]], 0.012, zFace(sz), 'crack', [0, 0, sz]);
  }
  {
    // on the +x face: x fixed, a path in (z, y)
    const pts = [[0.04, 1.15], [-0.03, 1.32], [0.02, 1.52], [-0.04, 1.7]];
    const L2 = [], R2 = [];
    pts.forEach(([z, y], j) => { L2.push(P(HX + 0.003, y, z - 0.006)); R2.push(P(HX + 0.003, y, z + 0.006)); void j; });
    for (let j = 0; j + 1 < pts.length; j++) F([L2[j], R2[j], R2[j + 1], L2[j + 1]], 'crack', [1, 0, 0]);
  }
  // the emblem on each broad face above the band: a gold-ringed medallion with a rune star round it, rune lines up and down
  const EM = 1.42;
  for (const sz of [1, -1]) {
    medallion(0, EM, sz * HZ, sz, 0.13, 0.1);
    strip([[0, EM + 0.17], [0, T0 - 0.05]], 0.026, zFace(sz), 'rune', [0, 0, sz], true);
    strip([[0, BAND[1] + 0.06], [0, EM - 0.17]], 0.026, zFace(sz), 'rune', [0, 0, sz], true);
  }
  void runeStar;
  const tris = trisOf(G).length;
  if (enchanted) for (const sz of [1, -1]) {
    glowDisc([0, EM, sz * (HZ + 0.03)], 0.34, 0.45, [0, 0, sz]);
    K.glowLine([[0, BAND[1] + 0.05], [0, T0 - 0.04]], 0.08, () => sz * (HZ + 0.008), 0.3, [0, 0, sz]);
  }
  return { tris, L, lead: 0.55, radius: 0.155, contact: [HX, (BAND[1] + T0) / 2, 0], parts: 'foot cap, bar, band, bar, top cap; medallions and rune lines on the broad faces' };
}

const BUILD = { awl, carving_knife: carvingKnife, trowel, file, whetstone };
/**
 * Drawn at game-prop scale, beside the work clip's mallet (3.87 long) and chisel (2.4): each built
 * at life size above, then scaled.
 */
export const SCALE = 1.35;

export function build(id, { enchanted = false } = {}) {
  const fn = BUILD[id];
  if (!fn) throw new Error(`finetools: no tool ${id}`);
  const K = kit(enchanted);
  const r = fn(K);
  const G = K.G, S = SCALE, sc = (v) => v.map((x) => x * S);
  for (let i = 0; i < G.V.length; i++) { if (G.A[i] === undefined) G.A[i] = 1; G.V[i] = sc(G.V[i]); }
  r.L *= S; r.lead *= S; r.radius *= S; r.contact = sc(r.contact);
  return {
    id, G, MATS: enchanted ? MATS_ENCHANTED : MATS_PLAIN, L: r.L, tris: r.tris, all: trisOf(G).length, parts: r.parts,
    // the fist point (the hand socket's o) and the handle's radius there; one-handed, so second is the same point
    grip: { axis: [0, 1, 0], lead: [0, r.lead, 0], second: [0, r.lead, 0], radius: r.radius, edge: [1, 0, 0], face: [0, 0, 1], from: 0.3 * S, to: r.lead + 0.5 * S },
    // the fist closed round the handle across the finger roots (as the mallet's)
    fit: { backMax: 0.3 },
    contact: r.contact,
    ends: [r.contact],
  };
}

/* ---- the game's copies: node tools/sculpt/gear/finetools.mjs [ids...] [--out <dir>] ------------------------------- */
export async function writeAsset(id, outDir) {
  const { writeFileSync } = await import('node:fs');
  const { resolve, join } = await import('node:path');
  const { gearAsset } = await import('../lowgear.mjs');
  const { buildRig } = await import('../lowrig.mjs');
  const dir = resolve(outDir ?? new URL('../../../src/sculpt/assets', import.meta.url).pathname);
  const plain = build(id), lit = build(id, { enchanted: true });
  const a = await gearAsset(id, plain, lit, { male: buildRig('male'), female: buildRig('female') });
  const r5 = (x) => +x.toFixed(5);
  a.units = "game units; its own frame: y along the handle from the butt (0) toward the working end (toward the thumb of the fist that holds it), x the way the blow goes (along the hand toward the knuckles: the edge or working face looks down +x), z = x × y";
  // the point that meets the work (the work clip, src/sculpt/anim/clips/work.ts): the tip, the edge's middle, the face's middle
  a.contact = plain.contact.map(r5);
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
  for (const id of ids.length ? ids : TOOL_IDS) await writeAsset(id, at < 0 ? undefined : args[at + 1]);
}
