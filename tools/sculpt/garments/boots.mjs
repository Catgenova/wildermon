// The boots of the first outfit (tools/sculpt/ref/outfit1-boots.png, worn in tools/sculpt/ref/outfit1-lineup.png): a
// flat dark sole, a tan leather foot and shaft up to a structured cuff round the ankle, two cream straps crossing over
// the shaft (an X in front and behind) and a cream band over the forefoot behind a rounded closed toe; hers slimmer and
// lighter, her cuff fitted (no ledge). Fitted to each low-poly body from the one design (DESIGN, per body),
// skinned to its rig's leg and foot bones (no bones of its own).
//
//   buildBoots(rig) → { verts, polys: [{ v, mat, part, tag }], tris, part, side, rings, design, hides, soles }
//   bootWeights(rig, G) → per vertex [[bone, weight], ...] (the body's bones only)
//
//   node tools/sculpt/garments/boots.mjs
//     writes the game's copy beside each body: src/sculpt/assets/lowboots-male.json and lowboots-female.json
//     (lowgarment.mjs garmentAsset, plus `hides`, the body's polygons the boots cover, and `soles`, the boots' sole
//     vertices the body stands on; loaded by src/sculpt/lowpoly.ts)
//
// The shape, per foot, in columns round it: K columns (DESIGN.cols: each a station along the foot, f from the heel's
// back 0 to the toe's front 1, a side s from -1 the inner edge to +1 the outer, and an angle round the ankle), each a
// polyline up from the ground, the rings joined round:
//   r0 the sole's underside (the outline), r1 (also r2) the sole's top edge, where the upper stands (the sole's edge
//   bevelled out by `lip` to the ground, its welt), r3 the wall's top (the foot's edge), r4 over the foot (the toe's top, the instep, the heel), r5 the
//   shaft's top under the cuff, r6 the cuff's foot (out from the shaft by `step`), r7 the cuff's top, r8 the rim's inside.
// r0..r2 are the outline (the body's foot outline grown by the margins); r3..r8 are each a ring round a centre (the
// foot's middle for r3 r4, the leg's axis for r5..r8) at its own height, each column's point the further of its design
// and the body's reach that way grown by the clearance `clear` (so the body is always inside). The sole's underside is
// closed; the rim's inside edge is the one open edge (round the leg). Materials: leather (the shaft and the cuff), tan (the
// foot), strap, sole.
//
// Heights: the body stands on the boots' soles (the game stands a body on its lowest sole: with the boots on, theirs),
// so the ground is the body's floor less the sole and `gap`; the cuff's foot at `cuff[0]` and its top at `cuff[1]` head
// heights above the ground (the head: the chin's underside to the crown, `H`).
//
// Room for the trousers (made elsewhere at the same time): the boot keeps to the leg below the cuff's top, and the cuff's
// outside is at most `clear + step` off the leg; a trouser cuff ending at or just above the cuff's top (rig.J.floor -
// sole - gap + cuff[1] H), or over it at a reach of `clear + step` + 0.03 or more off the leg, does not meet it.
import { meshOf, orient, trisOf, transferWeights, samplesOf, closestOnTri, crossPairs, sub, add, mul, dot, cross, unit, lerp } from '../lowgarment.mjs';

export const MATS = {
  // the cuff and the shaft: tan-brown leather; the foot (toe and heel): a lighter tan; the straps: cream; the sole: dark brown
  leather: [0.66, 0.42, 0.28],
  tan: [0.77, 0.51, 0.35],
  strap: [0.88, 0.79, 0.7],
  sole: [0.46, 0.29, 0.2],
};

/**
 * The design per body (heights above the body's floor unless said; lengths in the body's units):
 *   H: the head's height; sole: the sole's thickness; gap: between the body's sole and the boot's;
 *   margin: the outline past the body's foot at the toe and the heel;
 *   lip: the welt, how far the upper stands in from the sole's edge; clear: the upper off the body; step: the cuff out
 *   from the shaft; cuff: its foot and top, head heights above the ground; wall, top: r3's and r4's heights per column;
 *   cols: the columns, [f, v (off the foot's middle line, + out), angle round the ankle (degrees, 0 forward, +90 out)];
 *   fill: the shaft and the cuff further out per column (the heel's
 *   back kept straight up to the cuff); collar: r4 and the wall clear the body from r4's height to this above it (the
 *   ankle's foot); cone: the half-angle round each column the body's reach is taken over (degrees).
 */
export const DESIGN = {
  male: {
    H: 2.06, sole: 0.1, gap: 0.012, margin: { toe: 0.04, heel: 0.02 }, lip: 0.05, shaft: 0.1, step: 0.04, flare: 0.05,
    cuff: [0.725, 0.905], rim: 0.035, rigid: { r5: 0.7, r6: 1, r6b: 1, r7: 1, r8: 1 },
    cols: [[1, 0.2, 18], [0.66, 0.5, 62], [0.33, 0.44, 102], [0.07, 0.36, 142], [0, 0.16, 168], [0, -0.16, -168], [0.07, -0.36, -142], [0.33, -0.4, -102], [0.66, -0.48, -62], [1, -0.2, -18]],
    wall: [0.16, 0.18, 0.18, 0.2, 0.2, 0.2, 0.2, 0.18, 0.18, 0.16],
    lean: [0.03, 0.03, 0.03, 0.02, 0.02, 0.02, 0.02, 0.03, 0.03, 0.03],
    top: [0.32, 0.4, 0.56, 0.62, 0.62, 0.62, 0.62, 0.56, 0.4, 0.32],
    shrink: [0.22, 0.08, 0.04, 0.02, 0.02, 0.02, 0.02, 0.04, 0.08, 0.22],
    mix: [0, 0.15, 0.55, 0.95, 1, 1, 0.95, 0.55, 0.15, 0],
    base: [0.66, 0.7, 0.8, 0.86, 0.86, 0.86, 0.86, 0.8, 0.7, 0.66],
    fill: [0.02, 0, 0, 0.02, 0.03, 0.03, 0.02, 0, 0, 0.02],
    straps: { x: [[90, 0.045], [-90, 0.08]], give: 0.05, c: 0.53, amp: 0.14, w: 0.11, band: { w: 0.16, lift: 0.035, foot: 0.02 } },
  },
  female: {
    H: 2.07, sole: 0.09, gap: 0.012, margin: { toe: -0.1, heel: 0 }, lip: 0.045, shaft: 0.08, step: 0, flare: 0.05,
    cuff: [0.71, 0.89], rim: 0.035, rigid: { r5: 0.7, r6: 1, r6b: 1, r7: 1, r8: 1 },
    cols: [[1, 0.2, 18], [0.66, 0.44, 62], [0.33, 0.36, 102], [0.07, 0.31, 142], [0, 0.14, 168], [0, -0.14, -168], [0.07, -0.31, -142], [0.33, -0.33, -102], [0.66, -0.42, -62], [1, -0.2, -18]],
    wall: [0.14, 0.15, 0.15, 0.16, 0.16, 0.16, 0.16, 0.15, 0.15, 0.14],
    lean: [0.02, 0.02, 0.03, 0.02, 0.02, 0.02, 0.02, 0.03, 0.02, 0.02],
    top: [0.28, 0.34, 0.52, 0.6, 0.6, 0.6, 0.6, 0.52, 0.34, 0.28],
    shrink: [0.2, 0.06, 0.04, 0.02, 0.02, 0.02, 0.02, 0.04, 0.06, 0.2],
    mix: [0, 0.1, 0.5, 0.95, 1, 1, 0.95, 0.5, 0.1, 0],
    base: [0.55, 0.6, 0.72, 0.8, 0.8, 0.8, 0.8, 0.72, 0.6, 0.55],
    fill: [0.02, 0, 0, 0.02, 0.03, 0.03, 0.02, 0, 0, 0.02],
    straps: { x: [[90, 0.045], [-90, 0.08]], give: 0.05, c: 0.48, amp: 0.17, w: 0.1, band: { w: 0.12, lift: 0.035, foot: 0.02 } },
  },
};


/** A foot's frame: the heel's back middle (the origin, on the floor), a (along the foot, heel to toe, level), b (across, outward), and its outline. */
export function footOf(B, side) {
  const P = (n) => B.verts[B.index.get(`${n}.${side}`)];
  const heel = lerp(P('ft3'), P('ft4'), 0.5), toe = lerp(P('ft0'), P('ft1'), 0.5);
  const a = unit([toe[0] - heel[0], 0, toe[2] - heel[2]]), sg = side === 'L' ? 1 : -1;
  let b = [a[2], 0, -a[0]];
  if (b[0] * sg < 0) b = mul(b, -1);
  const uv = (p) => [dot(sub(p, heel), a), dot(sub(p, heel), b)];
  const hex = ['ft0', 'ft1', 'ft2', 'ft3', 'ft4', 'ft5'].map((n) => uv(P(n)));
  const L = Math.max(...hex.map((p) => p[0])), u0 = Math.min(...hex.map((p) => p[0]));
  // the outline's v range at u (the hexagon cut across)
  const span = (u) => {
    u = Math.max(u0 + 1e-3, Math.min(L - 1e-3, u));
    const vs = [];
    for (let k = 0; k < 6; k++) { const p = hex[k], q = hex[(k + 1) % 6]; if ((p[0] - u) * (q[0] - u) <= 0 && p[0] !== q[0]) vs.push(p[1] + (q[1] - p[1]) * (u - p[0]) / (q[0] - p[0])); }
    return [Math.min(...vs), Math.max(...vs)];
  };
  const at = (u, v, y) => [heel[0] + a[0] * u + b[0] * v, y, heel[2] + a[2] * u + b[2] * v];
  return { side, sg, heel, a, b, uv, span, L, u0, at };
}

/** The leg's axis at height y (the middles of the rings fc, an, cb). */
function axisOf(B, side) {
  const ring = (r, n) => { const ps = Array.from({ length: n }, (_, k) => B.verts[B.index.get(`${r}${k}.${side}`)]); return mul(ps.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / n); };
  const pts = [ring('fc', 6), ring('an', 6), ring('cb', 8)].sort((p, q) => p[1] - q[1]);
  return (y) => {
    if (y <= pts[0][1]) return pts[0];
    for (let i = 0; i + 1 < pts.length; i++) if (y <= pts[i + 1][1]) { const t = (y - pts[i][1]) / (pts[i + 1][1] - pts[i][1]); return lerp(pts[i], pts[i + 1], t); }
    return pts[pts.length - 1];
  };
}

/** The body's reach from centre c (xz) along unit d (xz) at height y: the furthest sample within `half` degrees and dy. */
function reachOf(S, c, d, y, half = 16, dy = 0.06) {
  const k = 1 / Math.cos(half * Math.PI / 180), ch = Math.cos(half * Math.PI / 180);
  let r = 0;
  for (const p of S) {
    if (Math.abs(p[1] - y) > dy) continue;
    const w = [p[0] - c[0], p[2] - c[2]], l = Math.hypot(w[0], w[1]);
    if (l < 1e-9) continue;
    const cs = (w[0] * d[0] + w[1] * d[2]) / l;
    if (cs < ch) continue;
    r = Math.max(r, l * cs * k);
  }
  return r;
}

/** Two polylines joined by triangles (a zipper), each from the same end: the shorter diagonal first. */
function zipper(G, A, Bq, mat) {
  let i = 0, j = 0;
  const d = (a, b) => Math.hypot(...sub(G.verts[a], G.verts[b]));
  while (i + 1 < A.length || j + 1 < Bq.length) {
    if (j + 1 >= Bq.length || (i + 1 < A.length && d(A[i + 1], Bq[j]) <= d(A[i], Bq[j + 1]))) { G.poly([A[i], A[i + 1], Bq[j]], mat, 'boot'); i++; }
    else { G.poly([A[i], Bq[j + 1], Bq[j]], mat, 'boot'); j++; }
  }
}

/** The closest point on the boot's upper (`tags`) of one side to p: the point, the outward normal there, the host triangle's corners and their shares. */
function onUpper(G, side, p, tags) {
  let best = null;
  for (const t of G.tris) {
    const poly = G.polys[t.poly];
    if (!tags.includes(poly.tag) || G.side[t.v[0]] !== side) continue;
    const [a, b, c] = t.v.map((i) => G.verts[i]);
    const [q, w] = closestOnTri(p, a, b, c), d = Math.hypot(...sub(p, q));
    if (!best || d < best.d) best = { d, q, w, v: t.v, n: unit(cross(sub(b, a), sub(c, a))) };
  }
  return best;
}

/**
 * The straps (DESIGN.straps), cream, laid on the upper of one side a little off it (`lift`, the later over the
 * earlier), each a strip of quads: the two crossing the shaft (`x`: round it at height c + amp cos(angle - peak) head
 * heights over the ground, angle round the ankle as the columns', peaks at the back's outer and inner corners, so they
 * cross in front, low, and behind, high), and the forefoot band (`band`: over the foot's top along r4 from the ball's
 * column on one side to the other's, down both to the welt). Each strap vertex rides on the upper's triangle under it
 * (G.host: its corners and shares).
 */
function strapsOf(G, D, side) {
  const R = G.rings[side], ft = G.foot[side], cols = D.cols, K = cols.length, S = D.straps;
  const tags = ['wall', 'over', 'shoulder', 'shaft'];
  const put = (p, lift) => {
    const h = onUpper(G, side, p, tags), i = G.vert(add(h.q, mul(h.n, lift)), 'strap');
    G.side[i] = side; G.host[i] = h.v.map((v, k) => [v, h.w[k]]); G.nrm[i] = h.n;
    return { i, n: h.n };
  };
  // a strip along a centreline (points), each point's two edges `across` it by ±w/2
  const strip = (C, across, w, lift, tag, closed, edges = null) => {
    // (rows across it: its two edges, or with `edges` the given points across, its middle among them so it bends over a
    // corner of the upper)
    const E = C.map((c, k) => (edges ? edges[k] : [add(c, mul(across[k], -w / 2)), add(c, mul(across[k], w / 2))]).map((p) => put(p, lift)));
    G.tag = tag;
    const m = closed ? E.length : E.length - 1;
    // (each edge between two of its points kept `lift` off the upper too: where its middle dips under, both ends go out)
    const x0 = (x) => x.out ?? lift; // (how far each point is off the upper: at most 1.5 times its lift)
    for (let it = 0; it < 4; it++) {
      let moved = false;
      for (let k = 0; k < m; k++) for (let e = 0; e < E[k].length; e++) {
        const a = E[k][e], b = E[(k + 1) % E.length][e], mid = lerp(G.verts[a.i], G.verts[b.i], 0.5), h = onUpper(G, side, mid, tags);
        const sd = dot(sub(mid, h.q), h.n);
        if (sd < lift * 0.8) { const d = Math.min(lift - sd, 1.5 * lift - (x0(a) + x0(b)) / 2); if (d <= 1e-4) continue; for (const x of [a, b]) { G.verts[x.i] = add(G.verts[x.i], mul(x.n, d)); x.out = (x.out ?? lift) + d; } moved = true; }
      }
      if (!moved) break;
    }
    for (let k = 0; k < m; k++) for (let e = 0; e + 1 < E[k].length; e++) {
      const j = (k + 1) % E.length, q = [E[k][e].i, E[j][e].i, E[j][e + 1].i, E[k][e + 1].i];
      // (wound so its normal leaves the upper)
      const nn = cross(sub(G.verts[q[1]], G.verts[q[0]]), sub(G.verts[q[3]], G.verts[q[0]]));
      G.poly(dot(nn, add(E[k][e].n, E[j][e].n)) >= 0 ? q : [...q].reverse(), 'strap', 'boot', true);
    }
  };
  // a column's polyline up the upper (r3, r4, r5, r6): the point at arc length s along it, and the arc length where it
  // reaches height y
  const colOf = (k) => [...new Set(['r3', 'r4', 'r5', 'r6'].map((r) => R[r][k]))].map((i) => G.verts[i]);
  const atS = (k, s) => { const P = colOf(k); for (let j = 0; j + 1 < P.length; j++) { const l = Math.hypot(...sub(P[j + 1], P[j])); if (s <= l || j + 2 === P.length) return lerp(P[j], P[j + 1], Math.max(0, Math.min(1, s / l))); s -= l; } };
  const sOfY = (k, y) => { const P = colOf(k); let acc = 0; for (let j = 0; j + 1 < P.length; j++) { const l = Math.hypot(...sub(P[j + 1], P[j])); if (y <= P[j + 1][1] || j + 2 === P.length) return acc + l * Math.max(0, Math.min(1, (y - P[j][1]) / (P[j + 1][1] - P[j][1]))); acc += l; } };
  S.x.forEach(([peak, lift], n) => {
    const w = S.w * D.H, sc = cols.map(([, , g], k) => sOfY(k, G.ground + (S.c + S.amp * Math.cos((g - peak) * Math.PI / 180)) * D.H));
    const C = sc.map((s0, k) => atS(k, s0)), across = sc.map((s0, k) => unit(sub(atS(k, s0 + w / 2), atS(k, s0 - w / 2))));
    // (the edges along the column, by arc length)
    strip(C, across, w, lift, `strap ${n + 1}`, true, sc.map((s0, k) => (S.mid ? [atS(k, s0 - w / 2), atS(k, s0), atS(k, s0 + w / 2)] : [atS(k, s0 - w / 2), atS(k, s0 + w / 2)])));
  });
  // the forefoot band: on the toes' line, its front edge along r4 over the front columns and down the ball's columns to
  // the welt (r3, r2), its back edge `w` behind: up each front column from r4, and along the wall and the over-band toward
  // the waist's columns
  const front = cols.map((c, k) => k).filter((k) => cols[k][0] >= 0.6);
  const inner = front.filter((k) => cols[k][1] < 0).sort((a, b) => cols[a][0] - cols[b][0]), outer = front.filter((k) => cols[k][1] > 0).sort((a, b) => cols[b][0] - cols[a][0]);
  const [ki, ko] = [inner[0], outer[outer.length - 1]], wb = S.band.w * D.H;
  const nextTo = (k) => cols.findIndex((c, j) => j !== k && Math.sign(c[1]) === Math.sign(cols[k][1]) && c[0] < 0.6 && c[0] > 0.2);
  const toward = (k, r) => { const a = G.verts[R[r][k]], b = G.verts[R[r][nextTo(k)]]; return lerp(a, b, Math.min(0.9, wb / Math.hypot(...sub(b, a)))); };
  const lift = (p) => add(p, [0, S.band.foot, 0]);
  const top = [...inner, ...outer], s4 = (k) => sOfY(k, G.verts[R.r4[k]][1]) + 1e-6;
  const lo = [lift(G.verts[R.r2[ki]]), G.verts[R.r3[ki]], ...top.map((k) => G.verts[R.r4[k]]), G.verts[R.r3[ko]], lift(G.verts[R.r2[ko]])];
  const hi = [lift(toward(ki, 'r2')), toward(ki, 'r3'), ...top.map((k) => atS(k, s4(k) + wb)), toward(ko, 'r3'), lift(toward(ko, 'r2'))];
  strip(lo, null, 0, S.band.lift, 'band', false, lo.map((p, j) => [p, hi[j]]));
}

export function buildBoots(rig, design = DESIGN[rig.who]) {
  const { B } = rig, D = design, F = rig.J.floor;
  const ground = F - D.gap - D.sole, top = F - D.gap;
  const yCuff = D.cuff.map((h) => ground + h * D.H);
  const G = meshOf();
  G.side = []; G.rings = {}; G.hides = []; G.soles = [];
  const K = D.cols.length;
  const hidden = (p) => p.v.every((i) => /^(fc|ft|so|fb|an)\d\.[LR]$/.test(B.names[i]));
  for (const side of ['L', 'R']) {
    const ft = footOf(B, side), axis = axisOf(B, side);
    // the body left showing on this side below the knee: the block foot and the ankle's band up to the ankle's ring (an)
    // are hidden under the boot, so the foot is the boot's own design; the shaft clears the leg from the ankle's ring up
    const keep = B.polys.filter((p) => !hidden(p) && p.v.every((i) => B.verts[i][1] < F + 3.2 && Math.sign(B.verts[i][0]) === ft.sg));
    const S = samplesOf({ tris: keep.flatMap((p) => { const o = []; for (let k = 1; k + 1 < p.v.length; k++) o.push({ v: [p.v[0], p.v[k], p.v[k + 1]] }); return o; }) }, B.verts, 0.04)
      .filter((p) => p[1] < F + 3.2 && Math.sign(p[0]) === ft.sg);
    // the outline: each column's station along the foot (the body's heel to its toe, grown by the margins), v off the
    // foot's middle line (from the heel's middle to the toe's)
    const uB = ft.u0 - D.margin.heel, uT = ft.L + D.margin.toe;
    const mH = ft.span(ft.u0).reduce((a, b) => (a + b) / 2), mT = ft.span(ft.L).reduce((a, b) => (a + b) / 2);
    const outline = D.cols.map(([f, v]) => { const u = uB + f * (uT - uB), t = (u - ft.u0) / (ft.L - ft.u0); return [u, mH + (mT - mH) * t + v]; });
    const cU = (uB + uT) * 0.45, cV = outline.reduce((s0, p) => s0 + p[1], 0) / K;
    const centre = ft.at(cU, cV, 0);
    const R = {};
    const put = (key, pts) => { R[key] = pts.map((p) => { const i = G.vert(p, 'boot'); G.side[i] = side; return i; }); };
    // (a column's outline point at height y, `inset` in toward the foot's middle)
    const onOutline = (k, y, inset = 0) => { const p = ft.at(outline[k][0], outline[k][1], y), d = unit([p[0] - centre[0], 0, p[2] - centre[2]]); return [p[0] - d[0] * inset, y, p[2] - d[2] * inset]; };
    // the shaft: a straight tube round the leg's axis, each column at its angle round the ankle, out by `shaft` (and the
    // column's `fill`) from the leg's reach between the ankle's ring and the cuff's top
    const ang = D.cols.map(([, , g]) => { const t = g * Math.PI / 180; return unit(add(mul(ft.a, Math.cos(t)), mul(ft.b, Math.sin(t)))); });
    const yAn = B.verts[B.index.get(`an0.${side}`)][1];
    const shaftR = ang.map((d) => { let r = 0; for (const p of S) { if (p[1] < yAn - 0.05 || p[1] > yCuff[1] + 0.05) continue; const c = axis(p[1]), w = [p[0] - c[0], p[2] - c[2]], l = Math.hypot(w[0], w[1]); if (l < 1e-9) continue; const cs = (w[0] * d[0] + w[1] * d[2]) / l; if (cs < Math.cos(24 * Math.PI / 180)) continue; r = Math.max(r, l * cs / Math.cos(24 * Math.PI / 180)); } return r; });
    const onShaft = (k, y, extra = 0) => { const c = axis(y), r = shaftR[k] + D.shaft + (D.fill?.[k] ?? 0) + extra; return [c[0] + ang[k][0] * r, y, c[2] + ang[k][2] * r]; };
    put('r0', D.cols.map((_, k) => onOutline(k, ground, -D.lip)));
    put('r1', D.cols.map((_, k) => onOutline(k, top, -D.lip)));
    put('r2', D.cols.map((_, k) => onOutline(k, top)));
    if (D.wall) put('r3', D.wall.map((h, k) => onOutline(k, F + h, D.lean[k]))); else R.r3 = R.r2;
    // r4 over the foot: the toe's top and the forefoot `shrink` in from the outline, the heel's on the shaft (`mix` of the
    // way from the outline to it)
    put('r4', D.top.map((h, k) => lerp(onOutline(k, F + h, D.shrink[k]), onShaft(k, F + h), D.mix[k])));
    if (D.base) put('r5', D.base.map((h, k) => onShaft(k, F + h)));
    put('r6', D.cols.map((_, k) => onShaft(k, yCuff[0])));
    if (!D.base) R.r5 = R.r6;
    if (D.step) put('r6b', D.cols.map((_, k) => onShaft(k, yCuff[0] + 0.01, D.step)));
    put('r7', D.cols.map((_, k) => onShaft(k, yCuff[1], D.step + D.flare)));
    put('r8', D.cols.map((_, k) => { const c = axis(yCuff[1]), r = shaftR[k] + D.rim; return [c[0] + ang[k][0] * r, yCuff[1], c[2] + ang[k][2] * r]; }));
    G.rings[side] = R;
    // the polygons
    const band = (A, Bq, mat, tag, matOf = null, skip = null) => { G.tag = tag; for (let k = 0; k < K; k++) { if (skip?.(k)) continue; const j = (k + 1) % K; G.poly([A[k], A[j], Bq[j], Bq[k]], matOf?.(k) ?? mat, 'boot'); } };
    G.foot = G.foot ?? {}; G.foot[side] = ft;
    // the sole's underside: a fan round its middle (the outline is not convex at the waist)
    const mid = mul(R.r0.reduce((a, i) => add(a, G.verts[i]), [0, 0, 0]), 1 / K), cI = G.vert(mid, 'boot');
    G.side[cI] = side; R.c0 = cI;
    G.tag = 'sole';
    for (let k = 0; k < K; k++) G.poly([R.r0[(k + 1) % K], R.r0[k], cI], 'sole', 'boot');
    band(R.r0, R.r1, 'sole', 'sole edge');
    band(R.r1, R.r2, 'sole', 'welt');
    if (D.wall) band(R.r2, R.r3, 'tan', 'wall');
    band(R.r3, R.r4, 'tan', 'over');
    band(R.r4, R.r5, 'leather', 'shoulder');
    if (D.base) band(R.r5, R.r6, 'leather', 'shaft');
    if (D.step) { band(R.r6, R.r6b, 'leather', 'ledge'); band(R.r6b, R.r7, 'leather', 'cuff'); } else band(R.r6, R.r7, 'leather', 'cuff');
    band(R.r7, R.r8, 'leather', 'rim');
    G.soles.push(...R.r0, cI);
  }
  // the body's polygons the boots cover: the block foot (fc, ft, so and the ball's loop fb) and the ankle's band up to
  // the ankle's ring (an), both sides
  B.polys.forEach((p, pi) => { if (hidden(p)) G.hides.push(pi); });
  orient(G, (c) => { const s = c[0] > 0 ? 'L' : 'R', R = G.rings[s], m = mul(R.r4.reduce((a, i) => add(a, G.verts[i]), [0, 0, 0]), 1 / K); return [c[0] - m[0], (c[1] - m[1]) * 0.3, c[2] - m[2]]; });
  G.tris = trisOf(G);
  G.host = []; G.nrm = []; G.ground = ground;
  for (const side of ['L', 'R']) strapsOf(G, D, side);
  G.tris = trisOf(G);
  // where a strap still meets what lies under it (the boot, an earlier strap: the second over the first over the band over
  // the boot), the upper one's corners there go out along their normals a little at a time
  const rank = (tag) => (tag === 'strap 2' ? 3 : tag === 'strap 1' ? 2 : tag === 'band' ? 1 : 0);
  for (let it = 0; it < 80; it++) {
    const pairs = crossPairs(G.verts, G.tris);
    if (!pairs.length) break;
    const move = new Set();
    for (const [i, j] of pairs) {
      const [a, b] = [G.tris[i], G.tris[j]], ra = rank(G.polys[a.poly].tag), rb = rank(G.polys[b.poly].tag);
      if (ra === rb && ra === 0) continue;
      for (const v of (ra >= rb ? a : b).v) move.add(v);
    }
    if (!move.size) break;
    const moved = G.moved ?? (G.moved = []);
    for (const v of move) if (G.nrm[v] && (moved[v] ?? 0) < D.straps.give) { G.verts[v] = add(G.verts[v], mul(G.nrm[v], 0.005)); moved[v] = (moved[v] ?? 0) + 0.005; }
  }
  G.design = D; G.ground = ground; G.yCuff = yCuff;
  return G;
}

/**
 * The boots' weights from the body: each vertex the weights at the closest point of the leg's skin below the knee (the
 * foot's block, the ankle, the calf), the bones taken onto the calf, the ankle, the foot, the toes and the ball of its
 * own side, smoothed along the boot's edges.
 */
export function bootWeights(rig, G, o = {}) {
  const { B } = rig, F = rig.J.floor;
  const near = B.verts.map((p) => p[1] < F + 2.2);
  const map = (n) => {
    const m = n.match(/^(calf|ankle|foot|toes|ball)_(l|r)$/);
    if (m) return n;
    const s = n.match(/_(l|r)$/)?.[1] ?? 'l';
    return `calf_${s}`;
  };
  const vw = transferWeights(rig, G, { map, smooth: o.smooth ?? 2, keep: (i) => near[i], only: (i) => !G.host?.[i] });
  // the shaft and the cuff (the shaft's base up: stiff leather) on the shin alone: it holds its shape above the ankle's
  // bend and rides with the leg; the bend is taken between the foot's top (r4) and the shaft's base
  const at = new Map(rig.bones.map((b, i) => [b.name, i]));
  for (const side of ['L', 'R']) {
    const R = G.rings[side], calf = at.get(`calf_${side === 'L' ? 'l' : 'r'}`);
    for (const [key, f] of Object.entries(o.rigid ?? G.design.rigid)) for (const i of R[key] ?? []) {
      const acc = new Map(vw[i].map(([b, w]) => [b, w * (1 - f)]));
      acc.set(calf, (acc.get(calf) ?? 0) + f);
      vw[i] = [...acc].filter(([, w]) => w > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
      const t = vw[i].reduce((a, [, w]) => a + w, 0); vw[i] = vw[i].map(([b, w]) => [b, w / t]);
    }
  }
  // the straps ride on the upper under them: their host triangle's corners' weights, by their shares
  G.host?.forEach((h, i) => {
    if (!h) return;
    const acc = new Map();
    for (const [v, s] of h) for (const [b, w] of vw[v]) acc.set(b, (acc.get(b) ?? 0) + w * s);
    const l = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4), t = l.reduce((a, [, w]) => a + w, 0);
    vw[i] = l.map(([b, w]) => [b, w / t]);
  });
  // the forefoot band on the foot alone (the weights of the band's line, r4, at the nearest column): it rides the
  // forefoot rigidly while the ankle bends behind it
  const bandV = new Set(G.polys.filter((p) => p.tag === 'band').flatMap((p) => p.v));
  for (const i of bandV) {
    const R = G.rings[G.side[i]];
    let best = null;
    for (const j of R.r4) { const d = Math.hypot(...sub(G.verts[i], G.verts[j])); if (!best || d < best[0]) best = [d, j]; }
    vw[i] = vw[best[1]];
  }
  return vw;
}

/* ---- the game's copy ------------------------------------------------------------------------------------------------ */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { writeFileSync } = await import('node:fs');
  const { buildRig } = await import('../lowrig.mjs');
  const { garmentAsset } = await import('../lowgarment.mjs');
  for (const who of ['male', 'female']) {
    const rig = buildRig(who), G = buildBoots(rig);
    G.vw = bootWeights(rig, G);
    const file = new URL(`../../../src/sculpt/assets/lowboots-${who}.json`, import.meta.url);
    const A = { built: 'node tools/sculpt/garments/boots.mjs (tools/sculpt/lowgarment.mjs garmentAsset)', ...garmentAsset(rig, G, MATS), hides: G.hides, soles: G.soles };
    writeFileSync(file, JSON.stringify(A));
    console.log(who, `${G.verts.length} vertices, ${G.tris.length} triangles, ${A.base} + ${A.bones.length} bones, hides ${G.hides.length} body polygons: wrote`, file.pathname);
  }
}
