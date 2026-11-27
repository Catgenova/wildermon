// The electrum set's own builders (tools/sculpt/garments/electrum.mjs), on the plate kit (../platekit.mjs):
//
//   * a rosette (`rosette`): an embossed flower of `petals` rounded petals round a boss, on a point facing a way (the
//     tiara's brow band, the pectoral's rows, the sash's clasp).
//   * a crescent (`crescent`): a flat crescent plaque, horns up, on a point facing a way.
//   * scale rows (`scaleRows`): a coat of small rounded electrum scales on a field, each row lapped over the one below
//     and set half a scale round from it, each scale a tongue: its field, its bright crest down the middle, its shade
//     where the row above laps it.
//   * a tassel (`tassel`): a cord drop ending in a flared skirt of threads under a knot.
//   * a twisted torque (`torque`): a rigid neck ring of twisted electrum, open before, each end a beast's head.
import { add, sub, mul, dot, cross, len, unit, lerp, clamp, merge, part } from '../metalkit.mjs';
import { patch, solid, sweep, stud, wrapAngle, roundProfile } from '../platekit.mjs';

const PI = Math.PI, TAU = PI * 2;

/** A frame square to `n` at `c`: its x along `x0` (made square to n), y = n x x. */
export function frameAt(c, n, x0) {
  const nn = unit(n), xx = x0 ?? (Math.abs(nn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
  const x = unit(sub(xx, mul(nn, dot(xx, nn)))), y = cross(nn, x);
  return { o: c, n: nn, x, y, at: (a, b, h = 0) => add(c, add(add(mul(x, a), mul(y, b)), mul(nn, h))) };
}

/**
 * A rosette on point `c` facing `n`: `petals` rounded petals out to `R` round a domed heart, its petals cupped up
 * `cup`; a sheet in `mat` (its heart a stud in `heart`), every point weighted `w`. Its petals' first along `x`.
 */
export function rosette(c, n, o) {
  const F = frameAt(c, n, o.x), k = o.petals ?? 8, R = o.R, cols = k * (o.fine ?? 3);
  const G = patch((u, v) => {
    const a = v * TAU, lobe = Math.abs(Math.cos((k / 2) * a)) ** 0.7;
    const r = R * (0.18 + 0.82 * u) * (u < 0.01 ? 1 : 0.6 + 0.4 * lobe);
    const h = (o.cup ?? 0.03) * u * u + (o.dome ?? 0.04) * (1 - u) + (o.lift ?? 0.01);
    return { p: F.at(Math.cos(a) * r, Math.sin(a) * r, h), n: F.n };
  }, 2, cols, { closed: true });
  const out = [solid(G, { sheet: true, w: o.w, mat: (i, j) => (o.mat2 && Math.floor(j / (o.fine ?? 3)) % 2 ? o.mat2 : o.mat) })];
  if (o.heart !== null) out.push(stud(F.at(0, 0, (o.dome ?? 0.04) + 0.005), F.n, { r: R * (o.heartR ?? 0.34), h: R * (o.heartH ?? 0.3), k: o.heartK ?? 6, mat: o.heart ?? o.mat, capMat: o.heartCap, w: o.w }));
  return out;
}

/** A crescent plaque on `c` facing `n`, its horns toward `up`: `R` across, `thick` deep, in `mat`, its rim `rim`. */
export function crescent(c, n, o) {
  const F = frameAt(c, n, o.up), R = o.R, steps = o.steps ?? 14;
  // (the outer arc from horn to horn round the bottom, the inner arc a smaller circle set up toward the horns)
  const G = patch((u, v) => {
    const a = -PI / 2 + (v - 0.5) * (o.span ?? 1.65) * PI;
    const outer = [Math.sin(a) * R, -Math.cos(a) * R * 0.95], innerR = R * (o.inner ?? 0.7), cy = R * (o.lift ?? 0.32);
    const inner = [Math.sin(a) * innerR, -Math.cos(a) * innerR + cy];
    const q = lerp([inner[0], inner[1], 0], [outer[0], outer[1], 0], u);
    return { p: F.at(q[1], q[0], (o.dome ?? 0.03) * Math.sin(PI * u)), n: F.n };
  }, 2, steps);
  const out = [solid(G, { thick: o.thick ?? 0.04, w: o.w, mat: () => o.mat, inner: o.back ?? o.mat, edge: o.edge ?? o.mat })];
  if (o.rim) out.push(sweep([...Array(steps + 1).keys()].map((j) => ({ p: G.at(2, j).p, n: F.n })), { profile: roundProfile(o.rimR ?? 0.025, 3), closedProfile: true, mat: o.rim, w: o.w }));
  return out;
}

/**
 * Rows of scales on a field `at(y, a)` (a point and its normal at a height and an angle round the body), from height
 * `y0` (the lowest row's tips) up to `top(a)` (a row's scales left out above it), `rowH` apart, `n(y)` round (round
 * from `a0` to `a1`, or the whole way), each scale lapped over the row below by `lap` and standing `off(y, a)` off the
 * field (each row a little further out than the one below it, so they shingle). Each scale a tongue: a sheet of 3 x 3
 * quads, its crest `matL`, its flanks `mat`, its foot (lapped under the row above) `matS`.
 */
export function scaleRows(at, o) {
  const out = [], rows = Math.max(1, Math.round((o.y1 - o.y0) / o.rowH));
  const full = o.a0 === undefined;
  for (let r = 0; r < rows; r++) {
    const yTip = o.y0 + r * o.rowH, L = o.rowH * (1 + (o.lap ?? 0.7));
    const n = o.n(yTip + L / 2), step = full ? TAU / n : (o.a1 - o.a0) / n;
    for (let k = 0; k < n; k++) {
      const ac = full ? wrapAngle((k + (r % 2) * 0.5) * step + (o.phase ?? 0)) : o.a0 + (k + 0.5 + ((r % 2) - 0.5) * 0.5) * step;
      if (!full && (ac < o.a0 + step * 0.2 || ac > o.a1 - step * 0.2)) continue;
      const top = o.top ? Math.min(yTip + L, o.top(ac)) : yTip + L;
      if (top - yTip < o.rowH * 0.85) continue;
      if (o.skip && o.skip(yTip, ac)) continue;
      const wide = step * (o.wide ?? 0.56);
      // (the tongue's outline: straight flanks down from its top, rounded to its tip)
      const G = patch((u, v) => {
        const yy = top - u * (top - yTip), f = u * (top - yTip) / (o.rowH * 0.9), round = f < 0.45 ? 1 : Math.sqrt(Math.max(0, 1 - ((f - 0.45) / Math.max(0.55, (top - yTip) / (o.rowH * 0.9) - 0.45)) ** 2));
        const x = (v - 0.5) * 2 * wide * Math.max(o.tipW ?? 0.12, round);
        const q = at(yy, ac + x);
        // (domed across, and lifted toward its tip so it stands off the row below)
        const h = o.off(yy, ac) + r * (o.climb ?? 0.004) + (o.dome ?? 0.025) * (1 - (2 * v - 1) ** 2) + (o.tilt ?? 0.05) * u;
        return { p: add(q.p, mul(q.n, h)), n: q.n };
      }, o.nu ?? 3, o.nv ?? 3);
      out.push(solid(G, { hollow: !o.sheet, sheet: !!o.sheet, thick: o.thick ?? 0.03, w: o.w, mat: (i, j) => (o.nv === 2 ? (i === 0 ? o.matS : i === (o.nu ?? 3) - 1 ? o.matL : o.mat) : (o.nu ?? 3) === 2 ? (i === 0 ? o.matS : j === 1 ? o.matL : o.mat) : i === 0 ? o.matS : j === 1 && i > 0 ? o.matL : o.mat), edge: o.edge ?? o.matS }));
    }
  }
  return out;
}

/** A tassel hung from `p` down along `d`: a cord `L` long, a knot, a flared skirt of threads `S` long; in `mat`, its knot `knot`. */
export function tassel(p, d, o) {
  const dd = unit(d), F = frameAt(p, dd), L = o.L, S = o.S ?? L * 0.8, r = o.r ?? 0.03;
  const cord = sweep([{ p, n: F.x }, { p: add(p, mul(dd, L)), n: F.x }], { profile: roundProfile(r, 4), closedProfile: true, mat: o.mat, w: o.w });
  const k0 = add(p, mul(dd, L)), knot = stud(k0, dd, { r: r * 2.4, h: r * 2.6, k: 6, mat: o.knot ?? o.mat, w: o.w });
  const prof = (i) => { const f = i / 3, rr = r * (1.6 + 2.6 * f); return [...Array(6).keys()].map((j) => { const a = (j / 6) * TAU; return [Math.cos(a) * rr, Math.sin(a) * rr]; }); };
  const skirt = sweep([0, 1, 2, 3].map((i) => ({ p: add(k0, mul(dd, r * 2 + (S * i) / 3)), n: F.x })), { profile: prof, closedProfile: true, mat: o.mat, w: o.w });
  return [cord, knot, skirt];
}

/**
 * A twisted torque round a ring `ring(s)` (s nought to one round from one end to the other, open before), `r` thick,
 * its twist `twists` turns along it; each end a beast's head (a snout drawn out along the ring, two ears, an eye each
 * side in `eye`). In `mat`, its twist's shade `matS`, every point weighted `w`.
 */
export function torque(ring, o) {
  const n = o.steps ?? 40, r = o.r, out = [];
  const path = [...Array(n + 1).keys()].map((k) => ring(0.0 + k / n));
  const tw = o.twists ?? 10;
  out.push(sweep(path.map((q) => ({ p: q.p, n: q.n })), {
    closedProfile: true, w: o.w, mat: o.mat,
    // (a flattened four-lobed twist)
    profile: (k) => [...Array(6).keys()].map((j) => { const a = (j / 6) * TAU + (k / n) * tw * TAU; const rr = r * (j % 2 ? 0.7 : 1); return [Math.cos(a) * rr, Math.sin(a) * rr]; }),
  }));
  // (the heads: at each end, looking out along the ring's end)
  for (const [k, k2] of [[0, 1], [n, n - 1]]) {
    const q = path[k], d = unit(sub(q.p, path[k2].p)), F = frameAt(q.p, d, q.n);
    const hl = o.head ?? r * 3.4, hw = r * 1.6;
    // (the head: a lofted snout, widest at the brow, its muzzle blunt)
    const prof = (i) => { const f = i / 4, w = hw * (f < 0.35 ? 1 + 0.4 * f / 0.35 : 1.4 - 0.75 * ((f - 0.35) / 0.65)), h = hw * (f < 0.35 ? 1 + 0.3 * f / 0.35 : 1.3 - 0.6 * ((f - 0.35) / 0.65)); return [...Array(6).keys()].map((j) => { const a = (j / 6) * TAU; return [Math.cos(a) * w, Math.sin(a) * h]; }); };
    out.push(sweep([0, 1, 2, 3, 4].map((i) => ({ p: add(q.p, mul(d, (hl * i) / 4 - r * 0.3)), n: F.x })), { profile: prof, closedProfile: true, mat: o.headMat ?? o.mat, w: o.w }));
    // (ears up off the brow, eyes each side)
    const brow = add(q.p, mul(d, hl * 0.32));
    for (const sd of [-1, 1]) {
      out.push(stud(add(brow, add(mul(F.x, hw * 1.15), mul(F.y, sd * hw * 0.7))), unit(add(F.x, mul(F.y, sd * 0.6))), { r: hw * 0.55, h: hw * 0.9, k: 4, mat: o.headMat ?? o.mat, w: o.w }));
      out.push(stud(add(add(q.p, mul(d, hl * 0.5)), add(mul(F.y, sd * hw * 1.2), mul(F.x, hw * 0.35))), unit(add(mul(F.y, sd), mul(F.x, 0.3))), { r: hw * 0.42, h: hw * 0.35, k: 5, mat: o.eye, w: o.w }));
    }
  }
  return out;
}
/**
 * A stepped merlon (the battlement of a Persian crown): three steps, each narrower than the one under it, laid by
 * `at(x, y)` ({ p, n }: x across nought to one, y up nought to one), `thick` deep; its face `mat`, its steps' edges
 * `edge`, every point weighted `w`.
 */
export function merlon(at, o) {
  const X = [0, 1 / 6, 1 / 3, 2 / 3, 5 / 6, 1], Y = [0, o.h1 ?? 0.42, o.h2 ?? 0.72, 1];
  const P = Y.map((yy) => X.map((xx) => at(xx, yy)));
  const G = { P: P.map((r) => r.map((q) => q.p)), N: P.map((r) => r.map((q) => q.n)), closed: false };
  const keep = (i, j) => (i === 0 ? true : i === 1 ? j >= 1 && j <= 3 : j === 2);
  return solid(G, { thick: o.thick ?? 0.05, w: o.w, mat: (i, j) => (keep(i, j) ? (typeof o.mat === 'function' ? o.mat(i, j) : o.mat) : null), inner: o.back ?? o.mat, edge: o.edge ?? o.mat });
}
void clamp; void len; void merge; void part;
