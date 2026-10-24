/**
 * A tree's wood and where its leaf hangs, grown from a seed: a leaning,
 * bending trunk with a root flare that splits low into a few sinuous
 * scaffold limbs, branches off those spreading wide and hanging at their
 * ends, twigs off them, and sprays of leaf lying along the branches with the
 * twigs' ends poking out past them. The same seed is the same tree.
 */
import { mulberry32 } from '../../world/noise';
import type { Build, Clump, Envelope, Limb, Skeleton, V3 } from './types';
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
  const trunkAt = (f: number): V3 => {
    const s = Math.sin(f * Math.PI) * bend;
    return [leanD[0] * b.lean * f + sideD[0] * s, leanD[1] * b.lean * f + sideD[1] * s, stemZ * f];
  };
  // Swelling into the ground at its foot and again into the limbs at its split.
  const trunkR = (f: number): number => r0 * (0.88 + 0.45 * Math.pow(Math.max(0, 1 - f / 0.28), 2) + 0.2 * Math.pow(f, 3));
  // Closer together low down, where it flares.
  const FS = [0, 0.07, 0.16, 0.3, 0.5, 0.75, 1];
  const TRUNK = FS.length - 1;
  for (let i = 0; i < TRUNK; i++) {
    const f0 = FS[i], f1 = FS[i + 1];
    limbs.push({ a: trunkAt(f0), b: trunkAt(f1), ra: trunkR(f0), rb: trunkR(f1), order: 0, parent: i - 1, bough: -1 });
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

  /* ---- where the masses go: a skirt of them out on each low limb, the rest round the top of the crown ---- */
  const want = b.bare ? 0 : Math.max(1, Math.round(b.clumps));
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
    spots.push({ c: at(az, el, 1.0 + 0.12 * R()), az, el });
  }
  const GOLD = Math.PI * (3 - Math.sqrt(5));
  const azR = R() * TAU;
  const dome = want - skirt;
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
    spots.push({ c: at(az, el, 0.7 + 0.2 * R()), az, el });
  }
  const clumps: Clump[] = [];
  for (let i = 0; i < n; i++) {
    const low = lowOnes.has(i);
    const f = low ? 0.62 + 0.2 * R() : 0.84 + 0.16 * R();
    const B = trunkAt(f);
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
    const reach = out * (low ? 0.8 + 0.1 * R() : mine[i].length ? 0.55 + 0.2 * R() : 0.9 + 0.2 * R());
    const lift = !mine[i].length ? (low ? stemZ * (0.4 + 0.4 * R()) : (top - B[2]) * (0.55 + 0.25 * R()))
      : low ? Math.max(stemZ * 0.15, top - B[2] - rm * 1.3) : (top - B[2]) * (0.42 + 0.2 * R());
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
      const end: V3 = dead ? lerp(P.b, s.c, 0.6) : [s.c[0], s.c[1], s.c[2] - rm * 0.25];
      const r = Math.max(0.15, P.rb * (0.55 + 0.15 * R()));
      const bp = run(curve(P.b, end, 3, zig * 0.2, 2), r, r * 0.4, 2, at, i, dead, 0.45);
      const last = bp[bp.length - 1];
      // Twigs off the end, out through the mass.
      const tw = 2 + Math.floor(R() * 2);
      for (let t = 0; t < tw && b.forks >= 2; t++) {
        const ta = s.az + (R() - 0.5) * 2.2;
        const tz = 0.3 + 0.7 * R();
        const tl = rm * (dead ? 0.5 : 0.85 + 0.3 * R());
        const tip: V3 = add(limbs[last].b, mul(unit([Math.cos(ta), Math.sin(ta), tz]), tl));
        run(crooked(limbs[last].b, tip, 2, zig * 0.12), r * 0.4, r * 0.15, 3, last, i, dead);
      }
      if (!dead) {
        // The top of the crown in the biggest masses, the rim in smaller.
        const cr = rm * (0.7 + 0.45 * Math.max(0, Math.sin(s.el)) + 0.3 * R());
        clumps.push({
          c: s.c, r: cr, limb: last, k: R(),
          out: Math.min(1, outOf(env, s.c)),
          up: Math.max(0, Math.min(1, (s.c[2] - (env.c[2] - rz)) / (2 * rz))),
        });
      }
    }
    // A limb with nothing on it -- a dead one, a bare tree's -- still forks at its elbows.
    if (!mine[i].length || b.bare) {
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
          run(crooked(last.b, add(last.b, mul(unit([Math.cos(ta + 0.8), Math.sin(ta + 0.8), 0.5]), tl * 0.5)), 2, zig * 0.25), r * 0.4, r * 0.15, 3, bp[bp.length - 1], i, dead);
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
    limbs, clumps, crown: env, height: H,
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
