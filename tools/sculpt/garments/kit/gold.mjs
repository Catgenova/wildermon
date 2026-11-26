// The gold set's own builders (tools/sculpt/garments/gold.mjs), on the plate kit (../platekit.mjs):
//
//   * the head's dome (`headDome`): the skull's field round the head's middle, and the polar angle of the brow.
//   * a sunburst (`sunburst`): a flat disc of rays round a boss, on a point facing a way (the morion's comb, the
//     medallion, the breastplate's boss).
//   * a rope (`rope`): a twisted cord along a path (a roped comb, a roped rolled edge).
//   * a feather (`feather`): an ostrich plume from a socket, curling over as it rises (the morion's plume).
//   * a scroll (`scroll`): a running vine of raised tendrils, each crest curled into a spiral, along a band of a grid
//     (the acanthus embossing).
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, merge, part } from '../metalkit.mjs';
import { skinSamples, domeWrap, ellipsoidReach, patch, solid, sweep, stud, wrapAngle, shareW, torsoMiddle, torsoWrap } from '../platekit.mjs';

const PI = Math.PI, TAU = PI * 2;

/** How much of weights `w` are on the head and the jaw themselves. */
export const headW = (B, w) => w.reduce((t, [b, x]) => t + (B.bones[b].name === 'head' || B.bones[b].name === 'jaw' ? x : 0), 0);

/**
 * The head's dome: a field round a centre in the head (`D`, read `D.ta(theta / PI, azimuth)`: azimuth nought the face,
 * pi/2 the head's left), as far out as the skin reaches and `fit` more, never inside the ellipsoid `E` round it; with the
 * centre `c`, the polar angle of the brow `browTh`, and the head's reaches.
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

/**
 * A sunburst on point `c` facing `n` (its rays' first along `x`, made square to n): `rays` rays from a disc of `inner`
 * of its radius to `R`, alternate rays shorter by `short`, domed `dome` at the middle; a sheet in `mat`, every point
 * weighted `w`. Returned with its frame (`o`, `x`, `y`) so a boss can be set on it.
 */
export function sunburst(c, n, o) {
  const nn = unit(n), x0 = o.x ?? (Math.abs(nn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
  const x = unit(sub(x0, mul(nn, dot(x0, nn)))), y = cross(nn, x), rays = o.rays ?? 12, R = o.R, inner = o.inner ?? 0.5, short = o.short ?? 0.7;
  const cols = rays * (o.fine ? 4 : 2);
  const G = patch((u, v) => {
    const a = v * TAU, k = (v * rays) % 1, ray = 1 - Math.abs(2 * k - 1), alt = Math.floor(v * rays) % 2 ? short : 1;
    // (the disc to `inner`, then each ray a point: its reach falling straight from its middle to the gaps)
    const reach = inner + (1 - inner) * ray ** 1.2 * alt;
    const r = R * (u < 0.5 ? (u / 0.5) * inner : inner + ((u - 0.5) / 0.5) * (reach - inner));
    const d = (o.dome ?? 0.05) * (1 - (r / R) ** 2);
    return { p: add(c, add(mul(nn, d), add(mul(x, Math.cos(a) * r), mul(y, Math.sin(a) * r)))), n: nn };
  }, 2, cols, { closed: true });
  const P = solid(G, { sheet: !o.thick, thick: o.thick, w: o.w, mat: (i) => (i === 0 && o.disc ? o.disc : o.mat), edge: o.edge ?? o.mat, inner: o.inner2 ?? o.mat });
  return Object.assign(P, { frame: { o: c, x, y, n: nn } });
}

/** A twisted cord along a path: `r` round, flattened and turned `twist` radians a point, `k` sides. */
export function rope(path, o) {
  const k = o.k ?? 5, r = o.r, tw = o.twist ?? 1.1;
  return sweep(path, { ...o, closedProfile: true, profile: (i) => [...Array(k).keys()].map((j) => { const a = (j / k) * TAU, t = i * tw; const ex = Math.cos(a) * r * 1.35, ey = Math.sin(a) * r * 0.7; return [ex * Math.cos(t) - ey * Math.sin(t), (o.lift ?? 0) + ex * Math.sin(t) + ey * Math.cos(t)]; }) });
}

/**
 * An ostrich feather from `root`: a spine `L` long leaving along `dir`, bending `bend` radians toward `toward` over its
 * length (more toward the tip), `n` points; its vane flat across the spine, its face along `face`, `W` wide at its
 * fullest, its edge fringed. In `mat` (its tip `tip` from `tipAt` of its length on), every point weighted `w`.
 */
export function feather(root, o) {
  const n = o.n ?? 12, path = [];
  let p = root, d = unit(o.dir);
  const tw = unit(o.toward), ds = o.L / n;
  for (let k = 0; k <= n; k++) {
    path.push({ p, n: o.face });
    // (the spine bends toward `toward` the further out it is: an arch)
    const f = k / n, b = (o.bend * (0.4 + 1.6 * f)) / n;
    d = unit(add(mul(d, Math.cos(b)), mul(tw, Math.sin(b))));
    p = add(p, mul(d, ds));
  }
  const W = o.W, th = o.thick ?? 0.03;
  return sweep(path, {
    closedProfile: true, w: o.w, mat: (k) => (o.tip && k >= n * (o.tipAt ?? 0.75) ? o.tip : o.mat),
    // (its vane: a lens across, widest a third along, fringed)
    profile: (k) => { const f = k / n, wd = W * (0.25 + 0.75 * Math.sin(PI * Math.min(1, 0.12 + f * 1.05)) ** 0.7) * (1 + (o.fringe ?? 0.18) * Math.sin(f * 37)) + 0.015; return [[-wd, 0], [0, th], [wd, 0], [0, -th]]; },
  });
}

/**
 * A running scroll on a field read `at(t, a)` ({ p, n }): a wave from `a0` to `a1` about the line `t = tm(a)`, `amp`
 * high, `waves` crests; at each crest a tendril curling `turns` round into a spiral `curl` across, alternately above and
 * below. Raised tubes `r` round in `mat`, lifted `lift` off the field, weighted `w`.
 */
export function scroll(at, o) {
  const out = [], n = o.steps ?? 40, lift = o.lift ?? 0.02;
  const on = (t, a) => { const q = at(t, a); return { p: add(q.p, mul(q.n, lift)), n: q.n }; };
  const tOf = (a) => o.tm(a) + o.amp * Math.sin(((a - o.a0) / (o.a1 - o.a0)) * o.waves * TAU);
  const wave = [...Array(n + 1).keys()].map((k) => { const a = o.a0 + ((o.a1 - o.a0) * k) / n; return on(tOf(a), a); });
  out.push(sweep(wave, { closedProfile: true, profile: roundP(o.r, o.k ?? 4), mat: o.mat, w: o.w }));
  // (a tendril off each crest and each trough, curling back into a spiral)
  for (let c = 0; c < o.waves * 2; c++) {
    const a = o.a0 + ((o.a1 - o.a0) * (c + 0.5)) / (o.waves * 2), up = c % 2 ? -1 : 1, t0 = tOf(a);
    const pts = [], m = o.curlSteps ?? 8, R = o.curl, ka = o.aScale ?? 1;
    for (let k = 0; k <= m; k++) {
      const f = k / m, ang = f * (o.turns ?? 1.4) * TAU, rr = R * (1 - 0.75 * f);
      // (from the crest out along the wave, round, in toward its own middle)
      const cx = a + R * ka * 0.9, ct = t0 + up * R * 0.9;
      pts.push(on(ct - up * Math.cos(ang) * rr, cx - Math.sin(ang) * rr * ka));
    }
    out.push(sweep(pts, { closedProfile: true, profile: (k) => roundP(o.r * (1 - 0.5 * (k / m)), o.k ?? 4), mat: o.mat, w: o.w }));
    if (o.leaf) out.push(stud(pts[pts.length - 1].p, pts[pts.length - 1].n, { r: o.r * 1.8, h: o.r * 1.5, k: 4, mat: o.leaf, w: o.w }));
  }
  return out;
}
const roundP = (r, k) => [...Array(k).keys()].map((j) => { const a = (j / k) * TAU + PI / 4; return [Math.cos(a) * r, Math.sin(a) * r]; });
export { roundP };
void wrapAngle; void lerp; void len; void merge; void part;

/* ---- the torso ----------------------------------------------------------------------------------------------------- */
const TORSO_BONES = new Set(['root', 'pelvis', 'spine_01', 'spine_02', 'spine_03']);
export { TORSO_BONES };
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
