// The hood of the first outfit (the hood sheet: a pointed, faceted shell round the head, a structured face opening with a
// tan border and a row of cream and tan teeth, a muted brown lining, a smooth back drape into the cowl, a centre gusset
// with one seam each side), worn with the shawl (tools/sculpt/garments/shawl.mjs): it rises out of the shawl's cowl, its
// hem inside the cowl's rim, so the two read as one garment and the cowl is the shawl's own. Fitted to each low-poly body
// from the one design (DESIGN, per body), skinned to its rig's head and neck: no bones of its own.
//
//   buildHood(rig, shawl) → { verts, polys: [{ v, mat, part, tag }], tris, part, rows, design }
//   hoodWeights(rig, G, shawl) → per vertex [[bone, weight], ...] (the body's bones only)
//
//   node tools/sculpt/garments/hood.mjs
//     writes the game's copy beside each body: src/sculpt/assets/lowhood-male.json and lowhood-female.json
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
// Materials: fabric (the shell), trim (the border's band at the opening and its teeth), pattern (the cream between the
// teeth), lining.
import { offPlane, TOL, samplesOf, meshOf, orient, trisOf, atRY, dirOf, sub, add, mul, dot, cross, unit, lerp } from '../lowgarment.mjs';
import { MATS as SHAWL_MATS } from './shawl.mjs';

/**
 * The materials: the shawl's own cream, tan and pattern (the hood is the same cloth, its border the same tan, its teeth the
 * shawl's teeth), and the lining, the one colour of its own: the sheet's #7A5E4A taken down about as the shawl's colours
 * were from their sheet's, a little further so it reads darker than the border inside the opening, as on the sheet.
 */
export const MATS = { fabric: SHAWL_MATS.fabric, trim: SHAWL_MATS.trim, pattern: SHAWL_MATS.pattern, lining: [0.34, 0.235, 0.175] };

/**
 * The design per body (the body's units: y up, the chin's underside 0; z forward; x the body's left):
 *   O: the head's centre (the rows' azimuths and elevations about it; every front point ahead of it, every back one behind);
 *   frame: E0's control points up the left side, from the cowl to below the apex; apex: A (x 0, over the brow); bottom:
 *   the azimuth (about the shawl's axis) where the frame meets the cowl; band: the border's width and how far back its
 *   outer line lies; line: the share of the border that is the band at the opening; teeth: the frame rows that carry a
 *   tooth; cowlBand: the border's width on the cowl, as a share;
 *   front: the front line's control points from B up to the tip; tip: T; back: the back line's, down from T to the cowl;
 *   width: the half-width by height [[y, w]]; power: the cross-section's superellipse power;
 *   THICK, IN: the cloth's thickness and the lining's clearance from the head; gap, lift, drop, flare, rise, over: the
 *   hem in the cowl, the lower edge on its roll, the shell over it; step: each row at least this over the one under it;
 *   Kf: the apex's row (rows 2 to Kf along the frame); K: the tip's row (Kf to K along the front line); seam: how far in
 *   the seam's line is pressed.
 */
export const DESIGN = {
  male: {
    O: [0, 1.1, 0.1],
    bottom: 66, frame: [[0.92, 0.55, 0.55], [0.84, 0.95, 0.82], [0.55, 1.2, 1.0]], apex: [0, 1.28, 1.04],
    band: [0.3, 0.04], line: 0.32, cowlBand: 0.7, teeth: [3, 7],
    front: [[0, 1.9, 0.86], [0, 2.2, 0.55]], tip: [0, 2.52, 0.14],
    back: [[0, 2.2, -0.48], [0, 1.6, -0.95], [0, 1.15, -1.0]],
    width: [[0.4, 1.12], [0.9, 1.0], [1.5, 0.95], [1.9, 0.8], [2.2, 0.5], [2.52, 0.04]], power: 2.4,
    THICK: 0.06, IN: 0.05, gap: 0.035, lift: 0.07, drop: 0.24, over: 0.06, flare: -0.18, rise: 0.12, step: 0.1, Kf: 7, K: 10, seam: 0.03,
  },
  female: {
    O: [0, 1.1, 0.05],
    bottom: 72, frame: [[0.95, 0.5, 0.42], [0.84, 0.95, 0.74], [0.5, 1.25, 0.92]], apex: [0, 1.33, 0.96],
    band: [0.28, 0.04], line: 0.32, cowlBand: 0.5, teeth: [3, 7],
    front: [[0, 1.92, 0.8], [0, 2.2, 0.48]], tip: [0, 2.48, 0.06],
    back: [[0, 2.15, -0.5], [0, 1.55, -1.02], [0, 1.1, -1.08]],
    width: [[0.4, 1.0], [0.9, 0.92], [1.5, 0.88], [1.9, 0.74], [2.2, 0.46], [2.48, 0.04]], power: 2.2,
    THICK: 0.055, IN: 0.05, gap: 0.03, lift: 0.07, drop: 0.2, over: 0.06, flare: -0.16, rise: 0.1, step: 0.09, Kf: 7, K: 10, seam: 0.03,
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
  const row1Y = (d) => d[1] + D.lift;
  // (row 2's height at radius r: `rise` over the roll's top, and high enough that the line up to it from row 1 passes
  // over the roll's top by `rise` too)
  const row2Y = (deg, r) => {
    const [d, u1] = cowlTop(deg), r1 = d[0] - D.gap, y1 = row1Y(d);
    return Math.max(u1[1] + D.rise, y1 + (u1[1] + D.rise - y1) * (r - r1) / Math.max(0.05, u1[0] - r1));
  };
  // the rows on the cowl: 0 and 1 `gap` inside its rim (the lining THICK further in, and at row 1 higher, over the flare),
  // 2 resting on the upper roll
  const inCowl = (deg, row, layer) => {
    const [d, u1] = cowlTop(deg), lin = layer === 'in' ? D.THICK : 0;
    if (row === 2) return atRY(deg, u1[0] + D.flare - lin, row2Y(deg, u1[0] + D.flare) - lin * 0.5, z0);
    return atRY(deg, d[0] - D.gap - lin, row === 1 ? row1Y(d) + 1.3 * lin : d[1] - D.drop, z0);
  };
  // a point kept over the cowl's top by `over`: pulled in toward the shawl's axis until it is
  const overCowl = (p) => {
    const deg = Math.atan2(p[0], p[2] - z0) * 180 / Math.PI, T = cowlTop(deg);
    const yAt = (r) => { if (r <= T[0][0]) return -Infinity; for (let i = 0; i + 1 < T.length; i++) if (r <= T[i + 1][0]) return T[i][1] + (T[i + 1][1] - T[i][1]) * (r - T[i][0]) / (T[i + 1][0] - T[i][0]); return T[T.length - 1][1]; };
    let r = Math.hypot(p[0], p[2] - z0);
    while (r > T[0][0] - D.gap && p[1] < yAt(r) + D.over) r -= 0.01;
    return atRY(deg, r, p[1], z0);
  };
  // the frame E0, from row 2 to the apex A (row Kf), evenly by arc length; the curve's ends kept on their tangents
  const E0_2 = inCowl(D.bottom, 2, 'in');
  const ctrl = [E0_2, ...D.frame, D.apex];
  const curve = spline(ctrl, add(E0_2, sub(E0_2, ctrl[1])), add(D.apex, sub(D.apex, ctrl[ctrl.length - 2])));
  const E0 = [inCowl(D.bottom, 0, 'in'), inCowl(D.bottom, 1, 'in'), ...resample(curve, Kf - 2)];
  // the border's outer line E1: E0 out in the opening's plane by the band's width, and back by its depth; over the apex
  // straight up: B. (On the cowl, rows 0 to 2, round the cowl from E0.)
  const aE1 = D.bottom + (D.cowlBand * bandW / (cowlTop(D.bottom)[1][0] + D.flare)) * 180 / Math.PI;
  const E1 = E0.map((p, k) => {
    if (k <= 2) return inCowl(aE1, k, 'out');
    if (k === Kf) return add(p, [0, bandW, -bandBack]);
    const T = unit(sub(E0[Math.min(Kf, k + 1)], E0[k - 1]));
    const n = unit([T[1], -T[0], 0]);
    return overCowl(add(add(p, mul(n, bandW)), [0, 0, -bandBack]));
  });
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
  // two tangents' cross, turned toward O), E0 its edge at the frame and A at the apex's row; where the head is nearer than
  // IN, the shell and the lining both moved out
  const at = (k, j) => (k >= K ? tip : j < 0 ? [-out[k][-j][0], out[k][-j][1], out[k][-j][2]] : out[k][Math.min(j, TS.length - 1)]);
  const inn = [];
  for (let k = 0; k < K; k++) {
    if (k <= 1) { const a0 = aE1; inn.push(TS.map((t, j) => inCowl(j ? a0 + (180 - a0) * t : D.bottom, k, 'in'))); continue; }
    inn.push(TS.map((t, j) => {
      if (j === 0 && k <= Kf) return E0[k];
      const J = TS.length - 1, tj = sub(at(k, j === J ? J - 1 : j + 1), at(k, j === J ? -(J - 1) : j === 0 ? -1 : j - 1)), tk = sub(at(k + 1, j), at(k - 1, j));
      let n = unit(cross(tj, tk));
      if (dot(n, sub(O, out[k][j])) < 0) n = mul(n, -1);
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
  const G = meshOfHood(D, { out, in: inn }, tip, tipIn, opts);
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
  const A = V.in[0][Kf][0], Bv = V.out[0][Kf][0], LA = G.vert(lerp(G.verts[A], G.verts[Bv], D.line), 'border'), Ln = [[], []], teeth = [];
  // (a quad of the shell or the lining kept whole where flat and fanned from its first corner, else cut on that same
  // diagonal: the two layers stay apart when a pose shears them)
  const quad = (a, b, c, d, m, part) => {
    if (offPlane(G.verts, [a, b, c, d]) <= TOL) { G.poly([a, b, c, d], m, part, true); G.polys[G.polys.length - 1].anchor = a; return; }
    G.poly([a, b, c], m, part); G.poly([a, c, d], m, part);
  };
  for (const h of [0, 1]) {
    const Vo = V.out[h], Vi = V.in[h];
    G.tag = 'shell';
    for (let k = 0; k + 1 < K; k++) for (let j = 0; j + 1 < J; j++) quad(Vo[k][j], Vo[k][j + 1], Vo[k + 1][j + 1], Vo[k + 1][j], mat('fabric'), 'shell');
    for (let j = 0; j + 1 < J; j++) G.poly([Vo[K - 1][j], Vo[K - 1][j + 1], T], mat('fabric'), 'shell');
    G.tag = 'lining';
    for (let k = 0; k + 1 < K; k++) for (let j = 0; j + 1 < J; j++) quad(Vi[k][j], Vi[k][j + 1], Vi[k + 1][j + 1], Vi[k + 1][j], 'lining', 'lining');
    for (let j = 0; j + 1 < J; j++) G.poly([Vi[K - 1][j], Vi[K - 1][j + 1], Ti], 'lining', 'lining');
    // the border, E0 to E1, up to the apex's row (A to B): a band of trim along the opening (E0 to `line` of the way
    // out), then over rows teeth[0] to teeth[1] a tooth a row (tan, its base the outer edge, its point on the band) and
    // the cream between, their bases on the band
    G.tag = 'border';
    const e0 = (k) => Vi[k][0], e1 = (k) => Vo[k][0];
    const lineOf = (k) => (k === Kf ? LA : (Ln[h][k] ??= G.vert(lerp(G.verts[e0(k)], G.verts[e1(k)], D.line), 'border')));
    for (let k = 0; k < Kf; k++) {
      if (mono) { G.poly([e0(k), e1(k), e1(k + 1), e0(k + 1)], 'fabric', 'border'); continue; }
      const l0 = lineOf(k), l1 = lineOf(k + 1);
      const tooth = !opts.plain && k >= D.teeth[0] && k < D.teeth[1];
      if (!tooth) { G.poly([e0(k), l0, l1, e0(k + 1)], 'trim', 'border'); G.poly([l0, e1(k), e1(k + 1), l1], 'trim', 'border'); continue; }
      const x = G.vert(lerp(G.verts[l0], G.verts[l1], 0.5), 'border');
      teeth.push([x, h, k]);
      G.poly([e0(k), l0, x], 'trim', 'border');
      G.poly([e0(k), x, e0(k + 1)], 'trim', 'border');
      G.poly([x, l1, e0(k + 1)], 'trim', 'border');
      G.poly([e1(k), e1(k + 1), x], 'trim', 'border');
      G.poly([l0, x, e1(k)], 'pattern', 'border');
      G.poly([x, l1, e1(k + 1)], 'pattern', 'border');
    }
    // the hem: the shell's row 0 to the lining's
    G.tag = 'hem';
    for (let j = 0; j + 1 < J; j++) G.poly([Vo[0][j], Vo[0][j + 1], Vi[0][j + 1], Vi[0][j], ...(j === 0 && !mono ? [lineOf(0)] : [])], mat('fabric'), 'hem');
  }
  orient(G, (p) => sub(p, D.O));
  for (const q of G.polys) if (q.anchor !== undefined) { const i = q.v.indexOf(q.anchor); q.v = [...q.v.slice(i), ...q.v.slice(0, i)]; }
  G.tris = trisOf(G);
  G.V = V; G.tip = T; G.tipIn = Ti; G.line = Ln; G.lineApex = LA; G.teeth = teeth;
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
/** And at most this much by row (0 on the cowl), so the turn is shared over the rows over it. */
export const ROW_CAP = [0, 0, 0, 0.4, 0.75, 1];
/** And more toward the frame (by 1 - the column's TS), so the opening's lower sides go with the jaw. */
export const FRONT_SHARE = [0, 0, 0, 0.4, 0.2];
export function hoodWeights(rig, G, shawl) {
  const head = rig.at.get('head'), z0 = shawl.design.z0, K = G.design.K, Kf = G.design.Kf, HS = HEAD_SHARE[rig.who];
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
  for (const h of [0, 1]) G.V.in[h].forEach((r, k) => r.forEach((vi, j) => { W[vi] ??= W[G.V.out[h][k][j]]; }));
  const col0 = (h, k) => G.V.out[h][k][0];
  for (const h of [0, 1]) G.line[h].forEach((vi, k) => { if (vi !== undefined) W[vi] = W[col0(h, k)]; });
  W[G.lineApex] = W[col0(0, Kf)];
  for (const [x, h, k] of G.teeth) W[x] = mixW(W[col0(h, k)], W[col0(h, k + 1)], 0.5);
  return W.map((w) => w ?? [[head, 1]]);
}
const mixW = (A, Bw, t) => { const o = new Map(); for (const [b, w] of A) o.set(b, (o.get(b) ?? 0) + w * (1 - t)); for (const [b, w] of Bw) o.set(b, (o.get(b) ?? 0) + w * t); const l = [...o].filter(([, w]) => w > 1e-6).sort((x, y) => y[1] - x[1]).slice(0, 4), s = l.reduce((a, [, w]) => a + w, 0); return l.map(([b, w]) => [b, w / s]); };

/* ---- the game's copy ------------------------------------------------------------------------------------------------ */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync } = await import('node:fs');
  const { buildRig } = await import('../lowrig.mjs');
  const { garmentAsset } = await import('../lowgarment.mjs');
  const { buildShawl, shawlWeights } = await import('./shawl.mjs');
  for (const who of ['male', 'female']) {
    const rig = buildRig(who), S = buildShawl(rig);
    S.vw = shawlWeights(rig, S);
    const G = buildHood(rig, S);
    G.vw = hoodWeights(rig, G, S);
    const file = new URL(`../../../src/sculpt/assets/lowhood-${who}.json`, import.meta.url);
    const A = { built: 'node tools/sculpt/garments/hood.mjs (tools/sculpt/lowgarment.mjs garmentAsset)', ...garmentAsset(rig, G, MATS) };
    writeFileSync(file, JSON.stringify(A));
    console.log(who, `${G.verts.length} vertices, ${G.tris.length} triangles, ${A.base} + ${A.bones.length} bones: wrote`, file.pathname);
  }
}
