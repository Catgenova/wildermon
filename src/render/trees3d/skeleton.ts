/**
 * A tree's wood and where its leaf hangs, grown from a seed: a leaning,
 * bending trunk with a root flare that splits low into a few sinuous
 * scaffold limbs, branches off those spreading wide and hanging at their
 * ends, twigs off them, and sprays of leaf lying along the branches with the
 * twigs' ends poking out past them. The same seed is the same tree.
 */
import { mulberry32 } from '../../world/noise';
import type { Build, Clump, Envelope, Leaf, Limb, Skeleton, V3 } from './types';
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
      d[2] = order >= 3 ? Math.abs(d[2]) * 0.6 + 0.25 : d[2] * 0.7;
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
    const reach = 0.78 + 0.2 * R();
    const rise = -0.3 + 0.6 * R();
    let T: V3 = [env.c[0] + Math.cos(az) * env.r * reach, env.c[1] + Math.sin(az) * env.r * reach, env.c[2] + rise * rz];
    if (b.bare) T = lerp(B, T, 0.7);
    const L = len(sub(T, B));
    const out = unit([T[0] - B[0], T[1] - B[1], 0]);
    const side: V3 = [-out[1], out[0], 0];
    const wob = (R() - 0.5) * 2 * (0.3 + b.gnarl) * 0.3 * L;
    // Up out of the split first, then out across the crown, bending as it goes.
    const C1 = add(B, add(mul(out, 0.12 * L), [side[0] * wob, side[1] * wob, 0.42 * L]));
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

  /* ---- the leaf: sprays along the branches ---- */
  const clumps: Clump[] = [];
  if (!b.bare && b.clumps > 0) {
    const size = env.r * b.clumpSize;
    const spots: Array<{ c: V3; r: number; limb: number; along: V3; pri: number }> = [];
    for (let i = 0; i < limbs.length; i++) {
      const L = limbs[i];
      if (L.dead || L.order < 1 || (L.order === 1 && !L.tip && !limbs.some((m) => m.parent === i && m.order === 1 && m.tip))) continue;
      const l = len(sub(L.b, L.a));
      const along = unit([L.b[0] - L.a[0], L.b[1] - L.a[1], 0]);
      const k = L.order >= 4 ? 0.75 : L.order === 3 ? 0.95 : 1.15;
      // At the end of a twig, short of its tip so the tip shows; and down a long piece.
      const ts = L.tip ? [0.72] : l > size * 1.6 ? [0.35, 0.85] : [0.7];
      for (const t of ts) {
        const p = lerp(L.a, L.b, t);
        const r = size * k * (0.8 + 0.4 * R());
        spots.push({ c: [p[0], p[1], p[2] + r * 0.18], r, limb: i, along, pri: 0.4 * outOf(env, p) + (L.tip ? 0.15 : 0) + R() });
      }
    }
    spots.sort((p, q) => q.pri - p.pri);
    spots.length = Math.min(spots.length, Math.round(b.clumps));
    for (const s of spots) {
      const side: V3 = [-s.along[1], s.along[0], 0];
      const nl = Math.max(5, Math.round(b.leaves * Math.pow(s.r / size, 1.6)));
      const leaves: Leaf[] = [];
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < nl; i++) {
        const u = Math.sqrt(R());
        const phi = R() * TAU;
        const x = Math.cos(phi) * u * s.r, y = Math.sin(phi) * u * s.r * 0.72;
        // Domed over its middle, hanging at the end away from the limb's root.
        const z = s.r * 0.3 * (1 - u * u) - b.droop * s.r * 0.9 * Math.max(0, Math.cos(phi)) * u * u + (R() - 0.5) * s.r * 0.2;
        lo = Math.min(lo, z);
        hi = Math.max(hi, z);
        leaves.push({ p: add(add(mul(s.along, x), mul(side, y)), [0, 0, z]), s: (0.8 + 0.45 * R()) * (1 - 0.2 * u), top: z, k: R(), a: R() * TAU });
      }
      for (const lf of leaves) lf.top = (lf.top - lo) / Math.max(1e-6, hi - lo);
      leaves.sort((p, q) => p.top - q.top);
      clumps.push({
        c: s.c, r: s.r, leaves, limb: s.limb, k: R(),
        out: Math.min(1, outOf(env, s.c)),
        up: Math.max(0, Math.min(1, (s.c[2] - (env.c[2] - rz)) / (2 * rz))),
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
