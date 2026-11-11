// The hood of the first outfit (the hood sheet: a pointed, faceted shell round the head, a structured face opening with a
// tan border and a row of cream and tan teeth, a muted brown lining, a smooth back drape into the cowl, a centre gusset
// with one seam each side), worn with the shawl (tools/sculpt/garments/shawl.mjs): it rises out of the shawl's cowl, its
// hem inside the cowl's rim, so the two read as one garment and the cowl is the shawl's own. Fitted to each low-poly body
// from the one design (DESIGN, per body), skinned to its rig's head and neck: no bones of its own.
//
//   buildHood(rig, shawl, design, { under }) → { verts, polys: [{ v, mat, part, tag }], tris, part, rows, design }
//   hoodWeights(rig, G, shawl) → per vertex [[bone, weight], ...] (the body's bones only)
//
//   node tools/sculpt/garments/hood.mjs
//     writes the game's copy beside each body, round the shawl as the outfit wears it (garments/outfit1.mjs): src/sculpt/assets/lowhood-male.json and lowhood-female.json
//     (lowgarment.mjs garmentAsset; loaded by src/sculpt/lowpoly.ts)
//
// The shape, in rows and columns. The opening's inner edge E0 (the frame's line, where the lining starts) runs from the
// shawl's cowl beside the jaw, up past the cheek, to the apex A just over the brow and ahead of it (a pointed arch: the
// curve's last tangent kept, so the two sides meet at an angle); the border's outer line E1 is E0 moved out in the
// opening's plane by the border's width (and back a little), meeting over A at B. Above B the front line F runs up the
// forehead, ahead of it, to the hood's small pointed tip T over the crown; the back line C runs from the cowl behind the
// neck up the back, over the skull, to T. Row k joins its front point (E1_k up to the apex's row, then F_k) round the
// side of the head to C_k: the azimuth about O's vertical from the front point's to the back's and the elevation each
// blended, out to the design surface (at each height a superellipse across the half-width `width(y)` and from the back
// line to the front), every point then pushed out from O until it clears the head by IN + THICK (the hood is snug: the
// clearance is all its room). The lining is the shell moved in by THICK along its normal, its edge E0 at the frame.
// Rows 0 to 2 lie on the cowl: 0 and 1 inside its rim (`gap`), 0 `drop` under it, 1 `lift` over it, 2 resting on the
// upper roll (`flare` past its top, `rise` over it). Columns at fractions TS of the way from the front to the back; the
// seam between the side panel and the centre gusset at TS[SEAM].
// One closed surface: the shell, the lining, the border (E0 to E1), the hem (the shell to the lining at row 0).
// Materials: fabric (the shell), trim (the border's band at the opening), rune (its teeth: trim's tan, lit when
// enchanted), pattern (the cream between the teeth), lining.
import { offPlane, TOL, samplesOf, meshOf, orient, trisOf, atRY, dirOf, sub, add, mul, dot, cross, unit, lerp, applyRefit } from '../lowgarment.mjs';
import { MATS as SHAWL_MATS, clothLooks } from './shawl.mjs';

/**
 * The materials: the shawl's own cream, tan and pattern (the hood is the same cloth, its border the same tan, its teeth the
 * shawl's teeth), and the lining, the one colour of its own: the sheet's #7A5E4A taken down about as the shawl's colours
 * were from their sheet's, a little further so it reads darker than the border inside the opening, as on the sheet.
 */
export const MATS = { fabric: SHAWL_MATS.fabric, trim: SHAWL_MATS.trim, pattern: SHAWL_MATS.pattern, lining: [0.28, 0.19, 0.14], rune: SHAWL_MATS.rune };
/** Plain, as lit; enchanted, the teeth round the opening (rune) unlit at the glow (garments/shawl.mjs clothLooks). */
export const LOOKS = clothLooks(MATS);

/**
 * The design per body (the body's units: y up, the chin's underside 0; z forward; x the body's left):
 *   O: the head's centre (the rows' azimuths and elevations about it; every front point ahead of it, every back one behind);
 *   frame: E0's control points up the left side, from the cowl to below the apex; apex: A (x 0, over the brow); bottom:
 *   the azimuth (about the shawl's axis) where the frame meets the cowl; band: the border's width and how far back its
 *   outer line lies; line: the share of the border that is the band at the opening; teeth: the frame rows that carry a
 *   tooth; chin: the opening's lower rim under the chin, as a share of the border's width over the cowl's roll;
 *   front: the front line's control points from B up to the tip; tip: T; back: the back line's, down from T to the cowl;
 *   width: the half-width by height [[y, w]]; power: the cross-section's superellipse power;
 *   THICK, IN: the cloth's thickness and the lining's clearance from the head; hemThick: the cloth's thickness inside the cowl; gap, lift, drop, flare, rise, over: the
 *   hem in the cowl, the lower edge on its roll, the shell over it; step: each row at least this over the one under it;
 *   underGap, underHalf, underDy: the hem's clearance outside a garment worn under the shawl (`opts.under`), and the
 *   reach of its samples taken round (degrees) and up and down;
 *   Kf: the apex's row (rows 2 to Kf along the frame); K: the tip's row (Kf to K along the front line); seam: how far in
 *   the seam's line is pressed.
 */
export const DESIGN = {
  male: {
    O: [0, 1.1, 0.1],
    bottom: 95, frame: [[1.1, 0.85, 0.2], [1.08, 1.1, 0.74], [0.86, 1.3, 0.84]], apex: [0, 1.78, 1.0],
    band: [0.1, 0.03], teethW: [0.06, 0.18, 0.26], teethBack: 0.18, line: 0.5, roll: 0.06, footRoll: 0, chinW: 0.1, chinRoll: 0.8, chinDrop: 0.05, chinHem: 0.08, chinSink: 0.2, chinGap: 0.1, chinIn: 0.25, chinFront: 0.2, chinCols: [0, 0.12, 0.4, 0.7, 1], teeth: [3, 6],
    front: [[0, 2.15, 0.78], [0, 2.36, 0.46]], tip: [0, 2.56, 0.12],
    back: [[0, 2.2, -0.48], [0, 1.6, -0.95], [0, 1.15, -1.0]],
    width: [[0.4, 1.12], [0.9, 1.0], [1.5, 0.95], [1.9, 0.8], [2.2, 0.5], [2.52, 0.04]], power: 2.4,
    THICK: 0.09, hemThick: 0.06, IN: 0.05, gap: 0.035, lift: 0.07, drop: 0.14, over: 0.06, flare: -0.06, rise: 0.12, step: 0.1, Kf: 6, K: 9, seam: 0.03,
    underGap: 0.025, underHalf: 12, underDy: 0.08,
  },
  female: {
    O: [0, 1.1, 0.05],
    bottom: 85, frame: [[1.0, 0.8, 0.3], [0.96, 1.12, 0.66], [0.78, 1.36, 0.76]], apex: [0, 1.88, 0.92],
    band: [0.1, 0.03], teethW: [0.06, 0.17, 0.24], teethBack: 0.18, line: 0.5, roll: 0.06, footRoll: 0, chinW: 0.1, chinRoll: 0.8, chinDrop: 0.05, chinHem: 0.08, chinSink: 0.2, chinGap: 0.1, chinIn: 0.25, chinFront: 0.14, chinCols: [0, 0.12, 0.4, 0.7, 1], teeth: [3, 6],
    front: [[0, 2.22, 0.72], [0, 2.4, 0.42]], tip: [0, 2.56, 0.06],
    back: [[0, 2.15, -0.56], [0, 1.55, -1.08], [0, 1.1, -1.12]],
    width: [[0.4, 1.08], [0.9, 1.1], [1.5, 0.95], [1.9, 0.76], [2.2, 0.46], [2.48, 0.04]], power: 2.2,
    THICK: 0.08, hemThick: 0.06, IN: 0.05, gap: 0.035, lift: 0.07, drop: 0.14, over: 0.06, flare: -0.05, rise: 0.1, step: 0.09, Kf: 6, K: 9, seam: 0.03,
    underGap: 0.025, underHalf: 12, underDy: 0.08,
  },
};
/** The columns: fractions of the way round from the front (0) to the back line (1); the seam at TS[SEAM]. */
export const TS = [0, 0.14, 0.32, 0.56, 0.8, 1];
export const SEAM = 4;

/* ---- curves ------------------------------------------------------------------------------------------------------- */
/** A Catmull-Rom spline through points, its ends' tangents given by phantom points; n samples per span. */
function spline(P, before, after, n = 24) {
  const Q = [before, ...P, after], out = [];
  for (let i = 1; i + 2 < Q.length; i++) {
    const [p0, p1, p2, p3] = [Q[i - 1], Q[i], Q[i + 1], Q[i + 2]];
    for (let s = 0; s < n; s++) {
      const t = s / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1, 2].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push(P[P.length - 1]);
  return out;
}
/** m + 1 points evenly along a polyline by arc length (the first and last its ends). */
function resample(L, m) {
  const acc = [0];
  for (let i = 1; i < L.length; i++) acc.push(acc[i - 1] + Math.hypot(...sub(L[i], L[i - 1])));
  const tot = acc[acc.length - 1], out = [];
  for (let k = 0; k <= m; k++) {
    const s = (tot * k) / m;
    let i = 1; while (i < L.length - 1 && acc[i] < s) i++;
    const t = (s - acc[i - 1]) / Math.max(1e-9, acc[i] - acc[i - 1]);
    out.push(lerp(L[i - 1], L[i], Math.min(1, Math.max(0, t))));
  }
  return out;
}
/** Spherical interpolation of unit vectors. */
function slerp(a, b, t) {
  const c = Math.max(-1, Math.min(1, dot(a, b))), w = Math.acos(c);
  if (w < 1e-6) return unit(lerp(a, b, t));
  const s = Math.sin(w);
  return unit(add(mul(a, Math.sin((1 - t) * w) / s), mul(b, Math.sin(t * w) / s)));
}

/** The shawl's cowl rim (its ring d) at azimuth deg about the shawl's axis: [r, y]. */
export const rimAt = (shawl, deg) => ringAt(shawl, 'd', deg);

/** Piecewise linear through [x, y] pairs (sorted by x), held at the ends. */
function interp(P, x) {
  if (x <= P[0][0]) return P[0][1];
  for (let i = 0; i + 1 < P.length; i++) if (x <= P[i + 1][0]) return P[i][1] + (P[i + 1][1] - P[i][1]) * (x - P[i][0]) / Math.max(1e-9, P[i + 1][0] - P[i][0]);
  return P[P.length - 1][1];
}
/** One of the shawl's rings (its columns' [r, y] under `key`) at azimuth deg about the shawl's axis, between its columns. */
export function ringAt(shawl, key, deg) {
  const C = shawl.cols, N = C.length, a = ((deg % 360) + 360) % 360;
  for (let k = 0; k < N; k++) {
    const d0 = C[k].deg, d1 = k + 1 < N ? C[k + 1].deg : 360;
    if (a >= d0 && a <= d1) { const t = (a - d0) / (d1 - d0), q = C[(k + 1) % N][key]; return [C[k][key][0] + (q[0] - C[k][key][0]) * t, C[k][key][1] + (q[1] - C[k][key][1]) * t]; }
  }
  return C[0][key];
}

/* ---- the head's reach ----------------------------------------------------------------------------------------------- */
/** The head's (and the neck's, above `floor`) surface samples, and its reach from O along a direction: the furthest sample within `half` degrees, grown for the chord. */
export function headReach(rig, O, half = 11, floor = -0.15) {
  const B = rig.B, keep = (i) => B.part[i] === 'head' || B.part[i] === 'neck';
  const S = samplesOf({ tris: B.tris.filter((t) => t.v.every(keep)) }, B.verts, 0.05).filter((p) => p[1] > floor).map((p) => sub(p, O));
  const D = S.map((p) => [unit(p), Math.hypot(...p)]), cs = Math.cos(half * Math.PI / 180);
  return (d) => { let r = 0; for (const [u, l] of D) if (dot(u, d) > cs && l > r) r = l; return r / cs; };
}

/* ---- the hood ------------------------------------------------------------------------------------------------------- */
export function buildHood(rig, shawl, design = DESIGN[rig.who], opts = {}) {
  const D = design, O = D.O, z0 = shawl.design.z0, K = D.K, Kf = D.Kf;
  const reach = headReach(rig, O);
  const [bandW, bandBack] = D.band;
  // the cowl's top (the shawl's rim d, the upper roll's top u1 and outside u2) at an azimuth about the shawl's axis
  const cowlTop = (deg) => ['d', 'u1', 'u2'].map((key) => ringAt(shawl, key, deg));
  // (any garment worn under the shawl, `under` ({ verts, tris }, the tunic's collar above all): the hem inside the cowl,
  // rows 0 and 1 and the chin's patch, kept `underGap` outside it round the shawl's axis, the shell `underGap` outside the
  // lining, but `gap` inside the cowl's rim at most, so the hem neither crosses the collar nor comes out of the cowl)
  const US = (opts.under ?? []).flatMap((m) => samplesOf(m, m.verts, 0.04)).map((p) => [Math.atan2(p[0], p[2] - z0) * 180 / Math.PI, Math.hypot(p[0], p[2] - z0), p[1]]);
  const underR = (deg, y) => { let r = 0; for (const [a, ur, uy] of US) if (Math.abs(((a - deg + 540) % 360) - 180) < D.underHalf && Math.abs(uy - y) < D.underDy && ur > r) r = ur; return r; };
  const clearUnder = (p, layer) => {
    if (!US.length) return p;
    const deg = Math.atan2(p[0], p[2] - z0) * 180 / Math.PI, r = Math.hypot(p[0], p[2] - z0), u = underR(deg, p[1]);
    if (!u) return p;
    const rim = ringAt(shawl, 'd', deg)[0] - D.gap, need = Math.min(u + D.underGap * (layer === 'in' ? 1 : 2), layer === 'in' ? rim - D.underGap : rim);
    return r >= need ? p : atRY(deg, need, p[1], z0);
  };
  const row1Y = (d) => d[1] + D.lift;
  // (row 2's height at radius r: `rise` over the roll's top, and high enough that the line up to it from row 1 passes
  // over the roll's top by `rise` too)
  const row2Y = (deg, r) => {
    const [d, u1] = cowlTop(deg), r1 = d[0] - D.gap, y1 = row1Y(d);
    return Math.max(u1[1] + D.rise, y1 + (u1[1] + D.rise - y1) * (r - r1) / Math.max(0.05, u1[0] - r1));
  };
  // the rows on the cowl: 0 and 1 `gap` inside its rim (the lining `hemThick` further in, and at row 1 higher, over the flare),
  // 2 resting on the upper roll
  const inCowl = (deg, row, layer) => {
    const [d, u1] = cowlTop(deg), lin = layer === 'in' ? D.hemThick : 0;
    if (row === 2) return atRY(deg, u1[0] + D.flare - lin, row2Y(deg, u1[0] + D.flare) - lin * 0.5, z0);
    return clearUnder(atRY(deg, d[0] - D.gap - lin, row === 1 ? row1Y(d) + 1.3 * lin : d[1] - D.drop, z0), layer);
  };
  // a point kept over the cowl's top by `over`: pulled in toward the shawl's axis until it is
  const overCowl = (p) => {
    const deg = Math.atan2(p[0], p[2] - z0) * 180 / Math.PI, T = cowlTop(deg);
    const yAt = (r) => { if (r <= T[0][0]) return -Infinity; for (let i = 0; i + 1 < T.length; i++) if (r <= T[i + 1][0]) return T[i][1] + (T[i + 1][1] - T[i][1]) * (r - T[i][0]) / (T[i + 1][0] - T[i][0]); return T[T.length - 1][1]; };
    let r = Math.hypot(p[0], p[2] - z0);
    while (r > T[0][0] - D.gap && p[1] < yAt(r) + D.over) r -= 0.01;
    return atRY(deg, r, p[1], z0);
  };
  // under the chin, the opening's lower rim: from the frame's foot at azimuth `bottom` (about the shawl's axis) round the
  // front to x 0, `chin` of the border's width over the shell's row 2 on the cowl's roll (and back by its depth): the
  // shell's rows 0 to 2 (S), the rim (R) and the lining (rows 0 and 1, L) there at FRONT columns' azimuths, the last the
  // frame's foot
  const aE1 = D.bottom, FR = D.chinCols.map((t) => aE1 * t);
  // (low under the chin, where the jaw comes down and round as the head nods, turns and bows: the shell's row 2 just
  // over the cowl's rim (`chinDrop`), inside its roll, but at the very front, under the chin, `chinIn` inside the roll's
  // top and `chinFront` over it, so the border shows there; columns at `chinCols` of the way to the frame's foot; the
  // lining's row 1 THICK lower, each blended by t, the way to the frame's foot)
  const down = (p, dy) => [p[0], p[1] - dy, p[2]];
  const tOf = (c) => c / (FR.length - 1);
  // (the patch's sides, between the front column and the frame's foot, sunk `chinSink` into the cowl's opening)
  const sink = (c) => (c === 0 ? 0 : D.chinSink * (1 - tOf(c) ** 3));
  // (and `chinGap` further in from the cowl's rim, so their chords between columns keep inside it)
  const inward = (p, c) => { if (c === 0) return p; const k = D.chinGap * (1 - tOf(c) ** 3), r = Math.hypot(p[0], p[2] - z0), f = (r - k) / r; return [p[0] * f, p[1], z0 + (p[2] - z0) * f]; };
  const lowS2 = (deg, t) => {
    const [d, u1] = cowlTop(deg), hi = inCowl(deg, 2, 'out');
    // (the front column under the chin, over the roll's inner slope; the rest just over the cowl's rim, inside its roll)
    const lo = t === 0 ? atRY(deg, u1[0] - D.chinIn, u1[1] + D.chinFront, z0) : atRY(deg, d[0] - D.gap, d[1] + D.lift - D.chinSink + D.chinDrop, z0);
    return lerp(lo, hi, t * t * t);
  };
  // (the rim over the shell by the border's width, up at the front, toward the frame's first point at the foot, where the
  // border turns up the side)
  const rimOf = (deg, t) => {
    const q = lowS2(deg, t), rd = unit([q[0], 0, q[2] - z0]), toFrame = unit(sub(D.frame[0], q)), dir = unit(lerp([0, 1, 0], toFrame, t ** 6));
    return add(add(q, mul(dir, D.chinW * (0.6 + 0.4 * t))), mul(rd, -bandBack));
  };
  // (its hem, row 0, `chinHem` under row 1, clear of the throat inside the cowl, out to the frame's foot's at the side)
  const hem = (k, c) => (k === 1 ? 0 : D.chinHem + (D.drop + D.lift - D.chinHem) * tOf(c) ** 3);
  const chinPatch = {
    S: [0, 1, 2].map((k) => FR.map((a, c) => (k === 2 ? inward(lowS2(a, tOf(c)), c) : clearUnder(inward(down(inCowl(a, 1, 'out'), sink(c) + hem(k, c)), c), 'out')))),
    R: FR.map((a, c) => inward(rimOf(a, tOf(c)), c)),
    L: [0, 1].map((k) => FR.map((a, c) => clearUnder(inward(down(inCowl(a, 1, 'in'), sink(c) + (1 - tOf(c)) * D.THICK + hem(k, c)), c), 'in'))),
  };
  // the frame E0, from its foot (row 2, the rim's end) to the apex A (row Kf), evenly by arc length; the curve's ends
  // kept on their tangents
  const E0_2 = chinPatch.R[FR.length - 1];
  const E0 = [inCowl(aE1, 0, 'in'), inCowl(aE1, 1, 'in'), E0_2, ...D.frame, D.apex];
  // the border's outer line E1: E0 out in the opening's plane by the band's width, and back by its depth; over the apex
  // straight up: B. (On the cowl, rows 0 to 2, the shell's at the frame's foot.)
  const E1 = E0.map((p, k) => {
    if (k <= 2) return inCowl(aE1, k, 'out');
    if (k === Kf) return add(p, [0, bandW, -bandBack]);
    // (never down: under the chin the border runs out to the side, over the cowl)
    const T = unit(sub(E0[Math.min(Kf, k + 1)], E0[k - 1]));
    const n = unit([T[1], Math.max(0, -T[0]), 0]);
    return overCowl(add(add(p, mul(n, bandW)), [0, 0, -bandBack]));
  });
  // the teeth's outer line E2 (the shell's first column beside the rim, rows 3 to below the apex's; the apex's row the
  // shell's own): E1 out in the opening's plane by `teethW` (by row) and back by `teethBack`, so the teeth face forward
  // and out round the face; and the band's back (E2b), for the lining behind it
  const E2 = [], E2b = [];
  for (let k = 3; k < Kf; k++) {
    const T = unit(sub(E0[Math.min(Kf, k + 1)], E0[k - 1])), n = unit([T[1], Math.max(0, -T[0]), 0]);
    E2[k] = overCowl(add(add(E1[k], mul(n, D.teethW[k - 3])), [0, 0, -D.teethBack]));
    let b = unit(cross(T, sub(E2[k], E0[k])));
    if (b[2] > 0) b = mul(b, -1);
    E2b[k] = b;
  }
  const B = E1[Kf], tip = D.tip;
  // the front line, from B up the forehead to the tip (rows Kf to K)
  const fctrl = [B, ...D.front, tip];
  const F = resample(spline(fctrl, add(B, sub(B, fctrl[1])), add(tip, sub(tip, fctrl[fctrl.length - 2]))), K - Kf);
  // the back line, from the cowl behind the neck up the back and over the skull to the tip (rows 2 to K)
  const C2 = inCowl(180, 2, 'out');
  const bctrl = [C2, ...[...D.back].reverse(), tip];
  const C = [inCowl(180, 0, 'out'), inCowl(180, 1, 'out'), ...resample(spline(bctrl, add(C2, [0, -0.3, 0.1]), add(tip, sub(tip, bctrl[bctrl.length - 2]))), K - 2)];
  // each row's front point: the border's outer line up to the apex's row, then the front line
  const front = (k) => (k < Kf ? E1[k] : F[k - Kf]);
  // the design surface
  const byY = (P) => { const Q = P.map((p) => [p[1], p[2]]).sort((u, v) => u[0] - v[0]); return (y) => interp(Q, y); };
  const zFront = byY([...E1.slice(3, Kf), ...F]), zBack = byY(C.slice(2)), half = (y) => interp(D.width, y), yTop = tip[1];
  const surface = (d) => {
    const g = (r) => {
      const p = add(O, mul(d, r)), y = p[1];
      if (y >= yTop) return 1;
      const a = half(y), zf = zFront(y), zb = zBack(y), zc = (zf + zb) / 2, bz = (zf - zb) / 2;
      if (a <= 1e-3 || bz <= 1e-3) return 1;
      return Math.pow(Math.abs(p[0]) / a, D.power) + Math.pow(Math.abs(p[2] - zc) / bz, D.power) - 1;
    };
    let lo = 0, hi = 6;
    for (let it = 0; it < 40; it++) { const m = (lo + hi) / 2; if (g(m) < 0) lo = m; else hi = m; }
    return lo;
  };
  // the shell's rows
  const ae = (p) => { const v = sub(p, O); return [Math.atan2(v[0], v[2]), Math.atan2(v[1], Math.hypot(v[0], v[2]))]; };
  const out = [];
  for (let k = 0; k < K; k++) {
    if (k <= 2) { const a0 = aE1; out.push(TS.map((t, j) => (j === 0 ? E1[k] : inCowl(a0 + (180 - a0) * t, k, 'out')))); continue; }
    const [a0, e0] = ae(front(k)), [, e1] = ae(C[k]), a1 = Math.PI;
    out.push(TS.map((t, j) => {
      if (j === 0) return front(k);
      if (j === 1 && k < Kf) return E2[k];
      if (j === TS.length - 1) return C[k];
      // (each row at least `step` over the one under it: the elevation raised until it is)
      const a = a0 + (a1 - a0) * t;
      let e = e0 + (e1 - e0) * t, p;
      for (let it = 0; it < 60; it++, e += Math.PI / 180) {
        const d = [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
        p = overCowl(add(O, mul(d, Math.max(surface(d) - (j === SEAM ? D.seam : 0), reach(d) + D.IN + D.THICK))));
        if (p[1] >= out[k - 1][j][1] + D.step) break;
      }
      return p;
    }));
  }
  // the lining: rows 0 and 1 the cowl's, THICK inside; the rest the shell moved in by THICK along its normal (the grid's
  // two tangents' cross, turned toward O; on row 2 the tangent up from row 1), E0 its edge at the frame and A at the apex's row; where the head is nearer than
  // IN, the shell and the lining both moved out
  const at = (k, j) => (k >= K ? tip : j < 0 ? [-out[k][-j][0], out[k][-j][1], out[k][-j][2]] : out[k][Math.min(j, TS.length - 1)]);
  const inn = [];
  for (let k = 0; k < K; k++) {
    if (k <= 1) { const a0 = aE1; inn.push(TS.map((t) => inCowl(a0 + (180 - a0) * t, k, 'in'))); continue; }
    inn.push(TS.map((t, j) => {
      if (j === 0 && k <= Kf) return E0[k];
      const J = TS.length - 1, tj = sub(at(k, j === J ? J - 1 : j + 1), at(k, j === J ? -(J - 1) : j === 0 ? -1 : j - 1)), tk = sub(at(k === 2 ? k : k + 1, j), at(k - 1, j));
      let n = unit(cross(tj, tk));
      if (dot(n, sub(O, out[k][j])) < 0) n = mul(n, -1);
      // (behind the teeth's outer line, mitred between the band's back and the shell's inside)
      if (j === 1 && E2b[k]) { const m = unit(add(E2b[k], n)); n = mul(m, 1 / Math.max(0.5, dot(m, n))); }
      let p = add(out[k][j], mul(n, D.THICK));
      const dd = unit(sub(p, O)), need = reach(dd) + D.IN, r = Math.hypot(...sub(p, O));
      if (r < need) { const push = mul(dd, need - r); p = add(p, push); out[k][j] = add(out[k][j], push); }
      return p;
    }));
  }
  // E0 cleared by IN, E1 by IN + THICK, along their direction from O
  for (let k = 3; k < Kf; k++) for (const [L, c] of [[inn, D.IN], [out, D.IN + D.THICK]]) {
    const p = L[k][0], d = unit(sub(p, O)), r = Math.hypot(...sub(p, O)), need = reach(d) + c;
    if (r < need) L[k][0] = add(O, mul(d, need));
  }
  const tipIn = add(tip, [0, -1.6 * D.THICK, -0.3 * D.THICK]);
  const G = meshOfHood(D, { out, in: inn, front: chinPatch }, tip, tipIn, opts);
  G.design = D; G.frame = { E0, E1, F, C, B, tip, apex: E0[Kf] };
  return G;
}

function meshOfHood(D, rows, tip, tipIn, opts) {
  const G = meshOf(), K = D.K, Kf = D.Kf, J = TS.length;
  const mono = !!opts.mono;
  const mat = (m) => (mono ? (m === 'lining' ? 'lining' : 'fabric') : m);
  // vertices: per half (s = 1 the body's left, -1 its right); the back column (j = J - 1) shared, and the front column
  // from the apex's row up (x 0)
  const V = { out: [[], []], in: [[], []] };
  for (const layer of ['out', 'in']) for (let k = 0; k < K; k++) {
    const part = layer === 'out' ? 'shell' : 'lining';
    const back = G.vert(rows[layer][k][J - 1], part), front0 = k >= Kf ? G.vert(rows[layer][k][0], 'border') : null;
    for (const [h, s] of [[0, 1], [1, -1]]) {
      V[layer][h][k] = rows[layer][k].map((p, j) => (j === J - 1 ? back : j === 0 && front0 !== null ? front0 : G.vert([p[0] * s, p[1], p[2]], j === 0 ? 'border' : part)));
    }
  }
  const T = G.vert(tip, 'shell'), Ti = G.vert(tipIn, 'lining');
  // (under the chin: the front patch's vertices, x 0 shared, the last column the main grid's)
  const FRn = rows.front.R.length, fm = FRn - 1, FV = [[], []];
  const c0 = { S: rows.front.S.map((r) => G.vert(r[0], 'shell')), R: G.vert(rows.front.R[0], 'border'), L: rows.front.L.map((r) => G.vert(r[0], 'lining')) };
  // (a rolled edge's crest: midway between its two sides, pushed out by `roll` square to the band (its width a to b, its
  // run along tangent t), out from the head's vertical axis)
  const crest = (a, b, t, f = 1) => {
    const m = lerp(a, b, 0.5); let n = unit(cross(sub(b, a), t));
    if (n[0] * (m[0] - D.O[0]) + n[2] * (m[2] - D.O[2]) < 0) n = mul(n, -1);
    return add(m, mul(n, D.roll * f));
  };
  const P = (i) => G.verts[i];
  const A = V.in[0][Kf][0], Bv = V.out[0][Kf][0], LA = G.vert(crest(P(A), P(Bv), [1, 0, 0]), 'border'), Ln = [[], []], teeth = [];
  let LR0 = null;
  // (a quad of the shell or the lining kept whole where flat and fanned from its first corner, else cut on that same
  // diagonal: the two layers stay apart when a pose shears them)
  const quad = (a, b, c, d, m, part) => {
    if (offPlane(G.verts, [a, b, c, d]) <= TOL) { G.poly([a, b, c, d], m, part, true); G.polys[G.polys.length - 1].anchor = a; return; }
    G.poly([a, b, c], m, part); G.poly([a, c, d], m, part);
  };
  for (const h of [0, 1]) {
    const Vo = V.out[h], Vi = V.in[h];
    G.tag = 'shell';
    // (the teeth: on the shell's outside beside the opening's rim, over rows teeth[0] to teeth[1]: a tan tooth a row, its
    // base on the shell's first column, its point on the rim's edge; the cream between, their bases on the rim's edge)
    const toothRow = (k) => !mono && !opts.plain && k >= D.teeth[0] && k < D.teeth[1];
    const Xt = [];
    for (let k = 0; k + 1 < K; k++) for (let j = 0; j + 1 < J; j++) {
      if (j === 0 && toothRow(k)) {
        const x = (Xt[k] = G.vert(lerp(G.verts[Vo[k][0]], G.verts[Vo[k + 1][0]], 0.5), 'border'));
        teeth.push([x, h, k]);
        G.tag = 'teeth';
        G.poly([Vo[k][1], Vo[k + 1][1], x], 'rune', 'shell');
        G.poly([Vo[k][0], x, Vo[k][1]], 'pattern', 'shell');
        G.poly([x, Vo[k + 1][0], Vo[k + 1][1]], 'pattern', 'shell');
        G.tag = 'shell';
        continue;
      }
      quad(Vo[k][j], Vo[k][j + 1], Vo[k + 1][j + 1], Vo[k + 1][j], mat('fabric'), 'shell');
    }
    for (let j = 0; j + 1 < J; j++) G.poly([Vo[K - 1][j], Vo[K - 1][j + 1], T], mat('fabric'), 'shell');
    G.tag = 'lining';
    for (let k = 0; k + 1 < K; k++) for (let j = 0; j + 1 < J; j++) quad(Vi[k][j], Vi[k][j + 1], Vi[k + 1][j + 1], Vi[k + 1][j], 'lining', 'lining');
    for (let j = 0; j + 1 < J; j++) G.poly([Vi[K - 1][j], Vi[K - 1][j + 1], Ti], 'lining', 'lining');
    // the opening's rim, E0 to E1, up to the apex's row (A to B): a thick rolled edge of trim, over a crest midway pushed
    // out from the head by `roll` (the rim's outer edge split at the teeth's points)
    G.tag = 'border';
    const e0 = (k) => Vi[k][0], e1 = (k) => Vo[k][0];
    const lineOf = (k) => (k === Kf ? LA : (Ln[h][k] ??= G.vert(crest(P(e0(k)), P(e1(k)), sub(P(e0(k + 1)), P(e0(Math.max(2, k - 1)))), k === 2 ? D.footRoll : 1), 'border')));
    for (let k = 2; k < Kf; k++) {
      if (mono) { G.poly([e0(k), e1(k), e1(k + 1), e0(k + 1)], 'fabric', 'border'); continue; }
      const l0 = lineOf(k), l1 = lineOf(k + 1);
      G.poly([e0(k), l0, l1, e0(k + 1)], 'trim', 'border');
      G.poly([l0, e1(k), ...(Xt[k] !== undefined ? [Xt[k]] : []), e1(k + 1), l1], 'trim', 'border');
    }
    // the hem: the shell's row 0 to the lining's
    G.tag = 'hem';
    for (let j = 0; j + 1 < J; j++) G.poly([Vo[0][j], Vo[0][j + 1], Vi[0][j + 1], Vi[0][j]], mat('fabric'), 'hem');
    // under the chin: the shell's rows 0 to 2 and the lining's 0 and 1 round the front, the rim over them, the border on
    // the rim's front (its band and a tooth a column), the hem
    const s = h ? -1 : 1, mir = (p) => [p[0] * s, p[1], p[2]];
    const fv = (key, k, c) => {
      if (c === 0) return key === 'R' ? c0.R : c0[key][k];
      if (c === fm) return key === 'S' ? Vo[k][0] : key === 'L' ? Vi[k][0] : Vi[2][0];
      const id = `${key}${k}:${c}`;
      return (FV[h][id] ??= G.vert(mir(key === 'R' ? rows.front.R[c] : rows.front[key][k][c]), key === 'S' ? 'shell' : key === 'L' ? 'lining' : 'border'));
    };
    const R = (c) => fv('R', 0, c), Sv = (k, c) => fv('S', k, c), Lv = (k, c) => fv('L', k, c);
    const flip = (q) => (h ? [...q].reverse() : q);
    for (let c = 0; c < fm; c++) {
      G.tag = 'shell';
      // (a tooth a column but the last, beside the frame's foot, where the rim turns up the side)
      const tooth = !mono && !opts.plain && c + 1 < fm;
      for (let k = 0; k < (tooth ? 1 : 2); k++) quad(...flip([Sv(k, c + 1), Sv(k, c), Sv(k + 1, c), Sv(k + 1, c + 1)]), mat('fabric'), 'shell');
      G.tag = 'lining';
      quad(...flip([Lv(0, c), Lv(0, c + 1), Lv(1, c + 1), Lv(1, c)]), 'lining', 'lining');
      G.poly(flip([Lv(1, c), Lv(1, c + 1), R(c + 1), R(c)]), 'lining', 'lining');
      G.tag = 'hem';
      G.poly(flip([Sv(0, c), Sv(0, c + 1), Lv(0, c + 1), Lv(0, c)]), mat('fabric'), 'hem');
      G.tag = 'border';
      if (mono) { G.poly(flip([R(c), Sv(2, c), Sv(2, c + 1), R(c + 1)]), 'fabric', 'border'); continue; }
      const tR = (c2) => (c2 === 0 ? [1, 0, 0] : sub(P(R(c2 + 1)), P(R(c2 - 1))));
      const lr = (c2) => (c2 === fm ? lineOf(2) : (FV[h][`lr${c2}`] ??= (c2 === 0 ? (LR0 ??= G.vert(crest(P(R(0)), P(Sv(2, 0)), tR(0), D.chinRoll), 'border')) : G.vert(crest(P(R(c2)), P(Sv(2, c2)), tR(c2), D.chinRoll), 'border'))));
      G.poly(flip([R(c), lr(c), lr(c + 1), R(c + 1)]), 'trim', 'border');
      const x = tooth ? G.vert(lerp(G.verts[Sv(2, c)], G.verts[Sv(2, c + 1)], 0.5), 'border') : null;
      G.poly(flip([lr(c), Sv(2, c), ...(x !== null ? [x] : []), Sv(2, c + 1), lr(c + 1)]), 'trim', 'border');
      // (and the teeth on the shell under it: points on the rim's edge, tan bases on row 1)
      if (x !== null) {
        teeth.push([x, h, -1 - c]);
        G.tag = 'teeth';
        G.poly(flip([Sv(1, c + 1), Sv(1, c), x]), 'rune', 'shell');
        G.poly(flip([Sv(2, c), x, Sv(1, c)]), 'pattern', 'shell');
        G.poly(flip([x, Sv(2, c + 1), Sv(1, c + 1)]), 'pattern', 'shell');
      }
    }

  }
  orient(G, (p) => sub(p, D.O));
  for (const q of G.polys) if (q.anchor !== undefined) { const i = q.v.indexOf(q.anchor); q.v = [...q.v.slice(i), ...q.v.slice(0, i)]; }
  G.tris = trisOf(G);
  G.V = V; G.tip = T; G.tipIn = Ti; G.frontV = FV; G.frontC0 = c0; G.lr0 = LR0; G.line = Ln; G.lineApex = LA; G.teeth = teeth;
  return G;
}

/* ---- weights -------------------------------------------------------------------------------------------------------- */
/**
 * The hood's weights: rows 0 to 2 (on the cowl) the shawl's cowl rim's (its ring d at the same azimuth, its two nearest
 * columns blended), so the hem moves with the cowl round it; above, the head's by height (HEAD_SHARE: none at `from`,
 * all at `to`, the body's y; at most ROW_CAP by row), so the hood is snug on the head as it turns and nods. The lining and the border take the
 * shell's beside them, so the cloth's thickness moves as one.
 */
export const HEAD_SHARE = { male: { from: 0.25, to: 0.85 }, female: { from: 0.15, to: 0.8 } };
/** And at most this much by row (rows 0 and 1, in the cowl, none; row 2, on its roll, a little, so the jaw does not
 * turn into it as the head looks round), so the turn is shared over the rows over it. */
export const ROW_CAP = [0, 0, 0.2, 0.6, 0.85, 1];
const ROW_CAP0 = ROW_CAP;
/** And more toward the frame (by 1 - the column's TS), so the opening's lower sides go with the jaw. */
export const FRONT_SHARE = [0, 0, 0.1, 0.25, 0.2];
const FRONT_SHARE0 = FRONT_SHARE;
/** The head's share of the patch under the chin at the front (falling to the frame's foot's beside it). */
export const CHIN_SHARE = { male: 0.25, female: 0.2 };
/**
 * The shell's vertices refitted to the game's idle and walk (lowgarment.mjs applyRefit): per body, the left half's by row
 * and column (`out:3:2`, G.V.out[0]; the right half's, G.V.out[1], mirrored) and the chin patch's on the middle line
 * (`S:0`, `L:0`, `R`, `lr`, G.frontC0, G.lr0), the tip, and the teeth under the chin (`tooth:1` the left half's
 * first beside the middle, the right half's mirrored); the lining and the frame's line follow as before. Found by
 * tools/sculpt/lowrefit.mjs.
 */
export const REFIT = {
  male: {},
  female: {
    'out:1:1': [['spine_03', 0.37], ['neck_01', 0.36], ['neck_02', 0.14], ['clavicle_l', 0.13]],
    'out:1:2': [['spine_03', 0.59], ['neck_02', 0.28], ['neck_01', 0.09], ['clavicle_l', 0.03]],
    'out:1:3': [['spine_03', 0.57], ['neck_02', 0.28], ['neck_01', 0.09], ['clavicle_l', 0.05]],
  },
};
export function hoodWeights(rig, G, shawl, o = {}) {
  const head = rig.at.get('head'), z0 = shawl.design.z0, K = G.design.K, Kf = G.design.Kf, HS = o.headShare ?? HEAD_SHARE[rig.who];
  const ROW_CAP = o.rowCap ?? ROW_CAP0, FRONT_SHARE = o.frontShare ?? FRONT_SHARE0, CHIN = o.chinShare ?? CHIN_SHARE[rig.who];
  const SC = shawl.cols, N = SC.length;
  const rimW = (p) => {
    const deg = ((Math.atan2(p[0], p[2] - z0) * 180 / Math.PI) + 360) % 360;
    const k = Math.floor(deg / (360 / N)) % N, t = (deg - SC[k].deg) / (360 / N);
    return mixW(shawl.vw[shawl.rings.d[k]], shawl.vw[shawl.rings.d[(k + 1) % N]], Math.min(1, Math.max(0, t)));
  };
  const W = new Array(G.verts.length).fill(null);
  const share = (k, y, j) => Math.min(1, Math.min(ROW_CAP[Math.min(k, ROW_CAP.length - 1)], Math.max(0, (y - HS.from) / (HS.to - HS.from))) + (FRONT_SHARE[k] ?? 0) * (1 - TS[j]));
  for (const h of [0, 1]) G.V.out[h].forEach((r, k) => r.forEach((vi, j) => { W[vi] ??= mixW(rimW(G.verts[vi]), [[head, 1]], share(k, G.verts[vi][1], j)); }));
  W[G.tip] = [[head, 1]]; W[G.tipIn] = [[head, 1]];
  // (under the chin: the front patch's shell, lining and rim, the cowl rim's)
  // (the patch under the chin: the rim at the front and the shell under it CHIN_SHARE of the head, so they follow the
  // chin down as the head bows to look; toward the frame's foot its share by row, FRONT_SHARE)
  const fm = G.design.chinCols.length - 1, ch = (key, k, c) => (FRONT_SHARE[key === 'R' || key === 'lr' ? 2 : k] ?? 0) * (c / fm) + (c < 1 && (key === 'R' || key === 'lr' || (key === 'S' && k === 2)) ? CHIN * (1 - c) : 0);
  const chinW = (vi, key, k, c) => mixW(rimW(G.verts[vi]), [[head, 1]], ch(key, k, c));
  G.frontC0.S.forEach((vi, k) => { W[vi] = chinW(vi, 'S', k, 0); });
  G.frontC0.L.forEach((vi, k) => { W[vi] = chinW(vi, 'L', k, 0); });
  W[G.frontC0.R] = chinW(G.frontC0.R, 'R', 0, 0);
  if (G.lr0 !== null) W[G.lr0] = chinW(G.lr0, 'lr', 0, 0);
  for (const o of G.frontV) for (const [id, vi] of Object.entries(o)) {
    const m = id.match(/^(lr)(\d+)$/) ?? id.match(/^([SLR])(\d+):(\d+)$/);
    W[vi] = m[1] === 'lr' ? chinW(vi, 'lr', 0, +m[2]) : chinW(vi, m[1], +m[2], +m[3]);
  }
  // the refitted vertices (REFIT), before the lining and the frame's line take the shell's
  const refit = o.refit ?? REFIT[rig.who], pick = (f) => Object.fromEntries(Object.entries(refit).filter(([k]) => f(k)));
  applyRefit(rig, W, pick((k) => !k.startsWith('tooth:')), (key, mirror) => {
    const m = key.match(/^out:(\d+):(\d+)$/);
    if (m) return G.V.out[mirror ? 1 : 0][+m[1]]?.[+m[2]];
    if (mirror) return undefined;
    const c = key.match(/^([SL]):(\d+)$/);
    return c ? G.frontC0[c[1]][+c[2]] : key === 'R' ? G.frontC0.R : key === 'lr' ? G.lr0 ?? undefined : key === 'tip' ? G.tip : undefined;
  });
  for (const h of [0, 1]) G.V.in[h].forEach((r, k) => r.forEach((vi, j) => { W[vi] ??= W[G.V.out[h][k][j]]; }));
  const col0 = (h, k) => G.V.out[h][k][0];
  for (const h of [0, 1]) G.line[h].forEach((vi, k) => { if (vi !== undefined) W[vi] = W[col0(h, k)]; });
  W[G.lineApex] = W[col0(0, Kf)];
  for (const [x, h, k] of G.teeth) W[x] = k < 0 ? chinW(x, 'S', 2, -1 - k + 0.5) : mixW(W[col0(h, k)], W[col0(h, k + 1)], 0.5);
  // (the teeth under the chin refitted: `tooth:1` the first beside the middle on the left half, its mirror the right's)
  const tooth = (h, k) => G.teeth.find(([, th, tk]) => th === h && tk === k)?.[0];
  applyRefit(rig, W, pick((k) => k.startsWith('tooth:')), (key, mirror) => tooth(mirror ? 1 : 0, -+key.slice(6)));
  return W.map((w) => w ?? [[head, 1]]);
}
const mixW = (A, Bw, t) => { const o = new Map(); for (const [b, w] of A) o.set(b, (o.get(b) ?? 0) + w * (1 - t)); for (const [b, w] of Bw) o.set(b, (o.get(b) ?? 0) + w * t); const l = [...o].filter(([, w]) => w > 1e-6).sort((x, y) => y[1] - x[1]).slice(0, 4), s = l.reduce((a, [, w]) => a + w, 0); return l.map(([b, w]) => [b, w / s]); };

/* ---- the game's copy ------------------------------------------------------------------------------------------------ */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync } = await import('node:fs');
  const { buildRig } = await import('../lowrig.mjs');
  const { garmentAsset } = await import('../lowgarment.mjs');
  const { buildOutfit } = await import('./outfit1.mjs');
  for (const who of ['male', 'female']) {
    // (the shawl as the game wears it: fitted over the tunic, garments/outfit1.mjs)
    const rig = buildRig(who), O = buildOutfit(rig), S = O.shawl;
    const G = buildHood(rig, S, undefined, { under: [O.tunic] });
    G.vw = hoodWeights(rig, G, S);
    const file = new URL(`../../../src/sculpt/assets/lowhood-${who}.json`, import.meta.url);
    const A = { built: 'node tools/sculpt/garments/hood.mjs (tools/sculpt/lowgarment.mjs garmentAsset)', ...garmentAsset(rig, G, MATS, LOOKS) };
    writeFileSync(file, JSON.stringify(A));
    console.log(who, `${G.verts.length} vertices, ${G.tris.length} triangles, ${A.base} + ${A.bones.length} bones: wrote`, file.pathname);
  }
}
