// The weapons wielded on the low-poly bodies that are not the long sword or the maul (src/game/gear.ts WEAPONS): the short
// sword and the sword, the hunting knife, the battle axe, the club, the spear, the javelin and the throwing axe, in the
// Runecut line of the long sword, the Runestone Warhammer and the Runecut hand tools (tools/sculpt/gear/long_sword.mjs,
// warhammer.mjs, handparts.mjs), low-poly for the low-poly bodies (tools/sculpt/lowgear.mjs). The hatchet, the butchering
// knife and the carving knife are the hand tools' own props (hatchet.mjs, butchering_knife.mjs, finetools.mjs).
//
//   build(id, { enchanted }) -> { G, MATS, L, grip, fit, contact, trail, tris, all, two (held in both hands), ends,
//   rest }; how each is carried: CARRY (on the back, lowgear.mjs backSocketOf) or lowgear.mjs BELT_OF (beltSocketOf)
//   node tools/sculpt/gear/weapons.mjs [ids...] writes src/sculpt/assets/<id>.json for each (gearAsset)
//
// Game units (the man 16.5 tall), each in the hand tools' frame: y along the grip from the butt (0) toward the head or
// the point (toward the thumb of the fist that holds it), x the way the blow goes (an edge leads along +x; a sword's flats
// look down ±z), z = x × y. The swords are the long sword's own build at a one-handed sword's heights (long_sword.mjs
// buildLongSword's `form`); the rest are made of the hand tools' parts at a weapon's size. Each one's head or blade in the
// metal it is smithed from (lowgear.mjs metalFaces: the stone's metal copies); the club's wood in the wood it is carved
// from (its wood's copies, `woodMats`: src/sculpt/lowpoly.ts tints them by the item's wood); gold, leather, gems and runes
// their own. Enchanted: the runes, the medallions' discs and stars and the pommels' gems lit, glow added round them.
//
// Held: the two-handed (the battle axe) and the polearms and the javelin in both hands in the fight's overhead swing
// (src/sculpt/anim/clips/swing.ts), the rest in the right fist in the one-handed fight (src/sculpt/anim/clips/fight.ts).
// Carried while wielded and not in hand: the battle axe on the back head up (as the maul), the spear and the javelin on the
// back point up, the swords and the club on the back as the long sword, the knives, the hatchet and the throwing axe
// across the small of the back.

import { meshOf, trisOf, metalFaces, metalMats } from '../lowgear.mjs';
import { partsOf, haftOf, pommelOf, STRIKE_FIT, MATS_PLAIN as TOOL_PLAIN, MATS_ENCHANTED as TOOL_LIT, METAL } from './handparts.mjs';
import { buildLongSword, swordLength } from './long_sword.mjs';
import { GRIP_TILT } from './warhammer.mjs';

/** The leather wraps of a grip (the long sword's two tones) and the club's wood's copies drawn in its wood. */
const LEATHER = { leather: { c: '#8f746b' }, leather2: { c: '#7a6159' } };
const WOOD = ['wood', 'wood2', 'grain'];
/** The wood copies of a material table's woods (`role: 'wood'`): src/sculpt/lowpoly.ts draws them in the item's wood where it names one. */
export const woodMats = (mats, names) => Object.fromEntries(names.map((n) => [`${n}W`, { ...mats[n], wood: true }]));
const PLAIN = { ...TOOL_PLAIN, ...LEATHER, ...woodMats(TOOL_PLAIN, WOOD) };
const LIT = { ...TOOL_LIT, ...LEATHER, ...woodMats(TOOL_PLAIN, WOOD) };
/** The faces from `from` on whose material is a wood take its wood copy (`woodMats`). */
const woodFaces = (G, from) => { for (let i = from; i < G.F.length; i++) if (WOOD.includes(G.F[i].mat)) G.F[i].mat += 'W'; };

const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];

/** A finished build: every point's glow alpha set, the materials of its look. */
function done(G, enchanted, o) {
  for (let i = 0; i < G.V.length; i++) if (G.A[i] === undefined) G.A[i] = 1;
  return { G, MATS: enchanted ? LIT : PLAIN, ...o, all: trisOf(G).length };
}

/**
 * An axe's head round the haft at HY: the eight-sided eye (half-sizes ex, ez, half-height eh), the blade flaring along +x
 * through its stations [x, top, foot, half-thickness] to an edge curved back at its ends by `curve` (`double`: a second
 * blade along -x, the first mirrored; else the poll behind: `spike`, a point out to x -spike, or a short block); a gold
 * band round each blade's root (`band`, its width along x) and a gold-ringed emblem on each face of the eye (`emblem`,
 * its outer and inner radii); veins on the blades' faces, all of the head but its gold in the item's metal, and a
 * gold-ringed medallion on each face's slant. Returns { faceOf (a face's way and normal), zAt, MX, sides }.
 */
function axeHead(parts, G, o) {
  const { P, F, oct, tube, cap, medal, medallion, crack } = parts;
  const { HY, ex, ez, eh, ST, curve, spike } = o;
  const sides = o.double ? [1, -1] : [1];
  const headFrom = G.F.length;
  const e0 = oct([0, HY - eh, 0], X, Z, ex, ez, ex * 0.27), e1 = oct([0, HY + eh, 0], X, Z, ex, ez, ex * 0.27);
  tube([e0, e1], (i, j) => (j === 3 || j === 7 ? 'stone' : j === 1 || j === 5 ? 'stoneL' : 'stoneB'));
  cap(e1, 'stoneL', Y); cap(e0, 'bevel', [0, -1, 0]);
  const bring = ([x, top, bot, t], last, sx, grow = 1) => {
    const h = top - bot, yc = (top + bot) / 2, hg = h * grow, tg = t * grow, te = tg * 0.35, bt = hg * 0.06, xe = (dy) => (last ? x - curve * Math.pow(Math.abs(dy) / (h / 2), 2) : x);
    const T = yc + hg / 2, B = yc - hg / 2;
    return [[T, te], [T - bt, tg], [B + bt, tg], [B, te], [B, -te], [B + bt, -tg], [T - bt, -tg], [T, -te]].map(([y, z]) => P([sx * xe(y - yc), y, z]));
  };
  const BM = ['stoneL', 'stone', 'stoneB', 'bevel', 'bevel', 'stone', 'stoneL', 'stoneL'];
  for (const sx of sides) {
    const BR = ST.map((st, i) => bring(st, i === ST.length - 1, sx));
    for (let i = 0; i + 1 < BR.length; i++) for (let j = 0; j < 8; j++) {
      const a = BR[i], b = BR[i + 1], m = i === BR.length - 2 && (j === 1 || j === 5) ? 'bevel' : BM[j];
      F([a[j], a[(j + 1) % 8], b[(j + 1) % 8], b[j]], m, { from: [sx * (ST[i][0] + ST[i + 1][0]) / 2, (ST[i][1] + ST[i][2]) / 2, 0] });
    }
  }
  if (o.double) { /* (no poll) */ } else if (spike) {
    const po = (x, a, b) => oct([x, HY, 0], Y, Z, a, b, Math.min(a, b) * 0.3);
    const S = [po(-ex + 0.01, eh * 0.62, ez * 0.8), po(-ex - spike * 0.3, eh * 0.42, ez * 0.62), po(-ex - spike * 0.7, eh * 0.2, ez * 0.32)];
    tube(S, (i, j) => (i === 1 ? (j % 2 ? 'stoneL' : 'stoneB') : j === 1 ? 'stoneL' : j === 5 ? 'stoneB' : 'stone'));
    const tip = P([-ex - spike, HY, 0]), last = S[S.length - 1];
    for (let j = 0; j < 8; j++) F([last[j], last[(j + 1) % 8], tip], j % 2 ? 'bevel' : 'stoneL', { from: [-ex - spike * 0.7, HY, 0] });
  } else {
    const po = (x, a, b, k) => oct([x, HY, 0], Y, Z, a, b, k);
    const PL = [po(-ex + 0.01, eh * 0.74, ez * 0.85, 0.04), po(-ex - 0.1 * o.size, eh * 0.74, ez * 0.85, 0.04), po(-ex - 0.13 * o.size, eh * 0.6, ez * 0.7, 0.035)];
    tube(PL, (i, j) => (i === 1 ? 'bevel' : j === 1 ? 'stoneL' : j === 5 ? 'stoneB' : 'stone'));
    cap(PL[2], 'stone', [-1, 0, 0]);
  }
  const headTo = G.F.length;
  // the faces' slant between the second and third stations, and a medallion on it
  const slope = (ST[2][3] - ST[1][3]) / (ST[2][0] - ST[1][0]), zAt = (x) => ST[1][3] + slope * (Math.abs(x) - ST[1][0]);
  const faceOf = (sz, sx = 1) => { const u = [sx, 0, sz * slope], l = Math.hypot(...u), n = [-sx * slope, 0, sz], ln = Math.hypot(...n); return { u: u.map((v) => v / l), n: n.map((v) => v / ln) }; };
  const veinsFrom = G.F.length, s1 = ST[1], mid = (s1[1] + s1[2]) / 2, hh = (s1[1] - s1[2]) / 2;
  for (const sx of sides) for (const sz of [1, -1]) {
    const { u, n } = faceOf(sz, sx), c = [sx * s1[0], 0, sz * zAt(s1[0])];
    crack(c, u, Y, n, [[-0.05, mid + hh * 0.8], [-0.1, mid + hh * 0.66], [0, mid + hh * 0.52]].map(([a, t]) => [a * o.size, t]), 0.012 * o.size);
    crack(c, u, Y, n, [[-0.05, mid - hh * 0.8], [0.0, mid - hh * 0.7], [0.05, mid - hh * 0.6]].map(([a, t]) => [a * o.size, t]), 0.012 * o.size);
  }
  metalFaces(G, [[headFrom, headTo], [veinsFrom, G.F.length]], METAL);
  // the gold bands round the blades' roots
  if (o.band) for (const sx of sides) {
    const s0 = ST[0], s1b = ST[1], w = o.band / (s1b[0] - s0[0]), at = (k) => s0.map((v, q) => v + (s1b[q] - v) * k);
    const A = bring(at(0.02), false, sx, 1.08), B = bring(at(w), false, sx, 1.08);
    for (let j = 0; j < 8; j++) F([A[j], A[(j + 1) % 8], B[(j + 1) % 8], B[j]], j === 3 || j === 4 ? 'goldD' : 'gold', { from: [sx * (s0[0] + o.band / 2), (s0[1] + s0[2]) / 2, 0] });
    cap(B, 'goldD', [sx, 0, 0]);
  }
  // the emblem on the eye's faces
  if (o.emblem) for (const sz of [1, -1]) medallion([0, HY, sz * ez], X, Y, [0, 0, sz], o.emblem[0], o.emblem[1], o.emblem[0] * 0.2, 'core', [o.emblem[1] * 0.95, o.emblem[1] * 0.55, o.emblem[1] * 0.25], 'star', true);
  const MX = o.medalX;
  for (const sx of sides) for (const sz of [1, -1]) { const { u, n } = faceOf(sz, sx); medal([sx * MX, o.medalY ?? HY, sz * zAt(MX)], u, n, o.medal[0], o.medal[1], o.disc ?? 'core'); }
  return { faceOf, zAt, MX, sides };
}

/* ---- the hunting knife: a single-edged blade, its edge along +x, a clip to the point, a gold crossguard ---------------- */
function huntingKnife(enchanted) {
  const G = meshOf(), parts = partsOf(G), { P, F, oct, tube, cap, medal, line, crack, glowDisc } = parts;
  const R = 0.125;
  const pm = pommelOf(parts, { pr: 0.165, pt: 0.22, r: R, zkWood: 0.82 });
  const G0 = 1.3;
  haftOf(parts, [[pm.wood, R, 'wood'], [G0 - 0.05, R * 1.04, 'gold'], [G0 - 0.05, 0.15, 'gold'], [G0, 0.15]], { grain: true, zk: 0.82, top: 'goldD' });
  // the crossguard: a bar across the blade's way, its ends turned toward the point
  const g = [oct([0, G0, 0], X, Z, 0.36, 0.1, 0.06), oct([0, G0 + 0.1, 0], X, Z, 0.36, 0.1, 0.06)];
  tube(g, (i, j) => (j === 1 || j === 5 ? 'goldD' : 'gold'));
  cap(g[0], 'goldD', [0, -1, 0]); cap(g[1], 'gold', Y);
  for (const sx of [1, -1]) {
    const q = [oct([sx * 0.36, G0 + 0.05, 0], Y, Z, 0.05, 0.08, 0.02), oct([sx * 0.44, G0 + 0.16, 0], Y, Z, 0.035, 0.06, 0.015)];
    // (the bar's end faces turned along x for the quillons' feet)
    tube(q, (i, j) => (j % 2 ? 'goldD' : 'gold'), () => [sx * 0.3, G0 + 0.08, 0]);
    cap(q[1], 'gold', [sx, 1, 0]);
  }
  // the blade: sections up y, from the spine (−x) to the edge (+x): [y, spine x, edge x, half-thickness]; its clip from
  // the spine down to the point
  const bladeFrom = G.F.length, B0 = G0 + 0.1;
  const ST = [[B0, -0.12, 0.2, 0.045], [1.9, -0.13, 0.24, 0.043], [2.7, -0.125, 0.25, 0.039], [3.3, -0.1, 0.22, 0.032], [3.65, 0.0, 0.16, 0.024], [3.88, 0.07, 0.11, 0.014]];
  const TIP = [0.1, 4.05];
  const sec = ([y, xs, xe, t]) => { const xb = xe - (xe - xs) * 0.33; return [[xs, y, t * 0.75], [xb, y, t], [xe, y, 0.004], [xe, y, -0.004], [xb, y, -t], [xs, y, -t * 0.75]].map((q) => P(q)); };
  const RS = ST.map(sec);
  tube(RS, (i, j) => (j === 0 ? (i % 2 ? 'stone' : 'stoneL') : j === 4 ? 'stone' : j === 5 ? 'stoneB' : 'bevel'), (i) => [(ST[i][1] + ST[i][2]) / 2, (ST[i][0] + ST[i + 1][0]) / 2, 0]);
  const tip = P([TIP[0], TIP[1], 0]), last = RS[RS.length - 1];
  for (let j = 0; j < 6; j++) F([last[j], last[(j + 1) % 6], tip], j === 0 || j === 4 ? 'stone' : 'bevel', { from: [0.05, 3.8, 0] });
  cap(RS[0], 'bevel', [0, -1, 0]);
  const veinsFrom = G.F.length;
  /** The blade's flat at (x, y) on the side sz: its z between the spine and the bevel's foot, a hair proud. */
  const zf = (sz, y) => { let i = 0; while (i + 2 < ST.length && ST[i + 1][0] < y) i++; const a = ST[i], b = ST[i + 1], t = Math.min(1, Math.max(0, (y - a[0]) / (b[0] - a[0]))); return sz * (a[3] + (b[3] - a[3]) * t); };
  for (const sz of [1, -1]) {
    crack([0, 0, zf(sz, 2.3) + sz * 0.002], X, Y, [0, 0, sz], [[0.1, 2.15], [0.05, 2.28], [0.11, 2.4], [0.06, 2.5]]);
  }
  metalFaces(G, [[bladeFrom, veinsFrom], [veinsFrom, G.F.length]], METAL);
  const MY = 1.72;
  for (const sz of [1, -1]) {
    medal([0.04, MY, zf(sz, MY) * 0.92], [sz, 0, 0], [0, 0, sz], 0.11, 0.08);
    line([0, 0, zf(sz, 2.6) + sz * 0.004], X, Y, [0, 0, sz], -0.07, 1.98, -0.06, 3.15, 0.026);
  }
  const tris = trisOf(G).length;
  if (enchanted) {
    for (const sz of [1, -1]) {
      glowDisc([0.04, MY, sz * 0.09], X, Y, [0, 0, sz], 0.24, 0.24, 0.42);
      glowDisc([-0.065, 2.56, sz * 0.06], X, Y, [0, 0, sz], 0.1, 0.66, 0.3, 8);
    }
    pm.glow();
  }
  return done(G, enchanted, {
    L: TIP[1], tris,
    grip: { axis: [0, 1, 0], lead: [0, 0.8, 0], second: [0, 0.8, 0], radius: R * 0.91 + 0.01, edge: [1, 0, 0], face: [0, 0, 1], from: pm.wood, to: G0 - 0.05 },
    fit: STRIKE_FIT,
    contact: TIP, trail: 1.9,
  });
}

/* ---- the battle axe: two-handed, a double-bitted head of two broad crescents on the maul's haft ---------------------- */
function battleAxe(enchanted) {
  const G = meshOf(), parts = partsOf(G), { P, F, oct, line, diamond, glowDisc } = parts;
  const R = 0.32, HY = 10.7, EH = 0.85;
  const pm = pommelOf(parts, { pr: 0.42, pt: 0.6, r: R });
  // the haft: wood from the pommel with a gold collar at its foot, a gold collar below the panel, a stone rune panel under the head
  const W1 = 1.0, P0 = HY - EH - 1.25;
  haftOf(parts, [[pm.wood, R, 'wood'], [W1, R, 'gold'], [W1, R * 1.16, 'gold'], [W1 + 0.22, R * 1.16, 'gold'], [W1 + 0.22, R, 'wood'],
    [P0, R, 'gold'], [P0, R * 1.22, 'gold'], [P0 + 0.18, R * 1.22, 'stone'], [HY - EH - 0.18, R * 1.22, 'gold'], [HY - EH - 0.01, R * 1.22, 'gold'], [HY - EH + 0.02, R]], { grain: true });
  for (const sz of [1, -1]) {
    const n = [0, 0, sz];
    line([0, 0, sz * R * 1.225], X, Y, n, 0, P0 + 0.36, 0, HY - EH - 0.36, 0.075);
    diamond([0, (P0 + HY - EH) / 2, sz * R * 1.23], X, Y, n, 0.14, 0.22, 0.045);
  }
  const H = 2.25;
  const head = axeHead(parts, G, {
    HY, ex: 0.55, ez: 0.42, eh: EH, curve: 0.42, double: true, size: 2.8, medalX: 1.42, medal: [0.34, 0.25], band: 0.2, emblem: [0.36, 0.27],
    ST: [[0.5, HY + 0.62, HY - 0.62, 0.3], [1.05, HY + 1.02, HY - 1.02, 0.22], [1.75, HY + H * 0.78, HY - H * 0.78, 0.13], [2.3, HY + H * 0.97, HY - H * 0.97, 0.06], [2.55, HY + H, HY - H, 0.012]],
  });
  // over the eye: the haft's stub, a gold cap and a short stone spike
  const T0 = HY + EH;
  haftOf(parts, [[T0 - 0.02, R * 1.05, 'gold'], [T0 + 0.2, R * 1.2, 'gold'], [T0 + 0.32, R * 0.82, 'stoneL']]);
  const sp = oct([0, T0 + 0.32, 0], X, Z, R * 0.82, R * 0.82, R * 0.24), tip = P([0, T0 + 1.15, 0]);
  for (let j = 0; j < 8; j++) F([sp[j], sp[(j + 1) % 8], tip], j % 2 ? 'stoneL' : 'bevel', { from: [0, T0 + 0.6, 0] });
  const tris = trisOf(G).length;
  if (enchanted) {
    for (const sx of head.sides) for (const sz of [1, -1]) {
      const { u, n } = head.faceOf(sz, sx);
      glowDisc([sx * head.MX, HY, sz * (head.zAt(head.MX) + 0.06)], u, Y, n, 0.66, 0.66, 0.4);
    }
    for (const sz of [1, -1]) {
      glowDisc([0, HY, sz * 0.55], X, Y, [0, 0, sz], 0.7, 0.7, 0.45);
      glowDisc([0, (P0 + HY - EH) / 2, sz * (R * 1.26)], X, Y, [0, 0, sz], 0.32, 0.8, 0.32, 8);
    }
    pm.glow();
  }
  const L = T0 + 1.15;
  return done(G, enchanted, {
    L, tris, two: true,
    grip: { axis: [0, 1, 0], lead: [0, 3.6, 0], second: [0, 2.3, 0], radius: R + 0.01, edge: [1, 0, 0], face: [0, 0, 1], from: W1 + 0.22, to: P0 },
    // both edges' corners and middles and the top's point (what the swing keeps off the ground)
    ends: [1, -1].flatMap((sx) => [[sx * 2.55, HY, 0], [sx * (2.55 - 0.42), HY + H, 0], [sx * (2.55 - 0.42), HY - H, 0]]).concat([[0, L, 0]]),
    rest: 0, trail: HY - H, headU: HY,
    contact: [2.55, HY, 0],
  });
}

/* ---- the club: carved whole from a log, swelling to a heavy head, gold bands and stone studs ---------------------------- */
function club(enchanted) {
  const G = meshOf(), parts = partsOf(G), { P, F, oct, ring, tube, cap, medal, glowDisc } = parts;
  const R = 0.14;
  const pm = pommelOf(parts, { pr: 0.18, pt: 0.24, r: R });
  const woodFrom = G.F.length;
  // the handle, then the head: eight-sided rings swelling to its crown, a gold band at its foot and round its belly
  const RG = [[pm.wood, R, 'wood'], [2.15, R * 1.02, 'gold'], [2.15, R * 1.3, 'gold'], [2.35, R * 1.3, 'gold'], [2.35, R * 1.12, 'wood'],
    [3.2, 0.25, 'wood'], [4.3, 0.36, 'gold'], [4.3, 0.39, 'gold'], [4.52, 0.4, 'gold'], [4.52, 0.37, 'wood'], [5.6, 0.43, 'wood'], [6.1, 0.38, 'wood'], [6.4, 0.24, 'wood']];
  const rings = haftOf(parts, RG, { grain: true });
  cap(rings[rings.length - 1], 'wood2', Y);
  // the grain up the head's faces
  for (const sz of [1, -1]) for (const [ax, off] of [['z', 0.25], ['x', -0.3]]) {
    const at = (y, s, o) => (ax === 'z' ? [o * s, y, sz * s + sz * 0.003] : [sz * s + sz * 0.003, y, o * s]);
    for (const [y0, s0, y1, s1] of [[2.5, 0.2, 4.2, 0.35], [4.62, 0.38, 5.95, 0.4]]) F([P(at(y0, s0, off - 0.06)), P(at(y0, s0, off + 0.06)), P(at(y1, s1, off * 0.7 + 0.05)), P(at(y1, s1, off * 0.7 - 0.05))], 'grain', ax === 'z' ? [0, 0, sz] : [sz, 0, 0]);
  }
  woodFaces(G, woodFrom);
  // the studs: stone pyramids round the head's crown, two rows staggered
  const stud = (y, a, s) => {
    const c = [Math.cos(a), 0, Math.sin(a)], u = [-Math.sin(a), 0, Math.cos(a)], base = [c[0] * s, y, c[2] * s];
    const b = oct(base, u, Y, 0.075, 0.075, 0.025), tip = P([base[0] + c[0] * 0.13, y, base[2] + c[2] * 0.13]);
    for (let j = 0; j < 8; j++) F([b[j], b[(j + 1) % 8], tip], j % 2 ? 'stoneL' : 'stone', { from: base });
  };
  for (let j = 0; j < 8; j++) { const a = (j + 0.5) * Math.PI / 4; if (j % 2) stud(5.0, a, 0.41); stud(5.75, a + Math.PI / 8, 0.415); }
  // a medallion on the front and the back of the head's belly, under the studs
  const MY = 3.75;
  for (const sz of [1, -1]) medal([0, MY, sz * 0.31], [sz, 0, 0], [0, 0, sz], 0.15, 0.11);
  const tris = trisOf(G).length;
  if (enchanted) { for (const sz of [1, -1]) glowDisc([0, MY, sz * 0.38], X, Y, [0, 0, sz], 0.34, 0.34, 0.42); pm.glow(); }
  void ring;
  return done(G, enchanted, {
    L: 6.4, tris,
    grip: { axis: [0, 1, 0], lead: [0, 1.15, 0], second: [0, 1.15, 0], radius: R + 0.01, edge: [1, 0, 0], face: [0, 0, 1], from: pm.wood, to: 2.15 },
    fit: STRIKE_FIT,
    contact: [0.43, 5.4, 0], trail: 3.6,
  });
}

/**
 * A polearm's leaf head over the shaft's top at y0: its socket (a gold ferrule, then stone), the leaf (edges ±x, a raised
 * midrib down each face, ±z), widest `w` at `at` of its length `h`; a rune line up the midrib and a medallion at its foot.
 */
function leafHead(parts, G, y0, h, w, t, o = {}) {
  const { P, F, oct, tube, cap, line, medal } = parts;
  const headFrom = G.F.length;
  // the socket: an eight-sided cone up from the ferrule into the leaf
  const s0 = oct([0, y0, 0], X, Z, o.r ?? 0.2, o.r ?? 0.2, (o.r ?? 0.2) * 0.3), s1 = oct([0, y0 + h * 0.2, 0], X, Z, w * 0.32, t * 1.15, t * 0.35);
  tube([s0, s1], (i, j) => (j % 2 ? 'stoneL' : 'stoneB'));
  // the leaf: sections [y, half-width, half-thickness at the rib], four sided (the edges, the ribs) with a bevel each side
  const ST = [[y0 + h * 0.2, w * 0.45, t], [y0 + h * 0.38, w, t * 0.9], [y0 + h * 0.62, w * 0.8, t * 0.7], [y0 + h * 0.86, w * 0.36, t * 0.45]];
  const sec = ([y, a, b]) => [[a, y, 0], [a * 0.72, y, b * 0.35], [0, y, b], [-a * 0.72, y, b * 0.35], [-a, y, 0], [-a * 0.72, y, -b * 0.35], [0, y, -b], [a * 0.72, y, -b * 0.35]].map((q) => P(q));
  const RS = ST.map(sec);
  tube(RS, (i, j) => (j === 0 || j === 3 || j === 4 || j === 7 ? 'bevel' : j === 1 || j === 2 ? 'stone' : 'stoneB'), (i) => [0, (ST[i][0] + ST[i + 1][0]) / 2, 0]);
  // the socket's top into the leaf's foot
  for (let j = 0; j < 8; j++) F([s1[j], s1[(j + 1) % 8], RS[0][(j + 1) % 8], RS[0][j]], j % 2 ? 'stoneL' : 'bevel', { from: [0, y0 + h * 0.18, 0] });
  const tip = P([0, y0 + h, 0]), last = RS[RS.length - 1];
  for (let j = 0; j < 8; j++) F([last[j], last[(j + 1) % 8], tip], j === 0 || j === 3 || j === 4 || j === 7 ? 'bevel' : 'stoneL', { from: [0, y0 + h * 0.9, 0] });
  metalFaces(G, [[headFrom, G.F.length]], METAL);
  void cap;
  // the runes up the ribs, a medallion on the socket's foot
  const zr = (y) => { let i = 0; while (i + 2 < ST.length && ST[i + 1][0] < y) i++; const a = ST[i], b = ST[i + 1], u = (y - a[0]) / (b[0] - a[0]); return a[2] + (b[2] - a[2]) * u; };
  for (const sz of [1, -1]) {
    const y1 = y0 + h * 0.3, y2 = y0 + h * 0.78;
    // (two strokes, each laid on the rib's slope)
    for (const [ya, yb] of [[y1, (y1 + y2) / 2], [(y1 + y2) / 2, y2]]) {
      const za = zr(ya), zb = zr(yb), n = [0, sz * (za - zb), sz * (yb - ya)].map((v, _, a) => v / Math.hypot(...a));
      line([0, 0, sz * (za + 0.006)], X, [0, 1, (zb - za) / (yb - ya) * sz], [0, 0, sz], 0, ya, 0, yb, w * 0.13);
      void n;
    }
  }
  return { ST };
}

/** A shaft up y: the butt's spike and gold ferrule, wood to the head's ferrule at `top`, gold collars at `collars` and a two-tone leather wrap over `wrap`. */
function shaftOf(parts, G, R, top, collars, wrap) {
  const { P, F, oct } = parts;
  // the butt: a short stone point under a gold ferrule
  const b0 = oct([0, 0.3, 0], X, Z, R * 0.9, R * 0.9, R * 0.27), tip = P([0, 0, 0]);
  for (let j = 0; j < 8; j++) F([b0[j], b0[(j + 1) % 8], tip], j % 2 ? 'stoneL' : 'bevel', { from: [0, 0.2, 0] });
  const rings = [[0.3, R * 0.9, 'gold'], [0.62, R * 1.12, 'gold'], [0.72, R, 'wood']];
  const marks = [...collars.map((y) => ['c', y]), ...(wrap ? [['w0', wrap[0]], ['w1', wrap[1]]] : [])].sort((a, b) => a[1] - b[1]);
  for (const [kind, y] of marks) {
    if (kind === 'c') rings.push([y, R, 'gold'], [y, R * 1.14, 'gold'], [y + 0.16, R * 1.14, 'gold'], [y + 0.16, R, 'wood']);
    else if (kind === 'w0') rings.push([y, R, 'leather'], [y, R * 1.06, 'leather']);
    else rings.push([y, R * 1.06, 'gold'], [y, R * 1.14, 'gold'], [y + 0.12, R * 1.14, 'gold'], [y + 0.12, R, 'wood']);
  }
  rings.push([top, R, 'gold'], [top, R * 1.2, 'gold'], [top + 0.32, R * 1.2, 'goldD'], [top + 0.32, R * 0.95]);
  const out = haftOf(parts, rings, { grain: true });
  for (const f of G.F) if (f.mat === 'leather' && Math.round(G.V[f.v[0]][1] * 4) % 2) f.mat = 'leather2';
  return out;
}

/* ---- the spear: a long shaft, a leaf head with a raised rib, a gold-collared grip ---------------------------------------- */
function spear(enchanted) {
  const G = meshOf(), parts = partsOf(G), { glowDisc } = parts;
  const R = 0.2, TOP = 13.6, H = 3.2;
  shaftOf(parts, G, R, TOP, [2.0, 6.6], [2.5, 6.3]);
  leafHead(parts, G, TOP + 0.32, H, 0.62, 0.15, { r: R * 0.95 });
  const tris = trisOf(G).length;
  if (enchanted) for (const sz of [1, -1]) glowDisc([0, TOP + 0.32 + H * 0.54, sz * 0.12], X, Y, [0, 0, sz], 0.32, 1.2, 0.36, 10);
  const L = TOP + 0.32 + H;
  return done(G, enchanted, {
    L, tris, two: true,
    grip: { axis: [0, 1, 0], lead: [0, 5.6, 0], second: [0, 3.9, 0], radius: R * 1.06 + 0.01, edge: [1, 0, 0], face: [0, 0, 1], from: 2.5, to: 6.3 },
    ends: [[0, L, 0], [0.62, TOP + 0.32 + H * 0.38, 0], [-0.62, TOP + 0.32 + H * 0.38, 0]], rest: 1, trail: TOP + 0.32 + H * 0.2,
    contact: [0, L, 0], point: true,
  });
}

/* ---- the javelin: lighter and shorter, a narrow head, the leather wrap at its balance ------------------------------------ */
function javelin(enchanted) {
  const G = meshOf(), parts = partsOf(G), { glowDisc } = parts;
  const R = 0.15, TOP = 10.6, H = 2.1;
  shaftOf(parts, G, R, TOP, [], [3.6, 6.0]);
  leafHead(parts, G, TOP + 0.32, H, 0.34, 0.11, { r: R * 0.95 });
  const tris = trisOf(G).length;
  if (enchanted) for (const sz of [1, -1]) glowDisc([0, TOP + 0.32 + H * 0.54, sz * 0.09], X, Y, [0, 0, sz], 0.2, 0.8, 0.36, 10);
  const L = TOP + 0.32 + H;
  return done(G, enchanted, {
    L, tris, two: true,
    grip: { axis: [0, 1, 0], lead: [0, 5.5, 0], second: [0, 4.0, 0], radius: R * 1.06 + 0.01, edge: [1, 0, 0], face: [0, 0, 1], from: 3.6, to: 6.0 },
    ends: [[0, L, 0], [0.34, TOP + 0.32 + H * 0.38, 0], [-0.34, TOP + 0.32 + H * 0.38, 0]], rest: 1, trail: TOP + 0.32 + H * 0.2,
    contact: [0, L, 0], point: true,
  });
}

/* ---- the throwing axe: a small bearded head on a short leather-wrapped haft -------------------------------------------- */
function throwingAxe(enchanted) {
  const G = meshOf(), parts = partsOf(G), { glowDisc } = parts;
  const R = 0.14, HY = 3.45, EH = 0.27;
  const pm = pommelOf(parts, { pr: 0.15, pt: 0.2, r: R });
  haftOf(parts, [[pm.wood, R, 'leather'], [1.7, R * 1.04, 'gold'], [1.7, R * 1.16, 'gold'], [1.83, R * 1.16, 'gold'], [1.83, R, 'wood'],
    [HY - EH - 0.12, R, 'gold'], [HY - EH - 0.12, 0.16, 'gold'], [HY - EH - 0.01, 0.16, 'gold'], [HY - EH + 0.02, 0.125]], { grain: true });
  for (const f of G.F) if (f.mat === 'leather' && Math.round(G.V[f.v[0]][1] * 5) % 2) f.mat = 'leather2';
  // the head: narrow at the eye, its blade dropping into a beard below
  const head = axeHead(parts, G, {
    HY, ex: 0.19, ez: 0.13, eh: EH, curve: 0.08, size: 1.2, medalX: 0.42, medalY: HY - 0.12, medal: [0.13, 0.095],
    ST: [[0.16, HY + 0.2, HY - 0.24, 0.1], [0.32, HY + 0.22, HY - 0.36, 0.08], [0.52, HY + 0.3, HY - 0.62, 0.05], [0.68, HY + 0.38, HY - 0.86, 0.028], [0.78, HY + 0.41, HY - 0.93, 0.005]],
  });
  haftOf(parts, [[HY + EH - 0.02, 0.12, 'gold'], [HY + EH + 0.05, 0.135, 'gold'], [HY + EH + 0.08, 0.09]], { top: 'gold' });
  const tris = trisOf(G).length;
  if (enchanted) { for (const sz of [1, -1]) { const { u, n } = head.faceOf(sz); glowDisc([head.MX, HY - 0.12, sz * (head.zAt(head.MX) + 0.03)], u, Y, n, 0.28, 0.3, 0.42); } pm.glow(); }
  return done(G, enchanted, {
    L: HY + EH + 0.08, tris,
    grip: { axis: [0, 1, 0], lead: [0, 0.9, 0], second: [0, 0.9, 0], radius: R + 0.01, edge: [1, 0, 0], face: [0, 0, 1], from: pm.wood, to: HY - EH - 0.12 },
    fit: STRIKE_FIT,
    contact: [0.78, HY - 0.26, 0], trail: HY - 0.93,
  });
}

/* ---- the one-handed swords: the long sword's build at their heights ----------------------------------------------------- */
/** The long sword's px to game units (its sheet, 1469 px long, as tall as the woman). */
const swordK = async () => (await swordLength()) / 1469;
/** The sword and the short sword: the long sword's hilt and blade (long_sword.mjs `form`), shorter and narrower. */
export const SWORD_FORMS = {
  sword: { hilt: 0.62, grip: 0.55, blade: 0.68, wide: 0.78, motif: 'full' },
  short_sword: { hilt: 0.6, grip: 0.55, blade: 0.45, wide: 0.74, motif: 'short' },
};
async function swordOf(id, enchanted) {
  const f = SWORD_FORMS[id], s = buildLongSword({ enchanted, k: await swordK(), form: f, motif: f.motif });
  // one fist: on the grip's middle
  const g = s.grip, mid = (g.from + g.to) / 2;
  return { ...s, grip: { ...g, lead: [0, mid, 0], second: [0, mid, 0] }, back: false, fit: STRIKE_FIT, contact: [0, s.L, 0], trail: g.to + (s.L - g.to) * 0.18 };
}

/** The weapons built here, by item id. */
export const BUILD = { hunting_knife: huntingKnife, battle_axe: battleAxe, club, spear, javelin, throwing_axe: throwingAxe, sword: (e) => swordOf('sword', e), short_sword: (e) => swordOf('short_sword', e) };
export const WEAPON_IDS = Object.keys(BUILD);
export async function build(id, { enchanted = false } = {}) { return BUILD[id](enchanted); }

/**
 * How each is carried while wielded and not in hand (src/sculpt/lowpoly.ts): on the back (lowgear.mjs backSocketOf, as the
 * maul and the long sword), or across the small of the back (lowgear.mjs BELT_OF, beltSocketOf: the knives and the
 * hatchet's kind), clear of every garment of every set.
 */
export const CARRY = {
  // the swords and the club as the long sword: the hilt behind the right shoulder, the point toward the left hip
  // (lowgear.mjs BACK); at the hip a weapon this long crosses the hand and the forearm hanging beside it
  sword: { back: { lean: 34, guard: { male: [-0.7, -1.15], female: [-0.6, -1.2] }, gap: 0.3, tilts: [-14, 14], wide: 0.12 } },
  short_sword: { back: { lean: 34, guard: { male: [-0.7, -1.15], female: [-0.6, -1.2] }, gap: 0.3, tilts: [-14, 14], wide: 0.12 } },
  club: { back: { lean: 34, guard: { male: [-0.7, -1.15], female: [-0.6, -1.2] }, gap: 0.3, tilts: [-14, 14], wide: 0.12 } },
  battle_axe: { back: { up: true, flip: true, lean: 42, guard: { male: [-0.8, -0.95], female: [-0.7, -1.0] }, gap: 0.3, tilts: [-12, 12], wide: 0.12, blade: 0, anchor: 'headU' } },
  spear: { back: { up: true, flip: false, lean: 30, guard: { male: [-0.2, -2.6], female: [-0.15, -2.55] }, gap: 0.7, tilts: [-10, 10], wide: 0.12, blade: 0, anchor: 'lead' } },
  javelin: { back: { up: true, flip: false, lean: 30, guard: { male: [-0.25, -2.35], female: [-0.2, -2.3] }, gap: 0.3, tilts: [-10, 10], wide: 0.12, blade: 0, anchor: 'lead' } },
};

/* ---- the game's copies: node tools/sculpt/gear/weapons.mjs [ids...] ------------------------------------------------------ */
export async function writeWeapon(id, outDir) {
  const { writeFileSync } = await import('node:fs');
  const { resolve, join } = await import('node:path');
  const { gearAsset, backSocketOf, addBelt, ALL_GARMENTS } = await import('../lowgear.mjs');
  const { buildRig } = await import('../lowrig.mjs');
  const dir = resolve(outDir ?? new URL('../../../src/sculpt/assets', import.meta.url).pathname);
  const plain = await build(id), lit = await build(id, { enchanted: true });
  const a = await gearAsset(id, { ...plain, back: false }, lit, { male: buildRig('male'), female: buildRig('female') });
  const r5 = (x) => +x.toFixed(5);
  a.built = `node tools/sculpt/gear/weapons.mjs ${id} (tools/sculpt/lowgear.mjs gearAsset)`;
  a.units = "game units; its own frame: y along the grip from the butt (0) toward the head or the point (toward the thumb of the fist that holds it), x the way the blow goes (an edge leads along +x), z = x × y";
  a.contact = plain.contact.map(r5);
  a.reach = r5(Math.hypot(...plain.contact.map((c, k) => c - plain.grip.lead[k])));
  if (plain.trail !== undefined) a.trail = r5(plain.trail);
  if (plain.ends) a.ends = plain.ends.map((p) => p.map(r5));
  a.rest = plain.rest ?? 0;
  if (plain.two) {
    a.two = true;
    // the haft laid a little across the palms as the maul's is (warhammer.mjs GRIP_TILT, about the sockets' z: the head
    // toward the knuckles), so its foot swings wide of the hips and the left forearm
    const tz = GRIP_TILT * Math.PI / 180, c = Math.cos(tz), sn = Math.sin(tz);
    for (const who of ['male', 'female']) for (const sd of ['l', 'r']) {
      const R = a.sockets[who][sd].R;
      a.sockets[who][sd].R = [0, 1, 2].flatMap((i) => [R[i * 3] * c + R[i * 3 + 1] * sn, -R[i * 3] * sn + R[i * 3 + 1] * c, R[i * 3 + 2]]).map(r5);
    }
  }
  const carry = CARRY[id];
  if (carry?.back) for (const who of ['male', 'female']) {
    const d = carry.back, anchor = d.anchor === 'headU' ? plain.headU : d.anchor === 'lead' ? plain.grip.lead[1] : undefined;
    const b = backSocketOf(who, { verts: plain.G.V.flat(), grip: plain.grip }, a.scale[who], { ...d, guard: d.guard[who], garments: ALL_GARMENTS, ...(anchor !== undefined ? { anchor } : {}) });
    a.sockets[who].back = b.socket;
    console.log(`  ${id} ${who}: on the back, tilt ${b.tilt}, gaps ${b.gaps.join(', ')}`);
  }
  addBelt(a, plain);
  const out = join(dir, `${id}.json`);
  writeFileSync(out, JSON.stringify(a));
  console.log(`wrote ${out}: ${a.counts.tris} triangles (${a.counts.glowTris} more of glow), ${a.mats.length} materials, ${plain.L.toFixed(3)} long, lead ${a.grip.lead[1]}, reach ${a.reach}`);
  return a;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2), at = args.indexOf('--out');
  const ids = args.filter((x, i) => !x.startsWith('--') && (at < 0 || i !== at + 1));
  for (const id of ids.length ? ids : WEAPON_IDS) await writeWeapon(id, at < 0 ? undefined : args[at + 1]);
}
