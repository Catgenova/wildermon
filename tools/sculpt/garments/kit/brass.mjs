// The brass set's own builders (tools/sculpt/garments/brass.mjs), on the plate kit (../platekit.mjs):
//
//   * the head's dome (`headDome`): the skull's field round the head's middle, the brow's polar angle, and any shape
//     the piece wants it at least as large as (`also`: the diving bell's sphere).
//   * the torso's field and marks (`torsoField`, `torsoMarks`), as the other sets' kits.
//   * a gear (`gear`): a toothed rim, spokes with the openings between them cut through, a hub boss (a glow or brass).
//   * a port (`port`): a raised bezel with a polished lip and bolt heads round it, a domed glass sunk in it with its
//     glint (the helm's eyes, the gear window, the boiler's core).
//   * a gauge (`gauge`): a dial in a polished bezel, ticks, a needle on a boss.
//   * a pipe (`pipe`): a smooth tube through points with couplings at its ends and along it.
import { add, sub, mul, dot, cross, unit, lerp, clamp, merge } from '../metalkit.mjs';
import { skinSamples, domeWrap, ellipsoidReach, patch, solid, sweep, stud, tube, shareW, torsoMiddle, torsoWrap } from '../platekit.mjs';

export const PI = Math.PI, TAU = PI * 2;

/** How much of weights `w` are on the head and the jaw themselves. */
export const headW = (B, w) => w.reduce((t, [b, x]) => t + (B.bones[b].name === 'head' || B.bones[b].name === 'jaw' ? x : 0), 0);

/** A frame on point `c` facing `n`, its x along `x0` made square to n: { o, x, y, n }. */
export function frameAt(c, n, x0 = [0, 1, 0]) {
  const nn = unit(n), xx = Math.abs(dot(unit(x0), nn)) > 0.95 ? [1, 0, 0] : x0;
  const x = unit(sub(xx, mul(nn, dot(xx, nn)))), y = cross(nn, x);
  return { o: c, x, y, n: nn };
}
/** A point in frame F: u along x, v along y, h along n. */
export const inFrame = (F, u, v, h = 0) => add(F.o, add(add(mul(F.x, u), mul(F.y, v)), mul(F.n, h)));

/**
 * The head's dome: a field round a centre in the head (`D`, read `D.ta(theta / PI, azimuth)`: azimuth nought the face,
 * pi/2 the head's left), as far out as the skin reaches and `fit` more, never inside the ellipsoid `E` round it nor
 * the shape `also(d)` reaches along direction d; with the centre `c`, the brow's polar angle `browTh`, the head's reaches.
 */
export function headDome(B, o = {}) {
  const A = B.at, pick = (q) => headW(B, q.w) > 0.45, hs = skinSamples(B).filter(pick);
  const top = Math.max(...hs.map((q) => q.p[1])), bot = Math.min(...hs.map((q) => q.p[1]));
  const zf = Math.max(...hs.map((q) => q.p[2])), zb = Math.min(...hs.map((q) => q.p[2])), xw = Math.max(...hs.map((q) => q.p[0]));
  const c = [0, bot + 0.56 * (top - bot), (zf + zb) / 2];
  const fit = o.fit ?? (B.who === 'female' ? 0.11 : 0.16);
  const E = [xw + fit, top - c[1] + fit, (zf - zb) / 2 + fit];
  const also = o.also ? o.also({ c, E, top, bot, zf, zb, xw, fit }) : () => 0;
  const D = domeWrap(B, { c, u: [0, 1, 0], f: [0, 0, 1], s: [1, 0, 0], pick, rows: o.rows ?? 36, cols: o.cols ?? 48, thMax: PI, cone: 0.3, smooth: 4, shape: (r, th, ph, d) => Math.max(r + fit - 0.02, ellipsoidReach(E, d), also(d, th, ph)) });
  const thOf = (p) => Math.acos(clamp(unit(sub(p, c))[1], -1, 1));
  const browTh = thOf([0, A.head[1] + 0.62 * (top - A.head[1]) / 1.6, zf]);
  return { D, c, E, fit, browTh, top, bot, zf, zb, xw, thOf };
}

/* ---- the torso ----------------------------------------------------------------------------------------------------- */
export const TORSO_BONES = new Set(['root', 'pelvis', 'spine_01', 'spine_02', 'spine_03']);
/** The heights the torso's pieces are cut to: the necklines before and behind, the armpit, the waist, the hip. */
export function torsoMarks(B) {
  const A = B.at, sh = A.shoulder.l[1];
  return {
    neckF: lerp(A.neck, A.chest, 0.47)[1], neckB: lerp(A.neck, A.chest, 0.36)[1],
    pit: sh - 0.92, waist: lerp(A.spine1, A.pelvis, 0.45)[1], hip: A.hip.l[1],
  };
}
const FIELDS = new WeakMap();
/** The torso's skin as a field round its middle line, from mid-thigh to over the neck (`F.ta(t, a)`, `F.tOfY`, `F.yOfT`, `F.zc`). */
export function torsoField(B) {
  if (FIELDS.has(B)) return FIELDS.get(B);
  const A = B.at;
  const pick = (s) => shareW(B, s.w, 'torso', 'thigh', 'neck', 'head') > 0.8 && headW(B, s.w) < 0.15 && shareW(B, s.w, 'upperarm', 'shoulder', 'forearm', 'hand') < 0.05 && s.p[1] > lerp(A.hip.l, A.knee.l, 0.55)[1];
  const zc = torsoMiddle(B, (s) => shareW(B, s.w, 'torso', 'neck', 'head') > 0.8 && headW(B, s.w) < 0.15);
  const y0 = lerp(A.hip.l, A.knee.l, 0.5)[1], y1 = A.neck[1] + 0.5;
  const G = torsoWrap(B, y0, y1, zc, { pick, nt: 100, na: 64, closed: true, a: [-PI, PI], smooth: 5, shape: (r) => r });
  G.tOfY = (yy) => (yy - y0) / (y1 - y0);
  G.yOfT = (tt) => y0 + (y1 - y0) * tt;
  G.zc = zc;
  FIELDS.set(B, G);
  return G;
}


/* ---- the clockwork ------------------------------------------------------------------------------------------------- */
/** A ring of `k` points round `c` in frame F (radius `r`, lifted `h`), closed: a path for a tube or a band. */
export const ringIn = (F, r, h = 0, k = 12, ry = r) => [...Array(k).keys()].map((j) => { const a = (j / k) * TAU; return { p: inFrame(F, Math.cos(a) * r, Math.sin(a) * ry, h), n: F.n }; });
/**
 * A gear on point `c` facing `n`: `teeth` square teeth round a rim (`R` to the teeth's roots, `tooth` deep), `spokes`
 * spokes from a hub to the rim with the openings between them cut through, `thick` deep, in `mat` (its walls `edge`);
 * a hub boss (`hub`: a glow, or brass). Weighted `w`. Returned with its frame.
 */
export function gear(c, n, o) {
  const F = frameAt(c, n, o.x0 ?? [0, 1, 0]), R = o.R, T = o.teeth ?? 12, S = o.spokes ?? 4, out = [];
  const cols = T * 4, rows = [o.hubR ?? R * 0.28, R * 0.42, R * 0.74, R, R + (o.tooth ?? R * 0.16)];
  const G = patch((u, v) => {
    const i = Math.round(u * 4), a = v * TAU + (o.turn ?? 0);
    // (the teeth: the outermost row out at every other pair of columns)
    const tooth = Math.floor(v * cols + 0.5) % 4 < 2;
    const r = i === 4 && !tooth ? R : rows[i];
    return { p: inFrame(F, Math.cos(a) * r, Math.sin(a) * r, i === 0 ? 0.015 : 0), n: F.n };
  }, 4, cols, { closed: true });
  // (the openings between the spokes: the band between the hub and the rim, but where a spoke runs)
  // (a small gear left whole between its hub and its rim: its openings would not read, and cost walls)
  const open = o.open ?? R >= 0.25;
  const spoke = (j) => { if (!open) return true; const f = ((j + 0.5) / cols) * S; return Math.abs(f - Math.round(f)) < (o.spokeW ?? 0.16); };
  out.push(solid(G, { hollow: o.hollow ?? true, thick: o.thick ?? 0.05, w: o.w, mat: (i, j) => (i === 1 && !spoke(j) ? null : i === 3 && Math.floor(j + 0.5) % 4 >= 2 ? null : i === 3 ? o.tip ?? o.mat : o.mat), inner: o.edge ?? o.mat, edge: o.edge ?? o.mat }));
  out.push(stud(inFrame(F, 0, 0, 0.01), F.n, { r: rows[0] * 0.9, h: o.hubH ?? R * 0.18, k: 6, mat: o.hub ?? o.mat, w: o.w }));
  return Object.assign(merge(...out), { frame: F });
}
/**
 * A round port on point `c` facing `n`: a bezel ring `R` across (`mat`, a polished rolled lip `lip`), `rivets` rivets
 * round it (`rivet`), the glass a domed disc sunk in it (`glass`). Weighted `w`.
 */
export function port(c, n, o) {
  const F = frameAt(c, n, o.x0 ?? [0, 1, 0]), R = o.R, k = o.k ?? 14, out = [];
  const bez = patch((u, v) => { const a = v * TAU, r = R * (0.72 + 0.28 * u); return { p: inFrame(F, Math.cos(a) * r, Math.sin(a) * r, (o.h ?? 0.06) * (1 - 0.6 * u)), n: F.n }; }, 1, k, { closed: true });
  out.push(solid(bez, { thick: o.h ?? 0.06, w: o.w, mat: () => o.mat, inner: o.edge ?? o.mat, edge: o.edge ?? o.mat }));
  out.push(tube(ringIn(F, R * 0.74, (o.h ?? 0.06) + 0.005, k), { r: o.lipR ?? R * 0.12, k: 4, mat: o.lip, w: o.w, closed: true }));
  const glass = patch((u, v) => { const a = v * TAU, r = R * 0.68 * (1 - u); return { p: inFrame(F, Math.cos(a) * r, Math.sin(a) * r, (o.h ?? 0.06) * 0.3 + (o.dome ?? 0.05) * Math.sqrt(1 - (1 - u) ** 2)), n: F.n }; }, 2, k, { closed: true });
  out.push(solid(glass, { sheet: true, w: o.w, mat: () => o.glass }));
  if (o.glint) out.push(stud(inFrame(F, -R * 0.26, R * 0.26, (o.h ?? 0.06) * 0.3 + (o.dome ?? 0.05) * 0.8), F.n, { r: R * 0.13, h: R * 0.06, k: 4, mat: o.glint, w: o.w }));
  for (let j = 0; j < (o.rivets ?? 0); j++) { const a = ((j + 0.5) / o.rivets) * TAU; out.push(stud(inFrame(F, Math.cos(a) * R * 0.88, Math.sin(a) * R * 0.88, (o.h ?? 0.06) * 0.5), F.n, { r: o.rivetR ?? R * 0.1, h: o.rivetR ?? R * 0.09, k: 4, mat: o.rivet, w: o.w })); }
  return Object.assign(merge(...out), { frame: F });
}
/**
 * A gauge on point `c` facing `n`: a dial `R` across (`face`) in a polished bezel (`bezel`), ticks round it (`tick`), a
 * needle pointing at `at` (radians from up; `needle`) on a boss. Weighted `w`.
 */
export function gauge(c, n, o) {
  const F = frameAt(c, n, o.x0 ?? [0, 1, 0]), R = o.R, k = o.k ?? 14, out = [];
  const cup = patch((u, v) => { const a = v * TAU, r = R * (1.12 - 0.12 * u); return { p: inFrame(F, Math.cos(a) * r, Math.sin(a) * r, -0.04 + 0.08 * u), n: F.n }; }, 1, k, { closed: true });
  out.push(solid(cup, { sheet: true, w: o.w, mat: () => o.bezel }));
  const face = patch((u, v) => { const a = v * TAU, r = R * (1 - u); return { p: inFrame(F, Math.cos(a) * r, Math.sin(a) * r, 0.03 + 0.012 * u), n: F.n }; }, 1, k, { closed: true });
  out.push(solid(face, { sheet: true, w: o.w, mat: () => o.face }));
  out.push(tube(ringIn(F, R * 1.02, 0.045, k), { r: o.rimR ?? R * 0.12, k: 4, mat: o.bezel2 ?? o.bezel, w: o.w, closed: true }));
  if (o.tick) for (let j = 0; j < 8; j++) { const a = PI * 0.25 + (j / 7) * PI * 1.5; const d = [Math.sin(a), Math.cos(a)]; out.push(tube([{ p: inFrame(F, d[0] * R * 0.62, d[1] * R * 0.62, 0.045), n: F.n }, { p: inFrame(F, d[0] * R * 0.86, d[1] * R * 0.86, 0.045), n: F.n }], { r: R * 0.05, k: 3, mat: o.tick, w: o.w, caps: false })); }
  const at = o.at ?? 0.6, d = [Math.sin(at), Math.cos(at)];
  out.push(tube([{ p: inFrame(F, -d[0] * R * 0.15, -d[1] * R * 0.15, 0.055), n: F.n }, { p: inFrame(F, d[0] * R * 0.8, d[1] * R * 0.8, 0.055), n: F.n }], { r: R * 0.06, k: 3, mat: o.needle, w: o.w }));
  out.push(stud(inFrame(F, 0, 0, 0.05), F.n, { r: R * 0.14, h: R * 0.1, k: 5, mat: o.bezel2 ?? o.bezel, w: o.w }));
  return Object.assign(merge(...out), { frame: F });
}
/** A pipe along points `pts` (a smooth path through them, `steps` a span), `r` round, couplings `cr` round at its ends and at `at` (fractions), in `mat` and `coupling`. Weighted `w`. */
export function pipe(pts, o) {
  const path = [];
  const steps = o.steps ?? 4;
  for (let k = 0; k < pts.length - 1; k++) {
    const p0 = pts[Math.max(0, k - 1)], p1 = pts[k], p2 = pts[k + 1], p3 = pts[Math.min(pts.length - 1, k + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const q = [0, 1, 2].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3));
      path.push(q);
    }
  }
  path.push(pts[pts.length - 1]);
  const up = o.up ?? [0, 1, 0], P = path.map((p) => ({ p, n: up }));
  const out = [tube(P, { r: o.r, k: o.k ?? 6, mat: o.mat, w: o.w })];
  for (const f of [0, ...(o.at ?? []), 1]) {
    const i = Math.round(f * (P.length - 1)), a = P[Math.max(0, i - 1)].p, b = P[Math.min(P.length - 1, i + 1)].p, d = unit(sub(b, a));
    out.push(sweep([{ p: add(P[i].p, mul(d, -(o.cl ?? 0.05))), n: up }, { p: add(P[i].p, mul(d, o.cl ?? 0.05)), n: up }], { closedProfile: true, w: o.w, mat: o.coupling, profile: [...Array(6).keys()].map((j) => { const a = (j / 6) * TAU; return [Math.cos(a) * (o.cr ?? o.r * 1.45), Math.sin(a) * (o.cr ?? o.r * 1.45)]; }) }));
  }
  return out;
}
