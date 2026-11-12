// The maul (src/game/gear.ts: 'maul', two-handed, swung overhead in a fight): the "Runestone Warhammer" of
// tools/sculpt/ref/warhammer-runestone.png, low-poly for the low-poly bodies (tools/sculpt/lowgear.mjs), built as the
// pickaxe is (tools/sculpt/gear/pickaxe.mjs).
//
//   buildWarhammer({ enchanted, length }) -> { G (meshOf: V, F with a material each, A: glow alpha per point), MATS, L,
//   grip, grips: { main, off }, tris (the count, the glow's apart), all, ends, haftDepth }
//
// Laid out in the sheet's own pixels, its orthographic front view (Front 0°: the haft upright, the emblem toward the
// viewer): X from the haft's centre line (x 472.5 of the sheet), U up from the pommel's foot (y 368), so the finial's top
// is U 269; Z out of the sheet toward the viewer, its depths from the side views (Side 90°, 270°) and the head's top view.
// Scaled to L.
//
// Its frame, game units: y along the haft from the pommel's foot (0) to the finial's top (L); x along the head (one
// hammer face leads in the overhead swing: the hand socket's x, along the hand toward the knuckles); z = x × y, out of the
// sheet's back face. So the sheet's front view is the view from -z (yaw 180), as the pickaxe's.
//
// Parts (the sheet's Exploded Components list, its views' shapes): (1) the one-piece head: two eight-sided hammer blocks,
// each with a gold band at its inner end and its face an inset octagon behind a bevel, a rune star on each face; the
// waisted stone necks to the hub; the hub, a post round the haft with gold corners, a gold-ringed emblem and its star on
// the front (a plain stone disc in the ring on the back), a gold finial over it; (2) the upper collar; a stone panel with
// a gold-framed rune inlay on its front and back; the middle collar; (3) the wooden haft, straight grained; (4) the lower
// collar; (5) the pommel, a faceted stone with a gold-ringed star medallion on both faces; (6) the pommel ring over it.
// Its length is about a body's height (0.91 of his, 1.07 of hers), as the sheet's scale figure stands it; its head's span
// is the views' (0.42 of its length). Where it leaves the sheet: under the wood, the pommel is 0.9 of its height and the
// lower collar shorter (33 px under the wood, the sheet's 40), so both fists close on bare wood with the pommel out of
// the jaw and the hips in the swing; the haft is turned 10° in the hands (GRIP_TILT).
// Enchanted: the face stars, the emblem's disc and star, the pommel's discs and stars and the panels' runes lit (unlit,
// full bright), and glow added round them.

import { meshOf, trisOf } from '../lowgear.mjs';
import { buildRig } from '../lowrig.mjs';

/** The sheet's front view, px: the pommel's foot to the finial's top. */
const SHEET_L = 269;
/** Degrees the haft is turned in the hands about the sockets' z (lowgear.mjs socketOf), the head toward the knuckles. */
export const GRIP_TILT = 10;
/** Its length, a share of the man's height (sole to crown, 16.5 game units): about a body's height, one size for both. */
export const OF_HEIGHT = 0.91;
export async function warhammerLength() {
  const { gameScale } = await import('../lowgear.mjs');
  return (await gameScale(buildRig('male'))).height * OF_HEIGHT;
}

export const MATS_PLAIN = {
  stone: { c: '#dabba9', vary: 0.035 },
  stoneL: { c: '#e6cbbb', vary: 0.03 },
  stoneB: { c: '#cba996', vary: 0.035 },
  bevel: { c: '#b8907f', vary: 0.03 },
  crack: { c: '#a98272' },
  gold: { c: '#d9a04f' },
  goldD: { c: '#b98238' },
  wood: { c: '#a8693f', vary: 0.03 },
  wood2: { c: '#935a36', vary: 0.03 },
  grain: { c: '#74401f' },
  panel: { c: '#d8b48e' },
  rune: { c: '#a8957f' },
  core: { c: '#d8c3a6' },
  star: { c: '#e2cfa4' },
  gem: { c: '#d4b47a' },
  glow: { c: '#ff7a22', glow: 1 },
};
export const MATS_ENCHANTED = {
  ...MATS_PLAIN,
  rune: { c: '#ff9430', emit: true },
  core: { c: '#ff8d36', emit: true },
  star: { c: '#fff1c4', emit: true },
  gem: { c: '#ff9a3c', emit: true },
};

export function buildWarhammer({ enchanted = false, length } = {}) {
  if (!(length > 0)) throw new Error('buildWarhammer: the length (warhammerLength())');
  const G = meshOf();
  G.A = [];
  const k = length / SHEET_L;
  // the sheet's X, U, Z to its frame: turned half round the haft (x = -X, z = -Z), scaled
  const P = (X, U, Z, a) => { const i = G.p([-X * k, U * k, -Z * k]); if (a !== undefined) G.A[i] = a; return i; };
  const D = (d) => [-d[0], d[1], -d[2]];
  const FROM = (X, U, Z) => ({ from: [-X * k, U * k, -Z * k] });
  const F = (v, mat, out) => {
    const w = v.filter((x, j) => x !== v[(j + 1) % v.length]);
    if (w.length >= 3) G.f(w, mat, out && (out.from ? out : D(out)));
  };
  const FRONT = [0, 0, 1], BACK = [0, 0, -1];
  const DEG = Math.PI / 180;
  // where the fists close: the second (left) on the bare wood just over the lower collar, the lead (right) a fist's
  // breadth over it (src/sculpt/lowpoly.ts secondOn keeps them apart): held by the end, so the pommel stands out of the
  // hands as little as it can (higher, it swings into his jaw at the swing's rest and into the hips at the impact). For
  // that the pommel is 0.9 of the sheet's height (U 0 to 25.7) and the lower collar under the wood 0.64 of it (to U 33,
  // where the wood begins): the sheet's 40 px under the wood is 33 here
  const LEAD = 66, SECOND = 42, PSC = 0.9, PTOP = 28.6 * PSC, W0 = 33, CU = (u) => PTOP + (u - 28.6) * (W0 - PTOP) / (40 - 28.6);

  /* ---- shapes ---------------------------------------------------------------------------------------------------- */
  /** An octagon round (a, b) of half sizes ha, hb, its corners cut ca along a and cb along b; corners from (+a, +b) round. */
  const oct2 = (a, b, ha, hb, ca, cb, caB = ca) => [[a + ha, b + hb - cb], [a + ha - ca, b + hb], [a - ha + caB, b + hb], [a - ha, b + hb - cb], [a - ha, b - hb + cb], [a - ha + caB, b - hb], [a + ha - ca, b - hb], [a + ha, b - hb + cb]];
  const oct = (a, b, ha, hb, c) => oct2(a, b, ha, hb, c, c);

  /* ---- the head's blocks and necks: eight-sided sections across U, Z, along X ------------------------------------- */
  const UC = 230.5;
  /** A ring across the head at X: half height hu, half depth hz, its corners cut cu, cz; (u, z) from the top front round. */
  const hring = (X, hu, hz, cu, cz, uc = UC, jit = null, cuB = cu) => oct2(uc, 0, hu, hz, cu, cz, cuB).map(([u, z], j) => P(X, u + (jit ? jit[j][0] : 0), z + (jit ? jit[j][1] : 0)));
  // (an octagon's facets in order: 0 top-front chamfer, 1 front, 2 foot-front chamfer, 3 foot, 4 foot-back chamfer,
  // 5 back, 6 top-back chamfer, 7 top)
  const SIDE_M = ['stoneL', 'stone', 'bevel', 'stoneB', 'bevel', 'stone', 'stoneL', 'stoneL'];
  const tube = (rings, mats, Xs) => {
    for (let i = 0; i + 1 < rings.length; i++) for (let j = 0; j < 8; j++) {
      const a = rings[i], b = rings[i + 1];
      F([a[j], a[(j + 1) % 8], b[(j + 1) % 8], b[j]], typeof mats === 'function' ? mats(i, j) : mats, FROM((Xs[i] + Xs[i + 1]) / 2, UC, 0));
    }
  };
  // the block: the band (X 29.5 to 37, a little proud), the body (to 46.5), the bevel in to the face (X 57)
  const BAND = [29.5, 37], BODY = 46.5, FACE = 57;
  const BH = 29.5, BZ = 23, BCU = 12, BCUB = 17, BCZ = 12, FH = 17.5, FZ = 13.5, FCU = 7, FCUB = 9.5, FCZ = 6.5;
  const faces = {};
  // the necks' corners nudged off true, as the sheet's chipped stone (deterministic)
  // (the top's and foot's corners up and down, the sides' in and out)
  const jitOf = (seed) => [...Array(8).keys()].map((j) => { const h = Math.sin(seed * 12.9898 + j * 78.233) * 43758.5453, f = h - Math.floor(h), g = ((h * 7) % 1 + 1) % 1; const tb = j === 0 || j === 7 || j === 3 || j === 4; return [(f - 0.5) * (tb ? 4.4 : 1.6), (g - 0.5) * (tb ? 1.2 : 2.8)]; });
  for (const s of [1, -1]) {
    const X = (x) => s * x;
    const band = [hring(X(BAND[0]), BH + 0.8, BZ + 0.4, BCU + 0.3, BCZ + 0.1, UC, null, BCUB + 0.3), hring(X(BAND[1]), BH + 0.8, BZ + 0.4, BCU + 0.3, BCZ + 0.1, UC, null, BCUB + 0.3)];
    F(band[0], 'gold', [-s, 0, 0]);
    tube(band, (i, j) => (j === 2 || j === 3 || j === 4 ? 'goldD' : 'gold'), [X(BAND[0]), X(BAND[1])]);
    // the band's outer step down onto the block
    const b0 = hring(X(BAND[1]), BH, BZ, BCU, BCZ, UC, null, BCUB), b1 = hring(X(BODY), BH, BZ, BCU, BCZ, UC, null, BCUB), f0 = hring(X(FACE), FH, FZ, FCU, FCZ, UC + 1.5, null, FCUB);
    for (let j = 0; j < 8; j++) F([band[1][j], band[1][(j + 1) % 8], b0[(j + 1) % 8], b0[j]], 'gold', [s, 0, 0]);
    tube([b0, b1], (i, j) => SIDE_M[j], [X(BAND[1]), X(BODY)]);
    tube([b1, f0], (i, j) => (j === 7 || j === 0 || j === 6 ? 'stoneL' : j === 1 || j === 5 ? 'stoneB' : 'bevel'), [X(BODY), X(FACE)]);
    // the face: a gold frame round its edge, the plate inside it
    const f1 = hring(X(FACE + 0.12), FH - 1.5, FZ - 1.5, FCU - 0.6, FCZ - 0.6, UC + 1.5, null, FCUB - 0.8);
    for (let j = 0; j < 8; j++) F([f0[j], f0[(j + 1) % 8], f1[(j + 1) % 8], f1[j]], 'gold', [s, 0, 0]);
    F(f1, 'stone', [s, 0, 0]);
    faces[s] = [...f0, ...band[1], ...b1];
    // the neck: from the band's inner face to the hub, waisted, its corners chipped; a gold ring where it meets the hub
    const NK = [[29.5, 22, 17, 6, 5], [25.5, 20.5, 15.8, 5.5, 4.5], [21, 21, 15.5, 5.5, 4.5], [17, 21.8, 16.4, 6, 5], [13.5, 22.5, 17, 6, 5]];
    const nk = NK.map(([x, hu, hz, cu, cz], i) => hring(X(x), hu, hz, cu, cz, UC - 0.5, i === 0 || i === NK.length - 1 ? null : jitOf(i + (s > 0 ? 0 : 5))));
    // (a facet here and there in shadow: the chipped stone)
    tube(nk, (i, j) => ((i * 3 + j + (s > 0 ? 0 : 1)) % 5 === 0 ? 'bevel' : SIDE_M[j]), NK.map((n) => X(n[0])));
    const g0 = hring(X(13.5), 23.5, 18, 6.3, 5.3, UC - 0.5), g1 = hring(X(10.5), 23.5, 18, 6.3, 5.3, UC - 0.5);
    for (let j = 0; j < 8; j++) F([nk[4][j], nk[4][(j + 1) % 8], g0[(j + 1) % 8], g0[j]], 'gold', [s, 0, 0]);
    tube([g0, g1], (i, j) => (j === 3 ? 'goldD' : 'gold'), [X(13.5), X(10.5)]);
  }

  /* ---- the haft: eight-sided rings up the U axis, lofted ---------------------------------------------------------- */
  const ZK = 0.96;
  const ring = (U, s, c, zk = ZK) => oct(0, 0, s, s * zk, c).map(([x, z]) => P(x, U, z));
  const PROFILE = [];
  const R = (U, s, c, m, zk = ZK) => { PROFILE.push([U, s, c, zk]); return { U, s, r: ring(U, s, c, zk), m }; };
  const loft = (rings, mat) => {
    for (let i = 0; i + 1 < rings.length; i++) for (let j = 0; j < 8; j++) {
      const a = rings[i].r, b = rings[i + 1].r, m = typeof mat === 'function' ? mat(i, j) : rings[i].m ?? mat;
      const Um = (rings[i].U + rings[i + 1].U) / 2, flat = Math.abs(rings[i].U - rings[i + 1].U) < 1e-6;
      F([a[j], a[(j + 1) % 8], b[(j + 1) % 8], b[j]], m, flat ? (rings[i + 1].s > rings[i].s ? [0, -1, 0] : [0, 1, 0]) : FROM(0, Um, 0));
    }
  };
  // the wood: straight grained, its facets two tones, from the lower collar to the middle collar
  // (round in section: as deep as it is wide, the sheet's 13 px in every view)
  const WS = 6.6, W1 = 161, WC = WS * 0.586;
  const wood = [R(W0, WS, WC, undefined, 1), R(W1, WS, WC, undefined, 1)];
  loft(wood, (i, j) => (j % 2 ? 'wood2' : 'wood'));
  // its grain: thin lines down the front, back and sides
  const zW = WS;
  for (const [ax, sd] of [['z', 1], ['z', -1], ['x', 1], ['x', -1]]) for (const [o, u0, u1] of [[-2.4, W0 + 6, W1 - 22], [2, W0 + 30, W1 - 4]]) {
    const at = (t, U) => (ax === 'z' ? P(t, U, sd * (zW + 0.12)) : P(sd * (WS + 0.12), U, t));
    const w = 0.45;
    F([at(o - w, u0), at(o + w, u0), at(o + w * 0.6, u1), at(o - w * 0.6, u1)], 'grain', ax === 'z' ? [0, 0, sd] : [sd, 0, 0]);
  }
  // the lower collar and, under it, the pommel ring (its cap)
  const lower = [R(W0, WS, WC, 'gold', 1), R(W0, 9.6, 3.3, 'gold'), R(CU(39.2), 10.5, 3.7, 'gold'), R(CU(34), 10.3, 3.6, 'gold'), R(CU(33.4), 9.7, 3.4, 'goldD'), R(CU(32.6), 9.7, 3.4, 'gold'), R(CU(32.6), 10.1, 3.5, 'gold'), R(CU(29.6), 9.8, 3.4, 'gold'), R(PTOP, 9, 3.1)];
  loft(lower);
  // the middle collar, the panel, the upper collar
  const PS = 7, PCc = 2.2;
  const mid = [R(W1, WS, WC, 'gold', 1), R(W1, 8, 2.8, 'gold'), R(W1 + 1, 8.7, 3, 'gold'), R(169, 8.7, 3, 'gold'), R(170, 8, 2.8, 'gold'), R(170, PS, PCc, 'stone', 1), R(201, PS, PCc, 'gold', 1), R(201, 8.8, 3, 'gold'), R(202, 9.6, 3.2, 'gold'), R(209, 9.6, 3.2, 'gold'), R(210, 8.8, 3, 'stoneB')];
  // (the panel's corners gold, its flats stone)
  loft(mid, (i, j) => (i === 5 ? (j % 2 === 0 ? 'gold' : 'panel') : mid[i].m));

  /* ---- the hub: the post round the haft, its corners gold, the finial ---------------------------------------------- */
  const HX = 11, HZ = 13, HC = 2.6;
  {
    const lo = oct(0, 0, HX, HZ, HC).map(([x, z]) => P(x, 210, z)), hi = oct(0, 0, HX, HZ, HC).map(([x, z]) => P(x, 260, z));
    PROFILE.push([210, HX, HC], [260, HX, HC]);
    for (let j = 0; j < 8; j++) F([lo[j], lo[(j + 1) % 8], hi[(j + 1) % 8], hi[j]], j % 2 === 0 ? 'gold' : j === 3 || j === 7 ? 'stoneB' : 'stone', FROM(0, 235, 0));
    F(lo, 'bevel', [0, -1, 0]);
    const fin = [{ U: 260, s: HX, r: hi, m: 'gold' }, R(260, 11.8, 3.6, 'gold'), R(264, 11.8, 3.6, 'gold'), R(267.4, 7.5, 2.6, 'gold'), R(269, 3.4, 1.2, 'gold')];
    loft(fin);
    F(fin[fin.length - 1].r, 'gold', [0, 1, 0]);
    faces[0] = [...fin[2].r, ...fin[3].r];
  }

  /* ---- medallions: a gold ring round a disc, a star on it ------------------------------------------------------------ */
  // (a medallion on a face across Z, the front or back, or across X, a side: Q(a, u, depth) its point, a across the face)
  const QZ = (a, u, d) => P(a, u, d), QX = (a, u, d) => P(d, u, a);
  const star8 = (cx, cu, z, rl, rs, ri, mat, out, Q = QZ) => {
    // eight points, the long ones up, down and across, the short between; a fan from the centre
    const c = Q(cx, cu, z + 0.25 * Math.sign(z)), pts = [];
    // (no short points: a four-point star)
    const n = rs > 0 ? 16 : 8, st = 360 / n;
    for (let j = 0; j < n; j++) { const a = (90 + j * st) * DEG, r = j % 2 ? ri : rs > 0 && j % 4 !== 0 ? rs : rl; pts.push(Q(cx + r * Math.cos(a), cu + r * Math.sin(a), z)); }
    for (let j = 0; j < n; j++) F([c, pts[j], pts[(j + 1) % n]], mat, out);
  };
  const medallion = (cx, cu, sz, zb, ro, ri, zr, zd, n, disc, starR, Q = QZ, bend = null) => {
    // a gold ring (its outer wall from zb up to zr, its top, its inner wall down to the disc at zd), the disc, the star;
    // its depth bent by bend(u) where it sits on a face that curves away up and down (the pommel's)
    const out = Q === QZ ? (sz > 0 ? FRONT : BACK) : [sz, 0, 0];
    const at = (r, z) => [...Array(n).keys()].map((j) => { const a = (90 + (j + 0.5) * 360 / n) * DEG, u = cu + r * Math.sin(a); return Q(cx + r * Math.cos(a), u, (z + (bend ? bend(u) : 0)) * sz); });
    const ob = at(ro, zb), ot = at(ro, zr), it = at(ri, zr), id = at(ri, zd);
    for (let j = 0; j < n; j++) {
      const j1 = (j + 1) % n;
      const fq = (a, u, d) => (Q === QZ ? FROM(a, u, d) : FROM(d, u, a));
      F([ob[j], ob[j1], ot[j1], ot[j]], 'gold', fq(cx, cu, 0));
      F([ot[j], ot[j1], it[j1], it[j]], 'gold', out);
      const am = (90 + (j + 1) * 360 / n) * DEG;
      F([it[j], it[j1], id[j1], id[j]], 'goldD', fq(cx + 3 * ro * Math.cos(am), cu + 3 * ro * Math.sin(am), zd * sz));
    }
    F(id, disc, out);
    if (starR) star8(cx, cu, (zd + 0.35) * sz, ...starR, 'star', out, Q);
  };
  // the emblem on the hub: the star on the front, a plain stone disc in the ring on the back
  const HUB = [0, 233.5];
  medallion(HUB[0], HUB[1], 1, 12, 14.8, 9.8, 20.4, 18.6, 14, 'core', [9, 6, 2.5]);
  medallion(HUB[0], HUB[1], -1, 12, 14.8, 9.8, 20.4, 18.6, 12, 'stoneL', null);

  /* ---- the pommel: an eight-sided faceted stone under the ring, its point down; a medallion on each face ---------- */
  const PM = 18.4 * PSC;
  {
    const PR = [[28.6, 9], [25, 11.6], [20.5, 13.3], [15, 13.5], [11, 11.4], [5, 6.6], [0, 2.6]].map(([U, w]) => [U * PSC, w]);
    const rs = PR.map(([U, s]) => { PROFILE.push([U, s, s * 0.3]); return { U, s, r: ring(U, s, s * 0.3, 0.97) }; });
    loft(rs, (i, j) => (i >= 4 ? (j % 2 ? 'bevel' : 'stoneB') : i === 0 ? (j % 2 ? 'stoneL' : 'stone') : (j % 2 ? 'stone' : 'stoneL')));
    F(rs[rs.length - 1].r, 'bevel', [0, -1, 0]);
    // (the medallions follow the faces' slope above and below their middle)
    const sAt = (U) => { for (let i = 0; i + 1 < PR.length; i++) { const [u0, s0] = PR[i], [u1, s1] = PR[i + 1]; if (U <= u0 && U >= u1) return s0 + (s1 - s0) * (u0 - U) / (u0 - u1); } return PR[PR.length - 1][1]; };
    const bend = (U) => Math.min(0, sAt(U) - sAt(PM));
    for (const Q of [QZ, QX]) for (const sz of [1, -1]) medallion(0, PM, sz, 10, 7, 5.2, Q === QZ ? 14 : 14.4, Q === QZ ? 13.55 : 13.95, 8, 'gem', Q === QZ ? [4.4, 2.9, 1.2] : [4.2, 0, 1.3], Q, bend);
  }

  /* ---- the panel's inlay, front and back: a gold frame, its recess, three runes ------------------------------------ */
  const zP = PS;
  const runeMark = (U, z, sz, r) => { const out = sz > 0 ? FRONT : BACK; F([P(0, U + r, z), P(-r * 0.62, U, z), P(0, U - r, z), P(r * 0.62, U, z)], 'rune', out); };
  for (const sz of [1, -1]) {
    const out = sz > 0 ? FRONT : BACK, z = (zP + 0.2) * sz;
    const rect = (w, u0, u1, zz) => [P(-w, u0, zz), P(w, u0, zz), P(w, u1, zz), P(-w, u1, zz)];
    const o = rect(4.4, 172.5, 198.5, z), n = rect(2.9, 174, 197, z + 0.05 * sz);
    for (let j = 0; j < 4; j++) F([o[j], o[(j + 1) % 4], n[(j + 1) % 4], n[j]], 'gold', out);
    F(n, 'panel', out);
    for (const U of [178.5, 185.5, 192.5]) runeMark(U, z + 0.2 * sz, sz, 2.3);
  }

  /* ---- the faces' rune stars ------------------------------------------------------------------------------------------ */
  const FS = 232.5;
  const faceStar = (s) => {
    // in the face's plane (U, Z) at X = s FACE: eight points, the long ones up, down and across
    const X = s * (FACE + 0.25), out = [s, 0, 0], c = P(X + s * 0.15, FS, 0), pts = [];
    for (let j = 0; j < 16; j++) { const a = (90 + j * 22.5) * DEG, r = j % 2 ? 3.2 : j % 8 === 0 ? 15.5 : j % 4 === 0 ? 12 : 8; pts.push(P(X, FS + r * Math.sin(a), r * Math.cos(a))); }
    for (let j = 0; j < 16; j++) F([c, pts[j], pts[(j + 1) % 16]], 'rune', out);
    // its white-hot middle, a smaller star over it
    const X2 = X + s * 0.1, c2 = P(X2 + s * 0.12, FS, 0), q = [];
    for (let j = 0; j < 16; j++) { const a = (90 + j * 22.5) * DEG, r = j % 2 ? 1.5 : j % 8 === 0 ? 7.5 : j % 4 === 0 ? 5.5 : 3.6; q.push(P(X2, FS + r * Math.sin(a), r * Math.cos(a))); }
    for (let j = 0; j < 16; j++) F([c2, q[j], q[(j + 1) % 16]], 'star', out);
  };
  faceStar(1); faceStar(-1);

  /* ---- hairline cracks over the blocks' fronts and backs, a little darker -------------------------------------------- */
  const crack = (pts, z, out) => { for (let j = 0; j + 1 < pts.length; j++) { const [x0, u0] = pts[j], [x1, u1] = pts[j + 1], l = Math.hypot(x1 - x0, u1 - u0), nx = -(u1 - u0) / l * 0.35, nu = (x1 - x0) / l * 0.35; F([P(x0 - nx, u0 - nu, z), P(x0 + nx, u0 + nu, z), P(x1 + nx, u1 + nu, z), P(x1 - nx, u1 - nu, z)], 'crack', out); } };
  for (const sz of [1, -1]) {
    const out = sz > 0 ? FRONT : BACK, z = (BZ + 0.15) * sz;
    crack([[40, 240], [43, 233], [41.5, 226]], z, out);
    crack([[-39.5, 222], [-43, 228], [-44.5, 236]], z, out);
  }

  const tris = trisOf(G).length;

  /* ---- the glow, enchanted: added over the rest, its corners' alpha falling to nothing ------------------------------ */
  if (enchanted) {
    const disc = (cx, cu, z, r, a, n = 10) => { const c = P(cx, cu, z, a), rim = [...Array(n).keys()].map((j) => P(cx + r * Math.cos(j * 2 * Math.PI / n), cu + r * Math.sin(j * 2 * Math.PI / n), z, 0)); for (let j = 0; j < n; j++) F([c, rim[j], rim[(j + 1) % n]], 'glow', z >= 0 ? FRONT : BACK); };
    disc(HUB[0], HUB[1], 20.6, 19.5, 0.24, 12);
    for (const sz of [1, -1]) {
      disc(0, PM, 14.4 * sz, 15, 0.4);
      { const X = 14.8 * sz, c = P(X, PM, 0, 0.4), rim = [...Array(10).keys()].map((j) => P(X, PM + 15 * Math.cos(j * Math.PI / 5), 15 * Math.sin(j * Math.PI / 5), 0)); for (let j = 0; j < 10; j++) F([c, rim[j], rim[(j + 1) % 10]], 'glow', [sz, 0, 0]); }
      // the panel's runes
      const z = (zP + 0.7) * sz;
      const L0 = [P(-5.5, 171, z, 0), P(-0.8, 175, z, 0.3), P(-0.8, 196, z, 0.3), P(-5.5, 200, z, 0)], R0 = [P(5.5, 171, z, 0), P(0.8, 175, z, 0.3), P(0.8, 196, z, 0.3), P(5.5, 200, z, 0)];
      const o = sz > 0 ? FRONT : BACK;
      F(L0, 'glow', o); F(R0, 'glow', o); F([L0[1], R0[1], R0[2], L0[2]], 'glow', o);
    }
    // the faces' stars, out along them
    for (const s of [1, -1]) { const X = s * (FACE + 0.5), c = P(X, FS, 0, 0.55), rim = [...Array(10).keys()].map((j) => P(X, FS + 22 * Math.cos(j * Math.PI / 5), 18 * Math.sin(j * Math.PI / 5), 0)); for (let j = 0; j < 10; j++) F([c, rim[j], rim[(j + 1) % 10]], 'glow', [s, 0, 0]); }
  }
  for (let i = 0; i < G.V.length; i++) if (G.A[i] === undefined) G.A[i] = 1;

  const GR = WS * (1 + 1 / Math.cos(Math.PI / 8)) / 2;
  return {
    G, MATS: enchanted ? MATS_ENCHANTED : MATS_PLAIN, L: length, k, tris, all: trisOf(G).length,
    // the grip, in its frame (game units): the haft's axis (toward the head), where the leading (right) fist closes and
    // the second (left) fist's (lower, toward the pommel), the wood's radius (its octagon, flat to flat and corner to
    // corner averaged), which way the head and the faces lie (the head along the hand toward the knuckles: the socket's
    // x, a hammer face leading the blow; the emblem's face the socket's z), and the grip's span (the wood)
    grip: { axis: [0, 1, 0], lead: [0, LEAD * k, 0], second: [0, SECOND * k, 0], radius: (GR + 0.4) * k, edge: [1, 0, 0], face: [0, 0, 1], from: W0 * k, to: W1 * k },
    grips: { main: [0, LEAD * k, 0], off: [0, SECOND * k, 0] },
    // the fists fitted round the grip with it across the finger roots, never taken back into the palm (lowgear.mjs fitFist)
    fit: { backMax: 0.1 },
    halfWidth: FACE * k,
    /**
     * How deep a point (its frame, game units) is inside the haft, the collars, the post or the pommel (game units; 0 or
     * less outside): the eight-sided section at its height, the widest ring there.
     */
    haftDepth: (p) => {
      const X = Math.abs(p[0] / k), U = p[1] / k, Z = Math.abs(p[2] / k);
      if (U < 0 || U > 269) return 0;
      const P2 = [...PROFILE].sort((a, b) => a[0] - b[0]);
      let best = null;
      for (let i = 0; i + 1 < P2.length; i++) {
        const [u0, s0, c0, z0 = ZK] = P2[i], [u1, s1, c1, z1 = ZK] = P2[i + 1];
        if (U < u0 || U > u1) continue;
        const t = u1 > u0 ? (U - u0) / (u1 - u0) : 0, ss = s0 + (s1 - s0) * t, cc = c0 + (c1 - c0) * t;
        if (!best || ss > best[0]) best = [ss, cc, z0 + (z1 - z0) * t];
      }
      if (!best) return 0;
      const [sx, c, zk] = best, sz = sx * zk;
      return Math.min(sx - X, sz - Z, sx + sz - c - X - Z) * k;
    },
    // the striking ends, its own frame: both faces' corners, the bands' and the bevels' outer corners (what the swing
    // keeps off the ground) and the finial's, the leading face's centre first
    ends: [[-FACE * k, UC * k, 0], ...[1, -1, 0].flatMap((s) => faces[s].map((i) => G.V[i]))],
  };
}

/* ---- the game's copy: node tools/sculpt/gear/warhammer.mjs [--out src/sculpt/assets/warhammer.json] ------------------- */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const { gearAsset } = await import('../lowgear.mjs');
  const args = process.argv.slice(2), at = args.indexOf('--out');
  const out = resolve(at < 0 ? new URL('../../../src/sculpt/assets/warhammer.json', import.meta.url).pathname : args[at + 1]);
  const L = await warhammerLength();
  const plain = buildWarhammer({ length: L }), lit = buildWarhammer({ length: L, enchanted: true });
  const asset = await gearAsset('warhammer', plain, lit, { male: buildRig('male'), female: buildRig('female') });
  // the haft laid a little across the palms (GRIP_TILT, about the sockets' z: the head toward the knuckles), so the
  // pommel swings wide of the hips and the left forearm after the impact
  {
    const tz = GRIP_TILT * Math.PI / 180, c = Math.cos(tz), s = Math.sin(tz);
    for (const who of ['male', 'female']) for (const sd of ['l', 'r']) {
      const R = asset.sockets[who][sd].R;
      asset.sockets[who][sd].R = [0, 1, 2].flatMap((i) => [R[i * 3] * c + R[i * 3 + 1] * s, -R[i * 3] * s + R[i * 3 + 1] * c, R[i * 3 + 2]]).map((x) => +x.toFixed(5));
    }
  }
  // its striking ends (both faces), kept off the ground in the swing (src/sculpt/anim/skeleton.ts Held.ends)
  asset.ends = plain.ends.map((p) => p.map((x) => +x.toFixed(5)));
  // never let down onto the ground where the swing lets a blade's point down (src/sculpt/anim/skeleton.ts Held.rest)
  asset.rest = 0;
  asset.units = "game units; its own frame: y along the haft from the pommel's foot (0) to the finial's top, x along the head (a face leading), z = x × y (out of the sheet's back face)";
  writeFileSync(out, JSON.stringify(asset));
  console.log(`wrote ${out}: ${asset.counts.tris} triangles (${asset.counts.glowTris} more of glow), ${L.toFixed(4)} game units`);
}
