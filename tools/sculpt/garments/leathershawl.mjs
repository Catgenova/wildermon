// The leather set's shawl (references: lineup-shawl.png, worn over the leather chest armour; enchanted-glow-ref.png,
// front, back, three-quarter and side, close-ups and the palette): a heavy leather poncho capelet in two tiers, worn over
// the chest armour. A funnel collar round the neck, low in front where the chest's stand collar shows, high behind; a
// yoke from the collar to a shallow V under the emblem's ring (its own band along its hem); the lower tier to a deep V
// front and back, its raised border band (two stripes and a row of triangles) along the hem; a row of square fringe
// tabs under the hem, each its own length, width and turn; the emblem (a ring at the yoke's point, two stripes down to
// the band) front and back. The stripes, the triangles, the ring and the emblem's stripes are the runes: trim tan plain,
// glowing enchanted.
//
//   buildLeatherShawl(rig, design, { under }) → { verts, polys: [{ v, mat, part, tag }], tris, part, cols, rings,
//     design, bones }: one closed shell (the shawl) and closed pieces laid on it (triangles, ring, stripes) or hung under
//     it (tabs), each a prism with its own thickness
//   leatherShawlWeights(rig, G) → per vertex [[bone, weight], ...] (the cape's six bones after the body's: shawl.mjs
//     shawlBones, driven from the upper arms)
//
//   node tools/sculpt/garments/leathershawl.mjs
//     writes the game's copy beside each body: src/sculpt/assets/lowleathershawl-male.json, -female.json (lowgarment.mjs
//     garmentAsset with the plain and enchanted looks; loaded by src/sculpt/lowpoly.ts, worn with outfit.leatherShawl)
//
// The shell, in columns round a vertical axis through the neck (azimuth 0 the front, 90 the body's left), each a closed
// section in its half-plane (r from the axis, y up), its rows joined round:
//   the collar: its inner rim d, its top u0, its outer rim u, down its outer wall to the yoke (cf);
//   the base line Lb: the cloth's drape over the body (and anything worn under it) grown by OUT, from the collar's foot
//   to the hem (as shawl.mjs: the shoulder's corner softened toward the straight line, the hanging part flared);
//   the yoke on it, TIER out from it: from the collar's foot (Y0) to its hem Y1 at the yoke's height (a V: low in front
//   and behind, high at the sides); its band along the hem RAISE further out (YB0 its foot, YB1 its top edge, YL the
//   stripe's foot, Y1 the hem's edge), the edge down onto the lower tier (Y1b);
//   the lower tier on Lb: L1, L2, the band's foot BT0, raised BT1, the top stripe's foot S1, the bottom stripe's top S2,
//   the hem's edge H; the hem's lip down to the underside IH (bevelled: lower than the outside's);
//   the underside, THICK in from Lb: IB, IY, IM, IT; the collar's inside: ci (its foot), up to d.
import { offPlane, TOL, samplesOf, envelope, drape, reachAt, atRY, dirOf, meshOf, orient, trisOf, transferWeights, sub, add, mul, lerp, unit, cross, dot } from '../lowgarment.mjs';
import { shawlBones } from './shawl.mjs';

/** The palette's swatches (sRGB 0..1; enchanted-glow-ref.png): dark brown, leather, light leather, trim tan, glow. */
export const SWATCH = { dark: [81, 47, 44], leather: [112, 60, 43], light: [148, 81, 54], trim: [222, 132, 79], glow: [254, 202, 109] };
/**
 * The set's shared colours, exactly the chest's (garments/leatherchest.mjs on sculpt-leather-chest, read off the sheet
 * under the game's light), so the material slots dedupe: dark, leather, light, trim, rune (plain the trim, enchanted the
 * glow), glow; the leather lit by the light's brightness only (kind 2), the glow unlit (kind 1).
 */
export const MATS = { dark: [0.29, 0.157, 0.129], leather: [0.416, 0.224, 0.176], light: [0.533, 0.286, 0.22], trim: [0.91, 0.518, 0.282], rune: [0.91, 0.518, 0.282], glow: [0.996, 0.792, 0.427] };
export const KIND = 2;
const lit = Object.fromEntries(Object.entries(MATS).map(([n, c]) => [n, n === 'glow' ? { c, kind: 1 } : { c, kind: KIND }]));
/** Plain: every material lit, the runes the trim's tan; enchanted: the runes unlit at the glow. */
export const LOOKS = { plain: lit, enchanted: { ...lit, rune: { c: MATS.glow, kind: 1 } } };

/**
 * The design per body (the body's units; values [front, side, back] blend round the azimuth):
 *   z0 the axis; front, back: columns to a quarter round; OUT the base line's clearance over the body (and `under`);
 *   THICK the leather's thickness under the base line; TIER how far the yoke stands out from the lower tier; RAISE how far
 *   the bands stand out; bevel how much lower the underside's hem is than the outside's;
 *   collar: rim the rim's height [front, side, back] (p: the V's shape, |sin|^p), IN the inside's clearance from the
 *   neck (room for the chest's stand collar), wall its thickness, lean how far out the rim is per unit of height, low the
 *   foot's depth below the rim where the rim is under the neck's foot;
 *   yoke: its hem's height [front, side, back] (p), band its band's length along the cloth, line the stripe's;
 *   hem: the lower tier's hem [front, corner, back] (p), flare, soften (as shawl.mjs), band the border's length along the
 *   cloth, stripe each stripe's;
 *   tri: the border's triangles (w base, h height of the band's field, gap between, raise), ytri the yoke band's;
 *   tabs: gap (centre to centre along the hem), w, len [shortest, longest], thick, tilt (degrees out), the pattern's seed;
 *   emblem: ring [outer, inner] radii, at (the ring's centre height, front and back), stripes (x of each from the centre
 *   line, width), raise;
 *   lift: the cape's bones (shawl.mjs DESIGN.lift).
 */
const LIFT = (side) => ({ side: { a: side, knee: 20, b: 1.3, max: 100, also: { axis: 'x', a: 0.3, max: 12 } }, front: { a: 0.3, knee: 40, b: 2.3, max: 100 }, back: { a: 0.4, knee: 30, b: 1.0, max: 60 }, frontAt: 60, backAt: 140, reach: [40, 40], from: 0.2, top: 0.2, roll: {} });
export const DESIGN = {
  male: {
    z0: -0.12, front: 6, back: 6, OUT: [0.12, 0.15, 0.12], THICK: 0.1, TIER: 0.07, RAISE: 0.035, bevel: 0.06,
    collar: { rim: [-0.74, 0.0, 0.38], p: 1.8, IN: 0.16, wall: 0.18, lean: 0.35, low: 0.18 },
    yoke: { table: [[0, -1.62], [15, -1.42], [30, -1.2], [45, -0.98], [60, -0.86], [75, -0.86], [90, -0.9], [105, -0.88], [120, -0.9], [135, -1.02], [150, -1.22], [165, -1.44], [180, -1.62]], band: 0.28, line: 0.05 },
    hem: { at: [-3.33, -2.1, -3.28], p: 1.0, flare: [0.04, 0.08, 0.04], soften: 0, band: 0.66, stripe: 0.075 },
    tri: { w: 0.36, gap: 0.16, raise: 0.03 }, ytri: { w: 0.2, gap: 0.14 },
    tabs: { gap: 0.31, w: 0.21, len: [0.3, 0.64], thick: 0.075, tilt: 9, seed: 7 },
    emblem: { ring: [0.3, 0.17], at: [-1.29, -1.33], stripes: [0.11, 0.07], raise: 0.03 },
    lift: LIFT(0.4),
  },
  female: {
    z0: -0.14, front: 6, back: 6, OUT: [0.11, 0.13, 0.11], THICK: 0.09, TIER: 0.06, RAISE: 0.03, bevel: 0.05,
    collar: { rim: [-0.7, -0.05, 0.3], p: 1.9, IN: 0.14, wall: 0.15, lean: 0.35, low: 0.16 },
    yoke: { table: [[0, -1.47], [15, -1.3], [30, -1.12], [45, -0.94], [60, -0.84], [75, -0.84], [90, -0.88], [105, -0.86], [120, -0.88], [135, -0.98], [150, -1.14], [165, -1.32], [180, -1.47]], band: 0.25, line: 0.045 },
    hem: { at: [-2.95, -1.85, -2.9], p: 1.0, flare: [0.04, 0.07, 0.04], soften: 0, band: 0.6, stripe: 0.065 },
    tri: { w: 0.31, gap: 0.14, raise: 0.026 }, ytri: { w: 0.18, gap: 0.12 },
    tabs: { gap: 0.28, w: 0.18, len: [0.27, 0.5], thick: 0.06, tilt: 18, seed: 7 },
    emblem: { ring: [0.25, 0.12], at: [-1.15, -1.2], stripes: [0.095, 0.06], raise: 0.026 },
    lift: LIFT(0.45),
  },
};

/** A value round the azimuth from [front, side, back], by |sin|^p from the front and the back. */
const vee = ([f, s, b], deg, p = 1) => { const a = Math.abs(((deg + 540) % 360) - 180), t = Math.pow(Math.abs(Math.sin(a * Math.PI / 180)), p); return a <= 90 ? f + (s - f) * t : b + (s - b) * t; };
/** A value round the azimuth from a table [[degrees from the front, value], ...] (0 to 180, the same each side). */
const table = (T, deg) => { const a = Math.abs(((deg + 540) % 360) - 180); for (let i = 0; i + 1 < T.length; i++) if (a <= T[i + 1][0]) return T[i][1] + (T[i + 1][1] - T[i][1]) * (a - T[i][0]) / (T[i + 1][0] - T[i][0]); return T[T.length - 1][1]; };
const P2 = { add: (a, b) => [a[0] + b[0], a[1] + b[1]], sub: (a, b) => [a[0] - b[0], a[1] - b[1]], mul: (a, k) => [a[0] * k, a[1] * k], len: (a) => Math.hypot(a[0], a[1]) };
const unit2 = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
/** The outward normal (away from the axis and up) of a segment a→b running downward in (r, y). */
const outN = (a, b) => { const d = P2.sub(b, a), l = P2.len(d) || 1; const n = [-d[1] / l, d[0] / l]; return n[0] < 0 || (n[0] === 0 && n[1] < 0) ? [-n[0], -n[1]] : n; };

/** The neck's foot (the body's ring nm0..nm5) where the half-plane of azimuth deg crosses it: [r, y]. */
function neckFoot(B, z0, deg) {
  const half = ['nm0', 'nm1', 'nm2', 'nm3', 'nm4', 'nm5'];
  const ring = [...half.map((n, k) => (k === 0 || k === 5 ? n : `${n}.L`)), ...half.slice(1, 5).reverse().map((n) => `${n}.R`)].map((n) => B.verts[B.index.get(n)]);
  const d = dirOf(deg);
  for (let k = 0; k < ring.length; k++) {
    const a = ring[k], b = ring[(k + 1) % ring.length];
    const ax = a[0], az = a[2] - z0, bx = b[0], bz = b[2] - z0;
    const ex = bx - ax, ez = bz - az, den = d[0] * ez - d[2] * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = (ax * ez - az * ex) / den, s = (ax * d[2] - az * d[0]) / den;
    if (t > 0 && s >= -1e-9 && s <= 1 + 1e-9) return [t, a[1] + (b[1] - a[1]) * s];
  }
  throw new Error('no neck foot at ' + deg);
}
/** Push a polyline's segments out (along their normals) until every point of E is outside them; the first point fixed. */
function clearOf(L, E) {
  for (let it = 0; it < 8; it++) {
    let moved = false;
    for (let i = 0; i + 1 < L.length; i++) {
      const a = L[i], b = L[i + 1], n = outN(a, b), d = P2.sub(b, a), l2 = d[0] * d[0] + d[1] * d[1];
      let worst = 0;
      for (const p of E) { const t = ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / l2; if (t < 0 || t > 1) continue; const h = (p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1]; if (h > worst) worst = h; }
      if (worst > 1e-4) { moved = true; const k = worst + 0.002; if (i > 0) L[i] = P2.add(a, P2.mul(n, k)); L[i + 1] = P2.add(b, P2.mul(n, i === 0 ? 2 * k : k)); }
    }
    if (!moved) break;
  }
  return L;
}
/** A polyline in (r, y): its length, the point and the outward normal at arc length s (the normal at a corner the two segments' mean). */
function polyOf(L) {
  const seg = [];
  let tot = 0;
  for (let i = 0; i + 1 < L.length; i++) { const l = P2.len(P2.sub(L[i + 1], L[i])); seg.push([tot, l]); tot += l; }
  const at = (s) => {
    s = Math.max(0, Math.min(tot, s));
    let i = seg.findIndex(([s0, l]) => s <= s0 + l + 1e-9);
    if (i < 0) i = seg.length - 1;
    const [s0, l] = seg[i], t = l ? (s - s0) / l : 0, p = P2.add(L[i], P2.mul(P2.sub(L[i + 1], L[i]), t));
    let n = outN(L[i], L[i + 1]);
    if (t > 0.999 && i + 2 < L.length) n = unit2(P2.add(n, outN(L[i + 1], L[i + 2])));
    if (t < 0.001 && i > 0) n = unit2(P2.add(n, outN(L[i - 1], L[i])));
    return { p, n, down: unit2(P2.sub(L[i + 1], L[i])) };
  };
  const sAtY = (y) => { for (let i = 0; i + 1 < L.length; i++) { const [a, b] = [L[i], L[i + 1]]; if (y <= a[1] && y >= b[1]) return seg[i][0] + seg[i][1] * (a[1] === b[1] ? 0 : (a[1] - y) / (a[1] - b[1])); } return y > L[0][1] ? 0 : tot; };
  return { tot, at, sAtY };
}

/** The rows of the outside, top to bottom (after the collar's), and the underside's, bottom to top. */
export const OUTSIDE = ['Y0', 'Ym', 'YB0', 'YB1', 'YL', 'Y1', 'Y1b', 'L1', 'L2', 'BT0', 'BT1', 'S1', 'S2', 'H'];
export const UNDER = ['IH', 'IB', 'IY', 'IM', 'IT'];
export const COLLAR = ['ci', 'd', 'u0', 'u', 'cm'];

export function buildLeatherShawl(rig, design = DESIGN[rig.who], { under = [] } = {}) {
  const { B } = rig, D = design, z0 = D.z0;
  const angles = [];
  for (let k = 0; k < D.front; k++) angles.push((k * 90) / D.front);
  for (let k = 0; k < 2 * D.back; k++) angles.push(90 + (k * 90) / D.back);
  for (let k = D.front; k > 0; k--) angles.push(360 - (k * 90) / D.front);
  const N = angles.length;
  const S = [...samplesOf(B), ...under.flatMap((m) => samplesOf(m))];
  const cols = [];
  for (let k = 0; k < N; k++) {
    const deg = angles[k], half = Math.max(((angles[(k + 1) % N] - deg + 360) % 360), ((deg - angles[(k + N - 1) % N] + 360) % 360));
    const F = neckFoot(B, z0, deg), yH = vee(D.hem.at, deg, D.hem.p), yY = D.yoke.table ? table(D.yoke.table, deg) : vee(D.yoke.at, deg, D.yoke.p);
    // the collar: its rim at rim (a V low in front), its foot `low` under the rim or under the neck's foot; its inside the
    // body's reach (and `under`'s) between foot and rim grown by IN, leaning out by `lean` per unit up
    const C = D.collar, rim = vee(C.rim, deg, C.p), foot = Math.min(F[1] - 0.04, rim - C.low);
    // (the samples themselves between foot and rim, within the column's wedge, each grown by IN: no half-disc, so the
    // shoulder below the foot does not push the collar out)
    let rIn = F[0] + C.IN;
    const kw = 1 / Math.cos(half * Math.PI / 180);
    for (const p of S) {
      if (p[1] < foot || p[1] > rim + 0.1) continue;
      if (Math.abs(((Math.atan2(p[0], p[2] - z0) * 180 / Math.PI - deg + 540) % 360) - 180) > half) continue;
      rIn = Math.max(rIn, Math.hypot(p[0], p[2] - z0) * kw + C.IN - C.lean * Math.max(0, p[1] - foot));
    }
    const ci = [rIn, foot], d = [rIn + C.lean * (rim - foot), rim];
    // the base line: the drape over the body grown by OUT, from the collar's outer foot to the hem
    const OUT = Array.isArray(D.OUT) ? vee(D.OUT, deg) : D.OUT;
    const E = envelope(S, z0, deg, half, OUT, yH - 0.05, foot + 0.6);
    const A0 = [Math.max(ci[0] + C.wall, reachAt(E, foot, 0.05)), foot];
    const L = drape(E, A0, yH);
    const Hm = L[L.length - 1];
    let T1 = L[Math.floor(L.length / 2)], best = -1;
    for (const p of L) { const h = Math.abs((p[0] - A0[0]) * (Hm[1] - A0[1]) - (p[1] - A0[1]) * (Hm[0] - A0[0])); if (h > best && p[1] > yH + 0.45 && p[1] < A0[1] - 0.12) { best = h; T1 = p; } }
    if (best < 0.02) T1 = [A0[0] + (Hm[0] - A0[0]) * 0.3, A0[1] + (Hm[1] - A0[1]) * 0.3];
    let T5 = [Hm[0] + vee(D.hem.flare, deg) * (T1[1] - yH), yH];
    const mid = P2.add(A0, P2.mul(P2.sub(T5, A0), (A0[1] - T1[1]) / Math.max(1e-6, A0[1] - T5[1])));
    T1 = P2.add(T1, P2.mul(P2.sub(mid, T1), D.hem.soften ?? 0));
    const Lb = clearOf([A0, T1, T5], E.filter(([, y]) => y <= A0[1]));
    const pl = polyOf(Lb);
    // the rows along the base line: the yoke's hem at its height (at least 0.3 below the collar's foot, 0.5 above the band)
    const sH = pl.tot, sB = sH - D.hem.band, sY = Math.max(0.3, Math.min(pl.sAtY(yY), sB - 0.5)), sYB = sY - D.yoke.band;
    const off = (s, k) => { const a = pl.at(s); return P2.add(a.p, P2.mul(a.n, k)); };
    const T = D.TIER, R = D.RAISE;
    const q = {
      Y0: off(0, T), Ym: off(sYB * 0.5, T), YB0: off(sYB, T), YB1: off(sYB, T + R), YL: off(sYB + D.yoke.line, T + R), Y1: off(sY, T + R), Y1b: off(sY + 0.02, 0),
      L1: off(sY + (sB - sY) / 3, 0), L2: off(sY + (2 * (sB - sY)) / 3, 0), BT0: off(sB, 0), BT1: off(sB, R), S1: off(sB + D.hem.stripe, R), S2: off(sH - D.hem.stripe, R), H: off(sH, R),
    };
    const dn = pl.at(sH).down;
    q.IH = P2.add(off(sH, -D.THICK), P2.mul(dn, D.bevel));
    q.IB = off(sB, -D.THICK); q.IY = off(sY, -D.THICK); q.IM = off(sY * 0.5, -D.THICK); q.IT = off(0, -D.THICK);
    // the collar's outside: its outer rim `wall` out from the inner, its top between, its wall down to the yoke's top (cm
    // halfway, bulging out a little: a rolled edge)
    const u = [d[0] + C.wall, rim - 0.03], u0 = [d[0] + C.wall * 0.5, rim + 0.02];
    const cm = [Math.max(u[0], q.Y0[0]) + 0.04, (u[1] + q.Y0[1]) / 2];
    // (the collar's inner foot inside the underside's top: no fold)
    if (ci[0] > q.IT[0] - 0.02) q.IT = [ci[0] + 0.02, q.IT[1]];
    cols.push({ deg, F, yH, yY, rim, Lb, sY, sB, sH, ci, d, u0, u, cm, T0: Lb[0], ...q });
  }
  const G = meshOfLeather(rig, D, cols, S);
  G.bones = shawlBones(rig, D, cols);
  return G;
}

/** The distance from p to the nearest of the samples S (the body and what is worn under it). */
const clearOfBody = (S, p) => { let d = Infinity; for (const q of S) { const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2]; if (Math.abs(dy) > 0.5) continue; d = Math.min(d, Math.hypot(dx, dy, dz)); } return d; };
/** A small deterministic pattern in [0, 1) (so the tabs vary without repeating evenly). */
/** How far the laid pieces' bottoms stand off the shell: over its folds between columns (TOL) and the chords' sag. */
const PLIFT = 0.036;
const hash = (i, seed) => { const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453; return x - Math.floor(x); };

function meshOfLeather(rig, D, cols, S) {
  const N = cols.length, z0 = D.z0, G = meshOf();
  G.S = S;
  const P3 = (c, key) => atRY(c.deg, c[key][0], c[key][1], z0);
  const ring = (key, part) => cols.map((c) => G.vert(P3(c, key), part));
  const R = {};
  for (const key of [...COLLAR, ...OUTSIDE, ...UNDER]) R[key] = ring(key, COLLAR.includes(key) ? 'collar' : 'cape');
  const band = (A, Bq, mat, part, tag, side = 1) => {
    G.tag = tag;
    for (let k = 0; k < N; k++) {
      const j = (k + 1) % N, q = [A[k], A[j], Bq[j], Bq[k]];
      if (offPlane(G.verts, q) <= TOL) { G.poly(q, mat, part); continue; }
      const out = (a, b) => { const m = lerp(G.verts[a], G.verts[b], 0.5); return Math.hypot(m[0], m[2] - z0); };
      if (side * (out(q[0], q[2]) - out(q[1], q[3])) >= 0) { G.poly([q[0], q[1], q[2]], mat, part); G.poly([q[0], q[2], q[3]], mat, part); }
      else { G.poly([q[0], q[1], q[3]], mat, part); G.poly([q[1], q[2], q[3]], mat, part); }
    }
  };
  // the shell: the collar's inside and top, its outer wall, the yoke and its band, the tier's edge, the lower tier, the
  // border, the hem's lip, the underside
  const seq = [
    ['ci', 'd', 'dark', 'collar', -1], ['d', 'u0', 'trim', 'collar'], ['u0', 'u', 'trim', 'collar'], ['u', 'cm', 'leather', 'collar'], ['cm', 'Y0', 'leather', 'collar'],
    ['Y0', 'Ym', 'leather', 'cape'], ['Ym', 'YB0', 'leather', 'cape'], ['YB0', 'YB1', 'rune', 'cape'], ['YB1', 'YL', 'rune', 'cape'], ['YL', 'Y1', 'light', 'cape'], ['Y1', 'Y1b', 'leather', 'cape'],
    ['Y1b', 'L1', 'leather', 'cape'], ['L1', 'L2', 'leather', 'cape'], ['L2', 'BT0', 'leather', 'cape'], ['BT0', 'BT1', 'rune', 'cape'], ['BT1', 'S1', 'rune', 'cape'], ['S1', 'S2', 'light', 'cape'], ['S2', 'H', 'rune', 'cape'],
    ['H', 'IH', 'light', 'cape'], ['IH', 'IB', 'dark', 'cape', -1], ['IB', 'IY', 'dark', 'cape', -1], ['IY', 'IM', 'dark', 'cape', -1], ['IM', 'IT', 'dark', 'cape', -1], ['IT', 'ci', 'dark', 'collar', -1],
  ];
  for (const [a, b, mat, part, side] of seq) band(R[a], R[b], mat, part, `${a}-${b}`, side ?? 1);
  const axisOut = (p) => [p[0], 0, p[2] - z0];
  // the pieces laid on it and hung under it
  G.pieces = [];
  if (D.pieces !== false) laid(G, D, cols, R);
  orient(G, axisOut);
  G.tris = trisOf(G);
  G.cols = cols; G.design = D; G.rings = R;
  return G;
}

/* ---- the pieces: prisms laid on the shell (runes) and hung under it (tabs) ------------------------------------------ */
/**
 * A closed prism from an outline (corners on the shell, in order) and each corner's outward direction: its bottom `lift`
 * off the shell, its top `h` further, its sides; each corner's weights taken later from `src` (per corner: [[shell
 * vertex, share], ...]).
 */
function prism(G, pts, nrm, h, lift, mat, tag, src, part = 'piece') {
  G.tag = tag;
  const bot = pts.map((p, k) => G.vert(add(p, mul(nrm[k], lift)), part)), top = pts.map((p, k) => G.vert(add(p, mul(nrm[k], lift + h)), part));
  if (pts.length <= 4) { G.poly(top, mat, part, true); G.poly([...bot].reverse(), mat, part, true); }
  else {
    // (a long outline: each face a fan round its centre)
    const n = pts.length, cen = (vs) => G.vert(mul(vs.reduce((s2, v) => add(s2, G.verts[v]), [0, 0, 0]), 1 / n), part);
    const ct = cen(top), cb = cen(bot);
    G.src ??= []; G.src[ct] = G.src[cb] = src.flat().map(([v, w]) => [v, w / n]);
    for (let k = 0; k < n; k++) { const j = (k + 1) % n; G.poly([top[k], top[j], ct], mat, part); G.poly([bot[j], bot[k], cb], mat, part); }
  }
  for (let k = 0; k < pts.length; k++) { const j = (k + 1) % pts.length; G.poly([bot[k], bot[j], top[j], top[k]], mat, part); }
  [...bot, ...top].forEach((v, i) => { G.src ??= []; G.src[v] = src[i % pts.length]; });
}

/**
 * A ribbon between two of the shell's rings (A above, Bq below): the point at u (columns, fractional, round the ring)
 * and v (0 on A, 1 on Bq), its outward normal, and the shell vertices it lies between (for its weights).
 */
function ribbon(G, A, Bq, z0) {
  const N = A.length, P = G.verts;
  const at = (u, v) => {
    u = ((u % N) + N) % N;
    const k = Math.floor(u), j = (k + 1) % N, t = u - k;
    const a = lerp(P[A[k]], P[A[j]], t), b = lerp(P[Bq[k]], P[Bq[j]], t), p = lerp(a, b, v);
    const tu = sub(lerp(P[A[j]], P[Bq[j]], v), lerp(P[A[k]], P[Bq[k]], v)), tv = sub(b, a);
    let n = unit(cross(tv, tu));
    if (dot(n, [p[0], 0, p[2] - z0]) < 0) n = mul(n, -1);
    return { p, n, src: [[A[k], (1 - t) * (1 - v)], [A[j], t * (1 - v)], [Bq[k], (1 - t) * v], [Bq[j], t * v]] };
  };
  // arc length along the ring at v, column by column
  const len = (v) => { const L = [0]; for (let k = 0; k < N; k++) L.push(L[k] + Math.hypot(...sub(at(k + 1, v).p, at(k, v).p))); return L; };
  const uAt = (L, s) => { const tot = L[L.length - 1]; s = ((s % tot) + tot) % tot; let k = 0; while (k + 1 < L.length && L[k + 1] < s) k++; return k + (s - L[k]) / Math.max(1e-9, L[k + 1] - L[k]); };
  return { at, len, uAt };
}

function laid(G, D, cols, R) {
  const z0 = D.z0, N = cols.length;
  // the border's triangles: on the field between the stripes, bases on the bottom stripe, pointing up, every w + gap along
  // the hem from the front's point each way (a triangle on each V's point)
  const tri = (A, Bq, T, tag, raise, skip = null) => {
    const rb = ribbon(G, A, Bq, z0), L = rb.len(1), tot = L[L.length - 1], step = T.w + T.gap;
    // (from the front's point round to the back's: each side its own whole number of triangles)
    const half = L[N / 2], n = Math.max(1, Math.round(half / step)), st = half / n;
    for (const [from, dir] of [[0, 1], [tot, -1]]) for (let i = 0; i < n; i++) {
      const c = from + dir * (i + 0.5) * st;
      const w = Math.min(T.w, st - 0.04) / 2;
      // (its outline in the ribbon's own coordinates, each edge in four, so it follows the band round the columns)
      const cs = [[rb.uAt(L, c - w), 0.93], [rb.uAt(L, c + w), 0.93], [rb.uAt(L, c), 0.09]], q = [];
      for (let e = 0; e < 3; e++) for (let t = 0; t < 6; t++) { const [u0, v0] = cs[e], [u1, v1] = cs[(e + 1) % 3]; q.push(rb.at(u0 + (u1 - u0) * t / 6, v0 + (v1 - v0) * t / 6)); }
      if (skip && skip(q[12].p)) continue;
      // (where the band turns sharply under it, the triangle stands off further: its corners' normals' spread)
      const md = Math.min(...q.map((x) => dot(x.n, q[12].n)));
      prism(G, q.map((x) => x.p), q.map((x) => x.n), raise, PLIFT + 0.25 * (1 - md), 'rune', tag, q.map((x) => x.src));
    }
  };
  tri(R.S1, R.S2, D.tri, 'tri', D.tri.raise);
  tri(R.YL, R.Y1, D.ytri, 'ytri', D.tri.raise * 0.8, (p) => Math.abs(p[0]) < D.emblem.ring[0] + 0.08);
  // the tabs: under the hem, each from its own two points on the hem (its top following the hem's slope), hanging
  // straight down by its own length, a little out and turned; widths and lengths varied by the pattern
  {
    const rb = ribbon(G, R.H, R.IH, z0), rd = ribbon(G, R.BT0, R.H, z0), L = rb.len(0.5), tot = L[L.length - 1], T = D.tabs;
    const n = Math.round(tot / T.gap), st = tot / n;
    // (each tab's frame first: its top, out, its line down, its length; then how much further out each must tilt to clear
    // the body, the most of it and its neighbours' taken, so tabs side by side lean alike and do not meet)
    const tabs = [];
    for (let i = 0; i < n; i++) {
      const h1 = hash(i, T.seed), h2 = hash(i + 101, T.seed), h3 = hash(i + 211, T.seed);
      // (the lengths in a broken rhythm: long and short by turns, each pushed by the pattern)
      const len = T.len[0] + (T.len[1] - T.len[0]) * Math.min(1, Math.max(0, (i % 2 ? 0.25 : 0.7) + (h1 - 0.5) * 0.6));
      const w = T.w * (0.85 + 0.3 * h2) / 2, c = i * st + (h3 - 0.5) * 0.04;
      const a = rb.at(rb.uAt(L, c - w), 0.5), b = rb.at(rb.uAt(L, c + w), 0.5), a1 = rb.at(rb.uAt(L, c - w), 1), b1 = rb.at(rb.uAt(L, c + w), 1);
      // (its top just under the lip's lowest edge, the underside's, and its middle under the lip's there)
      const top = [[a.p[0], a1.p[1] - 0.015, a.p[2]], [b.p[0], b1.p[1] - 0.015, b.p[2]]];
      { const m1 = rb.at(rb.uAt(L, c), 1).p[1] - 0.015, dm = (top[0][1] + top[1][1]) / 2 - m1; if (dm > 0) for (const t of top) t[1] -= dm; }
      // (out: the hem's outward normal level; down: halfway between straight down and the cloth's own line over the
      // band, then out by the tilt, a little each way by the pattern)
      const out = unit([a.n[0] + b.n[0], 0, a.n[2] + b.n[2]]), tl = (T.tilt + (h1 - 0.5) * 6) * Math.PI / 180;
      const cu = rb.uAt(L, c), cl = unit(sub(rd.at(cu, 1).p, rd.at(cu, 0).p)), dv = unit([cl[0] * 0.5, -1, cl[2] * 0.5]);
      const at = (extra) => { const down = unit(add(dv, mul(out, Math.tan(tl + extra * Math.PI / 180)))); return top.map((p, k) => add(p, mul(down, len + (k ? 0.02 : -0.02) * (h2 - 0.5)))); };
      let need = 0;
      for (; need < 30; need += 3) { const bot = at(need), inner = [0.5, 1].flatMap((f) => [0, 1].map((k) => sub(lerp(top[k], bot[k], f), mul(out, T.thick / 2)))); if (inner.every((p) => clearOfBody(G.S, p) > (T.clear ?? 0.1))) break; }
      tabs.push({ a, b, top, out, at, need });
    }
    for (let i = 0; i < n; i++) {
      const { a, b, top, out, at } = tabs[i], extra = Math.max(...[-2, -1, 0, 1, 2].map((d) => tabs[(i + d + n) % n].need * (1 - Math.abs(d) * 0.25)));
      const bot = at(extra);
      const th = T.thick / 2, o = mul(out, th);
      const pts = [sub(top[0], o), sub(top[1], o), sub(bot[1], o), sub(bot[0], o)];
      const outs = [o, o, o, o].map(() => out);
      const s0 = a.src, s1 = b.src;
      prism(G, pts, outs, T.thick, 0, 'trim', 'tab', [s0, s1, s1, s0], 'tab');
    }
  }
  // the emblem, front and back: the ring (an annulus of 16), the two stripes from under it to the band's top, ending in a
  // point; laid on the shell where a ray along the view meets it
  for (const [side, y0] of [[1, D.emblem.at[0]], [-1, D.emblem.at[1]]]) {
    const hit = (x, y) => surfaceAt(G, cols, R, z0, side, x, y);
    const [ro, ri] = D.emblem.ring, ring = [];
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; ring.push([Math.cos(a), Math.sin(a)]); }
    // (the annulus one closed piece, flat, square to the view, just in front of the shell under it: a raised medallion
    // over the yoke's point)
    const H = ring.map(([cx, cy]) => [hit(cx * ro, y0 + cy * ro), hit(cx * ri, y0 + cy * ri)]);
    if (H.flat().every(Boolean)) {
      const zf = side > 0 ? Math.max(...H.flat().map((h) => h.z)) : Math.min(...H.flat().map((h) => h.z)), lift = 0.012, h = D.emblem.raise;
      G.tag = 'ring';
      const V = (x, y, dz, srcOf) => { const v = G.vert([x, y, zf + side * dz], 'piece'); G.src ??= []; G.src[v] = srcOf; return v; };
      const vs = ring.map(([cx, cy], k) => [ro, ri].flatMap((r, m) => [lift, lift + h].map((dz) => V(cx * r, y0 + cy * r, dz, H[k][m].src))));
      // (per corner: outer bottom, outer top, inner bottom, inner top)
      for (let k = 0; k < 16; k++) {
        const [ob, ot, ib, it] = vs[k], [ob2, ot2, ib2, it2] = vs[(k + 1) % 16];
        G.poly([ot, ot2, it2, it], 'rune', 'piece'); G.poly([ob, ib, ib2, ob2], 'rune', 'piece');
        G.poly([ob, ob2, ot2, ot], 'rune', 'piece'); G.poly([ib, it, it2, ib2], 'rune', 'piece');
      }
    }
    // the stripes: from the ring's foot to the band's top at the centre line, in segments (following the shell)
    const [sx, sw] = D.emblem.stripes, c0 = cols[side > 0 ? 0 : N / 2], yBot = atRY(c0.deg, c0.BT0[0], c0.BT0[1], z0)[1] + 0.06, yTop = Math.min(y0 - ro - 0.04, atRY(c0.deg, c0.Y1b[0], c0.Y1b[1], z0)[1] - 0.04);
    for (const xs of [-sx, sx]) {
      const n = 6, segs = [];
      for (let i = 0; i <= n; i++) segs.push(yTop + (yBot - yTop) * (i / n));
      for (let i = 0; i < n; i++) {
        // (the last segment narrows to a point toward the centre line)
        const last = i === n - 1, x0 = xs - sw / 2, x1 = xs + sw / 2;
        const xin = xs > 0 ? x0 : x1, xo = xs > 0 ? x1 : x0;
        const q = last ? [hit(x0, segs[i]), hit(x1, segs[i]), hit(xin, segs[i + 1])] : [hit(x0, segs[i]), hit(x1, segs[i]), hit(x1, segs[i + 1]), hit(x0, segs[i + 1])];
        if (q.some((x) => !x)) continue;
        void xo;
        prism(G, q.map((x) => x.p), q.map((x) => x.n), D.emblem.raise, PLIFT, 'rune', 'stripe', q.map((x) => x.src));
      }
    }
  }
}

/**
 * The shell's outside where a ray along z (front, side 1: from in front; back, -1: from behind) through (x, y) first
 * meets it: point, normal, and the shell vertices of the face it meets (its weights).
 */
function surfaceAt(G, cols, R, z0, side, x, y) {
  const P = G.verts;
  let best = null;
  for (const p of G.polys) {
    if (p.part !== 'cape' && p.part !== 'collar') continue;
    for (let k = 1; k + 1 < p.v.length; k++) {
      const [a, b, c] = [P[p.v[0]], P[p.v[k]], P[p.v[k + 1]]];
      // barycentric in xy
      const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(den) < 1e-12) continue;
      const w0 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / den, w1 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / den, w2 = 1 - w0 - w1;
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
      const z = w0 * a[2] + w1 * b[2] + w2 * c[2];
      if (!best || side * z > side * best.z) {
        let n = unit(cross(sub(b, a), sub(c, a)));
        if (n[2] * side < 0) n = mul(n, -1);
        best = { z, p: [x, y, z], n, src: [[p.v[0], w0], [p.v[k], w1], [p.v[k + 1], w2]] };
      }
    }
  }
  return best;
}

/**
 * The weights: the shell's from the body (the collar's from the neck and the chest's top, the cape's from the closest
 * skin, its bones mapped to the torso), then shared with the cape's own bones over the arms (shawl.mjs's shares: none at
 * the collar, `top` of it at the yoke's top, all of it from the yoke's hem down); the leather's thickness moves as one
 * (each underside ring the outside's over it); each laid or hung piece its shell corners' weights.
 */
export function leatherShawlWeights(rig, G, o = {}) {
  const neck = { head: 'neck_02', jaw: 'neck_02', neck_02: 'neck_02', neck_01: 'neck_01' };
  const capeMap = (n) => {
    if (/^(spine_0[12]|pelvis|root)$/.test(n)) return 'spine_03';
    if (/^(head|jaw|neck_02)$/.test(n)) return 'neck_01';
    const m = n.match(/_(l|r)$/), s = m ? m[1] : null;
    if (s && /^(upperarm|lowerarm|hand|thumb|fingers|elbow|wrist|knuckles|shoulder)/.test(n)) return `clavicle_${s}`;
    if (s && /^(thigh|calf|foot|ball|hip|knee|ankle|toes)/.test(n)) return 'spine_03';
    return n;
  };
  const shell = new Set([...Object.values(G.rings).flat()]);
  const map = (n, i) => (G.part[i] === 'collar' ? neck[n] ?? 'spine_03' : capeMap(n));
  const vw = transferWeights(rig, G, { map, smooth: o.smooth ?? 24, only: (i) => shell.has(i) });
  const R = G.rings, N = R.Y0.length, Ld = G.design.lift, nb = rig.bones.length;
  const mix = (A, Bw, t) => { const o2 = new Map(); for (const [b, w] of A) o2.set(b, (o2.get(b) ?? 0) + w * (1 - t)); for (const [b, w] of Bw) o2.set(b, (o2.get(b) ?? 0) + w * t); return [...o2].filter(([, w]) => w > 1e-6).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([b, w], _, l) => [b, w / l.reduce((s2, [, x]) => s2 + x, 0)]); };
  const blendW = (list) => { const o2 = new Map(); for (const [i, t] of list) if (t > 0) for (const [b, w] of vw[i]) o2.set(b, (o2.get(b) ?? 0) + w * t); return [...o2].sort((x, y) => y[1] - x[1]).slice(0, 4).map(([b, w], _, l) => [b, w / l.reduce((s2, [, x]) => s2 + x, 0)]); };
  // (the outside's rings from the yoke's top down: their share of the cape's bones)
  const share = { Y0: Ld.top, Ym: 0.4 + 0.6 * Ld.top, YB0: 0.85, YB1: 0.85, YL: 0.9, Y1: 1, Y1b: 1, L1: 1, L2: 1, BT0: 1, BT1: 1, S1: 1, S2: 1, H: 1 };
  for (let k = 0; k < N; k++) {
    const deg = G.cols[k].deg, sn = Math.sin(deg * Math.PI / 180), side = sn > 0 ? 0 : 1;
    const a = Math.abs(((deg + 540) % 360) - 180), near = (at, r) => (Math.abs(a - at) < r ? Math.cos(90 / r * (a - at) * Math.PI / 180) : 0);
    const W = [Math.max(0, (Math.abs(sn) - Ld.from) / (1 - Ld.from)) ** 1.5, near(Ld.frontAt, Ld.reach[0]), near(Ld.backAt, Ld.reach[1])], t = W[0] + W[1] + W[2];
    if (t <= 0) continue;
    const own = W.map((w, j) => [nb + 3 * side + j, w / t]).filter(([, w]) => w > 0), all = Math.min(1, t);
    for (const [key, f] of Object.entries(share)) vw[R[key][k]] = mix(vw[R[key][k]], own, key === 'Y0' ? all * (Ld.top * W[0] + W[1] + W[2]) / t : f * all);
  }
  // the underside the outside's over it; the hem's lip the hem's
  const pair = { IH: 'H', IB: 'BT0', IY: 'Y1b', IM: 'Ym', IT: 'Y0' };
  for (let k = 0; k < N; k++) for (const [u, o2] of Object.entries(pair)) vw[R[u][k]] = vw[R[o2][k]];
  // the pieces: their shell corners'
  for (let i = 0; i < G.verts.length; i++) if (!shell.has(i)) vw[i] = blendW(G.src[i]);
  return vw;
}

/* ---- the game's copy ------------------------------------------------------------------------------------------------ */
export async function writeAssets() {
  const { writeFileSync } = await import('node:fs');
  const { buildRig } = await import('../lowrig.mjs');
  const { garmentAsset } = await import('../lowgarment.mjs');
  for (const who of ['male', 'female']) {
    const rig = buildRig(who), G = buildLeatherShawl(rig);
    G.vw = leatherShawlWeights(rig, G);
    const file = new URL(`../../../src/sculpt/assets/lowleathershawl-${who}.json`, import.meta.url);
    const A = { built: 'node tools/sculpt/garments/leathershawl.mjs (tools/sculpt/lowgarment.mjs garmentAsset)', ...garmentAsset(rig, G, MATS, LOOKS) };
    writeFileSync(file, JSON.stringify(A));
    console.log(who, `${G.verts.length} vertices, ${G.tris.length} triangles, ${A.base} + ${A.bones.length} bones: wrote`, file.pathname);
  }
}
if (import.meta.url === `file://${process.argv[1]}`) await writeAssets();
