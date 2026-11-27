// The zinc set's own builders (tools/sculpt/garments/zinc.mjs), on the plate kit (../platekit.mjs):
//
//   * the galvanised spangle (`spangle`, `spangleOf`): a point's crystal (cells of a jittered lattice, the nearest's
//     shade: the field, a lighter facet or a darker one), so a plate's quads read as the patchy crystals of hot-dip zinc.
//   * the head's dome (`headDome`), the torso's field and its heights (`torsoField`, `torsoMarks`).
//   * a disc (`discAt`): a flat round plate on a point facing a way, its rim shaped (`rim(a)`): a lens, a washer.
//   * the sappers' badge (`pickAndShovel`): a pick and a shovel crossed on a lozenge (the mantlet's clasp).
//   * an eyecup (`eyecup`): a short tube standing off a surface, its rim rolled, a lens set in it (the goggles).
//   * a strap (`strapAround`): a leather band round a limb's wrap with a buckle on it.
//   * a coil (`coil`): a cord wound in turns round an axis (the slow match).
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, merge } from '../metalkit.mjs';
import { skinSamples, domeWrap, ellipsoidReach, patch, solid, tube, band, stud, sweep, shareW, torsoMiddle, torsoWrap, roundProfile } from '../platekit.mjs';

const PI = Math.PI, TAU = PI * 2;

/* ---- the spangle ------------------------------------------------------------------------------------------------- */
const hash3 = (x, y, z) => { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); };
/**
 * The crystal a point lies in (a jittered lattice `size` apart, the nearest seed's), as a number nought to one: the
 * galvanised spangle, its crystals a hand across.
 */
export function crystal(p, size = 0.34) {
  const q = mul(p, 1 / size), c = q.map(Math.floor);
  let best = Infinity, h = 0;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
    const x = c[0] + dx, y = c[1] + dy, z = c[2] + dz;
    const s = [x + hash3(x, y, z), y + hash3(y, z, x), z + hash3(z, x, y)];
    const d = len(sub(s, q));
    if (d < best) { best = d; h = hash3(x + 0.5, y + 0.25, z + 0.75); }
  }
  return h;
}
/** The spangle's shade at a point: mostly the field, a crystal in four a lighter facet, one in five a darker. */
export const spangle = (p, base = 'zn', size) => { const h = crystal(p, size); return h < 0.22 ? `${base}B` : h > 0.74 ? `${base}A` : base; };
/** A grid's cells in the spangle (by each cell's middle): for `solid`'s `mat`. */
export const spangleOf = (G, base = 'zn', size) => (i, j) => {
  const cols = G.P[0].length, j1 = G.closed ? (j + 1) % cols : j + 1;
  return spangle(mul(add(add(G.P[i][j], G.P[i][j1]), add(G.P[i + 1][j], G.P[i + 1][j1])), 0.25), base, size);
};

/* ---- the head ---------------------------------------------------------------------------------------------------- */
/** How much of weights `w` are on the head and the jaw themselves. */
export const headW = (B, w) => w.reduce((t, [b, x]) => t + (B.bones[b].name === 'head' || B.bones[b].name === 'jaw' ? x : 0), 0);
/**
 * The head's dome: a field round a centre in the head (`D`, read `D.ta(theta / PI, azimuth)`: azimuth nought the face,
 * pi/2 the head's left), as far out as the skin reaches and `fit` more, never inside the ellipsoid round it; with the
 * centre `c` and the polar angle of the brow `browTh`.
 */
export function headDome(B, o = {}) {
  const A = B.at, pick = (q) => headW(B, q.w) > 0.45, hs = skinSamples(B).filter(pick);
  const top = Math.max(...hs.map((q) => q.p[1])), bot = Math.min(...hs.map((q) => q.p[1]));
  const zf = Math.max(...hs.map((q) => q.p[2])), zb = Math.min(...hs.map((q) => q.p[2])), xw = Math.max(...hs.map((q) => q.p[0]));
  const c = [0, bot + 0.56 * (top - bot), (zf + zb) / 2];
  const fit = o.fit ?? (B.who === 'female' ? 0.11 : 0.16);
  const E = [xw + fit, top - c[1] + fit + (o.rise ?? 0), (zf - zb) / 2 + fit];
  const D = domeWrap(B, { c, u: [0, 1, 0], f: [0, 0, 1], s: [1, 0, 0], pick, rows: 30, cols: 48, thMax: PI, cone: 0.3, smooth: 4, shape: (r, th, ph, d) => Math.max(r + fit - 0.02, ellipsoidReach(E, d)) });
  const thOf = (p) => Math.acos(clamp(unit(sub(p, c))[1], -1, 1));
  const browTh = thOf([0, A.head[1] + 0.62 * (top - A.head[1]) / 1.6, zf]);
  return { D, c, E, fit, browTh, top, bot, zf, zb, xw, thOf };
}

/* ---- the torso --------------------------------------------------------------------------------------------------- */
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

/* ---- discs, badges, eyecups ---------------------------------------------------------------------------------------- */
/** A frame square to `n` on point `c`: x along `up` made square to n (or the world's up), y = n x x. */
export function frameAt(c, n, up = [0, 1, 0]) {
  const o = unit(n);
  let x = sub(up, mul(o, dot(up, o)));
  if (len(x) < 1e-4) x = sub([1, 0, 0], mul(o, dot([1, 0, 0], o)));
  x = unit(x);
  return { c, o, x, y: cross(o, x) };
}
/**
 * A round plate on a point `c` facing `n`: rings from `r0` of its radius out to its rim (`rim(a)`, the radius at angle
 * a), domed `dome` at its middle; `rings` rows and `k` columns. A grid for `solid`.
 */
export function discAt(c, n, o) {
  const F = frameAt(c, n, o.up), rings = o.rings ?? 2, k = o.k ?? 16, r0 = o.r0 ?? 0.15;
  const rim = typeof o.rim === 'function' ? o.rim : () => o.rim;
  return patch((u, v) => {
    const a = v * TAU, r = rim(a) * (r0 + (1 - r0) * u);
    return { p: add(c, add(mul(F.o, (o.dome ?? 0) * (1 - u * u)), add(mul(F.x, Math.cos(a) * r), mul(F.y, Math.sin(a) * r)))), n: F.o };
  }, rings, k, { closed: true });
}
/**
 * The sappers' badge on point `c` facing `n`: a lozenge plate `R` across (`plate`, its rim `rim`), a pick and a shovel
 * crossed over it in `mat` (the pick's head curved, the shovel's blade broad), a rivet where they cross; weighted `w`.
 */
export function pickAndShovel(c, n, o) {
  const F = frameAt(c, n, o.up), out = [], R = o.R, w = o.w;
  const P = (x, y, z = 0) => add(c, add(mul(F.y, x), add(mul(F.x, y), mul(F.o, z))));
  // (the lozenge: four corners, its middle raised a little)
  const loz = patch((u, v) => { const a = v * TAU, k = 1 / (Math.abs(Math.cos(a)) + Math.abs(Math.sin(a))), r = R * (0.15 + 0.85 * u) * k; return { p: P(Math.cos(a) * r * 0.85, Math.sin(a) * r, 0.04 * (1 - u)), n: F.o }; }, 2, 16, { closed: true });
  out.push(solid(loz, { w, thick: o.thick ?? 0.04, mat: () => o.plate, inner: o.back ?? o.plate, edge: o.back ?? o.plate }));
  out.push(tube([...Array(16).keys()].map((j) => { const q = loz.at(2, j); return { p: q.p, n: q.n }; }), { r: 0.03, k: 4, mat: o.rim, w, closed: true }));
  const flat = (pts, wd, z = 0.05) => sweep(pts.map(([x, y]) => ({ p: P(x, y, z), n: F.o })), { closedProfile: true, profile: [[-wd / 2, -0.02], [wd / 2, -0.02], [wd / 2, 0.025], [-wd / 2, 0.025]], mat: o.mat, w });
  const s = R * 0.78;
  // (the pick: its haft from the lower left to the upper right, its head across the top, curved down to points)
  out.push(flat([[-s, -s], [s * 0.85, s * 0.85]], 0.05));
  out.push(flat([[s * 0.35, s * 1.15], [s * 0.85, s * 0.85], [s * 1.2, s * 0.3]], 0.06, 0.07));
  // (the shovel: its haft the other way, its blade broad at the upper left)
  out.push(flat([[s, -s], [-s * 0.55, s * 0.55]], 0.05));
  const bl = patch((u, v) => { const t = 0.55 + 0.5 * u, wd = 0.17 * Math.sin(PI * Math.min(1, 0.25 + u * 0.9)) * R / 0.3, d = [-0.707, 0.707], sx = [0.707, 0.707]; return { p: P(s * (d[0] * t * 1.41) + sx[0] * wd * (v - 0.5) * 2, s * (d[1] * t * 1.41) + sx[1] * wd * (v - 0.5) * 2, 0.07), n: F.o }; }, 3, 2);
  out.push(solid(bl, { sheet: true, w, mat: () => o.mat }));
  out.push(stud(P(0, 0, 0.08), F.o, { r: 0.05, h: 0.05, k: 5, mat: o.rivet ?? o.rim, w }));
  return merge(...out);
}
/**
 * An eyecup standing off a surface at `c` along `n`: a tube `r` round and `h` high (`k` sides), its rim rolled in `rimMat`,
 * a lens (`lens`) set in it a little short of the rim; weighted `w`.
 */
export function eyecup(c, n, o) {
  const F = frameAt(c, n, o.up), k = o.k ?? 10, out = [], r = o.r, h = o.h;
  const cup = patch((u, v) => { const a = v * TAU, rr = r * (1 - 0.08 * u); return { p: add(c, add(mul(F.o, h * u - 0.03), add(mul(F.x, Math.cos(a) * rr), mul(F.y, Math.sin(a) * rr)))), n: add(mul(F.x, Math.cos(a)), mul(F.y, Math.sin(a))) }; }, 2, k, { closed: true });
  out.push(solid(cup, { sheet: true, w: o.w, mat: () => o.mat }));
  const top = [...Array(k).keys()].map((j) => { const a = (j / k) * TAU, d = add(mul(F.x, Math.cos(a)), mul(F.y, Math.sin(a))); return { p: add(c, add(mul(F.o, h), mul(d, r * 0.92))), n: d }; });
  out.push(tube(top, { r: o.rimR ?? 0.035, k: 4, mat: o.rimMat, w: o.w, closed: true }));
  const base = [...Array(k).keys()].map((j) => { const a = (j / k) * TAU, d = add(mul(F.x, Math.cos(a)), mul(F.y, Math.sin(a))); return { p: add(c, add(mul(F.o, 0.01), mul(d, r * 1.02))), n: d }; });
  out.push(tube(base, { r: (o.rimR ?? 0.035) * 0.8, k: 4, mat: o.rimMat, w: o.w, closed: true }));
  out.push(solid(discAt(add(c, mul(F.o, h - 0.025)), F.o, { rim: r * 0.86, k, rings: 1, r0: 0.01, dome: 0.03, up: o.up }), { sheet: true, w: o.w, mat: () => o.lens }));
  return merge(...out);
}
/** A cord wound `turns` times round an axis from `a` to `b`, `R` round it, `r` thick (`k` sides): the slow match's coil. */
export function coil(a, b, o) {
  const u = unit(sub(b, a)), F = frameAt(a, u, o.up ?? [1, 0, 0]), n = Math.round((o.turns ?? 4) * 7), path = [];
  for (let s = 0; s <= n; s++) {
    const f = s / n, t = f * (o.turns ?? 4) * TAU, d = add(mul(F.x, Math.cos(t)), mul(F.y, Math.sin(t)));
    path.push({ p: add(lerp(a, b, f), mul(d, o.R)), n: d });
  }
  return sweep(path, { closedProfile: true, profile: roundProfile(o.r, o.k ?? 4), mat: o.mat, w: o.w });
}
/** A ring of points round a surface's grid row, lifted: for a strap round a limb. */
export const ringOn = (G, fi, n, lift = 0) => [...Array(n).keys()].map((k) => { const q = G.at(fi, (k / n) * G.P[0].length); return { p: add(q.p, mul(q.n, lift)), n: q.n }; });
/**
 * A buckle on point `c` facing `n` (its long side along `x`): a frame of four bars `wd` by `ht`, a tongue across; in
 * `mat`, weighted `w`.
 */
export function buckle(c, n, x, o) {
  const F = frameAt(c, n, x), out = [], wd = o.wd ?? 0.16, ht = o.ht ?? 0.2, r = o.r ?? 0.022, lift = o.lift ?? 0.02;
  const P = (u, v) => ({ p: add(c, add(mul(F.o, lift), add(mul(F.x, u), mul(F.y, v)))), n: F.o });
  const loop = [P(-wd / 2, -ht / 2), P(wd / 2, -ht / 2), P(wd / 2, ht / 2), P(-wd / 2, ht / 2)];
  out.push(tube(loop, { r, k: 4, mat: o.mat, w: o.w, closed: true }));
  out.push(tube([P(0, -ht / 2), P(0, ht / 2 + 0.02)], { r: r * 0.8, k: 4, mat: o.mat, w: o.w }));
  return merge(...out);
}
void TAU; void cross; void band; void roundProfile;
