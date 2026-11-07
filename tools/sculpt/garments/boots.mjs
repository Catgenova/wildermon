// The boots of the first outfit (tools/sculpt/ref/outfit1-boots.png, worn in tools/sculpt/ref/outfit1-lineup.png): a
// flat dark sole, a tan leather foot and shaft up to a structured cuff round the ankle, two cream straps crossing over
// the shaft (an X in front and behind) and a cream band over the forefoot. His closed, a rounded block toe; hers open,
// her toes bare in front of the forefoot band. Fitted to each low-poly body from the one design (DESIGN, per body),
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
//   r0 the sole's underside (the outline), r1 the sole's top edge, r2 the welt (the upper's foot, in from the sole's
//   edge by `lip`), r3 the wall's top (the foot's edge), r4 over the foot (the toe's top, the instep, the heel), r5 the
//   shaft's top under the cuff, r6 the cuff's foot (out from the shaft by `step`), r7 the cuff's top, r8 the rim's inside.
// r0..r2 are the outline (the body's foot outline grown by the margins); r3..r8 are each a ring round a centre (the
// foot's middle for r3 r4, the leg's axis for r5..r8) at its own height, each column's point the further of its design
// and the body's reach that way grown by the clearance `clear` (so the body is always inside). The sole's underside is
// closed; the rim's inside edge is the one open edge (round the leg). Materials: leather, strap, sole, skin (her toes:
// the body's own skin colour in the game).
//
// Heights: the body stands on the boots' soles (the game stands a body on its lowest sole: with the boots on, theirs),
// so the ground is the body's floor less the sole and `gap`; the cuff's foot at `cuff[0]` and its top at `cuff[1]` head
// heights above the ground (the head: the chin's underside to the crown, `H`).
//
// Room for the trousers (made elsewhere at the same time): the boot keeps to the leg below the cuff's top, and the cuff's
// outside is at most `clear + step` off the leg; a trouser cuff ending at or just above the cuff's top (rig.J.floor -
// sole - gap + cuff[1] H), or over it at a reach of `clear + step` + 0.03 or more off the leg, does not meet it.
import { meshOf, orient, trisOf, transferWeights, samplesOf, sub, add, mul, dot, unit, lerp } from '../lowgarment.mjs';

export const MATS = {
  leather: [0.6, 0.38, 0.24],
  strap: [0.74, 0.64, 0.57],
  sole: [0.40, 0.25, 0.19],
  // (her bare toes: the body's own skin in the game, src/sculpt/lowpoly.ts; this the skin the light was fitted to)
  skin: [0.68, 0.49, 0.41],
};

/**
 * The design per body (heights above the body's floor unless said; lengths in the body's units):
 *   H: the head's height; sole: the sole's thickness; gap: between the body's sole and the boot's;
 *   margin: the outline past the body's foot at the toe and the heel;
 *   lip: the welt, how far the upper stands in from the sole's edge; clear: the upper off the body; step: the cuff out
 *   from the shaft; cuff: its foot and top, head heights above the ground; wall, top: r3's and r4's heights per column;
 *   cols: the columns, [f, v (off the foot's middle line, + out), angle round the ankle (degrees, 0 forward, +90 out)]; open: her toes bare (the columns
 *   in front of the forefoot band, r2 to r4, in skin); fill: the shaft and the cuff further out per column (the heel's
 *   back kept straight up to the cuff); collar: r4 and the wall clear the body from r4's height to this above it (the
 *   ankle's foot); cone: the half-angle round each column the body's reach is taken over (degrees).
 */
export const DESIGN = {
  male: {
    H: 2.06, sole: 0.11, gap: 0.012, margin: { toe: 0.04, heel: 0.04 }, lip: 0.04, clear: 0.045, shaft: 0.09, step: 0.04, flare: 0.04,
    cuff: [0.62, 0.8], rim: 0.035, collar: 0.3, cone: 22,
    cols: [[1, 0.2, 18], [0.66, 0.5, 62], [0.33, 0.44, 102], [0.07, 0.36, 142], [0, 0.16, 168], [0, -0.16, -168], [0.07, -0.36, -142], [0.33, -0.4, -102], [0.66, -0.48, -62], [1, -0.2, -18]],
    wall: [0.3, 0.4, 0.46, 0.5, 0.52, 0.52, 0.5, 0.46, 0.4, 0.3],
    top: [0.5, 0.58, 0.66, 0.72, 0.74, 0.74, 0.72, 0.66, 0.58, 0.5],
    shrink: [0.32, 0.12, 0.1, 0.05, 0, 0, 0.05, 0.1, 0.12, 0.32],
    base: [0.82, 0.82, 0.84, 0.86, 0.86, 0.86, 0.86, 0.84, 0.82, 0.82],
    fill: [0.02, 0, 0, 0.02, 0.05, 0.05, 0.02, 0, 0, 0.02],
    open: false,
  },
  female: {
    H: 2.07, sole: 0.1, gap: 0.012, margin: { toe: 0.02, heel: 0.0 }, lip: 0.035, clear: 0.04, shaft: 0.08, step: 0.035, flare: 0.03,
    cuff: [0.6, 0.78], rim: 0.035, collar: 0.3, cone: 22,
    cols: [[1, 0.2, 18], [0.66, 0.44, 62], [0.33, 0.36, 102], [0.07, 0.31, 142], [0, 0.14, 168], [0, -0.14, -168], [0.07, -0.31, -142], [0.33, -0.33, -102], [0.66, -0.42, -62], [1, -0.2, -18]],
    wall: [0.22, 0.3, 0.42, 0.48, 0.5, 0.5, 0.48, 0.42, 0.3, 0.22],
    top: [0.36, 0.46, 0.64, 0.74, 0.82, 0.82, 0.74, 0.64, 0.46, 0.36],
    shrink: [0.22, 0.12, 0.1, 0.05, 0, 0, 0.05, 0.1, 0.12, 0.22],
    base: [0.95, 0.95, 0.97, 0.99, 0.99, 0.99, 0.99, 0.97, 0.95, 0.95],
    fill: [0.02, 0, 0, 0, 0.04, 0.04, 0, 0, 0, 0.02],
    open: true,
  },
};

const RINGS = ['r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8'];

/** A foot's frame: the heel's back middle (the origin, on the floor), a (along the foot, heel to toe, level), b (across, outward), and its outline. */
function footOf(B, side) {
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

export function buildBoots(rig, design = DESIGN[rig.who]) {
  const { B } = rig, D = design, F = rig.J.floor;
  const ground = F - D.gap - D.sole, top = F - D.gap;
  const yCuff = D.cuff.map((h) => ground + h * D.H);
  const G = meshOf();
  G.side = []; G.rings = {}; G.hides = []; G.soles = [];
  const K = D.cols.length;
  for (const side of ['L', 'R']) {
    const ft = footOf(B, side), axis = axisOf(B, side);
    // the body's surface below the calf on this side
    // (the polygons the boots leave showing: the block foot below its collar is hidden under them, so the boot's foot is
    // its own design, the body's reach only above the collar)
    const foot = (p) => p.v.every((i) => /^(fc|ft|so|fb)\d\.[LR]$/.test(B.names[i]));
    const keep = B.polys.filter((p) => !foot(p) && p.v.every((i) => B.verts[i][1] < F + 3.2 && Math.sign(B.verts[i][0]) === ft.sg));
    const S = samplesOf({ tris: keep.flatMap((p) => { const o = []; for (let k = 1; k + 1 < p.v.length; k++) o.push({ v: [p.v[0], p.v[k], p.v[k + 1]] }); return o; }) }, B.verts, 0.04)
      .filter((p) => p[1] < F + 3.2 && Math.sign(p[0]) === ft.sg);
    // the outline: each column's station on the body's outline grown by the margins
    const uB = ft.u0 - D.margin.heel, uT = ft.L + D.margin.toe;
    // (each column's v off the foot's middle line, which runs from the heel's middle to the toe's)
    const mH = ft.span(ft.u0).reduce((a, b) => (a + b) / 2), mT = ft.span(ft.L).reduce((a, b) => (a + b) / 2);
    const outline = D.cols.map(([f, v]) => { const u = uB + f * (uT - uB), t = (u - ft.u0) / (ft.L - ft.u0); return [u, mH + (mT - mH) * t + v]; });
    const cU = (uB + uT) * 0.45, cV = outline.reduce((s, p) => s + p[1], 0) / K;
    const centre = ft.at(cU, cV, 0);
    const toward = (k) => { const p = ft.at(outline[k][0], outline[k][1], 0); return unit([p[0] - centre[0], 0, p[2] - centre[2]]); };
    const R = {};
    const put = (key, pts) => { R[key] = pts.map((p) => { const i = G.vert(p, 'boot'); G.side[i] = side; return i; }); };
    // the wall: straight up from the welt, out by `clear` from the body's reach over r4's heights (the ankle's foot, the
    // collar, is the lowest of the body left showing), the outline grown to keep the welt round it
    const ring = (y, c, dirs, design, clear = D.clear) => dirs.map((d, k) => { const r = Math.max(design?.[k] ?? 0, reachOf(S, c, d, y[k], 8) + clear); return [c[0] + d[0] * r, y[k], c[2] + d[2] * r]; });
    const dirs = D.cols.map((_, k) => toward(k));
    const rw = outline.map(([u, v], k) => { const p = ft.at(u, v, 0), d = dirs[k]; return Math.max(Math.hypot(p[0] - centre[0], p[2] - centre[2]) - D.lip, reachOf(S, centre, d, F + D.top[k] + D.collar / 2, D.cone, D.collar / 2) + D.clear); });
    const round = (r, y) => dirs.map((d, k) => [centre[0] + d[0] * r[k], y, centre[2] + d[2] * r[k]]);
    put('r0', round(rw.map((r) => r + D.lip), ground));
    put('r1', round(rw.map((r) => r + D.lip - 0.012), top));
    put('r2', round(rw, top));
    put('r3', D.wall.map((h, k) => [centre[0] + dirs[k][0] * rw[k], F + h, centre[2] + dirs[k][2] * rw[k]]));
    // (r4 clear of the body from its height to `collar` above it: the band up to the shaft passes the ankle's foot)
    put('r4', dirs.map((d, k) => { const y = F + D.top[k], r = Math.max(rw[k] - D.shrink[k], reachOf(S, centre, d, y + D.collar / 2, D.cone, D.collar / 2) + D.clear); return [centre[0] + d[0] * r, y, centre[2] + d[2] * r]; }));
    // r5..r8 round the leg's axis, the columns at their angles round the ankle
    const ang = D.cols.map(([, , g]) => { const t = g * Math.PI / 180; return unit(add(mul(ft.a, Math.cos(t)), mul(ft.b, Math.sin(t)))); });
    const legRing = (ys, extra, more = D.fill) => ang.map((d, k) => { const y = ys[k], c = axis(y), r = reachOf(S, c, d, y, 20, 0.08) + extra + (more?.[k] ?? 0); return [c[0] + d[0] * r, y, c[2] + d[2] * r]; });
    const at = (y) => D.cols.map(() => y);
    put('r5', legRing(D.base.map((h) => F + h), D.shaft));
    put('r6', legRing(at(yCuff[0]), D.shaft));
    put('r6b', legRing(at(yCuff[0] + 0.01), D.shaft + D.step));
    put('r7', legRing(at(yCuff[1]), D.shaft + D.step + D.flare));
    put('r8', legRing(at(yCuff[1]), D.rim, null));
    G.rings[side] = R;
    // the polygons
    const band = (A, Bq, mat, tag, matOf = null) => { G.tag = tag; for (let k = 0; k < K; k++) { const j = (k + 1) % K; G.poly([A[k], A[j], Bq[j], Bq[k]], matOf?.(k) ?? mat, 'boot'); } };
    // the sole's underside: a fan round its middle (the outline is not convex at the waist)
    const mid = mul(R.r0.reduce((a, i) => add(a, G.verts[i]), [0, 0, 0]), 1 / K), cI = G.vert(mid, 'boot');
    G.side[cI] = side; R.c0 = cI;
    G.tag = 'sole';
    for (let k = 0; k < K; k++) G.poly([R.r0[(k + 1) % K], R.r0[k], cI], 'sole', 'boot');
    band(R.r0, R.r1, 'sole', 'sole edge');
    band(R.r1, R.r2, 'sole', 'welt');
    // her toes: the columns in front of the forefoot band (front's and ball's columns between them)
    const toes = (k) => (D.open && D.cols[k][0] >= 0.6 && D.cols[(k + 1) % K][0] >= 0.6 ? 'skin' : null);
    band(R.r2, R.r3, 'leather', 'wall', toes);
    band(R.r3, R.r4, 'leather', 'over', toes);
    band(R.r4, R.r5, 'leather', 'shoulder');
    band(R.r5, R.r6, 'leather', 'shaft');
    band(R.r6, R.r6b, 'leather', 'ledge');
    band(R.r6b, R.r7, 'leather', 'cuff');
    band(R.r7, R.r8, 'leather', 'rim');
    G.soles.push(...R.r0, cI);
  }
  // the body's polygons the boots cover: the block foot below its collar (fc, ft, so and the ball's loop fb), both sides
  B.polys.forEach((p, pi) => { if (p.v.every((i) => /^(fc|ft|so|fb)\d\.[LR]$/.test(B.names[i]))) G.hides.push(pi); });
  orient(G, (c) => { const s = c[0] > 0 ? 'L' : 'R', R = G.rings[s], m = mul(R.r4.reduce((a, i) => add(a, G.verts[i]), [0, 0, 0]), 1 / K); return [c[0] - m[0], (c[1] - m[1]) * 0.3, c[2] - m[2]]; });
  G.tris = trisOf(G);
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
  return transferWeights(rig, G, { map, smooth: o.smooth ?? 2, keep: (i) => near[i] });
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
