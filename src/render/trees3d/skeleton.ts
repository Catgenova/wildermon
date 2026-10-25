/**
 * A tree's wood and where its leaf hangs, grown from a seed: a leaning,
 * bending trunk with a root flare that splits low into a few sinuous
 * scaffold limbs, branches off those spreading wide and hanging at their
 * ends, twigs off them, and sprays of leaf lying along the branches with the
 * twigs' ends poking out past them. The same seed is the same tree.
 */
import { mulberry32 } from '../../world/noise';
import { HALF_H, HEIGHT_SCALE, UNITS_PER_TILE } from '../iso';
import type { Build, Clump, Envelope, Limb, Skeleton, Strand, V3, Weep, Whorls } from './types';
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
  if (b.habit === 'spreading') return growSpreading(b, height, seed);
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

/* ---- a spreading tree ---- */

/**
 * A spreading tree, grown from a seed, crown first: its masses of leaf set
 * round the top of a broad, low ellipsoid with gaps between them; a short,
 * massive trunk on buttress roots splitting low into a few thick, crooked
 * limbs, each taking the masses on its side of the crown -- the lowest
 * reaching out near level -- and a crooked branch from a limb's elbow into
 * each mass, with twigs off its end.
 */
export function growSpreading(b: Build, height: number, seed: number): Skeleton {
  const R = mulberry32(seed);
  const H = height;
  const stemZ = H * b.stem;
  const rz = (H - stemZ) * b.dome;
  const leanA = R() * TAU;
  const leanD: V3 = [Math.cos(leanA), Math.sin(leanA), 0];
  const sideD: V3 = [-leanD[1], leanD[0], 0];
  const env: Envelope = { c: [leanD[0] * b.lean, leanD[1] * b.lean, H - rz], r: H * b.spread, rz };
  const limbs: Limb[] = [];
  const r0 = H * b.girth;
  const zig = b.zig ?? 0.5;

  /* ---- the trunk: short and thick, swelling to its foot ---- */
  const bend = (R() - 0.5) * 2 * b.gnarl * r0 * 0.8;
  // An S-bent trunk sways one way low and back the other higher up, its lean taken up past half way.
  const sb = (b.sBend ?? 0) * r0 * (R() < 0.5 ? -1 : 1);
  const trunkAt = (f: number): V3 => {
    const s = Math.sin(f * Math.PI) * bend + Math.sin(f * TAU) * sb;
    const l = b.lean * (sb ? Math.sin((f * Math.PI) / 2) ** 1.5 : f);
    return [leanD[0] * l + sideD[0] * s, leanD[1] * l + sideD[1] * s, stemZ * f];
  };
  // Swelling into the ground at its foot and again into the limbs at its split.
  const trunkR = (f: number): number => r0 * (0.88 + 0.45 * Math.pow(Math.max(0, 1 - f / 0.28), 2) + 0.2 * Math.pow(f, 3));
  // Closer together low down, where it flares.
  const FS = sb ? [0, 0.07, 0.16, 0.27, 0.38, 0.5, 0.62, 0.74, 0.87, 1] : [0, 0.07, 0.16, 0.3, 0.5, 0.75, 1];
  const TRUNK = FS.length - 1;
  for (let i = 0; i < TRUNK; i++) {
    const f0 = FS[i], f1 = FS[i + 1];
    // A dead willow is a pale snag, its trunk dead wood too.
    limbs.push({ a: trunkAt(f0), b: trunkAt(f1), ra: trunkR(f0), rb: trunkR(f1), order: 0, parent: i - 1, bough: -1, dead: b.bare && !!b.weep });
  }

  /* ---- buttress roots: short and fat, the trunk's foot swelling out into the ground ---- */
  // Only a trunk with a real flare has roots to show past it.
  const roots = b.flare > 1.5 ? 4 + Math.round(R()) : 0;
  const rootA = R() * TAU;
  const rootTop = Math.min(r0 * 1.1, stemZ * 0.5);
  for (let i = 0; i < roots; i++) {
    const a = rootA + (i / roots) * TAU + (R() - 0.5) * 0.6;
    const bendA = a + (R() - 0.5) * 0.4;
    // Kept on its own tile: the ground in front is laid over whatever reaches past it.
    const reach = Math.min(r0 * b.flare * (0.62 + 0.2 * R()), 17);
    const top: V3 = [Math.cos(a) * r0 * 0.7, Math.sin(a) * r0 * 0.7, rootTop * (0.8 + 0.2 * R())];
    const knee: V3 = [Math.cos(a) * r0 * 1.2, Math.sin(a) * r0 * 1.2, r0 * (0.25 + 0.1 * R())];
    const end: V3 = [Math.cos(bendA) * reach, Math.sin(bendA) * reach, r0 * 0.03];
    const first = limbs.length;
    limbs.push({ a: top, b: knee, ra: r0 * 0.78, rb: r0 * 0.55, order: -1, parent: 0, bough: -1 });
    limbs.push({ a: knee, b: end, ra: r0 * 0.55, rb: r0 * 0.24, order: -1, parent: first, bough: -1 });
  }

  /** A crooked run from `a` to `z` in `k` elbows, each turned the other way across: its points. */
  const crooked = (a: V3, z: V3, k: number, amp: number): V3[] => {
    const d = sub(z, a);
    const L = len(d) || 1;
    const u = mul(d, 1 / L);
    const side = across(u);
    const up = unit(sub([0, 0, 1], mul(u, u[2])));
    const sgn = R() < 0.5 ? -1 : 1;
    const pts: V3[] = [a];
    for (let j = 1; j < k; j++) {
      const t = (j + (R() - 0.5) * 0.35) / k;
      // Straight out of what it grows from, crooked further along.
      const w = (j % 2 ? sgn : -sgn) * amp * L * (0.6 + 0.6 * R()) * Math.sin(Math.PI * t) ** 0.5 * Math.min(1, t * 2.2);
      const h = (R() - 0.3) * amp * L * 0.5;
      pts.push(add(add(add(a, mul(d, t)), mul(side, w)), mul(up, h)));
    }
    pts.push(z);
    return pts;
  };
  /** A crooked run's elbows rounded off into one curve (Catmull-Rom), `sub` points to a stretch. */
  const smooth = (pts: V3[], sub: number): V3[] => {
    const out: V3[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let j = 1; j <= sub; j++) {
        const t = j / sub, t2 = t * t, t3 = t2 * t;
        const k = (q: number): number =>
          0.5 * (2 * p1[q] + (-p0[q] + p2[q]) * t + (2 * p0[q] - 5 * p1[q] + 4 * p2[q] - p3[q]) * t2 + (-p0[q] + 3 * p1[q] - 3 * p2[q] + p3[q]) * t3);
        out.push([k(0), k(1), k(2)]);
      }
    }
    return out;
  };
  /** A crooked run rounded off: twisting rather than kinked. */
  const curve = (a: V3, z: V3, k: number, amp: number, sub: number): V3[] => smooth(crooked(a, z, k, amp), sub);
  /**
   * A run of pieces along points, `ra` thick at its start to `rb` at its end:
   * holding its thickness out to its forks rather than thinning evenly, and
   * swelling `flare` more where it grows out of what it is on.
   */
  const run = (pts: V3[], ra: number, rb: number, order: number, parent: number, bough: number, dead: boolean, flare = 0): number[] => {
    const out: number[] = [];
    const along = [0];
    for (let i = 1; i < pts.length; i++) along.push(along[i - 1] + len(sub(pts[i], pts[i - 1])));
    const total = along[along.length - 1] || 1;
    const rAt = (i: number): number => {
      const t = along[i] / total;
      return rb + (ra - rb) * Math.pow(1 - t, 0.75) + ra * flare * Math.pow(Math.max(0, 1 - t / 0.22), 2);
    };
    let up = parent;
    for (let i = 1; i < pts.length; i++) {
      const idx = limbs.length;
      limbs.push({ a: pts[i - 1], b: pts[i], ra: rAt(i - 1), rb: rAt(i), order, parent: up, bough, dead });
      out.push(idx);
      up = idx;
    }
    return out;
  };

  /* ---- the limbs round the trunk: some low, reaching out near level ---- */
  const n = Math.max(1, Math.round(b.scaffolds));
  const a0 = R() * TAU;
  const lowN = Math.round(n * (b.low ?? 0.4));
  const lowOnes = new Set<number>();
  for (let k = 0; k < lowN; k++) lowOnes.add(Math.floor(((k + 0.5) / Math.max(1, lowN)) * n));
  const highs = [...Array(n).keys()].filter((i) => !lowOnes.has(i));
  const deadOnes = new Set<number>();
  for (let k = 0; k < Math.min(highs.length, Math.round(b.dead)); k++) deadOnes.add(highs[Math.floor(R() * highs.length)]);
  const azOf = [...Array(n).keys()].map((i) => a0 + (i / n) * TAU + (R() - 0.5) * (TAU / n) * 0.4);
  const angle = (a: number, c: number): number => Math.abs(((a - c + Math.PI * 3) % TAU) - Math.PI);

  /** A fan of fine twigs off the tip of piece `at`, `l` long, out along it and up. */
  const fan = (at: number, l: number, r: number, bough: number): void => {
    const P = limbs[at];
    const d = unit(sub(P.b, P.a));
    const side = across(d);
    const k = 3 + Math.floor(R() * 2);
    for (let j = 0; j < k; j++) {
      const sp = ((j + 0.5) / k - 0.5) * 1.8 + (R() - 0.5) * 0.3;
      const dir = unit(add(add(d, mul(side, Math.tan(sp))), [0, 0, 0.25]));
      const end = add(P.b, mul(dir, l * (0.7 + 0.5 * R())));
      run([P.b, end], r, r * 0.3, 4, at, bough, false);
    }
  };

  /* ---- where the masses go: a skirt of them out on each low limb, the rest round the top of the crown ---- */
  // A shrivelled tree is grown to where its crown was, so its wood is the living tree's.
  const want = Math.max(1, Math.round(b.clumps));
  const rm = env.r * b.clumpSize;
  const spots: Array<{ c: V3; az: number; el: number }> = [];
  const mine: number[][] = azOf.map(() => []);
  const at = (az: number, el: number, k: number): V3 =>
    [env.c[0] + Math.cos(az) * Math.cos(el) * env.r * k, env.c[1] + Math.sin(az) * Math.cos(el) * env.r * k, env.c[2] + Math.sin(el) * rz * k];
  const skirt = Math.min(want - 1, lowN * 2);
  for (let j = 0; j < skirt; j++) {
    const i = [...lowOnes][j % lowN];
    const az = azOf[i] + (j < lowN ? -1 : 1) * (0.22 + 0.12 * R());
    const el = -0.5 + 0.3 * R();
    mine[i].push(spots.length);
    spots.push({ c: at(az, el, 0.92 + 0.1 * R()), az, el });
  }
  const GOLD = Math.PI * (3 - Math.sqrt(5));
  const azR = R() * TAU;
  const dome = b.weep ? 0 : want - skirt;
  // A weeping crown: a lobe out on the end of each limb round the dome, and its tops over the middle on the nearest.
  if (b.weep) {
    for (let i = 0; i < n; i++) {
      const az = azOf[i] + (R() - 0.5) * 0.3, el = 0.1 + 0.3 * R();
      mine[i].push(spots.length);
      spots.push({ c: at(az, el, 0.74 + 0.1 * R()), az, el });
    }
    for (let j = 0; j < b.weep.tops; j++) {
      const az = azR + (j * TAU) / Math.max(1, b.weep.tops), el = 1.15 + 0.25 * R();
      let best = 0, bd = Infinity;
      azOf.forEach((a, i) => {
        const d = angle(az, a) + (deadOnes.has(i) ? 9 : 0);
        if (d < bd) { bd = d; best = i; }
      });
      mine[best].push(spots.length);
      spots.push({ c: at(az, el, 0.8 + 0.15 * R()), az, el });
    }
  }
  for (let j = 0; j < dome; j++) {
    // Even over the shell from its top down to its middle, a golden turn apart.
    const s = 1 - ((j + 0.5) / dome) * (lowN ? 1.05 : 1.45);
    const el = Math.asin(Math.max(-1, Math.min(1, s))) + (R() - 0.5) * 0.18;
    const az = azR + j * GOLD + (R() - 0.5) * 0.35;
    // Each to the upper limb nearest round the trunk.
    let best = 0, bd = Infinity;
    azOf.forEach((a, i) => {
      const d = angle(az, a) + (lowOnes.has(i) && highs.length ? 9 : 0);
      if (d < bd) { bd = d; best = i; }
    });
    mine[best].push(spots.length);
    // Every third one in toward the middle, filling the lower heart of the crown; the rest out at its edge, the
    // top ones at heights of their own so the crown's outline is lumpy, with sky between them.
    const inner = j % 3 === 1 && el < 0.7;
    spots.push({ c: at(az, el, inner ? 0.42 + 0.15 * R() : el > 1.0 ? 0.55 + 0.3 * R() : 0.8 + 0.15 * R()), az, el });
  }
  // A living tree has leaf on every limb: one with none takes the nearest mass round the trunk from the limb with most.
  if (!b.bare) {
    for (let i = 0; i < n; i++) {
      if (mine[i].length || deadOnes.has(i)) continue;
      const from = mine.reduce((m, l, j) => (l.length > mine[m].length ? j : m), 0);
      if (mine[from].length < 2) continue;
      let best = 0;
      mine[from].forEach((k, q) => { if (angle(spots[k].az, azOf[i]) < angle(spots[mine[from][best]].az, azOf[i])) best = q; });
      mine[i].push(mine[from].splice(best, 1)[0]);
    }
  }
  // A few big masses, anywhere over the dome; the rest small, the skirts' between.
  const sizes = spots.map((sp, k) => (b.weep ? (sp.el > 1 ? 0.85 : 1) + 0.2 * R() : k < skirt ? 1.15 + 0.25 * R() : 0.85 + 0.3 * R()));
  // A few big ones, never the very top: a crown's top is several clumps at heights of their own, not one slab.
  if (!b.weep) for (let k = skirt; k < spots.length; k++) if (spots[k].el < 1.0 && (R() < 0.3 || k === skirt + 2)) sizes[k] = 1.4 + 0.35 * R();
  const whips: NonNullable<Skeleton['whips']> = [];
  const clumps: Clump[] = [];
  for (let i = 0; i < n; i++) {
    const low = lowOnes.has(i);
    // Each starts at its own height and out on its own side of the trunk, so the split is not one knot.
    const rank = (low ? [...lowOnes] : highs).indexOf(i), many = low ? lowN : highs.length;
    const f = low ? 0.5 + 0.25 * ((rank + 0.5) / Math.max(1, many)) + 0.05 * R() : 0.74 + 0.24 * ((rank + 0.5) / Math.max(1, many)) + 0.03 * R();
    const B = add(trunkAt(f), [Math.cos(azOf[i]) * trunkR(f) * 0.4, Math.sin(azOf[i]) * trunkR(f) * 0.4, 0]);
    const dead = b.bare || deadOnes.has(i);
    // Out under its masses: a low limb near level to the rim, the rest up into the crown.
    let az = azOf[i], out = 0, top = 0;
    if (mine[i].length) {
      let sx = 0, sy = 0;
      for (const k of mine[i]) { sx += spots[k].c[0] - B[0]; sy += spots[k].c[1] - B[1]; top += spots[k].c[2]; out += Math.hypot(spots[k].c[0] - B[0], spots[k].c[1] - B[1]); }
      az = Math.atan2(sy, sx);
      out /= mine[i].length;
      top /= mine[i].length;
    } else {
      // No masses on it (a bare tree): out and up into where its crown was, broken back.
      out = env.r * (low ? 1 : 0.85);
      top = env.c[2] + (low ? 0 : rz * 0.4);
    }
    // Out under its masses, so its end is in their leaf.
    const reach = out * (low ? 0.8 + 0.1 * R() : mine[i].length ? 0.75 + 0.15 * R() : 0.9 + 0.2 * R());
    const lift = !mine[i].length ? (low ? stemZ * (0.4 + 0.4 * R()) : (top - B[2]) * (0.55 + 0.25 * R()))
      : low ? Math.max(stemZ * 0.15, top - B[2] - rm * 0.45) : (top - B[2]) * (0.72 + 0.12 * R());
    const T: V3 = [B[0] + Math.cos(az) * reach, B[1] + Math.sin(az) * reach, B[2] + lift];
    const pts = curve(B, T, 4, zig * 0.26, 3);
    // A low limb sags between its elbows and turns up at its end.
    if (low) for (let j = 1; j < pts.length - 1; j++) pts[j][2] -= Math.sin((j / (pts.length - 1)) * Math.PI) * reach * b.droop * 0.25;
    const rb = trunkR(f) * (0.55 + 0.1 * R());
    const pieces = run(pts, rb, rb * 0.4, 1, Math.max(0, FS.findIndex((x) => x >= f) - 1), i, dead, 0.3);
    // A branch from the elbow nearest each of its masses, into it.
    for (const k of mine[i]) {
      const s = spots[k];
      let at = pieces[pieces.length - 1], bd = Infinity;
      for (const p of pieces.slice(1)) {
        const dd = len(sub(limbs[p].b, s.c));
        if (dd < bd) { bd = dd; at = p; }
      }
      const P = limbs[at];
      // Dead, it still reaches most of the way, and ends snapped off.
      const end: V3 = dead ? lerp(P.b, s.c, 0.82) : [s.c[0], s.c[1], s.c[2] - rm * 0.25];
      const r = Math.max(0.15, P.rb * (0.55 + 0.15 * R()));
      const bp = run(curve(P.b, end, 3, zig * 0.2, 2), r, r * 0.32, 2, at, i, dead, 0.45);
      const last = bp[bp.length - 1];
      // A cluster: a few big, many small; the big ones high in the crown.
      const big = sizes[k] > 1.15;
      const R0 = rm * sizes[k];
      const subs: Array<{ o: V3; r: number }> = [{ o: [0, 0, R0 * 0.05], r: R0 * (big ? 0.58 : 0.64) }];
      const ns = big ? 3 + Math.floor(R() * 2) : 2 + Math.floor(R() * 1.5);
      const outA = Math.atan2(s.c[1] - env.c[1], s.c[0] - env.c[0]);
      for (let j = 0; j < ns; j++) {
        // Round it, leaning out of the crown, a little up or down.
        const a = outA + ((j + 0.5) / ns - 0.5) * 3.6 + (R() - 0.5) * 0.6;
        const d = R0 * (0.45 + 0.2 * R());
        subs.push({ o: [Math.cos(a) * d, Math.sin(a) * d, R0 * (R() - 0.3) * 0.8], r: R0 * (0.36 + 0.18 * R()) });
      }
      // A twig into each lump, fanning at its end; a dead one's snapped off short.
      for (const u of subs.slice(1)) {
        // A dead branch has lost its twigs: it ends in a broken stub.
        if (b.forks < 2 || dead) break;
        const tip: V3 = add(s.c, u.o);
        const from = limbs[last].b;
        const tp = run(crooked(from, dead ? lerp(from, tip, 0.45) : tip, 2, zig * 0.12), r * 0.3, r * (dead ? 0.16 : 0.07), 3, last, i, dead);
        if (!dead) fan(tp[tp.length - 1], u.r * 0.9, r * 0.06, i);
      }
      if (!dead) {
        clumps.push({
          c: s.c, r: R0, limb: last, k: R(), subs,
          out: Math.min(1, outOf(env, s.c)),
          up: Math.max(0, Math.min(1, (s.c[2] - (env.c[2] - rz)) / (2 * rz))),
          curtain: b.weep ? curtainOf(b.weep, s.c, R0, env, H, R) : undefined,
        });
      } else if (b.weep && b.bare) {
        // A dead willow keeps a few limp strands off the ends of its branches.
        const e = limbs[last].b;
        for (let j = 0; j < 2; j++) if (R() < 0.7) whips.push({ o: add(e, [(R() - 0.5) * 2, (R() - 0.5) * 2, 0]), len: Math.max(2, (e[2] - H * 0.3) * (0.35 + 0.45 * R())), k: R() });
      }
    }
    // A limb with nothing on it -- a dead one, a bare tree's -- still forks at its elbows.
    if (!mine[i].length) {
      // At its elbows: every third point of the rounded run.
      for (const p of pieces.filter((_, k) => k % 3 === 2)) {
        const P = limbs[p];
        const ta = az + (R() - 0.5) * 1.6;
        const tl = env.r * (0.26 + 0.16 * R());
        const tip = add(P.b, mul(unit([Math.cos(ta), Math.sin(ta), 0.25 + 0.5 * R()]), tl));
        const r = Math.max(0.15, P.rb * 0.6);
        const bp = run(curve(P.b, tip, 2, zig * 0.3, 2), r, r * 0.4, 2, p, i, dead, 0.45);
        if (b.forks >= 2) {
          const last = limbs[bp[bp.length - 1]];
          run(crooked(last.b, add(last.b, mul(unit([Math.cos(ta + 0.8), Math.sin(ta + 0.8), 0.5]), tl * 0.5)), 2, zig * 0.25), r * 0.38, r * 0.1, 3, bp[bp.length - 1], i, dead);
        }
      }
    }
  }
  for (let i = 0; i < limbs.length; i++) {
    const L = limbs[i];
    if (L.order >= 1 && !limbs.some((m) => m.parent === i)) L.tip = true;
  }
  const toward = (a: number): number => a + (R() - 0.5) * 0.5;
  return {
    limbs, clumps, crown: env, height: H, leafReach: 1.22, whips: whips.length ? whips : undefined,
    rune: b.rune ? toward(Math.PI / 4) : null,
    hollow: b.hollow ? toward(Math.PI / 4 + 1.1) : null,
  };
}

/**
 * The strands round a weeping lobe of radius `r` at `c`: rooted round its
 * upper rim, arched out over it and hanging straight down, the longest to
 * `w.hem` of the height and each its own length short of that; few on the
 * side turned in to the trunk, where they would be hidden.
 */
function curtainOf(w: Weep, c: V3, r: number, env: Envelope, H: number, R: () => number): Strand[] {
  const out: Strand[] = [];
  const ox = c[0] - env.c[0], oy = c[1] - env.c[1];
  const ol = Math.hypot(ox, oy);
  // A lobe over the middle of the crown hangs all round; one out on a limb mostly on its outer side.
  const inner = ol > env.r * 0.3;
  const n = Math.max(6, Math.round(((TAU * r * 0.85) / (w.width * 2)) * w.fill));
  const a0 = R() * TAU;
  // A gap or two in each curtain, where the inside of the crown shows.
  const gaps = [R() * TAU, R() < 0.6 ? R() * TAU : 99];
  const gapW = (TAU / n) * 1.6;
  for (let j = 0; j < n; j++) {
    const a = a0 + (j / n) * TAU + (R() - 0.5) * (TAU / n) * 0.7;
    if (gaps.some((g) => Math.abs(((a - g + Math.PI * 3) % TAU) - Math.PI) < gapW)) continue;
    const facing = inner ? (Math.cos(a) * ox + Math.sin(a) * oy) / ol : 1;
    if (facing < -0.25 && R() < 0.75) continue;
    const rho = r * (0.55 + 0.25 * R());
    const zr = r * (0.05 + 0.28 * R());
    const arch = r * (0.32 + 0.16 * R());
    const tx = c[0] + Math.cos(a) * (rho + arch), ty = c[1] + Math.sin(a) * (rho + arch);
    // Ragged: most near the hem, some well short of it; the longest out at the rim, those further in shorter.
    const edge = Math.min(1, Math.hypot(tx, ty) / (env.r * 1.2));
    const want = H * (w.hem + 0.3 * (1 - edge) ** 2 + w.ragged * Math.pow(R(), 1.6));
    const tip = Math.max(want, hemAt(H, Math.hypot(tx, ty) + w.width));
    const len = c[2] + zr - tip;
    if (len < r * 0.4) continue;
    out.push({ o: [Math.cos(a) * rho, Math.sin(a) * rho, zr], a, arch, len, w: w.width * (0.8 + 0.4 * R()), k: R() });
  }
  return out;
}

/* ---- the wind ---- */

/** Which way the wind pushes, along the ground. */
export const WIND: V3 = unit([1, -0.35, 0]);

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
  const crownTop = b.bare ? stemZ : H * (w.deadTop < 1 ? w.deadTop : w.spire ? 0.86 : 0.97);
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
  for (let i = 0; i < n; i++) zs.push(stemZ + (crownTop - stemZ) * (n === 1 ? 0 : i / (n - 1)));
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

  /* ---- stubs on the bare trunk under the crown, and every other one out through the crown ---- */
  for (let i = 0; i < Math.round(w.stubs); i++) {
    if (i % 2 && !b.bare && crownTop > stemZ) {
      const u = 0.2 + 0.6 * R();
      const z = stemZ + (crownTop - stemZ) * u;
      stub(z, R() * TAU, H * b.spread * (1 - (1 - w.taper) * u) * (1.05 + 0.25 * R()), 0.05 + 0.2 * R());
      continue;
    }
    const z = stemZ * (0.4 + 0.55 * R());
    stub(z, R() * TAU, H * b.spread * (0.25 + 0.25 * R()), -0.2 + 0.4 * R());
  }

  /* ---- the boughs ---- */
  const env: Envelope = { c: axis(stemZ + (crownTop - stemZ) * 0.4), r: H * b.spread, rz: Math.max(1, (H - stemZ) / 2) };
  const gap = n > 1 ? (crownTop - stemZ) / (n - 1) : H * 0.2;
  let a0 = R() * TAU;
  /**
   * A bough off the leader at `z`, pointing `az` round, `reach` long from the
   * leader to its tip; `whole` the reach of its whorl, `u` how far up the
   * crown. A bare branch runs out nearly level and carries a spray on its
   * outer part, which falls to a fingered end.
   */
  const bough = (z: number, az: number, reach: number, whole: number, u: number, fingers: number, further = 0): void => {
    const d: V3 = [Math.cos(az), Math.sin(az), 0];
    const out0 = radius(z) * 0.6 + reach * w.bare * (0.85 + 0.3 * R()) + further;
    reach += further;
    const sl = Math.max(1, reach - out0);
    const width = sl * w.width * (0.85 + 0.3 * R());
    // A whorl falls as one, whatever each bough's reach, so it hangs to one hem.
    let drop = (sl * 0.4 + whole * 0.6 * (1 - w.bare)) * b.droop * (0.9 + 0.2 * R());
    let hang = Math.min(gap * w.hang, sl * 0.35) * (0.85 + 0.3 * R());
    const base = axis(z);
    const root = add(base, [d[0] * out0, d[1] * out0, out0 * 0.04]);
    // Kept clear of the ground, and of the tiles in front of its own, which are laid after it (`hemAt`).
    const low = drop + hang * 2;
    const floor = Math.max(H * w.hem, hemAt(H, Math.hypot(root[0], root[1]) + sl * 1.15));
    if (root[2] - low < floor) {
      const k = Math.max(0.15, (root[2] - floor) / low);
      drop *= k;
      hang *= k;
    }
    const c = add(root, [d[0] * sl * 0.5, d[1] * sl * 0.5, -drop * 0.3]);
    const at = clumps.length;
    clumps.push({
      c, r: sl * 0.6, limb: pieceAt(z), k: R(), out: 1, up: u,
      pad: { root: sub(root, c), base: sub(base, c), d, reach: sl, w: width, drop, hang, fingers },
    });
    // Its branch, out to where the spray starts and a little under it.
    const r = Math.max(0.16, radius(z) * 0.22);
    const mid = add(lerp(base, root, 0.5), [0, 0, out0 * 0.03]);
    const end = add(root, [d[0] * sl * 0.2, d[1] * sl * 0.2, -drop * 0.04]);
    const i0 = limbs.length;
    limbs.push({ a: base, b: mid, ra: r, rb: r * 0.8, order: 3, parent: pieceAt(z), bough: i0, pad: at });
    limbs.push({ a: mid, b: root, ra: r * 0.8, rb: r * 0.6, order: 3, parent: i0, bough: i0, pad: at });
    limbs.push({ a: root, b: end, ra: r * 0.6, rb: r * 0.45, order: 3, parent: i0 + 1, bough: i0, pad: at, tip: true });
  };
  // A few boughs that stick out past the rest, low in the crown.
  const longs = new Set<number>();
  for (let k = 0; k < Math.round(w.long); k++) longs.add(Math.floor(n * (0.1 + 0.5 * R())) * 100 + Math.floor(R() * 6));
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : i / (n - 1);
    const reachT = H * b.spread * (1 - (1 - w.taper) * u) * (0.95 + 0.1 * R());
    const m = Math.max(3, Math.round(w.pads * (1 - 0.45 * u)));
    a0 += 2.4;
    for (let j = 0; j < m; j++) {
      if (w.gaps > 0 && R() < w.gaps && i > 0) continue;
      const az = a0 + (j / m) * TAU + (R() - 0.5) * (TAU / m) * 0.6;
      // A long bough is a longer bare branch with a spray of the usual size on its end.
      const further = longs.has(i * 100 + j) ? reachT * 0.35 : 0;
      bough(zs[i] + (R() - 0.5) * gap * 0.25, az, reachT * (1 + w.ragged * (R() - 0.5)), reachT, n === 1 ? 1 : u, Math.max(3, Math.round(w.fingers - u)), further);
    }
  }
  /* ---- a ragged tuft of small boughs on the leader over the top whorl, the leader's tip clear of it ---- */
  if (n > 0 && w.spire && w.deadTop >= 1) {
    const top = H * b.spread * w.taper;
    for (const [f, k, m] of [[0.28, 0.8, 5], [0.62, 0.45, 3]]) {
      a0 += 2.4;
      for (let j = 0; j < m; j++) bough(crownTop + (H - crownTop) * f, a0 + (j / m) * TAU + (R() - 0.5) * 0.8, top * k * (0.8 + 0.4 * R()), top * k, 1, 3);
    }
  }
  return {
    limbs, clumps, crown: env, height: H,
    rune: b.rune ? Math.PI / 4 + (R() - 0.5) * 0.5 : null,
    hollow: b.hollow ? Math.PI / 4 + 1.1 + (R() - 0.5) * 0.5 : null,
  };
}
