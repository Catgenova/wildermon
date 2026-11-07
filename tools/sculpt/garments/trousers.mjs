// The trousers of the first outfit (tools/sculpt/ref/outfit1-trousers.png, worn in tools/sculpt/ref/outfit1-lineup.png):
// a tan waistband with a cream rim and a small V notch at the centre front, two legs with a diagonal tan stripe wrapping
// each thigh (high at the outside and behind, low at the inside in front), a bloused volume over the calf and a folded
// cream cuff below it, its inside tan. Hers tapered (a close thigh and knee), his straight and roomy. Fitted to each
// low-poly body from one design (DESIGN, per body), skinned to its rig with no bones of its own.
//
//   buildTrousers(rig) → { verts, polys: [{ v, mat, part, tag }], tris, part, rows, design }
//   trousersWeights(rig, G) → per vertex [[bone, weight], ...] (the body's bones only)
//   hiddenPolys(rig, G) → the body's polygons the trousers cover whole (left out of the body while they are worn)
//
//   node tools/sculpt/garments/trousers.mjs
//     writes the game's copy beside each body: src/sculpt/assets/lowtrousers-male.json and lowtrousers-female.json
//     (lowgarment.mjs garmentAsset, with `hides`; loaded by src/sculpt/lowpoly.ts)
//
// The shape: rings of vertices, each vertex placed on a ray from a centre in its own horizontal plane (radius r, height y):
//   the hip's rings round a vertical axis through (0, ·, z0), CF (the centre front), six columns a side, CB (the centre
//   back): the waistband's inside lip Wi, its rim's top W0, the tan band's top Wt and bottom W1 (the V notch: CF lower on
//   W0, Wt and W1), the hip H1, the seat H2, and the crotch row C;
//   each leg's rings round the leg's own centre at that height (the body's section there), ten columns: the six of the
//   hip's (L0..L5, from the inside of the front round the outside to the inside of the back) and four on the inside, which
//   on the crotch row are the crotch's own vertices on the centre line (CFc, M1, M2, CBc: shared by both legs): the
//   stripe's top S1 and bottom S2 (planes tilted toward the outside and behind), the knee K, the blouse's two rows B1
//   B2, its tuck into the cuff B3, the cuff's foot E and its inside lip Ei.
// Each vertex's radius is the body's reach in its wedge (lowgarment.mjs envelope's rule: the furthest point within half
// the gap to its neighbours, grown by 1/cos of that half) plus the clearance and the design's ease there. One surface,
// open only at the two lips (inside the waistband and the cuffs, against the body). Materials: fabric (cream), trim (the
// band, the stripes), inner (the cuffs' and the waistband's inside).
import { samplesOf, meshOf, orient, trisOf, transferWeights, offPlane, TOL, lerp } from '../lowgarment.mjs';

/** The first outfit's colours (the shawl's: cream, tan, the darker tan of a cloth's inside). */
export const MATS = {
  fabric: [0.72, 0.62, 0.56],
  trim: [0.603, 0.421, 0.294],
  inner: [0.51, 0.356, 0.268],
};

/** The leg's own columns L0..L5 and its inside ones I0..I3, degrees round the leg from its front toward its outside. */
export const LEG_AZ = [-20, 25, 70, 110, 155, 200], IN_AZ = [235, 260, 290, 320];
/** The leg's rings below the crotch row, top to bottom; the hip's above it, bottom to top. */
export const LEG_ROWS = ['S1', 'S2', 'K', 'B1', 'B2', 'Bu', 'B3', 'E', 'Ei'];
export const HIP_ROWS = ['H2', 'H1', 'W1', 'Wt', 'W0', 'Wi'];

/**
 * The design per body: heights are the body's y, lengths its units; ease [front, outside, back, inside] blends round the
 * leg (front 0, outside 90, back 180, inside 270), the hip's [front, side, back] round the hip's axis.
 *   z0: the hip's axis; clear: the cloth's least distance off the body;
 *   waist: the rim's top; rim, band: the cream rim's and the tan band's depth; notch: how much lower CF is on the rim's
 *   top and the band's top (top) and the band's foot (bottom); lip: the inside lip's depth below the rim;
 *   hips: the heights of H1 and H2; hipEase: their ease;
 *   crotch: y the crotch's lowest point (M1, M2), rise how much higher the crotch row is at the outside of the leg, front
 *   and back how much higher CFc and CBc are than M1 M2, ease the row's;
 *   stripe: y its middle, amp how far it rises toward phi (degrees round the leg: the outside behind) and falls away from
 *   it, w its depth;
 *   knee: y, amp (its tilt as the stripe's, smaller); blouse: B1, B2 heights; cuff: its top (B3) and foot (E);
 *   ease: per leg row.
 */
export const DESIGN = {
  male: {
    z0: -0.02, clear: 0.05,
    waist: -3.35, rim: 0.1, band: 0.24, notch: { top: 0.14, bottom: 0.26, at: 9 }, lip: 0.14,
    hips: [-4.4, -5.05], hipEase: { H1: [0.08, 0.1, 0.12], H2: [0.1, 0.14, 0.2] },
    crotch: { y: -6.2, rise: 0.55, dip: 0.14, front: 0.5, back: 0.55, zf: 0.22, zb: -0.18, ease: [0.12, 0.14, 0.05, 0.1] },
    stripe: { y: -6.45, amp: 0.74, phi: 120, w: 0.48 },
    knee: { y: -7.5, amp: 0.3 },
    blouse: [-8.3, -9.0], cuff: [-9.4, -10.04],
    ease: {
      S1: [0.24, 0.18, 0.12, 0.1], S2: [0.15, 0.17, 0.14, 0.09], K: [0.08, 0.08, 0.08, 0.05],
      B1: [0.4, 0.42, 0.38, 0.18], B2: [0.5, 0.52, 0.46, 0.22], B3: [0.07, 0.07, 0.07, 0.06], E: [0.07, 0.07, 0.07, 0.06],
    },
  },
  female: {
    z0: -0.38, clear: 0.045,
    waist: -2.88, rim: 0.09, band: 0.22, notch: { top: 0.13, bottom: 0.27, at: 9 }, lip: 0.13,
    hips: [-3.5, -4.05], hipEase: { H1: [0.07, 0.08, 0.1], H2: [0.08, 0.1, 0.16] },
    crotch: { y: -4.55, rise: 0.22, dip: 0.12, front: 0.42, back: 0.5, zf: 0.12, zb: -0.3, ease: [0.09, 0.1, 0.04, 0.08] },
    stripe: { y: -5.85, amp: 0.8, phi: 120, w: 0.48 },
    knee: { y: -6.85, amp: 0.35 },
    blouse: [-8.3, -9.05], cuff: [-9.5, -10.22],
    ease: {
      S1: [0.16, 0.12, 0.08, 0.06], S2: [0.09, 0.11, 0.09, 0.06], K: [0.03, 0.04, 0.03, 0.02],
      B1: [0.36, 0.38, 0.34, 0.16], B2: [0.46, 0.48, 0.42, 0.2], B3: [0.06, 0.06, 0.06, 0.05], E: [0.06, 0.06, 0.06, 0.05],
    },
  },
};

const rad = (d) => d * Math.PI / 180;
/** [front, outside, back, inside] blended round the leg by azimuth (degrees from its front toward its outside). */
const round4 = ([f, o, b, i], az) => { const c = Math.cos(rad(az)), s = Math.sin(rad(az)); return (c > 0 ? f * c * c : b * c * c) + (s > 0 ? o * s * s : i * s * s); };
/** [front, side, back] round the hip's axis. */
const round3 = ([f, s, b], az) => { const c = Math.cos(rad(az)); return c > 0 ? f * c * c + s * (1 - c * c) : b * c * c + s * (1 - c * c); };

/** The body's surface, torso, pelvis and legs (no arms: they hang beside the hips), as points; and its left half. */
function bodySamples(B) {
  const parts = new Set(['torso', 'pelvis', 'legs']);
  const tris = B.tris.filter((t) => t.v.every((i) => parts.has(B.part[i])));
  const S = samplesOf({ tris }, B.verts, 0.05).slice(B.verts.length);
  for (const t of tris) for (const i of t.v) S.push(B.verts[i]);
  return S;
}

/**
 * The radii of a ring of vertices round centre c (x, z) at azimuths az (degrees, 0 toward +z, 90 toward +x, in order
 * round) that keep every sample inside it: a sample in the gap between vertices k and k + 1 (g degrees wide, at a degrees
 * from k) and at distance d from the centre is inside their edge when both are at least d cos(a - g/2) / cos(g/2) out.
 * Only samples between heights win[k] = [lo, hi] (the gap takes its two vertices' together) and passing `keep` count.
 */
function ringRadii(S, c, az, win, keep = null) {
  const N = az.length, r = new Array(N).fill(0);
  const lo = Math.min(...win.map((w) => w[0])), hi = Math.max(...win.map((w) => w[1]));
  for (const p of S) {
    if (p[1] < lo || p[1] > hi || (keep && !keep(p))) continue;
    const dx = p[0] - c[0], dz = p[2] - c[1], d = Math.hypot(dx, dz);
    if (d < 1e-9) continue;
    const ap = Math.atan2(dx, dz) * 180 / Math.PI;
    for (let k = 0; k < N; k++) {
      const j = (k + 1) % N, g = ((az[j] - az[k]) % 360 + 360) % 360, a = ((ap - az[k]) % 360 + 360) % 360;
      if (a > g) continue;
      if (p[1] < Math.min(win[k][0], win[j][0]) || p[1] > Math.max(win[k][1], win[j][1])) continue;
      const need = d * Math.cos(rad(a - g / 2)) / Math.cos(rad(g / 2));
      r[k] = Math.max(r[k], need); r[j] = Math.max(r[j], need);
    }
  }
  return r;
}

/** The left leg's centre (x, z) at height y: the middle of the body's section there (its left half beyond the inside of the thigh). */
function legCentre(S, y, dy = 0.12) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of S) if (Math.abs(p[1] - y) <= dy && p[0] > 0.04) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); }
  return [(x0 + x1) / 2, (z0 + z1) / 2];
}

export function buildTrousers(rig, design = DESIGN[rig.who], { stage = 9 } = {}) {
  const { B } = rig, D = design;
  const S = bodySamples(B);
  const left = (p) => p[0] > -0.02;
  const SL = S.filter(left);
  const LAZ = [...LEG_AZ, ...IN_AZ];
  const tilt = (az, amp) => amp * Math.cos(rad(az - D.stripe.phi));

  // ---- each leg row's heights per column (the left leg; the right is its mirror) ------------------------------------
  const cr = D.crotch;
  const yRow = {
    C: (az) => cr.y + Math.min(cr.front, cr.back) + cr.rise * Math.max(0, Math.sin(rad(az))),
    S1: (az) => D.stripe.y + tilt(az, D.stripe.amp) + D.stripe.w / 2,
    S2: (az) => D.stripe.y + tilt(az, D.stripe.amp) - D.stripe.w / 2,
    K: (az) => D.knee.y + tilt(az, D.knee.amp),
    B1: () => D.blouse[0], B2: () => D.blouse[1], Bu: () => D.blouse[1] - 0.55 * (D.blouse[1] - D.cuff[0]), B3: () => D.cuff[0], E: () => D.cuff[1], Ei: () => D.cuff[1] + 0.12,
  };
  // (the blockout: the crotch, the knee and the cuff's foot only, no tilt)
  const rows = stage <= 1 ? ['K', 'E'] : LEG_ROWS;
  if (stage <= 1) { yRow.K = () => D.knee.y; }

  // ---- the leg's vertices: on rays from the leg's centre at each row's mean height ----------------------------------
  const legV = {};
  for (const row of ['C', ...rows].filter((r) => r !== 'Bu')) {
    const yMean = LAZ.reduce((s, a) => s + yRow[row](a), 0) / LAZ.length;
    const c = legCentre(SL, Math.min(yMean, cr.y - 0.25));
    const win = LAZ.map((az) => {
      const y = yRow[row](az);
      // (the blouse and the cuff as straight walls: each the furthest reach over its pair of rows)
      return row === 'B2' ? [D.blouse[1] - 0.25, D.blouse[0] + 0.1] : row === 'B3' || row === 'E' || row === 'Ei' ? [D.cuff[1] - 0.05, D.cuff[0] + 0.1] : [y - 0.2, y + 0.2];
    });
    const r0 = ringRadii(SL, c, LAZ, win, (p) => p[0] > 0.04);
    legV[row] = LAZ.map((az, k) => {
      const y = yRow[row](az);
      const ease = row === 'Ei' ? round4(D.ease.E, az) - 0.06 : row === 'C' ? round4(cr.ease, az) : stage <= 1 ? 0.1 : round4(D.ease[row], az);
      const r = r0[k] + D.clear + ease;
      return [c[0] + Math.sin(rad(az)) * r, y, c[1] + Math.cos(rad(az)) * r];
    });
  }
  // the blouse's underside rolling in to the cuff: B2's columns 0.55 of the way in to B3's (the tuck), down between them
  if (legV.B2) legV.Bu = legV.B2.map((p, k) => { const q = legV.B3[k], t = D.roll ?? 0.45; return [q[0] + (p[0] - q[0]) * t, yRow.Bu(), q[2] + (p[2] - q[2]) * t]; });
  // the crotch row's inside columns: on the centre line, the crotch's own vertices (CBc, M2, M1, CFc)
  {
    const C = legV.C, cen = S.filter((p) => Math.abs(p[0]) < 0.12);
    const zAt = (y, front) => { let z = front ? -Infinity : Infinity; for (const p of cen) if (Math.abs(p[1] - y) < 0.15) z = front ? Math.max(z, p[2]) : Math.min(z, p[2]); return z; };
    const yF = cr.y + cr.front, yB = cr.y + cr.back;
    // (CFc and CBc no deeper in between the legs than `dip` behind the line across the legs' front and back columns)
    C[9] = [0, yF, Math.max(zAt(yF, true) + D.clear + cr.ease[0] * 0.6, C[0][2] - cr.dip)];
    C[8] = [0, cr.y, cr.zf];
    C[7] = [0, cr.y, cr.zb];
    C[6] = [0, yB, Math.min(zAt(yB, false) - D.clear - cr.ease[2] * 0.6, C[5][2] + cr.dip)];
  }

  // ---- the hip's rings: round the hip's axis, its columns over the crotch row's ---------------------------------------
  const C = legV.C;
  const hipAz = [0, ...LEG_AZ.map((_, k) => Math.atan2(C[k][0], C[k][2] - D.z0) * 180 / Math.PI), 180];
  const notch = (k, depth) => (k === 0 ? depth : 0);
  const yHip = {
    // (the seat's row halfway from the hip's to the crotch row's, column by column)
    H2: (k) => (D.hips[0] + (k === 0 ? C[9][1] : k === 7 ? C[6][1] : C[k - 1][1])) / 2, H1: () => D.hips[0],
    W1: (k) => D.waist - D.rim - D.band - notch(k, D.notch.bottom),
    Wt: (k) => D.waist - D.rim - notch(k, D.notch.top),
    W0: (k) => D.waist - notch(k, D.notch.top),
    Wi: (k) => D.waist - D.lip - notch(k, D.notch.top),
  };
  const hipRows = stage <= 1 ? ['H1', 'W0'] : HIP_ROWS;
  const hipV = {};
  for (const row of hipRows) {
    const full = [...hipAz, ...hipAz.slice(1, -1).map((a) => -a).reverse()], band = row[0] === 'W';
    const ys = full.map((_, k) => yHip[row](k < 8 ? k : 14 - k));
    const r0 = ringRadii(S, [0, D.z0], full, ys.map((y) => [y - (band ? 0.1 : 0.25), y + (band ? 0.1 : 0.25)]));
    hipV[row] = hipAz.map((az, k) => {
      const y = ys[k];
      const ease = row === 'Wi' ? -D.clear + 0.008 : row === 'W0' ? 0 : row === 'Wt' ? 0.005 : row === 'W1' ? 0.012 : round3(D.hipEase[row] ?? [0.1, 0.1, 0.1], az);
      const r = Math.max(r0[k], r0[(14 - k) % 14]) + D.clear + ease;
      return [Math.sin(rad(az)) * r, y, D.z0 + Math.cos(rad(az)) * r];
    });
  }
  // (the seat's row no further in than the straight line from the hip's row to the crotch row: no crease between them)
  if (hipV.H2) hipV.H2 = hipV.H2.map((p, k) => {
    const a = hipV.H1[k], b = k === 0 ? C[9] : k === 7 ? C[6] : C[k - 1], t = (a[1] - p[1]) / (a[1] - b[1]);
    const q = lerp(a, b, t), rq = Math.hypot(q[0], q[2] - D.z0), rp = Math.hypot(p[0], p[2] - D.z0);
    if (rp >= rq + 0.02) return p;
    const s = (rq + 0.02) / rp; return [p[0] * s, p[1], D.z0 + (p[2] - D.z0) * s];
  });
  // (the V notch's sides: on each waistband row, a vertex either side of the centre front at notch.at degrees, on the
  // chord from CF to L0 at the row's own height, so the band's foot and the rim's top dip to a narrow V at CF)
  for (const row of hipRows) if (row[0] === 'W' && stage > 1) {
    const V = hipV[row], cf = V[0], l0 = V[1], t = D.notch.at / hipAz[1];
    V.notch = [cf[0] + (l0[0] - cf[0]) * t, l0[1], cf[2] + (l0[2] - cf[2]) * t + 0.01];
  }
  // (the waistband's rows each no tighter than the one below it, so it stands as a band)
  if (stage > 1) for (const [a, b] of [['W1', 'Wt'], ['Wt', 'W0']]) hipV[b] = hipV[b].map((p, k) => { const q = hipV[a][k], ra = Math.hypot(q[0], q[2] - D.z0), rb = Math.hypot(p[0], p[2] - D.z0); if (rb >= ra - 0.01) return p; const s = (ra - 0.01) / rb; return [p[0] * s, p[1], D.z0 + (p[2] - D.z0) * s]; });

  return meshOfTrousers(rig, D, { legV, hipV, rows: ['C', ...rows], hipRows, stage });
}

/** The mesh from the rows: the left half's vertices, the right's their mirror, the centre line's shared. */
function meshOfTrousers(rig, D, { legV, hipV, rows, hipRows, stage }) {
  const G = meshOf();
  const mir = (p) => [-p[0], p[1], p[2]];
  // per ring, the vertex indices in order round: a hip ring [CF, L0..L5, CB, R5..R0]; a leg ring [L0..L5, I0..I3] a side
  const R = { hip: {}, leg: { l: {}, r: {} } };
  for (const row of hipRows) {
    const V = hipV[row], part = row[0] === 'W' ? 'waistband' : 'hip';
    const cf = G.vert([0, V[0][1], V[0][2]], part), cb = G.vert([0, V[7][1], V[7][2]], part);
    const L = V.slice(1, 7).map((p) => G.vert(p, part)), Rr = V.slice(1, 7).map((p) => G.vert(mir(p), part));
    R.hip[row] = [cf, ...L, cb, ...Rr.reverse()];
    if (V.notch) { R.hip[row].splice(1, 0, G.vert(V.notch, part)); R.hip[row].push(G.vert(mir(V.notch), part)); }
  }
  // the crotch row: its own columns a side, the centre line's four shared
  {
    const V = legV.C;
    const L = V.slice(0, 6).map((p) => G.vert(p, 'hip')), Rr = V.slice(0, 6).map((p) => G.vert(mir(p), 'hip'));
    const ctr = V.slice(6, 10).map((p) => G.vert([0, p[1], p[2]], 'crotch'));
    R.leg.l.C = [...L, ...ctr];
    R.leg.r.C = [...Rr, ...ctr];
    R.hip.C = [ctr[3], ...L, ctr[0], ...[...Rr].reverse()];
  }
  for (const row of rows.slice(1)) {
    const part = row === 'B3' || row === 'E' || row === 'Ei' ? 'cuff' : row[0] === 'B' ? 'blouse' : 'leg';
    R.leg.l[row] = legV[row].map((p) => G.vert(p, part));
    R.leg.r[row] = legV[row].map((p) => G.vert(mir(p), part));
  }
  // a band of quads between two rings (equal counts), each quad whole if flat, else cut along the diagonal that folds out
  const band = (A, Bq, mat, part, tag, cx = null) => {
    G.tag = tag;
    const N = A.length;
    for (let k = 0; k < N; k++) {
      const j = (k + 1) % N, q = [A[k], A[j], Bq[j], Bq[k]];
      if (offPlane(G.verts, q) <= TOL) { G.poly(q, mat, part); continue; }
      // (the diagonal whose midpoint lies further out from the ring's centre: the quad folds outward, convex)
      const c = cx ?? centreOf([...A, ...Bq]);
      const out = (a, b) => { const m = lerp(G.verts[a], G.verts[b], 0.5); return Math.hypot(m[0] - c[0], m[2] - c[2]); };
      if (out(q[0], q[2]) >= out(q[1], q[3])) { G.poly([q[0], q[1], q[2]], mat, part); G.poly([q[0], q[2], q[3]], mat, part); }
      else { G.poly([q[0], q[1], q[3]], mat, part); G.poly([q[1], q[2], q[3]], mat, part); }
    }
  };
  // a band between two rings of different counts (the waistband's and the hip's), zipped round by azimuth into triangles
  const zip = (A, Bq, mat, part, tag) => {
    G.tag = tag;
    const az = (i) => { const p = G.verts[i]; return ((Math.atan2(p[0], p[2] - D.z0) * 180 / Math.PI) + 360.0001) % 360; };
    const at = (L, i) => (i >= L.length ? az(L[i % L.length]) + 360 : az(L[i]));
    let i = 0, j = 0;
    while (i < A.length || j < Bq.length) {
      if (j >= Bq.length || (i < A.length && at(A, i + 1) <= at(Bq, j + 1))) { G.poly([A[i % A.length], A[(i + 1) % A.length], Bq[j % Bq.length]], mat, part); i++; }
      else { G.poly([A[i % A.length], Bq[(j + 1) % Bq.length], Bq[j % Bq.length]], mat, part); j++; }
    }
  };
  const centreOf = (ix) => { const s = ix.reduce((a, i) => [a[0] + G.verts[i][0], a[1] + G.verts[i][1], a[2] + G.verts[i][2]], [0, 0, 0]); return s.map((x) => x / ix.length); };
  const col = stage >= 4;
  const M = (m) => (col ? m : 'fabric');
  // the hip: from the crotch row up to the rim and in to the lip
  const H = ['C', ...hipRows];
  const hipMat = { 'C-H2': 'fabric', 'H2-H1': 'fabric', 'H1-W1': 'fabric', 'W1-Wt': 'trim', 'Wt-W0': 'fabric', 'W0-Wi': 'inner', 'H1-W0': 'fabric' };
  const hc = [0, 0, D.z0];
  for (let i = 0; i + 1 < H.length; i++) (R.hip[H[i]].length === R.hip[H[i + 1]].length ? band : zip)(R.hip[H[i]], R.hip[H[i + 1]], M(hipMat[`${H[i]}-${H[i + 1]}`] ?? 'fabric'), H[i + 1][0] === 'W' ? 'waistband' : 'hip', `${H[i]}-${H[i + 1]}`, hc);
  // each leg: from the crotch row down to the cuff's foot and in to its lip
  const legMat = { 'S1-S2': 'trim', 'E-Ei': 'inner' };
  for (const s of ['l', 'r']) for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i], b = rows[i + 1];
    band(R.leg[s][a], R.leg[s][b], M(legMat[`${a}-${b}`] ?? 'fabric'), b === 'E' || b === 'Ei' || b === 'B3' ? 'cuff' : 'leg', `${a}-${b}`);
  }
  orient(G, (p) => [p[0] - Math.sign(p[0]) * 0.9, 0, p[2]]);
  // (orient's closed/open test sees an open piece: face the leg's walls outward from each leg's axis, the hip's from the hip's)
  G.tris = trisOf(G);
  G.rows = R; G.design = D; G.legV = legV; G.hipV = hipV; G.rowNames = { leg: rows, hip: hipRows };
  return G;
}

/**
 * The trousers' weights from the body's: each vertex the closest skin's (lowgarment.mjs transferWeights; the feet's bones
 * taken up to the calf, the spine's above the pelvis to spine_01), smoothed along the cloth; then the crotch's vertices
 * shared between the pelvis and both hips (the thighs' half turns), the waistband on the pelvis and spine_01 as the skin
 * under it, the blouse and the cuff on the calf with the knee's half turn over the blouse's top.
 */
export function trousersWeights(rig, G, o = {}) {
  const parts = new Set(['torso', 'pelvis', 'legs']);
  const keep = (i) => parts.has(rig.B.part[i]);
  const map = (n) => {
    if (/^(foot|ball|ankle|toes)_/.test(n)) return n.replace(/^(foot|ball|ankle|toes)/, 'calf');
    if (/^spine_0[23]$/.test(n)) return 'spine_01';
    return n;
  };
  const vw = transferWeights(rig, G, { map, smooth: o.smooth ?? 3, keep });
  const at = (n) => rig.at.get(n);
  const set = (i, list) => { const s = list.reduce((a, [, w]) => a + w, 0); vw[i] = list.filter(([, w]) => w > 0).map(([n, w]) => [at(n), w / s]); };
  const R = G.rows, ctr = R.leg.l.C.slice(6);
  // the crotch's centre line: the pelvis with both hips
  set(ctr[0], [['pelvis', 0.6], ['hip_l', 0.2], ['hip_r', 0.2]]);
  set(ctr[3], [['pelvis', 0.6], ['hip_l', 0.2], ['hip_r', 0.2]]);
  set(ctr[1], [['pelvis', 0.4], ['hip_l', 0.3], ['hip_r', 0.3]]);
  set(ctr[2], [['pelvis', 0.4], ['hip_l', 0.3], ['hip_r', 0.3]]);
  for (const s of ['l', 'r']) {
    const L = R.leg[s];
    for (const row of ['B3', 'E', 'Ei']) for (const i of L[row] ?? []) set(i, [[`calf_${s}`, 1]]);
    for (const i of [...(L.B2 ?? []), ...(L.Bu ?? [])]) set(i, [[`calf_${s}`, 1]]);
    for (const i of L.B1 ?? []) set(i, [[`calf_${s}`, 0.8], [`knee_${s}`, 0.2]]);
  }
  return vw;
}

/**
 * The body's polygons the trousers cover whole at rest: torso, pelvis and legs (not the arms beside them), each corner
 * below the waistband's lip (by `m`) and, on a leg, above the cuff's foot (by `m`). Left out of the body while the trousers
 * are worn: they cannot show, and they cannot cross the cloth.
 */
export function hiddenPolys(rig, G, m = 0.04) {
  const { B } = rig, D = G.design;
  const parts = new Set(['torso', 'pelvis', 'legs']);
  const W = G.hipV.Wi ?? G.hipV.W0, E = G.legV.E;
  // (the lip's height round the hip's axis, the cuff's foot)
  const lipY = (p) => { const az = Math.abs(Math.atan2(p[0], p[2] - D.z0) * 180 / Math.PI); return az < 25 ? Math.min(...W.slice(0, 2).map((q) => q[1])) : Math.min(...W.map((q) => q[1])); };
  const footY = Math.max(...E.map((q) => q[1]));
  const covered = (i) => { const p = B.verts[i]; return parts.has(B.part[i]) && p[1] < lipY(p) - m && p[1] > footY + m; };
  return B.polys.map((p, k) => (p.v.every(covered) ? k : -1)).filter((k) => k >= 0);
}

/* ---- the game's copy ------------------------------------------------------------------------------------------------ */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync } = await import('node:fs');
  const { buildRig } = await import('../lowrig.mjs');
  const { garmentAsset } = await import('../lowgarment.mjs');
  for (const who of ['male', 'female']) {
    const rig = buildRig(who), G = buildTrousers(rig);
    G.vw = trousersWeights(rig, G);
    const file = new URL(`../../../src/sculpt/assets/lowtrousers-${who}.json`, import.meta.url);
    const A = { built: 'node tools/sculpt/garments/trousers.mjs (tools/sculpt/lowgarment.mjs garmentAsset)', ...garmentAsset(rig, G, MATS), hides: hiddenPolys(rig, G) };
    writeFileSync(file, JSON.stringify(A));
    console.log(who, `${G.verts.length} vertices, ${G.tris.length} triangles, ${A.base} + ${A.bones.length} bones, ${A.hides.length} body polygons hidden: wrote`, file.pathname);
  }
}
