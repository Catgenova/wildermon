// The seryll set's own builders (tools/sculpt/garments/seryll.mjs), on the plate kit (../platekit.mjs):
//
//   * the head's dome (`headDome`) and the torso's field and marks (`torsoField`, `torsoMarks`).
//   * a patch read off a skin field (`fieldPatch`): each point a place on the field (t, a), out off it, and moved.
//   * a fin (`fin`): a thin plate rising off a root line, its edge drawn into rays that end in points, swept back; its
//     rays raised ridges, its edge rolled (the helm's crest and cheeks, the vambraces', greaves' and boots' fins, the
//     mantle's wings).
//   * a coil (`coil`): a tube wound in a log spiral, thinning as it winds in, its chambers banded (the nautilus).
//   * a conch (`conch`): a cone wound round its axis in a spiral ridge set with knobs (the pauldrons, the knees).
//   * coral (`coral`): a branching twig of tubes forking as it grows.
//   * a kelp blade (`kelp`): a long strip with a wavy edge and a midrib, tapering to a point.
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, merge } from '../metalkit.mjs';
import { skinSamples, domeWrap, ellipsoidReach, patch, solid, sweep, stud, tube, shareW, torsoMiddle, torsoWrap, roundProfile, rowPath, colPath } from '../platekit.mjs';

const PI = Math.PI, TAU = PI * 2;

/** How much of weights `w` are on the head and the jaw themselves. */
export const headW = (B, w) => w.reduce((t, [b, x]) => t + (B.bones[b].name === 'head' || B.bones[b].name === 'jaw' ? x : 0), 0);

/** The head's dome (`D`, read `D.ta(theta / PI, azimuth)`), its centre, the polar angle of the brow and the head's reaches. */
export function headDome(B, o = {}) {
  const A = B.at, pick = (q) => headW(B, q.w) > 0.45, hs = skinSamples(B).filter(pick);
  const top = Math.max(...hs.map((q) => q.p[1])), bot = Math.min(...hs.map((q) => q.p[1]));
  const zf = Math.max(...hs.map((q) => q.p[2])), zb = Math.min(...hs.map((q) => q.p[2])), xw = Math.max(...hs.map((q) => q.p[0]));
  const c = [0, bot + 0.56 * (top - bot), (zf + zb) / 2];
  const fit = o.fit ?? (B.who === 'female' ? 0.11 : 0.16);
  const E = [xw + fit + (o.wide ?? 0), top - c[1] + fit + (o.rise ?? 0), (zf - zb) / 2 + fit + (o.wide ?? 0)];
  const D = domeWrap(B, { c, u: [0, 1, 0], f: [0, 0, 1], s: [1, 0, 0], pick, rows: o.rows ?? 30, cols: o.cols ?? 48, thMax: PI, cone: 0.3, smooth: 4, shape: (r, th, ph, d) => Math.max(r + fit - 0.02, ellipsoidReach(E, d)) });
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
/** The torso's skin as a field round its middle line, from mid-thigh to over the neck (`F.ta(t, a)`, `F.tOfY`, `F.yOfT`). */
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

/* ---- frames and patches ------------------------------------------------------------------------------------------- */
/** A frame on a point: `z` out along `n`, `y` along `up` made square to it, `x` across. */
export function frameAt(n, up) {
  const z = unit(n), y = unit(sub(up, mul(z, dot(up, z)))), x = cross(y, z);
  return { x, y, z };
}
export const at3 = (c, F, x, y, z) => add(c, add(add(mul(F.x, x), mul(F.y, y)), mul(F.z, z)));
/**
 * A patch read off a field `G` (a wrap or a dome: `G.ta(t, a)`): `nu` + 1 rows, `nv` + 1 columns, each point `f(u, v)`
 * a place on it ({ t, a }), out off it along its normal by `off`, then moved by `move` (a vector) where given.
 */
export function fieldPatch(G, nu, nv, f, { closed = false } = {}) {
  return patch((u, v) => {
    const s = f(u, v), q = G.ta(s.t, s.a);
    return { p: add(add(q.p, mul(q.n, s.off ?? 0)), s.move ?? [0, 0, 0]), n: q.n };
  }, nu, nv, { closed });
}

/* ---- a fin ---------------------------------------------------------------------------------------------------------- */
/**
 * A fin: rising off a root line (`root(v)`, v nought to one along it) along `up(v)`, `h(v)` high, swept along `back(v)`
 * by `sweep` of its height at its edge (more toward the edge: `u` squared), `rays` rays drawn out into points at its
 * edge (`spike` of the height). Its plate `thick` deep in `mat` (its edge's walls in `edge`), each ray a raised ridge
 * (`ray`, `rayR`), its edge rolled (`rim`), its veins (the rays `vein(k)` says) in `veinMat`. Every point weighted `w`.
 */
export function fin(o) {
  const nu = o.nu ?? 4, rays = o.rays ?? 5, per = o.per ?? 4, nv = rays * per;
  const spike = o.spike ?? 0.25;
  // (the edge's outline: a point at each ray, a notch between)
  const crest = (v) => { const f = v * rays, d = Math.abs(f - Math.floor(f) - 0.5) * 2; return 1 - spike + spike * d ** (o.sharp ?? 1.6); };
  const hOf = (v) => o.h(v) * crest(v + 0.5 / rays);
  const G = patch((u, v) => {
    const r = o.root(v), up = unit(o.up(v)), bk = o.back ? unit(o.back(v)) : [0, 0, 0], h = hOf(v);
    const p = add(add(r, mul(up, h * u)), mul(bk, (o.sweep ?? 0) * h * u * u));
    return { p, n: o.side ? o.side(v) : unit(cross(up, unit(sub(o.root(Math.min(1, v + 0.01)), o.root(Math.max(0, v - 0.01)))))) };
  }, nu, nv);
  const out = [solid(G, { w: o.w, sheet: o.sheet, thick: o.thick ?? 0.035, mat: o.matOf ?? (() => o.mat), inner: o.inner ?? o.mat, edge: o.edge ?? o.mat })];
  // (each ray: a ridge from the root out to its point, on both faces)
  if (o.ray) for (let k = 0; k < rays; k++) {
    const j = (k + 0.5) * per, m = o.vein && o.vein(k) ? o.veinMat : o.ray;
    for (const sd of [1, -1]) {
      const path = colPath(G, j, 0.15, nu - 0.25, nu).map((q) => ({ p: add(q.p, mul(q.n, sd * (o.thick ?? 0.035) * (sd > 0 ? 0.2 : 1.2))), n: mul(q.n, sd) }));
      const rr = m === o.veinMat ? o.veinR ?? o.rayR ?? 0.03 : o.rayR ?? 0.03;
      out.push(sweep(path, { closedProfile: false, caps: false, profile: [[-rr, -0.6 * rr], [0, rr], [rr, -0.6 * rr]], mat: m, w: o.w }));
      if (o.oneSide) break;
    }
  }
  if (o.rim) out.push(tube(rowPath(G, nu, 0, nv, nv), { r: o.rimR ?? 0.028, k: 4, mat: o.rim, w: o.w }));
  const P = merge(...out);
  P.G = G;
  return P;
}

/* ---- a nautilus coil ----------------------------------------------------------------------------------------------- */
/**
 * A coil: a tube wound in a log spiral in the plane of `x` and `y` about `c` (x the way it starts out from the centre),
 * from radius `r0` at turn nought inward by `grow` a turn for `turns` turns, `steps` points a turn; its section `thick`
 * of the spiral's radius there (`flat`: squashed across the plane), `k` sided. Its chambers banded: every `band` of a
 * turn alternately `mat` and `alt`, a septum ridge (`septum`) at each.
 */
export function coil(c, x, y, o) {
  const z = unit(cross(x, y)), turns = o.turns ?? 1.6, steps = o.steps ?? 18, n = Math.round(turns * steps);
  const b = Math.log(o.grow ?? 3) / TAU;
  const R = (th) => o.r0 * Math.exp(-b * th);
  const path = [...Array(n + 1).keys()].map((i) => {
    const th = (i / n) * turns * TAU, r = R(th);
    return { p: add(c, add(mul(x, Math.cos(th) * r), mul(y, Math.sin(th) * r))), n: z, th, r };
  });
  const k = o.k ?? 6, flat = o.flat ?? 1;
  // (the section: round in the spiral's plane, squashed across it; out from the spiral's middle as it winds)
  const prof = (i) => {
    const r = path[i].r * (o.thick ?? 0.45) * (i === n ? 0.6 : 1);
    return [...Array(k).keys()].map((j) => { const a = (j / k) * TAU; return [Math.cos(a) * r * flat, Math.sin(a) * r]; });
  };
  // (sweep lays `across` along the path's side, `up` along the given normal: here the normal is the coil's axis, so
  // across is the spiral's radius and up is across the plane)
  const band = o.band ?? 0.125;
  const P = sweep(path, { closedProfile: true, w: o.w, profile: (i) => prof(i).map(([a2, b2]) => [b2, a2]), mat: (i) => (Math.floor((path[i].th / TAU) / band) % 2 === 0 ? o.mat : o.alt ?? o.mat) });
  const out = [P];
  if (o.septum) for (let i = 1; i < n; i++) {
    if (Math.floor((path[i].th / TAU) / band) === Math.floor((path[i - 1].th / TAU) / band)) continue;
    const t = unit(sub(path[Math.min(n, i + 1)].p, path[i - 1].p)), rr = path[i].r * (o.thick ?? 0.45) * 1.04;
    const side = unit(cross(t, z));
    const kr = o.septumK ?? k, ring = [...Array(kr + 1).keys()].map((j) => { const a = (j / kr) * TAU; return { p: add(path[i].p, add(mul(side, Math.sin(a) * rr), mul(z, Math.cos(a) * rr * flat))), n: z }; });
    out.push(tube(ring, { r: o.septumR ?? 0.025, k: 3, mat: o.septum, w: o.w, closed: true }));
  }
  const M = merge(...out);
  M.path = path;
  return M;
}

/* ---- a conch ------------------------------------------------------------------------------------------------------- */
/**
 * A conch: a cone from its mouth at `c` (radius `R`) to its tip `H` along `axis`, its section round, a ridge wound round
 * it in a spiral (`turns`), knobs (`knobs` a turn) on the ridge; `nu` rows, `nv` columns. Its face `mat`, ridge `ridge`,
 * knobs `knob`. Every point weighted `w`. Its grid `G` for laying more on.
 */
export function conch(c, axis, front, o) {
  const F = frameAt(axis, front), nu = o.nu ?? 8, nv = o.nv ?? 18, turns = o.turns ?? 2.2;
  // (its profile: round at the mouth, the shoulder swelling, drawn in to the spire's point)
  const rOf = (u) => o.R * (1 - u) ** (o.taper ?? 0.9) * (1 + 0.12 * Math.sin(PI * Math.min(1, u * 1.6)));
  const G = patch((u, v) => {
    const a = v * TAU, r = rOf(u), h = o.H * u;
    // (the whorl's step: each turn sits a little proud of the one above it)
    const step = (o.step ?? 0.08) * o.R * (1 - u) * (((v + u * turns) % 1));
    const rr = r + step;
    return { p: add(c, add(mul(F.z, h), add(mul(F.x, Math.cos(a) * rr * (o.squash ?? 1)), mul(F.y, Math.sin(a) * rr)))), n: unit(add(mul(F.x, Math.cos(a)), mul(F.y, Math.sin(a)))) };
  }, nu, nv, { closed: true });
  const out = [solid(G, { sheet: true, w: o.w, mat: o.matOf ?? (() => o.mat) })];
  // (the spiral ridge: round the cone from the mouth to the tip)
  const pts = [], m = Math.round(turns * (o.ridgeSteps ?? 24));
  for (let k = 0; k <= m; k++) {
    const f = k / m, u = f * 0.92, v = (1 - ((f * turns) % 1)) % 1, q = G.at(u * nu, v * nv);
    pts.push({ p: add(q.p, mul(q.n, 0.01)), n: q.n, u });
  }
  if (o.ridge) out.push(tube(pts, { r: o.ridgeR ?? 0.04, k: 3, mat: o.ridge, w: o.w }));
  if (o.knob) {
    const every = Math.max(1, Math.round(24 / (o.knobs ?? 6)));
    for (let k = every; k < pts.length - 4; k += every) {
      const q = pts[k], s = (o.knobR ?? 0.08) * (1 - q.u * 0.7);
      out.push(stud(q.p, q.n, { r: s, h: s * 1.6, k: 4, mat: o.knob, w: o.w }));
    }
  }
  const P = merge(...out);
  P.G = G; P.F = P.F; P.frame = F;
  return P;
}

/* ---- coral ----------------------------------------------------------------------------------------------------------- */
/**
 * A coral twig: from `c` along `dir` (on a surface facing `n`), `L` long, forking `depth` times, each fork turned
 * `spread` either way in the surface's plane; tubes `r` thick thinning as they fork, a bud at each tip. Its points
 * pushed onto the surface by `onto(p)` where given (returning { p, n }).
 */
export function coral(c, dir, n, o) {
  const out = [];
  const grow = (p0, d, L, r, depth) => {
    const pts = [];
    for (let k = 0; k <= 3; k++) {
      let p = add(p0, mul(d, (L * k) / 3)), nn = n;
      if (o.onto) { const q = o.onto(p); p = add(q.p, mul(q.n, o.lift ?? 0.02)); nn = q.n; }
      pts.push({ p, n: nn });
    }
    out.push(tube(pts, { r, k: 3, mat: o.mat, w: o.w }));
    const tip = pts[3].p;
    if (depth <= 0) { out.push(stud(tip, pts[3].n, { r: r * 1.5, h: r * 1.4, k: 4, mat: o.bud ?? o.mat, w: o.w })); return; }
    const side = unit(cross(n, d));
    for (const s of [1, -1]) {
      const a = (o.spread ?? 0.55) * s * (s > 0 ? 1 : 0.8);
      grow(tip, unit(add(mul(d, Math.cos(a)), mul(side, Math.sin(a)))), L * (o.shrink ?? 0.72), r * 0.78, depth - 1);
    }
  };
  grow(c, unit(dir), o.L, o.r, o.depth ?? 2);
  return merge(...out);
}
void len; void TAU;

/* ---- the tide ----------------------------------------------------------------------------------------------------- */
/**
 * A wave's crest along an edge: nought in the trough, one at the crest, `n` waves over x nought to one, each rising
 * slowly and breaking sharply (`lean` of each wave the slow rise), as a tide's waves curl.
 */
export function tide(x, n, lean = 0.68) {
  const f = ((x * n) % 1 + 1) % 1, g = f < lean ? f / lean : (1 - f) / (1 - lean);
  return g ** 1.6;
}
