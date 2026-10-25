/**
 * A fruit tree grown from a seed: a short, thick trunk on a flared foot,
 * wound round itself as it leans, splitting low into a few twisting limbs
 * that fan out and up; a broad, low dome of many small clusters round their
 * ends, each on its own branch, with twigs into its lumps and the ends of
 * the ones at the rim standing out past it. Every fruit tree is grown here,
 * to its own build (`./species/orchard`).
 */
import { mulberry32 } from '../../world/noise';
import { outOf } from './skeleton';
import type { Build, Clump, Envelope, Limb, Skeleton, V3 } from './types';
import { across, add, len, lerp, mul, sub, unit } from './vec';

const TAU = Math.PI * 2;
const GOLD = Math.PI * (3 - Math.sqrt(5));

export function growOrchard(b: Build, height: number, seed: number): Skeleton {
  const R = mulberry32(seed);
  const H = height;
  const stemZ = H * b.stem;
  const rz = (H - stemZ) * b.dome;
  const leanA = R() * TAU;
  const leanD: V3 = [Math.cos(leanA), Math.sin(leanA), 0];
  const env: Envelope = { c: [leanD[0] * b.lean, leanD[1] * b.lean, H - rz], r: H * b.spread, rz };
  const limbs: Limb[] = [];
  const r0 = H * b.girth;
  const zig = b.zig ?? 0.35;

  /* ---- the trunk: wound round the line of its lean, swelling to its foot and into its split ---- */
  const turns = b.twist ?? 0;
  const ph = R() * TAU;
  const coil = r0 * (0.2 + 0.55 * b.gnarl) * (turns > 0 ? 1 : 0.4);
  const trunkAt = (f: number): V3 => {
    const a = ph + turns * TAU * f;
    // Straight up out of its foot, winding from a third of the way up.
    const u = Math.max(0, Math.min(1, (f - 0.1) / 0.5));
    const k = coil * u * u * (3 - 2 * u);
    return [leanD[0] * b.lean * f + (Math.cos(a) - Math.cos(ph)) * k, leanD[1] * b.lean * f + (Math.sin(a) - Math.sin(ph)) * k, stemZ * f];
  };
  const trunkR = (f: number): number => r0 * (0.9 + 0.5 * Math.pow(Math.max(0, 1 - f / 0.24), 2) + 0.22 * Math.pow(f, 3));
  const FS = [0, 0.06, 0.14, 0.26, 0.4, 0.55, 0.7, 0.85, 1];
  const TRUNK = FS.length - 1;
  for (let i = 0; i < TRUNK; i++) {
    limbs.push({ a: trunkAt(FS[i]), b: trunkAt(FS[i + 1]), ra: trunkR(FS[i]), rb: trunkR(FS[i + 1]), order: 0, parent: i - 1, bough: -1, dead: b.bare });
  }
  const pieceAt = (f: number): number => Math.max(0, FS.findIndex((x) => x >= f) - 1);

  /* ---- roots: short and fat, the foot swelling out into the ground ---- */
  const roots = b.flare > 1.3 ? 4 + Math.round(R()) : 0;
  const rootA = R() * TAU;
  for (let i = 0; i < roots; i++) {
    const a = rootA + (i / roots) * TAU + (R() - 0.5) * 0.7;
    const bendA = a + (R() - 0.5) * 0.5;
    const reach = Math.min(r0 * b.flare * (0.75 + 0.25 * R()), 12);
    const top: V3 = [Math.cos(a) * r0 * 0.6, Math.sin(a) * r0 * 0.6, Math.min(r0 * 0.7, stemZ * 0.4) * (0.8 + 0.2 * R())];
    const knee: V3 = [Math.cos(a) * r0 * 1.1, Math.sin(a) * r0 * 1.1, r0 * (0.18 + 0.08 * R())];
    const end: V3 = [Math.cos(bendA) * reach, Math.sin(bendA) * reach, r0 * 0.02];
    const first = limbs.length;
    limbs.push({ a: top, b: knee, ra: r0 * 0.45, rb: r0 * 0.32, order: -1, parent: 0, bough: -1 });
    limbs.push({ a: knee, b: end, ra: r0 * 0.32, rb: r0 * 0.1, order: -1, parent: first, bough: -1 });
  }

  /** A crooked run from `a` to `z` in `k` elbows, each turned the other way across. */
  const crooked = (a: V3, z: V3, k: number, amp: number): V3[] => {
    const d = sub(z, a);
    const L = len(d) || 1;
    const side = across(mul(d, 1 / L));
    const up = unit(sub([0, 0, 1], mul(d, d[2] / (L * L))));
    const sgn = R() < 0.5 ? -1 : 1;
    const pts: V3[] = [a];
    for (let j = 1; j < k; j++) {
      const t = (j + (R() - 0.5) * 0.35) / k;
      const w = (j % 2 ? sgn : -sgn) * amp * L * (0.6 + 0.6 * R()) * Math.sin(Math.PI * t) ** 0.5 * Math.min(1, t * 2.2);
      const h = (R() - 0.3) * amp * L * 0.5;
      pts.push(add(add(add(a, mul(d, t)), mul(side, w)), mul(up, h)));
    }
    pts.push(z);
    return pts;
  };
  /** Points rounded into one curve through them (Catmull-Rom), `n` to a stretch. */
  const smooth = (pts: V3[], n: number): V3[] => {
    const out: V3[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let j = 1; j <= n; j++) {
        const t = j / n, t2 = t * t, t3 = t2 * t;
        const k = (q: number): number =>
          0.5 * (2 * p1[q] + (-p0[q] + p2[q]) * t + (2 * p0[q] - 5 * p1[q] + 4 * p2[q] - p3[q]) * t2 + (-p0[q] + 3 * p1[q] - 3 * p2[q] + p3[q]) * t3);
        out.push([k(0), k(1), k(2)]);
      }
    }
    return out;
  };
  /** A run of pieces along points, holding its thickness out toward its end and swelling `flare` more where it starts. */
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
  /** A fan of fine twigs off the end of piece `at`, `l` long, out along it and up. */
  const fan = (at: number, l: number, r: number, bough: number): void => {
    const P = limbs[at];
    const d = unit(sub(P.b, P.a));
    const side = across(d);
    const k = 2 + Math.floor(R() * 2);
    for (let j = 0; j < k; j++) {
      const sp = ((j + 0.5) / k - 0.5) * 1.6 + (R() - 0.5) * 0.3;
      const dir = unit(add(add(d, mul(side, Math.tan(sp))), [0, 0, 0.3]));
      run([P.b, add(P.b, mul(dir, l * (0.7 + 0.5 * R())))], r, r * 0.3, 4, at, bough, false);
    }
  };

  /* ---- the limbs: out of the split, each twisting up and out to its side of the crown ---- */
  const n = Math.max(1, Math.round(b.scaffolds));
  const stems = Math.min(n, Math.round(b.stems ?? 0));
  const a0 = R() * TAU;
  const azOf = [...Array(n).keys()].map((i) => a0 + (i / n) * TAU + (R() - 0.5) * (TAU / n) * 0.45);
  const deadOnes = new Set<number>();
  for (let k = 0; k < Math.min(n - 1, Math.round(b.dead)); k++) deadOnes.add(Math.floor(R() * n));
  const angle = (a: number, c: number): number => Math.abs(((a - c + Math.PI * 3) % TAU) - Math.PI);

  /* ---- where the clusters go: over a broad, low dome, a golden turn apart ---- */
  const want = Math.max(1, Math.round(b.clumps));
  const rm = env.r * b.clumpSize;
  const spots: Array<{ c: V3; az: number; el: number; size: number; hole?: boolean }> = [];
  const azR = R() * TAU;
  for (let j = 0; j < want; j++) {
    const s = 1 - ((j + 0.5) / want) * 1.12;
    // The first on the crown's top, big, so the dome has no hole in its middle.
    const el = j === 0 ? Math.PI / 2 : Math.asin(Math.max(-1, Math.min(1, s))) + (R() - 0.5) * 0.14;
    const az = azR + j * GOLD + (R() - 0.5) * 0.3;
    // Even over the dome; one in five in toward the heart, so it is never hollow.
    const inner = j === 0 || (j % 5 === 3 && el > 0.65);
    const k = j === 0 ? 0.9 : inner ? 0.45 + 0.15 * R() : 0.86 + 0.08 * R();
    const c: V3 = [env.c[0] + Math.cos(az) * Math.cos(el) * env.r * k, env.c[1] + Math.sin(az) * Math.cos(el) * env.r * k, env.c[2] + Math.sin(el) * rz * k];
    spots.push({ c, az, el, size: j === 0 ? 1.4 : inner ? 1.15 + 0.2 * R() : R() < 0.2 ? 1.2 + 0.2 * R() : 0.85 + 0.25 * R() });
  }
  // Gaps through the lower dome over a few of the limbs: their branches go on into them with nothing on them, and show.
  const holes = b.bare ? 0 : Math.min(n, Math.round(b.holes ?? 0));
  for (let h = 0; h < holes; h++) {
    const az = azOf[(h * 2 + Math.floor(R() * 2)) % n];
    spots.map((sp, k) => ({ k, d: angle(sp.az, az) }))
      .filter(({ k, d }) => d < 0.7 && spots[k].el < 0.35 && !spots[k].hole)
      .sort((p, q) => p.d - q.d).slice(0, 2)
      .forEach(({ k }) => { spots[k].hole = true; });
  }
  // Each to the living limb nearest round the trunk; a shrivelled tree's to any, grown to where its crown was.
  const mine: number[][] = azOf.map(() => []);
  spots.forEach((sp, k) => {
    let best = 0, bd = Infinity;
    azOf.forEach((a, i) => {
      const d = angle(sp.az, a) + (deadOnes.has(i) && !b.bare ? 9 : 0);
      if (d < bd) { bd = d; best = i; }
    });
    mine[best].push(k);
  });

  const clumps: Clump[] = [];
  for (let i = 0; i < n; i++) {
    const dead = b.bare || deadOnes.has(i);
    const stem = i < stems;
    // Each out of the trunk at a height of its own, so the split is not one knot; a shrub's stems out of its foot.
    const f = stem ? 0.04 + 0.08 * R() : 0.6 + 0.36 * ((i - stems + 0.5) / Math.max(1, n - stems)) + 0.04 * (R() - 0.5);
    const B = add(trunkAt(f), [Math.cos(azOf[i]) * trunkR(f) * 0.45, Math.sin(azOf[i]) * trunkR(f) * 0.45, 0]);
    // Out under its clusters, up into the crown; a dead one up and out through it.
    let az = azOf[i], out = env.r * 0.7, top = env.c[2];
    if (mine[i].length && !dead) {
      let sx = 0, sy = 0;
      out = 0; top = 0;
      for (const k of mine[i]) {
        const c = spots[k].c;
        sx += c[0] - B[0]; sy += c[1] - B[1]; top += c[2]; out += Math.hypot(c[0] - B[0], c[1] - B[1]);
      }
      az = Math.atan2(sy, sx);
      out /= mine[i].length;
      top /= mine[i].length;
    } else if (dead && !b.bare) {
      // Up and out through the top of the crown, standing clear of it.
      out = env.r * (0.75 + 0.15 * R());
      top = env.c[2] + rz * 1.2 + rm * (1.3 + 0.3 * R());
    }
    const reach = out * (dead && !b.bare ? 1 : 0.62 + 0.12 * R());
    const lift = (top - B[2]) * (dead && !b.bare ? 1 : 0.6 + 0.15 * R());
    const T: V3 = [B[0] + Math.cos(az) * reach, B[1] + Math.sin(az) * reach, B[2] + lift];
    // Up out of the split first, then out: through a knee over its start.
    const knee = add(lerp(B, T, 0.3), [0, 0, lift * 0.22]);
    const pts = smooth(crooked(B, knee, 2, zig * 0.3).concat(crooked(knee, T, 3, zig * 0.32).slice(1)), 2);
    const rb = trunkR(f) * (stem ? 0.42 : 0.55) * (0.9 + 0.2 * R());
    const pieces = run(pts, rb, rb * 0.42, 1, stem ? 0 : pieceAt(f), i, dead, 0.3);
    // A dead limb carries its broken branches and nothing else.
    if (dead && !b.bare) {
      for (const p of pieces.filter((_, k) => k % 3 === 2).slice(1)) {
        const P = limbs[p];
        const ta = az + (R() - 0.5) * 1.8;
        const tl = env.r * (0.18 + 0.12 * R());
        run(crooked(P.b, add(P.b, mul(unit([Math.cos(ta), Math.sin(ta), 0.3 + 0.5 * R()]), tl)), 2, zig * 0.3), P.rb * 0.6, P.rb * 0.25, 2, p, i, true);
      }
      continue;
    }
    for (const k of mine[i]) {
      const s = spots[k];
      // From the elbow of the limb nearest its cluster, into it.
      let at = pieces[pieces.length - 1], bd = Infinity;
      for (const p of pieces.slice(2)) {
        const dd = len(sub(limbs[p].b, s.c));
        if (dd < bd) { bd = dd; at = p; }
      }
      const P = limbs[at];
      const R0 = rm * s.size;
      const end: V3 = dead ? lerp(P.b, s.c, 0.8) : [s.c[0], s.c[1], s.c[2] - R0 * 0.25];
      const r = Math.max(0.15, P.rb * (0.6 + 0.15 * R()));
      const bp = run(smooth(crooked(P.b, end, 3, zig * 0.22), 2), r, r * 0.32, 2, at, i, dead, 0.4);
      const last = bp[bp.length - 1];
      // A cluster: a middle lump and a few round it, leaning out of the crown.
      const subs: Array<{ o: V3; r: number }> = [{ o: [0, 0, R0 * 0.08], r: R0 * 0.6 }];
      const ns = 3 + Math.floor(R() * 2);
      const outA = Math.atan2(s.c[1] - env.c[1], s.c[0] - env.c[0]);
      for (let j = 0; j < ns; j++) {
        const a = outA + ((j + 0.5) / ns - 0.5) * 4 + (R() - 0.5) * 0.6;
        const d = R0 * (0.42 + 0.2 * R());
        subs.push({ o: [Math.cos(a) * d, Math.sin(a) * d, R0 * (R() - 0.35) * 0.75], r: R0 * (0.36 + 0.16 * R()) });
      }
      const rim = outOf(env, s.c) > 0.7;
      for (const u of subs.slice(1)) {
        if (b.forks < 2 || dead) break;
        const tip = add(s.c, u.o);
        const from = limbs[last].b;
        const tp = run(crooked(from, tip, 2, zig * 0.15), r * 0.3, r * 0.08, 3, last, i, false);
        fan(tp[tp.length - 1], u.r * 0.9, r * 0.06, i);
      }
      // At the rim, a twig or two through the cluster and out past its edge, which shows in leaf (`Limb.poke`).
      if (rim && !dead && b.forks >= 2) {
        const o = unit([s.c[0] - env.c[0], s.c[1] - env.c[1], (s.c[2] - env.c[2]) * 0.6 + rz * 0.3]);
        // About one rim cluster in two.
        if (R() < 0.5) {
          const d = unit(add(o, [(R() - 0.5) * 0.9, (R() - 0.5) * 0.9, (R() - 0.2) * 0.5]));
          const from = limbs[last].b;
          run(crooked(from, add(from, mul(d, R0 * (1.25 + 0.2 * R()))), 3, zig * 0.35), r * 0.1, r * 0.03, 3, last, i, false).forEach((q) => { limbs[q].poke = true; });
        }
      }
      if (!dead && !s.hole) {
        clumps.push({
          c: s.c, r: R0, limb: last, k: R(), subs,
          out: Math.min(1, outOf(env, s.c)),
          up: Math.max(0, Math.min(1, (s.c[2] - (env.c[2] - rz)) / (2 * rz))),
        });
      }
    }
  }
  for (let i = 0; i < limbs.length; i++) {
    const L = limbs[i];
    if (L.order >= 1 && !limbs.some((m) => m.parent === i)) L.tip = true;
  }
  const toward = (a: number): number => a + (R() - 0.5) * 0.5;
  return {
    limbs, clumps, crown: env, height: H, leafReach: 1.22,
    rune: b.rune ? toward(Math.PI / 4) : null,
    hollow: b.hollow ? toward(Math.PI / 4 + 1.1) : null,
  };
}
