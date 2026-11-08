// The plate armour set's fur mantle (the sheet: a shoulder mantle of feathered fur, worn over the plate chest piece's
// high collar and pauldrons): a neck base ring with a dark lining, and over it tiers of faceted pointed tufts laid one
// over another, the front open between two round gold clasps with gem centres (glowing when enchanted). Shoulders and the upper
// chest; no hanging cloak. One design for both bodies, scaled to the body (DESIGN, per body), skinned to its rig's
// clavicles, spine_03 and upper arms (no bones of its own).
//
//   buildMantle(rig, design?, { under }) → { verts, polys: [{ v, mat, part, tag }], tris, part, design, tiers }
//   mantleWeights(rig, G) → per vertex [[bone, weight], ...] (the body's bones only)
//
//   node tools/sculpt/garments/mantle.mjs
//     writes the game's copy beside each body: src/sculpt/assets/lowmantle-male.json and lowmantle-female.json
//     (lowgarment.mjs garmentAsset; loaded by src/sculpt/lowpoly.ts)
//
// The shape, round a vertical axis through the neck (azimuth 0 the front, 90 the body's left):
//   the ring: the neck base, a band round the neck's foot (its inside the dark lining, its top the gold rim), higher
//   behind than in front;
//   the layers: three pelts of thick fur, each its own outline, laid one over another down the body's line from the ring
//   (lowgarment.mjs drape over the body, or what is worn under the mantle, grown by OUT; each layer's underside off the
//   outside of the ones under it by `gap`): `main` the lowest, far down the back and over the upper arms, a deep V
//   behind; `mid2` about two thirds of it, a rounder hem; `mid1` from the ring, down to the shoulder blades and just
//   over the shoulders, the furthest round the front; and the `collar`, rising from the ring round the neck, leaning
//   out. Each layer is a ring of fur clumps over an arc of azimuths (the front left open), each clump a thick blunt
//   point: its root row (thin, tucked under the layer over it), a ridge down its middle, its hem (two corners and a blunt
//   tip) with its thickness showing as a darker edge, its underside; between two clumps a groove of darker fur from the
//   root to the hem. Each layer is one closed shell.
//   the clasps: two discs on the top layer's front ends, a gold rim round a gem centre (core; glowing when enchanted).
// Fitting room for the plate chest piece (its high collar and pauldrons) while it is not here to fit over: the body's
// shoulders grown by `room.pauldron` round the shoulder joint, a stand-up collar `room.collar` off the neck's foot.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { samplesOf, envelope, drape, reachAt, atRY, dirOf, meshOf, orient, trisOf, transferWeights, crossPairs, sub, add, mul, unit, cross, dot, lerp } from '../lowgarment.mjs';

/** The mantle's colours: the fur's cream, its underside a shade darker, the groove between clumps darker again, the neck's lining (the set's dark under-layer), gold, the clasps' gem cores (plain). */
export const MATS = {
  fur: [0.92, 0.74, 0.62],
  fur_under: [0.77, 0.59, 0.5],
  fur_valley: [0.6, 0.43, 0.37],
  under: [0.29, 0.22, 0.2],
  gold: [0.96, 0.74, 0.4],
  core: [0.86, 0.62, 0.3],
};
/**
 * The two looks (the plate set's: tools/sculpt/lowgarment.mjs garmentAsset `looks`): plain, the metals (the gold, the
 * clasps' gem cores, the ring's under-layer) lit as metal (kind 2), the fur as cloth; enchanted, the clasps' cores unlit
 * and glowing (kind 1). The fur never glows.
 */
const METAL = (n) => ({ c: MATS[n], kind: 2 });
export const LOOKS = {
  plain: { gold: METAL('gold'), core: METAL('core'), under: METAL('under') },
  enchanted: { gold: METAL('gold'), under: METAL('under'), core: { c: [1.0, 0.906, 0.651], kind: 1 } },
};

/**
 * The design, in the man's units; `scale` takes it to a body (lengths along the body, the tufts' size; the shape round
 * the body is the body's own).
 *   z0: the axis; OUT: the fur's underside off the body (or what is under it); gap: each tier's underside off the
 *   outside of the tiers under it; snug: the least share of that stand-off a layer is tried at (it takes the least that
 *   clears what is under it);
 *   room: fitting room for the chest piece: the shoulders grown by `pauldron` within `reach` of the shoulder joint
 *   (`at`: the joint's point inside the shoulder, off the upper arm's head), the neck's foot by `collar` up to `collarH`;
 *   ring: the neck base: `in` off the neck (or the room's collar), its thickness `t`, its top over the neck's foot
 *   [front, side, back], its foot under it `drop`, `cols` columns round;
 *   depth: how far down the body's line the layers may reach; lean: below the shoulder's corner the line leans out by
 *   this per unit of drop [front, side, back]; raise: the layers' line starts this over the ring's top [front, side, back];
 *   tiers (lowest first): each { name, n clumps, from (degrees from the front where it starts, each side), hem
 *   ([deg from the front, length along the body's line] of the clumps' corners), root (its clumps' root, a share of the
 *   hem of the layer over it; the top layer's at the ring), ridge (where the ridge stands, a share from the root to the
 *   hem), tip (the clumps' blunt tips past the hem), endW (the two clumps at the front ends, a share of the others' width), thick (at the root), h (the ridge off it), edge (the hem's
 *   thickness), flare (the hem out off the layer under it) };
 *   collar: the rising layer: n, from, len ([deg, length]), lean (degrees out from upright [front, side, back]), hem (a
 *   share of len), thick, h, edge, flare, foot (its root under the ring's top);
 *   clasp: on the layer `on`, at `at` degrees from the front and `s` along it, radius r, thickness t, boss (the
 *   centre's rise), sides;
 *   jit: the tufts' unevenness: tip length, the boundaries' spacing, the ridge's height (shares).
 */
export const DESIGN = {
  male: {
    scale: 1, z0: -0.12, OUT: 0.04, gap: 0.04, snug: 0.3,
    room: { pauldron: 0.24, reach: 1.15, at: 0.35, collar: 0.16, collarH: 0.5 },
    ring: { in: 0.04, t: 0.07, top: [0.12, 0.3, 0.32], drop: 0.08, cols: 12, near: 0.35 },
    depth: 6, lean: [0.06, 0.04, 0.06], raise: [0.06, 0.12, 0.1], dome: { h: [0.05, 0.3, 0.12], a: [0.4, 0.6, 0.5] },
    tiers: [
      { name: 'main', n: 19, from: 33, hem: [[33, 1.6], [60, 1.5], [90, 1.15], [130, 2.0], [155, 2.5], [180, 3.0]], root: 0.55, ridge: 0.62, tip: 0.45, endW: 0.6, thick: 0.12, h: 0.14, edge: 0.1, flare: 0.12 },
      { name: 'mid2', n: 17, from: 28, hem: [[28, 1.2], [60, 1.1], [90, 0.95], [130, 1.6], [160, 1.9], [180, 2.15]], root: 0.5, ridge: 0.68, tip: 0.38, endW: 0.6, thick: 0.12, h: 0.13, edge: 0.1, flare: 0.1 },
      { name: 'mid1', n: 15, from: 21, hem: [[21, 0.85], [60, 0.7], [90, 0.55], [130, 1.0], [180, 1.35]], root: 0, ridge: 0.6, tip: 0.32, endW: 0.4, thick: 0.12, h: 0.12, edge: 0.09, flare: 0.09 },
    ],
    collar: { n: 10, from: 34, len: [[34, 0.8], [90, 1.1], [180, 0.9]], lean: [20, 20, 16], hem: 0.66, ridge: 0.55, thick: 0.08, h: 0.08, edge: 0.07, flare: 0.05, foot: 0.14 },
    clasp: { on: 'mid1', at: 26, s: 0.7, r: 0.36, t: 0.07, boss: 0.05, sides: 8 },
    jit: { tip: 0.16, side: 0.22, h: 0.25 },
  },
};
DESIGN.female = { ...DESIGN.male, scale: 0.86, hemK: { main: 1.1, mid2: 1.2, mid1: 1.45 }, z0: -0.14, room: { ...DESIGN.male.room, pauldron: 0.26, reach: 1.0 } };
// (the numbers as tools/sculpt/lowmantlefit.mjs fitted them to the sheet, per body, over the plate chest piece)
{
  const file = new URL('../lowmantle-design.json', import.meta.url).pathname;
  if (existsSync(file)) { const F = JSON.parse(readFileSync(file, 'utf8')); for (const who of ['male', 'female']) if (F[who]) DESIGN[who] = F[who]; }
}

/* ---- helpers --------------------------------------------------------------------------------------------------------- */
const hash = (i, j) => { const x = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453; return x - Math.floor(x); };
const interp = (table, x) => {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) if (x <= table[i][0]) { const [x0, y0] = table[i - 1], [x1, y1] = table[i]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); }
  return table[table.length - 1][1];
};
/** Degrees from the front, 0 to 180. */
const fromFront = (deg) => Math.abs(((deg % 360) + 540) % 360 - 180);
/** A value [front, side, back] round the azimuth by the cosine. */
const blend3 = ([f, s, b], deg) => { const c = Math.cos(deg * Math.PI / 180); return c > 0 ? f * c + s * (1 - c) : b * -c + s * (1 + c); };
const P2 = { add: (a, b) => [a[0] + b[0], a[1] + b[1]], sub: (a, b) => [a[0] - b[0], a[1] - b[1]], mul: (a, k) => [a[0] * k, a[1] * k], len: (a) => Math.hypot(a[0], a[1]) };
/** The outward normal (away from the axis, or up) of a segment a→b in (r, y). */
const outN = (a, b) => { const d = P2.sub(b, a), l = P2.len(d) || 1; const n = [-d[1] / l, d[0] / l]; return n[0] < 0 || (Math.abs(n[0]) < 1e-9 && n[1] < 0) ? [-n[0], -n[1]] : n; };

/** The neck's foot (the body's ring nm0..nm5, both sides) where the half-plane of azimuth deg crosses it: [r, y]. */
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

/**
 * Fitting room for the plate chest piece while it is not here: points of the body's shoulders pushed out by `pauldron`
 * from a point inside each shoulder (falling off past `reach`), and a stand-up collar `collar` off the neck's foot.
 */
export function roomSamples(rig, D, S) {
  const R = D.room;
  if (!R) return [];
  const out = [];
  for (const s of ['l', 'r']) {
    const U = rig.bones[rig.at.get(`upperarm_${s}`)].head, C = [U[0] - Math.sign(U[0]) * R.at, U[1] + 0.1, U[2]];
    for (const p of S) {
      if (Math.sign(p[0]) !== Math.sign(U[0]) || Math.abs(p[0]) < 0.35) continue;
      const d = Math.hypot(...sub(p, C)), w = d < R.reach ? 1 : d < R.reach + 0.4 ? 1 - (d - R.reach) / 0.4 : 0;
      if (w <= 0 || p[1] < U[1] - 0.9) continue;
      out.push(add(p, mul(unit(sub(p, C)), R.pauldron * w)));
    }
  }
  for (let deg = 0; deg < 360; deg += 6) {
    const F = neckFoot(rig.B, D.z0, deg);
    for (let y = F[1] - 0.15; y <= F[1] + R.collarH; y += 0.05) out.push(atRY(deg, F[0] + R.collar, y, D.z0));
  }
  return out;
}

/**
 * Points of a hard piece pushed out by `by`, a clearance over it: round the neck (within 1 of the axis at z0, above the
 * chest's top) straight out from the axis, elsewhere out from the shoulder's middle.
 */
function grownOf(P, by, z0) {
  return P.map((p) => {
    const rr = Math.hypot(p[0], p[2] - z0);
    if (rr < 1.0 && p[1] > -1.0) return [p[0] + (p[0] / rr) * by, p[1], p[2] + ((p[2] - z0) / rr) * by];
    const c = [Math.sign(p[0]) * Math.min(Math.abs(p[0]), 1.2), Math.min(p[1], -0.6), -0.1], d = unit(sub(p, c));
    return add(p, mul(d, by));
  });
}

/* ---- the shape -------------------------------------------------------------------------------------------------------- */
/**
 * The plate chest piece the mantle is worn over, at rest (its asset, src/sculpt/assets/lowplatechest-<who>.json, or one in
 * the directory MANTLE_CHEST_DIR names) as a mesh { verts, tris, polys, vw (its weights), hides, plain (its look), mats },
 * or null where it is not there.
 */
export function chestOf(who) {
  const dir = process.env.MANTLE_CHEST_DIR ?? new URL('../../../src/sculpt/assets/', import.meta.url).pathname, file = join(dir, `lowplatechest-${who}.json`);
  if (!existsSync(file)) return null;
  const A = JSON.parse(readFileSync(file, 'utf8')), verts = [], tris = [];
  for (let i = 0; i < A.verts.length; i += 3) verts.push(A.verts.slice(i, i + 3));
  for (let i = 0; i < A.tris.length; i += 4) tris.push({ v: A.tris.slice(i, i + 3), poly: A.tris[i + 3] });
  const polys = A.polys.map(([v, m]) => ({ v, mat: A.mats[m] })), vw = A.weights.map((w) => { const o = []; for (let k = 0; k < w.length; k += 2) o.push([w[k], w[k + 1]]); return o; });
  return { verts, tris, polys, vw, hides: A.hides ?? [], plain: A.plain, mats: A.mats };
}

export function buildMantle(rig, design = DESIGN[rig.who], { under = [], chest = chestOf(rig.who) } = {}) {
  const { B } = rig, D = design, z0 = D.z0, k = D.scale;
  // over the chest piece where it is here (its collar and pauldrons, grown by chestClear); else the fitting room for it
  const S0 = [...samplesOf(B), ...under.flatMap((m) => samplesOf(m))];
  const SC = chest ? grownOf(samplesOf(chest), D.chestClear ?? 0.06, D.z0) : [];
  const S = chest ? [...S0, ...SC] : [...S0, ...roomSamples(rig, D, S0)];
  // (the chest piece's collar, for the ring: its points round the neck, whatever their reach)
  const SN = SC.filter((p) => Math.hypot(p[0], p[2] - z0) < 1.3 && p[1] > -1.2);
  // the columns: every STEP degrees, each the ring's section and the body's line down from it
  const STEP = 4, NC = 360 / STEP, cols = [];
  // the ring's section per column: inside off the neck (or the room's collar) by `in`, its top and foot
  for (let c = 0; c < NC; c++) {
    const deg = c * STEP, F = neckFoot(B, z0, deg);
    const E0 = envelope(S, z0, deg, STEP, D.ring.in, F[1] - 0.3, F[1] + 0.8);
    let yT = F[1] + blend3(D.ring.top, deg) * k, yB = F[1] - D.ring.drop * k;
    let rI = F[0] + D.ring.in;
    // (only what stands round the neck: the shoulders beside it are the tiers' to clear)
    const En = E0.filter(([r]) => r < F[0] + D.ring.near * k);
    for (let y = yB; y <= yT + 1e-9; y += 0.04) rI = Math.max(rI, reachAt(En, y, 0.04));
    // (on the chest piece where it is under the ring: the ring's foot over its top there)
    if (SN.length) {
      const r1 = rI + D.ring.t * k / Math.cos(Math.PI / D.ring.cols) + 0.12;
      let hc = -Infinity;
      for (const p of SN) { const r = Math.hypot(p[0], p[2] - z0); if (r < rI - 0.15 || r > r1) continue; if (Math.abs(((Math.atan2(p[0], p[2] - z0) * 180 / Math.PI - deg + 540) % 360) - 180) > 2 * STEP) continue; hc = Math.max(hc, p[1]); }
      if (hc + 0.03 > yB) { yB = hc + 0.03; yT = Math.max(yT, yB + 0.12 * k); }
    }
    cols.push({ deg, F, yT, yB, rI });
  }
  // the ring itself: `cols` columns round, each the furthest of the sections within half a column of it, out by 1/cos of
  // that half so its chords stay outside every section
  const ring = [], nR = D.ring.cols, hw = 180 / nR;
  for (let j = 0; j < nR; j++) {
    const deg = (j * 360) / nR, near = cols.filter((c) => Math.abs(((c.deg - deg + 540) % 360) - 180) <= hw + 1e-9);
    const rI = Math.max(...near.map((c) => c.rI)) / Math.cos(hw * Math.PI / 180), c0 = cols[Math.round(deg / STEP) % NC];
    ring.push({ deg, rI, rO: rI + D.ring.t * k, yT: c0.yT, yB: c0.yB });
  }
  // (rounded: no column far inside its two neighbours, so the ring has no sharp corner for the fur to catch)
  for (let it = 0; it < 4; it++) ring.forEach((q, j) => { const m = 0.5 * (ring[(j + nR - 1) % nR].rI + ring[(j + 1) % nR].rI); if (q.rI < m) { q.rI = m; q.rO = m + D.ring.t * k; } });
  // (the ring's outside where the half-plane of azimuth deg crosses its chords: [r, top, foot])
  const ringAt = (deg) => {
    const x = (((deg % 360) + 360) % 360) / (360 / nR), j = Math.floor(x) % nR, a = ring[j], b = ring[(j + 1) % nR], d = dirOf(deg);
    const pa = dirOf(a.deg).map((v) => v * a.rO), pb = dirOf(b.deg).map((v) => v * b.rO), ex = pb[0] - pa[0], ez = pb[2] - pa[2], den = d[0] * ez - d[2] * ex;
    const r = (pa[0] * ez - pa[2] * ex) / den, t = (pa[0] * d[2] - pa[2] * d[0]) / den;
    return [r, a.yT + (b.yT - a.yT) * t, a.yB + (b.yB - a.yB) * t];
  };
  // (the ring's furthest outside within `half` degrees of deg: what a chord of the fur from there must clear)
  const ringMax = (deg, half) => { let m = 0; for (let d = -half; d <= half; d += 2) m = Math.max(m, ringAt(deg + d)[0]); return m; };
  for (const col of cols) {
    const deg = col.deg, [rO, yT] = ringAt(deg);
    // the collar rises from the ring's outside at yT - foot, leaning out; the body's line starts outside its root
    const C = D.collar, th = blend3(C.lean, deg) * Math.PI / 180, cy = yT + blend3(D.raise, deg) * k;
    const cw = ((360 - 2 * C.from) / C.n / 2) * (1 + D.jit.side), cr = ringMax(deg, cw) / Math.cos(cw * Math.PI / 180) + 0.04 + (cy - yT + C.foot * k) * Math.tan(th) + D.gap + (Math.max(C.thick + C.h * (1 + D.jit.h), C.edge + C.flare) * k + D.gap) / Math.cos(th);
    // the body's line from there down: the drape over the body grown by OUT, below the shoulder's corner leaning out
    const A = [cr, cy], E = envelope(S, z0, deg, STEP, D.OUT, A[1] - D.depth, A[1] + 0.01).filter(([, y]) => y < A[1] - 1e-4);
    let L = drape(E, A, A[1] - D.depth);
    const ci = L.findIndex((p, i) => i > 0 && (L[i - 1][1] - p[1]) > 1.2 * (p[0] - L[i - 1][0]));
    if (ci > 0) { const yc = L[ci - 1][1], lean = blend3(D.lean, deg); L = L.map((p, i) => (i >= ci ? [p[0] + (yc - p[1]) * lean, p[1]] : p)); }
    // (over the shoulders the sheet's fur is a mound: the line lifted along its normal by h sin(pi s / 2a) for its first 2a)
    if (D.dome) {
      const h = blend3(D.dome.h, deg) * k, a = blend3(D.dome.a, deg) * k;
      if (h > 0 && a > 0) {
        const cum = [0];
        for (let i = 1; i < L.length; i++) cum.push(cum[i - 1] + P2.len(P2.sub(L[i], L[i - 1])));
        const at = (sv) => { for (let i = 0; i + 1 < L.length; i++) if (sv <= cum[i + 1] || i + 2 === L.length) { const t = Math.min(1, (sv - cum[i]) / Math.max(1e-9, cum[i + 1] - cum[i])); return [P2.add(L[i], P2.mul(P2.sub(L[i + 1], L[i]), t)), outN(L[i], L[i + 1])]; } };
        const out = [];
        for (let sv = 0; sv < 2 * a; sv += 0.05) { const [p, n] = at(sv); out.push(P2.add(p, P2.mul(n, h * Math.sin((Math.PI * sv) / (2 * a))))); }
        L = [...out, ...L.filter((_, i) => cum[i] >= 2 * a)];
      }
    }
    const s = [0];
    for (let i = 1; i < L.length; i++) s.push(s[i - 1] + P2.len(P2.sub(L[i], L[i - 1])));
    // (each point's normal: the mean of its segments')
    const segN = L.slice(1).map((p, i) => outN(L[i], p));
    const N = L.map((_, i) => { const a = segN[Math.max(0, i - 1)], b = segN[Math.min(segN.length - 1, i)], m = P2.add(a, b), l = P2.len(m) || 1; return [m[0] / l, m[1] / l]; });
    Object.assign(col, { rO, yT, L, s, N });
  }
  // a point at azimuth deg, arc length s down the body's line, `off` off it (between the two nearest columns)
  const onLine = (c, sv) => {
    const { L, s, N } = c;
    if (sv <= 0) return { p: P2.add(L[0], P2.mul(N[0], 0)), n: N[0], p0: L[0], d: sv };
    for (let i = 0; i + 1 < L.length; i++) if (sv <= s[i + 1] || i + 2 === L.length) {
      const t = Math.min(1, (sv - s[i]) / Math.max(1e-9, s[i + 1] - s[i])), n = P2.add(P2.mul(N[i], 1 - t), P2.mul(N[i + 1], t)), l = P2.len(n);
      return { p: [L[i][0] + (L[i + 1][0] - L[i][0]) * t, L[i][1] + (L[i + 1][1] - L[i][1]) * t], n: [n[0] / l, n[1] / l] };
    }
  };
  const colPair = (deg) => { const x = (((deg % 360) + 360) % 360) / STEP, i = Math.floor(x) % NC, t = x - Math.floor(x); return [cols[i], cols[(i + 1) % NC], t]; };
  const sec = (deg, sv, off) => {
    const [a, b, t] = colPair(deg), qa = onLine(a, sv), qb = onLine(b, sv);
    const pa = P2.add(qa.p, P2.mul(qa.n, off)), pb = P2.add(qb.p, P2.mul(qb.n, off));
    return P2.add(P2.mul(pa, 1 - t), P2.mul(pb, t));
  };
  const at3 = (deg, rv) => atRY(deg, rv[0], rv[1], z0);
  const G = meshOf();
  G.tiers = {};
  // ---- the ring
  {
    const n = D.ring.cols, R = { OB: [], OT: [], IT: [], IB: [] };
    for (let j = 0; j < n; j++) {
      const { deg, rI, rO, yT, yB } = ring[j];
      R.OB.push(G.vert(at3(deg, [rO, yB]), 'ring')); R.OT.push(G.vert(at3(deg, [rO, yT]), 'ring'));
      R.IT.push(G.vert(at3(deg, [rI, yT + 0.02 * k]), 'ring')); R.IB.push(G.vert(at3(deg, [rI, yB]), 'ring'));
    }
    G.tag = 'ring';
    for (let j = 0; j < n; j++) {
      const i = (j + 1) % n;
      G.poly([R.OB[j], R.OB[i], R.OT[i], R.OT[j]], 'under', 'ring');
      G.poly([R.OT[j], R.OT[i], R.IT[i], R.IT[j]], 'gold', 'ring');
      G.poly([R.IT[j], R.IT[i], R.IB[i], R.IB[j]], 'under', 'ring');
      G.poly([R.IB[j], R.IB[i], R.OB[i], R.OB[j]], 'under', 'ring');
    }
    G.ring = R;
  }
  // ---- the layers, from the lowest up: each one's underside over the outside of the ones under it
  const DS = 0.05, NS = Math.ceil(D.depth / DS) + 1;
  const top = cols.map(() => new Float32Array(NS));   // per column, the outside's offset off the line so far, by s
  const rAt = cols.map((c) => Array.from({ length: NS }, (_, j) => onLine(c, j * DS).p[0]));
  const seed = { main: 1, mid2: 2, mid1: 3, collar: 4 };
  const hemOf = (T) => (deg) => interp(T.hem, fromFront(deg)) * k * (D.hemK?.[T.name] ?? 1);
  D.tiers.forEach((T, ti) => {
    const above = D.tiers[ti + 1], hem = hemOf(T), rootS = above ? (deg) => T.root * hemOf(above)(deg) : () => 0;
    // the layer's underside offset per column and s: the outside of those under it plus gap, spread by a slope so it
    // rises smoothly, and the sag of its own faces (each spans a clump's width w round the axis, a chord, inside the
    // circle by r (1 - cos w/2))
    const sag = 1 - Math.cos(((360 - 2 * T.from) / T.n / 2) * (1 + D.jit.side) * Math.PI / 180);
    const und = cols.map((c, ci) => {
      const o = new Float32Array(NS), tp = top[ci];
      for (let i = 0; i < NS; i++) { let m = 0; for (let j = 0; j < NS; j++) if (tp[j] > 0) m = Math.max(m, tp[j] + D.gap + sag * rAt[ci][j] - 0.6 * Math.abs(i - j) * DS); o[i] = m; }
      return o;
    });
    // (and the bend of the line under each clump: its underside is one face from the root to the tip, a chord of the line,
    // so the whole layer stands off by as much as the line, with what is under it, bulges past that chord)
    cols.forEach((c, ci) => {
      if (fromFront(c.deg) < T.from - STEP - 1) return;
      const r0 = rootS(c.deg), e = Math.min(D.depth - DS, hem(c.deg) + T.tip * k * (1 + D.jit.tip)), u = und[ci];
      const at = (sv, o) => { const q = onLine(c, sv); return P2.add(q.p, P2.mul(q.n, o)); }, ix = (sv) => Math.max(0, Math.min(NS - 1, Math.round(sv / DS)));
      const A0 = at(r0, u[ix(r0)]), A1 = at(e, u[ix(e)] + T.flare * k), d = P2.sub(A1, A0), l = P2.len(d) || 1, nn = [-d[1] / l, d[0] / l];
      const nOut = nn[0] < 0 ? [-nn[0], -nn[1]] : nn;
      let bump = 0;
      for (let sv = r0 + DS; sv < e; sv += DS) { const Q = at(sv, u[ix(sv)]); bump = Math.max(bump, (Q[0] - A0[0]) * nOut[0] + (Q[1] - A0[1]) * nOut[1]); }
      if (bump > 0) for (let i = 0; i < NS; i++) u[i] += bump;
    });
    // that much is enough everywhere but more than most places need: the layer is laid at the least share f of it (from
    // D.snug up, in steps) that leaves it clear of everything laid before it, so it lies as close as it can
    const placed = trisOf(G);
    let f = D.snug ?? 1;
    for (;; f = Math.min(1, f + 0.1)) {
      const offAt = (deg, sv) => { const [a, b, t] = colPair(deg), ia = cols.indexOf(a), ib = cols.indexOf(b), i = Math.max(0, Math.min(NS - 1, Math.round(sv / DS))); return f * (und[ia][i] * (1 - t) + und[ib][i] * t); };
      const pos = (deg, sv, lift) => at3(deg, sec(deg, sv, offAt(deg, sv) + lift));
      const Gt = meshOf(), shell = tierShell(Gt, T, seed[T.name], pos, { root: rootS, hem, tip: () => T.tip * k }, D, k);
      if (f < 1 && crossPairs(Gt.verts, trisOf(Gt), G.verts, placed).length) continue;
      G.tiers[T.name] = { ...appendMesh(G, Gt, shell), pos, f };
      break;
    }
    for (const u of und) for (let i = 0; i < NS; i++) u[i] *= f;
    // its outside, for the layers over it (the most of its ridge and its hem, from its root to its tips)
    const out = Math.max(T.thick + T.h * (1 + D.jit.h), T.edge + T.flare) * k;
    cols.forEach((c, ci) => {
      if (fromFront(c.deg) < T.from - STEP - 1) return;
      const r0 = rootS(c.deg), r1 = hem(c.deg) + T.tip * k * (1 + D.jit.tip);
      for (let i = 0; i < NS; i++) { const sv = i * DS; if (sv >= r0 - 0.05 && sv <= r1 + 0.1) top[ci][i] = Math.max(top[ci][i], und[ci][i] + out); }
    });
  });
  // ---- the collar: rising from under the ring's top, leaning out
  {
    const C = D.collar, len = (deg) => interp(C.len, fromFront(deg)) * k;
    const pos = (deg, sv, lift) => {
      const [, yT] = ringAt(deg), cw = ((360 - 2 * C.from) / C.n / 2) * (1 + D.jit.side), rO = ringMax(deg, cw);
      const th = blend3(C.lean, deg) * Math.PI / 180, dir = [Math.sin(th), Math.cos(th)], nrm = [Math.cos(th), -Math.sin(th)];
      const [, , yB] = ringAt(deg), root = [rO / Math.cos(cw * Math.PI / 180) + 0.04, Math.max(yT - C.foot * k, yB + 0.03)];
      return at3(deg, P2.add(P2.add(root, P2.mul(dir, sv)), P2.mul(nrm, lift + D.gap)));
    };
    G.tiers.collar = tierShell(G, { ...C, name: 'collar' }, seed.collar, pos, { root: () => 0, hem: (deg) => C.hem * len(deg), tip: (deg) => (1 - C.hem) * len(deg) }, D, k);
  }
  // ---- the clasps
  G.clasps = ['l', 'r'].map((side) => {
    const Cl = D.clasp, T = D.tiers.find((t) => t.name === Cl.on), deg = side === 'l' ? Cl.at : 360 - Cl.at;
    const sv = Cl.s * k, tierPos = G.tiers[Cl.on].pos, lift = (T.thick + T.h * (1 + D.jit.h)) * k + 0.16;
    const c = tierPos(deg, sv, lift), u = tierPos(deg, sv - 0.1, lift), w = tierPos(deg + 3, sv, lift);
    const nrm = unit(cross(sub(w, c), sub(u, c))), n2 = dot(nrm, [Math.sin(deg * Math.PI / 180), 0, Math.cos(deg * Math.PI / 180)]) < 0 ? mul(nrm, -1) : nrm;
    return clasp(G, c, n2, Cl, k, side);
  });
  orient(G, (p) => [p[0], 0, p[2] - z0]);
  G.tris = trisOf(G);
  G.design = D; G.cols = cols;
  return G;
}

/** Gt's vertices and polygons appended to G; the shell's vertex rows renumbered to G's. */
function appendMesh(G, Gt, shell) {
  const o = G.verts.length;
  Gt.verts.forEach((p, i) => G.vert(p, Gt.part[i]));
  for (const p of Gt.polys) G.polys.push({ ...p, v: p.v.map((v) => v + o) });
  const out = {};
  for (const [key, val] of Object.entries(shell)) out[key] = Array.isArray(val) && key !== 'b' ? val.map((v) => v + o) : val;
  return out;
}

/**
 * One layer: n clumps over the arc from `from` degrees off the front round the back to the same on the other side, at
 * pos(deg, s, lift) (s along the layer's line; lift off its underside); at azimuth deg its clumps' root at S.root(deg),
 * their hem's corners at S.hem(deg), their blunt tips S.tip(deg) further. Its rows: the root at the boundaries between
 * clumps (TO: thin, tucked under the layer over it); each clump's rounded hem, five points (its two corners Lc, Rc a
 * little in from the boundaries, two shoulders SL, SR and the tip P), each on the outside and on the underside (u...:
 * the hem's thickness `edge`), its ridge (R, standing off by h) over the underside's own (uR, so the underside follows
 * the line's bend); between two clumps the groove from the root to their corners, its edge and its underside. One
 * closed shell, 26 triangles a clump.
 */
function tierShell(G, T, sd, pos, S, D, k) {
  const n = T.n, a0 = T.from, a1 = 360 - T.from, J = D.jit;
  // (the clumps at the front ends narrower, `endW` of the others: the line twists there, from down the chest to over the shoulder)
  const ew = T.endW ?? 1, unitW = (a1 - a0) / (n - 2 + 2 * ew), at = (j) => (j === 0 ? a0 : j === n ? a1 : a0 + unitW * (ew + j - 1));
  const b = Array.from({ length: n + 1 }, (_, j) => (j === 0 || j === n ? at(j) : at(j) + (hash(sd, j) - 0.5) * J.side * unitW * (j === 1 || j === n - 1 ? ew : 1)));
  const thick = T.thick * k, edge = T.edge * k, part = T.name;
  const TO = b.map((d) => G.vert(pos(d, S.root(d), 0), part));
  const C = { Lc: [], SL: [], P: [], SR: [], Rc: [] }, U = { Lc: [], SL: [], P: [], SR: [], Rc: [] }, R = [], uR = [];
  const pair = (key, d, sv, lift, e) => { C[key].push(G.vert(pos(d, sv, lift + e), part)); U[key].push(G.vert(pos(d, sv, lift), part)); };
  for (let q = 0; q < n; q++) {
    const w = b[q + 1] - b[q], c = (b[q] + b[q + 1]) / 2 + (hash(sd + 10, q) - 0.5) * 0.2 * w;
    // (each clump its own length, ridge and hem: a little uneven)
    const r0 = S.root(c), tip = S.tip(c) * (1 + (hash(sd + 20, q) - 0.5) * 2 * J.tip), hq = T.h * k * (1 + (hash(sd + 30, q) - 0.5) * 2 * J.h);
    const vL = S.hem(b[q]) * (1 + (hash(sd + 40, q) - 0.5) * 0.08), vR = S.hem(b[q + 1]) * (1 + (hash(sd + 41, q) - 0.5) * 0.08), vC = S.hem(c);
    const end = vC + tip, fl = (sv) => T.flare * k * Math.max(0, (sv - r0) / Math.max(1e-6, end - r0));
    const dL = b[q] + 0.04 * w, dR = b[q + 1] - 0.04 * w;
    // (the shoulders: most of the way down to the tip, a little out to the side, each a little uneven: a round, lumpy hem)
    const sL = vL + (end - vL) * (0.62 + (hash(sd + 42, q) - 0.5) * 0.2), sR = vR + (end - vR) * (0.62 + (hash(sd + 43, q) - 0.5) * 0.2);
    const aL = dL + (c - dL) * 0.42, aR = dR + (c - dR) * 0.42;
    pair('Lc', dL, vL, fl(vL), edge); pair('SL', aL, sL, fl(sL), edge * 0.9); pair('P', c, end, fl(end), edge * 0.7); pair('SR', aR, sR, fl(sR), edge * 0.9); pair('Rc', dR, vR, fl(vR), edge);
    const sr = r0 + (vC - r0) * T.ridge;
    R.push(G.vert(pos(c, sr, fl(sr) + edge + hq), part)); uR.push(G.vert(pos(c, sr, fl(sr)), part));
  }
  G.tag = part;
  const H = ['Lc', 'SL', 'P', 'SR', 'Rc'];
  for (let q = 0; q < n; q++) {
    // the clump's outside: the root's face up to the ridge, its two flanks, the four faces down to its hem
    G.poly([TO[q], TO[q + 1], R[q]], 'fur', part);
    G.poly([TO[q], R[q], C.Lc[q]], 'fur', part);
    G.poly([TO[q + 1], C.Rc[q], R[q]], 'fur', part);
    for (let h = 0; h < 4; h++) G.poly([C[H[h]][q], R[q], C[H[h + 1]][q]], 'fur', part);
    // its hem's thickness, and its underside (from the root to its own ridge, then fanned to the hem)
    for (let h = 0; h < 4; h++) G.poly([C[H[h]][q], C[H[h + 1]][q], U[H[h + 1]][q], U[H[h]][q]], 'fur_under', part);
    G.poly([TO[q], uR[q], TO[q + 1]], 'fur_under', part);
    G.poly([TO[q], U.Lc[q], uR[q]], 'fur_under', part);
    G.poly([TO[q + 1], uR[q], U.Rc[q]], 'fur_under', part);
    for (let h = 0; h < 4; h++) G.poly([uR[q], U[H[h]][q], U[H[h + 1]][q]], 'fur_under', part);
  }
  for (let j = 1; j < n; j++) {
    // the groove between two clumps: its floor, its edge at the hem, its underside
    G.poly([TO[j], C.Lc[j], C.Rc[j - 1]], 'fur_valley', part);
    G.poly([C.Rc[j - 1], C.Lc[j], U.Lc[j], U.Rc[j - 1]], 'fur_under', part);
    G.poly([TO[j], U.Rc[j - 1], U.Lc[j]], 'fur_under', part);
  }
  // the ends
  G.poly([TO[0], C.Lc[0], U.Lc[0]], 'fur_under', part);
  G.poly([TO[n], U.Rc[n - 1], C.Rc[n - 1]], 'fur_under', part);
  return { TO, TI: TO, Lc: C.Lc, Rc: C.Rc, P: C.P, R, b, pos };
}

/** A clasp: a disc of `sides` round centre c facing n: the gold rim (front face and edge) round the gem centre (a low boss). */
function clasp(G, c, n, C, k, side) {
  const up = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0], u = unit(cross(up, n)), v = cross(n, u), r = C.r * k, t = C.t * k, part = `clasp_${side}`;
  const ring = (rad, h) => Array.from({ length: C.sides }, (_, j) => { const a = (j / C.sides) * 2 * Math.PI + Math.PI / C.sides; return G.vert(add(add(c, mul(n, h)), add(mul(u, Math.cos(a) * rad), mul(v, Math.sin(a) * rad))), part); });
  const back = ring(r * 0.92, -t * 0.4), rimO = ring(r, t * 0.6), core = ring(r * 0.5, t * 0.8), boss = G.vert(add(c, mul(n, t * 0.6 + C.boss * k)), part);
  G.tag = part;
  const m = C.sides;
  for (let j = 0; j < m; j++) {
    const i = (j + 1) % m;
    G.poly([back[j], back[i], rimO[i], rimO[j]], 'gold', part);
    G.poly([rimO[j], rimO[i], core[i], core[j]], 'gold', part);
    G.poly([core[j], core[i], boss], 'core', part);
  }
  G.poly([...back].reverse(), 'gold', part, true);
  return { c, n, part };
}

/* ---- weights ---------------------------------------------------------------------------------------------------------- */
/**
 * The mantle's weights: each vertex the body's at the closest point of its skin, taken onto the mantle's few bones
 * (spine_03 for the neck, the head and the spine below; each side's clavicle; each upper arm for the arm and its
 * helpers), then smoothed over the whole mantle (each vertex half its own, half the mean of those within `reach`), so
 * the tiers over one another move together; the ring on spine_03 and the clavicles, each clasp rigid on its centre's.
 */
export function mantleWeights(rig, G, o = {}) {
  const map = (n) => {
    if (/^(head|jaw|neck_0[12]|spine_0[12]|pelvis|root)$/.test(n)) return 'spine_03';
    const m = n.match(/_(l|r)$/), s = m ? m[1] : null;
    if (s && /^shoulder/.test(n)) return [[`clavicle_${s}`, 0.5], [`upperarm_${s}`, 0.5]];
    if (s && /^(upperarm|lowerarm|hand|thumb|fingers|elbow|wrist|knuckles)/.test(n)) return `upperarm_${s}`;
    if (s && /^(thigh|calf|foot|ball|hip|knee|ankle|toes)/.test(n)) return 'spine_03';
    return n;
  };
  const vw = transferWeights(rig, G, { map, smooth: 0 });
  const P = G.verts, reach = o.reach ?? 0.45, it = o.smooth ?? 12, armMax = o.armMax ?? 0.65;
  const nb = P.map((p, i) => P.map((q, j) => (j !== i && Math.hypot(...sub(p, q)) < reach ? j : -1)).filter((j) => j >= 0));
  let cur = vw.map((l) => Object.fromEntries(l.map(([b, w]) => [b, w])));
  for (let s = 0; s < it; s++) {
    cur = cur.map((w, i) => {
      const o2 = {};
      for (const [b, x] of Object.entries(w)) o2[b] = (o2[b] ?? 0) + 0.5 * x;
      const ns = nb[i];
      for (const j of ns) for (const [b, x] of Object.entries(cur[j])) o2[b] = (o2[b] ?? 0) + (0.5 * x) / ns.length;
      if (!ns.length) for (const b of Object.keys(o2)) o2[b] *= 2;
      return o2;
    });
  }
  const at = rig.at, sp = at.get('spine_03');
  const fin = (w) => {
    // (an upper arm takes at most armMax: the mantle is stiff; the rest goes to its clavicle)
    for (const s of ['l', 'r']) { const u = at.get(`upperarm_${s}`), c = at.get(`clavicle_${s}`); if ((w[u] ?? 0) > armMax) { w[c] = (w[c] ?? 0) + w[u] - armMax; w[u] = armMax; } }
    const l = Object.entries(w).map(([b, x]) => [+b, x]).filter(([, x]) => x > 1e-3).sort((a, b) => b[1] - a[1]).slice(0, 4), t = l.reduce((a, [, x]) => a + x, 0);
    return l.map(([b, x]) => [b, x / t]);
  };
  const out = cur.map(fin);
  // the ring: spine_03 and the clavicles as the body under it has them
  G.verts.forEach((_, i) => { if (G.part[i] === 'ring') { const w = Object.fromEntries(out[i]); const o3 = {}; for (const [b, x] of Object.entries(w)) { const name = rig.bones[+b].name; const key = /^clavicle_/.test(name) ? +b : sp; o3[key] = (o3[key] ?? 0) + x; } out[i] = fin(o3); } });
  // each clasp rigid: the mean of its vertices'
  for (const c of G.clasps ?? []) {
    const ids = G.verts.map((_, i) => i).filter((i) => G.part[i] === c.part), m = {};
    for (const i of ids) for (const [b, x] of out[i]) m[b] = (m[b] ?? 0) + x / ids.length;
    const w = fin(m);
    for (const i of ids) out[i] = w;
  }
  return out;
}

/* ---- the game's copy ------------------------------------------------------------------------------------------------ */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync } = await import('node:fs');
  const { buildRig } = await import('../lowrig.mjs');
  const { garmentAsset } = await import('../lowgarment.mjs');
  for (const who of ['male', 'female']) {
    const rig = buildRig(who), G = buildMantle(rig);
    G.vw = mantleWeights(rig, G);
    const file = new URL(`../../../src/sculpt/assets/lowmantle-${who}.json`, import.meta.url);
    const A = { built: 'node tools/sculpt/garments/mantle.mjs (tools/sculpt/lowgarment.mjs garmentAsset)', ...garmentAsset(rig, G, MATS, LOOKS) };
    writeFileSync(file, JSON.stringify(A));
    console.log(who, `${G.verts.length} vertices, ${G.tris.length} triangles, ${A.base} bones: wrote`, file.pathname);
  }
}
