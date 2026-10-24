/**
 * A tree's wood and where its leaf hangs, grown from a seed: a leaning,
 * bending trunk with a root flare that splits low into a few sinuous
 * scaffold limbs, branches off those spreading wide and hanging at their
 * ends, twigs off them, and sprays of leaf lying along the branches with the
 * twigs' ends poking out past them. The same seed is the same tree.
 */
import { mulberry32 } from '../../world/noise';
import { HALF_H, HEIGHT_SCALE, UNITS_PER_TILE } from '../iso';
import type { Build, Clump, Envelope, Limb, Skeleton, V3, Whorls } from './types';
import { across, add, dot, len, lerp, mul, sub, turn, unit } from './vec';

const TAU = Math.PI * 2;

/** How far out of the crown's middle a point is: 1 on its ellipsoid. */
export const outOf = (env: Envelope, p: V3): number =>
  Math.hypot((p[0] - env.c[0]) / env.r, (p[1] - env.c[1]) / env.r, (p[2] - env.c[2]) / env.rz);

const bezier = (a: V3, b: V3, c: V3, d: V3, t: number): V3 => {
  const u = 1 - t;
  return add(add(mul(a, u * u * u), mul(b, 3 * u * u * t)), add(mul(c, 3 * u * t * t), mul(d, t * t * t)));
};

/** Grow a tree `height` units tall to a build, from a seed. */
export function grow(b: Build, height: number, seed: number): Skeleton {
  const R = mulberry32(seed);
  const H = height;
  if (b.whorls) return growWhorls(b, b.whorls, H, seed);
  const stemZ = H * b.stem;
  const rz = (H - stemZ) * b.dome;
  const leanA = R() * TAU;
  const leanD: V3 = [Math.cos(leanA), Math.sin(leanA), 0];
  const sideD: V3 = [-leanD[1], leanD[0], 0];
  const env: Envelope = { c: [leanD[0] * b.lean * 1.4, leanD[1] * b.lean * 1.4, H - rz], r: H * b.spread, rz };
  const limbs: Limb[] = [];
  const r0 = H * b.girth;

  /* ---- the trunk: leaning, with a bend in it, to where it splits ---- */
  const bend = (R() - 0.5) * 2 * b.gnarl * r0 * 2.2;
  const trunkAt = (f: number): V3 => {
    const s = Math.sin(f * Math.PI * 1.15) * bend;
    return [leanD[0] * b.lean * Math.pow(f, 1.4) + sideD[0] * s, leanD[1] * b.lean * Math.pow(f, 1.4) + sideD[1] * s, stemZ * f];
  };
  const trunkR = (f: number): number => r0 * (1 - 0.32 * f);
  const TRUNK = 4;
  for (let i = 0; i < TRUNK; i++) {
    const f0 = i / TRUNK, f1 = (i + 1) / TRUNK;
    limbs.push({ a: trunkAt(f0), b: trunkAt(f1), ra: trunkR(f0), rb: trunkR(f1), order: 0, parent: i - 1, bough: -1 });
  }
  /* ---- the root flare ---- */
  const roots = b.flare > 1.15 ? 4 + Math.round(R()) : 0;
  const rootA = R() * TAU;
  for (let i = 0; i < roots; i++) {
    const a = rootA + (i / roots) * TAU + (R() - 0.5) * 0.7;
    const reach = r0 * b.flare * (0.7 + 0.25 * R());
    limbs.push({
      a: [Math.cos(a) * r0 * 0.5, Math.sin(a) * r0 * 0.5, r0 * (1.1 + 0.4 * R())],
      b: [Math.cos(a) * reach, Math.sin(a) * reach, r0 * 0.08],
      ra: r0 * 0.55, rb: r0 * 0.3, order: -1, parent: 0, bough: -1,
    });
  }

  /* ---- limbs, branches and twigs ---- */
  const maxOrder = 1 + Math.max(0, Math.min(3, b.forks));
  /** A limb as a run of pieces along a curve; its pieces' indices. */
  const run = (pts: V3[], ra: number, rb: number, order: number, parent: number, bough: number, dead: boolean): number[] => {
    const out: number[] = [];
    let up = parent;
    for (let i = 1; i < pts.length; i++) {
      const idx = limbs.length;
      const t0 = (i - 1) / (pts.length - 1), t1 = i / (pts.length - 1);
      limbs.push({ a: pts[i - 1], b: pts[i], ra: ra + (rb - ra) * t0, rb: ra + (rb - ra) * t1, order, parent: up, bough, dead });
      out.push(idx);
      up = idx;
    }
    return out;
  };
  /** Branches off a run of pieces, and theirs off them. */
  const branch = (pieces: number[], order: number, bough: number, dead: boolean): void => {
    if (order > maxOrder) return;
    const total = pieces.reduce((s, i) => s + len(sub(limbs[i].b, limbs[i].a)), 0);
    const n = Math.max(1, Math.round(b.branching + (R() - 0.4) * 1.2 - (order >= 4 ? 0.5 : 0)));
    const twist = R() * TAU;
    for (let j = 0; j < n; j++) {
      const t = n === 1 ? 0.6 + 0.3 * R() : 0.3 + 0.62 * ((j + 0.3 + 0.4 * R()) / n);
      let at = t * total, piece = pieces[0];
      for (const i of pieces) {
        const l = len(sub(limbs[i].b, limbs[i].a));
        piece = i;
        if (at <= l) break;
        at -= l;
      }
      const L = limbs[piece];
      const pl = len(sub(L.b, L.a)) || 1;
      const u = Math.min(1, at / pl);
      const a = lerp(L.a, L.b, u);
      const pr = L.ra + (L.rb - L.ra) * u;
      const d0 = unit(sub(L.b, L.a));
      const side = turn(across(d0), d0, twist + j * 2.4 + (R() - 0.5) * 0.8);
      const spread = (0.6 + 0.4 * R()) * (order >= 4 ? 0.85 : 1);
      let d = unit(add(mul(d0, Math.cos(spread)), mul(side, Math.sin(spread))));
      // Out from the middle of the crown and level: a maple spreads rather than climbs.
      const outward = sub(a, env.c);
      outward[2] *= 0.3;
      d = unit(add(d, mul(unit(outward), 0.5)));
      // Twigs turn up at their ends; the boughs they grow on are what spread and hang.
      d[2] = order >= 3 ? Math.abs(d[2]) * 0.6 + 0.25 : d[2] * 0.45;
      d = unit(d);
      const reach = env.r * (order === 2 ? 0.5 : order === 3 ? 0.3 : 0.16) * (0.75 + 0.45 * R()) * (1 - 0.3 * t) * (dead ? 0.6 : 1);
      const end = add(a, mul(d, reach));
      // Arched, and hanging at its end.
      end[2] -= reach * b.droop * (order >= 3 ? 0.15 : 0.4 + 0.4 * R());
      const mid = add(lerp(a, end, 0.5), add(mul(across(d), (R() - 0.5) * reach * 0.3 * (0.5 + b.gnarl)), [0, 0, reach * 0.14]));
      const r = Math.min(pr * 0.7, Math.max(0.1, pr * (0.5 + 0.1 * R())));
      const pts = order === 2 ? [a, lerp(lerp(a, mid, 0.33), lerp(mid, end, 0.33), 0.33), lerp(lerp(a, mid, 0.67), lerp(mid, end, 0.67), 0.67), end] : [a, mid, end];
      const kid = run(pts, r, r * 0.5, order, piece, bough, dead);
      branch(kid, order + 1, bough, dead);
    }
  };

  const n = Math.max(1, Math.round(b.scaffolds));
  const a0 = R() * TAU;
  const deadOnes = new Set<number>();
  for (let k = 0; k < Math.min(n, Math.round(b.dead)); k++) deadOnes.add(Math.floor(R() * n));
  for (let i = 0; i < n; i++) {
    // No leader: the trunk splits into its limbs and none of them goes on up the middle.
    const f = i === 0 ? 0.72 + 0.1 * R() : 0.88 + 0.12 * R();
    const B = trunkAt(f);
    const az = a0 + (i / n) * TAU + (R() - 0.5) * (TAU / n) * 0.55;
    const dead = b.bare || deadOnes.has(i);
    const reach = b.bare ? 0.72 + 0.34 * R() : 0.5 + 0.14 * R();
    const rise = b.bare ? -0.5 + 0.55 * R() : -0.3 + 0.42 * R();
    let T: V3 = [env.c[0] + Math.cos(az) * env.r * reach, env.c[1] + Math.sin(az) * env.r * reach, env.c[2] + rise * rz];
    if (b.bare) T = lerp(B, T, 0.7);
    const L = len(sub(T, B));
    const out = unit([T[0] - B[0], T[1] - B[1], 0]);
    const side: V3 = [-out[1], out[0], 0];
    const wob = (R() - 0.5) * 2 * (0.3 + b.gnarl) * 0.3 * L;
    // Up out of the split first, then out across the crown, bending as it goes.
    const C1 = add(B, add(mul(out, 0.16 * L), [side[0] * wob, side[1] * wob, 0.34 * L]));
    const C2 = add(T, add(mul(out, -0.38 * L), [-side[0] * wob * 0.6, -side[1] * wob * 0.6, 0.06 * L]));
    T[2] -= L * b.droop * 0.12;
    const pts = [0, 0.17, 0.34, 0.5, 0.67, 0.83, 1].map((t) => bezier(B, C1, C2, T, t));
    const rb = trunkR(f) * (0.46 + 0.1 * R());
    const pieces = run(pts, rb, rb * 0.36, 1, Math.min(TRUNK - 1, Math.floor(f * TRUNK - 1e-6)), i, dead);
    branch(pieces, 2, i, dead);
  }
  for (let i = 0; i < limbs.length; i++) {
    const L = limbs[i];
    if (L.order >= 1 && !limbs.some((m) => m.parent === i)) L.tip = true;
  }

  /* ---- the leaf: a dome of big lumpy masses ---- */
  const clumps: Clump[] = [];
  if (!b.bare && b.clumps > 0) {
    const n = Math.max(1, Math.round(b.clumps));
    const rm = env.r * b.clumpSize;
    const tips: number[] = [];
    for (let i = 0; i < limbs.length; i++) if (limbs[i].order >= 1 && !limbs[i].dead) tips.push(i);
    const ring = Math.max(1, n - 1);
    for (let i = 0; i < n; i++) {
      // One on the crown's top, the rest round it over the scaffold limbs, each touching the next.
      const top = i === 0 && n > 1;
      const az = a0 + ((i - 1) / ring) * TAU + (R() - 0.5) * (TAU / ring) * 0.3;
      const out = top ? 0.12 * R() : 0.52 + 0.14 * R();
      const z = top ? 0.38 + 0.12 * R() : -0.5 + 0.5 * R();
      const c: V3 = [env.c[0] + Math.cos(az) * env.r * out, env.c[1] + Math.sin(az) * env.r * out, env.c[2] + z * env.rz];
      let best = 0, bd = Infinity;
      for (const t of tips) {
        const d = len(sub(limbs[t].b, c));
        if (d < bd) { bd = d; best = t; }
      }
      clumps.push({
        c, r: rm * (top ? 1.05 : 0.85 + 0.3 * R()), limb: best, k: R(),
        out: Math.min(1, outOf(env, c)),
        up: Math.max(0, Math.min(1, (c[2] - (env.c[2] - rz)) / (2 * rz))),
      });
    }
  }
  const toward = (a: number): number => a + (R() - 0.5) * 0.5;
  return {
    limbs, clumps, crown: env, height: H,
    // Cut where it is seen from the first turn of the camera.
    rune: b.rune ? toward(Math.PI / 4) : null,
    hollow: b.hollow ? toward(Math.PI / 4 + 1.1) : null,
  };
}

/* ---- the wind ---- */

/** Which way the wind pushes, along the ground. */
const WIND: V3 = unit([1, -0.35, 0]);

/**
 * The same tree a moment into a gust: every point pushed along the wind by
 * how high it stands and how far out along its bough, each bough a little
 * out of step with the next, the twigs further, and every clump shaken on
 * its own.
 */
export function swayed(sk: Skeleton, frame: number, frames: number, seed: number): Skeleton {
  if (frame === 0 || frames <= 1) return sk;
  const ph = (frame / frames) * TAU;
  const H = sk.height, Rr = sk.crown.r;
  const push = (p: V3, bough: number, extra: number): V3 => {
    const h = Math.max(0, p[2] / H);
    const off = Math.hypot(p[0], p[1]) / Rr;
    const k = 0.035 * H * h * h * Math.sin(ph) + 0.06 * Rr * off * off * Math.sin(ph + bough * 1.7 + 0.6) + extra;
    return [p[0] + WIND[0] * k, p[1] + WIND[1] * k, p[2] - Math.abs(k) * 0.12 * off];
  };
  const limbs = sk.limbs.map((L, i) => {
    const flick = L.order >= 3 ? Math.sin(ph * 2 + i * 0.9 + seed) * 0.35 : 0;
    return { ...L, a: push(L.a, L.bough, 0), b: push(L.b, L.bough, flick) };
  });
  // A piece starts where its parent's point went.
  for (let i = 0; i < limbs.length; i++) {
    const L = limbs[i];
    if (L.parent < 0 || L.order < 1) continue;
    const P = limbs[L.parent];
    const o = sk.limbs[L.parent];
    const was = sk.limbs[i];
    const t = Math.max(0, Math.min(1, dot(sub(was.a, o.a), sub(o.b, o.a)) / Math.max(1e-6, dot(sub(o.b, o.a), sub(o.b, o.a)))));
    L.a = lerp(P.a, P.b, t);
  }
  const clumps = sk.clumps.map((c, i) => {
    const L = sk.limbs[c.limb];
    const j = Math.sin(ph * 2 + i * 2.3 + seed) * c.r * 0.07;
    const p = push(c.c, L?.bough ?? 0, Math.sin(ph * 2 + i * 1.3) * 0.3);
    return { ...c, c: [p[0] + j, p[1] - j * 0.5, p[2] + j * 0.6] as V3 };
  });
  return { ...sk, limbs, clumps };
}

/* ---- a conifer ---- */

/**
 * How low anything of a tree may hang this far out from its foot: off the
 * ground, and over its own tile, since the ground of the tiles in front is
 * laid after it (`../iso`).
 */
const hemAt = (H: number, out: number): number => Math.max(H * 0.03, ((2 * HALF_H * out) / UNITS_PER_TILE - HALF_H) / HEIGHT_SCALE + 0.6);

/**
 * A conifer grown from a seed: a straight leader on a root flare, bare to
 * `stem` of the height, then whorls of boughs up it to its top -- each
 * whorl a few boughs round the leader turned from the one under it, the
 * lowest reaching furthest -- and a tuft on the top. A dead crown leaves the
 * leader bare and grey over the last whorl, snapped and bent over when
 * `broken`; stubs of dead boughs stand off the bare trunk. A dead tree is a
 * pole with the stubs of its whorls all the way up.
 */
export function growWhorls(b: Build, w: Whorls, H: number, seed: number): Skeleton {
  const R = mulberry32(seed);
  const leanA = R() * TAU;
  const leanD: V3 = [Math.cos(leanA), Math.sin(leanA), 0];
  const sideD: V3 = [-leanD[1], leanD[0], 0];
  const r0 = H * b.girth;
  const stemZ = H * b.stem;
  const dead = b.bare || w.deadTop < 1;
  // Where the live crown stops, and where the leader does.
  const crownTop = b.bare ? stemZ : H * (w.deadTop < 1 ? w.deadTop : w.spire ? 0.9 : 0.97);
  const topZ = b.bare ? H * 0.88 : w.deadTop < 1 ? crownTop : H;
  const bend = (R() - 0.5) * 2 * b.gnarl * r0 * 2.2;
  const axis = (z: number): V3 => {
    const f = z / H;
    const s = Math.sin(f * Math.PI * 1.15) * bend;
    return [leanD[0] * b.lean * Math.pow(f, 1.4) + sideD[0] * s, leanD[1] * b.lean * Math.pow(f, 1.4) + sideD[1] * s, z];
  };
  const radius = (z: number): number => Math.max(0.12, r0 * (1 - 0.9 * Math.pow(Math.min(1, z / H), 0.85)));
  const limbs: Limb[] = [];
  const clumps: Clump[] = [];

  /* ---- the whorls' heights, and the trunk in a piece between each two ---- */
  const n = b.bare ? 0 : Math.max(1, Math.round(w.tiers));
  const zs: number[] = [];
  for (let i = 0; i < n; i++) zs.push(stemZ + (crownTop - stemZ) * (n === 1 ? 0 : Math.pow(i / (n - 1), 0.95)));
  const cuts = [0, stemZ * 0.5, ...zs.filter((z) => z > stemZ * 0.5 + 0.5 && z < topZ - 0.5), topZ];
  if (b.bare) for (let i = 1; i < 6; i++) cuts.splice(cuts.length - 1, 0, stemZ + ((topZ - stemZ) * i) / 6);
  for (let i = 0; i + 1 < cuts.length; i++) {
    limbs.push({ a: axis(cuts[i]), b: axis(cuts[i + 1]), ra: radius(cuts[i]), rb: radius(cuts[i + 1]), order: 0, parent: i - 1, bough: -1, dead: b.bare });
  }
  const trunkN = limbs.length;
  const pieceAt = (z: number): number => {
    for (let i = 0; i < trunkN; i++) if (limbs[i].b[2] >= z) return i;
    return trunkN - 1;
  };

  /* ---- the root flare ---- */
  const roots = b.flare > 1.15 ? 4 + Math.round(R()) : 0;
  const rootA = R() * TAU;
  for (let i = 0; i < roots; i++) {
    const a = rootA + (i / roots) * TAU + (R() - 0.5) * 0.7;
    const reach = r0 * b.flare * (0.7 + 0.25 * R());
    limbs.push({
      a: [Math.cos(a) * r0 * 0.5, Math.sin(a) * r0 * 0.5, r0 * (1.1 + 0.4 * R())],
      b: [Math.cos(a) * reach, Math.sin(a) * reach, r0 * 0.08],
      ra: r0 * 0.55, rb: r0 * 0.3, order: -1, parent: 0, bough: -1,
    });
  }

  /** A dead stub off the trunk at `z`, pointing `a` round, `len` long, `rise` up for its length. */
  const stub = (z: number, a: number, len: number, rise: number): void => {
    const p = axis(z);
    const r = radius(z) * 0.32;
    const d: V3 = [Math.cos(a), Math.sin(a), 0];
    const mid = add(p, add(mul(d, len * 0.55), [0, 0, len * rise * 0.4]));
    const end = add(p, add(mul(d, len), [0, 0, len * rise]));
    const at = limbs.length;
    limbs.push({ a: p, b: mid, ra: r, rb: r * 0.7, order: 1, parent: pieceAt(z), bough: limbs.length, dead: true });
    limbs.push({ a: mid, b: end, ra: r * 0.7, rb: r * 0.35, order: 1, parent: at, bough: at, dead: true, tip: true });
  };

  /* ---- the dead leader over a dead crown ---- */
  if (dead) {
    const z0 = b.bare ? topZ : crownTop;
    const tall = H * (b.bare ? 0.06 : 0.97) - (b.bare ? 0 : z0);
    if (tall > 1) {
      const p0 = axis(z0);
      const a = R() * TAU;
      const k = w.broken ? 0.55 : 1;
      const p1 = add(p0, [0, 0, tall * 0.6 * k + tall * 0.1]);
      const tilt: V3 = [Math.cos(a), Math.sin(a), 0];
      const p2 = add(p1, add(mul(tilt, w.broken ? tall * 0.3 : tall * 0.04), [0, 0, w.broken ? tall * 0.22 : tall * 0.35]));
      const r = radius(z0);
      const at = limbs.length;
      limbs.push({ a: p0, b: p1, ra: r, rb: r * 0.6, order: 1, parent: pieceAt(z0), bough: at, dead: true });
      limbs.push({ a: p1, b: p2, ra: r * 0.6, rb: 0.12, order: 1, parent: at, bough: at, dead: true, tip: true });
    }
    // The stubs of the dead whorls up the bare leader.
    const top = b.bare ? topZ : crownTop + tall * 0.6;
    const from = b.bare ? stemZ : crownTop;
    const m = b.bare ? 11 : 2;
    for (let i = 0; i < m; i++) {
      const u = (i + 0.5) / m;
      const reach = H * b.spread * (1 - u * (1 - w.taper)) * (b.bare ? 0.35 + 0.5 * R() : 0.4 + 0.3 * R());
      stub(from + (top - from) * u, R() * TAU, reach * (b.bare ? 1 : 0.4), b.bare ? -0.15 + 0.5 * R() : -0.1 + 0.3 * R());
    }
  }

  /* ---- stubs on the bare trunk under the crown ---- */
  for (let i = 0; i < Math.round(w.stubs); i++) {
    const z = stemZ * (0.4 + 0.55 * R());
    stub(z, R() * TAU, H * b.spread * (0.18 + 0.2 * R()), -0.2 + 0.4 * R());
  }

  /* ---- the boughs ---- */
  const env: Envelope = { c: axis(stemZ + (crownTop - stemZ) * 0.4), r: H * b.spread, rz: Math.max(1, (H - stemZ) / 2) };
  const gap = n > 1 ? (crownTop - stemZ) / (n - 1) : H * 0.2;
  let a0 = R() * TAU;
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : i / (n - 1);
    const z = zs[i];
    const reachT = H * b.spread * (1 - (1 - w.taper) * u) * (0.92 + 0.16 * R());
    const m = Math.max(3, Math.round(w.pads * (1 - 0.4 * u)));
    a0 += 2.4;
    const piece = pieceAt(z);
    for (let j = 0; j < m; j++) {
      if (w.gaps > 0 && R() < w.gaps && i > 0) continue;
      const az = a0 + (j / m) * TAU + (R() - 0.5) * (TAU / m) * 0.5;
      const d: V3 = [Math.cos(az), Math.sin(az), 0];
      const reach = reachT * (1 + w.ragged * (R() - 0.5) * 0.6);
      const width = reach * w.width * (0.85 + 0.3 * R());
      // A whorl falls as one, whatever each bough's reach, so it hangs to one hem.
      let drop = (reach * 0.4 + reachT * 0.6) * b.droop * (0.9 + 0.2 * R());
      let hang = gap * w.hang * (0.85 + 0.3 * R());
      const root = add(axis(z), mul(d, radius(z) * 0.4));
      // Kept clear of the ground, and of the tiles in front of its own, which are laid after it (`hemAt`).
      const low = drop + hang * 2;
      const floor = Math.max(H * w.hem, hemAt(H, Math.hypot(root[0], root[1]) + reach * 1.15));
      if (root[2] - low < floor) {
        const k = Math.max(0.15, (root[2] - floor) / low);
        drop *= k;
        hang *= k;
      }
      const c = add(root, [d[0] * reach * 0.5, d[1] * reach * 0.5, -drop * 0.35]);
      clumps.push({
        c, r: reach * 0.55, limb: piece, k: R(), out: 1, up: n === 1 ? 1 : u,
        pad: { root: sub(root, c), d, reach, w: width, drop, hang, fingers: Math.max(3, Math.round(w.fingers - u * 2)) },
      });
    }
  }
  /* ---- the tuft on the top ---- */
  if (n > 0 && w.spire && w.deadTop >= 1) {
    const z = crownTop + gap * 0.15;
    const root = axis(z);
    const tall = H - z;
    const r = Math.max(1.2, H * b.spread * w.taper * 1.1);
    const c = add(root, [0, 0, tall * 0.3]);
    clumps.push({
      c, r: Math.max(r, tall * 0.35), limb: pieceAt(z), k: R(), out: 1, up: 1,
      pad: { root: sub(root, c), d: [1, 0, 0], reach: r, w: r, drop: tall, hang: gap * w.hang * 0.7, fingers: 5, spire: true },
    });
  }
  return {
    limbs, clumps, crown: env, height: H,
    rune: b.rune ? Math.PI / 4 + (R() - 0.5) * 0.5 : null,
    hollow: b.hollow ? Math.PI / 4 + 1.1 + (R() - 0.5) * 0.5 : null,
  };
}
