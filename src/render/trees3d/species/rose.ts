/**
 * Rose bush: a knee-to-hip-high rounded shrub of arching canes under a few
 * overlapping lobes of glossy compound leaf, roses in clusters on its outer
 * and top faces, hips in autumn, bare thorny canes in winter. Its colours
 * and its year are `BUSH_DEFS`' rose and `bushYear`'s: the leaf, the
 * flowers and the hips are the day's `look`, the wood the flat bush's.
 */
import { mulberry32 } from '../../../world/noise';
import { FLOWER_COLOURS } from '../../flowers';
import { BUSH_WOOD } from '../../foliage';
import { KIT_INK, KIT_INK_W } from '../../kit/core';
import { proj } from '../../runestone';
import { mix, tone } from '../../trees/kit';
import { ACROSS, clumpLight, massPath, outlineOf, sunOnScreen, type Outline } from '../paint';
import type { Bush3D, BushJob, Clump, Limb, Ramp, Skeleton, V3 } from '../types';
import { add, dot, hex, mixRgb, mul, rgb, unit } from '../vec';

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];
const TAU = Math.PI * 2;

/* ---- the model ---------------------------------------------------------------------- */

/** The shrub's half-width and the height of its middle, in model units. */
const SPREAD = 8.8;
const MID = 3.2;

const bez = (a: V3, b: V3, c: V3, t: number): V3 => {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1], u * u * a[2] + 2 * u * t * b[2] + t * t * c[2]];
};

function grow(seed: number): Skeleton {
  const R = mulberry32(seed);
  const limbs: Limb[] = [];
  const clumps: Clump[] = [];
  const crown = { c: [0, 0, MID] as V3, r: SPREAD, rz: MID + 0.3 };
  /** A cane from `a`, bowed through `b`, to `c`, in `n` pieces tapering `ra` to `rb`; the index of its last piece. */
  const cane = (a: V3, b: V3, c: V3, n: number, ra: number, rb: number, order: number, parent: number, bough: number): number => {
    let prev = parent;
    for (let i = 0; i < n; i++) {
      const p = bez(a, b, c, i / n), q = bez(a, b, c, (i + 1) / n);
      limbs.push({ a: p, b: q, ra: ra + (rb - ra) * (i / n), rb: ra + (rb - ra) * ((i + 1) / n), order, parent: prev, bough, tip: i === n - 1 });
      prev = limbs.length - 1;
    }
    return prev;
  };
  // The lobes: one on top, the rest low round it, each a cluster of lumps.
  const n = 5;
  const a0 = R() * TAU;
  const lobes: Array<{ c: V3; r: number; a: number }> = [{ c: [(R() - 0.5) * 1.6, (R() - 0.5) * 1.6, MID + 2.6], r: 4.8 + 0.4 * R(), a: R() * TAU }];
  for (let i = 0; i < n - 1; i++) {
    const a = a0 + (i / (n - 1)) * TAU + (R() - 0.5) * 0.5;
    const d = SPREAD - 4.4 + 1.0 * R();
    lobes.push({ c: [Math.cos(a) * d, Math.sin(a) * d, MID + R() * 0.6], r: 4.5 + 0.5 * R(), a });
  }
  lobes.forEach((L, i) => {
    // Canes into each lobe from the crown at the foot: up and out, arching over, and down at its far side.
    let last = -1;
    const canes = i === 0 ? 2 : 3;
    for (let j = 0; j < canes; j++) {
      const fa = R() * TAU, fr = 0.3 + 1.0 * R();
      const f: V3 = [Math.cos(fa) * fr, Math.sin(fa) * fr, 0];
      const out = (i === 0 ? R() * TAU : Math.atan2(L.c[1] - f[1], L.c[0] - f[0])) + (j - (canes - 1) / 2) * 0.5 + (R() - 0.5) * 0.3;
      const reach = i === 0 ? 2.5 + 2 * R() : Math.hypot(L.c[0] - f[0], L.c[1] - f[1]) + L.r * (0.25 + 0.25 * R());
      const top: V3 = [f[0] + Math.cos(out) * reach * 0.4, f[1] + Math.sin(out) * reach * 0.4, L.c[2] + L.r * (i === 0 ? 0.5 : 0.55)];
      const end: V3 = [f[0] + Math.cos(out) * reach, f[1] + Math.sin(out) * reach, i === 0 ? L.c[2] + 0.5 : L.c[2] - L.r * 0.12];
      const k = cane(f, top, end, 5, 0.34 - 0.03 * j, 0.1, 1, -1, i * 3 + j);
      if (j === 0) last = k - 2;
      // Side shoots off its arch, out and up.
      for (const at of [k - 3, k - 1]) {
        const m = limbs[at].a;
        const o2 = out + (R() < 0.5 ? -1 : 1) * (0.5 + 0.8 * R());
        cane(m, add(m, [Math.cos(o2) * 0.9, Math.sin(o2) * 0.9, 1.2]), add(m, [Math.cos(o2) * 1.9, Math.sin(o2) * 1.9, 0.9 + R()]), 2, 0.15, 0.07, 2, at, i * 3 + j);
      }
    }
    const subs: Array<{ o: V3; r: number }> = [{ o: [0, 0, L.r * 0.08], r: L.r * 0.6 }];
    const ns = 3 + Math.floor(R() * 2);
    const outA = i === 0 ? R() * TAU : L.a;
    for (let j = 0; j < ns; j++) {
      const a = outA + ((j + 0.5) / ns - 0.5) * (i === 0 ? TAU : 3.8) + (R() - 0.5) * 0.5;
      const d = L.r * (0.42 + 0.18 * R());
      subs.push({ o: [Math.cos(a) * d, Math.sin(a) * d, L.r * (R() - 0.15) * 0.45], r: L.r * (0.42 + 0.14 * R()) });
    }
    const out = Math.hypot(L.c[0], L.c[1]) / SPREAD;
    clumps.push({ c: L.c, r: L.r, limb: Math.max(0, last), k: R(), out: Math.min(1, out + 0.3), up: Math.min(1, (L.c[2] - 1) / (MID + 2)), subs });
  });
  // Two long canes arching clear of the leaf, a rose or a hip at the end of each.
  for (let j = 0; j < 2; j++) {
    const a = a0 + (j + 0.5) * Math.PI + (R() - 0.5) * 0.8;
    const f: V3 = [(R() - 0.5) * 1.2, (R() - 0.5) * 1.2, 0];
    cane(f, [f[0] + Math.cos(a) * 3.2, f[1] + Math.sin(a) * 3.2, MID * 2.7], [Math.cos(a) * (SPREAD + 0.4), Math.sin(a) * (SPREAD + 0.4), MID * 1.3], 6, 0.24, 0.08, 1, -1, 20 + j);
  }
  return { limbs, clumps, crown, height: MID * 2 + 1, rune: null, hollow: null, leafReach: 1.5, foot: SPREAD * ACROSS * 0.72 };
}

/* ---- colours ------------------------------------------------------------------------ */

/** Seven tones from a leaf's two (`BUSH_DEFS` light and dark), the deepest a step under the dark and the top two glossy. */
const leafRamp = ([lit, deep]: readonly [string, string]): Ramp =>
  [mix(tone(deep, -0.3), '#1e2c3a', 0.25), tone(deep, -0.1), deep, mix(deep, lit, 0.5), lit, tone(lit, 0.2), tone(lit, 0.42)];

/** The gold of a rose's heart: the meadow's pink flower's eye. */
const EYE = FLOWER_COLOURS.find((c) => c.name === 'pink')?.eye ?? FLOWER_COLOURS[0].eye;

/** A flower's or a hip's tones from its one colour: shade, body, lit, and its deep heart. */
const bloomTones = (c: string, night: boolean): { shade: string; body: string; lit: string; deep: string; heart: string } => {
  const b = night ? mix(c, '#2a2a40', 0.4) : c;
  return { shade: mix(tone(b, -0.3), '#3a2a48', 0.15), body: tone(b, 0.1), lit: tone(b, night ? 0.15 : 0.55), deep: mix(tone(b, -0.38), '#5a2a3a', 0.2), heart: night ? mix(EYE, b, 0.6) : EYE };
};

/* ---- the leaf ----------------------------------------------------------------------- */

/** A leaflet's tip standing out of a lobe's edge: pointed, its sides a little full. */
const ROSE_EDGE: ReadonlyArray<Pt> = Array.from({ length: 5 }, (_, i) => {
  const u = i / 4;
  return [u, Math.pow(1 - Math.abs(2 * u - 1), 0.8)] as Pt;
});

/** A lump's outline: a little lumpy, and edged all round in small leaflet tips, `n` of them. */
function toothed(R: () => number, n: number): Outline {
  const o: Outline = { lumps: [0.05 + 0.04 * R(), R() * TAU, 0.03 + 0.03 * R(), R() * TAU], leaves: [] };
  const a0 = R() * TAU;
  for (let i = 0; i < n; i++) o.leaves.push({ at: a0 + ((i + 0.25 * R()) / n) * TAU, w: Math.min(TAU / n - 0.06, 0.42 + 0.14 * R()), h: 0.13 + 0.07 * R() });
  return o;
}

/** Each lump's outline, by its seed, worked out once: `toothed` with `n` tips, or lumpy with none. */
const outlines = new Map<number, Outline>();
function outlineAt(seed: number, n: number): Outline {
  const k = seed * 16 + n;
  let o = outlines.get(k);
  if (!o) {
    if (outlines.size > 4000) outlines.clear();
    outlines.set(k, (o = n ? toothed(mulberry32(seed), n) : outlineOf(mulberry32(seed), 0)));
  }
  return o;
}

/** A lump of a lobe on the screen. */
interface Lump { x: number; y: number; rx: number; ry: number; o: Outline; seed: number; n: V3; p: V3; r: number; near: number }

const PAD = 0.82;

/** A cane or a shoot on the screen: its points, its half-width at each, its nearness, its height at each, its order. */
interface Run { q: Pt[]; r: number[]; d: number; z: number[]; order: number; nx: number; ny: number }

/** One glossy leaflet: a pointed oval `s` long, turned `a`. */
function leaflet(p: Path2D, x: number, y: number, s: number, a: number): void {
  const ca = Math.cos(a), sa = Math.sin(a);
  const pt = (u: number, v: number): Pt => [x + u * ca - v * sa, y + (u * sa + v * ca) * 0.8];
  p.moveTo(...pt(-s / 2, 0));
  p.quadraticCurveTo(...pt(0, -s * 0.42), ...pt(s / 2, 0));
  p.quadraticCurveTo(...pt(0, s * 0.42), ...pt(-s / 2, 0));
  p.closePath();
}

/* ---- the painter ------------------------------------------------------------------------ */

function paint(g: Ctx, job: BushJob): void {
  const { sk, look, e, light } = job;
  const toward = unit(e.toward as V3);
  const near = (p: V3): number => dot(p, toward);
  const sun = sunOnScreen(job);
  const off = 1 - 0.55 * sun.front;
  const ink = rgb(KIT_INK);
  const winter = job.season === 'winter';
  const autumn = job.season === 'autumn';

  /* What of the leaf is out: every lobe in full leaf; coming out or coming down, smaller, and the last of autumn's gone. */
  const ramp = look.foliage ? leafRamp(look.foliage) : null;
  const shown: Array<{ c: Clump; grown: number; lumps: Lump[]; path: Path2D }> = [];
  if (ramp && look.full > 0) {
    for (const c of sk.clumps) {
      if (autumn && look.full < 0.5 && c.k > look.full + 0.45) continue;
      const grown = look.full >= 1 ? 1 : c.k < look.full ? 0.72 + 0.28 * look.full : 0.4 + 0.15 * look.full;
      const path = new Path2D();
      const lumps = (c.subs ?? []).map((u, j): Lump => {
        const p: V3 = add(c.c, mul(u.o, grown));
        const [x, y] = proj(e, p);
        const rx = u.r * ACROSS * grown;
        const seed = job.seed * 31 + Math.round(c.k * 1e6) + j * 7;
        const o = outlineAt(seed, j === 0 ? 4 : 8);
        massPath(path, x, y, rx, rx * PAD, o, 1, ROSE_EDGE, 16);
        // Its face out of the shrub, and a little up.
        const n = unit(add([(p[0] - sk.crown.c[0]) / sk.crown.r, (p[1] - sk.crown.c[1]) / sk.crown.r, (p[2] - sk.crown.c[2]) / sk.crown.rz], [0, 0, 0.35]));
        return { x, y, rx, ry: rx * PAD, o, seed, n, p, r: u.r * grown, near: near(p) };
      });
      shown.push({ c, grown, lumps, path });
    }
  }
  const leafy = shown.length > 0 && look.full >= 0.6;

  /* The canes, as runs of pieces: each on the screen, its width at each point. */
  const wood = winter || !look.foliage ? mix(BUSH_WOOD, job.def.flowers ?? job.def.foliage[1], 0.3) : mix(BUSH_WOOD, job.def.foliage[1], 0.45);
  const woodLit = rgb(mixRgb(hex(tone(wood, 0.2)), hex(wood), light.night ? 0.6 : 0));
  const woodShade = mix(wood, '#2e2230', 0.32);
  const thornCol = rgb(mixRgb(hex(woodShade), KIT_INK, 0.45));
  const runs: Run[] = [];
  {
    let cur: Run | null = null;
    sk.limbs.forEach((L, i) => {
      const goesOn = cur && L.parent === i - 1 && sk.limbs[i - 1].order === L.order;
      if (!goesOn) {
        cur = { q: [proj(e, L.a)], r: [Math.max(0.3, L.ra * ACROSS)], d: 0, z: [L.a[2]], order: L.order, nx: 0, ny: 0 };
        runs.push(cur);
      }
      cur!.q.push(proj(e, L.b));
      cur!.r.push(Math.max(0.3, L.rb * ACROSS));
      cur!.z.push(L.b[2]);
      cur!.d = Math.max(cur!.d, near(L.b));
    });
    // Across each run, toward the sun's side.
    for (const c of runs) {
      const [ax, ay] = c.q[0], [bx, by] = c.q[c.q.length - 1];
      const l = Math.hypot(bx - ax, by - ay) || 1;
      const nx = -(by - ay) / l, ny = (bx - ax) / l;
      const k = nx * sun.sx + ny * sun.sy < 0 ? -1 : 1;
      c.nx = nx * k; c.ny = ny * k;
    }
  }

  /* The ink round the whole bush, laid first: whatever is laid after covers it where two parts meet. */
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = ink;
  g.lineWidth = KIT_INK_W * 2;
  for (const s of shown) g.stroke(s.path);
  // Under a full head of leaf the side shoots are inside it: not drawn.
  const seen = look.full >= 1 ? runs.filter((c) => c.order < 2) : runs;
  /** A run as a line in two halves, each as wide as its middle, `by` that wide plus `extra`, `off` of its width to one side. */
  const stroke = (c: Run, by: number, extra: number, side = 0): void => {
    const n = c.q.length - 1, m = Math.max(1, n >> 1);
    for (const [j0, j1] of [[0, m], [m, n]]) {
      if (j1 <= j0) continue;
      g.lineWidth = (c.r[j0] + c.r[j1]) * by + extra;
      g.beginPath();
      for (let j = j0; j <= j1; j++) {
        const k = side * (c.r[j0] + c.r[j1]);
        const x = c.q[j][0] + c.nx * k, y = c.q[j][1] + c.ny * k;
        if (j === j0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
  };
  for (const c of seen) stroke(c, 1, KIT_INK_W * 0.8);

  /* A cane: its body in shade, its lit side toward the sun, thorns low on it, snow along its top in winter. */
  const paintRun = (c: Run): void => {
    const thorns = new Path2D(), snow = new Path2D();
    g.strokeStyle = woodShade;
    stroke(c, 1, 0);
    // Its side toward the sun.
    g.strokeStyle = woodLit;
    stroke(c, 0.5, 0, 0.22);
    for (let j = 0; j < c.q.length - 1; j++) {
      const [ax, ay] = c.q[j], [bx, by] = c.q[j + 1];
      const w = c.r[j] + c.r[j + 1];
      const l = Math.hypot(bx - ax, by - ay) || 1;
      // Thorns: one a piece on the lower cane, by turns either side, hooked down.
      if (c.z[j] < MID + 1.5 && c.order === 1) {
        const s = j % 2 ? 1 : -1;
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        const tx = -(by - ay) / l * s, ty = (bx - ax) / l * s;
        const r = w / 2, h = Math.max(0.45, w * 0.6);
        thorns.moveTo(mx + tx * r - (bx - ax) / l * h * 0.35, my + ty * r - (by - ay) / l * h * 0.35);
        thorns.lineTo(mx + tx * (r + h) + (ax - bx) / l * h * 0.25, my + ty * (r + h) + (ay - by) / l * h * 0.25 + h * 0.2);
        thorns.lineTo(mx + tx * r + (bx - ax) / l * h * 0.35, my + ty * r + (by - ay) / l * h * 0.35);
        thorns.closePath();
      }
      // Snow along the top of a cane lying near level.
      if (winter && c.order === 1 && c.z[j] > MID && Math.abs(by - ay) < Math.abs(bx - ax) * 1.4) {
        snow.moveTo(ax, ay - w * 0.3);
        snow.lineTo(bx, by - w * 0.3);
      }
    }
    g.fillStyle = thornCol;
    g.fill(thorns);
    if (winter) {
      g.strokeStyle = 'rgba(250,252,255,0.95)';
      g.lineWidth = Math.max(0.25, c.r[0] * 0.45);
      g.stroke(snow);
    }
  };

  /* A lobe, as the trees' clusters are painted: its rim, its shaded tone, then the core of its shade, its middle and its lit plane, each a plane in every lump at once, and glossy leaflets where the light catches it. */
  const paintLobe = (s: (typeof shown)[number]): void => {
    if (!ramp) return;
    const top = ramp.length - 1;
    const L = clumpLight(job, s.c);
    const b = Math.max(1, Math.min(top - 2, Math.round(L * (top - 1.6))));
    const [ccx, ccy] = proj(e, s.c.c);
    g.strokeStyle = rgb(mixRgb(hex(ramp[0]), KIT_INK, 0.7), 0.9);
    g.lineWidth = KIT_INK_W * 2;
    g.stroke(s.path);
    g.fillStyle = ramp[b];
    g.fill(s.path);
    g.save();
    g.clip(s.path);
    const sunny = (u: Lump): boolean => (u.x - ccx) * sun.sx + (u.y - ccy) * sun.sy - (u.y - ccy) * 0.5 >= -u.rx * 0.35;
    const plane = (along: number, down: number, k: number, col: string, n: number, lit = false): void => {
      const p = new Path2D();
      for (const u of s.lumps) {
        if (lit && !sunny(u)) continue;
        massPath(p, u.x + sun.sx * u.rx * along * off, u.y + sun.sy * u.ry * along * off + u.ry * down, u.rx * k, u.ry * k, outlineAt(u.seed + n, 0), 0.9, ROSE_EDGE, 12);
      }
      g.fillStyle = col;
      g.fill(p);
    };
    plane(-0.5, 0.3, 0.74, ramp[b - 1], 1);
    plane(0.16, -0.1, 0.78, ramp[b + 1], 2);
    if (!light.night || L > 0.6) {
      plane(0.38, -0.24, 0.46, ramp[b + 2], 3, true);
      // The gloss: a leaflet or two on each lit lump, palest.
      const gloss = new Path2D();
      for (const u of s.lumps) {
        if (!sunny(u)) continue;
        const R = mulberry32(u.seed + 5);
        for (let i = 0; i < 2; i++) {
          const a = Math.atan2(sun.sy - 0.7, sun.sx) + (R() - 0.5) * 1.5;
          const d = 0.3 + 0.35 * R();
          leaflet(gloss, u.x + Math.cos(a) * u.rx * d, u.y + Math.sin(a) * u.ry * d, u.rx * 0.28, a + Math.PI / 2 + (R() - 0.5) * 0.6);
        }
      }
      g.fillStyle = ramp[Math.min(top, b + 3)];
      g.fill(gloss);
    }
    g.restore();
  };

  /* Everything by its depth: under a full head of leaf the canes go first, the lobes over them. */
  type Item = { d: number; draw: () => void };
  const items: Item[] = [];
  for (const c of seen) items.push({ d: leafy ? -1e6 : c.d - 1, draw: () => paintRun(c) });
  for (const s of shown) items.push({ d: near(s.c.c), draw: () => paintLobe(s) });
  items.sort((a, b) => a.d - b.d);
  for (const it of items) it.draw();

  /* Roses or hips, on the outer and top faces where nothing nearer covers them. */
  if (look.flowers) paintBlooms(g, job, shown.flatMap((s) => s.lumps), runs, autumn);
}

/**
 * The roses -- open five-petalled flowers with a bud or two beside each --
 * or in autumn the hips, in clusters on the lumps facing out and up, and one
 * at the end of each long cane. A flower is drawn where no lump nearer the
 * eye covers it. A handful of paths for the whole bush.
 */
function paintBlooms(g: Ctx, job: BushJob, lumps: Lump[], runs: Run[], hips: boolean): void {
  const { e, light } = job;
  const toward = unit(e.toward as V3);
  const sun = sunOnScreen(job);
  const R = mulberry32(job.seed + 404);
  const at: Array<{ x: number; y: number; s: number; bud: boolean; a: number }> = [];
  const covered = (x: number, y: number, d: number, own: Lump | null): boolean =>
    lumps.some((u) => u !== own && u.near > d + 0.2 && ((x - u.x) / u.rx) ** 2 + ((y - u.y) / u.ry) ** 2 < 0.8);
  const size = hips ? 0.66 : 1.25;
  // Where they sit: lumps facing the eye or the sky, in a seeded order, a cluster of three on each until there are enough.
  const sites = lumps.filter((u) => dot(u.n, toward) > 0.02 && u.n[2] > -0.15).map((u) => ({ u, k: R() - 0.3 * u.n[2] })).sort((a, b) => a.k - b.k);
  const most = hips ? 14 : 18;
  for (const { u } of sites) {
    if (at.length >= most) break;
    const side = unit([-u.n[1] + 0.01, u.n[0], 0]);
    for (let i = 0; i < 3; i++) {
      // Three about a point on its face: two up and apart, one under them.
      const t = (i === 0 ? -0.62 : i === 1 ? 0.62 : 0) + (R() - 0.5) * 0.15;
      const dz = (i === 2 ? -0.6 : 0.12) + (R() - 0.5) * 0.12 - (hips ? 0.3 : 0);
      const dir = unit(add(add(u.n, mul(side, t)), [0, 0, dz]));
      const p = add(u.p, mul(dir, u.r * (hips ? 0.8 : 0.8)));
      const [x, y] = proj(e, p);
      const sz = size * ACROSS * (0.88 + 0.24 * R());
      // Each clear of the next: a bud may tuck under an open one.
      const bud = !hips && i === 2 && R() < 0.7;
      if (covered(x, y, dot(p, toward), u) || at.some((f) => Math.hypot(f.x - x, f.y - y) < (f.s + sz) * (bud || f.bud ? 0.62 : hips ? 0.7 : 0.88))) continue;
      at.push({ x, y, s: sz, bud, a: hips ? (R() - 0.5) * 1.2 : R() * TAU });
    }
  }
  // At the end of each long cane.
  for (const c of runs) {
    if (c.q.length < 7) continue;
    const [x, y] = c.q[c.q.length - 1];
    at.push({ x, y, s: size * ACROSS, bud: false, a: hips ? (R() - 0.5) * 1.2 : R() * TAU });
  }
  if (!at.length) return;
  const t = bloomTones(job.look.flowers!, light.night);
  const ink = rgb(KIT_INK, 0.9);
  const sa = Math.atan2(sun.sy, sun.sx);
  if (hips) {
    // Hips: an ink rim, the shaded body, the lit side toward the sun, a fleck of shine, and the dark calyx at the tip.
    const body = (k: number, extra: number, dx = 0, dy = 0): Path2D => {
      const p = new Path2D();
      for (const h of at) {
        p.moveTo(h.x + dx + h.s * 0.66 * k + extra, h.y + dy);
        p.ellipse(h.x + dx, h.y + dy, h.s * 0.66 * k + extra, h.s * k + extra, h.a, 0, TAU);
      }
      return p;
    };
    g.fillStyle = ink;
    g.fill(body(1, KIT_INK_W * 0.45));
    g.fillStyle = t.shade;
    g.fill(body(1, 0));
    g.fillStyle = t.body;
    g.fill(body(0.7, 0, sun.sx * at[0].s * 0.16, sun.sy * at[0].s * 0.16 - at[0].s * 0.1));
    const tip = new Path2D(), shine = new Path2D();
    for (const h of at) {
      // The dried calyx at its far end.
      const cx = h.x + Math.sin(h.a) * h.s * 0.95, cy = h.y - Math.cos(h.a) * h.s * 0.95;
      tip.moveTo(cx + h.s * 0.28, cy);
      tip.ellipse(cx, cy, h.s * 0.28, h.s * 0.18, h.a, 0, TAU);
      const hx = h.x + Math.cos(sa) * h.s * 0.3, hy = h.y + Math.sin(sa) * h.s * 0.3 - h.s * 0.25;
      shine.moveTo(hx + h.s * 0.16, hy);
      shine.arc(hx, hy, h.s * 0.16, 0, TAU);
    }
    g.fillStyle = rgb(mixRgb(hex(tone(t.body, -0.4)), KIT_INK, 0.4));
    g.fill(tip);
    if (!light.night) {
      g.fillStyle = tone(t.lit, 0.4);
      g.fill(shine);
    }
    return;
  }
  // Roses: five round petals round a deep heart, the petals turned to the sun lit; buds closed, on a green cup.
  const open = at.filter((f) => !f.bud), buds = at.filter((f) => f.bud);
  const petals = (f: { x: number; y: number; s: number; a: number }, p: Path2D, k: number, extra: number): void => {
    for (let i = 0; i < 5; i++) {
      const a = f.a + (i * TAU) / 5;
      const x = f.x + Math.cos(a) * f.s * 0.5 * k, y = f.y + Math.sin(a) * f.s * 0.42 * k;
      const r = f.s * 0.52 * k + extra;
      p.moveTo(x + r, y);
      p.ellipse(x, y, r, r * 0.84, 0, 0, TAU);
    }
  };
  // The petals in shade, then lit toward the sun, then their body set off it: a lit rim on the sun's side and a shaded one on the other.
  const inkP = new Path2D(), shade = new Path2D(), lit = new Path2D(), body = new Path2D(), deep = new Path2D(), eye = new Path2D();
  const ox = Math.cos(sa), oy = Math.sin(sa);
  for (const f of open) {
    petals(f, inkP, 1, KIT_INK_W * 0.4);
    petals(f, shade, 1, 0);
    petals({ ...f, x: f.x + ox * f.s * 0.08, y: f.y + oy * f.s * 0.08 - f.s * 0.04 }, lit, 0.94, 0);
    const bx = f.x - ox * f.s * 0.08, by = f.y - oy * f.s * 0.08 + f.s * 0.03;
    body.moveTo(bx + f.s * 0.74, by);
    body.ellipse(bx, by, f.s * 0.74, f.s * 0.64, 0, 0, TAU);
    deep.moveTo(f.x + f.s * 0.3, f.y);
    deep.ellipse(f.x, f.y, f.s * 0.3, f.s * 0.25, 0, 0, TAU);
    eye.moveTo(f.x + f.s * 0.13, f.y);
    eye.ellipse(f.x, f.y, f.s * 0.13, f.s * 0.11, 0, 0, TAU);
  }
  // A bud: a point-topped drop, closed, on a green cup.
  const bud = new Path2D(), cup = new Path2D();
  for (const f of buds) {
    const r = f.s * 0.42;
    bud.moveTo(f.x, f.y - r * 1.7);
    bud.quadraticCurveTo(f.x + r * 1.3, f.y - r * 0.3, f.x, f.y + r * 0.9);
    bud.quadraticCurveTo(f.x - r * 1.3, f.y - r * 0.3, f.x, f.y - r * 1.7);
    bud.closePath();
    cup.moveTo(f.x - r * 1.0, f.y - r * 0.1);
    cup.quadraticCurveTo(f.x, f.y + r * 1.9, f.x + r * 1.0, f.y - r * 0.1);
    cup.quadraticCurveTo(f.x, f.y + r * 0.6, f.x - r * 1.0, f.y - r * 0.1);
  }
  g.fillStyle = ink;
  g.fill(inkP);
  g.strokeStyle = ink;
  g.lineWidth = KIT_INK_W * 0.8;
  g.stroke(bud);
  g.fillStyle = t.shade;
  g.fill(shade);
  // A bud closed and deeper, in its green cup.
  g.fillStyle = mix(t.body, t.deep, 0.3);
  g.fill(bud);
  g.fillStyle = mix(job.def.foliage[1], '#1e2c3a', light.night ? 0.4 : 0.1);
  g.fill(cup);
  g.fillStyle = light.night ? t.body : t.lit;
  g.fill(lit);
  g.fillStyle = t.body;
  g.fill(body);
  g.fillStyle = t.deep;
  g.fill(deep);
  g.fillStyle = t.heart;
  g.fill(eye);
}

export const rose: Bush3D = { name: 'Rose bush', grow, paint };
