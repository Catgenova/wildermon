// The pickaxe (src/game/actions.ts: the 'pickaxe' every mining action needs): the "Runestone Pickaxe" of
// tools/sculpt/ref/pickaxe-runestone.png, low-poly for the low-poly bodies (tools/sculpt/lowgear.mjs), built as the long
// sword is (tools/sculpt/gear/long_sword.mjs).
//
//   buildPickaxe({ enchanted, length }) -> { G (meshOf: V, F with a material each, A: glow alpha per point), MATS, L,
//   grip, grips: { main, off } (where the fists close, in its frame), tris (the count, the glow's apart), all }
//
// Laid out in the sheet's own pixels, its orthographic front view (Front 0°: the haft upright, the pick to the left, the
// hammer to the right): X from the haft's centre line (x 542.5 of the sheet), U up from the pommel's foot (y 343), so the
// cap's top is U 240; Z out of the sheet toward the viewer, its thicknesses from the side view (Side 90°). Scaled to L.
//
// Its frame, game units: y along the haft from the pommel's foot (0) to the cap's top (L); x toward the pick (the sheet's
// front view seen from behind: the pick is the side that leads in the overhead swing, the hand socket's x, along the hand
// toward the knuckles); z = x × y, out of the sheet's back face. So the sheet's front view is the view from -z (yaw 180).
//
// Parts (the sheet's assembly): (1) the one-piece head: the pick blade (a crescent, its section an eight-sided lozenge,
// bevelled along its spine and its underside, thinning to the point), the centre block round the haft, the hub (a gold
// ring round a disc and an eight-point star, on both faces), the neck waisted to the hammer, the hammer (an eight-sided
// block, its end an inset octagon behind a gold bevel); runes on the pick's faces (front: star, diamond, triangle; back:
// star, diamond, an angled rune) and a diamond on the hammer's face; (2) the upper collar, two gold bands with a stone ring
// between; (3) the shaft: wood, its upper part with a recessed gold-framed channel down the front and a line inlay with
// four diamonds, a gold band, its lower part the grip, wrapped (a two-tone lattice); (4) the lower collar; (5) the pommel,
// an octagonal star cap with a gold-ringed star medallion on both faces; over the head, the haft's stub and a gold cap.
// Where it leaves the sheet: the wrapped grip runs from U 27 to 104 (the sheet's 34 to 77, a hand's breadth) so that both
// his fists close on it clear of the collars in the swing (the game spaces them 1.39 game units apart, his thumb along the
// grip); the band over it and the channel's foot move up with it, the lower collar is thinner. Its length is the sheet's
// numbers in the game's scale (3.4 of his head); its head's span is its drawings' (0.94 of its length), not the sheet's
// "1.6 to 2.0 x head width", which none of its views draw.
// Enchanted: the runes, the inlay, the hub's star and disc and the pommel's star and disc lit (unlit, full bright), and
// glow added round the hub, the pommel, each rune, the hammer's diamond and the inlay; the channel's recess lit orange.

import { meshOf, trisOf } from '../lowgear.mjs';
import { buildRig } from '../lowrig.mjs';

/** The sheet's front view, px: the pommel's foot to the cap's top. */
const SHEET_L = 240;
/**
 * Its length, game units: 3.4 of the man's head (sole to crown he is 16.5; chin to crown, as the low-poly man is built),
 * the middle of the sheet's "overall length 3.2 to 3.6 x head height" and its scale panel (the haft from the chin to the
 * knee, held in one hand); one size for both bodies, as the long sword is.
 */
export const HEADS = 3.4;
export async function pickaxeLength() {
  const { gameScale } = await import('../lowgear.mjs');
  const rig = buildRig('male'), sc = await gameScale(rig), J = rig.J;
  return (J.crown[1] - J.chin[1]) * sc.scale * HEADS;
}

export const MATS_PLAIN = {
  stone: { c: '#dcc8bd', vary: 0.035 },
  stoneL: { c: '#e6d5ca', vary: 0.03 },
  stoneB: { c: '#d6c2b8', vary: 0.035 },
  bevel: { c: '#c0a59a', vary: 0.03 },
  crack: { c: '#c2a89c' },
  gold: { c: '#d49a4f' },
  wood: { c: '#cba68c', vary: 0.03 },
  wood2: { c: '#b08b75', vary: 0.03 },
  panel: { c: '#aca0b9' },
  rune: { c: '#93889f' },
  core: { c: '#c9b28a' },
  star: { c: '#e2cfa4' },
  gem: { c: '#d4b47a' },
  glow: { c: '#ff9a35', glow: 1 },
};
export const MATS_ENCHANTED = {
  ...MATS_PLAIN,
  rune: { c: '#ffa83a', emit: true },
  core: { c: '#ff9f38', emit: true },
  star: { c: '#fff6d8', emit: true },
  gem: { c: '#ffa847', emit: true },
  panel: { c: '#ef8f45', emit: true },
};

export function buildPickaxe({ enchanted = false, length } = {}) {
  if (!(length > 0)) throw new Error('buildPickaxe: the length (pickaxeLength())');
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
  // the pommel's top and middle; where the fists close (the lead, the right, under the band; the second a fist's breadth
  // lower, as wide apart as her fists need: the game puts his further down, src/sculpt/lowpoly.ts secondOn)
  const PT = 20, PC = PT / 2, LEAD = 78, SECOND = 46;
  const DEG = Math.PI / 180;
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---- the pick: a crescent from inside the centre block to the point ----------------------------------------------- */
  // stations (the sheet's front view, measured): X, the spine's top U, the underside's U; the half-thickness from the side
  // view and the top plan (13 px at the root to the point)
  const PS = [[-12, 221, 182], [-30, 225, 187], [-44, 226.5, 190.4], [-58, 228, 192.4], [-72, 227.5, 193.4], [-86, 224.5, 193.4], [-100, 215.5, 192.4], [-113, 209.5, 189.8], [-125, 204, 186.8], [-135, 198.5, 183.8], [-142, 193.5, 181.2]];
  const TIP = [-148, 184.5];
  const thick = (X) => { const s = Math.min(1, Math.max(0, (-X - 12) / (147 - 12))); return 13 * Math.pow(1 - s, 0.75) + 0.6 * (1 - s); };
  // a ring at a station: the spine (a narrow flat, ±te), the face's top and foot (±t), the underside (±te); the bevels a
  // share of the height
  const pickRing = ([X, top, bot]) => {
    const t = thick(X), te = t * 0.3, h = top - bot, bt = h * 0.32, bb = h * 0.18;
    return { X, top, bot, t, ft: top - bt, fb: bot + bb, pts: [P(X, top, te), P(X, top - bt, t), P(X, bot + bb, t), P(X, bot, te), P(X, bot, -te), P(X, bot + bb, -t), P(X, top - bt, -t), P(X, top, -te)] };
  };
  const pr = PS.map(pickRing);
  const PM = ['stoneL', 'stone', 'bevel', 'bevel', 'bevel', 'stoneB', 'stoneL', 'stoneL'];
  for (let i = 0; i + 1 < pr.length; i++) {
    const a = pr[i].pts, b = pr[i + 1].pts, Xm = (pr[i].X + pr[i + 1].X) / 2, Um = (pr[i].top + pr[i].bot) / 2;
    for (let j = 0; j < 8; j++) F([a[j], a[(j + 1) % 8], b[(j + 1) % 8], b[j]], PM[j], FROM(Xm, Um, 0));
  }
  {
    const a = pr[pr.length - 1], tip = P(TIP[0], TIP[1], 0);
    for (let j = 0; j < 8; j++) F([a.pts[j], a.pts[(j + 1) % 8], tip], PM[j], FROM(a.X + 2, (a.top + a.bot) / 2, 0));
  }
  /** The pick's face at X: its half-thickness and its top and foot (between the bevels). */
  const faceAt = (X) => {
    let i = 0; while (i + 2 < pr.length && pr[i + 1].X > X) i++;
    const a = pr[i], b = pr[i + 1], t = (X - a.X) / (b.X - a.X);
    return { z: thick(X), ft: lerp(a.ft, b.ft, t), fb: lerp(a.fb, b.fb, t), top: lerp(a.top, b.top, t), bot: lerp(a.bot, b.bot, t) };
  };

  /* ---- the centre block round the haft ------------------------------------------------------------------------------ */
  const oct = (cx, cy, hx, hy, c) => [[cx + hx - c, cy + hy], [cx + hx, cy + hy - c], [cx + hx, cy - hy + c], [cx + hx - c, cy - hy], [cx - hx + c, cy - hy], [cx - hx, cy - hy + c], [cx - hx, cy + hy - c], [cx - hx + c, cy + hy]];
  {
    // an eight-sided prism up the haft (X, Z), U 178 to 222
    const sec = oct(0, 0, 17, 16, 4.5);
    const lo = sec.map(([x, z]) => P(x, 178, z)), hi = sec.map(([x, z]) => P(x, 222, z));
    for (let j = 0; j < 8; j++) F([lo[j], lo[(j + 1) % 8], hi[(j + 1) % 8], hi[j]], j === 0 || j === 4 ? 'stoneB' : 'stone', FROM(0, 200, 0));
    F(hi, 'stoneL', [0, 1, 0]); F(lo, 'bevel', [0, -1, 0]);
  }

  /* ---- the neck and the hammer: eight-sided sections across U, Z, along X -------------------------------------------- */
  const ring8 = (X, uc, hu, hz, c) => oct(uc, 0, hu, hz, c).map(([u, z]) => P(X, u, z));
  const tube = (rings, mats, Xm) => {
    for (let i = 0; i + 1 < rings.length; i++) for (let j = 0; j < 8; j++) {
      const a = rings[i], b = rings[i + 1];
      F([a[j], a[(j + 1) % 8], b[(j + 1) % 8], b[j]], typeof mats === 'function' ? mats(i, j) : mats, FROM(Xm[i], 203, 0));
    }
  };
  // (an octagon's corners in order: 0, 7 the top's; 1, 2 the +Z side's; 3, 4 the foot's; 5, 6 the -Z side's)
  const NECK = [[12, 202, 19.5, 12, 4], [24, 202, 17, 11, 4], [35, 202.5, 15.2, 10, 3.5], [46, 203, 16.5, 11, 3.5], [53, 203, 18, 12, 4]];
  const nk = NECK.map(([X, uc, hu, hz, c]) => ring8(X, uc, hu, hz, c));
  tube(nk, (i, j) => (j === 3 ? 'bevel' : j === 7 ? 'stoneL' : 'stone'), NECK.map((n, i) => (n[0] + (NECK[i + 1] ?? n)[0]) / 2));
  // the hammer: its inner end bevelled from the neck, its sides, the gold bevel round its face, the face
  const HU = 202.6, HH = 28.4, HZ = 20, HC = 7;
  const hm = [ring8(51, HU, HH - 6, HZ - 4, HC - 2), ring8(56, HU, HH, HZ, HC), ring8(74.5, HU, HH, HZ, HC), ring8(79.6, HU, HH - 4, HZ - 4, HC - 2)];
  F([...hm[0]].reverse(), 'bevel', [-1, 0, 0]);
  tube(hm, (i, j) => (i === 2 ? 'gold' : i === 0 ? 'bevel' : j === 7 ? 'stoneL' : j === 3 ? 'bevel' : j === 0 || j === 4 ? 'stoneB' : 'stone'), [53.5, 65, 77]);
  F(hm[3], 'stone', [1, 0, 0]);

  /* ---- the hub: on both faces of the centre block, a gold ring round the disc and its star --------------------------- */
  const HUB = [0, 201], NH = 14;
  const star8 = (cx, cu, z, rl, rs, ri, mat, out) => {
    // eight points, the long ones up, down and across, the short between; a fan from the centre
    const c = P(cx, cu, z + 0.25), pts = [];
    for (let j = 0; j < 16; j++) { const a = (90 + j * 22.5) * DEG, r = j % 2 ? ri : j % 4 === 0 ? rl : rs; pts.push(P(cx + r * Math.cos(a), cu + r * Math.sin(a), z)); }
    for (let j = 0; j < 16; j++) F([c, pts[j], pts[(j + 1) % 16]], mat, out);
  };
  const medallion = (cx, cu, sz, zb, ro, ri, zr, zd, n, disc, starR) => {
    // a gold ring (its outer wall from zb up to zr, its top, its inner wall down to the disc at zd), the disc, the star
    const out = sz > 0 ? FRONT : BACK;
    const at = (r, z) => [...Array(n).keys()].map((j) => { const a = (90 + (j + 0.5) * 360 / n) * DEG; return P(cx + r * Math.cos(a), cu + r * Math.sin(a), z * sz); });
    const ob = at(ro, zb), ot = at(ro, zr), it = at(ri, zr), id = at(ri, zd);
    for (let j = 0; j < n; j++) {
      const j1 = (j + 1) % n;
      F([ob[j], ob[j1], ot[j1], ot[j]], 'gold', FROM(cx, cu, 0));
      F([ot[j], ot[j1], it[j1], it[j]], 'gold', out);
      const am = (90 + (j + 1) * 360 / n) * DEG;
      F([it[j], it[j1], id[j1], id[j]], 'gold', FROM(cx + 3 * ro * Math.cos(am), cu + 3 * ro * Math.sin(am), zd * sz));
    }
    F(sz > 0 ? id : [...id].reverse(), disc, out);
    star8(cx, cu, (zd + 0.35) * sz, ...starR, 'star', out);
  };
  for (const sz of [1, -1]) medallion(HUB[0], HUB[1], sz, 11.5, 19, 14.5, 20.5, 18, NH, 'core', [12, 8, 3.4]);

  /* ---- the haft: eight-sided rings up the y axis (a square with its corners cut), lofted ------------------------------ */
  const ZK = 0.96;
  const hring = (U, s, c) => oct(0, 0, s, s * ZK, c).map(([x, z]) => P(x, U, z));
  const loft = (rings, mat) => {
    for (let i = 0; i + 1 < rings.length; i++) for (let j = 0; j < 8; j++) {
      const a = rings[i].r, b = rings[i + 1].r, m = typeof mat === 'function' ? mat(i, j) : rings[i].m ?? mat;
      const Um = (rings[i].U + rings[i + 1].U) / 2, flat = Math.abs(rings[i].U - rings[i + 1].U) < 1e-6;
      F([a[j], a[(j + 1) % 8], b[(j + 1) % 8], b[j]], m, flat ? (rings[i + 1].s > rings[i].s ? [0, -1, 0] : [0, 1, 0]) : FROM(0, Um, 0));
    }
  };
  const PROFILE = [];
  const R = (U, s, c, m) => { PROFILE.push([U, s, c]); return { U, s, r: hring(U, s, c), m }; };
  // the grip: the wrap's half-width (the sheet's), from the lower collar to the band, long enough for both his fists (1.39
  // game units apart, the thumb up the grip) clear of both
  const GS = 9, WRAP_N = 7, W0 = 27, W1 = 104;
  const haft = [
    // the lower collar (on the pommel), the wrapped grip, the band, the inlaid shaft, the upper collar's two bands
    R(PT - 0.5, 10, 3, 'gold'), R(PT + 1, 11.2, 3.5, 'gold'), R(W0 - 1.5, 11.2, 3.5, 'gold'), R(W0, 8.6, 2.8, 'gold'),
  ];
  loft(haft);
  // the grip, wrapped: its facets cut corner to corner in a checker, the diamonds between in two tones a row
  const gr = [...Array(WRAP_N + 1).keys()].map((i) => hring(W0 + (W1 - W0) * i / WRAP_N, GS, GS * 0.586));
  PROFILE.push([W0, GS, GS * 0.586], [W1, GS, GS * 0.586]);
  // the step in from the collar's top to the grip
  for (let j = 0; j < 8; j++) { const a = haft[haft.length - 1].r, b = gr[0]; F([a[j], a[(j + 1) % 8], b[(j + 1) % 8], b[j]], 'gold', [0, 1, 0]); }
  for (let i = 0; i < WRAP_N; i++) {
    const a = gr[i], b = gr[i + 1], Um = W0 + (W1 - W0) * (i + 0.5) / WRAP_N;
    for (let j = 0; j < 8; j++) {
      const from = FROM(0, Um, 0), j1 = (j + 1) % 8, up = i % 2 ? 'wood2' : 'wood', down = i % 2 ? 'wood' : 'wood2';
      if ((i + j) % 2) { F([a[j], a[j1], b[j1]], up, from); F([a[j], b[j1], b[j]], down, from); }
      else { F([a[j], a[j1], b[j]], up, from); F([a[j1], b[j1], b[j]], down, from); }
    }
  }
  const upper = [{ U: W1, s: GS, r: gr[WRAP_N], m: 'gold' }, R(W1, 8.6, 2.8, 'gold'), R(W1 + 1.4, 11.8, 3.6, 'gold'), R(W1 + 6.6, 11.8, 3.6, 'gold'), R(W1 + 8, 10.6, 3.4, 'gold')];
  loft(upper);
  const sh = [R(W1 + 8, 10.6, 3.4, 'gold'), R(W1 + 8, 9.5, 2, 'wood'), R(132, 9.5, 2, 'wood'), R(151, 9.5, 2, 'gold'), R(151, 11.5, 3.5, 'gold'), R(152.4, 13, 3.8, 'gold'), R(159.6, 13, 3.8, 'gold'), R(161, 11.5, 3.5, 'gold'), R(161, 10, 3, 'stoneB'), R(168, 10, 3, 'gold'), R(168, 12.5, 3.6, 'gold'), R(169.4, 14, 4, 'gold'), R(178, 14, 4, 'gold')];
  loft(sh);
  F(sh[sh.length - 1].r, 'gold', [0, 1, 0]);
  // over the head: the haft's stub and the gold cap
  const cap = [R(222, 12, 3.5, 'stone'), R(229, 12, 3.5, 'gold'), R(229, 13, 3.6, 'gold'), R(230.4, 14, 4, 'gold'), R(236.5, 14, 4, 'gold'), R(240, 10.5, 3)];
  loft(cap);
  F(cap[cap.length - 1].r, 'gold', [0, 1, 0]);

  /* ---- the channel down the shaft's front: a gold frame, the recess, the line inlay and its diamonds ----------------- */
  const zF = 9.5 * ZK, PB = W1 + 11;
  {
    const hex = (w, u0, u1, p) => [[0, u1], [w, u1 - p], [w, u0 + p], [0, u0], [-w, u0 + p], [-w, u1 - p]];
    const o = hex(7.2, PB, 148, 5).map(([x, u]) => P(x, u, zF + 0.25)), n = hex(5.5, PB + 2.2, 145.8, 4.2).map(([x, u]) => P(x, u, zF + 0.3));
    for (let j = 0; j < 6; j++) F([o[j], o[(j + 1) % 6], n[(j + 1) % 6], n[j]], 'gold', FRONT);
    F(n, 'panel', FRONT);
    const z = zF + 0.45, w = 0.75;
    F([P(-w, PB + 5, z), P(w, PB + 5, z), P(w, 143, z), P(-w, 143, z)], 'rune', FRONT);
    for (const u of [0, 1, 2, 3].map((j) => PB + 10 + j * (128.5 - PB) / 3)) { const d = 2.6, e = 1.9; F([P(0, u - d, z + 0.1), P(e, u, z + 0.1), P(0, u + d, z + 0.1), P(-e, u, z + 0.1)], 'rune', FRONT); }
    // its ends pointed
    for (const [u, s] of [[143, 1], [PB + 5, -1]]) F([P(-1.6, u, z + 0.1), P(1.6, u, z + 0.1), P(0, u + 3.2 * s, z + 0.1)], 'rune', FRONT);
  }

  /* ---- the pommel: an octagon (X, U) with its faces' edges bevelled, a medallion on each face ----------------------- */
  {
    const O = [[9.5, PT], [13.5, PT - 4], [13.5, 7], [7, 0.5], [-7, 0.5], [-13.5, 7], [-13.5, PT - 4], [-9.5, PT]];
    const inset = (q, d) => q.map(([x, u]) => [x * (1 - d / 13.5), PC + (u - PC) * (1 - d / (PC - 0.25))]);
    const side = O.map(([x, u]) => [P(x, u, 9.5), P(x, u, -9.5)]);
    const face = { 1: inset(O, 2.6).map(([x, u]) => P(x, u, 12)), [-1]: inset(O, 2.6).map(([x, u]) => P(x, u, -12)) };
    for (let j = 0; j < 8; j++) {
      const j1 = (j + 1) % 8, from = FROM(0, PC, 0), m = j === 3 ? 'bevel' : 'stone';
      F([side[j][0], side[j1][0], side[j1][1], side[j][1]], m, from);
      F([side[j][0], side[j1][0], face[1][j1], face[1][j]], j === 3 || j === 4 ? 'bevel' : 'stoneL', FRONT);
      F([side[j][1], side[j1][1], face[-1][j1], face[-1][j]], j === 3 || j === 4 ? 'bevel' : 'stoneL', BACK);
    }
    F(face[1], 'stone', FRONT); F(face[-1], 'stone', BACK);
    for (const sz of [1, -1]) medallion(0, PC + 0.8, sz, 10, 9, 7, 13.4, 12.5, 12, 'gem', [6, 4.2, 1.9]);
  }

  /* ---- runes: the pick's faces, the hammer's face --------------------------------------------------------------------- */
  const onPick = (X, sz) => { const f = faceAt(X); return { u: Math.min(f.ft - 5.5, Math.max(f.fb + 6, f.bot + 0.45 * (f.top - f.bot))), z: (f.z + 0.35) * sz }; };
  const outline = (pts, wd, z, mat, out) => {
    // a closed line of width wd round pts (X, U), mitred
    const n = pts.length, inner = [], outer = [];
    for (let j = 0; j < n; j++) {
      const a = pts[(j + n - 1) % n], b = pts[j], c = pts[(j + 1) % n];
      const d1 = [b[0] - a[0], b[1] - a[1]], d2 = [c[0] - b[0], c[1] - b[1]], l1 = Math.hypot(...d1), l2 = Math.hypot(...d2);
      const n1 = [-d1[1] / l1, d1[0] / l1], n2 = [-d2[1] / l2, d2[0] / l2], m = [n1[0] + n2[0], n1[1] + n2[1]], ml = Math.hypot(...m), cs = (m[0] * n1[0] + m[1] * n1[1]) / ml;
      const off = [m[0] / ml * wd / 2 / cs, m[1] / ml * wd / 2 / cs];
      inner.push(P(b[0] - off[0], b[1] - off[1], z)); outer.push(P(b[0] + off[0], b[1] + off[1], z));
    }
    for (let j = 0; j < n; j++) F([inner[j], inner[(j + 1) % n], outer[(j + 1) % n], outer[j]], mat, out);
  };
  const runeStar = (X, U, z, r, out) => {
    const c = P(X, U, z + 0.1 * Math.sign(z)), pts = [];
    for (let j = 0; j < 8; j++) { const a = (90 + j * 45) * DEG, rr = j % 2 ? r * 0.36 : r; pts.push(P(X + rr * Math.cos(a), U + rr * Math.sin(a), z)); }
    for (let j = 0; j < 8; j++) F([c, pts[j], pts[(j + 1) % 8]], 'rune', out);
  };
  const runeDiamond = (X, U, z, r, out) => {
    outline([[X, U + r], [X - r * 0.8, U], [X, U - r], [X + r * 0.8, U]], 1.5, z, 'rune', out);
    F([P(X, U + 1.4, z), P(X - 1.1, U, z), P(X, U - 1.4, z), P(X + 1.1, U, z)], 'rune', out);
  };
  const runeTri = (X, U, z, r, out) => {
    outline([[X, U + r], [X - r * 0.95, U - r * 0.62], [X + r * 0.95, U - r * 0.62]], 1.5, z, 'rune', out);
    F([P(X - 0.8, U - 2.4, z), P(X + 0.8, U - 2.4, z), P(X + 0.8, U + 1.5, z), P(X - 0.8, U + 1.5, z)], 'rune', out);
  };
  const runeAngle = (X, U, z, r, out) => {
    // an angled rune: a stem with two strokes off it (as the sheet's back)
    const strip = (x0, u0, x1, u1) => { const d = [x1 - x0, u1 - u0], l = Math.hypot(...d), nx = -d[1] / l * 0.75, nu = d[0] / l * 0.75; F([P(x0 - nx, u0 - nu, z), P(x1 - nx, u1 - nu, z), P(x1 + nx, u1 + nu, z), P(x0 + nx, u0 + nu, z)], 'rune', out); };
    strip(X - r * 0.3, U - r, X - r * 0.3, U + r); strip(X - r * 0.3, U + r, X + r * 0.6, U + r * 0.2); strip(X - r * 0.3, U + 0.1 * r, X + r * 0.6, U - r * 0.7);
  };
  const RUNES = { 1: [[-78, runeStar, 6.2], [-58, runeDiamond, 5.6], [-37.5, runeTri, 6.2]], [-1]: [[-76, runeStar, 6.2], [-57, runeDiamond, 5.6], [-38, runeAngle, 5.6]] };
  for (const sz of [1, -1]) for (const [X, fn, r] of RUNES[sz]) { const o = onPick(X, sz); fn(X, o.u, o.z, r, sz > 0 ? FRONT : BACK); }
  // the hammer's face: a diamond outline and its centre
  {
    const X = 79.95, r = 9, out = [1, 0, 0];
    const pts = [[r * 1.25, 0], [0, r * 0.8], [-r * 1.25, 0], [0, -r * 0.8]].map(([du, dz]) => [HU + du, dz]);
    const n = pts.length, inner = [], outer = [];
    for (let j = 0; j < n; j++) { const [u, z] = pts[j], s = 1 - 1.6 / r; inner.push(P(X, HU + (u - HU) * s, z * s)); outer.push(P(X, u, z)); }
    for (let j = 0; j < n; j++) F([inner[j], inner[(j + 1) % n], outer[(j + 1) % n], outer[j]], 'rune', out);
    F([P(X + 0.05, HU + 2.6, 0), P(X + 0.05, HU, 1.8), P(X + 0.05, HU - 2.6, 0), P(X + 0.05, HU, -1.8)], 'rune', out);
  }

  /* ---- hairline cracks over the stone, a little darker ---------------------------------------------------------------- */
  const crack = (pts, zOf, out) => { for (let j = 0; j + 1 < pts.length; j++) { const [x0, u0] = pts[j], [x1, u1] = pts[j + 1], l = Math.hypot(x1 - x0, u1 - u0), nx = -(u1 - u0) / l * 0.35, nu = (x1 - x0) / l * 0.35; F([P(x0 - nx, u0 - nu, zOf(x0)), P(x0 + nx, u0 + nu, zOf(x0)), P(x1 + nx, u1 + nu, zOf(x1)), P(x1 - nx, u1 - nu, zOf(x1))], 'crack', out); } };
  for (const sz of [1, -1]) {
    const out = sz > 0 ? FRONT : BACK;
    crack([[-102, 206], [-107, 201.5], [-114, 199.5]], (X) => (faceAt(X).z + 0.2) * sz, out);
    crack([[58, 222], [63, 214], [61, 205], [67, 197]], () => (HZ + 0.2) * sz, out);
  }

  const tris = trisOf(G).length;

  /* ---- the glow, enchanted: added over the rest, its corners' alpha falling to nothing ------------------------------ */
  if (enchanted) {
    const disc = (cx, cu, z, r, a, n = 10) => { const c = P(cx, cu, z, a), rim = [...Array(n).keys()].map((j) => P(cx + r * Math.cos(j * 2 * Math.PI / n), cu + r * Math.sin(j * 2 * Math.PI / n), z, 0)); for (let j = 0; j < n; j++) F([c, rim[j], rim[(j + 1) % n]], 'glow', z >= 0 ? FRONT : BACK); };
    for (const sz of [1, -1]) {
      disc(HUB[0], HUB[1], 21 * sz, 34, 0.4);
      disc(0, PC + 0.8, 14 * sz, 22, 0.4);
      for (const [X] of RUNES[sz]) { const o = onPick(X, sz); disc(X, o.u, o.z + 0.4 * sz, 10, 0.45, 8); }
    }
    // the hammer's face, out along it
    { const c = P(80.4, HU, 0, 0.5), rim = [...Array(8).keys()].map((j) => P(80.4, HU + 15 * Math.cos(j * Math.PI / 4), 12 * Math.sin(j * Math.PI / 4), 0)); for (let j = 0; j < 8; j++) F([c, rim[j], rim[(j + 1) % 8]], 'glow', [1, 0, 0]); }
    // the channel warmed by its line: a strip round it, bright at the line, nothing at its edges
    const z = zF + 0.7;
    const L0 = [P(-7.5, PB - 1, z, 0), P(-1, PB + 3, z, 0.35), P(-1, 145, z, 0.35), P(-7.5, 149, z, 0)], R0 = [P(7.5, PB - 1, z, 0), P(1, PB + 3, z, 0.35), P(1, 145, z, 0.35), P(7.5, 149, z, 0)];
    F([L0[0], L0[1], L0[2], L0[3]], 'glow', FRONT); F([R0[0], R0[1], R0[2], R0[3]], 'glow', FRONT); F([L0[1], R0[1], R0[2], L0[2]], 'glow', FRONT);
  }
  for (let i = 0; i < G.V.length; i++) if (G.A[i] === undefined) G.A[i] = 1;

  return {
    G, MATS: enchanted ? MATS_ENCHANTED : MATS_PLAIN, L: length, k, tris, all: trisOf(G).length,
    // the grip, in its frame (game units): the haft's axis (toward the head), where the leading (right) fist closes (the top
    // of the wrapped grip, under the band) and the second (left) fist's (a fist's breadth lower, over the lower collar),
    // the grip's radius (the wrap's octagon, flat to flat and corner to corner averaged), which way the pick and the faces
    // lie (the pick along the hand toward the knuckles: the socket's x, so it leads the blow; the faces the socket's z),
    // and the grip's span (the wrap's foot to its top)
    grip: { axis: [0, 1, 0], lead: [0, LEAD * k, 0], second: [0, SECOND * k, 0], radius: (GS + 0.4) * k, edge: [1, 0, 0], face: [0, 0, 1], from: W0 * k, to: W1 * k },
    grips: { main: [0, LEAD * k, 0], off: [0, SECOND * k, 0] },
    gripR: (GS + 0.4) * k,
    // the fists fitted round the grip with it across the finger roots, never taken back into the palm (lowgear.mjs fitFist)
    fit: { backMax: 0.1 },
    halfWidth: 20 * k,
    /**
     * How deep a point (its frame, game units) is inside the haft, the collars, the cap or the pommel (game units; 0 or less
     * outside): the haft's eight-sided section at its height, the widest ring there, the pommel's block below its top.
     */
    haftDepth: (p) => {
      const X = Math.abs(p[0] / k), U = p[1] / k, Z = Math.abs(p[2] / k);
      if (U < 0 || U > 240) return 0;
      let sx, sz, c;
      if (U <= PT) { sx = U < 7 ? 7 + 6.5 * U / 7 : 13.5; sz = 12; c = 2.5; }
      else {
        const P2 = [...PROFILE].sort((a, b) => a[0] - b[0]);
        let best = null;
        for (let i = 0; i + 1 < P2.length; i++) {
          const [u0, s0, c0] = P2[i], [u1, s1, c1] = P2[i + 1];
          if (U < u0 || U > u1) continue;
          const t = u1 > u0 ? (U - u0) / (u1 - u0) : 0, ss = s0 + (s1 - s0) * t, cc = c0 + (c1 - c0) * t;
          if (!best || ss > best[0]) best = [ss, cc];
        }
        if (!best) return 0;
        [sx, c] = best; sz = sx * ZK;
      }
      return Math.min(sx - X, sz - Z, sx + sz - c - X - Z) * k;
    },
    // the striking ends, its own frame: the pick's point and the hammer's face corners (what the swing keeps off the ground)
    ends: [[-TIP[0] * k, TIP[1] * k, 0], ...hm[3].map((i) => G.V[i])],
    pick: [-TIP[0] * k, TIP[1] * k, 0],
  };
}

/* ---- the game's copy: node tools/sculpt/gear/pickaxe.mjs [--out src/sculpt/assets/pickaxe.json] ----------------------- */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const { gearAsset } = await import('../lowgear.mjs');
  const args = process.argv.slice(2), at = args.indexOf('--out');
  const out = resolve(at < 0 ? new URL('../../../src/sculpt/assets/pickaxe.json', import.meta.url).pathname : args[at + 1]);
  const L = await pickaxeLength();
  const plain = buildPickaxe({ length: L }), lit = buildPickaxe({ length: L, enchanted: true });
  const asset = await gearAsset('pickaxe', plain, lit, { male: buildRig('male'), female: buildRig('female') });
  // its striking ends (the pick's point and the hammer's face), kept off the ground in the swing (src/sculpt/anim/skeleton.ts Held.ends)
  asset.ends = plain.ends.map((p) => p.map((x) => +x.toFixed(5)));
  // never let down onto the ground where the swing lets a blade's point down (src/sculpt/anim/skeleton.ts Held.rest): the
  // head is held off it, so it does not fold back into the legs at the swing's rest and drag
  asset.rest = 0;
  asset.units = "game units; its own frame: y along the haft from the pommel's foot (0) to the cap's top, x toward the pick's point, z = x × y (out of the sheet's back face)";
  writeFileSync(out, JSON.stringify(asset));
  console.log(`wrote ${out}: ${asset.counts.tris} triangles (${asset.counts.glowTris} more of glow), ${L.toFixed(4)} game units`);
}
