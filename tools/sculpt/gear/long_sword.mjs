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

import { meshOf, trisOf, gameNumbers, metalFaces, metalMats } from '../lowgear.mjs';

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
  engrave: { c: '#93889f' },
  core: { c: '#c9b28a' },
  gem: { c: '#d4b47a' },
  glow: { c: '#ff9a35', glow: 1 },
};
/** The blade's stone, drawn in the metal it is smithed from (`metalFaces`): its faces, edge bevels, back, recessed panel and cracks. */
const METAL = ['stone', 'stoneL', 'stoneB', 'bevel', 'crack', 'panel'];
Object.assign(MATS_PLAIN, metalMats(MATS_PLAIN, METAL));
export const MATS_ENCHANTED = {
  ...MATS_PLAIN,
  wall: { c: '#ffc46a', emit: true },
  engrave: { c: '#ffb347', emit: true },
  core: { c: '#fff6d8', emit: true },
  gem: { c: '#ffe7a6', emit: true },
};

/**
 * The sheet's heights as built (`buildLongSword`'s `form`): the grip (199 to 400 px) drawn `grip` as long, the blade above
 * the guard's spurs (575 px on) `blade` as long, the pommel and the guard `hilt` as long, everything across and through
 * `wide` as wide. The
 * long sword's is the sheet's own; the one-handed swords (tools/sculpt/gear/blades.mjs) shorten both.
 */
const SHEET = { hilt: 1, grip: 1, blade: 1, wide: 1 };
const G0 = 199, G1 = 400, B0 = 575;
const heightOf = (f) => {
  const h = f.hilt ?? 1, a = G0 * h, b = a + (G1 - G0) * f.grip, c = b + (B0 - G1) * h;
  return (u) => (u <= G0 ? u * h : u <= G1 ? a + (u - G0) * f.grip : u <= B0 ? b + (u - G1) * h : c + (u - B0) * f.blade);
};

export function buildLongSword({ enchanted = false, length, form = SHEET, k: px, motif = 'full' } = {}) {
  if (!(length > 0) && !(px > 0)) throw new Error('buildLongSword: the length (swordLength())');
  const G = meshOf();
  G.A = [];
  const k = px ?? length / SHEET_L, U = heightOf(form), wk = form.wide;
  if (!(length > 0)) length = U(SHEET_L) * k;
  /** A sheet point (x, u, z px) in its frame. */
  const S = (x, u, z) => [x * k * wk, U(u) * k, z * k * wk];
  const P = (x, u, z, a) => { const i = G.p(S(x, u, z)); if (a !== undefined) G.A[i] = a; return i; };
  const F = (v, mat, out) => {
    const w = v.filter((x, j) => x !== v[(j + 1) % v.length]);
    if (w.length >= 3) G.f(w, mat, out && (out.fromG ? { from: out.fromG } : out.from ? { from: S(...out.from) } : out));
  };
  /** An engraved ring's height in px for its width r, so it is drawn round however the blade is shortened. */
  const round = (r) => (r * wk) / form.blade;
  const FRONT = [0, 0, 1], BACK = [0, 0, -1];
  const glowOn = enchanted;

  /* ---- the blade ------------------------------------------------------------------------------------------------ */
  const bladeFrom = G.F.length;
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

  // (the blade's stone in the metal it is smithed from; its gold wall, engraving and guard their own)
  metalFaces(G, [[bladeFrom, G.F.length]], METAL);

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
  // (a short blade, `motif` 'short': the orb's two inner rings and the ray, the centre line and the stars; every ring drawn
  // round however the blade is shortened, `round`)
  const Fo = motif === 'short' ? [20, 760] : [33, 851], Go = [46, 1060];
  arc(...Fo, 12, round(12), 45); arc(...Fo, 23, round(23), 36);
  if (motif !== 'short') {
    for (const r of [37, 52, 68]) arc(...Fo, r, round(r) * (1 + (r - 30) / 100), 30);
    arc(...Fo, 88, round(125), 26);
    for (const r of [24, 42, 62]) arc(...Go, r, round(r) * 1.6, 30);
    arc(118, 1010, 170, round(170), 20);
  }
  // the ray left of the orb, and the centre line up from the guard
  F([P(-30, Fo[1] - 1.6 / form.blade, zE), P(Fo[0] - 18, Fo[1] - 1.6 / form.blade, zE), P(Fo[0] - 18, Fo[1] + 1.6 / form.blade, zE), P(-30, Fo[1] + 1.6 / form.blade, zE)], 'engrave', FRONT);
  F([P(-9, 575, zE), P(9, 575, zE), P(0, motif === 'short' ? 575 + (Fo[1] - 575) * 0.62 : 777, zE)], 'engrave', FRONT);
  // stars: two crossed diamonds each
  const star = (x, u, s) => {
    const t = s * 0.22, su = round(s), tu = round(t);
    F([P(x, u - su, zE + 0.2), P(x + t, u, zE + 0.2), P(x, u + su, zE + 0.2), P(x - t, u, zE + 0.2)], 'engrave', FRONT);
    F([P(x - s, u, zE + 0.3), P(x, u - tu, zE + 0.3), P(x + s, u, zE + 0.3), P(x, u + tu, zE + 0.3)], 'engrave', FRONT);
  };
  if (motif === 'short') { star(-2, 1230, 11); star(-20, 1060, 8.5); }
  else { star(-1, 1299, 11); star(21, 1279, 8.5); star(-23, 1249, 7.5); }

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
      F([a[j], a[(j + 1) % 6], b[(j + 1) % 6], b[j]], typeof mats === 'function' ? mats(i, j) : mats, { fromG: [0, (G.V[a[j]][1] + G.V[b[j]][1]) / 2, 0] });
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
      const from = { fromG: [0, (G.V[a[j]][1] + G.V[b[j]][1]) / 2, 0] }, j1 = (j + 1) % 6;
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
    // the panel warmed by the lit lines
    F(full(PE).map(([x, u]) => P(x, u, zE + 0.8, 0.16)), 'glow', FRONT);
  }
  for (let i = 0; i < G.V.length; i++) if (G.A[i] === undefined) G.A[i] = 1;

  return {
    G, MATS: enchanted ? MATS_ENCHANTED : MATS_PLAIN, L: length, k, tris, all: trisOf(G).length,
    // the grip, in its frame (game units): the haft's axis (toward the point), where the leading hand's fist closes (just
    // below the guard's collar) and the second hand's (a hand's breadth lower, toward the pommel), the grip's radius, and
    // which way the edges and the engraved face lie (the edges along the hand's length, knuckles to wrist: the socket's x;
    // the engraved face out of the back of the right hand: the socket's z)
    grip: { axis: [0, 1, 0], lead: [0, U(372) * k, 0], second: [0, U(292) * k, 0], radius: 21.5 * k * wk, edge: [1, 0, 0], face: [0, 0, 1], from: U(199) * k, to: U(400) * k },
    grips: { main: [0, U(372) * k, 0], off: [0, U(292) * k, 0] },
    gripR: 21.5 * k * wk,
    halfWidth: 86 * k * wk,
    // two-handed: carried on the back while it is not in hand (lowgear.mjs backSocketOf)
    back: true,
  };
}

/* ---- the game's copy: node tools/sculpt/gear/long_sword.mjs [--out src/sculpt/assets/long_sword.json] ------------------- */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const { buildRig } = await import('../lowrig.mjs');
  const { gearAsset } = await import('../lowgear.mjs');
  const args = process.argv.slice(2), at = args.indexOf('--out');
  const out = resolve(at < 0 ? new URL('../../../src/sculpt/assets/long_sword.json', import.meta.url).pathname : args[at + 1]);
  const L = await swordLength();
  const asset = await gearAsset('long_sword', buildLongSword({ length: L }), buildLongSword({ length: L, enchanted: true }), { male: buildRig('male'), female: buildRig('female') });
  writeFileSync(out, JSON.stringify(asset));
  console.log(`wrote ${out}: ${asset.counts.tris} triangles (${asset.counts.glowTris} more of glow), ${L.toFixed(4)} game units`);
}
