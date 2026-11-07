// The long sword (src/game/gear.ts long_sword, "Long sword"): the "Sunarc Greatsword" of tools/sculpt/ref/long-sword-sunarc.png,
// low-poly for the low-poly bodies (tools/sculpt/lowgear.mjs).
//
//   buildLongSword({ enchanted, length }) -> { G (meshOf: V, F with a material each, A: glow alpha per point), MATS, L,
//   grips: { main, off } (where the fists close, in its frame), tris (the count, the glow's apart) }
//
// Its frame, game units: y along it from the pommel's point (0) to the blade's point (L), x across the blade's flat (the
// sheet's front view: x to the right), z out of the front (the engraved panel's side). Laid out in the sheet's own pixels
// (the hero view: the point at y 15, the pommel's point at y 1484, so 1469 px long; X from the blade's centre line,
// U up from the pommel's point) and scaled to L. L: her standing height in game (see LENGTH), the user's measure.
//
// Parts, from the point down: the blade (an edge bevel, a raised border, a gold wall down into a recessed panel, a
// gothic-arch point; the back plain stone inside the border), the engraving on the panel (the centre line from the guard,
// arcs round two points, rings round the lower, four stars by the point), the guard (a round housing with a gold rim and
// the core, two horns swept down with a spur on each, gold diamonds above and below), the collar, the leather grip (a
// six-sided antiprism, its facets in two tones: the wrap's cross-hatch), the lower collar, the pommel (six-sided, pointed,
// a gold-rimmed gem on each face). Enchanted: the engraving, the panel's wall, the core and the gem lit (unlit, full
// bright), and glow added round the blade, the core, the lower ring's point and the gem.

import { meshOf, trisOf, gameNumbers } from '../lowgear.mjs';

/** Its length, game units: as long as the woman is tall in the game (sole to crown: the base man's height, WOMAN_OF_MAN of it). */
export async function swordLength() { const g = await gameNumbers(); return g.man * g.womanOfMan; }

/** The sheet's hero view, px: its length tip to pommel. */
const SHEET_L = 1469;

export const MATS_PLAIN = {
  stone: { c: '#dcc8bd', vary: 0.035 },
  stoneL: { c: '#e6d5ca', vary: 0.03 },
  stoneB: { c: '#d6c2b8', vary: 0.035 },
  bevel: { c: '#c0a59a', vary: 0.03 },
  crack: { c: '#b09489' },
  gold: { c: '#d49a4f' },
  wall: { c: '#cc9550' },
  leather: { c: '#8f746b' },
  leather2: { c: '#7a6159' },
  panel: { c: '#aca0b9' },
  engrave: { c: '#8a7f99' },
  core: { c: '#c9b28a' },
  gem: { c: '#d4b47a' },
  glow: { c: '#ff9a35', glow: 1 },
};
export const MATS_ENCHANTED = {
  ...MATS_PLAIN,
  wall: { c: '#ffc46a', emit: true },
  engrave: { c: '#ffd583', emit: true },
  core: { c: '#fff6d8', emit: true },
  gem: { c: '#ffe7a6', emit: true },
};

export function buildLongSword({ enchanted = false, length } = {}) {
  if (!(length > 0)) throw new Error('buildLongSword: the length (swordLength())');
  const G = meshOf();
  G.A = [];
  const k = length / SHEET_L;
  const P = (x, u, z, a) => { const i = G.p([x * k, u * k, z * k]); if (a !== undefined) G.A[i] = a; return i; };
  const F = (v, mat, out) => {
    const w = v.filter((x, j) => x !== v[(j + 1) % v.length]);
    if (w.length >= 3) G.f(w, mat, out && (out.from ? { from: out.from.map((q) => q * k) } : out));
  };
  const FRONT = [0, 0, 1], BACK = [0, 0, -1];
  const glowOn = enchanted;

  /* ---- the blade ------------------------------------------------------------------------------------------------ */
  const Ub = 520;
  // contours, the right half from the guard to the point: the edge (E), the bevel's top (BO), the border's inner edge (BI),
  // the panel's edge (PE); the blade a little wider than the hero view's (156 px to its 144, between it and the small views')
  const E = [[86, Ub], [86, 575], [78, 595], [78, 1334], [48, 1404], [0, 1469]];
  const BO = [[72, Ub], [72, 577], [64, 599], [64, 1334], [39, 1393], [0, 1438]];
  const BI = [[54, Ub], [54, 577], [54, 599], [54, 1334], [36, 1371], [0, 1400]];
  const PE = [[48, Ub], [48, 577], [48, 599], [48, 1334], [30, 1365], [0, 1387]];
  const full = (c) => [...c, ...c.slice(0, -1).reverse().map(([x, u]) => [-x, u])];
  const ring = (c, z, zApex = z) => full(c).map(([x, u], j) => P(x, u, j === c.length - 1 ? zApex : z));
  const strip = (A, B, mat, out) => { for (let j = 0; j + 1 < A.length; j++) F([A[j], A[j + 1], B[j + 1], B[j]], mat, out); };
  const eF = ring(E, 5, 0), eB = full(E).map(([x, u], j) => (j === E.length - 1 ? eF[j] : P(x, u, -5)));
  const boF = ring(BO, 18), biF = ring(BI, 18), peF = ring(PE, 13), boB = ring(BO, -18);
  strip(eF, boF, 'bevel', FRONT); strip(boF, biF, 'stone', FRONT); strip(biF, peF, 'wall', FRONT); F(peF, 'panel', FRONT);
  strip(eB, boB, 'bevel', BACK); F(boB, 'stoneB', BACK);
  // hairline cracks across the back, a little darker: jagged lines from edge to edge of the border's inside
  const crack = (pts) => { for (let j = 0; j + 1 < pts.length; j++) { const [x0, u0] = pts[j], [x1, u1] = pts[j + 1], l = Math.hypot(x1 - x0, u1 - u0), nx = -(u1 - u0) / l * 1.3, nu = (x1 - x0) / l * 1.3; F([P(x0 - nx, u0 - nu, -18.4), P(x0 + nx, u0 + nu, -18.4), P(x1 + nx, u1 + nu, -18.4), P(x1 - nx, u1 - nu, -18.4)], 'crack', BACK); } };
  crack([[-60, 700], [-25, 742], [8, 731], [58, 790]]);
  crack([[60, 930], [22, 975], [-14, 968], [-58, 1018]]);
  crack([[-60, 1150], [-30, 1176], [14, 1205], [40, 1196]]);
  crack([[-34, 1300], [-6, 1322], [26, 1345]]);
  const fe = full(E);
  for (let j = 0; j + 1 < eF.length; j++) F([eF[j], eF[j + 1], eB[j + 1], eB[j]], 'bevel', { from: [0, (fe[j][1] + fe[j + 1][1]) / 2, 0] });

  /* ---- the engraving ------------------------------------------------------------------------------------------- */
  const zE = 13.7, wl = 5.5;
  const panelHalf = (u) => (u <= 1334 ? 48 : u <= 1365 ? 48 + (30 - 48) * (u - 1334) / 31 : Math.max(0, 30 * (1387 - u) / 22));
  const inside = (x, u) => u >= 592 && Math.abs(x) <= panelHalf(u) - 5;
  const DEG = Math.PI / 180;
  /** A line round (cx, cu) at radius r (q up the blade), kept to the panel, its pieces cut into segments of at most `seg` degrees. */
  const arc = (cx, cu, r, q = r, seg = 36) => {
    const ok = (a) => inside(cx + r * Math.cos(a * DEG), cu + q * Math.sin(a * DEG));
    const runs = [];
    let start = null;
    // start the sweep where it is outside, so a run is not split at 0
    let a0 = 0; for (let a = 0; a < 360; a++) if (!ok(a)) { a0 = a; break; }
    const whole = [...Array(361).keys()].every((a) => ok(a));
    if (whole) runs.push([0, 360]);
    else for (let s = 0; s <= 360; s++) { const a = a0 + s, o = ok(a); if (o && start === null) start = a; if ((!o || s === 360) && start !== null) { runs.push([start, a - 1]); start = null; } }
    for (const [lo, hi] of runs) {
      if (hi - lo < 6) continue;
      const n = Math.max(1, Math.ceil((hi - lo) / seg)), pts = [];
      const closed = hi - lo >= 360;
      for (let j = 0; j <= (closed ? n - 1 : n); j++) {
        const a = (lo + (hi - lo) * j / n) * DEG, c = Math.cos(a), s = Math.sin(a);
        pts.push([P(cx + (r - wl / 2) * c, cu + (q - wl / 2) * s, zE), P(cx + (r + wl / 2) * c, cu + (q + wl / 2) * s, zE)]);
      }
      for (let j = 0; j < (closed ? pts.length : pts.length - 1); j++) { const a = pts[j], b = pts[(j + 1) % pts.length]; F([a[0], b[0], b[1], a[1]], 'engrave', FRONT); }
    }
  };
  // the motif: nested rings and arcs round the orb on the panel's right (the outer ones taller than wide, as the sheet draws
  // them, the outermost cut by the panel's left edge so it sweeps up toward the point and down toward the guard), three
  // arcs round a point on the right edge above, one long arc across from the upper right down the left
  const Fo = [33, 851], Go = [46, 1060];
  arc(...Fo, 12, 12, 45); arc(...Fo, 23, 23, 36);
  for (const r of [37, 52, 68]) arc(...Fo, r, r * (1 + (r - 30) / 100), 30);
  arc(...Fo, 88, 125, 26);
  for (const r of [24, 42, 62]) arc(...Go, r, r * 1.6, 30);
  arc(118, 1010, 170, 170, 20);
  // the ray left of the orb, and the centre line up from the guard
  F([P(-30, 851 - 1.6, zE), P(Fo[0] - 18, 851 - 1.6, zE), P(Fo[0] - 18, 851 + 1.6, zE), P(-30, 851 + 1.6, zE)], 'engrave', FRONT);
  F([P(-9, 575, zE), P(9, 575, zE), P(0, 777, zE)], 'engrave', FRONT);
  // stars: two crossed diamonds each
  const star = (x, u, s) => {
    const t = s * 0.22;
    F([P(x, u - s, zE + 0.2), P(x + t, u, zE + 0.2), P(x, u + s, zE + 0.2), P(x - t, u, zE + 0.2)], 'engrave', FRONT);
    F([P(x - s, u, zE + 0.3), P(x, u - t, zE + 0.3), P(x + s, u, zE + 0.3), P(x, u + t, zE + 0.3)], 'engrave', FRONT);
  };
  star(-1, 1299, 11); star(21, 1279, 8.5); star(-23, 1249, 7.5);

  /* ---- the guard: housing, horns, spurs --------------------------------------------------------------------------- */
  const C = [0, 505], NH = 10;
  const hring = (r, z, a = undefined) => [...Array(NH).keys()].map((j) => { const t = (90 + j * 360 / NH) * DEG; return P(C[0] + r * Math.cos(t), C[1] + r * Math.sin(t), z, a); });
  for (const sz of [1, -1]) {
    const out = sz > 0 ? FRONT : BACK;
    const r0 = hring(47, 16 * sz), r1 = hring(31, 25 * sz), r2 = hring(24, 23 * sz), c0 = P(C[0], C[1], 29 * sz);
    const loop = (A, B, mat) => { for (let j = 0; j < NH; j++) F([A[j], A[(j + 1) % NH], B[(j + 1) % NH], B[j]], mat, out); };
    loop(r0, r1, 'stoneL'); loop(r1, r2, 'gold');
    for (let j = 0; j < NH; j++) F([r2[j], r2[(j + 1) % NH], c0], 'core', out);
    if (sz > 0) G.wallF = r0; else G.wallB = r0;
  }
  for (let j = 0; j < NH; j++) F([G.wallF[j], G.wallF[(j + 1) % NH], G.wallB[(j + 1) % NH], G.wallB[j]], 'stone', { from: [C[0], C[1], 0] });
  delete G.wallF; delete G.wallB;
  for (const sx of [-1, 1]) {
    // the top edge out from the housing and round the outer corner down to the tip; the inner edge arched up from under the
    // housing and down to the tip (the sheet's guard, measured)
    const A = [[40, 525], [66, 530], [92, 529], [116, 525], [133, 512], [140, 491], [118, 461]];
    const B = [[34, 482], [44, 497], [62, 505], [83, 501], [98, 493], [108, 481], [118, 461]];
    // a slab: its face flat, a chamfer along the top and round the outer edge down to the tip (A to A2), the inner curve
    // square (B)
    const n = A.length - 1;
    const A2 = A.map((a, j) => (j === n ? a : [a[0] + (B[j][0] - a[0]) * 0.3, a[1] + (B[j][1] - a[1]) * 0.3]));
    const M = A.map((a, j) => [(a[0] + B[j][0]) / 2, (a[1] + B[j][1]) / 2]);
    const side = {};
    for (const sz of [1, -1]) {
      const out = sz > 0 ? FRONT : BACK;
      const a = A.map(([x, u], j) => P(sx * x, u, (j === n ? 11 : 8) * sz));
      const a2 = A2.map(([x, u], j) => (j === n ? a[n] : P(sx * x, u, 15 * sz)));
      const b = B.map(([x, u], j) => (j === n ? a[n] : P(sx * x, u, 15 * sz)));
      for (let j = 0; j < n; j++) F([a[j], a[j + 1], a2[j + 1], a2[j]], 'stoneL', out);
      F([...a2.slice(0, n), a[n], ...b.slice(0, n).reverse()], 'stone', out);
      side[sz] = { a, b };
    }
    for (let j = 0; j < n; j++) {
      const from = [sx * M[j][0], M[j][1], 0];
      F([side[1].a[j], side[1].a[j + 1], side[-1].a[j + 1], side[-1].a[j]], 'stoneL', { from });
      if (j < n - 1) F([side[1].b[j], side[1].b[j + 1], side[-1].b[j + 1], side[-1].b[j]], 'bevel', { from });
      else F([side[1].b[n - 1], side[1].a[n], side[-1].a[n], side[-1].b[n - 1]], 'bevel', { from });
    }
    // the spur on the horn's top
    const S = [[116, 524], [97, 549], [88, 526]];
    const sf = S.map(([x, u]) => P(sx * x, u, 9)), sb = S.map(([x, u]) => P(sx * x, u, -9));
    F(sf, 'stoneL', FRONT); F(sb, 'stoneL', BACK);
    for (const j of [0, 1]) F([sf[j], sf[j + 1], sb[j + 1], sb[j]], 'bevel', { from: [sx * 102, 530, 0] });
  }

  /* ---- the hilt: neck, collar, grip, lower collar, pommel: six-sided rings round y ----------------------------------- */
  const ZK = 0.8;
  const hex = (u, r, ph = 0) => [...Array(6).keys()].map((j) => { const t = (ph + j * 60) * DEG; return P(r * Math.cos(t), u, ZK * r * Math.sin(t)); });
  const loft = (rings, mats) => {
    for (let i = 0; i + 1 < rings.length; i++) for (let j = 0; j < 6; j++) {
      const a = rings[i], b = rings[i + 1];
      F([a[j], a[(j + 1) % 6], b[(j + 1) % 6], b[j]], typeof mats === 'function' ? mats(i, j) : mats, { from: [0, (G.V[a[j]][1] + G.V[b[j]][1]) / 2 / k, 0] });
    }
  };
  const upper = [[456, 21], [441, 33], [429, 32], [425, 25], [400, 21.5]].map(([u, r]) => hex(u, r));
  loft(upper, (i) => (i === 2 ? 'gold' : 'stone'));
  // the grip: six-sided, its facets cut corner to corner in a checker (one diagonal, then the other), so the cuts run on
  // round the grip as the wrap's cross-hatch, the diamonds between them in two tones a row
  const NB = 7, g0 = 400, g1 = 199;
  const gr = [...Array(NB + 1).keys()].map((i) => (i === 0 ? upper[upper.length - 1] : hex(g0 + (g1 - g0) * i / NB, 21.5)));
  for (let i = 0; i < NB; i++) {
    const a = gr[i], b = gr[i + 1];
    for (let j = 0; j < 6; j++) {
      const from = { from: [0, (G.V[a[j]][1] + G.V[b[j]][1]) / 2 / k, 0] }, j1 = (j + 1) % 6;
      // a cut's halves belong to the diamonds round its two free corners: a diamond a row of the grip's rings, its tone
      // the row's
      const up = i % 2 ? 'leather2' : 'leather', down = i % 2 ? 'leather' : 'leather2';
      if ((i + j) % 2) { F([a[j], a[j1], b[j1]], up, from); F([a[j], b[j1], b[j]], down, from); }
      else { F([a[j], a[j1], b[j]], up, from); F([a[j1], b[j1], b[j]], down, from); }
    }
  }
  const lowerRings = [gr[NB], ...[[185, 24.5], [181, 30], [162, 30], [154, 33], [118, 42]].map(([u, r]) => hex(u, r))];
  loft(lowerRings, (i) => (i === 1 || i === 3 ? 'gold' : 'stone'));
  const tip = P(0, 0, 0), last = lowerRings[lowerRings.length - 1];
  for (let j = 0; j < 6; j++) F([last[j], last[(j + 1) % 6], tip], 'stone', { from: [0, 60, 0] });

  /* ---- gold diamonds, front and back; the pommel's gem ---------------------------------------------------------- */
  const diamond = (x, u, h, w, z, dz, sz, mat = 'gold') => {
    const t = P(x, u + h, z * sz), r = P(x + w, u, z * sz), b = P(x, u - h, z * sz), l = P(x - w, u, z * sz), c = P(x, u, (z + dz) * sz);
    const out = sz > 0 ? FRONT : BACK;
    F([t, r, c], mat, out); F([r, b, c], mat, out); F([b, l, c], mat, out); F([l, t, c], mat, out);
  };
  for (const sz of [1, -1]) {
    diamond(0, 558, 19, 9, 25, 5, sz);
    if (sz > 0) {
      diamond(0, 463, 10, 7, 16, 4, sz);
      diamond(0, 434, 10, 7, 22, 4, sz);
      diamond(0, 414, 6.5, 5, 17, 3, sz);
      diamond(0, 172, 8.5, 6, 21, 3.5, sz);
    }
    // the gem: a gold-rimmed kite on the pommel's face
    const zAt = (u) => (u >= 118 ? 22.9 + (29.1 - 22.9) * (154 - u) / 36 : 29.1 * u / 118) + 1.2;
    const o = [[0, 154], [-20, 117], [0, 78], [20, 117]], i = [[0, 145], [-14, 117], [0, 88], [14, 117]];
    const po = o.map(([x, u]) => P(x, u, zAt(u) * sz)), pi = i.map(([x, u]) => P(x, u, (zAt(u) + 1.5) * sz));
    const out = sz > 0 ? FRONT : BACK;
    for (let j = 0; j < 4; j++) F([po[j], po[(j + 1) % 4], pi[(j + 1) % 4], pi[j]], 'gold', out);
    F([pi[0], pi[1], pi[2]], 'gem', out); F([pi[0], pi[2], pi[3]], 'gem', out);
  }

  const tris = trisOf(G).length;

  /* ---- the glow, enchanted: added over the rest, its corners' alpha falling to nothing ------------------------------ */
  if (glowOn) {
    // round the blade, in its plane
    const inner = full(E).map(([x, u]) => P(x, u, 0, 0.26));
    const outer = full(E).map(([x, u], j, arr) => {
      const n = arr.length, a = arr[Math.max(0, j - 1)], b = arr[Math.min(n - 1, j + 1)];
      let d = [-(b[1] - a[1]), b[0] - a[0]]; const l = Math.hypot(...d) || 1; d = [d[0] / l, d[1] / l];
      if (d[0] * x < 0 || (x === 0 && d[1] < 0)) d = [-d[0], -d[1]];
      return P(x + d[0] * 48, u + d[1] * 48, 0, 0);
    });
    for (let j = 0; j + 1 < inner.length; j++) F([inner[j], inner[j + 1], outer[j + 1], outer[j]], 'glow', FRONT);
    const disc = (cx, cu, z, r, a, n = 10) => { const c = P(cx, cu, z, a), rim = [...Array(n).keys()].map((j) => P(cx + r * Math.cos(j * 2 * Math.PI / n), cu + r * Math.sin(j * 2 * Math.PI / n), z, 0)); for (let j = 0; j < n; j++) F([c, rim[j], rim[(j + 1) % n]], 'glow', z >= 0 ? FRONT : BACK); };
    for (const sz of [1, -1]) { disc(C[0], C[1], 31 * sz, 85, 0.6); disc(0, 116, 33 * sz, 40, 0.55); }
    disc(Fo[0], Fo[1], zE + 1, 42, 0.8);
  }
  for (let i = 0; i < G.V.length; i++) if (G.A[i] === undefined) G.A[i] = 1;

  return {
    G, MATS: enchanted ? MATS_ENCHANTED : MATS_PLAIN, L: length, k, tris, all: trisOf(G).length,
    // where the fists close (frame, game units): the main hand just under the collar, the off hand just over the lower one
    grips: { main: [0, 375 * k, 0], off: [0, 228 * k, 0] },
    gripR: 21.5 * k,
  };
}
